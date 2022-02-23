'use strict';

// const express = require('express');
import express from 'express'
const app    = express();

console.log("If module not found, install express globally `npm i express -g`!");
const port    = process.env.OPENSHIFT_NODEJS_PORT || process.env.VCAP_APP_PORT || process.env.PORT || process.argv[2] ||  8765;
// const Gun     = require('../libs/gun');
import Gun from '../libs/gun/index.js'

import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname =  path.resolve(path.dirname(__filename), '../');

app.use(Gun.serve);
app.use(express.static(__dirname));

const server = app.listen(port, () => {
    console.log('[express started] port: ', port);
});

const gun = Gun({  file: 'data', web: server });

// global.Gun = Gun; /// make global to `node --inspect` - debug only
// global.gun = gun; /// make global to `node --inspect` - debug only

console.log('Server started on port ' + port + ' with /gun');