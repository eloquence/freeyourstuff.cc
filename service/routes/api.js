'use strict';
// External dependencies
let router = require('koa-route');

// Internal dependnecies
let collectionModels = require('../models/collections');
let User = require('../models/user');

module.exports = {
  nameCheck: router.get('/api/name', function* get(next) {
    if (!this.request.query.name) {
      this.body = {
        apiError: 'Must specify a username with ?name= parameter'
      };
      return yield next;
    }
    let user = yield User.findOne({
      'local.username': this.request.query.name.toUpperCase()
    });
    if (user)
      this.body = {
        userExists: user.local.displayName
      };
    else
      this.body = {
        userExists: false
      };
    return yield next;
  }),

  loginStatus: router.get('/api/loginstatus', function* get(next) {
    if (!this.isAuthenticated()) {
      this.body = {
        loggedIn: false
      };
    } else {
      this.body = {
        loggedIn: true,
        displayName: this.session.passport.user[this.session.method].displayName,
        method: this.session.method
      };
    }
    return yield next;
  }),

  collection_POST: router.post('/api/collection', function* post(next) {
    if (!apiSignedIn(this))
      return yield next;

    let c = this.request.body;

    if (!apiValidateCollection(this, c))
      return yield next;

    for (var i = 0; i < collectionModels.length; i++) {
      if (c.schemaName === collectionModels[i].modelName) {
        if (c.reviews) {
          if (!apiValidateDataset(this, c.reviews))
            return yield next;
          let collection = new collectionModels[i]();
          collection.reviews = c.reviews;
          try {
            yield collection.save();
          } catch (e) {
            apiDBError(this, e);
            return yield next;
          }
          apiReportSuccess(this);
          return yield next;
        }
      }
    }

    this.body = {
      error: 'Unknown schema: ' + c.schemaName
    };
    return yield next;

  })

};

function apiSignedIn(ctx) {
  if (!ctx.isAuthenticated()) {
    ctx.body = {
      error: 'You must be signed in to upload documents.'
    };
    ctx.status = 401;
    return false;
  }
  return true;
}

function apiDBError(ctx, error) {
  if (error.name === 'ValidationError') {
    ctx.body = {
      error: 'Data did not match the expected schema.'
    };
    ctx.status = 400;
  } else {
    ctx.body = {
      error: 'Unknown problem saving/parsing the data. Could be an issue on our end. Sorry! :('
    };
    ctx.status = 500;
  }
}

function apiValidateCollection(ctx, collection) {
  if (!collection.schemaVersion || !collection.schemaName) {
    ctx.body = {
      error: 'Not a valid schema, must have a schemaVersion and schemaName.'
    };
    ctx.status = 400;
    return false;
  }
  return true;
}

function apiValidateDataset(ctx, dataset) {
  if (!dataset.data || !dataset.head || typeof dataset.head !== 'object' ||
    !Array.isArray(dataset.data)) {
    ctx.body = {
      error: 'Not a valid dataset, must have a head object and data array.'
    };
    ctx.status = 400;
    return false;
  } else
    return true;
}

function apiReportSuccess(ctx) {
  ctx.body = {
    message: 'Thank you for your contribution. You have made a simple API very happy.'
  };
  ctx.status = 200;
}
