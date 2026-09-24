/* campaign/site/site.js — the campaign's site tabs (M4), loaded at the `site` stage
   (engine/config.js), before engine/site.js first renders. Each tab draws one of
   campaign/docs/<route>/<stem>.html into a `.caul-doc` container — the migrated wiki pages
   (campaign/source/migrate_docs.py), styled by the scoped campaign/site/umbra.css + caul-doc.css.
   Caul's wiki is multi-page: a tab route's first segment picks the page, so #chronicle is the
   section hub (index) and #chronicle/s26-brathis-burns a session; a further segment is an in-page
   anchor. The atlas tab shows the interactive map at #atlas and a place's prose at #atlas/<place>. */
(function () {
  var TITLE = (window.VttConfig || {}).title || 'Caul';
  var cache = {};

  function fetchDoc(url) {
    if (!cache[url]) cache[url] = fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.text();
    });
    return cache[url];
  }

  // draw campaign/docs/<route>/<stem>.html; then run `after` (a page's own behaviour) and scroll
  // to the path's in-page anchor. A tab re-renders without a reload, so `after` must not leave a
  // listener on window/document that outlives its element.
  function docTab(route, after) {
    return function (main, path) {
      path = path || [];
      var stem = path[0] || 'index';
      var url = 'campaign/docs/' + route + '/' + stem + '.html';
      var host = document.createElement('div');
      host.className = 'caul-doc caul-tab';
      host.innerHTML = '<div class="wrap"><p class="muted">Reading…</p></div>';
      main.appendChild(host);
      fetchDoc(url).then(function (htmlText) {
        if (!host.isConnected) return;
        host.innerHTML = htmlText;
        if (after) after(host, path);
        var frag = path[1] && document.getElementById(path[1]);
        if (frag) frag.scrollIntoView();
      }).catch(function (e) {
        host.innerHTML = '';
        var w = document.createElement('div'); w.className = 'wrap';
        w.appendChild(document.createTextNode('Could not read ' + route + '/' + stem + ' (' + e.message + ').'));
        host.appendChild(w);
      });
    };
  }

  // the atlas: the interactive map at #atlas (campaign/site/map.js registers window.CaulMap), a
  // place's prose at #atlas/<place>. Until map.js loads, the section falls back to its prose docs.
  var atlasDoc = docTab('atlas');
  function atlasTab(main, path) {
    path = path || [];
    if (!path.length && window.CaulMap) return window.CaulMap(main, path);
    return atlasDoc(main, path);
  }

  // the Age of Umbra frame is in effect (decision 6): a highlighted section on the home tab points
  // players to it; the frame's full pitch and rules modifications live on the VTT's Frames tab and
  // the GM's Frame pane.
  function umbraCallout(host) {
    if (host.querySelector('.umbra-frame-callout')) return;
    var box = document.createElement('aside');
    box.className = 'umbra-frame-callout';
    box.innerHTML =
      '<div class="uf-tag">Campaign frame in effect</div>' +
      '<h2>The Age of Umbra</h2>' +
      '<p>A dying world drowned in shadow — the great lights have gone out, and only the lesser ' +
      'lights endure. This chronicle runs on Daggerheart’s <strong>Age of Umbra</strong> campaign ' +
      'frame: its principles and rules modifications (the Sacred Pyre that holds back the dark, the ' +
      'corrupting Umbra) are in force.</p>' +
      '<p><a href="#frames">Read the frame at the table →</a></p>';
    var wrap = host.querySelector('.wrap') || host;
    wrap.insertBefore(box, wrap.firstChild);
  }

  var tabs = [
    { id: 'home', label: TITLE, render: docTab('home', umbraCallout) },
    { id: 'chronicle', label: 'Chronicle', render: docTab('chronicle') },
    { id: 'company', label: 'The Company', render: docTab('company') },
    { id: 'personae', label: 'Dramatis Personae', render: docTab('personae') },
    { id: 'factions', label: 'Factions', render: docTab('factions') },
    { id: 'atlas', label: 'Atlas', render: atlasTab },
    { id: 'relics', label: 'Relics', render: docTab('relics') },
    { id: 'lore', label: 'Lore', render: docTab('lore') },
  ];
  // the campaign's tabs first — the site opens on the campaign
  tabs.forEach(function (t) { t.group = 'campaign'; });
  window.VttSiteTabs = tabs.concat(window.VttSiteTabs || []);
})();
