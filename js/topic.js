(function() {
    var topicName = getUrlParam('t');
    if (!topicName) {
        document.getElementById('content').innerHTML =
            '<p class="error">No topic specified. Use topic.html?t=salvation</p>';
        return;
    }

    var titleEl = document.getElementById('page-title');
    var subtitleEl = document.getElementById('page-subtitle');
    var infoEl = document.getElementById('info-card');
    var contentEl = document.getElementById('content');

    document.title = topicName + ' — Bible Topic';
    titleEl.textContent = topicName;
    subtitleEl.textContent = 'Community-sourced topic from openbible.info';

    fetchJSON('data/topics.json').then(function(topics) {
        var entries = topics[topicName];
        if (!entries || entries.length === 0) {
            contentEl.innerHTML = '<p class="error">Topic "'
                + esc(topicName) + '" not found.</p>';
            return;
        }

        var infoHtml = '<div class="info-card">'
            + '<span class="label">Verses</span>'
            + '<div class="value">' + entries.length + ' passage'
            + (entries.length !== 1 ? 's' : '')
            + ' (sorted by relevance)</div></div>';
        infoEl.innerHTML = infoHtml;

        /* Extract refs and scores */
        var refs = [];
        var scores = [];
        for (var i = 0; i < entries.length; i++) {
            refs.push(entries[i].ref);
            scores.push(entries[i].score);
        }

        renderVerseList(contentEl, refs, scores);

    }).catch(function(err) {
        contentEl.innerHTML = '<p class="error">Error loading topic data: '
            + esc(String(err)) + '</p>';
    });
})();
