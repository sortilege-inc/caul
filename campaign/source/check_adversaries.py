#!/usr/bin/env python3
"""
check_adversaries.py — read the built layer back and prove each adversary matches its Foundry
record: the stat-block numbers, the attack, the experiences, and every feature (name/type/text).

    python3 campaign/source/check_adversaries.py            # all built adversaries
    python3 campaign/source/check_adversaries.py --plant     # perturb one field; MUST report it
"""
import glob, json, os, subprocess, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HERE, "campaign/source")
sys.path.insert(0, SRC)
from adversary_extract import actor_to_adversary

PLANT = "--plant" in sys.argv
SNAP = os.path.expanduser(
    "~/Sortilege/Campaigns/2025-2026 Caul/caul-support/archive/foundry-export/2026-09-24/actors")
CATS = {"adversary-named", "adversary-generic"}

# dump every adversary in caul-adversaries.actor, keyed by name, with props + ATTACK/EXPERIENCES
# blocks + feature children flattened.
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
  if(!(e.type==="Adversary" && e.file==="caul-adversaries.actor")) continue;
  const o=flat(e.props);
  (e.blocks||[]).forEach(b=>{
    if(b.kw==="ATTACK"){const f=(b.body||[])[0]||{}; o.__attack={name:f.name}; (f.fields||[]).forEach(x=>o.__attack[x.name]=x.value);}
    if(b.kw==="EXPERIENCES"){o.__exp={}; (b.body||[]).forEach(x=>o.__exp[x.name]=x.value);}
  });
  o.__features=(e.children||[]).map(cid=>{const c=d.entities[cid]; return Object.assign({name:c.name}, flat(c.props));});
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
    fails = checked = 0
    for fid, e in roster.items():
        if e.get("category") not in CATS or fid not in byid:
            continue
        ad = actor_to_adversary(json.load(open(byid[fid])).get("data") or json.load(open(byid[fid])))
        got = b.get(ad["name"])
        if got is None:
            continue  # not in the current build (pilot subset)
        checked += 1
        exp = {
            "Tier": ad["tier"], "Role": ad["role"], "Difficulty": ad["difficulty"] + (99 if PLANT else 0),
            "Hit Points": ad["hitPoints"], "Stress": ad["stress"], "Attack Modifier": ad["attackModifier"],
        }
        if ad["description"]:
            exp["Description"] = ad["description"]
        checks = {k: (got.get(k), v) for k, v in exp.items()}
        checks["Motives"] = (got.get("Motives & Tactics") or [], ad["motives"])
        if ad["thresholds"]:
            dt = got.get("Damage Thresholds") or {}
            checks["Thresholds"] = ((dt.get("Major"), dt.get("Severe")), (ad["thresholds"]["major"], ad["thresholds"]["severe"]))
        if ad["attack"]:
            ga = got.get("__attack") or {}
            checks["Attack"] = ((ga.get("name"), ga.get("Range"), ga.get("Damage")),
                                (ad["attack"]["name"], ad["attack"]["range"], ad["attack"]["damage"]))
        checks["Experiences"] = (got.get("__exp") or {}, {x["name"]: x["modifier"] for x in ad["experiences"]})
        checks["Features"] = (
            sorted((f.get("name"), f.get("Type"), f.get("Description")) for f in (got.get("__features") or [])),
            sorted((f["name"], f["type"], f["description"] or None) for f in ad["features"]),
        )
        for field, (have, want) in checks.items():
            if have != want:
                print("  MISMATCH %s.%s: built=%r record=%r" % (ad["name"], field, have, want)); fails += 1
    print("%d adversary(ies) checked, %d field mismatch(es)" % (checked, fails))
    if PLANT:
        if fails:
            print("PLANT: check correctly reported mismatches — the check works."); return
        sys.exit("PLANT: the planted difference was NOT caught — the check is vacuous.")
    if fails:
        sys.exit("%d field mismatch(es)." % fails)
    print("check_adversaries: OK — every checked field matches the Foundry record.")


if __name__ == "__main__":
    main()
