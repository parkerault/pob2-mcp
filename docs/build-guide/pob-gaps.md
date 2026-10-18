# PoB gaps and bugs

This is a running list of what our pinned Path of Building gets wrong or doesn't model. The pin is
PathOfBuilding-PoE2 v0.23.1, for game 0.5.4, under `vendor/PathOfBuilding-PoE2/src/`.

**Who reads it.** The verification phase uses it when it labels how far PoB follows each link of a candidate
build. The coverage checker could also flag entries from it (idea I14). It is also a starting point for
upstream bug reports.

**How to add an entry.** Add one entry per gap as it's found, cite `file:line`, and say which build showed it.
Started 2026-10-10 from the reference-build studies (`reference-builds.md`, `worklog.md`).

**Kinds:**

- **bug:** PoB applies a rule wrongly.
- **half:** PoB applies a mechanic's penalty but not its benefit, which is the most misleading kind.
- **gap:** PoB doesn't model the mechanic, so it shows zero or a default.
- **data:** game data is missing, out of range or stale.
- **ours:** our bridge or lookup, not PoB.

**Status:**

- **confirmed:** I read the code at the cited line.
- **reported:** an agent or an earlier document cited it, and it hasn't been re-checked.

All `ModCache.lua` lines cited below as unparsed were re-checked on 2026-10-10 (`{nil,…}`). So were all the
skill stats cited as unmapped: no entry in `Data/SkillStatMap.lua`, in any skill's own `statMap`, or in
`Modules/`.

**Workarounds:**

- **Count:** the skill group's Count multiplies its Full DPS.
- **custom mod:** a hand-calculated result typed in as a custom modifier.
- **config:** a config option stands in for the mechanic.
- **hand calc:** worked outside PoB.
- **type it:** paste or type the item's text.

## Bugs and half-modelled mechanics

- **PG-1, Gem Studded gives one colour on a tie.** bug, confirmed.
  - **Where:** `Modules/CalcSetup.lua:2155-2162`. It's an if/elseif: red wins any tie it's in, and green beats
    blue. A 17/17/17 balance gets only Red.
  - **Seen in:** perra's Gemling builds.
  - **Workaround:** a custom mod for the missing colour's bonus.
- **PG-2, a skill granted by a support takes the support gem's level.** bug (suspected), confirmed in code.
  - **Where:** `Modules/CalcSetup.lua:1850-1876` builds the granted effect with `level = gemInstance.level`,
    the support gem's level. +level mods are matched against the support's tags.
  - **Effect:** in Infernal Cry Gemling, Paquate's Pact's Twisted Pact computes at about level 3. The creator
    shows level 39, which is about 400× more base damage.
  - **Not verified:** the game rule itself. The creator says the granted skill takes the host's level.
  - **Workaround:** set the support gem's level by hand (untested).
- **PG-3, Muster counts minion types by granted effect.** bug (possible), confirmed in code.
  - **Where:** `Modules/CalcPerform.lua:1343-1347` counts persistent minion skills by `grantedEffect.id`.
    Every spectre counts as one type, and Supporting Fire counts too. The game says "different type of
    Reviving Minion".
  - **Seen in:** Supporting Fire Tactician, Varashta.
- **PG-4, Mirage Archer never produces mirages.** half, confirmed earlier.
  - **Where:** `skill_can_own_mirage_archers` appears only at `Data/SkillStatMap.lua:276`, and no gem has it.
  - **Effect:** PoB shows one player Snipe at the support's 30% less damage, instead of about 6 mirages.
  - **Seen in:** Mirage Sniper.
  - **Workaround:** Count = mirages up at once.
- **PG-5, Kaom's Madness.** half, reported.
  - **Effect:** the +3 fissures aren't mapped, but the penalties apply.
  - **Seen in:** Glacial Bolt.
  - **Workaround:** Count.
- **PG-6, Spell Cascade.** half, reported.
  - **Effect:** its 30% less damage applies, but the extra cascades don't.
  - **Seen in:** Enervating Nova.
  - **Workaround:** Count 1–3, by how many novas hit one target.
