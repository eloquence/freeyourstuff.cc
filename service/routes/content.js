'use strict';

// Routes for rendering/managing datasets

// External dependencies
const router = require('koa-route');
const send = require('koa-send');
const fs = require('fs');

// Internal dependencies
const SiteSet = require('../models/siteset.js');
const User = require('../models/user.js');
const Upload = require('../models/upload.js');
const render = require('../routes/render.js');


const uploadFilter = '_id twitter.displayName local.displayName facebook.displayName google.displayName';

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
        }).populate('uploader', uploadFilter).lean();
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
      }).populate('uploader', uploadFilter).lean();
      if (rv !== null && rv.length) {
        rv[0].siteSetSchema = SiteSet[c].siteSetSchema;
        siteSets.push(rv[0]);
      }
    }
    render.call(this, 'browse.ejs', {
      siteSets
    });
    return yield next;
  }),
  browse_dev: router.get('/browse_dev', function*(next) {
    let recentUploads = yield Upload
      .find({})
      .sort({
        uploadDate: -1
      })
      .populate('uploader', uploadFilter);
    render.call(this, 'browse_dev.ejs', {
      recentUploads
    });
    return yield next;
  }),
  // Fetch latest dump, if available
  latest: router.get('/latest', function*(next) {
    let date = new Date();
    let getFilename = () => `freeyourstuff-${date.toISOString().match(/(.*)T/)[1]}.tgz`;
    let getFullPath = () => `${__dirname}/../static/dumps/${getFilename(date)}`;
    let fullPath = getFullPath();
    try {
      fs.statSync(fullPath);
    } catch(e) {
      // Yesterday
      date.setDate(date.getDate() - 1);
      fullPath = getFullPath();
      try {
        fs.statSync(fullPath);
      } catch(e) {
        this.body = 'No dump available for today or yesterday. Sorry!';
        return yield next;
      }
    }
    this.redirect(`/static/dumps/${getFilename(date)}`);
    return yield next;
  })
};

module.exports = main;
