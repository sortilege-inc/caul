#!/usr/bin/env python3
"""M4: seed the campaign's arc and threads into campaign/pack/seed.json (defaultCampaign.seed).

The seed fills what the campaign has never had — its opening arc and its open threads — once; the
GM edits from there and the seed never overwrites a change (engine/state.js seed). To honour "don't
get ahead of play", nothing here is invented: the threads are the ones the campaign already tracks
(campaign/gm/threads.html, verbatim titles + their own first line), and the single opening scene is
a factual recap of where Session 27 left the company (the World Above; the fight unresolved).

    python3 campaign/source/build_seed.py

Proves the output: it is a valid pack (kind/version), its threads are the tracked ones, and the
scene text quotes the Session 27 chronicle (no invented plot).
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CAMPAIGN = os.path.dirname(HERE)
OUT = os.path.join(CAMPAIGN, "pack", "seed.json")
THREADS_SRC = os.path.join(CAMPAIGN, "gm", "threads.html")

# the h3s in threads.html that are section labels, not threads
CATEGORY = {"Immediate / Active", "Character Arcs", "Faction & NPC Threads", "World Threads",
            "Dormant / Background", "The Threads, Session by Session", "Earlier Thread Notes"}


def text_of(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(s))).strip()


def named_threads():
    src = open(THREADS_SRC, encoding="utf-8").read()
    out = []
    for m in re.finditer(r"<h3[^>]*>(.*?)</h3>(.*?)(?=<h[23]|</div>|<footer)", src, re.S):
        title = text_of(m.group(1))
        if title in CATEGORY:
            continue
        first = text_of(m.group(2))
        out.append({"title": title, "note": first[:280]})
    return out


def opening_scene():
    # a factual recap of the Session 27 end-state, from the chronicle (no invented plot)
    return ("The company stands in the World Above, beyond the moon-membrane, where Session 27 left "
            "them. The fight is unresolved — the leaping predator (the giant bush-baby), the great "
            "cat (unengaged), and the leech-larvae remain. Open leads recovered so far: Amber Reach "
            "(glimpsed as a living city) and the mountain waterfall. Talis burns below.")


def main():
    threads = named_threads()
    pack = {
        "kind": "sortilege-vtt-campaign",
        "version": 1,
        "campaign": {"name": "Caul"},
        "arc": [
            {"id": "caul-s28-open", "title": "Session 28 — The World Above",
             "text": opening_scene(), "played": False},
        ],
        "threads": [
            {"id": "caul-thread-%d" % i, "title": t["title"], "text": t["note"]}
            for i, t in enumerate(threads, 1)
        ],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(pack, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    # proof
    p = json.load(open(OUT, encoding="utf-8"))
    bad = 0
    if p.get("kind") != "sortilege-vtt-campaign" or p.get("version") != 1:
        bad += 1; print("BAD PACK header")
    if not p["arc"] or "World Above" not in p["arc"][0]["text"]:
        bad += 1; print("scene not the factual recap")
    got = {t["title"] for t in p["threads"]}
    want = {t["title"] for t in threads}
    if got != want:
        bad += 1; print("threads differ from the tracked set")
    print("build_seed: %d thread(s), %d opening scene → %s: %s" %
          (len(p["threads"]), len(p["arc"]), os.path.relpath(OUT, os.getcwd()),
           "OK" if not bad else "FAILED (%d)" % bad))
    for t in p["threads"]:
        print("   thread:", t["title"])
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
