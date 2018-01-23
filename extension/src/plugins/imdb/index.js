/* global $, DataSet, plugin, Papa, */
(function() {
  'use strict';
  // Result comparison tests to be run by NodeJS/JSDOM test runner
  // eslint-disable-next-line no-unused-vars
  window.jsonTests = {
    reviews: retrieveReviews,
    ratings: retrieveRatings
  };

  plugin.setup([handleRetrieval]);

  var mainURL = 'http://www.imdb.com';

  function handleRetrieval(request) {
    if (request.action == 'retrieve') {
      if (!loggedIn())
        return plugin.loggedOut();

      plugin.busy();
      const datasets = {};
      datasets.schemaKey = request.schema.schema.key;
      datasets.schemaVersion = request.schema.schema.version;
      retrieveReviews()
        .then(reviews => {
          if (reviews)
            datasets.reviews = new DataSet(reviews, request.schema.reviews).set;
          return reviews.head;
        })
        .then(retrieveRatings)
        .then(ratings => {
          if (ratings)
            datasets.ratings = new DataSet(ratings, request.schema.ratings).set;
        })
        .then(() => {
          chrome.runtime.sendMessage({
            action: 'dispatch',
            data: datasets,
            schema: request.schema
          });
          plugin.done();
        })
        .catch(plugin.reportError);
    }
  }

  function loggedIn() {
    return !($('#nblogin').text());
  }

  // When running in an extension context, we can usually just look at the page
  // we're on to find the profile URL. When running in Node, we need to get at
  // least one IMDB page first to extract it. This is also a nice fallback for
  // pages which don't have the profile link on them (e.g., error pages).
  async function getHead() {
    let head = extractHeadInfo();
    if (head)
      return head;

    plugin.report('Getting profile data');
    const html = await plugin.getURL(mainURL);
    const $dom = $($.parseHTML(html));
    head = extractHeadInfo($dom);
    if (!head)
      throw new Error('Could not find IMDB profile.');

    return head;
  }

  // Extract a link to the user's profile from an IMDB page.
  function extractHeadInfo($dom) {
    if (!$dom)
      $dom = $(document);

    // Strips off query string
    const profileLink = $dom.find('#nb_personal a').first().attr('href') || '';
    const reviewerID = (profileLink.match(/\/user\/(ur[0-9]+)/) || [])[1];
    const reviewerName = $dom.find('#consumer_user_nav a').first().text().trim();

    const head = {
      reviewerID,
      reviewerName
    };
    // Reviewer name is optional; reviewer ID is required for successful operation
    return reviewerID ? head : null;
  }

  async function retrieveReviews() {
    const reviews = {
      head: {},
      data: []
    };

    reviews.head = await getHead();

    const path = `/user/${reviews.head.reviewerID}/reviews`,
      url = `${mainURL}${path}`;

    const reviewIndex = await plugin.getURL(url);

    let $dom = $($.parseHTML(reviewIndex)),
      hasMore = false;

    const totalCount = ($dom
      .find('.header span')
      .first()
      .text()
      .replace(/,/g, '')
      .match(/(\d*)/) || [])[1];

    // Not included in subsequent requests
    const paginationURL = $dom.find('[data-ajaxurl]').attr('data-ajaxurl');
    let visibleCount = 0;

    do {
      visibleCount += $dom.find('.review-container').length;
      reviews.data.push(...getReviewsFromDOM($dom));
      const paginationKey = $dom.find('[data-key]').attr('data-key');
      hasMore = paginationKey !== undefined && paginationURL !== undefined;
      if (hasMore) {
        plugin.report(`Loaded ${visibleCount} of ${totalCount} reviews`);
        const nextPage = await plugin.getURL(paginationURL, { paginationKey });
        $dom = $($.parseHTML(nextPage));
      }
    } while (hasMore);


    plugin.report('Fetching reviews');
    return reviews;
  }

  // Extract reviews from a given jQuery DOM and add them to the reviews object
  function getReviewsFromDOM($dom) {
    const reviews = [];

    $dom
      .find('.review-container')
      .each(function() {
        const $review = $(this),

          subject = $review.find('.lister-item-header a').text(),

          subjectIMDBURL = normalizeURL(mainURL +
            $review.find('.lister-item-header a').attr('href')),

          title = $review.find('.title').text(),

          date = plugin.getISODate($review.find('.review-date').text()),

          text = $review.find('.text').html(),

          // CSS classes differ for self vs. other users
          starRating = +$review.find('.rating-other-user-rating span,.user-rating-value span')
          .first()
          .text() || undefined,

          spoilers = $review.find('.spoiler-warning').length > 0,

          review = {
            subject,
            subjectIMDBURL,
            title,
            date,
            text,
            starRating,
            spoilers
          };

        reviews.push(review);
      });
    return reviews;
  }

  async function retrieveRatings(head) {
    if (head === undefined)
      head = await getHead();

    plugin.report('Fetching ratings');
    const ratings = {
      head,
      data: []
    };
    const csvURL = `http://www.imdb.com/list/export?list_id=ratings`;
    const ratingData = await retrieveAndParseCSV(csvURL);
    ratings.data.push(...ratingData);
    return ratings;
  }

  function retrieveAndParseCSV(csvURL) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvURL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: results => {
          const filteredResults = results.data.filter(ele =>
            ele.URL !== undefined || ele.Title !== undefined);
          const ratings = filteredResults.map(ele => {
            // We're using only the parts of the CSV which are the user's own work.
            // The CSV also contains a "modified" date, which does not appear to
            // be used, see: https://getsatisfaction.com/imdb/topics/gobn1q01nbd5o
            return {
              starRating: ele['Your Rating'],
              subject: ele.Title,
              subjectIMDBURL: ele.URL,
              datePosted: plugin.getISODate(ele['Date Added']) || undefined
            };
          });
          resolve(ratings);
        },
        error: reject
      });
    });
  }

  // We normalize URLs by stripping the referral string
  function normalizeURL(url) {
    if (/\/\?ref_=.*/.test(url))
      url = url.match(/(.*\/)(\?ref_=.*)?/)[1];
    return url;
  }
})();
