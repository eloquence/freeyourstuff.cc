'use strict';

function getStandardVars() {
  let user = this.isAuthenticated() && this.session.passport.user ?
    this.session.passport.user : null;
  let notifications = this.flash('once-notifications');
  let stv = {
    conf: this.app.config.expose(),
    user,
    method: this.session.method,
    notifications,
  };
  return stv;
}

function render(template, extraVars) {
  let vars = getStandardVars.call(this);
  if (extraVars)
    Object.assign(vars, extraVars);
  this.body = this.app.templates[template](vars);
}

module.exports = render;