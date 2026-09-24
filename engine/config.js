// engine/config.js — where things are. The one file a deployment edits.
// INSTANCE-OWNED (merge=ours): this is the Caul campaign's copy — "The Enduring Lesser
// Lights", an instance of the Daggerheart VTT. Upstream's copy never overwrites it; after a
// pull, diff engine/config.js against upstream and carry any new key by hand (INSTANCES.md).
window.VttConfig = {
  system: 'daggerheart',
  title: 'The Enduring Lesser Lights',
  channel: 'caul-vtt',            // BroadcastChannel name (same-machine windows)
  storagePrefix: 'caul-vtt',      // localStorage key prefix
  dataGlobal: 'DAGGERHEART',      // the global data/*.js registers into (must match the VTT)
  pages: { site: './', gm: 'gm/', table: 'gm/vtt.html', play: 'gm/play.html' },
  // The Age of Umbra campaign frame (#t5KkPQAKPBQWhS6w3ZFiQh2x, corpus campaign-frames) is in
  // effect for this campaign; the party opens on it. Its rules modifications come from the
  // frame's own mechanics in the data.
  defaultCampaign: {
    name: 'The Enduring Lesser Lights',
    modules: ['#t5KkPQAKPBQWhS6w3ZFiQh2x'],
    books: [],
  },
  // the three panels the GM page opens on (engine/app.js) — revisited at the migration milestone
  defaultSlots: ['frame', 'party', 'inspector'],
  // Behind the Veil (M4): the GM's lore/secrets, concatenated by campaign/source/build_veil.py,
  // shown in the Notes pane behind a spoiler gate (system/daggerheart/gm-panes.js).
  notes: {
    src: 'campaign/docs/veil.html',
    title: 'Behind the Veil',
    class: 'caul-doc',
    gate: {
      title: 'Behind the Veil',
      text: 'The shape of the world beneath the world — the GM’s canon, cosmology and secrets. Spoilers for players.',
      enter: 'Lift the Veil',
    },
  },
  // The campaign's own scripts, loaded by engine/instance.js at the stages the upstream pages
  // mark. The DSL layer (campaign/dsl/ → campaign/data/, via build/build_layer.sh) registers the
  // campaign's 106 statblocks into the data global at the `data` stage. Site tabs + GM doc land
  // at M4.
  instance: {
    // the migrated wiki's look, scoped to .caul-doc (campaign/source/scope_css.py) + a fit file
    styles: ['campaign/site/umbra.css', 'campaign/site/caul-doc.css'],
    stages: {
      data: ['campaign/data/index.js'],
      // the campaign's site tabs (M4): the interactive atlas map (data then renderer), then the
      // tabs that draw the docs in campaign/docs/
      site: ['campaign/site/atlas-data.js', 'campaign/site/map.js', 'campaign/site/site.js'],
    },
  },
  worker: {
    deployed: '',                 // set at deploy (M5): the caul.sortilege.online Worker
    local: 'http://localhost:8796',
  },
};
window.VttConfig.workerUrl = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? window.VttConfig.worker.local : window.VttConfig.worker.deployed;
