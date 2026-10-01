#!/usr/bin/env python3
"""The chronicle index's cards, rebuilt from the session pages themselves: each card shows the
session's title, its play date (September 24, 2026) and its lead quote (the page's epigraph, whole).
The session pages' own date line reads the same way. Idempotent; run it after adding a session.

    python3 campaign/source/chronicle_index.py
"""
import datetime
import glob
import html
import os
import re

CAMPAIGN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHRON = os.path.join(CAMPAIGN, "docs", "chronicle")
ISO = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


def long_date(iso):
    y, m, d = (int(x) for x in iso.split("-"))
    return "%s %d, %d" % (datetime.date(y, m, d).strftime("%B"), d, y)


def text_of(fragment):
    # the card is itself a link, so the quote keeps its emphasis but loses any links inside it
    t = re.sub(r"<(?!/?em>)[^>]+>", "", fragment)
    return t.strip()


def main():
    sessions = []
    for f in sorted(glob.glob(os.path.join(CHRON, "s[0-9][0-9]-*.html"))):
        slug = os.path.basename(f)[:-5]
        t = open(f, encoding="utf-8").read()
        meta = re.search(r'<p class="meta">Session (\d+)<span class="sep">·</span>([^<]+)</p>', t)
        title = re.search(r"<h1>(.*?)</h1>", t, re.S).group(1)
        epi = re.search(r'<p class="epigraph">(.*?)</p>', t, re.S).group(1)
        when = meta.group(2)
        if ISO.fullmatch(when):                       # the page's own date line, in words
            t = t.replace(meta.group(0), meta.group(0).replace(when, long_date(when)), 1)
            open(f, "w", encoding="utf-8").write(t)
            when = long_date(when)
        sessions.append((int(meta.group(1)), slug, title, when, text_of(epi)))

    idx = os.path.join(CHRON, "index.html")
    t = open(idx, encoding="utf-8").read()
    cards = "".join(
        '<a id="s%02d" href="#chronicle/%s"><span class="no">%d</span><span class="body">'
        '<h3>%s</h3><span class="dt">%s</span><p class="quote">%s</p></span></a>' % (n, slug, n, title, html.escape(when), epi)
        for n, slug, title, when, epi in sorted(sessions, reverse=True))
    t, k = re.subn(r'<div class="chron">.*?</div>', lambda m: '<div class="chron">' + cards + "</div>", t, count=1, flags=re.S)
    assert k == 1, "no .chron block in the index"
    open(idx, "w", encoding="utf-8").write(t)

    # proof: one card per session page, each carrying its page's title, date and whole epigraph
    t = open(idx, encoding="utf-8").read()
    bad = [slug for n, slug, title, when, epi in sessions
           if ('href="#chronicle/%s"' % slug) not in t or epi not in t or ("<h3>%s</h3><span class=\"dt\">%s</span>" % (title, html.escape(when))) not in t]
    iso_left = [os.path.basename(f) for f in glob.glob(os.path.join(CHRON, "s*.html"))
                if re.search(r'<p class="meta">Session \d+<span class="sep">·</span>\d{4}-', open(f, encoding="utf-8").read())]
    print("chronicle_index: %d cards (%d session pages); %s" % (t.count('<span class="no">'), len(sessions),
          "OK" if not bad and not iso_left and t.count('<span class="no">') == len(sessions) else "FAILED: %s %s" % (bad, iso_left)))


if __name__ == "__main__":
    main()
