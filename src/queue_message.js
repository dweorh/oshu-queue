const { SEA } = require('./queue_common')
const { v4: uuidv4 } = require('uuid');
module.exports = class OshuQueueMessage {
    sender = false
    message = {
        id: false,
        status: 0, // OshuQueueStatus: 0 - created, 1 - assigned, 2 - in progress, 3 - finished successfuly, 4 - failed
        type: 'generic', // any string but needs to have matching subscribers, otherwise the task will never be done
        epub: false,
        payload: {
            data: false,
            response: false,
        }
    }

    constructor (sender, data, status, type, response, creator_epub, id) {
        this.sender = sender
        this.message = {
            id: id || uuidv4(),
            status: status || 0,
            type: type || 'generic',
            epub: creator_epub || sender.epub,
            payload:{
                data: data,
                response: response
            }
        }
    }

    get id() {
        return this.message.id
    }

    static async from(msg, epub, keys) {
        const message = { ...msg }
        const secret = await SEA.secret(epub, keys)
        message.payload = await SEA.decrypt(message.payload, secret)
        return new OshuQueueMessage(keys, message.payload.data, message.status, message.type, message.payload.response, message.epub, message.id)
    }

    async toObject(epub, keys) {
        const obj = JSON.parse(JSON.stringify(this.message))
        if (epub) {
            const secret = await SEA.secret(epub, keys || this.sender)
            obj.payload = await SEA.encrypt(obj.payload, secret)
        }
        return obj
    }
}