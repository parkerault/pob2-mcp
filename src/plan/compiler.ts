/**
 * P2, the plan compiler (C-41, slice 2 §3.6): one plan.json → one PoB2 build with one loadout per stage,
 * its compile record (C-33) and, in a final compile, the builds-folder file and its write-ledger entry
 * (D-211).
 *
 * `compilePlan` runs inside one `session.run` of kind `load` (the router's, D-156, D-191) and follows
 * §3.6's steps:
 *  1. the guides root and the builds folder must not overlap (D-220);
 *  2. the plan is resolved inside the guides root, read and validated with the C1/E1 reference data
 *     (D-163); a `stages` subset (measure-only) must name plan stages;
 *  3. a final compile checks its target against the write ledger and C-17 (D-199, D-211);
 *  4. the stages' item, skill and config sets are grouped by deep equality (A-P2);
 *  5. `compile_check` reports every defect of every compiled stage and changes nothing (A-P12);
 *  6. `new_build` replaces the engine's build (D-210);
 *  7. one `compile_stage` per stage builds and measures it; PoB's allocation is compared with the plan's
 *     (`compareAllocation`, D-213), and so are the items its item set holds (`compareItems`): PoB
 *     unequips an off-hand that doesn't fit without a word, so any difference is an error;
 *  8. `compile_finish` checks the loadouts, selects the highest stage's and saves its level in auto mode;
 *     every item set is compared with the plan again;
 *  9. the build is exported, every listed config option PoB's save left out is put back into its set and
 *     checked (D-248), and the XML is encoded as an import code (C-42);
 * 10. final: the builds-folder file through C-17, then its write-ledger entry; measure-only: the XML
 *     beside the plan;
 * 11. the ledger formulas are evaluated and the record is written beside the plan.
 * Any failure up to step 9 writes nothing. Steps 1–5 leave the engine's build as it was.
 *
 * When the stages differ in a weapon-fit flag (Giant's Blood, Instruments of Power, Lord of the Wilds), the
 * record and the text carry a loadout warning: PoB2 checks a loadout's off-hand against the passives of the
 * loadout it switches from, so switching loadouts in PoB2 can unequip a planned off-hand.
 *
 * V1 and V2 (WU-42) are not run here yet: the record's verdicts are null and `configEffective` is empty.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { EngineCallContext } from '../engine/session.js';
import type {
  CompileCheckStage,
  CompileFinishResult,
  CompileStageParams,
  CompileStageResult,
  SlotItem,
  StageSetRef,
  WeaponFlags,
} from '../engine/schemas.js';
import { ITEM_SLOTS } from '../server/toolSchemas.js';
import { BuildFileWriteError, type BuildFileWriter, type WriteGuard } from '../services/buildFileWriter.js';
import { encodePobCode } from '../utils/buildCode.js';
import { checkGuidesRoot, realPathInGuides, resolveInGuidesRoot, runFolderOf } from '../utils/guidesPath.js';
import { canonicalBuildPath } from '../utils/pathSanitizer.js';
import { evaluateLedger, ledgerErrorText, type StageOutputs } from './ledger.js';
import {
  MEASURE_ONLY_XML_FILE,
  RECORD_FILE,
  RECORD_VERSION,
  recordText,
  unresolvedRefs,
  versionNotes,
  type CompileMode,
  type CompileRecord,
  type ConfigValue,
  type StageRecord,
} from './record.js';
import { validatePlan, type Plan, type PlanError, type PlanReferenceData, type Stage } from './schema.js';
import { restoreConfigInputs, savedConfigProblems, type ConfigSetInputs } from './savedConfig.js';
import { ledgerEntryFor, readWriteLedger, withLedgerEntry, writeWriteLedger } from './writeLedger.js';

/** A compile that stops with an error the caller shows as is; nothing was written. */
export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompileError';
  }
}

/** What the compiler needs of the server (all injected; it reads no env). */
export interface CompilerEnv {
  /** The running `session.run`'s context: the engine client, `newBuild`, `noteSaved`. */
  ctx: EngineCallContext;
  pobDirectory: string;
  stateDir: string;
  guidesDirectory: string;
  writer: Pick<BuildFileWriter, 'checkBuildFile' | 'writeBuildFile'>;
  /** The C1/E1 reference data (`loadReferenceData`). */
  referenceData: () => PlanReferenceData;
  /** C-45's offense fields, measured per active skill and stat set. */
  offenseFields: readonly string[];
  /** The pinned engine (C-6). */
  engine: { pobTag: string; pobCommit: string };
  /** Elapsed time in ms (monotonic). */
  clock: () => number;
  /** The wall clock, for `compiledAt` and `writtenAt`. */
  wallClock: () => Date;
}

