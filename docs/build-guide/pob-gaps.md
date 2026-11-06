# PoB gaps and bugs

This is a running list of what our pinned Path of Building gets wrong or doesn't model. The pin is
PathOfBuilding-PoE2 v0.23.1, for game 0.5.4, under `vendor/PathOfBuilding-PoE2/src/`.

**Who reads it.** The verification phase uses it when it labels how far PoB follows each link of a candidate
build. The coverage checker could also flag entries from it (idea I14). It is also a starting point for
upstream bug reports: `pob-upstream.md` says which entries upstream already has as an issue, a PR or a fix on `dev`.

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
- **closed:** suspected, then found to match the game; kept so the question isn't asked again.

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
  - **Seen in:** perra's Gemling builds; the Arc Totems, Ballista and Grenades Gemlings (the Mobalytics review).
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
  - **Seen in:** Mirage Sniper; the Run n Gun Witchhunter and the Grenades Gemling (the Mobalytics review).
  - **Workaround:** Count = mirages up at once.
- **PG-5, Kaom's Madness.** half, reported.
  - **Effect:** the +3 fissures aren't mapped, but the penalties apply.
  - **Seen in:** Glacial Bolt; the Shield Wall Smith, on Ahn's Citadel (PG-60).
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
  - **Seen in:** the Autobomber Shaman's Apocalypse (the Mobalytics review).
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
    grants it, one line per group (D-398). A temporary load's lines name the file. A group nothing grants (its
    passive isn't allocated, its item isn't equipped) is removed with its supports, and its line says so.
  - **Workaround:** PG-51's: model the skill as a socketed group and put the supports there.
- **PG-71, socketed supports are counted across both weapon sets.** bug, confirmed in code and in game (the user's
  test on Gem Studded, 2026-10-19).
  - **Where:** `Modules/CalcSetup.lua:2101-2105`, PoB's own comment: "Currently PoB2 doesn't associate weapon skill
    supports with the actual weapon sets so it ends up counting all support gems when it should only take into
    account the active weapon set". The loop after it (`:2106-2131`) counts every enabled group's supports by
    colour, whichever weapon set its slot is in, into the `RedSupportGems`, `GreenSupportGems` and
    `BlueSupportGems` multipliers (`:2132-2134`).
  - **Effect:** the game counts only the active weapon set's socketed supports (the user checked Gem Studded's
    "most numerous colour" on their Gemling), so PoB overstates Gem Studded, and any modifier that counts socketed
    supports, on a build with a skill in weapon set 2.
  - **Seen in:** the weapon-set review (work-log 2026-10-19). The [hotg] study's "Gem Studded counts every set's
    supports" predates the game's 0.5.5 fix to the inactive set.
  - **Workaround:** hand calc the active set's support count, and type the difference in as a custom mod.
- **PG-72, Avatar of Fire drops gained cold and lightning.** closed: PoB matches the game (the user's ruling,
  2026-10-23, amendment 9 §24.1).
  - **Where:** the keystone's "Deal no Non-Fire Damage" sets `DealNoPhysical`, `DealNoLightning`, `DealNoCold` and
    `DealNoChaos` (`Modules/ModParser.lua:2399`); `canDeal` reads them (`Modules/CalcOffence.lua:2238-2241`), and a
    hit sums only the types it can deal, after conversion and gain (`:4023`). So cold or lightning gained as extra is
    lost, while flat cold or lightning converted to fire stays.
  - **The question:** at the open-clear run's verification gate (2026-10-19) the user ruled that gained cold and
    lightning convert to fire before the keystone applies, and build r1-b-3 carried that as custom modifiers. The
    user withdrew the ruling on 2026-10-23 ("after doing more research that turns out not to be the case"), and the
    creator's video agrees with PoB (`studies/2026-10-23-spud-warcryer-comparison.md` §5). The library's damage-order
    rule records it (`references/patterns.md`, How to read an entry).
  - **Workaround:** none needed; a build under Avatar of Fire rolls gained fire, not gained cold or lightning.
