'use strict';

// External dependencies
let router = require('koa-route');
let send = require('koa-send');

// Internal dependencies
let SiteSet = require('../models/siteset.js');
let User = require('../models/user.js');
let render = require('../routes/render.js');

// Naming convention for routes: Anything that is not a GET method
// is suffixed with method name, e.g. _POST.
var main = {
  static: router.get('/static/(.*)', function*(asset, next) {
    if (!asset) return yield next;
    // ms, cache static resources for up to 5 minutes in production
    let maxage = process.env.NODE_ENV === 'production' ? 300000 : 0;
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
  browse: router.get('/browse', function*(next) {
    let recentSiteSets = [];
    for (var c in SiteSet) {
      let rv = yield SiteSet[c].find({}).limit(1).sort({uploadDate: -1}).populate('uploader').lean();
      rv.forEach(siteSet => {
        siteSet.siteSetSchema = SiteSet[c].siteSetSchema;
      });
      recentSiteSets.push(rv);
    }
    render.call(this, 'browse.ejs', { recentSiteSets } );
    return yield next;
  })
};

module.exports = main;
