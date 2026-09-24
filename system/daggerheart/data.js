// system/daggerheart/data.js — accessors over the generated corpus (window.DAGGERHEART from
// data/*.js). This is the only file that knows the data's shape; the reader, the panels, the
// dice, the sheet and the creator ask here.
//
//   * The data is a lossless dump (build_data.py): an entity's named fields (desc, props,
//     rules, table…) plus `blocks`, every other node in corpus order — a keyword as
//     {kw, args, body}, a numbered row as {num, args, body}, a string as {s, args}, a nested
//     entity as {ent}. An argument is {s} string, {c} caret name, {h} hash, {i} integer,
//     {b} bool, {w} bare word, {l} list. `arg()` reads one as a plain value.
//   * Books load on demand (engine/data.js). `records` (data/records.js) lists every typed
//     entity with its book and the few fields a list shows, so a list never loads a book; a
//     detail view calls `ensure(book)` first.
//   * GUIDANCE sidebars and MODIFYs (an instance's house rules) are printed apart from what
//     they concern, and are joined here at load.
window.DHData = (function () {
  const EMPTY = { books: {}, entities: {}, loaded: {}, index: { books: [], counts: {} }, records: [] };
  const T = () => window.DAGGERHEART || EMPTY;
  const Data = () => window.VttData;

  const index = () => T().index || { books: [], counts: {} };
  const books = () => (index().books || []).slice();
  const indexBook = (id) => (index().books || []).find((b) => b.id === id) || null;
  const book = (id) => T().books[id] || null;
  const entity = (id) => T().entities[id] || null;
  const records = () => T().records || [];
  const record = (id) => records().find((r) => r.id === id) || null;
  const loaded = (id) => !!book(id);

  // ── loading ────────────────────────────────────────────────────────
  // Every loaded book re-indexes what joins across books (sidebars, corrections, names). An
  // instance's campaign layer (build/build_layer.py) comes with every book, so its house rules
  // always show beside the rule they change (L5R5e decision I-9).
  let indexedFor = '';
  const ALWAYS = books().filter((b) => b.kind === 'campaign').map((b) => b.id);
  function ensure(ids) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter((x) => x && indexBook(x));
    if (list.length) ALWAYS.forEach((x) => list.indexOf(x) === -1 && list.push(x));
    return Data().ready(list).then(() => reindex());
  }
  const ensureAll = () => ensure(books().map((b) => b.id));
  const coreFirst = (ids) => ensure(['core'].concat(ids || []));

  // ── arguments and values ───────────────────────────────────────────
  function arg(a) {
    if (a == null) return null;
    if ('s' in a) return a.s;
    if ('c' in a) return a.c;
    if ('i' in a) return a.i;
    if ('b' in a) return a.b;
    if ('w' in a) return a.w;
    if ('l' in a) return a.l.map(arg);
    if ('h' in a) return a.h;
    return null;
  }
  function prop(e, name) {
    return (e && (e.props || []).find((p) => p.name === name)) || null;
  }
  // A property's value: the value it is given, else its declared DEFAULT; a list as plain
  // values; a DEF as its property list; a reference as {hash, name}.
  function pval(p) {
    if (!p) return undefined;
    if (p.vk === 'scalar' || p.vk === 'enum') return p.value !== undefined ? p.value : p.default;
    if (p.vk === 'list') return (p.items || []).map(arg);
    if (p.vk === 'ref') return p.ref;
    return p;
  }
  const val = (e, name) => pval(prop(e, name));
  const text = (e, name) => {
    const v = val(e, name);
    return typeof v === 'string' ? v : null;
  };
  const num = (e, name) => {
    const v = val(e, name);
    return typeof v === 'number' ? v : null;
  };
  // an ENUM property printed as a value (`^"Category" ENUM "Primary"`) reads as its value; one
  // that only declares its options reads as nothing
  const enumText = (e, name) => {
    const p = prop(e, name);
    return p && (p.vk === 'enum' || p.vk === 'scalar') && typeof p.value === 'string' ? p.value : null;
  };
  const blocks = (e, kw) => ((e && e.blocks) || []).filter((b) => b && b.kw === kw);
  const block = (e, kw) => blocks(e, kw)[0] || null;
  // A DEF-valued property's fields as {name: value}: an adversary's Damage Thresholds
  function defFields(p) {
    const out = {};
    if (!p || p.vk !== 'def') return out;
    (p.fields || []).forEach((f) => (out[f.name] = pval(f)));
    return out;
  }
  // the entities a keyword block holds, in order (a FEATURES block, a subclass's FOUNDATION)
  const blockEntities = (e, kw) => blocks(e, kw).reduce((acc, b) => acc.concat((b.body || []).filter((x) => 'ent' in x).map((x) => entity(x.ent)).filter(Boolean)), []);

  // ── the tree ───────────────────────────────────────────────────────
  function children(id) {
    const e = entity(id);
    return e ? (e.children || []).map(entity).filter(Boolean) : [];
  }
  function ancestors(id) {
    const out = [];
    let e = entity(id);
    while (e && e.parent) {
      e = entity(e.parent);
      if (e) out.unshift(e);
    }
    return out;
  }
  function all(bookIds) {
    const ids = bookIds && bookIds.length ? bookIds : books().map((b) => b.id);
    const out = [];
    ids.forEach((bid) => {
      const stack = ((book(bid) || {}).entities || []).slice();
      while (stack.length) {
        const e = entity(stack.shift());
        if (!e) continue;
        out.push(e);
        stack.unshift.apply(stack, e.children || []);
      }
    });
    return out;
  }
  const byType = (type, bookIds) => all(bookIds).filter((e) => e.type === type);

  // A type's declaration: the ACTOR (or DEF) of that name. `declared(type)` walks its EXTENDS
  // chain, root first, so ACTOR "Character" reads Entity's Name, then its own fields.
  function declaration(typeName) {
    const hit = all(['core']).find((e) => e.name === typeName && (e.form === 'ACTOR' || !e.type) && (e.props || []).length);
    return hit || all().find((e) => e.name === typeName && e.form === 'ACTOR') || null;
  }
  function declared(typeName) {
    const chain = [];
    let d = declaration(typeName);
    while (d) {
      chain.unshift(d);
      d = d.type ? declaration(d.type) : null;
      if (d && chain.indexOf(d) !== -1) break;
    }
    const seen = {};
    const props = [];
    chain.forEach((c) => (c.props || []).forEach((p) => {
      if (seen[p.name] != null) props[seen[p.name]] = p;
      else {
        seen[p.name] = props.length;
        props.push(p);
      }
    }));
    return { chain, props };
  }

  // ── names → entities ───────────────────────────────────────────────
  // A reference by name, preferring the book the reader is in, then the core, then any loaded
  // book. Two books print some names twice (*Hold The Line*, *Vampire*): a hash always wins.
  let byName = {};
  function reindexNames() {
    byName = {};
    Object.keys(T().entities).forEach((h) => {
      const e = T().entities[h];
      (byName[e.name] = byName[e.name] || []).push(e);
    });
  }
  function named(name, preferBook) {
    const hits = byName[name] || [];
    if (!hits.length) return null;
    return hits.find((e) => e.book === preferBook) || hits.find((e) => e.book === 'core') || hits[0];
  }
  const recordNamed = (name) => records().filter((r) => r.name === name);

  // ── joined across books: sidebars, corrections ─────────────────────
  let guidance = {};      // concerned hash → [ {name, id, topics, text, book, file} ]
  let looseGuidance = {}; // file → [ entries that concern nothing ]
  let corrections = {};   // target hash (or ?name) → [ {op, book, file, name, body} ]
  function walkBlocks(list, fn) {
    (list || []).forEach((b) => {
      if (!b || typeof b !== 'object') return;
      fn(b);
      if (b.body) walkBlocks(b.body, fn);
    });
  }
  function guidanceEntry(e, book, file) {
    const g = { name: null, id: null, topics: [], text: null, concerns: [], book, file };
    (e.args || []).forEach((a) => {
      if ('c' in a) g.name = a.c;
      if ('h' in a) g.id = a.h;
    });
    (e.body || []).forEach((y) => {
      if (y.kw === 'CONCERNS') g.concerns = (y.args[0] ? y.args[0].l || [] : []).map((a) => ({ hash: a.h || null, name: a.c || null }));
      else if (y.kw === 'TOPICS') g.topics = (y.args[0] ? y.args[0].l || [] : []).map(arg);
      else if (y.kw === 'TEXT') g.text = y.args[0] ? y.args[0].s : null;
    });
    return g;
  }
  function reindex() {
    const key = Object.keys(T().loaded || {}).sort().join('|');
    if (key === indexedFor) return;
    indexedFor = key;
    reindexNames();
    guidance = {};
    looseGuidance = {};
    corrections = {};
    Object.keys(T().books).forEach((bid) => {
      (T().books[bid].chapters || []).forEach((c) => {
        walkBlocks(c.blocks, (x) => {
          if (x.kw === 'GUIDANCE') (x.body || []).forEach((en) => {
            if (en.kw !== 'ENTRY') return;
            const g = guidanceEntry(en, bid, c.file);
            if (g.concerns.length) g.concerns.forEach((r) => {
              const target = (r.hash && entity(r.hash)) || named(r.name, bid);
              const k = target ? target.id : '?' + r.name;
              (guidance[k] = guidance[k] || []).push(g);
            });
            else (looseGuidance[c.file] = looseGuidance[c.file] || []).push(g);
          });
        });
        (c.blocks || []).forEach((x) => {
          if (x.kw !== 'MODIFY' && x.kw !== 'OVERRIDE') return;
          const h = (x.args.find((a) => 'h' in a) || {}).h;
          const nm = (x.args.find((a) => 'c' in a) || {}).c;
          (corrections[h || '?' + nm] = corrections[h || '?' + nm] || []).push({ op: x.kw, book: bid, file: c.file, name: nm, target: h, body: x.body || [] });
        });
      });
    });
    Object.keys(T().entities).forEach((h) => {
      const e = T().entities[h];
      (e.guidance || []).forEach((g) => (guidance[h] = guidance[h] || []).push(Object.assign({ book: e.book, file: e.file }, g)));
    });
  }
  const guidanceFor = (id) => guidance[id] || [];
  const guidanceLoose = (file) => looseGuidance[file] || [];
  // corrections of an entity, by its hash or (for a MODIFY that names it) by its name
  const correctionsFor = (e) => (corrections[e.id] || []).concat(named(e.name, e.book) === e ? corrections['?' + e.name] || [] : []);
  // A property a MODIFY sets or introduces — an instance's house rule, which the sheet honours
  // (L5R5e decision I-14). The last loaded wins.
  function modified(e, name) {
    if (!e) return undefined;
    let out;
    correctionsFor(e).forEach((c) => (c.body || []).forEach((b) => {
      if (b.kw === 'PROPERTIES') (b.body || []).forEach((q) => { if (q.name === name) out = pval(q); });
      if (b.kw === 'SET' && b.args && b.args.length > 1 && b.args[0].c === name) out = arg(b.args[b.args.length - 1]);
    }));
    return out;
  }

  // ── a book's outline ───────────────────────────────────────────────
  // A chapter's title is its NAME (a lore chapter's H1, without the "# "); in a list, the
  // part after the system's name the files open with ("Daggerheart - Classes" → "Classes").
  function chapterTitle(c) {
    if (c.name) return c.kind === 'lore' ? c.name.replace(/^#\s+/, '') : c.name;
    return c.file.replace(/^daggerheart-0\.5-/, '').replace(/\.[a-z]+$/, '');
  }
  // (the core's files open "Daggerheart - ", Hope & Fear's "Daggerheart: Hope & Fear - ")
  const shortTitle = (c) => chapterTitle(c).replace(/^Daggerheart(?:: Hope & Fear)? - /, '');
  const chapters = (bid) => ((book(bid) || {}).chapters || []);
  const chapter = (bid, file) => chapters(bid).find((c) => c.file === file) || null;
  function loreFile(file) {
    for (const bid of Object.keys(T().books)) {
      const c = chapter(bid, file);
      if (c) return c;
    }
    return null;
  }
  const slug = (s) => String(s).toLowerCase().replace(/[’'`]/g, '').replace(/&/g, ' ').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  function loreSections(c) {
    const out = [];
    let cur = { level: 0, title: null, anchor: null, lines: [] };
    String(c.text || '').split('\n').forEach((ln) => {
      const m = /^(#{1,6})\s+(.*)$/.exec(ln);
      if (m) {
        out.push(cur);
        cur = { level: m[1].length, title: m[2], anchor: slug(m[2]), lines: [] };
      } else cur.lines.push(ln);
    });
    out.push(cur);
    return out.filter((s) => s.title || s.lines.some((l) => l.trim()));
  }
  // The section of a lore chapter under a heading, and the sub-sections under it, as Markdown.
  function loreSection(c, title) {
    const secs = loreSections(c);
    const want = slug(title);
    const i = secs.findIndex((x) => x.anchor === want);
    if (i === -1) return null;
    const out = [secs[i]];
    for (let j = i + 1; j < secs.length && secs[j].level > secs[i].level; j++) out.push(secs[j]);
    return out.map((x) => (x.title ? '#'.repeat(x.level) + ' ' + x.title + '\n' : '') + x.lines.join('\n')).join('\n');
  }

  // ── the game's own lists (from records: no book needs to load) ─────
  const recordsOf = (type) => records().filter((r) => r.type === type);
  const f = (r, k) => (r.fields || {})[k];

  // ── the campaign frames: the table's modules ───────────────────────
  // A frame is a `^"Campaign Frame"` (its card) with its narrative in its book's frames lore,
  // under a level-1 heading of the frame's own name in capitals (`# THE WITHERWILD`).
  const frames = () => recordsOf('Campaign Frame');
  function frameLore(e) {
    const lores = chapters(e.book).filter((c) => c.kind === 'lore' && /campaign-frames/.test(c.file));
    for (const c of lores) {
      const secs = loreSections(c);
      const up = e.name.toUpperCase();
      const hit = secs.find((s) => s.level === 1 && (s.title === up || s.title.replace(/^THE /, '') === up.replace(/^THE /, '')));
      if (hit) return { chapter: c, title: hit.title, text: loreSection(c, hit.title) };
    }
    return null;
  }

  // ── search ─────────────────────────────────────────────────────────
  const SKIP = new Set(['id', 'hash', 'h', 'children', 'parent', 'ent', 'rule', 'file', 'book', 'typeHash', 'ofHash', 'vk', 'kw', 'w', 'slot', 'form', 'dtype']);
  function stringsOf(x, out) {
    if (x == null) return out;
    if (typeof x === 'string') out.push(x);
    else if (Array.isArray(x)) x.forEach((y) => stringsOf(y, out));
    else if (typeof x === 'object') Object.keys(x).forEach((k) => { if (!SKIP.has(k)) stringsOf(x[k], out); });
    return out;
  }
  const cache = new Map();
  function searchText(e) {
    let t = cache.get(e.id);
    if (t === undefined) {
      t = stringsOf([e.name, e.desc, e.props, e.rules, e.table, e.blocks, e.guidance], []).join('\n');
      cache.set(e.id, t);
    }
    return t;
  }
  function search(query, bookIds, limit) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const hits = [];
    all(bookIds).forEach((e) => {
      const inName = e.name.toLowerCase().indexOf(q) !== -1;
      if (inName || searchText(e).toLowerCase().indexOf(q) !== -1) hits.push({ e, score: inName ? 0 : 1 });
    });
    hits.sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name));
    return hits.slice(0, limit || 200).map((h) => h.e);
  }
  function excerpt(e, query, n) {
    const t = searchText(e);
    const i = t.toLowerCase().indexOf(String(query).toLowerCase());
    if (i < 0) return null;
    const a = Math.max(0, i - (n || 60));
    const b = Math.min(t.length, i + String(query).length + (n || 60));
    return (a ? '…' : '') + t.slice(a, b).replace(/\n+/g, ' ').replace(/\*+/g, '') + (b < t.length ? '…' : '');
  }
  // the lore chapters too: a line search over their Markdown
  function searchLore(query, bookIds) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    (bookIds && bookIds.length ? bookIds : books().map((b) => b.id)).forEach((bid) => chapters(bid).filter((c) => c.kind === 'lore').forEach((c) => {
      let heading = null;
      String(c.text || '').split('\n').forEach((ln) => {
        const m = /^#{1,6}\s+(.*)$/.exec(ln);
        if (m) heading = m[1];
        if (ln.toLowerCase().indexOf(q) !== -1) out.push({ book: bid, chapter: c, heading, line: ln });
      });
    }));
    return out;
  }

  const label = (bid) => (indexBook(bid) || {}).label || bid;

  return {
    T, index, books, indexBook, book, entity, records, record, loaded, ensure, ensureAll, coreFirst,
    arg, prop, pval, val, text, num, enumText, blocks, block, defFields, blockEntities,
    children, ancestors, all, byType, declaration, declared, named, recordNamed,
    guidanceFor, guidanceLoose, correctionsFor, modified, reindex,
    chapterTitle, shortTitle, chapters, chapter, loreFile, slug, loreSections, loreSection,
    recordsOf, f, frames, frameLore, search, excerpt, searchLore, label,
  };
})();
