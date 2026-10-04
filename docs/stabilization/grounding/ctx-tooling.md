# ctx-tooling: runtime and tooling ground truth for the pob2-mcp spec

Date 2026-10-03. Repo `/home/parker/projects/pob2-mcp` @ `stabilization/foundation`.

**Legend:** **[V]** = read just now in the authoritative doc or source (URL plus heading, or `file:line`).
**[V-run]** = executed here just now against the installed toolchain. All probes ran in the
scratchpad, never in the repo. **[I]** = inference.

Doc sources were read in full from the version-matched upstream sources:
- Node `doc/api/*.md` @ `v24.16.0`
- Jest `website/versioned_docs/version-29.7/*.md`
- pnpm `versioned_docs/version-11.x/*.md`
- mise `docs/*.md` and `settings.toml` @ `v2026.5.15`
- git `Documentation/*.txt` @ `v2.43.0`
- chokidar `README.md` @ `4.0.3` (byte-identical to `node_modules/chokidar/README.md`)
- zod `packages/docs/content/*.mdx` @ main

The rendered URLs are cited below.

---

## 0. Installed and resolved versions [V-run]

| Item | Version | Source |
|---|---|---|
| node (repo) | **v24.16.0** | `mise exec -- node --version`; `mise.toml:6` `node = "24"` |
| pnpm | **11.6.0** (corepack shim `node/24/bin/pnpm -> ../lib/node_modules/corepack/dist/pnpm.js`) | `mise exec -- pnpm --version`; `package.json:35` `"packageManager": "pnpm@11.6.0"`. Upstream latest-11 = 11.28.2, latest = 12.9.1 (npm dist-tags). |
| corepack | 0.35.0 | `mise exec -- corepack --version` |
| mise | 2026.5.15 (2026.10.1 available) | `mise --version` |
| git | 2.43.0 | `git --version` |
| luajit / luarocks | LuaJIT 2.1.1784580905 (ref `2460b3f…`) / luarocks 3.12.2; `luautf8 0.1.6-1` installed and `require"lua-utf8"` works | `mise exec -- luajit -v`, `luarocks list` |
| asdf plugin `mise-plugins/mise-luaJIT` | checkout `bd4977e` (2025-08-13). **Not pinned** by `mise.toml`. | `git -C ~/.local/share/mise/plugins/asdf-mise-plugins-mise-lua-jit log -1` |
| chokidar | **4.0.3** (deps: `readdirp ^4.0.1`; dual ESM/CJS exports; ships own types) | `node_modules/chokidar/package.json` |
| @types/chokidar | 1.7.5 (types for chokidar **1.7**; unused, see §2) | `node_modules/@types/chokidar/package.json` |
| @modelcontextprotocol/sdk | **1.20.2** (spec `^1.0.0`; upstream latest 1.32.0) | `node_modules/@modelcontextprotocol/sdk/package.json` |
| zod (transitive only) | **3.25.76** via SDK `"zod": "^3.23.8"` | `pnpm-lock.yaml:1544`, `.modules.yaml` hoisted `private` |
| jest / @jest/globals / @jest/types | 29.7.0 / 29.7.0 / 29.6.3 | node_modules |
| ts-jest | **29.4.5** | node_modules |
| typescript | 5.9.3 | node_modules |
| @types/node | **20.19.23** (spec `^20.0.0`; undici-types 6.21.0) | `node_modules/@types/node/package.json:3` |
| @types/jest | 29.5.14 | node_modules |
| bundled undici (runtime fetch) | 7.25.0 | `process.versions.undici` |
| `/mnt/c` | `9p (aname=drvfs; … cache=5, trans=fd)` | `mount` |

---

## 1. Node.js 24

### 1a. `util.parseEnv(content)`

- **Added:** v21.7.0 and v20.12.0. **Changes:** "v24.10.0 — This API is no longer experimental." The section carries no stability banner, so it is Stable. [V] Source: nodejs.org/docs/latest-v24.x/api/util.html#utilparseenvcontent, heading "`util.parseEnv(content)`".
- **Signature:** `content` {string} → {Object}. The only example given is `parseEnv('HELLO=world\nHELLO=oh my\n')` → `{ HELLO: 'oh my' }`, i.e. **duplicate key: last wins**. [V]
- **Format spec:** nodejs.org/docs/latest-v24.x/api/environment_variables.html#dotenv ("DotEnv", **Stability: 2 – Stable**). [V]
  - **Names:** must match `^[a-zA-Z_]+[a-zA-Z0-9_]*$` ("Variable Names").
  - **Values:** optionally `'` or `"` quoted. Quoted values may span lines; unquoted ones are single-line ("Variable Values").
  - **Spacing:** leading and trailing whitespace around keys and values is ignored unless quoted ("Spacing").
  - **Comments:** `#` starts a comment; inside quotes it is literal ("Comments").
  - **`export` prefixes:** the `export` keyword is ignored ("`export` prefixes").
  - The `--env-file` section adds that backtick quotes are also accepted. Source: cli.html#--env-filefile. [V]
- **Behaviour actually observed on v24.16.0** [V-run]. Probe script output:

| Input | Result | Note |
|---|---|---|
| `A=1\nA=2` | `{A:"2"}` | last wins |
| `export A=1`, `  export   A = 1  ` | `{A:"1"}` | |
| `A=1\r\nB=2\r\n` | `{A:"1",B:"2"}` | CRLF OK |
| `A="x y"` / `'x y'` / `` `x y` `` | `"x y"` | |
| `A="a\nb"` (escaped) | real newline | double quotes expand `\n` |
| `A='a\nb'` | literal `a\nb` | single quotes do not |
| `A=abc # c` / **`A=abc#def`** | `"abc"` / **`"abc"`** | **an unquoted `#` truncates even with no space before it** |
| `A="abc#def"` | `"abc#def"` | |
| `A=` / `A=""` | `""` | |
| `JUSTKEY` (no `=`) | skipped | |
| `1A=1`, `my-var=2`, `MY VAR=1` | **accepted as keys** | contradicts the documented name regex |
| `A="abc\nB=3` (unterminated quote) | `{A:"\"abc",B:"3"}` | raw value keeps the quote |
| `A="a\"b"` | `"a\\"` | escaped quotes unsupported |
| `A=${HOME}` | `"${HOME}"` | no expansion |
| **UTF-8 BOM + `A=1`** | **key is `"﻿A"`** | **BOM not stripped**: a BOM-prefixed first key is silently lost |
| `POESESSID=op://Vault/Item/field` | literal string | |
| `parseEnv(undefined)` / `parseEnv(Buffer)` | throws `ERR_INVALID_ARG_TYPE` ("The \"content\" argument must be of type string") | must pass `readFileSync(p,'utf8')` |

