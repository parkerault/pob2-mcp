/**
 * AC-K68 (amendment 5, WU-74, D-372): `find_upgrades`' output is dated as C-49's price tools' are, with a
 * `League: <league>` and a `Checked: <YYYY-MM-DDTHH:MM:SSZ>` line in its header, and an early stop for a
 * trade-site limit names its `TradeErrorKind` with C-49's prefix: a 429 reads `[trade:rate_limited]`.
 *
 * Unit class, through the router (`routeToolCall`): the real engine session (C-3) over a fake bridge client
 * that answers as PoB's generator (the golden build's Body Armour query from the logged-in capture) and
 * evaluator, the real `TradeApiClient` and `RateLimiter` with HTTP served by `fixtureFetch` (responses
 * synthesized from the trade2 fixtures), and a fake clock (Jest modern timers drive `Date.now`). The wall clock
 * that dates prices is `Date.now`; the deadline clock is a separate "monotonic" one, offset from it, as the
 * server's is, so a date taken from the wrong clock shows.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { spawn } from 'child_process';
import { RateLimiter } from '../../src/trade/rateLimiter';
import { TradeApiClient } from '../../src/trade/tradeClient';
import type { Credentials } from '../../src/trade/credentials';
import { checkedTimestamp } from '../../src/trade/renderUpgrades';
import { routeToolCall, type ToolRouterDependencies } from '../../src/server/toolRouter';
import { createEngineSession, type SessionClient } from '../../src/engine/session';
import { fixtureFetch, type FixtureRoute, type RecordedCall } from '../helpers/fixtureFetch';
import {
  DATA_ROUTES,
  GENERATED_BODY_ARMOUR_QUERY,
  SEARCH_HEADERS,
  fetchRoute,
  searchResponse,
  searchSequence,
  type SyntheticResponse,
} from '../helpers/tradeFixtures';

const LEAGUE = 'Forbidden Rites';
const SESSION = (): Credentials => ({ sessionId: 'SENTINEL7f3a', source: 'dotenv' });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** The deadline clock runs this far ahead of the wall clock, as a monotonic clock's epoch differs from it. */
const MONO_OFFSET = 1_000_000_000;
const CHECKED_RE = /^Checked: (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)$/;

/** PoB's `trade_generate_query` reply for the golden build's Body Armour. */
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

/** A bridge client answering as PoB: the generated query, a score per listing, and an empty Body Armour slot. */
function fakeClient(): SessionClient {
  const client = {
    start: async () => undefined,
    stop: async () => undefined,
    isAlive: () => true,
    pid: () => 4242,
    async request(action: string, params?: Record<string, unknown>): Promise<any> {
      if (action === 'trade_generate_query') return { ok: true, result: clone(GENERATED) };
      if (action === 'trade_evaluate_items') {
        const items = (params?.items ?? []) as Array<{ id: string }>;
        return {
          ok: true,
          result: {
            baselineScore: GENERATED.baselineScore,
            rejected: [],
            items: items.map((e, i) => ({ id: e.id, score: 2 + i / 10, stats: {}, itemText: `Rarity: Rare\nListing ${i}\nPlate Vest` })),
          },
        };
      }
      if (action === 'get_items') return { ok: true, result: { items: [] } };
      return { ok: true };
    },
    // The typed wrappers the pipeline calls; the session's guard binds them to itself, so `this.request` is guarded.
    async tradeGenerateQuery(this: SessionClient, params: Record<string, unknown>, opts?: unknown) {
      return (await this.request('trade_generate_query', params, opts as never)).result;
    },
    async tradeEvaluateItems(this: SessionClient, params: Record<string, unknown>, opts?: unknown) {
      return (await this.request('trade_evaluate_items', params, opts as never)).result;
    },
  };
  return client;
}

/** Every request with the wall-clock time it was sent at. */
type TimedCall = RecordedCall & { at: number };

function setup(routes: FixtureRoute[]) {
  const mono = () => Date.now() + MONO_OFFSET;
  const ff = fixtureFetch([...routes, ...DATA_ROUTES]);
  const calls: TimedCall[] = [];
  const timedFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const before = ff.calls.length;
    const p = ff.fetch(input, init);
    if (ff.calls.length > before) calls.push({ ...ff.calls[ff.calls.length - 1], at: Date.now() });
    return p;
  }) as typeof fetch;
  const tradeClient = new TradeApiClient({
    fetch: timedFetch,
    credentials: SESSION,
    limiter: new RateLimiter({ now: mono }),
    userAgent: 'pob2-mcp-server/test',
    now: mono,
  });
  const session = createEngineSession({
    env: {},
    spawn: (() => {
      throw new Error('no spawn in this test');
    }) as unknown as typeof spawn,
    pobDirectory: '/nonexistent',
    now: mono,
    createClient: fakeClient,
  });
  const deps = {
    // The router builds every handler context before it dispatches; find_upgrades uses none of them.
    contextBuilder: new Proxy({}, { get: () => () => ({}) }),
    session,
    env: {},
    tradeClient,
    currency: { getRates: async () => null },
    credentials: SESSION,
    ensureTradeStats: async () => undefined,
    wallClock: () => Date.now(),
  } as unknown as ToolRouterDependencies;
  const call = async (args: Record<string, unknown>) => {
    const result = await drive(
      routeToolCall('find_upgrades', args, deps, {
        signal: new AbortController().signal,
        sendProgress: async () => undefined,
        arrivedAt: mono(),
        now: mono,
      }),
    );
    return { isError: result.isError === true, text: result.content.map((c) => c.text).join('\n') };
  };
  return { call, calls };
}

