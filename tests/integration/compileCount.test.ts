/**
 * WU-55 (amendment 3's N-4; D-293, D-321, D-337): Count and custom modifiers through `compile_plan`,
 * in process and engine-required.
 *
 * The real server runs in process (`startSessionFixture`, test actions on for Lua queries) over private
 * builds, state and guides folders. Every plan is the committed two-stage fixture with a change, written into
 * a run folder that `guide_run {new_run}` made. Expectations come from PoB itself (Lua queries, the saved
 * file) and from a compile of the same plan without the change, never from the record alone.
 *
 * - AC-P53: a group with count n records its hit figure × n and a stacking damage-over-time figure × n; a
 *   non-stacking one stays as measured; the raw figures stay as they were.
 * - AC-P54: each custom modifier reaches PoB's customMods option, one line per entry, after the stage's
 *   config options.
 * - AC-P55: every figure of a stage measured with a custom modifier present is marked, defences included, and
 *   so is a ledger value reading it; a stage without one has no mark.
 * - AC-P56 and D-337: the final file sets groupCount and includeInFullDPS on the named source's groups only,
 *   and so does the measure-only XML; PoB computes Full DPS for them.
 * - D-322 through the compile: a missing reason is a V1 finding in the record, and the compile still succeeds.
 * - C-41 step 5: a custom modifier line PoB can't parse whole is a defect; nothing is compiled.
 *
 * AC-P51 and AC-P52 (the schema and the reason findings) are units in `tests/unit/planChecks.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { COUNT_RULE, type CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 240_000;

type Json = Record<string, any>;
const fixturePlan = (): Json => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

/** A spell with both a hit and a damage over time at the pin (`Data/Skills/act_int.lua`, EssenceDrainPlayer). */
const ESSENCE_DRAIN = {
  label: 'Essence Drain',
  enabled: true,
  role: 'utility',
  gems: [{ name: 'Essence Drain', level: 1, quality: 0, enabled: true }],
};

/** Two custom modifier lines: a defence and an offence. */
const CUSTOM_MODS = [
  { text: '+100 to maximum Life', reason: 'test: a hand-calculated defence' },
  { text: '10% increased Attack Speed', reason: 'test: a hand-calculated offence' },
];

/** The fixture with Essence Drain as stage 1's third group, and a ledger entry reading stage 1 only. */
function plainPlan(): Json {
  const plan = fixturePlan();
  plan.stages[0].skills.groups.push(JSON.parse(JSON.stringify(ESSENCE_DRAIN)));
  plan.ledger.push({ id: 's1_dps', claim: 'Stage 1 hits for N per second.', formula: '1.TotalDPS', inputs: [] });
  return plan;
}

/**
 * The plain plan with Count on every stage 1 group (Boneshatter, the named source, 2; Rolling Slam 3; Essence
 * Drain 4), each with its reason, and stage 2's custom modifiers.
 */
function countedPlan(): Json {
  const plan = plainPlan();
  const groups = plan.stages[0].skills.groups;
  Object.assign(groups[0], { count: 2, countReason: 'test: two copies' });
  Object.assign(groups[1], { count: 3, countReason: 'test: three copies' });
  Object.assign(groups[2], { count: 4, countReason: 'test: four copies' });
  plan.stages[1].config.customMods = JSON.parse(JSON.stringify(CUSTOM_MODS));
  return plan;
}

/** The `<Skill>` attributes of each `<SkillSet>` in a saved build, by set title, in group order. */
function skillGroups(xml: string): Record<string, Record<string, string>[]> {
  const out: Record<string, Record<string, string>[]> = {};
  for (const set of xml.matchAll(/<SkillSet\b([^>]*)>([\s\S]*?)<\/SkillSet>/g)) {
    const title = /\btitle="([^"]*)"/.exec(set[1])?.[1] ?? '';
    out[title] = [...set[2].matchAll(/<Skill\b([^>]*?)\/?>/g)].map((m) =>
      Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]])),
    );
  }
  return out;
}

