/**
 * AC-F18: the D-4 deletions, in process (startTestServer, C-18). None of the deleted tool names is
 * listed, and calling any of them is the JSON-RPC protocol error -32602 "Unknown tool: <name>" (C-1).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { startTestServer, type TestServer } from '../helpers/server';

/** The 25 routed names D-4 deletes (vision §4, Delete row). */
const D4_DELETED = [
  // (a) PoE1-only
  'analyze_build_cluster_jewels',
  'analyze_cluster_jewels',
  'search_cluster_jewels',
  'suggest_watchers_eye',
  'suggest_masteries',
  'check_boss_readiness',
  'optimize_skill_links',
  'create_budget_build',
  'suggest_optimal_nodes',
  'optimize_tree',
  'analyze_items',
  // (b) legacy gem tools
  'analyze_skill_links',
  'suggest_support_gems',
  'find_optimal_links',
  'validate_gem_quality',
  'compare_gem_setups',
  'gem_upgrade_path',
  // (c) broken trade tools
  'compare_trade_items',
  'generate_shopping_list',
  'find_resistance_gear',
  // (d) inert or redundant
  'find_arbitrage',
  'calculate_trading_profit',
  'refresh_tree_data',
  'save_tree',
  // (e)
  'suggest_crafting',
];

/** AC-F18's list: the 25 D-4 names, find_item_upgrades, and the two routed-only names named again. */
const MUST_BE_GONE = [...new Set([...D4_DELETED, 'find_item_upgrades', 'analyze_cluster_jewels', 'find_resistance_gear'])];

describe('AC-F18: deleted tools are gone (D-4)', () => {
  let server: TestServer;
  beforeAll(async () => {
    // Every group enabled, so nothing is hidden for a reason other than deletion.
    server = await startTestServer({ env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined } });
  });
  afterAll(async () => {
    await server.close();
  });

  it('AC-F18: the list covers the 25 D-4 names plus find_item_upgrades', () => {
    expect(new Set(D4_DELETED).size).toBe(25);
    expect(MUST_BE_GONE).toHaveLength(26);
  });

  it('AC-F18: listTools contains none of the deleted names', async () => {
    const listed = new Set((await server.client.listTools()).tools.map((t) => t.name));
    expect(MUST_BE_GONE.filter((n) => listed.has(n))).toEqual([]);
  });

  it.each(MUST_BE_GONE)('AC-F18: calling %s rejects with JSON-RPC -32602 "Unknown tool"', async (name) => {
    const err = await server.client.callTool({ name, arguments: {} }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(McpError);
    expect((err as McpError).code).toBe(-32602);
    expect((err as McpError).message).toContain(`Unknown tool: ${name}`);
  });
});
