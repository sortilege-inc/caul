#!/usr/bin/env python3
"""Behind the Veil into the GM tabs (PLAYBOOK §4b.2; owner, 2026-09-24): the one-time move of
campaign/docs/veil.html into the campaign pack's GM material — gm.{overview, places, people, pc} —
written into campaign/pack/seed.json, which fills the GM's campaign by id (engine/state.js seed).
After the move the pack is the source and the text is edited in the tabs; this script is kept as the
record of how it was carried, and is run only against the veil.html in git history:

    git show d8e0fd7:campaign/docs/veil.html > /tmp/veil.html
    python3 campaign/source/absorb_veil.py /tmp/veil.html
    python3 campaign/source/check_absorb.py /tmp/veil.html        # the gate

Where each article goes (by where the GM uses it):
    cosmology, faeries-thistleglass, vignette, design-notes  → Overview
    canon-places                                             → Places
    canon-persons, canon-bestiary, canon-factions            → People (a dossier "about" its record,
                                                               where the layer has one of that exact name)
    sylvie-draft                                             → Behind the characters, about Sylvie
Not carried: the hub (its cards describe the document) and each article's masthead line and
spoiler banner — except a single article's own title, which names its section.

Deterministic: the HTML's own markup becomes the GM Markdown (engine/gm-text.js) — <strong> → **…**,
<em> → *…*, <a> → [text](href), <li> → "- ", a table row → "- cell · cell · …". A heading below a
section's two levels becomes a bold line of its own. No word is changed.
"""
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / 'campaign/pack/seed.json'
PREFIX = 'veil-'          # every id this move writes starts with it (check_absorb.py relies on it)

# article → (destination, grouped?) — a grouped article is a set of entries, one section each (its
# top headings); a single article is one section named by its own title
HOMES = {
    'cosmology': ('overview', True),
    'canon-persons': ('people', True),
    'canon-places': ('places', True),
    'canon-factions': ('people', True),
    'canon-bestiary': ('people', True),
    'faeries-thistleglass': ('overview', False),
    'sylvie-draft': ('pc', False),
    'vignette': ('overview', False),
    'design-notes': ('overview', False),
}
SKIP = {'index'}          # the hub: cards pointing at the articles
# a section is "about" a record of the campaign layer with exactly its name (the Inspector shows it
# there); names with no exact record (Mellon, Valghast, Guardian Beast, Stonewraith) get none
ABOUT_TYPES = ('Character', 'Adversary', 'Environment')
PC_ABOUT = {'sylvie-draft': ['Sylvie Cerridwen']}   # a party member, by name


def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', html.unescape(t).lower()).strip('-')


