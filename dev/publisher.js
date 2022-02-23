import 'dotenv/config'
import { OshuPublisher } from '../src/publisher.js';
import { OshuQueueAuthEnvelope } from '../src/queue_common.js';
import express from 'express';
// const SEA = require('../src/libs/gun/sea')
const app = express();
const auth = new OshuQueueAuthEnvelope(process.env.AUTH_KEY)
app.listen(null, async () => {
  console.log('[OshuPublisher started]');
  let publisher = new OshuPublisher(process.env, auth)
  publisher.initialize(async (ack) => {
    console.log('[initialized]', ack)

    const msg = publisher.createMessage({ text: 'do something cool', math: 'Math.sqrt((2+2)*2)+2'})
    publisher.sendMessage(msg, (key, data) => {
        console.log('[listener]', key, data.message)
    })
  })
});