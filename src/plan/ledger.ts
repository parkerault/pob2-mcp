/**
 * The ledger grammar and evaluator (C-33, slice 2 §3.3, D-170).
 *
 * A ledger formula is arithmetic over numbers and named references, parsed here by a hand-written
 * tokenizer and recursive-descent parser. Nothing is compiled or executed as code, and no dependency is
 * used. The grammar:
 *
 *   expr    := term (('+' | '-' | '−') term)*
 *   term    := unary (('*' | '/' | '×' | '÷') unary)*
 *   unary   := ('-' | '−' | '+') unary | primary
 *   primary := NUMBER | REF | '(' expr ')'
 *   WORD    := a maximal run of [A-Za-z0-9_.]; whitespace separates tokens and is otherwise ignored
 *   NUMBER  := a WORD matching ^\d+(\.\d+)?([eE]\d+)?$
 *   REF     := a WORD matching ^[A-Za-z0-9_]+(\.[A-Za-z_][A-Za-z0-9_]*)+$ or ^[A-Za-z_][A-Za-z0-9_]*$
 *
 * A one-segment REF names one of the entry's inputs. `<stageId>.<Field>` names a stage's main output,
 * and `<stageId>.g<group>s<skill>p<statSet>.<Field>` a field of its per-skill breakdown (C-45).
 *
 * WU-111 (amendment 11 §9b, D-447; C-33's reference form against a Pinnacle boss): `<stageId>.boss.g<group>s<skill>p<statSet>`
 * names that boss rotation entry's figure, `….ignite`, `….bleed`, `….poison` or `….usesPerSecond` after it that field of
 * the entry, and `<stageId>.boss.measured` PoB alone (`measures.damage.boss`). They read the stage's `bossGroups` and
 * `damageBoss` in the context (the record stage's `measures.bossGroups` and `measures.damage.boss`, which the compiler,
 * `check-run.mjs` and `render-audit.mjs` fill); a stage without them, an entry its rotation lacks, or a null value is
 * the usual `unknown-output`.
 *
 * Validation (`checkLedgerEntry`) fails on `syntax`, `unknown-input` and `unknown-stage` (D-163).
 * Evaluation (`evaluateLedgerEntry`) never throws: `unknown-output`, `stage-not-compiled`,
 * `division-by-zero` and `non-finite` give the entry a null value with the error, and the compile goes
 * on. Values are IEEE doubles, never rounded.
 */
import type { LedgerEntry } from './schema.js';

export type LedgerErrorCode =
  | 'syntax'
  | 'unknown-input'
  | 'unknown-stage'
  | 'unknown-output'
  | 'stage-not-compiled'
  | 'division-by-zero'
  | 'non-finite';

/** One ledger error. `column` is 0-based in the formula, where the error has a position. */
export interface LedgerError {
  entry: string;
  code: LedgerErrorCode;
  message: string;
  column?: number;
}

/** What the parser and evaluator need of a ledger entry (C-31's entry without its tags). */
export type LedgerEntryInput = Pick<LedgerEntry, 'id' | 'formula'> & {
  inputs: readonly Pick<LedgerEntry['inputs'][number], 'name' | 'value'>[];
};

/** A parsed reference: its text, its segments and where it starts. */
export interface FormulaRef {
  text: string;
  segments: string[];
  column: number;
}

export type FormulaNode =
  | { kind: 'number'; value: number; column: number }
  | { kind: 'ref'; ref: FormulaRef }
  | { kind: 'negate'; operand: FormulaNode; column: number }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: FormulaNode; right: FormulaNode; column: number };

export type ParseResult =
  | { ok: true; node: FormulaNode; refs: FormulaRef[] }
  | { ok: false; error: { code: 'syntax'; message: string; column: number } };

/**
 * WU-111 (D-447): one boss rotation entry as a stage's `measures.bossGroups` holds it (Appendix A): its selection, its
 * figure against a Pinnacle boss and the fields a `boss.` reference reads.
 */
export interface BossGroupFigures {
  group: number;
  activeSkill: number;
  statSet: number;
  figure?: number | null;
  usesPerSecond?: number | null;
  ignite?: number | null;
  bleed?: number | null;
  poison?: number | null;
}

/** The fields a `<stageId>.boss.g<g>s<s>p<p>.<field>` reference reads (D-447). */
export const BOSS_ENTRY_FIELDS = ['ignite', 'bleed', 'poison', 'usesPerSecond'] as const;

/**
 * A compiled stage's numbers, as the compile record holds them (C-33). WU-111 (the ledger's boss context, fixed in the
 * M-24 handoff): `bossGroups` is the record stage's `measures.bossGroups` and `damageBoss` its `measures.damage.boss`
 * (a number or null); both optional, and a stage without them can't resolve a `boss.` reference.
 */
