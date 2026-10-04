/**
 * AC-T20 (WU-15): `search_stats` uses the live `/data/stats` only (the static PoE1 fallback is
 * gone), and `get_leagues` marks the D-20 default. In process (startTestServer, C-18); HTTP only via
 * `fixtureFetch`.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch } from '../helpers/fixtureFetch';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

const ENV = {
  POE_TRADE_DISABLED: undefined,
  POE_NINJA_DISABLED: undefined,
  POE_TRADE_BASE: undefined,
  POE_LEAGUE: undefined,
};
const STATS = 'https://www.pathofexile.com/api/trade2/data/stats';
const LEAGUES = 'https://www.pathofexile.com/api/trade2/data/leagues';

let server: TestServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

function walkTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walkTs(p);
    return e.name.endsWith('.ts') ? [p] : [];
  });
}

describe('AC-T20 (WU-15): search_stats on live stats', () => {
  it('AC-T20: search_stats {query:"maximum Life"} returns explicit.stat_3299347043 from /data/stats', async () => {
    const ff = fixtureFetch([{ match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } }]);
    server = await startTestServer({ fetch: ff.fetch, env: ENV });
    const res = (await server.client.callTool({ name: 'search_stats', arguments: { query: 'maximum Life' } })) as ToolResult;
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    expect(text).toContain('Trade ID: explicit.stat_3299347043');
    // The most specific text ranks first: "# to maximum Life".
    expect(text).toMatch(/^1\. # to maximum Life\n {3}Trade ID: explicit\.stat_3299347043$/m);
    expect(ff.calls.map((c) => c.url)).toEqual([STATS]);
  });

  it('AC-T20: with /data/stats failing, search_stats returns isError "trade stat data unavailable"', async () => {
    const ff = fixtureFetch([{ match: /\/api\/trade2\/data\/stats$/, respond: { status: 503, body: 'down' } }]);
    server = await startTestServer({ fetch: ff.fetch, env: ENV });
    const res = (await server.client.callTool({ name: 'search_stats', arguments: { query: 'maximum Life' } })) as ToolResult;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('trade stat data unavailable');
    expect(res.content[0].text).not.toMatch(/pseudo\.pseudo_total_life|Trade ID/);
    expect(ff.calls.map((c) => c.url)).toEqual([STATS]);
  });

  it('AC-T20: STAT_MAPPINGS no longer exists in src/ (rg -n STAT_MAPPINGS src/)', () => {
    const src = path.resolve(__dirname, '..', '..', 'src');
    expect(walkTs(src).filter((f) => fs.readFileSync(f, 'utf8').includes('STAT_MAPPINGS'))).toEqual([]);
  });
});

describe('AC-T20 (WU-15, D-20): get_leagues marks the default league', () => {
  it('AC-T20: lists all 6 fixture leagues and marks Forbidden Rites as the default', async () => {
    const ff = fixtureFetch([{ match: /\/api\/trade2\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } }]);
    server = await startTestServer({ fetch: ff.fetch, env: ENV });
    const res = (await server.client.callTool({ name: 'get_leagues', arguments: {} })) as ToolResult;
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    const listed = [...text.matchAll(/^- (.+?)(?: \[poe2\])?( ← default)?$/gm)].map((m) => ({ id: m[1], isDefault: !!m[2] }));
    expect(listed.map((l) => l.id)).toEqual([
      'Forbidden Rites',
      'HC Forbidden Rites',
      'Runes of Aldur',
      'HC Runes of Aldur',
      'Standard',
      'Hardcore',
    ]);
    expect(listed.filter((l) => l.isDefault).map((l) => l.id)).toEqual(['Forbidden Rites']);
    expect(text).toContain('Default league: Forbidden Rites');
    // One /data/leagues request (the resolver reuses the cached list).
    expect(ff.calls.map((c) => c.url)).toEqual([LEAGUES]);
  });

  it('AC-T20: with POE_LEAGUE set, that league is marked as the default', async () => {
    const ff = fixtureFetch([{ match: /\/api\/trade2\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } }]);
    server = await startTestServer({ fetch: ff.fetch, env: { ...ENV, POE_LEAGUE: 'Runes of Aldur' } });
    const res = (await server.client.callTool({ name: 'get_leagues', arguments: {} })) as ToolResult;
    const text = res.content[0].text;
    expect(text).toMatch(/^- Runes of Aldur \[poe2\] ← default$/m);
    expect(text).not.toMatch(/^- Forbidden Rites .*default/m);
  });
});
