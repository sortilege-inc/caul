#!/usr/bin/env python3
"""
check_shape.py — the fields the site reads, asserted against the corpus's own counts.

verify_data.py proves every string arrives; it is blind to a string on the wrong field (L5R5e
decision 20: a FAMILIES list parsed as a name and its type passed the string gate whole). This
checks the shapes system/daggerheart/ reads — every typed entity by its type, the Character
ACTOR's fields, the Action Roll's outcomes, the stat blocks' ATTACK / EXPERIENCES / FEATURES /
POTENTIAL_ADVERSARIES, the frames' blocks, the structured tables — and every count is taken
from a SCAN of the raw corpus files (a regex, sharing no code with the parser), never typed here.

    python3 build/check_shape.py [<path to titterpig-dsl-daggerheart/0.5>]
"""
import glob
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import BOOKS, DEFAULT_CORPUS  # noqa: E402
from verify_data import data_blobs  # noqa: E402

FAILS = []
N = [0]


def check(label, got, want):
    N[0] += 1
    if got != want:
        FAILS.append("%s: data has %r, the corpus %r" % (label, got, want))


def texts(corpus, pat="*.ttrpg"):
    return [open(p, encoding="utf-8").read() for p in sorted(glob.glob(os.path.join(corpus, pat)))]


def scan_text(corpus, pattern, pat="*.ttrpg"):
    rx = re.compile(pattern, re.M)
    return sum(len(rx.findall(t)) for t in texts(corpus, pat))


def block_body(text, head):
    """The raw text of the first `head … {` block, braces balanced (strings skipped)."""
    i = text.index(head)
    j = text.index("{", i)
    depth, k, in_str = 0, j, False
    while k < len(text):
        c = text[k]
        if in_str:
            if c == "\\":
                k += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[j + 1:k]
        k += 1
    raise SystemExit("check_shape: unbalanced block %r" % head)


