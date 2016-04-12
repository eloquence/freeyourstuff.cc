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
        chrome.runtime.sendMessage({
          action: 'notice',
          html: 'Moving to an HTTPS URL for secure download.'
        });
        chrome.runtime.sendMessage({
          action: 'redirect',
          url: 'https://www.amazon.com/',
          autoRetrieve: true
        });
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
  let pages = [1];
  let profileURL = 'https://www.amazon.com/gp/profile/';

  // We use XMLHttpRequest here because jQuery does not expose responseURL,
  // due to limited support for it; see https://bugs.jquery.com/ticket/15173
  let req = new XMLHttpRequest();
  req.addEventListener('load', processProfile);
  req.open('GET', 'https://www.amazon.com/gp/profile/');
  req.send();

  function processProfile() {
    try {
      let dom = $.parseHTML(this.responseText);
      reviews.head.reviewerName = $(dom).find('.public-name-text').text();

      // The requests redirects to the full profile URL
      reviews.head.reviewerURL = this.responseURL;
      let firstURL = 'https://www.amazon.com/gp/cdp/member-reviews/';
      $.get(firstURL).done(processPage);
    } catch (error) {
      plugin.reportError('An error occurred processing your user profile.', error.stack);
    }

  }

  function processPage(html) {
    try {
      let dom = $.parseHTML(html);
      let reviewElements = $(dom).find('table[cellpadding="0"][cellspacing="0"] tr').has('div.reviewText');
      reviewElements.each((i, reviewElement) => {
        let product, productURL, headline, date, text, starRating;

        let productLink = $(reviewElement).prev().find('b a');
        product = $(productLink).text();

        productURL = $(productLink).attr('href');
        productURL = normalizeURL(productURL);
        headline = $(reviewElement).find('td b').first().text();
        text = $(reviewElement).find('.reviewText').first().html();
        date = $(reviewElement).find('td nobr').first().text();

        // We ignore decimals, although the number is exressed as "3.0" etc.
        // this seems to be only used for averages
        let starRatingAlt = $(reviewElement).find('div img[width="64"]').attr('alt');
        if (starRatingAlt)
          starRating = starRatingAlt.match(/^\d/)[0];

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

      // There's no "Next / Prev", so we grab the rightmost link in the page nav
      // and make sure it's not a page we've seen before
      let nextPageLink = $(dom).find('div[align="right"] b a').last();
      let nextPage = Number(nextPageLink.text());

      if (pages.indexOf(nextPage) == -1) {
        let progress = `Fetching page ${nextPage} &hellip;`;
        plugin.report(progress);
        pages.push(nextPage);
        $.get('https://www.amazon.com' + nextPageLink.attr('href')).done(processPage);
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
