# Slice 02: Engine (wire protocol, bridge client, session, build-file writer, contracts, engine-op fixes)

Part of the [spec spine](README.md). It covers work units WU-06…WU-13 and WU-22, and acceptance criteria
AC-E1…AC-E64.

This slice makes the engine connection trustworthy. It covers:
- **Request/reply matching:** request ids, real timeouts, and an engine that only the session starts.
- **Crash recovery that loses no edits.**
- **Concurrency:** one lock per tool call, and a revision counter.
- **Files on disk:** a disk-change policy for the collaborative workflow (D-19), and build-file write
  rules that never clobber the user's work, including on a case-insensitive Windows drive (C-17, D-52).
- **Correct engine data:** runtime-checked reply shapes (D-10) and fixes for every engine tool PoB2
  computes wrong or reports wrong.

## 1. Existing system context (this slice)

Detail and citations are in [grounding/ctx-lua.md](../grounding/ctx-lua.md) and
[grounding/ctx-ts.md](../grounding/ctx-ts.md). The repo is at `968a104` and PoB is at tag `v0.23.1`.

- **Lua side (`pob-api/`).** The read loop is `pob-api/API/Server.lua:63-87`.
  - **Requests:** `{action, params}`, with no id.
  - **Replies:** `{ok, error?, …}`.
  - **Exceptions:** caught by `pcall(handler, params)` and returned as `{ok:false,error:"exception: …"}`.
  - **JSON encoding happens in `write_line`, outside the `pcall`** (`:34-37,83`). An unencodable reply
    kills luajit. This happens with `calc_with`'s raw output, and with `get_stats` given a non-scalar
    field such as `ReqStrItem` (E1, ctx-lua X13).
  - **Ready banner:** `{ok,ready,version:{number,branch:"?",platform:"?",apiVersion:"1.0.0"}}` (`:62`).
  - On EOF the loop breaks.
  - The action table is 39 handlers plus `quit` (ctx-lua §3). Mutators call `calcsTab:BuildOutput()`
    and never `OnFrame`.
  - `save_build` writes the file from Lua with `io.open(path,'w+')` (`BuildOps.lua:907-925`).
- **PoB dev mode.** Dev mode is always on, because the manifest has no branch or platform. Its autosave
  then fires on every load (`Build.lua:1086-1100`):
  - it targets `/Builds/~~temp~~.xml`, which is never creatable headless;
  - **any failed load after a successful one wedges the engine** (`Build.lua:2443`, ctx-lua X3);
  - `main.disableDevAutoSave = true` prevents both.

  `load_build_xml` never checks whether the load succeeded (`Handlers.lua:86-96`). PoB2 on Windows
  saves by truncate-then-write (`Build.lua:2468-2473`), but every truncation of the golden XML fails
  `ParseXML`.
- **The first `get_stats` after a load reorders `<FullDPSSkill>` elements in a later export.**
  `export_build_xml` is otherwise byte-stable within one process. Exports differ across processes, in
  section and attribute order.
- **TS bridge (`src/pobLuaBridge.ts`).**
  - No request ids. A single `isSending` flag rejects concurrent calls.
  - Each request returns the first JSON line read after it.
  - The timeout covers each **line read** and doesn't kill the process, so a late reply reaches the next
    caller (E5).
  - The child inherits the whole `process.env` (`:115-117`). It is spawned with the global `spawn`.
  - There is a `JEST_WORKER_ID` hack (`:141`).
- **Engine manager (`src/server/luaClientManager.ts`).** `ensureClient` isn't single-flight. It
  silently restarts the engine, which loses the build. Its readiness probe loads a PoE1-root XML up to 5
  times (`:58-64`).
- **Handlers.**
  - Handlers call `context.ensureLuaClient()` themselves; 6 engine paths never do (ctx-ts §4).
  - `analyze_build` (`buildHandlers.ts:67-70`), `compare_builds` (`:236-242`), `analyze_defenses`
    (`optimizationHandlers.ts:46-51`) and `validate_build` (`validationHandlers.ts:51-57`) call
    `loadBuildXml` directly and replace the engine's build.
  - Many handlers swallow engine errors (e.g. `luaHandlers.ts:155-193`).
  - TS keeps no record of which file the engine holds.
- **The builds folder** (`/mnt/c/...`, drvfs 9p `cache=5`) is **case-insensitive**: `Grenadator.xml`,
  `grenadator.xml` and `GRENADATOR.XML` stat to one inode, and `fs.realpath` keeps the caller's casing.
- **Engine tool defects** owned here (recon §2–3, ctx-lua):

  | Defect | What goes wrong |
  |---|---|
  | E2 | `set_tree`/`update_tree_delta` pass `{}` weaponSets and hashOverrides (`BuildOps.lua:113,198`) |
  | E3 | Call sites need `construct()`. The old style is correct on the tag |
  | E7 | The default stat list is narrow (`BuildOps.lua:38-45`) |
  | E8 | `get_items` exports hidden slots. Tree sockets show `inactive==nil` until `UpdateSockets()` (X11). `get_items` reads `activeItemSet[...].active` (`BuildOps.lua:438-441`) |
  | — | Shape mismatches: `nodeCount`/`pointsUsed`, `size`/`bytes`, `result.specs`, `activeItemSetId`, `_meta`, `targetVersion` |
  | — | `new_build` ignores its params |
  | — | `set_enemy_stats` level is a no-op |
  | — | Unknown gems are accepted |
  | X12 | `toggle_flask` writes only `activeItemSet[...].active`, not `slot.active`. Charms always load inactive (`ItemsTab.lua:1159,1496`) |
  | — | PoE1 class maps in TS |
  | — | `export_build`/`save_tree` write a PoE1 `<PathOfBuilding>` root (`buildExportService.ts:324`) |
  | — | `lua_save_build` overwrites silently |
- **State.**
  - Snapshots, backups, exports and presets live under `<POB_DIRECTORY>/.pob-mcp*` (ctx-ts §7).
  - The build-parse cache (`buildService.ts:7,58-81`) holds entries for 60 s, keyed by the name as passed.
  - The watcher uses chokidar 4.0.3 without polling, ignores only dotfiles, and invalidates by basename.

## 2. Functional requirements

- **FR-E1.** Every engine request gets its own reply or a definite error. A slow or crashed engine never
  hands one call's reply to another call, and never silently swaps in a blank build.
- **FR-E2.** Tool calls that touch the engine are serialized end to end, even when the host issues them
  in parallel.
- **FR-E3.** A crash or timeout never silently loses edits. The engine is restored to the state after the
  last completed change, and the user is told what wasn't applied. If restoring is impossible, the call
  fails rather than running against an empty engine.
- **FR-E4 (D-19, collaborative editing).** When the user saves the loaded build in PoB2:
  - if Claude has no unsaved engine edits, the next engine call reloads the build automatically and says
    so;
  - otherwise the call warns;
  - the server never writes over a file that changed since the engine loaded or saved it, however the
    name is cased.
- **FR-E5.** Every engine reply has a runtime-checked shape, and every engine tool reports PoE2-correct,
  complete data (classes, tree versions, defences, slots).
- **FR-E6.** Engine-op tools do what their names say on PoE2:
  - tree edits keep attribute choices and weapon sets;
  - items and specs construct correctly;
  - unknown gems are rejected;
  - flasks and charms toggle for real;
  - config edits apply;
  - the leveling plan honours a class override.
- **FR-E7.** File tools write PoE2 XML only where they are allowed to, keep backups, and never change the
  engine's working build as a side effect. Server state lives outside the builds folder (D-18).

## 3. Interface contracts defined in this slice

### C-2: Engine wire protocol v2 (modified; replaces v1)

**Framing and messages.** UTF-8, one JSON object per line, on luajit's stdin and stdout. stderr is
diagnostics only.

| Message | Shape |
|---|---|
| Request (TS → Lua) | `{"id": <integer ≥ 1>, "action": "<snake_case>", "params": {…}}`. `params` is optional and defaults to `{}` |
| Success (Lua → TS) | `{"id": <echoed>, "ok": true, …payload}` |
| Failure (Lua → TS) | `{"id": <echoed>, "ok": false, "error": "<message>", "code": "<CODE>"}` |
| Banner (first stdout line, no `id`) | `{"ok": true, "ready": true, "version": {"number": "<PoB version>", "branch": "?", "platform": "?", "apiVersion": "2.0.0"}}` |

**Failure codes:**
- `FAILED`: the handler returned `{ok=false}`. The server adds this code when the handler didn't set one.
- `EXCEPTION`: the handler raised. The error is the message.
- `ENCODE`: the reply couldn't be encoded (a cycle, a function, userdata). **The process stays alive.**
- `UNKNOWN_ACTION`.
- `INVALID_JSON`: the request line didn't parse. This reply has no `id`.
- `LOAD_FAILED`: see `load_build_xml` below.

