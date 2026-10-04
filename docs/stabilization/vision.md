# pob2-mcp stabilization: change vision (v2)

Status: **v2, ratified by the user 2026-10-03** (Phase 2 of the build method). Next: `spec-formalizer`
(brownfield tier). This version folds in **25 verified review
clusters** (6 lenses → 69 raw findings → skeptic-verified). See [`review-vision.md`](review-vision.md)
for the findings, the verdicts, and what was refuted.

Ground truth for the existing system is [`recon.md`](recon.md); IDs like **E2** point at its tables.
**Citation basis:** recon's PoB `file:line` citations are from **dev head `bb52d6b`**, not the pin.
On the pinned `v0.23.1`, locate code by symbol. Spikes S-1, S-2 and S-4 cite the tag. S-3 §5
contains three dev-head-only statements, which are labelled there.

Legend: **HUMAN** = decided by the user · **PROPOSED** = coordinator's recommendation, overridable ·
**DECIDE** = needs a user answer before formalization.

---

## 1. Goal

Make pob2-mcp a **stable, PoE2-correct** MCP server whose answers come from PoB2's engine, with a
**trade capability for budget-constrained upgrade search**. Concretely:

1. The engine connection never silently loses, corrupts, or mis-attributes build state.
2. Every registered tool is PoE2-correct. PoE1-only tools are removed, not hidden.
3. Advice reports what PoB2 computes. Every judgment is a PoB warning or a comparison of two engine
   outputs, never a constant we invented.
4. Trade: "find upgrades for slot X under budget Y, with optional required mods Z, ranked by
   **weighted stats to sort by** S" works end to end. It mirrors PoB2's own trade dialog and returns
   results the user can act on from chat.
5. A local test gate that fails loudly when any of the above regresses, including when the engine
   can't run.

## 2. Non-goals

- New analysis features beyond what exists. There is no new boss model, because PoB2 ships no PoE2
  boss data.
- Changing the vendored-bridge architecture (a vanilla PoB2 checkout plus `pob-api/` stays).
- A GUI, hosting, or multi-user support.
- Crafting simulation (the domain of craftofexile; PoB2 has no data for it).
- **Multi-slot "where should I spend X" optimization.** `find_upgrades` is single-slot. Claude can
  call it once per slot, under one process-wide rate limiter. *(PROPOSED)*
- **PoB's unique-jewel trade rows** (Megalomaniac, Heart of the Well, Against the Darkness), which
  PoB handles as special cases. **Deferred, not dropped** *(HUMAN, 2026-10-03)*: the user wants them
  once the core is stable, because a unique jewel can cheaply give a medium-budget build a big boost.
  They are a follow-up epic.
- **Hosted CI.** The repo has no CI. The gate is a local `mise run test` (D-17).

## 3. Decisions

