/**
 * WU-111 (amendment 11; AC-P81's schema bullets): plan schema 7's five fields, through `validatePlan`, the compile's own
 * validation (FR-P1, D-163).
 *
 * - Appendix A's plan (schema 7): `stages[].skills.cull` (text), `stages[].tree.scales` (text),
 *   `stages[].items.bootsException {kind: "travel" | "unique", reason}`, `stages[].skills.engagement {kind: "close" |
 *   "distance", reason}` and `stages[].skills.boss {entries: [{group, activeSkill, statSet, turns?}], note}`, each
 *   optional (§19: "schema 7 adds five optional fields").
 * - AC-P81: a schema-6 plan using `skills.cull`, `tree.scales` or `items.bootsException` errs at its path;
 *   `skills.engagement` and `skills.boss` are accepted on schema 7 and err at their paths on schema 6.
 * - AC-P81 (§9b): an entry naming a group the stage doesn't have errs at `stages[n].skills.boss.entries[k]`, as
 *   `rolledGroup` does; its active skill and stat set are the compile's check against PoB
 *   (`tests/integration/compileBossMeasure.test.ts`).
 * - §19: a schema-6 plan compiles as before: the two-stage fixture with its version raised to 7 and none of the fields
 *   validates to the same stages.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { loadReferenceData } from '../../src/plan/referenceData';
import { PLAN_SCHEMA_VERSIONS, validatePlan, type PlanError } from '../../src/plan/schema';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const judgment = (r: string) => ({ kind: 'judgment', ref: r, confidence: 'L' });

/** The two-stage fixture at `version`, with an endgame non-budget stage `n` after it (stage 2's content). */
function plan(version: number): Json {
  const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
  p.schemaVersion = version;
  const n = JSON.parse(JSON.stringify(p.stages[1]));
  Object.assign(n, {
    id: 'n',
    loadoutName: 'Non-budget (L90) {n}',
    level: 90,
    progress: 'endgame',
    variant: 'non-budget',
    ascendancyPoints: 0,
    variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') },
    claims: [],
  });
  p.stages.push(n);
  return p;
}

/** Each of Appendix A's five fields, set on stage `n` (index 2), with its path. */
const FIELDS: { name: string; path: string; set: (n: Json) => void }[] = [
  { name: 'skills.cull', path: 'stages[2].skills.cull', set: (n) => (n.skills.cull = "Culling Strike I's cull on Boneshatter") },
  { name: 'tree.scales', path: 'stages[2].tree.scales', set: (n) => (n.tree.scales = 'physical attack damage, rage') },
  {
    name: 'items.bootsException',
    path: 'stages[2].items.bootsException',
    set: (n) => (n.items.bootsException = { kind: 'travel', reason: 'Leap Slam moves the build; the slot takes life instead' }),
  },
  {
    name: 'skills.engagement',
    path: 'stages[2].skills.engagement',
    set: (n) => (n.skills.engagement = { kind: 'close', reason: 'Boneshatter strikes the enemy next to you' }),
  },
  {
    name: 'skills.boss',
    path: 'stages[2].skills.boss',
    set: (n) =>
      (n.skills.boss = {
        entries: [
          { group: 1, activeSkill: 1, statSet: 1 },
          { group: 1, activeSkill: 1, statSet: 2, turns: true },
        ],
        note: 'the strike, then its shockwave',
      }),
  },
];

function errorsOf(input: unknown): PlanError[] {
  const r = validatePlan(input, ref);
  return r.ok ? [] : r.errors;
}

