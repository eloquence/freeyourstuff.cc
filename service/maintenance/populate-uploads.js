// Populate upload information from collections.
// Needed for April 2016 schema change
//
// Run simply with:
// $ node populate-uploads.js

'use strict';
// External dependencies
const mongoose = require('mongoose');

// Internal dependencies
const config = require('../load-config');
const schemas = require('../load-schemas');
const SiteSet = require('../models/siteset.js');
const Upload = require('../models/upload.js');

mongoose.connect(config.dbHost, config.dbName, config.dbPort);

// Mongoose returns promises but we make a custom promise since we pass the
// schema key along
function getQuery(schemaKey) {
  return new Promise((resolve, reject) => {
    SiteSet[schemaKey]
      .find({})
      .select({
        _id: 1,
        uploader: 1,
        uploadDate: 1
      })
      .exec((err, data) => {
        if (err)
          reject(err);
        else
          resolve({
            data,
            schemaKey
          });
      });
  });
}

let queries = [];
for (let schema in schemas)
  queries.push(getQuery(schema));

let saves = [];
Promise.all(queries).then(results => {
  for (let result of results) {
    for (let uploadObj of result.data) {
      let upload = new Upload({
        uploadDate: uploadObj.uploadDate,
        uploader: uploadObj.uploader,
        schemaKey: result.schemaKey,
        siteSet: uploadObj._id,
      });
      saves.push(upload.save());
    }
  }
  Promise.all(saves).then(results => {
    console.log(`Upload log successfully populated with ${results.length} entries.`);
  }).catch(error => {
    console.error('Something went wrong saving the upload information:');
    console.error(error);
  }).then(()=>{ process.exit(); });
}).catch(error => {
  console.error('Something went wrong looking for the upload metadata:');
  console.error(error);
});
