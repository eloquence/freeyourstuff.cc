/* global $, numeral */
(function() {
  'use strict';

  const freeyourstuff = window.freeyourstuff,
    plugin = freeyourstuff.plugin,
    DataSet = freeyourstuff.DataSet,
    baseURL = 'https://www.tripadvisor.com',
    counter = {
      total: undefined,
      progress: 0
    };

  // Dataset IDs and the functions to retrieve that data in raw, uncoerced JSON
  freeyourstuff.jsonData = {
    reviews: retrieveReviews
  };

  plugin.setup([handleRetrieval]);

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
          // If no reviews, should be handled downstream
          if (reviews) {
            datasets.reviews = new DataSet(reviews, request.schema.reviews).set;

            chrome.runtime.sendMessage({
              action: 'dispatch',
              data: datasets,
              schema: request.schema
            });
            plugin.done();
          }
        })
        .catch(plugin.reportError);
    }
  }

  function loggedIn() {
    return !($('[class*=brand-global-nav-action-profile-Profile__loginButton]').length);
  }

  // The main retrieval loop
  async function retrieveReviews({ url } = {}) {

    const reviews = {
      head: {},
      data: []
    };

    // Will be overwritten with member ID in URL, after redirect
    let directoryURL = url ? url : `${baseURL}/MemberProfile`;

    const directoryResponse = await getDirectory(directoryURL);
    directoryURL = directoryResponse.responseURL;
    if (new URL(directoryURL).pathname != window.location.pathname) {
      plugin.report('Redirecting to profile');
      plugin.redirect(directoryURL);
      return false;
    }

    const decodedURI = decodeURI(window.location.href);
    const reviewerID = (decodedURI.match('/Profile/(.*)') || [])[1];

    reviews.head.reviewerID = reviewerID;
    reviews.head.reviewerName = $('span[class*=social-member-MemberBlock__display_name]').text();
    // Approximate count, other contributions combined into one total
    counter.total = getReviewCountFromDOM($(document));

    const reviewLinkSelector = "div[class^=social-sections-ReviewSection] a[href^='/ShowUserReviews']",
      getReviewCount = () => $(reviewLinkSelector).length;

    let displayedReviews = getReviewCount(),
      failedTries = 0,
      maxTries = 5;

    while (displayedReviews < counter.total && failedTries <= maxTries) {
      if (failedTries > 0)
        plugin.report(`Waiting for more review summaries to load, attempt ${failedTries} of ${maxTries}`);
      else
        plugin.report(`Loaded ${displayedReviews} review summaries`);

      window.scrollTo(0, 0);
      window.scrollTo(0, document.body.scrollHeight);
      $('[class^=social-show-more-ShowMore__show_more] button').click();
      try {
        await plugin.awaitCondition(() => getReviewCount() > displayedReviews, 50, 2000);
        failedTries = 0;
      } catch (error) {
        failedTries++;
      }
      displayedReviews = getReviewCount();
    }
    // Update with actual result
    counter.total = displayedReviews;

    let reviewURLs = $(reviewLinkSelector).map(function() {
      return baseURL + $(this).attr('href');
    });

    if (!reviewURLs.length) {
      plugin.reportError(null, 'No reviews found.');
      return null;
    }

    for (let url of reviewURLs)
      reviews.data.push(await getReview(url));

    return reviews;
  }

  async function getReview(url) {
    counter.progress++;
    plugin.report(`Fetching review ${counter.progress} of ${counter.total}`);
    const reviewHTML = await getReviewData(url);
    const $dom = $($.parseHTML(reviewHTML));

    const
      subject = $dom
        .find('.altHeadInline a')
        .first()
        .text(),
      subjectTripAdvisorURL = baseURL + $dom
        .find('.altHeadInline a')
        .first()
        .attr('href'),
      // #PAGEHEADING is used for the title on some review pages. It's in
      // quotation marks, hence the slicing.
      title = $dom.find('#PAGEHEADING').length ?
         $dom.find('#PAGEHEADING').text().trim().slice(1, -1) :
         $dom.find('#HEADING').text(),
      $review = $dom
        .find('.reviewSelector')
        .first(),
      text = $review
        .find('.entry p')
        .html()
        .trim(),
      date = $review
        .find('.ratingDate')
        .attr('title'),
      isoDate = plugin.getISODate(date),
      ratingClassStr = $review
        .find('.ui_bubble_rating')
        .attr('class') || '',
      overallRating = (ratingClassStr.match(/bubble_([0-9])/) || [])[1];

    const reviewObj = {
      subject,
      subjectTripAdvisorURL,
      title,
      text,
      date: isoDate,
      overallRating
    };

    const subRatingLabels = ['Value', 'Service', 'Sleep Quality', 'Location',
      'Food', 'Atmospere', 'Cleanliness', 'Rooms'
    ];
    const subRatingKeys = ['valueRating', 'serviceRating', 'sleepQualityRating',
      'locationRating', 'foodRating', 'atmosphereRating', 'cleanlinessRating',
      'roomsRating'
    ];

    $review.find('li.recommend-answer').each(function() {
      const $this = $(this),

        ratingType = $this
        .find('.recommend-description')
        .text()
        .trim(),

        subRatingIndex = subRatingLabels.indexOf(ratingType);

      if (subRatingIndex == -1)
        return;

      const subRating = (($this
          .find('div.ui_bubble_rating')
          .attr('class') || '')
        .match(/bubble_([0-9])/) || [])[1];
      reviewObj[subRatingKeys[subRatingIndex]] = subRating;
    });
    return reviewObj;
  }

  function getReviewData(url) {
    return new Promise((resolve, reject) => {
      $.ajax({
          url,
          // jQuery default header triggers different HTML response that doesn't
          // include some of the information we want.
          beforeSend: function(xhr) {
            xhr.setRequestHeader('X-Requested-With', 'freeyourstuff.cc');
          },
        })
        .done(resolve)
        .fail(event => {
          const error = plugin.getConnectionError(url, event);
          reject(error);
        });
    });
  }

  function getReviewCountFromDOM($dom) {
    const asText =
      ($dom
        .find('[class^=social-member-MemberStats__link]')
        .first()
        .text()
        .match(/[0-9,]*/) || [])[0];
    return numeral(asText).value();
  }

  function getDirectory(directoryURL) {
    return new Promise((resolve, reject) => {
      // We use XMLHttpRequest here because jQuery does not expose responseURL,
      // due to limited support for it; see https://bugs.jquery.com/ticket/15173
      const req = new XMLHttpRequest();
      req.addEventListener('load', function() {
        const response = this;
        resolve(response);
      });
      req.addEventListener('error', function(event) {
        const error = plugin.getConnectionError(directoryURL, event);
        reject(error);
      });
      req.open('GET', directoryURL);
      req.send();
    });
  }

})();
