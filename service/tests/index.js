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

for (let schemaKey in schemas) {
  chromeCookies.getCookies(schemas[schemaKey].schema.site.canonicalURL, 'set-cookie', (err, cookies) => {
//    console.log(cookies);
    for (let cookie of cookies) {
      cookieJar.setCookieSync(cookie, schemas[schemaKey].schema.site.canonicalURL);
    }
    let userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.110 Safari/537.36';
    let url = 'https://www.yelp.com/user_details_reviews_self';
    let jsdom = require('jsdom');
    global.document = jsdom.jsdom(undefined, {
      userAgent, cookieJar
    });
    global.window = global.document.defaultView;
    global.XMLHttpRequest = global.window.XMLHttpRequest;
    jsdom.jQueryify(global.window, 'https://code.jquery.com/jquery-1.12.2.min.js', () => {
      global.$ = global.window.$;
      let tests = require(`${pluginDir}/${schemas[schemaKey].schema.site.plugin}`);
      for (let testName in tests) {
        tests[testName](result => {
          let dataSet = new DataSet(result, schemas[schemaKey][testName]);
          reportResult(dataSet.set);
        });
      }
    });
  });
}

function reportResult(result) {
  console.log(result);
}
