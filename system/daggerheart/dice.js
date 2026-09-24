// system/daggerheart/dice.js — the Duality Dice, the GM's d20, and damage.
//
// The five outcomes and their words are the corpus's (`^"Action Roll"` OUTCOMES, verbatim). How
// a roll is read is the book's prose, so each piece is a named constant citing its sentence:
//
//   HOPE_FEAR   "When you roll your Duality Dice and the Hope Die rolls higher than the Fear Die,
//               you roll with Hope." / "…the Fear Die rolls higher than the Hope Die, you roll
//               with Fear." (core-mechanics.lore, Hope and Fear)
//   CRITICAL    "When you roll the Duality Dice and both dice roll the same number, that is a
//               critical success. A critical success counts as a roll with Hope, even if you
//               would've otherwise failed because the total is lower than the roll's Difficulty."
//   SUCCEEDS    "If your total meets or exceeds the Difficulty, the action succeeds"
//   ADVANTAGE   "When you roll with advantage, you add a d6 advantage die to your total." /
//               "When you roll with disadvantage, you subtract a d6 disadvantage die from your
//               total." / "Advantage and disadvantage always cancel each other out … if you have
//               two sources of advantage and one of disadvantage, one of the advantage dice and
//               the disadvantage die cancel each other out, so you would have advantage on the
//               roll."
//   EXPERIENCE  "Before you make an action or reaction roll, you can spend a Hope to add the
//               Experience's modifier to the roll's result." (character-creation.lore, Step 7)
//   NPC_ADV     "NPCs can also roll with advantage (or disadvantage), but when they do, the GM
//               rolls an additional d20 and picks the highest (or lowest) result"
//   HOPE_MAX    "you gain a Hope (to a maximum of 6)" (character-creation.lore, Hope and Fear)
//   FEAR_MAX    "You can hold up to a maximum of 12 Fear." (gm-guidance.lore)
window.DHDice = (function () {
  const { el } = window.VttRender;
  const D = window.DHData;
  const DUALITY = 12;       // "roll 2d12 (Hope + Fear)" — the Action Roll's own rule line
  const ADV_DIE = 6;
  const GM_DIE = 20;
  const HOPE_MAX = 6;
  const FEAR_MAX = 12;

  const d = (n) => 1 + Math.floor(Math.random() * n);

  // The outcomes as the corpus prints them: {name → text}.
  function outcomes() {
    const ar = D.entity('#daggerheartActionRoll000000001');
    const b = ar ? D.block(ar, 'OUTCOMES') : null;
    const out = {};
    ((b && b.body) || []).forEach((row) => { if ('s' in row && row.args && row.args[0]) out[row.s] = row.args[0].s; });
    return out;
  }

  // The six traits, in the book's order, with their verbs (the ^"Trait" ENUM and DESCRIPTION).
  function traits() {
    const t = D.entity('#daggerheartTrait00000000000001');
    const names = t ? ((t.blocks || []).find((b) => b.kw === 'ENUM') || { args: [] }).args.reduce((a, x) => a.concat(x.l ? x.l.map(D.arg) : []), []) : [];
    const verbs = {};
    String((t && t.desc) || '').split('\n').forEach((ln) => {
      const m = /^\s*([A-Za-z]+):\s*(.+)$/.exec(ln);
      if (m) verbs[m[1]] = m[2].trim();
    });
    return names.map((n) => ({ name: n, verbs: verbs[n] || '' }));
  }

  // net advantage: each disadvantage cancels one advantage (ADVANTAGE)
  const net = (adv, dis) => (adv || 0) - (dis || 0);

  // An action roll. o: {modifier, experiences: [{name, modifier}], advantage, disadvantage,
  // difficulty (a number, or null when the GM keeps it), bonus: [{label, value}]}
  function actionRoll(o) {
    o = o || {};
    const hope = d(DUALITY);
    const fear = d(DUALITY);
    const n = net(o.advantage, o.disadvantage);
    const advDie = n > 0 ? d(ADV_DIE) : null;
    const disDie = n < 0 ? d(ADV_DIE) : null;
    const exps = (o.experiences || []).filter(Boolean);
    const bonus = (o.bonus || []).filter((b) => b && b.value);
    const modifier = Number(o.modifier) || 0;
    const total = hope + fear + modifier
      + exps.reduce((a, x) => a + (Number(x.modifier) || 0), 0)
      + bonus.reduce((a, x) => a + (Number(x.value) || 0), 0)
      + (advDie || 0) - (disDie || 0);
    const crit = hope === fear;
    const withHope = crit || hope > fear;
    const difficulty = o.difficulty == null || o.difficulty === '' ? null : Number(o.difficulty);
    const success = crit ? true : difficulty == null ? null : total >= difficulty;
    const name = crit ? 'Critical Success' : success == null ? null : (success ? 'Success' : 'Failure') + ' with ' + (withHope ? 'Hope' : 'Fear');
    return {
      kind: 'action', hope, fear, advDie, disDie, modifier, experiences: exps, bonus, total, crit, withHope,
      difficulty, success, outcome: name, outcomeText: name ? outcomes()[name] || null : null,
      trait: o.trait || null, label: o.label || null, at: Date.now(),
    };
  }

  // The GM's roll for an adversary: d20 + its attack modifier; with advantage, an extra d20 and
  // the highest (NPC_ADV).
  function gmRoll(o) {
    o = o || {};
    const n = net(o.advantage, o.disadvantage);
    const dice = [d(GM_DIE)].concat(n ? [d(GM_DIE)] : []);
    const kept = n > 0 ? Math.max.apply(null, dice) : n < 0 ? Math.min.apply(null, dice) : dice[0];
    const modifier = Number(o.modifier) || 0;
    const total = kept + modifier;
    const difficulty = o.difficulty == null || o.difficulty === '' ? null : Number(o.difficulty);
    return { kind: 'gm', dice, kept, modifier, total, difficulty, success: difficulty == null ? null : total >= difficulty, label: o.label || null, at: Date.now() };
  }

  // A damage expression as the book prints it: "1d8+3", "2d6+3 phy", "d8+1 mag", "1d12+2".
  const DMG = /^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*(phy|mag)?/i;
  function parseDamage(expr, proficiency) {
    const m = DMG.exec(String(expr || ''));
    if (!m) return null;
    return { count: m[1] ? Number(m[1]) : (proficiency || 1), sides: Number(m[2]), plus: m[4] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0, type: m[5] || null };
  }
  // opts: { bonus, extra:[sides…] (extra damage dice to add), reroll (reroll any die ≤ this once),
  // notes:[label] (the abilities the player applied, shown and logged) }
  function damageRoll(expr, proficiency, label, opts) {
    const p = parseDamage(expr, proficiency);
    if (!p) return null;
    opts = opts || {};
    const main = Array.from({ length: p.count }, () => ({ sides: p.sides, v: d(p.sides) }));
    const extra = (opts.extra || []).map((s) => ({ sides: s, v: d(s), extra: true }));
    const all = main.concat(extra);
    let rerolled = 0;
    if (opts.reroll) all.forEach((x) => { if (x.v <= opts.reroll) { x.was = x.v; x.v = d(x.sides); rerolled += 1; } });
    const bonus = Number(opts.bonus) || 0;
    const total = all.reduce((a, x) => a + x.v, 0) + p.plus + bonus;
    return { kind: 'damage', expr: String(expr), dice: all.map((x) => x.v), diceDetail: all, sides: p.sides, plus: p.plus, bonus, type: p.type, reroll: opts.reroll || 0, rerolled, notes: opts.notes || [], total, label: label || null, at: Date.now() };
  }

  // ── drawing ────────────────────────────────────────────────────────
  const sign = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
  // the die's shape is the Daggerheart system's own icon (assets/icons/dice/<cat>/d<sides>.svg,
  // pulled from the Foundry module), with the rolled value read on top.
  const SHAPE = { hope: 'hope-d12', fear: 'fear-d12', adv: 'adv-d6', dis: 'disadv-d6' };
  function die(v, cls, title, sides) {
    const base = String(cls).split(' ')[0];
    let shape = SHAPE[base] || null;
    if (base === 'dmg') shape = 'default-d' + (sides || 6);
    else if (base === 'd20' || base === 'gm') shape = 'default-d20';
    return el('span', { class: 'die ' + cls, 'data-shape': shape, title }, [String(v)]);
  }
  function resultView(r) {
    if (!r) return null;
    if (r.kind === 'gm') return el('div', { class: 'roll-result gm' }, [
      el('div', { class: 'dice-row' }, r.dice.map((x, i) => die(x, 'd20' + (r.dice.length > 1 && x !== r.kept ? ' dropped' : ''), 'd20'))),
      el('div', { class: 'roll-total' }, [String(r.total)]),
      el('div', { class: 'muted small' }, ['d20 ' + r.kept + (r.modifier ? ' ' + sign(r.modifier) : '') + (r.difficulty != null ? ' vs ' + r.difficulty + ' — ' + (r.success ? 'hits' : 'misses') : '')]),
    ]);
    if (r.kind === 'damage') {
      const detail = r.diceDetail || r.dice.map((v) => ({ sides: r.sides, v }));
      const parts = [r.expr];
      if (r.bonus) parts.push('bonus ' + sign(r.bonus));
      if (r.rerolled) parts.push('rerolled ' + r.rerolled + ' (≤' + r.reroll + ')');
      (r.notes || []).forEach((n) => parts.push(n));
      return el('div', { class: 'roll-result dmg' }, [
        el('div', { class: 'dice-row' }, detail.map((x) => die(x.v, 'dmg' + (x.extra ? ' extra' : '') + (x.was != null ? ' rerolled' : ''), 'd' + x.sides + (x.was != null ? ' — was ' + x.was : ''), x.sides))),
        el('div', { class: 'roll-total' }, [String(r.total), r.type ? el('span', { class: 'with' }, [' ' + (r.type === 'phy' ? 'physical' : r.type === 'mag' ? 'magic' : r.type)]) : null]),
        el('div', { class: 'muted small' }, [parts.join(' · ')]),
      ]);
    }
    const parts = ['Hope ' + r.hope, 'Fear ' + r.fear];
    if (r.modifier) parts.push((r.trait || 'modifier') + ' ' + sign(r.modifier));
    r.experiences.forEach((x) => parts.push(x.name + ' ' + sign(Number(x.modifier) || 0)));
    r.bonus.forEach((x) => parts.push(x.label + ' ' + sign(Number(x.value) || 0)));
    if (r.advDie) parts.push('advantage +' + r.advDie);
    if (r.disDie) parts.push('disadvantage −' + r.disDie);
    return el('div', { class: 'roll-result action ' + (r.crit ? 'crit' : r.withHope ? 'hope' : 'fear') }, [
      el('div', { class: 'dice-row' }, [die(r.hope, 'hope', 'Hope Die'), die(r.fear, 'fear', 'Fear Die'),
        r.advDie ? die('+' + r.advDie, 'adv', 'advantage d6') : null, r.disDie ? die('−' + r.disDie, 'dis', 'disadvantage d6') : null]),
      el('div', { class: 'roll-total' }, [String(r.total), el('span', { class: 'with' }, [r.crit ? ' critical' : r.withHope ? ' with Hope' : ' with Fear'])]),
      el('div', { class: 'muted small' }, [parts.join(' · ') + (r.difficulty != null ? ' · Difficulty ' + r.difficulty : '')]),
      r.outcome ? el('div', { class: 'outcome' }, [el('b', {}, [r.outcome]), r.outcomeText ? el('div', { class: 'small' }, [r.outcomeText]) : null]) : null,
    ]);
  }

  // one line for a log: who, what, the result
  function logEntry(r, who, extra) {
    return Object.assign({ kind: 'roll', who: who || null, roll: r, at: r.at }, extra || {});
  }
  function logText(r) {
    if (r.kind === 'gm') return (r.label ? r.label + ': ' : '') + 'd20 ' + r.kept + (r.modifier ? ' ' + sign(r.modifier) : '') + ' = ' + r.total + (r.difficulty != null ? ' vs ' + r.difficulty + (r.success ? ' — hits' : ' — misses') : '');
    if (r.kind === 'damage') return (r.label ? r.label + ': ' : '') + r.expr + (r.bonus ? ' ' + sign(r.bonus) : '') + (r.rerolled ? ' (rerolled ' + r.rerolled + ')' : '') + ' → ' + r.total + (r.type ? ' ' + r.type : '') + ' (' + r.dice.join(', ') + ')' + (r.notes && r.notes.length ? ' · ' + r.notes.join(', ') : '');
    return (r.label ? r.label + ': ' : '') + r.total + (r.crit ? ' — critical success' : r.withHope ? ' with Hope' : ' with Fear')
      + ' (Hope ' + r.hope + ', Fear ' + r.fear + (r.modifier ? ', ' + (r.trait || 'modifier') + ' ' + sign(r.modifier) : '')
      + r.experiences.map((x) => ', ' + x.name + ' ' + sign(Number(x.modifier) || 0)).join('') + r.bonus.map((x) => ', ' + x.label + ' ' + sign(Number(x.value) || 0)).join('')
      + (r.advDie ? ', advantage +' + r.advDie : '') + (r.disDie ? ', disadvantage −' + r.disDie : '') + ')'
      + (r.difficulty != null ? ' vs ' + r.difficulty + ' — ' + r.outcome : '');
  }
  function logLine(entry) {
    const r = entry.roll;
    return el('div', { class: 'log-line ' + (r.kind === 'action' ? (r.crit ? 'crit' : r.withHope ? 'hope' : 'fear') : r.kind) }, [
      entry.who ? el('b', {}, [entry.who + ' ']) : null, logText(r),
    ]);
  }

  // ── a stepper: numbers are tapped, never typed (L5R5e I12) ─────────
  function stepper(label, get, set, o) {
    o = o || {};
    const v = el('span', { class: 'step-v' });
    const draw = () => (v.textContent = o.show ? o.show(get()) : String(get()));
    const bump = (k) => () => {
      const n = Math.max(o.min != null ? o.min : -99, Math.min(o.max != null ? o.max : 99, get() + k));
      set(n);
      draw();
    };
    draw();
    return el('div', { class: 'stepper' }, [el('span', { class: 'step-k' }, [label]), el('button', { type: 'button', class: 'btn step', onclick: bump(-1), 'aria-label': label + ' down' }, ['−']), v, el('button', { type: 'button', class: 'btn step', onclick: bump(1), 'aria-label': label + ' up' }, ['+'])]);
  }

  // ── the roller: trait, modifier, advantage, Difficulty, roll ───────
  // o: {traits: {name → modifier} (a character's, or none for a bare roller), experiences:
  // [{name, modifier}], hope (how many the roller may spend), onResolve(r, spent)}
  function roller(o) {
    o = o || {};
    const st = { trait: null, modifier: 0, adv: 0, dis: 0, difficulty: null, exps: [] };
    const box = el('div', { class: 'roller' });
    const out = el('div', { class: 'roll-out' });
    function draw() {
      box.innerHTML = '';
      const tr = traits();
      box.appendChild(el('div', { class: 'trait-picks' }, tr.map((t) => {
        const m = o.traits && o.traits[t.name] != null ? o.traits[t.name] : null;
        return el('button', { type: 'button', class: 'btn trait' + (st.trait === t.name ? ' on' : ''), title: t.verbs, onclick: () => {
          st.trait = st.trait === t.name ? null : t.name;
          if (m != null) st.modifier = st.trait ? m : 0;
          draw();
        } }, [t.name, m != null ? el('span', { class: 'tmod' }, [sign(m)]) : null]);
      })));
      box.appendChild(stepper('Modifier', () => st.modifier, (v) => (st.modifier = v), { show: sign }));
      // Experiences: tapped to add to this roll, one Hope each (the label makes clear these are a choice,
      // not decoration — a character's own named strengths)
      if ((o.experiences || []).length) {
        box.appendChild(el('div', { class: 'roller-k' }, ['Experience', el('span', { class: 'muted small' }, [o.hope != null ? ' · tap to spend a Hope (' + o.hope + ' left)' : ' · tap to add'])]));
        const row = el('div', { class: 'exp-row' });
        (o.experiences || []).forEach((x) => {
          const on = st.exps.indexOf(x.name) !== -1;
          const room = (o.hope == null ? Infinity : o.hope) > st.exps.length;
          row.appendChild(el('button', { type: 'button', class: 'btn exp' + (on ? ' on' : ''), disabled: !on && !room ? true : null, title: on ? 'Added — tap to remove' : room ? 'Spend a Hope to add it' : 'No Hope left to spend', onclick: () => {
            st.exps = on ? st.exps.filter((n) => n !== x.name) : st.exps.concat([x.name]);
            draw();
          } }, [x.name + ' ' + sign(Number(x.modifier) || 0)]));
        });
        box.appendChild(row);
      }
      box.appendChild(stepper('Advantage', () => st.adv, (v) => (st.adv = v), { min: 0, max: 9 }));
      box.appendChild(stepper('Disadvantage', () => st.dis, (v) => (st.dis = v), { min: 0, max: 9 }));
      box.appendChild(stepper('Difficulty', () => (st.difficulty == null ? 0 : st.difficulty), (v) => (st.difficulty = v || null), { min: 0, max: 40, show: (v) => (v ? String(v) : 'the GM’s') }));
      box.appendChild(el('button', { type: 'button', class: 'btn primary roll-btn', onclick: () => {
        const exps = (o.experiences || []).filter((x) => st.exps.indexOf(x.name) !== -1);
        const r = actionRoll({ trait: st.trait, modifier: st.modifier, experiences: exps, advantage: st.adv, disadvantage: st.dis, difficulty: st.difficulty, label: o.label || null });
        out.innerHTML = '';
        out.appendChild(resultView(r));
        st.exps = [];
        if (o.onResolve) o.onResolve(r, exps.length);
        draw();
      } }, ['Roll the Duality Dice']));
      box.appendChild(out);
    }
    draw();
    return box;
  }

  return { DUALITY, ADV_DIE, GM_DIE, HOPE_MAX, FEAR_MAX, outcomes, traits, actionRoll, gmRoll, damageRoll, parseDamage, resultView, logEntry, logText, logLine, roller, stepper, sign };
})();
