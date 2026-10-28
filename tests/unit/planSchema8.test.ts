/**
 * WU-119 (amendment 12; AC-P82's schema rows): plan schema 8 through `validatePlan`, the compile's own validation (FR-P1,
 * D-163).
 *
 * - Appendix A's plan (schema 8): `stages[].defence` is optional `{base: "armour" | "evasion" | "energy shield" |
 *   "armour/evasion" | "armour/energy shield" | "evasion/energy shield", chance, mitigation, pool, physicalHit}` (texts);
 *   `stages[].respec` errs at its path ("a schema-8 plan has no respec: each loadout's tree is its own (D-452)"); every
 *   schema-7 field is kept; a temporary stage's id starts `tmp`, letters and digits only (`tmpb1`).
 * - AC-P82: a schema-8 plan with `respec` errs at `stages[n].respec`; `stages[].defence` is accepted on 8 and errs at its
 *   path on 7.
 * - §22: a schema-7 plan keeps `respec`; a plan with neither field validates alike at 7 and 8.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { loadReferenceData } from '../../src/plan/referenceData';
import { DEFENCE_BASES, isTemporaryStage, PLAN_SCHEMA_VERSIONS, validatePlan, type PlanError } from '../../src/plan/schema';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const judgment = (r: string) => ({ kind: 'judgment', ref: r, confidence: 'L' });

/** The two-stage fixture at `version`, with the endgame ladder's `b` and `n` after it (stage 2's content). */
function plan(version: number): Json {
  const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
  p.schemaVersion = version;
  for (const [id, variant, level] of [
    ['b', 'budget', 80],
    ['n', 'non-budget', 90],
  ] as const) {
    const s = JSON.parse(JSON.stringify(p.stages[1]));
    Object.assign(s, {
      id,
      loadoutName: `${variant} (L${level}) {${id}}`,
      level,
      progress: 'endgame',
      variant,
      ascendancyPoints: 0,
      variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') },
      claims: [],
    });
    p.stages.push(s);
  }
  return p;
}

const DEFENCE = {
  base: 'evasion',
  chance: 'evasion, deflection from the tree',
  mitigation: 'capped elemental resistances',
  pool: 'life',
  physicalHit: 'life pool lines on the helmet and the body',
};

/** A respec on `b` (index 2) dropping a node of stage 2, as schema 7 writes one. */
const RESPEC = { dropped: [59767], goldCost: { value: 0, source: judgment('test') }, note: 'b trades the Area Damage notable' };

function errorsOf(input: unknown): PlanError[] {
  const r = validatePlan(input, ref);
  return r.ok ? [] : r.errors;
}

describe('WU-119: plan schema 8 (Appendix A, AC-P82)', () => {
  it('schema 8 is the current version; 1 to 7 stay accepted', () => {
    expect([...PLAN_SCHEMA_VERSIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('AC-P82: a schema-8 plan with respec errs at stages[n].respec, with Appendix A\'s message', () => {
    const p = plan(8);
    p.stages[2].respec = RESPEC;
    expect(errorsOf(p)).toEqual([
      { path: 'stages[2].respec', message: "a schema-8 plan has no respec: each loadout's tree is its own (D-452)" },
    ]);
    // Each stage's respec errs at its own path.
    p.stages[3].respec = { ...RESPEC, dropped: [] };
    expect(errorsOf(p).map((e) => e.path)).toEqual(['stages[2].respec', 'stages[3].respec']);
  });

  it('§22: a schema-7 plan keeps its respec', () => {
    const p = plan(7);
    p.stages[2].respec = RESPEC;
    const r = validatePlan(p, ref);
    expect(r.ok ? r.plan.stages[2].respec : r.errors).toEqual(RESPEC);
  });

  it('AC-P82: stages[].defence is accepted on schema 8, with its value kept', () => {
    const p = plan(8);
    p.stages[3].defence = DEFENCE;
    const r = validatePlan(p, ref);
    expect(r.ok ? r.plan.stages[3].defence : r.errors).toEqual(DEFENCE);
  });

  it('AC-P82: stages[].defence errs at its path on schema 7, naming schema 8', () => {
    const p = plan(7);
    p.stages[3].defence = DEFENCE;
    const errors = errorsOf(p);
    expect(errors.map((e) => e.path)).toEqual(['stages[3].defence']);
    expect(errors[0].message).toMatch(/needs schemaVersion 8 or later; this plan declares schemaVersion 7/);
  });

  it('Appendix A: every base family is accepted; the defence plan is strict, its texts non-empty and required', () => {
    expect([...DEFENCE_BASES]).toEqual(['armour', 'evasion', 'energy shield', 'armour/evasion', 'armour/energy shield', 'evasion/energy shield']);
    for (const base of DEFENCE_BASES) {
      const p = plan(8);
      p.stages[3].defence = { ...DEFENCE, base };
      expect({ base, errors: errorsOf(p) }).toEqual({ base, errors: [] });
    }
    const cases: [string, Json, string][] = [
      ['an unknown base', { ...DEFENCE, base: 'ward' }, 'stages[3].defence.base'],
      ['an empty chance text', { ...DEFENCE, chance: '' }, 'stages[3].defence.chance'],
      ['no mitigation', { ...DEFENCE, mitigation: undefined }, 'stages[3].defence.mitigation'],
      ['no pool', { ...DEFENCE, pool: undefined }, 'stages[3].defence.pool'],
      ['no physicalHit', { ...DEFENCE, physicalHit: undefined }, 'stages[3].defence.physicalHit'],
      ['an unknown key', { ...DEFENCE, block: 'none' }, 'stages[3].defence'],
    ];
    for (const [what, defence, at] of cases) {
      const p = plan(8);
      p.stages[3].defence = JSON.parse(JSON.stringify(defence));
      expect({ what, paths: errorsOf(p).map((e) => e.path) }).toEqual({ what, paths: [at] });
    }
  });

  it('§22: a plan with neither respec nor defence validates alike at schema 7 and schema 8, every schema-7 field kept', () => {
    const seven = plan(7);
    const eight = plan(8);
    for (const p of [seven, eight]) {
      p.stages[3].tree.scales = 'melee damage, rage';
      p.stages[3].skills.engagement = { kind: 'close', reason: 'Boneshatter strikes the enemy next to you' };
    }
    const r7 = validatePlan(seven, ref);
    const r8 = validatePlan(eight, ref);
    expect([r7.ok ? 'ok' : r7.errors, r8.ok ? 'ok' : r8.errors]).toEqual(['ok', 'ok']);
    if (r7.ok && r8.ok) expect(r8.plan.stages).toEqual(r7.plan.stages);
  });

  it('Appendix A: a temporary stage\'s id starts tmp, letters and digits like every id (tmpb1)', () => {
    const p = plan(8);
    const tmp = JSON.parse(JSON.stringify(p.stages[2]));
    Object.assign(tmp, { id: 'tmpb1', loadoutName: 'budget (L80) {tmpb1}' });
    p.stages.splice(3, 0, tmp);
    expect(errorsOf(p)).toEqual([]);
    expect(['tmpb1', 'tmp', 'b', 'n', 'Tmpb1', 'xtmp'].map(isTemporaryStage)).toEqual([true, true, false, false, false, false]);
    // An id with a dash or underscore is no stage id, temporary or not.
    const bad = plan(8);
    bad.stages[2].id = 'tmp-b1';
    bad.stages[2].loadoutName = 'budget (L80) {tmp-b1}';
    expect(errorsOf(bad).map((e) => e.path)).toContain('stages[2].id');
  });
});
