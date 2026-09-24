// system/daggerheart/boot.js — the table and the player's page read the sheet synchronously when
// they start (engine/vtt.js, engine/play.js), but the books load on demand. So those pages load
// both books first (the Character ACTOR, the classes and cards a sheet names are spread over
// them), then the engine page named in data-page. The engine is left as it is.
(function () {
  const me = document.currentScript;
  const page = me && me.getAttribute('data-page');
  const D = window.DHData;
  D.ensure(D.books().map((b) => b.id)).then(() => {
    const s = document.createElement('script');
    s.src = page;
    document.body.appendChild(s);
  });
})();
