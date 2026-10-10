# Random build: Gathering Storm Infernalist, SSF (Schwingy, 0.4)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/random-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: bdxU10Jjz30, "I Let A Wheel Pick My Build... And One Shot Bosses" (Schwingy, uploaded 2026-04-17, 32:46).
- Game and patch: Path of Exile 2, patch 0.4 (the Fate of the Vaal league). The quest tracker in the 14:18 frame reads "Fate of the Vaal: Defeat the Royal Architect in Atziri's Temple", and at 17:10 he says the atlas gets reworked "next patch". Its game facts are not current for 0.5.4.
- Roll: Infernalist with Gathering Storm. Gathering Storm is a quarterstaff skill: you flip back, channel lightning, then release a dash. The creator says the gem needs character level 52.
- Rules: solo self-found, fresh character, no trading. The goal is to kill the Arbiter of Ash. Deaths are allowed.
- How far it got: the full campaign, maps up to tier 15, about level 85. Atziri died to three hits, then the three citadels, then the Arbiter after 12 attempts (a fight of about 20 minutes).
- Verdict: "a nuclear bomb with a glass casing", and "the coolest skill I have ever played".
- Caveat: the reasoning in this video is thin. He sends the build details to a separate overview video (14:24–15:37), which I did not read. Most of the runtime is narrated gameplay.

THE ARC
- 00:36–02:54: The skill is locked until level 52, so he levels with other quarterstaff skills. Killing Palm builds power charges that Falling Thunder spends, then Tempest Bell (02:26), Tempest Flurry (04:16), and Charge Staff spending the Killing Palm charges (09:21).
- 06:25: First wall. His area damage is "terrible" and he dies in packs; his tree is "a straight line towards nada" (02:19). He fixes it with crafted staves.
- 11:14: Takes Bringer of Flame, which lets all damage count towards ignite.
- 13:26–14:28: Gets Gathering Storm and opens bosses with a combo. 15:59: he dies while standing still to charge, and adds Wind Dancer (15:43).
- 18:33: Spends atlas points to raise the drop rate of Perfect Jeweller's Orbs, to give Gathering Storm its fifth socket.
- 19:56: Takes Altered Flesh even though fire resistance is uncapped. 20:28: Swaps Herald of Thunder for Blasphemy with Elemental Weakness.
- 21:02–22:02: The pivot. He puts on Coward's Legacy, takes Beidat's Will and drops Loyal Hellhound, then adds the low-life payoffs.
- 28:59: The Copper Citadel map had +36% monster elemental resistance, and "my damage is cut in half". From then on he reads the waystone mods (29:49).

THE PROCESS (new or sharper heuristics)
1. Bridge a payoff locked behind a level with skills that share its weapon, element and charge loop. The leveling skills are picked so that gear and tree investment carry over, not for their own strength (02:54, 09:21). Staff crafts made in the campaign feed Gathering Storm later (07:41, 12:16, 16:43).
2. Bank the enabler and schedule the pivot.
   - He kept a normal (white) Mail Belt to turn into Coward's Legacy with an Orb of Chance. The 21:12 frame shows the orb over the belt in a stash tab named "Chance".
   - He kept a Rune of Agony (20:19) for a future staff and used it at 25:26.
   - He made the switch only when an experience-rich map gave him the passive points (20:52–20:57). Pain Attunement waited until level 82 (25:51).
   - Rule: price each pivot in points and sockets, name the level where it becomes affordable, and know the acquisition route for any key unique.
