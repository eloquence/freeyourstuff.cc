/* global $ */
(function() {

  // This script needs to be loaded at the bottom of popup.html as it performs
  // changes to the DOM. It renders the little popup action and shows what
  // "stuff" is available for the current site. It then injects the general
  // content scripts plus any relevant plugins, and handles JSON data and
  // progress updates.
  //
  // We don't yet have the ability to handle media objects, which require
  // special treatment due to their size.
  'use strict';

  // The plugin sends a message to the popup once it is ready (i.e. document
  // fully loaded, listening for events).
  let pluginState;

  setupListeners();
  init();

  // Promise-based script injection. First injection needs to be called
  // like this: injectScript('filename')()
  function injectScript(file, skipDep) {
    if (!skipDep)
      return () => new Promise(resolve => chrome.tabs.executeScript({ file }, resolve));
    else
      return () => Promise.resolve(true);
  }

  // Promise-based convenience function to get active tab
  function getTab() {
    return new Promise(function(resolve) {
      chrome.tabs.query({
        active: true,
        currentWindow: true // Ensure we're in the right window
      }, tabs => resolve(tabs[0]));
    });
  }

  // autoRetrieve: if we want to fire the retrieve event, e.g. because the user was
  // redirected from another page
  function init(autoRetrieve) {
    // Ensure we have jQuery available before loading anything else
    injectScript('src/lib/js/jquery.min.js')()
      .then(injectScript('src/dataset.js'))
      .then(getTab)
      .then(tab => loadPlugin(tab, autoRetrieve))
      .catch(error => {
        // Deending on where the error occurred, we may not be able to render
        // it in the popup itself yet. So we show it on the console as well.
        console.error('There was a problem initializing the plugin:');
        console.error(error);
        showError({
          errorMessage: 'There was a problem initializing the plugin.',
          details: error.stack
        });
      });
  }


  function loadPlugin(tab, autoRetrieve) {
    // We show a list of supported sites on freeyourstuff.cc itself
    let renderDirectory = /^http(s)*:\/\/(dev\.)*freeyourstuff.cc/.test(tab.url);

    if (!renderDirectory) {

      // Prevent double initialization
      $('#retrieve').off();

      // Avoid repeated clicks by disabling
      $('#retrieve').attr('disabled', true);

      // Hide old errors
      $('#error').text('');

      // Render default popup
      $('#ui').show();
      $('#loading').hide();

    }

    // Identify the right plugin, display plugin data in popup, and inject
    // plugin into content. Also initializes schemas variable with the
    // schemas the plugin requires to get its work done.
    $.getJSON('/sites.json').done(sites => {

      if (renderDirectory) {
        let footer = $('#footer').html();
        $('#ui').html('<p>First, visit any of the following websites - then click this icon again to access your stuff:</p>');
        $('#ui').append('<ul id="directory"></ul>');
        $('#ui').append('<p>Thank you for using freeyourstuff.cc!</p>');
        $('#ui').append(`<div id="footer">${footer}</div>`);

        for (let site of sites) {
          $('#directory').append(`<li><a href="${site.canonicalURL}" target="_blank">${site.name}</a></li>`);
        }
        $('#ui').show();
        $('#loading').hide();
        return;
      }

      for (let site of sites) {
        if (tab.url.match(site.regex)) {

          if (!site.deps)
            site.deps = []; // for convenient access later

          $('#siteName').text(site.name);
          $('#availableContent').html('');
          $('#unsupportedContent').html('');
          site.supported.forEach((supportedContentType) => {
            $('#availableContent').append(`<li>${supportedContentType}</li>`);
          });
          site.unsupported.forEach((unsupportedContentType) => {
            $('#unsupportedContent').append(`<li>${unsupportedContentType}</li>`);
          });
          // Load schemas + initialize plugin
          $.getJSON(`/src/plugins/${site.plugin}/schema.json`).done(schema => {
            injectScript('/src/plugin.js')()
              .then(injectScript(`/src/lib/js/papaparse.min.js`, site.deps.indexOf('papaparse') == -1))
              .then(injectScript(`/src/lib/js/moment.min.js`, site.deps.indexOf('moment') == -1))
              .then(injectScript(`/src/lib/js/numeral.min.js`, site.deps.indexOf('numeral') == -1))
              .then(injectScript(`/src/plugins/${site.plugin}/index.js`))
              .then(() => awaitPluginLoadedAndReady())
              .then(() => {
                $('#progress').empty();
                $('#retrieve').click(getRetrievalHandler(site, schema, tab.id));
                $('#retrieve').attr('hidden', false);
                if (autoRetrieve) {
                  sendRetrievalMessage(schema, tab.id);
                } else
                  $('#retrieve').attr('disabled', false);
              })
              .catch(error => showError({
                errorMessage: 'There was a problem loading the plugin.',
                details: error.stack
              }));
          });
          break;
        }
      }
    });
  }

  function getRetrievalHandler(site, schema, tabId) {
    return () => {
      // Prevent repeated clicks
      $('#retrieve').attr('disabled', true);

      // Progress indicator
      $('#busy').show();

      // We need full cross-origin access, usually because we navigate around
      // on the site
      if (site.extraPermissions) {
        chrome.permissions.request({
          origins: [site.canonicalURL]
        }, granted => {
          if (granted) {
            sendRetrievalMessage(schema, tabId);
          } else {
            showError({
              errorMessage: `We need additional permissions to get your data for this site, sorry.`
            });
          }
        });
      } else {
        sendRetrievalMessage(schema, tabId);
      }
    };
  }

  function sendRetrievalMessage(schema, tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: 'retrieve',
      schema
    });
  }

  function setupListeners() {
    // Process content or progress updates
    chrome.runtime.onMessage.addListener((request, _sender) => {
      if (request.action == 'dispatch' && request.data) {
        $('#progress').empty();
      } else if (request.action == 'notice' && request.html) {
        // In case the popup has been closed in between progress updates,
        // we want to make sure the user doesn't trigger parallel download threads
        // by accident, so we re-disable again.
        $('#retrieve').attr('disabled', true);

        // Report progress
        $('#progress').html(request.html);
      } else if (request.action == 'notice-login') {
        let siteName = $('#siteName').text() || 'this website';
        showError({ errorMessage: `Please log into ${siteName} first.` });
        $('#retrieve').attr('disabled', false);
      } else if (request.action == 'clear') {
        $('#progress').empty();
        $('#error').empty();
      } else if (request.action == 'error' && request.errorMessage) {
        showError(request);
      } else if (request.action == 'redirect' && request.url) {
        redirect(request);
      } else if (request.action === 'send-plugin-state') {
        pluginState = request.pluginState;
        // Progress indicator
        if (pluginState.busy || !pluginState.loaded)
          $('#busy').show();
        else
          $('#busy').hide();
      }
    });
  }

  function showError({ errorMessage, details }) {
    const html = details ?
      `${errorMessage} ` +
      `<a id="showExtendedError" href="#"></a> ` +
      `&middot; <a id="reportBug" href="#" target="_blank"></a>` +
      `<span id="extendedError"><br>${details}</span>` :
      errorMessage;
    $('#error').html(html);
    if (details) {
      $('#showExtendedError').text('show/hide details');
      $('#reportBug').text('report bug');
      let siteParam = encodeURIComponent($('#siteName').text());
      let bodyParam = encodeURIComponent($('#extendedError').text());
      $('#reportBug').attr('href', `https://github.com/eloquence/freeyourstuff.cc/issues/new?title=Error with ${siteParam} plugin&body=${bodyParam}`);
      $('#showExtendedError').click(function() {
        $('#extendedError').toggle();
        return false;
      });
    }
    $('#retrieve').attr('disabled', false);
    $('#busy').hide();
  }

  // Redirect to a new URL and re-inject the plugin once the tab is loaded.
  // If autoRetrieve is truthy, same effect as user clicking the "Retrieve"
  // button in popup once redirect is complete.
  async function redirect({ autoRetrieve, url }) {
    let tab = await getTab();
    const l = (tabID, info) => {
      if (tabID === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(l);
        // Stop showing "Redirect" message once redirect is complete
        $('#progress').empty();
        // Fire plugin again
        init(autoRetrieve);
      }
    };
    chrome.tabs.onUpdated.addListener(l);
    chrome.tabs.update(tab.id, { url }, newTab => {
      tab = newTab;
    });
  }

  async function askPluginState() {
    const tab = await getTab();
    chrome.tabs.sendMessage(tab.id, {
      action: 'get-plugin-state'
    });
  }

  // The popup may be closed when the plugin sends messages, so we can't rely
  // on the state change handler alone when we need to know _for sure_ whether
  // the plugin is loaded is ready. Instead we poll the plugin for this info.
  function awaitPluginLoadedAndReady(interval = 50, timeout = 10000) {
    return new Promise((resolve, reject) => {
      pluginState = null;

      let i, elapsed = 0;
      const pollPlugin = () => {
        askPluginState();
        if (pluginState && pluginState.loaded && !pluginState.busy) {
          clearInterval(i);
          return resolve();
        }
        elapsed += interval;
        if (elapsed > timeout && pluginState === null)
          return reject(new Error(`Plugin was not loaded after ${timeout} milliseconds.`));
      };
      i = setInterval(pollPlugin, interval);
    });
  }

}());
