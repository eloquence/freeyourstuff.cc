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
  let path, directoryURL;
  if ($('.updateProfile a').length) {
    // There does not appear to be a difference between the /members
    // and /members-reviews path.
    path = $('.updateProfile a').attr('href');
    reviews.head.reviewerID = path.match('/members/(.*)')[1];
    directoryURL = base + path;
    $.get(directoryURL).done(processDirectory);
  } else {
    $.get(base).done(html => {
      let dom = $.parseHTML(html);
      if ($(dom).find('.updateProfile a').length) {
        path = $(dom).find('.updateProfile a').attr('href');
        reviews.head.reviewerID = path.match('/members/(.*)')[1];
        directoryURL = base + path;
        $.get(directoryURL).done(processDirectory);
      } else {
        plugin.reportError('Could not find your user profile.');
        return false;
      }
    });
  }

  function processDirectory(directoryHTML) {
    let directoryDOM = $.parseHTML(directoryHTML);
    reviews.head.reviewerName = $(directoryDOM).find('.name .nameText').text();
    let reviewList = $(directoryDOM).find('li.cs-review').toArray();
    let reviewURLs = [];
    reviewURLs = reviewList.map(ele => {
      return base + $(ele).find('a.cs-review-title').attr('href');
    });
    if (!reviewURLs.length) {
      plugin.reportError('No reviews found.');
      return false;
    }
    let count = 0;
    let total = $(directoryDOM).find('a[name="reviews"]').text().match(/[0-9]*/);
    processReviewList();

    function processReviewList() {
      count++;
      let url = reviewURLs.shift();
      if (url) {
        plugin.report(`Fetching review ${count} of ${total} &hellip;`);
        $.get(url).done(processReview);
      }

      function processReview(html) {
        let dom = $.parseHTML(html);
        let subject = $(dom).find('.altHeadInline a').first().text();
        let subjectTripAdvisorURL = base + $(dom).find('.altHeadInline a').first().attr('href');
        let $review = $(dom).find('.reviewSelector').first();
        let text = $review.find('[property="reviewBody"]').html().trim();
        let date = $review.find('.ratingDate').attr('content');
        let overallRating = $review.find('.rating img').attr('class').match(/s([0-9])/)[1];

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
          let subRating = $(this).find('.rate img').attr('class').match(/s([0-9])/)[1];
          reviewObj[subRatingKeys[subRatingIndex]] = subRating;
        });

        reviews.data.push(reviewObj);
        if (reviewURLs.length)
          processReviewList();
        else if (total - count > 0) {
          plugin.report('Attempting to get more data &hellip;');
          let id = directoryHTML.match(/\{"memberId":"(.*?)"\}/)[1];
          let token = $(directoryDOM).find('input[name="token"]').val();
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
          $.post('https://www.tripadvisor.com/ModuleAjax?', data, null, 'json').done(function(response) {
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
          });
        } else {
          callback(reviews);
        }
      }
    }
  }
}
