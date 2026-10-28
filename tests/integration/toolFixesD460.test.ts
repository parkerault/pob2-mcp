/**
 * WU-117 (amendment 12 §15, D-460): the tool fixes B1, B2, B4 and B5, in process and engine-required; AC-K73's rows
 * for them and AC-K74's samples. AC-K73's contract-error row is in `tests/unit/pobLuaBridge.test.ts`, B6's in
 * `engineConfig.test.ts`, B8's (and AC-K37's new line) in `treeState.test.ts`.
 *
 * - B1: `get_node_power` with TotalEHP first on the fixture `tests/fixtures/plans/weapon-set-2-unarmed/plan.json`,
 *   written from the pinned game data: a Warrior / Titan at level 14 whose main and clear skill, Boneshatter, needs a
 *   mace (`Data/Skills/act_str.lua`); set 1 holds a Slim Mace and a Splintered Tower Shield, set 2 holds nothing, and
 *   four passives are tagged to set 2. With set 2 active PoB gives Boneshatter neither an area radius nor a speed, so a
 *   measured set-2 pool move's clear entry is an empty table, which dkjson writes as `[]`; before the fix the reply
 *   failed its contract there (`result.poolSwaps.1.swaps.<k>.clear: Expected object, received array`).
 * - B2: `lookup_game_data {mode: "mechanic"}` with no `kind` returns its hits, Data/Misc.lua's constant among them,
 *   for "Deflected" and "can_evade_spells".
 * - B4: `lua_get_stats {category: "defense"}` prints Appendix A's fields wherever PoB sets them, each equal to PoB's
 *   own output, on the golden build and on a companion fixture (Starkonja's Head, whose line has 15% of hit damage
 *   taken from a damageable companion's life first, `Data/Uniques/helmet.lua`, and Wolf Pack, a damageable companion
 *   skill, `Data/Skills/act_str.lua`).
 * - B5: `check_model_coverage` reports none of Hyrri's Ire's, Obsessive Rituals' and Ceremonial Ablution's lines
 *   `possibly unread`: PoB reads their mods through mod tags, the doubled line's own Multiplier tag
 *   (`Modules/ModParser.lua`:6802-6817) and Sorcery Ward's Condition tags (`Data/Skills/other.lua`:16818-16819).
 * Every expected value comes from PoB itself (Lua queries of the loaded data and output) or the game data.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { NodePowerParams } from '../../src/engine/schemas';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');
const UNARMED_PLAN = path.join(FIXTURES, 'plans', 'weapon-set-2-unarmed', 'plan.json');
const UNARMED = 'Act 1 weapon set 2 unarmed (L14) {1}';
const ENGINE_TIMEOUT = 600_000;

/** Appendix A's `lua_get_stats` defence fields (D-460, B4), each listed wherever PoB sets it. */
const APPENDIX_A_FIELDS = [
  'DeflectEffect', 'ConfiguredNotHitChance', 'ConfiguredDamageChance', 'ConfiguredEvadeChance',
  'MeleeNotHitChance', 'ProjectileNotHitChance', 'SpellNotHitChance', 'SpellProjectileNotHitChance',
  'MeleeEvadeChance', 'ProjectileEvadeChance', 'SpellEvadeChance', 'SpellProjectileEvadeChance',
  'AvoidAllDamageFromHitsChance', 'NumberOfDamagingHits', 'NumberOfMitigatedDamagingHits',
  'StunThreshold', 'SelfStunChance', 'TotalCompanionLife', 'CompanionAllyDamageMitigation',
];

/** Starkonja's Head at mid rolls (`Data/Uniques/helmet.lua`): its last line puts hit damage on a companion first. */
const STARKONJA = [
  'Rarity: UNIQUE', "Starkonja's Head", 'Leatherbound Hood', '150% increased Evasion Rating',
  '20% increased Critical Hit Chance', '+35 to Dexterity', '150% increased Global Evasion Rating when on Low Life',
  "15% of Damage from Hits is taken from your Damageable Companion's Life before you",
].join('\n');

/** Hyrri's Ire, current variant, mid rolls (`Data/Uniques/body.lua`). */
const HYRRI_DOUBLED = 'Evasion Rating is doubled if you have not been Hit Recently';
const HYRRI = [
  'Rarity: UNIQUE', "Hyrri's Ire", 'Armoured Vest', 'Implicits: 1', '35% increased Elemental Ailment Threshold',
  '120% increased Evasion Rating', 'Gain 15% of Damage as Extra Cold Damage', '+35 to Dexterity',
  '25% increased Freeze Duration on Enemies', HYRRI_DOUBLED,
].join('\n');

