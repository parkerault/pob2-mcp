/**
 * Engine session (C-3), unit tests with a fake bridge client: the FIFO lock (AC-E19) and the load
 * guard's scoping. No engine runs here; the fake answers `export_build_xml` so step 6 can snapshot.
 */
import { describe, it, expect } from '@jest/globals';
import {
  createEngineSession,
  droppedSupportNotices,
  EngineBusyError,
  EngineDeadlineError,
  noticesOf,
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

/**
 * A fake engine that can crash (exit outside `stop()`), refuse a start, and fail chosen actions. Each
 * start gets a new pid; requests to a dead engine reject, as the bridge does.
 */
function crashableClient() {
  let alive = false;
  let nextPid = 100;
  let pid: number | null = null;
  const client = {
    requests: [] as Array<{ action: string; params?: Record<string, unknown> }>,
    starts: 0,
    /** Starts with these numbers (1-based) reject. */
    failStarts: new Set<number>(),
    /** Actions that reject while set. */
    failActions: new Set<string>(),
    /** Called on each request after it is logged; may crash the engine or throw. */
    onRequest: null as null | ((action: string) => void),
    xml: '<PathOfBuilding2><Build level="1"/></PathOfBuilding2>',
    /** How long a start takes. */
    startDelayMs: 0,
    starting: null as Promise<void> | null,
    /** Single-flight while starting, as the bridge's start is. */
    start(): Promise<void> {
      if (client.starting) return client.starting;
      const attempt = (async () => {
        const n = ++client.starts;
        if (client.startDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, client.startDelayMs));
        if (client.failStarts.has(n)) throw new Error(`start ${n} failed`);
        alive = true;
        pid = nextPid++;
      })();
      client.starting = attempt;
      const clear = () => {
        if (client.starting === attempt) client.starting = null;
      };
      attempt.then(clear, clear);
      return attempt;
    },
    async stop() {
      alive = false;
      pid = null;
    },
    crash() {
      alive = false;
      pid = null;
    },
    isAlive: () => alive,
    pid: () => pid,
    async request(action: string, params?: Record<string, unknown>) {
      client.requests.push({ action, params });
      if (!alive) throw new Error('the engine is not running');
      client.onRequest?.(action);
      if (!alive) throw new Error('the engine exited while handling the request');
      if (client.failActions.has(action)) throw new Error(`${action} failed`);
      if (action === 'load_build_xml') client.xml = String(params?.xml);
      if (action === 'new_build') client.xml = '<PathOfBuilding2><Build level="1"/></PathOfBuilding2>';
      if (action === 'export_build_xml') return { id: 1, ok: true, xml: client.xml };
      return { id: 1, ok: true };
    },
  };
  return client;
}

function makeCrashableSession() {
  const client = crashableClient();
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

const RESTORE_FAILED_TEXT = 'Engine restarted; the loaded build could not be restored. Load it again.';

describe('C-3 step 3: a failed restore whose restart also fails still takes the no-snapshot path (D-8)', () => {
  it('the next read call after the failed restart is isError RESTORE_FAILED, never a silent "New build"', async () => {
    const { session, client } = makeCrashableSession();
    await session.run({ tool: 'lua_load_build', kind: 'load' }, (ctx) => ctx.loadXml('<PathOfBuilding2 a="1"/>', { displayName: 'mine' }));
    await session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    expect(session.revision).toBe(2);
    client.crash();

    // Start #2 (the recovery start) works; the snapshot restore fails; start #3 (the restart after the
    // failed restore) fails, so the call's start error propagates.
    client.failActions.add('load_build_xml');
    client.failStarts.add(3);
    let ran = false;
    await expect(
      session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => {
        ran = true;
      }),
    ).rejects.toThrow('start 3 failed');
    expect(ran).toBe(false);
    client.failActions.delete('load_build_xml');

    // The crash is not forgotten: the next read call is refused with the no-restorable-state error.
    await expect(
      session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => {
        ran = true;
      }),
    ).rejects.toThrow(RESTORE_FAILED_TEXT);
    expect(ran).toBe(false);
    expect(session.loaded).toMatchObject({ path: null, displayName: 'New build' });
    expect(session.revision).toBe(2);

    // The crash is handled now: the call after that runs normally, without a notice.
    const after = await session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => 'ok');
    expect(after).toEqual({ value: 'ok', notices: [] });
  });

  it('a mutate call after the failed restart is refused the same way; a load call proceeds with the notice', async () => {
    const { session, client } = makeCrashableSession();
    await session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    client.crash();
    client.failActions.add('load_build_xml');
    client.failStarts.add(3);
    await expect(session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => undefined)).rejects.toThrow('start 3 failed');
    client.failActions.delete('load_build_xml');
    await expect(session.run({ tool: 'set_gem_level', kind: 'mutate' }, async () => undefined)).rejects.toThrow(RESTORE_FAILED_TEXT);

    // Same set-up, then a load call: it proceeds, with the text as a notice.
    const second = makeCrashableSession();
    await second.session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    second.client.crash();
    second.client.failActions.add('load_build_xml');
    second.client.failStarts.add(3);
    await expect(second.session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => undefined)).rejects.toThrow();
    second.client.failActions.delete('load_build_xml');
    const loaded = await second.session.run({ tool: 'lua_load_build', kind: 'load' }, (ctx) =>
      ctx.loadXml('<PathOfBuilding2 b="1"/>', { displayName: 'other' }),
    );
    expect(loaded.notices).toEqual([RESTORE_FAILED_TEXT]);
    expect(second.session.loaded).toMatchObject({ displayName: 'other' });
  });
});

