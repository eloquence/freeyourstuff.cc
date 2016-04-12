// Support functions used by all plugins
'use strict';
var plugin = {
  report: function(html, error) {
    if (typeof chrome !== 'undefined') {
      chrome.runtime.sendMessage({
        action: error ? 'error' : 'notice',
        html
      });
    } else {
      if (error)
        console.error('Error: ' + html);
      else
        console.log('Progress update: ' + html);
    }
  },

  reportError: function(html, stack) {
    if (stack) {
      if (typeof chrome !== 'undefined') {
        html = `<br>${html} <a id="showExtendedError" href="#"></a>
&middot; <a id="reportBug" href="#" target="_blank"></a>
<span id="extendedError"><br>${stack}</span>`;
      } else {
        html = `${html}\n\n${stack}`;
      }
    }
    this.report(html, true);
  },
};

if (typeof module !== 'undefined') {
  module.exports = plugin;
}
