// const { SEA } = require('./queue_common')
// const { v4: uuidv4 } = require('uuid');
import { SEA, OshuQueueAuthEnvelope } from './queue_common.js';
import { v4 as uuidv4 } from 'uuid';
export class OshuQueueMessage {
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
    auth = false // encrypted OshuQueueAuthEnvelope

    constructor (sender, data, status, type, response, creator_epub, id, auth = false) {
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
        this.setAuth(auth)
    }

    get id() {
        return this.message.id
    }

    setAuth (auth) {
        if (auth && auth instanceof OshuQueueAuthEnvelope === false) {
            throw new Error('Wrong type of the auth envelope!')
        }
        this.auth = auth
    }

    static async from(msg, epub, keys) {
        const message = { ...msg }
        const secret = await SEA.secret(epub, keys)
        message.payload = await SEA.decrypt(message.payload, secret)
        if (message.auth) {
            message.auth = await OshuQueueAuthEnvelope.from(message.auth, epub, keys)
        } else {
            message.auth = false
        }
        return new OshuQueueMessage(keys, message.payload.data, message.status, message.type, message.payload.response, message.epub, message.id, message.auth)
    }

    async toObject(epub, keys) {
        const obj = JSON.parse(JSON.stringify(this.message))
        if (epub) {
            const secret = await SEA.secret(epub, keys || this.sender)
            obj.payload = await SEA.encrypt(obj.payload, secret)
            if(this.auth) {
                obj.auth = await this.auth.encrypt(epub, keys || this.sender)
            }
        }
        return obj
    }
}

export default {
    OshuQueueMessage
}