- **PG-74, an item's granted skill takes the supports of every group in its slot.** bug, confirmed in code
  (amendment 9 §24.2, WU-102's fix round, 2026-10-23).
  - **Where:** PoB files each enabled group's supports under its slot, " Swap" stripped, when the group is socketed in
    one (`Modules/CalcSetup.lua:1727-1732`, then `supportLists[slotName][group]`); an item-granted group (one with a
    `source`) then takes every support filed under its slot, from every other group there (`:1913-1928`, "if skill
    granted by unique item, go through all support groups in slot"). A plain group's own supports stay its own.
    The slot also feeds curse priority (`Modules/CalcPerform.lua:547`: `Weapon 1` adds 1000 and `Weapon 2` 4000,
    `Modules/Data.lua:351-354`, a group with no slot nothing) and trigger matching with an item-granted skill
    (`Modules/CalcTriggers.lua:35`, `:228`).
  - **Effect:** in the game a skill gem's supports support it alone, and a weapon's granted skill (a spear's Spear
    Throw, a shield's Raise Shield, a wand's or a sceptre's skill) has none of them. A group socketed in a weapon slot
    overstates that weapon's granted skill. WU-102's probe: a Hardwood Spear beside a group of Rapid Assault and
    Brutality I in `Weapon 1` raises Spear Throw's TotalDPS from 2.66 to 3.15 and its explosion's from 4.84 to 5.93.
  - **Seen in:** WU-102's verification (a group with `weaponSet`, socketed in its set's main hand).
  - **How the compiler avoids it:** a plan group with `weaponSet` goes in its set's weapon slot whose item grants no
    skill, the off-hand (an empty slot grants none) when the main hand's does (`groupWeaponSlot`). When both of the
    set's slots hold a granting item (a spear and a shield), it stays in the main hand, and V1's
    `weapon-skill-supports` names the granted skill whose figure PoB overstates. A group with no `weaponSet` has no
    slot, so it leaks nothing.
  - **Workaround:** put the group on the other weapon set or on both, or don't read the granted skill's figure from
    that stage.

## Gaps: triggers and engines (the build's damage engine is invisible)

- **PG-9, energy-based meta gems aren't modelled.** gap, confirmed.
  - **Where:** trigger configs are looked up by lowercase skill name (`Modules/CalcTriggers.lua:1447-1453`).
    The only entry, `"cast on critical strike"` (`:1089`, attack-only), is a PoE1 leftover and never matches
    the PoE2 "Cast on Critical" (`Data/Skills/act_int.lua:2057`). Nothing in `Modules/` models energy.
  - **Affects:** Cast on Critical, Cast on Minion Death, Cast on Elemental Ailment and the other energy meta
    gems.
  - **Seen in:** Oracle Entangle, Widowhail Spark, Earthshatter, Bone Cage, The Eraser; the Plant Oracle and the
    Storm Wave Invoker (Cast on Critical), the Glacial Lance Ritualist (Cast on Charm Use).
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
  - **Seen in:** Crossbow Titan; the Run n Gun Witchhunter's reload items (Ratha's Assault, Arjun's Medal).
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
- **PG-33, chill-shatter** (Polcirkeln, Loreweave). gap, confirmed (`ModCache.lua:5259`). Seen in the Shaman Bear
  (the Mobalytics review).
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

  Reported by the Mobalytics review's coverage checks (2026-10-18), not re-checked: The Natural Order's four lines
  (the Beast Master); Trampletoe's overkill splash, partly parsed and so dropped (the Autobomber); Mind Phylacteries
  (the Glacial Lance Ritualist).
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
- **PG-55, a "Runic Ward:" line isn't read, so the item's text doesn't read back the same.** bug, confirmed in code
  and on the probe (the M-19 fix batch, 2026-10-18; D-399).
  - **Where:** the item reader takes a "Ward:" line but not "Runic Ward:" (`Classes/Item.lua:608`). On a Runeforged
    rare whose "Runic Ward:" line sits before a socketed rune, PoB's own save re-parses the item
    (`Classes/ItemsTab.lua:1219` through `BuildAndParseRaw`, `Classes/Item.lua:1604`) into text that reads back
    with one more socket and one more rune.
  - **Effect:** in PoB, every save adds a socket and a rune's bonuses, and each parse is slower than the last. Before
    D-399, our session's snapshot after each change did the same, so a heavy build's changes took minutes and its
    figures drifted. D-399's export no longer re-parses items, so our snapshots and saves leave the item as it was.
    The item's Runic Ward itself still isn't counted.
  - **Seen in:** the Varashta comparison: Navira's PoB holds such an item (its figures measured after changes may
    hold extra rune bonuses; the comparison's §8).
  - **Workaround:** none needed for our tools since D-399. In PoB itself, re-import the item after a save.
- **PG-56, PoB has no rare monster modifiers, and no way to give a companion one.** gap, confirmed in code
  (amendment 8, D-402, 2026-10-18).
  - **Where:** a companion is only a monster id in the build's beast library: `<BeastCompanion id="…">`, read and
    written by `Modules/Build.lua:1126-1128` and `:1166-1167`. A Companion skill takes its minion list from that
    library (`Modules/CalcActiveSkill.lua:904-905`), and the minion's figures come from its monster's entry in
    `Data/Spectres.lua` (619 monsters; the first at `:10-55`): life, resistances, `companionReservation`, its skills
    and its own base `modList`, with no field for a rare modifier. Nothing in the pin's `Data/` lists rare monster
    modifiers. The character import matches a "Companion:" gem to a monster by name and reservation only
    (`Classes/ImportTab.lua:1017-1035`).
  - **Effect:** a tamed beast keeps up to four of its monster modifiers (the Tame Beast gem's text), and none of them
    reaches PoB: neither a stat such as Hasted's speed nor a ground such as Trail of Ice's Chilled Ground.
  - **Seen in:** Varashta: Navira's guide tames a beast with Frozen Ground Trail for the Chilled Ground that Navira's
    Fracturing consumes; its PoB has no beast.
  - **Workaround:** each modifier's row in `data/monsters/monster-mods.md` says how a plan models it: `stats` as
    custom modifiers, `condition` as a config entry, `none` stated on the card (D-402).
- **PG-73, a unique tame's tablet modifier has no line in the pin.** gap, confirmed in code (amendment 9, D-428).
  - **Where:** a tablet can give unique monsters an extra rare modifier: "Unique Monsters have # additional Rare
    Modifier", stat `map_unique_monster_num_additional_modifiers`. The pin holds it only as text: its stat
    description (`Data/StatDescriptions/stat_descriptions.lua:193127-193140`), the trade site's stat list
    (`Data/TradeSiteStats.lua:15283`, `:33042`) and a scalability entry (`Data/ModScalability.lua:14160-14161`). No
    modifier, base or unique in the pin's `Data/` grants it (it holds no tablet item: its other "tablet" lines are
    stat texts, such as "Tablets found in Area"), and nothing under `Modules/` or `Classes/` reads the stat. A
    companion's figures come only from its species' entry in `Data/Spectres.lua` (Mighty Silverfist at `:23949`;
    PG-56).
  - **Effect:** the Beast Master guide tames Mighty Silverfist, a unique ape, carrying a tablet's extra modifier,
    Extra Crits (300% increased Critical Hit Chance) first, then Enraged or an Extra-x Damage; none of it reaches
    PoB, whose figure for the beast lacks the modifier.
  - **Seen in:** the Beast Master (`studies/2026-10-18-mob-captainlance9-beast-master.md` §4, §8, §9).
  - **Workaround:** as PG-56's: name the modifier's row of `data/monsters/monster-mods.md` in the plan's
    `companion.mods` (Extra Crits is a `stats` row, written as a custom modifier) and say on the card that a tablet
    supplies it (untested on a unique species).

## Found in the Mobalytics review (2026-10-18)

The review's 17 studies (`studies/2026-10-18-mob-*.md`, each one's §9) ran `check_model_coverage` on the lines
their builds rely on; the user approved logging these on 2026-10-19. "Reported (coverage)" means coverage called
the line unmapped or "possibly unmodelled" and no one has read the code; three entries were checked in code.

- **PG-57, Herald of Ice's shatter explosion.** gap, confirmed in code.
  - **Where:** the gem's `display_herald_of_ice_behaviour` maps to `Condition:EnemiesExplode`
    (`Data/Skills/act_int.lua:11806`), which no file under `Modules/` or `Classes/` reads.
  - **Effect:** the explosion, how most of the review's attack builds clear, adds nothing to PoB's figures.
  - **Seen in:** the Shaman Bear, the Wolfman Oracle, the Glacial Lance Ritualist.
  - **Workaround:** hand calc.
- **PG-58, Lunar Blessing's damage gained as cold and its per-Rage duration.** gap, reported (coverage).
  - **Effect:** the wolf build's biggest damage buff, 59% of damage as extra cold, may be missing from PoB's figure.
  - **Seen in:** the Wolfman Oracle.
  - **Workaround:** a custom mod for the gain (untested).
- **PG-59, Bhatair's Vengeance's buff.** gap, reported (coverage).
  - **Seen in:** the Shaman Bear.
  - **Workaround:** a custom mod, 1% extra cold per 2 Rage (the study's stand-in, untested).
- **PG-60, Shield Wall's detonation.** half, reported (coverage).
  - **Effect:** Shield Wall's 100% more when your skill shatters it, the 80% less when enemies break it within 0.5 s,
    and the wall limit are possibly unmodelled. Ahn's Citadel's fissure and Kaom's Madness's 3 extra fissures are
    too, while Kaom's penalties parse, so PoB charges the cost without the gain (PG-5).
  - **Seen in:** the Shield Wall Smith.
- **PG-61, Contagion's ramp,** 100% more per spread, up to 300%. gap, reported (coverage). PG-21 is the spread.
  - **Seen in:** the ED Contagion Lich.
- **PG-62, Eldritch Empowerment.** half, reported (coverage).
  - **Effect:** the 30% more parses; the sacrifice line parses only in part and the recharge line not at all, so
    PoB shows the damage without the energy shield drain.
  - **Seen in:** the ED Contagion Lich.
- **PG-63, plant Overgrowth.** gap, confirmed in code.
  - **Where:** "overgr" appears in no file under `Modules/`, in `Data/SkillStatMap.lua` or in any skill's own
    `statMap`, only in gem descriptions. Sigil of Power's per-stage damage parses; its stage gain doesn't (coverage).
  - **Effect:** Thrashing Vines' 50% more damage and area and Entangle's extra vines on Overgrown plants are missing.
  - **Seen in:** the Plant Oracle.
  - **Workaround:** a custom mod for the more damage; config or a custom mod for Sigil of Power's stages.
- **PG-64, Toxic Growth's stored poison and Gas Arrow's cloud.** gap, reported (coverage).
  - **Effect:** the poison the pustules store, and the cloud's limit and radius growth, are possibly unmodelled.
  - **Seen in:** the Poison Pathfinder.
- **PG-65, Herald of Plague's spread and Herald of Blood's explosion.** gap and bug, confirmed in code (2026-11-06,
  corrected: it said "possibly unmodelled").
  - **Where:** Herald of Plague's spread becomes `PoisonProlifRange` (`Data/Skills/act_dex.lua:3448`), which no file
    under `Modules/` or `Classes/` reads; its Hinder chance has no map. Herald of Blood's explosion is computed: it is
    the gem's second stat set, "Explosion", with its own base physical damage and a 1.5 m radius
    (`Data/Skills/act_str.lua:7593-7664`). Its `baseFlags` are empty (`:7597`), where Herald of Ice's explosion has
    `attack` and `area` (`Data/Skills/act_int.lua:11863-11868`), so PoB gives it neither the Attack nor the Area mod
    flag (`Modules/CalcActiveSkill.lua:167`, `:568-585`). Its share of the enemy's Blood Loss
    (`skill_herald_bleeding_enemies_explode_for_%_blood_loss_as_unscalable_physical_damage`, `:7606`) has no map.
  - **Effect:** the explosion reads its base hit only. Attack-only and area-damage modifiers miss it: "increased Area
    of Effect for Attacks", "increased Attack Area Damage", "increased Attack Damage" and "increased Area Damage". Plain
    area modifiers and supports such as Magnified Area reach it. The Blood Loss share, which grows with the bleeding
    the build stacks, is missing (PG-50). Herald of Plague's spread adds nothing.
  - **Seen in:** the Poison Pathfinder; issue #2573 for the explosion's area and damage.
  - **Workaround:** hand calc.
  - **Upstream:** issue #2573 (open), the attack and area modifiers only; no pull request. The explosion's flags are
    unchanged on `dev` (checked 2026-11-06).
- **PG-66, Storm Lance's detonation.** gap, reported (coverage).
  - **Effect:** the 16-bolt detonation and both spear skills' limit of 3 are "possibly unmodelled; check config".
  - **Seen in:** the Lightning Spear Amazon.
- **PG-67, Elemental Surge and Predatory Instinct's reveal.** gap, reported (coverage).
  - **Effect:** Elemental Surge's trigger is unparsed; Predatory Instinct's 50% more parses, but the reveal of an
    Open Weakness that it needs doesn't.
  - **Seen in:** the Lightning Spear Amazon, the Glacial Lance Ritualist.
- **PG-68, totem count.** gap, reported (coverage).
  - **Effect:** Spell Totem's and Mortar Cannon's totem stats are unmapped; whether PoB's DPS counts more than one
    totem is not established.
  - **Seen in:** the Arc Totems Gemling, the Ballista.
  - **Workaround:** Count = totems up at once.
- **PG-69, minion lines.** gap, reported (coverage).
  - **Effect:** Raging Spirits' summons per cast and its two-per-cast cap, Minion Splash and Sacrificial Lamb (no
    stat map) aren't modelled; Wildshards II's extra projectiles are possibly unmodelled.
  - **Seen in:** both Minion Infernalists.
- **PG-70, "active in both weapon sets" is never read.** gap, confirmed in code.
  - **Where:** `display_skill_reserves_in_all_weapon_sets` sits on four skills, Blink, Convalescence, Sacrifice and
    Eternal Rage (`Data/Skills/act_int.lua:1250`, `:4134`, `:17300`; `Data/Skills/act_str.lua:4885`), and no file
    under `Modules/` or `Classes/`, nor `Data/SkillStatMap.lua`, reads it.
  - **Effect:** PoB can't tell a buff active in both sets from one on set 2 alone. The Wolfman guide says Savage Fury
    on set 2 alone reserves no Spirit; PoB presumably counts it (an inference).
  - **Seen in:** the Wolfman Oracle.

## Found in the boss studies (2026-10-25)

The two boss studies (`studies/2026-10-25-boss-damage.md` and `2026-10-25-boss-estimate.md`) measured 30 published
league starters against a Pinnacle boss and estimated what PoB misses. Amendment 11's boss estimate (§9b) corrects
these by hand. "Reported (study)" means a study agent found it while measuring and no one has read the code for it;
the meta gems' trigger rates are PG-9's, the dropped supports in a granted skill's group PG-54's, and Verglas PG-22's.

- **PG-75, rates PoB takes from attack or cast speed.** gap, reported (study).
  - **Effect:** Falling Thunder is rated at attack speed, not once per charge cycle; Perfect Strike by its release
    alone; Flicker Strike's chain ignores Excise's cooldown. A cooldown skill's `Speed` is its cooldown cap and its
    `Time` is `1 / Speed`, so neither is a use's time (`CalcOffence.lua`:2864–2869, :2909–2913).
  - **Seen in:** the Hollowed One Amazon, Ronarray's Hollow Palm Monk, Alkaizer's melee Gemling, Facebreaker's
    Flicker Strike.
  - **Workaround:** the boss estimate's rotation share and burst-over-its-cycle corrections.
- **PG-76, procs per step, per metre or per hit.** gap, reported (study).
  - **Effect:** steps per metre walked (Ancestral Cry, Volcanic Steps, Stomping Ground), Forge Hammer's fissure procs
    (up to 5 a second), Walking Calamity's meteors (every 0.15 s) and bells struck by other skills (Tempest Bell,
    Hollow Focus) are rated at a hand-cast speed or not at all.
  - **Seen in:** Woolie's Firebringer, Balrog's Bear Smith, Ronarray's Rampage Bear, the Martial Artists.
  - **Workaround:** the boss estimate's procs correction.
