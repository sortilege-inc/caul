#!/usr/bin/env python3
"""Session 28's updates to the pages it touched (campaign/docs/…), from the same transcript as the
chronicle entry (chronicle_s28.py). Each update is a block marked <!--s28--> … <!--/s28--> added
before the page's closing </article>, so a re-run replaces it rather than stacking a copy. Also:
Heyou's portrait becomes his new art (heyou-ghost, on Foundry), Rhys's stale "status unspecified"
line goes, and Mollthain gets the new art as its portrait (a local copy — it is not on Foundry)
with the old three-stones image kept as its sign.

    python3 campaign/source/pages_s28.py
"""
import html
import os
import re

CAMPAIGN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(CAMPAIGN, "docs")
FOUNDRY = "https://foundry.sortilege.online/sortilege/enduring-lesser-lights/"
S28 = '<a class="ref" href="#chronicle/s28-between-places">Session 28</a>'

L = {"Sylvie": "#company/sylvie", "Draz": "#company/draz", "Heyou": "#company/heyou", "Jamal": "#company/jamal",
     "Pinchie": "#personae/pinchie", "Runt God": "#personae/runt-god", "Mollthain": "#personae/mollthain",
     "Inola": "#personae/inola-wending-keeper-of-splendor", "Rhys": "#personae/rhys", "Ygva": "#personae/ygva",
     "Ulmira": "#personae/ulmira", "Otheidas": "#personae/god-king-otheidas", "World Above": "#atlas/world-above",
     "Celsian Athenaeum": "#atlas/celsian-athenaeum", "Grithmaar Deep": "#atlas/grithmaar-deep"}


def p(text):
    body = re.sub(r"\{([^}]+)\}", lambda m: '<a class="ref" href="%s">%s</a>' % (L[m.group(1)], m.group(1)),
                  html.escape(text, quote=False)).replace("[S28]", S28)
    body = body.replace("&lt;em&gt;", "<em>").replace("&lt;/em&gt;", "</em>")
    return "<p>%s</p>" % body


def fig(src, name, note=""):
    return ('<figure><img src="%s" alt="%s" loading="lazy" onerror="this.closest(\'figure\').style.display=\'none\'">'
            '<figcaption>%s%s</figcaption></figure>' % (src, html.escape(name), html.escape(name),
                                                          ('<small>' + html.escape(note) + '</small>') if note else ""))


