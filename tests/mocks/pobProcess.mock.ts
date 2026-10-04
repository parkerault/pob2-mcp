/**
 * A mock engine process speaking the wire protocol v2 (C-2), for bridge-client unit tests (C-4).
 *
 * - It prints the banner (`{ok, ready, version:{number, apiVersion:"2.0.0", ...}}`, no id) on the next
 *   tick, unless told otherwise.
 * - Each request line `{id, action, params}` is recorded and, unless the action is held, answered on
 *   the next tick with `{id, ...response}`. Failures carry a `code` (FAILED when the canned response
 *   has none). `quit` replies and exits 0.
 * - Exit emits `exit` and then `close`, like a real child process.
 *
 * `createMockSpawn()` is a `jest.fn` spawn replacement for the client's injected `spawn` (C-7), and
 * `makeFakeCheckout()` builds a temp PoB checkout that passes `checkPin` (C-6) for a test pin, so
 * `start()` runs its real pin check without the vendored checkout.
 */
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';
import { MOCK_RESPONSES, MOCK_ERROR_RESPONSES } from './responses.mock.js';
import { manifestSha1, type PobPin } from '../../src/engine/pinCheck.js';

export type Json = Record<string, any>;
export interface MockRequest {
  id: number;
  action: string;
  params?: Json;
}

export const MOCK_POB_VERSION = '0.23.1';

export function defaultBanner(overrides: { number?: string; apiVersion?: string } = {}): Json {
  return {
    ok: true,
    ready: true,
    version: {
      number: overrides.number ?? MOCK_POB_VERSION,
      branch: '?',
      platform: '?',
      apiVersion: overrides.apiVersion ?? '2.0.0',
    },
  };
}

export interface MockProcessOptions {
  /** The banner to print; `null` prints none. Default: `defaultBanner()`. */
  banner?: Json | null;
  /** Emit `error` with this code instead of starting (e.g. `ENOENT`: the command does not exist). */
  spawnErrorCode?: string;
}

type Responder = Json | ((req: MockRequest) => Json);

let nextPid = 40_000;

/** Mock PoB Lua process that simulates stdio communication (protocol v2). */
export class MockPoBProcess extends EventEmitter {
  public stdout = new MockStream();
  public stderr = new MockStream();
  public stdin = new MockStream();
  public pid: number | undefined;
  public killed = false;
  public killSignal: string | null = null;
  public exitCode: number | null = null;
  public hasExited = false;

  private responses: Map<string, Responder>;
  private held = new Set<string>();
  private hung = false;
  private requests: MockRequest[] = [];

  constructor(opts: MockProcessOptions = {}) {
    super();
    this.responses = MockPoBProcess.defaultResponses();
    this.stdin.write = (data: string) => {
      this.write(data);
      return true;
    };
    if (opts.spawnErrorCode) {
      this.pid = undefined;
      const err = Object.assign(new Error(`spawn luajit ${opts.spawnErrorCode}`), {
        code: opts.spawnErrorCode,
        errno: -2,
        syscall: 'spawn luajit',
      });
      process.nextTick(() => this.emit('error', err));
      return;
    }
    this.pid = nextPid++;
    const banner = opts.banner === undefined ? defaultBanner() : opts.banner;
    if (banner !== null) process.nextTick(() => this.sendLine(JSON.stringify(banner)));
  }

  private static defaultResponses(): Map<string, Responder> {
    const map = new Map<string, Responder>(Object.entries(MOCK_RESPONSES));
    map.delete('ready');
    map.set('ping', { ok: true, pong: true });
    return map;
  }

  /** stdin from the client: one or more request lines. */
  write(data: string) {
    for (const line of data.split('\n')) {
      if (!line.trim()) continue;
      let request: MockRequest;
      try {
        request = JSON.parse(line);
      } catch {
        continue;
      }
      this.requests.push(request);
      if (this.hung || this.held.has(request.action)) continue;
      process.nextTick(() => this.processRequest(request));
    }
  }

  private processRequest(request: MockRequest) {
    if (this.hasExited) return;
    // Like pob-api/API/Server.lua: reply to quit, then exit.
    if (request.action === 'quit') {
      this.reply(request.id, { ok: true, quit: true });
      process.nextTick(() => this.exit(0));
      return;
    }
    const canned = this.responses.get(request.action);
    if (canned === undefined) {
      this.reply(request.id, { ok: false, code: 'UNKNOWN_ACTION', error: `unknown action: ${request.action}` });
      return;
    }
    this.reply(request.id, typeof canned === 'function' ? canned(request) : canned);
  }