- `parseEnv` does **not** read files and does **not** touch `process.env`. "Missing file means no cookie" must be done by the caller: `readFileSync` throws `ENOENT`. [V / I]

### 1b. `process.loadEnvFile(path)` (contrast)

- Same added versions; non-experimental since v24.10.0. Default path `'./.env'`. "Loads the `.env` file into `process.env`. Usage of `NODE_OPTIONS` in the `.env` file will not have any effect." [V] Source: process.html#processloadenvfilepath.
- **Missing file:** throws `ENOENT: no such file or directory, open '<path>'`. [V-run] The @types JSDoc agrees ("If the file is not found, error will be thrown"; `process.d.ts:1400-1414`). [V]
- **Does not override** an existing env var: `ZZ_TEST=fromenv` stays `fromenv`, and new keys are added. [V-run] The `--env-file` doc states the same precedence: "If the same variable is defined in the environment and in the file, the value from the environment takes precedence." Source: cli.html "`--env-file=file`". [V]

### 1c. `child_process.spawn`

Source for this subsection: nodejs.org/docs/latest-v24.x/api/child_process.html. [V]

- **`kill([signal])`** (heading "`subprocess.kill([signal])`"):
  - Default `'SIGTERM'`. Returns `true` if kill(2) succeeds.
  - It may emit `'error'` if the signal cannot be delivered.
  - "the signal delivered to the child process may not actually terminate the process."
  - "On Linux, child processes of child processes will not be terminated when attempting to kill their parent." Relevant if luajit is ever wrapped in a shell.
- **`killed`:** "does not indicate that the child process has been terminated" ("`subprocess.killed`").
- **`'exit'`:** emitted after the child ends. Args are `(code, signal)`, and exactly one is non-null. "When the `'exit'` event is triggered, child process stdio streams might still be open."
- **`'close'`:** emitted after the process ended **and** its stdio streams closed. "will always emit after `'exit'` was already emitted, or `'error'` if the child process failed to spawn."
- **`'error'`:** emitted on spawn failure, kill failure, send failure, or abort. "The `'exit'` event may or may not fire after an error has occurred… guard against accidentally invoking handler functions multiple times."
- **`'spawn'`:** emitted once spawned successfully, before any other event and before any data.
- **Pipes:** the default stdio is `['pipe','pipe','pipe']`. "These pipes have limited (and platform-specific) capacity. If the subprocess writes to stdout in excess of that limit without the output being captured, the subprocess blocks" (intro section). A stdout or stderr that is never read can therefore deadlock luajit.
- **PATH:** command lookup uses `options.env.PATH` when `env` is given, else `process.env.PATH`. If `env` lacks PATH, lookup falls back to `/usr/bin:/bin`. The bridge passes `{...process.env, …}` (`src/pobLuaBridge.ts:115-131`), so it inherits mise's PATH.
- **Options:** `timeout`, and `killSignal` (default `'SIGTERM'`) for timeout or abort.
- **Observed** [V-run]. Child `sleep 30` with piped stdio:
  - After stdin EOF, the parent stays alive until the child dies.
  - `kill()` → `exit null SIGTERM` → `close null SIGTERM`, and the parent exits within 2 ms.

### 1d. `process.stdin` EOF, and MCP stdio shutdown

- Readable `'end'`: "emitted when there is no more data to be consumed… **will not be emitted** unless the data is completely consumed" (stream.html, Readable "Event: `'end'`"). A `'data'` listener puts the stream in flowing mode. [V]
- `printf 'hello\n' | node eof.cjs` → `data`, then `stdin end`, then `stdin close`. [V-run]
- **MCP SDK 1.20.2's `StdioServerTransport` listens only to `'data'` and `'error'`**. It does not listen to `'end'` or `'close'` (`node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js:28-31`). Stdin EOF therefore never fires `onclose`. [V]
- `src/index.ts:183-184` handles only `SIGINT`/`SIGTERM`. [V]
- MCP spec 2025-06-18 is the SDK's `LATEST_PROTOCOL_VERSION` (`dist/esm/types.js:2`). Its "Shutdown → stdio" section says the client SHOULD: "1. First, closing the input stream to the child process (the server) 2. Waiting for the server to exit, or sending `SIGTERM`… 3. Sending `SIGKILL`…". Source: modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle. [V]

### 1e. Global `fetch`, `Headers`, `AbortSignal`

- `fetch`, `Headers` and `Response` are stable since v21.0.0 and are "browser-compatible" implementations based on undici. [V] Source: globals.html "`fetch`", "Class: `Headers`".
- **`AbortSignal.timeout(delay)`** (added v17.3.0) "Returns a new `AbortSignal` which will be aborted in `delay` milliseconds." [V]
- **`AbortSignal.any(signals)`** (added v20.3.0) aborts when any input aborts, and its `reason` is the first input's reason. [V] Source: globals.html "Static method: …".
- **`Headers.get`** (MDN, developer.mozilla.org/en-US/docs/Web/API/Headers/get, "Return value"): multiple values are "joined by a comma and space separator (`, `)". The name is case-insensitive. `null` when absent. Set-Cookie needs `getSetCookie()`. [V]
- **Observed with a local HTTP server** [V-run]:
  - `get('x-rate-limit-rules')` → `"Ip,Account"`.
  - A repeated `X-Rate-Limit-Ip` header (`5:10:60` and `15:60:300` on two lines) → `"5:10:60, 15:60:300"`. **The separator becomes `", "`, so split on `/,\s*/`.**
  - `get('x-nope')` → `null`.
  - `getSetCookie()` → array.
  - `AbortSignal.timeout` → rejects with `DOMException` **`name === "TimeoutError"`**, message "The operation was aborted due to timeout".
  - Manual abort through `AbortSignal.any` → `name === "AbortError"`.
  - Connection refused → `TypeError: fetch failed` with **`cause.code === "ECONNREFUSED"`**. Port 9 gives `cause` "bad port", with no code.
- Inside Jest 29's `node` environment, `fetch`, `Response`, `Headers`, `AbortSignal.any/timeout`, `util.parseEnv` and `structuredClone` all exist, and `globalThis.fetch = jest.fn()` replaces fetch. [V-run]

### 1f. `@types/node`: is `util.parseEnv` declared?

