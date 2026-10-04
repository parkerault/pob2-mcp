/**
 * Bridge client v2 (C-4), unit class: the client against a mock engine process speaking C-2, injected
 * through the client's `spawn` option. The pin check (C-6) is real, against a temp checkout built for a
 * test pin (`makeFakeCheckout`).
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { z } from 'zod';
import {
  MockPoBProcess,
  createMockSpawn,
  defaultBanner,
  makeFakeCheckout,
  type FakeCheckout,
  type MockSpawn,
} from '../mocks/pobProcess.mock.js';
import { SAMPLE_BUILD_XML, SAMPLE_ITEMS } from '../mocks/responses.mock.js';
import {
  PoBLuaApiClient,
  EngineActionError,
  EngineContractError,
  EngineExitedError,
  EnginePinError,
  EngineTimeoutError,
} from '../../src/pobLuaBridge.js';
import { baseReply, replySchemas } from '../../src/engine/schemas.js';
import { PIN_HINT } from '../../src/engine/pinCheck.js';

type Env = Record<string, string | undefined>;

let checkout: FakeCheckout;
let mockSpawn: MockSpawn;
let client: PoBLuaApiClient;
let errorSpy: jest.SpiedFunction<typeof console.error>;

function newClient(env: Env = {}): PoBLuaApiClient {
  client = new PoBLuaApiClient({
    env,
    spawn: mockSpawn as unknown as typeof import('child_process').spawn,
    pobSrc: checkout.pobSrc,
    pobApiDir: checkout.pobApiDir,
    pin: checkout.pin,
  });
  return client;
}

async function startedClient(env: Env = {}): Promise<{ client: PoBLuaApiClient; proc: MockPoBProcess }> {
  const c = newClient(env);
  await c.start();
  return { client: c, proc: mockSpawn.getLastProcess()! };
}

/** Let pending nextTick/microtask work run. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Wait until start() has spawned its process (the pin check before it reads files). */
async function spawned(): Promise<MockPoBProcess> {
  const deadline = Date.now() + 10_000;
  while (mockSpawn.processes.length === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  if (mockSpawn.processes.length === 0) throw new Error('start() did not spawn within 10 s');
  return mockSpawn.getLastProcess()!;
}

beforeEach(() => {
  checkout = makeFakeCheckout();
  mockSpawn = createMockSpawn();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  jest.useRealTimers();
  await client?.stop();
  errorSpy.mockRestore();
});

describe('request ids and the pending map (C-4)', () => {
  it('AC-E7: request() ids increase by one per call, out-of-order replies resolve their own promises, and an unknown id is dropped and logged', async () => {
    const { client, proc } = await startedClient();
    proc.hold('get_build_info');
    // start() sent the readiness ping as id 1 (AC-E23); the next requests continue the sequence.
    expect(proc.getAllRequests().map((r) => r.id)).toEqual([1]);

    const settled: number[] = [];
    const calls = [0, 1, 2].map((n) =>
      client.request('get_build_info', { n }).then((reply) => {
        settled.push(n);
        return reply;
      }),
    );
    const sent = proc.getAllRequests().slice(1);
    expect(sent.map((r) => r.id)).toEqual([2, 3, 4]);
    expect(sent.map((r) => r.params)).toEqual([{ n: 0 }, { n: 1 }, { n: 2 }]);

    // An unknown id: dropped, logged, nothing resolves.
    proc.reply(99, { ok: true, info: { tag: 'stray' } });
    await flush();
    expect(settled).toEqual([]);
    expect(errorSpy.mock.calls.map((c) => c.join(' ')).join('\n')).toMatch(/unknown id 99/);

    // Out of order: third, first, second.
    const [a, b, c] = sent;
    proc.reply(c.id, { ok: true, info: { tag: 'third' } });
    proc.reply(a.id, { ok: true, info: { tag: 'first' } });
    proc.reply(b.id, { ok: true, info: { tag: 'second' } });
    const replies = await Promise.all(calls);
    expect(replies.map((r) => (r.info as { tag: string }).tag)).toEqual(['first', 'second', 'third']);
    expect(replies.map((r) => r.id)).toEqual([2, 3, 4]);
    expect(settled).toEqual([2, 0, 1]);
  });

  it('a request on a client that was never started rejects with EngineExitedError and spawns nothing (D-59)', async () => {
    newClient();
    await expect(client.request('ping')).rejects.toBeInstanceOf(EngineExitedError);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('a request after the engine exited rejects with EngineExitedError and never respawns (D-59)', async () => {
    const { client, proc } = await startedClient();
    proc.hold('get_stats');
    const pending = client.request('get_stats');
    proc.crash(3);
    await expect(pending).rejects.toThrow(EngineExitedError);
    await expect(pending).rejects.toThrow(/code 3/);
    await expect(client.request('ping')).rejects.toBeInstanceOf(EngineExitedError);
    expect(client.isAlive()).toBe(false);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it('an ok:false reply rejects EngineActionError with the action, code and engine error', async () => {
    const { client, proc } = await startedClient();
    proc.registerResponse('load_build_xml', { ok: false, code: 'LOAD_FAILED', error: 'empty XML' });
    const err = await client.request('load_build_xml', { xml: '', name: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(EngineActionError);
    expect(err).toMatchObject({ action: 'load_build_xml', code: 'LOAD_FAILED', error: 'empty XML', message: 'empty XML' });
    expect(client.isAlive()).toBe(true);
  });

  it('an aborted signal rejects the request', async () => {
    const { client, proc } = await startedClient();
    proc.hold('get_stats');
    const controller = new AbortController();
    const pending = client.request('get_stats', {}, { signal: controller.signal });
    controller.abort(new Error('caller gave up'));
    await expect(pending).rejects.toThrow('caller gave up');
  });
});

describe('write-anchored timeouts (C-4)', () => {
  const realTicks = { doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] as const };

  it('AC-E9: with timeoutMs 1000, a reply at 900 ms after 5 non-JSON noise lines (200 ms apart) resolves', async () => {
    const { client, proc } = await startedClient();
    proc.hold('get_stats');
    jest.useFakeTimers({ doNotFake: [...realTicks.doNotFake] });

    const pending = client.request('get_stats', {}, { timeoutMs: 1000 });
    const { id } = proc.getLastRequest()!;
    for (let i = 0; i < 5; i++) {
      if (i > 0) jest.advanceTimersByTime(200); // noise at 0, 200, 400, 600, 800 ms
      proc.sendLine(`LOADING noise line ${i}`);
    }
    jest.advanceTimersByTime(100); // 900 ms after the write
    proc.reply(id, { ok: true, stats: { Life: 1 } });
    await expect(pending).resolves.toMatchObject({ id, ok: true, stats: { Life: 1 } });
    expect(proc.killed).toBe(false);
  });

  it('AC-E9: a reply at 1100 ms rejects EngineTimeoutError even though noise lines kept arriving every 200 ms', async () => {
    const { client, proc } = await startedClient();
    proc.hold('get_stats');
    jest.useFakeTimers({ doNotFake: [...realTicks.doNotFake] });

    const pending = client.request('get_stats', {}, { timeoutMs: 1000 });
    const outcome = pending.then(
      () => 'resolved',
      (e) => e,
    );
    const { id } = proc.getLastRequest()!;
    for (let i = 1; i <= 5; i++) {
      jest.advanceTimersByTime(200); // noise at 200 … 1000 ms: a per-line timer would never fire
      proc.sendLine(`LOADING noise line ${i}`);
    }
    jest.advanceTimersByTime(100); // 1100 ms
    proc.reply(id, { ok: true, stats: { Life: 1 } });

    const err = await outcome;
    expect(err).toBeInstanceOf(EngineTimeoutError);
    expect(err).toMatchObject({ action: 'get_stats', ms: 1000 });
    // The timeout kills the engine.
    expect(proc.killed).toBe(true);
    expect(proc.killSignal).toBe('SIGKILL');
  });

  it('a timeout fails every other pending request with EngineExitedError', async () => {
    const { client, proc } = await startedClient();
    proc.hold('get_stats');
    proc.hold('get_tree');
    const other = client.request('get_tree', {}, { timeoutMs: 60_000 });
    const slow = client.request('get_stats', {}, { timeoutMs: 50 });
    await expect(slow).rejects.toBeInstanceOf(EngineTimeoutError);
    await expect(other).rejects.toBeInstanceOf(EngineExitedError);
    expect(client.isAlive()).toBe(false);
  });

  it('the default timeout comes from POB_TIMEOUT_MS', async () => {
    const { client, proc } = await startedClient({ POB_TIMEOUT_MS: '40' });
    proc.hold('get_stats');
    const err = await client.request('get_stats').catch((e) => e);
    expect(err).toBeInstanceOf(EngineTimeoutError);
    expect(err.ms).toBe(40);
  });
});

describe('start() (C-4)', () => {
  it('AC-E10: three concurrent start() calls on a cold client spawn once and all resolve', async () => {
    newClient();
    const starts = [client.start(), client.start(), client.start()];
    await expect(Promise.all(starts)).resolves.toEqual([undefined, undefined, undefined]);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(client.isAlive()).toBe(true);
  });

  it('AC-E10: after a rejected start (spawn emits ENOENT), a later start() spawns again', async () => {
    newClient();
    mockSpawn.queue({ spawnErrorCode: 'ENOENT' });
    await expect(client.start()).rejects.toThrow();
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    await expect(client.start()).resolves.toBeUndefined();
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(client.isAlive()).toBe(true);
  });

  it('AC-E11: the env given to spawn has neither cookie variable, and has LUA_PATH and LUA_CPATH', async () => {
    await startedClient({ POESESSID: 'S1', POE_SESSION_ID: 'S2', POB_EXAMPLE: 'kept' });
    const options = mockSpawn.mock.calls[0][2] as { env: Env };
    expect(options.env).not.toHaveProperty('POESESSID');
    expect(options.env).not.toHaveProperty('POE_SESSION_ID');
    expect(Object.values(options.env)).not.toContain('S1');
    expect(Object.values(options.env)).not.toContain('S2');
    expect(options.env.LUA_PATH).toEqual(expect.any(String));
    expect(options.env.LUA_CPATH).toEqual(expect.any(String));
    expect(options.env.POB_EXAMPLE).toBe('kept');
  });

  it('AC-E12: spawn emitting ENOENT rejects start() with "luajit not found" and a mise hint', async () => {
    newClient();
    mockSpawn.queue({ spawnErrorCode: 'ENOENT' });
    const err = await client.start().catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('luajit not found');
    expect(err.message).toContain('mise');
  });

  it('an engine that exits before the banner rejects with its exit code and stderr tail', async () => {
    newClient();
    mockSpawn.queue({ banner: null });
    const starting = client.start();
    const proc = await spawned();
    proc.sendStderr('lua: cannot open bootstrap.lua');
    proc.exit(2);
    await expect(starting).rejects.toThrow(/engine exited during startup \(code 2, signal null\): lua: cannot open bootstrap\.lua/);
  });

  it('AC-E14: a banner with apiVersion 1.0.0 rejects start() with "bridge protocol mismatch"', async () => {
    newClient();
    mockSpawn.queue({ banner: defaultBanner({ apiVersion: '1.0.0' }) });
    await expect(client.start()).rejects.toThrow(/bridge protocol mismatch/);
    expect(client.isAlive()).toBe(false);
    // The half-started engine is not left behind.
    expect(mockSpawn.getLastProcess()!.killed).toBe(true);
  });

  it('AC-E14: a banner with PoB version 0.23.2 rejects start() with the pin hint', async () => {
    newClient();
    mockSpawn.queue({ banner: defaultBanner({ number: '0.23.2' }) });
    const err = await client.start().catch((e) => e);
    expect(err).toBeInstanceOf(EnginePinError);
    expect(err.message).toContain('0.23.2');
    expect(err.message).toContain(PIN_HINT);
    expect(err.hint).toBe(PIN_HINT);
  });

  it('AC-E14: the same banner with POB_ALLOW_UNPINNED=true starts, with a warning logged', async () => {
    newClient({ POB_ALLOW_UNPINNED: 'true' });
    mockSpawn.queue({ banner: defaultBanner({ number: '0.23.2' }) });
    await expect(client.start()).resolves.toBeUndefined();
    expect(client.isAlive()).toBe(true);
    const logged = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toMatch(/POB_ALLOW_UNPINNED=true.*0\.23\.2/);
  });

  it('a checkout that fails the pin check rejects with EnginePinError before spawning', async () => {
    checkout = makeFakeCheckout('0.23.0');
    client = new PoBLuaApiClient({
      env: {},
      spawn: mockSpawn as unknown as typeof import('child_process').spawn,
      pobSrc: checkout.pobSrc,
      pobApiDir: checkout.pobApiDir,
      pin: { ...checkout.pin, version: '0.23.1' },
    });
    const err = await client.start().catch((e) => e);
    expect(err).toBeInstanceOf(EnginePinError);
    expect(err.message).toContain('mise run pob:fetch');
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('AC-E23: during start() the client sends ping and nothing else (no load_build_xml)', async () => {
    const { proc } = await startedClient();
    const actions = proc.getAllRequests().map((r) => r.action);
    expect(actions).toEqual(['ping']);
    expect(actions).not.toContain('load_build_xml');
  });

  it('spawns POB_CMD/POB_ARGS when set, else luajit with the vendored bootstrap, in the PoB src dir', async () => {
    await startedClient();
    expect(mockSpawn).toHaveBeenLastCalledWith(
      'luajit',
      [expect.stringMatching(/pob-api[\\/]bootstrap\.lua$/)],
      expect.objectContaining({
        cwd: checkout.pobSrc,
        env: expect.objectContaining({ LUA_PATH: expect.stringContaining('pob-api') }),
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
    await client.stop();

    newClient({ POB_CMD: '/opt/luajit', POB_ARGS: '/tmp/other.lua' });
    await client.start();
    expect(mockSpawn).toHaveBeenLastCalledWith('/opt/luajit', ['/tmp/other.lua'], expect.anything());
  });

  it('separates LUA_PATH/LUA_CPATH entries with ";" on every platform', async () => {
    // Lua's package.path syntax uses ';' everywhere (it is not the OS PATH separator);
    // a ':'-joined value is read as one bogus template and `require("xml")` fails.
    await startedClient();
    const { env } = mockSpawn.mock.calls[0][2] as { env: Env };
    for (const v of [env.LUA_PATH!, env.LUA_CPATH!]) {
      expect(v.endsWith(';;')).toBe(true); // ';;' appends Lua's default search path
      for (const entry of v.split(';').filter(Boolean)) {
        expect(entry.split('?').length).toBe(2); // exactly one '?' template per entry
      }
    }
  });

  it('skips non-JSON lines before the banner', async () => {
    newClient();
    mockSpawn.queue({ banner: null });
    const starting = client.start();
    const proc = await spawned();
    proc.sendLine('Loading modules...');
    proc.sendLine('Initializing...');
    proc.sendLine(JSON.stringify(defaultBanner()));
    await expect(starting).resolves.toBeUndefined();
  });

  it('start() on a running client is a no-op', async () => {
    await startedClient();
    await client.start();
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it('pid() is the running engine pid, and null once it is gone', async () => {
    const { client, proc } = await startedClient();
    expect(client.pid()).toBe(proc.pid);
    proc.crash();
    await flush();
    expect(client.pid()).toBeNull();
  });
});

describe('reply validation (C-5 hook)', () => {
  it('AC-E13: a reply failing the registered ping schema rejects EngineContractError naming ping and the issue path pong; the engine stays alive; an action without a schema passes through', async () => {
    expect(replySchemas.get_stats).toBeUndefined();
    const original = replySchemas.ping;
    replySchemas.ping = baseReply.extend({ pong: z.literal(true) });
    try {
      const { client, proc } = await startedClient(); // the readiness ping replies pong:true
      proc.registerResponse('ping', { ok: true, pong: false });

      const err = await client.request('ping').catch((e) => e);
      expect(err).toBeInstanceOf(EngineContractError);
      expect(err.action).toBe('ping');
      expect(err.issues.map((i: { path: (string | number)[] }) => i.path)).toEqual([['pong']]);
      expect(err.message).toContain('ping');
      expect(err.message).toContain('pong');
      expect(client.isAlive()).toBe(true);
      expect(proc.killed).toBe(false);

      // No schema for get_stats: the reply passes through as sent, extra fields included.
      proc.registerResponse('get_stats', { ok: true, stats: { Life: 7 }, unexpected: ['x'] });
      await expect(client.request('get_stats')).resolves.toEqual({
        id: expect.any(Number),
        ok: true,
        stats: { Life: 7 },
        unexpected: ['x'],
      });
    } finally {
      if (original) replySchemas.ping = original;
      else delete replySchemas.ping;
    }
  });

  it('a schema-valid reply resolves with the parsed value', async () => {
    const original = replySchemas.ping;
    replySchemas.ping = baseReply.extend({ pong: z.literal(true) });
    try {
      const { client } = await startedClient();
      await expect(client.request('ping')).resolves.toMatchObject({ ok: true, pong: true });
    } finally {
      if (original) replySchemas.ping = original;
      else delete replySchemas.ping;
    }
  });

  it('test actions pass through unvalidated', async () => {
    const { client, proc } = await startedClient();
    proc.registerResponse('__test_state', { ok: true, result: { popups: 0 } });
    await expect(client.request('__test_state')).resolves.toMatchObject({ ok: true, result: { popups: 0 } });
  });
});

describe('typed wrappers over request()', () => {
  let proc: MockPoBProcess;

  beforeEach(async () => {
    ({ proc } = await startedClient());
  });

  it('ping resolves true', async () => {
    await expect(client.ping()).resolves.toBe(true);
    expect(proc.getLastRequest()).toEqual({ id: expect.any(Number), action: 'ping', params: {} });
  });

  it('loadBuildXml sends xml and name', async () => {
    await client.loadBuildXml(SAMPLE_BUILD_XML);
    expect(proc.getLastRequest()).toMatchObject({
      action: 'load_build_xml',
      params: { xml: SAMPLE_BUILD_XML, name: 'API Build' },
    });
    await client.loadBuildXml(SAMPLE_BUILD_XML, 'Custom Name');
    expect(proc.getLastRequest()?.params?.name).toBe('Custom Name');
  });

  it('wrappers throw the engine error on ok:false', async () => {
    proc.registerError('load_build_xml', 'invalid_xml');
    await expect(client.loadBuildXml('<invalid>')).rejects.toThrow('Failed to parse XML');
    proc.registerError('get_stats', 'build_not_initialized');
    await expect(client.getStats()).rejects.toThrow('build not initialized');
  });

  it('getStats returns the stats and forwards fields', async () => {
    const stats = await client.getStats(['Life', 'TotalDPS']);
    expect(stats.Life).toBe(5000);
    expect(proc.getLastRequest()?.params).toEqual({ fields: ['Life', 'TotalDPS'] });
  });

  it('getTree / setTree', async () => {
    const tree = await client.getTree();
    expect(tree).toMatchObject({ classId: 2, ascendClassId: 1 });
    await client.setTree({ classId: 2, ascendClassId: 1, nodes: [1, 2, 3] });
    expect(proc.getLastRequest()).toMatchObject({
      action: 'set_tree',
      params: { classId: 2, ascendClassId: 1, nodes: [1, 2, 3] },
    });
  });

  it('item and skill wrappers', async () => {
    const items = await client.getItems();
    expect(items.find((i) => i.slot === 'Weapon 1')?.name).toBe('Death Bow');
    const added = await client.addItem(SAMPLE_ITEMS.weapon, 'Weapon 2', true);
    expect(added).toMatchObject({ id: 123, name: 'Steel Blade' });
    expect(proc.getLastRequest()?.params).toEqual({ text: SAMPLE_ITEMS.weapon, slotName: 'Weapon 2', noAutoEquip: true });
    await client.setFlaskActive(3, false);
    expect(proc.getLastRequest()).toMatchObject({ action: 'set_flask_active', params: { index: 3, active: false } });
    const skills = await client.getSkills();
    expect(skills.groups[0].label).toBe('Main 6L');
    await client.setMainSelection({ mainSocketGroup: 1, mainActiveSkill: 2, skillPart: 3 });
    expect(proc.getLastRequest()?.params).toEqual({ mainSocketGroup: 1, mainActiveSkill: 2, skillPart: 3 });
  });
});

describe('stop() (C-4)', () => {
  it('sends quit and lets the engine exit on its own', async () => {
    const { client, proc } = await startedClient();
    await client.stop();
    expect(proc.getLastRequest()).toMatchObject({ action: 'quit' });
    expect(proc.exitCode).toBe(0);
    expect(proc.killed).toBe(false);
    expect(client.isAlive()).toBe(false);
  });

  it('SIGKILLs an engine that does not exit within the quit grace', async () => {
    const { client, proc } = await startedClient();
    proc.simulateHang();
    await client.stop();
    expect(proc.killed).toBe(true);
    expect(proc.killSignal).toBe('SIGKILL');
  }, 10_000);

  it('is safe when not started, and when called twice', async () => {
    newClient();
    await expect(client.stop()).resolves.toBeUndefined();
    await client.start();
    await client.stop();
    await expect(client.stop()).resolves.toBeUndefined();
  });
});
