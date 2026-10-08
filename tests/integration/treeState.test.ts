/**
 * Slice 01, L1 tree state (WU-36): AC-K31…AC-K38, in process and engine-required; AC-K35 also static.
 *
 * - AC-K31…AC-K34: `set_tree_state` (C-40) on the golden build: weapon-set tags, attribute choices, its
 *   all-or-nothing errors, and persistence through save and load.
 * - AC-K35, AC-K36: `add_item`'s tree-jewel slots (C-46): the enum, and socketing into the active spec.
 * - AC-K37, AC-K38: `update_tree_delta` (C-48, D-194): auto-path along PoB's own path, and the 8-point
 *   ascendancy cap. AC-K38's reply-field part is in `contract.test.ts`.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handlers, session, bridge
 * and luajit) over a private builds folder holding the golden build. Tool outputs are read through MCP;
 * independent checks are Lua queries (`__test_eval`, test actions on) and the engine's own export.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { EngineKind } from '../../src/engine/session';
import type { PoBLuaApiClient } from '../../src/pobLuaBridge';
import { ITEM_SLOTS, getLuaToolSchemas } from '../../src/server/toolSchemas';

const ENGINE_TIMEOUT = 240_000;
const FIXTURES = path.resolve(__dirname, '..', 'fixtures');
const JEWEL = fs.readFileSync(path.join(FIXTURES, 'items', 'jewel.txt'), 'utf8');
const RUBY_RING = fs.readFileSync(path.join(FIXTURES, 'items', 'ruby-ring.txt'), 'utf8');

/** The 18 PoE2 equipment slots WU-11 settled (AC-E38): `ITEM_SLOTS` must stay exactly these (D-223). */
const WU11_ITEM_SLOTS = [
  'Weapon 1', 'Weapon 1 Swap', 'Weapon 2', 'Weapon 2 Swap',
  'Helmet', 'Body Armour', 'Gloves', 'Boots', 'Amulet', 'Ring 1', 'Ring 2', 'Ring 3', 'Belt',
  'Charm 1', 'Charm 2', 'Charm 3', 'Flask 1', 'Flask 2',
];

// ---------------------------------------------------------------------------------------------------
// Export readers (the active <Spec> only)

/** One attribute of an XML start tag, wherever it sits among the others. */
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : undefined;
}

/** A comma-separated id list as a sorted set of numbers. */
const idSet = (list: string | undefined): number[] =>
  [...new Set((list ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number))].sort((a, b) => a - b);
const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

/** The body of the active `<Spec>` (`<Tree activeSpec>`, 1-based). */
function activeSpecBody(xml: string): string {
  const tree = /<Tree\b[^>]*>/.exec(xml);
  expect(tree).not.toBeNull();
  const active = Number(attr(tree![0], 'activeSpec'));
  const specs = [...xml.matchAll(/<Spec\b[^>]*>([\s\S]*?)<\/Spec>/g)];
  expect(active).toBeGreaterThanOrEqual(1);
  expect(specs.length).toBeGreaterThanOrEqual(active);
  return specs[active - 1][1];
}

/** The active spec's `<WeaponSet<N> nodes>` lists, as `{N: sorted ids}`. */
function weaponSets(xml: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const m of activeSpecBody(xml).matchAll(/<WeaponSet(\d)\b[^>]*>/g)) out[m[1]] = idSet(attr(m[0], 'nodes'));
  return out;
}

/** The active spec's `<AttributeOverride>` node sets. */
function attributeOverride(xml: string): { str: number[]; dex: number[]; int: number[] } {
  const tags = [...activeSpecBody(xml).matchAll(/<AttributeOverride\b[^>]*>/g)].map((m) => m[0]);
  expect(tags.length).toBeLessThanOrEqual(1);
  const tag = tags[0] ?? '';
  return { str: idSet(attr(tag, 'strNodes')), dex: idSet(attr(tag, 'dexNodes')), int: idSet(attr(tag, 'intNodes')) };
}