def main():
    corpus = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CORPUS
    books, others = data_blobs()
    E = {}
    for b in books:
        E.update(b["entities"])
    chapters = [c for b in books for c in b["book"]["chapters"]]
    index = next(o for o in others if isinstance(o, dict))
    records = next(o for o in others if isinstance(o, list))
    blocks = lambda e, kw: [b for b in e.get("blocks", []) if isinstance(b, dict) and b.get("kw") == kw]
    prop = lambda e, n: next((p for p in e.get("props", []) if p["name"] == n), None)

    def deep(test):
        """How many nodes anywhere in the book data pass `test`."""
        n = 0
        stack = [c.get("blocks") for c in chapters] + [[e] for e in E.values()]
        while stack:
            x = stack.pop()
            if isinstance(x, list):
                stack.extend(x)
            elif isinstance(x, dict):
                if test(x):
                    n += 1
                for k, v in x.items():
                    if k != "children" and isinstance(v, (list, dict)):
                        stack.append(v)
        return n

    # ── the books, the files, the ids ──
    check("books", len(books), len(BOOKS))
    n_files = len(glob.glob(os.path.join(corpus, "*.ttrpg"))) + len(glob.glob(os.path.join(corpus, "*.lore")))
    check("chapters (every .ttrpg and .lore)", len(chapters), n_files)
    check("entities with an id this build wrote (the corpus hashes every one — PLAN H1)",
          sum(1 for e in E.values() if e.get("synthetic")), 0)
    check("index entity count", index["counts"]["entities"], len(E))

    # ── every type, by its EXTENDS lines ──
    # `EXTENDS #h ^"T"` anywhere (a one-line DEF carries it inline); a DEF that EXTENDS its own
    # name is a character's printing of that entity (copyOf), not an instance of a type.
    raw = Counter()
    for t in texts(corpus):
        for m in re.finditer(r'(?:\^|ACTOR )"((?:[^"\\]|\\.)*)"\s+DEF\s*\{([^{}]*?)EXTENDS\s+(?:#\w+\s+)?\^"((?:[^"\\]|\\.)*)"', t):
            if m.group(1) != m.group(3):
                raw[m.group(3)] += 1
    got = Counter(e["type"] for e in E.values() if e.get("type"))
    for ty in sorted(set(raw) | set(got)):
        check("entities of type %s" % ty, got.get(ty, 0), raw.get(ty, 0))
    check("records (every typed entity)", sum(1 for r in records if r.get("type")), sum(raw.values()))

    # ── the actors ──
    for actor in ("Entity", "Character", "Adversary", "Environment"):
        e = [x for x in E.values() if x["form"] == "ACTOR" and x["name"] == actor]
        check("ACTOR %s" % actor, len(e), 1)
    base = open(glob.glob(os.path.join(corpus, "*-core-base.ttrpg"))[0], encoding="utf-8").read()
    body = block_body(base, 'ACTOR "Character" DEF')
    props_raw = block_body(body, "PROPERTIES")
    # a property declaration line: `^"Name" <type…>` at the PROPERTIES block's own depth
    depth, top = 0, []
    for ln in props_raw.split("\n"):
        s = ln.strip()
        if depth == 0 and s.startswith('^"'):
            top.append(re.match(r'\^"([^"]+)"', s).group(1))
        depth += ln.count("{") - ln.count("}")
    ch = next(x for x in E.values() if x["form"] == "ACTOR" and x["name"] == "Character")
    check("Character ACTOR's properties (names, in order)", [p["name"] for p in ch.get("props", [])], top)
    gold = prop(ch, "Gold")
    check("Character's Gold fields", [f["name"] for f in (gold or {}).get("fields", [])], ["Handfuls", "Bags", "Chest"])
    for name, ofh in (("Loadout", "#daggerheartDomainCard0000001"), ("Vault", "#daggerheartDomainCard0000001"),
                      ("Experiences", "#daggerheartExperience00000001"), ("Conditions", "#daggerheartCondition0000000001")):
        p = prop(ch, name)
        check("Character's %s is a LIST OF %s" % (name, ofh), (p or {}).get("ofHash"), ofh)

    # ── the dice ──
    ar = next(x for x in E.values() if x["name"] == "Action Roll" and x["id"] == "#daggerheartActionRoll000000001")
    out = blocks(ar, "OUTCOMES")
    check("Action Roll OUTCOMES rows", len(out[0]["body"]) if out else 0,
          len(re.findall(r'^\s*"[^"]+"\s+"', block_body(base, "OUTCOMES"), re.M)))

    # ── stat blocks ──
    for kw in ("ATTACK", "EXPERIENCES", "FEATURES", "POTENTIAL_ADVERSARIES", "PLAYER_PRINCIPLES", "GM_PRINCIPLES",
               "CAMPAIGN_MECHANICS", "TIERS", "ROLL_TABLE", "FOUNDATION", "SPECIALIZATION", "MASTERY"):
        check("%s blocks" % kw, deep(lambda x, kw=kw: x.get("kw") == kw), scan_text(corpus, r"^\s*%s\b[^\n{]*\{" % kw))
    # an adversary's attack is a value: one DEF-shaped property in each ATTACK block
    check("ATTACK values (Range + Damage)",
          deep(lambda x: x.get("kw") == "ATTACK" and len(x.get("body", [])) == 1 and x["body"][0].get("vk") == "def"),
          scan_text(corpus, r"^\s*ATTACK\s*\{"))
    # a FEATURES block's DEFs are entities: every one left as {ent}
    feat_raw = scan_text(corpus, r'^\s*(?:#\w+\s+)?\^"[^"]+"\s+DEF\s*\{\s*$\n\s*EXTENDS\s+(?:#\w+\s+)?\^"(?:Adversary Feature|Environment Feature)"')
    check("adversary and environment features", sum(1 for e in E.values() if e.get("type") in ("Adversary Feature", "Environment Feature")), feat_raw)

    # ── the structured tables (C1) ──
    rw = next((x for x in E.values() if x["name"] == "Ride Like the Wind"), None)
    mounts = prop(rw, "Mounts") if rw else None
    check("Ride Like the Wind's Mounts", len((mounts or {}).get("items", [])),
          len(re.findall(r'"[^"]+"', re.search(r'\^"Mounts" LIST \[([^\]]*)\]', "\n".join(texts(corpus))).group(1))))
    ld = next((x for x in E.values() if x["name"] == "Lurking Darkness"), None)
    rt = blocks(ld, "ROLL_TABLE") if ld else []
    check("Lurking Darkness ROLL_TABLE rows", len(rt[0]["body"]) if rt else 0,
          len(re.findall(r'^\s*"[^"]+"\s+"', block_body("\n".join(texts(corpus)), 'ROLL_TABLE "1d12"'), re.M)))

    # ── .lore ──
    check(".lore chapters", sum(1 for c in chapters if c["kind"] == "lore"), len(glob.glob(os.path.join(corpus, "*.lore"))))

    if FAILS:
        print("check_shape: %d of %d assertions FAIL" % (len(FAILS), N[0]))
        for f in FAILS:
            print("  " + f)
        return 1
    print("check_shape: OK (%d assertions; %d types, %d typed entities)" % (N[0], len(raw), sum(raw.values())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
