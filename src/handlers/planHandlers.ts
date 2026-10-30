/**
 * The plan tools (slice 2): `compile_plan` (C-41) and `guide_run` (C-50).
 *
 * - `compile_plan {plan_path, build_name | measure_only, stages?}` compiles a plan.json in the guides root
 *   into one PoB2 build with a loadout per stage (`src/plan/compiler.ts`). Measure-only mode writes the
 *   compile record and the compiled XML beside the plan; final mode writes the builds-folder file through
 *   C-17, its write-ledger entry (D-211) and the record, under `first_free` (D-466) at the first free of the
 *   cleaned name, the name with the run date, and the dated name numbered. Kind `load`: the call replaces the
 *   engine's build (D-191, D-210).
 * - `compile_plan {plan_path, draft_name}` and `{plan_path, remove_draft}` (D-466) write the design gate's draft,
 *   a copy of the plan's last whole-plan measure-only XML, as `<name> (draft).xml` in the builds folder, or delete
 *   a draft this build wrote; the router runs both as kind `none`: no engine.
 * - `guide_run {new_run}` creates the next run folder `<slug>/<YYYY-MM-DD>-<n>` (D-207) and says whether the
 *   engine's build has unsaved changes the next compile would discard (D-210); it never touches the
 *   engine (the router runs it as kind `none`, D-216). `guide_run {validate, stages?}` checks a plan
 *   against its schema, the reference data and the game data (`compile_check`) without changing the build.
 * - `guide_run {view: {plan, stage}}` and `{view: {plan, claims: true}}` (D-356) read part of a plan without
 *   the engine (kind `none`): one stage's section with its key figures from the record beside the plan, or
 *   every claim, compact. Each reply stays under the 25K-token cut-off of Read and of an MCP tool reply.
 * - `guide_run {resume: <run folder>}` (D-415) finds an earlier run's folder, absolute or relative to the guides
 *   root, resolved and confined as `new_run`'s paths are, and checks it holds a `run-log.json`; it returns the folder
 *   and `loadedBuildUnsaved` as `new_run` does, writes nothing and never touches the engine (kind `none`).
 *
 * Only these argument combinations are accepted; any other is refused, naming the conflict, before
 * anything is done.
 */
import type { Stats } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import type { EngineCallContext, LoadedBuild } from '../engine/session.js';
import type { BuildFileWriter } from '../services/buildFileWriter.js';
import { readPin } from '../engine/pinCheck.js';
import { checkGuidesRoot, createRunFolder, realPathInGuides, resolveInGuidesRoot } from '../utils/guidesPath.js';
import { wrapHandler } from '../utils/errorHandling.js';
import {
  compilePlan,
  keyFigureLine,
  removeDraft,
  validatePlanFile,
  writeDraft,
  type CompileRequest,
  type CompileResult,
  type DraftWriteResult,
} from '../plan/compiler.js';
import { buildSha1 } from '../plan/buildHash.js';
import { RECORD_FILE, RECORD_VERSION, type CompileRecord, type Verdict } from '../plan/record.js';
import type { Stage } from '../plan/schema.js';
import { loadReferenceData, type ReferenceData } from '../plan/referenceData.js';
import { OFFENSE_STAT_FIELDS } from './luaHandlers.js';

/** What the plan tools need of the server. */
export interface PlanContext {
  pobDirectory: string;
  stateDir: string;
  /** C-34: the guides root. */
  guidesDirectory: string;
  /** The running engine call's context (C-3). */
  engine: () => EngineCallContext;
  /** C-17: the only writer into the builds folder (its delete for the draft mode's `remove_draft`, D-466). */
  buildFileWriter: Pick<BuildFileWriter, 'checkBuildFile' | 'writeBuildFile' | 'deleteBuildFile'>;
  /** The build the engine holds (C-3 `loaded`). */
  loadedBuild: () => LoadedBuild | null;
  /** Whether the engine's build has unsaved changes (`session.isDirty()`, read without the lock). */
  isDirty: () => boolean;
  /** The C1/E1 data; default: `loadReferenceData()` from the package's `data/`. */
  referenceData?: () => ReferenceData;
  /** The wall clock (dates the run folder and the record); default `new Date()`. */
  wallClock?: () => Date;
}

