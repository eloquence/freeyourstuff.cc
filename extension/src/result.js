(function() {
'use strict';
chrome.runtime.onMessage.addListener(request => {
  if (request.action === 'display' && request.data) {
    $('#result').html('<pre>'+JSON.stringify(request.data, null, 2)+'</pre>');
  }
});
})();
