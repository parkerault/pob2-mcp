/**
 * M1 (WU-33): AC-K15…AC-K19, in process and engine-required, on the golden build.
 *
 * - C-44: `set_main_skill`'s `skill_part` selects PoB2's stat set of the main active skill,
 *   `srcInstance.statSet[<granted effect id>]`, which the build XML keeps as `<StatSetIndex>`; it never
 *   writes PoE1's `skillPart`. An index outside 1…n is an error naming n and the labels.
 * - C-45: `lua_get_stats {breakdown:true}` measures the offense fields per active skill and per stat set
 *   of one socket group, then restores the exact prior state (D-176).
 *
 * The real server runs in process (`startSessionFixture`: real router, handlers, session, bridge and
 * luajit). Independent checks are Lua queries (`__test_eval`) against PoB's own state and data
 * (`grantedEffect.statSets`, `srcInstance.statSet`, `mainSocketGroup`, …) and the engine's own export.
 * G is the golden socket group whose active skill is Gas Grenade (Impact, Poison Cloud, Explosion),
 * found by a Lua query; it isn't the main group (11, Explosive Grenade).
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { OFFENSE_STAT_FIELDS } from '../../src/handlers/luaHandlers';

const ENGINE_TIMEOUT = 240_000;
const GOLDEN_MAIN_GROUP = 11;
const GOLDEN_COMBINED_DPS = 104489.78;

interface GasGrenade {
  group: number;
  grantedEffectId: string;
  labels: string[];
}

/** The group whose enabled, non-support gem grants Gas Grenade, and that skill's stat-set labels. */
const GAS_GRENADE_QUERY = `
  for gi, g in ipairs(build.skillsTab.socketGroupList) do
    for _, gem in ipairs(g.gemList) do
      local ge = gem.gemData and gem.gemData.grantedEffect
      if ge and not ge.support and ge.name == 'Gas Grenade' then
        local labels = {}
        for i, set in ipairs(ge.statSets) do labels[i] = set.label end
        return { group = gi, grantedEffectId = ge.id, labels = labels }
      end
    end
  end`;

/** The main active skill of group `g`: its granted effect's stat-set choice, and `skillPart`. */
const mainSkillChoiceQuery = (group: number, id: string) => `
  local g = build.skillsTab.socketGroupList[${group}]
  local active = g.displaySkillList[g.mainActiveSkill or 1]
  local src = active.activeEffect.srcInstance
  return {
    mainSocketGroup = build.mainSocketGroup,
    grantedEffectId = active.activeEffect.grantedEffect.id,
    statSet = src.statSet and src.statSet['${id}'] or 'nil',
    skillPart = src.skillPart == nil and 'nil' or src.skillPart,
  }`;

/**
 * The selection state C-45 restores (D-176): the main group, the calcs tab's group, every group's
 * main active skill, and every gem's stat-set choices ("nil" when the gem has no `statSet` table).
 */
const SELECTION_STATE_QUERY = `
  local function str(v) if v == nil then return 'nil' end return tostring(v) end
  local groups = {}
  for gi, g in ipairs(build.skillsTab.socketGroupList) do
    local gems = {}
    for i, gem in ipairs(g.gemList) do
      if gem.statSet == nil then
        gems[i] = 'nil'
      else
        local keys = {}
        for k, v in pairs(gem.statSet) do table.insert(keys, tostring(k) .. '=' .. tostring(v)) end
        table.sort(keys)
        gems[i] = '{' .. table.concat(keys, ',') .. '}'
      end
    end
    groups[gi] = { mainActiveSkill = str(g.mainActiveSkill), mainActiveSkillCalcs = str(g.mainActiveSkillCalcs), gems = table.concat(gems, ';') }
  end
  return { mainSocketGroup = str(build.mainSocketGroup), skillNumber = str(build.calcsTab.input.skill_number), groups = groups }`;

