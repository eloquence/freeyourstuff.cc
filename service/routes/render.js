'use strict';

function getStandardVars() {
  let signedIn = this.isAuthenticated();
  let userName;
  if (signedIn && this.session.method &&
    this.session.passport.user[this.session.method])
    userName = this.session.passport.user[this.session.method].displayName;
  let notifications = this.flash('once-notifications');
  let stv = {
    conf: this.app.config.expose(),
    signedIn,
    method: this.session.method,
    notifications,
    userName
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
