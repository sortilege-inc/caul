// engine/config.js — where things are. The one file a deployment edits.
// INSTANCE-OWNED (merge=ours): this is the Caul campaign's copy — "The Enduring Lesser
// Lights", an instance of the Daggerheart VTT. Upstream's copy never overwrites it; after a
// pull, diff engine/config.js against upstream and carry any new key by hand (INSTANCES.md).
window.VttConfig = {
  system: 'daggerheart',
  title: 'Caul',
  channel: 'caul-vtt',            // BroadcastChannel name (same-machine windows)
  storagePrefix: 'caul-vtt',      // localStorage key prefix
  dataGlobal: 'DAGGERHEART',      // the global data/*.js registers into (must match the VTT)
  pages: { site: './', gm: 'gm/', table: 'gm/vtt.html', play: 'gm/play.html' },
  // The Age of Umbra campaign frame (#t5KkPQAKPBQWhS6w3ZFiQh2x, corpus campaign-frames) is in
  // effect for this campaign; the party opens on it. Its rules modifications come from the
  // frame's own mechanics in the data.
  defaultCampaign: {
    name: 'Caul',
    modules: ['#t5KkPQAKPBQWhS6w3ZFiQh2x'],
    books: [],
    // the S28 arc and the open threads, seeded once (campaign/source/build_seed.py); the GM edits
    // from there and the seed never overwrites a change (engine/state.js seed)
    seed: 'campaign/pack/seed.json',
  },
  // the three panels the GM page opens on (engine/app.js) — revisited at the migration milestone
  defaultSlots: ['frame', 'party', 'inspector'],
  // Behind the Veil moved into the GM tabs (the family standard, PLAYBOOK §4b.2): its text is the
  // seed's `gm` (campaign/source/absorb_veil.py), edited in Overview, Places and People; the Notes
  // pane, which showed the old document, is left out (its free notes are in Overview).
  hidePanes: ['notes'],
  // The campaign's own scripts, loaded by engine/instance.js at the stages the upstream pages
  // mark. The DSL layer (campaign/dsl/ → campaign/data/, via build/build_layer.sh) registers the
  // campaign's 106 statblocks into the data global at the `data` stage. Site tabs + GM doc land
  // at M4.
  instance: {
    // the original Caul site's look: its fonts, its palette/type over the whole VTT frame
    // (caul-theme.css), then the migrated docs' own styling scoped to .caul-doc (scope_css.py) + a fit
    styles: [
      'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IM+Fell+English:ital@0;1&family=Pirata+One&display=swap',
      'campaign/site/caul-theme.css',
      'campaign/site/umbra.css',
      'campaign/site/caul-doc.css',
    ],
    stages: {
      data: ['campaign/data/index.js'],
      // the campaign's site tabs (M4): the interactive atlas map (data then renderer), then the
      // tabs that draw the docs in campaign/docs/
      site: ['campaign/site/atlas-data.js', 'campaign/site/map.js', 'campaign/site/site.js'],
    },
  },
  // The family standards (PLAYBOOK §4b): the public site's book tabs are off — the GM turns them on,
  // per browser, in the GM page's Settings (engine/site.js) — and a veil stands in front of /gm/
  // (engine/app.js). The GM's own material lives in the GM tabs (engine/gm-panes.js), in the pack.
  siteBooks: false,
  gmGate: {
    title: 'The GM\u2019s table',
    text: 'Beyond is the GM\u2019s material \u2014 the prep, the threads, what the players have not yet found. If you are playing, turn back.',
    enter: 'Enter',
    leave: 'Turn back',
  },
  worker: {
    deployed: 'https://caul-vtt.sortilege.workers.dev',   // the caul-vtt Worker (M5 deploy)
    local: 'http://localhost:8796',
  },
};
window.VttConfig.workerUrl = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? window.VttConfig.worker.local : window.VttConfig.worker.deployed;
