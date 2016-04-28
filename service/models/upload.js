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
  siteSet: ObjectId
});

let Upload = mongoose.model('Upload', UploadSchema);

module.exports = Upload;
