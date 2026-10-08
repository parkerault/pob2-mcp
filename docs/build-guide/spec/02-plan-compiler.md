# Slice 02: Plan and compiler (compile-time spike, guides root, plan schema, C1/E1 data, import code, compiler, V1/V2)

Part of the [build-guide spine](README.md). It covers work units WU-30 and WU-37…WU-42, acceptance criteria
AC-P1…AC-P44, and milestone M-11. When this slice and the spine disagree, the spine wins.

This slice turns a JSON build plan into one PoB2 file with a loadout per stage, plus a compile record (each
stage's numbers and check verdicts), a re-evaluated ledger and an import code. It also owns:
- the guides-folder root and the run folders the server creates;
- the C1 (campaign) and E1 (enemy) data files;
- the plan's offline-mode markers: the `external-unavailable` source tag and `unavailable` prices.

## 1. Existing system context (this slice)

Evidence is in recon §1–§5 and the pin grounding (pin §B, §C). Repo at `2758b02`, pin v0.23.1.

- **Entry and deps.** `entryDefaults(env)` (`src/index.ts:20-33`) computes `pobDirectory` and `stateDir`;
  `ServerDeps` is `src/server/createServer.ts:54-71`. Only the entry reads `process.env`
  (`tests/static/processGlobals.test.ts`).
- **Path confinement.** `sanitizeBuildName` and `canonicalBuildPath` (`src/utils/pathSanitizer.ts`) refuse
  NUL, absolute paths and `..`, but don't resolve symlinks. `isInside` and `realPathOf`
  (`src/services/buildExportService.ts:55-76`) do, for D-42's export rule. Neither knows a guides root.
- **Session and kinds.** `routeToolCall` (`src/server/toolRouter.ts:146-194`) runs every non-`none` tool in
  `session.run` under its static `TOOL_META` kind. A successful `load`/`mutate` call bumps `revision` and
  snapshots (C-3 step 6); a failed one changes neither. The ctx offers `newBuild` and `noteSaved`
  (`src/engine/session.ts:75-93`); `ctx.client` refuses raw `new_build`.
- **Writer.** `BuildFileWriter.checkBuildFile` runs C-17 steps 1–3 without writing
  (`src/services/buildFileWriter.ts:197`); `writeBuildFile({kind:'engine', ctx, guard})` writes and calls
  `noteSaved`.
- **Build code.** `src/utils/buildCode.ts:71-105` decodes only; encoders exist only in tests
  (`tests/integration/toolHygiene.test.ts:95`, `engineKinds.test.ts:49`). PoB's own export is base64 of the
  zlib-deflated `SaveDB` output with `+`→`-` and `/`→`_`, padding kept (pin `Classes/ImportTab.lua:133`).
- **Lua building blocks** (`pob-api/API/BuildOps.lua`): `new_build`, `create_spec`, `add_item_text`,
  `create_socket_group`, `add_gem` and `resolve_gem` (unknown gems rejected with suggestions),
  `set_flask_active`, `export_build_xml`; `set_config` with its key and value checks `config_options()` and
  `config_value()` (`:323-475`); `set_level`, which forces manual mode (`:175-190`); `get_warnings`, PoB's
  warning lines after `RefreshStatList` with the level put back (`:241-256`). Slice 1 (M-10) adds the set
  operations and the `set_level` auto flag (WU-35), tree state and jewel sockets (WU-36), and stat-set
  selection with the per-skill breakdown (WU-33).
- **PoB facts the compiler relies on.**
  - S-a's recipe (pin §C); `SyncLoadouts`' brace pattern `%{([%w,]+)%}`; `CopyLoadout` crashes on `{id}`
    names (pin §B1).
  - Config sets save only non-default inputs (`Classes/ConfigTab.lua:739`); a new set's `input` is filled
    from each option's `defaultState` or `list[defaultIndex].val` (`ConfigTab.lua:974-990`).
  - Quest-reward options are named `"quest"..Description..Area..Info`, and the checkbox ones default to on
    (`Modules/ConfigOptions.lua:73-82`); books have `useConfig = false`, so no option.
  - `ImportFromNodeList` silently skips unknown node ids (`Classes/PassiveSpec.lua:351-362`).
    `CountAllocNodes` is `PassiveSpec.lua:992-1017`; PoB's regular-point count is `PointsUsed − min(ws1,
    ws2)` (`Modules/Build.lua:1029`). Attribute nodes carry `isAttribute` (`Classes/PassiveTree.lua:548`).
  - PoB's warning lines are `Build.lua:1030-1055` and `:2148-2222`; only "You have N Weapon set 2 passives
    available" (`:1051-1055`) is informational.
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
  the call and the session recovers. The same plan compiles to the same result (D-165).
- **FR-P4.** The server writes only the run folders it creates under the guides root, files beside the
  compiled plan, and the target PoB file. The PoB file goes through `buildFileWriter`, and only in a run's
  final compile (D-155, D-177, D-207, D-208).
- **FR-P5.** Every check limit that depends on level or campaign progress comes from cited data files, not
  from PoB's defaults or code constants (D-108, D-168).
- **FR-P6.** No config value is left to PoB's defaults. Every option a stage lists is written; every option
  that is on by default and that the stage doesn't list is a finding (D-114, C-32).
- **FR-P7.** The ledger is re-evaluated from the record's numbers on every compile, without `eval` (D-170).
- **FR-P8.** The import code round-trips (D-145, D-180).

## 3. Contracts in detail

### 3.1 C-34: guides root and run folders (WU-37; the run-folder mode is wired by WU-41)

- **Root.** `entryDefaults` also returns `guidesDirectory`: `POB_GUIDES_DIRECTORY` when non-empty, else
  `path.resolve(pobDirectory, '..', 'Guides')` (D-154). `ServerDeps` gains `guidesDirectory: string`
  (C-7). Nothing is created at construction; only the run-folder mode creates the root (`mkdir -p`).
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
- **Version.** `schemaVersion` must be `1`. Any other value gives exactly one error, naming the accepted
  versions (`[1]`).
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
type Claim = { id: string; text: string; source: SourceTag | `ledger:${string}` };  // † the ledger id exists
type Plan = {
  schemaVersion: 1;
  roll: { className: string; ascendancy: string; skill: string };
  versions: { pobTag: string; pobCommit: string; treeVersion: string;
              enginePatch: string;        // the game patch the engine data targets
              externalPatch: string };    // the patch of the prices and boss data (D-107)
  league: string;
  stages: Stage[];                        // ≥ 1; plan order is progression order
  ledger: LedgerEntry[];
  prices: Price[];
};
type Stage = {
  id: string;                             // ^[A-Za-z0-9]+$, unique † (A-P1)
  loadoutName: string;                    // contains "(L<level>)", ends with " {<id>}", no other braces (A-P1)
  level: number;                          // integer 1–100
  progress: string;                       // a C1 progress key † (checked once WU-39 lands)
  variant?: 'budget' | 'non-budget';
  ascendancyPoints?: number;              // integer 0–8
  variantBasis?: { level: SourceTag; gemLevels: SourceTag; ascendancyPoints: SourceTag };
                                          // variant, ascendancyPoints, variantBasis: all or none † (D-193)
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
  };
  skills: {
    setTitle?: string;
    groups: { label?: string; enabled: boolean;
              gems: { name: string; level: number; quality: number; enabled: boolean }[] }[];   // ≥ 1 gem each
    main: { group: number; activeSkill: number; statSet?: number };  // 1-based; group equal in every stage †
  };
  config: {
    setTitle?: string;
    earned: { option: string; value: boolean | number | string;
              producer?: { kind: 'item' | 'gem' | 'passive' | 'skill' | 'flask' | 'charm'; name: string };
              uptime?: string }[];        // producer and uptime required when the value is on (A-P5)
    scenario: { option: string; value: boolean | number | string;
                source: { file: string; key: string };   // a C1/E1 file and fact key (§3.4)
                tag: SourceTag }[];       // the fact's tag, copied with its value (D-168)
  };                                      // an option appears once across both lists †; scenario holds enemyIsBoss † (A-P4)
  claims: Claim[];
};
type LedgerEntry = { id: string;          // ^[A-Za-z_][A-Za-z0-9_]*$, unique †
                     claim: string; formula: string;      // † parses; its REFs name an input or an existing stage
                     inputs: { name: string /* same pattern as id */; value: number; tag: SourceTag }[] };
type Price = { item: string; query: unknown; amount: number | null; currency: string | null;
               date: string /* YYYY-MM-DD */; league: string; status: 'ok' | 'unavailable'; note?: string };
               // † ok ⇒ amount and currency set; unavailable ⇒ both null (D-164)
```

