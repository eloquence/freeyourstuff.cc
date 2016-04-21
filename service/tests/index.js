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
// We use icdiff by default, which you can find here: https://www.jefftk.com/icdiff
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
const execSync = require('child_process').execSync;

// Internal dependencies
const DataSet = require('../../extension/src/dataset.js');
const plugin = require('../../extension/src/plugin.js');
const schemas = require('../load-schemas');
const pluginDir = `${__dirname}/../../extension/src/plugins`;
const libDir = `${__dirname}/../../extension/src/lib/js`;
const resultsDir = `${__dirname}/results`;
const diffCommand = `icdiff --cols=${process.stdout.columns} --show-all-spaces --line-numbers --no-headers %file1 %file2`;
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

processTestQueue();

// Since we have a lot of async code that could throw errors, we'll make sure
// tests keep running when that happens.
process.on('uncaughtException', function(e) {
  console.log(colors.red(e.stack));
  processTestQueue();
});

function processTestQueue() {
  if (schemaKeys.length) {
    let schemaKey = schemaKeys.shift();
    console.log('-'.repeat(process.stdout.columns));
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
      window.plugin = plugin;

      jsdom.jQueryify(window, 'https://code.jquery.com/jquery-1.12.2.min.js', () => {
        injectDependency('papaparse')
          .then(injectScript(require.resolve(`${pluginDir}/${schemas[schemaKey].schema.site.plugin}`),
            runJSONTests));
      });

      function injectScript(path, callback) {
        return new Promise((resolve, reject) => {
          let pluginJS = fs.readFileSync(path).toString();
          let scriptEl = document.createElement('script');
          scriptEl.textContent = pluginJS;
          scriptEl.addEventListener('load', () => {
            resolve();
            if (callback)
              callback();
          });
          document.body.appendChild(scriptEl);
        });
      }

      function injectDependency(dep) {
        switch (dep) {
          case 'papaparse':
            if (Array.isArray(schemas[schemaKey].schema.site.deps) &&
              schemas[schemaKey].schema.site.deps.indexOf(dep) !== -1) {
                console.log('Loading plugin dependency '+dep);
                return injectScript(`${libDir}/papaparse.min.js`);
            }
            /* falls through */
          default:
            return new Promise((resolve) => {
              resolve();
            });
        }
      }

      function runJSONTests() {
        if (typeof window.jsonTests !== 'object') {
          console.log(`No JSON tests defined for plugin ${schemaKey}.`);
          console.log(`Tests must be defined in the plugin itself in its jsonTests variable.`);
          processTestQueue();
        } else {
          let jsonTests = [];
          for (let jsonTest in window.jsonTests) {
            jsonTests.push(new Promise(resolve => {
              window.jsonTests[jsonTest](result => {
                resolve({
                  schemaKey,
                  setName: jsonTest,
                  result
                });
              });
            }));
          }
          Promise.all(jsonTests).then(validateResults).then(processTestQueue);
        }
      }
    });
  }
}

function validateResults(resultArray) {
  for (let resultObj of resultArray) {
    validateResult(resultObj);
  }
}

function validateResult(resultObj) {
  console.log(`Parsing ${resultObj.testID} against schema ...`);
  let testID = `${resultObj.schemaKey}.${resultObj.setName}`;
  let dataSet = new DataSet(resultObj.result, schemas[resultObj.schemaKey][resultObj.setName]);

  let jsonData = JSON.stringify(dataSet.set, null, 2);
  console.log(`Running diff for ${testID} ...`);
  let filename = `${resultsDir}/${testID}.json`;
  let tmpFilename = `${resultsDir}/tmp.json`;
  try {
    fs.statSync(filename);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('No previous test result found.');
      console.log('The result of this run will be used to evaluate future correctness.');
      console.log(`Please evaluate ${filename} and delete it if you need to regenerate it.`);
      fs.writeFileSync(filename, jsonData);
    } else {
      throw e;
    }
    return;
  }
  let oldResult = fs.readFileSync(filename).toString();
  fs.writeFileSync(tmpFilename, jsonData);
  let command = diffCommand
    .replace(/%file1/, filename)
    .replace(/%file2/, tmpFilename);
  let diff;
  try {
    diff = execSync(command).toString().trim();
  } catch(e) {
    console.error(colors.red('Problem running diff:'));
    console.error(colors.red(e.stack));
    console.error(colors.red('Is the required diff tool installed?'));
    return;
  }
  if(diff)
    console.log(diff);
  else
    console.log('No differences');
}
