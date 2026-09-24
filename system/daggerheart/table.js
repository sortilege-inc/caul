// system/daggerheart/table.js — what Daggerheart tells the table (engine/vtt.js) and the player's
// page (engine/play.js): which scenes are in play, what can stand on the table, what a token's
// state reads as, and how a character file becomes a party member. The engine never asks the
// corpus directly.
//
// The module in play is a campaign frame, picked in the Frame panel (campaign.modules[0]). A frame
// prints no scene list — it is "an inciting incident to launch the campaign" and principles to run
// it by — so the scenes are the GM's own arc (the Scenes pane, op `setArc`), and a scene's cast is
// the GM's (`setSceneCast`): the adversaries and environments put in it. No map ships.
window.VttSystem = (function () {
  const D = window.DHData;
  const State = window.VttState;
  const Bus = window.VttBus;
  const S = () => State.state;
  const Sheet = () => window.DHSheet;

  const moduleId = () => ((S().campaign || {}).modules || [])[0] || 'campaign';
  const frame = () => {
    const id = ((S().campaign || {}).modules || [])[0];
    return id ? D.entity(id) || D.record(id) : null;
  };
  function scenes() {
    return (S().arc || []).map((x) => ({ id: x.id, name: x.title || 'A scene', phase: null, moduleId: moduleId() }));
  }
  const scene = (id) => scenes().find((s) => s.id === id) || null;
  function currentSceneId() {
    const cur = (S().current || {})[moduleId()];
    const all = scenes();
    return (all.find((s) => s.id === cur) || all.find((s) => !(S().arc || []).find((a) => a.id === s.id && a.played)) || all[0] || {}).id || null;
  }

  // A scene's cast (op setSceneCast) is a list of instances. Backward-compatible: a bare string is one
  // instance whose instance-id is the entity id (so a campaign saved before instances keeps its marks);
  // an object { iid, id, label } is one tracked copy — many copies of one adversary each get their own
  // iid, so npcState / npcConditions (keyed by iid) track them separately.
  const rawCast = (sceneId) => ((S().cast || {})[sceneId] || []).slice();
  const castEntries = (sceneId) => rawCast(sceneId).map((c) => (typeof c === 'string' ? { iid: c, id: c } : { iid: c.iid || c.id, id: c.id, label: c.label }));
  const castIds = (sceneId) => castEntries(sceneId).map((c) => c.id);           // the entity ids (may repeat)
  const byId = (id) => D.entity(id) || D.record(id) || null;
  const cast = (sceneId) => { const seen = {}; return castEntries(sceneId).map((c) => c.id).filter((id) => (seen[id] ? false : (seen[id] = 1))).map(byId).filter(Boolean); }; // distinct entities
  const instLabel = (c) => c.label || ((byId(c.id) || {}).name || c.id);

  const maps = () => [];
  const mapDef = () => null;
  const defaultMapId = (sceneId) => sceneId;
  const legend = () => null;
  const mapAssets = () => [];

  // ── tokens: the party, and the current scene's cast ────────────────
  function tokenSources() {
    const groups = [];
    const party = (S().party || []).map((m) => ({ id: 'tk-' + m.id, label: m.name, kind: 'party', owner: m.id, ref: m.id }));
    if (party.length) groups.push({ label: 'The party', items: party });
    const sid = currentSceneId();
    const sc = scene(sid);
    const here = sc ? castEntries(sid).map((c) => ({ id: 'tk-' + c.iid, label: instLabel(c), kind: 'cast', ref: c.id, iid: c.iid })) : [];
    if (here.length) groups.push({ label: sc.name, items: here });
    return groups;
  }
  const COLORS = { party: '#b88519', cast: '#5a3c93', marker: '#8a6a1c' };
  const tokenColor = (t) => COLORS[t.kind] || COLORS.marker;
  // a token's word: a character's HP, Stress and Hope; an adversary's marks and conditions
  function tokenStatus(t) {
    if (t.kind === 'party') {
      const m = (S().party || []).find((x) => x.id === t.owner);
      return m && Sheet() ? { text: Sheet().tokenText(m), pips: [] } : null;
    }
    const e = t.kind === 'cast' && t.ref ? byId(t.ref) : null;
    if (!e) return null;
    const key = t.iid || e.id;                                   // per-instance marks (falls back to the entity)
    const st = (S().npcState || {})[key];
    const cond = (S().npcConditions || {})[key] || [];
    const hp = e.props ? D.num(e, 'Hit Points') : null;
    return { text: [st && hp ? 'HP ' + (st.hp || 0) + '/' + hp : null, cond.join(', ') || null].filter(Boolean).join(' · '), pips: [] };
  }
  function selectToken(t) {
    if (t.kind === 'party') Bus.emit('select', { kind: 'party', id: t.owner });
    else if (t.kind === 'cast' && t.ref) Bus.emit('select', { kind: 'entity', id: t.ref, iid: t.iid, label: t.label });
  }
  const tokenMenu = () => null;

  // ── the character (system/daggerheart/sheet.js) ────────────────────
  const readCharacter = (obj, fileName) => Sheet().readMember(obj, fileName);
  const downloadCharacter = (m) => Sheet().downloadMember(m);
  const liveSheet = (m, opts) => Sheet().liveSheet(m, opts);
  const memberSubtitle = (m) => (m && m.templateId === Sheet().COMPANION_ID) ? Sheet().companionLine(m.character || {}) : Sheet().sentence(m.character || {});

  return {
    moduleId, frame, scenes, scene, currentSceneId, cast, castIds, castEntries, castRaw: rawCast, instLabel, byId, maps, mapDef, defaultMapId, legend, mapAssets,
    tokenSources, tokenColor, tokenStatus, selectToken, tokenMenu,
    liveSheet, readCharacter, downloadCharacter, memberSubtitle,
  };
})();