engineDescribe('WU-55: Count and custom modifiers through compile_plan (D-293, D-321, D-337)', () => {
  let f: SessionFixture;
  /** Measure-only records of the plain and the counted plan. */
  let plain: CompileRecord;
  let counted: CompileRecord;
  /** The counted plan's measure-only run folder (its `compiled-build.xml`). */
  let countedDir: string;

  async function newRun(slug: string, plan: Json): Promise<{ abs: string; plan: string }> {
    const out = await f.call('guide_run', { new_run: slug });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(out.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, plan: planPath };
  }

  const recordOf = (r: { abs: string }): CompileRecord =>
    JSON.parse(fs.readFileSync(path.join(r.abs, 'compile-record.json'), 'utf8')) as CompileRecord;

  async function measure(slug: string, plan: Json): Promise<{ abs: string; record: CompileRecord }> {
    const r = await newRun(slug, plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, measure_only: true });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    return { abs: r.abs, record: recordOf(r) };
  }

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:count-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    plain = (await measure('count-plain', plainPlan())).record;
    const c = await measure('count-counted', countedPlan());
    counted = c.record;
    countedDir = c.abs;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it('AC-P53 (D-293, D-321): each group\'s hit figure is × its count, beside the raw figure; Essence Drain\'s non-stacking DoT stays as measured', () => {
    expect(counted.recordVersion).toBe(2);
    const s1 = counted.stages['1'];
    const counts: Record<number, number> = { 1: 2, 2: 3, 3: 4 };
    const keys = Object.keys(s1.skillOutputs);
    // Every group's breakdown has a counted twin under the same key, with that group's count.
    expect(Object.keys(s1.countedSkillOutputs).sort()).toEqual([...keys].sort());
    for (const g of [1, 2, 3]) expect(keys.some((k) => k.startsWith(`g${g}s`))).toBe(true);
    for (const key of keys) {
      const group = Number(/^g(\d+)s/.exec(key)![1]);
      const raw = s1.skillOutputs[key].fields;
      const c = s1.countedSkillOutputs[key];
      expect({ key, count: c.count, skill: c.skill, statSetLabel: c.statSetLabel }).toEqual({
        key, count: counts[group], skill: s1.skillOutputs[key].skill, statSetLabel: s1.skillOutputs[key].statSetLabel,
      });
      // Only the figures PoB's Full DPS merges per skill have a Count rule.
      for (const field of Object.keys(c.fields)) expect({ key, field, ruled: COUNT_RULE.has(field) }).toEqual({ key, field, ruled: true });
      expect(c.fields.CombinedDPS).toBeUndefined();
      if (raw.TotalDPS !== undefined) expect({ key, TotalDPS: c.fields.TotalDPS }).toEqual({ key, TotalDPS: raw.TotalDPS * counts[group] });
      if (raw.TotalDot !== undefined) expect({ key, TotalDot: c.fields.TotalDot }).toEqual({ key, TotalDot: raw.TotalDot });
    }
    // Every group hits in one of its stat sets, so each hit figure above was really multiplied.
    for (const g of [1, 2, 3]) {
      expect({ g, hits: keys.some((k) => k.startsWith(`g${g}s`) && s1.skillOutputs[k].fields.TotalDPS > 0) }).toEqual({ g, hits: true });
    }
    // Essence Drain's "Damage over Time" stat set deals damage over time that doesn't stack (no skill's does at the pin).
    const ed = keys.find((k) => s1.skillOutputs[k].skill === 'Essence Drain' && s1.skillOutputs[k].statSetLabel === 'Damage over Time')!;
    expect(ed).toMatch(/^g3s1p\d+$/);
    expect(s1.skillOutputs[ed].fields.TotalDot).toBeGreaterThan(0);
    expect(s1.countedSkillOutputs[ed].dotCanStack).toBe(false);
    expect(s1.countedSkillOutputs[ed].fields.TotalDot).toBe(s1.skillOutputs[ed].fields.TotalDot);
    // The main skill's figures take the main group's count.
    expect(s1.countedOutputs).toMatchObject({ group: 1, count: 2, dotCanStack: false });
    expect(s1.countedOutputs.fields.TotalDPS).toBe(s1.outputs.TotalDPS * 2);
    expect(s1.countedOutputs.fields.Life).toBeUndefined();
    // Stage 2 sets no count: every counted figure equals its raw one.
    const s2 = counted.stages['2'];
    for (const [key, c] of Object.entries(s2.countedSkillOutputs)) {
      expect(c.count).toBe(1);
      for (const [field, v] of Object.entries(c.fields)) expect({ key, field, v }).toEqual({ key, field, v: s2.skillOutputs[key].fields[field] });
    }
  });

  it('AC-P53: the raw figures stay as they were: the counted plan\'s stage 1 measures what the plain plan does, but for PoB\'s own Full DPS', () => {
    expect(counted.stages['1'].skillOutputs).toEqual(plain.stages['1'].skillOutputs);
    const differ = Object.keys({ ...plain.stages['1'].outputs, ...counted.stages['1'].outputs }).filter(
      (k) => plain.stages['1'].outputs[k] !== counted.stages['1'].outputs[k],
    );
    // PoB multiplies the named group's hits by its groupCount in Full DPS (Modules/Calcs.lua:322), and only there.
    expect(differ.every((k) => /^Full/.test(k))).toBe(true);
    expect(counted.stages['1'].outputs.FullDPS).toBeGreaterThan(plain.stages['1'].outputs.FullDPS);
  });

  it('AC-P53: a damage over time that stacks is × the count (PoB\'s DotCanStack, given to Essence Drain by a test-only skill mod)', async () => {
    // No skill's DoT stacks at the pin, so for this compile Essence Drain's "Damage over Time" stat set (the one with
    // a duration, which a stacking DoT is multiplied by) carries a DotCanStack FLAG mod. It reaches the skill's mod
    // list (Modules/CalcActiveSkill.lua:124-126); CalcOffence then sets the flag (Modules/CalcOffence.lua:5964-5965)
    // and computes the DoT as stacking.
    const EACH_SET = "for _, set in ipairs(data.skills.EssenceDrainPlayer.statSets) do if set.label == 'Damage over Time' then";
    expect(
      await lua<number>(`
        __wu55Mod = __wu55Mod or modLib.createMod('DotCanStack', 'FLAG', true, 'Test')
        local n = 0
        ${EACH_SET}
          set.baseMods = set.baseMods or {}
          table.insert(set.baseMods, __wu55Mod)
          n = n + 1
        end end
        return n`),
    ).toBe(1);
    let stacking: CompileRecord;
    try {
      const plan = plainPlan();
      Object.assign(plan.stages[0].skills.groups[2], { count: 4 }); // no countReason: D-322's finding, below
      stacking = (await measure('count-stacking', plan)).record;
    } finally {
      await lua<boolean>(`
        ${EACH_SET}
          for i = #set.baseMods, 1, -1 do
            if set.baseMods[i] == __wu55Mod then table.remove(set.baseMods, i) end
          end
        end end
        return true`);
    }
    const s1 = stacking!.stages['1'];
    const ed = Object.keys(s1.skillOutputs).find(
      (k) => s1.skillOutputs[k].skill === 'Essence Drain' && s1.skillOutputs[k].statSetLabel === 'Damage over Time',
    )!;
    expect(s1.skillOutputs[ed].fields.TotalDot).toBeGreaterThan(0);
    expect(s1.countedSkillOutputs[ed]).toMatchObject({ count: 4, dotCanStack: true });
    expect(s1.countedSkillOutputs[ed].fields.TotalDot).toBe(s1.skillOutputs[ed].fields.TotalDot * 4);
    // Its "Projectile" stat set's hit doesn't stack as a DoT does, and is × 4 as every hit is.
    const hit = Object.keys(s1.skillOutputs).find((k) => k.startsWith('g3s') && s1.skillOutputs[k].statSetLabel === 'Projectile')!;
    expect(s1.skillOutputs[hit].fields.TotalDPS).toBeGreaterThan(0);
    expect(s1.countedSkillOutputs[hit]).toMatchObject({ count: 4, dotCanStack: false });
    expect(s1.countedSkillOutputs[hit].fields.TotalDPS).toBe(s1.skillOutputs[hit].fields.TotalDPS * 4);
    // D-322 through the compile: count 4 without a reason is a V1 finding; the compile still succeeded.
    expect(s1.v1!.pass).toBe(false);
    expect(s1.v1!.findings.filter((x) => x.code === 'missing-reason')).toEqual([
      expect.objectContaining({ data: { path: 'skills.groups[2].countReason', group: 3, count: 4 } }),
    ]);
    // With the wrapper gone, the same plan measures as before: nothing stacks.
    const again = await measure('count-unwrapped', plainPlan());
    const s1again = again.record.stages['1'];
    expect(Object.values(s1again.countedSkillOutputs).every((c) => c.dotCanStack === false)).toBe(true);
    expect(s1again.skillOutputs).toEqual(plain.stages['1'].skillOutputs);
  }, ENGINE_TIMEOUT);

  it('AC-P54 (D-293): each custom modifier reaches PoB\'s customMods option, one line per entry, written after the stage\'s config options', async () => {
    // Every set_config call of the compile, as the keys it writes, in order.
    await lua<boolean>(`
      local B = require('API.BuildOps')
      __wu55OwnSetConfig = __wu55OwnSetConfig or B.set_config
      __wu55Writes = {}
      B.set_config = function(params)
        local keys = {}
        for k in pairs(params) do keys[#keys + 1] = k end
        table.sort(keys)
        __wu55Writes[#__wu55Writes + 1] = table.concat(keys, ',')
        return __wu55OwnSetConfig(params)
      end
      return true`);
    let r: { abs: string; record: CompileRecord };
    let writes: string[];
    try {
      r = await measure('count-custom-mods', countedPlan());
      writes = await lua<string[]>('return __wu55Writes');
    } finally {
      await lua<boolean>("require('API.BuildOps').set_config = __wu55OwnSetConfig return true");
    }
    const plan = countedPlan();
    const listed = (i: number) =>
      [...plan.stages[i].config.earned, ...plan.stages[i].config.scenario].map((e: Json) => e.option).sort().join(',');
    // Stage 1 writes its options; stage 2 writes its options, then the custom modifiers in a write of their own.
    expect(writes!).toEqual([listed(0), listed(1), 'customMods']);
    const lines = CUSTOM_MODS.map((m) => m.text);
    expect(r!.record.stages['2'].customModsWritten).toEqual(lines);
    expect(r!.record.stages['1'].customModsWritten).toEqual([]);
    // PoB holds them in stage 2's config set, one line per entry, and stage 1's set has none.
    const setOf = (id: string) => r!.record.sets.find((s) => s.kind === 'config' && s.stages.includes(id))!.id;
    expect(await lua<string>(`return build.configTab.configSets[${setOf('2')}].input.customMods`)).toBe(lines.join('\n'));
    expect(await lua<string | null>(`return build.configTab.configSets[${setOf('1')}].input.customMods or 'none'`)).toBe('none');
    // PoB applies each line: both are Custom modifiers of the stage's config.
    const custom = await lua<string[]>(`
      local out = {}
      for _, mod in ipairs(build.configTab.modList) do
        if mod.source == 'Custom' then out[#out + 1] = mod.name end
      end
      table.sort(out)
      return out`);
    expect(custom).toEqual(['Life', 'Speed'].sort());
    // The saved XML keeps the option in stage 2's config set, so a reload reproduces the record.
    const xml = fs.readFileSync(path.join(r!.abs, 'compiled-build.xml'), 'utf8');
    const escaped = lines.join('\n').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(xml).toMatch(new RegExp(`<Input name="customMods" string="${escaped}"/>`));
  }, ENGINE_TIMEOUT);

  it('AC-P55 (D-321): every figure of the stage measured with custom modifiers is marked, defences included; a ledger value reading it too', () => {
    expect(counted.stages['2']).toMatchObject({ computedWithCustomMods: true, customModsWritten: CUSTOM_MODS.map((m) => m.text) });
    expect(counted.stages['1']).toMatchObject({ computedWithCustomMods: false, customModsWritten: [] });
    expect(plain.stages['2'].computedWithCustomMods).toBe(false);
    // The defence was computed with the modifier present: stage 2's Life rose by at least the flat 100.
    expect(counted.stages['2'].outputs.Life - plain.stages['2'].outputs.Life).toBeGreaterThanOrEqual(100);
    // life_gain_pct reads both stages' Life, so it carries the mark; s1_dps reads stage 1 only.
    expect(counted.ledger.life_gain_pct).toMatchObject({ computedWithCustomMods: true, error: null });
    expect(counted.ledger.s1_dps).toMatchObject({ computedWithCustomMods: false, error: null, value: counted.stages['1'].outputs.TotalDPS });
    expect(Object.values(plain.ledger).every((e) => e.computedWithCustomMods === false)).toBe(true);
  });

  it('AC-P56, D-337: the final file and the measure-only XML put the named source\'s group in Full DPS with its groupCount, and no other group', async () => {
    const r = await newRun('count-final', countedPlan());
    const out = await f.call('compile_plan', { plan_path: r.plan, build_name: 'wu55-count' });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    const record = recordOf(r);
    const files = {
      final: fs.readFileSync(path.join(f.builds, 'wu55-count.xml'), 'utf8'),
      measureOnly: fs.readFileSync(path.join(countedDir, 'compiled-build.xml'), 'utf8'),
    };
    const plan = countedPlan();
    for (const [which, xml] of Object.entries(files)) {
      const sets = skillGroups(xml);
      for (const stage of plan.stages) {
        const title = record.sets.find((s) => s.kind === 'skill' && s.stages.includes(stage.id))!.title;
        const groups = sets[title];
        expect({ which, title, n: groups?.length }).toEqual({ which, title, n: stage.skills.groups.length });
        groups.forEach((g, k) => {
          const named = k + 1 === stage.skills.rolledGroup;
          expect({ which, stage: stage.id, group: k + 1, full: g.includeInFullDPS, count: g.groupCount }).toEqual({
            which,
            stage: stage.id,
            group: k + 1,
            full: named ? 'true' : 'false',
            count: named ? String(stage.skills.groups[k].count ?? 1) : undefined,
          });
        });
      }
    }
    // PoB computed Full DPS for the named groups in the final compile, with stage 1's Count of 2.
    for (const id of ['1', '2']) expect(record.stages[id].outputs.FullDPS).toBeGreaterThan(0);
    expect(record.stages['1'].outputs.FullDPS).toBe(counted.stages['1'].outputs.FullDPS);
  }, ENGINE_TIMEOUT);

  it('C-41 step 5 (D-293): a custom modifier line PoB can\'t parse whole is a defect naming the stage and the line; nothing is compiled', async () => {
    const plan = countedPlan();
    plan.stages[1].config.customMods.push({ text: 'Your hits make the moon sing', reason: 'test: not a modifier' });
    const r = await newRun('count-bad-line', plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, measure_only: true });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('stage 2: config.customMods[2]: PoB can not parse "Your hits make the moon sing" whole');
    expect(fs.readdirSync(r.abs).sort()).toEqual(['plan.json']);
  }, ENGINE_TIMEOUT);
});
