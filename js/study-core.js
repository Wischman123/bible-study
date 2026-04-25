/* study-core.js — Shared utilities for Bible study tool pages */

/* Cache for fetched JSON files.
   Pages opened from file:// can pre-populate this via _inlineData
   so that fetch() (which is blocked on file://) is never called. */
var _fetchCache = {};
var _inlineData = window._inlineData || {};

/* Fetch JSON with caching and error handling */
function fetchJSON(url) {
    if (_fetchCache[url]) return _fetchCache[url];
    if (_inlineData[url]) {
        _fetchCache[url] = Promise.resolve(_inlineData[url]);
        return _fetchCache[url];
    }
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

/* Render a verse item: reference link + verse text */
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
                        return verses[j].kjv || verses[j].bsb || '';
                    }
                }
            }
        }
        return '';
    });
}

/* ── Liturgical season computation ──────────────────────────────────
   Easter uses the Meeus/Jones/Butcher algorithm. All other seasons
   are computed relative to Easter (moveable) and Christmas (fixed). */

function _dayOfYear(mm, dd, yr) {
    var days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)) days[2] = 29;
    var t = 0;
    for (var i = 1; i < mm; i++) t += days[i];
    return t + dd;
}

function _easterDoy(yr) {
    var a = yr % 19, b = Math.floor(yr / 100), c = yr % 100;
    var dd = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - dd - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var mm = Math.floor((a + 11 * h + 22 * l) / 451);
    var em = Math.floor((h + l - 7 * mm + 114) / 31);
    var ed = ((h + l - 7 * mm + 114) % 31) + 1;
    return _dayOfYear(em, ed, yr);
}

/* Compute the season boundary day-of-year values for a given year.
   Returns an object with all the key boundaries. */
function _seasonBounds(y) {
    var dec25doy = _dayOfYear(12, 25, y);
    var dec24dow = new Date(y, 11, 24).getDay();
    var daysBack = (dec24dow + 1) % 7;
    var advent4 = dec25doy - 1 - daysBack;
    var adventStart = advent4 - 21;
    var easter = _easterDoy(y);
    return {
        adventStart: adventStart,
        christmas: dec25doy,
        ashWed: easter - 46,
        palmSun: easter - 7,
        easter: easter,
        ascension: easter + 39,
        pentecost: easter + 49
    };
}

/* Return the liturgical season for any date.
   Args: y = full year, m = 1-12, d = 1-31. */
function getSeasonForDate(y, m, d) {
    var doy = _dayOfYear(m, d, y);
    var b = _seasonBounds(y);
    if (doy >= b.adventStart && doy < b.christmas) return 'advent';
    if (doy >= b.christmas || doy <= 5) return 'christmas';
    if (doy >= 6 && doy < b.ashWed) return 'epiphany';
    if (doy >= b.ashWed && doy < b.palmSun) return 'lent';
    if (doy >= b.palmSun && doy < b.easter) return 'holy_week';
    if (doy >= b.easter && doy < b.ascension) return 'easter';
    if (doy >= b.ascension && doy < b.pentecost) return 'ascension';
    if (doy >= b.pentecost && doy < b.pentecost + 7) return 'pentecost';
    return 'ordinary';
}

/* Determine the current liturgical season. */
function getCurrentSeason() {
    var today = new Date();
    return getSeasonForDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

/* Return the current RCL lectionary year letter ('A', 'B', or 'C').
   The lectionary year starts at Advent, not January 1. From Advent
   through Dec 31, readings come from the *next* calendar year's cycle.
   Formula: effective_year % 3 → 1=A, 2=B, 0=C. */
function getLectionaryYear() {
    var today = new Date();
    var y = today.getFullYear();
    var dec24 = new Date(y, 11, 24);
    var daysBack = (dec24.getDay() + 1) % 7;
    var advent4 = new Date(dec24.getTime() - daysBack * 86400000);
    var adventStart = new Date(advent4.getTime() - 21 * 86400000);
    var effYear = today >= adventStart ? y + 1 : y;
    var r = effYear % 3;
    return r === 1 ? 'A' : r === 2 ? 'B' : 'C';
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
                    textLookup[key] = vd.kjv || vd.bsb || '';
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
