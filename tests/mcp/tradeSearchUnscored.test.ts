/**
 * D-61 (WU-04): `search_trade_items` loses its build-blind value scoring. In process
 * (startTestServer, C-18), HTTP only via `fixtureFetch`.
 *
 * - Listings keep the order the trade site returned (no re-sorting by a value score or by price).
 * - No value score, tier, best-value rank or per-chaos line is shown.
 * - Each listing keeps its native price (`<amount> <currency>`).
 *
 * The fetch body is the committed `trade2/fetch-weighted-session` capture (ids match
 * `trade2/search-weighted-session`, served with a short search id; unsorted, mixed chaos/exalted
 * prices), with each item's mod lines replaced by plain strings carrying distinct life /
 * resistance / ES rolls. The real trade2 mod lines are objects, which no text-based scorer can
 * read, so on the raw capture every listing would score the same and a stable score sort would
 * leave the order unchanged. With these strings the deleted value score (life/res/ES per chaos)
 * ranks the listings in a different order from the trade site's, and so does any sort by price;
 * the order assertion fails against either.
 *
 * WU-15 (AC-T46) later adds the primary-currency equivalent; this test asserts nothing about it, and
 * serves poe.ninja as failing so it holds whether or not a normalization fetch happens.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type RecordedCall } from '../helpers/fixtureFetch';

interface FetchFixture {
  result: Array<{
    id: string;
    item: { name?: string; typeLine: string; implicitMods?: unknown[]; explicitMods?: unknown[] };
    listing: { price?: { amount: number; currency: string } };
  }>;
}

const TRADE2 = path.resolve(__dirname, '..', 'fixtures', 'trade2');
const RAW_FETCH = JSON.parse(fs.readFileSync(path.join(TRADE2, 'fetch-weighted-session.response.json'), 'utf8')) as FetchFixture;

/**
 * The committed search response with a short search id. The real id is ~1 KB (base64 of the gzipped
 * 30-filter query) and every listing's link repeats it, so ten listings would overrun the tool's
 * 5000-character truncation (C-1); the id is opaque to the handler, which only echoes it.
 */
const SEARCH_BODY = {
  ...(JSON.parse(fs.readFileSync(path.join(TRADE2, 'search-weighted-session.response.json'), 'utf8')) as object),
  id: 'D61orderTest',
};

/**
 * String mod lines per fetch index, and the condensed `Stats:` line the formatter prints for them.
 * The rolls are chosen so the deleted analyzer's value score (capped life/res/ES per chaos, its
 * default rates) ranks the listings 4, 1, 2, 0, 9, 5, 6, 7, 8, 3 rather than 0..9 (checked against
 * `costBenefitAnalyzer.ts` from 58663e7).
 */
const ROLLS: Array<{ mods: string[]; stats: string }> = [
  { mods: ['+50 to maximum Life'], stats: '+50 Life' },
  { mods: ['+50 to maximum Life', '+30% to Fire Resistance'], stats: '+50 Life, +30% Res' },
  { mods: ['+30% to Cold Resistance'], stats: '+30% Res' },
  { mods: ['+120 to maximum Life', '+40% to Fire Resistance'], stats: '+120 Life, +40% Res' },
  {
    mods: ['+80 to maximum Life', '+40 to maximum Energy Shield', '+20% to Fire Resistance', '+20% to Cold Resistance'],
    stats: '+80 Life, +40 ES, +40% Res',
  },
  { mods: ['+30 to maximum Life'], stats: '+30 Life' },
  { mods: ['+5 to maximum Life'], stats: '+5 Life' },
  { mods: ['+8 to maximum Energy Shield'], stats: '+8 ES' },
  { mods: ['+100 to maximum Life', '+45% to Lightning Resistance'], stats: '+100 Life, +45% Res' },
  { mods: ['+45 to maximum Life', '+20% to Fire Resistance'], stats: '+45 Life, +20% Res' },
];

const FETCH_BODY: FetchFixture = {
  ...RAW_FETCH,
  result: RAW_FETCH.result.map((r, i) => ({
    ...r,
    item: { ...r.item, implicitMods: [], explicitMods: ROLLS[i].mods },
  })),
};

/** Fixed chaos rates, only to show the fixture's order is not a price order. */
const NOMINAL_CHAOS: Record<string, number> = { chaos: 1, exalted: 20, divine: 180 };