- **PG-77, copies and hits PoB counts once.** gap, reported (study).
  - **Effect:** PoB rates one of several totems, one grenade per throw, none of Cluster Grenade's mini grenades, one
    pillar per cast, one lodged spear and one projectile of a volley that all land on a boss.
  - **Seen in:** the Arc and Grim Pillars totem builds, both grenade builds, the LazyExile Amazon, Falling Thunder.
  - **Workaround:** a group's `count` for copies acting at once; the boss estimate's landing correction for hits.
- **PG-78, buffs with no stat map.** gap, reported (study).
  - **Effect:** Elemental Armament III, Mana Tempest's gain as lightning, Rend's gain as lightning (disabling Rend
    changes nothing, a toggle probe), Walking Calamity's gain as fire, Ice-Tipped Arrows' physical-to-cold
    conversion and Verglas's gain per Frost Wall crystal's life (PG-22) add nothing; the Unbound and Empowered config
    options have no effect.
  - **Seen in:** Woolie's Wolfman, the totem builds, Alkaizer's Martial Artist, the Twister builds.
  - **Workaround:** the boss estimate's buff correction, from the buff's text.
- **PG-79, Bonestorm's spike count.** gap, reported (study).
  - **Effect:** no config option sets `Multiplier:BonestormStage`, so its stage multiplier reads 0 and PoB rates one
    spike per 0.3 s minimum channel.
  - **Seen in:** DEADRABB1T's Plants Lich.
