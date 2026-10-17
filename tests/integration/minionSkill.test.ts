/**
 * M-17 (WU-77): AC-K69 and AC-K70, in process and engine-required, on the golden build.
 *
 * - D-376: PoB keeps a minion's numbers in the nested `mainOutput.Minion`; a requested `Minion<Field>` the
 *   output lacks reads `Minion[<Field>]`, so `lua_get_stats`' minion fields are real.
 * - D-377: `set_main_skill`'s `minion_skill` and `minion_stat_set` select, by name, the skill a group's summon's
 *   minion uses, writing PoB's own fields (`skillMinionSkill`, `skillMinionSkillCalcs` and the stat-set lookups
 *   `skillMinionSkillStatSetIndexLookup[Calcs]`); a refusal changes nothing; `get_skill_setup` marks the selected
 *   skill; the stats breakdown names it and restores the selection and the lookups exactly (D-176).
 *
 * The real server runs in process (`startSessionFixture`: real router, handlers, session, bridge and luajit).
 * Independent checks are Lua queries (`__test_eval`) of PoB's own state: the summon's `minion.activeSkillList`
 * and `minion.mainSkill`, its gem's fields, `mainOutput.Minion`, and the engine's own export. The summon is the
 * golden build's Pounce group (`Pounce`, `Predator's Mark`, `Summon Wolf`), whose Wolf Companion casts Basic
 * Attack and Leap Slam, found by a Lua query; the group without a minion is the Gas Grenade group.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';

const ENGINE_TIMEOUT = 240_000;
const GOLDEN_MAIN_GROUP = 11;

interface Summon {
  group: number;
  /** The summon's index among the group's active skills. */
  active: number;
  summonId: string;
  minion: string;
  skills: string[];
  gasGroup: number;
}

/** The group with a summon (an active skill with a minion), PoB's minion skill list, and the Gas Grenade group. */
const SUMMON_QUERY = `
  local out = {}
  for gi, g in ipairs(build.skillsTab.socketGroupList) do
    for i, s in ipairs(g.displaySkillList or {}) do
      if s.minion and s.minion.activeSkillList then
        local skills = {}
        for j, ms in ipairs(s.minion.activeSkillList) do skills[j] = ms.activeEffect.grantedEffect.name end
        out.group, out.active, out.summonId = gi, i, s.activeEffect.grantedEffect.id
        out.minion, out.skills = s.minion.minionData.name, skills
      end
      if s.activeEffect.grantedEffect.name == 'Gas Grenade' then out.gasGroup = gi end
    end
  end
  return out`;

/** PoB's own minion state of the summon at group g, active skill a, and the main output's Minion.TotalDPS. */
const minionStateQuery = (g: number, a: number, id: string) => `
  local function str(v) if v == nil then return 'nil' end return tostring(v) end
  local function lookup(t)
    if t == nil then return 'nil' end
    local inner = t['${id}']
    if inner == nil then return '{}' end
    local keys = {}
    for k, v in pairs(inner) do table.insert(keys, tostring(k) .. '=' .. tostring(v)) end
    table.sort(keys)
    return '{' .. table.concat(keys, ',') .. '}'
  end
  local group = build.skillsTab.socketGroupList[${g}]
  local s = group.displaySkillList[${a}]
  local src = s.activeEffect.srcInstance
  local out = build.calcsTab.mainOutput
  return {
    mainSocketGroup = build.mainSocketGroup,
    mainActiveSkill = group.mainActiveSkill,
    selected = s.minion.mainSkill.activeEffect.grantedEffect.name,
    statSet = s.minion.mainSkill.activeEffect.statSet.index,
    skillMinionSkill = str(src.skillMinionSkill),
    skillMinionSkillCalcs = str(src.skillMinionSkillCalcs),
    lookup = lookup(src.skillMinionSkillStatSetIndexLookup),
    lookupCalcs = lookup(src.skillMinionSkillStatSetIndexLookupCalcs),
    minionTotalDPS = out.Minion and out.Minion.TotalDPS or 'nil',
  }`;

/**
 * The selection state the breakdown restores (D-176), with the minion's: the main group, the calcs tab's group,
 * every group's main active skills, and per gem its stat-set choices, `skillMinionSkill[Calcs]` and both minion
 * stat-set lookups ("nil" when a field or table is absent).
 */