describe('WU-111: plan schema 7 (Appendix A, AC-P81)', () => {
  it('schema 7 stays accepted beside 1 to 6, and schema 8 (amendment 12) follows it', () => {
    expect([...PLAN_SCHEMA_VERSIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it.each(FIELDS.map((f) => [f.name, f] as const))('AC-P81: %s is accepted on schema 7, with its value kept', (_name, field) => {
    const p = plan(7);
    field.set(p.stages[2]);
    const r = validatePlan(p, ref);
    expect(r.ok ? 'ok' : r.errors).toBe('ok');
    if (!r.ok) return;
    const [where, key] = field.name.split('.') as ['skills' | 'tree' | 'items', string];
    expect((r.plan.stages[2][where] as Json)[key]).toEqual((p.stages[2][where] as Json)[key]);
  });

  it.each(FIELDS.map((f) => [f.name, f] as const))('AC-P81: a schema-6 plan using %s errs at its path, naming schema 7', (_name, field) => {
    const p = plan(6);
    field.set(p.stages[2]);
    const errors = errorsOf(p);
    expect(errors.map((e) => e.path)).toEqual([field.path]);
    expect(errors[0].message).toMatch(/needs schemaVersion 7 or later; this plan declares schemaVersion 6/);
  });

  it('all five together are accepted on schema 7, and on schema 6 each errs at its own path', () => {
    const seven = plan(7);
    for (const f of FIELDS) f.set(seven.stages[2]);
    expect(errorsOf(seven)).toEqual([]);
    const six = plan(6);
    for (const f of FIELDS) f.set(six.stages[2]);
    expect(errorsOf(six).map((e) => e.path).sort()).toEqual(FIELDS.map((f) => f.path).sort());
  });

  it('§19: a plan with none of the fields validates alike at schema 6 and schema 7', () => {
    const six = validatePlan(plan(6), ref);
    const seven = validatePlan(plan(7), ref);
    expect(six.ok && seven.ok).toBe(true);
    if (six.ok && seven.ok) expect(seven.plan.stages).toEqual(six.plan.stages);
  });

  it("AC-P81 (§9b): an entry naming a group the stage doesn't have errs at stages[n].skills.boss.entries[k], as rolledGroup does", () => {
    const p = plan(7);
    p.stages[2].skills.boss = {
      entries: [
        { group: 1, activeSkill: 1, statSet: 1 },
        { group: 3, activeSkill: 1, statSet: 1 },
      ],
      note: 'test',
    };
    const errors = errorsOf(p);
    expect(errors.map((e) => e.path)).toEqual(['stages[2].skills.boss.entries[1]']);
    expect(errors[0].message).toMatch(/^group 3 names no group; the stage has 2/);
    // rolledGroup's own error, for the same fault, reads alike (schema.ts's D-217 rule).
    const q = plan(7);
    q.stages[2].skills.rolledGroup = 3;
    expect(errorsOf(q)).toEqual([{ path: 'stages[2].skills.rolledGroup', message: expect.stringMatching(/^rolledGroup 3 names no group; the stage has 2/) }]);
  });

  it('Appendix A: the shapes are strict: kinds are enums, reasons and the note non-empty, statSet required, turns a boolean, entries at least one', () => {
    const cases: [string, (n: Json) => void, string][] = [
      ['an unknown engagement kind', (n) => (n.skills.engagement = { kind: 'melee', reason: 'x' }), 'stages[2].skills.engagement.kind'],
      ['an empty engagement reason', (n) => (n.skills.engagement = { kind: 'distance', reason: '' }), 'stages[2].skills.engagement.reason'],
      ['an unknown boots exception kind', (n) => (n.items.bootsException = { kind: 'rare', reason: 'x' }), 'stages[2].items.bootsException.kind'],
      ['an empty cull text', (n) => (n.skills.cull = ''), 'stages[2].skills.cull'],
      ['an empty scales text', (n) => (n.tree.scales = ''), 'stages[2].tree.scales'],
      ['an entry without statSet', (n) => (n.skills.boss = { entries: [{ group: 1, activeSkill: 1 }], note: 'x' }), 'stages[2].skills.boss.entries[0].statSet'],
      ['an entry whose turns is a string', (n) => (n.skills.boss = { entries: [{ group: 1, activeSkill: 1, statSet: 1, turns: 'yes' }], note: 'x' }), 'stages[2].skills.boss.entries[0].turns'],
      ['a rotation without a note', (n) => (n.skills.boss = { entries: [{ group: 1, activeSkill: 1, statSet: 1 }] }), 'stages[2].skills.boss.note'],
      ['a rotation with no entry', (n) => (n.skills.boss = { entries: [], note: 'x' }), 'stages[2].skills.boss.entries'],
      ['an unknown key in an entry', (n) => (n.skills.boss = { entries: [{ group: 1, activeSkill: 1, statSet: 1, weight: 2 }], note: 'x' }), 'stages[2].skills.boss.entries[0]'],
    ];
    for (const [what, set, at] of cases) {
      const p = plan(7);
      set(p.stages[2]);
      expect({ what, paths: errorsOf(p).map((e) => e.path) }).toEqual({ what, paths: [at] });
    }
  });
});
