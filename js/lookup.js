/* ── Script block 1 ── */

(function() {
    var el = document.getElementById('verse-app-data');
    if (!el) return;
    var D = JSON.parse(el.textContent);

    var table = document.querySelector('.parallel-table');
    var expanded = document.getElementById('expanded-view');
    var hint = document.querySelector('.click-hint');
    if (!table || !expanded) return;

    function esc(s) {
        if (!s) return '';
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    table.addEventListener('click', function(e) {
        var cell = e.target.closest('.verse-cell-clickable');
        if (!cell) return;

        var vnum  = cell.dataset.verse;
        var col   = cell.dataset.col;
        var name  = D.translationNames[col] || '';
        var text  = (D.verseTexts[col] || {})[vnum] || '';
        var words = D.interlinear[vnum] || [];

        var h = '<div class="expanded-header">'
              + '<div class="expanded-title">' + esc(name)
              + ' &mdash; Verse ' + esc(vnum) + '</div>'
              + '<button class="expanded-close" '
              + 'title="Back to translations">'
              + '&times;</button></div>'
              + '<div class="expanded-panel">';

        h += '<div class="expanded-text">'
           + '<div class="text-label">' + esc(name) + '</div>'
           + esc(text) + '</div>';

        h += '<div class="expanded-interlinear">';
        if (words.length) {
            h += '<table class="interlinear-table"><thead><tr>'
               + '<th>English</th><th>' + esc(D.langLabel) + '</th>'
               + '<th>Transliteration</th><th>Strong\'s</th>'
               + '<th>Definition</th></tr></thead><tbody>';
            for (var i = 0; i < words.length; i++) {
                var w = words[i];
                var lx = D.lexicon[w.strongs] || {};
                h += '<tr>'
                   + '<td>' + esc(w.text) + '</td>'
                   + '<td class="original-text ' + D.langClass + '">'
                   + esc(w.original) + '</td>'
                   + '<td class="transliteration">'
                   + esc(lx.translit || '') + '</td>';
                h += w.strongs
                   ? '<td><a href="word.html?s=' + encodeURIComponent(w.strongs) + '" class="strongs-num">'
                     + esc(w.strongs) + '</a></td>'
                   : '<td></td>';
                h += '<td class="strongs-def">'
                   + esc(lx.definition || '') + '</td></tr>';
            }
            h += '</tbody></table>';
        } else {
            h += '<div class="no-content">'
               + 'No interlinear data available for this verse.</div>';
        }
        h += '</div></div>';

        expanded.innerHTML = h;

        /* Animate: table slides out, then expanded view slides in */
        table.classList.add('collapsing');
        if (hint) hint.classList.add('collapsing');

        setTimeout(function() {
            table.classList.add('collapsed');
            table.classList.remove('collapsing');
            if (hint) { hint.classList.add('collapsed'); hint.classList.remove('collapsing'); }
            expanded.classList.add('active');
            expanded.querySelector('.expanded-close')
                    .addEventListener('click', closeExpanded);
            expanded.scrollIntoView({behavior: 'smooth', block: 'start'});
        }, 250);
    });

    function closeExpanded() {
        /* Animate: expanded panels slide out, then table slides back in */
        expanded.classList.add('closing');

        setTimeout(function() {
            expanded.classList.remove('active');
            expanded.classList.remove('closing');
            expanded.innerHTML = '';
            table.classList.remove('collapsed');
            table.classList.add('entering');
            if (hint) { hint.classList.remove('collapsed'); }
            table.scrollIntoView({behavior: 'smooth', block: 'start'});
            setTimeout(function() { table.classList.remove('entering'); }, 300);
        }, 250);
    }
})();

/* ── Chapter context expansion ─────────────────── */
function toggleContext() {
    var panel = document.getElementById('context-verses');
    var wrap  = document.getElementById('expand-chapter');
    if (!panel) return;
    if (panel.classList.contains('visible')) {
        panel.classList.remove('visible');
        panel.style.maxHeight = '';
        wrap.classList.remove('expanded');
    } else {
        panel.classList.add('visible');
        panel.style.maxHeight = panel.scrollHeight + 'px';
        wrap.classList.add('expanded');
    }
}

/* ── Cross-reference inline preview ────────────── */
(function() {
    var xrefPanel = document.getElementById('xref-panel');
    var links = document.querySelectorAll('.xref-link');
    if (!xrefPanel || !links.length) return;

    /* Cache fetched book data so we only download each book once */
    var bookCache = {};
    var isFileProtocol = location.protocol === 'file:';

    /* Translation labels matching BIBLE_ORDER in the Python script */
    var LABELS = window.BIBLE_LABELS || ["KJV", "BSB"];
    var KEYS   = window.BIBLE_KEYS || ["kjv", "bsb"];

    /* Parse an OSIS ref like "Rom.5.8" into {abbrev, chapter, verse}.
       For ranges like "Rom.5.8-Rom.5.10", returns start only. */
    function parseRef(ref) {
        var parts = ref.split('-')[0].split('.');
        return {abbrev: parts[0], chapter: parseInt(parts[1]), verse: parseInt(parts[2])};
    }

    /* Build the lookup page filename for a reference */
    function lookupUrl(ref) {
        var p = parseRef(ref);
        /* Find the book's full name from bible-meta if loaded,
           otherwise use the abbreviation as-is */
        return 'lookup_' + p.abbrev + '_' + p.chapter + '.html';
    }

    /* Convert OSIS ref to readable: "Rom.5.8" -> "Romans 5:8" */
    function readableRef(ref) {
        var parts = ref.split('.');
        if (parts.length === 3) return parts[0] + ' ' + parts[1] + ':' + parts[2];
        if (parts.length === 2) return parts[0] + ' ' + parts[1];
        return ref;
    }

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function showPanel(ref) {
        var parsed = parseRef(ref);
        var dataUrl = 'data/verses/' + parsed.abbrev + '.json';

        /* If file:// protocol, fetch won't work — show link instead */
        if (isFileProtocol) {
            var h = '<div class="xref-panel-inner">'
                  + '<div class="xref-panel-header">'
                  + '<span class="xref-panel-ref">' + esc(readableRef(ref)) + '</span>'
                  + '<button class="xref-panel-close" onclick="closeXref()">&times;</button>'
                  + '</div>'
                  + '<p style="color:#888;font-style:italic">Inline preview requires a '
                  + 'web server. <a href="' + lookupUrl(ref) + '">Open full page &rarr;</a></p>'
                  + '</div>';
            xrefPanel.innerHTML = h;
            xrefPanel.classList.add('visible');
            xrefPanel.style.maxHeight = xrefPanel.scrollHeight + 'px';
            return;
        }

        /* Check cache first */
        if (bookCache[parsed.abbrev]) {
            renderVerse(bookCache[parsed.abbrev], ref);
            return;
        }

        /* Show loading state */
        xrefPanel.innerHTML = '<div class="xref-panel-inner">'
            + '<span style="color:#888;font-style:italic">Loading...</span></div>';
        xrefPanel.classList.add('visible');
        xrefPanel.style.maxHeight = '60px';

        fetch(dataUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                bookCache[parsed.abbrev] = data;
                renderVerse(data, ref);
            })
            .catch(function() {
                xrefPanel.innerHTML = '<div class="xref-panel-inner">'
                    + '<span style="color:#c44">Could not load verse data.</span>'
                    + ' <a href="' + lookupUrl(ref) + '">Open full page &rarr;</a></div>';
                xrefPanel.style.maxHeight = xrefPanel.scrollHeight + 'px';
            });
    }

    function renderVerse(bookData, ref) {
        var parsed = parseRef(ref);
        /* Handle ranges: "Rom.5.8-Rom.5.10" means verses 8,9,10 */
        var rangeParts = ref.split('-');
        var startV = parsed.verse;
        var endV = startV;
        if (rangeParts.length > 1) {
            var endParts = rangeParts[1].split('.');
            endV = parseInt(endParts[endParts.length - 1]);
        }

        /* Find the chapter in the book data */
        var chData = null;
        for (var i = 0; i < bookData.chapters.length; i++) {
            if (bookData.chapters[i].chapter === parsed.chapter) {
                chData = bookData.chapters[i];
                break;
            }
        }

        var h = '<div class="xref-panel-inner">'
              + '<div class="xref-panel-header">'
              + '<span class="xref-panel-ref">' + esc(readableRef(ref)) + '</span>'
              + '<button class="xref-panel-close" onclick="closeXref()">&times;</button>'
              + '</div>';

        if (!chData) {
            h += '<p style="color:#888">Verse data not available.</p>';
        } else {
            for (var v = startV; v <= endV; v++) {
                /* Find this verse in the chapter */
                var verseData = null;
                for (var j = 0; j < chData.verses.length; j++) {
                    if (chData.verses[j].verse === v) {
                        verseData = chData.verses[j];
                        break;
                    }
                }
                if (!verseData) continue;

                var vLabel = (startV !== endV) ? ' (v' + v + ')' : '';
                for (var k = 0; k < KEYS.length; k++) {
                    var text = verseData[KEYS[k]] || '';
                    if (text) {
                        h += '<div class="xref-panel-verse">'
                           + '<span class="xref-panel-label">' + LABELS[k] + vLabel + '</span>'
                           + esc(text) + '</div>';
                    }
                }
            }
        }

        h += '<a class="xref-panel-link" href="' + lookupUrl(ref)
           + '">Open full page &rarr;</a></div>';

        xrefPanel.innerHTML = h;
        xrefPanel.classList.add('visible');
        xrefPanel.style.maxHeight = xrefPanel.scrollHeight + 'px';
    }

    /* Attach click handlers to all cross-ref links */
    for (var i = 0; i < links.length; i++) {
        links[i].addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();  /* Don't trigger the verse-cell interlinear */
            var ref = this.getAttribute('data-ref');
            if (ref) showPanel(ref);
        });
    }
})();

