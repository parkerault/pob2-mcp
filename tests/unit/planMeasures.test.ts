/**
 * WU-65 (D-353, D-254, D-256): the pure parts of the endgame measures and the reference hits, without the engine.
 * The engine-required ACs (AC-P61…AC-P64) are in `tests/integration/compileMeasures.test.ts`; these pin the rules
 * at their edges: the clear-speed bands and steps kept within the bands, the on-death phrase list, an Arbiter
 * verdict at a ratio of exactly 1, and the reference hits from the committed data. WU-78 (D-378): a group that
 * names a minion skill has its minion's figure, `MinionTotalDPS`, as its damage figure, in the headline, the clear
 * measure and the key-figure line.
 */
import { describe, expect, it } from '@jest/globals';
import {
  arbiterMeasure,
  clearBand,
  clearEntryOf,
  clearSpeedOf,
  explodesOnDeath,
  figureField,
  headlineDps,
  stageMeasures,
  type MinionSkillRecord,
  type StageRecord,
} from '../../src/plan/record';
import { hitCeiling, keyFigureLine, referenceHits, rungAreaLevel, withReferenceHits } from '../../src/plan/compiler';
import { loadReferenceData } from '../../src/plan/referenceData';
import type { Stage } from '../../src/plan/schema';

describe('D-353: clearSpeed', () => {
  it('bands by radius: below 2 m slow, from 2 m below 4 m medium, 4 m or more fast; 0 when PoB gives none', () => {
    expect([0, 1.8, 1.99, 2, 3.99, 4, 9].map(clearBand)).toEqual(['slow', 'slow', 'slow', 'medium', 'medium', 'fast', 'fast']);
    expect(clearSpeedOf({ radiusMetres: undefined, usesPerSecond: 2, texts: [] })).toMatchObject({ radiusMetres: 0, band: 'slow', speed: 'slow' });
  });

  it('steps one band faster for on-death text and one slower for a use over 1 second, within the bands', () => {
    const at = (radiusMetres: number, usesPerSecond: number | undefined, text = '') => clearSpeedOf({ radiusMetres, usesPerSecond, texts: [text] }).speed;
    const death = 'Enemies in the area will Combust on death.';
    expect([at(1, 2, death), at(3, 2, death), at(5, 2, death)]).toEqual(['medium', 'fast', 'fast']);
    expect([at(1, 0.5), at(3, 0.5), at(5, 0.5)]).toEqual(['slow', 'slow', 'medium']);
    expect([at(3, 0.5, death), at(3, 1), at(3, undefined)]).toEqual(['medium', 'medium', 'medium']);
  });

  it('the phrase list: a sentence with a death phrase and an explode or spread phrase', () => {
    for (const text of [
      'Enemies in the warcry\'s area are destabilised and will Combust on death.',
      'Supports skills that can Poison enemies, causing Poisoned enemies to gain Plague over time and explode in a Plague Burst on death.',
      'If the enemy dies while affected by Contagion, it spreads itself, Curses, and other Chaos damage over time Debuffs on the target to nearby enemies.',
      'Supports Curses, spreading their effects when a Cursed enemy dies.',
    ]) {
      expect({ text, hit: explodesOnDeath(text) }).toEqual({ text, hit: true });
    }
    for (const text of [
      'At the end of your charge, a massive leaping Slam damages enemies and causes all nearby patches of Jagged Ground to explode.',
      'Supports Crossbow Skills, causing them to load a bolt into all Crossbow Ammunition on kill.',
      'Taking a Hit will cause the shield to absorb it, then explode.  The bone spike is itself a Minion. If it dies, shields disappear.',
    ]) {
      expect({ text, hit: explodesOnDeath(text) }).toEqual({ text, hit: false });
    }
  });
});

describe('D-363: the clear skill\'s stat set', () => {
  const outputs = {
    g1s1p1: { skill: 'Stampede: Footsteps', fields: { AreaOfEffectRadiusMetres: 1.2 } },
    g1s1p2: { skill: 'Stampede: Slam', fields: { AreaOfEffectRadiusMetres: 3.2 } },
    g2s1p1: { skill: 'Earthquake: Impact', fields: { AreaOfEffectRadiusMetres: 1.8 } },
  };
  const gem = (name: string) => ({ name, enabled: true });
  const stage = (main: { group: number; activeSkill: number; statSet?: number }, clearRole = false) =>
    ({
      skills: {
        main,
        groups: [
          { enabled: true, gems: [gem('Stampede')] },
          { enabled: true, gems: [gem('Earthquake')], ...(clearRole ? { role: 'clear' } : {}) },
        ],
      },
    }) as unknown as Pick<Stage, 'skills'>;

  it('reads the stat set the main selection names when the clear skill is the main skill', () => {
    expect(clearEntryOf(stage({ group: 1, activeSkill: 1, statSet: 2 }), outputs as never)?.key).toBe('g1s1p2');
  });

  it('reads the first stat set when the main selection names none, or when a clear group is set', () => {
    expect(clearEntryOf(stage({ group: 1, activeSkill: 1 }), outputs as never)?.key).toBe('g1s1p1');
    expect(clearEntryOf(stage({ group: 1, activeSkill: 1, statSet: 2 }, true), outputs as never)?.key).toBe('g2s1p1');
  });

  it('reads the main selection\'s stat set when the clear group is the main group', () => {
    expect(clearEntryOf(stage({ group: 2, activeSkill: 1, statSet: 1 }, true), outputs as never)?.key).toBe('g2s1p1');
    const both = stage({ group: 1, activeSkill: 1, statSet: 2 });
    (both.skills.groups[0] as { role?: string }).role = 'clear';
    expect(clearEntryOf(both, outputs as never)?.key).toBe('g1s1p2');
  });
});

