'use strict';
// External deps
const path = require('path');
const colors = require('colors/safe');
const wordwrap = require('wordwrap');
const puppeteer = require('puppeteer');
const config = require('config');
const os = require('os');
const wrap = wordwrap(process.stdout.columns); // For formatting console output

// Internal deps
const { sites } = require('../service/load-schemas');

// Static config

// Different plugins may require a different Puppeteer load state before
// execution of the tested function.
const waitOptions = {
  quora: ['load', 'networkidle2']
};

// We want to use the cookies/local storage associated with the account that
// is actively in use. By default Puppeteer switches to basic auth instead.
const disabledPuppeteerArgs = ['--use-mock-keychain', '--password-store=basic'];

const lib = {

  logNotice: txt => console.log(wrap(txt)),
  logError: txt => console.error(wrap(colors.red(txt))),
  logPlugin: txt => console.log(wrap(colors.gray(
    `Message from plugin or site: ${txt}`))),

  // See above
  getWaitOptions(plugin) {
    return waitOptions[plugin] || ['load'];
  },

  // Get standard paths in OS-independent way
  get srcDir() {
    return path.join(__dirname, '..', 'extension', 'src');
  },

  get pluginDir() {
    return path.join(lib.srcDir, 'plugins');
  },

  get libDir() {
    return path.join(lib.srcDir, 'lib', 'js');
  },

  // See config/default.json5 for explanation. Returns undefined if not in use.
  get userDataDir() {
    if (config.get('useUserDataDir'))
      return path.join(os.homedir(), config.get('userDataDir'));
  },

  get puppeteerArgs() {
    return puppeteer
      .defaultArgs()
      .filter(arg => !disabledPuppeteerArgs.includes(arg));
  },

  logSiteList(logFn) {
    if (!logFn)
      logFn = console.log.bind(console);

    for (let site of sites) {
      logFn(`${site.name} - ${site.canonicalURL}`);
    }
  },

  async preparePlugin({ url, page, deps = [], plugin } = {}) {
    await page.setViewport({ width: 1280, height: 1024 });

    const addDep = async file =>
      await page.addScriptTag({ path: path.join(lib.libDir, `${file}.min.js`) });

    await page.goto(url, { waitUntil: lib.getWaitOptions(plugin) });

    page.on('console', msg => lib.logPlugin(msg._text));

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
    await page.addScriptTag({ path: path.join(lib.srcDir, 'dataset.js') });

    // For telling extension code not to send messages using the Chrome API
    await page.evaluate(() => {
      window.freeyourstuff.puppeteer = true;
    });

    // Shared helper code
    await page.addScriptTag({ path: path.join(lib.srcDir, 'plugin.js') });

    // The actual plugin
    const pluginPath = path.join(lib.pluginDir, plugin, 'index.js');
    await page.addScriptTag({ path: pluginPath });
  },

  // Exposed to plugins so they can let us know that we need to navigate
  getRedirectHandler(state) {
    return url => {
      state.redirect = true;
      state.url = url;
      lib.logNotice(`Redirecting to ${state.url} and restarting plugin.`);
    };
  }


};

module.exports = lib;
