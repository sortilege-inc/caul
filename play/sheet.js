/* ============================================================
   sheet.js — playable Daggerheart character sheet for caul.
   Reads window.SHEET (per-PC data emitted by build_site.py from the
   Foundry actor). Rules engine + UI + localStorage trackers.
   Depends on dice.js (window.Dice).
   ============================================================ */
(function () {
  "use strict";
  var S = window.SHEET;
  if (!S) return;
  var ROOT = document.getElementById("sheet");
  var STORE = "caul.play." + S.id;
  var STATE_V = 3;

  /* ---------- tiny DOM helper ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function d(sides) { return 1 + Math.floor(Math.random() * sides); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* non-blocking toast (never use alert/confirm — they hang) */
  var toastEl, toastTimer;
  function notify(msg) {
    if (!toastEl) { toastEl = el("div", "toast"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  /* ---------- state ---------- */
  function initEquip() {
    var wq = {};
    (S.weapons || []).forEach(function (w) { wq[w.name] = !!w.equipped; });
    return { armor: S.armorName || null, weapons: wq };
  }
  function blankState() {
    return {
      v: STATE_V,
      hp: S.hpMarked || 0,
      stress: S.stressMarked || 0,
      hope: S.hope || 0,
      armor: 0,
      cond: { Hidden: false, Restrained: false, Vulnerable: false },
      loc: {},                       // cardName -> "loadout" | "vault" (override)
      equip: initEquip(),            // { armor: name|null, weapons: {name:bool} }
      gold: { coins: S.gold.coins, handfuls: S.gold.handfuls, bags: S.gold.bags, chests: S.gold.chests }
    };
  }
  function load() {
    var st;
    try { st = JSON.parse(localStorage.getItem(STORE)); } catch (e) { st = null; }
    if (!st || st.v !== STATE_V) st = blankState();
    if (!st.cond) st.cond = { Hidden: false, Restrained: false, Vulnerable: false };
    if (!st.loc) st.loc = {};
    if (!st.equip || !st.equip.weapons) st.equip = initEquip();
    if (!st.gold) st.gold = blankState().gold;
    return st;
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }
  var state = load();

  /* ---------- equipment-derived defensive stats ---------- */
  function equippedArmor() {
    for (var i = 0; i < (S.armor || []).length; i++) {
      if (S.armor[i].name === state.equip.armor) return S.armor[i];
    }
    return null;
  }
  function derivedStats() {
    var a = equippedArmor();
    return {
      evasion: S.evasionBase + (a ? a.evasionBonus : 0),
      armorScore: a ? a.score : 0,
      thresholds: a ? { major: a.major + S.level, severe: a.severe + S.level }
                    : { major: S.level, severe: S.level }
    };
  }
  var CUR = derivedStats();
  var statEls = {}, armorTrackHost, armorListHost;

  /* ---------- card loadout/vault ---------- */
  function cardLoc(card) { return state.loc[card.name] || (card.inVault ? "vault" : "loadout"); }
  function loadoutCount() { return S.cards.filter(function (c) { return cardLoc(c) === "loadout"; }).length; }

  /* ---------- roll log ---------- */
  var logEl;
  function logRoll(html) {
    if (!logEl) return;
    var line = el("div", "log-line", html);
    logEl.insertBefore(line, logEl.firstChild);
    while (logEl.children.length > 12) logEl.removeChild(logEl.lastChild);
  }

  /* ============================================================
     RULES ENGINE
     ============================================================ */
  // Duality action roll. mods = { trait, traitName, flat, exps:[names], adv, dis, difficulty, label }
  function actionRoll(mods, mount) {
    var hopeV = d(12), fearV = d(12);
    var advNet = (mods.adv || 0) - (mods.dis || 0);   // net to a single d6
    var advV = advNet ? d(6) : 0;
    var advContribution = advNet > 0 ? advV : (advNet < 0 ? -advV : 0);
    var expBonus = (mods.exps || []).length * 2;
    var flat = (mods.trait || 0) + (mods.flat || 0) + expBonus + advContribution;
    var total = hopeV + fearV + flat;
    var crit = hopeV === fearV;
    var withHope = crit || hopeV > fearV;
    var withFear = !crit && fearV > hopeV;

    var dice = [
      { sides: 12, value: hopeV, tag: "hope", shape: "d12" },
      { sides: 12, value: fearV, tag: "fear", shape: "d12" }
    ];
    if (advNet) dice.push({ sides: 6, value: advV, tag: advNet > 0 ? "adv" : "dis", shape: "square" });

    Dice.roll({
      mount: mount, dice: dice,
      classify: function (die) {
        if (crit && (die.tag === "hope" || die.tag === "fear")) return "crit high";
        if (die.tag === "hope" && withHope) return "high";
        if (die.tag === "fear" && withFear) return "high";
        return "";
      },
      onSettle: function () { finishRoll(); }
    });

    function finishRoll() {
      // apply metacurrency
      var applied = [];
      if (crit) { addHope(1); addStress(-1); applied.push("gain a Hope", "clear a Stress"); }
      else if (withHope) { addHope(1); applied.push("gain a Hope"); }
      else if (withFear) { applied.push("GM gains a Fear"); }

      var outcome = crit ? "Critical Success" : (withHope ? "with Hope" : "with Fear");
      var vsTxt = "";
      if (mods.difficulty !== "" && mods.difficulty != null) {
        var succ = crit || total >= mods.difficulty;
        vsTxt = ' <b class="' + (succ ? "ok" : "no") + '">' + (succ ? "SUCCESS" : "FAILURE") + "</b> vs " + mods.difficulty;
      }
      var breakdown = hopeV + " + " + fearV + (flat ? (flat > 0 ? " + " + flat : " − " + (-flat)) : "");
      logRoll('<span class="lg-label">' + esc(mods.label || "Roll") + "</span> " +
        '<b class="' + (crit ? "crit" : withHope ? "hope" : "fear") + '">' + total + "</b> " +
        '<span class="lg-out ' + (crit ? "crit" : withHope ? "hope" : "fear") + '">' + outcome + "</span>" +
        vsTxt + '<span class="lg-bd">(' + breakdown + ")</span>" +
        (applied.length ? '<span class="lg-eff">→ ' + applied.join(" · ") + "</span>" : ""));
      renderResources();
    }
  }

  // Damage roll: proficiency × weapon die + bonus (crit = max dice + rolled + bonus)
  function damageRoll(w, isCrit, mount) {
    var sides = parseInt((w.dice || "d6").replace("d", ""), 10) || 6;
    var n = (w.multiplier === "prof") ? S.proficiency : 1;
    var rolls = [], sum = 0;
    for (var i = 0; i < n; i++) { var r = d(sides); rolls.push(r); sum += r; }
    var critBonus = isCrit ? n * sides : 0;
    var total = sum + critBonus + (w.bonus || 0);
    var dice = rolls.map(function (r) { return { sides: sides, value: r, shape: "square", tag: "adv" }; });
    Dice.roll({
      mount: mount, dice: dice,
      onSettle: function () {
        logRoll('<span class="lg-label">' + esc(w.name) + " damage</span> " +
          '<b class="hope">' + total + "</b> " +
          '<span class="lg-bd">(' + n + "d" + sides + (w.bonus ? "+" + w.bonus : "") +
          (isCrit ? " +" + (n * sides) + " crit" : "") + ")</span>" +
          '<span class="lg-eff">' + esc((w.damageType || []).join("/")) + "</span>");
      }
    });
  }

  /* ---------- resource mutation ---------- */
  function addHope(n) { state.hope = clamp(state.hope + n, 0, S.hopeMax); save(); }
  function addStress(n) { state.stress = clamp(state.stress + n, 0, S.stressMax); save(); }
  function addHP(n) { state.hp = clamp(state.hp + n, 0, S.hpMax); save(); }

  /* ============================================================
     UI
     ============================================================ */
  function tTrait(k) { return S.traits[k]; }
  function fmt(n) { return (n >= 0 ? "+" : "") + n; }

  // -- track of clickable pips (HP/Stress/Armor) --
  function trackWidget(label, get, max, onset, cls) {
    var wrap = el("div", "track " + (cls || ""));
    wrap.appendChild(el("div", "track-label", label + ' <span class="track-count">' + get() + "/" + max + "</span>"));
    var boxes = el("div", "track-boxes");
    for (var i = 0; i < max; i++) {
      (function (idx) {
        var b = el("span", "pip");
        b.addEventListener("click", function () {
          var cur = get();
          // clicking pip idx: fill up to idx+1, or clear to idx
          onset(idx < cur ? idx : idx + 1);
          refreshTrack(wrap, label, get, max, boxes);
        });
        boxes.appendChild(b);
      })(i);
    }
    wrap.appendChild(boxes);
    refreshTrack(wrap, label, get, max, boxes);
    return wrap;
  }
  function refreshTrack(wrap, label, get, max, boxes) {
    var cur = get();
    wrap.querySelector(".track-count").textContent = cur + "/" + max;
    [].forEach.call(boxes.children, function (b, i) { b.className = "pip" + (i < cur ? " on" : ""); });
  }

  // -- Hope pips (separate style) --
  var hopeBoxes, hopeCount, stressWrap, hpWrap, armorWrap, vulnFlag;
  function renderResources() {
    if (hopeBoxes) {
      hopeCount.textContent = state.hope + "/" + S.hopeMax;
      [].forEach.call(hopeBoxes.children, function (b, i) { b.className = "hope-pip" + (i < state.hope ? " on" : ""); });
    }
    if (hpWrap) refreshTrack(hpWrap, "Hit Points", function () { return state.hp; }, S.hpMax, hpWrap.querySelector(".track-boxes"));
    if (stressWrap) refreshTrack(stressWrap, "Stress", function () { return state.stress; }, S.stressMax, stressWrap.querySelector(".track-boxes"));
    if (armorWrap && CUR.armorScore) refreshTrack(armorWrap, "Armor", function () { return state.armor; }, CUR.armorScore, armorWrap.querySelector(".track-boxes"));
    if (vulnFlag) vulnFlag.style.display = (state.stress >= S.stressMax) ? "" : "none";
  }

  function renderArmorList() {
    if (!armorListHost) return;
    armorListHost.innerHTML = "";
    if (!(S.armor && S.armor.length)) { armorListHost.appendChild(el("p", "hint", "No armor owned.")); return; }
    S.armor.forEach(function (a) {
      var eqd = state.equip.armor === a.name;
      var row = el("div", "armor-row" + (eqd ? " is-eq" : ""));
      row.appendChild(el("div", "wp-name", esc(a.name) +
        '<span class="wp-meta">Thresholds ' + (a.major + S.level) + "/" + (a.severe + S.level) +
        " · Score " + a.score + (a.evasionBonus ? " · Evasion " + fmt(a.evasionBonus) : "") + "</span>"));
      var eq = el("button", "mini eq-toggle" + (eqd ? " on" : ""), eqd ? "Equipped" : "Equip");
      eq.addEventListener("click", function () { state.equip.armor = eqd ? null : a.name; save(); refreshDerived(); });
      row.appendChild(eq);
      if (a.feature) row.appendChild(el("div", "wp-feat", esc(a.feature)));
      armorListHost.appendChild(row);
    });
  }
  function rebuildArmorTrack() {
    if (!armorTrackHost) return;
    armorTrackHost.innerHTML = "";
    if (CUR.armorScore > 0) {
      state.armor = clamp(state.armor, 0, CUR.armorScore);
      armorWrap = trackWidget("Armor Slots", function () { return state.armor; }, CUR.armorScore,
        function (v) { state.armor = clamp(v, 0, CUR.armorScore); save(); renderResources(); }, "armor");
      armorTrackHost.appendChild(armorWrap);
    } else { armorWrap = null; }
  }
  function refreshDerived() {
    CUR = derivedStats();
    if (statEls.evasion) statEls.evasion.textContent = CUR.evasion;
    if (statEls.armorScore) statEls.armorScore.textContent = CUR.armorScore;
    if (statEls.major) statEls.major.textContent = CUR.thresholds.major;
    if (statEls.severe) statEls.severe.textContent = CUR.thresholds.severe;
    rebuildArmorTrack();
    renderArmorList();
  }

  function build() {
    ROOT.innerHTML = "";

    /* ===== IDENTITY HEADER ===== */
    var head = el("header", "sheet-head");
    var sub = S.className + (S.multiclassName ? " / " + S.multiclassName : "") +
      " · L" + S.level + (S.subclasses.length ? " · " + S.subclasses.join(" / ") : "");
    head.appendChild(el("div", "sh-name", esc(S.name)));
    head.appendChild(el("div", "sh-sub", esc(sub)));
    head.appendChild(el("div", "sh-line", esc(S.ancestry + " · " + S.community + " · Domains: " +
      S.domains.map(cap).join(", ") + (S.spellcastTrait ? " · Spellcast: " + cap(S.spellcastTrait) : ""))));
    ROOT.appendChild(head);

    var grid = el("div", "sheet-grid");
    ROOT.appendChild(grid);

    /* ===== COLUMN 1: traits + core stats ===== */
    var c1 = el("section", "col col-stats");

    CUR = derivedStats();
    statEls = {};
    var stats = el("div", "statline");
    [["Evasion", CUR.evasion, "evasion"], ["Armor", CUR.armorScore, "armorScore"],
     ["Proficiency", S.proficiency, null], ["Major", CUR.thresholds.major, "major"],
     ["Severe", CUR.thresholds.severe, "severe"]].forEach(function (p) {
      var b = el("div", "stat");
      var v = el("div", "stat-v", p[1]);
      b.appendChild(v);
      b.appendChild(el("div", "stat-k", p[0]));
      if (p[2]) statEls[p[2]] = v;
      stats.appendChild(b);
    });
    c1.appendChild(stats);
    c1.appendChild(el("p", "hint", "Damage ≥ Major marks 2 HP · ≥ Severe marks 3 HP · ≥ 2× Severe marks 4 HP · otherwise 1 HP. An Armor Slot reduces a hit by one threshold."));

    var traitWrap = el("div", "traits");
    ["agility", "strength", "finesse", "instinct", "presence", "knowledge"].forEach(function (k) {
      var t = el("button", "trait");
      t.appendChild(el("div", "tr-k", cap(k)));
      t.appendChild(el("div", "tr-v", fmt(tTrait(k))));
      t.title = "Roll " + cap(k);
      t.addEventListener("click", function () { setRollTrait(k); });
      traitWrap.appendChild(t);
    });
    c1.appendChild(el("div", "col-h", "Traits"));
    c1.appendChild(traitWrap);

    // experiences
    if (S.experiences.length) {
      c1.appendChild(el("div", "col-h", "Experiences <span class='sub'>(+2, spend a Hope)</span>"));
      var exW = el("div", "exps");
      S.experiences.forEach(function (e) {
        var b = el("label", "exp");
        var cb = el("input"); cb.type = "checkbox"; cb.dataset.exp = e.name;
        b.appendChild(cb);
        b.appendChild(el("span", "", esc(e.name) + " <b>+" + e.value + "</b>"));
        exW.appendChild(b);
      });
      c1.appendChild(exW);
      expInputs = exW;
    }
    grid.appendChild(c1);

    /* ===== COLUMN 2: the dice / actions ===== */
    var c2 = el("section", "col col-roll");
    c2.appendChild(el("div", "col-h", "Duality Roll"));

    var stage = el("div", "dice-mount"); c2.appendChild(stage); rollMount = stage;
    var result = el("div", "roll-result"); c2.appendChild(result); rollResult = result;

    // controls
    var ctl = el("div", "roll-ctl");
    // trait selector
    traitSelect = el("select", "sel-trait");
    ["agility", "strength", "finesse", "instinct", "presence", "knowledge"].forEach(function (k) {
      var o = el("option"); o.value = k; o.textContent = cap(k) + " (" + fmt(tTrait(k)) + ")"; traitSelect.appendChild(o);
    });
    ctl.appendChild(field("Trait", traitSelect));
    diffInput = numInput("", 3); diffInput.placeholder = "—";
    ctl.appendChild(field("Difficulty", diffInput));
    modInput = numInput("0", 3);
    ctl.appendChild(field("Modifier", modInput));
    advInput = stepper(0, 0, 5); ctl.appendChild(field("Advantage", advInput.node));
    disInput = stepper(0, 0, 5); ctl.appendChild(field("Disadvantage", disInput.node));
    c2.appendChild(ctl);

    var rollBtn = el("button", "big-btn", "Roll the Dice");
    rollBtn.addEventListener("click", doRoll);
    c2.appendChild(rollBtn);

    // weapons — all owned, with an equip toggle
    if (S.weapons.length) {
      c2.appendChild(el("div", "col-h", "Weapons <span class='sub'>(toggle equipped)</span>"));
      var wl = el("div", "weapons");
      S.weapons.forEach(function (w) {
        var equipped = !!state.equip.weapons[w.name];
        var row = el("div", "weapon" + (equipped ? " is-eq" : ""));
        var dmg = ((w.multiplier === "prof") ? S.proficiency : 1) + w.dice + (w.bonus ? "+" + w.bonus : "");
        row.appendChild(el("div", "wp-name", esc(w.name) +
          '<span class="wp-meta">' + cap(w.trait || "—") + " · " + prettyRange(w.range) + " · " + dmg + " " +
          esc((w.damageType || []).join("/")) + (w.secondary ? " · secondary" : "") + "</span>"));
        var acts = el("div", "wp-acts");
        var eq = el("button", "mini eq-toggle" + (equipped ? " on" : ""), equipped ? "Equipped" : "Equip");
        eq.addEventListener("click", function () {
          var now = !state.equip.weapons[w.name];
          state.equip.weapons[w.name] = now; save();
          eq.className = "mini eq-toggle" + (now ? " on" : ""); eq.textContent = now ? "Equipped" : "Equip";
          row.className = "weapon" + (now ? " is-eq" : "");
        });
        var atk = el("button", "mini", "Attack");
        atk.addEventListener("click", function () { attackWith(w); });
        var dm = el("button", "mini", "Damage");
        dm.addEventListener("click", function () { damageRoll(w, false, rollMount); rollResult.textContent = ""; });
        var dmc = el("button", "mini ghost", "Crit dmg");
        dmc.addEventListener("click", function () { damageRoll(w, true, rollMount); rollResult.textContent = ""; });
        acts.appendChild(eq); acts.appendChild(atk); acts.appendChild(dm); acts.appendChild(dmc);
        row.appendChild(acts);
        if (w.feature) row.appendChild(el("div", "wp-feat", esc(w.feature)));
        wl.appendChild(row);
      });
      c2.appendChild(wl);
    }

    // armor — all owned; equipping one sets Evasion / Armor / thresholds
    c2.appendChild(el("div", "col-h", "Armor <span class='sub'>(equip to set thresholds)</span>"));
    armorListHost = el("div", "armor-list");
    c2.appendChild(armorListHost);
    renderArmorList();

    // damage intake helper
    c2.appendChild(el("div", "col-h", "Take Damage"));
    var dmgWrap = el("div", "dmg-take");
    var dmgIn = numInput("", 4); dmgIn.placeholder = "amount";
    var useArmor = el("label", "armchk"); var acb = el("input"); acb.type = "checkbox";
    useArmor.appendChild(acb); useArmor.appendChild(el("span", "", "spend Armor Slot"));
    var takeBtn = el("button", "mini", "Apply");
    var dmgOut = el("span", "dmg-out");
    takeBtn.addEventListener("click", function () {
      var amt = parseInt(dmgIn.value, 10); if (isNaN(amt)) return;
      var tier = amt >= 2 * CUR.thresholds.severe ? 4 : amt >= CUR.thresholds.severe ? 3 : amt >= CUR.thresholds.major ? 2 : 1;
      if (acb.checked && state.armor < CUR.armorScore && tier > 1) { tier -= 1; state.armor += 1; acb.checked = false; }
      addHP(tier);
      renderResources();
      dmgOut.textContent = "marked " + tier + " HP";
      logRoll('<span class="lg-label">Took ' + amt + " damage</span> <span class=\"lg-eff\">→ marked " + tier + " HP</span>");
    });
    dmgWrap.appendChild(dmgIn); dmgWrap.appendChild(useArmor); dmgWrap.appendChild(takeBtn); dmgWrap.appendChild(dmgOut);
    c2.appendChild(dmgWrap);

    grid.appendChild(c2);

    /* ===== COLUMN 3: resources ===== */
    var c3 = el("section", "col col-res");
    c3.appendChild(el("div", "col-h", "Resources"));

    // Hope
    var hopeW = el("div", "hope-track");
    hopeW.appendChild(el("div", "track-label", 'Hope <span class="track-count" id="hopeCount">' + state.hope + "/" + S.hopeMax + "</span>"));
    hopeBoxes = el("div", "hope-boxes");
    for (var h = 0; h < S.hopeMax; h++) {
      (function (idx) {
        var b = el("span", "hope-pip");
        b.addEventListener("click", function () { state.hope = (idx < state.hope ? idx : idx + 1); save(); renderResources(); });
        hopeBoxes.appendChild(b);
      })(h);
    }
    hopeW.appendChild(hopeBoxes);
    hopeCount = hopeW.querySelector("#hopeCount");
    var hopeBtns = el("div", "hope-btns");
    var hf = el("button", "mini ghost", "Spend 3 (Hope feature)");
    hf.addEventListener("click", function () { if (state.hope >= 3) { addHope(-3); renderResources(); logRoll('<span class="lg-label">Hope feature</span> <span class="lg-eff">−3 Hope</span>'); } });
    hopeBtns.appendChild(hf);
    hopeW.appendChild(hopeBtns);
    c3.appendChild(hopeW);

    // HP / Stress / Armor tracks
    hpWrap = trackWidget("Hit Points", function () { return state.hp; }, S.hpMax, function (v) { state.hp = clamp(v, 0, S.hpMax); save(); renderResources(); }, "hp");
    c3.appendChild(hpWrap);
    stressWrap = trackWidget("Stress", function () { return state.stress; }, S.stressMax, function (v) { state.stress = clamp(v, 0, S.stressMax); save(); renderResources(); }, "stress");
    vulnFlag = el("div", "vuln", "VULNERABLE — rolls against you have advantage"); vulnFlag.style.display = "none";
    stressWrap.appendChild(vulnFlag);
    c3.appendChild(stressWrap);
    armorTrackHost = el("div", "armor-track-host");
    c3.appendChild(armorTrackHost);
    rebuildArmorTrack();

    // conditions
    c3.appendChild(el("div", "col-h", "Conditions"));
    var condW = el("div", "conds");
    ["Hidden", "Restrained", "Vulnerable"].forEach(function (cn) {
      var b = el("button", "cond" + (state.cond[cn] ? " on" : ""), cn);
      b.addEventListener("click", function () { state.cond[cn] = !state.cond[cn]; b.className = "cond" + (state.cond[cn] ? " on" : ""); save(); });
      condW.appendChild(b);
    });
    c3.appendChild(condW);

    // rest + reset
    var restW = el("div", "rest-row");
    var lr = el("button", "mini", "Long Rest");
    lr.addEventListener("click", function () { state.hp = 0; state.stress = 0; state.armor = 0; save(); renderResources(); logRoll('<span class="lg-label">Long Rest</span> <span class="lg-eff">→ cleared HP, Stress, Armor</span>'); });
    var rs = el("button", "mini ghost", "Reset sheet");
    var armed = false, armTimer;
    rs.addEventListener("click", function () {
      if (!armed) { armed = true; rs.textContent = "Really reset?"; rs.classList.add("armed"); notify("Click again to reset all trackers.");
        armTimer = setTimeout(function () { armed = false; rs.textContent = "Reset sheet"; rs.classList.remove("armed"); }, 3500); return; }
      clearTimeout(armTimer); state = blankState(); save(); build();
    });
    restW.appendChild(lr); restW.appendChild(rs);
    c3.appendChild(restW);

    // roll log
    c3.appendChild(el("div", "col-h", "Roll Log"));
    logEl = el("div", "roll-log"); c3.appendChild(logEl);

    grid.appendChild(c3);

    /* ===== DOMAIN CARDS ===== */
    var cardsSec = el("section", "cards-sec");
    cardsHeader = el("div", "col-h cards-h");
    cardsSec.appendChild(cardsHeader);
    cardsBody = el("div", "cards-body");
    cardsSec.appendChild(cardsBody);
    ROOT.appendChild(cardsSec);
    renderCards();

    /* ===== FEATURES / INVENTORY (reference tabs) ===== */
    var ref = el("section", "ref-sec");
    var tabs = el("div", "ref-tabs");
    var panels = el("div", "ref-panels");
    var defs = [
      ["Features", S.features, function (f) { return '<div class="ref-item"><b>' + esc(f.name) + "</b><p>" + esc(f.text) + "</p></div>"; }],
      ["Inventory", S.inventory, function (i) { return '<div class="ref-item"><b>' + esc(i.name) + (i.qty > 1 ? " ×" + i.qty : "") + '</b> <span class="tag">' + i.kind + "</span>" + (i.text ? "<p>" + esc(i.text) + "</p>" : "") + "</div>"; }]
    ];
    defs.forEach(function (dfn, di) {
      var t = el("button", "ref-tab" + (di === 0 ? " on" : ""), dfn[0] + " (" + dfn[1].length + ")");
      var p = el("div", "ref-panel" + (di === 0 ? " on" : ""));
      p.innerHTML = dfn[1].length ? dfn[1].map(dfn[2]).join("") : '<p class="hint">None.</p>';
      t.addEventListener("click", function () {
        [].forEach.call(tabs.children, function (x) { x.className = "ref-tab"; });
        [].forEach.call(panels.children, function (x) { x.className = "ref-panel"; });
        t.className = "ref-tab on"; p.className = "ref-panel on";
      });
      tabs.appendChild(t); panels.appendChild(p);
    });
    // gold line
    var goldStr = ["chests", "bags", "handfuls", "coins"].filter(function (k) { return state.gold[k]; })
      .map(function (k) { return state.gold[k] + " " + k; }).join(" · ") || "empty purse";
    ref.appendChild(el("div", "gold", "Gold: " + goldStr));
    ref.appendChild(tabs); ref.appendChild(panels);
    ROOT.appendChild(ref);

    renderResources();
  }

  /* ---------- domain cards render ---------- */
  var cardsHeader, cardsBody;
  function renderCards() {
    var lc = loadoutCount();
    cardsHeader.innerHTML = "Domain Cards — <span class='sub'>Loadout " + lc + "/5 · Vault " + (S.cards.length - lc) + "</span>";
    cardsBody.innerHTML = "";
    var loadCol = el("div", "card-col"); loadCol.appendChild(el("div", "card-col-h", "Loadout"));
    var vaultCol = el("div", "card-col"); vaultCol.appendChild(el("div", "card-col-h", "Vault"));
    S.cards.forEach(function (c) {
      var inLoad = cardLoc(c) === "loadout";
      var card = el("div", "dcard " + c.domain + (inLoad ? " in-load" : " in-vault"));
      card.appendChild(el("div", "dc-head",
        '<span class="dc-name">' + esc(c.name) + "</span>" +
        '<span class="dc-tags">' + cap(c.domain) + " · Lv" + c.level + " · " + cap(c.type) +
        (c.recallCost ? ' · Recall ' + c.recallCost : "") + "</span>"));
      if (c.spells && c.spells.length) {
        var sp = el("div", "dc-spells");
        c.spells.forEach(function (s) {
          var row = el("div", "spell");
          var b = el("button", "mini spell-btn", esc(s.name));
          if (inLoad) { b.addEventListener("click", function () { castSpell(s, c); }); }
          else { b.disabled = true; b.className = "mini spell-btn disabled"; b.title = "In the Vault — recall this Book to prepare it"; }
          row.appendChild(b);
          if (s.text) row.appendChild(el("div", "spell-text", esc(s.text)));
          sp.appendChild(row);
        });
        card.appendChild(sp);
      } else {
        card.appendChild(el("div", "dc-text", esc(c.text)));
      }
      var act = el("div", "dc-act");
      if (inLoad) {
        var v = el("button", "mini ghost", "→ Vault");
        v.addEventListener("click", function () { state.loc[c.name] = "vault"; save(); renderCards(); });
        act.appendChild(v);
      } else {
        var r = el("button", "mini", c.recallCost ? "Recall (mark " + c.recallCost + " Stress)" : "Recall");
        r.addEventListener("click", function () {
          if (loadoutCount() >= 5) { notify("Loadout is full (5) — move a card to the Vault first."); return; }
          if (c.recallCost && state.stress + c.recallCost > S.stressMax) { notify("Not enough Stress slots to pay the Recall Cost."); return; }
          if (c.recallCost) addStress(c.recallCost);
          state.loc[c.name] = "loadout"; save(); renderCards(); renderResources();
          logRoll('<span class="lg-label">Recall ' + esc(c.name) + "</span>" + (c.recallCost ? '<span class="lg-eff">→ marked ' + c.recallCost + " Stress</span>" : ""));
        });
        act.appendChild(r);
      }
      card.appendChild(act);
      (inLoad ? loadCol : vaultCol).appendChild(card);
    });
    cardsBody.appendChild(loadCol); cardsBody.appendChild(vaultCol);
  }

  /* ---------- roll controls ---------- */
  var rollMount, rollResult, traitSelect, diffInput, modInput, advInput, disInput, expInputs;
  function setRollTrait(k) { traitSelect.value = k; doRoll(); }
  function currentExps() {
    if (!expInputs) return [];
    return [].slice.call(expInputs.querySelectorAll("input:checked")).map(function (i) { return i.dataset.exp; });
  }
  function doRoll() {
    var k = traitSelect.value;
    var exps = currentExps();
    actionRoll({
      trait: tTrait(k), traitName: cap(k),
      flat: parseInt(modInput.value, 10) || 0,
      exps: exps,
      adv: advInput.get(), dis: disInput.get(),
      difficulty: diffInput.value === "" ? "" : (parseInt(diffInput.value, 10)),
      label: cap(k) + (exps.length ? " +" + (exps.length * 2) + " exp" : "")
    }, rollMount);
    rollResult.textContent = "";
  }
  function castSpell(spell, card) {
    var tr = S.spellcastTrait || "knowledge";
    actionRoll({
      trait: tTrait(tr), traitName: cap(tr),
      flat: parseInt(modInput.value, 10) || 0, exps: currentExps(),
      adv: advInput.get(), dis: disInput.get(),
      difficulty: diffInput.value === "" ? "" : parseInt(diffInput.value, 10),
      label: card.name + " · " + spell.name
    }, rollMount);
    rollResult.innerHTML = "<b>" + esc(spell.name) + "</b> — Spellcast (" + cap(tr) + "). " + esc(spell.text);
  }
  function attackWith(w) {
    actionRoll({
      trait: tTrait(w.trait || "finesse"), traitName: cap(w.trait),
      flat: parseInt(modInput.value, 10) || 0, exps: currentExps(),
      adv: advInput.get(), dis: disInput.get(),
      difficulty: diffInput.value === "" ? "" : parseInt(diffInput.value, 10),
      label: w.name + " attack"
    }, rollMount);
    rollResult.innerHTML = 'On a hit, roll <b>' + ((w.multiplier === "prof") ? S.proficiency : 1) + w.dice + (w.bonus ? "+" + w.bonus : "") + "</b> damage.";
  }

  /* ---------- small form helpers ---------- */
  function field(label, node) { var f = el("label", "field"); f.appendChild(el("span", "field-l", label)); f.appendChild(node); return f; }
  function numInput(val, size) { var i = el("input", "num"); i.type = "number"; i.value = val; if (size) i.size = size; return i; }
  function stepper(val, lo, hi) {
    var node = el("div", "stepper"); var cur = val;
    var minus = el("button", "st-btn", "−"), out = el("span", "st-v", String(cur)), plus = el("button", "st-btn", "+");
    minus.addEventListener("click", function () { cur = clamp(cur - 1, lo, hi); out.textContent = cur; });
    plus.addEventListener("click", function () { cur = clamp(cur + 1, lo, hi); out.textContent = cur; });
    node.appendChild(minus); node.appendChild(out); node.appendChild(plus);
    return { node: node, get: function () { return cur; } };
  }
  function prettyRange(r) { return ({ melee: "Melee", veryClose: "Very Close", close: "Close", far: "Far", veryFar: "Very Far" }[r]) || (r || "—"); }

  build();
})();
