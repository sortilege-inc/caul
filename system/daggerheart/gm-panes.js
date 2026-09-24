// system/daggerheart/gm-panes.js — the GM's own panes (the family standard, PLAYBOOK §4b.2, on
// sortilege-vtt-l5r5e I19): Scenes (the campaign's arc — sessions, a card per scene with its beats
// and its cast, the questions for the table), Threads (with what happened to each in play),
// Encounters (the book's Battle Points), People (whom a note is about), and the Notes document an
// instance may name. Overview (premise, rulings, free notes, a search), Places and Settings are the
// engine's (engine/gm-panes.js), which registers only what this file does not. Everything here is the
// GM's own pack state (ops.js: gm, gmNotes, arc, threads, encounters — local ops, never sent to a
// session's room); the text is the GM's small Markdown with its SET / OPEN / SOURCE … tags
// (engine/gm-text.js). A frame prints no scene list, so the arc is the table's scenes (table.js): one
// is running, and the table, the Cast pane and the player's page follow it.
//
//   BATTLE_POINTS "When planning a battle, start with the following formula to calculate how many
//                 Battle Points you should spend: (3 × the number of PCs in combat) + 2"
//                 (adversaries.lore, Building Balanced Encounters)
(function () {
  const { el, button, debounce } = window.VttRender;
  const D = window.DHData;
  const E = window.DHEntity;
  const State = window.VttState;
  const G = window.VttGmText;
  const Bus = window.VttBus;
  const Panels = window.VttPanels;
  const Sys = () => window.VttSystem;
  const S = () => State.state;
  const CFG = window.VttConfig || {};
  const F = D.f;

  // The GM nav, in sections (engine/app.js buildNav draws a divider between groups; a pane left out of
  // every group is off the nav). Cast is out — its "browse every adversary and environment" is already
  // in Encounters and a scene's cast; Notes is the instance's call (VttConfig.hidePanes). An instance
  // may override the whole thing with VttConfig.navGroups.
  window.VttNav = window.VttNav || CFG.navGroups || [
    { ids: ['inspector', 'party'] },
    { ids: ['frame', 'campaign', 'scenes', 'threads'] },
    { ids: ['overview', 'people', 'places'] },
    { ids: ['fear', 'encounters', 'rules', 'dice', 'log'] },
    { ids: ['settings'] },
  ];
  const editing = (c) => document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName) && c.contains(document.activeElement);
  const newId = (p) => State.genId(p);
  const openEntity = (id) => window.DHOpenEntity && window.DHOpenEntity(id);
  const BATTLE_POINTS = (pcs) => 3 * pcs + 2;
  // who can stand in a scene or be the subject of a note: the books' adversaries and environments
  const castable = () => D.recordsOf('Adversary').concat(D.recordsOf('Environment'));

  const redrawOn = (ctx, container, draw) => {
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    ctx.on('gm:reveal', draw);
  };

  // ── Notes: an authored document the instance names (VttConfig.notes), and free notes ──
  let docCache = null;
  let gatePassed = false;
  function renderNotes(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const n = CFG.notes || null;
      if (n && n.src && n.gate && !gatePassed) {
        container.appendChild(el('h4', {}, [n.title || 'Notes']));
        container.appendChild(el('div', { class: 'paper notes-gate' }, [
          n.gate.title ? el('div', { class: 'notes-gate-title' }, [n.gate.title]) : null,
          n.gate.text ? el('p', {}, [n.gate.text]) : null,
          button(n.gate.enter || 'Show', () => { gatePassed = true; draw(); }, 'tiny'),
        ]));
      } else if (n && n.src) {
        const box = el('div', { class: 'paper notes-doc' + (n.class ? ' ' + n.class : '') }, [el('div', { class: 'muted loading' }, ['Reading ' + (n.title || n.src) + '…'])]);
        container.appendChild(el('h4', {}, [n.title || 'Notes']));
        container.appendChild(box);
        const show = (text) => { box.innerHTML = ''; if (/\.html?$/.test(n.src)) box.innerHTML = text; else box.appendChild(E.markdown(text, 'core')); };
        if (docCache != null) show(docCache);
        else fetch(n.src).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status)))).then((t) => { docCache = t; show(t); })
          .catch((e) => { box.innerHTML = ''; box.appendChild(el('div', { class: 'empty' }, ['Could not read ' + n.src + ' (' + e.message + ').'])); });
      }
      container.appendChild(el('h4', {}, ['Free notes', el('span', { class: 'muted small' }, [' · saved with the pack, never sent to players'])]));
      container.appendChild(el('textarea', { class: 'text notes-free', rows: 10, placeholder: 'Jot as you play…', 'aria-label': 'Free notes', oninput: debounce((ev) => State.commit('setGmNotes', [ev.target.value]), 400) }, [S().gmNotes || '']));
    };
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    draw();
  }

  // ── Scenes: the campaign's arc, its beats, its encounters ──────────
  // arc  = [scene]; scene = { id, title, session, summary, text, played, collapsed, beats:[beat] }
  // beat = { id, kind:'note'|'encounter', title, text, collapsed, npcs:[{id,count}] (encounter only) }
  // Sessions group the scenes; one scene is running (the engine's `current`). A beat is a part of a
  // scene the GM can reorder, collapse, or drag into another scene; an Encounter beat plans a fight
  // (its adversaries, the Battle Points) and, when put on the table, becomes tracked instances in the
  // scene's cast. Legacy scenes carried their beats as `sections`; beatsOf migrates them and a save
  // writes `beats`. The arc is the GM's own pack state (op setArc), never sent to a session's room.
  const arc = () => JSON.parse(JSON.stringify(S().arc || []));
  const setArc = (list) => State.commit('setArc', [list]);
  const sessionOpen = {};
  function beatsOf(scene) {
    if (Array.isArray(scene.beats)) return scene.beats;
    return (scene.sections || []).map((s) => ({ id: s.id || newId('beat'), kind: 'note', title: s.title || '', text: s.text || '' }));
  }
  function writeArc(list) {
    list.forEach((sc) => { sc.beats = beatsOf(sc).map((b) => Object.assign({ kind: 'note' }, b)); delete sc.sections; });
    setArc(list);
  }
  function mutate(fn) { const l = arc(); fn(l); writeArc(l); }
  const sceneAt = (l, id) => l.find((s) => s.id === id);
  function run(id) {
    State.commit('setCurrentScene', [Sys().moduleId(), id]);
    Bus.emit('scene:changed', { moduleId: Sys().moduleId(), sceneId: id });
  }

  // ── drag and drop: reorder scenes; reorder beats and move them between scenes ──
  // `dragging` is what is in hand; a drop target inserts it before itself (moveScene / moveBeat).
  let dragging = null;   // { kind:'scene', id } | { kind:'beat', sceneId, beatId }
  function dragStart(payload) {
    return (ev) => { dragging = payload; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', payload.kind); } catch (e) { /* firefox needs the try */ } ev.stopPropagation(); };
  }
  function dropZone(node, accept, onDrop) {
    node.addEventListener('dragover', (ev) => { if (dragging && dragging.kind === accept) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; node.classList.add('drag-over'); } });
    node.addEventListener('dragleave', () => node.classList.remove('drag-over'));
    node.addEventListener('drop', (ev) => { node.classList.remove('drag-over'); if (dragging && dragging.kind === accept) { ev.preventDefault(); ev.stopPropagation(); const d = dragging; dragging = null; onDrop(d); } });
    return node;
  }
  function moveScene(dragId, beforeId) {
    mutate((l) => {
      const from = l.findIndex((s) => s.id === dragId); if (from < 0) return;
      const before = beforeId ? sceneAt(l, beforeId) : null;
      const session = before ? before.session : (l.length ? l[l.length - 1].session : undefined);
      const sc = l.splice(from, 1)[0];
      sc.session = session;                                    // adopt the session it lands in
      let to = beforeId ? l.findIndex((s) => s.id === beforeId) : l.length;
      if (to < 0) to = l.length;
      l.splice(to, 0, sc);
    });
  }
  function moveBeat(from, toSceneId, beforeBeatId) {
    mutate((l) => {
      const src = sceneAt(l, from.sceneId); if (!src) return;
      src.beats = beatsOf(src);
      const bi = src.beats.findIndex((b) => b.id === from.beatId); if (bi < 0) return;
      const beat = src.beats.splice(bi, 1)[0];
      const dst = sceneAt(l, toSceneId) || src;
      dst.beats = beatsOf(dst);
      let at = beforeBeatId ? dst.beats.findIndex((b) => b.id === beforeBeatId) : dst.beats.length;
      if (at < 0) at = dst.beats.length;
      dst.beats.splice(at, 0, beat);
    });
  }

  // ── an Encounter beat on the table: its adversaries become instances the GM tracks one by one ──
  const nameOf = (id) => { const r = D.record(id); return r ? r.name : id; };
  function putOnTable(sceneId, npcs) {
    const cur = Sys().castRaw(sceneId);
    npcs.forEach((n) => { for (let k = 1; k <= n.count; k++) cur.push({ iid: newId('inst'), id: n.id, label: n.count > 1 ? nameOf(n.id) + ' ' + k : nameOf(n.id) }); });
    State.commit('setSceneCast', [sceneId, cur]);
  }
  // a compact per-instance tracker: its name, its HP and Stress marks (GM-only npcState, keyed by iid)
  function instTracker(sceneId, c, e) {
    const st = Object.assign({ hp: 0, stress: 0 }, (S().npcState || {})[c.iid] || {});
    const hp = D.num(e, 'Hit Points') || 0;
    const stress = D.num(e, 'Stress') || 0;
    const setSt = (p) => State.commit('setNpcState', [c.iid, Object.assign({}, st, p)]);
    const setLabel = (v) => { const raw = Sys().castRaw(sceneId).map((x) => (typeof x === 'string' ? { iid: x, id: x } : x)); const it = raw.find((x) => x.iid === c.iid); if (it) { it.label = v.trim() || undefined; State.commit('setSceneCast', [sceneId, raw]); } };
    const mark = (label, key, max) => el('span', { class: 'inst-track' }, [
      el('span', { class: 'prop-k' }, [label]),
      button('−', () => setSt({ [key]: Math.max(0, (st[key] || 0) - 1) }), 'ghost tiny'),
      el('b', { class: 'num' }, [(st[key] || 0) + '/' + max]),
      button('+', () => setSt({ [key]: Math.min(max, (st[key] || 0) + 1) }), 'ghost tiny'),
    ]);
    return el('div', { class: 'inst-row' + ((st.hp || 0) >= hp && hp ? ' down' : '') }, [
      el('input', { class: 'text inst-label', type: 'text', value: c.label || nameOf(c.id), 'aria-label': 'This one’s name', onchange: (ev) => setLabel(ev.target.value) }),
      hp ? mark('HP', 'hp', hp) : null,
      stress ? mark('Stress', 'stress', stress) : null,
      button('Open', () => Panels.select({ kind: 'entity', id: c.id, iid: c.iid, label: c.label || nameOf(c.id) }), 'ghost tiny'),
      button('Remove', () => State.commit('setSceneCast', [sceneId, Sys().castRaw(sceneId).filter((x) => (typeof x === 'string' ? x : x.iid) !== c.iid)]), 'ghost tiny'),
    ]);
  }
  // a scene's or a beat's notes: the GM's Markdown shown rendered (tags, lists, bold) to read at the
  // table; Edit swaps in a textarea sized to the text, saved when the GM leaves it
  function noteField(text, save, placeholder) {
    const box = el('div', { class: 'note-field' });
    const show = () => {
      box.innerHTML = '';
      box.appendChild(text ? G.render(text) : el('div', { class: 'muted small' }, [placeholder]));
      box.appendChild(button(text ? 'Edit' : '+ ' + placeholder, edit, 'ghost tiny note-edit'));
    };
    const edit = () => {
      box.innerHTML = '';
      const t = text || '';
      const ta = el('textarea', { class: 'text note-area', rows: Math.min(28, Math.max(3, t.split('\n').length + Math.ceil(t.length / 110))), 'aria-label': placeholder }, [t]);
      ta.addEventListener('blur', () => { const v = ta.value.replace(/\s+$/, ''); if (v !== t) { text = v; save(v); } else show(); });
      box.appendChild(ta);
      ta.focus();
    };
    show();
    return box;
  }
  const editScene = (id, patch) => mutate((l) => { const s = sceneAt(l, id); if (s) Object.assign(s, patch); });
  const editBeat = (sid, bid, patch) => mutate((l) => { const s = sceneAt(l, sid); if (!s) return; s.beats = beatsOf(s); const b = s.beats.find((x) => x.id === bid); if (b) Object.assign(b, patch); });

  // the scene's cast, as instances: a chip each, and a search that adds one more
  function castRow(sceneId, redraw) {
    const here = Sys().castEntries(sceneId);
    const hits = el('div', { class: 'gm-cast-hits' });
    const find = el('input', { type: 'search', class: 'text', placeholder: '+ an adversary or environment', 'aria-label': 'Put someone in this scene' });
    find.addEventListener('input', debounce(() => {
      const q = find.value.trim().toLowerCase();
      hits.innerHTML = '';
      if (q.length < 2) return;
      castable().filter((r) => r.name.toLowerCase().indexOf(q) !== -1).slice(0, 8)
        .forEach((r) => hits.appendChild(button('+ ' + r.name + ' · ' + r.type + ' · ' + D.label(r.book), () => { putOnTable(sceneId, [{ id: r.id, count: 1 }]); redraw(); }, 'ghost tiny')));
    }, 150));
    return el('div', { class: 'gm-cast' }, [
      el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['In it'])].concat(here.map((c) => el('span', { class: 'chip' }, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: c.id, iid: c.iid, label: Sys().instLabel(c) }) }, [Sys().instLabel(c)]),
        el('button', { class: 'ref tiny', type: 'button', title: 'take out', 'aria-label': 'Take out', onclick: () => State.commit('setSceneCast', [sceneId, Sys().castRaw(sceneId).filter((y) => (typeof y === 'string' ? y : y.iid) !== c.iid)]) }, ['×']),
      ]))).concat([find])),
      hits,
    ]);
  }

  // an Encounter beat's body: the plan (its adversaries + Battle Points), and — once the fight is on the
  // table — a tracker per copy with the shared moves printed once below.
  function encounterBeat(scene, beat, redraw) {
    const pcs = (S().party || []).length;
    const npcs = (beat.npcs || []).slice();
    const box = el('div', { class: 'enc-beat' });
    npcs.forEach((n, i) => {
      const r = D.record(n.id);
      box.appendChild(el('div', { class: 'chiprow tight enc-row' }, [
        el('button', { class: 'ref', type: 'button', onclick: () => openEntity(n.id) }, [r ? r.name : n.id]),
        el('span', { class: 'muted small' }, [(r ? 'Tier ' + F(r, 'Tier') + ' ' + (F(r, 'Role') || '') : '') + ' ×']),
        button('−', () => { const b = npcs.map((x) => Object.assign({}, x)); b[i].count = Math.max(0, b[i].count - 1); if (!b[i].count) b.splice(i, 1); editBeat(scene.id, beat.id, { npcs: b }); }, 'ghost tiny'),
        el('b', { class: 'num' }, [String(n.count)]),
        button('+', () => { const b = npcs.map((x) => Object.assign({}, x)); b[i].count += 1; editBeat(scene.id, beat.id, { npcs: b }); }, 'ghost tiny'),
      ]));
    });
    if (npcs.length) { const sp = spend(npcs.filter((n) => n.count > 0), pcs); box.appendChild(el('div', { class: 'enc-sum small' }, [el('b', {}, ['Battle Points spent ' + sp.pts]), sp.lines.length ? el('span', { class: 'muted' }, [' · ' + sp.lines.join(' · ')]) : null])); }
    const hits = el('div');
    const search = el('input', { type: 'search', class: 'text', placeholder: 'Add an adversary…', 'aria-label': 'Add an adversary to this encounter' });
    search.addEventListener('input', debounce(() => {
      const q = search.value.trim().toLowerCase();
      hits.innerHTML = '';
      if (q.length < 2) return;
      D.recordsOf('Adversary').filter((r) => r.name.toLowerCase().indexOf(q) !== -1).slice(0, 10).forEach((r) => hits.appendChild(button('+ ' + r.name + ' · Tier ' + F(r, 'Tier') + ' ' + (F(r, 'Role') || ''), () => {
        const b = npcs.map((x) => Object.assign({}, x)); const f = b.find((x) => x.id === r.id); if (f) f.count += 1; else b.push({ id: r.id, count: 1 }); editBeat(scene.id, beat.id, { npcs: b });
      }, 'ghost tiny')));
    }, 150));
    box.appendChild(search);
    box.appendChild(hits);
    if (npcs.some((n) => n.count > 0)) box.appendChild(el('div', { class: 'chiprow tight' }, [button('Put on the table', () => { putOnTable(scene.id, npcs.filter((n) => n.count > 0)); run(scene.id); redraw(); }, 'tiny')]));
    // the trackers: instances of this beat's adversaries now in the scene's cast, grouped by adversary
    const ids = {}; npcs.forEach((n) => (ids[n.id] = 1));
    const insts = Sys().castEntries(scene.id).filter((c) => ids[c.id]);
    if (insts.length) {
      const byId = {};
      insts.forEach((c) => { (byId[c.id] = byId[c.id] || []).push(c); });
      Object.keys(byId).forEach((id) => {
        const e = D.entity(id) || D.record(id);
        const grp = el('div', { class: 'enc-group' }, [el('div', { class: 'prop-k' }, [(e ? e.name : id) + ' · ' + byId[id].length + (byId[id].length === 1 ? ' on the table' : ' on the table')])]);
        byId[id].forEach((c) => grp.appendChild(instTracker(scene.id, c, e)));
        if (e) grp.appendChild(el('details', { class: 'enc-detail' }, [el('summary', { class: 'muted small' }, ['Moves & details · shared']), el('div', { class: 'paper' }, [E.render(e)])]));
        box.appendChild(grp);
      });
    }
    return box;
  }

  // one beat: a draggable, collapsible row; an Encounter beat carries its fight
  function beatRow(scene, beat, redraw) {
    const collapsed = !!beat.collapsed;
    const handle = el('span', { class: 'drag-handle', title: 'Drag to move this beat', draggable: 'true', 'aria-hidden': 'true' }, ['∷']);
    handle.addEventListener('dragstart', dragStart({ kind: 'beat', sceneId: scene.id, beatId: beat.id }));
    const head = el('div', { class: 'beat-head' }, [
      handle,
      el('button', { class: 'gm-caret', type: 'button', 'aria-label': collapsed ? 'Expand beat' : 'Collapse beat', onclick: () => editBeat(scene.id, beat.id, { collapsed: !collapsed }) }, [collapsed ? '▸' : '▾']),
      el('span', { class: 'beat-kind ' + beat.kind }, [beat.kind === 'encounter' ? 'Encounter' : 'Beat']),
      el('input', { class: 'text beat-title', type: 'text', value: beat.title || '', placeholder: beat.kind === 'encounter' ? 'Name this encounter' : 'Name this beat', 'aria-label': 'Beat title', oninput: debounce((ev) => editBeat(scene.id, beat.id, { title: ev.target.value }), 300) }),
      button('×', () => { if (confirm('Remove this beat?')) mutate((l) => { const s = sceneAt(l, scene.id); if (s) s.beats = beatsOf(s).filter((b) => b.id !== beat.id); }); }, 'ghost tiny'),
    ]);
    const row = el('div', { class: 'beat kind-' + beat.kind + (collapsed ? ' collapsed' : ''), 'data-beat': beat.id }, [head]);
    dropZone(row, 'beat', (d) => moveBeat(d, scene.id, beat.id));
    if (!collapsed) {
      row.appendChild(noteField(beat.text, (v) => editBeat(scene.id, beat.id, { text: v }), 'notes'));
      if (beat.kind === 'encounter') row.appendChild(encounterBeat(scene, beat, redraw));
    }
    return row;
  }

  // one scene: a draggable, collapsible card of beats, its cast, and its controls
  function sceneCard(scene, cur, redraw) {
    const collapsed = !!scene.collapsed;
    const handle = el('span', { class: 'drag-handle', title: 'Drag to reorder', draggable: 'true', 'aria-hidden': 'true' }, ['∷']);
    handle.addEventListener('dragstart', dragStart({ kind: 'scene', id: scene.id }));
    const card = el('section', { class: 'arc-card' + (scene.played ? ' played' : '') + (cur === scene.id ? ' running' : '') + (collapsed ? ' collapsed' : ''), 'data-scene': scene.id }, [
      el('div', { class: 'arc-head' }, [
        handle,
        el('button', { class: 'gm-caret', type: 'button', 'aria-label': collapsed ? 'Expand scene' : 'Collapse scene', onclick: () => editScene(scene.id, { collapsed: !collapsed }) }, [collapsed ? '▸' : '▾']),
        el('input', { class: 'text arc-title', type: 'text', value: scene.title || '', placeholder: 'Scene', 'aria-label': 'Scene title', oninput: debounce((ev) => editScene(scene.id, { title: ev.target.value }), 300) }),
        el('span', { class: 'arc-badges' }, [cur === scene.id ? el('span', { class: 'chip on' }, ['Running']) : null, scene.played ? el('span', { class: 'chip' }, ['Played']) : null]),
      ]),
    ]);
    dropZone(card, 'scene', (d) => moveScene(d.id, scene.id));
    if (collapsed) { if (scene.summary) card.appendChild(el('p', { class: 'arc-summary muted small' }, [scene.summary])); return card; }
    card.appendChild(el('input', { class: 'text', type: 'text', value: scene.summary || '', placeholder: 'One line: what the scene is', 'aria-label': 'Summary', oninput: debounce((ev) => editScene(scene.id, { summary: ev.target.value.trim() || undefined }), 300) }));
    card.appendChild(el('input', { class: 'text', type: 'text', value: scene.session || '', placeholder: 'Session (groups the scenes)', 'aria-label': 'Session', oninput: debounce((ev) => editScene(scene.id, { session: ev.target.value.trim() || undefined }), 400) }));
    card.appendChild(noteField(scene.text, (v) => editScene(scene.id, { text: v }), 'scene notes'));
    const beatBox = el('div', { class: 'beats' });
    beatsOf(scene).forEach((b) => beatBox.appendChild(beatRow(scene, b, redraw)));
    beatBox.appendChild(dropZone(el('div', { class: 'beat-drop', 'aria-hidden': 'true' }, []), 'beat', (d) => moveBeat(d, scene.id, null)));
    card.appendChild(beatBox);
    card.appendChild(el('div', { class: 'chiprow tight' }, [
      button('+ Beat', () => mutate((l) => { const s = sceneAt(l, scene.id); if (s) s.beats = beatsOf(s).concat([{ id: newId('beat'), kind: 'note', title: '', text: '' }]); }), 'ghost tiny'),
      button('+ Encounter', () => mutate((l) => { const s = sceneAt(l, scene.id); if (s) s.beats = beatsOf(s).concat([{ id: newId('beat'), kind: 'encounter', title: '', text: '', npcs: [] }]); }), 'ghost tiny'),
    ]));
    card.appendChild(el('div', { class: 'chiprow tight arc-actions' }, [
      cur !== scene.id ? button('Run this scene', () => run(scene.id), 'tiny') : null,
      button(scene.played ? 'Not played' : 'Mark played', () => editScene(scene.id, { played: !scene.played }), 'ghost tiny'),
      button('Open on the table', () => { run(scene.id); window.open(CFG.pages.table + '?scene=' + encodeURIComponent(scene.id), (CFG.channel || 'vtt') + '-table'); }, 'ghost tiny'),
      button('Remove', () => { if (confirm('Remove “' + (scene.title || 'this scene') + '”?')) mutate((l) => { const at = l.findIndex((s) => s.id === scene.id); if (at >= 0) l.splice(at, 1); }); }, 'ghost tiny'),
    ]));
    card.appendChild(castRow(scene.id, redraw));
    return card;
  }
  function renderScenes(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const list = arc();
      const cur = Sys().currentSceneId();
      const played = list.filter((x) => x.played).length;
      container.appendChild(el('h4', {}, ['The arc', el('span', { class: 'muted small' }, [' · ' + list.length + (list.length === 1 ? ' scene, ' : ' scenes, ') + played + ' played'])]));
      if (!list.length) container.appendChild(el('div', { class: 'empty' }, ['No scenes yet — add the first below.']));
      // sessions group consecutive scenes; each group folds, and its scenes are draggable cards
      const groups = [];
      list.forEach((x) => { const g = groups[groups.length - 1]; if (g && g.name === (x.session || null)) g.items.push(x); else groups.push({ name: x.session || null, items: [x] }); });
      groups.forEach((g) => {
        const key = g.name || '';
        const allPlayed = g.items.every((x) => x.played);
        const isOpen = sessionOpen[key] != null ? sessionOpen[key] : !allPlayed;
        container.appendChild(el('button', { class: 'arc-session' + (allPlayed ? ' played' : ''), type: 'button', 'aria-expanded': isOpen ? 'true' : 'false', onclick: () => { sessionOpen[key] = !isOpen; draw(); } }, [
          el('span', { class: 'gm-caret', 'aria-hidden': 'true' }, [isOpen ? '▾' : '▸']), ' ', g.name || 'Scenes',
          el('span', { class: 'muted small' }, [' · ' + g.items.length + (g.items.length === 1 ? ' scene' : ' scenes') + (allPlayed ? ', played' : '')]),
        ]));
        if (!isOpen) return;
        const wrap = el('div', { class: 'arc-scenes' });
        g.items.forEach((x) => wrap.appendChild(sceneCard(x, cur, draw)));
        container.appendChild(wrap);
      });
      // a new scene joins the last session unless named otherwise
      const last = list.length ? list[list.length - 1].session : undefined;
      const t = el('input', { class: 'text', type: 'text', placeholder: 'Add a scene…', 'aria-label': 'New scene' });
      container.appendChild(el('div', { class: 'chiprow tight gm-add' }, [t, button('Add', () => {
        if (!t.value.trim()) return;
        mutate((l) => l.push({ id: newId('arc'), title: t.value.trim(), session: last, text: '', played: false, beats: [] }));
      }, 'tiny')]));
      // the questions to put to the players, asked or not
      const qs = Object.assign({ note: '', items: [] }, (S().gm || {}).questions || {});
      const setQs = (patch) => State.commit('setGm', ['questions', Object.assign({}, qs, patch)]);
      container.appendChild(el('h4', { 'data-gm-id': 'questions' }, ['Questions for the table', el('span', { class: 'muted small' }, [' · ' + qs.items.filter((x) => !x.asked).length + ' not yet asked'])]));
      container.appendChild(G.note(() => qs.note, (v) => setQs({ note: v }), 'Add a note on the questions', draw));
      container.appendChild(el('ul', { class: 'gm-questions' }, qs.items.map((x, i) => el('li', { class: x.asked ? 'asked' : '', 'data-gm-id': x.id }, [
        el('input', { type: 'checkbox', checked: x.asked || null, title: 'Asked', 'aria-label': 'Asked', onchange: (ev) => { const l = qs.items.slice(); l[i] = Object.assign({}, x, { asked: ev.target.checked }); setQs({ items: l }); } }),
        el('span', { class: 'gm-q', html: G.inline(x.text || '') }),
        button('×', () => { if (confirm('Remove this question?')) setQs({ items: qs.items.filter((_, j) => j !== i) }); }, 'ghost tiny'),
      ]))));
      const nq = el('input', { class: 'text', type: 'text', placeholder: 'Add a question…', 'aria-label': 'New question' });
      container.appendChild(el('div', { class: 'chiprow tight gm-add' }, [nq, button('Add', () => { if (nq.value.trim()) setQs({ items: qs.items.concat([{ id: newId('q'), text: nq.value.trim(), asked: false }]) }); }, 'tiny')]));
      G.reveal(container);
    };
    redrawOn(ctx, container, draw);
    ctx.on('scene:changed', draw);
    draw();
  }

  // ── Threads: what is in play, and what is held in reserve ───────────
  // threads = [{ id, title, text, sections, open, notes }] — notes are what happened to it in play
  const threads = () => JSON.parse(JSON.stringify(S().threads || []));
  const setThreads = (l) => State.commit('setThreads', [l]);
  function renderThreads(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const ts = threads();
      container.appendChild(el('h4', { 'data-gm-id': 'threads-note' }, ['Threads', el('span', { class: 'muted small' }, [' · ' + ts.filter((x) => x.open !== false).length + ' open, ' + ts.filter((x) => x.open === false).length + ' closed'])]));
      container.appendChild(G.note(() => (S().gm || {}).threadsNote, (v) => State.commit('setGm', ['threadsNote', v]), 'Add a note on the threads', draw));
      const upd = (x, patch) => { const l = threads(); const at = l.findIndex((y) => y.id === x.id); l[at] = Object.assign({}, l[at], patch); setThreads(l); };
      G.sections(container, ts, {
        redraw: draw, save: setThreads, addLabel: 'Open a thread…', fresh: () => ({ open: true }),
        cls: (x) => 'thread' + (x.open === false ? ' closed' : ''),
        badges: (x) => (x.open === false ? el('span', { class: 'chip' }, ['Closed']) : null),
        after: (x) => el('div', { class: 'thread-notes' }, [
          el('div', { class: 'prop-k' }, ['In play']),
          el('textarea', { class: 'text', rows: 2, placeholder: 'What has happened to it at the table…', 'aria-label': 'In play', oninput: debounce((ev) => upd(x, { notes: ev.target.value }), 400) }, [x.notes || '']),
        ]),
        actions: (x) => button(x.open === false ? 'Reopen' : 'Close', () => upd(x, { open: x.open === false }), 'ghost tiny'),
      });
      G.reveal(container);
    };
    redrawOn(ctx, container, draw);
    draw();
  }

  // ── Encounters: Battle Points ──────────────────────────────────────
  const encounters = () => JSON.parse(JSON.stringify(S().encounters || []));
  const setEncounters = (l) => State.commit('setEncounters', [l]);
  // an adversary's role as its type's name: "Horde (10/HP)" → Horde
  const roleOf = (r) => String(F(r, 'Role') || '').replace(/\s*\(.*$/, '');
  function typeCost(role) {
    const t = D.byType('Adversary Type').find((x) => x.name === role);
    return t ? { cost: D.num(t, 'Battle Point Cost'), rule: D.text(t, 'Battle Point Rule') } : null;
  }
  // Minions: "Spend 1 point for each group of Minions equal to the size of the party."
  function spend(npcs, pcs) {
    let pts = 0;
    const lines = [];
    const minions = npcs.filter((n) => roleOf(D.record(n.id) || {}) === 'Minion').reduce((a, n) => a + n.count, 0);
    npcs.forEach((n) => {
      const r = D.record(n.id);
      const role = roleOf(r || {});
      if (role === 'Minion') return;
      const c = typeCost(role);
      if (c && c.cost != null) { pts += c.cost * n.count; lines.push(n.count + ' × ' + (r ? r.name : n.id) + ' (' + role + ' ' + c.cost + ')'); }
      else lines.push((r ? r.name : n.id) + ': no Battle Point cost printed for ' + (role || 'its role'));
    });
    if (minions) { const groups = Math.ceil(minions / Math.max(1, pcs)); const c = typeCost('Minion'); pts += groups * ((c && c.cost) || 1); lines.push(minions + ' Minions = ' + groups + ' group' + (groups === 1 ? '' : 's') + ' of ' + pcs); }
    return { pts, lines };
  }
  let draft = { name: '', npcs: [], adjust: [] };   // npcs [{ id, count }], adjust [adjustment ids]
  function renderEncounters(container, ctx) {
    let q = '';
    const draw = () => {
      container.innerHTML = '';
      const pcs = (S().party || []).length;
      const adjs = D.byType('Battle Point Adjustment');
      const base = BATTLE_POINTS(pcs);
      const adj = adjs.filter((a) => draft.adjust.indexOf(a.id) !== -1).reduce((s, a) => s + (D.num(a, 'Points') || 0), 0);
      const sp = spend(draft.npcs, pcs);
      const budget = base + adj;
      container.appendChild(el('h4', {}, ['Encounter']));
      container.appendChild(el('div', { class: 'enc-sum' }, [
        el('div', {}, [el('b', {}, ['Battle Points ' + budget]), el('span', { class: 'muted small' }, [' = (3 × ' + pcs + ' PCs) + 2' + (adj ? (adj > 0 ? ' + ' : ' − ') + Math.abs(adj) : '')]), ' · ', el('b', {}, ['spent ' + sp.pts]), ' · ', el('b', { class: budget - sp.pts < 0 ? 'over' : '' }, [(budget - sp.pts) + ' left'])]),
        sp.lines.length ? el('div', { class: 'muted small' }, [sp.lines.join(' · ')]) : null,
      ]));
      container.appendChild(el('div', { class: 'adjusts' }, adjs.map((a) => el('label', { class: 'small', title: D.text(a, 'Description') || '' }, [
        el('input', { type: 'checkbox', 'aria-label': a.name, checked: draft.adjust.indexOf(a.id) !== -1 || null, onchange: (ev) => { draft.adjust = ev.target.checked ? draft.adjust.concat([a.id]) : draft.adjust.filter((x) => x !== a.id); draw(); } }), ' ', a.name,
      ]))));
      const name = el('input', { class: 'text', type: 'text', value: draft.name, placeholder: 'name it to save it', 'aria-label': 'Encounter name', oninput: (ev) => { draft.name = ev.target.value; } });
      container.appendChild(el('div', { class: 'chiprow tight' }, [name]));
      draft.npcs.forEach((n, i) => {
        const r = D.record(n.id);
        container.appendChild(el('div', { class: 'chiprow tight enc-row' }, [
          el('button', { class: 'ref', type: 'button', onclick: () => openEntity(n.id) }, [r ? r.name : n.id]),
          el('span', { class: 'muted small' }, [(r ? 'Tier ' + F(r, 'Tier') + ' ' + (F(r, 'Role') || '') : '') + ' ×']),
          button('−', () => { n.count = Math.max(0, n.count - 1); if (!n.count) draft.npcs.splice(i, 1); draw(); }, 'ghost tiny'),
          el('b', { class: 'num' }, [String(n.count)]),
          button('+', () => { n.count++; draw(); }, 'ghost tiny'),
        ]));
      });
      const search = el('input', { type: 'search', class: 'search', placeholder: 'Add an adversary…', value: q, 'aria-label': 'Add an adversary' });
      const hits = el('div');
      const drawHits = () => {
        hits.innerHTML = '';
        if (q.length < 2) return;
        D.recordsOf('Adversary').filter((r) => r.name.toLowerCase().indexOf(q) !== -1).slice(0, 12).forEach((r) => hits.appendChild(el('div', { class: 'small' }, [
          button('+ ' + r.name, () => { const f = draft.npcs.find((x) => x.id === r.id); if (f) f.count++; else draft.npcs.push({ id: r.id, count: 1 }); q = ''; draw(); }, 'ghost tiny'),
          el('span', { class: 'muted' }, [' Tier ' + F(r, 'Tier') + ' · ' + (F(r, 'Role') || '') + ' · ' + D.label(r.book)]),
        ])));
      };
      search.addEventListener('input', debounce(() => { q = search.value.trim().toLowerCase(); drawHits(); }, 150));
      container.appendChild(search);
      container.appendChild(hits);
      drawHits();
      const sid = Sys().currentSceneId();
      const sc = Sys().scene(sid);
      container.appendChild(el('div', { class: 'chiprow tight' }, [
        button('Save encounter', () => { if (!draft.npcs.length) return; const l = encounters(); l.push({ id: newId('enc'), name: draft.name.trim() || ('Encounter ' + (l.length + 1)), npcs: draft.npcs.map((n) => ({ id: n.id, count: n.count })), adjust: draft.adjust.slice() }); setEncounters(l); }, 'tiny'),
        sc && draft.npcs.length ? button('Put in ' + sc.name, () => { putOnTable(sid, draft.npcs.filter((n) => n.count > 0)); }, 'ghost tiny') : null,
        draft.npcs.length ? button('Clear', () => { draft = { name: '', npcs: [], adjust: [] }; draw(); }, 'ghost tiny') : null,
      ]));
      const saved = encounters();
      if (saved.length) container.appendChild(el('ul', { class: 'items' }, saved.map((x, i) => el('li', {}, [
        el('button', { class: 'ref', type: 'button', onclick: () => { draft = { name: x.name, npcs: x.npcs.map((n) => Object.assign({}, n)), adjust: (x.adjust || []).slice() }; draw(); } }, [x.name]),
        el('span', { class: 'muted small' }, [' · ' + x.npcs.reduce((a, n) => a + n.count, 0) + ' adversaries']),
        button('×', () => setEncounters(encounters().filter((_, j) => j !== i)), 'ghost tiny'),
      ]))));
      container.appendChild(el('details', { class: 'small' }, [el('summary', { class: 'muted' }, ['What each role costs']), D.byType('Adversary Type').map((t) => el('div', {}, [el('b', {}, [t.name + ' ' + D.num(t, 'Battle Point Cost')]), ' — ', D.text(t, 'Battle Point Rule') || ''] ))]));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    ctx.on('scene:changed', draw);
    draw();
  }

  // ── People: the campaign's people, and the GM's notes on the characters ─
  // The engine's People pane (engine/gm-panes.js) has no way to say whom a section is about; here each
  // section's editor names them — an adversary or environment from the books, or a character in the
  // party — and the section then shows in the Inspector, the Cast and the Party.
  function aboutField(d, kind) {
    d.about = (d.about || []).slice();
    const box = el('div', { class: 'chiprow tight gm-about-edit' });
    const draw = () => {
      box.innerHTML = '';
      box.appendChild(el('span', { class: 'prop-k' }, ['About']));
      d.about.forEach((k, i) => {
        const r = kind === 'pc' ? null : D.record(k);
        box.appendChild(el('span', { class: 'chip' }, [r ? r.name : k, el('button', { class: 'ref tiny', type: 'button', title: 'remove', onclick: () => { d.about.splice(i, 1); draw(); } }, ['×'])]));
      });
      if (kind === 'pc') {
        const sel = el('select', { class: 'scope tiny', 'aria-label': 'About a character' }, [el('option', { value: '' }, ['+ a character…'])].concat((S().party || []).filter((m) => d.about.indexOf(m.name) === -1).map((m) => el('option', { value: m.name }, [m.name]))));
        sel.addEventListener('change', () => { if (sel.value) { d.about.push(sel.value); draw(); } });
        box.appendChild(sel);
      } else {
        const q = el('input', { type: 'search', class: 'text', placeholder: '+ an adversary or environment', 'aria-label': 'About someone' });
        const hits = el('span', { class: 'gm-about-hits' });
        q.addEventListener('input', debounce(() => {
          hits.innerHTML = '';
          const t = q.value.trim().toLowerCase();
          if (t.length < 2) return;
          castable().filter((r) => r.name.toLowerCase().indexOf(t) !== -1 && d.about.indexOf(r.id) === -1).slice(0, 8)
            .forEach((r) => hits.appendChild(button('+ ' + r.name + ' · ' + r.type, () => { d.about.push(r.id); draw(); }, 'ghost tiny')));
        }, 150));
        box.appendChild(q);
        box.appendChild(hits);
      }
    };
    draw();
    return box;
  }
  function renderPeople(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      if (G.list('people').length + G.list('pc').length > 1) container.appendChild(G.filterBox(container, 'Filter people…'));
      container.appendChild(el('h4', { 'data-gm-id': 'people' }, ['The campaign’s people']));
      G.sections(container, G.list('people'), { redraw: draw, save: (l) => G.setList('people', l), addLabel: 'Add someone…', fields: (d) => aboutField(d, 'people') });
      container.appendChild(el('h4', { 'data-gm-id': 'pc' }, ['Behind the characters', el('span', { class: 'muted small' }, [' · never sent to players'])]));
      G.sections(container, G.list('pc'), { redraw: draw, save: (l) => G.setList('pc', l), addLabel: 'Add a note on a character…', fields: (d) => aboutField(d, 'pc') });
      G.reveal(container);
    };
    redrawOn(ctx, container, draw);
    draw();
  }

  Panels.register('notes', { label: 'Notes', render: renderNotes });
  Panels.register('scenes', { label: 'Scenes', render: renderScenes });
  Panels.register('threads', { label: 'Threads', render: renderThreads });
  Panels.register('encounters', { label: 'Encounters', render: renderEncounters });
  Panels.register('people', { label: 'People', render: renderPeople });
  window.DHGmPanes = { spend, BATTLE_POINTS };
})();
