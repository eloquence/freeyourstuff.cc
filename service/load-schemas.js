// This module loads and exposes an array of all available schema, as specified
// in the extension plugin directory. We therefore need to have a checkout
// of the extension alongside the web service in order to use this module.

'use strict';
let jsonfile = require('jsonfile');
let fs = require('fs');
let path = require('path');
let pluginDir = '../extension/src/plugins';
let dirs = getDirectories(pluginDir);
let schemas = [];
for (let dir of dirs) {
  try {
    schemas.push(jsonfile.readFileSync(`${pluginDir}/${dir}/schema.json`));
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
