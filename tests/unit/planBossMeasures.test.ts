/**
 * WU-111 (amendment 11 §5, §9b; D-437, D-447): the record's new measures from hand-made compile replies, without the
 * engine. The engine bullets of AC-P81 are `tests/integration/compileBossMeasure.test.ts`; these pin the rules the
 * spec states in words, on figures chosen so each rule moves the result.
 *
 * - The damage figure (Names): `TotalDPS` × Count, `TotalDot` × Count only when it stacks, `IgniteDPS`, `BleedDPS` and
 *   `PoisonDPS` once; a minion's is `MinionTotalDPS` × Count.
 * - `damage.boss`, PoB alone (§9b): the untriggered entries summed, an ailment that doesn't stack counted once at its
 *   largest entry (a stacking one, listed as 0, stays in each figure); a triggered entry listed, not summed; with none
 *   to sum, the named source's figure at its hand-cast speed.
 * - `damage.map` (§5): the named source's figure, on its own weapon set, × its `CullMultiplier` only with `skills.cull`;
 *   `cull {map, boss}` its `CullPercent` under each, only with `skills.cull`.
 * - `trigger` (§5): when the named source's group holds an active skill of PoB's types `Meta` and `Triggers`; on a card
 *   skeleton too. `sourceTypes`: the named source's types, on every measured stage.
 * - WU-120 (amendment 12 §9, D-454): `damage.resisting`, the named source's figure from the resisting measure by the map
 *   figure's rule (its own Count, damage over time by the measure's own stacking, ailments once, a minion's
 *   `MinionTotalDPS`), × that measure's `CullMultiplier` only with `skills.cull`; absent without the measure.
 */
import { describe, expect, it } from '@jest/globals';
import type { StageSkillMeta } from '../../src/engine/schemas';
import {
  bossDamage,
  bossGroupOf,
  bossMeasureGroups,
  bossRotation,
  damageFigure,
  stageMeasures,
  type BossMeasureReply,
  type StageRecord,
} from '../../src/plan/record';
import type { Stage } from '../../src/plan/schema';

type Fields = Record<string, number>;
type Stacks = { dot: boolean; ignite: boolean; bleed: boolean; poison: boolean };
const meta = (over: { types?: string[]; triggered?: boolean; triggeredBy?: string; stacks?: Partial<Stacks> } = {}): StageSkillMeta => ({
  types: over.types ?? ['Attack', 'Melee'],
  triggered: over.triggered ?? false,
  ...(over.triggeredBy !== undefined ? { triggeredBy: over.triggeredBy } : {}),
  stacks: { dot: false, ignite: false, bleed: false, poison: false, ...(over.stacks ?? {}) },
});
const entry = (skill: string, fields: Fields) => ({ skill, statSetLabel: skill, fields });

describe('WU-111 (D-437): the damage figure', () => {
  it('hits × Count, damage over time × Count only when it stacks, each ailment once', () => {
    const fields = { TotalDPS: 100, TotalDot: 40, IgniteDPS: 30, BleedDPS: 20, PoisonDPS: 10, CombinedDPS: 9999, TotalDotDPS: 9999 };
    expect(damageFigure(fields, 3, false, false)).toBe(100 * 3 + 40 + 30 + 20 + 10);
    expect(damageFigure(fields, 3, true, false)).toBe(100 * 3 + 40 * 3 + 30 + 20 + 10);
    expect(damageFigure({ TotalDPS: 0 }, 2, false, false)).toBe(0);
    expect(damageFigure({ Speed: 1 }, 1, false, false)).toBeNull();
    expect(damageFigure(undefined, 1, false, false)).toBeNull();
  });

  it("a minion's figure is its MinionTotalDPS × Count, its ailments left out", () => {
    expect(damageFigure({ MinionTotalDPS: 50, MinionIgniteDPS: 500, TotalDPS: 7 }, 4, false, true)).toBe(200);
  });
});

