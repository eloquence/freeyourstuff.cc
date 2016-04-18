'use strict';

// Bundle all routes into one module
const content = require('./content.js');
const user = require('./user.js');
const api = require('./api.js');
const pages = require('./pages.js');
const assets = require('./assets.js');

module.exports = {
  content,
  user,
  api,
  pages,
  assets
};
