/**
 * TS↔Lua reply contract (C-5): AC-E24, engine-required.
 *
 * - **Static check:** the non-test action names registered in `pob-api/API/Handlers.lua` and
 *   `pob-api/API/Trade.lua` (parsed from the source) equal `Object.keys(replySchemas)` and `ACTION_NAMES`.
 * - **Coverage:** every parsed action has a case below.
 * - **Each case** loads the golden build, establishes its precondition (a second spec before
 *   `delete_spec`, a socket group before `add_gem`, …), calls the action, and asserts that
 *   `replySchemas[action].safeParse(reply)` succeeds.
 *
 * Replies are read raw through the line client (`tests/helpers/luaLineClient.ts`), so the schemas are
 * checked against exactly what the Lua side sends, not against a value the bridge already parsed.
 * A unit that adds a Lua action adds its schema and its case here in the same merge (C-5).
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type Json, type LuaLineClient } from '../helpers/luaLineClient';
import { ACTION_NAMES, replySchemas, type ActionName } from '../../src/engine/schemas';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const GOLDEN = fs.readFileSync(path.join(FIXTURES, 'builds', 'grenadator.xml'), 'utf8');
const RUBY_RING = fs.readFileSync(path.join(FIXTURES, 'items', 'ruby-ring.txt'), 'utf8');
/** Two committed trade2 `/fetch` entries, verbatim (no network). */
const FETCHED = (
  JSON.parse(fs.readFileSync(path.join(FIXTURES, 'trade2', 'fetch-weighted-session.response.json'), 'utf8')) as {
    result: Json[];
  }
).result.slice(0, 2);

const ENGINE_TIMEOUT = 240_000;

/** Non-test action names from `Handlers.lua` (`handlers.<name> = …`) and `Trade.lua` (`M.handlers = {…}`). */
function luaActionNames(): string[] {
  const handlers = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'Handlers.lua'), 'utf8');
  const trade = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'Trade.lua'), 'utf8');
  const names = new Set<string>();
  for (const m of handlers.matchAll(/^\s*handlers\.([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) names.add(m[1]);
  const table = /M\.handlers\s*=\s*\{([\s\S]*?)\n\}/.exec(trade);
  if (!table) throw new Error('Trade.lua: no M.handlers table');
  for (const m of table[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) names.add(m[1]);
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
};

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
];

describe('AC-E24: every Lua action has a reply schema (static)', () => {
  it('AC-E24: the non-test Lua actions of Handlers.lua and Trade.lua equal Object.keys(replySchemas) and ACTION_NAMES', () => {
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
});