- **PG-7, Glory gates aren't modelled.** gap (optimistic), confirmed earlier.
  - **Where:** no file in `Modules/` mentions Glory. "Glory generation" lines are unparsed
    (`Data/ModCache.lua:1660`).
  - **Effect:** a Glory-gated skill (Hammer of the Gods, Starborn Onslaught, Walking Calamity) computes as if
    spammable.
  - **Workaround:** hand calc the usage rate.
- **PG-8, a lucky roll is averaged as if the roll were uniform.** gap, reported.
  - **Where:** `Modules/CalcOffence.lua:4077` uses min/3 + 2·max/3. With Esh's min-or-max rolls
    (`lightning_damage_roll_always_min_or_max`, unmapped), a lucky hit lands at the max 75% of the time, not
    67%.
  - **Effect:** about 7% low at 48% lucky.
  - **Seen in:** Enervating Nova.
- **PG-51, PoB's own copy of a tree-granted summon is level 1, with no supports.** bug (possible), confirmed in
  code (`studies/2026-10-16-minion-skill-spike.md`, A4).
  - **Where:** allocating a node whose line grants a summon ("Grants Skill: Navira, the Last Mirage", node 32705,
    parsed at `level=1`, `Data/ModCache.lua:5869`) makes PoB add a group for it at the end of the socket
    groups as they stand at that calculation (before the plan's groups when the compile calculates before building
    them; D-382 finds the plan's groups wherever it lands), at the mod's level, and empty its gem list to the active
    gem on every calculation (`Modules/CalcSetup.lua:1503-1542`, the wipe at `:1540`).
  - **Effect:** Navira's Fracturing measures 9.6 DPS from PoB's copy, against 1,027 from a socketed level-20
    group with four supports. Which level the game uses needs a source.
  - **Seen in:** Varashta; the baseline guide's PoB models a socketed group.
  - **Workaround:** model the summon as a socketed level-20 group, with supports by D-359's estimate.
- **PG-54, loading a PoB drops the supports in a granted skill's group.** bug (possible), confirmed in code and on
  load (the Varashta comparison, 2026-10-17; D-398). The load side of PG-51.
  - **Where:** PoB rebuilds every granted group, a passive's (`Tree:<node>`) or an item's skill, from its grant on
    every calculation (`Modules/CalcSetup.lua:1503-1542`). A group whose granted gem's level differs from the grant
    isn't matched: PoB adds a new group with the granted gem alone (`:1516-1520`) and removes the old one
    (`:1655-1666`). A matched group's gem list is wiped back to the granted gem (`:1540`). PoB marks a passive's
    granted skill `noSupports` (`:253`).
  - **Effect:** a file, probably saved by a newer PoB, that holds supports in such a group loses them silently on
    load, and every figure after that is measured without them. A save writes the group back without them.
  - **Seen in:** Varashta: Navira's PoB holds supports in Navira's and Kelari's granted groups and in its sceptre's
    Purity of Ice group.
  - **Warning:** every tool reply that loads or imports a build file (a load, a reload, an import, the session's
    reload of a changed file, a temporary load) names each dropped gem, its group and the passive or item that
    grants it, one line per group (D-398).
  - **Workaround:** PG-51's: model the skill as a socketed group and put the supports there.

## Gaps: triggers and engines (the build's damage engine is invisible)

- **PG-9, energy-based meta gems aren't modelled.** gap, confirmed.
  - **Where:** trigger configs are looked up by lowercase skill name (`Modules/CalcTriggers.lua:1447-1453`).
    The only entry, `"cast on critical strike"` (`:1089`, attack-only), is a PoE1 leftover and never matches
    the PoE2 "Cast on Critical" (`Data/Skills/act_int.lua:2057`). Nothing in `Modules/` models energy.
  - **Affects:** Cast on Critical, Cast on Minion Death, Cast on Elemental Ailment and the other energy meta
    gems.
  - **Seen in:** Oracle Entangle, Widowhail Spark, Earthshatter, Bone Cage, The Eraser.
- **PG-10, the Concussive Runes shockwave doesn't exist in PoB.** gap, confirmed.
  - **Where:** `Data/Gems.lua:19614` grants `ConcussiveRunesPlayer`, which has no `skills[...]` entry.
    `support_trigger_pummel_on_heavy_stun` is unmapped.
  - **Seen in:** Flicker Monk, Ancestral Cry Titan.
- **PG-11, Archon of Undeath isn't modelled.** gap, confirmed.
  - **Where:** absent from `Modules/`. Its proc line (`ModCache.lua:1582`) and Dominion's no-recovery line
    (`:4761`) are unparsed.
  - **Seen in:** Supporting Fire, Varashta.
  - **Workaround:** Count (about 2.5 for a command limited by its cooldown).
- **PG-12, crossbow reload triggers.** gap, confirmed.
  - **Where:**
    - Double Vision's "When you reload, triggers Gemini Surge…" is unparsed (`ModCache.lua:6901`).
    - Double Barrel III's `crossbow_reload_on_heavy_stun` is unmapped.
  - **Seen in:** Crossbow Titan.
  - **Workaround:** hand calc: surge hit × bolts per second.
- **PG-13, Ancestral Cry's Volcanic Steps rate.** gap, confirmed.
  - **Where:** `ancestral_cry_triggers_shockwave_every_X_units_travelled` is unmapped
    (`Data/Skills/act_str.lua:103`).
  - **Workaround:** Count = movement speed ÷ 12.
- **PG-14, Trickster's Shard mimics.** gap, confirmed.
  - **Where:** `skill_used_by_fractured_mimic_spell_damage_+%_final` and
    `support_tricksters_shard_maximum_active_mimics` are unmapped (`Data/Skills/other.lua:19107, 19181`).
  - **Workaround:** Count.
- **PG-15, Now and Again's repeat chance.** gap, confirmed.
  - **Where:** "Repeatable Spells have 20% chance to Repeat" is unparsed (`ModCache.lua:6622`).
  - **Workaround:** Count ×1.2.
- **PG-16, the Primal Bounty chain.** gap, confirmed.
  - **Where:**
    - `multishot_empowered_projectile_speed_+%` is unmapped;
    - the extra-projectile count isn't in the data;
    - The Mhacha's Gift is unparsed (`ModCache.lua:5222`).
  - **Seen in:** Twister Spirit Walker.
- **PG-17, Midnight Zenith's petals and crystals.** gap, reported.
  - **Effect:** nothing models petal gain or crystal creation, and the shatter bonus has no number.
  - **Seen in:** Eventide Petals.
  - **Workaround:** Count = crystals shattered per second.
- **PG-18, Accelerated Growth's Overgrown explosion.** gap, reported.
  - **Seen in:** Oracle Entangle.
- **PG-19, Melting Maelstrom's mana nova.** gap, confirmed.
  - **Where:** "Every 3 seconds during Effect, deal 100% of Mana spent…" is unparsed (`ModCache.lua:5363`).
  - **Seen in:** Maelstrom Shaman.
- **PG-20, Corpsewade's movement trigger.** gap, reported.
  - **Effect:** PoB treats Decompose as a self-cast.
  - **Seen in:** Maelstrom Shaman.
- **PG-21, copies and spreads.** gap, reported.
  - **Effect:** Tornado Shot's copies count as zero. Contagion's spread isn't modelled.
  - **Seen in:** Stormcaller, The Eraser.

## Gaps: damage and defence stats

- **PG-22, Verglas.** gap, confirmed.
  - **Where:** `support_crystalshatter_buff_damage_%_gained_as_extra_cold_per_2000_crystal_life` is unmapped
    (`Data/Skills/sup_int.lua:8560`).
  - **Seen in:** Earthshatter, Stormcaller.
  - **Workaround:** custom mod "X% of Damage as Extra Cold" with X = crystal life ÷ 2000.
- **PG-23, Earthshatter's more damage per spike.** gap, confirmed.
  - **Where:** `earthshatter_damage_+%_final_per_spike` is unmapped (`Data/Skills/act_str.lua:4298`).
- **PG-24, aftershock chance is mapped but never read.** gap, confirmed.
  - **Where:** `AftershockChance` (`Data/SkillStatMap.lua:2706`) appears nowhere in `Modules/`.
  - **Workaround:** Count.
- **PG-25, Kelari's Deception's per-use ramp.** gap, confirmed.
  - **Where:** `djinn_damage_+%_final_per_teleport_in_sequence` is unmapped (`Data/Skills/minion.lua:2330`).
  - **Workaround:** custom "more" at the expected step.
- **PG-26, Enervating Nova's edge-distance bonus.** gap, confirmed.
  - **Where:** `new_shock_nova_distance_based_damage_+%_final` is unmapped.
- **PG-27, Selfless Remnants and The Hollow Mask relay remnants to allies.** gap, confirmed.
  - **Where:** `remnants_affect_allies_in_presence_instead` is unmapped (`Data/Skills/sup_str.lua:6617`). The
    Hollow Mask line is unparsed (`ModCache.lua:6609`).
  - **Workaround:** the custom mod "Allies in your Presence Gain N% of Damage as Extra Chaos Damage"
    (`ModCache.lua:3817`), with Count = the number of minions.
- **PG-28, Scouring Flame's support stat.** gap, reported.
  - **Effect:** the ignite is about 2.25× low.
  - **Seen in:** The Eraser.
- **PG-29, Stormcaller's arrow count and Barrage's charge retention.** gap, reported.
  - **Effect:** neither multiplies DPS.
- **PG-30, Arctic Armour's armour per stage.** gap, confirmed.
  - **Where:** `arctic_armour_armour_granted_+%_per_stage` is unmapped (`Data/Skills/act_int.lua:299`).
  - **Effect:** armour is under-reported, and so is anything scaled from it (Refraction III's exposure).
- **PG-31, Gemling quality effects.** gap, confirmed earlier.
  - **Where:** 47 of the 244 `altQualityStats` are unmapped, including Hammer of the Gods' Glory stat.

## Gaps: conditions, states and item lines

- **PG-32, "Your Hits are Crushing Blows" (Titan's Crushing Impacts).** gap, confirmed (`ModCache.lua:7010`).
  - **Workaround:** config "Is the enemy Heavy Stunned?".
- **PG-33, chill-shatter** (Polcirkeln, Loreweave). gap, confirmed (`ModCache.lua:5259`).
- **PG-34, Spirit of the Wolf** (Rite of Passage). gap, confirmed (`ModCache.lua:6449`).
- **PG-35, The Taming's multiple ground surfaces.** gap, confirmed (`ModCache.lua:6907, 6915`).
  - **Workaround:** config, ticking all three ground boxes.
- **PG-36, Way of the Stonefist's glove transform.** gap, confirmed (`ModCache.lua:5692`).
  - **Workaround:** type the transformed mods.
- **PG-37, other unparsed lines:**
  - Thaumaturgical Dynamism (`ModCache.lua:5893`);
  - Magnum Opus's charm effect per empty slot (`:5022`);
  - Eventide's crystal life per cold resistance (`:5949`);
  - Puppet Master stacks (`:1572`, empty parse).

  All gaps, confirmed.
- **PG-38, Empowering Remnants.** gap, confirmed (`ModCache.lua:1574`): parsed with text left over, so it isn't
  applied (`Classes/Item.lua:2138`).
- **PG-39, more unparsed item lines.** gap, reported in the first study:
  - Cadiro's Gambit;
  - Opportunity;
  - Everlasting Glory;
  - Fury of the King's Glory line.
- **PG-40, a minion's command is never checked against the passive that grants it.** gap (optimistic),
  confirmed (`studies/2026-10-16-minion-skill-spike.md`, A4).
  - **Where:** a passive's "Grants Skill: <command>" line parses to nothing (`Data/ModCache.lua:5723` Kelari's
    Deception, `:5866` Navira's Fracturing; `{nil,nil}`), because `grantedExtraSkill`
    (`Modules/ModParser.lua:2181-2188`) finds no gem of that name. The command comes from the djinn's skill list
    instead, which `calcs.createMinionSkills` builds from the minion's static data whatever the tree holds
    (`Modules/CalcActiveSkill.lua:1112-1130`).
  - **Effect:** PoB computes the command with or without its passive: Navira's Fracturing measured 1,027 DPS with
    node 10561 unallocated. The unparsed line loses nothing, so it isn't a modelling gap.
  - **Seen in:** Varashta.
  - **Workaround:** none for the numbers; V1's `not-granted` reports a stage that uses the command without its
    passive (D-380).
- **PG-52, At your Command adds nothing.** gap (pessimistic), confirmed in code (the Varashta run, 2026-10-17).
  - **Where:** the Disciple of Varashta notable's line, "Minions deal 10% increased Damage with Command Skills for
    each different type of Persistent Minion in your Presence", parses to a minion modifier whose multiplier
    `PersistentMinionTypes` has no `actor = "parent"` (`Data/ModCache.lua:6224`). PoB sets that multiplier only on
    the player's mod list (`Modules/CalcPerform.lua:1344-1348`), so on the minion it is 0. Muster reads the same
    multiplier with `actor = "parent"` and gets it (`Data/Skills/sup_int.lua:7121`).
  - **Effect:** PoB measures a command skill without the bonus, 10% per persistent minion type.
  - **Seen in:** Varashta: Navira's Fracturing with Skeletal Warrior, Skeletal Arsonist and Navira.
  - **Workaround:** a `config.customMods` stand-in for the bonus at the stage's type count, with its reason
    (D-293), as the run's plan did.
- **PG-53, Muster counts minions that don't revive.** gap (optimistic), confirmed in code (the Varashta run,
  2026-10-17).
  - **Where:** Muster says "more Damage the more different kinds of Reviving Minions you have summoned", but PoB's
    count takes every active skill with the Minion and Persistent skill types (`Modules/CalcPerform.lua:1344-1347`).
    That includes Navira, the Last Mirage, which can't be damaged (`MinionsAreUndamagable`,
    `Data/Skills/other.lua:12311`), and Cast on Minion Death, a meta skill typed Minion and Persistent
    (`Data/Skills/act_int.lua:2760`).
  - **Effect:** Muster's more multiplier, and PG-52's stand-in if it uses PoB's count, run one or two types high.
  - **Seen in:** Varashta.
  - **Workaround:** count the reviving minion types by hand and say so in the plan's reason for the figure.

## Data: missing, out of range, or stale

- **PG-41, rolls above PoB's data range.** data, reported. Each has to be typed in:
  - Widowhail 280% against PoB's (150-250)% (`Data/Uniques/bow.lua:123`);
  - Chober Chaber +4 against +(2-3) (`Data/Uniques/mace.lua:179`), likely a corruption;
  - Fireflower +6 against +(1-4), and Sunsplinter +4 against +(1-3).
- **PG-42, mutated (Vaal) uniques aren't in the unique data.** data, reported. They import as mutated lines
  (`Classes/Item.lua:501`). Seen in the Mana Flare Shaman's Rathpith Globe.
- **PG-43, uniques missing from the data.** data, reported:
  - Loreweave;
  - the Runemastered Olrovasara (`Data/Uniques/mace.lua:78` has two variants);
  - Tasalio's per-stack lines.
- **PG-44, values that lag the live game.** data, reported:
  - The Mhacha's Gift: 3 feathers in game, 2 in PoB;
  - Midnight Zenith's level requirement: 18 on screen, 55 in data;
  - Dialla's Desire quality: 10% on screen in 0.4, 5% in PoB (possibly a patch change).
- **PG-45, rate caps aren't in the data.** data, reported. Inner Turmoil's Volatility cap (one stack per
  0.1 s) has no number.

## Ours: our bridge and lookup

- **PG-46, the lookup is blind to Gemling quality effects.** ours, confirmed. `describeStatSet` passes only level
  and quality, and `qualityLines` reads only `qualityStats` (`pob-api/API/Lookup.lua`). Idea I5.
- **PG-47, the compiler never uses Count.** ours, confirmed. Every group is created with Full DPS off
  (`pob-api/API/Compile.lua:632`), and nothing sets `groupCount`. Amendment 3 changes this.
- **PG-48, the lookup's search is limited.** ours, confirmed earlier:
  - mechanic search is a substring match capped at 20–30 results;
  - it doesn't search item-base implicits (I7).
- **PG-49, coverage gives Mirage Archer a false all-clear.** ours, reported (I2).

## Earlier, from the design brief (2026-10-07)

- **PG-50, Blood Hunt's explosion** isn't modelled, and Blood Loss mods are dropped by the parser. Reported;
  this motivated the build-guide workflow's "don't trust engine rankings alone" rule.
