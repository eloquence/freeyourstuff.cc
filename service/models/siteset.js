'use strict';
// This module imports the schemas defined in the extension, and converts them
// into models used by Mongoose. Any new plugins added to the extension are
// therefore available in the web service as soon as it is restarted.

// External dependencies
let mongoose = require('mongoose');
let ObjectId = mongoose.Schema.Types.ObjectId;

// Internal dependencies
let schemas = require('../load-schemas.js');

let models = {};

for (let schemaKey in schemas) {
  console.log(`Importing schema "${schemaKey}"...`);
  let modelObj = {};
  modelObj.uploader = {
    type: ObjectId,
    ref: 'User'
  };
  modelObj.uploadDate = Date;
  modelObj.schemaVersion = Number;

  for (let setName in schemas[schemaKey]) {
    if (setName == 'schema')
      continue;

    modelObj[setName] = {};
    modelObj[setName].head = {};
    modelObj[setName].data = [];

    for (let h in schemas[schemaKey][setName].head) {
      modelObj[setName].head[h] = getType(schemas[schemaKey][setName].head[h].type);
    }

    let dataObj = {};
    for (let d in schemas[schemaKey][setName].data) {
      dataObj[d] = getType(schemas[schemaKey][setName].data[d].type);
    }
    modelObj[setName].data.push(dataObj);
  }
  let mSchema = mongoose.Schema(
    modelObj, {
      collection: schemas[schemaKey].schema.key
    }
  );
  models[schemaKey] = mongoose.model(schemaKey, mSchema);
  // We stash the original (non-Mongoose) schema in the model; it contains useful
  // metadata such as labels that we need for rendering the data.
  models[schemaKey].siteSetSchema = schemas[schemaKey];
}


// This will only return the collection IDs and upload dates
function findAllByUploaderID(uid) {
  let resultObj = {};
  for (let c of Object.keys(this)) {
    resultObj[c] = this[c].find({
      uploader: uid
    }, { uploadDate: 1 } ).lean();
  }
  return resultObj;
}

// We want the set of SiteSets to be enumerable without the function
Object.defineProperty(models, 'findAllByUploaderID', {
  value: findAllByUploaderID,
  enumerable: false
});

module.exports = models;

// Translate types supported in datasets to appropriate MongoDB/Mongoose types
function getType(schemaType) {
  switch (schemaType) {
    case 'text':
    case 'html':
    case 'weburl':
      return String;
    case 'date':
      return Date;
    case 'number':
      return Number;
    case 'boolean':
      return Boolean;
    default:
      throw new Error('Unknown type:' + schemaType);
  }
}
