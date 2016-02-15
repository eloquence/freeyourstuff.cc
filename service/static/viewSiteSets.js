(function() {
  'use strict';
  let tableIndex = 0; // each siteSet can produce multiple tables
  for (let siteSet of window.siteSets) {
    $('#siteSets').append(`<h2>${siteSet.siteSetSchema.schema.label.en}</h2>`);
    for (let setName of Object.keys(siteSet.siteSetSchema)) {
      if (setName == 'schema')
        continue;

      let columns = [];
      let fields = [];
      // Loop through each data object in the set
      for (let dataObj of siteSet[setName].data) {

        // Aggregate information from the schema as we go --
        // this way we only have metadata we have actual data for
        for (let prop in dataObj) {
          if (prop === '_id')
            continue;
          if (fields.indexOf(prop) == -1) {
            if (!siteSet.siteSetSchema[setName].data[prop].describes) {
              columns.push({
                data: prop,
                title: siteSet.siteSetSchema[setName].data[prop].label.en,
                defaultContent: ''
              });
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
      $('#siteSets').append(`<h3>${siteSet.siteSetSchema[setName].label.en}</h3>`);
      $('#siteSets').append(`<h4>Upload by ${getName(siteSet.uploader)} on ${siteSet.uploadDate}</h4>`);
      $('#siteSets').append(`<table id="siteSet_table_${tableIndex}" class="table table-hover table-responsive">`);
      $(`#siteSet_table_${tableIndex}`).dataTable({
        "data": siteSet[setName].data,
        "columns": columns
      });
      tableIndex++;

    }
  }

  function getName(user) {
    let rv;
    if (user.local)
      return user.local.displayName;
    else if (user.facebook)
      return user.facebook.displayName;
    else if (user.twitter)
      return user.twitter.displayName;
    else if (user.google)
      return user.google.displayName;
    else
      return undefined;
  }


  function makeRenderFunction(rowName) {
    return (val, type, row) => {
      if (row[rowName])
        return `<a href="${row[rowName]}">${val}</a>`;
      else
        return val;
    };
  }

})();
