// system/daggerheart/sheet.js — a character, derived from the corpus's `ACTOR "Character"`.
//
// The sheet is the ACTOR's property declarations read at runtime (PLAYBOOK §1b): its fields, their
// DEFAULTs (Stress 6, Hope 2, a handful of gold) and bounds (Hope MAX 6) are the corpus's, so a
// corpus change reaches the sheet without an edit here. What the book states only in prose is a
// named constant citing its sentence:
//
//   THRESHOLDS  "Severe damage is equal to or above your Severe threshold; you mark 3 HP." / "Major
//               damage is equal to or above your Major threshold but below Severe; you mark 2 HP." /
//               "Minor damage is anything below your Major threshold; you mark 1 HP." / "If you ever
//               reduce incoming damage to 0 or less … you don't mark any HP." (core-mechanics.lore)
//   ARMOR       "you can mark one of the small shield symbols next to your Armor Score (called an
//               Armor Slot), then reduce the severity of the damage by one threshold: Severe to
//               Major, Major to Minor, or Minor to None. You can only mark one Armor Slot per attack,
//               and you have a number of slots equal to your Armor Score." (character-creation.lore)
//   LEVEL_ADD   "Add your current level to your damage thresholds." (the character sheet)
//   STRESS_FULL "If you're ever forced to mark 1 or more Stress but your slots are already full, you
//               must instead mark 1 Hit Point."
//   LAST_STRESS "When you mark your last Stress, you become Vulnerable … until you clear at least 1
//               Stress."
//   LAST_HP     "When you mark your last Hit Point, you must make a death move"
//   MASSIVE     "OPTIONAL RULE: MASSIVE DAMAGE … If you ever take damage equal to double your Severe
//               threshold, you mark 4 Hit Points." — optional, so off unless an instance's MODIFY
//               introduces ^"Massive Damage" on ^"Damage Thresholds".
//
// A member: { id, templateId (the ACTOR's hash), name, character: { <ACTOR field>: value },
// live: { markedHp, markedStress, hope, markedArmor, conditions, gold }, notes, playerNotes }.
window.DHSheet = (function () {
  const { el, button } = window.VttRender;
  const D = window.DHData;
  const E = window.DHEntity;
  const Dice = window.DHDice;
  const State = () => window.VttState;
  const ACTOR_ID = '#daggerheartCharacter000000001';
  const COMPANION_ID = '#daggerheartRangerCompanion01';
  const CONDITION_ID = '#daggerheartCondition0000000001';

  // ── the ACTOR, read ────────────────────────────────────────────────
  const spec = () => D.declared('Character').props;
  const field = (name) => spec().find((p) => p.name === name) || null;
  const dflt = (name, fallback) => { const p = field(name); return p && p.default !== undefined ? p.default : fallback; };
  const maxOf = (name) => { const p = field(name); return p && p.max != null ? p.max : null; };
  function goldDefaults() {
    const g = field('Gold');
    const out = {};
    ((g && g.fields) || []).forEach((f) => (out[f.name] = f.default !== undefined ? f.default : 0));
    return out;
  }
  const HOPE_MAX = () => maxOf('Hope') != null ? maxOf('Hope') : Dice.HOPE_MAX;
  const traitNames = () => Dice.traits().map((t) => t.name);
  // the conditions: the ^"Condition" ENUM, each with its line of the DESCRIPTION as its title
  function conditions() {
    const c = D.entity(CONDITION_ID);
    if (!c) return [];
    const names = ((c.blocks || []).find((b) => b.kw === 'ENUM') || { args: [] }).args.reduce((a, x) => a.concat(x.l ? x.l.map(D.arg) : []), []);
    const text = {};
    String(c.desc || '').split('\n').forEach((ln) => { const m = /^\s*([A-Za-z]+):\s*(.+)$/.exec(ln); if (m) text[m[1]] = m[2].trim(); });
    return names.map((n) => ({ name: n, text: text[n] || '' }));
  }

  // ── a character's numbers ──────────────────────────────────────────
  const ch = (m) => (m && m.character) || {};
  const refEntity = (r) => (r && ((r.id && D.entity(r.id)) || (r.name && D.named(r.name)))) || null;
  const level = (c) => c.Level || dflt('Level', 1);
  const traits = (c) => Object.assign({}, ...traitNames().map((t) => ({ [t]: 0 })), c.Traits || {});
  function armorOf(c) { return refEntity(c['Active Armor']); }
  // thresholds: the armor's base thresholds plus the level (LEVEL_ADD), unless the sheet prints its own
  function thresholds(c) {
    if (c['Damage Thresholds'] && c['Damage Thresholds'].Major != null) return c['Damage Thresholds'];
    const a = armorOf(c);
    const base = a ? D.defFields(D.prop(a, 'Base Thresholds')) : {};
    return { Major: (base.Major || 0) + level(c), Severe: (base.Severe || 0) + level(c) };
  }
  const armorScore = (c) => (c['Armor Score'] != null ? c['Armor Score'] : (armorOf(c) ? D.num(armorOf(c), 'Base Score') || 0 : 0));
  const hpMax = (c) => c['Hit Points'] || 0;
  const stressMax = (c) => (c.Stress != null ? c.Stress : dflt('Stress', 6));
  const proficiency = (c) => c.Proficiency || 1;
  function live(m) {
    const l = Object.assign({ markedHp: 0, markedStress: 0, hope: dflt('Hope', 2), markedArmor: 0, conditions: [], gold: goldDefaults() }, (m && m.live) || {});
    l.conditions = (l.conditions || []).slice();
    return l;
  }
  const massiveOn = () => { const t = D.entity('#daggerheartDamageThresholds001'); return !!(t && D.modified(t, 'Massive Damage')); };

  // How many HP a hit of `dmg` marks (THRESHOLDS, MASSIVE), and with an Armor Slot (ARMOR).
  function severity(c, dmg) {
    const t = thresholds(c);
    if (dmg <= 0) return 0;
    if (massiveOn() && dmg >= 2 * t.Severe) return 4;
    return dmg >= t.Severe ? 3 : dmg >= t.Major ? 2 : 1;
  }
  const SEVERITY = ['None', 'Minor', 'Major', 'Severe', 'Massive'];

  // ── committing a change to the member ──────────────────────────────
  function patch(m, p, text) {
    State().commit('setPartyLive', [m.id, p]);
    if (text) logEvent(m, text);
  }
  function logEvent(m, text) {
    State().commit('appendLog', [{ at: Date.now(), kind: 'event', who: m.name, memberId: m.id, text }]);
  }
  function markStress(m, n, why) {
    const c = ch(m); const l = live(m); const max = stressMax(c);
    const room = max - l.markedStress;
    const take = Math.min(room, n);
    const over = n - take;
    const p = { markedStress: l.markedStress + take };
    const bits = [];
    if (take) bits.push('Stress ' + l.markedStress + ' → ' + p.markedStress);
    if (over > 0 && l.markedHp < hpMax(c)) { p.markedHp = l.markedHp + 1; bits.push('Stress full: HP ' + l.markedHp + ' → ' + p.markedHp); }   // STRESS_FULL
    if (p.markedStress === max && l.conditions.indexOf('Vulnerable') === -1) { p.conditions = l.conditions.concat(['Vulnerable']); bits.push('Vulnerable — the last Stress'); }   // LAST_STRESS
    patch(m, p, (why ? why + ': ' : '') + bits.join(' · '));
  }
  function clearStress(m, n, why) {
    const l = live(m);
    const v = Math.max(0, l.markedStress - n);
    const p = { markedStress: v };
    if (l.markedStress === stressMax(ch(m)) && v < l.markedStress && l.conditions.indexOf('Vulnerable') !== -1) p.conditions = l.conditions.filter((x) => x !== 'Vulnerable');
    patch(m, p, (why ? why + ': ' : '') + 'Stress ' + l.markedStress + ' → ' + v);
  }
  function takeDamage(m, dmg, useArmor) {
    const c = ch(m); const l = live(m);
    let sev = severity(c, dmg);
    const bits = [dmg + ' damage — ' + SEVERITY[sev]];
    const p = {};
    if (useArmor && sev > 0 && l.markedArmor < armorScore(c)) {   // ARMOR
      p.markedArmor = l.markedArmor + 1;
      sev -= 1;
      bits.push('an Armor Slot (' + l.markedArmor + ' → ' + p.markedArmor + ') makes it ' + SEVERITY[sev]);
    }
    const hp = Math.min(hpMax(c), l.markedHp + sev);
    if (sev) bits.push('HP ' + l.markedHp + ' → ' + hp);
    p.markedHp = hp;
    if (hp === hpMax(c) && hpMax(c) > 0 && l.markedHp < hp) bits.push('the last Hit Point: a death move');   // LAST_HP
    patch(m, p, bits.join(' · '));
  }

  // A roll resolved on the sheet: Hope spent on Experiences comes off first; then the outcome's
  // own words say what moves — "You gain a Hope" (with Hope, and a critical), "clear a Stress" (a
  // critical), "The GM gains a Fear" (with Fear).
  const lastRolls = {};   // a member's last roll, shown under the roller across the redraw its outcome causes
  function resolveRoll(m, r, spent) {
    lastRolls[m.id] = r;
    const l = live(m);
    let hope = l.hope - (spent || 0);
    const p = {};
    const bits = [];
    if (spent) bits.push('spent ' + spent + ' Hope');
    if (r.crit || r.withHope) hope = Math.min(HOPE_MAX(), hope + 1);
    if (hope !== l.hope) { p.hope = hope; bits.push('Hope ' + l.hope + ' → ' + hope); }
    if (r.crit && l.markedStress > 0) { p.markedStress = l.markedStress - 1; bits.push('Stress ' + l.markedStress + ' → ' + p.markedStress); }
    State().commit('appendLog', [Object.assign(Dice.logEntry(r, m.name), { memberId: m.id })]);
    if (Object.keys(p).length) patch(m, p, bits.join(' · '));
    if (!r.crit && !r.withHope) State().commit('addFear', [1, m.id]);
  }

  // ── resting: the downtime moves, read from their own text ──────────
  //   REST_MOVES "Each player can swap any domain cards in their loadout for cards in their vault,
  //              then choose two of the following moves (or choose the same move twice)."
  //              (core-mechanics.lore, Downtime)
  // A move's effect is read from its text: "clear a number of Hit Points equal to 1d4 + your tier",
  // "clear all Stress", "gain a Hope" (2 Hope, "If you choose to Prepare with one or more members of
  // your party"). A move whose text states none of these (Work on a Project) is logged as taken.
  const REST_MOVES = 2;
  const TRACKS = { 'Hit Points': 'markedHp', Stress: 'markedStress', 'Armor Slots': 'markedArmor' };
  function tierOf(c) {
    const lv = level(c);
    const t = D.byType('Tier Of Play').find((x) => lv >= (D.num(x, 'Minimum Level') || 0) && lv <= (D.num(x, 'Maximum Level') || 99));
    return t ? D.num(t, 'Tier') : 1;
  }
  function moveEffect(e) {
    const t = D.text(e, 'Description') || '';
    let mm = /clear a number of (Hit Points|Stress|Armor Slots) equal to 1d4 \+ your tier/.exec(t);
    if (mm) return { kind: 'dice', track: TRACKS[mm[1]], what: mm[1] };
    mm = /clear all (Hit Points|Stress|Armor Slots)/.exec(t);
    if (mm) return { kind: 'all', track: TRACKS[mm[1]], what: mm[1] };
    if (/gain a Hope/.test(t)) return { kind: 'hope', party: /you each gain 2 Hope/.test(t) };
    return null;
  }
  function takeRest(m, restType, picks, withParty) {
    const c = ch(m);
    let l = live(m);
    const p = {};
    const bits = [restType + ':'];
    const tier = tierOf(c);
    picks.forEach((e) => {
      const fx = moveEffect(e);
      const cur = (k) => (p[k] != null ? p[k] : l[k]);
      if (fx && fx.kind === 'dice') {
        const roll = 1 + Math.floor(Math.random() * 4);
        const n = roll + tier;
        const before = cur(fx.track);
        p[fx.track] = Math.max(0, before - n);
        bits.push(e.name + ' (1d4 ' + roll + ' + tier ' + tier + ' = ' + n + '): ' + fx.what + ' ' + before + ' → ' + p[fx.track]);
      } else if (fx && fx.kind === 'all') {
        bits.push(e.name + ': ' + fx.what + ' ' + cur(fx.track) + ' → 0');
        p[fx.track] = 0;
      } else if (fx && fx.kind === 'hope') {
        const gain = fx.party && withParty ? 2 : 1;
        const h = Math.min(HOPE_MAX(), cur('hope') + gain);
        bits.push(e.name + ': Hope ' + cur('hope') + ' → ' + h);
        p.hope = h;
      } else bits.push(e.name);
    });
    if (p.markedStress != null && p.markedStress < l.markedStress && l.conditions.indexOf('Vulnerable') !== -1 && l.markedStress === stressMax(c)) p.conditions = l.conditions.filter((x) => x !== 'Vulnerable');
    patch(m, p, bits.join(' · '));
  }
  function restBlock(m) {
    const box = el('div', { class: 'rest' });
    let type = null;
    let picks = [];
    let withParty = false;
    const draw = () => {
      box.innerHTML = '';
      box.appendChild(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['Rest']), ['Short Rest', 'Long Rest'].map((t) => button(t, () => { type = type === t ? null : t; picks = []; draw(); }, 'tiny' + (type === t ? ' on' : '')))]));
      if (!type) return;
      const moves = D.byType('Downtime Move').filter((e) => D.text(e, 'Rest Type') === type);
      box.appendChild(el('div', { class: 'muted small' }, ['Choose ' + REST_MOVES + ' (the same one twice is allowed): ' + picks.length + ' chosen']));
      moves.forEach((e) => {
        const n = picks.filter((x) => x === e).length;
        box.appendChild(el('div', { class: 'move' }, [
          button((n ? n + '× ' : '') + e.name, () => { if (picks.length < REST_MOVES) picks.push(e); draw(); }, 'tiny' + (n ? ' on' : '')),
          el('div', { class: 'small' }, [E.span(D.text(e, 'Description') || '', e.book)]),
        ]));
      });
      if (moves.some((e) => (moveEffect(e) || {}).party)) box.appendChild(el('label', { class: 'small' }, [el('input', { type: 'checkbox', checked: withParty || null, 'aria-label': 'Prepare with the party', onchange: (ev) => (withParty = ev.target.checked) }), ' Prepare with one or more members of the party']));
      const go = button('Take the ' + type.toLowerCase(), () => { takeRest(m, type, picks, withParty); type = null; picks = []; draw(); }, 'tiny');
      go.disabled = picks.length !== REST_MOVES;
      box.appendChild(el('div', { class: 'chiprow tight' }, [go, picks.length ? button('Clear the choice', () => { picks = []; draw(); }, 'ghost tiny') : null]));
    };
    draw();
    return box;
  }

  // ── building a member ──────────────────────────────────────────────
  const newId = () => (State() ? State().genId('pc') : 'pc-' + Math.random().toString(36).slice(2, 10));
  function blankCharacter(name) {
    const c = { Name: name || 'A new character', Level: dflt('Level', 1), Traits: {}, Stress: dflt('Stress', 6), Hope: dflt('Hope', 2), Proficiency: 1, Experiences: [], Gold: goldDefaults(), Inventory: [], 'Inventory Weapons': [], Loadout: [], Vault: [], 'Marked Traits': [] };
    traitNames().forEach((t) => (c.Traits[t] = 0));
    return c;
  }
  const refOf = (e) => (e ? { id: e.id, name: e.name } : null);
  // "0 Agility, −1 Strength, +1 Finesse, …" (a Character Guide's Suggested Traits)
  function parseTraits(s) {
    const out = {};
    String(s || '').split(',').forEach((part) => {
      const m = /([+−-]?\d+)\s+([A-Za-z]+)/.exec(part.trim());
      if (m) out[m[2]] = Number(m[1].replace('−', '-'));
    });
    return out;
  }
  // "Rapier - Presence Melee - d8 phy - One-Handed" → the corpus's Weapon (or Armor) of that name
  const printedItem = (s, type) => {
    const name = String(s || '').split(' - ')[0].trim();
    return name ? D.all().find((e) => e.name === name && e.type === type) || null : null;
  };
  // A member from the appendix's Character Guide: its class at level 1 with the guide's suggested
  // traits, weapons and armor; the class's starting Evasion and Hit Points.
  function memberFromGuide(guide, name) {
    const cls = refEntity(D.val(guide, 'Class'));
    const c = blankCharacter(name || (cls ? 'A ' + cls.name.toLowerCase() : 'A new character'));
    if (cls) {
      c.Class = refOf(cls);
      c.Evasion = D.num(cls, 'Starting Evasion');
      c['Hit Points'] = D.num(cls, 'Starting Hit Points');
    }
    c.Traits = Object.assign(c.Traits, parseTraits(D.text(guide, 'Suggested Traits')));
    const pw = printedItem(D.text(guide, 'Suggested Primary Weapon'), 'Weapon');
    const sw = printedItem(D.text(guide, 'Suggested Secondary Weapon'), 'Weapon');
    const ar = printedItem(D.text(guide, 'Suggested Armor'), 'Armor');
    if (pw) c['Primary Weapon'] = refOf(pw);
    if (sw) c['Secondary Weapon'] = refOf(sw);
    if (ar) { c['Active Armor'] = refOf(ar); c['Armor Score'] = D.num(ar, 'Base Score') || 0; }
    c['Damage Thresholds'] = null;
    return { id: newId(), templateId: ACTOR_ID, name: c.Name, character: c, live: {}, notes: '', source: { kind: 'guide', id: guide.id } };
  }
  function readMember(obj, fileName) {
    const src = obj && obj.character ? obj : { character: obj };
    const c = src.character || {};
    if (!c.Name) throw new Error((fileName || 'That file') + ' is not a Daggerheart character: it has no Name.');
    return { id: newId(), templateId: ACTOR_ID, name: c.Name, character: c, live: src.live || {}, notes: '', source: { kind: 'file', name: fileName || null } };
  }
  // A member from a fully built Character instance (a campaign's pre-made PC or NPC that EXTENDS the
  // Character ACTOR, rather than an appendix Guide): its actual fields — class(es) and subclass(es)
  // incl. a multiclass, heritage, traits, stats, experiences, loadout/vault, inventory — read into
  // the member's character map so the sheet renders it directly. Absent fields fall back to blanks.
  function memberFromCharacter(entity, name) {
    const nm = name || D.text(entity, 'Name') || entity.name;
    const c = blankCharacter(nm);
    c.Name = nm;
    const lv = D.num(entity, 'Level'); if (lv != null) c.Level = lv;
    const pr = D.text(entity, 'Pronouns'); if (pr) c.Pronouns = pr;
    ['Class', 'Subclass', 'Second Class', 'Second Subclass', 'Ancestry', 'Community',
     'Primary Weapon', 'Secondary Weapon', 'Active Armor'].forEach((f) => {
      const e = refEntity(D.val(entity, f)); if (e) c[f] = refOf(e);
    });
    ['Evasion', 'Hit Points', 'Stress', 'Hope', 'Proficiency', 'Armor Score'].forEach((f) => {
      const n = D.num(entity, f); if (n != null) c[f] = n;
    });
    const tr = D.defFields(D.prop(entity, 'Traits')); if (Object.keys(tr).length) c.Traits = Object.assign(c.Traits, tr);
    const dt = D.defFields(D.prop(entity, 'Damage Thresholds')); if (dt.Major != null || dt.Severe != null) c['Damage Thresholds'] = dt;
    const ep = D.prop(entity, 'Experiences');
    if (ep && ep.items) {
      c.Experiences = ep.items.map((it) => { const o = {}; (it.d || []).forEach((f) => (o[f.name] = f.value)); return { Name: o.Name, Modifier: o.Modifier }; }).filter((x) => x.Name);
    }
    ['Loadout', 'Vault', 'Inventory Weapons'].forEach((f) => {
      const p = D.prop(entity, f);
      if (p && p.items) c[f] = p.items.map((it) => (it.h ? { id: it.h, name: it.c } : null)).filter(Boolean);
    });
    const inv = D.val(entity, 'Inventory'); if (Array.isArray(inv)) c.Inventory = inv.slice();
    return { id: newId(), templateId: ACTOR_ID, name: c.Name, character: c, live: {}, notes: '', source: { kind: 'character', id: entity.id } };
  }
  // A member from a played Ranger Companion instance (a campaign's companion: a Ranger's companion,
  // a familiar). Its own frame — Evasion, Stress, a single Attack, Experiences, training upgrades,
  // and the character it is bonded to. `source.partner` is that character's name, so a player who
  // claims their character also gets control of the companion (engine/play.js).
  function memberFromCompanion(entity, name) {
    const nm = name || entity.name;
    const c = { Name: nm, Traits: {}, Experiences: [], Loadout: [], Vault: [], Inventory: [], 'Marked Traits': [] };
    const pr = D.text(entity, 'Pronouns'); if (pr) c.Pronouns = pr;
    const partner = D.text(entity, 'Partner'); if (partner) c.Partner = partner;
    const ev = D.num(entity, 'Evasion'); if (ev != null) c.Evasion = ev;
    const st = D.num(entity, 'Stress'); c.Stress = st != null ? st : 6;
    const at = D.prop(entity, 'Attack'); if (at) c.Attack = D.defFields(at);
    const ep = D.prop(entity, 'Experiences');
    if (ep && ep.items) c.Experiences = ep.items.map((it) => { const o = {}; (it.d || []).forEach((f) => (o[f.name] = f.value)); return { Name: o.Name, Modifier: o.Modifier }; }).filter((x) => x.Name);
    const up = D.prop(entity, 'Upgrades');
    if (up && up.items) c.Upgrades = up.items.map((it) => (it.h ? { id: it.h, name: it.c } : null)).filter(Boolean);
    return { id: newId(), templateId: COMPANION_ID, name: c.Name, character: c, live: {}, notes: '', source: { kind: 'companion', id: entity.id, partner: partner || null } };
  }
  function downloadMember(m) {
    const blob = new Blob([JSON.stringify({ kind: 'daggerheart-character', templateId: ACTOR_ID, character: ch(m), live: m.live || {} }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: String(m.name || 'character').replace(/[^\w\- ]+/g, '') + '.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function sentence(c) {
    const heritage = [c.Ancestry && c.Ancestry.name, c.Community && c.Community.name].filter(Boolean).join(' · ');
    const classes = [c.Class && c.Class.name, c['Second Class'] && c['Second Class'].name].filter(Boolean).join(' / ');
    const subs = [c.Subclass && c.Subclass.name, c['Second Subclass'] && c['Second Subclass'].name].filter(Boolean).join(' / ');
    return [classes, subs, 'level ' + level(c), heritage].filter(Boolean).join(' · ');
  }
  function tokenText(m) {
    const c = ch(m); const l = live(m);
    return 'HP ' + l.markedHp + '/' + hpMax(c) + ' · Stress ' + l.markedStress + '/' + stressMax(c) + ' · Hope ' + l.hope + (l.conditions.length ? ' · ' + l.conditions.join(', ') : '');
  }

  // ── drawing ────────────────────────────────────────────────────────
  // a track of boxes: tap a box to set the count to it (or one less, if it is the last marked)
  function track(label, n, marked, onSet, cls) {
    const boxes = [];
    for (let i = 1; i <= n; i++) boxes.push(el('button', { type: 'button', class: 'box' + (i <= marked ? ' on' : ''), 'aria-label': label + ' ' + i, onclick: () => onSet(i === marked ? i - 1 : i) }));
    return el('div', { class: 'track ' + (cls || '') }, [el('div', { class: 'track-k' }, [label, el('span', { class: 'muted' }, [' ' + marked + '/' + n])]), el('div', { class: 'boxes' }, boxes)]);
  }
  // a feature card: its name and type; tapped, it opens to its full text (L5R5e I13)
  const openCards = new Set();
  function featureCard(e, extra, pay) {
    const key = e.id;
    const body = el('div', { class: 'fcard-body' });
    const card = el('div', { class: 'fcard' + (openCards.has(key) ? ' open' : '') });
    const draw = () => { body.innerHTML = ''; if (openCards.has(key)) body.appendChild(E.render(e, { bare: true })); };
    card.appendChild(el('button', { type: 'button', class: 'fcard-head', onclick: () => { if (openCards.has(key)) openCards.delete(key); else openCards.add(key); card.classList.toggle('open'); draw(); } }, [
      el('span', { class: 'fcard-name' }, [e.name]), el('span', { class: 'muted small' }, [extra || D.text(e, 'Type') || e.type || '']),
    ]));
    // a card that costs something the player pays here: its cost buttons, so it is usable in place
    if (pay) {
      const costs = parseCosts(featureText(e));
      if (costs.length) card.appendChild(el('div', { class: 'chiprow tight fcard-costs' }, costs.map((cost) => button((cost.res === 'Hope' ? 'Spend ' : 'Mark ') + cost.n + ' ' + cost.res, () => pay(cost), 'tiny'))));
    }
    card.appendChild(body);
    draw();
    return card;
  }
  // the features a character has from its class, subclass (the cards taken), ancestry, community
  function features(c) {
    const out = [];
    const cls = refEntity(c.Class);
    if (cls) D.blockEntities(cls, 'FEATURES').forEach((f) => out.push({ e: f, from: cls.name }));
    const sub = refEntity(c.Subclass);
    if (sub) ['FOUNDATION'].concat(c['Subclass Card'] === 'Mastery' ? ['SPECIALIZATION', 'MASTERY'] : c['Subclass Card'] === 'Specialization' ? ['SPECIALIZATION'] : []).forEach((kw) => D.blockEntities(sub, kw).forEach((f) => out.push({ e: f, from: sub.name + ' · ' + kw.toLowerCase() })));
    // multiclass: a second class's features, and its subclass foundation
    const cls2 = refEntity(c['Second Class']);
    if (cls2) D.blockEntities(cls2, 'FEATURES').forEach((f) => out.push({ e: f, from: cls2.name }));
    const sub2 = refEntity(c['Second Subclass']);
    if (sub2) D.blockEntities(sub2, 'FOUNDATION').forEach((f) => out.push({ e: f, from: sub2.name + ' · foundation' }));
    const anc = refEntity(c.Ancestry);
    if (anc) D.blockEntities(anc, 'FEATURES').forEach((f) => out.push({ e: f, from: anc.name }));
    const com = refEntity(c.Community);
    if (com) D.blockEntities(com, 'FEATURES').forEach((f) => out.push({ e: f, from: com.name }));
    return out;
  }

  // a feature/card's text, flattened, for reading its costs and whether it bears on damage
  function featureText(e) {
    try { const d = el('div'); d.appendChild(E.render(e, { bare: true })); return d.textContent || ''; } catch (_) { return D.text(e, 'Description') || ''; }
  }
  // the costs a card names in its own words: "Spend a/N Hope", "Mark a/N Stress"
  function parseCosts(text) {
    const out = [];
    const t = String(text || '');
    const num = (s) => (/\d+/.test(s) ? parseInt(s, 10) : 1);
    let m;
    const hr = /\bspend\s+(a|an|one|\d+)\s+hope/ig; while ((m = hr.exec(t))) out.push({ res: 'Hope', n: num(m[1]) });
    const sr = /\bmark(?:ing)?\s+(a|an|one|\d+)\s+stress/ig; while ((m = sr.exec(t))) out.push({ res: 'Stress', n: num(m[1]) });
    const seen = {};
    return out.filter((x) => { const k = x.res + x.n; return seen[k] ? false : (seen[k] = 1); });
  }
  // the character's features and loadout cards whose text bears on a damage roll
  function damageAbilities(c) {
    const seen = {};
    const all = features(c).map((f) => f.e).concat((c.Loadout || []).map(refEntity).filter(Boolean));
    return all.filter((e) => { if (seen[e.id]) return false; seen[e.id] = 1; return /\bdamage\b/i.test(featureText(e)); });
  }
  // pay a card's cost against the live sheet (Spend Hope, Mark Stress)
  function payCost(m, cost) {
    const l = live(m);
    if (cost.res === 'Hope') {
      const h = l.hope != null ? l.hope : (ch(m).Hope || 0);
      if (h < cost.n) { logEvent(m, 'wanted to spend ' + cost.n + ' Hope but had ' + h); return; }
      patch(m, { hope: h - cost.n }, 'spent ' + cost.n + ' Hope');
    } else if (cost.res === 'Stress') {
      markStress(m, cost.n, 'marked ' + cost.n + ' Stress');
    }
  }

  // the damage roll: pick a weapon, add the modifiers a character's abilities grant (a flat bonus,
  // extra dice, rerolling low dice), see the result, and pay for the abilities that cost — the
  // damage-affecting features and cards are shown right here so they are options at the moment of use.
  function damagePanel(m) {
    const c = ch(m);
    const weapons = [['Primary', c['Primary Weapon']], ['Secondary', c['Secondary Weapon']]]
      .map(([k, r]) => [k, refEntity(r)]).filter((x) => x[1] && D.text(x[1], 'Damage'));
    const abilities = damageAbilities(c);
    if (!weapons.length && !abilities.length) return null;
    const st = { wi: 0, bonus: 0, extra: [], reroll: 0 };
    const box = el('div', { class: 'dmg-panel' });
    const out = el('div', { class: 'roll-out' });
    const draw = () => {
      box.innerHTML = '';
      box.appendChild(el('div', { class: 'prop-k' }, ['Damage']));
      if (weapons.length) {
        if (weapons.length > 1) box.appendChild(el('div', { class: 'chiprow tight' }, weapons.map(([k, w], i) => button(w.name, () => { st.wi = i; draw(); }, 'tiny' + (st.wi === i ? ' on' : '')))));
        const w = weapons[st.wi][1];
        const prof = proficiency(c);
        const rolledExpr = D.text(w, 'Damage').replace(/^\d*/, '');   // the character's Proficiency sets the die count
        box.appendChild(el('div', { class: 'muted small' }, [w.name + ' · ' + prof + rolledExpr]));
        const bonusIn = el('input', { type: 'number', class: 'text tiny-num', value: st.bonus || '', placeholder: '0', 'aria-label': 'Damage bonus', inputmode: 'numeric', oninput: (e) => (st.bonus = parseInt(e.target.value, 10) || 0) });
        const rerollSel = el('select', { class: 'scope tiny', 'aria-label': 'Reroll low dice' }, [['0', 'no reroll'], ['1', 'reroll 1s'], ['2', 'reroll 1s & 2s']].map(([v, lb]) => el('option', { value: v, selected: String(st.reroll) === v || null }, [lb])));
        rerollSel.addEventListener('change', () => (st.reroll = +rerollSel.value));
        box.appendChild(el('div', { class: 'dmg-mods' }, [
          el('label', { class: 'small' }, ['Bonus ', bonusIn]),
          el('span', { class: 'small' }, ['+ die ', [4, 6, 8, 10, 12].map((s) => button('d' + s, () => { st.extra = st.extra.concat([s]); draw(); }, 'ghost tiny'))]),
          st.extra.length ? el('span', { class: 'chip' }, ['+' + st.extra.map((s) => 'd' + s).join(' +'), el('button', { class: 'ref tiny', type: 'button', title: 'clear', onclick: () => { st.extra = []; draw(); } }, ['×'])]) : null,
          rerollSel,
        ]));
        box.appendChild(button('Roll damage', () => {
          const notes = st.reroll ? ['reroll ≤' + st.reroll] : [];
          const r = Dice.damageRoll(rolledExpr, prof, w.name, { bonus: st.bonus, extra: st.extra.slice(), reroll: st.reroll, notes });
          lastRolls['dmg-' + m.id] = r;
          out.innerHTML = ''; out.appendChild(Dice.resultView(r));
          State().commit('appendLog', [Object.assign(Dice.logEntry(r, m.name), { memberId: m.id })]);
          st.extra = [];
          draw();
        }, 'primary roll-btn'));
      }
      box.appendChild(out);
      if (lastRolls['dmg-' + m.id] && !out.firstChild) out.appendChild(Dice.resultView(lastRolls['dmg-' + m.id]));
      if (abilities.length) {
        box.appendChild(el('div', { class: 'prop-k' }, ['Abilities that affect damage']));
        box.appendChild(el('div', { class: 'fcards' }, abilities.map((e) => featureCard(e, null, (cost) => payCost(m, cost)))));
      }
    };
    draw();
    return box;
  }

  const rollers = {};
  const PANES = [['play', 'Play'], ['roll', 'Roll'], ['gear', 'Gear']];
  const panes = {};                    // the player's pane, kept across the redraws a change causes
  const paneOf = (m) => panes[m.id] || 'play';
  const notesTimers = {};
  const debounceNotes = (m) => (ev) => { clearTimeout(notesTimers[m.id]); const v = ev.target.value; notesTimers[m.id] = setTimeout(() => State().commit('setPartyPlayerNotes', [m.id, v]), 400); };
  // A companion's live sheet: its Evasion, a Stress track the player can mark and clear, its attack
  // (with a damage roll), its Experiences and training. Simpler than a character's — a companion
  // takes Stress, not HP, and has no traits, Hope or loadout.
  const companionLine = (c) => ['Companion', c.Partner ? '· ' + c.Partner : null].filter(Boolean).join(' ');
  function companionSheet(m, opts) {
    const o = opts || {};
    const c = ch(m); const l = live(m);
    const box = el('div', { class: 'sheet live companion' + (o.player ? ' player' : '') });
    const put = (n) => { if (n) box.appendChild(n); return n; };
    put(el('div', { class: 'sheet-head' }, [
      el('div', { class: 'sheet-name' }, [c.Name || m.name, c.Pronouns ? el('span', { class: 'muted small' }, [' (' + c.Pronouns + ')']) : null]),
      el('div', { class: 'muted small' }, [companionLine(c)]),
    ]));
    put(el('div', { class: 'sheet-stats' }, [
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Evasion']), el('div', { class: 'stat-v' }, [c.Evasion != null ? String(c.Evasion) : '—'])]),
    ]));
    put(track('Stress', stressMax(c), l.markedStress, (v) => (v > l.markedStress ? markStress(m, v - l.markedStress) : clearStress(m, l.markedStress - v)), 'stress'));
    const at = c.Attack || {};
    if (at.Name) {
      put(el('div', { class: 'prop-k' }, ['Attack']));
      const dmg = at.Damage || '';
      const die = (String(dmg).match(/d\d+/) || [''])[0];
      put(el('div', { class: 'weapon' }, [
        el('div', {}, [el('b', {}, [at.Name]), el('span', { class: 'muted small' }, [' · ' + [at.Range, dmg].filter(Boolean).join(' · ')])]),
        die ? button('Roll damage (' + (dmg || die) + ')', () => {
          const r = Dice.damageRoll(die, 1, at.Name);
          State().commit('appendLog', [Object.assign(Dice.logEntry(r, m.name), { memberId: m.id })]);
        }, 'ghost tiny') : null,
      ]));
    }
    const exps = (c.Experiences || []).map((x) => ({ name: x.Name || x.name, modifier: x.Modifier != null ? x.Modifier : x.modifier }));
    if (exps.length) put(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['Experience']), exps.map((x) => el('span', { class: 'chip' }, [x.name + ' ' + Dice.sign(Number(x.modifier) || 0)]))]));
    const ups = c.Upgrades || [];
    if (ups.length) put(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['Training']), ups.map((u) => el('span', { class: 'chip' }, [u.name]))]));
    return box;
  }
  function liveSheet(m, opts) {
    if (m && m.templateId === COMPANION_ID) return companionSheet(m, opts);
    const o = opts || {};
    const c = ch(m); const l = live(m);
    const tr = traits(c);
    const th = thresholds(c);
    const box = el('div', { class: 'sheet live' + (o.player ? ' player' : ''), 'data-show': o.player ? paneOf(m) : null });
    // each part of the sheet belongs to a pane; on a phone the player's copy shows one at a time
    // behind a bar at the bottom (L5R5e I11), and a wider screen shows them all
    const put = (pane, n) => { if (n) { n.setAttribute('data-pane', pane); box.appendChild(n); } return n; };
    // the head
    put('play', el('div', { class: 'sheet-head' }, [
      el('div', { class: 'sheet-name' }, [c.Name || m.name, c.Pronouns ? el('span', { class: 'muted small' }, [' (' + c.Pronouns + ')']) : null]),
      el('div', { class: 'muted small' }, [sentence(c)]),
    ]));
    // Evasion, Armor, thresholds
    put('play', el('div', { class: 'sheet-stats' }, [
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Evasion']), el('div', { class: 'stat-v' }, [c.Evasion != null ? String(c.Evasion) : '—'])]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Armor']), el('div', { class: 'stat-v' }, [String(armorScore(c))])]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Major']), el('div', { class: 'stat-v' }, [String(th.Major)])]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Severe']), el('div', { class: 'stat-v' }, [String(th.Severe)])]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Proficiency']), el('div', { class: 'stat-v' }, [String(proficiency(c))])]),
    ]));
    // the trackers
    put('play', track('HP', hpMax(c), l.markedHp, (v) => patch(m, { markedHp: v }, 'HP ' + l.markedHp + ' → ' + v), 'hp'));
    put('play', track('Stress', stressMax(c), l.markedStress, (v) => (v > l.markedStress ? markStress(m, v - l.markedStress) : clearStress(m, l.markedStress - v)), 'stress'));
    put('play', track('Hope', HOPE_MAX(), l.hope, (v) => patch(m, { hope: v }, 'Hope ' + l.hope + ' → ' + v), 'hope'));
    put('play', track('Armor Slots', armorScore(c), l.markedArmor, (v) => patch(m, { markedArmor: v }, 'Armor Slots ' + l.markedArmor + ' → ' + v), 'armor'));
    // damage taken: a number the player types, with its severity read beside it
    const sevEl = el('span', { class: 'muted small' });
    const dmgInput = el('input', { type: 'number', class: 'text dmg-input', min: '0', max: '999', value: '', placeholder: '0', 'aria-label': 'Damage taken', inputmode: 'numeric' });
    const readDmg = () => Math.max(0, parseInt(dmgInput.value, 10) || 0);
    dmgInput.addEventListener('input', () => { const v = readDmg(); sevEl.textContent = v ? SEVERITY[severity(c, v)] : ''; });
    const withArmor = button('Take it with an Armor Slot', () => { const v = readDmg(); if (v) takeDamage(m, v, true); }, 'ghost tiny');
    withArmor.disabled = l.markedArmor >= armorScore(c);
    const dmgRow = el('div', { class: 'dmg-row' }, [
      el('span', { class: 'prop-k' }, ['Damage taken']),
      dmgInput,
      sevEl,
      button('Take it', () => { const v = readDmg(); if (v) takeDamage(m, v, false); }, 'tiny'),
      withArmor,
    ]);
    put('play', dmgRow);
    // conditions
    put('play', el('div', { class: 'chiprow tight conditions' }, conditions().map((x) => {
      const on = l.conditions.indexOf(x.name) !== -1;
      return el('button', { type: 'button', class: 'btn tiny' + (on ? ' on' : ''), title: x.text, onclick: () => patch(m, { conditions: on ? l.conditions.filter((y) => y !== x.name) : l.conditions.concat([x.name]) }, x.name + (on ? ' — cleared' : ' — gained')) }, [x.name]);
    })));
    put('play', restBlock(m));
    // the roller: the character's traits and Experiences, Hope to spend
    const exps = (c.Experiences || []).map((x) => ({ name: x.Name || x.name, modifier: x.Modifier != null ? x.Modifier : x.modifier }));
    put('roll', el('div', { class: 'prop-k' }, ['Action roll']));
    put('roll', Dice.roller({ traits: tr, experiences: exps, hope: l.hope, label: null, onResolve: (r, spent) => resolveRoll(m, r, spent) }));
    if (lastRolls[m.id]) put('roll', el('div', { class: 'last-roll' }, [el('div', { class: 'muted small' }, ['The last roll']), Dice.resultView(lastRolls[m.id])]));
    // the damage roll and the abilities that shape it, together on the Roll pane
    put('roll', damagePanel(m));
    // weapons (reference; the damage is rolled in the panel above)
    const weapons = [['Primary', c['Primary Weapon']], ['Secondary', c['Secondary Weapon']]].map(([k, r]) => [k, refEntity(r)]).filter((x) => x[1]);
    if (weapons.length) {
      put('gear', el('div', { class: 'prop-k' }, ['Active weapons']));
      put('gear', el('div', { class: 'weapons' }, weapons.map(([k, w]) => {
        const dmgExpr = D.text(w, 'Damage');
        return el('div', { class: 'weapon' }, [
          el('div', {}, [el('b', {}, [w.name]), el('span', { class: 'muted small' }, [' · ' + k + ' · ' + [D.text(w, 'Trait'), D.text(w, 'Range'), dmgExpr, D.text(w, 'Burden')].filter(Boolean).join(' · ')])]),
          D.text(w, 'Feature') ? el('div', { class: 'small' }, [E.span(D.text(w, 'Feature'), w.book)]) : null,
        ]);
      })));
    }
    // features and cards — those that name a cost are tapped to spend it (payCost); the Experiences
    // themselves are chosen in the roller above, so no separate list here
    const pay = (cost) => payCost(m, cost);
    const fs = features(c);
    if (fs.length) {
      put('play', el('div', { class: 'prop-k' }, ['Features']));
      put('play', el('div', { class: 'fcards' }, fs.map((f) => featureCard(f.e, f.from, pay))));
    }
    const cards = (c.Loadout || []).map(refEntity).filter(Boolean);
    if (cards.length) {
      put('play', el('div', { class: 'prop-k' }, ['Loadout']));
      put('play', el('div', { class: 'fcards' }, cards.map((e) => featureCard(e, [(D.val(e, 'Domain') || {}).name, 'level ' + D.num(e, 'Domain Level'), D.text(e, 'Type')].filter(Boolean).join(' · '), pay))));
    }
    // gold and inventory
    const g = Object.assign(goldDefaults(), l.gold || {});
    put('gear', el('div', { class: 'chiprow tight gold' }, [el('span', { class: 'prop-k' }, ['Gold']), Object.keys(g).map((k) => Dice.stepper(k, () => g[k], (v) => patch(m, { gold: Object.assign({}, g, { [k]: v }) }, 'Gold: ' + k + ' ' + g[k] + ' → ' + v), { min: 0, max: k === 'Chest' ? 99 : 9 }))]));
    const inv = [].concat(c.Inventory || [], (c['Inventory Weapons'] || []).map((r) => (r && r.name) || r));
    if (inv.length) put('gear', el('div', {}, [el('div', { class: 'prop-k' }, ['Inventory']), el('ul', { class: 'items' }, inv.map((x) => el('li', {}, [String(x)])))]));
    if (o.player) {
      put('gear', el('div', { class: 'player-notes' }, [el('div', { class: 'prop-k' }, ['My notes']), el('textarea', { class: 'text', rows: 4, 'aria-label': 'My notes', oninput: debounceNotes(m) }, [m.playerNotes || ''])]));
      box.appendChild(el('nav', { class: 'pane-nav' }, PANES.map(([id, label]) => el('button', { type: 'button', class: paneOf(m) === id ? 'on' : null, onclick: () => { panes[m.id] = id; box.setAttribute('data-show', id); box.querySelectorAll('.pane-nav button').forEach((b, i) => b.classList.toggle('on', PANES[i][0] === id)); window.scrollTo(0, 0); } }, [label]))));
    }
    return box;
  }

  // ── an adversary at the GM's table: its roll, its damage, its marks (GM-only npcState) ──
  function adversaryBlock(e, inst) {
    const key = (inst && inst.iid) || e.id;                 // one tracked copy (a scene-cast instance) or the entity
    const label = (inst && inst.label) || e.name;
    const st = Object.assign({ hp: 0, stress: 0 }, ((State().state.npcState || {})[key]) || {});
    const setSt = (p, text) => { State().commit('setNpcState', [key, Object.assign({}, st, p)]); if (text) State().commit('appendLog', [{ at: Date.now(), kind: 'event', who: 'GM · ' + label, text }]); };
    const hp = D.num(e, 'Hit Points') || 0;
    const stress = D.num(e, 'Stress') || 0;
    const atk = D.num(e, 'Attack Modifier') || 0;
    const a = D.block(e, 'ATTACK');
    const attack = a && a.body && a.body[0] && a.body[0].vk === 'def' ? a.body[0] : null;
    const af = attack ? D.defFields(attack) : {};
    let adv = 0; let dis = 0; let diff = 0;
    const out = el('div', { class: 'roll-out' });
    const box = el('div', { class: 'adversary-live' }, [
      hp ? track('HP', hp, st.hp, (v) => setSt({ hp: v }, 'HP ' + st.hp + ' → ' + v)) : null,
      stress ? track('Stress', stress, st.stress, (v) => setSt({ stress: v }, 'Stress ' + st.stress + ' → ' + v)) : null,
      el('div', { class: 'chiprow tight' }, [
        Dice.stepper('Advantage', () => adv, (v) => (adv = v), { min: 0, max: 5 }),
        Dice.stepper('Disadvantage', () => dis, (v) => (dis = v), { min: 0, max: 5 }),
        Dice.stepper('Evasion', () => diff, (v) => (diff = v), { min: 0, max: 40, show: (v) => (v ? String(v) : '—') }),
      ]),
      el('div', { class: 'chiprow tight' }, [
        button('Attack: d20 ' + Dice.sign(atk), () => {
          const r = Dice.gmRoll({ modifier: atk, advantage: adv, disadvantage: dis, difficulty: diff || null, label: label + (attack ? ' · ' + attack.name : '') });
          out.innerHTML = ''; out.appendChild(Dice.resultView(r));
          State().commit('appendLog', [Dice.logEntry(r, 'GM')]);
        }, 'tiny'),
        af.Damage ? button('Damage ' + af.Damage, () => {
          const r = Dice.damageRoll(af.Damage, 1, label + (attack ? ' · ' + attack.name : ''));
          out.innerHTML = ''; out.appendChild(Dice.resultView(r));
          State().commit('appendLog', [Dice.logEntry(r, 'GM')]);
        }, 'ghost tiny') : null,
      ]),
      out,
    ]);
    return box;
  }

  return {
    ACTOR_ID, COMPANION_ID, companionLine, spec, conditions, thresholds, armorScore, severity, traits, live, liveSheet, memberFromGuide, memberFromCharacter, memberFromCompanion, readMember, downloadMember,
    sentence, tokenText, blankCharacter, parseTraits, features, featureCard, adversaryBlock, markStress, clearStress, takeDamage, resolveRoll, patch, refEntity,
    takeRest, moveEffect, tierOf,
    readMemberFile: readMember,
  };
})();
