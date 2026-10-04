/**
 * AC-E20 (D-14, D-59): in process with a `spawn` spy wrapping the real `spawn`. Tools that don't touch
 * the engine never start it; the first engine tool starts it exactly once; and the engine can't be
 * reached outside `session.run`. Trade HTTP is served by `fixtureFetch`.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch } from '../helpers/fixtureFetch';
import { engineDescribe } from '../helpers/engine';
import { GOLDEN_XML } from '../helpers/engineSession';

engineDescribe('AC-E20: only an engine tool starts the engine, once (D-14, D-59)', () => {
  let tmp: string;
  let server: TestServer;
  const spawnSpy = jest.fn(spawn);
  const http = fixtureFetch([{ match: /\/api\/trade2\/data\/leagues/, respond: { fixture: 'trade2/data-leagues' } }]);

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-engine-spawn-'));
    const builds = path.join(tmp, 'builds');
    fs.mkdirSync(builds);
    fs.writeFileSync(path.join(builds, 'grenadator.xml'), GOLDEN_XML);
    server = await startTestServer({
      fetch: http.fetch,
      spawn: spawnSpy as unknown as typeof spawn,
      pobDirectory: builds,
      stateDir: path.join(tmp, 'state'),
      env: { POB_DIRECTORY: builds, POE_TRADE_DISABLED: undefined },
    });
  }, 60000);

  afterAll(async () => {
    if (server) await server.close();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }, 30000);

  it('AC-E20: get_leagues (fixture fetch) and list_builds cause 0 spawns', async () => {
    const leagues = await server.client.callTool({ name: 'get_leagues', arguments: {} });
    expect(leagues.isError).not.toBe(true);
    expect(http.calls.some((c) => /\/api\/trade2\/data\/leagues/.test(c.url) && c.method === 'GET')).toBe(true);
    const builds = await server.client.callTool({ name: 'list_builds', arguments: {} });
    expect(builds.isError).not.toBe(true);
    expect(spawnSpy).toHaveBeenCalledTimes(0);
    expect(server.session.enginePid()).toBeNull();
  });

  it('AC-E20: the first lua_get_build_info causes exactly 1 spawn; a second engine call none', async () => {
    const first = await server.client.callTool({ name: 'lua_get_build_info', arguments: {} }, undefined, { timeout: 120000 });
    expect(first.isError).not.toBe(true);
    expect(spawnSpy).toHaveBeenCalledTimes(1);
    await server.client.callTool({ name: 'lua_get_build_info', arguments: {} });
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  }, 120000);

  it('AC-E20: the server\'s wired getLuaClient() outside session.run throws "engine access outside a session"', async () => {
    // The accessor createServer handed to the router and every handler context, not a fresh copy.
    const access = server.engineAccess;
    expect(() => access.getLuaClient()).toThrow('engine access outside a session');
    await expect(access.ensureLuaClient()).rejects.toThrow('engine access outside a session');
    expect(() => access.engine()).toThrow('engine access outside a session');
    // Inside a run it is the run's session-scoped client, which still refuses raw loads.
    await server.session.run({ tool: 'probe', kind: 'read' }, async (ctx) => {
      expect(access.getLuaClient()).toBe(ctx.client);
      await expect(access.ensureLuaClient()).resolves.toBeUndefined();
      await expect(access.getLuaClient().request('load_build_xml', { xml: GOLDEN_XML, name: 'x' })).rejects.toThrow(
        'engine load outside the session',
      );
    });
    expect(() => access.getLuaClient()).toThrow('engine access outside a session');
  }, 120000);
});
