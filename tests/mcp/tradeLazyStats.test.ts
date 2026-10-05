/**
 * AC-T11 (WU-14, D-14): no trade I/O before or during the MCP handshake, and `/data/stats` is loaded
 * lazily, once. In process (startTestServer, C-18); HTTP only via a never-resolving fetch or
 * `fixtureFetch`.
 */
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch } from '../helpers/fixtureFetch';

const TRADE_ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };

let server: TestServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

const STATS = 'https://www.pathofexile.com/api/trade2/data/stats';

describe('AC-T11 (WU-14, D-14): lazy trade start-up', () => {
  it('AC-T11: with fetch never resolving, initialize and listTools complete within 1 s and fetch is not called', async () => {
    const hang = jest.fn(() => new Promise<Response>(() => undefined));
    const t0 = performance.now();
    server = await startTestServer({ fetch: hang as unknown as typeof fetch, env: TRADE_ENV });
    const { tools } = await server.client.listTools();
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThanOrEqual(1000);
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['search_trade_items', 'search_stats', 'get_leagues']));
    expect(hang).not.toHaveBeenCalled();
  });

  it('AC-T11: the first trade call that needs stats sends exactly one /data/stats request; a second call sends none', async () => {
    const ff = fixtureFetch([
      { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
      { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-ring-divine' } },
      { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-ring-divine' } },
    ]);
    server = await startTestServer({ fetch: ff.fetch, env: TRADE_ENV });
    expect(ff.calls).toEqual([]);

    const first = await server.client.callTool({ name: 'search_trade_items', arguments: { league: 'Runes of Aldur', limit: 2 } });
    expect(first.isError).toBeFalsy();
    expect(ff.calls.filter((c) => c.url === STATS)).toHaveLength(1);
    expect(ff.calls[0].url).toBe(STATS);

    const second = await server.client.callTool({ name: 'search_stats', arguments: { query: 'life' } });
    expect(second.isError).toBeFalsy();
    const third = await server.client.callTool({ name: 'search_trade_items', arguments: { league: 'Runes of Aldur', limit: 2 } });
    expect(third.isError).toBeFalsy();
    expect(ff.calls.filter((c) => c.url === STATS)).toHaveLength(1);
  });

  it('AC-T11: concurrent first trade calls share one /data/stats request', async () => {
    const ff = fixtureFetch([{ match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats', delayMs: 50 } }]);
    server = await startTestServer({ fetch: ff.fetch, env: TRADE_ENV });
    const results = await Promise.all([
      server.client.callTool({ name: 'search_stats', arguments: { query: 'life' } }),
      server.client.callTool({ name: 'search_stats', arguments: { query: 'fire' } }),
    ]);
    for (const r of results) expect(r.isError).toBeFalsy();
    expect(ff.calls.map((c) => c.url)).toEqual([STATS]);
  });
});
