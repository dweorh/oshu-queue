const OshuJobMessage = require('./job_message')
const { OshuQueueCommon, OshuQueueStatus, SEA } = require('./queue_common')
module.exports = class OshuSubscriber extends OshuQueueCommon {
    orchestrator_id = false
    orchestrator = {
        epub: false,
        certs: false
    }
    orch_handler = false
    queue_sub = false
    // queue_log = false
    status = false
    resolver = false
    constructor(params, resolver) {
        super()
        this.pair = params.SUBSCRIBER_PAIR || false
        this.orchestrator_id = params.ORCHESTRATOR_ID || false
        this.peer = params.HOST_ADDRESS
        // constructor (epub, type, job, ts_job, active) {
        this.status = new OshuJobMessage(false, params.SUBSCRIBER_TYPE || 'generic', false, false, true)
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
                        // this.queue_log = this.orch_handler.get('queue-log')
                        
                        this.status.epub = this.pair.epub
                        
                        this._reportStatus()

                        this.queue_sub.get(this.pair.pub).on((data, _key, _msg, _eve) => this._jobListener(data, _key, _msg, _eve))

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
            await this.status.toObject(this.orchestrator.epub, this.pair), 
            cb, 
            {opt: { cert: this.orchestrator.certs['queue-sub'] }}
        )
    }

    async _jobListener(data, _key, _msg, _eve) {
        if (!this.status.job && data.job) {
            let message = await OshuJobMessage.from(data, this.orchestrator.epub, this.pair)
            this.status.job = message.job
            this.status.ts_job = message.ts_job
            if (this.resolver && message.job) {
                const obj = await message.toObject()
                this.status.job.payload = this.resolver(obj.job.payload)
                this.status.job.status = OshuQueueStatus.DONE
                this.status.ts_job = Date.now()
                this._reportStatus(() => {
                    setTimeout( () => {
                        this.status.job = false
                        this.status.ts_job = 0
                        this._reportStatus() // free again ;)
                    }, 500) // some delay to let the previous message propagate
                })
            }
        }
    }
}