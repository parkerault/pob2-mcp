/**
 * The compile record (C-33, slice 2 §3.6): `compile-record.json`, written by `compile_plan` beside the
 * compiled plan. It holds each compiled stage's numbers (PoB's main outputs and the per-skill, per-stat-set
 * breakdown), the re-evaluated ledger, the import code, the sets and loadouts the compile made, and the
 * check verdicts. It is informational: overwriting a builds-folder file is decided by the write ledger,
 * never by the record (D-211).
 *
 * V1 and V2 (WU-42) fill `v1`, `v2`, `configEffective` and `pobWarnings`; until then they are `null`,
 * `null`, `{}` and empty lists.
 */
import { isMultiSegmentRef, type StageOutputs } from './ledger.js';
import type { Plan } from './schema.js';
import type { SourceTag } from './sourceTag.js';

export const RECORD_VERSION = 1;
/** The record's file name, beside the plan. */
export const RECORD_FILE = 'compile-record.json';
/** The measure-only compile's XML, beside the plan (A-P6). */
export const MEASURE_ONLY_XML_FILE = 'compiled-build.xml';

export type CompileMode = 'final' | 'measure-only';
export type SetKind = 'tree' | 'item' | 'skill' | 'config';
export type ConfigValue = boolean | number | string;

export interface Finding {
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

/** A check's verdict: `pass` exactly when `findings` is empty; notes never fail it (A-29). */
export interface Verdict {
  pass: boolean;
  findings: Finding[];
  notes: Finding[];
}

export interface StageRecord {
  loadoutName: string;
  level: number;
  /** This stage's `compile_stage` request, in ms. */
  elapsedMs: number;
  outputs: Record<string, number>;
  skillOutputs: Record<string, { skill: string; statSetLabel: string; fields: Record<string, number> }>;
  /** Every option the stage lists, earned and scenario, as written into its config set (C-32). */
  configWritten: Record<string, ConfigValue>;
  /** D-212; filled from WU-42's V2 inputs, `{}` until then. */
  configEffective: Record<
    string,
    { value: ConfigValue; origin: 'explicit' | 'default' | 'placeholder'; class: 'earned' | 'scenario' | 'baseline' | 'unlisted' }
  >;
  /** Filled from WU-42's V1 inputs. */
  pobWarnings: { kept: string[]; filtered: string[] };
  v1: Verdict | null;
  v2: Verdict | null;
}

export interface CompileRecord {
  recordVersion: 1;
  planSchemaVersion: number;
  planSha1: string;
  compiledAt: string;
  mode: CompileMode;
  stagesCompiled: string[];
  /** The engine as running (C-6). */
  engine: { pobTag: string; pobCommit: string; treeVersion: string };
  /** Every place the plan's `versions` differ from `engine`. */
  versionNotes: string[];
  /** Informational (D-211): the builds-folder file of a final compile, or the measure-only XML in the run. */
  pobFile: { location: 'builds' | 'run'; path: string; sha1: string; bytes: number };
  importCode: string;
  savedLevel: { level: number; autoMode: true };
  activeLoadout: string;
  sets: { kind: SetKind; id: number; title: string; stages: string[] }[];
  stages: Record<string, StageRecord>;
  ledger: Record<string, { value: number | null; error: string | null }>;
  /** `pob-computed` tags naming no record field. */
  unresolvedRefs: { where: string; ref: string }[];
  timing: { totalMs: number; checkMs: number; finishMs: number; exportMs: number };
}

/** Every place the plan's `versions` differ from the running engine's (C-6). */
export function versionNotes(versions: Plan['versions'], engine: CompileRecord['engine']): string[] {
  const notes: string[] = [];
  const pairs: [string, string, string][] = [
    ['pobTag', versions.pobTag, engine.pobTag],
    ['pobCommit', versions.pobCommit, engine.pobCommit],
    ['treeVersion', versions.treeVersion, engine.treeVersion],
  ];
  for (const [field, planned, running] of pairs) {
    if (planned !== running) notes.push(`versions.${field} is "${planned}", but the engine runs "${running}"`);
  }
  return notes;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Render a JSON path as the plan errors do: `.` between keys, `[n]` for indices. */
function pathText(segments: readonly (string | number)[]): string {
  let out = '';
  for (const seg of segments) out += typeof seg === 'number' ? `[${seg}]` : out === '' ? seg : `.${seg}`;
  return out;
}

/** Every source tag in the plan, with its JSON path: claims, variant bases, exceptions, respec costs,
 * scenario tags and ledger inputs. */
function sourceTags(plan: Plan): { where: string; tag: SourceTag }[] {
  const out: { where: string; tag: SourceTag }[] = [];
  const visit = (value: unknown, at: (string | number)[]): void => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, [...at, i]));
      return;
    }
    if (!isRecord(value)) return;
    if (typeof value.kind === 'string' && typeof value.ref === 'string' && at.length > 0) {
      out.push({ where: pathText(at), tag: value as unknown as SourceTag });
      return;
    }
    for (const [k, v] of Object.entries(value)) visit(v, [...at, k]);
  };
  visit(plan.stages, ['stages']);
  visit(plan.ledger, ['ledger']);
  return out;
}

/** Whether a `pob-computed` ref names a field of the record: `<stageId>.<Field>` or
 * `<stageId>.g<group>s<skill>p<statSet>.<Field>`. */
export function refResolves(ref: string, stages: Readonly<Record<string, StageOutputs>>): boolean {
  if (!isMultiSegmentRef(ref)) return false;
  const [stageId, ...rest] = ref.split('.');
  const stage = Object.prototype.hasOwnProperty.call(stages, stageId) ? stages[stageId] : undefined;
  if (!stage) return false;
  if (rest.length === 1) return typeof stage.outputs[rest[0]] === 'number';
  if (rest.length === 2) {
    const fields = stage.skillOutputs?.[rest[0]]?.fields;
    return fields !== undefined && typeof fields[rest[1]] === 'number';
  }
  return false;
}

/** The `pob-computed` tags whose ref names no field of this record (C-33). */
export function unresolvedRefs(plan: Plan, stages: Readonly<Record<string, StageOutputs>>): CompileRecord['unresolvedRefs'] {
  return sourceTags(plan)
    .filter(({ tag }) => tag.kind === 'pob-computed' && !refResolves(tag.ref, stages))
    .map(({ where, tag }) => ({ where, ref: tag.ref }));
}

/** The record as written: pretty JSON with a final newline. */
export function recordText(record: CompileRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}