/** The boss rotation's groups, as `bossGroupOf` reads them, from a hand-made boss measure. */
function groupsOf(stage: Pick<Stage, 'skills'>, boss: BossMeasureReply) {
  return bossRotation(stage).map((e) => bossGroupOf(stage, { minionSkills: [] }, boss, e));
}

/** A stage with groups 1 to 3 (group 3 counts 2) and an optional rotation. */
function stageWith(boss?: Stage['skills']['boss'], cull?: string): Pick<Stage, 'skills' | 'variant'> {
  const gems = [{ name: 'X', level: 1, quality: 0, enabled: true }];
  return {
    variant: 'non-budget',
    skills: {
      groups: [
        { enabled: true, role: 'single_target', gems },
        { enabled: true, role: 'single_target', gems },
        { enabled: true, role: 'clear', gems, count: 2, countReason: 'two totems' },
      ],
      main: { group: 1, activeSkill: 1 },
      rolledGroup: 1,
      ...(boss !== undefined ? { boss } : {}),
      ...(cull !== undefined ? { cull } : {}),
    },
  } as Pick<Stage, 'skills' | 'variant'>;
}

describe('WU-111 (D-447): the boss rotation and PoB alone', () => {
  const twoIgnite: BossMeasureReply = {
    skillOutputs: {
      g1s1p1: entry('Strike', { TotalDPS: 1000, IgniteDPS: 300, Speed: 1.2 }),
      g2s1p1: entry('Slam', { TotalDPS: 500, IgniteDPS: 450, PoisonDPS: 40, Speed: 0.8 }),
      g3s1p1: entry('Totem', { TotalDPS: 200, PoisonDPS: 60, Speed: 2 }),
    },
    skillMeta: { g1s1p1: meta(), g2s1p1: meta(), g3s1p1: meta() },
  };

  it('without skills.boss, the rotation is the named source alone, and the boss measure reads its group', () => {
    const s = stageWith();
    expect(bossRotation(s)).toEqual([{ group: 1, activeSkill: 1, statSet: 1, turns: false }]);
    expect(bossMeasureGroups(stageWith({ entries: [{ group: 3, activeSkill: 1, statSet: 1 }, { group: 2, activeSkill: 1, statSet: 1 }], note: 'n' }))).toEqual([1, 3, 2]);
  });

  it("two entries that both ignite sum their hits and only the larger ignite; poisons alike; an entry's turns is the plan's", () => {
    const s = stageWith({ entries: [{ group: 1, activeSkill: 1, statSet: 1 }, { group: 2, activeSkill: 1, statSet: 1, turns: true }], note: 'n' });
    const groups = groupsOf(s, twoIgnite);
    expect(groups.map((g) => ({ figure: g.figure, ignite: g.ignite, poison: g.poison, turns: g.turns, uses: g.usesPerSecond }))).toEqual([
      { figure: 1300, ignite: 300, poison: 0, turns: false, uses: 1.2 },
      { figure: 990, ignite: 450, poison: 40, turns: true, uses: 0.8 },
    ]);
    // Hits 1000 + 500, the larger ignite 450, the one poison 40.
    expect(bossDamage(groups, null)).toBe(1000 + 500 + 450 + 40);
  });

  it('the same for poison; with PoisonCanStack, both poisons stay in their figures (listed as 0)', () => {
    const s = stageWith({ entries: [{ group: 2, activeSkill: 1, statSet: 1 }, { group: 3, activeSkill: 1, statSet: 1 }], note: 'n' });
    // Group 3 counts 2: its hit is doubled, its poison once.
    expect(bossDamage(groupsOf(s, twoIgnite), null)).toBe(500 + 450 + 200 * 2 + 60);
    const stacking: BossMeasureReply = { ...twoIgnite, skillMeta: { ...twoIgnite.skillMeta, g2s1p1: meta({ stacks: { poison: true } }), g3s1p1: meta({ stacks: { poison: true } }) } };
    const groups = groupsOf(s, stacking);
    expect(groups.map((g) => g.poison)).toEqual([0, 0]);
    expect(bossDamage(groups, null)).toBe(500 + 450 + 40 + 200 * 2 + 60);
  });

  it('a triggered entry is listed with its meta gem and not summed; with none to sum, the named source\'s hand-cast figure', () => {
    const boss: BossMeasureReply = {
      ...twoIgnite,
      skillMeta: { ...twoIgnite.skillMeta, g1s1p1: meta({ triggered: true, triggeredBy: 'Cast on Critical' }), g2s1p1: meta({ triggered: true }) },
    };
    const s = stageWith({ entries: [{ group: 1, activeSkill: 1, statSet: 1 }, { group: 3, activeSkill: 1, statSet: 1 }], note: 'n' });
    const groups = groupsOf(s, boss);
    expect(groups.map((g) => [g.triggered, g.triggeredBy])).toEqual([[true, 'Cast on Critical'], [false, null]]);
    expect(bossDamage(groups, 1300)).toBe(200 * 2 + 60);
    // An inbuilt or item trigger: triggered, by no meta gem.
    expect(groupsOf(stageWith({ entries: [{ group: 2, activeSkill: 1, statSet: 1 }], note: 'n' }), boss).map((g) => [g.triggered, g.triggeredBy])).toEqual([[true, null]]);
    // Only triggered entries: the fallback, the named source's figure at its hand-cast speed.
    expect(bossDamage(groupsOf(stageWith({ entries: [{ group: 1, activeSkill: 1, statSet: 1 }], note: 'n' }), boss), 1300)).toBe(1300);
  });

  it("a minion's ailments are listed and take no part in the sum (its figure is MinionTotalDPS)", () => {
    const boss: BossMeasureReply = {
      skillOutputs: { g1s1p1: entry('Wolf', { MinionTotalDPS: 100, MinionIgniteDPS: 70, MinionSpeed: 1.1 }), g2s1p1: entry('Slam', { TotalDPS: 500, IgniteDPS: 40 }) },
      skillMeta: { g1s1p1: meta(), g2s1p1: meta() },
    };
    const s = stageWith({ entries: [{ group: 1, activeSkill: 1, statSet: 1 }, { group: 2, activeSkill: 1, statSet: 1 }], note: 'n' });
    const groups = groupsOf(s, boss);
    expect(groups.map((g) => ({ figure: g.figure, ignite: g.ignite, uses: g.usesPerSecond }))).toEqual([
      { figure: 100, ignite: 70, uses: 1.1 },
      { figure: 540, ignite: 40, uses: null },
    ]);
    expect(bossDamage(groups, null)).toBe(100 + 540);
  });
});

