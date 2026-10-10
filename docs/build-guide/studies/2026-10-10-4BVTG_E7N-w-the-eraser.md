# The Eraser: Perfect Strike Chaos (josiahyeet)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## The Eraser: Perfect Strike Chaos (josiahyeet), from video `4BVTG_E7N-w`

I used 28 frames and 4 burst sheets, and opened no links. Item, gem and node names below are spelled as the frames show them.

### 1. The chain

- **Base.** Level 96 Gemling Legionnaire (12:36). Perfect Strike at gem level 34, with a one-hand mace and a shield (13:36).
  - The mace is a rare, "Grim Breaker", with +2 to Level of all Attack Skills (19:27).
  - The gloves are a rare, "Havoc Paw", with +2 to Level of all Melee Skills (11:58).
- **The hit.** Perfect Strike's perfect-timing stat set is 1132% damage at gem level 20 and 2242% at level 34 (`act_str.lua:15187,15201`), with 40% physical converted to fire. Supports (13:58–15:30):
  - Rapid Attacks (named in the transcript only);
  - Window of Opportunity II: 35% more damage on Perfect Timing, but a 35% shorter window;
  - Tasalio's Rhythm: 10% more damage per stack, up to 5 stacks; a 100% longer window, then 30% shorter per stack;
  - Xoph's Pyre: gain 40% of fire as extra chaos, and chaos contributes to ignite;
  - Scouring Flame: 50% more ignite magnitude, and the skill gains a Runic Ward cost equal to 25% of its life and mana cost.
  - In-game figures: hit 159k–257k, ignite 213k–344k per second (15:24).
- **A tap, not a channel.** His attack time is 0.4 s (11:45); his target range is 0.2–0.6 s (07:04–07:23).
  - Gemling supplies the attack speed (06:53).
  - The Opportunity flask (Ultimate Life Flask, level 60) is "Used when you release a skill with Perfect Timing" and gives "110% longer Perfect Timing window during effect" (12:36). It also supplies about 1,000 life/s of recovery (13:16).
- **Chaos ignite.** Blackflame: ignite deals chaos instead of fire, 120% increased Ignite Magnitude, 74% reduced Ignite Duration, and Withered doesn't expire on ignited enemies (11:33).
  - The ring's 20% fire-modifier quality raises the drawback as well as the bonus. PoB's ranges are (80–100)% and (60–75)% (`ring.lua:57-61`).
- **Spread.**
  - Cast on Elemental Ailment (CoEA, level 18) holds Contagion at **level 1** (13:39), plus Vitality I, Efficiency II and, per the transcript, Magnified Area and Prolonged Duration.
  - CoEA "gains Energy when you … Ignite" and triggers Contagion.
  - Contagion "spreads itself, Curses, and other Chaos damage over time Debuffs" when the enemy dies (`act_int.lua:3943`). The chaos ignite qualifies.
  - Loreweave adds a second spreader, "Ignites you inflict spread to other Enemies that stay within 1.5 metres for 1 second" (11:06). Wildfire or the Cracklecreep ring can replace it (04:37–04:46).
  - He says bodies re-spread the ignite and re-loop Contagion (04:19–04:31). Whether a spread ignite charges CoEA again is unconfirmed.
- **Multipliers on top.**
  - Block chance is 49%. Chernobog's Pillar gives "Gain 1% of damage as Fire damage per 1% Chance to Block" (09:27), and Lay Siege gives "1% increased Damage per 1% Chance to Block" (17:44).
  - Magma Barrier reaches level 29 from +10 global levels (16:38), which adds block.
  - Loreweave: gain 15% of damage as extra chaos.
  - Against the Darkness, a Time-Lost Diamond: 4% of damage as extra fire per notable in radius (18:44).
  - Withering Presence max-stacks Wither instantly (16:07).
- **Protecting the timing.**
  - Curse immunity: 50% from Loreweave plus tree nodes (Necromantic Ward, 17:54). Temporal Chains slows attacks and breaks the timing (07:45–08:04).
  - The Fall of the Axe charm handles slows (08:13).
  - Ignite duration must stay at 2–3 s or the spread fails. He would drop "ignites deal damage faster" nodes to keep it (08:21–09:05, 18:26–18:37).
- **Damage source.** The damage is Perfect Strike's own hit and its chaos ignite; Contagion is only the carrier. The main multipliers:
  - gem level: about ×2 from level 20 to 34;
  - Scouring Flame ×1.5: his on-screen test drops the ignite from 350k to 229k without it (15:15–15:30);
  - Tasalio's ×1.5 at 5 stacks (14:42);
  - Window of Opportunity ×1.35;
  - the block-scaled gain and increase, Blackflame's magnitude, and Wither.
