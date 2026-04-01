/* study-core.js — Shared utilities for Bible study tool pages */

/* Cache for fetched JSON files */
var _fetchCache = {};

/* Fetch JSON with caching and error handling */
function fetchJSON(url) {
    if (_fetchCache[url]) return _fetchCache[url];
    _fetchCache[url] = fetch(url)
        .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        });
    return _fetchCache[url];
}

/* Read a URL query parameter */
function getUrlParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
}

/* Convert OSIS ref to readable: "Rom.5.8" -> "Rom 5:8" */
function osisToReadable(ref) {
    if (ref.indexOf('-') !== -1) {
        var parts = ref.split('-');
        var left = osisToReadable(parts[0]);
        var right = osisToReadable(parts[1]);
        var lp = left.split(':')[0];
        var rp = right.split(':')[0];
        if (lp === rp) return left + '-' + right.split(':')[1];
        return left + '\u2013' + right;
    }
    var p = ref.split('.');
    if (p.length === 3) return p[0] + ' ' + p[1] + ':' + p[2];
    if (p.length === 2) return p[0] + ' ' + p[1];
    return ref;
}

/* Build the lookup page URL for a reference */
function lookupPageUrl(ref) {
    var p = ref.split('-')[0].split('.');
    if (p.length >= 2) return 'lookup_' + p[0] + '_' + p[1] + '.html';
    return '#';
}

/* Escape HTML characters */
function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

/* Render a verse item: reference link + ESV text */
function renderVerseItem(ref, text, score) {
    var readable = osisToReadable(ref);
    var h = '<li class="verse-item">'
          + '<a class="verse-ref" href="' + lookupPageUrl(ref) + '">'
          + esc(readable) + '</a>';
    if (score !== undefined && score !== null) {
        h += '<span class="verse-score">relevance: ' + score + '</span>';
    }
    h += '<div class="verse-text">' + esc(text) + '</div></li>';
    return h;
}

/* Fetch verse text from per-book JSON files.
   Returns a promise that resolves to the text string.
   ref is an OSIS ref like "Rom.5.8" */
function fetchVerseText(ref) {
    var parts = ref.split('-')[0].split('.');
    var abbrev = parts[0];
    var chapter = parseInt(parts[1]);
    var verse = parseInt(parts[2]);

    return fetchJSON('data/verses/' + abbrev + '.json').then(function(data) {
        for (var i = 0; i < data.chapters.length; i++) {
            if (data.chapters[i].chapter === chapter) {
                var verses = data.chapters[i].verses;
                for (var j = 0; j < verses.length; j++) {
                    if (verses[j].verse === verse) {
                        return verses[j].esv || verses[j].kjv || verses[j].bsb || '';
                    }
                }
            }
        }
        return '';
    });
}

/* Fetch text for multiple verse refs and render them as a list.
   Returns a promise that resolves when the container is filled. */
function renderVerseList(container, refs, scores) {
    if (!refs || refs.length === 0) {
        container.innerHTML = '<p class="loading">No verses found.</p>';
        return Promise.resolve();
    }

    container.innerHTML = '<p class="loading">Loading verses...</p>';

    /* Group refs by book abbreviation to minimize fetches */
    var byBook = {};
    for (var i = 0; i < refs.length; i++) {
        var abbrev = refs[i].split('.')[0];
        if (!byBook[abbrev]) byBook[abbrev] = [];
        byBook[abbrev].push({ref: refs[i], index: i});
    }

    /* Fetch all needed books in parallel */
    var bookNames = Object.keys(byBook);
    var fetches = bookNames.map(function(abbrev) {
        return fetchJSON('data/verses/' + abbrev + '.json');
    });

    return Promise.all(fetches).then(function(bookDataArray) {
        /* Build a lookup from book data */
        var textLookup = {};
        for (var b = 0; b < bookNames.length; b++) {
            var bookData = bookDataArray[b];
            for (var c = 0; c < bookData.chapters.length; c++) {
                var ch = bookData.chapters[c];
                for (var v = 0; v < ch.verses.length; v++) {
                    var vd = ch.verses[v];
                    var key = bookData.abbrev + '.' + ch.chapter + '.' + vd.verse;
                    textLookup[key] = vd.esv || vd.kjv || vd.bsb || '';
                }
            }
        }

        /* Render in original order */
        var html = '<ul class="verse-list">';
        for (var i = 0; i < refs.length; i++) {
            var text = textLookup[refs[i]] || '';
            var score = scores ? scores[i] : null;
            html += renderVerseItem(refs[i], text, score);
        }
        html += '</ul>';
        container.innerHTML = html;
    }).catch(function() {
        container.innerHTML = '<p class="error">Error loading verse data.</p>';
    });
}
