/**
 * AC-F22: the tool set (C-1, C-8).
 *
 * - In process, the `listTools` set equals the non-delete, non-pending names of
 *   `tests/fixtures/tool-disposition.json` (WU-05). Until WU-05 creates that file, it equals the
 *   literal vision §4 Keep + Fix + Rewrite list: 74 names.
 * - Registered and routed sets are equal: every `TOOL_META` name reaches a handler, and the router
 *   has no `case` without a `TOOL_META` entry (static check of `toolRouter.ts`).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { startTestServer, type TestServer } from '../helpers/server';
import { TOOL_META } from '../../src/server/toolMeta';

const REPO = path.resolve(__dirname, '..', '..');
const DISPOSITION = path.join(REPO, 'tests', 'fixtures', 'tool-disposition.json');
const ROUTER = path.join(REPO, 'src', 'server', 'toolRouter.ts');

/** Vision §4: Keep (25) + Fix (46) + Rewrite (3) = the 74 tools after WU-04. */
const VISION_KEEP_FIX_REWRITE = [
  // Keep
  'lua_load_build', 'lua_start', 'lua_stop', 'lua_reload_build', 'search_tree_nodes', 'list_gems', 'get_classes',
  'set_character_level', 'get_skill_setup', 'set_main_skill', 'set_gem_level', 'set_gem_quality', 'remove_gem',
  'remove_skill', 'toggle_gem', 'toggle_socket_group', 'get_equipped_items', 'snapshot_build', 'list_snapshots',
  'restore_snapshot', 'get_build_notes', 'set_build_notes', 'get_build_stats', 'compare_trees', 'get_leagues',
  // Fix: engine ops
  'lua_new_build', 'lua_save_build', 'lua_get_build_info', 'lua_get_tree', 'lua_get_stats', 'lua_set_tree',
  'update_tree_delta', 'create_spec', 'add_item', 'add_multiple_items', 'add_gem', 'create_socket_group',
  'setup_skill_with_gems', 'toggle_flask', 'get_config', 'set_config', 'set_enemy_stats', 'save_config_preset',
  'load_config_preset', 'list_config_presets', 'get_passive_upgrades', 'plan_leveling', 'analyze_skills',
  'suggest_supports', 'analyze_build', 'compare_builds', 'export_build', 'export_build_summary', 'list_builds',
  'get_nearby_nodes', 'find_path_to_node', 'import_build', 'start_watching', 'stop_watching', 'get_recent_changes',
  'watch_status',
  // Fix: TS<->Lua shapes
  'list_specs', 'select_spec', 'delete_spec', 'rename_spec', 'list_item_sets', 'select_item_set',
  // Fix: trade/currency
  'search_trade_items', 'get_item_price', 'search_stats', 'get_currency_rates',
  // Rewrite on engine data
  'validate_build', 'analyze_defenses', 'get_build_issues',
];

interface DispositionEntry {
  name: string;
  bucket: 'keep' | 'fix' | 'rewrite' | 'new' | 'delete';
  lane?: string;
  pending?: string;
}

/** The expected tool set: from the disposition file once WU-05 has created it, else the literal list. */
function expectedToolSet(): { source: string; names: string[] } {
  if (fs.existsSync(DISPOSITION)) {
    const entries = JSON.parse(fs.readFileSync(DISPOSITION, 'utf8')) as DispositionEntry[];
    const names = entries.filter((e) => e.bucket !== 'delete' && !e.pending).map((e) => e.name);
    return { source: 'tests/fixtures/tool-disposition.json', names };
  }
  return { source: 'vision §4 Keep + Fix + Rewrite', names: VISION_KEEP_FIX_REWRITE };
}

/** The string labels of every `case` in toolRouter.ts's switch statements. */
function routerCaseLabels(): string[] {
  const text = fs.readFileSync(ROUTER, 'utf8');
  const sf = ts.createSourceFile(ROUTER, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const labels: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCaseClause(node)) {
      if (!ts.isStringLiteralLike(node.expression)) {
        throw new Error(`non-literal case label in toolRouter.ts: ${node.expression.getText(sf)}`);
      }
      labels.push(node.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return labels;
}

describe('AC-F22: the tool set', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startTestServer({ env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined } });
  });
  afterAll(async () => {
    await server.close();
  });

  it('AC-F22: the literal vision §4 list has 74 distinct names', () => {
    expect(new Set(VISION_KEEP_FIX_REWRITE).size).toBe(74);
  });

  it('AC-F22: the in-process listTools set equals the expected tool set (74 at WU-04)', async () => {
    const { names } = expectedToolSet();
    const listed = (await server.client.listTools()).tools.map((t) => t.name);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...names].sort());
  });

  it('AC-F22: the router has exactly one case per TOOL_META name, and no case without TOOL_META (static)', () => {
    const labels = routerCaseLabels();
    expect(new Set(labels).size).toBe(labels.length);
    expect([...labels].sort()).toEqual(Object.keys(TOOL_META).sort());
  });

  it('AC-F22: every engine-free TOOL_META name reaches a handler in process (never "Unknown tool")', async () => {
    // Engine-free tools only, so this in-process check never starts luajit; the static check above
    // covers the engine tools' cases.
    const engineFree = Object.keys(TOOL_META).filter((n) => TOOL_META[n].engine === 'none');
    expect(engineFree.length).toBeGreaterThan(0);
    const unknown: string[] = [];
    for (const name of engineFree) {
      const outcome = await server.client.callTool({ name, arguments: {} }).then(
        () => null,
        (e: unknown) => e,
      );
      if (outcome instanceof McpError && outcome.code === -32602) unknown.push(name);
    }
    expect(unknown).toEqual([]);
  });
});
