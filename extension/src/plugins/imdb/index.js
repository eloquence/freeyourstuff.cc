'use strict';
if (typeof init === 'undefined')
  var init = false;

// For execution in browser
if (typeof chrome !== 'undefined' && !init)
  setupExtensionEvents();

// For execution in Node
if (typeof module !== 'undefined') {
  let tests = {
    reviews: retrieveReviews
  };
  module.exports = tests;
}

function setupExtensionEvents() {
  chrome.runtime.onMessage.addListener(request => {
    if (request.action == 'retrieve') {
      if (!loggedIn()) {
        chrome.runtime.sendMessage({
          action: 'notice-login'
        });
        return false;
      }
      let baseURL;
      try {
        baseURL = getBaseURL();
      } catch (e) {
        chrome.runtime.sendMessage({
          action: 'error',
          html: e.message
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
      }, baseURL);
    }
  });
  // Prevent repeated initialization
  init = true;
}

function loggedIn() {
  return !($('#nblogin').text());
}

function getBaseURL() {
  // Strips off query string
  let menuMatch = $('#nb_personal a').first().attr('href').match(/(.*)\?/);
  if (menuMatch[1])
    return menuMatch[1];
  else
    throw new Error('Could not obtain base URL.');
}

function retrieveReviews(callback, baseURL) {

  // Standard testing URL; note that the pages for logged-in and logged-out
  // users differ slightly; we try to successfully parse both
  if (!baseURL)
    baseURL = 'http://www.imdb.com/user/ur3274830/';

  let page = 1;
  let reviews = {
    head: {},
    data: []
  };
  let doneURLs = [];
  let firstURL = baseURL + 'comments-expanded';
  doneURLs.push(firstURL);
  $.get(firstURL).done(processPage);
  function processPage(html) {
    let dom = $.parseHTML(html);
    if (page === 1) {
      reviews.head.reviewerName = $(dom).find('#consumer_user_nav a').first().text().trim();
      reviews.head.reviewerID = baseURL.match(/ur[0-9]*/)[0];
    }
    while ($(dom).find('table#outerbody div').length) {
      let subject = $(dom).find('table#outerbody div a').first().text();
      let subjectIMDBURL = 'http://www.imdb.com' + $(dom).find('table div a').first().attr('href');
      let reviewScope = $(dom).find('table div').first().nextUntil('div,hr');
      let title = reviewScope.closest('b').first().text();
      // "<small>x of y people found the following review useful:</small>" is only present where y > 0
      let date = reviewScope.closest('small').length == 1 ? $(reviewScope.closest('small')[0]).text() :
        $(reviewScope.closest('small')[1]).text();

      let spoilers = reviewScope.find('b').length ? true : false;
      // We don't want spoiler warnings in the actual text.
      reviewScope = reviewScope.not('p:has(b)');

      let text = '';
      reviewScope.closest('p').each((i, e) => {
        if (e.innerHTML)
          text += `<p>${e.innerHTML}</p>`;
      });

      let starRating, starRatingMatch;
      if (reviewScope.closest('img').attr('alt') &&
        (starRatingMatch = reviewScope.closest('img').attr('alt').match(/(\d+)\//)))
        starRating = starRatingMatch[1];
      // Remove processed bits so the while loop can continue
      $(dom).find('table#outerbody div').first().nextUntil('div').remove();
      $(dom).find('table#outerbody div').first().remove();
      let reviewObj = {
        subject,
        subjectIMDBURL,
        title,
        date,
        text,
        starRating,
        spoilers
      };
      reviews.data.push(reviewObj);
    }
    let nextURL = $(dom).find('table table td a img').last().parent().attr('href');
    //nextURL = 'http://www.imdb.com/user/ur3274830/' + nextURL;
    if (nextURL)
      nextURL = baseURL + nextURL;
    if (nextURL && doneURLs.indexOf(nextURL) === -1) {
      doneURLs.push(nextURL);
      page++;
      // Obtain and relay progress info
      let totalPageMatch, totalPages;
      if ((totalPageMatch = $(dom).find('table td font').first().text().match(/\d+.*?(\d+)/)))
        totalPages = totalPageMatch[1];
      let progress = `Fetching page ${page} of ${totalPages} &hellip;`;
      report(progress);
      // Fetch next page
      $.get(nextURL).done(processPage);
    } else {
      callback(reviews);
    }
  }
}

function report(html) {
  if (typeof chrome !== 'undefined') {
    chrome.runtime.sendMessage({
      action: 'notice',
      html
    });
  } else {
    console.log('Progress update: ' + html);
  }
}
