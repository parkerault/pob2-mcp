# Choosing a minion's skill: the engine spike

An agent's spike report, kept as written (2026-10-16), the evidence for amendment 6
(`../spec/amendment-6-minion-skills.md`). It ran against the M-16 run worktree's built server (pin v0.23.1, `7d6f530`)
and direct luajit probes, on Navira's PoB from the Varashta guide the user named for the M-16 baseline run. Its probe
scripts and outputs lived in the coordinator's scratchpad and aren't kept. Vendor paths are relative to
`vendor/PathOfBuilding-PoE2/src/`.

Inputs: the guide's PoB, decoded. `navira-ms1.xml` selects the Early Endgame sets (group 1 is a socketed level-20
Navira with Muster, Bidding II, Frost Nexus and Encroaching Ground, `skillMinionSkill="1"`); `navira-ms2.xml` is the
same with `skillMinionSkill="2" skillMinionSkillCalcs="2"`; `navira-orig.xml` is the file as given (Late Endgame
active).

## Part A: the spike

### A1. What the tools show at minion skill 1 vs 2; does PoB compute Navira's Fracturing; which fields carry it

**PoB computes it fully.** The minion's list (`minion.activeSkillList`) for the Water Djinn is, in this
order: 1 Navira's Embrace (`WaterBubbleWaterDjinn`), 2 **Navira's Fracturing** (`ChilledGroundBurstWaterDjinn`),
3 Navira's Well, 4 Navira's Oasis, 5 Navira's Calming. With index 2 selected, PoB's output for the minion
(`mainOutput.Minion`, a nested table) holds the hit, the cooldown-limited rate and the DPS:

