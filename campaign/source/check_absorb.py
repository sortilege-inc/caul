#!/usr/bin/env python3
"""The gate for the veil's move into the GM tabs: every word of Behind the Veil (campaign/docs/veil.html
as it stood at the move) is in the seed's GM material (campaign/pack/seed.json), article by article,
in order, once. Independent of absorb_veil.py: it reads the HTML with regular expressions, not that
script's parser, and the seed's Markdown by stripping its marks.

    git show d8e0fd7:campaign/docs/veil.html > /tmp/veil.html
    python3 campaign/source/check_absorb.py /tmp/veil.html          # exit 0 = every article matches
    python3 campaign/source/check_absorb.py /tmp/veil.html --plant  # must FAIL: a word changed, a block dropped

Allowed differences, and only these: the hub section; each article's masthead (its eyebrow, title and
line) and spoiler banner — but a single article's own title is its section's title, so it is kept;
the " · " between a table row's cells.
"""
import copy
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'veil-'
SINGLE = {'faeries-thistleglass', 'sylvie-draft', 'vignette', 'design-notes'}


def toks(t):
    return html.unescape(t).split()


def doc_articles(src):
    s = Path(src).read_text()
    arts = {}
    for m in re.finditer(r'<section id="([^"]+)">(.*?)</section>', s, re.S):
        aid, body = m.group(1), m.group(2)
        if aid == 'index':
            continue
        title = re.search(r'<h1>(.*?)</h1>', body, re.S).group(1)
        body = re.sub(r'<header.*?</header>', ' ', body, flags=re.S)
        body = re.sub(r'<div class="gm-banner">.*?</div></div>', ' ', body, flags=re.S)
        body = re.sub(r'</?(?:p|li|ul|h\d|tr|td|th|table|thead|tbody|div|article|hr)\b[^>]*>', ' ', body)
        body = re.sub(r'<[^>]+>', '', body)
        words = toks(body)
        if aid in SINGLE:
            words = toks(re.sub(r'<[^>]+>', '', title)) + words
        arts[aid] = words
    return arts


def plain(md):
    t = re.sub(r'\[([^\]]+)\]\([^)\s]*\)', r'\1', md or '')
    t = t.replace('**', '').replace('*', '')
    t = re.sub(r'^- ', '', t, flags=re.M)
    return [w for w in t.split() if w != '·']


def seed_articles(seed):
    arts = {}
    for where in ('overview', 'places', 'people', 'pc', 'rules'):
        for x in (seed.get('gm') or {}).get(where) or []:
            if not x['id'].startswith(PREFIX):
                continue
            art = next((a for a in ARTICLES if x['id'] == PREFIX + a or x['id'].startswith(PREFIX + a + '-')), None)
            if art is None:
                sys.exit('a seed section from no article: ' + x['id'])
            w = arts.setdefault(art, [])
            w += plain(x['title']) + plain(x['text'])
            for y in x.get('sections') or []:
                w += plain(y['title']) + plain(y['text'])
    return arts


def compare(doc, got):
    bad = 0
    for art, want in doc.items():
        have = got.pop(art, None)
        if have is None:
            print('FAIL missing from the seed: ' + art); bad += 1
        elif have != want:
            bad += 1
            i = next((k for k, (a, b) in enumerate(zip(want, have)) if a != b), min(len(want), len(have)))
            print('FAIL %s at word %d (document %d words, seed %d)' % (art, i, len(want), len(have)))
            print('   doc : ' + ' '.join(want[max(0, i - 8):i + 12]))
            print('   seed: ' + ' '.join(have[max(0, i - 8):i + 12]))
    for art in got:
        print('FAIL in the seed but not the document: ' + art); bad += 1
    return bad


def main(src, plant):
    global ARTICLES
    doc = doc_articles(src)
    ARTICLES = sorted(doc, key=len, reverse=True)     # longest first: "canon-persons" before "canon"
    seed = json.loads((ROOT / 'campaign/pack/seed.json').read_text())
    if plant:
        # two perturbations, each must be caught
        def change_word(s):
            y = next(y for x in s['gm']['places'] for y in x.get('sections') or [] if ' the ' in y['text'])
            y['text'] = y['text'].replace(' the ', ' a ', 1)

        for name, fn in (('a changed word', change_word),
                         ('a dropped subsection', lambda s: s['gm']['people'][0]['sections'].pop())):
            s = copy.deepcopy(seed)
            fn(s)
            n = compare(dict(doc), seed_articles(s))
            print('plant (%s): %s' % (name, 'caught' if n else 'MISSED'))
            if not n:
                sys.exit(1)
        return
    bad = compare(doc, seed_articles(seed))
    words = sum(len(w) for w in doc.values())
    print('%s: %d articles, %d words — %d failures' % ('PASS' if not bad else 'FAIL', len(doc), words, bad))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    main(args[0] if args else ROOT / 'campaign/docs/veil.html', '--plant' in sys.argv)