**Encoding.** It happens inside a `pcall`. If encoding the reply fails, the server writes the `ENCODE`
failure for the same id.

**Boot.** `bootstrap.lua` sets `main.disableDevAutoSave = true` right after `dofile('HeadlessWrapper.lua')`,
before any load (D-29).

**`load_build_xml {xml, name}`.**
- **Pre-validation.** It requires non-empty `xml` that parses with `common.xml.ParseXML`, whose root
  element is `PathOfBuilding2`. Otherwise it fails with `LOAD_FAILED` and an error naming the problem
  ("empty XML" / "XML parse error: …" / "root element is <X>, expected PathOfBuilding2"). **The engine's
  current build is untouched.**
- **Post-check.** After the load it requires `main.mode == "BUILD"`, `main.newMode == nil` and
  `build.buildName == name`. Otherwise it fails with `LOAD_FAILED`. Before each load it clears
  `launch.promptMsg`. If a message is set afterwards, that text goes into the error.
- **Success reply:** `{id, ok:true, result:{name}}`. The meaningless `build_id` is dropped.

**`save_build`** is **removed** in WU-22 (D-60). Files are written by TS (C-17).

**EOF on stdin** ends the loop, and the process exits 0.

**Test actions.** These are registered **only** when the env has `POB_API_TEST_ACTIONS=1`. Otherwise
they return `UNKNOWN_ACTION`.

| Action | Behaviour |
|---|---|
| `__test_sleep {ms}` | busy-waits `ms` milliseconds of `os.clock()`, then `{ok:true}` |
| `__test_crash {code?}` | `os.exit(code or 3)` |
| `__test_cycle` | returns a self-referencing table, which exercises `ENCODE` |
| `__test_state` | `{ok:true, result:{popups:<#main.popups>, promptMsg:<string\|null>, devAutoSaveDisabled:<bool>, mode:<main.mode>, buildName:<string\|null>}}` |
| `__test_eval {code}` | runs `loadstring(code)()` in the live state and returns `{ok:true, result:<return value>}`. The value must be encodable; otherwise the reply is `ENCODE` |

### C-4: Bridge client API (modified)

```ts
// src/pobLuaBridge.ts (public surface)
class PoBLuaApiClient {
  constructor(opts: { env: Readonly<Record<string,string|undefined>>; spawn: typeof import('child_process').spawn;
                      pobSrc: string; pobApiDir: string; pin: Pin });
  start(): Promise<void>;     // spawn + checks; single-flight while starting; a rejected start clears the slot
  request<A extends ActionName>(action: A, params?: ActionParams<A>,
                                opts?: { timeoutMs?: number; signal?: AbortSignal }): Promise<ActionReply<A>>;
  isAlive(): boolean;
  pid(): number | null;
  stop(): Promise<void>;      // quit → await exit ≤ 2 s → SIGKILL
  // existing typed methods remain as thin wrappers over request() (minus deleted ones)
}
```

**Spawn.** Only `start()` spawns (D-59).
- `cmd` is `env.POB_CMD || "luajit"`.
- `args` is `[env.POB_ARGS]` when set, else `[<pobApiDir>/bootstrap.lua]`.
- `cwd` is `pobSrc` (C-6).
- The env is `opts.env` **minus `POESESSID` and `POE_SESSION_ID`** (D-28), plus `LUA_PATH`/`LUA_CPATH` as
  today.
- stderr is always drained into a ring buffer of the last 50 lines and logged as `[PoB API stderr] …`
  (`POB_DEBUG=true` also echoes stdout).

**Start.** `checkPin()` (C-6) runs first; a refusal throws `EnginePinError(reason, hint)`. Then:
- wait ≤ 15 s for the banner;
- require `version.apiVersion` major `2`, and `version.number == pin.version` unless
  `POB_ALLOW_UNPINNED=true`;
- then send `ping`. **No XML is loaded as a readiness probe** (D-29).

**Errors from `start()`:**
- `ENOENT`: "luajit not found on PATH. Launch the server via `mise exec` (see README), or run tests with
  `mise run test`."
- Exit before the banner: "engine exited during startup (code c, signal s): <last ≤ 20 stderr lines>".
- The `JEST_WORKER_ID` hack is removed.

**Requests.**
- Ids increase monotonically from 1 per process.
- A pending map holds `id → {action, resolve, reject, timer}`.
- **The timer starts when the line is written to stdin.** It defaults to `POB_TIMEOUT_MS` (30 000); the
  exception is `trade_generate_query` at 60 000 (D-47). A caller's `timeoutMs` overrides it.
- Reply lines are matched by `id`. A JSON line with an unknown id is logged and dropped, and non-JSON
  lines are ignored.
- **A request on a dead client rejects with `EngineExitedError` and never spawns.**

**Failures and validation.**
- **Timeout:** reject `EngineTimeoutError(action, ms)`, SIGKILL the child, and reject every other pending
  request with `EngineExitedError`.
- **Child exit:** reject all pending requests with `EngineExitedError(code, signal, lastStderr)`.
- **Contract:** each `ok:true` reply is validated by `replySchemas[action]` (C-5). A failure rejects
  `EngineContractError(action, zodIssues)` and **keeps the engine alive**.
- A reply with `ok:false` rejects `EngineActionError(action, code, error)`.

### C-5: Lua action reply schemas (new)

- **Location.** `src/engine/schemas.ts` exports
  `replySchemas: { [A in ActionName]: z.ZodType<ActionReply<A>> }` and the `ActionName` union. Types are
  `z.infer<…>`. It uses zod v3 (D-26). The `__test_*` actions have **no** schemas and aren't in
  `ActionName`; the client passes their replies through unvalidated.
- **dkjson tolerance (R-8).** Helpers:
  - `luaArray(item)` accepts an array, and also `{}` encoded as `[]`;
  - `luaMap(value)` accepts a record, and also `[]` for an empty table;
  - numbers that PoB can produce as NaN/inf are `z.number().nullable()`.
- **Base schema.** Every reply schema extends `z.object({id: z.number().int(), ok: z.literal(true)})`
  with `.passthrough()`, so additive fields don't break compatibility.
- **Coverage.** Every action registered in Lua has a schema. That means the actions left after the
  WU-04 deletions, minus `save_build` (WU-22), plus:
  - `list_support_candidates` (WU-11);
  - `get_warnings` (WU-18);
  - the three `Trade.lua` actions (WU-16).

  A static test compares the non-test Lua action names (parsed from `Handlers.lua` and `Trade.lua`) with
  `Object.keys(replySchemas)`. A unit that adds a Lua action adds its schema and its contract-test case
  in the same merge.

### C-3: Engine session (new)

```ts
// src/engine/session.ts
export type EngineKind = 'read' | 'mutate' | 'load' | 'lifecycle';   // from TOOL_META (C-8); 'none' bypasses the session
export interface Fingerprint { size: number; mtimeMs: number; sha1: string }
export interface LoadedBuild {
  path: string | null;          // canonical POSIX path relative to POB_DIRECTORY (D-52); null when not from a file
  displayName: string;          // file name without .xml, or "New build" / "Imported build"
  fingerprint: Fingerprint | null;  // of the bytes the engine loaded, or last saved from the engine
  loadedRevision: number;
  savedRevision: number;        // revision at the last load or engine save to `path`
}
export interface EngineSession {
  run<T>(call: { tool: string; kind: EngineKind; signal?: AbortSignal; deadline?: number },
         fn: (ctx: EngineCallContext) => Promise<T>): Promise<{ value: T; notices: string[] }>;
  readonly revision: number;
  readonly loaded: LoadedBuild | null;   // null only when no engine runs
  isDirty(): boolean;                     // loaded !== null && revision > loaded.savedRevision
  onEvent(cb: (e: { tool: string; kind: EngineKind; phase: 'queued' | 'start' | 'end'; t: number; ok?: boolean }) => void): () => void;  // test hook
  enginePid(): number | null;            // test hook
  shutdown(): Promise<void>;
}
export interface EngineCallContext {
  client: PoBLuaApiClient;     // session-scoped: rejects load_build_xml / new_build ("engine load outside the session")
  loadFile(relPath: string): Promise<LoadedBuild>;
  loadXml(xml: string, origin: { displayName: string }): Promise<LoadedBuild>;   // path = null
  newBuild(params: { className?: string; ascendancy?: string }): Promise<LoadedBuild>;   // displayName "New build"
  withTemporaryBuild<T>(xml: string, fn: () => Promise<T>): Promise<T>;   // D-9: export → load xml → fn → reload export; revision/loaded unchanged, also on failure
  noteSaved(relPath: string, fp: Fingerprint): void;   // ONLY after writing the engine's current build (C-17 step 6)
  fingerprint(relPath: string): Promise<Fingerprint | null>;
}
```

