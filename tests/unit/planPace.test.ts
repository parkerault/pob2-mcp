/**
 * WU-88 (amendment 8 §9, D-407): the pure parts of the pace measures, without the engine. The engine-required AC-P71
 * is `tests/integration/compileSkeletonPace.test.ts`.
 *
 * D-407: the record's rough `clearSpeed` (D-353: a band from the clear skill's area) is measured on card skeletons
 * (R1b's one endgame stage with no `variant`) as well as on the endgame variants, with the player's movement speed
 * beside it; campaign stages still have none. When PoB gives the clear skill no area, the band reads `slow` and the
 * measure carries a no-area flag, so a display can say "slow (PoB gives no area)". The user's HG-12 grant covers these
 * record fields only: a skeleton gets no `dps`, `ehp` or `arbiter`, and `compile_plan`'s key-figure line is unchanged.
 */
import { describe, expect, it } from '@jest/globals';
import {
  MOVEMENT_SPEED_FIELD,
  clearSpeedOf,
  measuredStage,
  stageMeasures,
  type StageRecord,
} from '../../src/plan/record';
import { keyFigureLine } from '../../src/plan/compiler';
import type { Stage } from '../../src/plan/schema';

/** A stage record whose main group 1 is Earthquake (a 2.5 m area) or a plain summon whose minion has no area. */
function record(kind: 'area' | 'no-area', movement?: number): StageRecord {
  const fields: Record<string, number> =
    kind === 'area' ? { TotalDPS: 40, Speed: 1.2, AreaOfEffectRadiusMetres: 2.5 } : { TotalDPS: 0, MinionTotalDPS: 30, MinionSpeed: 1.4 };
  const skill = kind === 'area' ? 'Earthquake' : 'Skeletal Warrior Minion';
  return {
    loadoutName: 'Card (L90) {r1a1e}',
    level: 90,
    outputs: { TotalDPS: fields.TotalDPS, Life: 1000, TotalEHP: 3000, ...(movement !== undefined ? { [MOVEMENT_SPEED_FIELD]: movement } : {}) },
    countedOutputs: { group: 1, count: 1, dotCanStack: false, fields: { TotalDPS: fields.TotalDPS } },
    skillOutputs: { g1s1p1: { skill, statSetLabel: skill, fields } },
    countedSkillOutputs: { g1s1p1: { skill, statSetLabel: skill, count: 1, dotCanStack: false, fields: { TotalDPS: fields.TotalDPS } } },
    minionSkills: [],
    v1: { pass: true, findings: [], notes: [] },
    v2: { pass: true, findings: [], notes: [] },
  } as unknown as StageRecord;
}

const main = { group: 1, activeSkill: 1 };
/** An endgame stage: a card skeleton with no `variant`, or a variant rung. */
const stage = (variant?: string) =>
  ({
    progress: 'endgame',
    ...(variant !== undefined ? { variant } : {}),
    skills: { main, groups: [{ enabled: true, role: 'clear', gems: [{ name: 'Earthquake', enabled: true }] }] },
  }) as unknown as Stage;

describe('D-407: which stages are measured', () => {
  it('every endgame stage, a card skeleton (no variant) included; never a campaign stage', () => {
    const at = (progress: string, variant?: string) => measuredStage({ progress, variant } as Pick<Stage, 'progress' | 'variant'>);
    expect([at('endgame'), at('endgame', 'entering-maps'), at('endgame', 'budget'), at('endgame', 'non-budget')]).toEqual([true, true, true, true]);
    expect([at('start'), at('q.act-1-clearfell-beira'), at('q.epilog-kingsmarch-siege-of-oriath')]).toEqual([false, false, false]);
  });
});

