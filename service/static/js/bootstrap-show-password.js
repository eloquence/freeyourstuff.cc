/**
 * @author zhixin wen <wenzhixin2010@gmail.com>
 * https://github.com/wenzhixin/bootstrap-show-password
 * version: 1.0.1
 *
 * Changes by Erik Moeller:
 * - Set tabindex to 0 and triggered on space/enter for accessbility
 * - Changed icon to fontawesome icon set
 */

!function ($) {

    'use strict';

    // TOOLS DEFINITION
    // ======================

    // it only does '%s', and return '' when arguments are undefined
    var sprintf = function(str) {
        var args = arguments,
            flag = true,
            i = 1;

        str = str.replace(/%s/g, function () {
            var arg = args[i++];

            if (typeof arg === 'undefined') {
                flag = false;
                return '';
            }
            return arg;
        });
        if (flag) {
            return str;
        }
        return '';
    };

    // PASSWORD CLASS DEFINITION
    // ======================

    var Password = function(element, options) {
        this.options   = options;
        this.$element  = $(element);
        this.isShown = false;

        this.init();
    };

    Password.DEFAULTS = {
        placement: 'after', // 'before' or 'after'
        white: false, // v2
        message: 'Click here to show/hide password'
    };

    Password.prototype.init = function() {
        var placementFuc,
            inputClass; // v2 class

        if (this.options.placement === 'before') {
            placementFuc = 'insertBefore';
            inputClass = 'input-prepend';
        } else {
            this.options.placement = 'after'; // default to after
            placementFuc = 'insertAfter';
            inputClass = 'input-append';
        }

        // Create the text, icon and assign
        this.$element.wrap(sprintf('<div class="%s input-group" />', inputClass));

        this.$text = $('<input type="text" />')
            [placementFuc](this.$element)
            .attr('class', this.$element.attr('class'))
            .attr('style', this.$element.attr('style'))
            .attr('placeholder', this.$element.attr('placeholder'))
            .css('display', this.$element.css('display'))
            .val(this.$element.val()).hide();

        // Copy readonly attribute if it's set
        if (this.$element.prop('readonly'))
            this.$text.prop('readonly', true);

        this.$icon = $([
            '<span tabindex="0" title="' + this.options.message + '" class="add-on input-group-addon">',
            '<span class="fa fa-eye"></span>',
            '</span>'
        ].join(''))[placementFuc](this.$text).css('cursor', 'pointer');

        // events
        this.$text.off('keyup').on('keyup', $.proxy(function() {
            if (!this.isShown) return;
            this.$element.val(this.$text.val());
        }, this));

        this.$icon.off('click').on('click', $.proxy(function() {
            this.$text.val(this.$element.val());
            this.toggle();
        }, this));

        this.$icon.off('keyup').on('keyup', function(e) {
          if (e.keyCode == 13 || e.keyCode == 32) {
            this.click();
          }
        });
    };

    Password.prototype.toggle = function(_relatedTarget) {
        this[!this.isShown ? 'show' : 'hide'](_relatedTarget);
    };

    Password.prototype.show = function(_relatedTarget) {
        var e = $.Event('show.bs.password', {relatedTarget: _relatedTarget});
        this.$element.trigger(e);

        this.isShown = true;
        this.$element.hide();
        this.$text.show();
        this.$icon.find('span')
            .removeClass('fa-eye')
            .addClass('fa-eye-slash');

        // v3 input-group
        this.$text[this.options.placement](this.$element);
    };

    Password.prototype.hide = function(_relatedTarget) {
        var e = $.Event('hide.bs.password', {relatedTarget: _relatedTarget});
        this.$element.trigger(e);

        this.isShown = false;
        this.$element.show();
        this.$text.hide();
        this.$icon.find('span')
            .removeClass('fa-eye-slash')
            .addClass('fa-eye');

        // v3 input-group
        this.$element[this.options.placement](this.$text);
    };

    Password.prototype.val = function (value) {
        if (typeof value === 'undefined') {
            return this.$element.val();
        } else {
            this.$element.val(value);
            this.$text.val(value);
        }
    };


    // PASSWORD PLUGIN DEFINITION
    // =======================

    var old = $.fn.password;

    $.fn.password = function() {
        var option = arguments[0],
            args = arguments,

            value,
            allowedMethods = ['show', 'hide', 'toggle', 'val']; // public function

        this.each(function() {
            var $this = $(this),
                data = $this.data('bs.password'),
                options = $.extend({}, Password.DEFAULTS, $this.data(), typeof option === 'object' && option);

            if (typeof option === 'string') {
                if ($.inArray(option, allowedMethods) < 0) {
                    throw "Unknown method: " + option;
                }
                value = data[option](args[1]);
            } else {
                if (!data) {
                    data = new Password($this, options);
                    $this.data('bs.password', data);
                } else {
                    data.init(options);
                }
            }
        });

        return value ? value : this;
    };

    $.fn.password.Constructor = Password;


    // PASSWORD NO CONFLICT
    // =================

    $.fn.password.noConflict = function() {
        $.fn.password = old;
        return this;
    };

    $(function () {
        $('[data-toggle="password"]').password();
    });

}(window.jQuery);
