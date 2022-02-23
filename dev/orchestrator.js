import 'dotenv/config'
import { OshuQueueOrchestrator } from '../src/orchestrator.js'
import { OshuQueueBasicAuth } from '../src/queue_common.js';

// const express = require('express');
import express from 'express'
const app    = express();
const auth_publisher = new OshuQueueBasicAuth(process.env.AUTH_PUBLISHER)
const auth_subscriber = new OshuQueueBasicAuth(process.env.AUTH_SUBSCRIBER)
app.listen(null, async () => {
  console.log('[OshuOrchestrator started]');
  let orchestrator = new OshuQueueOrchestrator(process.env)
  orchestrator.setAuthPublisher(auth_publisher)
  orchestrator.setAuthSubscriber(auth_subscriber)
  orchestrator.initialize((msg) => {
    console.log('[initialized]', msg)
  })
});