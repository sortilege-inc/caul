#!/usr/bin/env python3
"""
convert_environments.py — the campaign's environments from their Foundry `environment` records into
the DSL layer as instances of the corpus ACTOR "Environment". Roster-driven (category environment),
reading the 2026-09-24 snapshot by id and the resolved potential-adversary name cache. Writes
campaign/dsl/caul-environments.actor. check_environments.py reads the built layer back.
"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HERE, "campaign/source")
sys.path.insert(0, SRC)
from env_extract import actor_to_environment

SNAP = os.path.expanduser(
    "~/Sortilege/Campaigns/2025-2026 Caul/caul-support/archive/foundry-export/2026-09-24/actors")
ENVIRONMENT = '#daggerheartEnvironment0000001 ^"Environment"'
ENV_FEATURE = '#daggerheartEnvFeature00000001 ^"Environment Feature"'


def q(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip() + '"'


def env_id(name, seq):
    stub = "caulENV" + "".join(c for c in name if c.isalnum())
    return (stub + "0" * 40)[:24] + str(seq % 10)


def by_foundry_id():
    return {os.path.basename(f).rsplit("-", 1)[1][:-5]: f for f in glob.glob(os.path.join(SNAP, "*.json"))}


def block(cid, e):
    P = ['^"Tier" INTEGER %d' % e["tier"]]
    if e["description"]:
        P.append('^"Description" STRING %s' % q(e["description"]))
    if e["difficulty"] is not None:
        P.append('^"Difficulty" STRING %s' % q(e["difficulty"]))
    props = "\n".join("            " + p for p in P)
    parts = ['        PROPERTIES {\n%s\n        }' % props]
    if e["groups"]:
        gb = "\n".join('        ^%s LIST [ %s ]' % (q(g["label"]), ", ".join(q(n) for n in g["names"]))
                       for g in e["groups"])
        parts.append('    POTENTIAL_ADVERSARIES {\n%s\n    }' % gb)
    if e["features"]:
        fb = []
        for f in e["features"]:
            inner = ['            EXTENDS %s' % ENV_FEATURE]
            if f["type"]:
                inner.append('            ^"Type" STRING %s' % q(f["type"]))
            if f["description"]:
                inner.append('            ^"Description" STRING %s' % q(f["description"]))
            if f["options"]:
                inner.append('            ^"Options" LIST [ %s ]' % ", ".join(q(o) for o in f["options"]))
            fb.append('        #%s ^%s DEF {\n%s\n        }' % (f["id"], q(f["name"]), "\n".join(inner)))
        parts.append('    FEATURES {\n%s\n    }' % "\n".join(fb))
    body = "\n".join(parts)
    return '    #%s ^%s DEF {\n        EXTENDS %s\n%s\n    }' % (cid, q(e["name"]), ENVIRONMENT, body)


def main():
    roster = json.load(open(os.path.join(SRC, "foundry-roster.json")))
    byid = by_foundry_id()
    cache = json.load(open(os.path.join(SRC, "env-adversary-names.json")))
    blocks, seq = [], 0
    for fid, r in roster.items():
        if r.get("category") != "environment" or fid not in byid:
            continue
        actor = json.load(open(byid[fid]))
        e = actor_to_environment(actor.get("data", actor), cache)
        seq += 1
        blocks.append(block(env_id(e["name"], seq), e))
    text = ('EXTENSION "Caul_Environments" EXTENDS "Daggerheart_Core_Base" {\n'
            '    NAME "The Enduring Lesser Lights - the environments"\n'
            '    VERSION "0.1.0"\n    SPEC_VERSION "0.5"\n    RELEASE_DATE "2026-09-24"\n\n'
            + "\n\n".join(blocks) + "\n}\n")
    open(os.path.join(HERE, "campaign/dsl/caul-environments.actor"), "w").write(text)
    print("wrote campaign/dsl/caul-environments.actor:", len(blocks), "environment(s)")


if __name__ == "__main__":
    main()