BLOCKS = {
    "personae/inola-wending-keeper-of-splendor": [
        "[S28] showed how she left. In the chaos of the Athenaeum's vaults she had found a book from its library holding the working Plane Gate, which opens a way to a place on another plane one has been to before; she saw her chance and took it, and made her door at the top of the Astronomer's Spire, where the great telescope let her see the plane she meant to reach.",
        "It brought her to the {World Above}. {Sylvie} found her at the edge of a lake there, singing to something in the water, with a parasite fastened over most of her head and its tendrils in her mouth and nose. Called with the Voice of Dread, she turned and said {Sylvie}'s name. As she started toward her up the stone steps, the thing in the lake — a crocodile of impossible size, all mouths and teeth — swept her off them with its tail and took her under. She did not come up, and no one went in after her. Inola is dead. The book of Plane Gate lay under a bush near the lake; {Sylvie} learned it.",
    ],
    "personae/rhys": [
        "In [S28], in the {World Above}, {Sylvie} brought him back. She charged an old Stoneweaver crystal with the loose Splendor there and reached for him as she reaches for others in sleep; the working went through only when she gave up the power of damnation {Ygva} had given her. Rhys walked out of the chest of a dead sphinx, covered in honey, and took her hands as if he did not believe she was real. He is solid; not warm, but not a corpse. <em>I knew you would make it up here,</em> he told her. Where had he been? <em>Between places.</em>",
        "He did not know that {Sylvie} had killed him, and took the news calmly: <em>you appear to have remedied that mistake. We should probably talk about all of that sometime.</em> He believes he can leave the World Above with the company and bring them back to it, and will come with them. For now he travels with them and is reading {Sylvie}'s books, to help her think through the right path forward for them and for the world.",
    ],
    "personae/mollthain": [
        '<figure class="portrait-frame"><img src="campaign/dramatis-personae/img/mollthain.webp" alt="The sign of Mollthain" loading="lazy"><figcaption>The sign of Mollthain: three standing stones</figcaption></figure>',
        "In [S28] the company saw Mollthain itself: three tall winged forms standing together like obelisks, moving through the sky of the {World Above}, far larger than anything they had met. {Jamal} knew it — the warden they broke in {Grithmaar Deep} was Mollthain's, and his people had worshipped it before his village was destroyed. It did not come for them. It passed over a nearby hill and went down through the hole in the sky into the world below — toward, {Sylvie} judged, the crying of the {Runt God}.",
    ],
    "personae/runt-god": [
        "Since Session 25 it has stayed at the {Celsian Athenaeum}'s pyre with Ash-begets-Tide, as the fire's leash and some of its fuel. In [S28], in the {World Above}, {Draz} heard it crying — faint, far off, an echo of an echo, like a dog left alone when its owner goes out; to him it sounded like longing. {Mollthain}, the Rampart, went down through the hole in the sky soon after; {Sylvie} judged it was going toward the crying.",
    ],
    "personae/pinchie": [
        "In [S28], in the {World Above}, Pinchie helped {Jamal} break the grip of the leaping bush-baby, then took the creature's two long arms in his claws and pulled them out of its body, and ate one. The place grew him: he came out of it twice his former size.",
    ],
    "company/sylvie": [
        "In [S28] Sylvie followed singing to a lake and found {Inola}, parasitized, and watched the thing in the water take her. From her books she learned that the waterfall she had been chasing rose from a holy site of {Ulmira}, said to heal and restore, and that the God-King {Otheidas} was a latecomer who made himself a god through rituals built on many empowered objects. Her meditations showed her Splendor and Umbra working like acid and alkali, held apart inside her. She learned Plane Gate from {Inola}'s abandoned book. And she gave up the power of damnation {Ygva} gave her to bring {Rhys} back from between places. She has begun to wonder whether the world needs saving at all.",
    ],
    "company/draz": [
        "In [S28] Draz heard the {Runt God} crying from the world below, and understood it as longing rather than danger; he was jealous when {Mollthain} went to answer it, and glad, somewhere deep down, that something of its kind cared. He strung a finer bow with a tendon from a dead beast, found the honey in a dead sphinx irresistible, and wanted to go back to the {Runt God} at once. When {Sylvie} would not send him, the thought came to him that if anything happened to it, he would never forgive her.",
    ],
    "company/heyou": [
        "In [S28] Heyou took a hit from the silk-pouch larvae that nearly finished him, and cleared them with a cascade of arrows through the parasite on the ox's head. Listening to Speaker's fragments, he drew the conclusion out loud: the gods are still there, and still paying attention. He still wants a way to save everyone, not only themselves — or {Ygva}'s plan of calling the gods back and keeping them.",
    ],
    "company/jamal": [
        "In [S28] Jamal was caught and squeezed by the leaping bush-baby until {Pinchie} helped him tear free. He recognised {Mollthain} passing through the sky — the god his people worshipped before his village was destroyed. He has found something like family in this company, drinks less than he did, and is less ready to die than he once was.",
    ],
}

# the World Above: what the company now knows, and what they met there (art from Foundry's World Above folder)
WORLD_ABOVE = [
    "Reached through the rupture the company had always called the moon ({S27}). Standing at its lip you can look down through it and see the whole world below. There is no Umbra there; Splendor hangs loose in the air like light with no sun to cast it. It is a younger world than theirs, at an earlier stage of itself, running on far more power — and everything in it is vast and dangerous. Being there made the company stronger ([S28]).",
    "{Inola} came here through Plane Gate and died here, taken into a lake. {Mollthain} passed through it on its way down to the world below.",
]
CREATURES = [
    ("adversaries/jumper.png", "The leaping predator", "the bush-baby; killed by Pinchie"),
    ("adversaries/larvae.png", "Larvae", "silk pouches on the ground"),
    ("adversaries/pupae1.png", "The parasitized ox", "killed by Draz"),
    ("adversaries/cipactli.png", "The thing in the lake", "took Inola"),
    ("adversaries/sphinx.png", "The sphinx", "found dead, full of honey"),
]


