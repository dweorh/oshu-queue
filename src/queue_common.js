let Gun
let SEA
let WebSocket
if (process.env.USE_MODULES === 'true') {
    Gun = require('gun')
    SEA = require('gun/sea')
} else {
    Gun = require('./libs/gun/gun.js')
    SEA = require('./libs/gun/sea.js')
}

if (typeof window == 'undefined') {
    WebSocket = require('ws')
}
module.exports = {
    Gun: Gun,
    SEA: SEA,
    OshuQueueStatus: class {
        static get CREATED() { return 0 }
        static get ASSIGNED() { return 1 }
        static get IN_PROGRESS() { return 2 }
        static get DONE() { return 3 }
        static get FAILED() { return 4 }
    },
    OshuQueueCommon: class {
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
}