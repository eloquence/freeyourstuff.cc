'use strict';

// External dependencies
const mongoose = require('mongoose');

// Internal dependencies
const SiteSet = require('../models/siteset.js');
const User = require('../models/user.js');

const Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

let UploadSchema = new Schema({
  schemaKey: String,
  uploadDate: Date,
  uploader: {
    type: ObjectId,
    ref: 'User'
  },
  siteSet: ObjectId,
  number: {},
  isTestUpload: Boolean, // filtered from lists
  isTrusted: Boolean, // vetted, safe to display as raw HTML
  trustedDate: Date,
  trustedBy: {
    type: ObjectId,
    ref: 'User'
  }
});

let Upload = mongoose.model('Upload', UploadSchema);

module.exports = Upload;
