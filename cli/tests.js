'use strict';

// Must be run via cli/run-tests or imported as a module

// External dependencies
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const execSync = require('child_process').execSync;
const colors = require('colors/safe');
const wordwrap = require('wordwrap');
const program = require('commander');
const md5 = require('md5');
const isURL = require('is-url-superb');

// Internal dependencies
const DataSet = require('../extension/src/dataset.js');
const { schemas, sites } = require('../service/load-schemas');
const { logSiteList } = require('./lib');

const srcDir = path.join(__dirname, '..', 'extension', 'src'),
  pluginDir = path.join(srcDir, 'plugins'),
  libDir = path.join(srcDir, 'lib', 'js'),
  resultsDir = `${__dirname}/results`;

// For formatting results
const width = process.stdout.columns;
const wrap = wordwrap(width);
const logNotice = txt => console.log(wrap(txt));
const logError = txt => console.error(wrap(colors.red(txt)));
const logPlugin = txt => console.log(wrap(colors.gray(
  `Message from plugin or site: ${txt}`)));

// Test config

// By default, we look for a copy of the running Chromium profile here. It is
// necessary to use a copy if you want Puppeteer to work alongside a different
// version of Chromium that is locally installed, otherwise you will get profile
// corruption.
const userDataDir = path.join(os.homedir(), '.chromium-testing-profile');

// We want to use the cookies/local storage associated with the account that
// is actively in use. By default Puppeteer switches to basic auth instead.
const disabledPuppeteerArgs = ['--use-mock-keychain', '--password-store=basic'];
const puppeteerArgs = puppeteer
  .defaultArgs()
  .filter(arg => !disabledPuppeteerArgs.includes(arg));

// Different plugins may require a different Puppeteer load state before
// execution of the tested function.
const waitOptions = {
  quora: ['load', 'networkidle2']
};
const getWaitOptions = plugin => waitOptions[plugin] || ['load'];

const diffCommand = `icdiff --cols=${process.stdout.columns}` +
  ` --show-all-spaces --line-numbers --no-headers %file1 %file2`;

const siteNames = sites.map(site => site.name.toLowerCase());

let failedTests = 0,
  skippedTests = 0;

module.exports.exec = () => {

  setupCommandLineOptions();

  if (program.list) {
    logNotice('The following site names are recognized (names are not case-sensitive):\n');
    logSiteList();
    process.exit();
  }
  // Specify which site(s) to test
  const { siteIDs, optionalURLs } = applyArgs(siteNames);

  runTests(siteIDs, optionalURLs)
    .then(() => {
      const msg = `Testing completed. ${failedTests || 'No'} failed test(s), ` +
        `${skippedTests || 'no'} skipped tests.`;
      if (failedTests) {
        logError(msg);
        process.exit(1);
      } else {
        logNotice(msg);
        process.exit();
      }
    })
    .catch(error => {
      logError('Unexpected error:');
      logError(error.stack);
      process.exit();
    });
};

async function runTests(siteIDs, optionalURLs) {

  const browser = await puppeteer.launch({
    userDataDir,
    ignoreDefaultArgs: true,
    headless: program.browser ? false : true,
    args: puppeteerArgs
  });

  // We clean up after ourselves :-). We close tabs we've opened once a new
  // test starts, beginning with the initial blank tab.
  const oldPages = await browser.pages();


  for (let siteID of siteIDs) {
    const schema = schemas[sites[siteID].plugin];
    const { canonicalURL, deps, plugin, name: siteName } = sites[siteID];
    // URL to use instead of canonical URL for this site from command line arg
    const optionalURL = optionalURLs[siteName.toLowerCase()];
    const testState = {};
    const page = await browser.newPage();

    while (oldPages.length)
      await oldPages.shift().close();

    oldPages.push(page);

    logNotice('-'.repeat(width));
    logNotice(`Running tests for ${siteName}`);

    // Note that we may be running multiple tests per plugin without navigating.
    // We only navigate during the test if a plugin performs a redirect.
    await prepareTests({ url: optionalURL || canonicalURL, page, deps, plugin });

    const tests = await page.evaluate('window.freeyourstuff.tests') || [];
    for (let testID in tests) {
      logNotice(`Running test for dataset ${testID}.`);

      let result;
      let testPage = page;

      // Repeated test execution may be necessary due to page navigation
      do {

        // Give the plugin a method to instigate redirects. Repeated
        // `exposeFunction` on same tab throws; redirects open a new tab.
        if (testState.redirect === undefined || testState.redirect)
          await testPage.exposeFunction('puppeteerRedirect',
            getRedirectHandler(testState));

        // Redirect is performed at the end of the loop
        testState.redirect = false;

        // Execute the actual test
        result = await testPage.evaluate(
          async (testName, url) =>
          await window.freeyourstuff.tests[testName]({ url }),
          testID, optionalURL);

        let passed;
        if (result) {
          passed = validateResult({
            siteName: siteName.toLowerCase(),
            dataSetName: testID,
            result,
            schema: schema[testID],
            optionalURL
          });
        } else if (!testState.redirect && result !== null) {
          logError('No result from plugin.');
          passed = false;
        } else if (result === null) {
          logNotice('Test skipped.');
          skippedTests++;
          passed = true;
        }
        logNotice('');

        if (!passed && !testState.redirect)
          failedTests++;

        if (testState.redirect) {
          const newPage = await browser.newPage();
          oldPages.push(newPage);
          testPage = newPage;
          await prepareTests({ url: testState.url, page: newPage, deps, plugin });
        }
      } while (testState.redirect);

    }
  }

  await browser.close();
}

