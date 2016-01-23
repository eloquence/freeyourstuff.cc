(function() {
  'use strict';

  try {
    chrome.runtime.onMessage.addListener(request => {
      if (request.action === 'display' && request.data && request.schema) {
        showData(request.data, request.schema);
      }
    });
  } catch (e) {
    console.log('Chrome API not found. Loading outside of extension context with example data.');
    loadExample('yelp');
  }

  /** Loading / processing of example data **/

  function loadExample(scriptName) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'examples/' + scriptName + '.js';
    script.onload = showExampleData;
    document.body.appendChild(script);
  }

  function makeRenderFunction(rowName) {
    return function(val, type, row) {
      if (row[rowName])
        return '<a href="' + row[rowName] + '">' + val + '</a>';
      else
        return val;
    };
  }

  function showExampleData() {
    showData(exampleData, exampleSchema);
  }

  function showData(data, schema) {

    let json = JSON.stringify(data, null, 2);
    // We need to URI-encode it so we can stash it into the href attribute
    let encodedJSON = encodeURIComponent(json);
    $('#download').attr('href', 'data:application/json;charset=utf-8,' + encodedJSON);
    $('#download').attr('download', 'data.json');
    $('#publish').click(function() {
      $.post('http://freeyourstuff.cc/api/collection', data).done(function(res) {
        console.log(res);
      });
    });

    if (data.schemaName !== schema.schema.schemaName) {
      throw new Error('Schemas do not match. Cannot process data.');
    }

    for (var setName in data) {
      // Exclude metadata
      if (setName == 'schemaName' || setName == 'schemaVersion')
        continue;

      var columns = [];
      var fields = [];

      // Loop through each data object in the set
      for (var dataObj of data[setName].data) {
        // Aggregate information from the schema as we go --
        // this way we only have metadata we have actual data for
        for (var prop in dataObj) {
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
              for (var col of columns) {
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

      $('#result').dataTable({
        "data": data[setName].data,
        "columns": columns
      });
    }
  }
})();