/** The `<Gem>` element (with its children) whose nameSpec is `name`, from an export. */
function gemElement(xml: string, name: string): string {
  const m = new RegExp(`<Gem\\b[^>]*\\bnameSpec="${name}"[^>]*?(?:/>|>[\\s\\S]*?</Gem>)`).exec(xml);
  expect(m).not.toBeNull();
  return m![0];
}

/** Every `<StatSetIndex>` in an XML fragment, as `{grantedEffect, index}` (PoB writes its attributes in pairs() order). */
function statSetIndexes(xml: string): Array<{ grantedEffect: string; index: string }> {
  return [...xml.matchAll(/<StatSetIndex\b[^>]*\/?>/g)].map(([tag]) => ({
    grantedEffect: /\bgrantedEffect="([^"]*)"/.exec(tag)?.[1] ?? '',
    index: /\bindex="([^"]*)"/.exec(tag)?.[1] ?? '',
  }));
}

/** `<Field>: <value>` stat lines of a `lua_get_stats` view (the header and tree-version lines aside). */
function statLines(text: string): string[] {
  return text.split('\n').filter((l) => /^[A-Za-z]+: /.test(l));
}

interface Block {
  heading: string;
  lines: string[];
}

/** The `## ` blocks of a breakdown view, each with its lines up to the next blank line. */
function blocks(text: string): Block[] {
  return text
    .split('\n## ')
    .slice(1)
    .map((chunk) => {
      const [heading, ...rest] = chunk.split('\n');
      const lines: string[] = [];
      for (const l of rest) {
        if (l.trim() === '') break;
        lines.push(l);
      }
      return { heading: `## ${heading}`, lines };
    });
}

function combinedDps(text: string): number {
  const m = /^CombinedDPS: ([-\d.e+]+)$/m.exec(text);
  expect(m).not.toBeNull();
  return Number(m![1]);
}

