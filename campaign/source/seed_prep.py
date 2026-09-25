#!/usr/bin/env python3
"""Session prep into the campaign pack (campaign/pack/seed.json), by id.

seed.json is the source of the GM's material now (absorb_veil.py moved the veil into it; the
threads.html build_seed.py read is gone, so build_seed.py no longer runs — do not revive it, it
would drop the `gm` key). This script upserts the prep entries below by id and leaves everything
else in the pack as it is. The GM's campaign picks up any id it has never been offered on the next
load of the GM page (engine/state.js seed): new beats land in the existing Session 28 card, the
Session 29 card after it, the radio in Overview, the Falls in Places. Nothing the GM has edited is
overwritten.

The content is the GM's Session 28/29 prep from the brainstorm of 2026-09-24. Tags: [SET 24 Sep]
= the GM's decision; [MINE] = a suggestion not yet adopted; [OPEN] = undecided; [NOTE] = context
from the chronicle.

    python3 campaign/source/seed_prep.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(os.path.dirname(HERE), "pack", "seed.json")


def beat(id_, title, text, kind="note", collapsed=True):
    b = {"id": id_, "kind": kind, "title": title, "text": text.strip(), "collapsed": collapsed}
    if kind == "encounter":
        b["npcs"] = []
    return b


S28_BEATS = [
    beat("caul-s28-b01", "Running order", """
[SET 24 Sep] Session 28 finishes the World Above and ends on Mollthain's leap. The rescue in the Amber Reach is Session 29.

- Open mid-fight at the lip of the moon. The fight is theirs to finish.
- Speaker starts picking up the gods' voices. Drop fragments through the session (the radio beat).
- They find Inola in the trees, a pupa feeding on her face.
- The Runt God cries out. Draz feels it first; Mollthain's voice comes over Speaker.
- The great cat stops watching and leaps down through the moon toward the Amber Reach.
- Close on the company at the lip, the Reach below. Optional stop at Ulmira's Falls first (the last beat).
""", collapsed=False),

    beat("caul-s28-b02", "Where they stand", """
[NOTE] From the S27 chronicle. They are in the World Above at the lip of the moon, the rupture the Runt God came through. The world below is visible through it, with Talis still burning. Pinchie and Speaker are with them.

**Unstuck from reality** [SET]: every Hope spent and every Armor, HP or Stress marked counts double until they fix their footing in this world.

- Draz: senses run together; he can't tell where a body ends and the air begins.
- Heyou: turned solid and heavy, as if in a lead suit.
- Jamal: red heat-sight (he saw the leech-things in the trees and a larger shape deeper in) and a rising fury.
- Sylvie: the Splendor back in her feels unearned; a strong pull forward and up, stronger than the pull home.

**Sylvie's sight**: from the lip she can see the world below clearly enough to set a door anywhere on it she can hold in her mind. Getting home is not the problem.

**PCs** [OPEN] Foundry snapshot of 12 Sep, two days after S27; check against the end of the session. The doubling makes Jamal's single Hope thin.

- Draz: 2 HP marked · Stress 3/6 · Hope 2 · last seen in his Legendary Beast shape (a Kodiak)
- Heyou: 0 HP marked · Stress 1/6 · Hope 1
- Jamal: 3 of 8 HP marked · Stress 3/6 · Hope 1
- Sylvie: 0 HP marked · Stress 0/6 · Hope 6

**Carried**: the heart Heyou holds (it draws the motes; a bud weeps Splendor essence), the vial of essence Draz kept, the suppression amulet Jamal took back from Retta, the vault map (the waterfall and Amber Reach leads), the expedition log (Heyou).
"""),

    beat("caul-s28-b03", "The fight, unfinished", """
What is still in it at the end of S27:

- **The leaping predator** (a house-sized bush-baby): tail sheared off, one eye blinded by Heyou's fire-fletched shot, taken past its Severe threshold by Jamal and Heyou's joined strike, marked for death by Sylvie. Still up.
- **Leech-larvae** high in the trees. Jamal saw them with his heat-sight.
- **The great cat**, big enough to carry the bush-baby like a mouse, watching from the trees. It has not joined. [MINE] It is Mollthain; see the wail beat.
- **The ambush-ray** fled skyward from Sylvie's Umbra. It could come back.

None of these has a book stat block. Add stand-ins here if you want the per-copy trackers. The doubling applies to everything they mark or spend.
""", kind="encounter"),

    beat("caul-s28-b04", "Speaker, the radio: fragments for this session", """
[SET 24 Sep] Speaker picks up fragments of the gods talking among themselves, not meant for the PCs. The voices and the reception rules are in Overview › Speaker, the radio.

[MINE] Fragments for this session. Drop them in when the table goes quiet, or right after a relevant beat:

