# Slice 02: Plan and compiler (compile-time spike, guides root, plan schema, C1/E1 data, import code, compiler, V1/V2)

Part of the [build-guide spine](README.md). It covers work units WU-30 and WU-37…WU-42 (built; milestone
M-11), WU-61 (built), WU-51 (done) and WU-55 (built), all milestone M-14, and WU-65…WU-68 (target,
milestone M-15), and acceptance criteria AC-P1…AC-P67. When this slice and the spine disagree, the spine
wins. The adversarial review's fixes and the coordinator's resolutions are folded in under their spine IDs
(D-210…D-238).

**Fold v1.5 (2026-10-11).** Amendment 4 (accepted by the user 2026-10-11, with its answers) is folded in as
*target* text for milestone M-15: plan schema 3 with claim kinds and the anoint (D-351, D-358), the
record's `measures` and the reference hits from the data (D-353), the key-figure lines and `guide_run`'s
views (D-356), `support-sockets` (D-359) and `tree-shape` (D-360), with their units WU-65…WU-68 and
AC-P60…AC-P67. WU-66's path-tool half, with AC-K66, is in slice 01. Slice 3's WU-57 has merged, so its
markers here read "since WU-57".

**Fold v1.4 (2026-10-11).** WU-61 and WU-55 are built and WU-51 done, so their text is as-built (WU-55 merged at `3fc1500`). D-337 (Full DPS in
every compile, PROPOSED by the coordinator) amends §3.6, and D-332's and D-282's as-built additions are
folded in. WU-55's record fields, its new `compile_check` error and where PoB applies a group's Count were
folded from the work-log's "Review: WU-55", first as *target* text; WU-55 merged during the fold.

**Fold applied on 2026-10-10.** The build's later decisions are folded in: D-244, D-248, D-250…D-252, D-259,
D-265 (c), D-266, D-273, D-306, D-310 and D-313. So are the approved amendments' decisions: amendment 2's
D-281 and D-282, and amendment 3's D-286, D-293, D-294 and D-295. Text that describes a unit not built yet
(here WU-55, and slice 3's WU-57) carries a *Target (WU-nn, D-nnn)* marker and keeps the as-built behaviour
beside it until that unit merges. The rulings that settled the fold's gaps on 2026-10-10 are folded where
they apply, and listed in §8: the new milestone M-14 (D-315), the schema version (D-320), the record's Count fields (D-321),
the reason checks (D-322), the `buildSha1` projection (D-328), S-N2's plan (D-329), the unverified league
(D-330) and version-1 plans (D-332).

This slice turns a JSON build plan into one PoB2 file with a loadout per stage, plus a compile record (each
stage's numbers and check verdicts), a re-evaluated ledger and an import code. It also owns:
- the guides-folder root, and `guide_run`, which creates run folders and validates plans (C-50);
- the write ledger, which decides when a final compile may overwrite a builds-folder file (D-211);
- the C1 (campaign) and E1 (enemy) data files, and the config baseline list (D-230);
- the plan's offline-mode markers: the `external-unavailable` source tag, `unavailable` prices and a null
  `league` (D-233);
- Count and custom modifiers (WU-55, D-293, D-337; built). These are a skill group's `count`, the
  config's `customMods`, the record's Count-scaled figures and custom-modifier marks, and the named source's
  groups in Full DPS in every compile;
- the entering-maps rung `m` and one endgame tree track, `m` → `b` → `n` (WU-61, D-281, D-282; built);
- *target (M-15):* plan schema 3, the anoint, the record's `measures`, the key-figure lines, `guide_run`'s
  views, and V1's `tree-shape` and `support-sockets` (WU-65…WU-68; D-351, D-353, D-356, D-358…D-360).

## 1. Existing system context (this slice)

Evidence is in recon §1–§5 and the pin grounding (pin §B, §C). Repo at `e6ebec1`, pin v0.23.1.

- **Entry and deps.** `entryDefaults(env)` (`src/index.ts:20-33`) computes `pobDirectory` and `stateDir`
  (`$XDG_STATE_HOME/pob2-mcp`); `ServerDeps` is `src/server/createServer.ts:54-71`. Only the entry reads
  `process.env` (`tests/static/processGlobals.test.ts`).
- **Path confinement.** `sanitizeBuildName` and `canonicalBuildPath` (`src/utils/pathSanitizer.ts`) refuse
  NUL, absolute paths and `..`, but don't resolve symlinks. `isInside` and `realPathOf`
  (`src/services/buildExportService.ts:55-76`) do, for D-42's export rule. Neither knows a guides root.
- **Session and kinds.** `routeToolCall` (`src/server/toolRouter.ts:146-194`) runs every non-`none` tool in
  `session.run` under its static `TOOL_META` kind. A successful `load`/`mutate` call bumps `revision` and
  snapshots (C-3 step 6); a failed one changes neither. The ctx offers `newBuild` and `noteSaved`
  (`src/engine/session.ts:75-93`); `ctx.client` refuses raw `new_build`. A ctx load drops the previous
  build's snapshot (`session.ts:778`), so a crash after it takes the no-snapshot path: a later `read` or
  `mutate` call throws `RESTORE_FAILED` ("the loaded build could not be restored", `:230`, `:589`).
  `session.isDirty()` and `session.loaded` are public (`:95-106`). Only the session's restore and its
  temporary-build put-back pass `keepLevel` (`:558`, `:858`); a tool's load (`import_build`,
  `lua_load_build`) doesn't, so PoB re-estimates an auto-mode level on load.
- **Existing tool arguments the ACs use.** `import_build` takes `source` (a code or a link);
  `lua_get_stats` takes only `category` (C-45 adds `breakdown`). Tests count engine requests with a
  pass-through `jest.spyOn(PoBLuaApiClient.prototype, 'request')`, as `findUpgrades.test.ts` does.
- **Test gate.** `mise.toml`'s `test` task runs `pnpm build` then `pnpm test` (`jest` with
  `jest.config.cjs`: parallel workers, `testTimeout` 60 s), as a list of pipe-free steps (C-19).
- **Writer.** `BuildFileWriter.checkBuildFile` runs C-17 steps 1–3 without writing
  (`src/services/buildFileWriter.ts:197`); `writeBuildFile({kind:'engine', ctx, guard})` writes and calls
  `noteSaved`.
- **Build code.** `src/utils/buildCode.ts:71-105` decodes only; encoders exist only in tests
  (`tests/integration/toolHygiene.test.ts:95`, `engineKinds.test.ts:49`). PoB's own export is base64 of the
  zlib-deflated `SaveDB` output with `+`→`-` and `/`→`_`, padding kept (pin `Classes/ImportTab.lua:133`).
- **Lua building blocks** (`pob-api/API/BuildOps.lua`): `new_build`, `create_spec`, `add_item_text`,
  `create_socket_group` (`:1291-1300`: `label`, `slot`, `enabled`, `includeInFullDPS`. Since WU-55
  (D-293) it also takes `groupCount`, the group's Count; `add_gem`'s `count`, `:1465`, is a gem's own),
  `add_gem` and `resolve_gem` (unknown gems rejected with suggestions),
  `set_flask_active`, `export_build_xml`; `set_config` with its key and value checks `config_options()` and
  `config_value()` (`:323-475`); `set_level`, which forces manual mode (`:175-190`); `get_warnings`, PoB's
  warning lines after `RefreshStatList` with the level put back (`:241-256`). Slice 1 (M-10) adds the set
  operations and the `set_level` auto flag (WU-35), tree state and jewel sockets (WU-36), and stat-set
  selection with the per-skill breakdown (WU-33).
- **PoB facts the compiler relies on.**
  - S-a's recipe (pin §C); `SyncLoadouts`' brace pattern `%{([%w,]+)%}`; `CopyLoadout` crashes on `{id}`
    names (pin §B1).
  - Config sets save only non-default inputs (`Classes/ConfigTab.lua:739`); a new set's `input` is filled
    from each option's `defaultState` or `list[defaultIndex].val`, and its `placeholder` from
    `defaultPlaceholderState` (`ConfigTab.lua:974-990`). `ConfigTab` gets that option list from
    `LoadModule("Modules/ConfigOptions")` (`:13`); `CreateConfigSet` adds a set to the build.
  - **Placeholders are applied as values** (D-212). `BuildModList` applies a `count`, `integer`,
    `countAllowZero` or `float` option's placeholder when it has no input (nil, or 0 for `count`)
    (`ConfigTab.lua:883-900`); `UpdateLevel` uses `placeholder.enemyLevel` the same way (`:870-880`).
    `enemyIsBoss`'s `apply` sets the placeholders of the enemy's level, damage per type, resistances,
    penetration, armour, evasion, speed and crit (`Modules/ConfigOptions.lua:1964-1997`), so they are
    known only after a calculation. Save skips an `<Input>` equal to `GetDefaultState`, which returns the
    *active* config set's placeholder when it has one, not the saved set's (`ConfigTab.lua:712-715,
    :741-742`). So a non-active stage can lose an explicit option in the file, which the compiler puts back
    (D-248, §3.6 step 9).
  - **A new build has default sets.** Tree spec 1 and item, skill and config set 1 exist from the start,
    titled `Default` when untitled (e.g. `ItemsTab.lua:1071`, `ConfigTab.lua:690`), so a compile that
    creates every stage's sets anew leaves an extra `Default` loadout (D-215).
  - **Weapon-set connectivity.** `CanPathThroughAllocMode` (`Classes/PassiveSpec.lua:826-830`): an
    untagged node paths only through untagged nodes; a node tagged weapon set n also through nodes tagged
    n. Nodes PoB can't connect are pruned without an error (D-213).
  - Quest-reward options are named `"quest"..Description..Area..Info`, and the checkbox ones default to on
    (`Modules/ConfigOptions.lua:73-82`); books have `useConfig = false`, so no option.
  - `ImportFromNodeList` silently skips unknown node ids (`Classes/PassiveSpec.lua:351-362`).
    `CountAllocNodes` is `PassiveSpec.lua:992-1017`; PoB's regular-point count is `PointsUsed − min(ws1,
    ws2)` (`Modules/Build.lua:1029`). Attribute nodes carry `isAttribute` (`Classes/PassiveTree.lua:548`).
  - PoB's warning lines are `Build.lua:1030-1055` and `:2148-2222`; only "You have N Weapon set 2 passives
    available" (`:1051-1055`) is informational.
  - **Count and Full DPS** (D-293). Each socket group has an "Include in Full DPS" flag and a "Count:" box
    (`Classes/SkillsTab.lua:218-223`), saved as `includeInFullDPS` and `groupCount` (`:307`, `:470`).
    PoB reads `groupCount` in three places only (WU-55's review):
    - Full DPS (`Modules/Calcs.lua:342-411`): hits by the count, damage over time only when it can stack
      (`dotScale`), the ailments once. So PoB's raw `FullDPS` and `FullDotDPS` already include Count. The
      main skill's own DPS (`TotalDPS`) ignores it;
    - reservation, for skills reserved per copy and for totems with Ancestral Bond
      (`Modules/CalcDefence.lua:283-288`);
    - Umbral Well buffs (`Modules/CalcPerform.lua:1318`).
    - Count adds no calculation: PoB runs one `calcs.perform` per Full DPS skill and multiplies when it
      merges the results (S-N2's note, `Calcs.lua:322`, `:344`).
    - As built, the compiler creates every group with Full DPS off and sets no `groupCount` (D-306,
      `pob-api/API/Compile.lua:632`). The named source's groups go in Full DPS with
      their Count in every compile (WU-55, D-337; built).
  - **Custom modifiers.** `customMods` is a `text` config option (`Modules/ConfigOptions.lua:2279`). Each line
    PoB parses whole is added as a `Custom` modifier; a line it can't parse whole is skipped.
  - **For amendment 4** (the issues report, `../studies/2026-10-11-run-a-issues.md`; *target*, M-15):
    - **Anoints.** An anoint is the amulet line `Allocates <notable>`, which PoB grants with no path or point
      (`CalcSetup.lua:17-21, 1405-1414`); 875 notables have a three-emotion recipe. It compiles today, but no
      step, template or tool has a place for it (I-1).
    - **Support sockets.** PoB2 has no support-socket rule for granted skills (`CalcSetup.lua:247-256,
      1531-1541`), our data has no thresholds, and nothing checks support counts (I-2).
    - **Tree roots.** `check_tree` (`pob-api/API/Compile.lua:182-285`) tests only reachability. PoB2 keeps a
      separate Sorceress tree: Path of the Sorceress (node 12795) links the Sorceress exits 4739 and 44871.
      v0.23.1 enforces one exit per start neither in its UI code nor on import (a headless probe confirms
      import); the user reports that its UI blocks it, and a newer release may differ. Run A had two Ranger
      trees from stage 2 and four trees from stage 6 (I-3).
- **Data and dependencies.** `data/` doesn't exist. zod 3 is a runtime dependency; `zod-to-json-schema`
  is dev-only.
- **Tests.** `engineDescribe`, `startSessionFixture` (a private builds folder; it gains a guides folder
  here), `startTestServer`, `spawnServerEnv`, `canonicalize`, `__test_eval`, `cruftScan.ts` and the static
  scans (recon §2, §5).

## 2. Functional requirements

- **FR-P1.** A plan is one JSON file, validated in full before any engine work; every error names its JSON
  path (D-163, D-167).
- **FR-P2.** One `compile_plan` call compiles a valid plan into one PoB2 build with a loadout per stage,
  measures each stage at its own level, and saves the file in auto-level mode at the highest stage level
  (D-138, D-149, D-156).
- **FR-P3.** Compiling is all-or-nothing: a compile error in any stage writes nothing (D-162). A crash fails
  the call and the session recovers; after the compile's `new_build` there is no snapshot to restore, so
  recovery takes C-3's no-snapshot path. The same plan compiles to the same result (D-165).
- **FR-P4.** The server writes only the run folders it creates under the guides root, files beside the
  compiled plan, the target PoB file, and that file's write-ledger entry in the state dir. The PoB file
  goes through `buildFileWriter`, only in a run's final compile, and over an existing file only under the
  write ledger's rule (D-155, D-177, D-207, D-208, D-211). A guides root that overlaps the builds folder
  is refused (D-220).
- **FR-P5.** Every check limit that depends on level or campaign progress comes from cited data files, not
  from PoB's defaults or code constants (D-108, D-168).
- **FR-P6.** No config value is left to PoB's defaults or placeholders unexamined. Every option a stage
  lists is written; every option that is on by default, or driven by a placeholder, and that neither the
  stage nor `data/config-baseline.json` lists is a finding (D-114, C-32, D-212, D-230).
- **FR-P7.** The ledger is re-evaluated from the record's numbers on every compile, without `eval` (D-170).
- **FR-P8.** The import code round-trips (D-145, D-180).
- **FR-P9.** Creating a run folder never touches the engine, and validating a plan never changes the
  engine's build (`guide_run`, D-216).
- *Target (M-15):*
  - **FR-P10.** The compiler computes each endgame stage's measures (DPS, EHP, the Arbiter verdict, clear
    speed) and fills its reference hits from the data, so no agent computes or checks them (D-353).
  - **FR-P11.** A stage's tree is valid in shape, not only reachable: one start exit per tree and at most one
    tree per start (D-360).
  - **FR-P12.** Agents read a stage's key figures, and the plan's claims, without paging `plan.json` or
    Grepping the record: a key-figure line per stage in `compile_plan`'s reply, and `guide_run`'s views
    (D-356).

## 3. Contracts in detail

### 3.1 C-34: guides root and run folders (WU-37; `guide_run` and the root check are wired by WU-41)

- **Root.** `entryDefaults` also returns `guidesDirectory`: `POB_GUIDES_DIRECTORY` when non-empty, else
  `path.resolve(pobDirectory, '..', 'Guides')` (D-154). `ServerDeps` gains `guidesDirectory: string`
  (C-7). Nothing is created at construction; only `guide_run`'s run-folder mode creates the root
  (`mkdir -p`).
- **`src/utils/guidesPath.ts`** (new) holds pure functions that take the root as an argument; `src/index.ts`
  imports the default computation from it.
  - `resolveInGuidesRoot(root, rel)` refuses an empty path, a NUL byte, an absolute path, or a `..` segment
    (either separator). It resolves symlinks on the deepest existing ancestor (as
    `buildExportService.ts:55-76` does; those helpers may move to a shared util), and refuses a real path
    outside the root's real path. Each error names the argument and the root.
  - `createRunFolder(root, slug, date)`. `slug` must match `^[a-z0-9]+(-[a-z0-9]+)*$` and be at most 64
    characters (A-P7). `<root>/<slug>` is created if missing and must resolve inside the root. `<n>` is 1
    plus the largest `n` among existing `<date>-<n>` entries, or 1. The folder is made with a
    non-recursive `mkdir`; on `EEXIST` it tries the next `n`. It returns `{absPath, relPath}`, with
    `relPath` = `<slug>/<YYYY-MM-DD>-<n>`. `date` is the server's local date.
  - `checkGuidesRoot(root, buildsDir)` (D-220; added by WU-41). Resolves both real paths (symlinks on the
    deepest existing ancestor, the rest appended) and refuses when they are equal or either is inside the
    other. The error names both paths and their variables (`POB_GUIDES_DIRECTORY`, `POB_DIRECTORY`).
  - `runFolderOf(relPlanPath)` (added by WU-41): the first two segments of a root-relative plan path,
    which name its run folder `<slug>/<YYYY-MM-DD>-<n>` (the write ledger's key, D-211).
- **Writes beside the plan** (the record; the measure-only XML) go to the resolved plan's real directory,
  which is checked again just before writing, as a temp file then a rename (as C-17 step 5).
- **Jest (C-18).** `tests/setup/global.ts` creates a fresh `pob2-mcp-test-guides-*` temp dir and sets
  `POB_GUIDES_DIRECTORY`. `spawnServerEnv` passes it explicitly, and `startTestServer` gets it through
  `entryDefaults`. `startSessionFixture` gives each fixture its own `<tmp>/guides`, in deps and env.
- **README.** The env table gains a `POB_GUIDES_DIRECTORY` row. Its default is `Guides` beside the builds
  folder, outside the folder PoB2 browses; it holds guide runs.

### 3.2 C-30, C-31, C-32: the plan schema (WU-38)

`src/plan/schema.ts` exports the zod schema `planSchema` and
`validatePlan(json, refData?) → {ok:true, plan} | {ok:false, errors:{path, message}[]}`.
- **Paths.** zod's issue path, rendered with `.` between keys and `[n]` for indices
  (`stages[1].config.scenario[0].source`). The root, and a JSON parse error, are `$`.
- **Version** (D-320, D-332; built by WU-61). `schemaVersion` must be `1` or `2`, `PLAN_SCHEMA_VERSIONS`
  (`src/plan/schema.ts`); version 2 is the current one. Any other value gives exactly one error, naming the
  accepted versions (`[1, 2]`).
  - One bump, to `2`, covers the `entering-maps` variant, `count`, `countReason` and `customMods`. WU-61
    merged first and made it with `entering-maps`; WU-55 added its three fields to the same
    version's `VERSION_ADDITIONS`. Each unit updates `plan-reference.md` and its worked example; the
    two-stage fixture and the worked example declare version 2.
  - **Version-1 plans** stay accepted with version 1's shape: they take the defaults of what version 2
    added (no `entering-maps` variant; from WU-55, `count` 1 and no `customMods`), and a version-1 plan
    that uses a version-2 field is an error at that field's path, naming the version that added it
    (`stages[2].variant: the entering-maps variant (D-281) needs schemaVersion 2 or later; …`). So
    recorded runs' plans still validate and compile; the fifteen-stage and off-hand fixtures stay at
    version 1 and validate.
  - *Target (WU-65; D-351, D-358):* **version 3** adds `claims[].kind` (`hinge` or `reason`) and
    `items.anoint {notable, reason}`, allowed on `b` and `n` only, refused on `m` or a campaign stage;
    version 2 stays accepted (AC-P60). `PLAN_SCHEMA_VERSIONS` and `VERSION_ADDITIONS` gain it, and
    `plan-reference.md` and its worked example follow.
- **Strictness.** Objects are strict: an unknown key is an error.
- **Cross-reference rules** are marked † below. They run as refinements, each with its own path.

```ts
type SourceTag = {                                   // C-30
  kind: 'pob-computed' | 'pob-data' | 'external' | 'judgment' | 'external-unavailable';
  ref: string;              // non-empty. pob-computed: a multi-segment REF (§3.3). external: an http(s) URL.
                            // external-unavailable: exactly "external source unavailable (offline run)"
  accessed?: string;        // YYYY-MM-DD; required for external
  patch?: string;           // e.g. "0.5.5"
  confidence?: 'H' | 'M' | 'L';   // required for external, judgment and external-unavailable
};
type Claim = { id: string; text: string;
                kind?: 'hinge' | 'reason';  // target (WU-65, D-351): schema 3; a hinge fact or a measured reason
                source: SourceTag | `ledger:${string}` | `price:${string}` | `data:${string}#${string}` };
                // † a ledger or price id exists (D-237); data:<file>#<key> names a file under data/ and a
                // fact id, which † resolve once WU-39 lands (D-232)
