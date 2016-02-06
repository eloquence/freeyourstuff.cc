'use strict';
// External dependencies
let mongoose = require('mongoose');
let bcrypt = require('bcrypt-nodejs');

// Internal dependencies
let config = require('../loadconfig');

// Schema definition
let userSchema = mongoose.Schema({

  local: {
    username: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 256,
      unique: true,
      sparse: true,
      validate: {
        validator: function(v) {
          return !(/[<>'"]/.test(v));
        },
        message: 'registerfail-char'
      }
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 256
    },
    password: String
  },
  facebook: {
    id: {
      type: String,
      unique: true,
      sparse: true
    },
    email: String,
    displayName: String
  },
  twitter: {
    id: {
      type: String,
      unique: true,
      sparse: true
    },
    displayName: String,
    username: String
  },
  google: {
    id: {
      type: String,
      unique: true,
      sparse: true
    },
    email: String,
    displayName: String
  }
});

// generating a hash
userSchema.methods.generateHash = function(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
  return bcrypt.compareSync(password, this.local.password);
};

userSchema.statics.findByName = function(name) {
  return this.findOne({'local.username': name.toUpperCase()});
};

userSchema.methods.getDisplayName = function() {
  return this.local.displayName || this.twitter.displayName ||
    this.facebook.displayName || this.google.displayName || null;
};

userSchema.methods.getLink = function() {
  let url = config.baseURL + 'user/' + this._id + '?method=' + this.getMethod();
  return `<a href="${url}">${this.getDisplayName()}</a>`;
};

userSchema.methods.getMethod = function() {
  if (this.local)
    return 'local';
  else if (this.twitter)
    return 'twitter';
  else if (this.facebook)
    return 'facebook';
  else if (this.google)
    return 'google';
  else
    return null;
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
