#!/usr/bin/env python3
"""M4: the old Caul wiki pages → campaign/docs/ fragments the VTT's site tabs render.

Each page's content region (`<div class="wrap">` … before `<footer>`) is taken as it stands — the
page chrome goes (header, nav, breadcrumb, footer, scripts) and every internal link is rewritten
from the old page paths to the tab routes (#chronicle/s26-brathis-burns, #atlas/drosvens-gate,
#personae/askavir), every asset to campaign/assets/. Nothing else changes. Per-page (not
concatenated): the multi-page sections keep one doc per page, fetched by the tab for the path.

    python3 campaign/source/migrate_docs.py [--only <route>]   # write campaign/docs/, then prove
    python3 campaign/source/migrate_docs.py --check [--only …] # prove only (after old pages gone)
    python3 campaign/source/migrate_docs.py --plant [--only …] # a planted change/link MUST fail

The proof, per page: the migrated doc's text (every text node, in order) equals the old page's
content region's text; every href/src resolves — an internal link to a route this migration
produces (with a stem that is a real page in that section) or an asset on disk. Exits 1 on any
difference.
"""
import html
import os
import re
import sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
CAMPAIGN = os.path.dirname(HERE)
ROOT = os.path.dirname(CAMPAIGN)
DOCS = os.path.join(CAMPAIGN, "docs")

# a section: its old dir under campaign/ (None = the top-level home), and its tab route. Each .html
# in the dir becomes campaign/docs/<route>/<stem>.html; the route's index is the section hub.
SECTIONS = {
    "home": (None, "home"),               # campaign/index.html only
    "chronicle": ("chronicle", "chronicle"),
    "company": ("company", "company"),
    "personae": ("dramatis-personae", "personae"),
    "factions": ("factions", "factions"),
    "atlas": ("atlas", "atlas"),
    "relics": ("relics", "relics"),
    "lore": ("lore", "lore"),
}
# old dir → route, for rewriting cross-section links
DIR_ROUTE = {d: r for _k, (d, r) in SECTIONS.items() if d}
DIR_ROUTE["."] = "home"                    # ../index.html
# the GM/veil dir is not a player tab; its lore lands in the gated Notes doc (built separately)
VEIL_DIR = "gm"
# pages handled by a dedicated site script, not a prose doc: the atlas index is the interactive
# map (campaign/site/map.js renders it at #atlas; its entries migrate as prose docs at #atlas/<x>)
SKIP = {"atlas/index.html"}

ARGS = sys.argv[1:]
CHECK = "--check" in ARGS
PLANT = "--plant" in ARGS
ONLY = ARGS[ARGS.index("--only") + 1] if "--only" in ARGS else None


def pages_of(route):
    """(old page path relative to campaign/, doc stem) for each page in a section."""
    d, _ = SECTIONS[route]
    if d is None:
        return [("index.html", "index")]
    out = []
    for f in sorted(os.listdir(os.path.join(CAMPAIGN, d))):
        if f.endswith(".html") and (d + "/" + f) not in SKIP:
            out.append((d + "/" + f, f[:-5]))
    return out


def stems(route):
    return {stem for _p, stem in pages_of(route)}


def rewrite_url(url, page):
    """An old href/src, as written in `page`, → where it points now."""
    if re.match(r"^(https?:|mailto:|data:)", url):
        return url
    if url.startswith("#"):                                   # an in-page anchor: kept as-is
        return url
    path, _, frag = url.partition("#")
    base = os.path.dirname(page)                              # e.g. "chronicle"
    target = os.path.normpath(os.path.join(base, path)) if path else page
    tdir = os.path.dirname(target) or "."
    stem = os.path.basename(target)[:-5] if target.endswith(".html") else None
    if tdir == "play":                                       # the retired standalone sheets (M3):
        return "gm/play.html"                                # now the VTT player page (claim + play)
    if not target.endswith(".html"):                         # an image or other asset, kept in place
        return "campaign/" + target                          #   under campaign/ (served from the site root)
    if tdir == VEIL_DIR:                                      # a link into the GM veil (rare in player prose)
        return "#veil"
    route = DIR_ROUTE.get(tdir)
    if route is None or stem is None:
        raise SystemExit("%s: no route for %r (→ %s)" % (page, url, target))
    if stem == "index":
        return "#" + route + (("/" + frag) if frag else "")
    return "#" + route + "/" + stem + (("/" + frag) if frag else "")