- **Yes, already, at the installed 20.19.23.** [V]
  - `node_modules/@types/node/util.d.ts:1176-1189` has `export function parseEnv(content: string): NodeJS.Dict<string>;` with `@since v20.12.0`. The JSDoc still says "Stability: 1.1 - Active development", which is stale relative to the runtime.
  - `process.d.ts:1414` has `loadEnvFile(path?: PathLike): void`.
  - `web-globals/abortcontroller.d.ts:31-32` has `any(signals)` and `timeout(ms)`.
  - `web-globals/fetch.d.ts:16` declares global `fetch`.
  - `undici-types/fetch.d.ts:79` has `getSetCookie`.
- A scratch file using `parseEnv`, `AbortSignal.any` and `AbortSignal.timeout` compiles under both `tsconfig.json` and `tsconfig.test.json`, and runs under ts-jest. [V-run]
- The first `@types/node` 20.x with `parseEnv` is the 20.12 line: `@types/node@20.12.0` exists on npm. [V-run `pnpm view`] It is also present in every major ≥ 21. [I]
- **So no bump is needed for parseEnv.** The types still lag the runtime (20 vs 24). `@types/node@24` is published (24.19.1). [V-run]

---

## 2. chokidar 4.0.3

Source: github.com/paulmillr/chokidar/blob/4.0.3/README.md (also `node_modules/chokidar/README.md`). The defaults were cross-checked against `node_modules/chokidar/esm/index.js:233-272`.

| Option | v4 semantics |
|---|---|
| `usePolling` (default `false`) | "Whether to use fs.watchFile (backed by polling), or fs.watch… It is typically necessary to **set this to `true` to successfully watch files over a network**, and it may be necessary… in other non-standard situations." **The env var `CHOKIDAR_USEPOLLING` overrides the option.** [V] Source `index.js:260-269`: `'false'`/`'0'` → false, `'true'`/`'1'` → true, any other non-empty value → true. [V] |
| `interval` (default **100** ms) | Polling interval, effective only with `usePolling: true`. Overridable by **`CHOKIDAR_INTERVAL`** (`index.js:270-272`). [V] |
| `binaryInterval` (default 300 ms) | Used for binary-extension files when it differs from `interval` (`handler.js:317-318`). `.xml` is not binary. [V] |
| `awaitWriteFinish` (default `false`) | When truthy, it "will poll file size, holding its `add` and `change` events until the size does not change". Object form `{stabilityThreshold: 2000, pollInterval: 100}` by default, and partial objects merge with those defaults (`index.js:234,249`). [V] |
| `depth` (default `undefined`) | "If set, limits how many levels of subdirectories will be traversed". When undefined, recursion is unlimited (`handler.js:539-540`: `oDepth == null \|\| depth <= oDepth`). [V] |
| `ignored` | "function, regex, or path… The whole relative or absolute path is tested". A two-arg function is called twice per path, the second time with `fs.Stats`. **Globs were removed in v4** (Changelog, "Upgrading"). [V] |
| `atomic` | Default "`true` if `useFsEvents` and `usePolling` are `false`", so **it is `false` under polling** (`index.js:255-256`: `opts.atomic = !opts.usePolling`). With it off, an editor's delete-and-recreate is reported as `unlink` + `add` rather than `change`. [V] |
| `close()` | "**async**… Use with `await`". [V] |

- **WSL / drvfs:** the 4.0.3 README has **no** mention of WSL, drvfs, 9p or `/mnt`. It only has the generic "over a network" note above. [V]
  - Authority for the drvfs claim is microsoft/WSL issue #4739, "[WSL2] File changes made by Windows apps on Windows filesystem don't trigger notifications for Linux apps". It is **open**, labels `feature`, `wsl2`: "any changes made by Windows applications… do not trigger any file change notifications as far as Linux apps are concerned." [V] Source: github.com/microsoft/WSL/issues/4739.
  - The Microsoft Learn page "Comparing WSL Versions" mentions only cross-OS file *performance*, not notifications. [V] Source: learn.microsoft.com/en-us/windows/wsl/compare-versions.
- **Types:** `chokidar` resolves to its own `node_modules/.pnpm/chokidar@4.0.3/.../esm/index.d.ts`. [V-run `tsc --traceResolution`] `@types/chokidar@1.7.5` (header "Type definitions for chokidar 1.7") is never used for the import, so it is dead weight. [V]
- **The existing watcher** (`src/services/watchService.ts:33-40`) uses:
  - `ignored: /(^|[\/\\])\../`, which also excludes a `.pob-mcp/snapshots/` subfolder [I].
  - `ignoreInitial: true`.
  - `awaitWriteFinish {500,100}`.
  - **no `usePolling`**.
- The user's Builds folder holds 1 file and 1 dir today. [V-run `find`, counts only]

---

## 3. zod

- **SDK 1.20.2 dependency:** `"zod": "^3.23.8"` (and `zod-to-json-schema ^3.24.1`), as a regular dependency, not a peer. Resolved to **3.25.76**. [V] `node_modules/@modelcontextprotocol/sdk/package.json`.
- **Upstream SDK 1.32.0** declares `zod` as both a dependency and a **non-optional peer** `"^3.25 || ^4.0"`. [V-run `pnpm view`]
- **Resolution from the repo root today: it fails.** [V-run]
  - CJS: `require.resolve('zod')` → `Error: Cannot find module 'zod'`.
  - ESM: `import('zod')` and `import.meta.resolve('zod')` → `ERR_MODULE_NOT_FOUND Cannot find package 'zod'`.
  - TypeScript (test tsconfig): `TS2307: Cannot find module 'zod'`.
  - Zod lives only under `node_modules/.pnpm/node_modules/zod`, the private hoist.
- **Adding it** [V-run in a scratch copy of `package.json` + `pnpm-lock.yaml`]:
  - `pnpm install --frozen-lockfile` after adding `zod` to `package.json` fails: `ERR_PNPM_OUTDATED_LOCKFILE … specifiers in the lockfile don't match … 1 dependencies were added: zod@^3.25.76`.
  - A non-frozen install resolves `zod ^3.25.76` → **3.25.76, the same single copy the SDK uses**, and `require.resolve('zod')` then works.
  - `zod@^4` (latest 4.6.5) would add a second copy beside the SDK's 3.25.76. [I]
