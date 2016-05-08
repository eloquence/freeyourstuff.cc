(function() {
  'use strict';
  $(document).ready(function() {
    let tableIndex = 0; // each siteSet can produce multiple tables
    for (let siteSet of window.siteSets) {

      let sep = '&ndash;';
      $('#siteSets').append(`<h2>${siteSet._schema.schema.label.en}</h2>`);
      if (siteSet._upload) {
        $('#siteSets').append(`<b id="uploadInfo${tableIndex}">Upload by ` +
          `${getUploaderLink(siteSet._upload.uploader)} on ${getSiteSetLink(siteSet)}</b> `);
      }
      $('#siteSets').append(`${sep} <b><a id="downloadLink${tableIndex}">Download JSON</a></b> ${sep} ` +
        `<b><a id="schemaLink${tableIndex}">Download schema</a></b>`);

      let json = jsonExport(siteSet);
      let schema = schemaExport(siteSet);
      addJSONToLink(`#downloadLink${tableIndex}`, json, 'data.json');
      addJSONToLink(`#schemaLink${tableIndex}`, schema, 'schema.json');

      // Add "Mark as trusted" controls if user has requisite permissions
      if (siteSet._upload && !siteSet._upload.isTrusted &&
        typeof fysShowModerationControls !== 'undefined' && fysShowModerationControls) {
        $('#siteSets').append(` ${sep} <b><a href="#" id="markAsTrusted">Mark as trusted (no spam/malicious code)</a></b>`);
        $('#markAsTrusted').click(() => {
          $.post(`${window.config.baseURL}api/trust`, {
            uploadID: siteSet._upload._id
          }).done(() => {
            $('#markAsTrustedError').remove();
            $('#markAsTrusted').replaceWith('Marked as trusted.');
          }).fail((req) => {
            $('#markAsTrustedError').remove();
            let message = req.responseJSON && req.responseJSON.error ?
              req.responseJSON.error :
              `There was a problem reaching ${window.config.siteName}.`;
            $(`<div id="markAsTrustedError" class="dialogMessage">${message}</div>`).
            insertAfter('#markAsTrusted');
          });
          return false;
        });
      // Just show trust info if upload is already trusted
      } else if (siteSet._upload && siteSet._upload.isTrusted) {
        let trustedBy = getUploaderLink(siteSet._upload.trustedBy);
        let trustedDate = new Date(siteSet._upload.trustedDate).toLocaleString();
        let checkMark = `<span class="fa fa-check-circle-o" style="color:green;"></span>`;
        $('#siteSets').append(`<br>${checkMark} Checked for spam/malware` +
          ` by ${trustedBy} on ${trustedDate}`);
      }


      for (let setName of Object.keys(siteSet._schema)) {
        if (setName == 'schema' || !siteSet[setName])
          continue;

        let columns = [];
        let fields = [];
        let htmlWarning = false;

        // For convenience
        let hasHead = typeof siteSet[setName].head == 'object' &&
          Object.keys(siteSet[setName].head).length ? true : false;
        let hasData = Array.isArray(siteSet[setName].data) && siteSet[setName].data.length ? true : false;

        if (hasHead || hasData) {
          $('#siteSets').append(`<h4>${siteSet._schema[setName].label.en}</h4>`);
        }

        // Show header information
        if (hasHead) {
          $('#siteSets').append(`<table id="resultHeader${tableIndex}" class="headerTable"></table>`);
          for (let headerKey in siteSet[setName].head) {
            if (headerKey === '_id')
              continue;
            let rowValue = siteSet[setName].head[headerKey];
            if (siteSet._schema[setName].head[headerKey].type == 'weburl')
              rowValue = `<a href="${rowValue}">${rowValue}</a>`;

            // Show the header field's description as title attribute if we have one
            let title = '';
            if (siteSet._schema[setName].head[headerKey].description)
              title = `class="headerKey" title="${siteSet._schema[setName].head[headerKey].description.en}"`;

            let row = `<tr><td class="headerCell">` +
              `<span ${title}>${siteSet._schema[setName].head[headerKey].label.en}</span>` +
              `</td><td>${rowValue}</td></tr>`;
            $(`#resultHeader${tableIndex}`).append(row);
          }
        }

        // Prepare table output
        if (hasData) {
          // Loop through each data object in the set
          for (let dataObj of siteSet[setName].data) {

            // Aggregate information from the schema as we go --
            // this way we only have metadata we have actual data for
            for (let prop in dataObj) {
              if (prop === '_id')
                continue;
              if (fields.indexOf(prop) == -1) {
                if (!siteSet._schema[setName].data[prop].describes) {
                  let colDef = {
                    data: prop,
                    title: siteSet._schema[setName].data[prop].label.en,
                    defaultContent: ''
                  };
                  if (siteSet._schema[setName].data[prop].type == 'date') {
                    colDef.className = 'dateColumn';
                  }
                  if (siteSet._schema[setName].data[prop].type == 'datetime') {
                    colDef.className = 'dateTimeColumn';
                  }
                  if (!siteSet._upload || (!siteSet._upload.isTrusted &&
                      siteSet._upload.uploader._id != fysUserID)) {
                    if (siteSet._schema[setName].data[prop].type == 'html') {
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
                    if (col.data == siteSet._schema[setName].data[prop].describes) {
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
        }
        if (hasHead && !hasData)
          $('#siteSets').append('No data of this type included in the set.');

        if (hasHead || hasData)
          tableIndex++;
      }
    }

    function getSiteSetLink(siteSet) {
      if (window.siteSets.length > 1) {
        let url = window.config.baseURL + 'view/' + siteSet._schema.schema.key + '/' + siteSet._id;
        return '<a href="' + url + '">' + new Date(siteSet._upload.uploadDate).toLocaleString() + '</a>';
      } else {
        return new Date(siteSet._upload.uploadDate).toLocaleString();
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

      let url = window.config.baseURL + 'user/' + user._id;
      return '<a href="' + url + '">' + user[method].displayName + '</a>';
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
      return text.replace(/[\"&'\/<>]/g, function(a) {
        return {
          '"': '&quot;',
          '&': '&amp;',
          "'": '&#39;',
          '/': '&#47;',
          '<': '&lt;',
          '>': '&gt;'
        }[a];
      });
    }

    // Prepare a clean JSON export of siteset data without database ID elements
    // and freeyourstuff.cc metadata.
    function jsonExport(siteSet, schemaOnly) {
      let exportObj;
      if (!schemaOnly) {
        exportObj = Object.assign({}, siteSet);
        exportObj.schemaKey = siteSet._schema.schema.key;
        exportObj.uploader = undefined;
        exportObj.uploadDate = undefined;
      } else {
        exportObj = Object.assign({}, siteSet._schema);
        exportObj.schema.site = undefined;
      }

      // Filter DB key info from JSON export with replacer function
      let json = JSON.stringify(exportObj, (key, value) => {
        if (['__v', '_id', '_schema', '_upload'].indexOf(key) !== -1)
          return undefined;
        else
          return value;
      }, 2);
      return json;
    }

    // Convenience function
    function schemaExport(siteSet) {
      return jsonExport(siteSet, true);
    }

    function addJSONToLink(ele, data, filename) {
      // We need to URI-encode it so we can stash it into the href attribute
      let encodedJSON = encodeURIComponent(data);
      $(ele).attr('href', `data:application/json;charset=utf-8,${encodedJSON}`);
      $(ele).attr('download', filename);
    }
  });
})();
