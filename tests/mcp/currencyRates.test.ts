/**
 * AC-T17 (WU-15, C-12, D-33): `get_currency_rates` labels its values in the primary currency named
 * by the poe.ninja response, never in "chaos equivalent". In process (startTestServer, C-18); HTTP
 * only via `fixtureFetch`.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch } from '../helpers/fixtureFetch';

const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined };
const NINJA_URL =
  'https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Runes%20of%20Aldur&type=Currency';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

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

describe('AC-T17 (WU-15): get_currency_rates names the primary currency', () => {
  it('AC-T17: on the poe.ninja fixture the output says "values in Divine Orb" and lists divine-valued rates', async () => {
    const ff = fixtureFetch([{ match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } }]);
    server = await startTestServer({ fetch: ff.fetch, env: ENV });
    const res = (await server.client.callTool({
      name: 'get_currency_rates',
      arguments: { league: 'Runes of Aldur' },
    })) as ToolResult;
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    expect(text).toContain('values in Divine Orb');
    expect(text).toMatch(/^ {2}Divine Orb \(divine\) +1\.00 divine$/m);
    // Exalted: 1 / 440.6 divine, and 440.6 per divine.
    expect(text).toMatch(/^ {2}Exalted Orb \(exalted\) +0\.00227 divine · 440\.60 per divine$/m);
    expect(text).not.toMatch(/chaos equivalent|exalted-equivalent|\bex\b/i);
    expect(ff.calls.map((c) => c.url)).toEqual([NINJA_URL]);
  });

  it('AC-T17: a response whose primary is exalted is labelled in Exalted Orb (read per response)', async () => {
    const body = {
      core: { items: [{ id: 'exalted', name: 'Exalted Orb' }], rates: { divine: 0.00227 }, primary: 'exalted' },
      lines: [{ id: 'chaos', primaryValue: 163.2 }],
      items: [{ id: 'chaos', name: 'Chaos Orb' }],
    };
    const ff = fixtureFetch([{ match: /poe\.ninja\//, respond: { status: 200, body } }]);
    server = await startTestServer({ fetch: ff.fetch, env: ENV });
    const res = (await server.client.callTool({
      name: 'get_currency_rates',
      arguments: { league: 'Runes of Aldur' },
    })) as ToolResult;
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('values in Exalted Orb');
    expect(res.content[0].text).toMatch(/Chaos Orb \(chaos\) +163\.20 exalted/);
  });

  it('AC-T17: with poe.ninja failing the tool returns isError saying the rates are unavailable', async () => {
    const ff = fixtureFetch([{ match: /poe\.ninja\//, respond: { status: 503, body: 'down' } }]);
    server = await startTestServer({ fetch: ff.fetch, env: ENV });
    const res = (await server.client.callTool({
      name: 'get_currency_rates',
      arguments: { league: 'Runes of Aldur' },
    })) as ToolResult;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/currency rates .* unavailable/);
  });

  it('AC-T17: no source file mentions "chaos equivalent" (rg -n "chaos equivalent" -i src/)', () => {
    const src = path.resolve(__dirname, '..', '..', 'src');
    const hits = walkTs(src).filter((f) => /chaos equivalent/i.test(fs.readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
