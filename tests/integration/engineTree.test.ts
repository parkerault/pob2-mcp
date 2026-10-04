/**
 * Engine ops: tree and specs (WU-10) on the golden build: AC-E28, AC-E29, AC-E30, AC-E32, AC-E33 and
 * AC-E34, engine-required and in process.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handlers, session,
 * bridge and luajit) over a private builds folder holding the golden build. Tool outputs are read
 * through MCP; engine replies through the session's bridge client (`session.run`); independent checks
 * are Lua queries (`__test_eval`) and the golden fixture itself.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, beforeEach, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { GOLDEN_XML, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { EngineKind } from '../../src/engine/session';
import type { PoBLuaApiClient } from '../../src/pobLuaBridge';

const ENGINE_TIMEOUT = 240_000;
const REPO = path.resolve(__dirname, '..', '..');

/** One attribute of an XML start tag, wherever it sits among the others. */
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : undefined;
}

/** The `(stat, value)` pairs of every `<PlayerStat>` element, as sorted `stat=value` strings. */
function playerStatPairs(xml: string): string[] {
  return [...xml.matchAll(/<PlayerStat\b[^>]*>/g)].map((m) => `${attr(m[0], 'stat')}=${attr(m[0], 'value')}`).sort();
}

/** A comma-separated id list as a sorted set of numbers. */
const idSet = (list: string | undefined): number[] =>
  [...new Set((list ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number))].sort((a, b) => a - b);

/** The active spec's `<AttributeOverride>` node sets (the golden build has one spec). */
function attributeOverride(xml: string): { str: number[]; dex: number[]; int: number[] } {
  const tags = [...xml.matchAll(/<AttributeOverride\b[^>]*>/g)].map((m) => m[0]);
  expect(tags).toHaveLength(1);
  return { str: idSet(attr(tags[0], 'strNodes')), dex: idSet(attr(tags[0], 'dexNodes')), int: idSet(attr(tags[0], 'intNodes')) };
}

/** `WeaponSet<N> nodes` lists, as `{N: sorted ids}`. */
function weaponSets(xml: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const m of xml.matchAll(/<WeaponSet(\d)\b[^>]*>/g)) out[m[1]] = idSet(attr(m[0], 'nodes'));
  return out;
}