Constants:
- `NEW_BUILD = {path: null, displayName: "New build", fingerprint: null}`, with both revisions set to the
  current `revision`.
- **`loaded` is never null while an engine runs.**

`session.run(call, fn)` does the following, in order:

0. **Events.** It emits `queued`. The router passes `deadline = call.arrivedAt + budget` for
   `find_upgrades` only.
1. **Lock.** A FIFO mutex; one engine tool call at a time, of any kind.
   - If `signal` aborts while the call is waiting, it rejects with `AbortError` and never runs.
   - If `deadline` passes while it waits, it rejects with `EngineBusyError`.
   - It emits `start` on acquiring the lock.
2. **Ensure the engine.** If no engine runs, `start()`, which is single-flight. Start errors propagate.
   - On a first start, or a start after `lua_stop`, set `loaded = NEW_BUILD`.
   - A start after a crash goes to step 3.
   - `kind: 'lifecycle'` follows rule L below instead of steps 2–6.
3. **Recover after a crash.** This applies when the engine exited outside `stop()` since the last call.
   - **With a recovery snapshot:** `load_build_xml(snapshot.xml, loaded.displayName)`. `loaded` and
     `revision` are unchanged. The notice is:
     `Engine restarted; restored the build to its state after \`<snapshot.afterTool>\`.`
     If a call was in flight when the engine died, append:
     ` The interrupted call \`<tool>\` was not applied.`
   - **If that restore fails** (any error), kill the engine, discard the snapshot, and take the
     no-snapshot path. It is never retried.
   - **No snapshot:** set `loaded = NEW_BUILD`.
     - `read`/`mutate` calls return `isError` `Engine restarted; the loaded build could not be restored. Load it again.`
       without running `fn` (D-8).
     - `load` calls get the same text as a notice, and proceed.
4. **Disk-change check (D-19).** This is skipped for `kind: 'load'`. If `loaded.path` is set:
   - `stat` it. If size and mtime equal the recorded fingerprint, the file is unchanged.
   - Otherwise read the bytes and hash them. If the sha1 equals the recorded one, refresh the recorded
     `mtimeMs` and treat the file as unchanged.

   | Result | Engine state | Action and notice |
   |---|---|---|
   | File missing | any | `Warning: <path> no longer exists on disk.` |
   | Changed | dirty | `Warning: <path> changed on disk (probably saved in PoB2), but the engine has unsaved changes from \`<last mutating tool>\`. Reload it with lua_reload_build (discarding the engine's changes) or save under a new name.` |
   | Changed | clean | **4a, auto-reload:** see below |

   **4a, auto-reload.** Load **the bytes just hashed** with `load_build_xml`.
   - **On success:**
     1. `fingerprint := {size, mtimeMs, sha1}` of those bytes;
     2. `revision += 1`, and `loadedRevision = savedRevision = revision`;
     3. take a fresh recovery snapshot (`afterTool: "auto-reload"`); if that export fails, discard the
        snapshot;
     4. notice `Reloaded <path>: it changed on disk since the engine loaded it.`
   - **On failure:** kill the engine, so the next step 3 restores the unchanged snapshot. Return
     `isError` `<path> changed on disk but could not be loaded (it may be mid-save in PoB2): <error>`.
     `loaded` and its fingerprint stay unchanged, so the next call retries.
5. **Run `fn(ctx)`.** Record `enginePid()` first. The router makes the session's client the only one
   handlers can reach, so `ensureLuaClient()`/`getLuaClient()` resolve to `ctx.client` inside a run and
   throw "engine access outside a session" outside one. `ctx.client` rejects `load_build_xml` and
   `new_build`; only the `ctx.*` load methods reach them.
6. **On success**, if the engine pid is unchanged and the engine is alive:
   - For `mutate`/`load`: `revision += 1`. For a load made by `fn` (`loadFile`/`loadXml`/`newBuild`),
     set `loaded.loadedRevision = loaded.savedRevision = revision`.
   - Then take the **recovery snapshot** (D-44): `export_build_xml` → `{xml, revision, afterTool: tool}`,
     keeping the latest only. If the export fails, **discard** the snapshot and add the notice
     `Warning: could not snapshot the engine state; a crash now would lose the last change.`
   - `read` calls change nothing here. `withTemporaryBuild` already restored the engine.
7. **On failure, or if the engine died during step 5 or 6:**
   - `revision` is unchanged and step 6 is skipped.
   - If the engine died, mark it crashed and record `tool` as the in-flight call for the next step 3. The
     error text gets:
     ` (The engine stopped while running \`<tool>\`; the next engine call restores the last state.)`
   - A **failed load** (`LOAD_FAILED`, a timeout or a crash inside `loadFile`/`loadXml`) leaves `loaded`
     unchanged. If the load's post-check failed, the engine is killed, so the next step 3 restores the
     pre-load snapshot.
8. **Notices.** The router prepends them to the tool's output text, one per line, followed by a blank
   line. They also apply to `isError` results. `end` is emitted with `ok`.

**Rule L (lifecycle).**
- **`lua_start`:** take the lock, run steps 2–3, skip 4–6.
- **`lua_stop`:** take the lock, skip steps 2–6. Then:
  - stop the engine;
  - clear `loaded`, the snapshot and the in-flight marker;
  - `revision += 1`;
  - when the engine was dirty, the tool's text adds `Discarded unsaved changes from \`<last mutating tool>\`.`

### C-16: State directory (new; D-18; delivered by WU-22)

**Location:** `stateDir = ${XDG_STATE_HOME:-~/.local/state}/pob2-mcp` (computed by the entry, C-7).
Subdirectories are created on first write.

| Path | Contents | Format |
|---|---|---|
| `snapshots/<build relpath>/` | `snapshot_build` output | Unchanged from today: `<id>_<tag>.xml` (byte copy of the build file) + `<id>_metadata.json` (`SnapshotMetadata`), `id` = ISO timestamp with `:`/`.` → `-` |
| `backups/<build relpath>/` | copies taken before any overwrite (C-17) | `<id>_backup.xml`, or `<id>_before-restore.xml` when the writer is `restore_snapshot` |
| `exports/` | `export_build`'s default output directory | `<output_name>.xml` |
| `presets/` | config presets | `<name>.json`, same content as today |

Nothing is pruned (as today). Old `<POB_DIRECTORY>/.pob-mcp*` locations are ignored. No migration is
needed for this user (spine §4).

### C-17: Build-file write rules (new; delivered by WU-22)

Every server write into `POB_DIRECTORY` goes through one module, `src/services/buildFileWriter.ts`:
`writeBuildFile({name, bytes, overwrite, kind, ctx?})`. The writes are:
- `lua_save_build` (engine content);
- `import_build save_as` (the XML just loaded);
- `restore_snapshot` (bytes);
- `set_build_notes` (text);
- `export_build` when it targets `POB_DIRECTORY`.

1. **Path.** `canonicalBuildPath(<name>.xml, POB_DIRECTORY)` (D-52). Subfolders are allowed, and a
   missing parent folder is created (`mkdir -p`).
2. **Existing target.** It requires `overwrite: true`. Otherwise the result is `isError`:
   `<path> already exists; pass overwrite: true to replace it (a backup is kept).`
   `restore_snapshot` and `set_build_notes` imply overwrite.
3. **Changed-on-disk guard.**
   - If the canonical target is `loaded.path`, compare its current fingerprint with
     `loaded.fingerprint`.
   - Otherwise compare with the writer's own record of its last write to that path in this process, if
     any.

   If they differ, the write is **refused** with:
   `<path> changed on disk since the engine loaded or saved it (probably saved in PoB2). Reload it first (lua_reload_build) or save under a new name.`
   **No flag overrides this, and there are no exemptions.** If the recorded file no longer exists, the
   write is treated as a new file and allowed, with the notice
   `<path> no longer existed on disk; created it again.`
4. **Backup.** Before replacing a file, copy it to `<stateDir>/backups/<relpath>/<id>_backup.xml`
   (`<id>_before-restore.xml` for `restore_snapshot`). **A backup failure aborts the write** with
   `isError` naming the OS error, and the target is untouched.
5. **Write.** Write `bytes` to `<target>.pob2mcp-tmp` in the same directory, then rename it over the
   target. That temp name isn't `.xml`, so PoB2 never lists it.
   - Engine saves pass `export_build_xml` output, whose root is `<PathOfBuilding2>`.
   - **On a temp-write or rename failure:** unlink the temp file (in a `finally`) and record nothing.
     The result is `isError` naming the OS error code, the target and the backup path.
   - A leftover temp file from an earlier crash is overwritten by the next write to that target.
