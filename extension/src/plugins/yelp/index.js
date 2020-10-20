/* global $ */
(function() {
  'use strict';

  const freeyourstuff = window.freeyourstuff,
    plugin = freeyourstuff.plugin,
    DataSet = freeyourstuff.DataSet;

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
    return $('a[href^="/login"]').length == 0;
  }

  async function retrieveReviews({ url } = {}) {
    let page = 1;
    const reviews = {
      head: {},
      data: []
    };
    if (!url)
      url = 'https://www.yelp.com/user_details_reviews_self';

    do {

      const html = await plugin.getURL(url),
        $dom = $($.parseHTML(html));

      if (page === 1) {
        reviews.head.reviewerName = $dom.find('.user-profile_info h1').text();
        let idLink = $dom.filter('meta[property="og:url"]').attr('content');
        reviews.head.reviewerID = (idLink.match(/userid=(.*)/) || [])[1];
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

      // The second check is for logged out profile views
      url = $dom.find('.pagination-links .next').attr('href') ||
        $dom.find('.pagination-block > a').attr('href');

      if (url) {
        page++;
        // Obtain and relay progress info
        let totalPages = ($dom
          .find('.page-of-pages')
          .text()
          .match(/\d+.*?(\d+)/) || [])[1] || 'unknown number of pages';
        plugin.report(`Fetching page ${page} of ${totalPages}`);
      }
    } while (url);
    return reviews;
  }
})();
