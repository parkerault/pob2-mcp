/**
 * `find_upgrades` input checks and deadline bounds across the engine seam (C-14 step 1, D-22, D-75,
 * NFR-4), through the MCP tool: the real SDK `Client`, router, handler, engine session and engine (real
 * luajit, the pinned PoB, the golden build), every trade2 and poe.ninja request served by a
 * `fixtureFetch` from the committed fixtures.
 *
 * - `report_stats` is checked by the engine when the query is generated, before any request: a bad name
 *   is an `isError` naming the field, and no request is sent.
 * - Query generation cut by the deadline ends by abort, without killing the engine.
 * - The deadline also bounds the session's own steps (engine start, the restore after a crash, the
 *   disk-change reload): a cut step leaves the session's books for the next call.
 *
 * Clock: only `Date` is faked (timers run in real time). A case moves the fake clock close to the call's
 * 90 s deadline at the session's `start` event (the lock is taken), so the remaining real time is short.
 *
 * AC-K75 (WU-118, D-461), the last block: a server with the trade search pace on, its sleep a jump of the
 * fake clock, so the 45 s gap costs no real time. A call arriving 0.5 s after another call's search makes
 * one search, 45 s after that one, and its output carries the gap's stop line. AC-K79 (D-474): each reply's pace
 * line, just before the search link, or last in a stop with no link.
 */
