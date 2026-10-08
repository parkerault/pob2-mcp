/**
 * WU-38: the ledger grammar and evaluator (C-33, slice 2 §3.3, D-170), `src/plan/ledger.ts`.
 *
 * AC-P11: the values and errors the AC lists, through `evaluateLedgerEntry` against compiled stage
 * outputs; then the split between errors that fail validation (`checkLedgerEntry`: syntax, unknown-input,
 * unknown-stage) and errors that only null an entry's value at compile time.
 */
import { describe, expect, it } from '@jest/globals';
import {
  checkLedgerEntry,
  evaluateLedger,
  evaluateLedgerEntry,
  ledgerErrorText,
  type LedgerContext,
} from '../../src/plan/ledger';

const CTX: LedgerContext = {
  stageIds: ['1', '2'],
  stages: { '1': { outputs: { Life: 100 } }, '2': { outputs: { Life: 400 } } },
};

const run = (formula: string, inputs: { name: string; value: number }[] = [], ctx: LedgerContext = CTX) =>
  evaluateLedgerEntry({ id: 'e', formula, inputs }, ctx);

describe('AC-P11 (WU-38, D-170): ledger values', () => {
  it.each([
    ['1+2*3', 7],
    ['(1+2)×3', 9],
    ['10 ÷ 4', 2.5],
    ['-2 - -3', 1],
    ['2.5e3', 2500],
    ['1.Life / 2.Life', 0.25],
  ])('AC-P11: %s → %s', (formula, value) => {
    expect(run(formula)).toEqual({ value, error: null });
  });

  it('AC-P11: −x with input x = 4 → −4 (U+2212 as unary minus)', () => {
    expect(run('−x', [{ name: 'x', value: 4 }])).toEqual({ value: -4, error: null });
  });
});

describe('AC-P11 (WU-38, D-170): ledger errors', () => {
  it('AC-P11: "2 +" → syntax at column 3', () => {
    expect(run('2 +')).toEqual({ value: null, error: expect.objectContaining({ entry: 'e', code: 'syntax', column: 3 }) });
  });

  it.each([
    ['(1', 'syntax'],
    ['y', 'unknown-input'],
    ['9.Life', 'unknown-stage'],
    ['1.NoSuch', 'unknown-output'],
    ['1/0', 'division-by-zero'],
  ])('AC-P11: %s → %s', (formula, code) => {
    const r = run(formula);
    expect(r.value).toBeNull();
    expect(r.error).toEqual(expect.objectContaining({ entry: 'e', code }));
  });
});

describe('C-33: validation-time and compile-time errors', () => {
  const check = (formula: string, inputs: { name: string; value: number }[] = []) =>
    checkLedgerEntry({ id: 'e', formula, inputs }, CTX.stageIds).map((e) => e.code);

  it('syntax, unknown-input and unknown-stage fail validation (D-163)', () => {
    expect(check('2 +')).toEqual(['syntax']);
    expect(check('(1')).toEqual(['syntax']);
    expect(check('')).toEqual(['syntax']);
    expect(check('y')).toEqual(['unknown-input']);
    expect(check('9.Life + zz.Life')).toEqual(['unknown-stage', 'unknown-stage']);
  });

  it('unknown-output, division-by-zero and a valid formula pass validation', () => {
    expect(check('1.NoSuch')).toEqual([]);
    expect(check('1/0')).toEqual([]);
    expect(check('(2.Life − 1.Life) ÷ 1.Life × pct', [{ name: 'pct', value: 100 }])).toEqual([]);
  });

  it('a stage outside the compiled subset is stage-not-compiled, not unknown-stage', () => {
    const r = run('2.Life', [], { stageIds: ['1', '2'], stages: { '1': { outputs: { Life: 1 } } } });
    expect(r).toEqual({ value: null, error: expect.objectContaining({ code: 'stage-not-compiled', column: 0 }) });
  });

  it('a non-finite result is non-finite', () => {
    expect(run('1e308 * 10').error).toEqual(expect.objectContaining({ code: 'non-finite', column: 6 }));
    expect(run('1.Life', [], { stageIds: ['1'], stages: { '1': { outputs: { Life: Number.NaN } } } }).error?.code).toBe('non-finite');
  });

  it('a breakdown reference reads a C-45 field; a missing key or field is unknown-output', () => {
    const ctx: LedgerContext = {
      stageIds: ['2'],
      stages: { '2': { outputs: {}, skillOutputs: { g1s1p2: { fields: { TotalDPS: 50 } } } } },
    };
    expect(run('2.g1s1p2.TotalDPS × 2', [], ctx)).toEqual({ value: 100, error: null });
    expect(run('2.g1s1p1.TotalDPS', [], ctx).error?.code).toBe('unknown-output');
    expect(run('2.g1s1p2.Nope', [], ctx).error?.code).toBe('unknown-output');
    expect(run('2.foo.TotalDPS', [], ctx).error?.code).toBe('unknown-output');
  });

  it('precedence, unary plus, nested parentheses and the ASCII operators', () => {
    expect(run('2 + 3 * 4 - 6 / 2').value).toBe(11);
    expect(run('+2 * -(3 - 5)').value).toBe(4);
    expect(run('((1))').value).toBe(1);
    expect(run('8 − 2 − 1').value).toBe(5);
    expect(run('16 ÷ 4 ÷ 2').value).toBe(2);
  });

  it('a WORD that is neither NUMBER nor REF is a syntax error: .5, 1e-3, 1E+3 (plan-reference.md)', () => {
    for (const formula of ['.5', '1e-3', '1E+3']) expect(run(formula).error).toEqual(expect.objectContaining({ code: 'syntax', column: 0 }));
    expect(run('0.5 + 0.001 + 1e3').value).toBe(0.5 + 0.001 + 1e3);
  });

  it('values are unrounded doubles', () => {
    expect(run('1 / 3').value).toBe(1 / 3);
    expect(run('0.1 + 0.2').value).toBe(0.1 + 0.2);
  });

  it('syntax errors carry their 0-based column', () => {
    const col = (formula: string) => run(formula).error?.column;
    expect(col('1 ^ 2')).toBe(2);
    expect(col('1)')).toBe(1);
    expect(col('(1')).toBe(2);
    expect(col('2 x')).toBe(2);
    expect(col('1a + 2')).toBe(0);
    expect(col('1 + 1..2')).toBe(4);
    expect(col('   ')).toBe(0);
  });

  it('evaluateLedger keys results by entry id, and ledgerErrorText renders code and column', () => {
    const out = evaluateLedger(
      [
        { id: 'ratio', formula: '2.Life ÷ 1.Life', inputs: [] },
        { id: 'bad', formula: '1/0', inputs: [] },
      ],
      CTX,
    );
    expect(out.ratio).toEqual({ value: 4, error: null });
    expect(out.bad.value).toBeNull();
    expect(ledgerErrorText(out.bad.error!)).toBe('division-by-zero at column 1: the divisor is 0');
  });
});
