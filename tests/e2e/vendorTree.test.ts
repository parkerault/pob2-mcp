/**
 * AC-F5 (launch part): the server finds the pinned PoB checkout from its own package root, not
 * from its cwd. `build/index.js` is spawned over stdio (spawnServer, C-18) with cwd = a fresh temp
 * dir and POB_FORK_PATH unset; `search_tree_nodes` must return >= 1 node, which shows the engine
 * and its tree data were loaded from <repo>/vendor/PathOfBuilding-PoE2.
 */
import { afterAll, it, expect } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { engineDescribe } from '../helpers/engine';
import { spawnServer, type SpawnedServer } from '../helpers/spawnServer';

engineDescribe('stdio e2e: PoB checkout resolved from the package root (C-6)', () => {
  let server: SpawnedServer | null = null;
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-e2e-cwd-'));

  afterAll(async () => {
    if (server) await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('AC-F5: spawned with cwd = a temp dir, search_tree_nodes {keyword:"Life"} finds >= 1 node', async () => {
    server = await spawnServer({ POB_FORK_PATH: undefined, POB_ALLOW_UNPINNED: undefined }, { cwd });

    const result = await server.client.callTool(
      { name: 'search_tree_nodes', arguments: { keyword: 'Life' } },
      undefined,
      { timeout: 110_000 },
    );
    const text = (result.content as Array<{ type: string; text: string }>).map((c) => c.text).join('\n');
    const found = text.match(/Found (\d+) matching node/);
    if (!found) throw new Error(`no nodes found. Tool output:\n${text}\n--- server stderr (tail) ---\n${server.stderr().slice(-3000)}`);
    expect(Number(found[1])).toBeGreaterThanOrEqual(1);
    expect(result.isError).toBeFalsy();
  }, 120_000);
});
