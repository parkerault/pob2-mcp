/**
 * WU-65 (D-353, D-363): the clear-speed measure reads the same area on every engine start, in process and
 * engine-required.
 *
 * Two of Earthquake's Aftershock stats map to PoB's base radius: its own stat map sends the tertiary radius (18)
 * there, and the global map the base radius plus the level's value (27 at gem level 10). PoB applies a stat set's
 * stats in `pairs` order and keeps the last radius (`Modules/CalcActiveSkill.lua:97, 895-896`), and LuaJIT seeds
 * its string hash per process, so PoB's own figure changes between engine starts. D-363: such a stat set is
 * measured by its own stat map's radius, with PoB's area modifiers applied as PoB applies them.
 *
 * Each start compiles the two-stage fixture with two endgame stages whose clear group is Earthquake: `eq` as it
 * is, and `eqa` with 50% increased area. The expected radii come from the skill data and PoB's radius rounding
 * (`Modules/CalcOffence.lua:161-163`), and Impact, whose own base radius is the same 18, is PoB's own check on
 * them. Without the rule, Aftershock reads 2.7 m and 3.2 m on some starts.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { killEngine, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 600_000;
/** Separate engine starts, each with its own string-hash seed. */
const STARTS = 6;

type Json = Record<string, any>;
const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });

/** A budget stage: stage 2's content at level 80, its clear group Earthquake at gem level 10. */
function earthquakeStage(plan: Json, id: string, customMods: Json[]): Json {
  const s = JSON.parse(JSON.stringify(plan.stages[1]));
  Object.assign(s, {
    id,
    loadoutName: `Budget ${id} (L80) {${id}}`,
    level: 80,
    progress: 'endgame',
    variant: 'budget',
    ascendancyPoints: 0,
    variantBasis: { level: judgment('test level'), gemLevels: judgment('test gem levels'), ascendancyPoints: judgment('test points') },
  });
  s.claims = [];
  s.skills.groups[1] = { label: 'Earthquake', enabled: true, role: 'clear', gems: [{ name: 'Earthquake', level: 10, quality: 0, enabled: true }] };
  s.config.customMods = customMods;
  return s;
}

function radiusPlan(): Json {
  const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  plan.stages.push(earthquakeStage(plan, 'eq', []));
  plan.stages.push(earthquakeStage(plan, 'eqa', [{ text: '50% increased Area of Effect', reason: 'test: area modifiers apply' }]));
  return plan;
}

/** PoB's radius from a base radius and an area multiplier (`calcRadius`, Modules/CalcOffence.lua:161-163), in metres. */
const metres = (base: number, areaMod: number) => Math.floor((base * Math.floor(100 * Math.sqrt(areaMod))) / 100) / 10;

engineDescribe('WU-65: the clear-speed measure reads the same area on every engine start (D-353, D-363)', () => {
  let f: SessionFixture;
  const runs: { pid: number; record: CompileRecord }[] = [];

  beforeAll(async () => {
    f = await startSessionFixture({});
    for (let k = 1; k <= STARTS; k += 1) {
      if (k > 1) await killEngine(f.session);
      const out = await f.call('guide_run', { new_run: `radius-${k}` });
      if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
      const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
      const planPath = /^plan_path for this run: (\S+)$/m.exec(out.text)![1];
      fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(radiusPlan(), null, 2)}\n`);
      const compiled = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
      expect({ k, isError: compiled.isError, text: compiled.isError ? compiled.text : '' }).toEqual({ k, isError: false, text: '' });
      runs.push({
        pid: f.session.enginePid()!,
        record: JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord,
      });
    }
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it(`D-363: on ${STARTS} engine starts, Aftershock's radius is its own stat map's 18 with the stage's area modifiers, and the band never moves`, () => {
    // Each compile ran on its own engine process.
    expect(new Set(runs.map((r) => r.pid)).size).toBe(STARTS);
    // The tertiary radius is 18 (Data/Skills/act_str.lua, Aftershock's constantStats): 1.8 m as it is, 2.1 m with
    // 50% increased area (an area multiplier of 1.5); the global map's 27 would read 2.7 m and 3.2 m.
    const want = { eq: { radius: metres(18, 1), band: 'slow' }, eqa: { radius: metres(18, 1.5), band: 'medium' } };
    expect(want).toEqual({ eq: { radius: 1.8, band: 'slow' }, eqa: { radius: 2.1, band: 'medium' } });
    runs.forEach(({ record }, i) => {
      for (const id of ['eq', 'eqa'] as const) {
        const s = record.stages[id];
        const impact = s.skillOutputs.g2s1p1;
        const aftershock = s.skillOutputs.g2s1p2;
        expect({ start: i + 1, id, impact: impact.statSetLabel, aftershock: aftershock.statSetLabel }).toEqual({
          start: i + 1,
          id,
          impact: 'Impact',
          aftershock: 'Aftershock',
        });
        const c = s.measures!.clearSpeed;
        expect({
          start: i + 1,
          id,
          aftershock: aftershock.fields.AreaOfEffectRadiusMetres,
          // Impact's own base radius is also 18, and PoB measures it alone: the same figure.
          impact: impact.fields.AreaOfEffectRadiusMetres,
          measured: c.radiusMetres,
          band: c.band,
        }).toEqual({ start: i + 1, id, aftershock: want[id].radius, impact: want[id].radius, measured: want[id].radius, band: want[id].band });
      }
    });
  });
});