type Plan = {
  schemaVersion: 1 | 2;                   // D-320, D-332: version 2 since WU-61; target (WU-65, D-351): 1 | 2 | 3
  roll: { className: string; ascendancy: string; skill: string };
                                          // the run's roll; since WU-57 (D-286) a card's identity. A
                                          // skeleton's roll is its card's; the run's plan takes the identity
                                          // picked at the verification gate. skill is the build's named
                                          // damage source (D-295)
  versions: { pobTag: string; pobCommit: string; treeVersion: string;
              enginePatch: string;        // the game patch the engine data targets
              externalPatch: string };    // the patch of the prices and boss data (D-107)
  league: string | null;                  // † null only when every price is unavailable with note
                                          // "offline run" (D-233)
  stages: Stage[];                        // ≥ 1; plan order is progression order
  ledger: LedgerEntry[];
  prices: Price[];
};
type Stage = {
  id: string;                             // ^[A-Za-z0-9]+$, unique † (A-P1)
  loadoutName: string;                    // contains "(L<level>)", ends with " {<id>}", no other braces (A-P1)
  level: number;                          // integer 1–100
  progress: string;                       // ^(start|endgame|q\.[a-z0-9]+(-[a-z0-9]+)*)$ (D-214, A-P13);
                                          // a C1 progress key † (checked once WU-39 lands)
  variant?: 'entering-maps' | 'budget' | 'non-budget';   // the rungs m, b, n (D-281); entering-maps needs
                                          // schemaVersion 2 (D-332)
  ascendancyPoints?: number;              // integer 0–8
  variantBasis?: { level: SourceTag; gemLevels: SourceTag; ascendancyPoints: SourceTag };
                                          // variant, ascendancyPoints, variantBasis: all or none † (D-193)
  chaosResistException?: { reason: string; tag: SourceTag };   // reason non-empty; variant stages only † (D-234)
  tree: {
    nodes: number[];                      // allocated non-ascendancy nodes, complete and connected
    ascendancyNodes: number[];
    weaponSetNodes: { set1: number[]; set2: number[] };          // ⊆ nodes, disjoint †
    attributeChoices: { node: number; attribute: 'strength' | 'dexterity' | 'intelligence' }[];  // node ∈ nodes †
  };
  respec?: { dropped: number[]; goldCost: { value: number; source: SourceTag }; note: string };   // D-144
  items: {
    setTitle?: string;                    // no braces
    slots: { slot: ItemSlot; text: string }[];     // ItemSlot = ITEM_SLOTS (toolSchemas.ts:22-26); unique †
    treeJewels: { node: number; text: string }[];  // node ∈ tree.nodes †
    toggles: { slot: ActivatableSlot; active: boolean; uptime?: string }[];  // uptime required when active
    useSecondWeaponSet: boolean;
    anoint?: { notable: string; reason: string };  // target (WU-65, D-358): schema 3; b and n only †
  };
  skills: {
    setTitle?: string;
    groups: { label?: string; enabled: boolean;
              role: 'clear' | 'single_target' | 'utility' | 'leveling';                          // D-217
              gems: { name: string; level: number; quality: number; enabled: boolean }[];        // ≥ 1 gem each
              count?: number;             // WU-55, D-293: integer ≥ 1, default 1
              countReason?: string }[];   // WU-55, D-293: why count is above 1; missing there, a V1
                                          // finding (§3.7), not a schema error (D-322)
    main: { group: number; activeSkill: number; statSet?: number };  // 1-based; group equal in every stage †
                                          // D1 sets statSet on each variant stage. On every stage with a
                                          // rolledGroup, main.group equals rolledGroup (D-273). The D1 gate
                                          // and the run checker enforce both, not the schema
    rolledGroup?: number;                 // 1-based group holding a gem named roll.skill †; required on
                                          // variant stages † (D-217). Since WU-57 (D-295): the group holding
                                          // the build's named damage source; the field keeps its name
  };
  config: {
    setTitle?: string;
    earned: { option: string; value: boolean | number | string;
              producer?: { kind: 'item' | 'gem' | 'passive' | 'skill' | 'flask' | 'charm'; name: string };
              uptime?: string }[];        // producer and uptime required when the value is on (A-P5)
    scenario: { option: string; value: boolean | number | string;
                source: { file: string; key: string };   // a C1/E1 file and fact key (§3.4)
                tag: SourceTag }[];       // the fact's tag, copied with its value (D-168)
    customMods?: { text: string; reason?: string }[];
                                          // WU-55, D-293: a third kind beside earned and scenario,
                                          // with no producer and no source key. Each entry is one
                                          // hand-calculated effect as a PoB modifier line, with its reason;
                                          // an entry without a reason is a V1 finding (D-322)
  };                                      // an option appears once across both lists †; scenario holds enemyIsBoss † (A-P4)
  claims: Claim[];
};
type LedgerEntry = { id: string;          // ^[A-Za-z_][A-Za-z0-9_]*$, unique †
                     claim: string; formula: string;      // † parses; its REFs name an input or an existing stage
                     inputs: { name: string /* same pattern as id */; value: number; tag: SourceTag }[] };
type Price = { id: string;              // ^[A-Za-z0-9_-]+$, unique †; what a price: claim cites (D-237)
               item: string; query: unknown; amount: number | null; currency: string | null;
               date: string /* YYYY-MM-DD */; league: string | null; status: 'ok' | 'unavailable'; note?: string };
               // † ok ⇒ amount and currency set; unavailable ⇒ both null (D-164)
               // † league equals the plan's league, so it is null exactly when that is (D-233)
```

- **"On"** (A-P5): `true`, a non-zero number, or a list value other than the option's first list entry.
- **Toggles** live in `items`, because PoB keeps them on the item set. C-32 makes them earned state, so an
  active toggle carries `uptime`; its producer is the item in that slot.
- **Offline markers.** The schema accepts `external-unavailable` tags and `unavailable` prices in any plan;
  V4 decides by the run's mode (C-30, D-201). A null `league` is accepted only when every price is
  `unavailable` with `note: "offline run"` (D-233). A claim copied from C1/E1 cites `data:<file>#<key>`,
  `<file>` relative to `data/` (`data:campaign/limits.json#passive-points.max`), which offline V4 checks
  against the fact and its stored citation (D-232).
- **Unverified league** (D-313). When no league could be verified online, D1 writes `"league":
  "unverified"`, with every price `unavailable` (note `trade unreachable`). To the schema it is an ordinary
  league string, so each price's `league` is `"unverified"` too. It is the convention for an online run that
  can't reach the trade site; an offline run's league stays null (D-233, D-330).
- **Reward picks** (D-265 c). A campaign reward choice is a scenario entry: its option is the quest's
  `pob-config-key`, its value the picked option, and its `source` is `{file: "campaign/progress.json", key:
  "q.<key>.options[<i>]"}`. D2 lists the same pick on every stage at or after the quest, the endgame stages
  included.
- **Endgame variants.** Every gem has a `level`. A variant stage's `variantBasis` cites the source of its
  level, gem levels and ascendancy points (D-193), and its `rolledGroup` names the group holding the
  rolled skill (D-217).
  - Since WU-61 (D-281), the entering-maps rung `m` is a third variant stage, between the last campaign
    stage and `b`. These rules, D-234's chaos exception and the variant-only checks apply to it as to `b`
    and `n` (AC-P58).
- **Chaos exception** (D-234). A variant stage may carry `chaosResistException` when capping chaos
  resistance is infeasible; the survival floor (slice 3) then accepts `MissingChaosResist` above 0 with a
  finding. The schema checks only its shape and that the stage is a variant.
- **Skill roles** (D-217). Every group has a `role`; the rolled-skill gate (slice 3) compares the rolled
  skill against the stage's other skills of its group's role. Since WU-57 (D-295, D-293, D-340), it
  compares the build's named damage source, by its figure × its group's `count`.
- *Target (WU-65, D-358):* **the anoint.** `items.anoint` names one notable and why; the compiler writes it
  (§3.6). It is refused on `m` and on campaign stages (Q5: `m` instead points a player who can afford one
  ahead, in the guide).

**Committed reference.** `docs/build-guide/plan-reference.md` (new) has one table row per schema field
path (form `stages[].tree.nodes`), giving its type, whether it's required, its rule and the decision it
traces to. It also gives the error-path convention, and a worked example: a fenced `json` block equal to
`tests/fixtures/plans/two-stage/plan.json`.

### 3.3 C-33: ledger grammar and evaluator (WU-38)

`src/plan/ledger.ts` is a hand-written tokenizer and recursive-descent parser: no `eval`, no `Function`,
no dependency (D-170).

```
expr    := term (('+' | '-' | '−') term)*
term    := unary (('*' | '/' | '×' | '÷') unary)*
unary   := ('-' | '−' | '+') unary | primary
primary := NUMBER | REF | '(' expr ')'
WORD    := a maximal run of [A-Za-z0-9_.]; whitespace separates tokens and is otherwise ignored
NUMBER  := a WORD matching ^\d+(\.\d+)?([eE]\d+)?$
REF     := a WORD matching ^[A-Za-z0-9_]+(\.[A-Za-z_][A-Za-z0-9_]*)+$ or ^[A-Za-z_][A-Za-z0-9_]*$
```
- **References.** A one-segment REF names one of the entry's inputs. `<stageId>.<Field>` names a main
  output. `<stageId>.g<group>s<skill>p<statSet>.<Field>` names a C-45 breakdown field (keys as in §3.6).
- **Errors** are `{entry, code, message}`, with a 0-based column where one exists.
  - `syntax` (unexpected token, missing `)`, empty formula), `unknown-input` and `unknown-stage` fail
    validation (D-163).
  - `unknown-output`, `stage-not-compiled` (outside a `stages` subset), `division-by-zero` and
    `non-finite` set the entry's value to `null`, with the error in the record. The compile still
    succeeds.
- **Values** are IEEE doubles, unrounded.

### 3.4 C-35: C1 and E1 data files (WU-39)

`src/plan/referenceData.ts` loads every `*.json` under `<packageRoot()>/data/campaign` and `data/enemies`
(the directory is injectable for tests), through one zod schema:

```ts
type DataFile = { schemaVersion: 1; sources: (SourceTag & { id: string })[];
                  facts: Record<string, Fact> };     // fact ids match ^[a-z0-9]+([.-][a-z0-9]+)*$
type Fact = { value: number | string | boolean | { min: number; max: number }
                     | Record<string, number | string> | string[];
              source: string /* a sources[].id */; patch: string; confidence: 'H' | 'M' | 'L'; note?: string };
```
- **Errors** name the file and the fact id (or `sources[n]`). An unknown source id is an error.
- **Keys.** A scenario `source.key` is a fact id, optionally followed by `[<member>]` to pick one member of
  an object or array value (`life.by-level[79]`).
- **Origin.** Values come only from the pin and the external-data grounding doc (D-204). `patch` is
  `0.5.4` for pin data and the grounding row's patch otherwise. Confidence is graded as the grounding
  grades it; M and L values are kept as recorded (A-29).

