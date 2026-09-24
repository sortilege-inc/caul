#!/usr/bin/env python3
"""
check_environments.py — read the built layer back and prove each environment matches its Foundry
record: Tier / Description / Difficulty, the potential-adversary groups, and every feature.

    python3 campaign/source/check_environments.py           # non-zero on any mismatch
    python3 campaign/source/check_environments.py --plant    # perturb one field; MUST report it
"""
import glob, json, os, subprocess, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HERE, "campaign/source")
sys.path.insert(0, SRC)
from env_extract import actor_to_environment

PLANT = "--plant" in sys.argv
SNAP = os.path.expanduser(
    "~/Sortilege/Campaigns/2025-2026 Caul/caul-support/archive/foundry-export/2026-09-24/actors")

DUMP_JS = r'''
const fs=require("fs");
const txt=fs.readFileSync("campaign/data/campaign.js","utf8");
const d=JSON.parse(txt.match(/var d=(\{[\s\S]*\});var T=window\.DAGGERHEART/)[1]);
function f2o(a){const o={};(a||[]).forEach(x=>o[x.name]=(x.value!==undefined?x.value:x));return o;}
function listvals(items){return (items||[]).map(it=> it.s!==undefined?it.s:(it.c!==undefined?it.c:(it.value!==undefined?it.value:it)));}
function flat(props){const o={};(props||[]).forEach(p=>{
  if(p.ref){o[p.name]=p.ref.name;}
  else if(p.vk==="list"){o[p.name]=listvals(p.items);}
  else if(p.fields){o[p.name]=f2o(p.fields);}
  else {o[p.name]=p.value;}
});return o;}
const out={};
for(const [id,e] of Object.entries(d.entities)){
  if(!(e.type==="Environment" && e.file==="caul-environments.actor")) continue;
  const o=flat(e.props);
  o.__groups={};
  (e.blocks||[]).forEach(b=>{ if(b.kw==="POTENTIAL_ADVERSARIES"){ (b.body||[]).forEach(x=>{ o.__groups[x.name]=listvals(x.items); }); } });
  o.__features=(e.children||[]).map(cid=>{const c=d.entities[cid]; const f=flat(c.props); return {name:c.name, Type:f.Type||null, Description:f.Description||null, Options:f.Options||[]};});
  out[e.name]=o;
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
    cache = json.load(open(os.path.join(SRC, "env-adversary-names.json")))
    fails = checked = 0
    for fid, r in roster.items():
        if r.get("category") != "environment" or fid not in byid:
            continue
        e = actor_to_environment(json.load(open(byid[fid])).get("data") or json.load(open(byid[fid])), cache)
        got = b.get(e["name"])
        if got is None:
            continue
        checked += 1
        checks = {
            "Tier": (got.get("Tier"), e["tier"] + (99 if PLANT else 0)),
            "Difficulty": (got.get("Difficulty"), e["difficulty"]),
            "Groups": (got.get("__groups") or {}, {g["label"]: g["names"] for g in e["groups"]}),
            "Features": (
                sorted((f["name"], f["Type"], f["Description"], tuple(f["Options"])) for f in (got.get("__features") or [])),
                sorted((f["name"], f["type"], f["description"] or None, tuple(f["options"])) for f in e["features"]),
            ),
        }
        if e["description"]:
            checks["Description"] = (got.get("Description"), e["description"])
        for field, (have, want) in checks.items():
            if have != want:
                print("  MISMATCH %s.%s: built=%r record=%r" % (e["name"], field, have, want)); fails += 1
    print("%d environment(s) checked, %d field mismatch(es)" % (checked, fails))
    if PLANT:
        if fails:
            print("PLANT: check correctly reported mismatches — the check works."); return
        sys.exit("PLANT: the planted difference was NOT caught — the check is vacuous.")
    if fails:
        sys.exit("%d field mismatch(es)." % fails)
    print("check_environments: OK — every checked field matches the Foundry record.")


if __name__ == "__main__":
    main()
