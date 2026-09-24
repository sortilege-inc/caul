# sortilege-vtt-daggerheart — plan and decision log

A virtual tabletop for **Daggerheart** (Darrington Press), built on the Titterpig corpus
`titterpig-dsl-daggerheart/0.5`: the Core Rulebook and *Hope & Fear*. Its shape follows
`PLAYBOOK.md` and `INSTANCES.md` (in `~/Sortilege/VTT/`, beside the VTT repos), and its code
is derived from `sortilege-vtt-l5r5e`, the newest of the line and the one that carries the
instance hook. Tenth in the line — Wyldwolf Axis, NOVA Open, City of Winter, TEETH, Invisible
Sun, Troika!, VtM5e, Aegean, L5R5e.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and
verified (in the browser by the main session, for anything the browser shows).

## Ground rules (inherited)

- The sibling repos are read-only reference. What is reused is the system-agnostic code only:
  `engine/*.js` (no game words), the generic DSL parser, the build and its gates, the layer
  build and the instance hook, the Worker — all copied from `sortilege-vtt-l5r5e`'s **last
  commit** (its working tree holds uncommitted work that is not ours). No other system's data,
  `system/` module, css or art comes across. Every word of rules text this site shows is from
  `titterpig-dsl-daggerheart/0.5`.
- `data/` is generated; regenerating is the only way to change it. Corpus gaps found while
  building are fixed in the corpus (or reported to its `TODO.md`), never patched in the tool.
- Rules text is verbatim. The tool's own words are labels and connective prose only. A number
  the rules state only in prose is a named constant citing its sentence.
- Round up by default; round down only where the text says so (owner, 2026-09-23, from L5R5e).

## What L5R5e's instance work taught, built in from the start

L5R5e grew its player page (I11–I16) and its instance hook (I1, I7–I10) after M5, driven by
the first instance. Here they are part of the milestones, not retrofits:

- **The instance hook** — `engine/instance.js`, the stage tags in every page, `build/build_layer.*`,
  `defaultCampaign.seed`, the gated Notes document — ships in M0/M3, before anything forks.
- **The player's page is a phone page first** (I11–I16): a pane bar at ≤ 640 px, numbers tapped
  and never typed, no working or explanatory text on the player's copy, cards that open to their
  printed text (domain cards here, as techniques there), a conflict started by the GM.
- **The corpus is hashed before the first build** (L5R5e's H1, done late, cost a rename table
  and a migration of stored state). Here no `u:` id ever reaches stored state.

## What is on disk (read 2026-09-24)

| Input | State |
|---|---|
| `~/Sortilege/VTT/sortilege-vtt-daggerheart` | cloned empty 2026-09-24; remote `sortilege-inc/sortilege-vtt-daggerheart`; identity Jordan Peacock <jordan@sortilege.online> per repo |
| `~/Sortilege/Titterpig/DSL/titterpig-dsl-daggerheart/0.5` | 48 files, 2.9 MB: 29 `.ttrpg` (18 core, 11 *Hope & Fear*), 19 `.lore`; validator 29 files 0/0, constructs 0, §5d 3,048 sites 0/0; coverage core and H&F **PASS** (6b826d7, 2026-09-24) |

### The corpus, by what the tool needs

