/**
 * D-387: `get_item_price` prices a Distilled Emotion from poe.ninja's currency exchange, not from trade listings
 * (D-444: only one the exchange doesn't list goes to the trade site, by its name as the base type). An emotion is
 * a currency-exchange item, so a trade search by its name as a unique's is refused (`invalid_query`, the Varashta
 * run's anoints). In process (startTestServer, C-18); HTTP only via `fixtureFetch`: poe.ninja's
 * Delirium overview (the committed `poeninja/delirium-overview` capture), and every trade route failing the test except
 * the fallback's search (`trade2/search-empty`).
 */
import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type FixtureRoute } from '../helpers/fixtureFetch';
import { exchangeCategoryOf } from '../../src/handlers/tradeHandlers';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };
const LEAGUE = 'Forbidden Rites';

/** The fixture's value of an emotion in its primary currency, read from the capture itself. */
function fixtureValue(name: string): number {
  const body = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'poeninja', 'delirium-overview.response.json'), 'utf8'));
  const id = body.items.find((i: { id: string; name: string }) => i.name === name).id;
  return body.lines.find((l: { id: string }) => l.id === id).primaryValue;
}

/** A trade request answers with an error: an emotion is never searched on trade (the URLs are checked too). */
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

async function price(itemName: string, ninja: FixtureRoute['respond'], env: Record<string, string | undefined> = ENV) {
  const ff = fixtureFetch([NO_TRADE, { match: /poe\.ninja\//, respond: ninja }]);
  server = await startTestServer({ fetch: ff.fetch, env });
  const res = (await server.client.callTool({ name: 'get_item_price', arguments: { item_name: itemName, league: LEAGUE } })) as ToolResult;
  return { res, text: res.content[0].text, urls: ff.calls.map((c) => c.url) };
}

describe('D-387: a Distilled Emotion is priced from poe.ninja\'s currency exchange', () => {
  it('recognises the emotions by PoB\'s names, every tier and the Ancient ones, and nothing else', () => {
    for (const name of ['Liquid Envy', 'Ancient Liquid Envy', 'Diluted Liquid Ire', 'Concentrated Liquid Isolation', 'Ancient Potent Liquid Contempt', 'liquid envy']) {
      expect({ name, category: exchangeCategoryOf(name) }).toEqual({ name, category: 'Delirium' });
    }
    for (const name of ['Blight Turn', 'Headhunter', 'Liquid', 'Envy', 'Liquid Envy Ring']) {
      expect({ name, category: exchangeCategoryOf(name) }).toEqual({ name, category: null });
    }
  });

  it('prices Liquid Envy from the Delirium overview in the primary currency, dated, with no trade request', async () => {
    const { res, text, urls } = await price('Liquid Envy', { fixture: 'poeninja/delirium-overview' });
    expect(res.isError).toBeFalsy();
    // The server's stat catalogue load may touch trade2/data/stats; no search or fetch ever goes out.
    expect(urls.filter((u) => /poe\.ninja\//.test(u))).toEqual([`https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden%20Rites&type=Delirium`]);
    expect(urls.filter((u) => /\/api\/trade2\/(search|fetch)\//.test(u))).toEqual([]);
    expect(text).toContain('=== Price Check: Liquid Envy ===');
    expect(text).toMatch(/^League: Forbidden Rites$/m);
    expect(text).toMatch(/^Checked: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
    expect(text).toContain("a currency-exchange item, not a trade listing: priced from poe.ninja's currency exchange (Delirium)");
    expect(text).toContain(`Exchange value: ${fixtureValue('Liquid Envy')} divine (Divine Orb)`);
  });

  it('prices an Ancient emotion as its own item, and matches the name ignoring case', async () => {
    const { text } = await price('ancient liquid envy', { fixture: 'poeninja/delirium-overview' });
    expect(text).toContain(`Exchange value: ${fixtureValue('Ancient Liquid Envy')} divine (Divine Orb)`);
    expect(fixtureValue('Ancient Liquid Envy')).not.toBe(fixtureValue('Liquid Envy'));
  });

  it('says so when the exchange lists no such emotion, and tries the trade site by its name as the base type (D-444, the user\'s ruling)', async () => {
    const ff = fixtureFetch([
      { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
      { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-empty' } },
      { match: /poe\.ninja\//, respond: { fixture: 'poeninja/delirium-overview' } },
    ]);
    server = await startTestServer({ fetch: ff.fetch, env: ENV });
    const res = (await server.client.callTool({ name: 'get_item_price', arguments: { item_name: 'Liquid Nonsense', league: LEAGUE } })) as ToolResult;
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    expect(text).toContain("poe.ninja's currency exchange (Delirium) lists no Liquid Nonsense in Forbidden Rites");
    expect(text).toContain('Unavailable (Delirium; trade site: no listings)');
    expect(text).not.toContain('Exchange value:');
    const searches = ff.calls.filter((c) => /\/api\/trade2\/search\//.test(c.url));
    expect(searches.map((c) => JSON.parse(c.body as string).query)).toEqual([{ status: { option: 'available' }, filters: {}, type: 'Liquid Nonsense' }]);
  });

  it('is unavailable, with no trade fallback, when poe.ninja fails or is disabled', async () => {
    const failed = await price('Liquid Envy', { status: 503, body: 'unavailable' });
    expect(failed.res.isError).toBeFalsy();
    expect(failed.text).toContain("poe.ninja's currency exchange is unavailable, so Liquid Envy has no price");
    const disabled = await price('Liquid Envy', { fixture: 'poeninja/delirium-overview' }, { ...ENV, POE_NINJA_DISABLED: 'true' });
    expect(disabled.text).toContain("poe.ninja's currency exchange is unavailable, so Liquid Envy has no price");
    expect(disabled.urls.filter((u) => /poe\.ninja\/|\/api\/trade2\/(search|fetch)\//.test(u))).toEqual([]);
    expect(failed.urls.filter((u) => /\/api\/trade2\/(search|fetch)\//.test(u))).toEqual([]);
  });
});