| ID | Decision | Status |
|---|---|---|
| D-1 | Work lands in **the user's own fork** `git@github.com:parkerault/pob2-mcp.git`. `origin` points at the fork and `upstream` at `zgrummons/pob2-mcp`. | HUMAN |
| D-2 | **Pin PathOfBuilding-PoE2 to a release tag and upgrade deliberately.** Initial pin `v0.23.1` (commit `7d6f530`). **Mechanism:** a committed **`pob-pin.json`** (repo, tag, commit, version, and the sha1 of `HeadlessWrapper.lua` hashed with the *same* CRLF normalization as the manifest), plus **`scripts/fetch-pob.sh`**. The script does a sparse, blob-less, depth-1 clone into a gitignored **`vendor/PathOfBuilding-PoE2`** and is exposed as `mise run pob:fetch` ([S-2](spikes/S-2-pin-v0.23.1.md)). **`POB_FORK_PATH` means the checkout's `src/` directory**; `manifest.xml` is in its parent. One shared resolver serves both the bridge and `treeService` (today `treeService.ts:57` reads the env directly). It defaults to `<packageRoot>/vendor/PathOfBuilding-PoE2/src`. **`packageRoot()`** is one shared helper that walks up from `process.argv[1]` to the directory containing `pob-pin.json`, falling back to cwd. It must not use `import.meta.url`, which ts-jest's CommonJS test build cannot compile (TS1343). **Pin check before spawn:** the manifest version must equal the pin, AND `.git/HEAD == pin.commit` when a `.git` exists, AND every manifest entry present on disk must match its sha1 after CRLF normalization (PoB's own scheme; ~164 ms; no curated file list). The `HeadlessWrapper.lua` sha1 must also match. **On failure, only the engine tools are disabled**, with a `mise run pob:fetch` hint. Trade search and poe.ninja tools keep working. `POB_ALLOW_UNPINNED=true` downgrades the check to a warning. **Upgrade procedure:** bump the pin, fetch, run the golden tests, re-record the golden values. | HUMAN (pin) / PROPOSED (mechanism) |
| D-3 | **The engine is the source of truth; we add no constants of our own.** Every judgment the advice tools make is either (a) one of PoB's own warnings (`build.controls.warnings`, BuildDisplayStats `warnFunc`: unmet attribute requirements, unreserved Life/Mana/Spirit below zero, point and gem limits), or (b) a comparison of engine outputs. Examples: `Missing<Elem>Resist > 0` (the engine exports it; there is no `…ResistMax` export), `<Type>MaximumHitTaken < totalEnemyDamage` against the configured enemy, and EHP and PDR as computed. Hard-coded thresholds (75% caps, "4000 life", armour bands, chaos targets) are removed. | PROPOSED |
| D-4 | **Delete** these tools (code, schemas, routes, docs): **(a)** PoE1-only: `analyze_build_cluster_jewels`, `analyze_cluster_jewels` (routed-only), `search_cluster_jewels`, `suggest_watchers_eye`, `suggest_masteries`, `check_boss_readiness`, `optimize_skill_links`, `create_budget_build`, `suggest_optimal_nodes`, `optimize_tree`, `analyze_items`. **(b)** Legacy gem tools: `analyze_skill_links`, `suggest_support_gems`, `find_optimal_links`, `validate_gem_quality`, `compare_gem_setups`, `gem_upgrade_path`. **(c)** Broken trade tools: `compare_trade_items`, `generate_shopping_list`, `find_resistance_gear` (routed-only). **(d)** Inert or redundant: `find_arbitrage` and `calculate_trading_profit` (single mid-rate feed, so every round trip is break-even by construction); `refresh_tree_data` (tree data is pinned and read-only); `save_tree` (its purpose is `lua_save_build`, which absorbs it, see D-9). **(e)** `suggest_crafting`. Also delete the dead plumbing: `skillGemService.ts`, `skillGemHandlers.ts`, `skillLinkOptimizer.ts`, `jewelAdvisorHandlers.ts`, `clusterJewelHandlers.ts`; the no-op `ToolGate` and `POB_LEGACY_GEM_TOOLS`; the mastery plumbing (Lua `get_mastery_options`, `calc_with`'s `masteryEffects` parameter, `save_tree`'s `mastery_effects`). **That is 25 of the 100 routed names.** `find_item_upgrades` is replaced by `find_upgrades` (D-6). | PROPOSED; (e) HUMAN |
| D-5 | **Trade architecture.** Query generation and candidate evaluation run **in Lua, using PoB2's own `TradeQueryGenerator`/`TradeQuery`** driven headless. They are new handlers in a new `pob-api/API/Trade.lua` (`trade_generate_query`, `trade_evaluate_items`, `trade_query_options`, shapes in [S-1](spikes/S-1-headless-trade-generator.md)), registered with one line in `Handlers.lua`. Class construction goes through the shared version-portable `construct()` in `pob-api/API/Util.lua` (D-2 unit). **TypeScript keeps:** HTTP, the per-policy rate limiter, auth, the query-complexity trim-and-retry, PoB's min-weight adjust loop, price normalization, and URL building. S-1 verified generation (Body Armour: 80 engine evaluations, 2.3–3.1 s; Weapon: 129, ≤4.4 s) and evaluation (~25 ms per item, identical to PoB's `GetResultEvaluation`) with no PoB file changes. | PROPOSED (S-1 PASS) |
| D-6 | **`find_upgrades` (new; replaces `find_item_upgrades`).** **Inputs** mirror PoB2's trade dialog (S-1 mapping table): `slot` (PoB's slot set for the loaded build: gear, Weapon 1/2 and their Swap slots, Ring 1–3, Flask 1–2, Charm 1–3, gear and tree jewel sockets); **stats to sort by** (weighted engine stats from PoB's `powerStatList`, default FullDPS 1.0 + TotalEHP 0.5); **required mods** (up to 3 trade-mod filters, each a trade stat id plus a min, enforced by the trade server; these are *not* engine-stat thresholds); `max_price` + `currency` (PoB's currency list, default "Exalted Orb Equivalent"); `max_level`; `min_empty_rune_sockets`; `weight_corrupted_mods` (PoB's "Corrupted Mods": include corruption implicits in the weighting, not an item filter); `include_mirrored`; rune behaviour (copy/keep/remove); anoint behaviour (amulet); `jewel_type` (jewel slots); trade status (default instant buyout); `league` (default: `POE_LEAGUE` env, else the current non-Standard poe2 league from `/data/leagues`); `fetch_pages` (PoB's "Fetch Pages", 10 items per page, default 2, max 10); `rank_by` (PoB's trader sort: `stat_value` default, `stat_value_per_price`, `price`, `trade_weight`; the price modes fall back to `stat_value` when no rates are available). Generated or required stat ids missing from the cached live `/data/stats` are dropped before sending, with a note. **Output:** the loaded build's file name, plus a warning if the file is newer on disk than the engine's copy (D-16). Then the baseline score, summary counts (searched / fetched / evaluated / upgrades), and per listing: name and base, native price plus normalized price, engine score vs baseline, `is_upgrade`, per-stat deltas (sort stats plus requested report stats), the `whisper` if present, otherwise PoB's exact-item URL (weight ±1 + `trade_filters.account`), and the **PoB item text** (so `add_item` can try it in the build). The default returns only upgrades, with an explicit **"no upgrade within budget"** result. An option returns the best non-upgrades, flagged. **Companion `trade_query_options(slot)`** lists valid sort stats, slot-eligible required mods, currencies and statuses. **Caching:** only the generated query is memoized, keyed by (engine revision from D-8, slot, weights, options). Listings and evaluations are never cached. **Kept and fixed:** `search_trade_items`, `get_item_price`, `search_stats`, `get_leagues`. | HUMAN (use case) / PROPOSED (shape) |
| D-7 | **Trade errors and identity.** Plain search/price/fetch work anonymously. Weighted search needs a session (D-15). Every error is turned into an actionable message, with response bodies truncated. Classification follows D-15. **Identity:** one project User-Agent constant naming this project and a contact, never PoB's organisation (today's default points at PoB's GitHub org, `tradeClient.ts:218`) and never user identity. The **`POESESSID` cookie goes only to trade2 search and fetch requests**, not `/data/*`. It never appears in logs, errors, tool output or fixtures. | PROPOSED |
| D-8 | **Engine concurrency and recovery.** **(a)** The router holds **one engine mutex per engine-touching tool call**, so multi-step tools (load+info+stats, `suggest_supports` measurement, `find_upgrades`) see a stable build. `find_upgrades` holds the lock through its HTTP phase; with a single user, other engine calls just wait. **(b)** The protocol has request IDs. Timeouts are **per request, measured from the stdin write** (today they are per line read). `ensureClient` is single-flight. A timeout kills and restarts the engine. **(c)** The engine keeps an **engine revision counter**, incremented on every load and mutation. **(d) Recovery without silent loss:** after each successful mutating tool call, snapshot the engine build (`export_build_xml`, ~15 ms). After any restart, restore the latest snapshot and tell the user "engine restarted; restored to the state after `<last completed call>`; `<in-flight call>` was not applied". Return an explicit error only if no snapshot exists. **(e)** Root fixes owned here: E1 (encode replies inside the `pcall`; `calc_with` returns a whitelisted numeric stat subset, never PoB's raw cyclic output); E4 (validate loads and report failures; the readiness probe uses a valid `<PathOfBuilding2>` build; turn off dev-mode `~~temp~~` autosave); E5; E6 (`isError: true` on every error); E9. **(f)** Test-only fault actions (`__test_sleep`, `__test_crash`), enabled only by an env flag. | PROPOSED |
| D-9 | **Writes never clobber the working build.** Engine writes save the *current* engine build: `lua_save_build` (absorbs `save_tree`; overwriting an existing file requires an explicit flag; backups stay on). `export_build` of a file with no changes is a byte copy. Any file→file operation that must go through the engine (e.g. adding notes) runs under the D-8 lock as: snapshot → load source → modify → save → reload snapshot. The engine revision and restore point are unchanged afterwards. All written XML has a `<PathOfBuilding2>` root. | PROPOSED |
| D-10 | **TS↔Lua contract = per-action runtime schemas.** Use zod, declared as a direct dependency; today it is only transitive and doesn't resolve under pnpm. TS types are inferred from the schemas, and every reply is validated in the bridge's `send()`, so a mismatch fails loudly in production too. The contract unit (A3) owns **every** recon §3 key/shape mismatch (`nodeCount`/`pointsUsed`, `size`/`bytes`, `result.specs`, `activeItemSetId`, `_meta`, `targetVersion`…). The engine-op unit (B) owns behavioural fixes only. | PROPOSED |
| D-11 | **Currency.** poe.ninja's PoE2 feed is **Divine-primary** (`core.primary: "divine"`, secondary `chaos`). The client normalizes to `core.primary`; the current code wrongly claims an Exalted base. **Budget authority:** trade2's server-side price filter, in the user's chosen currency (as in PoB), plus a client-side post-filter on the normalized price when poe.ninja is available (they can disagree: in S-4, a "2 chaos" listing passed a 200-ex cap but is ≈327 ex at poe.ninja rates). Output shows native and normalized prices. **When poe.ninja is off or down:** use the server filter only, show native prices, use `rank_by stat_value`, and say so. Chaos is a legitimate listing currency; we only never *label* normalized values "chaos equivalent". `find_arbitrage` and `calculate_trading_profit` are deleted (D-4). A poe.ninja fixture is committed, and the unit test is rewritten against it. | PROPOSED |
| D-12 | **Golden-build fixture:** a copy of the user's `Grenadator.xml` (Mercenary / Gemling Legionnaire, weapon swap, charms, 12 skill groups), committed as `tests/fixtures/builds/grenadator.xml` **by the coordinator before the build**. Source: `/mnt/c/Users/parke/Documents/Path of Building (PoE2)/Builds/Grenadator.xml`; record its sha1, because the source is the user's live file and may change. More fixtures for specific features can come from public pobb.in builds via `import_build`. | HUMAN (fixture) / PROPOSED (procedure) |
| D-13 | **Package manager: pnpm** (via corepack). Done: lockfile converted, `packageManager: pnpm@11.6.0`, `mise.toml` pins `node = "24"`, undeclared `@jest/globals` declared. | HUMAN |
| D-14 | **Trade on by default**, opt-out via `POE_TRADE_DISABLED=true` (mirrors `POE_NINJA_DISABLED`). `POE_TRADE_ENABLED` is removed. **Engine on by default too:** `POB_LUA_ENABLED` is removed and the engine starts lazily on the first engine tool call; otherwise `find_upgrades` would be listed but always fail. No network I/O before the MCP handshake: trade2 stat data loads lazily on the first trade call, with a timeout. | HUMAN (trade) / PROPOSED (engine, lazy loading) |
| D-15 | **Session for weighted search.** **HUMAN:** the user's `POESESSID` lives in the repo's gitignored `.env` (single-user personal project; the user explicitly accepts a cookie on disk). When the cookie is missing or rejected, `find_upgrades` falls back to the trade-site link `trade2/search/poe2/<league>?q=<query>` (the pinned tag's format). **PROPOSED mechanism:** (1) **Credential getter:** read `<packageRoot>/.env` with `util.parseEnv` on each trade request. It does not mutate `process.env`, needs no restart when the user refreshes the cookie, and treats a missing file as no cookie. A non-empty process `POESESSID` takes precedence; `POE_SESSION_ID` is an alias; an `op://…` value produces an "unresolved 1Password reference; launch via `op run`" error. Tests inject the getter. (2) **Classification:** no cookie configured → don't send the weighted search; return the link with a "set POESESSID" hint. Cookie sent, and the response is 400 code 2 *without* `Account` in `X-Rate-Limit-Rules` (or its message contains "Logging in will increase this limit") → session not recognised: return the link with a "refresh POESESSID" hint. 400 code 2 *with* `Account` present → the query is over trade2's complexity limit: drop the lowest-weight filters, retry a bounded number of times, then return the link. 401/403 → generic auth message with the refresh hint. 429 → honour `Retry-After`. The actual expired-cookie response is **unverified** (S-4 [I]); the human-only live smoke records it. (3) **Rate limiting:** one process-wide limiter parses `X-Rate-Limit-Policy/-Rules/-<rule>/-<rule>-State` per response. Logged-in requests add an `Account` rule (search `3:5:60`, fetch `6:4:10`). S-4 verified the cookie lifts the rejection (HTTP 200, complexity 180). *Considered and rejected:* a GGG OAuth "connected app" (registrations closed; `account:trade` is a PoB-only grant; borrowing `client_id=pob` would misrepresent the tool), and an anonymous count-group prefilter plus engine re-rank (S-1's anonymous-fallback section, superseded). | HUMAN (cookie in `.env`, link fallback) / PROPOSED (mechanism) |
| D-16 | **First run, host wiring, and the user's builds.** `mise run setup` = `pnpm install --frozen-lockfile && pnpm build && mise run pob:fetch`. Claude Code registration (documented and smoke-tested): `claude mcp add pob2 -s user -- mise exec -C ~/projects/pob2-mcp -- node build/index.js`. `mise exec` puts the pinned luajit and Node 24 on PATH, so the server needs no PATH logic. The server module is side-effect-free (`createServer(deps)` plus a thin entry file). The default `POB_DIRECTORY` uses PoB2's folder name `…/Path of Building (PoE2)/Builds`; the WSL path `/mnt/c/Users/<win-user>/Documents/Path of Building (PoE2)/Builds` is documented, and is this user's configured value (Q6, HUMAN). The file watcher uses polling for paths under `/mnt/*`, because inotify doesn't see Windows-side writes on drvfs. Engine-backed outputs name the loaded build file and warn when it is newer on disk than the engine's copy, which is cheaper and safer than auto-reloading. | PROPOSED |
| D-17 | **Local gate and build-fleet environment.** **The gate:** `mise run test` = `mise run pob:fetch` + `pnpm test`, with explicit exit codes. A mise task already has the pinned luajit on PATH. **Engine tests fail, not skip, whenever the engine can't run** (absent `vendor/`, luajit missing, bridge won't start) unless `POB_SKIP_ENGINE=1` is set explicitly. Integration tests use the server's own default checkout resolver (`vendor/`), never the dev-head sibling. **MCP-level tests run in-process** (SDK `InMemoryTransport` + `Client`, global `fetch` mocked, credential getter injected, `POESESSID` cleared in Jest setup). **Worktree bootstrap**, for the orchestrator handoff: `mise trust && pnpm install --frozen-lockfile && mise run pob:fetch` (mise refuses untrusted configs at new paths). **Coverage** is reported, not gated (the global thresholds are unmet today, 66/52/69/69 against 80/75/85/80, and gating would push padding). Commits are signed via the 1Password SSH agent, which can prompt; the orchestrator should batch commits or sign at the end with the human present. | PROPOSED |

## 4. Tool disposition after the epic

Every one of the **100 routed names** (98 registered + 2 routed-only) appears in exactly one row.
After the epic there are **76 tools**: 74 kept or fixed, plus 2 new (`find_upgrades`, which
replaces `find_item_upgrades`, and `trade_query_options`). A test enforces that the registry matches this table (I-4). The lane is the
unit that owns the change (§6).

| Bucket | Tools | Lane |
|---|---|---|
| **Keep** (verified working on the tag; must still pass I-4) | `lua_load_build`, `lua_start`, `lua_stop`, `lua_reload_build`, `search_tree_nodes`, `list_gems`, `get_classes`, `set_character_level`, `get_skill_setup`, `set_main_skill`, `set_gem_level`, `set_gem_quality`, `remove_gem`, `remove_skill`, `toggle_gem`, `toggle_socket_group`, `get_equipped_items`, `snapshot_build`, `list_snapshots`, `restore_snapshot`, `get_build_notes`, `set_build_notes`, `get_build_stats`, `compare_trees`, `get_leagues` (25) | — |
| **Fix: engine ops** | `lua_new_build` (honour class/ascendancy) · `lua_save_build` (absorbs `save_tree`; overwrite flag) · `lua_get_build_info` (tree version from the spec; engine class names) · `lua_get_tree` (engine class/ascendancy names instead of the PoE1 map; drop the mastery line) · `lua_get_stats` (PoE2 defence fields `EvadeChance`/`DeflectChance`; `EvasionChance` doesn't exist) · `lua_set_tree`, `update_tree_delta` (E2: keep attribute choices and weapon sets) · `create_spec`, `add_item`, `add_multiple_items` (`construct()`) · `add_gem` (reject unknown names with suggestions) · `create_socket_group`, `setup_skill_with_gems`, `toggle_flask` (PoE2 slots: Flask 1–2, Charm 1–3) · `get_config`, `set_config`, `set_enemy_stats`, `save_config_preset`, `load_config_preset`, `list_config_presets` (via `input`; PoE2 options; real old values; presets apply) · `get_passive_upgrades` (real path cost; depends on E1) · `plan_leveling` (class override) · `analyze_skills`, `suggest_supports` (PoB's `canGrantedEffectSupportActiveSkill`; broader non-alphabetical pool; measures the requested group) · `analyze_build`, `compare_builds` (don't clobber the working build; PoE2 XML) · `export_build` (D-9) · `export_build_summary` (engine class names) · `list_builds` (default dir, D-16) · `get_nearby_nodes`, `find_path_to_node` ("Build: undefined") · `import_build` (inflate size limit; PoE2 root only) · `start_watching`, `stop_watching`, `get_recent_changes`, `watch_status` (polling on `/mnt/*`, subfolders, accurate descriptions) | B (A2/A3 for root causes) |
| **Fix: TS↔Lua shapes** | `list_specs`, `select_spec`, `delete_spec`, `rename_spec`, `list_item_sets`, `select_item_set`, plus the shape halves of the engine-op rows above (`_meta`, `size`/`bytes`, `targetVersion`) | A3 |
| **Fix: trade/currency** | `search_trade_items` (schema↔handler arguments, PoE2 filters and categories, currency option, `trade2` URLs) · `get_item_price` (normalization) · `search_stats` (drop the PoE1 fallback table; `getTradeId`) · `get_currency_rates` (Divine-primary, D-11) | T1 |
| **Rewrite on engine data (D-3)** | `validate_build` (one path), `analyze_defenses`, `get_build_issues` (plus the load summary's "Top Issues") | C |
| **New** | `find_upgrades` (replaces `find_item_upgrades`), `trade_query_options` | T2 |
| **Delete (D-4)** | the 25 names listed in D-4 | D4 |

## 5. Spikes (all complete)

| ID | Question | Result |
|---|---|---|
| S-1 | Can PoB2's `TradeQueryGenerator` run headless and evaluate fetched items? | **PARTIAL:** generation and evaluation PASS headless; trade2 rejects weighted queries without a login ([report](spikes/S-1-headless-trade-generator.md)) |
| S-2 | Does `pob-api/` work on tag `v0.23.1`, and how to pin it? | **PASS:** the tag reproduces the user's saved stats exactly (all 109 `PlayerStat` pairs via save); pin = pin file + sparse fetch ([report](spikes/S-2-pin-v0.23.1.md)) |
| S-3 | Capture trade2 payloads as fixtures; confirm the mod shape and rate limits. | **PASS:** 27 anonymized fixtures in `tests/fixtures/trade2/` ([report](spikes/S-3-trade2-fixtures.md)) |
| S-4 | Does a logged-in `POESESSID` lift the weighted-query rejection? | **PASS:** HTTP 200, complexity 180; engine re-rank of the top 10 found 1 upgrade ([report](spikes/S-4-session-weighted-search.md)) |

**Build target is the tag, not dev head.** The `new()` constructor break (E3) exists only on dev
head; the shared `construct()` helper keeps the next pin bump (which crosses PoB's class-system
rewrite) cheap.

## 6. Work units and dependency shape (input to the DAG; the formalizer refines)

```
F0 (coordinator precondition: commit golden + poe.ninja fixtures)
P  pin impl (D-2): pob-pin.json, fetch script, mise tasks pob:fetch/setup/test, /vendor/ ignore,
   packageRoot(), shared POB_FORK_PATH resolver, pin check, pob-api/API/Util.lua construct()
   │
   ▼
A1 harness (D-17): createServer(deps) refactor, in-process MCP tests, engine-required semantics,
   golden tests I-1a/b, tool-disposition registry test
   │
   ▼
D4 deletions (D-4) ─────────────┬──────────────────────────────┐
   │                            ▼                              │
   ▼                       T1 trade client (core parallel     │
A2 engine concurrency &        with A2/A3; wiring serialized)  │
   recovery (D-8, D-14 engine) │                              │
   │        └──────────────────┤                              │
   │                            ▼                              │
   │                       T2 find_upgrades + trade_query_options (needs A2 lock + T1 + S-1;
   │                          defines its own runtime schemas in the D-10 style)
   ▼
A3 contract (D-10, E7 stat export, E8 hidden slots) ──► B engine-op fixes ──► C advice rewrite (D-3)

all ──► G docs (README tool table generated from the registry; setup + `claude mcp add`; remove stale
        docs/*.md and HANDOFF.md; project CLAUDE.md)
```

- **Critical path:** F0 → P → A1 → D4 → A2 → T2. T1's core (its own files) runs alongside A2 and
  A3. **Trade goes first in the wiring order**, so a partial build still delivers `find_upgrades`.
- **Shared files are serialized.** Every unit's edits to shared files are a short serialized
  "wiring" step: one schema entry, one route case, one bridge method, one Lua registration line.
  Unit cores run in parallel only when their files don't overlap. Shared files:
  `src/server/toolSchemas.ts`, `src/server/toolRouter.ts`, `src/index.ts`,
  `src/handlers/luaHandlers.ts`, `src/handlers/tradeHandlers.ts`, `src/pobLuaBridge.ts`,
  `src/utils/contextBuilder.ts`, `pob-api/API/BuildOps.lua`, `pob-api/API/Handlers.lua`.
  B and C share `luaHandlers.ts` and `BuildOps.lua`, so **B runs before C**. New code goes in new
  modules (`src/trade/`, `pob-api/API/Trade.lua`, `pob-api/API/Util.lua`). No registry refactor:
  after D4 the shared-file edits are small, and a refactor would itself conflict with every unit.
- **Ownership of recon defects:**
  - **P:** E3's `construct()` helper.
  - **A1:** E10.
  - **A2:** E1, E4 (plus the readiness probe and dev-mode autosave), E5, E6, E9.
  - **A3:** E7, E8, all recon §3 shape mismatches.
  - **B:** E2, recon §3 behaviours, E3 call sites.
  - **C:** recon §4 advice tools.
  - **T1:** recon §5 (mod parsing, currency, limiter, errors, the User-Agent, `.env` credential getter, `search_trade_items` filters, the static stat fallback, the 10-id fetch cap, cache defects, the D-14 trade flag, lazy stat loading, league default).
  - **T2:** D-6.
  - **G:** recon §8.

## 7. Definition of done (named invariants, each with an owning unit and its own test)

- **I-1 Golden build.** The fixture's recorded values are its `<PlayerStat>` pairs at the current
  pin, re-recorded on each pin bump.
  - **I-1a** *(A1)* Load the fixture, then save: the saved file's 109 `(stat, value)` pairs equal the
    fixture's exactly. Compare through the saved pairs, not `get_stats`, which lacks
    `MainHandAccuracy`.
  - **I-1b** *(A1)* Save then reload: identical engine stats and identical `PlayerStat` pairs. There
    is no XML byte or structure comparison, because `SaveDB` reorders sections, attributes and
    children across processes.
  - **I-1c** *(B)* A no-op `update_tree_delta` leaves Str/Dex/Int/Life/CombinedDPS unchanged
    (today: 119/91/64 → 89/46/49).
  - **I-1d** *(B)* `export_build` leaves `lua_get_build_info`, the stats and the engine revision
    unchanged, and its output loads with the same class, level and stats.
- **I-2 Engine robustness** *(A2)*. Fault injection uses the env-gated test actions.
  - A request that times out is followed by a call that gets its own reply.
  - 4 parallel tool calls all succeed, each attributed to its own call.
  - Edit → forced crash: the edit survives via the snapshot, with the restore notice (or an explicit
    error when no snapshot exists).
  - An empty-string load followed by a good load works.
  - A mutation issued during `find_upgrades` doesn't change what that call evaluates against.
  - The server exits on stdin EOF and reaps luajit.
- **I-3 Contract** *(A3)*. Every Lua action, run on the golden build with its preconditions (e.g.
  ≥2 specs for `delete_spec`), parses against its runtime schema.
- **I-4 Tool hygiene** *(A1 harness; every unit keeps it green)*.
  - The registered and routed tool set equals §4's table.
  - Every registered tool is exercised in-process with a valid call.
  - No output contains `undefined`, `NaN` or `[object Object]`.
  - Every failure sets `isError`.
- **I-5 No PoE1 cruft** *(D4; every unit)*. A static scan of text we author: tool
  schemas/descriptions and string literals in `src/**/*.ts`. Engine- and trade-sourced names are
  excluded, because PoE2 legitimately has "Fire Mastery", "Guardian Bow", "Bandit Mask", "Shaper of
  Winter" and the like.
  - Banned phrases: spell suppression, Watcher's Eye, Cluster Jewel, Bandit, Pantheon, Awakened,
    6-link, "Chaos Orb equivalent", mastery effect, and PoE1 boss names used as bosses.
  - Banned PoE1-only class names: Scion, Marauder, Duelist, Templar, Shadow.
- **I-6 Engine-required gate** *(A1)*. With `vendor/` absent, or luajit unavailable, `mise run test`
  fails unless `POB_SKIP_ENGINE=1` is set.
- **I-7 Pin** *(P)*.
  - A checkout with the same manifest version but one modified Calc file is refused.
  - A git checkout whose HEAD ≠ the pin commit is refused.
  - On refusal, engine tools report the `pob:fetch` hint while trade and poe.ninja tools still work.
- **I-8 Trade.** Parts a–d use recorded or synthesized fixtures with the engine and the golden build.
  - **I-8a** *(T2)* The outgoing search body contains the weighted group, an `and` group of the
    required trade ids and mins, the price filter, and the status.
  - **I-8b** *(T2)* Over a synthesized multi-page, mixed-currency fetch set built from the S-3
    fixtures:
    - ranking follows `rank_by` (default `stat_value`, descending);
    - the normalized-price post-filter applies;
    - `is_upgrade` matches score > baseline, and "no upgrade within budget" is returned when none
      qualify;
    - every listing carries a whisper or an exact-item URL, plus the item text.
  - **I-8c** *(T1/T2)* Classification with synthesized responses:
    - no cookie → link, with no request sent;
    - 400 code 2 with rules `Ip` → link plus refresh hint;
    - 400 code 2 with `Account,Ip` → bounded trim-and-retry, then link;
    - 401/403 → auth message;
    - 429 → `Retry-After` honoured.
  - **I-8d** *(T1)* The limiter parses per-policy rules, including `Account` (headers synthesized
    from S-4's values).
  - **I-8e** *(T1)* A sentinel cookie is sent only to trade2 search and fetch, and never appears in
    logs, errors or output. The User-Agent equals the project constant.
  - **I-8f** *(human-only)* One live logged-in smoke test, recorded in the work-log, including the
    expired-cookie response if one is seen.
- **I-9 Docs and setup** *(G)*.
  - The README tool table is generated from the registry.
  - No stale PoE1 docs remain.
  - From a fresh clone, `mise run setup` plus the documented `claude mcp add` command yields a
    server that lists its tools and loads the golden build. This is scripted where possible;
    otherwise it is a manual gate.
- **I-10 Gate** *(all)*. `mise run test` and a clean `pnpm build` pass with explicit exit codes.
  Coverage is reported, not gated.

## 8. Open questions

Q1–Q6 resolved 2026-10-03 (D-1, D-12, D-13, D-14, D-15, D-16). No open questions remain.

- **Q6 (D-16), resolved 2026-10-03 (HUMAN):** `POB_DIRECTORY` = the Windows PoB2 folder
  `/mnt/c/Users/parke/Documents/Path of Building (PoE2)/Builds`. The workflow is **collaborative
  editing**: the user and Claude both change builds, and the user tinkers with the results in
  Windows PoB2. The server reads and writes there (`lua_save_build` under the names given, snapshots
  in a `.pob-mcp/snapshots/` subfolder).
