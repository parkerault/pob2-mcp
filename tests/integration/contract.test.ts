/**
 * TS↔Lua reply contract (C-5): AC-E24, engine-required.
 *
 * - **Static check:** the non-test action names registered in `pob-api/API/Handlers.lua` and in every
 *   module it merges by `require('API.<Module>').handlers` (`Trade.lua`, `Lookup.lua`, `Coverage.lua`, `Sets.lua`, …; parsed from
 *   the source) equal `Object.keys(replySchemas)` and `ACTION_NAMES`.
 * - **Coverage:** every parsed action has a case below.
 * - **Each case** loads the golden build, establishes its precondition (a second spec before
 *   `delete_spec`, a socket group before `add_gem`, …), calls the action, and asserts that
 *   `replySchemas[action].safeParse(reply)` succeeds.
 *
 * Replies are read raw through the line client (`tests/helpers/luaLineClient.ts`), so the schemas are
 * checked against exactly what the Lua side sends, not against a value the bridge already parsed.
 * A unit that adds a Lua action adds its schema and its case here in the same merge (C-5).
 *
 * AC-K46 (WU-32, contract part): `check_coverage` without `sourceNames` replies `ok:false`, and with
 * `sourceNames: []` it rates `+30 to maximum Life` `possibly unread`, so Lua uses the names it is passed.
 *
 * AC-K38 (WU-36, contract part): on a new Warrior/Titan build, `update_tree_delta` with the 8 Titan notables
 * replies with `autoPathedNodes`, `skippedAscendancyNodes` and `tree.ascendancyPointsUsed` (C-48), the last
 * equal to a Lua count of the allocated Titan nodes (the start node excluded). That case runs on its own
 * engine with test actions on, for the Lua query.
 *
 * WU-35 (C-39, AC-B4): `manage_sets` replies match their schema for every set type, a list and a changing
 * action of each; AC-K30's contract case: `set_level {level, autoMode:true}` matches its schema and the
 * export says `characterLevelAutoMode="true"`, without the flag `"false"`, and a non-boolean flag fails.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type Json, type LuaLineClient } from '../helpers/luaLineClient';
import { ACTION_NAMES, replySchemas, type ActionName } from '../../src/engine/schemas';
import { pobSourceNames, pobSourceScan } from '../../src/engine/pobSourceNames';
import { resolvePobSrc } from '../../src/engine/pobPath';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const GOLDEN = fs.readFileSync(path.join(FIXTURES, 'builds', 'grenadator.xml'), 'utf8');
const RUBY_RING = fs.readFileSync(path.join(FIXTURES, 'items', 'ruby-ring.txt'), 'utf8');
const COVERAGE_AMULET = fs.readFileSync(path.join(FIXTURES, 'items', 'coverage-amulet.txt'), 'utf8');
/** Two committed trade2 `/fetch` entries, verbatim (no network). */
const FETCHED = (
  JSON.parse(fs.readFileSync(path.join(FIXTURES, 'trade2', 'fetch-weighted-session.response.json'), 'utf8')) as {
    result: Json[];
  }
).result.slice(0, 2);

const ENGINE_TIMEOUT = 240_000;

/** The modules `Handlers.lua` merges, one line each: `for name, fn in pairs(require('API.<M>').handlers) …`. */
function mergedModules(handlers: string): string[] {
  return [...handlers.matchAll(/^\s*for\s+name,\s*fn\s+in\s+pairs\(require\('API\.([A-Za-z]+)'\)\.handlers\)/gm)].map((m) => m[1]);
}

/**
 * Non-test action names from `Handlers.lua` (`handlers.<name> = …`) and from each module it merges
 * (`M.handlers = {…}`).
 */