describe('D-407: the pace measures on a card skeleton', () => {
  it("a skeleton's measures hold the rough clearSpeed and the player's movement speed, PoB's EffectiveMovementSpeedMod, and nothing else", () => {
    const m = stageMeasures(stage(), record('area', 1.25), [], {});
    expect(Object.keys(m).sort()).toEqual(['clearSpeed', 'movementSpeed']);
    expect(MOVEMENT_SPEED_FIELD).toBe('EffectiveMovementSpeedMod');
    expect(m.movementSpeed).toBe(1.25);
    // The band of the clear skill's area: 2.5 m is medium (D-353), from an area PoB gives.
    expect(m.clearSpeed).toMatchObject({ skill: 'Earthquake', key: 'g1s1p1', radiusMetres: 2.5, band: 'medium', speed: 'medium', noArea: false, rough: true });
  });

  it('a variant stage keeps dps, ehp and (on b and n) arbiter, and gains the movement speed beside its clear speed', () => {
    const b = stageMeasures(stage('budget'), record('area', 1.1), [], {});
    expect(Object.keys(b).sort()).toEqual(['arbiter', 'clearSpeed', 'dps', 'ehp', 'movementSpeed']);
    expect({ dps: b.dps, ehp: b.ehp, movementSpeed: b.movementSpeed }).toEqual({ dps: 40, ehp: 3000, movementSpeed: 1.1 });
    const m = stageMeasures(stage('entering-maps'), record('area', 1.1), [], {});
    expect(Object.keys(m).sort()).toEqual(['clearSpeed', 'dps', 'ehp', 'movementSpeed']);
  });

  it('the movement speed is null when PoB gives none', () => {
    expect(stageMeasures(stage(), record('area'), [], {}).movementSpeed).toBeNull();
    const nan = record('area');
    nan.outputs[MOVEMENT_SPEED_FIELD] = Number.NaN;
    expect(stageMeasures(stage(), nan, [], {}).movementSpeed).toBeNull();
  });
});

describe('D-407: a clear skill with no area', () => {
  it('reads slow with the no-area flag: a plain summon whose minion PoB gives no radius', () => {
    const c = stageMeasures(stage(), record('no-area', 1), [], {}).clearSpeed;
    expect(c).toMatchObject({ key: 'g1s1p1', skill: 'Skeletal Warrior Minion', radiusMetres: 0, band: 'slow', speed: 'slow', noArea: true });
  });

  it('the flag is set exactly when PoB gives no radius above 0; a small area reads slow without it', () => {
    const flag = (radiusMetres: number | undefined) => clearSpeedOf({ radiusMetres, usesPerSecond: 1, texts: [] });
    expect([undefined, Number.NaN, 0].map((r) => [flag(r).band, flag(r).noArea])).toEqual([
      ['slow', true],
      ['slow', true],
      ['slow', true],
    ]);
    expect([0.1, 1.8, 2, 4].map((r) => [flag(r).band, flag(r).noArea])).toEqual([
      ['slow', false],
      ['slow', false],
      ['medium', false],
      ['fast', false],
    ]);
  });

  it("the band stays slow with no area; D-353's steps still move the rough speed", () => {
    const death = clearSpeedOf({ radiusMetres: undefined, usesPerSecond: 1, texts: ['Enemies in the area will Combust on death.'] });
    expect({ band: death.band, noArea: death.noArea, onDeath: death.onDeath, speed: death.speed }).toEqual({ band: 'slow', noArea: true, onDeath: true, speed: 'medium' });
  });
});

describe("D-407 within the HG-12 grant: compile_plan's key-figure line is unchanged", () => {
  it("a skeleton's line prints no clear speed and no movement speed: the same line as its record without measures", () => {
    const withMeasures = record('area', 1.25);
    withMeasures.measures = stageMeasures(stage(), withMeasures, [], {});
    const without = record('area', 1.25);
    expect(keyFigureLine(withMeasures, main)).toBe(keyFigureLine(without, main));
    expect(keyFigureLine(withMeasures, main)).not.toMatch(/clear|movement/i);
  });

  it("a variant's line still ends with its rough clear speed, and prints no movement speed", () => {
    const rec = record('area', 1.25);
    rec.measures = stageMeasures(stage('entering-maps'), rec, [], {});
    const line = keyFigureLine(rec, main);
    expect(line).toMatch(/; clear medium \(rough\)$/);
    expect(line).not.toMatch(/movement|1\.25/i);
  });
});
