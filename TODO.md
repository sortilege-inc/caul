# TODO — sortilege-vtt-daggerheart

Open work, newest first. `PLAN.md` holds what landed and why; this file holds what is known and
not yet done.

## Deploy — the owner's step (D4, private)

`cd worker && npx wrangler deploy`; set `worker.deployed` (engine/config.js) and `ALLOWED_ORIGIN`
(worker/wrangler.jsonc); make the repo public and turn on Pages only if D4 changes.

## The sheet — what the book prints that the sheet does not yet do

- **Leveling up**: the character guide's tier lists (two options per level, the level-5 and -8
  marks cleared, the new domain card, thresholds by level). `Marked Traits` is in the ACTOR for it.
- **The vault**: swapping loadout and vault cards (at a rest; or at once for the card's Recall
  Cost in Stress), and the five-card loadout limit.
- **Class resources** the features name: the Guardian's Unstoppable Die, the Bard's Rally Die, the
  Druid's Beastform (24 forms in the corpus), the Ranger's companion (its level-up options are
  typed), the Seraph's Prayer Dice… each is printed as a feature's text; the sheet shows the text.
- **Death moves** when the last Hit Point is marked (the three are typed `^"Death Move"`).
- **Frame mechanics** that add to the sheet (Colossus of the Drylands' mounts, Motherboard's
  scrap and quantum, Age of Umbra's Lurking Darkness roll — now a `ROLL_TABLE`).
- **Mixed ancestry** (Step 2 of the Ancestries chapter's own procedure).
- **Multiclassing**.

## The table

- The frames' `CAMPAIGN_MECHANICS` as table tools where they are rolls or tracks (the Lurking
  Darkness d12, the Doom Track of *Hope & Fear*'s appendix).
- An adversary's features that name countdowns (*Countdown (6)*, *Long-Term Countdown*) could start
  one from the Inspector.