- **What zod 3.25.76 contains** (`package.json` exports `.`, `./v3`, `./v4`, `./v4-mini`, `./v4/mini`, `./v4/core`, `./v4/locales`) [V]:
  - `"zod"` is the **v3 API**. `safeParse` returns `{success, data|error}`. `ZodError` has `.issues`, `.flatten()` and `.format()` (`v3/ZodError.d.ts:139,148`).
  - `"zod/v4"` is the **v4 API**, with `z.prettifyError`, `z.treeifyError` and `z.flattenError` (`v4/core/errors.d.ts:139,169,207`).
  - The current docs' `.validate()` does **not** exist in 3.25.76's v4 (`typeof S.validate === 'undefined'`). [V-run]
- **Docs** (zod.dev, describing zod 4.x):
  - "Parsing data" / "Handling errors": `.parse` throws `ZodError`. `.safeParse()` returns a discriminated union `{success:true,data}` / `{success:false,error: ZodError}`. Use `.safeParseAsync()` for async refinements and transforms. [V] Source: zod.dev/basics.
  - "Inferring types": `z.infer<typeof S>`, plus `z.input` / `z.output` where transforms diverge. [V] Source: zod.dev/basics.
  - zod.dev/error-formatting: `z.treeifyError()` gives a nested `{errors, properties, items}`. `z.prettifyError()` gives a "human-readable string" (`✖ … → at path`). `z.flattenError()` gives `{formErrors, fieldErrors}`. "`z.formatError()` Deprecated. Use `z.treeifyError()`." [V]
  - Observed: v3 `flatten()` → `{"formErrors":[],"fieldErrors":{"a":["Expected string, received number"]}}`. v4 `prettifyError` → `"✖ Invalid input: expected string, received number\n  → at a"`. [V-run]
- **v3/v4 coexistence:**
  - zod.dev/v4/versioning: the package root now exports Zod 4. Zod 3 moved from `"zod"` to `"zod/v3"`. The permalinks "will remain available forever". [V]
  - zod.dev/library-authors, "How to support Zod 3 alongside Zod 4?": "Since `v3.25.0` the `zod` package contains copies of both Zod 3 and Zod 4 at their respective subpaths". `"_zod" in schema` distinguishes v4 from v3. "Zod 3 is functionally end-of-life and won't receive new features." [V]
  - library-authors, "Which subpaths should I import from?": in 3.x `"zod"` exports Zod 3 and in 4.x it exports Zod 4. [V]

---

## 4. Jest 29.7 and ts-jest 29.4.5

**Repo config** [V]:
- `jest.config.cjs:3`: `preset: 'ts-jest'`.
- `jest.config.cjs:6`: `roots ['<rootDir>/tests']`.
- `jest.config.cjs:7-14`: transform `ts-jest` with `tsconfig: 'tsconfig.test.json'`.
- `jest.config.cjs:15-17`: `testMatch **/tests/**/*.test.ts`.
- `jest.config.cjs:23-30`: `coverageThreshold.global {branches 75, functions 85, lines 80, statements 80}`.
- `jest.config.cjs:33-35`: moduleNameMapper that strips `.js`.
- No `setupFiles`, `globalSetup` or `testTimeout`.
- `tsconfig.test.json` extends `tsconfig.json` and sets `module CommonJS`, `moduleResolution node`, `isolatedModules false`. `tsconfig.json` sets `module/moduleResolution Node16`, `isolatedModules true`. `package.json` has `"type": "module"`.

**Jest docs** (jestjs.io/docs/29.7/configuration, under the headings named) [V]:

| Option | Doc text |
|---|---|
| `testTimeout` | "Default: `5000`. Default timeout of a test in milliseconds." CLI `--testTimeout=<number>` is the same. |
| `setupFiles` | "run once per test file… executed in the testing environment **before** executing `setupFilesAfterEnv` and before the test code itself". A CJS module may export an async function, which Jest awaits. |
| `setupFilesAfterEnv` | Runs after the test framework is installed, so the `jest` object, `expect` and hooks (`afterEach`…) are available. |
| `projects` | "run tests in all of the specified projects at the same time". The note says root-level options are copied into each child, with `<rootDir>` resolved per child. Docs recommend a `displayName`. `--selectProjects <names>` uses `displayName`. |
| `globalSetup` | "triggered once before all test files". It receives `(globalConfig, projectConfig)`. "Any global variables that are defined through `globalSetup` can only be read in `globalTeardown`". The setup file is transformed, but `node_modules` are not. Per-project globalSetup runs only if a test from that project runs. |
| `coverageThreshold` | "If thresholds aren't met, jest will fail." |
| `--runInBand` / `-i` (CLI page) | "Run all tests serially in the current process, rather than creating a worker pool". `--detectOpenHandles` implies `--runInBand`. `--forceExit` is "an escape-hatch". |

- **`testTimeout` is not per-project in Jest 29.** It is a `GlobalConfig` field (`@jest/types@29.6.3 build/index.d.ts`, GlobalConfig `testTimeout?: number`) and absent from `ProjectConfig`. [V]
  - Putting `testTimeout: 100` inside a `projects[]` entry prints `Validation Warning: Unknown option "testTimeout"` and is ignored: a 300 ms test passes. [V-run]
  - Top-level `testTimeout: 100` fails the same test. [V-run]
  - Per-suite timeouts therefore need the per-test timeout argument (as `tests/integration/poe2Bridge.test.ts:40,49…` does) or `jest.setTimeout` in `setupFilesAfterEnv`.
- **`process.argv[1]` inside Jest** [V-run]:
  - Worker: `<repo>/node_modules/.pnpm/jest-worker@29.7.0/node_modules/jest-worker/build/workers/processChild.js`.
  - In-band or via `pnpm exec`: `<repo>/node_modules/.pnpm/jest@29.7.0_…/node_modules/jest/bin/jest.js`.
  - cwd is `<repo>` in both cases.
  - A walk-up from `argv[1]` therefore reaches `<repo>/pob-pin.json`.
- **ESM in Jest** (jestjs.io/docs/29.7/ecmascript-modules): "**experimental**". It needs `node --experimental-vm-modules` plus a transform that emits ESM. [V]
- **ts-jest ESM vs CJS** (kulshekhar.github.io/ts-jest/docs/guides/esm-support) [V]:
  - ESM needs `--experimental-vm-modules`, `useESM: true` and `extensionsToTreatAsEsm`.
  - "the code transpiler ONLY supports hybrid values with isolatedModules: true" for `module: Node16/NodeNext`.
  - The options page lists `useESM` as "Enable ESM support", default _auto_, and `diagnostics` default _enabled_.