- **PG-80, ailments added or stored by another skill.** gap, reported (study).
  - **Effect:** Oil Grenade's "adds 150% of this Attack's Fire Damage … to the Ignite" and Plague Bearer's stored
    poison add nothing; Decompose's share of a consumed corpse's life uses PoB's default monster, not the build's own
    corpses.
  - **Seen in:** Fubgun's Flameblast Oil Grenade, Skadoosh's Decompose Pathfinder.
- **PG-81, monster skills carry no cooldowns.** gap, reported (study).
  - **Effect:** a companion's slam or special has no rate in PoB's data, so how often it fires is a judgment.
  - **Seen in:** CaptainLance9's Beast Master.
- **PG-82, figures our tools don't expose.** ours, reported (study).
  - **Effect:** `lua_get_stats` gives no ignite stack potential, maximum power or frenzy charges, ailment chance or
    a Frost Wall crystal's life, so a hand estimate derives them from game data.
  - **From the defence study (2026-10-26):** amendment 12 (D-460) adds to `lua_get_stats`' defence category the
    chances not to be hit and to take damage, evade by hit kind, deflection's effect, the hits to die, the stun
    threshold and self-stun chance, and a companion's life. Three defence figures PoB has no single output for stay
    unexposed: the damage-from-mana-first share, a barrier's size and the physical-taken-as table. The defence study
    estimated a barrier from the max hit its group adds.

## Found in the defence study (2026-10-26)

The defence study (`studies/2026-10-26-defence-layers.md`) took the toughness study's 30 published league starters
apart one defence layer at a time, and the sizing study (`studies/2026-10-26-sizing.md`) measured amendment 12's open
candidates on the same builds; amendment 12 logs what they found (D-462). The kinds and statuses are the studies'
candidate list's, except PG-91's and PG-100's, which amendment 12 sets (§17); every `file:line` below was checked
against the pin on 2026-10-28. "Reported (coverage)" means
`check_model_coverage` flagged the line; "video study" and "video frame" mean a study of a creator's video read the
code or showed the figure. PG-85 (plain block against spells) was dropped, since the user trusts PoB's block reading
(2026-10-26), and its number is skipped.

- **PG-83, Virtuous Barrier's motes aren't lost to hits.** gap, confirmed in code.
  - **Where:** PoB counts the buff's motes of each attribute from a base of 3, plus 1 for each socketed skill gem
    that requires the attribute (2 when it requires no other) (`Modules/CalcSetup.lua:1485`, `:1857-1871`), into the
    multipliers its life, defence and regeneration lines read (`:2096-2099`). The skill loses a random mote whenever
    the character is hit (`Data/Skills/other.lua:19594`), and no config option sets how many are lost.
  - **Effect:** the buff reads at full motes.
  - **Seen in:** five Gemlings in the defence study, ×1.01–1.68 EHP (the animeprincess Twister ×1.68).
  - **Workaround:** treat the figure as an upper bound.
- **PG-84, Pyromantic Pact's mana replacement is unparsed.** gap, reported (coverage).
  - **Effect:** the Infernalist notable's line replacing maximum mana with Infernal Flame, and its line that burns the
    character when the flame fills, read as nothing, so PoB keeps a mana pool the character doesn't have. Node power
    then offers Mind over Matter at +88.6% EHP a point, a false lead.
  - **Seen in:** Ignatius's Comet Infernalist.
  - **Workaround:** a custom line removing the mana, checked by coverage.
- **PG-86, curses ignore their monster-level cap.** gap, reported (video study; code grep).
  - **Where:** `skill_curses_cannot_apply_to_targets_above_level` is a per-level stat of the curse skills (Despair,
    Elemental Weakness, Enfeeble, Temporal Chains and Vulnerability among them), and no file under `Modules/` or
    `Classes/`, nor `Data/SkillStatMap.lua`, reads it. Elemental Weakness can't curse a monster above level 76 at gem
    level 16, or above 78 at 17, and has no cap from 18 (`Data/Skills/act_int.lua:6047-6049`).
  - **Effect:** below gem level 18 a curse counts in PoB against a monster it can't curse in areas 79 and 82; below
    14, in area 69 too. The same cap, also unread, is on Frost Bomb's exposure (`Data/Skills/act_int.lua:9111`) and
    Thunderstorm's Wet (`Data/Skills/act_str.lua:19537`), on the same schedule by gem level (the sizing study; Frost
    Bomb's reads 100 from 18, above any monster). Amendment 12's V1 check `curse-level-cap` (D-455) names such a gem
    on a schema-8 plan.
  - **Seen in:** none of the 30: the 10 that curse use gem levels 18–21 (the sizing study).
  - **Workaround:** gem level 18 or higher for areas 79 and 82.
