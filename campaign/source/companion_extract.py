#!/usr/bin/env python3
"""
companion_extract.py — read a Foundry `companion`-type actor (the Daggerheart Ranger's-Companion
sheet: Pinchie, the Umbral Raven) into the flat values the DSL layer needs. Companions are stored
semi-manually in Foundry, so this reads the record's own values rather than deriving them, and
records any anomaly it sees (a stray die, a blank experience) in `anomalies` for the owner to fix
at the Foundry source (decision 4: regenerate from Foundry going forward), never silently.

    from companion_extract import actor_to_companion
    c = actor_to_companion(actor, partner="Jamal Jenkins")

Returns: name, partner, evasion, stressMax, stressMarked, attack{name,range,damage},
experiences[{name,modifier}], upgrades[str], and anomalies[str].
"""

# Foundry level-up optionKey -> the corpus Companion Upgrade's canonical name
UPGRADE_BY_KEY = {
    "vicious": "Vicious",
    "stress": "Resilient",          # "gains an additional Stress slot"
    "hope": "Light in the Dark",    # "an additional Hope slot your character can mark"
    "bonded": "Bonded",
    "armored": "Armored",
    "evasion": "Aware",             # "+2 to their Evasion"
    "experience": "Intelligent",    # "+1 bonus to a Companion Experience"
    "comfort": "Creature Comfort",
    "creaturecomfort": "Creature Comfort",
}

NORMAL_DICE = {"d4", "d6", "d8", "d10", "d12"}   # a companion damage die; d20 is Foundry's unset default


def _damage_string(attack, anomalies, name):
    dmg = ((attack.get("damage") or {}).get("main") or {})
    val = dmg.get("value") or {}
    die = val.get("dice")
    if die not in NORMAL_DICE:
        alt = (dmg.get("valueAlt") or {}).get("dice")
        if alt in NORMAL_DICE:
            anomalies.append("%s attack die is %r (Foundry's unset default); using valueAlt %r" % (name, die, alt))
            die = alt
        else:
            anomalies.append("%s attack die is %r, no usable die on the record" % (name, die))
    mult = val.get("multiplier")
    lead = "Prof " if mult == "prof" else ""
    types = dmg.get("type") or []
    tail = (" " + "/".join(types)) if types else ""
    return ("%s%s%s" % (lead, die or "", tail)).strip()


def actor_to_companion(actor, partner=None):
    s = actor["system"]
    anomalies = []
    name = actor["name"]

    res = (s.get("resources") or {}).get("stress") or {}
    att = s.get("attack") or {}
    rng = (att.get("range") or "").strip()

    # experiences: keep the named ones; a blank name is a record gap, flagged not dropped-silently
    exps = []
    for _k, e in (s.get("experiences") or {}).items():
        nm = (e.get("name") or "").strip()
        if nm:
            exps.append({"name": nm, "modifier": e.get("value", 0)})
        else:
            anomalies.append("%s has an unnamed Experience (modifier %s) — blank in Foundry" % (name, e.get("value")))

    # chosen upgrades from the level-up selections' optionKey
    upgrades, unmapped = [], []
    for _lvl, d in ((s.get("levelData") or {}).get("levelups") or {}).items():
        for sel in d.get("selections") or []:
            key = (sel.get("optionKey") or sel.get("type") or "").lower().replace(" ", "").replace("-", "")
            if key in ("experience",):   # an Experience selection is not a training upgrade
                continue
            nm = UPGRADE_BY_KEY.get(key)
            if nm:
                if nm not in upgrades:
                    upgrades.append(nm)
            elif key:
                unmapped.append(key)
    if unmapped:
        anomalies.append("%s has unmapped level-up selection(s): %s" % (name, sorted(set(unmapped))))

    return {
        "name": name,
        "partner": partner,
        "evasion": s.get("evasion"),
        "stressMax": res.get("max"),
        "stressMarked": res.get("value", 0) or 0,
        "attack": {
            "name": (att.get("name") or "").strip(),
            "range": rng[:1].upper() + rng[1:] if rng else "",
            "damage": _damage_string(att, anomalies, name),
        },
        "experiences": exps,
        "upgrades": upgrades,
        "anomalies": anomalies,
    }
