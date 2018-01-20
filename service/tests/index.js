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
// cookie exports would be fairly easy to add. Set password authentication to
// basic on Linux to avoid decryption issues:
//
// $ google-chrome --password-store=basic
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
const { JSDOM } = jsdom;
const CookieJar = require('tough-cookie').CookieJar;
const cookieJar = new CookieJar();
const fs = require('fs');
const execSync = require('child_process').execSync;

// Internal dependencies
const DataSet = require('../../extension/src/dataset.js');
const schemas = require('../load-schemas');
const pluginDir = `${__dirname}/../../extension/src/plugins`;
const libDir = `${__dirname}/../../extension/src/lib/js`;
const resultsDir = `${__dirname}/results`;
const diffCommand = `icdiff --cols=${process.stdout.columns} --show-all-spaces --line-numbers --no-headers %file1 %file2`;

// Config
const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.110 Safari/537.36';


let schemaKeys = Object.keys(schemas);

if (process.argv.length > 2) {
  const myTests = process.argv;
  myTests.splice(0, 2);
  schemaKeys = schemaKeys.filter(key => myTests.indexOf(key) !== -1);
  if (!schemaKeys.length) {
    console.error(colors.red('None of the specified plugin(s) could be found: ' + myTests.join(', ')));
    process.exit(1);
  } else
    console.log(colors.gray('The following specified plugin(s) have been found in sites.json and will be tested: ' + schemaKeys.join(', ')));
} else {
  console.log(colors.gray('All plugins registered in sites.json will be tested: ' + schemaKeys.join(', ')));
  console.log(colors.gray('To test only some plugins, specify them as command line arguments, separated with spaces.'));
}

runTests()
  .then(() => {
    console.log('Tests completed.');
  })
  .catch(error => {
    console.error(colors.red(error.message));
    console.error(error.stack);
  });

function getCookies(url) {
  return new Promise((resolve, reject) => {
      chromeCookies.getCookies(url, 'set-cookie', (err, cookies) => {
        if (err)
          return reject(err);
        else
          return resolve(cookies);
      });
  });
}

async function runTests() {
  for (let schemaKey of schemaKeys) {
    console.log('-'.repeat(process.stdout.columns));
    console.log(`Testing plugin "${schemaKey}"...`);
    const cookies = await getCookies(schemas[schemaKey].schema.site.canonicalURL);
    for (let cookie of cookies)
      cookieJar.setCookieSync(cookie, schemas[schemaKey].schema.site.canonicalURL);


    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      userAgent,
      cookieJar,
      runScripts: 'dangerously',
      // needed for setting document origin
      url: schemas[schemaKey].schema.site.canonicalURL
    });

    const window = dom.window,
      document = window.document;

    const injectScript = path => {
      return new Promise((resolve, reject) => {
        const pluginJS = fs.readFileSync(path).toString();
        const scriptEl = document.createElement('script');
        scriptEl.textContent = pluginJS;
        scriptEl.addEventListener('load', () => {
          resolve();
        });
        document.body.appendChild(scriptEl);
      });
    };

    const injectDependency = dep => {
      switch (dep) {
        case 'jquery':
          return injectScript(`${libDir}/jquery-2.1.4.min.js`);
        case 'papaparse':
        case 'numeral':
        case 'moment':
          if (Array.isArray(schemas[schemaKey].schema.site.deps) &&
            schemas[schemaKey].schema.site.deps.indexOf(dep) !== -1) {
            console.log('Loading plugin dependency ' + dep);
            return injectScript(`${libDir}/${dep}.min.js`);
          }
          /* falls through */
        default:
          return Promise.resolve();
      }
    };

    await injectDependency('jquery');
    await injectDependency('papaparse');
    await injectDependency('numeral');
    await injectScript(require.resolve('../../extension/src/plugin.js'));
    await injectScript(require.resolve(`${pluginDir}/${schemas[schemaKey].schema.site.plugin}`));
    if (typeof window.jsonTests !== 'object') {
      console.log(`No JSON tests defined for plugin ${schemaKey}.`);
      console.log(`Tests must be defined in the plugin itself in its jsonTests variable.`);
      continue;
    }
    for (let testName in window.jsonTests) {
      try {
       const result = await window.jsonTests[testName]();
       validateResult({
         schemaKey,
         datasetName: testName,
         result,
         schema: schemas[schemaKey][testName]
       });
      } catch (error) {
        console.error(colors.red(`There was a problem validating this test: ${testName}.`));
        console.error(colors.red(error.stack));
      }
    }

  }
}

function validateResult({ schemaKey, datasetName, result, schema }) {
  const testID = `${schemaKey}.${datasetName}`;
  console.log(`Parsing result for ${testID}`);
  const dataSet = new DataSet(result, schema);
  const jsonData = JSON.stringify(dataSet.set, null, 2);
  console.log('Running diff')
  const filename = `${resultsDir}/${testID}.json`;
  const tmpFilename = `${resultsDir}/tmp.json`;
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
  const oldResult = fs.readFileSync(filename).toString();
  fs.writeFileSync(tmpFilename, jsonData);
  const command = diffCommand
    .replace(/%file1/, filename)
    .replace(/%file2/, tmpFilename);
  let diff;
  try {
    diff = execSync(command).toString().trim();
  } catch (e) {
    console.error(colors.red('Problem running diff:'));
    console.error(colors.red(e.stack));
    console.error(colors.red('Is the required diff tool installed?'));
    return;
  }
  if (diff)
    console.log(diff);
  else
    console.log('No differences');
}
