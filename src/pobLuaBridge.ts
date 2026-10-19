/**
 * Bridge client (C-4): the TypeScript side of the engine wire protocol v2 (C-2).
 *
 * - Only `start()` spawns the engine (D-59). It is single-flight while starting, and a rejected start
 *   clears the slot so a later `start()` spawns again. It runs the pin check (C-6), waits ≤ 15 s for the
 *   banner, checks the banner's `apiVersion` and PoB version, then sends `ping` (D-29: no XML is loaded).
 * - `request()` is id-matched. Its timer starts when the line is written to stdin; a timeout SIGKILLs
 *   the engine and fails every other pending request. A request on a dead client rejects with
 *   `EngineExitedError` and never spawns.
 * - Every `ok:true` reply is validated against `replySchemas[action]` (C-5); a contract failure rejects
 *   with `EngineContractError` and keeps the engine alive. `__test_*` replies pass through.
 * - The child env is `opts.env` minus the cookie variables (D-28), plus LUA_PATH/LUA_CPATH.
 */
import type { ChildProcessWithoutNullStreams, spawn as nodeSpawn } from "child_process";
import path from "path";
import os from "os";
import type { ZodIssue } from "zod";
import { checkPin, PIN_HINT, type PobPin } from "./engine/pinCheck.js";
import {
  replySchemas,
  type ActionName,
  type ActionParams,
  type ActionReply,
  type TestActionName,
  type TestReply,
  type TradeEvaluateItemsParams,
  type TradeEvaluateItemsResult,
  type TradeGenerateQueryParams,
  type TradeGenerateQueryResult,
  type TradeQueryOptionsResult,
  type BuildInfoResult,
  type RuleBreaksResult,
  type ConfigResult,
  type CreateSpecResult,
  type DeleteSpecResult,
  type ItemSlot,
  type ListItemSetsResult,
  type ListSpecsResult,
  type ManageSetsResult,
  type CompileCheckResult,
  type CompileStageResult,
  type CompileFinishResult,
  type RenameSpecResult,
  type SelectItemSetResult,
  type SelectSpecResult,
  type SelectedMinionSkill,
  type SelectedStatSet,
  type SkillsResult,
  type StatsBreakdown,
  type StatsResult,
  type TreeResult,
  type UpdateTreeDeltaResult,
  type Loose,
} from "./engine/schemas.js";

/** The pin the client checks the checkout and the banner against (`pob-pin.json`, C-6). */
export type Pin = PobPin;

export interface PoBLuaApiOptions {
  /**
   * The server's env (deps.env, C-7): POB_CMD, POB_ARGS, POB_TIMEOUT_MS, POB_ALLOW_UNPINNED, POB_DEBUG,
   * and the child's base environment (minus the cookie variables, D-28).
   */
  env: Readonly<Record<string, string | undefined>>;
  /** The process factory (deps.spawn, C-7). */
  spawn: typeof nodeSpawn;
  /** The PoB checkout's `src/` directory (`resolvePobSrc`, C-6): the engine's cwd. */
  pobSrc: string;
  /** The vendored bridge directory (`resolvePobApiDir`, C-6). */
  pobApiDir: string;
  pin: Pin;
}

