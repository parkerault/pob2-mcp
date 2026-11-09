/**
 * `plan_from_build` (C-62, D-517; amendment 16 §13 and Appendix A.7): the file reader, engine kind `none`.
 *
 * Two calls, both naming `run_folder`, a run folder under the guides root that holds a `run-log.json` (resolved and
 * confined as `guide_run {resume}`'s is):
 * - **the first** gives exactly one of `build_name` (a builds-folder file, read only, resolved as the other build-file
 *   tools resolve names) and `import_code` (decoded under the 16 MiB cap, D-50), and no answer. It keeps the decoded
 *   document in the run folder as `source.xml`, its sha1 in `read.json`, and writes `plan.json` (schema 11) and
 *   `read.json` (`readBuildIntoPlan`, `src/services/fileReader.ts`);
 * - **the second** gives answers only (`loadout`, `tree`, `main_group`, `buffs_on`, `buffs_swap`, `switch_off`,
 *   `stand_in`): it reads `source.xml` back, re-reads a builds-folder source and refuses a changed sha1, and writes
 *   `plan.json` and `read.json` again with every answer so far.
 *
 * `switch_off` departs from Appendix A.7, whose input has no field for it (the coordinator's ruling for M-30, WU-160's fix
 * round): §14 has the reader write a switched buff's `off` "as the user confirms it", from the measure's proposed list.
 *
 * A first call is refused on a run folder that already holds a read (`source.xml` or `read.json`): its file, plan and
 * answers stay, and a piece run's `source` sha1 stays true. Either call refuses to replace a `plan.json` a design step
 * wrote (the run log holds a D1 entry). It fetches nothing,
 * holds no engine lock and writes only the run folder; the builds folder is read, never written. Every refusal is an
 * `isError` that writes nothing.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import { readPin } from '../engine/pinCheck.js';
import { loadReferenceData, type ReferenceData } from '../plan/referenceData.js';
import { validatePlan } from '../plan/schema.js';
import type { BuildService } from '../services/buildService.js';
import { loadReaderGameData, readBuildIntoPlan, readReplyText, ReadRefused, type ReadAnswers, type SourceKind } from '../services/fileReader.js';
import type { PassiveTreeData } from '../types.js';
import { decodePobCode } from '../utils/buildCode.js';
import { wrapHandler } from '../utils/errorHandling.js';
import { checkGuidesRoot, resolveInGuidesRoot } from '../utils/guidesPath.js';
import { RUN_LOG_FILE, resolveRunFolder } from './planHandlers.js';

/** What the reader needs of the server. */
export interface PlanFromBuildContext {
  pobDirectory: string;
  guidesDirectory: string;
  /** The builds folder's name resolution and read (C-17's canonical paths, D-52); read only. */
  buildService: Pick<BuildService, 'readBuildFile'>;
  /** The tree service's passive tree of a version (the reader asks only for versions the pin holds). */
  treeData: (version: string) => Promise<PassiveTreeData>;
  /** PoB's source folder (`resolvePobSrc`), whose data files the reader reads as text. */
  pobSrc: () => string;
  /** The C1/E1 data (the patches the plan's `versions` record); default `loadReferenceData()`. */
  referenceData?: () => ReferenceData;
}

/** The files the reader writes in the run folder (Appendix A.6). */
export const SOURCE_FILE = 'source.xml';
export const READ_FILE = 'read.json';
export const PLAN_FILE = 'plan.json';

// `switch_off` departs from Appendix A.7 (the coordinator's ruling for M-30): see the header.
const ARGS = ['run_folder', 'build_name', 'import_code', 'loadout', 'tree', 'main_group', 'buffs_on', 'buffs_swap', 'switch_off', 'stand_in'] as const;
const ANSWERS = ['loadout', 'tree', 'main_group', 'buffs_on', 'buffs_swap', 'switch_off', 'stand_in'] as const;
/** The answers that name the plan's groups or slots: a changed loadout renumbers them, so they go. */
const GROUP_ANSWERS = ['main_group', 'buffs_on', 'buffs_swap', 'switch_off', 'stand_in'] as const;

