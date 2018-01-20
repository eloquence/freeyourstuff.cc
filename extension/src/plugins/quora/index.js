/* global DataSet, $, plugin, moment, numeral */
(function() {
  'use strict';

  plugin.setup([handleRetrieval]);

  function handleRetrieval(request) {
    if (request.action == 'retrieve') {
      // Note AJAX requests may not have completed yet, so we must check for
      // stuff that's certain to be present
      if (!loggedIn())
        return plugin.loggedOut();

      plugin.busy();

      let datasets = {};
      datasets.schemaKey = request.schema.schema.key;
      datasets.schemaVersion = request.schema.schema.version;


      awaitInitialAJAXRequests()
        .then(retrieveAnswers)
        .then(answers => {
          if (answers) {
            datasets.answers = new DataSet(answers, request.schema.answers).set;
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

  async function awaitInitialAJAXRequests() {
    plugin.report('Waiting for page to finish loading');
    await plugin.awaitSelector('.hover_menu_item');
  }

  // The second check should succeed for a logged in user even if AJAX requests
  // haven't completed yet.
  function loggedIn() {
    return $('.hover_menu_item').length > 0 ||
      $('.SiteHeaderNavItem.HoverMenu.MoreNavItem').length > 0;
  }

  // The main coordinating function. Refactor potential in the execution loop.
  async function retrieveAnswers() {
    const profileLink = $('.hover_menu_item').first().attr('href'),
      profileURL = `https://www.quora.com${profileLink}`,
      answersURL = `${profileURL}/answers`;

    if (decodeURI(window.location.href) != answersURL || $('#freeyourstuff-status').length) {
      plugin.report('Redirecting to answers list');
      chrome.runtime.sendMessage({
        action: 'redirect',
        url: answersURL,
        autoRetrieve: true
      });
      return false;
    }

    const author = $('meta[name="twitter:title"]').attr('content'),
      answerCount = extractAnswerCount(),
      answers = {
        head: {
          author,
          profileURL
        },
        data: []
      },
      counter = {
        progress: 0,
        total: answerCount
      };
    let displayedAnswerCount = $('.AnswerListItem').length;

    if (answerCount) {
      plugin.report(`Preparing download of ${answerCount} answers`);
      // Quora lazy-loads some answers immediately; since that lazy load behavior
      // is hard to predict, we have some initial buffer time
      await plugin.waitFor(3000);
    }
    do {
      await expandVisibleMoreLinks();
      const a = await extractAndHideVisibleAnswers(counter);
      answers.data.push(...a);
      let tries = 0,
        maxTries = 5;
      // In case of timeouts or slow connections, we try repeatedly to load the
      // next page
      do {
        tries++;
        $('.pager_next').each(function() {
          this.click();
        });
        // Returns 0 if it times out
        displayedAnswerCount = await pollForDisplayedAnswers(counter, tries, maxTries);
      } while (counter.progress < counter.total && !displayedAnswerCount && tries < maxTries);
    } while (displayedAnswerCount);

    // In-page update
    $('#freeyourstuff-status').html('<h3>Answers downloaded. ' +
      '<a href="javascript:window.location.reload(true)">' +
      'Reload this page</a></h3>');

    return answers;
  }

  // Some long answers are collapsed by default and need AJAX requests to get the
  // whole thing.
  async function expandVisibleMoreLinks() {
    const moreLinks = $('a.ui_qtext_more_link:visible').toArray();
    for (let moreLink of moreLinks) {
      moreLink.click();
      await waitForElementToBeHidden(moreLink);
    }
  }

  // This can probably be refactored -- we buffer for the "more" expansion twice,
  // here and further below.
  function waitForElementToBeHidden(element) {
    return new Promise((resolve, reject) => {

      const pollElement = () => {
        const visible = $(element).filter(':visible').length > 0;
        if (!visible) {
          clearInterval(i);
          return resolve();
        }
        elapsed += interval;
        if (elapsed > timeout) {
          clearInterval(i);
          return reject(new Error(`Answer did not expand after ${timeout} milliseconds.`));
        }
      };

      let elapsed = 0,
        interval = 25,
        timeout = 10000;

      const i = setInterval(pollElement, interval);
    });
  }

  async function pollForDisplayedAnswers(counter, attemptNumber, maxAttempts) {
    let wait, message;
    if (counter.progress == counter.total) {
      wait = 2500;
      message = `Final check for missing answers`;
    } else {
      wait = 5000;
      message = `Loading more answers ` +
        `(${counter.progress} of ${counter.total} downloaded)`;
      if (attemptNumber > 1)
        message += ` - attempt ${attemptNumber}/${maxAttempts}`;
    }
    plugin.report(message);
    try {
      await plugin.awaitSelector('.AnswerListItem', 50, wait);
    } catch (_error) {
      return 0;
    }
    return $('.AnswerListItem').length;
  }

  // When you have a lot of answers, loading them all on one page will quickly
  // cause your computer to melt. So we remove the once we've extracted from the
  // DOM and show a nice status message.
  async function extractAndHideVisibleAnswers(counter) {
    const data = [],
      answers = $('.AnswerListItem').toArray();
    for (let answer of answers) {
      const extractedAnswer = await extractAnswer($(answer));
      if (extractedAnswer) {
        data.push(extractedAnswer);
        counter.progress++;
        plugin.report(`Extracted ${counter.progress} of ${counter.total} answers`);
      }
    }
    if (!$('#freeyourstuff-status').length)
      $('.AnswerListItem').first().before('<div id="freeyourstuff-status">' +
        '<h3>Answers will appear and disappear here while freeyourstuff.cc ' +
        'is downloading.</h3>');
    $('.AnswerListItem').remove();
    return data;
  }

  // Okay, this probably wants to be refactored :-). Much of the complexity
  // is in a) anticipating AJAX requests, b) dealing with dates.
  async function extractAnswer($answer) {

    // Before anything else, attempt to get the long-form answer and re-try
    // if it's not rendered yet. Given Quora's asynchronous loading
    // strategies, this is necessary to avoid "undefined" answers.
    const getAnswerHTML = () => $answer.find('.ui_qtext_expanded span').html();
    let answerHTML,
      elapsedTime = 0,
      waitIncrement = 50, // 500 must be divisible by this number, see below
      maxTime = 30000;

    while ((answerHTML = getAnswerHTML()) === undefined) {
      const $moreLink = $answer.find('a.ui_qtext_more_link').first();
      // Sometimes the first request times out, so we try again every .5 seconds
      if (elapsedTime > 500 && elapsedTime % 500 === 0 && $moreLink.length) {
        $moreLink[0].click();
      }

      if (elapsedTime >= maxTime) {
        plugin.report('Could not obtain answer, skipping');
        return;
      }
      await plugin.waitFor(waitIncrement);
      elapsedTime += waitIncrement;
    }

    const question = $answer.find('.question_text span').first().text(),
      questionLink = $answer.find('.question_link').first().attr('href'),
      questionURL = `https://www.quora.com${questionLink}`,
      // We create a new jQuery node so we don't unnecessarily
      // change the visible page content
      $answerText = $('<div>' + answerHTML + '</div>');

    // Strip Quora-specific embed code
    $answerText.find('div.qtext_embed').each((ind, ele) => {
      $(ele).replaceWith($(ele).attr('data-embed'));
    });
    $answerText.find('iframe').removeAttr('width').removeAttr('height');

    // Replace MathJax with its original TeX source
    $answerText.find('span.render_latex').each((ind, ele) => {
      $(ele).replaceWith('[math]' + $(ele).find('script[type="math/tex"]').text() + '[/math]');
    });

    // Strip misc. attributes
    $answerText.find('a,img,p').removeAttr('rel target onclick class onmouseover data-tooltip master_w master_h master_src');

    // Remove divs and spans completely, but keep their contents
    $answerText.find('span,div').contents().unwrap();

    const answerText = $answerText.html();

    // Quora displays dates in a pretty inconsistent way, ranging from
    // "8h ago" to "May 12, 2012" type formats. We try to parse all of them
    // correctly, but if there is an error-prone area in this code, it's
    // this one.
    const dateText = ($answer.find('.answer_permalink').text().match(/(Written|Updated|Answered) (.*)/) || [])[2];
    let date;
    if (/^\d{1,2}(h|m|s) ago$/.test(dateText)) {
      const match = dateText.match(/^(\d{1,2})(m|h|s)/),
        ago = match[1],
        unit = match[2];
      date = moment().subtract(ago, unit).format('YYYY-MM-DD');
    } else if (/^Mon|Tue|Wed|Thu|Fri|Sat|Sun$/.test(dateText)) {
      // Map Quora's date strings to moment values that return the most
      // recent day with this name
      const dayToDay = {
        'Mon': -6,
        'Tue': -5,
        'Wed': -4,
        'Thu': -3,
        'Fri': -2,
        'Sat': -1,
        'Sun': 0
      };
      date = moment().day(dayToDay[dateText]).format('YYYY-MM-DD');
    } else if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/.test(dateText)) {
      const month = dateText.substr(0, 3),
        dayOfMonth = Number(dateText.match(/\d{1,2}/));
      date = moment().month(month).date(dayOfMonth);

      // Quora also does not always qualify months in the previous year,
      // so we reinterpret if it would otherwise result in a future date
      if (date.isAfter(moment()))
        date = moment().year(moment().year() - 1).month(month).date(dayOfMonth);

      date = date.format('YYYY-MM-DD');
    } else {
      date = moment(new Date(dateText));
      if (date._d == 'Invalid Date')
        date = undefined;
      else
        date = date.format('YYYY-MM-DD');
    }

    return {
      question,
      questionURL,
      answer: answerText,
      date
    };

  }

  // The answer count may have a thousands separator. This function uses the
  // numeral library to deal with it.
  function extractAnswerCount() {
    const asText = $('.AnswersNavItem .list_count').text();
    return numeral(asText).value();
  }
})();