export interface RequestOptions {
  /** Overrides the default timeout (POB_TIMEOUT_MS, or 60 s for `trade_generate_query`, D-47). */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Cookie variables never passed to the engine child (D-28). */
const COOKIE_VARS = ["POESESSID", "POE_SESSION_ID"];
/** D-50 tuning constants. */
const BANNER_TIMEOUT_MS = 15_000;
const STDERR_RING_LINES = 50;
const STDERR_SHOWN_LINES = 20;
const QUIT_GRACE_MS = 2000;
/** D-47 request timeouts. */
const DEFAULT_TIMEOUT_MS = 30_000;
const LONG_ACTION_TIMEOUTS: Readonly<Record<string, number>> = { trade_generate_query: 60_000 };
/** After `exit`, how long to wait for `close` (stdio drained) before failing pending requests anyway. */
const EXIT_SETTLE_MS = 250;

// ---------------------------------------------------------------------------------------------------
// Errors

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** `start()` failed: spawn error, exit before the banner, no banner, bad banner. */
export class EngineStartError extends EngineError {}

/** The checkout or the engine's banner doesn't match the pin (C-6). */
export class EnginePinError extends EngineError {
  constructor(
    readonly reason: string,
    readonly hint: string,
  ) {
    super(`The PoB checkout does not match the pin (pob-pin.json): ${reason}. To fix, ${hint}.`);
  }
}

/** A request outlived its timeout; the engine was killed (C-4). */
export class EngineTimeoutError extends EngineError {
  constructor(
    readonly action: string,
    readonly ms: number,
  ) {
    super(`engine request "${action}" timed out after ${ms} ms; the engine was stopped`);
  }
}

/** The engine is not running: it exited, was killed, or was never started (C-4, D-59). */
export class EngineExitedError extends EngineError {
  constructor(
    readonly code: number | null,
    readonly signal: string | null,
    readonly lastStderr: readonly string[],
    detail?: string,
  ) {
    const head = detail ?? `engine exited (code ${code}, signal ${signal})`;
    const tail = lastStderr.length > 0 ? `: ${lastStderr.slice(-STDERR_SHOWN_LINES).join("\n")}` : "";
    super(`${head}${tail}`);
  }
}

/** An `ok:true` reply failed its C-5 schema. The engine stays alive. */
export class EngineContractError extends EngineError {
  constructor(
    readonly action: string,
    readonly issues: readonly ZodIssue[],
  ) {
    const described = issues
      .map((i) => `${i.path.length > 0 ? i.path.join(".") : "(root)"}: ${i.message}`)
      .join("; ");
    super(`engine reply for "${action}" does not match its contract (C-5): ${described}`);
  }
}

/** The engine replied `ok:false` (C-2). The message is the engine's error text. */
export class EngineActionError extends EngineError {
  constructor(
    readonly action: string,
    readonly code: string,
    readonly error: string,
  ) {
    super(error);
  }
}

// ---------------------------------------------------------------------------------------------------
// Per-process state

interface Pending {
  action: string;
  timeoutMs: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
}

type JsonObject = Record<string, unknown>;

/** One spawned engine process. A new one per `start()`, so a dead process's events can't leak. */
interface Conn {
  proc: ChildProcessWithoutNullStreams;
  pid: number | null;
  nextId: number;
  pending: Map<number, Pending>;
  stdoutBuf: string;
  stderrPartial: string;
  stderrRing: string[];
  /** Set once start() has seen the banner and the `ping` reply. */
  ready: boolean;
  /** Exited, killed, errored or stopped: no request may be written. */
  dead: boolean;
  /** Gone for good: every pending request has been failed and `exited` resolved. */
  gone: boolean;
  exitInfo: { code: number | null; signal: string | null } | null;
  spawnError: NodeJS.ErrnoException | null;
  quitId: number | null;
  exited: Promise<void>;
  resolveExited: () => void;
  onBanner: ((banner: JsonObject) => void) | null;
  onGone: (() => void) | null;
}

function isTestAction(action: string): boolean {
  return action.startsWith("__test_");
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error("engine request aborted");
  error.name = "AbortError";
  return error;
}

export class PoBLuaApiClient {
  private readonly env: Readonly<Record<string, string | undefined>>;
  private readonly spawnFn: typeof nodeSpawn;
  private readonly pobSrc: string;
  private readonly pobApiDir: string;
  private readonly pin: Pin;

  private conn: Conn | null = null;
  private starting: Promise<void> | null = null;
  /** Bumped by stop(), so a start that is still checking the pin doesn't spawn afterwards. */
  private generation = 0;

  constructor(opts: PoBLuaApiOptions) {
    this.env = opts.env;
    this.spawnFn = opts.spawn;
    this.pobSrc = opts.pobSrc;
    this.pobApiDir = opts.pobApiDir;
    this.pin = opts.pin;
  }

  /** True while an engine is running and ready for requests. */
  isAlive(): boolean {
    return this.conn !== null && this.conn.ready && !this.conn.dead;
  }

  /** The running engine's process id, or null when none runs (a test hook for the session, C-3). */
  pid(): number | null {
    return this.conn !== null && !this.conn.dead ? this.conn.pid : null;
  }

  // -------------------------------------------------------------------------------------------------
  // start

  /** Spawn and check the engine. Single-flight while starting; a rejected start clears the slot. */
  start(): Promise<void> {
    if (this.starting) return this.starting;
    if (this.isAlive()) return Promise.resolve();
    const attempt = this.doStart();
    this.starting = attempt;
    const clear = () => {
      if (this.starting === attempt) this.starting = null;
    };
    attempt.then(clear, clear);
    return attempt;
  }