function isMonotone(values: number[]): boolean {
  const asc = values.every((v, i) => i === 0 || values[i - 1] <= v);
  const desc = values.every((v, i) => i === 0 || values[i - 1] >= v);
  return asc || desc;
}

describe('D-61 (WU-04): search_trade_items is unscored and keeps trade-site order', () => {
  let server: TestServer;
  let calls: RecordedCall[];
  let text: string;

  beforeAll(async () => {
    const ff = fixtureFetch([
      { match: /\/api\/trade2\/data\/stats/, respond: { fixture: 'trade2/data-stats' } },
      {
        match: /\/api\/trade2\/search\//,
        respond: { status: 200, headers: { 'content-type': 'application/json' }, body: SEARCH_BODY },
      },
      {
        match: /\/api\/trade2\/fetch\//,
        respond: { status: 200, headers: { 'content-type': 'application/json' }, body: FETCH_BODY },
      },
      { match: /poe\.ninja/, respond: { status: 503, body: 'unavailable' } },
    ]);
    calls = ff.calls;
    server = await startTestServer({
      fetch: ff.fetch,
      env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined },
    });
    const res = (await server.client.callTool({
      name: 'search_trade_items',
      arguments: { league: 'Standard', limit: 10 },
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };
    expect(res.isError).toBeFalsy();
    text = res.content.map((c) => c.text).join('\n');
  });

  afterAll(async () => {
    await server?.close();
  });

  it('D-61 (WU-04): the fetch order differs from any price or stat order, so a re-sort is detectable', () => {
    const results = FETCH_BODY.result;
    expect(new Set(results.map((r) => r.listing.price!.currency))).toEqual(new Set(['chaos', 'exalted']));
    expect(isMonotone(results.map((r) => r.listing.price!.amount))).toBe(false);
    expect(isMonotone(results.map((r) => r.listing.price!.amount * NOMINAL_CHAOS[r.listing.price!.currency]))).toBe(
      false,
    );
    const life = ROLLS.map((r) => Number(/\+(\d+) Life/.exec(r.stats)?.[1] ?? 0));
    expect(isMonotone(life)).toBe(false);
    expect(new Set(ROLLS.map((r) => r.stats)).size).toBe(ROLLS.length);
  });

  it('D-61 (WU-04): sends one trade2 search and one fetch of the returned ids', () => {
    const trade = calls.filter((c) => /\/api\/trade2\/(search|fetch)\//.test(c.url));
    expect(trade.map((c) => c.method)).toEqual(['POST', 'GET']);
    expect(trade[0].url).toMatch(/\/api\/trade2\/search\//);
    expect(trade[1].url).toMatch(/\/api\/trade2\/fetch\//);
    expect(trade[1].url).toContain(FETCH_BODY.result.map((r) => r.id).join(','));
  });

  it('D-61 (WU-04): listings appear in the order the trade site returned them, each with its native price and stats', () => {
    const listed = [...text.matchAll(/^(\d+)\. (.+)$/gm)].map((m) => ({ n: Number(m[1]), name: m[2].trim() }));
    const expected = FETCH_BODY.result.map((r, i) => ({ n: i + 1, name: r.item.name || r.item.typeLine }));
    expect(listed).toEqual(expected);

    const prices = [...text.matchAll(/^ {3}Price: (.+)$/gm)].map((m) => m[1]);
    expect(prices).toHaveLength(FETCH_BODY.result.length);
    FETCH_BODY.result.forEach((r, i) => {
      expect(prices[i].startsWith(`${r.listing.price!.amount} ${r.listing.price!.currency}`)).toBe(true);
    });

    // Each listing's own (distinct) stat summary, in fetch order.
    const stats = [...text.matchAll(/^ {3}Stats: (.+)$/gm)].map((m) => m[1]);
    expect(stats).toEqual(ROLLS.map((r) => r.stats));

    // Each item link follows its own listing, in the same order.
    const links = [...text.matchAll(/#([0-9a-f]{64})$/gm)].map((m) => m[1]);
    expect(links).toEqual(FETCH_BODY.result.map((r) => r.id));
  });

  it('D-61 (WU-04): no value score, tier, best-value rank or per-chaos line', () => {
    expect(text).not.toMatch(/value score|best value|per chaos|Value: \d|excellent|budget/i);
    expect(text).not.toMatch(/💎|✨|⚠️|💰/u);
  });
});
