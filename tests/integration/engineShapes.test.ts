/**
 * Engine data shapes on the golden build (WU-09): AC-E25, AC-E26, AC-E27 and AC-E31, engine-required.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handlers, session,
 * bridge and luajit) over a private builds folder holding the golden build. Tool outputs are read
 * through MCP; engine replies through the session's bridge client (`session.run`, a `read` call), and
 * independent checks are Lua queries (`__test_eval`).
 */
import { afterAll, beforeAll, beforeEach, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { ItemSlot } from '../../src/engine/schemas';
import type { PoBLuaApiClient } from '../../src/pobLuaBridge';

const ENGINE_TIMEOUT = 240_000;

/** The 18 stats `get_stats` exported by default before E7. */
const ORIGINAL_DEFAULTS = [
  'Life', 'EnergyShield', 'Mana', 'Spirit', 'Ward', 'Armour', 'Evasion',
  'FireResist', 'ColdResist', 'LightningResist', 'ChaosResist', 'BlockChance', 'SpellBlockChance',
  'LifeRegen', 'ManaRegen', 'TotalDPS', 'FullDPS', 'CombinedDPS',
];
/** The stats AC-E26 adds to the default export (E7). */
const WIDENED = [
  'TotalEHP', 'PhysicalDamageReduction', 'LifeUnreserved', 'ManaUnreserved', 'SpiritUnreserved',
  'EvadeChance', 'DeflectChance', 'EffectiveBlockChance', 'EnergyShieldRecharge',
  ...['Fire', 'Cold', 'Lightning', 'Chaos'].map((e) => `Missing${e}Resist`),
  ...['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'].map((t) => `${t}MaximumHitTaken`),
  ...['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'].map((t) => `${t}EnemyDamage`),
  'totalEnemyDamage',
  'Str', 'Dex', 'Int',
];

/** A rare body armour with two jewel sockets (`Sockets: J J`, Item.lua jewelSocketCount). */
const SOCKETED_ARMOUR = ['Rarity: Rare', 'Socket Test', 'Iron Cuirass', 'Sockets: J J'].join('\n');

/** Gear slots that carry jewel sockets (`<parent> Jewel Socket N`, ItemsTab.lua). */
const SOCKET_PARENTS = [
  'Weapon 1', 'Weapon 1 Swap', 'Weapon 2', 'Weapon 2 Swap', 'Helmet', 'Gloves', 'Body Armour', 'Boots',
  'Belt', 'Ring 1', 'Ring 2', 'Ring 3',
];

/** Lua: each socket parent's equipped item's jewelSocketCount, the allocated nodes, the allocated socket nodes. */
const SOCKET_FACTS = `
local out = { counts = {}, alloc = {}, allocSockets = {} }
for _, name in ipairs(${JSON.stringify(SOCKET_PARENTS).replace('[', '{').replace(/]$/, '}')}) do
  local slot = build.itemsTab.slots[name]
  local item = slot and slot.selItemId and build.itemsTab.items[slot.selItemId]
  out.counts[name] = item and item.jewelSocketCount or 0
end
for id, node in pairs(build.spec.allocNodes) do
  out.alloc[#out.alloc + 1] = id
  if build.itemsTab.sockets[id] then out.allocSockets[#out.allocSockets + 1] = id end
end
return out`;

engineDescribe('engine data shapes on the golden build (WU-09)', () => {
  let f: SessionFixture;

  /** A `read` engine call through the session; returns fn's value. */
  async function read<T>(fn: (client: PoBLuaApiClient) => Promise<T>): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:engine-shapes', kind: 'read' }, (ctx) => fn(ctx.client));
    return value;
  }

  async function luaQuery<T>(code: string): Promise<T> {
    return read(async (client) => (await client.request('__test_eval', { code })).result as T);
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

  it(
    'AC-E25: list_specs shows numeric points per spec; create_spec, rename_spec and delete_spec report success; list_item_sets marks the active set; lua_save_build reports (<n> bytes); lua_get_stats has no _meta object and shows the active spec tree version',
    async () => {
      const pointsOf = (text: string) => [...text.matchAll(/Points: (\S+)/g)].map((m) => m[1]);

      const before = await f.call('list_specs');
      expect(before.isError).toBe(false);
      expect(before.text).not.toContain('undefined');
      expect(pointsOf(before.text)).toHaveLength(1);
      for (const p of pointsOf(before.text)) expect(p).toMatch(/^\d+$/);
      const engineSpecs = await read((c) => c.listSpecs());
      expect(pointsOf(before.text).map(Number)).toEqual(engineSpecs.specs.map((s) => s.pointsUsed));
      expect(engineSpecs.specs[0].pointsUsed).toBeGreaterThan(0);

      const created = await f.call('create_spec', { title: 'Second tree', copyFrom: 1 });
      expect(created.isError).toBe(false);
      expect(created.text).toContain('✅ Created new spec [2] Second tree');
      expect(created.text).not.toContain('undefined');
      const afterCreate = await f.call('list_specs');
      expect(afterCreate.text).toContain('[2] Second tree');
      expect(pointsOf(afterCreate.text)).toHaveLength(2);
      for (const p of pointsOf(afterCreate.text)) expect(p).toMatch(/^\d+$/);

      const renamed = await f.call('rename_spec', { index: 2, title: 'Renamed tree' });
      expect(renamed.isError).toBe(false);
      expect(renamed.text).toContain('✅ Spec 2 renamed to "Renamed tree"');
      expect((await f.call('list_specs')).text).toContain('[2] Renamed tree');

      const deleted = await f.call('delete_spec', { index: 2 });
      expect(deleted.isError).toBe(false);
      expect(deleted.text).toContain('✅ Deleted spec 2. 1 spec(s) remaining.');
      expect((await read((c) => c.listSpecs())).specs).toHaveLength(1);

      const sets = await f.call('list_item_sets');
      expect(sets.isError).toBe(false);
      expect(sets.text).not.toContain('undefined');
      const engineSets = await read((c) => c.listItemSets());
      for (const s of engineSets.itemSets) {
        expect(sets.text).toContain(`[${s.id}] ${s.title}${s.active ? ' (active)' : ''}`);
      }
      expect(sets.text).toContain(`Active: Item Set ${engineSets.activeItemSet}.`);

      const saved = await f.call('lua_save_build', { build_name: 'shapes-saved' });
      expect(saved.isError).toBe(false);
      const bytes = /\((\d+) bytes\)/.exec(saved.text);
      expect(bytes).not.toBeNull();
      expect(Number(bytes![1])).toBeGreaterThan(0);

      const stats = await f.call('lua_get_stats');
      expect(stats.isError).toBe(false);
      expect(stats.text).not.toContain('_meta');
      expect(stats.text).not.toContain('[object Object]');
      const activeTreeVersion = (await read((c) => c.listSpecs())).specs.find((s) => s.active)!.treeVersion;
      expect(stats.text).toContain(`Tree Version: ${activeTreeVersion}`);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E26: get_stats with no fields returns numeric values for the 18 old defaults and every widened stat; TotalEHP = 11833.37 ± 0.01',
    async () => {
      const reply = await read((c) => c.request('get_stats'));
      const stats = reply.stats as Record<string, unknown>;
      const nonNumeric = [...ORIGINAL_DEFAULTS, ...WIDENED].filter((k) => typeof stats[k] !== 'number');
      expect(nonNumeric).toEqual([]);
      expect(Math.abs((stats.TotalEHP as number) - 11833.37)).toBeLessThanOrEqual(0.01);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E27: every get_items entry has boolean inactive and shown; shown gear jewel sockets are within the item socket count and shown tree sockets are allocated (Lua cross-check); get_equipped_items lists no hidden slot and no "89"',
    async () => {
      const items = (await read((c) => c.request('get_items'))).items as ItemSlot[];
      expect(items.length).toBeGreaterThan(100);
      for (const entry of items) {
        expect(typeof entry.inactive).toBe('boolean');
        expect(typeof entry.shown).toBe('boolean');
      }

      const facts = await luaQuery<{ counts: Record<string, number>; alloc: number[]; allocSockets: number[] }>(SOCKET_FACTS);
      const allocated = new Set(facts.alloc);
      const visible = items.filter((e) => !e.inactive && e.shown);
      const hidden = items.filter((e) => e.inactive || !e.shown);
      expect(hidden.length).toBeGreaterThan(0);

      for (const entry of visible) {
        const gear = /^(.+) Jewel Socket (\d+)$/.exec(entry.slot);
        if (gear) expect(Number(gear[2])).toBeLessThanOrEqual(facts.counts[gear[1]] ?? 0);
        const tree = /^Jewel (\d+)$/.exec(entry.slot);
        if (tree) expect(allocated.has(Number(tree[1]))).toBe(true);
      }
      // And the other way round: a shown parent slot shows exactly min(jewelSocketCount, 6) of its six
      // gear sockets, and every allocated tree socket is shown while every unallocated one is hidden.
      for (const parent of SOCKET_PARENTS) {
        const parentEntry = items.find((e) => e.slot === parent);
        if (!parentEntry || parentEntry.inactive || !parentEntry.shown) continue;
        const shownSockets = visible.filter((e) => e.slot.startsWith(`${parent} Jewel Socket `)).length;
        expect({ parent, shownSockets }).toEqual({ parent, shownSockets: Math.min(facts.counts[parent] ?? 0, 6) });
      }
      const visibleTreeSockets = visible.map((e) => /^Jewel (\d+)$/.exec(e.slot)).filter(Boolean).map((m) => Number(m![1]));
      expect(visibleTreeSockets.sort((a, b) => a - b)).toEqual([...facts.allocSockets].sort((a, b) => a - b));
      expect(facts.allocSockets.length).toBeGreaterThan(0);

      const equipped = await f.call('get_equipped_items');
      expect(equipped.isError).toBe(false);
      for (const entry of hidden) expect(equipped.text).not.toContain(`**${entry.slot}**`);
      // The golden build keeps an item in the hidden swap weapon slot.
      expect(hidden.some((e) => e.slot === 'Weapon 1 Swap' && e.id > 0)).toBe(true);
      expect(equipped.text).not.toContain('89');
      expect(equipped.text).toContain('**Body Armour**');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E25/AC-E26: lua_get_stats default view shows every non-zero default stat once (plus EvadeChance/DeflectChance at 0), defensive outputs (EnemyDamage, MaximumHitTaken, DamageReduction, TotalEHP) under Defense only, nothing truncated',
    async () => {
      const reply = await read((c) => c.request('get_stats'));
      const stats = reply.stats as Record<string, unknown>;
      const nonZero = Object.entries(stats)
        .filter(([k, v]) => k !== '_meta' && v != null && v !== 0 && v !== '0')
        .map(([k]) => k);
      expect(nonZero).toContain('TotalEHP');

      const view = await f.call('lua_get_stats');
      expect(view.isError).toBe(false);
      expect(view.text).not.toContain("use category=");
      // Parse "**Heading:**" sections into their stat keys.
      const sections: Record<string, string[]> = {};
      let current = '';
      for (const line of view.text.split('\n')) {
        const heading = /^\*\*(\w+):\*\*$/.exec(line);
        if (heading) { current = heading[1]; sections[current] = []; continue; }
        const stat = /^(\w+): /.exec(line);
        if (stat && current) sections[current].push(stat[1]);
      }
      const listed = Object.values(sections).flat();
      // Every non-zero default stat appears exactly once, plus the avoidance chances that are listed even
      // at 0 (AC-E41, WU-11).
      const alwaysShown = ['EvadeChance', 'DeflectChance'].filter((k) => stats[k] != null && !nonZero.includes(k));
      expect([...listed].sort()).toEqual([...nonZero, ...alwaysShown].sort());

      const defensive = (k: string) => /EnemyDamage$|MaximumHitTaken$|DamageReduction$|EHP$/.test(k);
      expect((sections.Offense ?? []).filter(defensive)).toEqual([]);
      expect(sections.Defense).toContain('TotalEHP');
      for (const k of nonZero.filter(defensive)) expect(sections.Defense).toContain(k);
      expect(sections.Offense).toEqual(expect.arrayContaining(nonZero.filter((k) => /DPS$/.test(k))));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E27: a jewel-socketed body armour auto-equipped by add_item (no slot name) shows its sockets as active and shown in get_items, the rest hidden',
    async () => {
      expect((await f.call('lua_new_build')).isError).toBe(false);
      const added = await f.call('add_item', { item_text: SOCKETED_ARMOUR });
      expect(added.isError).toBe(false);
      expect(added.text).toContain('Body Armour');

      const items = (await read((c) => c.request('get_items'))).items as ItemSlot[];
      const sockets = items.filter((e) => e.slot.startsWith('Body Armour Jewel Socket '));
      expect(sockets.length).toBeGreaterThanOrEqual(3);
      for (const s of sockets) {
        const n = Number(/(\d+)$/.exec(s.slot)![1]);
        expect({ slot: s.slot, inactive: s.inactive, shown: s.shown }).toEqual(
          { slot: s.slot, inactive: n > 2, shown: n <= 2 },
        );
      }
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E27: get_items refreshes gear socket flags itself, even after an engine-side auto-equip that skipped PopulateSlots',
    async () => {
      expect((await f.call('lua_new_build')).isError).toBe(false);
      // ItemsTab:AddItem auto-equips without ItemSlotControl:Populate, so the socket flags are stale.
      const stale = await luaQuery<{ slot: string; inactive: boolean }>(`
local item = new('Item', ${JSON.stringify(SOCKETED_ARMOUR)})
build.itemsTab:AddItem(item, false)
local slot = build.itemsTab.slots['Body Armour']
return { slot = tostring(slot.selItemId == item.id), inactive = slot.jewelSocketList[1].inactive == true }`);
      expect(stale).toEqual({ slot: 'true', inactive: true });

      const items = (await read((c) => c.request('get_items'))).items as ItemSlot[];
      const flags = (n: number) => {
        const e = items.find((x) => x.slot === `Body Armour Jewel Socket ${n}`)!;
        return { inactive: e.inactive, shown: e.shown };
      };
      expect(flags(1)).toEqual({ inactive: false, shown: true });
      expect(flags(2)).toEqual({ inactive: false, shown: true });
      expect(flags(3)).toEqual({ inactive: true, shown: false });
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E31: lua_get_build_info reports the tree version get_tree reports (the active spec), not "0_1"',
    async () => {
      const tree = await read((c) => c.getTree());
      expect(tree.treeVersion).not.toBe('0_1');
      const info = await f.call('lua_get_build_info');
      expect(info.isError).toBe(false);
      const shown = /Tree Version: (\S+)/.exec(info.text);
      expect(shown?.[1]).toBe(tree.treeVersion);
      expect(info.text).not.toContain('Tree Version: 0_1');
      const lua = await luaQuery<string>('return build.spec.treeVersion');
      expect(tree.treeVersion).toBe(lua);
    },
    ENGINE_TIMEOUT,
  );
});
