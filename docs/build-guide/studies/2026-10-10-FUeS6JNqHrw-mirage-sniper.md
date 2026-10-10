# Mirage Sniper (J_Macc)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## Mirage Sniper (J_Macc, `FUeS6JNqHrw`): findings

I used the transcript, 29 frames, PoB v0.23.1 data, and the guide worktree's R1a, D1, Lookup.lua and Coverage.lua. I opened no links.

**New links, not opened:**
- The pinned comment links a PoB export, `poe.ninja/poe2/pob/25a80`, so the entry's "PoB: none linked" is wrong.
- ds lily's self-cast Snipe video, `UQ_xZ1VJRN4`.
- A Time-Lost jewel crafting video, `3tFs16SXkD8`.
- The Mobalytics guide URL.

### 1. The chain

- **Mirage Archer** (frame 03:50) is level 22 at 41% quality.
  - Its text: "While active, dodge rolling will create a Mirage that uses socketed ranged Attacks… Mirages deal 30% less Damage. Socketed Skills cannot consume Charges. Cooldown Time: 10.00s. Mirage duration is 6.1 seconds."
  - Quality adds "+2.05 seconds to Mirage duration". The Gemling-only quality effect adds "82% increased Reservation Efficiency".
  - The mirage stands still, "kind of like a totem" (04:40).
- **The group:** Snipe, Cooldown Recovery II, Prolonged Duration II, Rapid Attacks II and Rakiata's Flow (08:17–08:28). The Rapid Attacks II tooltip is on frame at 08:26; the other names come from the transcript and the gem colours.
- **Correction: the quality-to-attack-speed step is not inferred.**
  - Snipe's own Gemling quality effect reads "41(0-20)% longer Perfect Timing window / 41(0-20)% more Attack Speed" (05:58). PoB has it as Snipe's `altQualityStats` (`act_dex.lua:7231-7235`).
  - The 41% is 20 from the gem plus 21 from global modifiers: the amulet's "+5% to Quality of all Skills" (18:08), the Paragon anoint and an idol's bonded mod (18:11–18:16, 19:22–19:29).
  - Motoric Implants gives "+2 to Level of all Skills with a Dexterity requirement" (07:05), so Snipe is level 30.
- **Correction: attack speed does not make Perfect Timing reliable.**
  - The creator says the mirages release in the window "for the most part" and "it does not seem to be tied to attack speed". He ran many attack-speed variants (05:18–05:48).
  - Quality lengthens the window; attack speed is fire rate.
- **Six mirages:**
  - His mirages have a 3.16 s cooldown and about 22 s duration. He prioritises cooldown for how mapping feels (04:15–04:34).
  - Duration ÷ cooldown ≈ 6.9 (my arithmetic), against his "up to six" (00:46).
  - Sources on frame:
    - Boots: "Can roll Chronomancy modifiers", with 40% skill effect duration and 30% cooldown recovery (20:46). PoB's rune data names that line Uhtred's Sidereus.
    - Time-Lost Emeralds: "Notable Passive Skills in Radius also grant 3% increased Cooldown Recovery Rate", covering 8 and 10 notables (24:44, 25:20–26:12).
    - From Nothing: "Passives in Radius of Hollow Palm Technique can be Allocated without being connected to your tree" (25:52).
    - Heart of the Well: 18% cooldown recovery, 8% duration and 9% extra lightning (27:10).
    - Megalomaniac: 25% skill effect duration (26:56).
- **Correction: the multipliers listed for the mirages actually sit on a self-cast Snipe.**
  - Window of Opportunity II, Uruk's Smelting, Armour Break III and Perfection are in a separate self-cast Snipe group (09:14–09:40). He "honestly doesn't really even press" it while mapping (09:06).
  - Its jobs are endurance charges, deflection, and Perfection. He claims Perfection also buffs the mirages' Snipes and isn't lost when they miss the window (09:40–09:55). That is unconfirmed.