| Need | In the corpus | Shape |
|---|---|---|
| The rules | `core-base` (traits, the Action Roll's OUTCOMES verbatim, Difficulty, Proficiency, Range, rests, death moves, tiers, Damage Thresholds, conditions), `core-mechanics`, `gm-mechanics` (Fear budgets, countdown types), `encounter-mechanics`; the rules chapters' prose in `.lore` | typed DEFs; prose |
| The dice | `^"Action Roll"` OUTCOMES (five, verbatim); the roll itself is a 2d12 Hope/Fear pair — the dice are not a table of faces as in L5R5e | read from the OUTCOMES + the rule text |
| Character creation | 9 classes + 18 subclasses (core) and H&F's, 18 + H&F ancestries, 9 + H&F communities, 9 domains, 189 + H&F domain cards, 9 Character Guides (the suggested build per class), equipment, the `character-creation.lore` chapter | typed |
| The sheet | `ACTOR "Character"` EXTENDS `"Entity"` — **incomplete** (D1) | typed |
| Adversaries, environments | 129 + H&F adversaries, 19 + H&F environments; ATTACK / EXPERIENCES / FEATURES / POTENTIAL_ADVERSARIES blocks | the GM's cast |
| Adventures | **none** — no `.arc`; the modules are the 10 campaign frames (6 core, 4 H&F) with their principles, mechanics, session-zero questions, and each frame's narrative in `.lore` | the table's modules |
| Pregens | **none** — no `.actor`; the 9 Character Guides are suggested builds, not characters | the creator's starting points |

## Decisions

**D1 — (owner, 2026-09-24) complete `ACTOR "Character"` in the corpus.** The BASE declares
traits, HP, Stress, Hope, thresholds, Experiences (as text) and conditions; it has no weapon
slots, armor, domain cards (loadout and vault), gold, inventory, class or Hope feature, armor
slots, and Experiences carry no modifier. The missing fields are added to `core-base.ttrpg`
under the printed character sheet's own names (`character-sheet.lore`), versioned, gated.

**D2 — (owner, 2026-09-24) hash every entity in the corpus before M1** (L5R5e's H1, done first
here). The first build wrote ids for 1,928 of 3,360 entities.

**D3 — (owner, 2026-09-24) the three open core coverage units:** the credits staff list
excluded; *STEP 1: PITCH THE CAMPAIGN* and *Elk* covered. **Done** (corpus 6b826d7): the whole of
p.254 (*Campaign Frame Breakdown*) was missing and is carried verbatim; *Elk* was carried but
uncreditable, and titterpig-mastra's coverage gate now credits a Table Row by an exact `.lore`
cell (809f735, measured over 41 manifests: one unit changes).

**D4 — (owner, 2026-09-24) private for now.** Nothing deployed; the Worker admits localhost and,
until an origin is chosen, only `sortilege-inc.github.io`.

**D5 — the books are the shelf** (autonomous, tool/method). Two books share one directory:
*Hope & Fear*'s files carry `hope-and-fear-`, every other file is the core's (the core's prefix
is empty in `BOOKS` and takes what no other book claims).

## Layout

```
index.html               the site: the books, classes, domains and cards, ancestries and
                         communities, adversaries, environments, equipment, the frames, the dice,
                         making a character, search
build/                   the generator and its gates; build_layer.* for an instance's homebrew
data/                    GENERATED — window.DAGGERHEART.books / .entities / .index / .records
engine/                  system-agnostic, from sortilege-vtt-l5r5e (with the instance hook)
system/daggerheart/      accessors, the entity renderer, the dice, the sheet, the creator, the
                         site's tabs; for the table: ops, the table adapter, panels
gm/                      the GM's page, the map table (vtt.html), the player's page (play.html)
worker/                  the session rooms (Cloudflare Worker + Durable Object); not deployed
assets/                  the look
```

Local: launch entries `vtt-daggerheart` (**8742**) and `vtt-daggerheart-worker` (**8794**) —
8736–8741 and 8788–8793 belong to the siblings and the campaign sites.

## Milestones

| # | Milestone | Proof required |
|---|---|---|
| C1 | Corpus: the three coverage units (D3) | **landed 2026-09-24** — corpus `6b826d7`, mastra `809f735`: `coverageAudit` core *1,585 units, covered 1,550, excluded 35, UNCOVERED 0 — PASS*; H&F *PASS*; validator 29 files 0/0; constructs 0; §5d 3,048 sites 0/0 |
| M0 | Repo skeleton: `engine/`, `build/` (parser, build, gates, layer build), `worker/` from L5R5e HEAD, renamed; `engine/config.js`; launch entries; this plan | **landed 2026-09-24** — the inherited parser reads 29 of 29 `.ttrpg` unchanged; the first build: *48 corpus files → 2 books, 3,360 entities (1,928 with an id this build wrote)*, `verify_data` *13,689 strings (35,953 occurrences) — 0 uncovered · 0 short · 0 unsourced*; `grep -rni 'l5r\|rokugan\|samurai' engine worker/src` matches nothing |
| H1 | Corpus: every entity hashed (D2) | the VTT's build writes **0** ids; corpus gates green; the build before and after compared entity by entity |
| C2 | Corpus: `ACTOR "Character"` completed (D1) | corpus gates green; every field named as the printed sheet names it |
| M1 | `data/` generated losslessly, gated both ways by count; `check_shape.py` against counts grepped from the raw corpus | `build.sh` green; shape assertions from a raw-text scan |
| M2 | The site: the books, classes/subclasses, domains and cards, ancestries, communities, adversaries, environments, equipment and loot, the frames, the dice, search | browser, through the real controls, 0 console errors |
| M3 | The GM's page: the frames as modules, Party, Inspector, Cast (adversaries and environments into a scene), Fear and countdowns, Dice, Rules, Log, Campaign; Notes / Scenes / Threads panes; the table and the player's page wired — the player's page phone-first | browser, through the real controls |
| M4 | The sheet derived from `ACTOR "Character"`, the creator (the book's character-creation chapter walked, the Character Guides as starting builds), the live sheet (HP, Stress, Hope, armor slots, conditions, domain-card loadout) and Duality Dice rolls | browser, through the real controls |
| M5 | Sessions proven with `wrangler dev` on 8794; deploy is the owner's step (D4) | two origins, a player's view without GM notes, a claimed sheet, a roll in the GM's log |

One commit per milestone; each proven before the next begins (PLAYBOOK §5, §7).

## Decision log

| # | Decision | Why |
|---|---|---|
| 1 | Engine, parser, build, gates, layer build, instance hook and Worker copied from `sortilege-vtt-l5r5e` HEAD (`9298587`), not its working tree | Its newest derivation, with the hook PLAYBOOK §4 wants before any fork; its working tree carries another session's uncommitted `dice.js` / `sheet.js` / css. |
| 2 | Ports 8742 / 8794 | Every other VTT's `launch.json` read: 8736–8741, 8788–8793 taken. |
| 3 | D5 above: the core's `BOOKS` prefix is empty; `book_of` lets an empty prefix match any file, the longest prefix still wins | The core's files carry no book prefix of their own. |
| 4 | *Elk* covered by a gate change rather than a hollow `^"Elk" DEF` | The row was carried verbatim; a name under four letters could be credited only by an entity of exactly that name, and inventing entities to satisfy a gate is the wrong fix. The table also became a `^"Mounts" LIST` (it had been pipes flattened into a Description). |
| 5 | Found while covering D3 and fixed the same way: *Lurking Darkness* (p.290) had its d12 list flattened into its Description with two rows wrapped in half — now `ROLL_TABLE "1d12"` | A table the table rolls must be structured; it was the corpus's only other flattened table (`grep` for pipes inside STRING values: 2 hits, both fixed). |
