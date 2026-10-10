# Random build: Fangs of Frost Chronomancer (Schwingy, 0.3.1)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/random-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: gLac8n8iBeA, "So This Is What Happens When You Make Your Own Build..." (Schwingy, uploaded 2025-12-13, 59:12)
- Game: Path of Exile 2. Evidence: Sorceress, Clearfell, spears, Arbiter of Ash, and the character sheet at 32:16 reads "Rise of the Abyssal League".
- Patch: 0.3.1, recorded at the tail of the league a few weeks before 0.4.0 (00:14). The game facts here are not current. For example, PoB's 0.5 data lists Sacrosanctum at 10–20% recoup, with a "Pre 0.4.0" variant at 5–10%.
- Roll: Chronomancer with Fangs of Frost. Fangs of Frost is a spear stab; hitting a Parried enemy consumes that debuff for a frost explosion.
- Rules: none beyond starting fresh and killing the Arbiter of Ash. Trade is allowed (00:54). For the endgame he simulates a fresh atlas by walking a straight line to the citadels (40:20).
- How far: the campaign took about 20 hours. He cleared all three citadels and killed the Arbiter at about 58:13, at level 86+, running CI (life set to 1, immune to chaos) on about 9.5k energy shield.
- Verdict: "made it work", but damage stayed weak ("our damage is yikes", 54:44).
- Caveat: much of the reasoning is brief narration over gameplay. A broken end-of-league economy did a lot of the lifting (a 6-link for 30 exalts, spears for 1–35 exalts), and so did a lucky Headhunter from an Orb of Chance.

THE ARC
- 04:18 First plan: parry, then stab. Pull packs together and land one parry so the explosion clears them. 04:45: "not going well."
- 07:36 Wall: parrying fills the stun bar, and slams and Draven's projectiles can't be parried safely. Fix: a strength point for the Steadfast support.
- 09:42 No pack clear. Herald of Ice and Infernal Cry add on-death explosions.
- 15:17 The Kaltenhalt buckler turns parry's stun buildup into freeze buildup. Glacial Lance keeps the spear Daivata's Wind's "thrown a spear recently" condition switched on.
- 17:13 Nearly dies to the duo bosses. Diagnosis: both damage and recovery are short. Fixes: attack-speed gloves, then the Road Warrior body armour for life regen plus recoup nodes.
- 27:25 Runs out of mana on Krutog. Swaps supports that multiply cost for cheap ones.
- 35:32 Discovery: Concentrated Area boosts the stab too, not just the explosion.
- 46:16–54:00 Defence pivot: Sacrosanctum, then the recoup ascendancy node, then CI. Blasphemy with Temporal Chains, copied from poe.ninja.
- 55:14 Geonor is far harder than Jamanra; he looks it up and finds Geonor has high cold resistance. For bosses he swaps Headhunter for a boss belt, then kills the Arbiter.

THE PROCESS
How he searches:
1. **Interrogate the mechanic the skill depends on before scaling it.** What grants it (a buckler, not an armour shield, 02:50)? What does it pay (Parried enemies take 50% more attack damage, 03:19)? How does it fail (the stun bar and slams, 03:37; projectiles, 07:29)? Buy a fix for each failure first.
2. **Split a two-mode payoff into its live and dead halves.** Sands of Time alternates cast speed and area (18:25). Cast speed does nothing for an attack build; area feeds the explosion and Herald of Ice.
3. **Price a conditional node by what you have already invested in its condition.** He takes Apex of the Moment over the recoup node because "we only have a little bit of recoup" (24:28). He returns to the recoup node at 45:44, once recoup is the plan. ("Rapid River" is Whisper's spelling, and I couldn't find it in the 0.5 tree.)
4. **Test the tag, not your model of the skill.** He assumed area supports only hit the explosion (35:58). PoB confirms Fangs of Frost carries the Area tag alongside MeleeSingleTarget, so they hit the whole skill.
5. **Go outside the game narrowly, then pay for what the idea displaces.**
   - He researched a resistance debuff and found Frost Bomb, a Sorceress spell that applies Elemental Exposure (21:14; the name is confirmed on a frame at 21:25).
   - He checked poe.ninja for what other Chronomancers run (47:36).
   - The borrowed Temporal Chains needed a second curse slot, so he took Whispers of Doom to keep Elemental Weakness (48:00).
