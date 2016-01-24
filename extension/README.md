# Tech notes
- We always use strict mode.
- We use the following [ES6](http://help.wtf/es6) features:
  - [Arrow functions](http://help.wtf/es6:arrow)
  - [Block scope variables](http://help.wtf/es6:block)
  - [Promises](http://help.wtf/es6:promise)
  - [Template literals](http://help.wtf/es6:template)
- We don't use [fetch()](http://devdocs.io/dom/globalfetch/fetch) yet
  which behaves very oddly in extensions (doesn't
  appear to allow requests to current site within content scripts, doesn't
  allow retrieving resources within the extension's own namespace). Instead
  we use jQuery's methods where jQuery is initialized and XMLHttpRequest
  otherwise.

## Dependencies

- We use jQuery for, well, everything.
- We use the DataTables library for table display, and Bootstrap for theming.

## Message passing

Chrome extensions rely heavily on message passing. Therein lies the source of
much confusion and many potential bugs. This extension has multiple components
that have to exchange messages:

1. the popup (the thing you open by clicking the extension icon on a supported
   site)
2. the event script (which runs in the background when needed to handle
  downloads, even when the popup is closed)
3. the content script (which performs the actual downloads with the user's
   credentials). Content scripts are bundled into plugins that are loaded for
   specific websites.
4. the result page (which lets the user preview a download, publish it, and make
   a local copy).

To ensure we can keep track of the different messages, each of them has an
`action` property. Here, we adopt the convention of all-lowercase names
separated by hyphens if necessary.

The three main actions that constitute a successful transaction are the
following:

- `retrieve` is sent to initiate a download
- `dispatch` is sent by the plugin to send back the actual data
  - the `data` property contains the data payload
- `display` is sent by the background script once dispatched data has been
  received. The event is handled by the result page, which is loaded in a
  new tab before `display` is sent.

In addition, plugins send the following actions for status updates or required
interventions.

- `notice` is used to send informational messages that do not represent
  an unrecoverable error
  - the `html` property indicates the message to be displayed
- `notice-login` is a built-in notice type we can send if the user must log in
  first. No additional payload is required.
- `error` is used for not obviously recoverable errors
  - the `html` property indicates the message to be displayed
- `redirect` is used to initiate a redirect to another URL in the active tab.
  Use sparingly as it disrupts the user experience.
  - The `url` property indicates the URL to redirect to.


# Style guide
- We use semicolons the way they were meant to be used.
- We don't wrap single line statements in blocks when we don't need to.
- Single quotes for strings except for strings containing single quotes
- We do use assignments in conditions, but wrap them in () to avoid linting
- issues and signal that they're intentional

# License
- We use CC-0, because we take the position that a world without copyright
  law would be better than the one we find ourselves in. Thus, we will not
  wield copyright as an instrument of power, even to support the cause of
  openness. See LICENSE for the necessary legalese.
