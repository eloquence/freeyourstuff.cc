'use strict';
/* eslint no-empty-function: "off", no-unused-vars: "off" */
const isURL = require('is-url-superb');
const config = require('config');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const program = require('commander');


const DataSet = require('../extension/src/dataset.js');
const { schemas, sites } = require('../service/load-schemas');
const {
  logNotice, logError, logSiteList,
  getRedirectHandler, preparePlugin,
  userDataDir, puppeteerArgs
} = require('./lib');
const siteNames = sites.map(site => site.name.toLowerCase());

const downloadDir = path.join(__dirname, config.get('downloadDir'));

function exec() {
  setupCommandLineOptions();
  if (process.argv.length == 2) {
    program.outputHelp();
    process.exit();
  } else if (program.list) {
    logNotice('The following site names are recognized (names are not ' +
      'case-sensitive):\n');
    logSiteList();
    process.exit();
  }

  // program.args is filtered by the commander module to exclude options
  const siteID = siteNames.indexOf(program.args[0].toLowerCase());
  if (siteID == -1) {
    logError(`The site name ${program.args[0]} was not recognized. Please ` +
      `run "freeyourstuff --list" to get a list of supported sites, or run ` +
      `"freeyourstuff" without arguments for more information.`);
    process.exit(1);
  }

  const siteName = sites[siteID].name, // Canonical version of name
    url = program.args[1];
  if (typeof url == 'string' && !isURL(url)) {
    logError(`The argument "${url}" should refer to a valid profile URL for ` +
      `${siteName}. It does not appear to be a URL at all. Type ` +
      `"freeyourstuff" without arguments for more usage information.`);
    process.exit(1);
  }
  logNotice(`Initiating download of your contributions to ${siteName}.`);
  runDownload(siteID, url)
    .then(() => {
      process.exit();
    })
    .catch(error => {
      logError('An error occurred while attempting to download your data:');
      logError(error.stack);
      process.exit(1);
    });
}

async function runDownload(siteID, url, format = 'json') {
  const browser = await puppeteer.launch({
    userDataDir,
    ignoreDefaultArgs: true,
    headless: true,
    args: puppeteerArgs
  });
  const [page] = await browser.pages();
  const { canonicalURL, deps, plugin, name: siteName } = sites[siteID];
  await preparePlugin({ url: url || canonicalURL, page, deps, plugin });
  const dlState = {};
  const schema = schemas[sites[siteID].plugin];

  const jsonData = await page.evaluate('window.freeyourstuff.jsonData || {}');

  const siteSet = {};
  siteSet.schemaKey = schema.schema.key;
  siteSet.schemaVersion = schema.schema.version;
  let weHaveAtLeastSomeData = false;

  for (let dataID in jsonData) {

    let dlPage = page;

    // Repeated plugin execution may be necessary due to page navigation
    do {

      // Give the plugin a method to instigate redirects. Repeated
      // `exposeFunction` on same tab throws; redirects open a new tab.
      if (dlState.redirect === undefined || dlState.redirect)
        await dlPage.exposeFunction('puppeteerRedirect',
          getRedirectHandler(dlState));

      // Redirect is performed at the end of the loop
      dlState.redirect = false;

      // Execute the actual download
      const result = await dlPage.evaluate(
        async (id, url) =>
        await window.freeyourstuff.jsonData[id]({ url }),
        dataID, url);

      if (result) {
        siteSet[dataID] = new DataSet(result, schema[dataID]).set;
        weHaveAtLeastSomeData = true;
      } else if (!dlState.redirect && result !== null)
        logError('No result from plugin.');
      else if (result === null)
        logNotice('Command-line download not supported for data of type ' + dataID);

      if (dlState.redirect) {
        const newPage = await browser.newPage();
        dlPage = newPage;
        await preparePlugin({ url: dlState.url, page: newPage, deps, plugin });
      }
    } while (dlState.redirect);
  }
  await browser.close();
  if (weHaveAtLeastSomeData) {
    saveDownload(siteSet);
    process.exit();
  } else {
    logError('Download unsuccessful.');
    process.exit(1);
  }
}

function saveDownload(siteSet) {
  const jsonData = JSON.stringify(siteSet, null, 2);
  const date = new Date().toISOString().substring(0, 10);
  const filename = `${siteSet.schemaKey}-${date}.json`;
  const fullPath = path.join(program.dest || downloadDir, filename);
  fs.writeFileSync(fullPath, jsonData);
  logNotice(`Download successful! File saved to: ${fullPath}`);
}

function setupCommandLineOptions() {

  program
    .version('0.1.0')
    .description('download your content from a specific freeyourstuff.cc supported site')
    .usage('[site] [profile url] [options]')
    .option('-l, --list', 'display the list of supported sites')
    .option('-d, --dest <path>', 'specify the target directory (without filename)')
    .on('--help', () => {
      logNotice('');
      logNotice('  Examples:\n');
      logNotice('      $ ./freeyourstuff quora');
      logNotice('      Download your Quora contributions\n');
      logNotice('      $ ./freeyourstuff imdb http://www.imdb.com/user/ur1289896/reviews');
      logNotice('      Downloads your IMDB contributions using the specified profile URL');
      logNotice('');
      logNotice('  Downloads will be saved in the directory configured in config/default.json5.');
    })
    .parse(process.argv);

}

module.exports = {
  exec
};
