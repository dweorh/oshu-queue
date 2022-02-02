const { SEA, OshuQueueStatus } = require('./queue_common')
module.exports = class OshuJobMessage {
    epub = false
    type = false
    job = {
        id: false,
        status: OshuQueueStatus.CREATED,
        payload: {
            data: false,
            response: false
        }
    }
    ts_job = false
    active = true

    constructor (epub, type, job, ts_job, active) {
        this.epub = epub
        this.type = type
        this.job = job
        this.ts_job = ts_job
        this.active = active ?? true
    }

    static async from (message, epub, keys) {
        const msg = { ...message}
        if (epub && keys && msg.job) {
            const secret = await SEA.secret(epub, keys)
            msg.job = await SEA.decrypt(msg.job, secret)
        }
        return new OshuJobMessage(msg.epub, msg.type, msg.job, msg.ts_job, msg.active)
    }

    async toObject(epub, keys) {
        const obj = JSON.parse(JSON.stringify({
            epub: this.epub,
            type: this.type,
            job: this.job,
            ts_job: this.ts_job,
            active: this.active,
        }))
        if (epub && keys) {
            const secret = await SEA.secret(epub, keys)
            obj.job = await SEA.encrypt(obj.job, secret)
        }
        return obj
    }
}