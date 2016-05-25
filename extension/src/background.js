(function() {
  'use strict';
  chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request) {
      if (request.message && request.message == "version") {
        sendResponse({
          version: chrome.runtime.getManifest().version
        });
      }
    }
    return true;
  });

  chrome.runtime.onMessage.addListener((request, sender) => {
    if (request.action == 'dispatch' && request.data && request.schema) {
      chrome.tabs.create({
        url: 'src/result.html',
        active: true
      }, tab => {
        function listener(newTab, newChange, newTabObj) {
          if (newTab === tab.id && newTabObj.status === 'complete') {
            chrome.runtime.sendMessage({
              action: 'display',
              data: request.data,
              schema: request.schema
            });
            chrome.tabs.onUpdated.removeListener(listener);
          }
        }
        chrome.tabs.onUpdated.addListener(listener);
      });
    }
  });
})();