export interface StageOutputs {
  outputs: Readonly<Record<string, number>>;
  skillOutputs?: Readonly<Record<string, { fields: Readonly<Record<string, number>> }>>;
  bossGroups?: readonly Readonly<BossGroupFigures>[];
  damageBoss?: number | null;
}

export interface LedgerContext {
  /** Every stage id of the plan, compiled or not. */
  stageIds: readonly string[];
  /** The compiled stages' numbers, keyed by stage id. A plan stage missing here wasn't compiled. */
  stages: Readonly<Record<string, StageOutputs>>;
}

export interface LedgerResult {
  value: number | null;
  error: LedgerError | null;
}

const NUMBER_RE = /^\d+(\.\d+)?([eE]\d+)?$/;
const MULTI_REF_RE = /^[A-Za-z0-9_]+(\.[A-Za-z_][A-Za-z0-9_]*)+$/;
const SINGLE_REF_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const WORD_CHAR_RE = /[A-Za-z0-9_.]/;
const BREAKDOWN_KEY_RE = /^g\d+s\d+p\d+$/;
const BREAKDOWN_KEY_PARTS_RE = /^g(\d+)s(\d+)p(\d+)$/;
/** The segment that starts a boss reference (D-447). */
const BOSS_SEGMENT = 'boss';
const BOSS_MEASURED = 'measured';

/** Whether `text` is a REF of two or more segments (a `pob-computed` source ref, C-30). */
export function isMultiSegmentRef(text: string): boolean {
  return MULTI_REF_RE.test(text);
}

type Token =
  | { kind: 'number'; value: number; text: string; column: number }
  | { kind: 'ref'; text: string; column: number }
  | { kind: 'op'; op: '+' | '-' | '*' | '/'; text: string; column: number }
  | { kind: 'lparen' | 'rparen'; text: string; column: number }
  | { kind: 'end'; text: string; column: number };

const OPERATORS: Record<string, '+' | '-' | '*' | '/'> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '×': '*',
  '/': '/',
  '÷': '/',
};

class FormulaSyntaxError {
  constructor(
    readonly message: string,
    readonly column: number,
  ) {}
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (WORD_CHAR_RE.test(ch)) {
      const start = i;
      while (i < formula.length && WORD_CHAR_RE.test(formula[i])) i += 1;
      const word = formula.slice(start, i);
      if (NUMBER_RE.test(word)) {
        tokens.push({ kind: 'number', value: Number(word), text: word, column: start });
      } else if (MULTI_REF_RE.test(word) || SINGLE_REF_RE.test(word)) {
        tokens.push({ kind: 'ref', text: word, column: start });
      } else {
        throw new FormulaSyntaxError(`"${word}" is neither a number nor a reference`, start);
      }
      continue;
    }
    if (ch in OPERATORS) {
      tokens.push({ kind: 'op', op: OPERATORS[ch], text: ch, column: i });
    } else if (ch === '(') {
      tokens.push({ kind: 'lparen', text: ch, column: i });
    } else if (ch === ')') {
      tokens.push({ kind: 'rparen', text: ch, column: i });
    } else {
      throw new FormulaSyntaxError(`unexpected character "${ch}"`, i);
    }
    i += 1;
  }
  tokens.push({ kind: 'end', text: '', column: formula.length });
  return tokens;
}

