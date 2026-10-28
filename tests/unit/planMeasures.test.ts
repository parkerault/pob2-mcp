/**
 * WU-65 (D-353, D-254, D-256): the pure parts of the endgame measures and the reference hits, without the engine.
 * The engine-required ACs (AC-P61…AC-P64) are in `tests/integration/compileMeasures.test.ts`; these pin the rules
 * at their edges: the clear-speed bands and steps kept within the bands, the on-death phrase list, an Arbiter
 * verdict at a ratio of exactly 1, and the reference hits from the committed data. WU-78 (D-378): a group that
 * names a minion skill has its minion's figure, `MinionTotalDPS`, as its damage figure, in the headline, the clear
 * measure and the key-figure line. WU-80 (D-397): so does a plain summon, which names none, when its skill's entry
 * carries `Minion<Field>` fields; the player's skill keeps `TotalDPS`.
 *
 * WU-120 (amendment 12 §4, §9, Appendix A; D-449, D-454): the toughness reading's pure rules, on figures chosen so each
 * rule moves the result: the lowest max hit with the immune types left out; the chance layers' factor and share; an
 * immune type's Arbiter row and a max hit of 0; hits survived per hit (Names: the full hit, else evade plus the rest
 * deflected when the deflected hit is survived, else evade), the least over the type's hits, an unevadable hit's evade
 * chance 0; the deflected ratio by the pass's max hits or by formula; `avoid` only when the build evades or deflects at
 * the Arbiter; the deciding row; and the key-figure line's three damage figures, lowest max hit and hits survived.
 * The engine-required AC-P84 is in `tests/integration/compileMeasures.test.ts` and `compileBossMeasure.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import type { StageArbiterChances } from '../../src/engine/schemas';
import {
  arbiterHitsOf,
  arbiterMeasure,
  chanceOf,
  clearBand,
  decidingRow,
  lowestMaxHitOf,
  toughnessOf,
  clearEntryOf,
  clearSpeedOf,
  explodesOnDeath,
  figureField,
  headlineDps,
  stageMeasures,
  summonsMinion,
  type ArbiterHit,
  type ArbiterMeasure,
  type MinionSkillRecord,
  type StageRecord,
} from '../../src/plan/record';
import type { Fact } from '../../src/plan/referenceData';
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

  /** A stage record whose group 1 (count 3) is the player's Boneshatter: its entry carries no `Minion<Field>` field. */
  const player = {
    ...record(false),
    outputs: { TotalDPS: 40, Life: 100, TotalEHP: 200 },
    countedOutputs: { group: 1, count: 3, dotCanStack: false, fields: { TotalDPS: 120 } },
    skillOutputs: { g1s1p1: { skill: 'Boneshatter', statSetLabel: 'Boneshatter', fields: { TotalDPS: 40, Speed: 1, AreaOfEffectRadiusMetres: 1.2 } } },
    countedSkillOutputs: { g1s1p1: { skill: 'Boneshatter', statSetLabel: 'Boneshatter', count: 3, dotCanStack: false, fields: { TotalDPS: 120 } } },
  } as unknown as StageRecord;

  it("the figure is MinionTotalDPS when the record holds the group's minion selection (D-378) or the selected skill's entry carries Minion<Field> fields (a plain summon, D-397), else TotalDPS; the headline is it × Count", () => {
    expect([figureField(record(true), main), figureField(record(false), main), figureField(player, main)]).toEqual(['MinionTotalDPS', 'MinionTotalDPS', 'TotalDPS']);
    // A selection the record has no entry for reads TotalDPS, unless its group names a minion skill.
    expect([figureField(record(false), { group: 2, activeSkill: 1 }), figureField(record(false), { group: 1, activeSkill: 1, statSet: 2 })]).toEqual(['TotalDPS', 'TotalDPS']);
    expect(figureField(record(true), { group: 1, activeSkill: 1, statSet: 2 })).toBe('MinionTotalDPS');
    expect(headlineDps({ skills: { main } }, record(true))).toBe(150);
    // D-397: a plain summon, which names no minion skill, is read by its minion too (D-378 alone read TotalDPS, 0).
    expect(headlineDps({ skills: { main } }, record(false))).toBe(150);
    expect(stageMeasures(stage, record(false), [], {}).dps).toBe(150);
    // The player's skill keeps TotalDPS × Count.
    expect(headlineDps({ skills: { main } }, player)).toBe(120);
    // Without the main entry, the main skill's counted figure.
    const noEntry = { ...record(true), countedSkillOutputs: {} } as StageRecord;
    expect(headlineDps({ skills: { main } }, noEntry)).toBe(150);
  });

  it("summonsMinion: a skill's figures are its minion's when they carry a Minion<Field> field, as the checker (D-385) and get_passive_upgrades' calc_with base (D-388) test it", () => {
    expect(summonsMinion(fields)).toBe(true);
    expect(summonsMinion({ MinionLife: 10 })).toBe(true);
    // get_passive_upgrades' base: calc_with returns MinionTotalDPS only when the main skill summons a minion.
    expect(summonsMinion({ CombinedDPS: 0, TotalDPS: 0, MinionTotalDPS: 12, TotalEHP: 300, Life: 200 })).toBe(true);
    expect(summonsMinion({ CombinedDPS: 40, TotalDPS: 40, TotalEHP: 300, Life: 200 })).toBe(false);
    expect([summonsMinion({ Minion: 1, Minionx: 2 }), summonsMinion({}), summonsMinion(undefined)]).toEqual([false, false, false]);
  });

  it("the clear measure reads the minion's area and use rate for a clear group that names a minion skill, or a plain summon (D-397); the player's skill reads its own", () => {
    expect(stageMeasures(stage, record(true), [], {}).clearSpeed).toMatchObject({ radiusMetres: 4.5, usesPerSecond: 0.5, band: 'fast', speed: 'medium' });
    // D-397: a plain summon (no minion skill named, its entry carries Minion<Field> fields) is measured by its minion,
    // not by the player's radius of 0 and use rate of 1.
    expect(stageMeasures(stage, record(false), [], {}).clearSpeed).toMatchObject({ radiusMetres: 4.5, usesPerSecond: 0.5, band: 'fast', speed: 'medium' });
    expect(stageMeasures(stage, player, [], {}).clearSpeed).toMatchObject({ radiusMetres: 1.2, usesPerSecond: 1, band: 'slow', speed: 'slow' });
    expect(stageMeasures(stage, record(true), [], {}).dps).toBe(150);
  });

  it("a clear group that isn't the main group and is a plain summon is measured by its minion (D-397)", () => {
    const withClear = {
      ...stage,
      skills: { main, groups: [...stage.skills.groups, { enabled: true, role: 'clear', gems: [{ name: 'Skeletal Warrior', enabled: true }] }] },
    } as unknown as Stage;
    const rec = {
      ...player,
      skillOutputs: {
        ...player.skillOutputs,
        g2s1p1: { skill: 'Skeletal Warrior Minion', statSetLabel: 'Minion Info', fields: { MinionTotalDPS: 30, MinionAreaOfEffectRadiusMetres: 2.5, MinionSpeed: 1.5 } },
      },
    } as unknown as StageRecord;
    expect(stageMeasures(withClear, rec, [], {}).clearSpeed).toMatchObject({ key: 'g2s1p1', radiusMetres: 2.5, usesPerSecond: 1.5, band: 'medium' });
    // The headline stays the player's main skill's.
    expect(stageMeasures(withClear, rec, [], {}).dps).toBe(120);
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

  it('the key-figure line names the minion skill: DPS <n> (<minion skill>, minion); a plain summon by its skill (D-397); the player\'s skill names none', () => {
    expect(keyFigureLine(record(true), main)).toMatch(/^ {2}Key figures: DPS 150 \(Leap Slam, minion\); life 100;/);
    expect(keyFigureLine(record(false), main)).toMatch(/^ {2}Key figures: DPS 150 \(Wolf Pack, minion\); life 100;/);
    expect(keyFigureLine(player, main)).toMatch(/^ {2}Key figures: DPS 120; life 100;/);
  });
});

