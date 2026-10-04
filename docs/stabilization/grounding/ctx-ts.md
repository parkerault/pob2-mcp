# ctx-ts: existing-system ingestion, TypeScript side (pob2-mcp @ `stabilization/foundation`, HEAD `968a104`)

Scope: `src/**` (55 files, 23,940 lines), `tests/**`, `package.json`, `tsconfig*.json`, `jest.config.cjs`,
`mise.toml`, and resolved `node_modules`. Read-only. **[V]** = read in source just now; **[I]** = inference.
Line numbers refer to the working tree (only `docs/stabilization/vision.md` is modified vs HEAD).
`build/` (gitignored) was compiled at 14:53 from the same `src/` (src mtimes ≤ 13:46) [V], and was used only
to count schemas at runtime. That count was cross-checked against a static grep.

---

## 1. Module map

### `src/` (top level)
| File | Lines | Responsibility |
|---|---|---|
| `index.ts` | 404 | Entry and `PoBMCPServer` class. Builds services, registers 4 MCP request handlers, connects stdio. **Instantiates itself at import** (`:403-404`) [V] |
| `pobLuaBridge.ts` | 555 | `PoBLuaApiClient`: spawns luajit on the vendored `pob-api/bootstrap.lua`, runs the newline-JSON protocol, 38 typed action methods plus `stop` [V] |
| `types.ts` | 354 | Shared PoB-XML, tree, cache and `SnapshotMetadata` (`:344-354`) types [V] |
| `defensiveAnalyzer.ts` | 704 | `analyze_defenses` logic (hard-coded bands) [V] |
| `itemAnalyzer.ts` | 419 | `analyze_items` logic (PoE1) [V] |
| `skillLinkOptimizer.ts` | 599 | `optimize_skill_links` logic (PoE1 6-link model) [V] |

### `src/data/`
| `poe2Campaign.ts` | 158 | PoE2 campaign, trials and gem notes for `plan_leveling` [V] |
|---|---|---|

### `src/server/`
| File | Lines | Responsibility |
|---|---|---|
| `toolSchemas.ts` | 1810 | 10 `get*ToolSchemas()` functions returning JSON-Schema tool descriptors (98 tools) [V] |
| `toolRouter.ts` | 773 | `routeToolCall(name, args, deps)`: one `switch` over 100 names [V] |
| `luaClientManager.ts` | 104 | `LuaClientManager`: enabled flag, lazy `ensureClient` (spawn + readiness probe), `stopClient` [V] |
| `responseUtils.ts` | 53 | `ToolResponse` type; `truncateResponse`/`wrapWithTruncation` (5000 chars) [V] |
| `toolGate.ts` | 15 | `ToolGate`: no-op [V] |