export type CompileRequest =
  | { mode: 'measure-only'; planPath: string; stages?: string[] }
  | { mode: 'final'; planPath: string; buildName: string };

export interface CompileResult {
  planPath: string;
  record: CompileRecord;
  /** Paths written: relative to the builds folder (`builds`) and to the guides root (`guides`). */
  written: { builds: string[]; guides: string[] };
  /** The final compile replaced an existing builds-folder file (a backup was kept). */
  replacedFile: boolean;
}

/** The set kinds a stage's content is grouped by (A-P2). */
export type ContentKind = 'item' | 'skill' | 'config';
const CONTENT_KINDS: readonly ContentKind[] = ['item', 'skill', 'config'];
const CONTENT_OF: Record<ContentKind, (s: Stage) => Stage['items'] | Stage['skills'] | Stage['config']> = {
  item: (s) => s.items,
  skill: (s) => s.skills,
  config: (s) => s.config,
};

const sha1 = (data: string | Buffer) => crypto.createHash('sha1').update(data).digest('hex');

// ---------------------------------------------------------------------------------------------------
// Pure helpers (unit-tested)

/** JSON with object keys sorted, so deep-equal values have equal text. */
function stableText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableText).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableText((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** A loadout name without its ` {<id>}` tag (A-P1: it ends with exactly that). */
export function loadoutBase(stage: Pick<Stage, 'id' | 'loadoutName'>): string {
  const suffix = ` {${stage.id}}`;
  return stage.loadoutName.endsWith(suffix) ? stage.loadoutName.slice(0, -suffix.length) : stage.loadoutName;
}

/** One shared set: the stages whose content of a kind is deep-equal, and its title (A-P2). */
export interface SetGroup {
  kind: ContentKind;
  title: string;
  stageIds: string[];
}

/**
 * A-P2, §3.6 step 4: per kind, the stages whose `items` (`skills`, `config`) are deep-equal share one set,
 * titled `<base> {<ids>}`, the ids in plan order joined by `,`; the base is the content's `setTitle`, else
 * the first member's loadout name without its ` {<id>}`. `groupOf` maps a stage id to its group's index.
 */
export function groupSets(stages: readonly Stage[]): Record<ContentKind, { groups: SetGroup[]; groupOf: Map<string, number> }> {
  const out = {} as Record<ContentKind, { groups: SetGroup[]; groupOf: Map<string, number> }>;
  for (const kind of CONTENT_KINDS) {
    const byKey = new Map<string, number>();
    const groups: { kind: ContentKind; first: Stage; stageIds: string[] }[] = [];
    const groupOf = new Map<string, number>();
    for (const stage of stages) {
      const key = stableText(CONTENT_OF[kind](stage));
      let index = byKey.get(key);
      if (index === undefined) {
        index = groups.length;
        byKey.set(key, index);
        groups.push({ kind, first: stage, stageIds: [] });
      }
      groups[index].stageIds.push(stage.id);
      groupOf.set(stage.id, index);
    }
    out[kind] = {
      groups: groups.map((g) => {
        const base = CONTENT_OF[kind](g.first).setTitle ?? loadoutBase(g.first);
        return { kind, title: `${base} {${g.stageIds.join(',')}}`, stageIds: g.stageIds };
      }),
      groupOf,
    };
  }
  return out;
}

/** The weapon-set tag the plan gives each of a stage's nodes (0 untagged, 1 or 2). */
function plannedTags(stage: Pick<Stage, 'tree'>): Map<number, number> {
  const tags = new Map<number, number>();
  for (const id of stage.tree.nodes) tags.set(id, 0);
  for (const id of stage.tree.ascendancyNodes) tags.set(id, 0);
  for (const id of stage.tree.weaponSetNodes.set1) tags.set(id, 1);
  for (const id of stage.tree.weaponSetNodes.set2) tags.set(id, 2);
  return tags;
}

/** What `compile_stage` reports of PoB's allocation after the import. */
export type StageAllocation = Pick<CompileStageResult['allocation'], 'nodes' | 'startNodes'>;

/**
 * D-213: compare PoB's allocation after a stage's import with the plan's. Every node PoB dropped, added
 * or tagged with another weapon set is a defect, `stage <id>: …`, naming the node. The class and
 * ascendancy start nodes, which PoB allocates itself and the plan doesn't list, are ignored.
 */
export function compareAllocation(stage: Pick<Stage, 'id' | 'tree'>, allocation: StageAllocation): string[] {
  const starts = new Set(allocation.startNodes);
  const planned = plannedTags(stage);
  for (const s of starts) planned.delete(s);
  const actual = new Map<number, number>();
  for (const n of allocation.nodes) if (!starts.has(n.id)) actual.set(n.id, n.mode);
  const tagText = (m: number) => (m === 0 ? 'untagged' : `weapon set ${m}`);
  const defects: string[] = [];
  for (const [id, mode] of [...planned].sort((a, b) => a[0] - b[0])) {
    const got = actual.get(id);
    if (got === undefined) {
      defects.push(`stage ${stage.id}: node ${id} was dropped by PoB on import (it isn't allocated); the plan allocates it ${tagText(mode)}`);
    } else if (got !== mode) {
      defects.push(`stage ${stage.id}: node ${id} is ${tagText(got)} in PoB, but the plan tags it ${tagText(mode)}`);
    }
  }
  for (const id of [...actual.keys()].sort((a, b) => a - b)) {
    if (!planned.has(id)) defects.push(`stage ${stage.id}: node ${id} was allocated by PoB but isn't in the plan`);
  }
  return defects;
}

/** What an item set holds, or should hold, per slot. */
export type SetItems = Readonly<Record<string, SlotItem>>;

/**
 * The items an item set holds against the plan's (WU-41 review, D-213's rule for items): every slot of
 * `ITEM_SLOTS` must hold exactly the item the plan equips there, or nothing when the plan leaves it empty.
 * PoB unequips an off-hand that doesn't fit without an error, so each difference is a defect,
 * `stage <id>: …`, naming the slot and the item.
 */
export function compareItems(stageId: string, planned: SetItems, actual: SetItems, slots: readonly string[] = ITEM_SLOTS): string[] {
  const defects: string[] = [];
  for (const slot of slots) {
    const want = planned[slot] ?? { id: 0, name: '' };
    const got = actual[slot] ?? { id: 0, name: '' };
    if (want.id === got.id) continue;
    if (got.id === 0) {
      defects.push(
        `stage ${stageId}: ${slot} is empty in PoB, but the plan equips "${want.name}" there: PoB unequipped it ` +
          `(an off-hand that fits only with a passive or item this stage lacks, such as Instruments of Power or Giant's Blood)`,
      );
    } else if (want.id === 0) {
      defects.push(`stage ${stageId}: ${slot} holds "${got.name}" in PoB, but the plan leaves it empty`);
    } else {
      defects.push(`stage ${stageId}: ${slot} holds "${got.name}" in PoB, but the plan equips "${want.name}" there`);
    }
  }
  return defects;
}

const WEAPON_FLAGS: { key: keyof Pick<WeaponFlags, 'giantsBlood' | 'instrumentsOfPower' | 'lordOfTheWilds'>; name: string }[] = [
  { key: 'giantsBlood', name: "Giant's Blood" },
  { key: 'instrumentsOfPower', name: 'Instruments of Power' },
  { key: 'lordOfTheWilds', name: 'Lord of the Wilds' },
];

/**
 * The loadout warnings (WU-41 review): one per weapon-fit flag the compiled stages differ in. PoB2 checks
 * a loadout's off-hand against the passives of the loadout it switches from (ItemsTab's slot check runs on
 * the last calculation), so selecting a stage whose off-hand needs the flag, from a stage without it, can
 * unequip that off-hand in PoB2. The compile itself measures and saves every stage with its items.
 */
export function weaponFlagWarnings(stages: readonly { id: string; flags: WeaponFlags }[]): string[] {
  const out: string[] = [];
  for (const { key, name } of WEAPON_FLAGS) {
    const on = stages.filter((s) => s.flags[key]).map((s) => s.id);
    if (on.length === 0 || on.length === stages.length) continue;
    const off = stages.filter((s) => !s.flags[key]).map((s) => s.id);
    out.push(
      `Stages differ in ${name} (stage${on.length === 1 ? '' : 's'} ${on.join(', ')} ${on.length === 1 ? 'has' : 'have'} it; ` +
        `stage${off.length === 1 ? '' : 's'} ` +
        `${off.join(', ')} ${off.length === 1 ? "doesn't" : "don't"}). PoB2 checks an off-hand against the passives of the ` +
        `loadout it switches from, so after selecting another stage's loadout in PoB2, check Weapon 2 and Weapon 2 Swap ` +
        `and re-equip the planned off-hand if PoB2 removed it.`,
    );
  }
  return out;
}

/**
 * The save warnings (WU-41 review, D-248): the compiled file keeps every listed option, but saving it again
 * in PoB2 leaves out each value equal to the active config set's default or placeholder. One line per
 * config set that needed a value put back that a reload would not give back (`survives` false: the value
 * isn't a new set's default, or a placeholder takes its place), naming its stages and the options.
 */
export function savedConfigWarnings(
  restored: readonly { set: number; option: string }[],
  inputs: ReadonlyMap<number, Readonly<Record<string, ConfigValue>>>,
  survives: ReadonlyMap<number, Readonly<Record<string, boolean>>>,
  stagesOf: (configSet: number) => readonly string[],
): string[] {
  const bySet = new Map<number, string[]>();
  for (const r of restored) {
    if (survives.get(r.set)?.[r.option] === true) continue;
    bySet.set(r.set, [...(bySet.get(r.set) ?? []), r.option]);
  }
  return [...bySet].map(([set, options]) => {
    const stages = stagesOf(set);
    const listed = options.map((o) => `${o} = ${JSON.stringify(inputs.get(set)?.[o])}`).join(', ');
    return (
      `Saving this file in PoB2 drops these options from stage${stages.length === 1 ? '' : 's'} ${stages.join(', ')}: ${listed}. ` +
      `PoB2's save leaves out a value equal to the active configuration's default or placeholder; this file keeps them, ` +
      `so after saving it in PoB2, set them again in ${stages.length === 1 ? "that stage's" : "those stages'"} configuration.`
    );
  });
}

/** Every option a stage lists, earned then scenario: option → value (C-32). */
export function stageConfig(stage: Pick<Stage, 'config'>): Record<string, ConfigValue> {
  const out: Record<string, ConfigValue> = {};
  for (const e of stage.config.earned) out[e.option] = e.value;
  for (const e of stage.config.scenario) out[e.option] = e.value;
  return out;
}

/** What `compile_check` reads of a stage. */
export function checkStageOf(stage: Stage): CompileCheckStage {
  return {
    id: stage.id,
    nodes: stage.tree.nodes,
    ascendancyNodes: stage.tree.ascendancyNodes,
    weaponSets: { set1: stage.tree.weaponSetNodes.set1, set2: stage.tree.weaponSetNodes.set2 },
    attributeChoices: stage.tree.attributeChoices,
    jewels: stage.items.treeJewels,
    items: stage.items.slots,
    groups: stage.skills.groups.map((g) => ({ gems: g.gems.map((gem) => ({ name: gem.name })) })),
    main: stage.skills.main,
    config: Object.entries(stageConfig(stage)).map(([option, value]) => ({ option, value })),
  };
}

/** The stage PoB saves the build at: the highest level, the last among ties (A-P9). */
export function savedStage<T extends { level: number }>(stages: readonly T[]): T {
  return stages.reduce((top, s) => (s.level >= top.level ? s : top));
}

/** `path: message` lines, each `stages[n]` path followed by the stage's id when the plan has one. */
export function renderPlanErrors(errors: readonly PlanError[], raw: unknown): string[] {
  const stages = raw !== null && typeof raw === 'object' && Array.isArray((raw as { stages?: unknown }).stages)
    ? ((raw as { stages: unknown[] }).stages)
    : [];
  return errors.map((e) => {
    const m = /^stages\[(\d+)\]/.exec(e.path);
    const stage = m ? stages[Number(m[1])] : undefined;
    const id = stage !== null && typeof stage === 'object' ? (stage as { id?: unknown }).id : undefined;
    return `${e.path}${typeof id === 'string' && id !== '' ? ` (stage ${id})` : ''}: ${e.message}`;
  });
}

// ---------------------------------------------------------------------------------------------------
// The plan file

/** A plan resolved inside the guides root, read and validated (§3.6 step 2). */
export interface LoadedPlan {
  plan: Plan;
  /** The plan file's real path, and its folder's (where the record goes). */
  realPath: string;
  realDir: string;
  /** Its path relative to the guides root's real path, with `/` separators. */
  relPath: string;
  sha1: string;
  /** The stages to compile: the subset named, in plan order, or every stage. */
  compiled: Stage[];
}

/**
 * Resolve `planPath` inside the guides root, read it and validate it with the reference data. Throws
 * `CompileError` with one `path: message` line per error; a `stages` id the plan lacks is an error too.
 */
export async function loadPlan(
  guidesDirectory: string,
  planPath: string,
  referenceData: PlanReferenceData,
  subset?: readonly string[],
): Promise<LoadedPlan> {
  const realPath = await resolveInGuidesRoot(guidesDirectory, planPath, 'plan_path');
  const realRoot = await realPathInGuides(guidesDirectory);
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(realPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    throw new CompileError(
      code === 'ENOENT'
        ? `plan_path "${planPath}" names no file in the guides root ${guidesDirectory}`
        : `plan_path "${planPath}" can't be read: ${(error as Error).message}`,
    );
  }
  const text = bytes.toString('utf8');
  const result = validatePlan(text, referenceData);
  if (!result.ok) {
    let raw: unknown = null;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = null;
    }
    const lines = renderPlanErrors(result.errors, raw);
    throw new CompileError(`Plan ${planPath} is invalid (${lines.length} error${lines.length === 1 ? '' : 's'}):\n${lines.join('\n')}`);
  }
  const relPath = path.relative(realRoot, realPath).split(path.sep).join('/');
  if (relPath.includes('\\')) {
    // A folder named with a backslash would read as two path segments on Windows (and in the write
    // ledger's run-folder key), so it is never compiled.
    throw new CompileError(`plan_path "${planPath}" resolves to ${relPath} in the guides root, whose folder names hold a backslash`);
  }
  const plan = result.plan;
  let compiled = plan.stages;
  if (subset !== undefined) {
    if (subset.length === 0) throw new CompileError('stages names no stage: give at least one stage id, or leave stages out');
    const ids = new Set(plan.stages.map((s) => s.id));
    const unknown = subset.filter((id) => !ids.has(id));
    if (unknown.length > 0) {
      throw new CompileError(
        `stages: the plan has no stage ${unknown.map((id) => `"${id}"`).join(', ')}; its stages are ${plan.stages.map((s) => s.id).join(', ')}`,
      );
    }
    const wanted = new Set(subset);
    compiled = plan.stages.filter((s) => wanted.has(s.id));
  }
  return {
    plan,
    realPath,
    realDir: path.dirname(realPath),
    relPath,
    sha1: sha1(bytes),
    compiled,
  };
}

/**
 * Write `data` beside the plan (C-34): the plan's folder is resolved again just before the write and must
 * still be the folder read, then the data goes to a fresh temp file (never through an existing link) that
 * is renamed over `name`.
 */
async function writeBesidePlan(guidesDirectory: string, planPath: string, loaded: LoadedPlan, name: string, data: string): Promise<void> {
  const again = await resolveInGuidesRoot(guidesDirectory, planPath, 'plan_path');
  if (path.dirname(again) !== loaded.realDir) {
    throw new CompileError(`the plan's folder changed during the compile (now ${path.dirname(again)}); ${name} was not written`);
  }
  const target = path.join(loaded.realDir, name);
  const temp = `${target}.pob2mcp-tmp`;
  await fs.rm(temp, { force: true });
  try {
    await fs.writeFile(temp, data, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temp, target);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw new CompileError(`could not write ${target}: ${(error as Error).message}`);
  }
}

// ---------------------------------------------------------------------------------------------------
// The builds-folder target and the write ledger (§3.6 step 3, D-199, D-211)

/** C-17's changed-on-disk refusal, for a target this run wrote but someone changed since. */
function changedOnDisk(rel: string): BuildFileWriteError {
  return new BuildFileWriteError(
    `${rel} changed on disk since the engine loaded or saved it (probably saved in PoB2), so compile_plan won't ` +
      `replace it (D-211). Choose another build_name, or rename or move the existing file.`,
  );
}

interface TargetCheck {
  rel: string;
  guard: WriteGuard;
  overwrite: boolean;
  /** The existing file's sha1 at check time, null for a new file. */
  existingSha1: string | null;
}

async function readIfExists(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * A new target is written as a new file. An existing one may be overwritten only when the write ledger's
 * entry for its canonical path names this plan's run folder and the file's current sha1 equals the
 * entry's; otherwise C-17's "already exists" text (no entry, or another run's) or its changed-on-disk text
 * (this run's entry, another sha1). C-17's own guard still applies.
 */
async function checkTarget(env: CompilerEnv, buildName: string, runFolder: string): Promise<TargetCheck> {
  const ledger = await readWriteLedger(env.stateDir);
  const rel = await canonicalBuildPath(buildName, env.pobDirectory);
  const current = await readIfExists(path.join(path.resolve(env.pobDirectory), ...rel.split('/')));
  if (current === null) {
    const guard = await env.writer.checkBuildFile({ name: buildName, kind: 'engine' });
    return { rel, guard, overwrite: false, existingSha1: null };
  }
  const entry = ledgerEntryFor(ledger, rel);
  if (entry === undefined || entry.runFolder !== runFolder) {
    // C-17 step 2's refusal; compile_plan has no overwrite argument: the ledger decides.
    throw new BuildFileWriteError(
      `${rel} already exists. compile_plan replaces a builds-folder file only when this run (${runFolder}) wrote it ` +
        `and nobody changed it since (the write ledger, D-211)` +
        (entry === undefined ? '; no compile wrote it.' : `; it was written by run ${entry.runFolder}.`) +
        ' Choose another build_name, or rename or move the existing file.',
    );
  }
  const currentSha1 = sha1(current);
  if (currentSha1 !== entry.sha1) throw changedOnDisk(rel);
  const guard = await env.writer.checkBuildFile({ name: buildName, kind: 'engine', overwrite: true });
  return { rel, guard, overwrite: true, existingSha1: currentSha1 };
}

// ---------------------------------------------------------------------------------------------------
// The compile

function setRef(title: string, created: Map<number, number>, group: number): StageSetRef {
  const id = created.get(group);
  return id === undefined ? { title } : { title, reuse: id };
}

/** What `compile_stage` builds for one stage. */
export function stageParams(
  stage: Stage,
  first: boolean,
  refs: Record<ContentKind, StageSetRef>,
  offenseFields: readonly string[],
): CompileStageParams {
  return {
    id: stage.id,
    first,
    title: stage.loadoutName,
    level: stage.level,
    nodes: stage.tree.nodes,
    ascendancyNodes: stage.tree.ascendancyNodes,
    weaponSets: { set1: stage.tree.weaponSetNodes.set1, set2: stage.tree.weaponSetNodes.set2 },
    attributeChoices: stage.tree.attributeChoices,
    jewels: stage.items.treeJewels,
    itemSet: refs.item,
    // In PoB's slot order, so a main hand is in place before the off-hand is checked against it.
    items: [...stage.items.slots].sort((a, b) => ITEM_SLOTS.indexOf(a.slot) - ITEM_SLOTS.indexOf(b.slot)),
    toggles: stage.items.toggles.map((t) => ({ slot: t.slot, active: t.active })),
    useSecondWeaponSet: stage.items.useSecondWeaponSet,
    skillSet: refs.skill,
    groups: stage.skills.groups.map((g) => ({
      ...(g.label !== undefined ? { label: g.label } : {}),
      enabled: g.enabled,
      gems: g.gems.map((gem) => ({ name: gem.name, level: gem.level, quality: gem.quality, enabled: gem.enabled })),
    })),
    main: stage.skills.main,
    configSet: refs.config,
    config: stageConfig(stage),
    offenseFields: [...offenseFields],
    itemSlots: [...ITEM_SLOTS],
  };
}

const SET_ID_KEY: Record<ContentKind, 'itemSet' | 'skillSet' | 'configSet'> = {
  item: 'itemSet',
  skill: 'skillSet',
  config: 'configSet',
};

/** Every item set after `compile_finish` against the plan, named by the stages that use it. */
function finishItemDefects(
  finish: CompileFinishResult,
  planned: ReadonlyMap<number, SetItems>,
  results: readonly { stage: Stage; reply: CompileStageResult }[],
): string[] {
  const defects: string[] = [];
  for (const set of finish.itemSets) {
    const want = planned.get(set.id);
    const users = results.filter((r) => r.reply.ids.itemSet === set.id).map((r) => r.stage.id);
    if (want === undefined || users.length === 0) {
      defects.push(`item set ${set.id} "${set.title}" belongs to no compiled stage`);
      continue;
    }
    for (const line of compareItems(users.join(', '), want, set.slots)) defects.push(`${line} (item set "${set.title}")`);
  }
  return defects;
}

/** Compile a plan (§3.6 steps 1–11). Throws on any failure; `CompileError` texts are shown as they are. */
export async function compilePlan(env: CompilerEnv, request: CompileRequest): Promise<CompileResult> {
  const t0 = env.clock();
  const { ctx } = env;

  // 1. The guides root and the builds folder are disjoint (D-220).
  await checkGuidesRoot(env.guidesDirectory, env.pobDirectory);

  // 2. Resolve, read and validate the plan (D-163); no engine request before it passes.
  const loaded = await loadPlan(
    env.guidesDirectory,
    request.planPath,
    env.referenceData(),
    request.mode === 'measure-only' ? request.stages : undefined,
  );
  const { plan, compiled } = loaded;

  // 3. A final compile's target (D-199, D-211).
  let target: TargetCheck | null = null;
  let runFolder: string | null = null;
  if (request.mode === 'final') {
    runFolder = runFolderOf(loaded.relPath);
    if (runFolder === null) {
      throw new CompileError(
        `plan_path "${request.planPath}" is not inside a run folder: a final compile needs the plan at ` +
          `<slug>/<YYYY-MM-DD>-<n>/plan.json, as guide_run {new_run} creates it (the write ledger is keyed by the run folder, D-211)`,
      );
    }
    target = await checkTarget(env, request.buildName, runFolder);
  }

  // 4. Shared sets (A-P2).
  const grouped = groupSets(compiled);

  // 5. The read-only preflight (A-P12).
  const tCheck = env.clock();
  const check = await ctx.client.compileCheck({
    className: plan.roll.className,
    ascendancy: plan.roll.ascendancy,
    stages: compiled.map(checkStageOf),
  });
  const checkMs = env.clock() - tCheck;
  if (check.defects.length > 0) {
    throw new CompileError(
      `Plan ${request.planPath} has ${check.defects.length} defect${check.defects.length === 1 ? '' : 's'}; nothing was compiled:\n` +
        check.defects.join('\n'),
    );
  }

  // 6. A new build replaces the engine's build (D-210).
  await ctx.newBuild({ className: plan.roll.className, ascendancy: plan.roll.ascendancy });

  // 7. Build and measure each stage.
  const created: Record<ContentKind, Map<number, number>> = { item: new Map(), skill: new Map(), config: new Map() };
  /** Per item set id: what its creating stage equipped (the plan's items for every stage sharing it). */
  const plannedItems = new Map<number, SetItems>();
  /** Per config set id: the stored values of the options its stages list (D-248), and whether a reload keeps each. */
  const configInputs = new Map<number, ConfigSetInputs['inputs']>();
  const configSurvives = new Map<number, Readonly<Record<string, boolean>>>();
  const results: { stage: Stage; reply: CompileStageResult; elapsedMs: number }[] = [];
  for (const [i, stage] of compiled.entries()) {
    const refs = {} as Record<ContentKind, StageSetRef>;
    for (const kind of CONTENT_KINDS) {
      const g = grouped[kind].groupOf.get(stage.id)!;
      refs[kind] = setRef(grouped[kind].groups[g].title, created[kind], g);
    }
    const t = env.clock();
    const reply = await ctx.client.compileStage(stageParams(stage, i === 0, refs, env.offenseFields));
    const elapsedMs = env.clock() - t;
    for (const kind of CONTENT_KINDS) {
      const g = grouped[kind].groupOf.get(stage.id)!;
      if (!created[kind].has(g)) created[kind].set(g, reply.ids[SET_ID_KEY[kind]]);
    }
    const defects = compareAllocation(stage, reply.allocation);
    if (defects.length > 0) {
      throw new CompileError(`PoB changed stage ${stage.id}'s allocation on import (D-213); nothing was written:\n${defects.join('\n')}`);
    }
    if (!plannedItems.has(reply.ids.itemSet)) plannedItems.set(reply.ids.itemSet, reply.addedItems);
    if (!configInputs.has(reply.ids.configSet)) {
      configInputs.set(reply.ids.configSet, reply.configInputs);
      configSurvives.set(reply.ids.configSet, reply.configSurvivesDrop);
    }
    const itemDefects = compareItems(stage.id, plannedItems.get(reply.ids.itemSet)!, reply.items);
    if (itemDefects.length > 0) {
      throw new CompileError(`PoB doesn't hold stage ${stage.id}'s planned items; nothing was written:\n${itemDefects.join('\n')}`);
    }
    results.push({ stage, reply, elapsedMs });
  }

  // 8. The loadouts, the saved stage and its level in auto mode.
  const top = savedStage(compiled);
  const tFinish = env.clock();
  const finish = await ctx.client.compileFinish({
    stages: results.map((r) => ({ id: r.stage.id, title: r.stage.loadoutName, ids: r.reply.ids })),
    active: top.loadoutName,
    level: top.level,
    itemSlots: [...ITEM_SLOTS],
  });
  const finishMs = env.clock() - tFinish;
  const finishDefects = finishItemDefects(finish, plannedItems, results);
  if (finishDefects.length > 0) {
    throw new CompileError(`PoB doesn't hold the planned items after the last stage; nothing was written:\n${finishDefects.join('\n')}`);
  }

  // 9. Export and import code.
  const tExport = env.clock();
  const exported = await ctx.client.exportBuildXml();
  const exportMs = env.clock() - tExport;
  // D-248: PoB's save drops an input equal to the active set's placeholder from every set; put them back.
  const savedSets: ConfigSetInputs[] = [...configInputs].map(([id, inputs]) => ({ id, inputs }));
  const { xml, restored } = restoreConfigInputs(exported, savedSets);
  const configProblems = savedConfigProblems(xml, savedSets);
  if (configProblems.length > 0) {
    throw new CompileError(`the saved build would not keep every stage's config (D-248); nothing was written:\n${configProblems.join('\n')}`);
  }
  const importCode = encodePobCode(xml);
  const xmlBytes = Buffer.from(xml, 'utf8');

  // 10. Write the PoB file (final) or the compiled XML beside the plan (measure-only).
  const relDir = path.posix.dirname(loaded.relPath);
  const besideRel = (name: string) => (relDir === '.' ? name : `${relDir}/${name}`);
  const written: CompileResult['written'] = { builds: [], guides: [] };
  let pobFile: CompileRecord['pobFile'];
  let replacedFile = false;
  if (request.mode === 'final' && target !== null && runFolder !== null) {
    if (target.existingSha1 !== null) {
      // The file may not change between the check and the write: someone saving it meanwhile wins.
      const now = await readIfExists(path.join(path.resolve(env.pobDirectory), ...target.rel.split('/')));
      if (now !== null && sha1(now) !== target.existingSha1) throw changedOnDisk(target.rel);
    }
    const saved = await env.writer.writeBuildFile({
      name: request.buildName,
      bytes: xmlBytes,
      kind: 'engine',
      overwrite: target.overwrite,
      guard: target.guard,
      ctx,
    });
    replacedFile = saved.replaced;
    // At once after the file: a failure later still leaves the entry, so a retry may overwrite (D-211).
    await writeWriteLedger(
      env.stateDir,
      withLedgerEntry(await readWriteLedger(env.stateDir), {
        path: saved.path,
        sha1: saved.fingerprint.sha1,
        runFolder,
        writtenAt: env.wallClock().toISOString(),
      }),
    );
    written.builds.push(saved.path);
    pobFile = { location: 'builds', path: saved.path, sha1: saved.fingerprint.sha1, bytes: saved.bytes };
  } else {
    await writeBesidePlan(env.guidesDirectory, request.planPath, loaded, MEASURE_ONLY_XML_FILE, xml);
    written.guides.push(besideRel(MEASURE_ONLY_XML_FILE));
    pobFile = { location: 'run', path: besideRel(MEASURE_ONLY_XML_FILE), sha1: sha1(xmlBytes), bytes: xmlBytes.length };
  }

  // 11. The ledger and the record.
  const numbers: Record<string, StageOutputs> = {};
  const stages: Record<string, StageRecord> = {};
  for (const { stage, reply, elapsedMs } of results) {
    numbers[stage.id] = { outputs: reply.outputs, skillOutputs: reply.skillOutputs };
    stages[stage.id] = {
      loadoutName: stage.loadoutName,
      level: stage.level,
      elapsedMs,
      outputs: reply.outputs,
      skillOutputs: reply.skillOutputs,
      configWritten: stageConfig(stage),
      configEffective: {},
      pobWarnings: { kept: [], filtered: [] },
      v1: null,
      v2: null,
    };
  }
  const ledger: CompileRecord['ledger'] = {};
  const evaluated = evaluateLedger(plan.ledger, { stageIds: plan.stages.map((s) => s.id), stages: numbers });
  for (const [id, res] of Object.entries(evaluated)) {
    ledger[id] = { value: res.value, error: res.error ? ledgerErrorText(res.error) : null };
  }
  const engine = { pobTag: env.engine.pobTag, pobCommit: env.engine.pobCommit, treeVersion: check.treeVersion };
  const sets: CompileRecord['sets'] = results.map((r) => ({
    kind: 'tree' as const,
    id: r.reply.ids.spec,
    title: r.stage.loadoutName,
    stages: [r.stage.id],
  }));
  for (const kind of CONTENT_KINDS) {
    grouped[kind].groups.forEach((g, index) => {
      sets.push({ kind, id: created[kind].get(index)!, title: g.title, stages: g.stageIds });
    });
  }
  const mode: CompileMode = request.mode;
  const record: CompileRecord = {
    recordVersion: RECORD_VERSION,
    planSchemaVersion: plan.schemaVersion,
    planSha1: loaded.sha1,
    compiledAt: env.wallClock().toISOString(),
    mode,
    stagesCompiled: compiled.map((s) => s.id),
    engine,
    versionNotes: versionNotes(plan.versions, engine),
    loadoutWarnings: weaponFlagWarnings(results.map((r) => ({ id: r.stage.id, flags: r.reply.weaponFlags }))),
    saveWarnings: savedConfigWarnings(restored, configInputs, configSurvives, (set) =>
      results.filter((r) => r.reply.ids.configSet === set).map((r) => r.stage.id),
    ),
    pobFile,
    importCode,
    savedLevel: { level: top.level, autoMode: true },
    activeLoadout: finish.active,
    sets,
    stages,
    ledger,
    unresolvedRefs: unresolvedRefs(plan, numbers),
    timing: { totalMs: env.clock() - t0, checkMs, finishMs, exportMs },
  };
  await writeBesidePlan(env.guidesDirectory, request.planPath, loaded, RECORD_FILE, recordText(record));
  written.guides.push(besideRel(RECORD_FILE));
  return { planPath: request.planPath, record, written, replacedFile };
}

/** `guide_run {validate}` (C-50): §3.6 step 2 and step 5, nothing else; the build is unchanged. */
export async function validatePlanFile(
  env: Pick<CompilerEnv, 'ctx' | 'guidesDirectory' | 'referenceData'>,
  planPath: string,
  subset?: readonly string[],
): Promise<{ stages: string[] }> {
  const loaded = await loadPlan(env.guidesDirectory, planPath, env.referenceData(), subset);
  const check = await env.ctx.client.compileCheck({
    className: loaded.plan.roll.className,
    ascendancy: loaded.plan.roll.ascendancy,
    stages: loaded.compiled.map(checkStageOf),
  });
  if (check.defects.length > 0) {
    throw new CompileError(
      `Plan ${planPath} has ${check.defects.length} defect${check.defects.length === 1 ? '' : 's'}:\n${check.defects.join('\n')}`,
    );
  }
  return { stages: loaded.compiled.map((s) => s.id) };
}
