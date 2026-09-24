#!/usr/bin/env python3
"""
check_companions.py — read the built layer back and prove each companion matches its Foundry
record, field by field (the numbers, the attack, the experiences, the chosen upgrades).

    python3 campaign/source/check_companions.py           # non-zero on any mismatch
    python3 campaign/source/check_companions.py --plant    # perturb one field; MUST report it
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HERE, "campaign/source")
sys.path.insert(0, SRC)
from companion_extract import actor_to_companion
from convert_companions import COMPANIONS

PLANT = "--plant" in sys.argv

DUMP_JS = r'''
const fs=require("fs");
const txt=fs.readFileSync("campaign/data/campaign.js","utf8");
const d=JSON.parse(txt.match(/var d=(\{[\s\S]*\});var T=window\.DAGGERHEART/)[1]);
const out={};
function f2o(a){const o={};(a||[]).forEach(x=>o[x.name]=(x.value!==undefined?x.value:x));return o;}
function flat(props){const o={};(props||[]).forEach(p=>{
  if(p.ref){o[p.name]=p.ref.name;}
  else if(p.vk==="list"){o[p.name]=(p.items||[]).map(it=>
      it.c!==undefined ? it.c : (it.d ? f2o(it.d) : (it.value!==undefined?it.value:it)) ); }
  else if(p.fields){o[p.name]=f2o(p.fields);}
  else {o[p.name]=p.value;}
});return o;}
process.argv.slice(1).forEach(id=>{const e=d.entities[id]; out[id]=e?flat(e.props):null;});
console.log(JSON.stringify(out));
'''


def built(ids):
    r = subprocess.run(["node", "-e", DUMP_JS, "--"] + ids, cwd=HERE, capture_output=True, text=True)
    if r.returncode:
        sys.exit("node dump failed:\n" + r.stderr)
    return json.loads(r.stdout)


def main():
    ids = ["#" + cid for _n, cid, _f, _p in COMPANIONS]
    b = built(ids)
    fails = 0
    for name, cid, fn, partner in COMPANIONS:
        actor = json.load(open(os.path.join(SRC, "foundry", fn + ".json")))
        c = actor_to_companion(actor.get("data", actor), partner=partner)
        got = b.get("#" + cid) or {}
        checks = {
            "Partner": (got.get("Partner"), c["partner"]),
            "Evasion": (got.get("Evasion"), c["evasion"] + (99 if PLANT else 0)),
            "Stress": (got.get("Stress"), c["stressMax"]),
            "Marked Stress": (got.get("Marked Stress"), c["stressMarked"]),
            "Attack.Name": ((got.get("Attack") or {}).get("Name"), c["attack"]["name"]),
            "Attack.Range": ((got.get("Attack") or {}).get("Range"), c["attack"]["range"]),
            "Attack.Damage": ((got.get("Attack") or {}).get("Damage"), c["attack"]["damage"]),
            "_experiences": (
                sorted((e.get("Name"), e.get("Modifier")) for e in (got.get("Experiences") or [])),
                sorted((e["name"], e["modifier"]) for e in c["experiences"]),
            ),
            "_upgrades": (sorted(got.get("Upgrades") or []), sorted(c["upgrades"])),
        }
        n = 0
        for field, (have, want) in checks.items():
            n += 1
            if have != want:
                print("  MISMATCH %s.%s: built=%r  record=%r" % (name, field, have, want)); fails += 1
        print("  %s: %d field(s) checked" % (name, n))
    if PLANT:
        if fails:
            print("PLANT: check correctly reported %d mismatch(es) — the check works." % fails); return
        sys.exit("PLANT: the planted difference was NOT caught — the check is vacuous.")
    if fails:
        sys.exit("%d field mismatch(es)." % fails)
    print("check_companions: OK — every checked field matches the Foundry record.")


if __name__ == "__main__":
    main()