describe('C-3 step 7: an engine crash inside withTemporaryBuild is a crash, not a deliberate kill', () => {
  it('the error keeps the cause and gets the "engine stopped" suffix; the next call names the interrupted tool', async () => {
    const { session, client } = makeCrashableSession();
    await session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    const revision = session.revision;

    const failure = session.run({ tool: 'analyze_build', kind: 'read' }, (ctx) =>
      ctx.withTemporaryBuild('<PathOfBuilding2 temp="1"/>', async () => {
        client.onRequest = (action) => {
          if (action === 'calc_with') client.crash();
        };
        return ctx.client.request('calc_with', {});
      }),
    );
    await expect(failure).rejects.toThrow('the engine exited while handling the request');
    await expect(failure).rejects.toThrow(
      ' (The engine stopped while running `analyze_build`; the next engine call restores the last state.)',
    );
    expect(session.revision).toBe(revision);
    client.onRequest = null;

    const next = await session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => 'ok');
    expect(next.notices).toEqual([
      'Engine restarted; restored the build to its state after `set_character_level`. The interrupted call `analyze_build` was not applied.',
    ]);
    // The restore loaded the working build's snapshot, not the temporary one.
    expect(client.xml).not.toContain('temp="1"');
  });

  it('a live engine that refuses the reload is still killed on purpose (no interrupted marker)', async () => {
    const { session, client } = makeCrashableSession();
    await session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    let loads = 0;
    client.onRequest = (action) => {
      if (action === 'load_build_xml' && ++loads === 2) throw new Error('reload refused');
    };
    await expect(
      session.run({ tool: 'analyze_build', kind: 'read' }, (ctx) => ctx.withTemporaryBuild('<PathOfBuilding2 temp="1"/>', async () => 'v')),
    ).rejects.toThrow('could not put the working build back after a temporary load: reload refused');
    client.onRequest = null;
    const next = await session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => 'ok');
    expect(next.notices).toEqual(['Engine restarted; restored the build to its state after `set_character_level`.']);
  });
});

describe('C-3: a load that succeeded inside a call that then failed is still counted and snapshotted', () => {
  it('revision +1, loadedRevision/savedRevision follow, and a crash restores the new build, not the old one', async () => {
    const { session, client } = makeCrashableSession();
    await session.run({ tool: 'lua_load_build', kind: 'load' }, (ctx) => ctx.loadXml('<PathOfBuilding2 old="1"/>', { displayName: 'old' }));
    await session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    expect(session.revision).toBe(2);
    expect(session.isDirty()).toBe(true);

    await expect(
      session.run({ tool: 'import_build', kind: 'load' }, async (ctx) => {
        await ctx.loadXml('<PathOfBuilding2 new="1"/>', { displayName: 'Imported build' });
        throw new Error('post-load work failed');
      }),
    ).rejects.toThrow('post-load work failed');
    expect(session.revision).toBe(3);
    expect(session.loaded).toMatchObject({ displayName: 'Imported build', loadedRevision: 3, savedRevision: 3 });
    expect(session.isDirty()).toBe(false);

    client.crash();
    const next = await session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => 'ok');
    expect(next.notices).toEqual(['Engine restarted; restored the build to its state after `import_build`.']);
    expect(client.xml).toBe('<PathOfBuilding2 new="1"/>');
  });

  it('a failed snapshot after such a load is discarded with the step-6 warning on the failed call', async () => {
    const { session, client } = makeCrashableSession();
    await session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    let notices: string[] = [];
    try {
      await session.run({ tool: 'import_build', kind: 'load' }, async (ctx) => {
        await ctx.loadXml('<PathOfBuilding2 new="1"/>', { displayName: 'Imported build' });
        client.failActions.add('export_build_xml');
        throw new Error('post-load work failed');
      });
    } catch (error) {
      notices = noticesOf(error);
    }
    client.failActions.delete('export_build_xml');
    expect(notices).toEqual(['Warning: could not snapshot the engine state; a crash now would lose the last change.']);
    expect(session.revision).toBe(2);
    client.crash();
    await expect(session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => undefined)).rejects.toThrow(RESTORE_FAILED_TEXT);
  });

  it('a load that itself fails leaves revision and loaded unchanged', async () => {
    const { session, client } = makeCrashableSession();
    await session.run({ tool: 'lua_load_build', kind: 'load' }, (ctx) => ctx.loadXml('<PathOfBuilding2 old="1"/>', { displayName: 'old' }));
    client.failActions.add('load_build_xml');
    await expect(
      session.run({ tool: 'import_build', kind: 'load' }, (ctx) => ctx.loadXml('<PathOfBuilding2 new="1"/>', { displayName: 'Imported build' })),
    ).rejects.toThrow('load_build_xml failed');
    expect(session.revision).toBe(1);
    expect(session.loaded).toMatchObject({ displayName: 'old', loadedRevision: 1 });
  });
});

