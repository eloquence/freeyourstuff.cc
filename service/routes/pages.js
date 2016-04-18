'use strict';

// Routes for rendering largely non-dynamic templates

// External dependencies
const router = require('koa-route');

// Internal dependencies
const render = require('../routes/render.js');

var main = {

  root: router.get('/', function*(next) {
    render.call(this, 'index.ejs');
    return yield next;
  }),
  plugins: router.get('/plugins', function*(next) {
    render.call(this, 'plugins.ejs');
    return yield next;
  }),
  mirrors: router.get('/mirrors', function*(next) {
    render.call(this, 'mirrors.ejs');
    return yield next;
  })
};

module.exports = main;
