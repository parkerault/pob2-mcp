# Build-guide epic: brownfield recon

Read-only audit of `stabilization/foundation` at `e6ebec1` (2026-10-07), for the spec of the build-guide
workflow (`docs/design/2026-10-07-build-guide-workflow.md`, its review beside it). Every claim cites
file:line. `vendor/` means `vendor/PathOfBuilding-PoE2/src` (the v0.23.1 pin). "Spine" means
`docs/stabilization/spec/README.md`.

## 1. Components in scope

| Component | Where | What it does today |
|---|---|---|
| Tool schemas | `src/server/toolSchemas.ts:8-16` (type), 9 groups at `:34, :217, :893, :914, :1020, :1041, :1153, :1350, :1384` | JSON-Schema literals. `ITEM_SLOTS` `:22-26` and `ACTIVATABLE_SLOTS` `:29` are shared with handlers |
| Listing | `src/server/createServer.ts:86-98, 104-108, 284-287` | `tools/list` = every schema with `TOOL_META` whose group is on, in group order |
| Registry metadata | `src/server/toolMeta.ts:14-20, 26-122, 127-137` | 77 entries, each `{engine: none\|read\|mutate\|load\|lifecycle, group: core\|trade\|ninja}`. A tool with no entry is unlisted and unroutable |
| Router | `src/server/toolRouter.ts:146-194` | Unknown tool → `McpError` −32602 (`:130-132, :152`). `engine:'none'` skips the session (`:158`); every other kind runs in `session.run` (`:161-173`). A handler's `isError` result is rethrown as `ToolResultError` (`:75-79, :170`) so the session treats the call as failed. Thrown errors → `isError` text, stack to stderr (`:189-192`). Session notices go first (`:104-112, :174`) |
| Dispatch | `toolRouter.ts:206-693` | One `switch`. Builds 7 handler contexts eagerly on every call (`:213-219`). `set_character_level` is the only case implemented inline, with no handler (`:302-316`). Undocumented argument aliases are read here (`skill_part` `:481`, `keyword`/`q`/`max_results`/`include_allocated` `:420-430`) |
| `wrapHandler` | `src/utils/errorHandling.ts:25-35` | Rethrows as `Failed to <action>: <msg>`. `handleGetPassiveUpgrades` doesn't use it (`src/handlers/treeHandlers.ts:383-505`) |
| Engine session | `src/engine/session.ts:1-23` (step list), `:390-412` (`run`), `:414-474` (`runLocked`) | One FIFO mutex per tool call, any kind (`:276-278, :349-386`). Only `find_upgrades` gets a deadline (`toolRouter.ts:166`). It ensures the engine, restores a snapshot after a crash, then checks the disk except on loads (`:423-424`). On a successful `mutate` or `load` it bumps `revision` and snapshots by exporting the whole XML (`:445-469`). Handlers reach the engine only through `sessionScopedEngine`, which throws outside a run (`src/utils/contextBuilder.ts:36-50`). The ctx API (`session.ts:75-93`) offers `loadFile`, `loadXml`, `newBuild`, `withTemporaryBuild`, `noteSaved` |
| Bridge client | `src/pobLuaBridge.ts:630-636` (`request`), `:527-561` (`send`) | Per-request timeout from the write: 30 s by default, 60 s for `trade_generate_query`, overridable with `POB_TIMEOUT_MS` (`:79-80, :563-568`). A timeout SIGKILLs the engine (`:570-577`). Every `ok:true` reply is checked against `replySchemas` (`:516-523`). Typed wrappers at `:668-874` |
| TS↔Lua schemas | `src/engine/schemas.ts:18-62` (43 `ACTION_NAMES`), `:613-658` (`definedSchemas … satisfies`), `:665`, `:674-750` (`ActionParamsMap`) | zod v3. A missing schema is a compile error. `luaArray`/`luaMap`/`luaNumber` absorb dkjson quirks (`:74-87`) |
| Lua dispatch | `pob-api/API/Server.lua:90-116`; `pob-api/API/Handlers.lua:78-444`; `pob-api/API/Trade.lua:701` merged at `Handlers.lua:493` | `pcall(handler)`. `ok:false` defaults to code `FAILED`. The handlers map BuildOps' `value` / `nil,'msg'` to `{ok, <key>}`. Test actions exist only under `POB_API_TEST_ACTIONS=1` (`Handlers.lua:446-491`) |
| Build-file writer | `src/services/buildFileWriter.ts:1-36` (rules), `:53` (kinds), `:343-344` (per-path lock), `:372-374` (backup) | Canonical path, explicit overwrite, changed-on-disk guard, backup, temp file + rename. Wired at `createServer.ts:204-212` |
| Rate limiter | `src/trade/rateLimiter.ts:1-29`, `:117` (`DEFAULT_MAX_WAIT_MS = 30_000`) | One instance for all trade traffic (`createServer.ts:182`). Refuses any wait over 30 s or past the deadline (`would_wait`) instead of sleeping |
| Trade client | `src/trade/tradeClient.ts:1-17`, `:66-67`, `:126`, `:141` | Caches only `/data/stats` (process lifetime) and `/data/leagues` (4 h). `search`/`fetch` are never cached |
| Price tools | `src/handlers/tradeHandlers.ts:265-339` (`get_item_price`), `:89-102, :109+` (`search_trade_items`) | `get_item_price`: one search by name plus one fetch of 10, with no deadline or signal (`:282, :288`). Output names the league, has no date. `search_trade_items` takes `mods` stat filters (affix-target searches) |
| `find_upgrades` | `src/trade/findUpgrades.ts:19, :331-363, :515` | Caches **generated queries** (LRU 32, keyed by session revision), not prices |
| Currency | `src/trade/currency.ts:97-150` | poe.ninja rates per league, 60 min with ETag |
| **Price cache** | — | **None exists.** No listing or price result is cached anywhere (tradeClient header `:15-16`) |
| Config presets | `src/handlers/configHandlers.ts:65-79` | `<stateDir>/presets/<name>.json` = `{enemyLevel, input}`. `set_config` writes only the active config set (`pob-api/API/BuildOps.lua:445-475`, `:449`) |
| `lua_get_stats` | `src/handlers/luaHandlers.ts:278-374` | `offense`: 38 fields (`:289-300`), all main-skill or minion outputs. `defense`: 38 fields (`:301-312`). Default/`all`: Lua's 45 `DEFAULT_STAT_FIELDS` (`BuildOps.lua:37-53`). Category views show at most 50 non-zero lines (`:347-358`). Values are scalars of `mainOutput` only (`BuildOps.lua:69-95`): no per-skill or per-part data. The tool is on the 5000-char truncation list (`createServer.ts:80-83`) |
| `set_main_skill` | schema `toolSchemas.ts:611-627`; handler `src/handlers/itemSkillHandlers.ts:316-358`; Lua `BuildOps.lua:542-562` | The schema exposes `group_index` and `active_skill_index` only. Lua sets `srcInstance.skillPart` (`:553-557`), which is PoB's skill-part field, not PoB2's stat set (`srcInstance.statSet[grantedEffectId]`, `vendor/Modules/Build.lua:375-379`, read at `vendor/Modules/CalcSetup.lua:1890`). `mainSocketGroup` is build-wide (`BuildOps.lua:546`) |
| `search_tree_nodes` | schema `toolSchemas.ts:450-470`; handler `luaHandlers.ts:584-671`; Lua `BuildOps.lua:1337-1468` | The handler caps results at 30 and shows 3 stats per node (`:604, :647`). Lua bugs: `node_type:'any'` never matches, because types are only keystone/notable/jewel/mastery/ascendancy/normal (`:1344, :1369-1377`). The loop stops at `maxResults` (`:1361`) before the sort (`:1457`). `isNotable` is tested before `ascendancyName` (`:1372-1375`), so ascendancy notables are typed `notable`. There is no filter by ascendancy name |
| `list_gems` | schema `:472-500`; handler `luaHandlers.ts:673-727`; Lua `BuildOps.lua:1473-1536` | Returns name, kind, gemType, family, tags, `naturalMaxLevel`, `Tier`, reqStr/Dex/Int. No description, stat text, stat sets, quality or support rules. The bridge never touches `StatDescriber`, uniques or `ModCache` (no match in `pob-api/`) |
| `get_passive_upgrades` | `treeHandlers.ts:361-505` | Measures the 8 nearest notables per keyword (`:364`). Excludes ascendancy notables (`:411-426`). Uses `calc_with` over the whole path (`:450-457`). Lists only improvers (`:468-471`) |
| `suggest_supports` | `src/handlers/poe2SkillHandlers.ts:73-125`; `src/services/poe2SkillService.ts:300-319`; Lua `BuildOps.lua:1186-1332` | Ranks the whole pool. Unmeasured candidates (`delta:null`) sort as −∞ and fall off the slice (`poe2SkillService.ts:220-225, :309-317`) |
| `lua_set_tree` / `update_tree_delta` | `luaHandlers.ts:424-582`; Lua `BuildOps.lua:126-162, :259-281` | `reimport_nodes` keeps existing weapon-set tags (`allocMode`) and attribute choices (`hashOverrides`) but nothing can set them (`:126-138`). **The Lua side doesn't auto-path** and returns only `tree`. The TS side reads `autoPathedNodes`, `skippedAscendancyNodes` and `ascendancyPointsUsed`, which Lua never sends (`luaHandlers.ts:468, :549-576`; `pobLuaBridge.ts:808-810`). So the descriptions' auto-path and 8-point claims (`toolSchemas.ts:388, :411`) aren't implemented |
| Specs | Lua `BuildOps.lua:1721-1834`; handlers `luaHandlers.ts:834-910` | Create (copy via undo state `:1753-1760`), list, select, delete, rename. Lua defaults `activate` to false (`:1776`); the schema says "default: true" (`toolSchemas.ts:303`) |
| Item sets | Lua `BuildOps.lua:1840-1869` | List and select only. **No skill-set or config-set operations exist at all** |
| `add_item` | schema `toolSchemas.ts:552-569`; Lua `BuildOps.lua:577-622` | The schema enum is `ITEM_SLOTS`, which has no tree-jewel sockets, although Lua accepts any `itemsTab.slots` name (`:589-593`) |
| `toggle_flask` | `itemSkillHandlers.ts:195-245`; Lua `BuildOps.lua:632-658` | Flask or Charm slot of the **active** item set only (`:647`) |
| Level | `set_character_level` (`toolRouter.ts:302-316`); Lua `BuildOps.lua:175-190` | Always forces manual mode (`:184`). No tool sets `characterLevelAutoMode`. `load_build_xml {keepLevel}` puts back the recorded level and mode (`Handlers.lua:196-199`) |
| `src/utils/buildCode.ts` | `:71-105` (`decodePobCode`), `:139-144` | **Decode only.** The encoder exists only in tests (`tests/integration/toolHygiene.test.ts:95`, `engineKinds.test.ts:49`) |
| `export_build_summary` | `src/handlers/exportHandlers.ts:198-271` | Markdown of name, class, level, 19 stats, main group, keystones. It reads `tree.keystones`, which `get_tree` never returns (`BuildOps.lua:104-117`), so that section never renders. No import code |
| `plan_leveling` data | `src/data/poe2Campaign.ts:1-22` | Hand-maintained 0.5 table (design row 31: not reused) |
| `.claude/` | `git ls-files .claude` | Tracked: 8 `agents/agent-os/*.md` and 6 `commands/agent-os/*.md` (generic agent-os). **No skills, no workflows**, no project agents for this epic. `settings.local.json` is gitignored (`.gitignore`) |