- **"On"** (A-P5): `true`, a non-zero number, or a list value other than the option's first list entry.
- **Toggles** live in `items`, because PoB keeps them on the item set. C-32 makes them earned state, so an
  active toggle carries `uptime`; its producer is the item in that slot.
- **Offline markers.** The schema accepts `external-unavailable` tags and `unavailable` prices in any plan;
  V4 decides by the run's mode (C-30, D-201).
- **Endgame variants.** Every gem has a `level`. A variant stage's `variantBasis` cites the source of its
  level, gem levels and ascendancy points (D-193).

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
| `campaign/progress.json` | `order`: the progress keys (A-P10), i.e. `start`, one key per reward-quest row of `Data/QuestRewards.lua` in file order, then `endgame`. Per quest key `q.<key>`: `.region` (`act1`…`act4`, `interlude`), `.area-level`, `.reward` (text), `.passive-points` and `.weapon-set-points` (2 each for the 12 books), `.pob-config-key` (rewards with `useConfig`), and `.spirit`, `.resistance`, `.life`, `.mana` where granted | pin §B7; ext §2 (S10, S11, S12) |
| `campaign/areas.json` | area-level ranges for `act1`…`act4`; `interlude.base-levels`; `interlude.dynamic-increase` (+8, M) | ext §2 (S9, S47, S48) |
| `campaign/ascendancy.json` | `trial.1`…`trial.4`: `.points` (2), `.available-from` (a progress key), `.requirement` (text). The third and fourth trials' 65+/75+ dispute is recorded as M | ext §2 (S15, S16) |
| `campaign/gems.json` | `uncut-skill.<1..20>.available-from`; `uncut-support.<1..5>.available-from`; `tier-rule` (an uncut gem of level N engraves a skill of tier ≤ N at gem level N, H); `skill-tiers`, `spirit-tiers`, `support-tiers` | ext §2 (S17, S18, S19, S37) |
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
`stages[n].progress`). That import links `referenceData.ts` into `src/`, which the dead-module scan needs.

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
nothing is done.