/** Parse a formula into its tree and the references it makes, or a `syntax` error with its column. */
export function parseFormula(formula: string): ParseResult {
  try {
    const tokens = tokenize(formula);
    if (tokens.length === 1) throw new FormulaSyntaxError('the formula is empty', 0);
    const refs: FormulaRef[] = [];
    let pos = 0;
    const peek = (): Token => tokens[pos];
    const next = (): Token => tokens[pos++];

    const describe = (t: Token): string => (t.kind === 'end' ? 'the end of the formula' : `"${t.text}"`);

    const parseExpr = (): FormulaNode => {
      let left = parseTerm();
      for (let t = peek(); t.kind === 'op' && (t.op === '+' || t.op === '-'); t = peek()) {
        next();
        left = { kind: 'binary', op: t.op, left, right: parseTerm(), column: t.column };
      }
      return left;
    };

    const parseTerm = (): FormulaNode => {
      let left = parseUnary();
      for (let t = peek(); t.kind === 'op' && (t.op === '*' || t.op === '/'); t = peek()) {
        next();
        left = { kind: 'binary', op: t.op, left, right: parseUnary(), column: t.column };
      }
      return left;
    };

    const parseUnary = (): FormulaNode => {
      const t = peek();
      if (t.kind === 'op' && (t.op === '-' || t.op === '+')) {
        next();
        const operand = parseUnary();
        return t.op === '-' ? { kind: 'negate', operand, column: t.column } : operand;
      }
      return parsePrimary();
    };

    const parsePrimary = (): FormulaNode => {
      const t = next();
      if (t.kind === 'number') return { kind: 'number', value: t.value, column: t.column };
      if (t.kind === 'ref') {
        const ref: FormulaRef = { text: t.text, segments: t.text.split('.'), column: t.column };
        refs.push(ref);
        return { kind: 'ref', ref };
      }
      if (t.kind === 'lparen') {
        const inner = parseExpr();
        const close = next();
        if (close.kind !== 'rparen') {
          throw new FormulaSyntaxError(`missing ")" for the "(" at column ${t.column}; found ${describe(close)}`, close.column);
        }
        return inner;
      }
      throw new FormulaSyntaxError(`expected a number, a reference or "(" but found ${describe(t)}`, t.column);
    };

    const node = parseExpr();
    const rest = peek();
    if (rest.kind !== 'end') throw new FormulaSyntaxError(`unexpected ${describe(rest)}`, rest.column);
    return { ok: true, node, refs };
  } catch (e) {
    if (e instanceof FormulaSyntaxError) {
      return { ok: false, error: { code: 'syntax', message: e.message, column: e.column } };
    }
    throw e;
  }
}

function syntaxError(entry: string, err: { message: string; column: number }): LedgerError {
  return { entry, code: 'syntax', message: err.message, column: err.column };
}

/** The `unknown-input` or `unknown-stage` error one reference raises, if any. */
function staticRefError(entry: LedgerEntryInput, ref: FormulaRef, stageIds: readonly string[]): LedgerError | null {
  if (ref.segments.length === 1) {
    if (entry.inputs.some((i) => i.name === ref.text)) return null;
    const declared = entry.inputs.map((i) => i.name);
    return {
      entry: entry.id,
      code: 'unknown-input',
      message: `"${ref.text}" is not an input of this entry; its inputs: ${declared.length ? declared.join(', ') : 'none'}`,
      column: ref.column,
    };
  }
  const stage = ref.segments[0];
  if (stageIds.includes(stage)) return null;
  return {
    entry: entry.id,
    code: 'unknown-stage',
    message: `"${ref.text}" names stage "${stage}", which the plan doesn't have; its stages: ${[...new Set(stageIds)].join(', ')}`,
    column: ref.column,
  };
}

/**
 * The validation-time errors of one entry (D-163): a `syntax` error, or one `unknown-input` /
 * `unknown-stage` error per reference that names neither an input of the entry nor a plan stage.
 */
export function checkLedgerEntry(entry: LedgerEntryInput, stageIds: readonly string[]): LedgerError[] {
  const parsed = parseFormula(entry.formula);
  if (!parsed.ok) return [syntaxError(entry.id, parsed.error)];
  return parsed.refs.map((r) => staticRefError(entry, r, stageIds)).filter((e): e is LedgerError => e !== null);
}

class EvalFailure {
  constructor(readonly error: LedgerError) {}
}

const finiteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * WU-111 (D-447): the value a boss reference names in a stage, its segments after the stage id (`['boss', 'measured']`,
 * `['boss', 'g1s1p2']`, `['boss', 'g1s1p1', 'ignite']`): `damageBoss`, an entry's figure, or one of its
 * `BOSS_ENTRY_FIELDS`; undefined when the stage has no such value (no `bossGroups`, no entry with that selection, or a
 * null).
 */
export function bossValue(stage: StageOutputs, rest: readonly string[]): number | undefined {
  if (rest[0] !== BOSS_SEGMENT) return undefined;
  if (rest.length === 2 && rest[1] === BOSS_MEASURED) return finiteNumber(stage.damageBoss) ? stage.damageBoss : undefined;
  const m = rest.length >= 2 && rest.length <= 3 ? BREAKDOWN_KEY_PARTS_RE.exec(rest[1]) : null;
  if (m === null) return undefined;
  const [group, activeSkill, statSet] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const entry = (stage.bossGroups ?? []).find((e) => e.group === group && e.activeSkill === activeSkill && e.statSet === statSet);
  if (entry === undefined) return undefined;
  if (rest.length === 2) return finiteNumber(entry.figure) ? entry.figure : undefined;
  const field = rest[2] as (typeof BOSS_ENTRY_FIELDS)[number];
  if (!(BOSS_ENTRY_FIELDS as readonly string[]).includes(field)) return undefined;
  const v = entry[field];
  return finiteNumber(v) ? v : undefined;
}

