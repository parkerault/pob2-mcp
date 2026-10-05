/**
 * AC-T46 (WU-15, D-61): `search_trade_items` shows each listing's native price and, where C-12
 * `convert` can place it, the primary-currency equivalent. In process (startTestServer, C-18); HTTP
 * only via `fixtureFetch`, serving the trade2 `search-weighted-session` / `fetch-weighted-session`
 * captures (mixed chaos and exalted prices) and the poe.ninja fixture.
 *
 * The search fixtures are served unmodified, with their real (~200 B to ~1 KB) search ids: at limit 10
 * the output must fit under the tool's 5000-character truncation (C-1) with every listing's price
 * shown. Derived listings change only `listing.price` (the 03 §6 fixture synthesis rule).
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type FixtureRespond } from '../helpers/fixtureFetch';
import { CurrencyService, convert, formatCurrencyValue, type Rates } from '../../src/trade/currency';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
interface FetchFixture {
  result: Array<{ id: string; item: { name?: string; typeLine: string }; listing: { price?: { amount: number; currency: string } } }>;
}

const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };
const TRADE2 = path.resolve(__dirname, '..', 'fixtures', 'trade2');
function readFixture<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(TRADE2, `${name}.response.json`), 'utf8')) as T;
}
const FETCH_BODY = readFixture<FetchFixture>('fetch-weighted-session');

let server: TestServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

/** The fixture's rates, computed through C-12 itself (no network: fixtureFetch). */
async function fixtureRates(): Promise<Rates> {
  const ff = fixtureFetch([{ match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } }]);
  return (await new CurrencyService({ fetch: ff.fetch, userAgent: 'test', env: {} }).getRates('Standard')) as Rates;
}

