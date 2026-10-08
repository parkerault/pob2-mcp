/**
 * AC-T41 (WU-17, C-15): the `trade_query_options` tool, in process.
 *
 * The real `Client`, router, handler and engine session over the golden build (so the engine is real
 * luajit), with HTTP served by an empty `fixtureFetch`: the tool sends no trade request, and any request
 * would throw "unmatched fetch".
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { fixtureFetch } from '../helpers/fixtureFetch';
import { getTradeToolSchemas } from '../../src/server/toolSchemas';
import { tradeQueryOptionsInputSchema } from '../../src/handlers/tradeHandlers';
import { TOOL_META } from '../../src/server/toolMeta';
import { zodToJsonSchema } from 'zod-to-json-schema';

const DISPOSITION = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'tool-disposition.json'), 'utf8'),
) as Array<{ name: string; bucket: string; pending?: string }>;

engineDescribe('AC-T41 (WU-17, C-15): trade_query_options through the MCP tool', () => {
  let fx: SessionFixture;
  const http = fixtureFetch([]);

  beforeAll(async () => {
    fx = await startSessionFixture({ deps: { fetch: http.fetch, env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined } } });
    const load = await fx.call('lua_load_build', { build_name: 'grenadator.xml' });
    if (load.isError) throw new Error(`loading the golden build failed: ${load.text}`);
  }, 120_000);

  afterAll(async () => {
    if (fx) await fx.close();
  }, 60_000);

  it('AC-T41: trade_query_options {slot:"Ring 1"} renders every C-15 section, with no "undefined"', async () => {
    const out = await fx.call('trade_query_options', { slot: 'Ring 1' });
    expect(out.isError).toBe(false);
    const text = out.text;
    expect(text).not.toMatch(/undefined|NaN|\[object Object\]/);
    // supported (or the reason)
    expect(text).toContain('=== trade_query_options: Ring 1 ===');
    expect(text).toMatch(/^Supported: yes \(trade category accessory\.ring\)$/m);
    // sort stats (label and stat id)
    expect(text).toMatch(/^Sort stats \(find_upgrades sort_stats\[\]\.stat\), \d+:$/m);
    expect(text).toMatch(/^ {2}FullDPS: .+$/m);
    expect(text).not.toMatch(/TakenHit/);
    // weights (saved, or the defaults)
    expect(text).toMatch(/^Weights \(the default sort_stats\): /m);
    expect(text).toMatch(/^ {2}\w+ ×[\d.]+$/m);
    // required-mod choices, sorted by trade id
    const choices = [...text.matchAll(/^ {2}((?:explicit|implicit|enchant|rune|desecrated|fractured|crafted|pseudo|sanctum|skill)\.[\w.]+): .+ \((explicit|implicit|corrupted)\)$/gm)].map((m) => m[1]);
    expect(choices.length).toBeGreaterThan(0);
    expect([...choices].sort()).toEqual(choices);
    expect(text).toMatch(/^Required-mod choices \(find_upgrades required_mods\[\]\.trade_id\), \d+:$/m);
    // currencies and statuses (input value → label)
    expect(text).toContain('Currencies (find_upgrades currency):');
    expect(text).toContain('  exalted_equivalent → Exalted Orb Equivalent');
    expect(text).toContain('  divine → Divine Orb');
    expect(text).toContain('Statuses (find_upgrades status):');
    expect(text).toContain('  securable → Instant buyout');
    // which find_upgrades options apply
    expect(text).toContain('find_upgrades options for this slot:');
    expect(text).toContain('  min_empty_rune_sockets: does not apply');
    expect(text).toContain('  anoint_behaviour: does not apply');
    expect(text).toContain('  jewel_type: does not apply');
    // No trade request of any kind.
    expect(http.calls).toEqual([]);
  });

  it('AC-T41: an unsupported slot renders the reason; a missing slot is an isError naming the field (D-27)', async () => {
    const charm = await fx.call('trade_query_options', { slot: 'Charm 1' });
    expect(charm.isError).toBe(false);
    expect(charm.text).toMatch(/^Supported: no\. slot Charm 1 is not supported for weighted trade search; supported: /m);
    expect(charm.text).not.toMatch(/undefined|NaN|\[object Object\]/);

    const missing = await fx.call('trade_query_options', {});
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('slot');
  });

  // AC-T41 counted 75 tools when WU-17 landed; WU-23 lists find_upgrades too (76), WU-25 set_gem_corruption (77, D-91),
  // WU-31 lookup_game_data (78), WU-40 encode_build_code (79, C-42), WU-32 check_model_coverage (80, C-38) and
  // WU-36 set_tree_state (81, C-40).
  it('AC-T41: tool-disposition.json has no pending on trade_query_options, and listTools has 81 tools (75 + find_upgrades + set_gem_corruption + lookup_game_data + encode_build_code + check_model_coverage + set_tree_state, AC-T45, D-91)', async () => {
    const entry = DISPOSITION.find((e) => e.name === 'trade_query_options');
    expect(entry).toBeDefined();
    expect(entry!.pending).toBeUndefined();
    const listed = (await fx.server.client.listTools()).tools.map((t) => t.name);
    expect(listed).toHaveLength(81);
    expect(listed).toContain('trade_query_options');
    expect(TOOL_META.trade_query_options).toEqual({ engine: 'read', group: 'trade' });
  });

  it('C-15 / D-27: the JSON-Schema literal agrees with the zod input schema', () => {
    const literal = getTradeToolSchemas().find((t: { name: string }) => t.name === 'trade_query_options') as {
      inputSchema: { properties: Record<string, { type: string; minLength?: number }>; required: string[] };
    };
    const fromZod = zodToJsonSchema(tradeQueryOptionsInputSchema) as {
      properties: Record<string, { type: string; minLength?: number }>;
      required: string[];
    };
    expect(Object.keys(literal.inputSchema.properties).sort()).toEqual(Object.keys(fromZod.properties).sort());
    for (const [k, v] of Object.entries(fromZod.properties)) {
      expect(literal.inputSchema.properties[k].type).toBe(v.type);
      expect(literal.inputSchema.properties[k].minLength).toBe(v.minLength);
    }
    expect([...literal.inputSchema.required].sort()).toEqual([...fromZod.required].sort());
  });
});
