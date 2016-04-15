// This module loads and exposes an object of all available schemas, using
// the schema key as the object key. It adds the site metadata to the schema
// header for convenient access.
//
// The schemas and site metadata are loaded from the extension plugin directory.
// We therefore need to have a checkout of the extension alongside the web
// service in order to use this module.
'use strict';
const jsonfile = require('jsonfile');
let sitesDir = `${__dirname}/../extension`;
let pluginDir = `${__dirname}/../extension/src/plugins`;
let sites = jsonfile.readFileSync(`${sitesDir}/sites.json`);
let schemas = {};
for (let site of sites) {
    try {
      let schema = jsonfile.readFileSync(`${pluginDir}/${site.plugin}/schema.json`);
      if (schema.hasOwnProperty('schema') && schema.schema.hasOwnProperty('key')) {
        schemas[schema.schema.key] = schema;
        schema.schema.site = site;
      } else {
        console.log(`schema.json for plugin "${site.plugin}" does not have a valid schema header. Skipping.`);
      }
    } catch (e) {
      console.log(`Problem reading schema.json for plugin "${site.plugin}". Skipping. Error was: ${e}`);
    }
}
module.exports = schemas;
