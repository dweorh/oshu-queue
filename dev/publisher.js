require('dotenv/config')
const OshuPublisher = require('../src/publisher')

const express = require('express');
// const SEA = require('../src/libs/gun/sea')
const app    = express();

app.listen(null, async () => {
  console.log('[OshuPublisher started]');
  let publisher = new OshuPublisher(process.env)
  publisher.initialize(async (ack) => {
    console.log('[initialized]', ack)

    const msg = publisher.createMessage({ text: 'do something cool', math: 'Math.sqrt((2+2)*2)'})
    publisher.sendMessage(msg, (key, data) => {
        console.log('[listener]', key, data.message)
    })
  })
});