  /** Write `{id, ...body}` to stdout (a failure without a code gets `FAILED`, as Server.lua does). */
  reply(id: number, body: Json) {
    const out: Json = { id, ...body };
    if (out.ok === false && out.code === undefined) out.code = 'FAILED';
    this.sendLine(JSON.stringify(out));
  }

  /** Write one raw stdout line. */
  sendLine(line: string) {
    if (this.hasExited) return;
    this.stdout.emit('data', line + '\n');
  }

  /** Write one raw stderr line. */
  sendStderr(line: string) {
    this.stderr.emit('data', line + '\n');
  }

  /** Register a custom response for an action (an object, or a function of the request). */
  registerResponse(action: string, response: Responder) {
    this.responses.set(action, response);
  }

  /** Register an error response */
  registerError(action: string, errorKey: keyof typeof MOCK_ERROR_RESPONSES) {
    this.responses.set(action, MOCK_ERROR_RESPONSES[errorKey]);
  }

  /** Don't answer this action; the test answers with `reply(id, ...)`. */
  hold(action: string) {
    this.held.add(action);
  }

  /** Simulate hanging (never respond to anything). */
  simulateHang() {
    this.hung = true;
  }

  /** Exit: `exit`, then `close` (stdio drained). */
  exit(code: number | null = 0, signal: string | null = null) {
    if (this.hasExited) return;
    this.hasExited = true;
    this.exitCode = code;
    this.emit('exit', code, signal);
    this.emit('close', code, signal);
  }

  /** Simulate process crash */
  crash(code = 1) {
    this.exit(code);
  }

  /** Simulate a kill: the process dies of the signal on the next tick. */
  kill(signal: string = 'SIGTERM') {
    if (this.hasExited) return false;
    this.killed = true;
    this.killSignal = signal;
    process.nextTick(() => this.exit(null, signal));
    return true;
  }

  getLastRequest(): MockRequest | undefined {
    return this.requests[this.requests.length - 1];
  }

  getAllRequests(): MockRequest[] {
    return [...this.requests];
  }

  clearRequests() {
    this.requests = [];
  }
}

/** Mock stream that implements minimal EventEmitter interface */
class MockStream extends EventEmitter {
  setEncoding(_enc: string) {
    return this;
  }

  write(_data: string): boolean {
    return true;
  }
}

export type MockSpawn = jest.Mock<(cmd: string, args: string[], options: Json) => MockPoBProcess> & {
  getLastProcess: () => MockPoBProcess | null;
  processes: MockPoBProcess[];
  /** Options for the process the next spawn creates (consumed in order). */
  queue: (opts: MockProcessOptions) => void;
};

/** A spawn replacement creating `MockPoBProcess`es. */
export function createMockSpawn(defaults: MockProcessOptions = {}): MockSpawn {
  const processes: MockPoBProcess[] = [];
  const queued: MockProcessOptions[] = [];
  const mockSpawn = jest.fn((_cmd: string, _args: string[], _options: Json) => {
    const proc = new MockPoBProcess(queued.shift() ?? defaults);
    processes.push(proc);
    return proc;
  }) as MockSpawn;
  mockSpawn.getLastProcess = () => processes[processes.length - 1] ?? null;
  mockSpawn.processes = processes;
  mockSpawn.queue = (opts) => {
    queued.push(opts);
  };
  return mockSpawn;
}

export interface FakeCheckout {
  root: string;
  pobSrc: string;
  pobApiDir: string;
  pin: PobPin;
}

/**
 * A temp PoB checkout that passes `checkPin` for the returned pin: a manifest with the pin's version
 * and no files, no `.git`, and a `src/HeadlessWrapper.lua` whose sha1 is the pin's.
 */
export function makeFakeCheckout(version = MOCK_POB_VERSION): FakeCheckout {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mock-checkout-'));
  const pobSrc = path.join(root, 'src');
  fs.mkdirSync(pobSrc);
  const wrapper = Buffer.from('-- mock HeadlessWrapper.lua\n');
  fs.writeFileSync(path.join(pobSrc, 'HeadlessWrapper.lua'), wrapper);
  fs.writeFileSync(
    path.join(root, 'manifest.xml'),
    `<?xml version='1.0' encoding='UTF-8'?>\n<PoBVersion>\n\t<Version number="${version}" />\n</PoBVersion>\n`,
  );
  return {
    root,
    pobSrc,
    pobApiDir: path.join(root, 'pob-api'),
    pin: {
      repo: 'mock/PathOfBuilding-PoE2',
      tag: `v${version}`,
      commit: '0'.repeat(40),
      version,
      headlessWrapperSha1: manifestSha1(wrapper),
    },
  };
}
