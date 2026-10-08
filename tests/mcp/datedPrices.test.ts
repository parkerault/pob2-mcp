/**
 * T1 (WU-49, C-49): every price result states its league and the time it was checked. In process
 * (startTestServer, C-18); HTTP only via `fixtureFetch`, serving the trade2 and poe.ninja fixtures.
 *
 * The clock is injected: `now = () => T0 + elapsed`, T0 = 2026-10-07T12:00:00Z. `elapsed` is real time
 * since the server started, plus whatever a test adds with `advance`. The server uses it as its wall
 * clock (`ServerDeps.now ?? Date.now`), so a `Checked:` time must fall between T0 and the clock's
 * reading when the call returns.
 *
 * - AC-K39: `get_item_price` prints `League: <id>`, then `Checked: <YYYY-MM-DDTHH:MM:SSZ>`, both before
 *   the first listing; "No price data found" (the `trade2/search-empty` fixture) carries both lines.
 * - AC-K40: `search_trade_items` prints both lines among its first five lines.
 * - AC-K41: nothing is cached (D-46), each call has its own `Checked:` line, and there is no batch mode
 *   (D-224): both tools' input properties are unchanged.
 */
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { describe, it, expect, afterEach } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type FixtureRoute, type RecordedCall } from '../helpers/fixtureFetch';
import { deriveListing, fetchRoute } from '../helpers/tradeFixtures';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };
const LEAGUE = 'Runes of Aldur';
const T0 = Date.parse('2026-10-07T12:00:00Z');
const CHECKED = /^Checked: (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)$/;

const SEARCH = /\/api\/trade2\/search\//;
const FETCH = /\/api\/trade2\/fetch\//;
const STATS_ROUTE: FixtureRoute = { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } };
const NINJA_ROUTE: FixtureRoute = { match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } };
const RING_ROUTES: FixtureRoute[] = [
  STATS_ROUTE,
  { match: SEARCH, respond: { fixture: 'trade2/search-ring-divine' } },
  { match: FETCH, respond: { fixture: 'trade2/fetch-ring-divine' } },
  NINJA_ROUTE,
];
const EMPTY_ROUTES: FixtureRoute[] = [STATS_ROUTE, { match: SEARCH, respond: { fixture: 'trade2/search-empty' } }, NINJA_ROUTE];

/** The injected clock: `T0 + elapsed`. */
function injectedClock(): { now: () => number; advance(ms: number): void } {
  const start = performance.now();
  let added = 0;
  return {
    now: () => T0 + (performance.now() - start) + added,
    advance: (ms) => {
      added += ms;
    },
  };
}

let server: TestServer | null = null;
let calls: RecordedCall[] = [];
let clock = injectedClock();

afterEach(async () => {
  await server?.close();
  server = null;
});

async function startWith(routes: FixtureRoute[]): Promise<void> {
  const ff = fixtureFetch(routes);
  calls = ff.calls;
  clock = injectedClock();
  server = await startTestServer({ fetch: ff.fetch, env: ENV, now: clock.now });
}

/** One tool call, with the clock read before and after it. */
async function call(name: string, args: Record<string, unknown>): Promise<{ text: string; lines: string[]; before: number; after: number }> {
  const before = clock.now();
  const res = (await server!.client.callTool({ name, arguments: args })) as ToolResult;
  const after = clock.now();
  const text = res.content.map((c) => c.text).join('\n');
  expect(res.isError).toBeFalsy();
  return { text, lines: text.split('\n'), before, after };
}

/** The one `Checked:` line: its index and its time (ms). Fails unless there is exactly one, in the C-49 format. */
function checkedLine(lines: string[]): { index: number; at: number } {
  const indices = lines.flatMap((l, i) => (l.startsWith('Checked:') ? [i] : []));
  expect(indices).toHaveLength(1);
  const m = CHECKED.exec(lines[indices[0]]);
  expect(m).not.toBeNull();
  return { index: indices[0], at: Date.parse(m![1]) };
}

/** T0 <= t <= T0 + elapsed, with t no earlier than the call's start (to the second it is shown in). */
function expectWithinCall(at: number, before: number, after: number): void {
  expect(at).toBeGreaterThanOrEqual(T0);
  expect(at).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
  expect(at).toBeLessThanOrEqual(after);
}

const searches = () => calls.filter((c) => SEARCH.test(c.url) && c.method === 'POST');
const fetches = () => calls.filter((c) => FETCH.test(c.url));

