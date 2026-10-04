/**
 * AC-T19 (WU-15, C-12, D-11): `get_item_price` normalizes to the league's primary currency. In
 * process (startTestServer, C-18); HTTP only via `fixtureFetch` (trade2 ring search + fetch fixtures,
 * the poe.ninja fixture, or poe.ninja failing).
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type FixtureRoute } from '../helpers/fixtureFetch';
import { CurrencyService, convert, type Rates } from '../../src/trade/currency';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };
type FetchFixture = { result: Array<{ item: { name: string; typeLine: string }; listing: { price: { amount: number; currency: string } } }> };
function readFetch(name: string): FetchFixture {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'trade2', `${name}.response.json`), 'utf8')) as FetchFixture;
}
const FETCH = readFetch('fetch-ring-divine');

/** The fixture's rates, computed through C-12 itself (no network: fixtureFetch). */
async function fixtureRates(): Promise<Rates> {
  const ff = fixtureFetch([{ match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } }]);
  return (await new CurrencyService({ fetch: ff.fetch, userAgent: 'test', env: {} }).getRates('Standard')) as Rates;
}

/** Low, median, average and high of a list of numbers (the spread the summary reports). */
function spreadOf(values: number[]): { Low: number; Median: number; Average: number; High: number } {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return {
    Low: v[0],
    Median: v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2,
    Average: v.reduce((s, x) => s + x, 0) / v.length,
    High: v[v.length - 1],
  };
}

/** The summary's value for a label, parsed from `  <label>: <number> divine`. */
function summaryValue(text: string, label: string): number {
  const after = text.slice(text.indexOf('Summary in Divine Orb (divine)'));
  const m = new RegExp(`^ {2}${label}: (\\d+(?:\\.\\d+)?) divine$`, 'm').exec(after);
  expect(m).not.toBeNull();
  return Number(m![1]);
}

