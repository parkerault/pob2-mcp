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
 * WU-54 (AC-B4): `check_coverage`'s reply carries `flags`; its case raises every flag kind, and an empty
 * flag list (`[]`) still matches the schema.
 *
 * AC-K38 (WU-36, contract part): on a new Warrior/Titan build, `update_tree_delta` with the 8 Titan notables
 * replies with `autoPathedNodes`, `skippedAscendancyNodes` and `tree.ascendancyPointsUsed` (C-48), the last
 * equal to a Lua count of the allocated Titan nodes (the start node excluded). That case runs on its own
 * engine with test actions on, for the Lua query.
 *
 * WU-35 (C-39, AC-B4): `manage_sets` replies match their schema for every set type, a list and a changing
 * action of each; AC-K30's contract case: `set_level {level, autoMode:true}` matches its schema and the
 * export says `characterLevelAutoMode="true"`, without the flag `"false"`, and a non-boolean flag fails.
 *
 * WU-41 (C-41, AC-B4, AC-P38): the compiler's three actions (`API/Compile.lua`). `compile_check` checks the
 * two-stage fixture's stage 1 on the golden build; `compile_stage` builds that stage on a new Warrior/Titan
 * build; `compile_finish` runs after it. A failing stage is `ok:false` naming the stage, never an exception.
 *
 * WU-55 (D-293, AC-B4): `create_socket_group` takes `groupCount` and replies with it; `compile_stage`'s params
 * carry each group's Full DPS flag and Count and the custom modifiers, and its reply `dotCanStack` (the case
 * above checks it against the schema); `compile_check` reports a custom modifier line PoB can't parse.
 *
 * WU-65 (D-353, D-358; AC-B3, AC-B4, AC-B5): `compile_check` takes each stage's `anoint` and `describeGems`, and
 * replies with `anoints` (the notable, its node, its recipe and the emotions' item names) and `gemTexts`, both
 * `[]` when empty; `compile_stage` takes `anoint` and writes it on the amulet as `{enchant}Allocates <notable>`,
 * and its `checks.nodeNames` holds the notable PoB grants.
 *
 * WU-66 (D-360; AC-B4): `compile_check` replies with `trees`, each stage's trees for V1's `tree-shape`: the
 * starts (the class start and its main-tree exits), the main tree's components with the exits they hold, and
 * the ascendancy's components, the start's first; `[]` for no stage.
 *
 * WU-78 (D-376, D-377, D-380; AC-B3, AC-B4): `compile_check` takes a group's `minionSkill` and `minionStatSet` and
 * reports an unknown one as a defect; `compile_stage` takes them, replies with `minionSkills` (each group's
 * resolved selection, `[]` for none), carries the minion's numbers as `Minion<Field>` outputs, and its
 * `checks.grantedSkills` names the passives that grant a group's skill (`[]` for none).
 *
 * D-398 (M-19; AC-B3, AC-B4): `load_build_xml` replies with `droppedSupports`, the gems PoB dropped from the
 * build's granted groups: each granted group with supports (`granted-supports.xml`: a passive's and an item's) gives
 * one entry with the group, its source, the grantor's name and the gems, a group nothing grants carries
 * `grantMissing`, and the golden build gives `[]`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type Json, type LuaLineClient } from '../helpers/luaLineClient';
