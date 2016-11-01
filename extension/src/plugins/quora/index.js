'use strict';
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
      retrieveAnswers(answers => {
        datasets.answers = new DataSet(answers, request.schema.answers).set;
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
  return $('.hover_menu_item').length > 0;
}

function retrieveAnswers(callback) {
  let profileLink = $('.hover_menu_item').first().attr('href');
  let profileURL = `https://www.quora.com${profileLink}`;
  let answersURL = `${profileURL}/answers`;

  if (decodeURI(window.location.href) != answersURL) {
    plugin.report('Redirecting to answers list &hellip;');
    chrome.runtime.sendMessage({
      action: 'redirect',
      url: answersURL,
      autoRetrieve: true,
      delay: 3000
    });
    init = false;
    return false;
  }

  let author = $('meta[name="twitter:title"]').attr('content');
  // Final search & replace is to remove thousands separators
  var answerCount = Number($('.AnswersNavItem .list_count').text().replace(/,/g,''));
  let head = {
    author,
    profileURL
  };
  getNext();

  function getNext() {
    $('.pager_next').click();
    $('.more_link:visible').each(function() {
      this.click();
    });
    var displayedAnswerCount = $('.AnswerListItem').length;
    plugin.report(`Expanded ${displayedAnswerCount} of ${answerCount} answers &hellip;`);
    if (displayedAnswerCount < answerCount) {
      setTimeout(getNext, 500);
    } else {
      plugin.report('Waiting for data &hellip;');
      let wait = 0;
      let increments = 100;
      let maxWait = 6000; // 10 minutes
      let interval = setInterval(() => {
        if ($('.ExpandedAnswer').length >= answerCount) {
          clearInterval(interval);
          transformAnswers();
        } else {
          wait += increments;
          if (wait >= maxWait) {
            clearInterval(interval);
            plugin.reportError(`We don't seem to be getting all the answers. Sorry! :-(`);
            return;
          }
        }
      }, increments);
    }

    function transformAnswers() {
      plugin.report('Transforming data &hellip;');
      let data = [];
      $('.AnswerListItem').each((index, answer) => {
        let $answer = $(answer);
        let question = $answer.find('.question_text span').first().text();
        let questionLink = $answer.find('.question_link').first().attr('href');
        let questionURL = `https://www.quora.com${questionLink}`;

        // We create a new jQuery node so we don't unnecessarily
        // change the visible page content
        let $answerText = $('<div>' + $answer.find('.ExpandedAnswer span').html() + '</div>');

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

        let answerText = $answerText.html();

        // Quora displays dates in a pretty inconsistent way, ranging from
        // "8h ago" to "May 12, 2012" type formats. We try to parse all of them
        // correctly, but if there is an error-prone area in this code, it's
        // this one.
        let dateText = ($answer.find('.answer_permalink').text().match(/(Written|Updated) (.*)/) || [])[2];
        let date;
        if (/^\d{1,2}(h|m|s) ago$/.test(dateText)) {
          let match = dateText.match(/^(\d{1,2})(m|h|s)/);
          let ago = match[1];
          let unit = match[2];
          date = moment().subtract(ago, unit).format('YYYY-MM-DD');
        } else if (/^Mon|Tue|Wed|Thu|Fri|Sat|Sun$/.test(dateText)) {
          // Moment week begins with Sunday. 'Sun' in Quora always refers to most recent Sunday,
          // 'Sat' to most recent Saturday.
          let dayToDay = {
            'Mon': 1,
            'Tue': 2,
            'Wed': 3,
            'Thu': 4,
            'Fri': 5,
            'Sat': -1,
            'Sun': 0
          };
          date = moment().day(dayToDay[dateText]).format('YYYY-MM-DD');
        } else if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/.test(dateText)) {
          let month = dateText.substr(0, 3);
          let dayOfMonth = Number(dateText.match(/\d{1,2}/));
          date = moment().month(month).date(dayOfMonth);

          // Quora also does not always qualify months in the previous year,
          // so we reinterpret if it would otherwise result in a future date
          if (date.isAfter(moment()))
            date = moment().year(moment().year()-1).month(month).date(dayOfMonth);

          date = date.format('YYYY-MM-DD');
        } else {
          date = moment(dateText);
          if (date._d == 'Invalid Date')
            date = undefined;
          else
            date = date.format('YYYY-MM-DD');
        }

        data.push({
          question,
          questionURL,
          answer: answerText,
          date
        });
      });


      let answers = {
        head,
        data
      };
      callback(answers);
    }
  }
}
