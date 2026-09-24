# caul — The Enduring Lesser Lights

An **instance** of the Daggerheart VTT (`sortilege-vtt-daggerheart`): the campaign
**The Enduring Lesser Lights** (Age of Umbra: Caul), live at **caul.sortilege.online**.

The VTT owns the root — the site at `/`, the GM's table at `/gm/`, the engine, the system
module, the generated books. This campaign owns `campaign/` and a short list of per-deployment
root files (`engine/config.js`, `worker/wrangler.jsonc`, `README.md`, `CNAME`, `.gitignore`,
`.claude/launch.json`, `.gitattributes` — all `merge=ours`).

- Upstream is the VTT: `git fetch upstream && git merge upstream/main` (never rebase). Run
  `git config merge.ours.driver true` once per clone or `merge=ours` does nothing.
- `campaign/PLAN.md` holds this instance's plan and decision log.

The Age of Umbra campaign frame (`#t5KkPQAKPBQWhS6w3ZFiQh2x`) is in effect.
