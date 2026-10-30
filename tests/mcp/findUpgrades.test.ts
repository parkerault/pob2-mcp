/**
 * `find_upgrades` through the MCP tool (WU-23, C-14 steps 10–13): AC-T31, AC-T35, AC-T36, AC-T37,
 * AC-T39, AC-T40, AC-T44, AC-T45 and AC-T47, plus C-14's schema-agreement check.
 *
 * In process and engine-required: the real SDK `Client`, router, handler and engine session (real
 * luajit, the pinned PoB, the golden build), with every trade2 and poe.ninja request served by a
 * `fixtureFetch` from the committed fixtures or responses synthesized from them
 * (`tests/helpers/tradeFixtures.ts`). The credential getter returns a sentinel cookie unless a case
 * says otherwise.
 *
 * Clock: only `Date` is faked (it runs with real time). Before each call the fake clock jumps 4 h ahead,
 * so the server's rate limiter, which reads it, never makes one call wait on another's windows (the
 * "fake limiter clock"); a case that sends several searches in one call moves it on per search too.
 */
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { engineDescribe } from '../helpers/engine';
import { GOLDEN_XML, goldenWithLevel, startSessionFixture, waitFor, writeBuild, type SessionFixture } from '../helpers/engineSession';
import { fixtureFetch, type FixtureRoute, type RecordedCall } from '../helpers/fixtureFetch';
import {
  DATA_ROUTES,
  FETCH_HEADERS,
  FETCH_URL,
  deriveListing,
  fetchRoute,
  parseFetchUrl,
  readTrade2,
  searchBody,
  searchSequence,
  syntheticIds,
  type FetchListing,
  type SyntheticResponse,
} from '../helpers/tradeFixtures';
import type { Credentials } from '../../src/trade/credentials';
import { parseRates, convert, type Rates } from '../../src/trade/currency';
import { findUpgradesInputSchema } from '../../src/trade/findUpgrades';
import { getTradeToolSchemas } from '../../src/server/toolSchemas';
import { TRUNCATED_TOOLS } from '../../src/server/createServer';
import { TOOL_META } from '../../src/server/toolMeta';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';

const SENTINEL = 'SENTINEL7f3a';
const LEAGUE = 'Forbidden Rites';
const TIMEOUT = 240_000;
const CALL_TIMEOUT_MS = 150_000;
const LIFE = 'explicit.stat_3299347043';

const DISPOSITION = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'tool-disposition.json'), 'utf8'),
) as Array<{ name: string; bucket: string; pending?: string }>;

const NINJA = readTrade2<unknown>('../poeninja/currency-overview.response.json');
const RATES = parseRates(LEAGUE, NINJA as Parameters<typeof parseRates>[1], 0) as Rates;

/** The logged-in Body Armour search capture: 200, total 2207, 100 ids, Account + Ip rules. */
const SESSION_SEARCH: SyntheticResponse = (() => {
  const meta = readTrade2<{ status: number; headers: Record<string, string> }>('search-weighted-session.headers.json');
  return { status: meta.status, headers: meta.headers, body: readTrade2('search-weighted-session.response.json') };
})();

const SESSION_IDS = (SESSION_SEARCH.body as { result: string[] }).result;

const RING_TEMPLATE = readTrade2<{ result: FetchListing[] }>('fetch-ring-divine.response.json').result;

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

/** Move the fake clock (and so the server's limiter and deadlines) forward. */
function tick(ms: number): void {
  jest.setSystemTime(Date.now() + ms);
}

function jsonResponse(body: unknown, headers: Record<string, string> = FETCH_HEADERS, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } });
}

// ---------------------------------------------------------------------------------------------------
// Output parsing

interface Shown {
  n: number;
  title: string;
  price: string;
  /** Native amount and currency. */
  amount: number;
  currency: string;
  normalized: number | null;
  notConverted: boolean;
  score: number;
  upgrade: boolean;
  compact: boolean;
  /** The listing's `Buy:` target (the whisper or the link), or null when it shows none. */
  buy: string | null;
  /** The full listing's block (full listings only). */
  block?: string;
}

const PRICE_RE = /^(-?[\d.]+) (\S+)(?: \(≈ ([\d.]+) (\S+)\))?( \(price not converted\))?$/;

function parsePrice(price: string): Pick<Shown, 'amount' | 'currency' | 'normalized' | 'notConverted'> {
  const m = PRICE_RE.exec(price);
  if (!m) throw new Error(`unparseable price "${price}"`);
  return { amount: Number(m[1]), currency: m[2], normalized: m[3] !== undefined ? Number(m[3]) : null, notConverted: m[5] !== undefined };
}

/** The listings an output shows, in order (full and compact). */
function listings(text: string): Shown[] {
  const out: Shown[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const compact = /^(\d+)\. (.+?): (.+?) · score (-?[\d.]+) · (UPGRADE|not an upgrade) · seller (.+?)(?: · Buy: (.+))?$/.exec(lines[i]);
    if (compact) {
      out.push({
        n: Number(compact[1]),
        title: compact[2],
        price: compact[3],
        ...parsePrice(compact[3]),
        score: Number(compact[4]),
        upgrade: compact[5] === 'UPGRADE',
        compact: true,
        buy: compact[7] ?? null,
      });
      continue;
    }
    const full = /^(\d+)\. (.+?): (.+?) · (UPGRADE|not an upgrade)$/.exec(lines[i]);
    if (full) {
      const score = /^ {3}Score (-?[\d.]+) vs (-?[\d.]+)/.exec(lines[i + 1] ?? '');
      if (!score) throw new Error(`full listing without a Score line: ${lines[i]}`);
      let end = i + 1;
      while (end < lines.length && lines[end].startsWith('   ')) end += 1;
      const block = lines.slice(i, end).join('\n');
      out.push({
        n: Number(full[1]),
        title: full[2],
        price: full[3],
        ...parsePrice(full[3]),
        score: Number(score[1]),
        upgrade: full[4] === 'UPGRADE',
        compact: false,
        buy: /^ {3}Buy: (.*)$/m.exec(block)?.[1] ?? null,
        block,
      });
    }
  }
  return out;
}

function baselineOf(text: string): number {
  const m = /^Current item: .* · Baseline score (-?[\d.]+)$/m.exec(text);
  if (!m) throw new Error('no baseline line');
  return Number(m[1]);
}

