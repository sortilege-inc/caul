# The Enduring Lesser Lights — instance plan

An **instance** of the Daggerheart VTT (`sortilege-vtt-daggerheart`): the Caul campaign, live at
**caul.sortilege.online**. Built per `~/Sortilege/VTT/INSTANCES.md`. The VTT owns root; this
campaign owns `campaign/` + the `merge=ours` boundary files. Upstream is pulled by merge, never
rebase (`git fetch upstream && git merge upstream/main`; run `git config merge.ours.driver true`
once per clone).

## Decisions (locked with the owner, 2026-09-24)
1. **Public.** Publishes the Daggerheart VTT `data/` (Core + Hope & Fear) verbatim, as Portents did with L5R5e. First push carrying `data/` is the publication point.
2. **Domain `caul.sortilege.online`** (already the repo's CNAME).
3. **No redirects.** The old standalone `/chronicle/…`, `/atlas/…` URLs become in-app tab routes; nothing forwards.
4. **Existing wiki migrated once, not re-imported.** Going forward, chronicles/characters are regenerated from transcripts and/or Foundry into this instance's structure — the old `caul-support/build_site.py → caul/` pipeline is retired after the snapshot migration.
5. **Companion NPCs are player-controlled.** Pinchie (Jamal's companion) and the Umbral Raven (Sylvie's familiar) are `Adversary` instances the claiming player can **view and control** — the owner-link + player ops built upstream (generic: familiars/companions).
6. **The Age of Umbra campaign frame is in effect** (`#t5KkPQAKPBQWhS6w3ZFiQh2x`, corpus `campaign-frames`) — set as `defaultCampaign.modules`; its rules modifications come from the frame's own mechanics; a highlighted section surfaces it.
7. **House rules:** none hand-authored — the Age of Umbra frame carries the setting's modifications. Add `MODIFY`s later as table rulings firm up.

## Milestones (each proven in the browser through its real controls)
| # | Milestone | Status |
|---|---|---|
| M0 | Plan + decisions | **done** — this file |
| M1 | The fork | **done 2026-09-24** — see below |
| M2 | Homebrew characters & NPCs into `campaign/dsl/` (PCs as `Character`; companions, the bestiary, environments), from Foundry, gated + field-checked | **done 2026-09-24** — 106 statblocks (4 PCs, 5 companions, 13 NPCs, 80 adversaries, 4 environments), all layer-gated + field-checked with planted-failure tests |
| M3 | Characters onto the VTT sheet; companion view/control; retire the old `play/` sheets | **done 2026-09-24** — roster pickers, sheet render, companion control all proven in the browser (below) |
| M4 | Migrate the 167 wiki pages → `campaign/docs/` + tabs; scope `umbra.css`; interactive atlas as a tab; Behind-the-Veil → gated `VttConfig.notes`; seed the S28 arc; Age of Umbra highlighted section | **done 2026-09-24** — all pieces below, each proven in the browser (0 console errors) |
| M5 | Deploy (owner): Worker `caul-vtt`, `worker.deployed`, push `main`, Pages, HTTPS, two-browser live proof | |

## M1 — the fork (branch `vtt-instance`, unpushed)
Three commits, each proven:
- **M1.1 move** (`ad28cfa`) — `git mv` the whole Caul wiki under `campaign/`. Proof: 221 files, all `R100`, 0 insertions / 0 deletions.
- **M1.2 merge** (`0cba625`) — `upstream` = `sortilege-vtt-daggerheart` (main `b5710ab`); `git merge --allow-unrelated-histories`. 0 conflicts (the wiki lives under `campaign/`, so no path collided with the VTT root).
- **M1.3 boundary** (`facec96`) — instance-owned root files, all `merge=ours`: `engine/config.js` (title, `caul-vtt` namespacing, Age of Umbra `defaultCampaign`, `instance: null` until content lands), `worker/wrangler.jsonc` (`caul-vtt`, ALLOWED_ORIGIN = caul + github.io), `README.md`, `CNAME`, `.gitignore`, `.claude/launch.json`, `.gitattributes`; driver enabled.

**Boundary proven (throwaway clone):** an overlapping upstream change to `engine/config.js` + a change to `engine/app.js` — without the driver the merge conflicts on `config.js`; with it, `config.js` keeps the instance's copy entirely and `app.js` takes the upstream change.
**Boot proven:** served locally, `/` and `/gm/` HTTP 200, tab title "The Enduring Lesser Lights", data loaded (2 books, 3,036 entities), Age of Umbra frame id resolves in `data/`, zero console errors.

## Foundry (source for M2)
Relay `foundryrestapi.com`, world online; clientId supplied per session (a session secret, not stored here). Fresh snapshot pulled to `caul-support/archive/foundry-export/2026-09-24/` — 4 PCs + Pinchie + Umbral Raven + 2× Speaker. **No clashes:** the PCs are structurally identical to the 2026-09-12 export (all level 6, same classes/subclasses/cards). The 14 fae adversaries already sit in `campaign/adversaries/` as Foundry JSON.

## M2 roster disposition (owner, 2026-09-24 — `campaign/source/foundry-roster.json`)
All 150 Foundry actors categorized: **4 PCs, 5 companions, 10 character-NPCs, 4 environments, 12 named + 68 generic adversary statblocks** (20 numbered actors are instances that reuse a generic's statblock), **23 dropped**.
- **Named vs generic adversaries:** a *named* adversary is a single unique instance; a *generic* may be duplicated at the table and renamed. Encoded per statblock in the layer; single-instance enforcement for named ones is a table rule (upstream if it needs engine support).
- Splits resolved: "Lonely Spirit" is two actors (character → drop, adversary → generic); "Dwarf Captain (Copy)" and the duplicate "Chaos Realm" dropped; full-title actors matched by prefix ("Ash-begets-Tide, Priest of Ossa-in-Abstentia", "Inola Wending, Keeper of Splendor"); "The Kindly Light" is the actual world actor.
- **Undecided (await owner):** `Mellan` (plain — the Revenant version is imported), `Tueri`, `Speaker` ×2 (Sylvie's construct — companion or NPC?).

## M2 progress (2026-09-24)
- **4 PCs → `Character`** (`campaign/dsl/caul-pcs.actor`, commit `56414be`). Draz + Heyou are multiclass (upstream Second Class/Subclass). `convert_pcs.py` + `check_pcs.py`; layer-gated (0 uncovered strings, all refs resolve) + field-checked (18/18/16/16 fields vs the records; `--plant` catches perturbations). Pronouns per the owner: Draz he/him, Heyou they/them, Jamal he/him, Sylvie she/her.
- **2 companions → `Ranger Companion`** (`campaign/dsl/caul-companions.actor`). Pinchie (Jamal) + Umbral Raven (Sylvie), each a *played instance* of the Ranger Companion type (fields added upstream, see decision log). `convert_companions.py` + `check_companions.py` + shared `companion_extract.py`; layer-gated + field-checked (9/9 fields; `--plant` catches perturbations).
  - **Record anomalies flagged (owner to fix at the Foundry source, then re-pull — decision 4):** Pinchie's attack die is stored as `d20` (Foundry's unset default; the converter uses the record's `valueAlt` `d6`); the Umbral Raven has two blank-named Experiences (modifier 2 each).
- **5/5 companions done** — the 3 unbonded ones (You Bastard, Bob, Yuki) added after the Foundry pull refreshed all 150 world actors into the 2026-09-24 snapshot.
- **80 adversaries → `Adversary`** (`campaign/dsl/caul-adversaries.actor`). 12 named + 68 generic statblocks (the 20 rename-instances reuse a generic's block at the table — a table rule, not separate blocks). `adversary_extract.py` + `convert_adversaries.py` + `check_adversaries.py`; each block carries its ATTACK / EXPERIENCES / FEATURES sub-blocks (features are hash-bound child entities). Layer-gated (292 entities incl. feature children, 976 strings 0 uncovered, all refs resolve) + field-checked (**80/80**, every stat-block number + attack + experiences + every feature; `--plant` caught all 80). Anomalies flagged: three features have no description in Foundry (Ancient Fury / Fear is Fuel / Dense but Clumsy).
- **13 character-NPCs → `Character`** (`campaign/dsl/caul-npcs.actor`) incl. the Speaker GM PC, reusing the PC converter (`convert_npcs.py`/`check_npcs.py`, Pronouns omitted — records state none). 13/13 field-checked. Askavir (no class) handled; Ygva's homebrew "Umbra Veil" card carried to Inventory (no corpus entry). Variant pairs Mellan/Savel/Sarru each a faithful instance (some variants live in the adversary set, e.g. Umbral Savel).
- **4 environments → `Environment`** (`campaign/dsl/caul-environments.actor`, `env_extract.py`/`convert_environments.py`/`check_environments.py`). Tier/Description/Difficulty + POTENTIAL_ADVERSARIES (compendium UUIDs resolved to names, cached in `env-adversary-names.json`) + FEATURES (Type parsed from name suffix or description lead). 4/4 field-checked. Category/Impulses absent — the Foundry env schema does not store them.
- **Converter fix (both PCs and NPCs):** an unresolved (homebrew) domain card is now carried onto the sheet as an Inventory string, not dropped; the field-check compares loadout+vault to the *resolvable* card count.

## M3 progress (2026-09-24)
- **Data stage wired** (`engine/config.js` `instance.stages.data = ['campaign/data/index.js']`, commit `95017fc`). The 319 campaign records register into the `DAGGERHEART` global (records 2978 → 3297). Verified in the browser.
- **Upstream `memberFromCharacter`** (VTT `14a81d8`, pushed + merged) — renders a fully built Character instance (not just an appendix Guide) as a live sheet member: class(es)/subclass(es) incl. multiclass, heritage, traits, stats, experiences, loadout/vault, inventory. **Caller must `D.ensureAll()` first** so cross-book refs (core classes, etc.) resolve.
- **Render proof (browser):** all 4 PCs render on `liveSheet`. Draz shows the multiclass end to end — header "Ranger / Druid · Wayfinder / Warden of the Elements · level 6 · Simiah · Wildborne", **11 features from both classes**, Evasion 13, thresholds 13/22, Proficiency 4, his 4 Experiences as roll modifiers, the Improved Shortbow (4d6+6). Heyou likewise (Rogue/Assassin + both subclasses).
- **GM roster pickers** (upstream `panels.js`, VTT `bb27b1a`): the party panel gained "add a built character…" (the campaign's 17 Character instances → `memberFromCharacter`) and "add a companion…" (the 5 companions → `memberFromCompanion`), beside the appendix-Guide picker. Both empty/hidden in the base VTT. **Proven:** adding Jamal + Pinchie put both in the party with the right templates and `source.partner`.
- **Companion view/control** (decision 5) — upstream `memberFromCompanion` + `companionSheet` (Evasion, a Stress track the player marks/clears, the attack with a damage roll, Experiences, training); `liveSheet` routes companion members to it. `engine/play.js`: a claiming player sees and controls the companion(s) whose `source.partner` is their character's name. **Proven:** Pinchie renders (Evasion 6, Stress 0/3, Charge, 4 experiences, 4 upgrades); the Stress track marks (0→2) and persists; Jamal's player gets Pinchie, Sylvie's would not.
- **Old `campaign/play/` sheets retired** (removed). The 4 links from `campaign/company/*.html` to `../play/` are dead until M4 rewires them during the wiki migration.
- **Age of Umbra frame** (decision 6) already surfaces on the GM Frame tab (God-King Othedias, Matthew Mercer) — M4 adds the highlighted section.

## M4 approach — incorporating the updated instance playbook (`~/Sortilege/VTT/INSTANCES.md`, PLAYBOOK §4; Portents M7, 2026-09-24)
Reviewed the current playbook + Portents' proven M7 tooling before starting. **What the Daggerheart VTT actually supports** (verified in `engine/config.js`, `engine/instance.js`, `system/daggerheart/gm-panes.js`, `site.js`) — I use only these; `gmGate`, `siteBooks`, `ownAdventure`, `hidePanes`, `paneOrder` are L5R5e-only and absent here:
- `instance.styles: [...]` — loaded once at the first stage (scoped `umbra.css` goes here).
- `instance.stages.{data,site,gm,table,play}` — `site` pushes tabs onto `window.VttSiteTabs`; `gm` registers panels via `window.VttPanels.register`.
- `defaultCampaign.seed: 'campaign/pack/seed.json'` — fills what the campaign never had (the S28 arc = scenes), once, never overwriting the GM's edits.
- `notes: { src, title, class, gate: { title, text, enter } }` — the GM Notes-pane document behind a spoiler gate → **this is Behind-the-Veil** (not a whole-page `gmGate`).
- `defaultSlots` — panes the GM table opens on.

**Migration method (Portents' pattern, adapted).** Deterministic + gated, mirroring `migrate_docs.py`/`scope_css.py`:
1. `campaign/source/migrate_docs.py` — take each page's `<div class="wrap">` content region into `campaign/docs/<name>.html`; drop chrome (nav/breadcrumb/footer/scripts); rewrite links to tab routes (`#chronicle/s26`, `#atlas/drosvens-gate`, `#personae/askavir`) and assets to `campaign/assets/`. **Prove per doc:** text identical to the old region + every href/src resolves; **make the proof fail once** (planted change + planted bad link); **run before deleting** the old pages.
2. `scope_css.py` — scope `umbra.css` under `.caul-doc` (undo `body`/`:root`/`min-height:100vh` so it can't restyle the whole VTT); a small hand file fits paper to frame.
3. `site.js` — `docTab(name, after)` fetches `campaign/docs/<name>.html` into a `.caul-doc` container, scrolls to the path anchor, runs the page's own script as an `after` fn (listeners self-remove — tabs re-render, no reload). Tabs pushed campaign-first.
4. Seed `campaign/pack/seed.json` with the **S28 arc** (scenes), via `defaultCampaign.seed`.
5. **Age of Umbra highlighted section** (decision 6) — a home-doc block surfacing the frame already shown on the GM Frame tab.

**Section → tab model** (Caul is multi-page, unlike Portents' single pages): 8 tabs — Chronicle (27 sessions), Company (4 PCs), Dramatis Personae (50), Factions (9), Atlas (~10 + interactive map), Relics (32), Lore (3), Home. Each section concatenates its hub + entries into one doc with per-entry anchors.

**Design decisions (owner, 2026-09-24):** DP tab renders from the **wiki prose profiles**; the `gm/` pages **split** — lore→veil, live tracking→panes. The atlas has an existing interactive map (preserved as its own tab).

## M4 progress — done 2026-09-24 (each proven in the browser, 0 console errors)
- **152 docs migrated** (`migrate_docs.py`, commit `a941020`) → `campaign/docs/<route>/<stem>.html`; text-identical to the old regions, every link rewritten to a tab route + resolving; `--plant` catches a bad text/link.
- **`umbra.css` scoped** (`scope_css.py`, 157 rules under `.caul-doc`) + `caul-doc.css` fit file; **`site.js`** registers the 8 campaign tabs (`docTab` fetches a doc by path), campaign-first (`d774f31`).
- **Behind-the-Veil** (`build_veil.py` → `docs/veil.html`, 10 lore pages) behind the Notes-pane spoiler gate (`config.notes`); **Age of Umbra** highlighted section on the home tab (`fc13c28`).
- **Interactive atlas map** (`build_map.py` → `atlas-data.js`, 21 pins; `map.js` = `window.CaulMap`, pan/zoom/markers/legend/detail/gazetteer, scoped + self-cleaning) — `5ffaa99`.
- **Seed** the S28 arc + 6 tracked threads (`build_seed.py` → `pack/seed.json`, `defaultCampaign.seed`) — factual recap, no invented plot — `830794c`.
- **Old top-level pages retired** (166 `.html`, `0be3fb2`); portraits + the map image kept in place; old URLs 404 (decision 3). The migration scripts (`build_veil`/`build_map`/`build_seed`) read the now-retired sources, so they don't re-run — their outputs are committed and were gated at build; the sources live in git history.

## Decision log (autonomous calls this session)
- **Companion modeling (owner, 2026-09-24):** the plan's "companions as `Adversary`" (decision 5) was written before the records were seen. Pinchie & the Umbral Raven are Foundry `companion`-type (the Ranger's-Companion sheet), not adversaries. Owner chose to **extend the corpus `Ranger Companion` ACTOR upstream** with optional played-instance fields (Pronouns, Partner, Evasion, Stress, Marked Stress, an Attack DEF, Experiences, Upgrades, Description) rather than force them into `Adversary`. "Player view+control" (decision 5) is an engine/ownership feature (M3), independent of the DSL type. Speaker ×2 are `character`-typed → the `Character` path.
- **Upstream Ranger Companion extension** — corpus `titterpig-dsl-daggerheart` core-base bumped 0.5.2→**0.5.3** (`71a9225`, pushed); VTT `data/` regenerated + gated (`919eb94`, pushed); merged into this instance (only `data/*.js` changed, boundary held).
- **Speaker (owner, 2026-09-24):** of the two Speaker actors, use the one in the PC folder (`TxIdhXZGY132kZ8o`) as a **GM-run PC** (the `Character` path), not a Sylvie companion; drop the other (`hTjFVuzmKTIJr41m`, no folder). Roster updated.
- **`ref()` normalization** — Foundry and the corpus disagree on case/punctuation for the same entity (`Executioner's Guild`↔`Executioners Guild`, `Book of Ava`↔`Book Of Ava`). `convert_pcs.ref()` falls back from an exact corpus lookup to a *single* normalized (letters+digits, lowercased) match and emits the corpus's canonical spelling; `check_pcs` compares reference names normalized.
- Namespacing `channel`/`storagePrefix` set to `caul-vtt` (was the VTT's `sortilege-vtt-daggerheart`) — origin-scoped anyway, but keeps localhost previews of the base VTT and this instance from sharing storage. `dataGlobal` left `DAGGERHEART` (must match `data/*.js`).
- Worker named `caul-vtt`; launch.json site port `8142`, worker `8796` (the VTT's).
- `campaign/CNAME` (moved by M1.1) removed — CNAME lives only at root.
