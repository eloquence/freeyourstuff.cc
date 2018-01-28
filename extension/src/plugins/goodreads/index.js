/* global $, Papa */
(function() {
  'use strict';

  const freeyourstuff = window.freeyourstuff,
    plugin = freeyourstuff.plugin,
    DataSet = freeyourstuff.DataSet;

  // Dataset IDs and the functions to retrieve that data in raw, uncoerced JSON
  freeyourstuff.jsonData = {
    reviews: retrieveReviews
  };

  // For execution in browser
  if (typeof chrome !== 'undefined')
    plugin.setup([handleRetrieval]);

  function handleRetrieval(request) {
    if (request.action == 'retrieve') {
      if (!loggedIn())
        return plugin.loggedOut();

      plugin.busy();

      let datasets = {};
      datasets.schemaKey = request.schema.schema.key;
      datasets.schemaVersion = request.schema.schema.version;
      retrieveReviews()
        .then(reviews => {
          // If no result, issue must be handled downstream
          if (reviews) {
            datasets.reviews = new DataSet(reviews, request.schema.reviews).set;
            chrome.runtime.sendMessage({
              action: 'dispatch',
              data: datasets,
              schema: request.schema
            });
          }
          plugin.done();
        })
        .catch(plugin.reportError);
    }
  }

  function loggedIn() {
    return Boolean($('.headerPersonalNav').length);
  }

  // When running in an extension context, we can usually just look at the page
  // we're on to find the profile URL. When running in Node, we need to get at
  // least one Goodreads page first to extract it. This is also a nice fallback for
  // pages which don't have the profile link on them (e.g., error pages).
  async function getHead() {
    plugin.report('Obtaining profile data');
    let head = extractHeadInfo($(document));
    const mainURL = 'https://www.goodreads.com/';
    if (head)
      return head;

    const html = await plugin.getURL(mainURL);
    head = extractHeadInfoFromHTML(html);
    if (head)
      return head;

    throw new Error('Profile not found.');
  }

  // Extract user ID and name from the current page.
  function extractHeadInfo() {

    const profileLink = $('.dropdown__menu--profileMenu li a')
      .first()
      .attr('href') || '',

      reviewerID = (profileLink.match(/\/user\/show\/([0-9]+)/) || [])[1],

      reviewerName = $('.headerPersonalNav .circularIcon')
      .first()
      .attr('alt');

    const head = {
      reviewerID,
      reviewerName
    };

    // Reviewer name is optional; reviewer ID is required for successful operation
    return reviewerID ? head : null;
  }

  // Extract user ID and name from the raw HTML of a page
  function extractHeadInfoFromHTML(html) {
    const matches = html.match(/"currentUser":{"name":"(.*)","profileUrl":"\/user\/show\/([0-9]+)/);
    return matches === null || matches[2] === undefined ?
      null : {
        reviewerID: matches[2],
        reviewerName: matches[1]
      };
  }

  async function retrieveReviews({ url } =  {}) {
    if (url) {
      console.log(`URL option not supported. ` +
        `Goodreads can only export the ratings CSV for the user's own session.`);
      return null;
    }

    const reviews = {
      head: {},
      data: []
    };

    reviews.head = await getHead();

    plugin.report('Launching export');

    // The export is launched from the page where you can also import books.
    // Here we get a CSRF token.
    const importURL = 'https://www.goodreads.com/review/import/';
    const html = await plugin.getURL(importURL);
    const $dom = $($.parseHTML(html));
    const token = $dom.filter('meta[name="csrf-token"]').attr('content');

    // There are two steps, launching the export and then waiting for it to
    // complete.
    const exportURL = `https://www.goodreads.com/review_porter/export/${reviews.head.reviewerID}`;
    try {
      await launchExport(exportURL, token);
    } catch (errorEvent) {
      const error = plugin.getConnectionError(exportURL, errorEvent);
      plugin.reportError(error);
      return false;
    }

    plugin.report('Waiting for export to complete');
    // We now have to ping repeatedly to see if the export has been produced
    const csvURL = `https://www.goodreads.com/review_porter/export/` +
      `${reviews.head.reviewerID}/goodreads_export.csv`;

    await pollCompletion(csvURL);

    plugin.report('Downloading');
    const results = await fetchAndParseCSV(csvURL);

    // We want reviews and ratings, so removing all other rows
    const filteredResults = results.data.filter(ele => {
      return ele['Book Id'] && (ele['My Rating'] !== '0' || ele['My Review']);
    });

    // Only use the data that is the user's own work
    reviews.data = filteredResults.map(ele => ({
      subject: ele.Title || undefined,
      subjectGoodreadsURL: `https://www.goodreads.com/book/show/${ele['Book Id']}`,
      author: ele.Author || undefined,
      additionalAuthors: ele['Additional Authors'] || undefined,
      starRating: ele['My Rating'] || undefined,
      dateAdded: plugin.getISODate(ele['Date Added']) || undefined,
      dateRead: plugin.getISODate(ele['Date Read']) || undefined,
      review: ele['My Review'] || undefined
    }));
    return reviews;

  }

  function launchExport(exportURL, token) {
    return new Promise((resolve, reject) => {
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
        .done(resolve)
        .fail(reject);
    });
  }

  function pollCompletion(url) {
    return new Promise((resolve, reject) => {
      let elapsedTime = 0,
        timeout = 30000,
        interval = 250;

      const i = setInterval(() => {
        $.ajax({
            type: 'HEAD',
            url
          })
          .done(() => {
            clearInterval(i);
            resolve();
          })
          .fail(event => {
            elapsedTime += interval;
            if (elapsedTime >= timeout)
              reject(plugin.getConnectionError(url, event, `Export did not complete in ${timeout} milliseconds.`));
          });
      }, interval);
    });

  }

  function fetchAndParseCSV(csvURL) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvURL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: resolve,
        error: reject
      });
    });
  }

})();
