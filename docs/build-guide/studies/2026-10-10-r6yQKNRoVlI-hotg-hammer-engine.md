# Hammer of the Gods "Hammer Engine 2.0" (Ulfhednar)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## Build 5: HotG "Hammer Engine 2.0" (Ulfhednar, `r6yQKNRoVlI`, 8 min, uploaded 2026-07-21)

- **Cost:** 26 frames, about 230K tokens by the session counter. I opened no links.
- **New links seen, not opened:** `mobalytics.gg/poe-2/builds/ulf-s-hammer-engine` (description and pinned comment), `twitch.tv/ulfhednar`, `discord.com/invite/BSJsMHXJsG`, and an unnamed earlier "Herald of Ice" video he points to at 01:43.
- **Which version this is:** the video shows the Chaos Dreamer variant. He calls the Olrovasara/Herald of Ice setup "my first setup and cheaper" (01:43–01:48).

### 1. The chain, as the video shows it

1. **The gate.** The Hammer of the Gods (HotG) tooltip says "Requires 20 Glory to use" and "Generates 100% of Monster Power as Glory … on Heavy Stunning" (01:16).
2. **The gate removed.** The same tooltip shows level 30 (20 + 1 corruption + 9 global), Quality +23% plus "+21% Quality from Global Modifiers", and "Additional Effects From Quality: 110(0–50)% chance to not consume Glory".
   - **Correction to the entry:** the entry's 85% + Everlasting Glory's 15% isn't this version. The quality effect is 2.5% per 1% quality (`act_str.lua:7144`), so 44% quality alone gives 110%. The threshold is 40%, and the notable isn't needed ("way overcapped", 00:57).
3. **Priming.** Fury of the King (an Ashbark Talisman) sits on weapon set 2 with "Skills which require Glory generate 6 Glory every 2 seconds" (00:42). It takes about 8 s on set 2 to prime (00:37).
   - **Correction:** the "6" is that generation line, above PoB's 2–5 range (`talisman.lua:36`). Molten Crash is just the talisman's granted skill.
4. **The next bottleneck is mana.** HotG costs 149 mana. The HUD sits at 19–66 of 636 mana, with "You don't have enough mana" spam (00:58, 02:01).
   - Defy II reads "Insufficient Mana doesn't prevent the use of Supported Skills while Surrounded" (05:53).
   - Constricting Command (Viper Cap, corrupted) has "Require 4 fewer enemies to be Surrounded" plus a mutated "54% increased Surrounded Area of Effect" (05:38). One enemy then counts as surrounding you, which also keeps Defy's Lucky hits on.
5. **Rage.**
   - Berserk at 49% total quality gives "+19 to maximum Rage" and "24% increased Rage effect", on top of its base 64% (03:05).
   - Medved's Felling supports HotG (03:18).
   - **Missed by the entry:** mutated Hateforge "Vaal Gloves" (03:42). They have lost "Lose all Rage on reaching Maximum Rage" and gained "+9 maximum Rage if you've used a Skill that Requires Glory in the past 20 seconds". He paid 40 divines (03:52).
   - The HUD shows Rage 105/105.
6. **Drawbacks zeroed by Chaos Inoculation (CI).**
   - Flesh Crucible reads "10% less maximum Life / Chaos Inoculation" (04:38). He chose the life price because "less of zero is still zero" and it was cheaper than the mana version (04:43–04:50).
   - Heroic Tragedy (Vorana 2431) turns a keystone into Black Scythe Training: "Gain no inherent bonus from Strength / 1% increased Energy Shield per 2 Strength" (04:29). Energy shield is about 4,995, with Life 1/1 throughout.
7. **The "instant" hammer.** Hammerfall's base duration is 2.5 s (01:16). He runs reduced skill effect duration down to 1 s (01:13–01:24), helped by Palm of the Dreamer's "13% reduced Skill Effect Duration" (01:36).
8. **Multipliers in this version.**
   - Palm of the Dreamer: "Gain 27% of Damage as Extra Chaos Damage" (01:36).
   - Blasphemy + Despair (transcript only, 01:58).
   - Withering Presence (Whisper heard "Withered Spirit"). Its quality effect "Withers enemies … every −1.02 seconds" keeps Wither up despite the short durations (02:09, 02:18).
   - Herald of Thunder: shock from flat lightning on the rings and a Heart of the Well jewel (02:38–02:56, transcript only).
   - Aftershock (a support plus tree nodes), chosen over crit because his weapon suffix goes to reduced attribute requirements for Giant's Blood (06:12–06:36).
   - Zerphi's Infamy, Rakiata's Flow, Everlasting Glory and Virtuous Barrier never appear in the video. They're unconfirmed for this version.

