(function() {
    var titleEl = document.getElementById('page-title');
    var subtitleEl = document.getElementById('page-subtitle');
    var infoEl = document.getElementById('info-card');
    var contentEl = document.getElementById('content');

    /* Liturgical color mapping for CSS classes */
    var COLOR_MAP = {
        advent: 'purple', christmas: 'gold', epiphany: 'gold',
        lent: 'purple', holy_week: 'red', easter: 'gold',
        ascension: 'gold', pentecost: 'red', ordinary: 'green'
    };

    /* Season display order */
    var SEASON_ORDER = [
        'advent', 'christmas', 'epiphany', 'lent', 'holy_week',
        'easter', 'ascension', 'pentecost', 'ordinary'
    ];

    /* Determine which season to show */
    var requestedSeason = getUrlParam('s');
    var currentSeason = getCurrentSeason();
    var activeSeason = requestedSeason || currentSeason;

    /* Load all data in parallel */
    Promise.all([
        fetchJSON('data/seasons.json'),
        fetchJSON('data/prayers.json'),
        fetchJSON('data/hymn-liturgical.json'),
        fetchJSON('data/hymns.json'),
        fetchJSON('data/lectionary.json')
    ]).then(function(results) {
        var seasonsData = results[0];
        var prayersData = results[1];
        var litData = results[2];
        var hymns = results[3];
        var lectData = results[4];

        renderPage(seasonsData, prayersData, litData, hymns, lectData, activeSeason);
    }).catch(function(err) {
        contentEl.innerHTML = '<p class="error">Error loading seasonal data: '
            + esc(String(err)) + '</p>';
    });


    function renderPage(seasonsData, prayers, litData, hymns, lectData, seasonKey) {
        /* Validate the season key */
        var season = seasonsData[seasonKey];
        if (!season) {
            seasonKey = currentSeason;
            season = seasonsData[seasonKey];
        }
        if (!season) {
            contentEl.innerHTML = '<p class="error">Season data not found.</p>';
            return;
        }

        var colorClass = 'season-color-' + (COLOR_MAP[seasonKey] || 'green');

        /* Title */
        document.title = season.name + ' \u2014 Liturgical Season';
        titleEl.textContent = season.name;
        var isCurrent = (seasonKey === currentSeason);
        subtitleEl.textContent = isCurrent
            ? 'Current liturgical season'
            : 'Liturgical season';

        /* Season selector pills */
        var pillsHtml = '<div class="season-selector">';
        for (var i = 0; i < SEASON_ORDER.length; i++) {
            var sk = SEASON_ORDER[i];
            var sd = seasonsData[sk];
            if (!sd) continue;
            var isActive = (sk === seasonKey);
            var cls = 'season-pill' + (isActive ? ' active' : '');
            pillsHtml += '<a class="' + cls + '" href="seasonal.html?s='
                + sk + '">' + esc(sd.name) + '</a>';
        }
        pillsHtml += '</div>';
        infoEl.innerHTML = pillsHtml;

        /* Banner with description and dates */
        var dateStr = formatDateRange(seasonsData, seasonKey);
        var bannerHtml = '<div class="' + colorClass + '">'
            + '<div class="season-banner" style="border-color:' + esc(season.color) + ';">'
            + '<div class="season-banner-name">' + esc(season.name) + '</div>';
        if (dateStr) {
            bannerHtml += '<div class="season-banner-dates">' + esc(dateStr) + '</div>';
        }
        bannerHtml += '<div class="season-banner-desc">' + esc(season.description) + '</div>'
            + '</div></div>';

        /* Build all content sections */
        var html = bannerHtml;

        /* Liturgical year calendar */
        var now = new Date();
        html += renderCalendar(now.getFullYear(), seasonKey);

        /* Section A: Scripture Readings */
        html += renderReadings(season);

        /* Section A2: Lectionary Readings */
        html += renderLectionary(lectData, seasonKey);

        /* Section B: Prayers */
        html += renderPrayers(prayers, seasonKey);

        /* Section C: Hymns */
        html += renderHymns(hymns, litData, seasonKey);

        /* Section D: Related Themes */
        html += '<div id="season-themes" class="season-section"></div>';

        contentEl.innerHTML = html;

        /* Lazy-load themes (optional data, don't block render) */
        loadThemes(seasonKey);

        /* Apply the color class to the parent for pill styling */
        var selectorEl = infoEl.querySelector('.season-selector');
        if (selectorEl) selectorEl.classList.add(colorClass);
    }


    /* ── Section renderers ───────────────────────────── */

    function renderReadings(season) {
        var readings = season.readings || [];
        if (readings.length === 0) return '';

        var html = '<div class="season-section">'
            + '<h2>Scripture Readings</h2>';
        for (var i = 0; i < readings.length; i++) {
            var r = readings[i];
            var url = lookupPageUrl(r.ref);
            html += '<div class="reading-card">'
                + '<a class="reading-ref" href="' + url + '">'
                + esc(r.label) + '</a>'
                + '<span class="reading-note">' + esc(r.note) + '</span>'
                + '</div>';
        }
        html += '</div>';
        return html;
    }


    function renderPrayers(allPrayers, seasonKey) {
        /* Filter prayers for this season */
        var seasonPrayers = [];
        for (var i = 0; i < allPrayers.length; i++) {
            var p = allPrayers[i];
            if (p.s && p.s.indexOf(seasonKey) !== -1) {
                seasonPrayers.push(p);
            }
        }

        if (seasonPrayers.length === 0) return '';

        /* Sort: season-specific first (fewer seasons), universal last */
        seasonPrayers.sort(function(a, b) {
            return a.s.length - b.s.length;
        });

        var html = '<div class="season-section">'
            + '<h2>Prayers &amp; Collects</h2>';
        for (var j = 0; j < seasonPrayers.length; j++) {
            var pr = seasonPrayers[j];
            html += '<details class="prayer-card">'
                + '<summary>' + esc(pr.ti)
                + '<span class="prayer-type-tag">' + esc(pr.ty) + '</span>'
                + '</summary>'
                + '<div class="prayer-card-body">'
                + '<div class="prayer-text">' + esc(pr.tx) + '</div>'
                + '<div class="prayer-source">' + esc(pr.src) + '</div>'
                + '</div></details>';
        }
        html += '</div>';
        return html;
    }


    function renderHymns(hymns, litData, seasonKey) {
        /* Get hymn numbers for this season */
        var seasonNums = (litData.index && litData.index[seasonKey]) || [];
        if (seasonNums.length === 0) {
            return '<div class="season-section"><h2>Hymns</h2>'
                + '<p style="color:#888;font-style:italic;">No hymns catalogued for this season yet.</p></div>';
        }

        /* Build a lookup for quick access */
        var hymnByNum = {};
        for (var i = 0; i < hymns.length; i++) {
            hymnByNum[hymns[i].n] = hymns[i];
        }

        var html = '<div class="season-section">'
            + '<h2>Hymns for ' + esc(litData.seasons[seasonKey] || seasonKey) + '</h2>'
            + '<div style="font-size:0.85em;color:#888;margin-bottom:12px;">'
            + seasonNums.length + ' hymn' + (seasonNums.length !== 1 ? 's' : '')
            + '</div><ul class="season-hymn-list">';

        for (var j = 0; j < seasonNums.length; j++) {
            var h = hymnByNum[seasonNums[j]];
            if (!h) continue;
            html += '<li class="season-hymn-item">'
                + '<span class="season-hymn-num">' + h.n + '</span>'
                + '<a class="season-hymn-title" href="hymn.html?n=' + h.n + '">'
                + esc(h.fl) + '</a>';
            if (h.a) {
                html += '<span class="season-hymn-meta">' + esc(h.a) + '</span>';
            }
            html += '</li>';
        }
        html += '</ul></div>';
        return html;
    }


    function renderLectionary(lectData, seasonKey) {
        if (!lectData || !lectData.occasions) return '';

        /* Filter to occasions for this season */
        var occasions = [];
        for (var i = 0; i < lectData.occasions.length; i++) {
            if (lectData.occasions[i].s === seasonKey) {
                occasions.push(lectData.occasions[i]);
            }
        }
        if (occasions.length === 0) return '';

        var yearLetter = lectData.year || 'A';

        /* Find "this week" — the occasion whose date is closest to today
           (within 3 days before through 6 days after) */
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var todayMs = today.getTime();
        var thisWeekId = null;

        for (var j = 0; j < occasions.length; j++) {
            var dates = occasions[j].d;
            if (!dates) continue;
            for (var yr in dates) {
                var occDate = new Date(dates[yr] + 'T00:00:00');
                var diff = occDate.getTime() - todayMs;
                /* Sunday is "this week" from 3 days before (Thu) to 6 days after (Sat) */
                if (diff >= -3 * 86400000 && diff <= 6 * 86400000) {
                    thisWeekId = occasions[j].id;
                    break;
                }
            }
            if (thisWeekId) break;
        }

        var html = '<div class="season-section">'
            + '<h2>Lectionary Readings (Year ' + yearLetter + ')</h2>';

        var typeLabels = {ot: 'OT', ps: 'Psalm', ep: 'Epistle', go: 'Gospel'};
        var typeOrder = ['ot', 'ps', 'ep', 'go'];

        for (var k = 0; k < occasions.length; k++) {
            var occ = occasions[k];
            var isThisWeek = (occ.id === thisWeekId);
            var cls = 'lect-card' + (isThisWeek ? ' lect-this-week' : '');

            html += '<div class="' + cls + '">';
            html += '<div class="lect-card-header">'
                + '<span class="lect-card-name">' + esc(occ.n) + '</span>';
            if (isThisWeek) {
                html += ' <span class="lect-this-week-badge">This Week</span>';
            }
            /* Show date if available */
            var dateKey = String(today.getFullYear());
            if (occ.d && occ.d[dateKey]) {
                var dd = new Date(occ.d[dateKey] + 'T00:00:00');
                html += '<span class="lect-card-date">' + formatDate(dd) + '</span>';
            }
            html += '</div>';

            html += '<div class="lect-card-readings">';
            for (var ti = 0; ti < typeOrder.length; ti++) {
                var tkey = typeOrder[ti];
                var rd = occ.r[tkey];
                if (!rd) continue;
                var url = lookupPageUrl(rd.ref);
                html += '<div class="lect-reading">'
                    + '<span class="lect-reading-type">' + typeLabels[tkey] + '</span>'
                    + '<a class="lect-reading-ref" href="' + url + '">'
                    + esc(rd.l) + '</a></div>';
            }
            html += '</div></div>';
        }

        html += '</div>';
        return html;
    }


    function renderCalendar(year, activeSeason) {
        var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        var DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

        /* Season → CSS color class */
        var SEASON_COLORS = {
            advent: 'cal-purple', christmas: 'cal-gold', epiphany: 'cal-green',
            lent: 'cal-purple', holy_week: 'cal-red', easter: 'cal-gold',
            ascension: 'cal-gold', pentecost: 'cal-red', ordinary: 'cal-none'
        };

        /* Season display names for the legend */
        var LEGEND = [
            {key: 'advent', label: 'Advent', cls: 'cal-purple', desc: 'Awaiting Christ\u2019s coming'},
            {key: 'christmas', label: 'Christmas', cls: 'cal-gold', desc: 'Celebrating the Incarnation'},
            {key: 'epiphany', label: 'Epiphany', cls: 'cal-green', desc: 'Christ revealed to the world'},
            {key: 'lent', label: 'Lent', cls: 'cal-purple', desc: '40 days of repentance'},
            {key: 'holy_week', label: 'Holy Week', cls: 'cal-red', desc: 'Christ\u2019s passion and death'},
            {key: 'easter', label: 'Easter', cls: 'cal-gold', desc: 'Resurrection and new life'},
            {key: 'pentecost', label: 'Pentecost', cls: 'cal-red', desc: 'The Holy Spirit descends'},
            {key: 'ordinary', label: 'Ordinary Time', cls: 'cal-none', desc: 'Growing in discipleship'}
        ];

        var today = new Date();
        var todayY = today.getFullYear();
        var todayM = today.getMonth(); /* 0-indexed */
        var todayD = today.getDate();

        var html = '<div class="season-section">'
            + '<h2>Liturgical Year ' + year + '</h2>';

        /* Legend */
        html += '<div class="cal-legend">';
        for (var li = 0; li < LEGEND.length; li++) {
            var leg = LEGEND[li];
            var legActive = (leg.key === activeSeason) ? ' cal-legend-active' : '';
            html += '<a class="cal-legend-item' + legActive + '" href="seasonal.html?s='
                + leg.key + '"><span class="cal-legend-swatch ' + leg.cls
                + '"></span><span class="cal-legend-text"><span class="cal-legend-label">'
                + leg.label + '</span><span class="cal-legend-desc">'
                + leg.desc + '</span></span></a>';
        }
        html += '</div>';

        /* Month grid */
        html += '<div class="cal-grid">';
        for (var mi = 0; mi < 12; mi++) {
            html += '<div class="cal-month">';
            html += '<div class="cal-month-name">' + MONTH_NAMES[mi] + '</div>';
            html += '<table class="cal-table"><thead><tr>';
            for (var di = 0; di < 7; di++) {
                html += '<th>' + DAY_HEADERS[di] + '</th>';
            }
            html += '</tr></thead><tbody>';

            /* First day of month: 0=Sun, 1=Mon, etc. */
            var firstDow = new Date(year, mi, 1).getDay();
            var daysInMonth = new Date(year, mi + 1, 0).getDate();

            var dayNum = 1;
            for (var week = 0; week < 6; week++) {
                if (dayNum > daysInMonth) break;
                html += '<tr>';
                for (var dow = 0; dow < 7; dow++) {
                    if ((week === 0 && dow < firstDow) || dayNum > daysInMonth) {
                        html += '<td></td>';
                    } else {
                        var season = getSeasonForDate(year, mi + 1, dayNum);
                        var cls = SEASON_COLORS[season] || 'cal-none';
                        var isToday = (year === todayY && mi === todayM && dayNum === todayD);
                        if (isToday) cls += ' cal-today';
                        html += '<td class="' + cls + '">' + dayNum + '</td>';
                        dayNum++;
                    }
                }
                html += '</tr>';
            }

            html += '</tbody></table></div>';
        }
        html += '</div></div>';

        return html;
    }


    function loadThemes(seasonKey) {
        var container = document.getElementById('season-themes');
        if (!container) return;

        fetchJSON('data/hymn-season-themes.json').then(function(stData) {
            var seasonInfo = stData.season_to_themes && stData.season_to_themes[seasonKey];
            if (!seasonInfo || !seasonInfo.top_themes || seasonInfo.top_themes.length === 0) {
                return;
            }

            /* Load theme titles */
            fetchJSON('data/themes.json').then(function(themeData) {
                var themes = seasonInfo.top_themes;
                var html = '<h2>Related Bible Themes</h2>'
                    + '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
                for (var i = 0; i < themes.length; i++) {
                    var tid = String(themes[i].id);
                    var theme = themeData[tid];
                    if (!theme) continue;
                    html += '<a class="hymn-scripture-tag" '
                        + 'href="theme.html?id=' + tid + '" '
                        + 'style="background:#f0f5e8;color:#3d7317;">'
                        + esc(theme.title)
                        + ' <span style="font-size:0.8em;opacity:0.7;">('
                        + themes[i].count + ')</span></a>';
                }
                html += '</div>';
                container.innerHTML = html;
            });
        }).catch(function() {
            /* Silently ignore — theme data is optional */
        });
    }


    /* ── Date formatting helper ──────────────────────── */

    function formatDateRange(seasonsData, seasonKey) {
        var ranges = seasonsData._dateRanges;
        if (!ranges || !ranges[seasonKey]) return '';

        /* Find the range for the current year (or closest) */
        var now = new Date();
        var year = now.getFullYear();
        var entries = ranges[seasonKey];

        for (var i = 0; i < entries.length; i++) {
            if (entries[i].year === year || entries[i].year === year + 1) {
                var start = new Date(entries[i].start + 'T00:00:00');
                var end = new Date(entries[i].end + 'T00:00:00');
                /* Check if current date falls within or near this range */
                return formatDate(start) + ' \u2013 ' + formatDate(end);
            }
        }

        /* Fallback: use first available range */
        if (entries.length > 0) {
            var s = new Date(entries[0].start + 'T00:00:00');
            var e = new Date(entries[0].end + 'T00:00:00');
            return formatDate(s) + ' \u2013 ' + formatDate(e);
        }

        return '';
    }


    function formatDate(d) {
        var months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

})();
