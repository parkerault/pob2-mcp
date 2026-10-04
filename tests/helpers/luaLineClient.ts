/**
 * A minimal line client for the engine wire protocol (C-2), used by the "Lua-direct" tests.
 *
 * It spawns luajit with the vendored `pob-api/bootstrap.lua` (cwd = the pinned PoB `src/`), exactly as
 * the bridge does, but none of the bridge's logic is involved: it writes raw request lines to stdin
 * and hands back every stdout line in order, so tests see what the Lua side really sends.
 *
 * The child's env is the (globalSetup-scrubbed) `process.env` minus the cookie variables, plus
 * LUA_PATH/LUA_CPATH, plus `POB_API_TEST_ACTIONS=1` unless `testActions: false`.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import path from 'path';
import { resolvePobApiDir, resolvePobSrc } from '../../src/engine/pobPath';

export type Json = Record<string, any>;

export interface LuaLineClient {
  /** The first stdout line, verbatim. */
  readonly firstLine: string;
  /** The first stdout line, parsed. */
  readonly banner: Json;
  readonly pid: number | undefined;
  /** Write one raw line (a newline is appended). */
  writeLine(line: string): void;
  /** Write a request object as one line. */
  send(message: Json): void;
  /** The next stdout line, parsed as JSON. Rejects on timeout or if the engine exits first. */
  next(timeoutMs?: number): Promise<Json>;
  /** Send `{id, action, params}` (id auto-assigned from 1000 unless given) and read the next line. */
  request(action: string, params?: Json, opts?: { id?: number; timeoutMs?: number }): Promise<Json>;
  /** The engine's stderr so far. */
  stderr(): string;
  /** Resolves when the engine exits. */
  readonly exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  /** End stdin; SIGKILL if still running after `graceMs`. */
  close(graceMs?: number): Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

const COOKIES = ['POESESSID', 'POE_SESSION_ID'];
const BANNER_TIMEOUT_MS = 60_000;

/** The env the bridge gives the engine (LUA_PATH/LUA_CPATH as in `src/pobLuaBridge.ts`). */
export function luaEnv(testActions: boolean): Record<string, string> {
  const pobSrc = resolvePobSrc(process.env);
  const apiDir = resolvePobApiDir();
  const baseDir = pobSrc.endsWith(`${path.sep}src`) ? pobSrc.slice(0, -4) : pobSrc;
  const runtimeDir = path.join(baseDir, 'runtime');
  const runtimeLua = path.join(runtimeDir, 'lua');
  const luaRocks = path.join(os.homedir(), '.luarocks', 'lib', 'lua', '5.1');
  const merged: Record<string, string | undefined> = { ...process.env };
  for (const k of COOKIES) delete merged[k];
  delete merged.POB_API_TEST_ACTIONS;
  merged.LUA_PATH = [
    `${apiDir}/?.lua`, `${apiDir}/?/init.lua`, `${runtimeLua}/?.lua`, `${runtimeLua}/?/init.lua`, '',
  ].join(';') + ';';
  merged.LUA_CPATH = [`${runtimeDir}/?.so`, `${luaRocks}/?.so`, ''].join(';') + ';';
  if (testActions) merged.POB_API_TEST_ACTIONS = '1';
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) if (v !== undefined) env[k] = v;
  return env;
}

export async function startLuaLineClient(opts: { testActions?: boolean } = {}): Promise<LuaLineClient> {
  const testActions = opts.testActions ?? true;
  const child: ChildProcessWithoutNullStreams = spawn(
    process.env.POB_CMD || 'luajit',
    [path.join(resolvePobApiDir(), 'bootstrap.lua')],
    { cwd: resolvePobSrc(process.env), env: luaEnv(testActions), stdio: ['pipe', 'pipe', 'pipe'] },
  );
  child.stdin.on('error', () => undefined);

  let stderr = '';
  let buffer = '';
  const lines: string[] = [];
  const waiters: Array<() => void> = [];
  let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null;
  const wake = () => {
    for (const w of waiters.splice(0)) w();
  };

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      lines.push(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
    wake();
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('exit', (code, signal) => {
      exitInfo = { code, signal };
      wake();
      resolve(exitInfo);
    });
  });
  child.once('error', (error) => {
    stderr += `\n[spawn error] ${error.message}`;
    exitInfo = exitInfo ?? { code: null, signal: null };
    wake();
  });

  const nextLine = (timeoutMs: number): Promise<string> =>
    new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        const i = waiters.indexOf(check);
        if (i >= 0) waiters.splice(i, 1);
        reject(new Error(`no stdout line within ${timeoutMs} ms; stderr tail:\n${stderr.slice(-2000)}`));
      }, timeoutMs);
      function check() {
        if (lines.length > 0) {
          clearTimeout(deadline);
          resolve(lines.shift()!);
        } else if (exitInfo) {
          clearTimeout(deadline);
          reject(new Error(`engine exited (${JSON.stringify(exitInfo)}); stderr tail:\n${stderr.slice(-2000)}`));
        } else {
          waiters.push(check);
        }
      }
      check();
    });

  let firstLine: string;
  try {
    firstLine = await nextLine(BANNER_TIMEOUT_MS);
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }

  let nextId = 1000;
  const client: LuaLineClient = {
    firstLine,
    banner: JSON.parse(firstLine) as Json,
    pid: child.pid,
    writeLine(line) {
      child.stdin.write(`${line}\n`);
    },
    send(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    },
    async next(timeoutMs = 60_000) {
      const line = await nextLine(timeoutMs);
      try {
        return JSON.parse(line) as Json;
      } catch {
        throw new Error(`stdout line is not JSON: ${line}`);
      }
    },
    async request(action, params, o = {}) {
      const id = o.id ?? nextId++;
      client.send(params === undefined ? { id, action } : { id, action, params });
      return client.next(o.timeoutMs);
    },
    stderr: () => stderr,
    exited,
    async close(graceMs = 5000) {
      if (exitInfo) return exitInfo;
      child.stdin.end();
      const timer = setTimeout(() => child.kill('SIGKILL'), graceMs);
      const info = await exited;
      clearTimeout(timer);
      return info;
    },
  };
  return client;
}
