# Slice 01: Foundation (pin, toolchain, server factory, harness, deletions, golden tests)

Part of the [spec spine](README.md). It references the spine's `C-n`, `D-n`, `A-n`, `HG-n` and `R-n` by ID.
Work units WU-01…WU-05; acceptance criteria AC-F1…AC-F28.

This slice creates the substrate every other slice builds on:
- a reproducible, verified PoB2 engine;
- one-command setup and test gate;
- a side-effect-free server module with a correct MCP error surface and injected I/O;
- a test harness that cannot reach live services or the user's files, including from spawned children;
- the deletion of the PoE1 and broken tools;
- regression tests for the golden build, the tool set, and tool output hygiene.

## 1. Existing system context (this slice)

Citations are at commit `968a104`; detail is in [grounding/ctx-ts.md](../grounding/ctx-ts.md).

- **Startup (`src/index.ts`).**
  - `new PoBMCPServer()` and `run()` execute at module top level (`:403-404`).
  - The constructor installs EPIPE/SIGINT/SIGTERM listeners (`:161-184`).
  - `run()` awaits a trade2 `/data/stats` GET before `server.connect()` when `POE_TRADE_ENABLED=true`
    (`:377-397`).
  - There is no stdin-EOF handling, and the SDK's `StdioServerTransport` doesn't listen for EOF
    (`stdio.js:27-34`).
  - The CallTool handler ignores the request's `extra` (signal, `_meta`, `sendNotification`)
    (`:320-337`).
  - The server reports version `0.1.0` (`:72`), while `package.json` is `0.2.2`.
- **Error surface.** The CallTool catch (`index.ts:355-370`) returns `"Error: <msg>"` text with **no
  `isError`**. Handler paths that return error text as success:
  - `treeHandlers.ts:186-194` and `:338-346`;
  - `buildHandlers.ts:188-197`;
  - `luaHandlers.ts:790`, `:842`, `:857` ("Failed to … spec.");
  - `poeNinjaHandlers.ts:188-197` (deleted in WU-04).

  `ToolResponse` is declared twice (`responseUtils.ts:6-11`, `toolRouter.ts:49-54`), and neither
  declaration has `isError`. An unknown tool comes back as text. 21 tools are truncated to 5000 characters
  (`index.ts:340-348`, `responseUtils.ts:21,45`).
- **I/O is not injectable.**
  - `pobLuaBridge.ts:1,128` imports and calls the global `spawn`.
  - `tradeClient.ts:231`, `poeNinjaClient.ts:149` and `buildCode.ts:62` call the global `fetch`.
  - `index.ts:105` constructs `PoeNinjaClient()` with no dependencies.
- **Listing and routing.** Listing is gated in `index.ts:273-317`:
  - engine, config and build-goals tools appear only with `POB_LUA_ENABLED=true`;
  - legacy gem tools only with `POB_LEGACY_GEM_TOOLS=true`;
  - trade tools only with `POE_TRADE_ENABLED=true`;
  - poe.ninja tools unless `POE_NINJA_DISABLED=true`.

  The router (`toolRouter.ts:61-771`) routes all 100 names regardless of listing. Today there are 98
  registered and 100 routed (`analyze_cluster_jewels`, `find_resistance_gear` are routed-only).
  `luaClientManager.ts:29` contains the `POB_LUA_ENABLED` message.
- **Engine location.** `POB_FORK_PATH` is read in 3 places with 3 defaults:
  - `luaClientManager.ts:46` falls back to `pobLuaBridge.ts:77` `~/Projects/PathOfBuilding-PoE2/src`,
    which doesn't exist here;
  - `pobLuaBridge.ts:92` is dead;
  - `treeService.ts:57` falls back to a cwd-relative `TreeData`.

  The integration test adds a 4th default, the dev-head sibling. `pob-api` is located by
  `resolvePobApiDir()` (`pobLuaBridge.ts:22-38`, which probes from `argv[1]` and cwd).
- **Tests.**
  - `jest.config.cjs`: `roots: ['<rootDir>/tests']`, `testMatch: ['**/tests/**/*.test.ts']` (already
    covers every subfolder), `coverageThreshold` (75/85/80/80), and no setup files.
  - 17 suites, 4 of them at the `tests/` root: contextBuilder, errorHandling, treeService, watchService.
    `tests/contextBuilder.test.ts:22,69` asserts `luaEnabled`.
  - `tsconfig.test.json` compiles `src` as CommonJS, so `import.meta` is unusable (TS1343).
  - The integration suite (`tests/integration/poe2Bridge.test.ts:16-49`) skips when `HeadlessWrapper.lua`
    is absent, and passes with no assertions when the engine fails to start (E10).
- **PoE1 strings outside the deleted tools.** These survive WU-04's deletions:
  - `buildService.ts:326,431` (bandit) and `:931-1098` (cluster jewels);
  - `luaHandlers.ts:332,380`;
  - `exportHandlers.ts:218,244`;
  - `configHandlers.ts:285-287,338`;
  - `validationService.ts:478`;
  - `toolSchemas.ts` (several kept-tool descriptions, e.g. `:241,395,399,900,1024,1653,1754`).
- **Toolchain.**
  - `mise.toml` pins LuaJIT ref `2460b3ff` (+ luautf8) and `node = "24"`, sets `LUAROCKS_VERSION` in
    `[env]`, and has **no tasks**.
  - The installed LuaJIT asdf plugin (`asdf-mise-plugins-mise-lua-jit`) is at
    `bd4977ef2c2cfd0659a4bb39acb37bd5104fb7fc`.
  - `package.json` pins `pnpm@11.6.0`.
  - zod resolves only transitively (3.25.76, via the SDK), and so does `zod-to-json-schema` (3.24.6).
  - `@types/chokidar` and `@types/node-fetch` are unused.

## 2. Functional requirements

- **FR-F1.** The server's engine is the pinned PoB2 `v0.23.1` checkout, fetched reproducibly. A checkout
  that doesn't match the pin disables **only** the engine tools, with a fix-it hint.
- **FR-F2.** A fresh clone becomes a working server with one command (`mise run setup`), and the whole
  gate is one command (`mise run test`).