/**
 * The number a reference's segments after the stage id name in a compiled stage: a main output (`<Field>`), a breakdown
 * field (`g<group>s<skill>p<statSet>.<Field>`) or a boss reference (`bossValue`); undefined when the record holds none.
 */
export function stageValue(stage: StageOutputs, rest: readonly string[]): number | undefined {
  if (rest[0] === BOSS_SEGMENT && rest.length >= 2) return bossValue(stage, rest);
  if (rest.length === 1 && Object.prototype.hasOwnProperty.call(stage.outputs, rest[0])) {
    const v = stage.outputs[rest[0]];
    return typeof v === 'number' ? v : undefined;
  }
  if (rest.length === 2 && BREAKDOWN_KEY_RE.test(rest[0])) {
    const fields = stage.skillOutputs?.[rest[0]]?.fields;
    if (fields && Object.prototype.hasOwnProperty.call(fields, rest[1])) {
      const v = fields[rest[1]];
      return typeof v === 'number' ? v : undefined;
    }
  }
  return undefined;
}

/** Evaluate one entry against the compiled stages. Never throws: a failure is a null value with its error. */
export function evaluateLedgerEntry(entry: LedgerEntryInput, ctx: LedgerContext): LedgerResult {
  const parsed = parseFormula(entry.formula);
  if (!parsed.ok) return { value: null, error: syntaxError(entry.id, parsed.error) };

  const fail = (code: LedgerErrorCode, message: string, column: number): never => {
    throw new EvalFailure({ entry: entry.id, code, message, column });
  };

  const finite = (v: number, column: number, what: string): number => {
    if (!Number.isFinite(v)) fail('non-finite', `${what} is ${v}, not a finite number`, column);
    return v;
  };

  const resolve = (ref: FormulaRef): number => {
    const known = staticRefError(entry, ref, ctx.stageIds);
    if (known) throw new EvalFailure(known);
    if (ref.segments.length === 1) {
      const input = entry.inputs.find((i) => i.name === ref.text)!;
      return finite(input.value, ref.column, `input "${ref.text}"`);
    }
    const [stageId, ...rest] = ref.segments;
    const stage = Object.prototype.hasOwnProperty.call(ctx.stages, stageId) ? ctx.stages[stageId] : undefined;
    if (!stage) {
      return fail('stage-not-compiled', `"${ref.text}" names stage "${stageId}", which this compile didn't include`, ref.column);
    }
    const value = stageValue(stage, rest);
    if (typeof value !== 'number') {
      const what =
        rest[0] === BOSS_SEGMENT && rest.length >= 2
          ? `no boss figure of stage "${stageId}" in the compile record (its measures.bossGroups and measures.damage.boss, D-447)`
          : `no output of stage "${stageId}" in the compile record`;
      return fail('unknown-output', `"${ref.text}" names ${what}`, ref.column);
    }
    return finite(value, ref.column, `"${ref.text}"`);
  };

  const evaluate = (node: FormulaNode): number => {
    switch (node.kind) {
      case 'number':
        return finite(node.value, node.column, 'the number');
      case 'ref':
        return resolve(node.ref);
      case 'negate':
        return -evaluate(node.operand);
      case 'binary': {
        const left = evaluate(node.left);
        const right = evaluate(node.right);
        if (node.op === '/' && right === 0) {
          return fail('division-by-zero', 'the divisor is 0', node.column);
        }
        const value =
          node.op === '+' ? left + right : node.op === '-' ? left - right : node.op === '*' ? left * right : left / right;
        return finite(value, node.column, `the result of "${node.op}"`);
      }
    }
  };

  try {
    return { value: evaluate(parsed.node), error: null };
  } catch (e) {
    if (e instanceof EvalFailure) return { value: null, error: e.error };
    throw e;
  }
}

/** Evaluate every entry, keyed by entry id (the compile record's `ledger`, C-33). */
export function evaluateLedger(entries: readonly LedgerEntryInput[], ctx: LedgerContext): Record<string, LedgerResult> {
  const out: Record<string, LedgerResult> = {};
  for (const entry of entries) out[entry.id] = evaluateLedgerEntry(entry, ctx);
  return out;
}

/** One line for an error, as validation, the compile record and the tool text show it:
 * `<code> at column <n>: <message>` (or `<code>: <message>` when the error has no position). */
export function ledgerErrorText(error: LedgerError): string {
  return `${error.code}${error.column === undefined ? '' : ` at column ${error.column}`}: ${error.message}`;
}