- **PG-87, a gain keyed to one type reads it after gear conversions.** bug (possible), reported (video frame).
  - **Where:** a "gain as extra" from one damage type takes that type's damage left after its conversions to other
    types, plus what was converted into it (`Modules/CalcOffence.lua:94-104`).
  - **Effect:** Tul's Stillness (cold damage gained as extra chaos, `Data/Skills/sup_dex.lua:5604`) under Original
    Sin (all elemental damage converted to chaos, `Data/Uniques/ring.lua:260`) reads 0 extra chaos.
  - **Workaround:** a custom line.
- **PG-88, a same-type conversion counts in the over-100% scaling.** bug (possible), reported (video frame). Rare.
  - **Where:** the sum that scales a damage type's conversions down when they pass 100% runs over every type, the
    type itself included, so a conversion to its own type counts in it (`Modules/CalcOffence.lua:2262-2289`).
- **PG-89, Yoke of Suffering counts Path of Exile 1 ailments.** bug, reported (code read in the video study).
  - **Where:** the amulet's "increased Damage for each Elemental Ailment type among your Ailments" line
    (`Data/Uniques/amulet.lua:304`) parses to one bonus per enemy condition, eight of them
    (`Modules/ModParser.lua:3827-3836`), Path of Exile 1's Scorched, Brittle and Sapped among them, against the four
    elemental ailments of PoB's own list (`Modules/Data.lua:405`: Ignite, Chill, Freeze, Shock).
  - **Workaround:** tick only the ailments the build applies.
- **PG-90, our enemies resist every element alike.** ours, confirmed.
  - **Where:** the map measure's enemy is PoB's "not a boss" (`data/enemies/map-monsters.json#pob-enemy-is-boss`),
    whose resistances PoB leaves at 0% (`Modules/ConfigOptions.lua:1969-1974`); the boss measure sets only
    `enemyIsBoss` to `Pinnacle`, whose fire, cold and lightning resistances are all 50% (`:2053-2056`).
  - **Effect:** a line keyed to the enemy's lowest resistance (Sacred Flame's, `Data/Uniques/sceptre.lua:112`) reads
    nothing, and penetration reads nothing on the map figure. Amendment 12's resisting figure (D-454) is its pair.
- **PG-91, the Arbiter verdict credits curses at map strength.** ours, closed (fixed by amendment 12 §4, D-449).
  - **Where:** the verdict read the stage's own max hits, measured against map monsters, where a curse counts at full
    effect; PoB halves a curse's effect on a Pinnacle boss (`Modules/ConfigOptions.lua:2043`).
  - **Effect:** without Enfeeble the three casters' worst Arbiter ratios rise from 0.33, 0.39 and 0.41 to 0.50, 0.59
    and 0.60; at half strength, by the defence study's estimate, about 0.42, 0.49 and 0.52, so no verdict flips.
  - **Seen in:** the three Enfeeble casters: the Arc Gemling, the Grim Pillars Oracle, Ignatius's Stormweaver.
  - **Fixed:** since amendment 12 the verdict reads the max hits of the Pinnacle pass, curses at half effect (D-449).
- **PG-92, stun chance constants may be stale.** data, reported (video study).
  - **Where:** PoB's chance to be stunned is 2 × the hit ÷ the stun threshold, dropped to 0 under 20%
    (`Modules/Data.lua:279-280`, `Modules/CalcDefence.lua:2649-2650`), while the player constants in the pin's game
    data, 44 and 15 (`Data/Misc.lua:46-47`), suggest another scale and floor.
  - **Effect:** low priority: neither gate figure reads stun.
- **PG-93, Immaculate Adherence's Divinity lines are unparsed.** gap, reported (coverage).
  - **Effect:** the amulet's Divinity lines read as nothing; its damage-from-mana-first line is read.
- **PG-94, common defence lines PoB doesn't parse.** gap, reported (coverage across the 30 builds).
  - **Effect:** each build has 2 to 23 defence lines PoB doesn't fully parse (median 9.5). The commonest, by the
    builds that carry them: Nascent Hope's recharge on use (13), Ghost Dance's two lines (12), Lavianga's Spirits'
    constant effect (12), reduced slowing potency (10), Olroth's Resolve's guard (4) and Blade Catcher's armour
    against critical hits (3).
- **PG-95, Tailwind's deflection line is never read.** bug (possible), confirmed in code.
  - **Where:** PoB gives 1% increased deflection effect per Tailwind stack (`Modules/CalcSetup.lua:726`), but the
    prevented share adds up only flat changes (`Modules/CalcDefence.lua:1522`), so the increase is never read. PoB's
    own Tailwind tooltip (`Modules/ConfigOptions.lua:936`) doesn't list the line, so whether the game has it is
    unknown.
  - **Seen in:** none of the 30.
- **PG-96, the hits-to-die count switches method when no chance layer is left.** bug (possible), measured (the
  defence study).
  - **Where:** with no damage-chance layer left (block, deflection or a chance to avoid damage), PoB takes its plain
    hits-to-die count instead of the scaled one (`Modules/CalcDefence.lua:3311`). With a companion taking a share of
    each hit, the plain count sits about 3.5% above the scaled one.
  - **Effect:** knocking out a build's last such layer reads too small: Snoobae's Twister's deflection read ×1.05,
    where the formula and the reading without its companion give ×1.09. A recoup line forces the scaled count and
    hides the switch (the Beast Master).
  - **Seen in:** Snoobae's Twister; the Beast Master.
  - **Workaround:** measure such a layer by its prevented share at two non-zero values, not by removing it.
- **PG-97, deflection doesn't cut ailment damage.** gap, reported (the user).
  - **Where:** PoB sizes the enemy's ignite and poison on the player from the raw hit's damage
    (`Modules/CalcDefence.lua:2219`, `:4086-4093`) and applies resistance to the damage over time, but never
    deflection's prevented share.
  - **Effect:** a deflecting build's ailment damage reads high. Amendment 12's design gate shows deflection's average
    cut on such a build (D-449).
  - **Workaround:** scale the ailment figure by 1 − chance × prevented share by hand.
- **PG-98, enemy bleeding on the player is never modelled.** gap, confirmed in code.
  - **Where:** PoB lists bleeding among the enemy's ailments but never sets its chance above 0
    (`Modules/CalcDefence.lua:4000`), so a bleed's damage over time is never counted. Ignite needs an enemy critical
    hit chance over 10.1% or a set ignite chance (`:3999-4005`), and poison a set poison chance (`:4009`).
  - **Effect:** our design enemy has neither, so our measurements count no ailment damage on the player at all.
