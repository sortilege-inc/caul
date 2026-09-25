#!/usr/bin/env python3
"""Session 28 (2026-09-24) into the chronicle: campaign/docs/chronicle/s28-between-places.html.

Written from the session transcript (caul-support/archive/transcriptions/2026-09-24 - Caul.txt) and
the Foundry actors in Actors › The World Above (their names and art), in the voice of the entries
before it. Nothing is added that the table did not establish; names the transcript mangles are
the campaign's own (Enola → Inola, Morphane/Multhane → Mollthain, Reese → Rhys, Omira → Ulmira).
Also wires the entry in: the chronicle index card + count, and S27's pager.

    python3 campaign/source/chronicle_s28.py
"""
import html
import os
import re

DOCS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
OUT = os.path.join(DOCS, "chronicle", "s28-between-places.html")

L = {
    "Sylvie": "#company/sylvie", "Draz": "#company/draz", "Heyou": "#company/heyou", "Jamal": "#company/jamal",
    "Pinchie": "#personae/pinchie", "Runt God": "#personae/runt-god", "Mollthain": "#personae/mollthain",
    "Inola": "#personae/inola-wending-keeper-of-splendor", "Rhys": "#personae/rhys", "Ygva": "#personae/ygva",
    "Ulmira": "#personae/ulmira", "Otheidas": "#personae/god-king-otheidas",
    "World Above": "#atlas/world-above", "Grithmaar Deep": "#atlas/grithmaar-deep",
    "Celsian Athenaeum": "#atlas/celsian-athenaeum", "Mollthain's Warden": "#personae/mollthains-warden",
}


def link(m):
    name = m.group(1)
    shown = m.group(2) or name
    return '<a class="ref" href="%s">%s</a>' % (L[name], html.escape(shown))


def p(text, cls=None):
    body = re.sub(r"\{([^}|]+)(?:\|([^}]+))?\}", link, html.escape(text, quote=False)).replace("&lt;em&gt;", "<em>").replace("&lt;/em&gt;", "</em>")
    return "<p%s>%s</p>" % (' class="%s"' % cls if cls else "", body)


EPIGRAPH = ("Heaven, if that was what it was, had teeth in its water. A god went past them without a glance, "
            "answering someone smaller. And out of the ribs of a dead thing, sticky with honey, came the friend "
            "Sylvie had killed, asking to be caught up.")