## 2. Conventions in scope

- **A tool is 4 code edits plus 4 fixture/doc edits:**
  1. schema literal, `TOOL_META` entry, router `case`, `handle<Name>` wrapped in `wrapHandler` (CLAUDE.md; spine §2.2);
  2. `tests/fixtures/tool-disposition.json`: AC-F22 lists exactly its non-delete, non-pending names (`tests/mcp/toolSet.test.ts:50-58, :93-98`);
  3. one or more `expect:"ok"` samples in `tests/fixtures/tool-calls.json` (`toolHygiene.test.ts:25-27`);
  4. the README table (below).
- **Router and registry agree.** A static check requires one `case` per `TOOL_META` name and no extras (`toolSet.test.ts:100-104`).
- **Errors.** Handlers fail by throwing, and the router makes `isError` (C-1, D-27).
- **Output text hygiene.** Output text never contains `undefined`, `NaN` or `[object Object]` (`toolHygiene.test.ts:7-11`).
- **Description length.** Descriptions are ≤ 2048 chars (`tests/mcp/serverFactory.test.ts:101`).
- **Engine kinds are verified, not declared.** For every ok sample, a `read` tool must leave the canonical export identical and `revision` unchanged; a `mutate`/`load` tool must change both (`tests/integration/engineKinds.test.ts:1-17`; C-8 kind table `docs/stabilization/spec/01-foundation.md:240-247`).
- **README tool table.**
  - It is generated: `pnpm docs:tools [--write]` (`package.json:17`, `scripts/gen-tool-table.mjs:1-50`). Each row is the first sentence of the description (D-83), between `<!-- tools:start/end -->`.
  - The table must match byte for byte with **77 rows** (`tests/static/readme.test.ts:127-136`).
