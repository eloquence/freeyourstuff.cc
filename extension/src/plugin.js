// Support functions used by all plugins
'use strict';

var plugin = {
  // Pass a message back to the popup, or to the console if running in Node.js
  // mode.
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

  // Passes an error message with optional details back to the popup/console.
  // If provided, the popup will add a show/hide toggle event for the details,
  // as well as a link to a prefilled bug report with the details.
  reportError: function(html, details) {
    if (details) {
      if (typeof chrome !== 'undefined') {
        html = `<br>${html} <a id="showExtendedError" href="#"></a>
&middot; <a id="reportBug" href="#" target="_blank"></a>
<span id="extendedError"><br>${details}</span>`;
      } else {
        html = `${html}\n\n${details}`;
      }
    }
    this.report(html, true);
  },

  // Returns an error handler for XMLHttpRequest callbacks (native or jQuery)
  // Usage example:
  // $.get(someURL)
  //   .done(someHandler)
  //   .fail(plugin.handleConnectionError(someURL));
  handleConnectionError: function(url) {
    let handler = event => {
      let src, details = {};
      src = event.target || event;
      details.statusCode = src.status;
      details.statusText = src.statusText;
      details.url = url;
      this.reportError(`There was a problem connecting to the site.`,
        JSON.stringify(details, null, 2));
    };
    return handler;
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
  }

};

// Make sure references to 'this' point to the object defined above
plugin.handleConnectionError = plugin.handleConnectionError.bind(plugin);

if (typeof module !== 'undefined') {
  module.exports = plugin;
}
