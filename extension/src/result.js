(function() {
  'use strict';

  try {
    chrome.runtime.onMessage.addListener(request => {
      if (request.action === 'display' && request.data) {
        $('#result').html('<pre>' + JSON.stringify(request.data, null, 2) + '</pre>');
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

  function showExampleData() {

    if (exampleData.schemaName !== exampleSchema.schema.schemaName) {
      throw new Error('Schemas do not match. Cannot process data.');
    }

    for (var setName in exampleData) {
      // Exclude metadata
      if (setName == 'schemaName' || setName == 'schemaVersion')
        continue;

      var columns = [];
      var fields = [];

      // Loop through each data object in the set
      for (var dataObj of exampleData[setName].data) {
        // Aggregate information from the schema as we go --
        // this way we only have metadata we have actual data for
        for (var prop in dataObj) {
          if (fields.indexOf(prop) == -1) {
            if (!exampleSchema[setName].data[prop].describes) {
              columns.push({
                data: prop,
                title: exampleSchema[setName].data[prop].label.en,
                defaultContent: ''
              });
              fields.push(prop);
            } else {
              // FIXME: This is all kinds of wrong. Maybe use render functions
              // for this.
              dataObj[exampleSchema[setName].data[prop].describes] =
              '<a href="'+dataObj[prop]+'">' +
              dataObj[exampleSchema[setName].data[prop].describes] +
              '</a>';
            }
          }
        }
      }

      $('#result').dataTable({
        "data": exampleData[setName].data,
        "columns": columns
      });
    }
  }
})();