describe('WU-120 (D-449): the toughness reading', () => {
  const MAX = (p: number, f: number, c: number, l: number, x?: number) => ({
    PhysicalMaximumHitTaken: p,
    FireMaximumHitTaken: f,
    ColdMaximumHitTaken: c,
    LightningMaximumHitTaken: l,
    ...(x !== undefined ? { ChaosMaximumHitTaken: x } : {}),
  });

  it('the lowest max hit is the least of the five with its type; an immune type (no finite max hit) is left out', () => {
    expect(lowestMaxHitOf(MAX(3000, 2500, 4000, 2600, 2700))).toEqual({ type: 'fire', value: 2500 });
    // Chaos Inoculation: PoB's chaos max hit is infinite, so the outputs lack it and the reply lists chaos as immune.
    expect(lowestMaxHitOf(MAX(3000, 2500, 4000, 2600), ['chaos'])).toEqual({ type: 'fire', value: 2500 });
    expect(lowestMaxHitOf(MAX(3000, 2500, 4000, 2600, 100), ['chaos'])).toEqual({ type: 'fire', value: 2500 });
    expect(lowestMaxHitOf({})).toBeNull();
  });

  it("the chance layers: factor = 1 ÷ ((1 − notHit/100) × damage/100) and share = 1 − 1 ÷ factor, from PoB's ConfiguredNotHitChance and ConfiguredDamageChance", () => {
    const c = chanceOf({ ConfiguredNotHitChance: 65, ConfiguredDamageChance: 92 })!;
    expect(c.notHit).toBe(65);
    expect(c.damage).toBe(92);
    expect(c.factor).toBeCloseTo(1 / (0.35 * 0.92), 12);
    expect(c.share).toBeCloseTo(1 - 1 / c.factor!, 12);
    expect(chanceOf({ ConfiguredNotHitChance: 0, ConfiguredDamageChance: 100 })).toEqual({ notHit: 0, damage: 100, factor: 1, share: 0 });
    // Nothing gets through: no factor, every bit of the EHP from chance layers.
    expect(chanceOf({ ConfiguredNotHitChance: 100, ConfiguredDamageChance: 100 })).toEqual({ notHit: 100, damage: 100, factor: null, share: 1 });
    expect(chanceOf({ ConfiguredNotHitChance: 50 })).toBeNull();
  });

  it("toughness holds the stage's own lowest max hit, its immune types and its chance layers, and on n the conditioned read", () => {
    const outputs = { ...MAX(3000, 2500, 4000, 2600), ConfiguredNotHitChance: 50, ConfiguredDamageChance: 80 };
    expect(toughnessOf(outputs, ['chaos'])).toEqual({ lowestMaxHit: { type: 'fire', value: 2500 }, immune: ['chaos'], chance: chanceOf(outputs) });
    const n = toughnessOf(outputs, [], { ehp: 9000, maxHits: MAX(2000, 2400, 3000, 2100, 1900), immune: [] });
    expect(n.conditioned).toEqual({ ehp: 9000, lowestMaxHit: { type: 'chaos', value: 1900 } });
    expect(toughnessOf(outputs, [], { maxHits: {}, immune: [] }).conditioned).toEqual({ ehp: null, lowestMaxHit: null });
  });
});

