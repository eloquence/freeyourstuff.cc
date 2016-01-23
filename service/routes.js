// TODO:
// - Refactor template calls (we should always expose conf, for example)
// - Should have a nice GET route for signing out (needs template)
// - Move more of the business logic out of here
'use strict';

// External dependencies
let router = require('koa-route');
let send = require('koa-send');
let passport = require('koa-passport');

// Internal dependencies
let User = require('./models/user');
let collectionModels = require('./models/collections');

// Naming convention for routes: Anything that is not a GET method
// is suffixed with method name, e.g. _POST.
module.exports = {
  static: router.get('/static/(.*)', function*(asset, next) {
    if (!asset) return yield next;
    // ms, cache static resources for up to 5 minutes in production
    let maxage = process.env.NODE_ENV === 'production' ? 300000 : 0;
    yield send(this, asset, {
      maxage,
      root: __dirname + '/static'
    });
    return yield next;
  }),
  root: router.get('/', function*(next) {
    let signedIn = this.isAuthenticated();
    let userName;
    if (signedIn && this.session.method &&
      this.session.passport.user[this.session.method])
      userName = this.session.passport.user[this.session.method].displayName;
    let notifications = this.flash('once-notifications');
    this.body = this.app.templates['index.ejs']({
      conf: this.app.config.expose(),
      signedIn,
      method: this.session.method,
      notifications,
      userName
    });
    return yield next;
  }),
  signin: router.get('/signin', function*(next) {
    let signinMessages = this.flash('signinMessages');
    let conf = this.app.config.expose();
    this.body = this.app.templates['signin.ejs']({
      conf,
      signinMessages
    });
    return yield next;
  }),

  signin_POST: router.post('/signin', function*(next) {
    let ctx = this;
    let strategy = 'local';
    // Passport returns a message in the format { message: 'Missing credentials' }
    // when no username or password are provided. We change this to a message key,
    // which is flashed as a simple string rather than an object, consistent with
    // other messages.
    let badRequestMessage = 'authfail-missing';
    yield passport.authenticate(strategy, {
        badRequestMessage
      },
      function*(err, user, msg) {
        if (err) throw err;
        if (msg && typeof msg === 'object' && msg.message === badRequestMessage)
          msg = badRequestMessage;
        if (user === false) {
          ctx.flash('signinMessages', msg);
          ctx.redirect('/signin');
        } else {
          yield ctx.login(user);
          ctx.redirect('/');
          ctx.flash('once-notifications', 'welcome-back');
          let cookieDate = new Date();
          cookieDate.setDate(cookieDate.getDate() + 3650);
          ctx.session.method = strategy;
          ctx.cookies.set('fys-loginmethod', strategy, {
            signed: true,
            expires: cookieDate,
            httpOnly: false
          });
        }
      }).call(this, next);
    return yield next;
  }),

  signout_POST: router.post('/signout', function*(next) {
    this.logout();
    this.redirect('/');
    return yield next;
  }),

  register: router.get('/register', function*(next) {
    let registerMessages = this.flash('registerMessages');
    let conf = this.app.config.expose();
    this.body = this.app.templates['register.ejs']({
      conf,
      registerMessages
    });
    return yield next;
  }),

  register_POST: router.post('/register', function*(next) {
    if (!this.request.body.username || !this.request.body.password) {
      this.flash('registerMessages', 'registerfail-missing');
      this.redirect('/register');
      return yield next;
    }
    let newUser = new User();

    // Model will take care of trimming, sizing input data
    newUser.local.displayName = this.request.body.username;
    newUser.local.username = this.request.body.username.toUpperCase();
    newUser.local.password = newUser.generateHash(this.request.body.password);
    this.redirect('/');

    let saved = false;
    try {
      yield newUser.save();
      saved = true;
    } catch (e) {
      if (e.errors && e.errors['local.username'] &&
        e.errors['local.username'].kind === 'maxlength')
        this.flash('registerMessages', 'registerfail-length');
      else if (e.code === 11000)
        this.flash('registerMessages', 'registerfail-unique');
      else
        this.flash('registerMessages', 'registerfail-unknown');

      this.redirect('/register');
    }

    if (saved) {
      this.flash('once-notifications', 'welcome-newuser');
      this.session.method = 'local';
      yield this.login(newUser);
    }

    return yield next;
  }),

  signup: router.get('/signup', function*(next) {
    this.redirect('/register');
    return yield next;
  }),

  authFacebook: router.get('/auth/facebook', function*(next) {
    yield passport.authenticate('facebook', {
      scope: 'email'
    });
    return yield next;
  }),

  authFacebookCallback: router.get('/auth/facebook/callback', function*(next) {
    let ctx = this;
    let strategy = 'facebook';
    yield passport.authenticate(strategy, function*(err, user, msg) {
      if (msg && typeof msg === 'object' && msg.message === 'Permissions error')
        msg = 'facebook-denied';
      if (user) {
        yield ctx.login(user);
        ctx.redirect('/#');

        if (msg === 'facebook-signedin')
          ctx.flash('once-notifications', 'welcome-back');
        else
          ctx.flash('once-notifications', 'welcome-newuser');

        let cookieDate = new Date();
        cookieDate.setDate(cookieDate.getDate() + 3650);
        ctx.session.method = strategy;
        ctx.cookies.set('fys-loginmethod', strategy, {
          signed: true,
          expires: cookieDate,
          httpOnly: false
        });
      } else {
        ctx.flash('signinMessages', msg);
        ctx.redirect('/signin');
      }
    });
    return yield next;
  }),

  authTwitter: router.get('/auth/twitter', function*(next) {
    yield passport.authenticate('twitter');
    return yield next;
  }),

  authTwitterCallback: router.get('/auth/twitter/callback', function*(next) {
    let strategy = 'twitter';
    let ctx = this;
    yield passport.authenticate(strategy, function*(err, user, msg) {
      if (msg && typeof msg === 'object' && msg.message === 'Permissions error')
        msg = 'twitter-denied';
      if (user) {
        yield ctx.login(user);
        ctx.redirect('/');
        if (msg === 'twitter-signedin')
          ctx.flash('once-notifications', 'welcome-back');
        else
          ctx.flash('once-notifications', 'welcome-newuser');

        let cookieDate = new Date();
        cookieDate.setDate(cookieDate.getDate() + 3650);
        ctx.session.method = strategy;
        ctx.cookies.set('fys-loginmethod', strategy, {
          signed: true,
          expires: cookieDate,
          httpOnly: false
        });
      } else {
        ctx.flash('signinMessages', msg);
        ctx.redirect('/signin');
      }
    });
    return yield next;
  }),

  authGoogle: router.get('/auth/google', function*(next) {
    yield passport.authenticate('google', {
      scope: ['profile', 'email'],
      approval_prompt: 'auto'
    });
    return yield next;
  }),

  authGoogleCallback: router.get('/auth/google/callback', function*(next) {
    let ctx = this;
    let strategy = 'google';
    yield passport.authenticate(strategy, function*(err, user, msg) {
      if (msg && typeof msg === 'object' && !user)
        msg = 'google-denied';
      if (user) {
        yield ctx.login(user);
        ctx.redirect('/');

        if (msg === 'google-signedin')
          ctx.flash('once-notifications', 'welcome-back');
        else
          ctx.flash('once-notifications', 'welcome-newuser');

        let cookieDate = new Date();
        cookieDate.setDate(cookieDate.getDate() + 3650);
        ctx.session.method = strategy;
        ctx.cookies.set('fys-loginmethod', strategy, {
          signed: true,
          expires: cookieDate,
          httpOnly: false
        });
      } else {
        ctx.flash('signinMessages', msg);
        ctx.redirect('/signin');
      }
    });
    return yield next;
  }),

  apiNameCheck: router.get('/api/name', function* get(next) {
    if (!this.request.query.name) {
      this.body = {
        apiError: 'Must specify a username with ?name= parameter'
      };
      return yield next;
    }
    let user = yield User.findOne({
      'local.username': this.request.query.name.toUpperCase()
    });
    if (user)
      this.body = {
        userExists: user.local.displayName
      };
    else
      this.body = {
        userExists: false
      };
    return yield next;
  }),

  apiCollection_POST: router.post('/api/collection', function* post(next) {
    if (!apiSignedIn(this))
      return yield next;

    let c = this.request.body;

    if (!apiValidateCollection(this, c))
      return yield next;

    for (var i=0;i<collectionModels.length; i++) {
      if (c.schemaName === collectionModels[i].modelName) {
        if (c.reviews) {
          if (!apiValidateDataset(this, c.reviews))
            return yield next;
          let collection = new collectionModels[i]();
          collection.reviews = c.reviews;
          try {
            yield collection.save();
          } catch (e) {
            apiDBError(this, e);
            return yield next;
          }
          apiReportSuccess(this);
          return yield next;
        }
      }
    }

    this.body = {
      error: 'Unknown schema: ' + c.schemaName
    };
    return yield next;

  })

};

