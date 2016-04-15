// A simple test runner.
// Run as follows:
//
// $ node tests # from service directory
// $ node index.js # from this directory
//
// It relies on the existence of a full extension checkout, since it executes
// each of the (client-side) plugins using a JSDOM environment. Since the
// client-side plugins rely on the user being logged into supported sites,
// the best way to avoid faking out a whole new login infrastructure for
// server-side testing is to use cookies. (Note also that many login systems
// trigger captchas under certain circumstances.)
//
// Right now we support loading Chrome's cookies, though support for various
// cookie exports would be fairly easy to add.
//
// If you have any interest in running the plugins server-side for reasons
// other than testing, this should get you much of the way there.

'use strict';

// External dependencies
const chromeCookies = require('chrome-cookies-secure');
const colors = require('colors/safe');
const jsdom = require('jsdom');
const CookieJar = require('tough-cookie').CookieJar;
const cookieJar = new CookieJar();
const fs = require('fs');
const JSDiff = require('diff');

// Internal dependencies
const DataSet = require('../../extension/src/dataset.js');
const plugin = require('../../extension/src/plugin.js');
const schemas = require('../load-schemas');
const pluginDir = `${__dirname}/../../extension/src/plugins`;
const resultsDir = `${__dirname}/results`;

let schemaKeys = Object.keys(schemas);
if (process.argv.length > 2) {
  let myTests = process.argv;
  myTests.splice(0, 2);
  schemaKeys = schemaKeys.filter(key => {
    return (myTests.indexOf(key) !== -1);
  });
  if (!schemaKeys.length) {
    console.log(colors.red('None of the specified plugin(s) could be found: ' + myTests.join(', ')));
    process.exit(1);
  } else
    console.log(colors.gray('The following specified plugin(s) have been found in sites.json and will be tested: ' + schemaKeys.join(', ')));
} else {
  console.log(colors.gray('All plugins registered in sites.json will be tested: ' + schemaKeys.join(', ')));
  console.log(colors.gray('To test only some plugins, specify them as command line arguments, separated with spaces.'));
}

runTests();

// Since we have a lot of async code that could throw errors, we'll make sure
// tests keep running when that happens.
process.on('uncaughtException', function(e) {
  console.log(colors.red(e.stack));
  runTests();
});

function runTests() {
  if (schemaKeys.length) {
    let schemaKey = schemaKeys.shift();
    console.log(`Testing plugin "${schemaKey}"...`);
    chromeCookies.getCookies(schemas[schemaKey].schema.site.canonicalURL, 'set-cookie', (err, cookies) => {
      for (let cookie of cookies) {
        cookieJar.setCookieSync(cookie, schemas[schemaKey].schema.site.canonicalURL);
      }
      let userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.110 Safari/537.36';
      let virtualConsole = jsdom.createVirtualConsole().sendTo(console);
      const document = jsdom.jsdom(undefined, {
        userAgent,
        cookieJar,
        virtualConsole,
        url: schemas[schemaKey].schema.site.canonicalURL // needed for setting document origin
      });
      let window = document.defaultView;
      jsdom.jQueryify(window, 'https://code.jquery.com/jquery-1.12.2.min.js', () => {
        window.plugin = plugin;
        let $ = window.$;
        let pluginJS = fs.readFileSync(require.resolve(`${pluginDir}/${schemas[schemaKey].schema.site.plugin}`));
        const scriptEl = document.createElement('script');
        scriptEl.textContent = pluginJS;
        scriptEl.addEventListener('load', function() {
          if (typeof window.jsonTests !== 'object') {
            console.log(`No JSON tests defined for plugin ${schemaKey}.`);
            console.log(`Tests must be defined in the plugin itself in its jsonTests variable.`);
            runTests();
          } else {
            for (let testName in window.jsonTests) {
              window.jsonTests[testName](result => {
                validateResult(`${schemaKey}.${testName}`, JSON.stringify(result, undefined, 2));
                runTests();
              });
            }
          }
        });
        document.body.appendChild(scriptEl);
      });
    });
  }
}

function validateResult(testName, newResult) {
  let filename = `${resultsDir}/${testName}.json`;
  try {
    fs.statSync(filename);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('No previous test result found.');
      console.log('The result of this run will be used to evaluate future correctness.');
      console.log(`Please evaluate ${filename} and delete it if you need to regenerate it.`);
      fs.writeFileSync(filename, newResult);
    } else {
      throw e;
    }
    return;
  }
  let oldResult = fs.readFileSync(filename).toString();
  let diff = JSDiff.diffChars(oldResult, newResult);
  console.log('Comparing with previous result.');
  let str = '';
  let diffSize = 0;
  diff.forEach(function(part) {
    if (part.added || part.removed)
      diffSize ++;
    // green for additions, red for deletions
    // grey for common parts
    let color = part.added ? 'green' :
      part.removed ? 'red' : 'gray';
    str += colors[color](part.value);
  });
  if (diffSize) {
    console.log(`Found ${diffSize} differences with previous result.`);
    console.log(`Additions are green, removals are red.`);
    console.log(str);
  } else {
    console.log('No differences with first run.');
  }
}