/** A record for stage `s` with set-1 and set-2 figures for its named source (group 1). */
function record(set1: Fields, set2?: Fields): Pick<StageRecord, 'outputs' | 'skillOutputs' | 'skillOutputsSet2' | 'countedOutputs' | 'countedSkillOutputs' | 'minionSkills'> {
  return {
    outputs: { TotalEHP: 5000 },
    skillOutputs: {
      g1s1p1: entry('Cast on Critical', { TotalDPS: 0 }),
      g1s2p1: entry('Spark', set1),
      g2s1p1: entry('Slam', { TotalDPS: 10 }),
    },
    ...(set2 !== undefined ? { skillOutputsSet2: { g1s2p1: entry('Spark', set2), g1s1p1: entry('Cast on Critical', { TotalDPS: 0 }) } } : {}),
    countedOutputs: { group: 1, count: 1, dotCanStack: false, fields: {} },
    countedSkillOutputs: { g1s2p1: { skill: 'Spark', statSetLabel: 'Spark', count: 1, dotCanStack: false, fields: { TotalDPS: set1.TotalDPS } } },
    minionSkills: [],
  };
}

describe('WU-111 (D-437): the named source\'s figures, cull, trigger and types', () => {
  const coc = meta({ types: ['Buff', 'Meta', 'Persistent', 'Triggers'] });
  const spark = meta({ types: ['Projectile', 'Spell', 'Triggered'], triggered: true, triggeredBy: 'Cast on Critical' });
  const stage = (over: Partial<Stage['skills']> = {}, variant: Stage['variant'] | null = 'non-budget'): Pick<Stage, 'skills' | 'variant'> => {
    const gems = [{ name: 'X', level: 1, quality: 0, enabled: true }];
    return {
      ...(variant !== null ? { variant } : {}),
      skills: {
        groups: [{ enabled: true, role: 'single_target', gems }, { enabled: true, role: 'clear', gems }],
        main: { group: 1, activeSkill: 2, statSet: 1 },
        rolledGroup: 1,
        ...over,
      },
    } as Pick<Stage, 'skills' | 'variant'>;
  };
  const boss: BossMeasureReply = {
    skillOutputs: { g1s2p1: entry('Spark', { TotalDPS: 40, CullPercent: 10, CullMultiplier: 100 / 90, Speed: 1.5 }) },
    skillMeta: { g1s2p1: spark },
  };
  const pob = { skillMeta: { g1s1p1: coc, g1s2p1: spark, g2s1p1: meta() }, boss };

  it('the map figure carries the CullMultiplier and cull holds both thresholds only with skills.cull', () => {
    const rec = record({ TotalDPS: 80, IgniteDPS: 5, CullPercent: 30, CullMultiplier: 100 / 70, Speed: 1.5 });
    const plain = stageMeasures(stage(), rec, [], {}, undefined, pob);
    expect(plain.damage).toEqual({ map: 85, boss: 40 });
    expect(plain.cull).toBeUndefined();
    const culled = stageMeasures(stage({ cull: 'test: Culling Strike on Spark' }), rec, [], {}, undefined, pob);
    expect(culled.damage!.map).toBeCloseTo(85 * (100 / 70), 9);
    expect(culled.damage!.boss).toBe(40);
    expect(culled.cull).toEqual({ map: 30, boss: 10 });
  });

  it('a named source on weapon set 2 is read from set 2', () => {
    const rec = record({ TotalDPS: 80, Speed: 1.5 }, { TotalDPS: 120, Speed: 1.4 });
    const onTwo = stage({ groups: [{ enabled: true, role: 'single_target', gems: [{ name: 'X', level: 1, quality: 0, enabled: true }], weaponSet: 2 }, { enabled: true, role: 'clear', gems: [{ name: 'X', level: 1, quality: 0, enabled: true }] }] });
    const m = stageMeasures(onTwo, rec, [], {}, undefined, { ...pob, skillMetaSet2: { g1s1p1: coc, g1s2p1: spark } });
    expect(m.damage!.map).toBe(120);
    expect(m.trigger).toEqual({ by: 'Cast on Critical', usesPerSecond: 1.4 });
  });

  it("a group with a Meta-and-Triggers gem gives trigger {by, usesPerSecond} on a variant and on a skeleton stage, with the named source's types", () => {
    const rec = record({ TotalDPS: 80, Speed: 1.46 });
    for (const variant of ['non-budget', null] as const) {
      const m = stageMeasures(stage({}, variant), rec, [], {}, undefined, pob);
      expect({ variant, trigger: m.trigger, types: m.sourceTypes }).toEqual({
        variant,
        trigger: { by: 'Cast on Critical', usesPerSecond: 1.46 },
        types: ['Projectile', 'Spell', 'Triggered'],
      });
      // A skeleton has no damage or boss measures (no boss measure is made for it).
      if (variant === null) expect([m.damage, m.bossGroups, m.dps]).toEqual([undefined, undefined, undefined]);
    }
    // No such gem in the group: no trigger.
    const plain = stageMeasures(stage(), rec, [], {}, undefined, { ...pob, skillMeta: { ...pob.skillMeta, g1s1p1: meta({ types: ['Buff', 'Meta'] }) } });
    expect(plain.trigger).toBeUndefined();
  });
});

