/* global $, Papa, */
(function() {
  'use strict';

  const freeyourstuff = window.freeyourstuff,
    plugin = freeyourstuff.plugin,
    DataSet = freeyourstuff.DataSet;

  // Dataset IDs and the functions to retrieve that data in raw, uncoerced JSON
  freeyourstuff.jsonData = {
    reviews: retrieveReviews,
    ratings: retrieveRatings
  };

  plugin.setup([handleRetrieval]);

  const protocol = window.location.protocol,
    mainURL = `${protocol}//www.imdb.com`;

  async function handleRetrieval(request) {
    if (request.action == 'retrieve') {
      if (!loggedIn())
        return plugin.loggedOut();

      plugin.busy();
      const datasets = {};
      datasets.schemaKey = request.schema.schema.key;
      datasets.schemaVersion = request.schema.schema.version;

      let reviews;
      try {
        reviews = await retrieveReviews();
      } catch (error) {
        plugin.reportError(error);
        return;
      }

      if (reviews)
          datasets.reviews = new DataSet(reviews, request.schema.reviews).set;

      let ratings;
      try {
        ratings = await retrieveRatings({}, reviews && reviews.head ? reviews.head : undefined);
      } catch (error) {
        plugin.reportError(error);
        return;
      }

      if (ratings)
        datasets.ratings = new DataSet(ratings, request.schema.ratings).set;

      chrome.runtime.sendMessage({
        action: 'dispatch',
        data: datasets,
        schema: request.schema
      });

      plugin.done();
    }
  }

  function loggedIn() {
    return $('.navbar__user-menu-toggle__name').length > 0;
  }

  // When running in an extension context, we can usually just look at the page
  // we're on to find the profile URL. When running in Node, we need to get at
  // least one IMDB page first to extract it. This is also a nice fallback for
  // pages which don't have the profile link on them (e.g., error pages).
  async function getHead() {

    plugin.report('Getting profile data');
    const url = await plugin.getResponseURL('https://www.imdb.com/profile');
    if (!url)
      throw new Error('Failed to load IMDB profile.');

    const path = new URL(url).pathname;
    if (!/^\/user\//.test(path))
      throw new Error('Failed to locate IMDB profile. Please check if you are logged in.');

    const head = {
      reviewerName: $('.navbar__user-menu-toggle__name').text(),
      reviewerID: path.match(/^\/user\/(.*)\//)[1]
    };

    return head;
  }

  async function retrieveReviews({ url } = {}) {
    const reviews = {
      head: {},
      data: []
    };

    if (url) {
      try {
        url = normalizeProfileURL(url);
      } catch (error) {
        console.error(`URL ${url} does not appear to be a valid IMDB profile.`);
        return null;
      }
    } else {
      reviews.head = await getHead();
      url = `/user/${reviews.head.reviewerID}/reviews`;
    }

    plugin.report('Fetching reviews');
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

  async function retrieveRatings(options = {}, head) {
    if (head === undefined)
      head = await getHead();

    if (options.url) {
      console.log(`URL option not supported. ` +
        `IMDB can only export the ratings CSV for the user's own session.`);
      return null;
    }

    plugin.report('Fetching ratings');
    const ratings = {
      head,
      data: []
    };
    const csvURL = `${protocol}//www.imdb.com/list/export?list_id=ratings`;
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
              datePosted: plugin.getISODate(ele['Date Rated']) || undefined
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

  // For command line usage, normalize a provided URL to add the "reviews"
  // suffix if needed
  function normalizeProfileURL(url) {
    url = normalizeURL(url);
    // Profile URL without reviews path
    if (/imdb\.com\/user\/ur\d*\/?$/.test(url)) {
      if (!/\/$/.test(url))
        url += '/';
      url += 'reviews';
    }
    if (!/^https?:\/\/(www\.)?imdb.com\//.test(url))
      throw new Error('Does not appear to be an IMDB url');

    return url;
  }

})();
