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
  function downloadMember(m) {
    const blob = new Blob([JSON.stringify({ kind: 'daggerheart-character', templateId: ACTOR_ID, character: ch(m), live: m.live || {} }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: String(m.name || 'character').replace(/[^\w\- ]+/g, '') + '.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function sentence(c) {
    const heritage = [c.Ancestry && c.Ancestry.name, c.Community && c.Community.name].filter(Boolean).join(' · ');
    return [c.Class && c.Class.name, c.Subclass && c.Subclass.name, 'level ' + level(c), heritage].filter(Boolean).join(' · ');
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
  function featureCard(e, extra) {
    const key = e.id;
    const body = el('div', { class: 'fcard-body' });
    const card = el('div', { class: 'fcard' + (openCards.has(key) ? ' open' : '') });
    const draw = () => { body.innerHTML = ''; if (openCards.has(key)) body.appendChild(E.render(e, { bare: true })); };
    card.appendChild(el('button', { type: 'button', class: 'fcard-head', onclick: () => { if (openCards.has(key)) openCards.delete(key); else openCards.add(key); card.classList.toggle('open'); draw(); } }, [
      el('span', { class: 'fcard-name' }, [e.name]), el('span', { class: 'muted small' }, [extra || D.text(e, 'Type') || e.type || '']),
    ]));
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
    const anc = refEntity(c.Ancestry);
    if (anc) D.blockEntities(anc, 'FEATURES').forEach((f) => out.push({ e: f, from: anc.name }));
    const com = refEntity(c.Community);
    if (com) D.blockEntities(com, 'FEATURES').forEach((f) => out.push({ e: f, from: com.name }));
    return out;
  }

  const rollers = {};
  function liveSheet(m, opts) {
    const o = opts || {};
    const c = ch(m); const l = live(m);
    const tr = traits(c);
    const th = thresholds(c);
    const box = el('div', { class: 'sheet' + (o.player ? ' player' : '') });
    // the head
    box.appendChild(el('div', { class: 'sheet-head' }, [
      el('div', { class: 'sheet-name' }, [c.Name || m.name, c.Pronouns ? el('span', { class: 'muted small' }, [' (' + c.Pronouns + ')']) : null]),
      el('div', { class: 'muted small' }, [sentence(c)]),
    ]));
    // Evasion, Armor, thresholds
    box.appendChild(el('div', { class: 'sheet-stats' }, [
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Evasion']), el('div', { class: 'stat-v' }, [c.Evasion != null ? String(c.Evasion) : '—'])]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Armor']), el('div', { class: 'stat-v' }, [String(armorScore(c))])]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Major']), el('div', { class: 'stat-v' }, [String(th.Major)])]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Severe']), el('div', { class: 'stat-v' }, [String(th.Severe)])]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, ['Proficiency']), el('div', { class: 'stat-v' }, [String(proficiency(c))])]),
    ]));
    // the trackers
    box.appendChild(track('HP', hpMax(c), l.markedHp, (v) => patch(m, { markedHp: v }, 'HP ' + l.markedHp + ' → ' + v), 'hp'));
    box.appendChild(track('Stress', stressMax(c), l.markedStress, (v) => (v > l.markedStress ? markStress(m, v - l.markedStress) : clearStress(m, l.markedStress - v)), 'stress'));
    box.appendChild(track('Hope', HOPE_MAX(), l.hope, (v) => patch(m, { hope: v }, 'Hope ' + l.hope + ' → ' + v), 'hope'));
    box.appendChild(track('Armor Slots', armorScore(c), l.markedArmor, (v) => patch(m, { markedArmor: v }, 'Armor Slots ' + l.markedArmor + ' → ' + v), 'armor'));
    // damage: the stepper stays put while its severity reads beside it
    let dmg = 0;
    const sevEl = el('span', { class: 'muted small' });
    const withArmor = button('Take it with an Armor Slot', () => { if (dmg) takeDamage(m, dmg, true); }, 'ghost tiny');
    withArmor.disabled = l.markedArmor >= armorScore(c);
    const dmgRow = el('div', { class: 'dmg-row' }, [
      Dice.stepper('Damage', () => dmg, (v) => { dmg = v; sevEl.textContent = v ? SEVERITY[severity(c, v)] : ''; }, { min: 0, max: 99 }),
      sevEl,
      button('Take it', () => { if (dmg) takeDamage(m, dmg, false); }, 'tiny'),
      withArmor,
    ]);
    box.appendChild(dmgRow);
    // conditions
    box.appendChild(el('div', { class: 'chiprow tight conditions' }, conditions().map((x) => {
      const on = l.conditions.indexOf(x.name) !== -1;
      return el('button', { type: 'button', class: 'btn tiny' + (on ? ' on' : ''), title: x.text, onclick: () => patch(m, { conditions: on ? l.conditions.filter((y) => y !== x.name) : l.conditions.concat([x.name]) }, x.name + (on ? ' — cleared' : ' — gained')) }, [x.name]);
    })));
    // the roller: the character's traits and Experiences, Hope to spend
    const exps = (c.Experiences || []).map((x) => ({ name: x.Name || x.name, modifier: x.Modifier != null ? x.Modifier : x.modifier }));
    box.appendChild(el('div', { class: 'prop-k' }, ['Roll']));
    box.appendChild(Dice.roller({ traits: tr, experiences: exps, hope: l.hope, label: null, onResolve: (r, spent) => resolveRoll(m, r, spent) }));
    if (lastRolls[m.id]) box.appendChild(el('div', { class: 'last-roll' }, [el('div', { class: 'muted small' }, ['The last roll']), Dice.resultView(lastRolls[m.id])]));
    // weapons
    const weapons = [['Primary', c['Primary Weapon']], ['Secondary', c['Secondary Weapon']]].map(([k, r]) => [k, refEntity(r)]).filter((x) => x[1]);
    if (weapons.length) {
      box.appendChild(el('div', { class: 'prop-k' }, ['Active weapons']));
      box.appendChild(el('div', { class: 'weapons' }, weapons.map(([k, w]) => {
        const dmgExpr = D.text(w, 'Damage');
        return el('div', { class: 'weapon' }, [
          el('div', {}, [el('b', {}, [w.name]), el('span', { class: 'muted small' }, [' · ' + k + ' · ' + [D.text(w, 'Trait'), D.text(w, 'Range'), dmgExpr, D.text(w, 'Burden')].filter(Boolean).join(' · ')])]),
          D.text(w, 'Feature') ? el('div', { class: 'small' }, [E.span(D.text(w, 'Feature'), w.book)]) : null,
          dmgExpr ? button('Roll damage (' + proficiency(c) + dmgExpr.replace(/^\d*/, '') + ')', () => {
            const r = Dice.damageRoll(dmgExpr.replace(/^\d*/, ''), proficiency(c), w.name);
            State().commit('appendLog', [Object.assign(Dice.logEntry(r, m.name), { memberId: m.id })]);
          }, 'ghost tiny') : null,
        ]);
      })));
    }
    // experiences
    if (exps.length) box.appendChild(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['Experience']), exps.map((x) => el('span', { class: 'chip' }, [x.name + ' ' + Dice.sign(Number(x.modifier) || 0)]))]));
    // features and cards
    const fs = features(c);
    if (fs.length) {
      box.appendChild(el('div', { class: 'prop-k' }, ['Features']));
      box.appendChild(el('div', { class: 'fcards' }, fs.map((f) => featureCard(f.e, f.from))));
    }
    const cards = (c.Loadout || []).map(refEntity).filter(Boolean);
    if (cards.length) {
      box.appendChild(el('div', { class: 'prop-k' }, ['Loadout']));
      box.appendChild(el('div', { class: 'fcards' }, cards.map((e) => featureCard(e, [(D.val(e, 'Domain') || {}).name, 'level ' + D.num(e, 'Domain Level'), D.text(e, 'Type')].filter(Boolean).join(' · ')))));
    }
    // gold and inventory
    const g = Object.assign(goldDefaults(), l.gold || {});
    box.appendChild(el('div', { class: 'chiprow tight gold' }, [el('span', { class: 'prop-k' }, ['Gold']), Object.keys(g).map((k) => Dice.stepper(k, () => g[k], (v) => patch(m, { gold: Object.assign({}, g, { [k]: v }) }, 'Gold: ' + k + ' ' + g[k] + ' → ' + v), { min: 0, max: k === 'Chest' ? 99 : 9 }))]));
    const inv = [].concat(c.Inventory || [], (c['Inventory Weapons'] || []).map((r) => (r && r.name) || r));
    if (inv.length) box.appendChild(el('div', {}, [el('div', { class: 'prop-k' }, ['Inventory']), el('ul', { class: 'items' }, inv.map((x) => el('li', {}, [String(x)])))]));
    return box;
  }

  // ── an adversary at the GM's table: its roll, its damage, its marks (GM-only npcState) ──
  function adversaryBlock(e) {
    const st = Object.assign({ hp: 0, stress: 0 }, ((State().state.npcState || {})[e.id]) || {});
    const setSt = (p, text) => { State().commit('setNpcState', [e.id, Object.assign({}, st, p)]); if (text) State().commit('appendLog', [{ at: Date.now(), kind: 'event', who: 'GM · ' + e.name, text }]); };
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
          const r = Dice.gmRoll({ modifier: atk, advantage: adv, disadvantage: dis, difficulty: diff || null, label: e.name + (attack ? ' · ' + attack.name : '') });
          out.innerHTML = ''; out.appendChild(Dice.resultView(r));
          State().commit('appendLog', [Dice.logEntry(r, 'GM')]);
        }, 'tiny'),
        af.Damage ? button('Damage ' + af.Damage, () => {
          const r = Dice.damageRoll(af.Damage, 1, e.name + (attack ? ' · ' + attack.name : ''));
          out.innerHTML = ''; out.appendChild(Dice.resultView(r));
          State().commit('appendLog', [Dice.logEntry(r, 'GM')]);
        }, 'ghost tiny') : null,
      ]),
      out,
    ]);
    return box;
  }

  return {
    ACTOR_ID, spec, conditions, thresholds, armorScore, severity, traits, live, liveSheet, memberFromGuide, readMember, downloadMember,
    sentence, tokenText, blankCharacter, parseTraits, features, featureCard, adversaryBlock, markStress, clearStress, takeDamage, resolveRoll, patch, refEntity,
    readMemberFile: readMember,
  };
})();