async function prepareTests({ url, page, deps = [], plugin } = {}) {
  await page.setViewport({ width: 1280, height: 1024 });

  const addDep = async file =>
    await page.addScriptTag({ path: path.join(libDir, `${file}.min.js`) });

  await page.goto(url, { waitUntil: getWaitOptions(plugin) });

  page.on('console', msg => logPlugin(msg._text));

  // Some sites have the `define` function from RequireJS loaded, which may
  // interfere with a dependency's own check for the presence of RequireJS
  // in its module loading code (numeral is an example that otherwise fails
  // to load on some sites).
  await page.evaluate(() => {
    window.define = undefined;
  });

  // Used by all plugins
  await addDep('jquery');

  // Inject optional plugin-specific dependencies like Papaparse, Numeral
  if (deps)
    for (let dep of deps)
      await addDep(dep);

  // For handling schemas
  await page.addScriptTag({ path: path.join(srcDir, 'dataset.js') });

  // For telling extension code not to send messages using the Chrome API
  await page.evaluate(() => {
    window.freeyourstuff.puppeteer = true;
  });

  // Shared helper code
  await page.addScriptTag({ path: path.join(srcDir, 'plugin.js') });

  // The actual plugin
  const pluginPath = path.join(pluginDir, plugin, 'index.js');
  await page.addScriptTag({ path: pluginPath });
}


function applyArgs(siteNames) {
  const optionalURLs = {};

  if (!program.args.length) {
    logNotice('All sites registered in sites.json will be ' +
      'tested: ' + siteNames.join(', '));
    logNotice('\nTo test only some sites, specify them as ' +
      'command line arguments, separated with spaces.');
    logNotice('\nSee --help for more information.');
    return {
      optionalURLs,
      siteIDs: siteNames.map((_siteName, id) => id)
    };
  }

  const siteIDs = [],
    badArgs = [];

  let lastSite;
  program.args.forEach(arg => {
    const index = siteNames.indexOf(arg.toLowerCase());
    if (index !== -1) {
      siteIDs.push(index);
      lastSite = siteNames[index];
    } else if (isURL(arg) && lastSite) {
      logNotice(`Will attempt to use ${arg} as profile URL for ${lastSite}.`);
      optionalURLs[lastSite] = arg;
      lastSite = undefined;
    } else
      badArgs.push(arg);
  });

  const selectedNames = siteIDs.map(id => siteNames[id]);

  if (badArgs.length) {
    logError('The following arguments were not recognized as valid plugins or URLs: ' +
      badArgs.join(', '));
    process.exit(1);
  } else {
    logNotice('The following specified site(s) have been ' +
      'found in sites.json and will be tested: ' + selectedNames.join(', '));
    return {
      siteIDs,
      optionalURLs
    };
  }
}

// Exposed to plugins so they can let us know that we need to navigate
function getRedirectHandler(testState) {
  return url => {
    testState.redirect = true;
    testState.url = url;
    logNotice(`Redirecting to ${testState.url} and restarting test.`);
  };
}

function validateResult({ siteName, dataSetName, result, schema, optionalURL }) {
  let md5Suffix = '';
  const testID = `${siteName}.${dataSetName}`;
  logNotice(`Parsing result for ${testID}`);
  if (optionalURL) {
    logNotice(`Tested with ${optionalURL}, hash of URL will be added to ` +
      `filename.`);
    md5Suffix = '-' + md5(optionalURL);
  }
  let dataSet;
  try {
    dataSet = new DataSet(result, schema);
  } catch (error) {
    logError('Error parsing result against schema:');
    logError(result);
    logError('Error was:');
    logError(error.stack);
    return false;
  }
  const jsonData = JSON.stringify(dataSet.set, null, 2);
  logNotice('Running diff');
  const filename = `${resultsDir}/${testID}${md5Suffix}.json`;
  const tmpFilename = `${resultsDir}/tmp.json`;
  try {
    fs.statSync(filename);
  } catch (e) {
    if (e.code === 'ENOENT') {
      logNotice('No previous test result found.');
      logNotice('The result of this run will be used to evaluate future correctness.');
      logNotice(`Please evaluate ${filename} and delete it if you need to regenerate it.`);
      fs.writeFileSync(filename, jsonData);
      return true;
    } else {
      throw e;
    }
  }
  fs.writeFileSync(tmpFilename, jsonData);
  const command = diffCommand
    .replace(/%file1/, filename)
    .replace(/%file2/, tmpFilename);
  let diff;
  try {
    diff = execSync(command).toString().trim();
  } catch (e) {
    logError('Problem running diff:');
    logError(e.stack);
    logError('Is the required diff tool installed?');
    return false;
  }
  if (diff) {
    logError('Comparison reveals differences. This may be an error, or it ' +
      'may reflect changes to the data.');
    logError('Differences:');
    console.error(diff);
    logError('If this is not a bug, please delete the old file and run the ' +
      'test again');
    return false;
  } else {
    logNotice('No differences. This probably means that everything is fine, ' +
      'unless it was not fine to begin with. :-)');
    return true;
  }
}

function setupCommandLineOptions() {

  program
    .version('0.1.0')
    .description('run all freeyourstuff.cc tests, or only the ones specified')
    .usage('[site [profile url] ...] [options]')
    .option('-b, --browser', `show the browser while performing tests`)
    .option('-l, --list', `display the list of supported sites`)
    .on('--help', () => {
      logNotice('');
      logNotice('  Examples:\n');
      logNotice('      $ ./run-tests imdb quora amazon.de');
      logNotice('      Runs the specified tests\n');
      logNotice('      $ ./run-tests imdb http://www.imdb.com/user/ur1289896/reviews yelp');
      logNotice('      Uses the specified profile URL for the IMDB test, but uses session data for Yelp test.');
    })
    .parse(process.argv);
}

module.exports.runTests = runTests;
