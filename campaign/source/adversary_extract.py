#!/usr/bin/env python3
"""
adversary_extract.py — read a Foundry `adversary`-type actor into the flat values the DSL layer
needs, mapping onto the corpus ACTOR "Adversary" (Tier, Role, Description, Motives & Tactics,
Difficulty, Damage Thresholds, Hit Points, Stress, Attack Modifier) plus its ATTACK / EXPERIENCES /
FEATURES sub-blocks. Reads the record's own values; flags a gap rather than inventing one.

    from adversary_extract import actor_to_adversary
    ad = actor_to_adversary(actor)
"""
import hashlib, re

RANGE = {"melee": "Melee", "veryClose": "Very Close", "close": "Close",
         "far": "Far", "veryFar": "Very Far", "self": "Self"}
DTYPE = {"physical": "phy", "magical": "mag"}


def clean(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def feature_id(adv_id, fname):
    return "caulAF" + hashlib.md5((adv_id + "|" + fname).encode()).hexdigest()[:18]


def _damage(att):
    dmg = (att.get("damage") or {}).get("main") or {}
    val = dmg.get("value") or {}
    die = val.get("dice")
    n = val.get("flatMultiplier") if val.get("multiplier") == "flat" else val.get("flatMultiplier", 1)
    bonus = val.get("bonus") or 0
    types = dmg.get("type") or []
    s = "%s%s" % (n if n is not None else "", die or "")
    if bonus:
        s += "+%d" % bonus
    ab = "/".join(DTYPE.get(t, t) for t in types)
    if ab:
        s += " " + ab
    return s.strip()


def actor_to_adversary(actor):
    s = actor["system"]
    aid = actor.get("_id") or actor.get("name")
    anomalies = []

    role = (s.get("type") or "").strip()
    role = role[:1].upper() + role[1:] if role else ""

    mt = s.get("motivesAndTactics") or ""
    motives = [m.strip() for m in re.split(r"\s*,\s*", mt) if m.strip()] if mt else []

    dt = s.get("damageThresholds") or {}
    res = s.get("resources") or {}
    hp = ((res.get("hitPoints") or {}).get("max"))
    stress = ((res.get("stress") or {}).get("max"))

    att = s.get("attack") or {}
    rng = att.get("range") or ""
    attack = {
        "name": (att.get("name") or "").strip(),
        "range": RANGE.get(rng, rng[:1].upper() + rng[1:] if rng else ""),
        "damage": _damage(att),
    }
    atk_mod = (att.get("roll") or {}).get("bonus")

    exps = []
    for _k, e in (s.get("experiences") or {}).items():
        nm = (e.get("name") or "").strip()
        if nm:
            exps.append({"name": nm, "modifier": e.get("value", 0)})
        else:
            anomalies.append("%s: unnamed Experience (modifier %s)" % (actor["name"], e.get("value")))

    feats = []
    for it in actor.get("items", []):
        if it.get("type") != "feature":
            continue
        desc = clean((it.get("system") or {}).get("description", ""))
        typ = None
        m = re.match(r"(Passive|Action|Reaction)\s*:\s*(.*)", desc, re.I)
        if m:
            typ, desc = m.group(1).title(), m.group(2).strip()
        if not desc:
            anomalies.append("%s: feature %r has no description in Foundry" % (actor["name"], it.get("name")))
        feats.append({"id": feature_id(aid, it["name"]), "name": it["name"], "type": typ, "description": desc})

    return {
        "name": actor["name"],
        "tier": s.get("tier"),
        "role": role,
        "description": clean(s.get("description", "")),
        "motives": motives,
        "difficulty": s.get("difficulty"),
        "thresholds": {"major": dt.get("major"), "severe": dt.get("severe")} if (dt.get("major") or dt.get("severe")) else None,
        "hitPoints": hp,
        "stress": stress,
        "attackModifier": atk_mod,
        "attack": attack if attack["name"] else None,
        "experiences": exps,
        "features": feats,
        "anomalies": anomalies,
    }