- **PG-99, crafted jewel effect lines are unread.** gap, reported (sizing study; coverage).
  - **Where:** the crafted "(40-60)% increased Effect of Prefixes" and "…of Suffixes" lines
    (`Data/ModJewel.lua:363-364`) read as partly parsed, and nothing in `Classes/Item.lua` scales an item's own
    affixes.
  - **Effect:** a jewel copied from the game carries the boosted values and reads right; a jewel a compile crafts
    reads unboosted. Amendment 12's jewel lines leave the craft out (D-453).
  - **Workaround:** write the boosted values in.
- **PG-100, a companion's share of deflected hits makes hits survived read high.** ours, confirmed (an
  approximation).
  - **Where:** PoB already puts a companion's share of deflected hits into its max hit, at PoB's own deflect chance
    (`Modules/CalcDefence.lua:2960-2963`). Amendment 12's hits survived (D-449) then deflects the Arbiter's hit at the
    chance against the Arbiter, so it counts deflection partly twice and errs optimistic at the 80% floor.
  - **Seen in:** none of the 30; Forgotten Warden (`Data/Uniques/body.lua:747`) is the only source of the line in the
    pinned data.
  - **Workaround:** when a build carries the line, the gate adds one note that its hits survived is optimistic
    (amendment 12 §4).

## Found in amendment 13 (2026-10-30)

Amendment 13 (`spec/amendment-13-tree-and-finishing-touches.md`, D-476) records two gaps its work found: the library's
"A second ailment type" names Bloodhound's Mark's stun build-up (§11), and the finishing touches leave timeless jewels
out (§14). The kinds and statuses are §17's; every `file:line` below was checked against the pin on 2026-10-30.

- **PG-101, Bloodhound's Mark's Heavy Stun build-up from Blood Loss isn't modelled.** gap, confirmed in code.
  - **Where:** the skill (`Data/Skills/act_dex.lua:496-620`) maps one stat, the Heavy Stun build-up from Blood Loss
    a marked enemy needs for the Mark to activate when it dies (`:556-560`), to an `ExplosionThreshold` nothing reads.
    Its build-up stat, "Marked target receives Heavy Stun buildup equal to {0}% of Blood Loss"
    (`Data/StatDescriptions/Specific_Skill_Stat_Descriptions/bloodhounds_mark.lua:52`), 300% at base plus 2.5% a point
    of quality (`Data/Skills/act_dex.lua:570`, `:505`), has no map in the skill, in `Data/SkillStatMap.lua` or in
    `Modules/`. PoB builds Heavy Stun from hits alone (`Modules/CalcOffence.lua:5404-5422`).
  - **Effect:** in PoB the Mark adds no Heavy Stun build-up, so a bleed build's time to Heavy Stun a boss, which
    activates the Mark, reads from its hits alone.
  - **Seen in:** no reference build; the user named it as the library's bleed-to-stun example (2026-10-30).
- **PG-102, timeless jewels' seeds aren't read.** gap, confirmed in code.
  - **Where:** PoB parses a timeless jewel's seed and conqueror (`Modules/ModParser.lua:6182-6187`) and marks the
    passives in its radius conquered, but what the seed does to them is unfinished ("FIXME - continue implementing"),
    the notables' lookup commented out (`Classes/PassiveSpec.lua:1528-1571`, "todo: update once we get seed data").
    The lookup it would call, `data.readLUT`, is defined nowhere, and the pin ships no seed tables
    (`Data/TimelessJewelData/` holds the legion passives, their trade ids and a node index only).
  - **Effect:** Heroic Tragedy and Undying Hate (`Data/Uniques/jewel.lua:98`, `:113`) leave every notable in their
    radius as the tree's own; only a keystone becomes the conqueror's (`Classes/PassiveSpec.lua:1653-1660`), and
    Undying Hate's small passives give Tribute (`:1699-1706`). What a seed is bought for doesn't show.
  - **Seen in:** 10 of the 36 endgame guides of the finishing-touches study carry one (amendment 13 §2); amendment 13
    leaves them out of designs until a follow-up (§14).

## Found in amendment 14 (2026-11-02)

Amendment 14 (`spec/amendment-14-files-specs-and-repairs.md`, D-495) records three gaps the reviews of the open-spell
live test (2026-10-31) found: Crystalline Phylactery's line (§18), Event Horizon's cost line and Prism of Belief's
generated list (§20). Every `file:line` below was checked against the pin on 2026-11-02.