const COMPILE_ARGS = ['plan_path', 'build_name', 'measure_only', 'stages', 'first_free', 'draft_name', 'remove_draft'] as const;
/** D-466: the draft mode's two arguments, each with plan_path only. */
const DRAFT_ARGS = ['draft_name', 'remove_draft'] as const;
const GUIDE_RUN_ARGS = ['new_run', 'resume', 'validate', 'view', 'stages'] as const;
/** `guide_run`'s modes: a call gives exactly one of them (C-50, D-356, D-415). */
const GUIDE_RUN_MODES = ['new_run', 'resume', 'validate', 'view'] as const;
const VIEW_KEYS = ['plan', 'stage', 'claims'] as const;

/** Arguments the other plan tool takes, and where they belong (D-216). */
const MOVED: Record<string, string> = {
  new_run: 'run folders are created by guide_run {new_run} (D-216)',
  validate: 'plans are validated by guide_run {validate} (D-216)',
  validate_only: 'plans are validated by guide_run {validate} (D-216)',
};

function refuseUnknown(tool: string, args: Record<string, unknown>, known: readonly string[]): void {
  const unknown = Object.keys(args).filter((k) => !known.includes(k));
  if (unknown.length === 0) return;
  const why = unknown.map((k) => (MOVED[k] && tool === 'compile_plan' ? `${k}: ${MOVED[k]}` : `"${k}"`)).join('; ');
  throw new Error(`${tool} takes only ${known.join(', ')}; it has no argument ${why}. Nothing was done.`);
}

function stringList(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v === '')) {
    throw new Error(`${name} must be a list of stage ids`);
  }
  return value as string[];
}

function nonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} must be a non-empty string`);
  return value;
}

/** `compile_plan`'s requests (C-41, D-466): a compile, the draft's write, or its delete. */
export type CompilePlanRequest =
  | CompileRequest
  | { mode: 'draft'; planPath: string; draftName: string }
  | { mode: 'remove-draft'; planPath: string; draftPath: string };

/**
 * `compile_plan`'s modes (C-41, D-466): measure-only, final (with `first_free` or without), the draft
 * (`draft_name`) and its delete (`remove_draft`), each of those two with `plan_path` only. Any other
 * combination is refused.
 */
export function compileRequestOf(args: Record<string, unknown> | undefined): CompilePlanRequest {
  const a = args ?? {};
  refuseUnknown('compile_plan', a, COMPILE_ARGS);
  const planPath = nonEmptyString(a.plan_path, 'plan_path');
  const drafts = DRAFT_ARGS.filter((k) => a[k] !== undefined);
  if (drafts.length > 0) {
    const given = [...drafts, ...COMPILE_ARGS.filter((k) => k !== 'plan_path' && !(DRAFT_ARGS as readonly string[]).includes(k) && a[k] !== undefined)];
    if (given.length > 1) {
      throw new Error(
        `${listed(given)} conflict: draft_name (write the build's draft) and remove_draft (delete it) each take plan_path ` +
          'only (D-466). Nothing was done.',
      );
    }
    if (drafts[0] === 'draft_name') return { mode: 'draft', planPath, draftName: nonEmptyString(a.draft_name, 'draft_name') };
    return { mode: 'remove-draft', planPath, draftPath: nonEmptyString(a.remove_draft, 'remove_draft') };
  }
  if (a.measure_only !== undefined && typeof a.measure_only !== 'boolean') throw new Error('measure_only must be true or false');
  if (a.first_free !== undefined && typeof a.first_free !== 'boolean') throw new Error('first_free must be true or false');
  const buildName = a.build_name === undefined ? undefined : nonEmptyString(a.build_name, 'build_name');
  const stages = a.stages === undefined ? undefined : stringList(a.stages, 'stages');
  if (a.measure_only === true) {
    if (buildName !== undefined) {
      throw new Error(
        'build_name and measure_only: true conflict: a measure-only compile writes only the record and the compiled XML ' +
          'beside the plan, never a builds-folder file (D-208). Nothing was done.',
      );
    }
    if (a.first_free === true) {
      throw new Error('first_free and measure_only: true conflict: first_free picks the final file\'s name (D-466). Nothing was done.');
    }
    return { mode: 'measure-only', planPath, ...(stages !== undefined ? { stages } : {}) };
  }
  if (buildName === undefined) {
    throw new Error('give build_name for a final compile, or measure_only: true for a measure-only one. Nothing was done.');
  }
  if (stages !== undefined) {
    throw new Error(
      'build_name and stages conflict: a final compile always compiles the whole plan; a stages subset is for ' +
        'measure_only: true (A-P8). Nothing was done.',
    );
  }
  return { mode: 'final', planPath, buildName, ...(a.first_free === true ? { firstFree: true } : {}) };
}

