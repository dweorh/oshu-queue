const { OshuQueueCommon, OshuQueueStatus, OshuSubscriberStatus, SEA } = require('./queue_common')
const OshuQueueMessage = require('./queue_message')
const OshuJobMessage = require('./job_message')
const { v4: uuidv4 } = require('uuid');
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
                        'queue-jobs': await SEA.certify('*', { '*': 'queue-jobs', '+': '*' }, this.pair, null), // for subscribers for reporting job status
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
                    this._setupQueuesHandlers()
                    if (cb) cb()
                } else { // it might be the only case but it would unnecessary slow down setting up the process
                    this.gun.user().get('private').get('keys').once(async keys => {
                        this.keys = await SEA.decrypt(keys, this.pair)
                        this._setupQueuesHandlers()
                        if (cb) cb()
                    })
                }
            } else {
                cb(this)
            }
        })
    }

    _setupQueuesHandlers() {
        this.gun.user().get('queue-in').map((data, key) => this._queueInHandler(data, key))
        this.gun.user().get('queue-sub').on((data, key) => this._queueSubHandler(data, key))
    }

    async _queueInHandler(data, key) {
        if (!this.queue_in[key] && data.status === OshuQueueStatus.CREATED && !this._existsInQueue(key)) {
            const idx = uuidv4() // to break a chain publisher <-> subscriber
            this.queue_in[idx] = {
                key: key,
                data: await OshuQueueMessage.from(data, data.epub, this.keys.main),
                ts: Date.now()
            }
            this._findSubscriberForJob(idx)
        }
    }

    _existsInQueue(key) {
        return Object.values(this.queue_in).findIndex(el => el.key === key) >= 0
    }

    _queueSubHandler(data, __key) {
        let nodes = data._['>']
        Object.keys(nodes).forEach(_key => {
            if (!this.subscribers[_key] || ( this.subscribers[_key] && this.subscribers[_key].ts < nodes[_key] )) {
                this.subscribers[_key] = this.subscribers[_key] || {
                    pub: _key,
                    epub: false,
                    status: OshuSubscriberStatus.UNKNOWN,
                    type: false
                }
                this.subscribers[_key].ts = nodes[_key]
                this.gun.user().get('queue-sub').get(_key).once(async data => {
                    const is_new = this.subscribers[_key].status === OshuSubscriberStatus.UNKNOWN
                    this.subscribers[_key].status = data.status
                    this.subscribers[_key].type = data.type
                    this.subscribers[_key].epub = data.epub
                    
                    if (is_new) {
                        this._singleSubJobsHandler(_key)
                    }
                    if (this.subscribers[_key].status === OshuSubscriberStatus.FREE) {
                        this._findJobForSubscriber(_key)
                    }
                })
            }
        })
    }
    _singleSubJobsHandler(subscriber_id) {
        this.gun.user().get('queue-jobs').get(subscriber_id).on(data => {
            let nodes = data._['>']
            Object.keys(nodes).forEach(_key => {
                if(this.queue_in[_key] && this.queue_in[_key].ts < nodes[_key]) {
                    this.queue_in[_key].ts = nodes[_key]
                    this.gun.user().get('queue-jobs').get(subscriber_id).get(_key).once(async (job_data) => {
                        if (!job_data) {
                            return
                        }
                        const message = await OshuJobMessage.from(job_data, this.subscribers[subscriber_id].epub, this.keys.main)
                        const queue_message = this.queue_in[message.job.id]
                        if (!queue_message) {
                            return
                        }
                        switch (message.job.status) {
                            case OshuQueueStatus.REJECTED:
                                // subscriber might reject processing it, move job back to the pool
                                this.queue_in[message.job.id].data.message.status = OshuQueueStatus.CREATED
                                this.queue_in[message.job.id].data.ts = Date.now()
                                this.gun.user()
                                    .get('queue-in')
                                    .get(queue_message.key)
                                    .get('status')
                                    .put(OshuQueueStatus.CREATED)
                                this.gun.user().get('queue-jobs').get(subscriber_id).get(_key).put(null)
                                throw new Error()
                            break
                            case OshuQueueStatus.DONE:
                            case OshuQueueStatus.FAILED:
                                this.queue_in[message.job.id].data.message.status = message.job.status
                                this.queue_in[message.job.id].data.message.payload = message.job.payload
                                const queue_message_data = this.queue_in[message.job.id].data
                                this.gun.user()
                                    .get('queue-in')
                                    .get(queue_message.key)
                                    .put(await queue_message_data.toObject(queue_message_data.message.epub, this.keys.main))
                                this.gun.user().get('queue-jobs').get(subscriber_id).get(_key).put(null)
                                delete this.queue_in[message.job.id]
                            break
                        }
                        this.gun.user().get('queue-log').get(this.pair.pub).get(queue_message.key).put({
                            ts: Date.now(),
                            subscriber: subscriber_id,
                            status: message.job.status
                        })
                    })
                }
            })
        })
    }

    _findJobForSubscriber(key) {
        let type = this.subscribers[key].type
        let task = Object.entries(this.queue_in).find(
            el => el[1].data.message.status === OshuQueueStatus.CREATED && el[1].data.message.type === type
        )
        if (task) {
            this._assingJobToSubscriber(task[0], key)
        }
    }

    _findSubscriberForJob(idx) {
        let task = this.queue_in[idx]
        for (let i in this.subscribers) {
            if ( this.subscribers[i].status
                && this.subscribers[i].type === task.data.message.type 
                && this.subscribers[i].status === OshuSubscriberStatus.FREE
            ) {
                return this._assingJobToSubscriber(idx, i)
            }
        }
    }

    async _assingJobToSubscriber(idx, subscriber_id) {
        if (this.subscribers[subscriber_id].status !== OshuSubscriberStatus.FREE) {
            return
        }

        let task = this.queue_in[idx]
        let subscriber_epub = this.subscribers[subscriber_id].epub
        let message = new OshuJobMessage(
            task.data.message.type,
            {
                id: idx,
                status: task.data.message.status,
                payload: task.data.message.payload
            }
        )
        
        this.queue_in[idx].data.message.status = OshuQueueStatus.ASSIGNED
        this.queue_in[idx].data.ts = Date.now()

        this.gun.user().get('queue-jobs').get(subscriber_id).get(idx).put(await message.toObject(subscriber_epub, this.keys.main))

        this.gun.user().get('queue-log').get(this.pair.pub).get(task.key).put({
            ts: Date.now(),
            subscriber: subscriber_id,
            status: OshuQueueStatus.ASSIGNED
        })
        this.gun.user().get('queue-in').get(task.key).get('status').put(OshuQueueStatus.ASSIGNED)
    }
}