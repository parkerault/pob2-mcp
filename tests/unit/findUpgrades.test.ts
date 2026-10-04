/**
 * The `find_upgrades` search pipeline (C-21, WU-17), unit class: the prefit (AC-T29 unit parts),
 * PoB's adjust loop over search totals (AC-T30) and the D-22 bounds (AC-T34).
 *
 * Seams: the real `runUpgradeSearch`, `TradeApiClient` and `RateLimiter`, with HTTP served by
 * `fixtureFetch` (responses synthesized from the trade2 fixtures by `tradeFixtures.ts`) and a fake
 * clock (Jest modern timers drive `Date.now`, the client's timeouts and the limiter's waits). The engine
 * is faked only as the generator: it returns PoB's generated Body Armour query from the logged-in
 * capture (`search-weighted-session.request.json`, spike S-1). AC-T34 (f) uses the real engine session
 * (C-3) over a fake bridge client, to hold the engine lock, and the real router: `find_upgrades` is
 * added to the tool table here until WU-23 wires it (an entry WU-23 adds wins).
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { spawn } from 'child_process';

jest.mock('../../src/server/toolMeta', () => {
  const actual = jest.requireActual<typeof import('../../src/server/toolMeta')>('../../src/server/toolMeta');
  return {
    ...actual,
    TOOL_META: { find_upgrades: { engine: 'read', group: 'trade' }, ...actual.TOOL_META },
    isToolAvailable: (name: string, env: Parameters<typeof actual.isToolAvailable>[1]) =>
      name === 'find_upgrades' || actual.isToolAvailable(name, env),
  };
});
import { RateLimiter } from '../../src/trade/rateLimiter';
import { TradeApiClient } from '../../src/trade/tradeClient';
import type { Credentials } from '../../src/trade/credentials';
import {
  parseFindUpgradesInput,
  runUpgradeSearch,
  stoppedEarlyNote,
  STOP_BUDGET,
  UpgradeSearchError,
  type UpgradeSearchContext,
  type UpgradeSearchResult,
} from '../../src/trade/findUpgrades';
import { routeToolCall, type ToolRouterDependencies } from '../../src/server/toolRouter';
import { estimateComplexity, prefitQuery, weightedFilterCount, type TradeQueryBody } from '../../src/trade/prefit';
import { exactItemUrl, tradeQueryUrl, tradeSearchUrl } from '../../src/trade/links';
import { createEngineSession, type EngineCallContext, type SessionClient } from '../../src/engine/session';
import { fixtureFetch, type FixtureRoute, type RecordedCall } from '../helpers/fixtureFetch';
import {
  DATA_ROUTES,
  FETCH_TEMPLATE,
  GENERATED_BODY_ARMOUR_QUERY,
  SEARCH_HEADERS,
  fetchRoute,
  parseFetchUrl,
  searchResponse,
  searchSequence,
  syntheticIds,
  type SyntheticResponse,
} from '../helpers/tradeFixtures';

const LEAGUE = 'Forbidden Rites';
const SESSION = (): Credentials => ({ sessionId: 'SENTINEL7f3a', source: 'dotenv' });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** PoB's `trade_generate_query` reply for the golden build's Body Armour (the fake engine's answer). */
const GENERATED = {
  query: GENERATED_BODY_ARMOUR_QUERY,
  rankedWeights: [],
  minWeight: 82.122948670824,
  itemCategory: 'armour.chest',
  statWeights: [
    { stat: 'FullDPS', label: 'Full DPS', weight: 1 },
    { stat: 'TotalEHP', label: 'Effective Hit Pool', weight: 0.5 },
  ],
  baselineScore: 1.5,
  meta: { calcCount: 80, ms: 2500 },
};
const FIRST_MIN = 82.122948670824;
/** The first `fetch-weighted-session` listing's "Sum: 142.2". */
const FIRST_SUM = 142.2;

function fakeEngine() {
  const generate = jest.fn(async (_params: unknown, _opts?: unknown) => clone(GENERATED));
  return { engine: { client: { tradeGenerateQuery: generate } } as unknown as EngineCallContext, generate };
}

/** Every request with the fake time it was sent at. */
type TimedCall = RecordedCall & { at: number };