- **Mollthain**: "The little one is crying." … "I will hold it. Nothing will reach it." (with the wail)
- **Ossa**: "He'll flatten half the Reach." **Tlellic**: "He did the same at the Deep." (Grithmaar Deep, Jamal's village)
- **Caranthalis**: "They cut down my tree to take a branch. As if the branch were the gift."
- **Ulmira**: "My waters still run. No one comes to drink." (the hook for the Falls)
- **Kreth**: "Nearly have it. Don't wait up."
- **Tlellic**: "One of the small bright ones climbed up. The grubs found her." (Inola, before they find her)
- **Brathis**: "The dark-hearted one is ripening." (Sylvie)
- Someone: "The thief's blood is up here again." (Draz; Otheidas himself is never on the channel)

Hold back "…who is listening?" for a later session.
"""),

    beat("caul-s28-b05", "Inola and the pupa", """
[SET 24 Sep] Inola came up. She found a way to ascend and took it: the thing she took from the vaults in S23, which she used to open her door at the Astronomer's Spire in S24. One of the pupae is on her face, feeding on her.

- Where: in the trees where the leech-larvae wait.
- Draz's sight: the pupa is rooted in her, and her white-hot Splendor is draining into it.
- She preached that only the Elect ascend. Up here the Elect are food.
- [MINE] The cure is the Umbra. The World Above has none, and its creatures recoil from it (the ambush-ray fled Sylvie's Dread in S27). Only Sylvie can pull it off her. Ulmira's water won't help; the pupa isn't Umbral.
- [MINE] Her door only went one way. She needs Sylvie to get home.
- Her ask: the Athenaeum is her home. When Mollthain goes down, she begs them to follow.

[OPEN] What the pupa becomes if it is left on her. What exactly she took from the vaults.

[NOTE] Draz ate a slab of leech-grub in S27. Nothing has to come of it.
"""),

    beat("caul-s28-b06", "The wail and the leap", """
[SET 24 Sep] The Runt God cries out, wanting them back, and Mollthain answers.

- The Runt God is at the Celsian Athenaeum's pyre in the Amber Reach, where it was left with Ash-begets-Tide in S25 as the pyre's leash and fuel.
- Draz hears it first, through his bond.
- [MINE] The great cat is Mollthain. Valghast, the winged lion, is tied to Mollthain, and the sphinx carcass is lion-bodied. It stops watching and goes past them, down through the moon.
- Mollthain's idea of rescue is a wall around the little one. At a god's size that tears the compound apart: Session 29.
- Jamal: this is the god whose creature destroyed his village in Grithmaar Deep.

End on the leap, or on Sylvie opening a door to the Reach.
"""),

    beat("caul-s28-b07", "Optional: Ulmira's Falls before going down", """
[MINE] If they want an edge before the rescue, Sylvie has the lead: the high-country waterfall from the vault map. Its water destroys Umbral things on contact, which matters if the Athenaeum's pyre fails and the dead rise. Details in Places › Ulmira's Falls. Skip it if the table wants to go straight down.
"""),
]

S29 = {
    "id": "caul-s29-rescue",
    "title": "Session 29 — Rescue in the Amber Reach",
    "session": "Session 29",
    "summary": "Mollthain has come down on the Celsian Athenaeum to shelter the Runt God. Get the people out, keep the pyre alive, turn the god aside.",
    "text": "[SET 24 Sep] The plan for Session 29. Settle the details after Session 28 is played.",
    "played": False,
    "beats": [
        beat("caul-s29-b01", "The situation", """
The Athenaeum was already weak. The scepter that fed its pyre was pulled in S21, the pyre-tower fell and the pyre sputters in the plaza, and the Runt God has been its leash and its fuel since.

Mollthain arrives to shelter the Runt God, and the Rampart shelters by walling in. Walls come up out of the Reach around the little god and cut the compound apart.
""", collapsed=False),
        beat("caul-s29-b02", "Who needs saving", """
- Dagga
- Ash-begets-Tide, the priest of Ossa-in-absence who kept the Runt God company
- The remaining Celsians, students, and anyone sheltering in the compound
- The Runt God itself, depending on what the party wants
- [OPEN] Draz's father and twin siblings went west to the Amber Reach. Are they here?
- Inola has a stake: it is her home.
"""),
        beat("caul-s29-b03", "Countdowns", """
[MINE]

- **The Rampart**: Mollthain's walls closing around the Runt God. When it fills, the compound is split and whoever is on the wrong side is cut off.
- **The pyre**: if the Runt God is walled off or taken, the pyre loses its fuel. When it fills, the Umbra comes in and the dead start to rise.
- **The Stacks**: the world's salvaged knowledge lies in the walls' path. Saving the books or saving the people.

[OPEN] Sizes. Speaker's reception of Mollthain gets louder as he closes, and can stand in for the Rampart clock.
"""),
        beat("caul-s29-b04", "Mollthain", """
He can't be fought. Run him as an Environment and a countdown, not an adversary.

- Wants: to hold the little one safe. Nothing else.
- Voice: slow, few words, parental; walls and holding.
- Ways to turn him: Draz's bond with the Runt God; Jamal's grievance; Speaker, if someone finds a way to talk back; the Runt God quieting.

[OPEN] Write him up as a Daggerheart Environment.
"""),
        beat("caul-s29-b06", "Rhys", """
[NOTE] Last spoke with the company in S18 (12 Mar), by the fire during the long rest after the eldritch thing went into the ground. Kaelyn was dead. At the start of S19 Sylvie told him to f*** off and die and blinked the company to the Athenaeum, leaving him on the mountain. There was no reply.

- Undead. A fellow Stoneweaver from the Sundering, sent up to the World Above with the Runt God when Sylvie thrust the Heart of Stone skyward.
- He and Kaelyn drew their power from it up there. Kaelyn held its leash; Rhys says he doesn't have the rapport.
- Last seen wanting to find and wrangle the Runt God, and ascend again.

**In his own words** [NOTE] From the S18 transcript, lightly tidied.

On following Kaelyn:

> "Honestly, I didn't know what his intent was. I assumed he had cause, and so I followed blindly, I admit."

To Sylvie, about the Sundering:

> "What you did in response was so powerful, and transformative. I don't know how you did it. I would be very interested to learn about your arts and your power, because whatever you had back then dwarfed ours."

The Runt God:

> "We've been blessed by being in the world above. And we've been blessed again, because unbeknownst, I think, to us all, the Heart of Stone was in fact the Runt God, that had been too small and too weak to abandon this world with the others — until you thrust it up above. We've been drawing power from it, developing our arts with its power."

> "We believe that the other gods are preparing for their next Ascent, but we have no way of ascending with them. But perhaps with you, we could ascend again."

The argument:

> "Do you not understand that your world is a caul? Like afterbirth. You've been discarded. If you want to survive, we need to keep ascending with the gods."

> **Sylvie:** "This was your world too, right, Rhys?"
> **Rhys:** "It was. Past tense."

> "Look, I'm not arguing that I deserve it, or that you don't deserve it. But if you want a continued and flourishing existence, I suggest we get back up to the upper."

> "Well, for one, it's not plagued by the Umbra. And you have all the benefits of new civilizations that are starting, that are basking in the glory of the gods above. They're going to ascend again soon. That's what Kaelyn said."

> **Rhys:** "Look, would you rather save some or not?"
> **Sylvie:** "I think what you really want is to save yourself."
> **Rhys:** "I would like to be part of the 'some.' That's true."

**Why he matters now**

- [MINE] The Runt God's wail that brought Mollthain could bring Rhys too. He wants the Runt God, and it is at the Athenaeum.
- He has lived in the World Above. He knows what the company has just seen.
- His claims, checked against S27: no Umbra up there is true; they've seen it. "The gods are preparing for their next Ascent" fits Kreth going to fetch something, and Sylvie's pull forward and up. "New civilizations basking in the glory of the gods" hasn't been seen yet.
- [NOTE] The campaign's name comes from this scene: "your world is a caul."
- The last word between them was Sylvie's curse.

[OPEN] Does he show up in S29? If he does: a rival for the Runt God, a reluctant ally against Mollthain, or both.
"""),
        beat("caul-s29-b05", "What they might bring", """
- Ulmira's water, if they went to the Falls: it destroys Umbral things on contact (the risen dead, whatever comes in when the pyre fails). Sylvie is scalded by it.
- Sylvie's doors: anywhere she has seen.
- Inola, if they saved her.
- Speaker.
"""),
    ],
}

RADIO = {
    "id": "caul-gm-radio",
    "title": "Speaker, the radio",
    "text": """
[SET 24 Sep] Speaker works like a radio. It picks up fragments of conversations among the gods, not meant for the PCs, each god with its own voice.

[NOTE] What Speaker is: a faceless stone construct from below the Forbidden Library (S23). It woke to Sylvie's Umbra, not her Splendor. Stone constructs once served as the gods' mouthpieces (Kelun speaks for several). In S26 it raised Brathis's sign and answered to Brathis's name with "It is time."

[MINE] Reception:

- Receive-only.
- Clear in the World Above, where the gods are. Static back in the world below.
- A god's voice gets louder as that god gets closer. In Session 29, Mollthain's voice is the proximity clock.
- Kreth deceives: a fragment in one god's voice may be Kreth's. Heyou, looking through Kreth's eyes, might tell.
- Later: a god notices someone is listening.

[MINE] Voices:

- **Mollthain** (the Rampart): slow, few words, parental. Walls and holding.
- **Caranthalis** (the Tree of Light): warm, green, grieving. Speaks in seasons. Resents the tree-burners.
- **Ulmira** (pacts): formal and precise. Terms, oaths, breaches.
- **Kreth** (the moon, deceit): sly and playful, probably lying, always far off. He went to fetch something very large.
- **Brathis** (feral survival): guttural, present tense, all senses.
- **Tlellic** (the long night, predation): patient and hungry. Everything is prey.
- **Ossa** (the wanderer atop the peaks): airy, amused, half out the door.
- **Otheidas**: never on the channel. He was not of the clutch; the others call him the thief.
""".strip(),
}

FALLS = {
    "id": "caul-place-falls",
    "title": "Ulmira's Falls",
    "text": """
[SET 24 Sep] The waterfall Sylvie found in her reading: high country, tied to one of the sites on the vault map. Its waters are blessed by Ulmira.

- Umbral entities are destroyed on contact with the water.
- Those who wield the Umbra are scalded, not destroyed. Sylvie is scalded.
- It has no aura. It protects only what it touches, so no settlement around it can function.

[NOTE] Heyou holds the log of the Athenaeum's expedition to the far guarded places, which lost sixty of its eighty.

[MINE] Ulmira is the god of pacts; the falls may be the last station of her forgotten pilgrimage, which began at Ulmira's Step. The ruin of a settlement that tried to live by the water: the dark came between the people and the falls at night, and their blighted dead still ring the water, unable to go near it.

[OPEN] Does carried water keep its power? (Suggested: yes, but finite; a vial destroys one Umbral thing or lays one blighted corpse to rest.) Is Speaker, woken on Umbra, an Umbral entity? Heyou's shadow-shape?
""".strip(),
}


def upsert(lst, item, after_id=None):
    at = next((i for i, x in enumerate(lst) if x.get("id") == item["id"]), None)
    if at is not None:
        lst[at] = item
        return
    if after_id is not None:
        j = next((i for i, x in enumerate(lst) if x.get("id") == after_id), None)
        if j is not None:
            lst.insert(j + 1, item)
            return
    lst.append(item)


def main():
    pack = json.load(open(SEED, encoding="utf-8"))
    before = {k: len(v) if isinstance(v, list) else len(v or {}) for k, v in pack.items() if k in ("arc", "threads", "gm")}
    veil_before = sum(1 for k in ("overview", "places", "people", "pc") for x in pack["gm"].get(k, []) if x["id"].startswith("veil-"))
    s28 = next(s for s in pack["arc"] if s["id"] == "caul-s28-open")
    s28["session"] = "Session 28"
    s28["summary"] = "Finish the fight at the moon's lip; find Inola; the Runt God cries and Mollthain answers. Ends on Mollthain's leap."
    s28["beats"] = S28_BEATS
    upsert(pack["arc"], S29, after_id="caul-s28-open")
    upsert(pack["gm"]["overview"], RADIO)
    upsert(pack["gm"]["places"], FALLS)
    json.dump(pack, open(SEED, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # proof: a valid pack; S28 still first and still the World Above recap; every id unique; the
    # veil's GM entries and the threads untouched in number
    p = json.load(open(SEED, encoding="utf-8"))
    bad = []
    if p.get("kind") != "sortilege-vtt-campaign":
        bad.append("not a campaign pack")
    if p["arc"][0]["id"] != "caul-s28-open" or "World Above" not in p["arc"][0]["text"]:
        bad.append("S28 is not the first scene / its recap changed")
    ids = []
    def walk(v):
        if isinstance(v, dict):
            if "id" in v: ids.append(v["id"])
            [walk(x) for x in v.values()]
        elif isinstance(v, list):
            [walk(x) for x in v]
    walk({k: p[k] for k in ("arc", "threads", "gm")})
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        bad.append("duplicate ids: %s" % dup)
    if len(p["threads"]) != before["threads"]:
        bad.append("threads changed")
    veil_ids = [x["id"] for k in ("overview", "places", "people", "pc") for x in p["gm"].get(k, []) if x["id"].startswith("veil-")]
    if len(veil_ids) != veil_before:
        bad.append("veil entries %d → %d" % (veil_before, len(veil_ids)))
    print("seed_prep: arc %d scene(s) (S28 %d beats, S29 %d beats); overview %d, places %d; veil entries kept %d; threads %d; %s"
          % (len(p["arc"]), len(p["arc"][0]["beats"]), len(S29["beats"]), len(p["gm"]["overview"]), len(p["gm"]["places"]),
             len(veil_ids), len(p["threads"]), "OK" if not bad else "FAILED: " + "; ".join(bad)))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
