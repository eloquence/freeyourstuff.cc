'use strict';
let passport = require('koa-passport');
let LocalStrategy = require('passport-local').Strategy;
let FacebookStrategy = require('passport-facebook').Strategy;
let TwitterStrategy = require('passport-twitter').Strategy;
let GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
let url = require('url');

// Internal dependencies
let config = require('./load-config');
let User = require('./models/user');

// Save to the session
passport.serializeUser(function(user, done) {
  done(null, user);
});

// Load from the session
passport.deserializeUser(function(user, done) {
  done(null, user);
});

let localOptions = {
  usernameField: 'username',
  passwordField: 'password',
};

passport.use(new LocalStrategy(localOptions, function(username, password, done) {
  User.findOne({
    'local.username': username.toUpperCase(),
  }, function(err, user) {
    if (err)
      return done(err);
    if (!user)
      return done(null, false, 'authfail-user');
    if (!user.validPassword(password))
      return done(null, false, 'authfail-pw');

    return done(null, user);
  });
}));

let facebookOptions = {
  clientID: config.facebookClientID,
  clientSecret: config.facebookClientSecret,
  callbackURL: url.resolve(config.baseURL, config.facebookCallbackPath),
  enableProof: true,
  profileFields: ['id', 'email', 'displayName'],
};

passport.use(new FacebookStrategy(facebookOptions,
  function(accessToken, refreshToken, profile, done) {
    User.findOne({
      'facebook.id': profile.id,
    }, function(err, user) {
      if (err)
        return done(err);
      if (!user) {
        user = new User();
        user.facebook.id = profile.id;
        user.facebook.email = profile._json.email;
        user.facebook.displayName = profile.displayName;
        user.save();
        return done(null, user, 'facebook-created');
      } else
        return done(null, user, 'facebook-signedin');
    });
  }
));

let twitterOptions = {
  consumerKey: config.twitterConsumerKey,
  consumerSecret: config.twitterConsumerSecret,
  callbackURL: url.resolve(config.baseURL, config.twitterCallbackPath)
};

passport.use(new TwitterStrategy(twitterOptions,
  function(token, tokenSecret, profile, done) {
    User.findOne({
      'twitter.id': profile.id,
    }, function(err, user) {
      if (err)
        return done(err);
      if (!user) {
        user = new User();
        user.twitter.id = profile.id;
        user.twitter.displayName = profile.displayName;
        user.twitter.username = profile.username;
        user.save(err => {
          if (err)
            console.warn(err);
        });
        return done(null, user, 'twitter-created');
      } else
        return done(null, user, 'twitter-signedin');
    });
  }
));

let googleOptions = {
  clientID: config.googleClientID,
  clientSecret: config.googleClientSecret,
  callbackURL: url.resolve(config.baseURL, config.googleCallbackPath)
};

passport.use(new GoogleStrategy(googleOptions,
  function(accessToken, refreshToken, profile, done) {
    User.findOne({
      'google.id': profile.id,
    }, function(err, user) {
      if (err)
        return done(err);
      if (!user) {
        user = new User();
        user.google.id = profile.id;
        if (profile.emails.length)
          user.google.email = profile.emails[0].value;
        user.google.displayName = profile.displayName;
        user.save();
        return done(null, user, 'google-created');
      } else
        return done(null, user, 'google-signedin');
    });
  }));

module.exports = passport;
