#!/usr/bin/env python3
"""
convert_pcs.py — the campaign's player characters, from their Foundry records into the DSL layer
as instances of the corpus ACTOR "Character".

    python3 campaign/source/convert_pcs.py

Reads campaign/source/foundry/<pc>.json (the raw Foundry /get response, kept byte for byte),
recomputes the sheet values with the campaign's proven extractor (caul-support foundry_sheet.py,
which recomputes evasion / thresholds / HP / proficiency the way Foundry's prepareDerivedData
does), resolves every class / subclass / ancestry / community / domain-card / weapon reference to
its corpus hash via campaign/source/corpus-index.json, and writes campaign/dsl/caul-pcs.actor.
A name with no corpus hash (a homebrew or improved item) is carried in ^"Inventory" as a string,
never invented as a reference. check_pcs.py reads the built layer back against the records.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # the repo root
SRC = os.path.join(HERE, "campaign/source")
# the extractor lives in the (unversioned) support folder beside the campaign
sys.path.insert(0, os.path.expanduser("~/Sortilege/Campaigns/2025-2026 Caul/caul-support/scripts"))
import foundry_sheet

IDX = json.load(open(os.path.join(SRC, "corpus-index.json")))
CHARACTER = '#daggerheartCharacter000000001 ^"Character"'
T_EXP = '#daggerheartExperience00000001 ^"Experience"'
T_CARD = '#daggerheartDomainCard0000001 ^"Domain Card"'
T_WEAPON = '#daggerheartWeapon00000000001 ^"Weapon"'

# the PCs to build, and a stable caul id + pronouns for each
PCS = [
    ("draz", "caulPCDraz000000000000001", "Draz", "he/him"),
]

def q(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip() + '"'

def ref(kind, name):
    """'#hash ^\"Name\"' if the corpus has it, else None."""
    h = IDX.get(kind + "|" + name)
    return ('%s ^%s' % (h, q(name))) if h else None

def load(pc):
    a = json.load(open(os.path.join(SRC, "foundry", pc + ".json")))
    return a.get("data", a)

def props(actor, pronouns):
    s = foundry_sheet.actor_to_sheet(actor)
    sysd = actor["system"]
    tr = s["traits"]
    P = []
    P.append('^"Level" INTEGER %d' % s["level"])
    P.append('^"Traits" DEF { %s }' % " ".join(
        '^"%s" INTEGER %d' % (k.title(), tr[k]) for k in ("agility", "strength", "finesse", "instinct", "presence", "knowledge")))
    # class / subclass, and the multiclass second pair (the extractor names them)
    def add(prop, kind, name):
        r = ref(kind, name)
        if r: P.append('^"%s" %s' % (prop, r))
        elif name: unresolved.append((prop, name))
    add("Class", "Class", s.get("className"))
    subs = s.get("subclasses") or []
    if subs: add("Subclass", "Subclass", subs[0])
    if s.get("multiclassName"): add("Second Class", "Class", s["multiclassName"])
    if len(subs) > 1: add("Second Subclass", "Subclass", subs[1])
    add("Ancestry", "Ancestry", s.get("ancestry"))
    add("Community", "Community", s.get("community"))
    P.append('^"Pronouns" STRING %s' % q(pronouns))
    P.append('^"Evasion" INTEGER %d' % s["evasion"])
    P.append('^"Hit Points" INTEGER %d' % s["hpMax"])
    P.append('^"Marked HP" INTEGER %d' % s["hpMarked"])
    P.append('^"Stress" INTEGER %d' % s["stressMax"])
    P.append('^"Marked Stress" INTEGER %d' % s["stressMarked"])
    P.append('^"Hope" INTEGER %d' % s["hope"])
    P.append('^"Proficiency" INTEGER %d' % s["proficiency"])
    P.append('^"Damage Thresholds" DEF { ^"Major" INTEGER %d ^"Severe" INTEGER %d }' % (s["thresholds"]["major"], s["thresholds"]["severe"]))
    P.append('^"Armor Score" INTEGER %d' % (s.get("armorScore") or 0))
    g = s["gold"]
    P.append('^"Gold" DEF { ^"Handfuls" INTEGER %d ^"Bags" INTEGER %d ^"Chest" INTEGER %d }' % (g.get("handfuls", 0), g.get("bags", 0), g.get("chests", 0)))
    # experiences — inline DEFs on the Experience type
    exps = ", ".join('DEF { ^"Name" STRING %s ^"Modifier" INTEGER %d }' % (q(e["name"]), e["value"]) for e in s["experiences"])
    if exps: P.append('^"Experiences" LIST OF %s [ %s ]' % (T_EXP, exps))
    # domain cards — loadout (in play) vs vault, from the raw items
    loadout, vault = [], []
    for it in actor["items"]:
        if it.get("type") != "domainCard": continue
        r = ref("Domain Card", it["name"])
        if not r:
            unresolved.append(("Domain Card", it["name"])); continue
        (vault if (it.get("system", {}).get("inVault")) else loadout).append(r)
    if loadout: P.append('^"Loadout" LIST OF %s [ %s ]' % (T_CARD, ", ".join(loadout)))
    if vault: P.append('^"Vault" LIST OF %s [ %s ]' % (T_CARD, ", ".join(vault)))
    # weapons — the equipped one primary; the rest to Inventory Weapons if the corpus has them
    inv_weapons, prim = [], None
    for w in s["weapons"]:
        r = ref("Weapon", w["name"])
        if r and w.get("equipped") and prim is None: prim = r
        elif r: inv_weapons.append(r)
        else: inventory_extra.append(w["name"])
    if prim: P.append('^"Primary Weapon" %s' % prim)
    if inv_weapons: P.append('^"Inventory Weapons" LIST OF %s [ %s ]' % (T_WEAPON, ", ".join(inv_weapons)))
    # inventory — loot + consumables + any unresolved gear, as strings
    inv = [i["name"] for i in s.get("inventory", [])] + inventory_extra
    if s.get("armorName"): inv.insert(0, s["armorName"])
    P.append('^"Inventory" LIST OF STRING [ %s ]' % ", ".join(q(x) for x in inv))
    bio = re.sub(r"<[^>]+>", " ", (sysd.get("biography", {}) or {}).get("text", "") or "")
    bio = re.sub(r"\s+", " ", bio).strip()
    if bio: P.append('^"Character Description" STRING %s' % q(bio[:600]))
    return P

unresolved = []
inventory_extra = []
def main():
    blocks = []
    for pc, cid, name, pronouns in PCS:
        global unresolved, inventory_extra
        unresolved, inventory_extra = [], []
        actor = load(pc)
        body = "\n".join("            " + p for p in props(actor, pronouns))
        blocks.append('    #%s ^%s DEF {\n        EXTENDS %s\n        PROPERTIES {\n%s\n        }\n    }' % (cid, q(name), CHARACTER, body))
        if unresolved:
            print("  %s — carried as inventory/notes (no corpus hash): %s" % (name, unresolved))
    text = ('EXTENSION "Caul_Characters" EXTENDS "Daggerheart_Core_Base" {\n'
            '    NAME "The Enduring Lesser Lights - the player characters"\n'
            '    VERSION "0.1.0"\n    SPEC_VERSION "0.5"\n    RELEASE_DATE "2026-09-24"\n\n'
            + "\n\n".join(blocks) + "\n}\n")
    out = os.path.join(HERE, "campaign/dsl/caul-pcs.actor")
    open(out, "w").write(text)
    print("wrote campaign/dsl/caul-pcs.actor:", len(blocks), "character(s)")

if __name__ == "__main__":
    main()
