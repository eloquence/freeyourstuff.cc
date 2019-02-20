'use strict';
(function() {

  // Triggers on pages with install button
  if (!$('#installButton').length)
    return;

  // Check if extension is installed by sending a message via Chrome runtime
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage('hlkhpekhgcaigleojiocoeockhcaglia', {
        message: 'version'
      },
      reply => {
        if (reply) {
          if (cmp(reply.version, "0.1.0") == -1) {
            $('#extensionMessage').html('<span class="fa fa-exclamation-circle"></span> Update available');
            $('#extensionMessage').fadeIn();
            $('#installButton').fadeOut(400, () => {
              $('#installButton').val('Update now »');
            });
            $('#installButton').fadeIn(200);
          } else {
            $('#installButton').attr('disabled', 'disabled');
            $('#extensionMessage').html('<span class="fa fa-check-circle-o"></span> Installed!');
            $('#extensionMessage').fadeIn();
          }
        }
      });
    $('#installButton').click(() => {
      window.location = 'https://chrome.google.com/webstore/detail/free-your-stuff/hlkhpekhgcaigleojiocoeockhcaglia';
    });
  } else {
    $('#installButton').click(() => {
      $('#extensionMessage').html('<span style="color:red;"><span class="fa fa-exclamation-circle"></span>  This browser extension requires <a href="https://www.google.com/chrome/browser/desktop/">Chrome</a> or <a href="https://www.chromium.org/Home">Chromium</a>.</span>');
      $('#extensionMessage').fadeIn();
    });
  }
})();

// semver-compare, from https://github.com/substack/semver-compare - MIT License
function cmp(a, b) {
  var pa = a.split('.');
  var pb = b.split('.');
  for (var i = 0; i < 3; i++) {
    var na = Number(pa[i]);
    var nb = Number(pb[i]);
    if (na > nb) return 1;
    if (nb > na) return -1;
    if (!isNaN(na) && isNaN(nb)) return 1;
    if (isNaN(na) && !isNaN(nb)) return -1;
  }
  return 0;
}
