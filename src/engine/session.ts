/**
 * Engine session (C-3): the router's only way to the engine.
 *
 * `session.run({tool, kind, signal, deadline}, fn)` does, in order:
 *  0. emits `queued`;
 *  1. takes a FIFO mutex (one engine tool call at a time, of any kind); an abort while waiting rejects
 *     with `AbortError`, a passed deadline with `EngineBusyError`; emits `start`;
 *  2. ensures the engine: this is the ONLY place the engine is started (D-59), and `start()` runs the
 *     pin check; a first start (or one after `lua_stop`) sets `loaded = NEW_BUILD`;
 *  3. after a crash, restores the latest recovery snapshot (or fails `read`/`mutate` calls, D-8);
 *  4. checks the loaded file on disk (D-19): auto-reloads it when the engine is clean, warns when dirty;
 *  5. runs `fn(ctx)`, where `ctx.client` rejects raw loads and the `ctx.*` load methods keep the books;
 *  6. on success, `revision += 1` for `mutate`/`load` and takes a recovery snapshot (D-44);
 *  7. on failure (or an engine death during 5–6), leaves `revision` alone and marks a crash;
 *  8. returns the notices, which the router prepends to the tool's text (also on errors: `noticesOf`).
 * `kind: 'lifecycle'` follows rule L: `lua_start` runs steps 2–3 only; `lua_stop` skips 2–6 and calls
 * `ctx.stopEngine()`.
 */
import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import type { spawn as nodeSpawn } from "child_process";
import { EngineActionError, PoBLuaApiClient, type RequestOptions } from "../pobLuaBridge.js";
import { resolvePobApiDir, resolvePobSrc } from "./pobPath.js";
import { readPin } from "./pinCheck.js";
import { canonicalBuildPath, sanitizeBuildName } from "../utils/pathSanitizer.js";

export type EngineKind = "read" | "mutate" | "load" | "lifecycle";

export interface Fingerprint {
  size: number;
  mtimeMs: number;
  sha1: string;
}

export interface LoadedBuild {
  /** Canonical POSIX path relative to POB_DIRECTORY (D-52); null when not from a file. */
  path: string | null;
  /** File name without .xml, or "New build" / "Imported build". */
  displayName: string;
  /** Of the bytes the engine loaded, or last saved from the engine. */
  fingerprint: Fingerprint | null;
  loadedRevision: number;
  /** Revision at the last load or engine save to `path`. */
  savedRevision: number;
}

/**
 * Session events (test hook). `queued`/`start`/`end` are C-3's; `snapshot-start`/`snapshot-end`
 * bracket the step-6 recovery snapshot, so its cost can be measured (AC-E22).
 */
export type EnginePhase = "queued" | "start" | "end" | "snapshot-start" | "snapshot-end";
export interface EngineEvent {
  tool: string;
  kind: EngineKind;
  phase: EnginePhase;
  t: number;
  ok?: boolean;
}

export interface EngineCall {
  tool: string;
  kind: EngineKind;
  signal?: AbortSignal;
  /** Epoch ms; only `find_upgrades` gets one (router: arrivedAt + budget, D-22). */
  deadline?: number;
}

export interface EngineCallContext {
  /** Session-scoped: rejects `load_build_xml` / `new_build` ("engine load outside the session"). */
  client: PoBLuaApiClient;
  loadFile(relPath: string): Promise<LoadedBuild>;
  /** `path = null`. */
  loadXml(xml: string, origin: { displayName: string }): Promise<LoadedBuild>;
  /** `displayName = "New build"`, `path = null`. */
  newBuild(params: { className?: string; ascendancy?: string }): Promise<LoadedBuild>;
  /** D-9: export → load xml → fn → reload the export; `revision`/`loaded` unchanged, also on failure. */
  withTemporaryBuild<T>(xml: string, fn: () => Promise<T>): Promise<T>;
  /** ONLY after writing the engine's current build (C-17 step 6). */
  noteSaved(relPath: string, fp: Fingerprint): void;
  fingerprint(relPath: string): Promise<Fingerprint | null>;
  /**
   * Rule L, `lua_stop` only: stop the engine, clear `loaded`, the snapshot and the in-flight marker,
   * `revision += 1`. Returns the last mutating tool when unsaved changes were discarded.
   */
  stopEngine(): Promise<{ discardedFrom: string | null }>;
}