/* Global close function (called by the ✕ button in the panel) */
function closeXref() {
    var p = document.getElementById('xref-panel');
    if (p) {
        p.classList.remove('visible');
        p.style.maxHeight = '';
    }
}

/* ── Topics / Themes overflow toggle ────────────── */
(function() {
    var toggles = document.querySelectorAll('.topics-toggle');
    for (var i = 0; i < toggles.length; i++) {
        var btn = toggles[i];
        var row = btn.parentElement;
        if (!row) continue;

        /* Show button only if content overflows the 2-line cap */
        if (row.scrollHeight > row.clientHeight + 2) {
            btn.classList.add('visible');
        }

        btn.addEventListener('click', (function(b, r) {
            return function() {
                if (r.classList.contains('expanded')) {
                    r.style.maxHeight = '';
                    r.classList.remove('expanded');
                    b.textContent = 'more';
                } else {
                    r.classList.add('expanded');
                    r.style.maxHeight = r.scrollHeight + 'px';
                    b.textContent = 'less';
                }
            };
        })(btn, row));
    }
})();

/* ── Script block 2 ── */

(function() {
    var PAGE_KEY = window.PAGE_KEY || "";
    var PAGE_TITLE = window.PAGE_TITLE || "";

    /* ── Bookmark toggle ─────────────────────────── */
    var bmBtn = document.getElementById('bookmark-btn');
    if (bmBtn) {
        var bookmarks = [];
        try { bookmarks = JSON.parse(localStorage.getItem('bible-bookmarks') || '[]'); }
        catch(e) { bookmarks = []; }

        function isBookmarked() {
            for (var i = 0; i < bookmarks.length; i++) {
                if (bookmarks[i].href === PAGE_KEY) return true;
            }
            return false;
        }

        function updateBtn() {
            if (isBookmarked()) {
                bmBtn.textContent = 'Bookmarked';
                bmBtn.classList.add('active');
            } else {
                bmBtn.textContent = 'Bookmark';
                bmBtn.classList.remove('active');
            }
        }

        bmBtn.addEventListener('click', function() {
            if (isBookmarked()) {
                bookmarks = bookmarks.filter(function(b) { return b.href !== PAGE_KEY; });
            } else {
                var d = new Date();
                bookmarks.push({
                    href: PAGE_KEY,
                    title: PAGE_TITLE,
                    date: d.toISOString().slice(0,10)
                });
            }
            localStorage.setItem('bible-bookmarks', JSON.stringify(bookmarks));
            updateBtn();
        });

        updateBtn();
    }

    /* ── Verse highlight toggle ──────────────────── */
    var highlights = [];
    try {
        var allHL = JSON.parse(localStorage.getItem('bible-highlights') || '{}');
        highlights = allHL[PAGE_KEY] || [];
    } catch(e) { highlights = []; }

    function saveHighlights() {
        var allHL = {};
        try { allHL = JSON.parse(localStorage.getItem('bible-highlights') || '{}'); }
        catch(e) { allHL = {}; }
        if (highlights.length > 0) {
            allHL[PAGE_KEY] = highlights;
        } else {
            delete allHL[PAGE_KEY];
        }
        localStorage.setItem('bible-highlights', JSON.stringify(allHL));
    }

    function applyHighlights() {
        for (var i = 0; i < highlights.length; i++) {
            var row = document.getElementById('v-' + highlights[i]);
            if (row) row.classList.add('verse-row-highlighted');
        }
    }

    /* Click handler on verse number cells */
    document.addEventListener('click', function(e) {
        var cell = e.target.closest('.verse-num-cell[data-vnum]');
        if (!cell) return;
        var vnum = cell.getAttribute('data-vnum');
        var row = document.getElementById('v-' + vnum);
        if (!row) return;

        var idx = highlights.indexOf(vnum);
        if (idx === -1) {
            highlights.push(vnum);
            row.classList.add('verse-row-highlighted');
        } else {
            highlights.splice(idx, 1);
            row.classList.remove('verse-row-highlighted');
        }
        saveHighlights();
    });

    applyHighlights();
})();