interface Request {
  runFolder: string;
  source?: { kind: 'builds-folder'; name: string } | { kind: 'import-code'; code: string };
  answers: ReadAnswers;
}

const refuse = (why: string): never => {
  throw new ReadRefused(`${why}. Nothing was written.`);
};

function groupList(v: unknown, field: string): number[] {
  if (!Array.isArray(v) || v.some((n) => !Number.isInteger(n) || n < 1)) refuse(`${field} must be a list of the plan's group numbers (whole numbers from 1)`);
  const list = v as number[];
  if (new Set(list).size !== list.length) refuse(`${field} names a group twice`);
  return list;
}

/** The call's request: which call it is, and its answers, each checked for its type (Appendix A.7). */
export function planFromBuildRequestOf(args: Record<string, unknown> | undefined): Request {
  const a = args ?? {};
  const unknown = Object.keys(a).filter((k) => !(ARGS as readonly string[]).includes(k));
  if (unknown.length > 0) refuse(`plan_from_build takes only ${ARGS.join(', ')}; it has no argument ${unknown.map((k) => `"${k}"`).join(', ')}`);
  if (typeof a.run_folder !== 'string' || a.run_folder.trim() === '') refuse('run_folder must be the run folder, as guide_run {new_run} made it');
  const answers: ReadAnswers = {};
  if (a.loadout !== undefined) {
    if (typeof a.loadout !== 'string' || a.loadout === '') refuse('loadout must be a loadout title of the file');
    answers.loadout = a.loadout as string;
  }
  if (a.tree !== undefined) {
    if (a.tree !== 'newest' && a.tree !== 'stop') refuse('tree must be "newest" (read it onto the pin\'s newest tree) or "stop"');
    answers.tree = a.tree as 'newest' | 'stop';
  }
  if (a.main_group !== undefined) {
    if (!Number.isInteger(a.main_group) || (a.main_group as number) < 1) refuse("main_group must be the plan's group number (a whole number from 1)");
    answers.main_group = a.main_group as number;
  }
  if (a.buffs_on !== undefined) answers.buffs_on = groupList(a.buffs_on, 'buffs_on');
  if (a.buffs_swap !== undefined) answers.buffs_swap = groupList(a.buffs_swap, 'buffs_swap');
  if (a.switch_off !== undefined) {
    const v = a.switch_off;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) refuse("switch_off must map a switched group's plan number to the plan's groups switched off for it");
    const out: Record<string, number[]> = {};
    for (const [k, list] of Object.entries(v as Record<string, unknown>)) {
      if (!/^[1-9]\d*$/.test(k)) refuse(`switch_off's key "${k}" isn't a plan group number`);
      out[k] = groupList(list, `switch_off's group ${k}`);
    }
    answers.switch_off = out;
  }
  if (a.stand_in !== undefined) {
    const v = a.stand_in;
    if (typeof v !== 'object' || v === null || Array.isArray(v) || Object.values(v).some((x) => typeof x !== 'string' || x.trim() === '')) {
      refuse('stand_in must map a slot to an item text, or to "plain base"');
    }
    answers.stand_in = { ...(v as Record<string, string>) };
  }
  const hasName = a.build_name !== undefined;
  const hasCode = a.import_code !== undefined;
  const answered = ANSWERS.filter((k) => a[k] !== undefined);
  if (hasName || hasCode) {
    if (hasName && hasCode) refuse('build_name and import_code conflict: the first call reads one file, a builds-folder name or an import code');
    if (answered.length > 0) {
      refuse(`${answered.join(', ')}: the first call takes no answer; give the answers on the second call, with run_folder only`);
    }
    if (hasName) {
      if (typeof a.build_name !== 'string' || a.build_name.trim() === '') refuse('build_name must be a build file of the builds folder');
      return { runFolder: a.run_folder as string, source: { kind: 'builds-folder', name: a.build_name as string }, answers };
    }
    if (typeof a.import_code !== 'string' || a.import_code.trim() === '') refuse('import_code must be a PoB import code');
    return { runFolder: a.run_folder as string, source: { kind: 'import-code', code: a.import_code as string }, answers };
  }
  return { runFolder: a.run_folder as string, answers };
}

