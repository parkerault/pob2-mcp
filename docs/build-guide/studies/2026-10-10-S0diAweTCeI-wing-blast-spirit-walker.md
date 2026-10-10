# Random build: Wing Blast Spirit Walker (Schwingy)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/random-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: S0diAweTCeI, "The Dumbest Build I've Ever Created." (Schwingy, uploaded 2026-06-28, 50:22). Your label was "Wingblast Spirit Walker".
- Game: Path of Exile 2, confirmed on frames: the Huntress class, Talismans, Spirit and Runic Ward on the HUD, the Arbiter of Ash.
- Patch: 0.5, the Runes of Aldur league. He mentions "the 0.5 reveal" (19:50) and starts maps in league week 2. He never says the minor patch. Our pin is 0.5.4, so the numbers are close but may have moved.
- Roll: Spirit Walker (Huntress) with Wing Blast, the Druid's backward wyvern leap, a utility skill.
- Rules: a "Zero to Hero" wheel run. Wing Blast must be the damage skill, and the goal is to kill the Arbiter of Divinity. At 24:38 the wheel added a second pinnacle boss, the delirium Trickster ("Raven"). Trading is allowed.
- How far: the campaign, maps to at least tier 14, the Arbiter of Ash (4 tries), the Arbiter of Divinity (9 tries, 46:28) and the Trickster (first try, 49:38). He ended at level 87 after 77 deaths and 37 hours.
- Verdict: the damage was "laughable… the running theme" (09:46). He calls it "one dumbass build that refused to quit."

THE ARC
- 02:28 First plan. Wing Blast's own hit does little. Its damage is a shockwave when it hits an enemy that is primed for heavy stun: the stun bar is past a threshold, 40% on white monsters up to 70% on bosses (06:52). So another skill fills the bar and Wing Blast cashes it in. The first filler is Rolling Slam with Brink, a support that builds stun faster but can't stun.
- 03:31 Flash Grenade replaces Rolling Slam because it has 500% stun buildup built in. But Brink can't be socketed into it, so the grenades stun enemies themselves and use up the payoff.
- 08:22 He pivots to Wind Blast (150% stun buildup plus the melee bonus), which Brink can support.
- 10:02 He ascends and tames the boss Crowbell, giving it a stun support and Brink: "he's there for the stuns."
- 17:05 He splits the weapon sets. Set 2 runs Wind Blast with stun-buildup passives; set 1 runs Wing Blast with damage passives.
- 25:09–31:58 A long hunt for what keeps "stealing" the stun: gloves, ascendancy stags, Pounce's wolves, curse explosions.
- 40:24 "Operation Tank": he respecs into evasion and deflection (17k evasion, "70 deflection") and puts Loyalty on his bear companion.
- Final setup: Wing Blast in 5 sockets with Rageforged II, Wind Blast on set 2, the Brinked companion, Freezing Mark in Pounce, and a 9-divine talisman (46:55).

THE PROCESS
How he searches:
1. Read the skill for what it pays out on, not for its hit (02:20). PoB data agrees: Wing Blast's hit has a -100% stun multiplier, so it builds no stun at all, and the shockwave is a separate stat set. Heuristic: if the payoff needs an enemy state the skill can't create, the build is two skills, one that builds the state and one that finishes.
2. Rank builder skills by the numbers on the gem, then check that the lock fits. He picked Rolling Slam for its stacking physical and melee stun multipliers (06:32), Flash Grenade for its 500% (03:36) and Wind Blast for 150% plus melee (08:35). Grenades lost because the lock couldn't attach, not because they built too little stun: Brink only supports Melee skills (03:54; confirmed in PoB data). Heuristic: the builder must be strong at building and also blockable from finishing.
3. Test cheaply on a known fight before committing. He tried grenades on Crowbell (03:48), tested Wind Blast first (08:29) and tested the curse explosions on a boss (17:38). For gear he compares tooltip DPS: 5,654 to 9,495 for 3 exalts (22:50), and +24% (35:02).
4. Pick helpers for their role, not their power. He turned down the stronger monkey boss (10:24) and took Crowbell because it is "really good at stunning". Then he left Crowbell to fight alone to show it is weak without him (11:47–12:05), a quick check that he is doing the damage.