/** Where the record holds what the text leaves out. */
const RECORD_FINDINGS_HINT = 'compile-record.json: stages.<id>.v1.findings and stages.<id>.v2.findings';

function verdictText(name: string, v: Verdict | null): string {
  return v === null ? `${name} not checked` : `${name} ${v.pass ? 'pass' : 'fail'}`;
}

/**
 * The most V1/V2 findings the text prints, over all stages: every finding up to here (amendment 1 S7: a gate
 * reads its findings in this text), and a bound that keeps the reply well under 25K tokens. Past it, one line
 * sends the reader to the record.
 */
export const MAX_FINDINGS_PRINTED = 200;

/**
 * C-41's text: the summary line, a line per stage with its verdicts, its key-figure line (D-356,
 * `keyFigureLine`) and its V1/V2 findings (every one, up to MAX_FINDINGS_PRINTED over all stages), the ledger
 * values, the paths written.
 */
export function renderCompileText(result: CompileResult): string {
  const r = result.record;
  const n = r.stagesCompiled.length;
  const lines: string[] = [
    `Compiled ${result.planPath}: ${n} stage${n === 1 ? '' : 's'} (${r.mode}) in ${(r.timing.totalMs / 1000).toFixed(1)} s.`,
  ];
  let printed = 0;
  let unprinted = 0;
  for (const id of r.stagesCompiled) {
    const s = r.stages[id];
    lines.push(`Stage ${id} "${s.loadoutName}" level ${s.level}: ${verdictText('V1', s.v1)}, ${verdictText('V2', s.v2)}`);
    lines.push(keyFigureLine(s, result.mains[id]));
    for (const f of [...(s.v1?.findings ?? []), ...(s.v2?.findings ?? [])]) {
      if (printed < MAX_FINDINGS_PRINTED) {
        lines.push(`  - ${f.code}: ${f.message}`);
        printed += 1;
      } else unprinted += 1;
    }
  }
  if (unprinted > 0) lines.push(`${unprinted} more findings; Grep the record's findings (${RECORD_FINDINGS_HINT}).`);
  for (const [id, entry] of Object.entries(r.ledger)) {
    lines.push(entry.value !== null ? `${id} = ${entry.value}` : `${id}: ${entry.error ?? 'no value'}`);
  }
  for (const note of r.versionNotes) lines.push(`Version note: ${note}`);
  for (const warning of r.loadoutWarnings) lines.push(`Loadout warning: ${warning}`);
  for (const warning of r.saveWarnings) lines.push(`Save warning: ${warning}`);
  lines.push(`Saved in auto-level mode at level ${r.savedLevel.level}, with loadout "${r.activeLoadout}" active; the engine now holds this build.`);
  for (const p of result.written.builds) {
    lines.push(`Wrote ${p} in the builds folder${result.replacedFile ? ' (replaced; the previous file is backed up in the state folder)' : ''}.`);
  }
  for (const p of result.written.guides) lines.push(`Wrote ${p} in the guides root.`);
  return lines.join('\n');
}

/**
 * D-466: the draft mode's reply: `Draft written: <relpath>` (Appendix A's line, whole), then whether it replaced this
 * build's earlier draft, and the earlier draft names it left.
 */
export function renderDraftText(result: DraftWriteResult): string {
  const lines = [`Draft written: ${result.path}`];
  if (result.replaced) lines.push("It replaced this build's earlier draft of that name.");
  for (const rel of result.passed) lines.push(`Left ${rel}: it changed on disk since this build wrote it, or another build or run wrote it.`);
  return lines.join('\n');
}

/**
 * `compile_plan` (C-41). A compile runs inside the session's `load` run that the router opened; the draft mode and its
 * delete (D-466) run outside the session (kind `none`).
 */