- **FR-F3.** The server can be constructed in-process, with injected env, `fetch`, `spawn` and
  credentials, and no side effects. The process exits cleanly, and reaps luajit, when the host closes
  stdin.
- **FR-F4.** Every tool failure reaches the host as an MCP tool error (`isError: true`). Unknown tools are
  protocol errors. The MCP request's cancellation signal and progress channel reach the router.
- **FR-F5.** By construction, tests can't reach pathofexile.com or poe.ninja, can't see a real cookie,
  and can't write to the user's builds folder. This holds in the Jest worker and in every process a test
  spawns.
- **FR-F6.** The 25 PoE1-only, broken, inert or redundant tools (D-4) and `find_item_upgrades` are gone,
  and so is their plumbing.
- **FR-F7.** The gate fails on any regression of the golden build's stats, of the tool set, or of tool
  output hygiene.

## 3. Interface contracts defined in this slice

### C-1: MCP tool surface (modified)

- **Transport and identity.**
  - stdio, SDK 1.20.2 low-level `Server`, protocol revision 2025-06-18.
  - Server info: `{name: "pob2-mcp-server", version: <package.json version>}`.
  - Capabilities: `tools`, `resources` (build resources unchanged).
- **Results.**
  - Success: `{content: [{type: "text", text}]}`.
  - **Tool-execution error: `{content: [{type: "text", text: <actionable message>}], isError: true}`.**
    The router sets this centrally for any error thrown by a handler (D-27). The stack goes to stderr,
    never into content.
  - **Unknown tool:** throw `McpError(ErrorCode.InvalidParams, "Unknown tool: <name>")` (from
    `@modelcontextprotocol/sdk/types.js`). The JSON-RPC error has code −32602, and its message
    **contains** `Unknown tool: <name>` (the SDK prefixes `MCP error -32602: `).
- **Router signature.**
  `routeToolCall(name, args, deps, call: { signal: AbortSignal; progressToken?: string|number; sendProgress(progress: number, message?: string): Promise<void>; arrivedAt: number })`.
  - The CallTool handler builds `call` from the SDK `extra` (`extra.signal`, `extra._meta?.progressToken`,
    `extra.sendNotification`).
  - `sendProgress` is a no-op when there is no token. Otherwise it sends `notifications/progress
    {progressToken, progress, message}`.
  - The router passes `call.signal` and the deadline into `session.run` (C-3), and passes `call` to
    handlers that need it (`find_upgrades`).
- **Listing.** All tools are listed by default. A tool is hidden **and** unroutable when its group is
  disabled: `POE_TRADE_DISABLED=true` hides group `trade`, and `POE_NINJA_DISABLED=true` hides group
  `ninja` (C-8). `POB_LUA_ENABLED`, `POE_TRADE_ENABLED` and `POB_LEGACY_GEM_TOOLS` are no longer read
  (D-14).
- **Constraints.**
  - Tool descriptions are ≤ 2048 characters (Claude Code truncates longer ones).
  - No `structuredContent`/`outputSchema` (D-36).
- **The single response type** is `ToolResponse = {content: Array<{type: "text"; text: string}>; isError?:
  boolean}` in `src/server/responseUtils.ts`. The duplicate in `toolRouter.ts` is removed.
- **Truncation.** The 5000-character truncation list survives as today's list minus the deleted tools.
  `find_upgrades` and `trade_query_options` are **not** on it; D-53 bounds them.
- **The tool set** after the epic equals the vision §4 table (76 names). The interim sets are fixed by
  `tests/fixtures/tool-disposition.json` (WU-05).

### C-6: PoB pin (new)

- **`pob-pin.json`** (repo root, committed):
  ```json
  {
    "repo": "https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git",
    "tag": "v0.23.1",
    "commit": "7d6f530cbdab20389ff8bc6ba97a37ac27f74e41",
    "version": "0.23.1",
    "headlessWrapperSha1": "77a3e3a9b7387ebc57ef0a35bb17c382282e3c7c"
  }
  ```
- **`scripts/fetch-pob.sh`** is S-2's tested script ([S-2 § Pin mechanism](../spikes/S-2-pin-v0.23.1.md)), with
  these changes:
  - `git -c advice.detachedHead=false` on the clone and checkout;
  - it keeps `set -euo pipefail`, the idempotent early exit, the sparse pattern and the final
    `rev-parse HEAD` assertion;
  - its destination is `vendor/PathOfBuilding-PoE2`.
- **`src/utils/packageRoot.ts`** exports `packageRoot(): string`. It walks up from
  `path.dirname(process.argv[1])` to the first directory containing `pob-pin.json`, else walks up from
  `process.cwd()`, else returns `process.cwd()`. The result is memoized. It never uses `import.meta`.