- **ts-jest source** [V]:
  - `dist/legacy/config/config-set.js:249`: `this.useESM = options.useESM ?? false`.
  - `dist/legacy/compiler/ts-compiler.js:141`: `isEsmMode = useESM && supportsStaticESM`.
  - `ts-compiler.js:110-121`: when not ESM, it **forces `module: CommonJS` and `moduleResolution: Node10`** regardless of the tsconfig.
  - `config-set.js:221`: the ts-jest option `isolatedModules` "is deprecated and will be removed in v30.0.0".
- **`import.meta` under the current test config: NOT usable.**
  - `tsc` with `tsconfig.test.json` fails with `TS1343: The 'import.meta' meta-property is only allowed when the '--module' option is 'es2020', 'es2022', 'esnext', 'system', 'node16', 'node18', 'node20', or 'nodenext'.` [V-run]
  - A real ts-jest run gives "Test suite failed to run … TS1343". [V-run] Diagnostics are on, so any type error fails the suite.
- **Types in tests use Node10 resolution, which ignores `exports` maps.**
  - The SDK still type-resolves through `"typesVersions": {"*": {"*": ["./dist/esm/*"]}}`. [V]
  - At runtime, Jest's resolver honours `exports` → `dist/cjs/*`.
  - An in-process `InMemoryTransport.createLinkedPair()` + `Server` + `Client.listTools()` round-trip passes under Jest 29, resolving to `dist/cjs/inMemory.js`. [V-run]

---

## 5. pnpm 11

Installed **11.6.0**. The docs read are pnpm.io **11.x** (`versioned_docs/version-11.x`), which document features up to v11.26 or later. Some newer flags may be absent in 11.6.0. [V]

- **`install --frozen-lockfile`:**
  - "`pnpm-lock.yaml` is not updated". "In a CI environment, installation fails if a lockfile is present but needs an update." [V] Source: pnpm.io/11.x/cli/install, TL;DR and intro.
  - It succeeds on the current repo (scratch copy, `--offline`, "Done in 1s using pnpm v11.6.0", rc 0, no `pnpm-workspace.yaml` created). [V-run]
  - It fails with `ERR_PNPM_OUTDATED_LOCKFILE` when `package.json` specifiers change. [V-run]
- **Build scripts** (pnpm.io/11.x/settings/build) [V]:
  - **`strictDepBuilds`** (added v10.3.0): "Default: **true**… the installation will exit with a non-zero exit code if any dependencies have unreviewed build scripts (aka postinstall scripts)."
  - **`allowBuilds`** (added v10.26.0) is a name-to-bool map in `pnpm-workspace.yaml`. "Packages not listed in `allowBuilds` are disallowed by default and are treated as unreviewed." Unlisted ignored builds are auto-added to `pnpm-workspace.yaml` with a placeholder.
  - **Removed in v11 and replaced by `allowBuilds`:** `onlyBuiltDependencies`, `onlyBuiltDependenciesFile`, `neverBuiltDependencies`, `ignoredBuiltDependencies`, `ignoreDepScripts`.
  - `pnpm approve-builds` (added v10.1.0) writes `allowBuilds`. `--all` was added in v10.32.0. Source: pnpm.io/11.x/cli/approve-builds.
  - `dangerouslyAllowAllBuilds` defaults to false.
- **Does any dependency need build scripts? No.** [V-run]
  - A scan of every package in `node_modules/.pnpm` found no `preinstall`/`install`/`postinstall` and no `binding.gyp`.
  - The lockfile has no `requiresBuild`.
  - `fsevents@2.3.3` is optional and `os: [darwin]` (`pnpm-lock.yaml:731-734`), so it is not installed on Linux.
  - The repo has no `pnpm-workspace.yaml` or `.npmrc`.
- **`verifyDepsBeforeRun`** defaults to `install` in the 11.x docs: "Automatically runs install if `node_modules` is not up to date" before `pnpm run` and `pnpm exec`. [V] Unconfirmed for 11.6.0, where `pnpm config get` prints `undefined`, i.e. unset. [V-run]
- **`pnpm run`** propagates the script exit code: `exit 5` gives rc 5. [V-run]
- **`packageManager`, `pmOnFail` and corepack** [V]:
  - pnpm.io/11.x/settings/cli, "pmOnFail" (added v11.0.0): default **`download`**, i.e. pnpm downloads and runs the declared version. `ignore` is "Useful when version management is handled by an external tool such as asdf, mise, or Volta".
  - pnpm.io/11.x/package_json, "devEngines.packageManager": the legacy `packageManager` field's resolution "is **not** written to `pnpm-lock.yaml`".
  - **Corepack** (Node docs corepack.html, Stability 1, Experimental): "**Corepack will no longer be distributed starting with Node.js v25.**"
  - Corepack README (github.com/nodejs/corepack): `corepack enable` "create[s] shims next to" the Corepack install. `COREPACK_ENABLE_DOWNLOAD_PROMPT` defaults to 1 when invoked implicitly (`pnpm …`). `COREPACK_HOME` defaults to `$HOME/.cache/node/corepack`.
- **This box** [V-run]:
  - The pnpm shim exists in `node/24.16.0/bin` only because `~/.local/share/chezmoi/bootstrap.sh:50-55` runs `corepack enable` + `npm i -g corepack@latest` + `corepack prepare pnpm@latest --activate` against the global `node@lts`, which is currently 24.16.0.
  - The mise setting `node.corepack` is **false**.
  - `node/26.2.0/bin` has only `node npm npx`; `mise exec node@26 -- pnpm` gives `pnpm: not found`.
  - The corepack cache holds pnpm 11.3.0, 11.5.0 and 11.6.0.
  - `COREPACK_ENABLE_AUTO_PIN=0`.

---

## 6. mise (2026.5.15)

**Repo `mise.toml`** [V]:
- `mise.toml:5`: `[tools] "asdf:mise-plugins/mise-luaJIT" = { version = "ref:2460b3f…", postinstall = "luarocks install luautf8 0.1.6-1" }`.
- `mise.toml:6`: `node = "24"`.
- `mise.toml:8-11`: `[env] LUAROCKS_VERSION = "3.12.2"`.
- There are no `[tasks]` yet.

