// This module loads and exposes an object of all available schemas, using
// the schema key as the object key.
//
// The schemas are loaded from the extension plugin directory. We therefore need
// to have a checkout of the extension alongside the web service in order to use
// this module.
'use strict';
let jsonfile = require('jsonfile');
let fs = require('fs');
let path = require('path');
let pluginDir = '../extension/src/plugins';
let dirs = getDirectories(pluginDir);
let schemas = {};
for (let dir of dirs) {
  try {
    let schema = jsonfile.readFileSync(`${pluginDir}/${dir}/schema.json`);
    if (schema.hasOwnProperty('schema') && schema.schema.hasOwnProperty('key')) {
      schemas[schema.schema.key] = schema;
    } else {
      console.log(`schema.json for plugin "${dir}" does not have a valid schema header. Skipping.`);
    }
  } catch (e) {
    console.log(`Problem reading schema.json for plugin "${dir}". Skipping.`);
  }
}

function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}

module.exports = schemas;
