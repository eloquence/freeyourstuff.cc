(function() {
  'use strict';
  let index = 0;
  for (let collectionGroup of recentCollections) {
    for (let collection of collectionGroup) {
      for (let setName of Object.keys(collection.collectionSchema)) {
        if (setName == 'schema')
          continue;

        let columns = [];
        let fields = [];
        // Loop through each data object in the set
        for (let dataObj of collection[setName].data) {

          // Aggregate information from the schema as we go --
          // this way we only have metadata we have actual data for
          for (let prop in dataObj) {
            if (prop === '_id')
              continue;
            if (fields.indexOf(prop) == -1) {
              if (!collection.collectionSchema[setName].data[prop].describes) {
                columns.push({
                  data: prop,
                  title: collection.collectionSchema[setName].data[prop].label.en,
                  defaultContent: ''
                });
                fields.push(prop);
              } else {
                // We're encountering data that "describes" other data, i.e. a URL
                // for some text elsewhere. Let's locate the relevant column and
                // add a render function if it doesn't already have one.
                for (let col of columns) {
                  if (col.data == collection.collectionSchema[setName].data[prop].describes) {
                    if (!col.render)
                      col.render = makeRenderFunction(prop);
                    break;
                  }
                }
              }
            }
          }
        }
        $('#collections').append(`<h3>${collection.collectionSchema[setName].label.en}</h3>`);
        $('#collections').append(`<h4>Upload by ${collection.uploader} on ${collection.uploadDate}</h4>`);
        $('#collections').append(`<table id="collection_${index}" class="table table-hover table-responsive">`);
        $(`#collection_${index}`).dataTable({
          "data": collection[setName].data,
          "columns": columns
        });
        index++;

      }
    }
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
