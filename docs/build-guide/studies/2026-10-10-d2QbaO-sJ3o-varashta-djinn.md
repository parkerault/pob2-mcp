# Sand & Fire Djinn, Disciple of Varashta (Blazeworks TV)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

VIDEO CARD: d2QbaO-sJ3o

1. Header
- Video id: d2QbaO-sJ3o
- Title: "The Most Insane SSF League Starter | Varashta Complete Campaign Guide (PoE 2 0.5.5)"
- Creator: Blazeworks TV
- Patch: labelled 0.5.5. The realm text in the footage reads "SSF Runes of Aldur League", so the run was recorded on the live 0.5 league before 0.5.5 launched.
- Ascendancy and skills: Disciple of Varashta (Sorceress). The main damage is Kelari's Deception, a Command skill (you press it, the Sand Djinn minion casts it). Kelari's Brutality sits alongside it, and Ruzhan's Trap (Fire Djinn) is added at the third ascendancy.
- Budget: "zero unique items, completely SSF viable" (00:16). Campaign only; the endgame guide is not out yet.

Data check, done first: the ascendancy is in PoB 0.5.4. Kelari's Deception (tree.lua:61271), Ruzhan's Trap (tree.lua:131058), the Sand Djinn's three skills (Data/Minions.lua:1123), Muster, Bidding I/II, Pain Offering and the Archon of Undeath notable are all present. Nothing the chain needs is missing.

2. The chain
- Source (11:50, 14:11): Kelari's Deception creates a blast and leaves a clone. Using it again while that clone is alive detonates it. The tooltip shows "More damage per consecutive use, up to 300%: 50%", physical damage 499–750, 3 cooldown uses and a 2.78 s cooldown. Confirmed on a frame at 14:13 and in PoB (Data/Skills/minion.lua:2302, Physical spell damage).
- Command damage is minion damage, so it is scaled by:
  - "+levels to minion skills" gear: helmets, sceptres, amulets, found with the vendor regex "minion skills|movement" (03:14). Speech only.
  - Muster (18:46): "Supported Minions deal 7% more damage for each different type of Reviving Minion you have summoned." Confirmed on a frame. It is socketed in Kelari, and the build fills its spirit with one of each skeleton type (12:47), adding a new type whenever spirit goes up (18:53, 25:13).
  - Pain Offering (13:27): sacrifice a minion to buff the others, including the command damage. Speech only.
  - Archon of Undeath (16:44): "25% more Minion Damage; 200% more Cooldown Recovery Rate for Command Skills." Confirmed on a frame. In PoB's data the notable reads "15% chance to gain Archon of Undeath when you use a Command skill". The creator mentions a 20 s grace period before it can trigger again (17:51).