/** The active spec's `<Socket nodeId itemId>` entries, as `{nodeId: itemId}`. */
function sockets(xml: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of activeSpecBody(xml).matchAll(/<Socket\b[^>]*>/g)) out[Number(attr(m[0], 'nodeId'))] = Number(attr(m[0], 'itemId'));
  return out;
}

/** `Str`, `Dex` and `Int` as `lua_get_stats` prints them (`<Stat>: <value>` lines). */
function attributesOf(text: string): { Str: number; Dex: number; Int: number } {
  const read = (stat: string) => {
    const m = new RegExp(`^${stat}: ([\\d.]+)$`, 'm').exec(text);
    expect({ stat, found: m !== null }).toEqual({ stat, found: true });
    return Number(m![1]);
  };
  return { Str: read('Str'), Dex: read('Dex'), Int: read('Int') };
}

// ---------------------------------------------------------------------------------------------------
// Lua queries (independent of the tools under test)

/** Allocated leaf nodes PoB can tag (§2.8): Normal or Notable, outside any ascendancy, no jewel socket. */
const TAGGABLE_LEAVES = `
  local s = build.spec
  local ids = {}
  for id, node in pairs(s.allocNodes) do
    local linked = 0
    for _, other in ipairs(node.linked) do if other.alloc then linked = linked + 1 end end
    if linked == 1 and (node.type == 'Normal' or node.type == 'Notable') and not node.ascendancyName
        and not node.containJewelSocket and not node.isAttribute then
      ids[#ids + 1] = id
    end
  end
  table.sort(ids)
  return ids`;

/** An allocated attribute node whose choice isn't Intelligence, with its current choice. */
const NON_INT_ATTRIBUTE = `
  local s = build.spec
  local ids = {}
  for id, node in pairs(s.allocNodes) do
    local o = s.hashOverrides[id]
    if node.isAttribute and o and o.dn ~= 'Intelligence' then ids[#ids + 1] = id end
  end
  table.sort(ids)
  return { id = ids[1], dn = s.hashOverrides[ids[1]].dn }`;

/** The first allocated node (by id) matching a Lua condition on `node`. */
const firstAllocated = (cond: string) => `
  local ids = {}
  for id, node in pairs(build.spec.allocNodes) do if ${cond} then ids[#ids + 1] = id end end
  table.sort(ids)
  return ids[1]`;

/** The allocated node ids with a weapon-set tag, as `{id, mode}`, by id. */
const TAGGED = `
  local rows = {}
  for id, node in pairs(build.spec.allocNodes) do
    if node.allocMode and node.allocMode ~= 0 then rows[#rows + 1] = { id = id, mode = node.allocMode } end
  end
  table.sort(rows, function(a, b) return a.id < b.id end)
  return rows`;

/** Every jewel socket of the pinned tree (ItemsTab's own rule, `vendor/Classes/ItemsTab.lua:278-290`). */
const TREE_SOCKETS = `
  local ids = {}
  for _, node in pairs(build.latestTree.nodes) do
    if node.type == 'Socket' or node.containJewelSocket then ids[#ids + 1] = node.id end
  end
  table.sort(ids)
  return ids`;

