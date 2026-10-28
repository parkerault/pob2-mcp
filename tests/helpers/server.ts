/**
 * `startTestServer(overrides?)` (C-18): the real server, in process, behind an SDK `Client` over
 * `InMemoryTransport`.
 *
 * Defaults: the throwing global `fetch` (tests/setup/env.ts), the real `spawn`, credentials
 * `{sessionId: null, source: null}`, the trade search pace off (`tradePace: null`, so trade suites
 * keep their speed; a test of the pace passes `tradePace` and a fake `tradeSleep`, D-461), and `env` =
 * a copy of `process.env` with `overrides.env` merged in. `pobDirectory`, `stateDir` and `guidesDirectory` follow the entry's defaults for that env
 * (the Jest globalSetup points all three at temp dirs). Callers of slow tools pass `{timeout}` to `callTool`:
 * the SDK client's default is 60 s.
 *
 * `session` is the server's engine session (C-3): tests read `revision`/`loaded`/`isDirty()`, subscribe
 * with `onEvent`, find the engine with `enginePid()`, and call `session.run` directly where an AC says so.
 * `engineAccess` is the accessor the router and handler contexts were wired with (`getLuaClient`,
 * `ensureLuaClient`, `engine`), so a test checks the server's real engine access, not a copy of it.
 */
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type EngineSession, type ServerDeps } from '../../src/server/createServer';
import type { EngineAccess } from '../../src/utils/contextBuilder';
import { entryDefaults, packageVersion } from '../../src/index';

export interface TestServer {
  client: Client;
  deps: ServerDeps;
  session: EngineSession;
  engineAccess: EngineAccess;
  close(): Promise<void>;
}

export async function startTestServer(overrides: Partial<ServerDeps> = {}): Promise<TestServer> {
  const env: Record<string, string | undefined> = { ...process.env, ...(overrides.env ?? {}) };
  const defaults = entryDefaults(env);
  const deps: ServerDeps = {
    version: packageVersion(),
    pobDirectory: defaults.pobDirectory,
    stateDir: defaults.stateDir,
    guidesDirectory: defaults.guidesDirectory,
    fetch: globalThis.fetch,
    spawn,
    credentials: () => ({ sessionId: null, source: null }),
    tradePace: null,
    ...overrides,
    env,
  };

  const { server, engine, engineAccess, shutdown } = createServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'pob2-mcp-tests', version: '0.0.0' });
  await client.connect(clientTransport);

  let closed = false;
  return {
    client,
    deps,
    session: engine,
    engineAccess,
    async close() {
      if (closed) return;
      closed = true;
      await client.close().catch(() => undefined);
      await shutdown();
    },
  };
}