- **`src/engine/pobPath.ts`** exports:
  - `resolvePobSrc(env)`, which returns `env.POB_FORK_PATH` (the checkout's `src/`) or
    `<packageRoot>/vendor/PathOfBuilding-PoE2/src`;
  - `resolvePobApiDir()`, which returns `<packageRoot>/pob-api`.

  These are the **only** readers of `POB_FORK_PATH` in `src/`, and they read it from the passed env.
  `luaClientManager`, `pobLuaBridge` and `treeService` call them.
- **`src/engine/pinCheck.ts`** exports
  `checkPin({pobSrc, pin, allowUnpinned}) → Promise<{ok: true, warnings: string[]} | {ok: false, reason: string, hint: string}>`.
  Checks, in order:
  1. `<pobSrc>/../manifest.xml` exists and `<Version number>` equals `pin.version`.
  2. If `<pobSrc>/../.git/HEAD` exists, its trimmed content equals `pin.commit`. A `ref: …` HEAD fails
     with "not a pinned detached checkout".
  3. Every manifest `<File name part sha1>` whose file is present under its part root matches. The part
     roots are: `default` → checkout root; `program`/`tree` → `src/`; `runtime` → `runtime/`.
     - `{space}` in a name means a space.
     - Absent files are skipped.
     - A file's sha1 is computed over its content after normalizing line endings to CRLF
       (`re.sub(rb"\r\n?|\n", b"\r\n")`), unless it contains a NUL byte, in which case the raw bytes
       are hashed. This is PoB's `update_manifest.py:104-108` scheme.
  4. The CRLF-normalized sha1 of `<pobSrc>/HeadlessWrapper.lua` equals `pin.headlessWrapperSha1`.

  A failure returns `hint: "run \`mise run pob:fetch\`"`. With `POB_ALLOW_UNPINNED=true`, failures
  become `warnings` and `ok: true`. **Only `ok` results are memoized** (per `pobSrc`), so the check
  passes after a fix without a server restart.
- **`pob-api/API/Util.lua`** exposes `construct(className, ...)` using S-2's version-portable rule:
  `NEW_STYLE = not debug.getinfo(new,'u').isvararg`. When `NEW_STYLE` is true it calls
  `new(c)` then `[c](...)`; otherwise `new(c, ...)`. Call sites are switched in WU-10/WU-11 (E3).

### C-7: Server factory (new)

```ts
// src/server/createServer.ts
export interface ServerDeps {
  version: string;                         // package.json version (read by the entry)
  env: Readonly<Record<string, string | undefined>>;   // the ONLY env source below the entry
  pobDirectory: string;                    // D-16; this user: the Windows PoB2 Builds folder
  stateDir: string;                        // C-16: ${XDG_STATE_HOME:-~/.local/state}/pob2-mcp
  fetch: typeof globalThis.fetch;          // every outbound HTTP goes through this
  spawn: typeof import('child_process').spawn;   // the engine process factory
  credentials: () => Credentials;          // C-9; until WU-14 a stub returning {sessionId: null, source: null}
  now?: () => number;
}
export function createServer(deps: ServerDeps): { server: Server; engine: EngineSession; shutdown(): Promise<void> };
```

- **No side effects at construction.** Constructing it makes **no network request, spawns no process,
  writes no file and registers no process listener.** Filesystem reads are allowed.
- **Dependency threading** (WU-03):
  - `deps.fetch` reaches the trade client, the poe.ninja client and `buildCode`'s share-site fetch;
  - `deps.spawn` reaches the bridge, via the engine manager (later the session);
  - `deps.env` replaces every `process.env` read below the entry;
  - `deps.stateDir` and `deps.pobDirectory` are available in every handler context.
- **Engine handle.** `engine` is the engine session (C-3). Before WU-08 it is the existing manager
  behind a thin interface.
- **Shutdown.** `shutdown()` stops the watcher and the engine (it sends `quit`, waits ≤ 2 s for `exit`,
  then sends SIGKILL), then closes the server.
- **`src/index.ts` is the entry.** It is the only module that:
  - reads `process.env`;
  - computes defaults:
    - `pobDirectory` = `POB_DIRECTORY`, else `~/Documents/Path of Building (PoE2)/Builds`;
    - `stateDir` = `$XDG_STATE_HOME/pob2-mcp`, else `~/.local/state/pob2-mcp`;
  - constructs deps, using the real `fetch` and `spawn`;
  - connects `StdioServerTransport`;
  - installs `process.stdin` `end`/`close` → `shutdown()` then `process.exit(0)`;
  - installs SIGINT/SIGTERM → the same;
  - installs stdout/stderr `EPIPE` → `process.exit(0)`.

### C-8: Tool registry metadata (new)

- **`src/server/toolMeta.ts`** exports
  `TOOL_META: Record<string, { engine: 'none' | 'read' | 'mutate' | 'load' | 'lifecycle'; group: 'core' | 'trade' | 'ninja' }>`.
  Every registered tool has exactly one entry.
- **What `engine` means** (verified by AC-E16's export comparison):
  - `none`: the tool never touches the engine.
  - `read`: the engine's build is unchanged after the call. This includes tools that use
    `withTemporaryBuild`, and `lua_save_build` (whose bookkeeping is `noteSaved`).
  - `mutate`: changes the engine's build.
  - `load`: replaces the engine's build.
  - `lifecycle`: starts or stops the engine.
- **Explicit kinds** for the tools whose kind isn't obvious from their bridge calls:

  | Kind | Tools |
  |---|---|
  | `lifecycle` | `lua_start`, `lua_stop` |
  | `load` | `lua_load_build`, `lua_reload_build`, `lua_new_build`, `import_build` |
  | `read` | `lua_save_build`, `analyze_build`, `compare_builds`, `export_build`, `export_build_summary`, `analyze_defenses`, `validate_build`, `get_build_issues`, `get_passive_upgrades`, `find_upgrades`, `trade_query_options` |
  | `none` | `list_builds`, `get_build_stats`, `get_build_notes`, `set_build_notes`, `snapshot_build`, `list_snapshots`, `restore_snapshot`, `compare_trees`, the watch tools, every `group: trade/ninja` tool except the two above |

  All other tools are `read` or `mutate`, depending on whether their Lua actions change build state.
- **Who uses it.**
  - Listing and routing use `group` (C-1).
  - The engine session (C-3, WU-08) uses `engine`.

### C-18: Test harness (new)

- **`tests/setup/global.ts`** is the Jest `globalSetup`. It runs once, before workers start, and
  changes the real `process.env` that workers and their children inherit. It:
  - deletes `POESESSID` and `POE_SESSION_ID`;
  - sets `POB_DIRECTORY` and `XDG_STATE_HOME` to fresh temp dirs, the first holding a copy of
    `tests/fixtures/builds/grenadator.xml`;
  - **probes the engine once**, unless `POB_SKIP_ENGINE=1`. The probe resolves the vendor path, runs
    `checkPin`, starts the bridge, sends `ping` and quits. It writes `POB_TEST_ENGINE=ok`, or
    `POB_TEST_ENGINE=<cause>` where the cause is one of "vendor missing (run `mise run pob:fetch`)",
    "pin mismatch: <reason>", "luajit not found (run via `mise run test`)", or "bridge start failed:
    <last stderr lines>".
- **`tests/setup/env.ts`** is the Jest `setupFiles` entry, run per test file. It replaces
  `globalThis.fetch` with a function that throws `Error("live network disabled in tests (D-34): <url>")`.
- **`tests/helpers/server.ts`** exports
  `startTestServer(overrides?: Partial<ServerDeps>) → Promise<{client: Client; deps: ServerDeps; session: EngineSession; close(): Promise<void>}>`.
  - It uses `InMemoryTransport.createLinkedPair()` (`@modelcontextprotocol/sdk/inMemory.js`) and an SDK
    `Client`.
  - Defaults: the throwing `fetch` above, the real `spawn`, and `credentials` returning `{sessionId:
    null, source: null}`. `env` is a copy of `process.env` with the overrides merged in.
  - Callers of slow tools pass `{timeout}` to `callTool`, because the SDK client's default is 60 s.
- **`tests/helpers/fixtureFetch.ts`** exports
  `fixtureFetch(routes) → {fetch, calls}`.
  - Each route is `{match: RegExp | ((url, init) => boolean), respond: {fixture: string} | {status, headers?, body} | ((url, init) => Response | Promise<Response>)}`.
  - A `fixture` route serves `tests/fixtures/<fixture>.response.json`, with status and headers from the
    sibling `.headers.json` when present.
  - `calls` records `{url, method, headers, body}` for every request.
  - **An unmatched URL throws** `Error("unmatched fetch: <url>")`.
  - **Aborts are honoured.** Every pending response, including a delayed one, rejects with
    `init.signal.reason` when `init.signal` aborts.
- **`tests/helpers/engine.ts`** exports `engineDescribe(name, fn)`. It is **synchronous**, because Jest
  forbids an async `describe`, and reads `process.env.POB_TEST_ENGINE`:
  - `ok` → it behaves like `describe`;
  - with `POB_SKIP_ENGINE=1` → `describe.skip`;
  - otherwise → it registers one failing test whose message is the cause.

  It never uses a sibling checkout.
- **`tests/helpers/spawnServer.ts`** exports `spawnServer(extraEnv?)`. It spawns `node
  <repo>/build/index.js` with an **explicit** env:
  - the scrubbed `process.env`;
  - the temp `POB_DIRECTORY` and `XDG_STATE_HOME`;
  - `POE_TRADE_DISABLED=true`, `POE_NINJA_DISABLED=true`, `POE_TRADE_BASE=http://127.0.0.1:9/api/trade2`;
  - `extraEnv`.

  With trade disabled, the server never reads `.env` or opens a trade connection.
- **`jest.config.cjs`** changes:
  - add `globalSetup: '<rootDir>/tests/setup/global.ts'` and `setupFiles: ['<rootDir>/tests/setup/env.ts']`;
  - set a global `testTimeout: 60000`;
  - **delete `coverageThreshold`** (D-32);
  - keep `roots` and `testMatch` unchanged; they already cover the new folders.

### C-19: Developer entry points (new)

`mise.toml` (D-32):

```toml
[tools]
"asdf:mise-plugins/mise-luaJIT" = { version = "ref:2460b3ff93a1c955de3d62cfc825de7d68dc272e", postinstall = "luarocks install luautf8 0.1.6-1", install_env = { LUAROCKS_VERSION = "3.12.2" } }
node = { version = "24", postinstall = "corepack enable" }

[tasks."pob:fetch"]
description = "Fetch the pinned PathOfBuilding-PoE2 checkout into vendor/"
run = "bash scripts/fetch-pob.sh"

[tasks.build]
run = "pnpm build"

[tasks.setup]
description = "First-time setup: dependencies, build, pinned PoB"
run = ["pnpm install --frozen-lockfile", "pnpm build", { task = "pob:fetch" }]

[tasks.test]
description = "The gate: pinned PoB present, fresh build, full test suite"
depends = ["pob:fetch"]
run = ["pnpm build", "pnpm test"]
```

- `install_env` scopes `LUAROCKS_VERSION` to the install.
- **Plugin pin.** Pin the LuaJIT plugin revision with mise's `[plugins]` `url#<full SHA>` form, using
  `bd4977ef2c2cfd0659a4bb39acb37bd5104fb7fc` under whichever key mise applies to
  `asdf:mise-plugins/mise-luaJIT` (the installed plugin is named `asdf-mise-plugins-mise-lua-jit`). mise
  rejects abbreviated SHAs. If mise can't apply a pin to this asdf-backend tool, drop it and record the
  limitation as an A-n (AC-F7).
- **Tasks contain no `|`**: mise's task shell is `sh -c -o errexit` without pipefail (ctx-tooling §6).
- Exit codes propagate.
- `pnpm test` = `jest` with no coverage.

## 4. Work units

### WU-01: Fixtures (golden build, poe.ninja, trade2 logged-in and data)
- kind: build
- status: **DONE 2026-10-03 (coordinator)**
- depends-on: []
- role: coordinator
- touches: [`tests/fixtures/builds/`, `tests/fixtures/poeninja/`, `tests/fixtures/trade2/` (new files + README rows)]
- produces: [fixtures consumed by C-18 routes]
- consumes: []
- acceptance: [D-12 procedure: the fixture sha1 is recorded and verified at 109/109 `PlayerStat` pairs on the tag]
- milestone: M-0
- summary: Committed:
  - `grenadator.xml` (sha1 `e0c16f3…`, `lastCharacterHash` blanked);
  - `poeninja/currency-overview.response.json`;
  - `trade2/{search,fetch}-weighted-session.*` (logged-in: `Account,Ip` rules, `Sum:` pseudo-mods, the
    instant-buyout listing shape);
  - `trade2/data-leagues.*` and `trade2/data-stats.*`.

  In total `trade2/` has 36 fixture files plus a README.

### WU-02: PoB pin and toolchain
- kind: build
- depends-on: [WU-01]
- role: build-infra
- touches: [`pob-pin.json` (new), `scripts/fetch-pob.sh` (new), `src/utils/packageRoot.ts` (new), `src/engine/pobPath.ts` (new), `src/engine/pinCheck.ts` (new), `pob-api/API/Util.lua` (new), `mise.toml`, `package.json`, `pnpm-lock.yaml`, `.gitignore`, `jest.config.cjs` (coverage block only), `src/server/luaClientManager.ts`, `src/pobLuaBridge.ts` (path resolution only), `src/services/treeService.ts` (path resolution only), `tests/integration/poe2Bridge.test.ts` (default path only)]
- produces: [C-6, C-19]
- consumes: []
- acceptance: [AC-F1, AC-F2, AC-F3, AC-F5, AC-F6, AC-F7, AC-F8, AC-F9]
- milestone: M-1
- summary: Changes:
  - Add the C-6 artifacts and `/vendor/` in `.gitignore`.
  - Replace the 3 `POB_FORK_PATH` readers and `resolvePobApiDir` with the resolvers.
  - Call `checkPin` in `luaClientManager.ensureClient` before spawn. On refusal, throw an error whose
    message contains the reason and the hint.
  - Update `mise.toml` to C-19, including the verified plugin pin.
  - Package changes:
    - `pnpm add zod@^3.25.76`;
    - `pnpm add -D zod-to-json-schema@3.24.6`;
    - remove `@types/chokidar` and `@types/node-fetch`;
    - keep `bottleneck` (WU-14 removes it).
  - Remove `coverageThreshold`.
  - **This is the only unit that edits dependencies** (§8 rule).

### WU-03: Server factory, error surface, dependency threading, test harness
- kind: build
- depends-on: [WU-02]
- role: backend-dev
- touches: [`src/index.ts`, `src/server/createServer.ts` (new), `src/server/toolRouter.ts`, `src/server/toolMeta.ts` (new), `src/server/responseUtils.ts`, `src/server/luaClientManager.ts`, `src/pobLuaBridge.ts` (`spawn` + env injection only), `src/services/tradeClient.ts` + `src/services/poeNinjaClient.ts` + `src/utils/buildCode.ts` (`fetch` injection only), `src/utils/contextBuilder.ts` (`stateDir`, env), `src/handlers/treeHandlers.ts`, `src/handlers/buildHandlers.ts`, `src/handlers/luaHandlers.ts` (spec error paths only), `jest.config.cjs`, `tests/setup/`, `tests/helpers/`, `tests/mcp/`, `tests/e2e/`, `tests/static/`, `tests/integration/poe2Bridge.test.ts`, `tests/contextBuilder.test.ts`]
- produces: [C-1 (error surface, listing, router call context), C-7, C-8, C-18]
- consumes: [C-6]
- acceptance: [AC-F10, AC-F11, AC-F12, AC-F13, AC-F14, AC-F15, AC-F16, AC-F17, AC-F27, AC-F28]
- milestone: M-1
- summary: Changes:
  - Split `index.ts` into `createServer(deps)` and the entry (C-7).
  - Thread `deps.fetch`, `deps.spawn`, `deps.env` and `deps.stateDir` through as C-7 says.
  - Move the startup `/data/stats` preload out of the startup path. It becomes lazy on the first trade
    tool call, through a `once()` in the router. WU-14 replaces the internals.
  - Central error mapping (C-1, D-27). Convert every listed error-text path to a throw: tree ×2,
    `analyze_build`, spec ×3.
  - The router signature with `call` (C-1).
  - Listing and routing by `TOOL_META.group`. Remove the `POB_LUA_ENABLED` gating (the engine becomes
    always available) and the `POE_TRADE_ENABLED` gating. Construct the trade client unconditionally
    (no I/O at construction).
  - Report the server version from `package.json`.
  - stdin-EOF shutdown.
  - Build the C-18 harness: global setup, setup file, `startTestServer`, `fixtureFetch`,
    `engineDescribe`, `spawnServer`.
  - Rewrite `tests/integration/poe2Bridge.test.ts` on `engineDescribe`, which fixes E10.
  - Update `tests/contextBuilder.test.ts` for the removed `luaEnabled`.

### WU-04: Deletions and the PoE1-cruft scan
- kind: build
- depends-on: [WU-03]
- role: backend-dev
- touches: [`src/server/toolSchemas.ts`, `src/server/toolRouter.ts`, `src/server/toolMeta.ts`, `src/server/createServer.ts` (truncation list), `src/handlers/*` (the deleted handlers, and the deleted parts of `tradeHandlers.ts` (`handleFindItemUpgrades`; the value scoring, D-61), `optimizationHandlers.ts`, `treeHandlers.ts`, `poeNinjaHandlers.ts`, `exportHandlers.ts`), `src/services/*` (the deleted services; `buildExportService.ts` `saveTree`; `buildService.ts` bandit and cluster-jewel parsing), `src/*.ts` (the deleted top-level modules), `src/pobLuaBridge.ts` (`getMasteryOptions`; `calcWith` `masteryEffects`), `pob-api/API/Handlers.lua` + `BuildOps.lua` (`get_mastery_options` only), the tests of deleted modules, `tests/static/` (new), `tests/static/poe1-cruft-waivers.json` (new)]
- produces: [the reduced tool set (C-1, 74 names), `tests/static/poe1Cruft.test.ts`, `tests/static/deadModules.test.ts`]
- consumes: [C-1, C-8, C-18]
- acceptance: [AC-F18, AC-F19, AC-F20, AC-F21, AC-F22]
- milestone: M-1
- summary: Delete:
  - The 25 D-4 names plus `find_item_upgrades`: schemas, routes, meta entries, handlers.
  - Modules that become unreferenced:
    - `skillGemService.ts`, `skillGemHandlers.ts`, `skillLinkOptimizer.ts`;
    - `jewelAdvisorHandlers.ts`, `clusterJewelHandlers.ts`, `bossReadinessHandlers.ts`;
    - `advancedOptimizationHandlers.ts`, `itemAnalyzer.ts`;
    - `shoppingListHandlers.ts`, `shoppingListService.ts`;
    - `craftingAdvisorHandler.ts`, `craftingDataService.ts`, `itemShoppingHandler.ts`;
    - `itemRecommendationEngine.ts`, `costBenefitAnalyzer.ts`, `toolGate.ts`;
    - the dead `tradeHandlers.handleFindItemUpgrades`;
    - the deleted parts of the files listed in touches.
  - `buildService.ts`' bandit and cluster-jewel parsing. This is a pure deletion; nothing that remains
    reads it.
  - Dead private helpers in `index.ts`.
  - Mastery plumbing: Lua `get_mastery_options`, `getMasteryOptions`, `calcWith`'s `masteryEffects`
    param. The `get_tree`/`set_tree`/`lua_set_tree` mastery fields belong to WU-10.
  - `POB_LEGACY_GEM_TOOLS` and `ToolGate`.
  - `search_trade_items`' value scoring (D-61). `formatSearchResults` stops using `CostBenefitAnalyzer`, so the value score, tier, best-value rank and per-chaos lines go. Listings keep the order the trade site returned.

  Also:
  - Remove the deleted tools from the truncation list.
  - Add the I-5 static scan. Seed `poe1-cruft-waivers.json` with one entry per surviving hit in a file
    a later unit owns, as `{file, phrase, owner, justification}`, where owner is one of
    WU-10/11/12/15/18.

### WU-05: Golden, disposition and hygiene tests
- kind: build
- depends-on: [WU-04]
- role: test-engineer
- touches: [`tests/integration/` (new files), `tests/mcp/` (new files), `tests/fixtures/tool-disposition.json` (new), `tests/fixtures/tool-calls.json` (new), `tests/fixtures/tool-hygiene-allowlist.json` (new)]
- produces: [the regression gate for golden stats (I-1a/b), tool set (I-4a) and hygiene (I-4b–d)]
- consumes: [C-1, C-6, C-18]
- acceptance: [AC-F4, AC-F23, AC-F24, AC-F25, AC-F26]
- milestone: M-1
- summary:
  - Add the golden save/reload tests and the in-process pin-refusal test.
  - Encode vision §4 as `tool-disposition.json`, with `find_upgrades` marked `pending: "WU-23"` and
    `trade_query_options` marked `pending: "WU-17"`.
  - Provide samples in `tool-calls.json`: at least one `expect:"ok"` sample per registered tool, with
    optional `setup` steps.
  - Add the hygiene test with a strict allowlist (D-45). Each failing tool's entry names the owning WU
    (09–13, 15, 18) from the vision §4 lane column.

## 5. Acceptance criteria

Each AC lists its owning WU. "In-process" means through `startTestServer` (C-18). "Engine-required" means
inside `engineDescribe`. "Script check" means the verifier runs it and records the exit code in the
work-log.

**Pin and toolchain (WU-02)**

- **AC-F1 (WU-02).** `pob-pin.json` equals C-6's literal. A unit test recomputes the CRLF-normalized
  sha1 of `vendor/PathOfBuilding-PoE2/src/HeadlessWrapper.lua` and gets
  `77a3e3a9b7387ebc57ef0a35bb17c382282e3c7c`.
- **AC-F2 (WU-02, script check).** Fetch behaviour:
  - Given no `vendor/`, `mise run pob:fetch` exits 0 within 120 s, and
    `git -C vendor/PathOfBuilding-PoE2 rev-parse HEAD` prints `7d6f530cbdab20389ff8bc6ba97a37ac27f74e41`.
  - A second run exits 0 in ≤ 2 s and makes no network request (its early exit runs before any `git`
    network command).
- **AC-F3 (WU-02).** `checkPin` unit cases (I-7). Fixtures are tiny synthetic trees built in a temp dir
  (manifest + a few files + `.git/HEAD`):

  | Case | Expected result |
  |---|---|
  | (a) the real `vendor/` checkout | `ok` in ≤ 1 s (NFR-2) |
  | (b) same manifest version, one `src/Modules/CalcDefence.lua` byte changed | refused; `reason` names `Modules/CalcDefence.lua` |
  | (c) `.git/HEAD` ≠ pin commit | refused |
  | (d) `.git/HEAD` = `ref: refs/heads/dev` | refused |
  | (e) manifest version `0.23.2` | refused |
  | (f) `HeadlessWrapper.lua` changed | refused |
  | (g) case (b) with `allowUnpinned: true` | `ok`, and `warnings` names the file |
  | (h) a file listed in the manifest but absent on disk | skipped, `ok` |
  | (i) a file with CRLF line endings whose CRLF hash matches | `ok` |
  | (j) a file containing a NUL byte | hashed raw |
  | (k) a refused tree that is then fixed | `ok` on the next call, so a failure isn't memoized |
- **AC-F5 (WU-02).** One resolver:
  - `rg -n "POB_FORK_PATH" src/` matches only `src/engine/pobPath.ts`.
  - With `POB_FORK_PATH` unset, `resolvePobSrc` returns `<repo>/vendor/PathOfBuilding-PoE2/src`.
  - An e2e test, `spawnServer` with cwd `/tmp`, initializes and gets ≥ 1 node from
    `search_tree_nodes {keyword:"Life"}`. That shows tree data loaded from the vendor checkout.
- **AC-F6 (WU-02, script check).** A `luajit` script with cwd = vendor `src/` boots `HeadlessWrapper.lua`
  and loads `Util.lua`.
  - `construct('Item', <the Ruby Ring text in tests/fixtures/items/ruby-ring.txt>)` returns an item with
    `base` set.
  - `construct('PassiveSpec', build, '0_5')` returns a spec.
  - The script exits 0. The script and the item text are committed.
- **AC-F7 (WU-02, script check).** Toolchain checks:
  - `mise.toml` matches C-19.
  - `rg -n '\|' mise.toml` finds no `|` inside any task `run` string.
  - **The plugin pin.** In a scratch `MISE_DATA_DIR`, `mise install` succeeds, and `git rev-parse HEAD`
    in the installed LuaJIT plugin's directory equals `bd4977ef2c2cfd0659a4bb39acb37bd5104fb7fc`. If mise
    can't pin this plugin, the work-log cites the limitation and the spine gains an A-n.
  - From a fresh clone at the unit's commit, in a temp dir, `mise trust && mise run setup` exits 0, and
    produces `build/index.js` and `vendor/PathOfBuilding-PoE2/src/HeadlessWrapper.lua`.
- **AC-F8 (WU-02, script check).** Dependency checks:
  - `package.json` declares `"zod": "^3.25.76"` and dev `"zod-to-json-schema": "3.24.6"`.
  - `pnpm why zod` shows exactly one resolved version.
  - `@types/chokidar` and `@types/node-fetch` are absent.
  - `pnpm install --frozen-lockfile` exits 0.
  - `jest.config.cjs` has no `coverageThreshold`.
  - `pnpm jest --coverage` exits 0 when the tests pass.
- **AC-F9 (WU-02, script check).** Gate exit codes:
  - `mise run test` exits 0 on the unit's commit.
  - With a deliberately failing test injected in a scratch branch, it exits non-zero, with the same code
    jest returns.
  - With `vendor/` deleted, `mise run test` re-fetches it first (the `depends` runs).

**Pin refusal, in-process (WU-05)**

- **AC-F4 (WU-05).** Run in-process with `env.POB_FORK_PATH` pointing at case (b)'s synthetic tree and
  a `spawn` spy. Then:
  - `lua_get_build_info` returns `isError: true`, and its text contains "mise run pob:fetch" and
    `CalcDefence.lua`;
  - `get_leagues` (`fixtureFetch` route `trade2/data-leagues`) returns no `isError`;
  - `get_currency_rates` (route `poeninja/currency-overview`) returns no `isError`;
  - the `spawn` spy was called 0 times.

**Server factory and error surface (WU-03)**

- **AC-F10 (WU-03, NFR-7).** In-process, with `deps.fetch` and `deps.spawn` as jest mocks that throw:
  - `createServer(deps)` followed by `client.listTools()` succeeds within 1 s;
  - neither mock was called;
  - no file was created under `deps.pobDirectory` or `deps.stateDir` (directory listing before and after);
  - a following `get_leagues` call **does** reach the `fetch` mock (it rejects, so the result is
    `isError`). That proves the injection is wired.
- **AC-F11 (WU-03).**
  - Two `createServer` calls in one Jest process leave `process.listenerCount('SIGINT')`,
    `('SIGTERM')` and `process.stdin.listenerCount('end')` unchanged.
  - A static test confirms that `src/index.ts` is the **only** `src/` file containing `process.env`,
    `process.on(` or `process.stdin.on(`.
- **AC-F12 (WU-03, NFR-8).** Stdio e2e via `spawnServer`:
  1. Initialize, and call `lua_load_build {build_name:"grenadator.xml"}`, which starts luajit.
  2. Read the luajit pid from `/proc/<server pid>/task/*/children`.
  3. Close the server's stdin.

  Then:
  - the server exits with code 0 within 5 s;
  - within a further 1 s, `/proc/<luajit pid>` is absent or in state `Z`;
  - every line the server wrote to stdout during the session parses as a JSON-RPC 2.0 message.
- **AC-F13 (WU-03).** In-process error surface:
  - `lua_load_build` on a nonexistent build name yields `isError: true`, with text naming the build.
  - `get_nearby_nodes` and `find_path_to_node`, with an invalid node, return `isError: true`.
  - `analyze_build` on a build whose tree is invalid returns `isError: true`. The test uses a synthetic
    XML fixture.
  - `delete_spec {index: 99}` returns `isError: true`.
  - `client.callTool({name: "no_such_tool"})` rejects with an `McpError` whose `code` is −32602 and whose
    message contains `Unknown tool: no_such_tool`.
- **AC-F14 (WU-03).** Listing flags:
  - With `POE_TRADE_DISABLED=true` in `deps.env`, `listTools` contains no `group: "trade"` tool, and
    calling one gives −32602.
  - With `POE_NINJA_DISABLED=true`, the same holds for `group: "ninja"`.
  - With neither set, every `TOOL_META` name is listed.
  - `rg -n "POB_LUA_ENABLED|POE_TRADE_ENABLED|POB_LEGACY_GEM_TOOLS" src/` finds nothing.
  - Every listed tool has a `TOOL_META` entry, and vice versa.
- **AC-F15 (WU-03).** `client.getServerVersion()` returns `{name: "pob2-mcp-server", version:
  <package.json version>}`. Every tool description in `listTools` is ≤ 2048 characters.
- **AC-F16 (WU-03).** Harness guarantees:
  - **(a)** Inside any test, `process.env.POESESSID` and `process.env.POE_SESSION_ID` are `undefined`.
  - **(b)** Calling `fetch("https://www.pathofexile.com/")` throws an error mentioning D-34.
  - **(c)** `process.env.POB_DIRECTORY` is a temp dir containing `grenadator.xml`, and it isn't under
    `/mnt/`.
  - **(d)** `fixtureFetch` throws on an unmatched URL, and records method, headers and body for matched
    calls.
  - **(e)** A delayed `fixtureFetch` response rejects with the abort reason when its signal aborts.
  - **(f)** A child spawned **without** an explicit `env` inside a test sees neither cookie variable,
    because `globalSetup` scrubbed the real env.
- **AC-F17 (WU-03, I-6; script check plus one Jest meta-test).** Engine-required behaviour:
  - `POB_FORK_PATH=/nonexistent pnpm jest tests/integration` exits non-zero, and the output contains
    "vendor missing" or "pin".
  - `POB_SKIP_ENGINE=1 POB_FORK_PATH=/nonexistent pnpm jest tests/integration` exits 0, with the engine
    tests reported as skipped.
  - `PATH=<dir of mise's node>:/usr/bin:/bin pnpm jest tests/integration`, with no luajit on that PATH,
    exits non-zero with "luajit not found".
  - No integration test contains `if (!ready) return`.
- **AC-F27 (WU-03).** Unit test of the entry's default computation:
  - with `POB_DIRECTORY` unset, `pobDirectory` = `~/Documents/Path of Building (PoE2)/Builds`;
  - with `XDG_STATE_HOME` unset, `stateDir` = `~/.local/state/pob2-mcp`;
  - with `XDG_STATE_HOME=/x`, it is `/x/pob2-mcp`.
- **AC-F28 (WU-03, FR-F5).**
  - A static test asserts that every `spawn(`, `execFile(`, `spawnSync(` and `fork(` call under `tests/`
    passes an `env` option, or uses `spawnServer`.
  - An e2e test with `spawnServer` calls `get_leagues`. The call is rejected with JSON-RPC −32602,
    because the trade group is disabled, and no connection to pathofexile.com is attempted.

**Deletions (WU-04)**

- **AC-F18 (WU-04).** In-process, `listTools` contains none of these, and calling each gives JSON-RPC
  −32602 `Unknown tool`:
  - the 25 D-4 names;
  - `find_item_upgrades`;
  - `analyze_cluster_jewels`;
  - `find_resistance_gear`.
- **AC-F19 (WU-04).** Plumbing is gone:
  - `rg -n "ToolGate|POB_LEGACY_GEM_TOOLS|get_mastery_options|getMasteryOptions|mastery_effects" src/ pob-api/`
    finds nothing.
  - `rg -n "masteryEffects"` finds nothing in `src/pobLuaBridge.ts` `calcWith`,
    `src/services/buildExportService.ts`, `src/handlers/treeHandlers.ts` or
    `src/handlers/exportHandlers.ts`. The remaining tree-handler occurrences are WU-10's (AC-E30).
  - The files listed in WU-04 don't exist.
- **AC-F20 (WU-04, I-5).** `tests/static/poe1Cruft.test.ts` runs a static scan.
  - **What it scans:** every string and template literal in `src/**/*.ts` (extracted with the TypeScript
    compiler API), including all tool names and descriptions.
  - **Banned phrases** (case-insensitive): `spell suppression`, `watcher's eye`, `cluster jewel`,
    `bandit`, `pantheon`, `awakened`, `6-link`, `chaos orb equivalent`, `mastery effect`, `the shaper`,
    `the elder`, `uber elder`, `sirus`, `the maven`, `searing exarch`, `eater of worlds`.
  - **Banned whole words** (case-sensitive): `Scion`, `Marauder`, `Duelist`, `Templar`, `Shadow`.
  - **Expected result:** zero hits, apart from entries in `tests/static/poe1-cruft-waivers.json`. Each
    waiver is `{file, phrase, owner, justification}`, and its owner is a WU id.
  - **Strict waivers:** a waiver that no longer matches any hit fails the test with "remove the waiver".
  - **A self-check** of the scanner plants a banned phrase in a temp `.ts` file and asserts that it is
    caught.
- **AC-F21 (WU-04).** `tests/static/deadModules.test.ts` asserts that every `src/**/*.ts` file except
  `src/index.ts` is imported by at least one other `src/` file. It parses import specifiers.
- **AC-F22 (WU-04).** The in-process `listTools` set equals the non-delete, non-pending names in
  `tests/fixtures/tool-disposition.json`: 74 when WU-04 lands, 75 after WU-17, 76 after WU-23, 77 after WU-25 (amended, D-91). Until
  WU-05 creates that file, the test uses the literal vision §4 Keep + Fix + Rewrite list (74 names).
  Registered and routed sets are equal: routing every `TOOL_META` name reaches a handler, and no `case`
  exists without a `TOOL_META` entry (static check).

**Golden, disposition and hygiene tests (WU-05)**

- **AC-F23 (WU-05, I-1a).** Engine-required:
  1. Load `grenadator.xml` from the temp builds dir.
  2. Save it via `lua_save_build` to a new name.
  3. Parse `<PlayerStat stat value>` pairs from both files, in attribute-order-agnostic form.

  The 109 `(stat, value)` pairs are identical as strings.
- **AC-F24 (WU-05, I-1b).** Engine-required:
  1. Save, then reload the saved file.
  2. Compare `get_stats` called with an explicit field list: every **numeric** key of `mainOutput`
     (enumerated in the test from a Lua query via `__test_eval`, or, before WU-06, a committed list
     generated once from the golden build).
  3. Compare the `PlayerStat` pairs.

  Both are identical before and after. There is no XML byte or structure comparison.
- **AC-F25 (WU-05, I-4a).** `tests/fixtures/tool-disposition.json` lists all 100 routed names plus the 2
  new ones, and `set_gem_corruption` (bucket `new`, lane `B`; amended, D-91). Each entry is `{name, bucket: keep|fix|rewrite|new|delete, lane, pending?}`.
  - The in-process `listTools` set equals the non-delete, non-pending names.
  - `pending` is only allowed on `trade_query_options` (`"WU-17"`) and `find_upgrades` (`"WU-23"`). Each
    of those units removes its tool's flag.
- **AC-F26 (WU-05, I-4b–d).** Engine-required, in-process. For **every** listed tool, the test:
  1. re-copies the golden file into the temp folder;
  2. reloads it;
  3. runs the sample's optional `setup` steps;
  4. calls the sample in `tests/fixtures/tool-calls.json` (`{tool, args, expect: "ok" | "error", setup?, reason?}`),
     with fixture fetch routes for trade and ninja.

  Then:
  - (i) the text contains none of `undefined`, `NaN`, `[object Object]`;
  - (ii) `expect: "ok"` ⇒ `isError` is not true;
  - (iii) `expect: "error"` ⇒ `isError: true`.

  Every listed tool has ≥ 1 `expect:"ok"` sample. `expect:"error"` samples are additional and carry a
  `reason`. A failure is tolerated only when `tests/fixtures/tool-hygiene-allowlist.json` has a matching
  `{tool, check, owner}` entry. **An allowlisted check that passes fails the test**, with "remove
  <tool>/<check> from the allowlist" (D-45).

## 6. Test strategy (this slice)

| AC | Class | Notes |
|---|---|---|
| AC-F1, F3, F27 | unit | synthetic trees in temp dirs |
| AC-F2, F6, F7, F8, F9 | script check | recorded with exit codes in the work-log |
| AC-F17 | script check + Jest meta-test of `engineDescribe` | |
| AC-F4, F10, F11 (listener part), F13, F14, F15, F16, F18, F22, F25 | in-process MCP | `startTestServer` |
| AC-F5 (launch part), F12, F28 (e2e part) | stdio e2e | `spawnServer` |
| AC-F23, F24, F26 | engine-required | golden fixture |
| AC-F11 (static part), F19, F20, F21, F28 (static part) | static | |

**Regression budget for this slice:**
- The existing unit tests that cover kept code stay green.
- Tests of deleted modules are removed along with their modules.
- `tests/integration/poe2Bridge.test.ts` is rewritten on `engineDescribe`, keeping its assertions.

## 7. Migration notes (this slice)

- **Env vars removed:** `POB_LUA_ENABLED`, `POE_TRADE_ENABLED`, `POB_LEGACY_GEM_TOOLS`.
  `POE_TRADE_DISABLED` is added. Tools are now listed by default.
- **The `POB_FORK_PATH` default changes** from the nonexistent `~/Projects/...` to `vendor/`. Users who
  set it explicitly keep their value, but the pin check now applies (`POB_ALLOW_UNPINNED=true` escapes it).
- **The `POB_DIRECTORY` default changes** to `~/Documents/Path of Building (PoE2)/Builds` (spine §11).
- **Server state locations** move in WU-22 (C-16). This slice doesn't touch them.
