/**
 * The plan tools (slice 2): `compile_plan` (C-41) and `guide_run` (C-50).
 *
 * - `compile_plan {plan_path, build_name | measure_only, stages?}` compiles a plan.json in the guides root
 *   into one PoB2 build with a loadout per stage (`src/plan/compiler.ts`). Measure-only mode writes the
 *   compile record and the compiled XML beside the plan; final mode writes the builds-folder file through
 *   C-17, its write-ledger entry (D-211) and the record. Kind `load`: the call replaces the engine's
 *   build (D-191, D-210).
 * - `guide_run {new_run}` creates the next run folder `<slug>/<YYYY-MM-DD>-<n>` (D-207) and says whether the
 *   engine's build has unsaved changes the next compile would discard (D-210); it never touches the
 *   engine (the router runs it as kind `none`, D-216). `guide_run {validate, stages?}` checks a plan
 *   against its schema, the reference data and the game data (`compile_check`) without changing the build.
 *
 * Only these argument combinations are accepted; any other is refused, naming the conflict, before
 * anything is done.
 */
import { performance } from 'perf_hooks';
import type { EngineCallContext, LoadedBuild } from '../engine/session.js';
import type { BuildFileWriter } from '../services/buildFileWriter.js';
import { readPin } from '../engine/pinCheck.js';
import { checkGuidesRoot, createRunFolder } from '../utils/guidesPath.js';
import { wrapHandler } from '../utils/errorHandling.js';
import { compilePlan, keyFigureLine, validatePlanFile, type CompileRequest, type CompileResult } from '../plan/compiler.js';
import type { Verdict } from '../plan/record.js';
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
  /** C-17: the only writer into the builds folder. */
  buildFileWriter: Pick<BuildFileWriter, 'checkBuildFile' | 'writeBuildFile'>;
  /** The build the engine holds (C-3 `loaded`). */
  loadedBuild: () => LoadedBuild | null;
  /** Whether the engine's build has unsaved changes (`session.isDirty()`, read without the lock). */
  isDirty: () => boolean;
  /** The C1/E1 data; default: `loadReferenceData()` from the package's `data/`. */
  referenceData?: () => ReferenceData;
  /** The wall clock (dates the run folder and the record); default `new Date()`. */
  wallClock?: () => Date;
}

const COMPILE_ARGS = ['plan_path', 'build_name', 'measure_only', 'stages'] as const;
const GUIDE_RUN_ARGS = ['new_run', 'validate', 'stages'] as const;

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

/** `compile_plan`'s two modes (C-41): measure-only, or final. Any other combination is refused. */
export function compileRequestOf(args: Record<string, unknown> | undefined): CompileRequest {
  const a = args ?? {};
  refuseUnknown('compile_plan', a, COMPILE_ARGS);
  const planPath = nonEmptyString(a.plan_path, 'plan_path');
  if (a.measure_only !== undefined && typeof a.measure_only !== 'boolean') throw new Error('measure_only must be true or false');
  const buildName = a.build_name === undefined ? undefined : nonEmptyString(a.build_name, 'build_name');
  const stages = a.stages === undefined ? undefined : stringList(a.stages, 'stages');
  if (a.measure_only === true) {
    if (buildName !== undefined) {
      throw new Error(
        'build_name and measure_only: true conflict: a measure-only compile writes only the record and the compiled XML ' +
          'beside the plan, never a builds-folder file (D-208). Nothing was done.',
      );
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
  return { mode: 'final', planPath, buildName };
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

/** `compile_plan` (C-41). Runs inside the session's `load` run that the router opened. */
export async function handleCompilePlan(context: PlanContext, args: Record<string, unknown> | undefined) {
  return wrapHandler('compile the plan', async () => {
    const request = compileRequestOf(args);
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

/** `guide_run`'s two modes (C-50): exactly one of `new_run` and `validate`; `stages` only with `validate`. */
export function guideRunRequestOf(
  args: Record<string, unknown> | undefined,
): { mode: 'new_run'; slug: string } | { mode: 'validate'; planPath: string; stages?: string[] } {
  const a = args ?? {};
  refuseUnknown('guide_run', a, GUIDE_RUN_ARGS);
  const hasNew = a.new_run !== undefined;
  const hasValidate = a.validate !== undefined;
  if (hasNew && hasValidate) throw new Error('new_run and validate conflict: give exactly one of them. Nothing was done.');
  if (!hasNew && !hasValidate) {
    throw new Error('give new_run (a slug, to create a run folder) or validate (a plan_path, to check a plan). Nothing was done.');
  }
  if (hasNew) {
    if (a.stages !== undefined) throw new Error('stages goes only with validate, not with new_run. Nothing was done.');
    if (typeof a.new_run !== 'string') throw new Error('new_run must be a slug string');
    return { mode: 'new_run', slug: a.new_run };
  }
  const planPath = nonEmptyString(a.validate, 'validate');
  return { mode: 'validate', planPath, ...(a.stages !== undefined ? { stages: stringList(a.stages, 'stages') } : {}) };
}

/** `guide_run` (C-50). `new_run` runs outside the engine session; `validate` inside a `read` run. */
export async function handleGuideRun(context: PlanContext, args: Record<string, unknown> | undefined) {
  const request = await wrapHandler('run guide_run', async () => guideRunRequestOf(args));
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
      if (unsaved) {
        const name = context.loadedBuild()?.displayName ?? 'the loaded build';
        lines.push(
          `The engine's loaded build "${name}" has unsaved changes. The next compile_plan replaces it, so save it ` +
            `first (lua_save_build) or confirm the changes may be discarded.`,
        );
      }
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
