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
 *     unequips an off-hand that doesn't fit without a word, so any difference is an error. The named
 *     source's group (`rolledGroup`) is created in PoB's Full DPS with its Count (`groupCount`), and every
 *     other group out of it, in both modes (D-293, D-337); the custom modifiers go into PoB's `customMods`
 *     option after the listed config options (D-293);
 *  8. `compile_finish` checks the loadouts, selects the highest stage's and saves its level in auto mode;
 *     every item set is compared with the plan again;
 *  9. the build is exported, every listed config option PoB's save left out is put back into its set and
 *     checked (D-248), and the XML is encoded as an import code (C-42);
 * 10. final: the builds-folder file through C-17, then its write-ledger entry; measure-only: the XML
 *     beside the plan;
 * 11. V1 and V2 check every compiled stage (`src/plan/checks/`, D-192), the ledger formulas are evaluated and
 *     the record is written beside the plan, with each figure's Count applied beside the raw one and the
 *     custom-modifier marks (`record.ts`, D-321).
 * Any failure up to step 9 writes nothing. Steps 1–5 leave the engine's build as it was.
 *
 * WU-65 (D-353, D-358): an endgame stage whose scenario omits a reference hit gets it from the data at its
 * rung's area level (`withReferenceHits`, D-254's formula rounded by D-256) before step 4, so it is written,
 * grouped and checked like a listed one; a stage's anoint is checked by `compile_check` and written on its
 * amulet by `compile_stage`; the record gives each endgame stage its `measures` and an anointed stage its
 * recipe; `keyFigureLine` is the line `compile_plan` prints after each stage's line (D-356). WU-88 (D-407): a card
 * skeleton (an endgame stage with no `variant`) gets `measures` too, the rough clear speed and the player's movement
 * speed (`measuredStage`), and every endgame stage's measures carry the movement speed; campaign stages get none.
 *
 * WU-78 (D-377, D-378, D-380): a group may name its summon's minion skill (`minionSkill`, `minionStatSet`).
 * `compile_check` refuses a group with no summon or two, a name the minion can't cast and a stat set beyond the
 * skill's; `compile_stage` resolves the name live after the stage's groups are built, and the record keeps each
 * resolved selection (`minionSkills`). A group's damage figure is then its minion's `MinionTotalDPS`, which the
 * headline, the key-figure line and the clear measure read. The stage checks name each group's skill a passive
 * grants, for V1's `not-granted`. WU-80 (D-397): a plain summon, which names no minion skill, has its minion's figure
 * too, in the headline, the key-figure line and the clear measure (`minionFigures`: its breakdown entry carries
 * `Minion<Field>` fields).
 *
 * WU-87 (D-402): a stage's `companion` (`companion.ts`). Each kept `condition` modifier's config option is written as
 * earned state before step 5; `compile_check` resolves the species against PoB's beast library, checks the Tame Beast
 * gem and parses the kept `stats` modifiers' lines; the lines it parses join the stage's custom modifiers after it, so
 * the shared sets are grouped after the preflight (step 4 follows step 5), and stages naming different beasts never
 * share a skill set. `compile_stage` turns the Tame Beast gem into the beast, and the record gives the beast's DPS, the
 * Spirit it reserves and how each kept modifier was applied.
 *
 * When the stages differ in a weapon-fit flag (Giant's Blood, Instruments of Power, Lord of the Wilds), the
 * record and the text carry a loadout warning: PoB2 checks a loadout's off-hand against the passives of the
 * loadout it switches from, so switching loadouts in PoB2 can unequip a planned off-hand.
 *
 * V1 and V2 (WU-42) run over `compile_stage`'s check inputs, `compile_check`'s producer lookups, config
 * defaults and trees (D-360), the plan, the C1/E1 data and the baseline list (D-230), which is read with the plan, before any
 * engine request. Their findings go into the record and the text; they never fail the compile (D-192).
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
import { buildSha1 } from './buildHash.js';
import { evaluateLedger, ledgerErrorText, type StageOutputs } from './ledger.js';
import {
  ARBITER_FILE,
  MEASURE_ONLY_XML_FILE,
  RECORD_FILE,
  RECORD_VERSION,
  arbiterHitsOf,
  clearGemNames,
  countedFigures,
  figureField,
  formulaReadsStages,
  headlineDps,
  measuredStage,
  minionSkillOf,
  recordText,
  selectionKey,
  stageMeasures,
  unresolvedRefs,
  versionNotes,
  type CompileMode,
  type CompileRecord,
  type ConfigValue,
  type StageRecord,
  type Verdict,
} from './record.js';
import type { ReferenceData, ResolvedFact } from './referenceData.js';
import {
  companionCheckOf,
  companionPlansOf,
  companionRecordOf,
  withCompanionConditions,
  withCompanionLines,
  type CompanionPlan,
} from './companion.js';
import {
  CUSTOM_MODS_OPTION,
  validatePlan,
  type Plan,
  type PlanError,
  type PlanReferenceData,
  type PlanVariant,
  type Stage,
} from './schema.js';
import type { SourceTag } from './sourceTag.js';
import { restoreConfigInputs, savedConfigProblems, type ConfigSetInputs } from './savedConfig.js';
import { ledgerEntryFor, readWriteLedger, withLedgerEntry, writeWriteLedger } from './writeLedger.js';
import { loadConfigBaseline, type ConfigBaseline } from './checks/configBaseline.js';
import { checkV1, predecessorOf } from './checks/v1.js';
import { checkV2, producerKey } from './checks/v2.js';

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
  referenceData: () => ReferenceData;
  /** The baseline list (D-230); default `loadConfigBaseline()` from the package's `data/`. */
  configBaseline?: () => ConfigBaseline;
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
  /** Each compiled stage's main selection, by stage id: the key-figure line's headline source (D-356). */
  mains: Record<string, Stage['skills']['main']>;
}