**Task fields** (mise.jdx.dev/tasks/task-configuration, "Task properties") [V]:
- **`run`** is a `string | (string | {task,args?,env?} | {tasks:[…]})[]`. "This is the only required property".
- **`depends`**: "Tasks that must be run before this task… If multiple tasks have the same dependency, that dependency will only be run once. mise will run whatever it can in parallel (up to `--jobs`)". It accepts `"NAME=val task"` or `{task, env}`, and that env goes only to the dependency.
- **`env`**: "specific to this task. These will not be passed to `depends` tasks."
- **`dir`**: default `"{{ config_root }}"`, the directory containing `mise.toml`. Use `dir = "{{cwd}}"` for the caller's cwd.
- **`description`**: shown in help, `mise tasks` and completions.
- **`sources`/`outputs`**: skip the task when the oldest output is newer than the newest source. The task definition is auto-added as a source. `outputs` defaults to `{ auto = true }`, which touches `~/.local/state/mise/task-outputs/<hash>`. `!`-prefixed sources are excluded.
- **`tools`**: per-task tools.
- **`shell`**: per-task shell.
- **`raw`**: stdin is "not read by default".

**Failure semantics** [V]:
- toml-tasks: "Commands are run in series. If a command fails, the task will stop and the remaining commands will not run." "If a dependency fails, the task will not run." Tasks run with `set -e`.
- `mise run -c/--continue-on-error` overrides this.
- **Observed** [V-run, scratch copy trusted via env]:
  - `run = ["echo one","exit 3","echo never"]` → prints `one`, then `[fail3] ERROR task failed`, **rc 3**.
  - `depends = ["pob:fetch"]`, then `exit ${CODE}` with CODE=7 → **rc 7**.
  - `run = [{task="pob:fetch"}, "…; exit 4"]` → rc 4.
  - `mise run -C <dir> fail3` from another cwd → rc 3. The default task cwd was the config root.
- **Pipelines do not fail the task.**
  - The `mise run` CLI page says the shell "Defaults to `sh -c -o errexit -o pipefail` on unix" (mise.jdx.dev/cli/run, `-s --shell`).
  - But `settings.toml` `[unix_default_inline_shell_args] default = "sh -c -o errexit"`, and `mise settings get unix_default_inline_shell_args` → `sh -c -o errexit`.
  - `/bin/sh` is dash 0.5.12, where `sh -o pipefail` gives `Illegal option -o pipefail`.
  - `run = "false | true; echo after-pipe"` → rc **0**. [V-run]

**Tools on PATH inside tasks:** "tasks launched with mise will include the mise environment—your tools and env vars defined in `mise.toml`" (tasks/index, "Tasks"). [V] Observed `which luajit node` inside a task → the pinned luajit and `node/24/bin/node`. `LUAROCKS_VERSION` from `[env]` is also exported. [V-run]