**Where the damage comes from:** one HotG hit at 2119% of weapon damage (01:16; the transcript's "over 2400%" doesn't match the frame). It is multiplied by Rage, Medved's attack speed, extra chaos with Despair and Wither, shock, Lucky hits and aftershock repeats.

### 2. How he found it and how he proves it

- **Discovery:** it iterates his own earlier HotG Gemling build. He calls it "the real slam build I had in my mind since launch" (07:41) and hopes GGG won't "change the quality" (07:46), so he knows the quality effect is the engine.
- **Proof is in-game only:**
  - an 8-mod map with 4 tablets (00:18);
  - Doryani in the Stone Citadel with Delirium, map completed (05:22, 06:15);
  - Simulacrum footage (06:36);
  - a level 97 character (07:14).
- He shows no PoB numbers.

### 3. Linking patterns

- **P1. A 100% "chance not to consume" turns a per-use cost into a one-time unlock.**
  - To surface it: list the rolled skill's costs, search "not consume <resource>" across gems, quality effects and passives, then work out the threshold.
- **P2. Prime once from the swap set.** An item whose only job is a one-off top-up goes on weapon set 2, even off-archetype (a talisman on a mace build).
  - To surface it: a mechanic lookup on the resource's name, with `kind: unique`.
- **P3. Chase the next bottleneck.** Once the first gate is gone, rate-limit the build again: cost per second against mana regeneration.
- **P4. Force a condition by lowering its threshold.** "Require N fewer enemies" turns every "while Surrounded" line into an always-on line.
  - To surface it: query the condition's word once a candidate line depends on it.
- **P5. Zero a resource, then harvest every drawback priced in it.** CI makes free:
  - Medved's and Berserk's life loss;
  - the Crucible's "less maximum Life";
  - Black Scythe Training's lost Strength bonus (in PoB that bonus is life: `ModCache.lua:5678`).
- **P6. Quality as a second stat line.** This is Gemling-specific: quality is pushed past 20% for the extra effects (Berserk's +19 Rage, Wither's frequency).
- **P7. Read a stat backwards for delayed skills.** "Reduced Skill Effect Duration" shortens a damage delay. The resulting conflict with Wither is solved by P6.

### 4. Can PoB model it?

| Link | PoB 0.23.1 | Evidence |
|---|---|---|
| Glory as a resource | Not modelled: no "glory" anywhere in `Modules/`. HotG's requirement and generation stats have no stat map. PoB computes HotG at its full attack rate. | `act_str.lua:7183-7184` |
| HotG's quality effect | The data is there and is turned on for Gemling (see the shared section), but the stat is unmapped, so nothing changes. | `act_str.lua:7143-7145` |
| Fury of the King's Glory line | Unparsed. | `ModCache.lua:6691` (the 5-Glory form) |
| Everlasting Glory | Unparsed. | `ModCache.lua:6683`; `tree.lua:45901` |
| Rage | Config-gated: you enter the stack count, and PoB caps it at maximum Rage. | `ConfigOptions.lua:964`; `CalcPerform.lua:778-781` |
| Berserk's +maximum Rage from quality | Applied. | `act_str.lua:1511-1513` |
| Hateforge's Glory-conditional Rage | Partly parsed, so dropped. PoB's Rage cap ends up 9 low. | `ModCache.lua:251` (the +15 form; mod `UniqueMutatedVaalMaximumRagePerGlorySkillUsed`, `ModItemExclusive.lua:4936`) |
| Medved's Felling | Attack speed per Rage is mapped; the life loss isn't (moot under CI). | `SkillStatMap.lua:575-576` |
| Surrounded | Automatic once the roll is 4: the minimum drops to 1 and an enemy is within the radius. A roll of 2–3 needs the config option. | `CalcPerform.lua:523-525`; `ModCache.lua:6624`; `ConfigOptions.lua:1114` |
| Defy II | Lucky hits are mapped. The mana clause is unmapped, but PoB never blocks a skill for lack of mana anyway. | `SkillStatMap.lua:1032-1033` |
| Wither | Config stack count. The quality frequency stat only sets the flag that lets the skill Wither (`Condition:CanWither`). | `ConfigOptions.lua:1722`; `act_int.lua:23328` |
| Aftershock | Mapped to `AftershockChance`, which no calculation module reads, so it adds zero. The tree's aftershock lines are unparsed. | `SkillStatMap.lua:2705-2706`; `ModCache.lua:2256` |
| Palm of the Dreamer | Extra chaos parsed; the Gloom Shrine line unparsed. | `ModCache.lua:5508`, `:5897` |

