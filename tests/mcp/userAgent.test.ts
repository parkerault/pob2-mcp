/**
 * AC-T3 (WU-14, D-25): the User-Agent on every outbound request. In process (startTestServer,
 * C-18); HTTP only via `fixtureFetch`, whose recorded calls are asserted.
 *
 * - trade2 and poe.ninja requests send `pob2-mcp-server/<package.json version>`;
 * - the `import_build` share-site fetch (pobb.in) sends
 *   `Mozilla/5.0 (compatible; pob2-mcp-server/<version>)`. `import_build` starts the engine
 *   before it fetches, so that part runs under `engineDescribe`.
 *
 * The static half of AC-T3 is in tests/static/userAgent.test.ts.
 */
import { describe, it, expect, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch } from '../helpers/fixtureFetch';
import { engineDescribe } from '../helpers/engine';

const REPO = path.resolve(__dirname, '..', '..');
const PKG = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')) as { name: string; version: string };
const PLAIN_UA = `pob2-mcp-server/${PKG.version}`;
const SHARE_UA = `Mozilla/5.0 (compatible; pob2-mcp-server/${PKG.version})`;

let server: TestServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

describe('AC-T3 (WU-14, D-25): User-Agent on trade2 and poe.ninja', () => {
  it('AC-T3: every trade2 and poe.ninja request sends pob2-mcp-server/<package.json version>', async () => {
    expect(PKG.name).toBe('pob2-mcp-server');
    const ff = fixtureFetch([
      { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
      { match: /\/api\/trade2\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } },
      { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-ring-divine' } },
      { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-ring-divine' } },
      { match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
    ]);
    server = await startTestServer({
      fetch: ff.fetch,
      env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined },
    });
    const calls: Array<[string, Record<string, unknown>]> = [
      ['search_trade_items', { league: 'Runes of Aldur', limit: 2 }],
      ['get_item_price', { item_name: 'Sapphire Ring', league: 'Runes of Aldur' }],
      ['get_leagues', {}],
      ['search_stats', { query: 'life' }],
      ['get_currency_rates', { league: 'Runes of Aldur' }],
    ];
    for (const [name, args] of calls) {
      const res = await server.client.callTool({ name, arguments: args });
      expect({ name, isError: Boolean(res.isError) }).toEqual({ name, isError: false });
    }

    const kinds = new Set(
      ff.calls.map((c) => (/poe\.ninja/.test(c.url) ? 'ninja' : (/\/api\/trade2\/(\w+)/.exec(c.url)?.[1] ?? 'other'))),
    );
    expect([...kinds].sort()).toEqual(['data', 'fetch', 'ninja', 'search']);
    for (const c of ff.calls) {
      expect({ url: c.url, ua: c.headers['user-agent'] }).toEqual({ url: c.url, ua: PLAIN_UA });
    }
  });
});

engineDescribe('AC-T3 (WU-14, D-25): User-Agent on the import_build share-site fetch', () => {
  it('AC-T3: the pobb.in fetch sends Mozilla/5.0 (compatible; pob2-mcp-server/<version>)', async () => {
    const xml = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'builds', 'grenadator.xml'), 'utf8');
    const code = zlib.deflateSync(Buffer.from(xml, 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    const ff = fixtureFetch([{ match: /^https:\/\/pobb\.in\//, respond: { status: 200, body: code } }]);
    server = await startTestServer({ fetch: ff.fetch });
    const res = await server.client.callTool(
      { name: 'import_build', arguments: { source: 'https://pobb.in/AbCdEf123' } },
      undefined,
      { timeout: 120_000 },
    );
    expect(res.isError).toBeFalsy();
    expect(ff.calls.map((c) => c.url)).toEqual(['https://pobb.in/AbCdEf123/raw']);
    expect(ff.calls[0].headers['user-agent']).toBe(SHARE_UA);
  }, 120_000);
});
