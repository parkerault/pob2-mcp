/**
 * Engine session (C-3), unit tests with a fake bridge client: the FIFO lock (AC-E19) and the load
 * guard's scoping. No engine runs here; the fake answers `export_build_xml` so step 6 can snapshot.
 */
import { describe, it, expect } from '@jest/globals';
import {
  createEngineSession,
  EngineBusyError,
  type EngineSession,
  type SessionClient,
} from '../../src/engine/session';
import { sessionScopedEngine } from '../../src/utils/contextBuilder';

function fakeClient(): SessionClient & { requests: string[]; starts: number } {
  let alive = false;
  const client = {
    requests: [] as string[],
    starts: 0,
    async start() {
      client.starts++;
      alive = true;
    },
    async stop() {
      alive = false;
    },
    isAlive: () => alive,
    pid: () => (alive ? 4242 : null),
    async request(action: string) {
      client.requests.push(action);
      if (action === 'export_build_xml') return { id: 1, ok: true, xml: '<PathOfBuilding2/>' };
      return { id: 1, ok: true };
    },
  };
  return client;
}

function makeSession(): { session: EngineSession; client: ReturnType<typeof fakeClient> } {
  const client = fakeClient();
  const session = createEngineSession({
    env: {},
    spawn: (() => {
      throw new Error('the fake session never spawns');
    }) as never,
    pobDirectory: '/nonexistent-builds',
    createClient: () => client,
  });
  return { session, client };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('AC-E19: the engine lock is a FIFO mutex per tool call (C-3 step 1)', () => {
  it('AC-E19: a mutate call issued at t=10 ms starts only after a 300 ms read call completes', async () => {
    const { session } = makeSession();
    const log: string[] = [];
    const a = session.run({ tool: 'A', kind: 'read' }, async () => {
      log.push('A start');
      await sleep(300);
      log.push('A end');
      return 'a';
    });
    await sleep(10);
    const b = session.run({ tool: 'B', kind: 'mutate' }, async () => {
      log.push('B start');
      return 'b';
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.value).toBe('a');
    expect(rb.value).toBe('b');
    expect(log).toEqual(['A start', 'A end', 'B start']);
  });

  it('AC-E19: the onEvent log shows each call queued, then start → end without overlap', async () => {
    const { session } = makeSession();
    const events: string[] = [];
    session.onEvent((e) => {
      if (e.phase === 'queued' || e.phase === 'start' || e.phase === 'end') events.push(`${e.tool}:${e.phase}`);
    });
    const a = session.run({ tool: 'A', kind: 'read' }, () => sleep(50));
    const b = session.run({ tool: 'B', kind: 'mutate' }, () => sleep(5));
    await Promise.all([a, b]);
    expect(events.filter((e) => e.endsWith(':queued')).sort()).toEqual(['A:queued', 'B:queued']);
    expect(events.filter((e) => !e.endsWith(':queued'))).toEqual(['A:start', 'A:end', 'B:start', 'B:end']);
  });

  it('AC-E19: a call whose signal aborts while it waits for the lock rejects with AbortError and never runs', async () => {
    const { session } = makeSession();
    const holder = session.run({ tool: 'A', kind: 'read' }, () => sleep(200));
    const controller = new AbortController();
    let ran = false;
    const waiting = session.run({ tool: 'B', kind: 'mutate', signal: controller.signal }, async () => {
      ran = true;
    });
    setTimeout(() => controller.abort(), 20);
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    await holder;
    // A later call still gets the lock: the aborted waiter left the queue.
    await expect(session.run({ tool: 'C', kind: 'read' }, async () => 'c')).resolves.toMatchObject({ value: 'c' });
    expect(ran).toBe(false);
  });

  it('AC-E19: a call whose deadline passes while it waits rejects with EngineBusyError and never runs', async () => {
    const { session } = makeSession();
    const holder = session.run({ tool: 'A', kind: 'read' }, () => sleep(200));
    let ran = false;
    const waiting = session.run({ tool: 'find_upgrades', kind: 'read', deadline: Date.now() + 50 }, async () => {
      ran = true;
    });
    await expect(waiting).rejects.toBeInstanceOf(EngineBusyError);
    await holder;
    expect(ran).toBe(false);
  });
});

describe('C-3: revision bookkeeping and the load guard with a fake client', () => {
  it('a mutate call bumps revision and snapshots; a read call changes nothing; a failure leaves revision alone', async () => {
    const { session, client } = makeSession();
    await session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => undefined);
    expect(session.revision).toBe(0);
    expect(session.loaded).toMatchObject({ path: null, displayName: 'New build' });
    await session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    expect(session.revision).toBe(1);
    expect(session.isDirty()).toBe(true);
    expect(client.requests.filter((r) => r === 'export_build_xml')).toHaveLength(1);
    await expect(
      session.run({ tool: 'set_gem_level', kind: 'mutate' }, async () => {
        throw new Error('no gem 99');
      }),
    ).rejects.toThrow('no gem 99');
    expect(session.revision).toBe(1);
  });

  it('ctx.client rejects load_build_xml and new_build ("engine load outside the session")', async () => {
    const { session } = makeSession();
    await expect(
      session.run({ tool: 'probe', kind: 'read' }, (ctx) => ctx.client.request('load_build_xml', { xml: '<x/>', name: 'x' })),
    ).rejects.toThrow('engine load outside the session');
    await expect(session.run({ tool: 'probe', kind: 'read' }, (ctx) => ctx.client.request('new_build', {}))).rejects.toThrow(
      'engine load outside the session',
    );
  });

  it('getLuaClient()/ensureLuaClient() resolve to ctx.client inside a run and throw outside one', async () => {
    const { session } = makeSession();
    const access = sessionScopedEngine(session);
    expect(() => access.getLuaClient()).toThrow('engine access outside a session');
    await expect(access.ensureLuaClient()).rejects.toThrow('engine access outside a session');
    await session.run({ tool: 'probe', kind: 'read' }, async (ctx) => {
      expect(access.getLuaClient()).toBe(ctx.client);
      await expect(access.ensureLuaClient()).resolves.toBeUndefined();
    });
    expect(() => access.getLuaClient()).toThrow('engine access outside a session');
  });

  it('only the session starts the engine: ctx.client.start() is refused', async () => {
    const { session, client } = makeSession();
    await expect(session.run({ tool: 'probe', kind: 'read' }, (ctx) => ctx.client.start())).rejects.toThrow(/only the session starts/);
    expect(client.starts).toBe(1);
  });
});