- **Static hygiene.** All of these are empty and must stay empty (AC-G6): `tool-hygiene-allowlist.json`, `poe1-cruft-waivers.json` (both `[]`).
  - **PoE1 cruft scan.** Covers every string literal in `src/**/*.ts`. It bans phrases (`bandit`, `pantheon`, `the shaper`, `sirus`, …) and the case-sensitive class names, `Shadow` included (`tests/helpers/cruftScan.ts`, `tests/static/poe1Cruft.test.ts:1-9`).
  - **Advice files carry no thresholds.** Matched against `4000`, `aim`, `quest points`, `Flask 3`, … in `src/advice/*`, `validationHandlers.ts`, `optimizationHandlers.ts`, `buildGoalsHandlers.ts` (`tests/static/adviceNoThresholds.test.ts:25-47`).
  - **`deletedPlumbing`.** Bans mastery and ToolGate plumbing and the WU-04 files (`tests/static/deletedPlumbing.test.ts:1-9`).
  - **No dead modules.** Every `src` file is imported (`tests/static/deadModules.test.ts:1-5`).
  - **Env.** Only `src/index.ts` reads `process.env` (`tests/static/processGlobals.test.ts:1-3`).
  - **Spawns.** Every test spawn passes an explicit env (`tests/static/testSpawnEnv.test.ts:1-5`).
