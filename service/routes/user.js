'use strict';

// External dependencies
let passport = require('koa-passport');
let router = require('koa-route');

// Internal dependencies
let User = require('../models/user');
let Collection = require('../models/collection');
let render = require('../routes/render');

module.exports = {
  user: router.get('/user/(.*)', function*(uid, next) {
    if (!uid) {
      return yield next;
    } else {
      let u;
      if (!this.query.method) {
        u = yield User.findByName(uid);
      } else {
        try {
          u = yield User.findOne({
            _id: uid
          });
        } catch (e) { // In case of invalid query
          u = null;
        }
      }
      let resultObj, count = 0;
      if (u && u._id) {
        resultObj = yield Collection.findAllByUploaderID(u._id);
        for (let c in resultObj)
          count += resultObj[c].length;
      }
      render.call(this, 'user.ejs', {
        collections: resultObj,
        collectionCount: count,
        collectionUser: u
      });
    }
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
//      console.log(e);
      if (e.errors && e.errors['local.username'] &&
        e.errors['local.username'].kind === 'maxlength')
        this.flash('registerMessages', 'registerfail-length');
      else if (e.code === 11000)
        this.flash('registerMessages', 'registerfail-unique');
      else if (e.errors && e.errors['local.username'] &&
        e.errors['local.username'].message === 'registerfail-char')
        this.flash('registerMessages', 'registerfail-char');
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
};