describe('WU-120 (D-454): the resisting figure', () => {
  const stage = (over: Partial<Stage['skills']> = {}): Pick<Stage, 'skills' | 'variant'> => {
    const gems = [{ name: 'X', level: 1, quality: 0, enabled: true }];
    return {
      variant: 'non-budget',
      skills: { groups: [{ enabled: true, role: 'single_target', gems, count: 3 }], main: { group: 1, activeSkill: 1, statSet: 1 }, rolledGroup: 1, ...over },
    } as Pick<Stage, 'skills' | 'variant'>;
  };
  const rec = {
    outputs: { TotalEHP: 5000 },
    skillOutputs: { g1s1p1: entry('Frostbolt', { TotalDPS: 100, TotalDot: 10, IgniteDPS: 7, CullMultiplier: 1.25 }) },
    countedOutputs: { group: 1, count: 3, dotCanStack: false, fields: {} },
    countedSkillOutputs: { g1s1p1: { skill: 'Frostbolt', statSetLabel: 'Frostbolt', count: 3, dotCanStack: false, fields: { TotalDPS: 300 } } },
    minionSkills: [],
  } as Pick<StageRecord, 'outputs' | 'skillOutputs' | 'countedOutputs' | 'countedSkillOutputs' | 'minionSkills'>;
  const boss: BossMeasureReply = { skillOutputs: { g1s1p1: entry('Frostbolt', { TotalDPS: 50 }) }, skillMeta: { g1s1p1: meta() } };
  const resisting = (fields: Fields, stacks: Partial<Stacks> = {}) => ({ skillOutputs: { g1s1p1: entry('Frostbolt', fields) }, skillMeta: { g1s1p1: meta({ stacks }) } });

  it("is the named source's figure in the resisting measure, by the map figure's rule: hits × Count, damage over time × Count only when it stacks there, ailments once", () => {
    const m = stageMeasures(stage(), rec, [], {}, undefined, { boss, resisting: resisting({ TotalDPS: 60, TotalDot: 6, IgniteDPS: 4 }) });
    expect(m.damage).toEqual({ map: 300 + 10 + 7, boss: 150, resisting: 60 * 3 + 6 + 4 });
    const stacking = stageMeasures(stage(), rec, [], {}, undefined, { boss, resisting: resisting({ TotalDPS: 60, TotalDot: 6 }, { dot: true }) });
    expect(stacking.damage!.resisting).toBe(60 * 3 + 6 * 3);
  });

  it("carries the resisting measure's own CullMultiplier only with skills.cull, as the map figure does", () => {
    const fields = { TotalDPS: 60, CullMultiplier: 1.1 };
    expect(stageMeasures(stage(), rec, [], {}, undefined, { boss, resisting: resisting(fields) }).damage!.resisting).toBe(180);
    const culled = stageMeasures(stage({ cull: 'test: a cull' }), rec, [], {}, undefined, { boss, resisting: resisting(fields) });
    expect(culled.damage!.resisting).toBeCloseTo(180 * 1.1, 9);
    expect(culled.damage!.map).toBeCloseTo(317 * 1.25, 9);
  });

  it("a minion's figure is its MinionTotalDPS × Count; null when PoB gives none; absent without the resisting measure", () => {
    expect(stageMeasures(stage(), rec, [], {}, undefined, { boss, resisting: resisting({ MinionTotalDPS: 20, MinionIgniteDPS: 5 }) }).damage!.resisting).toBe(60);
    expect(stageMeasures(stage(), rec, [], {}, undefined, { boss, resisting: resisting({ Speed: 1 }) }).damage!.resisting).toBeNull();
    expect('resisting' in stageMeasures(stage(), rec, [], {}, undefined, { boss }).damage!).toBe(false);
  });
});