/** The set kinds a stage's content is grouped by (A-P2). */
export type ContentKind = 'item' | 'skill' | 'config';
const CONTENT_KINDS: readonly ContentKind[] = ['item', 'skill', 'config'];
const CONTENT_OF: Record<ContentKind, (s: Stage) => Stage['items'] | Stage['skills'] | Stage['config']> = {
  item: (s) => s.items,
  skill: (s) => s.skills,
  config: (s) => s.config,
};

/**
 * What a stage's sets are grouped by (A-P2): its content of the kind. D-402: a skill set's content includes the stage's
 * companion, the beast its Tame Beast gem summons (`beastOf` the stage, its resolved monster id; else its species), so
 * stages naming different beasts, or one and none, never share a skill set.
 */
function groupingKey(kind: ContentKind, stage: Stage, beastOf?: (stageId: string) => string | undefined): string {
  if (kind !== 'skill' || stage.companion === undefined) return stableText(CONTENT_OF[kind](stage));
  return stableText({ ...stage.skills, companion: beastOf?.(stage.id) ?? stage.companion.species });
}

const sha1 = (data: string | Buffer) => crypto.createHash('sha1').update(data).digest('hex');

/** A stage's V1 and V2 verdicts and what they read for the record (D-192, D-212). */
type StageVerdicts = Pick<StageRecord, 'configEffective' | 'pobWarnings'> & { v1: Verdict; v2: Verdict };

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
export function groupSets(
  stages: readonly Stage[],
  beastOf?: (stageId: string) => string | undefined,
): Record<ContentKind, { groups: SetGroup[]; groupOf: Map<string, number> }> {
  const out = {} as Record<ContentKind, { groups: SetGroup[]; groupOf: Map<string, number> }>;
  for (const kind of CONTENT_KINDS) {
    const byKey = new Map<string, number>();
    const groups: { kind: ContentKind; first: Stage; stageIds: string[] }[] = [];
    const groupOf = new Map<string, number>();
    for (const stage of stages) {
      const key = groupingKey(kind, stage, beastOf);
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

/**
 * The producers the stages' earned config names (C-32), each once, in plan order: what `compile_check`
 * looks up in the game data for V2 (D-221).
 */
export function producersOf(stages: readonly Pick<Stage, 'config'>[]): { kind: string; name: string }[] {
  const seen = new Set<string>();
  const out: { kind: string; name: string }[] = [];
  for (const stage of stages) {
    for (const e of stage.config.earned) {
      if (e.producer === undefined) continue;
      const key = producerKey(e.producer.kind, e.producer.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: e.producer.kind, name: e.producer.name });
    }
  }
  return out;
}

/** The baseline list (D-230), read before any engine request; an invalid file stops the compile. */
function readConfigBaseline(env: Pick<CompilerEnv, 'configBaseline'>): ConfigBaseline {
  try {
    return (env.configBaseline ?? (() => loadConfigBaseline()))();
  } catch (error) {
    throw new CompileError(`${(error as Error).message}\nNothing was compiled.`);
  }
}

/** What `compile_check` reads of a stage; with its companion (D-402), the beast's species and lines. */
export function checkStageOf(stage: Stage, companion?: CompanionPlan): CompileCheckStage {
  return {
    id: stage.id,
    nodes: stage.tree.nodes,
    ascendancyNodes: stage.tree.ascendancyNodes,
    weaponSets: { set1: stage.tree.weaponSetNodes.set1, set2: stage.tree.weaponSetNodes.set2 },
    attributeChoices: stage.tree.attributeChoices,
    jewels: stage.items.treeJewels,
    items: stage.items.slots,
    groups: stage.skills.groups.map((g) => ({
      gems: g.gems.map((gem) => ({ name: gem.name, enabled: gem.enabled })),
      ...minionFields(g),
    })),
    main: stage.skills.main,
    config: Object.entries(stageConfig(stage)).map(([option, value]) => ({ option, value })),
    customMods: customModLines(stage),
    ...(stage.items.anoint !== undefined ? { anoint: stage.items.anoint.notable } : {}),
    ...(companion !== undefined ? { companion: companionCheckOf(stage, companion) } : {}),
  };
}

/** D-377: a group's minion skill and its stat set, as the engine actions take them (absent when it names none). */
function minionFields(g: Stage['skills']['groups'][number]): { minionSkill?: string; minionStatSet?: number } {
  return {
    ...(g.minionSkill !== undefined ? { minionSkill: g.minionSkill } : {}),
    ...(g.minionStatSet !== undefined ? { minionStatSet: g.minionStatSet } : {}),
  };
}

/** D-293: a stage's custom modifier lines, `config.customMods` texts in plan order (none for a version-1 plan). */
export function customModLines(stage: Pick<Stage, 'config'>): string[] {
  return (stage.config.customMods ?? []).map((m) => m.text);
}

/**
 * D-293, D-321: whether the stage is measured with custom modifiers present, so its figures carry the mark:
 * its written config holds PoB's `customMods` option with text, whatever its source. That is
 * `config.customMods`, or, in a version-1 plan (D-332), an `earned` or `scenario` entry for the option. An
 * empty value clears the option (`BuildOps.lua`'s `config_value`), and blank text adds no modifier.
 */
export function measuredWithCustomMods(stage: Pick<Stage, 'config'>): boolean {
  if (customModLines(stage).length > 0) return true;
  const listed = stageConfig(stage)[CUSTOM_MODS_OPTION];
  return listed !== undefined && String(listed).trim() !== '';
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
// The reference hits (WU-65, D-353; D-254, D-256)

/** The five reference hits of an endgame stage (D-254): each option, and whether it is an extra element (or chaos). */
export const REFERENCE_HITS: readonly { option: string; type: string; extra: boolean }[] = [
  { option: 'enemyPhysicalDamage', type: 'physical', extra: false },
  { option: 'enemyFireDamage', type: 'fire', extra: true },
  { option: 'enemyColdDamage', type: 'cold', extra: true },
  { option: 'enemyLightningDamage', type: 'lightning', extra: true },
  { option: 'enemyChaosDamage', type: 'chaos', extra: true },
];

const MAP_MONSTERS = 'enemies/map-monsters.json';
const WAYSTONES = 'enemies/waystones.json';

/** The waystone tier of a rung below the top (D-254, D-281): `m` at T5, `b` at T15; `n` takes the data's max area level. */
const RUNG_TIER: Readonly<Partial<Record<PlanVariant, number>>> = { 'entering-maps': 5, budget: 15 };

/** D-256: PoB takes a hit as a whole number: the value rounded to 2 decimals (absorbing float32 noise), then up. */
export const hitCeiling = (value: number): number => Math.ceil(Math.round(value * 100) / 100);

function dataFact(ref: PlanReferenceData, file: string, key: string): ResolvedFact {
  const found = ref.resolveFact(file, key);
  if (!found.ok) throw new CompileError(`the reference hits (D-254) need ${file}#${key}: ${found.reason}. Nothing was compiled.`);
  return found.fact;
}

/** A fact's number: the value, or the top of a `{min, max}` range. */
function topOf(fact: ResolvedFact): number {
  const v = fact.value as unknown;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && typeof (v as { max?: unknown }).max === 'number') return (v as { max: number }).max;
  throw new CompileError(`the reference hits (D-254) need a number at ${fact.file}#${fact.factId}. Nothing was compiled.`);
}

const CONFIDENCE_ORDER = ['L', 'M', 'H'] as const;

/** The area level of a rung (D-254): `area-level.offset` plus its tier for `m` (69) and `b` (79), `area-level.max` for `n` (82). */
export function rungAreaLevel(variant: PlanVariant, ref: PlanReferenceData): { level: number; facts: ResolvedFact[] } {
  const tier = RUNG_TIER[variant];
  if (tier === undefined) {
    const max = dataFact(ref, WAYSTONES, 'area-level.max');
    return { level: topOf(max), facts: [max] };
  }
  const offset = dataFact(ref, WAYSTONES, 'area-level.offset');
  return { level: topOf(offset) + tier, facts: [offset] };
}

/**
 * D-254, D-256: a rung's five reference hits, each a scenario entry. A hit is the map monsters' damage at the
 * rung's area level × (1 + the top of `mods.increased-monster-damage` / 100), and × the top of
 * `mods.extra-damage-as-element` / 100 for fire, cold, lightning and chaos, as a whole number (`hitCeiling`).
 * Each cites the damage at that level, with that fact's tag at the lowest confidence of the facts it rests on.
 */
export function referenceHits(variant: PlanVariant, ref: PlanReferenceData): Stage['config']['scenario'] {
  const area = rungAreaLevel(variant, ref);
  const damageKey = `damage.by-level[${area.level}]`;
  const damage = dataFact(ref, MAP_MONSTERS, damageKey);
  const increased = dataFact(ref, WAYSTONES, 'mods.increased-monster-damage');
  const extra = dataFact(ref, WAYSTONES, 'mods.extra-damage-as-element');
  const base = topOf(damage) * (1 + topOf(increased) / 100);
  return REFERENCE_HITS.map((h) => {
    const facts = [damage, increased, ...(h.extra ? [extra] : []), ...area.facts];
    const lowest = facts
      .map((f) => f.tag.confidence ?? 'H')
      .reduce((a, b) => (CONFIDENCE_ORDER.indexOf(a) <= CONFIDENCE_ORDER.indexOf(b) ? a : b));
    const tag: SourceTag = { ...damage.tag, confidence: lowest };
    return {
      option: h.option,
      value: hitCeiling(h.extra ? base * (topOf(extra) / 100) : base),
      source: { file: MAP_MONSTERS, key: damageKey },
      tag,
    };
  });
}

/**
 * D-353: an endgame stage with every reference hit its scenario omits added from the data (`referenceHits`), so
 * it is written, grouped (A-P2) and checked like a listed one; a hit the plan lists, as earned or scenario, keeps
 * its own value. Any other stage is returned as it is.
 */
export function withReferenceHits(stage: Stage, ref: PlanReferenceData): Stage {
  if (stage.variant === undefined) return stage;
  const listed = stageConfig(stage);
  const missing = REFERENCE_HITS.filter((h) => listed[h.option] === undefined);
  if (missing.length === 0) return stage;
  const filled = referenceHits(stage.variant, ref).filter((e) => missing.some((h) => h.option === e.option));
  return { ...stage, config: { ...stage.config, scenario: [...stage.config.scenario, ...filled] } };
}

// ---------------------------------------------------------------------------------------------------
// The key-figure line (WU-65, D-356)

const whole = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '?');

/**
 * D-356 (amending D-273 (2)): a stage's key figures, the line `compile_plan` prints after the stage's line, so an
 * agent needn't read the record after a compile: the headline DPS (the main group's Count-scaled figure), life,
 * energy shield, EHP, the four resistances, the V1 and V2 finding counts, and on an endgame stage the Arbiter
 * verdict with its worst hit (`b`, `n`) and the rough clear speed (D-353). Every stage's DPS is `headlineDps`
 * of its main selection `main`, the figure an endgame stage's `measures.dps` holds. When the main group names a
 * minion skill, the DPS is its minion's and names it: `DPS <n> (<minion skill>, minion)` (D-378). When the main
 * skill is a plain summon (no minion skill; `figureField`, D-397), the DPS is its minion's too and names the summon
 * as the record does (its breakdown entry's `skill`, PoB's name of the skill): `DPS <n> (<summon>, minion)`.
 *
 * WU-88 (D-407) leaves the line as it was: a card skeleton's pace measures, and every measured stage's
 * `movementSpeed`, are in the record only (the user's HG-12 grant covers the record's fields), so the clear speed is
 * printed where the measures are an endgame variant's, the ones that carry `dps`.
 */
export function keyFigureLine(rec: StageRecord, main: Stage['skills']['main']): string {
  const o = rec.outputs;
  const dps = headlineDps({ skills: { main } }, rec);
  const variantMeasures = rec.measures?.dps !== undefined ? rec.measures : undefined;
  const ehp = variantMeasures !== undefined ? variantMeasures.ehp : o.TotalEHP;
  const minion = minionSkillOf(rec, main.group);
  const source = figureField(rec, main) === 'MinionTotalDPS' ? (minion?.name ?? rec.skillOutputs[selectionKey(main)]?.skill) : undefined;
  const parts = [
    `DPS ${whole(dps)}${source !== undefined ? ` (${source}, minion)` : ''}`,
    `life ${whole(o.Life)}`,
    `ES ${whole(o.EnergyShield)}`,
    `EHP ${whole(ehp)}`,
    `resists ${['FireResist', 'ColdResist', 'LightningResist', 'ChaosResist'].map((k) => whole(o[k])).join('/')} (fire/cold/lightning/chaos)`,
    `findings V1 ${rec.v1?.findings.length ?? '?'}, V2 ${rec.v2?.findings.length ?? '?'}`,
  ];
  const arbiter = rec.measures?.arbiter;
  if (arbiter !== undefined) {
    const worst = arbiter.worst;
    const at = worst === null ? '' : ` (worst: ${worst.type} hit ${worst.hitId}, ${worst.ratio.toFixed(2)} of max hit)`;
    parts.push(`Arbiter ${arbiter.verdict ?? 'unknown'}${at}`);
  }
  if (variantMeasures !== undefined) parts.push(`clear ${variantMeasures.clearSpeed.speed} (rough)`);
  return `  Key figures: ${parts.join('; ')}`;
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
  /** D-266: the sha1 of the plan's build-affecting projection (`buildHash.ts`). */
  buildSha1: string;
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
    // The validated text parses; the projection is of the plan as written, not its parsed form (D-266).
    buildSha1: buildSha1(JSON.parse(text)),
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
  anoint?: string,
  companionId?: string,
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
    groups: stage.skills.groups.map((g, k) => {
      // D-293, D-337: the named source's group (rolledGroup, D-295) is in PoB's Full DPS with its Count in
      // every compile, so the file shows the reader that Full DPS; every other group stays out (D-306).
      const named = stage.skills.rolledGroup === k + 1;
      return {
        ...(g.label !== undefined ? { label: g.label } : {}),
        enabled: g.enabled,
        includeInFullDPS: named,
        ...(named ? { groupCount: g.count ?? 1 } : {}),
        gems: g.gems.map((gem) => ({ name: gem.name, level: gem.level, quality: gem.quality, enabled: gem.enabled })),
        ...minionFields(g),
      };
    }),
    main: stage.skills.main,
    configSet: refs.config,
    config: stageConfig(stage),
    customMods: customModLines(stage),
    offenseFields: [...offenseFields, ...MEASURE_FIELDS.filter((f) => !offenseFields.includes(f))],
    itemSlots: [...ITEM_SLOTS],
    // D-358: the notable's PoB name, as compile_check resolved it, written on the amulet.
    ...(anoint !== undefined ? { anoint } : {}),
    // D-402: the beast compile_check resolved the companion's species to.
    ...(companionId !== undefined ? { companion: { id: companionId } } : {}),
  };
}