export interface EngineSession {
  run<T>(call: EngineCall, fn: (ctx: EngineCallContext) => Promise<T>): Promise<{ value: T; notices: string[] }>;
  readonly revision: number;
  /** Null only when no engine runs. */
  readonly loaded: LoadedBuild | null;
  /** `loaded !== null && revision > loaded.savedRevision`. */
  isDirty(): boolean;
  /** The context of the run whose `fn` is executing in this async scope, else null. */
  current(): EngineCallContext | null;
  onEvent(cb: (e: EngineEvent) => void): () => void;
  enginePid(): number | null;
  shutdown(): Promise<void>;
}

/** The subset of the bridge client (C-4) the session drives. */
export interface SessionClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  isAlive(): boolean;
  pid(): number | null;
  request(action: string, params?: Record<string, unknown>, opts?: RequestOptions): Promise<any>;
}

export interface EngineSessionOptions {
  /** deps.env (C-7). */
  env: Readonly<Record<string, string | undefined>>;
  /** deps.spawn (C-7). */
  spawn: typeof nodeSpawn;
  /** The builds folder: `loaded.path` and fingerprints are relative to it. */
  pobDirectory: string;
  /** Builds the bridge client on the first engine call (default: the real `PoBLuaApiClient`). */
  createClient?: () => SessionClient;
  now?: () => number;
}

// ---------------------------------------------------------------------------------------------------
// Errors and notices

/** A call's `deadline` passed while it waited for the engine lock. */
export class EngineBusyError extends Error {
  constructor(tool: string) {
    super(`the engine is busy: \`${tool}\` could not start before its deadline (another engine call held the lock)`);
    this.name = "EngineBusyError";
  }
}

/** `ctx.client` was asked to load or replace the build directly (the load guard). */
export class EngineLoadGuardError extends Error {
  constructor(action: string) {
    super(
      `engine load outside the session: \`${action}\` is only reachable through the session's load ` +
        `methods (loadFile / loadXml / newBuild), so the server keeps track of which build the engine holds`,
    );
    this.name = "EngineLoadGuardError";
  }
}

/** The engine was reached outside `session.run`. */
export class EngineAccessError extends Error {
  constructor() {
    super("engine access outside a session");
    this.name = "EngineAccessError";
  }
}

/** A session-level refusal (no restorable state, an unloadable disk change). */
export class EngineSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineSessionError";
  }
}

const NOTICES = Symbol("engineNotices");

/** The notices a failed `session.run` collected before it failed (C-3 step 8). */
export function noticesOf(error: unknown): string[] {
  if (error !== null && typeof error === "object" && NOTICES in error) {
    return ((error as Record<symbol, unknown>)[NOTICES] as string[]) ?? [];
  }
  return [];
}

function attachNotices(error: unknown, notices: string[]): void {
  if (error !== null && typeof error === "object" && notices.length > 0) {
    Object.defineProperty(error, NOTICES, { value: [...notices], enumerable: false, configurable: true });
  }
}