const SELECTION_STATE_QUERY = `
  local function str(v) if v == nil then return 'nil' end return tostring(v) end
  local function flat(t)
    if t == nil then return 'nil' end
    local keys = {}
    for k, v in pairs(t) do
      if type(v) == 'table' then table.insert(keys, tostring(k) .. '=' .. (function()
        local inner = {}
        for i, x in pairs(v) do table.insert(inner, tostring(i) .. ':' .. tostring(x)) end
        table.sort(inner)
        return '[' .. table.concat(inner, ',') .. ']'
      end)()) else table.insert(keys, tostring(k) .. '=' .. tostring(v)) end
    end
    table.sort(keys)
    return '{' .. table.concat(keys, ',') .. '}'
  end
  local groups = {}
  for gi, g in ipairs(build.skillsTab.socketGroupList) do
    local gems = {}
    for i, gem in ipairs(g.gemList) do
      gems[i] = table.concat({ flat(gem.statSet), str(gem.skillMinionSkill), str(gem.skillMinionSkillCalcs),
        flat(gem.skillMinionSkillStatSetIndexLookup), flat(gem.skillMinionSkillStatSetIndexLookupCalcs) }, '|')
    end
    groups[gi] = { mainActiveSkill = str(g.mainActiveSkill), mainActiveSkillCalcs = str(g.mainActiveSkillCalcs), gems = table.concat(gems, ';') }
  end
  return { mainSocketGroup = str(build.mainSocketGroup), skillNumber = str(build.calcsTab.input.skill_number), groups = groups }`;

/** `<Field>: <value>` stat lines of a `lua_get_stats` view. */
function statLines(text: string): string[] {
  return text.split('\n').filter((l) => /^[A-Za-z]+: /.test(l));
}

/** The number a `lua_get_stats` view prints for `field`, or undefined when it doesn't list it. */
function statOf(text: string, field: string): number | undefined {
  const m = new RegExp(`^${field}: ([-\\d.e+]+)$`, 'm').exec(text);
  return m ? Number(m[1]) : undefined;
}