describe('D-353: measures.arbiter', () => {
  const hits = [
    { id: 'slam', max: 3000, types: ['physical'] },
    { id: 'small', max: 1000, types: ['physical'] },
    { id: 'bolt', max: 2000, types: ['lightning'] },
    { id: 'split', max: 3000, types: ['physical', 'lightning'] },
  ];

  it('takes the largest hit per type and mix; a ratio of exactly 1 is one-shot; a mixed hit sums its halves', () => {
    const a = arbiterMeasure({ PhysicalMaximumHitTaken: 3000, LightningMaximumHitTaken: 4000 }, hits);
    expect(a.rows.map((r) => [r.type, r.hitId, r.ratio, r.verdict])).toEqual([
      ['physical', 'slam', 1, 'one-shot'],
      ['lightning', 'bolt', 0.5, 'survives'],
      ['physical-lightning', 'split', 1500 / 3000 + 1500 / 4000, 'survives'],
    ]);
    expect(a.rows[2].maxHit).toBeCloseTo(3000 / 0.875, 9);
    expect(a.verdict).toBe('one-shot');
    expect(a.worst).toEqual({ type: 'physical', hitId: 'slam', ratio: 1 });
  });

  it('has no verdict for a row PoB gave no max hit for', () => {
    const a = arbiterMeasure({ PhysicalMaximumHitTaken: 9000 }, hits);
    expect(a.rows.map((r) => r.verdict)).toEqual(['survives', null, null]);
    expect(a.verdict).toBeNull();
  });
});

describe("D-254, D-256: the reference hits from the committed data", () => {
  const ref = loadReferenceData();

  it("the rungs' area levels are 69, 79 and 82, and b's hits are 402 and 97", () => {
    expect(['entering-maps', 'budget', 'non-budget'].map((v) => rungAreaLevel(v as Stage['variant'] & string, ref).level)).toEqual([69, 79, 82]);
    expect(referenceHits('budget', ref).map((e) => [e.option, e.value])).toEqual([
      ['enemyPhysicalDamage', 402],
      ['enemyFireDamage', 97],
      ['enemyColdDamage', 97],
      ['enemyLightningDamage', 97],
      ['enemyChaosDamage', 97],
    ]);
    expect([hitCeiling(96.4789), hitCeiling(402.000003), hitCeiling(401.9956)]).toEqual([97, 402, 402]);
    for (const e of referenceHits('budget', ref)) expect(ref.resolveFact(e.source.file, e.source.key).ok).toBe(true);
  });

  it('fills only what an endgame stage omits, and leaves a campaign stage alone', () => {
    const stage = {
      variant: 'non-budget',
      config: { earned: [{ option: 'enemyFireDamage', value: 5 }], scenario: [{ option: 'enemyIsBoss', value: 'None' }] },
    } as unknown as Stage;
    const filled = withReferenceHits(stage, ref);
    expect(filled.config.earned).toEqual(stage.config.earned);
    expect(filled.config.scenario.map((e) => [e.option, e.value])).toEqual([
      ['enemyIsBoss', 'None'],
      ['enemyPhysicalDamage', 439],
      ['enemyColdDamage', 106],
      ['enemyLightningDamage', 106],
      ['enemyChaosDamage', 106],
    ]);
    const campaign = { ...stage, variant: undefined } as unknown as Stage;
    expect(withReferenceHits(campaign, ref)).toBe(campaign);
  });
});

