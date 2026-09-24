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
| M2 | Homebrew characters & NPCs into `campaign/dsl/` (4 PCs as `Character`; Pinchie, Umbral Raven, the bestiary), from Foundry, gated + field-checked | **in progress** — 4 PCs + 2 companions done (below); NPCs/environments/adversaries + 3 record-less companions await a Foundry pull |
| M3 | Characters onto the VTT sheet; companion view/control; retire the old `play/` sheets | |
| M4 | Migrate the 171 wiki pages → `campaign/docs/` + tabs; scope `umbra.css`; interactive atlas as a tab; Behind-the-Veil → gated `VttConfig.notes`; seed the S28 arc | |
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
- **Still to convert (all need a Foundry pull — only 8 actors are in the 2026-09-24 snapshot):** 3 record-less companions (Bob the Living Fortress, You Bastard, Yuki), the 2× Speaker construct (character-typed → the `Character` path, as a variant pair), 12 character-NPCs, 4 environments, 12 named + 68 generic adversary statblocks (14 fae already sit in `campaign/adversaries/` as Foundry JSON).

## Decision log (autonomous calls this session)
- **Companion modeling (owner, 2026-09-24):** the plan's "companions as `Adversary`" (decision 5) was written before the records were seen. Pinchie & the Umbral Raven are Foundry `companion`-type (the Ranger's-Companion sheet), not adversaries. Owner chose to **extend the corpus `Ranger Companion` ACTOR upstream** with optional played-instance fields (Pronouns, Partner, Evasion, Stress, Marked Stress, an Attack DEF, Experiences, Upgrades, Description) rather than force them into `Adversary`. "Player view+control" (decision 5) is an engine/ownership feature (M3), independent of the DSL type. Speaker ×2 are `character`-typed → the `Character` path.
- **Upstream Ranger Companion extension** — corpus `titterpig-dsl-daggerheart` core-base bumped 0.5.2→**0.5.3** (`71a9225`, pushed); VTT `data/` regenerated + gated (`919eb94`, pushed); merged into this instance (only `data/*.js` changed, boundary held).
- **`ref()` normalization** — Foundry and the corpus disagree on case/punctuation for the same entity (`Executioner's Guild`↔`Executioners Guild`, `Book of Ava`↔`Book Of Ava`). `convert_pcs.ref()` falls back from an exact corpus lookup to a *single* normalized (letters+digits, lowercased) match and emits the corpus's canonical spelling; `check_pcs` compares reference names normalized.
- Namespacing `channel`/`storagePrefix` set to `caul-vtt` (was the VTT's `sortilege-vtt-daggerheart`) — origin-scoped anyway, but keeps localhost previews of the base VTT and this instance from sharing storage. `dataGlobal` left `DAGGERHEART` (must match `data/*.js`).
- Worker named `caul-vtt`; launch.json site port `8142`, worker `8796` (the VTT's).
- `campaign/CNAME` (moved by M1.1) removed — CNAME lives only at root.
