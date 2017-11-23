/* global $, exampleData, exampleSchema */
(function() {
  'use strict';

  // Can be overridden by granting different permission in manifest.json
  const defaultBaseURL = 'https://freeyourstuff.cc/';

  if (typeof chrome !== 'undefined' && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(displayHandler);
  } else {
    console.log('Chrome API not found. Loading outside of extension context with example data.');
    loadExample('yelp');
  }

  function getPermissions() {
    return new Promise(function(resolve) {
      chrome.permissions.getAll(permissions => {
        resolve(permissions);
      });
    });
  }

  function displayHandler(request) {
    if (request.action === 'display' && request.data && request.schema) {
      getPermissions().then(permissions => {

        let baseURL;

        // If we have a cross-origin permission defined in manifest.json,
        // we use it for the base URL, matching up to (and including) the
        // first slash.
        baseURL = permissions && permissions.origins && permissions.origins[0] ?
          permissions.origins[0].match(/.*\//)[0] : defaultBaseURL;
        // For debugging / inspection
        window.siteSet = request.data;
        showData(request.data, request.schema, baseURL);
        chrome.runtime.onMessage.removeListener(displayHandler);
      });
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
    showData(exampleData, exampleSchema, defaultBaseURL);
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
  function checkLoginStatus(retry, baseURL, loginTab) {
    $.get(`${baseURL}api/loginstatus`).done(res => {

      // Hide previous warning messages
      $('#messages').hide();
      if (typeof res == 'object' && res.loggedIn) {
        let userLink = `<a href="${baseURL}user/${res.id}" target="_blank">${res.displayName}</a>`;
        $('#loginInfoLink').html(userLink);
        $('#loginInfo').show();
        $('#licenseInfo').show();
        $('#licenseSelector').show();
        $('#publish').show();
        $('#signedout').hide();
        clearInterval(window.interval);
        if (loginTab) {
          chrome.tabs.remove(loginTab.id, () => {
            // Reading the property suppresses error on console if tab has been closed
            if (chrome.runtime.lastError);
          });
        }
      } else {
        $('#signedout').show();
        $('#publish').hide();
        $('#licenseSelector').hide();
        $('#licenseInfo').hide();
        $('#loginInfo').hide();
      }
    }).fail(_err => {
      showMessage({
        text: `We can't reach freeyourstuff.cc right now, so you can't publish your data. Sorry! You can still download it or` +
          ` <a id="retry" href="#">retry connecting.</a>`,
        type: 'warning',
        retry
      }, true);
      $('#retry').off();
      $('#retry').click((e) => {
        e.preventDefault();
        checkLoginStatus(true, baseURL);
      });
    });
  }

  // Once the user clicks any of the login links (local, Google, Facebook, etc.),
  // we start pinging the site in the background so that once the user
  // is logged in, the "Publish" button automagically appears
  function getLinkOpener(url, baseURL) {
    return function() {
      $(this).prop('disabled', true);
      chrome.tabs.create({
        url
      }, (loginTab) => {
        startPinging(baseURL, loginTab);
      });
    };
  }

  function startPinging(baseURL, loginTab) {
    $('#pinging').show();
    window.interval = setInterval(() => {
      checkLoginStatus(false, baseURL, loginTab);
    }, 1000);
  }

  function stopPinging() {
    $('#facebook,#google,#twitter,#local').prop('disabled', false);
    clearInterval(window.interval);
    $('#pinging').fadeOut();
  }

  function getPublishClickHandler(data, baseURL) {
    return function(_e) {
      data.license = $('#publish').val();
      let json = JSON.stringify(data, null, 2);

      $('#publish').prop('disabled', true); // Prevent repeat submission
      $.ajax({
        type: 'POST',
        contentType: 'application/json',
        url: `${baseURL}api/siteset`,
        data: json,
        dataType: 'json'
      }).done(_res => {
        $('#publish').hide();
        $('#licenseSelector').hide();
        let link = $('#loginInfoLink a').attr('href');
        let published = link ? `<a href="${link}" target="_blank">published</a>` : 'published';
        let text = `Your data was successfully ${published}! Thank you for contributing to the commons. :-)`;

        showMessage({
          text,
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

  function showData(data, schema, baseURL) {

    let blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    $('#download').attr('href', window.URL.createObjectURL(blob));
    $('#download').attr('download', 'data.json');

    $('#publish').click(getPublishClickHandler(data, baseURL));
    $('#licenseSelector a').click(licenseClickHandler);
    $('#facebook').click(getLinkOpener(`${baseURL}auth/facebook`, baseURL));
    $('#twitter').click(getLinkOpener(`${baseURL}auth/twitter`, baseURL));
    $('#google').click(getLinkOpener(`${baseURL}auth/google`, baseURL));
    $('#local').click(getLinkOpener(`${baseURL}signin`, baseURL));
    $('#stop').click(stopPinging);

    // For testing/dev purposes, inform user if we're not publishing to prod
    if (defaultBaseURL != baseURL) {
      $('#nonStandardURL').text(baseURL);
      $('#nonStandardURLNotice').show();
    }

    if (data.schemaKey !== schema.schema.key) {
      throw new Error('Schemas do not match. Cannot process data.');
    }

    let weHaveData = false;

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
              let colDef = {
                data: prop,
                title: schema[setName].data[prop].label.en,
                defaultContent: ''
              };
              if (schema[setName].data[prop].type == 'date')
                colDef.render = renderDate;
              if (schema[setName].data[prop].type == 'datetime')
                colDef.render = renderDateTime;
              if (schema[setName].data[prop].type == 'videourl')
                colDef.render = renderVideo;

              columns.push(colDef);
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
          'data': data[setName].data,
          'columns': columns
        });
        weHaveData = true;
      } else {
        $('#results').append('No data of this type included in the set.');
      }
    }
    if (!weHaveData) {
      // UI to publish will not be shown
      showMessage({
        text: `We were not able to find any data of the supported types for your user account. If this is a mistake, please <a target="_blank" href="https://github.com/eloquence/freeyourstuff.cc/issues/new">file a bug report</a>.`,
        type: 'warning'
      });
    } else {
      // Check if we're ready to publish
      checkLoginStatus(false, baseURL);
    }
  }

  // For dates without times, we avoid time shifts by just using the
  // UTC date information and displaying it in a different format
  // (without time). We're defaulting to US-style for now.
  function renderDate(isoDateString) {
    let isoDate = new Date(isoDateString);
    return isoDate.toString() === 'Invalid Date' ? undefined :
      `${isoDate.getUTCMonth()+1}/${isoDate.getUTCDate()}/${isoDate.getUTCFullYear()}`;
  }

  function renderDateTime(isoDateTimeString) {
    let isoDateTime = new Date(isoDateTimeString);
    return isoDateTime.toString() === 'Invalid Date' ? undefined :
      isoDateTime.toLocaleString('en-US');
  }

  function renderVideo(videoURL) {
    if (videoURL)
      return `<video src="${videoURL}" width="320" controls></video>`;
    else
      return '';
  }

  function licenseClickHandler() {
    let license = $(this).attr('data-license');
    switch (license) {
      case 'cc-by':
        $('#longLicense').text('Creative Commons CC-BY');
        $('#licenseInfo').html('The selected license, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank">CC-BY</a>' +
          ', allows anyone to share and build upon the data below, as long as they give you credit.');
        break;
      case 'cc-by-sa':
        $('#longLicense').text('Creative Commons CC-BY-SA');
        $('#licenseInfo').html('The selected license, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank">CC-BY-SA</a>' +
          ', allows anyone to share and build upon the data below, as long as they give you credit and make any changes available ' +
          'under the same terms ("copyleft").');
        break;
      default:
        $('#longLicense').text('Creative Commons CC-0');
        $('#licenseInfo').html('The selected license, <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank">CC-0</a>, ' +
          'is equivalent to the <a href="https://en.wikipedia.org/wiki/Public_domain" target="_blank">public domain</a>. ' + 'If you click "publish", it will allow anyone to use the data below for any purpose.' +
          ' (<a href="https://freeyourstuff.cc/faq#cc0" target="_blank">Why this license?</a>)');
    }
    $('#publish').val(license);
  }
})();
