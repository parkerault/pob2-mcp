# pob2-mcp stabilization — change vision

Status: **DRAFT for human ratification** (Phase 2 of the build method). Input to `spec-formalizer`
(brownfield tier). Ground truth for every defect referenced here is
[`recon.md`](recon.md) — IDs like **E2** point at its tables.

Legend: **HUMAN** = decided by the user · **PROPOSED** = coordinator's recommendation, overridable ·
**DECIDE** = needs a user answer before formalization.

---

## 1. Goal

Make pob2-mcp a **stable, PoE2-correct** MCP server whose answers come from PoB2's engine, with a
**trade capability for budget-constrained upgrade search**. Concretely:

1. The engine connection never silently loses, corrupts, or mis-attributes build state.
2. Every registered tool is PoE2-correct; PoE1-only tools are removed, not hidden.
3. Advice reports what PoB2 computes instead of re-deriving numbers with invented thresholds.
4. Trade: "find upgrades for slot X under budget Y, requiring stats Z, sorted by stat S" works
   end-to-end, mirroring PoB2's own trade UI.
5. A test suite that fails loudly when any of the above regresses.

## 2. Non-goals

- New analysis features beyond what exists (no new boss model — PoB2 ships no PoE2 boss data).
- Changing the vendored-bridge architecture (vanilla PoB2 checkout + `pob-api/` stays).
- Building a GUI, hosting, or multi-user support.
- Crafting simulation (domain of craftofexile; PoB2 has no data for it).

## 3. Decisions

