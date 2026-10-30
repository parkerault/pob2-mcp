/**
 * AC-K79 (WU-129, D-474): the trade tools' pace line, so a pricing step can tell a server that paces its trade searches
 * (D-461) from one built before it.
 *
 * - In process (startTestServer, C-18), HTTP only through `fixtureFetch` and the committed trade2 and poe.ninja
 *   fixtures; the server's pace is the test's setting (`tradePace`), on a fake clock whose trade sleep advances it.
 * - `search_trade_items` and `get_item_price` replies end with `Pace: 45 s between searches, at most 7 in 5 minutes.`
 *   (the server's pace on) or `Pace: off (test setting).` (`tradePace: null`, startTestServer's default); a
 *   `would_wait` error reply carries the line; an argument error the router refuses before the handler carries none.
 * - `find_upgrades`: the line is just before the search link, which stays last (C-14), within D-53's 30,000
 *   characters (the renderer, with fakes), in a fallback, in an error that carries the link, and in the router's
 *   engine-busy stop. Its MCP rows with the engine are in `findUpgrades.test.ts` and `findUpgradesBounds.test.ts`.
 */
import { spawn } from 'child_process';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import fs from 'fs';
import path from 'path';
import { fixtureFetch, type FixtureRespond } from '../helpers/fixtureFetch';
import { TRADE_SEARCH_PACE, type SearchPace } from '../../src/trade/rateLimiter';
import { paceLine } from '../../src/handlers/tradeHandlers';
import { LINK_INTRO, OUTPUT_BUDGET, renderFallback, renderUpgradeReport, withPaceBeforeLink, type UpgradeReport } from '../../src/trade/renderUpgrades';
import type { ListingRow } from '../../src/trade/rankUpgrades';
import { routeToolCall, type ToolRouterDependencies } from '../../src/server/toolRouter';
import { createEngineSession, type SessionClient } from '../../src/engine/session';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

const PACE_ON = 'Pace: 45 s between searches, at most 7 in 5 minutes.';
const PACE_OFF = 'Pace: off (test setting).';
const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };
const LEAGUE = 'Runes of Aldur';

const lastLine = (text: string) => text.split('\n').pop();

let server: TestServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

