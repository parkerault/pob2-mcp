/**
 * WU-102 (amendment 9 §24.2; D-426, D-427): the pure parts of a skill on a weapon set and the travel skill, without the
 * engine. The engine-required AC-W81 is `tests/integration/weaponSetGroups.test.ts`.
 *
 * - The plan schema's `skills.groups[].weaponSet`: `1`, `2` or absent; any other value errs at its path; a plan of
 *   version 1 to 5 that names it errs, naming version 6 (D-320, D-332); `stageParams` passes it to `compile_stage`
 *   only when the plan names it.
 * - V1's `empty-weapon-set`: a group on a set whose two weapon slots the stage leaves empty; either slot of the set holds
 *   a weapon for it; a group on no set is never reported.
 * - The clear measure's `travel` (`travelOf`, `stageMeasures`): the first travel skill, by group, that isn't the clear
 *   group's; its uses per second from its own set's figures (`skillOutputsSet2` for a group on set 2); null with none;
 *   absent when the compile gave no travel skills (a record from before M-22 is read as it was).
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { validatePlan, type Stage } from '../../src/plan/schema';
import { checkWeaponSetGroups, WEAPON_SET_SLOTS } from '../../src/plan/checks/v1';
import { stageMeasures, travelOf, type StageRecord, type TravelSkill } from '../../src/plan/record';
import { stageParams } from '../../src/plan/compiler';
import type { Finding } from '../../src/plan/record';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'weapon-set-groups', 'plan.json');
const plan = (): Json => JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
const stageOf = (p: Json, id: string): Stage => p.stages.find((s: Json) => s.id === id) as Stage;

describe('the plan schema: skills.groups[].weaponSet (D-426, §24.2)', () => {
  it('the fixture plan, with groups on set 1, set 2 and both, is valid', () => {
    expect(validatePlan(plan())).toMatchObject({ ok: true });
  });

  it('a weaponSet other than 1 or 2 errs at its path', () => {
    for (const bad of [0, 3, 1.5, '2', null]) {
      const p = plan();
      p.stages[0].skills.groups[1].weaponSet = bad;
      const res = validatePlan(p);
      expect({ bad, ok: res.ok }).toEqual({ bad, ok: false });
      if (!res.ok) expect(res.errors.map((e) => e.path)).toContain('stages[0].skills.groups[1].weaponSet');
    }
  });

  it('a plan of version 5 that names a weaponSet errs at the key, naming version 6; without it, it stays valid', () => {
    const p = plan();
    p.schemaVersion = 5;
    const res = validatePlan(p);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const at = res.errors.filter((e) => /weaponSet$/.test(e.path));
      expect(at.map((e) => e.path).sort()).toEqual([
        'stages[0].skills.groups[0].weaponSet',
        'stages[0].skills.groups[1].weaponSet',
        'stages[2].skills.groups[1].weaponSet',
      ]);
      for (const e of at) expect(e.message).toMatch(/^a group's weapon set \(D-426\) needs schemaVersion 6 or later; this plan declares schemaVersion 5/);
    }
    for (const s of p.stages) for (const g of s.skills.groups) delete g.weaponSet;
    expect(validatePlan(p)).toMatchObject({ ok: true });
  });

  it("stageParams passes a group's weaponSet to compile_stage, and nothing for a group on both sets", () => {
    const p = plan();
    const refs = { item: { title: 'i' }, skill: { title: 's' }, config: { title: 'c' } };
    const groups = stageParams(stageOf(p, 'ws'), true, refs, ['TotalDPS']).groups;
    expect(groups.map((g) => g.weaponSet)).toEqual([1, 2, undefined]);
    expect('weaponSet' in groups[2]).toBe(false);
    expect(stageParams(stageOf(p, 'both'), true, refs, ['TotalDPS']).groups.some((g) => 'weaponSet' in g)).toBe(false);
  });
});

describe("V1's empty-weapon-set (D-426, §24.2)", () => {
  const run = (st: Stage) => {
    const findings: Finding[] = [];
    checkWeaponSetGroups(st, findings);
    return findings;
  };

  it("reports a group on set 2 when the stage fills neither Swap slot, with the group, the set, the slots and the key's path", () => {
    const findings = run(stageOf(plan(), 'g2'));
    expect(findings).toEqual([
      {
        code: 'empty-weapon-set',
        message:
          'skill group 2 (Rolling Slam) is on weapon set 2 (weaponSet 2), whose weapon slots (Weapon 1 Swap, Weapon 2 Swap) are empty: ' +
          'PoB enables the group only while set 2 is active, and the stage equips no weapon there (D-426). ' +
          "Equip set 2's weapon, or move the group to the other set or to both (no weaponSet)",
        data: { group: 2, weaponSet: 2, slots: ['Weapon 1 Swap', 'Weapon 2 Swap'], path: 'skills.groups[1].weaponSet' },
      },
    ]);
  });

  it("a set's weapon in either of its slots holds the group, and a group on no set isn't reported", () => {
    const p = plan();
    expect(run(stageOf(p, 'ws'))).toEqual([]);
    expect(run(stageOf(p, 'both'))).toEqual([]);
    const st = stageOf(p, 'g2');
    st.items.slots.push({ slot: 'Weapon 2 Swap', text: 'Rarity: Normal\nSplintered Tower Shield' });
    expect(run(st)).toEqual([]);
    // Set 1 with only its off-hand filled still holds a group on set 1.
    const one = stageOf(plan(), 'ws');
    one.items.slots = one.items.slots.filter((s) => s.slot !== 'Weapon 1');
    one.items.slots.push({ slot: 'Weapon 2', text: 'Rarity: Normal\nSplintered Tower Shield' });
    expect(run(one)).toEqual([]);
  });

  it('reports a group on set 1 when both of set 1\'s slots are empty, disabled or not, one finding per group', () => {
    const st = stageOf(plan(), 'ws');
    st.items.slots = st.items.slots.filter((s) => s.slot !== 'Weapon 1');
    st.skills.groups[2].weaponSet = 1;
    st.skills.groups[2].enabled = false;
    expect(run(st).map((f) => [f.code, f.data?.group, f.data?.weaponSet])).toEqual([
      ['empty-weapon-set', 1, 1],
      ['empty-weapon-set', 3, 1],
    ]);
    expect(WEAPON_SET_SLOTS).toEqual({ 1: ['Weapon 1', 'Weapon 2'], 2: ['Weapon 1 Swap', 'Weapon 2 Swap'] });
  });
});

describe("the clear measure's travel (D-427, §24.2)", () => {
  const entry = (skill: string, speed: number) => ({ skill, statSetLabel: skill, fields: { TotalDPS: 10, Speed: speed } });
  /** A record of the fixture's `ws` stage: Boneshatter (1), Rolling Slam (2, clear), Leap Slam (3). */
  const rec = (): StageRecord =>
    ({
      outputs: { TotalDPS: 10, EffectiveMovementSpeedMod: 1.1 },
      countedOutputs: { group: 1, count: 1, dotCanStack: false, fields: { TotalDPS: 10 } },
      skillOutputs: { g1s1p1: entry('Boneshatter', 1.5), g2s1p1: entry('Rolling Slam', 1.2), g3s1p1: entry('Leap Slam', 1.3) },
      skillOutputsSet2: { g1s1p1: entry('Boneshatter', 1.4), g2s1p1: entry('Rolling Slam', 1.1), g3s1p1: entry('Leap Slam', 1.25) },
      countedSkillOutputs: {},
      minionSkills: [],
    }) as unknown as StageRecord;
  const leap: TravelSkill = { group: 3, activeSkill: 1, skill: 'Leap Slam' };

  it('is the first travel skill by group that is not the clear group, with its Speed from its own set', () => {
    const st = stageOf(plan(), 'ws');
    expect(travelOf(st, rec(), [leap])).toEqual({ group: 3, skill: 'Leap Slam', usesPerSecond: 1.3 });
    // A Leap Slam on set 2 reads skillOutputsSet2.
    st.skills.groups[2].weaponSet = 2;
    expect(travelOf(st, rec(), [leap])).toEqual({ group: 3, skill: 'Leap Slam', usesPerSecond: 1.25 });
    // Order by group, then active skill, whatever order the engine reports.
    const shield: TravelSkill = { group: 1, activeSkill: 1, skill: 'Shield Charge' };
    expect(travelOf(st, rec(), [leap, shield])?.skill).toBe('Shield Charge');
  });

  it('skips the clear group, and is null when no other travel skill is there', () => {
    const st = stageOf(plan(), 'ws');
    const slam: TravelSkill = { group: 2, activeSkill: 1, skill: 'Rolling Slam' };
    expect(travelOf(st, rec(), [slam])).toBeNull();
    expect(travelOf(st, rec(), [slam, leap])?.group).toBe(3);
    expect(travelOf(st, rec(), [])).toBeNull();
  });

  it('gives null uses per second when PoB measured no Speed for the skill', () => {
    const r = rec();
    delete (r.skillOutputs.g3s1p1.fields as Record<string, number>).Speed;
    expect(travelOf(stageOf(plan(), 'ws'), r, [leap])).toEqual({ group: 3, skill: 'Leap Slam', usesPerSecond: null });
  });

  it('stageMeasures puts it in the clear measure when the compile gave travel skills, and leaves it out otherwise', () => {
    const st = stageOf(plan(), 'ws');
    expect(stageMeasures(st, rec(), [], {}, [leap]).clearSpeed.travel).toEqual({ group: 3, skill: 'Leap Slam', usesPerSecond: 1.3 });
    expect(stageMeasures(st, rec(), [], {}, []).clearSpeed.travel).toBeNull();
    expect('travel' in stageMeasures(st, rec(), [], {}).clearSpeed).toBe(false);
    // The measures' keys are unchanged (D-407's grant): travel lives in the clear measure.
    expect(Object.keys(stageMeasures(st, rec(), [], {}, [leap])).sort()).toEqual(['clearSpeed', 'movementSpeed']);
  });
});
