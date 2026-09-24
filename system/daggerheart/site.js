// system/daggerheart/site.js — what Daggerheart puts on the site: the books, and the game's own
// lists across them — classes with their subclasses, domains and their cards, ancestries and
// communities, adversaries, environments, equipment and loot, the campaign frames — the dice,
// and search. Every word shown comes from titterpig-dsl-daggerheart/0.5 through data/; this file
// decides only what is listed where. A list reads data/records.js; opening anything loads its
// book on demand.
window.VttSiteTabs = (function () {
  const { el, debounce } = window.VttRender;
  const D = window.DHData;
  const E = window.DHEntity;
  const Dice = window.DHDice;
  const Site = () => window.VttSite;

  // a link inside any rendered entity opens it in the reader, loading its book first
  window.DHOpenEntity = (id) => {
    const r = D.entity(id) || D.record(id);
    if (r) Site().go('book', [r.book, id]);
  };

  const page = (container) => container.appendChild(el('div', { class: 'page' }));
  function after(p, ids, fn) {
    const note = p.appendChild(el('div', { class: 'muted loading' }, ['Opening ' + [].concat(ids).map(D.label).join(', ') + '…']));
    D.ensure(ids).then(() => { note.remove(); fn(); }).catch((e) => {
      console.error(e);
      p.appendChild(el('div', { class: 'empty' }, ['Could not show this: ' + e.message]));
    });
  }
  // `campaign` is an instance's own layer (build/build_layer.py) — its homebrew, shelved first.
  const KIND_ORDER = { campaign: -1, book: 0 };
  const KIND_LABEL = { campaign: 'This campaign', book: 'The rulebooks' };
  const uniq = (xs) => Array.from(new Set(xs.filter((x) => x != null && x !== ''))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const openRow = (r) => el('a', { class: 'ref', href: '#book/' + encodeURIComponent(r.book) + '/' + encodeURIComponent(r.id) }, [r.name]);
  const F = D.f;

  // ── the books ──────────────────────────────────────────────────────
  function renderShelf(container, ctx) {
    const p = page(container);
    const idx = D.index();
    p.appendChild(el('div', { class: 'masthead' }, [
      el('h1', {}, ['The books']),
      el('p', { class: 'muted' }, [String(idx.counts.books) + ' books, generated from their corpus: ' + idx.counts.entities.toLocaleString() + ' entries out of ' + idx.counts.files + ' files. Open one.']),
    ]));
    const groups = {};
    D.books().forEach((b) => (groups[b.kind] = groups[b.kind] || []).push(b));
    Object.keys(groups).sort((a, b) => (KIND_ORDER[a] || 0) - (KIND_ORDER[b] || 0)).forEach((k) => {
      p.appendChild(el('h2', { class: 'shelf-h' }, [KIND_LABEL[k] || k]));
      p.appendChild(el('div', { class: 'shelf' }, groups[k].map((b) => el('a', { class: 'shelf-book', href: ctx.href('book', [b.id]) }, [
        el('div', { class: 'shelf-title' }, [b.label]),
        el('div', { class: 'muted small' }, [b.counts.chapters + ' chapters · ' + b.counts.entities.toLocaleString() + ' entries · ' + Math.round(b.bytes / 1024) + ' KB']),
      ]))));
    });
  }

  function chapterLink(bid, c, ctx, active) {
    return el('a', { class: 'ref' + (active ? ' active' : ''), href: ctx.href('book', [bid, 'ch:' + c.file]) }, [D.shortTitle(c), el('span', { class: 'kindtag' }, [c.kind])]);
  }
  function tree(bid, list, ctx, openId) {
    return el('ul', { class: 'toc' }, list.map((e) => {
      const kids = D.children(e.id);
      const a = el('a', { class: 'ref' + (e.id === openId ? ' active' : ''), href: ctx.href('book', [bid, e.id]) }, [e.name]);
      if (!kids.length) return el('li', {}, [a]);
      const open = openId && (e.id === openId || D.ancestors(openId).some((x) => x.id === e.id));
      return el('li', {}, [el('details', { open: open || null }, [el('summary', {}, [a]), tree(bid, kids, ctx, openId)])]);
    }));
  }

  function renderBook(container, path, ctx) {
    const bid = path[0] && D.indexBook(path[0]) ? path[0] : null;
    if (!bid) return renderShelf(container, ctx);
    const p = page(container);
    const meta = D.indexBook(bid);
    after(p, bid, () => {
      const target = path[1] || null;
      const chFile = target && target.indexOf('ch:') === 0 ? target.slice(3) : null;
      const e = target && !chFile ? D.entity(target) : null;
      const openCh = chFile || (e ? e.file : null);
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('book', []) }, ['The books']), ' › ', el('a', { href: ctx.href('book', [bid]) }, [meta.label]),
        e ? D.ancestors(e.id).map((a) => [' › ', el('a', { href: ctx.href('book', [bid, a.id]) }, [a.name])]) : null]));
      const q = el('input', { type: 'search', class: 'search', placeholder: 'Search ' + meta.label + '…' });
      const results = el('div', { class: 'results' });
      q.addEventListener('input', debounce(() => showHits(results, q.value.trim(), [bid], ctx), 250));
      const toc = el('div', { class: 'site-toc' }, [q, results, el('ul', { class: 'toc chapters' }, D.chapters(bid).map((c) => {
        const roots = (c.roots || []).map(D.entity).filter(Boolean);
        const here = c.file === openCh;
        return el('li', {}, [roots.length
          ? el('details', { open: here || null }, [el('summary', {}, [chapterLink(bid, c, ctx, chFile === c.file)]), tree(bid, roots, ctx, e ? e.id : null)])
          : chapterLink(bid, c, ctx, chFile === c.file)]);
      }))]);
      let body;
      if (e) body = E.render(e);
      else if (chFile) body = chapterPage(bid, D.chapter(bid, chFile), ctx);
      else body = el('div', {}, [el('h2', {}, [meta.label]), el('h4', {}, ['Chapters']),
        el('ul', { class: 'items' }, D.chapters(bid).map((c) => el('li', {}, [chapterLink(bid, c, ctx), c.page ? el('span', { class: 'muted small' }, [' · from page ' + c.page]) : null])))]);
      p.appendChild(el('div', { class: 'reader' }, [toc, el('div', { class: 'site-reader' }, [body])]));
    });
  }

  // A chapter: a lore file as its Markdown; a DSL file as its own top-level blocks and its
  // entities in order.
  function chapterPage(bid, c, ctx) {
    if (!c) return el('div', { class: 'empty' }, ['No such chapter.']);
    if (c.kind === 'lore') return el('div', {}, [E.markdown(c.text, bid)]);
    const top = (c.blocks || []).filter((b) => !('ent' in b));
    const roots = (c.roots || []).map(D.entity).filter(Boolean);
    return el('div', {}, [
      el('h2', {}, [D.chapterTitle(c)]),
      el('div', { class: 'muted small' }, [c.file + (c.page ? ' · from page ' + c.page : '')]),
      top.length ? E.nodes(top, bid) : null,
      E.guidance(D.guidanceLoose(c.file), bid),
      roots.length ? el('div', { class: 'contents' }, [
        el('h4', {}, ['In this chapter']),
        el('ul', { class: 'items columns' }, roots.map((x) => el('li', {}, [el('a', { class: 'ref', href: ctx.href('book', [bid, x.id]) }, [x.name]), x.type ? el('span', { class: 'etype' }, [x.type]) : null]))),
      ]) : null,
    ]);
  }

  function showHits(results, term, bookIds, ctx) {
    results.innerHTML = '';
    if (term.length < 2) return;
    const hits = D.search(term, bookIds, 2000);
    const lore = D.searchLore(term, bookIds);
    const shown = hits.slice(0, 80);
    results.appendChild(el('div', { class: 'muted small' }, [hits.length + ' entries' + (hits.length > shown.length ? ' — the first ' + shown.length : '') + ' · ' + lore.length + ' lines of the books’ prose']));
    shown.forEach((h) => {
      const ex = D.excerpt(h, term, 60);
      results.appendChild(el('div', { class: 'hit' }, [
        el('a', { class: 'ref', href: ctx.href('book', [h.book, h.id]) }, [h.name]),
        h.type ? el('span', { class: 'etype' }, [h.type]) : null,
        el('span', { class: 'muted small' }, [' · ' + D.label(h.book)]),
        ex ? el('div', { class: 'muted small' }, [ex]) : null,
      ]));
    });
    lore.slice(0, 40).forEach((h) => {
      const i = h.line.toLowerCase().indexOf(term.toLowerCase());
      const ex = (i > 70 ? '…' : '') + h.line.slice(Math.max(0, i - 70), i + term.length + 90) + (i + term.length + 90 < h.line.length ? '…' : '');
      results.appendChild(el('div', { class: 'hit' }, [
        el('a', { class: 'ref', href: ctx.href('book', [h.book, 'ch:' + h.chapter.file]) }, [D.shortTitle(h.chapter) + (h.heading ? ' › ' + h.heading : '')]),
        el('span', { class: 'etype' }, ['prose']),
        el('div', { class: 'muted small' }, [ex]),
      ]));
    });
  }

  // ── a filterable list over records ─────────────────────────────────
  function recordList(p, rows, opts) {
    const state = opts.state;
    const q = el('input', { type: 'search', class: 'search', placeholder: opts.placeholder, value: state.q || '' });
    const filters = (opts.filters || []).map((f) => {
      const sel = el('select', { class: 'scope', 'aria-label': f.all });
      sel.appendChild(el('option', { value: '' }, [f.all]));
      f.values(rows).forEach((v) => sel.appendChild(el('option', { value: v, selected: state[f.key] === String(v) || null }, [f.label ? f.label(v) : String(v)])));
      sel.addEventListener('change', () => { state[f.key] = sel.value; draw(); });
      return sel;
    });
    const count = el('span', { class: 'muted small' });
    const out = el('div', {});
    function draw() {
      const t = (state.q || '').toLowerCase();
      const hit = rows.filter((r) => (!t || opts.text(r).toLowerCase().indexOf(t) !== -1) && (opts.filters || []).every((f) => !state[f.key] || String(f.get(r)) === state[f.key]));
      count.textContent = hit.length + ' of ' + rows.length;
      out.innerHTML = '';
      out.appendChild(opts.draw(hit));
    }
    q.addEventListener('input', debounce(() => { state.q = q.value.trim(); draw(); }, 150));
    p.appendChild(el('div', { class: 'chiprow filters' }, [q].concat(filters, [count])));
    p.appendChild(out);
    draw();
  }
  const bookFilter = { key: 'book', all: 'Both books', values: (rs) => uniq(rs.map((r) => r.book)), label: D.label, get: (r) => r.book };
  const tierFilter = { key: 'tier', all: 'Every tier', values: (rs) => uniq(rs.map((r) => F(r, 'Tier'))), label: (v) => 'Tier ' + v, get: (r) => F(r, 'Tier') };
  function listTable(cols, rows) {
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed list' }, [
      el('thead', {}, [el('tr', {}, cols.map((c) => el('th', {}, [c[0]])))]),
      el('tbody', {}, rows.map((r) => el('tr', {}, cols.map((c) => el('td', { class: c[2] || null }, [c[1](r)]))))),
    ])]);
  }
  const fv = (k) => (r) => (F(r, k) == null ? '' : String(F(r, k)));
  const byTierName = (a, b) => (F(a, 'Tier') || 0) - (F(b, 'Tier') || 0) || a.name.localeCompare(b.name);

  // ── classes ────────────────────────────────────────────────────────
  // A class's page: the class as printed, then its subclasses (each `^"Class"` names it), its
  // domains, and the Character Guide the appendix prints for it.
  function renderClasses(container, path, ctx) {
    const p = page(container);
    const classes = D.recordsOf('Class');
    const id = path[0] && classes.find((r) => r.id === path[0]) ? path[0] : null;
    if (!id) {
      p.appendChild(el('h1', {}, ['Classes']));
      const subs = D.recordsOf('Subclass');
      ['core', 'hope-and-fear'].forEach((bid) => {
        const here = classes.filter((r) => r.book === bid);
        if (!here.length) return;
        p.appendChild(el('h2', { class: 'shelf-h' }, [D.label(bid)]));
        p.appendChild(el('div', { class: 'shelf' }, here.map((r) => el('a', { class: 'shelf-book', href: ctx.href('classes', [r.id]) }, [
          el('div', { class: 'shelf-title' }, [r.name]),
          el('div', { class: 'muted small' }, [subs.filter((s) => F(s, 'Class') === r.name).map((s) => s.name).join(' · ')]),
        ]))));
      });
      return;
    }
    const r = classes.find((x) => x.id === id);
    after(p, D.books().map((b) => b.id), () => {
      const c = D.entity(id);
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('classes', []) }, ['Classes']), ' › ', r.name]));
      p.appendChild(E.render(c));
      D.byType('Subclass').filter((s) => (D.val(s, 'Class') || {}).name === c.name).forEach((s) => p.appendChild(el('div', { class: 'subclass' }, [E.render(s)])));
      D.byType('Character Guide').filter((g) => (D.val(g, 'Class') || {}).name === c.name).forEach((g) => p.appendChild(E.render(g)));
    });
  }

  // ── domains and their cards ────────────────────────────────────────
  const cardState = { q: '' };
  function renderDomains(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Domains and domain cards']));
    const domains = D.recordsOf('Domain');
    p.appendChild(el('div', { class: 'chiprow' }, domains.map((r) => el('a', { class: 'chip-link', href: '#book/' + r.book + '/' + encodeURIComponent(r.id) }, [r.name]))));
    recordList(p, D.recordsOf('Domain Card'), {
      state: cardState, placeholder: 'Find a card…',
      text: (r) => r.name + ' ' + (F(r, 'Domain') || '') + ' ' + (F(r, 'Type') || ''),
      filters: [
        { key: 'domain', all: 'Every domain', values: (rs) => uniq(rs.map((r) => F(r, 'Domain'))), get: (r) => F(r, 'Domain') },
        { key: 'level', all: 'Every level', values: (rs) => uniq(rs.map((r) => F(r, 'Domain Level'))), label: (v) => 'Level ' + v, get: (r) => F(r, 'Domain Level') },
        { key: 'type', all: 'Every type', values: (rs) => uniq(rs.map((r) => F(r, 'Type'))), get: (r) => F(r, 'Type') },
        bookFilter,
      ],
      draw: (hit) => listTable([['Card', openRow], ['Domain', fv('Domain')], ['Level', fv('Domain Level'), 'num'], ['Type', fv('Type')], ['Recall', fv('Recall Cost'), 'num'], ['Book', (r) => D.label(r.book), 'muted small']],
        hit.slice().sort((a, b) => (F(a, 'Domain Level') || 0) - (F(b, 'Domain Level') || 0) || String(F(a, 'Domain')).localeCompare(String(F(b, 'Domain'))) || a.name.localeCompare(b.name))),
    });
  }

  // ── ancestries and communities ─────────────────────────────────────
  function renderHeritage(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Heritage']));
    p.appendChild(el('p', { class: 'muted' }, ['A character’s heritage is an ancestry and a community.']));
    [['Ancestries', 'Ancestry'], ['Communities', 'Community'], ['Transformations', 'Transformation']].forEach(([h, t]) => {
      const rows = D.recordsOf(t);
      if (!rows.length) return;
      p.appendChild(el('h2', { class: 'shelf-h' }, [h]));
      p.appendChild(el('div', { class: 'shelf' }, rows.map((r) => el('a', { class: 'shelf-book', href: '#book/' + r.book + '/' + encodeURIComponent(r.id) }, [el('div', { class: 'shelf-title' }, [r.name]), el('div', { class: 'muted small' }, [D.label(r.book)])]))));
    });
  }

  // ── adversaries ────────────────────────────────────────────────────
  const advState = { q: '' };
  function renderAdversaries(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Adversaries']));
    recordList(p, D.recordsOf('Adversary'), {
      state: advState, placeholder: 'Find an adversary…',
      text: (r) => r.name + ' ' + (F(r, 'Role') || ''),
      filters: [tierFilter, { key: 'role', all: 'Every role', values: (rs) => uniq(rs.map((r) => String(F(r, 'Role') || '').replace(/ \(.*$/, ''))), get: (r) => String(F(r, 'Role') || '').replace(/ \(.*$/, '') }, bookFilter],
      draw: (hit) => listTable([['Adversary', openRow], ['Tier', fv('Tier'), 'num'], ['Role', fv('Role')], ['Difficulty', fv('Difficulty'), 'num'], ['Book', (r) => D.label(r.book), 'muted small']], hit.slice().sort(byTierName)),
    });
  }

  // ── environments ───────────────────────────────────────────────────
  const envState = { q: '' };
  function renderEnvironments(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Environments']));
    recordList(p, D.recordsOf('Environment'), {
      state: envState, placeholder: 'Find an environment…',
      text: (r) => r.name + ' ' + (F(r, 'Category') || ''),
      filters: [tierFilter, { key: 'cat', all: 'Every type', values: (rs) => uniq(rs.map((r) => F(r, 'Category'))), get: (r) => F(r, 'Category') }, bookFilter],
      draw: (hit) => listTable([['Environment', openRow], ['Tier', fv('Tier'), 'num'], ['Type', fv('Category')], ['Difficulty', fv('Difficulty'), 'num'], ['Book', (r) => D.label(r.book), 'muted small']], hit.slice().sort(byTierName)),
    });
  }

  // ── equipment and loot ─────────────────────────────────────────────
  const eqState = { q: '', kind: 'Weapon' };
  function renderEquipment(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Equipment and loot']));
    const kinds = [['Weapon', 'Weapons'], ['Armor', 'Armor'], ['Loot', 'Loot']];
    const out = el('div', {});
    const bar = el('div', { class: 'seg' }, kinds.map(([t, l]) => el('button', { type: 'button', class: 'btn' + (eqState.kind === t ? ' on' : ''), onclick: () => { eqState.kind = t; out.innerHTML = ''; draw(); bar.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', kinds[i][0] === t)); } }, [l])));
    p.appendChild(bar);
    p.appendChild(out);
    function draw() {
      const t = eqState.kind;
      const rows = D.recordsOf(t);
      if (t === 'Weapon') recordList(out, rows, {
        state: eqState, placeholder: 'Find a weapon…', text: (r) => r.name + ' ' + (F(r, 'Trait') || '') + ' ' + (F(r, 'Range') || ''),
        filters: [{ key: 'cat', all: 'Primary and secondary', values: (rs) => uniq(rs.map((r) => F(r, 'Category'))), get: (r) => F(r, 'Category') }, tierFilter, { key: 'dtype', all: 'Physical and magic', values: (rs) => uniq(rs.map((r) => F(r, 'Damage Type'))), get: (r) => F(r, 'Damage Type') }, bookFilter],
        draw: (hit) => listTable([['Weapon', openRow], ['Tier', fv('Tier'), 'num'], ['Trait', fv('Trait')], ['Range', fv('Range')], ['Damage', fv('Damage')], ['Burden', fv('Burden')], ['', fv('Category'), 'muted small']], hit.slice().sort(byTierName)),
      });
      else if (t === 'Armor') recordList(out, rows, {
        state: eqState, placeholder: 'Find armor…', text: (r) => r.name, filters: [tierFilter, bookFilter],
        draw: (hit) => listTable([['Armor', openRow], ['Tier', fv('Tier'), 'num'], ['Book', (r) => D.label(r.book), 'muted small']], hit.slice().sort(byTierName)),
      });
      else recordList(out, rows, {
        state: eqState, placeholder: 'Find loot…', text: (r) => r.name + ' ' + (F(r, 'Kind') || ''),
        filters: [{ key: 'lkind', all: 'Items and consumables', values: (rs) => uniq(rs.map((r) => F(r, 'Kind'))), get: (r) => F(r, 'Kind') }, bookFilter],
        draw: (hit) => listTable([['Loot', openRow], ['Roll', fv('Roll'), 'num'], ['Kind', fv('Kind')], ['Book', (r) => D.label(r.book), 'muted small']], hit.slice().sort((a, b) => String(F(a, 'Kind')).localeCompare(String(F(b, 'Kind'))) || (Number(F(a, 'Roll')) || 0) - (Number(F(b, 'Roll')) || 0))),
      });
    }
    draw();
  }

  // ── the campaign frames ────────────────────────────────────────────
  function renderFrames(container, path, ctx) {
    const p = page(container);
    const frames = D.frames();
    const id = path[0] && frames.find((r) => r.id === path[0]) ? path[0] : null;
    if (!id) {
      p.appendChild(el('h1', {}, ['Campaign frames']));
      p.appendChild(el('p', { class: 'muted' }, [frames.length + ' frames. The GM’s table runs a frame as its campaign.']));
      p.appendChild(el('div', { class: 'shelf' }, frames.map((r) => el('a', { class: 'shelf-book', href: ctx.href('frames', [r.id]) }, [
        el('div', { class: 'shelf-title' }, [r.name]),
        el('div', { class: 'muted small' }, ['Complexity ' + (F(r, 'Complexity Rating') || '—') + ' · ' + D.label(r.book)]),
      ]))));
      return;
    }
    const r = frames.find((x) => x.id === id);
    after(p, r.book, () => {
      const e = D.entity(id);
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('frames', []) }, ['Campaign frames']), ' › ', e.name]));
      p.appendChild(E.render(e));
      const lore = D.frameLore(e);
      if (lore) p.appendChild(el('details', { class: 'lore-full', open: true }, [el('summary', {}, ['The frame, as the book prints it']), E.markdown(lore.text, e.book)]));
    });
  }

  // ── the dice ───────────────────────────────────────────────────────
  function renderDice(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['The Duality Dice']));
    after(p, 'core', () => {
      const log = el('div', { class: 'roll-log' });
      p.appendChild(Dice.roller({ onResolve: (r) => log.prepend(Dice.logLine(Dice.logEntry(r, 'You'))) }));
      p.appendChild(log);
      const ar = D.entity('#daggerheartActionRoll000000001');
      if (ar) p.appendChild(E.render(ar));
    });
  }

  // ── search everywhere ──────────────────────────────────────────────
  const searchState = { q: '' };
  function renderSearch(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Search the books']));
    const results = el('div', { class: 'results' });
    const q = el('input', { type: 'search', class: 'search wide', placeholder: 'A rule, a card, a name…', value: searchState.q });
    const scope = el('select', { class: 'scope', 'aria-label': 'Which book' }, [el('option', { value: '' }, ['Both books'])].concat(D.books().map((b) => el('option', { value: b.id }, [b.label]))));
    const run = () => {
      const ids = scope.value ? [scope.value] : D.books().map((b) => b.id);
      results.innerHTML = '';
      if (searchState.q.length < 2) return;
      D.ensure(ids).then(() => showHits(results, searchState.q, ids, ctx));
    };
    q.addEventListener('input', debounce(() => { searchState.q = q.value.trim(); run(); }, 300));
    scope.addEventListener('change', run);
    p.appendChild(el('div', { class: 'chiprow' }, [q, scope]));
    p.appendChild(results);
    if (searchState.q) run();
    setTimeout(() => q.focus(), 0);
  }

  const tabs = [
    { id: 'book', label: 'The books', render: renderBook, books: true },
    { id: 'classes', label: 'Classes', render: renderClasses, books: true },
    { id: 'domains', label: 'Domains', render: renderDomains, books: true },
    { id: 'heritage', label: 'Heritage', render: renderHeritage, books: true },
    { id: 'adversaries', label: 'Adversaries', render: renderAdversaries, books: true },
    { id: 'environments', label: 'Environments', render: renderEnvironments, books: true },
    { id: 'equipment', label: 'Equipment', render: renderEquipment, books: true },
    { id: 'frames', label: 'Frames', render: renderFrames, books: true },
    { id: 'dice', label: 'Dice', render: renderDice },
    { id: 'search', label: 'Search', render: renderSearch, books: true },
  ];
  // the creator adds its tab when it is loaded (system/daggerheart/creator.js, M4)
  if (window.DHCreator) tabs.splice(4, 0, { id: 'create', label: 'Make a character', render: window.DHCreator.render, books: true });
  return tabs;
})();