describe('WU-120 (D-449): the Arbiter rows, hits survived and the deciding row', () => {
  const fact = (value: unknown): Fact => ({ value, source: 's', patch: '0.5.5', confidence: 'H' }) as unknown as Fact;
  const SLAM: ArbiterHit = { id: 'slam', max: 3500, types: ['physical'] };
  const SLAM2: ArbiterHit = { id: 'slam-2', max: 3300, types: ['physical'] };
  const BOLT: ArbiterHit = { id: 'bolt', max: 4000, types: ['lightning'] };
  const SPLIT: ArbiterHit = { id: 'split', max: 3500, types: ['physical', 'lightning'] };
  const CHAOS: ArbiterHit = { id: 'chaos-hit', max: 3000, types: ['chaos'] };
  const chances = (over: Partial<StageArbiterChances> = {}): StageArbiterChances => ({ accuracy: 3786, evade: 40, deflect: 70, deflectEffect: 40, method: 'pass', ...over });
  const row = (a: ArbiterMeasure, type: string) => a.rows.find((r) => r.type === type)!;

  it("arbiterHitsOf reads hits.<id>.evadable: false as unevadable; absent or true is evadable", () => {
    const facts = {
      'hits.a': fact({ min: 1, max: 10 }),
      'hits.a.type': fact('physical'),
      'hits.a.evadable': fact(false),
      'hits.b': fact({ min: 1, max: 20 }),
      'hits.b.type': fact('physical'),
      'hits.c': fact({ min: 1, max: 30 }),
      'hits.c.type': fact('lightning'),
      'hits.c.evadable': fact(true),
    };
    expect(arbiterHitsOf(facts).map((h) => [h.id, h.evadable])).toEqual([['a', false], ['b', true], ['c', true]]);
  });

  it("an immune type's row is ratio 0, survives, immune, with a verdict; a mixed row's immune part counts 0 and the row reads the other part", () => {
    const a = arbiterMeasure(MAXH(3000, 4000), [SLAM, BOLT, SPLIT, CHAOS], { immune: ['chaos'] });
    expect(row(a, 'chaos')).toMatchObject({ ratio: 0, verdict: 'survives', immune: true, maxHit: null, hitsSurvived: 100 });
    const l = arbiterMeasure(MAXH(3000), [SLAM, BOLT, SPLIT], { immune: ['lightning'] });
    expect(row(l, 'lightning')).toMatchObject({ ratio: 0, verdict: 'survives', immune: true });
    const split = row(l, 'physical-lightning');
    expect(split.immune).toBeUndefined();
    expect(split.ratio).toBeCloseTo(1750 / 3000, 12);
    expect(split.maxHit).toBeCloseTo(3500 / (1750 / 3000), 9);
    expect(split.parts).toEqual([
      { type: 'physical', hit: 1750, maxHit: 3000, ratio: 1750 / 3000 },
      { type: 'lightning', hit: 1750, maxHit: null, ratio: 0, immune: true },
    ]);
    // A row with no max hit and no immunity stays without a verdict, as before.
    expect(row(arbiterMeasure(MAXH(3000), [SLAM, BOLT]), 'lightning')).toMatchObject({ ratio: null, verdict: null, hitsSurvived: null });
  });

  it('a max hit of 0 is a one-shot', () => {
    const a = arbiterMeasure({ PhysicalMaximumHitTaken: 0, LightningMaximumHitTaken: 9000 }, [SLAM, BOLT, SPLIT]);
    expect(row(a, 'physical')).toMatchObject({ maxHit: 0, ratio: null, verdict: 'one-shot', hitsSurvived: 0 });
    expect(row(a, 'physical-lightning')).toMatchObject({ maxHit: 0, ratio: null, verdict: 'one-shot' });
    expect(a.verdict).toBe('one-shot');
  });

  it("hits survived per hit (Names): 100 for a survived full hit; evade + (100 − evade) × deflect when the deflected hit is survived; else evade", () => {
    // physical: 3500 over 3000 (one-shot), deflected (pass) 3500 over 6000 (survives): 40 + 60 × 0.7 = 82.
    // lightning: 4000 over 2000 (one-shot), deflected 4000 over 3000 (kills too): evade only, 40.
    const deflected = { maxHits: MAXH(6000, 3000), immune: [] };
    const a = arbiterMeasure(MAXH(3000, 2000), [SLAM, BOLT], { chances: chances({ deflected }) });
    expect(row(a, 'physical')).toMatchObject({ verdict: 'one-shot', deflectedVerdict: 'survives', hitsSurvived: 82 });
    expect(row(a, 'physical').deflectedRatio).toBeCloseTo(3500 / 6000, 12);
    expect(row(a, 'lightning')).toMatchObject({ verdict: 'one-shot', deflectedVerdict: 'one-shot', hitsSurvived: 40 });
    expect(row(a, 'lightning').deflectedRatio).toBeCloseTo(4000 / 3000, 12);
    // A survived full hit is 100.
    expect(row(arbiterMeasure(MAXH(9000, 9000), [SLAM, BOLT], { chances: chances({ deflected }) }), 'physical').hitsSurvived).toBe(100);
    // Without deflection the evade chance alone; no deflected ratio.
    const ev = arbiterMeasure(MAXH(3000, 2000), [SLAM, BOLT], { chances: chances({ deflect: 0 }) });
    expect(row(ev, 'physical')).toMatchObject({ hitsSurvived: 40, deflectedRatio: null, deflectedVerdict: null });
    // Without any chance at the Arbiter: 100 or 0, and no avoid.
    const none = arbiterMeasure(MAXH(3000, 9000), [SLAM, BOLT], { chances: chances({ evade: 0, deflect: 0 }) });
    expect(none.rows.map((r) => r.hitsSurvived)).toEqual([0, 100]);
    expect(none.avoid).toBeUndefined();
  });

  it('the deflected ratio by formula: the ratio × (1 − DeflectEffect / 100) when the pass gave no max hits', () => {
    const a = arbiterMeasure(MAXH(3000, 2000), [SLAM, BOLT], { chances: chances({ method: 'formula' }) });
    expect(row(a, 'physical').deflectedRatio).toBeCloseTo((3500 / 3000) * 0.6, 12);
    expect(row(a, 'lightning').deflectedRatio).toBeCloseTo((4000 / 2000) * 0.6, 12);
    expect(a.avoid).toEqual({ accuracy: 3786, evade: 40, deflect: 70, deflectEffect: 40, method: 'formula' });
    // A pass's method with no deflected max hits reads by formula, and says so.
    expect(arbiterMeasure(MAXH(3000, 2000), [SLAM, BOLT], { chances: chances() }).avoid!.method).toBe('formula');
    expect(arbiterMeasure(MAXH(3000, 2000), [SLAM, BOLT], { chances: chances({ deflected: { maxHits: MAXH(5000, 3000), immune: [] } }) }).avoid!.method).toBe('pass');
  });

  it("PG-100: avoid carries a companion's share of deflected hits when the build has one, and nothing at 0", () => {
    expect(arbiterMeasure(MAXH(3000, 2000), [SLAM, BOLT], { chances: chances({ companionDeflected: 30 }) }).avoid!.companionDeflected).toBe(30);
    expect('companionDeflected' in arbiterMeasure(MAXH(3000, 2000), [SLAM, BOLT], { chances: chances({ companionDeflected: 0 }) }).avoid!).toBe(false);
  });

  it("an unevadable hit's evade chance is 0; the row keeps the least over its type's hits, so an unevadable smaller hit sets it; other rows don't change", () => {
    const deflected = { maxHits: MAXH(6000, 3000), immune: [] };
    const base = arbiterMeasure(MAXH(3000, 2000), [SLAM, SLAM2, BOLT], { chances: chances({ deflected }) });
    expect(row(base, 'physical').hitsSurvived).toBe(82);
    // The slam unevadable: 0 + 100 × 0.7 = 70.
    const slam = arbiterMeasure(MAXH(3000, 2000), [{ ...SLAM, evadable: false }, SLAM2, BOLT], { chances: chances({ deflected }) });
    expect(row(slam, 'physical')).toMatchObject({ hitId: 'slam', hitsSurvived: 70 });
    expect(row(slam, 'lightning')).toEqual(row(base, 'lightning'));
    // Slam 2 (smaller, also one-shot at 3300 over 3000) unevadable: the row is still the slam's, its hits survived slam 2's.
    const smaller = arbiterMeasure(MAXH(3000, 2000), [SLAM, { ...SLAM2, evadable: false }, BOLT], { chances: chances({ deflected }) });
    expect(row(smaller, 'physical')).toMatchObject({ hitId: 'slam', hit: 3500, verdict: 'one-shot', hitsSurvived: 70 });
    expect(row(smaller, 'physical').ratio).toBeCloseTo(3500 / 3000, 12);
    // An unevadable smaller hit the build survives in full counts 100: the row keeps the slam's 82.
    const survived = arbiterMeasure(MAXH(3400, 2000), [SLAM, { ...SLAM2, evadable: false }, BOLT], { chances: chances({ deflected }) });
    expect(row(survived, 'physical').hitsSurvived).toBe(82);
  });

  it('the deciding row: the one-shot row with the lowest hits survived, else the largest ratio; a record without hits survived reads its worst', () => {
    // lightning 1.2 clears on evasion (deflected survives: 82), physical 1.05 under it (deflected kills: 40).
    const a = arbiterMeasure(MAXH(3500 / 1.05, 4000 / 1.2), [SLAM, BOLT], {
      chances: chances({ deflected: { maxHits: MAXH(3400, 9000), immune: [] } }),
    });
    expect([row(a, 'physical').hitsSurvived, row(a, 'lightning').hitsSurvived]).toEqual([40, 82]);
    expect(a.worst!.type).toBe('lightning');
    expect(decidingRow(a)!.type).toBe('physical');
    const survives = arbiterMeasure(MAXH(9000, 8000), [SLAM, BOLT]);
    expect(decidingRow(survives)!.type).toBe('lightning');
    const old = arbiterMeasure(MAXH(3000, 2000), [SLAM, BOLT]);
    for (const r of old.rows) delete r.hitsSurvived;
    expect(decidingRow(old)!.type).toBe(old.worst!.type);
  });

  it("stageMeasures reads the Arbiter rows from the Pinnacle pass's max hits, immune types and chances when the boss measure has them", () => {
    const rec = {
      outputs: { ...MAXH(9000, 9000), TotalEHP: 5000 },
      countedOutputs: { group: 1, count: 1, dotCanStack: false, fields: {} },
      skillOutputs: {},
      countedSkillOutputs: {},
      minionSkills: [],
    } as unknown as StageRecord;
    const st = { variant: 'budget', skills: { main: { group: 1, activeSkill: 1 }, groups: [{ enabled: true, role: 'clear', gems: [] }] } } as unknown as Stage;
    const boss = { skillOutputs: {}, skillMeta: {}, maxHits: MAXH(3000, 2000), immune: ['chaos'], arbiter: chances({ deflected: { maxHits: MAXH(6000, 3000), immune: ['chaos'] } }) };
    const m = stageMeasures(st, rec, [SLAM, BOLT, CHAOS], {}, undefined, { boss, immune: [] });
    expect(m.arbiter).toEqual(arbiterMeasure(MAXH(3000, 2000), [SLAM, BOLT, CHAOS], { immune: ['chaos'], chances: boss.arbiter }));
    expect(row(m.arbiter!, 'physical').maxHit).toBe(3000);
    expect(m.toughness).toEqual({ lowestMaxHit: { type: 'physical', value: 9000 }, immune: [], chance: null });
  });
});

