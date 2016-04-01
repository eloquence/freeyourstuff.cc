// Tests must be run from the project's service/ folder, e.g.:
// `/freeyourstuff.cc/service$ node tests`
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
//
// FIXME:
// - The async logic here needs some work. Perhaps best to run these
//   synchronously.
// - We need some actual success/failure reporting. Probably we'll compare
//   against a first-run output, and then show the differences if there are any.
//   That means new content == test failures, but hey, that's life.
'use strict';
let chromeCookies = require('chrome-cookies-secure');
let CookieJar = require('tough-cookie').CookieJar;
let cookieJar = new CookieJar();
let DataSet = require('../../extension/src/dataset.js');
let schemas = require('../load-schemas');
let pluginDir = '../../extension/src/plugins';
let colors = require('colors/safe');

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

function runTests() {
  if (schemaKeys.length) {
    let schemaKey = schemaKeys.shift();
    console.log(`Testing plugin "${schemaKey}"...`);
    chromeCookies.getCookies(schemas[schemaKey].schema.site.canonicalURL, 'set-cookie', (err, cookies) => {
      for (let cookie of cookies) {
        cookieJar.setCookieSync(cookie, schemas[schemaKey].schema.site.canonicalURL);
      }
      let userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.110 Safari/537.36';
      let url = 'https://www.yelp.com/user_details_reviews_self';
      let jsdom = require('jsdom');
      global.document = jsdom.jsdom(undefined, {
        userAgent,
        cookieJar
      });
      global.window = global.document.defaultView;
      global.XMLHttpRequest = global.window.XMLHttpRequest;
      jsdom.jQueryify(global.window, 'https://code.jquery.com/jquery-1.12.2.min.js', () => {
        global.$ = global.window.$;
        let tests = require(`${pluginDir}/${schemas[schemaKey].schema.site.plugin}`);
        for (let testName in tests) {
          console.log(`Running test "${testName}"...`);
          // This will not catch errors during asynchronous execution
          try {
            tests[testName](result => {
              let dataSet = new DataSet(result, schemas[schemaKey][testName]);
              reportResult(dataSet.set);
              // Continue until all tests are run
              runTests();
            });
          } catch(e) {
            console.log(colors.red('Test failed. Error was: '+e.stack));
          }
        }
      });
    });
  }
}

function reportResult(result) {
  console.log(colors.gray(JSON.stringify(result, undefined, 2)));
}
