'use strict';
// This module imports the schemas defined in the extension, and converts them
// into models used by Mongoose. Any new plugins added to the extension are
// therefore available in the web service as soon as it is restarted.

// External dependencies
let mongoose = require('mongoose');
let fs = require('fs');
let path = require('path');
let jsonfile = require('jsonfile');

// Setup
let pluginDir = '../extension/src/plugins';
let dirs = getDirectories(pluginDir);
let schemas = {};
let models = {};

// Note that we use the directory name as the collection name (because we are
// enforcing a naming convention consistent with MongoDB collection practices
// on it), so we temporarily carry it forward as a key.
//
// The actual models are keyed using the schemaName for lookup.
for (let dir of dirs) {
  try {
    schemas[dir] = jsonfile.readFileSync(`${pluginDir}/${dir}/schema.json`);
  } catch(e) {
    console.log(`Problem reading schema.json for plugin "${dir}". Skipping.`);
  }
}

for (let schema in schemas) {
  console.log(`Importing schema "${schemas[schema].schema.schemaName}"...`);
  let modelObj = {};

  let s = schemas[schema]; // shortcut to current schema

  for (let setName in s) {
    if (setName == 'schema')
      continue;

    modelObj[setName] = {};
    modelObj[setName].head = {};
    modelObj[setName].data = [];

    for (let h in s[setName].head) {
      modelObj[setName].head[h] = getType(s[setName].head[h].type);
    }

    let dataObj = {};
    for (let d in s[setName].data) {
      dataObj[d] = getType(s[setName].data[d].type);
    }
    modelObj[setName].data.push(dataObj);
    let mSchema = mongoose.Schema(
      modelObj,
      { collection: schema } // collection name is plugin directory name, see above
    );
    models[s.schema.schemaName] = mongoose.model(s.schema.schemaName, mSchema);
  }
}

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
      throw new Error('Unknown type:'+schemaType);
  }
}

function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}