export async function handleCompilePlan(context: PlanContext, args: Record<string, unknown> | undefined) {
  const parsed = await wrapHandler('compile the plan', async () => compileRequestOf(args));
  if (parsed.mode === 'draft' || parsed.mode === 'remove-draft') {
    const env = {
      pobDirectory: context.pobDirectory,
      stateDir: context.stateDir,
      guidesDirectory: context.guidesDirectory,
      writer: context.buildFileWriter,
      wallClock: context.wallClock ?? (() => new Date()),
    };
    if (parsed.mode === 'draft') {
      return wrapHandler('write the draft', async () => {
        const result = await writeDraft(env, parsed.planPath, parsed.draftName);
        return { content: [{ type: 'text' as const, text: renderDraftText(result) }] };
      });
    }
    return wrapHandler('remove the draft', async () => {
      const removed = await removeDraft(env, parsed.planPath, parsed.draftPath);
      return { content: [{ type: 'text' as const, text: `Draft removed: ${removed.path} (backup ${removed.backupPath})` }] };
    });
  }
  return wrapHandler('compile the plan', async () => {
    const request: CompileRequest = parsed;
    const pin = readPin();
    const result = await compilePlan(
      {
        ctx: context.engine(),
        pobDirectory: context.pobDirectory,
        stateDir: context.stateDir,
        guidesDirectory: context.guidesDirectory,
        writer: context.buildFileWriter,
        referenceData: context.referenceData ?? (() => loadReferenceData()),
        offenseFields: OFFENSE_STAT_FIELDS,
        engine: { pobTag: pin.tag, pobCommit: pin.commit },
        clock: () => performance.now(),
        wallClock: context.wallClock ?? (() => new Date()),
      },
      request,
    );
    return { content: [{ type: 'text' as const, text: renderCompileText(result) }] };
  });
}

/** What a `guide_run {view}` call reads (D-356): one stage's section and key figures, or every claim. */
export type PlanView = { kind: 'stage'; planPath: string; stage: string } | { kind: 'claims'; planPath: string };

export type GuideRunRequest =
  | { mode: 'new_run'; slug: string }
  | { mode: 'resume'; runFolder: string }
  | { mode: 'validate'; planPath: string; stages?: string[] }
  | { mode: 'view'; view: PlanView };

const listed = (names: readonly string[]): string =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** `view`'s two forms (D-356): `{plan, stage}` or `{plan, claims: true}`. Any other is refused. */
function planViewOf(value: unknown): PlanView {
  const forms = '{plan, stage} (one stage\'s section and key figures) or {plan, claims: true} (every claim)';
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`view must be an object: ${forms}. Nothing was done.`);
  const v = value as Record<string, unknown>;
  const unknown = Object.keys(v).filter((k) => !(VIEW_KEYS as readonly string[]).includes(k));
  if (unknown.length > 0) {
    throw new Error(`view takes only ${VIEW_KEYS.join(', ')}; it has no key ${unknown.map((k) => `"${k}"`).join(', ')}. Nothing was done.`);
  }
  const planPath = nonEmptyString(v.plan, 'view.plan');
  const hasStage = v.stage !== undefined;
  const hasClaims = v.claims !== undefined;
  if (hasStage && hasClaims) throw new Error(`view.stage and view.claims conflict: give one of them, ${forms}. Nothing was done.`);
  if (!hasStage && !hasClaims) throw new Error(`view needs stage or claims: ${forms}. Nothing was done.`);
  if (hasClaims) {
    if (v.claims !== true) throw new Error('view.claims must be true (every claim); for one stage, give view.stage instead. Nothing was done.');
    return { kind: 'claims', planPath };
  }
  return { kind: 'stage', planPath, stage: nonEmptyString(v.stage, 'view.stage') };
}

/**
 * `guide_run`'s modes (C-50, D-356, D-415): exactly one of `new_run`, `resume`, `validate` and `view`; `stages` only
 * with `validate`.
 */
