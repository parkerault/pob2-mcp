# pob2-mcp stabilization: spec spine

**Status:** v2, revised after the adversarial spec review on 2026-10-03. That review had 8 lenses,
which raised 107 raw findings; these were merged into 52 clusters, and every cluster was
skeptic-verified. See [`../review-spec.md`](../review-spec.md). This version is pending the user's
ratification.

**Inputs:**
- the ratified [vision v2](../vision.md);
- [recon](../recon.md), the audit of the existing system;
- the [spikes](../spikes/);
- the [gap analysis](../formalization-gaps.md), with every gap resolved;
- the [grounding fact sheets](../grounding/).

This spine is the **single source of truth** for everything shared between slices:
- the interface contracts (`C-n`);
- the decision log (`D-n`);
- the autonomy envelope (assumptions `A-n`, human-decision gates `HG-n`);
- the milestones (`M-n`) and the full work-unit graph (`WU-nn`);
- the guardrails, the risk register (`R-n`) and the test strategy.

Each slice spec carries its own functional requirements, acceptance criteria and work-unit blocks. When a
slice spec and this spine disagree, **the spine wins**. Fold any fix back here.

| Slice spec | Scope | Work units | AC prefix |
|---|---|---|---|
| [01-foundation.md](01-foundation.md) | Fixtures, PoB pin and toolchain, server factory, test harness, deletions, golden and hygiene tests | WU-01…WU-05 | AC-F |
| [02-engine.md](02-engine.md) | Engine wire protocol v2, bridge client, engine session (lock, revision, recovery, disk-change policy), build-file writer and state dir, TS↔Lua contract schemas, engine-op fixes | WU-06…WU-13, WU-22 | AC-E |
| [03-trade.md](03-trade.md) | Credentials, trade HTTP client, rate limiter, currency, kept trade tools, Lua trade actions, `find_upgrades`, `trade_query_options` | WU-14…WU-17, WU-23 | AC-T |
| [04-advice-docs.md](04-advice-docs.md) | Advice tools on engine data, docs and setup, human acceptance | WU-18…WU-21 | AC-A, AC-G |

**Reading rule for build agents.** Read this spine, then your work unit's slice spec. Cite IDs in commits
and work-logs. If your unit needs something no contract or decision settles, it is either covered by a
proceed-on assumption (§7.2) or it is a human-decision gate (§7.3). Never invent a third category.

---

## 1. Problem and goals

The goals and non-goals are in [vision §1–2](../vision.md). In short, make pob2-mcp a stable,
PoE2-correct MCP server:

| Goal | Statement | Proven by |
|---|---|---|
| G-1 | The engine connection never silently loses, corrupts or mis-attributes build state | AC-E5…AC-E23, AC-E46, AC-E55…AC-E64 |
| G-2 | Every registered tool is PoE2-correct; PoE1-only tools are removed | AC-F18…AC-F22, AC-F25, AC-G6 |
| G-3 | Advice reports what PoB2 computes: every judgment is a PoB warning or a comparison of engine outputs | AC-A1…AC-A6 |
| G-4 | `find_upgrades` (slot, budget, required mods, weighted sort stats) works end to end and returns actionable results | AC-T1…AC-T45, WU-20 |
| G-5 | A local gate fails loudly on any regression, including when the engine can't run | AC-F9, AC-F17, AC-F23…AC-F26 |

**Out of scope** (do not build):
- PoB's unique-jewel trade rows: deferred by the user (HUMAN) to a follow-up epic once the core is stable;
- multi-slot budget optimisation;
- crafting simulation;
- new analysis features;
- hosted CI;
- a PoB pin bump;
- MCP `structuredContent`/`outputSchema` (D-36);
- an SDK upgrade.

## 2. Existing system context (shared)

Detail and citations are in [grounding/ctx-ts.md](../grounding/ctx-ts.md) and
[grounding/ctx-lua.md](../grounding/ctx-lua.md). Each slice spec repeats the parts it touches.

### 2.1 Components in scope

| Component | Location | Today |
|---|---|---|
| Server entry + class | `src/index.ts` (404 lines) | Low-level SDK `Server` (1.20.2). **Instantiates itself at import** (`:403-404`). Fetches trade2 `/data/stats` before `connect()` when trade is on. Installs process listeners in its constructor. No stdin-EOF handling. Ignores the MCP request `extra` |
| Tool schemas | `src/server/toolSchemas.ts` (1810) | 10 `get*ToolSchemas()` groups of JSON-Schema literals. 98 registered tools; listing is gated by env flags in `index.ts` |
| Router | `src/server/toolRouter.ts` (773) | `routeToolCall(name,args,deps)`: one `switch` over 100 names. It builds 8 contexts eagerly on every call. Routing ignores registration |
| Engine manager | `src/server/luaClientManager.ts` (104) | Lazy `ensureClient` (not single-flight). Silent restart. Its readiness probe loads a PoE1-root XML |
| Bridge client | `src/pobLuaBridge.ts` (555) | Spawns luajit with the global `spawn`. Request `{action,params}`, no ids. A per-line timeout that doesn't kill the process. 38 methods |
| Handlers | `src/handlers/*.ts` (22 files) | `handle*` functions wrapped in `wrapHandler`. Return `{content:[{type:"text",text}]}`. Throw on error. At least 7 paths return error text as success |
| Services | `src/services/*.ts` (15) | Build parsing and cache (60 s TTL, keyed by the name as passed), tree data, trade client (Bottleneck, global `fetch`), poe.ninja client (global `fetch`), export/snapshot, watcher (chokidar 4.0.3), … |
| Utils | `src/utils/*.ts` | `contextBuilder.ts`, `errorHandling.ts` (`wrapHandler`), `pathSanitizer.ts` (`sanitizeBuildName`), `buildCode.ts` (global `fetch`, browser-like UA) |
| Lua bridge | `pob-api/bootstrap.lua`, `pob-api/API/{Server,Handlers,BuildOps}.lua` | Vanilla PoB2 via `HeadlessWrapper.lua`. Newline JSON over stdio. 39 handlers + `quit`. Encoding happens outside `pcall` |
| PoB2 engine | sibling dev-head checkout, via `POB_FORK_PATH` | **Not pinned** today. The default `~/Projects/PathOfBuilding-PoE2/src` doesn't exist on this box |
| Tests | `tests/**`, `jest.config.cjs`, `tsconfig.test.json` | 274 tests in 17 suites (4 at the `tests/` root). ts-jest compiles `src` as CommonJS. The integration suite passes with no assertions when the engine is absent (E10). There are coverage thresholds but no setup files |
| Toolchain | `mise.toml`, `package.json`, `pnpm-lock.yaml` | mise: LuaJIT ref `2460b3ff` + luautf8, Node 24. pnpm 11.6.0. No mise tasks |

### 2.2 Conventions every unit follows

- **Modules.** ESM TypeScript, Node16. Relative imports end in `.js`. `import type` for types. Default
  imports for Node built-ins. **No `import.meta`, `__dirname` or top-level await in `src/`**, because Jest
  compiles `src` as CommonJS (TS1343). New helpers go in the existing **`src/utils/`** directory.
- **Tools.** A tool is a JSON-Schema literal in `toolSchemas.ts`, a `case` in `toolRouter.ts`, and
  `handle<Pascal>(context, …)` in `src/handlers/<area>Handlers.ts`, wrapped with
  `wrapHandler('<verb phrase>', …)`. Handlers fail by **throwing**.
- **Output and logging.** Output is plain text with `===` headers. Log only to stderr, as
  `console.error('[Component] …')`. **stdout is reserved for MCP.**
- **Paths and env.** Paths under the builds dir go through `sanitizeBuildName(name, baseDir)` and, for
  writes and session keys, `canonicalBuildPath` (D-52). Env is read only in `src/index.ts`; everything
  else gets it through `deps.env` (C-7).
- **Lua.** `local M = {} … return M`. BuildOps returns `value` or `nil, '<lowercase message>'`, and
  Handlers maps that to `{ok=false,error}` / `{ok=true,<key>=…}`. Newer handlers use the key `result`.
  Actions are snake_case and params camelCase. `pob-api/` uses two-space indentation.
- **Tests.** Tests live under `tests/` (`unit/`, `mcp/`, `integration/`, `e2e/`, `static/`; four legacy
  suites sit at the root) and import from `@jest/globals`.

### 2.3 Existing state in scope (as it is today)

| State | Location today | Disposition |
|---|---|---|
| User builds | `POB_DIRECTORY` (this user: `/mnt/c/Users/parke/Documents/Path of Building (PoE2)/Builds`, Windows drvfs, **case-insensitive**) | System of record. The server writes there only via C-17 |
| Snapshots, `save_tree` backups, exports | `<POB_DIRECTORY>/.pob-mcp/{snapshots,exports}/` (`.xml` + `_metadata.json`) | **Moves** to the state dir, C-16 (D-18), in WU-22 |
| Config presets | `<POB_DIRECTORY>/.pob-mcp-presets/<name>.json` | **Moves** to the state dir, C-16 (D-18), in WU-22 |
| Engine build state | inside luajit, lost on restart | Snapshot after each change; restore on restart (C-3) |
| Caches | build parse 60 s/20 (name-keyed); tree data ∞; trade cache (unbounded, ignores TTL); poe.ninja 5 min | Build parse cache validated by size+mtime (D-58); trade per C-10; poe.ninja per C-12 |

### 2.4 Prior decisions in scope

[Vision](../vision.md) D-1…D-17 are ratified and are recorded below in §6, with the refinements
formalization made. The user's answers during formalization are D-18, D-19 and D-20. D-21 onwards are
coordinator decisions (PROPOSED) from formalization and the spec review. D-61 is a user decision made
during the build. D-62 onwards fold the build's recorded deviations back into the spec (PROPOSED (build)).

---

## 3. Interface contracts (catalog)

Status tags: **existing** (unchanged and relied on), **modified** (with the delta), **new**. The
"Defined in" column names the slice spec that carries the full detail. The summaries here are binding.

