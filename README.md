# The Enduring Lesser Lights — an Age of Umbra Chronicle

A static campaign wiki for the Daggerheart / *Age of Umbra* game **The Enduring Lesser
Lights**. Dark, desaturated grimoire aesthetic; no build step —
plain HTML + one stylesheet.

## Structure

| Path | What |
|------|------|
| `index.html` | Landing page — masthead, hero, section cards |
| `chronicle/` | 19 session pages (Summary · Timeline · Moments · Entities), newest-linked prev/next, + index |
| `company/` | The 4 player characters |
| `dramatis-personae/` | 52 NPCs / spirits / gods / monsters |
| `factions/` | 10 factions |
| `atlas/` | **Interactive map** (`atlas/index.html`) — pan/zoom the world map with location pins + gazetteer — plus 41 location detail pages |
| `relics/` | 34 items & artifacts |
| `lore/` | World summary + lore documents |
| `gm/` | **Behind the Veil** — GM-only. *The Truth:* cosmology & secrets, GM-canon dossiers (persons/places/factions/adversaries). *The Table:* prep & planning, open plot threads. *Drafts:* Sylvie, vignette |
| `umbra.css` | The theme |

The interactive atlas overlays waypoint pins on `atlas/umbra-map.jpeg` (copied from
`caul-support/27. The Enduring Lesser Lights/umbra-nowords.jpeg`, inverted + cold-tinted via CSS).
Pins are colour-keyed by `kind` — **seat** (red, Drosven's Gate), **delve** (purple, Grithmaar
Deep), **settlement** (gold), **ruin/lost** (dark ✕). Positions + kinds live in `ATLAS_COORDS` in
the generator (keyed to the labelled reference map); pinned places without a chronicled page yet
(Larrow, Vireth Hollow, Kaelrock, Redmorrow, Mireveil) get flavour from `ATLAS_UNPAGED`. Edit
`[x%, y%]`/`kind` and rebuild to adjust.

Dramatis Personae is split into **The Absent Gods** / **The Living & the Lurking** (the middle,
pending a finer pass) / **The Absent & the Dead** — group membership is in `ABSENT_GODS` /
`ABSENT_DEAD` in the generator. The GM section (`build_gm`) merges two sources: the Notion GM
markdown in `caul-support/notion/` and the Obsidian vault `caul-support/Obsidian - The Enduring
Lesser Lights/` (`02-gm-canon` dossiers → the canon pages; `03-planning` → planning + threads;
`setting-gm-lore.md` → cosmology). Obsidian `[[wikilinks]]` (incl. `[[Target|Display]]`) resolve
to the public entity pages; YAML frontmatter is stripped.

Cross-references (`[[wikilinks]]` in the source) are resolved into internal links;
unresolved ones render as dotted "not-yet-chronicled" spans.

## Regenerating

This site is **generated** from the raw campaign pull in `../caul-support/`:

```bash
python3 ../caul-support/scripts/build_site.py
```

Source of truth: `caul-support/The Enduring Lesser Lights - HTML Export/` (narrative HTML)
plus `caul-support/foundry/` (portraits). Portrait art is hot-linked from
`foundry.sortilege.online` and `assets.myarchivist.ai`. Re-running wipes and rebuilds the
generated category directories only (`umbra.css`, `README.md`, `.git` are preserved).

> **First draft.** Content is passed through largely verbatim from the export; the next
> pass is correcting and completing the actual writing.
