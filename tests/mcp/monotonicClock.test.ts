/**
 * The server's deadlines run on a clock that never steps (D-22, NFR-4; worklog 2026-10-04: the WSL2
 * wall clock stepped backwards by ~2.4 s mid-test). `find_upgrades` through the MCP tool, with the
 * server's default clock (no injected `now`): the real SDK `Client`, router, handler, engine session and
 * engine, every trade2 and poe.ninja request served by a `fixtureFetch` from the committed fixtures.
 *
 * The wall clock (`Date.now`) is stepped while the call holds the engine lock. A deadline step that
 * read the wall clock would be cut at once by a forward step (and stretched by a backward one); on the
 * server's clock (`monotonicNow`, threaded to every deadline check) the call runs to completion either
 * way, and the session's event times never go back. `tests/unit/clock.test.ts` checks the clock itself.
 */
import { afterAll, afterEach, beforeAll, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { fixtureFetch, type FixtureRoute } from '../helpers/fixtureFetch';
import { DATA_ROUTES, fetchRoute, readTrade2, searchSequence, type SyntheticResponse } from '../helpers/tradeFixtures';
import type { Credentials } from '../../src/trade/credentials';
import type { EngineEvent } from '../../src/engine/session';

const SENTINEL = 'SENTINEL7f3a';
const LEAGUE = 'Forbidden Rites';
const TIMEOUT = 240_000;
const CALL_TIMEOUT_MS = 150_000;

const NINJA = readTrade2<unknown>('../poeninja/currency-overview.response.json');

/** The logged-in Body Armour search capture: 200, total 2207, 100 ids. */
const SESSION_SEARCH: SyntheticResponse = (() => {
  const meta = readTrade2<{ status: number; headers: Record<string, string> }>('search-weighted-session.headers.json');
  return { status: meta.status, headers: meta.headers, body: readTrade2('search-weighted-session.response.json') };
})();

engineDescribe('find_upgrades deadlines on the monotonic clock: a wall-clock step mid-call cuts nothing', () => {
  let fx: SessionFixture;
  let http = fixtureFetch([]);
  const creds: Credentials = { sessionId: SENTINEL, source: 'dotenv' };

  function serve(routes: FixtureRoute[]): void {
    http = fixtureFetch([
      ...routes,
      ...DATA_ROUTES,
      { match: /^https:\/\/poe\.ninja\//, respond: () => new Response(JSON.stringify(NINJA), { status: 200, headers: { 'content-type': 'application/json' } }) },
    ]);
  }

  /** One find_upgrades call; the wall clock steps by `stepMs` when the session takes the lock for it. */
  async function callWithStep(stepMs: number): Promise<{ isError: boolean; text: string; events: EngineEvent[] }> {
    const realNow = Date.now.bind(Date);
    const events: EngineEvent[] = [];
    let stepped = false;
    const off = fx.session.onEvent((e) => {
      if (e.tool !== 'find_upgrades') return;
      events.push(e);
      if (e.phase === 'start' && !stepped) {
        stepped = true;
        jest.spyOn(Date, 'now').mockImplementation(() => realNow() + stepMs);
      }
    });
    try {
      const result = (await fx.server.client.callTool({ name: 'find_upgrades', arguments: { slot: 'Body Armour' } }, undefined, {
        timeout: CALL_TIMEOUT_MS,
      })) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
      expect(stepped).toBe(true);
      return { isError: result.isError === true, text: (result.content ?? []).map((c) => c.text ?? '').join('\n'), events };
    } finally {
      off();
      jest.restoreAllMocks();
    }
  }

  beforeAll(async () => {
    fx = await startSessionFixture({
      deps: {
        fetch: ((input: Parameters<typeof fetch>[0], init?: RequestInit) => http.fetch(input, init)) as typeof fetch,
        credentials: () => creds,
        env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_LEAGUE: LEAGUE },
      },
    });
    const load = await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
    if (load.isError) throw new Error(`loading the golden build failed: ${load.text}`);
  }, TIMEOUT);

  afterAll(async () => {
    if (fx) await fx.close();
  }, 60_000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('a wall clock stepping 2 h forward mid-call: the search and evaluation still run, with no budget stop', async () => {
    serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
    const out = await callWithStep(2 * 3600_000);
    expect(out.isError).toBe(false);
    expect(out.text).toContain('=== find_upgrades: Body Armour ===');
    expect(out.text).not.toContain('budget ran out');
    expect(http.calls.some((c) => /\/api\/trade2\/search\//.test(c.url))).toBe(true);
    expect(http.calls.some((c) => /\/api\/trade2\/fetch\//.test(c.url))).toBe(true);
  }, TIMEOUT);

  it('a wall clock stepping 1 h backwards mid-call: the call completes, and the session event times never go back', async () => {
    serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
    const out = await callWithStep(-3600_000);
    expect(out.isError).toBe(false);
    expect(out.text).not.toContain('budget ran out');
    const phases = out.events.map((e) => e.phase);
    expect(phases).toEqual(expect.arrayContaining(['queued', 'start', 'end']));
    for (let k = 1; k < out.events.length; k++) expect(out.events[k].t).toBeGreaterThanOrEqual(out.events[k - 1].t);
  }, TIMEOUT);
});
