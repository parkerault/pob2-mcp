# Amendment 6: the touch-point map

An agent's map, kept for the M-17 build (2026-10-16), of every place amendment 6
(`../spec/amendment-6-minion-skills.md`) touches. It was mapped at `78c3ef9`, so line numbers drift as units merge.
It is a guide, not a requirement: where it and the amendment disagree, the amendment binds. The engine answers it
cites as A1…A5 are in `2026-10-16-minion-skill-spike.md`. Its section B8 was mapped by a second agent; the
scratchpad copy it names isn't kept.

## Part B: the touch-point map

Paths are relative to `/home/parker/projects/pob2-mcp-wt/amend`. "Must" marks what the intended design needs;
"should" what the spike says it needs to be useful; "optional" what is worth weighing.

### B0. A prerequisite: make the minion's numbers readable at all (must)

Nothing reads `mainOutput.Minion` except `selector_value`. One Lua helper fixes every reader at once: a field
`Minion<Field>` that `output` lacks reads `output.Minion[<Field>]` (only `MinionRevivalSpeed` exists natively at
this pin, so no name collides). It turns the TS side's 11 phantom fields into real ones.
- `pob-api/API/BuildOps.lua:69-95` `export_stats`: resolve `Minion<Field>` through the helper (the `lua_get_stats`
  views, the load summary, `analyze_build`, `compare_builds`, `export_build_summary` all ask for these names).
- `pob-api/API/BuildOps.lua:1069-1129` `stats_breakdown`: read each requested field through the helper (the
  compile's `skillOutputs` come from here, `Compile.lua:978-1028`).
- `pob-api/API/Compile.lua:1303-1306` `compile_stage`: add the flattened `Minion<Field>` numbers to `outputs`
  (today only top-level finite numbers), so the record and the ledger (`<stage>.MinionTotalDPS`, one segment, no
  grammar change) can read them.
- `pob-api/API/BuildOps.lua:1750-1755` `selector_value`: already reads `Minion.CombinedDPS`; could use the helper.
- `src/handlers/luaHandlers.ts:282-292` `OFFENSE_STAT_FIELDS` (already lists the 11 minion fields; consider adding
  `MinionAverageHit`, `MinionCooldown`, `MinionAreaOfEffectRadiusMetres`, `MinionCritChance`), `:246` `OFFENSE_HEAD`
  (already heads with `MinionTotalDPS`), `:195-199` load summary (already labels "Minion DPS"). No logic change
  needed once the fields are real; the C-45 spec's "38 offense fields" count holds.

### B1. Plan schema and validation

- `src/plan/schema.ts:184-190` `skills.main`: add `minionSkill` (text, optional) and, for minion skills with
  several stat sets, a minion stat set (see design correction 3). `.strict()` objects, so older plans are
  unaffected.
- `src/plan/schema.ts:42` `PLAN_SCHEMA_VERSIONS` and `:410-447` `VERSION_ADDITIONS`: the D-320/D-332 pattern says a
  new field comes with a version (4) and an entry naming its paths (`stages[i].skills.main.minionSkill`); plus the
  header comment `:7-12` and the plan-reference "Version first" text.
- `src/plan/schema.ts:508-514` C-31's main-group rule: unchanged (the minion skill doesn't move the group).
  Optional: require the same `minionSkill` wherever `main.group` is the `rolledGroup`, or leave it per stage (a
  stage before the command's node is allocated may use another minion skill or none).
- `src/plan/schema.ts:516-531` D-217's rolledGroup rule: `group.gems.some(name === roll.skill)` must also accept a
  group whose stage names `main.minionSkill === roll.skill` with `main.group === rolledGroup` (the schema can't know
  the summon-to-minion-skill relation; compile_check confirms it with game data, B2). The message at `:529` changes.
- `src/plan/schema.ts:371` `roll`: unchanged unless the roll gains a summoning-gem field (design correction 4).
- `src/plan/buildHash.ts`: no change (the field is build-affecting by default).
- `docs/build-guide/plan-reference.md`: rows for the new field(s) (`tests/static/planReference.test.ts:71-88`,
  AC-P9, fails until every schema path has a row), the version text, `roll.skill` and `rolledGroup` rows (see B8).

### B2. The compile path

- `src/plan/compiler.ts:384-398` `checkStageOf`: passes `main` through; `CompileCheckStage.main`
  (`src/engine/schemas.ts:1248`) gains the field(s).
- `src/plan/compiler.ts:734-776` `stageParams`: passes `main` (`:769`); `CompileStageParams.main`
  (`src/engine/schemas.ts:1289`) gains the field(s). `:779` `MEASURE_FIELDS` should add
  `MinionAreaOfEffectRadiusMetres` (clear measure, B3).
- `pob-api/API/Compile.lua:508-518` `check_stage` (compile_check, the read-only preflight): with `minionSkill`,
  check statically that the main active skill's gem summons a minion whose `skillList` names it (game data:
  `gemData.grantedEffect.minionList` → `data.minions[..].skillList` → `data.skills[id].name`), else a defect
  naming the minion's skills; an `ExtraMinionSkill` from a support can't be known statically, so either accept a
  support-granted name here and leave it to `compile_stage`, or resolve the supports' `ExtraMinionSkill` stat maps.
  Also a defect when `main.activeSkill` names an active skill without a minion (the "Command" trap, A1).
- `pob-api/API/Compile.lua:931-944` `select_main`: pass `minionSkill` (and the minion stat set) to
  `BuildOps.set_main_selection`, which resolves the name live (A2) after the stage's rebuild; return the resolved
  `{name, index, minion, statSet, count}` into the stage result for the record. Set `skillMinionSkillCalcs` too, so
  the saved file's Calcs tab agrees.
- `pob-api/API/Compile.lua:51-76` the `compile_stage` doc comment, and `:1307-1336` the result: add the resolved
  minion skill.
