require('dotenv/config')
const OshuQueueOrchestrator = require('../src/orchestrator')
const express = require('express');
const app    = express();

app.listen(null, async () => {
  console.log('[OshuOrchestrator started]');
  let orchestrator = new OshuQueueOrchestrator(process.env)
  orchestrator.initialize((msg) => {
    console.log('[initialized]', msg)
  })
});