type Json = Record<string, any>;

/** `key: value` lines of lua_get_stats' text, by key. */
function statLines(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split('\n')) {
    const m = /^([A-Za-z][A-Za-z0-9]*): (.*)$/.exec(line);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

engineDescribe('WU-117: the tool fixes B1, B2, B4 and B5 (D-460; AC-K73)', () => {
  let f: SessionFixture;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:tool-fixes-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function ok(tool: string, args: Record<string, unknown>): Promise<string> {
    const out = await f.call(tool, args);
    expect({ tool, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, isError: false, text: '' });
    return out.text;
  }

  const loadGolden = () => ok('lua_load_build', { build_name: 'grenadator.xml' });

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  // -------------------------------------------------------------------------------------------------
  // B1

  describe('B1: get_node_power with TotalEHP first on a set-2 pool its clear skill can\'t use', () => {
    beforeAll(async () => {
      const made = await f.call('guide_run', { new_run: 'weapon-set-2-unarmed' });
      if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
      const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
      fs.copyFileSync(UNARMED_PLAN, path.join(f.guides, planPath));
      await ok('compile_plan', { plan_path: planPath, measure_only: true });
    }, ENGINE_TIMEOUT);

    it(
      'the fixture: PoB gives Boneshatter a speed with set 1 and, with set 2 active (nothing equipped), neither a speed nor an area radius; four passives are tagged to set 2',
      async () => {
        const pob = await lua<{ one: Json; two: Json; set2: number }>(`
          local l = build:GetLoadoutByName(${JSON.stringify(UNARMED)})
          build:SetActiveLoadout(l)
          local set = build.itemsTab.activeItemSet
          local prior = set.useSecondWeaponSet
          local function measure(two)
            set.useSecondWeaponSet = two
            wipeGlobalCache()
            build.buildFlag = true
            build.calcsTab:BuildOutput()
            local o = build.calcsTab.mainOutput
            return { speed = o.Speed, radius = o.AreaOfEffectRadiusMetres }
          end
          local two = measure(true)
          local one = measure(false)
          set.useSecondWeaponSet = prior
          wipeGlobalCache()
          build.buildFlag = true
          build.calcsTab:BuildOutput()
          local n = 0
          for _, node in pairs(build.spec.allocNodes) do if (node.allocMode or 0) == 2 then n = n + 1 end end
          return { one = one, two = two, set2 = n }`);
        expect(typeof pob.one.speed).toBe('number');
        expect(pob.one.speed).toBeGreaterThan(0);
        expect(pob.two.speed).toBeUndefined();
        expect(pob.two.radius).toBeUndefined();
        expect(pob.set2).toBe(4);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K73 (B1): get_node_power {stats: ["TotalEHP", "MainDamage"]} returns a result, not "Invalid input"; its set-2 pool moves were measured with an empty clear entry, the field that failed',
      async () => {
        const text = await ok('get_node_power', { stats: ['TotalEHP', 'MainDamage'], loadout: UNARMED, limit: 15 });
        expect(text).not.toContain('Invalid input');
        expect(text).toMatch(/^Ranked by Effective Hit Pool \(TotalEHP\); also measured: Main damage \(MainDamage\)\./m);
        expect(text).toMatch(/^Best swap \(weapon set 2\): /m);

        // The same call through the bridge: the reply passes its contract, and set 2's measured moves carry a clear
        // entry with no figures (an empty Lua table on the wire).
        const params: NodePowerParams = { stats: ['TotalEHP', 'MainDamage'], loadout: UNARMED, limit: 15 };
        const { value: r } = await f.session.run({ tool: 'test:tool-fixes-power', kind: 'read' }, (ctx) => ctx.client.nodePower(params));
        const two = (r.poolSwaps ?? []).find((p) => p.set === 2);
        expect(two).toBeDefined();
        const measured = two!.swaps.filter((s) => s.gain !== undefined);
        expect(measured.length).toBeGreaterThan(0);
        for (const s of measured) {
          expect(s.clear).toBeDefined();
          expect({ radius: s.clear!.radius, usesPerSecond: s.clear!.usesPerSecond }).toEqual({ radius: undefined, usesPerSecond: undefined });
        }
      },
      ENGINE_TIMEOUT,
    );
  });

  // -------------------------------------------------------------------------------------------------
  // B2

  it(
    'AC-K73 (B2): lookup_game_data {mode: "mechanic"} with no kind returns its hits, the Data/Misc.lua constant among them, for "Deflected" and "can_evade_spells"',
    async () => {
      const constants = await lua<{ deflected: string; evade: string }>(`
        local d = (build and build.data) or data
        return {
          deflected = string.format('%.14g', d.gameConstants.BasePercentDamageDeflected),
          evade = string.format('%.14g', d.characterConstants.can_evade_spells),
        }`);

      const evade = await ok('lookup_game_data', { mode: 'mechanic', query: 'can_evade_spells' });
      expect(evade).toMatch(/^1 hit: 0 gem, 0 unique, 0 passive, 0 mod, 0 essence, 0 base, 1 constant\.$/m);
      expect(evade).toContain(`[constant] character: can_evade_spells = ${constants.evade}`);

      // Its default cut lists the first 20 hits, constants ranked last, so its counts name the constant; with every
      // hit listed, the constant's line is there.
      const deflected = await ok('lookup_game_data', { mode: 'mechanic', query: 'Deflected' });
      expect(deflected).toMatch(/^\d+ hits: .*, 1 constant\.$/m);
      const total = Number(/^(\d+) hits: /m.exec(deflected)![1]);
      expect(total).toBeLessThanOrEqual(30);
      const all = await ok('lookup_game_data', { mode: 'mechanic', query: 'Deflected', max_results: 30 });
      expect(all).toContain(`[constant] game: BasePercentDamageDeflected = ${constants.deflected}`);
      expect(all).toContain(`Found ${total} hits`);
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // B4

  /** PoB's own value of each Appendix A field in the main output (null where it is unset or not finite). */
  const pobFields = () =>
    lua<Record<string, number | null>>(`
      local o = build.calcsTab.mainOutput
      local out = {}
      for _, k in ipairs(${JSON.stringify(APPENDIX_A_FIELDS).replace('[', '{').replace(/\]$/, '}')}) do
        local v = o[k]
        if type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge then out[k] = v end
      end
      return out`);

  it(
    'AC-K73 (B4): lua_get_stats {category: "defense"} on the golden build prints every Appendix A field PoB sets, each equal to PoB\'s output, and no other of them',
    async () => {
      await loadGolden();
      const text = await ok('lua_get_stats', { category: 'defense' });
      const shown = statLines(text);
      const pob = await pobFields();
      // The golden build: everything but the companion's life (it has no companion share) is set.
      expect(Object.keys(pob).sort()).toEqual(APPENDIX_A_FIELDS.filter((k) => k !== 'TotalCompanionLife').sort());
      for (const k of APPENDIX_A_FIELDS) {
        expect({ k, shown: shown.get(k) }).toEqual({ k, shown: k in pob ? String(pob[k]) : undefined });
      }
      // The pre-existing defence fields are still listed (the view shows its whole list, 58 fields).
      for (const k of ['Life', 'Armour', 'TotalEHP', 'PhysicalMaximumHitTaken', 'FireResist']) expect(shown.has(k)).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K73 (B4): on a companion fixture (Starkonja\'s Head and Wolf Pack on the golden build) lua_get_stats {category: "defense"} prints the companion\'s life and share, equal to PoB\'s output',
    async () => {
      await loadGolden();
      await ok('add_item', { item_text: STARKONJA, slot_name: 'Helmet' });
      const group = await ok('create_socket_group', { label: 'Companion' });
      const index = Number(/Socket group (\d+) created/.exec(group)![1]);
      await ok('add_gem', { group_index: index, gem_name: 'Wolf Pack' });

      const shown = statLines(await ok('lua_get_stats', { category: 'defense' }));
      const pob = await pobFields();
      expect(pob.CompanionAllyDamageMitigation).toBe(15);
      expect(pob.TotalCompanionLife).toBeGreaterThan(0);
      for (const k of ['TotalCompanionLife', 'CompanionAllyDamageMitigation']) {
        expect({ k, shown: shown.get(k) }).toEqual({ k, shown: String(pob[k]) });
      }
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // B5

  it(
    'AC-K73 (B5): check_model_coverage reports none of Hyrri\'s Ire\'s, Obsessive Rituals\' and Ceremonial Ablution\'s lines possibly unread; PoB reads each mod through a mod tag; the allowlist stays []',
    async () => {
      const item = await ok('check_model_coverage', { item_text: HYRRI });
      expect(item).not.toContain('possibly unread');
      expect(item).toContain(`[fully parsed] ${HYRRI_DOUBLED}`);
      expect(item).toMatch(/^Counts over 6 lines \(a joined line counts once\): 6 fully parsed\.$/m);

      const nodes = await ok('check_model_coverage', { nodes: ['Obsessive Rituals', 'Ceremonial Ablution'] });
      expect(nodes).not.toContain('possibly unread');
      expect(nodes).toContain('[fully parsed] Grants Skill: Sorcery Ward');
      expect(nodes).toContain("[fully parsed] Sorcery Ward's Barrier can also take Physical and Chaos Damage from Hits");

      // Why they are read, from PoB itself: the doubled line's MORE mod tests a Multiplier tag on the line's own
      // "Multiplier:EvasionDoubled"; Sorcery Ward's skill mods test Condition tags on the two conditions the nodes set.
      const pob = await lua<{ doubled: Json; ward: string[]; ablution: string[]; tags: string[] }>(`
        local list = modLib.parseMod(${JSON.stringify(HYRRI_DOUBLED)})
        local doubled = { names = {}, tags = {} }
        for _, mod in ipairs(list) do
          table.insert(doubled.names, mod.name)
          for _, tag in ipairs(mod) do
            if type(tag) == 'table' and tag.var then table.insert(doubled.tags, tag.type .. ':' .. tag.var) end
          end
        end
        local function names(line)
          local out = {}
          for _, mod in ipairs(modLib.parseMod(line)) do table.insert(out, mod.name) end
          return out
        end
        local tags, seen = {}, {}
        local skill = data.skills.SorceryWardPlayer
        local function fromList(l)
          for _, mod in ipairs(type(l) == 'table' and l or {}) do
            for _, tag in ipairs(mod) do
              if type(tag) == 'table' and tag.type == 'Condition' and tag.var and not seen[tag.var] then
                seen[tag.var] = true
                table.insert(tags, tag.var)
              end
            end
          end
        end
        fromList(skill.baseMods)
        for _, ss in ipairs(skill.statSets or {}) do
          fromList(ss.baseMods)
          for _, entry in pairs(ss.statMap or {}) do fromList(entry) end
        end
        table.sort(tags)
        return { doubled = doubled, ward = names('Grants Skill: Sorcery Ward'),
          ablution = names("Sorcery Ward's Barrier can also take Physical and Chaos Damage from Hits"), tags = tags }`);
      expect(pob.doubled.names).toEqual(expect.arrayContaining(['Evasion', 'Multiplier:EvasionDoubled']));
      expect(pob.doubled.tags).toContain('Multiplier:EvasionDoubled');
      expect(pob.ward).toContain('Condition:SorceryWard');
      expect(pob.ablution).toEqual(['Condition:CeremonialAblution']);
      expect(pob.tags).toEqual(expect.arrayContaining(['CeremonialAblution', 'SorceryWard']));

      expect(JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-hygiene-allowlist.json'), 'utf8'))).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );
});

describe('AC-K74 (WU-117): tool-calls.json holds an ok sample of each tool D-460 changes', () => {
  it('get_node_power with TotalEHP first, lookup_game_data on a constant with no kind, lua_get_stats defense, check_model_coverage, load_config_preset, and update_tree_delta and find_path_to_node past a weapon-set node', () => {
    const samples = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Array<{
      tool: string;
      args: Json;
      expect: string;
      setup?: Array<{ tool: string; args: Json }>;
    }>;
    const okSample = (tool: string, match: (args: Json, setup: Array<{ tool: string; args: Json }>) => boolean) =>
      samples.some((s) => s.tool === tool && s.expect === 'ok' && match(s.args, s.setup ?? []));
    expect(okSample('get_node_power', (a) => Array.isArray(a.stats) && a.stats[0] === 'TotalEHP')).toBe(true);
    expect(okSample('lookup_game_data', (a) => a.mode === 'mechanic' && a.kind === undefined && a.query === 'can_evade_spells')).toBe(true);
    expect(okSample('lua_get_stats', (a) => a.category === 'defense')).toBe(true);
    // check_model_coverage's ok samples are AC-K14's two (item_text and build), which run the changed scan.
    expect(okSample('check_model_coverage', () => true)).toBe(true);
    expect(okSample('load_config_preset', () => true)).toBe(true);
    const tagged = (setup: Array<{ tool: string; args: Json }>) => setup.some((s) => s.tool === 'set_tree_state' && s.args.weapon_set_nodes);
    expect(okSample('update_tree_delta', (_a, setup) => tagged(setup))).toBe(true);
    expect(okSample('find_path_to_node', (_a, setup) => tagged(setup))).toBe(true);
  });
});
