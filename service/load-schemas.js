// This module loads and exposes an object of all available schemas, using
// the schema key as the object key. It adds the site metadata to the schema
// header for convenient access.
//
// The schemas and site metadata are loaded from the extension plugin directory.
// We therefore need to have a checkout of the extension alongside the web
// service in order to use this module.
'use strict';
const jsonfile = require('jsonfile');
const path = require('path');

const sitesDir = path.join(__dirname, '..', 'extension'),
  pluginDir = path.join(sitesDir, 'src', 'plugins'),
  sitesFile = path.join(sitesDir, 'sites.json'),
  sites = jsonfile.readFileSync(sitesFile);

const schemas = {};
for (let site of sites) {
    try {
      const schemaFile = path.join(pluginDir, site.plugin, 'schema.json'),
        schema = jsonfile.readFileSync(schemaFile);

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

// For convenience, we also export the loaded site data
module.exports = {
  schemas,
  sites
};
