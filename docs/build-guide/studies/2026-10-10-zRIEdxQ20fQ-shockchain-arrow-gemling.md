# Random build: Shockchain Arrow Gemling, HC SSF (Schwingy, 0.4)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/random-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: zRIEdxQ20fQ, "Can A Random Build Survive in Hardcore?.. (POE2 Movie)" by Schwingy, uploaded 2026-05-26.
- Game and patch: Path of Exile 2, patch 0.4. The character sheet at 21:08 reads "HC SSF Fate of the Vaal League", and the Path of Building (PoB) frame at 29:52 shows the Community Fork with tree version 0_4. The creator says the Gemling Legionnaire was reworked in 0.5 (10:20) and that this endgame predates Return of the Ancients (39:23). Don't treat its game facts as current without checking.
- Roll: Gemling Legionnaire with Shockchain Arrow (bow).
- Rules: whatever the wheel picks, played in hardcore solo self-found. That means no trading, and one death ends the run. He states no other constraint, and he openly leans on Lightning Arrow: "admittedly also kind of lightning arrow" (56:44).
- How far: the full campaign and interludes (about 16 hours), maps up to tier 15, all three citadel bosses, and level 87. He died to the Arbiter of Ash in phase 2 (58:28). Verdict: "what a good run", much further than he expected. He says it is "not a tanky build": about 8k effective HP and about a 2.4k max physical hit. He credits careful ranged play.

THE ARC
- 0:55: Lightning Arrow as the closest stand-in until Shockchain Arrow unlocks at level 41. The goal is "don't die before the build starts."
- 6:08 and 7:19: the Enfolding Dawn unique (+100 spirit) funds Herald of Thunder. He then adds Attrition "considering these fights are dragging out."
- 10:36: he takes the Gem Studded ascendancy node (40% less movement penalty while using skills) over 10% quality, reasoning "this will keep me alive because I can actually move."
- 17:19: Mirage Archer (a dodge roll leaves a clone that fires the socketed arrows), holding Stormcaller Arrow to automate shocks.
- 21:49 to 22:58 (the main wall): Shockchain Arrow tests as "a straight up downgrade" because there aren't enough shocked enemies. He demotes it to a burst button for when he sees the shock icon, and Lightning Arrow goes back to being the main skill.
- 23:25 and 26:40: he takes the Spreading Shocks notable and reworks his gems "to shock a little more often with lightning arrow."
- 29:17: Shockchain Arrow is now "usable for clear." A PoB session moves his tree points into chance to inflict ailments and damage against ailing enemies.
- 32:39: he puts off the final boss until he has a fourth support gem (Deliberation).
- 42:15 and 54:27: Electrocuting Arrow joins the Mirage Archer clone, and he takes a bow with lightning penetration. The final setup is Shockchain Arrow in 5 links as the main skill, Lightning Arrow feeding it shocks, and the clone applying shock and electrocute.

THE PROCESS
1. Read what the skill needs as an input, then test whether you can supply it (21:25 to 22:45). The tooltip at 21:08 says Shockchain Arrow "Cannot Shock", consumes Shock, and chains extra only off Shocked or Electrocuted enemies. He tried it in live play and found the cause was shock uptime, not damage numbers. Heuristic: when a payoff skill eats a condition it can't apply, the first question is how much of that condition you can supply.
2. If the supply is too low, demote the payoff instead of dropping it (22:49). The skill that applies the condition stays the main skill, and the payoff becomes a button for when the condition is up. He then spends tree and gear on the supply, step by step: Spreading Shocks, his gem rework, ailment chance, and later "anything that increases my chance for Lightning Arrow to shock" (53:28). Once the supply is good enough, the payoff takes over as the main skill (29:17).
3. Hand the setup work to a helper (17:19, 42:15). Putting the condition-applying arrows on the dodge-roll clone means fewer buttons and conditions applied passively.
4. Pick buffs that answer the problem you're seeing. Spare spirit went to Attrition (more damage the longer an enemy stays near you) because boss fights were long (7:23).
5. In hardcore, take mobility over stat sheets, but count damage as defence. He took Gem Studded over quality, and it later paid for Deliberation's slow (32:56). Yet he takes flat lightning over evasion because "more damage means getting hit less" (16:25, 30:20). He also counts Electrocute's immobilize as "breathing room" (8:01).
6. Measure every swap before committing. He reads the in-game DPS delta on each item (14:57, 24:24), says "I'm going to have to Path of Building it" (49:59), and plans tree changes in PoB (29:28).
7. Wait for power spikes before risky fights. He overlevels the ascendancy trials (9:30, 28:25), waits for a support gem before the final boss (32:39), and takes Integrated Efficiency (bonuses per connected support gem) to "grow into it" as sockets arrive (28:33).
8. When a slot over-solves a constraint, free up the slot it was protecting. Boots with three resistances (42:55) let him swap the spirit chest for a life chest, with an amulet making up the spirit (44:10).
9. Diagnosing a resistant boss: Jamanra resists lightning and "our damage is not good" (11:36). The eventual fix was lightning penetration on the bow (54:27, 56:07), although he wasn't sure it beat 67% increased damage.

