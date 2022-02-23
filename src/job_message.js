import { SEA, OshuQueueStatus } from './queue_common.js'
export class OshuJobMessage {
    type = false
    job = {
        id: false,
        status: OshuQueueStatus.CREATED,
        payload: {
            data: false,
            response: false
        }
    }

    constructor (type, job) {
        this.type = type
        this.job = job
    }

    static async from (message, epub, keys) {
        const msg = { ...message}
        if (epub && keys && msg.job) {
            const secret = await SEA.secret(epub, keys)
            msg.job = await SEA.decrypt(msg.job, secret)
        }
        return new OshuJobMessage(msg.type, msg.job)
    }

    async toObject(epub, keys) {
        const obj = JSON.parse(JSON.stringify({
            type: this.type,
            job: this.job,
        }))
        if (epub && keys) {
            const secret = await SEA.secret(epub, keys)
            obj.job = await SEA.encrypt(obj.job, secret)
        }
        return obj
    }
}
export default {
    OshuJobMessage
}