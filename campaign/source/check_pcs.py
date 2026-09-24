#!/usr/bin/env python3
"""
check_pcs.py — read the built layer back and prove each PC matches its Foundry record, field by
field. The layer build (build/build_layer.sh) already proves every string round-trips; this proves
the numbers and references too, against the source of truth.

    python3 campaign/source/check_pcs.py           # all PCs; non-zero on any mismatch
    python3 campaign/source/check_pcs.py --plant    # perturb one field; MUST report a mismatch

The built entity's props come from campaign/data/campaign.js (node dumps them); the expected values
from the same extractor the converter used (caul-support foundry_sheet.py). Reference props are
checked by the referenced entity's name.
"""
import json, os, re, subprocess, sys

# reference-name fields carry the corpus's canonical spelling in the built layer but Foundry's
# spelling in the record; compare them normalized (letters+digits, lowercased). Everything else
# (numbers, verbatim experience names) is compared exactly.
REF_NAME_FIELDS = {"Class", "Subclass", "Second Class", "Second Subclass", "Ancestry", "Community"}
def _norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.expanduser("~/Sortilege/Campaigns/2025-2026 Caul/caul-support/scripts"))
import foundry_sheet

PLANT = "--plant" in sys.argv
PCS = [
    ("draz",   "#caulPCDraz000000000000001", "Draz"),
    ("heyou",  "#caulPCHeyou00000000000001", "Heyou"),
    ("jamal",  "#caulPCJamal00000000000001", "Jamal Jenkins"),
    ("sylvie", "#caulPCSylvie0000000000001", "Sylvie Cerridwen"),
]

DUMP_JS = r'''
const fs=require("fs");
const txt=fs.readFileSync("campaign/data/campaign.js","utf8");
const d=JSON.parse(txt.match(/var d=(\{[\s\S]*\});var T=window\.DAGGERHEART/)[1]);
const out={};
function f2o(a){const o={};(a||[]).forEach(x=>o[x.name]=(x.value!==undefined?x.value:x));return o;}
function flat(props){const o={};(props||[]).forEach(p=>{
  if(p.ref){o[p.name]=p.ref.name;}                                   // reference: {hash,name}
  else if(p.vk==="list"){o[p.name]=(p.items||[]).map(it=>            // list items:
      it.c!==undefined ? it.c : (it.d ? f2o(it.d) : (it.value!==undefined?it.value:it)) ); }  // {c,h} ref | {d:[..]} DEF | scalar
  else if(p.fields){o[p.name]=f2o(p.fields);}                        // composite DEF
  else {o[p.name]=p.value;}                                          // scalar
});return o;}
process.argv.slice(1).forEach(id=>{const e=d.entities[id]; out[id]=e?flat(e.props):null;});
console.log(JSON.stringify(out));
'''

def built(ids):
    r = subprocess.run(["node", "-e", DUMP_JS, "--"] + ids, cwd=HERE, capture_output=True, text=True)
    if r.returncode: sys.exit("node dump failed:\n" + r.stderr)
    return json.loads(r.stdout)

def expected(pc):
    a = json.load(open(os.path.join(HERE, "campaign/source/foundry", pc + ".json")))
    a = a.get("data", a)
    s = foundry_sheet.actor_to_sheet(a)
    subs = s.get("subclasses") or []
    tr = s["traits"]
    exp = {
        "Level": s["level"],
        "Traits": {k.title(): tr[k] for k in ("agility", "strength", "finesse", "instinct", "presence", "knowledge")},
        "Evasion": s["evasion"], "Hit Points": s["hpMax"], "Marked HP": s["hpMarked"],
        "Stress": s["stressMax"], "Marked Stress": s["stressMarked"], "Hope": s["hope"],
        "Proficiency": s["proficiency"],
        "Damage Thresholds": {"Major": s["thresholds"]["major"], "Severe": s["thresholds"]["severe"]},
        "Class": s.get("className"), "Subclass": subs[0] if subs else None,
        "Second Class": s.get("multiclassName"), "Second Subclass": subs[1] if len(subs) > 1 else None,
        "Ancestry": s.get("ancestry"), "Community": s.get("community"),
        "_loadout_plus_vault": sum(1 for _ in s["cards"]),
        "_experiences": sorted(e["name"] for e in s["experiences"]),
    }
    # drop absent fields: None, and the extractor's empty-string for a non-multiclass PC's
    # "Second Class" (single-class characters have no second class prop in the layer)
    return {k: v for k, v in exp.items() if v is not None and v != ""}

def main():
    b = built([cid for _, cid, _ in PCS])
    fails = 0
    for pc, cid, name in PCS:
        got = b.get(cid) or {}
        exp = expected(pc)
        if PLANT:
            exp["Evasion"] = exp["Evasion"] + 99  # a difference the check MUST catch
        # derived comparisons the built props express differently
        cards = (got.get("Loadout") or []) + (got.get("Vault") or [])
        got_cmp = dict(got)
        got_cmp["_loadout_plus_vault"] = len(cards)
        got_cmp["_experiences"] = sorted(x for x in ((e.get("Name") if isinstance(e, dict) else e) for e in (got.get("Experiences") or [])) if x)
        for k, want in exp.items():
            have = got_cmp.get(k)
            match = (_norm(have) == _norm(want)) if k in REF_NAME_FIELDS else (have == want)
            if not match:
                print("  MISMATCH %s.%s: built=%r  record=%r" % (name, k, have, want)); fails += 1
        print("  %s: %d field(s) checked" % (name, len(exp)))
    if PLANT:
        if fails: print("PLANT: check correctly reported %d mismatch(es) — the check works." % fails); return
        sys.exit("PLANT: the planted difference was NOT caught — the check is vacuous.")
    if fails: sys.exit("%d field mismatch(es)." % fails)
    print("check_pcs: OK — every checked field matches the Foundry record.")

if __name__ == "__main__":
    main()
