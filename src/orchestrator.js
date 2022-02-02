const { OshuQueueCommon, OshuQueueStatus, SEA } = require('./queue_common')
const OshuQueueMessage = require('./queue_message')
const OshuJobMessage = require('./job_message')
module.exports = class OshuQueueOrchestrator extends OshuQueueCommon{
    queue_in = {}
    subscribers = {} // aka workers
    constructor(params) {
        super()
        this.pair = params.ORCHESTRATOR_PAIR || false
        this.peer = params.HOST_ADDRESS
    }
    async initialize(cb) {
        this._init(async () => {
            if (this.created) {
                console.info("Add this to your .env file\nORCHESTRATOR_PAIR='" + JSON.stringify(this.pair) + "'")
                if (this.authorized) {
                    this.keys = {
                        main: await SEA.pair()  
                    }
                    const certs = {
                        'queue-in': await SEA.certify('*', { '*': 'queue-in', '+': '*' }, this.pair, null), // for publishers to drop tasks
                        // 'queue-log': await SEA.certify('*', { '*': 'queue-log', '+': '*' }, this.pair, null), // for subscribers for reporting jobs status
                        'queue-sub': await SEA.certify('*', { '*': 'queue-sub', '+': '*' }, this.pair, null), // for subscribers for reporting their status
                    }
                    const keys_enc = await SEA.encrypt(this.keys, this.pair)

                    this.gun.user().get('public').put({
                        'certs': certs,
                        'epub': this.keys.main.epub
                    }, ack => {
                        if (ack.err)
                            return cb ? cb(ack) : false
                        else 
                            this.gun.user().get('private').put({ 'keys': keys_enc }, ack => {
                                if (ack.error)
                                    return cb ? cb(ack) : false
                            })
                    })
                }
            }
            if (this.authorized) {
                if (this.keys) {
                    this.gun.user().get('queue-in').map((data, key) => this._queueInHandler(data, key))
                    this.gun.user().get('queue-sub').on((data, key) => this._queueSubHandler(data, key))
                    if (cb) cb()
                } else { // it might be the only case but it would unnecessary slow down setting up the process
                    this.gun.user().get('private').get('keys').once(async keys => {
                        this.keys = await SEA.decrypt(keys, this.pair)
                        this.gun.user().get('queue-in').map((data, key) => this._queueInHandler(data, key))
                        this.gun.user().get('queue-sub').on((data, key) => this._queueSubHandler(data, key))
                        if (cb) cb()
                    })
                }
            } else {
                cb(this)
            }
        })
    }

    async _queueInHandler(data, key) {
        if (!this.queue_in[key] && data.status === OshuQueueStatus.CREATED) {
            this.queue_in[key] = {
                key: key,
                data: await OshuQueueMessage.from(data, data.epub, this.keys.main)
            }
            this._findSubscriberForJob(key)
        }
    }

    _queueSubHandler(data, __key) {
        let nodes = data._['>']
        Object.keys(nodes).forEach(_key => {
            if (!this.subscribers[_key] || ( this.subscribers[_key] && this.subscribers[_key].ts < nodes[_key] )) {
                this.subscribers[_key] = this.subscribers[_key] || {
                    pub: _key,
                    job_id: false,
                    status: false
                }
                this.subscribers[_key].ts = nodes[_key]
                this.gun.user().get('queue-sub').get(_key).once(async data => {
                    if (!this.subscribers[_key].status || data.ts_job === 0) {
                        this.subscribers[_key].status = await OshuJobMessage.from(data, data.epub, this.keys.main)
                        if (!this.subscribers[_key].status.job) {
                            this._findJobForSubscriber(_key)
                        }
                    } else if (this.subscribers[_key].status.ts_job < data.ts_job) {
                        this.subscribers[_key].status = await OshuJobMessage.from(data, data.epub, this.keys.main)
                        this._processSubscribersJob(_key)
                    }
                })
            }
        })
    }
    
    async _processSubscribersJob(key) {
        let main_job_id = this.subscribers[key].job_id
        
        if (typeof this.queue_in[main_job_id] === 'undefined') {
            return
        }

        let job = this.subscribers[key].status.job
        let publisher_epub = this.queue_in[main_job_id].data.message.epub
        
        this.queue_in[main_job_id].data.message.status = job.status
        this.queue_in[main_job_id].data.message.payload = job.payload
        let data = await this.queue_in[main_job_id].data.toObject(publisher_epub, this.keys.main)

        let update = {
            status: data.status,
            payload: data.payload
        }
        this.gun.user().get('queue-in').get(main_job_id).put(update)

        if (job && job.status === OshuQueueStatus.DONE) { // job done
            delete this.queue_in[main_job_id]
            this.subscribers[key].job_id = false
            this.subscribers[key].status.job = false
            this.subscribers[key].status.ts_job = 0
        }
    }

    _findJobForSubscriber(key) {
        let type = this.subscribers[key].status.type
        let tasks = Object.values(this.queue_in)
        let task = tasks.find(task => {
            return task.data.message.status === OshuQueueStatus.CREATED && task.data.message.type === type
        })
        if (task) {
            this._assingJobToSubscriber(task.key, key)
        }
    }

    _findSubscriberForJob(key) {
        let task = this.queue_in[key]
        for (let i in this.subscribers) {
            if ( this.subscribers[i].status && this.subscribers[i].status.type === task.data.message.type && !this.subscribers[i].status.job) {
                return this._assingJobToSubscriber(key, i)
            }
        }
    }

    async _assingJobToSubscriber(job_id, subscriber_id) {
        let task = this.queue_in[job_id]
        this.subscribers[subscriber_id].job_id = job_id
        this.subscribers[subscriber_id].status.job = {
            id: task.data.message.id,
            status: OshuQueueStatus.CREATED,
            payload: task.data.message.payload
        }
        this.subscribers[subscriber_id].status.ts_job = Date.now()
        let subscriber_epub = this.subscribers[subscriber_id].status.epub
        let status = await this.subscribers[subscriber_id].status.toObject(subscriber_epub, this.keys.main)

        this.gun.user().get('queue-sub').get(subscriber_id).put(status, (ack) => {
            this.queue_in[job_id].data.message.status = OshuQueueStatus.ASSIGNED
            this.gun.user().get('queue-log').get(this.pair.pub).get(job_id).put({
                job_id: job_id,
                ts: this.subscribers[subscriber_id].status.ts_job,
                subscriber: subscriber_id,
                status: OshuQueueStatus.ASSIGNED
            })
            this.gun.user().get('queue-in').get(job_id).get('status').put(OshuQueueStatus.ASSIGNED)
        })

    }
}