- **Logging.** stderr only, `console.error('[Component] …')`. stdout is MCP (NFR-8).
- **Modules.** ESM, Node16 resolution, `.js` imports, `import type`. Jest compiles `src` as CommonJS, so `src/` has no `import.meta`, `__dirname` or top-level await (CLAUDE.md; spine §2.2). Dependencies: only zod 3, fast-xml-parser, chokidar and the SDK (`package.json:19-24`). No YAML parser or JSON-Schema validator.
- **Lua.** Two-space indentation, `local M = {} … return M`. BuildOps returns `value` or `nil,'lowercase msg'`. Actions are snake_case, params camelCase. Vendor files are never edited (spine §2.2, §13).

## 3. Existing interfaces in scope

| ID | Statement today (spine §3, `README.md:126-148`) | Touched by |
|---|---|---|
| C-1 | MCP surface. Errors are `isError`; unknown tool is −32602; text only; descriptions ≤ 2048; 5000-char truncation list. **The tool set equals the §4 table, "76 tools"**, a stale count (the code and tests have 77 since D-91) | every new tool |
| C-2 | Wire protocol v2: `{id, action, params}` → `{id, ok, …}` or `{ok:false, error, code}` | new Lua actions |
| C-3 | Session: FIFO lock per call, the only engine starter, crash restore, disk-change check, revision and snapshot after each change | P2, L1, M1, K1 |
| C-4 | Bridge client: id-matched, timeout from the write (kills the engine), never spawns, validates against C-5 | long compile actions |
| C-5 | One zod schema per Lua action in `schemas.ts` | every new action |
| C-6 | PoB pin (`pob-pin.json`, `construct()`) | E1/C1 data source |
| C-7 | `createServer(deps)`, no I/O at construction, env only from `src/index.ts` | guides-folder env (design row 35) |
| C-8 | `TOOL_META` kinds; the router wraps engine tools by kind | every new tool |
| C-9 | Credentials re-read per call | T1 |
| C-10 | Trade HTTP: cookie only on search/fetch; per-request 15 s timeout; only `/data/*` cached | T1 |
| C-11 | Limiter: per policy, margin 1, adopts server state, `would_wait` past 30 s or the deadline (+ D-87) | T1 pacing |
| C-12 | Currency: `core.primary`, 60 min + ETag | T1 |
| C-13 | Lua trade actions | — |
| C-14 / C-15 / C-21 | `find_upgrades`, `trade_query_options`, the upgrade-search pipeline | T1 (rare slots) |
| C-16 | State dir `${XDG_STATE_HOME:-~/.local/state}/pob2-mcp/{snapshots,backups,exports,presets}` | compile records? |
| C-17 | Every write into `POB_DIRECTORY` goes through `buildFileWriter` (+ D-86) | P2 output file |
| C-18 | Test harness (scrubbed env, throwing `fetch`, temp dirs, `engineDescribe`, `spawnServer`) | all tests |
| C-19 | mise tasks with no pipes | — |
| C-20 | Watcher, polling under `/mnt/` | — |