PARAS = [
    ("lede", "The fight at the lip of the moon had not waited for them. {Draz} was still in the grip of the leaping thing — the house-sized bush-baby with its sticky, spidery hands — and it squeezed until something in him cracked. He took the blow on his armour and answered it with a swarm of bright, biting things that filled the ground around him in a wide ring and set on the creature, leaving {Jamal}, {Heyou} and {Pinchie} alone and hiding the ground from everyone."),
    (None, "Under the swarm lay things they had not seen before: pale silk pouches the size of beach balls, trailing off in several directions. One deflated where the lights found it and seeped a thick, creamy fluid. {Jamal} came round behind the bush-baby, missed, pushed himself and swung again, and bit deep enough that it let {Draz} go — and took {Jamal} instead. Then a lowing came out of the wood, and a parasitized ox charged the swarm: a horned, shaggy beast with something striped and swollen fastened over its head. It hit {Draz} hard, and he only just rolled clear before it could trample him."),
    (None, "{Sylvie} was not there for any of it. She had heard singing from beyond the bridge, and followed it down a path that wound round a broad, flat lake. At the far end, at the water's edge, stood {Inola} — the Keeper of Splendor, last seen stepping through her door in the Astronomer's Spire — looking out at the water. She did not answer a wave. {Sylvie} called to her with the Voice of Dread, gentled, and the call went home: {Inola} turned, fixed on her, and said her name. Over most of her head sat a parasite like the one on the ox, its tendrils running into her mouth and nose. For a moment the call held her."),
    (None, "Then the thing she had been singing to came up out of the lake: a crocodile of impossible size, all mouths and teeth. {Sylvie} backed away along the path to the bridge, as far as she could go and still see."),
    (None, "At the fight, {Heyou} wanted a clear line at the silk pouches and shouted for {Draz} to get down, and {Draz} was out of the way before the words were finished. {Heyou}'s shot went wide, and the pouches answered him: they shot out adhesive tendrils and caught him from three sides at once, pulling him in every direction. It very nearly finished him, and he let it — being hurt is what lets him strike back hardest. The bush-baby, meanwhile, squeezed {Jamal} until he felt it in every bone. Somewhere in the middle of it {Draz} heard a sound he could not at first believe — faint, far off, an echo of an echo: a whine like a dog left alone when its owner goes out. It was the {Runt God}, crying."),
    (None, "By the lake, {Inola} started back up the stone steps toward {Sylvie}. The beast snapped at the place she had been, turned to dive, and swept its tail round; it took her off the steps and into the water, and both of them went under. Neither came up."),
    (None, "{Jamal} could not break the bush-baby's hold alone. Its skin sweated something acid through every pore, and it burned him. {Pinchie} came in on its arms. With the crab dragging at them {Jamal} tore himself free — and {Pinchie}, much the larger of the two, took the creature's two long arms in his claws and pulled them outward until they came away from its body. Then he ate one."),
    (None, "Alone at the edge of the lake, {Sylvie} set herself to learn the lay of this place — who lived in it, what its rules were — and worked the Scarred Earth into it, having beaten her head so long against the wall of the moon. Nothing more stirred in the water. What came instead were voices, and they were coming from Speaker: fragments of different conversations, every speaker plainly different and every one in the same flat voice, like something reading a script aloud. <em>A tree grows out of it. They have been wearing my eyes. The terms are void. The little one is crying. The names are being eaten slowly.</em>"),
    (None, "{Heyou} put a trick shot into the parasite on the ox's head and let his arrows cascade, and they tore through it and through every pouch left on the ground. The ox went for {Heyou} in its pain, missed, and struck {Pinchie}. {Heyou} and {Jamal} fell on it together, and it nearly went down; {Pinchie} charged in a rage and fixed on the wrong beast — the one he had already killed."),
    (None, "Then a rumbling came from far off, and something moved through the sky toward them: three tall, winged forms standing together like obelisks, like a statue, taller than anything they had seen, and alive. {Jamal} knew it. The great guardian they had broken in {Grithmaar Deep|Grithmaar Deep} — {Mollthain's Warden|the warden} whose Splendor {Sylvie} drank — had belonged to {Mollthain}, whose sign is three standing stones. This was {Mollthain}. {Jamal} had worshipped that god once, before his village was slaughtered; he was not on the best of terms with it. {Sylvie} understood the rest: the calls from below, the {Runt God}'s crying, and {Mollthain} going toward them."),
    (None, "The ox charged {Draz} once more and overshot, and presented him the broadest target it had. He took the shot with all the advantage in the world, and it went down."),
    (None, "{Mollthain} did not come for them. It passed over the hill nearby and went down, through the hole in the sky, into the world below. {Sylvie} looked at the size of it and wondered what they had just let loose on the world they came from. Somebody observed that the gods, on the whole, were not very good at it."),
    (None, "They rested. {Sylvie} went back to her books and found the waterfall she had been chasing: its headwaters had been a holy site of {Ulmira}, said to heal and restore, and very likely still did — the same falls she had seen in the painting from the library and, from the lip of the moon, with her own eyes. Her meditations gave her more. Splendor and Umbra, she began to see, behave like acid and alkali. She holds both, walled apart inside herself; brought together they can neutralize one another; but mostly they meet at their extremes. A sacred pyre is so strongly one that the traces of the other drifting in on the mist are burned off before they arrive."),
    (None, "The place itself pressed in on all of them. It was stronger and more alive than anywhere they had ever been — feral and vibrant, and young: a younger world than theirs, at an earlier stage of itself, running on far more power than their own had ever had. It fed them. Every one of them came away from it stronger — {Pinchie} most visibly, grown to twice his size. {Sylvie} asked whether she could hold more of the Splendor that hangs loose in the air here. The question, it seemed, was less whether she could than how much she wanted, and what she would give up to keep it. Her books added one thing more: that the God-King {Otheidas} was no king of the gods but the latecomer among them, a mortal who made himself a god through rituals built on many empowered objects."),
    (None, "Then she told the others what she had seen and heard. {Mollthain} was {Mollthain}; {Jamal} said so too. There was a hole down into the world they came from, and that was where the god had gone. When she described the crying that everything seemed to be answering, {Draz} knew it for the {Runt God}. Speaker, all through the rest, had kept on letting fall its fragments, never with any context, and {Heyou} made the point plainly: if Speaker was still picking them up, the gods still existed, and they were talking about recent things. They were paying attention. The gods were not gone."),
    (None, "When she came to the parasite on {Inola}'s face, {Draz} went straight to the dead ox, cut the thing off its head, and came back to jiggle it in front of her face. {Sylvie} blew him backward with a push of force. The parasite flew out of his hand, turned over in the air, and landed on {Jamal}'s face. {Draz} got to him and knocked it off, and did not, quite, slap him."),
    (None, "The crying stayed with {Draz}. It had not sounded like danger to him. It sounded like longing — <em>where are you; why did you leave me</em> — and he could not see why anything else should answer it. He felt a little jealous that something else was going; the {Runt God} was the closest bond he had ever made. Somewhere very deep down he was also glad that there were things of its kind that cared for it."),
    (None, "They spoke, that evening, about what they were hoping for now. {Heyou} came out of the Syndicate and still cares for what he left behind; saving himself and leaving everyone else is not who he is. He wants a way to save everyone — or {Ygva}'s plan of calling the gods back and keeping them — and {Sylvie}'s acid and alkali gave him a new hope that with enough of the gods back, the world might keep going. {Draz} lives in the moment; but if he were sent back to the world he grew up in while the {Runt God} went back up to this one, it would crush him. {Jamal} lost his village and drank after it, and found something like a family in this company; he drinks less now, though he only says so when he's drunk. The problem is larger than any of them thought, and he is in it now; there was a time he would not have minded falling, and that time seems to have passed. {Sylvie} has watched one certainty after another turn out wrong. Now she wonders whether the world needs saving at all — whether it is simply used up, whether that is why the gods left, and whether gods that abandoned everyone are gods anyone should want back."),
    (None, "One answer she did have. Walking back from the lake she had found a small book tucked under a bush — a book from the Athenaeum's library — and in it the working called Plane Gate, which opens a way to a place on another plane one has been to before. It was how {Inola} had come up. She had found it in the chaos of the vaults, seen her chance and taken it, and made her door at the top of the Astronomer's Spire, where the great telescope let her see the plane she meant to reach. {Sylvie} learned it. No one had gone into the water after {Inola}. She was dead."),
    (None, "Then {Sylvie} tried something she had been carrying for a long time. She poured some of the loose Splendor into an old Stoneweaver crystal and set out, through the kind of working that carries her to others while she sleeps, to reach {Rhys} — the best friend of her youth, the cleverest sorcerer she ever knew, and a man she had killed. The working would go through only if she gave something up to it: the power of damnation {Ygva} had given her, the piece of the Umbra she kept where her heart had been. She gave it up. The working took hours, dredging up every memory she had of him."),
    (None, "While she worked, {Draz} took a long tendon from the dead beast and strung a finer bow with it, and {Jamal} and {Pinchie} had a moment of their own. Then, out of the chest cavity of the dead sphinx, covered in honey, {Rhys} walked out, and all of them saw him."),
    (None, "{Sylvie} had missed him. She had hoped, at best, for a dream and a conversation; instead he came across the clearing to her with disbelief on his face and took her hands, as if he did not believe she was real. His hands were sticky. They were solid. She slid two fingers past his glove to the skin of his wrist: not warm, but not the cold of a corpse. <em>I knew you would make it up here,</em> he said. <em>It's so good to see you.</em> She asked where he had been since she saw him last. He looked at her strangely. <em>I've been between places. How did you find me?</em> She had done some work, she said; she wanted to do what they used to do — solve problems, think things through. <em>You were great at that.</em> He sat down cross-legged in the grass and said, <em>Catch me up to speed. What are we considering?</em>"),
    (None, "{Draz} did not hear much of it. The smell of the honey had him, and he went into the sphinx's chest after it as if in a trance; in the Wilds honey had been the rarest of treats, and there was more of it here than he could stand. {Heyou} stood behind {Rhys} with his dagger up, unsure — the last time they had met this man they had fought him. {Jamal} only shrugged: {Sylvie} was involved, so of course the dead man was back. {Rhys} nodded at him the way a man nods at a younger brother, and patted the back of his hand."),
    (None, "It was a whole story to tell, and a long rest to tell it in. {Draz} did not want to wait. He had something now that sets him on the shortest road to wherever he means to go, and he meant to go back to the {Runt God}; if the rest of them wanted to stay, he would go on ahead. {Sylvie} told him it was a terrible idea and would not send him. He looked her in the eye, cold for perhaps the first time, and asked whether she was sure she wanted him here with her the whole time. The thought came to him then, unbidden, that if anything happened to the {Runt God}, he would never be able to forgive her."),
    (None, "They made camp. {Draz} took a watch and spent the rest of it relentlessly needling {Sylvie}; {Jamal} and {Heyou} took the other, and nothing came for them in the night. {Sylvie} caught {Rhys} up, fairly thoroughly, and asked him what she most needed to know. If they left this plane, could he come with them? He believed so; and yes, he could bring them back here. And did he hold any hard feelings over the mountain — the first time, or the second? He did not know there had been a second. He had not known she had killed him, and she watched him take it in; then he patted himself down and said, <em>Well — you appear to have remedied that mistake. We should probably talk about all of that sometime. For now, I think we're good.</em>"),
    (None, "She told him she only wanted to think it through with him: what the right path was now, for them and for the world. She had books, if he wanted to read what she had been reading. {Rhys} went down to the water to wash the honey off his hands, came back, and began to read."),
]

