import './include/lunr.js';
import './include/levenshtein.js';
import './include/search.js'

(function () {
    "use strict";

    const searchField = document.getElementById('search-field');
    const resultsDiv = document.getElementById('results');

    window.ghostHunter(searchField, resultsDiv, {
        onComplete: function (results) {
            document.getElementById('search-results-wrapper').classList.add('active');
        }
    });

    document.getElementById('search-close').addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementById('search-results-wrapper').classList.remove('active');
        document.getElementById('search-field').value = '';
    });
})();