**Decisions the epic amends** (design row 43 names the first three):
- **D-77** (`README.md:276`): `get_passive_upgrades` measures the 8 nearest notables per keyword over the whole path, ranks by gain per point, lists only improving candidates, and **excludes ascendancy notables**.
- **D-78** (`README.md:277`): `suggest_supports` always measures; `count` defaults to 8 (max 20); it ranks PoB's candidate pool by the gem-sort stat. Also: `toggle_flask` takes `slot`, `add_gem` name rules, `validateOnly`, and all-or-nothing multi-step tools.
- **AC-E39** (`docs/stabilization/spec/02-engine.md:940-947`): the pool equals `list_support_candidates`; results are ordered by delta descending, ties by name; the measurement runs on the requested group. The design keeps the ordering.
- **D-46** (`README.md:245`): "Trade search and fetch responses are never cached." T1's in-run cache conflicts with it unless scoped outside the server.
- **D-3 / D-30** (`README.md:202, :229`): "no constants of our own in advice"; judgments come only from PoB warnings, `Missing<Elem>Resist`, and max hit vs enemy damage. V1 computes limits itself and E1/C1 hard-code data, so the spec must scope D-3 to the advice tools or amend it.
- **HG-3** (`README.md:326`): any tool-set change beyond §4 is a user decision. The epic adds tools.
- **D-64 / D-91** (`README.md:263, :290`): the tool counts (77, or 76 without ninja) are written into five tests and a script (§4).
- **D-65** (`README.md:264`): it says crash recovery reloads without `keepLevel`. The code now restores with it (`src/engine/session.ts:555-558`), so the decision text is stale. This matters for auto-level mode (row 49).
- **D-22 / D-47** (`README.md:221, :246`): only `find_upgrades` has a call deadline. Other engine requests get 30 s each.