| Case | `Minion.AverageHit` | `Minion.Cooldown` (s) | `Minion.Speed` (/s) | `Minion.TotalDPS` = `CombinedDPS` | crit |
|---|---|---|---|---|---|
| Early Endgame, minion skill 1 (Embrace) | 0 | 11.55 | 0.0866 | 0 | 0 |
| Early Endgame, minion skill 2 (Fracturing) | 3965.1 | 3.861 | 0.2590 | **1026.97** | 12% |
| same, group without its 4 supports | 1953.2 | 5.016 | 0.1994 | 389.39 | 12% |
| Late Endgame file (PoB's tree-granted Navira: gem level 1, effective 13 with gear and tree, minion level 26; no supports), skill 2 | 8424.4 | 2.607 | 0.3836 | **3231.46** | 40.2% |
| Kelari (Late Endgame), skill 1 Brutality / 2 **Deception** / 3 Judgment | 1522 / 5443 / 5314 | 2.60 / 2.60 / 6.27 | | 584.5 / **2090.1** / 847.5 | 50.25% |

`Speed` is the cooldown-limited rate: `Minion.CastRate` is 0.833/s (1.2 s cast) but `Speed` = 1/`EffectiveCooldown`,
and `TotalDPS` = `AverageHit` × `Speed` exactly (3965.136 × 0.2590 = 1026.97). `StoredUses` 1. The skill carries
`base_skill_show_average_damage_instead_of_dps`, but PoB still computes `TotalDPS`. PoB doesn't model the
skill's precondition (it fractures Chilled Ground under enemies): the hit is computed unconditionally.

**The player's own output is 0 for a minion main skill.** With the summon as the main skill, the player's
`TotalDPS`, `CombinedDPS`, `AverageHit` and `Speed` are 0 in both cases. The minion's numbers exist only in
`mainOutput.Minion`; the only player-level field that carries them is `FullDPS`, and only when the group is in
Full DPS (`includeInFullDPS`): 1026.97 at skill 2, 0 at skill 1 (Late Endgame: 3231.46). `calcFullDPS`
merges the minion as an actor with `count = activeSkillCount` and `dotScale = 1` (`Modules/Calcs.lua:366-378`,
`mergePass` `:316-329`), so a minion's hit DPS scales with the group's Count and its DoT doesn't.

**What our tools show today: nothing of it, and the same text at 1 and at 2.** (`out1.md`)
- `lua_load_build`'s summary: `DPS: 0`, labelled `DPS` (both files).
- `get_skill_setup`: `Active Skills: Navira, the Last Mirage, Command`, `Main Active Skill Index: 1`; no minion,
  no minion skill list, no selection.
- `lua_get_stats {category:"offense"}`: only `CritMultiplier: 2`, `HitChance: 100` (both files).
- `lua_get_stats {breakdown:true}`: two blocks, `Navira, the Last Mirage` (HitChance, CritMultiplier) and
  `Command` (Speed 2.5, ManaCost 75, ManaPerSecondCost 187.5); identical at 1 and 2.
- `lua_get_stats {category:"all"}`: no offense section at all.
- `analyze_skills`: `Active skills: Navira, the Last Mirage, Command`; same at 1 and 2.
- `export_build_summary`: `| DPS | 0 |`, `**Main:** Navira, the Last Mirage + Muster + ...`.
- **Why:** `BuildOps.export_stats` (`pob-api/API/BuildOps.lua:69-95`) returns scalar fields only and lists
  `Minion` as omitted; the TS side already asks for `MinionTotalDPS`, `MinionCombinedDPS`, `MinionAverageDamage`,
  `MinionSpeed`, `MinionLife`, ... (`src/handlers/luaHandlers.ts:195-199, 246, 288-291`,
  `buildHandlers.ts:36, 297-298`, `exportHandlers.ts:213, 229-230`), but **no such keys exist in PoB2's output**
  (the probe lists the player keys starting with `Minion`: only the `Minion` table and `MinionRevivalSpeed`).
  Those 11 "minion stats" of `OFFENSE_STAT_FIELDS` and every `Minion DPS` label are dead code today.
- The `Command` active skill (index 2 of the group, `CommandWaterDjinnBubblePlayer`, "Command: {0}") is the
  player's command: as the main active skill it has no minion (`out.Minion` nil) and only a mana cost and a
  2.5/s use rate. The minion's damage is reached through active skill 1 (the summon).

**Our compile record's DPS today.** `measures.dps` is `headlineDps` (`src/plan/record.ts:386-398`):
`countedSkillOutputs[g<main.group>s<main.activeSkill>p<main.statSet>].fields.TotalDPS`, else the main skill's
counted `TotalDPS`. For a summon main skill both are the player's `TotalDPS` = **0** (finite, so `dps: 0`, not
null), whatever minion skill is selected. The record's `outputs` drop the `Minion` table
(`pob-api/API/Compile.lua:1303-1306` keeps finite numbers only) and `skillOutputs` read only scalar fields
(`BuildOps.stats_breakdown`, `:1069-1129`), so no minion number reaches the record except `outputs.FullDPS`
(the named group is in Full DPS, D-337), which is the minion's DPS only when the gem's minion skill is a
damaging one, and the compile never sets it (new gems start at 1: Navira's Embrace, 0 DPS). The key-figure line
(`keyFigureLine`, `src/plan/compiler.ts:538-558`) therefore prints `DPS 0`.

### A2. Is the index into `minion.activeSkillList` stable; can a name resolve to it robustly

`calcs.createMinionSkills` (`Modules/CalcActiveSkill.lua:1112-1180`) builds the list as:
1. the minion's `minionData.skillList` in its data order, **skipping ids missing from `env.data.skills`**;
2. then each `ExtraMinionSkill` mod on the summoning skill's `skillModList` (`:1124-1128`), in mod-list order,
   kept when it names no `minionList` or names this minion type. Sources at this pin: the supports Minion
   Instability (`Data/Skills/sup_int.lua:6940`) and the Infernal Legion family (`sup_str.lua:4640-4728`,
   skill id `InfernalLegion`, which has no skill data at this pin), and two legacy ModParser lines
   (`Modules/ModParser.lua:2460-2484`). The probe's Wolf Pack with Minion Instability shows
   `1 Basic Attack, 2 Leap Slam, 3 Minion Instability`.
3. the selection is `clamp(srcInstance.skillMinionSkill or 1, 1, #list)`, written back to the gem in MAIN
   mode (`:1167-1178`); the probe confirms index 6 on a 5-skill list clamps to 5 (Navira's Calming).

So a minion's own skills keep their indices for a given minion type and pin (extras only append), but the index
is not robust in general: an extra's index depends on support order, a pin upgrade can reorder `skillList`, and a
summon with several minion types (`AncestralSpiritsPlayer`, 4 types, chosen by `skillMinion`) has one list per
type. **Resolve by name, live, every compile:** after the stage's groups are built and the main selection made,
read `displaySkillList[main.activeSkill].minion.activeSkillList` (as PoB's own dropdown does,
`Modules/Build.lua:2046-2052`), match `activeEffect.grantedEffect.name` case-insensitively, set the index, rebuild,
and confirm `minion.mainSkill`'s name. Refuse: no minion on that active skill; no such name (list the names); a
name repeated in one list (name the indices). Names are unique within the djinns' lists, but minion skill names
are not unique across the game: 47 minion skill names equal a gem name (Arc, Fireball, Gas Arrow, Leap Slam, ...)
and generic names repeat across monsters ("Basic Attack" has ~25 granted effects), so a name means something only
with its summon.

PoB doesn't need the node that grants the command to be allocated: deallocating node 10561 (Navira's
Fracturing) left `Minion.TotalDPS` at 1026.97 (see A4).

### A3. `skillMinionSkillStatSetIndexLookup` and the plan's `statSet`

They are independent:
- the plan's `skills.main.statSet` → `set_main_selection` writes `srcInstance.statSet[<summon's granted effect
  id>]` (`BuildOps.lua:1056-1059`). All 28 summoning skills at this pin have exactly **one** stat set, so for a
  minion main skill `statSet` is always 1 and selects nothing about the minion;
- the minion skill's stat set is `srcInstance.skillMinionSkillStatSetIndexLookup[<summon's granted effect id>]
  [<minion skill index>]`, default 1 (`CalcActiveSkill.lua:1132-1148`), written by PoB's dropdown
  (`Modules/Build.lua:468-475`) and saved/loaded as `<MinionSkillIndexLookup grantedEffect=...><MinionSkillIndexMap
  skillIndex statSetIndex/>` (`Classes/SkillsTab.lua:372-389, 516-538`); the Calcs tab has its own copy
  (`...LookupCalcs`, `skillMinionSkillCalcs`).
- It matters for commanded skills with several stat sets: Kelari's Deception (`Kelari's Deception`, `Hidden`),
  Kelari's Brutality (`Projectile`, `Eruption`), Ruzhan's Trap (3), Ruzhan's Fury (2), Ruzhan's Reckoning (2), and
  skeleton skills (Gas Arrow 3, Frost Bolt 2, ...): 9 minion skills in all. Navira's Fracturing has one.
- An out-of-range lookup index **crashes PoB's calculation** (`Modules/CalcTools.lua:155: attempt to index local
  'statSet' (a nil value)`), so it must be validated before it is written. It is keyed by the minion skill's
  index, so it moves when the index does.
- `snapshot_selection`/`restore_selection` (`BuildOps.lua:913-965`) copy the gem's scalar fields
  (`skillMinionSkill` included) and `statSet`, not the nested lookup tables: a breakdown that varies a minion
  skill's stat set must snapshot them too.

### A4. "Grants Skill: Navira's Fracturing" in PoB's mod parser; anything else gating

`Data/ModCache.lua:5866`: `c["Grants Skill: Navira's Fracturing"]={nil,nil}`. The line matches the special mod
`["grants skill: (%D+)"]` (`Modules/ModParser.lua:3560`), whose `grantedExtraSkill` (`:2181-2188`) returns nothing
because no **gem** is named "Navira's Fracturing"; `parseMod` returns nil, and the passive tree marks the node
`unknown` (`Classes/PassiveTree.lua:468-470`). `check_model_coverage {nodes:["10561"]}` reports it `unparsed`.
The same holds for Navira's Well (5868) and Oasis (5867), Kelari's Deception (5723) and Judgment (5724), Ruzhan's
Fury, Reckoning and Trap (5875-5877). The nodes that grant the **summons** do parse: "Grants Skill: Navira, the Last
Mirage" (node 32705, Barya of Navira) → `ExtraSkill {skillId=SummonWaterDjinnPlayer, level=1}` (5869); Kelari's
Malediction → `CorpseBeetlesPlayer`.

**Nothing gates the minion skill on the node.** The djinn's `skillList` is static data and always holds all five
skills; the probe deallocated 10561 and Navira's Fracturing still computed 1026.97. In game the summon gives the
bubble command (its `additionalGrantedEffectId1` is `CommandWaterDjinnBubblePlayer`) and each other command comes
from its notable, so **our side must check the unlock**: a commanded minion skill named by a "Grants Skill: <name>"
node is usable only on a stage that allocates that node. `search_tree_nodes {query:"Grants Skill: Navira's
Fracturing"}` already finds node 10561 (Disciple of Varashta), and `lookup_game_data {mode:"mechanic"}` finds the
passive line, so D-342's lock works on the minion skill's name unchanged.

Two modelling facts found on the way (not amendment 6's to fix, but they move the motivating build's numbers):
- **PoB's tree-granted summon starts at gem level 1 and loses its supports.** Allocating 32705 makes PoB append a
  group `source="Tree:32705"` at the end of the socket group list (`Modules/CalcSetup.lua:1503-1534`), whose gem
  level is the mod's `level=1` and whose gem list is wiped to the active gem on every MAIN calculation (`:1530`):
  the given file's Late Endgame tree groups had supports in the XML and have none after loading. "+level" mods still
  apply: in the Late Endgame file the tree copy is gem level 1, effective 13 (minion level 26), and does 3231 DPS
  with skill 2. In the itemless Early Endgame set the tree copy's minion is level 2: Navira's Fracturing does
  **9.6 DPS** there, against 25.5 / 243.5 / 1026.97 for a socketed gem at level 1 / 10 / 20 (minion levels
  2 / 20 / 40). The reference build models the djinn as a separate socketed group (level 20, with supports), so a
  plan will too, and PoB then also carries the tree's own copy. Which base level is right in game needs a source
  (and V1's `gem-availability` reads a level-20 tier-0 skill gem as needing an uncut level-20 gem). The djinns
  reserve no Spirit, so the duplicate costs nothing in the calculation.
- Supports in the summon's group apply to the minion skill (Muster etc. take the hit from 1953 to 3965 and the
  cooldown from 5.02 s to 3.86 s), and `suggest_supports` ranks by the selected minion skill's `CombinedDPS`
  (`selector_value`, `BuildOps.lua:1750-1755`), so at the default index 1 it ranks every support at 0.

### A5. Do load, import and save keep `skillMinionSkill`

Yes, all three.
- `lua_load_build`: `SkillsTab:Load` reads `skillMinionSkill`/`skillMinionSkillCalcs` (`Classes/SkillsTab.lua:366-367`);
  the probe reads 2 on the gem after loading `navira-ms2.xml`.
- `lua_save_build` (PoB's own save, `:501-502`): `navira-ms2-resaved.xml` has `skillMinionSkill="2"
  skillMinionSkillCalcs="2"` on the Early Endgame gem, and 1 elsewhere. `set_main_skill {group_index:1,
  active_skill_index:1}` didn't reset it (`navira-ms2-after-setmain.xml`, still 2).
- `import_build` with `save_as`: the decoded XML is written as is (176454 bytes, same as the source), and it loads
  through the same path; `navira-imported.xml` keeps 2.
- Caveats: MAIN mode writes the clamped index back (`CalcActiveSkill.lua:1176-1178`), so a saved file holds the
  clamped value; CALCS mode keeps its own `skillMinionSkillCalcs`. A tree-granted group's gem instance survives
  recalculation (`CalcSetup.lua:1521`), so its index persists too.

## Design corrections

1. **Selecting the minion skill isn't enough: no tool and no record can see the result today.** PoB puts the
   minion's numbers in a nested `mainOutput.Minion`; `export_stats`, `stats_breakdown` and `compile_stage` keep
   scalars only, and the TS side's `MinionTotalDPS`-style fields have never existed. The amendment needs B0 (read
   `Minion<Field>` from `output.Minion`) or every display and the headline stay 0. The same fix makes `lua_get_stats`,
   the load summary, `export_build_summary` and `compare_builds` right for every summoner build, not just djinns.
2. **The headline must read the minion's figure, with its own Count rule.** `measures.dps` = the main entry's
   `MinionTotalDPS` × Count when `main.minionSkill` is set (`calcFullDPS` multiplies a minion's hit DPS by the
   group's count, and its DoT by 1). The same goes for `render-audit.mjs`'s duplicate, the checker's verdict-line
   message, the key-figure line, D1's rolled-figure comparison across groups (a summon group's `TotalDPS` is 0, so
   "largest among the role" must compare `MinionTotalDPS` for a minion group, or one combined field), and the clear
   measure (`MinionAreaOfEffectRadiusMetres`, `MinionSpeed`).
3. **A second stat-set field.** `skills.main.statSet` addresses the summon (all 28 summons have one stat set). The
   minion skill's stat set is a separate PoB setting, keyed by the minion skill's index, needed for 9 minion skills
   (Kelari's Deception and Brutality, Ruzhan's Trap, Fury and Reckoning, skeleton skills), and an out-of-range value
   crashes PoB's calculation. Add it to the plan (`minionStatSet`, or `minionSkill: {name, statSet}`) and to
   `set_main_skill`, validated. Keeping the figure key `g<group>s<skill>p<statSet>` and measuring each entry at the
   stage's own minion selection avoids a new key shape in the ledger grammar, `record.ts`'s regex and three
   check-run regexes; the alternative (`g..s..m..p..`) touches all of them.
4. **The roll's identity needs its summon.** `roll.skill` alone is ambiguous: 47 minion skill names equal a gem
   name, and generic names repeat across minions. Either `roll` gains the summoning gem (breaking the exact-3-keys
   checks in `run-log.mjs:116` and `check-run.mjs:1646`), or a rule: a name that is a gem means the gem, and a
   minion skill is meant only when no gem has the name or the brief says so. D-217's schema rule must accept
   "the rolled group holds the summon and `main.minionSkill` is `roll.skill`" (B1).
5. **D-334's "damage source that isn't a skill" route must exclude minion skills.** Today a node-granted command
   meets it (the mechanic lookup finds node 10561's passive line), so a commanded skill would be dealt as
   "can't be finalized yet" and never compiled. Minion skills are skills: HG-21 stays for item effects.
6. **PoB doesn't gate the command on its node; we must.** "Grants Skill: Navira's Fracturing" parses to nothing
   (`{nil,nil}`, the node is `unknown`), and the djinn always has all five skills. Add a V1 finding for a stage whose
   `minionSkill` is node-granted but not allocated (and the same for a node-granted summon), and tell R1b/D2 to put
   both nodes in the tree targets. The "unparsed is a modelling gap" rules (R1a, lookups.md, V4) need an exception
   for these lines, which PoB ignores without losing anything.
7. **Resolve by name, live, every compile; never store an index in the plan.** The list is the minion's data
   order plus support-added skills; resolve against `minion.activeSkillList` after the rebuild, refuse unknown and
   ambiguous names listing what exists, and record the resolved index. The "Command" active skill (index 2 of the
   gem) has no minion: refuse `minionSkill` there (compile_check and `set_main_skill`).
8. **`lookup_game_data` needs a fixed kind line and the unlock.** The brief check matches `Kind: active`; the new
   result must print one exact string (for example `Kind: minion skill (commanded)`), name every summoning gem and
   minion, list its stat sets, and name the nodes whose line grants it, so the lock and D1 can use it without a
   second lookup. Gem results come first when names collide.
9. **Out of scope but load-bearing for the motivating build: the summon's level.** PoB's own tree-granted Navira is
   gem level 1 (plus any "+level" mods) with no supports (Navira's Fracturing 9.6 DPS without gear); the reference
   models a socketed level-20 gem with four supports (1,027 DPS in the same set). Which is right in game needs a source before a Varashta guide's numbers mean anything, and
   V1's `gem-availability` treats a level-20 tier-0 summoning gem as needing a level-20 uncut gem.
10. **Smaller:** `check_model_coverage {gems}` and `suggest_supports` don't know minion skills (the latter is right
    once the skill is selected); custom modifiers apply to the player, so a hand-calculated minion effect (PG-25)
    needs a `Minions ...` line; W1's "<Skill> about <n> DPS" for a cooldown-limited command may read better as the
    hit and the uses per second (PoB's own sidebar shows the average hit for Navira's Fracturing).
