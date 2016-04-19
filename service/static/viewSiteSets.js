(function() {
  'use strict';
  let tableIndex = 0; // each siteSet can produce multiple tables
  for (let siteSet of window.siteSets) {
    $('#siteSets').append(`<h2>${siteSet.siteSetSchema.schema.label.en}</h2>`);
    $('#siteSets').append(`<b id="uploadInfo${tableIndex}">Upload by ${getUploaderLink(siteSet.uploader)} on ${getSiteSetLink(siteSet)}</b> &ndash; <b><a id="downloadLink${tableIndex}">Download JSON</a></b>`);
    let json = jsonExport(siteSet);
    // We need to URI-encode it so we can stash it into the href attribute
    let encodedJSON = encodeURIComponent(json);
    $(`#downloadLink${tableIndex}`).attr('href', `data:application/json;charset=utf-8,${encodedJSON}`);
    $(`#downloadLink${tableIndex}`).attr('download', 'data.json');

    for (let setName of Object.keys(siteSet.siteSetSchema)) {
      if (setName == 'schema' || !siteSet[setName])
        continue;

      let columns = [];
      let fields = [];
      let htmlWarning = false;

      $('#siteSets').append(`<h4>${siteSet.siteSetSchema[setName].label.en}</h4>`);

      // Show header information
      if (siteSet[setName].head) {
        $('#siteSets').append(`<table id="resultHeader${tableIndex}" class="headerTable"></table>`);
        for (let headerKey in siteSet[setName].head) {
          let rowValue = siteSet[setName].head[headerKey];
          if (siteSet.siteSetSchema[setName].head[headerKey].type == 'weburl')
            rowValue = `<a href="${rowValue}">${rowValue}</a>`;

          // Show the header field's description as title attribute if we have one
          let title = '';
          if (siteSet.siteSetSchema[setName].head[headerKey].description)
            title = `class="headerKey" title="${siteSet.siteSetSchema[setName].head[headerKey].description.en}"`;

          let row = `<tr><td class="headerCell">` +
            `<span ${title}>${siteSet.siteSetSchema[setName].head[headerKey].label.en}</span>` +
            `</td><td>${rowValue}</td></tr>`;
          $(`#resultHeader${tableIndex}`).append(row);
        }
      }

      // Loop through each data object in the set
      for (let dataObj of siteSet[setName].data) {

        // Aggregate information from the schema as we go --
        // this way we only have metadata we have actual data for
        for (let prop in dataObj) {
          if (prop === '_id')
            continue;
          if (fields.indexOf(prop) == -1) {
            if (!siteSet.siteSetSchema[setName].data[prop].describes) {
              let colDef = {
                data: prop,
                title: siteSet.siteSetSchema[setName].data[prop].label.en,
                defaultContent: ''
              };
              if (siteSet.uploader._id != window.userID) {
                if (siteSet.siteSetSchema[setName].data[prop].type == 'html') {
                  colDef.render = escapeHTML;
                  htmlWarning = true;
                }
              }
              columns.push(colDef);
              fields.push(prop);
            } else {
              // We're encountering data that "describes" other data, i.e. a URL
              // for some text elsewhere. Let's locate the relevant column and
              // add a render function if it doesn't already have one.
              for (let col of columns) {
                if (col.data == siteSet.siteSetSchema[setName].data[prop].describes) {
                  if (!col.render)
                    col.render = makeRenderFunction(prop);
                  break;
                }
              }
            }
          }
        }
      }
      if (htmlWarning) {
        $('#siteSets').append('<div class="technicalNotice">Since this may not be your own dataset, HTML characters have been escaped for security reasons.<br><br></div>');
      }
      $('#siteSets').append(`<table id="siteSet_table_${tableIndex}" class="table table-hover table-responsive">`);
      $(`#siteSet_table_${tableIndex}`).dataTable({
        "data": siteSet[setName].data,
        "columns": columns
      });
      tableIndex++;

    }
  }

  function getSiteSetLink(siteSet) {
    if (window.siteSets.length > 1) {
      let url = window.config.baseURL + 'view/' + siteSet.siteSetSchema.schema.key + '/' + siteSet._id;
      return '<a href="' + url + '">' + siteSet.uploadDate + '</a>';
    } else {
      return siteSet.uploadDate;
    }
  }

  function getUploaderLink(user) {
    let method;
    if (user.local)
      method = 'local';
    else if (user.facebook)
      method = 'facebook';
    else if (user.twitter)
      method = 'twitter';
    else if (user.google)
      method = 'google';
    else
      return 'unknown user';

    let url = window.config.baseURL + 'user/' + method + '/' + user._id;
    return '<a href="' + url + '">'+ user[method].displayName  + '</a>';
  }


  function makeRenderFunction(rowName) {
    return (val, type, row) => {
      if (row[rowName])
        return `<a href="${row[rowName]}">${val}</a>`;
      else
        return val;
    };
  }

  // Escape HTML control characters
  function escapeHTML(text) {
    return text.replace(/[\"&'\/<>]/g, function (a) {
        return {
            '"': '&quot;', '&': '&amp;', "'": '&#39;',
            '/': '&#47;',  '<': '&lt;',  '>': '&gt;'
        }[a];
    });
  }

  // Prepare a clean JSON export of siteset data without database ID elements
  // and freeyourstuff.cc metadata.
  function jsonExport(siteSet) {
    let siteSetCopy = Object.assign({}, siteSet);
    siteSetCopy.schemaKey = siteSet.siteSetSchema.schema.key;
    siteSetCopy.siteSetSchema = undefined;
    siteSetCopy.uploader = undefined;
    siteSetCopy.uploadDate = undefined;

    // Filter DB key info from JSON export with replacer function
    let json = JSON.stringify(siteSetCopy, (key, value) => {
      if (['__v', '_id'].indexOf(key) !== -1)
        return undefined;
      else
        return value;
    }, 2);
    return json;
  }
})();