async function priceCheckFetch(fetchFixture: string): Promise<string> {
  const ff = fixtureFetch([
    { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
    { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-ring-divine' } },
    { match: /\/api\/trade2\/fetch\//, respond: { fixture: `trade2/${fetchFixture}` } },
    { match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
  ]);
  server = await startTestServer({ fetch: ff.fetch, env: ENV });
  const res = (await server.client.callTool({
    name: 'get_item_price',
    arguments: { item_name: 'x', league: 'Runes of Aldur' },
  })) as ToolResult;
  expect(res.isError).toBeFalsy();
  return res.content[0].text;
}

const TRADE_ROUTES: FixtureRoute[] = [
  { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
  { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-ring-divine' } },
  { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-ring-divine' } },
];

let server: TestServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

async function priceCheck(ninja: FixtureRoute['respond']): Promise<{ text: string; urls: string[] }> {
  const ff = fixtureFetch([...TRADE_ROUTES, { match: /poe\.ninja\//, respond: ninja }]);
  server = await startTestServer({ fetch: ff.fetch, env: ENV });
  const res = (await server.client.callTool({
    name: 'get_item_price',
    arguments: { item_name: 'Blight Turn', league: 'Runes of Aldur', item_type: 'ring' },
  })) as ToolResult;
  expect(res.isError).toBeFalsy();
  return { text: res.content[0].text, urls: ff.calls.map((c) => c.url) };
}

describe('AC-T19 (WU-15): get_item_price in the primary currency', () => {
  it('AC-T19: reports a price per listing and a summary in the primary currency, with per-currency counts', async () => {
    const { text, urls } = await priceCheck({ fixture: 'poeninja/currency-overview' });
    expect(FETCH.result).toHaveLength(10);
    expect(new Set(FETCH.result.map((r) => r.listing.price.currency))).toEqual(new Set(['divine']));

    const lines = [...text.matchAll(/^ {2}(\d+)\. (.+): (\d+(?:\.\d+)?) (\S+) \(≈ (\d+\.\d{2}) divine\)$/gm)];
    expect(lines).toHaveLength(10);
    lines.forEach((m, i) => {
      const r = FETCH.result[i];
      expect(m[2]).toBe(r.item.name || r.item.typeLine);
      expect(Number(m[3])).toBe(r.listing.price.amount);
      expect(m[4]).toBe(r.listing.price.currency);
      expect(m[5]).toBe((r.listing.price.amount * 1).toFixed(2));
    });

    expect(text).toContain('Summary in Divine Orb (divine), from 10 of 10 listings:');
    expect(text).toMatch(/^ {2}Low: 1\.00 divine$/m);
    expect(text).toMatch(/^ {2}Median: 1\.00 divine$/m);
    expect(text).toMatch(/^ {2}High: 1\.00 divine$/m);
    expect(text).toContain('Listed in: divine ×10');
    expect(text).not.toMatch(/could not be normalized|rates unavailable/);
    expect(urls.some((u) => u.startsWith('https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Runes%20of%20Aldur'))).toBe(true);
  });

  it('AC-T19: with poe.ninja unavailable it shows native prices and the "rates unavailable" note', async () => {
    const { text } = await priceCheck({ status: 503, body: 'unavailable' });
    expect(text).toContain('currency rates unavailable');
    expect(text.match(/could not be normalized/g)).toHaveLength(1);
    expect(text).not.toContain('≈');
    expect(text).not.toContain('Summary in');
    const lines = [...text.matchAll(/^ {2}\d+\. .+: (\d+) divine$/gm)];
    expect(lines).toHaveLength(10);
    expect(text).toContain('Listed in: divine ×10');
    expect(text).toMatch(/^divine \(10 listings, native prices\):$/m);
  });

  it('AC-T19: mixed currencies normalize per listing, and the summary is in the primary currency', async () => {
    // fetch-weighted-session: chaos and exalted listings.
    const rates = await fixtureRates();
    const text = await priceCheckFetch('fetch-weighted-session');
    // 1 chaos = 1/2.7 divine; 200 exalted = 200/440.6 divine (4 significant digits below 1).
    expect(text).toMatch(/: 1 chaos \(≈ 0\.3704 divine\)$/m);
    expect(text).toMatch(/: 200 exalted \(≈ 0\.4539 divine\)$/m);
    expect(text).toMatch(/Listed in: (chaos ×8, exalted ×2|exalted ×2, chaos ×8)/);
    expect(text).toContain('Summary in Divine Orb (divine), from 10 of 10 listings:');

    // The summary is the spread of the converted prices, not of the raw native amounts.
    const fetch = readFetch('fetch-weighted-session');
    const converted = fetch.result.map((r) => convert(r.listing.price.amount, r.listing.price.currency, 'divine', rates)!);
    const expected = spreadOf(converted);
    const native = spreadOf(fetch.result.map((r) => r.listing.price.amount));
    for (const label of ['Low', 'Median', 'Average', 'High'] as const) {
      const shown = summaryValue(text, label);
      expect(shown).toBeCloseTo(expected[label], 2);
      // Shown to 4 significant digits (values below 1) or 2 decimals (from 1 up).
      expect(Math.abs(shown - expected[label])).toBeLessThanOrEqual(expected[label] < 1 ? expected[label] * 5e-4 : 0.005);
      if (Math.abs(native[label] - expected[label]) > 0.01) expect(shown).not.toBeCloseTo(native[label], 2);
    }
  });

  it('AC-T19: listings worth a small fraction of the primary keep their value (no "0.00 divine"), with the native spread', async () => {
    // fetch-body-armour: 1 to 15 exalted, 1 exalted = 1/440.6 divine.
    const rates = await fixtureRates();
    const text = await priceCheckFetch('fetch-body-armour');
    expect(text).not.toMatch(/\b0\.00 divine/);
    expect(text).toMatch(/: 1 exalted \(≈ 0\.00227 divine\)$/m);
    const fetch = readFetch('fetch-body-armour');
    const expected = spreadOf(fetch.result.map((r) => convert(r.listing.price.amount, r.listing.price.currency, 'divine', rates)!));
    for (const label of ['Low', 'Median', 'Average', 'High'] as const) {
      const shown = summaryValue(text, label);
      expect(Math.abs(shown - expected[label])).toBeLessThanOrEqual(expected[label] * 5e-4);
    }
    // The listed range in its own currency stays visible next to the primary-currency summary.
    expect(text).toMatch(/^exalted \(10 listings, native prices\):$/m);
    expect(text).toMatch(/^ {2}Low: 1 exalted$/m);
    expect(text).toMatch(/^ {2}High: 15 exalted$/m);
  });
});