/* ── Script block 3 ── */

(function() {
    var btns = document.querySelectorAll('.sq-btn:not(.disabled)');
    var panels = document.querySelectorAll('.sq-method-panel');
    if (!btns.length || !panels.length) return;

    btns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var method = btn.dataset.method;

            // Update active button
            btns.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');

            // Show matching panel, hide others
            panels.forEach(function(p) {
                if (p.dataset.method === method) {
                    p.classList.add('active');
                } else {
                    p.classList.remove('active');
                }
            });
        });
    });
})();

/* ── Script block 4 ── */

(function() {
    /* ── 1. Build sidebar from data-nav sections ─────────── */
    var sections = document.querySelectorAll('section[data-nav]');
    if (!sections.length) return;

    var icons = {
        translations: '≡',
        comparison:   '↔',
        questions:    '?',
        places:       '⚑',
        hymns:        '♫',
        liturgical:   '☼',
        commentary:   '✎',
        original:     'α'
    };

    var nav = document.getElementById('section-nav');
    if (!nav) return;

    sections.forEach(function(sec) {
        var key = sec.getAttribute('data-nav');
        var label = sec.getAttribute('data-nav-label');
        var btn = document.createElement('button');
        btn.className = 'section-nav-btn';
        btn.setAttribute('data-target', key);
        btn.title = label;
        btn.innerHTML = '<span class="section-nav-icon">'
            + (icons[key] || '•') + '</span>'
            + '<span class="section-nav-label">' + label + '</span>';
        btn.addEventListener('click', function() {
            // If collapsed, expand first
            var content = sec.querySelector('.section-content');
            if (content && content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                content.style.maxHeight = content.scrollHeight + 'px';
                var toggle = sec.querySelector('.section-collapse-btn');
                if (toggle) toggle.classList.remove('collapsed');
                // Update localStorage (mark as expanded)
                try {
                    var stored = JSON.parse(localStorage.getItem('bible-expanded-sections') || '{}');
                    stored[key] = true;
                    localStorage.setItem('bible-expanded-sections', JSON.stringify(stored));
                } catch(e) {}
                // Scroll after expand animation
                setTimeout(function() {
                    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 350);
            } else {
                sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        nav.appendChild(btn);
    });

    /* ── 2. Scroll-spy with IntersectionObserver ─────────── */
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var key = entry.target.getAttribute('data-nav');
                var allBtns = nav.querySelectorAll('.section-nav-btn');
                allBtns.forEach(function(b) { b.classList.remove('active'); });
                var match = nav.querySelector('[data-target="' + key + '"]');
                if (match) match.classList.add('active');
            }
        });
    }, {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
    });

    sections.forEach(function(sec) { observer.observe(sec); });

    /* ── 3. Collapsible sections ─────────────────────────── */
    // Default: all collapsed except Biblical Text. localStorage
    // stores which sections the user has manually expanded.
    var EXPAND_KEY = 'bible-expanded-sections';
    var expanded = {};
    try { expanded = JSON.parse(localStorage.getItem(EXPAND_KEY) || '{}'); } catch(e) {}
    // Biblical Text always starts expanded unless user collapsed it
    if (!expanded.hasOwnProperty('translations')) expanded['translations'] = true;

    sections.forEach(function(sec) {
        var key = sec.getAttribute('data-nav');

        var h2 = sec.querySelector('h2');
        if (!h2) return;

        // Wrap all content after h2 in a .section-content div
        var wrapper = document.createElement('div');
        wrapper.className = 'section-content';
        var sibling = h2.nextSibling;
        while (sibling) {
            var next = sibling.nextSibling;
            wrapper.appendChild(sibling);
            sibling = next;
        }
        sec.appendChild(wrapper);

        // Create collapse toggle
        var toggle = document.createElement('button');
        toggle.className = 'section-collapse-btn';
        toggle.innerHTML = '▼';
        toggle.title = 'Collapse section';
        toggle.setAttribute('aria-label', 'Collapse section');
        h2.appendChild(toggle);

        // Default to collapsed unless user previously expanded
        if (expanded[key]) {
            wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
        } else {
            wrapper.classList.add('collapsed');
            toggle.classList.add('collapsed');
        }

        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (wrapper.classList.contains('collapsed')) {
                // Expand
                wrapper.classList.remove('collapsed');
                wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
                toggle.classList.remove('collapsed');
                expanded[key] = true;
            } else {
                // Collapse: set explicit height first, then collapse
                wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
                wrapper.offsetHeight; // force reflow
                wrapper.classList.add('collapsed');
                toggle.classList.add('collapsed');
                delete expanded[key];
            }
            try { localStorage.setItem(EXPAND_KEY, JSON.stringify(expanded)); } catch(e) {}
        });

        // Recalculate max-height when dynamic content changes
        // (hymn lyrics <details>, study question panel switches)
        var details = wrapper.querySelectorAll('details');
        details.forEach(function(d) {
            d.addEventListener('toggle', function() {
                if (!wrapper.classList.contains('collapsed')) {
                    wrapper.style.maxHeight = 'none';
                }
            });
        });
        var sqBtns = wrapper.querySelectorAll('.sq-btn');
        sqBtns.forEach(function(b) {
            b.addEventListener('click', function() {
                if (!wrapper.classList.contains('collapsed')) {
                    setTimeout(function() {
                        wrapper.style.maxHeight = 'none';
                    }, 50);
                }
            });
        });
    });

    /* ── 3b. Expandable hymn cards (lyrics only) ──────────── */

    /* Click-to-expand only on cards that have lyrics */
    document.querySelectorAll('.hymn-card[data-has-lyrics]').forEach(function(card) {
        var header = card.querySelector('.hymn-card-header');
        var body = card.querySelector('.hymn-card-body');
        if (!header || !body) return;

        header.addEventListener('click', function(e) {
            if (e.target.closest('a') || e.target.closest('button')) return;

            card.classList.toggle('hymn-card-open');
            var wrapper = card.closest('.section-content');
            if (wrapper && !wrapper.classList.contains('collapsed')) {
                wrapper.style.maxHeight = 'none';
            }
        });
    });

    /* ── 4. Back-to-top button ───────────────────────────── */
    var topBtn = document.getElementById('back-to-top');
    if (topBtn) {
        topBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ── 5. Scroll progress bar + back-to-top visibility ── */
    var progressBar = document.getElementById('scroll-progress');
    var ticking = false;

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function() {
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            var docHeight = document.documentElement.scrollHeight - window.innerHeight;
            var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

            if (progressBar) progressBar.style.width = pct + '%';

            if (topBtn) {
                if (scrollTop > 300) {
                    topBtn.classList.add('visible');
                } else {
                    topBtn.classList.remove('visible');
                }
            }
            ticking = false;
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ── 6. Place tick marks on progress bar ──────────────── */
    var track = document.querySelector('.scroll-progress-track');
    if (track && sections.length > 1) {
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
            sections.forEach(function(sec, i) {
                if (i === 0) return;
                var secTop = sec.offsetTop;
                var pct = (secTop / (docHeight + window.innerHeight)) * 100;
                var tick = document.createElement('div');
                tick.className = 'scroll-progress-tick';
                tick.style.left = pct + '%';
                track.appendChild(tick);
            });
        }
    }
})();

