/**
 * AC-K72 (WU-112, D-444, amendment 11 §12): whatever the currency exchange sells, `get_item_price` prices from
 * poe.ninja's exchange, by its category, with no trade-site request; the trade site prices only the rest.
 *
 * In process (startTestServer, C-18); HTTP only via `fixtureFetch` (D-34). poe.ninja is served from the spike's saved
 * exchange overviews (`tests/fixtures/poeninja/exchange/<category>`, league Forbidden Rites, 2026-10-25) and the D-387
 * `poeninja/delirium-overview` capture; a trade search or fetch fails the call, except in the trade fallback's cases
 * (an exchange item poe.ninja doesn't list, the user's ruling of 2026-10-25), which serve the synthesized
 * `trade2/search-rune-legacy` and `trade2/fetch-rune-legacy` fixtures. The expected values are read from the fixtures.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type FixtureRoute, type RecordedCall } from '../helpers/fixtureFetch';
import { DATA_ROUTES, readTrade2, searchResponse, searchSequence } from '../helpers/tradeFixtures';
import { EXCHANGE_CATEGORIES } from '../../src/trade/exchange';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };
const LEAGUE = 'Forbidden Rites';
const T0 = Date.parse('2026-10-25T12:00:00Z');
const NINJA = 'https://poe.ninja/poe2/api/economy/exchange/current/overview';

function fixtureName(category: string): string {
  return category === 'Delirium' ? 'poeninja/delirium-overview' : `poeninja/exchange/${category}`;
}

/** An item's value in the primary currency, as its category's fixture lists it (by `items[].name`, joined on `id`). */
function fixtureValue(category: string, name: string): number {
  const file = path.resolve(__dirname, '..', 'fixtures', `${fixtureName(category)}.response.json`);
  const body = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    lines: Array<{ id: string; primaryValue: number }>;
    items: Array<{ id: string; name: string }>;
  };
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const id = body.items.find((i) => fold(i.name) === fold(name))?.id;
  const line = body.lines.find((l) => l.id === id);
  if (!line) throw new Error(`${name} is not in the ${category} fixture`);
  return line.primaryValue;
}

/** Each exchange category's overview from its fixture, by the request's `type`. */
const NINJA_BY_CATEGORY: FixtureRoute = {
  match: /poe\.ninja\//,
  respond: (url) => {
    const type = new URL(url).searchParams.get('type') ?? '';
    const file = path.resolve(__dirname, '..', 'fixtures', `${fixtureName(type)}.response.json`);
    if (!fs.existsSync(file)) return new Response('not found', { status: 404 });
    return new Response(fs.readFileSync(file, 'utf8'), { status: 200, headers: { 'content-type': 'application/json' } });
  },
};

/** A trade search or fetch fails the call: an exchange item is never sent to the trade site. */
const NO_TRADE: FixtureRoute = {
  match: /\/api\/trade2\//,
  respond: () => {
    throw new Error('an exchange item was sent to the trade site');
  },
};

let server: TestServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

async function price(itemName: string, routes: FixtureRoute[], env: Record<string, string | undefined> = ENV) {
  const ff = fixtureFetch(routes);
  server = await startTestServer({ fetch: ff.fetch, env });
  const res = (await server.client.callTool({ name: 'get_item_price', arguments: { item_name: itemName, league: LEAGUE } })) as ToolResult;
  return { res, text: res.content[0].text, calls: ff.calls };
}