function abortError(): Error {
  const error = new Error("the engine call was aborted while waiting for the engine lock");
  error.name = "AbortError";
  return error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sha1(bytes: Buffer): string {
  return crypto.createHash("sha1").update(bytes).digest("hex");
}

/** Actions only the session's load methods may send (the load guard). */
const GUARDED_ACTIONS = new Set(["load_build_xml", "new_build"]);

export const NEW_BUILD_NAME = "New build";
const RESTORE_FAILED = "Engine restarted; the loaded build could not be restored. Load it again.";
const SNAPSHOT_FAILED = "Warning: could not snapshot the engine state; a crash now would lose the last change.";

// ---------------------------------------------------------------------------------------------------

interface Snapshot {
  xml: string;
  revision: number;
  afterTool: string;
}

/** Per-run state the ctx methods report back to the run. */
interface RunState {
  tool: string;
  kind: EngineKind;
  active: boolean;
  /** `fn` made a load through ctx.loadFile/loadXml/newBuild. */
  loaded: boolean;
  /** The session killed the engine on purpose during this run (not a crash). */
  deliberateKill: boolean;
}

class Session implements EngineSession {
  private readonly opts: EngineSessionOptions;
  private readonly now: () => number;
  private readonly als = new AsyncLocalStorage<{ ctx: EngineCallContext; state: RunState }>();
  private readonly listeners = new Set<(e: EngineEvent) => void>();

  private clientInstance: SessionClient | null = null;
  private revisionValue = 0;
  private loadedValue: LoadedBuild | null = null;
  private snapshot: Snapshot | null = null;
  /** The session believes an engine runs (set by a start, cleared by lua_stop/shutdown). */
  private engineRunning = false;
  /** The engine exited outside `stop()` since the last call (C-3 step 3). */
  private crashed = false;
  /** The tool whose call was in flight when the engine died. */
  private interrupted: string | null = null;
  private lastMutatingTool: string | null = null;

  // FIFO mutex
  private locked = false;
  private waiters: Array<() => void> = [];

  constructor(opts: EngineSessionOptions) {
    this.opts = opts;
    this.now = opts.now ?? Date.now;
  }

  get revision(): number {
    return this.revisionValue;
  }

  get loaded(): LoadedBuild | null {
    return this.loadedValue;
  }

  isDirty(): boolean {
    return this.loadedValue !== null && this.revisionValue > this.loadedValue.savedRevision;
  }

  current(): EngineCallContext | null {
    const store = this.als.getStore();
    return store && store.state.active ? store.ctx : null;
  }

  onEvent(cb: (e: EngineEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  enginePid(): number | null {
    return this.clientInstance?.pid() ?? null;
  }

  async shutdown(): Promise<void> {
    const client = this.clientInstance;
    this.engineRunning = false;
    this.crashed = false;
    this.loadedValue = null;
    this.snapshot = null;
    this.interrupted = null;
    if (client) await client.stop();
  }

  // -------------------------------------------------------------------------------------------------

  private emit(call: EngineCall, phase: EnginePhase, ok?: boolean): void {
    const event: EngineEvent = { tool: call.tool, kind: call.kind, phase, t: Date.now(), ...(ok !== undefined ? { ok } : {}) };
    for (const cb of this.listeners) {
      try {
        cb(event);
      } catch (error) {
        console.error("[Engine Session] event listener failed:", errorMessage(error));
      }
    }
  }

  private client(): SessionClient {
    if (!this.clientInstance) {
      this.clientInstance = this.opts.createClient
        ? this.opts.createClient()
        : new PoBLuaApiClient({
            env: this.opts.env,
            spawn: this.opts.spawn,
            pobSrc: resolvePobSrc(this.opts.env),
            pobApiDir: resolvePobApiDir(),
            pin: readPin(),
          });
    }
    return this.clientInstance;
  }

  private acquire(call: EngineCall): Promise<void> {
    if (call.signal?.aborted) return Promise.reject(abortError());
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        call.signal?.removeEventListener("abort", onAbort);
        const i = this.waiters.indexOf(grant);
        if (i >= 0) this.waiters.splice(i, 1);
      };
      const grant = () => {
        cleanup();
        resolve();
      };
      const onAbort = () => {
        cleanup();
        reject(abortError());
      };
      call.signal?.addEventListener("abort", onAbort, { once: true });
      if (call.deadline !== undefined) {
        timer = setTimeout(() => {
          cleanup();
          reject(new EngineBusyError(call.tool));
        }, Math.max(0, call.deadline - this.now()));
      }
      this.waiters.push(grant);
    });
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.locked = false;
  }

  // -------------------------------------------------------------------------------------------------

  async run<T>(call: EngineCall, fn: (ctx: EngineCallContext) => Promise<T>): Promise<{ value: T; notices: string[] }> {
    const notices: string[] = [];
    this.emit(call, "queued");
    try {
      await this.acquire(call);
    } catch (error) {
      this.emit(call, "end", false);
      throw error;
    }
    this.emit(call, "start");
    let ok = false;
    try {
      const value = await this.runLocked(call, fn, notices);
      ok = true;
      return { value, notices };
    } catch (error) {
      attachNotices(error, notices);
      throw error;
    } finally {
      this.emit(call, "end", ok);
      this.release();
    }
  }

  private async runLocked<T>(call: EngineCall, fn: (ctx: EngineCallContext) => Promise<T>, notices: string[]): Promise<T> {
    const state: RunState = { tool: call.tool, kind: call.kind, active: true, loaded: false, deliberateKill: false };

    if (call.kind === "lifecycle") {
      // Rule L: lua_start runs steps 2–3 and skips 4–6; lua_stop skips 2–6 (ctx.stopEngine does the work).
      if (call.tool !== "lua_stop") await this.ensureEngine(call, notices);
      return this.runFn(fn, state);
    }

    await this.ensureEngine(call, notices); // steps 2–3
    if (call.kind !== "load") await this.checkDisk(state, notices); // step 4

    // Step 5.
    const client = this.client();
    const pid = client.pid();
    let value: T;
    try {
      value = await this.runFn(fn, state);
    } catch (error) {
      throw this.failed(state, pid, error);
    }

    // Step 6 (a death during it is a failure too).
    if (!this.sameEngine(pid)) {
      throw this.failed(state, pid, new Error("the engine exited before the call's result could be kept"));
    }
    if (call.kind === "mutate" || call.kind === "load") {
      const next = this.revisionValue + 1;
      this.emit(call, "snapshot-start");
      let snapshot: Snapshot | null = null;
      let snapshotError: unknown = null;
      try {
        const xml = await this.exportXml();
        snapshot = { xml, revision: next, afterTool: call.tool };
      } catch (error) {
        snapshotError = error;
      }
      this.emit(call, "snapshot-end");
      if (!this.sameEngine(pid)) {
        throw this.failed(state, pid, snapshotError ?? new Error("the engine exited while its state was snapshotted"));
      }
      this.revisionValue = next;
      if (call.kind === "mutate") this.lastMutatingTool = call.tool;
      if (snapshot) {
        this.snapshot = snapshot;
      } else {
        console.error(`[Engine Session] snapshot after ${call.tool} failed: ${errorMessage(snapshotError)}`);
        this.snapshot = null;
        notices.push(SNAPSHOT_FAILED);
      }
    }
    if (state.loaded && this.loadedValue) {
      this.loadedValue = { ...this.loadedValue, loadedRevision: this.revisionValue, savedRevision: this.revisionValue };
    }
    return value;
  }

  private async runFn<T>(fn: (ctx: EngineCallContext) => Promise<T>, state: RunState): Promise<T> {
    const ctx = this.makeCtx(state);
    try {
      return await this.als.run({ ctx, state }, () => fn(ctx));
    } finally {
      state.active = false;
    }
  }

  private sameEngine(pid: number | null): boolean {
    const client = this.client();
    return client.isAlive() && client.pid() === pid;
  }

  /** Step 7: the call failed. A crash (not a deliberate kill) is recorded for the next step 3. */
  private failed(state: RunState, pid: number | null, error: unknown): unknown {
    if (this.sameEngine(pid)) return error;
    this.crashed = true;
    if (state.deliberateKill) return error;
    this.interrupted = state.tool;
    const suffix = ` (The engine stopped while running \`${state.tool}\`; the next engine call restores the last state.)`;
    if (error instanceof Error) {
      error.message += suffix;
      return error;
    }
    return new Error(`${String(error)}${suffix}`);
  }

  /** Steps 2–3. */
  private async ensureEngine(call: EngineCall, notices: string[]): Promise<void> {
    const client = this.client();
    if (client.isAlive()) return;
    const crashed = this.crashed || this.engineRunning;
    this.crashed = crashed;
    this.engineRunning = false;
    await client.start(); // start errors propagate (the pin check runs inside)
    this.engineRunning = true;
    this.crashed = false;
    if (!crashed) {
      this.loadedValue = this.newBuildRecord();
      this.snapshot = null;
      this.interrupted = null;
      return;
    }
    await this.recover(call, notices);
  }

  /** Step 3: the engine exited outside `stop()` since the last call. */
  private async recover(call: EngineCall, notices: string[]): Promise<void> {
    const interrupted = this.interrupted;
    this.interrupted = null;
    const snapshot = this.snapshot;
    if (snapshot && this.loadedValue) {
      try {
        await this.rawLoad(snapshot.xml, this.loadedValue.displayName);
        notices.push(
          `Engine restarted; restored the build to its state after \`${snapshot.afterTool}\`.` +
            (interrupted ? ` The interrupted call \`${interrupted}\` was not applied.` : ""),
        );
        return;
      } catch (error) {
        // Never retried: kill the engine, discard the snapshot, take the no-snapshot path.
        console.error(`[Engine Session] restoring the snapshot failed: ${errorMessage(error)}`);
        this.snapshot = null;
        this.engineRunning = false;
        await this.client().stop();
        await this.client().start();
        this.engineRunning = true;
      }
    }
    this.snapshot = null;
    this.loadedValue = this.newBuildRecord();
    if (call.kind === "read" || call.kind === "mutate") throw new EngineSessionError(RESTORE_FAILED);
    notices.push(RESTORE_FAILED);
  }

  /** Step 4 (D-19): the disk-change check. */
  private async checkDisk(state: RunState, notices: string[]): Promise<void> {
    const loaded = this.loadedValue;
    if (!loaded || loaded.path === null || loaded.fingerprint === null) return;
    const rel = loaded.path;
    const abs = path.join(this.opts.pobDirectory, rel);
    let size: number;
    let mtimeMs: number;
    let bytes: Buffer;
    try {
      const st = await fs.stat(abs);
      size = st.size;
      mtimeMs = st.mtimeMs;
      if (size === loaded.fingerprint.size && mtimeMs === loaded.fingerprint.mtimeMs) return;
      bytes = await fs.readFile(abs);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        notices.push(`Warning: ${rel} no longer exists on disk.`);
        return;
      }
      throw error;
    }
    const hash = sha1(bytes);
    if (hash === loaded.fingerprint.sha1) {
      this.loadedValue = { ...loaded, fingerprint: { ...loaded.fingerprint, mtimeMs } };
      return;
    }
    if (this.isDirty()) {
      notices.push(
        `Warning: ${rel} changed on disk (probably saved in PoB2), but the engine has unsaved changes from ` +
          `\`${this.lastMutatingTool ?? "an earlier call"}\`. Reload it with lua_reload_build (discarding the ` +
          `engine's changes) or save under a new name.`,
      );
      return;
    }

    // 4a: auto-reload the bytes just hashed.
    try {
      await this.rawLoad(bytes.toString("utf8"), loaded.displayName);
    } catch (error) {
      // The next step 3 restores the unchanged snapshot; `loaded` stays, so the next call retries.
      await this.killEngine(state);
      throw new EngineSessionError(
        `${rel} changed on disk but could not be loaded (it may be mid-save in PoB2): ${errorMessage(error)}`,
      );
    }
    this.revisionValue += 1;
    this.loadedValue = {
      ...loaded,
      fingerprint: { size: bytes.length, mtimeMs, sha1: hash },
      loadedRevision: this.revisionValue,
      savedRevision: this.revisionValue,
    };
    try {
      this.snapshot = { xml: await this.exportXml(), revision: this.revisionValue, afterTool: "auto-reload" };
    } catch (error) {
      console.error(`[Engine Session] snapshot after the auto-reload failed: ${errorMessage(error)}`);
      this.snapshot = null;
    }
    notices.push(`Reloaded ${rel}: it changed on disk since the engine loaded it.`);
  }

  // -------------------------------------------------------------------------------------------------
  // Engine primitives (unguarded; the session's own use only)

  private async rawLoad(xml: string, name: string): Promise<void> {
    await this.client().request("load_build_xml", { xml, name });
  }

  private async exportXml(): Promise<string> {
    const reply = await this.client().request("export_build_xml");
    if (typeof reply?.xml !== "string" || reply.xml.length === 0) throw new Error("export_build_xml returned no XML");
    return reply.xml as string;
  }

  /** Kill the engine on purpose, so the next step 3 restores the last snapshot. */
  private async killEngine(state: RunState): Promise<void> {
    state.deliberateKill = true;
    this.crashed = true;
    await this.client().stop();
  }

  private newBuildRecord(): LoadedBuild {
    return {
      path: null,
      displayName: NEW_BUILD_NAME,
      fingerprint: null,
      loadedRevision: this.revisionValue,
      savedRevision: this.revisionValue,
    };
  }

  private async readFingerprinted(rel: string): Promise<{ bytes: Buffer; fingerprint: Fingerprint } | null> {
    const abs = sanitizeBuildName(rel, this.opts.pobDirectory);
    try {
      const st = await fs.stat(abs);
      const bytes = await fs.readFile(abs);
      return { bytes, fingerprint: { size: bytes.length, mtimeMs: st.mtimeMs, sha1: sha1(bytes) } };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
      throw error;
    }
  }

  /** A load through ctx: on success it replaces `loaded` and drops the old snapshot. */
  private async ctxLoad(state: RunState, xml: string, record: Omit<LoadedBuild, "loadedRevision" | "savedRevision">): Promise<LoadedBuild> {
    try {
      await this.rawLoad(xml, record.displayName);
    } catch (error) {
      // A failed post-check may leave a half-switched engine: kill it, so the next step 3 restores
      // the pre-load snapshot. Pre-validation failures leave the build untouched (C-2).
      if (error instanceof EngineActionError && error.code === "LOAD_FAILED" && /^load failed:/.test(error.error)) {
        await this.killEngine(state);
      }
      throw error;
    }
    this.commitLoad(state, record);
    return this.loadedValue as LoadedBuild;
  }

  private commitLoad(state: RunState, record: Omit<LoadedBuild, "loadedRevision" | "savedRevision">): void {
    // The previous build's snapshot must never be restored over the new build.
    this.snapshot = null;
    state.loaded = true;
    this.loadedValue = { ...record, loadedRevision: this.revisionValue, savedRevision: this.revisionValue };
  }

  private makeCtx(state: RunState): EngineCallContext {
    const session = this;
    const check = () => {
      if (!state.active) throw new EngineAccessError();
    };
    const real = () => session.client() as unknown as PoBLuaApiClient;
    const guarded = new Proxy({} as PoBLuaApiClient, {
      get(_target, prop) {
        const target = real();
        if (prop === "request") {
          return (action: string, params?: Record<string, unknown>, opts?: RequestOptions) => {
            if (!state.active) return Promise.reject(new EngineAccessError());
            if (GUARDED_ACTIONS.has(action)) return Promise.reject(new EngineLoadGuardError(action));
            return (target as unknown as SessionClient).request(action, params, opts);
          };
        }
        if (prop === "start" || prop === "stop") {
          return () => Promise.reject(new Error(`engine ${String(prop)} outside the session: only the session starts and stops the engine (D-59)`));
        }
        const value = Reflect.get(target as object, prop, guarded);
        // Methods run against the proxy, so the typed wrappers' `this.request` hits the guard.
        return typeof value === "function" ? value.bind(guarded) : value;
      },
    });

    return {
      client: guarded,
      async loadFile(relPath: string): Promise<LoadedBuild> {
        check();
        const rel = await canonicalBuildPath(relPath, session.opts.pobDirectory);
        const file = await session.readFingerprinted(rel);
        if (!file) throw new Error(`build file not found: ${rel}`);
        const displayName = path.posix.basename(rel).replace(/\.xml$/i, "");
        return session.ctxLoad(state, file.bytes.toString("utf8"), { path: rel, displayName, fingerprint: file.fingerprint });
      },
      async loadXml(xml: string, origin: { displayName: string }): Promise<LoadedBuild> {
        check();
        return session.ctxLoad(state, xml, { path: null, displayName: origin.displayName, fingerprint: null });
      },
      async newBuild(params: { className?: string; ascendancy?: string }): Promise<LoadedBuild> {
        check();
        await session.client().request("new_build", { ...params });
        session.commitLoad(state, { path: null, displayName: NEW_BUILD_NAME, fingerprint: null });
        return session.loadedValue as LoadedBuild;
      },
      async withTemporaryBuild<T>(xml: string, fn: () => Promise<T>): Promise<T> {
        check();
        const saved = await session.exportXml();
        const name = session.loadedValue?.displayName ?? NEW_BUILD_NAME;
        let result: T;
        try {
          await session.rawLoad(xml, "Temporary build");
          result = await fn();
        } finally {
          try {
            await session.rawLoad(saved, name);
          } catch (error) {
            // The engine no longer holds the working build: kill it, so step 3 restores the snapshot.
            await session.killEngine(state);
            // eslint-disable-next-line no-unsafe-finally
            throw new Error(`could not put the working build back after a temporary load: ${errorMessage(error)}`);
          }
        }
        return result;
      },
      noteSaved(relPath: string, fp: Fingerprint): void {
        check();
        const loaded = session.loadedValue;
        if (!loaded) return;
        const rel = relPath.replace(/\\/g, "/");
        const repointed = loaded.path !== rel;
        session.loadedValue = {
          ...loaded,
          ...(repointed ? { path: rel, displayName: path.posix.basename(rel).replace(/\.xml$/i, "") } : {}),
          fingerprint: fp,
          savedRevision: session.revisionValue,
        };
      },
      async fingerprint(relPath: string): Promise<Fingerprint | null> {
        check();
        const file = await session.readFingerprinted(relPath.replace(/\\/g, "/"));
        return file ? file.fingerprint : null;
      },
      async stopEngine(): Promise<{ discardedFrom: string | null }> {
        check();
        if (state.kind !== "lifecycle") throw new Error("stopEngine is only available to lua_stop (rule L)");
        const discardedFrom = session.isDirty() ? (session.lastMutatingTool ?? "an earlier call") : null;
        await session.client().stop();
        session.engineRunning = false;
        session.crashed = false;
        session.loadedValue = null;
        session.snapshot = null;
        session.interrupted = null;
        session.revisionValue += 1;
        return { discardedFrom };
      },
    };
  }
}

export function createEngineSession(opts: EngineSessionOptions): EngineSession {
  return new Session(opts);
}
