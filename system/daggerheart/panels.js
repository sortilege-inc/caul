// system/daggerheart/panels.js — the GM's panels: Frame, Party, Inspector, Cast, Fear &
// Countdowns, Dice, Rules, Log, Campaign. Registered into the engine's registry; the shell
// (engine/app.js) decides where they show. Every word of rules text shown comes from the corpus.
(function () {
  const { el, button, debounce } = window.VttRender;
  const D = window.DHData;
  const E = window.DHEntity;
  const Dice = window.DHDice;
  const Sheet = window.DHSheet;
  const State = window.VttState;
  const Bus = window.VttBus;
  const Panels = window.VttPanels;
  const Sys = () => window.VttSystem;
  const S = () => State.state;
  const F = D.f;

  // a link inside any rendered entity opens it in the Inspector here, loading its book first
  window.DHOpenEntity = (id) => {
    const r = D.entity(id) || D.record(id);
    if (!r) return;
    D.ensure(r.book).then(() => Panels.select({ kind: 'entity', id }));
  };
  const editing = (c) => document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName) && c.contains(document.activeElement);
  // put one more copy of an adversary/environment in a scene — a fresh instance the GM tracks on its own
  const put = (sceneId, id) => State.commit('setSceneCast', [sceneId, Sys().castRaw(sceneId).concat([{ iid: State.genId('inst'), id: id }])]);

  // ── Frame: the campaign frame in play ──────────────────────────────
  function renderFrame(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const cur = ((S().campaign || {}).modules || [])[0] || '';
      const pick = el('select', { class: 'scope', 'aria-label': 'The campaign frame in play' }, [el('option', { value: '' }, ['— pick the campaign frame in play —'])].concat(
        D.frames().map((r) => el('option', { value: r.id, selected: r.id === cur || null }, [r.name + ' · ' + D.label(r.book)]))));
      pick.addEventListener('change', () => State.commit('setCampaign', [{ modules: pick.value ? [pick.value] : [] }]));
      container.appendChild(pick);
      if (!cur) return container.appendChild(el('div', { class: 'empty' }, ['No frame in play. Pick one — or run the table without one; the Scenes pane holds the arc either way.']));
      const e = D.entity(cur);
      if (!e) return container.appendChild(el('div', { class: 'muted loading' }, ['Opening the frame…']));
      const sid = Sys().currentSceneId();
      const sc = Sys().scene(sid);
      container.appendChild(el('div', { class: 'chiprow tight' }, [
        el('span', { class: 'prop-k' }, ['Scene']), sc ? el('b', {}, [sc.name]) : el('span', { class: 'muted small' }, ['none yet — the Scenes pane builds the arc']),
        Sys().scenes().length ? (() => {
          const s = el('select', { class: 'scope tiny', 'aria-label': 'The current scene' }, Sys().scenes().map((x) => el('option', { value: x.id, selected: x.id === sid || null }, [x.name])));
          s.addEventListener('change', () => { State.commit('setCurrentScene', [Sys().moduleId(), s.value]); Bus.emit('scene:changed', { sceneId: s.value }); });
          return s;
        })() : null,
        sc ? button('Open on the table', () => window.open(window.VttConfig.pages.table + '?scene=' + encodeURIComponent(sid), (window.VttConfig.channel || 'vtt') + '-table'), 'tiny') : null,
      ]));
      if (sc) {
        const here = Sys().castEntries(sid);
        container.appendChild(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['In it']), here.length ? here.map((c) => el('span', { class: 'chip' }, [
          el('button', { class: 'ref', type: 'button', onclick: () => window.DHOpenEntity(c.id) }, [Sys().instLabel(c)]),
          el('button', { class: 'ref tiny', type: 'button', title: 'take out', onclick: () => State.commit('setSceneCast', [sid, Sys().castRaw(sid).filter((y) => (typeof y === 'string' ? y : y.iid) !== c.iid)]) }, ['×']),
        ])) : el('span', { class: 'muted small' }, ['no one — a scene’s Encounter beats and the Inspector put adversaries here'])]));
      }
      container.appendChild(el('div', { class: 'paper' }, [E.render(e)]));
      const lore = D.frameLore(e);
      if (lore) container.appendChild(el('details', { class: 'lore-full' }, [el('summary', {}, ['The frame, as the book prints it']), E.markdown(lore.text, e.book)]));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', draw);
    ctx.on('scene:changed', draw);
    draw();
  }

  // ── Party ──────────────────────────────────────────────────────────
  function characterLoader(label, cls) {
    const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true, multiple: true });
    file.addEventListener('change', () => {
      const files = Array.from(file.files || []);
      Promise.all(files.map((f) => f.text().then((text) => Sys().readCharacter(JSON.parse(text), f.name))))
        .then((members) => {
          members.forEach((m) => State.commit('addPartyMember', [m]));
          if (members.length) Panels.select({ kind: 'party', id: members[members.length - 1].id });
        })
        .catch((e) => alert(e.message))
        .finally(() => (file.value = ''));
    });
    return el('span', {}, [button(label, () => file.click(), cls), file]);
  }
  // The appendix prints a Character Guide per class: a suggested build. It starts a character.
  function guidePicker() {
    const guides = D.recordsOf('Character Guide');
    const sel = el('select', { class: 'scope', 'aria-label': 'Add a character from a class’s Character Guide' }, [el('option', { value: '' }, ['add a character from a Character Guide…'])].concat(
      guides.map((r) => el('option', { value: r.id }, [F(r, 'Class') + ' — ' + r.name]))));
    sel.addEventListener('change', () => {
      const r = guides.find((x) => x.id === sel.value);
      sel.value = '';
      if (!r) return;
      D.ensureAll().then(() => {
        const m = Sheet.memberFromGuide(D.entity(r.id));
        State.commit('addPartyMember', [m]);
        Panels.select({ kind: 'party', id: m.id });
      });
    });
    return sel;
  }
  // A campaign's pre-built characters (PCs and NPCs that EXTEND the Character ACTOR) and companions
  // (Ranger Companion instances). Empty in the base VTT (its characters come from Guides or files).
  function instancePicker(type, label, fromEntity) {
    const rows = D.recordsOf(type);
    if (!rows.length) return null;
    const sel = el('select', { class: 'scope', 'aria-label': label }, [el('option', { value: '' }, [label])].concat(
      rows.map((r) => el('option', { value: r.id }, [r.name + (F(r, 'Class') ? ' — ' + F(r, 'Class') : (F(r, 'Partner') ? ' — ' + F(r, 'Partner') + '’s' : ''))]))));
    sel.addEventListener('change', () => {
      const r = rows.find((x) => x.id === sel.value);
      sel.value = '';
      if (!r) return;
      D.ensureAll().then(() => {
        const m = fromEntity(D.entity(r.id));
        State.commit('addPartyMember', [m]);
        Panels.select({ kind: 'party', id: m.id });
      });
    });
    return sel;
  }
  function renderParty(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const party = S().party || [];
      container.appendChild(el('div', { class: 'chiprow' }, [
        characterLoader('Load character file(s)…', ''), guidePicker(),
        instancePicker('Character', 'add a built character…', Sheet.memberFromCharacter),
        instancePicker('Ranger Companion', 'add a companion…', Sheet.memberFromCompanion),
      ].filter(Boolean)));
      if (!party.length) container.appendChild(el('div', { class: 'empty' }, ['No one in the party yet.']));
      party.forEach((m) => container.appendChild(el('div', { class: 'member' }, [
        el('button', { class: 'card', type: 'button', onclick: () => Panels.select({ kind: 'party', id: m.id }) }, [
          el('div', { class: 'card-name' }, [m.name]),
          el('div', { class: 'card-meta muted small' }, [Sys().memberSubtitle(m)]),
          el('div', { class: 'card-text' }, [Sheet.tokenText(m)]),
        ]),
        // the GM's notes on this character (the People pane's sections "about" them, by name)
        window.VttGmText ? window.VttGmText.aboutSections('pc', m.name, draw) : null,
        el('div', { class: 'member-ops' }, [
          button('file', () => Sys().downloadCharacter(m), 'ghost tiny'),
          button('remove', () => { if (confirm('Remove ' + m.name + ' from the party?')) State.commit('removePartyMember', [m.id]); }, 'ghost tiny'),
        ]),
      ])));
    };
    ctx.on('state:changed', draw);
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Inspector ──────────────────────────────────────────────────────
  function npcConditionsBlock(e, inst) {
    const key = (inst && inst.iid) || e.id;
    const on = (S().npcConditions || {})[key] || [];
    return el('div', { class: 'chiprow tight conditions' }, [el('span', { class: 'prop-k' }, ['Conditions']), Sheet.conditions().map((x) => {
      const has = on.indexOf(x.name) !== -1;
      return el('button', { type: 'button', class: 'btn tiny' + (has ? ' on' : ''), title: x.text, onclick: () => State.commit('setNpcConditions', [key, has ? on.filter((y) => y !== x.name) : on.concat([x.name])]) }, [x.name]);
    })]);
  }
  function renderInspector(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const sel = Panels.selection();
      if (!sel) return container.appendChild(el('div', { class: 'empty' }, ['Nothing selected. Click a name anywhere — a scene’s cast, a card, a rule.']));
      if (sel.kind === 'entity') {
        const e = D.entity(sel.id);
        if (!e) return container.appendChild(el('div', { class: 'empty' }, ['Not loaded: ' + sel.id]));
        const sid = Sys().currentSceneId();
        const sc = Sys().scene(sid);
        const castable = e.type === 'Adversary' || e.type === 'Environment';
        container.appendChild(el('div', { class: 'chiprow tight' }, [
          sc && castable ? button('Put in ' + sc.name, () => put(sid, e.id), 'tiny') : null,
          el('a', { class: 'btn ghost tiny', href: './#book/' + encodeURIComponent(e.book) + '/' + encodeURIComponent(e.id), target: '_blank' }, ['In the reader']),
        ]));
        // the GM's notes on this one (the People pane's sections "about" it)
        const about = window.VttGmText && window.VttGmText.aboutSections('people', e.id, draw);
        if (about) container.appendChild(about);
        if (e.type === 'Adversary') {
          const inst = { iid: sel.iid || e.id, label: sel.label || e.name };
          if (inst.label !== e.name) container.appendChild(el('div', { class: 'inst-name' }, [inst.label]));
          container.appendChild(Sheet.adversaryBlock(e, inst));
          container.appendChild(npcConditionsBlock(e, inst));
        }
        container.appendChild(el('div', { class: 'paper' }, [E.render(e)]));
      } else if (sel.kind === 'party') {
        const m = (S().party || []).find((x) => x.id === sel.id);
        if (!m) return container.appendChild(el('div', { class: 'empty' }, ['That character is no longer in the party.']));
        const about = window.VttGmText && window.VttGmText.aboutSections('pc', m.name, draw);
        if (about) container.appendChild(about);
        container.appendChild(Sys().liveSheet(m));
        container.appendChild(el('div', { class: 'prop-k' }, ['GM notes', el('span', { class: 'muted' }, [' · never sent to players'])]));
        container.appendChild(el('textarea', { class: 'text', rows: 3, oninput: debounce((ev) => State.commit('setPartyNotes', [m.id, ev.target.value]), 400) }, [m.notes || '']));
      } else container.appendChild(el('div', { class: 'empty' }, ['Nothing to show for ' + sel.kind + '.']));
    };
    // redraw for a change to what is shown — never for a log line alone, which would wipe a roll's
    // result off the screen the moment it is logged
    const ENTITY_OPS = ['setNpcState', 'setNpcConditions', 'setSceneCast', 'setCurrentScene', 'setArc'];
    ctx.on('select', draw);
    ctx.on('state:changed', (p) => {
      const op = p && p.op && p.op.name;
      const sel = Panels.selection();
      if (editing(container) || op === 'appendLog' || op === 'addFear' || op === 'setFear' || op === 'setClock') return;
      if (sel && sel.kind === 'entity' && op && ENTITY_OPS.indexOf(op) === -1) return;
      draw();
    });
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Cast: every adversary and environment in the books ─────────────
  const castState = { q: '', kind: 'Adversary', tier: '' };
  function renderCast(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const sid = Sys().currentSceneId();
      const sc = Sys().scene(sid);
      const kind = el('div', { class: 'seg' }, ['Adversary', 'Environment'].map((k) => button(k === 'Adversary' ? 'Adversaries' : 'Environments', () => { castState.kind = k; draw(); }, 'tiny' + (castState.kind === k ? ' on' : ''))));
      const tier = el('select', { class: 'scope tiny', 'aria-label': 'Tier' }, [el('option', { value: '' }, ['Every tier'])].concat([1, 2, 3, 4].map((t) => el('option', { value: String(t), selected: castState.tier === String(t) || null }, ['Tier ' + t]))));
      tier.addEventListener('change', () => { castState.tier = tier.value; drawList(); });
      const search = el('input', { type: 'search', class: 'search', placeholder: 'Find one in either book…', value: castState.q });
      search.addEventListener('input', debounce(() => { castState.q = search.value.trim().toLowerCase(); drawList(); }, 150));
      const list = el('div');
      // who the GM has notes about (the People pane's sections "about" them)
      const noted = {};
      ((S().gm || {}).people || []).forEach((x) => (x.about || []).forEach((id) => { noted[id] = (noted[id] || 0) + 1; }));
      const drawList = () => {
        list.innerHTML = '';
        const rows = D.recordsOf(castState.kind).filter((r) => (!castState.q || r.name.toLowerCase().indexOf(castState.q) !== -1) && (!castState.tier || String(F(r, 'Tier')) === castState.tier))
          .sort((a, b) => (F(a, 'Tier') || 0) - (F(b, 'Tier') || 0) || a.name.localeCompare(b.name));
        list.appendChild(el('div', { class: 'muted small' }, [rows.length + (sc ? ' · + puts one in ' + sc.name : ' · no scene: the Scenes pane builds the arc')]));
        list.appendChild(el('ul', { class: 'items toc' }, rows.slice(0, 200).map((r) => el('li', {}, [
          el('button', { class: 'ref', type: 'button', onclick: () => window.DHOpenEntity(r.id) }, [r.name]),
          el('span', { class: 'muted small' }, [' · ' + ['Tier ' + (F(r, 'Tier') || '—'), F(r, 'Role') || F(r, 'Category'), D.label(r.book)].filter(Boolean).join(' · ')]),
          noted[r.id] ? el('button', { class: 'chip gm-noted', type: 'button', title: 'the GM’s notes on ' + r.name, onclick: () => Panels.select({ kind: 'entity', id: r.id }) }, ['GM notes']) : null,
          sc ? el('button', { class: 'ref tiny', type: 'button', title: 'put in ' + sc.name, 'aria-label': 'put ' + r.name + ' in ' + sc.name, onclick: () => put(sid, r.id) }, ['+']) : null,
        ]))));
      };
      container.appendChild(el('div', { class: 'chiprow tight' }, [kind, tier]));
      container.appendChild(search);
      container.appendChild(list);
      drawList();
    };
    ctx.on('scene:changed', draw);
    ctx.on('state:remote', draw);
    ctx.on('state:changed', (p) => { if (p && p.op && p.op.name === 'setGm' && !editing(container)) draw(); });
    draw();
  }

  // ── Fear & Countdowns ──────────────────────────────────────────────
  function renderFear(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const fear = Number(S().fear) || 0;
      const pips = [];
      for (let i = 1; i <= Dice.FEAR_MAX; i++) pips.push(el('button', { type: 'button', class: 'box fear' + (i <= fear ? ' on' : ''), 'aria-label': 'Fear ' + i, onclick: () => State.commit('setFear', [i === fear ? i - 1 : i]) }));
      container.appendChild(el('div', { class: 'fear-row' }, [el('div', { class: 'track-k' }, ['Fear', el('span', { class: 'muted' }, [' ' + fear + '/' + Dice.FEAR_MAX + ' · the players see it'])]), el('div', { class: 'boxes' }, pips),
        el('div', { class: 'chiprow tight' }, [button('Spend 1', () => State.commit('setFear', [fear - 1]), 'tiny'), button('Gain 1', () => State.commit('setFear', [fear + 1]), 'ghost tiny')])]));
      // the book's Fear budget by scene (Fear Scene Budget), for reference
      const budgets = D.byType('Fear Scene Budget');
      if (budgets.length) container.appendChild(el('details', { class: 'small' }, [el('summary', { class: 'muted' }, ['How much Fear a scene spends']), el('table', { class: 'printed' }, [el('tbody', {}, budgets.map((b) => el('tr', {}, [el('th', {}, [D.text(b, 'Scene Type') || b.name]), el('td', {}, [D.text(b, 'Amount of Fear Spent') || '']), el('td', { class: 'muted' }, [D.text(b, 'Example Scenes') || ''])])))])]));
      // countdowns: the engine's clocks, a die that ticks down
      const clocks = S().clocks || [];
      container.appendChild(el('h4', {}, ['Countdowns']));
      clocks.forEach((c) => container.appendChild(el('div', { class: 'countdown' + (c.filled >= c.segments ? ' done' : '') }, [
        el('b', {}, [c.name]), el('span', { class: 'cd-v' }, [String(Math.max(0, c.segments - c.filled))]),
        el('span', { class: 'muted small' }, [' of ' + c.segments + (c.visible === false ? ' · hidden from players' : '')]),
        button('tick', () => State.commit('setClock', [Object.assign({}, c, { filled: Math.min(c.segments, c.filled + 1) })]), 'tiny'),
        button('back', () => State.commit('setClock', [Object.assign({}, c, { filled: Math.max(0, c.filled - 1) })]), 'ghost tiny'),
        button(c.visible === false ? 'show' : 'hide', () => State.commit('setClock', [Object.assign({}, c, { visible: c.visible === false })]), 'ghost tiny'),
        button('×', () => State.commit('removeClock', [c.id]), 'ghost tiny'),
      ])));
      let n = 4;
      const name = el('input', { class: 'text', type: 'text', placeholder: 'What it counts down to' });
      container.appendChild(el('div', { class: 'chiprow tight' }, [name, Dice.stepper('Start at', () => n, (v) => (n = v), { min: 1, max: 12 }),
        button('Start a countdown', () => { if (!name.value.trim()) return; State.commit('setClock', [{ id: State.genId('cd'), name: name.value.trim(), segments: n, filled: 0, sceneId: Sys().currentSceneId(), visible: true }]); }, 'tiny')]));
      const types = D.byType('Countdown Type');
      if (types.length) container.appendChild(el('details', { class: 'small' }, [el('summary', { class: 'muted' }, ['The book’s countdowns']), types.map((t) => el('div', { class: 'kwpara' }, [el('b', {}, [t.name]), E.prose(D.text(t, 'Description'), 'prose', t.book)]))]));
    };
    ctx.on('state:changed', draw);
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Dice ───────────────────────────────────────────────────────────
  let gmRoller = null;
  function renderDice(container, ctx) {
    container.innerHTML = '';
    let adv = 0; let dis = 0; let mod = 0; let diff = 0;
    const out = el('div', { class: 'roll-out' });
    container.appendChild(el('h4', {}, ['The GM’s d20']));
    container.appendChild(el('div', { class: 'roller' }, [
      Dice.stepper('Modifier', () => mod, (v) => (mod = v), { show: Dice.sign }),
      Dice.stepper('Advantage', () => adv, (v) => (adv = v), { min: 0, max: 5 }),
      Dice.stepper('Disadvantage', () => dis, (v) => (dis = v), { min: 0, max: 5 }),
      Dice.stepper('Against', () => diff, (v) => (diff = v), { min: 0, max: 40, show: (v) => (v ? String(v) : '—') }),
      button('Roll the d20', () => { const r = Dice.gmRoll({ modifier: mod, advantage: adv, disadvantage: dis, difficulty: diff || null }); out.innerHTML = ''; out.appendChild(Dice.resultView(r)); State.commit('appendLog', [Dice.logEntry(r, 'GM')]); }, 'primary roll-btn'),
      out,
    ]));
    container.appendChild(el('h4', {}, ['The Duality Dice']));
    if (!gmRoller) gmRoller = Dice.roller({ onResolve: (r) => State.commit('appendLog', [Dice.logEntry(r, 'GM')]) });
    container.appendChild(gmRoller);
    const bench = D.byType('Difficulty Benchmark').sort((a, b) => (D.num(a, 'Difficulty') || 0) - (D.num(b, 'Difficulty') || 0));
    if (bench.length) {
      container.appendChild(el('h4', {}, ['Difficulty']));
      container.appendChild(el('div', { class: 'chiprow tight' }, bench.map((b) => el('span', { class: 'chip' }, [(D.text(b, 'Printed Name') || b.name) + ' ' + D.num(b, 'Difficulty')]))));
    }
  }

  // ── Rules ──────────────────────────────────────────────────────────
  function renderRules(container, ctx) {
    container.innerHTML = '';
    const input = el('input', { type: 'search', class: 'search', placeholder: 'Search the books… ( / )', autocomplete: 'off' });
    const results = el('div', { class: 'results' });
    const run = debounce(() => {
      results.innerHTML = '';
      const q = input.value.trim();
      if (q.length < 2) return;
      D.ensureAll().then(() => {
        results.innerHTML = '';
        const hits = D.search(q, null, 120);
        if (!hits.length) return results.appendChild(el('div', { class: 'empty' }, ['Nothing matches.']));
        results.appendChild(el('div', { class: 'muted small' }, [hits.length + (hits.length === 1 ? ' result' : ' results')]));
        hits.forEach((e) => results.appendChild(el('div', { class: 'hit' }, [
          el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: e.id }) }, [e.name]),
          e.type ? el('span', { class: 'etype' }, [e.type]) : null,
          el('span', { class: 'muted small' }, [' · ' + D.label(e.book)]),
          (() => { const ex = D.excerpt(e, q, 60); return ex ? el('div', { class: 'muted small' }, [ex]) : null; })(),
        ])));
      });
    }, 200);
    input.addEventListener('input', run);
    container.appendChild(el('div', { class: 'search-row' }, [input]));
    container.appendChild(results);
    const moves = D.byType('GM Move');
    if (moves.length) container.appendChild(el('details', { class: 'small' }, [el('summary', { class: 'muted' }, ['GM moves']), moves.map((mv) => el('div', { class: 'kwpara' }, [el('b', {}, [D.text(mv, 'Printed Name') || mv.name]), E.prose(D.text(mv, 'Description'), 'prose', mv.book)]))]));
    container.focusSearch = () => input.focus();
  }

  // ── Log ────────────────────────────────────────────────────────────
  function logLine(x) {
    if (x.roll) return Dice.logLine(x);
    return el('div', { class: 'log-line event' }, [x.who ? el('b', {}, [x.who + ' ']) : null, x.text || '']);
  }
  function renderLog(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const log = (S().log || []).slice().reverse();
      if (!log.length) return container.appendChild(el('div', { class: 'empty' }, ['Nothing logged yet.']));
      log.forEach((x) => container.appendChild(logLine(x)));
    };
    ctx.on('state:changed', draw);
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Campaign ───────────────────────────────────────────────────────
  function renderCampaign(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const c = S().campaign;
      container.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Campaign']), el('div', { class: 'prop-v' }, [el('input', { type: 'text', value: c.name || '', class: 'text', 'aria-label': 'Campaign name', onchange: (ev) => State.commit('setCampaign', [{ name: ev.target.value }]) })])]));
      const fr = Sys().frame();
      container.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Frame']), el('div', { class: 'prop-v' }, [fr ? fr.name : '—'])]));
      const list = State.listCampaigns();
      container.appendChild(el('h4', {}, ['Campaigns in this browser']));
      container.appendChild(el('ul', { class: 'items' }, list.map((row) => el('li', {}, [
        row.id === State.id ? el('b', {}, [row.name || row.id]) : el('button', { class: 'ref', type: 'button', onclick: () => { State.switchTo(row.id); location.reload(); } }, [row.name || row.id]),
        row.id !== State.id ? button('remove', () => { if (confirm('Remove "' + row.name + '" from this browser? Save its pack first if you want it back.')) { State.remove(row.id); draw(); } }, 'ghost tiny') : null,
      ]))));
      const file = el('input', { type: 'file', accept: 'application/json', hidden: true, onchange: (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        f.text().then((txt) => { try { State.importPack(JSON.parse(txt)); location.reload(); } catch (e) { alert(e.message); } });
      } });
      container.appendChild(el('div', { class: 'chiprow' }, [
        button('New campaign', () => { const n = prompt('Campaign name'); if (n) { State.create(n, { campaign: { modules: [], books: [] } }); location.reload(); } }),
        button('Save pack (download)', () => State.downloadPack()),
        button('Restore pack…', () => file.click(), 'ghost'),
        file,
      ]));
      container.appendChild(el('p', { class: 'muted small' }, ['A pack is the campaign as an instance: the party, the arc, every note and roll, as JSON. Keep packs with the campaign; this browser is a cache.']));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    draw();
  }

  Panels.register('frame', { label: 'Frame', render: renderFrame });
  Panels.register('party', { label: 'Party', render: renderParty });
  Panels.register('inspector', { label: 'Inspector', render: renderInspector });
  Panels.register('cast', { label: 'Cast', render: renderCast });
  Panels.register('fear', { label: 'Fear & Countdowns', render: renderFear });
  Panels.register('dice', { label: 'Dice', render: renderDice });
  Panels.register('rules', { label: 'Rules', render: renderRules });
  Panels.register('log', { label: 'Log', render: renderLog });
  Panels.register('campaign', { label: 'Campaign', render: renderCampaign });

  // both books load with the page: a sheet names classes, cards and equipment from either
  D.ensureAll().then(() => Bus.emit('state:remote', { loaded: true }, { local: true }));
  window.DHPanels = { characterLoader, npcConditionsBlock };
})();
