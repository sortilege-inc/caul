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
  // The campaign's own scripts, loaded by engine/instance.js at the stages the upstream pages
  // mark. The DSL layer (campaign/dsl/ → campaign/data/, via build/build_layer.sh) registers the
  // campaign's 106 statblocks into the data global at the `data` stage. Site tabs + GM doc land
  // at M4.
  instance: {
    stages: {
      data: ['campaign/data/index.js'],
    },
  },
  worker: {
    deployed: '',                 // set at deploy (M5): the caul.sortilege.online Worker
    local: 'http://localhost:8796',
  },
};
window.VttConfig.workerUrl = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? window.VttConfig.worker.local : window.VttConfig.worker.deployed;