6. **Check that a fix hit the real pain.** He bought an infinite-range parry shield (32:30), then dropped it for +3 to cold skills: "the ranged parry wasn't that big of a deal" (49:44).

How he diagnoses:
- **Split a near-death by axis.** At 17:13 damage and recovery were both short, so he applied one fix to each.
- **For mana starvation, cut cost multipliers first** (27:38): Embitter and Inevitable Critical out, Ice Bite and Rapid Attacks in.
- **Compare against a peer boss.** If one boss is far harder, check its resistance to your element (55:14).
- **Keep a loadout per encounter.** Headhunter is useless on bosses, so he swaps it out (55:40).
- **Re-check attribute requirements when a swap removes a supplier.** At 38:57 a new spear left him below the boots' 57 strength.

PATTERNS
Mapped to the library:
- **Conversion so another mechanic applies:** Kaltenhalt applies parry's stun-buildup modifiers to freeze buildup instead and converts parry damage to cold. This also fits **routine action as damage**: the parry itself freezes enemies.
- **Zeroed resource (CI):** the CI pivot. The useless life flask became Blood of the Warrior, whose recoup reaches energy shield through Sacrosanctum.
- **Builder and finisher:** Elemental Sundering consumes Fangs of Frost's freezes for explosions (50:19). He never ran the payoff-thief audit: consuming the freeze removes the frozen state that Honourless, Exploit the Elements and his freeze-based defence rely on.
- **Low-level utility gems:** Frost Bomb used only for its exposure; Cull the Weak for finishing bosses (08:27).
- **Missed, not-consume to 100%:** in PoB's 0.5 data, Fangs of Frost quality gives a 0.75% chance per quality not to consume Parried. He bought quality at 29:11 and never mentioned it. That is current data; 0.3.1 may have differed.

New:
- **State-keyed payoffs.** List the states the build always applies (frozen; cursed via Blasphemy; slowed), then shop for "against X enemies" modifiers. His picks: Exploit the Elements, the Honourless anoint, and Idols of Egrin socketed in a Darkness Enthroned belt (PoB has "Enemies you Curse take 6% increased Damage"; Whisper heard "talismans"). Search step: enumerate the skeleton's guaranteed enemy states, then stat-search Frozen, Cursed and Chilled.
- **Control as defence.** Freeze, the ascendancy's slow aura and Temporal Chains carried the boss fights while damage was "laughable" (25:09, 30:00). Search step: for a skill that freezes or slows, list the class's sources of enemy slow and score boss safety, not just DPS.
- **Pivot bridge.** Before a defence pivot, find an item that carries existing investment across. Sacrosanctum also applies life recoup to energy shield, so the recoup points survived CI. Search step: search uniques for "X also applies to Y", where X is already invested.
- **On-death clear for a single-target skill:** Herald of Ice shatters, Infernal Cry, and Trample Toes' overkill splash. Search step: when the main skill is single-target, query on-kill and overkill effects in its element.

FOR OUR PHASES
- **Enabler failure check (brainstorm):** list how the required state fails (Parry: stun bar, slams, projectiles), and require one fix per failure in the skeleton.
- **Tag-scope and quality-line check (verification):** read each skill's skillTypes and quality stats to see which supports reach which part, and spot not-consume lines.
- **State inventory:** generate the "against X" shopping list from the guaranteed states. Run the payoff-thief audit whenever a consumer of a state is added.
- **Present risk by axis:** boss damage (including bosses with high resistance to our element), recovery, and resource. Give bosses their own loadout, with control as the fallback when damage lags.

LINKS SEEN (unopened)
pobb.in/CAhQ0kalcEeH; mantasleep.pxf.io/nXGX9A; patreon.com/schwingy; discord.com/invite/YXNfRXG6BB; wheelofnames.com/37h-hm9, /jjs-4ww, /88u-vfu, /gak-w8c, /9pe-sdt.

I used 5 of the 8 allowed frames. The "solution in mind" for parrying at 04:51 is never named; it was probably Steadfast or Kaltenhalt.
