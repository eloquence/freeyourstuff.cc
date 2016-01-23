'use strict';
// External dependencies
let mongoose = require('mongoose');
let collectionModels = require('./collections');

// Schema definition
let yelp = mongoose.Schema({
  reviews: {
    head: {
      reviewerName: String,
      reviewerID: String
    },
    data: [{
      subject: String,
      subjectYelpURL: String,
      date: Date,
      text: String,
      starRating: Number,
      checkins: Number
    }]
  }
}, {
  collection: 'yelp'
});

collectionModels.push(mongoose.model('Yelp', yelp));
// create the model for users and expose it to our app
module.exports = collectionModels;
