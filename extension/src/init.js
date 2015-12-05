'use strict';

// We use a page state matcher to show a page icon on supported pages
function replaceRules() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    let req = new XMLHttpRequest(); // Sadly fetch() doesn't work for extensions
    req.open('GET', 'sites.json', true);
    req.send();
    req.addEventListener('load', function() {
      let sites = JSON.parse(this.responseText);
      let conditions = [];
      for (let site of sites) {
        conditions.push(
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
              urlMatches: site.regex
            }
          })
        );
      }
      let rules = {
        conditions,
        actions: [new chrome.declarativeContent.ShowPageAction()]
      };
      chrome.declarativeContent.onPageChanged.addRules([rules]);
    });
  });
}

if (chrome.extension.inIncognitoContext) {
  // https://code.google.com/p/chromium/issues/detail?id=408326
  replaceRules();
} else {
  // Update the declarative rules on install or upgrade.
  chrome.runtime.onInstalled.addListener(replaceRules);
}