ENTITIES = {
    "Characters": [
        "{Sylvie}", "{Draz}", "{Heyou}", "{Jamal}", "{Pinchie} (grown; tore the bush-baby's arms off)", "Speaker",
        "{Inola} (parasitized; dragged into the lake; dead)", "{Rhys} (returned from between places)",
        "{Mollthain} (passed through the moon into the world below)", "{Runt God} (heard crying)",
        "{Mollthain's Warden} (recalled)", "{Ygva} (her power of damnation, given up)", "{Ulmira} (the waterfall's god)",
        "{Otheidas} (in Sylvie's books)",
    ],
    "Creatures of the World Above": [
        "The leaping predator, the bush-baby (Foundry: Jumper) — killed by Pinchie",
        "Larvae, the silk pouches — destroyed by the swarm and Heyou's arrows",
        "The parasitized ox (Foundry: Pupae) — killed by Draz",
        "The parasite on Inola",
        "The thing in the lake, all mouths and teeth (Foundry: Cipactli)",
        "The dead sphinx, full of honey (Foundry: Sphinx)",
    ],
    "Items": [
        "Plane Gate (a working, from a library book Inola left under a bush)", "Stoneweaver crystal (charged with Splendor)",
        "The power of damnation (given up for Rhys)", "Draz's bow, restrung with the beast's tendon",
        "The hand-sling (passed from Draz to Heyou)", "The ox's parasite",
    ],
    "Locations": [
        "{World Above}", "The lake beyond the bridge", "The hole in the sky down to the world below",
        "The waterfall — its headwaters a holy site of Ulmira, said to heal and restore",
        "The Astronomer's Spire, at the {Celsian Athenaeum} (recalled)", "{Grithmaar Deep} (recalled)",
    ],
}


