/**
 * AC-A2 (WU-18, D-30): unit tests on `judge()` (src/advice/judge.ts), the one judgment function of the
 * advice tools. It judges a build only by PoB's warning lines, `Missing<Elem>Resist > 0`, and per damage
 * type `<Type>MaximumHitTaken < <Type>EnemyDamage`; an empty shown gear slot is a fact, not a judgment.
 * The static part of AC-A2 (no thresholds or PoE1 advice in the advice files) is in
 * `tests/static/adviceNoThresholds.test.ts`.
 */
import { describe, it, expect } from '@jest/globals';
import { judge, type JudgedSlot } from '../../src/advice/judge';

/** A build with no gaps: every resistance at its maximum, every max hit at or above the enemy's hit. */
function cleanStats(): Record<string, unknown> {
  return {
    MissingFireResist: 0, MissingColdResist: 0, MissingLightningResist: 0, MissingChaosResist: 0,
    PhysicalMaximumHitTaken: 3909, PhysicalEnemyDamage: 979.475,
    FireMaximumHitTaken: 11832, FireEnemyDamage: 979.475,
    ColdMaximumHitTaken: 11832, ColdEnemyDamage: 979.475,
    LightningMaximumHitTaken: 11832, LightningEnemyDamage: 979.475,
    // Equal is not below.
    ChaosMaximumHitTaken: 391.79, ChaosEnemyDamage: 391.79,
  };
}

const slot = (name: string, id: number, shown = true, inactive = false): JudgedSlot => ({ slot: name, id, shown, inactive });
const equipped: JudgedSlot[] = [slot('Weapon 1', 16), slot('Helmet', 14), slot('Body Armour', 4), slot('Ring 1', 8)];

describe('AC-A2 (WU-18, D-30): judge()', () => {
  it('AC-A2 (a): no Missing*Resist, every max hit ≥ its enemy hit and no warnings → []', () => {
    expect(judge(cleanStats(), [], equipped)).toEqual([]);
    expect(judge(cleanStats(), [], [])).toEqual([]);
  });

  it('AC-A2 (b): MissingColdResist = 12 → exactly one resist issue naming Cold and 12', () => {
    const issues = judge({ ...cleanStats(), MissingColdResist: 12 }, [], equipped);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing_resist', category: 'judgment' });
    expect(issues[0].text).toMatch(/\bCold\b/);
    expect(issues[0].text).toMatch(/\b12\b/);
    expect(issues[0].text).not.toMatch(/Fire|Lightning|Chaos/);
  });

  it('AC-A2 (c): FireMaximumHitTaken 1500 < FireEnemyDamage 2000 → exactly one max-hit issue naming Fire with both numbers', () => {
    const issues = judge({ ...cleanStats(), FireMaximumHitTaken: 1500, FireEnemyDamage: 2000 }, [], equipped);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'max_hit', category: 'judgment' });
    expect(issues[0].text).toMatch(/\bFire\b/);
    expect(issues[0].text).toMatch(/1,?500/);
    expect(issues[0].text).toMatch(/2,?000/);
  });

  it('AC-A2 (c): the comparison is per type, never against totalEnemyDamage', () => {
    // Fire's max hit is above Fire's enemy hit but below the five-type total: not an issue.
    const issues = judge({ ...cleanStats(), FireMaximumHitTaken: 2500, FireEnemyDamage: 2000, totalEnemyDamage: 9000 }, [], equipped);
    expect(issues).toEqual([]);
  });

  it('AC-A2 (d): each PoB warning line becomes one issue whose text is that line', () => {
    const warnings = [
      'You do not meet the Strength requirement of Herald of Ash',
      'You have too many gem groups allocated. Max allowed is 9. You have 10 non-item/non-granted gem groups allocated.',
    ];
    const issues = judge(cleanStats(), warnings, equipped);
    expect(issues).toEqual(warnings.map((text) => ({ kind: 'pob_warning', category: 'judgment', text })));
  });

  it('AC-A2 (e): an empty shown gear slot becomes one informational fact, not a judgment', () => {
    const issues = judge(cleanStats(), [], [...equipped, slot('Gloves', 0)]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'empty_slot', category: 'fact' });
    expect(issues[0].text).toContain('Gloves');
  });

  it('AC-A2 (e): hidden or inactive slots and jewel sockets are not reported', () => {
    const items = [
      ...equipped,
      slot('Ring 3', 0, false),
      slot('Weapon 1 Swap', 0, false, false),
      slot('Weapon 2', 0, true, true),
      slot('Jewel 61419', 0),
      slot('Helmet Jewel Socket 1', 0),
    ];
    expect(judge(cleanStats(), [], items)).toEqual([]);
  });

  it('AC-A2: missing or NaN (null) outputs are not judged', () => {
    expect(judge({}, [], [])).toEqual([]);
    expect(judge({ ...cleanStats(), MissingFireResist: null, FireMaximumHitTaken: null }, [], [])).toEqual([]);
  });

  it('AC-A2: order is PoB warnings, resistances, max hits, then facts', () => {
    const issues = judge(
      { ...cleanStats(), MissingChaosResist: 20, PhysicalMaximumHitTaken: 500 },
      ['You have too many passive points allocated'],
      [...equipped, slot('Boots', 0)],
    );
    expect(issues.map((i) => i.kind)).toEqual(['pob_warning', 'missing_resist', 'max_hit', 'empty_slot']);
  });
});
