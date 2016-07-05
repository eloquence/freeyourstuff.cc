'use strict';
// Result comparison tests to be run by NodeJS/JSDOM test runner
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
      if (window.location.protocol == 'http:') {
        plugin.reportError('Please visit <a href="https://www.amazon.com/" target="_blank">the HTTPS version</a> of Amazon.com.');
        init = false;
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
  return !Boolean($('#nav-flyout-ya-signin').length);
}

function retrieveReviews(callback) {
  let reviews = {
    head: {},
    data: []
  };
  let currentPage = 0;
  let profileURL = 'https://www.amazon.com/gp/profile/';

  plugin.report('Fetching your profile info &hellip;');
  // We use XMLHttpRequest here because jQuery does not expose responseURL,
  // due to limited support for it; see https://bugs.jquery.com/ticket/15173
  let req = new XMLHttpRequest();
  req.addEventListener('load', processProfile);
  req.addEventListener('error', plugin.handleConnectionError(profileURL));
  req.open('GET', profileURL);
  req.send();

  function processProfile() {
    try {
      let $dom = $($.parseHTML(this.responseText));
      reviews.head.reviewerName = $dom.find('.public-name-text').text();

      // The requests redirects to the full profile URL
      reviews.head.reviewerURL = this.responseURL;
      let firstURL = 'https://www.amazon.com/gp/cdp/member-reviews/';
      plugin.report('Fetching page 1 &hellip;');
      $.get(firstURL)
        .done(processPage)
        .fail(plugin.handleConnectionError(firstURL));
    } catch (error) {
      plugin.reportError('An error occurred processing your user profile.', error.stack);
    }

  }

  function processPage(html) {
    try {
      currentPage++;

      let $dom = $($.parseHTML(html));
      let reviewElements = $dom.find('table[cellpadding="0"][cellspacing="0"] tr').has('div.reviewText');
      reviewElements.each((i, reviewElement) => {
        let product, productURL, headline, date, text, starRating;
        let $reviewElement = $(reviewElement);

        let productLink = $reviewElement.prev().find('b a');
        product = $(productLink).text();

        productURL = $(productLink).attr('href');
        productURL = normalizeURL(productURL);
        headline = $reviewElement.find('td b').first().text();
        text = $reviewElement.find('.reviewText').first().html();
        date = $reviewElement.find('td nobr').first().text();
        date = plugin.getISODate(date);

        // We ignore decimals, although the number is exressed as "3.0" etc.
        // this seems to be only used for averages
        starRating = (($reviewElement
            .find('div img[width="64"]')
            .attr('alt') || '')
          .match(/^\d/) || [])[0];

        let reviewObj = {
          product,
          productURL,
          headline,
          date,
          text,
          starRating
        };
        reviews.data.push(reviewObj);
      });

      let nextPage = currentPage + 1;

      // The pagination is just a set of numbered links, so if we're on page
      // "4", we try to find one that's labeled "5", or "5-" since the last link
      // always is labeled with a range (11-20, 21-30, etc.).
      let regEx = new RegExp('^' + String(nextPage) + '(-\\d*$|$)');

      let $pageMatches = $dom
        .find('td div[align="right"] b a')
        .filter(function() {
          return regEx.test($(this).text());
        });

      if ($pageMatches.length) {
        let nextPageURL = $pageMatches.attr('href');
        let progress = `Fetching page ${nextPage} &hellip;`;
        plugin.report(progress);
        $.get(nextPageURL)
          .done(processPage)
          .fail(plugin.handleConnectionError(nextPageURL));
      } else {
        callback(reviews);
      }
    } catch (error) {
      plugin.reportError(`An error occurred processing your reviews.`, error.stack);
    }
    // We normalize URLs by stripping the referral string
    function normalizeURL(url) {
      if (/\/ref=.*/.test(url)) {
        url = url.match(/(.*\/)(ref=.*)?/)[1];
      }
      return url;
    }
  }
}
