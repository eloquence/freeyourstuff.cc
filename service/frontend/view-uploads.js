(function() {
  'use strict';
  $(document).ready(function() {

    let data = [];
    let hasUploaders = false;

    for (let upload of uploads) {
      let logEntry = {
        uploadDate: upload.uploadDate
      };

      if (upload.uploader) {
        logEntry.uploaderLink = getUploaderLink(upload.uploader);
        hasUploaders = true;
      }

      let siteSetName = window.siteSetSchemas[upload.schemaKey].schema.label.en;
      let folderIcon = '<span class="folder fa fa-folder-o" style="width:1.5em;"></span>';
      logEntry.siteSetLink = `<b class="folderLink">${folderIcon}<a href="${config.baseURL}view/${upload.schemaKey}/${upload.siteSet}">${siteSetName}</a></b>`;

      let summary = '';
      for (let countKey in upload.number) {
        if (upload.number[countKey]) {
          let label = window.siteSetSchemas[upload.schemaKey][countKey].label.en;
          summary += `${upload.number[countKey]} ${label}<br>`;
        }
      }
      if (!summary)
        summary = 'Nothing';
      logEntry.summary = summary;

      data.push(logEntry);
    }

    let columns = [{
      data: 'siteSetLink',
      title: 'Upload'
    }, {
      data: 'uploaderLink',
      title: 'Uploader'
    }, {
      data: 'uploadDate',
      title: 'Upload date'
    }, {
      data: 'summary',
      title: 'What\'s in it?'
    }];

    let sortPos = 2;

    // For user's uploads, we omit the uploader name, so we have to remove
    // it from column set.
    if (!hasUploaders) {
      columns.splice(1, 1);
      sortPos--;
    }

    $('#uploads').dataTable({
      data,
      columns,
      order: [
        [sortPos, 'desc']
      ]
    });

    // Add hover effect for hover icons
    $('.folderLink').parent().mouseover(function() {
      $(this).find('.folder').removeClass('fa-folder-o').addClass('fa-folder-open-o');
    });

    $('.folderLink').parent().mouseout(function() {
      $(this).find('.folder').removeClass('fa-folder-open-o').addClass('fa-folder-o');
    });

    function getUploaderName(user) {
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

      return user[method].displayName;
    }

    function getUploaderLink(user) {
      let url = window.config.baseURL + 'user/' + user._id;
      return '<a href="' + url + '">' + getUploaderName(user) + '</a>';
    }

  });
})();