export function guideRunRequestOf(args: Record<string, unknown> | undefined): GuideRunRequest {
  const a = args ?? {};
  refuseUnknown('guide_run', a, GUIDE_RUN_ARGS);
  const given = GUIDE_RUN_MODES.filter((m) => a[m] !== undefined);
  if (given.length > 1) throw new Error(`${listed(given)} conflict: give exactly one of new_run, resume, validate and view. Nothing was done.`);
  if (given.length === 0) {
    throw new Error(
      'give new_run (a slug, to create a run folder), resume (a run folder, to go on with an earlier run), validate (a ' +
        'plan_path, to check a plan) or view (a plan and a stage, or claims: true, to read part of a plan). Nothing was done.',
    );
  }
  const mode = given[0];
  if (mode !== 'validate' && a.stages !== undefined) throw new Error(`stages goes only with validate, not with ${mode}. Nothing was done.`);
  if (mode === 'new_run') {
    if (typeof a.new_run !== 'string') throw new Error('new_run must be a slug string');
    return { mode: 'new_run', slug: a.new_run };
  }
  if (mode === 'resume') return { mode: 'resume', runFolder: nonEmptyString(a.resume, 'resume') };
  if (mode === 'view') return { mode: 'view', view: planViewOf(a.view) };
  const planPath = nonEmptyString(a.validate, 'validate');
  return { mode: 'validate', planPath, ...(a.stages !== undefined ? { stages: stringList(a.stages, 'stages') } : {}) };
}

// ---------------------------------------------------------------------------------------------------
// The views (WU-68, D-356)

/**
 * The most characters a view's reply holds: 25K tokens at 2 characters a token, a conservative bound for this
 * JSON-like text (Claude's tokenizer averages 3 to 4 characters a token on it). Read stops at 25K tokens, and
 * so does Claude Code's MCP tool reply by default. The claims view stops at a stage's boundary below it.
 */
export const VIEW_MAX_CHARS = 50_000;

/** The widest line `viewJson` keeps a nested array or object on. */
const VIEW_LINE_WIDTH = 120;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A plan section as JSON, two-space indented, with each array or object that fits in VIEW_LINE_WIDTH
 * characters, and each array of numbers or strings (a tree's node list), on one line: valid JSON with the
 * file's structure, at about half the size of `JSON.stringify(value, null, 2)`.
 */
export function viewJson(value: unknown, indent = ''): string {
  const flat = JSON.stringify(value);
  if (!(typeof value === 'object' && value !== null)) return flat;
  const primitives = Array.isArray(value) && value.every((x) => typeof x !== 'object' || x === null);
  if (primitives || indent.length + flat.length <= VIEW_LINE_WIDTH) return flat;
  const inner = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map((x) => inner + viewJson(x, inner)).join(',\n')}\n${indent}]`;
  const entries = Object.entries(value).map(([k, x]) => `${inner}${JSON.stringify(k)}: ${viewJson(x, inner)}`);
  return `{\n${entries.join(',\n')}\n${indent}}`;
}

/** A plan read raw for a view: the views read a plan mid-edit too, so the schema isn't checked (validate does). */
interface RawPlan {
  realPath: string;
  realRoot: string;
  raw: Record<string, unknown>;
  stages: Record<string, unknown>[];
}

async function readRawPlan(guidesDirectory: string, planPath: string): Promise<RawPlan> {
  const realPath = await resolveInGuidesRoot(guidesDirectory, planPath, 'view.plan');
  const realRoot = await realPathInGuides(guidesDirectory);
  let text: string;
  try {
    text = await fs.readFile(realPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    throw new Error(
      code === 'ENOENT'
        ? `view.plan "${planPath}" names no file in the guides root ${guidesDirectory}`
        : `view.plan "${planPath}" can't be read: ${(error as Error).message}`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`view.plan "${planPath}" isn't JSON (${(error as Error).message}); guide_run {validate} reports a plan's errors`);
  }
  const stages = isPlainObject(raw) && Array.isArray(raw.stages) ? raw.stages : null;
  if (stages === null || !stages.every(isPlainObject)) {
    throw new Error(`view.plan "${planPath}" has no stages list of objects; guide_run {validate} reports a plan's errors`);
  }
  return { realPath, realRoot, raw: raw as Record<string, unknown>, stages };
}

const stageIdOf = (s: Record<string, unknown>): string => (typeof s.id === 'string' ? s.id : JSON.stringify(s.id ?? null));

/**
 * The key-figure lines for a stage view: where they come from, and `keyFigureLine`'s line (WU-65), or why there
 * is none. The record is the `compile-record.json` beside the plan; its figures are current while the plan's
 * build-affecting projection (`buildSha1`, D-266) equals the record's.
 */