  private async doStart(): Promise<void> {
    const generation = this.generation;
    const allowUnpinned = this.env.POB_ALLOW_UNPINNED === "true";

    // 1. Refuse an unpinned checkout before spawning anything (C-6).
    const pinResult = await checkPin({ pobSrc: this.pobSrc, pin: this.pin, allowUnpinned });
    if (!pinResult.ok) throw new EnginePinError(pinResult.reason, pinResult.hint);
    for (const warning of pinResult.warnings) {
      console.error(`[PoB API] POB_ALLOW_UNPINNED=true, continuing despite: ${warning}`);
    }
    if (generation !== this.generation) throw new EngineStartError("engine start cancelled by stop()");

    // A previous process that is still around (it can't take requests any more) goes first.
    if (this.conn && !this.conn.gone) this.kill(this.conn, "the engine was replaced by a new start()");

    const conn = this.spawnConn();
    this.conn = conn;
    try {
      // 2. The banner (≤ 15 s), its protocol version and its PoB version.
      const banner = await this.waitForBanner(conn);
      this.checkBanner(banner, allowUnpinned);
      // 3. Readiness: one ping (D-29). No XML is loaded.
      await this.send(conn, "ping", {}, {});
      if (conn.dead) throw new EngineExitedError(null, null, [], "the engine stopped during startup");
      conn.ready = true;
    } catch (error) {
      if (error instanceof EngineExitedError && conn.exitInfo !== null) {
        // It died on its own during the ping: report it like an exit before the banner.
        await Promise.race([conn.exited, new Promise((resolve) => setTimeout(resolve, EXIT_SETTLE_MS))]);
        throw this.startExitError(conn);
      }
      // Never leave a half-started engine behind.
      if (!conn.gone) this.kill(conn, "engine start failed");
      throw error;
    }
  }

