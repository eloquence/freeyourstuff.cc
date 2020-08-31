/* global $, moment, numeral */
(function() {
  'use strict';

  const freeyourstuff = window.freeyourstuff,
    plugin = freeyourstuff.plugin,
    DataSet = freeyourstuff.DataSet,
    selectors = {
      menu: '.q-fixed.qu-fullX .q-inlineFlex.qu-overflow--hidden.qu-borderRadius--circle',
      answerCount: '.q-box.qu-overflowX--hidden.qu-whiteSpace--nowrap div.qu-borderColor--red',
      answerContent: '.spacing_log_answer_content',
      feedDiv: '.q-box.qu-borderBottom.qu-pt--small.qu-pb--small~div:not([class])'
    };

  // Dataset IDs and the function to retrieve that data in raw, uncoerced JSON
  freeyourstuff.jsonData = {
    answers: retrieveAnswers
  };

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

      retrieveAnswers()
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

  function loggedIn() {
    return $(selectors.menu).length > 0;
  }

  // The main coordinating function. Refactor potential in the execution loop.
  async function retrieveAnswers({ url } = {}) {

    // Open menu to get user ID and wait for page to finish loading
    await awaitInitialAJAXRequests();

    // Hackish, but seems to work across both menu versions once they are expanded.
    const profileLink= $('a[href="/content"]').parent().parent().parent().find('a').first().attr('href'),
        profileURL = url || `https://www.quora.com${profileLink}`,
        answersURL = `${profileURL}/answers`;

    if (decodeURI(window.location.href) != answersURL || $('#freeyourstuff-status').length) {
      plugin.report('Redirecting to answers list');
      plugin.redirect(answersURL);
      return false;
    }

    const author = $('title').text().split(' - Quora')[0],
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
    let displayedAnswerCount = $(selectors.answerContent).parent().length;

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
        // Quora uses an infinite scroll paradigm, which we can reliably trigger
        // by adding a large element to the bottom and scrolling to its top edge
        let $visible = $('<div id="scroll-position" style="height:2160px;"></div>');
        $(document.body).append($visible);
        let scrollTo = $('#scroll-position').position().top;
        window.scrollTo(0, scrollTo);
        window.scrollTo(0, 0);
        $visible.remove();
        // Returns 0 if it times out
        displayedAnswerCount = await pollForDisplayedAnswers(counter, tries, maxTries);
        // Throttle requests to avoid getting "Too many requests" errors
        await plugin.sleep(1000);
      } while (counter.progress < counter.total && !displayedAnswerCount && tries < maxTries);
    } while (displayedAnswerCount);

    // In-page update
    $('#freeyourstuff-status').html('<h3>Answers downloaded. ' +
      '<a href="javascript:window.location.reload(true)">' +
      'Reload this page</a></h3>');

    return answers;
  }

  async function awaitInitialAJAXRequests() {
    // We can't get the profile URL without opening the menu.
    $(selectors.menu).click();
    await plugin.awaitSelector('a[href="/content"]');
  }

  // Some long answers are collapsed by default and need AJAX requests to get the
  // whole thing.
  async function expandVisibleMoreLinks() {
    const moreLinks = $('.qt_read_more').toArray();
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
      wait = 5000;
      message = `Final check for missing answers`;
    } else {
      wait = 10000;
      message = `Loading more answers ` +
        `(${counter.progress} of ${counter.total} downloaded)`;
      if (attemptNumber > 1)
        message += ` - attempt ${attemptNumber}/${maxAttempts}`;
    }
    plugin.report(message);
    try {
      await plugin.awaitSelector(selectors.answerContent, 50, wait);
    } catch (_error) {
      return 0;
    }
    return $(selectors.answerContent).length;
  }

  // When you have a lot of answers, loading them all on one page will quickly
  // cause your computer to melt. So we remove the once we've extracted from the
  // DOM and show a nice status message.
  async function extractAndHideVisibleAnswers(counter) {
    const data = [],
      answers = $(selectors.answerContent).parent().toArray();
    for (let answer of answers) {
      const extractedAnswer = await extractAnswer($(answer));
      if (extractedAnswer) {
        data.push(extractedAnswer);
        counter.progress++;
        plugin.report(`Extracted ${counter.progress} of ${counter.total} answers`);
      }
    }
    if (!$('#freeyourstuff-status').length)
      $(selectors.feedDiv).before('<div id="freeyourstuff-status">' +
        '<h3>Answers will appear and disappear here while freeyourstuff.cc ' +
        'is downloading.</h3>');
    $(selectors.answerContent).parent().parent().parent().parent().parent().parent().remove();
    return data;
  }

  async function extractAnswer($answer) {

    const answerHTML= $answer.find(selectors.answerContent).find('div span').html(),
      $firstQuestionLink = $answer.find('div.q-flex.qu-mb--tiny a').first(),
      question = $firstQuestionLink.text(),
      questionLink = $firstQuestionLink.attr('href'),
      questionURL = /^https:\/\//.test(questionLink) ? questionLink : `https://www.quora.com${questionLink}`,
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

    // Strip external link indicators
    $answerText.find('a~svg').remove();

    const answerText = $answerText.html();
    $answerText.remove();

    // Quora displays dates in a pretty inconsistent way, ranging from
    // "8h ago" to "May 12, 2012" type formats. We try to parse all of them
    // correctly, but if there is an error-prone area in this code, it's
    // this one.
    const dateText = $answer.parent().find('.qu-color--gray a').first().text();

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
    const asText = $(selectors.answerCount).text().split(' ')[0];
    return numeral(asText).value();
  }
})();
