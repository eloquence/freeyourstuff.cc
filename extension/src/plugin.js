// Support functions used by all plugins
/* global $ */
(function() {

  'use strict';
  // The pluginState and pluginListeners variables are persistent across multiple
  // injections of the plugin.
  if (typeof window.pluginState != 'object') {
    window.pluginState = {
      loaded: false,
      busy: false
    };

    // We don't have to reset this listener for multiple injections, since it only
    // returns the persistent state object
    if (typeof chrome !== 'undefined')
      chrome.runtime.onMessage.addListener(request => {
        if (request.action == 'get-plugin-state')
          window.plugin.sendState();
      });
  }

  if (typeof window.pluginListeners != 'object')
    window.pluginListeners = [];

  // Will get overwritten each time the popup is opened. This is
  // by design and makes it easier to test development changes.
  window.plugin = {
    // Pass a message back to the popup, or to the console if running in Node.js
    // mode.
    report: function(html) {
      if (typeof chrome !== 'undefined')
        chrome.runtime.sendMessage({
          action: 'notice',
          html
        });
      else
        console.log('Progress update: ' + html);
    },

    // Clear notices and errors
    clearMessages: function() {
      if (typeof chrome !== 'undefined')
        chrome.runtime.sendMessage({ action: 'clear' });
    },

    // Abort with an error. The "Retrieve" button will be enabled again in the
    // popup.
    reportError: function(error, errorMessage = 'There was a problem retrieving your contributions.') {
      let details = '';
      if (error && typeof error == 'object') {
        if (error.stack)
          details += error.stack;
        if (error.details)
          details += '<br>Additional details: ' + error.details;
      }

      if (typeof chrome !== 'undefined')
        chrome.runtime.sendMessage({
          action: 'error',
          errorMessage,
          details
        });
      else
        console.error(errorMessage, details);
      window.plugin.done();
    },

    // Returns an error handler for XMLHttpRequest callbacks (native or jQuery)
    // Usage example:
    // $.get(someURL)
    //   .done(someHandler)
    //   .fail(plugin.handleConnectionError(someURL));
    handleConnectionError: function(url) {
      const handler = event =>
        window.plugin.reportError(window.plugin.getConnectionError(url, event));
      return handler;
    },

    getConnectionErrorDetails: function(url, event) {
      const src = event.target || event,
        details = {};
      details.statusCode = src.status;
      details.statusText = src.statusText;
      details.url = url;
      return JSON.stringify(details, null, 2);
    },

    // Converts date formats recognized by Date.parse() to ISO date, _without_
    // time (time is set to midnight UTC for the given date). Returns null
    // for unrecognized/invalid dates.
    getISODate: function(string) {
      if (/^\d\d\d\d-\d\d-\d\d$/.test(string)) // Already ISO. Double conversion could mess with timezone
        return string;

      let date = new Date(string);

      if (date.toString() === 'Invalid Date')
        return null;

      if (date.getFullYear() > 9999)
        return null;

      let utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      return utcDate.toISOString().slice(0, 10);
    },

    // Wait up to the specified amount of time for a jQuery selector to return
    // at least one element. Useful for pages that are dynamically modified
    // even after document.readyState == 'complete'. Returns a promise that
    // rejects with an error if timeout is exceeded.
    awaitSelector: function(selector, interval = 50, timeout = 10000) {
      return new Promise((resolve, reject) => {

        let i, elapsed = 0;

        const checkSelector = () => {
          const selectorExists = $(selector).length !== 0;
          if (selectorExists) {
            clearInterval(i);
            return resolve();
          }
          elapsed += interval;
          if (elapsed > timeout) {
            clearInterval(i);
            return reject(new Error(`Elements matching selector "${selector}" were not loaded ater ${timeout} milliseconds.`));
          }

        };
        i = setInterval(checkSelector, interval);
      });
    },

    // When checking multiple elements, it is best to split the calls so we don't
    // have to specify an exact count per selector, and can report which one
    // specifically failed to load. selectors is an array of jQuery selector
    // strings.
    awaitSelectors: async function(selectors, interval, timeout) {
      selectors = selectors.map(selector => window.plugin.awaitSelector(selector, interval, timeout));
      await Promise.all(selectors);
    },

    // Tell the popup to say that the user has to log in (the popup also shows
    // the site name)
    loggedOut: function() {
      chrome.runtime.sendMessage({
        action: 'notice-login'
      });
      window.plugin.done();
    },

    // State functions. Loading: waiting for page to be ready. Loaded: page is
    // ready. Busy: Plugin is doing stuff. Done: Plugin is done doing stuff.
    loading() {
      window.pluginState.loaded = false;
      window.plugin.sendState();
    },

    loaded() {
      window.pluginState.loaded = true;
      window.plugin.sendState();
    },

    busy() {
      window.pluginState.busy = true;
      window.plugin.sendState();
    },

    done() {
      window.pluginState.busy = false;
      window.plugin.sendState();
    },

    sendState() {
      if (typeof chrome !== 'undefined')
        chrome.runtime.sendMessage({
          action: 'send-plugin-state',
          pluginState: window.pluginState
        });
    },

    // Simple timeout helper
    waitFor(delay) {
      return new Promise(resolve => setTimeout(resolve, delay));
    },

    // Remove message listeners from previous injection, then setup listeners
    // for this plugin
    setup(listeners) {
      if (typeof chrome === 'undefined')
        return false;

      window.plugin.loading();
      $(document).ready(() => {
        for (let listener of window.pluginListeners)
          chrome.runtime.onMessage.removeListener(listener);

        for (let listener of listeners)
          chrome.runtime.onMessage.addListener(listener);

        window.plugin.loaded();
        window.pluginListeners = listeners;
      });
    },

    // Simple helper for async functions
    getURL(url, params) {
      return new Promise((resolve, reject) =>
        $.get(url, params)
        .done(resolve)
        .fail(event => reject(window.plugin.getConnectionError(url, event))));
    },

    getConnectionError(url, event, message = 'Connection error.') {
      const error = new Error(message);
      error.details = window.plugin.getConnectionErrorDetails(url, event);
      return error;
    }

  };
})();
