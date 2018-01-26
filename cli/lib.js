'use strict';
const { sites } = require('../service/load-schemas');

module.exports = {
  logSiteList(logFn) {
    if (!logFn)
      logFn = console.log.bind(console);

    for (let site of sites) {
      logFn(`${site.name} - ${site.canonicalURL}`);
    }
  }
};
