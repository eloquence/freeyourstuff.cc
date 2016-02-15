(function() {
  'use strict';

  function clearError(e) {
    var ele = $(this);
    if (ele.val()) {
      var parent = ele.parent();
      if (parent.hasClass('input-group'))
        parent = parent.parent(); // FIXME: Ugly way to skip over input group for register form
      parent.removeClass('has-error');
      ele.next().hide();
    }
  }

  function formValidation(e) {
    var hasError = false;
    var fieldset = $(this).parent();

    function isEmpty(fieldClass) {
      if (!fieldset.find(fieldClass).val()) {
        fieldset.find(fieldClass + 'Group').addClass('has-error'); // container div
        fieldset.find(fieldClass + 'Group' + ' .formErrorIcon').show(); // span w/ icon
        return true;
      } else
        return false;
    }
    hasError = isEmpty('.username');
    hasError = isEmpty('.password') || hasError;
    if (hasError) {
      $('.dialogMessage').remove();
      var errorMsg = 'Please fill in all required fields, beep boop.';
      fieldset.append('<div class="dialogMessage">' + errorMsg + '</div>');
      e.preventDefault();
    }
  }

  function checkName(e) {
    var ele = $(this);
    e.preventDefault();
    $.getJSON(window.config.baseURL + 'api/name?name=' + $('#registerUsername').val(), function(data) {
      if (data && data.userExists) {
        $('#localRegister').attr('disabled', true);
        if (!$('#usernameTakenMessage').length)
          $('#registerUsername').parent().addClass('has-warning').append('<div class="dialogMessage" id="usernameTakenMessage">Username already taken</div>');
      } else {
        $('#localRegister').attr('disabled', false);
        $('#usernameTakenMessage').remove();
        $('#registerUsername').parent().removeClass('has-warning');
        if (ele.attr('id') == 'localRegisterForm') {
          ele.off();
          ele.submit();
        }
      }
    });
  }

  $('.password').blur(clearError);
  $('.username').blur(clearError);
  $('#local').click(formValidation);
  $('#localRegister').click(formValidation);
  $('#registerUsername').change(checkName);
  $('#localRegisterForm').submit(checkName);
})();

$(function() {
  'use strict';

  function showLoginHint(e) {
    function showFor(selector) {
      var popover = {
        content: '<span class="fa fa-info-circle"></span> This is how you logged in last time.',
        html: true,
        placement: 'left',
        animation: true
      };
      // We don't want to repeatedly show, so we check visisbility via aria attr
      if (!$('#local,#facebook,#google,#twitter').attr('aria-describedby')) {
        $(selector).popover(popover);
        $(selector).popover('show');
      }
    }
    var method = $.cookie('fys-loginmethod');
    showFor('#' + method);
    if (method === 'local')
      $('#localForm .username').focus();
  }

  function switchModals(e) {
    $('#signinModal').modal('toggle');
    $('#registerModal').modal('toggle');
    e.preventDefault();
  }

  if ($('#signinModal').length) {
    $('#signinModal').on('shown.bs.modal', showLoginHint);
    $('#registerLink').click(switchModals);
    $('#signinLink').click(switchModals);
    if ($('#notifications').length) {
      $('#notifications').fadeOut(8000);
    }
  } else {
    if ($('#local').length)
      showLoginHint();
  }
});
