#!/usr/bin/env python3
"""
check_npcs.py — read the built layer back and prove each character-NPC matches its Foundry record,
field by field, reusing the PC checker's expected-value extractor and comparison rules.

    python3 campaign/source/check_npcs.py           # non-zero on any mismatch
    python3 campaign/source/check_npcs.py --plant    # perturb one field; MUST report it
"""
import glob, json, os, subprocess, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HERE, "campaign/source")
sys.path.insert(0, SRC)
from check_pcs import expected_from_actor, REF_NAME_FIELDS, _norm

PLANT = "--plant" in sys.argv
SNAP = os.path.expanduser(
    "~/Sortilege/Campaigns/2025-2026 Caul/caul-support/archive/foundry-export/2026-09-24/actors")

DUMP_JS = r'''
const fs=require("fs");
const txt=fs.readFileSync("campaign/data/campaign.js","utf8");
const d=JSON.parse(txt.match(/var d=(\{[\s\S]*\});var T=window\.DAGGERHEART/)[1]);
function f2o(a){const o={};(a||[]).forEach(x=>o[x.name]=(x.value!==undefined?x.value:x));return o;}
function flat(props){const o={};(props||[]).forEach(p=>{
  if(p.ref){o[p.name]=p.ref.name;}
  else if(p.vk==="list"){o[p.name]=(p.items||[]).map(it=> it.s!==undefined?it.s:(it.c!==undefined?it.c:(it.d?f2o(it.d):(it.value!==undefined?it.value:it))) );}
  else if(p.fields){o[p.name]=f2o(p.fields);}
  else {o[p.name]=p.value;}
});return o;}
const out={};
for(const [id,e] of Object.entries(d.entities)){
  if(e.type==="Character" && e.file==="caul-npcs.actor") out[e.name]=flat(e.props);
}
console.log(JSON.stringify(out));
'''


def built():
    r = subprocess.run(["node", "-e", DUMP_JS], cwd=HERE, capture_output=True, text=True)
    if r.returncode:
        sys.exit("node dump failed:\n" + r.stderr)
    return json.loads(r.stdout)


def by_foundry_id():
    return {os.path.basename(f).rsplit("-", 1)[1][:-5]: f for f in glob.glob(os.path.join(SNAP, "*.json"))}


def main():
    b = built()
    roster = json.load(open(os.path.join(SRC, "foundry-roster.json")))
    byid = by_foundry_id()
    fails = checked = 0
    for fid, e in roster.items():
        if e.get("category") != "character-npc" or fid not in byid:
            continue
        got = b.get(e["name"])
        if got is None:
            continue  # skipped in convert (e.g. an extractor error) — reported there
        actor = json.load(open(byid[fid]))
        exp = expected_from_actor(actor.get("data", actor))
        if PLANT and "Evasion" in exp:
            exp = dict(exp); exp["Evasion"] = exp["Evasion"] + 99
        # derived comparisons expressed differently in the built props
        got_cmp = dict(got)
        got_cmp["_loadout_plus_vault"] = len((got.get("Loadout") or []) + (got.get("Vault") or []))
        got_cmp["_experiences"] = sorted(
            x for x in ((y.get("Name") if isinstance(y, dict) else y) for y in (got.get("Experiences") or [])) if x)
        checked += 1
        for k, want in exp.items():
            have = got_cmp.get(k)
            match = (_norm(have) == _norm(want)) if k in REF_NAME_FIELDS else (have == want)
            if not match:
                print("  MISMATCH %s.%s: built=%r record=%r" % (e["name"], k, have, want)); fails += 1
    print("%d NPC(s) checked, %d field mismatch(es)" % (checked, fails))
    if PLANT:
        if fails:
            print("PLANT: check correctly reported mismatches — the check works."); return
        sys.exit("PLANT: the planted difference was NOT caught — the check is vacuous.")
    if fails:
        sys.exit("%d field mismatch(es)." % fails)
    print("check_npcs: OK — every checked field matches the Foundry record.")


if __name__ == "__main__":
    main()