describe("D-378 (WU-78): a group whose minion deals the damage", () => {
  const LEAP_SLAM: MinionSkillRecord = {
    group: 1, activeSkill: 1, summon: 'Wolf Pack', minion: 'Wolf Companion', minionId: 'WolfMinion', name: 'Leap Slam',
    index: 2, statSet: 1, statSets: ['Leap Slam'], skills: ['Basic Attack', 'Leap Slam'],
  };
  const fields = { TotalDPS: 0, Speed: 1, AreaOfEffectRadiusMetres: 0, MinionTotalDPS: 50, MinionSpeed: 0.5, MinionAreaOfEffectRadiusMetres: 4.5 };
  /** A stage record whose group 1 (count 3) is a Wolf Pack, its minion's selection in `minionSkills` when `minion`. */
  const record = (minion: boolean) =>
    ({
      loadoutName: 'Endgame budget (L80) {b}',
      level: 80,
      outputs: { TotalDPS: 0, MinionTotalDPS: 50, Life: 100, TotalEHP: 200 },
      countedOutputs: { group: 1, count: 3, dotCanStack: false, fields: { TotalDPS: 0, MinionTotalDPS: 150 } },
      skillOutputs: { g1s1p1: { skill: 'Wolf Pack', statSetLabel: 'Minion Info', fields } },
      countedSkillOutputs: { g1s1p1: { skill: 'Wolf Pack', statSetLabel: 'Minion Info', count: 3, dotCanStack: false, fields: { TotalDPS: 0, MinionTotalDPS: 150 } } },
      minionSkills: minion ? [LEAP_SLAM] : [],
      v1: { pass: true, findings: [], notes: [] },
      v2: { pass: true, findings: [], notes: [] },
    }) as unknown as StageRecord;
  const main = { group: 1, activeSkill: 1 };
  const stage = { variant: 'budget', skills: { main, groups: [{ enabled: true, role: 'single_target', gems: [{ name: 'Wolf Pack', enabled: true }] }] } } as unknown as Stage;

  it("the figure is MinionTotalDPS when the record holds the group's minion selection, else TotalDPS; the headline is it × Count", () => {
    expect([figureField(record(true), 1), figureField(record(false), 1), figureField(record(true), 2)]).toEqual(['MinionTotalDPS', 'TotalDPS', 'TotalDPS']);
    expect(headlineDps({ skills: { main } }, record(true))).toBe(150);
    expect(headlineDps({ skills: { main } }, record(false))).toBe(0);
    // Without the main entry, the main skill's counted figure.
    const noEntry = { ...record(true), countedSkillOutputs: {} } as StageRecord;
    expect(headlineDps({ skills: { main } }, noEntry)).toBe(150);
  });

  it("the clear measure reads the minion's area and use rate for a clear group that names a minion skill", () => {
    expect(stageMeasures(stage, record(true), [], {}).clearSpeed).toMatchObject({ radiusMetres: 4.5, usesPerSecond: 0.5, band: 'fast', speed: 'medium' });
    expect(stageMeasures(stage, record(false), [], {}).clearSpeed).toMatchObject({ radiusMetres: 0, usesPerSecond: 1, band: 'slow' });
    expect(stageMeasures(stage, record(true), [], {}).dps).toBe(150);
  });

  it("a clear group that isn't the main group and names a minion skill is measured at its summon, not at its first skill", () => {
    // Group 2 is a Pounce group: Pounce first, its summon (Summon Wolf, whose wolf uses Leap Slam) second.
    const pounce: MinionSkillRecord = { ...LEAP_SLAM, group: 2, activeSkill: 2, summon: 'Summon Wolf' };
    const two = {
      ...record(true),
      skillOutputs: {
        g1s1p1: { skill: 'Wolf Pack', statSetLabel: 'Minion Info', fields },
        g2s1p1: { skill: 'Pounce', statSetLabel: 'Pounce', fields: { AreaOfEffectRadiusMetres: 0, Speed: 2 } },
        g2s2p1: { skill: 'Summon Wolf', statSetLabel: 'Minion Info', fields: { MinionAreaOfEffectRadiusMetres: 2.5, MinionSpeed: 1.5 } },
      },
      minionSkills: [LEAP_SLAM, pounce],
    } as unknown as StageRecord;
    const withClear = {
      ...stage,
      skills: { main, groups: [...stage.skills.groups, { enabled: true, role: 'clear', gems: [{ name: 'Pounce', enabled: true }] }] },
    } as unknown as Stage;
    expect(stageMeasures(withClear, two, [], {}).clearSpeed).toMatchObject({ key: 'g2s2p1', skill: 'Summon Wolf', radiusMetres: 2.5, usesPerSecond: 1.5, speed: 'medium' });
    // Without the minion selection, its first skill, as before.
    const plain = { ...two, minionSkills: [LEAP_SLAM] } as StageRecord;
    expect(stageMeasures(withClear, plain, [], {}).clearSpeed).toMatchObject({ key: 'g2s1p1', radiusMetres: 0, usesPerSecond: 2 });
  });

  it('the key-figure line names the minion skill: DPS <n> (<minion skill>, minion)', () => {
    expect(keyFigureLine(record(true), main)).toMatch(/^ {2}Key figures: DPS 150 \(Leap Slam, minion\); life 100;/);
    expect(keyFigureLine(record(false), main)).toMatch(/^ {2}Key figures: DPS 0; life 100;/);
  });
});