import path from 'path';
import { afterAll, afterEach, beforeAll, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { goldenWithLevel, killEngine, startSessionFixture, writeBuild, type SessionFixture } from '../helpers/engineSession';
import { fixtureFetch, type FixtureRoute } from '../helpers/fixtureFetch';
import { DATA_ROUTES, fetchRoute, readTrade2, searchResponse, searchSequence, type SyntheticResponse } from '../helpers/tradeFixtures';
import type { Credentials } from '../../src/trade/credentials';
import { TRADE_SEARCH_PACE } from '../../src/trade/rateLimiter';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';

const SENTINEL = 'SENTINEL7f3a';
const LEAGUE = 'Forbidden Rites';
const TIMEOUT = 240_000;
const CALL_TIMEOUT_MS = 150_000;
const BUDGET_MS = 90_000;

const NINJA = readTrade2<unknown>('../poeninja/currency-overview.response.json');

/** The logged-in Body Armour search capture: 200, total 2207, 100 ids. */
const SESSION_SEARCH: SyntheticResponse = (() => {
  const meta = readTrade2<{ status: number; headers: Record<string, string> }>('search-weighted-session.headers.json');
  return { status: meta.status, headers: meta.headers, body: readTrade2('search-weighted-session.response.json') };
})();

const FAKE_DATE = {
  doNotFake: [
    'hrtime',
    'nextTick',
    'performance',
    'queueMicrotask',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
    'setImmediate',
    'clearImmediate',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
  ],
  advanceTimers: true,
} as const;

const BUDGET_STOP = /^Error: Stopped early: the 90 s budget ran out before PoB generated the trade query \(the engine was /;

engineDescribe('find_upgrades: report_stats checked before any request; deadline-bound generation and session steps', () => {
  let fx: SessionFixture;
  let http = fixtureFetch([]);
  const creds: Credentials = { sessionId: SENTINEL, source: 'dotenv' };

  function serve(routes: FixtureRoute[]): ReturnType<typeof fixtureFetch> {
    http = fixtureFetch([
      ...routes,
      ...DATA_ROUTES,
      { match: /^https:\/\/poe\.ninja\//, respond: () => new Response(JSON.stringify(NINJA), { status: 200, headers: { 'content-type': 'application/json' } }) },
    ]);
    return http;
  }

  /**
   * One find_upgrades call. With `leftAtStart`, the fake clock jumps to `deadline - leftAtStart` when
   * the session takes the engine lock for it, before its engine start, restore and disk check.
   */
  async function call(args: Record<string, unknown>, leftAtStart?: number) {
    jest.setSystemTime(Date.now() + 4 * 3600_000);
    const t0 = Date.now();
    const off = fx.session.onEvent((e) => {
      if (leftAtStart !== undefined && e.tool === 'find_upgrades' && e.phase === 'start') jest.setSystemTime(t0 + BUDGET_MS - leftAtStart);
    });
    try {
      const result = (await fx.server.client.callTool({ name: 'find_upgrades', arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS })) as {
        isError?: boolean;
        content?: Array<{ type: string; text?: string }>;
      };
      return { isError: result.isError === true, text: (result.content ?? []).map((c) => c.text ?? '').join('\n'), elapsed: Date.now() - t0 };
    } finally {
      off();
    }
  }

  /** Make every `load_build_xml` the session sends wait `ms` in the engine first (`__test_sleep`, same options). */
  function slowLoads(ms: number) {
    const original = PoBLuaApiClient.prototype.request;
    return jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, action, params, opts) {
      if ((action as string) === 'load_build_xml') await original.call(this, '__test_sleep', { ms }, opts);
      return original.call(this, action, params, opts);
    });
  }

  beforeAll(async () => {
    jest.useFakeTimers(FAKE_DATE as unknown as Parameters<typeof jest.useFakeTimers>[0]);
    fx = await startSessionFixture({
      testActions: true,
      deps: {
        fetch: ((input: Parameters<typeof fetch>[0], init?: RequestInit) => http.fetch(input, init)) as typeof fetch,
        credentials: () => creds,
        now: () => Date.now(),
        env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_LEAGUE: LEAGUE },
      },
    });
    const load = await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
    if (load.isError) throw new Error(`loading the golden build failed: ${load.text}`);
  }, TIMEOUT);

  afterAll(async () => {
    if (fx) await fx.close();
    jest.useRealTimers();
  }, 60_000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------------------------------
  // C-14 step 1: report_stats

  it('C-14 step 1 (D-27): an unknown report_stats name is isError naming report_stats.<i>, and no request of any kind is sent', async () => {
    serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
    const out = await call({ slot: 'Body Armour', report_stats: ['Str', 'NoSuchStat'] });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('report_stats.1');
    expect(out.text).toContain('unknown report stat NoSuchStat');
    expect(http.calls).toHaveLength(0);
  }, TIMEOUT);

  it('C-14 step 1: known report_stats (a sort stat and a numeric output stat) pass the check and are reported per listing', async () => {
    serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
    const out = await call({ slot: 'Body Armour', report_stats: ['Life', 'Str'], include_non_upgrades: true, limit: 3 });
    expect(out.isError).toBe(false);
    expect(out.text).toMatch(/^ {3}.* · Str \S+/m);
    expect(http.calls.some((c) => /\/api\/trade2\/search\//.test(c.url))).toBe(true);
  }, TIMEOUT);

  // -------------------------------------------------------------------------------------------------
  // D-75: query generation cut by the deadline

  it('D-75: query generation that outlasts the deadline ends by abort: "while PoB generated the trade query", no crash, within the budget, and the engine keeps running', async () => {
    serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
    const original = PoBLuaApiClient.prototype.tradeGenerateQuery;
    const spy = jest.spyOn(PoBLuaApiClient.prototype, 'tradeGenerateQuery').mockImplementation(async function (this: PoBLuaApiClient, params, opts) {
      // A generation that needs longer than the 4 s left: the engine is busy for 8 s first.
      await this.request('__test_sleep', { ms: 8_000 }, opts);
      return original.call(this, params, opts);
    });
    const pid = fx.session.enginePid();
    expect(pid).not.toBeNull();
    // max_level makes the params (and so the query-cache key) new: the generation really runs.
    const out = await call({ slot: 'Body Armour', max_level: 77 }, 4_000);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(out.isError).toBe(true);
    expect(out.text).toContain('Stopped early: the 90 s budget ran out while PoB generated the trade query.');
    expect(out.text).not.toMatch(/engine stopped while running/);
    expect(out.elapsed).toBeLessThanOrEqual(BUDGET_MS);
    expect(http.calls).toHaveLength(0);
    expect(fx.session.enginePid()).toBe(pid);
    jest.restoreAllMocks();
    const info = await fx.call('lua_get_build_info');
    expect(info.isError).toBe(false);
    expect(info.text).not.toMatch(/Engine restarted/);
    expect(fx.session.enginePid()).toBe(pid);
  }, TIMEOUT);

  // -------------------------------------------------------------------------------------------------
  // D-22, NFR-4: the session's steps 2–4 under the deadline

  it('D-22 (C-3 step 3): a crash restore that outlasts the deadline ends by abort within the budget; the snapshot is kept and the next call restores it', async () => {
    expect((await fx.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect((await fx.call('set_character_level', { level: 50 })).isError).toBe(false);
    await killEngine(fx.session);
    serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
    const spy = slowLoads(20_000);
    const out = await call({ slot: 'Body Armour' }, 10_000);
    expect(out.isError).toBe(true);
    expect(out.text).toMatch(BUDGET_STOP);
    expect(out.text).toContain('restoring the last state after a restart');
    expect(out.elapsed).toBeLessThanOrEqual(BUDGET_MS);
    expect(spy.mock.calls.some((c) => (c[0] as string) === 'load_build_xml')).toBe(true);
    expect(http.calls).toHaveLength(0);
    const pid = fx.session.enginePid();
    expect(pid).not.toBeNull();
    jest.restoreAllMocks();

    const info = await fx.call('lua_get_build_info');
    expect(info.isError).toBe(false);
    expect(info.text.startsWith('Engine restarted; restored the build to its state after `set_character_level`.')).toBe(true);
    expect(info.text).toContain('Level: 50');
    expect(fx.session.enginePid()).toBe(pid);
  }, TIMEOUT);

  it('D-22 (C-3 step 4): a disk-change reload that outlasts the deadline ends by abort within the budget, without killing the engine; the next call reloads', async () => {
    expect((await fx.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    writeBuild(path.join(fx.builds, 'grenadator.xml'), goldenWithLevel(85));
    const pid = fx.session.enginePid();
    serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
    slowLoads(20_000);
    const out = await call({ slot: 'Body Armour' }, 6_000);
    expect(out.isError).toBe(true);
    expect(out.text).toMatch(BUDGET_STOP);
    expect(out.text).toContain('reloading grenadator.xml, which changed on disk');
    expect(out.elapsed).toBeLessThanOrEqual(BUDGET_MS);
    expect(http.calls).toHaveLength(0);
    expect(fx.session.enginePid()).toBe(pid);
    jest.restoreAllMocks();

    const info = await fx.call('lua_get_build_info');
    expect(info.isError).toBe(false);
    expect(info.text.startsWith('Reloaded grenadator.xml: it changed on disk since the engine loaded it.')).toBe(true);
    expect(info.text).toContain('Level: 85');
    expect(fx.session.enginePid()).toBe(pid);
  }, TIMEOUT);

  it('D-22 (C-3 step 2): with < 1 s left when the lock is taken, a stopped engine is not started; the next call starts it and restores', async () => {
    expect((await fx.call('set_character_level', { level: 42 })).isError).toBe(false);
    await killEngine(fx.session);
    serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
    const out = await call({ slot: 'Body Armour' }, 500);
    expect(out.isError).toBe(true);
    expect(out.text).toMatch(BUDGET_STOP);
    expect(out.text).toContain('(the engine was starting)');
    // AC-K79 (D-474): the router's budget stop is a find_upgrades reply too; with no link, the pace line is its last.
    expect(out.text.split('\n').pop()).toBe('Pace: off (test setting).');
    expect(out.elapsed).toBeLessThanOrEqual(BUDGET_MS);
    expect(fx.session.enginePid()).toBeNull();
    expect(http.calls).toHaveLength(0);

    const info = await fx.call('lua_get_build_info');
    expect(info.isError).toBe(false);
    expect(info.text.startsWith('Engine restarted; restored the build to its state after `set_character_level`.')).toBe(true);
    expect(info.text).toContain('Level: 42');
  }, TIMEOUT);
});

engineDescribe('AC-K75 (WU-118, D-461): find_upgrades through the MCP tool under the 45 s gap between searches', () => {
  let fx: SessionFixture;
  let http = fixtureFetch([]);
  const creds: Credentials = { sessionId: SENTINEL, source: 'dotenv' };
  /** When each search reached the trade site, on the fake clock. */
  const searchedAt: number[] = [];
  const timed =
    (r: SyntheticResponse) =>
    (): SyntheticResponse => {
      searchedAt.push(Date.now());
      return r;
    };

  beforeAll(async () => {
    jest.useFakeTimers(FAKE_DATE as unknown as Parameters<typeof jest.useFakeTimers>[0]);
    fx = await startSessionFixture({
      deps: {
        fetch: ((input: Parameters<typeof fetch>[0], init?: RequestInit) => http.fetch(input, init)) as typeof fetch,
        credentials: () => creds,
        now: () => Date.now(),
        // The server's pace, its waits a jump of the fake clock.
        tradePace: TRADE_SEARCH_PACE,
        tradeSleep: async (ms: number) => {
          jest.setSystemTime(Date.now() + ms);
        },
        env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_LEAGUE: LEAGUE },
      },
    });
    const load = await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
    if (load.isError) throw new Error(`loading the golden build failed: ${load.text}`);
  }, TIMEOUT);

  afterAll(async () => {
    if (fx) await fx.close();
    jest.useRealTimers();
  }, 60_000);

  it("AC-K75: a call arriving 0.5 s after another call's search makes 1 search, 45 s after it, returns that search's listings though its count called for narrowing, and prints the gap's stop line", async () => {
    http = fixtureFetch([
      // The other call's search (2,207 matches: it needs no narrowing), then clipped searches at 10,000.
      searchSequence([timed(SESSION_SEARCH), timed(searchResponse('s1', 10000)), timed(searchResponse('s2', 10000))]),
      fetchRoute(),
      ...DATA_ROUTES,
      { match: /^https:\/\/poe\.ninja\//, respond: () => new Response(JSON.stringify(NINJA), { status: 200, headers: { 'content-type': 'application/json' } }) },
    ]);
    jest.setSystemTime(Date.now() + 4 * 3600_000);
    const other = await fx.call('find_upgrades', { slot: 'Body Armour' });
    expect(other.isError).toBe(false);
    expect(searchedAt).toHaveLength(1);

    jest.setSystemTime(searchedAt[0] + 500);
    const arrival = Date.now();
    const out = await fx.call('find_upgrades', { slot: 'Body Armour' });
    expect(out.isError).toBe(false);
    expect(searchedAt).toHaveLength(2);
    const gap = searchedAt[1] - searchedAt[0];
    expect(gap).toBeGreaterThanOrEqual(45_000);
    expect(gap).toBeLessThan(46_000);
    expect(Date.now() - arrival).toBeLessThanOrEqual(BUDGET_MS);
    expect(out.text).toMatch(/^Stopped early: the 45 s gap between trade searches cut the loop short after 1 search\.$/m);
    expect(out.text).toMatch(/^Searches 1 · Matches 10000 · Fetched 20 · /m);
    expect(out.text.split('\n').pop()).toMatch(/^Search on the trade site: https:\/\/www\.pathofexile\.com\/trade2\/search\/poe2\/Forbidden%20Rites\/s1$/);
    // AC-K79 (D-474): the server paces, and its pace line sits just before the search link, which stays last (C-14).
    expect(out.text.split('\n').slice(-2)[0]).toBe('Pace: 45 s between searches, at most 7 in 5 minutes.');
    expect(other.text.split('\n').slice(-2)[0]).toBe('Pace: 45 s between searches, at most 7 in 5 minutes.');
  }, TIMEOUT);
});