/** The `## ` blocks of a breakdown view, each with its lines up to the next blank line. */
function blocks(text: string): Array<{ heading: string; lines: string[] }> {
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

/** The `<Gem>` element (with its children) whose nameSpec is `name`, from an export. */
function gemElement(xml: string, name: string): string {
  const m = new RegExp(`<Gem\\b[^>]*\\bnameSpec="${name}"[^>]*?(?:/>|>[\\s\\S]*?</Gem>)`).exec(xml);
  expect(m).not.toBeNull();
  return m![0];
}

engineDescribe('M-17 (WU-77): a minion\'s numbers (D-376) and its selected skill (D-377)', () => {
  let f: SessionFixture;
  let wolf: Summon;

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:minion-skill', kind: 'read' }, async (ctx) => {
      return (await ctx.client.request('__test_eval', { code })).result as T;
    });
    return value;
  }

  async function freshGolden(): Promise<void> {
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
  }

  async function ok(tool: string, args: Record<string, unknown> = {}): Promise<string> {
    const out = await f.call(tool, args);
    expect({ tool, args, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, args, isError: false, text: '' });
    return out.text;
  }

  const minionState = () => luaQuery<Record<string, unknown>>(minionStateQuery(wolf.group, wolf.active, wolf.summonId));

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    await freshGolden();
    wolf = await luaQuery<Summon>(SUMMON_QUERY);
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  it('the golden build has one summon: Pounce\'s Summon Wolf, whose Wolf Companion casts Basic Attack and Leap Slam; it is not the main group', () => {
    expect(wolf).toMatchObject({ minion: 'Wolf Companion', skills: ['Basic Attack', 'Leap Slam'] });
    expect(wolf.group).not.toBe(GOLDEN_MAIN_GROUP);
    expect(wolf.gasGroup).toBeGreaterThan(0);
  });

  describe('AC-K69 (D-376): a minion\'s numbers are readable', () => {
    it(
      'AC-K69: with the summon as the main skill, lua_get_stats {category:"offense"} shows MinionTotalDPS above 0, equal to PoB\'s Minion.TotalDPS, for each of its minion\'s skills',
      async () => {
        await freshGolden();
        // Without a summon as the main skill there is no minion output and no minion field.
        expect(statOf(await ok('lua_get_stats', { category: 'offense' }), 'MinionTotalDPS')).toBeUndefined();

        await ok('set_main_skill', { group_index: wolf.group, active_skill_index: wolf.active });
        const byDefault = await minionState();
        expect(byDefault).toMatchObject({ mainSocketGroup: wolf.group, mainActiveSkill: wolf.active, selected: 'Basic Attack' });
        const basic = statOf(await ok('lua_get_stats', { category: 'offense' }), 'MinionTotalDPS');
        expect(basic).toBeGreaterThan(0);
        expect(basic).toBe(byDefault.minionTotalDPS);

        await ok('set_main_skill', { group_index: wolf.group, minion_skill: 'Leap Slam' });
        const leap = await minionState();
        expect(leap.selected).toBe('Leap Slam');
        const text = await ok('lua_get_stats', { category: 'offense' });
        expect(statOf(text, 'MinionTotalDPS')).toBeGreaterThan(0);
        expect(statOf(text, 'MinionTotalDPS')).toBe(leap.minionTotalDPS);
        expect(leap.minionTotalDPS).not.toBe(byDefault.minionTotalDPS);
        // The player's own TotalDPS is 0 for a summon: the minion's number is the one that moved.
        expect(statOf(text, 'TotalDPS')).toBeUndefined();
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('AC-K70 (D-377): set_main_skill selects a minion skill', () => {
    it(
      'AC-K70: set_main_skill {minion_skill:"Leap Slam"} (any case) selects it: the reply names the minion and the skill and lists its skills, PoB\'s fields and the export hold it, the summon is the main skill, get_skill_setup marks it, and it survives save and reload',
      async () => {
        await freshGolden();
        const text = await ok('set_main_skill', { group_index: wolf.group, minion_skill: 'leap SLAM' });
        expect(text).toContain(`group ${wolf.group}, skill ${wolf.active} (Summon Wolf)`);
        expect(text).toContain('Minion skill: Wolf Companion uses Leap Slam (skill 2 of 2), stat set 1 of 1, Leap Slam.');
        expect(text).toContain('Minion: Wolf Companion; skills: 1 Basic Attack, 2 Leap Slam (selected)');

        const check = async () => {
          expect(await minionState()).toMatchObject({
            mainSocketGroup: wolf.group,
            mainActiveSkill: wolf.active,
            selected: 'Leap Slam',
            statSet: 1,
            skillMinionSkill: '2',
            skillMinionSkillCalcs: '2',
            lookup: '{2=1}',
            lookupCalcs: '{2=1}',
          });
          const gem = gemElement(await canonicalExport(f.session), 'Pounce');
          expect(gem).toMatch(/\bskillMinionSkill="2"/);
          expect(gem).toMatch(/\bskillMinionSkillCalcs="2"/);
          expect(gem).toMatch(new RegExp(`<MinionSkillIndexLookup\\b[^>]*grantedEffect="${wolf.summonId}"[^>]*>\\s*<MinionSkillIndexMap\\b[^>]*/>`));
          const setup = await ok('get_skill_setup');
          expect(setup).toContain(`**Group ${wolf.group} (MAIN)**`);
          expect(setup).toContain('  Minion: Wolf Companion; skills: 1 Basic Attack, 2 Leap Slam (selected)\n');
        };
        await check();

        await ok('lua_save_build', { build_name: 'wu77-minion.xml' });
        await ok('lua_load_build', { build_name: 'wu77-minion.xml' });
        expect(gemElement(fs.readFileSync(path.join(f.builds, 'wu77-minion.xml'), 'utf8'), 'Pounce')).toMatch(/\bskillMinionSkill="2"/);
        await check();

        // analyze_skills prints the same line for the group.
        expect(await ok('analyze_skills')).toContain('  Minion: Wolf Companion; skills: 1 Basic Attack, 2 Leap Slam (selected)\n');
        // Back to the first skill by name.
        await ok('set_main_skill', { group_index: wolf.group, minion_skill: 'Basic Attack' });
        expect(await minionState()).toMatchObject({ selected: 'Basic Attack', skillMinionSkill: '1', lookup: '{1=1,2=1}' });
      },
      ENGINE_TIMEOUT,
    );

    const refusals: Array<{ what: string; args: () => Record<string, unknown>; says: () => RegExp[] }> = [
      {
        what: 'an unknown name (the error lists the minion\'s skills)',
        args: () => ({ group_index: wolf.group, minion_skill: 'Fireball' }),
        says: () => [/Wolf Companion \(Summon Wolf\) has no skill named "Fireball"/, /its skills are 1 Basic Attack, 2 Leap Slam/],
      },
      {
        what: 'a group with no minion',
        args: () => ({ group_index: wolf.gasGroup, minion_skill: 'Leap Slam' }),
        says: () => [new RegExp(`socket group ${wolf.gasGroup} has no summon`), /Gas Grenade/],
      },
      {
        what: 'an out-of-range minion_stat_set',
        args: () => ({ group_index: wolf.group, minion_skill: 'Leap Slam', minion_stat_set: 2 }),
        says: () => [/minion stat set 2 is out of range: Leap Slam has 1 stat set \(1 Leap Slam\)/],
      },
      {
        what: 'an active_skill_index that is not the summon',
        args: () => ({ group_index: wolf.group, active_skill_index: 1, minion_skill: 'Leap Slam' }),
        says: () => [/active skill 1 \(Pounce\) has no minion: its summon is active skill 3 \(Summon Wolf\)/],
      },
      {
        what: 'minion_stat_set without minion_skill',
        args: () => ({ group_index: wolf.group, minion_stat_set: 1 }),
        says: () => [/needs minion_skill/],
      },
    ];

    for (const r of refusals) {
      it(
        `AC-K70: ${r.what} is refused and changes nothing: the export, the revision and the selection are unchanged`,
        async () => {
          await freshGolden();
          // A prior non-default selection, then the main group back: the refusal must keep both.
          await ok('set_main_skill', { group_index: wolf.group, minion_skill: 'Leap Slam' });
          await ok('set_main_skill', { group_index: GOLDEN_MAIN_GROUP });
          const before = await canonicalExport(f.session);
          const state = await luaQuery<Record<string, unknown>>(SELECTION_STATE_QUERY);
          const revision = f.session.revision;

          const out = await f.call('set_main_skill', r.args());
          expect(out.isError).toBe(true);
          for (const re of r.says()) expect(out.text).toMatch(re);
          expect(out.text).not.toContain('nil');

          expect(f.session.revision).toBe(revision);
          expect(await canonicalExport(f.session)).toBe(before);
          expect(await luaQuery<Record<string, unknown>>(SELECTION_STATE_QUERY)).toEqual(state);
          expect(await minionState()).toMatchObject({ mainSocketGroup: GOLDEN_MAIN_GROUP, selected: 'Leap Slam', skillMinionSkill: '2' });
        },
        ENGINE_TIMEOUT,
      );
    }

    /** Breaks the summon's group down and checks that nothing it restores has moved (D-176). */
    async function breakdownLeavesEverything(): Promise<string> {
      const state = await luaQuery<Record<string, unknown>>(SELECTION_STATE_QUERY);
      const exportBefore = await canonicalExport(f.session);
      const revision = f.session.revision;
      const offenseBefore = await ok('lua_get_stats', { category: 'offense' });

      const view = await ok('lua_get_stats', { breakdown: true, group_index: wolf.group });

      expect(f.session.revision).toBe(revision);
      expect(await canonicalExport(f.session)).toBe(exportBefore);
      expect(await ok('lua_get_stats', { category: 'offense' })).toBe(offenseBefore);
      expect(await luaQuery<Record<string, unknown>>(SELECTION_STATE_QUERY)).toEqual(state);
      return view;
    }

    it(
      'AC-K70: a breakdown heads the summon\'s block with its selected minion skill, whose MinionTotalDPS equals the offense view after set_main_skill, and restores the selection and the stat-set lookups exactly',
      async () => {
        await freshGolden();
        await ok('set_main_skill', { group_index: wolf.group, minion_skill: 'Leap Slam' });
        const offense = statLines(await ok('lua_get_stats', { category: 'offense' }));
        await ok('set_main_skill', { group_index: GOLDEN_MAIN_GROUP });

        const view = await breakdownLeavesEverything();
        const all = blocks(view);
        const summon = all.find((b) => b.heading.startsWith('## Summon Wolf / '));
        expect(summon?.heading).toBe('## Summon Wolf / Summon Wolf [skill_part 1], minion skill 2 Leap Slam');
        expect(summon!.lines.some((l) => l.startsWith('MinionTotalDPS: '))).toBe(true);
        expect([...summon!.lines].sort()).toEqual([...offense].sort());
        // The other active skills of the group have no minion, and no minion note.
        expect(all.length).toBeGreaterThan(1);
        for (const b of all) {
          if (b !== summon) expect(b.heading).not.toContain('minion skill');
        }
        expect(await minionState()).toMatchObject({ mainSocketGroup: GOLDEN_MAIN_GROUP, selected: 'Leap Slam', lookup: '{2=1}' });

        // An absent lookup stays absent (nil stays nil), and a filled one keeps its entries.
        await freshGolden();
        await luaQuery(`
          local s = build.skillsTab.socketGroupList[${wolf.group}].displaySkillList[${wolf.active}]
          local src = s.activeEffect.srcInstance
          src.skillMinionSkillStatSetIndexLookup = nil
          src.skillMinionSkillStatSetIndexLookupCalcs = { ['${wolf.summonId}'] = { [1] = 1 } }
          return true`);
        await breakdownLeavesEverything();
        expect(await minionState()).toMatchObject({ lookup: 'nil', lookupCalcs: '{1=1}' });
      },
      ENGINE_TIMEOUT,
    );

    it(
      'D-377 on the motivating summon: a socketed "Navira, the Last Mirage" (its summon, then its Command skill) selects "Navira\'s Fracturing" by name with a minion DPS above 0; its Command skill, and a group with two summons, are refused and change nothing',
      async () => {
        await freshGolden();
        await ok('create_socket_group', { label: 'WU-77 djinn' });
        const group = await luaQuery<number>('return #build.skillsTab.socketGroupList');
        await ok('add_gem', { group_index: group, gem_name: 'Navira, the Last Mirage', level: 20 });
        const actives = await luaQuery<string[]>(`
          local out = {}
          for i, s in ipairs(build.skillsTab.socketGroupList[${group}].displaySkillList) do
            out[i] = s.activeEffect.grantedEffect.name .. (s.minion and ' [minion]' or '')
          end
          return out`);
        expect(actives).toEqual(['Navira, the Last Mirage [minion]', 'Command']);

        const before = await canonicalExport(f.session);
        const revision = f.session.revision;
        const command = await f.call('set_main_skill', { group_index: group, active_skill_index: 2, minion_skill: "Navira's Fracturing" });
        expect(command.isError).toBe(true);
        expect(command.text).toContain('active skill 2 (Command) has no minion: its summon is active skill 1 (Navira, the Last Mirage)');
        expect(f.session.revision).toBe(revision);
        expect(await canonicalExport(f.session)).toBe(before);

        const text = await ok('set_main_skill', { group_index: group, minion_skill: "navira's fracturing" });
        expect(text).toContain(
          "Minion: Navira, the Last Mirage; skills: 1 Navira's Embrace, 2 Navira's Fracturing (selected), 3 Navira's Well, 4 Navira's Oasis, 5 Navira's Calming",
        );
        const state = await luaQuery<{ selected: string; total: number }>(`
          local s = build.skillsTab.socketGroupList[${group}].displaySkillList[1]
          return { selected = s.minion.mainSkill.activeEffect.grantedEffect.name, total = build.calcsTab.mainOutput.Minion.TotalDPS }`);
        expect(state.selected).toBe("Navira's Fracturing");
        expect(state.total).toBeGreaterThan(0);
        expect(statOf(await ok('lua_get_stats', { category: 'offense' }), 'MinionTotalDPS')).toBe(state.total);

        // A second summon in the group: the minion skill is refused, naming both.
        await ok('add_gem', { group_index: group, gem_name: 'Raise Zombie', level: 20 });
        const twoBefore = await canonicalExport(f.session);
        const two = await f.call('set_main_skill', { group_index: group, minion_skill: "Navira's Fracturing" });
        expect(two.isError).toBe(true);
        expect(two.text).toMatch(new RegExp(`socket group ${group} holds 2 summons \\(1 Navira, the Last Mirage, \\d+ Raise Zombie\\)`));
        expect(await canonicalExport(f.session)).toBe(twoBefore);
      },
      ENGINE_TIMEOUT,
    );
  });
});
