// system/daggerheart/ops.js — the ops Daggerheart adds to the engine's, registered with the same
// call and shared the same way (engine/ops.js). Loaded by the browser after engine/ops.js, and
// imported by the Worker beside it, so the room applies the very same functions.
//
//   cast          { [sceneId]: [entityIds] }  the adversaries and environments the GM has put in a scene
//   npcConditions { [entityId]: [names] }     an adversary's conditions (Hidden, Restrained,
//                                             Vulnerable), shared so the players see them
//   fear          n                           the GM's Fear, shared: "you should keep this pool
//                                             visible to players during the game" (gm-guidance.lore)
//   npcState      { [entityId]: {hp, stress} } an adversary's marked HP and Stress — the GM's own
//   gmNotes, arc, threads, encounters         the GM's own pack state, never shared
//   party[].versions                          archived copies of a character (archivePartyVersion)
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../../engine/ops.js'));
  else factory(root.VttOps);
})(typeof self !== 'undefined' ? self : this, function (Ops) {
  // "You can hold up to a maximum of 12 Fear." (gm-guidance.lore)
  const FEAR_MAX = 12;

  Ops.shared(['cast', 'npcConditions', 'fear']);

  Ops.register('setSceneCast', (s, sceneId, ids) => {
    if (!s.cast) s.cast = {};
    s.cast[sceneId] = (ids || []).slice();
  });
  Ops.register('setNpcConditions', (s, id, list) => {
    if (!s.npcConditions) s.npcConditions = {};
    s.npcConditions[id] = (list || []).slice();
  });

  // Fear: the GM sets it; a roll with Fear adds one — "The GM gains a Fear" (the Action Roll's
  // OUTCOMES) — which a player's own roll may send, one at a time, for their own character.
  Ops.register('setFear', (s, n) => {
    s.fear = Math.max(0, Math.min(FEAR_MAX, Number(n) || 0));
  });
  Ops.register('addFear', (s, n) => {
    s.fear = Math.max(0, Math.min(FEAR_MAX, (Number(s.fear) || 0) + (Number(n) || 0)));
  }, (s, me, a) => a[0] === 1 && a[1] === me);

  // A character's archived versions: a copy, appended, never edited. A player may archive their own.
  Ops.register('archivePartyVersion', (s, id, version) => {
    const m = (s.party || []).find((x) => x.id === id);
    if (!m || !version || !version.id) return;
    if (!m.versions) m.versions = [];
    if (!m.versions.some((x) => x.id === version.id)) m.versions.push(version);
  }, (s, me, a) => a[0] === me);

  // The GM's own: an adversary's marks, the free notes, the arc, open threads, saved encounters.
  // Never shared: no player may send them, none is in a player's view, none is forwarded.
  const gmOnly = () => null;
  Ops.register('setNpcState', (s, id, st) => {
    if (!s.npcState) s.npcState = {};
    s.npcState[id] = Object.assign({}, st || {});
  }, null, gmOnly);
  Ops.register('setGmNotes', (s, text) => { s.gmNotes = String(text || ''); }, null, gmOnly);
  Ops.register('setArc', (s, list) => { s.arc = (list || []).map((x) => Object.assign({}, x)); }, null, gmOnly);
  Ops.register('setThreads', (s, list) => { s.threads = (list || []).map((x) => Object.assign({}, x)); }, null, gmOnly);
  Ops.register('setEncounters', (s, list) => { s.encounters = JSON.parse(JSON.stringify(list || [])); }, null, gmOnly);

  return Ops;
});
