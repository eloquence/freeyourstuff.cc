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

  var fileName = '';
  var schema = {};

  init();
  setupListeners();

  // Promise-based script injection. First injection needs to be called
  // like this: injectScript('filename')()
  function injectScript(file, skipDep) {
    if (!skipDep) {
      return () => {
        return new Promise((resolve) => {
          chrome.tabs.executeScript({
            file
          }, function(result) {
            resolve(result);
          });
        });
      };
    } else {
      return () => {};
    }
  }

  // Promise-based convenience function to get active tab
  function getTab() {
    return new Promise(function(resolve) {
      chrome.tabs.query({
        active: true,
        currentWindow: true // Ensure we're in the right window
      }, function(tabs) {
        resolve(tabs[0]);
      });
    });
  }


  // newTab: if our tab context has changed but we need to reinsert the script,
  // we can pass a tab object
  //
  // autoRetrieve: if we want to fire the retrieve event, e.g. because the user was
  // redirected from another page
  function init(newTab, autoRetrieve) {
    // Ensure we have jQuery available before loading anything else
    injectScript('src/lib/js/jquery-2.1.4.min.js')()
      .then(injectScript('src/dataset.js'))
      .then(getTab)
      .then(tab => {

        if (newTab)
          tab = newTab;

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
        $.getJSON("/sites.json").done(sites => {

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
              fileName = site.name.toLowerCase().replace(/ /g, '_') + '.json';
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
                  .then(injectScript(`/src/plugins/${site.plugin}/index.js`))
                  .then(() => {
                    $('#retrieve').click(getRetrievalHandler(site, schema, tab.id));
                    $('#retrieve').attr('hidden', false);
                    if (autoRetrieve) {
                      sendRetrievalMessage(schema, tab.id);
                    } else {
                      $('#retrieve').attr('disabled', false);
                    }
                  });
              });
              break;
            }
          }
        });
      });
  }

  function getRetrievalHandler(site, schema, tabId) {
    return () => {
      // Prevent repeated clicks
      $('#retrieve').attr('disabled', true);
      // We need full cross-origin access, usually because we navigate around
      // on the site
      if (site.extraPermissions) {
        chrome.permissions.request({
          origins: [site.canonicalURL]
        }, granted => {
          if (granted) {
            sendRetrievalMessage(schema, tabId);
          } else {
            $('#error').html(`We need additional permissions to get your data for this site, sorry.`);
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
    chrome.runtime.onMessage.addListener((request, sender) => {
      if (request.action == 'dispatch' && request.data) {
        $('#progress').text('');
      } else if (request.action == 'notice' && request.html) {
        // In case the popup has been closed in between progress updates,
        // we want to make sure the user doesn't trigger parallel download threads
        // by accident, so we re-disable again.
        $('#retrieve').attr('disabled', true);

        // Report progress
        $('#progress').html(request.html);
      } else if (request.action == 'notice-login') {
        let siteName = $('#siteName').text() || 'this website';
        $('#error').html(`Please log into ${siteName} first.`);
        $('#retrieve').attr('disabled', false);
      } else if (request.action == 'error' && request.html) {
        $('#error').html(request.html);
        if ($('#showExtendedError').length && $('#reportBug').length) {
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
      } else if (request.action == 'redirect' && request.url) {
        var autoRetrieve = request.autoRetrieve;
        getTab().then((tab) => {
          chrome.tabs.update(tab.id, {
            url: request.url
          }, () => {
            let listener = function() {
              if (tab.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                let delay = request.delay || 0;
                if (delay > 0)
                  $('#progress').html('Giving page time to finish loading &hellip;');
                setTimeout(() => {
                  init(tab, autoRetrieve);
                }, delay);
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
        });
      }
    });
  }
}());