| Mode | Arguments | Writes |
|---|---|---|
| run folder (D-207) | `new_run` only | the new run folder |
| validate | `plan_path`, `validate_only: true`, optional `stages` | nothing; the engine build is untouched |
| measure-only (D-208) | `plan_path`, `measure_only: true`, optional `stages`; no `build_name` | `compile-record.json` and `compiled-build.xml` beside the plan (A-P6) |
| final | `plan_path`, `build_name`; no `stages` | the PoB file through C-17, then the record beside the plan |

**Steps.** The whole call is one `session.run` of kind `load`, under one lock (D-156, D-191).
1. **Validate.** Resolve `plan_path` (§3.1), read it, parse it and run `validatePlan` with the reference
   data. Errors → `isError` with one `path: message` line each, and no engine request (D-163). Each id in
   `stages` must exist; the compiled list is that subset in plan order.
2. **Validate mode** returns `Plan <path> is valid: <n> stages (<ids>).`
3. **Final mode checks the target** (D-199) with `checkBuildFile` on `build_name`. An existing target is
   refused with C-17 step 2's text, unless the record beside the plan has `pobFile.location == "builds"`
   and a `pobFile.path` equal to the canonical target. Then the write uses `overwrite: true`, and C-17's
   guard still applies.
4. **Group the sets** (A-P2). Every stage gets its own tree spec, titled `loadoutName`. Stages whose
   `items` (likewise `skills`, `config`) are deep-equal share one set, titled `<base> {<ids>}`: the ids in
   plan order joined by `,`. The base is the content's `setTitle`, else the first member's `loadoutName`
   without its ` {<id>}`.
5. **Check every stage, read-only** (A-P12). One `compile_check {stages, treeVersion}` request mutates
   nothing and reports every defect of every stage: an unknown gem (with `resolve_gem`'s suggestions);
   item text with no base type; a node id not in the tree; a node or ascendancy node not connected to its
   start through listed nodes; a weapon-set tag on an unlisted node or in both sets; an attribute choice on
   a node without `isAttribute`; a tree-jewel node that isn't a jewel socket; an unknown config option or a
   bad value (`config_value`); a main-skill index outside the stage's groups or active skills. It also
   returns the **config baseline**: each option's value in a fresh config set (`CreateConfigSet`), its
   type and its first list entry. Any defect → `isError` listing `stage <id>: <defect>` for every stage;
   nothing is written and the engine is untouched (D-162).
6. **New build:** `ctx.newBuild({className, ascendancy})`.
7. **Build and measure,** one `compile_stage` request per stage, in plan order (D-156). It creates or
   selects the stage's tree spec and its item, skill and config sets (created on first use, reused by id
   after; never `CopyLoadout`, D-103). It imports the tree with weapon-set tags and attribute choices,
   sockets the jewels, equips the items, sets the toggles and `useSecondWeaponSet`, adds the groups and
   gems, and sets the main selection: the build-wide group, the group's active skill, the stat set (C-44).
   It writes every listed config option, earned and scenario, into the config set (C-32), sets the stage's
   level in manual mode, and recalculates. It replies with:
   - `outputs`, every finite numeric scalar of `mainOutput`, and `skillOutputs`, C-45's breakdown keyed
     `g<group>s<skill>p<statSet>`, each `{skill, statSetLabel, fields}`;
   - V1 inputs (added by WU-42): `CountAllocNodes`, `ExtraPoints`, `PassivePointsToWeaponSetPoints`,
     `Str/Dex/Int`, `ReqStr/ReqDex/ReqInt` with their sources; each gem's tier, kind (skill, support, or
     spirit, i.e. it reserves Spirit) and `levelRequirement` at its level; each item's
     `requirements.level`; PoB's warning lines (the `get_warnings` path);
   - V2 inputs (added by WU-42): allocated node names, equipped item names by slot, gem names, active
     skill names, flask and charm `active` states, the config set's `input` after the writes.

   A Lua failure here → `isError` naming the stage; nothing is written, and the engine holds the partial
   build.
