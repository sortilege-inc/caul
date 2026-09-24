// system/daggerheart/creator.js — making a character: the book's own chapter walked step by step.
//
// Each step shows its section of the book verbatim (the "STEP n: …" heading and what follows it
// in the core's lore — Step 1 opens Chapter 1 at the end of the introduction, pages 5–14; Steps 2–9
// are the character-creation chapter). The controls are the corpus's own sets: the classes and
// subclasses, ancestries, communities, the tier 1 weapons and armor, the class's domains and
// their level 1 cards, the class's background and connection questions. What leaves is a character
// file (ACTOR "Character" fields) the table imports. Numbers the book states only in prose are
// named constants citing their sentences:
//
//   TRAIT_MODS   "Distribute the following starting modifiers across your character's traits in any
//                order you wish: +2, +1, +1, 0, 0, −1." (Step 3)
//   WEAPONS      "At character creation, you can choose either a two-handed primary weapon, or a
//                one-handed primary weapon and a one-handed secondary weapon" (Step 5)
//   START_TIER   "you can find all starting (Tier 1) weapons …" / "all starting (Tier 1) armor" (Step 5)
//   EXPERIENCES  "Your character starts with two Experiences at character creation (each with a +2
//                modifier)" (Step 7)
//   CARDS        "look at all the level 1 cards from your class's two domains and choose two cards"
//                (Step 8)
window.DHCreator = (function () {
  const { el, button } = window.VttRender;
  const D = window.DHData;
  const E = window.DHEntity;
  const Dice = window.DHDice;
  const Sheet = window.DHSheet;
  const TRAIT_MODS = [2, 1, 1, 0, 0, -1];
  const START_TIER = 1;
  const EXPERIENCES = 2;
  const EXPERIENCE_MOD = 2;
  const CARDS = 2;
  const CARD_LEVEL = 1;

  // the step's own section of the book: the core lore that carries "STEP n:"
  // (only the walkthrough's own two files: the ancestries and the action roll print "STEP 1:"s too)
  const WALKTHROUGH = /-(introduction|character-creation)\.lore$/;
  function stepText(n) {
    for (const c of D.chapters('core').filter((x) => x.kind === 'lore' && WALKTHROUGH.test(x.file))) {
      const sec = D.loreSections(c).find((s) => new RegExp('^STEP ' + n + ':').test(s.title || ''));
      if (sec) return { title: sec.title, text: D.loreSection(c, sec.title) };
    }
    return null;
  }

  let st = null;   // the character being made
  function fresh() {
    return { step: 1, name: '', pronouns: '', description: '', cls: null, sub: null, ancestry: null, community: null, traits: {}, primary: null, secondary: null, armor: null, potion: null, classItem: null, background: {}, experiences: ['', ''], cards: [], connections: {} };
  }
  const ent = (id) => (id ? D.entity(id) : null);
  const ref = (e) => (e ? { id: e.id, name: e.name } : null);
  const sorted = (list) => list.slice().sort((a, b) => a.name.localeCompare(b.name));

  // ── building the character file from the answers ──────────────────
  function character() {
    const cls = ent(st.cls);
    const c = Sheet.blankCharacter(st.name || 'A new character');
    c.Pronouns = st.pronouns || undefined;
    c['Character Description'] = st.description || undefined;
    if (cls) {
      c.Class = ref(cls);
      c.Evasion = D.num(cls, 'Starting Evasion');
      c['Hit Points'] = D.num(cls, 'Starting Hit Points');
    }
    c.Subclass = ref(ent(st.sub));
    c.Ancestry = ref(ent(st.ancestry));
    c.Community = ref(ent(st.community));
    Object.keys(st.traits).forEach((t) => (c.Traits[t] = st.traits[t]));
    c['Primary Weapon'] = ref(ent(st.primary));
    c['Secondary Weapon'] = ref(ent(st.secondary));
    const ar = ent(st.armor);
    c['Active Armor'] = ref(ar);
    if (ar) c['Armor Score'] = D.num(ar, 'Base Score') || 0;
    c.Experiences = st.experiences.filter((x) => x.trim()).map((x) => ({ Name: x.trim(), Modifier: EXPERIENCE_MOD }));
    c.Loadout = st.cards.map((id) => ref(ent(id)));
    c.Inventory = startingItems().concat([st.potion, st.classItem].filter(Boolean));
    c['Background Questions'] = cls ? (D.val(cls, 'Background Questions') || []).map((q) => (st.background[q] ? q + ' — ' + st.background[q] : null)).filter(Boolean) : [];
    c.Connections = cls ? (D.val(cls, 'Connections') || []).map((q) => (st.connections[q] ? q + ' — ' + st.connections[q] : null)).filter(Boolean) : [];
    Object.keys(c).forEach((k) => c[k] === undefined && delete c[k]);
    return c;
  }
  // "Your inventory includes …": the starting items the book lists, less the gold (which goes in
  // the Gold field) and the two choices (a potion; the class's "and either"), which the player makes
  function startingItems() {
    const s = stepText(5);
    if (!s) return [];
    return s.text.split('\n').filter((ln) => /^•\s/.test(ln)).map((ln) => ln.replace(/^•\s*/, ''))
      .filter((x) => !/^A handful of gold|^Your choice of|^The “and either”/.test(x)).map((x) => x.replace(/\s*\(.*\)\s*$/, ''));
  }
  // the two potions the same list offers: "Your choice of a Minor Health Potion (…) or a Minor Stamina Potion (…)"
  function potionChoice() {
    const s = stepText(5);
    const ln = s ? s.text.split('\n').find((x) => /Your choice of/.test(x)) : null;
    const m = ln ? /Your choice of an? (.+?) \(.*?\) or an? (.+?) \(/.exec(ln) : null;
    return m ? [m[1], m[2]] : [];
  }

  // ── the steps ──────────────────────────────────────────────────────
  function pickList(label, items, cur, onPick, meta) {
    return el('div', { class: 'pick-list' }, [el('div', { class: 'prop-k' }, [label]), el('div', { class: 'picks' }, items.map((e) => el('button', {
      type: 'button', class: 'btn pick' + (cur === e.id ? ' on' : ''), onclick: () => onPick(e.id),
    }, [e.name, meta ? el('span', { class: 'muted small' }, [' ' + meta(e)]) : null])))]);
  }
  const chosen = (id) => {
    const e = ent(id);
    return e ? el('div', { class: 'paper' }, [E.render(e)]) : null;
  };

  function step1(box, redraw) {
    const classes = sorted(D.byType('Class'));
    box.appendChild(el('div', { class: 'chiprow' }, [
      el('input', { class: 'text', type: 'text', placeholder: 'Name', value: st.name, 'aria-label': 'Name', oninput: (ev) => (st.name = ev.target.value) }),
      el('input', { class: 'text', type: 'text', placeholder: 'Pronouns', value: st.pronouns, 'aria-label': 'Pronouns', oninput: (ev) => (st.pronouns = ev.target.value) }),
    ]));
    box.appendChild(pickList('Class', classes, st.cls, (id) => { if (st.cls !== id) Object.assign(st, { cls: id, sub: null, cards: [], background: {}, connections: {}, classItem: null }); redraw(); }, (e) => (D.val(e, 'Domains') || []).join(' & ')));
    const cls = ent(st.cls);
    if (!cls) return;
    const subs = D.byType('Subclass').filter((s) => (D.val(s, 'Class') || {}).name === cls.name);
    box.appendChild(pickList('Subclass', subs, st.sub, (id) => { st.sub = id; redraw(); }));
    box.appendChild(chosen(st.sub) || chosen(st.cls));
  }
  function step2(box, redraw) {
    box.appendChild(pickList('Ancestry', sorted(D.byType('Ancestry')), st.ancestry, (id) => { st.ancestry = id; redraw(); }));
    box.appendChild(pickList('Community', sorted(D.byType('Community')), st.community, (id) => { st.community = id; redraw(); }));
    [st.ancestry, st.community].forEach((id) => { const c = chosen(id); if (c) box.appendChild(c); });
  }
  function step3(box, redraw) {
    const names = Dice.traits().map((t) => t.name);
    const used = Object.keys(st.traits).map((k) => st.traits[k]);
    const left = TRAIT_MODS.slice();
    used.forEach((v) => { const i = left.indexOf(v); if (i !== -1) left.splice(i, 1); });
    box.appendChild(el('div', { class: 'muted small' }, ['Still to place: ' + (left.length ? left.map(Dice.sign).join(', ') : 'none')]));
    box.appendChild(el('div', { class: 'trait-grid' }, names.map((t) => {
      const cur = st.traits[t];
      const offer = Array.from(new Set(left.concat(cur != null ? [cur] : []))).sort((a, b) => b - a);
      return el('div', { class: 'trait-row' }, [el('b', {}, [t]), el('div', { class: 'chiprow tight' }, offer.map((v) => el('button', {
        type: 'button', class: 'btn tiny' + (cur === v ? ' on' : ''), onclick: () => { if (cur === v) delete st.traits[t]; else st.traits[t] = v; redraw(); },
      }, [Dice.sign(v)])))]);
    })));
    const guide = st.cls ? D.byType('Character Guide').find((g) => (D.val(g, 'Class') || {}).name === (ent(st.cls) || {}).name) : null;
    if (guide) box.appendChild(button('Use the ' + guide.name + '’s suggestion', () => { st.traits = Sheet.parseTraits(D.text(guide, 'Suggested Traits')); redraw(); }, 'ghost tiny'));
  }
  function step4(box) {
    const cls = ent(st.cls);
    const c = character();
    box.appendChild(el('div', { class: 'sheet-stats' }, [
      ['Evasion', cls ? D.num(cls, 'Starting Evasion') : '—'], ['Hit Points', cls ? D.num(cls, 'Starting Hit Points') : '—'], ['Stress', c.Stress], ['Hope', c.Hope],
    ].map(([k, v]) => el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [k]), el('div', { class: 'stat-v' }, [String(v)])]))));
    if (!cls) box.appendChild(el('div', { class: 'muted small' }, ['Choose a class in Step 1: Evasion and Hit Points are the class’s.']));
  }
  function step5(box, redraw) {
    const weapons = D.byType('Weapon').filter((w) => D.num(w, 'Tier') === START_TIER);
    const burden = (w) => D.text(w, 'Burden') || '';
    const two = (w) => /Two-Handed/i.test(burden(w));
    const cat = (w) => D.enumText(w, 'Category') || D.text(w, 'Category');
    const meta = (w) => [D.text(w, 'Trait'), D.text(w, 'Range'), D.text(w, 'Damage'), burden(w)].filter(Boolean).join(' · ');
    box.appendChild(pickList('Primary weapon (Tier 1)', sorted(weapons.filter((w) => cat(w) === 'Primary')), st.primary, (id) => { st.primary = id; if (two(ent(id))) st.secondary = null; redraw(); }, meta));
    const p = ent(st.primary);
    if (p && two(p)) box.appendChild(el('div', { class: 'muted small' }, [p.name + ' is two-handed: no secondary weapon.']));
    else box.appendChild(pickList('Secondary weapon (Tier 1, one-handed)', sorted(weapons.filter((w) => cat(w) === 'Secondary' && !two(w))), st.secondary, (id) => { st.secondary = st.secondary === id ? null : id; redraw(); }, meta));
    box.appendChild(pickList('Armor (Tier 1)', sorted(D.byType('Armor').filter((a) => D.num(a, 'Tier') === START_TIER)), st.armor, (id) => { st.armor = id; redraw(); }, (a) => {
      const t = D.defFields(D.prop(a, 'Base Thresholds'));
      return t.Major + '/' + t.Severe + ' · score ' + D.num(a, 'Base Score');
    }));
    const potions = potionChoice();
    if (potions.length) box.appendChild(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['Your choice of']), potions.map((x) => button(x, () => { st.potion = x; redraw(); }, 'tiny' + (st.potion === x ? ' on' : '')))]));
    const cls = ent(st.cls);
    const items = cls ? String(D.text(cls, 'Class Items') || '').split(/ or /) : [];
    if (items.length > 1) box.appendChild(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['And either']), items.map((x) => button(x, () => { st.classItem = x; redraw(); }, 'tiny' + (st.classItem === x ? ' on' : '')))]));
    box.appendChild(el('div', { class: 'muted small' }, ['Also: ' + startingItems().join(' · ') + ' · and a handful of gold (the Gold field).']));
  }
  function questions(box, list, answers, label) {
    (list || []).forEach((q) => box.appendChild(el('div', { class: 'qa' }, [el('div', {}, [E.span(q, 'core')]), el('textarea', { class: 'text', rows: 2, 'aria-label': label, oninput: (ev) => (answers[q] = ev.target.value) }, [answers[q] || ''])])));
  }
  function step6(box) {
    const cls = ent(st.cls);
    box.appendChild(el('textarea', { class: 'text', rows: 3, placeholder: 'Character description — clothes, eyes, body, skin, attitude', 'aria-label': 'Character description', oninput: (ev) => (st.description = ev.target.value) }, [st.description]));
    if (cls) questions(box, D.val(cls, 'Background Questions'), st.background, 'Your answer');
  }
  function step7(box) {
    for (let i = 0; i < EXPERIENCES; i++) {
      box.appendChild(el('div', { class: 'chiprow tight' }, [el('input', { class: 'text', type: 'text', placeholder: 'An Experience', value: st.experiences[i] || '', 'aria-label': 'Experience ' + (i + 1), oninput: (ev) => (st.experiences[i] = ev.target.value) }), el('b', {}, [Dice.sign(EXPERIENCE_MOD)])]));
    }
  }
  function step8(box, redraw) {
    const cls = ent(st.cls);
    if (!cls) return box.appendChild(el('div', { class: 'muted small' }, ['Choose a class in Step 1: the cards are its two domains’.']));
    const domains = D.val(cls, 'Domains') || [];
    const cards = D.byType('Domain Card').filter((c) => domains.indexOf((D.val(c, 'Domain') || {}).name) !== -1 && D.num(c, 'Domain Level') === CARD_LEVEL);
    box.appendChild(el('div', { class: 'muted small' }, [st.cards.length + ' of ' + CARDS + ' chosen']));
    box.appendChild(el('div', { class: 'fcards' }, cards.map((c) => {
      const on = st.cards.indexOf(c.id) !== -1;
      return el('div', { class: 'card-pick' + (on ? ' on' : '') }, [
        button((on ? '✓ ' : '') + c.name, () => { st.cards = on ? st.cards.filter((x) => x !== c.id) : st.cards.length < CARDS ? st.cards.concat([c.id]) : st.cards; redraw(); }, 'tiny' + (on ? ' on' : '')),
        el('span', { class: 'muted small' }, [' ' + [(D.val(c, 'Domain') || {}).name, D.enumText(c, 'Type') || D.text(c, 'Type')].filter(Boolean).join(' · ')]),
        el('div', { class: 'small' }, [E.span(D.text(c, 'Description') || '', c.book)]),
      ]);
    })));
  }
  function step9(box) {
    const cls = ent(st.cls);
    if (cls) questions(box, D.val(cls, 'Connections'), st.connections, 'Their answer');
    box.appendChild(el('h4', {}, ['The character']));
    box.appendChild(summary());
    box.appendChild(el('div', { class: 'chiprow' }, [button('Save the character file', download, 'primary')]));
    box.appendChild(el('p', { class: 'muted small' }, ['At the table, the GM loads it in the Party panel, or you bring it on the player’s page.']));
  }
  const STEPS = [step1, step2, step3, step4, step5, step6, step7, step8, step9];

  function summary() {
    const c = character();
    const rows = [
      ['Name', c.Name + (c.Pronouns ? ' (' + c.Pronouns + ')' : '')], ['Class', [c.Class && c.Class.name, c.Subclass && c.Subclass.name].filter(Boolean).join(' · ')],
      ['Heritage', [c.Ancestry && c.Ancestry.name, c.Community && c.Community.name].filter(Boolean).join(' · ')],
      ['Traits', Object.keys(c.Traits).map((t) => t + ' ' + Dice.sign(c.Traits[t])).join(', ')],
      ['Evasion · HP · Stress · Hope', [c.Evasion, c['Hit Points'], c.Stress, c.Hope].map((v) => (v == null ? '—' : v)).join(' · ')],
      ['Weapons', [c['Primary Weapon'], c['Secondary Weapon']].filter(Boolean).map((w) => w.name).join(' · ')],
      ['Armor', c['Active Armor'] ? c['Active Armor'].name + ' · score ' + c['Armor Score'] + ' · thresholds ' + Sheet.thresholds(c).Major + '/' + Sheet.thresholds(c).Severe : ''],
      ['Experiences', c.Experiences.map((x) => x.Name + ' ' + Dice.sign(x.Modifier)).join(', ')],
      ['Loadout', c.Loadout.filter(Boolean).map((x) => x.name).join(', ')],
      ['Inventory', c.Inventory.join(', ')],
    ];
    return el('div', { class: 'fields' }, rows.map(([k, v]) => el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [k]), el('div', { class: 'prop-v' }, [v || '—'])])));
  }
  function download() {
    const c = character();
    const blob = new Blob([JSON.stringify({ kind: 'daggerheart-character', templateId: Sheet.ACTOR_ID, character: c, live: {} }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: String(c.Name || 'character').replace(/[^\w\- ]+/g, '') + '.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function render(container, path, ctx) {
    const p = container.appendChild(el('div', { class: 'page creator' }));
    p.appendChild(el('h1', {}, ['Make a character']));
    const note = p.appendChild(el('div', { class: 'muted loading' }, ['Opening both books…']));
    D.ensureAll().then(() => {
      note.remove();
      if (!st) st = fresh();
      const body = p.appendChild(el('div', {}));
      const redraw = () => {
        body.innerHTML = '';
        body.appendChild(el('div', { class: 'seg steps' }, STEPS.map((_, i) => button(String(i + 1), () => { st.step = i + 1; redraw(); }, 'tiny' + (st.step === i + 1 ? ' on' : '')))));
        const t = stepText(st.step);
        if (t) body.appendChild(el('details', { class: 'step-text', open: true }, [el('summary', {}, [t.title]), E.markdown(t.text.replace(/^#{1,6} .*\n/, ''), 'core')]));
        const box = body.appendChild(el('div', { class: 'step-controls' }));
        STEPS[st.step - 1](box, redraw);
        body.appendChild(el('div', { class: 'chiprow' }, [
          st.step > 1 ? button('← Step ' + (st.step - 1), () => { st.step--; redraw(); window.scrollTo(0, 0); }, 'ghost') : null,
          st.step < STEPS.length ? button('Step ' + (st.step + 1) + ' →', () => { st.step++; redraw(); window.scrollTo(0, 0); }, 'primary') : null,
          button('Start over', () => { if (confirm('Start the character over?')) { st = fresh(); redraw(); } }, 'ghost tiny'),
        ]));
      };
      redraw();
    });
  }

  return { render, character, stepText, startingItems, potionChoice, _state: () => st, _set: (s) => (st = Object.assign(fresh(), s)) };
})();
