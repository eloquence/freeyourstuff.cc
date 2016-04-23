'use strict';

// JSON result comparison tests to be run by NodeJS/JSDOM test runner
var jsonTests = {
  reviews: retrieveReviews
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
  return Boolean($('.user-account .user-display-name').html());
}

function retrieveReviews(callback) {
  let page = 1;
  let reviews = {
    head: {},
    data: []
  };
  let firstURL = 'https://www.yelp.com/user_details_reviews_self';
  $.get(firstURL)
    .done(processPage)
    .fail(plugin.handleConnectionError(firstURL));

  function processPage(html) {
    try {
      let $dom = $($.parseHTML(html));
      if (page === 1) {
        let idLink = $dom.find('.user-display-name');
        reviews.head.reviewerName = idLink.text();
        reviews.head.reviewerID = (idLink.attr('href').match(/userid=(.*)/) || [])[1];
      }
      // Parse contents
      $dom.find('div.review').each((i, e) => {
        let $e = $(e);
        let text = $e
          .find('.review-content p')
          .first()
          .html();
        let subject = $e
          .find('.biz-name')
          .text();
        let subjectYelpURL;
        let base = 'https://yelp.com';
        let path = $e
          .find('.biz-name')
          .attr('href');
        if (path)
          subjectYelpURL = base + path;
        let qualifiers = $e
          .find('.rating-qualifier')
          .text(); // TODO: other qualifiers
        let date = (qualifiers.match(/(\d+\/\d+\/\d+)/) || [])[1];
        let starRating = (($e
          .find("[class^='star-img stars_']")
          .attr('class') || '')
          .match(/[0-9]/) || [])[0];

        let checkins = $e
          .find("[class$='checkin_c-common_sprite-wrap review-tag']")
          .text()
          .match(/\d+/) || undefined;

        let reviewObj = {
          subject,
          subjectYelpURL,
          date,
          text,
          starRating,
          checkins
        };

        reviews.data.push(reviewObj);
      });

      let nextURL = $dom.find('.pagination-links .next').attr('href');
      if (nextURL) {
        page++;
        // Obtain and relay progress info
        let totalPages = ($dom
          .find('.page-of-pages')
          .text()
          .match(/\d+.*?(\d+)/) || [])[1];
        plugin.report(`Fetching page ${page} of ${totalPages} &hellip;`);
        // Fetch next page
        $.get(nextURL)
          .done(processPage)
          .fail(plugin.handleConnectionError(nextURL));
      } else {
        callback(reviews);
      }
    } catch (error) {
      plugin.reportError(`An error occurred processing your reviews.`, error.stack);
    }
  }
}
