'use strict';
// External dependencies
const app = require('koa')(); // extremely lightweight framework for web apps
const gzip = require('koa-gzip');
const fs = require('fs');
const ejs = require('ejs'); // simple templates with embedded JS
const mongoose = require('mongoose'); // MongoDB ODB
const session = require('koa-generic-session');
const MongoStore = require('koa-generic-session-mongo');
const bodyParser = require('koa-bodyparser');
const flash = require('koa-connect-flash');
const chokidar = require('chokidar'); // monitor file changes
const path = require('path');
const url = require('url');
// Internal dependencies
const loadTemplate = require('./templates');
const passport = require('./auth'); // exports koa-passport
const routes = require('./routes/index.js');
app.config = require('./load-config');

mongoose.connect(app.config.dbHost, app.config.dbName, app.config.dbPort);

app.keys = app.config.sessionKeys;

// We don't want to restart the server anytime we change a template, so we'll
// use the magic of chokidar to keep an eye on changes. The 'add' event fires
// upon startup.
const watcher = chokidar.watch(app.config.pathToTemplates);

app.templates = {};
watcher.on('add', (filename) => {
  console.log('Loading template: ' + filename);
  app.templates[path.basename(filename)] = loadTemplate(filename);
});

watcher.on('change', (filename) => {
  console.log('Reloading modified template: ' + filename);
  app.templates[path.basename(filename)] = loadTemplate(filename);
});

/* ----- Begin middleware section ----- */
app.use(session({
  cookie: {
    maxAge: 24 * 60 * 60 * 30000 // 30 d default cookie
  },
  store: new MongoStore({
    db: app.config.dbName,
    host: app.config.dbHost,
    port: app.config.dbPort
  })
}));
app.use(flash());
app.use(bodyParser({
  strict: false,
  onerror: function(err, ctx) {
    ctx.throw('{"error": "JSON data could not be parsed, invalid syntax."}', 400);
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// For subdomains, IP address access, etc., we redirect to the base URL
app.use(function*(next) {
  let baseURL = url.parse(app.config.baseURL);
  if (baseURL.host && baseURL.host != this.header.host) {
    this.redirect(app.config.baseURL + this.url.slice(1));
    return;
  }
  yield next;
});

app.use(routes.pages.static);
app.use(routes.pages.root);
app.use(routes.pages.plugins);
app.use(routes.pages.mirrors);
app.use(routes.content.view);
app.use(routes.content.browse);
app.use(routes.content.latest);
app.use(routes.user.user);
app.use(routes.user.signin);
app.use(routes.user.signin_POST);
app.use(routes.user.signout_POST);
app.use(routes.user.register);
app.use(routes.user.register_POST);
app.use(routes.user.signup); // just a redirect
app.use(routes.user.authFacebook);
app.use(routes.user.authFacebookCallback);
app.use(routes.user.authTwitter);
app.use(routes.user.authTwitterCallback);
app.use(routes.user.authGoogle);
app.use(routes.user.authGoogleCallback);
app.use(routes.api.nameCheck);
app.use(routes.api.loginStatus);
app.use(routes.api.siteSet_POST);
app.use(gzip());
/* ----- End middleware section ------ */

app.listen(app.config.port);
console.log(app.config.siteName + ' service loaded.');

module.exports = app; // For testability
