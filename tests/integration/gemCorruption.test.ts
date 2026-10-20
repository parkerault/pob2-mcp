/**
 * AC-E65 (WU-25, D-91): `set_gem_corruption`, engine-required and in process, on the golden build.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handlers, session,
 * bridge and luajit) over a private builds folder holding the golden build. The gem state is read from
 * the engine's own `export_build_xml` (PoB2's `<Gem corrupted corruptLevel>` save attributes); which
 * gems are supports, and which groups are granted by an item or a passive (`source`), comes from Lua
 * queries (`__test_eval`) against PoB's gem data; the effective level is the level PoB's calculation
 * gave each active skill (`activeEffect.level`, which CalcSetup raises by `corruptLevel`).
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { startTestServer } from '../helpers/server';
import { TOOL_META } from '../../src/server/toolMeta';

const ENGINE_TIMEOUT = 240_000;

interface ExportGem {
  group: number;
  gem: number;
  name: string;
  corrupted: string;
  corruptLevel: string;
}

/** Every `<Gem>` of the export's active skill set, with its 1-based group and gem index. */
function exportGems(xml: string): ExportGem[] {
  const skills = /<Skills\b[^>]*\bactiveSkillSet="(\d+)"[^>]*>([\s\S]*?)<\/Skills>/.exec(xml);
  expect(skills).not.toBeNull();
  const set = new RegExp(`<SkillSet\\b[^>]*\\bid="${skills![1]}"[^>]*>([\\s\\S]*?)</SkillSet>`).exec(skills![2]);
  expect(set).not.toBeNull();
  const attr = (tag: string, name: string): string => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
  const out: ExportGem[] = [];
  [...set![1].matchAll(/<Skill\b[^>]*>([\s\S]*?)<\/Skill>|<Skill\b[^>]*\/>/g)].forEach((skill, gi) => {
    [...(skill[1] ?? '').matchAll(/<Gem\b[^>]*?\/?>/g)].forEach((g, i) => {
      out.push({
        group: gi + 1,
        gem: i + 1,
        name: attr(g[0], 'nameSpec'),
        corrupted: attr(g[0], 'corrupted'),
        corruptLevel: attr(g[0], 'corruptLevel'),
      });
    });
  });
  return out;
}

const key = (g: { group: number; gem: number }) => `${g.group}:${g.gem}`;

interface LuaGem {
  group: number;
  gem: number;
  support: boolean;
  sourced: boolean;
}

/** PoB's view of every gem: support (its gem data's granted effect) and in a `source` (item/passive) group. */
const GEMS_QUERY = `
  local out = {}
  local set = build.skillsTab.skillSets[build.skillsTab.activeSkillSetId or 1]
  for gi, group in ipairs(set.socketGroupList) do
    for i, gem in ipairs(group.gemList) do
      local ge = gem.gemData and gem.gemData.grantedEffect or gem.grantedEffect
      table.insert(out, { group = gi, gem = i, support = ge ~= nil and ge.support == true, sourced = group.source ~= nil })
    end
  end
  return out`;

/** The effective level PoB's main calculation gave each gem's active skill, keyed "group:gem". */
const LEVELS_QUERY = `
  local index = {}
  local set = build.skillsTab.skillSets[build.skillsTab.activeSkillSetId or 1]
  for gi, group in ipairs(set.socketGroupList) do
    for i, gem in ipairs(group.gemList) do index[gem] = gi .. ':' .. i end
  end
  local out = {}
  for _, skill in ipairs(build.calcsTab.mainEnv.player.activeSkillList) do
    local src = skill.activeEffect and skill.activeEffect.srcInstance
    if src and index[src] then out[index[src]] = skill.activeEffect.level end
  end
  return out`;

