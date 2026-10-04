# Stabilization epic: build work-log

Dated build narrative: what was built, decisions and deviations with their rationale, and gate
evidence (commands, exit codes, key numbers). Only the integration worktree writes to it. The handoff
is `build-handoff.md`.

## 2026-10-04: build start

- Spec ratified by the user, including every PROPOSED decision.
- User directive: build the full spec (WU-02…19, WU-22, WU-23) with no intermediate human testing.
  The user runs the live smoke test and final acceptance (WU-20, WU-21) at the end.
- Integration worktree `/home/parker/projects/pob2-mcp-wt/build`, branch `stabilization/build`, off
  `fd289ba`. Commit signing is off in this worktree only (D-48).
- Wave plan:
  1. WU-02 → WU-03 → WU-04.
  2. Three lanes, then rebase-merge in DAG order:
     - build lane: WU-05 → 06 → 07 → 08;
     - trade lane: WU-14 → 15;
     - lua lane: WU-16, starting after WU-07.
  3. Three lanes, then merge:
     - files lane: WU-22;
     - a3 lane: WU-09 → 10 → 11;
     - trade lane: WU-17 → 23.
  4. WU-12 → 13 → 18 → 19, then the final gate and a whole-branch review.

## 2026-10-04: wave 1 (WU-02…WU-04) gate fix

- **Gate failure.** The first W1 gate at `fa9cdbe` failed 4 tests in 3 static suites: the
  deleted-plumbing check (AC-F19), the PoE1-cruft scan (AC-F20) and the dead-module scan (AC-F21).
  Root cause: WU-04's commit removed the D-4 tools from the surface, but none of the module files
  were deleted. This was not a WU-02 or WU-03 regression; the gate was green at `fb9881d`
  (34/34 suites, 346 tests).
- **Fix.** `git rm` of the 15 modules WU-04 lists, which stop being referenced, plus
  `src/types/optimization.ts`. That file is not in the spec's list, but nothing imports it once the
  others are gone (AC-F21). Also removed the unit tests of the deleted crafting modules
  (`craftingAdvisorHandler`, `craftingDataService`). Dropped the
  `handlers/advancedOptimizationHandlers.ts` entry from `tests/unit/pathTraversal.test.ts`, because
  the file it checks no longer exists.
