'use strict';

// Routes for rendering/managing datasets

// External dependencies
const router = require('koa-route');
const send = require('koa-send');

// Internal dependencies
const SiteSet = require('../models/siteset.js');
const User = require('../models/user.js');
const render = require('../routes/render.js');

// Naming convention for routes: Anything that is not a GET method
// is suffixed with method name, e.g. _POST.
var main = {
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