**`mise exec -C <dir>`** [V / V-run]:
- `-C --cd <DIR>` is a global flag: "Change directory before running command" (mise.jdx.dev/cli, global flags).
- Observed:
  - The child's `pwd` = `<dir>`, with `luajit` and `node` v24.16.0 on PATH.
  - mise **replaces itself** (the `sh` child's parent is the launching shell, with no mise process between), so signals from an MCP host reach node directly.
  - **0 bytes on stdout** from mise itself; the "new version available" warnings go to stderr.
  - Stdin passes through and EOF is delivered.
- `exec_auto_install` and `task.run_auto_install` are both **true**. [V-run `mise settings get`] A missing tool is installed on first `exec`/`run`, which means building LuaJIT from source. [I]

**Trust:**
- `mise trust` "Marks a config file as trusted… parse the file with potentially dangerous features enabled (environment variables, templates, `path:` plugin versions)". `-a` trusts all configs in cwd and parents. `--show` reports status. [V] Source: mise.jdx.dev/cli/trust.
- paranoid.md, "Config files": "Generally only potentially dangerous config files are checked such as files that use templates… or that set env vars." "a config file only needs to be trusted a single time" (non-paranoid). [V]
- `trusted_config_paths` (env `MISE_TRUSTED_CONFIG_PATHS`, default `[]`): "Any config files under these paths will be trusted without prompting." [V] Source: settings.toml, configuration.md "Global config".
- **Observed** [V-run]:
  - A copy of the repo `mise.toml` at a new path → `mise ERROR Config files in <path>/mise.toml are not trusted. Trust them with \`mise trust\`.` with **rc 1, non-interactive**.
  - The same error happens for a **minimal `[tools] node = "24"`** file with no `[env]`, and for one using `install_env` instead of `[env]`. This is stricter than the docs suggest.
  - `MISE_TRUSTED_CONFIG_PATHS=<path>` bypasses it.
  - The main checkout is trusted (`~/projects/pob2-mcp: trusted`). Global `trusted_config_paths = []`. `paranoid = false`. `env_file` is unset, so mise does **not** load the repo `.env`.

**Tool `postinstall`, asdf backend and plugin pinning** [V]:
- dev-tools, "Tool postinstall commands": "runs once the install completes successfully for that tool/version. The tool's bin path is on PATH during the command… If the install fails, the `postinstall` command is not run."
- `install_env` is "Environment vars used during install and tool-level `postinstall`" (configuration.md, `[tools]`). The canonical example is `node = { version = "22", postinstall = "corepack enable" }`.
- The asdf backend page marks asdf plugins as "legacy"; its "Post-install hooks ❌" row is about plugin scripts, not the tool-level option.
- The luaJIT plugin's `bin/install:21` reads `LUAROCKS_VERSION` from env, else takes the latest from the GitHub API.
- `[plugins]` "supports specific gitref" (`node = "https://github.com/my-org/mise-node.git#DEADBEEF"`) for pinning a plugin revision (configuration.md, "`[plugins]`").

---

## 7. Git sparse, blobless, depth-1 clone of a tag (git 2.43)

Source: git-scm.com/docs/git-clone (v2.43 `Documentation/git-clone.txt`) [V]:
- **`--branch <name>`**: "`--branch` can also take tags and **detaches the HEAD at that commit** in the resulting repository."
- **`--depth <depth>`**: shallow; "Implies `--single-branch`".
- **`--filter=blob:none`**: "filter out all blobs (file contents) until needed by Git" (partial clone).
- **`--sparse`**: "only files in the toplevel directory initially being present."
- **`--no-checkout`**: "No checkout of HEAD is performed".

Source: git-scm.com/docs/git-sparse-checkout [V]:
- **`set`**: "Enable the necessary sparse-checkout config settings (`core.sparseCheckout`, `core.sparseCheckoutCone`, and `index.sparse`)… populate the sparse-checkout file… and update the working directory to match". It "will upgrade your repository config to use worktree-specific config".
- Cone mode is the default: a list of directories, which also includes sibling files of ancestors.
- `--no-cone` means "a list of patterns… we do not recommend using it" (section "INTERNALS -- NON-CONE PROBLEMS").
- The command is "EXPERIMENTAL".

**Observed** [V-run against GitHub, User-Agent `pob2-mcp-server/0.1`]:
- `git clone --filter=blob:none --sparse --depth 1 --branch v0.23.1 <PoB2 url> A` took 1.7 s:
  - **`A/.git/HEAD` = `7d6f530cbdab20389ff8bc6ba97a37ac27f74e41`**, a bare 40-hex SHA plus a newline, i.e. detached.
  - `git status -sb` → `## HEAD (no branch)`.
  - `git describe --exact-match` → `v0.23.1`.
  - Config: `remote.origin.fetch=+refs/tags/v0.23.1:refs/tags/v0.23.1`, `remote.origin.promisor=true`, `partialclonefilter=blob:none`, `extensions.worktreeconfig=true`, `core.sparsecheckout=true`, `core.sparsecheckoutcone=true`.
  - The initial sparse file is `/*` + `!/*/`, i.e. top-level files only. Size 7.0 MB.
  - The detached-HEAD advice text was printed **even with `--quiet`**.
- `git sparse-checkout set --no-cone /manifest.xml /runtime/lua/ /src/ '!/src/Export/' '!*.png' '!*.zst' '!*.jpg'` took 3.9 s:
  - It lazily fetched the blobs.
  - `sparsecheckoutcone=false`. The tree is now `manifest.xml runtime src`, and other top-level files were removed.
  - `src/HeadlessWrapper.lua` is present. Size 47 MB working tree + 12 MB `.git`.
  - **HEAD unchanged** (same SHA). `git status --porcelain` is empty.
- The S-2 script variant (`--no-checkout` + `sparse-checkout set` + `checkout <commit>`) is equivalent in result. [I]
- A promisor repo fetches missing objects on later history or diff commands, which needs network. [V config; I behaviour]

---

## Contradictions with vision.md

| Decision | Vision text | Finding |
|---|---|---|
| **D-13** (pnpm via corepack; "Done") | "pnpm (via corepack)… `mise.toml` pins `node = "24"`" | **Reproducibility gap.** [V]<br>• Corepack ships only with Node ≤ 24 ("no longer be distributed starting with Node.js v25").<br>• The project's `node@24` has a pnpm shim **only** because the global bootstrap ran `corepack enable` on `node@lts`, which is 24.16.0 today.<br>• mise `node.corepack=false`; `node@26` here has no pnpm.<br>• A fresh `node@24` install, or bootstrap after `lts` moves to 26, leaves `pnpm` unresolved inside `mise exec` / `mise run`. [I from V facts]<br>• Fix candidates: `node = { version = "24", postinstall = "corepack enable" }` (the mise doc's own example), or a mise-managed `pnpm` tool. The latter conflicts with the global CLAUDE.md "pnpm via corepack". Also, pnpm 11 self-switches versions from `packageManager` by default (`pmOnFail: download`), independent of corepack. |
| **D-17** (gate) | "`mise run test` = `mise run pob:fetch` + `pnpm test`, with explicit exit codes" | Exit codes **do** propagate. [V-run]<br>• **But** the effective task shell is `sh -c -o errexit` (dash) with **no pipefail**, despite the CLI doc's claim of `-o pipefail`. Any `cmd \| tee`/`\| tail` in a task masks failure (rc 0 observed). [V-run]<br>• **Coverage "reported, not gated"** conflicts with `jest.config.cjs:23-30`'s `coverageThreshold`: "If thresholds aren't met, jest will fail". Any coverage-collecting gate run fails unless that block is removed. [V] |
| **D-17** (worktree bootstrap) | "`mise trust && pnpm install --frozen-lockfile && mise run pob:fetch` (mise refuses untrusted configs at new paths)" | Confirmed, and **stricter than stated**: even a minimal `mise.toml` is refused (rc 1). `mise trust` must come before **any** mise command in the worktree, including `mise exec`. `MISE_TRUSTED_CONFIG_PATHS` is a non-persistent alternative. [V-run] Each worktree also needs its own `vendor/` fetch (gitignored, network, ~5 s). [V-run timing] |
| **D-17** (Jest) | Engine tests with long timeouts; "POESESSID cleared in Jest setup" | If the spec splits suites into Jest `projects`, **per-project `testTimeout` is silently ignored in 29.7** ("Unknown option"). [V-run] Use per-test timeouts or `jest.setTimeout` in `setupFilesAfterEnv`. Use `setupFiles` (per test file, before the framework) to clear `POESESSID`. [V doc; I choice] |
| **D-16** (watcher) | "uses polling for paths under `/mnt/*`, because inotify doesn't see Windows-side writes on drvfs" | Consistent with WSL issue #4739, which is open. **Chokidar's README does not document WSL/drvfs at all**; its only support is "over a network". [V] Unstated consequences: under polling chokidar's `atomic` is **off**, the default `interval` is **100 ms**, and the `CHOKIDAR_USEPOLLING`/`CHOKIDAR_INTERVAL` env vars override code. [V source] |
| **D-16** (registration) | "`mise exec -C ~/projects/pob2-mcp -- node build/index.js`… puts the pinned luajit and Node 24 on PATH" | Confirmed: child cwd = repo, PATH correct, mise execs in place, nothing on stdout, stdin passes through. [V-run] Not stated: it requires the checkout to be **trusted**, and `exec_auto_install=true` means a not-yet-installed tool is built on first MCP launch. [V-run settings; I impact] |
| **D-15** (credential getter) | "read `<packageRoot>/.env` with `util.parseEnv`… treats a missing file as no cookie" | `parseEnv` takes a **string**: the file read and the `ENOENT` → "no cookie" mapping are caller code. [V] Inconvenient parse facts [V-run]:<br>• A **UTF-8 BOM is not stripped**: a BOM-prefixed `POESESSID=` on line 1 yields key `"﻿POESESSID"`, so the cookie silently reads as missing.<br>• An **unquoted `#` truncates** (`abc#def` → `abc`).<br>• Duplicate keys: last wins.<br>• Escaped quotes are unsupported.<br>• Invalid names are not rejected, contrary to the doc's regex.<br>`op://…` passes through verbatim, which supports the vision's error. `.env` is mode `0644` today (from `ls -la`, contents not read). |
| **D-10** (zod) | "declared as a direct dependency; today it is only transitive and doesn't resolve under pnpm" | **Confirmed** for CJS, ESM and TS. [V-run] Adding it requires a lockfile update. A frozen install otherwise fails `ERR_PNPM_OUTDATED_LOCKFILE`. [V-run] |
| **D-2** (no `import.meta.url`; `.git/HEAD == pin.commit`) | — | **Confirmed.** TS1343 under ts-jest, because ts-jest forces CommonJS. [V-run] A tag clone leaves `.git/HEAD` as the bare commit SHA. [V-run] `argv[1]` walk-up works under Jest. [V-run] No contradiction. |