describe('WU-120 (Appendix A): the key-figure line', () => {
  const MAX = MAXH(3451, 9000);
  const rec = (measures: Record<string, unknown>) =>
    ({
      loadoutName: 'Non-budget (L90) {n}',
      level: 90,
      outputs: { TotalDPS: 100, Life: 4000, EnergyShield: 0, TotalEHP: 17900, FireResist: 75, ColdResist: 75, LightningResist: 75, ChaosResist: 0, ...MAX },
      countedOutputs: { group: 1, count: 1, dotCanStack: false, fields: { TotalDPS: 100 } },
      skillOutputs: { g1s1p1: { skill: 'Twister', statSetLabel: 'Twister', fields: { TotalDPS: 100 } } },
      countedSkillOutputs: { g1s1p1: { skill: 'Twister', statSetLabel: 'Twister', count: 1, dotCanStack: false, fields: { TotalDPS: 100 } } },
      minionSkills: [],
      v1: { pass: true, findings: [], notes: [] },
      v2: { pass: true, findings: [], notes: [] },
      measures: { dps: 100, ehp: 17900, clearSpeed: { speed: 'fast' }, movementSpeed: 1, ...measures },
    }) as unknown as StageRecord;
  const main = { group: 1, activeSkill: 1 };
  const arbiter = (hs: number, avoid: boolean): ArbiterMeasure => ({
    verdict: 'one-shot',
    worst: { type: 'physical', hitId: 'extendo-spear-combo-slam-1', ratio: 1.01 },
    rows: [{ type: 'physical', mixed: false, hitId: 'extendo-spear-combo-slam-1', hit: 3486, maxHit: 3451, ratio: 1.01, verdict: 'one-shot', deflectedRatio: 0.61, deflectedVerdict: 'survives', hitsSurvived: hs }],
    ...(avoid ? { avoid: { accuracy: 3786, evade: 40, deflect: 70, deflectEffect: 40, method: 'pass' as const } } : {}),
  });

  it('carries three damage figures, the lowest max hit after EHP and, on a rung with avoid, hits survived after the Arbiter part, rounded down', () => {
    const line = keyFigureLine(
      rec({
        damage: { map: 1500000, resisting: 1200000, boss: 400000 },
        toughness: { lowestMaxHit: { type: 'physical', value: 3451 }, immune: [], chance: null },
        arbiter: arbiter(79.6, true),
      }),
      main,
    );
    expect(line).toBe(
      '  Key figures: damage 1500000 against map monsters, 1200000 against resisting rares, 400000 against a Pinnacle boss; life 4000; ES 0; ' +
        'EHP 17900; lowest max hit 3451 physical; resists 75/75/75/0 (fire/cold/lightning/chaos); findings V1 0, V2 0; ' +
        'Arbiter one-shot (worst: physical hit extendo-spear-combo-slam-1, 1.01 of max hit); hits survived 79%; clear fast (rough)',
    );
  });

  it("a rung without avoid prints no hits survived; a record from before amendment 12 keeps two figures and no lowest max hit", () => {
    const noAvoid = keyFigureLine(rec({ damage: { map: 10, resisting: 8, boss: 5 }, toughness: { lowestMaxHit: null, immune: ['chaos'], chance: null }, arbiter: arbiter(0, false) }), main);
    expect(noAvoid).not.toContain('hits survived');
    expect(noAvoid).toContain('; EHP 17900; lowest max hit ?; resists ');
    const old = keyFigureLine(rec({ damage: { map: 10, boss: 5 }, arbiter: { verdict: 'survives', worst: { type: 'physical', hitId: 'x', ratio: 0.5 }, rows: [] } }), main);
    expect(old).toContain('Key figures: damage 10 against map monsters, 5 against a Pinnacle boss; life 4000; ES 0; EHP 17900; resists ');
    expect(old).not.toMatch(/resisting rares|lowest max hit|hits survived/);
  });
});

