// system/daggerheart/gm-panes.js — the GM's three panes (from L5R5e's Portents work, I9–I10): Notes,
// Scenes, Threads · Encounters. Everything here is the GM's own pack state (ops.js: gmNotes, arc,
// threads, encounters) — saved with the pack, never sent to a player. The encounter builder is the
// book's Battle Points: the formula is its sentence (a named constant), the costs and adjustments
// are the corpus's own `^"Adversary Type"` and `^"Battle Point Adjustment"` entities.
//
//   BATTLE_POINTS "When planning a battle, start with the following formula to calculate how many
//                 Battle Points you should spend: (3 × the number of PCs in combat) + 2"
//                 (adversaries.lore, Building Balanced Encounters)
(function () {
  const { el, button, debounce } = window.VttRender;
  const D = window.DHData;
  const E = window.DHEntity;
  const State = window.VttState;
  const Sys = () => window.VttSystem;
  const S = () => State.state;
  const CFG = window.VttConfig || {};
  const F = D.f;
  const editing = (c) => document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName) && c.contains(document.activeElement);
  const newId = (p) => State.genId(p);
  const BATTLE_POINTS = (pcs) => 3 * pcs + 2;

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

  // ── Scenes: the campaign's arc — the table's scenes (table.js) ─────
  const arc = () => (S().arc || []).map((x) => Object.assign({}, x));
  const setArc = (list) => State.commit('setArc', [list]);
  function renderScenes(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const list = arc();
      const cur = Sys().currentSceneId();
      const played = list.filter((x) => x.played).length;
      container.appendChild(el('h4', {}, ['The arc', el('span', { class: 'muted small' }, [' · ' + list.length + ' scenes, ' + played + ' played'])]));
      list.forEach((x, i) => {
        const upd = (patch) => { const l = arc(); l[i] = Object.assign({}, l[i], patch); setArc(l); };
        const move = (d) => { const l = arc(); const j = i + d; if (j < 0 || j >= l.length) return; const t = l[i]; l[i] = l[j]; l[j] = t; setArc(l); };
        container.appendChild(el('div', { class: 'arc-scene' + (x.played ? ' played' : '') + (x.id === cur ? ' current' : '') }, [
          el('div', { class: 'chiprow tight' }, [
            el('input', { type: 'checkbox', checked: x.played || null, title: 'Played', 'aria-label': 'Played', onchange: (ev) => upd({ played: ev.target.checked }) }),
            el('input', { class: 'text arc-title', type: 'text', value: x.title || '', placeholder: 'A scene', 'aria-label': 'Scene title', oninput: debounce((ev) => upd({ title: ev.target.value }), 400) }),
            x.id === cur ? el('span', { class: 'chip on' }, ['current']) : button('make current', () => { State.commit('setCurrentScene', [Sys().moduleId(), x.id]); window.VttBus.emit('scene:changed', { sceneId: x.id }); }, 'ghost tiny'),
            button('↑', () => move(-1), 'ghost tiny'), button('↓', () => move(1), 'ghost tiny'),
            button('×', () => { if (confirm('Remove “' + (x.title || 'this scene') + '” from the arc?')) setArc(arc().filter((_, j) => j !== i)); }, 'ghost tiny'),
          ]),
          el('textarea', { class: 'text arc-text', rows: 3, placeholder: 'What it is for, who is in it, what might happen…', 'aria-label': 'Scene notes', oninput: debounce((ev) => upd({ text: ev.target.value }), 400) }, [x.text || '']),
        ]));
      });
      const title = el('input', { class: 'text', type: 'text', placeholder: 'Add a scene…', 'aria-label': 'New scene' });
      container.appendChild(el('div', { class: 'chiprow tight' }, [title, button('Add', () => { if (!title.value.trim()) return; setArc(arc().concat([{ id: newId('arc'), title: title.value.trim(), text: '', played: false }])); title.value = ''; draw(); }, 'tiny')]));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    ctx.on('scene:changed', draw);
    draw();
  }

  // ── Threads · Encounters ──────────────────────────────────────────
  const threads = () => (S().threads || []).map((x) => Object.assign({}, x));
  const setThreads = (l) => State.commit('setThreads', [l]);
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
  function renderThreads(container, ctx) {
    let q = '';
    const draw = () => {
      container.innerHTML = '';
      const ts = threads();
      container.appendChild(el('h4', {}, ['Threads', el('span', { class: 'muted small' }, [' · ' + ts.filter((x) => x.open !== false).length + ' open'])]));
      ts.forEach((x, i) => {
        const upd = (patch) => { const l = threads(); l[i] = Object.assign({}, l[i], patch); setThreads(l); };
        container.appendChild(el('div', { class: 'thread' + (x.open === false ? ' closed' : '') }, [
          el('div', { class: 'chiprow tight' }, [
            el('input', { class: 'text', type: 'text', value: x.title || '', 'aria-label': 'Thread', oninput: debounce((ev) => upd({ title: ev.target.value }), 400) }),
            button(x.open === false ? 'reopen' : 'close', () => upd({ open: x.open === false }), 'ghost tiny'),
            button('×', () => { if (confirm('Remove this thread?')) setThreads(threads().filter((_, j) => j !== i)); }, 'ghost tiny'),
          ]),
          x.open === false ? null : el('textarea', { class: 'text', rows: 2, placeholder: 'Where it stands…', 'aria-label': 'Where it stands', oninput: debounce((ev) => upd({ text: ev.target.value }), 400) }, [x.text || '']),
        ]));
      });
      const tt = el('input', { class: 'text', type: 'text', placeholder: 'Open a thread…', 'aria-label': 'New thread' });
      container.appendChild(el('div', { class: 'chiprow tight' }, [tt, button('Add', () => { if (!tt.value.trim()) return; setThreads(threads().concat([{ id: newId('th'), title: tt.value.trim(), text: '', open: true }])); tt.value = ''; draw(); }, 'tiny')]));

      // the encounter: Battle Points
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
          el('button', { class: 'ref', type: 'button', onclick: () => window.DHOpenEntity(n.id) }, [r ? r.name : n.id]),
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
        sc && draft.npcs.length ? button('Put in ' + sc.name, () => { const cur = Sys().castIds(sid); State.commit('setSceneCast', [sid, cur.concat(draft.npcs.map((n) => n.id).filter((id) => cur.indexOf(id) === -1))]); }, 'ghost tiny') : null,
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
    draw();
  }

  window.VttPanels.register('notes', { label: 'Notes', render: renderNotes });
  window.VttPanels.register('scenes', { label: 'Scenes', render: renderScenes });
  window.VttPanels.register('threads', { label: 'Threads · Encounters', render: renderThreads });
  window.DHGmPanes = { spend, BATTLE_POINTS };
})();
