'use strict';
// External dependencies
const jsonfile = require('jsonfile');

let config = {};

try {
  config = jsonfile.readFileSync(`${__dirname}/config.json`);
} catch(e) {
  console.log(`${__dirname}/config.json was not found. Loading defaultConfig.json instead.`);
  config = jsonfile.readFileSync(`${__dirname}/defaultConfig.json`);
}

if (+process.argv[2] && +process.argv[3]) {
  config.httpPort = process.argv[2];
  config.httpsPort = process.argv[3];
}

// We're hardcoding this one, assuming it's not something you'll need to change.
config.pathToTemplates = __dirname + '/templates/*.ejs';

// Configuration that is exposed to client and templates
config.expose = function() {
    return ({
      baseURL: this.baseURL,
      siteName: this.siteName,
    });
};

module.exports = config;
