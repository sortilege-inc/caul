#!/usr/bin/env python3
"""
check_shape.py — the fields the site reads, asserted against the corpus's own counts.

verify_data.py proves every string arrives; it is blind to a string on the wrong field. This
checks the shapes system/daggerheart/ reads — the Samurai ACTOR's fields, the dice faces, the Twenty
Questions, clans / families / schools, techniques in both encodings, NPCs, pregens, the arcs'
parts and scenes, the codex, the errata — and every count is taken from a LINE SCAN of the
corpus (a regex over the raw files, sharing no code with the parser), never typed here.

    python3 build/check_shape.py [<path to titterpig-dsl-daggerheart/0.5>]
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import BOOKS, DEFAULT_CORPUS  # noqa: E402
from verify_data import data_blobs  # noqa: E402

FAILS = []
N = [0]


def check(label, got, want):
    N[0] += 1
    if got != want:
        FAILS.append("%s: data has %r, the corpus %r" % (label, got, want))


def scan(corpus, pattern, glob_pat="*"):
    """How many lines of the raw corpus files match — the independent count."""
    rx = re.compile(pattern)
    n = 0
    for p in glob.glob(os.path.join(corpus, glob_pat)):
        with open(p, encoding="utf-8") as fh:
            n += sum(1 for ln in fh if rx.search(ln))
    return n


def scan_text(corpus, pattern, glob_pat="*"):
    """How many matches over the raw file text — for a construct the corpus writes across lines."""
    rx = re.compile(pattern)
    return sum(len(rx.findall(open(p, encoding="utf-8").read())) for p in glob.glob(os.path.join(corpus, glob_pat)))


def main():
    corpus = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CORPUS
    books, others = data_blobs()
    E = {}
    for b in books:
        E.update(b["entities"])
    chapters = [c for b in books for c in b["book"]["chapters"]]
    index = next(o for o in others if isinstance(o, dict))
    records = next(o for o in others if isinstance(o, list))
    by_name = lambda n: [e for e in E.values() if e["name"] == n]
    typed = lambda t: [e for e in E.values() if e.get("type") == t]
    blocks = lambda e, kw: [b for b in e.get("blocks", []) if isinstance(b, dict) and b.get("kw") == kw]
    prop = lambda e, n: next((p for p in e.get("props", []) if p["name"] == n), None)

    def deep(test):
        """How many nodes anywhere in the book data pass `test` (every chapter's and entity's blocks, props, fields)."""
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
                    if k not in ("children",) and isinstance(v, (list, dict)):
                        stack.append(v)
        return n

    # ── the books and files ──
    check("books", len(books), len(BOOKS))
    check("chapters (every corpus file)", len(chapters), len(glob.glob(os.path.join(corpus, "*.*"))))
    for ext in ("ttrpg", "actor", "arc", "frame", "codex", "lore"):
        check("%s chapters" % ext, sum(1 for c in chapters if c["kind"] == ext), len(glob.glob(os.path.join(corpus, "*." + ext))))

    # ── the player character: ACTOR "Samurai" and the fields the sheet reads ──
    sam = [e for e in E.values() if e["name"] == "Samurai" and e["form"] == "ACTOR"]
    check("ACTOR Samurai declared once", len(sam), scan(corpus, r'ACTOR "Samurai" DEF', "*.ttrpg"))
    ent = [e for e in E.values() if e["name"] == "Entity" and e["form"] == "ACTOR"]
    check("ACTOR Entity declared once", len(ent), 1)
    if sam and ent:
        s = sam[0]
        check("Samurai EXTENDS Entity", s.get("type"), "Entity")
        for f in ("Clan", "Family", "School", "School Rank", "Skills", "Techniques", "Advantages", "Disadvantages",
                  "Honor", "Glory", "Status", "Endurance", "Composure", "Focus", "Vigilance", "Fatigue", "Strife",
                  "Void Points", "Ninjō", "Giri", "Demeanor", "Equipment", "Roles", "Titles", "Bonds", "Bushido", "Experience"):
            check("Samurai declares %s" % f, prop(s, f) is not None, True)
        rings = prop(ent[0], "Rings")
        check("Entity's Rings are the five", [f["name"] for f in (rings or {}).get("fields", [])], ["Air", "Earth", "Fire", "Water", "Void"])
        check("each ring 1–5", sorted({(f.get("min"), f.get("max")) for f in (rings or {}).get("fields", [])}), [(1, 5)])

    # ── the dice: the faces the roller reads ──
    for die, n in (("Ring Die", 6), ("Skill Die", 12)):
        d = by_name(die)
        faces = [r for b in (blocks(d[0], "FACES") if d else []) for r in b.get("body", []) if "num" in r]
        check(die + " faces", [r["num"] for r in faces], list(range(1, n + 1)))
    sym = by_name("Dice Symbols")
    check("the symbols' RESOLUTION_ORDER", [a["s"] for b in (blocks(sym[0], "RESOLUTION_ORDER") if sym else []) for a in b["args"][0]["l"]], ["(ex)", "(st)", "(op)", "(su)"])
    tn = by_name("Target Number")
    check("TN DIFFICULTY_SCALE rows", [r["num"] for b in (blocks(tn[0], "DIFFICULTY_SCALE") if tn else []) for r in b.get("body", [])], list(range(1, 9)))

    # ── character creation ──
    qs = [e for e in E.values() if prop(e, "Question") and prop(e, "Question Text")]
    check("the Twenty Questions", sorted(prop(e, "Question")["value"] for e in qs if e["file"].endswith("core-chargen.ttrpg")), list(range(1, 21)))
    check("Clans", len(typed("Clan")), scan(corpus, r'EXTENDS #\S+ \^"Clan"$'))
    check("Families", len(typed("Family")), scan(corpus, r'EXTENDS #\S+ \^"Family"$'))
    check("Schools", len(typed("School")), scan(corpus, r'EXTENDS #\S+ \^"School"$'))
    check("schools with a CURRICULUM", sum(1 for e in typed("School") if blocks(e, "CURRICULUM")), len(typed("School")))
    check("CURRICULUM blocks (schools, titles, errata)", deep(lambda x: x.get("kw") == "CURRICULUM"), scan(corpus, r'^\s+CURRICULUM \{'))
    check("STARTING_TECHNIQUES blocks", deep(lambda x: x.get("kw") == "STARTING_TECHNIQUES"), scan(corpus, r'^\s+STARTING_TECHNIQUES \{'))
    check("Ring Increase with a CHOOSE", deep(lambda x: x.get("name") == "Ring Increase" and any(b.get("kw") == "CHOOSE" for b in x.get("blocks", []))),
          scan_text(corpus, r'\^"Ring Increase" DEF \{[^{}]*?CHOOSE'))
    check("families with a Ring Increase CHOOSE", sum(1 for e in typed("Family") if any(b.get("kw") == "CHOOSE" for b in (prop(e, "Ring Increase") or {}).get("blocks", []))), len(typed("Family")))
    # a list of bare names, one per line, is that many names (the parser once read each pair as
    # a name and its type, and Crab had three families instead of five)
    fam_names = sum(len(re.findall(r'\^"[^"]+"', m)) for p in glob.glob(os.path.join(corpus, "*")) for m in re.findall(r'FAMILIES \{([^{}]*)\}', open(p, encoding="utf-8").read()))
    check("names listed in FAMILIES blocks", deep(lambda x: x.get("vk") == "name" and False) + sum(1 for e in typed("Clan") for b in blocks(e, "FAMILIES") for x in b.get("body", []) if x.get("vk") == "name"), fam_names)
    check("core skills (SKILL_GROUP)", sum(1 for e in E.values() if e["file"].endswith("core-traits.ttrpg") and blocks(e, "SKILL_GROUP")), scan(corpus, r'^\s+SKILL_GROUP "', "*core-traits.ttrpg"))
    for t in ("Distinction", "Adversity", "Passion", "Anxiety"):
        check(t + " (EXTENDS)", len(typed(t)), scan(corpus, r'EXTENDS #\S+ \^"%s"$' % t))

    # ── techniques, both encodings ──
    check("techniques with a RANK line", sum(1 for e in E.values() if any(b.get("args") and not b.get("body") for b in blocks(e, "RANK"))),
          scan(corpus, r'^\s+RANK [0-9]+$', "*.ttrpg"))
    check("techniques APPLIES TO Technique", sum(1 for e in E.values() if any(a["name"] == "Technique" for a in e.get("applies", []))),
          scan(corpus, r'APPLIES TO \[#\S+ \^"Technique"\]'))

    # ── NPCs and pregens ──
    check("NPCs", len(typed("NPC")), scan(corpus, r'EXTENDS #\S+ \^"NPC"$'))
    check("pregens (Samurai in .actor)", sum(1 for e in typed("Samurai") if e["file"].endswith(".actor")), scan(corpus, r'EXTENDS #\S+ \^"Samurai"$', "*.actor"))
    check("NPC abilities as RULES lines", sum(len(e.get("rules", [])) for e in typed("NPC")) > 0, True)

    # ── adventures ──
    arcs = [c for c in chapters if c["kind"] == "arc"]
    check("arcs", len(arcs), 16)
    def count_kw(nodes, kw):
        n = 0
        for x in nodes or []:
            if isinstance(x, dict):
                if x.get("kw") == kw:
                    n += 1
                n += count_kw(x.get("body"), kw)
        return n
    check("arc PARTs", sum(count_kw(c["blocks"], "PART") for c in arcs), scan(corpus, r'^\s*PART [0-9]+ "', "*.arc"))
    check("arc SCENE blocks", sum(count_kw(c["blocks"], "SCENE") for c in arcs), scan(corpus, r'^\s*SCENE \^', "*.arc"))
    check("arc SCENES lists", sum(count_kw(c["blocks"], "SCENES") for c in arcs), scan(corpus, r'^\s*SCENES \[', "*.arc"))

    # ── the lore graph, the errata, the sidebars ──
    check("codex RELATIONSHIPS (a predicate and its target on one line)",
          sum(1 for e in E.values() if e["form"] == "ENTITY" for b in blocks(e, "RELATIONSHIPS") for x in b.get("body", []) if x.get("vk") == "ref"),
          scan(corpus, r'\^"[^"]*" *-> *\^', "*.codex"))
    check("codex ENTITY nodes", sum(1 for e in E.values() if e["form"] == "ENTITY"), scan(corpus, r'^\s*ENTITY ', "*.codex"))
    check("errata MODIFY blocks", sum(count_kw(c.get("blocks"), "MODIFY") for c in chapters) + sum(count_kw(e.get("blocks"), "MODIFY") for e in E.values()),
          scan(corpus, r'^\s*MODIFY '))
    # this corpus prints its sidebars at a file's top level, beside the DEFs they CONCERN; the
    # reader attaches each to its target at runtime
    check("GUIDANCE entries", sum(len(e.get("guidance", [])) for e in E.values()) + deep(lambda x: x.get("kw") == "ENTRY"), scan(corpus, r'^\s*ENTRY '))
    check("GUIDANCE entries that CONCERN something", deep(lambda x: x.get("kw") == "CONCERNS"), scan(corpus, r'^\s*CONCERNS \['))

    # ── records ──
    check("records carry every typed entity", sum(1 for r in records if r.get("type")), sum(1 for e in E.values() if e.get("type")))
    check("index counts entities", index["counts"]["entities"], len(E))

    print("check_shape: %s (%d assertions)" % ("OK" if not FAILS else "%d FAILED" % len(FAILS), N[0]))
    for f in FAILS:
        print("  " + f)
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
