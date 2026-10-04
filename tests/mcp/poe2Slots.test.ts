/**
 * AC-E38 (WU-11), static and in-process: the `create_socket_group` and `setup_skill_with_gems` slot enums
 * equal PoB2's `baseSlots` (read from the pinned checkout's `Classes/ItemsTab.lua`) minus `Arm 1/2` and
 * `Leg 1/2`, plus `Weapon 1 Swap`/`Weapon 2 Swap`; no PoE1 slot name appears. The static part checks
 * the schema module; the in-process part checks what the real server lists over MCP.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { getLuaToolSchemas } from '../../src/server/toolSchemas';
import { startTestServer, type TestServer } from '../helpers/server';
import { resolvePobSrc } from '../../src/engine/pobPath';

const SLOT_TOOLS = ['create_socket_group', 'setup_skill_with_gems'];
/** PoE1-only slot names (PoE2 has two flasks and no off-hand-only slot names). */
const POE1_SLOTS = ['Flask 3', 'Flask 4', 'Flask 5'];

/** `local baseSlots = { ... }` from the pinned PoB2 `Classes/ItemsTab.lua`. */
function pobBaseSlots(): string[] {
  const file = path.join(resolvePobSrc(process.env), 'Classes', 'ItemsTab.lua');
  if (!fs.existsSync(file)) {
    throw new Error(`${file} is missing: run \`mise run pob:fetch\` (AC-E38 reads PoB2's baseSlots from the pin)`);
  }
  const m = /local baseSlots = \{([^}]*)\}/.exec(fs.readFileSync(file, 'utf8'));
  if (!m) throw new Error('no `local baseSlots = {…}` in ItemsTab.lua');
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function expectedSlots(): string[] {
  const base = pobBaseSlots().filter((s) => !/^(Arm|Leg) [12]$/.test(s));
  return [...base, 'Weapon 1 Swap', 'Weapon 2 Swap'].sort();
}

function slotEnum(schemas: Array<{ name: string; inputSchema: unknown }>, tool: string): string[] {
  const schema = schemas.find((s) => s.name === tool);
  expect(schema).toBeDefined();
  const props = (schema!.inputSchema as { properties: Record<string, { enum?: string[] }> }).properties;
  expect(props.slot?.enum).toBeDefined();
  return props.slot.enum!;
}

describe('AC-E38: PoE2 slot enums (static)', () => {
  it('AC-E38: PoB2 baseSlots on the pin are the 20 PoE2 slots, Arm/Leg included', () => {
    const base = pobBaseSlots();
    expect(base).toHaveLength(20);
    expect(base).toEqual(expect.arrayContaining(['Arm 1', 'Arm 2', 'Leg 1', 'Leg 2', 'Charm 3', 'Flask 2']));
  });

  it('AC-E38: create_socket_group and setup_skill_with_gems slot enums = baseSlots minus Arm/Leg plus the weapon swap slots, with no PoE1 slot', () => {
    const schemas = getLuaToolSchemas();
    for (const tool of SLOT_TOOLS) {
      const values = slotEnum(schemas, tool);
      expect([...values].sort()).toEqual(expectedSlots());
      expect(new Set(values).size).toBe(values.length);
      for (const poe1 of POE1_SLOTS) expect(values).not.toContain(poe1);
    }
  });
});

describe('AC-E38: PoE2 slot enums (in-process, listTools)', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.close();
  });

  it('AC-E38: the listed create_socket_group and setup_skill_with_gems schemas carry the PoE2 slot enum', async () => {
    const { tools } = await server.client.listTools();
    for (const tool of SLOT_TOOLS) {
      const values = slotEnum(tools, tool);
      expect([...values].sort()).toEqual(expectedSlots());
      for (const poe1 of POE1_SLOTS) expect(values).not.toContain(poe1);
    }
    // AC-E37's schema part: toggle_flask's slot enum is exactly PoE2's flasks and charms.
    expect(slotEnum(tools, 'toggle_flask')).toEqual(['Flask 1', 'Flask 2', 'Charm 1', 'Charm 2', 'Charm 3']);
  });
});
