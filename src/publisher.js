const { OshuQueueCommon, OshuQueueStatus } = require('./queue_common')
const OshuQueueMessage = require('./queue_message')
module.exports = class OshuPublisher extends OshuQueueCommon {
    orchestrator_id = false
    orchestrator = {
        epub: false,
        certs: false
    }
    orch_handler = false
    messages = {}
    constructor(params) {
        super()
        this.pair = params.PUBLISHER_PAIR || false
        this.orchestrator_id = params.ORCHESTRATOR_ID || false
        this.peer = params.HOST_ADDRESS
    }

    async initialize(cb) {
        this._init(async (ack) => {
            if (this.created) {
                console.info("Add this to your .env file\nPUBLISHER_PAIR='" + JSON.stringify(this.pair) + "'")
            }
            if (this.authorized) {
                this.orch_handler = this.gun.get('~' + this.orchestrator_id)

                this.orch_handler.get('public').get('epub').once(data => {
                    this.orchestrator.epub = data
                    this.orch_handler.get('public').get('certs').once(data => {
                        this.orchestrator.certs = data
                        if (cb) cb(ack)
                    })
                })
            } else {
                if (cb) cb(ack)
            }
        })
    }

    createMessage(data) {
        return new OshuQueueMessage(this.pair, data)
    }

    async encryptMessage(message) {
        this._is_message(message)
        return await message.toObject(this.orchestrator.epub)
    }

    async readMessage(message) {
        return await OshuQueueMessage.from(message, this.orchestrator.epub, this.pair)
    }

    async sendMessage(message, cb) {
        this._is_message(message)
        const key = this.pair.pub + '|' + message.id
        const enc = await this.encryptMessage(message)
        this.orch_handler.get('queue-in').get(key).put(enc, () => {
            this._setMessageListener(key, cb)
        }, {opt: { cert: this.orchestrator.certs['queue-in'] }})
    }

    _setMessageListener(key, cb) {
        this.orch_handler.get('queue-in').get(key).on(async (data, _key, _msg, _eve) => {
            let prev_status = this.messages[data.id]
            this.messages[data.id] = data.status

            if (cb && prev_status !== data.status) {
                let message = await this.readMessage(data)
                cb(key, message)
            }
            
            if (data.status === OshuQueueStatus.DONE) {
                delete this.messages[data.id]
                _eve.off()
            }
        })
    }

    _is_message(message) {
        if (message instanceof OshuQueueMessage === false)
            throw new Error('Message needs to be an instance of OshuQueueMessage not an ' + message.constructor.name)
    }
}