'use strict';

// External dependencies
let router = require('koa-route');
let send = require('koa-send');

// Internal dependencies
let Collection = require('../models/collection.js');
let User = require('../models/user.js');

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
    let recentCollections = [];
    for (var c in Collection) {
      let rv = yield Collection[c].find({}).limit(25).sort({uploadDate: -1}).populate('uploader').lean();
      rv.forEach(coll => {
        coll.collectionSchema = Collection[c].collectionSchema;
      });
      recentCollections.push(rv);
    }
    render.call(this, 'browse.ejs', { recentCollections } );
    return yield next;
  })
};

function render(template, extraVars) {
  let vars = getStandardVars.call(this);
  if (extraVars)
    Object.assign(vars, extraVars);
  this.body = this.app.templates[template](vars);
}

function getStandardVars() {
  let signedIn = this.isAuthenticated();
  let userName;
  if (signedIn && this.session.method &&
    this.session.passport.user[this.session.method])
    userName = this.session.passport.user[this.session.method].displayName;
  let notifications = this.flash('once-notifications');
  let stv = {
    conf: this.app.config.expose(),
    signedIn,
    method: this.session.method,
    notifications,
    userName
  };
  return stv;
}

module.exports = main;
