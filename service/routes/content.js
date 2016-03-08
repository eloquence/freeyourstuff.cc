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
  view: router.get('/view/(.*)/(.*)', function*(schemaKey, id, next) {
    if (!schemaKey || !id)
      return yield next;

    let siteSets = [];
    if (SiteSet[schemaKey]) {
      try {
        let siteSet = yield SiteSet[schemaKey].findOne({
          _id: id
        }).populate('uploader').lean();
        siteSet.siteSetSchema = SiteSet[schemaKey].siteSetSchema;
        siteSets.push(siteSet);
      } catch(e) {
      }
    }
    render.call(this, 'view.ejs', {
      siteSets
    });
    return yield next;
  }),
  browse: router.get('/browse', function*(next) {
    let siteSets = [];
    for (var c in SiteSet) {
      let rv = yield SiteSet[c].find({}).limit(1).sort({
        uploadDate: -1
      }).populate('uploader').lean();
      if (rv !== null && rv.length) {
        rv[0].siteSetSchema = SiteSet[c].siteSetSchema;
        siteSets.push(rv[0]);
      }
    }
    render.call(this, 'browse.ejs', {
      siteSets
    });
    return yield next;
  })
};

module.exports = main;
