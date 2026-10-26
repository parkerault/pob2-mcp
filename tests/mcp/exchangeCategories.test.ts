/**
 * AC-K72 (WU-112, D-444, amendment 11 §12): whatever the currency exchange sells, `get_item_price` prices from
 * poe.ninja's exchange, by its category, with no trade-site request; the trade site prices only the rest.
 *
 * In process (startTestServer, C-18); HTTP only via `fixtureFetch` (D-34). poe.ninja is served from the spike's saved
 * exchange overviews (`tests/fixtures/poeninja/exchange/<category>`, league Forbidden Rites, 2026-10-25) and the D-387
 * `poeninja/delirium-overview` capture; a trade search or fetch fails the call. The expected values are read from the
 * fixtures themselves.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type FixtureRoute, type RecordedCall } from '../helpers/fixtureFetch';
import { EXCHANGE_CATEGORIES } from '../../src/trade/exchange';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };
const LEAGUE = 'Forbidden Rites';
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

describe('AC-K72: an exchange item poe.ninja does not list is unavailable, naming the category it tried', () => {
  it('Legacy of Deathblow, a rune poe.ninja does not list: Unavailable (Runes), with no trade request', async () => {
    const { res, text, calls } = await price('Legacy of Deathblow', [NO_TRADE, NINJA_BY_CATEGORY]);
    expect(res.isError).toBeFalsy();
    expect(ninjaUrls(calls)).toEqual([overview('Runes')]);
    expect(tradeSearches(calls)).toEqual([]);
    expect(text).toContain("priced from poe.ninja's currency exchange (Runes).");
    expect(text).toContain("Unavailable (Runes): poe.ninja's currency exchange (Runes) lists no Legacy of Deathblow in Forbidden Rites.");
    expect(text).not.toContain('Exchange value:');
  });

  it('a category poe.ninja cannot give, or poe.ninja disabled: Unavailable (<category>), with no trade request', async () => {
    const failed = await price('Wolf Idol', [NO_TRADE, { match: /poe\.ninja\//, respond: { status: 503, body: 'unavailable' } }]);
    expect(failed.res.isError).toBeFalsy();
    expect(failed.text).toContain("Unavailable (Idols): poe.ninja's currency exchange is unavailable, so Wolf Idol has no price");
    expect(tradeSearches(failed.calls)).toEqual([]);
    await server?.close();
    server = null;
    const disabled = await price('Perfect Body Rune', [NO_TRADE, NINJA_BY_CATEGORY], { ...ENV, POE_NINJA_DISABLED: 'true' });
    expect(disabled.text).toContain("Unavailable (Runes): poe.ninja's currency exchange is unavailable, so Perfect Body Rune has no price");
    expect(ninjaUrls(disabled.calls)).toEqual([]);
    expect(tradeSearches(disabled.calls)).toEqual([]);
  });
});
