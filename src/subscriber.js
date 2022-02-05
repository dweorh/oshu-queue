const OshuJobMessage = require('./job_message')
const { OshuQueueCommon, OshuQueueStatus, OshuSubscriberStatus, SEA } = require('./queue_common')
module.exports = class OshuSubscriber extends OshuQueueCommon {
    orchestrator_id = false
    orchestrator = {
        epub: false,
        certs: false
    }
    orch_handler = false
    queue_sub = false
    queue_jobs = false
    // queue_log = false
    status = false
    type = false
    resolver = false
    jobs = {}
    constructor(params, resolver) {
        super()
        this.pair = params.SUBSCRIBER_PAIR || false
        this.orchestrator_id = params.ORCHESTRATOR_ID || false
        this.peer = params.HOST_ADDRESS
        this.type = params.SUBSCRIBER_TYPE || 'generic'
        this.status = OshuSubscriberStatus.FREE
        // constructor (epub, type, job, ts_job, active) {
        // this.status = new OshuJobMessage(false, params.SUBSCRIBER_TYPE || 'generic', false, false, true)

        if (typeof resolver !== 'function') {
            throw new Error('The `resolver` needs to be a function.')
        }
        this.resolver = resolver
    }

    async initialize(cb) {
        this._init(async (ack) => {
            if (this.created) {
                console.info("Add this to your .env file\nSUBSCRIBER_PAIR='" + JSON.stringify(this.pair) + "'")
            }
            if (this.authorized) {
                this.orch_handler = this.gun.get('~' + this.orchestrator_id)

                this.orch_handler.get('public').get('epub').once(data => {
                    this.orchestrator.epub = data
                    this.orch_handler.get('public').get('certs').once(data => {
                        this.orchestrator.certs = data

                        this.queue_sub = this.orch_handler.get('queue-sub')
                        this.queue_jobs = this.orch_handler.get('queue-jobs').get(this.pair.pub)
                        // this.queue_log = this.orch_handler.get('queue-log')
                        
                        this._reportStatus()

                        this.queue_jobs.map((data, _key, _msg, _eve) => this._jobListener(data, _key, _msg, _eve))

                        if (cb) cb(ack)
                    })
                })
            } else {
                if (cb) cb(ack)
            }
        })
    }

    async _reportStatus(cb) {
        this.queue_sub.get(this.pair.pub).put(
            // await this.status.toObject(this.orchestrator.epub, this.pair), 
            {
                epub: this.pair.epub,
                status: this.status,
                type: this.type
            },
            cb, 
            {opt: { cert: this.orchestrator.certs['queue-sub'] }}
        )
    }

    async _jobListener(data, _key, _msg, _eve) {
        if (!data || !data.job) {
            delete this.jobs[_key]
            return
        }
        
        let message = await OshuJobMessage.from(data, this.orchestrator.epub, this.pair)
        
        if (!message.job || message.job.status !== OshuQueueStatus.CREATED) {
            return
        }

        if (this.status !== OshuSubscriberStatus.FREE) {
            if (this.jobs[_key]) {
                return
            }
            message.job.status = OshuQueueStatus.REJECTED
            this.queue_jobs.get(_key).put(
                await message.toObject(this.orchestrator.epub, this.pair),
                null, 
                {opt: { cert: this.orchestrator.certs['queue-jobs'] }}
            )
            return
        }
        if (this.resolver && message.job) {
            this.jobs[_key] = Date.now()
            this.status = OshuSubscriberStatus.BUSY
            this._reportStatus()

            const obj = await message.toObject()
            message.job.payload.response =  this.resolver(obj.job.payload)
            message.job.status = OshuQueueStatus.DONE
            this.queue_jobs.get(_key).put(
                await message.toObject(this.orchestrator.epub, this.pair),
                null, 
                {opt: { cert: this.orchestrator.certs['queue-jobs'] }}
            )
            this.status = OshuSubscriberStatus.FREE
            this._reportStatus()
        }
    }
}