describe("WU-120: the Arbiter data copies the engine tests compile with (tests/fixtures/enemies/)", () => {
  const read = (...p: string[]) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8'));
  const data = read('data', 'enemies', 'arbiter-of-divinity.json');
  it.each([
    ['arbiter-slam-unevadable', ['hits.extendo-spear-combo-slam-1.evadable']],
    ['arbiter-slam-2-unevadable', ['hits.slam-2.evadable']],
    ['arbiter-chaos-hit', ['hits.test-chaos-bolt', 'hits.test-chaos-bolt.type']],
  ])('%s is the committed data plus only its test facts, from a test source', (name, added) => {
    const copy = read('tests', 'fixtures', 'enemies', `${name}.json`);
    const extra = Object.keys(copy.facts).filter((k) => !(k in data.facts));
    expect(extra).toEqual(added);
    for (const k of Object.keys(data.facts)) expect({ k, fact: copy.facts[k] }).toEqual({ k, fact: data.facts[k] });
    expect(copy.sources.slice(0, data.sources.length)).toEqual(data.sources);
    for (const k of extra) expect({ k, source: copy.facts[k].source }).toEqual({ k, source: 'wu120-test-fixture' });
    // It loads as a data file, and its hits read as the engine tests use them.
    const hits = arbiterHitsOf(copy.facts);
    if (name === 'arbiter-chaos-hit') expect(hits.find((h) => h.id === 'test-chaos-bolt')).toEqual({ id: 'test-chaos-bolt', max: 3000, types: ['chaos'], evadable: true });
    else expect(hits.filter((h) => h.evadable === false).map((h) => `hits.${h.id}.evadable`)).toEqual(added);
  });
});

/** The max hits of a physical and a lightning type, as PoB's outputs name them. */
function MAXH(physical: number, lightning?: number): Record<string, number> {
  return { PhysicalMaximumHitTaken: physical, ...(lightning !== undefined ? { LightningMaximumHitTaken: lightning } : {}) };
}