PATTERNS
- inputs-and-outputs: Shockchain Arrow consumes shock it can't apply, so the shock has to come from Stormcaller Arrow, Lightning Arrow and Spreading Shocks.
- routine action as damage, plus proxy multiplier: the dodge roll spawns the Mirage Archer clone, which applies the conditions.
- not-consume to 100% (a variant; this is my reading, not his): the tooltip says Electrocution also triggers the extra chains and is not consumed. So electrocute on a boss is a lasting enabler. He added Electrocuting Arrow "to automate" it, without naming this reason.
- filler gems to satisfy a count: Integrated Efficiency rewards connected supports, so every new socket adds value.
- quality as a stat line: the third ascendancy point gives +10% quality to all skills (47:00), with no reasoning given.
- NEW, staged handover (main skill enables, payoff bursts): run the skill that applies the condition as the main, with the payoff as a burst, and shift investment as supply grows. Search step: for any skill with "Consumes X" or "Cannot X", list the skills, nodes and gear that apply X, and check uptime with and without each.
- NEW, drawback cancellation: a node that removes a penalty makes penalized supports and skills cheap. PoB 0.5 data gives Shockchain Arrow -70% movement while attacking, and Deliberation slows further. Search step: for each drawback stat on the chosen skill or supports, search the ascendancy and tree for nodes that reduce that penalty.
- NEW, crowd control as defence: an immobilizing ailment (electrocute) is both a damage window and a defensive layer. Search step: for hardcore candidates, list the build's ailments that stop enemies acting.

FOR OUR PHASES
- Before committing (verification): for a payoff skill, configure the condition on and off in PoB and show the DPS gap with the realistic uptime. If supply is unproven, say so.
- Give the user a fallback ladder: payoff as main; then payoff as a conditional burst with the enabler as main; then reinvest in supply until the handover.
- Ask of every candidate (brainstorm): "Which boss resists this element, and what fixes it?" and "What happens on a single target?" Chains need several targets; he noted they shine "on multiple bosses" (37:53).
- Present risk honestly. Report effective HP and max hit next to "survived by play skill." His run reached the final boss on about 8k effective HP and died there.

CHECKS (PoB data for 0.5)
- The Shockchain Arrow text matches his 0.4 tooltip.
- Spreading Shocks, Gem Studded (including the green-gem movement clause), Integrated Efficiency and Mirage Archer all exist.
- Enfolding Dawn is +100 spirit and 5–15% to all elemental resistances.
- I did not check whether the 0.5 Gemling rework changed which ascendancy nodes you can reach.

LINKS SEEN (not opened)
- youtube.com/watch?v=zRIEdxQ20fQ
- boot.dev/?promo=SCHWINGY
- pobb.in/kuH5emBYy6V4 (his level 87 PoB)
- patreon.com/schwingy
- discord.com/invite/YXNfRXG6BB
- wheelofnames.com/37h-hm9, /jjs-4ww, /88u-vfu, /gak-w8c, /9pe-sdt

Frames used: 7 of 8 (21:08, 23:30, 26:46, 29:52, 40:14, 42:20, 59:14).