- **PG-103, Crystalline Phylactery's current wording is parsed only partly.** gap, confirmed in code.
  - **Where:** the Lich's jewel socket, node 17788, and its Abyssal Lich copy say "100% increased Effect of bonuses
    gained from Socketed Jewel" (`TreeData/0_5/tree.lua:52976`). PoB maps only the older wording, "Effect of the
    Socketed Jewel" (`Modules/ModParser.lua:895-897`), and reads this one as `LocalEffect` with a remainder
    (`Data/ModCache.lua:1356`), so the node keeps none of it (`Classes/PassiveTree.lua:473`, `:490`), and the jewel's
    scale, which reads the node's `SocketedJewelEffect` (`Modules/CalcSetup.lua:1133-1136`), stays at 1.
  - **Effect:** a jewel in the Phylactery counts once, not twice: a Ruby's "20% increased Armour" reads 20% there, as
    in a main-tree socket, for a Lich and an Abyssal Lich.
  - **Seen in:** the open-spell live test's two Lich builds, where 17788 went out unmeasured (amendment 14 §2, the
    user's note 11).
  - **Fixed:** in our bridge, not in PoB: `pob-api/API/ParseFixes.lua` sets the line's parse to `SocketedJewelEffect
    INC 100` and re-processes the node and its switch copies (D-492), so the jewel counts twice.
    `tests/integration/parseFixes.test.ts` fails once PoB parses the line itself; the entry then goes.
- **PG-104, Event Horizon's cost line is parsed partly and dropped.** gap, confirmed in code.
  - **Where:** the notable (node 52191, `TreeData/0_5/tree.lua:110204-110227`) gives "53% increased Chaos Damage" and
    "Lose 3% of maximum Life and Energy Shield when you use a Chaos Skill" (`:110225`). PoB reads the second as a flat
    `Life` loss with a remainder (`Data/ModCache.lua:6137`), so the node drops that line (`Classes/PassiveTree.lua:473`,
    `:490`) and keeps the first.
  - **Effect:** the chaos damage counts and the cost doesn't, so node power and the tree search see the notable as a
    free gain.
  - **Seen in:** the reviews of the open-spell live test (amendment 14 §21).
  - **Workaround:** the tree search's exclude list (D-490), or a custom modifier with its reason.
- **PG-105, Prism of Belief's generated list holds skills only items grant.** data, confirmed in code.
  - **Where:** PoB generates the jewel's variants from every gem that isn't a support, hidden or marked as an item's or
    the tree's skill (`Data/Uniques/Special/Generated.lua:78-104`, the test at `:85`). Coiling Bolts has a gem entry
    (`Data/Gems.lua:5924-5925`) and its skill no such mark (`Data/Skills/act_int.lua:3507-3508`), but only Liminal
    Coil grants it (`Data/Uniques/wand.lua:57-61`), so the list holds a variant the game never rolls. The other way
    round, Volatile Dead's skill is marked as an item's (`Data/Skills/act_int.lua:22333-22337`; Enezun's Charge grants
    it, `Data/Uniques/wand.lua:39-42`), so PoB lists no Volatile Dead variant although `Data/Gems.lua:132-133` has a
    gem for it.
  - **Effect:** a lookup or a design could take a "+(1-3) to Level of all Coiling Bolts Skills" Prism of Belief, which
    can't exist (the user's ruling: it rolls only gem skills).
  - **Seen in:** the open-spell live test (2026-10-31), its Coiling Bolts Lich.
  - **Workaround:** the lookup drops the skills `data/items/item-only-skills.json` lists from a generated unique's
    variants (D-494); the user adds names as they're found (R-84).

## Found in amendment 15 (2026-11-06)

From a character imported through poe.ninja and left unmodified (the user's "ResurrectForbidden", a level 100 Gemling
Legionnaire), read in the session; nothing copied. The user sees the first two on nearly every imported character.

- **PG-106, a support in a granted skill makes its group count against the skill slots.** bug, confirmed in code.
  - **Where:** the skills tab counts a group once any enabled gem in it is neither an item's nor the tree's
    (`Classes/SkillsTab.lua:1577-1581`, the total at `:1607`), so a support gem placed in a granted skill counts the
    group. The warning compares that total with the slots (`Modules/CalcPerform.lua:3605`; 9 base,
    `Modules/CalcSetup.lua:728`, plus one per "Grants 1 additional Skill Slot").
  - **Effect:** the character runs 10 gem groups on its 10 slots and also its spear's Spear Throw (with Frost Nexus)
    and its sceptre's Purity of Ice (with four supports); PoB reads 12 and warns. Turning those two groups off clears
    the warning; a Spear Throw group with no support doesn't count. V1's `skill-slots` (D-428) repeats PoB's count.
  - **Workaround:** none yet; amendment 16 recounts in the bridge by the rule the character shows (a group counts
    when its first enabled active skill isn't granted).
  - **Upstream:** fixed on PoB's `dev` after our pin (PR #2411, 2026-08-26), in no release yet (`pob-upstream.md`).
- **PG-107, an imported character has every skill turned on.** gap, confirmed in code.
  - **Where:** the importer makes each skill of the game's character data an enabled group of enabled gems
    (`Classes/ImportTab.lua:990`, `:1062-1078`) and reads no on or off state.
  - **Effect:** Spirit is reserved for every buff the character has socketed, though the game runs only what its
    Spirit covers, and players toggle buffs by weapon set or as needed. The character's six buffs reserve 254
    (Trinity 100, Charge Regulation 40 with Clarity I's 10, Herald of Ice 30, Wind Dancer 30, Combat Frenzy 30, Ghost
    Dance 24) against 215 Spirit, and PoB warns that unreserved Spirit is negative. Each figure equals the gem's own
    cost, and no passive, jewel or item line on the character names Spirit or reservation beyond its sceptre.
  - **Workaround:** turn the buffs that are off in the game off in PoB.
- **PG-108, an imported character holds each granted skill twice.** bug, confirmed in code.
  - **Where:** the game's skill list carries skills its items and passives grant, with any supports in them, and the
    importer adds each as a plain group (`Classes/ImportTab.lua:1062-1078`); PoB then adds its own group for each
    granted skill from the item or node.
  - **Effect:** the character holds Spear Throw three times plainly and twice from its spears, and Virtuous Barrier,
    Righteous Descent and Purity of Ice once each way. A plain copy with a support counts against the skill slots
    (PG-106). Whether a buff applies twice wasn't measured, except that the tree's level 1 Virtuous Barrier changed
    nothing when turned off, while the plain level 20 copy carried the defence.
  - **Workaround:** delete the plain copies without supports; move the supports of the others onto PoB's granted
    group.

## Checked from PoB2's tracker (2026-11-06)

Reports from `pob-upstream.md` §2, checked against the pin's code and, where a probe could show it, on the engine.

- **PG-109, a saved item's rolls move to other lines when it holds a rune.** bug, confirmed by probe.
  - **Where:** a save writes each line's roll as a `<ModRange>`, numbered across the enchant, rune, implicit and
    explicit lines (`Classes/ItemsTab.lua:1221-1245`). A load walks the lines without the rune lines (`:1118`), so
    each roll lands as many lines further down as the item has rune lines, and the last ones are dropped. The load
    sets the roll after it reads the item's text, so it overrides the text's `{range:}`, and the next save writes the
    moved roll into the text (`Classes/Item.lua:1463`). A rune line PoB rebuilds from its `Rune:` line has no roll
    (`:1663`): it writes no `<ModRange>` but still takes a number.
  - **Effect:** only a line written as a range moves. An imported character is safe, since its lines carry the game's
    numbers. Our compiled builds aren't: plans write uniques with `{range:}` lines and a rune. The compile measures
    before it saves, so its record is right, but the file it writes reads differently once loaded: by the user in
    PoB, by `lua_load_build`, or, after the user saves it in PoB, by the read-back, which compares item lines and would
    report the moved rolls as the user's change. In the probe, the open-spell plan's corrupted Liminal Coil (two rune
    lines) read 9% Cast Speed and 29% per-curse gains; after one save and load, 13% (the Coiling Bolts level's 0.95
    roll) and 27%.
  - **Seen in:** issue #2275 (a pasted helmet's +28 mana read +30 after reopening); the probe on the open-spell plan's
    items.
  - **Workaround:** on an item that holds a rune or soul core, write a rolled line as its number, not as a range.
  - **Upstream:** issue #2275 (open), no pull request. Its thread blames hybrid mods and doesn't name this cause.
    Unchanged on `dev` (checked 2026-11-06).
- **PG-110, an item on a base the pin lacks is dropped without a word.** data, confirmed by probe.
  - **Where:** the pin has no Runeforged quarterstaff and one Runemastered one, the Warding Quarterstaff
    (`Data/Bases/staff.lua:452-487`). A character import skips an item whose base isn't in the data, with only a
    console line (`Classes/ImportTab.lua:1183-1187`, `:1428`). A load keeps an item only when it has a base
    (`Classes/ItemsTab.lua:1133-1140`), and the item set still points at the missing id.
  - **Effect:** the slot reads empty. In the probe, Pillar of the Caged God saved on a Long Quarterstaff and renamed
    to a Runemastered Long Quarterstaff in the file loaded without an error, with Weapon 1 empty and one item fewer.
    `get_build_issues` then states "Weapon 1: empty." as a fact (`src/advice/judge.ts:176-177`), and a skill that
    needs the weapon reads 0 DPS (the issue). An imported character is exposed. A compile isn't: PoB parses such a
    text with no base, and `compile_check` refuses it.
  - **Seen in:** issue #2582 (a Runemastered Long Quarterstaff; poe.ninja's PoB code for the character already lacks
    it).
  - **Workaround:** ask the player what the empty slot holds. Type the item on its plain base, which loses what the
    Runeforged or Runemastered base adds.
  - **Upstream:** issue #2582 (open); PR #2583 (open) adds the Runeforged Wrapped, Long, Gothic, Crescent and
    Steelpoint and the Runemastered Long and Gothic Quarterstaff. Neither warns about an unknown base.
- **PG-111, a base name the data defines more than once keeps only its last definition.** data, confirmed by probe.
  - **Where:** `Data/Bases/*.lua` define 19 base names more than once with different implicits, one per variant, and
    each definition replaces the one before. Two-Stone Ring keeps Cold and Lightning (`Data/Bases/ring.lua:110`),
    Shrine Sceptre Purity of Lightning (`Data/Bases/sceptre.lua:178`), Tournament Mail and Shrouded Mail Lightning
    Resistance (`Data/Bases/body.lua:1937`, `:2051`); the rest are Runeforged or Runemastered bases.
  - **Effect:** a text that carries its implicit line reads right, so an imported character is safe. A plan's bare
    base isn't: the compile fills a text with no `Implicits:` line from the base's data (D-435) and checks only PoB's
    `variantList`, which these bases lack. A bare "Two-Stone Ring" compiles with cold and lightning resistance and a
    bare "Shrine Sceptre" with Purity of Lightning, whatever the designer meant, and V1's `implicit-variant` stays
    quiet.
  - **Seen in:** issue #2582's note (Runemastered Runic Fork); the probe read the four bases above from the pin.
  - **Workaround:** on these bases, write the `Implicits:` line and the implicit.
  - **Upstream:** noted in issue #2582 (open); PR #2583 doesn't change it.
- **PG-112, node power gives a node the score of another with the same lines.** ours, confirmed by probe.
  - **Where:** `pob-api/API/NodePower.lua` caches each node's measure by its `modKey`, the text of its lines
    (`:603-614`, `:651`, `:662`, `:669`), on purpose, to match PoB's own power pass (`Classes/CalcsTab.lua:594-597`,
    `:622-625`); its comment names only weapon-set twins (`:627-631`). A radius jewel's lines reach only the nodes in
    its radius (`Modules/CalcSetup.lua:200-201`, `:234-235`), and PoB scales small and notable passives apart, so
    nodes with the same `modKey` can measure differently. The first one measured sets the score for all.
  - **Effect:** the probe used the golden build, with lightning resistance put under its cap, whose Time-Lost Diamond
    gives small passives in its radius +3% Lightning Resistance. Two small passives outside the radius (14572, 35284)
    scored like their twins inside (+16.5 on the lightning max-hit stat, +140 EHP), though each alone adds nothing.
    `get_node_power`'s rows, the swap and rebuild searches' estimates (`:1677-1692`, `:1706-1717`, the pools'
    `:2392-2398`) and `get_passive_upgrades` at one point away read the cached figure. A path of two or more points
    and a swap are measured whole, so they're right. The other order is as likely: a node inside the radius reads
    nothing.
  - **Seen in:** PR #2559 (no issue); the probe above.
  - **Workaround:** near a radius jewel, trust a node's figure only with its path of two or more points, or a swap's
    own measure.
  - **Fix (not built):** key the cache, as PR #2559 keys PoB's, on the `modKey` plus the node's type, its attribute
    flag, its weapon set (`allocMode`) and the radius jewels (`build.calcsTab.mainEnv.radiusJewelList`) whose `nodes`
    hold it, at the call sites above. Nodes that measure alike still share. The figures then differ from PoB's tree
    tab for such twins, so the header's "equal PowerBuilder's" changes.
  - **Upstream:** PR #2559 (open), the same fix in PoB's `Classes/CalcsTab.lua`.
- **PG-113, an imported character's main skill is the group with the most gems.** bug, confirmed in code.
  - **Where:** a first import, into a build with no skill groups (`Classes/ImportTab.lua:928`), picks the main group
    with `GuessMainSocketGroup`: the most gems, the first on a tie (`:1136-1137`, `:1473-1484`), a PoE1 rule. A
    re-import keeps the player's choice (`:1127-1134`). The file saves the main group (`Modules/Build.lua:1160`) and a
    load reads it back (`:1118`), so a guess and a choice look the same.
  - **Effect:** in PoE2 every group can be fully linked, so the biggest is often a buff, a curse or a movement skill.
    On an imported character's file where the player never set it, every figure our tools read from PoB's main skill
    is that group's: `lua_load_build`'s summary DPS, `get_passive_upgrades`' DPS ranking, `get_node_power`'s DPS
    stats and `MainDamage`. Compiled builds aren't exposed: the compile sets the main group
    (`pob-api/API/Compile.lua:1843`).
  - **Seen in:** issue #2536.
  - **Workaround:** ask the player which skill does the damage, or compare the groups' DPS, and set it with
    `set_main_skill` before reading figures.
  - **Upstream:** issue #2536 (open, a feature request); PR #1401 (open) guesses by DPS across the groups.
- **PG-114, an item's quality doesn't reach the skill it grants.** bug, confirmed in code.
  - **Where:** an item's granted skills carry no quality (`Classes/Item.lua:2211-2222`), and PoB creates the skill's
    group with quality 0 (`Modules/CalcSetup.lua:1525-1529`). The game applies a Shrine Sceptre's quality to its
    Purity (the issue).
  - **Effect:** each Purity gives +0.4% to its resistance per 1% quality (`Data/Skills/act_int.lua:16123`, `:16246`,
    `:16369`), so a 20% Shrine Sceptre's aura reads 8 points of resistance low. Imported characters and compiled
    builds are both exposed.
  - **Seen in:** issue #2575.
  - **Workaround:** a custom mod for the missing resistance, with its reason.
  - **Upstream:** issue #2575 (open); PR #2577 (open) gives every item-granted skill its item's quality.

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
