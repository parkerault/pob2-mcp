/**
 * AC-F14: listing and routing follow TOOL_META.group and the two opt-out flags (C-1, C-8, D-14).
 */
import { describe, it, expect, afterEach } from '@jest/globals';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { startTestServer, type TestServer } from '../helpers/server';
import { TOOL_META, type ToolGroup } from '../../src/server/toolMeta';
import { getToolSchemas, getLuaToolSchemas, getOptimizationToolSchemas, getConfigToolSchemas, getValidationToolSchemas, getExportToolSchemas, getTradeToolSchemas, getPoeNinjaToolSchemas, getBuildGoalsToolSchemas } from '../../src/server/toolSchemas';

const names = (group: ToolGroup) => Object.keys(TOOL_META).filter((n) => TOOL_META[n].group === group);

async function rejection(p: Promise<unknown>): Promise<McpError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(McpError);
  return err as McpError;
}

describe('AC-F14: listing flags (C-1)', () => {
  let server: TestServer | null = null;
  afterEach(async () => {
    if (server) await server.close();
    server = null;
  });

  it('AC-F14: with neither flag set, every TOOL_META name is listed, and every listed tool has TOOL_META', async () => {
    server = await startTestServer({ env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined } });
    const listed = (await server.client.listTools()).tools.map((t) => t.name).sort();
    expect(listed).toEqual(Object.keys(TOOL_META).sort());
  });

  it('AC-F14: every registered schema has exactly one TOOL_META entry, and vice versa', () => {
    const registered = [
      ...getToolSchemas(), ...getLuaToolSchemas(), ...getOptimizationToolSchemas(), ...getConfigToolSchemas(),
      ...getValidationToolSchemas(), ...getExportToolSchemas(), ...getTradeToolSchemas(),
      ...getPoeNinjaToolSchemas(), ...getBuildGoalsToolSchemas(),
    ].map((t: { name: string }) => t.name);
    expect(new Set(registered).size).toBe(registered.length);
    expect([...registered].sort()).toEqual(Object.keys(TOOL_META).sort());
  });

  it('AC-F14: POE_TRADE_DISABLED=true hides group "trade" and calling one gives -32602', async () => {
    server = await startTestServer({ env: { POE_TRADE_DISABLED: 'true', POE_NINJA_DISABLED: undefined } });
    const listed = new Set((await server.client.listTools()).tools.map((t) => t.name));
    const trade = names('trade');
    expect(trade.length).toBeGreaterThan(0);
    for (const n of trade) expect(listed.has(n)).toBe(false);
    for (const n of names('ninja')) expect(listed.has(n)).toBe(true);
    for (const n of trade) {
      const err = await rejection(server.client.callTool({ name: n, arguments: {} }));
      expect(err.code).toBe(-32602);
      expect(err.message).toContain(`Unknown tool: ${n}`);
    }
  });

  it('AC-F14: POE_NINJA_DISABLED=true hides group "ninja" and calling one gives -32602', async () => {
    server = await startTestServer({ env: { POE_NINJA_DISABLED: 'true', POE_TRADE_DISABLED: undefined } });
    const listed = new Set((await server.client.listTools()).tools.map((t) => t.name));
    const ninja = names('ninja');
    expect(ninja.length).toBeGreaterThan(0);
    for (const n of ninja) expect(listed.has(n)).toBe(false);
    for (const n of names('trade')) expect(listed.has(n)).toBe(true);
    for (const n of ninja) {
      const err = await rejection(server.client.callTool({ name: n, arguments: {} }));
      expect(err.code).toBe(-32602);
      expect(err.message).toContain(`Unknown tool: ${n}`);
    }
  });

  it('AC-F14: the engine tools are listed by default (POB_LUA_ENABLED is gone)', async () => {
    server = await startTestServer({ env: { POB_LUA_ENABLED: undefined } });
    const listed = new Set((await server.client.listTools()).tools.map((t) => t.name));
    for (const n of ['lua_start', 'lua_load_build', 'get_config', 'get_build_issues']) expect(listed.has(n)).toBe(true);
  });
});
