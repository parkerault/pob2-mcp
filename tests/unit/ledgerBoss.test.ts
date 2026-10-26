/**
 * WU-111 (amendment 11 §9b, D-447; AC-P81's ledger bullets): C-33's reference form against a Pinnacle boss, through
 * `evaluateLedgerEntry` with the ledger's boss context (the M-24 handoff: `StageOutputs.bossGroups` is the record stage's
 * `measures.bossGroups`, `damageBoss` its `measures.damage.boss`).
 *
 * - `<stageId>.boss.g<group>s<activeSkill>p<statSet>` is that entry's figure; `.ignite`, `.bleed`, `.poison` or
 *   `.usesPerSecond` after it that field of the entry; `<stageId>.boss.measured` is PoB alone (`damage.boss`).
 * - A stage without them can't resolve a `boss.` reference: the evaluator's usual missing-figure error
 *   (`unknown-output`), as for an entry the rotation lacks, a field the form doesn't name, or a null value.
 * - Validation (`checkLedgerEntry`) accepts the form: a boss reference names a plan stage, so it isn't `unknown-stage`.
 * - The record's `pob-computed` refs resolve the same form (`refResolves`).
 * The engine compile of these references is `tests/integration/compileBossMeasure.test.ts`.
 */
import { describe, expect, it } from '@jest/globals';
import { checkLedgerEntry, evaluateLedgerEntry, type LedgerContext, type StageOutputs } from '../../src/plan/ledger';
import { refResolves } from '../../src/plan/record';

/** A record stage's boss context, as Appendix A shapes `measures.bossGroups`. */
const N: StageOutputs = {
  outputs: { Life: 1000 },
  skillOutputs: { g1s1p1: { fields: { TotalDPS: 100 } } },
  bossGroups: [
    { group: 1, activeSkill: 1, statSet: 1, figure: 900, usesPerSecond: 1.5, ignite: 120, bleed: 0, poison: 0 },
    { group: 1, activeSkill: 1, statSet: 2, figure: 400, usesPerSecond: 1.5, ignite: 80, bleed: 0, poison: 30 },
    { group: 2, activeSkill: 2, statSet: 1, figure: null, usesPerSecond: null, ignite: 0, bleed: 0, poison: 0 },
  ],
  damageBoss: 1220,
};
const CTX: LedgerContext = { stageIds: ['m', 'n'], stages: { n: N, m: { outputs: { Life: 500 } } } };
const run = (formula: string, ctx: LedgerContext = CTX) => evaluateLedgerEntry({ id: 'boss_n', formula, inputs: [{ name: 'k', value: 2 }] }, ctx);

describe('WU-111 (D-447): ledger references against a Pinnacle boss', () => {
  it('AC-P81: n.boss.g1s1p1.ignite is that entry\'s ignite, and n.boss.measured is damage.boss (PoB alone)', () => {
    expect(run('n.boss.g1s1p1.ignite')).toEqual({ value: 120, error: null });
    expect(run('n.boss.measured')).toEqual({ value: 1220, error: null });
  });

  it("AC-P81: n.boss.g1s1p2 is that entry's figure against a Pinnacle boss", () => {
    expect(run('n.boss.g1s1p2')).toEqual({ value: 400, error: null });
  });

  it("each of the entry's fields reads: .ignite, .bleed, .poison, .usesPerSecond; and they combine in a formula", () => {
    expect(run('n.boss.g1s1p2.poison')).toEqual({ value: 30, error: null });
    expect(run('n.boss.g1s1p2.bleed')).toEqual({ value: 0, error: null });
    expect(run('n.boss.g1s1p1.usesPerSecond')).toEqual({ value: 1.5, error: null });
    // A hand estimate: PoB alone with the second entry taking turns at half its rate.
    expect(run('n.boss.measured − n.boss.g1s1p2 ÷ k')).toEqual({ value: 1020, error: null });
    // The other forms still read beside them.
    expect(run('n.boss.g1s1p1 / n.g1s1p1.TotalDPS + n.Life − 1000')).toEqual({ value: 9, error: null });
  });

  it("a stage without the boss context, an entry the rotation lacks, an unknown field and a null value are the evaluator's unknown-output", () => {
    const cases = ['m.boss.measured', 'm.boss.g1s1p1', 'n.boss.g3s1p1', 'n.boss.g1s1p1.figure', 'n.boss.g1s1p1.TotalDPS', 'n.boss.g2s2p1', 'n.boss.g2s2p1.usesPerSecond', 'n.boss', 'n.boss.total'];
    for (const formula of cases) {
      const r = run(formula);
      expect({ formula, value: r.value, code: r.error?.code }).toEqual({ formula, value: null, code: 'unknown-output' });
    }
    expect(run('n.boss.g3s1p1').error?.message).toMatch(/names no boss figure of stage "n" in the compile record/);
    // A null damage.boss resolves nothing either.
    expect(run('n.boss.measured', { stageIds: ['n'], stages: { n: { ...N, damageBoss: null } } }).error?.code).toBe('unknown-output');
  });

  it('validation accepts the boss form (its stage is a plan stage), and still refuses an unknown stage', () => {
    const check = (formula: string) => checkLedgerEntry({ id: 'boss_n', formula, inputs: [] }, ['m', 'n']).map((e) => e.code);
    expect(check('n.boss.g1s1p1.ignite + n.boss.measured')).toEqual([]);
    expect(check('x.boss.measured')).toEqual(['unknown-stage']);
  });

  it("the record's pob-computed refs resolve the boss form as the ledger does", () => {
    const stages = { n: N, m: { outputs: { Life: 500 } } };
    expect(refResolves('n.boss.g1s1p1', stages)).toBe(true);
    expect(refResolves('n.boss.g1s1p2.poison', stages)).toBe(true);
    expect(refResolves('n.boss.measured', stages)).toBe(true);
    expect(refResolves('m.boss.measured', stages)).toBe(false);
    expect(refResolves('n.boss.g9s1p1', stages)).toBe(false);
    // The older forms are unchanged.
    expect(refResolves('n.Life', stages)).toBe(true);
    expect(refResolves('n.g1s1p1.TotalDPS', stages)).toBe(true);
    expect(refResolves('n.g1s1p1.Speed', stages)).toBe(false);
  });
});
