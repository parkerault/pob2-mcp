# Build-guide workflow: spec spine

**Status:** v1.2, 2026-10-08. Formalized from the ratified change-vision; the adversarial spec review's
fixes and the coordinator's resolutions are folded in (D-210…D-238, A-31, A-32). The user settled D-210,
D-219 and D-234 on 2026-10-08 and approved implementation.

**Inputs.** Requirements come only from these:
- the change-vision [`../../design/2026-10-07-build-guide-workflow.md`](../../design/2026-10-07-build-guide-workflow.md)
  ("design"): decision rows 1–49, the Target state, capabilities K1…O1 with their DAG and run order, the
  quality bar and the non-goals. Its review record (`…-workflow-review.md`) is already folded into it;
- the grounding reports in [`../../design/grounding/`](../../design/grounding/): pin facts and spikes
  S-a/S-b ("pin §"), the Claude Code platform answers ("platform §"), external game data ("ext §");
- the recon [`../recon.md`](../recon.md) ("recon §"), the existing-system map with file:line references;
- the gap analysis [`../gaps.md`](../gaps.md) ("gap n"), items 1–35. The user accepted every PROPOSED
  item and settled item 4 on 2026-10-07; item 32 is HG-14 here;
- the adversarial review's binding fix plan [`../spec-review-2026-10-07.md`](../spec-review-2026-10-07.md)
  ("review Sn"), folded in as D-210…D-221 and C-50, and the coordinator's binding resolutions of the
  slice writers' open items (2026-10-07), folded in as D-222…D-238, A-31 and A-32.

This spine is the single source of truth for what crosses slices: the contracts (C-30…C-50, plus the
amended stabilization contracts in §3.1), the decision log (D-100…), the autonomy envelope (A-20…,
HG-10…), the milestones (M-10…M-13), the work-unit DAG (WU-30…WU-49), the guardrails, the risks (R-20…)
and the cross-cutting acceptance criteria (AC-B). The stabilization spine
(`docs/stabilization/spec/README.md`, "stab spine") stays in force wherever this spine doesn't amend it.
No ID here collides with it. When a slice and this spine disagree, this spine wins; fold fixes back here.