const ninjaUrls = (calls: RecordedCall[]) => calls.map((c) => c.url).filter((u) => /poe\.ninja\//.test(u));
const tradeSearches = (calls: RecordedCall[]) => calls.filter((c) => /\/api\/trade2\/(search|fetch)\//.test(c.url));
const overview = (category: string) => `${NINJA}?league=Forbidden%20Rites&type=${category}`;

/**
 * The user's four named items (§12), then one item from every other category the spike found. `Legacy of Deathblow`
 * is a rune (PoB's `ModRunes.lua`), but poe.ninja's Runes list it in neither league: it is the unavailable case below.
 */
const NAMED: Array<[string, string]> = [
  ['Perfect Body Rune', 'Runes'],
  ["Courtesan Mannan's Rune of Cruelty", 'Runes'],
  ['Wolf Idol', 'Idols'],
];
const ONE_PER_CATEGORY: Array<[string, string]> = [
  ['Orb of Annulment', 'Currency'],
  ['Simulacrum Splinter', 'Fragments'],
  ['Preserved Rib', 'Abyss'],
  ['Uncut Skill Gem (Level 20)', 'UncutGems'],
  // PoB's name; poe.ninja writes `Mórrigan's Insight`.
  ["Morrigan's Insight", 'LineageSupportGems'],
  ['Perfect Essence of Haste', 'Essences'],
  ['Soul Core of Tacati', 'SoulCores'],
  ['Omen of Light', 'Ritual'],
  ['Thaumaturgic Flux (Level 20)', 'Expedition'],
  ['Liquid Envy', 'Delirium'],
  ['Xoph\'s Catalyst', 'Breach'],
  // Not an emotion, though it reads like one.
  ['Liquid Verisium', 'Verisium'],
];

describe('AC-K72: an exchange item is priced from its poe.ninja exchange category, with no trade-site request', () => {
  it('the cases cover every category the spike found', () => {
    expect(new Set([...NAMED, ...ONE_PER_CATEGORY].map(([, c]) => c))).toEqual(new Set(EXCHANGE_CATEGORIES));
  });

  for (const [name, category] of [...NAMED, ...ONE_PER_CATEGORY]) {
    it(`${name}: from ${category}`, async () => {
      const { res, text, calls } = await price(name, [NO_TRADE, NINJA_BY_CATEGORY]);
      expect(res.isError).toBeFalsy();
      expect(ninjaUrls(calls)).toEqual([overview(category)]);
      expect(tradeSearches(calls)).toEqual([]);
      expect(text).toContain(`=== Price Check: ${name} ===`);
      expect(text).toMatch(/^League: Forbidden Rites$/m);
      expect(text).toMatch(/^Checked: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
      expect(text).toContain(`a currency-exchange item, not a trade listing: priced from poe.ninja's currency exchange (${category}).`);
      expect(text).toContain(`Exchange value: ${fixtureValue(category, name)} divine (Divine Orb)`);
      expect(text).not.toContain('Unavailable');
    });
  }

  it('matches the name ignoring case and typographic apostrophes', async () => {
    const { text, calls } = await price('courtesan mannan’s rune of cruelty', [NO_TRADE, NINJA_BY_CATEGORY]);
    expect(ninjaUrls(calls)).toEqual([overview('Runes')]);
    expect(text).toContain(`Exchange value: ${fixtureValue('Runes', "Courtesan Mannan's Rune of Cruelty")} divine (Divine Orb)`);
  });
});

describe('AC-K72: the trade site still prices a unique', () => {
  it('Darkness Enthroned is searched on the trade site by name, and no exchange category is asked', async () => {
    const { res, text, calls } = await price('Darkness Enthroned', [
      { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
      { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-belt-unique-chaos' } },
      { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-belt-unique-chaos' } },
      { match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
    ]);
    expect(res.isError).toBeFalsy();
    const searches = calls.filter((c) => /\/api\/trade2\/search\//.test(c.url));
    expect(searches).toHaveLength(1);
    expect(JSON.parse(searches[0].body as string).query.name).toBe('Darkness Enthroned');
    expect(calls.filter((c) => /\/api\/trade2\/fetch\//.test(c.url))).toHaveLength(1);
    // poe.ninja is read only for the currency rates that normalize the listings.
    expect(ninjaUrls(calls)).toEqual([overview('Currency')]);
    expect(text).toContain('=== Price Check: Darkness Enthroned ===');
    expect(text).toContain('Listings (cheapest first, as listed):');
    expect(text).not.toContain('currency-exchange item');
  });
});

describe("AC-K72 (the user's ruling, 2026-10-25): an exchange item poe.ninja does not list goes to the trade site by name", () => {
  /** The trade routes the fallback reaches: the stat catalogue, a search, its fetch. */
  const tradeRoutes = (search: string, fetchFixture?: string): FixtureRoute[] => [
    ...DATA_ROUTES,
    { match: /\/api\/trade2\/search\//, respond: { fixture: `trade2/${search}` } },
    ...(fetchFixture ? [{ match: /\/api\/trade2\/fetch\//, respond: { fixture: `trade2/${fetchFixture}` } }] : []),
  ];
  const searches = (calls: RecordedCall[]) => calls.filter((c) => /\/api\/trade2\/search\//.test(c.url));
  const fetches = (calls: RecordedCall[]) => calls.filter((c) => /\/api\/trade2\/fetch\//.test(c.url));

  it('Legacy of Deathblow, a rune poe.ninja does not list, is priced from trade listings, searched by its name as the base type', async () => {
    const { res, text, calls } = await price('Legacy of Deathblow', [...tradeRoutes('search-rune-legacy', 'fetch-rune-legacy'), NINJA_BY_CATEGORY]);
    expect(res.isError).toBeFalsy();
    // poe.ninja first (Runes lists no such rune), then the currency rates that normalize the listings.
    expect(ninjaUrls(calls)).toEqual([overview('Runes'), overview('Currency')]);
    expect(searches(calls)).toHaveLength(1);
    expect(JSON.parse(searches(calls)[0].body as string)).toEqual(readTrade2('search-rune-legacy.request.json'));
    expect(fetches(calls)).toHaveLength(1);
    expect(text).toContain('=== Price Check: Legacy of Deathblow ===');
    expect(text).toMatch(/^League: Forbidden Rites$/m);
    expect(text).toContain("Legacy of Deathblow is a rune, a currency-exchange item, but poe.ninja's currency exchange (Runes) lists no Legacy of Deathblow in Forbidden Rites: priced from trade listings, by its name, instead.");
    expect(text).toContain('Total Listings: 3 · Priced listings fetched: 3');
    expect(text).toMatch(/^ {2}1\. Legacy of Deathblow: 40 exalted \(≈ [\d.]+ divine\)$/m);
    expect(text).toMatch(/^ {2}3\. Legacy of Deathblow: 1 divine \(≈ 1\.00 divine\)$/m);
    expect(text).not.toContain('Unavailable');
    expect(text).not.toContain('Exchange value:');
  });

  it('the trade site having none too: Unavailable naming both routes, Unavailable (Runes; trade site: no listings)', async () => {
    const { res, text, calls } = await price('Legacy of Deathblow', [...tradeRoutes('search-empty'), NINJA_BY_CATEGORY]);
    expect(res.isError).toBeFalsy();
    expect(ninjaUrls(calls)).toEqual([overview('Runes')]);
    expect(searches(calls)).toHaveLength(1);
    expect(fetches(calls)).toEqual([]);
    expect(text).toContain("Unavailable (Runes; trade site: no listings): poe.ninja's currency exchange (Runes) lists no Legacy of Deathblow in Forbidden Rites, and the trade site has no listings for it.");
    expect(text).not.toContain('Exchange value:');
  });

  it('after the trade site rate-limits this server (a pricing stop), the fallback is not tried, even once the lockout has passed: Unavailable (Runes)', async () => {
    const limitHeaders = Object.fromEntries(
      Object.entries(readTrade2<{ headers: Record<string, string> }>('search-ring-divine.headers.json').headers).filter(([k]) => k.startsWith('x-rate-limit-')),
    );
    const RATE_LIMITED = { status: 429, headers: { ...limitHeaders, 'retry-after': '60' }, body: { error: { code: 3, message: 'Rate limit exceeded' } } };
    const ff = fixtureFetch([...DATA_ROUTES, searchSequence([RATE_LIMITED, searchResponse('never-sent', 3)]), NINJA_BY_CATEGORY]);
    let elapsed = 0;
    server = await startTestServer({ fetch: ff.fetch, env: ENV, now: () => T0 + elapsed });
    const call = async (item_name: string) =>
      (await server!.client.callTool({ name: 'get_item_price', arguments: { item_name, league: LEAGUE } })) as ToolResult;

    const limited = await call('Darkness Enthroned');
    expect(limited.isError).toBe(true);
    expect(limited.content[0].text.startsWith('Error: [trade:rate_limited] ')).toBe(true);
    expect(searches(ff.calls)).toHaveLength(1);

    elapsed = 10 * 60 * 1000; // well past the 60 s lockout
    const after = await call('Legacy of Deathblow');
    expect(after.isError).toBeFalsy();
    expect(searches(ff.calls)).toHaveLength(1);
    expect(fetches(ff.calls)).toEqual([]);
    expect(ninjaUrls(ff.calls)).toEqual([overview('Runes')]);
    expect(after.content[0].text).toContain(
      "Unavailable (Runes): poe.ninja's currency exchange (Runes) lists no Legacy of Deathblow in Forbidden Rites, and the trade site isn't tried after its limit stopped pricing (rate_limited).",
    );

    // An item poe.ninja lists keeps its exchange price after the stop.
    const listedAfter = await call('Perfect Body Rune');
    expect(listedAfter.content[0].text).toContain(`Exchange value: ${fixtureValue('Runes', 'Perfect Body Rune')} divine (Divine Orb)`);
    expect(searches(ff.calls)).toHaveLength(1);
  });

  it('with trade disabled (POE_TRADE_DISABLED=true) get_item_price is hidden, so neither route runs: no trade and no poe.ninja request', async () => {
    const ff = fixtureFetch([...tradeRoutes('search-rune-legacy', 'fetch-rune-legacy'), NINJA_BY_CATEGORY]);
    server = await startTestServer({ fetch: ff.fetch, env: { ...ENV, POE_TRADE_DISABLED: 'true' } });
    await expect(server.client.callTool({ name: 'get_item_price', arguments: { item_name: 'Legacy of Deathblow', league: LEAGUE } })).rejects.toThrow(
      /Unknown tool: get_item_price/,
    );
    expect(ff.calls).toEqual([]);
  });

  it('a category poe.ninja cannot give, or poe.ninja disabled: Unavailable (<category>), with no trade request', async () => {
    const failed = await price('Wolf Idol', [NO_TRADE, { match: /poe\.ninja\//, respond: { status: 503, body: 'unavailable' } }]);
    expect(failed.res.isError).toBeFalsy();
    expect(failed.text).toContain("Unavailable (Idols): poe.ninja's currency exchange is unavailable, so Wolf Idol has no price");
    expect(tradeSearches(failed.calls)).toEqual([]);
    await server?.close();
    server = null;
    const disabled = await price('Legacy of Deathblow', [NO_TRADE, NINJA_BY_CATEGORY], { ...ENV, POE_NINJA_DISABLED: 'true' });
    expect(disabled.text).toContain("Unavailable (Runes): poe.ninja's currency exchange is unavailable, so Legacy of Deathblow has no price");
    expect(ninjaUrls(disabled.calls)).toEqual([]);
    expect(tradeSearches(disabled.calls)).toEqual([]);
  });
});
