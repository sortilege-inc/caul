#!/usr/bin/env python3
"""
convert_adversaries.py — the campaign's adversary stat blocks, from their Foundry `adversary`
records into the DSL layer as instances of the corpus ACTOR "Adversary". Named adversaries are
single unique instances; generics may be duplicated/renamed at the table (a table rule).

    python3 campaign/source/convert_adversaries.py            # all in the roster
    python3 campaign/source/convert_adversaries.py --pilot ID  # just one (by Foundry id)

Driven by campaign/source/foundry-roster.json (category adversary-named / adversary-generic).
Reads the snapshot record for each, extracts with adversary_extract, and writes
campaign/dsl/caul-adversaries.actor. check_adversaries.py reads the built layer back.
"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HERE, "campaign/source")
sys.path.insert(0, SRC)
from adversary_extract import actor_to_adversary

SNAP = os.path.expanduser(
    "~/Sortilege/Campaigns/2025-2026 Caul/caul-support/archive/foundry-export/2026-09-24/actors")
ADVERSARY = '#daggerheartAdversary000000001 ^"Adversary"'
ADV_FEATURE = '#daggerheartAdvFeature00000001 ^"Adversary Feature"'

# adversary categories to build (named = unique; generic = duplicable). The 20 generic-instances
# reuse a generic's block at the table, so they are not separate statblocks here.
CATS = {"adversary-named", "adversary-generic"}


def q(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip() + '"'


def adv_id(name, seq):
    stub = "caulADV" + "".join(c for c in name if c.isalnum())
    return (stub + "0" * 40)[:24] + str(seq % 10)


def by_foundry_id():
    m = {}
    for f in glob.glob(os.path.join(SNAP, "*.json")):
        m[os.path.basename(f).rsplit("-", 1)[1][:-5]] = f
    return m


def block(cid, ad):
    P = []
    P.append('^"Tier" INTEGER %d' % ad["tier"])
    P.append('^"Role" STRING %s' % q(ad["role"]))
    if ad["description"]:
        P.append('^"Description" STRING %s' % q(ad["description"]))
    if ad["motives"]:
        P.append('^"Motives & Tactics" LIST [ %s ]' % ", ".join(q(m) for m in ad["motives"]))
    P.append('^"Difficulty" INTEGER %d' % ad["difficulty"])
    if ad["thresholds"]:
        P.append('^"Damage Thresholds" DEF { ^"Major" INTEGER %d ^"Severe" INTEGER %d }'
                 % (ad["thresholds"]["major"] or 0, ad["thresholds"]["severe"] or 0))
    if ad["hitPoints"] is not None:
        P.append('^"Hit Points" INTEGER %d' % ad["hitPoints"])
    if ad["stress"] is not None:
        P.append('^"Stress" INTEGER %d' % ad["stress"])
    if ad["attackModifier"] is not None:
        P.append('^"Attack Modifier" INTEGER %d' % ad["attackModifier"])
    props = "\n".join("            " + p for p in P)

    subs = []
    a = ad["attack"]
    if a:
        subs.append('    ATTACK {\n        ^%s DEF { ^"Range" STRING %s ^"Damage" STRING %s }\n    }'
                    % (q(a["name"]), q(a["range"]), q(a["damage"])))
    if ad["experiences"]:
        exps = "\n".join('        ^%s INTEGER %d' % (q(e["name"]), e["modifier"]) for e in ad["experiences"])
        subs.append('    EXPERIENCES {\n%s\n    }' % exps)
    if ad["features"]:
        fb = []
        for f in ad["features"]:
            inner = ['            EXTENDS %s' % ADV_FEATURE]
            if f["type"]:
                inner.append('            ^"Type" STRING %s' % q(f["type"]))
            if f["description"]:
                inner.append('            ^"Description" STRING %s' % q(f["description"]))
            fb.append('        #%s ^%s DEF {\n%s\n        }' % (f["id"], q(f["name"]), "\n".join(inner)))
        subs.append('    FEATURES {\n%s\n    }' % "\n".join(fb))

    body = '        PROPERTIES {\n%s\n        }' % props
    if subs:
        body += "\n" + "\n".join(("    " + ln if ln else ln) for s in subs for ln in [s])
    return '    #%s ^%s DEF {\n        EXTENDS %s\n%s\n    }' % (cid, q(ad["name"]), ADVERSARY, body)


def main():
    pilot = None
    if "--pilot" in sys.argv:
        pilot = sys.argv[sys.argv.index("--pilot") + 1]
    roster = json.load(open(os.path.join(SRC, "foundry-roster.json")))
    byid = by_foundry_id()
    blocks, anomalies, seq = [], [], 0
    for fid, e in roster.items():
        if e.get("category") not in CATS:
            continue
        if pilot and fid != pilot:
            continue
        f = byid.get(fid)
        if not f:
            anomalies.append("no snapshot record for %s (%s)" % (e.get("name"), fid))
            continue
        actor = json.load(open(f))
        actor = actor.get("data", actor)
        ad = actor_to_adversary(actor)
        seq += 1
        blocks.append(block(adv_id(ad["name"], seq), ad))
        anomalies += ad["anomalies"]
    text = ('EXTENSION "Caul_Adversaries" EXTENDS "Daggerheart_Core_Base" {\n'
            '    NAME "The Enduring Lesser Lights - the bestiary"\n'
            '    VERSION "0.1.0"\n    SPEC_VERSION "0.5"\n    RELEASE_DATE "2026-09-24"\n\n'
            + "\n\n".join(blocks) + "\n}\n")
    out = os.path.join(HERE, "campaign/dsl/caul-adversaries.actor")
    open(out, "w").write(text)
    print("wrote campaign/dsl/caul-adversaries.actor:", len(blocks), "adversary(ies)")
    if anomalies:
        print("\nrecord anomalies (owner to fix at the Foundry source, then re-pull):")
        for a in anomalies:
            print("  -", a)


if __name__ == "__main__":
    main()