// TODO: move these functions out of routes

function apiSignedIn(ctx) {
  if (!ctx.isAuthenticated()) {
    ctx.body = {
      error: 'You must be signed in to upload documents.'
    };
    ctx.status = 401;
    return false;
  }
  return true;
}

function apiDBError(ctx, error) {
  if (error.name === 'ValidationError') {
    ctx.body = {
      error: 'Data did not match the expected schema.'
    };
    ctx.status = 400;
  }
  else {
    ctx.body = {
      error: 'Unknown problem saving/parsing the data. Could be an issue on our end. Sorry! :('
    };
    ctx.status = 500;
  }
}

function apiValidateCollection(ctx, collection) {
  if (!collection.schemaVersion || !collection.schemaName) {
    ctx.body = {
      error: 'Not a valid schema, must have a schemaVersion and schemaName.'
    };
    ctx.status = 400;
    return false;
  }
  return true;
}

function apiValidateDataset(ctx, dataset) {
  if (!dataset.data || !dataset.head || typeof dataset.head !== 'object' ||
    !Array.isArray(dataset.data)) {
    ctx.body = {
      error: 'Not a valid dataset, must have a head object and data array.'
    };
    ctx.status = 400;
    return false;
  } else
    return true;
}

function apiReportSuccess(ctx) {
  ctx.body = {
    message: 'Thank you for your contribution. You have made a simple API very happy.'
  };
  ctx.status = 200;
}
