'use strict';
// External dependencies
let app = require('koa')(); // extremely lightweight framework for web apps
let gzip = require('koa-gzip');
let fs = require('fs');
let ejs = require('ejs'); // simple templates with embedded JS
let mongoose = require('mongoose'); // MongoDB ODB
let session = require('koa-generic-session');
let bodyParser = require('koa-bodyparser');
let flash = require('koa-connect-flash');
let chokidar = require('chokidar'); // monitor file changes
let path = require('path');

// Internal dependencies
let loadTemplate = require('./templates');
let passport = require('./auth'); // exports koa-passport
let routes = require('./routes/index.js');
app.config = require('./loadconfig');

mongoose.connect(app.config.dbHost, app.config.dbName, app.config.dbPort);

app.keys = app.config.sessionKeys;

// We don't want to restart the server anytime we change a template, so we'll
// use the magic of chokidar to keep an eye on changes. The 'add' event fires
// upon startup.
let watcher = chokidar.watch(app.config.pathToTemplates);

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
    maxAge: 24 * 60 * 60 * 30000
  }
})); // 30 d default cookie
app.use(flash());
app.use(bodyParser({
  strict: false,
  onerror: function(err, ctx) {
    ctx.throw('{"error": "JSON data could not be parsed, invalid syntax."}', 400);
  }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(routes.content.static);
app.use(routes.content.root);
app.use(routes.content.browse);
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
app.use(routes.api.collection_POST);
app.use(gzip());
/* ----- End middleware section ------ */

app.listen(app.config.port);
console.log(app.config.siteName + ' service loaded.');

module.exports = app; // For testability