- **Missing from the entry:**
  - Pounce on the weapon-set-2 talisman applies Predator's Mark. Its wolf limit is 6, and the Gemling quality effect makes it 8 (10:40). He has 14 wolves.
  - The wolves carry Brutus' Brain, a lineage support gem (not an item): "Minions from Supported Skills cannot be Damaged / deal no Damage" (10:47).
  - Pounce must be set to both weapon sets for the wolves to stay (10:51–11:06).
  - Tornado Shot re-fires the mirages' arrows as copied projectiles (08:29–08:56).
  - Cadiro's Gambit is used for everything except pinnacle bosses (16:14–16:43).
- **Where the damage comes from:** the Snipe arrow plus its Perfect Timing explosion, from about 6 mirages at 70% damage. It is multiplied by:
  - the number of mirages;
  - fire rate (41% more attack speed plus Rapid Attacks II);
  - +1 arrow (15:45) and a +50% surpassing chance for another;
  - Predator's Mark;
  - Rakiata's Flow, which only helps the elemental share (flat lightning, the "all elements" rune, Heart of the Well, Rend's buff);
  - Perfection, as claimed.
- **In-game numbers:** the Mirage Archer row shows DPS 76,196 and the self-cast Snipe row 108,852 (08:19, 10:47). That is exactly 0.70, so the game's own panel shows one mirage, not six.

### 2. Discovery and justification

- There is no discovery story; he built it for the hardest Expedition content (00:30).
- **Evidence shown:**
  - an Arbiter of Ash fight in the cold open: the boss bar is gone and the objective changes at 00:28, though the boss's starting life isn't shown;
  - the in-game DPS panel;
  - Expedition and 200% delirium claims.
- **No PoB numbers are shown.** He admits he doesn't know why the mirages sometimes miss the window (05:23).

### 3. Linking patterns

- **P1, "a proxy fires the rolled skill for you":**
  - It removes the skill's input demand (a timed channel release), and the number of proxies becomes a multiplier.
  - Surfaced by asking which meta gems' hidden support part accepts the rolled skill's types. Mirage Archer's requires a ranged attack that mirages can use (`act_dex.lua:5026`).
- **P2, "concurrent instances = duration ÷ cooldown":**
  - Stacking both stats turns a cooldown-gated spawn into an N× multiplier.
  - Surfaced by any proxy that has both a cooldown and a duration.
- **P3, "one stat axis pays damage and defence":**
  - The same cooldown and duration stacking keeps Refutation up 17 s of every ~3 s cooldown (14:04–14:20), gives a Ghost Dance shroud every 3.16 s (12:11–12:22), and makes Pounce near-constant movement.
  - Surfaced by querying cooldown-gated defensive buffs once the scaling stat is chosen.
- **P4, "bodies for a headcount":**
  - Undamageable minions that deal no damage inflate a per-minion multiplier.
  - PoB has Predator's Mark at 3% increased damage taken per minion in your presence, capped at 45% (`act_str.lua:15519-15520`). 14 wolves give 42%.
  - Surfaced by a mechanic query like "minion in your presence" or "per nearby", plus "cannot be damaged".
- **P5, "the rolled skill self-cast as a buff applier for its own proxies":** Perfection and charges. Unconfirmed.

### 4. Can PoB model it?

- **Mirage use:** PoB never runs its mirage calculation for this gem.
  - The Mirage Archer branch of `CalcMirages.lua:63-117` needs `triggeredByMirageArcher`. Only the stat `skill_can_own_mirage_archers` sets that (`SkillStatMap.lua:276-278`), and no PoE2 gem has it.
  - `skill_disabled_unless_cloned` (`act_dex.lua:5091`) is mapped nowhere.
  - So the socketed Snipe is computed as one player-fired Snipe with 30% less damage (`act_dex.lua:5083-5090`). There is no mirage count.
  - The "used by mirage, no cost" flag (`CalcMirages.lua:89`) is never reached. PoB likely charges Snipe's 242.6 mana per second (05:58) to the player, while he reports no mana issues (01:57). That is an inference; a probe would confirm it.
- **Perfect Timing:**
  - The Explosion stat set carries `perfectly_timed`, which PoB reads as the Perfect Timing condition (`act_dex.lua:7389`, `SkillStatMap.lua:164-165`). Choosing it assumes every release is in the window.
  - The window is computed (`CalcOffence.lua:1449-1460`), but its hit rate isn't.
  - Arrow and explosion are separate stat sets, so their damage has to be summed by hand.
