/**
 * AC-F16: the test harness's guarantees (C-18, FR-F5, D-34).
 */
import { describe, it, expect } from '@jest/globals';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fixtureFetch } from '../helpers/fixtureFetch';

describe('AC-F16: harness guarantees (C-18)', () => {
  it('AC-F16(a): POESESSID and POE_SESSION_ID are undefined inside a test', () => {
    expect(process.env.POESESSID).toBeUndefined();
    expect(process.env.POE_SESSION_ID).toBeUndefined();
  });

  it('AC-F16(b): the global fetch throws an error mentioning D-34', () => {
    expect(() => fetch('https://www.pathofexile.com/')).toThrow(/D-34/);
    expect(() => fetch('https://www.pathofexile.com/')).toThrow('https://www.pathofexile.com/');
  });

  it('AC-F16(c): POB_DIRECTORY is a temp dir holding grenadator.xml, not under /mnt/', () => {
    const dir = process.env.POB_DIRECTORY!;
    expect(dir).toBeTruthy();
    expect(dir.startsWith('/mnt/')).toBe(false);
    expect(fs.realpathSync(dir).startsWith('/mnt/')).toBe(false);
    expect(path.basename(dir)).toMatch(/^pob2-mcp-test-builds-/);
    expect(fs.existsSync(path.join(dir, 'grenadator.xml'))).toBe(true);
    expect(process.env.XDG_STATE_HOME!.startsWith('/mnt/')).toBe(false);
  });

  it('AC-F16(d): fixtureFetch throws on an unmatched URL and records method, headers and body', async () => {
    const { fetch: f, calls } = fixtureFetch([
      { match: /\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } },
      { match: /\/search\//, respond: { status: 200, headers: { 'x-test': '1' }, body: { id: 'abc', result: [] } } },
    ]);

    await expect(f('https://example.invalid/nothing')).rejects.toThrow('unmatched fetch: https://example.invalid/nothing');

    const leagues = await f('https://www.pathofexile.com/api/trade2/data/leagues');
    expect(leagues.status).toBe(200);
    expect(((await leagues.json()) as { result: unknown[] }).result.length).toBeGreaterThan(0);

    const search = await f('https://www.pathofexile.com/api/trade2/search/poe2/Standard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'POESESSID=fake' },
      body: JSON.stringify({ query: { status: { option: 'online' } } }),
    });
    expect(search.headers.get('x-test')).toBe('1');
    expect(await search.json()).toEqual({ id: 'abc', result: [] });

    expect(calls).toEqual([
      { url: 'https://www.pathofexile.com/api/trade2/data/leagues', method: 'GET', headers: {}, body: undefined },
      {
        url: 'https://www.pathofexile.com/api/trade2/search/poe2/Standard',
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: 'POESESSID=fake' },
        body: '{"query":{"status":{"option":"online"}}}',
      },
    ]);
  });

  it('AC-F16(e): a delayed fixtureFetch response rejects with the abort reason when its signal aborts', async () => {
    const { fetch: f } = fixtureFetch([{ match: /slow/, respond: { fixture: 'trade2/data-leagues', delayMs: 10_000 } }]);
    const controller = new AbortController();
    const reason = new Error('caller gave up');
    const pending = f('https://example.invalid/slow', { signal: controller.signal });
    setTimeout(() => controller.abort(reason), 20);
    const t0 = Date.now();
    await expect(pending).rejects.toBe(reason);
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it('AC-F16(f): a child spawned without an explicit env sees neither cookie variable', () => {
    // No `env` option: the child inherits this worker's env, which globalSetup scrubbed.
    const out = execFileSync(
      process.execPath,
      ['-e', 'process.stdout.write(JSON.stringify([process.env.POESESSID ?? null, process.env.POE_SESSION_ID ?? null]))'],
      { encoding: 'utf8' },
    );
    expect(JSON.parse(out)).toEqual([null, null]);
  });
});
