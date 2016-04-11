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

  // Convenience function
  reportError: function(html) {
    this.report(html, true);
  }
};

if (typeof module !== 'undefined') {
  module.exports = plugin;
}
