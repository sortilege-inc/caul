// engine/config.js — where things are. The one file a deployment edits.
window.VttConfig = {
  system: 'daggerheart',
  title: 'Daggerheart',
  channel: 'sortilege-vtt-daggerheart',        // BroadcastChannel name (same-machine windows)
  storagePrefix: 'sortilege-vtt-daggerheart',  // localStorage key prefix
  dataGlobal: 'DAGGERHEART',                   // the global data/*.js registers into
  // The pages, relative to the site root; the gm/ pages carry <base href="../"> so every
  // path stays root-relative.
  pages: { site: './', gm: 'gm/', table: 'gm/vtt.html', play: 'gm/play.html' },
  // what a fresh browser opens on until a campaign is created or restored: no campaign
  // frame is picked (the Adventure panel offers them), no book beyond what a view asks for.
  // An instance may add `seed: 'campaign/pack/seed.json'` — a pack whose keys fill what its
  // campaign has never had (its arc, its encounters), once (engine/state.js seed).
  // An instance may also name the Notes pane's document (system/daggerheart/gm-panes.js):
  //   notes: { src: 'campaign/docs/state.html', title: '…', class: 'pf-doc',
  //            gate: { title: '…', text: '…', enter: 'Bow & Enter' } }
  // a .html src is the instance's own fragment, inserted as it is; anything else reads as Markdown.
  defaultCampaign: { name: 'A new campaign', modules: [], books: [] },
  // the three panels the GM page opens on (engine/app.js)
  defaultSlots: ['frame', 'party', 'inspector'],
  // The Worker that holds player sessions. Served from localhost the app talks to
  // `wrangler dev`; deployed, to the URL below. Empty = sessions disabled until the owner
  // deploys (PLAN.md D3).
  // An instance (a campaign repo forked from this VTT) declares its own scripts here — its
  // data layer, site tabs, GM panels and styles — and engine/instance.js loads them at the
  // stages the upstream pages mark. Upstream declares none. Shape: engine/instance.js.
  instance: null,
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
    deployed: '',
    local: 'http://localhost:8796',
  },
};
window.VttConfig.workerUrl = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? window.VttConfig.worker.local : window.VttConfig.worker.deployed;