/** Run a promise to completion under fake timers, advancing the fake clock in small steps. */
async function drive<T>(promise: Promise<T>, limitMs = 200_000): Promise<T> {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  for (let i = 0; i < 20 && !settled; i++) await jest.advanceTimersByTimeAsync(0);
  for (let t = 0; !settled && t < limitMs; t += 50) await jest.advanceTimersByTimeAsync(50);
  return promise;
}

const searches = (calls: TimedCall[]) => calls.filter((c) => c.method === 'POST' && /\/search\//.test(c.url));

/** The header's lines: everything before the `Current item:` line. */
function headLines(text: string): string[] {
  const lines = text.split('\n');
  const end = lines.findIndex((l) => l.startsWith('Current item: '));
  if (end < 0) throw new Error(`no Current item line in:\n${text}`);
  return lines.slice(0, end);
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-16T12:00:00.400Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('AC-K68 (amendment 5, WU-74, D-372): find_upgrades is dated as C-49 dates prices, and a trade-site limit stop names its kind', () => {
  it('AC-K68: a completed search has League: <league> and Checked: <time of its first search, UTC, whole seconds> in its header, before the listings', async () => {
    const { call, calls } = setup([searchSequence([searchResponse('s1', 2207)]), fetchRoute()]);
    const t0 = Date.now();
    const out = await call({ slot: 'Body Armour', league: LEAGUE });
    expect(out.isError).toBe(false);
    expect(out.text).toMatch(/^1\. .+ · (UPGRADE|not an upgrade)$/m);
    const head = headLines(out.text);
    expect(head[0]).toBe('=== find_upgrades: Body Armour ===');
    // C-49's form: each its own line, League first and Checked right after it.
    const league = head.indexOf(`League: ${LEAGUE}`);
    expect(league).toBeGreaterThan(0);
    const checked = CHECKED_RE.exec(head[league + 1] ?? '');
    expect(checked).not.toBeNull();
    // The wall clock (not the deadline clock) when the first search was sent, in whole seconds.
    const sent = searches(calls);
    expect(sent).toHaveLength(1);
    const at = Date.parse(checked![1]);
    expect(at).toBeGreaterThanOrEqual(Math.floor(t0 / 1000) * 1000);
    expect(at).toBeLessThanOrEqual(sent[0].at);
    expect(checked![1]).toBe(checkedTimestamp(at));
    // The status, budget and sort follow on their own line, as before without the league.
    expect(head[league + 2]).toMatch(/^Instant buyout · Budget: no budget · Sort: Full DPS ×1, Effective Hit Pool ×0\.5$/);
    // Exactly one League: line in the whole output.
    expect(out.text.split('\n').filter((l) => l.startsWith('League:'))).toEqual([`League: ${LEAGUE}`]);
  });

  it('AC-K68: a 429 from the trade site stops early with "Stopped early: [trade:rate_limited] ...", and the result is still dated', async () => {
    const tooMany: SyntheticResponse = {
      status: 429,
      headers: { ...SEARCH_HEADERS, 'retry-after': '7' },
      body: { error: { code: 3, message: 'Rate limit exceeded' } },
    };
    const { call, calls } = setup([searchSequence([tooMany]), fetchRoute()]);
    const out = await call({ slot: 'Body Armour', league: LEAGUE });
    // C-14: a stop is a result, not an error.
    expect(out.isError).toBe(false);
    expect(searches(calls)).toHaveLength(1);
    const lines = out.text.split('\n');
    expect(lines).toContain("Stopped early: [trade:rate_limited] the trade site's rate limit requires waiting 7 s.");
    const head = headLines(out.text);
    const league = head.indexOf(`League: ${LEAGUE}`);
    expect(league).toBeGreaterThan(0);
    expect(head[league + 1]).toMatch(CHECKED_RE);
    expect(Date.parse(CHECKED_RE.exec(head[league + 1])![1])).toBeLessThanOrEqual(searches(calls)[0].at);
  });
});
