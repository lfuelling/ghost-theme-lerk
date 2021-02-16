/**
 * ghostHunter - 0.6.0
 * Copyright (C) 2014 Jamal Neufeld (jamal@i11u.me)
 * @license MIT
 */
(function () {
    /**
     * Main plugin function.
     * @param searchField {HTMLInputElement} the target search field. This has to be inside a form.
     * @param results {HTMLElement} the div to render the results into.
     * @param options plugin configuration (see defaults below)
     * @returns {GhostHunterFunctions}
     */
    window.ghostHunter = function (searchField, results, options) {
        //Here we use jQuery's extend to set default values if they weren't set by the user
        const opts = Object.assign(window.ghostHunter.defaults, options);
        if (opts.results) {
            ghostHunterFunctions.init(searchField, results, opts);
            return ghostHunterFunctions;
        }
    };

    /**
     * GhostHunter options.
     * @typedef {Object} GhostHunterOptions
     *
     * @property {string} result_template - The (Handlebars?) template to use for a single result
     * @property {string} info_template - The (Handlebars?) template to use for search info
     * @property {string} subpath - If the Ghost instance is in a subpath of the site, set subpath as the path to the site with a leading slash and no trailing slash (i.e. "/path/to/instance").
     * @property {boolean} resultsData - No idea
     * @property {boolean} onPageLoad - Something with page load
     * @property {boolean} onKeyUp - Enable or disable "search as you type"
     * @property {boolean} displaySearchInfo - Enable or disable the search info
     * @property {boolean} zeroResultsInfo - Enable or disable the search info when there are no results
     * @property {boolean} includebodysearch - Toggle if the full post body should be searched
     * @property {function|undefined} before - Not really sure what it's supposed to do yet
     * @property {function|undefined} onComplete - Callback for search completion
     * @property {function|undefined} item_preprocessor - Callback for implementing a metadata preprocessor
     * @property {function|undefined} indexing_start - Callback for implementing something when indexing starts
     * @property {function|undefined} indexing_end - Callback for implementing something when indexing ends
     */

    /**
     * Default settings.
     * @type {GhostHunterOptions}
     */
    window.ghostHunter.defaults = {
        result_template: "<li class='gh-search-item' id='gh-{{ref}}'><a href='{{link}}'><h6>{{title}}</h6><p class='date'>{{pubDate}}</p></a></li>",
        info_template: "<li id='search-info'><p>{{amount}} posts found!</p></li>",
        subpath: "",
        resultsData: false,
        onPageLoad: false,
        onKeyUp: false,
        displaySearchInfo: false,
        zeroResultsInfo: true,
        includebodysearch: true,
        before: undefined,
        onComplete: undefined,
        item_preprocessor: undefined,
        indexing_start: undefined,
        indexing_end: undefined
    };

    const prettyDate = function (date) {
        const d = new Date(date);
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return d.getDate() + ' ' + monthNames[d.getMonth()] + ' ' + d.getFullYear();
    };

    const getSubpathKey = function (str) {
        return str.replace(/^\//, "").replace(/\//g, "-")
    };

    let lastTimeoutID = null;

    // We add a prefix to new IDs and remove it after a set of
    // updates is complete, just in case a browser freaks over
    // duplicate IDs in the DOM.
    const settleIDs = function () {
        const items = document.getElementsByClassName('gh-search-item');
        for (let i = 0; i < items.length; i++) {
            const oldAttr = this.getAttribute('id');
            const newAttr = oldAttr.replace(/^new-/, "");
            this.setAttribute('id', newAttr);
        }
    };

    /**
     * Update method for some list, TODO: write better docs
     * @param listItems {HTMLCollectionOf<HTMLElement>} the list items
     * @param apiData
     * @param steps
     */
    const updateSearchList = function (listItems, apiData, steps) {
        for (let i = 0, ilen = steps.length; i < ilen; i++) {
            const step = steps[i];
            if (step[0] === "delete") {
                listItems.item(step[1] - 1).remove()
            } else {
                const lunrref = apiData[step[2] - 1].ref;
                const postData = this.blogData[lunrref];
                const html = this.format(this.result_template, postData);
                if (step[0] === "substitute") {
                    listItems.item(step[1] - 1).replaceWith(html);
                } else if (step[0] === "insert") {
                    let pos;
                    if (step[1] === 0) {
                        pos = null;
                    } else {
                        pos = (step[1] - 1)
                    }
                    listItems.item(pos).after(html);
                }
            }
        }
        settleIDs();
    }

    /**
     * Dunno what it do. But at least it don't go down.
     */
    const grabAndIndex = function () {
        this.blogData = {};
        this.latestPost = 0;
        const ghost_root = "/ghost/api/v2";
        // noinspection JSUnresolvedVariable search_key has to be injected using the Ghost admin panel for security reasons.
        let url = ghost_root + "/content/posts/?key=" + search_key + "&limit=all&include=tags";

        const params = {
            limit: "all",
            include: "tags",
        };
        if (this.includebodysearch) {
            params.formats = ["plaintext"]
            url += "&formats=plaintext"
        } else {
            params.formats = [""]
        }
        const me = this;

        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    if (!data.posts) {
                        console.error("No posts received!");
                    } else {
                        const idxSrc = data.posts;
                        me.index = lunr(function () {
                            this.ref('id');
                            this.field('title');
                            this.field('description');
                            if (me.includebodysearch) {
                                this.field('plaintext');
                            }
                            this.field('pubDate');
                            this.field('tag');
                            idxSrc.forEach(function (arrayItem) {
                                // console.log("start indexing an item: " + arrayItem.id);
                                // Track the latest value of updated_at,  to stash in localStorage
                                const itemDate = new Date(arrayItem.updated_at).getTime();
                                const recordedDate = new Date(me.latestPost).getTime();
                                if (itemDate > recordedDate) {
                                    me.latestPost = arrayItem.updated_at;
                                }
                                const tag_arr = arrayItem.tags.map(function (v) {
                                    return v.name; // `tag` object has an `name` property which is the value of tag. If you also want other info, check API and get that property
                                })
                                if (arrayItem.meta_description == null) {
                                    arrayItem.meta_description = ''
                                }
                                let category = tag_arr.join(", ");
                                if (category.length < 1) {
                                    category = "undefined";
                                }
                                const parsedData = {
                                    id: String(arrayItem.id),
                                    title: String(arrayItem.title),
                                    description: String(arrayItem.custom_excerpt),
                                    pubDate: String(arrayItem.published_at),
                                    tag: category
                                }
                                if (me.includebodysearch) {
                                    parsedData.plaintext = String(arrayItem.plaintext);
                                }
                                this.add(parsedData)
                                const localUrl = me.subpath + arrayItem.url
                                me.blogData[arrayItem.id] = {
                                    title: arrayItem.title,
                                    description: arrayItem.custom_excerpt,
                                    pubDate: prettyDate(parsedData.pubDate),
                                    link: localUrl,
                                    tags: tag_arr
                                };
                                // If there is a metadata "pre"-processor for the item, run it here.
                                if (me.item_preprocessor) {
                                    Object.assign(me.blogData[arrayItem.id], me.item_preprocessor(arrayItem));
                                }
                                // console.log("done indexing the item");
                            }, this);
                        });
                        try {
                            const subpathKey = getSubpathKey(me.subpath);
                            localStorage.setItem(("ghost_" + subpathKey + "_lunrIndex"), JSON.stringify(me.index));
                            localStorage.setItem(("ghost_" + subpathKey + "_blogData"), JSON.stringify(me.blogData));
                            localStorage.setItem(("ghost_" + subpathKey + "_latestPost"), me.latestPost);
                        } catch (e) {
                            console.warn("ghostHunter: save to localStorage failed: " + e);
                        }
                        if (me.indexing_end) {
                            me.indexing_end();
                        }
                        me.isInit = true;
                    }
                } else {
                    console.error("Error executing request: " + xhr.status + "!")
                }
            }
        }
        xhr.open('GET', url, true);
        xhr.send(null);
    }

    /**
     * Main plugin functions.
     * @typedef {Object} GhostHunterFunctions
     * @property {boolean} isInit - is init? No idea what it means yet
     * @property {function} init - Plugin init function.
     * @property {function} loadAPI - Plugin API fetch function.
     * @property {function} find - Plugin search function.
     * @property {function} clear - Plugin clear function.
     * @property {function} format - Plugin format function.
     */

    /**
     * Main plugin functions. Or something like that...
     * @type {GhostHunterFunctions}
     */
    const ghostHunterFunctions = {

        isInit: false,

        /**
         * Init function.
         * @param target {HTMLInputElement} search field
         * @param result {HTMLElement} the div to render the results into
         * @param opts {GhostHunterOptions} options
         */
        init: function (target, result, opts) {
            const that = this;
            that.target = target;
            this.results = result
            Object.assign(this, opts);
            if (opts.onPageLoad) {
                function miam() {
                    that.loadAPI();
                }

                window.setTimeout(miam, 1);
            } else {
                target.addEventListener('focus', () => {
                    that.loadAPI();
                });
                target.focus();
            }

            target.form.addEventListener('submit', function (e) {
                e.preventDefault();
                that.find(target.value);
            });

            if (opts.onKeyUp) {
                // In search-as-you-type mode, the Enter key is meaningless,
                // so we disable it in the search field. If enabled, some browsers
                // will save data to history (even when autocomplete="false"), which
                // is an intrusive headache, particularly on mobile.
                target.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter') {
                        return false;
                    }
                });
                target.addEventListener('keyup', function (_) {
                    that.find(target.value);
                });
            }

        },

        loadAPI: function () {
            if (!this.isInit) {
                if (this.indexing_start) {
                    this.indexing_start();
                }
                // If isInit is falsy, check for data in localStore,
                // parse into memory, and declare isInit to be true.
                try {
                    const subpathKey = getSubpathKey(this.subpath);
                    this.index = localStorage.getItem(("ghost_" + subpathKey + "_lunrIndex"));
                    this.blogData = localStorage.getItem(("ghost_" + subpathKey + "_blogData"));
                    this.latestPost = localStorage.getItem(("ghost_" + subpathKey + "_latestPost"));
                    if (this.latestPost && this.index && this.blogData) {
                        //this.latestPost = this.latestPost;
                        this.index = lunr.Index.load(JSON.parse(this.index));
                        this.blogData = JSON.parse(this.blogData);
                        this.isInit = true;
                    }
                } catch (e) {
                    console.warn("ghostHunter: retrieve from localStorage failed: " + e);
                }
            }
            if (this.isInit) {
                const ghost_root = "/ghost/api/v2";
                // noinspection JSUnresolvedVariable search_key has to be injected using the Ghost admin panel for security reasons.
                const url = ghost_root + "/content/posts/?key=" + search_key + "&limit=all&fields=id" + "&filter=" + "updated_at:>\'" + this.latestPost.replace(/\..*/, "").replace(/T/, " ") + "\'";

                const me = this;

                const xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === XMLHttpRequest.DONE) {
                        if (xhr.status === 200) {
                            const data = JSON.parse(xhr.responseText);
                            if (!data.posts) {
                                console.error("No posts received!");
                            } else {
                                if (data.posts.length > 0) {
                                    grabAndIndex.call(me);
                                } else {
                                    if (me.indexing_end) {
                                        me.indexing_end();
                                    }
                                    me.isInit = true;
                                }
                            }
                        } else {
                            console.error("Unable to do request: " + xhr.status + "!")
                        }
                    }
                }
                xhr.open('GET', url, true);
                xhr.send(null);
            } else {
                // console.log('ghostHunter: this.isInit recheck is false');
                grabAndIndex.call(this)
            }
        },

        find: function (value) {
            clearTimeout(lastTimeoutID);
            if (!value) {
                value = "";
            }
            value = value.toLowerCase();
            lastTimeoutID = setTimeout(function () {
                // Query strategy is lifted from comments on a lunr.js issue: https://github.com/olivernn/lunr.js/issues/256
                let thingsFound = [];
                // The query interface expects single terms, so we split.
                const valueSplit = value.split(/\s+/);
                for (let i = 0, ilen = valueSplit.length; i < ilen; i++) {
                    // Fetch a list of matches for each term.
                    const v = valueSplit[i];
                    if (!v) continue;
                    thingsFound.push(this.index.query(function (q) {
                        // For an explanation of lunr indexing options, see the lunr.js
                        // documentation at https://lunrjs.com/docs/lunr.Query.html#~Clause

                        // look for an exact match and apply a large positive boost
                        q.term(v, {
                            usePipeline: true,
                            boost: 100,
                        });
                        // look for terms that match the beginning of this queryTerm and apply a medium boost
                        q.term(v, {
                            usePipeline: false,
                            boost: 10,
                            wildcard: lunr.Query.wildcard.TRAILING
                        });
                        // look for terms that match with an edit distance of 1 and apply a small boost
                        q.term(v, {
                            usePipeline: false,
                            editDistance: 1,
                            boost: 1
                        });
                    }));
                }
                let searchResult;
                if (thingsFound.length > 1) {
                    // If we had multiple terms, we'll have multiple lists. We filter
                    // them here to use only items that produce returns for all
                    // terms. This spoofs an AND join between terms, which lunr.js can't
                    // yet do internally.
                    // By using the first list of items as master, we get weightings
                    // based on the first term entered, which is more or less
                    // what we would expect.
                    searchResult = thingsFound[0];
                    thingsFound = thingsFound.slice(1);
                    for (let i = searchResult.length - 1; i > -1; i--) {
                        const ref = searchResult[i].ref;
                        for (let j = 0, jlen = thingsFound.length; j < jlen; j++) {
                            const otherRefs = {}
                            for (let k = 0, klen = thingsFound[j].length; k < klen; k++) {
                                otherRefs[thingsFound[j][k].ref] = true;
                            }
                            if (!otherRefs[ref]) {
                                searchResult = searchResult.slice(0, i).concat(searchResult.slice(i + 1));
                                break;
                            }
                        }
                    }
                } else if (thingsFound.length === 1) {
                    // If we had just one term and one list, return that.
                    searchResult = thingsFound[0];
                } else {
                    // If there was no search result, return an empty list.
                    searchResult = [];
                }

                const results = this.results;
                const resultsData = [];
                if (searchResult.length === 0) {
                    while (results.firstChild) {
                        results.removeChild(results.firstChild);
                    }
                    if (this.zeroResultsInfo) {
                        results.appendChild(this.format(this.info_template, {"amount": 0}));
                    }
                } else if (this.displaySearchInfo) {
                    if (results.childElementCount > 0) {
                        results.childNodes.item(0).replaceWith(this.format(this.info_template, {"amount": searchResult.length}));
                    } else {
                        results.appendChild(this.format(this.info_template, {"amount": searchResult.length}));
                    }
                } else if (!this.displaySearchInfo && this.zeroResultsInfo) {
                    document.getElementById('search-info').remove();
                }

                if (this.before) {
                    this.before();
                }

                // Get the blogData for the full set, for onComplete
                for (let i = 0; i < searchResult.length; i++) {
                    const lunrref = searchResult[i].ref;
                    const postData = this.blogData[lunrref];
                    if (postData) {
                        postData.ref = lunrref;
                        resultsData.push(postData);
                    } else {
                        console.warn("ghostHunter: index/data mismatch. Ouch.");
                    }
                }
                // Get an array of IDs present in current results
                const listItems = document.getElementsByClassName('gh-search-item');
                const currentRefs = Array.from(listItems).map(function (element) {
                    return document.getElementById(element.id.slice(3)); // I bet this is completely wrong m(
                });
                if (currentRefs.length === 0) {
                    for (let i = 0, ilen = resultsData.length; i < ilen; i++) {
                        results.append(this.format(this.result_template, resultsData[i]));
                    }
                    settleIDs();
                } else {
                    // Get an array of IDs present in searchResult
                    const newRefs = [];
                    for (let i = 0, ilen = searchResult.length; i < ilen; i++) {
                        newRefs.push(searchResult[i].ref)
                    }
                    // Get the Levenshtein steps needed to transform current into searchResult
                    const levenshtein = new Levenshtein(currentRefs, newRefs);
                    const steps = levenshtein.getSteps();
                    // Apply the operations
                    updateSearchList.call(this, listItems, searchResult, steps);
                }
                // Tidy up
                if (this.onComplete) {
                    this.onComplete(resultsData);
                }
            }.bind(this), 100);
        },

        clear: function () {
            while (this.results.firstChild) {
                this.results.removeChild(this.results.firstChild);
            }
            this.target.value = '';
        },

        format: function (t, d) {
            return t.replace(/{{([^{}]*)}}/g, function (a, b) {
                const r = d[b];
                return typeof r === 'string' || typeof r === 'number' ? r : a;
            });
        }
    }
})();
