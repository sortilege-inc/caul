#!/usr/bin/env python3
"""
convert_companions.py — the campaign's player-bonded companions (Pinchie, the Umbral Raven) from
their Foundry `companion` records into the DSL layer as instances of the corpus ACTOR
"Ranger Companion" (its played-instance fields, added upstream in core-base 0.5.3).

    python3 campaign/source/convert_companions.py

Reads campaign/source/foundry/<name>.json, extracts with companion_extract.actor_to_companion,
resolves each chosen upgrade to its corpus hash, and writes campaign/dsl/caul-companions.actor.
Any record anomaly (a stray die, a blank experience) is printed for the owner, never silently
smoothed. check_companions.py reads the built layer back against the records.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HERE, "campaign/source")
sys.path.insert(0, SRC)
from companion_extract import actor_to_companion

IDX = json.load(open(os.path.join(SRC, "corpus-index.json")))
RANGER_COMPANION = '#daggerheartRangerCompanion01 ^"Ranger Companion"'
T_EXP = '#daggerheartExperience00000001 ^"Experience"'
T_UPGRADE = '#daggerheartCompanionUpgrade1 ^"Companion Upgrade"'

# name, stable caul id, Foundry source file, the bonded character (from the roster manifest;
# None for a companion not bonded to a specific PC)
COMPANIONS = [
    ("Pinchie",                "caulNPCPinchie0000000001", "pinchie",                 "Jamal Jenkins"),
    ("Umbral Raven",           "caulNPCUmbralRaven000001", "umbral-raven",            "Sylvie Cerridwen"),
    ("You Bastard",            "caulNPCYouBastard0000001", "you-bastard",             None),
    ("Bob the Living Fortress","caulNPCBob00000000000001", "bob-the-living-fortress", None),
    ("Yuki",                   "caulNPCYuki0000000000001", "yuki",                    None),
]


def q(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip() + '"'


def upref(name):
    h = IDX.get("Companion Upgrade|" + name)
    if not h:
        raise SystemExit("no corpus hash for Companion Upgrade %r" % name)
    return '%s ^%s' % (h, q(name))


def props(c):
    P = []
    if c.get("partner"):
        P.append('^"Partner" STRING %s' % q(c["partner"]))
    if c.get("evasion") is not None:
        P.append('^"Evasion" INTEGER %d' % c["evasion"])
    if c.get("stressMax") is not None:
        P.append('^"Stress" INTEGER %d' % c["stressMax"])
    P.append('^"Marked Stress" INTEGER %d' % (c.get("stressMarked") or 0))
    a = c["attack"]
    P.append('^"Attack" DEF { ^"Name" STRING %s ^"Range" STRING %s ^"Damage" STRING %s }' % (
        q(a["name"]), q(a["range"]), q(a["damage"])))
    if c["experiences"]:
        exps = ", ".join('DEF { ^"Name" STRING %s ^"Modifier" INTEGER %d }' % (q(e["name"]), e["modifier"])
                         for e in c["experiences"])
        P.append('^"Experiences" LIST OF %s [ %s ]' % (T_EXP, exps))
    if c["upgrades"]:
        ups = ", ".join(upref(u) for u in c["upgrades"])
        P.append('^"Upgrades" LIST OF %s [ %s ]' % (T_UPGRADE, ups))
    return P


def main():
    blocks, all_anom = [], []
    for name, cid, fn, partner in COMPANIONS:
        actor = json.load(open(os.path.join(SRC, "foundry", fn + ".json")))
        actor = actor.get("data", actor)
        c = actor_to_companion(actor, partner=partner)
        all_anom += c["anomalies"]
        body = "\n".join("            " + p for p in props(c))
        blocks.append('    #%s ^%s DEF {\n        EXTENDS %s\n        PROPERTIES {\n%s\n        }\n    }'
                      % (cid, q(name), RANGER_COMPANION, body))
    text = ('EXTENSION "Caul_Companions" EXTENDS "Daggerheart_Core_Base" {\n'
            '    NAME "Caul - the player-bonded companions"\n'
            '    VERSION "0.1.0"\n    SPEC_VERSION "0.5"\n    RELEASE_DATE "2026-09-24"\n\n'
            + "\n\n".join(blocks) + "\n}\n")
    open(os.path.join(HERE, "campaign/dsl/caul-companions.actor"), "w").write(text)
    print("wrote campaign/dsl/caul-companions.actor:", len(blocks), "companion(s)")
    if all_anom:
        print("\nrecord anomalies (owner to fix at the Foundry source, then re-pull):")
        for a in all_anom:
            print("  -", a)


if __name__ == "__main__":
    main()
