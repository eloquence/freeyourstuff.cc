'use strict';
// External dependencies
let mongoose = require('mongoose');
let bcrypt = require('bcrypt-nodejs');

// Schema definition
let userSchema = mongoose.Schema({

  local: {
    username: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 256,
      unique: true,
      sparse: true
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

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
