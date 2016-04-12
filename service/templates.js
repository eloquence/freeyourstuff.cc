'use strict';
const fs = require('fs');
const ejs = require('ejs');

module.exports = loadTemplate;

function loadTemplate(filename) {
  let template = '';
  try {
    template = fs.readFileSync(filename);
  } catch (e) {
    console.warn('Problem reading template: ' + filename);
    console.warn(e.message);
  }
  template = template.toString('utf-8');
  try {
    template = ejs.compile(template, {
      filename
    });
  } catch (e) {
    console.warn('Problem compiling template: ' + filename);
    console.warn(e.message);
  }
  return template;
}
