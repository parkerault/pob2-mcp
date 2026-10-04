/**
 * Bridge client v2 (C-4), engine-required: the real client against real luajit and the pinned PoB
 * checkout, with a `spawn` spy (the real `spawn`, counted).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { afterAll, beforeAll, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import {
  PoBLuaApiClient,
  EngineExitedError,
  EngineTimeoutError,
} from '../../src/pobLuaBridge';
import { resolvePobApiDir, resolvePobSrc } from '../../src/engine/pobPath';
import { readPin } from '../../src/engine/pinCheck';

type Env = Record<string, string | undefined>;

function makeClient(env: Env, spawnFn: typeof spawn = spawn): PoBLuaApiClient {
  return new PoBLuaApiClient({
    env,
    spawn: spawnFn,
    pobSrc: resolvePobSrc(process.env),
    pobApiDir: resolvePobApiDir(),
    pin: readPin(),
  });
}

/** The process state letter from /proc/<pid>/stat, or null when the process is gone. */
function procState(pid: number): string | null {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0];
  } catch {
    return null;
  }
}

async function waitUntil(cond: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return cond();
}

engineDescribe('bridge client v2 against the real engine (C-4)', () => {
  let tmp: string;
  const clients: PoBLuaApiClient[] = [];

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-bridge-client-'));
  });

  afterAll(async () => {
    for (const c of clients) await c.stop().catch(() => undefined);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('AC-E8: cold start answers ping within 5 s; a timeout kills the engine; requests then fail without respawning; start() brings back a clean engine', async () => {
    const spawnSpy = jest.fn(spawn);
    const client = makeClient({ ...process.env, POB_API_TEST_ACTIONS: '1' }, spawnSpy as unknown as typeof spawn);
    clients.push(client);

    // 1. The readiness ping (the last step of start()) answers ≤ 5 s after start() was called.
    const t0 = Date.now();
    await client.start();
    expect(Date.now() - t0).toBeLessThanOrEqual(5000);
    expect(spawnSpy).toHaveBeenCalledTimes(1);

    // 2. A request that outlives its timeout rejects 400–900 ms after the write, and the engine is killed.
    const oldPid = client.pid();
    expect(oldPid).toEqual(expect.any(Number));
    const tWrite = Date.now();
    const err = await client.request('__test_sleep', { ms: 3000 }, { timeoutMs: 500 }).catch((e) => e);
    const elapsed = Date.now() - tWrite;
    expect(err).toBeInstanceOf(EngineTimeoutError);
    expect(elapsed).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThanOrEqual(900);
    const gone = await waitUntil(() => {
      const state = procState(oldPid!);
      return state === null || state === 'Z';
    }, 1000);
    expect(gone).toBe(true);

    // 3. The next request rejects EngineExitedError; nothing was respawned.
    await expect(client.request('ping')).rejects.toBeInstanceOf(EngineExitedError);
    expect(spawnSpy).toHaveBeenCalledTimes(1);

    // 4. start() brings up a new engine; ping answers pong:true and never sees the late sleep reply.
    await client.start();
    expect(spawnSpy).toHaveBeenCalledTimes(2);
    expect(client.pid()).not.toBe(oldPid);
    const first = await client.request('ping');
    expect(first).toEqual({ id: expect.any(Number), ok: true, pong: true });
    // Past the moment the killed engine's sleep would have finished.
    const wait = 3200 - (Date.now() - tWrite);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const second = await client.request('ping');
    expect(second).toEqual({ id: first.id + 1, ok: true, pong: true });
  }, 30_000);

  it('AC-E12: a real luajit run whose POB_ARGS script writes to stderr and exits 2 rejects start() with "code 2" and that stderr text', async () => {
    const script = path.join(tmp, 'exit2.lua');
    fs.writeFileSync(script, 'io.stderr:write("bridge-probe: deliberate startup failure\\n")\nos.exit(2)\n');
    const client = makeClient({ ...process.env, POB_ARGS: script });
    clients.push(client);
    const err = await client.start().catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('code 2');
    expect(err.message).toContain('bridge-probe: deliberate startup failure');
    expect(client.isAlive()).toBe(false);
  }, 30_000);
});