import { ACTION_NAMES, replySchemas, type ActionName } from '../../src/engine/schemas';
import { pobSourceNames, pobSourceScan } from '../../src/engine/pobSourceNames';
import { resolvePobSrc } from '../../src/engine/pobPath';
import { validatePlan } from '../../src/plan/schema';
import { checkStageOf, groupSets, stageParams } from '../../src/plan/compiler';
import { OFFENSE_STAT_FIELDS } from '../../src/handlers/luaHandlers';
import { ITEM_SLOTS } from '../../src/server/toolSchemas';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const GOLDEN = fs.readFileSync(path.join(FIXTURES, 'builds', 'grenadator.xml'), 'utf8');
const GRANTED_SUPPORTS = fs.readFileSync(path.join(FIXTURES, 'builds', 'granted-supports.xml'), 'utf8');
const RUBY_RING = fs.readFileSync(path.join(FIXTURES, 'items', 'ruby-ring.txt'), 'utf8');
const COVERAGE_AMULET = fs.readFileSync(path.join(FIXTURES, 'items', 'coverage-amulet.txt'), 'utf8');
/** Two committed trade2 `/fetch` entries, verbatim (no network). */
const FETCHED = (
  JSON.parse(fs.readFileSync(path.join(FIXTURES, 'trade2', 'fetch-weighted-session.response.json'), 'utf8')) as {
    result: Json[];
  }
).result.slice(0, 2);

const ENGINE_TIMEOUT = 240_000;

/** The Varashta fixture plan (WU-78): a socketed Navira whose djinn uses Navira's Fracturing, nodes 32705 and 10561. */
const VARASHTA = (() => {
  const v = validatePlan(fs.readFileSync(path.join(FIXTURES, 'plans', 'varashta-navira', 'plan.json'), 'utf8'));
  if (!v.ok) throw new Error(`the varashta-navira fixture is invalid: ${JSON.stringify(v.errors)}`);
  return v.plan;
})();

/** The two-stage fixture plan (WU-41's compile actions are checked on its stage 1). */
const TWO_STAGE = (() => {
  const v = validatePlan(fs.readFileSync(path.join(FIXTURES, 'plans', 'two-stage', 'plan.json'), 'utf8'));
  if (!v.ok) throw new Error(`the two-stage fixture is invalid: ${JSON.stringify(v.errors)}`);
  return v.plan;
})();

/** `compile_stage`'s params for the fixture's stage 1, built as the compiler builds them. */
function stageOneParams(): Json {
  const grouped = groupSets(TWO_STAGE.stages);
  const stage = TWO_STAGE.stages[0];
  const title = (kind: 'item' | 'skill' | 'config') => grouped[kind].groups[grouped[kind].groupOf.get(stage.id)!].title;
  return stageParams(stage, true, { item: { title: title('item') }, skill: { title: title('skill') }, config: { title: title('config') } }, OFFENSE_STAT_FIELDS) as unknown as Json;
}

/** A new Warrior/Titan build with the fixture's stage 1 compiled into it; returns the stage's reply. */
async function compiledStageOne(call: Call): Promise<Json> {
  await call('new_build', { className: TWO_STAGE.roll.className, ascendancy: TWO_STAGE.roll.ascendancy });
  return (await call('compile_stage', stageOneParams())).result;
}

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
  get_rule_breaks: {},
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
  // C-41 (WU-41): the preflight of the fixture's stage 1 on the golden build (it changes nothing).
  compile_check: {
    params: { className: 'Warrior', ascendancy: 'Titan', stages: [checkStageOf(TWO_STAGE.stages[0]) as unknown as Json] },
  },
  // C-41 (WU-41): the fixture's stage 1 on a new Warrior/Titan build (the golden build is another class).
  compile_stage: {
    setup: async (call) => {
      await call('new_build', { className: 'Warrior', ascendancy: 'Titan' });
      return stageOneParams();
    },
  },
  // C-41 (WU-41): after stage 1 is compiled, its one loadout is checked and selected at its level.
  compile_finish: {
    setup: async (call) => {
      const stage = await compiledStageOne(call);
      const { id, loadoutName, level } = TWO_STAGE.stages[0];
      return { stages: [{ id, title: loadoutName, ids: stage.ids }], active: loadoutName, level, itemSlots: [...ITEM_SLOTS] };
    },
  },
  // C-37 (WU-31): gem mode carries every reply field a gem has (stat sets, quality lines, requirements).
  lookup_game_data: { params: { mode: 'gem', query: 'Blood Hunt', level: 20, quality: 0 } },
  // C-38 (WU-32): an item with every line status, a joined node line and a gem with unmodelled lines, so
  // `remainder`, `unread`, `joinedWith`, `nodeId` and `stat` are all in the reply; the real scan (D-243).
  // WU-54: plus a node and gems that raise every flag, so `flags` holds each kind, with and without `line`.
  check_coverage: { setup: async () => coverageParams() },
};

