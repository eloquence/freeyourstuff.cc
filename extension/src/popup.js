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
  var schemas = {};

  init();
  setupListeners();

  // Promise-based script injection. First injection needs to be called
  // like this: injectScript('filename')()
  function injectScript(file) {
    return () => {
      return new Promise((resolve) => {
        chrome.tabs.executeScript({
          file
        }, function(result) {
          resolve(result);
        });
      });
    };
  }

  // Promise-based convenience function to get active tab
  function getTab() {
    return new Promise(function(resolve) {
      chrome.tabs.query({
        active: true,
        lastFocusedWindow: true // Ensure we're in the right window
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
    injectScript('src/lib/jquery-2.1.4.min.js')()
      .then(injectScript('src/dataset.js'));

    getTab()
      .then((tab) => {
        // This click handler isn't visible yet til all the necessary prep work
        // is done.
        if (newTab)
          tab = newTab;

        $('#retrieve').off(); // prevent double initialization
        $('#retrieve').click(() => {
          // Tells listener in content.js to perform a download action
          chrome.tabs.sendMessage(tab.id, {
            action: "retrieve",
            schemas
          });
          // Avoid repeated clicks by disabling
          $('#retrieve').attr('disabled', true);
          // Hide old download link in case of repeated download
          $('#download').attr('hidden', true);
          // Hide old errors
          $('#error').text('');
        });

        // Identify the right plugin, display plugin data in popup, and inject
        // plugin into content. Also initializes schemas variable with the
        // schemas the plugin requires to get its work done.
        $.getJSON("/sites.json").done(sites => {
          for (let site of sites) {
            if (tab.url.match(site.regex)) {
              $('#siteName').text(site.name);
              fileName = site.name.toLowerCase().replace(/ /g, '_') + '.json';
              $('#availableContent').html('');
              $('#unsupportedContent').html('');
              site.supported.forEach((supportedContentType) => {
                $('#availableContent').append('<li>' + supportedContentType + '</li>');
              });
              site.unsupported.forEach((unsupportedContentType) => {
                $('#unsupportedContent').append('<li>' + unsupportedContentType + '</li>');
              });

              // Load schemas + initialize plugin
              $.getJSON(`/src/plugins/${site.plugin}/schemas.json`).done(data => {
                schemas = data;
                injectScript(`/src/plugins/${site.plugin}/index.js`)().then(() => {
                  $('#retrieve').attr('hidden', false);
                  $('#retrieve').attr('disabled', false);
                  if(autoRetrieve)
                    $('#retrieve').click();
                });
              });
              break;
            }
          }
        });
      });
  }

  function setupListeners() {
    // Process content or progress updates
    chrome.runtime.onMessage.addListener((request, sender) => {
      if (request.datasets) {
        $('#progress').text('');
        let json = JSON.stringify(request.datasets, null, 2);
        // We need to URI-encode it so we can stash it into the href attribute
        let encodedJSON = encodeURIComponent(json);
        $('#download').attr('hidden', false);
        $('#download').attr('href', 'data:application/json;charset=utf-8,' + encodedJSON);
        $('#download').attr('download', (fileName || 'data.json'));
        $('#retrieve').attr('disabled', false);
      } else if (request.progress) {
        // In case the popup has been closed in between progress updates,
        // we want to make sure the user doesn't trigger parallel download threads
        // by accident, so we re-disable again.
        $('#retrieve').attr('disabled', true);

        // Report progress
        $('#progress').html(request.progress);
      } else if (request.loggedOut) {
        let siteName = $('#siteName').text() || 'this website';
        $('#error').html(`Please log into ${siteName} first.`);
        $('#retrieve').attr('disabled', false);
      } else if (request.error) {
        $('#error').html(request.error);
        $('#retrieve').attr('disabled', false);
      } else if (request.redirect) {
        var autoRetrieve = request.autoRetrieve;
        getTab().then((tab) => {
          chrome.tabs.update(tab.id, {
            url: request.redirect
          }, () => {
            let listener = function() {
              if (tab.status === 'complete') {
                init(tab, autoRetrieve);
                chrome.tabs.onUpdated.removeListener(listener);
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
        });
      }
    });
  }
}());
