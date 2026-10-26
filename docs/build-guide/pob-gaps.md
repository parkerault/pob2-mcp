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
- **PG-65, Herald of Plague's spread and Herald of Blood's explosions.** gap, reported (coverage). Herald of Blood's
  share of Blood Loss is possibly unmodelled too (PG-50).
  - **Seen in:** the Poison Pathfinder.
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