- `pob-api/API/Compile.lua:1221-1226, 1256` `stage_checks.activeSkills`: optional, add the selected minion skill
  (V2's `skill` producer lookup, `src/plan/checks/v2.ts:117-118`, would then find a minion skill as a producer).
- `pob-api/API/Compile.lua` `stage_checks`: should report, for a `minionSkill`, the nodes whose line reads
  `Grants Skill: <name>` and whether the stage allocates them (input for the V1 check in B6).
- `src/engine/schemas.ts:1187-1213` `compileStageReply`: the resolved minion skill (and the checks addition).
- Saving: `compile_finish` exports through PoB's own save, which writes `skillMinionSkill` and the minion stat-set
  lookup (A5); nothing to add.

### B3. The compile record, measures, key figures, ledger

- `src/plan/record.ts:74-85` `COUNT_RULE`: add the minion fields Full DPS merges (A1): `MinionTotalDPS` and
  `MinionImpaleDPS` `count`; `MinionTotalDot` `once` (the minion actor's `dotScale` is 1, not
  `activeSkillCount`); minion ailments `once`. Header doc `:54-72`.
- `src/plan/record.ts:386-398` `headlineDps` (D-294): with `main.minionSkill`, read
  `countedSkillOutputs[key].fields.MinionTotalDPS`, else `countedOutputs.fields.MinionTotalDPS`. Doc `:19-24`.
- `src/plan/record.ts:351-385` `clearGroupOf`/`clearEntryOf` and `:412-432` `stageMeasures`: a minion clear
  skill's radius and speed are `MinionAreaOfEffectRadiusMetres` and `MinionSpeed`.
- `src/plan/record.ts:447-484` `StageRecord`: add the resolved minion skill per stage (name, index, minion, stat
  set), so the guide, the audit and the checker can name it.
- `src/plan/record.ts:117-140` `countedFigures`: unchanged if the minion fields ride in the same entries.
- `src/plan/compiler.ts:538-558` `keyFigureLine`: `DPS <n>` reads `headlineDps`; label it (for example `DPS <n>
  (Navira's Fracturing, minion)`). `:1074` `mains` carries `main` with the new field.
- `src/handlers/planHandlers.ts:321-361` `keyFigureLines` (guide_run's stage view) and `:120-160`
  `renderCompileText`: follow `keyFigureLine`.
- `src/plan/ledger.ts:1-23`: no grammar change if the minion fields are `Minion<Field>` in `outputs` and in the
  breakdown entries; the doc comment should say so.
- `.claude/skills/build-guide/scripts/render-audit.mjs:301-306` duplicates `headlineDps` for campaign stages (B8).

### B4. `set_main_skill`

- `src/server/toolSchemas.ts:778-798`: add `minion_skill` (a name, case-insensitive; optionally a 1-based index)
  and a minion stat-set parameter; the description's first sentence changes, so regenerate the README table (B10).
- `src/server/toolMeta.ts:106`: `set_main_skill: core('mutate')`, unchanged.
- `src/server/toolRouter.ts:561-563`: pass the new arguments.
- `src/handlers/itemSkillHandlers.ts:316-360` `handleSetMainSkill`: validate and pass them; the reply names the
  minion, the selected skill and its index, and lists the minion's skills.
- `src/pobLuaBridge.ts:730-734` `setMainSelection`; `src/engine/schemas.ts:1436` params type,
  `:226-238` `selectedStatSetSchema`/`setMainSelectionReply` (add the selected minion skill).
- `pob-api/API/Handlers.lua:248-254` `set_main_selection`: return the minion selection.
- `pob-api/API/BuildOps.lua:1003-1067` `set_main_selection`: after the group/skill/stat-set rebuild, read
  `g.displaySkillList[g.mainActiveSkill].minion.activeSkillList`; resolve the name (A2); write
  `srcInstance.skillMinionSkill` (and `skillMinionSkillCalcs`), and the minion stat set into
  `srcInstance.skillMinionSkillStatSetIndexLookup[<summon ge id>][<index>]` as `Modules/Build.lua:461-475` does,
  validated against the minion skill's stat sets (an out-of-range index crashes PoB, A3); rebuild; confirm
  `minion.mainSkill`. Refusals change nothing: `snapshot_selection` (`:913-942`) already restores scalar gem fields
  (`skillMinionSkill`), but must also copy the two lookup tables.

### B5. The tools that show skills or the main skill

- `pob-api/API/BuildOps.lua:839-901` `get_skills`: per group, for each `displaySkillList` entry with a `minion`:
  the minion's name and type, its skill names in order, the selected index (`srcInstance.skillMinionSkill`) and the
  selected skill's stat sets and stat set. `src/engine/schemas.ts:196-217` `socketGroupSchema` gains it
  (`.passthrough()` already tolerates it).
- `src/handlers/itemSkillHandlers.ts:247-311` `get_skill_setup`: print `Minion: Navira, the Last Mirage; skills:
  1 Navira's Embrace, 2 Navira's Fracturing (selected), ...`. Description `toolSchemas.ts:765-776` optional.
- `src/handlers/poe2SkillHandlers.ts:41-47` and `src/services/poe2SkillService.ts:294-330` `analyze_skills`: the
  same minion line per group; it explains why `suggest_supports` ranks by the selected minion skill.
- `src/handlers/luaHandlers.ts:300-322` `renderStatsBreakdown` and `BuildOps.stats_breakdown`: with B0 the
  summon's block shows the selected minion skill's fields; should head the block with the minion skill
  (`## Navira, the Last Mirage / Navira, the Last Mirage [skill_part 1], minion skill 2 Navira's Fracturing`).
  Optional: measure every minion skill of the summon (and each of its stat sets) as extra blocks, restoring the
  index and the lookup tables afterwards (D-176's exact restore).
- `src/handlers/luaHandlers.ts:328-440` `lua_get_stats` default views: B0 suffices.
- `src/handlers/luaHandlers.ts:195-199` load summary, `src/handlers/exportHandlers.ts:210-240`
  `export_build_summary` (the "Main Skill" line could add the minion skill), `src/handlers/buildHandlers.ts:34-40,
  128-140, 297-298` `analyze_build`/`compare_builds`: B0 suffices; `analyze_build` prints `Total DPS`/`Combined DPS`
  only, so a `Minion DPS` row is optional.
- `suggest_supports` (`BuildOps.lua:1750-1820`): correct once the minion skill is set; at the default (index 1,
  a 0-DPS bubble) it ranks every support at 0. Its reply could name the minion skill it measured.
- `compare_trees`, `get_passive_upgrades`, `find_upgrades` (`src/handlers/treeHandlers.ts:365-413` reads
  `CombinedDPS || TotalDPS`; `find_upgrades` weights `FullDPS`): a minion main skill measures 0 there; optional to
  add `MinionTotalDPS` to `DPS_FIELDS`/`UPGRADE_FIELDS`.
- `guide_run` views: through `keyFigureLine` (B3).

### B6. `lookup_game_data` gem mode (and its neighbours)

- `pob-api/API/Lookup.lua:571-609` `lookupGems`: besides `d.gems`, index every minion skill reachable from a gem:
  for each gem, its active effects' `minionList` → `d.minions[id].skillList` → `d.skills[id]` (the walk
  `hitChildren` already does, `:474-509`), keyed by skill name, collecting the minions and summoning gems (several:
  "Basic Attack"), and add a result per matching skill (each grantedEffect id once, with every summoning gem and
  minion that casts it). Sort gem results first (47 minion-skill names equal a gem name, A2).
- A new result builder beside `gemResult` (`:511-569`): `kind = 'minion-skill'`, name, granted-effect id, the
  minion(s) and summoning gem(s), "commanded" when a stat set lists `is_commandable_skill` (21 such skills at this
  pin), description, skill types, cooldown, stat sets via `effectBlock` (minion skills have 1-2 levels with an
  `actorLevel`; say which level is shown), and the passive nodes whose line reads `Grants Skill: <name>` with their
  ascendancy (the unlock; PoB doesn't enforce it, A4).
- `pob-api/API/Lookup.lua:1237-1243` `addGemNames` (closest names on a miss) and `:1272-1318`: optional, add
  minion skill names as their own suggestion kind (static test T4 in B8 pins the two-kind text).
- `pob-api/API/Lookup.lua:1082-1100` mechanic mode: optional, add minion skills' descriptions as `[gem]`-like hits
  (a new kind would change `KIND_RANK`/`kinds` and the schema).
- `src/engine/schemas.ts:668-745` add `lookupMinionSkillSchema`, `:836` add it to the results union, `:848` type.
- `src/handlers/lookupHandlers.ts:129-199` `renderGem`, `:309-372` `render`: a renderer with a fixed kind line the
  brief check can match (for example `Kind: minion skill (commanded), cast by Navira, the Last Mirage (minion Navira,
  the Last Mirage)`), then `Summoned by:`, `Granted by:` and the stat sets. Header comment `:1-40`.
- `src/server/toolSchemas.ts:598-641` description ("mode 'gem': gems whose name contains `query`, ..."): mention
  minion skills; the first sentence ("gems, uniques, passives, item mods and essences") changes only if minion skills
  are named there (B10).
- `pob-api/API/Coverage.lua:743-754` `check_model_coverage {gems}`: a minion skill name is `unknown gem`. Optional:
  accept it and describe its stat sets (R1a runs coverage on the named source, B8).
- `search_tree_nodes {query:"Grants Skill: <minion skill>"}` already works (A4).

### B7. A new V1 check (should)

- `src/plan/checks/v1.ts` (findings table `:1-40`): a finding when a stage's `minionSkill` is a skill that a passive
  grants (`Grants Skill: <name>`) and the stage doesn't allocate that node; likewise for the summoning gem a node
  grants (32705). Inputs from `Compile.lua` `stage_checks` (B2). The finding code goes in gates.md's table (B8, T13).

### B8. The build-guide skill text, scripts and static tests

Mapped by a forked agent from the same context; the standalone copy is `/tmp/claude-1000/-home-parker-projects-pob2-mcp/68a01821-fdbc-4f0e-a6c7-3d9a92cb5935/scratchpad/amend6-skilltext.md`. `BG/` is
`.claude/skills/build-guide/`; `P` in the test list is `tests/static/buildGuidePipeline.test.ts`.

#### Where the pipeline stops today (the part that matters most)

A commanded minion skill fails at the first step, and two later steps send it the wrong way:

1. **The brief check stops it.** `BG/references/start.md:55-56` needs `## <skill>` with `Kind: active`.
   `lookup_game_data gem "Navira's Fracturing"` answers "Nothing matched" (spike), so
   `/build-guide "Disciple of Varashta" "Navira's Fracturing"` (the M-16 roll) stops at step 1 and suggests
   Mana Drain and Mirage Archer.
2. **R1a-assemble would class it as not a skill.** If a researcher proposes it, `BG/references/stages/R1a-assemble.md:30-34`
   finds no gem result. The mechanic lookup finds `[passive] Navira's Fracturing (Disciple of Varashta, node 10561)`,
   which meets the "damage source that isn't a skill" rule (`kind: "passive"`, D-334). The card is then marked
   "can't be finalized yet" (D-303), never compiled, and can never be finalized.
3. **The plan schema would refuse the rolled group.** D-217 requires `rolledGroup` to hold a gem named
   `roll.skill` (`docs/build-guide/plan-reference.md:258, 353`; the schema is the parent's). No group holds a gem
   named "Navira's Fracturing": the gem is "Navira, the Last Mirage".
4. **Every DPS reader would see 0.** The headline (`measures.dps`), the `rolledSkill` comparison
   (`countedSkillOutputs[g..s..p..].fields.TotalDPS`), the card's "Modelled DPS", the dossier column, the audit
   table and the guide's verdict lines all read the player's `TotalDPS`, which is 0 for a summon. The guide's
   "<Skill> about 0 DPS" would pass the checker, since it matches `measures.dps`. `rolled-not-largest` would fire
   whenever another clear-role group deals any damage.

#### SKILL.md (BG/SKILL.md): 3 touch points

- `:13-15` (c): "every card names its named damage source"; the wording stays, but say once that it may be a
  minion's commanded skill, cast by its summoning gem's group.
- `:24-25` (b): the brief check's tools. Unchanged, unless the lock also has to check the summoning gem's grant
  (see the R1a lock below).
- `:129-133` (a, b): "a card whose damage source isn't a skill compiles nothing (D-334)". This must exclude a
  minion skill, or a commanded skill is never finalizable (route 2 above). The `wrong-ascendancy` sentence stays.

#### references/start.md: 6 touch points

- `:29` (a): the brief table, `skill` = "an active skill gem, the named damage source". Widen it to "an active
  skill gem, or a minion's skill its summoning gem casts (a commanded skill)". A static test asserts this text
  (T1 below).
- `:44-45` (a): "only an active gem is a `skill`" (D-343). Widen it to an active gem or a minion skill. Static
  test T2.
- `:55-56` (a): the core gate. `A result headed ## <skill> … must say Kind: active` needs a second accepted
  form, whatever kind line the new gem-mode result prints for a minion skill (for example
  `Kind: minion skill (Navira, the Last Mirage)`). The design must fix the exact string, and the check must
  name the summoning gem so later steps use it.
- `:57-63` (a): the D-343 subject rule ("An active gem goes in `skill`"). Add: a minion skill also goes in
  `skill`. Static test T3 pins this sentence.
- `:64-69` (b): the ascendancy lock. For "Navira's Fracturing", `search_tree_nodes "Grants Skill: Navira's
  Fracturing"` finds node 10561 (Varashta), so the lock passes for Varashta. It doesn't look at the summoning
  gem's own grant (node 32705, "Grants Skill: Navira, the Last Mirage"). Running the lock on both the minion skill
  and its summoning gem (the gem lookup names it) covers a skill only the summon is locked to.
- `:70-78` (a): the failure text "only an active gem is a valid roll"; the closest-names list (D-258) shows only
  gems. If gem mode starts suggesting minion skills on a miss, update this text (and T4).

#### references/stages/R1a.md: 6 touch points

- `:30-31` (a): with a support gem in `around`, "each card's named damage source is an active skill it can
  support". For a minion skill, the support goes on the summoning gem's group. Static test T5.
- `:33-48` (b): the ascendancy lock. Add that a minion skill's lock also covers its summoning gem. `:45-46`
  "With no node and no unique, the skill comes from its gem" gains "a minion skill comes from its summoning gem".
  Static test T6 pins `:44-46`.
- `:93-95` (d): "A line that is unparsed … is a modelling gap". For node 10561, check_model_coverage says
  `unparsed` (PoB's ModCache has `{nil,nil}` for it), yet PoB still computes the skill through the djinn's skill
  list. Add an exception: a `Grants Skill: <minion skill>` node is unparsed but isn't a gap, and nothing in PoB
  checks that the node is allocated.
- `:100-103` (a): "Each named damage source a card proposes: lookup gem <skill> … Run check_model_coverage
  {gems: [<skill>]}". check_model_coverage's `gems` takes gem names only (the parent's area), so for a minion
  skill run it on the summoning gem, or extend the tool.
- `:113` (a): "the supports each card needs, checked against its named damage source": for a minion skill,
  checked against the summoning gem's group.
- `:147-151` (a): Identity, "an active skill gem … A damage source that isn't a skill (an item, a passive or a
  modifier …)". Add the minion skill with its summoning gem and minion, and keep a passive-granted command out
  of "isn't a skill".

#### references/stages/R1a-assemble.md: 3 touch points

- `:27-31` (a, b): the identity check, "a named damage source that is a skill: lookup gem … says `Kind: active`".
  Accept the minion-skill kind too. T7 pins `:27`.
- `:32-34` (a): "a damage source that isn't a skill (an item, a passive or a modifier; D-334): a lookup by its
  kind returns it (… `kind: "passive"`)". Without an exclusion, a commanded skill granted by a node qualifies
  here (route 2). Exclude "a minion skill the gem lookup finds".
- `:37-46` (b): the ascendancy lock, run for every skill a card names. Add the summoning gem to the skills
  checked. T6 pins the "Not dealt" sentence.

#### references/stages/R1b.md: 7 touch points

- `:18-20` (c): "The card's identity … is the skeleton's `roll`. … its group is the skeleton's `rolledGroup`."
  Add: for a minion skill, the group holds the summoning gem, and `skills.main.minionSkill` names the skill.
- `:36-55` (b): the lock (the same summoning-gem addition). `:52-53` "A skill a non-ascendancy node grants … step
  1's tree targets include the node". **Gap:** nothing requires the granting ascendancy nodes (10561 for the
  command, 32705 for the summon) in the tree, and PoB computes the skill without them (spike: deallocating 10561
  left the DPS at 1,027). Add both to the tree targets.
- `:57-58` (a): "A card that passes the lock and whose damage source isn't a skill (D-334) gets none of steps 1
  to 8". Exclude minion skills.
- `:73-77` (c): bootstrap, "the named damage source alone in one group (with its `role`, `main` and
  `rolledGroup`)". For a minion skill: the summoning gem's group, `main.activeSkill` = the summon (1), not the
  gem's second active skill "Command", plus `main.minionSkill`.
- `:85-86` (c): "`roll` is the card's identity (class, ascendancy, named damage source)". `roll.skill` is the
  minion skill's name; it has no gem. See design note D3.
- `:104-106` (c): "`skills`: the named damage source's group with the card's supports … `main` on the named
  source, and `rolledGroup`". Same change as `:73-77`.
- `:233-236` (c, e): Verified, "the named source's modelled DPS: … `countedSkillOutputs[g<group>s<skill>p<statSet>].fields.TotalDPS`".
  For a minion that figure is 0; read the minion figure the record will carry. Also `:194` (d): the payoff-thief
  risk, "hit-making children … minions", is unchanged and already works through the summoning gem's lookup.

#### references/stages/R1b-assemble.md: 2 touch points

- `:16-17, 53-55` (a): the "can't be finalized yet … `not-a-skill`" status. Text unchanged, but a minion skill
  must never get here (that is R1b's change). T8 pins the wording.
- `:24-27, 42-43` (c): the dossier's "named damage source's Count-scaled figure
  (`countedSkillOutputs[g<group>s<skill>p<statSet>].fields`…)". Use the minion figure for a minion skill.

#### references/stages/D1-build.md: 6 touch points

- `:78-83` (c): "The card's named damage source is the plan's `roll.skill` (D-286). … Its group is
  `skills.rolledGroup`". Add: for a minion skill, the group holds the summoning gem, and `skills.main.minionSkill`
  names the skill. T9 pins `:80`'s D-122 sentence (unchanged).
- `:87-90` (c): "Its figure, × its Count … `countedSkillOutputs[g<group>s<skill>p<statSet>].fields.<Field>`
  … `g<group>s<skill>p<statSet>.<Field>`". The figure key needs a minion form, and every group compared must use
  the same `<Field>` across player and minion keys. T10 pins the countedSkillOutputs string.
- `:91-93` (c): "Put the named source's group first (`skills.main.group: 1`, `main` on the named source)". Add:
  `activeSkill` is the summon, never the gem's "Command" skill (Navira's gem grants two active skills,
  SummonWaterDjinnPlayer and CommandWaterDjinnBubblePlayer), and set `minionSkill`.
- `:94-99` (c): "**Set `skills.main.statSet`** … `p<statSet>` … `<stage>.g<main.group>s<main.activeSkill>p<main.statSet>`".
  `statSet` is the summon's stat set (1 of 1). A minion skill with two or more stat sets (Kelari's Deception has
  2: "Kelari's Deception" and "Hidden"; Kelari's Brutality 2; Ruzhan's Trap 3) needs its own field. Static test
  T11 pins the regex.
- `:100-112` (c, d): "`mcp__pob2__suggest_supports` ranks supports", plus Count for "minions that each cast it".
  suggest_supports already ranks a minion group by `Minion.CombinedDPS` (`BuildOps.lua:1753`), which follows the
  gem's `skillMinionSkill`, so it is right once the compile sets the skill. No text change; say so if useful. Note
  that a `customMods` line applies to the player: a minion-skill estimate (PG-25's Kelari ramp) needs a minion
  modifier line.
- `:188-194` (c): "Its reply gives each stage's key-figure line (the headline DPS, …)". This is
  `measures.dps`; it becomes the minion figure once the record changes. Grep `countedSkillOutputs` for the minion
  figure too.

#### references/stages/D1-finish.md: 2 touch points

- `:42-45` (c): measuring the anoint "against … the headline DPS". It is 0 for a minion until the record changes;
  no text change after that.
- `:97` (c): "the record measures the rest (`stages.<id>.measures`: the headline DPS …)". No text change once
  `measures.dps` reads the minion; otherwise D1-finish would write ledger entries for it.

#### references/stages/D1-gate.md: 2 touch points

- `:85-99` (c): rolledSkill. The figure keys `g<group>s<skill>p<statSet>.<Field>` and the stat-set rule
  `g<main.group>s<main.activeSkill>p<main.statSet>` (`rolled-stat-set`) need the minion form and the
  minion-stat-set rule. T11 pins `:95-99`; T12 pins `:87-88`.
- `:105` (c): the design display's `dps`, "the record's `measures.dps`". No text change once the record carries
  the minion figure. Note that `clearSpeed` (`:107`) reads the clear group's `AreaOfEffectRadiusMetres` and
  `Speed` from `skillOutputs`, which for a summon are the player's (no radius, Speed 0). The rough clear speed is
  wrong for a minion clear skill (the record is the parent's area).

#### references/gates.md: 3 touch points

- `:89-105` (c): the rolledSkill definition, with the same key and stat-set changes as D1-gate. T12 pins
  `:97`'s countedSkillOutputs string; T13 pins the per-copy string.
- `:128-146` (c): `basis.rolledSkill` example figures `g1s1p1.TotalDPS`, and "the record field … compared". Add
  the minion key form.
- `:218-222` (c): the finding codes. `rolled-stat-set`'s meaning ("the stage sets no `skills.main.statSet` …")
  gains the minion stat set. Consider a new code for a minion main skill whose `minionSkill` doesn't resolve, or
  whose granting node isn't allocated. T14 pins `| rolledSkill | \`rolled-stat-set\` |` and `rolled-not-main`.

#### references/stages/D2.md: 1 touch point

- `:55-64` (c, d): "The named damage source (the plan's `roll.skill`) … is level-gated by its gem's level
  requirement (`lookup_game_data {mode: "gem"}` …)". For a minion skill, the gates are the summoning gem's
  requirement and the ascendancy nodes that grant the summon (32705) and the command (10561), at the trial that
  allocates them. Before those nodes, the stage's `minionSkill` must not name the command: PoB won't stop it, and
  a V1 check would be needed (the parent's area). T15 pins `:62-63`.

#### references/stages/W1.md: 3 touch points

- `:22-24` (c): the prompt, "the named damage source's figures in `basis.rolledSkill`". Unchanged.
- `:82-84` (c): "<Skill> about <n> DPS": "the record's `measures.dps`, the figure PoB's Full DPS shows for the
  named source (D-294)". The wording holds once `measures.dps` is the minion's: Full DPS does carry the minion's
  TotalDPS when the group is in Full DPS (spike: FullDPS 1,027 and 3,231). Note that Navira's Fracturing has
  `base_skill_show_average_damage_instead_of_dps`, so PoB's sidebar shows its average hit, not DPS. A guide line
  in DPS for a 5-second-cooldown skill may read oddly, so the design may want the hit and the use rate. T16 pins
  this line.
- `:156-157` (c): "How to play it: … the named damage source as the main damage (D-122)". For a command skill,
  say that the player presses Command (Navira's gem's second active skill) and the djinn deals the damage. A small
  wording addition.

#### references/stages/V4.md: 3 touch points

- `:36-40` (c): reads `skillOutputs`, `measures`. Add the record's minion fields, wherever the parent puts them.
- `:83-85` (b): "A `pob-computed` number resting on a line PoB doesn't apply is a finding". The node line
  "Grants Skill: Navira's Fracturing" is unparsed, so a verifier may wrongly flag the minion DPS as resting on it.
  Add the exception from R1a `:93-95`.
- `:97-98` (b): "an unparsed line is ignored. A PoB number that relies on such a line is wrong": the same
  exception.

#### references/patterns.md: 3 touch points (word budget: see T17)

- `:55` (d): "Archon of Undeath with Muster on command skills". No change needed.
- `:649-654` (d): **Actor rerouting**. `Search: granted command skills (\`tree\` on the ascendancy, gem lookup)`
  works only after the change, since gem lookup finds none today. `PoB: modelled as a minion skill` should add
  "selected with `skills.main.minionSkill`; PoB computes it whether or not the granting node is allocated (PG-40)".
  `Examples: Varashta: Kelari's Deception as minion damage` could add Navira's Fracturing.
- `:191` (d): Payoff thief, "a gem lookup's `Hit-making children:`". Already lists the summon's hit-making
  minion skills (spike: Navira's gem lists `Navira's Fracturing (minion Navira, the Last Mirage)`). No change.
- **Word budget:** patterns.md is at **5,999 words**, and the test caps it at 6,000 (T17). Any addition needs an
  equal cut.

#### references/lookups.md: 2 touch points

- `:9-25` (a, d): gem mode's description. Add the new result kind: a minion skill found by name, with its minion,
  its summoning gem(s), and "a minion skill, not a gem" (D-299's "Hit-making children" stays).
- `:72-80` (b): the coverage table, `unparsed → hand-calculate it`. Add the "Grants Skill: <minion skill>"
  exception (as in R1a `:93-95`).

#### references/checkpoints.md, run-log.md, run-folder.md: 6 touch points

- `checkpoints.md:36-37, 59-61, 67-69` (a): the "can't be finalized yet" status (D-303). Unchanged text, but a
  minion skill must not get here.
- `checkpoints.md:56-58` (c): "the named damage source's Count-scaled figure, `Life` and `TotalEHP`". Use the
  minion figure. T18 pins it.
- `run-log.md:18` (c): `roll` = `{className, ascendancy, skill}`. Unchanged unless the roll gains a
  summoning-gem field (D3); `run-log.mjs:116` and `check-run.mjs:1646` enforce exactly those 3 keys.
- `run-log.md:36` (a): brief `skill` = "an active skill gem (the named damage source)". Widen it.
- `run-log.md:68-71` (a): `not-a-skill` is terminal. Unchanged.
- `run-folder.md:104-105, 141-143` (c): the checker compares "the named damage source's figure the D1 gate's
  verdict names" and "its figure's stat set equal to `skills.main.statSet`". Add the minion stat set and key.

#### Templates: 6 touch points

- `templates/card-template.md:26-29` (a): "Named damage source: <… an active skill gem, or for a damage source
  that isn't a skill the item, passive or modifier …, D-334>". Add the minion skill and its summoning gem. T19
  pins the field labels only (`Named damage source:`).
- `templates/card-template.md:30-32` (b): "Granted by: <skill>: …". For a commanded skill, both the command's node
  and the summon's node.
- `templates/card-template.md:82-83` (c): "Modelled DPS: <the named source's Count-scaled figure
  (`countedSkillOutputs`), its stat set and group>". Add the minion figure and minion skill. T19 pins the label
  `Modelled DPS:`.
- `templates/dossier-template.md:17` (c): `<Skill> <the Count-scaled figure> (<its field>)`. Add the minion key.
- `templates/audit-template.md:42` (c): "<the named source's Count-scaled figure; measures.dps on an endgame
  rung>". Rendered by `render-audit.mjs` (below).
- `templates/guide-template.md:66-69` (c): "<Skill> about <n> DPS" in the verdict lines (the same note as W1
  `:82`). `:176` (D-359) on supports for a passive-granted skill already applies to a tree-granted summon. No
  change there.

#### Agent definitions (.claude/agents/build-guide/): 1 touch point

- `build-guide-coordinator.md:109-112` (c): "Its group is `skills.rolledGroup` … D1 sets `skills.main.statSet`
  to the stat set of the figure the gate compares". Add `minionSkill`, and the minion stat set if one is added.
  The coordinator's tool list has no `set_main_skill`, so the plan's `main` is D1's only route; no tool-list
  change is needed. The researcher, verifier and writer definitions only say "named damage source": no change.

#### docs/build-guide/plan-reference.md: 7 touch points

- `:61, :117` (c): the `pob-computed` ref syntax, `<stageId>.g<group>s<skill>p<statSet>.<Field>`. Add the minion
  form. The same syntax is in `BG/references/source-markers.md:15`, so change it there too.
- `:143-149` (c, d): Count, "minions each casting the skill"; the rolledGroup goes in Full DPS. Unchanged; Full
  DPS then carries the minion's figure.
- `:223-226` (c): "`dps` (the named source's Count-scaled `TotalDPS`)". Say it is the minion skill's for a minion
  main skill.
- `:258` (a): "`roll.skill` … The rolled skill gem's name; `skills.rolledGroup` names a group holding a gem of
  this name". Allow a minion skill whose summoning gem the group holds.
- `:349-352` (c): the `skills.main` rows. **Add a `stages[].skills.main.minionSkill` row** (and a minion stat-set
  row if one is added): T20 fails until every schema path has a row.
- `:353` (a): `rolledGroup`, "The group holding a gem named `roll.skill`". The same widening.
- `:424-605` (c): the worked example (Boneshatter) needs no change; optionally add a minion-skill fragment.

#### Scripts

##### BG/scripts/check-run.mjs: 9 touch points

- `:340-346` `figureOf` (e): the regex `^(g\d+s\d+p\d+)\.(\w+)$` reads only `countedSkillOutputs` and
  `skillOutputs`. Extend it to the record's minion key or fields.
- `:1001-1002` (e): the guide's H1 must name `roll.skill`. Unchanged ("Navira's Fracturing").
- `:1171-1176` (e): campaign S7, `main.group === rolledGroup`. Unchanged; optionally also check `minionSkill`
  on stages with the rolled group.
- `:1451-1463` (e): the verdict line's DPS vs `st.measures.dps`, with the message text
  `(the main group's TotalDPS × its Count)`. The value follows the record; the message wording changes. T21 and
  T22 pin that message.
- `:1646-1648` (e): `roll` is exactly `{ascendancy, skill}` (type check). Only changes if the roll gains a field.
- `:2897-2985` `recomputeRolledSkill` (e): `rolled-stat-set` needs `isInt(main.statSet)` and
  `mainKey = g${group}s${activeSkill}p${statSet}`; the figure regex at `:2943`; the ledger-ref regex at `:2961`
  (`([A-Za-z0-9_]+)\.(g\d+s\d+p\d+)\.[A-Za-z_]\w*`). All need the minion key and minion stat set.
  `rolled-not-largest` (`:2977-2982`) compares raw values across groups, which is correct once the minion figure is
  real.
- `:3035-3051` `citedValues` (e): the `pob-computed` ref resolver (`<stage>.<Field>` or `<stage>.g..s..p...<Field>`).
  Add the minion form.
- `:3053-3060` `ledgerResults` (e): passes only `outputs` and `skillOutputs` to the ledger evaluator, so a ledger
  formula can't read a minion figure unless the record puts it in one of those (`build/plan/ledger.js` is the
  parent's area).
- `:2451-2460` (`TERMINAL_R1B`, `not-a-skill`): unchanged; a minion skill must not end `not-a-skill`.

##### BG/scripts/render-audit.mjs: 3 touch points

- `:301-306` `headlineDps` (e): a duplicate of `record.ts`'s rule (`countedSkillOutputs[key].fields.TotalDPS ??
  countedOutputs.fields.TotalDPS`), used for **campaign** stages. It gives 0 for a minion main skill: make it
  read the minion figure, keeping it in step with `record.ts`.
- `:321` (e): endgame rows read `rec.measures?.dps`. They follow the record.
- `:233-238` `ledgerValues` (e): the same outputs/skillOutputs-only shape as check-run's `ledgerResults`.
- (`:425` clear speed reads `measures.clearSpeed`; it is wrong for a minion clear skill, as in D1-gate `:107`.)

##### BG/scripts/run-log.mjs: 1 touch point

- `:116` (e): `roll` has exactly the keys className, ascendancy and skill. Changes only if the roll gains a
  summoning-gem field. `:218, :281` print `measures.dps` and follow the record.

#### Static and unit tests that assert this text (break or need updating)

`tests/static/buildGuidePipeline.test.ts` (P):
- **T1** P`:2425`: `'| \`skill\` | an active skill gem, the named damage source | Blood Hunt |'` (start.md `:29`).
- **T2** P`:2426`: regex `… never in \`skill\` (D-343): only an active gem is a \`skill\`. Step 1's gem lookup tells them apart.` (start.md `:44-45`).
- **T3** P`:2440-2448`: the D-343 subject sentence (`- a name the free text gives as the build's subject (D-343): look it up …`), its order before `- both, once each passes`, and `for a support gem, say "<name> is a support gem"` (start.md `:57-63`).
- **T4** P`:1378-1384`: the D-258 closest-names refusal text, plus `lookupHandlers.ts` containing ``Closest ${kind} gem names ${SUGGESTION_ORDER}:`` and `for (const kind of ["active", "support"])`. It breaks if the miss suggestions add a minion-skill kind.
- **T5** P`:2449`: R1a `A support gem in \`around\` is the build's subject (D-343): each card's named damage source is an active skill it can support.`
- **T6** P`:2362` (the lock's RULE regex), `:2372` (`every skill (a|the) card names, (its named damage source, (and each skill in its chain and links|its chain and its links)`), `:2375-2377` (R1a `With no node and no unique, the skill comes from its gem`; R1a-assemble's "Not dealt" sentence), `:2383-2389` (R1b lock order and wording), `:2395-2412`.
- **T7** P`:2126`: R1a-assemble `**Check each card's identity** \`{className, ascendancy, skill}\`, \`skill\` being the named damage source (D-286)`.
- **T8** P`:2311-2326`: the not-a-skill status wording in R1b-assemble, SKILL.md and checkpoints. Unchanged unless that wording moves.
- **T9** P`:612-614`, `:2229-2246`: the D-122/D-148 sentences and "named damage source". Keep them verbatim.
- **T10** P`:2342-2343`: gates.md, D1-gate and D1-build contain `` `countedSkillOutputs[g<group>s<skill>p<statSet>].fields.<Field>` `` and `` `skillOutputs[g<group>s<skill>p<statSet>].fields.<Field>`, the per-copy value ``.
- **T11** P`:1306-1313`: D1-build's `**Set \`skills.main.statSet\`** on each variant stage … \`p<statSet>\` in \`g<group>s<skill>p<statSet>.<Field>\` (amendment 1 S7)`; D1-gate's `**The rolled figure's stat set is the stage's \`skills.main.statSet\`** (S7): …`; D1-build's `` `skills.main.group` is the `rolledGroup`, and the rolled figure, … is `<stage>.g<main.group>s<main.activeSkill>p<main.statSet>` ``; D2's `Set \`skills.rolledGroup\` wherever a stage has the named damage source, and there \`skills.main.group\` is the \`rolledGroup\``; check-run contains `'rolled-stat-set'`.
- **T12** P`:2281-2282`: D1-gate `its figure **× its Count** is the largest among the stage's groups with that role (else \`rolled-not-largest\`)`, and gates.md and D1-gate contain the countedSkillOutputs string.
- **T13** P`:629-631`: gates.md finding-code table rows (`rolled-role`, `rolled-not-largest`, …). Adding a code needs it there.
- **T14** P`:1308-1310`: gates.md contains `| rolledSkill | \`rolled-stat-set\` |` and `| rolledSkill | \`rolled-not-main\` |`.
- **T15** P`:1312`: the D2 rolledGroup sentence (in T11).
- **T16** P`:1930`: W1 `"<Skill> about <n> DPS": the named damage source's Count-scaled figure, the record's \`measures.dps\``.
- **T17** P`:1814-1818`: patterns.md ≤ 6,000 words (now **5,999**). P`:1717-1830`: entry structure (Shape, Search, PoB, Examples, Cautions, in order).
- **T18** P`:2195`: checkpoints `the named damage source's Count-scaled figure, \`Life\` and \`TotalEHP\`, D-294`.
- **T19** P`:1637, :1650`: card-template field labels `Named damage source:` and `Modelled DPS:` (labels only).
- P`:387` and P`:966`: the dossier column `Named source DPS` and the audit header. Unchanged.
- P`:2401-2402, :2478-2480`: spec text (slice 03 and AC-W47: the runner's lookups, `/build-guide Titan "Explosive Concoction"`). These touch the spec only if the brief-check wording in the spec changes (the parent's spec fold).

Others:
- **T20** `tests/static/planReference.test.ts:71-88` (AC-P9): plan-reference's field table equals the schema
  paths, with matching Required cells. A new `skills.main.minionSkill` (and any minion stat set or roll field)
  needs its row.
- **T21** `tests/unit/buildGuideCheckRun.test.ts:877`: `… n\.measures\.dps \(the main group's TotalDPS × its Count\) is 100000`.
- **T22** `tests/unit/buildGuideCheckRun.test.ts:899`: the same message for the Budget line. Also `:543-574` (the
  rolledSkill and verdict-line cases built on `g1s1p1` figures) and `:857-858`. They pass as they are; model a
  minion case on them.
- `tests/helpers/guideRunFolder.ts:32, 41, 64, 71, 141-143, 153, 168`: the fixture run (Blood Hunt, `g1s1p1`
  records, measures). A minion-skill variant of this fixture would be the base for the new checker tests.
- `tests/unit/buildGuideScripts.test.ts:80, 135, 163, 215`: render-audit's table and measures. They pass as they
  are; add a campaign-stage minion case for `headlineDps`.
- `tests/integration/lookupGameData.test.ts:258-273` (AC-K63): reads `lookups.md` for seven phrase queries only.
  Unaffected unless they are removed.

The fork's own design notes (D1 to D9 in the standalone copy) are folded into the corrections below.

### B9. Unit, integration and fixture tests to change or model new ones on

- **`set_main_skill` and the breakdown:** `tests/integration/skillBreakdown.test.ts` (AC-K15…K19: stat set
  selected, out-of-range refusal that changes nothing, breakdown values, exact restore, bounds). Model the
  minion-skill tests on it. A minion fixture already exists: `tests/fixtures/builds/grenadator.xml` group 6,
  Pounce (`skillMinion="WolfMinion"`), whose Wolf Companion has `Basic Attack`, `Leap Slam`
  (`lookupGameData.test.ts:2046` asserts those two children). Tests: select "Leap Slam" by name; an unknown name
  and a group without a minion are refused and change nothing (export and `revision` unchanged); the minion stat-set
  refusal; the breakdown restores `skillMinionSkill` and the lookup tables.
- `tests/fixtures/tool-calls.json:158-161`: `set_main_skill` samples (ok and error) for the new parameter; the
  toolHygiene test runs them.
- `tests/integration/contract.test.ts:143, 292`: the `set_main_selection` contract cases (params and reply shape).
- `tests/unit/pobLuaBridge.test.ts`, `tests/unit/pobLuaBridge.simple.test.ts`, `tests/mocks/responses.mock.ts`: the
  bridge's reply schemas (`get_skills`, `set_main_selection`, `lookup_game_data`).
- **The minion fields (B0):** a test that `lua_get_stats {category:"offense"}` with a minion main skill shows
  `MinionTotalDPS` etc. (none of the TS paths has ever been exercised with a real value);
  `tests/static/adviceStatKeys.test.ts:173-181` uses `MinionTotalDPS` only as a synthetic example (unaffected).
- **Lookup:** `tests/integration/lookupGameData.test.ts:2039-2120` (AC-K64's children, with a sweep over every gem
  that recomputes PoB's minion lists in Lua) is the model for a minion-skill result test: "Navira's Fracturing" →
  one result, minion Navira, summoned by Navira, the Last Mirage, commanded, granted by node 10561; "Gas Arrow" →
  the gem first, then the Skeletal Sniper's skill; a sweep that every hit-making child named under a gem is found
  by its name. `:888, :970` (miss suggestions) if suggestions change.
- **Schema:** `tests/unit/planSchema.test.ts:322-338` (D-217's rolledGroup cases) gains the minion-skill
  acceptance and its refusals; the version cases for a v4-only field.
- **Compile:** `tests/integration/compilePlan.test.ts` (AC-P21…P46) and `tests/integration/compileMeasures.test.ts:247-256`
  (AC-P63: `dps` equals `countedSkillOutputs.g1s1p1.fields.TotalDPS`, and `> 0`) are the models: a fixture plan
  with a summoning gem as the main group and `minionSkill`, whose record has `measures.dps` =
  `countedSkillOutputs[...].fields.MinionTotalDPS` > 0 and the reloaded file has `skillMinionSkill` set. Fixture
  plans live in `tests/fixtures/plans/` (`two-stage`, `two-stage-count`, ...). A Wolf-companion skill works without
  a Varashta tree; a djinn plan needs the Sorceress tree and its ascendancy nodes.
- `tests/integration/compileCount.test.ts`: Count × `MinionTotalDPS` (the minion actor's `count`).
- `tests/unit/planMeasures.test.ts`: unit cases for `headlineDps`/`clearSpeed` with minion fields.
- `tests/integration/guideRun.test.ts:30, 354`: `keyFigureLine` with a minion main.
- `tests/unit/planChecks.test.ts`: the new V1 finding (B7).
- Engine tests stay behind `engineDescribe`; nothing here needs the network.

### B10. README tool table

`pnpm build && pnpm docs:tools --write` (`scripts/gen-tool-table.mjs`) after changing a tool's first description
sentence: `set_main_skill` (`README.md:200`) certainly; `lookup_game_data` (`README.md:190`) if its first sentence
names minion skills; `get_skill_setup` (`README.md:199`) if its first sentence changes.
`tests/static/readme.test.ts` fails until it matches.

### B11. The specs the eventual fold touches (not edited)

The tool contracts live in the build-guide spec, not the stabilization spine.
- `docs/build-guide/spec/README.md`: contract rows C-37 (`:636`), C-41 (`:640`), C-44 (`:643`), C-45 (`:644`), the
  existing-system row for `set_main_skill` (`:118`); the plan schema summary (`:281-306`: `roll.skill`,
  `rolledGroup`, `main.statSet`); the roll/brief check (`:520-526`, `:571-574`); C-52's identity and lock
  (`:582-587`), "can't be finalized" (`:606-608`); decisions D-217 (`:819`), D-273 (`:875`), D-294 (`:896`), D-295
  (`:897`), D-303 (`:905`), D-334 (`:936`), D-342 (`:944`), HG-21 (`:1014`, a non-skill source's plan field: a
  minion skill is not that case, so say so). A new decision row for amendment 6 and its PROPOSED rulings.
- `docs/build-guide/spec/01-server-tools.md`: §2.2 C-37 (`:111-245`, gem mode's result kinds), AC-K64 (`:1449`);
  §2.5 C-44/C-45 (`:359-378`: the minion skill selection, its errors, the breakdown's restore of the minion fields;
  "the 38 offense fields" become real for minions), AC-K15…K19 (`:924-950`) and the test map (`:1501`).
- `docs/build-guide/spec/02-plan-compiler.md`: §3.2 schema (`:210-371`, the `main` type at `:301-305`, the
  rolledGroup comment `:305`, `:352`), §3.3 ledger refs (`:387`), §3.6 compile (`:451-762`: `skillOutputs` keys
  `:547`, record type `:654`, counted figures `:702`, the headline `:717`), §3.7 V1/V2 (`:763-818`, the new
  finding), WU-65's measures (`:1112-1125`), the schema ACs (`:1212` AC-P9, `:1230-1241`), AC-P63 (`:1503`).
- `docs/build-guide/spec/03-pipeline.md`: the brief check (`:179-183`, "says `Kind: active`"), deck assembly's
  identity (`:530`), damage sources that aren't skills (`:1105`, `:2534`), AC-W47 (`:2358-2366`), the D-342 unit's
  touches (`:1826-1840`).
- `docs/build-guide/pob-gaps.md`: PG-40 (`:197-198`, "Grants Skill: Kelari's Deception" parses to nothing,
  "unchecked"): now confirmed, the skill comes from the djinn's skill list, ungated; PG-25 (`:152`, Kelari's
  Deception's ramp); a new entry for the tree-granted summon (level 1, supports wiped, A4).
- `docs/build-guide/plan-reference.md`: see B8 (7 touch points; the AC-P9 row is mandatory).
- `docs/stabilization/spec/02-engine.md`: D-77's `lua_get_stats` contract (`README.md:276`) and E7/AC-E26's
  default field list: unchanged unless `Minion<Field>` names join `DEFAULT_STAT_FIELDS` (they needn't; the
  callers name them). AC-E16's canonical export already strips `<MinionStat>`.

---

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
