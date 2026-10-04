/**
 * AC-F5 (launch part): the server finds the pinned PoB checkout from its own package root,
 * not from its cwd. `build/index.js` is spawned over stdio with cwd = a fresh temp dir and
 * POB_FORK_PATH unset; `search_tree_nodes` must return >= 1 node, which shows the engine and
 * its tree data were loaded from <repo>/vendor/PathOfBuilding-PoE2.
 *
 * The child gets an explicit safe env (C-18): no cookie, temp POB_DIRECTORY and XDG_STATE_HOME,
 * trade and poe.ninja disabled, the trade base pointed at a dead local port.
 * WU-03 replaces the local env assembly with the shared `spawnServer` helper.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const REPO = path.resolve(__dirname, '..', '..');
const ENTRY = path.join(REPO, 'build', 'index.js');

const d = process.env.POB_SKIP_ENGINE === '1' ? describe.skip : describe;

d('stdio e2e: PoB checkout resolved from the package root (C-6)', () => {
  let tmp: string;
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;
  const stderr: string[] = [];

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-e2e-'));
    fs.mkdirSync(path.join(tmp, 'cwd'));
    fs.mkdirSync(path.join(tmp, 'builds'));
    fs.mkdirSync(path.join(tmp, 'state'));
  });

  afterAll(async () => {
    if (client) await client.close().catch(() => undefined);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('AC-F5: spawned with cwd = a temp dir, search_tree_nodes {keyword:"Life"} finds >= 1 node', async () => {
    if (!fs.existsSync(ENTRY)) throw new Error(`${ENTRY} is missing: run \`pnpm build\` first (mise run test does)`);

    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
    for (const k of ['POESESSID', 'POE_SESSION_ID', 'POB_FORK_PATH', 'POB_ALLOW_UNPINNED', 'POE_TRADE_ENABLED']) delete env[k];
    Object.assign(env, {
      POB_DIRECTORY: path.join(tmp, 'builds'),
      XDG_STATE_HOME: path.join(tmp, 'state'),
      POE_TRADE_DISABLED: 'true',
      POE_NINJA_DISABLED: 'true',
      POE_TRADE_BASE: 'http://127.0.0.1:9/api/trade2',
      // Until WU-03 removes the flag, the engine tools only route with it set (D-14).
      POB_LUA_ENABLED: 'true',
    });

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [ENTRY],
      cwd: path.join(tmp, 'cwd'),
      env,
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
    client = new Client({ name: 'ac-f5-e2e', version: '0.0.0' });
    await client.connect(transport);

    const result = await client.callTool(
      { name: 'search_tree_nodes', arguments: { keyword: 'Life' } },
      undefined,
      { timeout: 110_000 },
    );
    const text = (result.content as Array<{ type: string; text: string }>).map((c) => c.text).join('\n');
    const found = text.match(/Found (\d+) matching node/);
    if (!found) throw new Error(`no nodes found. Tool output:\n${text}\n--- server stderr (tail) ---\n${stderr.join('').slice(-3000)}`);
    expect(Number(found[1])).toBeGreaterThanOrEqual(1);
    expect(result.isError).toBeFalsy();
  }, 120_000);
});
