require('dotenv/config')
const OshuSubscriber = require('../src/subscriber')

const express = require('express');
// const SEA = require('../src/libs/gun/sea')
const app    = express();
const resolver = payload => {
  if (payload.data.math) {
    payload.response = {
      math: eval(payload.data.math)
    }
  }
  console.log('[resolver]', payload)
  return payload
}
app.listen(null, async () => {
  console.log('[OshuSubscriber started]');
  let subscriber = new OshuSubscriber(process.env, resolver)
  subscriber.initialize(async (ack) => {
    console.log('[initialized]', ack)
  })
});