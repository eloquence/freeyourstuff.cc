(function() {
  'use strict';

  if (window.location.hash !== '#debug') {
    try {
      chrome.runtime.onMessage.addListener(displayHandler);
    } catch (e) {
      console.log('Chrome API not found. Loading outside of extension context with example data.');
      loadExample('yelp');
    }
  } else {
    loadExample('yelp');
  }

  function displayHandler(request) {
    if (request.action === 'display' && request.data && request.schema) {
      showData(request.data, request.schema);
      chrome.runtime.onMessage.removeListener(displayHandler);
    }
  }

  function loadExample(scriptName) {
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `examples/${scriptName}.js`;
    script.onload = showExampleData;
    document.body.appendChild(script);
  }

  function makeRenderFunction(rowName) {
    return (val, type, row) => {
      if (row[rowName])
        return `<a href="${row[rowName]}">${val}</a>`;
      else
        return val;
    };
  }

  function showExampleData() {
    showData(exampleData, exampleSchema);
  }

  // Message object properties:
  // text: 'text'
  // type: 'warning' | 'success' | 'error' (will be added as CSS class name)
  // retry: Whether we're showing the same message again (triggers animation)
  function showMessage(msg) {
    if (!msg.retry) {
      $('#messages').empty();
      $('#messages').append(`<div class="${msg.type} message">${msg.text}</div>`);
      $('#messages').show();
    } else {
      $('#messages').fadeOut().fadeIn();
    }
  }

  // retry: Whether this was user-triggered.
  function checkLoginStatus(retry) {
    $.get('https://freeyourstuff.cc/api/loginstatus').done(res => {
      // Hide previous warning messages
      $('#messages').hide();
      if (typeof res == 'object' && res.loggedIn) {
        $('#publish').show();
        $('#signedout').hide();
        clearInterval(window.interval);
      } else {
        $('#signedout').show();
        $('#publish').hide();
      }
    }).fail(err => {
      showMessage({
        text: `We can't reach freeyourstuff.cc right now, so you can't publish your data. Sorry! You can still download it or` +
          ` <a id="retry" href="#">retry connecting.</a>`,
        type: 'warning',
        retry
      }, true);
      $('#retry').off();
      $('#retry').click((e) => {
        e.preventDefault();
        checkLoginStatus(true);
      });
    });
  }

  function getLinkOpener(url) {
    return function() {
      $(this).prop('disabled', true);
      window.open(url);
      startPinging();
    };
  }

  function startPinging() {
    $('#pinging').show();
    window.interval = setInterval(checkLoginStatus, 1000);
  }

  function stopPinging() {
    $('#facebook,#google,#twitter,#local').prop('disabled', false);
    clearInterval(window.interval);
    $('#pinging').fadeOut();
  }

  function getPublishClickHandler(json) {
    return function(e) {
      $('#publish').prop('disabled', true); // Prevent repeat submission
      $.ajax({
        type: 'POST',
        contentType: 'application/json',
        url: 'https://freeyourstuff.cc/api/siteset',
        data: json,
        dataType: 'json'
      }).done(res => {
        $('#publish').hide();
        showMessage({
          text: 'Your data was successfully published! Thank you for contributing to the commons. :-)',
          type: 'success'
        });
      }).fail(err => {
        $('#publish').prop('disabled', false);

        let text = 'There was a problem publishing your data. Sorry! :-(';
        if (err.responseJSON.error) {
          text += ' We got the following error message:' +
            `<br><br><code>${err.responseJSON.error}</code>`;
        }
        text += '<br><br>You can help us out by ' +
          '<a target="_blank" href="https://github.com/eloquence/freeyourstuff.cc/issues/new">filing a bug</a>.';
        showMessage({
          text,
          type: 'error'
        });
      });
    };
  }

  function showData(data, schema) {

    let json = JSON.stringify(data, null, 2);
    // We need to URI-encode it so we can stash it into the href attribute
    let encodedJSON = encodeURIComponent(json);
    $('#download').attr('href', `data:application/json;charset=utf-8,${encodedJSON}`);
    $('#download').attr('download', 'data.json');

    $('#publish').click(getPublishClickHandler(json));
    $('#facebook').click(getLinkOpener('https://freeyourstuff.cc/auth/facebook'));
    $('#twitter').click(getLinkOpener('https://freeyourstuff.cc/auth/twitter'));
    $('#google').click(getLinkOpener('https://freeyourstuff.cc/auth/google'));
    $('#local').click(getLinkOpener('https://freeyourstuff.cc/signin'));
    $('#stop').click(stopPinging);

    checkLoginStatus();

    if (data.schemaKey !== schema.schema.key) {
      throw new Error('Schemas do not match. Cannot process data.');
    }

    for (let setName in data) {
      // Exclude metadata
      if (setName == 'schemaKey' || setName == 'schemaVersion')
        continue;

      let columns = [];
      let fields = [];

      $('#results').append(`<h3>${schema[setName].label.en}</h3>`);

      // Show header information
      if (data[setName].head) {
        $('#results').append(`<table id="result_${setName}_header" class="headerTable"></table>`);
        for (let headerKey in data[setName].head) {
          let rowValue = data[setName].head[headerKey];
          if (schema[setName].head[headerKey].type == 'weburl')
            rowValue = `<a href="${rowValue}">${rowValue}</a>`;

          // Show the header field's description as title attribute if we have one
          let title = '';
          if (schema[setName].head[headerKey].description)
            title = `class="headerKey" title="${schema[setName].head[headerKey].description.en}"`;

          let row = `<tr><td class="headerCell">` +
            `<span ${title}>${schema[setName].head[headerKey].label.en}</span>` +
            `</td><td>${rowValue}</td></tr>`;
          $(`#result_${setName}_header`).append(row);
        }
      }


      // Loop through each data object in the set
      for (let dataObj of data[setName].data) {
        // Aggregate information from the schema as we go --
        // this way we only have metadata we have actual data for
        for (let prop in dataObj) {
          if (fields.indexOf(prop) == -1) {
            if (!schema[setName].data[prop].describes) {
              columns.push({
                data: prop,
                title: schema[setName].data[prop].label.en,
                defaultContent: ''
              });
              fields.push(prop);
            } else {
              // We're encountering data that "describes" other data, i.e. a URL
              // for some text elsewhere. Let's locate the relevant column and
              // add a render function if it doesn't already have one.
              for (let col of columns) {
                if (col.data == schema[setName].data[prop].describes) {
                  if (!col.render)
                    col.render = makeRenderFunction(prop);
                  break;
                }
              }
            }
          }
        }
      }
      if (Array.isArray(data[setName].data) && data[setName].data.length) {
        $('#results').append(`<table id="result_${setName}" class="table table-hover table-responsive">`);
        $(`#result_${setName}`).dataTable({
          "data": data[setName].data,
          "columns": columns
        });
      } else {
        $('#results').append('No data of this type included in the set.');
      }
    }
  }
})();