/* ── Script block 5: Liturgical Season section ── */

(function() {
    var sec = document.getElementById('liturgical-section');
    if (!sec) {
        sec = document.querySelector('section[data-nav="liturgical"]');
    }
    if (!sec) return;

    var bookAbbrev = sec.getAttribute('data-book-abbrev') || '';
    var chapter = parseInt(sec.getAttribute('data-chapter'), 10) || 0;

    var COLOR_MAP = {
        advent: 'purple', christmas: 'gold', epiphany: 'gold',
        lent: 'purple', holy_week: 'red', easter: 'gold',
        ascension: 'gold', pentecost: 'red', ordinary: 'green'
    };

    /* ── Helpers ── */
    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function litLookupUrl(ref) {
        var p = ref.split('-')[0].split('.');
        if (p.length >= 2) return 'lookup_' + p[0] + '_' + p[1] + '.html';
        return '#';
    }

    /* ── Easter / liturgical season detection ── */
    /* Duplicated from study-core.js — lookup pages don't load that file */
    function getCurrentSeason() {
        var today = new Date();
        var y = today.getFullYear();
        var m = today.getMonth() + 1;
        var d = today.getDate();
        var doy = dayOfYear(m, d, y);

        function easterDoy(yr) {
            var a = yr % 19, b = Math.floor(yr / 100), c = yr % 100;
            var dd = Math.floor(b / 4), e = b % 4;
            var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
            var h = (19 * a + b - dd - g + 15) % 30;
            var i = Math.floor(c / 4), k = c % 4;
            var l = (32 + 2 * e + 2 * i - h - k) % 7;
            var mm = Math.floor((a + 11 * h + 22 * l) / 451);
            var em = Math.floor((h + l - 7 * mm + 114) / 31);
            var ed = ((h + l - 7 * mm + 114) % 31) + 1;
            return dayOfYear(em, ed, yr);
        }

        function dayOfYear(mm, dd, yr) {
            var days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            if (yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)) days[2] = 29;
            var t = 0;
            for (var i = 1; i < mm; i++) t += days[i];
            return t + dd;
        }

        var dec25doy = dayOfYear(12, 25, y);
        var dec24dow = new Date(y, 11, 24).getDay();
        var daysBack = (dec24dow + 1) % 7;
        var advent4 = dec25doy - 1 - daysBack;
        var adventStart = advent4 - 21;

        var easter = easterDoy(y);
        var ashWed = easter - 46;
        var palmSun = easter - 7;
        var ascension = easter + 39;
        var pentecost = easter + 49;

        if (doy >= adventStart && doy <= dec25doy - 1) return 'advent';
        if (doy >= dec25doy || doy <= 5) return 'christmas';
        if (doy >= 6 && doy < ashWed) return 'epiphany';
        if (doy >= ashWed && doy < palmSun) return 'lent';
        if (doy >= palmSun && doy < easter) return 'holy_week';
        if (doy >= easter && doy < ascension) return 'easter';
        if (doy >= ascension && doy < pentecost) return 'ascension';
        if (doy >= pentecost && doy < pentecost + 7) return 'pentecost';
        return 'ordinary';
    }

    /* ── Date formatting ── */
    var MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

    function formatDate(d) {
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatDateRange(seasonsData, seasonKey) {
        var ranges = seasonsData._dateRanges;
        if (!ranges || !ranges[seasonKey]) return '';
        var now = new Date();
        var year = now.getFullYear();
        var entries = ranges[seasonKey];
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].year === year || entries[i].year === year + 1) {
                var start = new Date(entries[i].start + 'T00:00:00');
                var end = new Date(entries[i].end + 'T00:00:00');
                return formatDate(start) + ' \u2013 ' + formatDate(end);
            }
        }
        if (entries.length > 0) {
            var s = new Date(entries[0].start + 'T00:00:00');
            var e = new Date(entries[0].end + 'T00:00:00');
            return formatDate(s) + ' \u2013 ' + formatDate(e);
        }
        return '';
    }

    /* ── Check if a reading's OSIS ref covers our chapter ── */
    function readingMatchesChapter(ref) {
        var parts = ref.split('-');
        var startParts = parts[0].split('.');
        if (startParts.length < 2) return false;
        var startBook = startParts[0];
        var startCh = parseInt(startParts[1], 10);
        if (startBook !== bookAbbrev) return false;
        if (startCh === chapter) return true;
        if (parts.length > 1) {
            var endPart = parts[1].split('.');
            var endCh;
            if (endPart.length >= 2) {
                endCh = parseInt(endPart[0], 10);
            } else {
                endCh = startCh;
            }
            if (chapter >= startCh && chapter <= endCh) return true;
        }
        return false;
    }

    /* ── Render: season banner ── */
    function renderBanner(season, seasonKey, dateStr, isCurrent) {
        var colorCls = 'lit-color-' + (COLOR_MAP[seasonKey] || 'green');
        var h = '<div class="' + colorCls + '">';
        h += '<div class="lit-banner">';
        h += '<div class="lit-banner-top">';
        h += '<span class="lit-banner-name">' + esc(season.name) + '</span>';
        if (isCurrent) {
            h += ' <span class="lit-banner-badge">Current Season</span>';
        }
        h += '</div>';
        if (dateStr) {
            h += '<div class="lit-banner-dates">' + esc(dateStr) + '</div>';
        }
        h += '<div class="lit-banner-desc">' + esc(season.description) + '</div>';
        h += '</div></div>';
        return h;
    }

    /* ── Render: chapter-season connection ── */
    function renderConnection(season, readings) {
        var matches = [];
        for (var i = 0; i < readings.length; i++) {
            if (readingMatchesChapter(readings[i].ref)) {
                matches.push(readings[i]);
            }
        }
        if (matches.length === 0) return '';
        var h = '<div class="lit-connection">';
        h += '<span class="lit-connection-icon">\u2731</span> ';
        h += 'This chapter is a featured reading for <strong>'
            + esc(season.name) + '</strong>: ';
        for (var j = 0; j < matches.length; j++) {
            if (j > 0) h += '; ';
            h += '<strong>' + esc(matches[j].label) + '</strong>';
            if (matches[j].note) {
                h += ' \u2014 <em>' + esc(matches[j].note) + '</em>';
            }
        }
        h += '</div>';
        return h;
    }

    /* ── Render: scripture readings ── */
    function renderReadings(season) {
        var readings = season.readings || [];
        if (readings.length === 0) return '';
        var h = '<h3 class="lit-sub-header">Scripture Readings for '
            + esc(season.name) + '</h3>';
        h += '<ul class="lit-readings-list">';
        for (var i = 0; i < readings.length; i++) {
            var r = readings[i];
            var isCurrent = readingMatchesChapter(r.ref);
            h += '<li class="lit-reading'
                + (isCurrent ? ' lit-reading-current' : '') + '">';
            h += '<a href="' + litLookupUrl(r.ref) + '">'
                + esc(r.label) + '</a>';
            if (r.note) {
                h += '<span class="lit-reading-note">'
                    + esc(r.note) + '</span>';
            }
            h += '</li>';
        }
        h += '</ul>';
        return h;
    }

    /* ── Render: prayers ── */
    function renderPrayers(allPrayers, seasonKey) {
        var filtered = [];
        for (var i = 0; i < allPrayers.length; i++) {
            var p = allPrayers[i];
            if (p.s && p.s.indexOf(seasonKey) !== -1) {
                filtered.push(p);
            }
        }
        if (filtered.length === 0) return '';
        filtered.sort(function(a, b) { return a.s.length - b.s.length; });

        var MAX_SHOW = 5;
        var showing = filtered.slice(0, MAX_SHOW);
        var h = '<h3 class="lit-sub-header">Prayers &amp; Collects</h3>';
        for (var j = 0; j < showing.length; j++) {
            var pr = showing[j];
            h += '<details class="lit-prayer">';
            h += '<summary>' + esc(pr.ti);
            if (pr.ty) {
                h += '<span class="lit-prayer-type">'
                    + esc(pr.ty) + '</span>';
            }
            h += '</summary>';
            h += '<div class="lit-prayer-body">';
            h += '<div class="lit-prayer-text">'
                + esc(pr.tx) + '</div>';
            if (pr.src) {
                h += '<div class="lit-prayer-source">'
                    + esc(pr.src) + '</div>';
            }
            h += '</div></details>';
        }
        if (filtered.length > MAX_SHOW) {
            h += '<a class="lit-more" href="seasonal.html?s='
                + seasonKey + '">View all ' + filtered.length
                + ' prayers \u2192</a>';
        }
        return h;
    }

    /* ── Render: hymns (from embedded compact lookup) ── */
    function renderHymns(hymnLookup, litData, seasonKey, seasonName) {
        var seasonNums = (litData.index && litData.index[seasonKey]) || [];
        if (seasonNums.length === 0) return '';

        var MAX_SHOW = 6;
        var showing = seasonNums.slice(0, MAX_SHOW);
        var h = '<h3 class="lit-sub-header">Hymns for '
            + esc(seasonName) + '</h3>';
        h += '<ul class="lit-hymn-list">';
        for (var j = 0; j < showing.length; j++) {
            var hym = hymnLookup[showing[j]];
            if (!hym) continue;
            h += '<li class="lit-hymn-item">';
            h += '<span class="lit-hymn-num">#' + showing[j] + '</span>';
            h += '<a class="lit-hymn-title" href="hymn.html?n='
                + showing[j] + '">' + esc(hym.fl) + '</a>';
            if (hym.a) {
                h += '<span class="lit-hymn-author">'
                    + esc(hym.a) + '</span>';
            }
            h += '</li>';
        }
        h += '</ul>';
        if (seasonNums.length > MAX_SHOW) {
            h += '<a class="lit-more" href="seasonal.html?s='
                + seasonKey + '">View all ' + seasonNums.length
                + ' hymns \u2192</a>';
        }
        return h;
    }

    /* ── Render: related Bible themes ── */
    function renderThemes(themeList) {
        if (!themeList || themeList.length === 0) return '';
        var h = '<h3 class="lit-sub-header">Related Bible Themes</h3>';
        h += '<div class="lit-themes-wrap">';
        for (var i = 0; i < themeList.length; i++) {
            var t = themeList[i];
            h += '<a class="lit-theme-tag" '
                + 'href="theme.html?id=' + t.id + '">'
                + esc(t.title)
                + '<span class="lit-theme-count"> ('
                + t.count + ')</span></a>';
        }
        h += '</div>';
        return h;
    }

    /* ── Main: read embedded data and render ── */
    var dataEl = document.getElementById('liturgical-data');
    if (!dataEl) return;

    var bundle;
    try {
        bundle = JSON.parse(dataEl.textContent);
    } catch (e) {
        return;
    }

    var seasonsData = bundle.seasons || {};
    var prayers = bundle.prayers || [];
    var litData = bundle.litIndex || {};
    var hymnLookup = bundle.hymns || {};
    var themeList = bundle.themes || [];

    var seasonKey = getCurrentSeason();
    var season = seasonsData[seasonKey];
    if (!season) {
        var el = sec.querySelector('.lit-loading');
        if (el) el.textContent = 'Season data not found.';
        return;
    }

    var dateStr = formatDateRange(seasonsData, seasonKey);

    var html = '';
    html += renderBanner(season, seasonKey, dateStr, true);
    html += renderConnection(season, season.readings || []);
    html += renderReadings(season);
    html += renderPrayers(prayers, seasonKey);
    html += renderHymns(hymnLookup, litData, seasonKey, season.name);
    html += renderThemes(
        (bundle.seasonThemes && bundle.seasonThemes[seasonKey]) || []);
    html += '<a class="lit-explore" href="seasonal.html?s='
        + seasonKey + '">Explore ' + esc(season.name)
        + ' in depth \u2192</a>';

    var wrapper = sec.querySelector('.section-content');
    if (wrapper) {
        wrapper.innerHTML = html;
        if (!wrapper.classList.contains('collapsed')) {
            wrapper.style.maxHeight = 'none';
        }
    } else {
        var loading = sec.querySelector('.lit-loading');
        if (loading) loading.remove();
        var div = document.createElement('div');
        div.innerHTML = html;
        while (div.firstChild) sec.appendChild(div.firstChild);
    }
})();