**Net effect:** the hit is right. The DPS is right only in the infinite state, and only by accident. Aftershock and the 9 lost Rage under-state it. Withered stacks depend on the config.

### 5. Could our tool reach it?

- **Would R1a (concept research) propose it? Probably not the engine.**
  - The gem lookup shows "Requires 20 Glory to use" and the "Conditional" tag. The search for the ascendancy's nodes shows Advanced Thaumaturgy's generic line.
  - Nothing shows HotG's quality effect. `qualityLines` reads only `qualityStats` (`Lookup.lua:128-145`). `describeStatSet` builds stats without the alternate-quality flag (`Lookup.lua:115`), so mechanic search never indexes these lines.
  - A "not consume Glory" search finds only Everlasting Glory's 15%. A "Glory" search with `kind: unique` finds Fury of the King, and with `kind: mod` finds the mutated Rage mod.
  - R1a would most likely propose HotG as a boss nuke with another skill clearing.
- **Would the lookups surface the links? Two of the four:** Fury of the King and Everlasting Glory, yes. HotG's quality effect, no. Defy II only through an "Insufficient Mana" query.
- **The real risk is the gate.** PoB shows HotG as if it were spammable, so a Glory-limited concept passes the D1 gate (D1 is endgame design; its gate compares the rolled skill's figure) on an inflated figure.
  - Coverage flags the Glory line as "possibly unmodelled; check config", but no config option for Glory exists.
  - Of the 14 active skills PoB tags `HasUsageCondition`, no calculation module reads the tag.
- **D-122 and D-148:** the actual build passes both: HotG is the main damage source (D-122) and it's the clear skill (D-148).
- **D-234 (chaos resistance capped unless infeasible):** CI is the named exception reason in `D1.md` step 8.
- **What's missing:**
  - visibility of quality effects;
  - a rule that a usage-gated skill needs a use-rate ledger entry;
  - a 40%-quality threshold stage;
  - the priming step for weapon set 2;
  - a hand calculation for Aftershock.

### 6. Inspiration

- **Lookup: expose quality effects** (`Lookup.lua` qualityLines and mechanic search; `Coverage.lua:389-401` when the build has the Gemling flag). Labelled "Gemling only". **Cheap.** Without it, Gemling rolls are blind to the ascendancy's signature node.
- **R1a/D1: a Conditional skill gets a usage-gate ledger.** If the rolled skill's tags include "Conditional", PoB's figure is an upper bound. D1 ledgers uses per second (income ÷ requirement) unless a 100% no-consume is reached. **Cheap**, and it sharpens I2 (`check_model_coverage` flags unparsed damage lines) from damage lines to usage gates.
- **I1 (a resource-flow pass in concept research): strengthened.** It finds 3 of the 5 links here. Add two things:
  - re-run it on the next bottleneck once a gate falls;
  - for any resource the build zeroes, search drawbacks priced in that resource (P5).
  - **Cheap judgment.**
- **I4 (a named stage for a level-gated engine item): generalise it to threshold-gated engines** (quality 40%, Constricting Command's roll of 4). Before the threshold the campaign can't spam HotG. **Cheap wording** in D2 (campaign planning).
- **I3 (input demand as a con): mildly strengthened.** The weapon-set-2 priming ritual per map belongs in At a glance.
- **Don't attempt:**
  - modelling Glory in the bridge;
  - mapping which mutated or Vaal outcomes land on which unique;
  - patching `vendor/`.

---

## Shared question: how PoB 0.23.1 models Gemling Legionnaire

- **Gem Studded** (the bonus chosen by the most numerous support colour; `tree.lua:73882-73885`). Each colour's line is parsed:
  - Blue becomes `ManaCost` MORE −30, mana only (`ModCache.lua:4878`).
  - Green is −40% movement penalty (`ModCache.lua:5902`).
  - Red is "no crit damage bonus against you" (`ModCache.lua:6563`).
  - **Counting** (`CalcSetup.lua:2106-2135`):
    - every non-hidden support in every **enabled** group counts;
    - disabled gems don't count (`supportEffect` is reset at 1781 and set only inside `if gemInstance.enabled`, 1783);
    - disabled groups don't count (2110);
    - **weapon sets are ignored:** the comment at 2103-2105 admits PoB counts every set's supports.
  - **Ties are wrong.** An if/elseif at 2155-2162 grants one colour: Red wins any tie involving Red, Green beats Blue. The text says "for each colour … that is most numerous", and the guides' balancing only makes sense if ties give all tied colours. So a balanced build gets Red only in PoB.
  - Lineage supports are colour 4 and never counted (Medved's Felling, `other.lua:11058`).
  - Thaumaturgical Infusion uses the same counts.
  - Integrated Efficiency counts per skill (`CalcOffence.lua:684-720`).
- **Advanced Thaumaturgy** ("Gem Quality grants Socketed Skills an additional effect").
  - It is parsed to a `GemlingQuality` flag (`ModCache.lua:5683`).
  - The flag is read from allocated nodes (`CalcSetup.lua:835`). `CalcTools.lua:147-152` then adds each gem's `altQualityStats` times quality, on top of normal quality. Every skill effect gets this (`CalcActiveSkill.lua:91`, `:557`).
  - Quality from Skill Gem Quality and Paragon is folded in (`CalcSetup.lua:486`).
  - **The data matches the game:** HotG 2.5/1% (`act_str.lua:7144`), Berserk 0.4/1%, Wither −25 ms. All three match the frames exactly. Snipe's is `active_skill_attack_speed_+%_final` at 1 per 1%, mapped (`act_dex.lua:7232`).
  - **Application depends on a stat map.** Of 244 such stats in the active and support files, 197 have a map and 47 don't (HotG's and Walking Calamity's Glory stat among them). A map isn't a guarantee: Wither's frequency maps to a flag only.
- **Implanted Gems:** +2 levels by attribute, applied through `GemProperty` (`ModCache.lua:329`, `CalcSetup.lua:480-484`).
- **Adaptive Capability:** flag (`ModCache.lua:4827`), used only by the requirement checks (`CalcPerform.lua:1820`).
- **Augmented Flesh:** +2 `SkillSlots` (`tree.lua:52690`), used only for a warning (`CalcPerform.lua:3605`).
- **Essence of Virtue / Virtuous Barrier:**
  - The skill is granted (`ModCache.lua:5889`).
  - Motes start at 3 per attribute (`CalcSetup.lua:1485`). Each *enabled active* gem in an enabled group adds 2 (1 per attribute for gems with two requirements) (`CalcSetup.lua:1857-1871`).
  - Full motes are assumed; motes lost when hit aren't modelled.
  - Filler gems in disabled groups give nothing; enabled filler buffs also apply their own effects.
  - The green "energy shield delay" stat maps to increased ES (`other.lua:19666-19667`). It looks mis-mapped; unverified.
- **Glory and the related lines:**
  - Glory itself: invisible.
  - Everlasting Glory: unparsed.
  - Zerphi's Infamy: its 50% more damage and area apply unconditionally, but its 50-Glory requirement is unmapped (`sup_str.lua:8221-8233`).
  - Defy II and Surrounded: as in the table above.
  - Medved's and Berserk's life drawbacks: moot under CI (life is 1). Berserk's is mapped as degen (`act_str.lua:1500-1502`); Medved's is unmapped.

### What this means if a randomizer rolls Gemling Legionnaire

- **Headless PoB sees:**
  - the Gem Studded bonuses (but under-applied on ties, and counting every weapon set);
  - colour-count max resistances and per-skill colour bonuses;
  - gem levels and quality;
  - Virtuous Barrier at full motes;
  - mapped quality effects, once the build allocates Advanced Thaumaturgy.
- **Our tool is blind to every quality effect, in both lookups and coverage.** R1a can't discover the ascendancy's key synergies, and coverage never flags an unmapped one.
- **D1 would hand-calculate:**
  - which Gem Studded colours really apply;
  - any unmapped quality effect the concept relies on;
  - Glory and usage gates;
  - the Virtuous Barrier mote assumption;
  - Aftershock.