engineDescribe('engine ops: tree and specs on the golden build (WU-10)', () => {
  let f: SessionFixture;

  async function run<T>(kind: EngineKind, fn: (client: PoBLuaApiClient) => Promise<T>): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:engine-tree', kind }, (ctx) => fn(ctx.client));
    return value;
  }

  async function luaQuery<T>(code: string): Promise<T> {
    return run('read', async (client) => (await client.request('__test_eval', { code })).result as T);
  }

  async function stats(fields: string[]): Promise<Record<string, unknown>> {
    return run('read', (client) => client.getStats(fields));
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
    'AC-E28: a no-op update_tree_delta {addNodes:[], removeNodes:[]} leaves Str/Dex/Int 119/91/64, Life 2977 and CombinedDPS 104489.78',
    async () => {
      const fields = ['Str', 'Dex', 'Int', 'Life', 'CombinedDPS'];
      const check = (s: Record<string, unknown>) => {
        expect([s.Str, s.Dex, s.Int]).toEqual([119, 91, 64]);
        expect(s.Life).toBe(2977);
        expect(Math.abs(Number(s.CombinedDPS) - 104489.78)).toBeLessThanOrEqual(0.01);
      };
      check(await stats(fields));

      const tree = await run('mutate', (client) => client.updateTreeDelta({ addNodes: [], removeNodes: [] }));
      expect(tree.tree.nodes.length).toBeGreaterThan(0);

      check(await stats(fields));
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-E29: feeding lua_get_tree's nodes back through lua_set_tree keeps all 109 PlayerStat pairs (after save), the AttributeOverride sets and the WeaponSet node lists",
    async () => {
      const nodesOf = (text: string): string[] => {
        const m = /Node IDs: ([\d, ]+)/.exec(text);
        expect(m).not.toBeNull();
        return m![1].split(',').map((s) => s.trim()).filter(Boolean);
      };

      // (a) The golden build: get_tree → set_tree → save, compared with the golden file.
      const tree = await f.call('lua_get_tree', { include_node_ids: true });
      expect(tree.isError).toBe(false);
      const set = await f.call('lua_set_tree', { nodes: nodesOf(tree.text) });
      expect(set.isError).toBe(false);
      const saved = await f.call('lua_save_build', { build_name: 'e29-roundtrip' });
      expect(saved.isError).toBe(false);
      const savedXml = fs.readFileSync(path.join(f.builds, 'e29-roundtrip.xml'), 'utf8');

      const goldenPairs = playerStatPairs(GOLDEN_XML);
      expect(goldenPairs).toHaveLength(109);
      expect(playerStatPairs(savedXml)).toEqual(goldenPairs);
      expect(attributeOverride(savedXml)).toEqual(attributeOverride(GOLDEN_XML));
      expect(attributeOverride(GOLDEN_XML).str.length).toBeGreaterThan(0);
      expect(weaponSets(savedXml)).toEqual(weaponSets(GOLDEN_XML));

      // (b) With weapon-set assignments: put three allocated travel nodes on weapon sets 1 and 2 (PoB
      // keeps them in node.allocMode and saves them as <WeaponSet1/2 nodes>), then round-trip again.
      const assigned = await luaQuery<number[]>(`
        local ids = {}
        for id, node in pairs(build.spec.allocNodes) do
          if node.type == 'Normal' and not node.isAttribute and not node.ascendancyName then ids[#ids + 1] = id end
        end
        table.sort(ids)
        local pick = { ids[1], ids[2], ids[3] }
        build.spec.nodes[pick[1]].allocMode = 1
        build.spec.nodes[pick[2]].allocMode = 1
        build.spec.nodes[pick[3]].allocMode = 2
        return pick`);
      expect(assigned).toHaveLength(3);
      const before = await run('read', (client) => client.exportBuildXml());
      const expectedSets = weaponSets(before);
      expect(expectedSets).toEqual({
        '1': [assigned[0], assigned[1]].sort((a, b) => a - b),
        '2': [assigned[2]],
      });

      const tree2 = await f.call('lua_get_tree', { include_node_ids: true });
      const set2 = await f.call('lua_set_tree', { nodes: nodesOf(tree2.text) });
      expect(set2.isError).toBe(false);
      const after = await run('read', (client) => client.exportBuildXml());
      expect(weaponSets(after)).toEqual(expectedSets);
      expect(attributeOverride(after)).toEqual(attributeOverride(GOLDEN_XML));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E30: lua_get_tree, lua_get_build_info and export_build_summary show Mercenary / Gemling Legionnaire, never "Unknown (ID", and lua_get_tree has no mastery line',
    async () => {
      const outputs = {
        lua_get_tree: await f.call('lua_get_tree'),
        lua_get_build_info: await f.call('lua_get_build_info'),
        export_build_summary: await f.call('export_build_summary'),
      };
      for (const [tool, out] of Object.entries(outputs)) {
        expect([tool, out.isError]).toEqual([tool, false]);
        expect(out.text).toContain('Mercenary');
        expect(out.text).toContain('Gemling Legionnaire');
        expect(out.text).not.toContain('Unknown (ID');
      }
      expect(outputs.lua_get_tree.text).toMatch(/^Class: Mercenary \(ID: 9\)$/m);
      expect(outputs.lua_get_tree.text).toMatch(/^Ascendancy: Gemling Legionnaire \(ID: \d+\)$/m);
      expect(outputs.lua_get_tree.text).not.toMatch(/mastery/i);
      expect(outputs.lua_get_build_info.text).toMatch(/^Class: Mercenary$/m);
      expect(outputs.lua_get_build_info.text).toMatch(/^Ascendancy: Gemling Legionnaire$/m);
      expect(outputs.export_build_summary.text).toContain('**Class:** Mercenary (Gemling Legionnaire)');

      // The engine's own names, cross-checked with a Lua query of the active spec.
      const names = await luaQuery<{ cls: string; asc: string }>(
        'return { cls = build.spec.curClassName, asc = build.spec.curAscendClassName }',
      );
      expect(names).toEqual({ cls: 'Mercenary', asc: 'Gemling Legionnaire' });

      // `rg -n "masteryEffects" src/ pob-api/` finds only the documented ImportFromNodeList positional
      // argument in BuildOps.lua.
      const hits: string[] = [];
      const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else
            fs.readFileSync(p, 'utf8')
              .split('\n')
              .forEach((line, i) => {
                if (line.includes('masteryEffects')) hits.push(`${path.relative(REPO, p)}:${i + 1}:${line.trim()}`);
              });
        }
      };
      walk(path.join(REPO, 'src'));
      walk(path.join(REPO, 'pob-api'));
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatch(
        /^pob-api\/API\/BuildOps\.lua:\d+:-- +hashList, weaponSets, hashOverrides, masteryEffects, treeVersion\)$/,
      );
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E32: get_passive_upgrades returns a suggestion with an integer path cost >= 1 (PoB node.pathDist) and a non-zero delta for the requested stat, and the engine is still alive',
    async () => {
      const out = await f.call('get_passive_upgrades', { focus: 'dps', max_results: 5 });
      expect(out.isError).toBe(false);
      expect(out.text).not.toMatch(/undefined|NaN/);

      const suggestions = [
        ...out.text.matchAll(/^\d+\. \*\*(.+)\*\* \[(\d+)\]\n {3}Path cost: (\d+) points?.*\n {3}(.*)$/gm),
      ].map((m) => ({ name: m[1], id: Number(m[2]), cost: Number(m[3]), deltas: m[4] }));
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      const first = suggestions[0];
      expect(Number.isInteger(first.cost)).toBe(true);
      expect(first.cost).toBeGreaterThanOrEqual(1);
      const dps = /DPS Δ: ([+-]?[\d,]+)/.exec(first.deltas);
      expect(dps).not.toBeNull();
      const shownDelta = Number(dps![1].replace(/,/g, ''));
      expect(shownDelta).not.toBe(0);

      // The cost is PoB's own pathing, and the delta is PoB's calculator with that whole path allocated.
      const pob = await luaQuery<{ dist: number; path: number[] }>(`
        local node = build.spec.nodes[${first.id}]
        local ids = {}
        for _, n in ipairs(node.path) do ids[#ids + 1] = n.id end
        return { dist = node.pathDist, path = ids }`);
      expect(first.cost).toBe(pob.dist);
      expect(pob.path).toContain(first.id);
      const delta = await run('read', async (client) => {
        const base = await client.calcWith({ fields: ['CombinedDPS'] });
        const added = await client.calcWith({ addNodes: pob.path, fields: ['CombinedDPS'] });
        return Number(added.CombinedDPS) - Number(base.CombinedDPS);
      });
      expect(Math.round(delta)).toBe(shownDelta);

      const pong = await run('read', (client) => client.request('ping'));
      expect(pong.pong).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E33: get_nearby_nodes and find_path_to_node name the build instead of "Build: undefined"',
    async () => {
      const nearby = await f.call('get_nearby_nodes', { max_distance: 2 });
      const pathOut = await f.call('find_path_to_node', { target_node_id: '29514' });
      for (const out of [nearby, pathOut]) {
        expect(out.isError).toBe(false);
        expect(out.text).not.toContain('Build: undefined');
        expect(out.text).toContain('Build: grenadator (grenadator.xml)');
      }

      const fromFile = await f.call('get_nearby_nodes', { build_name: 'grenadator.xml', max_distance: 2 });
      expect(fromFile.isError).toBe(false);
      expect(fromFile.text).toContain('Build: grenadator.xml');
      expect(fromFile.text).not.toContain('Build: undefined');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E34: create_spec {title:"t"} succeeds on the pinned tag and list_specs shows 2 specs; plan_leveling {class_name:"Monk"} names Monk, not Mercenary',
    async () => {
      const created = await f.call('create_spec', { title: 't' });
      expect(created.isError).toBe(false);
      expect(created.text).toContain('✅ Created new spec [2] t');
      const specs = await f.call('list_specs');
      expect(specs.isError).toBe(false);
      expect(specs.text).toContain('Passive Tree Specs (2 total)');
      expect((await run('read', (client) => client.listSpecs())).specs).toHaveLength(2);

      // create_spec constructs its PassiveSpec through the version-portable construct() (C-6).
      const buildOps = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'BuildOps.lua'), 'utf8');
      const createSpec = buildOps.slice(buildOps.indexOf('function M.create_spec'), buildOps.indexOf('function M.select_spec'));
      expect(createSpec).toContain("construct('PassiveSpec'");
      expect(createSpec).not.toMatch(/\bnew\(/);

      const plan = await f.call('plan_leveling', { class_name: 'Monk' });
      expect(plan.isError).toBe(false);
      expect(plan.text).toContain('Monk');
      expect(plan.text).not.toContain('Mercenary');
      expect(plan.text).not.toContain('Gemling Legionnaire');
    },
    ENGINE_TIMEOUT,
  );
});
