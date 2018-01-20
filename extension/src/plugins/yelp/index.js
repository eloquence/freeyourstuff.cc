/* global DataSet, $, plugin */
(function() {
  'use strict';

  // JSON result comparison tests to be run by NodeJS/JSDOM test runner
  // eslint-disable-next-line no-unused-vars
  window.jsonTests = {
    reviews: retrieveReviews
  };

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
          datasets.reviews = new DataSet(reviews, request.schema.reviews).set;
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
    return Boolean($('.user-account .user-display-name').html());
  }

  async function retrieveReviews() {
    let page = 1;
    const reviews = {
      head: {},
      data: []
    };
    let url = 'https://www.yelp.com/user_details_reviews_self';

    do {

      const html = await plugin.getURL(url),
        $dom = $($.parseHTML(html));

      if (page === 1) {
        let idLink = $dom.find('.user-display-name');
        reviews.head.reviewerName = idLink.text();
        reviews.head.reviewerID = (idLink.attr('href').match(/userid=(.*)/) || [])[1];
      }

      // Helper functions common to different review types
      const getRating = $root => (($root
          .find("[class^='i-stars i-stars']")
          .attr('class') || '')
        .match(/[0-9]/) || [])[0];

      const getDate = $root => {
        let qualifiers = $root
          .find('.rating-qualifier')
          .text(); // TODO: other qualifiers
        let date = (qualifiers.match(/(\d+\/\d+\/\d+)/) || [])[1];
        return plugin.getISODate(date);
      };

      // Parse contents
      $dom.find('div.review').each((i, e) => {

        let $e = $(e);

        const text = $e
          .find('.review-content p')
          .first()
          .html(),

          subject = $e
          .find('.biz-name')
          .text();

        let subjectYelpURL;
        const base = 'https://yelp.com';
        const path = $e
          .find('.biz-name')
          .attr('href');

        if (path)
          subjectYelpURL = base + path;

        const checkins = $e
          .find("[class$='checkin_c-common_sprite-wrap review-tag']")
          .text()
          .match(/\d+/) || undefined;

        reviews.data.push({
          subject,
          subjectYelpURL,
          date: getDate($e),
          text,
          starRating: getRating($e),
          checkins
        });

        // Process older reviews
        $e.find('.previous-review').each((j, p) => {
          const $p = $(p),
            text = $p.find('.hidden').html();
          reviews.data.push({
            subject,
            subjectYelpURL,
            date: getDate($p),
            text,
            starRating: getRating($p)
          });
        });
      });

      url = $dom.find('.pagination-links .next').attr('href');
      if (url) {
        page++;
        // Obtain and relay progress info
        let totalPages = ($dom
          .find('.page-of-pages')
          .text()
          .match(/\d+.*?(\d+)/) || [])[1];
        plugin.report(`Fetching page ${page} of ${totalPages}`);
      }
    } while (url);
    return reviews;
  }
})();
