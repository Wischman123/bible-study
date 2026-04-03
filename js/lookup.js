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