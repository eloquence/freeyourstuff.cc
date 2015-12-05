'use strict';
if (!init) {
  chrome.runtime.onMessage.addListener(request => {
    if (request.action == 'retrieve') {
      if (!loggedIn()) {
        chrome.runtime.sendMessage({
          loggedOut: true
        });
        return false;
      }
      let datasets = [];
      retrieveReviews(reviews => {
        datasets.push(new DataSet(reviews, request.schemas.reviews).set);
        chrome.runtime.sendMessage({
          datasets
        });
      });
    }
  });
  // Prevent repeated initialization
  var init = true;
}

function loggedIn() {
  return Boolean($('.user-account .user-display-name').html());
}

function retrieveReviews(callback) {
  let page = 1;
  let reviews = {
    head: {},
    data: []
  };
  let firstURL = 'http://www.yelp.com/user_details_reviews_self';
  $.get(firstURL).done(processPage);

  function processPage(html) {
    let dom = $.parseHTML(html);
    if (page === 1) {
      let idLink = $(dom).find('.user-display-name');
      reviews.head.reviewerName = idLink.text();

      let idMatch;
      if ((idMatch = idLink.attr('href').match(/userid=(.*)/)))
        reviews.head.reviewerID = idMatch[1];
    }

    // Parse contents
    $(dom).find('div.review').each((i, e) => {
      let text = $(e).find('.review-content p').first().html();
      let subject = $(e).find('.biz-name').text();
      let subjectYelpURL = 'http://yelp.com' + $(e).find('.biz-name').attr('href');
      let date = $(e).find('.rating-qualifier').text().trim(); // TODO: other qualifiers

      let starRatingClass = $(e).find("[class^='star-img stars_']").attr('class');

      let starRatingMatch, starRating;
      if ((starRatingMatch = starRatingClass.match(/[0-9]/)))
        starRating = starRatingMatch[0];

      let checkins = $(e).find("[class$='checkin_c-common_sprite-wrap review-tag']")
        .text().match(/\d+/);

      let reviewObj = {
        subject,
        subjectYelpURL,
        date,
        text,
        starRating
      };
      if (checkins)
        reviewObj.checkins = checkins;

      reviews.data.push(reviewObj);
    });

    let nextURL = $(dom).find('.prev-next.next').attr('href');
    if (nextURL) {
      page++;
      // Obtain and relay progress info
      let totalPageMatch, totalPages;
      if ((totalPageMatch = $(dom).find('.page-of-pages').text().match(/\d+.*?(\d+)/)))
        totalPages = totalPageMatch[1];
      let progress = `Fetching page ${page} of ${totalPages} &hellip;`;
      chrome.runtime.sendMessage({
        progress: progress
      });

      // Fetch next page
      $.get(nextURL).done(processPage);
    } else {
      callback(reviews);
    }
  }
}
