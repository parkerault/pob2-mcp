# Random build: Twisted Empyrean Blood Mage (Schwingy)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/random-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: urJZoOU-w48, "How I Accidentally Broke PoE2 With a Random Build" (Schwingy, uploaded 2026-07-27, 1:17:12).
- Patch: the 0.5 "Runes of Aldur" league. PoB tags Twisted Empyrean with that league, and the creator says Runeforging "was added to the game this patch" (55:55). He never gives the minor version, so it is close to our 0.5.4 but I can't confirm it's the same.
- The roll: only the ascendancy was random. The wheel gave Blood Mage (Witch). The creator chose the weapon himself: Twisted Empyrean, a level-70 two-handed mace whose skills turn fire damage into cold and whose damage scales with mana. The main skill came from his choices along the way: Perfect Strike, with Volcanic Fissure for clearing packs.
- Rules (0:08–1:34): this is a two-player race against TheSpudKing. Start with nothing. Use mace skills from level 1, with no levelling on another skill and swapping later. Trade as little as possible in the campaign (he broke this at 15:58), then trade freely at endgame. The goal is to kill the Arbiter of Divinity.
- How far it got: he finished the campaign and interludes, then ran tier-15 maps and reached level 90+. He killed the Arbiter of Ash, the Bodak (new ritual pinnacle boss, second try), the King in the Mists, the Matriarch, the Patriarch and the Arbiter of Divinity, in 43 hours with 53 deaths. His verdict: "easily the strongest character I have ever played" for single-target (1:15:49). The weak spots were clear speed in early maps and screen clutter.
- Caveat: most of the video is narrated gameplay. The real reasoning sits in about a dozen short passages, so the heuristics below are drawn from those.

THE ARC
- 2:43: He makes the Bleed I support the core and plans to "put this on every skill."
- 6:21–8:14: Perfect Strike, a slow charged hit, becomes the main skill and proves to be "a good boss killer."
- 13:50–14:38: Blood Mage arrives. The Blood Barbs node lets elemental damage scale bleed, so the skills' physical-to-fire conversion no longer weakens the bleeds. It also makes bleeds on cursed targets stronger (aggravated); he has no curse yet.
- 22:41: Boss damage falls behind. He crafts a new mace and his damage goes from 870 to 1658.
- 37:12–39:44: He over-levels a gem past his attributes and loses his pack-clearing skill, then dies in his first map. He brings back Shockwave Totem, whose slams make the Volcanic Fissure cracks erupt. He admits he "should have been using this combo from the get-go."
- 41:15–44:24: He names the real problem: single-target damage carried the campaign, but maps need area damage. He fixes it with support gems, then a second totem.
- 44:48–47:05: At level 70 he lacks the strength to equip the Empyrean, so he buys a ring and respecs. The mace's granted skill, Starborn Onslaught, needs "glory" from chilling enemies that he wasn't doing. He switches it to glory from life spent.
- Final setup: a Runeforged Empyrean (about 3M per hit, 57:32) with Perfect Strike as the boss killer. Volcanic Fissure plus two Shockwave Totems clear packs. Blasphemy keeps Elemental Weakness on everything. The second weapon set exists only for movement (58:00).

THE PROCESS
1. Pick the payoff first, then judge every new piece by whether it feeds it. Bleed is fixed at 2:43. After that he reads Blood Barbs (14:30), a body armour with 50% bleed chance (16:12) and the curse setup (17:29, 24:22) only in terms of bleed.
2. Check a mechanic's rules against how the skill hits. Bleeds don't stack and the biggest one wins, so "big hit equals big bleed" (15:31–15:41). That justifies a slow, huge-hit skill.
3. Note every condition on a node and fill it later. He sees that Blood Barbs needs cursed targets but "I don't have any curses yet" (14:20). He adds Elemental Weakness (17:29), then Blasphemy to curse everything nearby automatically (24:22).
4. Shelve a skill that needs a resource your build doesn't produce, unless something converts what you already do into it. Hammer of the Gods needs glory from stuns and gets shelved (35:02–35:18). Starborn Onslaught gets saved because a lineage support, Zerphi's Infamy, turns life spent into glory. Blood Mage's forced life cost on every skill supplies that (46:21–47:05).
5. Test cheaply and in place before committing: act bosses (8:14), the hideout (47:05), one boss hit after a weapon upgrade (57:23), a tier-15 boss after new jewels (1:01:16). He keeps skills he doubts on the bar ("he'll be back", 11:56).
6. Diagnose by role, not by raw stats.
   - Bosses get slower: upgrade the weapon (22:41).
   - Packs swarm him: he lacks a clearing skill (41:15). The fix ladder is a clearing skill, then area and attack-speed supports, then a helper that repeats the combo (the totem), then supports to keep the totem alive (43:31), then more totems (44:07).
   - Interrupted while charging: stun threshold (9:37, 19:08).
   - Resistance gaps: rings and amulets (10:16, 22:15, 30:46).
   - Too low level: he killed bosses faster than he gained XP, so he stopped to kill monsters (34:23).
   - Frozen to death: it took three deaths before he equipped a thawing charm (49:40). Even this creator misses a recurring failure.