### `src/handlers/` (22 files; each exports `handle*` functions)
| File | Lines | Tools |
|---|---|---|
| `luaHandlers.ts` | 898 | lua_start/stop/new_build/save_build/load_build/get_stats/get_tree/set_tree/get_build_info/reload_build, update_tree_delta, search_tree_nodes, list_gems, import_build, get_classes, create/list/select/delete/rename_spec, list/select_item_set (22 handlers) |
| `itemSkillHandlers.ts` | 751 | add_item, get_equipped_items, toggle_flask, get_skill_setup, set_main_skill, create_socket_group, add_gem, set_gem_level/quality, remove_skill/gem, toggle_socket_group, toggle_gem, setup_skill_with_gems, add_multiple_items (15) |
| `tradeHandlers.ts` | 1015 | search_trade_items, get_item_price, get_leagues, search_stats, find_resistance_gear, compare_trade_items; `handleFindItemUpgrades` (`:548`) is imported but **never routed** (dead) |
| `buildHandlers.ts` | 587 | list_builds, analyze_build, compare_builds, get_build_stats, get/set_build_notes |
| `treeHandlers.ts` | 646 | compare_trees, get_nearby_nodes, find_path_to_node, get_passive_upgrades, suggest_masteries |
| `clusterJewelHandlers.ts` | 666 | search_cluster_jewels, analyze_cluster_jewels (routed-only), analyze_build_cluster_jewels |
| `skillGemHandlers.ts` | 600 | 6 legacy PoE1 gem tools |
| `advancedOptimizationHandlers.ts` | 461 | analyze_items, optimize_skill_links, create_budget_build |
| `itemShoppingHandler.ts` | 405 | find_item_upgrades (static "shopping spec" from engine items; no trade calls) |
| `configHandlers.ts` | 380 | get/set_config, set_enemy_stats, save/load/list_config_presets |
| `optimizationHandlers.ts` | 368 | analyze_defenses, suggest_optimal_nodes, optimize_tree |
| `poeNinjaHandlers.ts` | 272 | get_currency_rates, find_arbitrage, calculate_trading_profit |
| `exportHandlers.ts` | 265 | export_build, save_tree, snapshot_build, list_snapshots, restore_snapshot, export_build_summary |
| `buildGoalsHandlers.ts` | 246 | get_build_issues + `formatIssuesResponse` (also used by lua_load_build's "Top Issues") |
| `levelingHandlers.ts` | 212 | plan_leveling |
| `validationHandlers.ts` | 209 | validate_build (Lua path + XML path) |
| `shoppingListHandlers.ts` | 186 | generate_shopping_list |
| `bossReadinessHandlers.ts` | 179 | check_boss_readiness |
| `craftingAdvisorHandler.ts` | 174 | suggest_crafting (poedb fetch) |
| `jewelAdvisorHandlers.ts` | 138 | suggest_watchers_eye |
| `watchHandlers.ts` | 127 | start/stop_watching, get_recent_changes, watch_status, refresh_tree_data |
| `poe2SkillHandlers.ts` | 125 | analyze_skills, suggest_supports (engine-backed) |

### `src/services/` (15)
| File | Lines | Responsibility |
|---|---|---|
| `buildService.ts` | 1175 | List and read build XML (`fast-xml-parser`, 60 s / 20-entry cache), summaries, spec/node/flask/jewel/config parsing |
| `skillGemService.ts` | 936 | PoE1 gem DB and archetypes (legacy gem tools only) |
| `treeService.ts` | 790 | Loads `POB_FORK_PATH/TreeData/<ver>/tree.json`, in-memory cache, graph, pathing, tree analysis |
| `shoppingListService.ts` | 708 | generate_shopping_list logic |
| `validationService.ts` | 675 | XML-based validation rules |
| `statMapper.ts` | 639 | Maps PoB stat names to trade stat ids: static `STAT_MAPPINGS` (`:19`) plus live `/data/stats` (`loadFromTradeAPI :452`) |
| `tradeQueryBuilder.ts` | 560 | Fluent trade2 query builder |
| `itemRecommendationEngine.ts` | 535 | Trade-backed upgrade and resist-gear search (reachable only via `find_resistance_gear` and `compare_trade_items`) |
| `buildExportService.ts` | 469 | export, save_tree, snapshot and restore file ops (XMLBuilder, `<PathOfBuilding>` root `:324`) |
| `costBenefitAnalyzer.ts` | 408 | Trade item value and price metrics |
| `poe2SkillService.ts` | 367 | Engine-backed gem tag compatibility and support ranking |
| `poeNinjaClient.ts` | 359 | poe.ninja PoE2 currency client + arbitrage |
| `tradeClient.ts` | 297 | `TradeApiClient`: trade2 HTTP, Bottleneck limiter, in-memory cache |
| `watchService.ts` | 119 | chokidar watcher plus recent-changes ring |
| `craftingDataService.ts` | 52 | poedb.tw fetch + HTML-to-text |

### `src/types/`, `src/utils/`
| File | Lines | Responsibility |
|---|---|---|
| `types/tradeTypes.ts` | 507 | Trade query, result and listing types (`CacheEntry :489`, `RateLimitInfo :482`) |
| `types/optimization.ts` | 56 | `OptimizationConstraints` etc. |
| `utils/contextBuilder.ts` | 265 | `ContextBuilder`: 11 context factory methods (§4) |
| `utils/buildCode.ts` | 79 | PoB export-code decode; pobb.in/pastebin fetch |
| `utils/errorHandling.ts` | 55 | `wrapHandler(action, fn)` / `wrapHandlerSync` |
| `utils/pathSanitizer.ts` | 31 | `sanitizeBuildName(name, baseDir)`: blocks NUL, absolute paths, `..`, and escapes from baseDir |

**Dead or quasi-dead [V by grep]:** `index.ts` private helpers `checkToolGate`, `unlockToolGate`, `getTreeData("3_26")`,
`getActiveSpec`, `parseAllocatedNodes`, `extractBuildVersion` and `analyzePassiveTree` (`:188-222`) have no callers. `index.ts:47,83`
`this.parser` is constructed but unused. `tradeHandlers.handleFindItemUpgrades` is not routed.
`PoBLuaApiClient.getMasteryOptions` is only for `suggest_masteries`.

---

## 2. Startup sequence (`src/index.ts`)

**Import time** [V]:
1. ESM imports of the SDK (`Server` from `@modelcontextprotocol/sdk/server/index.js`, `StdioServerTransport` from
   `.../server/stdio.js`, the 4 request schemas from `.../types.js`) plus every service and handler module (the router imports all 22 handler files).
2. **`pobLuaBridge.ts:40` `const POB_API_DIR = resolvePobApiDir()`** is a module-level **filesystem probe**
   (`fs.existsSync(<candidate>/bootstrap.lua)`). Candidates in order: `dirname(argv[1])/../pob-api`, `dirname(argv[1])/pob-api`,
   `cwd/pob-api`, `cwd/../pob-api`. It falls back to the first candidate (`:22-38`).
3. **`index.ts:403` `const server = new PoBMCPServer()` and `:404` `server.run().catch(console.error)`** run at module
   top level, so importing `index.ts` starts the server. No `createServer` export exists.

**Constructor (`:68-185`)**, synchronous [V]:
- `new Server({name:"pob2-mcp-server", version:"0.1.0"}, {capabilities:{resources:{}, tools:{}}})` (`:69-80`). Low-level
  `Server` API, **not `McpServer`**. The version string differs from `package.json` `0.2.2`.
- `pobDirectory = POB_DIRECTORY || default` (`:90-94`). Default: darwin `~/Path of Building/Builds`, else
  `~/Documents/Path of Building/Builds`.
- Services, in order: `BuildService(pobDir)`, `TreeService(buildService)`, `WatchService(pobDir, buildService)`,
  `ValidationService()`, `BuildExportService(pobDir)`, `SkillGemService()` (`:97-102`), `PoeNinjaClient()` (`:105`, always).
  Each constructor only builds in-memory state; none does I/O [V for BuildService/TreeService/WatchService/BuildExportService/
  PoeNinjaClient/TradeApiClient constructors; I for the rest].
- If `POE_TRADE_ENABLED==='true'`: `TradeApiClient({requestsPerSecond, cacheTTL})`, `StatMapper()` (loads static
  mappings), `ItemRecommendationEngine(tradeClient, statMapper)` (`:113-126`).
- `ToolGate()`. `LuaClientManager(POB_LUA_ENABLED==='true')` (`:129-132`). **No engine spawn at startup.**
- `ContextBuilder({...services, pobDirectory, luaEnabled, getLuaClient, ensureLuaClient, stopLuaClient})` (`:135-147`).
- `setupHandlers()` (`:153`). `server.onerror` logs `[MCP Error]` (`:156`).
- `process.stdout`/`stderr` `'error'` listeners: on EPIPE they call `process.exit(0)` (`:161-175`). SIGINT and SIGTERM run `shutdown`, which is
  `watchService.stopWatching()`, then `luaClientManager.stopClient()`, then `server.close()`, then `process.exit(0)` (`:177-184`).
  **There is no stdin `end`/`close` handler** [V grep], and the SDK `StdioServerTransport` listens only to `'data'` and `'error'`
  (`node_modules/.../dist/esm/server/stdio.js:32-33`) [V]. So nothing exits the process on stdin EOF (recon defect E9).

**`run()` (`:392-399`)** [V]:
1. `await this.initialize()`. If trade is enabled, it calls `tradeClient.getStatData()`: a **network GET
   `https://www.pathofexile.com/api/trade2/data/stats` before the transport connects**. The request has no timeout. Its error is caught and
   logged, and `StatMapper` keeps the static fallback (`:377-390`). If the network hangs, the MCP handshake is delayed indefinitely [I].
2. `new StdioServerTransport()`, `await server.connect(transport)`, then log `"Path of Building PoE2 MCP Server running on stdio"`.

**Side effects before the transport connects:** FS probe (bridge import), `console.error` lines, and, only with
`POE_TRADE_ENABLED=true`, one trade2 `/data/stats` GET. No FS writes. No engine spawn [V].

**Handler wiring (`setupHandlers :224-372`)**, all via `this.server.setRequestHandler(<Schema>, fn)` [V]:
- `ListResourcesRequestSchema` returns `buildService.listBuilds()` mapped to `{uri:"pob://build/<encodeURIComponent(name)>", name,
  mimeType:"application/xml", description}`. Errors give `{resources:[]}`.
- `ReadResourceRequestSchema` matches `^pob:\/\/build\/(.+)$`, then `readBuild` + `generateBuildSummary` →
  `{contents:[{uri, mimeType:"text/plain", text}]}`. It **throws** on a bad URI or read failure (protocol-level error).
- `ListToolsRequestSchema` concatenates the schema groups below (§4).
- `CallToolRequestSchema` builds `ToolRouterDependencies` **per call** (`:325-334`), then `await routeToolCall(name, args, deps)`.
  If `name` is in a hard-coded list of 21 names (`:340-348`), it calls `wrapWithTruncation(result)`. A `catch` turns the error into the error shape (§5).

---

## 3. Environment variables read in `src/`

| Name | Read at | Default | Meaning |
|---|---|---|---|
| `POB_DIRECTORY` | `index.ts:94` | `~/Documents/Path of Building/Builds` (non-darwin, `:90-92`) | Builds root. Used by all file tools, snapshots, presets, watcher, and save paths |
| `POB_LUA_ENABLED` | `index.ts:131` | off (must be `'true'`) | Lists engine/config/build-goals tools. When false, `ensureClient` throws `"PoB Lua Bridge is not enabled. Set POB_LUA_ENABLED=true to use lua_* tools."` (`luaClientManager.ts:29`) |
| `POB_FORK_PATH` | `luaClientManager.ts:46` (bridge `cwd`); `pobLuaBridge.ts:92` (unreachable fallback, `options.cwd` is always set by the constructor); `treeService.ts:57` | bridge: `~/Projects/PathOfBuilding-PoE2/src` (`pobLuaBridge.ts:77`, **capital `P`, does not exist on this box**); treeService: `""`, giving **cwd-relative `TreeData/`** | PoB2 checkout `src/` dir |
| `POB_CMD` | `luaClientManager.ts:47` | `"luajit"` (`pobLuaBridge.ts:80`) | Engine executable |
| `POB_ARGS` | `luaClientManager.ts:48` | `[<pob-api>/bootstrap.lua]` (`pobLuaBridge.ts:82`) | Whole string becomes **one** argv element (not split) |
| `POB_TIMEOUT_MS` | `luaClientManager.ts:49` | `30000` (`pobLuaBridge.ts:84`) | Per-**line-read** timeout (§6) |
| `POB_DEBUG` | `pobLuaBridge.ts:219` | off (`'true'`) | Echo engine stdout chunks to stderr |
| `JEST_WORKER_ID` | `pobLuaBridge.ts:141` | — | **Test hack in production code**: throws `"Failed to find valid ready banner"` when set and `timeoutMs <= 150` |
| `POB_LEGACY_GEM_TOOLS` | `index.ts:299` | off (`'true'`) | Lists the 6 legacy gem tools (they are routed regardless) |
| `POE_NINJA_DISABLED` | `index.ts:106,312` | on unless `'true'` | Hides the 3 poe.ninja tools (still routed) |
| `POE_TRADE_ENABLED` | `index.ts:113` | off (`'true'`) | Constructs the trade client, stat mapper and recommendation engine. Lists trade tools; the router throws `"Trade API is not enabled. Set POE_TRADE_ENABLED=true to enable."` when it is off |
| `POE_RATE_LIMIT_PER_SECOND` | `index.ts:115` | `'4'` | Bottleneck config (§8) |
| `POE_CACHE_TTL` | `index.ts:116` | `'300'` (seconds) | Default trade cache TTL |
| `POE_TRADE_BASE` | `tradeClient.ts:26` | `https://www.pathofexile.com/api/trade2` | Trade API base |
| `POE_TRADE_REALM` | `tradeClient.ts:29` | `poe2` | Realm path/query segment |
| `POE_TRADE_USER_AGENT` | `tradeClient.ts:218` | `pob2-mcp-server/0.1 (+https://github.com/PathOfBuildingCommunity)` | Trade UA |
| `POE_SESSION_ID` | `tradeClient.ts:222-223` | unset | Sends `Cookie: POESESSID=<value>` on **every** trade request, including `/data/*` |

Notes [V]:
- **`POESESSID` itself is not read anywhere in `src/`.** No `.env` loading exists in `src/` (no `dotenv`, no
  `util.parseEnv`).
- **The engine child inherits the entire `process.env`** (`pobLuaBridge.ts:115-117`) plus `LUA_PATH`/`LUA_CPATH` (written, `:123-124`).
- The Lua side reads only `POB_API_DEBUG` (`pob-api/API/Server.lua:5`, `Handlers.lua:5`).
- Docs mention `POB_API_TCP`, `POB_API_TCP_PORT`, `POB_API_TCP_HOST` and `POB_API_STDIO`, but **nothing reads them** (`pobLuaBridge.ts:118-122`
  deliberately does not set `POB_API_STDIO`).
- **Four different `POB_FORK_PATH` defaults:** the bridge, treeService, the dead fallback, and the integration test (§9).
- `os.homedir()` is used for the defaults and for `~/.luarocks/lib/lua/5.1` in `LUA_CPATH` (`pobLuaBridge.ts:100`).

---

## 4. Tool registration and dispatch

**Schema declaration (`toolSchemas.ts`)** [V]:
- Plain JSON-Schema object literals: `{name, description, inputSchema:{type:"object", properties:{…}, required?:[…]}}`.
  The `ToolSchema` interface (`:8-16`) types only `getToolSchemas()`. The other 9 functions return `any[]`.
- No zod. No `additionalProperties`/`oneOf`/`anyOf`. 3 `minimum|maximum`, 11 `enum:`, 66 `required:`. No `annotations`,
  `outputSchema` or `title`.
- **No env reads in `toolSchemas.ts`.** All gating happens in `index.ts` ListTools. There is no runtime argument validation: the router casts `args.x as T`.
- Groups (function @ line → count):

| Function | Line | Count | Listed when |
|---|---|---|---|
| `getToolSchemas` | 21 | 14 | always |
| `getLuaToolSchemas` | 217 | 43 | `POB_LUA_ENABLED=true` |
| `getConfigToolSchemas` | 1012 | 6 | `POB_LUA_ENABLED=true` |
| `getBuildGoalsToolSchemas` | 1649 | 6 | `POB_LUA_ENABLED=true` |
| `getOptimizationToolSchemas` | 896 | 6 | always |
| `getValidationToolSchemas` | 1118 | 1 | always |
| `getExportToolSchemas` | 1293 | 6 | always |
| `getSkillGemToolSchemas` | 1139 | 6 | `POB_LUA_ENABLED`-independent; `POB_LEGACY_GEM_TOOLS=true` |
| `getTradeToolSchemas` | 1432 | 7 | `tradeClient != null` (`POE_TRADE_ENABLED=true`) |
| `getPoeNinjaToolSchemas` | 1750 | 3 | `POE_NINJA_DISABLED !== 'true'` |

  Listed counts: no flags = **30**; +Lua = **85**; +Lua+trade = **92**; all flags = **98** (`index.ts:273-317`) [V arithmetic].

**Counts and method [V]:**
- **Registered: 98 unique names.** Method: imported compiled `build/server/toolSchemas.js` under `mise exec -- node`,
  called all 10 functions, giving 98 total and 98 unique. Cross-check: `grep -E '^      name: "' src/server/toolSchemas.ts` gives 98,
  and the sorted name sets are identical.
- **Routed: 100 unique names.** Method: `grep -oE '^\s+case "[a-z_0-9]+"' src/server/toolRouter.ts`, giving 100 lines and 100 unique.
- Routed-only (not registered): **`analyze_cluster_jewels`** (`toolRouter.ts:641`), **`find_resistance_gear`** (`:600`).
  Registered but not routed: none.
- The vision §4 table (keep / fix / rewrite / new / delete) was diffed against the 100 routed names: an **exact match, 100/100**. D-4's
  delete list is 25 names [V].

**Dispatch (`toolRouter.ts`)** [V]:
- `export async function routeToolCall(name: string, args: Record<string, unknown> | undefined, deps: ToolRouterDependencies): ToolResponse`
  (`:61-65`). `ToolRouterDependencies` (`:38-47`) = `{toolGate, contextBuilder, tradeClient|null, statMapper|null,
  recommendationEngine|null, ninjaClient, getLuaClient, ensureLuaClient}`.
- Calls `deps.toolGate.checkGate(name)` (a no-op, `:67`). Then it **eagerly builds 8 contexts on every call** (`:70-77`): handler, watch,
  tree, lua, itemSkill, optimization, export, skillGem.
- A single `switch (name)` (`:79`) with `case "<tool>":` / `return await handleX(...)`. The `default` throws
  `` `Unknown tool: ${name}` `` (`:770-771`).
- Argument passing styles, all unchecked casts:
  - (a) positional args, e.g. `handleAnalyzeBuild(handlerContext, args.build_name as string)`;
  - (b) an args object with snake_case keys (export, config, trade, skill-gem handlers);
  - (c) raw `args as any` (`search_trade_items`, `find_item_upgrades`, `find_resistance_gear`, `compare_trade_items`,
    `search_cluster_jewels`, poe.ninja tools, `suggest_crafting`).
  - Some cases accept camelCase aliases (`group_index ?? groupIndex`, `save_as ?? saveAs`, `query ?? keyword ?? q`).
  - Missing args give `throw new Error("Missing arguments")`.
- Ad-hoc contexts are built inline for config, build-goals, leveling, boss, jewel and poe.ninja tools (`{getLuaClient, ensureLuaClient}` or
  `{ninjaClient}`). Trade tools build `{tradeClient, statMapper?, recommendationEngine?, ninjaClient}` inline.
- **One tool is implemented inline in the router:** `set_character_level` (`:163-178`; it validates 1–100 and calls
  `setLevel` + `getStats([...4])`).
- **Gating mismatch:** routing never consults registration. Lua tools route whether or not they are listed and fail inside `ensureClient`. Legacy gem
  tools route without the flag check. Poe.ninja tools route even when disabled.

**Context object (`contextBuilder.ts`)** [V]: `ContextBuilder(deps: ContextDependencies)` (`:111-129`) has 11 builders.

| Builder | Fields |
|---|---|
| `buildHandlerContext` / `buildTreeContext` | `buildService, treeService, validationService, pobDirectory, getLuaClient, ensureLuaClient` |
| `buildWatchContext` | `buildService, treeService, watchService` |
| `buildLuaContext` | `pobDirectory, luaEnabled, getLuaClient, ensureLuaClient, stopLuaClient` |
| `buildItemSkillContext` | `getLuaClient, ensureLuaClient` |
| `buildOptimizationContext` | `buildService, treeService, pobDirectory, getLuaClient, ensureLuaClient` |
| `buildExportContext` | `buildService, exportService, luaClient: getLuaClient() \|\| undefined` (**the client is captured eagerly** at the start of routing, before any `ensureClient`, `:209-215`) |
| `buildSkillGemContext` | `buildService, skillGemService, pobDirectory, getLuaClient, ensureLuaClient` |
| `buildAdvancedOptimizationContext` | `buildService, pobDirectory, getLuaClient, ensureLuaClient` |
| `buildValidationContext` | `buildService, validationService, pobDirectory, getLuaClient, ensureLuaClient` |
| `buildConfigPresetContext` | `getLuaClient, ensureLuaClient, pobDirectory` |

**Engine use without `ensureLuaClient`** [V grep `getLuaClient()` vs `ensureLuaClient()` per file]:
`levelingHandlers.ts` (0 ensure), `validationHandlers.ts` (0), `itemShoppingHandler.ts` (0, and the router passes only
`{getLuaClient}`, `:595`), `craftingAdvisorHandler.ts` (0), `advancedOptimizationHandlers.ts` (0), and
`export_build_summary` (captured `luaClient`, `exportHandlers.ts:196-197`). These degrade or fail if the engine has not been
started by an earlier call.

---

## 5. Handler conventions

- **Success shape** [V]: `{ content: [{ type: "text" as const, text: string }] }`, always exactly one text item.
  Type `ToolResponse` = `{content: Array<{type: string; text: string}>}`, declared twice (`responseUtils.ts:6-11`,
  `toolRouter.ts:49-54`). **There is no `isError` field in either type** (no occurrence of `isError` in `src/`).
- **Failure shape** [V]: `index.ts:355-370` catches any throw and returns `{content:[{type:"text", text:`Error: ${msg}`}]}`
  with **no `isError`** (recon E6). It logs `[Tool Error] tool=<name> error=<msg>` and `[Tool Stack] <stack>`.
  Unknown tools and missing args also come back as this text, not as a protocol error.
- **Propagation** [V]:
  - Handlers mostly **throw**. The dominant pattern is
    `export async function handleX(context, ...) { return wrapHandler('<verb phrase>', async () => {...}) }`. It appears at 84
    `wrapHandler(` call sites in 20 of the 22 handler files. The exceptions are `advancedOptimizationHandlers.ts` and `treeHandlers.ts`, which use their own
    try/catch. `wrapHandlerSync` is unused.
  - `wrapHandler` rethrows `new Error(`Failed to ${action}: ${msg}`)`, so the user sees `Error: Failed to <action>: <msg>`.
  - **Exceptions that return error text instead of throwing** (indistinguishable from success):
    `treeHandlers.ts:186-194` (get_nearby_nodes), `:338-346` (find_path_to_node), `buildHandlers.ts:188-197`
    (analyze_build, invalid tree), `poeNinjaHandlers.ts:188-197` (chain < 2).
  - Many handlers swallow sub-call errors as best effort (`try {…} catch { /* best effort */ }`, about 64 `catch` sites in handlers).
- **Truncation:** 21 tool names get `wrapWithTruncation(result, 5000)`, which cuts `content[0].text` at the last newline ≤ 5000 chars and appends
  `[Response truncated: N characters, ~M lines remaining]` (`responseUtils.ts:21-35`, `index.ts:340-352`). The list includes
  13 tools that D-4 deletes.
- **Logging** [V]: `console.error` only (no logger library; **no `console.log`/`stdout.write` anywhere in `src/`**, so stdout is
  reserved for MCP). Prefix style `[Component] message`, e.g. `[Lua Bridge]`, `[Trade API]`, `[TradeAPI]`, `[poe.ninja API]`,
  `[StatMapper]`, `[Tree Cache]`, `[Tree Data]`, `[File Watcher]`, `[PoB API stderr]`, `[MCP Error]`, `[Tool Error]`. Most calls are in
  `index.ts` (15), `luaClientManager.ts` (9) and `treeService.ts` (7).
- **Output text style:** Markdown-ish plain text, `===` section headers, emoji status markers (`✅`, `❌`, `📋`), and
  `toLocaleString()` numbers.
- **Naming:**
  - tools are `snake_case`, and argument keys are `snake_case` (some camelCase aliases);
  - handlers are `handle<PascalCase>` in `src/handlers/<area>Handlers.ts`;
  - context interfaces are `<Area>HandlerContext` or `<Area>Context`, declared in the handler file;
  - services are PascalCase classes in `src/services/<name>Service.ts` or `<name>Client.ts`, constructed once in `index.ts` and injected.
- **Module style** [V]:
  - `package.json` `"type": "module"`; tsconfig `module`/`moduleResolution` `Node16`.
  - **Every relative import ends in `.js`**: a grep for extensionless relative imports in `src/` finds nothing.
  - `import type` is used for type-only imports.
  - Node built-ins use default imports (`import fs from "fs/promises"`, `import path from "path"`), with one `node:` prefix
    (`buildCode.ts:7`).
  - Two dynamic `await import()` calls (`luaHandlers.ts:727`, `advancedOptimizationHandlers.ts:43-44,174-175`).
  - Global `fetch` (Node built-in) everywhere; no `node-fetch` import even though `@types/node-fetch` is a devDependency.
  - **No `import.meta`, `__dirname` or `require(` in `src/`.**
  - Quote style is mixed (double quotes in `index.ts`/router, single elsewhere).

---

## 6. Lua bridge client (`src/pobLuaBridge.ts`, `src/server/luaClientManager.ts`)

**Spawn (`start() :88-216`)** [V]:
- `spawn(cmd, args, {cwd, env, stdio:["pipe","pipe","pipe"]})` (`:128-132`). Inputs:
  - `cmd`: `POB_CMD || "luajit"`;
  - `args`: `POB_ARGS ? [POB_ARGS] : [<POB_API_DIR>/bootstrap.lua]`;
  - `cwd`: `POB_FORK_PATH || ~/Projects/PathOfBuilding-PoE2/src`;
  - `env`: `{...process.env, ...options.env, LUA_PATH, LUA_CPATH}`.
- `LUA_PATH` (`:123`) = `<pob-api>/?.lua;<pob-api>/?/init.lua;<base>/runtime/lua/?.lua;<base>/runtime/lua/?/init.lua;;`.
  `LUA_CPATH` (`:124`) = `<base>/runtime/?.so;~/.luarocks/lib/lua/5.1/?.so;;`. `<base>` is the cwd with a trailing `/src` stripped
  (`:95-97`). The separator is `;` on all OSes (`:108`).
- `stdout` and `stderr` use utf8. stderr chunks are logged as `[PoB API stderr] <chunk>` (`:154-157`). A process `'error'` sets `killed` and emits the error.
  `'exit'` sets `killed` and emits `Error("PoB API exited: code=<c> signal=<s>")` on the internal `dataEmitter` (`:147-162`).
- **Readiness:** the client reads up to 50 lines (`:167`), skipping blank lines and lines not starting with `{`. The first JSON with `ready === true`
  sets `this.ready = true` (`:194-212`). The Lua banner is `{ok=true, ready=true, version=<meta>}`
  (`pob-api/API/Server.lua:62`); TS ignores `version`. The ENOENT-friendly message (`:175-185`) only fires if the
  `'error'` event lands before the first line read (recon E9 says it is dead in practice).

**Line protocol today** [V]:
- **Request:** a single line, `JSON.stringify({action: string, params?: object}) + "\n"` (`:274`). `params` is omitted for
  no-arg actions. Lua defaults it to `{}` (`Server.lua:73`).
- **Reply:** one JSON line. The envelope is `{ok: boolean, error?: string, ...payload}`; the payload key varies per action (table below). Lua
  errors come back as `{ok:false, error:"exception: <msg>"}`, `"unknown action: <a>"` or `"invalid json"` (`Server.lua:66-82`).
- **Matching: none.** `send()` writes, then returns the **first subsequent line that starts with `{` and parses as JSON**
  (`:281-298`, up to 100 lines). There are no request ids.
- **Concurrency:** an `isSending` flag means a second call throws `"Concurrent request not supported"` (`:270`).
- **Timeouts:** `readLineWithTimeout(timeoutMs)` arms its timer **for each line read** (`:226-264`), starting when the read begins.
  A reply preceded by k non-JSON lines may take up to (k+1)×timeout. On timeout the client rejects with `"Timed out waiting for response"`
  and resets `isSending`. **It does not kill the process**, so the late reply stays in `buffer` and is returned to the next caller (E5).
  Startup uses the same per-line timeout (up to 50×).
- **Guards:** `send` throws `"Process not started"`, `"PoB API exited"` or `"Process not ready"` (`:267-269`).
- **`isAlive()`** = `!killed && ready && !!proc` (`:66-68`).
- **`stop()`:** sends `{action:"quit"}` and ignores errors, then calls `proc.kill()` (SIGTERM) and sets `proc = null` (`:546-553`).

**Manager (`luaClientManager.ts`)** [V]:
- `ensureClient()` (`:27-81`):
  - It throws if not enabled.
  - If a client exists and is alive, it returns.
  - If the client is dead, it logs `Client process died, restarting...`, calls `stop()`, and **spawns a new one (silent restart; the loaded build is lost)**.
  - After spawn, it runs a **readiness probe**: `loadBuildXml('<?xml …?><PathOfBuilding><Build level="1" className="Witch"/></PathOfBuilding>',
    'Init Test')` (`:58-64`). This is a PoE1 root (recon E4). It allows up to 5 attempts with `setTimeout 2000` between them, then
    throws `HeadlessWrapper did not initialize after 5 attempts…`.
  - All failures are wrapped as `Failed to start PoB Lua Bridge: <msg>`.
  - **Not single-flight**: concurrent cold calls each spawn a process (E5).
- No automatic crash detection or restart outside `ensureClient`. No backoff. No state restore.
- `stopClient()` (`:86-96`): `client.stop()`, then `client = null`. `isEnabled()`.

**Public methods → Lua action → returned value** [V `pobLuaBridge.ts:306-544`]. Every method throws `res.error || "<action> failed"` when
`!ok`.

| Method | Action | Params sent | Returns |
|---|---|---|---|
| `ping()` | `ping` | — | `!!res.ok` |
| `newBuild(p?)` | `new_build` | `{className?, ascendancy?}` or `{}` | whole `res` |
| `saveBuild(path)` | `save_build` | `{path}` | `res.result` |
| `loadBuildXml(xml, name="API Build")` | `load_build_xml` | `{xml, name}` | whole `res` |
| `getStats(fields?)` | `get_stats` | `{fields}` | `res.stats` |
| `getTree()` | `get_tree` | — | `res.tree` |
| `getItems()` | `get_items` | — | `res.items` |
| `addItem(text, slotName?, noAutoEquip?)` | `add_item_text` | `{text, slotName, noAutoEquip}` | `res.item` |
| `setFlaskActive(i, active)` | `set_flask_active` | `{index, active}` | void |
| `getSkills()` | `get_skills` | — | `res.skills` |
| `setMainSelection(p)` | `set_main_selection` | `{mainSocketGroup?, mainActiveSkill?, skillPart?}` | void |
| `setTree(p)` | `set_tree` | `{classId, ascendClassId, secondaryAscendClassId?, nodes, masteryEffects?, treeVersion?}` | `res.tree` |
| `exportBuildXml()` | `export_build_xml` | — | `res.xml` |
| `getBuildInfo()` | `get_build_info` | — | `res.info` |
| `setLevel(level)` | `set_level` | `{level}` | void |
| `getConfig()` | `get_config` | — | `res.config` |
| `setConfig(p)` | `set_config` | `p` | `res.config` |
| `createSocketGroup(p?)` | `create_socket_group` | `{label?, slot?, enabled?, includeInFullDPS?}` | `res.socketGroup` |
| `addGem(p)` | `add_gem` | `{groupIndex, gemName, level?, quality?, qualityId?, enabled?, count?}` | `res.gem` |
| `setGemLevel(p)` | `set_gem_level` | `{groupIndex, gemIndex, level}` | void |
| `setGemQuality(p)` | `set_gem_quality` | `{groupIndex, gemIndex, quality, qualityId?}` | void |
| `removeSkill(p)` | `remove_skill` | `{groupIndex}` | void |
| `removeGem(p)` | `remove_gem` | `{groupIndex, gemIndex}` | void |
| `setSocketGroupEnabled(p)` | `set_socket_group_enabled` | `{groupIndex, enabled}` | `res.result` |
| `setGemEnabled(p)` | `set_gem_enabled` | `{groupIndex, gemIndex, enabled}` | void |
| `searchNodes(p)` | `search_nodes` | `{keyword, nodeType?, maxResults?, includeAllocated?}` | `res.results` |
| `listGems(p={})` | `list_gems` | `{type?, search?, tag?, maxResults?, dedupeByName?}` | `res.result` |
| `getClasses()` | `get_classes` | — | `res.result` |
| `updateTreeDelta(p)` | `update_tree_delta` | `{addNodes?, removeNodes?, classId?, ascendClassId?, secondaryAscendClassId?, treeVersion?}` | `{tree, autoPathedNodes, skippedAscendancyNodes}` |
| `calcWith(p)` | `calc_with` | `{addNodes?, removeNodes?, masteryEffects?, useFullDPS?}` | `res.output` |
| `getMasteryOptions()` | `get_mastery_options` | — | `res.result` |
| `createSpec(p?)` | `create_spec` | `{title?, copyFrom?, activate?}` | `res.result` |
| `listSpecs()` | `list_specs` | — | `res.result` |
| `selectSpec(i)` | `select_spec` | `{index}` | `res.result` |
| `deleteSpec(i)` | `delete_spec` | `{index}` | `res.result` |
| `renameSpec(i, title)` | `rename_spec` | `{index, title}` | `res.result` |
| `listItemSets()` | `list_item_sets` | — | `res.result` |
| `selectItemSet(id)` | `select_item_set` | `{id}` | `res.result` |
| `stop()` | `quit` | — | — |

The Lua side also registers `version` (`Handlers.lua:74`), which has **no TS method**. There are 39 Lua handlers, plus `quit` in `Server.lua:57`
[V].

**Loaded-build identity:** the only record is the `name` passed to `load_build_xml`, read back via `getBuildInfo().name`.
- `lua_load_build` uses the file name without `.xml` (`luaHandlers.ts:117-119`), and `lua_reload_build` uses the same value (`:498-510`).
- Other callers pass different names: `analyze_build` loads with no name (default `"API Build"`, `buildHandlers.ts:70`), `import_build` uses `"Imported Build"`, and
  the readiness probe uses `"Init Test"` [V].
- TS keeps no loaded-file, mtime or revision state [V].

---

## 7. Persistent and stateful things

| Thing | Location / key | Format | Lifecycle |
|---|---|---|---|
| **snapshot_build** | `<POB_DIRECTORY>/.pob-mcp/snapshots/<build_name as given, incl. .xml and subdirs>/` (`buildExportService.ts:41,156`) | `<id>_<tag>.xml` is a **byte copy of the on-disk build file** (not engine state). `<id>_metadata.json` is `SnapshotMetadata {timestamp, originalBuild, description, tag, statsSnapshot{life,dps,allocatedNodes}}` read from file XML `PlayerStat` (`:157-191`). `id` = `new Date().toISOString().replace(/[:.]/g,'-')` (e.g. `2026-10-03T19-28-00-123Z`). `tag` is sanitized to `[a-z0-9-_]` (default `snapshot`) | Never pruned. `list_snapshots` scans `*_metadata.json`, newest first (`:210-275`). `restore_snapshot` matches by id or tag, writes `<id>_before-restore.xml` (unless `backup_current:false`), then **overwrites the build file** (`:281-318`) |
| save_tree backups | same dir, `<ts>_backup.xml` (`:385-397`) | byte copy | never pruned |
| export_build | `<POB_DIRECTORY>/.pob-mcp/exports/<output_name>.xml`, or **`output_directory` used unsanitized** (`:42,59-60,77-81`) | re-serialized via `XMLBuilder` with a `<PathOfBuilding>` root (`:324`), not a byte copy. With `notes`, `exportBuild` **mutates the cached `PoBBuild` object** (`:63-67`; the cache is shared with `BuildService`) [V code, I effect] | `safeWrite` refuses to overwrite unless `overwrite` is set |
| save_tree | overwrites `<POB_DIRECTORY>/<build>` in place (`:135-137`) | XMLBuilder `<PathOfBuilding>` | backup on by default |
| set_build_notes | overwrites the build file via regex replace (`buildHandlers.ts:424-442`) | text | invalidates the build cache |
| lua_save_build | engine writes `sanitizeBuildName(<name>.xml, POB_DIRECTORY)` (`luaHandlers.ts:68-92`); **overwrites silently** | PoB `SaveDB` | — |
| import_build `save_as` | `fs.writeFile` of the decoded XML; overwrites silently; `mkdir -p` (`luaHandlers.ts:742-748`) | raw XML | — |
| **Config presets** | `<POB_DIRECTORY>/.pob-mcp-presets/<name>.json` (`configHandlers.ts:18-24`). `mkdir -p` runs on **save and load** | `JSON.stringify(luaClient.getConfig(), null, 2)` | `list_config_presets` lists `*.json` |
| Build parse cache | `BuildService.buildCache: Map<buildName, {data, timestamp}>` (`buildService.ts:7-8,13,57-81`) | parsed `PoBBuild` (root `PathOfBuilding ?? PathOfBuilding2`) | TTL 60 s, max 20 entries (evicts the oldest), `invalidateBuild(name)` / `clearCache()` (`:230-235`) |
| Tree data cache | `TreeService.treeDataCache: Map<version, {data, timestamp}>` (`treeService.ts:16,32-43`) | `PassiveTreeData` from `<POB_FORK_PATH>/TreeData/<ver>/tree.json` (sync `readFileSync`). Missing versions fall back to the newest `^\d+_\d+$` dir, or to `"0_5"` | Never expires. `refresh_tree_data` clears it |
| Trade cache | `TradeApiClient.cache: Map<string, CacheEntry>` (`tradeClient.ts:31`) | keys `search:<league>:<JSON query>`, `fetch:<ids>` (no league or realm), `stats:all`, `leagues:all` | `expiresAt` is set at put. `getFromCache(key, customTTL)` **ignores `customTTL`** (`:274-287`). `getStats` (1 h) and `getStatData` (1 week) **share the key `stats:all`**. Unbounded |
| poe.ninja cache | `PoeNinjaClient.cache: Map<'currency:<league>', {data,timestamp}>` (`poeNinjaClient.ts:111-112,142,335-351`) | transformed `CurrencyOverview` | TTL 5 min, unbounded |
| Watcher state | `WatchService` (`watchService.ts:12-119`): `chokidar.watch(pobDirectory, {ignored: /(^\|[\/\\])\../, persistent:true, ignoreInitial:true, awaitWriteFinish:{stabilityThreshold:500, pollInterval:100}})` (`:33-41`). **No `usePolling`, no `depth`** (recursive by default [I]). It handles `.xml` add/change/unlink only. Debounce is 500 ms per **basename** (`:62-81`). It calls `buildService.invalidateBuild(basename)`, so builds in subfolders are missed because cache keys are relative paths [V]. `recentChanges` keeps the last 50 | in memory | `start_watching` / `stop_watching`. The SIGINT/SIGTERM `shutdown` closes the watcher. chokidar **4.0.3** |
| Engine state | in the luajit process (loaded build, specs, config) | — | **Lost on any restart** (silent, §6) |
| StatMapper | in memory: static `STAT_MAPPINGS`, replaced or augmented by the live `/data/stats` at startup | — | process lifetime |
| Temp files | **none created by TS** (no `tmpdir`/`mkdtemp` in `src/`) [V]. `listBuilds` skips names starting with `.` or `~~temp~~` (`buildService.ts:33`), which is the PoB dev-mode autosave (recon E4) | — | — |

---

## 8. Trade and poe.ninja clients

**`TradeApiClient` (`src/services/tradeClient.ts`)** [V]:
- **Public API:** `searchItems(league, query)` (`POST {base}/search/{realm}/{encodeURIComponent(league)}`); `fetchItems(ids, queryId?)`
  (`GET {base}/fetch/{ids.join(',')}?query={id}&realm={realm}`, which **throws if more than 10 ids**, `:93-95`); `getStats()` / `getStatData()`
  (`GET {base}/data/stats`); `getLeagues()` (`GET {base}/data/leagues`); `getRateLimitInfo()`; `clearCache()`;
  `clearCachePattern(s)`.
- **Headers** on every request (`:215-224`): `Content-Type: application/json` (also on GETs);
  `User-Agent: POE_TRADE_USER_AGENT || 'pob2-mcp-server/0.1 (+https://github.com/PathOfBuildingCommunity)'`;
  `Cookie: POESESSID=${POE_SESSION_ID}` when that env var is set, on **all** endpoints including `/data/*`. Uses global `fetch`, with **no timeout or
  AbortSignal**.
- **Limiter: `bottleneck` 2.19.5**, one instance per client. Only one client exists (`index.ts:117`).
  - Config: `reservoir = 2×rps` (8), `reservoirRefreshAmount = rps` (4) every `1000` ms, `maxConcurrent: 1`, `minTime = floor(1000/rps)` (250 ms)
    (`:43-49`).
  - `'failed'` handler: retries (returning `retryAfter` ms) while `rateLimitInfo.retryAfter` is set and `retryCount < 3` (`:52-58`).
- **429:** reads `Retry-After` (default 5 s), sets `rateLimitInfo`, and throws `Rate limited. Retry after <ms>ms` (`:237-245`).
- **Other non-OK responses:** throws `Trade API request failed (<status>): <full body>` (`:247-250`).
- **Header parse:** only `X-Rate-Limit-Ip` / `X-Rate-Limit-Ip-State`, using `split(':')[1]` as the "max", which is really the window (recon §5). It ignores
  multi-rule (comma) values and the `X-Rate-Limit-Policy`/`-Rules`/`-Account` headers. Nothing feeds back into Bottleneck (`:255-272`).
- **Callers:** `tradeHandlers.ts`, `itemRecommendationEngine.ts`, `shoppingListService.ts`, `clusterJewelHandlers.ts`, and
  `index.ts:382` (startup stat load). Result URLs in `tradeHandlers.ts:21-28` use **PoE1** `https://www.pathofexile.com/trade/search/<league>/<id>`.
- League defaults: `'Standard'` in `get_item_price` (`tradeHandlers.ts:156`) and `suggest_crafting` (`craftingAdvisorHandler.ts:99`).
  `search_trade_items` requires `league` (`toolRouter.ts:535-537`). `POE_LEAGUE` is not read.

**`PoeNinjaClient` (`src/services/poeNinjaClient.ts`)** [V]:
- `baseUrl = 'https://poe.ninja/poe2/api/economy/exchange/current'` (`:110`). The single request is
  `GET {base}/overview?league=<enc>&type=Currency` (`:148`) with headers `User-Agent: pob2-mcp-server/0.1`, `Accept: application/json`
  (`:150-153`). No limiter, no timeout. Non-OK responses throw `poe.ninja PoE2 API request failed (<status>): <body>`.
- Public API: `getCurrencyRates(league)`, `getFragmentRates(league)` (an alias), `getCurrencyExchangeMap(league)` (sets
  `'Exalted Orb' = 1.0` and stores `primaryValue` per name, `:177-187`), `findArbitrageOpportunities(league, min%)`, `clearCache()`.
- It transforms the response to the legacy `{lines:[{currencyTypeName, chaosEquivalent: primaryValue, detailsId}], currencyDetails}` shape
  (`:115-136`). The doc comment `:102-104` claims Exalted is the base unit; D-11 says Divine.
- `index.ts:309-310`'s comment names `/poe2/api/economy/currencyexchange`, which is stale.

**Other outbound HTTP** [V]:
- `utils/buildCode.ts:62-64`: pobb.in `/<id>/raw` and pastebin `/raw/<id>`, with UA `Mozilla/5.0 (compatible; pob2-mcp-server)`, no timeout,
  4 MB code cap and 16 MB XML cap (the XML is checked after inflate).
- `services/craftingDataService.ts:29-38`: `https://poedb.tw/us/<slug>`, with UA `pob-mcp-server/1.0 (crafting advisor)` and
  `AbortSignal.timeout(10000)`.
- **That is 4 distinct UA strings** (trade, ninja, buildCode, poedb).

---

## 9. Tests

**`jest.config.cjs`** [V]:
- `preset: 'ts-jest'`, `testEnvironment: 'node'`, `watchman: false`, `roots: ['<rootDir>/tests']`.
- transform `'^.+\\.tsx?$': ['ts-jest', {tsconfig: 'tsconfig.test.json'}]`; `testMatch: ['**/tests/**/*.test.ts']`.
- `moduleNameMapper: {'^(\\.{1,2}/.*)\\.js$': '$1'}`, which strips `.js` from relative imports.
- `collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts']`; `coverageThreshold.global = {branches: 75, functions: 85, lines: 80,
  statements: 80}`; `coverageDirectory: 'coverage'`; `verbose: true`.
- **No `setupFiles`, `setupFilesAfterEnv` or `globalSetup`.** Thresholds are only enforced when coverage runs (`test:coverage`, `test:ci`).

**`tsconfig.test.json`** [V]: extends `tsconfig.json`; `module: "CommonJS"`, `moduleResolution: "node"`, `esModuleInterop`,
`allowSyntheticDefaultImports`, `isolatedModules: false`; `include: ["src/**/*", "tests/**/*"]`. So `src` is compiled as
**CommonJS under Jest**, which means `import.meta` would fail with TS1343 [I, consistent with vision D-2].
- The SDK resolves under this setup: `typesVersions {"*":{"*":["./dist/esm/*"]}}` supplies types, and
  `exports["./*"].require = ./dist/cjs/*` supplies the runtime.
- `require('@modelcontextprotocol/sdk/inMemory.js').InMemoryTransport.createLinkedPair`, `.../client/index.js` `Client` and `.../server/index.js` `Server`
  all load under CommonJS `node` [V, ran it].

**Layout and counts** [V]. Unit numbers come from `jest tests/unit --json`; the other files are a static `it(`/`test(` count. The total, 274, matches recon.

| File | Tests |
|---|---|
| `tests/unit/buildService.test.ts` | 74 |
| `tests/unit/pobLuaBridge.test.ts` | 37 |
| `tests/unit/pobLuaBridge.simple.test.ts` | 19 |
| `tests/unit/buildHandlers.test.ts` | 15 |
| `tests/unit/validationService.test.ts` | 9 |
| `tests/unit/craftingDataService.test.ts` | 8 |
| `tests/unit/pathSanitizer.test.ts` | 8 |
| `tests/unit/craftingAdvisorHandler.test.ts` | 7 |
| `tests/unit/buildCode.test.ts` | 6 |
| `tests/unit/levelingHandlers.test.ts` | 6 |
| `tests/unit/pathTraversal.test.ts` | 5 |
| `tests/unit/poeNinjaClient.test.ts` | 4 |
| `tests/treeService.test.ts` | 31 (static) |
| `tests/watchService.test.ts` | 20 (static) |
| `tests/contextBuilder.test.ts` | 10 (static) |
| `tests/errorHandling.test.ts` | 8 (static) |
| `tests/integration/poe2Bridge.test.ts` | 7 (static) |
| **Total** | **274** (unit run: 12 suites, 198 passed, 5.1 s) |

- Support files: `tests/mocks/pobProcess.mock.ts` (223 lines: `MockPoBProcess` EventEmitter emits `{"ready":true}` on nextTick
  and answers each stdin JSON from `MOCK_RESPONSES` keyed by action; `createMockSpawn()` is a `jest.fn`), and
  `tests/mocks/responses.mock.ts` (206 lines: hand-written replies).
- Fixtures: `tests/fixtures/trade2/` (README plus 27 JSON files, all tracked, from spike S-3). **There is no `tests/fixtures/builds/` and no poe.ninja
  fixture yet** (vision F0 has not been done) [V].
- **Mocking patterns:**
  - Bridge: `jest.mock('child_process', () => ({spawn: mockSpawn}))` before import (`pobLuaBridge.test.ts:6-12`).
  - fetch: `jest.spyOn(global, 'fetch' as any)` (craftingDataService and craftingAdvisorHandler tests) or
    `(global as any).fetch = jest.fn(...)` (`poeNinjaClient.test.ts:28-32`).
  - `jest.mock('../src/services/buildService')` in the watchService and contextBuilder tests.
  - Imports come from `@jest/globals`, with mixed `.js`/extensionless relative paths.
  - One test uses `fs.mkdtemp(os.tmpdir()/pob-test-)` (`buildService.test.ts:13`).
- **The integration test starts the engine and decides to skip** like this (`tests/integration/poe2Bridge.test.ts`):
  - `forkSrc = POB_FORK_PATH || <repo>/../PathOfBuilding-PoE2/src` (`:16-17`). On this box that is the **dev-head sibling `bb52d6b`**, not the pin.
  - If `HeadlessWrapper.lua` is absent, the suite is `describe.skip` with a `console.warn` (`:18-24`).
  - `beforeAll` constructs `new PoBLuaApiClient({cwd: forkSrc, cmd: POB_CMD||"luajit", timeoutMs: 90000})`, then calls `start()` and
    `newBuild()`. **Startup failure is caught and logged, and every test does `if (!ready) return;`** (`:30-49…`), so the tests pass without asserting anything (E10).
  - It imports `Poe2SkillService` and `handlePlanLeveling` directly.
  - No test imports `index.ts`, `toolRouter.ts`, `luaClientManager.ts`, `luaHandlers.ts`, `itemSkillHandlers.ts`,
    `configHandlers.ts`, `treeHandlers.ts`, `exportHandlers.ts`, `tradeClient.ts` or the SDK [V grep of imports].
- `luajit` is **not on the plain PATH**. Under `mise exec` it resolves to
  `~/.local/share/mise/installs/asdf-mise-plugins-mise-lua-jit/ref-2460b3ff…/bin/luajit` [V].

---

## 10. Build

**`tsconfig.json`** [V]: `target ES2022`, `module Node16`, `moduleResolution Node16`, `outDir ./build`, `rootDir ./src`,
`strict: true`, `esModuleInterop`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `resolveJsonModule`,
`isolatedModules: true`; `include ["src/**/*"]`; `exclude ["node_modules"]`. There are no extra strict flags (no `noUncheckedIndexedAccess`
or similar).

**`package.json`** [V]: `name pob2-mcp-server`, `version 0.2.2`, `main build/index.js`, `"type": "module"`,
`packageManager pnpm@11.6.0`. There is no `bin` or `engines` field.
- Scripts: `build: tsc`, `start: node build/index.js`, `dev: tsc --watch`, `test: jest`, `test:watch`, `test:coverage: jest --coverage`,
  `test:unit: jest tests/unit`, `test:integration: jest tests/integration`, `test:ci: jest --ci --coverage --maxWorkers=2`.
- Lockfile: `pnpm-lock.yaml` `lockfileVersion '9.0'`, the only tracked lockfile. There is no `.npmrc` or `pnpm-workspace.yaml`.

**Resolved versions** (`node_modules/<pkg>/package.json`) [V]:

| Package | Declared | Resolved |
|---|---|---|
| `@modelcontextprotocol/sdk` | ^1.0.0 | **1.20.2** (low-level `Server` not deprecated; `McpServer.registerTool` and `InMemoryTransport` present) |
| `bottleneck` | ^2.19.5 | 2.19.5 |
| `chokidar` | ^4.0.3 | 4.0.3 (dual ESM/CJS exports) |
| `fast-xml-parser` | ^4.3.2 | 4.5.3 |
| `typescript` | ^5.0.0 | 5.9.3 |
| `jest` | ^29.7.0 | 29.7.0 |
| `ts-jest` | ^29.1.0 | 29.4.5 |
| `@jest/globals` | 29.7.0 | 29.7.0 |
| `@types/node` | ^20.0.0 | 20.19.23 (declares `util.parseEnv`, `util.d.ts:1189`) |
| `@types/jest` | ^29.5.0 | 29.5.14 |
| `@types/chokidar` | ^1.7.5 | 1.7.5 (stale v1 typings; chokidar 4 ships its own) |
| `@types/node-fetch` | ^2.6.13 | 2.6.13 (unused) |
| **`zod`** | not declared | **does not resolve from the repo root**: `mise exec -- node -e "require.resolve('zod')"` gives `MODULE_NOT_FOUND`. Present only as `.pnpm/zod@3.25.76` (the SDK depends on `zod ^3.23.8`, `zod-to-json-schema 3.24.6`) |

Runtime: `mise exec -- node --version` gives v24.16.0, `pnpm` 11.6.0, and `util.parseEnv` is a function [V]. `mise.toml` has `[tools]` (luaJIT
ref `2460b3ff…` with the postinstall `luarocks install luautf8 0.1.6-1`, `node = "24"`) and `[env] LUAROCKS_VERSION = "3.12.2"`. **It defines no
`[tasks]`** (`mise run test`, `mise run pob:fetch` and `mise run setup` do not exist yet) [V]. `mise exec -C/--cd <DIR>` exists [V].

---

## 11. Conventions a new unit must follow to look native

1. ESM TypeScript (Node16): relative imports end in **`.js`**; use `import type` for types; default-import Node built-ins;
   **no `import.meta`, `__dirname` or top-level await** (Jest compiles `src` as CommonJS).
2. A tool means three edits: a JSON-Schema literal in the right `get*ToolSchemas()` group in `toolSchemas.ts`; a `case "<snake_name>":` in
   the `toolRouter.ts` switch that unpacks `args` with casts and calls a handler; and `export async function handle<Pascal>(context, …)`
   in `src/handlers/<area>Handlers.ts`.
3. Handler body: `return wrapHandler('<verb phrase>', async () => { … return { content: [{ type: "text" as const, text }] }; })`.
   Fail by **throwing**. Do not return error text.
4. Engine access: `await context.ensureLuaClient(); const luaClient = context.getLuaClient(); if (!luaClient) throw new Error(…)`,
   then call typed `PoBLuaApiClient` methods. A new Lua action needs a matching method in `pobLuaBridge.ts`: `send({action, params})`,
   throw `res.error || "<action> failed"`, return the payload key.
5. Dependencies arrive through a context object (`ContextBuilder` method or an inline literal). Services are classes constructed once in
   `index.ts` and threaded through `ToolRouterDependencies`.
6. File paths under the builds dir always go through `sanitizeBuildName(name, baseDir)`. Server-owned data lives under
   `<POB_DIRECTORY>/.pob-mcp/…`, which the watcher and `listBuilds` ignore as dotfiles.
7. Log only to **stderr** with `console.error('[Component] …')`. Never write to stdout.
8. Output is plain text with `===` headers. Emoji status markers (`✅`/`❌`) are idiomatic.
9. Tests go in `tests/unit/*.test.ts` and import from `@jest/globals`. Mock child processes with `jest.mock('child_process')` and `createMockSpawn`, and
   mock fetch with `jest.spyOn(global,'fetch')` or by assigning `global.fetch`.
10. Env flags are read as `process.env.X === 'true'` (strings). Numbers use `parseInt(process.env.X || '<default>', 10)`.

---

## Contradictions with vision.md

**No hard contradictions found.** Every "today" claim in the vision that I checked holds:
- D-2 `treeService.ts:57`; D-7 `tradeClient.ts:218`; D-8(b) per-line timeouts; D-10 zod not resolving.
- D-13 `@jest/globals` declared and pnpm 11.6.0; D-14 network before the handshake; D-16 default dir and no polling.
- D-17 the integration suite uses the dev-head sibling and skips silently.
- §4 100 routed = 98 + 2, which matches the table exactly; D-4's 25 names.

Refinements and gaps the spec should absorb:

- **D-2 (shared `POB_FORK_PATH` resolver):** the env var is read in **3 src sites with 3 different behaviours**, not 1:
  `luaClientManager.ts:46` falls back to `pobLuaBridge.ts:77` `~/Projects/PathOfBuilding-PoE2/src` (capital P, absent here);
  `pobLuaBridge.ts:92` is dead; `treeService.ts:57` falls back to cwd-relative `TreeData`. A 4th default is in
  `tests/integration/poe2Bridge.test.ts:16-17`. The bridge also has its own `argv[1]`-anchored `resolvePobApiDir()`
  (`pobLuaBridge.ts:22-38`), which the `packageRoot()` helper should replace or share.
- **D-14 (lazy engine start on the first engine call):** six engine-using paths never call `ensureLuaClient`:
  `plan_leveling`, `validate_build`, `find_item_upgrades`, `suggest_crafting`, `analyze_items`/`optimize_skill_links`/`create_budget_build`, and
  `export_build_summary`. `export_build_summary` gets a client captured **before** routing, in `contextBuilder.ts:213`. If the lazy start lives only in
  handlers, these fail or degrade on a cold engine. The ensure plus mutex step belongs in the router, or the context must be made lazy.
- **D-7 / D-15 (the cookie goes only to trade2 search and fetch):** the bridge forwards the **entire `process.env`** to luajit
  (`pobLuaBridge.ts:115-117`). A process-level `POESESSID`/`POE_SESSION_ID` (D-15 gives process `POESESSID` precedence)
  would therefore be inherited by the engine child. The spec should require stripping it from the child env. Today the cookie also goes to
  `/data/*` (`tradeClient.ts:222`).
- **D-16 / D-6 (name the loaded build and warn on a newer file):** TS keeps **no record** of which file the engine holds. The only
  signal is the free-form `name` passed to `load_build_xml`, which is `"API Build"` in `analyze_build`, `"Imported Build"` in
  `import_build` and `"Init Test"` in the probe. The spec needs a new TS-side record (path, mtime, engine revision) set by every load path.
- **D-8(d) recovery snapshots vs the kept `snapshot_build` (Q6):** the existing `snapshot_build` copies the **on-disk file** into
  `.pob-mcp/snapshots/<build>/` (`buildExportService.ts:168-171`). It does not capture engine state. D-8(d)'s engine `export_build_xml` snapshot is
  a different artifact, so the spec should name and locate it distinctly to avoid colliding with `list_snapshots`/`restore_snapshot`.
- **D-8(e) / E6 / I-4 (every failure sets `isError`):** 4 handler paths return `"Error: …"` text as **success**
  (`treeHandlers.ts:186-194, 338-346`, `buildHandlers.ts:188-197`, `poeNinjaHandlers.ts:188-197`). Also, both `ToolResponse` types
  (`responseUtils.ts:6`, `toolRouter.ts:49`) lack `isError`. Fixing only `index.ts:362` is not enough.
- **D-17 (POESESSID cleared in Jest setup):** there is no Jest setup file today. A1 must add `setupFiles` to `jest.config.cjs`. The coverage
  figures "66/52/69/69" were **not re-measured** by me (recon §7 says 63% vs 80%). The thresholds in `jest.config.cjs` are branches 75 / functions 85 /
  lines 80 / statements 80.
- **D-10 (zod as a direct dependency):** the transitive version is `zod@3.25.76`, used by SDK 1.20.2 (which declares `zod ^3.23.8`). Declaring
  `zod@^3.25` keeps one copy. If the spec ever uses `McpServer.registerTool`, its `ZodRawShape` must come from the same zod instance [I].
- **D-16 (side-effect-free server module):** besides the top-level `new PoBMCPServer()`, the constructor installs process-global
  listeners (`process.stdout/stderr 'error'` → `process.exit(0)`, `SIGINT`/`SIGTERM`), at `index.ts:161-184`. These must move to the entry
  file, or in-process tests will register them once per server instance.
- Version strings: the MCP server reports `version: "0.1.0"` (`index.ts:72`) while `package.json` says `0.2.2`.

## Open unknowns

- Exact coverage percentages on the current tree (not run, to avoid writing `coverage/`).
- Whether a hung `/data/stats` fetch at startup actually blocks the host's handshake timeout (no fetch timeout; not exercised).
- Per-action Lua reply payload shapes beyond the top-level key TS reads (out of scope for the TS ingestion; see the Lua context).