| ID | Decision | Status |
|---|---|---|
| D-1 | Work lands in **the user's own fork** `git@github.com:parkerault/pob2-mcp.git`. Done: `origin` → the fork, `upstream` → `zgrummons/pob2-mcp` (fork `main` == local `main` at `6442b0b`). | HUMAN |
| D-2 | **Pin PathOfBuilding-PoE2 to a release tag and upgrade deliberately.** Initial pin `v0.23.1` (commit `7d6f530`). Mechanism (revised after spike S-2 — a submodule fetches 1.55 GiB because git can't shallow-fetch a pinned SHA): committed **`pob-pin.json`** (repo, tag, commit, version, `HeadlessWrapper.lua` sha1) + **`scripts/fetch-pob.sh`** doing a sparse, blob-less, depth-1 clone into gitignored **`vendor/PathOfBuilding-PoE2`** (4.9 MiB download, 47 MB on disk, <5 s, idempotent), exposed as `mise run pob:fetch`. Default `POB_FORK_PATH` resolves to it from the package location (not cwd). **Pin check before spawn:** manifest `Version number` must equal the pin **and** the bridge-touched PoB files must match their sha1 in PoB's own `manifest.xml` (version alone can't detect drift — dev head is 108 commits past the tag and still says `0.23.1`); refuse to start with a `mise run pob:fetch` hint unless `POB_ALLOW_UNPINNED=true`. Upgrade = bump pin → fetch → golden tests → update recorded values. Exact script + check design: [S-2 report](spikes/S-2-pin-v0.23.1.md). | HUMAN (pin) / PROPOSED (mechanism, S-2 verified) |
| D-3 | **The engine is the source of truth.** Advice tools report engine-computed values (TotalEHP, PDR, MaximumHitTaken, unreserved Mana/Spirit, PoB's own warnings). Hard-coded life/DPS thresholds and rating bands are removed, not retuned. | PROPOSED |
| D-4 | **Delete** (code, schemas, routes, docs): cluster-jewel tools (3, incl. unlisted `analyze_cluster_jewels`), `suggest_watchers_eye`, `suggest_masteries`, `check_boss_readiness`, `optimize_skill_links`, `create_budget_build`, `suggest_optimal_nodes`, `optimize_tree`, `analyze_items`, `suggest_crafting`, the 6 legacy gem tools + `skillGemService`, `compare_trade_items`, `generate_shopping_list`, `find_resistance_gear`, the no-op `ToolGate`, `POB_LEGACY_GEM_TOOLS`. ~18 tools, several thousand lines. | PROPOSED (`suggest_crafting`: user deferred → delete) |
| D-5 | **Trade architecture:** query generation and candidate evaluation run **in Lua using PoB2's own `TradeQueryGenerator`/`TradeQuery`** driven headless, as new handlers in a new `pob-api/API/Trade.lua` (`trade_generate_query`, `trade_evaluate_items`, `trade_query_options` — shapes in [spike S-1](spikes/S-1-headless-trade-generator.md)); **HTTP, separate search/fetch rate limiters, auth, fitting the query to trade2's complexity budget, PoB's min-weight adjust loop, price normalization and caching stay in TypeScript.** S-1 verified generation (Body Armour 80 calcs / 2.3–3.1 s; Weapon 129 / ≤4.4 s) and evaluation (~25 ms/item, scores identical to PoB's `GetResultEvaluation`) headless with no PoB file changes. | PROPOSED (S-1 PASS for Lua path) |
| D-6 | **Trade tool surface.** New primary tool `find_upgrades`, inputs mirroring PoB2's trade dialog (S-1 mapping table): `slot`; **stats to sort by** = weighted engine stats from PoB's `powerStatList` (default FullDPS 1.0 + TotalEHP 0.5); **required stats** = up to 3 **trade-mod filters** (trade stat id + min, enforced by the trade server — *not* engine-stat thresholds); `max_price` + `currency`; `max_level`; `min_empty_rune_sockets`; include corrupted / mirrored; rune behaviour copy/keep/remove; trade status (instant buyout default); `league`. Output: listings ranked by engine score, per-stat engine deltas (sort stats + any requested report stats), price normalized to one currency, and the `trade2` URL. Companion `trade_query_options(slot)` lists valid sort stats and slot-eligible required mods. Kept and fixed: `search_trade_items`, `get_item_price`, `search_stats`, `get_leagues`. `find_item_upgrades` is folded into `find_upgrades`. Results cached by (build hash, slot, weights, options). | HUMAN (use case) / PROPOSED (shape) |
| D-7 | **Auth.** Plain search/price/fetch work anonymously. **Weighted-sum search — the core of `find_upgrades` — is rejected without login** (HTTP 400 "Query is too complex… Logging in will increase this limit", S-1/S-3). Strategy for that gap: see D-15. Errors 400/401/403/429 → actionable messages; bodies truncated; credentials never logged. Outbound User-Agent is one generic project UA constant — **never user identity**. | PROPOSED (amended after S-1/S-3) |
| D-8 | **Bridge protocol:** request IDs on every message, a FIFO queue (parallel tool calls serialize instead of failing), single-flight `ensureClient`, kill+restart on timeout, and after any restart either restore the last loaded build XML or return an explicit "engine restarted, build lost" error — never silent. All errors set `isError: true`. | PROPOSED |
| D-9 | **Writes go through the engine.** `export_build`/`save_tree` produce PoB2 XML via load → modify → engine save (`<PathOfBuilding2>` root), never hand-built XML. Overwrites require an explicit flag; backups stay on. | PROPOSED |
| D-10 | **TS↔Lua contract** is typed in one place and covered by contract tests run against the real engine (each Lua handler's reply shape = what the TS handler reads). | PROPOSED |
| D-11 | Currency normalized off poe.ninja's declared primary (`core.primary`, currently Divine); display in Divine/Exalted, never "chaos". Applies to `get_currency_rates`, `calculate_trading_profit`, trade output. `find_arbitrage` deleted (inert: the PoE2 feed has no buy/sell spread). | PROPOSED |
| D-12 | **Golden-build fixture:** commit a copy of the user's `Grenadator.xml` (Mercenary / Gemling Legionnaire, weapon swap, charms, 12 skill groups) under `tests/fixtures/builds/`. Additional fixtures for specific feature coverage (e.g. ES/CI, minions, a different weapon-set setup) may be sourced from public pobb.in builds via `import_build`. | HUMAN |
| D-13 | **Package manager: pnpm** (via corepack). Done: `pnpm import` from the npm lockfile (same resolved versions), `package-lock.json` + `bun.lock` removed, `packageManager: pnpm@11.6.0`, `mise.toml` pins `node = "24"`. pnpm's strict layout exposed an undeclared `@jest/globals` import → declared as a devDependency (29.7.0). Suite 274/274. | HUMAN |
| D-14 | **Trade on by default**, opt-out via `POE_TRADE_DISABLED=true` (mirrors `POE_NINJA_DISABLED`). `POE_TRADE_ENABLED` is removed. | HUMAN |
| D-15 | **Login-gate strategy for weighted search.** Options: (a) logged-in session — `POESESSID` cookie (untested whether it lifts the limit → spike S-4) supplied as a 1Password reference via `op run`, or GGG OAuth (what PoB uses; requires app registration with GGG); (b) PoB's "No Session Mode": return the exact weighted query as a `trade2/search/poe2/<league>?q=…` URL for the user's logged-in browser; (c) anonymous `count`/`and` prefilter + engine re-rank (verified live, but much weaker: first 10 cheap matches were all downgrades). Proposed: tiered — (a) when a session is configured, else (b) + (c) together. | DECIDE (Q5) |

## 4. Tool disposition after the epic

- **Keep as-is (verify only):** everything in recon §1's "works live" list.
- **Fix:** `lua_new_build`, spec/item-set tools, `lua_save_build` message, `lua_get_build_info`
  (tree version), `get_config`/`set_config`/`set_enemy_stats`/presets, `add_item`/`add_multiple_items`/
  `create_spec`, `lua_set_tree`/`update_tree_delta`, `toggle_flask` (Flask 1–2 + Charm 1–3),
  `add_gem` (reject unknown names with suggestions), `get_passive_upgrades` (real path cost),
  `plan_leveling` (class override), `analyze_skills`/`suggest_supports` (PoB's support-compatibility
  check, broader non-alphabetical pool), `analyze_build`/`compare_builds` (don't clobber the loaded
  build), `export_build`/`save_tree` (D-9), watch tools (subfolders; honest description), `import_build`
  (inflate limit, PoE2 root only), `get_currency_rates`/`calculate_trading_profit` (D-11).
- **Rewrite on engine data (D-3):** `validate_build` (one path), `analyze_defenses`, `get_build_issues`
  (+ load-summary "Top Issues").
- **Trade:** per D-6.
- **Delete:** per D-4.

## 5. Spikes (stop-gates — dependents wait on these)

| ID | Question | Pass criterion | Unblocks |
|---|---|---|---|
| S-1 | Can PoB2's `TradeQueryGenerator` run headless for a slot and yield (a) the trade2 query JSON with weighted stat group + max price, (b) engine-evaluated deltas for fetched items? What latency? | Produces a valid query for Grenadator's body armour slot that trade2 accepts; evaluating 10 fetched items returns per-stat deltas; latency recorded. | D-5 Lua path / trade units |
| S-2 | Does the vendored `pob-api/` work against tag `v0.23.1`? What differs between the tag and current dev head for the internals `BuildOps.lua` uses (`new()` syntax, `ImportFromNodeList`, ItemsTab slots)? | Golden smoke (load/stats/save) passes on the tag; diff of touched internals recorded. | D-2, all engine-op units |
| S-3 | Capture raw trade2 fetch payloads (normal, rune-socketed, corrupted, fractured items) as committed fixtures. | ≥4 fixtures; mod object shape confirmed (recon §5 marks it inferred). | trade client units |
| S-4 | Does a logged-in `POESESSID` lift trade2's weighted-query rejection? (Added after S-1/S-3.) | One weighted query from S-1's generator accepted with the cookie, or rejected → OAuth/URL path. | D-15, `find_upgrades` |

**Spike results (2026-10-03):** S-1 **PARTIAL** — headless generation + evaluation PASS; trade2
rejects weighted queries anonymously ([report](spikes/S-1-headless-trade-generator.md)). S-3 **PASS**
— 27 anonymized fixtures in `tests/fixtures/trade2/`; mod-shape and rate-limit facts folded into
recon §5 ([report](spikes/S-3-trade2-fixtures.md)). S-2 **PASS** — the vendored bridge works on
`v0.23.1`; the tag reproduces the stats saved by the user's PoB2 app exactly (TotalDPS 85,452.12 /
CombinedDPS 104,489.78; dev head drifts ~3.5%), so the pinned engine agrees with the user's app;
D-2 mechanism revised to pin file + sparse fetch script ([report](spikes/S-2-pin-v0.23.1.md)).

Consequences for the build: **target the tag, not dev head.** E3 (`new()` syntax) does not exist on
`v0.23.1` — the dev-style fix breaks the tag; use S-2's version-portable `construct()` helper so the
next pin bump (which crosses PoB's class-system rewrite) is cheap. Golden save tests compare stats /
normalized XML, never bytes (`SaveDB` attribute order is nondeterministic).

## 6. Dependency shape (input to the DAG; formalizer refines)

```
S-2 pin ──► A1 test harness (REQUIRE_ENGINE, golden build, MCP-level runner)
              │
              ▼
D-4 deletions ──► A2 bridge protocol (D-8) ──► A3 TS↔Lua contract (D-10, E7 stat export, E8 slots)
                                                   │
                     ┌─────────────────────────────┼──────────────────────┐
                     ▼                             ▼                      ▼
              B engine-op fixes            C advice rewrite (D-3)   T2 find_upgrades (D-5/D-6)
              (E2, E3, config, specs,                                    ▲
               export via engine D-9)                                    │
                                                         S-1 ───────────┤
S-3 fixtures ──► T1 trade client (mods, currency D-11, limiter, errors D-7, URLs, categories) ─┘
                                                         
all ──► G docs (README generated/checked against registry, delete stale docs/, CLAUDE.md)
```

- **Deletions go first:** they shrink `toolSchemas.ts` (1810 lines), `toolRouter.ts` (773) and
  `index.ts` — the shared files nearly every other unit touches. Contention, not logic, is the main
  serializer in this codebase.
- **Serialize** units editing `pob-api/API/BuildOps.lua`, `Handlers.lua`, `toolSchemas.ts`,
  `toolRouter.ts`; prefer new modules (e.g. a new `src/trade/` and a new Lua `API/Trade.lua`) over
  growing shared ones.
- **Parallel lanes:** T1 (trade client) is independent of A/B/C; S-1 and S-3 can run immediately.

## 7. Definition of done (named invariants — each needs its own test)

- **I-1 Golden build:** loading the fixture yields stats equal to recorded values; a no-op tree delta
  leaves Str/Dex/Int/Life/CombinedDPS unchanged; save → reload yields identical stats and
  semantically equal XML (normalized — `SaveDB` ordering is nondeterministic); `export_build` output
  loads in the engine as the same class/level/stats. On the pinned tag, the fixture's engine stats
  equal the `<PlayerStat>` values stored in the file (S-2 showed 103/104 match).
- **I-2 Bridge robustness:** timeout-then-call returns the right reply; 4 parallel calls all succeed;
  a forced Lua crash yields restore-or-explicit-error; bad load followed by good load works; server
  exits on stdin EOF and reaps luajit.
- **I-3 Contract:** every Lua handler reply matches the TS-declared shape (run against the real
  engine).
- **I-4 Tool hygiene:** every registered tool is exercised at MCP level; outputs never contain
  `undefined`, `NaN`, `[object Object]`; failures set `isError`.
- **I-5 No PoE1 cruft:** a banned-term test over tool schemas and outputs (e.g. Bandit, Pantheon,
  Shaper, spell suppression, Watcher's Eye, Cluster Jewel, mastery, 6-link, Awakened, Guardian,
  Chaos Orb equivalent).
- **I-6 Engine-required CI:** the integration suite **fails** (not skips) when the PoB2 checkout is
  present but the bridge cannot start.
- **I-7 Pin:** startup refuses a PoB2 version other than the pinned tag (unless overridden).
- **I-8 Trade:** with recorded fixtures, `find_upgrades` returns only listings ≤ budget, satisfying
  every required stat, sorted by the engine delta of `sort_by`, prices in one currency, with a valid
  `trade2` URL; 401/403/429 produce actionable messages; no request carries user identity. One
  manual live smoke recorded in the work-log.
- **I-9 Docs:** README's tool table matches the registered tool list (test-enforced); no stale PoE1
  docs remain; setup instructions reproduce a working install on a clean Linux box.
- **I-10 Gate:** clean build + full suite + coverage thresholds pass, explicit exit codes.

## 8. Open questions

Q1–Q4 resolved 2026-10-03 as D-1, D-12, D-13, D-14. Spike outcomes (§5) may reopen D-2 (pin
mechanism).

- **Q5 (D-15) Weighted search behind login.** Pick the strategy, and whether to run spike **S-4**:
  one weighted query sent with the user's own `POESESSID` (resolved from 1Password via `op run`,
  never written to disk) to learn whether the cookie lifts trade2's complexity limit.