function luaActionNames(): string[] {
  const handlers = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'Handlers.lua'), 'utf8');
  const names = new Set<string>();
  for (const m of handlers.matchAll(/^\s*handlers\.([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) names.add(m[1]);
  for (const mod of mergedModules(handlers)) {
    const source = fs.readFileSync(path.join(REPO, 'pob-api', 'API', `${mod}.lua`), 'utf8');
    const table = /M\.handlers\s*=\s*\{([\s\S]*?)\n\}/.exec(source);
    if (!table) throw new Error(`${mod}.lua: no M.handlers table`);
    for (const m of table[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) names.add(m[1]);
  }
  return [...names].filter((n) => !n.startsWith('__test_')).sort();
}

/** One step's raw reply; a precondition step must succeed. */
type Call = (action: string, params?: Json) => Promise<Json>;

interface Case {
  /** Establish the precondition and return the params for the action under test. */
  setup?: (call: Call) => Promise<Json>;
  params?: Json;
}

/** A socket group with one known gem, appended to the golden build's groups. */
async function groupWithGem(call: Call): Promise<{ groupIndex: number; gemIndex: number }> {
  const group = await call('create_socket_group', { label: 'contract' });
  const gem = await call('add_gem', { groupIndex: group.socketGroup.index, gemName: 'Fireball' });
  return { groupIndex: group.socketGroup.index as number, gemIndex: gem.gem.gemIndex as number };
}

const CASES: Record<ActionName, Case> = {
  ping: {},
  version: {},
  new_build: { params: { className: 'Monk', ascendancy: 'Invoker' } },
  load_build_xml: { params: { xml: GOLDEN, name: 'Grenadator (again)' } },
  get_stats: {},
  get_items: {},
  get_skills: {},
  get_tree: {},
  set_main_selection: { params: { mainSocketGroup: 1, mainActiveSkill: 1 } },
  set_tree: {
    setup: async (call) => {
      const { tree } = await call('get_tree');
      return { classId: tree.classId, ascendClassId: tree.ascendClassId, nodes: tree.nodes, treeVersion: tree.treeVersion };
    },
  },
  add_item_text: { params: { text: RUBY_RING, noAutoEquip: true } },
  export_build_xml: {},
  set_level: { params: { level: 80 } },
  set_flask_active: { params: { slot: 'Charm 1', active: true } },
  get_build_info: {},
  get_warnings: {},
  update_tree_delta: { params: { addNodes: [], removeNodes: [] } },
  calc_with: {},
  get_config: {},
  set_config: { params: { enemyIsBoss: 'Pinnacle' } },
  create_socket_group: { params: { label: 'contract' } },
  add_gem: {
    setup: async (call) => {
      const group = await call('create_socket_group', { label: 'contract' });
      return { groupIndex: group.socketGroup.index, gemName: 'Fireball' };
    },
  },
  set_gem_level: { setup: async (call) => ({ ...(await groupWithGem(call)), level: 10 }) },
  set_gem_quality: { setup: async (call) => ({ ...(await groupWithGem(call)), quality: 10 }) },
  set_gem_corruption: { setup: async (call) => ({ ...(await groupWithGem(call)), state: 'plus_one_level' }) },
  remove_skill: {
    setup: async (call) => {
      const group = await call('create_socket_group', { label: 'contract' });
      return { groupIndex: group.socketGroup.index };
    },
  },
  remove_gem: { setup: async (call) => groupWithGem(call) },
  search_nodes: { params: { keyword: 'life', maxResults: 5 } },
  list_gems: { params: { search: 'fire', maxResults: 5 } },
  get_classes: {},
  // The golden build's main socket group (11), measured, so `value`/`delta`/`measured` are checked too.
  list_support_candidates: { params: { groupIndex: 11, measure: true } },
  set_socket_group_enabled: { params: { groupIndex: 1, enabled: true } },
  set_gem_enabled: { setup: async (call) => ({ ...(await groupWithGem(call)), enabled: false }) },
  create_spec: { params: { title: 'contract' } },
  list_specs: {},
  select_spec: {
    setup: async (call) => {
      const created = await call('create_spec', { title: 'contract' });
      return { index: created.result.index };
    },
  },
  delete_spec: {
    setup: async (call) => {
      const created = await call('create_spec', { title: 'contract' });
      return { index: created.result.index };
    },
  },
  rename_spec: { params: { index: 1, title: 'contract' } },
  list_item_sets: {},
  select_item_set: { params: { id: 1 } },
  trade_generate_query: { params: { slot: 'Body Armour' } },
  trade_evaluate_items: { params: { slot: 'Body Armour', items: FETCHED } },
  trade_query_options: { params: { slot: 'Body Armour' } },
  // C-39 (WU-35): the slice sample, a skill set create (its reply carries `mainGroup` and `mainSocketGroup`).
  manage_sets: { params: { setType: 'skill', action: 'create', title: 'Contract {2}' } },
  // C-37 (WU-31): gem mode carries every reply field a gem has (stat sets, quality lines, requirements).
  lookup_game_data: { params: { mode: 'gem', query: 'Blood Hunt', level: 20, quality: 0 } },
  // C-38 (WU-32): an item with every line status, a joined node line and a gem with unmodelled lines, so
  // `remainder`, `unread`, `joinedWith`, `nodeId` and `stat` are all in the reply; the real scan (D-243).
  check_coverage: {
    setup: async () => {
      const scan = await pobSourceScan(resolvePobSrc(process.env));
      return {
        itemText: COVERAGE_AMULET,
        nodes: ['38570'],
        gems: ['Blood Hunt'],
        sourceNames: [...scan.names],
        sourceTemplates: scan.templates,
      };
    },
  },
};

/** A golden attribute node set to Strength (the first of its `<AttributeOverride strNodes>`). */
const GOLDEN_STR_NODE = (/<AttributeOverride\b[^>]*\sstrNodes="(\d+)/.exec(GOLDEN) as RegExpExecArray)[1];

/** The golden socket group whose active skill is Gas Grenade (stat sets Impact, Poison Cloud, Explosion). */
async function gasGrenadeGroup(call: Call): Promise<number> {
  const { skills } = await call('get_skills');
  const group = (skills.groups as Array<{ index: number; skills: string[] }>).find((g) => g.skills.includes('Gas Grenade'));
  if (!group) throw new Error('the golden build has no Gas Grenade group');
  return group.index;
}

/**
 * The new request params of changed actions (AC-B4, slice 01 §2.1): each variant's reply must match the
 * action's schema and carry the reply field that param adds.
 */
interface Variant extends Case {
  name: string;
  action: ActionName;
  /** The reply field the new param adds. */
  adds: string;
}
const VARIANTS: Variant[] = [
  {
    name: 'get_stats with breakdown of the Gas Grenade group (C-45)',
    action: 'get_stats',
    adds: 'breakdown',
    setup: async (call) => ({ fields: [], breakdown: { groupIndex: await gasGrenadeGroup(call), fields: ['TotalDPS', 'CombinedDPS', 'Speed'] } }),
  },
  {
    name: 'get_stats with breakdown of the main group, and the default stats (C-45)',
    action: 'get_stats',
    adds: 'breakdown',
    params: { breakdown: { fields: ['TotalDPS'] } },
  },
  {
    name: 'set_main_selection with statSet (C-44)',
    action: 'set_main_selection',
    adds: 'statSet',
    setup: async (call) => ({ mainSocketGroup: await gasGrenadeGroup(call), statSet: 3 }),
  },
  {
    // The reply is unchanged (C-40): the params replace the tags and set one attribute choice.
    name: 'set_tree with weaponSets and attributeChoices (C-40)',
    action: 'set_tree',
    adds: 'tree',
    setup: async (call) => {
      const { tree } = await call('get_tree');
      return {
        classId: tree.classId,
        ascendClassId: tree.ascendClassId,
        nodes: tree.nodes,
        treeVersion: tree.treeVersion,
        weaponSets: {},
        attributeChoices: { [GOLDEN_STR_NODE]: 'intelligence' },
      };
    },
  },
];

describe('AC-E24: every Lua action has a reply schema (static)', () => {
  it('AC-E24: Handlers.lua merges the Trade, Lookup, Coverage and Sets modules (AC-B4)', () => {
    const handlers = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'Handlers.lua'), 'utf8');
    expect(mergedModules(handlers)).toEqual(expect.arrayContaining(['Trade', 'Lookup', 'Coverage', 'Sets']));
  });

  it('AC-E24: the non-test Lua actions of Handlers.lua and its merged modules equal Object.keys(replySchemas) and ACTION_NAMES', () => {
    const lua = luaActionNames();
    expect(lua.length).toBeGreaterThan(30);
    expect(Object.keys(replySchemas).sort()).toEqual(lua);
    expect([...ACTION_NAMES].sort()).toEqual(lua);
  });

  it('AC-E24: the contract test has a case for every Lua action', () => {
    expect(Object.keys(CASES).sort()).toEqual(luaActionNames());
  });
});

engineDescribe('AC-E24: every Lua action reply matches its schema on the golden build (C-5)', () => {
  let engine: LuaLineClient;

  const call: Call = async (action, params) => {
    const reply = await engine.request(action, params ?? {}, { timeoutMs: 120_000 });
    if (reply.ok !== true) throw new Error(`precondition ${action} failed: ${JSON.stringify(reply).slice(0, 500)}`);
    return reply;
  };

  beforeAll(async () => {
    engine = await startLuaLineClient({ testActions: false });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await engine?.close();
  });

  for (const action of luaActionNames()) {
    it(
      `AC-E24: ${action}`,
      async () => {
        const testCase = (CASES as Record<string, Case | undefined>)[action];
        expect(testCase).toBeDefined();
        await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
        const params = testCase!.setup ? await testCase!.setup(call) : (testCase!.params ?? {});

        const reply = await engine.request(action, params, { timeoutMs: 120_000 });
        expect(reply).toMatchObject({ ok: true });
        const schema = replySchemas[action as ActionName];
        expect(schema).toBeDefined();
        const parsed = schema!.safeParse(reply);
        // The issues, when there are any, say which field broke the contract.
        expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
        expect(parsed.success).toBe(true);
      },
      ENGINE_TIMEOUT,
    );
  }

  for (const variant of VARIANTS) {
    it(
      `AC-B4: ${variant.name}`,
      async () => {
        await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
        const params = variant.setup ? await variant.setup(call) : (variant.params ?? {});

        const reply = await engine.request(variant.action, params, { timeoutMs: 120_000 });
        expect(reply).toMatchObject({ ok: true });
        expect(reply[variant.adds]).toBeDefined();
        const parsed = replySchemas[variant.action]!.safeParse(reply);
        expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
        expect(parsed.success).toBe(true);
      },
      ENGINE_TIMEOUT,
    );
  }

  it(
    'AC-K46: check_coverage without sourceNames replies ok:false (the possibly-unread rule is never skipped)',
    async () => {
      const reply = await engine.request('check_coverage', { itemText: COVERAGE_AMULET }, { timeoutMs: 120_000 });
      expect(reply.ok).toBe(false);
      expect(String(reply.error)).toContain('sourceNames');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K46: with sourceNames [], "+30 to maximum Life" is possibly unread (Lua uses the names it is passed)',
    async () => {
      const reply = await engine.request(
        'check_coverage',
        { itemText: COVERAGE_AMULET, sourceNames: [] },
        { timeoutMs: 120_000 },
      );
      expect(reply).toMatchObject({ ok: true });
      const life = (reply.result.entries as Array<{ line: string; status: string; unread?: string[] }>).find(
        (e) => e.line === '+30 to maximum Life',
      );
      expect(life).toMatchObject({ status: 'possibly unread', unread: ['Life'] });
      // With the real scan the same line is fully parsed: the status follows the names passed.
      const scanned = await engine.request(
        'check_coverage',
        { itemText: COVERAGE_AMULET, sourceNames: [...(await pobSourceNames(resolvePobSrc(process.env)))] },
        { timeoutMs: 120_000 },
      );
      const lifeScanned = (scanned.result.entries as Array<{ line: string; status: string }>).find(
        (e) => e.line === '+30 to maximum Life',
      );
      expect(lifeScanned?.status).toBe('fully parsed');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-B4 (C-39): manage_sets replies match their schema for a list and a change of each set type, and loadouts',
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      await call('create_spec', { title: 'Act 1 {1}' });
      const steps: Json[] = [
        { setType: 'item', action: 'list' },
        { setType: 'item', action: 'create', title: 'Early {1}', useSecondWeaponSet: true },
        { setType: 'item', action: 'copy', id: 1 },
        { setType: 'skill', action: 'list' },
        { setType: 'skill', action: 'copy', id: 1, title: 'Act 1 {1}' },
        { setType: 'skill', action: 'rename', id: 2, title: 'Act 1 {1}' },
        { setType: 'config', action: 'list' },
        { setType: 'config', action: 'create', title: 'Campaign {1}' },
        { setType: 'config', action: 'select', id: 2 },
        { setType: 'loadout', action: 'list' },
        { setType: 'loadout', action: 'select', title: 'Act 1 {1}' },
      ];
      for (const params of steps) {
        const reply = await engine.request('manage_sets', params, { timeoutMs: 120_000 });
        expect({ params, ok: reply.ok }).toEqual({ params, ok: true });
        const parsed = replySchemas.manage_sets!.safeParse(reply);
        expect({ params, issues: parsed.success ? [] : parsed.error.issues }).toEqual({ params, issues: [] });
        expect(reply.result.setType).toBe(params.setType);
        if (params.setType === 'loadout') expect(Array.isArray(reply.result.loadouts)).toBe(true);
      }
      // A failure is ok:false with the reason, never an exception.
      const bad = await engine.request('manage_sets', { setType: 'item', action: 'create', title: 'Early {1, 2}' }, { timeoutMs: 120_000 });
      expect(bad.ok).toBe(false);
      expect(String(bad.error)).toContain('[A-Za-z0-9,]');
      const unknown = await engine.request('manage_sets', { setType: 'loadout', action: 'select', title: 'Nowhere {9}' }, { timeoutMs: 120_000 });
      expect(unknown.ok).toBe(false);
      expect(String(unknown.error)).toContain('no loadout named');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K30 (D-196, contract): set_level {level, autoMode:true} matches its schema and turns on auto mode; without it the mode is manual',
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      const buildTag = async () => /<Build\b[^>]*>/.exec((await call('export_build_xml')).xml as string)![0];

      const auto = await engine.request('set_level', { level: 40, autoMode: true }, { timeoutMs: 120_000 });
      expect(auto).toMatchObject({ ok: true });
      const parsed = replySchemas.set_level!.safeParse(auto);
      expect(parsed.success).toBe(true);
      expect(await buildTag()).toMatch(/\blevel="40"/);
      expect(await buildTag()).toMatch(/\bcharacterLevelAutoMode="true"/);

      const manual = await engine.request('set_level', { level: 41 }, { timeoutMs: 120_000 });
      expect(manual).toMatchObject({ ok: true });
      expect(await buildTag()).toMatch(/\blevel="41"/);
      expect(await buildTag()).toMatch(/\bcharacterLevelAutoMode="false"/);

      // A non-boolean flag fails and changes nothing.
      const bad = await engine.request('set_level', { level: 50, autoMode: 'yes' }, { timeoutMs: 120_000 });
      expect(bad.ok).toBe(false);
      expect(String(bad.error)).toContain('autoMode');
      expect(await buildTag()).toMatch(/\blevel="41"/);
    },
    ENGINE_TIMEOUT,
  );
});

engineDescribe('AC-K38 (contract part): update_tree_delta carries its reply fields (C-48, D-194)', () => {
  let engine: LuaLineClient;

  beforeAll(async () => {
    engine = await startLuaLineClient({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await engine?.close();
  });

  const lua = async <T>(code: string): Promise<T> => {
    const reply = await engine.request('__test_eval', { code }, { timeoutMs: 120_000 });
    expect(reply.ok).toBe(true);
    return reply.result as T;
  };

  it(
    'AC-K38: on a new Warrior/Titan build, update_tree_delta with the 8 Titan notables replies with autoPathedNodes, skippedAscendancyNodes and tree.ascendancyPointsUsed equal to the Lua count',
    async () => {
      expect(await engine.request('new_build', { className: 'Warrior', ascendancy: 'Titan' }, { timeoutMs: 120_000 })).toMatchObject({ ok: true });
      const notables = await lua<number[]>(`
        local rows = {}
        for id, node in pairs(build.spec.nodes) do
          if node.ascendancyName == 'Titan' and node.type == 'Notable' then rows[#rows + 1] = { id = id, name = node.dn } end
        end
        table.sort(rows, function(a, b) return a.name < b.name end)
        local ids = {}
        for _, row in ipairs(rows) do ids[#ids + 1] = row.id end
        return ids`);
      expect(notables).toHaveLength(8);

      const reply = await engine.request('update_tree_delta', { addNodes: notables }, { timeoutMs: 120_000 });
      expect(reply).toMatchObject({ ok: true });
      const parsed = replySchemas.update_tree_delta!.safeParse(reply);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
      expect(Array.isArray(reply.autoPathedNodes)).toBe(true);
      expect(reply.autoPathedNodes.length).toBeGreaterThan(0);
      expect(Array.isArray(reply.skippedAscendancyNodes)).toBe(true);
      expect(reply.skippedAscendancyNodes.length).toBeGreaterThan(0);

      const count = await lua<number>(`
        local n = 0
        for _, node in pairs(build.spec.allocNodes) do
          if node.ascendancyName == 'Titan' and node.type ~= 'AscendClassStart' then n = n + 1 end
        end
        return n`);
      expect(reply.tree.ascendancyPointsUsed).toBe(count);
      // The notables cost more than 8 points together, so the budget is filled exactly.
      expect(count).toBe(8);
    },
    ENGINE_TIMEOUT,
  );
});