6. **After a write:**
   1. The writer records the new fingerprint for that path, and invalidates the build-parse cache entry
      (D-58).
   2. **Only when `bytes` are the engine's current build** (`kind: 'engine'`: `lua_save_build`, and
      `import_build save_as` of the XML just loaded) does it call `ctx.noteSaved(path, fp)`. That sets
      `loaded.fingerprint`, `savedRevision = revision`, and re-points `loaded.path`/`displayName` to the
      target when it differs (Save As, D-51d).
   3. Byte copies and text edits to `loaded.path` leave `loaded.fingerprint` alone. C-3 step 4 then
      reloads the file (clean engine) or warns (dirty engine).
   4. The message includes the relative path and the byte count. When an existing file was replaced, it
      adds: `If this build is open in PoB2, re-open it there to see the changes.`

### C-20: Build watcher (modified; D-43)

- **chokidar options:** `usePolling: true, interval: 1000` when `POB_DIRECTORY` starts with `/mnt/`.
  Otherwise native events. Only `.xml` files. `ignored` skips dotfiles and, newly, `~~temp~~`.
  `awaitWriteFinish` is unchanged.
- **Cache invalidation:** by canonical relative path.
- **Tool descriptions:** they state that watching only tracks recent changes and invalidates caches, and
  that reloading the engine happens on the next engine call (C-3 step 4), whether or not watching is on.

## 4. Work units

