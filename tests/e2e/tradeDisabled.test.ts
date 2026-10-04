/**
 * AC-F28 (e2e part, FR-F5): a server spawned by tests (spawnServer, C-18) has the trade group
 * disabled, so get_leagues is a JSON-RPC -32602 and nothing reaches pathofexile.com.
 */
import { describe, afterAll, it, expect } from '@jest/globals';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { spawnServer, spawnServerEnv, type SpawnedServer } from '../helpers/spawnServer';

describe('stdio e2e: spawned servers never reach the trade site', () => {
  let server: SpawnedServer | null = null;

  afterAll(async () => {
    if (server) await server.close();
  });

  it('AC-F28: get_leagues is rejected with -32602 because the trade group is disabled', async () => {
    const env = spawnServerEnv();
    expect(env.POE_TRADE_DISABLED).toBe('true');
    expect(env.POE_NINJA_DISABLED).toBe('true');
    expect(env.POE_TRADE_BASE).toBe('http://127.0.0.1:9/api/trade2');
    // Value-free checks: a failing assertion must never print the cookie itself (spine §9).
    expect('POESESSID' in env).toBe(false);
    expect('POE_SESSION_ID' in env).toBe(false);

    server = await spawnServer();
    const err = await server.client.callTool({ name: 'get_leagues', arguments: {} }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(McpError);
    expect((err as McpError).code).toBe(-32602);
    expect((err as McpError).message).toContain('Unknown tool: get_leagues');

    const { tools } = await server.client.listTools();
    expect(tools.some((t) => t.name === 'get_leagues')).toBe(false);
    // The trade client never ran: no trade request or stat preload was logged.
    expect(server.stderr()).not.toMatch(/pathofexile\.com|\[TradeAPI\]|\[StatMapper\]/);
  });
});
