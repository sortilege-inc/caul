// system/daggerheart/entity.js — one entity, as the book holds it.
//
// Generic by design: an entity is rendered from its own fields and blocks, in the corpus's order,
// whatever it is — a class, a domain card, a weapon, the Character ACTOR — so the renderer names
// almost nothing. Every string shown is the corpus's; the words added are labels: a property's
// name (the corpus's own) and a keyword's (PLAYER_PRINCIPLES read as "Player principles"). Two
// shapes get the book's own layout: an adversary's or environment's stat block, and a FEATURES
// block, each feature as the book prints it — *Name - Type:* text.
//
// In text: `^"Name"` is a reference and is shown as the name, linked when the corpus has it;
// **bold** and *italic* are the Markdown marks the conversion carries. The string in data/ is
// untouched.
window.DHEntity = (function () {
  const { el, esc } = window.VttRender;
  const D = window.DHData;
  const open = (id) => window.DHOpenEntity && window.DHOpenEntity(id);

  // ── text ───────────────────────────────────────────────────────────
  function inline(s, bookId) {
    let h = esc(s);
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<i>$2</i>');
    h = h.replace(/\^&quot;(.+?)&quot;/g, (m, nm) => {
      const raw = nm.replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      const e = D.named(raw, bookId);
      const r = e ? null : D.recordNamed(raw)[0];
      const id = e ? e.id : r ? r.id : null;
      return id ? '<a class="ref" href="#" data-open="' + esc(id) + '">' + nm + '</a>' : '<span class="refname">' + nm + '</span>';
    });
    return h;
  }
  function wire(node) {
    node.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a[data-open]');
      if (!a) return;
      ev.preventDefault();
      open(a.dataset.open);
    });
    return node;
  }
  function prose(text, cls, bookId) {
    if (text == null || text === '') return null;
    const wrap = el('div', { class: cls || 'prose' });
    String(text).split(/\n\s*\n/).forEach((p) => wrap.appendChild(el('p', { html: inline(p, bookId).replace(/\n/g, '<br>') })));
    return wire(wrap);
  }
  const span = (text, bookId, cls) => wire(el('span', { class: cls || null, html: inline(String(text), bookId) }));

  function link(ref, bookId) {
    if (!ref) return null;
    const t = (ref.hash && D.entity(ref.hash)) || (ref.name && D.named(ref.name, bookId));
    const r = t ? null : (ref.hash && D.record(ref.hash)) || (ref.name && D.recordNamed(ref.name)[0]);
    const label = ref.name || (t && t.name) || (r && r.name) || '';
    const id = t ? t.id : r ? r.id : null;
    if (!id) return el('span', { class: 'refname' }, [label]);
    return el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); open(id); } }, [label]);
  }

  const kwLabel = (kw) => kw.charAt(0) + kw.slice(1).toLowerCase().replace(/_/g, ' ');

  // ── arguments and values ───────────────────────────────────────────
  function argNode(a, bookId) {
    if ('s' in a) return span(a.s, bookId);
    if ('c' in a) return link({ hash: a.h || null, name: a.c }, bookId);
    if ('h' in a) return link({ hash: a.h, name: null }, bookId);
    if ('i' in a) return el('span', { class: 'num' }, [String(a.i)]);
    if ('b' in a) return el('span', {}, [a.b ? 'yes' : 'no']);
    if ('w' in a) return el('span', { class: 'word' }, [a.w]);
    if ('l' in a) return el('span', { class: 'arglist' }, a.l.map((x, i) => [i ? ', ' : null, argNode(x, bookId)]));
    if ('d' in a) return nodes(a.d, bookId);
    return null;
  }
  const args = (list, bookId) => (list || []).map((a, i) => [i ? ' ' : null, argNode(a, bookId)]);

  function value(p, bookId) {
    switch (p.vk) {
      case 'ref': return link(p.ref, bookId);
      case 'list': {
        const items = p.items || [];
        if (!items.length) return p.of ? el('span', { class: 'muted small' }, ['list of ' + p.of]) : null;
        return el('ul', { class: 'items' }, items.map((it) => el('li', {}, [argNode(it, bookId)])));
      }
      case 'def': return el('div', { class: 'def' }, [fields(p.fields, bookId), p.blocks ? nodes(p.blocks, bookId) : null]);
      case 'enum': return p.value !== undefined ? span(String(p.value), bookId) : el('span', { class: 'muted small' }, ['one of ' + (p.options || []).join(', ')]);
      case 'choice': return el('span', {}, ['choose ' + (p.pick || 1) + ': ', args(p.items, bookId)]);
      case 'block': return nodes(p.body, bookId);
      case 'name': return link({ name: p.name }, bookId);
      default: {
        const v = p.value !== undefined ? p.value : p.default;
        if (v === undefined) return el('span', { class: 'muted small decl' }, [[p.dtype || 'value', p.min != null ? 'min ' + p.min : null, p.max != null ? 'max ' + p.max : null, p.required ? 'required' : null].filter(Boolean).join(' ')]);
        if (typeof v === 'boolean') return el('span', {}, [v ? 'yes' : 'no']);
        if (typeof v === 'number') return el('span', { class: 'num' }, [String(v)]);
        return String(v).length > 90 ? prose(String(v), 'prose', bookId) : span(String(v), bookId);
      }
    }
  }
  function fieldRow(p, bookId) {
    if (p.vk === 'name') return el('div', { class: 'prop solo' }, [value(p, bookId)]);
    return el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [p.name, p.default !== undefined && p.value === undefined ? el('span', { class: 'muted' }, [' (default)']) : null]), el('div', { class: 'prop-v' }, [value(p, bookId)])]);
  }
  function fields(list, bookId) {
    if (!list || !list.length) return null;
    return el('div', { class: 'fields' }, list.map((f) => fieldRow(f, bookId)));
  }

  // ── blocks, generically ────────────────────────────────────────────
  function node(b, bookId, depth) {
    if (!b || typeof b !== 'object') return null;
    if ('ent' in b) {
      const e = D.entity(b.ent);
      return e ? el('div', { class: 'nested' }, [render(e, { depth: (depth || 0) + 1 })]) : null;
    }
    if ('rule' in b) return null;          // a RULES line is a machine rule; its prose is the book's
    if ('num' in b) return el('div', { class: 'numrow' }, [el('span', { class: 'n' }, [String(b.num)]), el('span', {}, [args(b.args, bookId)]), b.body ? nodes(b.body, bookId, depth) : null]);
    if ('s' in b && !('kw' in b)) {
      if (b.body) return el('div', { class: 'section' }, [el('div', { class: 'sec-k' }, [span(b.s, bookId)]), nodes(b.body, bookId, depth)]);
      // a keyed row: `"Critical Success" "You get what you want…"`
      if (b.args && b.args.length === 1 && 's' in b.args[0]) return el('div', { class: 'keyrow' }, [el('b', {}, [span(b.s, bookId)]), ' ', span(b.args[0].s, bookId)]);
      return el('div', { class: 'line' }, [span(b.s, bookId), b.args && b.args.length ? el('span', {}, [' → ', args(b.args, bookId)]) : null]);
    }
    if ('name' in b && 'vk' in b) return fieldRow(b, bookId);
    if (!('kw' in b)) return null;
    if (b.kw === 'GUIDANCE' && b.body) return null;       // attached to what it concerns
    if (b.kw === 'FEATURES' && b.body) return features(b, bookId);
    if (b.kw === 'ROLL_TABLE' && b.body) return rollTable(b, bookId);
    const label = el('span', { class: 'kw' }, [kwLabel(b.kw)]);
    const a = b.args && b.args.length ? args(b.args, bookId) : null;
    if (!b.body) {
      const long = b.args && b.args.length === 1 && 's' in b.args[0] && b.args[0].s.length > 90;
      if (long) return el('div', { class: 'kwpara' }, [el('div', { class: 'prop-k' }, [kwLabel(b.kw)]), prose(b.args[0].s, 'prose', bookId)]);
      return el('div', { class: 'kwline' }, [label, a ? el('span', { class: 'kwargs' }, [a]) : null]);
    }
    return el('div', { class: 'kwblock' + (depth ? ' deep' : '') }, [
      el('div', { class: 'kwhead' }, [label, a ? el('span', { class: 'kwargs' }, [' ', a]) : null]),
      nodes(b.body, bookId, (depth || 0) + 1),
    ]);
  }
  function nodes(list, bookId, depth) {
    if (!list || !list.length) return null;
    return el('div', { class: 'nodes' }, list.map((b) => node(b, bookId, depth)));
  }

  // A feature as the book prints it: *Name - Type:* its text. A feature carrying anything more
  // than a Type and a Description renders whole.
  function featureLine(f) {
    const t = D.text(f, 'Type');
    const desc = D.text(f, 'Description');
    const rest = (f.props || []).filter((p) => p.name !== 'Type' && p.name !== 'Description');
    if (rest.length || (f.blocks || []).length || f.children.length) return el('div', { class: 'nested' }, [render(f, { depth: 1 })]);
    return el('div', { class: 'feature' }, [
      el('b', {}, [f.name + (t ? ' - ' + t : '') + ':']), ' ',
      desc ? prose(desc, 'prose inline-first', f.book) : null,
      guidance(D.guidanceFor(f.id), f.book),
    ]);
  }
  function features(b, bookId) {
    const list = (b.body || []).filter((x) => 'ent' in x).map((x) => D.entity(x.ent)).filter(Boolean);
    const other = (b.body || []).filter((x) => !('ent' in x));
    return el('div', { class: 'features' }, [el('div', { class: 'prop-k' }, ['Features']), list.map(featureLine), other.length ? nodes(other, bookId, 1) : null]);
  }
  function rollTable(b, bookId) {
    const rows = (b.body || []).filter((r) => 's' in r && r.args && r.args[0]);
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
      el('thead', {}, [el('tr', {}, [el('th', {}, [b.args && b.args[0] ? String(D.arg(b.args[0])) : '']), el('th', {}, [''])])]),
      el('tbody', {}, rows.map((r) => el('tr', {}, [el('th', { scope: 'row' }, [r.s]), el('td', {}, [span(r.args[0].s, bookId)])]))),
    ])]);
  }

  function table(t, bookId) {
    if (!t) return null;
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
      el('thead', {}, [el('tr', {}, t.columns.map((c) => el('th', {}, [String(c)])))]),
      el('tbody', {}, t.rows.map((r) => el('tr', {}, r.map((c) => wire(el('td', { html: inline(String(c), bookId) })))))),
    ])]);
  }

  // ── a stat block, as the book lays one out ─────────────────────────
  // Adversary: "Tier 1 Solo", the description, Motives & Tactics, then Difficulty | Thresholds |
  // HP | Stress, ATK | the attack: range | damage, the Experiences, the Features. Environment:
  // "Tier 1 Exploration", the description, Impulses, Difficulty, Potential Adversaries, Features.
  // The labels are the stat block's own; the values are the entity's.
  const STAT_PROPS = ['Tier', 'Role', 'Category', 'Description', 'Motives & Tactics', 'Impulses', 'Difficulty', 'Damage Thresholds', 'Hit Points', 'Stress', 'Attack Modifier'];
  const signed = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
  function statBlock(e) {
    if (e.type !== 'Adversary' && e.type !== 'Environment') return null;
    const bid = e.book;
    const tier = D.num(e, 'Tier');
    const kind = D.text(e, 'Role') || D.text(e, 'Category');
    const th = D.defFields(D.prop(e, 'Damage Thresholds'));
    const atk = D.block(e, 'ATTACK');
    const attack = atk && atk.body && atk.body[0] && atk.body[0].vk === 'def' ? atk.body[0] : null;
    const af = attack ? D.defFields(attack) : {};
    const exp = D.block(e, 'EXPERIENCES');
    const mt = D.val(e, 'Motives & Tactics') || D.val(e, 'Impulses');
    const cell = (k, v) => (v == null || v === '' ? null : el('div', { class: 'sb-cell' }, [el('span', { class: 'sb-k' }, [k]), ' ', el('span', { class: 'sb-v' }, [String(v)])]));
    const hasTh = th.Major != null || th.Severe != null;
    return el('div', { class: 'statblock ' + e.type.toLowerCase() }, [
      el('div', { class: 'sb-tier' }, [[tier != null ? 'Tier ' + tier : null, kind].filter(Boolean).join(' ')]),
      D.text(e, 'Description') ? el('div', { class: 'sb-desc' }, [span(D.text(e, 'Description'), bid)]) : null,
      mt && mt.length ? el('div', { class: 'sb-line' }, [el('b', {}, [e.type === 'Adversary' ? 'Motives & Tactics: ' : 'Impulses: ']), mt.join(', ')]) : null,
      el('div', { class: 'sb-stats' }, [
        cell('Difficulty', D.val(e, 'Difficulty')),
        e.type === 'Adversary' ? cell('Thresholds', hasTh ? th.Major + '/' + th.Severe : 'None') : null,
        cell('HP', D.val(e, 'Hit Points')),
        cell('Stress', D.val(e, 'Stress')),
      ]),
      attack ? el('div', { class: 'sb-stats' }, [
        cell('ATK', D.num(e, 'Attack Modifier') != null ? signed(D.num(e, 'Attack Modifier')) : null),
        el('div', { class: 'sb-cell' }, [el('span', { class: 'sb-k' }, [attack.name + ':']), ' ', el('span', { class: 'sb-v' }, [[af.Range, af.Damage].filter(Boolean).join(' | ')])]),
      ]) : null,
      exp && exp.body && exp.body.length ? el('div', { class: 'sb-line' }, [el('b', {}, ['Experience: ']), exp.body.map((x, i) => [i ? ', ' : null, x.name + ' ' + (typeof x.value === 'number' ? signed(x.value) : '')])]) : null,
    ]);
  }

  function guidance(list, bookId) {
    return (list || []).map((g) => el('aside', { class: 'guidance' }, [
      el('div', { class: 'guidance-k' }, [g.name || 'Sidebar', g.topics && g.topics.length ? el('span', { class: 'muted small' }, [' · ' + g.topics.join(', ')]) : null]),
      prose(g.text, 'prose', bookId),
    ]));
  }
  // an instance's house rule (a MODIFY) beside the rule it changes
  function corrections(e) {
    const list = D.correctionsFor(e);
    if (!list.length) return null;
    return el('div', { class: 'errata' }, list.map((c) => el('aside', { class: 'correction' }, [
      el('div', { class: 'guidance-k' }, [c.op === 'MODIFY' ? 'Changed' : 'Replaced', el('span', { class: 'muted small' }, [' · ' + D.label(c.book)])]),
      nodes(c.body, c.book, 1),
    ])));
  }

  function subtitle(e) {
    const bits = [];
    if (e.form === 'ACTOR') bits.push('actor type' + (e.type ? ', a kind of ' + e.type : ''));
    else if (e.type) bits.push(e.type);
    const tier = D.num(e, 'Tier');
    if (tier != null && e.type !== 'Adversary' && e.type !== 'Environment') bits.push('Tier ' + tier);
    const dom = D.val(e, 'Domain');
    if (dom && dom.name) bits.push(dom.name + ' ' + (D.num(e, 'Domain Level') != null ? 'level ' + D.num(e, 'Domain Level') : ''));
    return bits;
  }

  function render(e, opts) {
    const o = opts || {};
    const bid = e.book;
    const box = el('article', { class: 'entity' + (e.form === 'ACTOR' ? ' actor' : '') + (e.type ? ' type-' + e.type.toLowerCase().replace(/\W+/g, '-') : '') + (o.depth ? ' depth' : '') });
    if (!o.bare) {
      const H = o.depth ? 'h4' : 'h3';
      box.appendChild(el(H, {}, [e.name, e.type && !o.depth ? el('span', { class: 'etype' }, [e.type]) : null]));
      const sub = subtitle(e);
      if (sub.length && !o.depth) box.appendChild(el('div', { class: 'muted small' }, [sub.join(' · '), ' · ', D.label(bid)]));
    }
    const sb = statBlock(e);
    if (sb) box.appendChild(sb);
    if (e.desc) box.appendChild(prose(e.desc, 'prose', bid));
    const props = (e.props || []).filter((p) => !(sb && STAT_PROPS.indexOf(p.name) !== -1));
    const TEXTY = ['Description', 'Feature', 'Pitch', 'Tagline', 'Effect'];
    props.filter((p) => TEXTY.indexOf(p.name) !== -1 && typeof p.value === 'string' && p.value).forEach((p) => {
      box.appendChild(el('div', { class: 'kwpara' }, [p.name === 'Description' ? null : el('div', { class: 'prop-k' }, [p.name]), prose(p.value, 'prose', bid)]));
    });
    const rest = props.filter((p) => !(TEXTY.indexOf(p.name) !== -1 && typeof p.value === 'string'));
    if (rest.length) box.appendChild(fields(rest, bid));
    if (e.table) box.appendChild(table(e.table, bid));
    const inBlocks = new Set();
    const walk = (list) => (list || []).forEach((b) => { if (b && 'ent' in b) inBlocks.add(b.ent); else if (b && b.body) walk(b.body); });
    walk(e.blocks);
    const shown = (e.blocks || []).filter((b) => !(sb && (b.kw === 'ATTACK' || b.kw === 'EXPERIENCES')));
    if (shown.length) box.appendChild(nodes(shown, bid, o.depth || 0));
    guidance(D.guidanceFor(e.id), bid).forEach((g) => box.appendChild(g));
    const er = corrections(e);
    if (er) box.appendChild(er);
    if (!o.noKids) D.children(e.id).filter((k) => !inBlocks.has(k.id)).forEach((k) => box.appendChild(el('div', { class: 'nested' }, [render(k, { depth: (o.depth || 0) + 1 })])));
    return box;
  }

  // A card for a grid: the name, what it is, the start of its text.
  function card(e, onclick, meta) {
    const text = e.desc || D.text(e, 'Description') || D.text(e, 'Feature') || '';
    return el('button', { class: 'card', type: 'button', onclick }, [
      el('div', { class: 'card-name' }, [e.name]),
      el('div', { class: 'card-meta muted small' }, [meta || subtitle(e).join(' · ')]),
      text ? wire(el('div', { class: 'card-text', html: inline(String(text).split(/\n\s*\n/)[0].slice(0, 280), e.book) })) : null,
    ]);
  }

  // ── lore: the Markdown the corpus carries, rendered ────────────────
  // headings, paragraphs, > blockquotes, - and • lists, | tables, ---; nothing else
  function markdown(text, bookId) {
    const wrap = el('div', { class: 'lore prose' });
    const lines = String(text || '').split('\n');
    let i = 0;
    const para = [];
    const flush = () => {
      if (para.length) wrap.appendChild(el('p', { html: inline(para.join(' '), bookId) }));
      para.length = 0;
    };
    const isItem = (ln) => /^\s*[-*•]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln);
    while (i < lines.length) {
      const ln = lines[i];
      let m;
      if (!ln.trim()) { flush(); i++; continue; }
      if (/^<!--.*-->\s*$/.test(ln)) { i++; continue; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(ln))) {
        flush();
        const lvl = Math.min(6, m[1].length + 1);
        wrap.appendChild(el('h' + lvl, { id: 'lore-' + D.slug(m[2]), html: inline(m[2], bookId) }));
        i++;
        continue;
      }
      if (/^---+\s*$/.test(ln)) { flush(); wrap.appendChild(el('hr')); i++; continue; }
      if (/^>/.test(ln)) {
        flush();
        const q = [];
        while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
        const bq = el('blockquote', { class: 'sidebar' });
        q.join('\n').split(/\n\s*\n/).forEach((p) => bq.appendChild(el('p', { html: inline(p.replace(/\n/g, ' '), bookId) })));
        wrap.appendChild(bq);
        continue;
      }
      if (isItem(ln)) {
        flush();
        const ordered = /^\s*\d+\.\s+/.test(ln);
        const list = el(ordered ? 'ol' : 'ul', { class: 'items' });
        while (i < lines.length && (isItem(lines[i]) || (!lines[i].trim() && i + 1 < lines.length && isItem(lines[i + 1])))) {
          if (lines[i].trim()) list.appendChild(el('li', { html: inline(lines[i].replace(/^\s*(?:[-*•]|\d+\.)\s+/, ''), bookId) }));
          i++;
        }
        wrap.appendChild(list);
        continue;
      }
      if (/^\|/.test(ln)) {
        flush();
        const rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = (r) => r.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
        const body = rows.filter((r) => !/^\|\s*:?-{2,}/.test(r));
        const hasHead = rows.some((r) => /^\|\s*:?-{2,}/.test(r));
        const head = hasHead ? body.shift() : null;
        wrap.appendChild(el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
          head ? el('thead', {}, [el('tr', {}, cells(head).map((c) => el('th', { html: inline(c, bookId) })))]) : null,
          el('tbody', {}, body.map((r) => el('tr', {}, cells(r).map((c) => el('td', { html: inline(c, bookId) }))))),
        ])]));
        continue;
      }
      para.push(ln.trim());
      i++;
    }
    flush();
    return wire(wrap);
  }

  return { render, card, prose, inline, span, link, table, fields, value, nodes, node, markdown, statBlock, subtitle, kwLabel, guidance, features, featureLine, wire };
})();