| File | Fact ids | From |
|---|---|---|
| `campaign/progress.json` | `order`: the progress keys (A-P10), i.e. `start`, one key per reward-quest row of `Data/QuestRewards.lua` in file order, then `endgame`. Per quest key `q.<key>` (D-214; `<key>` derived from the row as A-P13 says): `.region` (`act1`…`act4`, `interlude`), `.area-level`, `.reward` (text), `.passive-points` and `.weapon-set-points` (2 each for the 12 books), `.pob-config-key` (rewards with `useConfig`), and `.spirit`, `.resistance`, `.life`, `.mana` where granted | pin §B7; ext §2 (S10, S11, S12) |
| `campaign/areas.json` | area-level ranges for `act1`…`act4`; `interlude.base-levels`; `interlude.dynamic-increase` (+8, M) | ext §2 (S9, S47, S48) |
| `campaign/ascendancy.json` | `trial.1`…`trial.4`: `.points` (2), `.available-from` (a progress key), `.requirement` (text). The third and fourth trials' 65+/75+ dispute is recorded as M | ext §2 (S15, S16) |
| `campaign/gems.json` | `uncut-skill.<1..20>.available-from`; `uncut-support.<1..5>.available-from`; `tier-rule` (an uncut gem of level N engraves a skill of tier ≤ N at gem level N, H); `skill-tiers`, `spirit-tiers`, `support-tiers`. *Target (WU-67, D-359):* the estimated support-socket table for tree-granted skills, a `judgment` fact at confidence L: 3 below level 40 (Act 2, levels 16–31, into Act 3), 4 from level 40 (Act 3's second half to 45, Act 4 and the interludes), 5 from level 60 (the campaign's end; the interludes start at 54–56 and rise about 8), with area levels from `campaign/areas.json` | ext §2 (S17, S18, S19, S37); the table: the user's estimate (amendment 4 Q1) |
| `campaign/limits.json` | `passive-points.from-levels` (99), `.max` (123), `.martyr` (1, M); `ascendancy.max` (8). `resistance-penalty.<region>`: act1 0, act2 −10, act3 −20, act4 −30, endgame −60; interludes −40 at area level 54–59 and −50 at 60–64 | ext §2 (S14, S43, S13); pin `ConfigOptions.lua:113` |
| `enemies/arbiter-of-divinity.json` | `area-level` (79); `base.*` at level 79 (life, energy shield, armour, evasion, accuracy, crit chance and bonus); `res.fire`, `.cold`, `.lightning`, `.chaos` (0.5.5 values); `hits.<skill>` as `{min,max}`, each with `.type`; `fight-life.datamined-base`, `.extrapolated` (about 8M, with its method), `.community-report` (about twice the quest version), all L (A-30); `pob-enemy-is-boss` ("Pinnacle"; judgment, M: a pinnacle boss per ext §4, while PoB's Pinnacle uses PoE1-derived means, pin §B5) | ext §4 (S2, S26, S28, S34) |
| `enemies/map-monsters.json` | `life.by-level` and `damage.by-level` (levels 1–100, copied from `Data/Misc.lua:7` and `:9`, `pob-data`); `pob-enemy-is-boss` ("None") | pin §B6; ext §3 |
| `enemies/waystones.json` | `area-level.offset` (64: T15 = 79, T16 = 80); `area-level.max` (82, M); `mods.<name>` ranges (M; poe2db's current values) | ext §3 (S21, S22, S50) |

No rarity life multiplier is recorded (A-27).

**Divergence (D-168, D-203).** D-3 and D-30 forbid constants of our own in the advice tools. These files
hold our own constants, but they are cited game facts tied to a patch, not invented advice thresholds.
They live in `data/` and are read by `src/plan/`, outside the advice tools and the advice-threshold scan.
No C1/E1 string appears as a literal in `src/`.

WU-39 also extends `validatePlan` to check each `progress` key against `order` (path
`stages[n].progress`), and each `data:<file>#<key>` claim against the loaded files and fact ids (path
`stages[n].claims[m].source`, D-232). That import links `referenceData.ts` into `src/`, which the
dead-module scan needs. **Progress keys** (D-214): WU-38's schema fixes their form; WU-39 makes the data,
and owns the two-stage fixture's `progress` values and the reference's worked example, which it sets to
real keys.

### 3.5 C-42: the import-code encoder (WU-40)

- **`encodePobCode(xml: string): string`** in `src/utils/buildCode.ts`: `zlib.deflateSync` of the UTF-8
  bytes, base64, then `+`→`-` and `/`→`_`, keeping the padding. This is PoB's own form
  (`ImportTab.lua:133`). `decodePobCode(encodePobCode(x)) === x` for any PoE2 XML.
- **`encode_build_code {build_name}`** is kind `none`, group `core`, in
  `src/handlers/buildCodeHandlers.ts`. It resolves `build_name` in the builds folder with
  `canonicalBuildPath`, reads the bytes and requires a `<PathOfBuilding2>` root (`assertPoe2BuildXml`). It
  returns the canonical path, the byte count and the code on one line, and never starts the engine.
- **Tests.** The test-only encoders switch to `encodePobCode`.

### 3.6 C-41: `compile_plan` (WU-41; checks by WU-42)

**Modes.** Only these argument combinations are allowed. Any other is `isError` naming the conflict, and
nothing is done. Creating a run folder and validating a plan are `guide_run`'s modes (§3.8, D-216);
`compile_plan`'s schema has no `new_run` or `validate_only` argument.

| Mode | Arguments | Writes |
|---|---|---|
| measure-only (D-208) | `plan_path`, `measure_only: true`, optional `stages`; no `build_name` | `compile-record.json` and `compiled-build.xml` beside the plan (A-P6); never the write ledger |
| final | `plan_path`, `build_name`; no `stages` | the PoB file through C-17, then its write-ledger entry (D-211), then the record beside the plan |

**Steps.** The whole call is one `session.run` of kind `load`, under one lock (D-156, D-191).
1. **Roots** (D-220). `checkGuidesRoot(guidesDirectory, pobDirectory)` (§3.1). An overlap → `isError`
   naming both paths, and nothing is done.
2. **Validate.** Resolve `plan_path` (§3.1), read it, parse it and run `validatePlan` with the reference
   data. Errors → `isError` with one `path: message` line each, and no engine request (D-163). Each id in
   `stages` must exist; the compiled list is that subset in plan order.
3. **Final mode checks the target** (D-199, D-211) with `checkBuildFile` on `build_name`. A target that
   doesn't exist is written as a new file. An existing target may be overwritten only when the write
   ledger has an entry for its canonical path whose `runFolder` is `runFolderOf(plan_path)` and whose
   `sha1` equals the file's current sha1; the write then uses `overwrite: true`, and C-17's guard still
   applies. Otherwise the call is `isError` and nothing is done: with C-17 step 2's "already exists" text
   when the ledger has no entry for the path or the entry names another run folder, and with C-17's
   changed-on-disk text when this run's entry has another sha1. The record beside the plan plays no part.
4. **Group the sets** (A-P2). Every stage gets its own tree spec, titled `loadoutName`. Stages whose
   `items` (likewise `skills`, `config`) are deep-equal share one set, titled `<base> {<ids>}`: the ids in
   plan order joined by `,`. The base is the content's `setTitle`, else the first member's `loadoutName`
   without its ` {<id>}`. The first stage's tree spec and its item, skill and config sets are the new
   build's spec 1 and set 1 of each type, retitled; every other spec and set is new (D-215).
5. **Check every stage, read-only** (A-P12). One `compile_check {stages, treeVersion, producers}` request
   mutates nothing and reports every defect of every stage: an unknown gem (with `resolve_gem`'s
   suggestions); item text with no base type; a node id not in the tree; a node or ascendancy node not
   connected to its start through listed nodes it may path through under PoB's rule, so an untagged node
   only through untagged nodes and a node tagged weapon set n also through nodes tagged n
   (`CanPathThroughAllocMode`, D-213); a weapon-set tag on an unlisted node or in both sets; an attribute
   choice on a node without `isAttribute`; a tree-jewel node that isn't a jewel socket; an unknown config
   option or a bad value (`config_value`); a main-skill index outside the stage's groups or active skills.
   Also (WU-55, D-293; built) a custom-modifier line (`config.customMods[<i>]`) that PoB can't parse
   whole, since PoB's `customMods` option would skip it without a word: the line, stripped as PoB strips
   it, must give a mod list with no remainder from `modLib.parseMod`.
   *Target (WU-65, D-358):* an `items.anoint` whose notable has no three-emotion recipe, is already
   allocated, or sits on a stage with no amulet, each naming the stage.
   *Target (WU-66, D-360):* `check_tree` (`Compile.lua:182-285`), which tests only reachability today, also
   computes each stage's trees for V1's `tree-shape` (§3.7): a tree shape is a V1 finding, not a defect.
   It also returns (both added by WU-42):
   - **`producers`** (D-221): for each `{kind, name}` producer the plan's earned entries name, whether it
     exists in the game data (by kind: an item base or unique, a gem, a passive or ascendancy node, an
     active skill, a flask or charm base). An unknown producer isn't a defect; V2 reports it;
   - **the config baseline:** per option, its type, whether it has an `apply`, its default value
     (`defaultState`, or `list[defaultIndex].val`), its `defaultPlaceholderState`, its first list entry,
     and whether PoB shows it only for some builds (`conditional`: a show gate such as `ifSkill`, D-250).
     It comes from the defaults loop over `LoadModule("Modules/ConfigOptions")`, as `ConfigTab.lua`
     fills a new set (`:979-987`), and never from `CreateConfigSet`, so no set is added to the loaded
     build (review S21).

   Any defect → `isError` listing `stage <id>: <defect>` for every stage; nothing is written and the
   engine is untouched (D-162).
6. **New build:** `ctx.newBuild({className, ascendancy})`. This replaces the engine's build, the user's
   loaded build and any unsaved change to it included (D-210), and drops C-3's recovery snapshot.
7. **Build and measure,** one `compile_stage` request per stage, in plan order (D-156). It selects or
   creates the stage's tree spec and its item, skill and config sets: stage 1's are retitled spec 1 and
   set 1 of each type (D-215); others are created on first use and reused by id after; never
   `CopyLoadout` (D-103). It imports the tree with weapon-set tags and attribute choices, sockets the
   jewels, equips the items, sets the toggles and `useSecondWeaponSet`, adds the groups and gems, and sets
   the main selection: the build-wide group, the group's active skill, the stat set (C-44). It writes
   every listed config option, earned and scenario, into the config set (C-32), sets the stage's level in
   manual mode, and recalculates.
   - **Off-hands** (D-310). Whether an off-hand fits depends on Giant's Blood, Instruments of Power and Lord
     of the Wilds, from the tree or from an item, which PoB reads from its last calculation. So the stage's
     tree goes in first, then a new item set gets every item but the off-hands (Weapon 2, Weapon 2 Swap).
     The stage is calculated, and then the off-hands go in, checked against this stage's own tree and items.
     The weapon flags come from the measured `mainEnv.modDB`, so an item-granted flag (Treefingers) counts.
   - **Full DPS off** (D-306). As built, every socket group is created with `includeInFullDPS` off
     (`Compile.lua:632`). In both modes (WU-55, D-293, D-337; built), the named source's groups (each
     stage's `rolledGroup`) are created with `includeInFullDPS` on and `groupCount` set to their `count`,
     so PoB computes Full DPS for them during the stage's calculation; every other group stays off (D-306,
     narrowed). The flags go in where `build_skills` creates the groups, so stages that share a skill set
     share them.
   - **Deferred rebuilds** (D-306). PoB's rebuild after each mutation is deferred while the tree, jewels,
     items, toggles and gems go in, and again while the config and level are written. The stage rebuilds
     once before its main selection and once before it is measured. Its `outputs` and `skillOutputs` must
     equal the eager path's (a rebuild after every mutation); the NFR step tests that on the fifteen-stage
     fixture.
   - After the listed config options (WU-55, D-293; built), each `customMods` entry is written into PoB's
     `customMods` text option, one line per entry, in a `set_config` call of its own; the save check below
     treats that option like a listed one.
   - *Target (WU-65, D-358):* a stage's `items.anoint` is written as `{enchant}Allocates <notable>` on its
     amulet, which PoB grants with no path or point.
   - *Target (WU-65, D-353):* an endgame stage whose scenario omits a reference hit gets it from the data,
     D-254's formula rounded up by D-256 (`ceil(round2(value))`), at the stage's area level; a plan that
     states one keeps its own.

   It replies with:
   - `allocation` (D-213): PoB's allocated nodes and ascendancy nodes after the import, each with its
     weapon-set tag (0, 1 or 2);
   - `outputs`, every finite numeric scalar of `mainOutput`, and `skillOutputs`, C-45's breakdown keyed
     `g<group>s<skill>p<statSet>`, each `{skill, statSetLabel, fields}`;
   - V1 inputs (added by WU-42): `CountAllocNodes`, `ExtraPoints`, `PassivePointsToWeaponSetPoints`,
     `Str/Dex/Int`, `ReqStr/ReqDex/ReqInt` with their sources; each gem's tier, kind (skill, support, or
     spirit, i.e. it reserves Spirit) and `levelRequirement` at its level; each item's
     `requirements.level`; PoB's warning lines (the `get_warnings` path);
   - V2 inputs (added by WU-42): allocated node names, equipped item names by slot, gem names, active
     skill names, flask and charm `active` states, and the config set's `input` and `placeholder` tables
     after the writes and the recalculation, so `enemyIsBoss`'s placeholders are included (D-212). Also
     `shownOptions`, the conditional options PoB shows for the stage (D-250);
   - `items`, what the stage's item set holds per slot after the measurement, and `addedItems`, what this
     stage equipped when it created the set; `weaponFlags`, the measured stage's three flags (D-310);
   - `configInputs`, the stored values of the stage's listed options, and `configSurvivesDrop`, whether a
     reload gives each the same value when PoB's save leaves it out (D-248).

   The compiler compares `allocation` with the stage's plan (`compareAllocation` in
   `src/plan/compiler.ts`). Any node PoB dropped, added or tagged differently → `isError` naming the
   stage and each such node (D-213). It compares the item set's `items` with the plan the same way
   (`compareItems`, D-310). PoB unequips an off-hand that doesn't fit without an error, so any slot that
   differs → `isError` naming the stage, the slot and the item. A Lua failure, an allocation difference or
   an item difference → `isError` naming the stage; nothing is written, and the engine holds the partial
   build.
   - **Known limit** (D-310). An off-hand that can't fit in a set shared by several stages is caught at
     compile, not in step 5's `compile_check`. Catching it there needs a calculation. So the stage is
     refused after step 6 has replaced the loaded build.