### WU-06: Engine wire protocol v2, Lua side + TS readiness probe
- kind: build
- depends-on: [WU-05]
- role: lua-dev
- touches: [`pob-api/bootstrap.lua`, `pob-api/API/Server.lua`, `pob-api/API/Handlers.lua` (`load_build_xml`, `new_build` reply shape, test actions), `pob-api/API/BuildOps.lua` (`export_stats` non-scalar filtering, `calc_with` numeric whitelist), `src/server/luaClientManager.ts` (readiness probe → `ping`), `tests/helpers/luaLineClient.ts` (new), `tests/integration/protocol.lua.test.ts` (new)]
- produces: [C-2]
- consumes: [C-6]
- acceptance: [AC-E1, AC-E2, AC-E3, AC-E4, AC-E5, AC-E6]
- milestone: M-2
- summary: Implement C-2:
  - echo `id`;
  - encode inside the `pcall`;
  - failure codes;
  - apiVersion `2.0.0`;
  - env-gated test actions, including `__test_eval`;
  - `disableDevAutoSave`;
  - validated loads.

  Also:
  - `get_stats` exports only number, string and boolean values, and lists the omitted keys in
    `_meta.omitted`;
  - `calc_with {addNodes?, removeNodes?, useFullDPS?, fields?}` returns `{output: {<field>: number}}`
    for the requested fields only (default: `export_stats`' default list), never PoB's raw output (E1).

  **In the same merge,** change the TS readiness probe to the banner + `ping` (D-29). The v1 TS request
  path ignores ids and extra fields, so it keeps working until WU-07.

### WU-07: Bridge client v2, TS side
- kind: build
- depends-on: [WU-06]
- role: backend-dev
- touches: [`src/pobLuaBridge.ts`, `src/server/luaClientManager.ts`, `src/engine/schemas.ts` (new: registry scaffold + base schema), `tests/unit/pobLuaBridge*.test.ts`, `tests/mocks/pobProcess.mock.ts`]
- produces: [C-4, the C-5 registry scaffold]
- consumes: [C-2, C-6]
- acceptance: [AC-E7, AC-E8, AC-E9, AC-E10, AC-E11, AC-E12, AC-E13, AC-E14, AC-E23]
- milestone: M-2
- summary: Implement C-4:
  - ids and the pending map;
  - write-anchored timeouts that kill the engine;
  - **no self-restart** in `request()`;
  - single-flight `start()` (a rejection clears the slot) with the pin check, banner checks and `ping`;
  - an env from deps, with the cookies scrubbed;
  - injected `spawn`;
  - diagnostic start errors;
  - `pid()`;
  - a validation hook backed by `replySchemas`, where a missing schema passes through until WU-09
    completes it;
  - removal of the `JEST_WORKER_ID` hack.

  Update the mock process to the v2 protocol.

### WU-08: Engine session
- kind: build
- depends-on: [WU-07]
- role: backend-dev
- touches: [`src/engine/session.ts` (new), `src/utils/pathSanitizer.ts` (`canonicalBuildPath`), `src/server/createServer.ts`, `src/server/toolRouter.ts`, `src/server/toolMeta.ts` (corrections only), `src/server/luaClientManager.ts` (folded into the session or removed), `src/utils/contextBuilder.ts` (`ensureLuaClient`/`getLuaClient` → session-scoped), `src/handlers/luaHandlers.ts` (load paths through `ctx.*`; `lua_start`/`lua_stop` per rule L), `src/handlers/buildHandlers.ts` + `validationHandlers.ts` + `optimizationHandlers.ts` (only so the guard's error propagates instead of being swallowed), `tests/fixtures/tool-hygiene-allowlist.json` (interim entries, D-51f), `tests/fixtures/tool-calls.json` (state-changing sample args for AC-E16), `tests/helpers/server.ts` (exposes `session`)]
- produces: [C-3, `canonicalBuildPath` (D-52)]
- consumes: [C-4, C-8]
- acceptance: [AC-E15, AC-E16, AC-E17, AC-E18, AC-E19, AC-E20, AC-E21, AC-E22, AC-E56, AC-E57, AC-E58, AC-E59, AC-E60]
- milestone: M-2
- summary: Implement C-3, D-52, and the engine wrapping in the router by `TOOL_META.engine` kind.
  - Route the load paths (`lua_load_build`, `lua_reload_build`, `lua_new_build`, `import_build`) through
    `ctx.loadFile`/`loadXml`/`newBuild`.
  - **The load guard:** `ctx.client` rejects raw loads. `analyze_build`, `compare_builds`,
    `validate_build {build_name}` and `analyze_defenses {build_name}` therefore return `isError` until
    WU-13/WU-18 switch them to `withTemporaryBuild`. WU-08 adds allowlist entries for them owned by WU-13
    and WU-18 (D-45, D-51f).
  - Lifecycle rule L.
  - The test hooks.

### WU-22: Build-file writer, state dir, `lua_save_build`
- kind: build
- depends-on: [WU-08]
- role: backend-dev
- touches: [`src/services/buildFileWriter.ts` (new), `src/handlers/luaHandlers.ts` (`lua_save_build` only), `src/pobLuaBridge.ts` (remove `saveBuild`), `pob-api/API/Handlers.lua` + `BuildOps.lua` (remove `save_build`), `src/engine/schemas.ts` (remove `save_build`), `src/services/buildExportService.ts` (snapshot/export/backup roots → `stateDir`), `src/handlers/configHandlers.ts` (presets root only), `src/server/toolSchemas.ts` (`lua_save_build` `overwrite` + description), `tests/integration/contract.test.ts` (if present: drop the `save_build` case)]
- produces: [C-16, C-17]
- consumes: [C-3]
- acceptance: [AC-E46, AC-E47, AC-E55, AC-E61, AC-E62]
- milestone: M-2
- summary:
  - Implement C-17's writer.
  - `lua_save_build` = `export_build_xml` + the writer (`kind: 'engine'`), with `overwrite`, the guard,
    backups, `noteSaved` and Save-As re-pointing.
  - Delete the Lua `save_build` action (D-60).
  - Move every server-state root to C-16, so nothing the server writes lands in the user's builds
    folder.

  This unit is on the alpha path, so alpha runs safely against the real folder.

### WU-09: Contract schemas and shape fixes
- kind: build
- depends-on: [WU-08, WU-16]
- role: backend-dev + lua-dev
- touches: [`src/engine/schemas.ts`, `src/pobLuaBridge.ts` (typed wrappers), `src/handlers/luaHandlers.ts` (spec/item-set/save/info/stats renderers), `src/handlers/itemSkillHandlers.ts` (equipped items rendering), `pob-api/API/BuildOps.lua` (`export_stats` default list, `get_items` hidden slots, `get_build_info`/`_meta` tree version), `tests/integration/contract.test.ts` (new)]
- produces: [C-5 (complete)]
- consumes: [C-2, C-4, C-13]
- acceptance: [AC-E24, AC-E25, AC-E26, AC-E27, AC-E31]
- milestone: M-3
- summary:
  - Write a schema for every action, including the three trade actions.
  - Write the contract test.
  - Fix every recon §3 key and shape mismatch on the TS side: `pointsUsed`, `bytes`, `result.*`,
    `activeItemSet`, `_meta`.
  - Report the tree version from the active spec.
  - Widen the default stat export (E7, list in AC-E26).
  - Fix hidden-slot export (E8): call `itemsTab:UpdateSockets()`, then export `inactive` and `shown`
    booleans per slot. TS consumers drop slots that are `inactive` or `!shown`.
  - Remove the hygiene allowlist and cruft-waiver entries these fixes close.

### WU-10: Engine ops, tree and specs
- kind: build
- depends-on: [WU-09]
- role: backend-dev + lua-dev
- touches: [`pob-api/API/BuildOps.lua` (`set_tree`, `update_tree_delta`, `create_spec`, `get_tree`), `src/handlers/luaHandlers.ts` (tree/spec handlers; the `lua_set_tree` `masteryEffects` arg), `src/pobLuaBridge.ts` (`setTree` `masteryEffects` param), `src/handlers/treeHandlers.ts`, `src/handlers/exportHandlers.ts` (`export_build_summary` class names), `src/handlers/levelingHandlers.ts`]
- produces: []
- consumes: [C-3, C-4, C-5, C-6 (`construct`)]
- acceptance: [AC-E28, AC-E29, AC-E30, AC-E32, AC-E33, AC-E34]
- milestone: M-3
- summary:
  - E2: pass faithful weaponSets (`{[id]=node.allocMode}` for allocated nodes with `allocMode~=0`) and
    `copyTable(spec.hashOverrides, true)`.
  - Use engine class and ascendancy names everywhere (remove the PoE1 maps).
  - Drop the mastery line and the `masteryEffects` fields.
  - `get_passive_upgrades` uses the fixed `calc_with`, with real path costs.
  - Fix "Build: undefined".
  - `create_spec` uses `construct()`.
  - `plan_leveling` honours `class_name`.
  - Remove the closed allowlist and waiver entries.

### WU-11: Engine ops, items, gems, skills
- kind: build
- depends-on: [WU-09]
- role: backend-dev + lua-dev
- touches: [`pob-api/API/BuildOps.lua` (`add_item_text`, `add_gem`, `set_flask_active`, `get_items` active flag, `new_build`, `list_support_candidates`), `pob-api/API/Handlers.lua` (`new_build` params, `list_support_candidates`), `src/handlers/itemSkillHandlers.ts`, `src/handlers/poe2SkillHandlers.ts`, `src/services/poe2SkillService.ts`, `src/handlers/luaHandlers.ts` (`lua_new_build`, `lua_get_stats` rendering), `src/server/toolSchemas.ts` (slot enums, descriptions), `src/engine/schemas.ts`, `tests/integration/contract.test.ts` (new action's case)]
- produces: [Lua `list_support_candidates {groupIndex}` action (+ C-5 schema)]
- consumes: [C-3, C-4, C-5, C-6]
- acceptance: [AC-E35, AC-E36, AC-E37, AC-E38, AC-E39, AC-E40, AC-E41]
- milestone: M-3
- summary:
  - `add_item`/`add_multiple_items` use `construct()`.
  - `add_gem` rejects unknown names, with up to 5 suggestions by case-insensitive substring and prefix
    match over `data.gems` names.
  - Slot enums come from PoB's `baseSlots`, minus Arm/Leg. Flasks are Flask 1–2 and charms Charm 1–3.
  - `set_flask_active` covers flasks and charms, writing **both** `slot.active` and
    `activeItemSet[slot].active`, then calling `BuildOutput`. `get_items` reports `active` from
    `slot.active`.
  - `suggest_supports`/`analyze_skills` build the candidate pool with
    `calcLib.canGrantedEffectSupportActiveSkill`, through `list_support_candidates`. They measure the
    requested group and order by delta.
  - `lua_new_build` honours class and ascendancy.
  - `lua_get_stats` shows `EvadeChance` and `DeflectChance`.

### WU-12: Engine ops, config and presets
- kind: build
- depends-on: [WU-09, WU-22]
- role: backend-dev + lua-dev
- touches: [`pob-api/API/BuildOps.lua` (`get_config`, `set_config`), `src/handlers/configHandlers.ts`, `src/server/toolSchemas.ts` (config tool descriptions)]
- produces: []
- consumes: [C-3, C-4, C-5, C-16]
- acceptance: [AC-E42, AC-E43, AC-E44, AC-E45]
- milestone: M-3
- summary: Make the config tools PoE2-correct:
  - `get_config` lists PoB2's `ConfigOptions` keys with scalar values; no Bandit or Pantheon.
  - `set_config` returns the real previous value.
  - `set_enemy_stats` writes `input.enemyLevel` (and the other enemy fields) through `input`, and
    rebuilds.
  - Presets (stored in C-16 since WU-22) **apply** on load, via `set_config` per key.
  - Remove the closed allowlist and waiver entries.

### WU-13: Engine ops, build files, snapshots, import/export, watcher
- kind: build
- depends-on: [WU-10, WU-22]
- role: backend-dev
- touches: [`src/services/buildExportService.ts`, `src/services/buildService.ts` (parse cache), `src/handlers/luaHandlers.ts` (`import_build`), `src/handlers/exportHandlers.ts`, `src/handlers/buildHandlers.ts` (`analyze_build`, `compare_builds`, `list_builds`, `set_build_notes`), `src/utils/buildCode.ts`, `src/services/watchService.ts`, `src/handlers/watchHandlers.ts`, `src/server/toolSchemas.ts` (file-tool schemas and descriptions), `tests/watchService.test.ts`]
- produces: [C-20]
- consumes: [C-3, C-4, C-5, C-16, C-17]
- acceptance: [AC-E48, AC-E49, AC-E50, AC-E51, AC-E52, AC-E53, AC-E54, AC-E63, AC-E64]
- milestone: M-3
- summary:
  - Route the remaining build-file writes through C-17: `restore_snapshot` (bytes), `set_build_notes`
    (text), `import_build save_as` (engine content) and `export_build` into `POB_DIRECTORY`.
  - `export_build`: a byte copy when unchanged, otherwise via `withTemporaryBuild`. It writes a
    `<PathOfBuilding2>` root, and its output directory is confined (D-42).
  - `analyze_build` and `compare_builds` use `withTemporaryBuild`.
  - `import_build` accepts only a `PathOfBuilding2` root and caps inflation (`zlib` with
    `maxOutputLength: 16 MiB`; `ERR_BUFFER_TOO_LARGE` → "build code too large (inflates beyond 16 MiB)").
  - `list_builds` uses relative subfolder paths.
  - The build-parse cache follows D-58.
  - The watcher follows C-20.
  - Remove the closed allowlist entries.

## 5. Acceptance criteria

"Lua-direct" means the test spawns luajit with `bootstrap.lua` (with `POB_API_TEST_ACTIONS=1`) and speaks
C-2 through `tests/helpers/luaLineClient.ts`. "Engine-required" and "in-process" are as defined in the
spine (§12). A "Lua query" is a `__test_eval` call.

**Wire protocol, Lua side (WU-06)**

- **AC-E1 (WU-06).** Lua-direct. The first stdout line is the banner, with `ready:true`,
  `version.apiVersion:"2.0.0"` and `version.number:"0.23.1"`, and it has no `id`. For requests with ids
  7, 8 and 9 (`ping`, `version`, `ping`), the replies carry ids 7, 8 and 9 in order.
- **AC-E2 (WU-06).** Lua-direct.
  - `__test_cycle` with id 5 replies `{id:5, ok:false, code:"ENCODE"}`, and a following `ping` answers.
  - `nosuch` replies `code:"UNKNOWN_ACTION"`.
  - Without `POB_API_TEST_ACTIONS`, `__test_cycle` and `__test_eval` reply `UNKNOWN_ACTION`.
  - `__test_eval {code:"return 1+1"}` replies `result: 2`.
- **AC-E3 (WU-06, E1).** Lua-direct on the golden build.
  1. A Lua query picks the first unallocated node adjacent to an allocated non-ascendancy node.
  2. `calc_with {addNodes:[<that id>]}` replies `ok:true`, and `output` contains only number values for
     the default field list.
  3. A following `ping` answers.
- **AC-E4 (WU-06, X13).** Lua-direct on the golden build. `get_stats {fields:["ReqStrItem","Life"]}`
  replies `ok:true` with `stats.Life == 2977`, no `ReqStrItem` key, and `stats._meta.omitted` containing
  `"ReqStrItem"`. The engine stays alive.
- **AC-E5 (WU-06, E4/X3).** Lua-direct, three sequences:
  - valid golden → PoE1-root XML → valid golden (renamed `G2`) → valid golden (renamed `G3`);
  - the same with malformed XML;
  - the same with `""`.

  In every sequence:
  - each bad load replies `code:"LOAD_FAILED"`, and the error names the cause ("root element is
    PathOfBuilding, expected PathOfBuilding2" / "XML parse error" / "empty XML");
  - right after each bad load, `get_build_info.info.name` is still the previous build's name, because
    the build is untouched;
  - each following valid load replies `ok:true`, and `get_build_info.info.name` equals the new name;
  - `__test_state` reports `devAutoSaveDisabled:true` and `popups:0`.
- **AC-E6 (WU-06).** Lua-direct. A valid load whose post-check is forced to fail replies `LOAD_FAILED`,
  never `ok:true`. The test reaches the post-check through a test-only override,
  `params.__forcePostCheckFailure` honoured only under `POB_API_TEST_ACTIONS=1`.

**Bridge client, TS side (WU-07)**

- **AC-E7 (WU-07).** Unit (mock process).
  - After `start()` (whose readiness `ping` takes id 1), three `request()` calls produce ids 2, 3 and 4.
  - Replies delivered out of order (third, first, second) resolve the matching promises.
  - A reply with id 99 is dropped and logged (console.error spy), and nothing else resolves.
    (amended during build, D-63)
- **AC-E8 (WU-07, I-2a, NFR-1).** Engine-required, with a `spawn` spy.
  1. After `start()`, the first `ping` reply arrives ≤ 5 s after `start()` was called.
  2. `request('__test_sleep', {ms: 3000}, {timeoutMs: 500})` rejects with `EngineTimeoutError` 400–900 ms
     after the write. Within a further 1 s, `/proc/<old pid>` is absent or in state `Z`.
  3. The next `request('ping')` rejects with `EngineExitedError`, and the spawn count is unchanged.
  4. After `start()`, `ping` resolves with `pong:true` and never receives the late sleep reply.
- **AC-E9 (WU-07).** Unit (mock process, fake timers). With `timeoutMs: 1000`, a reply that arrives at
  900 ms after 5 non-JSON noise lines (at 200 ms each) resolves. A reply at 1100 ms rejects, because the
  timer runs from the write, not per line.
- **AC-E10 (WU-07).** Unit.
  - Three concurrent `start()` calls on a cold client call the `spawn` mock exactly once, and all three
    resolve.
  - After a rejected start (the mock emits `ENOENT`), a later `start()` spawns again.
- **AC-E11 (WU-07).** Unit. With `env.POESESSID="S1"` and `env.POE_SESSION_ID="S2"` passed in the client's
  `env`, the env given to `spawn` contains neither key. `LUA_PATH` and `LUA_CPATH` are present.
- **AC-E12 (WU-07).** Unit and engine-required.
  - The `spawn` mock emits `error` with `code:"ENOENT"` → `start()` rejects with a message containing
    "luajit not found" and "mise".
  - A real luajit run with `env.POB_ARGS` pointing at a script that writes to stderr and exits 2 → the
    rejection message contains `code 2` and that stderr text.
- **AC-E13 (WU-07).** Unit. With a test schema registered for `ping` that requires `pong: z.literal(true)`:
  - a reply `{id, ok:true, pong:false}` rejects with `EngineContractError`, naming `ping` and the issue
    path `pong`, and `isAlive()` stays true;
  - an action with no schema passes through.
- **AC-E14 (WU-07).** Unit (mock banner).
  - `apiVersion:"1.0.0"` → `start()` rejects ("bridge protocol mismatch").
  - `number:"0.23.2"` → it rejects with the pin hint.
  - The same with `POB_ALLOW_UNPINNED=true` → it resolves with a warning logged.
- **AC-E23 (WU-07, D-29).** Unit (mock). During `start()` the client sends `ping` and nothing else; no
  `load_build_xml` is sent.

**Engine session (WU-08)**

- **AC-E15 (WU-08, I-2b).** In-process, engine-required. Load the golden build, then concurrently
  (`Promise.all`) call:
  - `set_character_level {level: 91}`;
  - `lua_get_build_info`;
  - `get_skill_setup`;
  - `lua_get_stats`.

  All four succeed. Using `session.onEvent`, the `start`/`end` events show no overlap between calls. The
  level `lua_get_build_info` reports is 91 if its `start` came after `set_character_level`'s `end`, and
  90 otherwise.
- **AC-E16 (WU-08).** In-process, engine-required. This verifies the C-8 kinds. For every `expect:"ok"`
  sample in `tool-calls.json` whose tool has no allowlist entry for check (ii):
  1. Compute a **canonical export** (`export_build_xml` with every `<PlayerStat>`, `<MinionStat>` and
     `<FullDPSSkill>` element removed) before and after the sample, in the same engine process.
     - **Across a reload.** A sample whose tool reloads the working build through `withTemporaryBuild`
       (D-9: `analyze_build`, `compare_builds`, `export_build` with `notes`) compares both exports
       **across-reload canonical** instead, because the pinned PoB2 re-serializes `pairs()`-ordered
       tables after the reload (`PassiveSpec.lua:226-311`). On top of the canonical export: every tag's
       attributes are sorted by name; the node-id sets (`nodes` on `<Spec>` and `<WeaponSetN>`,
       `strNodes`/`dexNodes`/`intNodes` on `<AttributeOverride>`) are sorted numerically;
       `masteryEffects` entries are sorted; the `<URL>` body is dropped; and each run of consecutive
       `<Input>`/`<Placeholder>`, `<Socket>` and `<WeaponSetN>` elements is sorted. Everything else is
       compared as exported.
     - Every other sample keeps the strict comparison.
  2. Check the export against the kind: `read` ⇒ identical; `mutate`/`load` ⇒ different. Samples use
     state-changing args, or declare `stateChange:false` with a reason.
  3. Check the revision: `revision` grows by exactly 1 for `mutate`/`load`, and by 0 for `read` (no file
     change happened during the test).
  4. A failing `mutate` sample (`set_gem_level` with a bad index) leaves `revision` unchanged.
  (amended during build, D-62)
- **AC-E17 (WU-08, I-2c).** In-process, engine-required, test actions on.
  1. Load the golden build, then `set_character_level {level: 50}`.
  2. `process.kill(session.enginePid())`.
  3. Call `lua_get_build_info`.

  The result has no `isError`, starts with the notice
  `Engine restarted; restored the build to its state after \`set_character_level\`.`,
  and reports level 50.
- **AC-E18 (WU-08).** Engine-required, through `session.run` directly (no test tool is exposed over MCP).
  1. Load the golden build and mutate it once.
  2. Start `session.run({tool:"probe", kind:"mutate"}, ctx => ctx.client.request("__test_sleep", {ms: 5000}))`.
  3. Kill `session.enginePid()` during the sleep.

  The run rejects with an error containing "engine stopped while running \`probe\`", and `revision` is
  unchanged. The next `session.run` notice includes `The interrupted call \`probe\` was not applied.`, and
  the state is the post-mutation one.
- **AC-E19 (WU-08).** Unit with a fake client.
  - While call A (`kind: 'read'`, holding the lock for 300 ms) runs, call B (`mutate`) issued at
    t = 10 ms starts only after A completes (an ordering log).
  - A call whose `signal` aborts while it waits for the lock rejects with `AbortError` and never runs.
  - A call whose `deadline` passes while it waits rejects with `EngineBusyError`.
- **AC-E20 (WU-08, D-14).** In-process with a `spawn` spy.
  - `get_leagues` (fixture fetch) and `list_builds` cause 0 spawns.
  - The first `lua_get_build_info` causes exactly 1 spawn.
  - Calling `getLuaClient()` outside `session.run` throws "engine access outside a session".
- **AC-E21 (WU-08, D-19).** In-process, engine-required, using the temp `POB_DIRECTORY`.
  - **Clean engine, file changed:** load `grenadator.xml`, then rewrite the file on disk with a changed
    `level` attribute (simulating a PoB2 save). The next `lua_get_build_info` output starts with
    `Reloaded grenadator.xml: it changed on disk since the engine loaded it.` and shows the new level.
    `revision` increased by 1.
  - **Dirty engine, file changed:** after a mutating call, change the file again. The next engine call
    doesn't reload. Its output starts with the "changed on disk … unsaved changes from
    \`set_character_level\`" warning, and its level is the engine's own.
  - **Unloadable change:** with a clean engine, write truncated XML to the file. The next engine call
    returns `isError` "could not be loaded (it may be mid-save in PoB2)". The call after that, once the
    file is restored, reloads it.
  - **File deleted:** the warning `no longer exists on disk` appears.
- **AC-E22 (WU-08, NFR-6).** In-process, engine-required.
  - `lua_get_build_info`, `lua_load_build` and `lua_save_build` outputs contain
    `Build: <loaded.displayName>`, plus the relative path when it has one.
  - Measured with `onEvent` timestamps around the snapshot phase, the snapshot after
    `set_character_level` on the golden build takes ≤ 100 ms (median of 5).
- **AC-E56 (WU-08, the load guard).** In-process, engine-required.
  - `session.run(..., ctx => ctx.client.request("load_build_xml", …))` rejects with "engine load
    outside the session".
  - With `grenadator.xml` loaded and a second fixture build present, `compare_builds` returns `isError`
    until WU-13; from WU-13 on it succeeds through `withTemporaryBuild`. Either way, the canonical export
    (compared across the reload, AC-E16), `loaded` and `revision` are all unchanged afterwards.
    (amended during build, D-62)
- **AC-E57 (WU-08, auto-reload bookkeeping).** In-process, engine-required.
  - **(a) Read call.** Load the build, change the file on disk (engine clean), and call `lua_get_stats`
    (`read`). `revision` +1. Then `process.kill(session.enginePid())` and call `lua_get_build_info`: the
    restored state is the **reloaded** file's.
  - **(b) Mutate call.** Load the build and change the file on disk. Then `set_character_level {level:
    70}`: it reloads first, then mutates, and `isDirty() === true` afterwards.
- **AC-E58 (WU-08, D-8).** Engine-required, through the session.
  1. Load the golden build.
  2. Make the next snapshot export fail (a `__test_eval` that breaks `build.SaveDB` for one call).
  3. Mutate the build.
  4. Kill the engine.

  `lua_get_build_info` (`read`) then returns `isError` `Engine restarted; the loaded build could not be
  restored. Load it again.` A following `lua_load_build` succeeds and reports the golden level.
- **AC-E59 (WU-08, rule L).** In-process, engine-required.
  - Load the build and mutate it. `lua_stop`'s output contains `Discarded unsaved changes from
    \`set_character_level\``. The next `lua_get_build_info` reports `Build: New build`, with no restore
    notice.
  - `lua_new_build` sets `loaded.displayName` to `New build` and `loaded.path` to null.
  - While an engine runs, `session.loaded` is never null.
- **AC-E60 (WU-08, D-52).** Unit, with an injected case-insensitive fs (`readdir`/`stat` fakes).
  - `canonicalBuildPath("grenadator", base)` returns `Grenadator.xml` when that is the on-disk name.
  - `sub/X.xml` resolves both segments.
  - A new name keeps the caller's spelling.
  - Two case-insensitive matches with no exact match → "ambiguous build name".

  Engine-required: after `lua_load_build {build_name:"GRENADATOR"}` on a case-insensitive fake,
  `session.loaded.path` is the canonical `Grenadator.xml`.

**Build-file writer, state dir, `lua_save_build` (WU-22)**

- **AC-E46 (WU-22, C-17).** In-process, engine-required, temp `POB_DIRECTORY`.
  - **(a)** `lua_save_build {build_name:"new1"}` writes `new1.xml`, whose root is `<PathOfBuilding2>`.
    The message has a byte count.
  - **(b)** Repeating it without `overwrite` → `isError` "already exists … overwrite: true".
  - **(c)** With `overwrite:true` → it succeeds, and `<stateDir>/backups/new1.xml/` holds the previous
    bytes. The message contains "re-open it there".
  - **(d)** Load `grenadator.xml`, mutate, then modify `grenadator.xml` on disk. `lua_save_build
    {build_name:"grenadator", overwrite:true}` → `isError` "changed on disk since", and the file keeps the
    on-disk modification.
  - **(e)** Save as `new2` → `loaded.path` becomes `new2.xml` and `isDirty()` is false.
  - **(f)** No `*.pob2mcp-tmp` file remains in the folder.
- **AC-E47 (WU-22).** `save_tree` isn't listed (WU-04). `lua_save_build`'s description says it saves the
  engine's current build, including tree changes, and documents `overwrite`.
- **AC-E55 (WU-22, D-18).** In-process.
  - After `snapshot_build`, `export_build` (default directory) and `save_config_preset {name:"p1"}`,
    `find $POB_DIRECTORY -name '.pob-mcp*'` is empty.
  - The artifacts exist under `<XDG_STATE_HOME>/pob2-mcp/{snapshots,exports,presets}/`.
- **AC-E61 (WU-22, D-52 + C-17 failures).** Unit with an injected case-insensitive fs:
  1. the on-disk file is `Grenadator.xml`;
  2. the engine loaded it as `grenadator`;
  3. the file changes on disk;
  4. a save to `GRENADATOR` with `overwrite:true` is refused with "changed on disk since".

  Unit with an injected failing fs:
  - a backup failure → `isError` naming the OS error, with the target unchanged;
  - a rename failure → `isError` naming the target and backup paths, with no temp file left and no
    fingerprint recorded;
  - a missing parent folder → created.
- **AC-E62 (WU-22, D-60).**
  - `rg -n "save_build\b" pob-api/` and `rg -n "saveBuild\b" src/` find nothing, and `replySchemas` has
    no `save_build`.
  - In-process: after `lua_save_build` to the loaded path, `isDirty()` is false and the next engine call
    shows no disk-change warning.

**Contract schemas (WU-09)**

- **AC-E24 (WU-09, I-3).** Engine-required: `tests/integration/contract.test.ts`.
  - **Coverage:** for every non-test action name parsed from `Handlers.lua` and `Trade.lua`, the test
    has a case.
  - **Each case** loads the golden build, establishes its precondition (e.g. creates a second spec
    before `delete_spec`, or a socket group before `add_gem`), calls the action, and asserts
    `replySchemas[action].safeParse(reply).success`.
  - **Static check:** the set of non-test Lua actions equals `Object.keys(replySchemas)`.
  - Units that later add actions (WU-11, WU-18) add their cases.
- **AC-E25 (WU-09).** In-process, engine-required. On the golden build:
  - `list_specs` shows a numeric points count per spec, with no `undefined`;
  - `create_spec`, `rename_spec` and `delete_spec` report success when they succeed;
  - `list_item_sets` shows each set's title and marks the active one;
  - `lua_save_build` reports `(<n> bytes)` with n > 0;
  - `lua_get_stats` shows no `_meta: [object Object]`, and its tree version equals the active spec's
    `treeVersion`.
- **AC-E26 (WU-09, E7).** Engine-required. `get_stats` with no `fields` on the golden build returns
  numeric values for:
  - the existing 18 defaults;
  - `TotalEHP` (= 11833.37 ± 0.01), `PhysicalDamageReduction`, `LifeUnreserved`, `ManaUnreserved`,
    `SpiritUnreserved`;
  - `EvadeChance`, `DeflectChance`, `EffectiveBlockChance`, `EnergyShieldRecharge`;
  - `Missing{Fire,Cold,Lightning,Chaos}Resist`, `{Physical,Fire,Cold,Lightning,Chaos}MaximumHitTaken`,
    `{Physical,Fire,Cold,Lightning,Chaos}EnemyDamage`, `totalEnemyDamage`;
  - `Str`, `Dex`, `Int`.
- **AC-E27 (WU-09, E8/X11).** Engine-required, on the golden build.
  - Every `get_items` entry has boolean `inactive` and `shown`.
  - Among entries with `!inactive && shown`, each gear jewel-socket index is ≤ its parent item's
    `jewelSocketCount`, and each tree socket `Jewel <id>` is allocated in the active spec. The test
    cross-checks this with a Lua query.
  - `get_equipped_items` doesn't list hidden slots, and its output no longer contains "89".
- **AC-E31 (WU-09).** Engine-required. `lua_get_build_info`'s tree version equals `get_tree`'s
  `treeVersion` (the spec's), not `"0_1"`.

**Engine ops: tree and specs (WU-10)**

- **AC-E28 (WU-10, I-1c).** Engine-required. On the golden build, `update_tree_delta {addNodes:[],
  removeNodes:[]}` leaves Str/Dex/Int = 119/91/64, Life = 2977 and CombinedDPS = 104489.78 (±0.01).
- **AC-E29 (WU-10).** Engine-required. Feeding `lua_get_tree`'s nodes back through `lua_set_tree` leaves
  all 109 `PlayerStat` pairs (after save) unchanged. The exported XML's `<AttributeOverride>` element and
  the `WeaponSet` node lists are equal, as sets, to the originals.
- **AC-E30 (WU-10).** In-process, engine-required.
  - `lua_get_tree`, `lua_get_build_info` and `export_build_summary` on the golden build show class
    `Mercenary` and ascendancy `Gemling Legionnaire`.
  - None of them contains `Unknown (ID`.
  - `lua_get_tree` has no mastery line.
  - `rg -n "masteryEffects" src/ pob-api/` finds only the documented `ImportFromNodeList` positional
    argument in `BuildOps.lua`.
- **AC-E32 (WU-10).** In-process, engine-required. `get_passive_upgrades` on the golden build returns ≥ 1
  suggestion with an integer path cost ≥ 1 and a non-zero delta for the requested stat. The engine is
  still alive afterwards (`ping`).
- **AC-E33 (WU-10).** In-process. `get_nearby_nodes` and `find_path_to_node` outputs don't contain
  `Build: undefined`.
- **AC-E34 (WU-10).**
  - Engine-required: `create_spec {title:"t"}` succeeds on the tag, and `list_specs` shows 2 specs.
  - In-process: `plan_leveling {class_name: "Monk"}` output names `Monk`, not `Mercenary`.

**Engine ops: items, gems, skills (WU-11)**

- **AC-E35 (WU-11).** In-process, engine-required.
  - `add_item` with the rare ring text in `tests/fixtures/items/ruby-ring.txt` into `Ring 1` changes at
    least one stat in `lua_get_stats`.
  - `add_multiple_items` with two items reports both added.
- **AC-E36 (WU-11).** In-process, engine-required.
  - `add_gem {group_index: 1, gem_name: "Brutality"}` returns `isError`, and the text lists ≥ 1
    suggestion that starts with `Brutality`.
  - A known gem name is added (`get_skill_setup` shows it).
- **AC-E37 (WU-11, X12).** In-process, engine-required.
  - The `toggle_flask` schema's slot enum is exactly `Flask 1, Flask 2, Charm 1, Charm 2, Charm 3`.
  - On the golden build (all charms load inactive), toggling `Charm 1` **on** makes `get_items` report
    `Charm 1` `active:true` (read from `slot.active`), and the export's ItemSet Slot for `Charm 1` has
    `active="true"`.
  - Toggling it off reverts both.
- **AC-E38 (WU-11).** Static and in-process. The `create_socket_group` and `setup_skill_with_gems` slot
  enums equal PoB `baseSlots` minus `Arm 1/2` and `Leg 1/2`, plus the `Weapon 1 Swap`/`Weapon 2 Swap`
  slots. No PoE1 slot names appear.
- **AC-E39 (WU-11).** Engine-required. For the golden build's main socket group:
  - **`suggest_supports`:**
    - (i) has a candidate pool exactly equal to the set from `list_support_candidates {groupIndex}`,
      cross-checked against `calcLib.canGrantedEffectSupportActiveSkill` by a Lua query;
    - (ii) orders its results by measured delta descending, with ties broken by name;
    - (iii) measures on the requested group: the test supplies a group index ≠ the main group and checks
      the delta is computed on that group (a Lua query of the measured group's index during the call).
  - **`analyze_skills`** lists, for that group, the same candidate set as (i).
- **AC-E40 (WU-11).** In-process, engine-required. `lua_new_build {class_name:"Monk",
  ascendancy:"Invoker"}` → `lua_get_build_info` shows `Monk` / `Invoker`.
- **AC-E41 (WU-11).** In-process, engine-required. `lua_get_stats` shows `EvadeChance` and
  `DeflectChance` lines. `rg -n "EvasionChance" src/` finds nothing.

**Engine ops: config and presets (WU-12)**

- **AC-E42 (WU-12).** In-process, engine-required. `get_config` on the golden build contains no
  `Bandit`, `Pantheon` or `[object Object]`, and every listed value is a scalar.
- **AC-E43 (WU-12).** In-process, engine-required. `set_config {config_name, value}` on a boolean option
  reports the actual previous value, which `get_config` showed before the call.
- **AC-E44 (WU-12).** In-process, engine-required. `set_enemy_stats {level: 85}` → `get_config` shows
  enemy level 85, and a Lua query confirms `build.configTab.input.enemyLevel == 85`.
- **AC-E45 (WU-12).** In-process, engine-required.
  - `save_config_preset {name:"p1"}` creates `<XDG_STATE_HOME>/pob2-mcp/presets/p1.json`.
  - After changing a value, `load_config_preset {name:"p1"}` restores it (`get_config` shows the saved
    value).
  - `list_config_presets` lists `p1`.

**Engine ops: build files, snapshots, import/export, watcher (WU-13)**

- **AC-E48 (WU-13, I-1d).** In-process, engine-required.
  - `export_build {build_name:"grenadator.xml", output_name:"e1"}`, with no notes, writes
    `<stateDir>/exports/e1.xml` whose sha1 equals the source's. The engine's `revision`, `loaded` and
    canonical export are unchanged.
  - With `notes:"x"`, the output's root is `<PathOfBuilding2>` and its notes are `x`. Loading it yields
    the same class, level and the 109 `PlayerStat` values. The engine state is unchanged afterwards
    (`revision`, `loaded`, and the canonical export compared across the reload, AC-E16).
    (amended during build, D-62)
- **AC-E49 (WU-13, D-42).** In-process. `export_build {output_directory:"/tmp/elsewhere"}` → `isError`.
  An `output_directory` inside `POB_DIRECTORY` succeeds.
- **AC-E50 (WU-13, C-16/C-17).** In-process.
  - `snapshot_build`, then `list_snapshots`, then `restore_snapshot` on `grenadator.xml` works.
  - All artifacts are under `<stateDir>/snapshots/` and `<stateDir>/backups/` (the latter as
    `<id>_before-restore.xml`).
  - After a restore over the loaded file with a clean engine, the next engine call starts with
    `Reloaded grenadator.xml`.
- **AC-E51 (WU-13, D-9).** In-process, engine-required, with a second fixture build in the temp folder (a
  copy of `grenadator.xml` with level 80).
  - With `grenadator.xml` loaded, `analyze_build {build_name:"other.xml"}` and `compare_builds` with it
    leave `revision`, `loaded` and the canonical export (compared across the reload, AC-E16) identical
    to before.
  - `compare_builds` reports both builds' levels (90 vs 80). (amended during build, D-62)
- **AC-E52 (WU-13).** In-process.
  - `import_build` with a code whose XML root is `<PathOfBuilding>` → `isError` naming `PathOfBuilding2`.
  - A code that inflates beyond 16 MiB (synthetic: 20 MiB of zeros, deflated) → `isError` "build code
    too large".
  - A spy on the zlib call confirms `maxOutputLength: 16777216`.
- **AC-E53 (WU-13).** In-process. `list_builds` lists `sub/inner.xml` from a subfolder of the temp folder.
- **AC-E54 (WU-13, C-20).** Unit.
  - `watchService` passes `usePolling: true, interval: 1000` when the path starts with `/mnt/`, and no
    polling otherwise (chokidar spy).
  - A change event for `sub/inner.xml` invalidates the cache key `sub/inner.xml`, not `inner.xml`.
  - `~~temp~~.xml` is ignored.
  - The watch tools' descriptions don't claim they reload the engine.
- **AC-E63 (WU-13, C-17 step 6).** In-process, engine-required.
  - **(a) Notes edit, clean engine.** Load `grenadator.xml`, then `set_build_notes` on it. The next
    `lua_get_build_info` starts with `Reloaded grenadator.xml`.
  - **(b) Restore then save.** Load, mutate, `restore_snapshot` on the same file. Then
    `lua_save_build {build_name:"grenadator", overwrite:true}` returns `isError` "changed on disk since",
    and the restored bytes are intact.
- **AC-E64 (WU-13, D-58).** In-process.
  - Call `get_build_notes`, rewrite the notes on disk, and call `get_build_notes` again within 60 s: the
    second call shows the new notes.
  - After `lua_save_build` to a file, `get_build_stats` on it reflects the saved content.

## 6. Test strategy (this slice)

| AC | Class |
|---|---|
| AC-E1…E6 | Lua-direct, engine-required |
| AC-E7, E9, E10, E11, E13, E14, E19, E23, E54, E60 (unit part), E61 | unit (fakes as each AC names) |
| AC-E8, E12 (real part), E18, E24, E26…E29, E31, E39, E58 | engine-required |
| AC-E15…E17, E20…E22, E25, E30, E32…E38, E40…E53, E55…E57, E59, E60 (engine part), E62…E64 | in-process (+ engine-required where stated) |

**Regression guard.** The WU-05 golden tests (AC-F23/F24) and the hygiene test (AC-F26) run in every
unit's gate. Allowlist and waiver changes follow D-45.

## 7. Migration notes (this slice)

- **Bridge protocol v1 → v2:** the Lua side lands in WU-06, together with the TS readiness probe; WU-07
  then requires `apiVersion` 2.
- **`POB_TIMEOUT_MS`** is now per request, measured from the write.
- **Server state moves to C-16 in WU-22.** Old `<POB_DIRECTORY>/.pob-mcp*` locations are ignored. The
  README says so.
- **`lua_save_build` refuses silent overwrites.** Callers pass `overwrite: true`. The Lua `save_build`
  action is gone.