| Slice spec | Scope | Work units | AC prefix |
|---|---|---|---|
| `01-server-tools.md` | K1 lookups, K2 coverage, M1 breakdown and the skill-part fix, M2 ranker amendments, L1 set and tree-state authoring, the existing defects, T1 dated price outputs | WU-31…WU-36, WU-49 | AC-K |
| `02-plan-compiler.md` | The compile-time spike, the guides-folder root, the P1 plan schema, the C1/E1 data files, the import-code encoder, the P2 compiler and ledger (`compile_plan`'s measure-only and final modes, the write ledger), `guide_run` (the run-folder and validate modes), the V1/V2 checks | WU-30, WU-37…WU-42 | AC-P |
| `03-pipeline.md` | The skill, the research and design-and-write workflows, the V3/V4 agents, the guide template, the run log, the pricing procedure, the Agent-tool fallback, the offline mode and the offline end-to-end run, the alpha | WU-43…WU-48 | AC-W |
| this spine | Cross-cutting criteria | — | AC-B |

**Reading rule for build agents.** Read the stab spine's §2.2 conventions, this spine, then your unit's
slice spec. Cite IDs in commits and the work-log. Anything no contract or decision settles is either a
proceed-on assumption (§6.2) or a human-decision gate (§6.3). Never invent a third category.

**Capability glossary** (the design's IDs): K1 game-data lookup · K2 model-coverage detection · M1
offense breakdown and skill-part selection · M2 ranker amendments · L1 set and state authoring · P1
build-plan format · P2 plan compiler · C1 campaign reference data · E1 enemy reference profiles · T1
dated pricing · V1 stage validity check · V2 config check · V3 provenance check · V4 claim verification ·
R1 research (R1a parallel lookup-only agents, R1b the coordinator's compile, measure and price) · D1
endgame design · D2 campaign plan · W1 guide writer · O1 orchestration.

---

## 1. Existing system context

Summarized from recon (an audit of `2758b02`), which holds the file:line evidence. Nothing here is
redefined; §3 tags every contract this epic relies on or changes.

### 1.1 Components in scope

| Component | Today (recon §1) | Changed by |
|---|---|---|
| Tool wiring: `toolSchemas.ts`, `toolMeta.ts`, `toolRouter.ts`, listing in `createServer.ts` | 77 `TOOL_META` entries (kinds `none`, `read`, `mutate`, `load`, `lifecycle`; groups `core`, `trade`, `ninja`). A tool without an entry is unlisted and unroutable. Unknown tool → −32602. Handler errors → `isError` | every tool-adding unit (§7) |
| Engine session `src/engine/session.ts` | One FIFO lock per tool call, any kind. Snapshot (a full XML export) after each successful `mutate`/`load`. A ctx load (`newBuild`, `loadFile`) drops the previous build's snapshot (`:778`), so a crash before the call's own snapshot takes the no-snapshot path (`RESTORE_FAILED`, `:230`, `:589`). `isDirty()` and `loaded` are public. Only `find_upgrades` has a deadline | none; `compile_plan` is one call (D-156) |
| Bridge client `src/pobLuaBridge.ts`; reply schemas `src/engine/schemas.ts` (43 actions) | 30 s per request, SIGKILL on timeout. Every reply is validated; a missing schema is a compile error | new actions (C-2/C-5 rows) |
| Lua: `pob-api/API/{Server,Handlers,BuildOps}.lua`; `Trade.lua` merged by one line at `Handlers.lua:493` | `pcall` dispatch; BuildOps returns `value` or `nil,'msg'` | new Lua modules, merged the same way |
| `buildFileWriter` `src/services/buildFileWriter.ts` | Canonical path, explicit overwrite, changed-on-disk guard, backup, temp file + rename | used by `compile_plan` (C-17) |
| Trade: `rateLimiter.ts`, `tradeClient.ts`, price tools | Waits over 30 s → `would_wait`. No price or listing cache. `get_item_price` names the league, gives no date | C-49 (D-202) |
| `lua_get_stats` | `category:'offense'` gives 38 main-skill fields; values are `mainOutput` scalars only; on the 5000-char truncation list | C-45 |
| `set_main_skill` → Lua `set_main_selection` | Writes PoE1's `srcInstance.skillPart`, not PoB2's `statSet`; `skill_part` is an undocumented router alias | C-44 |
| `search_tree_nodes` | `node_type:'any'` matches nothing; the loop stops at the cap before sorting; no ascendancy filter; query required; cap 30 | C-43 |
| `list_gems` | Names, tags, tier, attribute weightings; no description, stat text, stat sets or support rules | unchanged; K1 adds C-37 |
| `get_passive_upgrades`, `suggest_supports` | D-77, D-78: ascendancy notables excluded; unmeasured candidates sort as −∞ and fall off | C-47 |
| `lua_set_tree`, `update_tree_delta` | Lua neither auto-paths nor caps ascendancy points; the TS side reads `autoPathedNodes`, `skippedAscendancyNodes`, `ascendancyPointsUsed`, which Lua never sends | C-48 |
| Specs; item sets | Spec tools exist. Item sets: list and select only. No skill-set or config-set operations at all | C-39 |
| `add_item`, `toggle_flask` | `ITEM_SLOTS` has no tree-jewel sockets (Lua accepts any slot). `toggle_flask` acts on the active item set | C-46; `toggle_flask` unchanged |
| `set_character_level` → Lua `set_level` | Always forces manual mode; nothing sets `characterLevelAutoMode` | bridge flag only (D-196) |
| `src/utils/buildCode.ts` | Decode only; an encoder exists only in tests (`toolHygiene.test.ts:95`) | C-42 |
| `plan_leveling` data, `export_build_summary` | Hand-written table without area or quest data (not reused, D-131); summary without import code | unchanged |
| `.claude/` | 8 agent-os agents and 6 commands; no skills, no workflows | slice 3 |

### 1.2 Conventions every unit follows

- **Stab spine §2.2:** ESM with Node16 resolution, relative imports ending in `.js`, `import type`; no
  `import.meta`, `__dirname` or top-level `await` in `src/`; log only to stderr as
  `console.error('[Component] …')`; only `src/index.ts` reads `process.env`; Lua in `pob-api/` uses
  two-space indentation and `local M = {} … return M`; `vendor/` is never modified.
- **A new tool is 4 code edits plus 4 fixture and doc edits** (recon §2): the schema literal, the
  `TOOL_META` entry, the router `case`, `handle<Name>` wrapped in `wrapHandler`; a `tool-disposition.json`
  entry (`bucket:"new"`); at least one `expect:"ok"` sample in `tool-calls.json`; the README table
  regenerated with `pnpm build && pnpm docs:tools --write` (D-83); the count sites (§1.3).
- **Checks that already apply to every tool:** router and registry agree; output text never contains
  `undefined`, `NaN` or `[object Object]`; descriptions are ≤ 2048 chars; engine kinds are verified by
  `engineKinds.test.ts` (a `read` sample leaves the canonical export and `revision` unchanged; a
  `mutate`/`load` sample changes both; a sample may declare `stateChange:false` with a reason).
- **Static scans with empty waiver files:** the PoE1-cruft scan over every string literal in
  `src/**/*.ts` (bans PoE1 boss names, `Shadow`, …); the advice-threshold scan over `src/advice/*`,
  `validationHandlers.ts`, `optimizationHandlers.ts`, `buildGoalsHandlers.ts` (bans `quest points`, …);
  `deletedPlumbing`; no dead modules; explicit env in every test spawn.
- **Every new Lua action** gets a C-5 zod schema, a typed bridge wrapper and a `contract.test.ts` case in
  the same merge. Actions are snake_case, params camelCase.
- **Dependencies today:** zod 3, fast-xml-parser, chokidar, the SDK; `zod-to-json-schema` is a
  devDependency. There is no YAML parser and no runtime JSON-Schema validator.

### 1.3 Existing data and state in scope

- **Build XML** (recon §4). Build-wide: `<Build level characterLevelAutoMode mainSocketGroup>`. Per tree
  spec: `<WeaponSet1>`/`<WeaponSet2 nodes>` (weapon-set tags), `<Sockets><Socket nodeId itemId>` (tree
  jewels), `<Overrides><AttributeOverride strNodes dexNodes intNodes>` (attribute choices). Per skill set:
  gems with a per-gem stat-set choice. Per item set: `useSecondWeaponSet`, `<Slot name itemId active>`.
  Per config set: only non-default `<Input>`s are saved (pin `Classes/ConfigTab.lua:739`).
- **State dir** (C-16): `$XDG_STATE_HOME/pob2-mcp/` with `snapshots/`, `backups/`, `exports/`,
  `presets/`; the recovery snapshot lives in memory (D-44). This epic adds one file there: the write
  ledger `guide-writes.json` (D-211).
- **Count sites** asserting 77 tools (76 without poe.ninja): `tests/mcp/tradeQueryOptions.test.ts:89`;
  `tests/mcp/findUpgrades.test.ts:1089`; `tests/static/readme.test.ts:136` (rows) and `:4, :127` (text);
  `tests/integration/gemCorruption.test.ts:310, :326`; `scripts/fresh-clone-check.mjs:27` (`:110`
  derives the ninja-less count); the comment at `scripts/fresh-clone-check.sh:12`.
- **Golden values no change may move:** 109 `PlayerStat` pairs survive save and reload
  (`tests/integration/golden.test.ts`); `golden-stat-fields.json`; CombinedDPS 104489.78
  (`engineTree.test.ts:86`); Life 2,977 (`fresh-clone-check.mjs:123`).

### 1.4 Prior decisions in scope

- **Respected unchanged:** D-8/D-59 (a lock per call; only the session starts the engine), D-17 (the
  gate), D-18 (no server state in the builds folder), D-19 (disk-change policy), D-22/D-47 (only
  `find_upgrades` has a deadline; 30 s per engine request), D-26 (zod v3, never passed to the SDK), D-27
  (handler errors are `isError`), D-34 (no live network from agents or tests), D-36 (text output only),
  D-40 (no automatic retries), D-45 (strict hygiene allowlist), D-46 (trade responses never cached), D-48
  (unsigned commits during the build), D-52 (canonical build paths), D-83 (generated README table), C-17
  with D-60/D-80/D-86 (the writer).
- **Amended or scoped here:** D-77 and D-78 (by D-143, C-47); C-1 and the D-64/D-91 counts (D-174);
  D-65's text (D-198); D-3/D-30 (D-168, D-203); D-42/D-88 path confinement (D-177); C-16 and C-19,
  additively (D-211, review S17). Stab HG-3 (tool-set changes need the user) is resolved for the tools
  gap 23 names (D-173), for `guide_run` inside D-173's cap (D-216), and for C-49's additive price outputs
  and error prefix by D-202 and D-218 once ratified.

## 2. Problem and goals

The user has played PoE1 and PoE2 for years but has never built a character from scratch. They want a
workflow that takes a PoE2 ascendancy and a main skill, often a randomizer roll (first: Titan / Blood
Hunt), and produces a written guide plus a PoB2 build that a newcomer can follow from level 1 through
endgame (D-101). The user is the guide's reader, not its fact-checker, so the workflow checks its own
claims and says plainly when it guesses (D-105, D-142). PoB2 leaves much unmodelled: 12.9% of unique mod
lines, about 30% of keystones and 32% of ascendancy notables carry a line PoB ignores (pin §D), so hand
calculations are routine.

| Goal | Statement | Proven by |
|---|---|---|
| G-10 | The server exposes PoB2's loaded game data, per-skill and per-skill-part numbers, and what PoB can't model (K1, K2, M1, M2) | AC-K |
| G-11 | The server can author every piece of a stage's state: sets, loadouts, weapon-set passives, attribute choices, tree jewels, flask toggles, a consistent main skill (L1) | AC-K |
| G-12 | A plan compiles into one PoB2 file with a loadout per stage, a compile record, a re-evaluated ledger, an import code, and V1/V2 verdicts (P1, P2, C1, E1, V1, V2) | AC-P, NFR-20, NFR-21 |
| G-13 | The pipeline produces the dossier, plan, record and guide, every claim tagged with its source and verified (R1, D1, D2, W1, V3, V4, O1) | AC-W, M-12 |
| G-14 | The Titan / Blood Hunt guide is one the user can actually level and map with | M-13 sign-off |
| G-15 | Nothing existing regresses: tool contracts, golden values, the offline rules | AC-B |

## 3. Interface contracts

Status tags: **existing** (relied on, unchanged), **modified** (delta and compatibility shown), **new**.
The summaries are binding; the slice named in §3.2 carries the full detail.

### 3.1 Stabilization contracts this epic relies on or amends

| ID | Boundary | Status | Delta and backward-compatibility impact |
|---|---|---|---|
| C-1 | MCP tool surface | modified | The tool set is stab §4's table plus C-37…C-42 and C-50: **84 tools, 83 with `POE_NINJA_DISABLED=true`**; all seven new tools are group `core` (D-216). Corrects C-1's stale "76" (it has been 77 since D-91). Existing tools change only as C-43…C-49 say. **Compat:** additive; nothing removed or renamed |
| D-64, D-91 | Count assertions (§1.3 sites) | modified | Each literal moves to the new total in the merge that adds a tool (§7 wiring rule). Final: 84 and 83 |
| C-2, C-5 | Wire protocol v2; reply schemas | modified (D-222) | **New Lua actions** behind C-37…C-41. **Existing actions, additive:** `search_nodes` adds `ascendancy?` (with it, `keyword` is optional) and sorts before the cap; `get_stats` adds `breakdown?` and, only with it, a `breakdown` reply field; `set_level` adds `autoMode?` (default false, D-196); `set_tree` adds `weaponSets?` and `attributeChoices?`; `update_tree_delta`'s reply adds `autoPathedNodes`, `skippedAscendancyNodes` and `tree.ascendancyPointsUsed`, which the TS side already reads (D-194). **Renamed:** `set_main_selection`'s `skillPart` param becomes `statSet` (D-195). **Compat:** every change is additive except that rename, which is internal: only `set_main_skill` calls the action |
| C-3 | Engine session | existing | New engine tools run in `session.run` by kind; `guide_run`'s run-folder mode runs outside it (D-216). `compile_plan` holds one lock for the whole call (D-156). A crash mid-compile runs C-3's recovery and fails the call (D-165). The compile's `new_build` drops the recovery snapshot (§1.1), so recovery takes the no-snapshot path: the next `read` or `mutate` call fails with "the loaded build could not be restored", and a later compile succeeds |
| C-4 | Bridge client | existing | Its 30 s per-request timeout bounds each compile stage request (NFR-21) |
| C-6 | PoB pin | existing | v0.23.1, game 0.5.4 data. Unchanged (HG-11) |
| C-7 | Server factory | modified | `ServerDeps` gains the guides root (C-34), resolved in `src/index.ts`. No I/O at construction. **Compat:** additive |
| C-8 | Tool registry metadata | modified | Seven entries, with the kinds in §3.2. A `guide_run` call carrying `new_run` is routed as kind `none`: the one mode-dependent kind (D-216) |
| C-11 | Rate limiter | existing | T1's pacing relies on its `would_wait`/`locked_out` answers (D-160, D-202) |
| C-16 | State dir | modified (additive) | Gains one file, the write ledger `guide-writes.json` (D-211). **Compat:** additive; the existing folders are untouched |
| C-17 | Build-file writes | existing | The compiled PoB file is written through it (D-155, D-199); a measure-only compile writes none (D-208). An existing target reaches it only under the write ledger's rule (D-211), and its own guard still applies |
| C-18 | Test harness | modified | `globalSetup` also points `POB_GUIDES_DIRECTORY` at a fresh temp dir; `spawnServer` passes it explicitly. **Compat:** additive |
| C-19 | Developer entry points | modified (additive) | The `test` task gains a separate step after `pnpm test`: `compilePlanNfr.test.ts` with `--runInBand`, which the main Jest run excludes (review S17). The task stays pipe-free and its exit code propagates. **Compat:** `mise run test` still runs every test |
| D-77, D-78 | Ranker behaviour | modified | See C-47 (D-143). AC-E39's ordering is kept |
| D-65 | `load_build_xml` contract text | modified (text) | Its "crash recovery still reloads without `keepLevel`" is stale; see D-198 |
| D-3, D-30 | Advice judgments | scoped | Binding for the advice tools only; see D-168, D-203 |
| D-42, D-88 | Path confinement | extended | The guides root joins the allowed roots (D-177) |
| D-46 | No trade-response cache | existing | Kept: prices live in the plan (D-169) |

### 3.2 Contracts of this epic

**C-30 Source tag** (new; all slices). Every claim in a plan, a data file, the dossier and the guide
carries one (D-105): `{kind, ref, accessed?, patch?, confidence?}`.
- `kind` is one of: `pob-computed` (ref = a compile-record field, C-33); `pob-data` (ref = a pinned PoB
  `file:line` or a lookup-tool result); `external` (ref = a URL, with `accessed` required); `judgment`;
  `external-unavailable` (ref = the text `external source unavailable (offline run)`), for a claim that
  would need an external source during an offline run (C-36, D-201).
- `confidence` is H, M or L (the grounding's scale). It is required for `external`, `judgment` and
  `external-unavailable` (quality bar: confidence is stated wherever PoB can't verify).
- Instead of a tag, a claim may cite a ledger entry (`ledger:<id>`, C-33; the entry's inputs carry their
  own tags), a price entry (`price:<id>`, the plan's `prices[]` entry with its date, league and query,
  D-237), or a C1/E1 fact (`data:<file>#<key>`, `<file>` relative to `data/`; the fact carries its own
  citation, D-232).
- V3 checks that tags are present; V4 checks that claims are true (D-179). V4 accepts
  `external-unavailable` only when the run log records offline mode; in any other run it is a finding.
  Offline, V4 checks a `data:` claim against the data-file fact and the citation stored there, without
  fetching the fact's URL (D-232).

**C-31 Build plan file** (new; slice 2 holds the full zod schema).
- `plan.json` in a run folder (C-34), JSON, validated by zod inside `compile_plan` and `guide_run`'s
  validate mode (D-167, D-216). `schemaVersion` is an integer; both accept only versions they know and
  otherwise fail naming them. A schema error names its JSON path and nothing is compiled (D-163).
- **Required top level:** `schemaVersion`; `roll` (class, ascendancy, rolled skill); `versions` (the PoB
  pin tag and commit, the tree version, the game patch the engine data targets, and separately the
  patch of the prices and boss data, D-107); `league` (the pricing league; null only when every price is
  `unavailable` with `note: "offline run"`, which the schema enforces, D-233); `stages`; `ledger`;
  `prices`.
- **Required per stage:**
  - `id`; `loadoutName`, which carries the level and any `{id}` list (D-103, D-138); `level`;
  - `progress`: a C1 key for the campaign point reached, of the form `start`, `endgame` or
    `q.<QuestRewards key>` (D-214). V1 derives quest points, trial gates, the resistance penalty and gem
    availability from it;
  - `tree`: a complete, connected node list (recon §7 item 5), weapon-set tags, attribute choices and
    ascendancy nodes; a `respec` note with its gold cost wherever the tree drops a node the previous
    stage had (D-144);
  - `items`: item text per slot, tree jewels, flask and charm toggles, the second-weapon-set flag;
  - `skills`: socket groups, each with a `role` (`clear`, `single_target`, `utility` or `leveling`), gem
    levels and quality; the main skill at one group index shared by every stage (Target state 5); and
    `rolledGroup`, the 1-based index of the group that holds the rolled skill, set wherever the stage has
    it and required on endgame variant stages (D-217);
  - `config` (C-32) and `claims` (C-30-tagged).
- **Endgame variant stages** also require `variant` (`budget` or `non-budget`), per-gem levels,
  `ascendancyPoints` and `skills.rolledGroup` (D-217). D1 chooses these and the stage's `level` per
  variant, each with a source or a rationale; the schema fixes no values (D-193).
- `ledger[]` entries are `{id, claim, formula, inputs}` (C-33). `prices[]` entries are `{id, item,
  query, amount, currency, date, league, status, note?}`, where `id` is what a `price:<id>` claim cites
  (D-237), `status` is `ok` or `unavailable` (D-164, D-169), and an `unavailable` entry's `note` gives
  the reason (`offline run` in offline mode, D-233).
- Stages may share item, skill or config sets; the compiler names shared sets with `{id}` lists (D-103).
- Agents get a committed reference with a worked example (D-167), kept equal to the zod schema by a test.

**C-32 Config classes** (new; part of C-31, checked by V2).
- **Earned player state** (stacks, charges, conditions, flask and charm toggles):
  `{option, value, producer, uptime}`. `producer` is `{kind, name}`, with kind item, gem, passive,
  skill, flask or charm. V2 checks the producer is present in that stage (D-114).
- **Scenario inputs** (enemy level, `enemyIsBoss`, enemy damage per type and resistances, waystone
  modifiers, quest rewards, the resistance penalty): `{option, value, source}`, where `source` points
  into a C1 or E1 file and key.
  - **Baseline** (a subclass, D-230): a default-on option that models a neutral state, such as full life
    or mana, may stay at its default only if the committed `data/config-baseline.json` lists it with a
    one-line rationale. The same file may list placeholder-driven options (D-212).
- `compile_plan` writes every listed option explicitly into the stage's config set, and writes
  `enemyIsBoss` into every config set (D-119; PoB's default is Pinnacle, pin §B5).
- **Placeholders are values** (D-212). PoB applies a numeric option's placeholder when it has no input,
  and `enemyIsBoss` sets the placeholders of the enemy's level, damage, resistances, penetration,
  armour, evasion, speed and crit. An option so driven counts as set.
- **Default audit** (V2): any default-on or placeholder-driven option the stage doesn't list, and
  `data/config-baseline.json` doesn't list, is a finding, e.g. the quest-reward checkboxes (pin
  `Modules/ConfigOptions.lua:78`) or the enemy's resistances. Slice 2 enumerates the defaults from the
  defaults loop over PoB's `ConfigOptions` module, which creates no config set (review S21), and the
  placeholders from the stage's config set after its recalculation.
- **Save drops some values** (D-212): PoB saves no `<Input>` whose value equals the set's placeholder, so
  the XML may omit an explicit value. The compile record holds every stage's effective values,
  explicit, default or placeholder, with their class, and is authoritative (D-113).
- Reference hits enter as scenario inputs through the per-type enemy-damage options (pin §B5). Enemy life
  is no PoB option; it stays in the dossier and the ledger (E1 row).

**C-33 Compile record and ledger** (new; slice 2).
- `compile-record.json`, written by `compile_plan` next to the compiled plan (D-155, D-200). It holds:
  - the plan's `schemaVersion` and the engine versions actually used (pin tag and commit, tree version);
  - the PoB file's canonical builds-folder path (for a measure-only compile, the compiled XML's path
    relative to the guides root instead, D-208) and its sha1, and `importCode` (D-205). These are
    informational: overwrite permission comes from the write ledger, never from the record (D-211);
  - per stage, keyed by stage id: the loadout name, the level it was measured at, named outputs (PoB's
    `mainOutput` field names plus C-45's per-skill and per-stat-set fields), the effective config values
    with their origin and class (D-212), and the V1 and V2 verdicts with their findings (D-192);
  - per ledger entry, its re-evaluated value.
- **Ledger formulas** (in the plan) are arithmetic over numbers, `+ − × ÷`, parentheses and named
  references. A reference is either `<stageId>.<outputName>` from this record or an input declared in
  the entry with its C-30 tag. A small evaluator in `src/` computes them: no `eval`, no dependency
  (D-170). Slice 2 defines the grammar and its errors.
- V4 re-derives each entry from this record (D-142, D-179).

**C-34 Guides folder and run folder** (new; slice 2 owns the root, the path rules and run-folder
creation, slice 3 the layout inside a run).
- **Root:** `POB_GUIDES_DIRECTORY`, read only in `src/index.ts`. Default: `Guides` beside the builds
  folder (D-154), i.e. `…/Path of Building (PoE2)/Guides`, outside the folder PoB2 browses.
- **Root and builds folder are disjoint** (D-220): `guide_run`'s run-folder mode and `compile_plan`
  refuse a guides root whose real path equals, is inside, or contains the builds folder's real path.
- **Run folder:** `<root>/<slug>/<YYYY-MM-DD>-<n>/`, created by the server: `guide_run`'s run-folder
  mode makes it and returns its absolute path, which the skill and every agent use; no agent needs to
  know the root (D-207, D-216). A run never writes into an earlier run's folder; re-compiling within a
  run overwrites that run's own outputs (D-153).
- **Files** (D-200): `plan.json` (agents), `compile-record.json` (server), `dossier.md`, `guide.md`
  (includes the import code), `run-log.json` (D-158). Concept skeletons and verifier reports live in
  sub-folders that slice 3 names; each compiled plan gets its record beside it, and a measure-only
  compile also its compiled XML (D-208).
- **Server path rules** (D-155, D-177): the `plan_path` of `compile_plan` and of `guide_run`'s validate
  mode resolves relative to the root, symlinks resolved, and must stay inside it. The server writes only
  the run folders it creates (D-207), files next to that plan, the target PoB file through C-17 (never
  in measure-only mode, D-208), and that file's entry in the write ledger in its state dir (D-211).
- **Agents** write only inside the current run folder (D-177).

**C-35 C1 and E1 data files** (new; slice 2).
- Repo-root `data/campaign/*.json` (C1) and `data/enemies/*.json` (E1), outside `src/` (D-168). The
  compiler and checks load them through a zod-validated loader (an invalid file is an error naming the
  file and key); agents read them directly.
- **Shape:** `{schemaVersion, sources[], facts}`, where each `sources[]` entry is a C-30 tag with an id,
  and each fact is `{value, source, patch, confidence, note?}`: every value carries its own citation and
  patch (gap 18).
- **C1 holds** (C1 row, D-131): acts and interludes with area levels (interludes: base levels plus the
  dynamic +8, M); the book schedule (24 passive points and 24 weapon-set points); ascendancy trial gates;
  quest rewards (100 Spirit in total, resistances, life, mana, the permanent choices); the resistance
  penalty per stage (−10 each, −60 in endgame); gem availability by uncut-gem tier; the passive-point
  maximum (123, plus the M-confidence Martyr point).
- **E1 holds** (E1 row, D-116, D-119, D-132): the non-quest Arbiter of Divinity's datamined hits by damage
  type and its 0.5.5 resistances, and three low-confidence inputs for its fight life (A-30);
  map-monster life and damage by area level (PoB's tables, `pob-data`); waystone modifiers (M); no rarity
  multipliers (A-27).
- Per-guide values are copied into the plan with their tags, so a guide stays reproducible (D-168).

**C-36 Stage artifacts** (new; slice 3). What passes between the run-order steps (design "Run order"):

| Step | Run by | Reads | Writes | Must pass before the next step |
|---|---|---|---|---|
| R1a | Parallel lookup-only agents (≤ 3 per research round, D-161, D-235) | the roll; K1/K2 tools; C1/E1; web on D-171's hosts (none in offline mode) | dossier sections: mechanics, synergy search, 2–3 concept proposals (key uniques, ascendancy nodes, supports, keystones, feasibility read, risks, what PoB can't verify) | — |
| R1b | Coordinator | concept proposals | per concept: a skeleton plan, its measure-only compile record and XML (D-208), key-item prices (T1), added to the dossier | each skeleton compiles |
| Checkpoint 1 | Skill, asking the user (offline mode: a pre-supplied answer, A-28) | dossier | the chosen concept | the user picks one, asks for more (a new research round of up to 3 concepts, started only by the user, D-235), or stops (D-157) |
| D1 | Design-and-write workflow | chosen concept, dossier, C1/E1 | `plan.json` endgame stages for both variants; every slot priced | compile; V1 and V2 pass; the survival floor (all four resistances capped, chaos only by a recorded exception, D-234) and the budget (D-219) met, else D-141 |
| D2 | Same | the D1 plan | the campaign stages in `plan.json` | compile; V1 and V2 pass |
| W1 | Same | plan, compile record, ledger, dossier, template | `guide.md` with the import code | — |
| V3 | Verifier agent | plan, dossier, guide | provenance report | no untagged claim |
| V4 | Independent agents (≤ 3 lenses) | plan, record, dossier, guide, lookup tools, sources | claim report | no unresolved finding (D-179) |
| Checkpoint 2 | Skill, asking the user (offline mode: a pre-supplied answer, A-28) | guide, reports, run log | — | the user accepts, or asks for changes, which re-run the responsible stage, every later stage and the checks (D-236) |

Each step writes only its own outputs, and parallel agents never write the same file. Engine-changing
calls and every trade call are made only by the one coordinator; lookups (`read`-kind tools) may also be
called by the R1a research agents and the V4 agents (D-130, D-231).

- **Roll check.** Before any agent runs, the skill checks that the ascendancy exists and that the main
  skill is an active skill gem. If either check fails it stops, lists the closest valid names, and
  creates no run folder (D-238).
- **Run folder.** The skill's next step is `guide_run {new_run: <slug>}` (C-50); it passes the returned
  absolute path to every step and agent (D-207, D-216). When the reply's `loadedBuildUnsaved` is true,
  the skill asks the user before the run's first compile, which replaces the engine's build (D-210).
- **Retries and revisions.** Each stage retries at most twice after a failed check (D-127); the
  escalation then offers four choices: accept with the failure stated in the guide, give guidance and
  retry once more, go back to checkpoint 1, or stop. User-requested revisions at checkpoint 2 don't count
  against the retry cap; the run log records them (D-236).
- **Compiles in a run.** Only a run's final compile writes the PoB file into the builds folder (C-17);
  every earlier compile, R1b's skeletons included, uses the measure-only mode (D-208).
- **Offline mode** (D-201; the test mode M-12 runs in). The skill is started in it explicitly, and the
  run log records the mode. In it there is no trade, poe.ninja, WebSearch or WebFetch; research uses only
  the server's lookup tools (and the committed C1/E1 files); every price is `unavailable` with
  `note: "offline run"` (D-164), and the plan's `league` is null, the one case C-31 allows (D-233); a
  claim that would need an external source is tagged `external-unavailable` (C-30), which V4 accepts
  only in this mode; a claim copied from C1/E1 cites `data:<file>#<key>`, which V4 checks against the
  data file (D-232).
- **Pre-supplied checkpoint answers** (A-28). The skill accepts them only in offline mode, uses them in
  place of asking the user, and records each answer in the run log. Outside offline mode it refuses
  them and asks the user (D-157).

**New and modified tools.** Every new tool is group `core`; modified tools keep their groups. Inputs and
outputs are at the level the seams need; slice 1 or 2 carries argument types, wording and samples.

| ID | Tool | Status | Kind | Input | Output and compatibility |
|---|---|---|---|---|---|
| C-37 | `lookup_game_data` | new | read | `mode` (`gem`, `unique` or `mechanic`), `query`, mode filters (gem level and quality; unique slot), `max_results` (default 20, cap 30, D-225) | **gem:** PoB's tier (D-258); description; stat sets ("skill parts") with tooltip lines from PoB's stat describer; quality effects; weapon requirement; the level requirement per gem level and the attribute requirements (D-228); for supports, what they can and can't support. **unique:** matches by name, mod text or slot, each as item text ready for `add_item`. **mechanic:** keyword hits across gems, uniques, passives (ascendancy included) and mods, each with its kind and matching line. **No match (D-258):** "nothing matched", then the closest names of the kind searched, by edit distance to the query, then by name: in gem mode up to 5 active gems, then up to 3 supports (D-258a); otherwise up to 5; none for a query over 100 characters (slice 01 §2.2) |
| C-38 | `check_model_coverage` | new | read | one or more of `item_text`, `nodes` (ids or names), `gems`; or `build: true` for the loaded build | Per line, one status: fully parsed, partly parsed (with the remainder), unparsed, parsed to nothing (an empty mod list), possibly unread (a heuristic: spike S-b's by-name scan, D-226). A line is re-parsed alone, then with PoB's two-line join, before it is called unparsed (pin §B3). Per gem: skill stats possibly unmodelled (PoB's own red-tooltip rule, pin §B4), marked "check config" (D-123) |
| C-39 | `manage_sets` | new | mutate | `set_type` (`item`, `skill`, `config`, `loadout`); `action` (`list`, `create`, `copy`, `rename`, `select`; loadouts list and select only); `id`, `title`; `use_second_weapon_set` for item sets | The sets of that type with ids, titles and the active one; for skill sets, the group at the build-wide main index; loadouts as `SyncLoadouts` lists them. Never calls `CopyLoadout`. A title's `{id}` list must match `[A-Za-z0-9,]` with no spaces. No delete (new ids are `#sets+1`, pin §C) |
| C-40 | `set_tree_state` | new | mutate | On the active spec: `weapon_set_nodes` (allocated nodes tagged weapon set 1 or 2), `attribute_choices` (attribute node → strength, dexterity or intelligence) | The spec's tags and choices after the change, and the resulting attributes |
| C-41 | `compile_plan` | new | load (D-191) | `plan_path` (relative to the guides root); `build_name` (target in the builds folder, D-199; not used with `measure_only`); `stages` (optional subset, measure-only mode only, D-156; its semantics follow WU-30); `measure_only` (optional, D-208). Two modes, measure-only and final: run-folder creation and validation are `guide_run`'s (C-50, D-216) | Text summary: per stage the loadout, level, V1/V2 verdicts and ledger values, plus the paths written; the record itself is the file (C-33). The PoB file is saved in auto-level mode at the highest stage's level (D-138, D-149). The first stage reuses the new build's tree spec 1 and set 1 of each type, retitled, so the file holds one loadout per stage and nothing titled `Default` (D-215). The call replaces the engine's loaded build (D-191, D-210). It sends one engine request per stage plus a fixed overhead of five (D-221). **Measure-only mode:** compiles and measures in the engine as usual, then writes the compile record and the compiled XML beside the plan only; nothing goes to the builds folder or the write ledger. **Final mode:** an existing target is overwritten only under the write ledger's rule (D-211). **Errors** (`isError`): schema errors by JSON path (D-163); per-stage compile errors (unknown gem, item text that doesn't parse, unknown node, a node PoB's weapon-set connectivity rule leaves unconnected, broken weapon-set or attribute choice, an allocation PoB changed on import, D-213) with no PoB file written (D-162); an existing target with no write-ledger entry from this run (C-17's "already exists" wording), or one whose sha1 changed since this run's entry (C-17's changed-on-disk wording; D-211); a guides root overlapping the builds folder (D-220) |
| C-42 | `encode_build_code` | new | none | `build_name` (a builds-folder file, resolved as other build-file tools do, D-52) | The PoB2 import code: the inverse of `decodePobCode` (`buildCode.ts:71-105`). Decoding it reproduces the file's sets, loadouts, level mode and stage count (D-180) |
| C-43 | `search_tree_nodes` | modified | read | adds `ascendancy` (a name); `query` becomes optional when `ascendancy` is given | Every node of that ascendancy, notables included. `node_type:'any'` matches every type; results are sorted before the cap (D-175). **Compat:** callers now get correct results where they got none or an arbitrary subset |
| C-44 | `set_main_skill` | modified | mutate | documents `skill_part` (the 1-based stat set of the main active skill) | Selects PoB2's stat set, `srcInstance.statSet[grantedEffectId] = i` (pin `Modules/Build.lua:375-381`), which the build XML keeps (D-195). **Compat:** the undocumented argument used to write PoE1's `skillPart` |
| C-45 | `lua_get_stats` | modified | read | adds a per-skill breakdown option | Per active skill and per stat set: the `category:'offense'` fields, measured with that skill and part as main, then the exact prior state restored (D-176). Default and category views are unchanged. The tool is on C-1's 5000-char truncation list, so slice 1 bounds the breakdown |
| C-46 | `add_item` | modified | mutate | `slot_name` gains the tree-jewel socket slots | The jewel is socketed on the active spec (`<Sockets>`). **Compat:** additive enum |
| C-47 | `suggest_supports`, `get_passive_upgrades` | modified (amends D-77, D-78) | read | `get_passive_upgrades` adds `include_ascendancy` (default false, D-197) | Both add a list of what PoB can't measure beside the ranking: candidates whose measurement is null, and candidates with lines C-38 doesn't rate fully parsed. Ranking, `count` and AC-E39's order are unchanged. Included ascendancy notables are the build's own, priced in ascendancy points; those beyond the build's remaining ascendancy points are marked, not hidden (D-227). **Compat:** an added output section; defaults otherwise unchanged |
| C-48 | `update_tree_delta` | existing (defect fixed) | mutate | unchanged | Does what its description says: auto-paths added nodes along PoB's own path and enforces the 8-point ascendancy cap, returning the fields the TS side already reads (D-194). **Compat:** calls that relied on no auto-path now get connected trees |
| C-49 | `get_item_price`, `search_trade_items`; `get_leagues` (error prefix only) | modified (D-202, D-218) | none | unchanged; no batch mode: each call prices one item, and the rate limiter paces within its existing windows (C-11, D-160, D-224) | T1: every price result states its date and league (`get_item_price` names the league but gives no date today, recon §1). Every error that a `TradeError` (C-10) causes in these three tools reads `Error: [trade:<kind>] Failed to <action>: <message>`, where `<kind>` is the error's `TradeErrorKind` unchanged (`src/trade/errors.ts`: `would_wait`, `locked_out`, `rate_limited` for a 429 from the trade site, `http`, `no_session`, …); the pipeline classifies pricing outcomes by it (D-218). Other errors get no prefix, and `find_upgrades` keeps C-14's own wording. Nothing is cached (D-46); prices are kept in the plan (D-169). **Compat:** added output fields and an error prefix; group `trade`, unchanged; defaults otherwise unchanged |
| C-50 | `guide_run` | new (D-216) | read; a call carrying `new_run` is routed as `none` | exactly one of `new_run` (a slug, D-207) and `validate` (a `plan_path` relative to the guides root), plus optional `stages` with `validate` | **Run-folder mode** (`new_run`): creates `<root>/<slug>/<YYYY-MM-DD>-<n>/` with the next free `<n>` and returns its absolute path, its root-relative path `<slug>/<YYYY-MM-DD>-<n>` (the run's `plan_path` is that plus `/plan.json`), and `loadedBuildUnsaved`: whether the engine's loaded build has unsaved changes that the next compile would discard (D-210). It reads no plan, takes no session lock and never starts the engine. **Validate mode:** the schema check (D-163) and `compile_check`, the compiler's read-only preflight (D-213, D-221), so unknown gems, nodes, item bases and config options are found without compiling, and unknown producers are listed (D-167); the export and `revision` are unchanged. **Errors** (`isError`): a slug that isn't one safe path segment, or a guides root overlapping the builds folder (D-220), with nothing created; schema errors by JSON path; preflight defects per stage. **Compat:** new tool, group `core` |

## 4. Data and state model (deltas)

| Entity | System of record | Lifetime | Written by | Concurrency rule |
|---|---|---|---|---|
| Guides root and run folders | `POB_GUIDES_DIRECTORY` (C-34) | durable, the user's | `guide_run` (creates each run folder, D-207, D-216); `compile_plan` (records, and measure-only XML, beside the plan); skill and agents (plan, dossier, guide, run log) | one run per folder; one coordinator calls compile; parallel agents write disjoint files |
| `plan.json` | run folder | durable | agents' file tools (D-155) | edited only by the coordinator's current step, never during a compile |
| `compile-record.json` | run folder | replaced by each compile of its plan (D-153) | `compile_plan` | under the engine lock; informational only, never an overwrite permission (D-211) |
| Compiled PoB file | builds folder, through C-17 | durable | `compile_plan`, only in a run's final compile (D-208) | the write ledger's overwrite rule (D-211), then C-17's guard |
| Write ledger `guide-writes.json` | state dir (C-16) | durable | `compile_plan`, final mode only, right after the PoB file (D-211) | under the engine lock; temp file then rename; one entry per builds-relative path; no agent can write it (D-177) |
| C1 and E1 data files | repo `data/` | versioned with the repo | WU-39 | read-only at runtime |
| Engine build after a compile | engine and C-3's `loaded` record | until the next load | `compile_plan` (kind `load`), which replaces the user's loaded build; `guide_run`'s run-folder reply says whether that build has unsaved changes (D-210) | under the mutex; revision and snapshot per C-3 |
| Prices | `plan.json` `prices[]` | per run | coordinator | no server cache (D-46, D-169) |

**Migration:** none. Everything is new; the guides root is created by the first run, and the write
ledger by the first final compile.

## 5. Decision log

**Numbering.** D-1nn lifts design row nn (D-101…D-149). D-151…D-185 lift gap items 1–35 (D-150 + n).
D-190…D-208 are this spine's own. D-210…D-221 are the adversarial review's fixes (review Sn), and
D-222…D-238 the coordinator's resolutions of the slice writers' open items, both 2026-10-07. **Status:**
*settled* = a ratified design row; *accepted* = a gap item the user accepted on 2026-10-07; *deferred* =
a named gate (HG-15); **PROPOSED** = this spine's, overridable at ratification; *review fix* and
*resolution* = binding, overridable at ratification; **PROPOSED, pending the user** = a question put to
the user, proceeded on until answered. Proceed on all of them; don't relitigate. Rationale for lifted
rows is in the source row.

| ID | Decision | Status; divergence |
|---|---|---|
| D-100 | The inputs listed at the top are the only sources of requirements. The gaps' milestones M-3 and M-4 are M-12 and M-13 here (D-206) | — |
| D-101 | Output: a written guide plus a PoB2 build that someone who has never seen the build can follow | settled |
| D-102 | Shape: a staged pipeline around a build plan file | settled (user) |
| D-103 | Each guide stage is a PoB2 loadout; shared sets use `{id}` lists such as `Early Game {1,2}`. Braces hold only `[A-Za-z0-9,]`, no spaces; the loadout's name comes from its tree set; never `CopyLoadout` on `{id}` names (it crashes) | settled; spike S-a |
| D-104 | Endgame is designed first; the campaign is planned backward from it | settled |
| D-105 | Every claim shows its source: PoB-computed, PoB game data, external (linked), or judgment (C-30) | settled |
| D-106 | PoB numbers only where PoB models the mechanic; otherwise a hand calculation with stated assumptions (the ledger) | settled |
| D-107 | Each guide names its engine data version (pin and targeted game patch) and, separately, the patch of its prices and boss data. The first guide: 0.5.4 engine data, 0.5.5 prices and boss resistances | settled |
| D-108 | Each campaign preset is valid at its level: points, gem and item level requirements, attributes, PoB warnings (V1) | settled |
| D-109 | The player is in a trade league. Buyable uniques are allowed in campaign presets, hard-to-get drops are not; availability is judged from dated listings; rares are affix targets | settled |
| D-110 | The leveling skill may differ from the main skill; a conventional leveling build carries until the main skill's level requirement | settled |
| D-111 | Budget ceilings are real prices, checked on the trade site at generation and dated | settled |
| D-112 | Trade and poe.ninja only through the server, from one coordinator, within a per-guide search budget (paced, D-133). Web research is allowed (D-171) | settled |
| D-113 | The plan is the source of truth. The compiler builds the PoB file and a compile record from it; the guide's numbers come from the record, the ledger, dated prices and E1. The PoB file is a new file, never written over an existing one | settled |
| D-114 | Two config classes: earned player state names its producer and the guide explains uptime; scenario inputs name their E1 or C1 source. The compiler writes every relevant value; a default audit flags unjustified default-on values (C-32) | settled |
| D-115 | No encounter input; "as strong as possible" within budget, which applies to the non-budget variant (D-147) | settled |
| D-116 | Budget variant: about 20 divines or less; target T15 maps (area 79) without dying often. The non-quest Arbiter of Divinity is reported, not gated: max hit against its datamined hits, time-to-kill under E1's stated life assumption | settled; the tolerance of "about 20" is D-219 |
| D-117 | Non-budget variant: about 200 divines as a reference, not a hard cap. Target: T16 (area 80) up to area 82, heavily modded waystones and tablets | settled |
| D-118 | Survival floor first (capped resistances at PoB's Endgame −60% setting; max hit taken above the reference hits), then everything else on damage | settled; which resistances are gated is D-234 |
| D-119 | Endgame gate: the survival floor. Reported with confidence: time-to-kill and mapping signals. Every config set states `enemyIsBoss`. Mapping reference hits come from PoB's monster damage table at the area level with waystone damage modifiers | settled |
| D-120 | Guides are mapping builds that can kill the pinnacles with extra effort. One loadout has a one-click clear skill and a single-target setup; when forced, favor mapping | settled |
| D-121 | Clear-speed signals (judgment): movement speed first, then clicks per pack | settled |
| D-122 | The rolled skill is the main source of damage, never a token role | settled |
| D-123 | Combo and buff states come from config where PoB2 covers them, otherwise from hand calculations; research lists the config gaps | settled |
| D-124 | Research proposes 2–3 concepts; the user picks one at checkpoint 1. R1a runs lookup-only agents in parallel; R1b, the coordinator, compiles, measures and prices each | settled |
| D-125 | User checkpoints: the concept pick and the final guide. A concept infeasible in D1 returns to checkpoint 1 with evidence | settled |
| D-126 | The guide is markdown in a per-guide folder inside a configurable guides folder outside the builds folder, and includes the import code | settled |
| D-127 | First run capped at 3 concepts and 3 verify lenses, measured, then the envelope is set (HG-15). Each stage retries at most twice after a failed check, then escalates | settled (user) |
| D-128 | Plan format: a schema validated by P2. Refined to JSON with zod by D-167 | settled |
| D-129 | The pipeline is a skill plus two saved workflows split at checkpoint 1; the skill holds the hand-off | settled |
| D-130 | Engine concurrency: every step that changes the loaded build or calls trade runs through one coordinator. Lookups take the session lock and only queue. A per-agent inline server is deferred (HG-15) | settled |
| D-131 | Campaign data: PoB's `Data/QuestRewards.lua` and `Data/WorldAreas.lua`, plus external sources for interlude levels (dynamic, +8). An uncut skill gem of level N cuts a skill of tier ≤ N. `plan_leveling`'s data is not reused | settled |
| D-132 | Mapping strength is a hand calculation: the clear skill's hit against PoB's monster life at the area level (area 79: 24,852), times waystone life modifiers and rarity and variety multipliers. For areas 80–82 it is a stated judgment | settled; see A-27 |
| D-133 | Pricing is paced, not capped, in priority order: concept key items, each variant's full slot list (rares as affix-target searches), then campaign uniques. Each price is dated and names its league. Its "cached within a run" is replaced by D-169 | settled |
| D-134 | No checkpoint after D1; revisit if the first run shows endgame mistakes leaking into the campaign plan (HG-15) | settled (user) |
| D-135 | Guides folder: an env var with a default outside the builds folder (D-154) | settled (user) |
| D-136 | Marketplace plugin packaging | deferred (HG-15) |
| D-137 | Unique-jewel trade rows | deferred (HG-15) |
| D-138 | Character level is build-wide. The file's level is the highest stage's level, saved in auto mode (D-149). Compile measures each stage at its own level. Loadout names carry the level, e.g. `Act 2 (L25) {2}`. V1 takes each stage's level from the plan | settled (user) |
| D-139 | 1.0 ships 2026-12-11. After a pin upgrade a guide is regenerated by re-running compile and checks on its plan. Patch notes are read from mirrors; fetching from pathofexile.com needs the user's approval | settled (user) |
| D-140 | Upgrading the pin to 0.5.5 data waits for the next PoB2 release | deferred (HG-11, HG-15) |
| D-141 | Failure paths: no viable concept → checkpoint 1 shows the best attempts and why each fails. Concept infeasible in D1 (floor unmet, over budget, or the rolled skill not the main damage source) → back to checkpoint 1 with evidence. Failed check → the stage re-runs with the findings, at most twice, then escalates | settled |
| D-142 | Claims are verified for truth by V4, an agent that didn't write the plan | settled |
| D-143 | Ranker amendments (C-47): both rankers list what PoB can't measure; `get_passive_upgrades` can include ascendancy notables | settled; **amends D-77, D-78** (their result shape) because unmeasurable candidates fall off or are excluded today; AC-E39's ordering is kept |
| D-144 | Tree continuity: each stage's tree contains the previous one's, except at named respec points, which the guide lists with their gold cost | settled |
| D-145 | The compiler produces the PoB2 import code, and the guide includes it | settled |
| D-146 | Each endgame variant states its character level, gem levels and ascendancy points | open in the design; decided by D-193 |
| D-147 | Budget objective: reach T15 as cheaply as possible, never above about 20 divines. Non-budget: as strong as possible around 200 | settled (user) |
| D-148 | The rolled skill should be the clear skill; the single-target role only when it can't clear, and the guide says so | settled (user) |
| D-149 | The PoB file is saved in auto-level mode; the compiler still measures at the plan's levels | settled (user) |
| D-151 | The alpha exit is M-13 (§7) | accepted |
| D-152 | The skill and workflows live in project scope: `.claude/skills/build-guide/` and `.claude/workflows/` | accepted |
| D-153 | Each run writes a new dated folder `<guides>/<slug>/<YYYY-MM-DD>-<n>/` and never overwrites an earlier run; re-compiling within a run overwrites that run's outputs | accepted |
| D-154 | Guides root default: `Guides` beside the builds folder; override `POB_GUIDES_DIRECTORY`; Jest redirects it to a temp dir | **HUMAN** (user, 2026-10-07) |
| D-155 | Agents write `plan.json` with their file tools; `compile_plan` reads it only from inside the guides folder (no traversal, no symlinks out); it writes the PoB file through `buildFileWriter` and the compile record and import code into the run folder | accepted |
| D-156 | One `compile_plan` call holds the session lock and sends one engine request per stage, each under its 30 s timeout; `stages` compiles a subset. WU-30 measures first | accepted; **amended by D-221** (plus a fixed overhead of five requests) and D-229 (the 20 s margin) |
| D-157 | Checkpoint 1: the skill shows the concepts as a short comparison (synergy, numbers, key prices, risks, what PoB can't verify) and asks with AskUserQuestion: pick one, ask for more, or stop | accepted |
| D-158 | Each run writes `run-log.json`: stage times, agent counts, retries, price searches used | accepted |
| D-159 | A 15-stage plan compiles in ≤ 100 s on this machine; WU-30 sets the real figure; a miss is HG-13 | accepted; WU-30's pass mark is D-229 |
| D-160 | Pricing stays inside every rate-limit window the server tracks and never triggers a 429; measured, not capped | accepted |
| D-161 | The first run uses at most 3 concepts and 3 verify lenses; the run log records actuals | accepted; the concept cap is per research round (D-235) |
| D-162 | Compiling is all-or-nothing per call: an error in any stage writes no PoB file and is returned per stage | accepted |
| D-163 | Schema errors return their JSON path and nothing compiles | accepted |
| D-164 | Trade unavailable (no cookie, rate-limited, down, or disabled): those prices are `unavailable`; the guide can't claim the variant is under budget; checkpoint 2 says so | accepted |
| D-165 | An engine crash mid-compile runs the session's recovery (C-3) and fails the call; compiling is idempotent | accepted; **citation corrected:** gap 15 cites C-5, which is the reply schemas; session recovery is C-3. The compile's `new_build` has dropped the snapshot, so recovery takes C-3's no-snapshot path (review S2, §3.1 C-3) |
| D-166 | Failures follow D-141 | accepted |
| D-167 | The plan is JSON with `schemaVersion`, validated by zod (already a dependency); agents get a committed reference and worked example; a validate-only mode checks a plan without compiling it (gap item: a `compile_plan` mode; now `guide_run`'s validate mode, D-216) | accepted; refines D-128's "YAML or JSON with a JSON Schema". **Amended by D-216:** the validate mode is `guide_run`'s |
| D-168 | C1 and E1 are sourced JSON data files under `data/campaign/` and `data/enemies/`, each value with citation and patch; loaded by the compiler and checks, read by agents, copied per guide into the plan; kept out of `src/` strings | accepted; **diverges from D-3/D-30** ("no constants of our own in advice"): these are cited game facts tied to a patch, not invented advice thresholds; D-203 scopes it |
| D-169 | Prices are recorded in the plan with date, league and query; re-runs within a run reuse them; the server keeps no price cache | accepted; keeps **D-46**; replaces D-133's "cached within a run" |
| D-170 | The compile record keys per-stage outputs by name; ledger formulas reference those names; a small safe evaluator, no `eval`, no dependency | accepted |
| D-171 | Web research uses WebSearch/WebFetch on poe2db.tw, maxroll.gg, game8, poe-vault and patch-note mirrors; never pathofexile.com or poe.ninja; poe2wiki.net and mobalytics refuse agents | accepted; runtime only (D-201) |
| D-172 | Without the Workflow tool, the skill runs the same stages with the Agent tool: same artifacts, fan-out ≤ 3 | accepted |
| D-173 | Extend existing tools where natural (C-43…C-46); group new ones (C-37…C-42); at most 8 new tools, total under 86 | accepted; **resolves stab HG-3** for exactly these tools. D-216 adds a seventh, `guide_run` (C-50), inside the cap |
| D-174 | Contract deltas: D-77/D-78 per D-143; C-1's stale 76 corrected; the literal 77 moves to the new total at every count site (§1.3) | accepted |
| D-175 | Existing defects fixed in slice 1: `update_tree_delta` (D-194); the `set_main_selection` Lua action behind `set_main_skill` writes `skillPart` (D-195); the two `search_tree_nodes` bugs (C-43); D-65's stale text (D-198) | accepted |
| D-176 | A `read` tool leaves the exported build and `revision` unchanged, so lookups and measurements of a non-main skill part restore the exact prior state, and a test proves it | accepted |
| D-177 | The server writes only to the builds folder (via `buildFileWriter`), the state dir and the guides folder; the guides folder joins the allowed roots with the same no-traversal, no-symlink rules; agents write only into the current run folder | accepted; **extends D-42/D-88**, which confine path arguments to the builds folder and state dir, because plans and records must live outside both (D-126, D-18) |
| D-178 | Secrets and identity rules unchanged: never read `.env`, no identity in requests, trade only through the server. Research agents get no trade tools; only the coordinator prices | accepted |
| D-179 | V4 re-derives every ledger entry, opens the source of every `external` claim, and re-checks PoB-data claims with the lookup tools: all of them in endgame sections, at least 1 in 5 elsewhere. The guide passes only with no unresolved finding | accepted |
| D-180 | `encode_build_code` output decodes to XML whose sets, loadouts, level mode and stage count match the compiled file | accepted |
| D-181 | No live requests during the build: tests and agents stay offline (D-34). M-12's run has trade and poe.ninja disabled; prices show `unavailable` | accepted |
| D-182 | The live alpha run needs the user's approval, asked at the start of M-13 | accepted; HG-14 |
| D-183 | The build's human gates are §6.3's | accepted |
| D-184 | The risk register is §9's | accepted |
| D-185 | Plugin packaging, the pin upgrade, unique-jewel trade rows and per-agent engines stay named gates | accepted; HG-15 |
| D-190 | Tool names and kinds: `lookup_game_data` (read), `check_model_coverage` (read), `manage_sets` (mutate), `set_tree_state` (mutate), `compile_plan` (load), `encode_build_code` (none), and, by D-216, `guide_run` (read; its `new_run` calls routed as none). The grouping is gap 23's; the names and argument names are the formalizer's | PROPOSED |
| D-191 | `compile_plan` is kind `load`: S-a's verified recipe starts with `new_build`, which replaces the engine's build (C-8). As with `import_build`, the compiled build stays loaded and its file is recorded by `noteSaved` (C-17), so agents can read it with the existing read tools. Rejected: `withTemporaryBuild` (kind `read`), which would hide the compiled build | PROPOSED |
| D-192 | V1 and V2 run inside `compile_plan` after each stage is measured, and their verdicts go into the record. A failed check is a finding, not a compile error: the call succeeds and D-141 applies. V1 also checks tree continuity (D-144). Basis: the quality bar's "passed the validity check at its level when compiled", and D-114 puts the default audit in the compiler. Rejected: separate check tools (they need each stage's compiled state, and would spend gap 23's spare slots) | PROPOSED |
| D-193 | Row 46: the plan schema requires `level`, per-gem levels and `ascendancyPoints` on every endgame variant stage (C-31). The D1 agent chooses them per variant and records a source (a C-30 tag) or a rationale (a `judgment` tag). The spec fixes no numbers. V1 checks requirements against them | PROPOSED |
| D-194 | `update_tree_delta` is fixed to its description (auto-path along PoB's path, as `search_nodes` exposes it; the 8-point ascendancy cap), since the TS side already reads the reply fields. Rejected: rewriting the description, a contract change (HG-12) | PROPOSED |
| D-195 | `skill_part` is documented in `set_main_skill`'s schema and selects PoB2's stat set through `set_main_selection`, replacing the `skillPart` write | PROPOSED |
| D-196 | Auto-level mode is bridge-only: `set_level` gains an optional auto flag used by `compile_plan`. `set_character_level` isn't among gap 23's extended tools, so exposing it is HG-12 | PROPOSED |
| D-197 | `get_passive_upgrades` includes ascendancy notables only with `include_ascendancy: true`: the build's own ascendancy, priced in ascendancy points. The default keeps D-77's output, whose exclusion fixed unallocatable notables priced in passive points | PROPOSED; refined by D-227 |
| D-198 | D-65's text is corrected: crash recovery restores with `keepLevel: true` (`src/engine/session.ts:555-558`), so an auto-mode level (D-149) survives a restore. The coordinator applies this and C-1's count to the stab spine's text at ratification; no work unit does | PROPOSED |
| D-199 | `compile_plan` writes to `build_name` in the builds folder. An existing file is refused unless this run wrote it and nobody changed it since, which the server's write ledger decides (a re-compile within the run, D-153, D-211); C-17's changed-on-disk guard still applies. This keeps D-113's "never over an existing file" | PROPOSED; **amended by D-211:** the exemption first came from a compile record in the run folder; it now comes from the write ledger, never from the record |
| D-200 | Run-folder names: `plan.json`, `compile-record.json` (gap 5), `run-log.json` (gap 8), `guide.md` (design), and `dossier.md` (the formalizer's name for the research dossier). Compile outputs go beside the compiled plan, so concept skeletons in sub-folders get their own records | PROPOSED |
| D-201 | M-12 runs fully offline, in the pipeline's offline mode (C-36): no trade, no poe.ninja, no WebSearch, no WebFetch. Research uses only the server's lookup tools (and the committed C1/E1 files); a claim that would need an external source is tagged "external source unavailable (offline run)" (`external-unavailable`, C-30), and V4 accepts that tag only in offline mode. Web research on D-171's hosts happens only in M-13, under the user's approval (HG-14). This keeps the build's host rule (GitHub and the npm registry only). Replaces the former HG-17 | PROPOSED |
| D-202 | T1 (dated pricing) belongs to slice 1 (WU-49, C-49): the price-check outputs add the date and league (`get_item_price` gives no date today), plus any batch-pricing mode the pipeline needs, all within the rate limiter's existing windows (C-11, D-160). There is no server cache (D-46 stays); prices are recorded in the plan (D-169, gap 19). The pricing procedure (D-133 priority, D-160 pace, D-164 unavailable) stays a shared reference in the skill (WU-43). The ratified slicing names no T1 unit; this places it | PROPOSED; D-224 settles that no batch mode is needed |
| D-203 | D-3 and D-30 stay binding for the advice tools and for the files the advice-threshold scan covers. V1, V2 and the data loaders live outside them (`src/plan/`, `data/`) | PROPOSED |
| D-204 | C1 and E1 values come only from the pinned PoB data and `docs/design/grounding/2026-10-07-external-game-data.md` (accessed 2026-10-07), each with its source, patch and confidence. No web fetch during the build | PROPOSED |
| D-205 | The import code is the compile record's `importCode` field; W1 copies it into `guide.md` | PROPOSED |
| D-206 | Milestones are renumbered M-10…M-13 because the stab spine already uses M-0…M-3 | PROPOSED |
| D-207 | The server owns the run-folder layout. A run-folder mode (`new_run`, a slug), now `guide_run`'s (D-216), creates `<guides>/<slug>/<YYYY-MM-DD>-<n>/` and returns its absolute path; the skill and every agent use that path, so none needs the server's `POB_GUIDES_DIRECTORY` (the MCP registration's env, which agents can't see). Replaces the former HG-16 | PROPOSED; **amended by D-216:** first written as a `compile_plan` mode, to keep the new-tool count at 6, with a new tool rejected; D-216 moved the mode to the new tool `guide_run`, and the total is now 7 |
| D-208 | Concept-skeleton compiles (R1b) write no PoB file to the builds folder. `compile_plan`'s measure-only mode compiles and measures in the engine and writes the compile record and the compiled XML into the run folder only. Only a run's final compile writes into the builds folder, through `buildFileWriter` (C-17, D-199). Replaces A-26 | PROPOSED |
| D-210 | `guide_run`'s run-folder reply includes `loadedBuildUnsaved`: whether the engine's loaded build has unsaved changes (`session.isDirty()`). A compile replaces the loaded build (D-191), so when it's true the skill asks the user before the run's first compile | settled (user, 2026-10-08; review S2) |
| D-211 | **The write ledger.** The server keeps `guide-writes.json` in its state dir (C-16): per builds-relative path, `{path, sha1, runFolder, writtenAt}` from the last final compile that wrote it. No agent can write there (D-177). A final compile may overwrite an existing builds-folder file only when the ledger's entry for that path names the plan's run folder **and** the file's current sha1 equals the entry's, i.e. nobody edited it since. Otherwise it's refused: with C-17's changed-on-disk wording when this run's entry no longer matches the file, and with C-17's "already exists" wording when the ledger has no entry for this run (D-113). Measure-only compiles never touch the ledger or the PoB file. Order: check, write the PoB file through C-17, write the ledger entry, write the record; a failure after the PoB write still leaves the ledger entry, so a retry can overwrite. `compile-record.json` is informational. Basis: C-17's in-memory guard doesn't survive a restart and is refreshed by an auto-reload; the record is agent-editable; a measure-only compile rewrote the record and so blocked the run's final re-compile. **Amends D-199** | review fix (S3) |
| D-212 | **Config placeholders are values.** PoB applies a numeric option's placeholder when it has no input (`BuildModList`, pin `Classes/ConfigTab.lua:883-900`), the enemy level's through `UpdateLevel` (`:870-880`), and `enemyIsBoss` sets the placeholders of the enemy's level, damage, resistances, penetration, armour, evasion, speed and crit (`Modules/ConfigOptions.lua:1964-1997`). So the default audit (C-32) covers placeholder-driven options: each one that affects calcs is either set explicitly per stage from C1/E1 (a scenario input) or listed in `data/config-baseline.json` with a rationale (D-230). The compile record stores each stage's effective values, explicit, default or placeholder, with their class. PoB's Save writes no `<Input>` equal to its placeholder (`ConfigTab.lua:712-714, :741-742`), so the record, not the XML, is authoritative (D-113). Corrects slice 2's A-P4 | review fix (S4) |
| D-213 | **Tree connectivity follows PoB's weapon-set rule.** The preflight applies `CanPathThroughAllocMode` (pin `Classes/PassiveSpec.lua:826-830`): an untagged node paths only through untagged nodes; a node tagged weapon set n also through nodes tagged n. `compile_stage` reads back PoB's allocation with its tags, and the compile fails naming any node PoB dropped, added or re-tagged, because PoB prunes unconnected nodes silently | review fix (S5) |
| D-214 | Progress keys (C-31) are `start`, `endgame` or `q.<QuestRewards key>`. WU-38's schema defines the format; WU-39 implements the data and the membership check, and owns the two-stage fixture's keys and `plan-reference.md` alongside | review fix (S6) |
| D-215 | The first stage reuses the new build's tree spec 1 and its item, skill and config set 1, retitled to that stage's titles; later stages create new ones. A compiled file holds exactly one loadout per stage and nothing titled `Default` | review fix (S7) |
| D-216 | **New tool `guide_run` (C-50)** takes `compile_plan`'s former run-folder and validate modes. The run-folder mode makes no engine call and runs outside `session.run`; the validate mode is kind `read`, checks names against the game data with read-only lookups, and mutates nothing. `compile_plan` keeps the measure-only and final modes, kind `load`. New tools: 7; totals 84, and 83 without poe.ninja, inside D-173's cap of 8. Basis: as modes of a `load` tool, both started luajit, bumped `revision` and marked the build dirty. **Amends D-207 and D-167** | review fix (S8) |
| D-217 | Each skill group (C-31) has a `role`: `clear`, `single_target`, `utility` or `leveling`. Each stage that has the rolled skill records the group holding it as `skills.rolledGroup`; the schema requires it on endgame variant stages and checks, wherever it is set, that the group holds the rolled skill. The rolled-skill gate (D-122, D-148) compares within the role | review fix (S9) |
| D-218 | WU-49 prefixes every error a `TradeError` causes in `get_item_price`, `search_trade_items` and `get_leagues` with a stable `[trade:<kind>]`, after `Error: `. `<kind>` is the `TradeErrorKind` unchanged (`src/trade/errors.ts`): `would_wait`, `locked_out`, `rate_limited` (a 429 from the trade site), `http`, `no_session`, …. `find_upgrades` keeps its own wording, since its rate-limit stops aren't errors. The pipeline's run log classifies pricing outcomes by the prefix (NFR-22) | review fix (S12); the review's `http_429` is corrected to the real kind, `rate_limited` |
| D-219 | **Budget tolerance** for "about 20 divines" (D-116, D-147): a total of at most 20 passes; more than 20 and at most 22 passes with a "near the ceiling" note in the guide; more than 22 fails | settled (user, 2026-10-08; review S15) |
| D-220 | `guide_run`'s run-folder mode and `compile_plan` refuse a guides root whose real path equals, is inside, or contains the builds folder's real path | review fix (S16) |
| D-221 | `compile_check` returns, for each producer the plan names, whether it exists in the game data (V2's `producer-unknown`). A compile sends one engine request per compiled stage plus a fixed overhead of five: the preflight (`compile_check`), `new_build`, `compile_finish`, the XML export and the session's snapshot export. **Amends D-156**, including the coordinator's earlier "plus at most one read-only preflight request" | review fix (S20) |
| D-222 | The C-2/C-5 changes to existing Lua actions are a modified contract, listed in §3.1: additive params on `search_nodes`, `get_stats` (with an additive reply field), `set_level` and `set_tree`; `update_tree_delta`'s completed reply; `set_main_selection`'s `skillPart` param renamed `statSet`, which is internal because only `set_main_skill` calls it | resolution |
| D-223 | Tree-jewel slots join only `add_item`'s `slot_name` enum. The shared `ITEM_SLOTS` and AC-E38 are unchanged | resolution |
| D-224 | C-49 gets no batch mode: each call prices one item, and the rate limiter does the pacing | resolution; settles D-202's "any batch-pricing mode" |
| D-225 | `lookup_game_data`'s `max_results` defaults to 20 and is capped at 30 | resolution |
| D-226 | `check_model_coverage`'s "possibly unread" status follows spike S-b's by-name scan | resolution |
| D-227 | With `include_ascendancy`, notables beyond the build's remaining ascendancy points are marked, not hidden | resolution; refines D-197 |
| D-228 | `lookup_game_data`'s gem mode also gives the gem's level requirement per gem level and its attribute requirements, which D2 and V1 need | resolution |
| D-229 | **WU-30's pass mark** (HG-13's margin): every per-stage engine request finishes in under 20 s, a third below the 30 s request timeout (`POB_TIMEOUT_MS`), and a 15-stage plan compiles in at most 100 s in total. A miss is HG-13 | resolution; refines D-159, NFR-21 |
| D-230 | **Baseline config options.** C-32's scenario inputs gain a `baseline` subclass: default-on options that model a neutral state, such as full life or mana. Such an option may stay at its default only if the committed `data/config-baseline.json` lists it with a one-line rationale; the default audit accepts listed options; any other default-on option is justified as earned state or a scenario input, or set explicitly | resolution |
| D-231 | Lookups (`read`-kind tools) may be called by the R1a research agents and the V4 agents. Engine-changing calls and every trade call are made only by the coordinator. C-36's wording is corrected to match D-130 | resolution |
| D-232 | Offline, V4 checks a claim derived from C1/E1 against the data-file fact and the citation stored there; the claim cites the fact as `data:<file>#<key>` (C-30). Fetching the fact's external URL isn't required offline | resolution |
| D-233 | The plan's `league` may be null only when every price is `unavailable` because the run is offline, i.e. with `note: "offline run"`; the schema enforces this conditionally | resolution |
| D-234 | The survival floor (D-118) gates fire, cold, lightning **and chaos** resistance at their caps. Chaos may stay uncapped on an endgame variant stage only when that is absolutely necessary, and only through the stage's recorded exception, `chaosResistException: {reason, tag}` (C-31): the reason names what makes the cap infeasible (for example Chaos Inoculation, or no slot that can carry chaos resistance without dropping a core item or breaking the budget). With the exception, the floor passes with a finding and the guide's `Checks` states the uncapped value and the reason; without it, `MissingChaosResist` above 0 fails the floor | settled (user, 2026-10-08: "only leave chaos res uncapped if it's absolutely necessary") |
| D-235 | The 3-concept cap (D-127, D-161) applies per research round. "Ask for more" at checkpoint 1 starts a new round of up to 3 concepts. Only the user starts one, never automatically, and the run log records every round | resolution |
| D-236 | At checkpoint 2 the user may ask for changes: the coordinator maps each request to the stage responsible, re-runs it and every later stage, and re-runs the checks. These revisions don't count against the retry cap, but the run log records them. When retries are exhausted (D-127), the escalation offers four choices: accept, with the failure stated in the guide; give guidance and retry once more; go back to checkpoint 1; stop | resolution |
| D-237 | A price claim cites `price:<id>`, where `<id>` is a `prices[].id`: the plan's price entry, which holds the date, league and query. `prices[]` entries gain an `id` | resolution |
| D-238 | Before any agent runs, the skill checks the roll: the ascendancy exists (`get_classes`) and the main skill is an active skill gem (a gem lookup). If either check fails, it stops and lists the closest valid names; no run folder is created | resolution |

## 6. Autonomy envelope

### 6.1 Settled (proceed, don't relitigate)

Everything in §5 and every contract in §3. The stab spine's §6 decisions and §3 contracts, except where
§3.1 amends them.

### 6.2 Assumptions (proceed-on)

| ID | Assumption | Basis | If wrong |
|---|---|---|---|
| A-20 | Everything K1 and K2 read (gems, skills and stat sets, the stat describer, ascendancy nodes, uniques, `modLib.parseMod`, skill stat maps) is in memory after a headless boot | pin §B2 (probe b2) | The unit reports `blocked`; a missing piece is HG-12 |
| A-21 | S-a's recipe scales to a full plan, and PoB2's desktop GUI shows the loadouts as the headless save wrote them (S-a didn't test the GUI render) | pin §C | WU-30 or the user's import at M-13 shows it; escalate |
| A-22 | Workflow agents share the session's MCP server and so its one engine | platform §1 (S-c) | No harm: the coordinator still serializes engine work |
| A-23 | A skill can start a saved workflow with `Workflow({name, args})` | platform §2 | D-172's Agent-tool fallback |
| A-24 | A research agent's tool allowlist can name single MCP tools, limiting it to lookups | platform §3 | The skill keeps engine and trade tools with the coordinator only |
| A-25 | Claude Code backgrounds an MCP call after 120 s; that bounds one `compile_plan` call | stab D-22 rationale | `stages` subsets (D-156) |
| A-26 | *Withdrawn → D-208:* concept-skeleton compiles are measure-only and write no PoB file to the builds folder | — | — |
| A-27 | E1 carries no magic or rare monster life multiplier: none was found for 0.5 (ext §3) and PoB has none (pin §B6). Mapping-strength estimates use normal-monster life and state the rarity effect as judgment, confidence L | design "still open" list | A sourced figure is added to E1 with its citation |
| A-28 | The coordinator runs M-12 and answers its checkpoints: at checkpoint 1 it picks the first concept that passes its checks, or exercises the no-viable-concept path (D-141) if none does; at checkpoint 2 it reviews the guide. The answers are recorded in the run log. The skill accepts pre-supplied checkpoint answers only in offline mode (C-36); M-13's checkpoints are the user's | needed for an unattended run | The user vetoes at ratification |
| A-29 | Values the grounding rates M or L (interlude +8, the third and fourth trials' 65+/75+ dispute, the Martyr point, waystone mod sizes) are used as recorded, and a check that rests on one says so in its finding | ext §2–§4 | Corrected in the data file with a citation |
| A-30 | The Arbiter of Divinity's in-fight life is unpublished. E1's profile records three inputs for it, each labelled confidence L: the datamined base stats (poe2db's life 246,035 plus 24,603 energy shield at level 79, which is not the fight value); ext §4's extrapolated estimate (about 8M, from the Arbiter of Ash's about 34× fight-to-base ratio), with that method; and the user's community report (about twice the quest version's life, design row 16). The guide reports time-to-kill as a range under those assumptions | The Arbiter check is report-only (D-116); ext §4; design row 16 | A sourced in-fight figure replaces the range in E1, with its citation |
| A-31 | Spirit-gem availability isn't grounded beyond the Act 3 reward, so V1 notes Spirit gems instead of checking them | coordinator resolution (2026-10-07); C1 has no Spirit-gem table | A sourced table is added to C1, and V1 checks it |
| A-32 | Respec gold costs have no source, so `respec.goldCost` carries `judgment` tags | coordinator resolution (2026-10-07); no grounding row | A sourced cost table is added to C1 |

### 6.3 Human-decision gates (stop and escalate, `blocked:needs-human`)

The stab spine's HG-1…HG-9 stay in force. In particular HG-1 (any live request to pathofexile.com or
poe.ninja), HG-6 (the user's builds folder; it now covers the user's guides folder too) and HG-8
(signing).

| ID | Condition | Why a human | Unblocks with |
|---|---|---|---|
| HG-10 | Any dependency change (`package.json`, lockfile) | gap 33; stab §8 dependency rule | The user's decision |
| HG-11 | Any change to `pob-pin.json` | Golden values move; D-140 waits for the next PoB2 release | The user, after a PoB2 release |
| HG-12 | Any tool-set or tool-contract change beyond C-37…C-50 and D-143/D-174/D-175/D-202/D-216: an 8th new tool, exposing auto-level mode on `set_character_level`, retyping `search_tree_nodes` node types, … | UX scope; token cost (D-173) | The user's decision |
| HG-13 | WU-30 finds a 15-stage plan compiles in more than 100 s, or one stage's engine request takes 20 s or more, a third below the 30 s timeout (D-229) | gap 9 | The user picks a new budget or approach |
| HG-14 | Starting the live alpha run (M-13): live trade and poe.ninja requests through the server, web research on D-171's hosts, writes to the real guides and builds folders | gap 32; shared rate limits; the user's folders | The user's approval, asked at the start of M-13 |
| HG-15 | The deferred items: plugin packaging (D-136; when the tooling is feature-complete and stable); unique-jewel trade rows (D-137); per-agent inline engines (D-130; needs a probe); the pin upgrade (D-140); and two post-alpha reviews: the cost envelope (D-127) and a checkpoint after D1 (D-134) | Product scope | The user, after M-13 |
| HG-16 | *Withdrawn → D-207:* how the skill learns the guides root. The server creates the run folder and returns its path | — | — |
| HG-17 | *Withdrawn → D-201:* web hosts during M-12's run. M-12 runs fully offline; web research happens only in M-13 (HG-14) | — | — |
| HG-18 | *Withdrawn → A-30:* the Arbiter of Divinity's fight life. E1 records three low-confidence inputs, and the guide reports time-to-kill as a range | — | — |

## 7. Milestones and alpha definition

- **M-10, Server tools:** WU-31…WU-36 and WU-49. Exit: every AC-K green; AC-B1…AC-B5 and AC-B7 green at
  the last merge. (AC-B6 belongs to WU-37, under M-11.)
- **M-11, Plan compiler:** WU-30, WU-37…WU-42. Exit: every AC-P green, including a hand-written
  two-stage fixture plan (`tests/fixtures/plans/`) that compiles into a PoB2 file with one loadout per
  stage and nothing titled `Default` (D-215), reloads headless, and yields a compile record and an import
  code that round-trips (D-180). AC-B6 and AC-B8 green, and AC-B1 at 84 and 83. NFR-20 and NFR-21 are met
  at D-229's margin, or HG-13 was raised and resolved. WU-30's report is committed.
- **M-12, Pipeline offline:** WU-43…WU-47. Exit: every AC-W green, and WU-47's recorded run produced
  every C-36 artifact under a temp guides root, in offline mode with no web tools (D-201), trade and
  poe.ninja disabled, prices `unavailable` (D-164, D-181), checkpoints answered by the coordinator
  (A-28), V1–V4 passing, and the run log within NFR-23.
- **M-13, Alpha.** Reached when all of these hold (D-151):
  1. the M-10…M-12 exits hold, and `mise run test` and `pnpm build` exit 0;
  2. HG-14 was approved before the run started;
  3. the live Titan / Blood Hunt run (WU-48) produced its run folder with V1–V4 passing, one loadout per
     stage in the PoB file, and an import code that round-trips;
  4. its run log shows NFR-22 and NFR-23 met;
  5. the user signs off in the work-log after playing the guide.

  Not in alpha: plugin packaging, per-agent engines, unique-jewel trade rows (D-151).

## 8. Work-unit graph (all slices)

Full blocks (kind, role, produces, consumes, acceptance) are in the slice specs. Edges are functional
dependencies; shared-file contention is handled by the serialized-wiring rule below. "Touches" lists
each unit's main files beyond its implied scope.

| WU | Title | Slice | Depends on | Touches | M |
|---|---|---|---|---|---|
| WU-30 | Compile-time spike (gap 6's WU-S): S-a's recipe on a synthetic 15-stage plan; per-stage and whole-call times; decides `stages` semantics | 02 | — | `docs/build-guide/spikes/WU-30-compile-time.md` (new); probes only in temp dirs | M-11 |
| WU-31 | K1: `lookup_game_data`; `search_tree_nodes` ascendancy filter and its two bugs (C-37, C-43) | 01 | — | `pob-api/API/Lookup.lua` (new), `BuildOps.lua` (`search_nodes`), `src/handlers/lookupHandlers.ts` (new), `luaHandlers.ts` (`search_tree_nodes`) | M-10 |
| WU-32 | K2: `check_model_coverage` (C-38), with the server's name scan of PoB's source (D-226) | 01 | WU-31 | `pob-api/API/Coverage.lua` (new), `src/handlers/coverageHandlers.ts` (new), `src/engine/pobSourceNames.ts` (new), `tests/e2e/serverTools.test.ts` (new) | M-10 |
| WU-33 | M1: per-skill and per-stat-set breakdown; the skill-part fix (C-44, C-45) | 01 | — | `BuildOps.lua` (`get_stats`, `set_main_selection`), `luaHandlers.ts` (`lua_get_stats`), `itemSkillHandlers.ts` (`set_main_skill`) | M-10 |
| WU-34 | M2: ranker amendments (C-47) | 01 | WU-32 | `treeHandlers.ts`, `poe2SkillHandlers.ts`, `src/services/poe2SkillService.ts`, `BuildOps.lua` (`list_support_candidates`) | M-10 |
| WU-35 | L1 sets: `manage_sets`, loadouts, the auto-level bridge flag (C-39, D-196) | 01 | WU-32 | `pob-api/API/Sets.lua` (new), `BuildOps.lua` (`set_level`), `src/handlers/setHandlers.ts` (new), `tests/e2e/serverTools.test.ts` | M-10 |
| WU-36 | L1 tree state: `set_tree_state`; tree-jewel slots on `add_item`; the `update_tree_delta` fix (C-40, C-46, C-48) | 01 | WU-32 | `BuildOps.lua` (`set_tree`, `reimport_nodes`, `update_tree_delta`; `add_item_text` only if the jewel path needs it), `luaHandlers.ts` (`update_tree_delta`), `src/handlers/treeStateHandlers.ts` (new), `toolSchemas.ts` (`add_item`'s `slot_name` enum; not the shared `ITEM_SLOTS`, D-223), `tests/e2e/serverTools.test.ts`, `engineKinds.test.ts` and `toolHygiene.test.ts` (`$JEWEL_TEXT`) | M-10 |
| WU-37 | Guides-folder root: env, default, path safety, Jest redirect (C-34 root rules, C-7, C-18) | 02 | — | `src/index.ts`, `createServer.ts`, `src/utils/guidesPath.ts` (new), `tests/setup/global.ts`, `tests/helpers/spawnServer.ts`, README env table | M-11 |
| WU-38 | P1: plan schema, its committed reference and worked example, the ledger evaluator (C-30, C-31, C-32, C-33 ledger) | 02 | — | `src/plan/` (new), `docs/build-guide/plan-reference.md` (new), `tests/fixtures/plans/` (new) | M-11 |
| WU-39 | C1 and E1 data files and their loader (C-35, A-30); the progress-key data (D-214) | 02 | WU-38 | `data/campaign/`, `data/enemies/` (new), `src/plan/referenceData.ts` (new), `src/plan/schema.ts` (the `progress` and `data:` checks), `tests/fixtures/plans/two-stage/plan.json` and `docs/build-guide/plan-reference.md` (their progress keys, D-214) | M-11 |
| WU-40 | Import-code encoder and `encode_build_code` (C-42) | 02 | — | `src/utils/buildCode.ts`, `src/handlers/buildCodeHandlers.ts` (new), `engineKinds.test.ts` and `toolHygiene.test.ts` (test encoders replaced) | M-11 |
| WU-41 | P2: the compiler, `compile_plan` (measure-only and final modes) and `guide_run` (run-folder and validate modes); compile record; the write ledger; ledger re-evaluation (C-33, C-41, C-50, D-207, D-208, D-211, D-216) | 02 | WU-30, WU-33, WU-35, WU-36, WU-37, WU-38, WU-39, WU-40 | `pob-api/API/Compile.lua` (new), `src/plan/compiler.ts`, `src/plan/record.ts` and `src/plan/writeLedger.ts` (new), `src/handlers/planHandlers.ts` (new), `src/server/toolRouter.ts` (the `guide_run` kind rule), `src/utils/guidesPath.ts` (D-220), `engineKinds.test.ts` and `toolHygiene.test.ts` (`$TWO_STAGE_PLAN`), `tests/fixtures/plans/` (the fifteen-stage fixture), `mise.toml` (`test` task) and `jest.config.cjs` (the NFR step, C-19); `buildFileWriter.ts` only if a new write kind is needed | M-11 |
| WU-42 | V1 validity and V2 config checks inside compile (D-192) | 02 | WU-41, WU-39, WU-31 | `src/plan/checks/` (new), `src/plan/compiler.ts` (calls them), `Compile.lua`, `data/config-baseline.json` (new, D-230) | M-11 |
| WU-43 | The skill: the roll check (D-238), the run folder, which `guide_run {new_run}` creates (D-207, D-216), and the unsaved-build question (D-210), run log, checkpoints (pre-supplied answers in offline mode only, A-28; research rounds, D-235; revisions, D-236), offline mode (D-201), failure paths, retry caps and escalation (D-236), the pricing procedure over WU-49's dated outputs, the Agent-tool fallback, the run checker and the workflow harness; the early positive allowlist probe, which calls `lookup_game_data` (AC-W23) | 03 | WU-41, WU-49, WU-31 | `.claude/skills/build-guide/` (new), `tests/helpers/workflowHarness.ts` (new), `tests/fixtures/pipeline/` (new) | M-12 |
| WU-44 | Research workflow: R1a lookup-only agents, R1b measure-only compile (D-208) and price | 03 | WU-43, WU-31, WU-32 | `.claude/workflows/` (research workflow, new), `.claude/agents/build-guide/` (researcher and coordinator, new), `.claude/skills/build-guide/` (R1 stage references, dossier template) | M-12 |
| WU-45 | Design-and-write workflow: D1, D2, W1 and the guide template (from ext §5) | 03 | WU-43, WU-34, WU-42, WU-44 | `.claude/workflows/` (design workflow, new), `.claude/skills/build-guide/` (D1, D2 and W1 stage references, guide template), `.claude/agents/build-guide/` (writer, new; coordinator) | M-12 |
| WU-46 | V3 provenance and V4 claim-verification agents (V4 accepts `external-unavailable` only in offline mode, C-30), wired into the design workflow | 03 | WU-45, WU-44 | `.claude/agents/build-guide/` (verifiers), the design workflow, `.claude/skills/build-guide/` (V3, V4 and `revise-map` stage references, `references/fallback.md`) | M-12 |
| WU-47 | Offline end-to-end pipeline run, recorded (D-181, D-201, A-28) | 03 | WU-44, WU-46 | none in the repo beyond the work-log; failures re-open the owning unit | M-12 |
| WU-48 | **Human:** the live Titan / Blood Hunt run and the user's sign-off | 03 | WU-47; HG-14 | the user's guides and builds folders (coordinator and user only) | M-13 |
| WU-49 | T1: dated price outputs on `get_item_price` and `search_trade_items` (date and league), no batch mode (D-224), the `[trade:<kind>]` error prefix on those two and `get_leagues` (D-218), within the limiter's existing windows (C-49, D-202) | 01 | — | `src/handlers/tradeHandlers.ts`; the trade fixtures in `tests/fixtures/` | M-10 |

**Critical path** (by unit count): WU-31 → WU-32 → WU-35 (or WU-36) → WU-41 → WU-43 → WU-44 → WU-45 →
WU-46 → WU-47 → WU-48. WU-38 → WU-39 is as long before WU-41, and WU-30 gates WU-41 (HG-13).

**Parallel lanes:** the first wave is WU-30, WU-31, WU-33, WU-37, WU-38, WU-40 and WU-49. Then WU-32
(after WU-31) and WU-39 (after WU-38); then WU-34, WU-35 and WU-36 (after WU-32). All join at WU-41
except WU-34, which joins at WU-45, and WU-49, which joins at WU-43. WU-31 also feeds WU-43 directly,
because WU-43's early allowlist probe (AC-W23) calls `lookup_game_data`. After WU-41, WU-42 runs
alongside WU-43 → WU-44. In slice 3, WU-44 → WU-45 → WU-46 run in series, because they share
`tests/unit/buildGuideWorkflows.test.ts` and `build-guide-coordinator.md`.

**Serialized-wiring rule** (as stab §8). These files are shared:
- `src/server/toolSchemas.ts`, `toolMeta.ts`, `toolRouter.ts`; the README tool table (always regenerated
  with `pnpm docs:tools --write`, never hand-edited);
- `tests/fixtures/tool-disposition.json`, `tests/fixtures/tool-calls.json`; the hygiene allowlist and
  the cruft waivers (both stay `[]`);
- every count site in §1.3;
- `src/index.ts`, `src/server/createServer.ts`, `src/utils/contextBuilder.ts`, `src/utils/buildCode.ts`,
  `src/handlers/luaHandlers.ts`;
- `src/pobLuaBridge.ts`, `src/engine/schemas.ts`, `pob-api/API/Handlers.lua`, `pob-api/API/BuildOps.lua`,
  `tests/integration/contract.test.ts`;
- `tests/integration/engineKinds.test.ts`, `tests/integration/toolHygiene.test.ts` (their `PLACEHOLDERS`
  maps gain `$JEWEL_TEXT` in WU-36 and `$TWO_STAGE_PLAN` in WU-41; WU-40 replaces their test encoders);
  `tests/e2e/serverTools.test.ts` (WU-32 creates it; WU-35 and WU-36 extend it);
- `tests/setup/global.ts`, `tests/helpers/spawnServer.ts`.

Edits to these are short wiring steps, merged one unit at a time in DAG order; concurrent units rebase
before merging. The tool-adding units are WU-31, WU-32, WU-35, WU-36, WU-40 and WU-41; WU-41 adds two
(`compile_plan` and `guide_run`). Each one moves every count site from its rebased base by its own new
tools (+1 each) in the same merge, and regenerates the README table. After WU-41: 84, and 83 without
poe.ninja. WU-49 changes three existing trade tools (the two price tools' outputs, and the error prefix
on those and `get_leagues`) and adds none, so it moves no count and changes no tool schema (D-224); any
`tool-calls.json` sample it adds is serialized like the others, and it regenerates the README table if
a description changes. New Lua goes in new modules registered by one line in `Handlers.lua`, as
`Trade.lua` is, so `BuildOps.lua` edits stay inside the functions a unit names.

**Dependency rule.** No unit changes `package.json` dependencies or the lockfile (HG-10).

**Implied scope.** A unit's touches also include its own new files, the tests its ACs name, and the
existing tests of modules it changes.

## 9. Operational guardrails

- **Budget and loop guard.** One unit per agent context. The same gate-failure signature 3 times in a row
  → stop with `blocked:loop` and the failing output. A unit that needs a file owned by an unmerged unit
  stops and reports.
- **Secrets and identity.** Never read, print, grep, cat, source or copy `.env`; never set `POESESSID`;
  worktrees have no `.env`. No name or email in any request, fixture or file content except git
  authorship. The User-Agent is D-25's.
- **Network during the build.** GitHub (`mise run pob:fetch`) and the npm registry only. Never
  pathofexile.com, poe.ninja or any other host (D-34, HG-1, D-201). Tests reach HTTP only through
  `fixtureFetch`.
- **Filesystem.** Write only inside your worktree and temp dirs. Never touch `/mnt/c/...`: the user's
  builds folder and the default guides folder are there (HG-6). Probes that start the server or engine
  run from `mktemp -d`, with `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY` at temp dirs.
  Every builds-folder write goes through `buildFileWriter` (C-17).
- **The M-12 run** uses its own server instance: temp `POB_DIRECTORY`, `XDG_STATE_HOME` and
  `POB_GUIDES_DIRECTORY`, `POE_TRADE_DISABLED=true`, `POE_NINJA_DISABLED=true`, web tools denied, and the
  skill in offline mode (D-201) with the coordinator's pre-supplied checkpoint answers (A-28). Never the
  user's registered `pob2` server.
- **Pipeline runtime rules** (M-13 and after): trade and poe.ninja only through the server, from the one
  coordinator (D-112, D-130); research and V4 agents get lookup tools only, never trade or mutating
  tools (D-178, D-231, A-24); agents write only in the current run folder (D-177); each stage retries
  at most twice, then escalates (D-127); fan-out ≤ 3 (D-161, D-172); fetching patch notes from
  pathofexile.com needs the user (D-139).
- **Worktrees and commits (D-48).** Bootstrap with `mise trust && pnpm install --frozen-lockfile && mise
  run pob:fetch`, then `git config --worktree commit.gpgsign false`. Commit, rebase, merge, cherry-pick
  and revert with `-c commit.gpgsign=false`; messages `<type>(WU-nn): <what>` with the build handoff's
  `Co-Authored-By` line. Never push; the coordinator sign-rebases with the user (HG-8). Don't use the
  Serena tools (one shared instance points at the wrong checkout).

## 10. Risk register

| ID | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R-20 | Compile time against the 30 s request timeout and Claude Code's 120 s backgrounding | medium / high | WU-30 first, at D-229's 20 s margin; one request per stage plus a fixed overhead (D-221); `stages` subsets (D-156); HG-13 |
| R-21 | Weak concepts for off-meta pairings | medium / medium | Checkpoint 1; D-141 failure paths; first-run measurement (D-127) |
| R-22 | PoB modelling gaps (12.9% of unique lines, ~30% of keystones, 32% of ascendancy notables, ~48.5% of supports) | certain / high | C-38 flags; the ledger; V4 (D-179); C-47's unmeasurable lists |
| R-23 | K2's heuristics misreport ("possibly unread", "possibly unmodelled"; Ancestral Call was a false positive of the raw test) | medium / medium | Statuses say "possibly"; PoB's own red-tooltip rule (pin §D calibration); V4 samples |
| R-24 | Trade limits shared with the user's account | medium / high | Paced pricing (D-160); one coordinator; prices kept in the plan; HG-14 |
| R-25 | 1.0 on 2026-12-11 ends both leagues: a guide lives about nine weeks; the pin is 0.5.4 while live is 0.5.5 | certain / medium | D-107's version statements; D-139 regeneration; HG-11 |
| R-26 | The Workflow tool is unavailable, or can't pause for a pick | medium / medium | Two workflows split at checkpoint 1 (D-129); Agent-tool fallback (D-172) |
| R-27 | Tool-surface token cost | certain / low | Extend existing tools; 7 new tools (D-173, D-216) |
| R-28 | Regressions in existing tools from `BuildOps.lua` edits (rankers, tree, main skill) | medium / high | AC-B3, AC-B5; contract tests; AC-E39 kept; existing tool tests stay |
| R-29 | `{id}` loadout hazards: `CopyLoadout` crashes; `#sets+1` ids collide after a delete | certain / medium | No `CopyLoadout` (D-103); no delete in C-39; `SyncLoadouts` before lookups |
| R-30 | The guides folder sits on case-insensitive drvfs (`/mnt/c`); traversal and symlink escapes | medium / medium | C-34's resolve-and-contain rule; AC-B8 tests with symlinks and `..` |
| R-31 | Low-confidence enemy data (Arbiter fight life, interlude levels) misleads | high / medium | Confidence stated (C-35); time-to-kill reported as a range, never gated (D-116, A-30) |

## 11. Migration and compatibility

- **Backward compatibility.** The 77 tools keep their contracts except C-43…C-49, each with its
  compatibility note in §3.2; nothing is removed or renamed, and default outputs stay, so the golden
  values hold (AC-B5). Env: `POB_GUIDES_DIRECTORY` is added (WU-37). Bridge: additive actions and params,
  plus one internal param rename (D-222). `mise run test` gains a separate NFR step (C-19).
- **Data.** No migration. New `data/` in the repo; the guides root is created by the first run; the state
  dir gains the write ledger at the first final compile (D-211).
- **Stabilization docs.** C-1's count and D-65's text are corrected in the stab spine by the coordinator
  at ratification (D-198).
- **Cutover.** Each unit is one merge on the epic's integration branch; roll back by reverting it.

## 12. Test and verification strategy

**Test classes.** The stab spine's classes apply unchanged (unit, in-process MCP, engine-required,
Lua-direct, stdio e2e, static, script check, human), with the same allowed fakes and the fidelity rule.
This epic adds:

| Class | Where | Covers | Runs in |
|---|---|---|---|
| Plan fixtures | `tests/fixtures/plans/` with engine-required tests | C-31…C-33, C-41, C-50: the two-stage plan (M-11), schema and per-stage errors, idempotence, the write ledger | `mise run test`; the fifteen-stage NFR test in its separate `--runInBand` step (C-19) |
| Static (pipeline files) | `tests/static/` over `.claude/skills/build-guide/`, `.claude/workflows/`, `.claude/agents/build-guide/` | the workflows the skill names exist; research allowlists name no trade or mutating tool (D-178) | `mise run test` |
| Pipeline run | WU-47, recorded in the work-log with the run-folder listing | C-36 end to end, offline | the coordinator; an independent verifier checks the record |
| Human | WU-48 | the live run and play-test | the user |

**Unit gate.** Stab §12's five checks, by an independent verifier, with this spine's touches and wiring
list.

**Regression coverage for existing behaviour.** The existing suites stay and must pass unchanged except
for the count literals (§1.3): golden and hygiene tests, `engineKinds.test.ts`, `contract.test.ts`, the
README table test, the static scans, the ranker tests (AC-E39 order), and the fresh-clone check.

**Cross-cutting acceptance criteria** (owned here; slices cite them):
- **AC-B1 (tool surface).** After WU-41, `tools/list` returns 84 tools with every group enabled and 83
  with `POE_NINJA_DISABLED=true`; the set equals `tool-disposition.json`'s non-delete, non-pending names;
  the README table has 84 rows equal to `pnpm docs:tools` output. At each earlier tool-adding merge the
  same holds for that merge's count.
- **AC-B2 (hygiene).** At every unit gate, `tool-hygiene-allowlist.json` and `poe1-cruft-waivers.json`
  are `[]`. Every new tool has at least one `expect:"ok"` sample, a description of ≤ 2048 chars, and
  passes the output-text checks. The cruft, advice-threshold, `deletedPlumbing` and dead-module scans
  pass.
- **AC-B3 (engine kinds).** For every ok sample of a new or amended engine tool, a `read` tool leaves the
  canonical export identical and `revision` unchanged, and a `mutate` or `load` tool changes both.
  This includes `lua_get_stats` breaking down a non-main stat set, `lookup_game_data` (D-176), and both
  `guide_run` modes; its run-folder mode also never starts the engine (D-216).
- **AC-B4 (wire contract).** Every new Lua action has a C-5 schema, a typed bridge wrapper and a
  `contract.test.ts` case, added in the same merge.
- **AC-B5 (golden).** The 109 `PlayerStat` pairs, `golden-stat-fields.json`, CombinedDPS 104489.78 and
  the fresh-clone Life 2,977 are unchanged.
- **AC-B6 (offline harness).** Jest's `globalSetup` points `POB_GUIDES_DIRECTORY` at a fresh temp dir,
  `spawnServer` passes it explicitly, only `src/index.ts` reads it, and no test sends HTTP outside
  `fixtureFetch`.
- **AC-B7 (dependencies).** `package.json`'s dependency sections and `pnpm-lock.yaml` are byte-identical
  to the epic's base commit at every unit gate.
- **AC-B8 (write roots).** `guide_run` writes only the run folders it creates (D-207, D-216).
  `compile_plan` writes only files beside the plan inside the guides root, the target PoB file (through
  C-17; never in measure-only mode, D-208) and that file's write-ledger entry in the state dir (D-211).
  A `plan_path` that escapes the root (by `..`, an absolute path, or a symlink resolving outside), a
  `new_run` slug that isn't one safe path segment, or a guides root overlapping the builds folder
  (D-220) is `isError`, and nothing is written.

**Non-functional requirements:**

| NFR | Threshold | Condition | Owner |
|---|---|---|---|
| NFR-20 | A 15-stage plan compiles in ≤ 100 s, one call (D-159, D-229) | this machine, vendor pin; the test runs alone, in `mise run test`'s `--runInBand` step (C-19) | WU-30 measures; an AC-P asserts |
| NFR-21 | Every per-stage engine request finishes in under 20 s, a third below the 30 s request timeout (D-47, D-156, D-229) | the same plan | AC-P |
| NFR-22 | Zero 429 responses and zero `locked_out` refusals during pricing (D-160) | the M-13 live run, from its run log, which classifies outcomes by the `[trade:<kind>]` prefix (D-218): its `rate_limited` and `locked_out` counts are 0 | AC-W, WU-48 |
| NFR-23 | ≤ 3 concepts per research round, ≤ 3 verify lenses, ≤ 2 retries per stage, fan-out ≤ 3 (D-127, D-161, D-172, D-235) | any run, from its run log | AC-W |
| NFR-24 | At most 8 new tools; total under 86 (actual: 7, 84) | the final surface | AC-B1 |

## 13. Constraints and non-goals

**Constraints:**
- **The stab spine's §13 holds:** Node 24, pnpm 11.6.0, LuaJIT via mise; SDK 1.20.2; zod 3; PoB2
  v0.23.1 read-only (game 0.5.4 data); text-only tool output (D-36); code under `~/projects/pob2-mcp`.
- **No new dependencies** (HG-10): no YAML parser, no runtime JSON-Schema validator, no expression
  library.
- **PoE2 only**, bound to the pin.
- **The ten constraints D-105…D-114**, and the standing rules: no secrets in files, logs or argv; trade
  and poe.ninja only through the server; builds-folder writes only through `buildFileWriter`; no network
  in tests; no agent reads `.env`.
- **Cost is a stated concern:** fan-out stays within D-127 and D-161.

**Non-goals** (design): dedicated boss-killer builds; an encounter-specific target input; live tracking
of the player's character; an in-game overlay or automation; hosting or publishing guides; re-checking
guides after game patches; PoE1; perfect simulation (hand calculations are accepted and labelled). Also
out of this epic: plugin packaging, per-agent engines, unique-jewel trade rows (HG-15), a pin bump
(HG-11), and the pipeline's own price cache (D-169).
