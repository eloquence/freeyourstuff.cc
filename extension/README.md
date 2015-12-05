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