8. **Finish:** one `compile_finish {activeStage, level}` request. It runs `SyncLoadouts` and checks that
   each stage's loadout resolves to exactly that stage's four sets. It selects the loadout of the
   highest-level stage (the last among ties, A-P9), then calls `set_level(<max stage level>, auto=true)`
   (D-196). It replies with the loadout list.
9. **Export:** `export_build_xml`, then `encodePobCode`.
10. **Write.** Final mode: `writeBuildFile({name: build_name, kind:'engine', overwrite, guard, ctx})`
    (C-17, which calls `noteSaved`). Measure-only: `compiled-build.xml` beside the plan.
11. **Check and record:** V1 and V2 per stage (§3.7), the ledger (§3.3), then `compile-record.json`
    beside the plan.

A crash during steps 5–10 fails the call with C-3's crash text, and nothing is written (D-165). A V1 or V2
finding never fails the call (D-192).

**Lua.** `pob-api/API/Compile.lua` (new), merged by one line in `Handlers.lua`, holds `compile_check`,
`compile_stage` and `compile_finish`. Each gets a C-5 schema, a typed bridge wrapper and a
`contract.test.ts` case (AC-B4). They reuse slice 1's set, tree-state and stat-set functions and BuildOps'
item, gem and config functions instead of copying them. Under `POB_API_TEST_ACTIONS=1` only,
`compile_stage` honours `params.__crashForTest` by calling `os.exit(3)` (as AC-E6's override does).

**Compile record** (`compile-record.json`, C-33):

```ts
type CompileRecord = {
  recordVersion: 1; planSchemaVersion: number; planSha1: string; compiledAt: string /* ISO 8601 */;
  mode: 'final' | 'measure-only'; stagesCompiled: string[];
  engine: { pobTag: string; pobCommit: string; treeVersion: string };   // as running (C-6)
  versionNotes: string[];           // every place the plan's `versions` differ from `engine`
  pobFile: { location: 'builds' | 'run'; path: string; sha1: string; bytes: number };
  importCode: string;               // D-205
  savedLevel: { level: number; autoMode: true }; activeLoadout: string;
  sets: { kind: 'tree' | 'item' | 'skill' | 'config'; id: number; title: string; stages: string[] }[];
  stages: Record<string, {
    loadoutName: string; level: number; elapsedMs: number;   // elapsedMs: this stage's compile_stage request
    outputs: Record<string, number>;
    skillOutputs: Record<string, { skill: string; statSetLabel: string; fields: Record<string, number> }>;
    configWritten: Record<string, boolean | number | string>;
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
Notes record reliance on M- or L-confidence facts (A-29); they never fail a check.

**Text output.** First `Compiled <plan_path>: <n> stages (<mode>) in <s> s.` Then per stage `Stage <id>
"<loadoutName>" level <L>: V1 pass|fail, V2 pass|fail`, with at most 10 findings and `… and <k> more in
the record`. Then one line per ledger entry (`<id> = <value>` or `<id>: <error>`), and the paths written,
relative to the builds folder and the guides root. The run-folder mode prints `Created run folder
<absPath>` and `plan_path for this run: <relPath>/plan.json`.

**Wiring** (spine §1.2). The schema literal, `TOOL_META` `{engine:'load', group:'core'}`, the router
case, `handleCompilePlan` in `src/handlers/planHandlers.ts`, and a disposition entry with `bucket:"new"`.
Three ok samples: a measure-only compile of the two-stage fixture (it changes the export and `revision`);
`new_run` and `validate_only`, each with `stateChange:false` and a reason ("creates a folder; the engine
build is untouched", "validates only"). The hygiene and kinds harnesses gain a `$TWO_STAGE_PLAN`
placeholder that copies the fixture into their guides folder.

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
| `gem-availability` | a skill gem's tier or level exceeds the highest uncut skill-gem level available at `progress`, or a support gem's tier exceeds the highest uncut support level. Spirit gems get a note instead (C1 has no table for them) |
| `gem-level-requirement` | a gem's `levelRequirement` at its level exceeds the stage level |
| `item-level-requirement` | an equipped item's `requirements.level` exceeds the stage level |
| `attributes` | PoB's `Str < ReqStr`, `Dex < ReqDex` or `Int < ReqInt`, with the attribute choices applied; the finding names the source item or gem |
| `resistance-penalty` | the stage lists `resistancePenalty` with a value other than C1's for its `progress` region |
| `pob-warning` | any PoB warning line except the informational ones. The filter is one pattern, `^You have \d+ Weapon set 2 passives available$` (`Build.lua:1051-1055`); filtered lines go to `pobWarnings.filtered` |
| `tree-continuity` | the stage's nodes and ascendancy nodes don't contain its predecessor's (A-P3) apart from `respec.dropped`, or `respec.dropped` isn't exactly the dropped set (D-144) |

**V2: config** (D-114, C-32).

| Code | Finding when |
|---|---|
| `producer-unknown` | an earned entry is on and its producer's name isn't in the game data (WU-31's lookup functions) |
| `producer-absent` | the producer exists but isn't in the stage. Item: an equipped item's name. Gem: a gem in the skill set. Passive: an allocated node, ascendancy included. Skill: an active skill of the stage. Flask or charm: equipped, with its toggle on. Names compare case-insensitively |
| `source-unresolved` | a scenario entry's `source.file` isn't a loaded C1/E1 file, or its `key` (and member) doesn't resolve |
| `quest-not-reached` | a quest-reward option (a C1 `pob-config-key`) is on and its quest comes after `progress` |
| `default-unlisted` | an option is on in the config baseline and the stage doesn't list it (A-P4) |
| `toggle-empty` | a toggle is active on a slot holding no flask or charm |

## 4. Slice assumptions (proceed-on; to fold into spine §6.2)

These are formalizer's choices where the inputs fix a requirement but not its mechanics.

| ID | Assumption | Basis | If wrong |
|---|---|---|---|
| A-P1 | Stage ids match `[A-Za-z0-9]+`, so they work as brace ids. `loadoutName` contains `(L<level>)` and ends with ` {<id>}` | D-103; D-138's `Act 2 (L25) {2}` | Change the rule in `schema.ts` and the reference |
| A-P2 | Sets are shared by deep equality of `items`, `skills` or `config`, and titled as in §3.6 step 4 | C-31: "the compiler names shared sets" | Add explicit set keys to the schema |
| A-P3 | The continuity predecessor: stages without `variant` form the campaign track, each variant its own track, each in plan order. A variant track's first stage continues from the last campaign stage before it | D-144 names only "the previous stage" | Re-scope `tree-continuity` |
| A-P4 | An option is on by default when it's on in a fresh config set (`CreateConfigSet`, `ConfigTab.lua:974-990`). Placeholders are excluded: PoB shows them as hints in empty fields. Every stage lists `enemyIsBoss`, which the compiler writes into every config set | C-32, D-79, D-119 | Widen or narrow the audit |
| A-P5 | "On" is as defined in §3.2. An earned entry whose value is off needs no producer | C-32 (nothing to produce) | Require producers on every entry |
| A-P6 | The measure-only XML is named `compiled-build.xml`, beside the plan | D-208 names no file | Rename it |
| A-P7 | A slug matches `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters, which is safe on drvfs | C-41's "one safe path segment" | Loosen the pattern |
| A-P8 | `stages` subset semantics, called S1: a subset compiles only in the validate and measure-only modes, and a final compile is always the whole plan. WU-30 confirms S1 or raises HG-13 | gap 6, D-156; the M-11 exit's one loadout per stage | The user picks an incremental scheme at HG-13 |
| A-P9 | At save, the highest-level stage's loadout is active (the last among ties) | D-138 and D-149 name the level, not the loadout | Change `compile_finish` |
| A-P10 | Progress points are `start`, the `QuestRewards.lua` rows in file order, then `endgame`. Interludes count in PoB's file order | C-31: "a C1 key for the campaign point reached" | Re-key C1 |
| A-P11 | V2 checks that scenario sources resolve, not that their values match. A derived value, such as a waystone-scaled hit, is V4's to re-derive | C-32: "name their source" | Add a value comparison |
| A-P12 | One read-only `compile_check` request precedes the per-stage requests, so a defect leaves the engine untouched | D-162; D-156 still holds (one build request per stage) | Fold the checks into `compile_stage` |

## 5. Work units

### WU-30: Compile-time spike
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
- acceptance: [AC-P3, AC-P4, AC-P5, AC-P6, AC-P7]
- milestone: M-11
- summary: Add `guidesDirectory` to `entryDefaults` and `ServerDeps`, §3.1's resolve-and-contain and
  run-folder functions, and the Jest redirect. No tool changes; WU-41 exposes the run-folder mode.

### WU-38: P1, the plan schema, its reference and the ledger evaluator
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
- summary: §3.2's schema with its cross-reference rules and JSON paths, and §3.3's evaluator. **The
  two-stage fixture** (also the reference's worked example): stage `1` at an Act 1 progress point and a low
  level; stage `2` later, higher, with a tree containing stage 1's. Their `items` are deep-equal and their
  `skills` differ. It has one ledger entry over both stages, an `ok` and an `unavailable` price, and at
  least one claim of each tag kind.

### WU-39: C1 and E1 data files and their loader
- kind: build
- depends-on: [WU-38]
- role: backend-dev
- touches: [`data/campaign/*.json`, `data/enemies/*.json` (new), `src/plan/referenceData.ts` (new),
  `src/plan/schema.ts` (the `progress` check), `tests/unit/referenceData.test.ts`,
  `tests/static/referenceData.test.ts`, `tests/integration/questKeys.test.ts` (new)]
- produces: [C-35 (§3.4)]
- consumes: [C-30, the pin, ext §2–§4]
- acceptance: [AC-P13, AC-P14, AC-P15, AC-P16, AC-P17, AC-P18]
- milestone: M-11
- summary: §3.4's files, from the pin and the external-data grounding doc only (D-204), with no web fetch.
  Add the zod loader, and the `progress` check in `validatePlan`.

### WU-40: Import-code encoder and `encode_build_code`
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

### WU-41: P2, the compiler and `compile_plan`
- kind: build
- depends-on: [WU-30, WU-33, WU-35, WU-36, WU-37, WU-38, WU-40]
- role: backend-dev + lua-dev
- touches: [`pob-api/API/Compile.lua` (new), `pob-api/API/Handlers.lua` (one merge line),
  `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `src/plan/compiler.ts` and `src/plan/record.ts` (new),
  `src/handlers/planHandlers.ts` (new), the wiring files, fixtures, count sites and README table,
  `tests/integration/contract.test.ts`, `tests/integration/compilePlan.test.ts` and
  `compilePlanNfr.test.ts` (new), `tests/fixtures/plans/` (the fifteen-stage fixture, defect variants),
  `toolHygiene.test.ts` and `engineKinds.test.ts` (the placeholder); `buildFileWriter.ts` only if a new
  write kind is needed]
- produces: [C-41 (§3.6), C-33's record and ledger evaluation, the run-folder and measure-only modes]
- consumes: [C-3, C-4, C-5, C-17, C-34, C-31, C-42, C-39, C-40, C-44, C-45, D-196's auto flag]
- acceptance: [AC-P21…AC-P38, AC-B1, AC-B2, AC-B3, AC-B4, AC-B8]
- milestone: M-11
- summary: §3.6's steps 1–11 (V1 and V2 left `null`), the three Lua actions and the four modes. The
  fifteen-stage fixture is WU-30's synthetic plan in P1 form. Counts reach 83, and 82 without poe.ninja.

### WU-42: V1 validity and V2 config checks inside compile
- kind: build
- depends-on: [WU-41, WU-39, WU-31]
- role: backend-dev + lua-dev
- touches: [`src/plan/checks/v1.ts`, `src/plan/checks/v2.ts` (new), `src/plan/compiler.ts` (calls them),
  `pob-api/API/Compile.lua` and `src/engine/schemas.ts` (V1/V2 inputs and the config baseline, additive),
  `tests/fixtures/plans/` (check variants; the two-stage fixture and the worked example adjusted together
  if needed), `tests/integration/planChecks.test.ts`, `tests/unit/planChecks.test.ts` (new)]
- produces: [§3.7's verdicts in the record and the text]
- consumes: [C-35, C-37's lookup functions, `compile_stage`'s reply]
- acceptance: [AC-P39, AC-P40, AC-P41, AC-P42, AC-P43, AC-P44]
- milestone: M-11
- summary: §3.7: the V1/V2 inputs in the stage reply, the config baseline in `compile_check`, and the
  checks. The two-stage fixture passes both.

## 6. Acceptance criteria

"Engine-required" tests use `engineDescribe` over `startSessionFixture`: the real server in process, real
luajit, the real bridge with C-5 validation. Every test uses temp builds, state and guides folders and no
network (D-34). A "Lua query" is a `__test_eval` call, with test actions on. "The fixture" is
`tests/fixtures/plans/two-stage/plan.json`, copied into a run folder made by `compile_plan {new_run}`.

**Compile-time spike (WU-30)**

- **AC-P1 (WU-30).** Script check. The report at the WU-30 path holds the machine, pin and method; the
  synthetic plan's shape as specified; a time for each of the 15 stages in each of 3 runs; each run's
  whole-call, export and snapshot times; the probe source as an appendix; and a decision line.
- **AC-P2 (WU-30, HG-13).** The decision follows the rule. If every run's whole call is ≤ 100 s and every
  stage request < 30 s, the report says "S1 confirmed" (A-P8). Otherwise the unit ends
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
  | `schemaVersion: 2` | `schemaVersion` (the only error; it lists `[1]`) |
  | `ledger` removed | `ledger` |
  | an unknown top-level key `foo`; text that isn't JSON | `$` (each) |
  | `stages[1].level: 0` | `stages[1].level` |
  | `stages[0].id: "a b"`; stage 1 given stage 0's id | `stages[0].id`; `stages[1].id` |
  | a `loadoutName` without `(L<level>)` | `stages[0].loadoutName` |
  | `variant` without `ascendancyPoints` | `stages[1].ascendancyPoints` |
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
  | a claim citing `ledger:nope` | `stages[0].claims[0].source` |
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
  and has one key per `QuestRewards.lua` row; the books total 24 passive and 24 weapon-set points; Spirit
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
- **AC-P17 (WU-39).** Unit. `validatePlan` with an unknown `progress` gives an error at
  `stages[0].progress`.
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
- **AC-P22 (WU-41, M-11).** After `lua_load_build {build_name:"m11-two-stage"}`, `manage_sets
  {set_type:"loadout", action:"list"}` lists exactly the two `loadoutName`s. After selecting each loadout,
  a Lua query shows active tree, item, skill and config set titles equal to the record's `sets` entries
  for that stage. The item set title ends with `{1,2}`; the two skill sets are distinct.
- **AC-P23 (WU-41, M-11, D-138).** In the reloaded build, select stage 1's loadout, set its level with
  `set_character_level`, then call `lua_get_stats {fields:["Life","CombinedDPS"]}`: both equal the
  record's `stages.1.outputs` values within relative 1e-9. Each stage's record
  `level` is its plan level, and the two stages' `outputs.Life` differ.
- **AC-P24 (WU-41, M-11, D-180).** `record.importCode` decodes to the file's bytes. After
  `import_build {code}`, the loadout list and each type's set titles match the file. A Lua query shows
  `characterLevelAutoMode` true at the highest stage level, and loadout count = stage count = 2.
- **AC-P25 (WU-41, C-32).** For each stage, a Lua query of its config set's `input` holds every listed
  option with its listed value, and every config set holds `enemyIsBoss`.
- **AC-P26 (WU-41, D-162).** Defect variants of the fixture, one defect each in stage 2: an unknown gem
  (the text lists suggestions); item text with no base; node id 999999; a disconnected node; a weapon-set
  tag on an unlisted node; an attribute choice on a non-attribute node; an unknown config option. Each
  gives `isError` naming stage `2` and the defect; a variant with defects in both stages names both. In
  every case the builds folder's names and sha1s, the run folder's listing, `session.revision` and the
  canonical export are unchanged.
- **AC-P27 (WU-41, D-163).** A plan with `stages[1].level: 0` gives `isError` containing
  `stages[1].level`. The canonical export and `revision` are unchanged, and nothing is written.
- **AC-P28 (WU-41, D-167).** `validate_only` on the fixture returns `… is valid: 2 stages (1, 2).`; the
  canonical export is unchanged and the run folder holds only `plan.json`. An invalid plan gives `isError`
  with paths; `stages:["zz"]` gives `isError` naming `zz`.
- **AC-P29 (WU-41, D-208).** `measure_only` writes `compile-record.json` and `compiled-build.xml` beside
  the plan, and the builds folder's names, sizes and sha1s are unchanged. `pobFile` is
  `{location:"run"}` with a guides-relative `path` and the XML's sha1; `importCode` decodes to the XML's
  bytes. With `build_name` added, the call is `isError` and writes nothing.
- **AC-P30 (WU-41, D-207).** `compile_plan {new_run:"titan-blood-hunt"}` returns an absolute path under
  the fixture's guides dir and `titan-blood-hunt/<today>-1/plan.json`; the folder exists; a second call
  gives `-2`; the canonical export is unchanged. `new_run:"../x"`, and `new_run` together with
  `plan_path`, are `isError` and create nothing.
- **AC-P31 (WU-41, D-199, C-17).** A second final compile to `m11-two-stage` succeeds, leaving a backup
  under `<stateDir>/backups/`. `build_name:"grenadator"` (an existing file the record doesn't name) gives
  `isError` "already exists", file unchanged. After `writeBuild` changes `m11-two-stage.xml`, a re-compile
  gives `isError` with C-17's changed-on-disk text, file unchanged.
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
  `isError` containing "The engine stopped while running `compile_plan`", and writes no file. The next
  `lua_get_build_info` carries C-3's restore notice and reports the pre-compile build. A measure-only
  compile of the unmodified fixture then succeeds.
- **AC-P36 (WU-41, D-165).** Two measure-only compiles of the fixture in one server give records equal
  except `compiledAt`, `timing`, `elapsedMs`, `pobFile.sha1`/`bytes` and `importCode`, and
  `canonicalize(xml1) === canonicalize(xml2)` (exports needn't be byte-stable, stab slice 02 §1).
- **AC-P37 (WU-41, NFR-20, NFR-21).** Engine-required, `compilePlanNfr.test.ts`, test timeout 150 s. A
  final compile of the fifteen-stage fixture takes ≤ 100 s of wall time, with `timing.totalMs ≤ 100000`
  and every `stages.*.elapsedMs < 30000`.
- **AC-P38 (WU-41).** `TOOL_META.compile_plan` is `{engine:'load', group:'core'}`. In
  `engineKinds.test.ts` the measure-only sample changes the export and adds exactly 1 to `revision`; the
  `new_run` and `validate_only` samples declare `stateChange:false` with reasons. AC-B1 holds at 83/82 and
  AC-B4 for the three Lua actions. Static: `Compile.lua` contains no `CopyLoadout`.

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
- **AC-P42 (WU-42, C-32, A-P4).** For a variant whose stage 1 lists only `enemyIsBoss`, the
  `default-unlisted` options equal, as a set, the options on in a fresh config set as a Lua query of
  `ConfigOptions` (`defaultState`, `defaultIndex`) computes them, minus `enemyIsBoss`. They include every
  quest-reward checkbox (`ConfigOptions.lua:73-82`) and `resistancePenalty`. Listing them all, off or with
  a C1 source, clears those findings.
- **AC-P43 (WU-42, A-29).** A stage relying on `trial.3` passes, with a note naming `trial.3` and
  confidence M. An `endgame` stage with 124 regular points passes, with a note naming
  `passive-points.martyr` (M).
- **AC-P44 (WU-42, D-192).** A final compile whose stage 1 has a V1 finding still writes the PoB file and
  the record, and the text shows `V1 fail` with the finding.

## 7. Test strategy and migration (this slice)

- **Test classes.** Unit: guides paths, schema and error paths, ledger, loader, encoder (real temp dirs
  for filesystem cases). Static: the reference against zod, no `eval`, C1/E1 strings out of `src/`, E1
  tables against the pin, no `CopyLoadout`, the README env row. Engine-required, in process across the
  real TS↔Lua seam through `engineDescribe`: the compile, check, quest-key and NFR criteria, plus
  `contract.test.ts` cases for the three Lua actions.
- **The M-11 exit.** AC-P21…AC-P24 and AC-P39 on the hand-written two-stage fixture, plus AC-P37 for
  NFR-20 and NFR-21.
- **Regression.** Golden values (AC-B5), `engineKinds.test.ts`, the hygiene test and the static scans stay
  green with empty waivers; only the count literals move (AC-B1).
- **Migration.** None. Everything is additive: a new env var with a default, new tools, new `data/` files,
  new Lua modules. Roll back by reverting a unit.

## 8. Open items (holes in the inputs)

1. **HG-13's "nears the 30 s timeout" has no stated margin.** AC-P2 uses < 30 s (NFR-21). A tighter
   margin needs the user.
2. **Neutral options that are on by default have no class in C-32.** For example,
   `multiplierCurrentManaPercentage` defaults to 100, and neither earned state nor a scenario input can
   justify keeping it on. Clearing its `default-unlisted` finding means listing it off, which changes the
   numbers. The audit needs either a third justification or an exemption list; the user decides.
3. **No grounded table of Spirit-gem availability** exists beyond the Act 3 reward, so V1 notes Spirit
   gems rather than checking them.
4. **No source for respec gold costs.** `goldCost` will carry `judgment` tags.
