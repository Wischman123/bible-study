(function() {
    var hymnNum = getUrlParam('n');

    var titleEl = document.getElementById('page-title');
    var subtitleEl = document.getElementById('page-subtitle');
    var infoEl = document.getElementById('info-card');
    var contentEl = document.getElementById('content');

    if (!hymnNum) {
        /* ── Browse mode: list all hymns ── */
        document.title = 'Hymn Explorer \u2014 The Sing! Hymnal';
        titleEl.textContent = 'Hymn Explorer';
        subtitleEl.textContent = 'The Sing! Hymnal (2025, Crossway)';

        fetchJSON('data/hymns.json').then(function(hymns) {
            /* Build search/filter UI */
            var formHtml = '<div class="hymn-search">'
                + '<input type="text" id="hymn-filter" '
                + 'placeholder="Search by title, tune, or author...">'
                + '<select id="hymn-sort">'
                + '<option value="number">By Number</option>'
                + '<option value="title">By Title</option>'
                + '<option value="tune">By Tune</option>'
                + '<option value="author">By Author</option>'
                + '</select></div>';
            infoEl.innerHTML = formHtml;

            var filterInput = document.getElementById('hymn-filter');
            var sortSelect = document.getElementById('hymn-sort');

            function renderList(filtered, sortBy) {
                /* Sort */
                var sorted = filtered.slice();
                if (sortBy === 'title') {
                    sorted.sort(function(a, b) {
                        return (a.fl || '').localeCompare(b.fl || '');
                    });
                } else if (sortBy === 'tune') {
                    sorted.sort(function(a, b) {
                        return (a.t || '').localeCompare(b.t || '');
                    });
                } else if (sortBy === 'author') {
                    sorted.sort(function(a, b) {
                        return (a.a || '').localeCompare(b.a || '');
                    });
                }
                /* Default: by number (already in order from JSON) */

                var countHtml = '<div class="hymn-browse-count">'
                    + filtered.length + ' hymn'
                    + (filtered.length !== 1 ? 's' : '');
                if (filtered.length !== hymns.length) {
                    countHtml += ' (of ' + hymns.length + ' total)';
                }
                countHtml += '</div>';

                var html = countHtml + '<ul class="hymn-list">';
                for (var i = 0; i < sorted.length; i++) {
                    var h = sorted[i];
                    html += '<li class="hymn-list-item">'
                        + '<span class="hymn-list-num">' + h.n + '</span>'
                        + '<a class="hymn-list-title" href="hymn.html?n='
                        + h.n + '">' + esc(h.fl) + '</a>'
                        + '<span class="hymn-list-meta">'
                        + esc(h.t || '');
                    if (h.a) {
                        html += ' \u00b7 ' + esc(h.a);
                    }
                    html += '</span></li>';
                }
                html += '</ul>';
                contentEl.innerHTML = html;
            }

            function applyFilter() {
                var query = filterInput.value.toLowerCase().trim();
                var sortBy = sortSelect.value;
                if (!query) {
                    renderList(hymns, sortBy);
                    return;
                }
                var filtered = hymns.filter(function(h) {
                    return (h.fl || '').toLowerCase().indexOf(query) !== -1
                        || (h.t || '').toLowerCase().indexOf(query) !== -1
                        || (h.a || '').toLowerCase().indexOf(query) !== -1;
                });
                renderList(filtered, sortBy);
            }

            filterInput.addEventListener('input', applyFilter);
            sortSelect.addEventListener('change', applyFilter);

            /* Check URL for a search query */
            var qParam = getUrlParam('q');
            if (qParam) {
                filterInput.value = qParam;
            }

            applyFilter();

            /* Load liturgical season data and show seasonal section */
            fetchJSON('data/hymn-liturgical.json').then(function(litData) {
                var season = getCurrentSeason();
                if (!season || !litData.index[season]) return;

                var seasonNums = litData.index[season];
                if (seasonNums.length === 0) return;

                var label = litData.seasons[season] || season;
                var seasonHymns = hymns.filter(function(h) {
                    return seasonNums.indexOf(h.n) !== -1;
                });
                if (seasonHymns.length === 0) return;

                var html = '<div class="hymn-season-box">'
                    + '<h2 class="hymn-season-title">Hymns for '
                    + esc(label) + '</h2>'
                    + '<div class="hymn-season-count">'
                    + seasonHymns.length + ' hymn'
                    + (seasonHymns.length !== 1 ? 's' : '')
                    + ' for this season</div>'
                    + '<ul class="hymn-list">';

                /* Show up to 10, with a "show all" toggle */
                var limit = Math.min(seasonHymns.length, 10);
                for (var i = 0; i < limit; i++) {
                    var h = seasonHymns[i];
                    html += '<li class="hymn-list-item">'
                        + '<span class="hymn-list-num">' + h.n + '</span>'
                        + '<a class="hymn-list-title" href="hymn.html?n='
                        + h.n + '">' + esc(h.fl) + '</a>'
                        + '<span class="hymn-list-meta">'
                        + esc(h.t || '') + '</span></li>';
                }
                if (seasonHymns.length > 10) {
                    html += '<li class="hymn-list-item" style="justify-content:center">'
                        + '<a href="hymn.html?q=' + encodeURIComponent(label)
                        + '" style="font-size:0.9em;color:#7a3b4e;">'
                        + 'See all ' + seasonHymns.length + ' '
                        + esc(label) + ' hymns</a></li>';
                }
                html += '</ul></div>';

                /* Insert before the main list */
                var seasonEl = document.createElement('div');
                seasonEl.innerHTML = html;
                contentEl.parentNode.insertBefore(seasonEl, contentEl);
            }).catch(function() {
                /* Silently ignore — liturgical data is optional */
            });

        }).catch(function(err) {
            contentEl.innerHTML = '<p class="error">Error loading hymn data: '
                + esc(String(err)) + '</p>';
        });

        return;
    }

    /* ── Detail mode: show one hymn ── */
    var num = parseInt(hymnNum);
    if (isNaN(num)) {
        contentEl.innerHTML = '<p class="error">Invalid hymn number.</p>';
        return;
    }

    Promise.all([
        fetchJSON('data/hymns.json'),
        fetchJSON('data/hymn-scripture.json')
    ]).then(function(results) {
        var hymns = results[0];
        var scriptureIndex = results[1];

        /* Find this hymn and its neighbors (for prev/next nav) */
        var hymn = null;
        var prevHymn = null;
        var nextHymn = null;
        for (var i = 0; i < hymns.length; i++) {
            if (hymns[i].n === num) {
                hymn = hymns[i];
                if (i > 0) prevHymn = hymns[i - 1];
                if (i < hymns.length - 1) nextHymn = hymns[i + 1];
                break;
            }
        }

        if (!hymn) {
            contentEl.innerHTML = '<p class="error">Hymn #' + num
                + ' not found. It may be a reading rather than a singable hymn.</p>';
            return;
        }

        /* Title bar */
        document.title = '#' + hymn.n + ' ' + hymn.fl
            + ' \u2014 The Sing! Hymnal';
        titleEl.textContent = hymn.fl;
        subtitleEl.textContent = 'The Sing! Hymnal #' + hymn.n;

        /* Detail card */
        var card = '<div class="hymn-detail-card">';
        card += '<div class="hymn-detail-number">Sing! Hymnal #'
            + hymn.n + '</div>';
        card += '<div class="hymn-detail-title">' + esc(hymn.fl) + '</div>';

        if (hymn.a) {
            card += '<div class="hymn-detail-row">'
                + '<span class="hymn-detail-label">Author</span>'
                + '<span class="hymn-detail-value">' + esc(hymn.a);
            if (hymn.y) card += ' (' + hymn.y + ')';
            card += '</span></div>';
        }
        if (hymn.t) {
            card += '<div class="hymn-detail-row">'
                + '<span class="hymn-detail-label">Tune</span>'
                + '<span class="hymn-detail-value">' + esc(hymn.t) + '</span></div>';
        }
        if (hymn.tc) {
            card += '<div class="hymn-detail-row">'
                + '<span class="hymn-detail-label">Composer</span>'
                + '<span class="hymn-detail-value">' + esc(hymn.tc) + '</span></div>';
        }
        if (hymn.m) {
            card += '<div class="hymn-detail-row">'
                + '<span class="hymn-detail-label">Meter</span>'
                + '<span class="hymn-detail-value">' + esc(hymn.m) + '</span></div>';
        }

        /* Scripture references */
        if (hymn.sr && hymn.sr.length > 0) {
            card += '<div class="hymn-scripture-links">'
                + '<h3>Scripture References</h3>';
            for (var s = 0; s < hymn.sr.length; s++) {
                var ref = hymn.sr[s];
                card += '<a class="hymn-scripture-tag" href="'
                    + scriptureToLookupUrl(ref) + '">'
                    + esc(ref) + '</a>';
            }
            card += '</div>';
        }

        card += '</div>';
        infoEl.innerHTML = card;

        /* Topics */
        var bodyHtml = '';
        if (hymn.tp && hymn.tp.length > 0) {
            bodyHtml += '<h2>Topics</h2><div style="margin-bottom:16px;">';
            for (var t = 0; t < hymn.tp.length; t++) {
                bodyHtml += '<span class="hymn-scripture-tag" style="'
                    + 'background:#e8f0fe;color:#1a56db;">'
                    + esc(hymn.tp[t]) + '</span>';
            }
            bodyHtml += '</div>';
        }

        /* Manser Bible Themes (from AI mapping) */
        if (hymn.th && hymn.th.length > 0) {
            bodyHtml += '<h2>Bible Themes</h2>'
                + '<div id="hymn-themes-container" style="margin-bottom:16px;">'
                + '<span class="loading">Loading themes...</span></div>';
            fetchJSON('data/themes.json').then(function(themeData) {
                var el = document.getElementById('hymn-themes-container');
                if (!el) return;
                var html = '';
                for (var ti = 0; ti < hymn.th.length; ti++) {
                    var themeId = hymn.th[ti];
                    var theme = themeData[String(themeId)];
                    if (theme) {
                        html += '<a class="hymn-scripture-tag" '
                            + 'href="theme.html?id=' + themeId + '" '
                            + 'style="background:#f0f5e8;color:#3d7317;">'
                            + esc(theme.title) + '</a>';
                    }
                }
                el.innerHTML = html;
            });
        }

        /* Find which chapters reference this hymn */
        var relatedChapters = [];
        for (var ch in scriptureIndex) {
            if (scriptureIndex[ch].indexOf(num) !== -1) {
                relatedChapters.push(ch);
            }
        }
        if (relatedChapters.length > 0) {
            bodyHtml += '<h2>Related Passages</h2>'
                + '<div style="margin-bottom:16px;">';
            for (var c = 0; c < relatedChapters.length; c++) {
                var chName = relatedChapters[c];
                var parts = chName.split(' ');
                var chNum = parts.pop();
                var bookName = parts.join(' ');
                /* Build lookup filename: lookup_BookName_Chapter.html */
                var slug = bookName.replace(/ /g, '_');
                bodyHtml += '<a class="hymn-scripture-tag" href="lookup_'
                    + slug + '_' + chNum + '.html">'
                    + esc(chName) + '</a>';
            }
            bodyHtml += '</div>';
        }

        /* Lyrics (public domain only — included in JSON as "l" key) */
        if (hymn.l && hymn.l.length > 0) {
            bodyHtml += '<h2>Lyrics</h2>'
                + '<div class="hymn-lyrics">';
            for (var v = 0; v < hymn.l.length; v++) {
                bodyHtml += '<div class="hymn-verse">'
                    + '<span class="hymn-verse-num">' + (v + 1) + '</span>'
                    + '<p>' + esc(hymn.l[v]) + '</p></div>';
            }
            bodyHtml += '<div class="hymn-lyrics-source">'
                + 'Public domain text via Open Hymnal Project</div>';
            bodyHtml += '</div>';
        } else {
            bodyHtml += '<div class="hymn-lyrics-note">'
                + 'Lyrics not available \u2014 see Sing! Hymnal #'
                + hymn.n + '</div>';
        }

        /* External link */
        if (hymn.url) {
            bodyHtml += '<div class="hymn-external">'
                + '<a href="' + esc(hymn.url)
                + '" target="_blank" rel="noopener">'
                + 'View on Hymnary.org \u2197</a></div>';
        }

        /* Prev/next navigation */
        bodyHtml += '<div class="hymn-nav">';
        if (prevHymn) {
            bodyHtml += '<a href="hymn.html?n=' + prevHymn.n
                + '">\u2190 #' + prevHymn.n + ' '
                + esc(prevHymn.fl) + '</a>';
        } else {
            bodyHtml += '<span></span>';
        }
        if (nextHymn) {
            bodyHtml += '<a href="hymn.html?n=' + nextHymn.n
                + '">#' + nextHymn.n + ' '
                + esc(nextHymn.fl) + ' \u2192</a>';
        }
        bodyHtml += '</div>';

        contentEl.innerHTML = bodyHtml;

    }).catch(function(err) {
        contentEl.innerHTML = '<p class="error">Error loading hymn data: '
            + esc(String(err)) + '</p>';
    });

    /* Convert a scripture reference string like "Psalm 23:1-6" to a
       lookup page URL. Best-effort — falls back to # if unparseable. */
    function scriptureToLookupUrl(ref) {
        /* Remove verse portion (everything after the colon) */
        var chapterPart = ref.replace(/:.*$/, '').trim();
        /* Handle numbered books: "1 Corinthians 13" */
        var parts = chapterPart.split(' ');
        var chNum = parts.pop();
        if (!/^\d+$/.test(chNum)) return '#';
        var bookName = parts.join(' ');
        if (!bookName) return '#';
        /* Normalize: "Psalm" -> "Psalms" etc. */
        var slug = bookName.replace(/ /g, '_');
        return 'lookup_' + slug + '_' + chNum + '.html';
    }
})();