- **How it differs from the entry's shared profile.** No Rakiata's Flow on the main skill. No Megalomaniac (18:46). Morior Invictus is only an alternative to Loreweave (11:13). Virtuous Barrier is used (13:36). Filler gems sit in Infernal Cry and Shockwave Totem (17:04).

### 2. How he found it and how he shows it

- **Origin.** It ports his Incendiary Shot chaos-ignite build ("Thanos" or "nano shotgun") to Perfect Strike (00:30–00:44). He credits Woolie for instant Perfect Strike on Gemling, and Jeff_The_Dude and Skerd_ on Reddit (01:33).
- **Trade-off.**
  - Gain: the big hit kills monsters that resist ignite (02:11–02:23).
  - Loss: the duration Incendiary Shot's fragments gave, so ignite duration becomes a goal (08:24–08:30).
- **Evidence.**
  - In-game tooltips and the character sheet: 16,373 armour, 82% physical reduction.
  - The Scouring Flame removal test.
  - A juiced Expedition with 13 remnant transfers, without Mageblood or Headhunter (01:46–02:38).
  - No PoB on screen and no boss kill in the video.
- **Format.** He presents the build as a goals sheet of breakpoints, not a fixed item list (03:01–04:09; overlay at 10:47).

### 3. Linking patterns