engineDescribe('WU-36: L1 tree state on the engine (C-40, C-46, C-48)', () => {
  let f: SessionFixture;

  async function run<T>(kind: EngineKind, fn: (client: PoBLuaApiClient) => Promise<T>): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:tree-state', kind }, (ctx) => fn(ctx.client));
    return value;
  }
  async function luaQuery<T>(code: string): Promise<T> {
    return run('read', async (client) => (await client.request('__test_eval', { code })).result as T);
  }
  const exportXml = () => run('read', (client) => client.exportBuildXml());
  const allocated = async () => sorted((await run('read', (client) => client.getTree())).nodes);
  async function stats(): Promise<{ Str: number; Dex: number; Int: number }> {
    const out = await f.call('lua_get_stats');
    expect(out.isError).toBe(false);
    return attributesOf(out.text);
  }

  /** The call fails naming each of `needles`, and leaves the canonical export and `revision` unchanged. */
  async function expectRefused(tool: string, args: Record<string, unknown>, needles: string[]): Promise<string> {
    const before = await canonicalExport(f.session);
    const revision = f.session.revision;
    const out = await f.call(tool, args);
    expect({ args, isError: out.isError }).toEqual({ args, isError: true });
    for (const needle of needles) expect(out.text).toContain(needle);
    expect(f.session.revision).toBe(revision);
    expect((await canonicalExport(f.session)) === before).toBe(true);
    return out.text;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  beforeEach(async () => {
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  /** AC-K31's change: leaves a, b on weapon set 1 and c on weapon set 2. */
  async function tagLeaves(): Promise<{ a: number; b: number; c: number; text: string }> {
    const leaves = await luaQuery<number[]>(TAGGABLE_LEAVES);
    expect(leaves.length).toBeGreaterThanOrEqual(3);
    const [a, b, c] = leaves;
    const out = await f.call('set_tree_state', { weapon_set_nodes: { '1': [String(a), String(b)], '2': [String(c)] } });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    return { a, b, c, text: out.text };
  }

  /** AC-K32's change: attribute node n set to intelligence. */
  async function chooseIntelligence(): Promise<{ n: number; dn: string; text: string }> {
    const { id: n, dn } = await luaQuery<{ id: number; dn: string }>(NON_INT_ATTRIBUTE);
    expect(typeof n).toBe('number');
    const out = await f.call('set_tree_state', { attribute_choices: { [String(n)]: 'intelligence' } });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    return { n, dn, text: out.text };
  }

  it(
    'AC-K31: weapon_set_nodes {"1":[a,b],"2":[c]} on three golden leaves gives WeaponSet1 {a,b}, WeaponSet2 {c}, allocMode 1,1,2, the same allocation and Str/Dex/Int equal to lua_get_stats; a follow-up {"1":[a]} leaves only a tagged',
    async () => {
      const before = await allocated();
      expect(weaponSets(await exportXml())).toEqual({});
      const { a, b, c, text } = await tagLeaves();

      expect(weaponSets(await exportXml())).toEqual({ '1': sorted([a, b]), '2': [c] });
      const modes = await luaQuery<number[]>(`
        local s = build.spec
        return { s.nodes[${a}].allocMode, s.nodes[${b}].allocMode, s.nodes[${c}].allocMode }`);
      expect(modes).toEqual([1, 1, 2]);
      expect(await allocated()).toEqual(before);

      // The output: the tags per weapon set, and Str/Dex/Int as lua_get_stats reports them.
      expect(text).toContain(`Weapon set 1 (2 nodes): ${sorted([a, b]).join(', ')}`);
      expect(text).toContain(`Weapon set 2 (1 node): ${c}`);
      const s = await stats();
      expect(text).toContain(`Attributes: Str ${s.Str}, Dex ${s.Dex}, Int ${s.Int}`);

      // weapon_set_nodes replaces every tag.
      const again = await f.call('set_tree_state', { weapon_set_nodes: { '1': [String(a)] } });
      expect(again.isError).toBe(false);
      expect(weaponSets(await exportXml())).toEqual({ '1': [a] });
      expect(await luaQuery(TAGGED)).toEqual([{ id: a, mode: 1 }]);
      expect(await allocated()).toEqual(before);
      expect(again.text).toContain(`Weapon set 1 (1 node): ${a}`);
      expect(again.text).toContain('Weapon set 2 (0 nodes): none');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K32: attribute_choices {n:"intelligence"} puts n in intNodes only, raises Int, lowers the old attribute, and keeps every other AttributeOverride entry',
    async () => {
      const before = attributeOverride(await exportXml());
      const statsBefore = await stats();
      const { n, dn, text } = await chooseIntelligence();
      expect(['Strength', 'Dexterity']).toContain(dn);

      const after = attributeOverride(await exportXml());
      expect(after.int).toContain(n);
      expect(after.str).not.toContain(n);
      expect(after.dex).not.toContain(n);
      // Every other entry is unchanged.
      const without = (ids: number[]) => ids.filter((id) => id !== n);
      expect({ str: without(after.str), dex: without(after.dex), int: without(after.int) }).toEqual({
        str: without(before.str),
        dex: without(before.dex),
        int: without(before.int),
      });

      const statsAfter = await stats();
      expect(statsAfter.Int).toBeGreaterThan(statsBefore.Int);
      const old = dn === 'Strength' ? 'Str' : 'Dex';
      expect(statsAfter[old]).toBeLessThan(statsBefore[old]);
      expect(text).toContain(`Attributes: Str ${statsAfter.Str}, Dex ${statsAfter.Dex}, Int ${statsAfter.Int}`);
      expect(text).toMatch(new RegExp(`^  Intelligence \\(\\d+\\): .*\\b${n}\\b`, 'm'));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K33: each bad entry is isError naming the node, with the export and revision unchanged (unallocated in either argument, keystone, ascendancy node, socket, both lists, non-attribute, "wisdom", no argument, mixed valid and invalid, a tag that disconnects)',
    async () => {
      const [a] = await luaQuery<number[]>(TAGGABLE_LEAVES);
      const { id: n } = await luaQuery<{ id: number }>(NON_INT_ATTRIBUTE);
      const unallocated = await luaQuery<number>(`
        local ids = {}
        for id, node in pairs(build.spec.nodes) do
          if not node.alloc and node.type == 'Normal' and not node.ascendancyName and node.pathDist == 1 then ids[#ids + 1] = id end
        end
        table.sort(ids)
        return ids[1]`);
      const unallocatedAttribute = await luaQuery<number>(`
        local ids = {}
        for id, node in pairs(build.spec.nodes) do
          if not node.alloc and node.isAttribute and not node.ascendancyName then ids[#ids + 1] = id end
        end
        table.sort(ids)
        return ids[1]`);
      const keystone = await luaQuery<number>(firstAllocated(`node.type == 'Keystone'`));
      const ascendancy = await luaQuery<number>(firstAllocated(`node.ascendancyName and node.type ~= 'AscendClassStart'`));
      const socket = await luaQuery<number>(firstAllocated(`node.type == 'Socket'`));
      // A taggable travel node other untagged nodes connect through: tagging it would cut them off.
      const travel = await luaQuery<number>(firstAllocated(
        `node.type == 'Normal' and not node.ascendancyName and not node.containJewelSocket and #node.depends > 2`,
      ));
      for (const id of [a, n, unallocated, unallocatedAttribute, keystone, ascendancy, socket, travel]) expect(typeof id).toBe('number');

      await expectRefused('set_tree_state', { weapon_set_nodes: { '1': [String(unallocated)] } }, [`node ${unallocated}`, 'not allocated']);
      await expectRefused(
        'set_tree_state',
        { attribute_choices: { [String(unallocatedAttribute)]: 'dexterity' } },
        [`node ${unallocatedAttribute}`, 'not allocated'],
      );
      await expectRefused('set_tree_state', { weapon_set_nodes: { '1': [String(keystone)] } }, [`node ${keystone}`, 'a keystone']);
      await expectRefused('set_tree_state', { weapon_set_nodes: { '2': [String(ascendancy)] } }, [`node ${ascendancy}`, 'an ascendancy node']);
      await expectRefused('set_tree_state', { weapon_set_nodes: { '1': [String(socket)] } }, [`node ${socket}`, 'a jewel socket']);
      await expectRefused('set_tree_state', { weapon_set_nodes: { '1': [String(a)], '2': [String(a)] } }, [`node ${a}`, 'both']);
      await expectRefused('set_tree_state', { attribute_choices: { [String(a)]: 'strength' } }, [`node ${a}`, 'not an attribute node']);
      await expectRefused('set_tree_state', { attribute_choices: { [String(n)]: 'wisdom' } }, [`node ${n}`, 'wisdom']);
      await expectRefused('set_tree_state', {}, ['weapon_set_nodes', 'attribute_choices']);
      // A valid entry beside an invalid one changes nothing either (all-or-nothing).
      const mixed = await expectRefused(
        'set_tree_state',
        { weapon_set_nodes: { '1': [String(a), String(keystone)] }, attribute_choices: { [String(n)]: 'intelligence' } },
        [`node ${keystone}`],
      );
      expect(mixed).not.toContain(`node ${a} `);
      // Any change to the allocated set: the engine puts the spec back.
      await expectRefused('set_tree_state', { weapon_set_nodes: { '1': [String(travel)] } }, ['would no longer be allocated']);
      expect(await luaQuery(TAGGED)).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K34: after AC-K31 and AC-K32, lua_save_build then lua_load_build keep the WeaponSetN and AttributeOverride node lists equal as sets',
    async () => {
      const { a, b, c } = await tagLeaves();
      const { n } = await chooseIntelligence();
      const xml = await exportXml();
      const tags = weaponSets(xml);
      const choices = attributeOverride(xml);
      expect(tags).toEqual({ '1': sorted([a, b]), '2': [c] });
      expect(choices.int).toContain(n);

      const saved = await f.call('lua_save_build', { build_name: 'k34-tree-state' });
      expect(saved.isError).toBe(false);
      const file = fs.readFileSync(path.join(f.builds, 'k34-tree-state.xml'), 'utf8');
      expect(weaponSets(file)).toEqual(tags);
      expect(attributeOverride(file)).toEqual(choices);

      const loaded = await f.call('lua_load_build', { build_name: 'k34-tree-state.xml' });
      expect(loaded.isError).toBe(false);
      const reloaded = await exportXml();
      expect(weaponSets(reloaded)).toEqual(tags);
      expect(attributeOverride(reloaded)).toEqual(choices);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K35: add_item lists ITEM_SLOTS then Jewel <id>, ascending, for exactly the 19 tree sockets a Lua query finds',
    async () => {
      const ids = await luaQuery<number[]>(TREE_SOCKETS);
      expect(ids).toHaveLength(19);
      const listed = (await f.server.client.listTools()).tools.find((t) => t.name === 'add_item');
      const values = (listed!.inputSchema as { properties: Record<string, { enum?: string[] }> }).properties.slot_name.enum;
      expect(values).toEqual([...WU11_ITEM_SLOTS, ...ids.map((id) => `Jewel ${id}`)]);
      // Each listed socket is a slot PoB's ItemsTab made (`Jewel <id>`).
      const missing = await luaQuery<number[]>(`
        local ids = { ${ids.join(', ')} }
        local missing = {}
        for _, id in ipairs(ids) do if not build.itemsTab.slots['Jewel ' .. id] then missing[#missing + 1] = id end end
        return missing`);
      expect(missing).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K36: add_item of the jewel into an allocated, empty socket adds <Socket nodeId itemId> to the active spec; a new spec\'s <Sockets> lacks it; the ruby ring into a jewel slot is isError with nothing changed',
    async () => {
      // The nearest unallocated socket, allocated through update_tree_delta (the golden build's two
      // allocated sockets hold jewels).
      const s = await luaQuery<number>(`
        local best
        for _, node in pairs(build.latestTree.nodes) do
          if node.type == 'Socket' or node.containJewelSocket then
            local own = build.spec.nodes[node.id]
            if own and not own.alloc and own.pathDist < 1000
                and (not best or own.pathDist < best.pathDist or (own.pathDist == best.pathDist and own.id < best.id)) then
              best = own
            end
          end
        end
        return best.id`);
      const delta = await f.call('update_tree_delta', { add_nodes: [String(s)] });
      expect(delta.isError).toBe(false);
      const state = await luaQuery<{ alloc: boolean; jewel: number }>(
        `return { alloc = build.spec.allocNodes[${s}] ~= nil, jewel = build.spec.jewels[${s}] or 0 }`,
      );
      expect(state).toEqual({ alloc: true, jewel: 0 });
      expect(sockets(await exportXml())[s]).toBeUndefined();

      const added = await f.call('add_item', { item_text: JEWEL, slot_name: `Jewel ${s}` });
      expect({ isError: added.isError, text: added.isError ? added.text : '' }).toEqual({ isError: false, text: '' });
      // PoB names a rare by its name and base ("Rune Glimmer, Ruby").
      expect(added.text).toMatch(new RegExp(`Rune Glimmer[^\\n]* → Jewel ${s}$`, 'm'));
      const xml = await exportXml();
      const itemId = sockets(xml)[s];
      expect(itemId).toBeGreaterThan(0);
      const item = new RegExp(`<Item id="${itemId}"[^>]*>([\\s\\S]*?)</Item>`).exec(xml);
      expect(item?.[1]).toContain('Rune Glimmer');
      expect(item?.[1]).toContain('Ruby');

      // A new spec has its own sockets.
      const created = await f.call('create_spec', { title: 'K36 fresh spec' });
      expect(created.isError).toBe(false);
      const selected = await f.call('select_spec', { index: 2 });
      expect(selected.isError).toBe(false);
      expect(sockets(await exportXml())[s]).toBeUndefined();

      // A non-jewel never goes into a jewel slot.
      await expectRefused('add_item', { item_text: RUBY_RING, slot_name: `Jewel ${s}` }, ['Pandemonium Loop', `Jewel ${s}`]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K37: update_tree_delta allocates a pathDist ≥ 3 notable\'s whole pre-call path and reports Auto-pathed <pathDist − 1>; a pathDist 1 node adds exactly one node with no auto-path',
    async () => {
      const far = await luaQuery<{ id: number; pathDist: number; path: number[] }>(`
        local s = build.spec
        local best
        for id, node in pairs(s.nodes) do
          if not node.alloc and node.type == 'Notable' and not node.ascendancyName and node.path
              and node.pathDist >= 3 and node.pathDist < 1000 and (not best or id < best) then
            best = id
          end
        end
        local path = {}
        for _, p in ipairs(s.nodes[best].path) do path[#path + 1] = p.id end
        return { id = best, pathDist = s.nodes[best].pathDist, path = path }`);
      expect(far.pathDist).toBeGreaterThanOrEqual(3);
      expect(far.path).toContain(far.id);
      expect(far.path).toHaveLength(far.pathDist);

      const before = await allocated();
      const out = await f.call('update_tree_delta', { add_nodes: [String(far.id)] });
      expect(out.isError).toBe(false);
      expect(out.text).toContain(`Auto-pathed ${far.pathDist - 1} intermediate node(s)`);
      expect(await allocated()).toEqual(sorted([...new Set([...before, ...far.path])]));

      const near = await luaQuery<number>(`
        local ids = {}
        for id, node in pairs(build.spec.nodes) do
          if not node.alloc and not node.ascendancyName and node.type ~= 'Mastery' and node.pathDist == 1 then ids[#ids + 1] = id end
        end
        table.sort(ids)
        return ids[1]`);
      const mid = await allocated();
      const one = await f.call('update_tree_delta', { add_nodes: [String(near)] });
      expect(one.isError).toBe(false);
      expect(one.text).not.toContain('Auto-pathed');
      expect(await allocated()).toEqual(sorted([...mid, near]));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K38: on a new Warrior/Titan build, update_tree_delta with the 8 Titan notables in name order allocates the first, fills the budget to exactly 8 Titan nodes (start excluded) and lists every notable left out after BLOCKED:',
    async () => {
      const created = await f.call('lua_new_build', { class_name: 'Warrior', ascendancy: 'Titan' });
      expect(created.isError).toBe(false);
      const notables = await luaQuery<Array<{ id: number; name: string }>>(`
        local rows = {}
        for id, node in pairs(build.spec.nodes) do
          if node.ascendancyName == 'Titan' and node.type == 'Notable' then rows[#rows + 1] = { id = id, name = node.dn } end
        end
        table.sort(rows, function(a, b) return a.name < b.name end)
        return rows`);
      expect(notables).toHaveLength(8);

      const out = await f.call('update_tree_delta', { add_nodes: notables.map((n) => String(n.id)) });
      expect(out.isError).toBe(false);
      const titan = await luaQuery<number[]>(`
        local ids = {}
        for id, node in pairs(build.spec.allocNodes) do
          if node.ascendancyName == 'Titan' and node.type ~= 'AscendClassStart' then ids[#ids + 1] = id end
        end
        table.sort(ids)
        return ids`);
      // The notables cost more than 8 points together, so the budget is filled: exactly 8, never more.
      expect(titan).toHaveLength(8);
      expect(titan).toContain(notables[0].id);

      const leftOut = notables.filter((n) => !titan.includes(n.id)).map((n) => n.id);
      expect(leftOut.length).toBeGreaterThan(0);
      const blocked = /BLOCKED:[^\n]*\(IDs: ([\d, ]+)\)/.exec(out.text);
      expect(blocked).not.toBeNull();
      expect(sorted(blocked![1].split(',').map((s) => Number(s.trim())))).toEqual(sorted(leftOut));
    },
    ENGINE_TIMEOUT,
  );

  // WU-36 review fixes (C-48): existing tags and choices survive an add; one re-import; the cap's count.

  it(
    'C-48: an add whose path runs through a weapon-set branch fails naming the node and the branch, with the export and revision unchanged; an add elsewhere keeps every tag and attribute choice',
    async () => {
      // The reviewer's case: the 8-node path to notable 55, tagged weapon set 1, its 4 attribute nodes
      // set to Intelligence; node 40918 hangs off that branch only.
      const pre = await luaQuery<{ pathDist: number; path: number[]; attributes: number[] }>(`
        local n = build.spec.nodes[55]
        local path, attributes = {}, {}
        for _, p in ipairs(n.path) do
          path[#path + 1] = p.id
          if p.isAttribute then attributes[#attributes + 1] = p.id end
        end
        return { pathDist = n.pathDist, path = path, attributes = attributes }`);
      expect(pre.pathDist).toBe(8);
      expect(pre.attributes).toHaveLength(4);
      const branch = sorted(pre.path);
      expect((await f.call('update_tree_delta', { add_nodes: ['55'] })).isError).toBe(false);
      const tagged = await f.call('set_tree_state', {
        weapon_set_nodes: { '1': branch.map(String) },
        attribute_choices: Object.fromEntries(pre.attributes.map((id) => [String(id), 'intelligence'])),
      });
      expect({ isError: tagged.isError, text: tagged.isError ? tagged.text : '' }).toEqual({ isError: false, text: '' });
      const root = await luaQuery<{ alloc: boolean; pathDist: number; rootMode: number }>(`
        local n = build.spec.nodes[40918]
        return { alloc = n.alloc, pathDist = n.pathDist, rootMode = n.pathRoot and n.pathRoot.allocMode or 0 }`);
      expect(root).toEqual({ alloc: false, pathDist: 1, rootMode: 1 });
      const xml = await exportXml();
      expect(weaponSets(xml)).toEqual({ '1': branch });
      const choices = attributeOverride(xml);
      for (const id of pre.attributes) expect(choices.int).toContain(id);
      const intBefore = (await stats()).Int;

      const text = await expectRefused('update_tree_delta', { add_nodes: ['40918'] }, ['node 40918', 'set_tree_state']);
      // The refusal names the branch nodes the add would untag.
      const named = branch.filter((id) => text.includes(`${id} (`));
      expect(named.length).toBeGreaterThan(0);
      expect((await stats()).Int).toBe(intBefore);

      // An add whose path doesn't touch the branch goes ahead, and every node allocated before it keeps
      // its tag and its attribute choice.
      const before = await allocated();
      const elsewhere = await luaQuery<number>(`
        local ids = {}
        for id, node in pairs(build.spec.nodes) do
          if not node.alloc and not node.ascendancyName and node.type == 'Notable' and node.path and node.pathDist >= 2
              and node.pathDist < 1000 and (node.pathRoot.allocMode or 0) == 0 then
            ids[#ids + 1] = id
          end
        end
        table.sort(ids)
        return ids[1]`);
      const added = await f.call('update_tree_delta', { add_nodes: [String(elsewhere)] });
      expect(added.isError).toBe(false);
      const after = await exportXml();
      expect(weaponSets(after)).toEqual({ '1': branch });
      const kept = attributeOverride(after);
      const wasAllocated = (id: number) => before.includes(id);
      expect({
        str: kept.str.filter(wasAllocated),
        dex: kept.dex.filter(wasAllocated),
        int: kept.int.filter(wasAllocated),
      }).toEqual({
        str: choices.str.filter(wasAllocated),
        dex: choices.dex.filter(wasAllocated),
        int: choices.int.filter(wasAllocated),
      });
      expect((await allocated()).length).toBeGreaterThan(before.length);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'C-48: removing 38570 and adding 17303 on golden equals one re-import of (current − remove + add), 122 nodes',
    async () => {
      // The expectation: PoB's own import of that node list (tags and choices kept) on a throwaway spec.
      const expected = await luaQuery<number[]>(`
        local spec = build.spec
        local nodes, tags = {}, {}
        for id, node in pairs(spec.allocNodes) do
          if id ~= 38570 then nodes[#nodes + 1] = id end
          if node.allocMode and node.allocMode ~= 0 then tags[id] = node.allocMode end
        end
        nodes[#nodes + 1] = 17303
        local s = require('API.Util').construct('PassiveSpec', build, spec.treeVersion)
        s.jewels = copyTable(spec.jewels)
        s:ImportFromNodeList(nil, spec.curClassId, spec.curAscendClassId, spec.curSecondaryAscendClassId or 0, nodes,
          tags, copyTable(spec.hashOverrides, true), {})
        local ids = {}
        for id in pairs(s.allocNodes) do ids[#ids + 1] = id end
        table.sort(ids)
        return ids`);
      expect(expected).toHaveLength(122);
      expect(expected).toContain(17303);
      expect(expected).not.toContain(38570);

      const out = await f.call('update_tree_delta', { remove_nodes: ['38570'], add_nodes: ['17303'] });
      expect(out.isError).toBe(false);
      expect(await allocated()).toEqual(expected);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "C-48: a no-op delta's tree.ascendancyPointsUsed equals PassiveSpec:CountAllocNodes() on golden (6)",
    async () => {
      const counted = await luaQuery<number>(`local _, asc = build.spec:CountAllocNodes() return asc`);
      expect(counted).toBe(6);
      const reply = await run('mutate', (client) => client.updateTreeDelta({ addNodes: [], removeNodes: [] }));
      expect(reply.tree.ascendancyPointsUsed).toBe(counted);
      expect(reply.autoPathedNodes).toEqual([]);
      expect(reply.skippedAscendancyNodes).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );
});

describe('AC-K35: add_item slot enum (static)', () => {
  it('AC-K35: add_item\'s enum is ITEM_SLOTS followed by 19 Jewel <id> slots, ascending; ITEM_SLOTS and the AC-E38 enums are unchanged (D-223)', () => {
    const schemas = getLuaToolSchemas() as Array<{ name: string; inputSchema: { properties: Record<string, { enum?: string[] }> } }>;
    const values = schemas.find((s) => s.name === 'add_item')!.inputSchema.properties.slot_name.enum!;
    expect([...ITEM_SLOTS]).toEqual(WU11_ITEM_SLOTS);
    expect(values.slice(0, WU11_ITEM_SLOTS.length)).toEqual(WU11_ITEM_SLOTS);
    const jewels = values.slice(WU11_ITEM_SLOTS.length);
    expect(jewels).toHaveLength(19);
    for (const slot of jewels) expect(slot).toMatch(/^Jewel \d+$/);
    const ids = jewels.map((slot) => Number(slot.slice('Jewel '.length)));
    expect(ids).toEqual(sorted([...new Set(ids)]));
    // The shared slot enums (create_socket_group, setup_skill_with_gems) gain no jewel slot.
    for (const tool of ['create_socket_group', 'setup_skill_with_gems']) {
      const shared = schemas.find((s) => s.name === tool)!.inputSchema.properties.slot.enum!;
      expect([...shared].sort()).toEqual([...WU11_ITEM_SLOTS].sort());
    }
  });
});
