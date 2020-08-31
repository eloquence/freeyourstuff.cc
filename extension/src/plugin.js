// Support functions used by all plugins
/* global $ */
(function() {

  'use strict';

  initGlobals();


  function initGlobals() {

    // Namespace to ensure safe injection even via Puppeteer
    if (window.freeyourstuff === undefined)
      window.freeyourstuff = {};

    // For variables that are persistent across multiple injections of the plugin
    if (window.freeyourstuff.plugin === undefined) {

      window.freeyourstuff.pluginState = {
        loaded: false,
        busy: false
      };

      window.freeyourstuff.pluginListeners = [];

      // Set only once to access the persistent state
      if (useExtensionAPI())
        chrome.runtime.onMessage.addListener(request => {
          if (request.action == 'get-plugin-state')
            window.freeyourstuff.plugin.sendState();
        });
    }
  }

  const freeyourstuff = window.freeyourstuff;

  // Will get overwritten each time the popup is opened. This is
  // by design and makes it easier to test development changes.
  const plugin = freeyourstuff.plugin = {
    // Pass a message back to the popup, or to the console if running in Node.js
    // mode.
    report: function(html) {
      if (useExtensionAPI())
        chrome.runtime.sendMessage({
          action: 'notice',
          html
        });
      else
        console.log('Progress update: ' + html);
    },

    // Clear notices and errors
    clearMessages: function() {
      if (useExtensionAPI())
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

      if (useExtensionAPI())
        chrome.runtime.sendMessage({
          action: 'error',
          errorMessage,
          details
        });
      else
        console.error(errorMessage, details);
      plugin.done();
    },

    // Returns an error handler for XMLHttpRequest callbacks (native or jQuery)
    // Usage example:
    // $.get(someURL)
    //   .done(someHandler)
    //   .fail(plugin.handleConnectionError(someURL));
    handleConnectionError: function(url) {
      const handler = event =>
        plugin.reportError(plugin.getConnectionError(url, event));
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
      selectors = selectors.map(selector => plugin.awaitSelector(selector, interval, timeout));
      await Promise.all(selectors);
    },

    awaitCondition: function(conditionFn, interval = 50, timeout = 10000) {
      return new Promise((resolve, reject) => {

        let i, elapsed = 0;

        const checkCondition = () => {
            if (conditionFn()) {
              clearInterval(i);
              return resolve();
            }
            elapsed += interval;
            if (elapsed > timeout) {
              clearInterval(i);
              return reject(new Error(`Specified page layout condition was not reached within ${timeout} milliseconds.`));
            }

        };
        i= setInterval(checkCondition, interval);

      });

    },

    // Tell the popup to say that the user has to log in (the popup also shows
    // the site name)
    loggedOut: function() {
      if (useExtensionAPI())
        chrome.runtime.sendMessage({
          action: 'notice-login'
        });
      else
        console.log('User does not appear to be logged in.');

      plugin.done();
    },

    // Move to a new page and (by default) re-start the plugin
    redirect: function(url, autoRetrieve = true) {
      if (useExtensionAPI()) {
        chrome.runtime.sendMessage({
          action: 'redirect',
          url,
          autoRetrieve
        });
      }
      else if (usePuppeteer()) {
        window.puppeteerRedirect(url);
      }
      else
        console.log('Redirection not implemented.');
    },

    // State functions. Loading: waiting for page to be ready. Loaded: page is
    // ready. Busy: Plugin is doing stuff. Done: Plugin is done doing stuff.
    loading() {
      freeyourstuff.pluginState.loaded = false;
      plugin.sendState();
    },

    loaded() {
      freeyourstuff.pluginState.loaded = true;
      plugin.sendState();
    },

    busy() {
      freeyourstuff.pluginState.busy = true;
      plugin.sendState();
    },

    done() {
      freeyourstuff.pluginState.busy = false;
      plugin.sendState();
    },

    sendState() {
      if (useExtensionAPI())
        chrome.runtime.sendMessage({
          action: 'send-plugin-state',
          pluginState: freeyourstuff.pluginState
        });
    },

    // Simple timeout helper
    waitFor(delay) {
      return new Promise(resolve => setTimeout(resolve, delay));
    },

    // Remove message listeners from previous injection, then setup listeners
    // for this plugin
    setup(listeners) {
      if (!useExtensionAPI())
        return false;

      plugin.loading();
      $(document).ready(() => {
        for (let listener of freeyourstuff.pluginListeners)
          chrome.runtime.onMessage.removeListener(listener);

        for (let listener of listeners)
          chrome.runtime.onMessage.addListener(listener);

        plugin.loaded();
        freeyourstuff.pluginListeners = listeners;
      });
    },

    // Simple helper for async functions
    getURL(url, params) {
      return new Promise((resolve, reject) =>
        $.get(url, params)
        .done(resolve)
        .fail(event => reject(plugin.getConnectionError(url, event))));
    },

    getResponseURL(url) {
      return new Promise((resolve, reject) => {
        // We use XMLHttpRequest here because jQuery does not expose responseURL,
        // due to limited support for it; see https://bugs.jquery.com/ticket/15173
        const req = new XMLHttpRequest();
        req.addEventListener('load', function() {
          const response = this;
          resolve(response.responseURL);
        });
        req.addEventListener('error', function(event) {
          const error = plugin.getConnectionError(url, event);
          reject(error);
        });
        req.open('GET', url);
        req.send();
      });
    },

    getConnectionError(url, event, message = 'Connection error.') {
      const error = new Error(message);
      error.details = plugin.getConnectionErrorDetails(url, event);
      return error;
    },

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

  };

  function useExtensionAPI() {
    return typeof chrome !== 'undefined' && !window.freeyourstuff.puppeteer;
  }

  function usePuppeteer() {
    return window.freeyourstuff.puppeteer === true;
  }

})();