engineDescribe('M1 (WU-33): the stat-set fix (C-44) and the per-skill breakdown (C-45)', () => {
  let f: SessionFixture;
  let gas: GasGrenade;

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:skill-breakdown', kind: 'read' }, async (ctx) => {
      return (await ctx.client.request('__test_eval', { code })).result as T;
    });
    return value;
  }

  /** Load the golden build afresh (no test writes to `grenadator.xml`; saves go under other names). */
  async function freshGolden(): Promise<void> {
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
  }

  async function ok(tool: string, args: Record<string, unknown> = {}): Promise<string> {
    const out = await f.call(tool, args);
    expect({ tool, args, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, args, isError: false, text: '' });
    return out.text;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    await freshGolden();
    gas = await luaQuery<GasGrenade>(GAS_GRENADE_QUERY);
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  it('G is the Gas Grenade group, it is not the main group, and PoB lists its stat sets as Impact, Poison Cloud, Explosion', () => {
    expect(gas.group).toBeGreaterThan(0);
    expect(gas.group).not.toBe(GOLDEN_MAIN_GROUP);
    expect(gas.labels).toEqual(['Impact', 'Poison Cloud', 'Explosion']);
  });

  describe('AC-K15 (C-44 stat set)', () => {
    it(
      'AC-K15 (a)-(d): set_main_skill {group_index:G, skill_part:3} writes srcInstance.statSet[<id>] = 3 (never skillPart), the export keeps <StatSetIndex index="3">, the output names Explosion, and all of it survives save and reload',
      async () => {
        await freshGolden();
        const text = await ok('set_main_skill', { group_index: gas.group, skill_part: 3 });
        // (c) the output names the stat set's label.
        expect(text).toContain('Explosion');

        const check = async () => {
          // (a) PoB2's stat-set choice on the main active skill, and no PoE1 skillPart.
          const choice = await luaQuery<Record<string, unknown>>(mainSkillChoiceQuery(gas.group, gas.grantedEffectId));
          expect(choice).toEqual({ mainSocketGroup: gas.group, grantedEffectId: gas.grantedEffectId, statSet: 3, skillPart: 'nil' });
          // (b) the export keeps it on that gem.
          const gem = gemElement(await canonicalExport(f.session), 'Gas Grenade');
          expect(statSetIndexes(gem)).toEqual([{ grantedEffect: gas.grantedEffectId, index: '3' }]);
        };
        await check();

        // (d) save under a new name, load it back: (a) and (b) still hold.
        await ok('lua_save_build', { build_name: 'wu33-statset.xml' });
        await ok('lua_load_build', { build_name: 'wu33-statset.xml' });
        expect(statSetIndexes(gemElement(fs.readFileSync(path.join(f.builds, 'wu33-statset.xml'), 'utf8'), 'Gas Grenade'))).toEqual([
          { grantedEffect: gas.grantedEffectId, index: '3' },
        ]);
        await check();
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K15 (e): lua_get_stats {category:"offense"} after skill_part 3 differs from the skill_part 1 result in at least one field',
      async () => {
        await freshGolden();
        await ok('set_main_skill', { group_index: gas.group, skill_part: 1 });
        const impact = statLines(await ok('lua_get_stats', { category: 'offense' }));
        await ok('set_main_skill', { group_index: gas.group, skill_part: 3 });
        const explosion = statLines(await ok('lua_get_stats', { category: 'offense' }));
        expect(impact.length).toBeGreaterThan(0);
        expect(explosion.length).toBeGreaterThan(0);
        expect([...explosion].sort()).not.toEqual([...impact].sort());
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('AC-K16 (C-44 errors; regression)', () => {
    it.each([0, 4])(
      'AC-K16: skill_part %d on G is an error naming the 3 stat sets and their labels; the export and revision are unchanged',
      async (part) => {
        await freshGolden();
        const before = await canonicalExport(f.session);
        const revision = f.session.revision;
        const out = await f.call('set_main_skill', { group_index: gas.group, skill_part: part });
        expect(out.isError).toBe(true);
        expect(out.text).toContain('3 stat sets');
        for (const label of gas.labels) expect(out.text).toContain(label);
        expect(f.session.revision).toBe(revision);
        expect(await canonicalExport(f.session)).toBe(before);
        // The selection itself is untouched too.
        expect(await luaQuery<number>('return build.mainSocketGroup')).toBe(GOLDEN_MAIN_GROUP);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K16: set_main_skill {group_index:11} (the golden main group) adds no <StatSetIndex>, and CombinedDPS stays 104489.78',
      async () => {
        await freshGolden();
        expect(await canonicalExport(f.session)).not.toContain('<StatSetIndex');
        await ok('set_main_skill', { group_index: GOLDEN_MAIN_GROUP });
        expect(await canonicalExport(f.session)).not.toContain('<StatSetIndex');
        expect(combinedDps(await ok('lua_get_stats'))).toBeCloseTo(GOLDEN_COMBINED_DPS, 2);
      },
      ENGINE_TIMEOUT,
    );

    it('AC-K16: the set_main_skill schema lists skill_part, and no Lua under pob-api/API/ writes srcInstance.skillPart', async () => {
      const { tools } = await f.server.client.listTools();
      const schema = tools.find((t) => t.name === 'set_main_skill')?.inputSchema as { properties?: Record<string, { type?: string; description?: string }> };
      expect(schema?.properties?.skill_part?.type).toBe('number');
      expect(schema?.properties?.skill_part?.description ?? '').toMatch(/stat set/);

      const dir = path.resolve(__dirname, '..', '..', 'pob-api', 'API');
      const writers = fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.lua'))
        .flatMap((name) =>
          fs
            .readFileSync(path.join(dir, name), 'utf8')
            .split('\n')
            .map((line, i) => ({ where: `${name}:${i + 1}`, line }))
            .filter(({ line }) => /\bskillPart\s*=(?!=)/.test(line.replace(/--.*$/, ''))),
        );
      expect(writers).toEqual([]);
    });
  });

  describe('AC-K17 (C-45 values)', () => {
    it(
      'AC-K17: lua_get_stats {breakdown:true, group_index:G} shows the Impact, Poison Cloud and Explosion blocks in order; block i equals the non-zero offense lines after set_main_skill {group_index:G, skill_part:i} on a fresh load',
      async () => {
        await freshGolden();
        const view = await ok('lua_get_stats', { breakdown: true, group_index: gas.group });
        const got = blocks(view);
        expect(got.map((b) => b.heading)).toEqual(gas.labels.map((label, i) => `## Gas Grenade / ${label} [skill_part ${i + 1}]`));

        for (let i = 1; i <= gas.labels.length; i++) {
          await freshGolden();
          await ok('set_main_skill', { group_index: gas.group, skill_part: i });
          const offense = statLines(await ok('lua_get_stats', { category: 'offense' }));
          const block = got[i - 1].lines;
          expect(block.length).toBeGreaterThan(0);
          expect([...block].sort()).toEqual([...offense].sort());
          // Listed in the offense list's order.
          const order = block.map((l) => OFFENSE_STAT_FIELDS.indexOf(l.slice(0, l.indexOf(':'))));
          expect(order.every((n) => n >= 0)).toBe(true);
          expect([...order].sort((a, b) => a - b)).toEqual(order);
        }
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('AC-K18 (C-45 exact restore, D-176)', () => {
    /** Breaks G down and checks that nothing it restores has moved. */
    async function breakdownLeavesEverything(): Promise<void> {
      const state = await luaQuery<Record<string, unknown>>(SELECTION_STATE_QUERY);
      const exportBefore = await canonicalExport(f.session);
      const revision = f.session.revision;
      const offenseBefore = await ok('lua_get_stats', { category: 'offense' });

      const view = await ok('lua_get_stats', { breakdown: true, group_index: gas.group });
      expect(blocks(view)).toHaveLength(3);

      expect(f.session.revision).toBe(revision);
      expect(await canonicalExport(f.session)).toBe(exportBefore);
      expect(await ok('lua_get_stats', { category: 'offense' })).toBe(offenseBefore);
      expect(await luaQuery<Record<string, unknown>>(SELECTION_STATE_QUERY)).toEqual(state);
    }

    /** G's gems' stat-set choices, as SELECTION_STATE_QUERY renders them. */
    async function gasGems(): Promise<string[]> {
      const state = await luaQuery<{ groups: Array<{ gems: string }> }>(SELECTION_STATE_QUERY);
      return state.groups[gas.group - 1].gems.split(';');
    }

    it(
      'AC-K18: on the golden build, the canonical export, revision, the offense view and the selection state (mainSocketGroup, every mainActiveSkill, every srcInstance.statSet, skill_number) are unchanged',
      async () => {
        await freshGolden();
        await breakdownLeavesEverything();
      },
      ENGINE_TIMEOUT,
    );

    it(
      "AC-K18: a prior non-default choice on G (stat set 2, then the main group back to 11) is kept, and a Gas Grenade gem with no statSet table keeps none (nil stays nil)",
      async () => {
        await freshGolden();
        await ok('set_main_skill', { group_index: gas.group, skill_part: 2 });
        await ok('set_main_skill', { group_index: GOLDEN_MAIN_GROUP });
        expect((await gasGems())[0]).toBe(`{${gas.grantedEffectId}=2}`);
        await breakdownLeavesEverything();
        expect((await gasGems())[0]).toBe(`{${gas.grantedEffectId}=2}`);

        await freshGolden();
        await luaQuery(`
          for _, gem in ipairs(build.skillsTab.socketGroupList[${gas.group}].gemList) do
            if gem.gemData and gem.gemData.grantedEffect.id == '${gas.grantedEffectId}' then gem.statSet = nil end
          end
          return true`);
        expect((await gasGems())[0]).toBe('nil');
        await breakdownLeavesEverything();
        expect((await gasGems())[0]).toBe('nil');
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('AC-K19 (C-45 bound and errors; regression)', () => {
    it(
      "AC-K19: the golden main group's breakdown is at most 5000 characters, with no truncation notice",
      async () => {
        await freshGolden();
        const view = await ok('lua_get_stats', { breakdown: true });
        expect(view).toContain(`socket group ${GOLDEN_MAIN_GROUP}`);
        expect(blocks(view).length).toBeGreaterThan(0);
        expect(blocks(view)[0].heading).toMatch(/^## Explosive Grenade \/ .+ \[skill_part 1\]$/);
        expect(view.length).toBeLessThanOrEqual(5000);
        expect(view).not.toContain('[Response truncated');
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K19: {breakdown:true, group_index:999} and {breakdown:true, category:"defense"} are errors; a group without an active skill gets a non-error note',
      async () => {
        await freshGolden();
        const past = await f.call('lua_get_stats', { breakdown: true, group_index: 999 });
        expect(past.isError).toBe(true);
        expect(past.text).toMatch(/socket group 999 does not exist/);
        const defense = await f.call('lua_get_stats', { breakdown: true, category: 'defense' });
        expect(defense.isError).toBe(true);
        expect(defense.text).toMatch(/offense/);

        await ok('create_socket_group', { label: 'WU-33 empty group' });
        const groups = await luaQuery<number>('return #build.skillsTab.socketGroupList');
        const empty = await f.call('lua_get_stats', { breakdown: true, group_index: groups });
        expect(empty.isError).toBe(false);
        expect(empty.text).toMatch(/has no active skill/);
        expect(empty.text).not.toContain('\n## ');
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K19: lua_get_stats {} and {category:"offense"} contain no "## " block',
      async () => {
        await freshGolden();
        for (const args of [{}, { category: 'offense' }]) {
          const text = await ok('lua_get_stats', args);
          expect(text).not.toMatch(/^## /m);
          expect(statLines(text).length).toBeGreaterThan(0);
        }
      },
      ENGINE_TIMEOUT,
    );

    it(
      'C-45 heading: every block of the Mirage Archer group is headed "## <skill> / <stat set label> [skill_part <i>]" with a non-empty skill; its hidden effect (PoB name "") takes the gem\'s name',
      async () => {
        await freshGolden();
        // PoB's own view of the group: its display skills, with each granted effect's name and the gem's name.
        const mirage = await luaQuery<{ group: number; skills: Array<{ name: string; nameSpec: string; id: string }> }>(`
          for gi, g in ipairs(build.skillsTab.socketGroupList) do
            for _, gem in ipairs(g.gemList) do
              local ge = gem.gemData and gem.gemData.grantedEffect
              if ge and ge.name == 'Mirage Archer' then
                local skills = {}
                for i, s in ipairs(g.displaySkillList) do
                  skills[i] = { name = s.activeEffect.grantedEffect.name, nameSpec = s.activeEffect.srcInstance.nameSpec, id = s.activeEffect.grantedEffect.id }
                end
                return { group = gi, skills = skills }
              end
            end
          end`);
        const hidden = mirage.skills.find((s) => s.name === '');
        expect(hidden).toBeDefined();

        const view = await ok('lua_get_stats', { breakdown: true, group_index: mirage.group });
        const headings = blocks(view).map((b) => b.heading);
        expect(headings.length).toBeGreaterThan(0);
        for (const heading of headings) expect(heading).toMatch(/^## \S.* \/ \S.* \[skill_part \d+\]$/);
        expect(headings.some((h) => h.startsWith(`## ${hidden!.nameSpec} / `))).toBe(true);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'C-45/C-44 errors: on a build with no socket groups, the breakdown and set_main_skill say "the build has no socket groups" (no "nil" index)',
      async () => {
        await ok('lua_new_build', { class_name: 'Witch' });
        expect(await luaQuery<number>('return #build.skillsTab.socketGroupList')).toBe(0);
        for (const [tool, args] of [
          ['lua_get_stats', { breakdown: true }],
          ['set_main_skill', { group_index: 1 }],
        ] as const) {
          const out = await f.call(tool, args);
          expect(out.isError).toBe(true);
          expect(out.text).toContain('the build has no socket groups');
          expect(out.text).not.toContain('nil');
        }
      },
      ENGINE_TIMEOUT,
    );
  });
});