- **Unmodelled multipliers:**
  - Perfection: not mapped anywhere.
  - Uruk's 20% physical damage taken: not mapped.
  - Cadiro's Gambit: not parsed (`ModCache.lua:5229`).
- **Modelled:**
  - Rakiata's Flow (`SkillStatMap.lua:965`).
  - The Time-Lost radius grants (`ModParser.lua:7041`).
  - From Nothing (`ModCache.lua:6402`).
  - Predator's Mark, with a config count override (`ConfigOptions.lua:1026`). Whether PoB counts the wolves of a weapon-set-2 Pounce is unverified.
- **What this build needs from the Gem Studded / Advanced Thaumaturgy agent:** the Gemling quality effects of Snipe (attack speed and window), Mirage Archer (reservation) and Pounce (wolf limit), plus global "+% to Quality of all Skills" feeding them. In the calculations these depend on the `GemlingQuality` flag (`CalcSetup.lua:835`).

### 5. Could our tool reach it?

- **Would R1a propose it? Probably not.**
  - R1a's discovery calls cover supports by tag and mechanic searches. Mirage Archer is an active meta gem, so neither turns it up.
  - Gem lookup shows an active gem's tags, not its skill types, and hides the meta gem's support rules under `additional` (`Lookup.lua:268-311`).
  - A mechanic search for "ranged attack" with kind `gem` would find it: only 2 gem descriptions match (Mirage Archer and Mirage Deadeye). A search for "socketed" matches 28 descriptions, which the default cut of 20 may truncate.
- **Would the lookups surface the Gemling link?**
  - Advanced Thaumaturgy's node text says only "an additional effect".
  - The lookups never print Gemling quality lines: `qualityLines` reads `qualityStats` only (`Lookup.lua:128-146`), and mechanic mode describes gems at quality 0 (`Lookup.lua:113-116`).
  - So the key Gemling-to-Snipe link is invisible.
- **The coverage check gives a false all-clear.** Every described line on Mirage Archer is mapped, so `check_model_coverage` reports it fully modelled (`Coverage.lua:388-402`). The gap is in a mechanic, not a line.
- **D-122 ("the rolled skill is the main source of damage, never a token role") passes in substance:** all the damage is Snipe.
  - But the gate reads one PoB instance. The rarely pressed self-cast group, with Window of Opportunity II's 35% more on Perfect Timing, would measure higher than the mirage group.
  - The headline would then attach to the wrong group unless a ledger figure multiplies by the mirage count.
- **D-148 ("the rolled skill should be the clear skill") passes:** it is a one-button build, and mapping is "much better than I expected" (01:54, 02:09–02:22).
- **The budget objective** (D-147: T15 for at most about 20 divines) is unshown.

### 6. Inspiration

1. **Gem lookup, "usable by" (R1a, cheap code; highest value):** for an active gem, print its skill types and the meta gems whose hidden support part accepts it, using PoB's own require/exclude rules. For Snipe this would print Mirage Archer.
2. **Coverage marks proxy gems (cheap):** any gem whose effect adds the used-by-clone or used-by-proxy skill types gets "proxy: count, cost and timing by hand". That replaces today's false all-clear.
3. **D1 ledger idiom (wording; a judgment call):** for a proxy, the figure is per-instance damage × instance count, with count = floor(duration ÷ cooldown) or the limit. The rolled group is the proxy group even when a self-cast group measures higher.
4. **Strengthen I3 (input demand as a con):** a proxy that takes over a timing demand is a pro, not just the absence of a con.
5. **Weaken I2 for this build (I2 flags unparsed "deal … Damage" lines on items):** the unseen multiplier here is a game mechanic, not an item line, so I2 wouldn't catch it. Item 2 covers that case. I1 (the resource-flow pass in concept research) and I4 (a named stage for a level-gated engine item) don't apply.

**Don't attempt:**
- modelling the mirages' release-timing AI or a Perfect Timing hit rate;
- Perfection stacks;
- averaging Cadiro's arrow types;
- Tornado Shot's arrow copying;
- Headhunter stacking in Expedition;
- a search of every meta gem against every skill, beyond the rolled skill's usable-by list.