7. Compare buying with crafting: a gem that already has 5 sockets costs less than socketing one himself (42:29). He also buys a better-rolled base before an irreversible upgrade, while admitting he isn't sure the rolls carry over (56:33).
8. He uses PoB's trade search to shop for jewels (58:46–1:01:11): import the character, check the config, replace the worst socket, cap the price, weight by DPS, sort by the weighted score, then re-query above a threshold. He notes it "doesn't necessarily consider everything."

PATTERNS
- Blood Barbs plus physical-to-fire conversion (later fire-to-cold): **conversion so another mechanic applies**. Here a node is what keeps conversion from costing the bleed.
- Blasphemy plus a curse to meet the "cursed target" condition: **forced condition**.
- Shockwave Totem (×2) setting off Volcanic Fissure. The game text confirms the trigger: "Using a different Slam on a Molten Fissure creates a spreading Aftershock". This maps to **proxy multiplier**.
- Empyrean: added cold damage equal to a share of max mana, and part of incoming damage taken from mana first. Both are confirmed in PoB. An anointment adds more of the mana-first share. This maps to **defence that scales damage**.
- Trenchtimbre on the second weapon set, with fast Boneshatter swings used as movement. This maps to **weapon set 2 doing a non-damage job**. How the swings move him is never explained, so I haven't verified it.
- NEW, **drawback as fuel**: an ascendancy's forced cost (life spent on every skill) becomes the generator for a gated resource (glory). Search step: for each forced drawback, search gem and item text for something that consumes it, e.g. "when you spend Life".
- NEW, **scope bridge**: an "also affects you" or "also contributes to" line turns another stat pool into yours. Trenchtimbre makes minion attack speed affect you, so the passive node Commanding Rage (minion attack speed per Rage) becomes your own attack speed. Blood Barbs is the same shape. Search step: grep uniques, ascendancy nodes and keystones for "also affect", "also contribute" and "also apply", then list the cheapest sources of the bridged stat.
- NEW, **support moved to gear**: an item mod that copies a support gem frees that gem slot everywhere (bleed-chance armour replacing Bleed I, 16:12). Search step: for each support in the plan, search unique and affix text for the same effect.

FOR OUR PHASES
- Before committing, check two kinds of requirement. First, attribute needs at the target level for the defining unique and every gem; both of his lockouts (37:12, 44:48) were this. Second, every condition on a chosen node needs a named source.
- Verification should show clearing and boss-killing as separate numbers. Attach the fix ladder from Process point 6 for when clearing fails.
- Ask of every candidate skill: "What resource does it need, and which routine action already produces it?" If nothing does, look for a bridge or shelve the skill.
- Pair-test the skills already in the plan. He had both halves of his best combo on the bar from Act 2 and missed it for about 25 minutes of video (39:44). Brainstorm should check each pair of skills against each other's text.

LINKS SEEN (unopened)
- Final PoB: https://pobb.in/G-_QWnF5ZzEV. The user could import it into our tool to check these claims.
- Spud's run: https://youtu.be/9lHbDZOmepY
- Wheels: wheelofnames.com/37h-hm9, /jjs-4ww, /88u-vfu, /gak-w8c, /9pe-sdt
- Sponsor (bit.ly/4fikilb), Patreon (patreon.com/schwingy), Discord (discord.com/invite/YXNfRXG6BB)

NOTES
- I used no frames. I checked names and game text in PoB's data instead.
- The transcript mishears several names. "Xurphy's Infamy" is Zerphi's Infamy and "Trench Timber" is Trenchtimbre; I confirmed both in PoB. I did not check "Eddern's Tusk" (the bleed-chance armour) or "Malagaro's Virtuosity" (the gloves).
- Token cost was about 110k input in total, mostly the transcript, and about 6k output.
