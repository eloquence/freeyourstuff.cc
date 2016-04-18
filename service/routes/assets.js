'use strict';

// Routes for serving static assets

// External dependencies
const router = require('koa-route');
const send = require('koa-send');

// Internal dependencies
let main = {
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
  favicon: router.get('/favicon.ico(\\?.*)*', function*(v, next) {
      this.status = 301;
      this.redirect('/static/favicon.ico');
      return yield next;
    }
  )
};

module.exports = main;