async function searchText(
  fetchBody: FetchFixture,
  ninja: FixtureRespond,
  searchFixture = 'search-weighted-session',
): Promise<{ text: string; urls: string[] }> {
  const ff = fixtureFetch([
    { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
    { match: /\/api\/trade2\/search\//, respond: { fixture: `trade2/${searchFixture}` } },
    { match: /\/api\/trade2\/fetch\//, respond: { status: 200, headers: { 'content-type': 'application/json' }, body: fetchBody } },
    { match: /poe\.ninja\//, respond: ninja },
  ]);
  server = await startTestServer({ fetch: ff.fetch, env: ENV });
  const res = (await server.client.callTool({
    name: 'search_trade_items',
    arguments: { league: 'Runes of Aldur', limit: 10 },
  })) as ToolResult;
  expect(res.isError).toBeFalsy();
  const text = res.content.map((c) => c.text).join('\n');
  expect(text).not.toMatch(/truncated/i);
  return { text, urls: ff.calls.map((c) => c.url) };
}

function priceLines(text: string): string[] {
  return [...text.matchAll(/^ {3}Price: (.+)$/gm)].map((m) => m[1]);
}

function listedNames(text: string): string[] {
  return [...text.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1].trim());
}

describe('AC-T46 (WU-15, D-61): search_trade_items normalized prices', () => {
  it('AC-T46: each listing shows "<amount> <currency> (≈ <x> <primary>)" with x = convert(amount, currency, primary) in the D-72 format', async () => {
    const rates = await fixtureRates();
    expect(rates.primary).toBe('divine');
    const { text, urls } = await searchText(FETCH_BODY, { fixture: 'poeninja/currency-overview' });

    expect(urls).toContain(
      'https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Runes%20of%20Aldur&type=Currency',
    );
    const prices = priceLines(text);
    expect(prices).toHaveLength(FETCH_BODY.result.length);
    FETCH_BODY.result.forEach((r, i) => {
      const p = r.listing.price!;
      const x = convert(p.amount, p.currency, rates.primary, rates);
      expect(x).not.toBeNull();
      expect(prices[i]).toBe(`${p.amount} ${p.currency} (≈ ${formatCurrencyValue(x as number)} divine)`);
    });
    // Sub-1 values keep 4 significant digits (D-72): no listing reads as worth nothing.
    expect(text).not.toMatch(/≈ 0\.00 /);
    expect(new Set(FETCH_BODY.result.map((r) => r.listing.price!.currency))).toEqual(new Set(['chaos', 'exalted']));
    expect(text).not.toMatch(/could not be normalized/);
  });

  it('AC-T46 (D-72): a 1 exalted listing shows its small divine equivalent to 4 significant digits, not 0.00', async () => {
    const rates = await fixtureRates();
    const x = convert(1, 'exalted', 'divine', rates)!;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(0.005); // would print "0.00" at 2 decimal places
    const derived: FetchFixture = {
      ...FETCH_BODY,
      result: FETCH_BODY.result.map((r, i) =>
        i === 0 ? { ...r, listing: { ...r.listing, price: { ...r.listing.price!, amount: 1, currency: 'exalted' } } } : r,
      ),
    };
    const { text } = await searchText(derived, { fixture: 'poeninja/currency-overview' });
    const shown = Number(Number(x.toPrecision(4)).toString());
    expect(priceLines(text)[0]).toBe(`1 exalted (≈ ${shown} divine)`);
    expect(priceLines(text)[0]).not.toContain('0.00 divine');
  });

  it('AC-T46: listings appear in the order the fetch fixture returned them', async () => {
    const { text } = await searchText(FETCH_BODY, { fixture: 'poeninja/currency-overview' });
    expect(listedNames(text)).toEqual(FETCH_BODY.result.map((r) => r.item.name || r.item.typeLine));
    const ids = [...text.matchAll(/^ {3}Listing: #([0-9a-f]{64})$/gm)].map((m) => m[1]);
    expect(ids).toEqual(FETCH_BODY.result.map((r) => r.id));
  });

  it('AC-T46: with poe.ninja failing (non-2xx), listings show native prices only and exactly one note', async () => {
    const { text } = await searchText(FETCH_BODY, { status: 503, body: 'unavailable' });
    const prices = priceLines(text);
    FETCH_BODY.result.forEach((r, i) => {
      expect(prices[i]).toBe(`${r.listing.price!.amount} ${r.listing.price!.currency}`);
    });
    expect(text).not.toContain('≈');
    expect(text.match(/could not be normalized/g)).toHaveLength(1);
    expect(listedNames(text)).toEqual(FETCH_BODY.result.map((r) => r.item.name || r.item.typeLine));
  });

  it('AC-T46: a listing in a currency convert cannot place shows its native price only, with exactly one note', async () => {
    const rates = await fixtureRates();
    const UNKNOWN = 'omen-of-whittling';
    expect(rates.valueInPrimary(UNKNOWN)).toBeNull();
    const derived: FetchFixture = {
      ...FETCH_BODY,
      result: FETCH_BODY.result.map((r, i) =>
        i === 2 ? { ...r, listing: { ...r.listing, price: { ...r.listing.price!, amount: 3, currency: UNKNOWN } } } : r,
      ),
    };
    const { text } = await searchText(derived, { fixture: 'poeninja/currency-overview' });
    const prices = priceLines(text);
    expect(prices[2]).toBe(`3 ${UNKNOWN}`);
    derived.result.forEach((r, i) => {
      if (i === 2) return;
      const p = r.listing.price!;
      expect(prices[i]).toBe(`${p.amount} ${p.currency} (≈ ${formatCurrencyValue(convert(p.amount, p.currency, 'divine', rates)!)} divine)`);
    });
    expect(text.match(/could not be normalized/g)).toHaveLength(1);
    expect(text).toContain(UNKNOWN);
  });

  it.each([
    ['search-weighted-session', 'fetch-weighted-session'],
    ['search-body-armour', 'fetch-body-armour'],
    ['search-belt-unique-chaos', 'fetch-belt-unique-chaos'],
    ['search-ring-divine', 'fetch-ring-divine'],
  ])(
    'AC-T46: with the unmodified %s fixture at limit 10, every listing shows its price, untruncated',
    async (searchFixture, fetchFixture) => {
      const rates = await fixtureRates();
      const searchId = readFixture<{ id: string }>(searchFixture).id;
      expect(searchId.length).toBeGreaterThan(150); // a real trade2 search id, not a stand-in
      const fetchBody = readFixture<FetchFixture>(fetchFixture);
      expect(fetchBody.result).toHaveLength(10);
      for (const ninja of [{ fixture: 'poeninja/currency-overview' }, { status: 503, body: 'unavailable' }] as FixtureRespond[]) {
        const { text } = await searchText(fetchBody, ninja, searchFixture); // asserts no truncation
        expect(text).toContain(`/Runes%20of%20Aldur/${searchId}`);
        const prices = priceLines(text);
        expect(prices).toHaveLength(10);
        fetchBody.result.forEach((r, i) => {
          const p = r.listing.price!;
          const native = `${p.amount} ${p.currency}`;
          if ('fixture' in ninja) {
            expect(prices[i]).toBe(`${native} (≈ ${formatCurrencyValue(convert(p.amount, p.currency, 'divine', rates)!)} divine)`);
          } else {
            expect(prices[i]).toBe(native);
          }
        });
        expect(listedNames(text)).toEqual(fetchBody.result.map((r) => r.item.name || r.item.typeLine));
        await server?.close();
        server = null;
      }
    },
  );

  it('AC-T46: the output contains none of "Value Score", "best value" or "per chaos"', async () => {
    for (const ninja of [{ fixture: 'poeninja/currency-overview' }, { status: 503, body: 'x' }] as FixtureRespond[]) {
      const { text } = await searchText(FETCH_BODY, ninja);
      expect(text).not.toMatch(/value score|best value|per chaos/i);
      await server?.close();
      server = null;
    }
  });
});