async function keyFigureLines(guidesDirectory: string, plan: RawPlan, stage: Record<string, unknown>, id: string): Promise<string[]> {
  const relRecord = path.relative(plan.realRoot, path.join(path.dirname(plan.realPath), RECORD_FILE)).split(path.sep).join('/');
  let record: CompileRecord;
  try {
    const recordPath = await resolveInGuidesRoot(guidesDirectory, relRecord, 'the record');
    record = JSON.parse(await fs.readFile(recordPath, 'utf8')) as CompileRecord;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    return [
      code === 'ENOENT'
        ? `Key figures: none yet: there is no ${RECORD_FILE} beside the plan (compile_plan writes it).`
        : `Key figures: none: ${RECORD_FILE} beside the plan can't be read (${(error as Error).message}).`,
    ];
  }
  if (!isPlainObject(record) || record.recordVersion !== RECORD_VERSION || !isPlainObject(record.stages)) {
    return [`Key figures: none: ${RECORD_FILE} beside the plan isn't a version-${RECORD_VERSION} compile record; compile again.`];
  }
  const of = `${RECORD_FILE} (${record.mode} compile of ${record.compiledAt})`;
  const rec = Object.prototype.hasOwnProperty.call(record.stages, id) ? record.stages[id] : undefined;
  if (rec === undefined) {
    const held = Object.keys(record.stages);
    return [
      `Key figures: none: ${of} holds stage${held.length === 1 ? '' : 's'} ${held.join(', ') || 'none'}, not ${id}; ` +
        `a measure-only compile with stages ["${id}"] measures it.`,
    ];
  }
  const skills = stage.skills;
  const main = isPlainObject(skills) && isPlainObject(skills.main) ? (skills.main as Stage['skills']['main']) : null;
  if (main === null) return ["Key figures: none: the stage has no skills.main to pick its DPS by; guide_run {validate} reports a plan's errors."];
  let line: string;
  try {
    line = keyFigureLine(rec, main);
  } catch (error) {
    return [`Key figures: none: ${of} can't be read for stage ${id} (${(error as Error).message}); compile again.`];
  }
  const current =
    record.buildSha1 === buildSha1(plan.raw)
      ? "current: the plan's build is unchanged since"
      : "stale: the plan's build changed since, so compile again before relying on them";
  return [`Key figures from ${of}, ${current}:`, line];
}

/** `{view: {plan, stage}}` (D-356): the stage's plan section, as `viewJson`, and its key figures. */
async function renderStageView(guidesDirectory: string, view: Extract<PlanView, { kind: 'stage' }>): Promise<string> {
  const plan = await readRawPlan(guidesDirectory, view.planPath);
  const index = plan.stages.findIndex((s) => s.id === view.stage);
  if (index < 0) {
    throw new Error(`view.stage: the plan has no stage "${view.stage}"; its stages are ${plan.stages.map(stageIdOf).join(', ')}`);
  }
  const stage = plan.stages[index];
  return [
    `Plan ${view.planPath}, stage ${view.stage}: stages[${index}] of ${plan.stages.length}.`,
    ...(await keyFigureLines(guidesDirectory, plan, stage, view.stage)),
    `stages[${index}]:`,
    viewJson(stage),
  ].join('\n');
}

/** A claim's source, compact: a citation string as written, a tag as its kind and ref, then its other fields. */
function sourceText(source: unknown): string {
  if (typeof source === 'string') return source;
  if (!isPlainObject(source)) return JSON.stringify(source ?? null);
  const { kind, ref, ...rest } = source;
  const extra = Object.entries(rest).map(([k, v]) => `${k} ${typeof v === 'string' ? v : JSON.stringify(v ?? null)}`);
  return [`${typeof kind === 'string' ? kind : JSON.stringify(kind ?? null)} ${typeof ref === 'string' ? ref : JSON.stringify(ref ?? null)}`, ...extra].join(', ');
}

const fieldText = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v ?? null));

/** One claim, compact: `- <id> (<kind>): <text> [<source>]`. */
function claimLine(claim: unknown): string {
  if (!isPlainObject(claim)) return `- ${JSON.stringify(claim ?? null)}`;
  const kind = claim.kind !== undefined ? ` (${fieldText(claim.kind)})` : '';
  return `- ${fieldText(claim.id)}${kind}: ${fieldText(claim.text)} [${sourceText(claim.source)}]`;
}

/**
 * `{view: {plan, claims: true}}` (D-356): every stage's claims, one line each, grouped by stage. Past
 * VIEW_MAX_CHARS it stops at a stage's boundary, and its last line names the stages left out.
 */
