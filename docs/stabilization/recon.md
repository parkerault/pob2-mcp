# pob2-mcp stabilization — recon (ground truth as of 2026-10-03)

Read-only audit of the built system, consolidated from four passes: a live end-to-end run of the
compiled MCP server over stdio against a real level-90 PoE2 build (`Grenadator.xml`, Mercenary /
Gemling Legionnaire), plus three parallel subsystem audits (engine/core, analysis heuristics,
trade). Every claim cites `file:line` at commit `6442b0b` + the Linux setup fix below.
**[V]** = verified (code read, live run, or grep of the PoB2 checkout); **[I]** = inference.

PoE2 game-model facts are verified against the PathOfBuilding-PoE2 checkout (`../PathOfBuilding-PoE2/src`,
dev head, manifest `0.23.1`) and the live trade2 static data — not from memory.

---

## 0. Environment (already fixed, uncommitted at time of writing)

- **LuaJIT:** PoB2 sources use compound assignment (`+=`, e.g. `Modules/Main.lua:340`), unsupported by
  any packaged/conda LuaJIT. `mise.toml` pins upstream LuaJIT commit `2460b3ff` (same as PoB's CI
  image, "Backport some v3.0 syntax extensions") + `luautf8 0.1.6-1` via postinstall; luarocks pinned
  to 3.12.2 because the 3.13.0 release tarball ships a malformed rockspec. [V]
- **Linux bridge bug fixed:** `src/pobLuaBridge.ts` joined `LUA_PATH`/`LUA_CPATH` with `:` on non-Windows;
  Lua uses `;` on every OS → `module 'xml' not found`. Fixed + unit test
  (`tests/unit/pobLuaBridge.test.ts`, "should separate LUA_PATH/LUA_CPATH entries with ';'"). [V]
- Full suite 274/274 green with the real engine reachable. [V]
- PoB2 release tags are `v0.x` (latest `v0.23.1`); the `v2.x` tags in that repo are PoE1 PoB history. [V]

## 1. What is sound (keep)

- Engine boot via vendored `pob-api/bootstrap.lua` against a vanilla PoB2 checkout; ~1.6 s cold start. [V]
- Works live: `lua_load_build`, `lua_get_stats`, `lua_get_tree`, `search_tree_nodes`, `list_gems`,
  `get_classes`, `set_character_level`, `get_skill_setup`, `create_socket_group`, `set_main_skill`,
  `set_gem_level`, `set_gem_quality`, `remove_gem`, `toggle_gem`, `toggle_socket_group`,
  `get_equipped_items`, `select_item_set`, `select_spec`, `snapshot_build`, `list_snapshots`,
  `restore_snapshot`, `get_build_notes`, `set_build_notes`, `list_builds`, `get_build_stats`,
  `compare_trees`, watch tools, `import_build` (round-trip identical DPS), `lua_stop`. [V]
- `lua_save_build` persists gem changes — README.md:470 claiming otherwise is **false**. [V]
- Tree data comes from local `POB_FORK_PATH/TreeData/<ver>/tree.json` (`treeService.ts:56-102`);
  `find_path_to_node` matches the engine's own pathing. [V]
- `get_leagues`, `search_stats` (loads ~8.3k trade2 stats unauthenticated, `index.ts:378-389`). [V]
- **Trade search and fetch work without a POESESSID today** (live: 10,000-hit search, 10-listing price
  check, no cookie). HANDOFF.md:140-144 says otherwise. [V]
- Session cookie only placed in the request header, never logged (`tradeClient.ts:222-224`). [V]
- poe.ninja currency endpoint reachable (`/poe2/api/economy/exchange/current/overview`). [V]

## 2. Engine bridge & protocol (critical)