def region(page):
    """The page's content region, chrome removed (header/nav before the wrap; footer after)."""
    src = open(os.path.join(CAMPAIGN, page), encoding="utf-8").read()
    i = src.index('<div class="wrap"')
    i = src.index(">", i) + 1
    j = src.rindex("<footer")
    body = src[i:j]
    body = body[: body.rindex("</div>")]                     # the wrap's own close
    body = re.sub(r'\s*<p class="crumb">.*?</p>', "", body, count=1, flags=re.S)
    return body.strip("\n") + "\n"


def convert(page):
    body = region(page)
    def one(m):
        u = rewrite_url(html.unescape(m.group(2)), page)
        return '%s="%s"' % (m.group(1), u.replace("&", "&amp;"))
    return re.sub(r'\b(href|src)="([^"]*)"', one, body)


class Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.urls, self.ids = [], [], set()

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ("href", "src") and v is not None:
                self.urls.append(v)
            if k == "id" and v:
                self.ids.add(v)

    def handle_data(self, d):
        self.out.append(d)


def parse(s):
    p = Text(); p.feed(s); return p


def out_path(route, stem):
    return os.path.join(DOCS, SECTIONS[route][1], stem + ".html")


def write_all(routes):
    for route in routes:
        os.makedirs(os.path.join(DOCS, SECTIONS[route][1]), exist_ok=True)
        for page, stem in pages_of(route):
            open(out_path(route, stem), "w", encoding="utf-8").write(convert(page))


def prove(routes):
    bad = 0
    all_stems = {r: stems(r) for r in SECTIONS}
    for route in routes:
        for page, stem in pages_of(route):
            op = out_path(route, stem)
            doc = open(op, encoding="utf-8").read()
            if PLANT and route == (ONLY or "chronicle") and stem == pages_of(route)[0][1]:
                doc = doc + "<a href=\"#nowhere/x\">plant</a>ZZ"   # a bad link + extra text
            new = parse(doc)
            b = "".join(new.out)
            a = "".join(parse(region(page)).out) if os.path.exists(os.path.join(CAMPAIGN, page)) else b
            text_ok = (a == b)
            if not text_ok:
                bad += 1
                k = min((i for i in range(min(len(a), len(b))) if a[i] != b[i]), default=min(len(a), len(b)))
                print("TEXT DIFFERS %s/%s at %d: %r | %r" % (route, stem, k, a[k-30:k+30], b[k-30:k+30]))
            n_ok = 0
            for u in new.urls:
                ok = True
                if re.match(r"^(https?:|mailto:)", u) or u.startswith("#") and "/" not in u[1:]:
                    ok = True                                  # external, or a bare tab / in-page anchor
                elif u.startswith("#"):
                    parts = u[1:].split("/")
                    tab = parts[0]
                    if tab == "veil":
                        ok = True
                    elif tab in all_stems:
                        ok = (len(parts) < 2) or (parts[1] in all_stems[tab]) or (parts[1] == "index")
                    else:
                        ok = False
                else:
                    ok = os.path.exists(os.path.join(ROOT, u.split("#")[0]))
                if ok:
                    n_ok += 1
                else:
                    bad += 1; print("UNRESOLVED %s/%s: %s" % (route, stem, u))
            print("%-11s %-28s %6d chars, text identical: %s; %3d links, all resolve: %s"
                  % (route, stem, len(b), text_ok, len(new.urls), n_ok == len(new.urls)))
    return bad


def main():
    routes = [ONLY] if ONLY else list(SECTIONS)
    if not CHECK and not PLANT:
        write_all(routes)
    bad = prove(routes)
    if PLANT:
        if bad:
            print("\nPLANT: the check reported %d problem(s) — it works." % bad); return
        sys.exit("PLANT: the planted change/link was NOT caught — the check is vacuous.")
    if bad:
        sys.exit("\n%d problem(s)." % bad)
    print("\nmigrate_docs: OK — every migrated page's text matches the old region and every link resolves.")


if __name__ == "__main__":
    main()