| Pattern | Here | What would surface it |
|---|---|---|
| **Change the damage type so another mechanic applies** | Blackflame makes the ignite a chaos DoT, so Contagion spreads it. | After any "X instead of Y" line, a mechanic lookup on the new type's phrase ("Chaos damage over time", kind gem). |
| **A trigger carrier fed by a side effect** | CoEA charges from the ignite and fires a level-1 spreader. | A mechanic lookup per ailment or event the skill emits ("Ignite", kind gem). About 55 gem descriptions mention ignite and lookups return at most 30 results, so the query must be narrower. |
| **Two spreaders on one debuff** | Contagion spreads on death; Loreweave's line spreads by proximity. | A "spread" query on the skill's ailment. |
| **Input demand removed by a breakpoint** | Attack speed plus window wideners turn the channel into a tap. | "Perfect Timing" queries: gems (Tasalio's, Window of Opportunity, Perfection) and uniques (Opportunity, Assailum). Then reasoning to name the breakpoint. |
| **An auto-use item keyed to an event the skill emits every press** | Opportunity. | "Used when" (kind unique), filtered to the skill's events. |
| **A defence stat that also scales damage** | Block chance. | "per 1% Chance to Block" across uniques and passives. |
| **A support's cost paid from a pool nothing else uses** | Scouring Flame's Ward cost, paid from Runic Ward gear (Ward 178 at 10:47). This is a variant of "a cost turned into a resource". | A "Cost" query (kind gem), then check which pool the build leaves idle. |
| **A non-DPS floor the optimiser must respect** | Ignite duration of at least 2 s for the spread. | Reasoning only. "Faster" ignite nodes and Blackflame raise DPS but cut the duration. |
| **Steep per-level scaling rewards +levels** | Perfect Strike roughly doubles from level 20 to 34. | Comparing `lookup_game_data` at two gem levels. |

### 4. Can PoB model it?

**Modelled:**

- The perfect stat set, and Window of Opportunity II under the perfect-timing condition (`SkillStatMap.lua:164`; `sup_dex.lua:5873-5875`).
- Xoph's Pyre (`SkillStatMap.lua:1146,1635`).
- Blackflame's chaos ignite: parsed at `ModCache.lua:5952` and applied at `CalcOffence.lua:5198`, against chaos resistance and chaos damage taken.
- Chernobog's Pillar (`ModCache.lua:5448`), Lay Siege (`:1042`), and Loreweave's extra chaos (`:5477`).
- Wither stacks, as a config option (`ConfigOptions.lua:1722`).

**Zero or wrong:**

- **Scouring Flame.** Its stat `support_scouring_flame_ignite_effect_+%_final` (`other.lua:15546`) has no stat map; only the `active_skill_` version is mapped (`SkillStatMap.lua:1518`). `check_model_coverage` does flag it as "possibly unmodelled".
- **Tasalio's Rhythm.** The pinned data lacks the per-stack lines entirely: `sup_dex.lua:5570-5573` holds only the stack gain and the +100% window, while the in-game tooltip (14:41) has them. Coverage can't flag a line PoB doesn't know.
- **Net effect.** The ignite comes out about 2.25× low, and the hit 1.5× low.
- **Clear speed shows as nothing.** The spread line is unparsed (`ModCache.lua:5959`), and PoB has no concept of Contagion's spread or CoEA re-triggering.
- **Timing.** Opportunity's auto-use and window lines are unparsed (`:6851-6852`). PoB computes the window (`CalcOffence.lua:1449-1458`) but never compares it with attack time, so the tap breakpoint can't be measured.
- **Missing uniques at the pin.** Loreweave exists only as mods (`UniqueLoreweave*` in `ModItemExclusive.lua`), and Against the Darkness only as flavour text. Both need custom item text.
- **Minor.** Blackflame's two Wither lines are unparsed (`:6918,6920`).

### 5. Could our tool reach it?

- **Would R1a propose it?** Partly. The timing package and Blackflame are reachable. The Contagion/CoEA engine needs a second step from Blackflame's conversion, and R1a never looks up the skill's *outputs*. Loreweave can't be found as an item; mechanic lookups (kind mod) show only its mod ids.
- **The main-damage rule ("the rolled skill is the main source of damage", D-122): passes.** The hit and the ignite are both Perfect Strike's.
- **The clear-skill rule ("the rolled skill should be the clear skill", D-148): passes, but for the wrong reason.** The 159k hit far exceeds 24,852 monster life at area 79 (D-132), but the screen-wide clear can't be evidenced. There's also a risk the tool tags Perfect Strike single-target, since its skill types include MeleeSingleTarget.
- **Ideas recorded from the first off-meta build:**
  - I1 (a resource-flow pass in concept research): strengthened. Extend it from resources to ailments and events.
  - I2 (flag unparsed damage lines): extend it to gems whose description promises damage but whose stats apply none (this catches Tasalio's).
  - I3 (input demand as a con): needs nuance. A breakpoint can remove the demand, so state both.
  - I4 (a named stage for a level-gated engine item): strengthened. Opportunity needs level 60, and the lineage supports level 65.

### 6. Inspiration

- **Output pass.** In concept research (R1a), one lookup per ailment or event the skill emits. Cheap.
- **Conversion follow-up.** For each "instead of" line, one lookup of the new type's scope. Cheap.
- **Non-DPS breakpoints.** In endgame design (D1), state them as claims and check the support and passive ranker picks against them. Judgement call.
- **Description-vs-stats flag.** In `check_model_coverage`. Cheap to moderate.
- **A goals list in the guide's endgame section.** Cheap.
- **D-122 wording.** A sentence saying the rolled skill's own ailment, carried by another skill, still counts as its damage. Cheap.
- **Not to attempt:**
  - simulating spread or the perfect-timing window;
  - patching vendor data;
  - combinatorial Loreweave searches;
  - a hard rule on duration floors.

### perra's index video `VGQ8TB9hQFY`

- **Mirage Sniper.**
  - Mirage Archers hit Snipe's Perfect Timing consistently, so every snipe is empowered without channelling (01:07–01:37).
  - Cooldown and duration stacking builds up to six archers (01:37–01:56). Dodge roll becomes the damage button (02:04).
  - Refutation's near-permanent uptime gives block (02:52).
- **The Eraser.**
  - One Perfect Strike leads to a Blackflame chaos ignite, then CoEA-triggered Contagion, and the screen melts (04:17–04:54).
  - Unlike most ignite builds, the hit itself matters (05:00–05:27).
  - Curse immunity protects the timing (06:13–06:25).
- **Glacial Bolt, two variants.**
  - Phylaris: Whirling Slash spins through his own crystals, and its Rage frees up Spirit (07:53–08:20).
  - josiahyeet: Pounce wolves, Verisium Manifestations (the transcript has "Virizion") and CoEA break the crystals automatically from range. It also has a clearer budget path (08:48–09:40).
- **GPU Nuker (Stormcaller Arrow).**
  - Advanced Thaumaturgy gives +1 arrow per 10 quality, and the explosion does the damage, so every arrow counts (10:38–11:10).
  - Surpassing chance of 300%+, Barrage and Tornado Shot (11:10–11:31).
  - CoEA casts Frost Walls, and the Verglas support (confirmed on frame 12:07) turns their roughly 245k life into extra cold damage (12:02–12:26).
  - The drawback is a delay of about 1 s before the arrows explode (11:35).
- **Infinite Bonker (Hammer of the Gods).**
  - Gemling quality pushes the chance not to consume Glory past 100%, so one Fury of the King seed lasts forever (14:05–14:26).
  - Reduced skill duration makes the hammer land almost instantly (14:39).
  - Olrovasara with Herald of Ice, plus Despair and Wither (14:59–15:20).
- He covers no build outside the list. His on-screen title reads "GPU Fryer Stormcaller" (12:07).

**New links seen, not opened:**

- `poe.ninja/poe2/profile/proyousart-4104/runesofaldur/character/JOSIAHHHHH`
- `youtube.com/watch?v=cwncABYpwKg`, a scaled-up example
- `youtube.com/watch?t=945&v=7T64H0DX_E8`, the mace craft
- Discords: `discord.gg/BqBBjEvX5K` and `discord.com/invite/b5JVymR3zq`

Frames are in `/home/parker/projects/yt-library/videos/4BVTG_E7N-w/frames/`.
