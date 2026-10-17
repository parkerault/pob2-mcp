/**
 * WU-78 (amendment 6; D-377, D-378, D-380): a minion's skill through `compile_plan`, in process and engine-required.
 *
 * The real server runs in process (`startSessionFixture`, test actions on for Lua queries) over private builds,
 * state and guides folders. The plans are the committed fixtures `minion-wolf` (a Wolf Pack whose Wolf Companion
 * uses Leap Slam, Count 2) and `varashta-navira` (a Disciple of Varashta whose socketed level-20 "Navira, the Last
 * Mirage" uses Navira's Fracturing, with Barya of Navira, node 32705, and Navira's Fracturing, node 10561, written
 * from the game data), each written into a run folder that `guide_run {new_run}` made. Expectations come from PoB
 * itself: Lua queries of the compiled build the engine holds, the game data, PoB's own Full DPS (which merges a
 * minion's hits with its group's Count, `Modules/Calcs.lua:366-378`) and the saved file.
 *
 * - AC-P68 (D-377, D-378): both plans compile; each record's `measures.dps` equals the main entry's
 *   `MinionTotalDPS` × its Count, above 0, and equals PoB's own Full DPS; the record keeps the resolved selection
 *   (the index PoB's live list gives the name); the saved build holds that index in PoB's own fields; the
 *   key-figure line names the minion skill; the clear measure reads the minion's area and use rate.
 * - AC-P69, the engine part (D-377, D-380): `compile_check` refuses an unknown minion skill (listing the minion's
 *   skills from the game data), a group with no summon, a group whose only skills are a non-minion summon and its
 *   "Command", the main group's "Command" as the main active skill, and a minion stat set beyond the skill's; nothing
 *   is compiled. V1 reports `not-granted` for the Varashta plan without node 10561 (and for the summon too without
 *   32705), and nothing with both allocated; the compile still succeeds (D-192).
 *
 * - D-377, the compile's choice for a disabled group (BuildOps.select_minion_skill refuses one that isn't the main
 *   group, because PoB builds none of its skills): each group is made the main group for its own selection, so a
 *   disabled group's minion skill is resolved and saved too.
 *
 * AC-P69's schema part (the version rule, D-217) is `tests/unit/planSchema.test.ts`; V1's rule over hand-made inputs
 * is `tests/unit/planChecks.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const ENGINE_TIMEOUT = 300_000;

type Json = Record<string, any>;
const fixturePlan = (name: string): Json =>
  JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', name, 'plan.json'), 'utf8'));

/** Relative equality to 1e-9 (PoB's numbers through JSON). */
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b), 1e-12);

/** The `<Gem>` start tag named `nameSpec` with the given level in a saved build. */
function gemTag(xml: string, nameSpec: string, level: number): string {
  const tag = [...xml.matchAll(/<Gem\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`nameSpec="${nameSpec}"`) && t.includes(`level="${level}"`));
  if (tag === undefined) throw new Error(`no <Gem nameSpec="${nameSpec}" level="${level}"> in the saved build`);
  return tag;
}

/** PoB's own state of the compiled build's group 1 summon: its minion's live list, the selected skill and the outputs. */
const SUMMON_QUERY = `
  local group = build.skillsTab.socketGroupList[1]
  local s = group.displaySkillList[group.mainActiveSkill or 1]
  local skills = {}
  for i, ms in ipairs(s.minion.activeSkillList) do skills[i] = ms.activeEffect.grantedEffect.name end
  local out = build.calcsTab.mainOutput
  return {
    mainSocketGroup = build.mainSocketGroup,
    summonId = s.activeEffect.grantedEffect.id,
    minion = s.minion.minionData.name,
    skills = skills,
    selected = s.minion.mainSkill.activeEffect.grantedEffect.name,
    minionTotalDPS = out.Minion and out.Minion.TotalDPS or 'nil',
    fullDPS = out.FullDPS,
  }`;

/** The game data's skill list of a minion type, in data order. */
const minionSkillsQuery = (minionId: string) => `
  local out = {}
  for _, id in ipairs(data.minions['${minionId}'].skillList) do
    if data.skills[id] then out[#out + 1] = data.skills[id].name end
  end
  return out`;

