'use strict';

// Variables that are exposed to all EJS templates, including flash notifications
function getStandardVars() {
  let user = this.isAuthenticated() && this.req.user ?
    this.req.user : null;
  let notifications = this.flash('once-notifications');
  let stv = {
    cssFile: (file, raw) => process.env.NODE_ENV === 'production' && !raw ?
      `/static/css/${file}.min.css` : `/static/css/${file}.css`,
    jsFile: (file, raw) => process.env.NODE_ENV === 'production' && !raw ?
      `/static/js/${file}.min.js` : `/static/js/${file}.js`,
    conf: this.app.config.expose(),
    user,
    method: this.session.method,
    notifications,
  };
  return stv;
}

// Render a given template, optionally with additional exposed variables
function render(template, extraVars) {
  let vars = getStandardVars.call(this);
  if (extraVars)
    Object.assign(vars, extraVars);
  this.body = this.app.templates[template](vars);
}

module.exports = render;
