export let Gun
export let SEA
export let WebSocket
let moduleImports = async () => { 
    Gun = (await import('gun')).default
    SEA = (await import('gun/sea')).default
}
let localImports = async () => {
    Gun = (await import('../libs/gun/gun.js')).default
    SEA = (await import('../libs/gun/sea.js')).default
}
if (process.env.USE_MODULES === 'true') {
    // Gun = require('gun')
    // SEA = require('gun/sea')
    await moduleImports()
} else {
    // Gun = require('../libs/gun/gun.js')
    // SEA = require('../libs/gun/sea.js')
    await localImports()
}

if (typeof window == 'undefined') {
    // WebSocket = require('ws')
    WebSocket = (await import('ws')).default
}

export class OshuQueueBasicAuth {
    key = false
    constructor(key) {
        this.key = key
    }

    auth( envelope ) {
        return envelope && envelope.key === this.key
    }
}

export class OshuQueueAuthEnvelope {
    key = false
    data = {}

    constructor (key, data = {}) {
        this.key = key
        this.data = data
    }

    static async from(encrypted, epub, keys) {
        if (encrypted instanceof OshuQueueAuthEnvelope) {
            return encrypted
        }
        const secret = await SEA.secret(epub, keys)
        const decrypted = await SEA.decrypt(encrypted, secret)
        return new OshuQueueAuthEnvelope(decrypted.key, decrypted.data)
    }

    async encrypt(epub, keys) {
        const data = JSON.parse(JSON.stringify({
            key: this.key,
            data: this.data
        }))
        const secret = await SEA.secret(epub, keys)
        const encrypted = await SEA.encrypt(data, secret)
        return encrypted
    }
}

// export class OshuQueuePlayerType {
//     static get ORCHESTRATOR() { return 0 }
//     static get PUBLISHER() { return 1 }
//     static get SUBSCRIBER() { return 2 }
// }

export class OshuQueueStatus {
    static get CREATED() { return 0 }
    static get ASSIGNED() { return 1 }
    static get IN_PROGRESS() { return 2 }
    static get DONE() { return 3 }
    static get FAILED() { return 4 }
    static get REJECTED() { return 5 }
}

export class OshuSubscriberStatus {
    static get UNKNOWN() { return 0 }
    static get FREE() { return 1 }
    static get BUSY() { return 2 }
    // static get REJECTED() { return 3 }
}

export class OshuQueueCommon {
    pair = false
    gun = false
    peer = false
    keys = false
    created = false
    authorized = false
    async _init(cb) {
        this.gun = Gun({ peers: [ this.peer ], WebSocket: WebSocket })

        this.gun.on('hi', () => {
            if (!this.pair) {
                this._create()
                    .then( () => {
                        this.created = true
                        this._auth()
                            .then( () => {
                                this.authorized = true
                                if (cb) cb()
                            })
                            .catch(err => {
                                if (cb) cb(err)
                            })
                    })
            } else {
                this._auth()
                    .then( () => {
                        this.authorized = true
                        if (cb) cb()
                    })
                    .catch(err => {
                        if (cb) cb(err)
                    })
            }
        })
    }

    async _create() {
        this.pair = await SEA.pair()
        this.keys = {
            main: await SEA.pair()  
        }
        return new Promise((resolve, reject) => {
            this.gun.user().create(this.pair, ack => {
                if(ack.err)
                reject(ack)
                resolve()
            })

        })
    }

    async _auth() {
        if (typeof this.pair == 'string') {
            this.pair = JSON.parse(this.pair)
        }
        return new Promise((resolve, reject) => {
            this.gun.user().auth(this.pair, ack => {
                if(ack.err)
                    reject(ack)
                else {
                    resolve()
                }
            })
        })
    }
}

export default {
    Gun,
    SEA,
    OshuQueueStatus,
    OshuSubscriberStatus,
    OshuQueueCommon,
    OshuQueueAuthEnvelope
}