const sha1 = (bytes: Buffer): string => crypto.createHash('sha1').update(bytes).digest('hex');

async function readOrNull(p: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(p);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw error;
  }
}

/** Whether a design step wrote the run's plan: the run log holds a D1 entry (`D1-build`, `D1-tree`, `D1-finish`, `D1-gate`). */
function designWrote(log: unknown): string | null {
  const stages = typeof log === 'object' && log !== null && Array.isArray((log as { stages?: unknown }).stages) ? ((log as { stages: unknown[] }).stages) : [];
  for (const e of stages) {
    const stage = typeof e === 'object' && e !== null ? (e as { stage?: unknown }).stage : undefined;
    if (typeof stage === 'string' && /^D1/.test(stage)) return stage;
  }
  return null;
}

/** The game patches the plan's `versions` record: the engine data's and the boss data's, from the committed data (C-35). */
function patchesOf(ref: ReferenceData): { enginePatch: string; externalPatch: string } {
  const patch = (file: string, kind: string) => ref.files.get(file)?.sources.find((s) => s.kind === kind && typeof s.patch === 'string')?.patch;
  return { enginePatch: patch('enemies/map-monsters.json', 'pob-data') ?? 'unknown', externalPatch: patch('enemies/arbiter-of-divinity.json', 'external') ?? 'unknown' };
}