How he diagnoses:
5. When the payoff won't fire, list every source of hits that could finish the stun first, and remove them one at a time:
   - gloves that immobilise at 50% buildup (25:09; Whisper garbles the name);
   - the Vivid Stampede ascendancy stags (26:31);
   - Pounce's Predator's Mark wolves (27:39). The gem frame shows the wolves are summoned minions, which Brink on Pounce doesn't reach;
   - Blasphemy with Repulsion explosions (31:44).
   His fixes were to remove the source, respec, or swap to a version with no hits (Freezing Mark). He had suspected the explosions back in Act 4 and forgot (31:48).
6. Borrowed tech has thresholds. A commenter's Herald of Ice plus armour-explosion setup only worked inside a freezing shrine, because his damage was too low to chill anything (32:47). He scrapped it.
7. Survival: the cheapest fix comes first, a flask upgrade (03:08). Later he cut damage nodes "that weren't doing much" for evasion and deflection (41:30), reasoning that low damage means long fights, so his effective HP has to last longer (41:16).
8. Resources: when a support spends Rage, add producers that do nothing else. Ferocious Roar is "literally only on my bar to keep the rage flowing" (29:35). Mana Remnants covers mana (19:23).

PATTERNS
Library matches:
- A builder skill pushes the stun bar past the primed threshold so the finisher can use it (forced condition).
- Set 2 holds Wind Blast and the stun passives (weapon set 2 doing a non-damage job). The weapon types also force the split: PoB lists Wing Blast as Talisman-only.
- The tamed boss only fills the meter (a setup role, a variant of inert minions as triggers or headcount).
- Rage producers feed Rageforged (inputs-and-outputs).
- Thunderstorm for a 20% shock boost (04:20) and Ferocious Roar for Rage (low-level utility gems).

New patterns:
- "Builder that can't spend." A payoff that uses up an enemy state, paired with a builder carrying a "builds X but cannot cause X" modifier. Search step: for any skill whose damage keys off an enemy state, search supports and mods for that kind of stat (in PoB, `cannot_cause_stun_but_allow_stun_buildup`), then check its required skill tags against the builder.
- "Payoff thief" (an anti-synergy). Any independent hit source can use up the state before the finisher does. Search step: list every skill's hit-making children (triggered skills, minions, ascendancy procs, on-hit explosions, item effects) and check whether the lock reaches each one.

FOR OUR PHASES
- Brainstorm: ask every candidate what its damage consumes or requires, and whether it can create that itself. If it can't, propose builder and finisher pairs, and require the lock's tag check before listing them.
- Verification: run the payoff-thief audit on the skeleton and flag every hit source the lock doesn't cover. PoB won't model one source stealing another's payoff, so report it as a risk, not a number.
- Verification: evaluate the payoff stat set. Wing Blast has separate "Wing Blast" and "Shockwave" stat sets in PoB, and the shockwave deals 50% more off unique enemies. His in-game DPS readings probably measure the plain hit: at 29:28 Wing Blast shows 12,105 against Devour's 21,774. I'm not sure of this.
- Present a fallback ladder of builders with the reason each one fails (slow, can't be locked, too weak). Tell the user plainly when damage will stay low and fights will be long, so defences have to carry.

LINKS SEEN (unopened)
pobb.in/-k-RuftR5lF8 (final PoB); exitl.ag/Schwingy; patreon.com/schwingy; discord.com/invite/YXNfRXG6BB; wheelofnames.com/37h-hm9, /jjs-4ww, /88u-vfu, /gak-w8c, /9pe-sdt.

All 8 frames were used. The narration has plenty of reasoning in the first half; the endgame is mostly boss attempts.