describe('D-22 (NFR-4): a call deadline bounds the session\'s own steps, not only the lock wait (C-3 steps 2–3)', () => {
  it('an engine start that outlasts the deadline rejects with EngineDeadlineError before it; the next call joins no second start and restores', async () => {
    const { session, client } = makeCrashableSession();
    await session.run({ tool: 'lua_load_build', kind: 'load' }, (ctx) => ctx.loadXml('<PathOfBuilding2 a="1"/>', { displayName: 'mine' }));
    await session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    client.crash();
    client.startDelayMs = 1_500;

    const t0 = Date.now(); // the session's clock (its deadline is on it)
    const m0 = performance.now(); // elapsed time: monotonic
    let ran = false;
    const cut = session.run({ tool: 'find_upgrades', kind: 'read', deadline: t0 + 1_200 }, async () => {
      ran = true;
    });
    await expect(cut).rejects.toBeInstanceOf(EngineDeadlineError);
    await expect(cut).rejects.toThrow('while the engine was starting');
    expect(performance.now() - m0).toBeLessThan(1_200);
    expect(ran).toBe(false);
    expect(client.starts).toBe(2);

    // The abandoned start completes in the background; the next call accounts for it and restores.
    await sleep(700);
    expect(client.isAlive()).toBe(true);
    const next = await session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => 'ok');
    expect(next.value).toBe('ok');
    expect(next.notices).toEqual(['Engine restarted; restored the build to its state after `set_character_level`.']);
    expect(client.starts).toBe(2);
    const restore = client.requests.filter((r) => r.action === 'load_build_xml').pop();
    expect(restore?.params).toMatchObject({ xml: '<PathOfBuilding2 a="1"/>', name: 'mine', keepLevel: true });
  });

  it('with < 1 s left, no start is attempted; a call without a deadline then starts and restores', async () => {
    const { session, client } = makeCrashableSession();
    await session.run({ tool: 'set_character_level', kind: 'mutate' }, async () => undefined);
    client.crash();
    await expect(session.run({ tool: 'find_upgrades', kind: 'read', deadline: Date.now() + 500 }, async () => undefined)).rejects.toBeInstanceOf(
      EngineDeadlineError,
    );
    expect(client.starts).toBe(1);
    const next = await session.run({ tool: 'lua_get_build_info', kind: 'read' }, async () => 'ok');
    expect(next.notices).toEqual(['Engine restarted; restored the build to its state after `set_character_level`.']);
    expect(client.starts).toBe(2);
  });
});

describe('D-398: droppedSupportNotices', () => {
  it('gives one line per group: the gems, the group, and the passive (with its node) or the item that grants it', () => {
    const reply = {
      ok: true,
      result: {
        name: 'x',
        droppedSupports: [
          { group: 'Navira', source: 'Tree:32705', grantedBy: 'Navira', gems: ['Muster', 'Bidding II'] },
          { group: 'Purity of Ice', source: 'Item:4:Probe Sceptre', grantedBy: 'Probe Sceptre', gems: ['Clarity I'] },
          { group: 'Unnamed', source: 'Tree:123', gems: ['Heft'] },
        ],
      },
    };
    const tail = ": PoB rebuilds a granted skill's group from its grant on every calculation, so no figure includes them.";
    expect(droppedSupportNotices(reply)).toEqual([
      `Warning: PoB dropped Muster, Bidding II from the group "Navira", granted by the passive Navira (node 32705)${tail}`,
      `Warning: PoB dropped Clarity I from the group "Purity of Ice", granted by the item Probe Sceptre${tail}`,
      `Warning: PoB dropped Heft from the group "Unnamed", granted by the passive node 123${tail}`,
    ]);
  });

  it('gives nothing for [], a reply without the field, or a malformed entry', () => {
    expect(droppedSupportNotices({ ok: true, result: { name: 'x', droppedSupports: [] } })).toEqual([]);
    expect(droppedSupportNotices({ ok: true, result: { name: 'x' } })).toEqual([]);
    expect(droppedSupportNotices(undefined)).toEqual([]);
    expect(droppedSupportNotices({ result: { droppedSupports: [{ group: 'g', source: 'Tree:1', gems: [] }, 'x'] } })).toEqual([]);
  });
});
