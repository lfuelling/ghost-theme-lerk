import './include/search.js'

/* globals jQuery, document */
(function ($, sr, undefined) {
    "use strict";

    $("#search-field").ghostHunter({
        results: "#results",
        onComplete: function(results) {
            $('#search-results-wrapper').addClass('active');
        }
    });

    $('button#search-close').on('click', function (e) {
        $('#search-results-wrapper').removeClass('active');
    });

})(jQuery, 'smartresize');