def put_block(path, paras_html):
    f = os.path.join(DOCS, path + ".html")
    t = open(f, encoding="utf-8").read()
    t = re.sub(r"<!--s28-->.*?<!--/s28-->\n?", "", t, flags=re.S)
    block = "<!--s28-->" + "\n".join(paras_html) + "<!--/s28-->\n"
    i = t.rindex("</article>")
    t = t[:i] + block + t[i:]
    open(f, "w", encoding="utf-8").write(t)


def main():
    for path, paras in BLOCKS.items():
        put_block(path, [x if x.startswith("<") else p(x) for x in paras])
    # Rhys: the stale status line
    f = os.path.join(DOCS, "personae/rhys.html")
    t = open(f, encoding="utf-8").read().replace("<p>Rhys&#39;s current status and actions beyond the initial conflict are unspecified.</p>\n", "")
    open(f, "w", encoding="utf-8").write(t)
    # the World Above
    wa = [p(x.replace("{S27}", "S27")).replace("S27", '<a class="ref" href="#chronicle/s27-the-world-above">Session 27</a>', 1) for x in WORLD_ABOVE]
    wa.append("<h3>What lives there</h3>")
    wa.append('<div class="creature-grid">' + "".join(fig(FOUNDRY + src, n, note) for src, n, note in CREATURES) + "</div>")
    put_block("atlas/world-above", wa)
    # Heyou's portrait → his new art
    f = os.path.join(DOCS, "company/heyou.html")
    t = open(f, encoding="utf-8").read()
    t = re.sub(r'(<figure class="portrait-frame"><img src=")[^"]*(" alt="Heyou")', r"\1" + FOUNDRY + r'portraits/heyou-ghost.png\2', t, count=1)
    open(f, "w", encoding="utf-8").write(t)
    # Mollthain: the new art as portrait, the three stones kept as its sign
    img_dir = os.path.join(CAMPAIGN, "dramatis-personae", "img")
    src = os.path.join(os.path.dirname(os.path.dirname(CAMPAIGN)), "caul-support", "archive", "art", "adversaries", "mollthain.png")
    dst = os.path.join(img_dir, "mollthain-descending.webp")
    if os.path.exists(src) and not os.path.exists(dst):
        from PIL import Image
        im = Image.open(src).convert("RGB")
        im.thumbnail((900, 900))
        im.save(dst, "WEBP", quality=82)
    f = os.path.join(DOCS, "personae/mollthain.html")
    t = open(f, encoding="utf-8").read()
    if "mollthain-descending.webp" not in t:
        t = t.replace('<figure class="portrait-frame"><img src="campaign/dramatis-personae/img/mollthain.webp" alt="Mollthain"',
                      '<figure class="portrait-frame"><img src="campaign/dramatis-personae/img/mollthain-descending.webp" alt="Mollthain"', 1)
        open(f, "w", encoding="utf-8").write(t)

    # proof
    bad = []
    for path in list(BLOCKS) + ["atlas/world-above"]:
        t = open(os.path.join(DOCS, path + ".html"), encoding="utf-8").read()
        if t.count("<!--s28-->") != 1:
            bad.append(path + " block count %d" % t.count("<!--s28-->"))
        if re.search(r"\{[A-Z][^}]*\}", t):
            bad.append(path + " unresolved link")
    if "heyou-ghost.png" not in open(os.path.join(DOCS, "company/heyou.html")).read():
        bad.append("heyou portrait")
    if not os.path.exists(dst):
        bad.append("mollthain art")
    if "unspecified" in open(os.path.join(DOCS, "personae/rhys.html")).read():
        bad.append("rhys stale line")
    print("pages_s28: %d pages updated; %s" % (len(BLOCKS) + 1, "OK" if not bad else "FAILED: " + "; ".join(bad)))


if __name__ == "__main__":
    main()