/** `plan_from_build` (C-62): either call, as `planFromBuildRequestOf` tells them apart. */
export async function handlePlanFromBuild(context: PlanFromBuildContext, args: Record<string, unknown> | undefined) {
  return wrapHandler('read the build into a plan', async () => {
    const request = planFromBuildRequestOf(args);
    await checkGuidesRoot(context.guidesDirectory, context.pobDirectory);
    const run = await resolveRunFolder(context.guidesDirectory, request.runFolder, 'run_folder');
    const inRun = (name: string) => resolveInGuidesRoot(context.guidesDirectory, `${run.relPath}/${name}`, 'run_folder');

    let log: unknown;
    try {
      log = JSON.parse((await fs.readFile(await inRun(RUN_LOG_FILE))).toString('utf8'));
    } catch (error) {
      refuse(`${run.relPath}/${RUN_LOG_FILE} can't be read as JSON (${(error as Error).message})`);
    }
    const design = designWrote(log);
    if (design !== null) refuse(`the run's plan.json is a design's: the run log holds a ${design} entry, and the reader never replaces a plan a design step wrote`);

    let bytes: Buffer;
    let source: { kind: SourceKind; name?: string; sha1: string };
    let answers: ReadAnswers;
    let first = false;
    if (request.source !== undefined) {
      first = true;
      const held = [SOURCE_FILE, READ_FILE];
      for (const name of held) {
        if ((await readOrNull(await inRun(name))) !== null) {
          refuse(`this run folder already holds a read (${run.relPath}/${name}); the second call gives answers only, and a new file is read into a new run folder`);
        }
      }
      if (request.source.kind === 'builds-folder') {
        let file: Awaited<ReturnType<BuildService['readBuildFile']>>;
        try {
          file = await context.buildService.readBuildFile(request.source.name);
        } catch (error) {
          refuse(`build_name ${JSON.stringify(request.source.name)} isn't a file of the builds folder (${(error as Error).message})`);
        }
        bytes = file!.bytes;
        source = { kind: 'builds-folder', name: file!.rel, sha1: sha1(bytes) };
      } else {
        let xml: string;
        try {
          xml = decodePobCode(request.source.code);
        } catch (error) {
          refuse(`import_code doesn't decode: ${(error as Error).message}`);
        }
        bytes = Buffer.from(xml!, 'utf8');
        source = { kind: 'import-code', sha1: sha1(bytes) };
      }
      answers = {};
    } else {
      const readText = await readOrNull(await inRun(READ_FILE));
      const kept = await readOrNull(await inRun(SOURCE_FILE));
      if (readText === null || kept === null) {
        refuse(`${run.relPath} holds no ${READ_FILE} and ${SOURCE_FILE} of an earlier read: the first call gives build_name or import_code`);
      }
      let earlier: { source?: { kind?: SourceKind; name?: string; sha1?: string }; answers?: ReadAnswers };
      try {
        earlier = JSON.parse(readText!.toString('utf8'));
      } catch (error) {
        refuse(`${run.relPath}/${READ_FILE} isn't JSON (${(error as Error).message})`);
      }
      const was = earlier!.source ?? {};
      if (was.kind !== 'builds-folder' && was.kind !== 'import-code') refuse(`${run.relPath}/${READ_FILE} names no source kind`);
      bytes = kept!;
      if (sha1(bytes) !== was.sha1) refuse(`${run.relPath}/${SOURCE_FILE} changed since the first read (its sha1 isn't ${READ_FILE}'s); read the file again with a first call`);
      if (was.kind === 'builds-folder') {
        let now: Buffer | null = null;
        try {
          now = (await context.buildService.readBuildFile(String(was.name))).bytes;
        } catch {
          now = null;
        }
        if (now === null || sha1(now) !== was.sha1) {
          refuse(`the builds-folder file ${String(was.name)} changed on disk (or went) since the first read; read it again with a first call`);
        }
      }
      source = { kind: was.kind as SourceKind, ...(was.name !== undefined ? { name: was.name } : {}), sha1: String(was.sha1) };
      answers = { ...(earlier!.answers ?? {}) };
      if (request.answers.loadout !== undefined && request.answers.loadout !== answers.loadout) {
        for (const k of GROUP_ANSWERS) delete answers[k];
      }
      // A changed buff list asks the measure's Spirit question again: an earlier switch_off goes unless this call gives one.
      if ((request.answers.buffs_on !== undefined || request.answers.buffs_swap !== undefined) && request.answers.switch_off === undefined) {
        delete answers.switch_off;
      }
      Object.assign(answers, request.answers);
      if (request.answers.stand_in !== undefined) answers.stand_in = { ...(earlier!.answers?.stand_in ?? {}), ...request.answers.stand_in };
    }

    const refData = (context.referenceData ?? (() => loadReferenceData()))();
    const pin = readPin();
    let result: Awaited<ReturnType<typeof readBuildIntoPlan>>;
    try {
      result = await readBuildIntoPlan({
        xml: bytes.toString('utf8'),
        source,
        answers,
        data: loadReaderGameData(context.pobSrc()),
        tree: (version) => context.treeData(version),
        versions: { pobTag: pin.tag, pobCommit: pin.commit, ...patchesOf(refData) },
      });
    } catch (error) {
      if (error instanceof ReadRefused) refuse(error.message);
      throw error;
    }
    if (result!.plan !== null) {
      const checked = validatePlan(result!.plan, refData);
      if (!checked.ok) {
        throw new Error(`the read plan doesn't pass schema 11 (a reader fault): ${checked.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`);
      }
    }

    // Every check passed: write the run folder's files only.
    if (first) await fs.writeFile(await inRun(SOURCE_FILE), bytes);
    const planPath = await inRun(PLAN_FILE);
    if (result!.plan !== null) await fs.writeFile(planPath, `${JSON.stringify(result!.plan, null, 2)}\n`);
    else await fs.rm(planPath, { force: true });
    await fs.writeFile(await inRun(READ_FILE), `${JSON.stringify(result!.read, null, 2)}\n`);
    let text = readReplyText(result!, run.relPath);
    if (answers.tree === 'stop' && result!.plan === null) text += '\nThe tree question was answered "stop": nothing is read onto the pin\'s tree, and the run folder holds no plan.json.';
    return { content: [{ type: 'text' as const, text }] };
  });
}
