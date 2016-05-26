'use strict';
// Result comparison tests to be run by NodeJS/JSDOM test runner
var jsonTests = {
  reviews: retrieveReviews,
};

if (typeof init === 'undefined')
  var init = false;

// For execution in browser
if (typeof chrome !== 'undefined' && !init)
  setupExtensionEvents();

function setupExtensionEvents() {
  chrome.runtime.onMessage.addListener(request => {
    if (request.action == 'retrieve') {
      if (!loggedIn()) {
        chrome.runtime.sendMessage({
          action: 'notice-login'
        });
        return false;
      }
      let datasets = {};
      datasets.schemaKey = request.schema.schema.key;
      datasets.schemaVersion = request.schema.schema.version;
      retrieveReviews(reviews => {
        datasets.reviews = new DataSet(reviews, request.schema.reviews).set;
        chrome.runtime.sendMessage({
          action: 'dispatch',
          data: datasets,
          schema: request.schema
        });
      });
    }
  });
  // Prevent repeated initialization
  init = true;
}

function loggedIn() {
  return Boolean($('.headerPersonalNav').length);
}

// When running in an extension context, we can usually just look at the page
// we're on to find the profile URL. When running in Node, we need to get at
// least one Goodreads page first to extract it. This is also a nice fallback for
// pages which don't have the profile link on them (e.g., error pages).
function getHead(callback) {
  let head = extractHeadInfo();
  let mainURL = 'https://www.goodreads.com/';
  if (head) {
    callback(head);
  } else {
    $.get(mainURL)
      .done(function(html) {
        head = extractHeadInfoFromHTML(html);
        if (head)
          callback(head);
        else
          plugin.reportError('Could not find your Goodreads profile.');
      })
      .fail(plugin.handleConnectionError(mainURL));
  }
}

// Extract user ID and name from the current page.
function extractHeadInfo(pageDocument) {

  let profileLink = $(pageDocument).find('.dropdown__menu--profileMenu li a').first().attr('href') || '';
  let reviewerID = (profileLink.match(/\/user\/show\/([0-9]+)/) || [])[1];
  let reviewerName = $(pageDocument).find('.headerPersonalNav .circularIcon').first().attr('alt');

  let head = {
    reviewerID,
    reviewerName
  };
  // Reviewer name is optional; reviewer ID is required for successful operation
  return reviewerID ? head : null;
}

// Extract user ID and name from the raw HTML of a page
function extractHeadInfoFromHTML(html) {
  let matches = html.match(/"currentUser":{"name":"(.*)","profileUrl":"\/user\/show\/([0-9]+)/);
  return matches === null || matches[2] === undefined ? null :
  {
    reviewerID: matches[2],
    reviewerName: matches[1]
  };
}

function retrieveReviews(callback) {
  let reviews = {
    head: {},
    data: []
  };

  getHead(head => {

    plugin.report('Launching export &hellip;');
    reviews.head = head;
    let importURL = 'https://www.goodreads.com/review/import/';
    $.get(importURL)
      .done(html => {
        let $dom = $($.parseHTML(html));
        let token = $dom.filter('meta[name="csrf-token"]').attr('content');
        let exportURL = `https://www.goodreads.com/review_porter/export/${head.reviewerID}`;
        $.ajax({
          type: 'POST',
          url: exportURL,
          headers: {
            'X-CSRF-Token': token
          },
          data: {
            format: 'json'
          }
        })
        .done(() => {
          plugin.report('Waiting for export to complete &hellip;');
          // We now have to ping repeatedly to see if the export has been produced
          let csvURL = `https://www.goodreads.com/review_porter/export/${head.reviewerID}/goodreads_export.csv`;
          let tries = 0, maxTries = 50, done = false;
          let interval = setInterval(() => {
            tries++;
            $.ajax({
              type: 'HEAD',
              url: csvURL
            })
            .done(() => {
              if (done)
                return;
              done = true;
              plugin.report('Downloading &hellip;');
              clearInterval(interval);
              // Yay, we can parse it now
              Papa.parse(csvURL, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(results) {

                  // We want reviews and ratings, so removing all other rows
                  let filteredResults = results.data.filter(ele => {
                    return ele['Book Id'] && (ele['My Rating'] !== '0' || ele['My Review']);
                  });

                  reviews.data = filteredResults.map(ele => {
                    // We're using only the parts of the CSV which are the user's own work.
                    return {
                      subject: ele.Title || undefined,
                      subjectGoodreadsURL: `https://www.goodreads.com/book/show/${ele['Book Id']}`,
                      author: ele.Author || undefined,
                      additionalAuthors: ele['Additional Authors'] || undefined,
                      starRating: ele['My Rating'] || undefined,
                      dateAdded: plugin.getISODate(ele['Date Added']) || undefined,
                      dateRead: plugin.getISODate(ele['Date Read']) || undefined,
                      review: ele['My Review'] || undefined
                    };
                  });
                  callback(reviews);
                },
                error: plugin.handleConnectionError(csvURL)
              });

            })
            .fail(() => {
              if (tries >= maxTries) {
                clearInterval(interval);
                plugin.reportError('Export timed out. :-(');
              }
            });
          }, 500);
        })
        .fail(plugin.handleConnectionError(exportURL));
      })
      .fail(plugin.handleConnectionError(importURL));

  });
}
