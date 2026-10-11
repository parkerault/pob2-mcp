/**
 * The compile record (C-33, slice 2 §3.6): `compile-record.json`, written by `compile_plan` beside the
 * compiled plan. It holds each compiled stage's numbers (PoB's main outputs and the per-skill, per-stat-set
 * breakdown), the re-evaluated ledger, the import code, the sets and loadouts the compile made, and the
 * check verdicts. It is informational: overwriting a builds-folder file is decided by the write ledger,
 * never by the record (D-211).
 *
 * V1 and V2 (WU-42, `src/plan/checks/`) fill `v1`, `v2`, `configEffective` and `pobWarnings`.
 *
 * **Version 2** (WU-55, D-293, D-294, D-321) adds, per stage, beside the raw figures, which stay as PoB
 * measured them:
 * - `countedOutputs` and `countedSkillOutputs`: the figures with their group's Count applied by PoB's own Full
 *   DPS rule (`COUNT_RULE`, `countedFields`): hits × count, damage over time × count only when it stacks.
 * - `customModsWritten` and the mark `computedWithCustomMods`: when true, every figure of the stage, defences
 *   included, was computed with custom modifiers present: from `config.customMods`, or, in a version-1 plan,
 *   PoB's `customMods` option listed as an earned or scenario entry. A ledger value that reads such a stage
 *   carries the same mark.
 */
import { isMultiSegmentRef, parseFormula, type StageOutputs } from './ledger.js';
import type { Plan, Stage } from './schema.js';
import type { SourceTag } from './sourceTag.js';

export const RECORD_VERSION = 2;
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

/**
 * How Count scales a figure in PoB's Full DPS (pin `Modules/Calcs.lua`, `calcFullDPS`), for the figures it
 * merges per skill:
 * - `count`: × the count. Hits (`out.TotalDPS * actor.count`, `:322`) and impale (`mergeStatsSpec`'s scaled
 *   `ImpaleDPS`, `:198`).
 * - `stacking-dot`: × the count only when the skill's damage over time stacks (PoB's `DotCanStack`), else as
 *   measured (`out.TotalDot * actor.dotScale`, `:325-326`; `dotScale = dotCanStack and activeSkillCount or 1`,
 *   `:367`, `:411`).
 * - `once`: as measured. The ailments and ground effects are the best one of any skill, never multiplied
 *   (`mode = "max"`, `:192-197`), and decay is added once (`:199`).
 *
 * A figure Full DPS doesn't merge per skill (`CombinedDPS`, `TotalDotDPS`, a defence, a crit chance) has no
 * Count rule, so it isn't in the counted figures; the raw figure is the one to read.
 *
 * The raw `outputs.FullDPS` and `outputs.FullDotDPS`, non-zero because the named source's group is in Full
 * DPS (D-337), are already multiplied by Count inside PoB: they are `calcFullDPS`'s totals (stored at `:81`,
 * and at `:520-521` for the main output), which add each hit × its count (`:322`) and each damage over time
 * by this same rule (`:325-326`). Never apply Count to them again.
 */
export type CountScale = 'count' | 'stacking-dot' | 'once';
export const COUNT_RULE: ReadonlyMap<string, CountScale> = new Map<string, CountScale>([
  ['TotalDPS', 'count'],
  ['ImpaleDPS', 'count'],
  ['TotalDot', 'stacking-dot'],
  ['BleedDPS', 'once'],
  ['CorruptingBloodDPS', 'once'],
  ['IgniteDPS', 'once'],
  ['BurningGroundDPS', 'once'],
  ['PoisonDPS', 'once'],
  ['CausticGroundDPS', 'once'],
  ['DecayDPS', 'once'],
]);

/** A skill's figures with its group's Count applied (D-293, D-321). */
export interface CountedFigures {
  /** The group's count: the plan's `count`, 1 when it has none. */
  count: number;
  /** PoB's `DotCanStack` for the skill and stat set: whether Count multiplies its damage over time. */
  dotCanStack: boolean;
  /** Each figure with a Count rule (`COUNT_RULE`) that PoB measured, with the rule applied. */
  fields: Record<string, number>;
}

/** The figures of `fields` that have a Count rule, with it applied for `count` copies (`COUNT_RULE`). */
export function countedFields(fields: Readonly<Record<string, number>>, count: number, dotCanStack: boolean): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [field, value] of Object.entries(fields)) {
    const rule = COUNT_RULE.get(field);
    if (rule === undefined) continue;
    out[field] = rule === 'count' || (rule === 'stacking-dot' && dotCanStack) ? value * count : value;
  }
  return out;
}

/** Whether each measured skill's damage over time stacks: the main skill's, and per breakdown key. */
export interface DotStacking {
  main: boolean;
  skills: Readonly<Record<string, boolean>>;
}

/**
 * D-293, D-321: a stage's counted figures. The main skill's (`outputs`) take the main group's count; each
 * breakdown entry (`g<group>s<skill>p<statSet>`) takes its own group's.
 */
