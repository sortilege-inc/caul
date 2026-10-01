// system/daggerheart/colossi.js — the GM's colossus builder (core pp. 319–328), a section of the
// Encounters pane. A colossus is a ^"Colossus" framework plus one ^"Colossus Segment" per segment
// (core-base); the GM builds one from a copy of any colossus in the data, or blank by tier, and it is
// saved in the campaign's own state (op setColossi — the GM's, never sent to a session's room).
//
//   * toData turns the saved colossi into entities and records in the build's own shape, so DHData
//     (data.js) serves them beside the books': encounters, the Inspector, the table's HP tracking and
//     every adversary list take them with no code of their own.
//   * toDSL writes one as a campaign-layer .actor (build/build_layer.py), to commit for good.
//   * The book's Example Features (p.321) are offered as printed, with the colossus's name for
//     "the colossus" and the variations its Designer's Notes name (a Strike's range, a Climbing
//     number, a Chain's letter); the segment map is p.323's notecard map; checks() reads the rules of
//     p.319 (a colossus is defeated when all its segments are Destroyed, or by a Fatal segment or a
//     completed Chain) and the adjacency p.321 asks the GM to note.
window.DHColossi = (function () {
  const BOOK = 'gm-colossi';
  const LABEL = 'Your colossi';
  const RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];
  const TYPES = ['Passive', 'Action', 'Reaction'];
  const S = () => (window.VttState && window.VttState.state) || {};
  const saved = () => (S().colossi || []);
  const shortName = (n) => String(n || '').split(',')[0].trim() || 'The colossus';
  const toNum = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const uid = () => Math.random().toString(36).slice(2, 10);

  // ── the model ──────────────────────────────────────────────────────
  // { id, name, tier, size, description, motives, major, severe, stress,
  //   experiences: [{ name, value }], features: [{ name, type, text }],
  //   segments: [{ key, name, count, adjacent: [names], difficulty, hp, atk, attackName, range,
  //                damage, description, features, pos: { x, y } }] }
  function blankSegment(name) {
    return { key: uid(), name: name || 'Segment', count: 1, adjacent: [], difficulty: '', hp: '', atk: '', attackName: '', range: 'Melee', damage: '', description: '', features: [], pos: null };
  }
  function blank(tier) {
    return { id: uid(), name: 'A new colossus', tier: tier || 1, size: '', description: '', motives: '', major: '', severe: '', stress: 6, experiences: [], features: [], segments: [blankSegment('Body')] };
  }

  // ── the data layer's view (data.js) ────────────────────────────────
  const sc = (name, value) => ({ name, vk: 'scalar', dtype: typeof value === 'number' ? 'INTEGER' : 'STRING', value });
  const fwId = (c) => '#gmc-' + c.id;
  const segId = (c, s) => '#gmc-' + c.id + '-' + s.key;
  const segLabel = (c, s) => shortName(c.name) + ' ' + s.name + (Number(s.count) > 1 ? ' (' + Number(s.count) + ')' : '');
  function toData(list) {
    const entities = {};
    const records = [];
    const feats = (owner, fl) => (fl || []).map((f, i) => {
      const e = { id: owner + '-f' + i, name: f.name || 'Feature', type: 'Adversary Feature', form: 'DEF', book: BOOK, file: null, parent: owner, slot: null, children: [], blocks: [], props: [sc('Type', f.type || 'Passive'), sc('Description', f.text || '')] };
      entities[e.id] = e;
      return e.id;
    });
    (list || []).forEach((c) => {
      const id = fwId(c);
      const props = [sc('Tier', toNum(c.tier) || 1), sc('Role', 'Colossus')];
      if (c.description) props.push(sc('Description', c.description));
      const mt = String(c.motives || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (mt.length) props.push({ name: 'Motives & Tactics', vk: 'list', items: mt.map((s) => ({ s })) });
      if (c.size) props.push(sc('Size', c.size));
      if (toNum(c.major) != null || toNum(c.severe) != null) props.push({ name: 'Damage Thresholds', vk: 'def', fields: [sc('Major', toNum(c.major)), sc('Severe', toNum(c.severe))] });
      if (toNum(c.stress) != null) props.push(sc('Stress', toNum(c.stress)));
      const fIds = feats(id, c.features);
      const blocks = [{ kw: 'SEGMENTS', args: [], body: (c.segments || []).map((s) => sc(s.name, Number(s.count) || 1)) }];
      if ((c.experiences || []).length) blocks.push({ kw: 'EXPERIENCES', args: [], body: c.experiences.map((x) => sc(x.name, toNum(x.value) || 0)) });
      if (fIds.length) blocks.push({ kw: 'FEATURES', args: [], body: fIds.map((x) => ({ ent: x })) });
      entities[id] = { id, name: c.name || 'Unnamed colossus', type: 'Colossus', form: 'DEF', book: BOOK, file: null, parent: null, slot: null, children: fIds, props, blocks };
      records.push({ id, book: BOOK, kind: 'gm', name: entities[id].name, type: 'Colossus', fields: { Tier: toNum(c.tier) || 1, Role: 'Colossus' } });
      (c.segments || []).forEach((s) => {
        const sid = segId(c, s);
        const sp = [{ name: 'Colossus', vk: 'ref', ref: { hash: id, name: entities[id].name } }, sc('Count', Number(s.count) || 1)];
        if (s.description) sp.push(sc('Description', s.description));
        if ((s.adjacent || []).length) sp.push({ name: 'Adjacent Segments', vk: 'list', items: s.adjacent.map((x) => ({ s: x })) });
        if (toNum(s.difficulty) != null) sp.push(sc('Difficulty', toNum(s.difficulty)));
        if (toNum(s.hp) != null) sp.push(sc('Hit Points', toNum(s.hp)));
        const hasAtk = toNum(s.atk) != null && s.damage;
        if (hasAtk) sp.push(sc('Attack Modifier', toNum(s.atk)));
        const sf = feats(sid, s.features);
        const sb = [];
        if (hasAtk) sb.push({ kw: 'ATTACK', args: [], body: [{ vk: 'def', name: s.attackName || 'Attack', fields: [sc('Range', s.range || 'Melee'), sc('Damage', s.damage)] }] });
        if (sf.length) sb.push({ kw: 'FEATURES', args: [], body: sf.map((x) => ({ ent: x })) });
        entities[sid] = { id: sid, name: segLabel(c, s), type: 'Colossus Segment', form: 'DEF', book: BOOK, file: null, parent: null, slot: null, children: sf, props: sp, blocks: sb };
        const fields = { Count: Number(s.count) || 1 };
        if (toNum(s.difficulty) != null) fields.Difficulty = toNum(s.difficulty);
        records.push({ id: sid, book: BOOK, kind: 'gm', name: entities[sid].name, type: 'Colossus Segment', colossus: id, fields });
      });
    });
    return { entities, records };
  }

  // ── from what's in the data (a book's colossus, a campaign's, or one of yours) ─
  function fromEntity(D, e) {
    const sn = shortName(e.name);
    const th = D.defFields(D.prop(e, 'Damage Thresholds'));
    const order = ((D.block(e, 'SEGMENTS') || {}).body || []).map((x) => x.name);
    const bare = (n) => String(n).replace(new RegExp('^' + sn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+'), '').replace(/\s*\(\d+\)$/, '');
    const featsOf = (x) => D.blockEntities(x, 'FEATURES').map((f) => ({ name: f.name, type: D.text(f, 'Type') || 'Passive', text: D.text(f, 'Description') || '' }));
    const segs = D.segmentsOf(e.id).map((r) => D.entity(r.id)).filter(Boolean).map((s) => {
      const a = D.block(s, 'ATTACK');
      const at = a && a.body && a.body[0] && a.body[0].vk === 'def' ? a.body[0] : null;
      const af = at ? D.defFields(at) : {};
      return {
        key: uid(), name: bare(s.name), count: D.num(s, 'Count') || 1, adjacent: (D.val(s, 'Adjacent Segments') || []).slice(),
        difficulty: D.num(s, 'Difficulty') == null ? '' : D.num(s, 'Difficulty'), hp: D.num(s, 'Hit Points') == null ? '' : D.num(s, 'Hit Points'),
        atk: D.num(s, 'Attack Modifier') == null ? '' : D.num(s, 'Attack Modifier'), attackName: at ? at.name : '', range: af.Range || 'Melee', damage: af.Damage || '',
        description: D.text(s, 'Description') || '', features: featsOf(s), pos: null,
      };
    }).sort((a, b) => (order.indexOf(a.name) === -1 ? 99 : order.indexOf(a.name)) - (order.indexOf(b.name) === -1 ? 99 : order.indexOf(b.name)));
    return {
      id: uid(), name: e.name + ' (copy)', tier: D.num(e, 'Tier') || 1, size: D.text(e, 'Size') || '', description: D.text(e, 'Description') || '',
      motives: (D.val(e, 'Motives & Tactics') || []).join(', '), major: th.Major == null ? '' : th.Major, severe: th.Severe == null ? '' : th.Severe,
      stress: D.num(e, 'Stress') == null ? '' : D.num(e, 'Stress'),
      experiences: ((D.block(e, 'EXPERIENCES') || {}).body || []).map((x) => ({ name: x.name, value: x.value })),
      features: featsOf(e), segments: segs,
    };
  }

  // ── the campaign-layer DSL (build/build_layer.py reads it as it reads any .actor) ─
  const q = (s) => '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  function hash(seed) {             // a stable 24-character corpus-style id from the builder's own ids
    let h = 2166136261 >>> 0;
    let out = 'g';
    for (let i = 0; out.length < 24; i++) {
      const str = seed + '|' + i;
      for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0; }
      out += AL[h % 62];
    }
    return '#' + out;
  }
  const slug = (s) => String(s || 'colossus').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'colossus';
  function toDSL(c) {
    const today = new Date().toISOString().slice(0, 10);
    const ext = 'Colossus_' + slug(shortName(c.name)).replace(/-/g, '_');
    const fw = hash(c.id);
    const L = [];
    const featBlock = (pad, owner, fl) => {
      if (!(fl || []).length) return;
      L.push(pad + 'FEATURES {');
      fl.forEach((f, i) => {
        L.push(pad + '    ' + hash(c.id + owner + 'f' + i) + ' ^' + q(f.name || 'Feature') + ' DEF {');
        L.push(pad + '        EXTENDS #daggerheartAdvFeature00000001 ^"Adversary Feature"');
        L.push(pad + '        ^"Type" STRING ' + q(f.type || 'Passive'));
        L.push(pad + '        ^"Description" STRING ' + q(f.text || ''));
        L.push(pad + '    }');
      });
      L.push(pad + '}');
    };
    L.push('EXTENSION ' + q(ext) + ' EXTENDS "Daggerheart_Core_Base" {');
    L.push('    NAME ' + q(c.name + ', a colossus'));
    L.push('    VERSION "0.1.0"');
    L.push('    SPEC_VERSION "0.5"');
    L.push('    RELEASE_DATE ' + q(today));
    L.push('');
    L.push('    // Built in the GM\'s colossus builder (the Encounters pane) on the Colossus of the Drylands');
    L.push('    // rules, core rulebook pp. 319-328.');
    L.push('    ' + fw + ' ^' + q(c.name) + ' DEF {');
    L.push('        EXTENDS #daggerheartColossus00000001 ^"Colossus"');
    L.push('        PROPERTIES {');
    L.push('            ^"Tier" INTEGER ' + (toNum(c.tier) || 1));
    L.push('            ^"Role" STRING "Colossus"');
    if (c.description) L.push('            ^"Description" STRING ' + q(c.description));
    const mt = String(c.motives || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (mt.length) L.push('            ^"Motives & Tactics" LIST [' + mt.map(q).join(', ') + ']');
    if (c.size) L.push('            ^"Size" STRING ' + q(c.size));
    if (toNum(c.major) != null && toNum(c.severe) != null) L.push('            ^"Damage Thresholds" DEF { ^"Major" INTEGER ' + toNum(c.major) + ' ^"Severe" INTEGER ' + toNum(c.severe) + ' }');
    if (toNum(c.stress) != null) L.push('            ^"Stress" INTEGER ' + toNum(c.stress));
    L.push('        }');
    L.push('        SEGMENTS {');
    (c.segments || []).forEach((s) => L.push('            ^' + q(s.name) + ' INTEGER ' + (Number(s.count) || 1)));
    L.push('        }');
    if ((c.experiences || []).length) {
      L.push('        EXPERIENCES {');
      c.experiences.forEach((x) => L.push('            ^' + q(x.name) + ' INTEGER ' + (toNum(x.value) || 0)));
      L.push('        }');
    }
    featBlock('        ', 'fw', c.features);
    L.push('    }');
    (c.segments || []).forEach((s) => {
      L.push('');
      L.push('    ' + hash(c.id + s.key) + ' ^' + q(segLabel(c, s)) + ' DEF {');
      L.push('        EXTENDS #daggerheartColossusSegment1 ^"Colossus Segment"');
      L.push('        PROPERTIES {');
      L.push('            ^"Colossus" ' + fw + ' ^' + q(c.name));
      L.push('            ^"Count" INTEGER ' + (Number(s.count) || 1));
      if (s.description) L.push('            ^"Description" STRING ' + q(s.description));
      if ((s.adjacent || []).length) L.push('            ^"Adjacent Segments" LIST [' + s.adjacent.map(q).join(', ') + ']');
      if (toNum(s.difficulty) != null) L.push('            ^"Difficulty" INTEGER ' + toNum(s.difficulty));
      if (toNum(s.hp) != null) L.push('            ^"Hit Points" INTEGER ' + toNum(s.hp));
      const hasAtk = toNum(s.atk) != null && s.damage;
      if (hasAtk) L.push('            ^"Attack Modifier" INTEGER ' + toNum(s.atk));
      L.push('        }');
      if (hasAtk) {
        L.push('        ATTACK {');
        L.push('            ^' + q(s.attackName || 'Attack') + ' DEF { ^"Range" STRING ' + q(s.range || 'Melee') + ' ^"Damage" STRING ' + q(s.damage) + ' }');
        L.push('        }');
      }
      featBlock('        ', s.key, s.features);
      L.push('    }');
    });
    L.push('}');
    return { text: L.join('\n') + '\n', file: slug(shortName(c.name)) + '.actor' };
  }

  // ── checks (p.319, p.321) ──────────────────────────────────────────
  const has = (fl, re) => (fl || []).some((f) => re.test(f.name || ''));
  function checks(c) {
    const out = [];
    const segs = c.segments || [];
    if (!segs.length) out.push({ level: 'warn', text: 'A colossus needs at least one segment.' });
    if (toNum(c.major) == null || toNum(c.severe) == null) out.push({ level: 'warn', text: 'The framework has no damage thresholds; its segments fight with them.' });
    else if (toNum(c.severe) <= toNum(c.major)) out.push({ level: 'warn', text: 'The Severe threshold should be above the Major.' });
    const names = segs.map((s) => s.name);
    names.forEach((n, i) => { if (names.indexOf(n) !== i) out.push({ level: 'warn', text: 'Two segments are named "' + n + '".' }); });
    segs.forEach((s) => {
      (s.adjacent || []).forEach((a) => {
        const t = segs.find((x) => x.name === a);
        if (!t) out.push({ level: 'warn', text: s.name + ' is adjacent to "' + a + '", which isn\'t a segment.' });
        else if (t !== s && (t.adjacent || []).indexOf(s.name) === -1) out.push({ level: 'warn', text: s.name + ' lists ' + t.name + ' as adjacent, but ' + t.name + ' doesn\'t list ' + s.name + '.' });
      });
      if (segs.length > 1 && !(s.adjacent || []).some((a) => a !== s.name)) out.push({ level: 'warn', text: s.name + ' is adjacent to no other segment, so no one can climb to it from the colossus.' });
      if (toNum(s.hp) == null && !has(s.features, /^Invulnerable/i)) out.push({ level: 'note', text: s.name + ' has no Hit Points ("HP: None"); the book\'s Poy pairs that with Invulnerable.' });
      if ((toNum(s.atk) != null) !== !!s.damage) out.push({ level: 'warn', text: s.name + ': an attack needs both its modifier and its damage.' });
      if (toNum(s.difficulty) == null) out.push({ level: 'warn', text: s.name + ' has no Difficulty.' });
    });
    const fatal = segs.filter((s) => has(s.features, /^Fatal\b/i));
    const chains = {};
    segs.forEach((s) => (s.features || []).forEach((f) => { const m = /^Chain(?:\s*\(([^)]*)\))?/i.exec(f.name || ''); if (m) (chains[m[1] || ''] = chains[m[1] || ''] || []).push(s); }));
    fatal.filter((s) => toNum(s.hp) == null).forEach((s) => out.push({ level: 'warn', text: s.name + ' is Fatal but has no Hit Points, so it can never be Destroyed.' }));
    Object.keys(chains).forEach((k) => { const dead = chains[k].filter((s) => toNum(s.hp) == null); if (dead.length) out.push({ level: 'warn', text: 'Chain' + (k ? ' (' + k + ')' : '') + ' can never complete: ' + dead.map((s) => s.name).join(', ') + ' has no Hit Points.' }); });
    const defeatable = fatal.some((s) => toNum(s.hp) != null) || Object.keys(chains).some((k) => chains[k].every((s) => toNum(s.hp) != null)) || (segs.length && segs.every((s) => toNum(s.hp) != null));
    if (segs.length && !defeatable) out.push({ level: 'note', text: 'It can\'t be defeated by damage: not every segment can be Destroyed, and no Fatal segment or Chain can be. Fine if that\'s the design; say how it ends in a framework feature.' });
    else if (segs.length && !fatal.length && !Object.keys(chains).length) out.push({ level: 'note', text: 'With no Fatal segment or Chain, it is defeated only when every segment is Destroyed.' });
    return out;
  }

  // ── the book's Example Features (p.321), as printed ────────────────
  function catalogue(D) {
    return D.records().filter((r) => r.type === 'Adversary Feature' && r.under === 'Example Features').map((r) => D.entity(r.id)).filter(Boolean);
  }
  // the printed text with the colossus's name for "the colossus", and a Designer's Note's variation
  function fromBook(D, f, colossusName, v) {
    let name = f.name;
    let text = D.text(f, 'Description') || '';
    const nm = shortName(colossusName);
    if (/^Strike \(Melee\)$/.test(name) && v.range && v.range !== 'Melee') { name = 'Strike (' + v.range + ')'; text = text.replace('within Melee range', 'within ' + v.range + ' range'); }
    if (/^Climbing \(\+3\)$/.test(name) && v.climb != null && String(v.climb) !== '' && Number(v.climb) !== 3) { const n = Number(v.climb); const s = (n < 0 ? '−' : '+') + Math.abs(n); name = 'Climbing (' + s + ')'; text = text.replace('a +3 bonus', 'a ' + s + ' bonus'); }
    if (/^Chain$/.test(name) && v.chain) { name = 'Chain (' + v.chain + ')'; text = text.replace('in this chain', 'in Chain ' + v.chain); }
    text = text.replace(/\bthe colossus\b/g, nm).replace(/\bThe colossus\b/g, nm);
    return { name, type: D.text(f, 'Type') || 'Passive', text };
  }

  // ── the builder (rendered into the Encounters pane) ────────────────
  let editing = null;       // the colossus being edited: a copy, saved by Save
  let dirty = false;
  let open = false;
  function section(host, opts) {
    const D = window.DHData;
    const { el, button } = window.VttRender;
    const State = window.VttState;
    const commit = (list) => State.commit('setColossi', [list]);
    const box = el('details', { class: 'colossus-builder', open: open || editing ? '' : null });
    box.addEventListener('toggle', () => { open = box.open; });
    box.appendChild(el('summary', {}, [el('b', {}, ['Colossi']), el('span', { class: 'muted small' }, [' · build your own (core pp. 319–328)'])]));
    const body = el('div', { class: 'cz-body' });
    box.appendChild(body);
    host.appendChild(box);
    D.coreFirst().then(() => draw());

    const save = () => {
      if (!editing) return;
      const l = saved().slice();
      const i = l.findIndex((x) => x.id === editing.id);
      if (i === -1) l.push(copy(editing)); else l[i] = copy(editing);
      dirty = false;
      commit(l);
    };
    const addToEncounter = (c) => { const r = D.record(fwId(c)); if (r && opts.onAdd) opts.onAdd(r); };

    function draw() {
      body.innerHTML = '';
      // your colossi
      const mine = saved();
      if (mine.length) body.appendChild(el('ul', { class: 'items cz-list' }, mine.map((c) => el('li', {}, [
        el('button', { class: 'ref', type: 'button', onclick: () => { editing = copy(c); dirty = false; draw(); } }, [c.name]),
        el('span', { class: 'muted small' }, [' · Tier ' + c.tier + ' · ' + (c.segments || []).length + ' segments ']),
        button('+ Encounter', () => addToEncounter(c), 'ghost tiny'),
        button('×', () => { if (!confirm('Delete ' + c.name + '?')) return; if (editing && editing.id === c.id) editing = null; commit(saved().filter((x) => x.id !== c.id)); }, 'ghost tiny'),
      ]))));
      // start one
      const colossi = D.adversaryRecords().filter((r) => r.type === 'Colossus' && r.book !== BOOK).sort((a, b) => (D.tierOf(a) || 0) - (D.tierOf(b) || 0) || a.name.localeCompare(b.name));
      const from = el('select', { class: 'scope tiny', 'aria-label': 'Copy a colossus' }, [el('option', { value: '' }, ['Copy a colossus…'])].concat(
        colossi.map((r) => el('option', { value: r.id }, ['Tier ' + D.tierOf(r) + ' · ' + r.name + ' · ' + D.label(r.book)])),
        mine.map((c) => el('option', { value: 'mine:' + c.id }, ['Tier ' + c.tier + ' · ' + c.name + ' · ' + LABEL]))));
      from.addEventListener('change', () => {
        const v = from.value;
        if (!v) return;
        if (dirty && !confirm('Discard the unsaved changes to ' + editing.name + '?')) { from.value = ''; return; }
        if (v.indexOf('mine:') === 0) { const c = saved().find((x) => x.id === v.slice(5)); editing = Object.assign(copy(c), { id: uid(), name: c.name + ' (copy)' }); dirty = true; draw(); return; }
        const r = D.record(v);
        D.ensure(r.book).then(() => { editing = fromEntity(D, D.entity(v)); dirty = true; draw(); });
      });
      const tierSel = el('select', { class: 'scope tiny', 'aria-label': 'Tier' }, [1, 2, 3, 4].map((t) => el('option', { value: String(t) }, ['Tier ' + t])));
      body.appendChild(el('div', { class: 'chiprow tight' }, [from, el('span', { class: 'muted small' }, ['or']), tierSel,
        button('New blank', () => { if (dirty && !confirm('Discard the unsaved changes to ' + editing.name + '?')) return; editing = blank(Number(tierSel.value)); dirty = true; draw(); }, 'ghost tiny')]));
      if (editing) body.appendChild(editor(editing));
    }

    // ── the editor ──
    function editor(c) {
      const wrap = el('div', { class: 'cz-editor' });
      const live = el('div', { class: 'cz-live' });         // the map and the checks: redrawn as you type, never the fields
      const status = el('span', { class: 'muted small' }, [dirty ? 'unsaved' : 'saved']);
      const touch = () => { dirty = true; status.textContent = 'unsaved'; drawLive(); };
      const field = (label, get, set, attrs) => {
        const inp = el(attrs && attrs.textarea ? 'textarea' : 'input', Object.assign({ class: 'text', 'aria-label': label, placeholder: label }, attrs && attrs.textarea ? { rows: attrs.rows || 2 } : { type: (attrs && attrs.type) || 'text' }));
        inp.value = get() == null ? '' : String(get());
        inp.addEventListener('input', () => { set(inp.value); touch(); });
        return el('label', { class: 'cz-f' + (attrs && attrs.wide ? ' wide' : '') }, [el('span', { class: 'prop-k' }, [label]), inp]);
      };
      const select = (label, options, get, set) => {
        const s = el('select', { class: 'scope tiny', 'aria-label': label }, options.map((o) => el('option', { value: String(o), selected: String(get()) === String(o) || null }, [String(o)])));
        s.addEventListener('change', () => { set(s.value); touch(); });
        return el('label', { class: 'cz-f' }, [el('span', { class: 'prop-k' }, [label]), s]);
      };
      const redraw = () => { dirty = true; draw(); };

      wrap.appendChild(el('div', { class: 'chiprow tight cz-bar' }, [
        el('b', {}, ['Editing: ' + c.name]), status,
        button('Save', () => save(), 'tiny'),
        button('Save & add to encounter', () => { save(); addToEncounter(c); }, 'ghost tiny'),
        button('Export as DSL', () => exportBox(c), 'ghost tiny'),
        button('Close', () => { if (dirty && !confirm('Close without saving?')) return; editing = null; dirty = false; draw(); }, 'ghost tiny'),
      ]));
      const out = el('div', { class: 'cz-export' });
      wrap.appendChild(out);
      function exportBox(cz) {
        const d = toDSL(cz);
        out.innerHTML = '';
        const ta = el('textarea', { class: 'text mono', rows: 12, readonly: '', 'aria-label': 'DSL' });
        ta.value = d.text;
        const dl = el('a', { class: 'btn ghost tiny', download: d.file, href: URL.createObjectURL(new Blob([d.text], { type: 'text/plain' })) }, ['Download ' + d.file]);
        out.appendChild(el('div', { class: 'muted small' }, ['A campaign-layer file: put it in the campaign\'s DSL folder and rebuild (build/build_layer.sh). Once the campaign\'s data has it, delete this copy here.']));
        out.appendChild(el('div', { class: 'chiprow tight' }, [button('Copy', () => { ta.select(); navigator.clipboard && navigator.clipboard.writeText(d.text); }, 'ghost tiny'), dl, button('Hide', () => { out.innerHTML = ''; }, 'ghost tiny')]));
        out.appendChild(ta);
      }

      // the name: when it's done, the old short name in every feature's text becomes the new one (a
      // copy of Poy says "Poy" in its features until it's renamed)
      function renameField() {
        const f = field('Name', () => c.name, (v) => { c.name = v; }, { wide: true });
        let before = shortName(c.name);
        f.querySelector('input').addEventListener('change', () => {
          const now = shortName(c.name);
          if (now === before || !before) { before = now; return; }
          const re = new RegExp('\\b' + before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
          let n = 0;
          const swap = (fl) => (fl || []).forEach((x) => { const t2 = String(x.text || '').replace(re, () => { n++; return now; }); x.text = t2; });
          swap(c.features);
          (c.segments || []).forEach((s) => swap(s.features));
          before = now;
          if (n) redraw();
        });
        return f;
      }
      // the framework
      const fw = el('fieldset', { class: 'cz-fw' }, [el('legend', {}, ['Framework'])]);
      fw.appendChild(el('div', { class: 'cz-grid' }, [
        renameField(),
        select('Tier', [1, 2, 3, 4], () => c.tier, (v) => { c.tier = Number(v); drawRef(); }),
        field('Size', () => c.size, (v) => { c.size = v; }, { wide: true }),
        field('Major', () => c.major, (v) => { c.major = v; }, { type: 'number' }),
        field('Severe', () => c.severe, (v) => { c.severe = v; }, { type: 'number' }),
        field('Stress', () => c.stress, (v) => { c.stress = v; }, { type: 'number' }),
        field('Description', () => c.description, (v) => { c.description = v; }, { textarea: true, wide: true }),
        field('Motives & Tactics (comma-separated)', () => c.motives, (v) => { c.motives = v; }, { wide: true }),
        field('Experiences (e.g. Huge +3, Maneuver +2)', () => (c.experiences || []).map((x) => x.name + ' ' + (Number(x.value) >= 0 ? '+' : '') + x.value).join(', '), (v) => {
          c.experiences = v.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = /^(.*?)\s*([+\-−]?\d+)$/.exec(x); return m ? { name: m[1], value: Number(m[2].replace('−', '-')) } : { name: x, value: 0 }; });
        }, { wide: true }),
      ]));
      fw.appendChild(featuresEditor(c, c.features, 'The framework\'s features (the colossus as a whole)'));
      wrap.appendChild(fw);
      const ref = el('div', { class: 'cz-ref muted small' });
      wrap.appendChild(ref);
      function drawRef() {
        ref.innerHTML = '';
        const ex = D.adversaryRecords().find((r) => r.type === 'Colossus' && r.book === 'core' && D.tierOf(r) === Number(c.tier));
        const e = ex && D.entity(ex.id);
        if (!e) return;
        const th = D.defFields(D.prop(e, 'Damage Thresholds'));
        const segs = D.segmentsOf(e.id).map((r) => D.entity(r.id)).filter(Boolean);
        const range = (k) => { const v = segs.map((s) => D.num(s, k)).filter((x) => x != null); return v.length ? (Math.min(...v) === Math.max(...v) ? String(v[0]) : Math.min(...v) + '–' + Math.max(...v)) : '—'; };
        const dmg = segs.map((s) => { const a = D.block(s, 'ATTACK'); const at = a && a.body && a.body[0]; return at && at.vk === 'def' ? D.defFields(at).Damage : null; }).filter(Boolean);
        ref.appendChild(el('div', {}, [el('b', {}, ['The book\'s tier ' + c.tier + ' colossus, ' + e.name + ': ']),
          'thresholds ' + th.Major + '/' + th.Severe + ' · Stress ' + (D.num(e, 'Stress') || '—') + ' · segments: Difficulty ' + range('Difficulty') + ', HP ' + range('Hit Points') + ', ATK +' + range('Attack Modifier') + (dmg.length ? ', damage ' + dmg.join(' · ') : '')]));
      }
      drawRef();

      // the segments
      const sl = el('div', { class: 'cz-segs' });
      (c.segments || []).forEach((s, i) => {
        const card = el('fieldset', { class: 'cz-seg' }, [el('legend', {}, [segLabel(c, s)])]);
        card.appendChild(el('div', { class: 'cz-grid' }, [
          field('Segment', () => s.name, (v) => { const old = s.name; s.name = v; c.segments.forEach((o) => { o.adjacent = (o.adjacent || []).map((a) => (a === old ? v : a)); }); }),
          field('Count', () => s.count, (v) => { s.count = Math.max(1, Number(v) || 1); }, { type: 'number' }),
          field('Difficulty', () => s.difficulty, (v) => { s.difficulty = v; }, { type: 'number' }),
          field('HP (blank: None)', () => s.hp, (v) => { s.hp = v; }, { type: 'number' }),
          field('ATK', () => s.atk, (v) => { s.atk = v; }, { type: 'number' }),
          field('Attack', () => s.attackName, (v) => { s.attackName = v; }),
          select('Range', RANGES, () => s.range, (v) => { s.range = v; }),
          field('Damage (e.g. 3d10+5 phy)', () => s.damage, (v) => { s.damage = v; }),
          field('Description', () => s.description, (v) => { s.description = v; }, { textarea: true, wide: true }),
        ]));
        // adjacency: the other segments (and itself, when there are several of it)
        const adj = el('div', { class: 'chiprow tight cz-adj' }, [el('span', { class: 'prop-k' }, ['Adjacent'])]);
        c.segments.filter((o) => o !== s || Number(s.count) > 1).forEach((o) => {
          const cb = el('input', { type: 'checkbox', checked: (s.adjacent || []).indexOf(o.name) !== -1 || null, 'aria-label': 'adjacent to ' + o.name });
          cb.addEventListener('change', () => {
            s.adjacent = (s.adjacent || []).filter((a) => a !== o.name);
            if (cb.checked) s.adjacent.push(o.name);
            if (o !== s) {                                     // adjacency goes both ways (p.321)
              o.adjacent = (o.adjacent || []).filter((a) => a !== s.name);
              if (cb.checked) o.adjacent.push(s.name);
            }
            touch();
          });
          adj.appendChild(el('label', { class: 'small' }, [cb, ' ' + o.name]));
        });
        card.appendChild(adj);
        card.appendChild(featuresEditor(c, s.features, 'This segment\'s features'));
        card.appendChild(el('div', { class: 'chiprow tight' }, [
          i ? button('↑', () => { c.segments.splice(i - 1, 0, c.segments.splice(i, 1)[0]); redraw(); }, 'ghost tiny') : null,
          i < c.segments.length - 1 ? button('↓', () => { c.segments.splice(i + 1, 0, c.segments.splice(i, 1)[0]); redraw(); }, 'ghost tiny') : null,
          button('Duplicate', () => { const d = Object.assign(copy(s), { key: uid(), name: s.name + ' 2', pos: null }); c.segments.splice(i + 1, 0, d); redraw(); }, 'ghost tiny'),
          button('Remove segment', () => { c.segments.splice(i, 1); c.segments.forEach((o) => { o.adjacent = (o.adjacent || []).filter((a) => a !== s.name); }); redraw(); }, 'ghost tiny'),
        ]));
        sl.appendChild(card);
      });
      wrap.appendChild(sl);
      wrap.appendChild(el('div', { class: 'chiprow tight' }, [button('+ Segment', () => { c.segments.push(blankSegment('Segment ' + (c.segments.length + 1))); redraw(); }, 'ghost tiny')]));
      wrap.appendChild(live);

      function drawLive() {
        live.innerHTML = '';
        live.appendChild(segmentMap(c, () => { dirty = true; status.textContent = 'unsaved'; }));
        const cs = checks(c);
        live.appendChild(el('div', { class: 'cz-checks' }, cs.length
          ? cs.map((x) => el('div', { class: 'cz-check ' + x.level }, [x.level === 'warn' ? '⚠ ' : 'ℹ ', x.text]))
          : [el('div', { class: 'cz-check ok' }, ['✓ No problems found.'])]));
      }
      drawLive();
      return wrap;

      // ── features: yours, or the book's Example Features ──
      function featuresEditor(cz, list, title) {
        const fb = el('div', { class: 'cz-feats' }, [el('div', { class: 'prop-k' }, [title])]);
        list.forEach((f, i) => {
          const name = el('input', { class: 'text', type: 'text', 'aria-label': 'Feature name', placeholder: 'Feature name' });
          name.value = f.name || '';
          name.addEventListener('input', () => { f.name = name.value; touch(); });
          const type = el('select', { class: 'scope tiny', 'aria-label': 'Feature type' }, TYPES.map((t) => el('option', { value: t, selected: f.type === t || null }, [t])));
          type.addEventListener('change', () => { f.type = type.value; touch(); });
          const text = el('textarea', { class: 'text', rows: Math.min(6, Math.max(2, Math.ceil((f.text || '').length / 90))), 'aria-label': 'Feature text', placeholder: 'What it does' });
          text.value = f.text || '';
          text.addEventListener('input', () => { f.text = text.value; touch(); });
          fb.appendChild(el('div', { class: 'cz-feat' }, [el('div', { class: 'chiprow tight' }, [name, type, button('×', () => { list.splice(i, 1); redraw(); }, 'ghost tiny')]), text]));
        });
        const cat = catalogue(D);
        const pick = el('select', { class: 'scope tiny', 'aria-label': 'A book feature' }, [el('option', { value: '' }, ['+ a book feature (p.321)…'])].concat(cat.map((f) => el('option', { value: f.id, title: D.text(f, 'Description') || '' }, [f.name + ' - ' + (D.text(f, 'Type') || '')]))));
        const vary = el('span', { class: 'chiprow tight' });
        const v = {};
        const note = el('div', { class: 'muted small' });
        pick.addEventListener('change', () => {
          vary.innerHTML = '';
          note.innerHTML = '';
          const f = pick.value && D.entity(pick.value);
          if (!f) return;
          note.appendChild(el('span', {}, [D.text(f, 'Description') || '']));
          (D.guidanceFor(f.id) || []).forEach((g) => note.appendChild(el('div', {}, [el('i', {}, [g.text || ''])])));
          if (f.name === 'Strike (Melee)') { const r = el('select', { class: 'scope tiny', 'aria-label': 'Strike range' }, RANGES.map((x) => el('option', { value: x }, [x]))); r.addEventListener('change', () => { v.range = r.value; }); v.range = 'Melee'; vary.appendChild(r); }
          if (f.name === 'Climbing (+3)') { const n = el('input', { class: 'text num', type: 'number', value: '3', 'aria-label': 'Climbing number' }); n.addEventListener('input', () => { v.climb = n.value; }); v.climb = 3; vary.appendChild(n); }
          if (f.name === 'Chain') { const n = el('input', { class: 'text', type: 'text', placeholder: 'A', size: 3, 'aria-label': 'Chain letter' }); n.addEventListener('input', () => { v.chain = n.value.trim(); }); vary.appendChild(n); }
        });
        fb.appendChild(el('div', { class: 'chiprow tight' }, [pick, vary,
          button('Add', () => { const f = pick.value && D.entity(pick.value); if (!f) return; list.push(fromBook(D, f, cz.name, v)); redraw(); }, 'ghost tiny'),
          button('+ Your own', () => { list.push({ name: '', type: 'Passive', text: '' }); redraw(); }, 'ghost tiny')]));
        fb.appendChild(note);
        return fb;
      }
    }
  }

  // ── the segment map (p.323's notecards): drag a card to arrange it ─
  function segmentMap(c, moved) {
    const NS = 'http://www.w3.org/2000/svg';
    const segs = c.segments || [];
    const W = 640;
    const H = Math.max(260, 120 + Math.ceil(segs.length / 4) * 90);
    const CW = 130;
    const CH = 48;
    segs.forEach((s, i) => {
      if (s.pos) return;
      const a = (2 * Math.PI * i) / Math.max(1, segs.length) - Math.PI / 2;
      s.pos = segs.length === 1 ? { x: W / 2, y: H / 2 } : { x: Math.round(W / 2 + Math.cos(a) * (W / 2 - CW / 2 - 10)), y: Math.round(H / 2 + Math.sin(a) * (H / 2 - CH / 2 - 10)) };
    });
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'cz-map');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Segment map: ' + segs.map((s) => s.name + (s.adjacent && s.adjacent.length ? ' (adjacent to ' + s.adjacent.join(', ') + ')' : '')).join('; '));
    const mk = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k])); if (text != null) n.textContent = text; return n; };
    const lines = mk('g', {});
    const cards = mk('g', {});
    svg.appendChild(lines);
    svg.appendChild(cards);
    function drawLines() {
      lines.innerHTML = '';
      const done = {};
      segs.forEach((s) => (s.adjacent || []).forEach((a) => {
        const t = segs.find((x) => x.name === a);
        if (!t || t === s) return;
        const k = [s.key, t.key].sort().join('|');
        if (done[k]) return;
        done[k] = 1;
        const both = (t.adjacent || []).indexOf(s.name) !== -1;
        lines.appendChild(mk('line', { x1: s.pos.x, y1: s.pos.y, x2: t.pos.x, y2: t.pos.y, class: both ? 'cz-edge' : 'cz-edge oneway' }));
      }));
    }
    segs.forEach((s) => {
      const g = mk('g', { class: 'cz-card', transform: 'translate(' + (s.pos.x - CW / 2) + ',' + (s.pos.y - CH / 2) + ')', tabindex: '0' });
      g.appendChild(mk('rect', { width: CW, height: CH, rx: 6 }));
      g.appendChild(mk('text', { x: CW / 2, y: 19, class: 'cz-name' }, s.name + (Number(s.count) > 1 ? ' ×' + s.count : '')));
      const hp = toNum(s.hp) == null ? 'HP None' : 'HP ' + s.hp;
      const tags = ['Fatal', 'Chain', 'Weak Point', 'Invulnerable'].filter((t) => has(s.features, new RegExp('^' + t)));
      g.appendChild(mk('text', { x: CW / 2, y: 36, class: 'cz-sub' }, 'Diff ' + (s.difficulty === '' ? '—' : s.difficulty) + ' · ' + hp + (tags.length ? ' · ' + tags.join(', ') : '')));
      let drag = null;
      g.addEventListener('pointerdown', (ev) => {
        const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        drag = { dx: p.x - s.pos.x, dy: p.y - s.pos.y };
        g.setPointerCapture(ev.pointerId);
      });
      g.addEventListener('pointermove', (ev) => {
        if (!drag) return;
        const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        s.pos = { x: Math.max(CW / 2, Math.min(W - CW / 2, Math.round(p.x - drag.dx))), y: Math.max(CH / 2, Math.min(H - CH / 2, Math.round(p.y - drag.dy))) };
        g.setAttribute('transform', 'translate(' + (s.pos.x - CW / 2) + ',' + (s.pos.y - CH / 2) + ')');
        drawLines();
      });
      g.addEventListener('pointerup', () => { if (drag) { drag = null; moved(); } });
      cards.appendChild(g);
    });
    drawLines();
    return svg;
  }

  return { BOOK, LABEL, toData, toDSL, checks, fromEntity, fromBook, catalogue, section, blank, shortName };
})();
