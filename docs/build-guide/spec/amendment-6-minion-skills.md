# Amendment 6: a minion's skill

**Status: ACCEPTED by the user, 2026-10-16** ("Go ahead"). It carries out the user's choice of 2026-10-16: before the M-16 baseline run, make a
minion's skill selectable, so a build whose damage is a command its minion casts can be designed and measured. The
coordinator folds it into the spine and slices 01–03 with amendment 5 at v1.6. Paths without a directory are under
`.claude/skills/build-guide/`.

**Evidence:** *the spike* (`../studies/2026-10-16-minion-skill-spike.md`): Navira's own PoB measured with the djinn's
first and second skill selected, what each tool and the compile record show, how PoB builds a minion's skill list, and
the unparsed `Grants Skill:` lines. The build's touch-point map is `../studies/2026-10-16-minion-skill-map.md`.

**Names.** A *summon* is an active skill that creates a minion ("Navira, the Last Mirage"). Its minion's *skill list*
is what PoB's "minion skill" dropdown offers: the minion's own skills in its data order, then any skills supports add.
A *command* is a minion skill the player orders the minion to use (Navira's Fracturing); its passive unlocks it in
game. "The checker" is `scripts/check-run.mjs`; "the renderer" is `scripts/render-audit.mjs`.

## 1. The user's direction

- **The baseline guide** (the user, 2026-10-16) is Navira's Fracturing Disciple of Varashta, the only guide the user
  found whose PoB holds every stage as a loadout. It replaces Fubgun's Lightning Arrow Deadeye guide.
- **Its damage can't be measured today.** Navira's Fracturing is the Water Djinn's second skill, not a gem. The run's
  start-up check stops it, plans can't select it, and no tool or record can read a minion's damage.
- **The user's choice:** add minion-skill selection first, then run the baseline with
  `/build-guide "Disciple of Varashta" "Navira's Fracturing"`.

## 2. D-376: a minion's numbers are readable

PoB keeps a minion's numbers in a nested `Minion` table. Our Lua bridge returns flat numbers only, so every
minion figure is lost. The server already asks for `MinionTotalDPS` and ten similar names, which have never existed
(spike A1).

- **In the bridge, a requested field `Minion<Field>` that PoB's output lacks reads `Minion[<Field>]`.** At the pin
  only `MinionRevivalSpeed` exists natively, so no name collides.
- **It applies in three places:**
  - `export_stats`: `lua_get_stats`, the load summary, `analyze_build`, `compare_builds` and `export_build_summary`;
  - `stats_breakdown`: the breakdown, and the compile's per-group outputs;
  - the compile's `outputs`, which add the flattened `Minion<Field>` numbers.
- **The ledger needs no grammar change:** `<stage>.MinionTotalDPS` and `<stage>.g1s1p1.MinionTotalDPS` are ordinary
  refs.
- **No field lists change.** The eleven minion fields of the offense view become real, and C-45's count holds.

## 3. D-377: a group chooses its minion's skill

- **Plan schema 4.** A socket group may carry two fields:
  - `minionSkill`: the minion skill's name, as the gem lookup gives it;
  - `minionStatSet`: a whole number of at least 1, default 1. It is allowed only with `minionSkill`.

  The version addition reads "a group's minion skill (D-377)"; before 4, a minion uses its first skill.
- **The field sits on the group,** because PoB keeps the choice per summon. So a build can measure Navira's Fracturing
  in its clear group and Kelari's Deception in its boss group.
- **The group must hold exactly one summon.** It is the summon itself, not the summon's "Command" active skill, which
  has no minion (spike A1). `compile_check` refuses a group with no summon or with two.
- **Resolved by name, at every compile.** After the stage's groups are built, the name is matched,
  case-insensitively, against that minion's live skill list. The record keeps the resolved index, the minion and the
  stat set for each group. A plan never stores an index, because supports append skills and a pin upgrade can reorder
  the list (spike A2).
- **Defects:**
  - an unknown name, listing the minion's skills;
  - a name the list holds twice, naming the positions;
  - a `minionStatSet` beyond the skill's stat sets. PoB's calculation crashes on one (spike A3).
- **The saved build carries PoB's own fields,** as PoB's dropdown sets them: the skill index, its Calcs-tab copy and
  the stat-set lookup.
- **`set_main_skill` gains `minion_skill` and `minion_stat_set`** for the main group, with the same refusals. A refusal
  changes nothing. The reply names the minion and the selected skill, and lists the minion's skills.
- **The displays.**
  - `get_skill_setup` and `analyze_skills` print each summon's minion and its skills in order, marking the selected
    one.
  - The stats breakdown heads a summon's block with its selected minion skill. It restores the selection and the
    stat-set lookup exactly afterwards (D-176).

## 4. D-378: the figure of a group whose minion deals the damage

- **A group's damage figure** is `MinionTotalDPS` when the group names a `minionSkill`, else `TotalDPS`. It sits at the
  same key, `g<group>s<skill>p<statSet>`.
- **Count.** PoB's Full DPS merges a minion with the group's count: its hit DPS is multiplied, its damage over time
  counted once (spike A1). So `COUNT_RULE` gains:
  - `MinionTotalDPS` and `MinionImpaleDPS`, multiplied by the count;
  - `MinionTotalDot` and the minion ailments, counted once.
- **The headline `measures.dps`** is the main group's figure × its Count.
  - The key-figure line names the source: `DPS <n> (Navira's Fracturing, minion)`.
  - The record's clear measure reads `MinionAreaOfEffectRadiusMetres` and `MinionSpeed` for a clear group that names
    a minion skill.
- **The rolled figure.** "Largest among the stage's groups with that role" compares each group's damage figure.
- **The checker and the renderer** read the same figure. That covers the renderer's copy of the headline rule for
  campaign stages. The verdict-line message reads "the main group's figure × its Count".
- **`rolled-stat-set` is unchanged.** `statSet` addresses the summon, which has one stat set at the pin (spike A3).

## 5. D-379: a command can be the build's skill

- **The gem lookup finds minion skills by name.** A result reads:
  - `## <name>`, then the fixed line `Kind: minion skill`;
  - one `Cast by: <minion> (summoned by <gem>)` line per summon whose minion casts it;
  - `Commanded: yes` when it is a command;
  - one `Granted by: <passive> (<ascendancy>, node <id>)` line per passive whose line reads `Grants Skill: <name>`;
  - its cooldown, its skill types and its stat sets.

  When names collide, gem results come first: 47 minion skills share a gem's name (spike A2).
- **The brief check** (`references/start.md`):
  - A skill passes with `Kind: active`.
  - It also passes with `Kind: minion skill`, when no active gem has the name and exactly one summon's minion casts
    it.
  - Otherwise the check fails, naming the summons.
- **`roll` keeps its three keys.** The summon is looked up whenever a step needs it.
- **D-217's rolled group** holds a gem named `roll.skill`, or names `roll.skill` as its `minionSkill`. `compile_check`
  confirms that the group's summon casts it.
- **D-334's route for a damage source that isn't a skill** no longer takes a minion skill. Today a command its passive
  grants meets that route, and the card can never be finalized. The route keeps items, passives and modifiers only.
- **D-342's ascendancy lock** runs on the minion skill and on its summon. For Navira's Fracturing that is node 10561
  for the command and node 32705 for the summon, both Disciple of Varashta.
- **An unparsed `Grants Skill: <minion skill>` line is not a modelling gap.** PoB computes the skill from the
  minion's list either way (spike A4). R1a, `references/lookups.md` and V4 say so.
- **R1b and D2.** The tree targets include the passives that grant the summon and the command, from the first stage
  that uses them.
- **R1b's bootstrap and D1-build.** The named source's group holds the summon; `main.activeSkill` is the summon,
  never its "Command" skill. The group names `minionSkill`, plus `minionStatSet` for a skill with several stat sets
  (Kelari's Deception has two).
- **W1's "How to play it"** says the player commands the minion, and the minion deals the damage.
- **The pattern library.** Actor rerouting's PoB line names `minionSkill` and the unchecked unlock. The library is at
  5,999 of its 6,000 words, so the edit adds no words.
- **`pob-gaps.md`, PG-40** becomes confirmed: the command comes from the djinn's skill list, and PoB never checks its
  passive.

## 6. D-380: V1 checks the passive that grants a skill

PoB doesn't check a skill's passive: with node 10561 unallocated, Navira's Fracturing still measured 1,027 DPS
(spike A4).

- **A new V1 finding, `not-granted`:** a group whose skill gem the tree grants, or whose `minionSkill` a passive
  grants, on a stage that allocates none of those passives.
- **Inputs:** `compile_stage`'s stage checks report, for each such group, the granting nodes and whether the stage
  allocates them.
- **Like every V1 finding, it never fails the compile (D-192).** The D1 and D2 gates route it as they route V1 now.

## 7. What changes

| Was | Becomes |
|---|---|
| A minion's numbers are dropped; the minion fields are always absent | `Minion<Field>` reads the minion's numbers everywhere (D-376) |
| A summon always computes its minion's first skill | a group names its `minionSkill` and `minionStatSet` (plan schema 4, D-377) |
| The headline is the player's `TotalDPS`: 0 for a summon | the main group's figure: `MinionTotalDPS` for a group that names a minion skill (D-378) |
| The brief's skill must be an active gem | or a command one summon's minion casts (D-379) |
| A passive-granted command is "a damage source that isn't a skill" | a skill: designed, compiled and measured (D-379) |
| Nothing checks a tree-granted skill's passive | V1's `not-granted` (D-380) |

## 8. Work units

| Unit | Slice | What | Depends on | Risk |
|---|---|---|---|---|
| WU-77 | 01 | The engine and tools: `Minion<Field>` (D-376); minion-skill selection in `set_main_skill`, the displays and the breakdown (D-377); the gem lookup's minion-skill result (D-379) | — | medium: Lua and many readers |
| WU-78 | 02 | The plan and the compiler: schema 4, `compile_check`, resolution at compile, the record's figure, Count, headline, clear measure and key-figure line (D-377, D-378); D-217's rule; V1's `not-granted` (D-380); `plan-reference.md` | WU-77 | medium |
| WU-79 | 03 | The skill text, the checker and the renderer: the brief check, R1a, R1a-assemble, R1b, R1b-assemble, D1-build, the D1 gate and `gates.md`, D2, W1, V4, `lookups.md`, the templates, the coordinator's definition, `patterns.md`, PG-40; fixtures and tests (D-378, D-379) | WU-78 | medium: many files |

They run in series: each builds on the last one's interface.

**Acceptance criteria:**

- **AC-K69 (WU-77, D-376).** Engine. On a build whose main skill is a summon, `lua_get_stats {category: "offense"}`
  shows `MinionTotalDPS` above 0, equal to PoB's `Minion.TotalDPS`.
- **AC-K70 (WU-77, D-377).** Engine, on `grenadator.xml`'s Pounce group (a Wolf Companion with Basic Attack and Leap
  Slam).
  - `set_main_skill {minion_skill: "Leap Slam"}` selects it. The reply names the minion and the skill, and
    `get_skill_setup` marks it selected.
  - These are refused and change nothing (the export and the revision are unchanged):
    - an unknown name;
    - a group with no minion;
    - an out-of-range `minion_stat_set`.
  - A breakdown restores the selection and the stat-set lookup.
- **AC-K71 (WU-77, D-379).** Engine.
  - `lookup_game_data {mode: "gem", query: "Navira's Fracturing"}` returns one result:
    - `Kind: minion skill`;
    - cast by Navira's minion, summoned by "Navira, the Last Mirage";
    - `Commanded: yes`;
    - granted by node 10561 (Disciple of Varashta).
  - "Gas Arrow" lists the gem first, then the minion skill.
  - A sweep finds every hit-making child that a gem result names, by that child's own name.
- **AC-P68 (WU-78, D-377, D-378).** Engine. Two fixture plans compile:
  - a summon group with `minionSkill: "Leap Slam"`;
  - a Disciple of Varashta plan whose main group is "Navira, the Last Mirage" with `minionSkill: "Navira's
    Fracturing"`.

  In each record, `measures.dps` equals the main entry's `MinionTotalDPS` × its Count, and is above 0. The saved build
  holds the selected skill index.
- **AC-P69 (WU-78, D-377, D-380).** Unit and engine.
  - `compile_check` refuses three cases:
    - an unknown minion skill, listing the minion's skills;
    - a group with no summon;
    - `minionSkill` on a group whose only active skill is "Command".
  - A version-3 plan with `minionSkill` is refused by the version rule.
  - D-217 accepts a rolled group whose `minionSkill` is `roll.skill`.
  - V1 reports `not-granted` for the Varashta plan with node 10561 removed, and nothing with it allocated.
- **AC-W65 (WU-79, D-379).** Static.
  - `start.md` accepts `Kind: minion skill` under the one-summon rule.
  - R1a-assemble and R1b keep minion skills out of D-334's route.
  - The lock covers the summon.
  - R1a, `lookups.md` and V4 carry the `Grants Skill:` exception.
  - D1-build sets `minionSkill`, `minionStatSet` and `main.activeSkill` on the summon.
  - `patterns.md` stays within 6,000 words.
- **AC-W66 (WU-79, D-378).** Checker unit, on a run fixture whose rolled group names a minion skill.
  - The checker's rolled-figure recompute and its verdict-line DPS check read `MinionTotalDPS` × Count.
  - The renderer's campaign headline reads it too.

## 9. Risks

- **PoB computes a command unconditionally.** Navira's Fracturing needs Chilled Ground under enemies, and PoB computes
  the hit regardless (spike A1). Archon of Undeath isn't modelled (PG-11), and Muster counts minion types by granted
  effect (PG-3). These are the guide's caveats, stated once (D-351), as any unmodelled condition is.
- **The summon's level.** PoB's own copy of a tree-granted summon is level 1 with no supports: Navira's Fracturing
  measures 9.6 DPS that way. A socketed level-20 group with four supports measures 1,027. Plans model a tree-granted
  skill as a socketed level-20 group, with supports by D-359's estimate. The Explosive Concoction comparison found that
  real builds, Navira's included, do the same. Nothing changes here.
- **Scope.** The new field and the minion numbers reach every summoner build, not only Varashta's. The spike's sweep
  over 28 summons, and the existing minion tests, keep that honest.