8. **Finish:** one `compile_finish {stages, active, level, itemSlots}` request. `stages` lists each compiled
   stage as `{id, title, ids}`: its loadout title and its tree spec and set ids. `active` is the loadout of
   the highest-level stage (the last among ties, A-P9), and `level` is that stage's level. `itemSlots` lists
   the slots to report. It runs `SyncLoadouts` and checks that the loadouts are exactly the stages'
   loadouts, each resolving to its stage's four sets, and that no tree spec or set is untitled. It selects
   `active`, then calls `set_level(<level>, auto=true)` (D-196). It replies with `loadouts`, `active`,
   `level`, `autoMode` and `itemSets` (each set's items in `itemSlots`). The compiler compares those items
   with the plan again; any difference → `isError` (D-310).
9. **Export:** `export_build_xml`.
   - **Config the save dropped** (D-248). PoB's `ConfigTab:Save` compares each input with the *active* set's
     placeholder or default (`ConfigTab.lua:712-715, :741-742`), so a non-active stage can lose an explicit
     option. The compiler puts every listed option the save left out back into its stage's `<ConfigSet>`
     in the XML. Then it checks that every listed option is in the file with its value
     (`src/plan/savedConfig.ts`).
   - Then `encodePobCode`.
   - **Full DPS in the file** (D-293, D-337). The delivered file, and a measure-only compile's XML, carry
     `groupCount` (the plan's `count`) and `includeInFullDPS` on the named source's groups only, so a reader
     who opens it sees Full DPS with the same Count. WU-51 (S-N2) decided how: Full DPS on the named groups
     cost ×1.14 of the whole call and at most 3.08 s per stage request on the fifteen-stage fixture, within
     NFR-21, so step 7 sets the flags and PoB computes Full DPS in every compile, measure-only included
     (D-337). Nothing is patched in at export. Groups outside the named source stay out of Full DPS (D-306, narrowed by
     D-337).
10. **Write.** Final mode: `writeBuildFile({name: build_name, kind:'engine', overwrite, guard, ctx})`
    (C-17, which calls `noteSaved`), then at once the target's write-ledger entry (D-211). Measure-only:
    `compiled-build.xml` beside the plan; the ledger is neither read nor written.
11. **Check and record:** V1 and V2 per stage (§3.7), the ledger formulas (§3.3), then
    `compile-record.json` beside the plan.

**Engine requests** (D-221, amending D-156). A compile sends exactly one `compile_stage` request per
compiled stage, plus a fixed overhead of five: `compile_check`, `new_build`, `compile_finish`, the step-9
export and the session's snapshot export after the call (C-3 step 6).

**Crashes** (D-165). A crash during steps 5–9 fails the call with C-3's crash text, and nothing is
written. During step 5 the recovery snapshot is the previous build's, and C-3 restores it. From step 6 on
there is none, so recovery takes C-3's no-snapshot path: the next `read` or `mutate` call fails with "the
loaded build could not be restored", and a later compile, which starts from `new_build`, succeeds. A
crash during the session's snapshot export, after step 11, fails the call with the files already
written; the ledger entry is in place, so a retry may overwrite. A V1 or V2 finding never fails the call
(D-192).

**Write ledger** (D-211). `<stateDir>/guide-writes.json`, in the server's state dir (C-16) and outside
the guides root, so no agent can write it (D-177). `src/plan/writeLedger.ts` (new) reads and writes it:

```ts
type WriteLedger = { ledgerVersion: 1;
  entries: { path: string;       // canonical, builds-relative (D-52); unique
             sha1: string;       // of the bytes written
             runFolder: string;  // runFolderOf(plan_path): <slug>/<YYYY-MM-DD>-<n>
             writtenAt: string   /* ISO 8601 */ }[] };
```
- A final compile replaces its target's entry. Measure-only compiles never read or write the ledger.
- It is written under the engine lock, as a temp file then a rename. A missing file is an empty ledger. An
  unreadable or invalid one fails every final compile with `isError` naming the file, and is never
  silently replaced.
- Order: step 3's check; step 10's PoB write through C-17, then the entry; step 11's record. A failure
  after the PoB write still leaves the entry, so a retry can overwrite.
- `compile-record.json` (its `pobFile` included) is informational and grants nothing.

**Lua.** `pob-api/API/Compile.lua` (new), merged by one line in `Handlers.lua`, holds `compile_check`,
`compile_stage` and `compile_finish`. Each gets a C-5 schema, a typed bridge wrapper and a
`contract.test.ts` case (AC-B4). They reuse slice 1's set, tree-state and stat-set functions and BuildOps'
item, gem and config functions instead of copying them. Under `POB_API_TEST_ACTIONS=1` only,
`compile_stage` honours `params.__crashForTest` by calling `os.exit(3)` (as AC-E6's override does).

**Compile record** (`compile-record.json`, C-33):

```ts
type CompileRecord = {
  recordVersion: 1; planSchemaVersion: number; planSha1: string;
  buildSha1: string;                // D-266: the sha1 of the plan's build-affecting projection
  compiledAt: string /* ISO 8601 */;
  mode: 'final' | 'measure-only'; stagesCompiled: string[];
  engine: { pobTag: string; pobCommit: string; treeVersion: string };   // as running (C-6)
  versionNotes: string[];           // every place the plan's `versions` differ from `engine`
  loadoutWarnings: string[];        // D-310: one per weapon-fit flag the stages differ in
  saveWarnings: string[];           // D-248: one per config set whose options a PoB2 re-save would drop
  pobFile: { location: 'builds' | 'run'; path: string; sha1: string; bytes: number };   // informational (D-211)
  importCode: string;               // D-205
  savedLevel: { level: number; autoMode: true }; activeLoadout: string;
  sets: { kind: 'tree' | 'item' | 'skill' | 'config'; id: number; title: string; stages: string[] }[];
  stages: Record<string, {
    loadoutName: string; level: number; elapsedMs: number;   // elapsedMs: this stage's compile_stage request
    outputs: Record<string, number>;
    skillOutputs: Record<string, { skill: string; statSetLabel: string; fields: Record<string, number> }>;
    configWritten: Record<string, boolean | number | string>;
    configEffective: Record<string, {                        // D-212; filled from WU-42's V2 inputs, {} until then
      value: boolean | number | string;
      origin: 'explicit' | 'default' | 'placeholder';        // written by the compile, a default-on default,
                                                             // or a placeholder PoB applies (§3.7)
      class: 'earned' | 'scenario' | 'baseline' | 'unlisted' }>;   // baseline: data/config-baseline.json
                                                             // covers it for the stage (§3.7, D-250, D-252)
    pobWarnings: { kept: string[]; filtered: string[] };     // filled from WU-42's V1 inputs
    v1: Verdict | null; v2: Verdict | null;                  // null until WU-42 lands
  }>;
  ledger: Record<string, { value: number | null; error: string | null }>;
  unresolvedRefs: { where: string; ref: string }[];   // pob-computed tags naming no record field
  timing: { totalMs: number; checkMs: number; finishMs: number; exportMs: number };
};
type Verdict = { pass: boolean; findings: Finding[]; notes: Finding[] };   // pass ⇔ findings is empty
type Finding = { code: string; message: string; data?: Record<string, unknown> };
```
Notes record reliance on M- or L-confidence facts (A-29); they never fail a check. `configEffective` holds
every option that affects calcs: each listed one, each default-on one and each placeholder-driven one. It,
not the saved XML, is the authority on a stage's config, because PoB's Save omits an explicit value equal
to its placeholder (D-212, D-113). The written file also carries every listed option, since step 9 puts
back what the save dropped (D-248).

- **`buildSha1`** (D-266, `src/plan/buildHash.ts`). The projection is the plan without `stages[].claims` and
  without every `source` and `tag` key at any depth. It is serialized canonically: object keys sorted, arrays
  in order, no whitespace.
  - It keeps `ledger[].claim`, `respec.note` and `chaosResistException.reason`, so an edit to one of those
    takes the recompile path.
  - It also strips `config.scenario[].source` and `respec.goldCost.source`, so a change to a scenario
    entry's fact key alone leaves `buildSha1` equal. That is intended (D-328):
    `buildSha1` tracks build content, and sources and tags are citations.
  - When only claims were edited after the final compile, the run checker requires the current plan's
    `buildSha1` to equal the record's (slice 3, D-264).
  - *Target (WU-65, D-352):* the projection also leaves out the plan's `ledger`, `ledger[].claim`
    included, in `src/plan/buildHash.ts`, which the compiler and the checker share. The checker
    re-evaluates the ledger itself (D-271, `[ledger]`, WU-71), so a ledger-only edit after the final compile
    leaves `buildSha1` equal and passes `[record-plan]`, and a gear edit still fails it (AC-W59).
- **`loadoutWarnings`** (D-310). PoB2 checks an off-hand against the passives of the loadout it switches
  from, so switching loadouts in PoB2 can unequip a planned off-hand. One line per weapon-fit flag (Giant's
  Blood, Instruments of Power, Lord of the Wilds) that some stages have and others lack.
- **`saveWarnings`** (D-248). One line per config set, naming its stages and the options that a save in PoB2
  would drop again.
- **`recordVersion`** stays 1: these three fields are additive.
- **Record version 2** (WU-55, D-293, D-294, D-321; built), with the fields WU-55 names (work-log
  "Review: WU-55"; spine C-33):
  - `recordVersion: 2`. The raw `outputs` and `skillOutputs` stay as PoB measured them.
  - Per stage, `countedOutputs: {group, count, dotCanStack, fields}`, the main skill's figures with the main
    group's Count, and `countedSkillOutputs: Record<"g<g>s<s>p<p>", {skill, statSetLabel, count,
    dotCanStack, fields}>`, each `skillOutputs` entry under the same key with its group's Count.
  - The counted `fields`, by PoB's own Full DPS rule (`Modules/Calcs.lua:342-411`, `COUNT_RULE` in
    `src/plan/record.ts`): `TotalDPS` and `ImpaleDPS` × count; `TotalDot` × count only when `dotCanStack`
    (PoB's `DotCanStack`) is true; the ailment and ground DPS figures (bleed, corrupting blood, ignite,
    burning ground, poison, caustic ground, decay) unchanged, since Full DPS takes the best one once. A
    figure Full DPS doesn't merge per skill (`CombinedDPS`, `TotalDotDPS`, a defence) has no counted copy.
  - PoB's raw `FullDPS` and `FullDotDPS` already include Count (PoB reads `groupCount` there), so the record
    never multiplies them again; Count is applied once.
  - Per stage, `customModsWritten: string[]`, the lines written into PoB's `customMods` option, and
    `computedWithCustomMods: boolean`, the mark: true when the stage's written config holds that option
    with text, whatever the source (`customModsWritten`, or a version-1 plan's earned or scenario entry for
    the option), so every figure of it, defences included, rests on custom modifiers. Per ledger entry,
    `computedWithCustomMods`, true when its formula reads such a stage.
  - The headline and the verdict line read the named source's Count-scaled figure,
    `countedSkillOutputs[g<main.group>s<main.activeSkill>p<main.statSet>].fields.TotalDPS`, with `TotalEHP`
    beside it. `TotalEHP` is already in `outputs`, because the compiler copies every finite PoB output
    (`Compile.lua:961-964`).
- *Target (WU-65; D-353, D-358):* **`measures`**, per endgame stage, so no agent computes or checks them:
  - `dps`, the headline (the named source's Count-scaled figure, D-294), and `ehp`, `TotalEHP`;
  - `arbiter` (`b` and `n`): for each damage type the Arbiter of Divinity deals
    (`enemies/arbiter-of-divinity.json`), its largest hit's top roll over `<Type>MaximumHitTaken`: `survives`
    below 1, else `one-shot`; a mixed hit sums its parts' ratios. A row per damage type and mixed hit gives
    the hit, the max hit, the ratio and the verdict;
  - `clearSpeed`, labelled rough, assuming a normal monster dies to one use: by the clear skill's radius
    (`AreaOfEffectRadiusMetres`, 0 if absent), `slow` below 2 m, `medium` to 4 m, `fast` beyond; one step
    faster when its gem text explodes monsters or spreads an effect on death (a phrase list in the
    compiler); one step slower when a use takes over 1 second (`Speed` below 1, an estimate). No agent
    researches it. Run A's 1.8 m starts at slow.

  No kill time and no hits to kill. The ledger shrinks: the compiler fills the reference hits, so 15
  `hit_*` entries go; 4 Arbiter ratios become `measures`; 3 hits-to-kill and 12 kill-time entries go. What
  PoB can't compute stays, as estimates (D-296; run A's `boss_dps_*`, `full_flask_seconds_b`). An anointed
  stage's record also gives the notable's recipe of three Distilled Emotions (D-358).

**Text output.** First `Compiled <plan_path>: <n> stages (<mode>) in <s> s.` Then per stage `Stage <id>
"<loadoutName>" level <L>: V1 pass|fail, V2 pass|fail`, then its V1 and V2 findings, one line each.
- Every finding is printed, up to 200 over all stages (D-273: a gate reads its findings in this text).
- Past that, one line: `<k> more findings; Grep the record's findings (compile-record.json:
  stages.<id>.v1.findings and stages.<id>.v2.findings).`

Then one line per ledger entry (`<id> = <value>` or `<id>: <error>`), and one per version note, loadout
warning and save warning (D-310, D-248). Then the saved level and active loadout, and the paths written,
relative to the builds folder and the guides root.
*Target (WU-65, D-356, amending D-273 (2)):* each stage's line is followed by a key-figure line, so agents
stop Grepping the record after every compile; its fields are WU-65's to name (AC-P64).

**Wiring** (spine §1.2). The schema literal, `TOOL_META` `{engine:'load', group:'core'}`, the router
case, `handleCompilePlan` in `src/handlers/planHandlers.ts`, and a disposition entry with `bucket:"new"`.
One ok sample: a measure-only compile of the two-stage fixture (it changes the export and `revision`).
The hygiene and kinds harnesses gain a `$TWO_STAGE_PLAN` placeholder that copies the fixture into their
guides folder.

**The NFR test runs alone** (review S17, C-19). `compilePlanNfr.test.ts` (AC-P37) has a fixed 100 s
threshold, so it doesn't run in the parallel Jest run: `jest.config.cjs` excludes it
(`testPathIgnorePatterns`), and `mise.toml`'s `test` task runs it in its own step after `pnpm test`,
with `--runInBand`, e.g. `pnpm exec jest --runInBand --testPathIgnorePatterns /node_modules/ --
tests/integration/compilePlanNfr.test.ts`. The step is its own entry in the task's `run` list, with no
pipe, so its exit code fails the task (CLAUDE.md's no-pipes rule).

### 3.7 V1 and V2 (WU-42, `src/plan/checks/`)

Both run in TypeScript, over `compile_stage`'s reply, the plan and the reference data. A finding that rests
on an M or L fact also adds a note naming the fact and its confidence (A-29).

**V1: is the stage valid at its level** (D-108). V1 computes every limit itself, from C1 and the plan;
usage comes from PoB's own counts.

| Code | Finding when |
|---|---|
| `passive-points` | PoB's regular count (`PointsUsed − min(ws1, ws2)`, `Build.lua:1029`) exceeds (level − 1) + the passive points of all quests up to `progress` + `ExtraPoints`. At `endgame` the Martyr point is allowed, with a note (M) |
| `weapon-set-points` | `ws1` or `ws2` exceeds the weapon-set points of all quests up to `progress` + `PassivePointsToWeaponSetPoints` |
| `ascendancy-points` | `AscUsed` exceeds the points of the trials whose `available-from` ≤ `progress` (trial gates from C1). On a variant stage, also when `AscUsed` > `ascendancyPoints` or `ascendancyPoints` exceeds that sum (D-193) |
| `gem-availability` | a skill gem's tier or level exceeds the highest uncut skill-gem level available at `progress`, or a support gem's tier exceeds the highest uncut support level. Spirit gems get a note instead (C1 has no table for them, A-31) |
| `gem-below-tier` | a skill gem's level is below its tier (D-259). C1's `tier-rule` (H): an uncut gem of level N engraves a skill of tier N or lower, at gem level N, so a tier-T skill gem is at gem level T or higher. The finding cites `tier-rule` (`data`: gem, tier, level, `fact: "tier-rule"`). Skill gems only, as `gem-availability` checks them: a support's level isn't cut, a Spirit gem at a C1 Spirit tier is noted instead (A-31), and a tier-0 gem isn't cut (C1 `skill-tiers`) |
| `gem-level-requirement` | a gem's `levelRequirement` at its level exceeds the stage level |
| `item-level-requirement` | an equipped item's `requirements.level` exceeds the stage level |
| `attributes` | PoB's `Str < ReqStr`, `Dex < ReqDex` or `Int < ReqInt`, with the attribute choices applied; the finding names the source item or gem |
| `resistance-penalty` | the stage lists `resistancePenalty` with a value other than C1's for its `progress` region. At a region's last progress key, the next region's entry value is also accepted, with a note naming the boundary (D-251) |
| `pob-warning` | any PoB warning line except the filtered ones, which go to `pobWarnings.filtered`. Two patterns are filtered. `^You have \d+ Weapon set 2 passives available$` (`Build.lua:1051-1055`) is always informational. `^You have too many passive points allocated$` is filtered only when the stage's regular points pass `passive-points` with the Martyr point alone: PoB's cap (`Build.lua:1007, :1030`) doesn't know that point, which V1 notes instead (A-29) |
| `tree-continuity` | the stage's nodes and ascendancy nodes don't contain its predecessor's apart from `respec.dropped`, or `respec.dropped` isn't exactly the dropped set (D-144). The predecessor (`predecessorOf`, `src/plan/checks/v1.ts`; built by WU-61, D-282): stages without `variant` form the campaign track, in plan order; the endgame stages form one ladder, `m` → `b` → `n`, by rung whatever the plan order (plan order only within a rung; a rung the plan lacks is skipped). The ladder's first stage continues from the last campaign stage in the plan, wherever the rung is listed, and from none when there is no campaign stage. So each rung's `respec.dropped` is checked against the rung before it; its gold cost gets only its schema check, since it carries a `judgment` tag (A-32). This replaced A-P3's per-variant tracks |
| `missing-reason` (WU-55, D-322; built) | a group with `count` above 1 and no `countReason`, or a `config.customMods` entry without a `reason`; `data.path` names the field. It is a V1 finding, so the stage's `v1.pass` is false; it is not a schema error (AC-P51, AC-P52) |
| `tree-shape` (*target*, WU-66, D-360) | the stage's main-tree nodes, class starts not joining their exits, break the rule: each tree (connected component) holds exactly one start exit (a node linked to the class start, or a main-tree link of an allocated alternate-start node: Path of the Sorceress, 12795, links exits 4739 and 44871); each start holds at most one tree; an alternate start holds a tree only while its granting node is allocated; the ascendancy nodes form one tree with their own start, over ascendancy links. So a build has at most two trees with Path of the Sorceress, one without. Computed in `check_tree`; the finding names the stage, the start and each tree's nodes (AC-P65) |
| `support-sockets` (*target*, WU-67, D-359) | a tree-granted skill's group holds more supports than the estimated ceiling at the stage's level (`campaign/gems.json`, a `judgment` fact at L); never an item-granted group, whose supports follow its item's sockets, or a gem's own group (AC-P66) |

**V2: config** (D-114, C-32).

| Code | Finding when |
|---|---|
| `producer-unknown` | an earned entry is on and `compile_check`'s `producers` reply says its producer doesn't exist in the game data (D-221) |
| `producer-absent` | the producer exists but isn't in the stage. Item: an equipped item's name. Gem: a gem in the skill set. Passive: an allocated node, ascendancy included. Skill: an active skill of the stage. Flask or charm: equipped, with its toggle on. Names compare case-insensitively |
| `source-unresolved` | a scenario entry's `source.file` isn't a loaded C1/E1 file, or its `key` (and member) doesn't resolve |
| `quest-not-reached` | a quest-reward option (a C1 `pob-config-key`) is on and its quest comes after `progress` |
| `default-unlisted` | an option is on in the config baseline, or is placeholder-driven in the stage's config set, the stage doesn't list it, and the baseline list doesn't cover it for the stage (A-P4, D-212, D-230). The list doesn't cover an option it doesn't name. Nor does it cover a conditional option PoB shows for the stage (D-250), or, on a stage that fights a boss, the enemy's level, armour, evasion, resistances or crit, which come from E1 as scenario entries (D-252). `data` names the option, its value and its `origin` (`default` or `placeholder`) |
| `toggle-empty` | a toggle is active on a slot holding no flask or charm |

**Placeholder-driven** (D-212). An option is placeholder-driven in a config set when it has no effective
input (nil, or 0 for a `count`) and PoB applies its placeholder: a `count`, `integer`, `countAllowZero` or
`float` option with an `apply` whose placeholder is set (and non-zero for a `count`), as `BuildModList`
decides (`ConfigTab.lua:883-900`), plus `enemyLevel` (`UpdateLevel`, `:870-880`). V2 reads it from the
stage's `input` and `placeholder` tables after the recalculation, so `enemyIsBoss`'s placeholders count.
V2 also fills the stage's `configEffective` in the record.

**The baseline list** (D-230). `data/config-baseline.json` (new, WU-42) lists the options that may keep
PoB's default or placeholder, each with a one-line rationale (e.g. full life or mana as a neutral state):

```ts
type ConfigBaseline = { schemaVersion: 1;
                        options: Record<string, { rationale: string }> };   // keys are ConfigOptions vars;
                                                                            // rationale: one non-empty line
```
V2 loads it through its own zod schema (the data directory is injectable for tests); an invalid file is
an error naming the file and the option. An option the list covers for the stage never gets
`default-unlisted`, and its `configEffective` class is `baseline`. The list covers a named option except where
D-250 or D-252 takes it out (the `default-unlisted` row); there the class is `unlisted`.

### 3.8 C-50: `guide_run` (WU-41)

The run-folder and validate modes, moved out of `compile_plan` so that neither starts the engine for
nothing, bumps `revision` or marks the build dirty (D-216).

**Arguments.** Exactly one of `new_run` (a slug, A-P7) and `validate` (a `plan_path`, relative to the
guides root); `stages` only with `validate`. Any other combination is `isError` naming the conflict, and
nothing is done. *Target (WU-68, D-356):* a third argument, `view`, joins the "exactly one" set.

**Kind** (D-216, D-244). `TOOL_META.guide_run` is `{engine:'read', group:'core'}`. `toolRouter.ts`'s
`engineKindFor(name, args)` gives a call's kind from its tool's per-call rule, else from its `TOOL_META`
kind, and `routeToolCall` uses it.
- `guide_run`'s rule: a `validate` call without `new_run` is a `read`, and every other call is `none`.
- So a `new_run` call, like any other argument mix (which the handler refuses), never enters `session.run`.
  It takes no lock, emits no session event and never starts the engine.
- The same function holds `manage_sets`' rule: `{action:"list"}` is a `read` (D-244, slice 1).

**Run-folder mode** (`new_run`, D-207).
1. `checkGuidesRoot(guidesDirectory, pobDirectory)` (D-220); an overlap → `isError` naming both, nothing
   created.
2. `createRunFolder(root, slug, today)` (§3.1).
3. `loadedBuildUnsaved` (D-210) is `session.isDirty()`, read without the
   lock; when true, the loaded build's name is `session.loaded.displayName`.

Text output: `Created run folder <absPath>`, `plan_path for this run: <relPath>/plan.json`, and
`loadedBuildUnsaved: true` or `loadedBuildUnsaved: false`. When true, one more line names the loaded build
and says that the next compile replaces it, so it should be saved first; the skill asks the user (D-210).

**Validate mode** (`validate`, D-167). One `session.run` of kind `read`. It runs §3.6 step 2 (schema and
reference data) and step 5 (`compile_check`), which mutates nothing (A-P12). Defects are `isError` as in
step 5. Otherwise it returns `Plan <path> is valid: <n> stages (<ids>).`, followed, once WU-42 adds
`producers`, by one line per producer `compile_check` reports unknown (`producer-unknown`: a V2 finding at
compile, not an error). It sends exactly one engine request.

*Target (WU-68, D-356):* **the views.** `{view: {plan, stage}}` returns one stage's plan section and its
key figures; `{view: {plan, claims: true}}` returns every claim, compact (run A's: 48K characters against
226K paged). Each stays under Read's 25K-token cut-off; run A's `plan.json` was about 92K tokens, and Read
stopped at line 755 of 2,848. A view call is `none` by `guide_run`'s rule above; the README tool table,
which it regenerates, is WU-68's.

**Wiring** (spine §1.2). The schema literal, the `TOOL_META` entry, the router case and `guide_run`'s rule
in `engineKindFor`, `handleGuideRun` in `src/handlers/planHandlers.ts`, and a disposition entry with
`bucket:"new"`. Two ok samples: `{new_run:"kinds-probe"}` and `{validate:"$TWO_STAGE_PLAN"}`. Both are
`read` samples, so `engineKinds.test.ts` expects the export and `revision` unchanged, with no `stateChange`
declaration.

## 4. Slice assumptions (proceed-on; to fold into spine §6.2)

These are formalizer's choices where the inputs fix a requirement but not its mechanics.

| ID | Assumption | Basis | If wrong |
|---|---|---|---|
| A-P1 | Stage ids match `[A-Za-z0-9]+`, so they work as brace ids. `loadoutName` contains `(L<level>)` and ends with ` {<id>}` | D-103; D-138's `Act 2 (L25) {2}` | Change the rule in `schema.ts` and the reference |
| A-P2 | Sets are shared by deep equality of `items`, `skills` or `config`, and titled as in §3.6 step 4 | C-31: "the compiler names shared sets" | Add explicit set keys to the schema |
| A-P3 | *Replaced → D-282 (built, WU-61):* the continuity predecessor was: stages without `variant` form the campaign track, each variant its own track, each in plan order, a variant track's first stage continuing from the last campaign stage before it. Now the endgame stages form one track, `m` → `b` → `n` (§3.7) | D-144 names only "the previous stage"; D-282 (amendment 2) | Re-scope `tree-continuity` |
| A-P4 | An option is on by default when its default value (`defaultState`, or `list[defaultIndex].val`, from the defaults loop over `ConfigOptions`, as `ConfigTab.lua:979-987` fills a new set) is on (A-P5). **Corrected by D-212:** placeholders are not hints. PoB applies a numeric option's placeholder as its value when it has no input (`ConfigTab.lua:870-900`), and `enemyIsBoss` sets the enemy-stat placeholders (`ConfigOptions.lua:1964-1997`), so the audit also covers placeholder-driven options (§3.7), read after each stage's recalculation. Every stage lists `enemyIsBoss`, which the compiler writes into every config set | C-32, D-79, D-119, D-212 | Widen or narrow the audit |
| A-P5 | "On" is as defined in §3.2. An earned entry whose value is off needs no producer | C-32 (nothing to produce) | Require producers on every entry |
| A-P6 | The measure-only XML is named `compiled-build.xml`, beside the plan | D-208 names no file | Rename it |
| A-P7 | A slug matches `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters, which is safe on drvfs | C-50's "one safe path segment" (the `new_run` slug) | Loosen the pattern |
| A-P8 | `stages` subset semantics, called S1: a subset is accepted only by `guide_run`'s validate mode and `compile_plan`'s measure-only mode, and a final compile is always the whole plan. WU-30 confirms S1 or raises HG-13 | gap 6, D-156; the M-11 exit's one loadout per stage | The user picks an incremental scheme at HG-13 |
| A-P9 | At save, the highest-level stage's loadout is active (the last among ties) | D-138 and D-149 name the level, not the loadout | Change `compile_finish` |
| A-P10 | Progress points are `start`, the `QuestRewards.lua` rows in file order, then `endgame`. Interludes count in PoB's file order | C-31: "a C1 key for the campaign point reached" | Re-key C1 |
| A-P11 | V2 checks that scenario sources resolve, not that their values match. A derived value, such as a waystone-scaled hit, is V4's to re-derive | C-32: "name their source" | Add a value comparison |
| A-P12 | One read-only `compile_check` request precedes the per-stage requests, so a defect leaves the engine untouched. **Corrected (review S21):** it mutates nothing because its config baseline comes from the defaults loop over `LoadModule("Modules/ConfigOptions")`, not from `CreateConfigSet`, which would add a config set to the user's loaded build | D-162; D-156 as amended by D-221 (one build request per stage plus a fixed overhead) | Fold the checks into `compile_stage` |
| A-P13 | A QuestRewards key (D-214) is the row's `Description`, `Area` and `Info` joined with spaces, lowercased, with every run of characters outside `[a-z0-9]` replaced by one `-` and none leading or trailing: Act 1, Clearfell, Beira gives `q.act-1-clearfell-beira` | PoB's own key, `"quest"..Description..Area..Info` (`ConfigOptions.lua:72`), has spaces and capitals, so it can't be a fact id (§3.4) | Re-key C1, the fixture and the reference together |

## 5. Work units

### WU-30: Compile-time spike
- status: built, merged at `1ec4944`
- kind: spike
- depends-on: []
- role: lua-dev
- touches: [`docs/build-guide/spikes/WU-30-compile-time.md` (new)]. Probes run only from `mktemp -d`, with
  temp `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY`; they are committed only as the
  report's appendix.
- produces: [the report: per-stage and whole-call times; the `stages` decision (A-P8)]
- consumes: [S-a's recipe (pin §C), C-2's `__test_eval`, C-4's 30 s timeout]
- acceptance: [AC-P1, AC-P2]
- milestone: M-11
- summary: Drive a real engine across the TS↔Lua seam with `tests/helpers/luaLineClient.ts` and
  `POB_API_TEST_ACTIONS=1`, one `__test_eval` payload per stage.
  - **The synthetic plan is a worst case:** 15 stages at levels from 2 to 90, no set sharing (15 tree specs
    and 15 sets of each kind), trees growing to 123 regular points, 24 weapon-set tags and 8 ascendancy
    nodes, every `ITEM_SLOTS` slot filled at endgame, 6 socket groups of up to 6 gems per stage, and as
    many config writes as the fresh-set baseline has options on.
  - **It times,** per stage, the build, one measurement, a breakdown over every active skill and stat set
    (select, recalculate, read, restore, emulating C-45) and one `RefreshStatList`; then `SyncLoadouts`
    with the loadout check, the auto-level set, and two `SaveDB` calls (the export and the snapshot).
  - **Three runs.** The report gives the machine, pin, method, per-stage times (median and max), the
    whole-call times and the decision.

### WU-37: Guides-folder root
- status: built, merged at `44d608e`
- kind: build
- depends-on: []
- role: backend-dev
- touches: [`src/index.ts` (`entryDefaults`, deps), `src/server/createServer.ts` (`ServerDeps`),
  `src/utils/guidesPath.ts` (new), `src/services/buildExportService.ts` (only if `isInside`/`realPathOf`
  move to a shared util), `tests/setup/global.ts`, `tests/helpers/spawnServer.ts`,
  `tests/helpers/server.ts`, `tests/helpers/engineSession.ts`, `tests/unit/entryDefaults.test.ts`,
  `tests/unit/guidesPath.test.ts` (new), `README.md` env table, `tests/static/readme.test.ts`]
- produces: [C-34's root and path rules, `createRunFolder`, the C-7 and C-18 deltas]
- consumes: [C-7, C-18]
- acceptance: [AC-P3, AC-P4, AC-P5, AC-P6, AC-P7, AC-B6]
- milestone: M-11
- summary: Add `guidesDirectory` to `entryDefaults` and `ServerDeps`, §3.1's resolve-and-contain and
  run-folder functions, and the Jest redirect. No tool changes; WU-41 exposes run-folder creation through
  `guide_run` (D-216).

### WU-38: P1, the plan schema, its reference and the ledger evaluator
- status: built, merged at `2e47473`
- kind: build
- depends-on: []
- role: backend-dev
- touches: [`src/plan/schema.ts`, `src/plan/sourceTag.ts`, `src/plan/ledger.ts` (new; they import one
  another, which satisfies the dead-module scan), `docs/build-guide/plan-reference.md` (new),
  `tests/fixtures/plans/two-stage/plan.json` (new), `tests/unit/planSchema.test.ts`,
  `tests/unit/ledger.test.ts`, `tests/static/planReference.test.ts`, `tests/static/planNoEval.test.ts` (new)]
- produces: [C-30, C-31 and C-32 as zod (§3.2); the ledger grammar and evaluator (§3.3); the reference doc]
- consumes: []
- acceptance: [AC-P8, AC-P9, AC-P10, AC-P11, AC-P12]
- milestone: M-11
- summary: §3.2's schema with its cross-reference rules and JSON paths, including the progress-key form
  (D-214), skill-group roles and `rolledGroup` (D-217), price ids and `price:`/`data:` claims (D-232,
  D-237) and the nullable `league` (D-233), and §3.3's evaluator. **The two-stage fixture** (also the
  reference's worked example): stage `1` at an Act 1 progress point and a low level; stage `2` later,
  higher, with a tree containing stage 1's. Their `items` are deep-equal and their `skills` differ. It
  has one ledger entry over both stages, an `ok` and an `unavailable` price, at least one claim of each
  tag kind and of each reference form, and progress keys of the D-214 form, which WU-39 then sets to real
  keys.

### WU-39: C1 and E1 data files and their loader
- status: built, merged at `d4d5fc5`
- kind: build
- depends-on: [WU-38]
- role: backend-dev
- touches: [`data/campaign/*.json`, `data/enemies/*.json` (new), `src/plan/referenceData.ts` (new),
  `src/plan/schema.ts` (the `progress` and `data:` checks), `tests/fixtures/plans/two-stage/plan.json` and
  `docs/build-guide/plan-reference.md` (their progress keys, D-214), `tests/unit/referenceData.test.ts`,
  `tests/static/referenceData.test.ts`, `tests/integration/questKeys.test.ts` (new)]
- produces: [C-35 (§3.4); the progress-key data (D-214)]
- consumes: [C-30, the pin, ext §2–§4]
- acceptance: [AC-P13, AC-P14, AC-P15, AC-P16, AC-P17, AC-P18]
- milestone: M-11
- summary: §3.4's files, from the pin and the external-data grounding doc only (D-204), with no web fetch.
  Add the zod loader, and the `progress` and `data:` checks in `validatePlan`. Set the fixture's and the
  worked example's progress keys to real ones, together.

### WU-40: Import-code encoder and `encode_build_code`
- status: built, merged at `19e3140`
- kind: build
- depends-on: []
- role: backend-dev
- touches: [`src/utils/buildCode.ts`, `src/handlers/buildCodeHandlers.ts` (new), `toolSchemas.ts`,
  `toolMeta.ts`, `toolRouter.ts`, `tool-disposition.json`, `tool-calls.json`, the README table, the count
  sites (spine §1.3), `tests/unit/buildCode.test.ts`, `tests/mcp/encodeBuildCode.test.ts` (new),
  `tests/integration/toolHygiene.test.ts` and `engineKinds.test.ts` (test encoders replaced)]
- produces: [C-42 (§3.5)]
- consumes: [D-52, C-17's canonical paths]
- acceptance: [AC-P19, AC-P20, AC-B1, AC-B2]
- milestone: M-11
- summary: `encodePobCode` and the `none`-kind tool. This is a tool-adding merge: the counts move by +1.

### WU-41: P2, the compiler, `compile_plan` and `guide_run`
- status: built, merged at `408ffd9`
- kind: build
- depends-on: [WU-30, WU-33, WU-35, WU-36, WU-37, WU-38, WU-39, WU-40]
- role: backend-dev + lua-dev
- touches: [`pob-api/API/Compile.lua` (new), `pob-api/API/Handlers.lua` (one merge line),
  `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `src/plan/compiler.ts`, `src/plan/record.ts` and
  `src/plan/writeLedger.ts` (new), `src/handlers/planHandlers.ts` (new), `src/utils/guidesPath.ts`
  (`checkGuidesRoot`, `runFolderOf`), the wiring files (`toolRouter.ts` with `guide_run`'s per-call kind
  rule, now in `engineKindFor`, D-244), `src/plan/savedConfig.ts` (new in review, D-248), fixtures (the
  off-hand fixtures added in review, D-310), count sites and README table,
  `tests/integration/contract.test.ts`, `tests/integration/compilePlan.test.ts`, `compilePlanNfr.test.ts`
  and `guideRun.test.ts` (new), `tests/unit/compileAllocation.test.ts` (new), `tests/fixtures/plans/` (the fifteen-stage fixture, defect
  variants), `toolHygiene.test.ts` and `engineKinds.test.ts` (the placeholder), `mise.toml` (the `test`
  task's NFR step) and `jest.config.cjs` (its exclusion); `buildFileWriter.ts` only if a new write kind
  is needed]
- produces: [C-41 (§3.6), C-50 (§3.8), C-33's record and ledger evaluation, the write ledger (D-211)]
- consumes: [C-3, C-4, C-5, C-17, C-34, C-31, C-35 (`validatePlan` with the reference data), C-42, C-39,
  C-40, C-44, C-45, D-196's auto flag]
- acceptance: [AC-P21…AC-P38, AC-P45…AC-P49, AC-B1, AC-B2, AC-B3, AC-B4, AC-B8]
- milestone: M-11
- summary: §3.6's steps 1–11 (V1 and V2 left `null`, `configEffective` `{}`), the three Lua actions,
  `compile_plan`'s two modes, the write ledger and `guide_run` (§3.8). The fifteen-stage fixture is
  WU-30's synthetic plan in P1 form. This merge adds two tools: counts reach 84, and 83 without
  poe.ninja.
  - **As built:** every group is created with Full DPS off, and the rebuilds are deferred, with outputs
    equal to the eager path (D-306).
  - **Its review** (`8579f07`, `408ffd9`) added the per-stage off-hand handling, `compareItems` and
    `loadoutWarnings` (D-310), and the config restore and `saveWarnings` (D-248).

### WU-42: V1 validity and V2 config checks inside compile
- status: built, merged at `c3dba2e`
- kind: build
- depends-on: [WU-41, WU-39, WU-31]
- role: backend-dev + lua-dev
- touches: [`src/plan/checks/v1.ts`, `src/plan/checks/v2.ts` (new), `src/plan/compiler.ts` (calls them),
  `pob-api/API/Compile.lua` and `src/engine/schemas.ts` (V1/V2 inputs, `compile_check`'s `producers` and
  config baseline, additive), `data/config-baseline.json` (new, D-230), `tests/fixtures/plans/` (check
  variants; the two-stage fixture and the worked example adjusted together if needed),
  `tests/integration/planChecks.test.ts`, `tests/unit/planChecks.test.ts` (new)]
- produces: [§3.7's verdicts and `configEffective` in the record and the text; the baseline list]
- consumes: [C-35, C-37's lookup functions (inside `compile_check`'s `producers`, D-221),
  `compile_stage`'s reply]
- acceptance: [AC-P39, AC-P40, AC-P41, AC-P42, AC-P43, AC-P44, AC-P50]
- milestone: M-11
- summary: §3.7: the V1/V2 inputs in the stage reply, `producers` and the config baseline in
  `compile_check`, the placeholder-aware default audit (D-212), the baseline list (D-230), and the checks.
  The two-stage fixture passes both: each of its placeholder-driven and default-on options is listed by
  the stage or by the baseline list. Its review fix (`c3dba2e`) added D-250…D-252.

### WU-51: Spike: Full DPS compile cost with only the named groups (amendment 3's S-N2)
- status: done, merged at `9f74ad9` (report `docs/build-guide/spikes/WU-51-full-dps.md`). Decision:
  within NFR-21, so the final compile computes Full DPS for the named source's groups. Three quiet runs (a
  1-minute load average of at most 8): the whole call 26.22–27.77 s with Full DPS off and 29.93–31.92 s with
  it on for the named groups (median ×1.14); the slowest stage request 3.08 s. With every group in Full
  DPS, through the real compiler, 61–67 s, slowest stage 6.17 s. The coordinator then ruled that
  measure-only compiles compute it too (D-337)
- kind: spike
- depends-on: []
- role: lua-dev
- touches: [`docs/build-guide/spikes/WU-51-full-dps.md` (new)]. Probes run only from `mktemp -d`, with
  temp `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY`.
- produces: [the report: the compile cost with Full DPS on for the named source's groups only; the
  decision for §3.6 step 9 (D-293)]
- consumes: [WU-41's compiler; the fifteen-stage fixture (D-329)]
- acceptance: [AC-P57]
- milestone: M-14
- summary: Measure a final compile of the fifteen-stage fixture with `includeInFullDPS` on for the named
  source's groups only (each stage's `rolledGroup` there). The reason is amendment 3's test run: every group
  in Full DPS took 160.68 s, with one stage at 25.50 s. That is against NFR-20's 100 s and NFR-21's
  per-stage limit (R-32). Within NFR-21, the final compile computes Full DPS for those groups; otherwise the
  flags are written at export only.

### WU-55: Count and custom modifiers in the plan, the compiler and the record (amendment 3's N-4)
- status: built, merged at `3fc1500`
- kind: build
- depends-on: [WU-51 (done)]; after WU-61 on `src/plan/schema.ts`: WU-61 merged first, so WU-55 extends
  its version bump (D-320)
- role: backend-dev + lua-dev
- touches: [`src/plan/schema.ts`, `src/plan/compiler.ts`, `src/plan/record.ts`, `src/plan/checks/` (the
  reason findings), `pob-api/API/Compile.lua`, `pob-api/API/BuildOps.lua` (`create_socket_group`'s
  `groupCount`), `docs/build-guide/plan-reference.md` and its worked example,
  `tests/unit/planChecks.test.ts`, the compiler's engine tests, `src/engine/schemas.ts`,
  `src/pobLuaBridge.ts` and `tests/integration/contract.test.ts` (the amended actions' schemas, wrapper
  types and contract cases)]
- produces: [§3.2's `count`, `countReason` and `customMods`; §3.6's `customMods` writes, its new
  `compile_check` defect, and `groupCount` and `includeInFullDPS` on the named groups in every compile
  (D-337); the record's Count-scaled figures and custom-modifier marks, with their field names in C-33's
  text (§3.6's record version 2; D-293, D-294); V1's `missing-reason`]
- consumes: [WU-51's decision and D-337, C-31, C-32, C-33, C-41]
- acceptance: [AC-P51, AC-P52, AC-P53, AC-P54, AC-P55, AC-P56, AC-B3, AC-B4, AC-B5]
- milestone: M-14
- summary: The plan gains `count`, `countReason` and `customMods`.
  - The compiler writes `customMods` after the config options. The record applies Count itself and marks
    the figures computed with custom modifiers.
  - Every compile, measure-only included, creates the named source's groups with `groupCount` and
    `includeInFullDPS` on, as WU-51 decided and D-337 extends.
  - V1 reports a missing reason (`missing-reason`). WU-61 made §3.2's `schemaVersion` bump, so WU-55 adds
    its fields to version 2's `VERSION_ADDITIONS`; a version-1 plan that uses one is an error (D-332).
  - AC-P37's test now checks that no group is in Full DPS (D-306). That check narrows to the groups
    outside the named source; the named source's groups are in it, with their Count (D-337).
  - Slice 3 reads the new figures (WU-57, WU-58).

### WU-61: The entering-maps variant and the ladder track (amendment 2)
- status: built, merged at `74c5745`
- kind: build
- depends-on: []; serialized with WU-55 on `src/plan/schema.ts` (D-320): WU-61 merged first
- role: backend-dev
- touches: [`src/plan/schema.ts` (`variant`), `src/plan/checks/v1.ts` (`predecessorOf`),
  `docs/build-guide/plan-reference.md`, `tests/unit/planChecks.test.ts`]
- produces: [§3.2's `entering-maps` variant (D-281) and `schemaVersion` 2 (D-320, D-332); §3.7's one
  endgame track (D-282), replacing A-P3]
- consumes: [C-31, §3.7]
- acceptance: [AC-P58, AC-P59, AC-P10's version row]
- milestone: M-14
- summary: `variant` gains `entering-maps`, and `tree-continuity` follows one track, `m` → `b` → `n`.
  - It merged before WU-55, so it made §3.2's `schemaVersion` bump, to 2, and AC-P10's version row moved
    with it. `VERSION_ADDITIONS` (`src/plan/schema.ts`) lists what version 2 added, which WU-55 extends;
    `schemaVersion`'s literal union is built from `PLAN_SCHEMA_VERSIONS`.
  - The two-stage fixture and the worked example declare version 2. No fixture verdict moved (R-37).
  - **Deviations accepted** (the review): a version-1 plan that uses a version-2 field is an error, not a
    default (D-332); V1 checks a rung's `respec.dropped`, and the gold cost gets only its schema check
    (A-32; D-282). The review also moved the first rung to follow the last campaign stage overall, not the
    last one before it in plan order.
  - Slice 3's guide-style unit, WU-62, builds on this one.

**Amendment 4's units** (M-15; amendment 4 §15, D-361). The DAG is the spine's §8: WU-65 first; WU-66 and
WU-68 in parallel after it; WU-67 after WU-66; slice 3's WU-69…WU-71 after WU-68, and WU-72 after all.

### WU-65: Plan schema 3, the anoint, `measures` and the key-figure lines
- status: target (M-15)
- kind: build
- depends-on: []
- role: backend-dev + lua-dev
- touches: [`src/plan/schema.ts` (schema 3), `src/plan/compiler.ts` (the reference hits, the key-figure lines), `src/plan/record.ts` (`measures`, the anoint's recipe), `src/plan/buildHash.ts` and `tests/unit/buildHash.test.ts` (the projection leaves out the ledger, D-352), `src/plan/checks/v1.ts`, `pob-api/API/Compile.lua` (the anoint's write and refusals), `src/handlers/planHandlers.ts` (the reply), `docs/build-guide/plan-reference.md` and its worked example, `tests/unit/planChecks.test.ts`, the compiler's engine tests; and `src/engine/schemas.ts`, `src/pobLuaBridge.ts` and `tests/integration/contract.test.ts` where a Lua reply changes]
- produces: [§3.2's schema 3 (`claims[].kind`, `items.anoint`); §3.6's anoint write and `compile_check` refusals, reference hits from the data, record `measures` and key-figure lines; `buildSha1` without the ledger (D-352)]
- consumes: [C-31, C-33, C-35 (`enemies/arbiter-of-divinity.json`, the map-monster and waystone data), C-41]
- acceptance: [AC-P60, AC-P61, AC-P62, AC-P63, AC-P64, AC-B3, AC-B4, AC-B5]
- milestone: M-15
- risk: medium
- summary: Schema 3, the anoint, `measures`, the reference hits, the key-figure lines, `buildSha1` without the
  ledger and `plan-reference.md` (D-351, D-352, D-353, D-356, D-358). Its `Compile.lua` and `v1.ts` changes come first; WU-66 follows on both.

### WU-66: `tree-shape` and the path tools
- status: target (M-15)
- kind: build
- depends-on: [WU-65 (`Compile.lua`, `v1.ts`)]
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Compile.lua` (`check_tree`, :182-285), `src/plan/checks/v1.ts` (`tree-shape`), `src/services/treeService.ts` (:292-413, `find_path_to_node` and `get_nearby_nodes`; slice 01 §2.11), their engine tests]
- produces: [§3.7's `tree-shape` (D-360); the path tools' tree validity (slice 01, AC-K66)]
- consumes: [C-41, §3.6 step 5; the pinned tree's start and exit links]
- acceptance: [AC-P65, AC-K66 (slice 01)]
- milestone: M-15
- risk: medium
- summary: V1's `tree-shape` names the stage, the start and each tree's nodes; the path tools never path
  through an unallocated start and leave a start only while it holds no tree. Tools that follow PoB's own
  paths (`update_tree_delta`, `get_passive_upgrades`) are caught at compile. The rule holds whether or not
  the pinned PoB2 enforces it (it doesn't at v0.23.1).

### WU-67: `support-sockets` and its estimated table
- status: target (M-15)
- kind: build
- depends-on: [WU-66 (`v1.ts`)]
- role: backend-dev
- touches: [`src/plan/checks/v1.ts` (`support-sockets`), `data/campaign/gems.json` (the estimated table), `tests/unit/planChecks.test.ts`]
- produces: [§3.4's estimated table and §3.7's `support-sockets` (D-359)]
- consumes: [C-35 (`campaign/gems.json`, `campaign/areas.json`), §3.7]
- acceptance: [AC-P66]
- milestone: M-15
- risk: low
- summary: No source has the thresholds (Q1), and PoB2 has no rule; the table is the user's estimate, a
  `judgment` fact at confidence L. Item-granted groups and a gem's own group are never flagged.

### WU-68: `guide_run`'s views
- status: target (M-15)
- kind: build
- depends-on: [WU-65]
- role: backend-dev
- touches: [`src/handlers/planHandlers.ts` (the views), `src/server/toolSchemas.ts` (`guide_run`'s schema and description), the README tool table (regenerated with `pnpm build && pnpm docs:tools --write`), `tests/fixtures/tool-calls.json`, the `guide_run` tests]
- produces: [§3.8's views (D-356)]
- consumes: [C-50; WU-65's key figures; the fifteen-stage fixture]
- acceptance: [AC-P67, AC-B2, AC-B3]
- milestone: M-15
- risk: low
- summary: Narrow views of the plan and the record, each under Read's 25K-token cut-off, so the long agents
  stop paging `plan.json` (run A's agents read it 130 times, 116 of them partial reads) and Grepping the
  record. Slice 3's WU-69 builds on it. No tool is added, so the counts stay 84 and 83.

## 6. Acceptance criteria

"Engine-required" tests use `engineDescribe` over `startSessionFixture`: the real server in process, real
luajit, the real bridge with C-5 validation. Every test uses temp builds, state and guides folders and no
network (D-34). A "Lua query" is a `__test_eval` call, with test actions on. "The fixture" is
`tests/fixtures/plans/two-stage/plan.json`, copied into a run folder made by `guide_run {new_run}`.

**Compile-time spike (WU-30)**

- **AC-P1 (WU-30).** Script check. The report at the WU-30 path holds the machine, pin and method; the
  synthetic plan's shape as specified; a time for each of the 15 stages in each of 3 runs; each run's
  whole-call, export and snapshot times; the probe source as an appendix; and a decision line.
- **AC-P2 (WU-30, HG-13, D-229).** The decision follows the rule. If every run's whole call is ≤ 100 s and
  every stage request < 20 s, the report says "S1 confirmed" (A-P8). Otherwise the unit ends
  `blocked:needs-human` citing HG-13, and WU-41 doesn't start.

**Guides root (WU-37)**

- **AC-P3 (WU-37).** Unit, `entryDefaults.test.ts`. `{POB_DIRECTORY:'/x/PoB/Builds'}` gives
  `guidesDirectory` `/x/PoB/Guides`, as does adding `POB_GUIDES_DIRECTORY:''`; `POB_GUIDES_DIRECTORY:'/g'`
  gives `/g`; neither set gives `<home>/Documents/Path of Building (PoE2)/Guides`. `processGlobals.test.ts`
  stays green.
- **AC-P4 (WU-37, AC-B6).** Unit. `process.env.POB_GUIDES_DIRECTORY` is an existing directory under
  `os.tmpdir()` named `pob2-mcp-test-guides-*`; `spawnServerEnv().POB_GUIDES_DIRECTORY` and
  `startTestServer().deps.guidesDirectory` equal it; `startSessionFixture()` uses `<tmp>/guides` in deps
  and env; no test's guides path starts with `/mnt/`.
- **AC-P5 (WU-37, R-30).** Unit with real temp dirs. `resolveInGuidesRoot` accepts `a/b/plan.json` and a
  symlink inside the root pointing inside. It rejects, with a message naming the argument: `''`, `a\0b`,
  `/etc/x`, `../x/plan.json`, `a/../../x`, `a\..\..\x`, a file symlink pointing outside, and
  `link/plan.json` where `link` is a directory symlink pointing outside.
- **AC-P6 (WU-37).** Unit, `createRunFolder` with date 2026-10-07. On an empty root it creates and returns
  `titan-blood-hunt/2026-10-07-1`; a second call returns `-2`; with `-1` and `-3` present, `-4`; another
  date gives `-1`. The slugs `''`, `Titan`, `a/b`, `..`, `a--b`, `-a` and a 65-character slug are rejected,
  creating nothing. `<root>/<slug>` as a symlink to a folder outside is rejected, creating nothing outside.
- **AC-P7 (WU-37).** Static, `readme.test.ts`. The README env table has a `POB_GUIDES_DIRECTORY` row
  stating the default, `Guides` beside the builds folder.

**Plan schema and ledger (WU-38)**

- **AC-P8 (WU-38).** Unit. `validatePlan` accepts the fixture, and the `json` block under "Worked example"
  in `plan-reference.md` parses and deep-equals it.
- **AC-P9 (WU-38).** Static, `planReference.test.ts`. The field paths of `zodToJsonSchema(planSchema)`
  (`.key` for object keys, `[]` for arrays) equal, as a set, the paths in the reference's field table.
- **AC-P10 (WU-38, D-163).** Unit, `planSchema.test.ts`. Each row is one case: the fixture with one change
  gives `ok:false` with an error at exactly that path.

  | Change | Error path |
  |---|---|
  | `schemaVersion: 3` (version 2 since WU-61; D-320, D-332) | `schemaVersion` (the only error, even with other faults present; it lists `[1, 2]`) |
  | `ledger` removed | `ledger` |
  | an unknown top-level key `foo`; text that isn't JSON | `$` (each) |
  | `stages[1].level: 0` | `stages[1].level` |
  | `stages[0].id: "a b"`; stage 1 given stage 0's id | `stages[0].id`; `stages[1].id` |
  | a `loadoutName` without `(L<level>)` | `stages[0].loadoutName` |
  | `variant` without `ascendancyPoints` | `stages[1].ascendancyPoints` |
  | `chaosResistException` on a stage without `variant` | `stages[0].chaosResistException` |
  | an `external` tag without `accessed` | `stages[0].claims[0].source.accessed` |
  | `external-unavailable` with another `ref` | `stages[0].claims[0].source.ref` |
  | a `judgment` tag without `confidence` | `stages[0].claims[0].source.confidence` |
  | stage 1's `skills.main.group` differs | `stages[1].skills.main.group` |
  | a `set1` node not in `nodes` | `stages[0].tree.weaponSetNodes.set1[0]` |
  | an earned entry that is on, with no producer | `stages[0].config.earned[0].producer` |
  | an option in both `earned` and `scenario` | `stages[0].config.scenario[0].option` |
  | no `enemyIsBoss` in `scenario` | `stages[0].config.scenario` |
  | an `ok` price with `amount: null` | `prices[0].amount` |
  | formula `1.CombinedDPS +`; formula `zz.Life` | `ledger[0].formula` (each) |
  | a claim citing `ledger:nope`; a claim citing `price:nope` (D-237) | `stages[0].claims[0].source` (each) |
  | `league: null` while a price is `ok` (D-233) | `league` |
  | `progress: "act1"` (D-214) | `stages[0].progress` |
  | a group without `role` (D-217) | `stages[0].skills.groups[0].role` |
  | `rolledGroup` naming a group without the rolled skill; a variant stage without `rolledGroup` (D-217) | `stages[1].skills.rolledGroup` (each) |
  | two prices with the same `id` | `prices[1].id` |
- **AC-P11 (WU-38, D-170).** Unit, `ledger.test.ts`. Values: `1+2*3` → 7; `(1+2)×3` → 9; `10 ÷ 4` → 2.5;
  `-2 - -3` → 1; `2.5e3` → 2500; `−x` with input `x = 4` → −4; `1.Life / 2.Life` with outputs {1: Life 100,
  2: Life 400} → 0.25. Errors: `2 +` → `syntax` at column 3; `(1` → `syntax`; `y` → `unknown-input`;
  `9.Life` → `unknown-stage`; `1.NoSuch` → `unknown-output`; `1/0` → `division-by-zero`.
- **AC-P12 (WU-38).** Static, `planNoEval.test.ts`. No file under `src/plan/` contains `eval(`,
  `new Function` or `Function(`, and its imports are relative modules, node builtins and `zod` only.

**C1 and E1 data (WU-39)**

- **AC-P13 (WU-39).** Unit, `referenceData.test.ts`. The loader loads `data/` with no error, and every
  fact-id group in §3.4's table exists. Spot values: `passive-points.max` 123 (H), `.martyr` 1 (M);
  `ascendancy.max` 8; `resistance-penalty.endgame` −60; `order` starts with `start`, ends with `endgame`,
  and has one key per `QuestRewards.lua` row, each derived from its row as A-P13 says, all distinct
  (D-214); the books total 24 passive and 24 weapon-set points; Spirit
  totals 100; the Arbiter's `res.lightning` is 45 with patch `0.5.5`, its three `fight-life.*` facts are
  all L, and `hits.volatile-explode` is `{min:1323, max:3969}`, type lightning.
- **AC-P14 (WU-39).** Static, `referenceData.test.ts`. `life.by-level` and `damage.by-level` equal the
  tables parsed from the pinned `Data/Misc.lua:7` and `:9` at all 100 levels. Every `pob-data` source ref
  names a file that exists in the pinned `vendor/` tree.
- **AC-P15 (WU-39).** Engine-required, `questKeys.test.ts`. The set of `q.*.pob-config-key` values equals
  the set of `get_config` option keys starting with `quest`, on a new build.
- **AC-P16 (WU-39).** Unit, with a temp data dir. A fact without `patch` gives an error naming
  `campaign/limits.json` and the fact id. An unknown source id gives an error naming the file and the id.
  Invalid JSON gives an error naming the file.
- **AC-P17 (WU-39, D-214, D-232).** Unit. `validatePlan` with an unknown `progress` gives an error at
  `stages[0].progress`, and a claim citing `data:campaign/limits.json#nope` or `data:nope.json#order`
  gives an error at `stages[0].claims[0].source`. The committed fixture and the reference's worked
  example pass with the reference data loaded.
- **AC-P18 (WU-39, D-168).** Static. No string fact value, note or source ref of 12 or more characters
  occurs inside a string literal of `src/**/*.ts` (extracted as `cruftScan.ts` does). AC-B2's scans pass
  with empty waivers.

**Import code (WU-40)**

- **AC-P19 (WU-40).** Unit, `buildCode.test.ts`. `decodePobCode(encodePobCode(golden))` is byte-equal to
  the golden XML. The code matches `^[A-Za-z0-9_=-]+$` and equals the former test encoder's output.
- **AC-P20 (WU-40).** In-process, no engine, `encodeBuildCode.test.ts`. `encode_build_code
  {build_name:"grenadator"}` returns a code that decodes to the file's bytes, and `session.enginePid()`
  stays `null`. `../x`, `nosuch`, and a file with a `<PathOfBuilding>` root (the text names the root) are
  `isError`. `TOOL_META.encode_build_code` is `{engine:'none', group:'core'}`.

**Compiler (WU-41).** Engine-required, in `compilePlan.test.ts` unless stated otherwise.

- **AC-P21 (WU-41, M-11, D-156).** A final compile of the fixture with `build_name:"m11-two-stage"` isn't
  `isError`; its text names both loadouts with their levels, and both paths written. The builds folder
  holds `m11-two-stage.xml`, whose `<Build>` has `level` = the highest stage level and
  `characterLevelAutoMode="true"`. `compile-record.json` is beside the plan, with an `elapsedMs` per stage.
  A `lua_get_build_info` sent mid-compile starts only after the compile's `end` event (`session.onEvent`):
  one lock for the whole call.
- **AC-P22 (WU-41, M-11, D-215).** After `lua_load_build {build_name:"m11-two-stage"}`, `manage_sets
  {set_type:"loadout", action:"list"}` lists exactly the two `loadoutName`s: loadout count = stage count,
  and no loadout, tree spec or set of any type is titled `Default`. Tree spec 1 and item, skill and config
  set 1 carry stage 1's titles. After selecting each loadout, a Lua query shows active tree, item, skill
  and config set titles equal to the record's `sets` entries for that stage. The item set title ends with
  `{1,2}`; the two skill sets are distinct.
- **AC-P23 (WU-41, M-11, D-138).** In the reloaded build, select stage 1's loadout, set its level with
  `set_character_level`, then call `lua_get_stats {}`: its `Life` and `CombinedDPS` lines equal the
  record's `stages.1.outputs` values within relative 1e-9. (A breakdown field would be read with C-45's
  `lua_get_stats {breakdown:true}`.) Each stage's record `level` is its plan level, and the two stages'
  `outputs.Life` differ.
- **AC-P24 (WU-41, M-11, D-180, D-215).** `record.importCode` decodes to the file's bytes, whose `<Build>`
  has `level` = the highest stage level and `characterLevelAutoMode="true"`. After `import_build
  {source:<record.importCode>}`, the loadout list and each type's set titles match the file, a Lua query
  shows `characterLevelAutoMode` true, and loadout count = stage count = 2, none titled `Default`. The
  post-load level isn't asserted: the load doesn't pass `keepLevel`, so PoB re-estimates an auto-mode
  level.
- **AC-P25 (WU-41, C-32).** For each stage, on the compiled build before any reload, a Lua query of its
  config set's `input` holds every listed option with its listed value, and every config set holds
  `enemyIsBoss`. (After a reload, an explicit value equal to its placeholder is absent from the XML, so
  `input` lacks it, D-212.)
- **AC-P26 (WU-41, D-162).** Defect variants of the fixture, one defect each in stage 2: an unknown gem
  (the text lists suggestions); item text with no base; node id 999999; a disconnected node; a weapon-set
  tag on an unlisted node; an attribute choice on a non-attribute node; an unknown config option. Each
  gives `isError` naming stage `2` and the defect; a variant with defects in both stages names both. In
  every case the builds folder's names and sha1s, the run folder's listing, `session.revision` and the
  canonical export are unchanged.
- **AC-P27 (WU-41, D-163).** A plan with `stages[1].level: 0` gives `isError` containing
  `stages[1].level`. The canonical export and `revision` are unchanged, and nothing is written.
- **AC-P28 (WU-41, D-167, D-216, A-P12).** Engine-required, `guideRun.test.ts`. With `grenadator`
  loaded, `guide_run {validate:<the fixture's plan_path>}` returns `… is valid: 2 stages (1, 2).`; the
  canonical export and `revision` are unchanged, a Lua query shows the loaded build's config-set count
  unchanged (the preflight creates no set, review S21), and the run folder holds only `plan.json`. An
  invalid plan gives `isError` with paths; `stages:["zz"]` gives `isError` naming `zz`; a stage-2 unknown
  gem gives `isError` naming stage `2` and the gem, with the export and `revision` unchanged.
- **AC-P29 (WU-41, D-208).** `measure_only` writes `compile-record.json` and `compiled-build.xml` beside
  the plan, and the builds folder's names, sizes and sha1s are unchanged. `pobFile` is
  `{location:"run"}` with a guides-relative `path` and the XML's sha1; `importCode` decodes to the XML's
  bytes. With `build_name` added, the call is `isError` and writes nothing.
- **AC-P30 (WU-41, D-207, D-210, D-216).** `guideRun.test.ts`. On a fresh server, `guide_run
  {new_run:"titan-blood-hunt"}` returns an absolute path under the fixture's guides dir,
  `titan-blood-hunt/<today>-1/plan.json` and `loadedBuildUnsaved: false`; the folder exists;
  `session.enginePid()` is still `null`, and `session.onEvent` saw no event (no lock taken). A second call
  gives `-2`. Engine-required part: after `lua_load_build {build_name:"grenadator"}` and a
  `set_character_level` call, the reply has `loadedBuildUnsaved: true` and names `grenadator`, and the
  canonical export and `revision` are unchanged by the call. `new_run:"../x"`, and `new_run` together with
  `validate`, are `isError` and create nothing.
- **AC-P31 (WU-41, D-199, D-211, C-17).** A second final compile to `m11-two-stage` succeeds, leaving a
  backup under `<stateDir>/backups/`. `build_name:"grenadator"` (an existing file with no ledger entry)
  gives `isError` "already exists", file unchanged. The changed-on-disk cases are AC-P46.
- **AC-P32 (WU-41, AC-B8, D-155).** These `plan_path`s give `isError`, and nothing is written in any
  folder: `../outside/plan.json`; an absolute path; `link/plan.json`, where `link` is a symlink to a folder
  outside the guides root that holds a valid plan.
- **AC-P33 (WU-41, C-33).** The fixture's ledger entry `2.CombinedDPS / 1.CombinedDPS` has a record value
  equal to the ratio of the record's outputs. A variant using `2.NoSuchOutput` gets `value: null` and an
  `unknown-output` error naming it, and the call isn't `isError`.
- **AC-P34 (WU-41, A-P8).** `{measure_only:true, stages:["2"]}` gives `stagesCompiled ["2"]`, only stage 2
  under `stages`, an XML with one loadout, and a ledger value `null` with `stage-not-compiled`.
  `{build_name, stages}` gives `isError`.
- **AC-P35 (WU-41, D-165).** With test actions on, a variant with `__crashForTest` at stage 2 gives
  `isError` containing "The engine stopped while running `compile_plan`", and writes no file: the builds
  folder, the run folder and the write ledger are unchanged. Step 6 dropped the snapshot, so recovery
  takes C-3's no-snapshot path: the next `lua_get_build_info` is `isError` with "the loaded build could
  not be restored". A measure-only compile of the unmodified fixture then succeeds.
- **AC-P36 (WU-41, D-165).** Two measure-only compiles of the fixture in one server give records equal
  except `compiledAt`, `timing`, `elapsedMs`, `pobFile.sha1`/`bytes` and `importCode`, and
  `canonicalize(xml1) === canonicalize(xml2)` (exports needn't be byte-stable, stab slice 02 §1).
- **AC-P37 (WU-41, NFR-20, NFR-21, D-229, review S17).** Engine-required, `compilePlanNfr.test.ts`, test
  timeout 150 s. A final compile of the fifteen-stage fixture takes ≤ 100 s of wall time, with
  `timing.totalMs ≤ 100000` and every `stages.*.elapsedMs < 20000`. The file runs only in the `mise run
  test` task's separate `--runInBand` step: `pnpm exec jest --listTests` (the main run's selection) doesn't
  list it, the step's command with `--listTests` lists exactly it, and `mise.toml`'s `test` task holds
  that step as its own `run` entry, after `pnpm test`, with no `|`.
- **AC-P38 (WU-41, D-216).** `TOOL_META.compile_plan` is `{engine:'load', group:'core'}` and
  `TOOL_META.guide_run` is `{engine:'read', group:'core'}`; `compile_plan`'s schema has no `new_run` or
  `validate_only` property. In `engineKinds.test.ts` the measure-only sample changes the export and adds
  exactly 1 to `revision`; `guide_run`'s `new_run` and `validate` samples leave both unchanged. AC-B1
  holds at 84/83 and AC-B4 for the three Lua actions. Static: `Compile.lua` contains no `CopyLoadout`.

**Checks (WU-42)**

- **AC-P39 (WU-42, M-11).** A final compile of the fixture records `v1.pass` and `v2.pass` true for both
  stages, with empty `findings`.
- **AC-P40 (WU-42, D-108).** Engine-required, `planChecks.test.ts`. Each row is a measure-only compile of a
  fixture variant. The call isn't `isError`, and the stage's `v1.findings` holds the code shown (with that
  data).

  | Variant | V1 result |
  |---|---|
  | stage 1 has one regular node more than (level − 1) + its book points | `passive-points` (used, allowed) |
  | stage 1 tags more `set1` nodes than its weapon-set points | `weapon-set-points` |
  | stage 1 has 4 ascendancy nodes before trial 2 | `ascendancy-points` |
  | a variant stage with `ascendancyPoints: 6` and 8 nodes allocated | `ascendancy-points` |
  | an Act 1 stage holds a tier-7 skill gem | `gem-availability` (gem, tier, max) |
  | stage 2 (where uncut level 7 is available) holds Blood Hunt, tier 7, at gem level 5; then at gem level 7 | `gem-below-tier` (gem, tier 7, level 5, `fact: "tier-rule"`) and no `gem-availability`; at gem level 7, neither (D-259) |
  | Blood Hunt at gem level 15 in a level-40 stage | `gem-level-requirement` (64, pin `Data/Skills/act_dex.lua:318-338`) |
  | an item requiring a level above the stage's | `item-level-requirement` |
  | a gem whose Str requirement exceeds the stage's Str | `attributes`, plus a `pob-warning` with PoB's "You do not meet the Strength requirement" line |
  | `resistancePenalty: -60` at an Act 2 progress point | `resistance-penalty` |
  | stage 2 drops a stage 1 node with no `respec` | `tree-continuity` |
  | the same, with `respec.dropped` naming it | no finding |
  | `set2` has fewer tagged nodes than `set1` | no finding; PoB's "Weapon set 2 passives available" line is in `pobWarnings.filtered` |
- **AC-P41 (WU-42, D-114).** As AC-P40, for `v2.findings`:

  | Variant | V2 result |
  |---|---|
  | an earned entry, on, whose producer gem `Herald of Ice` the stage lacks | `producer-absent` |
  | producer name `Not A Gem` | `producer-unknown` |
  | the same option at `false`, with no producer | no finding |
  | scenario `source.file` is `data/enemies/nope.json`; scenario `key` is `res.nope` | `source-unresolved` (each) |
  | an Act 1 stage lists Act 3's +30 Spirit quest option as `true` | `quest-not-reached` |
  | an active toggle on an empty `Flask 1` | `toggle-empty` |
- **AC-P42 (WU-42, C-32, A-P4, D-212, D-230).** For a variant whose stage 1 lists only `enemyIsBoss`,
  with an empty baseline list injected, the `default-unlisted` options equal, as a set, the union of:
  the options on by default as a Lua query of `ConfigOptions`' defaults loop (`defaultState`,
  `defaultIndex`) computes them, minus `enemyIsBoss`, each with `data.origin:"default"`; and the stage's
  placeholder-driven options (§3.7's rule, applied by a Lua query to its config set's `input` and
  `placeholder` tables after the compile), each with `data.origin:"placeholder"`. They include every
  quest-reward checkbox (`ConfigOptions.lua:73-82`), `resistancePenalty`, `enemyLevel` and the four enemy
  resistances. Listing them all, off or with a C1/E1 source, clears those findings, and so does the
  committed `data/config-baseline.json` for each option it lists. Static, same file: every option the
  committed list names is a `ConfigOptions` var, and every rationale is one non-empty line.
- **AC-P43 (WU-42, A-29).** A stage relying on `trial.3` passes, with a note naming `trial.3` and
  confidence M. An `endgame` stage with 124 regular points passes, with a note naming
  `passive-points.martyr` (M).
- **AC-P44 (WU-42, D-192).** A final compile whose stage 1 has a V1 finding still writes the PoB file and
  the record, and the text shows `V1 fail` with the finding.

**Added by the review fixes (WU-41, WU-42).** Engine-required unless stated otherwise.

- **AC-P45 (WU-41, D-211).** `compilePlan.test.ts`. A final compile of the fixture to `m11-two-stage`,
  then a measure-only compile of the same plan (its record now has `pobFile.location:"run"`), then a
  final compile to `m11-two-stage` again: the third call succeeds and leaves a backup under
  `<stateDir>/backups/`. `<stateDir>/guide-writes.json` then has exactly one entry for
  `m11-two-stage.xml`, whose `sha1` is the new file's and whose `runFolder` is the fixture's run folder;
  the measure-only compile left the ledger byte-identical. A copy of the plan in a second run folder,
  compiled to `m11-two-stage`, gives `isError` "already exists", file and ledger unchanged.
- **AC-P46 (WU-41, D-211).** `compilePlan.test.ts`. After a final compile to `m11-two-stage`, the test
  rewrites the file through `fs` with other valid PoB2 bytes, as a user's editor would. Each of these then
  gives `isError` with C-17's changed-on-disk text, and leaves the file and the ledger unchanged: (a) a
  re-compile in the same server; (b) a re-compile after a `lua_get_build_info` has auto-reloaded the edited
  file (C-3's disk-change check, which refreshes the in-memory guard); (c) a re-compile on a second server
  started on the same builds, state and guides folders, i.e. after a restart, with no in-memory guard.
- **AC-P47 (WU-41, D-213).** `compilePlan.test.ts`: a variant whose stage 2 adds a node tagged `set1` and,
  beyond it, an untagged node connected to the tree only through it gives `isError` naming stage `2` and
  the untagged node, with nothing written and the export and `revision` unchanged; `guide_run {validate}`
  reports the same defect. Unit, `tests/unit/compileAllocation.test.ts`: `compareAllocation` given a
  stage reply whose `allocation` lacks one plan node, holds one extra node, or tags one node `2` where the
  plan tags it `1`, returns a defect naming that node and the stage; given an equal allocation, none.
- **AC-P48 (WU-41, D-220).** `guideRun.test.ts`, with real temp dirs. On servers whose guides root is the
  builds folder itself, a folder inside it, its parent, or a symlink resolving inside it, `guide_run
  {new_run:"x"}` and a measure-only `compile_plan` are each `isError` naming both paths, and nothing is
  created or written anywhere. A sibling guides root (the default layout) works.
- **AC-P49 (WU-41, D-221).** `compilePlan.test.ts`. With the engine already started (a prior
  `lua_get_build_info`), a pass-through `jest.spyOn(PoBLuaApiClient.prototype, 'request')` records the
  actions sent between a call's `start` and `end` events (`session.onEvent`). A final compile of the
  fixture sends exactly 2 + 5 requests: `compile_check`, `new_build`, `compile_stage` twice,
  `compile_finish` and `export_build_xml` twice (the compile's export, then C-3's snapshot). A measure-only
  compile with `stages:["2"]` sends 1 + 5. `guide_run {validate}` sends exactly one, `compile_check`.
- **AC-P50 (WU-42, D-212, D-230).** `planChecks.test.ts`. In the fixture's final record, each stage's
  `configEffective` holds: every option the stage lists, with `origin:"explicit"` and class `earned` or
  `scenario`; every default-on option it doesn't list, with `origin:"default"`; and every
  placeholder-driven option it doesn't list, with `origin:"placeholder"` and a value equal to a Lua query
  of that config set's `placeholder` entry after the compile. An unlisted option's class is `baseline`
  exactly when `data/config-baseline.json` lists it, else `unlisted`.
  - That class rule predates D-250 and D-252 (§3.7). It holds for this fixture, which has no boss stage;
    AC-P42 tests the amended rule.
  - A variant that sets `enemyLevel` explicitly to its placeholder value keeps it in `configEffective` with
    `origin:"explicit"`. PoB's own `SaveDB` leaves `<Input name="enemyLevel">` out of that config set, and
    the written file has it (D-248).

**Count and custom modifiers (WU-51, WU-55; built, D-293).** Engine-required unless stated otherwise.

- **AC-P51 (WU-55, D-293).** Unit, `tests/unit/planChecks.test.ts`. A group with `count` above 1 and no
  `countReason` gives a V1 finding on that stage, so `v1.pass` is false; with a `countReason`, no finding.
  This is a V1 finding, not a schema error (D-322), and WU-55 names its code. A group
  without `count` counts as 1. A `count` of 0, or one that isn't an integer, is a schema error at its path.
- **AC-P52 (WU-55, D-293).** Unit, `tests/unit/planChecks.test.ts`. A `customMods` entry without a `reason`
  gives a V1 finding on that stage; with one, no finding. A plan without `customMods` is valid.
- **AC-P53 (WU-55, D-293).** A group with `count` n records its hit figure × n and a stacking
  damage-over-time figure × n. A non-stacking damage-over-time figure stays unchanged (PoB's rule,
  `Modules/Calcs.lua:342-411`). The raw figures stay as they were.
- **AC-P54 (WU-55, D-293).** Each `customMods` entry reaches PoB's `customMods` option, one line per entry,
  written after the stage's config options.
- **AC-P55 (WU-55, D-293).** Every record figure computed while a custom modifier was present is marked,
  defences included; a stage without one has no mark.
- **AC-P56 (WU-55, D-293, D-337).** The final PoB file sets `groupCount` (the plan's `count`) and
  `includeInFullDPS` on the named source's groups only, and so does a measure-only compile's XML (D-337).
- **AC-P57 (WU-51, D-293, NFR-21).** Script check. The report at the WU-51 path gives the compile cost of
  the fifteen-stage fixture with Full DPS on for the named source's groups only, and a decision line. Within
  NFR-21, the final compile computes Full DPS; otherwise the flags are written at export only. **Met**
  (`9f74ad9`): within NFR-21 (×1.14, at most 3.08 s per stage), so the compile computes it.

**Entering maps and the ladder (WU-61; built, D-281, D-282)**

- **AC-P58 (WU-61, D-281).** Unit. `validatePlan` accepts a stage with `variant: "entering-maps"` and the
  variant fields (`ascendancyPoints`, `variantBasis`, `rolledGroup`).
- **AC-P59 (WU-61, D-282).** Unit, `tests/unit/planChecks.test.ts`. V1's `tree-continuity` uses one track:
  `m` from the last campaign stage, `b` from `m`, `n` from `b`. A rung that drops its predecessor's node
  without `respec` gets a `tree-continuity` finding on that rung. As built, the ladder goes by rung whatever
  the plan order (a plan listing `m` after `b` is still checked `m` → `b` → `n`), and a rung the plan lacks
  is skipped.

**Amendment 4 (WU-65…WU-68; target, M-15).** Copied from amendment 4 §15; AC-K66 is in slice 01.

- **AC-P60 (WU-65, D-351, D-358).** Unit. `validatePlan` accepts `schemaVersion` 3 with `claims[].kind` and an
  `items.anoint` on `b` and `n`, refuses one on `m` or a campaign stage, and still accepts version 2.
- **AC-P61 (WU-65, D-358).** Engine. A recipe notable's anoint compiles, its stats move, and the record gives its
  three emotions; a notable without a recipe, an allocated one, or no amulet gives `isError` naming the stage.
- **AC-P62 (WU-65, D-353).** Engine. `measures.arbiter` has a row per damage type and mixed hit (hit, max hit,
  ratio, verdict); a fixture whose physical max hit is below the slam reads `one-shot`.
- **AC-P63 (WU-65, D-353).** Engine. `dps` and `ehp` equal the headline and `TotalEHP`; `clearSpeed` follows
  D-353 on a fixture per band and per step; a plan without reference hits gets D-256's whole numbers.
- **AC-P64 (WU-65, D-356).** Engine. `compile_plan`'s reply has a key-figure line per stage.
- **AC-P65 (WU-66, D-360).** Engine, on run A's shapes: two trees off one Ranger start, a Sorceress tree without
  12795, and an ascendancy node cut off from 1583 each give `tree-shape`; a class tree plus a Sorceress tree with
  12795 passes.
- **AC-P66 (WU-67, D-359).** Unit. With the estimated table in `gems.json`, `support-sockets` flags a
  tree-granted group over the ceiling at levels 39, 40 and 60 (one more support than allowed), never an
  item-granted group or a gem's group.
- **AC-P67 (WU-68, D-356).** Engine. On the fifteen-stage fixture, the views return one stage's section with its
  key figures, and every claim compact, each under 25K tokens.

## 7. Test strategy and migration (this slice)

- **Test classes.** Unit: guides paths, schema and error paths, ledger, loader, encoder, the allocation
  comparison (real temp dirs for filesystem cases). Static: the reference against zod, no `eval`, C1/E1
  strings out of `src/`, E1 tables against the pin, no `CopyLoadout`, the README env row, the baseline
  list, the NFR step in `mise.toml`. Engine-required, in process across the real TS↔Lua seam through
  `engineDescribe`: the compile, `guide_run`, write-ledger, check, quest-key and NFR criteria, plus
  `contract.test.ts` cases for the three Lua actions.
- **The M-11 exit** is the spine's (§7): every AC-P of M-11's units green (AC-P1…AC-P50), the hand-written
  two-stage fixture compiling, reloading and round-tripping (AC-P21…AC-P24, AC-P39), AC-P37 for NFR-20 and
  NFR-21, and AC-B6 and AC-B8. M-11 is met (`../worklog.md:314`).
- **M-14** ("open builds offline", D-315, spine §7) needs this slice's WU-51, WU-55 and WU-61 merged
  (D-315). AC-P51…AC-P59 green at the last merge is part of the exit the coordinator added (PROPOSED,
  2026-10-10; spine §7).
- **M-15** ("the lean pipeline offline", D-361, spine §7) holds this slice's WU-65…WU-68, with AC-P60…AC-P67:
  unit tests for AC-P60 and AC-P66, engine-required tests for the rest. Its exit is slice 3's lean run
  (WU-72).
- **Regression.** Golden values (AC-B5), `engineKinds.test.ts`, the hygiene test and the static scans stay
  green with empty waivers; only the count literals move (AC-B1).
- **Migration.** None. Everything is additive: a new env var with a default, new tools, new `data/` files,
  new Lua modules, the write ledger in the state dir, and a separate NFR step in `mise run test`. Roll back
  by reverting a unit. `schemaVersion` bumped once, to 2, with WU-61 (§3.2), and `recordVersion` once, to 2,
  with WU-55 (§3.6). Version-1 plans stay accepted (D-332). *Target (WU-65):* `schemaVersion` 3, with version
  2 still accepted (AC-P60); the record gains `measures`, additively.

## 8. Open items (holes in the inputs)

All four were resolved by the coordinator on 2026-10-07:
1. HG-13's margin: every per-stage request under 20 s, and ≤ 100 s for 15 stages (D-229; AC-P2, AC-P37).
2. Neutral default-on options, such as `multiplierCurrentManaPercentage` at 100: the `baseline` subclass
   and `data/config-baseline.json` (D-230; §3.7, AC-P42).
3. Spirit-gem availability: V1 notes Spirit gems instead of checking them (A-31).
4. Respec gold costs: `goldCost` carries `judgment` tags (A-32).

The fold of 2026-10-10 settled these, by the user's ruling (D-315) or the coordinator's (the rest, proposed
and binding until the user overrides them):

5. **The milestone** (D-315). This slice's new units, WU-51, WU-55 and WU-61, belong to M-14, "open builds
   offline" (§7).
6. **Schema version** (D-320, D-332, §3.2). One `schemaVersion` bump covers `count`, `countReason`, `customMods`
   (optional) and `entering-maps`. The first of WU-61 and WU-55 to merge makes it; the second extends the
   same, unreleased version. Version-1 plans stay accepted after the bump (D-332; PROPOSED by the
   coordinator, 2026-10-10). The new fields are optional with defaults: `count` 1, no `customMods`, no
   `entering-maps` variant. So recorded runs' plans still validate and compile. **Built:** WU-61 made the
   bump; a version-1 plan that uses a version-2 field is an error (D-332).
7. **The record's Count fields** (D-321, §3.6).
   - The raw figures stay, and new fields beside them hold figure × count.
   - A mark flags the figures computed with custom modifiers, and `recordVersion` bumps.
   - The verdict line and the headline read the named source's Count-scaled figure, with `TotalEHP` beside
     it (D-294).
   - WU-55 names the fields.
8. **The reason checks** (D-322). A missing `countReason` (when `count` isn't 1), or a `customMods` entry
   without a reason, is a V1 finding, not a schema error (AC-P51, AC-P52).
9. **`buildSha1`'s projection** (D-328, §3.6). It also strips `config.scenario[].source` and
   `respec.goldCost.source`. That is intended: it tracks build content, and sources and tags are citations.
10. **S-N2's plan** (D-329). WU-51 measures the fifteen-stage fixture (AC-P57). Done: ×1.14.
11. **The unverified league** (D-330, §3.2). `"league": "unverified"` (D-313) is the convention for an
    online run that can't reach the trade site; an offline run's league stays null (D-233).

The fold of 2026-10-11 (v1.4) adds:

12. **Full DPS in every compile** (D-337, PROPOSED by the coordinator, 2026-10-10; §3.6 steps 7 and 9).
    S-N2 showed Full DPS on the named groups cheap, so measure-only compiles compute it too; D-306 holds
    for the other groups.
13. **The ladder's as-built rules** (D-282; §3.7): by rung whatever the plan order, the first rung after
    the last campaign stage, `respec.dropped` checked and the gold cost only by its schema (A-32).

The fold of 2026-10-11 (v1.5) adds amendment 4's decisions, accepted by the user with its answers:

14. **Claims and schema 3** (D-351, D-358; §3.2): `claims[].kind`, and the anoint on `b` and `n` only (Q5).
15. **The record's measures** (D-353; §3.6): DPS, EHP, the Arbiter verdict and a rough clear speed from the
    clear skill's area (Q2: no hits to kill), and the reference hits filled from the data.
16. **The key-figure lines and the views** (D-356; §3.6, §3.8).
17. **Support sockets** (D-359; §3.4, §3.7): an estimated table (Q1: 3 supports in Act 2, rising to 5 by the
    campaign's end), since no source has the thresholds.
18. **Tree validity** (D-360; §3.6, §3.7): one start exit per tree, one tree per start, the alternate start
    only while its node is allocated.
19. **Still open for the units:** the key-figure line's fields (WU-65, AC-P64) and the counter script's path
    (WU-64, slice 3); amendment 4 names neither. A view call's kind is not open: C-50's routing rule
    (`engineKindFor`, §3.8) makes every `guide_run` call but a `validate` call without `new_run` a `none`,
    so a view call is `none`.

Two V1 edge cases from the build are risks in the spine's register:
- Trial 1's progress key lets an end-of-Act-1 stage spend 2 ascendancy points, with no level check to
  catch it (R-38, `../worklog.md:201-202`).
- D-251 accepts only the two boundary values. So an area-60 interlude zone before the first interlude key
  is an edge case (R-39, `../worklog.md:338-339`).
