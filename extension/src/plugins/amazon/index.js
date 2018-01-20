/* global $, plugin, DataSet, numeral */
(function() {
  'use strict';

  // By default we assume we're on Amazon.com
  let edition = 'com';

  plugin.setup([handleRetrieval]);

  function handleRetrieval(request) {
    if (request.action == 'retrieve') {
      // Set edition based on hostname.
      let m = window.location.hostname.match(/amazon\.(.*)$/);
      if (m)
        edition = m[1];

      if (!loggedIn())
        return plugin.loggedOut();

      plugin.busy();

      if (window.location.protocol == 'http:') {
        plugin.reportError(null, `Please visit <a href="https://www.amazon.${edition}/" target="_blank">the HTTPS version</a> of Amazon.${edition}.`);
        return false;
      }
      let datasets = {};
      datasets.schemaKey = request.schema.schema.key;
      datasets.schemaVersion = request.schema.schema.version;
      retrieveReviews()
        .then(reviews => {
          // May resolve empty if a problem was fully handled downstream.
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
    // "Sign in" link is part of DOM for logged out users when
    // document.readyState == complete
    return !($('#nav-flyout-ya-signin').length);
  }

  async function retrieveReviews() {
    const reviews = {
      head: {}
    };

    // Amazon has two profile variants in the wild which behave very differently.
    // Depending which edition we're on, we need to branch accordingly below.
    const newProfile = edition === 'com' ? true : false,
      profileURL = `https://www.amazon.${edition}/gp/profile/`,
      profileRegex = new RegExp(`^https://www\\.amazon\\.${edition}/gp/profile/`),
      actualURL = decodeURI(window.location.href);

    // If we attempt to load the profile and the user has not recently validated
    // their password, we are redirected to the sign-in page, even if we are
    // "logged in". In this case we have to prompt the user to sign in.
    if (window.location.pathname == '/ap/signin') {
      plugin.clearMessages();
      plugin.reportError(null, `Sorry, you are not fully logged in yet. Please sign in, then start the process again.`);
      return false;
    }

    // Navigate to profile if needed
    if (!profileRegex.test(actualURL)) {
      plugin.report('Redirecting to profile page');
      chrome.runtime.sendMessage({
        action: 'redirect',
        url: profileURL,
        autoRetrieve: true
      });
      return false;
    }

    plugin.report('Waiting for page to load');

    await plugin.awaitSelectors(['.name-container', '.dashboard-desktop-stat-value span']);
    reviews.head.reviewerName = $('.name-container span').text();
    reviews.head.reviewerURL = normalizeURL(window.location.href);

    const counter = {
      // These counts are approximate and even sometimes wrong
      total: extractReviewCount(),
      progress: 0
    };

    if (newProfile)
      reviews.data = await retrieveReviewsFromNewProfile(counter);
    else
      reviews.data = await retrieveReviewsFromOldProfile(counter, profileURL);

    return reviews;
  }

  async function retrieveReviewsFromOldProfile(counter, profileURL) {
    const reviews = [];
    if (counter.total > 0) {
      const feedURL = `${profileURL}/activity_feed`;
      let offset = 0;
      do {
        const result = await plugin.getURL(feedURL, { review_offset: offset });
        offset = null;
        if (!result || !result.reviews)
          break;
        counter.progress += result.reviews.length;
        plugin.report(`Received ${counter.progress} of ~${counter.total} reviews`);
        if (result.nextOffset)
          offset = result.nextOffset;

        for (let review of result.reviews) {
          // Remove analytics
          if (review.urls.productUrl)
            review.urls.productUrl = review.urls.productUrl.split('?')[0];
          // Video URLs are not included with this API, unfortunately
          const product = review.productTitle,
            productURL = `https://www.amazon.${edition}${review.urls.productUrl}`,
            headline = review.title,
            date = plugin.getISODate(review.date),
            text = review.textArray.join('<br>'),
            starRating = review.ratingToInteger;

          reviews.push({
            product,
            productURL,
            headline,
            date,
            text,
            starRating
          });
        }
      } while (offset !== null);
    }
    return reviews;
  }

  async function retrieveReviewsFromNewProfile(counter) {
    const reviews = [];
    let $dom = $(document);

    if (counter.total > 0) {
      // Make sure we have at least one card loaded
      await plugin.awaitSelector('.a-row.glimpse-card-main');
      let hasMore;

      do {
        let paginationToken = $dom.find('[data-pagination-token]').attr('data-pagination-token');
        let paginationURL = $dom.find('[data-url]').attr('data-url');
        let paginationContext = $dom.find('[data-feed-context]').attr('data-feed-context');
        hasMore = Boolean(paginationToken && paginationURL);

        const retrievedReviews = await getReviewsViaDOM($dom, counter);
        reviews.push(...retrievedReviews);
        if (hasMore) {
          // Wrapping <div> is necessary for .find()
          const nextPage = '<div>' + await plugin.getURL(paginationURL, {
            token: paginationToken,
            context: paginationContext,
            preview: false,
            dogfood: false
          }) + '</div>';
          $dom = $($.parseHTML(nextPage));
        }
      } while (hasMore);
      return reviews;
    }
  }

  // Unfortunately placement in the table is the only way to identify the review
  // count, but it appears to at least be consistent across editions
  function extractReviewCount() {
    let asText = $('.dashboard-desktop-stat-value span')
      .eq(1)
      .text();

    return numeral(asText).value();
  }

  async function getReviewsViaDOM($dom, counter) {
    const reviews = [];
    const cards = $dom.find('[data-story-id^="Glimpse:REVIEW"]').toArray();
    for (let card of cards) {
      counter.progress++;
      let $title = $(card).find('.glimpse-product-title');
      let title = $title.text();
      let url = $title.parents('a').attr('href');
      plugin.report(`Fetching review ${counter.progress} of ~${counter.total}: ${title}`);
      let html = await plugin.getURL(url);

      let $dom = $($.parseHTML(html, null, true));

      let $review = $dom.find('.review');
      let $productLink, product, productURL, headline, date, text, starRating;

      $productLink = $dom.find('a[data-hook="product-link"]');
      product = $productLink.text();
      productURL = $productLink.attr('href');
      productURL = normalizeURL(productURL);
      headline = $review.find('[data-hook="review-title"]').text();
      let $text = $review.find('.review-text').first();

      let videoURL;
      // Extract video URL, if any
      if ($text.find('[id^=airy-player]').length) {
        videoURL = ($text
          .find('div script:not([src])')
          .text()
          .match(/"streamingUrls":"(.*?)"/) || [])[1];
      }
      // Remove all divs, span, script incl. contents. Since reviews cannot
      // contain formatting, and images (not yet supported) are underneath the
      // review text, this seems to only affect the video player.
      $text.find('div,span,script').remove();
      text = $text.html();

      date = $review.find('.review-date').first().text();
      date = date.replace(/^ on/, '');
      date = plugin.getISODate(date);

      // We ignore decimals, although the number is exressed as "3.0" etc.
      // this seems to be only used for averages
      starRating = ($review
        .find('.a-icon-alt')
        .text()
        .match(/^\d/) || [])[0];

      const reviewObj = {
        product,
        productURL,
        headline,
        date,
        text,
        starRating,
        videoURL
      };
      reviews.push(reviewObj);
    }
    return reviews;
  }

  // We normalize URLs by stripping the referral string
  function normalizeURL(url) {
    if (/\/ref=.*/.test(url))
      url = url.match(/(.*\/)(ref=.*)?/)[1];
    if (!/^http/.test(url))
      url = `https://www.amazon.${edition}${url}`;
    return url;
  }
})();