async function renderClaimsView(guidesDirectory: string, view: Extract<PlanView, { kind: 'claims' }>): Promise<string> {
  const plan = await readRawPlan(guidesDirectory, view.planPath);
  const blocks = plan.stages.flatMap((s, i) => {
    const claims = Array.isArray(s.claims) ? s.claims : [];
    if (claims.length === 0) return [];
    const head = `Stage ${stageIdOf(s)}, stages[${i}]: ${claims.length} claim${claims.length === 1 ? '' : 's'}`;
    return [{ id: stageIdOf(s), count: claims.length, text: [head, ...claims.map(claimLine)].join('\n') }];
  });
  const total = blocks.reduce((n, b) => n + b.count, 0);
  if (total === 0) return `Plan ${view.planPath}: no claims in its ${plan.stages.length} stages.`;
  const lines = [
    `Plan ${view.planPath}: ${total} claim${total === 1 ? '' : 's'} in ${blocks.length} of its ${plan.stages.length} stages, ` +
      'one line each: - <id> (<kind>): <text> [<source>]',
  ];
  // Room for the line naming what is left out.
  const room = VIEW_MAX_CHARS - 400;
  let size = lines[0].length;
  let shown = 0;
  for (const block of blocks) {
    if (size + 1 + block.text.length > room) break;
    lines.push(block.text);
    size += 1 + block.text.length;
    shown += 1;
  }
  const rest = blocks.slice(shown);
  if (rest.length > 0) {
    const left = rest.reduce((n, b) => n + b.count, 0);
    lines.push(
      `${left} more claim${left === 1 ? '' : 's'}, in stage${rest.length === 1 ? '' : 's'} ${rest.map((b) => b.id).join(', ')}, ` +
        'are left out to keep this reply under 25K tokens; view each with {view: {plan, stage}}.',
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------------
// Resuming a run (WU-93, D-415)

/** The run log a build-guide run keeps in its run folder (`run-log.mjs init` writes it); `resume` needs it there. */
export const RUN_LOG_FILE = 'run-log.json';

/** A path's stat, or null when nothing is there. */
async function statOrNull(p: string): Promise<Stats | null> {
  try {
    return await fs.stat(p);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw error;
  }
}

/** `target` is inside `base`, or equal to it (as `guidesPath.ts` decides it). */
function isInside(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/**
 * D-415: the run folder `resume` names, absolute or relative to the guides root, resolved and confined as `new_run`'s
 * and the plans' paths are (`resolveInGuidesRoot`: no NUL byte, no `..` segment, symlinks resolved, the real path
 * inside the root's real path). It is a run folder, `<slug>/<YYYY-MM-DD>-<n>`: two folders under the guides root, the
 * write ledger's key (D-211), so a resumed run's final compile still finds its run; and it holds a `run-log.json` file.
 * Returns its absolute path under the guides root as configured (as `new_run` gives it) and its root-relative path.
 */
export async function resolveRunFolder(guidesDirectory: string, given: string): Promise<{ absPath: string; relPath: string }> {
  const refused = (why: string) => new Error(`resume ${JSON.stringify(given)} ${why}; guides root: ${guidesDirectory}. Nothing was done.`);
  if (given.includes('\0')) throw refused('contains a NUL byte');
  if (given.split(/[\\/]/).includes('..')) throw refused('has a ".." segment: it must stay inside the guides root');
  let rel = given;
  if (path.posix.isAbsolute(given)) {
    const realRoot = await realPathInGuides(guidesDirectory);
    const real = await realPathInGuides(given);
    if (!isInside(realRoot, real)) throw refused(`resolves to ${real}, outside the guides root's real path ${realRoot}`);
    rel = path.relative(realRoot, real).split(path.sep).join('/');
    if (rel === '') throw refused('is the guides root itself, not a run folder: give <slug>/<YYYY-MM-DD>-<n>');
  } else if (path.win32.isAbsolute(given)) {
    throw refused("is a Windows path: give the run folder's path on this machine, absolute or relative to the guides root");
  }
  const real = await resolveInGuidesRoot(guidesDirectory, rel, 'resume');
  const realRoot = await realPathInGuides(guidesDirectory);
  const segments = path.relative(realRoot, real).split(path.sep).filter((s) => s !== '' && s !== '.');
  if (segments.length !== 2) {
    throw refused(
      segments.length === 0
        ? 'is the guides root itself, not a run folder: give <slug>/<YYYY-MM-DD>-<n>'
        : `is ${segments.join('/')} in the guides root, not a run folder: a run folder is <slug>/<YYYY-MM-DD>-<n>, two folders under the guides root`,
    );
  }
  const relPath = segments.join('/');
  const stat = await statOrNull(real);
  if (stat === null) throw refused(`names no folder in the guides root (${relPath})`);
  if (!stat.isDirectory()) throw refused(`names ${relPath} in the guides root, which isn't a folder`);
  const logStat = await statOrNull(await resolveInGuidesRoot(guidesDirectory, `${relPath}/${RUN_LOG_FILE}`, 'resume'));
  if (logStat === null || !logStat.isFile()) {
    throw refused(`names ${relPath}, which holds no ${RUN_LOG_FILE}: only a run the build-guide skill started can be resumed; a new run starts with new_run`);
  }
  return { absPath: path.join(path.resolve(guidesDirectory), ...segments), relPath };
}

/** D-210: the line `new_run` and `resume` add when the engine's loaded build has unsaved changes. */
function unsavedLine(context: PlanContext): string {
  const name = context.loadedBuild()?.displayName ?? 'the loaded build';
  return (
    `The engine's loaded build "${name}" has unsaved changes. The next compile_plan replaces it, so save it ` +
    `first (lua_save_build) or confirm the changes may be discarded.`
  );
}

/**
 * `guide_run` (C-50). `new_run`, `resume` and `view` run outside the engine session (D-216, D-356, D-415); `validate`
 * inside a `read` run.
 */
export async function handleGuideRun(context: PlanContext, args: Record<string, unknown> | undefined) {
  const request = await wrapHandler('run guide_run', async () => guideRunRequestOf(args));
  if (request.mode === 'resume') {
    const given = request.runFolder;
    return wrapHandler('resume the run folder', async () => {
      await checkGuidesRoot(context.guidesDirectory, context.pobDirectory);
      const run = await resolveRunFolder(context.guidesDirectory, given);
      // D-210, D-415: read without the lock, as new_run does; the skill asks the user once per resume.
      const unsaved = context.isDirty();
      const lines = [`Resuming run folder ${run.absPath}`, `runFolderRel: ${run.relPath}`, `loadedBuildUnsaved: ${unsaved}`];
      if (unsaved) lines.push(unsavedLine(context));
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    });
  }
  if (request.mode === 'view') {
    const view = request.view;
    return wrapHandler(view.kind === 'stage' ? 'view the plan stage' : "view the plan's claims", async () => {
      const text =
        view.kind === 'stage' ? await renderStageView(context.guidesDirectory, view) : await renderClaimsView(context.guidesDirectory, view);
      return { content: [{ type: 'text' as const, text }] };
    });
  }
  if (request.mode === 'new_run') {
    return wrapHandler('create the run folder', async () => {
      await checkGuidesRoot(context.guidesDirectory, context.pobDirectory);
      const run = await createRunFolder(context.guidesDirectory, request.slug, (context.wallClock ?? (() => new Date()))());
      // D-210: read without the lock, as C-50 says; the skill asks the user before the first compile.
      const unsaved = context.isDirty();
      const lines = [
        `Created run folder ${run.absPath}`,
        `plan_path for this run: ${run.relPath}/plan.json`,
        `loadedBuildUnsaved: ${unsaved}`,
      ];
      if (unsaved) lines.push(unsavedLine(context));
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    });
  }
  return wrapHandler('validate the plan', async () => {
    const checked = await validatePlanFile(
      {
        ctx: context.engine(),
        guidesDirectory: context.guidesDirectory,
        referenceData: context.referenceData ?? (() => loadReferenceData()),
      },
      request.planPath,
      request.stages,
    );
    const n = checked.stages.length;
    const lines = [`Plan ${request.planPath} is valid: ${n} stage${n === 1 ? '' : 's'} (${checked.stages.join(', ')}).`];
    for (const p of checked.unknownProducers) {
      lines.push(`Unknown producer: ${p.kind} "${p.name}" isn't in the game data; a compile reports it as producer-unknown (V2).`);
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });
}