/** An in-process server whose trade traffic is the committed fixtures, on a fake clock its trade sleep advances. */
async function tradeServer(
  pace: { tradePace?: SearchPace | null },
  search = 'trade2/search-ring-divine',
  fetched: FixtureRespond = { fixture: 'trade2/fetch-ring-divine' },
): Promise<TestServer> {
  let t = 7_000_000;
  const ff = fixtureFetch([
    { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
    { match: /\/api\/trade2\/search\//, respond: { fixture: search } },
    { match: /\/api\/trade2\/fetch\//, respond: fetched },
    { match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
  ]);
  server = await startTestServer({
    fetch: ff.fetch,
    env: ENV,
    now: () => t,
    tradeSleep: async (ms: number) => {
      t += ms;
    },
    ...pace,
  });
  return server;
}

async function call(s: TestServer, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return (await s.client.callTool({ name, arguments: args })) as ToolResult;
}

describe('AC-K79 (D-474): search_trade_items and get_item_price end with the pace line', () => {
  it('with the server pace on, each reply ends with "Pace: 45 s between searches, at most 7 in 5 minutes."', async () => {
    const s = await tradeServer({ tradePace: TRADE_SEARCH_PACE });
    const searched = await call(s, 'search_trade_items', { league: LEAGUE, item_type: 'ring' });
    expect(searched.isError).toBeFalsy();
    expect(searched.content[0].text).toContain('League: Runes of Aldur');
    expect(lastLine(searched.content[0].text)).toBe(PACE_ON);
    const priced = await call(s, 'get_item_price', { item_name: 'Blight Turn', league: LEAGUE, item_type: 'ring' });
    expect(priced.isError).toBeFalsy();
    expect(priced.content[0].text).toContain('=== Price Check: Blight Turn ===');
    expect(lastLine(priced.content[0].text)).toBe(PACE_ON);
    // An item the currency exchange sells is priced from poe.ninja, with no trade search: its reply carries the line too.
    const exchange = await call(s, 'get_item_price', { item_name: 'Divine Orb', league: LEAGUE });
    expect(exchange.isError).toBeFalsy();
    expect(lastLine(exchange.content[0].text)).toBe(PACE_ON);
  });

  it("with startTestServer's default (tradePace: null), each reply ends with \"Pace: off (test setting).\"", async () => {
    const s = await tradeServer({});
    expect(s.deps.tradePace).toBeNull();
    for (const [name, args] of [
      ['search_trade_items', { league: LEAGUE, item_type: 'ring' }],
      ['get_item_price', { item_name: 'Blight Turn', league: LEAGUE, item_type: 'ring' }],
    ] as const) {
      const out = await call(s, name, args);
      expect({ name, isError: out.isError ?? false }).toEqual({ name, isError: false });
      expect(lastLine(out.content[0].text)).toBe(PACE_OFF);
    }
  });

  it('a reply with no listings ends with the line too', async () => {
    const s = await tradeServer({ tradePace: TRADE_SEARCH_PACE }, 'trade2/search-empty');
    const out = await call(s, 'search_trade_items', { league: LEAGUE, item_name: 'Nothing Like It' });
    expect(out.isError).toBeFalsy();
    expect(out.content[0].text).toContain('No items found');
    expect(lastLine(out.content[0].text)).toBe(PACE_ON);
  });

  it('a would_wait error reply carries the line (a pace whose gap is past the 60 s wait cap)', async () => {
    const s = await tradeServer({ tradePace: { gapMs: 120_000, cap: null } });
    expect((await call(s, 'search_trade_items', { league: LEAGUE, item_type: 'ring' })).isError).toBeFalsy();
    const refused = await call(s, 'get_item_price', { item_name: 'Blight Turn', league: LEAGUE, item_type: 'ring' });
    expect(refused.isError).toBe(true);
    const text = refused.content[0].text;
    expect(text.startsWith('Error: [trade:would_wait] Failed to get item price: ')).toBe(true);
    expect(lastLine(text)).toBe('Pace: 2 minutes between searches.');
    const again = await call(s, 'search_trade_items', { league: LEAGUE, item_type: 'ring' });
    expect(again.content[0].text.startsWith('Error: [trade:would_wait] Failed to search trade items: ')).toBe(true);
    expect(lastLine(again.content[0].text)).toBe('Pace: 2 minutes between searches.');
  });

  it('an argument error the router refuses before the handler carries no line', async () => {
    const s = await tradeServer({ tradePace: TRADE_SEARCH_PACE });
    const out = await call(s, 'search_trade_items', {});
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe('Error: Missing required argument: league');
  });

  it("a long search_trade_items reply is cut before the line, so C-1's 5,000 characters keep it last", async () => {
    // The ring fixture's ten listings, each named with 600 characters: the listings alone run past 6,000.
    const fixture = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'trade2', 'fetch-ring-divine.response.json'), 'utf8'),
    ) as { result: Array<{ item: { name: string } }> };
    fixture.result.forEach((r, i) => (r.item.name = `Long Name ${i} ${'x'.repeat(600)}`));
    const s = await tradeServer({ tradePace: TRADE_SEARCH_PACE }, 'trade2/search-ring-divine', { status: 200, body: fixture });
    const out = await call(s, 'search_trade_items', { league: LEAGUE, item_type: 'ring', limit: 10 });
    expect(out.isError).toBeFalsy();
    const text = out.content[0].text;
    expect(text).toContain('[Response truncated: ');
    expect(text).toContain('Long Name 0 ');
    expect(text.length).toBeLessThanOrEqual(5000);
    expect(lastLine(text)).toBe(PACE_ON);
  });

  it('the line reads the server pace as set: on, off, or another gap and cap', () => {
    expect(paceLine(TRADE_SEARCH_PACE)).toBe(PACE_ON);
    expect(paceLine(undefined)).toBe(PACE_ON);
    expect(paceLine(null)).toBe(PACE_OFF);
    expect(paceLine({ gapMs: 0, cap: { max: 3, periodMs: 10_000 } })).toBe('Pace: at most 3 in 10 s.');
  });
});

// ---------------------------------------------------------------------------------------------------
// find_upgrades, with fakes

function row(i: number, itemText: string): ListingRow {
  return {
    id: `id${i}`,
    name: `Listing ${i}`,
    baseType: 'Expert Hexer\'s Robe',
    price: { amount: 10 + i, currency: 'exalted' },
    normalized: null,
    priceNotConverted: true,
    account: `seller${i}`,
    whisper: null,
    score: 1.5 + i / 100,
    isUpgrade: true,
    stats: {},
    itemText,
    entry: null,
  } as unknown as ListingRow;
}

function report(listings: ListingRow[], pace?: string): UpgradeReport {
  return {
    slot: 'Body Armour',
    build: { displayName: 'golden', path: 'golden.xml' },
    league: LEAGUE,
    checkedAt: Date.UTC(2026, 9, 30, 12),
    status: 'securable',
    budget: null,
    sort: [{ stat: 'TotalEHP', label: 'Effective HP', weight: 1 }],
    reportStats: [],
    notices: [],
    currentItem: 'empty',
    baselineScore: 1,
    counts: { searches: 1, total: 100, fetched: listings.length, unavailable: 0, evaluated: listings.length, rejected: 0, overBudget: 0, upgrades: listings.length },
    listings,
    display: 'divine',
    query: {},
    closing: null,
    ...(pace ? { paceLine: pace } : {}),
    searchUrl: 'https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/abc',
  };
}

describe('AC-K79 (D-474): find_upgrades has the line just before the search link, which stays last', () => {
  it('a report with the line: the line second to last, the link last, within the 30,000-character budget even when listings must compact', () => {
    const big = Array.from({ length: 20 }, (_, i) => row(i, `Rarity: Rare\n${'Some long modifier line\n'.repeat(120)}`));
    for (const reserved of [0, 2000]) {
      const text = renderUpgradeReport(report(big, PACE_ON), reserved);
      const lines = text.split('\n');
      expect(lines[lines.length - 1]).toBe('Search on the trade site: https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/abc');
      expect(lines[lines.length - 2]).toBe(PACE_ON);
      expect(text.length + reserved).toBeLessThanOrEqual(OUTPUT_BUDGET);
      expect(text).toContain('shown compactly');
    }
  });

  it('a fallback has the line before its link, the link last', () => {
    const text = renderFallback({ reason: 'no trade session', hint: 'Log in.', notes: ['A note.'], link: 'https://x/trade2/search/poe2/L/q' }, PACE_OFF);
    expect(text.split('\n').slice(-3)).toEqual([PACE_OFF, LINK_INTRO, 'https://x/trade2/search/poe2/L/q']);
  });

  it('an error that carries the link gets the line before it; one without a link ends with it', () => {
    expect(withPaceBeforeLink(`Stopped early: the 90 s budget ran out.\n${LINK_INTRO}\nhttps://x/q`, PACE_ON).split('\n')).toEqual([
      'Stopped early: the 90 s budget ran out.',
      PACE_ON,
      LINK_INTRO,
      'https://x/q',
    ]);
    expect(withPaceBeforeLink('invalid find_upgrades argument slot: Required', PACE_ON)).toBe(`invalid find_upgrades argument slot: Required\n${PACE_ON}`);
  });

  it("the router's engine-busy stop, a find_upgrades result, ends with the line", async () => {
    jest.useFakeTimers({ now: new Date('2026-10-30T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
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
      const deps = { session, env: {}, ensureTradeStats: async () => undefined, tradePace: null } as unknown as ToolRouterDependencies;
      const pending = routeToolCall('find_upgrades', { slot: 'Body Armour' }, deps, {
        signal: new AbortController().signal,
        sendProgress: async () => undefined,
        arrivedAt: Date.now(),
      });
      let settled = false;
      void pending.then(() => (settled = true));
      for (let t = 0; !settled && t < 100_000; t += 500) await jest.advanceTimersByTimeAsync(500);
      const result = await pending;
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Stopped early: the engine was busy.');
      expect(lastLine(result.content[0].text)).toBe(PACE_OFF);
      release();
      await holder;
    } finally {
      jest.useRealTimers();
    }
  });
});
