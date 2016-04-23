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
  return Boolean($('.greeting').length);
}

function retrieveReviews(callback) {
  let page = 1;
  let reviews = {
    head: {},
    data: []
  };
  let base = 'https://www.tripadvisor.com';
  let directoryURL = `${base}/MemberProfile`;

  // We use XMLHttpRequest here because jQuery does not expose responseURL,
  // due to limited support for it; see https://bugs.jquery.com/ticket/15173
  let req = new XMLHttpRequest();
  req.addEventListener('load', processDirectory);
  req.addEventListener('error', plugin.handleConnectionError(directoryURL));
  req.open('GET', directoryURL);
  req.send();

  function processDirectory() {
    try {
      let directoryURL = this.responseURL;
      if (!/\members\//.test(directoryURL)) {
        plugin.reportError('We did not find any reviews for this account.', 'Profile URL was: '+directoryURL);
        return;
      }
      let reviewerID = directoryURL.match('/members/(.*)')[1];

      var directoryHTML = this.responseText;
      var $directoryDOM = $($.parseHTML(this.responseText));

      reviews.head.reviewerID = reviewerID;
      reviews.head.reviewerName = $directoryDOM.find('.name .nameText').text();

      let reviewList = $directoryDOM.find('li.cs-review').toArray();

      var reviewURLs = [];
      reviewURLs = reviewList.map(ele => {
        return base + $(ele).find('a.cs-review-title').attr('href');
      });
      if (!reviewURLs.length) {
        plugin.reportError('No reviews found.');
        return false;
      }
      var count = 0;
      var total = $directoryDOM.find('a[name="reviews"]').text().match(/[0-9]*/);
      processReviewList();
    } catch (error) {
      plugin.reportError('An error occurred processing the list of reviews.', error.stack);
    }

    function processReviewList() {
      count++;
      let url = reviewURLs.shift();
      if (url) {
        plugin.report(`Fetching review ${count} of ${total} &hellip;`);
        $.get(url)
          .done(processReview)
          .fail(plugin.handleConnectionError(url));
      }

      function processReview(html) {
        try {
          let $dom = $($.parseHTML(html));
          let subject = $dom.find('.altHeadInline a').first().text();
          let subjectTripAdvisorURL = base + $dom.find('.altHeadInline a').first().attr('href');
          let $review = $dom.find('.reviewSelector').first();
          let text = $review.find('[property="reviewBody"]').html().trim();
          let date = $review.find('.ratingDate').attr('content');
          let overallRatingClass, overallRating;
          overallRatingClass = $review.find('.rating img').attr('class');
          if (overallRatingClass)
            overallRating = overallRatingClass.match(/s([0-9])/)[1];

          let reviewObj = {
            subject,
            subjectTripAdvisorURL,
            text,
            date,
            overallRating
          };

          let subRatingLabels = ['Value', 'Service', 'Sleep Quality', 'Location',
            'Food', 'Atmospere', 'Cleanliness', 'Rooms'
          ];
          let subRatingKeys = ['valueRating', 'serviceRating', 'sleepQualityRating',
            'locationRating', 'foodRating', 'atmosphereRating', 'cleanlinessRating',
            'roomsRating'
          ];

          $review.find('li.recommend-answer').each(function() {
            let ratingType = $(this).find('.recommend-description').text().trim();
            let subRatingIndex = subRatingLabels.indexOf(ratingType);
            if (subRatingIndex == -1)
              return;
            let subRatingClass, subRating;
            subRatingClass = $(this).find('.rate img').attr('class');
            if (subRatingClass) {
              subRating = subRatingClass.match(/s([0-9])/)[1];
              reviewObj[subRatingKeys[subRatingIndex]] = subRating;
            }
          });

          reviews.data.push(reviewObj);
          if (reviewURLs.length)
            processReviewList();
          else if (total - count > 0) {
            plugin.report('Attempting to get more data &hellip;');
            let id = directoryHTML.match(/\{"memberId":"(.*?)"\}/)[1];
            let token = $directoryDOM.find('input[name="token"]').val();
            var data = {
              token,
              version: 5,
              authenticator: 'DEFAULT',
              actions: JSON.stringify([{
                "name": "FETCH",
                "resource": "modules.membercenter.model.ContentStreamComposite",
                "params": {
                  "offset": count,
                  "limit": 50,
                  "page": "PROFILE",
                  "memberId": id
                },
                "id": "clientaction576"
              }])
            };
            let postURL = 'https://www.tripadvisor.com/ModuleAjax?';
            $.post(postURL, data, null, 'json')
              .done(function(response) {
                let dir = response.store['modules.unimplemented.entity.AnnotatedItem'];
                for (let itemKey in dir) {
                  if (dir[itemKey].url)
                    reviewURLs.push(base + dir[itemKey].url);
                }
                if (reviewURLs.length)
                  processReviewList();
                else {
                  plugin.reportError('No additional reviews received!');
                  callback(reviews);
                }
              })
              .fail(plugin.handleConnectionError(postURL));
          } else {
            callback(reviews);
          }
        } catch (error) {
          plugin.reportError('An error occurred processing a review.', error.stack);
        }
      }
    }
  }
}