describe('AC-K39 (WU-49, C-49): get_item_price states its league and check time', () => {
  it('AC-K39: prints "League: Runes of Aldur", then a "Checked:" UTC time within the call, both before the first listing', async () => {
    await startWith(RING_ROUTES);
    const { lines, before, after } = await call('get_item_price', { item_name: 'x', league: LEAGUE });

    const leagueIndex = lines.indexOf(`League: ${LEAGUE}`);
    expect(leagueIndex).toBeGreaterThanOrEqual(0);
    expect(lines.filter((l) => l.startsWith('League:'))).toHaveLength(1);
    const checked = checkedLine(lines);
    expect(checked.index).toBeGreaterThan(leagueIndex);
    expectWithinCall(checked.at, before, after);

    const firstListing = lines.findIndex((l) => /^ {2}1\. .+: \d/.test(l));
    expect(firstListing).toBeGreaterThan(0);
    expect(leagueIndex).toBeLessThan(firstListing);
    expect(checked.index).toBeLessThan(firstListing);
  });

  it('AC-K39: with the trade2/search-empty fixture, "No price data found" carries both lines', async () => {
    await startWith(EMPTY_ROUTES);
    const { text, lines, before, after } = await call('get_item_price', { item_name: 'x', league: LEAGUE });

    expect(text).toContain(`No price data found for "x" in ${LEAGUE}.`);
    expect(lines).toContain(`League: ${LEAGUE}`);
    expectWithinCall(checkedLine(lines).at, before, after);
    // The fixture is the answer to the query this call sent, and no fetch follows an empty search.
    expect(searches()).toHaveLength(1);
    const request = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'trade2', 'search-empty.request.json'), 'utf8'));
    expect(JSON.parse(searches()[0].body as string)).toEqual(request);
    expect(fetches()).toHaveLength(0);
  });

  it('C-49: "No priced listings found" carries both lines', async () => {
    const priceless = fetchRoute({ entryFor: (id, i) => deriveListing(id, i, { price: null }) });
    await startWith([STATS_ROUTE, { match: SEARCH, respond: { fixture: 'trade2/search-ring-divine' } }, priceless, NINJA_ROUTE]);
    const { text, lines, before, after } = await call('get_item_price', { item_name: 'x', league: LEAGUE });

    expect(text).toContain(`No priced listings found for "x" in ${LEAGUE}.`);
    expect(lines).toContain(`League: ${LEAGUE}`);
    expectWithinCall(checkedLine(lines).at, before, after);
    expect(priceless.count()).toBe(1);
  });
});

describe('AC-K40 (WU-49, C-49): search_trade_items states its league and check time', () => {
  it('AC-K40: both lines are among the first five output lines', async () => {
    await startWith(RING_ROUTES);
    const { lines, before, after } = await call('search_trade_items', {
      league: LEAGUE,
      item_type: 'Ruby Ring',
      item_rarity: 'rare',
      limit: 5,
    });

    const head = lines.slice(0, 5);
    expect(head).toContain(`League: ${LEAGUE}`);
    const checked = checkedLine(lines);
    expect(checked.index).toBeLessThan(5);
    expectWithinCall(checked.at, before, after);
    // ...and so before the first listing.
    expect(lines.findIndex((l) => /^1\. /.test(l))).toBeGreaterThan(checked.index);
  });

  it('C-49: a search with no matches carries both lines', async () => {
    await startWith(EMPTY_ROUTES);
    const { text, lines, before, after } = await call('search_trade_items', { league: LEAGUE, item_name: 'x' });

    expect(text).toContain(`No items found matching your search criteria in ${LEAGUE} league.`);
    expect(lines).toContain(`League: ${LEAGUE}`);
    expectWithinCall(checkedLine(lines).at, before, after);
  });
});

describe('AC-K41 (WU-49, C-49, D-46, D-224): no cache, no batch mode', () => {
  it('AC-K41: two identical get_item_price calls make 2 searches and 2 fetches, each output with its own Checked line', async () => {
    await startWith(RING_ROUTES);
    const first = await call('get_item_price', { item_name: 'x', league: LEAGUE });
    expect(searches()).toHaveLength(1);
    expect(fetches()).toHaveLength(1);

    clock.advance(5_000);
    const second = await call('get_item_price', { item_name: 'x', league: LEAGUE });
    expect(searches()).toHaveLength(2);
    expect(fetches()).toHaveLength(2);
    expect(searches()[1].body).toBe(searches()[0].body);

    const a = checkedLine(first.lines).at;
    const b = checkedLine(second.lines).at;
    expectWithinCall(a, first.before, first.after);
    expectWithinCall(b, second.before, second.after);
    // The second output was dated by its own call, not carried over from the first.
    expect(b).toBeGreaterThan(a);
  });

  it("AC-K41: the price tools' input properties are unchanged (no batch mode)", async () => {
    await startWith(RING_ROUTES);
    const { tools } = await server!.client.listTools();
    const properties = (name: string): string[] => {
      const tool = tools.find((t) => t.name === name);
      expect(tool).toBeDefined();
      return Object.keys((tool!.inputSchema as { properties?: Record<string, unknown> }).properties ?? {}).sort();
    };
    expect(properties('get_item_price')).toEqual(['item_name', 'league', 'item_type', 'rarity'].sort());
    expect(properties('search_trade_items')).toEqual(
      [
        'league',
        'item_name',
        'item_type',
        'min_price',
        'max_price',
        'price_currency',
        'item_rarity',
        'min_rune_sockets',
        'corrupted',
        'identified',
        'mods',
        'limit',
      ].sort(),
    );
  });
});
