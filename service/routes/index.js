'use strict';

// Bundle all routes into one module
let content = require('./content.js');
let user = require('./user.js');
let api = require('./api.js');
let pages = require('./pages.js');

module.exports = {
  content,
  user,
  api,
  pages
};
