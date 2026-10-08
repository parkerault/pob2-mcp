/**
 * AC-K42 (slice 01): the build-guide epic's server tools end to end over stdio, engine-required.
 *
 * One `build/index.js` is spawned through `spawnServer` (C-18: trade and poe.ninja disabled, temp folders,
 * a temp cwd), so `tools/list` holds only the `core` group's tools. Checks:
 * - `tools/list` includes every tool in `CORE_TOOLS`, and `TOOL_META` puts each in group `core`;
 * - each `CALLS` entry returns non-error text matching its patterns;
 * - every stdout line is a JSON-RPC message (NFR-8). Keep this check last, so it covers every call above.
 *
 * Appending (WU-35, WU-36): add the new tool to `CORE_TOOLS` and its sample call to `CALLS`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { spawnServer, type SpawnedServer } from '../helpers/spawnServer';
import { TOOL_META } from '../../src/server/toolMeta';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');
const RUBY_RING = fs.readFileSync(path.join(FIXTURES, 'items', 'ruby-ring.txt'), 'utf8');
const CALL_TIMEOUT = 120_000;
const TEST_TIMEOUT = 150_000;

/** The `core` tools the epic adds, as each lands (WU-31, WU-32, WU-36, WU-35). */
const CORE_TOOLS = ['lookup_game_data', 'check_model_coverage', 'set_tree_state', 'manage_sets'];

interface Call {
  tool: string;
  args: Record<string, unknown>;
  /** Every pattern must match the tool's text. */
  expect: RegExp[];
}

/** One sample call per added tool. */
const CALLS: Call[] = [
  // WU-31 (C-37): names Blood Hunt.
  { tool: 'lookup_game_data', args: { mode: 'gem', query: 'Blood Hunt' }, expect: [/^## Blood Hunt$/m] },
  // WU-32 (C-38): the ruby ring's lines, each with a status.
  {
    tool: 'check_model_coverage',
    args: { item_text: RUBY_RING },
    expect: [/^Counts over \d+ lines/m, /^\[(fully parsed|partly parsed|unparsed|parsed to nothing|possibly unread)\] \+62 to maximum Life$/m],
  },
  // WU-36 (C-40): on the server's new build, untag every node; the output lists both weapon sets and the
  // attributes.
  {
    tool: 'set_tree_state',
    args: { weapon_set_nodes: {} },
    expect: [/^Weapon set 1 \(0 nodes\): none$/m, /^Weapon set 2 \(0 nodes\): none$/m, /^Attributes: Str \d+, Dex \d+, Int \d+$/m],
  },
  // WU-35 (C-39): the slice sample; the new skill set is listed, not active.
  {
    tool: 'manage_sets',
    args: { set_type: 'skill', action: 'create', title: 'Sample {2}' },
    expect: [/^Created skill set (\d+) "Sample \{2\}"; it is not active/m, /^\d+\. "Sample \{2\}" \| main group /m],
  },
];

engineDescribe('AC-K42: the build-guide server tools over stdio (spawnServer)', () => {
  let server: SpawnedServer;

  beforeAll(async () => {
    server = await spawnServer();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await server?.close();
  });

  it('AC-K42: tools/list includes the added tools, each in group core', async () => {
    const listed = (await server.client.listTools()).tools.map((t) => t.name);
    for (const tool of CORE_TOOLS) {
      expect({ tool, listed: listed.includes(tool) }).toEqual({ tool, listed: true });
      expect({ tool, group: TOOL_META[tool]?.group }).toEqual({ tool, group: 'core' });
    }
  });

  for (const call of CALLS) {
    it(
      `AC-K42: ${call.tool} ${JSON.stringify(call.args).slice(0, 80)} returns non-error text`,
      async () => {
        const result = (await server.client.callTool({ name: call.tool, arguments: call.args }, undefined, {
          timeout: CALL_TIMEOUT,
        })) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
        const text = (result.content ?? []).map((c) => c.text ?? '').join('\n');
        expect({ tool: call.tool, isError: result.isError === true, text: result.isError ? text : '' }).toEqual({
          tool: call.tool,
          isError: false,
          text: '',
        });
        for (const pattern of call.expect) expect(text).toMatch(pattern);
      },
      TEST_TIMEOUT,
    );
  }

  // Keep last: it checks the stdout of every call above.
  it('AC-K42: every stdout line is a JSON-RPC message (NFR-8)', () => {
    expect(server.stdoutLines.length).toBeGreaterThan(0);
    const bad = server.stdoutLines.filter((line) => {
      try {
        return (JSON.parse(line) as { jsonrpc?: unknown }).jsonrpc !== '2.0';
      } catch {
        return true;
      }
    });
    expect(bad).toEqual([]);
  });
});