| # | Defect | Evidence |
|---|---|---|
| E1 | `calc_with` returns PoB's raw calc output (reference cycles); dkjson throws in `write_line`, **outside** the `pcall` → luajit dies. Manager restarts silently; loaded build lost (next `lua_get_build_info` → "Init Test, Level 1 Ranger"). Breaks `get_passive_upgrades` ("top 0") and `suggest_masteries`. | `BuildOps.lua:206-226`, `Server.lua:35,83` [V] |
| E2 | `lua_set_tree` / `update_tree_delta` pass `{}` for `weaponSets` and `hashOverrides` → wipes attribute-node choices + weapon-set assignment. No-op delta on Grenadator: Str/Dex/Int 119/91/64 → 89/46/49, Life 2977 → 2895, DPS −5%; exported `<AttributeOverride>` empty. | `BuildOps.lua:113,198`; `PassiveSpec.lua:386,400-433` [V] |
| E3 | `add_item`, `add_multiple_items`, `create_spec` use `new('Item', text)` / `new('PassiveSpec', build, ver)`; **dev-head** PoB2 `new()` errors on any extra arg (expects `new("Item"):Item(raw)`). **Correction (S-2): on the pinned `v0.23.1` the old syntax is correct and the dev-style call fails** — this is a dev-only break; fix with a version-portable `construct()` helper. | `BuildOps.lua:371,1065,1072`; dev `Common.lua:186-195` [V] |
| E4 | Failed load wedges the engine: `load_build_xml` never checks success; one bad load leaves `~~temp~~`/level 1 and every later load becomes a 2 ms no-op until restart. **Refined (S-2): the wedge trigger is loading an empty string; a PoE1 root or malformed XML alone does not wedge** (same on tag and dev). Headless runs in dev mode (no manifest branch) → autosaves `~~temp~~.xml` on build switch. Startup readiness load uses a PoE1 `<PathOfBuilding>` root (rejected, `Build.lua:2700`) → leaves a permanent error prompt. | `Handlers.lua:86-96`; `Build.lua:1113-1121`; `luaClientManager.ts:58` [V] |
| E5 | No request IDs: after one timeout every later call reads the previous reply (live: `getBuildInfo` got the load reply). Parallel tool calls → "Concurrent request not supported" (3 of 4 fail). `ensureClient` unlocked → 3 parallel cold calls spawned 3 luajit processes. | `pobLuaBridge.ts:266-304,270`; `luaClientManager.ts` [V] |
| E6 | Tool errors returned without `isError: true` → host can't distinguish failure. | `index.ts:362-369` [V] |
| E7 | Default stat export too narrow; handlers call `getStats()` with no field list, so engine's `TotalEHP`, `PhysicalDamageReduction`, `ManaUnreserved`, `EvadeChance`, `DeflectChance`, `EffectiveBlockChance`, `EnergyShieldRecharge`, `*MaximumHitTaken` arrive `undefined` → treated as 0. Engine has them (TotalEHP 11,798, PDR 51, ManaUnreserved 638). | `BuildOps.lua:38-45`; callers `optimizationHandlers.ts:55`, `validationHandlers.ts:63`, `advancedOptimizationHandlers.ts:71`; names in `CalcDefence.lua:344,2602`, `BuildDisplayStats.lua:141` [V] |
| E8 | `get_items` exports PoB's always-created hidden slots ("<slot> Jewel Socket 1-6" ×12 gear slots + "Jewel <nodeId>" per tree socket) without the `inactive` flag → "89 empty jewel sockets". | `ItemsTab.lua:217-227,332-343,1743-1749`; `ItemSlotControl.lua:142-143`; `BuildOps.get_items :414-450`; `buildGoalsHandlers.ts:120-121` [V] |
| E9 | Robustness: server doesn't exit on stdin EOF (keeps luajit alive); startup errors hide stderr cause ("exited code=1"); friendly ENOENT message dead (`pobLuaBridge.ts:175`); Jest-only hack in prod code (`:141`). | [V] |
| E10 | Integration suite swallows startup failure and every test `if (!ready) return` → all "pass" with no assertions when luajit is absent. This is how the Linux bug shipped green. | `tests/integration/poe2Bridge.test.ts:30-40` [V] |

## 3. Core tools — TS↔Lua shape mismatches & bugs

