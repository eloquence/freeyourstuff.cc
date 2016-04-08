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
        reportError('Could not find your user profile.');
        return false;
      }
    });
  }

  function processDirectory(directoryHTML) {
    let directoryDOM = $.parseHTML(directoryHTML);
    reviews.head.reviewerName = $(directoryDOM).find('.name .nameText').text();
    let reviewList = $(directoryDOM).find('li.cs-review').toArray();
    if (!reviewList.length) {
      reportError('No reviews found.');
      return false;
    }
    let count = 0;
    let total = $(directoryDOM).find('a[name="reviews"]').text().match(/[0-9]*/);
    processReviewList();

    function processReviewList() {
      let listItem = reviewList.shift();
      let listItemURL = base + $(listItem).find('a.cs-review-title').attr('href');
      $.get(listItemURL).done(processReview);

      function processReview(html) {
        count++;
        report(`Fetching review ${count} of ${total} &hellip;`);
        let dom = $.parseHTML(html);
        let $review = $(dom).find('.reviewSelector').first();
        let text = $review.find('[property="reviewBody"]').html().trim();
        let date = $review.find('.ratingDate').attr('content');
        let overallRating = $review.find('.rating img').attr('class').match(/s([0-9])/)[1];

        let reviewObj = {
          text,
          date,
          overallRating
        };

        let subRatingLabels = ['Value', 'Service', 'Sleep Quality', 'Location',
          'Food', 'Atmospere', 'Cleanliness', 'Rooms'];
        let subRatingKeys = ['valueRating', 'serviceRating', 'sleepQualityRating',
          'locationRating', 'foodRating', 'atmosphereRating', 'cleanlinessRating',
          'roomsRating'];

        $review.find('li.recommend-answer').each(function() {
          let ratingType = $(this).find('.recommend-description').text().trim();
          let subRatingIndex = subRatingLabels.indexOf(ratingType);
          if (subRatingIndex == -1)
            return;
          let subRating = $(this).find('.rate img').attr('class').match(/s([0-9])/)[1];
          reviewObj[subRatingKeys[subRatingIndex]] = subRating;
        });

        reviews.data.push(reviewObj);
        if (reviewList.length)
          processReviewList();
        else {
          if (total > 50) {
            report('Attempting to get more data &hellip;');
            let id = directoryHTML.match(/\{"memberId":"(.*?)"\}/)[1];
            let token = $(directoryDOM).find('input[name="token"]').val();
            var data = {
            	token,
            	version: 5,
            	authenticator: 'DEFAULT',
            	actions:JSON.stringify([{"name":"FETCH","resource":"modules.membercenter.model.ContentStreamComposite","params":	{"offset":50,"limit":50,"page":"PROFILE","memberId":"zP1qGhYGcXZiyNWNrBcHOQ=="},"id":"clientaction576"}])
            };
            $.post('https://www.tripadvisor.com/ModuleAjax?', data, null, 'json').done(function(response){
              // FIXME finish AJAX integration
              console.log(response.store['modules.unimplemented.entity.AnnotatedItem']);
            });
          }
          callback(reviews);
        }
      }
    }
  }
}

// FIXME: We'll want to move this into a separate file, but will need to do so
// in a manner that works both client & server-side.
function report(html, error) {
  if (typeof chrome !== 'undefined') {
    chrome.runtime.sendMessage({
      action: error ? 'error' : 'notice',
      html
    });
  } else {
    if (error)
      console.error('Error: ' + html);
    else
      console.log('Progress update: ' + html);
  }
}

// Convenience function
function reportError(html) {
  report(html, true);
}