function setup(
  routes: FixtureRoute[],
  opts: { deadlineInMs?: number; credentials?: () => Credentials; env?: Record<string, string> } = {},
) {
  const ff = fixtureFetch([...routes, ...DATA_ROUTES]);
  const calls: TimedCall[] = [];
  const timedFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const before = ff.calls.length;
    const p = ff.fetch(input, init);
    if (ff.calls.length > before) calls.push({ ...ff.calls[ff.calls.length - 1], at: Date.now() });
    return p;
  }) as typeof fetch;
  const credentials = opts.credentials ?? SESSION;
  const trade = new TradeApiClient({ fetch: timedFetch, credentials, limiter: new RateLimiter(), userAgent: 'pob2-mcp-server/test' });
  const { engine, generate } = fakeEngine();
  const start = Date.now();
  const progress: string[] = [];
  const ctx: UpgradeSearchContext = {
    engine,
    trade,
    credentials,
    env: opts.env ?? {},
    signal: new AbortController().signal,
    deadline: start + (opts.deadlineInMs ?? 90_000),
    progress: async (m) => {
      progress.push(m);
    },
    session: { revision: 0 },
  };
  return { ctx, calls, generate, progress, start };
}

/** Run a promise to completion under fake timers, advancing the fake clock in small steps. */
async function drive<T>(promise: Promise<T>, limitMs = 400_000): Promise<T> {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  for (let i = 0; i < 20 && !settled; i++) await jest.advanceTimersByTimeAsync(0);
  for (let t = 0; !settled && t < limitMs; t += 50) await jest.advanceTimersByTimeAsync(50);
  return promise;
}

