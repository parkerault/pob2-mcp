/**
 * The `find_upgrades` search pipeline (C-21, WU-17), engine-required: AC-T28, AC-T29 (pipeline part),
 * AC-T32, AC-T33, AC-T38 and AC-T43.
 *
 * Every run goes through `runUpgradeSearch` inside `session.run` of a real in-process server (real
 * luajit, the pinned PoB and the golden build), with a real `TradeApiClient` and `RateLimiter` whose
 * HTTP is a `fixtureFetch` serving `data-leagues`, `data-stats` and searches and fetches synthesized from
 * the trade2 fixtures. The credential getter returns a sentinel cookie unless the AC says otherwise.
 */
import { afterAll, beforeAll, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { fixtureFetch, type FixtureRoute, type RecordedCall } from '../helpers/fixtureFetch';
import {
  DATA_ROUTES,
  codeTwoRejection,
  fetchRoute,
  fixtureStatIds,
  readTrade2,
  searchSequence,
  type SyntheticResponse,
} from '../helpers/tradeFixtures';
import { RateLimiter } from '../../src/trade/rateLimiter';
import { TradeApiClient } from '../../src/trade/tradeClient';
import type { Credentials } from '../../src/trade/credentials';
import {
  parseFindUpgradesInput,
  runUpgradeSearch,
  toGenerateParams,
  type FindUpgradesInput,
  type UpgradeSearchResult,
} from '../../src/trade/findUpgrades';
import { prefitQuery, weightedFilterCount, type TradeQueryBody } from '../../src/trade/prefit';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import type { TradeGenerateQueryResult } from '../../src/engine/schemas';

const SENTINEL = 'SENTINEL7f3a';
const withSession = (): Credentials => ({ sessionId: SENTINEL, source: 'dotenv' });
const TIMEOUT = 180_000;
const LIFE = 'explicit.stat_3299347043';

/** The logged-in Body Armour search capture: 200, total 2207, 100 ids, Account + Ip rules. */
const SESSION_SEARCH: SyntheticResponse = (() => {
  const meta = readTrade2<{ status: number; headers: Record<string, string> }>('search-weighted-session.headers.json');
  return { status: meta.status, headers: meta.headers, body: readTrade2('search-weighted-session.response.json') };
})();

interface Run {
  result: UpgradeSearchResult;
  calls: RecordedCall[];
  progress: string[];
}

engineDescribe('find_upgrades search pipeline (C-21) on the golden build', () => {
  let fx: SessionFixture;

  beforeAll(async () => {
    fx = await startSessionFixture();
    const load = await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
    if (load.isError) throw new Error(`loading the golden build failed: ${load.text}`);
  }, TIMEOUT);

  afterAll(async () => {
    if (fx) await fx.close();
  }, 60_000);

  async function run(
    input: FindUpgradesInput,
    routes: FixtureRoute[],
    opts: { credentials?: () => Credentials; env?: Record<string, string | undefined>; data?: boolean } = {},
  ): Promise<Run> {
    const ff = fixtureFetch(opts.data === false ? routes : [...routes, ...DATA_ROUTES]);
    const credentials = opts.credentials ?? withSession;
    const trade = new TradeApiClient({ fetch: ff.fetch, credentials, limiter: new RateLimiter(), userAgent: 'pob2-mcp-server/test' });
    const controller = new AbortController();
    const deadline = Date.now() + 90_000;
    const progress: string[] = [];
    const { value } = await fx.session.run({ tool: 'find_upgrades', kind: 'read', signal: controller.signal, deadline }, (engine) =>
      runUpgradeSearch(input, {
        engine,
        trade,
        credentials,
        env: opts.env ?? {},
        signal: controller.signal,
        deadline,
        progress: async (m) => {
          progress.push(m);
        },
        session: fx.session,
      }),
    );
    return { result: value, calls: ff.calls, progress };
  }

  /** PoB's query for these options, generated directly in the engine (the reference for the checks). */
  async function generate(input: FindUpgradesInput): Promise<TradeGenerateQueryResult> {
    const { value } = await fx.session.run({ tool: 'test:generate', kind: 'read' }, (ctx) =>
      ctx.client.tradeGenerateQuery(toGenerateParams(input)),
    );
    return value;
  }

  const searchBodies = (calls: RecordedCall[]) =>
    calls.filter((c) => c.method === 'POST' && /\/api\/trade2\/search\//.test(c.url)).map((c) => JSON.parse(c.body as string) as TradeQueryBody);
  const fetchCalls = (calls: RecordedCall[]) => calls.filter((c) => /\/api\/trade2\/fetch\//.test(c.url));
  const group = (q: TradeQueryBody, type: string) => q.query.stats!.find((g) => g.type === type)!;

  it(
    'AC-T28 (WU-17, I-8a): the first search body carries the generated weights, the required mod, the price and the status',
    async () => {
      const input = parseFindUpgradesInput({
        slot: 'Body Armour',
        required_mods: [{ trade_id: LIFE, min: 80 }],
        max_price: 200,
        status: 'available',
        league: 'Forbidden Rites',
      });
      const reference = await generate(input);
      const { result, calls, progress } = await run(input, [searchSequence([SESSION_SEARCH]), fetchRoute()]);
      expect(result.kind).toBe('searched');

      const [first] = searchBodies(calls);
      const generatedIds = new Set(group(reference.query as unknown as TradeQueryBody, 'weight').filters.map((f) => f.id));
      const sentWeights = group(first, 'weight').filters;
      expect(sentWeights.length).toBeGreaterThan(0);
      for (const f of sentWeights) expect(generatedIds.has(f.id)).toBe(true);
      expect(group(first, 'and').filters).toContainEqual({ id: LIFE, value: { min: 80 } });
      expect((first.query.filters as Record<string, { filters: Record<string, unknown> }>).trade_filters.filters.price).toEqual({ max: 200 });
      expect((first.query.status as { option: string }).option).toBe('available');

      // The search URL and the cookie (sent only with the weighted search and fetch).
      expect(calls[0].url).toBe('https://www.pathofexile.com/api/trade2/data/stats');
      for (const c of calls) {
        if (/\/data\//.test(c.url)) expect(c.headers.cookie).toBeUndefined();
        else expect(c.headers.cookie).toBe(`POESESSID=${SENTINEL}`);
      }
      expect(progress).toEqual(['generating query', 'search 1', 'fetching 1/2', 'fetching 2/2']);
      if (result.kind === 'searched') {
        expect(result.entries).toHaveLength(20);
        expect(result.droppedStatIds).toEqual([]);
        expect(result.searchUrl).toMatch(/^https:\/\/www\.pathofexile\.com\/trade2\/search\/poe2\/Forbidden%20Rites\/H4sI/);
      }
    },
    TIMEOUT,
  );

  it(
    'AC-T28: a required mod whose id is absent from /data/stats is removed and listed in droppedStatIds',
    async () => {
      const stale = 'explicit.stat_1';
      expect(fixtureStatIds().has(stale)).toBe(false);
      const input = parseFindUpgradesInput({
        slot: 'Body Armour',
        required_mods: [
          { trade_id: LIFE, min: 80 },
          { trade_id: stale, min: 5 },
        ],
        max_price: 200,
        status: 'available',
        league: 'Forbidden Rites',
      });
      const { result, calls } = await run(input, [searchSequence([SESSION_SEARCH]), fetchRoute()]);
      if (result.kind !== 'searched') throw new Error(`expected searched, got ${result.kind}`);
      expect(result.droppedStatIds).toEqual([stale]);
      expect(result.notes.join('\n')).toContain(stale);
      const [first] = searchBodies(calls);
      expect(group(first, 'and').filters.map((f) => f.id)).toEqual([LIFE]);
    },
    TIMEOUT,
  );

  it(
    "AC-T29 (WU-17, D-23, pipeline): too_complex -> one retry with ceil(25 %) fewer weighted filters; a second -> fallback with the server's message",
    async () => {
      const input = parseFindUpgradesInput({ slot: 'Body Armour', league: 'Forbidden Rites', max_level: 80 });
      const searches = searchSequence([codeTwoRejection('Account,Ip'), codeTwoRejection('Account,Ip')]);
      const { result, calls } = await run(input, [searches, fetchRoute()]);
      const bodies = searchBodies(calls);
      expect(bodies).toHaveLength(2);
      const n1 = weightedFilterCount(bodies[0]);
      const n2 = weightedFilterCount(bodies[1]);
      expect(n2).toBe(n1 - Math.ceil(n1 * 0.25));
      expect(fetchCalls(calls)).toHaveLength(0);
      expect(result.kind).toBe('fallback');
      if (result.kind === 'fallback') {
        expect(result.reason).toContain('Query is too complex');
        expect(result.link.startsWith('https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites?q=')).toBe(true);
      }
    },
    TIMEOUT,
  );

  it(
    "AC-T29 (WU-17, D-23): the golden build's default Body Armour query passes the prefit unchanged",
    async () => {
      const reference = await generate(parseFindUpgradesInput({ slot: 'Body Armour' }));
      const query = reference.query as unknown as TradeQueryBody;
      expect(weightedFilterCount(query)).toBeGreaterThanOrEqual(29);
      const fit = prefitQuery(query);
      expect(fit.dropped).toBe(0);
      expect(fit.query).toEqual(query);
    },
    TIMEOUT,
  );

  it(
    'AC-T32 (WU-17, FR-T7): no session -> the fallback link for the generated query; op:// and malformed reasons',
    async () => {
      const input = parseFindUpgradesInput({ slot: 'Body Armour', league: 'Forbidden Rites' });
      const reference = await generate(input);
      const { result, calls } = await run(input, [], { credentials: () => ({ sessionId: null, source: null }), data: false });
      expect(calls).toEqual([]);
      if (result.kind !== 'fallback') throw new Error(`expected fallback, got ${result.kind}`);
      expect(result.reason).toMatch(/POESESSID/);
      expect(result.link.startsWith('https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites?q=')).toBe(true);
      const q = new URL(result.link).searchParams.get('q') as string;
      expect(JSON.parse(q)).toEqual(reference.query);
      expect(JSON.parse(decodeURIComponent(result.link.split('?q=')[1]))).toEqual(reference.query);

      const op = await run(input, [], { credentials: () => ({ sessionId: null, source: 'dotenv', problem: 'op-reference' }), data: false });
      if (op.result.kind !== 'fallback') throw new Error('expected fallback');
      expect(op.result.reason).toMatch(/1Password reference/);
      const bad = await run(input, [], { credentials: () => ({ sessionId: null, source: 'dotenv', problem: 'malformed' }), data: false });
      if (bad.result.kind !== 'fallback') throw new Error('expected fallback');
      expect(bad.result.reason).toMatch(/malformed/);
    },
    TIMEOUT,
  );

  it(
    'AC-T33 (WU-17): the first search answers session_rejected -> fallback "refresh POESESSID", and no fetch is sent',
    async () => {
      const input = parseFindUpgradesInput({ slot: 'Body Armour', league: 'Forbidden Rites' });
      const { result, calls } = await run(input, [searchSequence([codeTwoRejection('Ip')]), fetchRoute()]);
      expect(searchBodies(calls)).toHaveLength(1);
      expect(fetchCalls(calls)).toHaveLength(0);
      if (result.kind !== 'fallback') throw new Error(`expected fallback, got ${result.kind}`);
      expect(`${result.reason}\n${result.hint}`).toContain('refresh POESESSID');
    },
    TIMEOUT,
  );

  it(
    'AC-T38 (WU-17): the query cache: identical runs generate once; a revision bump regenerates; search and fetch every run',
    async () => {
      // Options no other test uses, so the first run is a cache miss.
      const input = parseFindUpgradesInput({ slot: 'Body Armour', league: 'Forbidden Rites', max_level: 77, status: 'any' });
      const spy = jest.spyOn(PoBLuaApiClient.prototype, 'tradeGenerateQuery');
      try {
        const runs: Run[] = [];
        runs.push(await run(input, [searchSequence([SESSION_SEARCH]), fetchRoute()]));
        runs.push(await run(input, [searchSequence([SESSION_SEARCH]), fetchRoute()]));
        expect(spy).toHaveBeenCalledTimes(1);

        const before = fx.session.revision;
        const level = await fx.call('set_character_level', { level: 85 });
        expect(level.isError).toBe(false);
        expect(fx.session.revision).toBe(before + 1);

        runs.push(await run(input, [searchSequence([SESSION_SEARCH]), fetchRoute()]));
        expect(spy).toHaveBeenCalledTimes(2);
        for (const r of runs) {
          expect(r.result.kind).toBe('searched');
          expect(searchBodies(r.calls)).toHaveLength(1);
          expect(fetchCalls(r.calls)).toHaveLength(2);
        }
      } finally {
        spy.mockRestore();
        await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
      }
    },
    TIMEOUT,
  );

  it(
    'AC-T43 (WU-17, D-49): POE_LEAGUE set and no session -> no request of any kind',
    async () => {
      const input = parseFindUpgradesInput({ slot: 'Body Armour' });
      // No routes at all: any /data/*, search or fetch request would throw "unmatched fetch".
      const { result, calls } = await run(input, [], {
        credentials: () => ({ sessionId: null, source: null }),
        env: { POE_LEAGUE: 'Forbidden Rites' },
        data: false,
      });
      expect(calls).toEqual([]);
      expect(result.kind).toBe('fallback');
      if (result.kind === 'fallback') {
        expect(result.link.startsWith('https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites?q=')).toBe(true);
      }
    },
    TIMEOUT,
  );

  it(
    'D-20 (C-14 step 6): with no league input or POE_LEAGUE, the league is resolved from /data/leagues',
    async () => {
      const input = parseFindUpgradesInput({ slot: 'Body Armour' });
      const { result, calls } = await run(input, [searchSequence([SESSION_SEARCH]), fetchRoute()]);
      expect(calls.some((c) => /\/data\/leagues/.test(c.url))).toBe(true);
      expect(calls.find((c) => c.method === 'POST')?.url).toBe('https://www.pathofexile.com/api/trade2/search/poe2/Forbidden%20Rites');
      if (result.kind !== 'searched') throw new Error('expected searched');
      expect(result.league).toBe('Forbidden Rites');
    },
    TIMEOUT,
  );
});
