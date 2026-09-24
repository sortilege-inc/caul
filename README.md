# sortilege-vtt-daggerheart

A virtual tabletop for **Daggerheart**, generated from the Titterpig corpus
`titterpig-dsl-daggerheart/0.5` (the Core Rulebook and *Hope & Fear*): the books to read,
the Duality Dice, character creation, the GM's table over the campaign frames, and live
sessions for players on their own devices.

- `/` — the site. Writes nothing.
- `/gm/` — the GM's table: panels over the campaign, the map table (`gm/vtt.html`), the
  player's page (`gm/play.html`).

No build step for the pages; `data/` is generated:

```bash
bash build/build.sh
```

It parses every corpus file, writes `data/`, and gates the result both ways (every string the
corpus prints reaches the data as often as it is printed, and nothing in the data is not in the
corpus).

A campaign can run as an **instance** of this VTT — a fork that owns a `campaign/` folder and
never edits upstream (`~/Sortilege/VTT/INSTANCES.md`). Its homebrew builds as one more book:

```bash
bash build/build_layer.sh campaign/dsl campaign "<its title>" campaign/data
```

Local: the launch entries `vtt-daggerheart` (8742) and `vtt-daggerheart-worker` (8796). See
`PLAN.md` for the milestones, the decisions and the proof of each.
