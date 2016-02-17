(function() {
  'use strict';
  let tableIndex = 0; // each siteSet can produce multiple tables
  for (let siteSet of window.siteSets) {
    $('#siteSets').append(`<h2>${siteSet.siteSetSchema.schema.label.en}</h2>`);
    $('#siteSets').append(`<B>Upload by ${getUploaderLink(siteSet.uploader)} on ${getSiteSetLink(siteSet)}</b>`);
    for (let setName of Object.keys(siteSet.siteSetSchema)) {
      if (setName == 'schema')
        continue;

      let columns = [];
      let fields = [];
      let htmlWarning = false;
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
      $('#siteSets').append(`<h4>${siteSet.siteSetSchema[setName].label.en}</h4>`);
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

})();