/** The fields the measures read per skill beside C-45's (D-353): the clear skill's area, or its minion's (D-378). */
export const MEASURE_FIELDS: readonly string[] = ['AreaOfEffectRadiusMetres', 'MinionAreaOfEffectRadiusMetres'];

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
  const refData = env.referenceData();
  const loaded = await loadPlan(
    env.guidesDirectory,
    request.planPath,
    refData,
    request.mode === 'measure-only' ? request.stages : undefined,
  );
  // D-353: each endgame stage's omitted reference hits come from the data, before the sets are grouped. D-402: a
  // companion's kept condition modifiers are written as earned state, so the preflight checks them.
  const companions = companionPlansOf(loaded.plan.stages, refData);
  const checkedPlan: Plan = {
    ...loaded.plan,
    stages: loaded.plan.stages.map((s) => withCompanionConditions(withReferenceHits(s, refData), companions.get(s.id))),
  };
  const compiledIds = new Set(loaded.compiled.map((s) => s.id));
  const preflight = checkedPlan.stages.filter((s) => compiledIds.has(s.id));
  // V2's baseline list (D-230), checked with the plan: an invalid file stops the compile here.
  const baselineList = readConfigBaseline(env);

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

  // 5. The read-only preflight (A-P12).
  const tCheck = env.clock();
  const check = await ctx.client.compileCheck({
    className: checkedPlan.roll.className,
    ascendancy: checkedPlan.roll.ascendancy,
    stages: preflight.map((s) => checkStageOf(s, companions.get(s.id))),
    producers: producersOf(preflight),
    // D-353: the clear-speed measure reads the measured stages' clear gems' texts, a card skeleton's included (D-407).
    describeGems: [...new Set(preflight.filter(measuredStage).flatMap(clearGemNames))],
  });
  const checkMs = env.clock() - tCheck;
  if (check.defects.length > 0) {
    throw new CompileError(
      `Plan ${request.planPath} has ${check.defects.length} defect${check.defects.length === 1 ? '' : 's'}; nothing was compiled:\n` +
        check.defects.join('\n'),
    );
  }
  // D-402: the companion lines PoB parses join the custom modifiers, each with its reason, before the sets are grouped.
  const companionChecks = new Map(check.companions.map((c) => [c.stage, c]));
  const plan: Plan = {
    ...checkedPlan,
    stages: checkedPlan.stages.map((s) => withCompanionLines(s, companions.get(s.id), companionChecks.get(s.id))),
  };
  const compiled = plan.stages.filter((s) => compiledIds.has(s.id));

  // 4. Shared sets (A-P2), after the preflight: a companion's lines are part of its stage's config, and its resolved
  // beast part of its skills.
  const grouped = groupSets(compiled, (id) => companionChecks.get(id)?.id);

  // 6. A new build replaces the engine's build (D-210).
  await ctx.newBuild({ className: plan.roll.className, ascendancy: plan.roll.ascendancy });

  // 7. Build and measure each stage.
  const created: Record<ContentKind, Map<number, number>> = { item: new Map(), skill: new Map(), config: new Map() };
  /** Per item set id: what its creating stage equipped (the plan's items for every stage sharing it). */
  const plannedItems = new Map<number, SetItems>();
  /** Per config set id: the stored values of the options its stages list (D-248), and whether a reload keeps each. */
  const configInputs = new Map<number, ConfigSetInputs['inputs']>();
  const configSurvives = new Map<number, Readonly<Record<string, boolean>>>();
  const results: { stage: Stage; reply: CompileStageResult; elapsedMs: number; checked: StageVerdicts }[] = [];
  // V1 and V2's producer lookups, from the preflight (D-221).
  const producers = new Map(check.producers.map((p) => [producerKey(p.kind, p.name), p.exists]));
  // D-358: each anointed stage's notable, as the preflight resolved it.
  const anoints = new Map(check.anoints.map((a) => [a.stage, a]));
  // D-360: each stage's trees, as the preflight's check_tree computed them, for V1's tree-shape.
  const treesOf = new Map(check.trees.map((t) => [t.stage, t]));
  for (const [i, stage] of compiled.entries()) {
    const refs = {} as Record<ContentKind, StageSetRef>;
    for (const kind of CONTENT_KINDS) {
      const g = grouped[kind].groupOf.get(stage.id)!;
      refs[kind] = setRef(grouped[kind].groups[g].title, created[kind], g);
    }
    const t = env.clock();
    const reply = await ctx.client.compileStage(
      stageParams(stage, i === 0, refs, env.offenseFields, anoints.get(stage.id)?.notable, companionChecks.get(stage.id)?.id),
    );
    const elapsedMs = env.clock() - t;
    // D-402: a stage that names a companion has its measured companion (compile_stage fails without one).
    if (companionChecks.has(stage.id) && reply.companion === undefined) {
      throw new CompileError(`PoB measured no companion for stage ${stage.id}'s Tame Beast gem (D-402); nothing was written`);
    }
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
    // V1 and V2, once the stage is measured (D-192): findings go into the record, never into an error.
    const v1 = checkV1({
      stage,
      predecessor: predecessorOf(plan.stages, plan.stages.indexOf(stage)),
      checks: reply.checks,
      ref: refData,
      trees: treesOf.get(stage.id),
    });
    const v2 = checkV2({ stage, checks: reply.checks, producers, defaults: check.configBaseline, baseline: baselineList, ref: refData });
    results.push({ stage, reply, elapsedMs, checked: { v1: v1.verdict, v2: v2.verdict, pobWarnings: v1.pobWarnings, configEffective: v2.configEffective } });
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
  const arbiterHits = arbiterHitsOf(refData.files.get(ARBITER_FILE)?.facts ?? {});
  const numbers: Record<string, StageOutputs> = {};
  const stages: Record<string, StageRecord> = {};
  /** D-321: the stages measured with custom modifiers present, whose figures carry the mark. */
  const marked = new Set<string>();
  for (const { stage, reply, elapsedMs, checked } of results) {
    numbers[stage.id] = { outputs: reply.outputs, skillOutputs: reply.skillOutputs };
    // D-293, D-321: the raw figures stay as measured; the counted ones beside them apply each group's Count.
    const counted = countedFigures(stage, reply.outputs, reply.skillOutputs, reply.dotCanStack);
    const customModsWritten = customModLines(stage);
    const computedWithCustomMods = measuredWithCustomMods(stage);
    if (computedWithCustomMods) marked.add(stage.id);
    stages[stage.id] = {
      loadoutName: stage.loadoutName,
      level: stage.level,
      elapsedMs,
      outputs: reply.outputs,
      countedOutputs: counted.countedOutputs,
      skillOutputs: reply.skillOutputs,
      countedSkillOutputs: counted.countedSkillOutputs,
      configWritten: stageConfig(stage),
      customModsWritten,
      computedWithCustomMods,
      configEffective: checked.configEffective,
      pobWarnings: checked.pobWarnings,
      v1: checked.v1,
      v2: checked.v2,
      // D-377: each group's resolved minion selection, which D-378's figure reads.
      minionSkills: reply.minionSkills.map((m) => ({
        group: m.group,
        activeSkill: m.activeSkill,
        ...(m.summon !== undefined ? { summon: m.summon } : {}),
        minion: m.minion,
        minionId: m.minionId,
        name: m.name,
        index: m.index,
        statSet: m.statSet,
        statSets: [...m.statSets],
        skills: [...m.skills],
      })),
    };
    // D-353: the endgame measures, a card skeleton's pace measures included (D-407); D-358: the anoint's recipe.
    if (measuredStage(stage)) stages[stage.id].measures = stageMeasures(stage, stages[stage.id], arbiterHits, check.gemTexts);
    const anoint = anoints.get(stage.id);
    if (anoint !== undefined) {
      stages[stage.id].anoint = { notable: anoint.notable, node: anoint.node, recipe: [...anoint.recipe], emotions: [...anoint.emotions] };
    }
    // D-402: the tamed beast, its DPS and reserved Spirit, and how each kept modifier was applied.
    const companion = companions.get(stage.id);
    const companionCheck = companionChecks.get(stage.id);
    if (companion !== undefined && companionCheck !== undefined && reply.companion !== undefined) {
      stages[stage.id].companion = companionRecordOf(companion, companionCheck, reply.companion, stages[stage.id]);
    }
  }
  const ledger: CompileRecord['ledger'] = {};
  const evaluated = evaluateLedger(plan.ledger, { stageIds: plan.stages.map((s) => s.id), stages: numbers });
  const formulas = new Map(plan.ledger.map((e) => [e.id, e.formula]));
  for (const [id, res] of Object.entries(evaluated)) {
    ledger[id] = {
      value: res.value,
      error: res.error ? ledgerErrorText(res.error) : null,
      computedWithCustomMods: formulaReadsStages(formulas.get(id) ?? '', marked),
    };
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
    buildSha1: loaded.buildSha1,
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
  const mains = Object.fromEntries(results.map(({ stage }) => [stage.id, stage.skills.main]));
  return { planPath: request.planPath, record, written, replacedFile, mains };
}

/**
 * `guide_run {validate}` (C-50): §3.6 step 2 and step 5, nothing else; the build is unchanged. The
 * producers the earned config names that the game data lacks are listed (V2's `producer-unknown`).
 */
export async function validatePlanFile(
  env: Pick<CompilerEnv, 'ctx' | 'guidesDirectory'> & { referenceData: () => PlanReferenceData },
  planPath: string,
  subset?: readonly string[],
): Promise<{ stages: string[]; unknownProducers: { kind: string; name: string }[] }> {
  const refData = env.referenceData();
  const loaded = await loadPlan(env.guidesDirectory, planPath, refData, subset);
  // D-402: a companion is checked as the compile checks it: its species, its Tame Beast gem and its condition options.
  const companions = companionPlansOf(loaded.compiled, refData);
  const stages = loaded.compiled.map((s) => {
    const companion = companions.get(s.id);
    return { stage: withCompanionConditions(s, companion), companion };
  });
  const check = await env.ctx.client.compileCheck({
    className: loaded.plan.roll.className,
    ascendancy: loaded.plan.roll.ascendancy,
    stages: stages.map((x) => checkStageOf(x.stage, x.companion)),
    producers: producersOf(stages.map((x) => x.stage)),
  });
  if (check.defects.length > 0) {
    throw new CompileError(
      `Plan ${planPath} has ${check.defects.length} defect${check.defects.length === 1 ? '' : 's'}:\n${check.defects.join('\n')}`,
    );
  }
  // C-50: unknown producers are listed, not defects (V2 reports them at compile time, D-221).
  const unknownProducers = check.producers.filter((p) => !p.exists).map(({ kind, name }) => ({ kind, name }));
  return { stages: loaded.compiled.map((s) => s.id), unknownProducers };
}
