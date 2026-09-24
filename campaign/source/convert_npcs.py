#!/usr/bin/env python3
"""
convert_npcs.py — the campaign's character-typed NPCs (allies, rivals, the Speaker GM PC) from
their Foundry records into the DSL layer as instances of the corpus ACTOR "Character", reusing the
proven PC conversion (convert_pcs.props). Roster-driven (category character-npc), reading the
2026-09-24 snapshot by Foundry id. Pronouns are omitted (the records state none; the owner can add
them). Writes campaign/dsl/caul-npcs.actor. check_npcs.py reads the built layer back.
"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HERE, "campaign/source")
sys.path.insert(0, SRC)
import convert_pcs as C

SNAP = os.path.expanduser(
    "~/Sortilege/Campaigns/2025-2026 Caul/caul-support/archive/foundry-export/2026-09-24/actors")


def npc_id(name, seq):
    stub = "caulNPC" + "".join(ch for ch in name if ch.isalnum())
    return (stub + "0" * 40)[:24] + str(seq % 10)


def by_foundry_id():
    return {os.path.basename(f).rsplit("-", 1)[1][:-5]: f for f in glob.glob(os.path.join(SNAP, "*.json"))}


def main():
    roster = json.load(open(os.path.join(SRC, "foundry-roster.json")))
    byid = by_foundry_id()
    blocks, notes, seq = [], [], 0
    for fid, e in roster.items():
        if e.get("category") != "character-npc" or fid not in byid:
            continue
        actor = json.load(open(byid[fid]))
        actor = actor.get("data", actor)
        seq += 1
        C.unresolved, C.inventory_extra = [], []
        try:
            body = "\n".join("            " + p for p in C.props(actor, None))  # pronouns omitted
        except Exception as ex:
            notes.append("SKIPPED %s (%s): %s" % (e["name"], fid, ex))
            continue
        cid = npc_id(e["name"], seq)
        blocks.append('    #%s ^%s DEF {\n        EXTENDS %s\n        PROPERTIES {\n%s\n        }\n    }'
                      % (cid, C.q(e["name"]), C.CHARACTER, body))
        if C.unresolved:
            notes.append("%s — carried as inventory/notes (no corpus hash): %s" % (e["name"], C.unresolved))
    text = ('EXTENSION "Caul_NPCs" EXTENDS "Daggerheart_Core_Base" {\n'
            '    NAME "Caul - the character-typed NPCs"\n'
            '    VERSION "0.1.0"\n    SPEC_VERSION "0.5"\n    RELEASE_DATE "2026-09-24"\n\n'
            + "\n\n".join(blocks) + "\n}\n")
    open(os.path.join(HERE, "campaign/dsl/caul-npcs.actor"), "w").write(text)
    print("wrote campaign/dsl/caul-npcs.actor:", len(blocks), "NPC(s)")
    for n in notes:
        print("  -", n)


if __name__ == "__main__":
    main()