class Blocks(HTMLParser):
    """Each article as a flat list: ('h', level, text) and ('p' | 'li', markdown)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.arts = {}          # id → {'title': h1, 'blocks': [...]}
        self.order = []
        self.art = None
        self.skip = 0           # inside a masthead or a banner
        self.in_header = False
        self.stack = []         # open blocks: [kind, level, buf]
        self.href = []
        self.cell = 0

    def emit(self, b):
        text = ''.join(b[2])
        text = re.sub(r'\s+', ' ', text).strip()
        b[2] = []
        if not text or self.art is None:
            return
        if b[0] == 'h':
            # a heading is a title, drawn as plain text: its own bold, italics and links go
            text = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', text).replace('**', '').replace('*', '').strip()
            self.arts[self.art]['blocks'].append(('h', b[1], text))
        else:
            self.arts[self.art]['blocks'].append((b[0], text))

    def open_block(self, kind, level=0):
        # a block opened inside another (a list inside a list item) closes what the outer one has so far
        if self.stack and self.stack[-1][2]:
            self.emit(self.stack[-1])
        self.stack.append([kind, level, []])

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        if tag == 'section':
            self.art = a.get('id')
            self.order.append(self.art)
            self.arts[self.art] = {'title': None, 'blocks': []}
            return
        if tag == 'header':
            self.in_header = True
        if tag == 'div' and 'gm-banner' in cls:
            self.skip = 1
            return
        if self.skip:
            if tag == 'div':
                self.skip += 1
            return
        if self.in_header:
            if tag == 'h1':
                self.stack.append(['title', 1, []])
            return
        if tag in ('h1', 'h2', 'h3', 'h4'):
            self.open_block('h', int(tag[1]))
        elif tag in ('p', 'li'):
            self.open_block(tag)
        elif tag == 'tr':
            self.open_block('li')
            self.cell = 0
        elif not self.stack:
            return
        elif tag in ('td', 'th'):
            if self.cell:
                self.stack[-1][2].append(' · ')
            self.cell += 1
        elif tag in ('strong', 'b'):
            self.stack[-1][2].append('**')
        elif tag in ('em', 'i'):
            self.stack[-1][2].append('*')
        elif tag == 'a':
            self.stack[-1][2].append('[')
            self.href.append(a.get('href', ''))

    def handle_endtag(self, tag):
        if tag == 'header':
            self.in_header = False
            return
        if self.skip:
            if tag == 'div':
                self.skip -= 1
            return
        if not self.stack:
            return
        top = self.stack[-1]
        if top[0] == 'title' and tag == 'h1':
            self.arts[self.art]['title'] = re.sub(r'\s+', ' ', ''.join(top[2])).strip()
            self.stack.pop()
        elif tag in ('h1', 'h2', 'h3', 'h4', 'p', 'li', 'tr'):
            self.emit(self.stack.pop())
        elif tag in ('strong', 'b'):
            top[2].append('**')
        elif tag in ('em', 'i'):
            top[2].append('*')
        elif tag == 'a':
            top[2].append('](' + self.href.pop() + ')')

    def handle_data(self, data):
        if not self.skip and self.stack:
            self.stack[-1][2].append(data)


def text_of(blocks):
    """Paragraphs as blocks; a run of list items as one list."""
    out = []
    for b in blocks:
        if b[0] == 'li':
            line = '- ' + b[1]
            if out and out[-1][0] == 'li':
                out[-1] = ('li', out[-1][1] + '\n' + line)
            else:
                out.append(('li', line))
        elif b[0] == 'h':
            out.append(('p', '**' + b[2] + '**'))          # a heading below the section's two levels
        else:
            out.append(b)
    return '\n\n'.join(t for _, t in out)


def section(sid, title, blocks, top):
    """A section from `blocks`: text up to the first heading of level `top`; each such heading a
    subsection (deeper headings bold lines inside it)."""
    head, subs, cur = [], [], None
    for b in blocks:
        if b[0] == 'h' and b[1] == top:
            cur = {'id': sid + '-' + slug(b[2]), 'title': b[2], 'body': []}
            subs.append(cur)
        else:
            (cur['body'] if cur else head).append(b)
    seen = {}
    for s in subs:        # the same heading twice (the Sylvie draft's two "GM Response") keeps ids unique
        seen[s['id']] = seen.get(s['id'], 0) + 1
        if seen[s['id']] > 1:
            s['id'] += '-' + str(seen[s['id']])
    x = {'id': sid, 'title': title, 'text': text_of(head)}
    if subs:
        x['sections'] = [{'id': s['id'], 'title': s['title'], 'text': text_of(s['body'])} for s in subs]
    return x


def layer_names():
    s = (ROOT / 'campaign/data/index.js').read_text()
    d, _ = json.JSONDecoder().raw_decode(s[s.index('var d=') + 6:])
    names = {}
    for r in d['records']:
        if r['type'] in ABOUT_TYPES:
            names.setdefault(r['name'], []).append(r['id'])
    return names


def main(src):
    p = Blocks()
    p.feed(Path(src).read_text())
    names = layer_names()
    gm = {'overview': [], 'places': [], 'people': [], 'pc': []}
    if set(p.order) - SKIP != set(HOMES):
        sys.exit('articles differ from HOMES: %s' % sorted(set(p.order) ^ (set(HOMES) | SKIP)))
    for art in p.order:
        if art in SKIP:
            continue
        dest, grouped = HOMES[art]
        blocks = p.arts[art]['blocks']
        levels = sorted({b[1] for b in blocks if b[0] == 'h'})
        if grouped:
            top = levels[0]
            if blocks and not (blocks[0][0] == 'h' and blocks[0][1] == top):
                sys.exit(art + ': text before its first entry')
            entries, cur = [], None
            for b in blocks:
                if b[0] == 'h' and b[1] == top:
                    cur = (b[2], [])
                    entries.append(cur)
                else:
                    cur[1].append(b)
            for title, body in entries:
                sub = sorted({b[1] for b in body if b[0] == 'h'})
                x = section(PREFIX + art + '-' + slug(title), title, body, sub[0] if sub else 99)
                ids = names.get(title, [])
                if dest == 'people' and len(ids) == 1:
                    x['about'] = ids
                gm[dest].append(x)
        else:
            x = section(PREFIX + art, p.arts[art]['title'], blocks, levels[0] if levels else 99)
            if art in PC_ABOUT:
                x['about'] = PC_ABOUT[art]
            gm[dest].append(x)
    seed = json.loads(SEED.read_text())
    seed['gm'] = gm
    SEED.write_text(json.dumps(seed, ensure_ascii=False, indent=1) + '\n')
    n = lambda l: sum(1 + len(x.get('sections') or []) for x in l)
    print('seed gm: overview %d, places %d, people %d, pc %d (sections + subsections); %d about a record'
          % (n(gm['overview']), n(gm['places']), n(gm['people']), n(gm['pc']),
             sum(1 for w in gm.values() for x in w if x.get('about'))))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'campaign/docs/veil.html')
