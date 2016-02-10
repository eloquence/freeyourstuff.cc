'use strict';
// This module imports the schemas defined in the extension, and converts them
// into models used by Mongoose. Any new plugins added to the extension are
// therefore available in the web service as soon as it is restarted.

// External dependencies
let mongoose = require('mongoose');
let fs = require('fs');
let path = require('path');
let jsonfile = require('jsonfile');
let ObjectId = mongoose.Schema.Types.ObjectId;

// Setup
let pluginDir = '../extension/src/plugins';
let dirs = getDirectories(pluginDir);
let schemas = [];
let models = {};

for (let dir of dirs) {
  try {
    schemas.push(jsonfile.readFileSync(`${pluginDir}/${dir}/schema.json`));
  } catch (e) {
    console.log(`Problem reading schema.json for plugin "${dir}". Skipping.`);
  }
}

for (let schemaObj of schemas) {
  console.log(`Importing schema "${schemaObj.schema.key}"...`);
  let modelObj = {};
  modelObj.uploader = {
    type: ObjectId,
    ref: 'User'
  };
  modelObj.uploadDate = Date;

  for (let setName in schemaObj) {
    if (setName == 'schema')
      continue;

    modelObj[setName] = {};
    modelObj[setName].head = {};
    modelObj[setName].data = [];

    for (let h in schemaObj[setName].head) {
      modelObj[setName].head[h] = getType(schemaObj[setName].head[h].type);
    }

    let dataObj = {};
    for (let d in schemaObj[setName].data) {
      dataObj[d] = getType(schemaObj[setName].data[d].type);
    }
    modelObj[setName].data.push(dataObj);
  }
  let mSchema = mongoose.Schema(
    modelObj, {
      collection: schemaObj.schema.key
    }
  );
  models[schemaObj.schema.key] = mongoose.model(schemaObj.schema.key, mSchema);
  // We stash the original (non-Mongoose) schema in the model; it contains useful
  // metadata such as labels that we need for rendering the data.
  models[schemaObj.schema.key].siteSetSchema = schemaObj;
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

function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}
