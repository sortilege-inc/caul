#!/usr/bin/env python3
"""
env_extract.py — read a Foundry `environment`-type actor into the flat values the DSL layer needs,
mapping onto the corpus ACTOR "Environment" (Tier, Description, Difficulty) plus its
POTENTIAL_ADVERSARIES and FEATURES sub-blocks. Category and Impulses are book concepts the Foundry
schema does not store, so they are absent (not a conversion gap). Potential-adversary compendium
UUIDs are resolved to names via campaign/source/env-adversary-names.json.
"""
import hashlib, re

TYPE_RE = re.compile(r"^(.*?)\s*[-–]\s*(Passive|Action|Reaction)\s*$")
LEAD_RE = re.compile(r"^(?:(.*?)\s*[-–]\s*)?(Passive|Action|Reaction)\s*:\s*(.*)$", re.S)


def clean(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def feature_id(env_id, fname):
    return "caulEF" + hashlib.md5((env_id + "|" + fname).encode()).hexdigest()[:18]


def _feature(env_id, item):
    raw_name = item["name"]
    ftype = None
    name = raw_name
    m = TYPE_RE.match(raw_name)
    if m:
        name, ftype = m.group(1).strip(), m.group(2).title()
    desc = clean((item.get("system") or {}).get("description", ""))
    lm = LEAD_RE.match(desc)
    if lm:
        if not ftype and lm.group(2):
            ftype = lm.group(2).title()
        desc = lm.group(3).strip()
    options = [o.strip(" .") for o in re.split(r"[•·]", desc) if o.strip(" .")] if "•" in desc or "·" in desc else []
    if options:
        desc = desc.split("•")[0].split("·")[0].strip()
    return {"id": feature_id(env_id, raw_name), "name": name, "type": ftype, "description": desc, "options": options}


def actor_to_environment(actor, name_cache):
    s = actor["system"]
    eid = actor.get("_id") or actor["name"]
    groups = []
    for g in (s.get("potentialAdversaries") or {}).values():
        names = [name_cache.get(u) for u in g.get("adversaries", [])]
        names = [n for n in names if n]
        if names:
            groups.append({"label": g.get("label") or "Potential Adversaries", "names": names})
    feats = [_feature(eid, it) for it in actor.get("items", []) if it.get("type") == "feature"]
    diff = s.get("difficulty")
    return {
        "name": actor["name"],
        "tier": s.get("tier"),
        "description": clean(s.get("description", "")),
        "difficulty": str(diff) if diff is not None else None,
        "groups": groups,
        "features": feats,
    }
