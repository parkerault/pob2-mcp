# Random build: Shield Charge Acolyte of Chayula (Schwingy, 0.3.x)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/random-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: 1ZqM9dJ9MF0, "I Tried Beating Path of Exile 2 With ANOTHER Random Build.." (Schwingy, 2025-10-04, 58:31).
- Game and patch: PoE2, patch 0.3.x ("The Third Edict", the Abyss league). Its game facts may not hold at 0.5.4. My PoB checks use the v0.23.1 data.
- Roll: Acolyte of Chayula with Shield Charge, picked by wheel spin.
- Rules: a fresh "zero to hero" character, with killing the Arbiter of Ash as the goal. Trading is allowed (08:39) and he uses it heavily from Act 4.
- How far: the campaign, the interludes, tier-15 maps and about level 89. He killed the pinnacle bosses (Xesht, Olroth, King in the Mists, the abyss boss) and the Arbiter at 57:33.
- Verdict: "by far the smoothest campaign run I've had" (37:06). He suspects Shield Wall is overpowered, or that trade made it easy.
- Honesty: the roll was strong, so there is no recovery from a dead end. The reasoning is light and spread through narrated gameplay.

ARC
- 00:54-04:09 First plan: a mace and a targe, with Stomping Ground and Rapid Attacks on Shield Charge. He buys a spear only for Disengage. He can't equip Shield Charge without more Strength (02:22), so his passives go to Strength. He learns its damage comes from shield armour and from distance travelled (03:37).
- 07:49 The combo: Infernal Cry, Disengage back for a run-up, then Shield Charge in.
- 09:33-13:11 He has only 30 spirit, so Herald of Ash runs for clearing and War Banner for bosses. He dies at -1 fire resistance with the wrong one active, buys resistance and toggles. A body armour with spirit later runs both.
- 16:56-17:49 Turning point: Shield Wall, which Shield Charge shatters into a big explosion. He adds Fortifying Cry because both are shield skills.
- 20:00 -> 32:08 He takes Inner Turmoil (Volatility stacks from his ignites), betting on map density. Then he finds a cap of one stack per 0.1 s and swaps to the node that makes all remnants purple.
- 33:00-47:16 Trade gear:
  - shield armour goes 220 -> 600 -> 1000 ("over 30% more damage", 41:54);
  - leech gloves;
  - a time-lost jewel that holds Rage at 30;
  - the Spiked Shield notable;
  - a stun-immunity charm and a Strength anoint.
  He drops Stomping Ground.
- 49:26-57:33 He crafts a shield with 1,148 armour, survives Geonor on 58 life and kills the Arbiter.

PROCESS
1. Ask what the skill reads before buying anything. Shield skills scale with shield armour, not weapon damage (03:37). He then judges every shield on the tooltip. 12 -> 29 armour moved damage from 8 to 9 (04:29), and 78 armour was "practically doubling" it (06:34). Heuristic: name the damage source, make its slot the shopping target, and check each upgrade on the tooltip.
2. Supply the skill's conditions with a second skill. The distance bonus needs a run-up. Disengage jumps back to make one and also cancels the end of the charge (04:00). Dodge roll is the backup cancel (04:09). Heuristic: for each condition in the skill text, find a cheap skill that creates it and covers the skill's weak moment.
3. Pick partners whose text or tags reach your skills. Shield Wall's text names Shield Charge (16:56). He took Fortifying Cry because both damage skills are shield skills (17:44), and Overwhelming Presence because the build "is naturally leaning into" stun (18:14).
4. Check a stacking mechanic's rate cap against how often the build hits. He bet on density (21:15). Then he found that slow, screen-wide hits gain one stack per hit, so he had only 5-6 (32:08-32:41). He researched it only afterwards. Heuristic: count stacks per second at the real hit rate, not per enemy. Reject ramp nodes that want many small hits when the build lands a few big ones.
5. Re-audit when the damage source moves. Stomping Ground deals half of weapon damage (01:38). That was fine early and useless once the shield carried the damage (47:16). He also "assumed" his mace's stun mods applied to shield attacks without checking (33:20). Heuristic: list each support, mod and notable with the damage source it reads, and cut the mismatches.
6. Fix by mechanism, cheapest first:
   - toggle reservations by role (09:44);
   - buy resistance after a fire death (10:00);
   - get leech when "in desperate need" of recovery (33:28);
   - for repeated stuns from abyss packs, stun-threshold boots and then a stun-immunity charm (45:21-46:09);
   - when short on Strength, an anoint (46:19).
   He handled the charge's pathing failures (13:42, 17:58) by play.
7. Choose the defence that shares the attribute you already need. He stayed on armour as a monk because Strength was already strained, and adding Dexterity or Intelligence would need an Astramentis (46:27-46:44). This sharpens "check attribute requirements": pick the defence whose attribute your offence already demands.

PATTERNS
- defence that scales damage: shield armour is the damage. The "armour also applies to elemental damage" mod he keeps buying (19:20, 25:25, 40:52) extends it to elemental hits. In PoB's 0.5 data, both skills add physical damage per 15 shield armour. Spiked Shield gives 2% attack damage per 75 shield armour and 50% increased shield defences.
- weapon set 2 doing a non-damage job: a spear held only to unlock Disengage. PoB confirms Disengage requires a spear and "can be used while using other skills". The 15:22 frame shows a mace in the main hand, so the spear being on set 2 is my inference.
- forced condition: Disengage supplies the distance. Armour break from Uruk's Smelting (25:09) supplies "fully broken armour", which a mace mod cashes in for 59% increased damage (47:07).
- New, placed detonator: one skill places an object, and the main skill breaks it for a bigger hit. Shield Wall's text in PoB's 0.5 data: "your Slams, Warcries, and Shield Charge will instantly shatter them". It deals +100% more damage when slammed, and -80% if enemies break it within 0.5 s. Warcries also shatter it, which he never mentions. Search step: grep skill descriptions for "your <tag> ... shatter/detonate/explode" and match the tag to the main skill's types.
- New, damage-source substitution: an attack that doesn't use the weapon's damage (here the shield's stats stand in). Search step: read the skill's added-damage stats, then keep only the supports and mods that read that source.

FOR OUR PHASES
- Brainstorm: for each candidate, state the damage source and the one slot that carries it. Verification then shows damage per step of that stat.
- Brainstorm: before generic supports, search other skills' text for interactions with the main skill's tags.
- Verification: give every ramp or stacking node a stacks-per-second estimate at the build's hit rate, with any cap. PoB may not model caps, and its Volatility node data shows none. Flag that to the user as unverified.
- Present a fix ladder by mechanism: reservations by role, resistance, recovery, stun immunity, then an attribute anoint. Say so when the ascendancy is filler. He called his later picks "meh options" (41:19, 52:01), so this concept rests on skill and gear.

LINKS SEEN (unopened)
- pobb.in/N-CGiIdRDFvS (final PoB); mantasleep.pxf.io/nXGX9A (sponsor)
- wheelofnames.com: 37h-hm9, jjs-4ww, 88u-vfu, gak-w8c, 9pe-sdt
- the channel's join page, patreon.com/schwingy, discord.com/invite/YXNfRXG6BB

(Sources used: meta.md, the full transcript, 4 frames (15:22, 17:23, 38:09, 56:50), and narrow greps of Data/Skills/act_str.lua, act_dex.lua and TreeData/0_5/tree.lua.)
