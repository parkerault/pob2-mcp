/**
 * `startTestServer(overrides?)` (C-18): the real server, in process, behind an SDK `Client` over
 * `InMemoryTransport`.
 *
 * Defaults: the throwing global `fetch` (tests/setup/env.ts), the real `spawn`, credentials
 * `{sessionId: null, source: null}`, and `env` = a copy of `process.env` with `overrides.env`
 * merged in. `pobDirectory` and `stateDir` follow the entry's defaults for that env (the Jest
 * globalSetup points both at temp dirs). Callers of slow tools pass `{timeout}` to `callTool`:
 * the SDK client's default is 60 s.
 */
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type EngineSession, type ServerDeps } from '../../src/server/createServer';
import { entryDefaults, packageVersion } from '../../src/index';

export interface TestServer {
  client: Client;
  deps: ServerDeps;
  session: EngineSession;
  close(): Promise<void>;
}

export async function startTestServer(overrides: Partial<ServerDeps> = {}): Promise<TestServer> {
  const env: Record<string, string | undefined> = { ...process.env, ...(overrides.env ?? {}) };
  const defaults = entryDefaults(env);
  const deps: ServerDeps = {
    version: packageVersion(),
    pobDirectory: defaults.pobDirectory,
    stateDir: defaults.stateDir,
    fetch: globalThis.fetch,
    spawn,
    credentials: () => ({ sessionId: null, source: null }),
    ...overrides,
    env,
  };

  const { server, engine, shutdown } = createServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'pob2-mcp-tests', version: '0.0.0' });
  await client.connect(clientTransport);

  let closed = false;
  return {
    client,
    deps,
    session: engine,
    async close() {
      if (closed) return;
      closed = true;
      await client.close().catch(() => undefined);
      await shutdown();
    },
  };
}