- **Decision: `src/services/costBenefitAnalyzer.ts` is kept (deviation from WU-04's delete list).**
  WU-04 deletes the "modules that become unreferenced". This one does not become unreferenced:
  `formatSearchResults` in `src/handlers/tradeHandlers.ts` (import at line 6, use at line 369)
  ranks the kept `search_trade_items` results with it. Deleting it would change a kept tool's
  output, which is the trade lane's job (WU-15 rewrites `search_trade_items`). The AC-F19 test's
  `DELETED_MODULES` list leaves it out for this reason. WU-15 decides whether it survives.
  The AC-F21 dead-module scan keeps it honest: if WU-15 stops importing it, the scan goes red until
  the file is deleted.
- **Gate evidence at the fix commit:** clean tree (`rm -rf build coverage`, `jest --clearCache`).
  `mise run test` rc 0, with 37/37 suites and 366/366 tests. `pnpm build` rc 0.
- **WU-02/WU-03 script checks from the W1 verifier (exit codes):**
  - AC-F1:
    - the HeadlessWrapper sha1 with CRLF normalization, and `pob-pin.json` equal to the C-6
      literal: 0.
  - AC-F2:
    - a fresh `pob:fetch` gives `7d6f530`: 0;
    - a second `pob:fetch` makes no network command: 0.
  - AC-F5: `rg POB_FORK_PATH src/` matches only `src/engine/pobPath.ts`: 0.
  - AC-F6: `check-construct.lua`: 0.
  - AC-F7:
    - `rg '\|' mise.toml` finds no match (pass): 1;
    - the plugin pin checks out `bd4977e`: 0;
    - a fresh clone runs `mise run setup`: 0.
    - A full `mise install` in a scratch data dir was not run, because it needs hosts outside the
      allowlist.
  - AC-F8:
    - `pnpm why zod` shows a single version: 0;
    - no `@types/chokidar` or `@types/node-fetch` (pass): 1;
    - no `coverageThreshold` (pass): 1;
    - `pnpm install --frozen-lockfile`: 0;
    - `jest --coverage` without the 3 WU-04 suites: 0.
  - AC-F9:
    - `mise run test` at `fb9881d`: 0;
    - with an injected failing test, `mise run test` gives 1 and `jest` gives 1, so the exit codes
      match.
  - AC-F14: no removed env flags in `src/` (pass): 1.
  - AC-F17:
    - vendor missing: 1;
    - `POB_SKIP_ENGINE=1`: 0, with the suite skipped;
    - luajit missing: 1;
    - no `if (!ready) return` (pass): 1.
- **Non-gating.** Jest still prints "A worker process has failed to exit gracefully" in the full
  run. `jest --detectOpenHandles` on the new in-process suites (`tests/mcp/deletedTools`,
  `tests/mcp/toolSet`) reports no open handle, so the leak is somewhere else. It is left for a later
  unit.

## 2026-10-04: wave 1 (WU-02…WU-04) second gate fix: the LuaJIT plugin pin

- **Gate failure (AC-F7, WU-02).** The W1 gate at `fee3d92` found that the `[plugins]` entry in
  `mise.toml`, which pins the LuaJIT asdf plugin revision (the C-19 developer entry points
  contract), had no effect. It was keyed `"asdf-mise-plugins-mise-lua-jit"`, the directory name of
  the plugin already installed on this box. mise 2026.5.15 looks up `[plugins]` pins by the tool's
  backend name, `"asdf:mise-plugins/mise-luaJIT"`, so in a fresh data dir it ignored the pin and
  cloned the plugin's default branch. The earlier AC-F7 check ("the plugin pin checks out
  `bd4977e`") passed only because upstream `master` is still `bd4977e`.
- **Fix.** `mise.toml` only: the `[plugins]` key is now `"asdf:mise-plugins/mise-luaJIT"`, the
  backend name exactly as written in `[tools]`. The value is unchanged
  (`https://github.com/mise-plugins/mise-luaJIT.git#bd4977ef2c2cfd0659a4bb39acb37bd5104fb7fc`).
  The comment now says the key must match the `[tools]` backend name, because any other key is
  ignored without a warning. No A-n assumption is needed, because the pin can be applied.
- **Pin-effectiveness probe** (scratch copies of `mise.toml`, each with a fresh `MISE_DATA_DIR`,
  `mise plugins install -a`, then `git rev-parse HEAD` in the installed plugin; GitHub only):
  - new key, SHA swapped to `62c0727d83242036f51af105eace53e274b02a74`: rc 0, HEAD = `62c0727…`.
    mise logs `check out 62c0727…`. The pin is honoured.
  - control, old key, the same swapped SHA: rc 0, HEAD = `bd4977e…`. The pin is ignored, which
    reproduces the gate failure.
  - new key, committed SHA `bd4977e…`: rc 0, HEAD = `bd4977e…`.
- **Existing data dir.** `mise ls` still resolves `asdf:mise-plugins/mise-luaJIT`
  `ref:2460b3ff…`, and `mise which luajit` is unchanged.
- **Gate evidence at the fix commit:** clean tree (`rm -rf build coverage`, `jest --clearCache`).
  `mise run test` rc 0, with 37/37 suites and 366/366 tests. `pnpm build` rc 0.
- **Still open for the coordinator.** The `costBenefitAnalyzer.ts` deviation (kept because the kept
  `search_trade_items` tool uses it) is recorded only in this work-log. It belongs in the spine or
  in WU-15's slice.

## 2026-10-04: W1 (WU-02..WU-04)

### WU-02: done (head ca872a0)

The PoB pin and fetch path are in place: `pob-pin.json` plus `scripts/fetch-pob.sh`, which does a sparse clone into the gitignored `vendor/`. New mise tasks: `pob:fetch`, `setup`, `build`, `test`. The LuaJIT plugin is pinned to its full SHA under `[plugins]`, `LUAROCKS_VERSION` moved to `install_env`, and `corepack enable` runs as a node postinstall. New code: `src/utils/packageRoot.ts`; `src/engine/pobPath.ts`, now the only reader of `POB_FORK_PATH`; `src/engine/pinCheck.ts` (`checkPin`), which runs before luajit spawns; and `pob-api/API/Util.lua` with `construct()`. Dependencies: zod and zod-to-json-schema added; `@types/chokidar`, `@types/node-fetch` and `coverageThreshold` removed. The bridge, `luaClientManager` and `treeService` now go through the resolvers, and the integration suite runs against `vendor/`.

Deviations:
- AC-F7: the full `mise install` was not run in a scratch MISE_DATA_DIR, because the plugin's install needs luajit.org and luarocks hosts, which the network rule doesn't allow. The pin was checked at the plugin-clone step instead (bd4977e, with an older-SHA control). (mise.toml:11-13)
- The `[plugins]` key uses the installed plugin name; the task comment has no literal pipe, so `rg '\|' mise.toml` stays empty.
- `construct()` returns the object in new-style constructors, because a constructor method may return nil. The pinned tag uses the old style, so it isn't affected.
- The pinCheck ok-memo is keyed by pobSrc + commit + version + wrapper sha1 + allowUnpinned, so an ok under allowUnpinned never satisfies a strict check.
- `luaClientManager` and `treeService` constructors take an optional `env` (default process.env), so `src/index.ts`, which WU-03 owns, didn't need editing.
- The missing-tree error says `mise run pob:fetch` and the bridge comments were reworded, because AC-F5 bans `POB_FORK_PATH` outside pobPath.ts.
- `tests/e2e/vendorTree.test.ts` builds its own C-18 safe env (spawnServer didn't exist yet), sets POB_LUA_ENABLED=true and skips under POB_SKIP_ENGINE=1.
- Added `tests/fixtures/items/ruby-ring.txt`, a synthetic ring that AC-F6 names but that didn't exist.
- `fetch-pob.sh` adds `mkdir -p vendor` before the clone.
- The fetch regression test lives in tests/unit (no network or engine needed; it runs under `pnpm test`).
- The early-exit status check uses `--untracked-files=no`, because untracked files never affect checkPin and runtime files would otherwise force a re-clone.
- The fixture git commits use the identity fixture/fixture@invalid with GIT_CONFIG_GLOBAL=/dev/null.

Review: 6 raw / 2 material / 2 confirmed.
- spec-1 [medium]: half of the AC-F7 plugin-pin check is unverified (the full install). Not fixed, since the network rule blocks it; the coordinator decides between approving the hosts and adding an A-n assumption.
- correctness-1 [medium]: `fetch-pob.sh` exits early whenever HEAD matches, so a vendor/ that is interrupted, partial or locally edited is accepted with exit 0, and the `pob:fetch` hint does nothing.

Gate: 1 attempt; clean gate `mise run test` rc 0, `pnpm build` rc 0; 23/23 suites, 303/303 tests, 0 skipped. Script checks:
- AC-F2 fresh fetch rc 0 (HEAD 7d6f530); second run offline rc 0 (local git only)
- AC-F5 `rg POB_FORK_PATH src/` rc 0 (pobPath.ts only)
- AC-F6 check-construct.lua rc 0
- AC-F7 `rg '\|' mise.toml` rc 1 (no match = pass); scratch plugin install rc 0, plugin HEAD bd4977e (node not installed); SHA-swap control rc 0 (1dd9284); fresh clone `mise run setup` rc 0
- AC-F8 deps and `pnpm why zod` rc 0; `pnpm install --frozen-lockfile` rc 0; `grep coverageThreshold` rc 1 (pass); `jest --coverage` rc 0
- AC-F9 `mise run test` rc 0; fresh clone without vendor/ rc 0 (pob:fetch ran first); injected failure gives rc 1 from both `mise run test` and jest

Tooling false-failures: none.

### WU-03: done (head fb9881d)

Server factory (C-7): `createServer.ts` does no I/O when it is constructed, and `src/index.ts` is the only code that reads env or touches the process. Closing stdin shuts down the watcher and luajit, then exits 0. The injected fetch, spawn, env and state dir are threaded through. Error surface (C-1, D-27): handler errors become `isError`, unknown or disabled tools get -32602, and the six error-as-success paths now throw. Tool registry (C-8): listing and routing go by tool group, the old enable flags are gone, and trade stats load lazily, once. The C-18 test harness is complete, and the bridge integration suite runs on `engineDescribe`.

Deviations:
- `pobLuaBridge.stop()` writes quit, waits up to 2 s, then sends SIGKILL; it also gained a `pid()` getter. The JEST_WORKER_ID hack was removed, and the child env drops POESESSID/POE_SESSION_ID (D-28). Needed for C-7 shutdown and AC-F12.
- treeService's `= process.env` default was removed, for AC-F11 and C-7.
- A pobPath.ts comment containing `process.env` was reworded, for AC-F11's text match.
- toolSchemas.ts: 7 'REQUIRES: POE_TRADE_ENABLED' sentences and 1 doc comment were removed, for AC-F14.
- luaHandlers: `luaEnabled` replaced by `fetch`; import_build passes the injected fetch to `resolveBuildXml` (C-7).
- get_nearby_nodes throws only when none of the build's allocated nodes exist (that is how "invalid node" was read).
- The three spec paths throw on an empty list; a successful delete_spec is now isError until WU-09 fixes the reply shape.
- `entryDefaults` stays in `src/index.ts`; `main()` runs only when JEST_WORKER_ID is unset, and spawnServer strips that variable.
- The lazy trade-stats preload runs before every trade tool except get_leagues. It has a 15 s timeout with a static fallback and is memoized even on failure (D-40).
- analyze_cluster_jewels and find_resistance_gear have no TOOL_META entry, so they return -32602. Groups follow the schema groups; tools WU-04 deletes are marked `mutate`.
- `Credentials` type is defined in createServer.ts for now (C-9 moves it in WU-14). EngineSession is an interim interface. POE_RATE_LIMIT_PER_SECOND and POE_CACHE_TTL are honoured via the injected env until WU-14.
- tradeClient's cookie comes from `deps.credentials().sessionId`; the stub returns null until WU-14.
- Truncation skips isError results; TRUNCATED_TOOLS lives in createServer.ts.
- AC-F16(f) uses `execFileSync`, which AC-F28's scan doesn't cover, because it needs an env-less child.
- tests/setup/global.ts maps `./x.js` to `./x.ts` during the globalSetup probe and captures bridge stderr.
- Existing tests were updated for the changed code or spec (bridge stop/SIGKILL, banner mock, buildHandlers throw, context and constructor changes, the mock exits on quit). None was weakened or deleted.

Review: 17 raw / 6 material / 1 confirmed.
- safety-1 [medium]: the cookie-scrub assertions in tests/mcp/harness.test.ts and tests/e2e/tradeDisabled.test.ts print the cookie value when they fail, which can leak a real session cookie into the logs. Not listed under not_fixed.

Gate: 1 attempt; clean gate `mise run test` rc 0, `pnpm build` rc 0; 34/34 suites, 346/346 tests, 0 skipped; the engine probe passed. Script checks:
- AC-F17 POB_FORK_PATH=/nonexistent rc 1 (prints the cause); POB_SKIP_ENGINE=1 rc 0 (7 tests skipped); no luajit on PATH rc 1 ('luajit not found'); `rg 'if (!ready) return'` rc 1 (pass)
- AC-F14 rg for the old flags in src/ rc 1 (pass)
- Clean gate rc 0

Out of scope (all implied or allowed): pobPath.ts comment, treeService default, toolSchemas text, luaHandlers context, updated tests and mocks.

Tooling false-failures: none.

### WU-04: blocked

The Claude Code permission classifier refused `git rm` of the 16 modules and 2 unit tests ('Irreversible Local Destruction') and said not to pursue the deletion by other means. That left AC-F19, AC-F20 and AC-F21 red: `mise run test` rc 1 with 4 failing tests, all caused by those files. The fix was for the user or coordinator to run the git rm, or to allow it.

### Merges

None recorded in the wave data.

### Wave gate: PASS (head ed1a25b)

- Fixes: fee3d92 deleted the WU-04-listed modules, which turns AC-F19, AC-F20 and AC-F21 green. ed1a25b re-keyed `[plugins]` to the backend name `asdf:mise-plugins/mise-luaJIT`, so the AC-F7 pin now takes effect (shown by the SHA-swap control).
- Clean gate: `mise run test` rc 0, `pnpm build` rc 0; 37/37 suites, 366/366 tests, 0 skipped. The engine suites ran against vendor/: poe2Bridge 7/7, vendorTree, stdinEof, errorSurface. The baseline at fd289ba was 17 files and 274 cases (267 passed, 7 skipped).
- Dropped tests, 22 in total and all sanctioned by the spec: craftingAdvisorHandler (7), craftingDataService (8), buildService bandit/cluster parsing (5), contextBuilder deleted contexts (2). Also the pathTraversal entry for advancedOptimizationHandlers.ts. The only describe.skip added is the engineDescribe POB_SKIP_ENGINE path.
- Fresh scratch clone with one injected failure: 37 passed + 1 failed suites, 366 + 1 failed tests.
- Script checks:
  - AC-F1: pin literal rc 0; HeadlessWrapper sha1 rc 0
  - AC-F2: fresh fetch rc 0 (HEAD 7d6f530); offline second run rc 0
  - AC-F5: rc 0 (pobPath.ts only)
  - AC-F6: rc 0
  - AC-F7: rg pipe rc 1 (pass); `mise plugins install -a` rc 0 (HEAD bd4977e); control rc 0 (62c0727); fresh clone setup rc 0
  - AC-F8: `pnpm why zod` rc 0; deps grep rc 0; coverageThreshold rc 1 (pass); frozen install rc 0; `jest --coverage` rc 0 (37/366)
  - AC-F9: rc 0; injected failure rc 1 from both `mise run test` and jest
  - AC-F11: rc 0 (index.ts only)
  - AC-F14: rc 1 (pass)
  - AC-F17: /nonexistent rc 1; SKIP rc 0 (7 skipped); no luajit rc 1; ready-guard rg rc 1 (pass)
  - AC-F19: cruft rg rc 1 (pass); masteryEffects rc 0 (only the setTree hit, which is WU-10 scope); find over modules rc 0 (15 absent)
- AC problems:
  - AC-F19: `src/services/costBenefitAnalyzer.ts` is kept, because the kept search_trade_items tool uses it (tradeHandlers.ts:6/369). This needs an entry in the spine or in WU-15's slice.
  - AC-F7: the full `mise install` is still unverified because of the network allowlist; the pin was verified with `mise plugins install -a` plus the SHA-swap control.
  - AC-F6/F7/F8/F9 are script-only by design; AC-F2 is also covered by tests/unit/fetchPob.test.ts; AC-F17 also has meta-tests in tests/unit/engineDescribe.test.ts.

### Friction

- luajit isn't on PATH in the agent Bash tool (mise isn't activated there); use `mise exec --` or `mise run`.
- The Write tool refused to overwrite mise.toml before a Read (resolved).
- Jest globalSetup bypasses moduleNameMapper, so `.js` imports from src failed (worked around in tests/setup/global.ts).
- `tsc -p tsconfig.test.json` reports TS6059 rootDir errors on every test file (pre-existing; passes with `--rootDir .`).
- Jest warns 'A worker process has failed to exit gracefully' (pre-existing; all suites pass).
- The permission classifier blocked `git rm` for WU-04's deletions, which blocked the unit.
