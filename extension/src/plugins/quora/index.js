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
      autoRetrieve: true
    });
    init = false;
    return false;
  }
  let author = $('meta[name="twitter:title"]').attr('content');
  var answerCount = Number($('.AnswersNavItem .list_count').text());
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
        let question = $answer.find('.question_text span').text();
        let questionLink = $answer.find('.question_link').attr('href');
        let questionURL = `https://www.quora.com${questionLink}`;
        let answerText = $answer.find('.ExpandedAnswer span').html();
        answerText = answerText
          .replace(/<p class=".*?">/g, '<p>') // Strip CSS
          .replace(/(<a href=".*?").*?>/g, "$1>") // Strip click handlers etc.
          .replace(/<\/?span.*?>/g, ''); // Strip spans completely

        // FIXME: needs transformation
        let date = $answer.find('.answer_permalink').text();
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