engineDescribe('WU-78: a minion\'s skill through compile_plan (D-377, D-378, D-380)', () => {
  let f: SessionFixture;

  async function newRun(slug: string, plan: Json): Promise<{ abs: string; plan: string }> {
    const out = await f.call('guide_run', { new_run: slug });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(out.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, plan: planPath };
  }

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:minion-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  /** A measure-only compile: its record, its text, its saved XML and PoB's own state of the summon after it. */
  async function compile(slug: string, plan: Json) {
    const r = await newRun(slug, plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, measure_only: true });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    const record = JSON.parse(fs.readFileSync(path.join(r.abs, 'compile-record.json'), 'utf8')) as CompileRecord;
    const xml = fs.readFileSync(path.join(r.abs, 'compiled-build.xml'), 'utf8');
    const pob = await lua<Json>(SUMMON_QUERY);
    return { record, text: out.text, xml, pob, planPath: r.plan };
  }

  /** A compile that `compile_check` refuses: its text, and that no record was written. */
  async function refused(slug: string, plan: Json): Promise<string> {
    const r = await newRun(slug, plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, measure_only: true });
    expect(out.isError).toBe(true);
    expect(out.text).toMatch(/defects?; nothing was compiled/);
    expect(fs.existsSync(path.join(r.abs, 'compile-record.json'))).toBe(false);
    return out.text;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('AC-P68 (D-377, D-378): a summon group compiles with its minion skill, and the headline is the minion\'s', () => {
    for (const fixture of [
      { name: 'minion-wolf', gem: 'Wolf Pack', skill: 'Leap Slam', minion: 'Wolf Companion', count: 2 },
      { name: 'varashta-navira', gem: 'Navira, the Last Mirage', skill: "Navira's Fracturing", minion: 'Navira, the Last Mirage', count: 1 },
    ]) {
      it(
        `AC-P68: ${fixture.name}: measures.dps is the main entry's MinionTotalDPS × its Count (${fixture.count}), above 0, as PoB's Full DPS; the saved build holds the selected index`,
        async () => {
          const { record, text, xml, pob, planPath } = await compile(`p68-${fixture.name}`, fixturePlan(fixture.name));
          expect(record.planSchemaVersion).toBe(4);
          const s = record.stages.b;
          // The selection PoB made: the name, at its index in the minion's live list.
          const index = (pob.skills as string[]).indexOf(fixture.skill) + 1;
          expect(index).toBeGreaterThan(0);
          expect([pob.mainSocketGroup, pob.minion, pob.selected]).toEqual([1, fixture.minion, fixture.skill]);
          expect(s.minionSkills).toEqual([
            {
              group: 1,
              activeSkill: 1,
              summon: fixture.gem,
              minion: fixture.minion,
              minionId: expect.any(String),
              name: fixture.skill,
              index,
              statSet: 1,
              statSets: [expect.any(String)],
              skills: pob.skills,
            },
          ]);
          // The main entry's minion figure, as PoB's own output measures it, and the headline: it × Count.
          const entry = s.skillOutputs.g1s1p1.fields;
          expect(close(entry.MinionTotalDPS, pob.minionTotalDPS)).toBe(true);
          expect(close(s.outputs.MinionTotalDPS, pob.minionTotalDPS)).toBe(true);
          expect(entry.TotalDPS).toBe(0);
          expect(s.countedSkillOutputs.g1s1p1.count).toBe(fixture.count);
          expect(s.measures!.dps).toBe(entry.MinionTotalDPS * fixture.count);
          expect(s.measures!.dps).toBeGreaterThan(0);
          // PoB's own Full DPS merges the minion's hits with the group's Count (the named source is in Full DPS).
          expect(close(s.measures!.dps!, pob.fullDPS)).toBe(true);
          expect(close(s.outputs.FullDPS, pob.fullDPS)).toBe(true);
          expect(s.countedOutputs.fields.MinionTotalDPS).toBe(s.outputs.MinionTotalDPS * fixture.count);
          // The clear measure: the only group is the clear skill, measured by its minion's area and use rate.
          expect(s.measures!.clearSpeed).toMatchObject({ key: 'g1s1p1', radiusMetres: entry.MinionAreaOfEffectRadiusMetres, usesPerSecond: entry.MinionSpeed });
          // The key-figure line names the minion skill, in compile_plan's reply and in guide_run's stage view.
          const line = `Key figures: DPS ${Math.round(s.measures!.dps!)} (${fixture.skill}, minion);`;
          expect(text).toContain(line);
          const view = await f.call('guide_run', { view: { plan: planPath, stage: 'b' } });
          expect({ isError: view.isError, has: view.text.includes(line) }).toEqual({ isError: false, has: true });
          // The saved build carries PoB's own fields: the index, its Calcs-tab copy and the stat-set lookup.
          const gem = gemTag(xml, fixture.gem, 20);
          expect(gem).toMatch(new RegExp(`\\bskillMinionSkill="${index}"`));
          expect(gem).toMatch(new RegExp(`\\bskillMinionSkillCalcs="${index}"`));
          expect(xml).toMatch(
            new RegExp(`<MinionSkillIndexLookup\\b[^>]*grantedEffect="${pob.summonId}"[^>]*>\\s*<MinionSkillIndexMap\\b(?=[^>]*\\bskillIndex="${index}")(?=[^>]*\\bstatSetIndex="1")[^>]*/>`),
          );
          if (fixture.name === 'minion-wolf') {
            // An ordinary pob-computed ref reads the minion's figure (D-376).
            expect(record.ledger.wolf_dps).toMatchObject({ value: entry.MinionTotalDPS, error: null });
          } else {
            // Both granting passives are allocated: no not-granted finding.
            expect(s.v1!.findings.filter((x) => x.code === 'not-granted')).toEqual([]);
          }
        },
        ENGINE_TIMEOUT,
      );
    }
  });

  it(
    "D-377: every group that names a minion skill is resolved, a disabled one too (made the main group for its own selection)",
    async () => {
      const plan = fixturePlan('minion-wolf');
      // Pounce's own skills come first; its summon, Summon Wolf, is a later active skill of the group.
      plan.stages[0].skills.groups.push({
        label: 'Pounce',
        enabled: false,
        role: 'utility',
        gems: [{ name: 'Pounce', level: 10, quality: 0, enabled: true }],
        minionSkill: 'leap slam',
      });
      const { record, xml } = await compile('minion-disabled', plan);
      const s = record.stages.b;
      const pounce = await lua<Json>(`
        local g = build.skillsTab.socketGroupList[2]
        build.mainSocketGroup = 2
        build.buildFlag = true
        build.calcsTab:BuildOutput()
        for i, a in ipairs(g.displaySkillList) do
          if a.minion then
            local skills = {}
            for j, ms in ipairs(a.minion.activeSkillList) do skills[j] = ms.activeEffect.grantedEffect.name end
            return { active = i, skills = skills, selected = a.minion.mainSkill.activeEffect.grantedEffect.name }
          end
        end
        return {}`);
      const index = (pounce.skills as string[]).indexOf('Leap Slam') + 1;
      expect(index).toBeGreaterThan(0);
      expect(pounce.selected).toBe('Leap Slam');
      expect(s.minionSkills!.map((m) => [m.group, m.activeSkill, m.name, m.index])).toEqual([
        [1, 1, 'Leap Slam', s.minionSkills![0].index],
        [2, pounce.active, 'Leap Slam', index],
      ]);
      expect(gemTag(xml, 'Pounce', 10)).toMatch(new RegExp(`\\bskillMinionSkill="${index}"`));
      // The disabled group's breakdown measures its minion's Leap Slam.
      expect(s.skillOutputs[`g2s${pounce.active}p1`].fields.MinionTotalDPS).toBeGreaterThan(0);
    },
    ENGINE_TIMEOUT,
  );

  describe('AC-P69, the engine part (D-377, D-380)', () => {
    it(
      "AC-P69: compile_check refuses an unknown minion skill, listing the minion's skills from the game data",
      async () => {
        const plan = fixturePlan('varashta-navira');
        plan.stages[0].skills.groups[0].minionSkill = "Navira's Nonsense";
        plan.roll.skill = "Navira's Nonsense";
        const text = await refused('p69-unknown', plan);
        const skills = await lua<string[]>(minionSkillsQuery('WaterDjinn'));
        expect(skills).toContain("Navira's Fracturing");
        const listed = skills.map((name, i) => `${i + 1} ${name}`).join(', ');
        expect(text).toContain(
          `stage b: skills.groups[0].minionSkill "Navira's Nonsense": Navira, the Last Mirage (summoned by Navira, the Last Mirage) has no skill of that name; its skills: Navira, the Last Mirage: ${listed}`,
        );
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P69: compile_check refuses a group with no summon, and one whose only skills are a non-minion summon and its "Command"',
      async () => {
        const noSummon = fixturePlan('minion-wolf');
        noSummon.stages[0].skills.groups[0].gems[0].name = 'Boneshatter';
        expect(await refused('p69-no-summon', noSummon)).toContain(
          'stage b: skills.groups[0].minionSkill "Leap Slam": the group holds no summon: none of its active skills (1 Boneshatter) has a minion',
        );
        const raven = fixturePlan('minion-wolf');
        raven.stages[0].skills.groups[0].gems[0].name = 'Mist Raven';
        expect(await refused('p69-command', raven)).toContain(
          'stage b: skills.groups[0].minionSkill "Leap Slam": the group holds no summon: none of its active skills (1 Mist Raven, 2 Command) has a minion; "Command" is a summon\'s command to its minion and has none itself',
        );
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P69: compile_check refuses the summon\'s "Command" as the main active skill, and a minion stat set beyond the skill\'s',
      async () => {
        const command = fixturePlan('varashta-navira');
        command.stages[0].skills.main.activeSkill = 2;
        expect(await refused('p69-main-command', command)).toContain(
          `stage b: skills.groups[0].minionSkill "Navira's Fracturing": the main active skill 2 (Command) has no minion; with a minion skill the main active skill is the group's summon, active skill 1 (Navira, the Last Mirage)`,
        );
        const statSets = await lua<number>("return #data.skills.ChilledGroundBurstWaterDjinn.statSets");
        const beyond = fixturePlan('varashta-navira');
        beyond.stages[0].skills.groups[0].minionStatSet = statSets + 1;
        expect(await refused('p69-stat-set', beyond)).toContain(
          `stage b: skills.groups[0].minionStatSet ${statSets + 1} is beyond Navira's Fracturing's ${statSets} stat set`,
        );
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P69 (D-380): V1 reports not-granted without node 10561 (and for the summon too without 32705); the compile still succeeds',
      async () => {
        const without = fixturePlan('varashta-navira');
        without.stages[0].tree.ascendancyNodes = [32705];
        without.stages[0].ascendancyPoints = 1;
        const one = (await compile('p69-not-granted', without)).record.stages.b;
        expect(one.v1!.findings.filter((x) => x.code === 'not-granted').map((x) => x.data)).toEqual([
          { group: 1, kind: 'minionSkill', name: "Navira's Fracturing", nodes: [10561] },
        ]);
        expect(one.v1!.pass).toBe(false);
        expect(one.measures!.dps).toBeGreaterThan(0);

        const neither = fixturePlan('varashta-navira');
        neither.stages[0].tree.ascendancyNodes = [];
        neither.stages[0].ascendancyPoints = 0;
        const both = (await compile('p69-not-granted-both', neither)).record.stages.b;
        expect(both.v1!.findings.filter((x) => x.code === 'not-granted').map((x) => x.data)).toEqual([
          { group: 1, kind: 'gem', name: 'Navira, the Last Mirage', nodes: [32705] },
          { group: 1, kind: 'minionSkill', name: "Navira's Fracturing", nodes: [10561] },
        ]);
      },
      ENGINE_TIMEOUT,
    );
  });
});