def li(t):
    return "<li>%s</li>" % re.sub(r"<p>|</p>", "", p(t))


def main():
    chron = [p(EPIGRAPH, "epigraph")] + [p(t, c) for c, t in PARAS]
    ent = ['<h2>Entities Referenced in Session</h2>']
    for h, items in ENTITIES.items():
        ent.append("<h3>%s</h3>\n<ul>\n%s\n</ul>" % (h, "\n".join(li(x) for x in items)))
    doc = (
        '<header class="masthead"><div class="eyebrow">Session</div>\n'
        '<h1>Between Places</h1><p class="meta">Session 28<span class="sep">·</span>2026-09-24</p></header>\n'
        '<div class="col"><article class="panel">\n'
        '<div class="chron-tabs"><input type="radio" id="ct-chr" name="ct" checked><input type="radio" id="ct-ent" name="ct">'
        '<div class="tab-labels"><label for="ct-chr">Chronicle</label><label for="ct-ent">Entities</label></div>'
        '<div class="tab-panel tp-chr">' + "\n".join(chron) + '\n</div><div class="tab-panel tp-ent">' + "\n".join(ent) +
        '\n</div></div>\n'
        '<div class="pager"><a href="#chronicle/s27-the-world-above"><span class="dir">‹ Earlier</span>The World Above</a></div>\n'
        '</article></div>\n')
    open(OUT, "w", encoding="utf-8").write(doc)

    # S27's pager gains its "Later" link
    s27 = os.path.join(DOCS, "chronicle", "s27-the-world-above.html")
    t = open(s27, encoding="utf-8").read()
    later = '<a class="nx" href="#chronicle/s28-between-places"><span class="dir">Later ›</span>Between Places</a>'
    if later not in t:
        t = t.replace('Brathis Burns</a></div>', 'Brathis Burns</a>' + later + '</div>', 1)
        open(s27, "w", encoding="utf-8").write(t)

    # the index: the S28 card first, the count, and the one excerpt the rename missed
    idx = os.path.join(DOCS, "chronicle", "index.html")
    t = open(idx, encoding="utf-8").read()
    excerpt = EPIGRAPH[:150].rsplit(" ", 1)[0] + "…"
    card = ('<a id="s28" href="#chronicle/s28-between-places"><span class="no">28</span><span class="body">'
            '<span class="dt">2026-09-24</span><h3>Between Places</h3><p>Between Places - Session 28 - 2026-09-24 '
            + html.escape(excerpt) + '</p></span></a>')
    if 'id="s28"' not in t:
        t = t.replace('<div class="chron"><a id="s27"', '<div class="chron">' + card + '<a id="s27"', 1)
    t = t.replace("Twenty-seven sessions", "Twenty-eight sessions")
    t = t.replace("does not return all who go in. The Enduring Lesser…", "does not return all who go in. Caul left…")
    open(idx, "w", encoding="utf-8").write(t)

    # proof
    out = open(OUT, encoding="utf-8").read()
    unresolved = re.findall(r"\{[^}]+\}", out)
    idx_t = open(idx, encoding="utf-8").read()
    ok = (not unresolved and 'id="s28"' in idx_t and "Twenty-eight" in idx_t and "Enduring Lesser" not in idx_t
          and later in open(s27, encoding="utf-8").read())
    text = re.sub(r"<[^>]+>", " ", out)
    print("chronicle_s28: %d paragraphs, %d words; links %d; index card %s; S27 pager %s; %s" % (
        len(chron), len(text.split()), out.count('class="ref"'), 'id="s28"' in idx_t,
        later in open(s27, encoding="utf-8").read(), "OK" if ok else "FAILED %s" % unresolved))


if __name__ == "__main__":
    main()