- `lua_new_build` ignores class/ascendancy (reports "Monk/Invoker", builds Ranger). `Handlers.lua:78-84` [V]
- `delete_spec` / `rename_spec` report "Failed" on success (expect `result.specs`). `luaHandlers.ts:789,841,856` [V]
- `list_specs` "Nodes: undefined" (`nodeCount` vs `pointsUsed`); `list_item_sets` "Item Set undefined"
  (`activeItemSetId` vs `activeItemSet`); `lua_save_build` "(? bytes)" (`size` vs `bytes`, `luaHandlers.ts:90`). [V]
- `lua_get_build_info` / stats `_meta` report `build.targetVersion` ("0_1") as tree version; real is spec's `0_5`. `BuildOps.lua:172` [V]
- `get_config` prints Bandit/Pantheon (PoE1) and `input: [object Object]`; `set_config` "Old Value: undefined". `configHandlers.ts:276-355` [V]
- `set_enemy_stats` level is a no-op (writes `configTab.enemyLevel`; `BuildModList` recomputes from `input.enemyLevel`); printed "old" values hard-coded. `BuildOps.lua:257`; `ConfigTab.lua:1160`; `configHandlers.ts:195-219` [V]
- `load_config_preset` applies nothing (preset `{enemyLevel, input:{…}}`; `set_config` skips tables). [V]
- `add_gem` silently accepts unknown names (schema's own example "Brutality" is really "Brutality I/II/III"). [V]
- `export_build` / `save_tree` write a `<PathOfBuilding>` root — PoB2 can't load it (engine "loads" a Level 1 Ranger). `save_tree` overwrites in place (backup on by default). `buildExportService.ts:324` [V]
- `analyze_build` can print live stats from a different (engine-loaded) build; `compare_builds` replaces the loaded build. [V]
- PoE1 leftovers: PoE1 class/ascendancy maps (`luaHandlers.ts:332-341` → "Class: Unknown (ID 9)"); mastery lines in `lua_get_tree`; `toggle_flask` 1–5 (`itemSkillHandlers.ts:198`; PoE2: Flask 1–2 + Charm 1–3, `ItemsTab.lua:32`); default builds dir "Path of Building" (`index.ts:90-92`; PoE2 uses "Path of Building (PoE2)", `Main.lua:91`); `getTreeData("3_26")` (`index.ts:197`). [V]
- Watcher invalidates cache by basename (misses subfolders) and never reloads the engine despite tool text. `buildCode` checks size only after inflate (no zip-bomb guard), accepts PoE1 roots. [V]
- XML-stored vs engine DPS differ ~3.5% (85,452 vs 88,549) **on dev head only**: on the pinned
  `v0.23.1` the engine reproduces the stored stats exactly (103/104 numeric stats; TotalDPS
  85,452.12, CombinedDPS 104,489.78). Confirmed PoB version drift. [V — S-2, re-checked by coordinator]

## 4. Analysis / advice heuristics

| Tool | Status | Key evidence |
|---|---|---|
| `get_build_issues` + load "Top Issues" | broken + PoE1 | E8 jewel bug; flask check assumes 5 (`buildGoalsHandlers.ts:150`); PoE1 "24 quest points by Act 10" (`:104`); reads `tree.ascendancyPointsUsed` never returned; PoE1 gem names (`:169-194`). PoB has native warnings: `build.controls.warnings` (`Build.lua:1027-1081`), BuildDisplayStats `warnFunc`. [V] |
| `validate_build` (Lua path) | PoE1 | "aim 4000+" critical (`validationHandlers.ts:173`); "Guardian" (`:187`). [V] |
| `validate_build` (XML path) | broken | 0 unreserved mana (E7, `validationService.ts:235,244`); arbitrary life targets (`:172-175`); **false "No Freeze Immunity" with Bright Thawing Charm equipped** — `validationHandlers.ts:69-78` scans only `Flask*` and overrides the charm-aware XML result (`buildService.ts:97-101`); PoE1 advice (resistance flask, Amethyst Flask, "of Curing", suppression, Precision); `validateDamageScaling` dead (`:491-574`); `ESRecharge` should be `EnergyShieldRecharge` (`:436`). [V] |
| `analyze_defenses` | broken | EHP shown as Life (E7; fallback `defensiveAnalyzer.ts:198-207`); hard-coded armour/evasion bands (`:291-305`) instead of engine PDR/EvadeChance; "Constitution, Heart of Oak" (`:467`, absent from PoB2), "Diamond Skin" (`:426`), Amethyst flask (`:441`); requires `build_name` though it uses the loaded build. [V] |
| `check_boss_readiness` | PoE1 | All bosses PoE1 (`bossReadinessHandlers.ts:18-67`); PoB2's own `BossSkills.lua` is PoE1 leftover → no PoE2 boss data exists. Engine has `enemyIsBoss` = None/Boss/Pinnacle/Uber (`ConfigOptions:1982`). [V] |
| `analyze_items` | PoE1 | Flask 3-5 empty (`itemAnalyzer.ts:290-294`); PoE1 ascendancy archetypes (`:66-74`); Stygian Vise. [V] |
| `optimize_skill_links` | PoE1 | 6-link model; "level supports to 20" (PoE2 supports max level 1); Determination/Grace (absent). [V] |
| `create_budget_build` | PoE1 | Static PoE1 text (Tabula 6-link, Multistrike, suppression). [V] |
| `suggest_optimal_nodes` / `optimize_tree` | broken | Keyword search with no simulation (goal=life returned "Lose 3% of max Life"); archetype detection reads `socketGroups` vs bridge `groups` (`optimizationHandlers.ts:131`); ignores declared params. [V] |
| `suggest_watchers_eye` | PoE1 | No Watcher's Eye in PoB2 `Data/Uniques`; aura list absent from PoE2 gems. [V] |
| cluster-jewel tools (incl. unlisted-but-routed `analyze_cluster_jewels`) | PoE1 | PoE2 jewel bases: Ruby/Emerald/Sapphire/Diamond/Time-Lost/Timeless only. [V] |
| `suggest_masteries` | PoE1 | 0_4/0_5 trees: 0 mastery effects. [V] |
| `suggest_crafting` | broken + PoE1 | Base auto-detect reads `item.base` vs `baseName` (`craftingAdvisorHandler.ts:121`); currency mislabelled ("1 Divine = 1 Chaos"); bench/meta-craft/fossil methods; poedb URL 404s. [V] |
| `plan_leveling` | mostly correct | `class_name` override ignored (prints loaded build's ascendancy). [V] |
| `analyze_skills` / `suggest_supports` / `list_gems` | mostly correct | Tag gating any-match, ties alphabetical → measured pool dominated by Alignment/Armour Explosion; some groups measure +0 for all (root cause not determined [I]). PoB has `calcLib.canGrantedEffectSupportActiveSkill` (`CalcTools.lua:108`). [V] |
| Legacy gem tools (6) | PoE1 | `skillGemService.ts` 936 + `skillGemHandlers.ts` 600 lines; hidden from list but **still routed** without flag check (`toolRouter.ts:501-525`). [V] |
| `ToolGate` | no-op | [V] |

Tool-description PoE1 cruft (what the LLM reads): `toolSchemas.ts` :237, :395, :399, :426 (PoE1 class
tables), :848 (masteries), :900 (spell suppression), :1024/:1030 (bandit/pantheon/conditionFortify/'Shaper'),
:1041, :1122, :1653, :1679, :1687, :1695, :1442-1450 (Corsair Sword, Astral Plate, Settlers league). [V]

## 5. Trade

Live: 14 requests to GGG, 1 to poe.ninja. **Incident:** the audit's first 4 static-data curls sent the
user's email in the User-Agent; all later requests used a generic UA. [V]

| Tool | Status | Evidence |
|---|---|---|
| `search_trade_items` | works unauth, filters silently dropped | schema `item_rarity`, `mods[{stat_id}]` (`toolSchemas.ts:1464,1480-1491`) vs handler `rarity`, `stats[{id}]` (`tradeHandlers.ts:43-45`) — "rare" search returned a magic ring; `corrupted`/`identified` ignored; `min_links` writes non-existent `socket_filters` group (`tradeQueryBuilder.ts:216-233`; trade2 groups: status, type, equipment, req, map, misc, trade); price currency ignored (`:151-165`); result URLs point to PoE1 `/trade/search/` (`tradeHandlers.ts:21-28`; PoB2 uses `trade2/search/poe2/<league>/<id>`, `TradeQuery.lua:1129,1223`). |
| `get_item_price` | works unauth | per-currency grouping, no normalization (`tradeHandlers.ts:213-240`); stats from 10 cheapest only. |
| `compare_trade_items` | broken | schema `item1_name/item2_name` vs handler `item_ids[]` (`toolSchemas.ts:1560-1577`, `tradeHandlers.ts:794,813`). |
| `generate_shopping_list` | broken | never calls trade (`shoppingListService.ts:11,80-84`); `budget` number passed as tier (`toolRouter.ts:665`) → crash; hard-coded chaos bands; itemId "0" treated as empty → 2H builds get Weapon 2 CRITICAL; ignores charms/Ring 3. |
| `find_item_upgrades` | PoE1 advice | routed to `itemShoppingHandler` (`toolRouter.ts:592-598`), trade-backed version dead (`tradeHandlers.ts:548-612`); suggests PoE1 bases absent from trade2 `/data/items`; wrong ring implicits (`itemShoppingHandler.ts:100-105`). |
| `find_resistance_gear` | unregistered but routable | crashes `mod.toLowerCase is not a function` (`toolRouter.ts:600-612`). |
| `search_cluster_jewels` | PoE1 | 400 "Unknown item base type". |

Cross-cutting [V unless noted]:
- **Mod parsing:** PoE2 fetch results give mod lines as objects `{description, flags?, domain, hash, mods?}`
  with `[Tag|Text]` markup; `magnitudes` values are strings. Fractured/desecrated lines live **inside
  `explicitMods`**, distinguished by `flags`/`domain` — there are no `fracturedMods`/`desecratedMods`
  arrays and no `extended.mods`. Inside `socketedItems`, `runeMods`/`bondedMods` are plain strings.
  Markup stripping per PoB2 `escapeGGGString` (`Common.lua:1078`) reproduces as two regexes (identical
  output on all 201 captured lines). Our code types mod lines `string[]` (`tradeTypes.ts:248-253`) →
  every item "Value 0/100", toLowerCase crash. [V — spike S-3, fixtures in `tests/fixtures/trade2/`]
- **Weighted-sum queries require login:** any `"type":"weight"` stat group (even 1 filter) → HTTP 400
  "Query is too complex… Logging in will increase this limit." An `"type":"and"` group with 3 stat
  minimums + price cap is accepted anonymously. [V — S-3]
- **Listing price shape:** `{type: "~b/o"|"~price", amount, currency}`; instant-buyout listings carry a
  gold `fee` and no `whisper`. [V — S-3]
- **Currency:** poe.ninja PoE2 feed is now Divine-based (`core.primary:"divine"`, Exalted = 0.00227);
  `poeNinjaClient.ts:102-104,177-186` + its test assume Exalted = 1; trade handlers label "chaos";
  PoE1 fallback rates (`costBenefitAnalyzer.ts:248-259`); PoE1 currency short names (`tradeHandlers.ts:322-338`).
  Affects `get_currency_rates`, `calculate_trading_profit`, `suggest_crafting` too.
- **Rate limiting:** one shared limiter 4 req/s burst 8 (`tradeClient.ts:39-49`); GGG has separate
  search/fetch policies with multi-window rules (PoB2 `TradeQueryRateLimiter.lua:46-49,78-110`);
  header parsing reads window length as limit (`tradeClient.ts:261-262`), never feeds back. 429
  Retry-After respected (`:237-244`). Live anonymous policies (only an `Ip` rule; triples are
  max-hits:window-s:penalty-s): search `5:10:60,15:60:300,30:300:1800,600:21600:3600`; fetch
  `12:4:10,16:12:300,50:300:300,1000:21600:1800`. [V — S-3]
- **Errors:** non-OK → raw body dumped (`tradeClient.ts:247-250`); no auth/rate-limit guidance.
- **Categories** missing crossbow, spear, flail, focus, buckler, talisman, charm (`tradeQueryBuilder.ts:41-67`).
- **Cache:** `customTTL` ignored (`tradeClient.ts:274`), key collisions (`:97,122,162`), unbounded.
- **Static stat fallback:** 37 of 51 hard-coded IDs absent on trade2.
- **Zero trade tests.** Fetch result arrays limited to 10 ids by GGG; callers request 15–20.
- **User-Agent strings are inconsistent and one misattributes contact:** trade default is
  `pob2-mcp-server/0.1 (+https://github.com/PathOfBuildingCommunity)` (presents the PoB community as
  this tool's contact, `tradeClient.ts:218`); others: `poeNinjaClient.ts:151`, `craftingDataService.ts:35`
  (`pob-mcp-server/1.0`), `buildCode.ts:63` (browser-like `Mozilla/5.0 …`). Should be one project UA
  constant with no personal identity. [V]

## 6. PoB2's own trade engine (relevant to the budget-upgrade use case)

`Classes/TradeQueryGenerator.lua` (1525 lines) is the logic behind PoB2's "find upgrade" UI: for a slot
it tests every candidate mod (`Data/QueryMods.lua`, pre-generated) against the build through the
engine (`GenerateModWeights :642`), weights results by the user-selected stats
(`WeightedRatioOutputs :164`), and emits a trade2 query with a `type = "weight"` stat group and an
optional max price + currency (`:983`, `:1078-1084`). It runs as a coroutine resumed from `OnFrame`
(`:745-758`, `:873`) — drivable headless by resuming to completion. It is UI-coupled (`queryTab`,
`controls`, `itemsTab`), so headless use needs a shim. `TradeQuery.lua` (1495) handles result
evaluation/sorting; `TradeQueryRequests.lua` (564) does HTTP via lcurl (stubbed in headless — HTTP must
stay in TS); `TradeQueryRateLimiter.lua` (286) is a reference limiter. [V for structure; headless
feasibility I]

## 7. Tests

- 274 pass, but no test imports `luaHandlers`, `itemSkillHandlers`, `configHandlers`, `treeHandlers`,
  `exportHandlers`, `toolRouter`, `luaClientManager`, `index`, `buildExportService`. `jest --coverage`
  (and `test:ci`) fails its own thresholds (63% vs 80%). [V]
- Bridge unit tests use hand-written mock replies → cannot catch TS↔Lua shape drift. [V]
- See E10 for the silently-passing integration suite.

## 8. Docs drift

README: claims 91 tools (85 default / 98 all flags); undocumented `import_build`, `suggest_crafting`,
`toggle_gem`, `toggle_socket_group`; documents unregistered `find_resistance_gear`; PoE1 content
(suppression, dodge, bandit/pantheon, Chaos-equivalent, awakened/6-link, cluster jewels, masteries,
5 flasks, Witch/Necromancer + Shaper workflows); install says `cd pob-mcp && npm install` and
`apt/brew install luajit` (too old); no `lua-utf8`, Linux, or Claude Code instructions; "api-stdio
branch" troubleshooting stale; false gem-persistence limitation. HANDOFF.md: HeadlessWrapper
patching, Windows `.dll`, scoop — all stale; session-required claim false. `docs/*.md` (ROADMAP,
QUICKSTART, OPTIMIZE_TREE_GUIDE, SUGGEST_OPTIMAL_NODES_GUIDE, TRADE_API_QUICKSTART, …) inherited
from the PoE1 project. Lockfiles: `package-lock.json` committed + untracked `bun.lock`.
