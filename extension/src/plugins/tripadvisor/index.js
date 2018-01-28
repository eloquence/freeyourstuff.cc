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
    return Boolean($('.global-nav-profile-menu').length);
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
    if (!/\/members\//.test(directoryURL)) {
      plugin.reportError(new Error(`Profile URL ${directoryURL} has no reviews.`), 'We did not find any reviews for this account.');
      return;
    }
    const reviewerID = (directoryURL.match('/members/(.*)') || [])[1],
      directoryHTML = directoryResponse.responseText,
      $directoryDOM = $($.parseHTML(directoryHTML)),
      reviewList = $directoryDOM.find('li.cs-review').toArray();

    reviews.head.reviewerID = reviewerID;
    reviews.head.reviewerName = $directoryDOM.find('.name .nameText').text();

    // Will be overwritten during pagination
    let reviewURLs = reviewList.map(ele =>
      baseURL + $(ele).find('a.cs-review-title').attr('href')
    );
    if (!reviewURLs.length) {
      plugin.reportError(null, 'No reviews found.');
      return null;
    }

    counter.total = getReviewCountFromDOM($directoryDOM);

    do {
      for (let url of reviewURLs)
        reviews.data.push(await getReview(url));

      plugin.report('Attempting to get more data');
      reviewURLs = await getMoreReviewURLs(directoryHTML, $directoryDOM);
    } while (reviewURLs);

    return reviews;
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

  function getMoreReviewURLs(directoryHTML, $directoryDOM) {
    return new Promise((resolve, reject) => {
      const id = (directoryHTML.match(/\{"memberId":"(.*?)"\}/ || []))[1];
      const token = $directoryDOM.find('input[name="token"]').val();
      const data = {
        token,
        version: 5,
        authenticator: 'DEFAULT',
        actions: JSON.stringify([{
          'name': 'FETCH',
          'resource': 'modules.membercenter.model.ContentStreamComposite',
          'params': {
            'offset': counter.progress,
            'limit': 50,
            'page': 'PROFILE',
            'memberId': id
          },
          'id': 'clientaction576'
        }])
      };
      const postURL = 'https://www.tripadvisor.com/ModuleAjax?';
      $.post(postURL, data, null, 'json')
        .done(function(response) {
          const rv = [];
          let dir = response.store['modules.unimplemented.entity.AnnotatedItem'];
          for (let itemKey in dir) {
            if (dir[itemKey].url)
              rv.push(baseURL + dir[itemKey].url);
          }
          if (rv.length)
            resolve(rv);
          else
            resolve(null);
        })
        .fail(event => {
          const error = plugin.getConnectionError(postURL, event);
          reject(error);
        });
    });
  }

  async function getReview(url) {
    counter.progress++;
    plugin.report(`Fetching review ${counter.progress} of ${counter.total}`);
    const reviewHTML = await getReviewData(url);
    const $dom = $($.parseHTML(reviewHTML));
    const subject = $dom
      .find('.altHeadInline a')
      .first()
      .text(),
      subjectTripAdvisorURL = baseURL + $dom
      .find('.altHeadInline a')
      .first()
      .attr('href'),
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
      overallRating = (($review
          .find('.rating span')
          .attr('class') || '')
        .match(/bubble_([0-9])/) || [])[1];

    const reviewObj = {
      subject,
      subjectTripAdvisorURL,
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
    const asText = ($dom
      .find('a[name="reviews"]')
      .text()
      .match(/[0-9,]*/) || [])[0];
    return numeral(asText).value();
  }

})();
