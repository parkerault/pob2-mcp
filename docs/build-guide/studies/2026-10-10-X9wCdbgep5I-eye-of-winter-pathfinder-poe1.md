# Random build: Eye of Winter Pathfinder (Schwingy; Path of Exile 1)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/random-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: X9wCdbgep5I, "I Was Forced to Play a Poison Eye of Winter Build..." (Schwingy, uploaded 2026-08-18, 51:49).
- Patch: this is Path of Exile 1, not PoE2. The league is "Allflame" ("Allflame League" is on screen at 45:30). The video never gives the patch number. None of its game facts apply to PoE2 0.5.4.
- Roll: Pathfinder plus Eye of Winter. The creator added his own twist: make it a self-cast poison build, "and I have no idea how" (00:20).
- Rules: use the skill from level 1. He muled over Freezing Pulse as a stand-in until Eye of Winter unlocks in Act 3. The goal is all four endgame Voidstones plus the new league boss. Trading is allowed.
- Outcome: it finished everything. All four Voidstones, 100/100 Atlas completion, Maven and the league boss Velka (51:11), in 32 hours with 99 deaths. He never rates the build. His only judgement is that Pathfinder is "a hollow shell of its former self" (17:42).

THE ARC
- 02:36: He puts Chance to Poison on a cold spell while knowing it does almost nothing, because poison only scales from physical and chaos damage. That is theme over efficiency.
- 07:24–09:45: Plague Bearer and the poison mastery do nothing ("3x0 is still 0", 09:23). He takes Wither (Nature's Reprisal) anyway, as a multiplier waiting for a base.
- 11:47: The real plan was always a single level-43 unique, "the build-defining unique that makes this whole disaster functional". A wall at 12:01: he can't afford it in gold.
- 12:38: Volkuur's Guidance ("Your Cold Damage can Poison", 50% less poison duration; confirmed on a frame). At 14:01: "The build is saved."
- 16:01: He keeps dying, so he swaps to a defensive weapon (transcribed as "Sybil's Paw", life gained per spell hit). It costs some damage, and he had no deaths through Acts 9–10.
- 20:02–20:48: He cancels the gloves' downside with Leper's Alms (+40% ailment duration) and Dendrobate (built-in Chance to Poison, plus poison damage and duration).
- 21:31 and 22:23: In maps he diagnoses his deaths as suppression at 39% and sets the cap as mandatory. He also finds a dead support slot and swaps in Slower Projectiles, and the damage "skyrockets".
- Final setup (45:06–45:45): a 6-link Dendrobate with +2 to projectile gems, an Elemental Overload sceptre and capped suppression. Then Maven and Velka.

THE PROCESS
1. Find the enabler before scaling anything. He asks what single item lets the skill's damage type feed the mechanic, and when it becomes available. Until then, every poison investment counts as zero. He takes the multipliers early on purpose (09:23, 11:47).
2. Break the mechanic into pillars and check each one (13:01–13:51):
   - base: flat damage on the hit;
   - type-specific scaling (generic spell damage doesn't count);
   - duration;
   - chance to apply, up to 100%.
3. The enabler's downside becomes the next shopping target. He bought duration items to cancel "50% less duration" (20:02).
4. Read the skill's own text for hidden scaling. Eye of Winter shards gain up to 200% more damage as they travel (frame at 26:14). That gives a range sweet spot (11:37, 18:12) and makes Slower Projectiles work: the orb lingers and hits the same target more times. He tested this with a single gem swap: "in theory... in practice the damage skyrockets" (22:46).
5. Audit for redundancy after every gear change. His Chance to Poison gem duplicated the level 10 Chance to Poison his chest already grants, for many map tiers (22:23–22:43).
6. Judge a swap by the mechanic's own DPS line in PoB. Cruelty replaced Added Chaos because PoB showed +9.4% combined DPS. The frame shows the hit-DPS lines falling while the poison lines rise (38:28).
7. Diagnose deaths by mechanism, not by "more life":
   - he measures suppression and caps it with gear plus a Quartz flask, counting on Pathfinder's near-permanent flask uptime (31:35–31:52);
   - he adds Cast when Damage Taken with Immortal Call (25:41);
   - he simply skips the content that kills him, cursed treasures (21:26).
8. Fix resource problems structurally. Rising mana costs led him to Eldritch Battery, which also freed a flask slot (31:04). He automated curses too: Arcanist Brand carrying two curses (21:57), then Despair-on-hit gloves (35:05).
9. When stuck on a boss while broke, step down a tier, farm currency, buy damage, then retry (33:46–34:22).

PATTERNS
- "Cold damage can poison" maps to "conversion so another mechanic applies". Strictly it grants permission rather than converting. Search step: grep uniques and notables for "<type> Damage can <ailment>" or "Contributes to <ailment>".
- Pathfinder's flask uptime turning flask-conditional effects into constants (the Quartz flask's suppression, Master Toxicologist's spread) maps to "forced condition".
- Cast when Damage Taken maps to "inputs-and-outputs".
- New, "hit count as sustain": a skill that makes many small hits turns flat per-hit effects into large sustain (life on hit from the weapon at 16:14, then a Watcher's Eye at 43:13). Search step: estimate hits per second from the skill's data (projectiles times hits per target) and rank per-hit mods by that number.
- New, "slow the emitter": when the damage comes from a moving emitter, or from damage that grows with travel distance, projectile speed is a damage dial. Search step: flag skill descriptions with "constantly releases", "spiral" or "gains damage", and test speed modifiers in both directions in the skeleton.

FOR OUR PHASES
- Gate on the enabler. Each concept names its one permission link, its level, and how to get it. Tell the user plainly: "this does nothing until X at level N; earlier picks are dormant."
- Run the pillar checklist on any damage-over-time or ailment concept: base, type-specific scaling, duration, 100% application. Add the enabler's own downside as a line to cancel. Reject the candidate if any pillar has no source.
- Verification runs a dead-slot audit: toggle each support or source and flag a zero delta. It also runs skill-shape probes such as projectile speed up and down.
- Rank changes by the mechanic's own DPS line, not hit DPS. For defence, ask "what does this skill do many times per second?" and price per-hit sustain against it.

PoE2 CROSS-CHECK (narrow grep of the v0.23.1 data)
- Eye of Winter and Pathfinder both exist in PoE2. PoE2's Eye of Winter has a cooldown and elemental-ground interaction, and the eye itself does not hit.
- No PoE2 unique says "Cold Damage can Poison". The nearest analogue is Plaguefinger: "All Damage from Hits Contributes to Poison Magnitude", but its current version also says "Cannot inflict Elemental Ailments". I haven't verified this against a build.

UNCERTAINTY
- "Sybil's Paw" and "Singularity" are spelled as the transcript has them; I didn't confirm them on a frame. Volkuur's Guidance, Dendrobate, Chance to Poison and the Eye of Winter text are frame-confirmed.
- I used 6 frames in all.
- Much of the endgame is gameplay and economy chatter. The reasoning is concentrated in 11:47–14:01 and 20:00–23:00.

LINKS SEEN (none opened)
- displate.com/l/schwingy
- hideoutshowcase.com/hideout/show/8806/...
- pobb.in/5MMroi4uCr8Q (his final PoB; it is PoE1, so our PoB2 can't load it)
- patreon.com/schwingy
- discord.com/invite/YXNfRXG6BB
- five wheelofnames.com wheels: 88u-vfu, gak-w8c, 9pe-sdt, 37h-hm9, jjs-4ww