- Enablers:
  - The Archon cooldown recovery means more Deception casts while a clone is still alive, which pushes the ramp higher. The creator foreshadows this at 14:21 ("you'll see how we take advantage of this").
  - Pounce with Marked for Death breaks armour before the physical blasts land (14:02, 14:39). Speech only, and "Press X to shapeshift back" suggests the talisman sits on weapon set 2.
  - The daggers (Kelari's Brutality) apply critical weakness (13:51). Speech only. PoB puts critical weakness on the clone explosion stat set instead.
  - Ruzhan's Trap (21:06): "spread runes that erupt in a fiery tornado when stepped on." Confirmed on a frame at 21:13.

3. Patterns
- inert minions: skeletons are kept as headcount by type, to feed Muster's "per different type" multiplier, and as Pain Offering fodder.
- weapon set 2 job: a talisman on the swap set for Pounce and the armour break. Inferred.
- NEW, sequence ramp fed by use rate: a skill whose damage ramps with consecutive uses inside a window (here, a clone lifetime) is multiplied by anything that raises uses per window: cooldown recovery, stored uses, cast speed. Other skills fit this too: any stage, sequence or "per consecutive use" mechanic.
  - Search step: start from the main skill's tooltip and grep its stats for "per consecutive", "in sequence" or "stage". Then search the tree, buffs and supports for cooldown recovery or extra uses that are restricted to that skill's type (here, Command).
- NEW, actor rerouting: you keep direct control of the button, but the damage is dealt by a different actor (minion, totem, trap). That opens a separate multiplier pool (Muster, Archon, Pain Offering, +minion levels) that self-cast can't reach. This also works for other Command skills or companion commands.
  - Search step: from the class's or ascendancy's granted skills, find ones tagged CommandsMinions or "Command:". Check whose damage stats they use, then list the multipliers that target that actor.

4. How PoB follows it
- Modelled:
  - Deception's base hit, as a Sand Djinn minion skill (minion.lua:2302).
  - Muster: sup_int.lua:7106. It counts distinct persistent minion skills (Modules/CalcPerform.lua:1343–1348), and its 7% matches the frame.
  - Pain Offering's damage buff (act_int.lua:15786).
  - Caveat: the node line "Grants Skill: Kelari's Deception" parses to nothing (Data/ModCache.lua:5723). The skill seems to come through the minion's skill list instead, which I haven't checked in the engine.
- Can't be followed, ramp: the 50% more per consecutive use has no mapping. The stat at minion.lua:2330 is absent from Data/SkillStatMap.lua, so it needs a hand multiplier or a custom "more damage" modifier at the expected sequence step. Count (the skill-group multiplier players use for copies) is the wrong tool for a per-hit ramp. At most, Count 2 might stand for blast plus previous clone's explosion per chained use, if PoB shows only one stat set. That's unverified.
- Can't be followed, Archon of Undeath: the notable line is unparsed (ModCache.lua:1582), and no module handles the buff (no "archon" in ConfigOptions or CalcPerform). Hand-calc it as 25% more minion damage times uptime, plus the cooldown gain feeding the ramp.

5. Evidence and quality
- Proof is campaign footage only: boss kills and claimed phase skips from Act 3 onward, a deathless 7h20m run, a gear overview at 30:04, and the in-game DMG figures in the skill panel. There are no PoB numbers, DPS tests or endgame footage. The creator says a previous hardcore character reached level 99.
- Mostly a quest-route walkthrough. Mechanics get one or two sentences each, with no maths. The detail is deferred to the Mobalytics guide, and the pinned comment says the PoB link is still to come.

6. For the brainstorm phase
- Read the granted skill's own tooltip for ramp text. The creator flags "50% per consecutive use, up to 300%" first and then picks a cooldown buff to feed it.
- When the core skill comes from the ascendancy (level 21), plan a bridge build for Acts 1–2 (grenades here). Stockpile the scaling stat in advance with a vendor regex, and save 7,000 gold for a full respec at ascension.
- For "per different type" scalers, spend spirit on variety (one of each minion), not on more of the best one.

7. Links seen (none opened)
- https://mobalytics.gg/poe-2/profile/blazeworkstv/builds/0-5-ssf-minion2win-varashta-campaign-build-guide
- https://www.youtube.com/watch?v=BtzgJVSFLB4&t=209s (weapon set guide)
- https://www.youtube.com/watch?v=DIQtP-aHzs8 (grenade league starter)
- Two filterblade.xyz loot-filter links, plus Twitch, Patreon and a podcast playlist.
- No PoB, pobb.in or poe.ninja links. The PoB is "coming".

8. Reference entry
- d2QbaO-sJ3o (Blazeworks TV, labelled 0.5.5, SSF, no uniques). Disciple of Varashta, command-skill "minion" Sorceress.
- Chain: Kelari's Deception, 50% more per consecutive use up to 300%, scaled as minion damage by +minion levels, Muster (7% per minion type), Pain Offering and Archon of Undeath (25% more minion damage, 200% more cooldown recovery for Command skills, feeding the ramp). Ruzhan's Trap is the third button.
- Patterns: inert minions (type headcount), weapon set 2 job (Pounce armour break), NEW sequence ramp fed by use rate, NEW actor rerouting.
- PoB: base hit and Muster are modelled. The ramp (minion.lua:2330) and Archon (ModCache.lua:1582) need hand maths. No PoB link yet.

Frames used: 8 of 10 (11:52, 12:35, 14:13, 16:46, 18:47, 21:10, 21:13, 30:06), saved under /home/parker/projects/yt-library/videos/d2QbaO-sJ3o/frames/. Note that 11:52, 12:35 and 21:10 showed nothing usable.