| ID | Boundary | Status | Defined in | Summary |
|---|---|---|---|---|
| C-1 | MCP tool surface (host ↔ server) | modified | 01 §C-1 | stdio JSON-RPC via SDK 1.20.2 low-level `Server`; protocol 2025-06-18.<br>• **Errors:** every error a tool handler produces → `isError: true` result. Unknown tool → JSON-RPC −32602 whose message **contains** `Unknown tool: <name>`.<br>• Server `version` = `package.json` version.<br>• Text content only.<br>• Descriptions ≤ 2048 chars.<br>• **Router signature:** `routeToolCall(name, args, deps, call: {signal, progressToken?, sendProgress, arrivedAt})` carries the MCP `extra`.<br>• **Truncation:** a 5000-char truncation list survives for today's tools minus deleted ones; `find_upgrades`/`trade_query_options` are not on it.<br>• **Tool set:** equals the §4 disposition table ([vision §4](../vision.md)), **76 tools** after the epic |
| C-2 | Engine wire protocol v2 (TS ↔ luajit stdio) | modified | 02 §C-2 | One JSON object per line.<br>• **Request:** `{id:uint, action, params?}`.<br>• **Reply:** `{id, ok:true, …payload}` or `{id, ok:false, error, code}`.<br>• **Codes:** `FAILED, EXCEPTION, ENCODE, UNKNOWN_ACTION, INVALID_JSON, LOAD_FAILED`.<br>• Encoding happens inside the `pcall`.<br>• **Banner:** first line, no id, `apiVersion:"2.0.0"`.<br>• **Test actions** `__test_sleep`, `__test_crash`, `__test_cycle`, `__test_state`, `__test_eval` exist only with `POB_API_TEST_ACTIONS=1`.<br>• **Removed:** dev-mode autosave is off, and the Lua `save_build` action is gone (D-60)<br>**Refined by D-65** (stricter load post-check, `keepLevel`). |
| C-3 | Engine session (router ↔ engine) | new | 02 §C-3 | `session.run({tool, kind, signal, deadline}, fn)`, in this order:<br>• one FIFO mutex per tool call;<br>• the **only** place the engine is started (D-59), with the pin check;<br>• crash restore of a snapshot taken after every change (`isError` if none, D-8);<br>• the disk-change check, whose auto-reload is its own sub-step (D-19);<br>• revision++ and a snapshot after each successful change.<br>It exposes `revision`, `loaded` (canonical path, fingerprint of the loaded bytes, revisions; never null while an engine runs), `isDirty()`, and the test hooks `onEvent()` and `enginePid()`<br>**Refined by D-67; amended by D-85** (a call's deadline also bounds the engine start, crash restore and disk-change reload). |
| C-4 | Bridge client API (TS) | modified | 02 §C-4 | `PoBLuaApiClient.request(action, params, {timeoutMs, signal})`:<br>• id-matched;<br>• timeout counted from the stdin write;<br>• kill on timeout;<br>• **never spawns** (only `start()` does);<br>• child env = `deps.env` minus cookies;<br>• `spawn` is injectable;<br>• every reply is validated against C-5<br>**Refined by D-63, D-66.** |
| C-5 | Lua action reply schemas | new | 02 §C-5 | One zod v3 schema per action in `src/engine/schemas.ts` (not for `__test_*`). Types are inferred with `z.infer`. They tolerate dkjson quirks (`{}`→`[]`, NaN→`null`) |
| C-6 | PoB pin | new | 01 §C-6 | `pob-pin.json` `{repo, tag, commit, version, headlessWrapperSha1}`; `scripts/fetch-pob.sh`; `src/utils/packageRoot.ts`; `src/engine/pobPath.ts` (`resolvePobSrc`); `src/engine/pinCheck.ts` (`checkPin`, which memoizes success only); `pob-api/API/Util.lua` `construct()` |
| C-7 | Server factory | new | 01 §C-7 | `createServer(deps: ServerDeps) → {server, engine, shutdown()}` in `src/server/createServer.ts`.<br>• No I/O at construction.<br>• `deps.fetch` and `deps.spawn` are threaded into every client.<br>• `src/index.ts` is the only module that reads `process.env`, installs process listeners and connects stdio |
| C-8 | Tool registry metadata | new | 01 §C-8 | `src/server/toolMeta.ts`: `TOOL_META[name] = {engine:'none'\|'read'\|'mutate'\|'load'\|'lifecycle', group:'core'\|'trade'\|'ninja'}`, with an explicit kind table (01 §C-8). The router wraps engine tools in C-3 by kind |
| C-9 | Credentials | new | 03 §C-9 | `createCredentialGetter({env, dotenvPath})() → {sessionId: string\|null, source, problem?: 'op-reference'\|'malformed'}`.<br>• Re-read on every call.<br>• Precedence: process `POESESSID` > process `POE_SESSION_ID` > `.env` `POESESSID` > `.env` `POE_SESSION_ID`.<br>• BOM stripped.<br>• Values outside the cookie-octet set count as malformed and are never echoed |
| C-10 | Trade HTTP client | modified | 03 §C-10 | `search(league, query, {auth, signal, deadline})`, `fetch(ids≤10, queryId, {auth, signal, deadline})`, `getStats()`, `getLeagues()`.<br>• The cookie goes only on search/fetch, and only when `auth`.<br>• One User-Agent (D-25).<br>• Per-request timeout `min(15 s, deadline − now)` from a `setTimeout`-driven controller.<br>• Classification: the caller's abort is rethrown; then timeout; then `TypeError` → network.<br>• `TradeError.kind` adds `invalid_query`; D-24 applies only to weighted queries.<br>• Only `/data/*` is cached |
| C-11 | Rate limiter | new | 03 §C-11 | Per server policy:<br>• parses `X-Rate-Limit-Policy/-Rules/-<rule>/-<rule>-State` case-insensitively;<br>• margin 1 (PoB);<br>• adopts server state;<br>• the first request per endpoint class is serialized, and any outcome releases it;<br>• a response with no policy name goes to the class's last policy or `class:<endpoint>`;<br>• an active penalty means `locked_out`;<br>• a wait past the deadline or past `maxWaitMs` (default 30 s) means `would_wait`<br>**Amended by D-87** (no send after a wait with < 1 s before the deadline). |
| C-12 | Currency service | modified | 03 §C-12 | `getRates(league)` → `Rates` or `null`. `convert(amount, from, to, rates)`.<br>• Reads `core.primary` from each response (D-33).<br>• Joins on the trade currency id.<br>• Caches 60 min with `If-None-Match` (documented by poe.ninja) |
| C-13 | Lua trade actions | new | 03 §C-13 | `trade_generate_query`, `trade_evaluate_items`, `trade_query_options` in `pob-api/API/Trade.lua`, registered by one line in `Handlers.lua`.<br>• Replies carry numbers, strings and booleans only.<br>• Canonical mod order before `FinishQuery` (D-55).<br>• `baselineScore` is the item-path score of the unchanged build (D-57).<br>• Items are evaluated one by one in `pcall`<br>**Amended by D-84** (`trade_generate_query` gains optional `reportStats`). |
| C-14 | `find_upgrades` tool I/O | new | 03 §C-14 | Inputs mirror PoB's trade dialog (D-6, D-37), with `limit` ≤ 20.<br>• **Flow:** the no-session fallback runs before any network call when the league is known (D-49); the deadline runs from arrival (D-22).<br>• **Output:** budget of 30,000 characters (D-53).<br>• The output format is fixed in 03 §C-14 |
| C-15 | `trade_query_options` tool I/O | new | 03 §C-15 | slot → sort stats (`*TakenHit` excluded, D-57), saved weights, required-mod choices (sorted by trade id), currencies, statuses, which options the slot shows |
| C-16 | State directory | new | 02 §C-16 | `${XDG_STATE_HOME:-~/.local/state}/pob2-mcp/` with `snapshots/`, `backups/`, `exports/`, `presets/`. Same file formats as today; it replaces `<POB_DIRECTORY>/.pob-mcp*`. Delivered by WU-22 |
| C-17 | Build-file write rules | new | 02 §C-17 | Every write into `POB_DIRECTORY` goes through `buildFileWriter`:<br>• **Target:** canonical path (D-52); overwriting needs `overwrite:true`.<br>• **Guard:** refused if the file changed since the engine loaded or saved it, with **no override** and **no exemption**.<br>• **Backup** to C-16 first; write via temp file + rename; defined failure paths.<br>• **Root:** `<PathOfBuilding2>`.<br>• `noteSaved` is called **only** when the bytes written are the engine's current build.<br>• Delivered by WU-22<br>**Amended by D-86** (the guard's step 3: the writer's own last write, and per-path engine fingerprints). |
| C-18 | Test harness | new | 01 §C-18 | Jest `globalSetup`:<br>• scrubs `POESESSID`/`POE_SESSION_ID`;<br>• redirects `POB_DIRECTORY`/`XDG_STATE_HOME` to temp dirs;<br>• probes the engine once (`POB_TEST_ENGINE=ok\|<cause>`).<br>`setupFiles` make global `fetch` throw. Helpers: `startTestServer` (returns `{client, deps, session, close}`), `fixtureFetch` (honours abort; throws on unmatched URLs), `engineDescribe` (synchronous; fails unless `POB_SKIP_ENGINE=1`), and `spawnServer` (explicit safe env) |
| C-19 | Developer entry points | new | 01 §C-19 | mise tasks `pob:fetch`, `setup`, `build`, `test`. No pipes inside tasks. Exit codes propagate. The LuaJIT plugin is pinned to its full SHA |
| C-21 | Upgrade-search pipeline (internal, WU-17 → WU-23) | new | 03 §C-21 | `runUpgradeSearch(input, ctx) → UpgradeSearchResult`. The result is either a fallback `{reason, hint, link}`, or `{league, query, effectiveWeights, searches, total, entries, dropped, notes, stoppedEarly?, searchUrl}`. WU-23 evaluates, prices, ranks and renders it<br>**Amended by D-74:** `ctx` carries `session` (its `revision` keys the query cache). |
| C-20 | Build watcher | modified | 02 §C-20 | chokidar `usePolling: true, interval: 1000` for paths under `/mnt/`. It ignores dotfiles and `~~temp~~`. Cache keys are canonical relative paths. Descriptions are accurate. Auto-reload is **not** the watcher's job (C-3) |

## 4. Data and state model (deltas)

| Entity | System of record | Lifetime | Written by | Concurrency rule |
|---|---|---|---|---|
| User build files | `POB_DIRECTORY` (PoB2 on Windows and this server both write) | durable | the user (PoB2); the server only via C-17 | Keys are canonical relative paths (D-52). Fingerprint check before every server write; a mismatch refuses the write |
| `LoadedBuild` record | TS memory (C-3) | server process | C-3 on load, new build, save of the engine's build, reload, restore | Mutated only under the engine mutex. Never null while an engine runs ("New build" when nothing was loaded) |
| Engine revision | TS memory (C-3) | server process | C-3: +1 per successful `mutate`/`load`/`lifecycle` call **and per auto-reload**; unchanged for `read` calls without auto-reload, and for failed calls | Under the mutex |
| Recovery snapshot | TS memory (C-3): the latest `{xml, revision, afterTool}` only | server process (D-44) | C-3 after each successful change and after every load; **discarded before every load** | Under the mutex |
| Generated-query cache | TS memory (C-14): LRU of 32, keyed `(revision, slot, normalized options)` | server process | WU-17 | Under the mutex (read and written inside `find_upgrades`) |
| Rate-limit state | TS memory (C-11), per policy | server process | every trade response | Single-threaded event loop. Several server processes reconcile only through the server's state headers (D-35) |
| `/data/stats`, `/data/leagues` | TS memory (C-10) | stats: process lifetime; leagues: 4 h | lazily, when a trade call needs them | — |
| Currency rates | TS memory (C-12) | 60 min + ETag | lazily | — |
| Build-parse cache | TS memory (`buildService`) | entry valid while the file's size and mtime are unchanged; LRU of 20 | read paths; invalidated by C-17 writes (D-58) | — |
| Server state files | state dir (C-16) | durable | snapshot, backup, export and preset tools | Snapshots and backups are written once, with timestamped names. Exports and presets are named by the caller, and are replaced only by an explicit overwrite or by re-saving the same preset |
| PoB checkout | `vendor/PathOfBuilding-PoE2` (gitignored) | until the pin changes | `mise run pob:fetch` only | Read-only at runtime |

**Migration:** none. The user's builds folder has no `.pob-mcp*` folders today (checked 2026-10-03). The
README notes that old locations are ignored.

## 5. Milestones and alpha definition

- **M-0, Grounding (DONE 2026-10-03):** spikes S-1…S-4 and WU-01 (fixtures).
- **M-1, Foundation:** WU-02…WU-05. Exit means the Jest ACs among AC-F1…AC-F28 are green under `mise run
  test`, and the script-check ACs (AC-F2, F6, F7, F8, F9, F17) are recorded in the work-log with exit
  codes.
- **M-2, Engine core:** WU-06…WU-08 and WU-22. Exit means AC-E1…AC-E23, AC-E46, AC-E47 and
  AC-E55…AC-E62 are green.
- **M-α, Alpha = the trade vertical.** WU-14…WU-17, WU-23, plus the human smoke WU-20. **Alpha is reached
  when all of these hold:**
  1. `mise run test` and `pnpm build` exit 0;
  2. every AC of M-1 and M-2 is green, and so are AC-T1…AC-T46;
  3. WU-20's checklist is signed off by the user in the work-log. That means a real `find_upgrades` from
     the user's Claude Code, on their build, with their cookie, returns a ranked result or "no upgrade
     within budget", and every listing has a `Buy:` line (a whisper, or a link that opens the listing).

  Alpha does **not** require WU-09…WU-13 or WU-18…WU-19. Tools those units fix may still be on the
  hygiene allowlist (AC-F26).
- **M-3, Done:** WU-09…WU-13, WU-18, WU-19, WU-21. Exit means every AC in every slice is green, the
  hygiene allowlist **and** the cruft waiver file are both **empty** (AC-G6), and the user signs off WU-21.

## 6. Decision log

Status: **HUMAN** = decided by the user · **PROPOSED** = coordinator decision, recorded and overridable ·
**PROPOSED (build)** = a deviation a build unit recorded and its gate accepted, folded back from the work-log;
the as-built behaviour, overridable like PROPOSED.
Proceed on all of them; don't relitigate. Wording "(vision)" means the full text is in
[vision §3](../vision.md); only the refinements are written out here.

| ID | Decision | Status | Rationale / rejected alternatives |
|---|---|---|---|
| D-1 | Work lands on the user's fork (`origin` = parkerault/pob2-mcp) | HUMAN | — |
| D-2 | Pin PoB2 `v0.23.1` (`7d6f530`) through `pob-pin.json` + sparse fetch into `vendor/` (vision). **Refined (D-31):** the HeadlessWrapper hash is CRLF-normalized. **Refined:** the readiness check compares the banner's `version.number` to the pin | HUMAN / PROPOSED | A submodule downloads 1.55 GiB (S-2) |
| D-3 | No constants of our own in advice (vision). **Refined by D-30** | PROPOSED | — |
| D-4 | Delete 25 routed names plus their plumbing (vision). `find_item_upgrades` is also removed in WU-04 and replaced by `find_upgrades` in WU-17/WU-23 | PROPOSED; (e) HUMAN | — |
| D-5 | Trade generation and evaluation run in Lua through PoB's own classes; HTTP, limiter, auth, prefit, adjust loop, prices and URLs stay in TS (vision) | PROPOSED (S-1 PASS) | — |
| D-6 | `find_upgrades` replaces `find_item_upgrades`; inputs mirror PoB's dialog; actionable output (vision). **Refined by D-22, D-37, D-38, D-39, D-53, D-57** | HUMAN (use case) / PROPOSED | — |
| D-7 | Trade errors are actionable. The cookie goes only to search/fetch. **Refined by D-25** (User-Agent) and **D-24** (classification) | PROPOSED | — |
| D-8 | Engine concurrency and recovery: a mutex per tool call, request ids, timeout from the write, single-flight start, revision counter, snapshot after each change, E1/E4/E5/E6/E9 root fixes, env-gated test actions (vision). **Restated per vision D-8(d):** after a restart with no restorable snapshot, `read`/`mutate` calls return `isError` ("Engine restarted; the loaded build could not be restored. Load it again."), and `load`/`lifecycle` calls proceed. **Refined by D-59** | PROPOSED | The SDK dispatches requests concurrently (`protocol.js:159-169`) |
| D-9 | Writes never clobber the working build. File→file operations through the engine run snapshot → load → modify → save → reload under the lock (`withTemporaryBuild`) (vision). **Refined by C-17** | PROPOSED | — |
| D-10 | Runtime zod schemas for every TS↔Lua reply, validated in the bridge (vision). **Refined by D-26** | PROPOSED | — |
| D-11 | Currency: poe.ninja PoE2 is Divine-primary today. Budget authority = trade2's server filter plus a client post-filter on the normalized price. If poe.ninja is unavailable, use the server filter only and say so (vision). **Refined by D-33, D-54** | PROPOSED | — |
| D-12 | Golden fixture = the user's `Grenadator.xml`. **Done** in WU-01: `tests/fixtures/builds/grenadator.xml`, sha1 `e0c16f3…`, with `lastCharacterHash` blanked; it reproduces 109/109 `PlayerStat` pairs on the tag | HUMAN | — |
| D-13 | pnpm via corepack. **Refined by D-32** (corepack enabled by a mise postinstall) | HUMAN | — |
| D-14 | Trade and engine are both on by default. `POE_TRADE_DISABLED=true` opts out of trade. `POB_LUA_ENABLED` and `POE_TRADE_ENABLED` are removed. No network I/O before the MCP handshake | HUMAN / PROPOSED | — |
| D-15 | Weighted search needs a session: `POESESSID` in the gitignored `.env` (the user accepts a cookie on disk), with a trade-site link as the fallback. **Mechanism refined by C-9, D-24, D-49** | HUMAN / PROPOSED | GGG OAuth registration is closed; `account:trade` is a PoB-only grant |
| D-16 | Setup and registration (vision). **Refined:** the registration command is exactly `claude mcp add pob2 -s user -e "POB_DIRECTORY=/mnt/c/Users/parke/Documents/Path of Building (PoE2)/Builds" -- mise exec -C /home/parker/projects/pob2-mcp -- node build/index.js`, after `mise trust`. Verified 2026-10-03: Claude Code 2.1.289 lists the tools and completes a call against the current SDK-1.20.2 server. **Amended 2026-10-18 (the user):** the repository is public, so the README shows only the generic form, with `<your PoB2 Builds folder>` and `<path to this repo>` in place of the paths | PROPOSED; POB_DIRECTORY HUMAN (Q6) | — |
| D-17 | Local gate `mise run test`. Engine tests fail rather than skip unless `POB_SKIP_ENGINE=1`. In-process MCP tests. Worktree bootstrap `mise trust && pnpm install --frozen-lockfile && mise run pob:fetch`. Coverage is reported, not gated (vision). **Refined by D-32** | PROPOSED | — |
| D-18 | **Server state lives in `${XDG_STATE_HOME:-~/.local/state}/pob2-mcp/`** (snapshots, backups, exports, presets), never in the builds folder. PoB2's build browser lists every subfolder and `.xml` there (`BuildListHelpers.lua:22-76`) | **HUMAN** (2026-10-03) | Keeping `.pob-mcp/` in Builds would make snapshots show up in PoB2 as builds |
| D-19 | **Disk-change policy.** At the start of each engine call, if the loaded file changed on disk (fingerprint):<br>• when the engine is clean (no change since the last load/save), auto-reload it and say so;<br>• when dirty, don't reload, warn, and require an explicit reload or a save under a new name.<br>Saving over a changed file is always refused (C-17) | **HUMAN** (2026-10-03) | Warn-only was rejected for a collaborative workflow |
| D-20 | **Default league:** `POE_LEAGUE` if set; else the first `/data/leagues` entry (API order) that isn't `Standard` or `Hardcore` and doesn't start with `HC `. That is "Forbidden Rites" in the fixture, and it is also the golden build's `lastLeague` | **HUMAN** (rule) / PROPOSED (HC exclusion) | — |
| D-21 | Alpha = the trade vertical, plus the build-file writer that makes it safe to use against the user's real folder (§5) | PROPOSED | — |
| D-22 | **`find_upgrades` bounds:**<br>• ≤ 5 searches per call (PoB `maxRecursion`, `TradeQueryRequests.lua:111`);<br>• a **90 s deadline from tool-call arrival**, which includes waiting for the engine lock;<br>• every HTTP and engine step's timeout is clipped to the time remaining, and no step starts with < 1 s left;<br>• on `would_wait` (a limiter wait > 30 s or past the deadline), `locked_out`, `rate_limited` or a cut step, stop and return what has been evaluated, plus the link and the reason;<br>• `limit` defaults to 10, at most 20;<br>• progress notifications when a `progressToken` is present;<br>• the caller's `signal` stops it and releases the lock. | PROPOSED | Claude Code backgrounds MCP calls after 120 s (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`) |
| D-23 | **Complexity prefit:** before sending, estimate complexity with PoB dev head's budget model: `54 (weight group) + 4 (category+rarity) + 4 (and group) + 4 per and/not/weighted filter + 3 per each of mirrored:false, price, max level, sockets + 2 per extra query key`. Drop the lowest-weight weighted filters until `200 − estimate ≥ 4`. If a 400 `too_complex` still comes back, drop the lowest-weight 25 % (at least 1) and retry **once**, then fall back to the link with the server message | PROPOSED | Every 4xx counts toward GGG's invalid-request threshold. The model is conservative on all 5 fixture data points (A-3) |
| D-24 | **Session detection uses the rate-limit header**, and applies **only to requests whose body has a `type:"weight"` stat group** (the classifier knows its own body; it never parses the message). For such a request with a cookie sent, a 400 code 2 means `too_complex` if `Account` is in `X-Rate-Limit-Rules` (case-insensitive), and `session_rejected` otherwise (A-13). Any other 400 code 2 → `invalid_query` (`isError` with the server message). 401/403 → `auth`, a generic "trade rejected the request (HTTP n)" plus the refresh hint | PROPOSED | GGG documents code 2 as "Invalid query" and says "use the code rather than the message" |
| D-25 | **User-Agent** = `<package.json name>/<package.json version>` (today `pob2-mcp-server/0.2.2`), with no contact, for trade and poe.ninja. Defined once in `src/utils/userAgent.ts`. `POE_TRADE_USER_AGENT` is removed.<br>• **Exception:** share-site fetches (pobb.in, pastebin) send `Mozilla/5.0 (compatible; <that constant>)`, as the inherited code does, because bot filters block plain UAs (A-15).<br>• **Recorded deviation:** poe.ninja asks for a contact and for desktop apps to proxy; we do neither, and D-11 is the fallback if it blocks us | PROPOSED | GGG's `OAuth {clientId}/…` format requires a registered app (closed). A contact would identify the user |
| D-26 | `zod@^3.25.76`: the v3 API, deduplicated with the SDK's copy. Never pass zod schemas to SDK APIs. `zod-to-json-schema@3.24.6` is a devDependency, for the schema-agreement test (C-14) | PROPOSED | SDK 1.20.2 silently empties v4 schemas (probe) |
| D-27 | **Error surface.** Every error a tool handler produces → `isError: true` with an actionable text, set centrally in the router. Unknown tool → JSON-RPC −32602. Invalid arguments for tools with zod input schemas (`find_upgrades`, `trade_query_options`) → `isError` naming the field | PROPOSED | MCP 2026-07-28 moves input-validation errors into `isError` so the model can self-correct |
| D-28 | The engine child env is `deps.env` minus `POESESSID`/`POE_SESSION_ID`. The server exits on stdin `end`/`close`, killing luajit. Startup errors include the cause (`luajit` not on PATH; the last stderr lines) | PROPOSED | The SDK's stdio transport ignores EOF (`stdio.js:27-34`) |
| D-29 | `main.disableDevAutoSave = true` at bridge boot. `load_build_xml` pre-validates (non-empty, parses, root `PathOfBuilding2`) and post-checks (`main.mode=="BUILD"`, `newMode==nil`, `buildName==name`); failure → `LOAD_FAILED`. The readiness probe is the banner plus `ping` (no XML load); WU-06 changes it in the same merge as the Lua side | PROPOSED | Any failed load after a good one wedges the engine through dev autosave (ctx-lua X3) |
| D-30 | **Advice judgments** come only from: (a) PoB's warning lines, obtained by a new `get_warnings` action that runs `build:RefreshStatList()` with `characterLevel` and `characterLevelAutoMode` restored afterwards; (b) `Missing<Elem>Resist > 0`; (c) per type, `<Type>MaximumHitTaken < <Type>EnemyDamage` for the configured enemy | PROPOSED | `totalEnemyDamage` sums 5 types, while `<Type>MaximumHitTaken` covers one (ctx-lua X5) |
| D-31 | `pob-pin.json.headlessWrapperSha1` = `77a3e3a9b7387ebc57ef0a35bb17c382282e3c7c` (CRLF-normalized, the manifest scheme) | PROPOSED | S-2's `784d675…` is the raw-LF hash |
| D-32 | **Toolchain:**<br>• `node = { version = "24", postinstall = "corepack enable" }`;<br>• pin the LuaJIT asdf plugin via `[plugins]` to the **full** SHA `bd4977ef2c2cfd0659a4bb39acb37bd5104fb7fc`, verified in a scratch `MISE_DATA_DIR` (else record the limitation as an A-n and drop the pin);<br>• move `LUAROCKS_VERSION` to `install_env`;<br>• mise tasks contain **no pipes** (the task shell lacks pipefail);<br>• delete `coverageThreshold` from `jest.config.cjs`;<br>• remove `@types/chokidar` and `@types/node-fetch`;<br>• keep `@types/node` at ^20 (it already declares `util.parseEnv`). | PROPOSED | A fresh Node 24 has no pnpm without corepack enabled. mise rejects abbreviated plugin SHAs |
| D-33 | **Currency:** read `core.primary` from every poe.ninja response (never hard-code divine). Join listings on `listing.price.currency` = poe.ninja ids. Display normalized prices in the budget currency (in exalted when the budget is "Exalted Orb Equivalent"). Cache 60 min with `If-None-Match` | PROPOSED | poe.ninja docs: per-response primary; "ETag-based. Use conditional requests" |
| D-34 | **No live network from build agents or tests.** All tests use fixtures. Jest makes global `fetch` throw, and spawned servers get an explicit safe env (C-18). Only the coordinator (fixture capture, with user approval) and the user (WU-20/21) make live requests to pathofexile.com or poe.ninja | PROPOSED | Rate limits are per IP and account; an agent run could lock the user out |
| D-35 | Several server processes (several Claude sessions) coordinate only through the server's limit-state headers, which count every client on the IP or account. The limiter adopts server state that is higher than its own. A new process may take one 429 during another process's active lockout; it then honours `Retry-After` | PROPOSED | Persisting lockouts across processes was considered and rejected: it saves at most one 429 per process start |
| D-36 | No `structuredContent`/`outputSchema`. Results stay text | PROPOSED | Agent SDK docs: text blocks are dropped when `structuredContent` is set, which would hide warnings |
| D-37 | **`find_upgrades` defaults mirror PoB's dialog:**<br>• sort weights = the build's saved `<TradeSearchWeights>`, else FullDPS 1.0 + TotalEHP 0.5;<br>• `include_mirrored` true;<br>• `weight_corrupted_mods` true unless the slot's current item is corrupted;<br>• status `securable` (Instant buyout);<br>• `fetch_pages` 2;<br>• rune and anoint behaviour `copy`;<br>• `rank_by` `stat_value`;<br>• currency = Exalted Orb Equivalent. | PROPOSED | ctx-lua X7, X8 |
| D-38 | `find_upgrades` slots = what PoB's generator supports: gear, weapons and their swaps, rings, amulet, belt, flasks, gear jewel sockets except weapon ones, and tree jewel sockets. Jewel slots require `jewel_type`. Charm, Arm and Leg slots and weapon jewel sockets error with the supported list | PROPOSED | `TradeHelpers.lua:256-302` |
| D-39 | Both trade links use `https://www.pathofexile.com/trade2/search/poe2/<league>?q=<urlencoded query JSON>`. The league is encoded as PoB's `buildUrl` effectively does: every byte outside `[A-Za-z0-9-._~]` → `%XX`, **so a space is `%20`** (PoB's trailing `gsub(" ","+")` never matches). That equals `encodeURIComponent` for league names. The exact-item link applies PoB's recipe (weight `[floor(w,1)−1, round(w,1)+1]` plus `trade_filters.filters.account.input`) | PROPOSED | PoB's tag omits `poe2` in the exact-item URL (unverified on the site); the realm form is the one PoB uses for no-session links. WU-20 verifies, and may also test the shorter offline search-id form |
| D-40 | No automatic retry on network errors or 5xx (except D-23's single complexity retry) | PROPOSED | Retries count against limits |
| D-41 | The README carries GGG's third-party notice verbatim | PROPOSED | GGG developer guidelines |
| D-42 | `export_build`'s `output_directory` must resolve inside `POB_DIRECTORY` or the state dir. **Refined by D-81, D-88** (never inside the state dir's `backups/` or `snapshots/`) | PROPOSED | Every path argument is confined |
| D-43 | Watcher: polling (`interval: 1000`) when the watched path starts with `/mnt/`; `.xml` only; depth unlimited; cache invalidation by canonical relative path | PROPOSED | inotify doesn't see Windows writes on drvfs (WSL #4739) |
| D-44 | The recovery snapshot lives in memory only, latest one kept | PROPOSED | Files on disk are the system of record |
| D-45 | **The tool-hygiene test (AC-F26) uses a strict allowlist**, `tests/fixtures/tool-hygiene-allowlist.json`, with entries `{tool, check, owner}`.<br>• An allowlisted check that passes fails the test.<br>• **Any** unit may remove an entry its change makes pass, recording the actual fixer in the work-log.<br>• A unit may add an entry only with an owner and a reason, and only where this spec says so (WU-08's interim guard, D-51).<br>• Every tool has ≥ 1 `expect:"ok"` sample; error samples are additional, each with a reason.<br>• Done requires an empty allowlist. | PROPOSED | Lets M-1 land before the fix units, without hiding regressions or deadlocking an early fixer |
| D-46 | Trade search and fetch responses are never cached. Only `/data/*` and poe.ninja are | PROPOSED | Listings go stale; D-6 forbids caching listings |
| D-47 | Engine request timeouts: 30 s default (`POB_TIMEOUT_MS`), 60 s for `trade_generate_query`. Inside `find_upgrades` they are clipped by D-22 | PROPOSED | S-1 measured generation at ≤ 4.4 s; headroom for slow boxes |
| D-48 | Commits by build agents in worktrees use `-c commit.gpgsign=false`. The orchestrator sign-rebases once at the end with the user present | PROPOSED | 1Password signing pops a Windows approval that headless agents can't answer |
| D-49 | **`find_upgrades` fallbacks are results** (`isError: false`) that start with `Trade search not run: <reason>` and carry the trade-site link.<br>• **The fallback cases:** no session, an `op://` or malformed cookie, `session_rejected`, and a second `too_complex`.<br>• **No network before a no-session fallback.** It is decided right after query generation, **before** the stat-data or league fetches, whenever the league comes from the input or `POE_LEAGUE`.<br>• **Partial results.** An `http`/`network`/`timeout` error after ≥ 1 listing was evaluated returns those listings with a "Stopped early" note.<br>• **Genuine failures** are `isError`: invalid input, engine errors, and errors before any evaluation. | PROPOSED | The link is the designed outcome of D-15; flagging it as a failure would push Claude to retry instead of handing the user the link |
| D-50 | **Tuning constants.** These are coordinator choices, listed here so they can be changed in one place: <br>• engine: banner wait 15 s, stderr ring 50 lines (20 shown), quit grace 2 s;<br>• Jest: `testTimeout` 60 s;<br>• trade: error-message truncation 300 chars, `Retry-After` default 60 s, query-cache LRU 32, `max_level` 1–100, `min_empty_rune_sockets` 1–6, `sort_stats` 1–10, `report_stats` ≤ 10, choice lists ≤ 200;<br>• `add_gem` suggestions ≤ 5;<br>• `import_build` inflate cap 16 MiB (unchanged from today);<br>• fetch timeout 120 s (AC-F2). | PROPOSED | — |
| D-51 | **User-visible behaviour changes** this spec makes beyond the vision §4 rows (the user can veto any at ratification):<br>• (a) `analyze_defenses`' `build_name` becomes optional; the default is the loaded build.<br>• (b) `restore_snapshot` always backs up; `backup_current` is still accepted but ignored.<br>• (c) `set_build_notes` goes through C-17 (backup; refused over a changed loaded file).<br>• (d) A save under a new name re-points the loaded build to it, as PoB's Save As does.<br>• (e) `lua_stop` names any unsaved changes it discards.<br>• (f) Between WU-08 and WU-13/WU-18, `analyze_build`, `compare_builds`, `validate_build {build_name}` and `analyze_defenses {build_name}` return `isError` instead of silently replacing the engine's build.<br>• (g) The five `*TakenHit` sort stats aren't offered (D-57).<br>• (h) `search_trade_items` drops `min_links` (PoE2 has no links) and gains `min_rune_sockets`. Its handler adopts the schema's existing argument names. | PROPOSED | — |
| D-52 | **Canonical build paths.** On case-insensitive filesystems (drvfs), every build path used as a key, a display name or a write target is canonicalized to its on-disk casing by `canonicalBuildPath(name, baseDir)` in `src/utils/pathSanitizer.ts`:<br>• each segment takes the exact `readdir` match, else the single case-insensitive match;<br>• a new final segment keeps the caller's spelling;<br>• several case-insensitive matches and no exact one → `isError` "ambiguous build name". | PROPOSED | `/mnt/c` resolves any casing to one file, and `fs.realpath` keeps the caller's casing (verified 2026-10-03) |
| D-53 | **`find_upgrades` output budget:** listings render in rank order in full (stats, `Buy:` line, item text) while the output stays ≤ 30,000 characters. The rest render as one-line entries (name, price, score, `is_upgrade`, seller) with a note | PROPOSED | One exact-item link is ~4,000 chars (the whole query, URL-encoded); 10 full listings ≈ 48k chars, past Claude Code's 10k-token warning |
| D-54 | **Partial currency conversion mirrors PoB:** if any listing left after the budget filter has no convertible price, the `price` and `stat_value_per_price` modes fall back to `stat_value`, with a note. Unconvertible listings are never counted over budget (the server filter applied, A-10), and they are flagged | PROPOSED | `TradeQuery.lua:863-868, 919-930` |
| D-55 | **Canonical mod order.** `Trade.lua` sorts `gen.modWeights` by (`meanStatDiff` desc, `|weight|` desc, `tradeId` asc) before `FinishQuery`, and `rankedWeights` uses the same order. `requiredModChoices` are sorted by `tradeId` | PROPOSED | PoB sorts with an unstable comparator over `pairs`-ordered input, and the pinned LuaJIT randomizes string hashes per process |
| D-56 | **Fetch-result sanitizing.** TS drops `null` fetch entries and listings without `price` before sending entries to Lua, and counts them. `Trade.lua` evaluates each item in `pcall` and reports failures in `rejected` | PROPOSED | PoB reads `listing.price.amount` unguarded (`TradeQueryRequests.lua:437`); one bad entry fails a 10-item block |
| D-57 | **Baseline and Taken stats.**<br>• `baselineScore` = `WeightedRatioOutputs(baseOutput, ReduceOutput(baseOutput), weights)`, computed in Lua. That is the score PoB's own item path gives the unchanged build, so the equipped item scores exactly the baseline.<br>• The five `*TakenHit` stats are excluded from `sort_stats`/`sortStats`, because PoB's item path applies their transform twice and ranks them backwards. | PROPOSED | Probe on the golden build: Σ weights is wrong for base-0 stats (FullDPS 1 + BlockChance 0.5 scores 1.0, not 1.5) |
| D-58 | The build-parse cache keys by canonical relative path, and validates each hit by `{size, mtimeMs}` (no TTL; LRU of 20). C-17 writes invalidate the written path | PROPOSED | The 60 s name-keyed cache served stale builds after saves |
| D-59 | **Only the session starts the engine.** `request()` on a dead client rejects with `EngineExitedError`; it never spawns. If the engine dies during a tool call (pid recorded before `fn`), the call fails and step 6 is skipped | PROPOSED | A mid-call self-restart produced a blank engine labelled as the user's build |
| D-60 | `lua_save_build` = `export_build_xml` + the C-17 writer. The Lua `save_build` action, its schema and `PoBLuaApiClient.saveBuild` are deleted (WU-22) | PROPOSED | C-17 must see every write |
| D-61 | **`search_trade_items` loses its value scoring and gains normalized prices** (an amendment made during the build, 2026-10-04).<br>• WU-04's list said `costBenefitAnalyzer.ts` would become unreferenced, but `search_trade_items`' `formatSearchResults` still ranked and annotated results with it: a value score, a tier, a best-value rank and per-chaos stat lines.<br>• That score is build-blind (fixed weights, the same for every character), and `find_upgrades` is the build-aware ranking. So WU-04 removes the scoring and deletes the file, as listed. Listings keep the order the trade site returned.<br>• WU-15 shows each listing's native price plus its primary-currency equivalent from C-12 `convert` (AC-T46). | HUMAN (2026-10-04) | The currency conversion was the only part worth keeping |
| D-62 | **The canonical export is compared order-insensitively across a temporary reload** (WU-13; AC-E16, AC-E48, AC-E51, AC-E56 amended).<br>• After `withTemporaryBuild` (D-9) puts the working build back, the pinned PoB2 re-serializes `pairs()`-ordered tables in a new order (`vendor/PathOfBuilding-PoE2/src/Classes/PassiveSpec.lua:226-311`): the `<Spec>` node list and the tree `<URL>` that encodes it, `<AttributeOverride>` node lists, `<Input>`/`<Placeholder>` element order, and attribute order. A literal "identical" can't hold.<br>• **Rule** (`tests/helpers/reloadCanonical.ts:61-70`, `canonicalizeAcrossReload`): on top of the strict canonical export, sort every tag's attributes by name; sort the node-id sets (`nodes` on `<Spec>`/`<WeaponSetN>`, `strNodes`/`dexNodes`/`intNodes`) numerically; sort `masteryEffects` entries; drop the `<URL>` body; sort each run of consecutive `<Input>`/`<Placeholder>`, `<Socket>` and `<WeaponSetN>` elements. Everything else is compared as exported.<br>• It applies only to samples whose tool reloads the working build (`analyze_build`, `compare_builds`, `export_build` with notes; `tests/integration/engineKinds.test.ts:107-112`). Every other check keeps the strict comparison, so a read tool that reloads behind the session's back is still caught. A unit test shows real changes are still detected (`tests/integration/buildFiles.test.ts:103-156`).<br>• AC-E56's interim "`compare_builds` returns `isError` until WU-13" is superseded: since WU-13 it succeeds and leaves the state unchanged (`tests/integration/engineSession.test.ts:224-237`).<br>• The `lua_set_tree` hygiene sample re-applies the build's own nodes and declares `stateChange:false` (`tests/fixtures/tool-calls.json:64`) | PROPOSED (build) | Gates accepted it; rejected: a strict compare (fails on every reload), or comparing only stats (misses real tree/config changes) |
| D-63 | **Bridge request ids continue after the readiness ping** (WU-07; AC-E7 amended). `start()` sends `ping` as id 1, so the first three `request()` calls after it get ids 2, 3 and 4 (`tests/unit/pobLuaBridge.test.ts:79-110`) | PROPOSED (build) | AC-E7's "ids 1, 2 and 3" contradicted the C-4 readiness ping (AC-E23) |
| D-64 | **Listed-tool counts follow the final surface** (WU-17, WU-23, WU-19; AC-T41 and AC-G4 amended).<br>• AC-T41 asserts 76 (75 + `find_upgrades`), because WU-23 has landed when it runs (`tests/mcp/tradeQueryOptions.test.ts:83-89`).<br>• `POE_NINJA_DISABLED=true` hides `get_currency_rates` (C-1 tool groups), so a server with that flag lists 75. `fresh-clone-check.mjs` lists 76 on a listing-only server without the flag, and asserts 75 (no `get_currency_rates`) on the check server with the spec's env (`scripts/fresh-clone-check.mjs:10-19, 27-28, 110-112`) | PROPOSED (build) | AC-G4's "76 with ninja disabled" contradicted C-1 |
| D-65 | **The `load_build_xml` wire contract is stricter, and gains `keepLevel`** (WU-06, WU-18; C-2, D-29).<br>• A load also fails (`LOAD_FAILED`) when the `<Build>` has no current `targetVersion` or when PoB opened a popup during it; the popups that load opened are closed (`pob-api/API/Handlers.lua:158-188`). `launch.promptMsg` alone doesn't fail a load. Whitespace-only `xml` fails as empty; non-string `xml` fails as `LOAD_FAILED`.<br>• Optional `keepLevel:true` keeps `characterLevel` and its auto mode through the load (`Handlers.lua:196-199`). The session's put-back after a temporary load uses it, so a read tool never re-estimates an auto-mode level (D-30). Crash recovery still reloads without it (flagged, `src/engine/session.ts:511`).<br>• Other pinned reply shapes: `new_build` → `{ok:true, result:{name}}`; `get_stats` `_meta.omitted` is always present and lists only non-scalar requested keys; `calc_with` keeps NaN/inf, encoded as null; a non-number request id isn't echoed; a non-table `params` becomes `{}`.<br>• New Lua actions beyond the C-5 list: `get_warnings` (WU-18; strips PoB colour codes, runs `BuildOutput` first) and `list_support_candidates {groupIndex, measure?}` (WU-11) | PROPOSED (build) | A PoB raise mid-`Build:Init` or a legacy `targetVersion` replied `ok:true` while the old build stayed loaded (WU-06 review) |
| D-66 | **Bridge client details** (WU-03, WU-07; C-4).<br>• A banner whose PoB version differs from the pin rejects with `EnginePinError` (`src/pobLuaBridge.ts:98, 255`).<br>• `EngineActionError`'s message is the engine's error text alone.<br>• After `exit`, the client waits up to 250 ms for `close` so the stderr tail is complete (`src/pobLuaBridge.ts:82`).<br>• `stop()` writes `quit`, waits 2 s (D-50), then SIGKILLs; `pid()` is exposed.<br>• The pin check's memo includes `allowUnpinned`, so an unpinned ok never satisfies a strict check (`src/engine/pinCheck.ts:205`) | PROPOSED (build) | — |
| D-67 | **Engine session details** (WU-08; C-3).<br>• The interface gains `current()` (AsyncLocalStorage), `ctx.stopEngine()` for `lua_stop`, and `snapshot-start`/`snapshot-end` event phases (`src/engine/session.ts:53, 87, 98`).<br>• The snapshot is discarded on a successful load, not before it.<br>• `lua_start` doesn't bump `revision`; `lua_stop` does.<br>• A load-kind call whose load succeeded but which then failed still bumps `revision` and takes a snapshot.<br>• A deliberate engine kill (`client.stop()`) is marked as a crash, not as an interrupted call.<br>• `lua_load_build {build_name}` ignores `name`; `lua_reload_build` reloads `loaded.path` | PROPOSED (build) | Pins down cases C-3 left open |
| D-68 | **Error-surface details** (WU-03; C-1, D-27).<br>• `get_nearby_nodes` errors only when none of the build's allocated nodes exist.<br>• The three spec-list paths error on an empty list.<br>• Truncation (C-1's 5000-char list) skips `isError` results.<br>• The lazy trade-stats preload runs before every trade tool except `get_leagues`, `trade_query_options` and `find_upgrades` (`src/server/toolRouter.ts:116, 151`), has a 15 s timeout, and is memoized even on failure (D-40) | PROPOSED (build) | `find_upgrades` does its own deadline-bounded `/data/stats` step (D-22, D-49) |
| D-69 | **Toolchain pin details** (WU-02; D-32, C-19).<br>• The `[plugins]` key in `mise.toml` must be the tool's backend name exactly as in `[tools]` (`"asdf:mise-plugins/mise-luaJIT"`); any other key is ignored without a warning. Verified with a SHA-swap control and a full `mise install` in a scratch data dir.<br>• `pob:fetch` exits early when `vendor/` HEAD matches the pin and tracked files are clean (`--untracked-files=no`), so untracked runtime files don't force a re-clone | PROPOSED (build) | The first key (the installed plugin's directory name) silently left the plugin unpinned |
| D-70 | **Trade client and limiter details** (WU-14; C-10, C-11).<br>• Each window counts sends over (t − P − 1 s, t], released at `stamp + P + 1 s` (PoB's 1 s guard, `src/trade/rateLimiter.ts:119, 316`). Adopted server state counts over (now − P, now].<br>• A wait is refused only when `wait > maxWaitMs` (30 s) or past the deadline (`rateLimiter.ts:294`), so a burst spanning exactly 30 s is admitted.<br>• Any non-abort transport failure is `network` (`src/trade/tradeClient.ts:247`).<br>• A failed `/data/stats` load isn't cached, so it is retried.<br>• Fetch with 0 or more than 10 ids throws `RangeError` (`tradeClient.ts:143`) | PROPOSED (build) | The half-open window without the guard let 4 searches into a 5 s interval whose limit is 3 (WU-14 review) |
| D-71 | **`search_trade_items` output** (WU-04, WU-15; D-51h, D-61, AC-T46).<br>• Always sends status `available` and sorts by price ascending (`src/handlers/tradeHandlers.ts:126, 278`).<br>• An omitted `price_currency` means exalted equivalent, not chaos.<br>• `charm` maps to trade category `flask`, after PoB's `TradeHelpers` (WU-20 confirms live).<br>• Listings show `Listing: #<id>` under one search link instead of a URL each (`tradeHandlers.ts:211`), because real ids are 194–919+ chars and break the C-1 5000-char cap.<br>• `Links: nL` becomes `Rune sockets: n` (`tradeHandlers.ts:201`); instant-buyout listings get a marker; the legend keeps only the online/offline markers.<br>• The `(~N chaos)` suffix is gone; the `Stats: +N Life, +N ES, +N% Res` line stays; normalized prices use the D-72 format (2 decimals from 1 up, 4 significant digits below 1), as `find_upgrades` and `get_item_price` do (amended during build: 2 decimals showed typical exalted listings as `≈ 0.00 divine`; `src/handlers/tradeHandlers.ts:190`) | PROPOSED (build) | — |
| D-72 | **Other kept trade tools** (WU-15; C-12).<br>• `get_item_price` uses the D-20 default league when none is given, prints 4 significant digits below 1, and always prints the native spread.<br>• `search_stats` uses live stats only, errors if they never loaded, and breaks ties by shorter text, then catalogue order.<br>• `get_currency_rates` errors when poe.ninja is unavailable (`src/handlers/poeNinjaHandlers.ts:22`) and drops the old preamble.<br>• poe.ninja requests time out after 15 s (`src/services/poeNinjaClient.ts:12`). `Rates` gains `nameOf` and `currencies` | PROPOSED (build) | 2 decimals showed exalted listings as 0.00/0.01 divine (WU-15 review) |
| D-73 | **Lua trade actions details** (WU-16; C-13, D-55).<br>• `trade_evaluate_items` accepts an additive `{id, itemText}` entry form (`pob-api/API/Trade.lua:479-481`), feeds fetch entries to PoB's parser one at a time, and runs `BuildOutput()` first. Entries rejected without an id are reported as `#<index>`.<br>• Runes and anoints apply only on slots where PoB's dialog shows them; gear jewel sockets report `runeBehaviour:true`, copying PoB's substring tests (`Trade.lua:225`).<br>• Jewel `trade_query_options` uses the `Base` type. `savedWeights` follows the generator's default rule. Input validation the spec leaves open fails with `FAILED`.<br>• PoB's `FinishQuery` re-sort doesn't break ties by trade id; the result is still deterministic, given D-55's pre-sort.<br>• Every action leaves `#main.popups` unchanged (`Trade.lua:676-682`) | PROPOSED (build) | — |
| D-74 | **C-21's context carries the session** (WU-17; C-21 amended). The `runUpgradeSearch` ctx gains a required `session: Pick<EngineSession,'revision'>`, whose `revision` keys the generated-query cache (C-14 step 4) (`src/trade/findUpgrades.ts:213-217`) | PROPOSED (build) | The engine call context carries no revision; an optional field silently disabled the cache (WU-17 review) |
| D-75 | **`find_upgrades` stop and deadline semantics** (WU-17, WU-23; D-22, D-49).<br>• A request timeout counts as the deadline cut when less than 15 s of budget was left (C-10's 15 s cap).<br>• A budget cut before the query exists (step 6) is `isError`, since no link can be built; a cut at step 7 returns an early stop.<br>• `http`/`network`/`timeout` after ≥ 1 fetched listing returns "Stopped early"; with none fetched, it is `isError`.<br>• A deadline-caused `would_wait` uses the rate-limit stop text. "The engine was busy" comes from `EngineBusyError` at the session.<br>• `searches` counts every request sent, including a `too_complex` retry.<br>• Fallbacks after a search link to the last query sent; the no-session fallback links to the generated query.<br>• Deadline-bound engine steps end by abort at the deadline minus 250 ms (`src/trade/rankUpgrades.ts:52`); the clipped bridge timeout is only a backstop, because a timeout SIGKILLs the engine and loses the result.<br>• The poe.ninja rates lookup runs after evaluation, as C-14's step order has it (evaluate, then rates, then price), and only when at least one listing was evaluated; it is bounded by min(15 s, time left less the 250 ms reserve) (`src/trade/rankUpgrades.ts:388, 467-475`); a cut adds the budget stop note and keeps the rows (corrected during build: this row first said "before evaluation", which the code never did).<br>• `/data/*` loads are bounded by racing, not aborting | PROPOSED (build) | A clipped timeout killed the engine and lost the partial result (WU-23 review) |
| D-76 | **`find_upgrades` output wording** (WU-23; D-53).<br>• "No upgrade within budget." is always stated when no upgrade is found (`src/trade/renderUpgrades.ts:20`); closing wording exists for nothing evaluated, every search total 0, and every item rejected.<br>• Partial rejection reads `<r> of <n> fetched item(s) were rejected` (`rankUpgrades.ts:454`).<br>• The Current item line comes from `get_items` and may say `unknown` or `empty`.<br>• A listing with no whisper and no Sum gets the search link plus the seller.<br>• Session notices aren't repeated in the header (the router puts them first, C-3 step 8); a `refit(reservedChars)` hook makes them count toward the 30,000-char budget (`src/server/toolRouter.ts:97-98`) | PROPOSED (build) | Notices pushed the output past 30,000 chars (WU-23 review) |
| D-77 | **Engine read tools: stats, tree, passives** (WU-09, WU-10).<br>• `lua_get_stats` prints a `Tree Version:` line; its default grouping classifies by pattern with no section caps; it always shows `EvadeChance` and `DeflectChance` (at 0 too, AC-E41).<br>• `list_item_sets` labels the active set; spec tools say "points", not "nodes"; `create_spec`/`select_spec` follow up with the spec list.<br>• `get_items` refreshes sockets and slots (`ItemsTab:PopulateSlots()`); hidden slots are dropped by consumers (`src/utils/itemSlots.ts`).<br>• `search_nodes` additively returns PoB's `pathDist`/`path`.<br>• `get_passive_upgrades` measures the 8 nearest notables per keyword with `calc_with` over the whole path, ranks by gain per point, lists only improving candidates, excludes ascendancy notables (`src/handlers/treeHandlers.ts:412-426`), and propagates engine errors.<br>• `get_build_info` takes class names from the active spec first. `plan_leveling` drops the loaded ascendancy when `class_name` names another class. `reimport_nodes` keeps `masterySelections` | PROPOSED (build) | `get_passive_upgrades` suggested unallocatable ascendancy notables priced in passive points (WU-10 review) |
| D-78 | **Items, gems and skills tools** (WU-11). User-visible surface changes:<br>• `toggle_flask` takes `slot` (a Flask or Charm slot) instead of `flask_number`; an empty slot is an error (`src/server/toolSchemas.ts:579-595`).<br>• `suggest_supports` always measures; `measure_dps` and the tag heuristic are gone; `count` defaults to 8, max 20. It ranks PoB's candidate pool (legacy supports and ones already in the group dropped) by the build's gem-sort stat. `analyze_skills` lists the full pool only for the main group.<br>• `add_gem` accepts an exact case-insensitive name or a gem id. Ties: a base-type name beats the gem name, and a regular gem beats a unique variant; remaining ties are rejected with gem ids.<br>• `add_item_text`'s reply `slot` is the slot that actually holds the item.<br>• `add_gem` and `add_item_text` gain optional `validateOnly`; the multi-step tools (`setup_skill_with_gems`, `add_multiple_items`) are all-or-nothing and say so | PROPOSED (build) | Measuring in Lua takes ~1.4 s against > 60 s with round trips; partial multi-step changes diverged from the session record (WU-11 review) |
| D-79 | **Config tools** (WU-12; C-5, C-16).<br>• `get_config` prints every PoB2 config option (~559) as `key: value`, grouped by PoB section; unset ones show PoB's value marked `(default)` (`src/handlers/configHandlers.ts:50-53`). The reply schema gains `defaults` and `options` (additive).<br>• `set_config` rejects non-ConfigOptions keys and wrong-typed values, all-or-nothing. `""` clears a non-checkbox option; for a list it sets what PoB's `CreateConfigSet` writes (`list[defaultIndex].val`, else `defaultState`) (`pob-api/API/BuildOps.lua:337-338`). A list value differing from PoB's only by carriage returns is accepted verbatim.<br>• Presets are `{enemyLevel, input}`; loading one sends all keys in one `set_config` and clears options the preset doesn't hold.<br>• `set_enemy_stats` drops its hard-coded penetration/exposure advice (D-3) | PROPOSED (build) | `""` on a list option wrote nil, which save/reload silently reverted (WU-12 review) |
| D-80 | **Build-file writer details** (WU-22, WU-13; C-16, C-17).<br>• The changed-on-disk check compares size + sha1 and ignores mtime (`src/services/buildFileWriter.ts:246, 288`).<br>• Backups are written exclusively; a second backup in the same timestamp gets `-1`. `restore_snapshot`'s backup goes to `<stateDir>/backups/<build>/`.<br>• `lua_save_build` checks for a `<PathOfBuilding2>` root before writing.<br>• The writer gains an optional `guard`, `checkBuildFile` and a per-target lock (additive), because `set_build_notes` and `restore_snapshot` run outside the engine lock | PROPOSED (build) | Concurrent writes shared a temp name and poisoned the fingerprint (WU-13 review) |
| D-81 | **Import, export, analyze and snapshot tools** (WU-13).<br>• `import_build` gains `overwrite`, since C-17 requires it to replace a file. `save_as` over the loaded file runs the changed-on-disk guard before the load; if the target changes between that check and the write, the result is `isError` with the import loaded but unsaved.<br>• `export_build`: a relative `output_directory` resolves inside the builds folder; symlinks resolve before the D-42 check; a state-dir export needs `overwrite`; a non-`<PathOfBuilding2>` source is refused even for a byte copy; notes are appended after a `---` separator (`src/services/buildExportService.ts:104`); whitespace-only notes count as empty.<br>• `analyze_build`/`compare_builds` fall back to file-only analysis with a note when the engine refuses a file. `analyze_build` no longer overrides the file's active spec or item set.<br>• Snapshots are keyed `snapshots/<rel incl .xml>/`; a same-millisecond second snapshot gets `-n`, written exclusively.<br>• `list_builds` returns sorted POSIX relative paths | PROPOSED (build) | `save_as` over the loaded file could overwrite a PoB2 save landing during the fetch (WU-13 review) |
| D-82 | **Advice details** (WU-18; D-30, FR-A1).<br>• The resistance judgment includes Chaos (`src/advice/judge.ts:17`).<br>• A gear slot is any shown, active slot whose name lacks "Jewel" (`judge.ts:55-57`).<br>• The load summary's Top Issues lists every issue, not the first 3, so it equals `get_build_issues` (AC-A4).<br>• A `build_name` resolving to the loaded build analyses the engine's build as is (`src/advice/report.ts:76`).<br>• `analyze_build`'s validation section uses `judge()` and reads named stat fields; Crit Multi shows `CritMultiplier × 100` there and in `compare_builds` (was always N/A) | PROPOSED (build) | — |
| D-83 | **README tool table** (WU-19; AC-G1). `pnpm docs:tools` generates it from the registry; each row's one-line description is the description's first sentence (`e.g.`/`i.e.`/`etc.`/`vs.` don't end it), with pipe characters escaped and `< >` as HTML entities (`scripts/gen-tool-table.mjs:7, 36`). README setup says "installs the dependencies with pnpm from the lockfile", because "pnpm install" contains AC-G2's banned "npm install"; `CLAUDE.md` keeps the literal bootstrap | PROPOSED (build) | — |
| D-84 | **`trade_generate_query` checks `report_stats` before generating** (final pass; C-13 amended, C-14 step 1, D-27). `find_upgrades` passes its `report_stats` to `trade_generate_query` as a new optional `reportStats` param (additive), which checks each name by `trade_evaluate_items`' rule before anything is generated (`pob-api/API/Trade.lua:338-360, 429-431`; `src/trade/findUpgrades.ts:184`). A bad name is `isError` naming `report_stats.<i>`, and no trade request is sent | PROPOSED (build) | `report_stats` was only checked at evaluation, after the search and fetch had spent rate-limit slots (final-pass skeptic T-F1) |
| D-85 | **A `find_upgrades` deadline bounds the session's own steps, not only the lock wait** (final pass; C-3 amended, D-22, D-75, NFR-4). In C-3 terms these are steps 2–4: the engine start, the crash restore and the disk-change reload.<br>• No step starts with less than 1 s left; the engine start is raced against the deadline.<br>• The restore and the reload get min(default timeout, time left) and end by abort 250 ms before the deadline, so the engine is not killed (`src/engine/session.ts:687`).<br>• A cut step throws `EngineDeadlineError` and leaves the books (snapshot, crash flag, `loaded`) for the next call; `find_upgrades` renders it as the budget stop, `isError` since no query exists yet.<br>• Query generation (C-14 step 6) likewise ends by the shared deadline abort, not by the bridge timeout's SIGKILL (`src/trade/findUpgrades.ts:598`) | PROPOSED (build) | A slow start or reload ran past the 90 s budget, and a cut generation killed the engine (final-pass skeptic T-F2, T-F3) |
| D-86 | **The changed-on-disk guard knows the server's own writes and every file the engine held** (final pass; C-17 step 3 amended, FR-E4).<br>• A text, byte or restore write to the loaded file also accepts the writer's own last write to it, so the server's earlier `set_build_notes` or `restore_snapshot` is not taken for a PoB2 save. An engine save still compares with `loaded.fingerprint` only, so it never clobbers that edit.<br>• The session reports every fingerprint the loaded file gets (a load, the disk check's refresh or reload, an engine save) to the writer (`onFileFingerprint`, `src/engine/session.ts:134`), which keeps the last one for the last 32 paths (`src/services/buildFileWriter.ts:278`). A write to a file that is no longer loaded compares with the later of that record and the writer's own last write, so loading another build, a new build, an import or a Save As re-point no longer drops the guard on the file the engine held | PROPOSED (build) | Back-to-back server edits were refused as "changed on disk" (final-pass skeptic S-F1); after a build switch, an overwrite of the previous file skipped the check even when PoB2 had saved it since (final-pass tracer) |
| D-87 | **The limiter never sends after a wait with less than 1 s before the deadline** (final pass; C-11 amended, D-22, R-1). Admission refuses a wait that would end with < 1 s left, and after any wait (the sleep, which can overshoot, or waiting for a class's first request) the limiter re-checks and refuses with `would_wait` without sending (`src/trade/rateLimiter.ts:125, 226-245`). Without a wait it does not refuse; the caller checks between steps | PROPOSED (build) | A request sure to be cut by the deadline still spends an account rate-limit slot (final-pass tracer) |
| D-88 | **`export_build` never writes into the server's `backups/` or `snapshots/`** (final pass; D-42, D-81 refined). An `output_directory` inside `<stateDir>/backups` or `<stateDir>/snapshots`, directly, through `..` or through a symlink, is `isError` naming that folder, even with `overwrite: true` (`src/services/buildExportService.ts:79, 156`). The rest of the state dir stays allowed | PROPOSED (build) | With `overwrite: true` an export could replace a writer backup or a snapshot copy (final-pass tracer) |
| D-89 | **Deadlines and elapsed time run on a clock that never steps** (final pass; D-22). The server's `now` defaults to `performance.timeOrigin + performance.now()` (`src/utils/clock.ts`), epoch-aligned and monotonic; the router's arrival time, the session, the trade client, the limiter and every `find_upgrades` deadline check use it (`ctx.now`, `src/trade/findUpgrades.ts:515`). Wall-clock uses (cache ages, timestamps, mtimes, file names) keep `Date.now()`. Tests measure durations with `performance.now()` | PROPOSED (build) | The WSL2 wall clock stepped backwards mid-test (AC-E8 measured -2431 ms); a step mid-call would stretch or cut a deadline |
| D-90 | **Short exact-item `Buy:` links** (found in the user's WU-20 smoke, 2026-10-06; replaces D-39's exact-item recipe; WU-24).<br>• **Why.** PoB's exact-item link repeats the whole weighted query, about 4,000 chars per link. Only about 6 listings fit in full under the D-53 cap, compact entries carried no link, and the client model left the URLs out of its summary.<br>• **The new link** uses the same URL form and league encoding as D-39, over a minimal query that pins the listing: `{query: {status: {option: <the search's status>}, name: <item name, omitted when empty>, type: <base type>, filters: {trade_filters: {filters: {account: {input: <seller account>}, price: {min: <amount>, max: <amount>, option: <listing currency>}}}}}}`. There is no `stats` array.<br>• **Compact entries** also carry the link: the D-53 compact line ends with ` · Buy: <whisper or link>`.<br>• **The `find_upgrades` description** tells the client to show each listing's `Buy:` line verbatim.<br>• **Accepted risk.** One seller listing two items with the same name, base and price will open both. | HUMAN (2026-10-06) | The links must survive a model's summary and fit the budget |
| D-91 | **New tool `set_gem_corruption`** (user request, 2026-10-06; HG-3 resolved by the user; WU-25). It mirrors PoB2's gem corruption dropdown (`SkillsTab.lua` `corruptOption`):<br>• **`state`:** `not_corrupted` (`corrupted=false`, `corruptLevel=0`), `corrupted` (`true`, `0`), `plus_one_level` (`true`, `+1`) or `minus_one_level` (`true`, `−1`).<br>• **Scope:**<br>&nbsp;&nbsp;– `group_index` + `gem_index`: that gem;<br>&nbsp;&nbsp;– only `group_index`: every active skill gem in that socket group;<br>&nbsp;&nbsp;– neither: every active skill gem in the build's user socket groups.<br>• **Support gems can't be corrupted in PoE2** (the user). A scope never changes them, and naming a support gem explicitly is `isError` with nothing changed.<br>• **Engine kind and save.** The kind is `mutate`; the state round-trips through the build XML (`corrupted`, `corruptLevel`).<br>• **Tool counts** become 77, or 76 with `POE_NINJA_DISABLED`. | HUMAN (2026-10-06) | PoB2's UI offers it, and armour such as "+1 to Level of all Corrupted Skill Gems" needs it |
| D-92 | **What the build of WU-24 and WU-25 decided** (2026-10-06).<br>• **Link name.** The D-90 link's name comes from the fetched item's own `name`, so magic and normal items have none.<br>• **Hard cap.** If even the compact lines with their `Buy:` would pass 30,000 chars, the last compact lines drop their `Buy:`. The D-53 cap stays hard; this can't happen with trade-site-length links.<br>• **Corruption scope.** `set_gem_corruption` scopes cover only *user* socket groups, those without a PoB `source` attribute. An explicit item- or passive-granted group is `isError`.<br>• **Which gems count as support.** A gem whose primary granted effect is a support counts as a support (e.g. Fiery Death), even when it also grants an active effect.<br>• **Empty scope.** A scope with no active skill gems is `isError`, with nothing changed. | PROPOSED (build) | `src/trade/links.ts`, `src/trade/renderUpgrades.ts`, `pob-api/API/BuildOps.lua` `isActiveSkillGem` |

## 7. Autonomy envelope

### 7.1 Settled (proceed, don't relitigate)

Everything in §6, every `C-n` in §3, and the vision's §4 tool-disposition table.

### 7.2 Assumptions (proceed-on)

| ID | Assumption | Basis | If wrong |
|---|---|---|---|
| A-1 | trade2 request and response shapes are as in `tests/fixtures/trade2/` | 36 captured fixture files, logged-in ones included | WU-20 smoke catches it → HG-5 |
| A-2 | Rate-limit triples are `max:window:penalty` and state triples are `hits:window:activePenaltyS` | GGG docs + PoB + fixtures | — |
| A-3 | trade2's complexity budget is ~200, and D-23's model over-estimates. Observed vs model: belt 9 vs 23; ring 9 vs 23; body-armour 11 vs 11; and-3 12 vs 14; weighted-session 180 vs 191 | 5 fixture data points | D-23's single retry covers it |
| A-4 | Fetch takes ≤ 10 ids per request | PoB block size; never exceeded | — |
| A-5 | `Retry-After` is integer seconds | GGG docs | — |
| A-6 | An expired or invalid cookie is treated as anonymous (400 code 2 without `Account` on a weighted query) | inference (S-4) | WU-20 records the real response |
| A-7 | poe.ninja's `league` parameter accepts trade league names | our client and PoB both pass trade names | rates unavailable → D-11 fallback; WU-20 checks |
| A-8 | Claude Code sends a `progressToken` on `tools/call` | docs imply it (ctx-mcp C7) | no progress; harmless |
| A-9 | `fetch` results for weighted queries carry `pseudoMods[0]` "Sum: <w>" | fixture `fetch-weighted-session` (10/10) | — |
| A-10 | The trade server's price filter with no `option` means Exalted-equivalent, using the server's own rates | PoB default; S-4 | the D-11 post-filter catches disagreements |
| A-11 | Windows PoB2 saves change `size` or `mtimeMs` as seen from WSL | `/mnt/c` is mounted 9p with `cache=5` (mmap, no metadata cache; kernel v6.6 9p doc), so `stat` isn't cached | WU-20 item 6 verifies; if wrong, hash with sha1 on every engine call |
| A-12 | Golden values: the fixture's 109 `PlayerStat` pairs are the truth at pin `v0.23.1` | WU-01 verification | HG-4 |
| A-13 | For a **weighted** query sent with a cookie, a 400 code 2 with `Account` in the rules means over-complexity, and without it means the session wasn't recognised | S-4 (200 with `Account,Ip`); 3 anonymous fixtures (400 with `Ip`) | WU-20 records what it sees |
| A-14 | poe.ninja `core.rates[c]` = units of `c` per 1 primary | Fixture arithmetic: 440.6 × 0.00227 ≈ 1 | `lines[].primaryValue` (documented) is the cross-check |
| A-15 | Share sites (pobb.in, pastebin) accept the browser-compatible UA of D-25 | inherited code comment | WU-20 imports from a pobb.in URL |

### 7.3 Human-decision gates (stop and escalate, `blocked:needs-human`)

| ID | Condition | Why a human | Unblocks with |
|---|---|---|---|
| HG-1 | A unit needs a live request to pathofexile.com or poe.ninja | Shared IP/account limits; the user's cookie | User approval, then the coordinator runs it |
| HG-2 | Any change to `pob-pin.json` (a tag bump) | Golden values move; upgrade procedure | User decision (out of scope for this epic) |
| HG-3 | Any change to the tool set beyond the §4 disposition table, or to a tool's user-visible semantics beyond its row and D-51 | UX scope | User decision |
| HG-4 | Golden values fail on an unmodified pinned checkout | The environment or the fixture is broken; not a code bug | The coordinator investigates with the user |
| HG-5 | Observed trade2 behaviour contradicts the fixtures or an assumption A-1…A-15 in a way that changes a contract | Contract change | The coordinator updates the spine, re-reviews, and the user approves |
| HG-6 | A test or agent would write anywhere in the user's real builds folder, or delete any user file | Data safety | Never automatic |
| HG-7 | Claude Code can't connect to the server (for example the v2 client runtime changes negotiation) | Host-environment fact | The user tries `MCP_SDK_GENERATION=v1` or approves an SDK upgrade |
| HG-8 | A commit or push needs signing or credentials an agent can't provide | Credentials | D-48 sign-rebase with the user present |
| HG-9 | WU-20 or WU-21 acceptance (live smoke, final sign-off) | Only the user can run with their cookie and PoB2 on Windows | The user's work-log entry |

## 8. Work-unit graph (all slices)

Full blocks (kind, depends-on, touches, produces, consumes, acceptance, milestone) are in the slice
specs. This table is the DAG. Edges are functional dependencies; shared-file contention is handled by
the serialized-wiring rule below.

| WU | Title | Slice | Depends on | Milestone |
|---|---|---|---|---|
| WU-01 | Fixtures (golden build, poe.ninja, trade2 logged-in + data) | 01 | — | M-0 **DONE** |
| WU-02 | PoB pin and toolchain | 01 | WU-01 | M-1 |
| WU-03 | Server factory, error surface, dependency threading, test harness | 01 | WU-02 | M-1 |
| WU-04 | Deletions (D-4) and the PoE1-cruft scan | 01 | WU-03 | M-1 |
| WU-05 | Golden, disposition and hygiene tests | 01 | WU-04 | M-1 |
| WU-06 | Engine wire protocol v2 (Lua side + TS readiness probe) | 02 | WU-05 | M-2 |
| WU-07 | Bridge client v2 (TS side) | 02 | WU-06 | M-2 |
| WU-08 | Engine session (lock, revision, recovery, disk change, canonical paths, load guard) | 02 | WU-07 | M-2 |
| WU-22 | Build-file writer, state dir, `lua_save_build` | 02 | WU-08 | M-2 |
| WU-09 | Contract schemas and shape fixes (A3) | 02 | WU-08, WU-16 | M-3 |
| WU-10 | Engine ops: tree and specs | 02 | WU-09 | M-3 |
| WU-11 | Engine ops: items, gems, skills | 02 | WU-09 | M-3 |
| WU-12 | Engine ops: config and presets | 02 | WU-09, WU-22 | M-3 |
| WU-13 | Engine ops: build files, snapshots, import/export, watcher | 02 | WU-10, WU-22 | M-3 |
| WU-14 | Credentials, trade HTTP client, rate limiter | 03 | WU-04 | M-α |
| WU-15 | Mod parsing, currency, kept trade tools | 03 | WU-14 | M-α |
| WU-16 | Lua trade actions | 03 | WU-07 | M-α |
| WU-17 | `find_upgrades` search pipeline (C-21) + `trade_query_options` tool | 03 | WU-08, WU-15, WU-16 | M-α |
| WU-23 | `find_upgrades` evaluation, pricing, ranking, output + tool | 03 | WU-17 | M-α |
| WU-18 | Advice on engine data (C) | 04 | WU-11, WU-13 | M-3 |
| WU-19 | Docs, setup, README tool table, fresh-clone check | 04 | WU-23, WU-18, WU-12 | M-3 |
| WU-20 | Human live smoke (alpha) | 04 | WU-22, WU-23 | M-α |
| WU-24 | Short exact-item `Buy:` links (D-90) | 03 | WU-23 | post-smoke |
| WU-25 | `set_gem_corruption` tool (D-91) | 02 | WU-11 | post-smoke |
| WU-21 | Human final acceptance | 04 | WU-19, WU-20 | M-3 |

**Critical path:** WU-02 → WU-03 → WU-04 → WU-05 → WU-06 → WU-07 → WU-08 → WU-17 → WU-23 → WU-20.
WU-22 runs alongside WU-17/WU-23.

**Parallel lanes:**
- WU-14 → WU-15 runs alongside WU-05…WU-08.
- WU-16 runs alongside WU-08.
- After WU-08 and WU-16, the A3/B lane (WU-09 → {WU-10 → WU-13, WU-11, WU-12}) runs alongside WU-17/WU-23.

**Serialized-wiring rule** (vision §6). These files are shared:
- `src/server/toolSchemas.ts`, `src/server/toolRouter.ts`, `src/server/toolMeta.ts`;
- `src/index.ts`, `src/server/createServer.ts`, `src/utils/contextBuilder.ts`;
- `src/handlers/luaHandlers.ts`, `src/handlers/tradeHandlers.ts`, `src/utils/buildCode.ts`;
- `src/pobLuaBridge.ts`, `src/engine/schemas.ts`;
- `pob-api/API/Handlers.lua`, `pob-api/API/BuildOps.lua`;
- `package.json`, `pnpm-lock.yaml`, `jest.config.cjs`, `mise.toml`;
- `tests/integration/contract.test.ts`;
- `tests/fixtures/tool-calls.json`, `tests/fixtures/tool-hygiene-allowlist.json`,
  `tests/fixtures/tool-disposition.json`, `tests/static/poe1-cruft-waivers.json`.

Edits to these files are short wiring steps, merged one unit at a time in DAG order. Concurrent units
rebase before merging.

**Dependency rule.** Only WU-02 changes dependencies (`package.json`/lockfile). The single sanctioned
exception is WU-14 removing `bottleneck`; WU-14 comes after WU-02 in the DAG. Any other dependency need
is HG-3-adjacent: stop and ask the coordinator.

**Implied scope.** A unit's `touches` implicitly include:
- its own new files;
- the test files its ACs name;
- the existing tests of modules it changes or deletes.

## 9. Operational guardrails

- **Budget and loop guard.**
  - One unit per agent context.
  - If the unit's gate fails with the **same failure signature 3 times in a row**, stop and escalate
    (`blocked:loop`) with the failing output.
  - A unit that needs to touch a file owned by a not-yet-merged unit stops and reports, rather than
    editing it.
- **Identity and secrets.**
  - Agents never read, print, grep or source `.env`, and never set `POESESSID`.
  - Tests run with C-18's setup: credentials scrubbed in `globalSetup`, live `fetch` disabled, temp
    `POB_DIRECTORY` and `XDG_STATE_HOME`, and spawned servers given an explicit safe env.
  - No identity (name, email) in any request, fixture or commit content except git authorship.
  - The User-Agent is D-25's.
- **Network.**
  - Agents may reach GitHub (`mise run pob:fetch`, package registries).
  - They may never reach pathofexile.com or poe.ninja (D-34, HG-1).
- **Filesystem.**
  - Agents write only inside their worktree and the temp dirs tests create.
  - Probes that start the server or engine run with an explicit temp cwd, never the repo root.
  - The user's builds folder (`/mnt/c/...`) is off-limits (HG-6).
- **Worktree bootstrap** (each new worktree): `mise trust && pnpm install --frozen-lockfile && mise run
  pob:fetch`. A mise command run before `mise trust` fails with rc 1.
- **Commits:** see D-48.

## 10. Risk register

| ID | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R-1 | **Account risk.**<br>• trade2 is an undocumented internal API.<br>• GGG's docs say reverse-engineering endpoints outside their docs is against ToS 7i, and executable apps must use a public OAuth client, which is unavailable.<br>• The user was informed when OAuth was ruled out (2026-10-03) and chose the cookie path. | low / high (account) | User-initiated calls only (no polling). The limiter obeys every server rule with margin 1 (C-11). Honest UA (D-25). Minimal requests per call (D-22) |
| R-2 | trade2 shapes drift (an undocumented API) | medium / medium | Fixture-based parsers tolerate unknown fields. WU-20 smoke. HG-5 |
| R-3 | The complexity budget differs from the model | low / low | D-23's single retry, then link fallback |
| R-4 | The expired-cookie response differs from A-6 | medium / low | Classification uses the `Account` header (A-13). WU-20 records the real response |
| R-5 | Several Claude sessions share limits | medium / medium | D-35. Lockouts surface as `locked_out`/`rate_limited`, with the wait time |
| R-6 | Windows-side saves aren't detected | low / medium | D-19 checks the fingerprint on every engine call (the watcher isn't needed). A-11. WU-20 verifies |
| R-7 | Claude Code's v2 client runtime (protocol 2026-07-28) breaks negotiation with SDK 1.20.2 | low / high | Verified working 2026-10-03. HG-7 with `MCP_SDK_GENERATION=v1` |
| R-8 | dkjson encoding quirks break schemas (`{}`→`[]`, NaN→null) | high / low | C-5 schemas accept both. AC-E24 runs every action on the golden build |
| R-9 | Parallel units conflict on shared files | medium / medium | §8 serialized-wiring rule. Dependency changes only in WU-02 (and WU-14's `bottleneck` removal) |
| R-10 | A future pin bump breaks `Trade.lua` and `construct()` | certain (later) / medium | Out of scope. Golden and trade tests guard it. Upgrade procedure in S-2 |
| R-11 | Backward compatibility: removed tools and env vars break an existing registration | low (single user, not yet registered) / low | §11 lists every break. README migration notes |
| R-12 | The engine is blocked ≤ 8 s per `find_upgrades` generation while it holds the lock | certain / low | Single user. Other calls wait (D-8a). Query cache (C-14) |
| R-13 | poe.ninja league ids ≠ trade league names, or poe.ninja blocks our client (D-25 deviation) | medium / low | D-11 fallback path. WU-20 checks |
| R-14 | Case-variant build names on drvfs alias one file | certain / high (if unmitigated) | D-52 canonical paths; a unit test with a case-insensitive fs; WU-20 step |

## 11. Migration and compatibility

- **Removed tools (25 + `find_item_upgrades`):** listed in D-4. `find_item_upgrades` → `find_upgrades`.
  `save_tree` → `lua_save_build` (C-17). Old names return JSON-RPC unknown tool.
- **Env vars:**

  | Status | Variables |
  |---|---|
  | Removed | `POB_LUA_ENABLED`, `POE_TRADE_ENABLED`, `POB_LEGACY_GEM_TOOLS`, `POE_TRADE_USER_AGENT`, `POE_RATE_LIMIT_PER_SECOND`, `POE_CACHE_TTL` |
  | Added | `POE_TRADE_DISABLED`, `POESESSID` (`POE_SESSION_ID` stays as an alias), `POE_LEAGUE`, `POB_ALLOW_UNPINNED`, `POB_SKIP_ENGINE` (tests), `POB_API_TEST_ACTIONS` (tests), `POB_TEST_ENGINE` (set by Jest `globalSetup`) |
  | Changed meaning | `POB_TIMEOUT_MS` is now per request, measured from the write. `POB_FORK_PATH` still names the checkout's `src/`, but its default is now `vendor/`. The **default `POB_DIRECTORY`** changes from `~/Documents/Path of Building/Builds` (and a macOS variant) to `~/Documents/Path of Building (PoE2)/Builds` |
  | Kept (unchanged) | `POB_DIRECTORY`, `POB_CMD`, `POB_ARGS`, `POB_DEBUG`, `POE_NINJA_DISABLED`, `POE_TRADE_BASE`, `POE_TRADE_REALM`, `XDG_STATE_HOME` (standard) |

- **State:** moves to C-16 in WU-22. No data migration (none exists for this user).
- **Bridge protocol:** v1 → v2 lands in WU-06. Its Lua side, and the TS readiness change, are in one merge.
  The v1 TS request path tolerates v2 replies until WU-07 (it ignores ids and extra fields), and WU-07
  then requires `apiVersion` major `2`.
- **Cutover:** each unit is one merge on `stabilization/foundation`. Roll back by reverting that merge.
  The user's MCP registration (D-16) happens at WU-20.

## 12. Test and verification strategy

**Test classes:**

| Class | Location | What it covers | Allowed fakes | Runs in |
|---|---|---|---|---|
| Unit | `tests/unit/` (+ 4 legacy root suites) | pure TS: limiter, credentials, classification, parsers, currency, pin check, prefit, path canonicalization | fakes of our own collaborators, only as the AC names them; fake clock | `pnpm test` |
| In-process MCP | `tests/mcp/` | C-1 behaviour through `InMemoryTransport` + `Client` | real `Client`, router, handlers and session; HTTP only via `fixtureFetch`; a mock `spawn` only where the AC names it | `pnpm test` |
| Engine-required | `tests/integration/` | real luajit + `vendor/` pin + golden build: C-2, C-3, C-5, C-13 and every engine AC | real luajit and bridge; HTTP via `fixtureFetch` | `pnpm test`; **fails** without the engine unless `POB_SKIP_ENGINE=1` |
| Lua-direct | `tests/integration/` | the C-2 wire protocol, spoken by a minimal line client | real luajit | as engine-required |
| Stdio e2e | `tests/e2e/` | `build/index.js` spawned via `spawnServer`: stdin-EOF exit, stdout purity (NFR-8) | none (trade and ninja disabled by env) | `pnpm test` (after `pnpm build`, which `mise run test` does) |
| Static | `tests/static/` | I-5 cruft scan, env-var grep (D-14, D-25), README tool table (AC-G1), test-spawn env check | — | `pnpm test` |
| Script check | the verifier, recorded in the work-log | AC-F2, F6, F7, F8, F9, F17, AC-G4 | — | by hand, with exit codes |
| Human | WU-20, WU-21 | live trade, Windows PoB2 interplay, registration | — | the user |

**Fidelity rule.** A test that claims an AC must assert the *spec's* behaviour across the real seam its
class names, using only that class's allowed fakes. Every HTTP-sending AC asserts the requests that
`fixtureFetch.calls` recorded.

**Unit gate.** Before a unit is `done`, an independent verifier (not the doer) confirms:
1. `mise run test` exits 0 and `pnpm build` exits 0 (exit codes captured);
2. every AC in the unit's `acceptance` list maps to a named test (or a recorded script check) that
   passes and meets the fidelity rule for its class;
3. a code-diff review finds no correctness defects;
4. the hygiene allowlist and the cruft waivers changed only by removals of entries that now pass, plus
   additions this spec authorizes (D-45);
5. no file outside the unit's `touches` (plus implied scope, §8) changed, except the shared files under
   the serialized-wiring rule.

**Non-functional requirements** (each owned by an AC):

| NFR | Threshold | Condition | Owner AC |
|---|---|---|---|
| NFR-1 | Engine cold start to the first `ping` reply ≤ 5 s | this box, vendor pin | AC-E8 |
| NFR-2 | `checkPin()` ≤ 1 s | full vendor checkout | AC-F3 |
| NFR-3 | `find_upgrades` ≤ 15 s end to end | golden build, Body Armour, fixture fetch, no limiter waits | AC-T40 |
| NFR-4 | `find_upgrades` returns ≤ 90 s (+1 s) after the call arrives | any conditions, including lock waits and hung steps | AC-T34 |
| NFR-5 | `trade_generate_query` ≤ 8 s | any supported slot, golden build | AC-T22 |
| NFR-6 | Post-change snapshot ≤ 100 ms | golden build | AC-E22 |
| NFR-7 | `tools/list` answered ≤ 1 s after `initialize` | `fetch` and `spawn` mocked to fail | AC-F10 |
| NFR-8 | Every stdout line is a valid JSON-RPC 2.0 message | stdio e2e session, including an engine call | AC-F12 |
| NFR-9 | Zero trade requests sent that would exceed any window's `max − 1` | limiter simulation over fixture headers | AC-T5 |
| NFR-10 | `find_upgrades` output ≤ 30,000 characters | `limit: 20`, `include_non_upgrades: true`, fixtures | AC-T40 |

## 13. Constraints

- **Runtimes:**
  - Node 24 (no move to ≥ 25 while relying on corepack);
  - pnpm 11.6.0;
  - LuaJIT ref `2460b3ff` + luautf8 0.1.6-1, via mise.
- **Pinned dependencies:**
  - PoB2 `v0.23.1` (`7d6f530`), **read-only**: no PoB files are modified, and `pob-api/` is our only Lua;
  - `@modelcontextprotocol/sdk` 1.20.2, no upgrade in this epic;
  - zod 3.
- **Platform and layout:**
  - code lives under `~/projects/pob2-mcp`;
  - the user's builds are on case-insensitive drvfs `/mnt/c`;
  - WSL2.
- **Outbound hosts:**
  - pathofexile.com (trade2) and poe.ninja, at runtime only, when the user calls a tool;
  - pobb.in and pastebin (`import_build`);
  - github.com (pin fetch).
- **Secrets:** the user's `.env` holds `POESESSID` in plaintext. This is a HUMAN exception for this
  project only. Nothing else is persisted.
