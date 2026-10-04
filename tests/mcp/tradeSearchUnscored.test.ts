/**
 * D-61 (WU-04): `search_trade_items` loses its build-blind value scoring. In process
 * (startTestServer, C-18), HTTP only via `fixtureFetch` serving the committed trade2 ring fixtures.
 *
 * - Listings keep the order the trade site returned (no re-sorting by a value score).
 * - No value score, tier, best-value rank or per-chaos line is shown.
 * - Each listing keeps its native price (`<amount> <currency>`).
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
    item: { name?: string; typeLine: string };
    listing: { price?: { amount: number; currency: string } };
  }>;
}

const FETCH_FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'trade2', 'fetch-ring-divine.response.json'), 'utf8'),
) as FetchFixture;

describe('D-61 (WU-04): search_trade_items is unscored and keeps trade-site order', () => {
  let server: TestServer;
  let calls: RecordedCall[];
  let text: string;

  beforeAll(async () => {
    const ff = fixtureFetch([
      { match: /\/api\/trade2\/data\/stats/, respond: { fixture: 'trade2/data-stats' } },
      { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-ring-divine' } },
      { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-ring-divine' } },
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

  it('D-61 (WU-04): sends one trade2 search and one fetch of the returned ids', () => {
    const trade = calls.filter((c) => /\/api\/trade2\/(search|fetch)\//.test(c.url));
    expect(trade.map((c) => c.method)).toEqual(['POST', 'GET']);
    expect(trade[0].url).toMatch(/\/api\/trade2\/search\//);
    expect(trade[1].url).toMatch(/\/api\/trade2\/fetch\//);
    expect(trade[1].url).toContain(FETCH_FIXTURE.result[0].id);
  });

  it('D-61 (WU-04): listings appear in the order the trade site returned them, each with its native price', () => {
    const listed = [...text.matchAll(/^(\d+)\. (.+)$/gm)].map((m) => ({ n: Number(m[1]), name: m[2].trim() }));
    const expected = FETCH_FIXTURE.result.map((r, i) => ({ n: i + 1, name: r.item.name || r.item.typeLine }));
    expect(listed).toEqual(expected);

    const prices = [...text.matchAll(/^ {3}Price: (.+)$/gm)].map((m) => m[1]);
    expect(prices).toHaveLength(FETCH_FIXTURE.result.length);
    FETCH_FIXTURE.result.forEach((r, i) => {
      expect(prices[i].startsWith(`${r.listing.price!.amount} ${r.listing.price!.currency}`)).toBe(true);
    });
    // Each item link follows its own listing, in the same order.
    const links = [...text.matchAll(/#([0-9a-f]{64})$/gm)].map((m) => m[1]);
    expect(links).toEqual(FETCH_FIXTURE.result.map((r) => r.id));
  });

  it('D-61 (WU-04): no value score, tier, best-value rank or per-chaos line', () => {
    expect(text).not.toMatch(/value score|best value|per chaos|Value: \d|excellent|budget/i);
    expect(text).not.toMatch(/💎|✨|⚠️|💰/u);
  });
});