engineDescribe('AC-E65: set_gem_corruption on the golden build (WU-25, D-91)', () => {
  let f: SessionFixture;

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:gem-corruption', kind: 'read' }, async (ctx) => {
      return (await ctx.client.request('__test_eval', { code })).result as T;
    });
    return value;
  }

  async function exported(): Promise<ExportGem[]> {
    return exportGems(await canonicalExport(f.session));
  }

  /** The gems a whole-build scope covers: not supports, not in an item/passive-granted group. */
  async function activeUserGems(): Promise<Set<string>> {
    const gems = await luaQuery<LuaGem[]>(GEMS_QUERY);
    return new Set(gems.filter((g) => !g.support && !g.sourced).map(key));
  }

  async function supportGems(): Promise<Set<string>> {
    const gems = await luaQuery<LuaGem[]>(GEMS_QUERY);
    return new Set(gems.filter((g) => g.support).map(key));
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
    'AC-E65 (one gem): group 1 gem 1 (an active gem) with state "corrupted" -> corrupted="true" corruptLevel="0" on that gem only, revision +1',
    async () => {
      const before = await exported();
      const target = before.find((g) => g.group === 1 && g.gem === 1)!;
      expect(target.name).toBe('Grenade');
      expect(target.corrupted).not.toBe('true');
      expect((await supportGems()).has('1:1')).toBe(false);
      const revision = f.session.revision;

      const out = await f.call('set_gem_corruption', { group_index: 1, gem_index: 1, state: 'corrupted' });
      expect(out.isError).toBe(false);
      expect(out.text).toContain('Corrupted');
      expect(out.text).toContain('group 1, gem 1');
      expect(f.session.revision).toBe(revision + 1);

      const after = await exported();
      expect(after).toHaveLength(before.length);
      const changed = after.filter((g, i) => JSON.stringify(g) !== JSON.stringify(before[i]));
      expect(changed).toEqual([{ ...target, corrupted: 'true', corruptLevel: '0' }]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E65 (whole build): "plus_one_level" with no indices -> every active skill gem in the user socket groups has corrupted="true" corruptLevel="1", every support gem is unchanged, and an active gem\'s effective level is 1 higher',
    async () => {
      const before = await exported();
      const active = await activeUserGems();
      const supports = await supportGems();
      expect(active.size).toBeGreaterThan(5);
      expect(supports.size).toBeGreaterThan(5);
      const levelsBefore = await luaQuery<Record<string, number>>(LEVELS_QUERY);
      const revision = f.session.revision;

      const out = await f.call('set_gem_corruption', { state: 'plus_one_level' });
      expect(out.isError).toBe(false);
      expect(out.text).toContain(`+1 to Gem Level on ${active.size} active skill gems`);
      expect(f.session.revision).toBe(revision + 1);

      const after = await exported();
      expect(after.map(key)).toEqual(before.map(key));
      after.forEach((g, i) => {
        if (active.has(key(g))) {
          expect({ gem: key(g), corrupted: g.corrupted, corruptLevel: g.corruptLevel }).toEqual({
            gem: key(g),
            corrupted: 'true',
            corruptLevel: '1',
          });
        } else {
          // Support gems (and gems of item/passive-granted groups) keep their attributes.
          expect(g).toEqual(before[i]);
        }
      });
      for (const s of supports) expect(after.find((g) => key(g) === s)).toEqual(before.find((g) => key(g) === s));

      // PoB's calculation: at least one corrupted active gem's effective level is 1 higher than before.
      const levelsAfter = await luaQuery<Record<string, number>>(LEVELS_QUERY);
      const raised = [...active].filter((k) => levelsBefore[k] !== undefined && levelsAfter[k] === levelsBefore[k] + 1);
      expect(raised.length).toBeGreaterThanOrEqual(1);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E65 (explicit support gem): naming a support gem -> isError saying support gems can\'t be corrupted; the export and revision are unchanged',
    async () => {
      expect((await supportGems()).has('1:2')).toBe(true);
      const before = await canonicalExport(f.session);
      const revision = f.session.revision;

      const out = await f.call('set_gem_corruption', { group_index: 1, gem_index: 2, state: 'corrupted' });
      expect(out.isError).toBe(true);
      expect(out.text).toContain("support gems can't be corrupted");

      expect(f.session.revision).toBe(revision);
      expect(await canonicalExport(f.session)).toBe(before);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E65 (support gem that also grants a triggered skill): the group and whole-build scopes leave Fiery Death unchanged, as naming it explicitly is refused',
    async () => {
      // Fiery Death is a support gem (its primary granted effect is a support) that also grants a triggered
      // non-support skill: the trap where "any non-support granted effect" would count it as active.
      const fieryDeath = await luaQuery<{ found: boolean; nonSupportEffects: number }>(`
        local gems = (build.data and build.data.gems) or data.gems
        for _, gemData in pairs(gems) do
          if gemData.name == 'Fiery Death' and gemData.grantedEffect and gemData.grantedEffect.support then
            local n = 0
            for _, ge in ipairs(gemData.grantedEffectList or {}) do if not ge.support then n = n + 1 end end
            return { found = true, nonSupportEffects = n }
          end
        end
        return { found = false, nonSupportEffects = 0 }`);
      expect(fieryDeath.found).toBe(true);
      expect(fieryDeath.nonSupportEffects).toBeGreaterThanOrEqual(1);

      const created = await f.call('create_socket_group', { label: 'fiery death' });
      expect(created.isError).toBe(false);
      const group = Number(/Socket group (\d+) created/.exec(created.text)![1]);
      expect((await f.call('add_gem', { group_index: group, gem_name: 'Fireball' })).isError).toBe(false);
      expect((await f.call('add_gem', { group_index: group, gem_name: 'Fiery Death' })).isError).toBe(false);
      const supports = await supportGems();
      expect(supports.has(`${group}:1`)).toBe(false);
      expect(supports.has(`${group}:2`)).toBe(true);
      const initial = await exported();
      const fd = initial.find((g) => g.group === group && g.gem === 2)!;
      expect(fd.name).toBe('Fiery Death');
      expect(fd.corrupted).not.toBe('true');
      const supportsBefore = initial.filter((g) => supports.has(key(g)));

      const explicit = await f.call('set_gem_corruption', { group_index: group, gem_index: 2, state: 'plus_one_level' });
      expect(explicit.isError).toBe(true);
      expect(explicit.text).toContain("support gems can't be corrupted");

      const byGroup = await f.call('set_gem_corruption', { group_index: group, state: 'plus_one_level' });
      expect(byGroup.isError).toBe(false);
      expect(byGroup.text).toContain('on 1 active skill gem ');
      expect(byGroup.text).not.toContain('Fiery Death');
      let after = await exported();
      expect(after.find((g) => g.group === group && g.gem === 1)).toMatchObject({ corrupted: 'true', corruptLevel: '1' });
      expect(after.filter((g) => supports.has(key(g)))).toEqual(supportsBefore);

      const whole = await f.call('set_gem_corruption', { state: 'minus_one_level' });
      expect(whole.isError).toBe(false);
      expect(whole.text).not.toContain('Fiery Death');
      after = await exported();
      expect(after.find((g) => g.group === group && g.gem === 1)).toMatchObject({ corrupted: 'true', corruptLevel: '-1' });
      expect(after.filter((g) => supports.has(key(g)))).toEqual(supportsBefore);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E65 (revert): "not_corrupted" on the build -> no gem has corrupted="true"',
    async () => {
      // The golden build has a corrupted gem already (Explosive Grenade); corrupt the rest too first.
      expect((await exported()).some((g) => g.corrupted === 'true')).toBe(true);
      expect((await f.call('set_gem_corruption', { state: 'minus_one_level' })).isError).toBe(false);
      expect((await exported()).filter((g) => g.corrupted === 'true').length).toBeGreaterThan(5);

      const out = await f.call('set_gem_corruption', { state: 'not_corrupted' });
      expect(out.isError).toBe(false);
      expect(out.text).toContain('Not Corrupted');
      const after = await exported();
      expect(after.length).toBeGreaterThan(5);
      expect(after.filter((g) => g.corrupted === 'true')).toEqual([]);
      for (const g of after.filter((x) => x.corrupted === 'false')) expect(g.corruptLevel).toBe('0');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E65 (persistence): the state survives lua_save_build to the temp builds dir and a reload',
    async () => {
      const active = await activeUserGems();
      expect((await f.call('set_gem_corruption', { state: 'plus_one_level' })).isError).toBe(false);
      expect((await f.call('set_gem_corruption', { group_index: 1, gem_index: 1, state: 'minus_one_level' })).isError).toBe(false);
      const expected = await exported();
      const corrupted = (gems: ExportGem[]) =>
        gems.filter((g) => active.has(key(g))).map((g) => ({ gem: key(g), corrupted: g.corrupted, corruptLevel: g.corruptLevel }));
      expect(corrupted(expected).find((g) => g.gem === '1:1')).toEqual({ gem: '1:1', corrupted: 'true', corruptLevel: '-1' });
      expect(corrupted(expected).filter((g) => g.corruptLevel === '1')).toHaveLength(active.size - 1);

      const saved = await f.call('lua_save_build', { build_name: 'corrupted' });
      expect(saved.isError).toBe(false);
      const file = path.join(f.builds, 'corrupted.xml');
      expect(corrupted(exportGems(fs.readFileSync(file, 'utf8')))).toEqual(corrupted(expected));

      // Away to the golden build and back: the saved file brings the state back into the engine.
      expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
      expect(corrupted(await exported())).not.toEqual(corrupted(expected));
      expect((await f.call('lua_load_build', { build_name: 'corrupted.xml' })).isError).toBe(false);
      expect(corrupted(await exported())).toEqual(corrupted(expected));
    },
    ENGINE_TIMEOUT,
  );
});

describe('AC-E65 (tool counts): tools/list after D-91', () => {
  it('AC-E65: tools/list has 85 tools with set_gem_corruption (engine kind mutate), or 84 with POE_NINJA_DISABLED (counts after WU-31 lookup_game_data, WU-40 encode_build_code, WU-32 check_model_coverage, WU-36 set_tree_state, WU-35 manage_sets, WU-41 compile_plan and guide_run, and WU-92 get_node_power)', async () => {
    const all = await startTestServer({ env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined } });
    try {
      const listed = (await all.client.listTools()).tools;
      expect(listed).toHaveLength(85);
      const tool = listed.find((t) => t.name === 'set_gem_corruption');
      expect(tool).toBeDefined();
      expect(TOOL_META.set_gem_corruption).toEqual({ engine: 'mutate', group: 'core' });
      expect((tool!.inputSchema as unknown as { properties: { state: { enum: string[] } } }).properties.state.enum).toEqual([
        'not_corrupted',
        'corrupted',
        'plus_one_level',
        'minus_one_level',
      ]);
    } finally {
      await all.close();
    }
    const noNinja = await startTestServer({ env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: 'true' } });
    try {
      const listed = (await noNinja.client.listTools()).tools.map((t) => t.name);
      expect(listed).toHaveLength(84);
      expect(listed).toContain('set_gem_corruption');
      expect(listed).not.toContain('get_currency_rates');
    } finally {
      await noNinja.close();
    }
  });
});
