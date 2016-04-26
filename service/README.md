This is a Node/Koa service for publishing datasets using the freeyourstuff.cc Chrome extension. It's still pretty minimal, it currently implements:

- a landing page and some additional page content
- a signup/register flow with support for Twitter, Facebook, Google & local signup
- a very rough API to stash data in MongoDB
- basic routes for viewing collections and showing most recently uploaded ones

To run the service, you have to
- create a copy of `defaultConfig.json` called `config.json` and adapt the config settings
- run `npm install` to install required dependencies and build static assets

Main TODOs right now:

- more security vetting
- add better library browse features
- deploy/build fundamentals