3. Make a condition permanent with reservation, not a threshold alone. He says the 75% line is "a threshold I can permanently sit at thanks to" Beidat's Will (21:20–21:26). The 26:09 frame confirms it: Life 1,235/1,647, Reserved 412, which is exactly 75%.
4. Defend the exposed phase of the skill, not the character in general. He died to "standing still to charge" (15:59). The fixes cover that phase exactly: Wind Dancer (15:43), and Steadfast II against stuns "while I'm charging up in the middle of a pack" (26:14).
5. Match how a utility effect is delivered to how the main skill moves you. He switched to Blasphemy because "given the way I play, I am always up close" (20:28–20:40). The dash itself puts the curse aura on enemies.
6. Line up every temporary buff for one release on bosses: Tempest Flurry for combo points, Frost Wall to pin the boss, Infernal Cry, Mantra of Destruction, then the dash (14:17). He uses the frost-wall "cage" again at 29:23.
7. Read the encounter's mods as a damage check. Elemental resistance mods halved an all-elemental build. Ignite then acted as a damage floor ("Thank god for ignite", 29:41), and he chose a safe waystone next time (29:49).
8. When an expected item never shows up, check your filters before blaming luck. His loot filter had been hiding every energy shield base (23:06–23:33).

PATTERNS
- Coward's Legacy + Beidat's Will is "forced condition", with a lowered threshold and reservation used together.
  - PoB 0.5.4: the belt counts you as on Low Life at 75% or below; Beidat's Will "Reserves 25% of Life; +1 Maximum Spirit per 25 Maximum Life".
  - Payoffs: Pain Attunement (30% more crit damage bonus on low life), Direstrike II (70% increased attack damage, a 40-spirit support; frame 21:46), Execute III (30% more on low life; frame 21:52).
  - New sub-pattern (my inference; he never says it): the enabler funds its own payoffs. Spirit went from 60 (14:18) to 165 (26:09), which pays for Direstrike II and Blasphemy.
  - Search step: for each forced-condition enabler, check whether its other line produces the resource its payoffs cost.
- Altered Flesh + Ngamahu's Chosen is "conversion so another mechanic applies", on the defence side.
  - PoB: Altered Flesh takes 20% of lightning and cold damage as fire. The charm triggers "when you take Fire damage from a Hit" and grants maximum Rage.
  - Search step: for every "when you take X damage" trigger, look for "damage taken as X" sources.
- Bringer of Flame lets lightning hits ignite: "conversion so another mechanic applies".
- Killing Palm charges spent by Charge Staff: "inputs-and-outputs". Frost Wall as a boss pin: "low-level utility gems".
- New pattern, "movement delivers the radius": a self-centred aura or curse on a skill that lands you among enemies. Search step: if the main skill ends in melee range, list the proximity auras and curses.
- New pattern, "burst-window stacking": temporary and next-hit multipliers aligned into one charged release. Search step: list the cries, mantras and combo buffs, and confirm each one applies to the release hit.
- An untested link: in PoB 0.5.4, a perfectly timed Gathering Storm dash explodes Tempest Bells. He levelled with Bell but never mentions combining the two.

FOR OUR PHASES
- Level gate: if the payoff's level requirement is late, brainstorm proposes bridge skills that share its weapon, element and resource. Verification checks that gear and tree investment carry over.
- Forced conditions: check that the condition is permanent (reservation of at least 1 minus the threshold), that recovery and defence layers can't break it, and that the payoffs, added up, justify what it costs, including the node it replaces.
- Risk: run the skeleton against encounter mods such as +36% enemy elemental resistance, and name the skill's exposed phase and the defence that covers it.
- Stage the guide: give each enabler the level, points or sockets at which it becomes affordable, and the route to obtain it (for example, chancing a normal base).

LINKS SEEN (unopened)
- The creator's separate build-overview video: youtu.be/8zeREmRkhmk
- Five wheelofnames.com wheels: 37h-hm9, jjs-4ww, 88u-vfu, gak-w8c, 9pe-sdt
- Sponsor: playwt.link/schwingy, wtm.game/schwingy
- Community: a Discord invite (YXNfRXG6BB) and patreon.com/schwingy

Frames used: 6 of 8 (14:18, 20:31, 21:12, 21:46, 21:52, 26:09).
