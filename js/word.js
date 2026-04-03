(function() {
    var strongsNum = getUrlParam('s');
    if (!strongsNum) {
        document.getElementById('content').innerHTML =
            '<p class="error">No Strong\u2019s number specified. '
            + 'Use word.html?s=G2316</p>';
        return;
    }

    var prefix = strongsNum.charAt(0).toUpperCase();
    if (prefix !== 'H' && prefix !== 'G') {
        document.getElementById('content').innerHTML =
            '<p class="error">Invalid Strong\u2019s number. Must start with H or G.</p>';
        return;
    }

    var num = parseInt(strongsNum.substring(1));
    if (isNaN(num)) {
        document.getElementById('content').innerHTML =
            '<p class="error">Invalid Strong\u2019s number format.</p>';
        return;
    }

    var titleEl = document.getElementById('page-title');
    var subtitleEl = document.getElementById('page-subtitle');
    var infoEl = document.getElementById('info-card');
    var contentEl = document.getElementById('content');

    var langName = prefix === 'H' ? 'Hebrew' : 'Greek';
    document.title = strongsNum + ' \u2014 Strong\u2019s ' + langName;
    titleEl.textContent = strongsNum;
    subtitleEl.textContent = 'Strong\u2019s ' + langName + ' Concordance';

    fetchJSON('data/strongs/' + prefix + '-index.json').then(function(index) {
        var entry = index[strongsNum];
        if (!entry) {
            contentEl.innerHTML = '<p class="error">Strong\u2019s number '
                + esc(strongsNum) + ' not found in the ' + langName + ' lexicon.</p>';
            return;
        }

        /* Definition card */
        var cardHtml = '<div class="info-card">';
        if (entry.original) {
            cardHtml += '<div class="word-original">' + esc(entry.original) + '</div>';
        }
        if (entry.translit) {
            cardHtml += '<div class="word-translit">' + esc(entry.translit) + '</div>';
        }
        cardHtml += '<div class="word-definition">' + esc(entry.definition) + '</div>';
        cardHtml += '<div class="word-count">' + entry.count + ' occurrence'
            + (entry.count !== 1 ? 's' : '') + ' in the Bible</div>';
        cardHtml += '</div>';
        infoEl.innerHTML = cardHtml;

        if (entry.count === 0) {
            contentEl.innerHTML = '<p style="color:#888;font-style:italic">'
                + 'No occurrences found in the interlinear data.</p>';
            return;
        }

        /* Determine which chunk file to fetch */
        var chunkStart = Math.floor((num - 1) / 1000) * 1000 + 1;
        var chunkEnd = chunkStart + 999;
        var pad = function(n) { return ('0000' + n).slice(-4); };
        var chunkFile = 'data/strongs/' + prefix + '-verses-'
            + pad(chunkStart) + '-' + pad(chunkEnd) + '.json';

        contentEl.innerHTML = '<p class="loading">Loading occurrences...</p>';

        return fetchJSON(chunkFile).then(function(chunks) {
            var occurrences = chunks[strongsNum] || [];
            if (occurrences.length === 0) {
                contentEl.innerHTML = '<p style="color:#888;font-style:italic">'
                    + 'No occurrence data available.</p>';
                return;
            }

            /* Pagination state */
            var PAGE_SIZE = 100;
            var currentPage = 0;
            var totalPages = Math.ceil(occurrences.length / PAGE_SIZE);

            function renderPage(page) {
                var start = page * PAGE_SIZE;
                var end = Math.min(start + PAGE_SIZE, occurrences.length);
                var html = '<h2>Occurrences (' + occurrences.length + ' total)</h2>';

                /* Group this page's items by book */
                var pageByBook = {};
                var pageBookOrder = [];
                for (var i = start; i < end; i++) {
                    var occ = occurrences[i];
                    var bookAbbr = occ.ref.split('.')[0];
                    if (!pageByBook[bookAbbr]) {
                        pageByBook[bookAbbr] = [];
                        pageBookOrder.push(bookAbbr);
                    }
                    pageByBook[bookAbbr].push(occ);
                }

                for (var b = 0; b < pageBookOrder.length; b++) {
                    var bk = pageBookOrder[b];
                    var items = pageByBook[bk];
                    html += '<h3 style="margin:16px 0 8px;color:#5b7e9e;font-size:1em;">'
                          + esc(bk) + ' (' + items.length + ')</h3>';
                    html += '<ul class="verse-list">';
                    for (var j = 0; j < items.length; j++) {
                        var item = items[j];
                        var readable = osisToReadable(item.ref);
                        html += '<li class="verse-item">'
                              + '<a class="verse-ref" href="' + lookupPageUrl(item.ref) + '">'
                              + esc(readable) + '</a> ';
                        if (item.original) {
                            html += '<span class="occ-original">'
                                  + esc(item.original) + '</span> ';
                        }
                        html += '<span class="occ-text">'
                              + esc(item.text) + '</span></li>';
                    }
                    html += '</ul>';
                }

                /* Pagination controls */
                if (totalPages > 1) {
                    html += '<div class="pagination">';
                    if (page > 0) {
                        html += '<a href="#" class="page-prev">&larr; Previous</a>';
                    }
                    html += '<span>Page ' + (page + 1) + ' of ' + totalPages + '</span>';
                    if (page < totalPages - 1) {
                        html += '<a href="#" class="page-next">Next &rarr;</a>';
                    }
                    html += '</div>';
                }

                contentEl.innerHTML = html;

                /* Bind pagination click handlers */
                var prev = contentEl.querySelector('.page-prev');
                var next = contentEl.querySelector('.page-next');
                if (prev) prev.addEventListener('click', function(e) {
                    e.preventDefault();
                    currentPage--;
                    renderPage(currentPage);
                    window.scrollTo(0, contentEl.offsetTop - 20);
                });
                if (next) next.addEventListener('click', function(e) {
                    e.preventDefault();
                    currentPage++;
                    renderPage(currentPage);
                    window.scrollTo(0, contentEl.offsetTop - 20);
                });
            }

            renderPage(0);
        });

    }).catch(function(err) {
        contentEl.innerHTML = '<p class="error">Error loading data: '
            + esc(String(err)) + '</p>';
    });
})();
