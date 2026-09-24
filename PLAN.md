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

Local: launch entries `vtt-daggerheart` (**8742**) and `vtt-daggerheart-worker` (**8796**) —
8736–8741 and 8788–8793 belong to the siblings and the campaign sites.

## Milestones

| # | Milestone | Proof required |
|---|---|---|
| C1 | Corpus: the three coverage units (D3) | **landed 2026-09-24** — corpus `6b826d7`, mastra `809f735`: `coverageAudit` core *1,585 units, covered 1,550, excluded 35, UNCOVERED 0 — PASS*; H&F *PASS*; validator 29 files 0/0; constructs 0; §5d 3,048 sites 0/0 |
| M0 | Repo skeleton: `engine/`, `build/` (parser, build, gates, layer build), `worker/` from L5R5e HEAD, renamed; `engine/config.js`; launch entries; this plan | **landed 2026-09-24** — the inherited parser reads 29 of 29 `.ttrpg` unchanged; the first build: *48 corpus files → 2 books, 3,360 entities (1,928 with an id this build wrote)*, `verify_data` *13,689 strings (35,953 occurrences) — 0 uncovered · 0 short · 0 unsourced*; `grep -rni 'l5r\|rokugan\|samurai' engine worker/src` matches nothing |
| H1 | Corpus: every entity hashed (D2) | **landed 2026-09-24** — corpus `8a09c22`: 1,603 DEFs hashed (`#t` + 23, the corpus's majority form) by `titterpig-audit/daggerheart/hash_unhashed/hash.py`; every changed line differs only by an added hash (1,570), a mapped glyph or a VERSION (47); the VTT's build before (glyphs mapped) and after, entity by entity with the old ids renamed: *3,035 = 3,035, all identical*, **0** ids written; validator 29 files 0/0, constructs 0, §5d 3,048 sites 0/0, coverage core and H&F PASS. Found on the way: 47 private-use digit glyphs in H&F adversaries (decision 7) |
| C2 | Corpus: `ACTOR "Character"` completed (D1) | **landed 2026-09-24** — corpus `3babcf9` (core-base 0.5.1): Pronouns, Marked Armor Slots, Experiences as a LIST OF a new `^"Experience"` (Name, Modifier DEFAULT 2), Gold (Handfuls, Bags, Chest), Primary / Secondary Weapon, Active Armor, Inventory Weapons, Inventory, Loadout, Vault, Marked Traits, Character Description, Background Questions, Connections; Stress DEFAULT 6 — each with its sentence from the sheet sidecar or the creation chapter; validator 0/0, §5d 3,056 sites 0/0 |
| M1 | `data/` generated losslessly, gated both ways by count; `check_shape.py` against counts from the raw corpus; the layer build's fixture | **landed 2026-09-24** — `bash build/build.sh`: *48 corpus files → 2 books, 3,036 entities (0 with an id this build wrote)*; `verify_data` *13,697 strings (35,981 occurrences) — 0 uncovered · 0 short · 0 unsourced*; `check_shape: OK (79 assertions; 46 types, 2,973 typed entities)` — every type's count against its `EXTENDS` lines in the raw text, the Character ACTOR's 29 properties by name and order, OUTCOMES 5, the stat-block and frame blocks, ATTACK as values, Mounts 18, ROLL_TABLE 5; it failed first on OUTCOMES / ROLL_TABLE (10 nodes for 5 rows — decision 9). 3.9 MB of data. The layer fixture (one adversary on the Adversary chassis, a feature, a MODIFY + CONCERNS by name): *26 strings 0/0/0; ids 2, none the corpus's (3,036); every id resolves; 2 references by name resolve* — and each gate made to fail: a mistyped chassis → *REFERENCES … #daggerheartAdversary00000000X*, an id on the corpus's → *IDS … #daggerheartActionRoll000000001*, a misspelt CONCERNS → *NAMES … 'Proficency'*, each exit 1 |
| M2 | The site: the books, classes/subclasses, domains and cards, heritage, adversaries, environments, equipment and loot, the frames, the dice, search | **landed 2026-09-24** — browser on 8742 through the real controls: the shelf lists *2 books … 3,036 entries out of 48 files*; **Classes** lists 9 + 4 by book with their subclasses, and *Bard* opens to the class as printed (Domains Grace, Codex; Starting Evasion 10; the Hope feature *Make a Scene* and *Rally*), *Troubadour* and *Wordsmith* with Foundation / Specialization / Mastery, and the *Bard Character Guide*; **Adversaries** Tier 4 + Horde → *4 of 278*, *Ghastly Legion* opens to the book's stat block — *Tier 4 Horde (10/HP)*, Difficulty 17, Thresholds 25/45, HP 8, Stress 5, ATK +2, *Spectral Armaments: Close \| 4d6+10 mag*, Experience Tactics +2, three features as *Name - Type:* text; an environment opens to *Tier 1 Exploration … Impulses … Difficulty 11*; **Domains** Blade + level 1 → *3 of 210* (10 domains, Dread from H&F); **Equipment** weapons 322, the Loot switch → 206; **Frames** *Colossus of the Drylands* shows its card, principles, *Mounts* (18) and the frame's lore (15 sections); **Dice** Presence, +2, advantage 2 / disadvantage 1, Difficulty 12 → rolled Hope 2 / Fear 2 → *7 critical — Critical Success* with the corpus's text (a critical beats the Difficulty, one net d6 rolled), logged; **Search** "Rally Die" → 3 entries and 4 lines of prose. At 375 px no sideways scroll; light and dark themes. Every tab visited in one pass: 0 errors. **Found and fixed:** seven frame-principle names and two sidebar titles carried `****` (corpus `4c3f14c`) |
| M3 | The GM's page: the frames as modules, Party, Inspector, Cast (adversaries and environments into a scene), Fear and countdowns, Dice, Rules, Log, Campaign; Notes / Scenes / Threads · Encounters panes; the table and the player's page wired | **landed 2026-09-24** — browser on 8742 at 1400 px, through the real controls: the Frame picker lists the 10 frames and *Colossus of the Drylands* went in play (`campaign.modules`); **Scenes** added *The rampage at Wyllin's Gulch* and *Into the mines* to the arc (the first current); **Cast** put *Acid Burrower* and the environment *Abandoned Grove* in it (`cast[arc-…]`, shown on the Frame panel); **Party** › *Guardian Character Guide* made a level-1 guardian — Evasion 9, Armor 4, thresholds **8 / 16** (Chainmail 7/15 + level: the book's own guardian example), HP 7, Stress 6, Hope 2, 4 Armor Slots; Damage 12 → *Major*, *Take it with an Armor Slot* → *12 damage — Major · an Armor Slot (0 → 1) makes it Minor · HP 0 → 1* (the book's "12 is Major damage, so I'll mark armor and only take Minor damage"); Strength (+2 read from the character) rolled *10 with Hope* → *Hope 2 → 3*; a roll with Fear → the GM's Fear 0 → 1; **Fear & Countdowns** a countdown from 4 ticked to 3; **Inspector** *Acid Burrower* against Evasion 9 → *Acid Burrower · Claws: d20 7 +3 = 10 vs 9 — hits*, the result kept on screen; **Threads · Encounters** *Acid Burrower* → *Battle Points 5 = (3 × 1 PCs) + 2 · spent 5 · 0 left (Solo 5)*, *Add 2 Points* → 7. `gm/vtt.html` opened on the current scene with both arc scenes; *add token…* placed the guardian (*HP 1/7 · Stress 0/6 · Hope 3*) and the Acid Burrower; `gm/play.html` shows *Join the table*. 0 console errors on all three pages. Under node: a player may not `setFear`, may `addFear` only `[1, their own id]`, may send no `setNpcState` / `setSceneCast`; Fear caps at 12; the player view is `cast, fear, npcConditions, party`; `setNpcState` is never forwarded. **Found and fixed:** Add in Scenes / Threads did not redraw while the text field held focus; the Damage stepper rebuilt itself under the pointer; the Inspector redrew on every log line and wiped the roll it had just shown |
| M4 | The sheet derived from `ACTOR "Character"`, the creator (the book's character-creation chapter walked, the Character Guides as starting builds), the live sheet (HP, Stress, Hope, armor slots, conditions, domain-card loadout, rests) and Duality Dice rolls; the player's copy phone-first | **landed 2026-09-24** (the player's page inside a live session is M5's) — the site's *Make a character*: each step opens on its own section of the book (*STEP 1: CHOOSE YOUR CLASS* … *STEP 9: CREATE YOUR CONNECTIONS*, found only in the walkthrough's two lore files — the first cut took the Ancestries chapter's own "STEP 1"); Sable, she/her, Guardian (Valor & Blade) · Stalwart; Dwarf · Ridgeborne; *Use the Guardian Character Guide's suggestion* → Agility +1, Strength +2, Finesse −1, Instinct +0, Presence +1, Knowledge +0, *Still to place: none* (+2, +1, +1, 0, 0, −1); Step 4 Evasion 9 · HP 7 · Stress 6 · Hope 2; Battleaxe → *two-handed: no secondary weapon*, Chainmail Armor, the Minor Health Potion, *A totem from your mentor*; Experiences typed *Bodyguard* and *Stubborn to a Fault* (+2 each); Step 8 offered the six level-1 cards of Valor and Blade, two taken and a third refused; the summary *thresholds 8/16*, inventory *Torch, 50 feet of rope, Basic supplies, Minor Health Potion, A totem from your mentor*. The file the Save button writes, put into the GM's Party panel file input (a DataTransfer — the pane cannot choose a file), became *Sable · Guardian · Stalwart · level 1 · Dwarf · Ridgeborne*. Her sheet: Strength + *Bodyguard* → *21 with Fear (Hope 8, Fear 9, Strength +2, Bodyguard +2)*, *spent 1 Hope · Hope 2 → 1*, the roll kept on screen; nine cards — the class's *Frontline Tank*, *Unstoppable*, Stalwart's *Unwavering*, *Iron Will*, the Dwarf's *Thick Skin*, *Increased Fortitude*, Ridgeborne's *Steady*, and the two domain cards — *Unstoppable* tapped open to its full text. A guardian's **Short Rest**: the four short-rest moves offered, *Take* disabled until two are chosen → *Tend to Wounds (1d4 4 + tier 1 = 5): Hit Points 1 → 0 · Repair Armor (1d4 3 + tier 1 = 4): Armor Slots 1 → 0*. **The player's copy at 375 px**, drawn by `VttSystem.liveSheet(m, {player: true})` on the player's page (its session flow is M5): *Play · Roll · Gear* behind a bar at the bottom, each pane alone, 0 texts under 13 px, no button under 34 px, no sideways scroll; wider, every part shown. **Found and fixed:** the stat tiles clipped *PROFICIENCY* and the 44 px rule stretched Hope's circles; four stepper and tracker labels at 12.5 px |
| M5 | Sessions proven with `wrangler dev` on 8796; deploy is the owner's step (D4) | **landed 2026-09-24** — `wrangler dev` on **8796** (launch `vtt-daggerheart-worker`); the site served on two origins by one process (`vtt-daggerheart-two-origins`: 8742 the GM, 8744 the player — the preview pane admits neither 127.0.0.1 nor *.localhost). The GM's real **Start session** → room **GX36W**, live; a GM note written *GM ONLY: …* in the Notes pane. The player at `http://localhost:8744/gm/play.html?s=GX36W` (its own storage), phone size, joined by the link and was offered both characters; its state: `campaign, cast, clocks, clues, current, fear, log, maps, order, party, progress, table` — no `gmNotes`, `arc`, `threads`, `encounters` or `npcState`, party notes blank, *GM ONLY* nowhere; the shared countdown (1/4) and Fear (2) there. **Claim** Sable → her sheet in the Play pane, the GM's sidebar *1 claimed*; the bar's **Roll**, Strength, **Roll the Duality Dice** → *24 — critical success (Hope 11, Fear 11, Strength +2)*, the pane kept on Roll with the result shown, and on the GM's page *Hope 1 → 2* and both log lines under *Sable*; a roll with Fear (*9 with Fear (Hope 4, Fear 5)*) raised the **GM's Fear 2 → 3** through the room (`addFear(1, her id)`). A player's `setFear 12` → *not allowed: setFear*, the GM's Fear stayed 3; the GM's *Vulnerable* on Acid Burrower reached the player, its `setNpcState` did not. `npx wrangler deploy --dry-run` bundles the system ops. **Found and fixed:** a refused op stayed applied on the sender's own copy (Fear 12 on the player's page) — the Worker now sends the room's snapshot after a refusal: `setFear 11` showed 11, then the room's 3. **Deploy is the owner's step (D4):** `cd worker && npx wrangler deploy`, set `worker.deployed` in `engine/config.js` and `ALLOWED_ORIGIN` in `wrangler.jsonc`; the repo is private |

One commit per milestone; each proven before the next begins (PLAYBOOK §5, §7).

## STOPPED HERE — to resume

**M0–M5 landed 2026-09-24**, each committed and pushed. Nothing is deployed (D4, private).

To resume: `bash build/build.sh` (gate green); start `vtt-daggerheart` (8742) — or
`vtt-daggerheart-two-origins` (8742 + 8744) to test a player — and `vtt-daggerheart-worker` (8796;
`worker/node_modules` installed). `TODO.md` holds the sheet's known gaps.

## Decision log

| # | Decision | Why |
|---|---|---|
| 1 | Engine, parser, build, gates, layer build, instance hook and Worker copied from `sortilege-vtt-l5r5e` HEAD (`9298587`), not its working tree | Its newest derivation, with the hook PLAYBOOK §4 wants before any fork; its working tree carries another session's uncommitted `dice.js` / `sheet.js` / css. |
| 2 | Ports 8742 / **8796** (the player's origin in tests 8744) | Read from `~/.claude/launch.json`, where every preview entry lives: 8794 (M0's first choice, from the VTT repos' own launch files alone) is `portents-worker`'s, 8743 `blood`'s. |
| 3 | D5 above: the core's `BOOKS` prefix is empty; `book_of` lets an empty prefix match any file, the longest prefix still wins | The core's files carry no book prefix of their own. |
| 4 | *Elk* covered by a gate change rather than a hollow `^"Elk" DEF` | The row was carried verbatim; a name under four letters could be credited only by an entity of exactly that name, and inventing entities to satisfy a gate is the wrong fix. The table also became a `^"Mounts" LIST` (it had been pipes flattened into a Description). |
| 5 | Found while covering D3 and fixed the same way: *Lurking Darkness* (p.290) had its d12 list flattened into its Description with two rows wrapped in half — now `ROLL_TABLE "1d12"` | A table the table rolls must be structured; it was the corpus's only other flattened table (`grep` for pipes inside STRING values: 2 hits, both fixed). |
| 6 | **An untyped DEF inside `ATTACK` or `TIERS` is a value, not an entity** (`build_data.py` `STAT_VALUE_BLOCKS`): an adversary's one standard attack, a weapon's or armor's tier rows. A typed DEF there (the Doom Track's tiers) stays an entity | An attack named `^"Longbow"` is a stat line, not the weapon of that name; hashing 325 such rows as entities would have answered the corpus TODO's open stat-block anchoring question the wrong way. 3,360 → 3,035 entities; the gate unchanged at 0/0/0. |
| 7 | 47 private-use glyphs in H&F adversaries mapped to digits in the corpus (U+E541–E548 → 1–8, U+E53F → 0) | The stat font's figures; *Relentless (3)* was printing as a box. U+E53F was the one the conversion notes left unread: *Ghastly Legion* prints **Horde (10/HP)** (p.94, read off the page — the text layer carries the same glyph). |
| 8 | New hashes take the corpus's majority form, `#t` + 23 alphanumerics | 1,306 of its 1,427 hashed DEFs are of that form. |
| 9 | **The parser binds a string to the string before it only on the same line** — `"Critical Success" "You get what…"` is one keyed row (`{s, args}`) | OUTCOMES and the ROLL_TABLE parsed as 10 loose strings for 5 rows: lossless, so the string gate passed, and the pairing was lost. 13 lines in the corpus have the form; none has three strings. Found by `check_shape`. |
| 10 | `check_shape` counts every type generically — the typed entities in the data against `^"X" DEF { … EXTENDS ^"T"` (and `ACTOR "X"`) in the raw text — rather than a hand list of types | 46 types, none named in the check; a type the corpus adds is checked without an edit here. |
| 11 | The records carry Tier, Role, Category, Type, Kind, Domain Level, Recall Cost, Trait, Range, Damage, Damage Type, Burden, Difficulty, Complexity Rating, Roll, Spellcast Trait, and the NAME a Domain or Class reference prints (`REF_NAME_FIELDS`) | Every list (cards by domain and level, adversaries by tier and role, weapons) reads records alone; no book loads until one is opened. |
| 12 | The dice are the book's sentences as named constants in `system/daggerheart/dice.js` (Hope/Fear by the higher die, matching dice critical and counting as Hope, success on meeting the Difficulty, a d6 per net advantage, an Experience for a Hope, the GM's extra d20); the outcomes' words are the corpus's OUTCOMES | The corpus types the roll only as a rule line; the reading is prose. |
| 13 | A stat block (Adversary, Environment) is laid out as the book lays one out; a FEATURES block as *Name - Type:* text; everything else renders generically | The two shapes a GM reads most; nothing else names a type. |
| 14 | The look is Daggerheart's own (`assets/css/daggerheart.css`, Marcellus / Alegreya, parchment and ink, gold for Hope, violet for Fear, light and dark); nothing from a sibling's css | The ground rule. |
| 15 | **The module in play is a campaign frame; its scenes are the GM's own arc** (the Scenes pane, `setArc`), and a scene's cast is the GM's (`setSceneCast`) | A frame prints no scene list — its "inciting incident" launches the campaign and the rest is the GM's. The engine's scene ids are the arc's ids. |
| 16 | **Fear is shared** (`fear`, op `setFear` for the GM; `addFear(1, memberId)` a player's own roll may send), capped at 12 | "you should keep this pool visible to players during the game" and "You can hold up to a maximum of 12 Fear" (gm-guidance.lore); "The GM gains a Fear" is the with-Fear outcome's own sentence. |
| 17 | An adversary's marked HP and Stress (`npcState`) are the GM's alone; its conditions (`npcConditions`) are shared | Its HP is the GM's to know; a condition on it is the table's. |
| 18 | Countdowns are the engine's clocks, counted down (segments − filled); the book's four countdown types are shown beside them as reference | No new state; the engine already shares, hides and syncs clocks. |
| 19 | The party starts from the book's **Character Guides** (the appendix's suggested build per class: traits, weapons, armor) — the corpus prints no pregenerated characters; a character file is the other way in | The one ready-made starting point the books print. The creator (M4) is the full way. |
| 20 | The encounter builder is **Battle Points**: the formula is a named constant citing its sentence; each role's cost and the six adjustments are the corpus's `^"Adversary Type"` and `^"Battle Point Adjustment"` entities; Minions count by groups the size of the party ("each group of Minions equal to the size of the party") | Typed in the corpus; nothing hand-listed. |
| 21 | Massive damage (4 HP at double Severe) is **off**: the book prints it as an *optional rule*; an instance turns it on with a `MODIFY` that introduces `^"Massive Damage"` on `^"Damage Thresholds"` | The book's own framing; L5R5e decision I-14's mechanism. |
| 22 | The Inspector redraws for a change to what it shows, never for a log line; a character's last roll stays shown under their roller | A roll logged then wiped from the screen is a roll the GM did not see. |
| 23 | **The creator is the book's chapter**: each step shows its own "STEP n:" section, verbatim, from the walkthrough's two lore files (Step 1 closes the introduction, p.14); the controls are the corpus's sets; the numbers are named constants citing their sentences (+2, +1, +1, 0, 0, −1; one two-handed or one-handed + one-handed; Tier 1; two Experiences at +2; two level-1 cards from the class's domains) | PLAYBOOK §2's creator: "a character creator is the book's own chapter walked step by step". |
| 24 | Starting items are read from Step 5's own bullet list (the torch, the rope, the supplies; the gold goes in the Gold field; the potion and the class's "and either" are choices) | Nothing typed. |
| 25 | **Rests read each downtime move's own text**: "clear a number of X equal to 1d4 + your tier" is rolled; "clear all X" clears; "gain a Hope" (2 when preparing with the party); anything else is logged as taken. Two moves, the same one twice allowed; the tier from the corpus's Tier Of Play level ranges | "choose two of the following moves (or choose the same move twice)" (Downtime). |
| 26 | **The player's copy of the sheet is in three panes — Play, Roll, Gear — behind a bar at the bottom at ≤ 640 px**; the pane is kept across redraws; wider screens show every part; the GM's copy is unchanged | L5R5e I11–I12, built in from the start (the PLAN's opening section). |
| 27 | **A refused op is answered with the room's snapshot** as well as the error (`worker/src/index.ts`) | `state.js` applies an op before the room answers; without it a player's page could keep a change the room refused. Generic Worker code — the siblings share the flaw. |
| 28 | A second origin for player tests is a second **port** on localhost, served by the same process (`vtt-daggerheart-two-origins`) | The preview pane refuses 127.0.0.1 and *.localhost, and allows five servers per folder; one process on two ports costs one. |