/** The flag kinds of WU-54 (D-300, D-336). */
const COVERAGE_FLAG_NAMES = [
  'mapped but unread',
  'stat not mapped',
  'energy not modelled',
  'level from support',
  'granted skill undefined',
  'support colour tie',
];

/** `check_coverage`'s contract params: every status, a join, and every flag kind, with the real scan. */
async function coverageParams(): Promise<Json> {
  const scan = await pobSourceScan(resolvePobSrc(process.env));
  return {
    itemText: COVERAGE_AMULET,
    nodes: ['38570', 'Gem Studded'],
    gems: ['Blood Hunt', 'Aftershock I', 'Mirage Archer', 'Cast on Critical', "Paquate's Pact", 'Concussive Runes'],
    sourceNames: [...scan.names],
    sourceTemplates: scan.templates,
    sourceCallNames: scan.skillCallNames,
    sourceSkillTemplates: scan.skillNameTemplates,
  };
}

/** A golden attribute node set to Strength (the first of its `<AttributeOverride strNodes>`). */
const GOLDEN_STR_NODE = (/<AttributeOverride\b[^>]*\sstrNodes="(\d+)/.exec(GOLDEN) as RegExpExecArray)[1];

/** The golden socket group with a summon: Pounce, whose Summon Wolf's Wolf Companion casts Basic Attack and Leap Slam. */
async function summonGroup(call: Call): Promise<number> {
  const { skills } = await call('get_skills');
  const group = (skills.groups as Array<{ index: number; skills: string[] }>).find((g) => g.skills.includes('Summon Wolf'));
  if (!group) throw new Error('the golden build has no Summon Wolf group');
  return group.index;
}

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
    // D-377 (WU-77): the minion selection, and every group's `minions` in the reply's skills.
    name: 'set_main_selection with minionSkill and minionStatSet (D-377)',
    action: 'set_main_selection',
    adds: 'minion',
    setup: async (call) => ({ mainSocketGroup: await summonGroup(call), minionSkill: 'Leap Slam', minionStatSet: 1 }),
  },
  {
    // D-379 (WU-77): a minion-skill result in gem mode.
    name: 'lookup_game_data finds a minion skill by name (D-379)',
    action: 'lookup_game_data',
    adds: 'result',
    params: { mode: 'gem', query: "Navira's Fracturing" },
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
  it('AC-E24: Handlers.lua merges the Trade, Lookup, Coverage, Sets and Compile modules (AC-B4)', () => {
    const handlers = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'Handlers.lua'), 'utf8');
    expect(mergedModules(handlers)).toEqual(expect.arrayContaining(['Trade', 'Lookup', 'Coverage', 'Sets', 'Compile']));
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
    'AC-B4 (D-398): load_build_xml replies with droppedSupports, one entry per granted group that lost gems, and [] for none',
    async () => {
      const golden = await engine.request('load_build_xml', { xml: GOLDEN, name: 'Grenadator' }, { timeoutMs: 120_000 });
      expect(replySchemas.load_build_xml!.safeParse(golden).success).toBe(true);
      expect(golden.result.droppedSupports).toEqual([]);

      const reply = await engine.request('load_build_xml', { xml: GRANTED_SUPPORTS, name: 'Granted' }, { timeoutMs: 120_000 });
      const parsed = replySchemas.load_build_xml!.safeParse(reply);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
      expect(reply.result.droppedSupports).toEqual([
        { group: 'Virtuous Barrier', source: 'Tree:11641', grantedBy: 'Essence of Virtue', gems: ['Precision I', 'Clarity I'] },
        { group: 'Discipline', source: 'Item:1:Stoic Sceptre', grantedBy: 'Stoic Sceptre', gems: ['Precision II', 'Clarity II'] },
      ]);

      // A group nothing grants: `grantMissing`, and the granted skill isn't among the gems.
      const unallocated = GRANTED_SUPPORTS.replace('nodes="34882,11641"', 'nodes="34882"');
      expect(unallocated).not.toBe(GRANTED_SUPPORTS);
      const missing = await engine.request('load_build_xml', { xml: unallocated, name: 'Granted' }, { timeoutMs: 120_000 });
      expect(replySchemas.load_build_xml!.safeParse(missing).success).toBe(true);
      expect(missing.result.droppedSupports[0]).toEqual({
        group: 'Virtuous Barrier',
        source: 'Tree:11641',
        grantedBy: 'Essence of Virtue',
        grantMissing: true,
        gems: ['Precision I', 'Clarity I'],
      });
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-B4 (WU-54): check_coverage replies carry flags of every kind, line flags with `line`, and an empty flag list encodes as []',
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      const reply = await engine.request('check_coverage', await coverageParams(), { timeoutMs: 120_000 });
      expect(reply).toMatchObject({ ok: true });
      const parsed = replySchemas.check_coverage!.safeParse(reply);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
      const flags = reply.result.flags as Array<{ flag: string; source: string; note: string; line?: string }>;
      expect([...new Set(flags.map((x) => x.flag))].sort()).toEqual([...COVERAGE_FLAG_NAMES].sort());
      const lineFlags = new Set(['mapped but unread', 'support colour tie']);
      for (const x of flags) expect({ flag: x.flag, hasLine: typeof x.line === 'string' }).toEqual({ flag: x.flag, hasLine: lineFlags.has(x.flag) });

      // An item with no flagged line: an empty Lua table, which dkjson sends as [], still matches.
      const scan = await pobSourceScan(resolvePobSrc(process.env));
      const plain = await engine.request(
        'check_coverage',
        { itemText: COVERAGE_AMULET, sourceNames: [...scan.names], sourceTemplates: scan.templates },
        { timeoutMs: 120_000 },
      );
      expect(plain.result.flags).toEqual([]);
      const plainParsed = replySchemas.check_coverage!.safeParse(plain);
      expect(plainParsed.success ? [] : plainParsed.error.issues).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

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
    "AC-B4 (C-37, WU-60): lookup_game_data's mechanic replies with mod base types, an empty base-type list and essence hits match the schema",
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      const replies: Array<{ params: Json; reply: Json }> = [];
      for (const params of [
        // A desecrated mod that only some gloves can roll, and broad mods whose item types collapse.
        { mode: 'mechanic', query: 'Arcane Surge', kind: 'mod', maxResults: 30 },
        { mode: 'mechanic', query: 'maximum Life', kind: 'mod', maxResults: 30 },
        // Essence hits, by name and by mod text, and the per-kind totals with `essence`.
        { mode: 'mechanic', query: 'Essence of Haste', kind: 'essence', maxResults: 30 },
        { mode: 'mechanic', query: 'increased Movement Speed', maxResults: 30 },
      ] as Json[]) {
        const reply = await engine.request('lookup_game_data', params, { timeoutMs: 120_000 });
        expect({ params, ok: reply.ok }).toEqual({ params, ok: true });
        const parsed = replySchemas.lookup_game_data!.safeParse(reply);
        expect({ params, issues: parsed.success ? [] : parsed.error.issues }).toEqual({ params, issues: [] });
        expect(typeof reply.result.kinds.essence).toBe('number');
        replies.push({ params, reply });
      }
      const hits = replies.flatMap((r) => r.reply.result.results as Json[]);
      const mods = hits.filter((h) => h.kind === 'mod');
      expect(mods.length).toBeGreaterThan(0);
      // A rune's mod has no spawn weights, so no base types; every other mod hit has a list.
      for (const m of mods) expect({ id: m.id, list: Array.isArray(m.baseTypes) }).toEqual({ id: m.id, list: m.table !== 'Runes' });
      expect(mods.some((m) => m.table === 'Runes')).toBe(true);
      const weighted = mods.filter((m) => m.table !== 'Runes');
      // Some mod has base types, some (a unique-only mod) has none: the empty list is sent as `[]`.
      expect(weighted.some((m) => m.baseTypes.length > 0 && m.baseTypes[0].count > 0)).toBe(true);
      expect(weighted.some((m) => m.baseTypes.length === 0)).toBe(true);
      // An Exclusive mod isn't rolled on a base: an empty list and the reason.
      expect(weighted.some((m) => m.table === 'Exclusive' && m.baseTypes.length === 0 && typeof m.notRolled === 'string')).toBe(true);
      expect(weighted.some((m) => (m.baseTypes as Json[]).some((b) => b.itemType === true))).toBe(true);
      const essences = hits.filter((h) => h.kind === 'essence');
      expect(essences.length).toBeGreaterThan(0);
      for (const e of essences) expect(e.itemTypes.length).toBeGreaterThan(0);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-B4 (C-37, WU-53): lookup_game_data's gem replies with skill types, usable-by, Gemling lines, children, a support's reach and an active gem's unlocks, and mechanic replies with base hits and gaps, match the schema",
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      const replies: Array<{ params: Json; reply: Json }> = [];
      for (const params of [
        // One active gem (its unlocks), one support (the list form), one in the complement form, and several.
        { mode: 'gem', query: 'Whirling Assault' },
        { mode: 'gem', query: "Ailith's Chimes" },
        { mode: 'gem', query: "Uhtred's Exodus" },
        { mode: 'gem', query: 'Culmination' },
        // Children of every kind, and Gemling lines.
        { mode: 'gem', query: 'Pounce' },
        { mode: 'gem', query: "Bloodhound's Mark" },
        { mode: 'gem', query: 'Hammer of the Gods' },
        // Base hits with and without a variant, the base count, and a gap query.
        { mode: 'mechanic', query: 'Cast on Critical', maxResults: 30 },
        { mode: 'mechanic', query: 'Spirit', kind: 'base', maxResults: 30 },
        { mode: 'mechanic', query: 'cannot … but', maxResults: 30 },
      ] as Json[]) {
        const reply = await engine.request('lookup_game_data', params, { timeoutMs: 120_000 });
        expect({ params, ok: reply.ok }).toEqual({ params, ok: true });
        const parsed = replySchemas.lookup_game_data!.safeParse(reply);
        expect({ params, issues: parsed.success ? [] : parsed.error.issues }).toEqual({ params, issues: [] });
        replies.push({ params, reply });
      }
      const gem = (i: number) => replies[i].reply.result.results[0] as Json;
      expect(Array.isArray(gem(0).unlocks) && gem(0).unlocks.length > 0).toBe(true);
      expect(gem(0).canSupport).toBeUndefined();
      expect(gem(1).canSupport).toMatchObject({ except: false, count: 2 });
      expect(gem(2).canSupport).toMatchObject({ except: true });
      for (const g of replies[3].reply.result.results as Json[]) {
        expect({ name: g.name, reach: g.canSupport, unlocks: g.unlocks }).toEqual({ name: g.name, reach: undefined, unlocks: undefined });
      }
      expect((gem(4).children as Json[]).every((c) => c.kind === 'minion' && typeof c.minion === 'string')).toBe(true);
      expect((gem(5).children as Json[]).map((c) => c.kind)).toEqual(['triggered']);
      expect(gem(6).hasGemling).toBe(true);
      expect(gem(6).gemlingLines.length).toBeGreaterThan(0);
      expect(Array.isArray(gem(0).usableBy) && Array.isArray(gem(0).skillTypes)).toBe(true);
      // An empty list is sent as `[]` (a support has no children here).
      expect(gem(1).children).toEqual([]);
      const bases = replies.slice(7, 9).flatMap((r) => r.reply.result.results as Json[]).filter((h) => h.kind === 'base');
      expect(bases.some((b) => Array.isArray(b.baseVariants))).toBe(true);
      expect(bases.some((b) => b.baseVariants === undefined && typeof b.itemType === 'string')).toBe(true);
      expect(typeof replies[7].reply.result.kinds.base).toBe('number');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-B4 (C-41): the compile actions report a defect or a failing stage as data or ok:false, never an exception',
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      const stage = checkStageOf(TWO_STAGE.stages[0]) as unknown as Json;
      const checked = await engine.request(
        'compile_check',
        { className: 'Warrior', ascendancy: 'Titan', stages: [{ ...stage, groups: [{ gems: [{ name: 'Not A Gem At All' }] }] }] },
        { timeoutMs: 120_000 },
      );
      expect(checked.ok).toBe(true);
      expect(replySchemas.compile_check!.safeParse(checked).success).toBe(true);
      expect(checked.result.defects.join('\n')).toMatch(/^stage 1: skills\.groups\[0\]\.gems\[0\]: unknown gem "Not A Gem At All"/m);

      await call('new_build', { className: 'Warrior', ascendancy: 'Titan' });
      const failed = await engine.request('compile_stage', { ...stageOneParams(), main: { group: 9, activeSkill: 1 } }, { timeoutMs: 120_000 });
      expect(failed.ok).toBe(false);
      expect(String(failed.error)).toMatch(/^stage 1: /);

      const finish = await engine.request('compile_finish', { stages: [], active: 'Nowhere {9}', level: 5 }, { timeoutMs: 120_000 });
      expect(finish.ok).toBe(false);
      expect(String(finish.error)).toMatch(/untitled|loadouts/);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-B4 (WU-55, D-293): create_socket_group sets groupCount and replies with it, a bad one is ok:false; compile_check reports an unparseable custom modifier',
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      const made = await engine.request('create_socket_group', { label: 'wu55', includeInFullDPS: true, groupCount: 3 }, { timeoutMs: 120_000 });
      expect(replySchemas.create_socket_group!.safeParse(made).success).toBe(true);
      expect(made.socketGroup).toMatchObject({ label: 'wu55', includeInFullDPS: true, groupCount: 3 });
      const tag = /<Skill\b[^>]*\blabel="wu55"[^>]*>/.exec((await call('export_build_xml')).xml as string)![0];
      expect(tag).toMatch(/\bgroupCount="3"/);
      expect(tag).toMatch(/\bincludeInFullDPS="true"/);
      const plain = await call('create_socket_group', { label: 'wu55-plain' });
      expect(plain.socketGroup.includeInFullDPS).toBe(false);
      expect(plain.socketGroup.groupCount).toBeUndefined();
      const bad = await engine.request('create_socket_group', { groupCount: 1.5 }, { timeoutMs: 120_000 });
      expect(bad.ok).toBe(false);
      expect(String(bad.error)).toContain('groupCount');

      const stage = { ...(checkStageOf(TWO_STAGE.stages[0]) as unknown as Json), customMods: ['+10 to maximum Life', 'not a modifier line at all'] };
      const checked = await engine.request('compile_check', { className: 'Warrior', ascendancy: 'Titan', stages: [stage] }, { timeoutMs: 120_000 });
      expect(replySchemas.compile_check!.safeParse(checked).success).toBe(true);
      expect(checked.result.defects).toEqual([
        'stage 1: config.customMods[1]: PoB can not parse "not a modifier line at all" whole as a modifier, so its customMods option would skip it and add nothing',
      ]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-B4 (WU-65, D-358, D-353): compile_check resolves an anoint and describes gems; compile_stage writes the anoint on the amulet',
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      const base = checkStageOf(TWO_STAGE.stages[0]) as unknown as Json;
      const stage = { ...base, items: [...(base.items as Json[]), { slot: 'Amulet', text: 'Rarity: Normal\nCrimson Amulet' }], anoint: 'unbending' };
      const checked = await engine.request(
        'compile_check',
        { className: 'Warrior', ascendancy: 'Titan', stages: [stage], describeGems: ['Contagion', 'Rolling Slam'] },
        { timeoutMs: 120_000 },
      );
      const parsed = replySchemas.compile_check!.safeParse(checked);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
      expect(checked.result.defects).toEqual([]);
      expect(checked.result.anoints).toEqual([
        { stage: '1', notable: 'Unbending', node: 1352, recipe: expect.any(Array), emotions: expect.any(Array) },
      ]);
      expect(checked.result.anoints[0].recipe).toHaveLength(3);
      expect(checked.result.anoints[0].emotions).toHaveLength(3);
      expect(checked.result.gemTexts.Contagion).toMatch(/If the enemy dies while affected by Contagion, it spreads itself/);
      expect(typeof checked.result.gemTexts['Rolling Slam']).toBe('string');
      // Without an anoint or gems asked for, both are empty lists.
      const plain = await engine.request('compile_check', { className: 'Warrior', ascendancy: 'Titan', stages: [base] }, { timeoutMs: 120_000 });
      expect(replySchemas.compile_check!.safeParse(plain).success).toBe(true);
      expect([plain.result.anoints, plain.result.gemTexts]).toEqual([[], []]);

      await call('new_build', { className: TWO_STAGE.roll.className, ascendancy: TWO_STAGE.roll.ascendancy });
      const params = stageOneParams();
      const built = await engine.request(
        'compile_stage',
        { ...params, items: [...(params.items as Json[]), { slot: 'Amulet', text: 'Rarity: Normal\nCrimson Amulet' }], anoint: 'Unbending' },
        { timeoutMs: 120_000 },
      );
      const stageParsed = replySchemas.compile_stage!.safeParse(built);
      expect(stageParsed.success ? [] : stageParsed.error.issues).toEqual([]);
      expect(built.result.checks.nodeNames).toContain('Unbending');
      expect(built.result.allocation.nodes.map((n: Json) => n.id)).not.toContain(1352);
      expect((await call('export_build_xml')).xml as string).toMatch(/^\{enchant\}Allocates Unbending$/m);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-B4 (WU-66, D-360): compile_check replies with each stage\'s trees: the starts, the main tree\'s components with their exits, the ascendancy\'s',
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      const stage = checkStageOf(TWO_STAGE.stages[0]) as unknown as Json;
      const checked = await engine.request('compile_check', { className: 'Warrior', ascendancy: 'Titan', stages: [stage] }, { timeoutMs: 120_000 });
      const parsed = replySchemas.compile_check!.safeParse(checked);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
      expect(checked.result.defects).toEqual([]);
      expect(checked.result.trees).toHaveLength(1);
      const [trees] = checked.result.trees;
      expect(trees.stage).toBe('1');
      // The Warrior start: its node and main-tree exits, from the pinned tree data read as plain JSON.
      const treeJson = JSON.parse(fs.readFileSync(path.join(resolvePobSrc(process.env), 'TreeData', '0_5', 'tree.json'), 'utf8'));
      const raw = treeJson.nodes as Record<string, Json>;
      const startId = Number(Object.keys(raw).find((id) => ((raw[id].classesStart ?? []) as string[]).includes('Warrior')));
      const linked = new Set<number>();
      for (const [id, n] of Object.entries(raw)) {
        for (const c of (n.connections ?? []) as Json[]) {
          if (Number(id) === startId) linked.add(Number(c.id));
          if (Number(c.id) === startId) linked.add(Number(id));
        }
      }
      const isMainNode = (id: number) => raw[id] !== undefined && raw[id].ascendancyName === undefined && raw[id].classesStart === undefined && raw[id].isAscendancyStart !== true;
      const start = { result: { node: startId, exits: [...linked].filter(isMainNode).sort((a, b) => a - b) } };
      expect(trees.starts[0]).toEqual({ node: start.result.node, name: 'Warrior', exits: start.result.exits });
      const nodes = [...(stage.nodes as number[])].sort((a, b) => a - b);
      expect(trees.main).toEqual([{ nodes, exits: nodes.filter((n) => start.result.exits.includes(n)) }]);
      expect(trees.main[0].exits).toHaveLength(1);
      expect(trees.ascendancy).toMatchObject({ name: 'Titan', trees: [{ nodes: [trees.ascendancy.start] }] });
      const none = await engine.request('compile_check', { className: 'Warrior', ascendancy: 'Titan', stages: [] }, { timeoutMs: 120_000 });
      expect(replySchemas.compile_check!.safeParse(none).success).toBe(true);
      expect(none.result.trees).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-B4 (WU-78, D-376, D-377, D-380): compile_check checks a minion skill; compile_stage resolves it, with the minion\'s outputs and the granting passives',
    async () => {
      await call('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
      const { className, ascendancy } = VARASHTA.roll;
      const stage = checkStageOf(VARASHTA.stages[0]) as unknown as Json;
      expect(stage.groups).toEqual([{ gems: [{ name: 'Navira, the Last Mirage', enabled: true }], minionSkill: "Navira's Fracturing" }]);
      const checked = await engine.request('compile_check', { className, ascendancy, stages: [stage] }, { timeoutMs: 120_000 });
      const parsed = replySchemas.compile_check!.safeParse(checked);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
      expect(checked.result.defects).toEqual([]);
      const unknown = { ...stage, groups: [{ ...(stage.groups as Json[])[0], minionSkill: 'Not A Skill' }] };
      const bad = await engine.request('compile_check', { className, ascendancy, stages: [unknown] }, { timeoutMs: 120_000 });
      expect(replySchemas.compile_check!.safeParse(bad).success).toBe(true);
      expect(bad.result.defects).toEqual([expect.stringMatching(/^stage b: skills\.groups\[0\]\.minionSkill "Not A Skill": .* has no skill of that name; its skills: /)]);

      await call('new_build', { className, ascendancy });
      const grouped = groupSets(VARASHTA.stages);
      const vs = VARASHTA.stages[0];
      const title = (kind: 'item' | 'skill' | 'config') => grouped[kind].groups[grouped[kind].groupOf.get(vs.id)!].title;
      const params = stageParams(vs, true, { item: { title: title('item') }, skill: { title: title('skill') }, config: { title: title('config') } }, OFFENSE_STAT_FIELDS) as unknown as Json;
      expect((params.groups as Json[])[0]).toMatchObject({ minionSkill: "Navira's Fracturing" });
      const built = await engine.request('compile_stage', params, { timeoutMs: 120_000 });
      const stageParsed = replySchemas.compile_stage!.safeParse(built);
      expect(stageParsed.success ? [] : stageParsed.error.issues).toEqual([]);
      expect(built.result.minionSkills).toEqual([
        expect.objectContaining({ group: 1, activeSkill: 1, name: "Navira's Fracturing", index: 2, statSet: 1, minionId: 'WaterDjinn' }),
      ]);
      expect(built.result.outputs.MinionTotalDPS).toBeGreaterThan(0);
      expect(built.result.checks.grantedSkills).toEqual([
        { group: 1, kind: 'gem', name: 'Navira, the Last Mirage', nodes: [{ id: 32705, name: 'Barya of Navira' }], allocated: true },
        { group: 1, kind: 'minionSkill', name: "Navira's Fracturing", nodes: [{ id: 10561, name: "Navira's Fracturing" }], allocated: true },
      ]);
      // Without a minion skill or a granted skill, both lists are empty and still match the schema.
      await call('new_build', { className: TWO_STAGE.roll.className, ascendancy: TWO_STAGE.roll.ascendancy });
      const plain = await engine.request('compile_stage', stageOneParams(), { timeoutMs: 120_000 });
      expect(replySchemas.compile_stage!.safeParse(plain).success).toBe(true);
      expect([plain.result.minionSkills, plain.result.checks.grantedSkills]).toEqual([[], []]);
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