export function countedFigures(
  stage: Pick<Stage, 'skills'>,
  outputs: Readonly<Record<string, number>>,
  skillOutputs: StageRecord['skillOutputs'],
  dotCanStack: DotStacking,
): Pick<StageRecord, 'countedOutputs' | 'countedSkillOutputs'> {
  const countOf = (group: number) => stage.skills.groups[group - 1]?.count ?? 1;
  const main = stage.skills.main.group;
  const countedSkillOutputs: StageRecord['countedSkillOutputs'] = {};
  for (const [key, entry] of Object.entries(skillOutputs)) {
    const group = Number(/^g(\d+)s\d+p\d+$/.exec(key)?.[1] ?? 0);
    const stacks = dotCanStack.skills[key] === true;
    countedSkillOutputs[key] = {
      skill: entry.skill,
      statSetLabel: entry.statSetLabel,
      count: countOf(group),
      dotCanStack: stacks,
      fields: countedFields(entry.fields, countOf(group), stacks),
    };
  }
  return {
    countedOutputs: { group: main, count: countOf(main), dotCanStack: dotCanStack.main, fields: countedFields(outputs, countOf(main), dotCanStack.main) },
    countedSkillOutputs,
  };
}

/** Whether a ledger formula reads a figure of one of `stageIds` (D-321: its value carries their mark). */
export function formulaReadsStages(formula: string, stageIds: ReadonlySet<string>): boolean {
  const parsed = parseFormula(formula);
  return parsed.ok && parsed.refs.some((r) => r.segments.length > 1 && stageIds.has(r.segments[0]));
}

export interface StageRecord {
  loadoutName: string;
  level: number;
  /** This stage's `compile_stage` request, in ms. */
  elapsedMs: number;
  /** PoB's main output, as measured: the main skill's figures and the defences. */
  outputs: Record<string, number>;
  /** D-293, D-321: the main skill's figures with the main group's Count applied (`countedFigures`). */
  countedOutputs: CountedFigures & { group: number };
  skillOutputs: Record<string, { skill: string; statSetLabel: string; fields: Record<string, number> }>;
  /** D-293, D-321: each `skillOutputs` entry, under the same key, with its group's Count applied. */
  countedSkillOutputs: Record<string, CountedFigures & { skill: string; statSetLabel: string }>;
  /** Every option the stage lists, earned and scenario, as written into its config set (C-32). */
  configWritten: Record<string, ConfigValue>;
  /** D-293: the lines written into PoB's `customMods` option, the stage's `config.customMods` texts in order. */
  customModsWritten: string[];
  /**
   * D-293, D-321: the custom-modifier mark. True when the stage was measured with custom modifiers present,
   * so every figure of it (`outputs`, defences included, `skillOutputs` and the counted figures) rests on
   * them: an estimate, not PoB's model alone. That is when its written config held PoB's `customMods` option
   * with text, whatever the source: `customModsWritten`, or, in a version-1 plan, an earned or scenario entry
   * for the option in `configWritten` (`measuredWithCustomMods`).
   */
  computedWithCustomMods: boolean;
  /** D-212: every option that affects the calculation, filled by V2 from the stage's config set. */
  configEffective: Record<
    string,
    { value: ConfigValue; origin: 'explicit' | 'default' | 'placeholder'; class: 'earned' | 'scenario' | 'baseline' | 'unlisted' }
  >;
  /** PoB's warning lines, kept (each a V1 `pob-warning` finding) or filtered as informational. */
  pobWarnings: { kept: string[]; filtered: string[] };
  v1: Verdict | null;
  v2: Verdict | null;
}

export interface CompileRecord {
  /** 2 from WU-55 (D-321): the counted figures and the custom-modifier marks. */
  recordVersion: 2;
  planSchemaVersion: number;
  planSha1: string;
  /**
   * D-266: the sha1 of the plan's build-affecting projection (`buildHash.ts`: the plan without its
   * `stages[].claims` and its `source` and `tag` fields). A claims-only edit after the compile leaves it equal.
   */
  buildSha1: string;
  compiledAt: string;
  mode: CompileMode;
  stagesCompiled: string[];
  /** The engine as running (C-6). */
  engine: { pobTag: string; pobCommit: string; treeVersion: string };
  /** Every place the plan's `versions` differ from `engine`. */
  versionNotes: string[];
  /**
   * PoB2 behaviours the guide must warn about, today one per weapon-fit flag the stages differ in (WU-41
   * review): switching loadouts in PoB2 can unequip a planned off-hand.
   */
  loadoutWarnings: string[];
  /**
   * Config values the file keeps that a save in PoB2 would drop again (D-248, WU-41 review): one line per
   * config set, naming its stages and the options.
   */
  saveWarnings: string[];
  /** Informational (D-211): the builds-folder file of a final compile, or the measure-only XML in the run. */
  pobFile: { location: 'builds' | 'run'; path: string; sha1: string; bytes: number };
  importCode: string;
  savedLevel: { level: number; autoMode: true };
  activeLoadout: string;
  sets: { kind: SetKind; id: number; title: string; stages: string[] }[];
  stages: Record<string, StageRecord>;
  /**
   * Each entry's value. `computedWithCustomMods` (D-321) is true when its formula reads a figure of a stage
   * whose `computedWithCustomMods` is true.
   */
  ledger: Record<string, { value: number | null; error: string | null; computedWithCustomMods: boolean }>;
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