---

## Facts the spec must state

1. **`@types/node` bump is NOT required for `util.parseEnv`.** 20.19.23 declares it (`util.d.ts:1189`), along with `loadEnvFile`, `AbortSignal.any/timeout` and global `fetch`. A bump to `@types/node@^24` (24.19.1 available) is optional, to align types with the Node 24 runtime. [V]
2. **zod:** choose a range explicitly and update the lockfile in the same unit (`pnpm add zod@…`).
   - `^3.25.76` dedupes with the SDK's copy and offers `"zod"` (v3 API) and `"zod/v4"` (v4 API, no `.validate()`).
   - `^4` gives a second copy. Zod docs call v3 "functionally end-of-life".
   - State which error formatter is used: v3 `.flatten()`/`.issues`, or v4 `z.prettifyError`/`z.treeifyError`. [V]
3. **No `import.meta` in any `src/` module reachable from tests**, while the test transform is ts-jest CJS (ts-jest overrides to CommonJS/Node10 unless `useESM` + `--experimental-vm-modules`). ts-jest **diagnostics are on**, so type errors fail suites. [V]
4. **Jest `testTimeout` is global-only.** `projects[]` entries cannot set it. `setupFiles` runs per test file, before the framework is installed. `globalSetup` globals are not visible to tests. [V]
5. **Coverage:** to keep coverage "reported, not gated", delete or relax `coverageThreshold` (`jest.config.cjs:23-30`), or never collect coverage in the gate. [V]
6. **mise task shell has no `pipefail`.** Gate tasks must not use pipes, or must set `shell = "bash -c -o errexit -o pipefail"` per task. Multi-entry `run` arrays stop at the first failure and propagate its exit code. `depends` failures abort the task. [V-run]
7. **mise trust:** any new path (worktree, fresh clone) needs `mise trust` (or `MISE_TRUSTED_CONFIG_PATHS`) **before any** `mise exec`/`run`, even for a minimal `mise.toml`. Non-interactive runs fail with rc 1 and the exact text "Config files in <path> are not trusted." [V-run]
8. **Corepack:** pin the activation in `mise.toml` (`node = { version = "24", postinstall = "corepack enable" }`) or document the bootstrap dependency. Never move `node` to ≥ 25 while relying on corepack. For unattended first downloads, consider `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` [V doc; I need].
9. **LuaJIT toolchain reproducibility:**
   - The asdf plugin itself is unpinned (current checkout `bd4977e`). It can be pinned via `[plugins]` `url#ref`.
   - `LUAROCKS_VERSION` in `[env]` leaks into every `mise exec`/task env. `install_env` scopes it to install and `postinstall`, and still needs trust.
   - `exec_auto_install` and `task.run_auto_install` are on. [V]
10. **Server shutdown:** SDK 1.20.2's stdio transport ignores stdin EOF, and a piped live luajit child keeps Node alive. The server entry must handle `process.stdin` `'end'` (the MCP host's first shutdown step) as well as SIGTERM/SIGINT, and kill the Lua child.
    - `kill()` defaults to SIGTERM. `killed` does not mean the child exited. Await `'exit'` (or `'close'` for flushed stdio).
    - `'error'` (e.g. ENOENT for a missing `luajit`) may fire without `'exit'`.
    - Always drain stdout and stderr (pipe-capacity deadlock). [V]
11. **Trade HTTP parsing:**
    - `headers.get()` joins repeated headers with `", "`, so split rate-limit lists on `/,\s*/`.
    - `Retry-After` is a string.
    - Timeout = `DOMException` `name "TimeoutError"`. Caller abort = `"AbortError"`. Network failure = `TypeError("fetch failed")` with `cause.code` (e.g. `ECONNREFUSED`). [V-run]
12. **`.env` parsing contract** (if D-15 stays on `util.parseEnv`): strip a leading `﻿`, treat `ENOENT` as no cookie, trim, and document that values containing `#` must be quoted. A test fixture should cover the BOM, CRLF and `export ` prefix cases. [V-run]
13. **chokidar under polling:**
    - Set `usePolling: true` plus an explicit `interval`; the default 100 ms means a stat per file every 100 ms over 9p.
    - Expect `unlink`+`add` instead of `change` for delete-and-recreate saves, since `atomic` is off.
    - Remember `CHOKIDAR_USEPOLLING`/`CHOKIDAR_INTERVAL` override code.
    - `depth` undefined means unlimited recursion.
    - `@types/chokidar@1.7.5` is unused and removable. [V]
14. **pnpm 11:**
    - `strictDepBuilds` defaults to true and `onlyBuiltDependencies` no longer exists (use `allowBuilds` in `pnpm-workspace.yaml`).
    - No current dependency has build scripts, so nothing needs approval today. [V-run]
    - A future dependency with a postinstall makes `pnpm install` fail (`ERR_PNPM_IGNORED_BUILDS`) until allowed. [V doc]
15. **Pin check:**
    - `.git/HEAD` holds `<40-hex>\n`. Trim before comparing. Do not assume `ref: …`.
    - Clone with `-c advice.detachedHead=false` to silence the advice, which `--quiet` does not suppress.
    - `sparse-checkout set --no-cone` is git's not-recommended mode, but it is required for the exclusion patterns. [V-run]

## Open unknowns

- **Windows-side writes on `/mnt/c` were not tested.** Detection of a Windows-side write by chokidar polling was not run, because it needs a Windows-side writer and that is outside read-only scope. It is expected to work because `fs.watchFile` polls `stat` [I]. Also unknown: whether Windows PoB2 saves atomically (temp + rename), which decides `change` vs `unlink`+`add` under polling.
- **pnpm 11.6.0 vs current 11.x docs.** It is unverified whether 11.6.0 matches the docs for `verifyDepsBeforeRun` (auto-install before `pnpm run`) and the 11.2x-era `approve-builds` changes.
- **Corepack first download.** Not tested: corepack's first-download prompt for `pnpm@11.6.0` in a non-TTY fresh environment. The cache is warm on this box.
- **Jest env propagation.** Not verified: whether `process.env` changes made in `globalSetup` reach test workers.
- **WSL issue #4739 has no Microsoft response.** It records no Microsoft team response, and no official Learn page states the inotify limitation.
