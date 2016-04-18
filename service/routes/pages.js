'use strict';

// Routes for rendering static pages and largely non-dynamic content

// External dependencies
const router = require('koa-route');
const send = require('koa-send');

// Internal dependencies
const render = require('../routes/render.js');

var main = {

  static: router.get('/static/(.*)', function*(asset, next) {
    if (!asset) return yield next;
    // ms, cache static resources for up to one week in production
    let maxage = process.env.NODE_ENV === 'production' ? 1000 * 60 * 60 * 24 * 7 : 0;
    yield send(this, asset, {
      maxage,
      root: __dirname + '/../static'
    });
    return yield next;
  }),
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