function countOf(text: string, label: string): number {
  const m = new RegExp(`(?:^|· )${label} (\\d+)`, 'm').exec(text);
  if (!m) throw new Error(`no "${label}" count`);
  return Number(m[1]);
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

const LINK_PREFIX = 'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites?q=';

/** The query a `Buy:` link carries (its `q` parameter, decoded). */
function linkQuery(link: string): unknown {
  return JSON.parse(new URL(link).searchParams.get('q') as string);
}

/** The D-90 pinning query for a fetched listing under the search's `status`. */
function pinningQuery(entry: FetchListing, status: string): unknown {
  const name = typeof entry.item.name === 'string' ? entry.item.name.trim() : '';
  const price = entry.listing.price as { amount: number; currency: string };
  return {
    query: {
      status: { option: status },
      ...(name ? { name } : {}),
      type: entry.item.baseType,
      filters: {
        trade_filters: {
          filters: {
            account: { input: (entry.listing.account as { name: string }).name },
            price: { min: price.amount, max: price.amount, option: price.currency },
          },
        },
      },
    },
  };
}

/** The status option of the (first) search request the server sent. */
function searchedStatus(calls: RecordedCall[]): string {
  return (JSON.parse(searchCalls(calls)[0].body as string) as { query: { status: { option: string } } }).query.status.option;
}

const searchCalls = (calls: RecordedCall[]) => calls.filter((c) => /\/api\/trade2\/search\//.test(c.url));
const fetchCalls = (calls: RecordedCall[]) => calls.filter((c) => /\/api\/trade2\/fetch\//.test(c.url));

// ---------------------------------------------------------------------------------------------------

engineDescribe('find_upgrades through the MCP tool (WU-23, C-14 steps 10–13)', () => {
  let fx: SessionFixture;
  let http = fixtureFetch([]);
  let creds: Credentials = { sessionId: SENTINEL, source: 'dotenv' };
  let ninjaOk = true;

  /** Serve this case's search/fetch routes, plus `/data/*` and poe.ninja. */
  function serve(routes: FixtureRoute[]): ReturnType<typeof fixtureFetch> {
    http = fixtureFetch([
      ...routes,
      ...DATA_ROUTES,
      {
        match: /^https:\/\/poe\.ninja\//,
        respond: () => (ninjaOk ? jsonResponse(NINJA, {}) : jsonResponse({ error: 'unavailable' }, {}, 500)),
      },
    ]);
    return http;
  }

  async function call(args: Record<string, unknown>, opts: Parameters<SessionFixture['server']['client']['callTool']>[2] = {}) {
    tick(4 * 3600_000);
    const result = (await fx.server.client.callTool({ name: 'find_upgrades', arguments: args }, undefined, {
      timeout: CALL_TIMEOUT_MS,
      ...opts,
    })) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
    return { isError: result.isError === true, text: (result.content ?? []).map((c) => c.text ?? '').join('\n') };
  }

  beforeAll(async () => {
    jest.useFakeTimers(FAKE_DATE as unknown as Parameters<typeof jest.useFakeTimers>[0]);
    // Test actions on: AC-T44 (e) keeps the engine busy past the deadline with `__test_sleep`.
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
    creds = { sessionId: SENTINEL, source: 'dotenv' };
    ninjaOk = true;
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------------------------------
  // AC-T40 runs first, so its default call generates PoB's query (no query-cache hit) end to end.

  it(
    'AC-T40 (WU-23, NFR-3, NFR-10): defaults complete in <= 15 s; limit 20 + include_non_upgrades stays <= 30,000 characters, listings past the budget compact; last line is the search link',
    async () => {
      serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
      const t0 = performance.now();
      const out = await call({ slot: 'Body Armour' });
      const wall = performance.now() - t0;
      expect(out.isError).toBe(false);
      expect(wall).toBeLessThanOrEqual(15_000);
      expect(out.text).toContain('=== find_upgrades: Body Armour ===');
      expect(countOf(out.text, 'Evaluated') + countOf(out.text, 'Rejected')).toBe(20);
      // the fixture search and fetch, rewritten ids for both pages, with the sentinel cookie
      expect(searchCalls(http.calls)).toHaveLength(1);
      expect(fetchCalls(http.calls)).toHaveLength(2);
      for (const c of [...searchCalls(http.calls), ...fetchCalls(http.calls)]) expect(c.headers.cookie).toBe(`POESESSID=${SENTINEL}`);

      serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
      const big = await call({ slot: 'Body Armour', limit: 20, include_non_upgrades: true });
      expect(big.isError).toBe(false);
      expect(big.text.length).toBeLessThanOrEqual(30_000);
      const shown = listings(big.text);
      expect(shown).toHaveLength(20);
      expect(shown.some((s) => !s.compact)).toBe(true);
      // With D-90's short exact-item links all 20 fixture listings fit in full; listings past the budget
      // (if any) render compact after every full listing, with the compaction note. The notice case
      // below and AC-T47 force compaction through the tool.
      const firstCompact = shown.findIndex((s) => s.compact);
      if (firstCompact >= 0) {
        expect(firstCompact).toBeGreaterThan(0);
        expect(shown.slice(firstCompact).every((s) => s.compact)).toBe(true);
        expect(big.text).toMatch(/listings? (?:is|are) shown compactly to keep this output under 30,000 characters/);
      } else {
        expect(big.text).not.toMatch(/shown compactly/);
      }
      const lines = big.text.split('\n');
      expect(lines[lines.length - 1]).toMatch(/^Search on the trade site: https:\/\/www\.pathofexile\.com\/trade2\/search\/poe2\/Forbidden%20Rites\//);
      // not truncated: not on the truncation list, and longer than its 5000 characters
      expect(TRUNCATED_TOOLS.has('find_upgrades')).toBe(false);
      expect(big.text.length).toBeGreaterThan(5000);
    },
    TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-T47

  it(
    'AC-T47 (WU-24, D-90): every listing, full or compact, has a Buy; each link decodes to exactly the D-90 pinning query, is <= 1,000 characters; >= 10 full listings within 30,000; the description says to show Buy lines verbatim',
    async () => {
      const args = { slot: 'Body Armour', limit: 20, include_non_upgrades: true };
      const keyOf = (title: string, amount: number, currency: string) => `${title} @ ${amount} ${currency}`;

      /** Runs the call with these fetched entries; checks every listing's Buy; returns the listings shown. */
      async function checkBuys(derive: (id: string, i: number) => FetchListing): Promise<{ text: string; shown: Shown[]; links: number; whispers: number }> {
        serve([searchSequence([SESSION_SEARCH]), fetchRoute({ entryFor: derive })]);
        const out = await call(args);
        expect(out.isError).toBe(false);
        expect(searchCalls(http.calls)).toHaveLength(1);
        expect(fetchCalls(http.calls)).toHaveLength(2);
        const status = searchedStatus(http.calls);

        // What each fetched entry looks like in the output (its title and native price), and its query.
        const served = fetchCalls(http.calls).flatMap((c) => parseFetchUrl(c.url).ids.map((id, i) => derive(id, i)));
        const expected = new Map<string, unknown[]>();
        for (const e of served) {
          const name = String(e.item.name ?? '').trim() || String(e.item.typeLine ?? '').trim();
          const base = String(e.item.baseType ?? '').trim() || String(e.item.typeLine ?? '').trim();
          const title = base && base !== name ? `${name}, ${base}` : name;
          const key = keyOf(title, e.listing.price!.amount, e.listing.price!.currency);
          expected.set(key, [...(expected.get(key) ?? []), pinningQuery(e, status)]);
        }

        const shown = listings(out.text);
        expect(shown).toHaveLength(20);
        let links = 0;
        let whispers = 0;
        for (const s of shown) {
          expect(s.buy).not.toBeNull();
          if (served.some((e) => e.listing.whisper !== undefined && e.listing.whisper === s.buy)) {
            whispers += 1;
            continue;
          }
          links += 1;
          expect(s.buy!.startsWith(LINK_PREFIX)).toBe(true);
          expect(s.buy!.length).toBeLessThanOrEqual(1_000);
          const q = linkQuery(s.buy!) as { query: Record<string, unknown> };
          expect(q.query).not.toHaveProperty('stats');
          expect(expected.get(keyOf(s.title, s.amount, s.currency))).toContainEqual(q);
        }
        expect(out.text.length).toBeLessThanOrEqual(30_000);
        return { text: out.text, shown, links, whispers };
      }

      // The fixture fetch as captured: every Buy is an exact-item link, and at least 10 listings are full.
      const plain = await checkBuys((id, i) => deriveListing(id, i));
      expect(plain.links).toBe(20);
      expect(plain.shown.filter((s) => !s.compact).length).toBeGreaterThanOrEqual(10);

      // Long whispers on half the listings push some into compact lines: those carry their Buy too.
      const mixed = await checkBuys((id, i) => deriveListing(id, i, i % 2 === 0 ? { whisper: `@seller-${i} hi ${'w'.repeat(1_000)}` } : {}));
      const compact = mixed.shown.filter((s) => s.compact);
      expect(compact.length).toBeGreaterThan(0);
      expect(compact.some((s) => s.buy!.startsWith(LINK_PREFIX))).toBe(true);
      expect(compact.some((s) => s.buy!.startsWith('@seller-'))).toBe(true);
      expect(mixed.text).toMatch(/shown compactly/);

      const tools = await fx.server.client.listTools();
      const description = tools.tools.find((t) => t.name === 'find_upgrades')?.description ?? '';
      expect(description).toMatch(/show each listing's Buy line verbatim/i);
    },
    TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-T31

  describe('AC-T31 (WU-23, I-8b): 30 listings over 3 pages in exalted, chaos and divine, max_price 200', () => {
    const IDS = syntheticIds('t31', 100);
    const OVER = 7; // 2 chaos ≈ 326 exalted
    const UNCONVERTIBLE = 5;
    /** Unique prices: exalted, chaos and divine in turn, every one under 200 exalted except listing 7. */
    function priceOf(k: number, unconvertible = false): { amount: number; currency: string } {
      if (k === OVER) return { amount: 2, currency: 'chaos' };
      if (unconvertible && k === UNCONVERTIBLE) return { amount: 3, currency: 'not-a-currency' };
      if (k % 3 === 0) return { amount: 10 + k, currency: 'exalted' };
      if (k % 3 === 1) return { amount: (k + 1) / 40, currency: 'chaos' };
      return { amount: (k + 1) / 100, currency: 'divine' };
    }
    const whisperOf = (k: number) => (k % 2 === 0 ? `@seller-${k} Hi, I would like to buy your item listed for ${k}` : undefined);
    function routes(unconvertible = false): FixtureRoute[] {
      return [
        searchSequence([{ status: 200, body: searchBody('t31', 2207, IDS) }]),
        fetchRoute({
          entryFor: (id) => {
            const k = IDS.indexOf(id);
            const w = whisperOf(k);
            return deriveListing(id, k, { price: priceOf(k, unconvertible), ...(w ? { whisper: w } : {}) });
          },
        }),
      ];
    }
    const priceKey = (p: { amount: number; currency: string }) => `${p.amount} ${p.currency}`;
    const indexOfPrice = new Map(Array.from({ length: 30 }, (_, k) => [priceKey(priceOf(k)), k]));
    /**
     * Under the default weights every fixture-derived listing scores below the golden build's baseline,
     * so nothing would be an upgrade. Under Life ×1 about half of the fixture's body armours are
     * upgrades, so (i)–(vii) run on data that mixes upgrades and non-upgrades.
     */
    const MIXED_WEIGHTS = [{ stat: 'Life', weight: 1 }];
    const BASE = { slot: 'Body Armour', max_price: 200, fetch_pages: 3, limit: 20, include_non_upgrades: true, sort_stats: MIXED_WEIGHTS };

    const outputs: Record<string, string> = {};

    it(
      'AC-T31 (i), (v), (vi), (vii): stat_value orders by score descending; the 2-chaos listing is over budget; is_upgrade and Buy lines',
      async () => {
        serve(routes());
        const out = await call({ ...BASE, rank_by: 'stat_value' });
        expect(out.isError).toBe(false);
        outputs.stat_value = out.text;
        expect(fetchCalls(http.calls)).toHaveLength(3);
        const shown = listings(out.text);
        expect(shown).toHaveLength(20);
        // (i)
        for (let i = 1; i < shown.length; i++) expect(shown[i].score).toBeLessThanOrEqual(shown[i - 1].score);
        // (v)
        expect(countOf(out.text, 'Over budget')).toBe(1);
        expect(out.text).not.toMatch(/: 2 chaos \(/);
        expect(countOf(out.text, 'Evaluated') + countOf(out.text, 'Rejected')).toBe(30);
        // (vi): the data mixes upgrades and non-upgrades, and each flag is PoB's 4-decimal comparison
        const baseline = baselineOf(out.text);
        expect(countOf(out.text, 'Upgrades')).toBeGreaterThan(0);
        expect(shown.some((s) => s.upgrade)).toBe(true);
        expect(shown.some((s) => !s.upgrade)).toBe(true);
        expect(out.text).toMatch(/ · UPGRADE$/m);
        for (const s of shown) expect(s.upgrade).toBe(round4(s.score) > round4(baseline));
        expect(out.text).not.toContain('No upgrade within budget.');
        // (vii): whisper when the listing has one, else the exact-item link; an Item text block
        const full = shown.filter((s) => !s.compact);
        expect(full.length).toBeGreaterThan(0);
        for (const s of full) {
          const k = indexOfPrice.get(priceKey(s)) as number;
          expect(k).toBeDefined();
          expect(s.buy).not.toBeNull();
          if (whisperOf(k)) expect(s.buy).toBe(whisperOf(k));
          else {
            // the D-90 exact-item link (amended from PoB's weighted recipe)
            expect(s.buy!.startsWith(LINK_PREFIX)).toBe(true);
            expect(linkQuery(s.buy!)).toEqual(pinningQuery(deriveListing(IDS[k], k, { price: priceOf(k) }), searchedStatus(http.calls)));
          }
          expect(s.block).toMatch(/\n {3}Item text:\n {3}\S/);
        }
      },
      TIMEOUT,
    );

    it(
      'AC-T31 (vi), C-14 step 13: without include_non_upgrades only the upgrades are listed, up to limit, each flagged UPGRADE',
      async () => {
        serve(routes());
        const out = await call({ slot: 'Body Armour', max_price: 200, fetch_pages: 3, sort_stats: MIXED_WEIGHTS, rank_by: 'stat_value' });
        expect(out.isError).toBe(false);
        const upgrades = countOf(out.text, 'Upgrades');
        expect(upgrades).toBeGreaterThan(0);
        const shown = listings(out.text);
        expect(shown).toHaveLength(Math.min(upgrades, 10));
        const baseline = baselineOf(out.text);
        for (const s of shown) {
          expect(s.upgrade).toBe(true);
          expect(round4(s.score)).toBeGreaterThan(round4(baseline));
        }
        // the same listings as the top upgrades of the include_non_upgrades run, in the same order
        const withAll = listings(outputs.stat_value).filter((s) => s.upgrade);
        expect(shown.map((s) => s.price)).toEqual(withAll.slice(0, shown.length).map((s) => s.price));
        expect(out.text).not.toMatch(/ · not an upgrade$/m);
        expect(out.text).not.toContain('No upgrade within budget.');
      },
      TIMEOUT,
    );

    it('AC-T31 (ii): price orders by the normalized price, ascending', async () => {
      serve(routes());
      const out = await call({ ...BASE, rank_by: 'price' });
      expect(out.isError).toBe(false);
      const shown = listings(out.text);
      expect(shown).toHaveLength(20);
      for (const s of shown) expect(s.normalized).not.toBeNull();
      for (let i = 1; i < shown.length; i++) expect(shown[i].normalized as number).toBeGreaterThanOrEqual(shown[i - 1].normalized as number);
      // the normalized value is C-12's conversion into exalted
      for (const s of shown) expect(s.normalized as number).toBeCloseTo(convert(s.amount, s.currency, 'exalted', RATES) as number, 1);
      expect(out.text).not.toMatch(/fell back/);
    }, TIMEOUT);

    it('AC-T31 (iii): stat_value_per_price orders by score − 0.1·log10(divine price), descending', async () => {
      serve(routes());
      const out = await call({ ...BASE, rank_by: 'stat_value_per_price' });
      expect(out.isError).toBe(false);
      const shown = listings(out.text);
      expect(shown).toHaveLength(20);
      const key = (s: Shown) => s.score - 0.1 * Math.log10(convert(s.amount, s.currency, 'divine', RATES) as number);
      // scores print with 4 decimals, so neighbours may differ by the rounding
      for (let i = 1; i < shown.length; i++) expect(key(shown[i])).toBeLessThanOrEqual(key(shown[i - 1]) + 1e-4);
      expect(out.text).not.toMatch(/fell back/);
    }, TIMEOUT);

    it('AC-T31 (iv): trade_weight keeps the trade order', async () => {
      serve(routes());
      const out = await call({ ...BASE, rank_by: 'trade_weight' });
      expect(out.isError).toBe(false);
      const shown = listings(out.text);
      expect(shown).toHaveLength(20);
      const order = shown.map((s) => indexOfPrice.get(priceKey(s)) as number);
      const expected = Array.from({ length: 30 }, (_, k) => k).filter((k) => k !== OVER).slice(0, 20);
      expect(order).toEqual(expected);
    }, TIMEOUT);

    it(
      'AC-T31 (viii): with the equipped item\'s own text as the only candidate, "No upgrade within budget." and no listing',
      async () => {
        const { value: items } = await fx.session.run({ tool: 'test:items', kind: 'read' }, (ctx) => ctx.client.getItems());
        const equipped = (items as Array<{ slot: string; raw?: string }>).find((i) => i.slot === 'Body Armour');
        expect(typeof equipped?.raw).toBe('string');
        const id = syntheticIds('t31viii', 1)[0];
        serve([
          searchSequence([{ status: 200, body: searchBody('t31viii', 25, [id]) }]),
          fetchRoute({
            entryFor: () => ({ ...deriveListing(id, 0, { price: { amount: 5, currency: 'exalted' } }), itemText: equipped!.raw } as FetchListing),
          }),
        ]);
        const out = await call({ slot: 'Body Armour', max_price: 200 });
        expect(out.isError).toBe(false);
        expect(countOf(out.text, 'Evaluated')).toBe(1);
        expect(countOf(out.text, 'Upgrades')).toBe(0);
        expect(out.text).toContain('No upgrade within budget.');
        expect(listings(out.text)).toHaveLength(0);
        expect(out.text).not.toMatch(/^\d+\. /m);
      },
      TIMEOUT,
    );

    it(
      'AC-T31 (ix): an unconvertible currency makes rank_by price fall back to stat_value with a note; that listing is flagged and not over budget',
      async () => {
        serve(routes(true));
        const out = await call({ ...BASE, fetch_pages: 2, rank_by: 'price' });
        expect(out.isError).toBe(false);
        expect(out.text).toMatch(/rank_by "price" fell back to "stat_value": some prices could not be converted\./);
        const shown = listings(out.text);
        expect(shown).toHaveLength(19); // 20 fetched, the 2-chaos one over budget
        const flagged = shown.filter((s) => s.notConverted);
        expect(flagged).toHaveLength(1);
        expect(flagged[0].currency).toBe('not-a-currency');
        expect(countOf(out.text, 'Over budget')).toBe(1);
        for (let i = 1; i < shown.length; i++) expect(shown[i].score).toBeLessThanOrEqual(shown[i - 1].score);
      },
      TIMEOUT,
    );
  });

  // -------------------------------------------------------------------------------------------------

  it(
    'AC-T35 (WU-23): cancelling the call aborts the held fetch, sends nothing more, and a queued lua_get_build_info completes within 1 s',
    async () => {
      const held: RequestInit[] = [];
      serve([
        searchSequence([SESSION_SEARCH]),
        {
          match: FETCH_URL,
          respond: (_url, init) => {
            held.push(init as RequestInit);
            return new Promise<Response>(() => undefined); // released only by the abort
          },
        },
      ]);
      const queued: string[] = [];
      const off = fx.session.onEvent((e) => {
        if (e.phase === 'queued') queued.push(e.tool);
      });
      const controller = new AbortController();
      tick(4 * 3600_000);
      const pending = fx.server.client
        .callTool({ name: 'find_upgrades', arguments: { slot: 'Body Armour' } }, undefined, { signal: controller.signal, timeout: CALL_TIMEOUT_MS })
        .then(
          () => 'resolved',
          (e: unknown) => e,
        );
      await waitFor(() => held.length === 1, 60_000, 'the first fetch');
      const info = fx.call('lua_get_build_info');
      await waitFor(() => queued.includes('lua_get_build_info'), 10_000, 'lua_get_build_info to queue');
      const sent = http.calls.length;

      const t = performance.now();
      controller.abort('user cancelled');
      const out = await info;
      const elapsed = performance.now() - t;
      off();

      expect(out.isError).toBe(false);
      expect(elapsed).toBeLessThan(1000);
      expect(held[0].signal?.aborted).toBe(true);
      expect(await pending).not.toBe('resolved');
      await new Promise((r) => setTimeout(r, 300));
      expect(http.calls.slice(sent).filter((c) => /\/api\/trade2\/(fetch|search)\//.test(c.url))).toEqual([]);
    },
    TIMEOUT,
  );

  it('AC-T36 (WU-23): with a progressToken, >= 4 strictly increasing progress notifications in C-14 order; without one, none', async () => {
    serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
    const seen: Array<{ progress: number; message?: string }> = [];
    const out = await call({ slot: 'Body Armour' }, { onprogress: (p) => seen.push({ progress: p.progress, message: p.message }) });
    expect(out.isError).toBe(false);
    expect(seen.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < seen.length; i++) expect(seen[i].progress).toBeGreaterThan(seen[i - 1].progress);
    const phase = (m?: string) =>
      m === 'generating query' ? 0 : /^search \d+$/.test(m ?? '') ? 1 : /^fetching \d+\/\d+$/.test(m ?? '') ? 2 : m === 'evaluating' ? 3 : m === 'done' ? 4 : -1;
    const phases = seen.map((s) => phase(s.message));
    expect(phases).not.toContain(-1);
    for (let i = 1; i < phases.length; i++) expect(phases[i]).toBeGreaterThanOrEqual(phases[i - 1]);
    expect(seen[0].message).toBe('generating query');
    expect(seen.map((s) => s.message)).toEqual(expect.arrayContaining(['search 1', 'fetching 1/2', 'fetching 2/2', 'evaluating']));
    expect(seen[seen.length - 1].message).toBe('done');

    // Without a token: count every progress notification the client receives.
    const handlers = (fx.server.client as unknown as { _notificationHandlers: Map<string, (n: unknown) => Promise<void>> })._notificationHandlers;
    const original = handlers.get('notifications/progress');
    const received: unknown[] = [];
    handlers.set('notifications/progress', async (n) => {
      received.push(n);
      if (original) await original(n);
    });
    try {
      serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
      const plain = await call({ slot: 'Body Armour' });
      expect(plain.isError).toBe(false);
      expect(received).toEqual([]);
    } finally {
      if (original) handlers.set('notifications/progress', original);
    }
  }, TIMEOUT);

  it(
    'AC-T37 (WU-23, I-2): set_character_level during the fetch phase waits for find_upgrades, whose scores match an undisturbed run at level 90',
    async () => {
      serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
      const undisturbed = await call({ slot: 'Body Armour', include_non_upgrades: true });
      expect(undisturbed.isError).toBe(false);

      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let fetches = 0;
      let heldNow = false;
      const base = fetchRoute();
      serve([
        searchSequence([SESSION_SEARCH]),
        {
          match: FETCH_URL,
          respond: async (url, init) => {
            fetches += 1;
            if (fetches === 1) {
              heldNow = true;
              await gate;
              const { ids } = parseFetchUrl(url);
              return jsonResponse({ result: ids.map((id, i) => deriveListing(id, i)) });
            }
            return (base.respond as (u: string, i: RequestInit | undefined) => Promise<Response>)(url, init);
          },
        },
      ]);
      const queued: string[] = [];
      const off = fx.session.onEvent((e) => {
        if (e.phase === 'queued') queued.push(e.tool);
      });
      let findDone = 0;
      let levelDone = 0;
      const find = call({ slot: 'Body Armour', include_non_upgrades: true }).then((r) => {
        findDone = performance.now();
        return r;
      });
      await waitFor(() => heldNow, 60_000, 'the held fetch');
      const level = fx.call('set_character_level', { level: 50 }).then((r) => {
        levelDone = performance.now();
        return r;
      });
      await waitFor(() => queued.includes('set_character_level'), 10_000, 'set_character_level to queue');
      await new Promise((r) => setTimeout(r, 200));
      expect(levelDone).toBe(0);
      release();
      const disturbed = await find;
      const levelOut = await level;
      off();

      expect(disturbed.isError).toBe(false);
      expect(levelOut.isError).toBe(false);
      expect(levelDone).toBeGreaterThan(findDone);
      expect(baselineOf(disturbed.text)).toBe(baselineOf(undisturbed.text));
      expect(listings(disturbed.text).map((s) => s.score)).toEqual(listings(undisturbed.text).map((s) => s.score));
      const info = await fx.call('lua_get_build_info');
      expect(info.text).toMatch(/Level: 50\b/);

      const reload = await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
      expect(reload.isError).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'AC-T39 (WU-23, D-11, D-33): with poe.ninja failing, native prices and the rates note; price falls back, trade_weight is kept; nothing is over budget',
    async () => {
      ninjaOk = false;
      const IDS = syntheticIds('t39', 100);
      const priced = () =>
        fetchRoute({ entryFor: (id) => deriveListing(id, IDS.indexOf(id), { price: { amount: 5 + IDS.indexOf(id), currency: 'divine' } }) });
      serve([searchSequence([{ status: 200, body: searchBody('t39', 2207, IDS) }]), priced()]);
      const byPrice = await call({ slot: 'Body Armour', max_price: 200, rank_by: 'price', include_non_upgrades: true, limit: 20 });
      expect(byPrice.isError).toBe(false);
      expect(http.calls.some((c) => /poe\.ninja/.test(c.url))).toBe(true);
      expect(byPrice.text).toContain('Currency rates unavailable: showing native prices; the budget was enforced by the trade site only.');
      expect(byPrice.text).toMatch(/rank_by "price" fell back to "stat_value": currency rates are unavailable\./);
      expect(byPrice.text).not.toContain('≈');
      expect(countOf(byPrice.text, 'Over budget')).toBe(0);
      const shown = listings(byPrice.text);
      expect(shown.length).toBe(countOf(byPrice.text, 'Evaluated'));
      for (const s of shown) expect(s.normalized).toBeNull();
      for (let i = 1; i < shown.length; i++) expect(shown[i].score).toBeLessThanOrEqual(shown[i - 1].score);

      serve([searchSequence([{ status: 200, body: searchBody('t39', 2207, IDS) }]), priced()]);
      const byTrade = await call({ slot: 'Body Armour', max_price: 200, rank_by: 'trade_weight', include_non_upgrades: true, limit: 20 });
      expect(byTrade.isError).toBe(false);
      expect(byTrade.text).not.toMatch(/fell back/);
      const order = listings(byTrade.text).map((s) => s.amount - 5);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(countOf(byTrade.text, 'Over budget')).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'C-14 steps 10–11 (D-11): with < 15 s left and poe.ninja hanging, the listings are evaluated first; the cut rate lookup only costs the prices',
    async () => {
      let releaseNinja!: () => void;
      const ninjaHeld = new Promise<void>((r) => (releaseNinja = r));
      http = fixtureFetch([
        searchSequence([SESSION_SEARCH]),
        fetchRoute(),
        ...DATA_ROUTES,
        { match: /^https:\/\/poe\.ninja\//, respond: async () => (await ninjaHeld, jsonResponse({ error: 'unavailable' }, {}, 500)) },
      ]);
      const originalRequest = PoBLuaApiClient.prototype.request;
      let t0 = 0;
      jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, action, params, opts) {
        const reply = await originalRequest.call(this, action, params, opts);
        // The current item is read just before evaluation: leave 10 s of the 90 s budget.
        if ((action as string) === 'get_items') jest.setSystemTime(t0 + 80_000);
        return reply;
      });
      try {
        tick(4 * 3600_000);
        t0 = Date.now();
        const result = (await fx.server.client.callTool(
          { name: 'find_upgrades', arguments: { slot: 'Body Armour', include_non_upgrades: true, limit: 20 } },
          undefined,
          { timeout: CALL_TIMEOUT_MS },
        )) as { isError?: boolean; content: Array<{ text: string }> };
        const elapsed = Date.now() - t0;
        const text = result.content.map((c) => c.text).join('\n');
        expect(result.isError).toBeFalsy();
        expect(http.calls.some((c) => /poe\.ninja/.test(c.url))).toBe(true);
        // every fetched listing was evaluated, and they are listed with native prices and the rates note
        expect(countOf(text, 'Evaluated') + countOf(text, 'Rejected')).toBe(20);
        expect(countOf(text, 'Evaluated')).toBeGreaterThan(0);
        expect(listings(text).length).toBe(countOf(text, 'Evaluated'));
        expect(text).toContain('Currency rates unavailable: showing native prices; the budget was enforced by the trade site only.');
        expect(text).not.toContain('≈');
        expect(elapsed).toBeLessThanOrEqual(90_000);
      } finally {
        releaseNinja();
      }
    },
    TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-T44

  describe('AC-T44 (WU-23, D-56): synthesized fetch data', () => {
    it('AC-T44 (a): a null entry and a price-less listing are dropped and counted as Unavailable 2; the rest are evaluated', async () => {
      serve([
        searchSequence([SESSION_SEARCH]),
        fetchRoute({ entryFor: (id, i) => (id === SESSION_IDS[2] ? null : id === SESSION_IDS[4] ? deriveListing(id, i, { price: null }) : undefined) }),
      ]);
      const out = await call({ slot: 'Body Armour', include_non_upgrades: true, limit: 20 });
      expect(out.isError).toBe(false);
      expect(countOf(out.text, 'Fetched')).toBe(20);
      expect(countOf(out.text, 'Unavailable')).toBe(2);
      expect(countOf(out.text, 'Evaluated') + countOf(out.text, 'Rejected')).toBe(18);
      expect(listings(out.text).length).toBe(countOf(out.text, 'Evaluated'));
    }, TIMEOUT);

    it('AC-T44 (b): all search totals 0 -> "No listings matched the search."', async () => {
      let n = 0;
      const zero = () => {
        n += 1;
        tick(7_000); // keep the limiter's search windows clear between this call's 5 searches
        return { status: 200, body: searchBody(`t44b-${n}`, 0, []) };
      };
      serve([searchSequence([zero]), fetchRoute()]);
      const out = await call({ slot: 'Body Armour' });
      expect(out.isError).toBe(false);
      expect(searchCalls(http.calls)).toHaveLength(5);
      expect(fetchCalls(http.calls)).toHaveLength(0);
      expect(out.text).toContain('No listings matched the search.');
      expect(out.text).not.toContain('No upgrade within budget');
    }, TIMEOUT);

    it('AC-T44 (c): every fetched item rejected -> "All <n> fetched items were rejected:"', async () => {
      serve([
        searchSequence([SESSION_SEARCH]),
        fetchRoute({
          entryFor: (id, i) => {
            const ring = JSON.parse(JSON.stringify(RING_TEMPLATE[i % RING_TEMPLATE.length])) as FetchListing;
            ring.id = id;
            return ring;
          },
        }),
      ]);
      const out = await call({ slot: 'Body Armour' });
      expect(out.isError).toBe(false);
      expect(countOf(out.text, 'Evaluated')).toBe(0);
      expect(out.text).toMatch(/All 20 fetched items were rejected: \S/);
      // "No upgrade within budget." is always stated when there is none (C-14), after the rejected line; then the pace
      // line (D-474, this test server's pace is off) and the search link, last (C-14).
      const tail = out.text.split('\n').slice(-4);
      expect(tail[0]).toMatch(/^All 20 fetched items were rejected: \S.*\.$/);
      expect(tail[1]).toBe('No upgrade within budget.');
      expect(tail[2]).toBe('Pace: off (test setting).');
      expect(tail[3]).toMatch(/^Search on the trade site: /);
    }, TIMEOUT);

    it('AC-T44 (c): when the deadline cuts evaluation after one all-rejected block, the rejected count is not called "all" of the fetched items', async () => {
      serve([
        searchSequence([SESSION_SEARCH]),
        fetchRoute({
          entryFor: (id, i) => {
            const ring = JSON.parse(JSON.stringify(RING_TEMPLATE[i % RING_TEMPLATE.length])) as FetchListing;
            ring.id = id;
            return ring;
          },
        }),
      ]);
      const original = PoBLuaApiClient.prototype.tradeEvaluateItems;
      let t0 = 0;
      jest.spyOn(PoBLuaApiClient.prototype, 'tradeEvaluateItems').mockImplementation(async function (this: PoBLuaApiClient, params, opts) {
        const result = await original.call(this, params, opts);
        jest.setSystemTime(t0 + 89_500); // < 1 s left: the second block is not started
        return result;
      });
      tick(4 * 3600_000);
      t0 = Date.now();
      const result = (await fx.server.client.callTool({ name: 'find_upgrades', arguments: { slot: 'Body Armour' } }, undefined, {
        timeout: CALL_TIMEOUT_MS,
      })) as { isError?: boolean; content: Array<{ text: string }> };
      const text = result.content.map((c) => c.text).join('\n');
      expect(result.isError).toBeFalsy();
      expect(countOf(text, 'Fetched')).toBe(20);
      expect(countOf(text, 'Evaluated')).toBe(0);
      expect(countOf(text, 'Rejected')).toBe(10);
      expect(text).toMatch(/^Stopped early: the 90 s budget ran out\.$/m);
      expect(text).not.toMatch(/All \d+ fetched items were rejected/);
      expect(text).toMatch(/^10 of 20 fetched items were rejected: \S.*\.$/m);
      expect(text).toMatch(/^No upgrade within budget\.$/m);
    }, TIMEOUT);

    it('AC-T44 (d): a network error on the second page after the first was evaluated -> no isError, the first page, "Stopped early"', async () => {
      const base = fetchRoute();
      let n = 0;
      serve([
        searchSequence([SESSION_SEARCH]),
        {
          match: FETCH_URL,
          respond: (url, init) => {
            n += 1;
            if (n === 2) return Promise.reject(new TypeError('fetch failed'));
            return (base.respond as (u: string, i: RequestInit | undefined) => Promise<Response>)(url, init);
          },
        },
      ]);
      const out = await call({ slot: 'Body Armour', include_non_upgrades: true, limit: 20 });
      expect(out.isError).toBe(false);
      expect(out.text).toMatch(/^Stopped early: network error contacting the trade site\.$/m);
      expect(countOf(out.text, 'Fetched')).toBe(10);
      expect(countOf(out.text, 'Evaluated') + countOf(out.text, 'Rejected')).toBe(10);
      expect(listings(out.text).length).toBe(countOf(out.text, 'Evaluated'));
      expect(out.text.split('\n').pop()).toMatch(/^Search on the trade site: /);
    }, TIMEOUT);

    it('AC-T44 (e): an evaluate step that would need more than the remaining budget is not started -> "budget ran out", within the deadline', async () => {
      serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
      const original = PoBLuaApiClient.prototype.tradeEvaluateItems;
      let t0 = 0;
      const timeouts: Array<number | undefined> = [];
      const spy = jest.spyOn(PoBLuaApiClient.prototype, 'tradeEvaluateItems').mockImplementation(async function (
        this: PoBLuaApiClient,
        params,
        opts,
      ) {
        timeouts.push(opts?.timeoutMs);
        const result = await original.call(this, params, opts);
        // This block used up the budget: < 1 s of the 90 s is left when it returns.
        jest.setSystemTime(t0 + 89_500);
        return result;
      });
      tick(4 * 3600_000);
      t0 = Date.now();
      const result = (await fx.server.client.callTool({ name: 'find_upgrades', arguments: { slot: 'Body Armour', include_non_upgrades: true } }, undefined, {
        timeout: CALL_TIMEOUT_MS,
      })) as { isError?: boolean; content: Array<{ text: string }> };
      const elapsed = Date.now() - t0;
      const text = result.content.map((c) => c.text).join('\n');
      expect(result.isError).toBeFalsy();
      expect(spy).toHaveBeenCalledTimes(1); // the second block was not started
      expect(timeouts).toHaveLength(1);
      expect(text).toMatch(/^Stopped early: the 90 s budget ran out\.$/m);
      expect(countOf(text, 'Evaluated') + countOf(text, 'Rejected')).toBe(10);
      expect(elapsed).toBeLessThanOrEqual(90_000);
    }, TIMEOUT);

    it('AC-T44 (e): an evaluate step whose clipped time runs out is ended at the deadline without killing the engine -> "budget ran out", not isError', async () => {
      serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
      const originalRequest = PoBLuaApiClient.prototype.request;
      let t0 = 0;
      jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, action, params, opts) {
        const reply = await originalRequest.call(this, action, params, opts);
        // The current item is read just before evaluation: leave 2.5 s of the 90 s budget.
        if ((action as string) === 'get_items') jest.setSystemTime(t0 + 87_500);
        return reply;
      });
      const original = PoBLuaApiClient.prototype.tradeEvaluateItems;
      const timeouts: Array<number | undefined> = [];
      const spy = jest.spyOn(PoBLuaApiClient.prototype, 'tradeEvaluateItems').mockImplementation(async function (
        this: PoBLuaApiClient,
        params,
        opts,
      ) {
        timeouts.push(opts?.timeoutMs);
        // A block that needs longer than the 2.5 s left: the engine is busy for 6 s first.
        await this.request('__test_sleep', { ms: 6_000 }, opts);
        return original.call(this, params, opts);
      });
      const pid = fx.session.enginePid();
      expect(pid).not.toBeNull();
      tick(4 * 3600_000);
      t0 = Date.now();
      const result = (await fx.server.client.callTool({ name: 'find_upgrades', arguments: { slot: 'Body Armour', include_non_upgrades: true } }, undefined, {
        timeout: CALL_TIMEOUT_MS,
      })) as { isError?: boolean; content: Array<{ text: string }> };
      const elapsed = Date.now() - t0;
      const text = result.content.map((c) => c.text).join('\n');
      expect(result.isError).toBeFalsy();
      expect(text).not.toMatch(/engine exited/);
      expect(spy).toHaveBeenCalledTimes(1);
      // the step's timeout was clipped to the time left (C-14), and the deadline still ended it cleanly
      expect(timeouts[0]).toBeLessThanOrEqual(2_500);
      expect(text).toMatch(/^Stopped early: the 90 s budget ran out\.$/m);
      expect(countOf(text, 'Fetched')).toBe(20);
      expect(countOf(text, 'Evaluated')).toBe(0);
      expect(text).toMatch(/^No upgrade within budget\.$/m);
      expect(text.split('\n').pop()).toMatch(/^Search on the trade site: /);
      expect(elapsed).toBeLessThanOrEqual(90_000);
      // the engine was not killed: same process, and the next call works
      expect(fx.session.enginePid()).toBe(pid);
      jest.restoreAllMocks();
      const info = await fx.call('lua_get_build_info');
      expect(info.isError).toBe(false);
      expect(fx.session.enginePid()).toBe(pid);
    }, TIMEOUT);
  });

  // -------------------------------------------------------------------------------------------------

  describe('AC-T45 (WU-23): header, reload notice, fallback rendering, disposition', () => {
    it('AC-T45: the Build: line names grenadator and grenadator.xml', async () => {
      serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
      const out = await call({ slot: 'Body Armour' });
      expect(out.isError).toBe(false);
      expect(out.text).toMatch(/^Build: grenadator \(grenadator\.xml\)$/m);
      // C-49's League: and Checked: lines (D-372, WU-74), then the status, budget and sort.
      expect(out.text).toMatch(/^League: Forbidden Rites\nChecked: \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\nInstant buyout · Budget: no budget · Sort: .+ ×/m);
      expect(out.text).toMatch(/^Current item: \S.* · Baseline score -?\d+\.\d{4}$/m);
    }, TIMEOUT);

    it('AC-T45: with grenadator.xml changed on disk and the engine clean, the output starts with the Reloaded notice', async () => {
      const reload = await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
      expect(reload.isError).toBe(false);
      const file = path.join(fx.builds, 'grenadator.xml');
      writeBuild(file, goldenWithLevel(89));
      try {
        serve([searchSequence([SESSION_SEARCH]), fetchRoute()]);
        const out = await call({ slot: 'Body Armour' });
        expect(out.isError).toBe(false);
        expect(out.text.startsWith('Reloaded grenadator.xml')).toBe(true);
        expect(out.text).toContain('=== find_upgrades: Body Armour ===');
      } finally {
        writeBuild(file, GOLDEN_XML);
        await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
      }
    }, TIMEOUT);

    it(
      'AC-T40 (NFR-10, D-53) with a session notice: the Reloaded notice counts toward the 30,000 characters',
      async () => {
        const file = path.join(fx.builds, 'grenadator.xml');
        const reload = await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
        expect(reload.isError).toBe(false);
        // Every listing gets a whisper (its Buy line), long enough that 20 full listings exceed the
        // budget; one listing's whisper is then padded to bring the output to within a few characters of it.
        const filler = 'w'.repeat(1_000);
        const routes = (padded: number | null, pad: string) => [
          searchSequence([SESSION_SEARCH]),
          fetchRoute({
            entryFor: (id, i) => {
              const k = SESSION_IDS.indexOf(id);
              return deriveListing(id, i, { whisper: `@seller-${k} hi ${filler}${k === padded ? ` ${pad}` : ''}` });
            },
          }),
        ];
        const args = { slot: 'Body Armour', limit: 20, include_non_upgrades: true };

        serve(routes(null, ''));
        const plain = await call(args);
        expect(plain.isError).toBe(false);
        expect(plain.text.startsWith('=== find_upgrades: Body Armour ===')).toBe(true); // no notices
        expect(plain.text).toMatch(/shown compactly/);
        const first = /^ {3}Buy: @seller-(\d+) hi w+$/m.exec(plain.text);
        expect(first).not.toBeNull();
        const padded = Number(first![1]);
        const pad = 'x'.repeat(Math.max(0, 30_000 - plain.text.length - 5));

        // Same build bytes plus a newline: the session reloads it (engine clean) and adds its notice.
        writeBuild(file, `${GOLDEN_XML}\n`);
        try {
          serve(routes(padded, pad));
          const out = await call(args);
          expect(out.isError).toBe(false);
          expect(out.text.startsWith('Reloaded grenadator.xml')).toBe(true);
          const head = out.text.slice(0, out.text.indexOf('\n\n') + 2);
          // Rendered without room for the notice, the padded report alone would be 29,995 characters,
          // and the notice would push the output over the budget.
          expect(plain.text.length + pad.length + head.length).toBeGreaterThan(30_000);
          expect(out.text.length).toBeLessThanOrEqual(30_000);
          expect(out.text).toMatch(/listings? (?:is|are) shown compactly to keep this output under 30,000 characters/);
          expect(out.text.split('\n').pop()).toMatch(/^Search on the trade site: /);
        } finally {
          writeBuild(file, GOLDEN_XML);
          await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
        }
      },
      TIMEOUT,
    );

    it('AC-T45: a fallback renders with isError false, starting "Trade search not run:", and sends no request', async () => {
      creds = { sessionId: null, source: null };
      serve([]);
      const out = await call({ slot: 'Body Armour', required_mods: [{ trade_id: LIFE, min: 80 }] });
      expect(out.isError).toBe(false);
      expect(out.text.startsWith('Trade search not run: no POESESSID set.')).toBe(true);
      expect(out.text).toMatch(/\nhttps:\/\/www\.pathofexile\.com\/trade2\/search\/poe2\/Forbidden%20Rites\?q=\S+$/);
      // AC-K79 (D-474): the pace line (this test server's pace is off) just before the link's two lines.
      expect(out.text.split('\n').slice(-3)[0]).toBe('Pace: off (test setting).');
      expect(http.calls).toEqual([]);
    }, TIMEOUT);

    it('AC-T45: tool-disposition.json has no pending left, and listTools has 85 tools (AC-F25; 76 + set_gem_corruption (D-91) + lookup_game_data (C-37) + encode_build_code (C-42) + check_model_coverage (C-38) + set_tree_state (C-40) + manage_sets (C-39) + compile_plan (C-41) + guide_run (C-50) + get_node_power (C-55))', async () => {
      expect(DISPOSITION.filter((e) => e.pending !== undefined)).toEqual([]);
      const listed = (await fx.server.client.listTools()).tools.map((t) => t.name);
      expect(listed).toHaveLength(85);
      expect(listed).toContain('find_upgrades');
      expect(TOOL_META.find_upgrades).toEqual({ engine: 'read', group: 'trade' });
    });
  });
});

describe('C-14 (WU-23): the find_upgrades JSON-Schema literal agrees with its zod schema', () => {
  type Prop = Record<string, unknown> & { type?: string; items?: { type?: string; properties?: Record<string, Prop>; required?: string[] } };
  const literal = getTradeToolSchemas().find((t: { name: string }) => t.name === 'find_upgrades') as {
    description: string;
    inputSchema: { properties: Record<string, Prop>; required: string[] };
  };
  const fromZod = zodToJsonSchema(findUpgradesInputSchema) as { properties: Record<string, Prop>; required: string[] };
  const KEYS = ['type', 'enum', 'minimum', 'maximum', 'exclusiveMinimum', 'minLength', 'minItems', 'maxItems'];
  const pick = (p: Prop | undefined) => Object.fromEntries(KEYS.filter((k) => p && p[k] !== undefined).map((k) => [k, p![k]]));

  it('C-14: property names, types, enums, ranges and required agree (nested items too)', () => {
    expect(Object.keys(literal.inputSchema.properties).sort()).toEqual(Object.keys(fromZod.properties).sort());
    expect([...literal.inputSchema.required].sort()).toEqual([...fromZod.required].sort());
    for (const [name, z] of Object.entries(fromZod.properties)) {
      const l = literal.inputSchema.properties[name];
      expect({ name, ...pick(l) }).toEqual({ name, ...pick(z) });
      if (z.items) {
        expect(pick(l.items as Prop)).toEqual(pick(z.items as Prop));
        const zp = z.items.properties ?? {};
        const lp = l.items?.properties ?? {};
        expect(Object.keys(lp).sort()).toEqual(Object.keys(zp).sort());
        for (const k of Object.keys(zp)) expect({ k, ...pick(lp[k]) }).toEqual({ k, ...pick(zp[k]) });
        expect([...(l.items?.required ?? [])].sort()).toEqual([...(z.items.required ?? [])].sort());
      }
    }
  });

  it('C-1: the description is at most 2048 characters', () => {
    expect(literal.description.length).toBeLessThanOrEqual(2048);
  });
});