const searches = <C extends RecordedCall>(calls: C[]): C[] => calls.filter((c) => c.method === 'POST' && /\/search\//.test(c.url));
const fetches = <C extends RecordedCall>(calls: C[]): C[] => calls.filter((c) => /\/fetch\//.test(c.url));
const weightMinOf = (c: RecordedCall) => (JSON.parse(c.body as string) as TradeQueryBody).query.stats![0].value!.min as number;

function searched(result: UpgradeSearchResult) {
  if (result.kind !== 'searched') throw new Error(`expected a searched result, got ${JSON.stringify(result)}`);
  return result;
}

const input = (extra: Record<string, unknown> = {}) => parseFindUpgradesInput({ slot: 'Body Armour', league: LEAGUE, fetch_pages: 2, ...extra });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-04T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterEach(() => {
  jest.useRealTimers();
});

// -------------------------------------------------------------------------------------------------

/** The golden build's default Body Armour query: the capture without price, max level, mirrored or required mods. */
function goldenDefaultQuery(): TradeQueryBody {
  const q = clone(GENERATED_BODY_ARMOUR_QUERY) as unknown as TradeQueryBody;
  const filters = q.query.filters as Record<string, unknown>;
  delete filters.trade_filters;
  delete filters.req_filters;
  delete filters.misc_filters;
  q.query.stats![1].filters = [];
  return q;
}

describe('AC-T29 (WU-17, D-23): the complexity prefit (unit parts)', () => {
  it('AC-T29: 33 weighted filters, 0 and filters, a price and a max level estimate 200; prefit sends 32 (estimate 196)', () => {
    const q = clone(GENERATED_BODY_ARMOUR_QUERY) as unknown as TradeQueryBody;
    delete (q.query.filters as Record<string, unknown>).misc_filters; // mirrored items included (D-37)
    q.query.stats![1].filters = [];
    const weights = q.query.stats![0].filters;
    expect(weights).toHaveLength(29);
    for (let i = 0; i < 4; i++) weights.push({ id: `explicit.stat_${9000 + i}`, value: { weight: 0.5 + i } });
    expect(weightedFilterCount(q)).toBe(33);
    expect(estimateComplexity(q)).toBe(200);

    const fit = prefitQuery(q);
    expect(weightedFilterCount(fit.query)).toBe(32);
    expect(fit.dropped).toBe(1);
    expect(fit.estimate).toBe(196);
    expect(estimateComplexity(fit.query)).toBe(196);
    // The dropped filter is the lowest-weight one.
    const lowest = [...weights].sort((a, b) => Math.abs(Number(a.value!.weight)) - Math.abs(Number(b.value!.weight)))[0];
    expect(fit.query.query.stats![0].filters.map((f) => f.id)).not.toContain(lowest.id);
    // The input is not mutated.
    expect(weightedFilterCount(q)).toBe(33);
  });

  it("AC-T29: the golden build's default Body Armour query (29 weighted, no price) is sent unchanged", () => {
    const q = goldenDefaultQuery();
    expect(weightedFilterCount(q)).toBe(29);
    const fit = prefitQuery(q);
    expect(fit.dropped).toBe(0);
    expect(fit.query).toEqual(q);
  });
});

// -------------------------------------------------------------------------------------------------

describe("AC-T30 (WU-17): PoB's adjust loop over search totals (fetch_pages 2, maxFetch 20)", () => {
  /** A search route whose n-th response (1-based search id `s<n>`) has `totals[n-1]` matches. */
  const totalsRoute = (totals: number[]) =>
    searchSequence(totals.map((total, i) => searchResponse(`s${i + 1}`, total)));

  it('AC-T30 (a): totals [5, 50] -> 2 searches; the second min is half the first', async () => {
    const { ctx, calls } = setup([totalsRoute([5, 50]), fetchRoute()]);
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    const s = searches(calls);
    expect(s).toHaveLength(2);
    expect(weightMinOf(s[0])).toBeCloseTo(FIRST_MIN, 9);
    expect(weightMinOf(s[1])).toBeCloseTo(FIRST_MIN / 2, 9);
    expect(result.searches).toBe(2);
    expect(result.total).toBe(50);
    expect(result.entries.map((e) => e.id)).toEqual(syntheticIds('s2', 50).slice(0, 20));
    expect(fetches(calls)).toHaveLength(2);
  });

  it('AC-T30 (b): totals [10000, 500] -> 2 searches; the second min = (first fetched Sum + first min) / 2', async () => {
    const { ctx, calls } = setup([totalsRoute([10000, 500]), fetchRoute()]);
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    const s = searches(calls);
    expect(s).toHaveLength(2);
    expect(FETCH_TEMPLATE[0].item.pseudoMods![0].description).toBe('Sum: 142.2');
    expect(weightMinOf(s[1])).toBeCloseTo((FIRST_SUM + FIRST_MIN) / 2, 9);
    // The clipped search's best 10 were fetched first, under its own search id.
    const f = fetches(calls);
    expect(parseFetchUrl(f[0].url)).toEqual({ ids: syntheticIds('s1', 100).slice(0, 10), queryId: 's1' });
    expect(result.entries.map((e) => e.id)).toEqual(syntheticIds('s2', 100).slice(0, 20));
  });

  it('AC-T30 (c): totals [10000 x5] -> stops at 5 searches', async () => {
    const { ctx, calls } = setup([totalsRoute([10000, 10000, 10000, 10000, 10000, 10000]), fetchRoute()]);
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    expect(searches(calls)).toHaveLength(5);
    expect(result.searches).toBe(5);
    expect(result.entries).toHaveLength(20);
    expect(result.entries.map((e) => e.id)).toEqual(syntheticIds('s5', 100).slice(0, 20));
  });

  it('AC-T30 (d): totals [10000, 8, 8, 8, 8] -> 5 searches, min2 = (Sum1 + min1)/2 then halved; 20 entries from 3 fetches', async () => {
    const { ctx, calls } = setup([totalsRoute([10000, 8, 8, 8, 8]), fetchRoute()]);
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    const s = searches(calls);
    expect(s).toHaveLength(5);
    const mins = s.map(weightMinOf);
    expect(mins[0]).toBeCloseTo(FIRST_MIN, 9);
    expect(mins[1]).toBeCloseTo((FIRST_SUM + FIRST_MIN) / 2, 9);
    expect(mins[2]).toBeCloseTo(mins[1] / 2, 9);
    expect(mins[3]).toBeCloseTo(mins[2] / 2, 9);
    expect(mins[4]).toBeCloseTo(mins[3] / 2, 9);

    const s1 = syntheticIds('s1', 100);
    const s5 = syntheticIds('s5', 8);
    expect(result.entries.map((e) => e.id)).toEqual([...s5, ...s1.slice(0, 10), ...s1.slice(10, 12)]);
    const f = fetches(calls).map((c) => parseFetchUrl(c.url));
    expect(f).toEqual([
      { ids: s1.slice(0, 10), queryId: 's1' },
      { ids: s5, queryId: 's5' },
      { ids: s1.slice(10, 12), queryId: 's1' },
    ]);
  });

  it('AC-T30: never more than 5 searches, whatever the totals', async () => {
    for (const totals of [
      [0, 0, 0, 0, 0, 0, 0],
      [1, 10000, 3, 10000, 2, 10000],
      [10000, 10000, 10000, 10000, 10000, 10000, 10000],
    ]) {
      const { ctx, calls } = setup([totalsRoute(totals), fetchRoute()]);
      const result = searched(await drive(runUpgradeSearch(input(), ctx)));
      expect(searches(calls).length).toBeLessThanOrEqual(5);
      expect(result.searches).toBeLessThanOrEqual(5);
    }
  });
});

// -------------------------------------------------------------------------------------------------

describe('AC-T34 (WU-17, D-22, NFR-4): the deadline, limiter waits and early stops (fake clock)', () => {
  const rule = (policy: string, max: number, period: number, hits = 1, active = 0): Record<string, string> => ({
    'x-rate-limit-policy': policy,
    'x-rate-limit-rules': 'Account',
    'x-rate-limit-account': `${max}:${period}:60`,
    'x-rate-limit-account-state': `${hits}:${period}:${active}`,
  });

  it('AC-T34 (a): a required wait of 40 s on the second search -> stoppedEarly "40 s", without sleeping', async () => {
    // One search per 39 s window (max 2 - margin 1), plus PoB's 1 s guard: the next search is due in 40 s.
    const first: SyntheticResponse = { status: 200, headers: rule('trade-search-request-limit', 2, 39), body: searchResponse('s1', 5).body };
    const { ctx, calls, start } = setup([searchSequence([first, searchResponse('s2', 50)]), fetchRoute()]);
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    expect(result.stoppedEarly).toEqual({ reason: "the trade site's rate limit requires waiting 40 s", waitS: 40 });
    expect(stoppedEarlyNote(result.stoppedEarly!)).toBe("Stopped early: the trade site's rate limit requires waiting 40 s.");
    expect(searches(calls)).toHaveLength(1);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(result.searchUrl).toBe(tradeSearchUrl(LEAGUE, 's1'));
  });

  it('AC-T34 (b): cumulative waits approaching the deadline -> nothing is sent after it, and <= 90 s elapse', async () => {
    // One search per 29 s: searches at 0, 29, 58, 87 s; the fifth would go at 116 s, past the deadline.
    const clipped = (n: number): SyntheticResponse => ({ status: 200, headers: rule('trade-search-request-limit', 1, 28), body: searchResponse(`s${n}`, 10000).body });
    const { ctx, calls, start } = setup([searchSequence([1, 2, 3, 4, 5, 6].map(clipped)), fetchRoute()]);
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    expect(result.stoppedEarly?.reason).toMatch(/rate limit requires waiting/);
    expect(searches(calls).map((c) => c.at - start)).toEqual([0, 29_000, 58_000, 87_000]);
    for (const c of calls) expect(c.at).toBeLessThanOrEqual(ctx.deadline);
    expect(Date.now() - start).toBeLessThanOrEqual(90_000);
    // What was fetched before the stop comes back: the last clipped search's best 10.
    expect(result.entries.map((e) => e.id)).toEqual(syntheticIds('s4', 100).slice(0, 10));
  });

  it('AC-T34 (c): locked_out -> the same early stop', async () => {
    const first: SyntheticResponse = { status: 200, headers: rule('trade-search-request-limit', 3, 5, 1, 45), body: searchResponse('s1', 5).body };
    const { ctx, calls } = setup([searchSequence([first, searchResponse('s2', 50)]), fetchRoute()]);
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    expect(result.stoppedEarly).toEqual({ reason: "the trade site's rate limit requires waiting 45 s", waitS: 45 });
    expect(searches(calls)).toHaveLength(1);
  });

  it('AC-T34 (d): a 429 with Retry-After: 7 on the second search -> stoppedEarly "7 s"', async () => {
    const tooMany: SyntheticResponse = {
      status: 429,
      headers: { ...SEARCH_HEADERS, 'retry-after': '7' },
      body: { error: { code: 3, message: 'Rate limit exceeded' } },
    };
    const { ctx, calls } = setup([searchSequence([searchResponse('s1', 5), tooMany]), fetchRoute()]);
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    expect(result.stoppedEarly).toEqual({ reason: "the trade site's rate limit requires waiting 7 s", waitS: 7 });
    expect(searches(calls)).toHaveLength(2);
    expect(fetches(calls)).toHaveLength(0);
  });

  /** A fetch route that never answers, recording when its request was aborted. */
  function hungFetch() {
    const seen: { sentAt?: number; abortedAt?: number } = {};
    const route: FixtureRoute = {
      match: /\/api\/trade2\/fetch\//,
      respond: (_url, init) => {
        seen.sentAt = Date.now();
        init?.signal?.addEventListener('abort', () => (seen.abortedAt = Date.now()), { once: true });
        return new Promise<Response>(() => undefined);
      },
    };
    return { route, seen };
  }

  it('AC-T34 (e): a hung fetch with 20 s left is aborted within those 20 s, then "budget ran out"', async () => {
    const { route, seen } = hungFetch();
    const { ctx, start } = setup([searchSequence([searchResponse('s1', 2207)]), route], { deadlineInMs: 20_000 });
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    expect(seen.sentAt! - start).toBeLessThan(1000);
    expect(seen.abortedAt).toBeDefined();
    expect(seen.abortedAt! - seen.sentAt!).toBeLessThanOrEqual(20_000);
    expect(result.stoppedEarly).toEqual({ reason: STOP_BUDGET });
    expect(stoppedEarlyNote(result.stoppedEarly!)).toBe('Stopped early: the 90 s budget ran out.');
    expect(Date.now() - start).toBeLessThanOrEqual(20_000);
  });

  it('AC-T34 (e): with less than 15 s left, the hung fetch timeout is clipped to the time left', async () => {
    const { route, seen } = hungFetch();
    const { ctx, start } = setup([searchSequence([searchResponse('s1', 2207)]), route], { deadlineInMs: 10_000 });
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    expect(seen.abortedAt! - start).toBeLessThanOrEqual(10_000);
    expect(seen.abortedAt! - seen.sentAt!).toBeGreaterThan(9_000);
    expect(result.stoppedEarly).toEqual({ reason: STOP_BUDGET });
  });

  it('AC-T34 (f): a deadline that passes while waiting for the engine lock -> the routed tool result "engine was busy"', async () => {
    const client: SessionClient = {
      start: async () => undefined,
      stop: async () => undefined,
      isAlive: () => true,
      pid: () => 4242,
      request: async () => ({ ok: true }),
    };
    const session = createEngineSession({
      env: {},
      spawn: (() => {
        throw new Error('no spawn in this test');
      }) as unknown as typeof spawn,
      pobDirectory: '/nonexistent',
      createClient: () => client,
    });
    let release!: () => void;
    const holder = session.run({ tool: 'lua_get_build_info', kind: 'read' }, () => new Promise<void>((r) => (release = r)));
    await jest.advanceTimersByTimeAsync(0);

    const start = Date.now();
    const deps = { session, env: {}, ensureTradeStats: async () => undefined } as unknown as ToolRouterDependencies;
    const call = routeToolCall('find_upgrades', { slot: 'Body Armour' }, deps, {
      signal: new AbortController().signal,
      sendProgress: async () => undefined,
      arrivedAt: start,
    });
    const result = await drive(call);
    // NFR-4: back within 90 s (+1 s) of arrival, as C-14's early stop: a result, not isError.
    expect(Date.now() - start).toBeGreaterThanOrEqual(90_000);
    expect(Date.now() - start).toBeLessThanOrEqual(91_000);
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;
    expect(text).toContain('=== find_upgrades: Body Armour ===');
    expect(text).toContain('Stopped early: the engine was busy.');
    // Nothing ran: dispatching would have needed the context builder these deps lack (an "Error:" result).
    expect(text).not.toMatch(/^Error:/m);

    release();
    await drive(holder);
  });

  it('AC-T34 (bounds on /data/*): a hung /data/stats with 10 s left is cut at the deadline -> "budget ran out"', async () => {
    const { ctx, calls, start } = setup([{ match: /\/api\/trade2\/data\/stats/, respond: () => new Promise<Response>(() => undefined) }, searchSequence([searchResponse('s1', 2207)]), fetchRoute()], {
      deadlineInMs: 10_000,
    });
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    expect(Date.now() - start).toBeLessThanOrEqual(10_000);
    expect(result.stoppedEarly).toEqual({ reason: STOP_BUDGET });
    expect(stoppedEarlyNote(result.stoppedEarly!)).toBe('Stopped early: the 90 s budget ran out.');
    expect(result.searches).toBe(0);
    expect(result.entries).toEqual([]);
    expect(result.searchUrl).toBe(tradeQueryUrl(LEAGUE, GENERATED_BODY_ARMOUR_QUERY));
    expect(searches(calls)).toHaveLength(0);
  });

  it('AC-T34 (bounds on /data/*): /data/stats does not start with < 1 s left (generation took the rest)', async () => {
    const { ctx, calls, generate, start } = setup([searchSequence([searchResponse('s1', 2207)]), fetchRoute()], { deadlineInMs: 1_600 });
    generate.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 1_000));
      return clone(GENERATED);
    });
    const result = searched(await drive(runUpgradeSearch(input(), ctx)));
    expect(Date.now() - start).toBeLessThanOrEqual(1_600);
    expect(result.stoppedEarly).toEqual({ reason: STOP_BUDGET });
    expect(calls).toEqual([]);
  });

  it('AC-T34 (bounds on /data/*): with ample time, a hung /data/stats times out at 15 s -> "trade stat data unavailable"', async () => {
    const { ctx, calls, start } = setup([{ match: /\/api\/trade2\/data\/stats/, respond: () => new Promise<Response>(() => undefined) }, searchSequence([searchResponse('s1', 2207)]), fetchRoute()]);
    const outcome = await drive(runUpgradeSearch(input(), ctx).then(() => null, (e: unknown) => e));
    expect(outcome).toBeInstanceOf(UpgradeSearchError);
    expect((outcome as Error).message).toMatch(/^trade stat data unavailable/);
    expect(Date.now() - start).toBeLessThanOrEqual(15_000);
    expect(searches(calls)).toHaveLength(0);
  });

  it('AC-T34 (bounds on /data/*): a caller abort during a hung /data/stats ends the call at once', async () => {
    const controller = new AbortController();
    const { ctx, start } = setup([
      {
        match: /\/api\/trade2\/data\/stats/,
        respond: () => {
          setTimeout(() => controller.abort('caller gave up'), 2_000);
          return new Promise<Response>(() => undefined);
        },
      },
      searchSequence([searchResponse('s1', 2207)]),
      fetchRoute(),
    ]);
    const outcome = await drive(runUpgradeSearch(input(), { ...ctx, signal: controller.signal }).then(() => null, (e: unknown) => e));
    expect(outcome).toBe('caller gave up');
    expect(Date.now() - start).toBeLessThan(2_500);
  });

  it('AC-T34 (bounds on /data/*): a hung /data/leagues with 10 s left is cut at the deadline', async () => {
    const { ctx, start } = setup([{ match: /\/api\/trade2\/data\/leagues/, respond: () => new Promise<Response>(() => undefined) }, searchSequence([searchResponse('s1', 2207)]), fetchRoute()], {
      deadlineInMs: 10_000,
    });
    const outcome = await drive(runUpgradeSearch(parseFindUpgradesInput({ slot: 'Body Armour' }), ctx).then(() => null, (e: unknown) => e));
    expect(outcome).toBeInstanceOf(UpgradeSearchError);
    expect((outcome as Error).message).toBe('Stopped early: the 90 s budget ran out before the trade league was resolved.');
    expect(Date.now() - start).toBeLessThanOrEqual(10_000);
  });

  it('AC-T34: the generation request gets min(60 s, the time left) and the abort signal', async () => {
    const { ctx, generate } = setup([searchSequence([searchResponse('s1', 2207)]), fetchRoute()], { deadlineInMs: 30_000 });
    await drive(runUpgradeSearch(input(), ctx));
    const opts = generate.mock.calls[0][1] as { timeoutMs: number; signal: AbortSignal };
    expect(opts.timeoutMs).toBeLessThanOrEqual(30_000);
    expect(opts.timeoutMs).toBeGreaterThan(29_000);
    expect(opts.signal).toBe(ctx.signal);
  });

  it('AC-T34: a caller abort between steps stops the flow with the caller reason', async () => {
    const controller = new AbortController();
    const { ctx, calls } = setup([
      searchSequence([
        () => {
          controller.abort('caller gave up');
          return searchResponse('s1', 5);
        },
      ]),
      fetchRoute(),
    ]);
    const outcome = await drive(runUpgradeSearch(input(), { ...ctx, signal: controller.signal }).then(() => null, (e: unknown) => e));
    expect(outcome).toBe('caller gave up');
    expect(searches(calls)).toHaveLength(1);
    expect(fetches(calls)).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------------------------------

describe('AC-T38 (WU-17): the generated-query cache is keyed by the required session revision (fake engine)', () => {
  it('C-21: the session (revision source) is a required context field, so a caller cannot silently lose the cache', () => {
    const { ctx } = setup([]);
    const { session: _omitted, ...withoutSession } = ctx;
    // @ts-expect-error -- C-21 (amended): `session` is required.
    const missing: UpgradeSearchContext = withoutSession;
    expect(missing).not.toHaveProperty('session');
  });

  it('AC-T38: two identical runs generate once; a revision bump regenerates; search and fetch go out every run', async () => {
    const { ctx, generate, calls } = setup([searchSequence([1, 2, 3].map((n) => searchResponse(`s${n}`, 2207))), fetchRoute()]);
    const session = { revision: 3 };
    await drive(runUpgradeSearch(input(), { ...ctx, session }));
    await drive(runUpgradeSearch(input(), { ...ctx, session }));
    expect(generate).toHaveBeenCalledTimes(1);
    session.revision += 1;
    await drive(runUpgradeSearch(input(), { ...ctx, session }));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(searches(calls)).toHaveLength(3);
    expect(fetches(calls).length).toBeGreaterThanOrEqual(3);
  });
});

// -------------------------------------------------------------------------------------------------

describe('D-39 links (C-21 searchUrl, fallback and exact-item links)', () => {
  it('encodes the league with encodeURIComponent (a space is %20) and the query as URL-encoded JSON', () => {
    expect(tradeSearchUrl(LEAGUE, 'abc')).toBe('https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/abc');
    const link = tradeQueryUrl(LEAGUE, GENERATED_BODY_ARMOUR_QUERY);
    expect(link.startsWith('https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites?q=')).toBe(true);
    expect(JSON.parse(decodeURIComponent(link.split('?q=')[1]))).toEqual(GENERATED_BODY_ARMOUR_QUERY);
  });

  it("the exact-item link narrows the weight to [floor(w,1)-1, round(w,1)+1] and adds the seller's account", () => {
    const link = exactItemUrl(LEAGUE, GENERATED_BODY_ARMOUR_QUERY, 142.26, 'seller-1#0001');
    const q = JSON.parse(decodeURIComponent(link.split('?q=')[1])) as TradeQueryBody & {
      query: { filters: { trade_filters: { filters: Record<string, unknown> } } };
    };
    expect(q.query.stats![0].value).toEqual({ min: 141.2, max: 143.3 });
    expect(q.query.filters.trade_filters.filters.account).toEqual({ input: 'seller-1#0001' });
    expect(q.query.filters.trade_filters.filters.price).toEqual({ max: 200 });
    // The source query is untouched.
    expect((GENERATED_BODY_ARMOUR_QUERY as unknown as TradeQueryBody).query.stats![0].value).toEqual({ min: FIRST_MIN });
  });
});
