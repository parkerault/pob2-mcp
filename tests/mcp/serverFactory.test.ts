/**
 * Server factory (C-7) through the in-process MCP client (startTestServer, C-18).
 * AC-F10 (NFR-7), AC-F11 (listener part), AC-F15.
 */
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestServer, type TestServer } from '../helpers/server';
import { createServer, buildCallContext } from '../../src/server/createServer';
import { fixtureFetch } from '../helpers/fixtureFetch';

const REPO = path.resolve(__dirname, '..', '..');

/** Recursive listing of a directory, or null when it does not exist. */
function listing(dir: string): string[] | null {
  if (!fs.existsSync(dir)) return null;
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      out.push(path.relative(dir, p));
      if (e.isDirectory()) walk(p);
    }
  };
  walk(dir);
  return out.sort();
}

describe('server factory (C-7)', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    if (server) await server.close();
    server = null;
  });

  it('AC-F10: listTools within 1 s with throwing fetch/spawn mocks, no I/O at construction; get_leagues reaches the injected fetch', async () => {
    const fetchMock = jest.fn(async () => {
      throw new Error('fetch mock: network refused');
    });
    const spawnMock = jest.fn(() => {
      throw new Error('spawn mock: no processes');
    });
    // Private dirs, so concurrent test files cannot touch them.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-ac-f10-'));
    const pobDirectory = path.join(tmp, 'builds');
    fs.mkdirSync(pobDirectory);
    fs.copyFileSync(path.join(process.env.POB_DIRECTORY!, 'grenadator.xml'), path.join(pobDirectory, 'grenadator.xml'));
    const stateDir = path.join(tmp, 'state', 'pob2-mcp');
    const before = { builds: listing(pobDirectory), state: listing(stateDir) };

    const t0 = performance.now();
    server = await startTestServer({
      fetch: fetchMock as unknown as typeof fetch,
      spawn: spawnMock as unknown as typeof import('child_process').spawn,
      pobDirectory,
      stateDir,
    });
    const { tools } = await server.client.listTools();
    const elapsed = performance.now() - t0;

    expect(tools.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThanOrEqual(1000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
    expect({ builds: listing(pobDirectory), state: listing(stateDir) }).toEqual(before);

    const result = await server.client.callTool({ name: 'get_leagues', arguments: {} });
    expect(result.isError).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const urls = fetchMock.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls.some((u) => u.endsWith('/data/leagues'))).toBe(true);
    expect(spawnMock).not.toHaveBeenCalled();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('AC-F11: two createServer calls register no process listeners', () => {
    const counts = () => ({
      sigint: process.listenerCount('SIGINT'),
      sigterm: process.listenerCount('SIGTERM'),
      stdinEnd: process.stdin.listenerCount('end'),
      stdinClose: process.stdin.listenerCount('close'),
      exit: process.listenerCount('exit'),
    });
    const before = counts();
    const deps = {
      version: '0.0.0',
      env: { ...process.env },
      pobDirectory: process.env.POB_DIRECTORY!,
      stateDir: path.join(process.env.XDG_STATE_HOME!, 'pob2-mcp'),
      guidesDirectory: process.env.POB_GUIDES_DIRECTORY!,
      fetch: globalThis.fetch,
      spawn: jest.fn() as unknown as typeof import('child_process').spawn,
      credentials: () => ({ sessionId: null, source: null }),
    };
    createServer(deps);
    createServer(deps);
    expect(counts()).toEqual(before);
  });

  it('AC-F15: server info is {name: "pob2-mcp-server", version: package.json version}; every description is <= 2048 chars', async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')) as { version: string };
    server = await startTestServer();
    expect(server.client.getServerVersion()).toEqual({ name: 'pob2-mcp-server', version: pkg.version });

    const { tools } = await server.client.listTools();
    const tooLong = tools
      .filter((t) => (t.description ?? '').length > 2048)
      .map((t) => `${t.name}: ${(t.description ?? '').length}`);
    expect(tooLong).toEqual([]);
  });

  it('D-14: trade2 stat data loads lazily on the first trade call, once, and not for get_leagues', async () => {
    const ff = fixtureFetch([
      { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
      { match: /\/api\/trade2\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } },
    ]);
    server = await startTestServer({ fetch: ff.fetch, env: { POE_TRADE_BASE: undefined } });
    expect(ff.calls).toEqual([]);

    const leagues = await server.client.callTool({ name: 'get_leagues', arguments: {} });
    expect(leagues.isError).toBeFalsy();
    expect(ff.calls.map((c) => c.url)).toEqual(['https://www.pathofexile.com/api/trade2/data/leagues']);

    for (let i = 0; i < 2; i++) {
      const r = await server.client.callTool({ name: 'search_stats', arguments: { query: 'life' } });
      expect(r.isError).toBeFalsy();
    }
    expect(ff.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET https://www.pathofexile.com/api/trade2/data/leagues',
      'GET https://www.pathofexile.com/api/trade2/data/stats',
    ]);
    expect(ff.calls.every((c) => c.headers.cookie === undefined)).toBe(true);
  });

  it('C-1: the router call context carries the signal, the progress token and a progress sender', async () => {
    const sent: unknown[] = [];
    const signal = new AbortController().signal;
    const sendNotification = async (n: unknown) => {
      sent.push(n);
    };
    const withToken = buildCallContext({ signal, _meta: { progressToken: 7 }, sendNotification }, () => 1234);
    expect(withToken.signal).toBe(signal);
    expect(withToken.progressToken).toBe(7);
    expect(withToken.arrivedAt).toBe(1234);
    await withToken.sendProgress(1, 'searching');
    expect(sent).toEqual([{ method: 'notifications/progress', params: { progressToken: 7, progress: 1, message: 'searching' } }]);

    const noToken = buildCallContext({ signal, sendNotification });
    await noToken.sendProgress(2);
    expect(sent).toHaveLength(1);
  });
});
