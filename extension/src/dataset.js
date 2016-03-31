'use strict';
// This function can be used as a Node module for testing purposes.
// let DataSet = require('dataset.js')
if (typeof module !== 'undefined') {
  module.exports = DataSet;
}

// JSON schema is both too simplistic (primitives without validation) and too
// complex for our needs. DataSet gives us a simple way to manage tabular data
// with headers, descriptive information and strong types, easy to serialize
// into multiple forms.
//
// We group DataSets into what we call SiteSets, since any site can have multiple
// DataSets associated with it. Schemas exist at the level of SiteSets, so we do
// not end up with too many separate schema versions for a single site.
//
// - dataObj: Object of the form { head: { header object }, data: { data object } }
// - schemaObj: Object that describes and types fields in header and data objects
function DataSet(dataObj, schemaObj) {
  // Type constants
  const TEXT = 'text';
  const HTML = 'html';
  const WEBURL = 'weburl'; // Technically FTP is permitted for legacy reasons
  const NUMBER = 'number';
  const DATE = 'date';
  const BOOLEAN = 'boolean';

  let key;
  let self = this;
  self.set = { head: {}, data: [] };

  // Load data into the instance's internal representation. In the process,
  // coerce data into the required types.
  for (key in dataObj.head)
    load('head', key);

  dataObj.data.forEach((object, row) => {
    for (key in object)
      load('data', key, row);
  });

  // Will throw an error if data does not match the format described in the
  // schema.
  function load(section, key, row) {
    if (schemaObj[section][key]) {
      if (row !== undefined) {
        if (self.set[section][row] === undefined)
          self.set[section][row] = {};
        self.set[section][row][key] =
          coerce(dataObj[section][row][key], schemaObj[section][key].type);
      } else
        self.set[section][key] =
          coerce(dataObj[section][key], schemaObj[section][key].type);
    }
    else {
      throw new Error(`Parse error against schema "${schemaObj.label.en}".
Attempted data import with unknown key in section "${section}": "${key}"`);
    }
  }

  // Ensure that a value is of a given type. Ignores null or undefined values.
  // May throw an error otherwise.
  function coerce(value, type) {
    if (value === null || value === undefined) return value;
    switch (type) {
      case TEXT:
        return escapeHTML(String(value));
      case HTML:
        return String(value);
      case WEBURL:
        value = String(value);
        if (!validateURL(value))
          throw new Error(`Value "${value}" should be a qualified web or FTP URL, but is not.`);
        return String(value);
      case NUMBER:
        return Number(value);
      case DATE:
        return new Date(value).toLocaleDateString();
      case BOOLEAN:
        return Boolean(value);
    }
    return value;
  }

  // true for FTP or HTTP URLs (crazy new TLDs are fine but numeric ones are not)
  function validateURL(value){
    return /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(value);
  }

  // Escape HTML control characters
  function escapeHTML(text) {
    return text.replace(/[\"&'\/<>]/g, function (a) {
        return {
            '"': '&quot;', '&': '&amp;', "'": '&#39;',
            '/': '&#47;',  '<': '&lt;',  '>': '&gt;'
        }[a];
    });
  }
}
