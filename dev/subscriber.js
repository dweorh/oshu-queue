import 'dotenv/config'
import { OshuSubscriber } from '../src/subscriber.js';
import { OshuQueueAuthEnvelope } from '../src/queue_common.js';
import express from 'express'
// const SEA = require('../src/libs/gun/sea')
const app    = express();
const resolver = payload => {
  let response = {}
  if (payload.data.math) {
    response = {
      math: eval(payload.data.math)
    }
  }
  console.log('[resolver]', payload, response)
  return response
}

const auth = new OshuQueueAuthEnvelope(process.env.AUTH_KEY)
app.listen(null, async () => {
  console.log('[OshuSubscriber started]');
  let subscriber = new OshuSubscriber(process.env, resolver, auth)
  subscriber.initialize(async (ack) => {
    console.log('[initialized]', ack)
  })
});