  private childEnv(): Record<string, string> {
    const pobSrc = this.pobSrc;
    // The checkout root holds runtime/ (Lua modules and native libraries) next to src/.
    const baseDir = pobSrc.endsWith(path.sep + "src") || pobSrc.endsWith("/src") ? pobSrc.slice(0, -4) : pobSrc;
    const runtimeDir = path.join(baseDir, "runtime");
    const runtimeLuaPath = path.join(runtimeDir, "lua");
    const luaRocksPath = path.join(os.homedir(), ".luarocks", "lib", "lua", "5.1");
    const luaExt = process.platform === "win32" ? "dll" : "so";
    // Lua's package.path/cpath entries are ';'-separated on every OS (not the OS PATH separator); a
    // trailing ';;' appends Lua's default search path.
    const sep = ";";
    const api = this.pobApiDir;

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.env)) {
      if (value !== undefined && !COOKIE_VARS.includes(key)) env[key] = value;
    }
    // bootstrap.lua starts the server itself; POB_API_STDIO is deliberately not set.
    env.LUA_PATH =
      `${api}${path.sep}?.lua${sep}${api}${path.sep}?${path.sep}init.lua${sep}` +
      `${runtimeLuaPath}${path.sep}?.lua${sep}${runtimeLuaPath}${path.sep}?${path.sep}init.lua${sep}${sep}`;
    env.LUA_CPATH = `${runtimeDir}${path.sep}?.${luaExt}${sep}${luaRocksPath}${path.sep}?.${luaExt}${sep}${sep}`;
    return env;
  }

  private command(): { cmd: string; args: string[] } {
    const cmd = this.env.POB_CMD || "luajit";
    const args = this.env.POB_ARGS ? [this.env.POB_ARGS] : [path.join(this.pobApiDir, "bootstrap.lua")];
    return { cmd, args };
  }

  private spawnConn(): Conn {
    const { cmd, args } = this.command();
    let proc: ChildProcessWithoutNullStreams;
    try {
      proc = this.spawnFn(cmd, args, {
        cwd: this.pobSrc,
        env: this.childEnv(),
        stdio: ["pipe", "pipe", "pipe"],
      }) as ChildProcessWithoutNullStreams;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === "ENOENT") throw new EngineStartError(this.notFoundMessage(cmd));
      throw new EngineStartError(`failed to start the engine (${cmd}): ${err?.message ?? String(error)}`);
    }

    let resolveExited!: () => void;
    const exited = new Promise<void>((resolve) => {
      resolveExited = resolve;
    });
    const conn: Conn = {
      proc,
      pid: typeof proc.pid === "number" ? proc.pid : null,
      nextId: 1,
      pending: new Map(),
      stdoutBuf: "",
      stderrPartial: "",
      stderrRing: [],
      ready: false,
      dead: false,
      gone: false,
      exitInfo: null,
      spawnError: null,
      quitId: null,
      exited,
      resolveExited,
      onBanner: null,
      onGone: null,
    };

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    // A write to a dead engine's stdin must not crash the server.
    proc.stdin.on("error", () => {});
    proc.stdout.on("data", (chunk: string) => this.onStdout(conn, chunk));
    proc.stderr.on("data", (chunk: string) => this.onStderr(conn, chunk));

    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    proc.on("error", (error: NodeJS.ErrnoException) => {
      if (conn.pid === null || error?.code === "ENOENT") {
        // The process never started.
        conn.spawnError = error;
        this.markGone(conn);
        return;
      }
      console.error("[PoB API] engine process error:", error?.message ?? error);
    });
    proc.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      conn.exitInfo ??= { code, signal };
      conn.dead = true;
      // Wait for `close` so the stderr tail is complete, but not forever.
      settleTimer ??= setTimeout(() => this.markGone(conn), EXIT_SETTLE_MS);
    });
    proc.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      conn.exitInfo ??= { code, signal };
      if (settleTimer) clearTimeout(settleTimer);
      this.markGone(conn);
    });
    return conn;
  }

  private notFoundMessage(cmd: string): string {
    const which = cmd === "luajit" ? "" : ` (POB_CMD=${cmd})`;
    return (
      `luajit not found on PATH${which}. Launch the server via \`mise exec\` (see README), ` +
      `or run tests with \`mise run test\`.`
    );
  }

  private startExitError(conn: Conn): EngineStartError {
    const { cmd } = this.command();
    if (conn.spawnError) {
      if (conn.spawnError.code === "ENOENT") return new EngineStartError(this.notFoundMessage(cmd));
      return new EngineStartError(`failed to start the engine (${cmd}): ${conn.spawnError.message}`);
    }
    const code = conn.exitInfo?.code ?? null;
    const signal = conn.exitInfo?.signal ?? null;
    const tail = conn.stderrRing.slice(-STDERR_SHOWN_LINES).join("\n");
    return new EngineStartError(`engine exited during startup (code ${code}, signal ${signal}): ${tail}`);
  }

  private waitForBanner(conn: Conn): Promise<JsonObject> {
    return new Promise<JsonObject>((resolve, reject) => {
      const timer = setTimeout(() => {
        done();
        const tail = conn.stderrRing.slice(-STDERR_SHOWN_LINES).join("\n");
        reject(
          new EngineStartError(
            `the engine printed no ready banner within ${BANNER_TIMEOUT_MS / 1000} s${tail ? `: ${tail}` : ""}`,
          ),
        );
      }, BANNER_TIMEOUT_MS);
      const done = () => {
        clearTimeout(timer);
        conn.onBanner = null;
        conn.onGone = null;
      };
      conn.onBanner = (banner) => {
        done();
        resolve(banner);
      };
      conn.onGone = () => {
        done();
        reject(this.startExitError(conn));
      };
      if (conn.gone) conn.onGone();
    });
  }

  private checkBanner(banner: JsonObject, allowUnpinned: boolean): void {
    const version = (banner.version ?? {}) as JsonObject;
    const apiVersion = typeof version.apiVersion === "string" ? version.apiVersion : String(version.apiVersion ?? "");
    if (apiVersion.split(".")[0] !== "2") {
      throw new EngineStartError(
        `bridge protocol mismatch: the engine bridge (pob-api/) speaks apiVersion ${apiVersion || "(none)"}, ` +
          `this server needs 2.x. Rebuild the server and its pob-api/ from the same checkout (\`mise run build\`).`,
      );
    }
    const number = version.number;
    if (number !== this.pin.version) {
      const reason = `the engine reports PoB version ${String(number)}, but the pinned version is ${this.pin.version}`;
      if (!allowUnpinned) throw new EnginePinError(reason, PIN_HINT);
      console.error(`[PoB API] POB_ALLOW_UNPINNED=true, continuing despite: ${reason}`);
    }
  }

  // -------------------------------------------------------------------------------------------------
  // I/O

  private onStdout(conn: Conn, chunk: string): void {
    if (this.env.POB_DEBUG === "true") console.error("[PoB API stdout]", chunk.trim());
    conn.stdoutBuf += chunk;
    let idx: number;
    while ((idx = conn.stdoutBuf.indexOf("\n")) >= 0) {
      const line = conn.stdoutBuf.slice(0, idx);
      conn.stdoutBuf = conn.stdoutBuf.slice(idx + 1);
      this.onLine(conn, line);
    }
  }

  private onStderr(conn: Conn, chunk: string): void {
    const text = conn.stderrPartial + chunk;
    const lines = text.split("\n");
    conn.stderrPartial = lines.pop() ?? "";
    for (const line of lines) this.pushStderr(conn, line);
  }

  private pushStderr(conn: Conn, rawLine: string): void {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim() === "") return;
    conn.stderrRing.push(line);
    if (conn.stderrRing.length > STDERR_RING_LINES) conn.stderrRing.shift();
    console.error("[PoB API stderr]", line);
  }

  private onLine(conn: Conn, line: string): void {
    const text = line.trim();
    if (!text.startsWith("{")) return; // non-JSON lines are ignored
    let msg: unknown;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg === null || typeof msg !== "object" || Array.isArray(msg)) return;
    const reply = msg as JsonObject;

    if (typeof reply.id !== "number") {
      if (conn.onBanner && reply.ready === true) {
        conn.onBanner(reply);
        return;
      }
      console.error(`[PoB API] ignoring an engine line without an id: ${text.slice(0, 300)}`);
      return;
    }
    if (reply.id === conn.quitId) return;
    const pending = conn.pending.get(reply.id);
    if (!pending) {
      console.error(`[PoB API] dropping a reply with unknown id ${reply.id}`);
      return;
    }
    conn.pending.delete(reply.id);
    pending.cleanup();

    if (reply.ok !== true) {
      const code = typeof reply.code === "string" ? reply.code : "FAILED";
      const error = typeof reply.error === "string" ? reply.error : `${pending.action} failed`;
      pending.reject(new EngineActionError(pending.action, code, error));
      return;
    }
    const schema = isTestAction(pending.action) ? undefined : replySchemas[pending.action as ActionName];
    if (!schema) {
      pending.resolve(reply);
      return;
    }
    const parsed = schema.safeParse(reply);
    if (parsed.success) pending.resolve(parsed.data);
    else pending.reject(new EngineContractError(pending.action, parsed.error.issues));
  }

  /** Write one request on `conn` and wait for its reply. */
  private send(conn: Conn, action: string, params: object | undefined, opts: RequestOptions): Promise<unknown> {
    if (conn.dead) return Promise.reject(this.deadError(conn));
    if (opts.signal?.aborted) return Promise.reject(abortError(opts.signal));
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeout(action);
    const id = conn.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      try {
        conn.proc.stdin.write(JSON.stringify({ id, action, params: params ?? {} }) + "\n");
      } catch {
        reject(this.deadError(conn));
        return;
      }
      // The timer runs from the write, not per line read (C-4).
      const timer = setTimeout(() => this.onTimeout(conn, id), timeoutMs);
      const signal = opts.signal;
      const onAbort = () => {
        const entry = conn.pending.get(id);
        if (!entry) return;
        conn.pending.delete(id);
        entry.cleanup();
        entry.reject(abortError(signal!));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      conn.pending.set(id, {
        action,
        timeoutMs,
        resolve,
        reject,
        cleanup: () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
        },
      });
    });
  }

  private defaultTimeout(action: string): number {
    const special = LONG_ACTION_TIMEOUTS[action];
    if (special !== undefined) return special;
    const configured = Number.parseInt(this.env.POB_TIMEOUT_MS ?? "", 10);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
  }

  private onTimeout(conn: Conn, id: number): void {
    const pending = conn.pending.get(id);
    if (!pending) return;
    conn.pending.delete(id);
    pending.cleanup();
    pending.reject(new EngineTimeoutError(pending.action, pending.timeoutMs));
    this.kill(conn, `the engine was stopped after "${pending.action}" timed out`);
  }

  /** SIGKILL the process and fail every pending request now. */
  private kill(conn: Conn, why: string): void {
    conn.dead = true;
    this.failPending(conn, new EngineExitedError(null, "SIGKILL", conn.stderrRing, why));
    try {
      conn.proc.kill("SIGKILL");
    } catch {
      // already gone
    }
  }

  private failPending(conn: Conn, error: Error): void {
    const entries = [...conn.pending.values()];
    conn.pending.clear();
    for (const entry of entries) {
      entry.cleanup();
      entry.reject(error);
    }
  }

  /** The process is gone: flush stderr, fail pending requests, wake start(). Idempotent. */
  private markGone(conn: Conn): void {
    if (conn.gone) return;
    conn.gone = true;
    conn.dead = true;
    if (conn.stderrPartial) {
      this.pushStderr(conn, conn.stderrPartial);
      conn.stderrPartial = "";
    }
    this.failPending(conn, this.deadError(conn));
    conn.resolveExited();
    conn.onGone?.();
  }

  private deadError(conn: Conn | null): EngineExitedError {
    if (conn?.exitInfo) {
      return new EngineExitedError(conn.exitInfo.code, conn.exitInfo.signal, conn.stderrRing);
    }
    if (conn?.spawnError) {
      return new EngineExitedError(null, null, [], `the engine failed to start: ${conn.spawnError.message}`);
    }
    return new EngineExitedError(null, null, conn?.stderrRing ?? [], "the engine is not running");
  }

  // -------------------------------------------------------------------------------------------------
  // Public request API

  /**
   * Send one action and wait for its reply (C-4). Rejects with `EngineExitedError` when no engine is
   * running; it never spawns one (D-59).
   */
  request<A extends ActionName>(action: A, params?: ActionParams<A>, opts?: RequestOptions): Promise<ActionReply<A>>;
  request(action: TestActionName, params?: Record<string, unknown>, opts?: RequestOptions): Promise<TestReply>;
  request(action: string, params?: object, opts: RequestOptions = {}): Promise<unknown> {
    const conn = this.conn;
    if (conn === null || !conn.ready || conn.dead) return Promise.reject(this.deadError(conn));
    return this.send(conn, action, params, opts);
  }

  /** Stop the engine: `quit`, wait ≤ 2 s for it to exit, then SIGKILL. */
  async stop(): Promise<void> {
    this.generation++;
    // A start still in flight is now doomed (it fails at its generation check, or because its engine
    // is stopped below). Detach it, so a start() issued after this stop() makes a fresh attempt
    // instead of joining the doomed one. The old attempt's settle handler only clears its own slot.
    this.starting = null;
    const conn = this.conn;
    if (!conn) return;
    if (!conn.dead) {
      conn.dead = true;
      conn.quitId = conn.nextId++;
      try {
        conn.proc.stdin.write(JSON.stringify({ id: conn.quitId, action: "quit" }) + "\n");
      } catch {
        // the pipe is already gone; the grace wait below decides
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const graceOver = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), QUIT_GRACE_MS);
      });
      const exitedInTime = await Promise.race([conn.exited.then(() => true), graceOver]);
      if (timer) clearTimeout(timer);
      if (!exitedInTime) this.kill(conn, "the engine was stopped");
    }
  }

  // -------------------------------------------------------------------------------------------------
  // Typed wrappers over request()

  async ping(): Promise<boolean> {
    const res = await this.request("ping");
    return res.ok === true;
  }

  async newBuild(params: ActionParams<"new_build"> = {}): Promise<ActionReply<"new_build">> {
    return this.request("new_build", params);
  }

  /**
   * `load_build_xml` (C-2): the loaded build's name and `droppedSupports`, the gems PoB dropped from the build's
   * granted socket groups (D-398, `DroppedSupportGroup`; `[]` for none). Only the session loads (D-59).
   */
  async loadBuildXml(xml: string, name = "API Build"): Promise<ActionReply<"load_build_xml">> {
    return this.request("load_build_xml", { xml, name });
  }

  /** `get_stats`: the requested (default: the widened default list) scalar stats, plus `_meta`. */
  async getStats(fields?: string[]): Promise<Loose<StatsResult>> {
    const res = await this.request("get_stats", { fields });
    return res.stats;
  }

  /**
   * `get_stats` with `breakdown` (C-45): `fields` measured per active skill and per stat set of one
   * socket group (default: the main one), each as the main selection; the engine then restores the
   * prior selection exactly (D-176). Only the breakdown is read, so no other stats are requested.
   */
  async getStatsBreakdown(params: { groupIndex?: number; fields: string[] }): Promise<StatsBreakdown> {
    const res = await this.request("get_stats", { fields: [], breakdown: params });
    if (!res.breakdown) throw new Error("the engine sent no breakdown");
    return res.breakdown;
  }

  async getTree(): Promise<Loose<TreeResult>> {
    const res = await this.request("get_tree");
    return res.tree;
  }

  /** Every slot PoB created, hidden ones included; see `visibleItemSlots` (E8). */
  async getItems(): Promise<ItemSlot[]> {
    const res = await this.request("get_items");
    return res.items;
  }

  async addItem(itemText: string, slotName?: string, noAutoEquip?: boolean): Promise<ActionReply<"add_item_text">["item"]> {
    const res = await this.request("add_item_text", { text: itemText, slotName, noAutoEquip });
    return res.item;
  }

  async setFlaskActive(flaskIndex: number, active: boolean): Promise<void> {
    await this.request("set_flask_active", { index: flaskIndex, active });
  }

  async getSkills(): Promise<SkillsResult> {
    const res = await this.request("get_skills");
    return res.skills;
  }

  /**
   * With `statSet`, returns the stat set the engine selected (C-44); with `minionSkill`, the minion
   * selection (D-377). Each is `undefined` when not requested.
   */
  async setMainSelection(
    params: ActionParams<"set_main_selection">,
  ): Promise<{ statSet?: SelectedStatSet; minion?: SelectedMinionSkill }> {
    const res = await this.request("set_main_selection", params);
    return { statSet: res.statSet, minion: res.minion };
  }

  /**
   * With `weaponSets` or `attributeChoices` (C-40), all-or-nothing: an engine error names each node and
   * the reason, and the spec is left as it was. Without both, the tags and choices are kept (AC-E29).
   */
  async setTree(params: ActionParams<"set_tree">): Promise<Loose<TreeResult>> {
    const res = await this.request("set_tree", params);
    return res.tree;
  }

  async exportBuildXml(): Promise<string> {
    const res = await this.request("export_build_xml");
    return res.xml;
  }

  async getBuildInfo(): Promise<BuildInfoResult> {
    const res = await this.request("get_build_info");
    return res.info;
  }

  /** PoB's own warning lines (D-30); the level and its auto mode are left as they were. */
  async getWarnings(): Promise<string[]> {
    const res = await this.request("get_warnings");
    return res.result.lines;
  }

  /** What the game won't allow in the loaded build (D-383): its allocated nodes whose unlock constraint is unmet. */
  async getRuleBreaks(): Promise<RuleBreaksResult> {
    const res = await this.request("get_rule_breaks");
    return res.result;
  }

  /**
   * Set the character level. `autoMode: true` also turns on PoB's auto-level mode (D-196, used by
   * `compile_plan`); without it the level is manual, as `set_character_level` always sets it.
   */
  async setLevel(level: number, opts: { autoMode?: boolean } = {}): Promise<void> {
    await this.request("set_level", opts.autoMode === undefined ? { level } : { level, autoMode: opts.autoMode });
  }

  async getConfig(): Promise<ConfigResult> {
    const res = await this.request("get_config");
    return res.config;
  }

  async setConfig(params: ActionParams<"set_config">): Promise<ConfigResult> {
    const res = await this.request("set_config", params);
    return res.config;
  }

  /** A new socket group in the active skill set; `groupCount` (D-293) is the group's Count, its copies at once. */
  async createSocketGroup(params: ActionParams<"create_socket_group"> = {}): Promise<ActionReply<"create_socket_group">["socketGroup"]> {
    const res = await this.request("create_socket_group", params);
    return res.socketGroup;
  }

  async addGem(params: ActionParams<"add_gem">): Promise<ActionReply<"add_gem">["gem"]> {
    const res = await this.request("add_gem", params);
    return res.gem;
  }

  async setGemLevel(params: ActionParams<"set_gem_level">): Promise<void> {
    await this.request("set_gem_level", params);
  }

  async setGemQuality(params: ActionParams<"set_gem_quality">): Promise<void> {
    await this.request("set_gem_quality", params);
  }

  async setGemCorruption(params: ActionParams<"set_gem_corruption">): Promise<ActionReply<"set_gem_corruption">["result"]> {
    const res = await this.request("set_gem_corruption", params);
    return res.result;
  }

  async removeSkill(params: ActionParams<"remove_skill">): Promise<void> {
    await this.request("remove_skill", params);
  }

  async removeGem(params: ActionParams<"remove_gem">): Promise<void> {
    await this.request("remove_gem", params);
  }

  async setSocketGroupEnabled(params: ActionParams<"set_socket_group_enabled">): Promise<ActionReply<"set_socket_group_enabled">["result"]> {
    const res = await this.request("set_socket_group_enabled", params);
    return res.result;
  }

  async setGemEnabled(params: ActionParams<"set_gem_enabled">): Promise<void> {
    await this.request("set_gem_enabled", params);
  }

  async searchNodes(params: ActionParams<"search_nodes">): Promise<ActionReply<"search_nodes">["results"]> {
    const res = await this.request("search_nodes", params);
    return res.results;
  }

  /**
   * C-37: PoB2's loaded gem, unique, passive, mod, essence and item-base data (`API/Lookup.lua`); reads only.
   * A mechanic mod hit carries its `baseTypes`, and essence hits are kind `essence` (WU-60, D-277). WU-53
   * (D-299): gem results carry skill types, "usable by", Gemling quality lines and hit-making children, and
   * for a single gem (or several all named as the query) a support's reach or an active gem's unlocks; base
   * implicits are hits of kind `base`.
   */
  async lookupGameData(params: ActionParams<"lookup_game_data">): Promise<ActionReply<"lookup_game_data">["result"]> {
    const res = await this.request("lookup_game_data", params);
    return res.result;
  }

  /**
   * C-38: per line, whether PoB applies an item's, a passive node's or a gem's lines (`API/Coverage.lua`);
   * reads only. `sourceNames` and `sourceTemplates` are the server's scan of PoB's source (D-226, D-243).
   * The reply's `flags` name what PoB doesn't model, beside the statuses (WU-54; D-300, D-336).
   */
  async checkCoverage(params: ActionParams<"check_coverage">): Promise<ActionReply<"check_coverage">["result"]> {
    const res = await this.request("check_coverage", params);
    return res.result;
  }

  /** List gems from PoB2's authoritative gem database (PoE2). */
  async listGems(params: ActionParams<"list_gems"> = {}): Promise<ActionReply<"list_gems">["result"]> {
    const res = await this.request("list_gems", params);
    return res.result;
  }

  /** List PoE2 classes + ascendancies with their engine IDs. */
  async getClasses(): Promise<ActionReply<"get_classes">["result"]> {
    const res = await this.request("get_classes");
    return res.result;
  }

  /**
   * C-48 (D-194): added nodes take PoB's own path, in the order given; `autoPathedNodes` are the path nodes
   * beyond the requested ones, `skippedAscendancyNodes` the requested nodes whose path would take the
   * ascendancy points over 8, and `tree.ascendancyPointsUsed` the points after the call.
   */
  async updateTreeDelta(params: ActionParams<"update_tree_delta">): Promise<UpdateTreeDeltaResult> {
    const res = await this.request("update_tree_delta", params);
    return { tree: res.tree, autoPathedNodes: res.autoPathedNodes, skippedAscendancyNodes: res.skippedAscendancyNodes };
  }

  async calcWith(params: ActionParams<"calc_with">): Promise<Record<string, any>> {
    const res = await this.request("calc_with", params);
    return res.output;
  }

  /** `create_spec`: `{index, title, activated}` of the new spec. */
  async createSpec(params: ActionParams<"create_spec"> = {}): Promise<CreateSpecResult> {
    const res = await this.request("create_spec", params);
    return res.result;
  }

  async listSpecs(): Promise<ListSpecsResult> {
    const res = await this.request("list_specs");
    return res.result;
  }

  async selectSpec(index: number): Promise<SelectSpecResult> {
    const res = await this.request("select_spec", { index });
    return res.result;
  }

  async deleteSpec(index: number): Promise<DeleteSpecResult> {
    const res = await this.request("delete_spec", { index });
    return res.result;
  }

  async renameSpec(index: number, title: string): Promise<RenameSpecResult> {
    const res = await this.request("rename_spec", { index, title });
    return res.result;
  }

  async listItemSets(): Promise<ListItemSetsResult> {
    const res = await this.request("list_item_sets");
    return res.result;
  }

  async selectItemSet(id: number): Promise<SelectItemSetResult> {
    const res = await this.request("select_item_set", { id });
    return res.result;
  }

  /**
   * C-39: list, create, copy, rename or select item, skill and config sets, or list and select loadouts
   * (`API/Sets.lua`). Every action except `list` rebuilds; the reply is the type's list.
   */
  async manageSets(params: ActionParams<"manage_sets">): Promise<ManageSetsResult> {
    const res = await this.request("manage_sets", params);
    return res.result;
  }

  // The plan compiler (C-41, `API/Compile.lua`). Each request runs under the default timeout (C-4), which
  // bounds every stage of a compile (NFR-21).

  /**
   * The read-only preflight of every stage: the defects, the tree the compile builds against, each valid
   * anoint's notable and recipe (`anoints`, D-358), the descriptions of the gems asked for (`gemTexts`, D-353)
   * and each stage's trees for V1's `tree-shape` (`trees`, D-360). A group's `minionSkill` and `minionStatSet`
   * are checked against its summon's minion in the game data (D-377). A stage's `companion` is resolved against PoB's
   * beast library, with its Tame Beast gem checked and its custom modifier lines parsed (`companions`, D-402).
   */
  async compileCheck(params: ActionParams<"compile_check">, opts?: RequestOptions): Promise<CompileCheckResult> {
    const res = await this.request("compile_check", params, opts);
    return res.result;
  }

  /**
   * Build and measure one stage: its set ids, PoB's allocation, its outputs and its breakdown, and whether each
   * measured skill's damage over time stacks (`dotCanStack`, D-293). An `anoint` goes on the amulet (D-358). Each
   * group's `minionSkill` is selected by name, and its resolved selection comes back in `minionSkills`; the outputs
   * carry the minion's numbers as `Minion<Field>` (D-376, D-377), and `checks.grantedSkills` the passives that grant
   * a group's skill (D-380). A `companion` turns the stage's Tame Beast gem into that beast, and the reply's
   * `companion` gives its skill's place and the Spirit PoB reserves for it (D-402).
   */
  async compileStage(params: ActionParams<"compile_stage">, opts?: RequestOptions): Promise<CompileStageResult> {
    const res = await this.request("compile_stage", params, opts);
    return res.result;
  }

  /** Check the loadouts, select the highest stage's loadout and save its level in auto mode. */
  async compileFinish(params: ActionParams<"compile_finish">, opts?: RequestOptions): Promise<CompileFinishResult> {
    const res = await this.request("compile_finish", params, opts);
    return res.result;
  }

  // Lua trade actions (C-13). Each takes the request options, so a caller can clip the timeout to its
  // deadline and pass its abort signal (D-22); `trade_generate_query` defaults to 60 s (D-47).

  /** PoB's weighted trade query for a slot, the full ranked weights and the baseline score. */
  async tradeGenerateQuery(params: TradeGenerateQueryParams, opts?: RequestOptions): Promise<TradeGenerateQueryResult> {
    const res = await this.request("trade_generate_query", params, opts);
    return res.result;
  }

  /** Score fetched listings against the loaded build, one by one (failures go to `rejected`). */
  async tradeEvaluateItems(params: TradeEvaluateItemsParams, opts?: RequestOptions): Promise<TradeEvaluateItemsResult> {
    const res = await this.request("trade_evaluate_items", params, opts);
    return res.result;
  }

  /** What PoB's trade dialog offers for a slot (C-15). */
  async tradeQueryOptions(slot: string, opts?: RequestOptions): Promise<TradeQueryOptionsResult> {
    const res = await this.request("trade_query_options", { slot }, opts);
    return res.result;
  }
}