## 4. Existing data and state in scope

**State dir** (`src/index.ts:24-33`, `buildExportService.ts:112-120`):
- `snapshots/<build relpath>/<id>_<tag>.xml` + `<id>_metadata.json`;
- `backups/<relpath>/<id>_backup.xml` | `_before-restore.xml`;
- `exports/` (`export_build`'s default);
- `presets/<name>.json`.

`backups/` and `snapshots/` are reserved: exports there are refused (`buildExportService.ts:79, :155-162`, D-88). The recovery snapshot lives in memory only (D-44).

**Build XML** (`vendor/Modules/Build.lua:1153-1162`; `vendor/Classes/PassiveSpec.lua:254-309`; golden `tests/fixtures/builds/grenadator.xml`):
- `<Build level targetVersion viewMode className ascendClassName mainSocketGroup characterLevelAutoMode>`. The golden build has `level="90" mainSocketGroup="11" characterLevelAutoMode="false"` (`grenadator.xml:3`).
- `<Tree activeSpec>` → `<Spec title treeVersion classId ascendClassId secondaryAscendClassId nodes …>` holding:
  - `<URL>`;
  - `<WeaponSet1|2 nodes>`, the weapon-set tags;
  - `<Sockets><Socket nodeId itemId>`, the tree jewels;
  - `<Overrides><AttributeOverride strNodes dexNodes intNodes>`, the attribute choices.

  The golden build has sockets and overrides but no `WeaponSetN` (`grenadator.xml:236-247`).
- `<Skills activeSkillSet sortGemsByDPSField …>` → `<SkillSet id>` → `<Skill mainActiveSkill …>` → `<Gem … corrupted corruptLevel>` (`:249-252`). Per-gem `statSet` children are read at `vendor/Classes/SkillsTab.lua:376`; the golden build has none.
- `<Items activeItemSet useSecondWeaponSet>` → `<ItemSet id title useSecondWeaponSet>` → `<Slot name itemId [active]>` (`:327, :692-693`).
- `<Config activeConfigSet>` → `<ConfigSet id>` → `<Input>` / `<Placeholder>` (`:181-218`). Quest-reward inputs are stored as strings (`:183-196`).
- Saved outputs: `<PlayerStat>` (109 pairs) and `<FullDPSSkill stat value skillPart source>` (`:4, :107`).

**Moved by a tool-count change (77 today):**
- `tests/mcp/tradeQueryOptions.test.ts:89`;
- `tests/mcp/findUpgrades.test.ts:1089`;
- `tests/static/readme.test.ts:136` (row count) and `:4, :127` (text);
- `tests/integration/gemCorruption.test.ts:310` (77) and `:326` (76 without ninja);
- `scripts/fresh-clone-check.mjs:27` (`EXPECTED_TOOLS`) and `:110` (minus ninja);
- `scripts/fresh-clone-check.sh:12` (comment);
- `tools/list` set = `tool-disposition.json` (103 entries, `bucket:"new"` allowed, e.g. `:78`).

**Golden values a new tool must not move:**
- `tests/integration/golden.test.ts:1-16`: 109 `PlayerStat` pairs survive save and reload (AC-F23/F24);
- `golden-stat-fields.json`;
- `engineTree.test.ts:86` (CombinedDPS 104489.78);
- `fresh-clone-check.mjs:123` (Life 2,977).

## 5. Test infrastructure

- **`engineDescribe`** (`tests/helpers/engine.ts:42-48`). A plain `describe` when global setup probed the engine as `ok`; `describe.skip` under `POB_SKIP_ENGINE=1`; otherwise one failing test.
- **Global setup.** Scrubs `POESESSID`, points `POB_DIRECTORY`/`XDG_STATE_HOME` at temp dirs, and probes the engine (`tests/setup/global.ts:116-127`). The setup files make `fetch` throw (`tests/setup/env.ts:1-16`). `testTimeout` is 60 s (`jest.config.cjs:9-11`).
- **`startTestServer`** (`tests/helpers/server.ts:31`). The real server in process over `InMemoryTransport`. Returns `{client, deps, session, engineAccess, close}`.
- **`startSessionFixture`, `canonicalExport`** (`tests/helpers/engineSession.ts:47, :97`). A private builds folder holding the golden build, and the canonical export used for kind checks.
- **`spawnServer`** (`tests/helpers/spawnServer.ts:43-51, :100`). Runs `build/index.js` with an explicit env: trade and ninja disabled, `POE_TRADE_BASE` pointed at a dead address, temp folders.
- **`fixtureFetch`** (`tests/helpers/fixtureFetch.ts:99`). Routes HTTP to `tests/fixtures/trade2/`, `poeninja/`; throws on an unmatched URL; records calls.
- **`startLuaLineClient`** (`tests/helpers/luaLineClient.ts:64`). Raw wire access. `contract.test.ts` uses it: every registered Lua action needs a schema **and** a case there, in the same merge (`tests/integration/contract.test.ts:1-13`; cases at `:72, :106-107`).
- **Golden build.** `tests/fixtures/builds/grenadator.xml` (D-12; Mercenary / Gemling Legionnaire, level 90), plus `grenadator-low-str.xml`.
- **Example engine test of a new Lua action:** `tests/integration/gemCorruption.test.ts` (WU-25).
  - It opens with an `engineDescribe` block over `startSessionFixture`.
  - It reads state back from the engine's `export_build_xml` (`:28-50`) and from `__test_eval` Lua queries (`:62-75`).
  - It asserts the `TOOL_META` kind and the listed count (`:306-326`).
- **Untested today:** `lua_get_stats {category:'offense'}` and `set_main_skill` with a skill part (no test references either; the hygiene sample calls `set_main_skill {group_index:2}`, `tool-calls.json:70`).

## 6. Prior decisions in scope (spine §6)

- **Offline tests.**
  - **D-34:** no live network from agents or tests; fixtures only.
  - **HG-1:** a live request needs the user.
  - **D-17:** `mise run test` is the gate; engine tests fail rather than skip.
- **Commits.**
  - **D-48:** worktree agents commit with `-c commit.gpgsign=false`; a sign-rebase happens with the user.
  - **D-1:** commits go to the user's fork.
- **Network and hosts.** §13 allows pathofexile.com and poe.ninja only at runtime on a user call; github for the pin. **D-25:** one User-Agent.
- **State dir.**
  - **D-18 (HUMAN):** server state never lives in the builds folder.
  - **D-42 / D-81 / D-88:** export paths stay inside the builds folder or the state dir.
- **Writer.**
  - **C-17, D-9, D-60:** every builds-folder write goes through the writer; `lua_save_build` = export + writer.
  - **D-52:** canonical paths.
  - **D-80 / D-86:** the guard compares size and sha1, and knows the engine's fingerprint per path.
- **Session.**
  - **D-8 / D-59:** a mutex per call; only the session starts the engine.
  - **D-44:** the snapshot lives in memory.
  - **D-19 (HUMAN):** disk-change policy.
- **Limiter.**
  - **C-11, D-35:** multi-process limits are reconciled only through server headers.
  - **D-40:** no automatic retries.
  - **D-46:** no listing cache.
  - **D-70:** window guard.
  - **D-87:** no send with under 1 s left.
  - **D-22:** at most 5 searches and 90 s per `find_upgrades`.
- **Tool surface.**
  - **C-1, HG-3:** the surface changes only with the user.
  - **D-36:** no `structuredContent`.
  - **D-45:** the allowlist is strict.
  - **D-64 / D-91:** tool counts.
  - **D-83:** the README table is generated.
- **Dependencies.**
  - **§8 dependency rule:** only a sanctioned unit changes `package.json`.
  - **D-26:** zod v3; never pass zod schemas to the SDK.
- **Alpha/AC gate.**
  - **§5 / D-21:** alpha = the trade vertical; M-3 = every AC green and both hygiene files empty.
  - The spine is still marked "pending ratification" (`README.md:3-6`).
  - WU-21 (final acceptance) is still with the user (`docs/stabilization/worklog.md:1101`).

## 7. Gaps

1. **Compile vs the lock and the timeouts.** A plan compile is either many tool calls, which other agents can interleave between (each takes the lock separately, `session.ts:349-386`), or one long call. A long call meets three limits:
   - each bridge request gets 30 s and is SIGKILLed past it (`pobLuaBridge.ts:79, :570-577`);
   - Claude Code backgrounds calls after 120 s (D-22 rationale);
   - every successful `mutate` exports the whole XML (`session.ts:445-469`).

   There is no "batch under one lock" API.
2. **No set plumbing.** There are no Lua actions to create, copy, rename or select skill sets or config sets, and none to create, copy or rename item sets. `set_config`, `toggle_flask`, the gem tools and `get_skills` act on the active set only (`BuildOps.lua:449, :647, :482`).
3. **No setters for:**
   - weapon-set tags (`allocMode`) or attribute choices (`hashOverrides`): they are only preserved (`BuildOps.lua:126-138`);
   - `useSecondWeaponSet` (no code references it in `src/` or `pob-api/`);
   - auto-level mode: `set_level` forces manual (`:184`);
   - tree jewels: `add_item`'s enum has no jewel sockets.
4. **Skill-part selection.** The existing path writes the PoE1 field `skillPart`, not PoB2's `statSet` (§1). M1 also needs new Lua for per-skill and per-part output: `get_stats` exports only `mainOutput` scalars.
5. **`update_tree_delta` doesn't do what its description says.** It promises auto-pathing and the 8-point ascendancy check, but nothing implements them (§1). A plan's trees must be complete connected node lists. Alternatively, P2 uses `search_nodes`' `path`/`pathDist` (`BuildOps.lua:1425-1434`).
6. **K1/K2 have no bridge plumbing.** No action touches the stat describer, unique data, `ModCache` remainders or skill stat maps. Whether those are loaded headless is still marked "to ground" in the design (its References table); recon did not determine it.
7. **T1 has no cache and no dates, and conflicts with D-46.** Waits over 30 s become `would_wait` errors, not pacing (`rateLimiter.ts:117`). The kept price tools ignore the call's signal (`tradeHandlers.ts:282, :288`).
8. **The import-code encoder doesn't exist in `src/`** (§1).
9. **The guides folder is outside both confined roots.**
   - D-42/D-88 confine path arguments to the builds folder and the state dir.
   - A new env var must be read in `src/index.ts` (C-7) and redirected to a temp dir by Jest's global setup.
   - The writer covers only `POB_DIRECTORY`.
10. **Plan format tooling.** No YAML parser, and no runtime JSON-Schema emitter or validator: `zod-to-json-schema` is a devDependency (`package.json:31`). A YAML plan means a new dependency, which the spine's dependency rule gates.
11. **E1 and C1 data in `src/` meet the static scans.** The cruft scan bans PoE1 boss names and `Shadow` in string literals. The advice-file scan bans `quest points` (§2).
12. **Spine drift to fix when amending.** C-1 says 76 tools (it's 77), and D-65's crash-restore note is stale (§3).
13. **Not determined:** whether `mise` is on PATH for a plugin's server process, and whether a per-agent inline server is feasible (both open in the design's grounding list).
