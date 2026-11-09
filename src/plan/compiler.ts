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
 *     source's group (`rolledGroup`) is created in PoB's Full DPS, and every other group out of it, in both
 *     modes (D-293, D-337); every group with a plan `count` gets it as its Count (`groupCount`, D-493), the
 *     named source's 1 when it has none; the custom modifiers go into PoB's `customMods`
 *     option after the listed config options (D-293);
 *  8. `compile_finish` checks the loadouts, selects the highest stage's and saves its level in auto mode;
 *     every item set is compared with the plan again;
 *  9. the build is exported, every listed config option PoB's save left out is put back into its set and
 *     checked (D-248), and the XML is encoded as an import code (C-42);
 * 10. final: the builds-folder file through C-17, then its write-ledger entry (D-479: its `baseSha1` the sha1
 *     written), then a copy of the bytes beside the plan, `final-build.xml` (a campaign's `final-build-campaign.xml`),
 *     the base a read-back of the final file compares with; measure-only: the XML beside the plan;
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
 * WU-93 (amendment 9): a card skeleton (an endgame stage with no `variant`) gets the budget rung's reference hits, the
 * T15 map hit, as `withReferenceHits` fills them for the rungs (D-423), so its Effective HP compares with theirs; and
 * every stage's record gives `requirements`, the highest level requirement among its items and gems and what sets it
 * (D-413, `stageRequirements`). A plan's `tree.needs` (schema 6, D-418) compiles as written: the compile reads no need.
 *
 * WU-102 (D-426, D-427, §24.2): a group's `weaponSet` goes to `compile_stage` with the set's slot it is socketed in,
 * so PoB enables it only while that set is active, and a group on set 2 makes its stage one that uses set 2; such a
 * stage's record gains `skillOutputsSet2` beside `skillOutputs`. The slot is the set's one whose item grants no skill
 * (`groupSlots`, from `compile_check`'s `weaponGrants`; PG-74: PoB gives an item's granted skill the supports of every
 * group in its slot), the main hand when both do (V1's `weapon-skill-supports`), and stages whose items pick different
 * slots never share a skill set. Every measured stage's clear measure gains `travel`, from `compile_stage`'s
 * `travelSkills` (`travelOf`). V1 reports a group on a set whose weapon slots are empty.
 *
 * WU-111 (amendment 11 §5, §8, §9b; D-437, D-440, D-447): each endgame variant stage is measured a second time against a
 * Pinnacle boss (`compile_stage`'s `boss`: the named source's and the boss rotation's groups, with only `enemyIsBoss` set
 * to `Pinnacle`); a rotation entry whose active skill or stat set PoB's boss measure lacks errs at
 * `stages[n].skills.boss.entries[k]`, and `compile_check` checks each entry as it checks the main selection. The record's
 * measures gain `damage`, `cull`, `trigger`, `sourceTypes` and `bossGroups` (`sourceMeasures`), the ledger's context each
 * stage's `bossGroups` and `damageBoss` (C-33's `boss.` references), and the key-figure line the damage figure. The
 * measured fields gain `CastRate`, `Cooldown`, `CullPercent` and `CullMultiplier` (`MEASURE_FIELDS`). V1 gains
 * `movement-tier` (schema 7 only), reading `compile_check`'s movement-speed tiers, each item's movement speed and rarity,
 * and the stage's travel skill. The plan's new fields (`skills.cull`, `skills.engagement`, `skills.boss`,
 * `items.bootsException`) don't change PoB's sets, so the sets are grouped without them.
 *
 * WU-120 (amendment 12 §4, §9; D-449, D-454): the measure passes grow (`stageParams`' `measure`, from `measureDataOf`).
 * On `b` and `n` the Pinnacle pass also gives its max hits and immune types, the chances at the Arbiter's accuracy and,
 * for a build that deflects there, the max hits with every hit deflected (the G9 spike's `pass`); every variant stage
 * has a resisting measure (the named source with the enemy's fire, cold and lightning resistance at the waystone
 * modifier's top roll) and `n` the conditioned read. Each pass puts its options back. The record's measures gain
 * `toughness`, the Arbiter rows' hits survived and `avoid`, and `damage.resisting`; the key-figure line the resisting
 * figure, the lowest max hit and, on a rung with `avoid`, hits survived.
 *
 * WU-128 (amendment 13; D-463, D-464, D-469, D-471): `compile_check` opens the start a socketed Split Personality names when
 * the stage reaches its socket without it (any schema), and V1's `tree-shape` counts that start; on schema 9 a pinned
 * weapon's Swap slot (`sameAs`) is checked with the text it shares and built as that one item in both slots (`slotTexts`), a
 * corrupted skill gem gets PoB's corruption state, and each custom modifier's reason goes in as the comment line
 * `# <reason>` before its line (`customModReasons`), which `compile_check` refuses when PoB would parse it whole. V1 gains
 * `corruption`. What reads the custom lines (the estimate mark, `custom-defence`, `customModsWritten`) reads the lines alone.
 *
 * Amendment 14 (D-479, D-487, D-488): besides the compile and the draft mode, `compile_plan`'s read-back (`readBackFile`),
 * adopt (`adoptFile`) and notes (`writeNotes`) modes run with no engine, and its trade-links mode (`writeTradeLinks`) as a
 * `load` of the final compile's copy; see their own comments at the end of this file.
 *
 * WU-161 (amendment 16 §13 to §15; D-518, D-519's compile part, C-41): a read plan, `plan_from_build`'s. Its
 * `config.file` is written as the file set it (`fileConfig`; `stageConfig` leaves out every option it sets, and the stage
 * gets no reference hit, `withReferenceHits`); V2's findings on it are callouts (`kind: 'from-file'`). A measure-only
 * compile's `measureAs` (`measure_as: "non-budget"`) gives each read stage (`source`, no `variant`) that rung's passes
 * (`measuredRung`): the boss pass with the Arbiter read, the resisting and conditioned reads, and the toughness read at
 * the rung's reference hits (`fileStageHits`), each putting the file's configuration back; the stage keeps no variant, so
 * V1's rung rules don't apply, and the record gives it `measuredAs` and that rung's measures. A read stage's record gains
 * `spirit`, the Spirit question's figures. Owned content (an item, tree jewel or group marked `owned`) keeps its quality,
 * is measured though PoB marks it legacy or no longer obtainable (the owned-legacy exemption), and passes V1's `sockets`,
 * `affix-cap`, `corruption` and `movement-tier`; the record lists it (`owned`). A group with `switch` is written disabled
 * and marked for PG-106's recount, measured once more with its `off` groups off (`switches`), and V1 reports
 * `switched-spirit` for one that leaves Spirit below 0.
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
  GrantedQuality,
  CompileFinishResult,
  CompileStageParams,
  CompileStageResult,
  SlotItem,
  StageSetRef,
  WeaponFlags,
} from '../engine/schemas.js';
import { ITEM_SLOTS } from '../server/toolSchemas.js';
import { BuildFileWriteError, type BuildFileWriter, type WriteGuard } from '../services/buildFileWriter.js';
import { escapeNotes, replaceNotesXml } from '../services/buildExportService.js';
import { tradeQueryUrl } from '../trade/links.js';
import {
  COMPLEXITY_BUDGET,
  COMPLEXITY_HEADROOM,
  dropLowestWeighted,
  estimateComplexity,
  weightedFilterCount,
  type TradeQueryBody,
} from '../trade/prefit.js';
import { EngineActionError } from '../pobLuaBridge.js';
import { encodePobCode } from '../utils/buildCode.js';
import { checkGuidesRoot, realPathInGuides, resolveInGuidesRoot, runFolderOf } from '../utils/guidesPath.js';
import { canonicalBuildPath } from '../utils/pathSanitizer.js';
import { buildSha1 } from './buildHash.js';
import { evaluateLedger, ledgerErrorText, type StageOutputs } from './ledger.js';
import {
  ARBITER_FILE,
  ARBITER_VARIANTS,
  BOSS_MEASURE_FIELDS,
  bossMeasureGroups,
  decidingRow,
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
  stageRequirements,
  travelOf,
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
  COMMENT_LINES_SINCE,
  CUSTOM_MODS_OPTION,
  GRANTED_QUALITY_SINCE,
  RESPEC_UNTIL,
  validatePlan,
  type Plan,
  type PlanError,
  type PlanReferenceData,
  type PlanVariant,
  type Stage,
} from './schema.js';
import type { SourceTag } from './sourceTag.js';
import { restoreConfigInputs, savedConfigProblems, type ConfigSetInputs } from './savedConfig.js';
import {
  freeForBuild,
  ledgerEntryFor,
  readWriteLedger,
  updateWriteLedger,
  withLedgerEntry,
  withoutLedgerEntry,
  writtenEntry,
  type WriteLedger,
  type WriteLedgerEntry,
} from './writeLedger.js';
import { loadConfigBaseline, type ConfigBaseline } from './checks/configBaseline.js';
import { checkV1, DEFENCE_CHECKS_SINCE, groupWeaponSlot, predecessorOf, type WeaponGrants } from './checks/v1.js';
import { checkV2, producerKey } from './checks/v2.js';
import { compareBuilds, parsePobXml, readBackSummary, type ReadBackFile, type ReadBackNames } from '../services/readBack.js';

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

/**
 * A compile (C-41): measure-only, or final. D-519 (WU-161): a measure-only compile's `measureAs` measures each compiled
 * read stage (`source`, no `variant`) as that rung is measured (`measuredRung`). A final compile with `firstFree` (D-466: a build's first final write, or
 * its campaign's) cleans `buildName` and writes the first free of `<name>`, `<name> <run date>` and
 * `<name> <run date> <k>` (`firstFreeName`).
 */
export type CompileRequest =
  | { mode: 'measure-only'; planPath: string; stages?: string[]; measureAs?: PlanVariant }
  | { mode: 'final'; planPath: string; buildName: string; firstFree?: boolean };

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
 * stages naming different beasts, or one and none, never share a skill set. WU-102 (PG-74): on a stage with a group on
 * a weapon set, it includes each group's weapon slot (`slotsOf`, the compiler's pick from the stage's items), so stages
 * whose items put a group in different slots never share one; a stage with none keeps its key as before.
 */
function groupingKey(
  kind: ContentKind,
  stage: Stage,
  beastOf?: (stageId: string) => string | undefined,
  slotsOf?: (stage: Stage) => (string | null)[],
): string {
  if (kind === 'item') return stableText(setContent(stage).items);
  if (kind !== 'skill') return stableText(CONTENT_OF[kind](stage));
  const skills = setContent(stage).skills;
  const onSet = slotsOf !== undefined && stage.skills.groups.some((g) => g.weaponSet !== undefined);
  if (stage.companion === undefined && !onSet) return stableText(skills);
  return stableText({
    ...skills,
    ...(stage.companion !== undefined ? { companion: beastOf?.(stage.id) ?? stage.companion.species } : {}),
    ...(onSet ? { slots: slotsOf!(stage) } : {}),
  });
}

/**
 * WU-111 (schema 7): a stage's items and skills without the fields that don't change PoB's sets (`items.bootsException`,
 * `skills.cull`, `skills.engagement`, `skills.boss`), so stages differing only in them share a set, as a schema-6 plan's do.
 */
function setContent(stage: Stage): { items: Omit<Stage['items'], 'bootsException'>; skills: Omit<Stage['skills'], 'cull' | 'engagement' | 'boss'> } {
  const { bootsException: _boots, ...items } = stage.items;
  const { cull: _cull, engagement: _engagement, boss: _boss, ...skills } = stage.skills;
  return { items, skills };
}

/**
 * WU-102 (D-426, PG-74): each of a stage's groups' weapon slot, the compiler's pick from the stage's weapon slots whose
 * item grants a skill (`groupWeaponSlot`); null for a group on both sets (no slot).
 */
export function groupSlots(stage: Pick<Stage, 'skills'>, grants: WeaponGrants = {}): (string | null)[] {
  return stage.skills.groups.map((g) => (g.weaponSet === 1 || g.weaponSet === 2 ? groupWeaponSlot(g.weaponSet, grants) : null));
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
  slotsOf?: (stage: Stage) => (string | null)[],
): Record<ContentKind, { groups: SetGroup[]; groupOf: Map<string, number> }> {
  const out = {} as Record<ContentKind, { groups: SetGroup[]; groupOf: Map<string, number> }>;
  for (const kind of CONTENT_KINDS) {
    const byKey = new Map<string, number>();
    const groups: { kind: ContentKind; first: Stage; stageIds: string[] }[] = [];
    const groupOf = new Map<string, number>();
    for (const stage of stages) {
      const key = groupingKey(kind, stage, beastOf, slotsOf);
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

/**
 * Every option a stage lists, earned then scenario: option → value (C-32). D-519 (WU-161): an option the stage's
 * `config.file` sets is left out, so the file's input, which the compile writes after these, is never overridden.
 */
export function stageConfig(stage: Pick<Stage, 'config'>): Record<string, ConfigValue> {
  const out: Record<string, ConfigValue> = {};
  const file = stage.config.file;
  for (const e of [...stage.config.earned, ...stage.config.scenario]) {
    if (file === undefined || !Object.prototype.hasOwnProperty.call(file, e.option)) out[e.option] = e.value;
  }
  return out;
}

/**
 * D-519 (WU-161): what the compile writes into a stage's config set: its listed options (`stageConfig`), then a read
 * plan's `config.file` inputs as the file set them (the custom modifiers' text among them). The record's `configWritten`.
 */
export function writtenConfig(stage: Pick<Stage, 'config'>): Record<string, ConfigValue> {
  return { ...stageConfig(stage), ...(stage.config.file ?? {}) };
}

/** D-519 (amendment 16 §13, Appendix A.5): a read stage, one `plan_from_build` wrote: it names its `source`. */
export function isReadStage(stage: Pick<Stage, 'source'>): boolean {
  return stage.source !== undefined;
}

/**
 * D-519 (amendment 16 §15; WU-161): the rung a stage is measured as: its own `variant`, else, on a read stage, the
 * measure-only compile's `measureAs` (`measure_as`), which gives it that rung's passes without a variant (so V1's rung
 * rules don't apply); else none.
 */
export function measuredRung(stage: Pick<Stage, 'variant' | 'source'>, measureAs?: PlanVariant): PlanVariant | undefined {
  if (stage.variant !== undefined) return stage.variant;
  return measureAs !== undefined && isReadStage(stage) ? measureAs : undefined;
}

/**
 * D-519 (WU-161): the reference hits a stage is measured at without writing them: on a stage whose configuration is the
 * file's (`config.file`) with a rung (`measuredRung`), that rung's five hits (`referenceHits`), option → value, for the
 * toughness read and the conditioned read; none otherwise.
 */
export function fileStageHits(stage: Pick<Stage, 'config'>, rung: PlanVariant | undefined, ref: PlanReferenceData): Record<string, number> | undefined {
  if (stage.config.file === undefined || rung === undefined) return undefined;
  return Object.fromEntries(referenceHits(rung, ref).map((e) => [e.option, e.value as number]));
}

/**
 * D-519 (amendment 16 §15, Appendix A.8; WU-161): the record's `owned`: the stage's slots holding owned content, its item
 * slots in plan order, then each owned tree jewel's `Jewel <node>`; undefined when it holds none.
 */
export function ownedSlots(stage: Pick<Stage, 'items'>): string[] | undefined {
  const out = [
    ...stage.items.slots.filter((s) => s.owned === true).map((s) => s.slot as string),
    ...stage.items.treeJewels.filter((j) => j.owned === true).map((j) => `Jewel ${j.node}`),
  ];
  return out.length > 0 ? out : undefined;
}

/**
 * D-518 (amendment 16 §14; WU-161): each switched group's measure request: its group (from 1), its `off` list, and the
 * weapon set it is measured on: the group's own set when it has one, else the set the stage is measured on (a
 * proceed-on: on a stage measured on set 2, set 2).
 */
export function switchesOf(stage: Pick<Stage, 'skills' | 'items'>): Array<{ group: number; off: number[]; set: 1 | 2 }> {
  return stage.skills.groups.flatMap((g, k) =>
    g.switch === undefined
      ? []
      : [{ group: k + 1, off: [...g.switch.off], set: (g.weaponSet ?? (stage.items.useSecondWeaponSet ? 2 : 1)) as 1 | 2 }],
  );
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

/**
 * What `compile_check` reads of a stage; with its companion (D-402), the beast's species and lines. WU-111 (D-447): with
 * the stage's index in the plan, its boss rotation's entries, each with its path (`stages[n].skills.boss.entries[k]`).
 * WU-128 (amendment 13): a pinned weapon's Swap slot is checked with the text of the slot it shares (D-464, `slotTexts`),
 * and, with the plan's schema version, a schema-9 stage's custom modifier reasons, whose comment lines PoB must not parse
 * whole (D-469, `customModReasons`). WU-154 (D-512): from schema 11 each gem's quality, which `compile_check` refuses above
 * 0 on a skill the stage's items or allocated passives grant; an older plan's gems go without it. WU-161 (D-519): an owned
 * item, tree jewel or group carries `owned`, so its content PoB marks legacy or no longer obtainable is measured.
 */
export function checkStageOf(stage: Stage, companion?: CompanionPlan, planIndex?: number, schemaVersion?: number): CompileCheckStage {
  const bossEntries = (stage.skills.boss?.entries ?? []).map((e, k) => ({
    at: `stages[${planIndex ?? '?'}].skills.boss.entries[${k}]`,
    group: e.group,
    activeSkill: e.activeSkill,
    statSet: e.statSet,
  }));
  const withQuality = schemaVersion !== undefined && schemaVersion >= GRANTED_QUALITY_SINCE;
  return {
    id: stage.id,
    nodes: stage.tree.nodes,
    ascendancyNodes: stage.tree.ascendancyNodes,
    weaponSets: { set1: stage.tree.weaponSetNodes.set1, set2: stage.tree.weaponSetNodes.set2 },
    attributeChoices: stage.tree.attributeChoices,
    jewels: stage.items.treeJewels,
    items: slotTexts(stage),
    groups: stage.skills.groups.map((g) => ({
      gems: g.gems.map((gem) => ({ name: gem.name, enabled: gem.enabled, ...(withQuality ? { quality: gem.quality } : {}) })),
      ...minionFields(g),
      // D-519 (WU-161): an owned group's legacy gem is measured, not refused (the owned-legacy exemption).
      ...(g.owned === true ? { owned: true } : {}),
    })),
    main: stage.skills.main,
    // D-519: the listed options only; a read plan's file inputs are written as PoB's load writes them, unchecked.
    config: Object.entries(stageConfig(stage)).map(([option, value]) => ({ option, value })),
    customMods: customModLines(stage),
    ...withCustomModReasons(stage, schemaVersion),
    ...(stage.items.anoint !== undefined ? { anoint: stage.items.anoint.notable } : {}),
    ...(companion !== undefined ? { companion: companionCheckOf(stage, companion) } : {}),
    ...(bossEntries.length > 0 ? { bossEntries } : {}),
  };
}

/**
 * D-464 (schema 9): the stage's filled slots, each with its item's text: a pinned weapon's Swap slot (`sameAs`) has the
 * text of the set-1 slot it shares, and keeps `sameAs` so `compile_stage` puts that one item in both slots. In plan order.
 * D-519 (WU-161): an owned item carries `owned` (it keeps its text's quality; compile_check measures it if PoB says it is
 * no longer obtainable).
 */
export function slotTexts(stage: Pick<Stage, 'items'>): Array<{ slot: string; text: string; sameAs?: string; owned?: boolean }> {
  const texts = new Map(stage.items.slots.flatMap((s) => (s.text !== undefined ? [[s.slot as string, s.text] as const] : [])));
  return stage.items.slots.map((s) => ({
    ...(s.sameAs !== undefined ? { slot: s.slot, text: texts.get(s.sameAs) ?? '', sameAs: s.sameAs } : { slot: s.slot, text: s.text ?? '' }),
    ...(s.owned === true ? { owned: true } : {}),
  }));
}

/** D-377: a group's minion skill and its stat set, as the engine actions take them (absent when it names none). */
function minionFields(g: Stage['skills']['groups'][number]): { minionSkill?: string; minionStatSet?: number } {
  return {
    ...(g.minionSkill !== undefined ? { minionSkill: g.minionSkill } : {}),
    ...(g.minionStatSet !== undefined ? { minionStatSet: g.minionStatSet } : {}),
  };
}

/**
 * WU-154's fix round (D-512, plan schema 11): the stage with each gem `compile_check` names (`grantedQualities`: a skill
 * the stage's wand, staff or sceptre grants, on the plan's copy that carries its supports, PG-108) at its item's quality,
 * as the game gives it. The refusal holds the plan's copy at 0, and PoB measures that copy, so the compile writes the
 * item's quality on it, in the file it composes too. Without entries the stage is unchanged.
 */
export function withGrantedQuality<S extends Pick<Stage, 'skills'>>(stage: S, entries: readonly GrantedQuality[] | undefined): S {
  if (entries === undefined || entries.length === 0) return stage;
  const groups = stage.skills.groups.map((g, gi) => ({
    ...g,
    gems: g.gems.map((gem, k) => {
      const hit = entries.find((e) => e.group === gi + 1 && e.gem === k + 1);
      return hit === undefined ? gem : { ...gem, quality: hit.quality };
    }),
  }));
  return { ...stage, skills: { ...stage.skills, groups } };
}

/** D-293: a stage's custom modifier lines, `config.customMods` texts in plan order (none for a version-1 plan). */
export function customModLines(stage: Pick<Stage, 'config'>): string[] {
  return (stage.config.customMods ?? []).map((m) => m.text);
}

/**
 * D-469 (schema 9): each custom modifier's reason, in the order of `customModLines` (a companion's lines included, D-402),
 * which the engine writes as the comment line `# <reason>` before the line in PoB's `customMods` text, and which
 * `compile_check` refuses when PoB would parse that comment whole as a modifier. `''` for an entry without a reason (none
 * on schema 9, whose reasons are required). Undefined before schema 9, or with no custom modifier: the text is the lines
 * alone, as before. What reads the custom lines (the estimate mark, `custom-defence`) reads `customModLines`, never the
 * comments.
 */
export function customModReasons(stage: Pick<Stage, 'config'>, schemaVersion: number | undefined): string[] | undefined {
  const mods = stage.config.customMods ?? [];
  if (schemaVersion === undefined || schemaVersion < COMMENT_LINES_SINCE || mods.length === 0) return undefined;
  return mods.map((m) => m.reason ?? '');
}

function withCustomModReasons(stage: Pick<Stage, 'config'>, schemaVersion: number | undefined): { customModReasons?: string[] } {
  const reasons = customModReasons(stage, schemaVersion);
  return reasons !== undefined ? { customModReasons: reasons } : {};
}

/**
 * D-293, D-321: whether the stage is measured with custom modifiers present, so its figures carry the mark:
 * its written config holds PoB's `customMods` option with text, whatever its source. That is
 * `config.customMods`, or, in a version-1 plan (D-332), an `earned` or `scenario` entry for the option, or (D-519) a read
 * plan's `config.file` input. An
 * empty value clears the option (`BuildOps.lua`'s `config_value`), and blank text adds no modifier.
 */
export function measuredWithCustomMods(stage: Pick<Stage, 'config'>): boolean {
  if (customModLines(stage).length > 0) return true;
  // D-519: a read plan's file holds its custom modifiers in its customMods input.
  const listed = writtenConfig(stage)[CUSTOM_MODS_OPTION];
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
 * WU-120 (amendment 12 §4, §9; D-449, D-454): the data the new measure passes read: the Arbiter's accuracy
 * (`enemies/arbiter-of-divinity.json#base.accuracy`, monster level 79), at which the Pinnacle pass reads the chances at
 * the Arbiter on `b` and `n`, and the enemy's fire, cold and lightning resistance of the resisting figure, the top roll of
 * the waystone modifier (`enemies/waystones.json#mods.monster-elemental-resistance`, 35 to 40).
 */
export interface MeasureData {
  arbiterAccuracy: number;
  resist: number;
}

/** WU-120: the measure data from the reference data (`MeasureData`); a missing fact stops the compile, naming it. */
export function measureDataOf(ref: PlanReferenceData): MeasureData {
  const fact = (file: string, key: string, what: string): number => {
    const found = ref.resolveFact(file, key);
    if (!found.ok) throw new CompileError(`${what} needs ${file}#${key}: ${found.reason}. Nothing was compiled.`);
    const v = found.fact.value as unknown;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && v !== null && typeof (v as { max?: unknown }).max === 'number') return (v as { max: number }).max;
    throw new CompileError(`${what} needs a number at ${file}#${key}. Nothing was compiled.`);
  };
  return {
    arbiterAccuracy: fact(ARBITER_FILE, 'base.accuracy', 'the chances at the Arbiter (D-449)'),
    resist: fact(WAYSTONES, 'mods.monster-elemental-resistance', 'the resisting figure (D-454)'),
  };
}

/**
 * D-423: the rung whose reference hits a card skeleton (an endgame stage with no `variant`, `measuredStage`) is
 * measured against: the budget rung's, the T15 map hit, so the verification gate's Effective HP compares with the
 * design gate's.
 */
export const SKELETON_HIT_RUNG: PlanVariant = 'budget';

/** The rung whose reference hits a stage gets (D-353, D-423): its own variant's, a skeleton's `b`'s, else none. */
export function referenceHitRung(stage: Pick<Stage, 'variant' | 'progress'>): PlanVariant | undefined {
  if (stage.variant !== undefined) return stage.variant;
  return measuredStage(stage) ? SKELETON_HIT_RUNG : undefined;
}

/**
 * D-353: an endgame stage with every reference hit its scenario omits added from the data (`referenceHits`), so
 * it is written, grouped (A-P2) and checked like a listed one; a hit the plan lists, as earned or scenario, keeps
 * its own value. D-423: a card skeleton gets the budget rung's hits (`referenceHitRung`). D-519: a stage with
 * `config.file` gets none. Any other stage is returned as it is.
 */
export function withReferenceHits(stage: Stage, ref: PlanReferenceData): Stage {
  // D-519 (WU-161): a stage whose configuration is the file's (`config.file`) is written as set; a rung's hits are read
  // in its toughness read instead (`fileStageHits`).
  if (stage.config.file !== undefined) return stage;
  const rung = referenceHitRung(stage);
  if (rung === undefined) return stage;
  const listed = stageConfig(stage);
  const missing = REFERENCE_HITS.filter((h) => listed[h.option] === undefined);
  if (missing.length === 0) return stage;
  const filled = referenceHits(rung, ref).filter((e) => missing.some((h) => h.option === e.option));
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
 *
 * WU-111 (amendment 11 §5, D-437): on a stage whose measures hold `damage` (an endgame variant), the line leads with the
 * named source's damage figure, `damage <map> against map monsters, <boss> against a Pinnacle boss` (the measures'
 * `damage`, PoB alone), the map figure followed by `(culling at <x>%)` when it carries the cull and the boss figure by
 * the minion's name when a minion deals it; a campaign stage and a card skeleton keep `DPS <n>`.
 * A named source a meta gem triggers (`measures.trigger`) adds `<skill> is triggered by <gem>: PoB rates it at its
 * hand-cast speed (<n> a second) and doesn't model Energy`, on a skeleton too.
 *
 * WU-120 (amendment 12 §4, §9, Appendix A; D-449, D-454): the damage part becomes `damage <map> against map monsters,
 * <resisting> against resisting rares, <boss> against a Pinnacle boss` when the record has the resisting figure (an older
 * record keeps two figures); `lowest max hit <n> <type>` follows `EHP <n>` when the measures have `toughness`; the
 * Arbiter part names the rung's deciding row (`decidingRow`: its one-shot row with the lowest hits survived, else the
 * worst), and on a rung with `avoid` it is followed by `hits survived <x>%`, the deciding row's, rounded down to a whole
 * percent so no figure rounds up across the floor.
 */
export function keyFigureLine(rec: StageRecord, main: Stage['skills']['main']): string {
  const o = rec.outputs;
  const dps = headlineDps({ skills: { main } }, rec);
  const variantMeasures = rec.measures?.dps !== undefined ? rec.measures : undefined;
  const ehp = variantMeasures !== undefined ? variantMeasures.ehp : o.TotalEHP;
  const minion = minionSkillOf(rec, main.group);
  const source = figureField(rec, main) === 'MinionTotalDPS' ? (minion?.name ?? rec.skillOutputs[selectionKey(main)]?.skill) : undefined;
  const minionTag = source !== undefined ? ` (${source}, minion)` : '';
  const damage = rec.measures?.damage;
  const cull = rec.measures?.cull;
  const toughness = rec.measures?.toughness;
  const low = toughness?.lowestMaxHit;
  const parts = [
    damage !== undefined
      ? `damage ${whole(damage.map)} against map monsters${cull !== undefined ? ` (culling at ${whole(cull.map)}%)` : ''}, ` +
        (damage.resisting !== undefined ? `${whole(damage.resisting)} against resisting rares, ` : '') +
        `${whole(damage.boss)} against a Pinnacle boss${minionTag}`
      : `DPS ${whole(dps)}${minionTag}`,
    `life ${whole(o.Life)}`,
    `ES ${whole(o.EnergyShield)}`,
    `EHP ${whole(ehp)}`,
    ...(toughness !== undefined ? [low === null || low === undefined ? 'lowest max hit ?' : `lowest max hit ${whole(low.value)} ${low.type}`] : []),
    `resists ${['FireResist', 'ColdResist', 'LightningResist', 'ChaosResist'].map((k) => whole(o[k])).join('/')} (fire/cold/lightning/chaos)`,
    `findings V1 ${rec.v1?.findings.length ?? '?'}, V2 ${rec.v2?.findings.length ?? '?'}`,
  ];
  const arbiter = rec.measures?.arbiter;
  if (arbiter !== undefined) {
    const row = decidingRow(arbiter);
    const of = row === null ? '' : row.ratio === null ? `max hit ${whole(row.maxHit)}` : `${row.ratio.toFixed(2)} of max hit`;
    const at = row === null ? '' : ` (worst: ${row.type} hit ${row.hitId}, ${of})`;
    parts.push(`Arbiter ${arbiter.verdict ?? 'unknown'}${at}`);
    if (arbiter.avoid !== undefined) {
      const survived = row?.hitsSurvived;
      parts.push(`hits survived ${typeof survived === 'number' ? Math.floor(survived + 1e-9) : '?'}%`);
    }
  }
  if (variantMeasures !== undefined) parts.push(`clear ${variantMeasures.clearSpeed.speed} (rough)`);
  const trigger = rec.measures?.trigger;
  if (trigger !== undefined) {
    const named = rec.skillOutputs[selectionKey(main)]?.skill ?? 'the named source';
    const rate = trigger.usesPerSecond === null ? 'unknown' : String(Math.round(trigger.usesPerSecond * 100) / 100);
    parts.push(`${named} is triggered by ${trigger.by}: PoB rates it at its hand-cast speed (${rate} a second) and doesn't model Energy`);
  }
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
async function writeBesidePlan(guidesDirectory: string, planPath: string, loaded: Pick<LoadedPlan, 'realDir'>, name: string, data: string): Promise<void> {
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
  /** The build name written: `buildName`, or under `first_free` the free name chosen (D-466). */
  name: string;
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
 * (this run's entry, another sha1). C-17's own guard still applies. With `firstFree` (D-466), the target is
 * the first free name for this build (`firstFreeName`), which is new or this build's own unchanged file.
 */
async function checkTarget(
  env: CompilerEnv,
  buildName: string,
  runFolder: string,
  firstFree?: { plan: string },
): Promise<TargetCheck> {
  const ledger = await readWriteLedger(env.stateDir);
  const name = firstFree ? await firstFreeName(env.pobDirectory, ledger, buildName, runFolder, firstFree.plan) : buildName;
  const rel = await canonicalBuildPath(name, env.pobDirectory);
  const current = await readIfExists(path.join(path.resolve(env.pobDirectory), ...rel.split('/')));
  if (current === null) {
    const guard = await env.writer.checkBuildFile({ name, kind: 'engine' });
    return { name, rel, guard, overwrite: false, existingSha1: null };
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
  // D-479, D-487: the ledger vouches for these bytes (the server's own write: a compile, the notes write, an adoption),
  // so C-17's guard is asked as for a byte copy, which also accepts the writer's own last write to the file. Asked as
  // the engine's save, it would accept only the engine's fingerprint of the file it loaded at the last final compile,
  // and refuse every re-compile after a notes write or an adoption.
  const guard = await env.writer.checkBuildFile({ name, kind: 'bytes', overwrite: true });
  return { name, rel, guard, overwrite: true, existingSha1: currentSha1 };
}

// ---------------------------------------------------------------------------------------------------
// The compile

function setRef(title: string, created: Map<number, number>, group: number): StageSetRef {
  const id = created.get(group);
  return id === undefined ? { title } : { title, reuse: id };
}

/**
 * What `compile_stage` builds for one stage. WU-128 (amendment 13, schema 9): a pinned weapon's Swap slot carries `sameAs`
 * (D-464), a corrupted gem its `corrupt` (D-471), and, with the plan's `schemaVersion`, the custom modifiers their reasons
 * for the comment lines (D-469).
 *
 * WU-161 (amendment 16 §13 to §15; D-518, D-519): `read.rung` is the rung the stage is measured as (`measuredRung`: its
 * variant, or a read stage's `measure_as`), which keys the boss, resisting, Arbiter and conditioned passes as a variant
 * does; `read.referenceHits` (`fileStageHits`) the hits its toughness read sets. A read plan's `config.file` goes as
 * `fileConfig`, an owned item with `owned`, and each switched group (`switch`, written disabled) is marked `switched` and
 * measured once more (`switches`, `switchesOf`).
 */
export function stageParams(
  stage: Stage,
  first: boolean,
  refs: Record<ContentKind, StageSetRef>,
  offenseFields: readonly string[],
  anoint?: string,
  companionId?: string,
  grants?: WeaponGrants,
  measure?: MeasureData,
  schemaVersion?: number,
  read?: { rung?: PlanVariant; referenceHits?: Record<string, number> },
): CompileStageParams {
  const slots = groupSlots(stage, grants);
  const rung = read?.rung ?? stage.variant;
  const switches = switchesOf(stage);
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
    // In PoB's slot order, so a main hand is in place before the off-hand is checked against it, and a set-1 slot before
    // the Swap slot that shares its item (D-464).
    items: slotTexts(stage).sort(
      (a, b) => ITEM_SLOTS.indexOf(a.slot as (typeof ITEM_SLOTS)[number]) - ITEM_SLOTS.indexOf(b.slot as (typeof ITEM_SLOTS)[number]),
    ),
    toggles: stage.items.toggles.map((t) => ({ slot: t.slot, active: t.active })),
    useSecondWeaponSet: stage.items.useSecondWeaponSet,
    skillSet: refs.skill,
    groups: stage.skills.groups.map((g, k) => {
      // D-293, D-337: the named source's group (rolledGroup, D-295) is in PoB's Full DPS in every compile, so the file
      // shows the reader that Full DPS; every other group stays out (D-306). D-493 (amendment 14 §19): every group with a
      // plan `count` gets it as PoB's groupCount, in every stage and both modes, so PoB's own uses of the Count (Spirit
      // reserved × count by a MultipleReservation skill or a totem under Ancestral Bond, Umbral Well's per-minion buff,
      // node power's figure for a pool group) read the plan's; the named source's group always carries one (1 by
      // default). The record applies Count itself (`countedFigures`), so its figures don't move.
      const named = stage.skills.rolledGroup === k + 1;
      const count = g.count ?? (named ? 1 : undefined);
      return {
        ...(g.label !== undefined ? { label: g.label } : {}),
        enabled: g.enabled,
        includeInFullDPS: named,
        ...(count !== undefined ? { groupCount: count } : {}),
        gems: g.gems.map((gem) => ({
          name: gem.name,
          level: gem.level,
          quality: gem.quality,
          enabled: gem.enabled,
          // D-471 (schema 9): PoB's corruption state, so it calculates the gem one level higher.
          ...(gem.corrupt !== undefined ? { corrupt: gem.corrupt } : {}),
        })),
        ...minionFields(g),
        // D-426 (§24.2): the weapon set the group is on, socketed in that set's slot; absent, both sets.
        ...(g.weaponSet !== undefined ? { weaponSet: g.weaponSet, slot: slots[k]! } : {}),
        // D-518 (WU-161): a buff switched as needed, written disabled, carries the switched mark for the recount.
        ...(g.switch !== undefined ? { switched: true } : {}),
      };
    }),
    main: stage.skills.main,
    configSet: refs.config,
    config: stageConfig(stage),
    // D-519 (WU-161): a read plan's configuration as the file set it, written after the listed options.
    ...(stage.config.file !== undefined ? { fileConfig: { ...stage.config.file } } : {}),
    customMods: customModLines(stage),
    // D-469 (schema 9): each line's reason, written as the comment line `# <reason>` before it.
    ...withCustomModReasons(stage, schemaVersion),
    offenseFields: [...offenseFields, ...MEASURE_FIELDS.filter((f) => !offenseFields.includes(f))],
    itemSlots: [...ITEM_SLOTS],
    // D-358: the notable's PoB name, as compile_check resolved it, written on the amulet.
    ...(anoint !== undefined ? { anoint } : {}),
    // D-402: the beast compile_check resolved the companion's species to.
    ...(companionId !== undefined ? { companion: { id: companionId } } : {}),
    // WU-111 (D-437, D-447): an endgame variant stage is measured against a Pinnacle boss too: the named source's group
    // and the boss rotation's, with the measured fields and a minion's ailments. WU-120 (D-449): on `b` and `n` the pass
    // also reads the chances at the Arbiter's accuracy and the deflected max hits.
    ...(rung !== undefined
      ? {
          boss: {
            groups: bossMeasureGroups(stage),
            fields: bossFields(offenseFields),
            ...(measure !== undefined && ARBITER_VARIANTS.includes(rung) ? { arbiter: { accuracy: measure.arbiterAccuracy } } : {}),
          },
        }
      : {}),
    // WU-120 (D-454): an endgame variant stage's named source, against the map enemy with every elemental resistance at
    // the waystone modifier's top roll; (D-449) the conditioned read on `n`. D-519: a read stage measured as a rung too.
    ...(rung !== undefined && measure !== undefined
      ? { resisting: { groups: [stage.skills.main.group], fields: bossFields(offenseFields), resist: measure.resist } }
      : {}),
    ...(rung === 'non-budget' && measure !== undefined ? { conditioned: true } : {}),
    // D-519 (WU-161): the rung's reference hits a file's configuration doesn't hold, for the toughness read.
    ...(read?.referenceHits !== undefined ? { referenceHits: { ...read.referenceHits } } : {}),
    // D-518 (WU-161): each switched buff, measured once more with its off groups off.
    ...(switches.length > 0 ? { switches } : {}),
    // D-518, D-519 (WU-161): a read stage's Spirit question: each buff's reservation on its measured set.
    ...(isReadStage(stage) ? { spiritBuffs: true } : {}),
  };
}

/**
 * The fields the measures read per skill beside C-45's (D-353): the clear skill's area, or its minion's (D-378). WU-111
 * (amendment 11 §5, §9b; D-437, D-447): PoB's `CastRate` (a spell's rate before its cooldown caps it,
 * `CalcOffence.lua`:2843-2863) and `Cooldown` where PoB sets them, since a cooldown skill's `Speed` is capped by its
 * cooldown and its `Time` is `1 / Speed` after the cap; and the named source's `CullPercent` and `CullMultiplier`
 * (`CalcOffence.lua`:3903-3911), which `measures.cull` and the culled map figure read. WU-137 (amendment 14 §17, D-491): a
 * clear skill with no area's chains and projectiles, PoB's `ChainMax` and `ProjectileCount` (`CalcOffence.lua`:1279,
 * :968), and a minion's (D-378), which `measures.clearSpeed` reads.
 */
export const MEASURE_FIELDS: readonly string[] = [
  'AreaOfEffectRadiusMetres',
  'MinionAreaOfEffectRadiusMetres',
  'CastRate',
  'Cooldown',
  'CullPercent',
  'CullMultiplier',
  'ChainMax',
  'ProjectileCount',
  'MinionChainMax',
  'MinionProjectileCount',
];

/** WU-111 (D-447): the fields the boss measure reads per skill: the stage's, then a minion's ailments. */
export function bossFields(offenseFields: readonly string[]): string[] {
  const measured = [...offenseFields, ...MEASURE_FIELDS.filter((f) => !offenseFields.includes(f))];
  return [...measured, ...BOSS_MEASURE_FIELDS.filter((f) => !measured.includes(f))];
}

/**
 * WU-111 (D-447): a stage's boss rotation entries that PoB's boss measure lacks (an active skill or stat set its group
 * doesn't have), one `stages[n].skills.boss.entries[k] (stage <id>): …` line each, naming the group's measured selections.
 */
export function missingBossEntries(stage: Stage, planIndex: number, boss: CompileStageResult['boss']): string[] {
  const entries = stage.skills.boss?.entries ?? [];
  if (entries.length === 0) return [];
  const measured = Object.keys(boss?.skillOutputs ?? {});
  return entries.flatMap((e, k) => {
    const key = selectionKey(e);
    if (boss?.skillOutputs[key] !== undefined) return [];
    const ofGroup = measured.filter((m) => m.startsWith(`g${e.group}s`)).sort();
    return [
      `stages[${planIndex}].skills.boss.entries[${k}] (stage ${stage.id}): group ${e.group} has no active skill ${e.activeSkill} ` +
        `with stat set ${e.statSet} in PoB's measure (D-447); its selections: ` +
        (ofGroup.length > 0 ? ofGroup.map((m) => `${m} ${boss!.skillOutputs[m].skill} / ${boss!.skillOutputs[m].statSetLabel}`).join(', ') : 'none'),
    ];
  });
}

const SET_ID_KEY: Record<ContentKind, 'itemSet' | 'skillSet' | 'configSet'> = {
  item: 'itemSet',
  skill: 'skillSet',
  config: 'configSet',
};

/**
 * WU-119 (amendment 12 §7, D-452): on a schema-8 plan, what a stage's tree changes from the stage before it
 * (`predecessorOf`, which skips temporary stages): `from` its id, `refunded` the nodes that stage holds and this one
 * doesn't, `added` the reverse, counted over the regular and ascendancy nodes alike. Null on a plan of version 7 or
 * earlier (its respec says the same, D-144) and for a stage with none before it.
 */
export function treeChangeOf(plan: Pick<Plan, 'schemaVersion' | 'stages'>, stage: Stage): StageRecord['treeChange'] | null {
  if (plan.schemaVersion <= RESPEC_UNTIL) return null;
  const before = predecessorOf(plan.stages, plan.stages.indexOf(stage));
  if (before === null) return null;
  const nodesOf = (s: Stage) => new Set([...s.tree.nodes, ...s.tree.ascendancyNodes]);
  const had = nodesOf(before);
  const has = nodesOf(stage);
  return {
    from: before.id,
    refunded: [...had].filter((n) => !has.has(n)).length,
    added: [...has].filter((n) => !had.has(n)).length,
  };
}

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
  // D-519 (WU-161): measure_as measures a read stage (one with `source` and no variant) as its rung; a compile with none
  // has nothing for it to measure.
  const measureAs = request.mode === 'measure-only' ? request.measureAs : undefined;
  if (measureAs !== undefined && !preflight.some((s) => isReadStage(s) && s.variant === undefined)) {
    throw new CompileError(
      `measure_as measures a read stage (one plan_from_build wrote: it names its source and has no variant), but none of ` +
        `the stages compiled (${preflight.map((s) => s.id).join(', ')}) is one. Nothing was compiled.`,
    );
  }
  // V2's baseline list (D-230), checked with the plan: an invalid file stops the compile here.
  const baselineList = readConfigBaseline(env);
  // WU-120 (D-449, D-454): the new measure passes' data, read before any engine request.
  const measureData = measureDataOf(refData);

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
    target = await checkTarget(env, request.buildName, runFolder, request.firstFree ? { plan: loaded.relPath } : undefined);
  }

  // 5. The read-only preflight (A-P12).
  const tCheck = env.clock();
  const check = await ctx.client.compileCheck({
    className: checkedPlan.roll.className,
    ascendancy: checkedPlan.roll.ascendancy,
    stages: preflight.map((s) => checkStageOf(s, companions.get(s.id), checkedPlan.stages.indexOf(s), checkedPlan.schemaVersion)),
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
  // D-512 (schema 11): the copy of a skill the stage's wand, staff or sceptre grants takes the item's quality, before the
  // sets are grouped (stages whose items differ in quality keep their own skill sets).
  const qualitiesOf = new Map<string, GrantedQuality[]>();
  if (checkedPlan.schemaVersion >= GRANTED_QUALITY_SINCE) {
    for (const q of check.grantedQualities ?? []) qualitiesOf.set(q.stage, [...(qualitiesOf.get(q.stage) ?? []), q]);
  }
  const plan: Plan = {
    ...checkedPlan,
    stages: checkedPlan.stages.map((s) =>
      withGrantedQuality(withCompanionLines(s, companions.get(s.id), companionChecks.get(s.id)), qualitiesOf.get(s.id)),
    ),
  };
  const compiled = plan.stages.filter((s) => compiledIds.has(s.id));

  // 4. Shared sets (A-P2), after the preflight: a companion's lines are part of its stage's config, and its resolved
  // beast part of its skills.
  // WU-102 (PG-74): each stage's weapon slots whose item grants a skill, which pick a group's weapon-set slot.
  const grantsOf = new Map<string, Record<string, string[]>>();
  for (const g of check.weaponGrants) grantsOf.set(g.stage, { ...grantsOf.get(g.stage), [g.slot]: [...g.skills] });
  const grouped = groupSets(compiled, (id) => companionChecks.get(id)?.id, (s) => groupSlots(s, grantsOf.get(s.id)));

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
    // D-519 (WU-161): the rung the stage is measured as, and on a file's configuration that rung's reference hits.
    const rung = measuredRung(stage, measureAs);
    const hits = fileStageHits(stage, rung, refData);
    const reply = await ctx.client.compileStage(
      stageParams(stage, i === 0, refs, env.offenseFields, anoints.get(stage.id)?.notable, companionChecks.get(stage.id)?.id, grantsOf.get(stage.id), measureData, plan.schemaVersion, {
        ...(rung !== undefined ? { rung } : {}),
        ...(hits !== undefined ? { referenceHits: hits } : {}),
      }),
    );
    const elapsedMs = env.clock() - t;
    // D-447: every boss rotation entry is a selection PoB's boss measure has (compile_check bounded it already).
    const missing = missingBossEntries(stage, plan.stages.indexOf(stage), reply.boss);
    if (missing.length > 0) throw new CompileError(`Plan ${request.planPath} is invalid; nothing was written:\n${missing.join('\n')}`);
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
      // D-452: a schema-8 plan has no tree continuity to check, each loadout's tree its own.
      predecessor: plan.schemaVersion <= RESPEC_UNTIL ? predecessorOf(plan.stages, plan.stages.indexOf(stage)) : null,
      checks: reply.checks,
      ref: refData,
      trees: treesOf.get(stage.id),
      // WU-102 (PG-74): which weapon slots grant a skill, for weapon-skill-supports.
      weaponGrants: grantsOf.get(stage.id) ?? {},
      // D-426: V1's Spirit check reads weapon set 2 too.
      ...(reply.outputsSet2 !== undefined ? { outputsSet2: reply.outputsSet2 } : {}),
      // D-440 (schema 7): the boots' movement-speed tiers, and the stage's travel skill for a travel exception.
      schemaVersion: plan.schemaVersion,
      movementTiers: check.movementTiers ?? [],
      travel: travelOf(stage, reply, reply.travelSkills),
      // D-455 (schema 8): a rung's area level, for curse-level-cap. D-451: the plan's own custom lines, before a
      // companion's (D-402), for custom-defence.
      ...(stage.variant !== undefined && plan.schemaVersion >= DEFENCE_CHECKS_SINCE ? { rungAreaLevel: rungAreaLevel(stage.variant, refData) } : {}),
      planCustomMods: checkedPlan.stages.find((s) => s.id === stage.id)?.config.customMods?.length ?? 0,
      // D-518 (WU-161): each switched buff's measure, for switched-spirit.
      ...(reply.switches !== undefined ? { switches: reply.switches } : {}),
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
      name: target.name,
      bytes: xmlBytes,
      kind: 'engine',
      overwrite: target.overwrite,
      guard: target.guard,
      ctx,
    });
    replacedFile = saved.replaced;
    // At once after the file: a failure later still leaves the entry, so a retry may overwrite (D-211). D-466: the
    // entry names its kind and the plan that wrote it; D-479: its baseSha1 is the sha1 written.
    const entry = writtenEntry({
      path: saved.path,
      sha1: saved.fingerprint.sha1,
      runFolder,
      writtenAt: env.wallClock().toISOString(),
      kind: 'final',
      plan: loaded.relPath,
    });
    await updateWriteLedger(env.stateDir, async (ledger) => ({ ledger: withLedgerEntry(ledger, entry), value: undefined }));
    written.builds.push(saved.path);
    pobFile = { location: 'builds', path: saved.path, sha1: saved.fingerprint.sha1, bytes: saved.bytes };
    // D-479: a copy of the bytes written, beside the record, the base a read-back of the final file compares with.
    const copy = finalCopyFile(plan.stages);
    await writeBesidePlan(env.guidesDirectory, request.planPath, loaded, copy, xml);
    written.guides.push(besideRel(copy));
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
      // D-426: weapon set 2's measure, on a stage that uses it.
      ...(reply.outputsSet2 !== undefined ? { outputsSet2: reply.outputsSet2 } : {}),
      countedOutputs: counted.countedOutputs,
      skillOutputs: reply.skillOutputs,
      // WU-102 (§24.2): every group's figures with weapon set 2 active, on a stage that uses it.
      ...(reply.skillOutputsSet2 !== undefined ? { skillOutputsSet2: reply.skillOutputsSet2 } : {}),
      countedSkillOutputs: counted.countedSkillOutputs,
      // D-519: a read plan's file inputs among them, as written.
      configWritten: writtenConfig(stage),
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
      // D-413: the level the stage works from, and the items or gems that set it.
      requirements: stageRequirements(reply.checks),
    };
    // D-452 (schema 8): what the stage's tree changes from the stage before it.
    const treeChange = treeChangeOf(plan, stage);
    if (treeChange !== null) stages[stage.id].treeChange = treeChange;
    // D-519 (WU-161, Appendix A.8): the slots holding owned content, and the rung a read stage was measured as.
    const owned = ownedSlots(stage);
    if (owned !== undefined) stages[stage.id].owned = owned;
    const rung = measuredRung(stage, measureAs);
    if (stage.variant === undefined && rung !== undefined) stages[stage.id].measuredAs = rung;
    // D-518, D-519 (WU-161): a read stage's Spirit question, from its own measure.
    if (reply.spirit !== undefined) {
      const sp = reply.spirit;
      const spirit = typeof sp.spirit === 'number' && Number.isFinite(sp.spirit) ? sp.spirit : null;
      const unreserved = typeof sp.unreserved === 'number' && Number.isFinite(sp.unreserved) ? sp.unreserved : null;
      stages[stage.id].spirit = {
        weaponSet: sp.set,
        spirit,
        unreserved,
        reserved: spirit !== null && unreserved !== null ? spirit - unreserved : null,
        buffs: sp.buffs.map((b) => ({ group: b.group, activeSkill: b.activeSkill, skill: b.skill, reserved: b.reserved })),
      };
    }
    // D-518 (WU-161, Appendix A.8): each switched buff's measure.
    if (reply.switches !== undefined && reply.switches.length > 0) {
      stages[stage.id].switches = reply.switches.map((sw) => ({
        group: sw.group,
        off: [...sw.off],
        weaponSet: sw.set,
        spiritUnreserved: typeof sw.spiritUnreserved === 'number' && Number.isFinite(sw.spiritUnreserved) ? sw.spiritUnreserved : null,
        keyFigures: { ...sw.keyFigures },
      }));
    }
    // D-353: the endgame measures, a card skeleton's pace measures included (D-407); D-358: the anoint's recipe.
    // D-427: the clear measure's travel skill, from the stage's skills with PoB's Travel type.
    // WU-111 (D-437, D-447): with the reply's skill meta and boss measure, the damage figures, trigger and source types.
    if (measuredStage(stage)) {
      // D-519 (WU-161): a read stage measured as a rung gets that rung's measures, though it has no variant.
      const measuredAs = rung !== undefined && stage.variant === undefined ? { ...stage, variant: rung } : stage;
      stages[stage.id].measures = stageMeasures(measuredAs, stages[stage.id], arbiterHits, check.gemTexts, reply.travelSkills, {
        ...(reply.skillMeta !== undefined ? { skillMeta: reply.skillMeta } : {}),
        ...(reply.skillMetaSet2 !== undefined ? { skillMetaSet2: reply.skillMetaSet2 } : {}),
        ...(reply.boss !== undefined ? { boss: reply.boss } : {}),
        // WU-120 (D-449, D-454): the stage's immune types, the resisting measure and, on `n`, the conditioned read.
        ...(reply.immune !== undefined ? { immune: reply.immune } : {}),
        ...(reply.resisting !== undefined ? { resisting: reply.resisting } : {}),
        ...(reply.conditioned !== undefined ? { conditioned: reply.conditioned } : {}),
        // D-519 (WU-161): the toughness read at the rung's reference hits, on a file's configuration.
        ...(reply.toughness !== undefined ? { toughness: reply.toughness } : {}),
      });
    }
    // C-33, WU-111 (the ledger's boss context): the stage's numbers, with its boss rotation and PoB alone when measured.
    const measures = stages[stage.id].measures;
    numbers[stage.id] = {
      outputs: reply.outputs,
      skillOutputs: reply.skillOutputs,
      ...(measures?.bossGroups !== undefined ? { bossGroups: measures.bossGroups } : {}),
      ...(measures?.damage !== undefined ? { damageBoss: measures.damage.boss } : {}),
    };
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
    return { stage: withCompanionConditions(s, companion), companion, index: loaded.plan.stages.indexOf(s) };
  });
  const check = await env.ctx.client.compileCheck({
    className: loaded.plan.roll.className,
    ascendancy: loaded.plan.roll.ascendancy,
    stages: stages.map((x) => checkStageOf(x.stage, x.companion, x.index, loaded.plan.schemaVersion)),
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

// ---------------------------------------------------------------------------------------------------
// D-466: the files' names, the draft mode and its delete

/** The characters Windows refuses in a file name (D-466): each is replaced with a space. */
const WINDOWS_REFUSED = /[<>:"/\\|?*]/g;
/** A Windows device name, whole (compared without case): such a name gains " (build)". */
const DEVICE_NAME = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
/** How many numbered names (`<name> <date> <k>`, ` (draft <k>)`) are tried before a write is refused. */
const MAX_NAME_TRIES = 99;
const CAMPAIGN_SUFFIX = / \(campaign\)$/i;

/**
 * A build's name cleaned for the builds folder (D-466): an `.xml` ending dropped, each character Windows refuses
 * (`< > : " / \ | ? *`) replaced with a space, runs of spaces made one, leading spaces and trailing dots and spaces
 * removed; a name that is a Windows device name whole (CON, PRN, AUX, NUL, COM1–COM9, LPT1–LPT9) gains " (build)".
 * Throws when nothing is left.
 */
export function cleanBuildName(name: string): string {
  const cleaned = name
    .replace(/\.xml$/i, '')
    .replace(WINDOWS_REFUSED, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +/, '')
    .replace(/[. ]+$/, '');
  if (cleaned === '') throw new CompileError(`the name ${JSON.stringify(name)} has nothing left once cleaned for the builds folder (D-466)`);
  return DEVICE_NAME.test(cleaned) ? `${cleaned} (build)` : cleaned;
}

/** The run date of a run folder `<slug>/<YYYY-MM-DD>-<n>`. */
function runDateOf(runFolder: string): string {
  const date = /^(\d{4}-\d{2}-\d{2})-\d+$/.exec(runFolder.split('/')[1] ?? '')?.[1];
  if (date === undefined) {
    throw new CompileError(`first_free needs the run folder's date: ${runFolder} isn't <slug>/<YYYY-MM-DD>-<n>, as guide_run {new_run} makes it`);
  }
  return date;
}

/** The names a `first_free` write tries, in order (D-466): `<name>`, `<name> <date>`, then `<name> <date> <k>` from 2. */
export function firstFreeCandidates(name: string, runDate: string, tries = MAX_NAME_TRIES): string[] {
  const cleaned = cleanBuildName(name);
  // A campaign's name ends " (campaign)" after the date.
  const suffix = CAMPAIGN_SUFFIX.exec(cleaned)?.[0] ?? '';
  const base = cleaned.slice(0, cleaned.length - suffix.length);
  const out = [`${base}${suffix}`, `${base} ${runDate}${suffix}`];
  for (let k = 2; out.length < tries; k += 1) out.push(`${base} ${runDate} ${k}${suffix}`);
  return out;
}

/** The draft names a build tries, in order (D-466): `<name> (draft)`, then `<name> (draft <k>)` from 2. */
export function draftCandidates(name: string, tries = MAX_NAME_TRIES): string[] {
  const cleaned = cleanBuildName(name);
  const out = [`${cleaned} (draft)`];
  for (let k = 2; out.length < tries; k += 1) out.push(`${cleaned} (draft ${k})`);
  return out;
}

/** A candidate's canonical path (D-52: an existing file's casing) and the sha1 of the file there, null for none. */
async function onDisk(pobDirectory: string, name: string): Promise<{ rel: string; sha1: string | null }> {
  const rel = await canonicalBuildPath(name, pobDirectory);
  const bytes = await readIfExists(path.join(path.resolve(pobDirectory), ...rel.split('/')));
  return { rel, sha1: bytes === null ? null : sha1(bytes) };
}

/** The first of `candidates` free for the build whose plan is `plan` (`freeForBuild`), with the paths passed over. */
async function firstFreeOf(
  pobDirectory: string,
  ledger: WriteLedger,
  candidates: readonly string[],
  plan: string,
): Promise<{ name: string; rel: string; existed: boolean; passed: string[] }> {
  const passed: string[] = [];
  for (const name of candidates) {
    const { rel, sha1: found } = await onDisk(pobDirectory, name);
    if (freeForBuild(ledger, rel, found, plan)) return { name, rel, existed: found !== null, passed };
    passed.push(rel);
  }
  throw new BuildFileWriteError(
    `none of ${candidates.length} names from "${candidates[0]}" is free in the builds folder (each holds a file another ` +
      'build or run wrote, or one changed on disk). Rename or move some of them, or choose another name.',
  );
}

/** D-466: the name a `first_free` final compile writes. */
async function firstFreeName(pobDirectory: string, ledger: WriteLedger, buildName: string, runFolder: string, plan: string): Promise<string> {
  return (await firstFreeOf(pobDirectory, ledger, firstFreeCandidates(buildName, runDateOf(runFolder)), plan)).name;
}

/** What the draft mode and its delete need of the server (no engine, D-466). */
export interface DraftEnv {
  pobDirectory: string;
  stateDir: string;
  guidesDirectory: string;
  writer: Pick<BuildFileWriter, 'writeBuildFile' | 'deleteBuildFile'>;
  /** The wall clock, for the ledger entry's `writtenAt`. */
  wallClock: () => Date;
}

/** A plan found in the guides root, as the ledger keys it: its path relative to the root's real path, and its run folder. */
interface PlanPlace {
  realDir: string;
  relPath: string;
  relDir: string;
  runFolder: string;
}

async function planPlace(env: Pick<DraftEnv, 'pobDirectory' | 'guidesDirectory'>, planPath: string): Promise<PlanPlace> {
  await checkGuidesRoot(env.guidesDirectory, env.pobDirectory);
  const realPath = await resolveInGuidesRoot(env.guidesDirectory, planPath, 'plan_path');
  const realRoot = await realPathInGuides(env.guidesDirectory);
  const relPath = path.relative(realRoot, realPath).split(path.sep).join('/');
  if (relPath.includes('\\')) {
    throw new CompileError(`plan_path "${planPath}" resolves to ${relPath} in the guides root, whose folder names hold a backslash`);
  }
  const runFolder = runFolderOf(relPath);
  if (runFolder === null) {
    throw new CompileError(
      `plan_path "${planPath}" is not inside a run folder: a draft needs the plan at <slug>/<YYYY-MM-DD>-<n>/…/plan.json ` +
        '(the write ledger is keyed by the run folder, D-211)',
    );
  }
  const relDir = path.posix.dirname(relPath);
  return { realDir: path.dirname(realPath), relPath, relDir, runFolder };
}

/** A file beside the plan, read through the guides root's confinement; null when it doesn't exist. */
async function besidePlan(env: Pick<DraftEnv, 'guidesDirectory'>, place: PlanPlace, name: string): Promise<Buffer | null> {
  const rel = place.relDir === '.' ? name : `${place.relDir}/${name}`;
  return readIfExists(await resolveInGuidesRoot(env.guidesDirectory, rel, name));
}

/**
 * The draft refusals (D-466): the draft is the whole plan as the gate saw it, so the record beside the plan must be a
 * measure-only compile of every stage of the plan as it is now, and `compiled-build.xml` the XML it wrote.
 */
async function draftSource(env: DraftEnv, planPath: string, place: PlanPlace): Promise<Buffer> {
  const refused = (why: string) => new CompileError(`no draft was written for ${planPath}: ${why}. Nothing was written.`);
  const planBytes = await besidePlan(env, place, path.posix.basename(place.relPath));
  if (planBytes === null) throw refused(`plan_path names no file in the guides root ${env.guidesDirectory}`);
  const recordBytes = await besidePlan(env, place, RECORD_FILE);
  if (recordBytes === null) throw refused(`there is no ${RECORD_FILE} beside the plan; compile it with measure_only: true first`);
  let record: Partial<CompileRecord>;
  let plan: { stages?: unknown };
  try {
    record = JSON.parse(recordBytes.toString('utf8')) as Partial<CompileRecord>;
    plan = JSON.parse(planBytes.toString('utf8')) as { stages?: unknown };
  } catch (error) {
    throw refused(`the plan or its ${RECORD_FILE} isn't JSON (${(error as Error).message})`);
  }
  if (record === null || typeof record !== 'object' || record.recordVersion !== RECORD_VERSION) {
    throw refused(`${RECORD_FILE} isn't a version-${RECORD_VERSION} compile record; compile with measure_only: true again`);
  }
  if (record.planSha1 !== sha1(planBytes)) {
    throw refused(`the plan changed since its last compile (${RECORD_FILE}'s planSha1 is another plan's); compile it with measure_only: true again`);
  }
  if (record.mode !== 'measure-only') {
    throw refused(`the plan's last compile was a ${String(record.mode)} compile; the draft copies a measure-only compile's ${MEASURE_ONLY_XML_FILE}`);
  }
  const planIds = Array.isArray(plan.stages) ? plan.stages.map((st) => (st as { id?: unknown } | null)?.id) : [];
  const compiled = Array.isArray(record.stagesCompiled) ? record.stagesCompiled : [];
  if (planIds.length === 0 || compiled.length !== planIds.length || compiled.some((id, i) => id !== planIds[i])) {
    throw refused(
      `the plan's last compile named stages (${compiled.join(', ') || 'none'} of ${planIds.map(String).join(', ')}); the draft is the whole ` +
        'plan, so compile it with measure_only: true and no stages first',
    );
  }
  const xml = await besidePlan(env, place, MEASURE_ONLY_XML_FILE);
  if (xml === null || record.pobFile?.location !== 'run' || record.pobFile.sha1 !== sha1(xml)) {
    throw refused(`${MEASURE_ONLY_XML_FILE} beside the plan isn't the one its last compile wrote; compile it with measure_only: true again`);
  }
  return xml;
}

/** The draft mode's result (D-466): the file written, and the draft names passed over for it. */
export interface DraftWriteResult {
  path: string;
  replaced: boolean;
  /** Earlier draft names this build couldn't use: changed on disk, or not this build's. */
  passed: string[];
}

/**
 * `compile_plan {plan_path, draft_name}` (D-466): copy the plan's last whole-plan measure-only `compiled-build.xml`
 * into the builds folder as `<cleaned name> (draft).xml` (or ` (draft <k>)` when that file is one the user changed or
 * this build didn't write), through C-17 (kind `bytes`) and the write ledger (`kind: draft`, `plan`). No engine.
 */
export async function writeDraft(env: DraftEnv, planPath: string, draftName: string): Promise<DraftWriteResult> {
  const place = await planPlace(env, planPath);
  const candidates = draftCandidates(draftName);
  const bytes = await draftSource(env, planPath, place);
  return updateWriteLedger(env.stateDir, async (ledger) => {
    const chosen = await firstFreeOf(env.pobDirectory, ledger, candidates, place.relPath);
    const saved = await env.writer.writeBuildFile({ name: chosen.rel, bytes, kind: 'bytes', overwrite: chosen.existed });
    const entry = writtenEntry({
      path: saved.path,
      sha1: saved.fingerprint.sha1,
      runFolder: place.runFolder,
      writtenAt: env.wallClock().toISOString(),
      kind: 'draft',
      plan: place.relPath,
    });
    return { ledger: withLedgerEntry(ledger, entry), value: { path: saved.path, replaced: saved.replaced, passed: chosen.passed } };
  });
}

/**
 * `compile_plan {plan_path, remove_draft}` (D-466): delete a draft this build wrote, unchanged on disk, through C-17's
 * delete (backed up first), and drop its ledger entry. Anything else is refused and nothing is deleted. No engine.
 */
export async function removeDraft(env: DraftEnv, planPath: string, draftPath: string): Promise<{ path: string; backupPath: string }> {
  const place = await planPlace(env, planPath);
  const rel = await canonicalBuildPath(draftPath, env.pobDirectory);
  return updateWriteLedger(env.stateDir, async (ledger) => {
    const refused = (why: string) => new BuildFileWriteError(`${rel} was not deleted: ${why}. Nothing was deleted.`);
    const entry = ledgerEntryFor(ledger, rel);
    if (entry === undefined) throw refused('no compile_plan wrote it (the write ledger has no entry for it)');
    if (entry.kind !== 'draft') throw refused("it is a build's final file, not a draft");
    if (entry.plan !== place.relPath) {
      throw refused(`it is a draft of another build (${entry.plan ?? `run ${entry.runFolder}`}), not of ${place.relPath}`);
    }
    const { sha1: found } = await onDisk(env.pobDirectory, rel);
    if (found === null) throw refused("it doesn't exist");
    if (found !== entry.sha1) throw refused('it changed on disk since this build wrote it (probably saved in PoB2)');
    const deleted = await env.writer.deleteBuildFile({ name: rel, sha1: entry.sha1 });
    return { ledger: withoutLedgerEntry(ledger, rel), value: { path: deleted.path, backupPath: deleted.backupPath } };
  });
}

// ---------------------------------------------------------------------------------------------------
// Amendment 14 (D-479, D-487, D-488): the final file's copy, and the read-back, adopt, notes and trade-links modes

/** D-479: the copy of a final compile's written bytes beside its record, the base a read-back of the final file reads. */
export const FINAL_COPY_FILE = 'final-build.xml';
/** D-479: the copy a campaign's final compile writes instead, so the endgame file's copy stays readable. */
export const FINAL_CAMPAIGN_COPY_FILE = 'final-build-campaign.xml';
/** D-479: the read-back's result beside the plan (Appendix A). */
export const READBACK_FILE = 'readback.json';
/** D-488: the trade links beside the record (Appendix A). */
export const TRADE_LINKS_FILE = 'trade-links.json';

/**
 * The copy a final compile of these stages writes (D-479): a plan holding a campaign stage (one that gets no measures:
 * neither a variant nor `progress: "endgame"`) is a campaign's final compile, the D2 gate's, so its copy is
 * `final-build-campaign.xml`; an endgame plan's is `final-build.xml`.
 */
export function finalCopyFile(stages: readonly Pick<Stage, 'progress' | 'variant'>[]): string {
  return stages.some((s) => !measuredStage(s)) ? FINAL_CAMPAIGN_COPY_FILE : FINAL_COPY_FILE;
}

/** What the read-back reads beside the plan for a ledger entry's kind: a draft's or skeleton's base, or a final file's copies. */
function baseCandidates(kind: WriteLedgerEntry['kind']): string[] {
  return kind === 'draft' ? [MEASURE_ONLY_XML_FILE] : [FINAL_COPY_FILE, FINAL_CAMPAIGN_COPY_FILE];
}

/** A file's bytes from the builds folder (its canonical path), or null when it doesn't exist. */
async function buildsFile(pobDirectory: string, rel: string): Promise<Buffer | null> {
  return readIfExists(path.join(path.resolve(pobDirectory), ...rel.split('/')));
}

/** The ledger's entry for `rel`, which this plan's build must have written (D-479: the read-back reads only such a file). */
function ownEntry(ledger: WriteLedger, rel: string, place: PlanPlace, refused: (why: string) => Error): WriteLedgerEntry {
  const entry = ledgerEntryFor(ledger, rel);
  if (entry === undefined) throw refused('no compile_plan wrote it (the write ledger has no entry for it)');
  if (entry.plan !== place.relPath) {
    throw refused(`it is ${entry.plan === undefined ? `a file of run ${entry.runFolder}` : `another build's file (${entry.plan})`}, not ${place.relPath}'s`);
  }
  return entry;
}

/**
 * What the read-back needs: the draft mode's environment, the writer's record of the versions it wrote over (R-83), and
 * the names of nodes and config inputs.
 */
export interface ReadBackEnv extends Omit<DraftEnv, 'writer'> {
  writer: Pick<BuildFileWriter, 'replacedVersion'>;
  /** The names (passive tree, config labels), loaded for the tree versions the two files use. */
  names: (treeVersions: readonly string[]) => Promise<ReadBackNames>;
}

/** The read-back's result (D-479): `readback.json` as written, and the reply's count and summary. */
export interface ReadBackResult {
  readBack: ReadBackFile;
  /** Where `readback.json` was written, relative to the guides root. */
  written: string;
  changes: number;
  summary: string;
}

/**
 * `compile_plan {plan_path, read_back}` (D-479, C-41; engine kind `none`): compare a file this plan's build wrote, as the
 * user left it, with the copy of what the server last wrote for it: `compiled-build.xml` beside the plan for a draft or a
 * skeleton, the final compile's copy (`final-build.xml`, or a campaign's `final-build-campaign.xml`) for a final file,
 * used only while its sha1 equals the ledger entry's `baseSha1`; otherwise it is refused ("the file was written again
 * since") and nothing is written. Writes `readback.json` beside the plan.
 */
export async function readBackFile(env: ReadBackEnv, planPath: string, filePath: string): Promise<ReadBackResult> {
  const place = await planPlace(env, planPath);
  const rel = await canonicalBuildPath(filePath, env.pobDirectory);
  const refused = (why: string) => new CompileError(`${rel} was not read back: ${why}. Nothing was written.`);
  const ledger = await readWriteLedger(env.stateDir);
  const entry = ownEntry(ledger, rel, place, refused);
  const edited = await buildsFile(env.pobDirectory, rel);
  if (edited === null) throw refused("it doesn't exist in the builds folder");
  // R-83: an older version of the file, one the server has written over since (a PoB still holding the older draft
  // saved it back), would show the server's own revision as the user's edit.
  const editedSha1 = sha1(edited);
  if (editedSha1 !== entry.sha1 && (await env.writer.replacedVersion({ name: rel, sha1: editedSha1 }))) {
    throw refused('the file was written again since: it holds an older version of the file, which the server has written over');
  }
  const candidates = baseCandidates(entry.kind);
  let base: { name: string; bytes: Buffer } | null = null;
  for (const name of candidates) {
    const bytes = await besidePlan(env, place, name);
    if (bytes !== null && sha1(bytes) === entry.baseSha1) {
      base = { name, bytes };
      break;
    }
  }
  if (base === null) {
    throw refused(
      `the file was written again since (${candidates.join(' or ')} beside the plan is no longer the copy of what the server ` +
        `wrote to ${rel}); the current file is the one the build's latest compile or draft wrote`,
    );
  }
  let baseXml;
  let editedXml;
  try {
    baseXml = parsePobXml(base.bytes.toString('utf8'));
  } catch (error) {
    throw refused(`${base.name} beside the plan can't be read: ${(error as Error).message}`);
  }
  try {
    editedXml = parsePobXml(edited.toString('utf8'));
  } catch (error) {
    throw refused(`${(error as Error).message}`);
  }
  const versions = [...new Set([...baseXml.specs, ...editedXml.specs].map((s) => s.treeVersion).filter((v) => v !== ''))];
  const readBack = compareBuilds(baseXml, editedXml, await env.names(versions), { file: rel, base: base.name, baseSha1: entry.baseSha1 });
  await writeBesidePlan(env.guidesDirectory, planPath, { realDir: place.realDir }, READBACK_FILE, `${JSON.stringify(readBack, null, 2)}\n`);
  const { changes, text } = readBackSummary(readBack);
  return { readBack, written: place.relDir === '.' ? READBACK_FILE : `${place.relDir}/${READBACK_FILE}`, changes, summary: text };
}

/**
 * `compile_plan {plan_path, adopt}` (D-479, C-17; engine kind `none`): take a file this plan's build wrote, as the user
 * edited it, as the server's own, on the user's yes to its read-back: the ledger entry's `sha1` becomes the file's,
 * `adopted: true` is set and `baseSha1` stays (so a second read-back of the file still works), and the build-file writer
 * records the file's fingerprint as its own write, so the next draft or compile replaces it (after the writer's backup)
 * and a skeleton's `remove_draft` removes it.
 */
export async function adoptFile(env: DraftEnv & { writer: Pick<BuildFileWriter, 'adoptBuildFile'> }, planPath: string, filePath: string): Promise<{ path: string }> {
  const place = await planPlace(env, planPath);
  const rel = await canonicalBuildPath(filePath, env.pobDirectory);
  return updateWriteLedger(env.stateDir, async (ledger) => {
    const refused = (why: string) => new BuildFileWriteError(`${rel} was not adopted: ${why}. Nothing was changed.`);
    const entry = ownEntry(ledger, rel, place, refused);
    const bytes = await buildsFile(env.pobDirectory, rel);
    if (bytes === null) throw refused("it doesn't exist in the builds folder");
    const found = sha1(bytes);
    await env.writer.adoptBuildFile({ name: rel, sha1: found });
    return { ledger: withLedgerEntry(ledger, { ...entry, sha1: found, adopted: true }), value: { path: rel } };
  });
}

/** The notes mode's result (D-487): the final file written, and the notes' length in characters. */
export interface NotesWriteResult {
  path: string;
  characters: number;
}

/**
 * `compile_plan {plan_path, notes_path}` (D-487, C-41; engine kind `none`): replace `<Notes>` in the final file of the
 * plan's latest final compile (the record's `pobFile.path`) with the text of `notes_path` (a file in the guides root),
 * escaped (`& < >`; PoB's `^x` colour codes kept), through the build-file writer (a text edit, backed up first), then
 * update the ledger entry's `sha1` (not its `baseSha1`: a read-back compares no notes). Refused, writing nothing, when the
 * file changed on disk since the ledger's write (D-211).
 */
export async function writeNotes(env: DraftEnv, planPath: string, notesPath: string): Promise<NotesWriteResult> {
  const place = await planPlace(env, planPath);
  const refusedBefore = (why: string) => new CompileError(`no notes were written for ${planPath}: ${why}. Nothing was written.`);
  const recordBytes = await besidePlan(env, place, RECORD_FILE);
  if (recordBytes === null) throw refusedBefore(`there is no ${RECORD_FILE} beside the plan; the notes go into a final compile's file`);
  let record: Partial<CompileRecord>;
  try {
    record = JSON.parse(recordBytes.toString('utf8')) as Partial<CompileRecord>;
  } catch (error) {
    throw refusedBefore(`${RECORD_FILE} isn't JSON (${(error as Error).message})`);
  }
  if (record === null || typeof record !== 'object' || record.mode !== 'final' || record.pobFile?.location !== 'builds') {
    throw refusedBefore(`the plan's last compile wasn't a final compile (${RECORD_FILE} names no builds-folder file); compile it final first`);
  }
  const rel = await canonicalBuildPath(record.pobFile.path, env.pobDirectory);
  let notes: string;
  try {
    notes = await fs.readFile(await resolveInGuidesRoot(env.guidesDirectory, notesPath, 'notes_path'), 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    throw refusedBefore(code === 'ENOENT' ? `notes_path "${notesPath}" names no file in the guides root` : (error as Error).message);
  }
  return updateWriteLedger(env.stateDir, async (ledger) => {
    const refused = (why: string) => new BuildFileWriteError(`no notes were written to ${rel}: ${why}. Nothing was written.`);
    const entry = ownEntry(ledger, rel, place, refused);
    const bytes = await buildsFile(env.pobDirectory, rel);
    if (bytes === null) throw refused("it doesn't exist in the builds folder");
    if (sha1(bytes) !== entry.sha1) throw refused('it changed on disk since the server wrote it (probably saved in PoB2; D-211)');
    let xml: string;
    try {
      xml = replaceNotesXml(bytes.toString('utf8'), escapeNotes(notes));
    } catch (error) {
      throw refused((error as Error).message);
    }
    const saved = await env.writer.writeBuildFile({ name: rel, bytes: xml, kind: 'text' });
    const next: WriteLedgerEntry = { ...entry, sha1: saved.fingerprint.sha1, writtenAt: env.wallClock().toISOString() };
    return { ledger: withLedgerEntry(ledger, next), value: { path: saved.path, characters: notes.length } };
  });
}

// --- The trade links (D-488)

/** One `trade-links.json` entry (Appendix A). */
export interface TradeLinkEntry {
  stage: string;
  slot: string;
  url: string;
  ids: 'checked' | 'unchecked';
}

/** What the links mode needs of the server: the engine (kind `load`), the plan's place and data, and the trade stat cache. */
export interface TradeLinksEnv {
  ctx: EngineCallContext;
  pobDirectory: string;
  guidesDirectory: string;
  referenceData: () => ReferenceData;
  /**
   * The server's cached `/data/stats` as a lookup (whether it knows a trade stat id), or null when no stat list is
   * cached (each entry then says `ids unchecked`). The links mode never sends a request.
   */
  tradeStats: () => ((id: string) => boolean) | null;
}

export interface TradeLinksResult {
  /** The entries written, or null when none were (a plan with no league). */
  links: TradeLinkEntry[] | null;
  written: string | null;
  /** Why nothing was written, when nothing was. */
  reason?: string;
}

/** The rungs that get links (D-488, D-372's scope): `b` and `n`. */
const LINK_VARIANTS: readonly string[] = ['budget', 'non-budget'];
/** The socket table's file and keys (C-35, `data/items/sockets.json`). */
const SOCKET_TABLE = 'items/sockets.json';
const SOCKET_CATEGORIES = [
  'body-armour', 'two-hand-weapon', 'one-hand-weapon', 'helmet', 'gloves', 'boots', 'shield', 'focus',
  'amulet', 'ring', 'belt', 'quiver', 'corona-amulet', 'grasping-ring', 'stalking-belt',
] as const;
/** At most this many required filters a link carries (the 3-required limit, D-372). */
const LINK_REQUIRED_MAX = 3;
/** What PoB's estimate (`estimateComplexity`) doesn't count: the `misc_filters.corrupted` option filter, as a flag filter (3). */
const CORRUPTED_FILTER_COST = 3;

const isRare = (text: string): boolean => /^\s*Rarity:\s*rare\s*$/im.test(text.split(/\r?\n/)[0] ?? '');

/** The rune-socket minimum by socket category, from the socket table when it is loaded (else none). */
function socketTableOf(ref: ReferenceData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const category of SOCKET_CATEGORIES) {
    const found = ref.resolveFact(SOCKET_TABLE, `sockets.${category}`);
    if (found.ok && typeof found.fact.value === 'number' && Number.isInteger(found.fact.value) && found.fact.value >= 0) {
      out[category] = found.fact.value;
    }
  }
  return out;
}

/** A link's settings from a rare's spec: its weights and required must-haves (each left out without a spec). */
export interface LinkSpec {
  weights?: Array<{ stat: string; weight: number }>;
  required?: Array<{ tradeId: string; min: number }>;
}

/**
 * A rare's spec, from its price entry (schema 10's `spec`, D-483): the entry whose id starts with the stage's id and
 * whose query names the slot. Its weights become the link's, and its 3 most important must-haves the required filters:
 * one PoB scores at zero first, then the rest in the spec's order. A slot with no spec gets PoB's defaults.
 */
export function linkSpecOf(prices: readonly unknown[], stageId: string, slot: string): LinkSpec {
  for (const raw of prices) {
    const p = raw as { id?: unknown; query?: { slot?: unknown } | null; spec?: unknown };
    if (typeof p?.id !== 'string' || !p.id.startsWith(`${stageId}-`) || p.query?.slot !== slot) continue;
    const spec = p.spec as { weights?: unknown; mustHaves?: unknown } | undefined;
    if (spec === undefined || spec === null || typeof spec !== 'object') continue;
    const weights = Array.isArray(spec.weights)
      ? spec.weights
          .filter((w): w is { stat: string; weight: number } => typeof w?.stat === 'string' && typeof w?.weight === 'number' && w.weight > 0)
          .map((w) => ({ stat: w.stat, weight: w.weight }))
      : [];
    const mustHaves = Array.isArray(spec.mustHaves)
      ? spec.mustHaves.filter((m): m is { tradeId: string; min: number; zeroScored?: boolean } => typeof m?.tradeId === 'string' && typeof m?.min === 'number')
      : [];
    const ordered = [...mustHaves.filter((m) => m.zeroScored === true), ...mustHaves.filter((m) => m.zeroScored !== true)];
    return {
      ...(weights.length > 0 ? { weights } : {}),
      ...(ordered.length > 0 ? { required: ordered.slice(0, LINK_REQUIRED_MAX).map((m) => ({ tradeId: m.tradeId, min: m.min })) } : {}),
    };
  }
  return {};
}

/** A query's complexity as the prefit estimates it, plus the corrupted filter it doesn't count. */
function linkComplexity(query: TradeQueryBody): number {
  const corrupted = (query.query?.filters?.misc_filters?.filters as Record<string, unknown> | undefined)?.corrupted !== undefined;
  return estimateComplexity(query) + (corrupted ? CORRUPTED_FILTER_COST : 0);
}

/** The ids of a query's weighted and required filters dropped when the cached stat list lacks them (C-14 step 7's rule). */
function dropUnknownIds(query: TradeQueryBody, known: (id: string) => boolean): TradeQueryBody {
  const copy = JSON.parse(JSON.stringify(query)) as TradeQueryBody;
  for (const group of copy.query?.stats ?? []) {
    if (!group || (group.type !== 'weight' && group.type !== 'and') || !Array.isArray(group.filters)) continue;
    group.filters = group.filters.filter((f) => typeof f?.id === 'string' && known(f.id));
  }
  return copy;
}

/**
 * `compile_plan {plan_path, trade_links: true}` (D-488, C-41; engine kind `load`, its own request after F1's final
 * compile): for every rare gear slot and rare tree jewel of `b` and `n`, PoB's weighted query, built headless with no
 * request from the final compile's copy beside the record: the spec's weights (PoB's defaults without one), its 3 most
 * important must-haves required, corrupted mods unweighted and a `corrupted: false` filter, the rung's level as the
 * maximum level, the base's rune sockets from the socket table as the minimum, PoB's own minimum weight (half the
 * compiled item's score), the prefit's complexity budget and the plan's league; each URL is `tradeQueryUrl(league,
 * query)`. A stat id the server's cached `/data/stats` lacks is dropped; with no cache the entry says `ids unchecked`.
 * Writes `trade-links.json` beside the record; a plan with no league (an offline run) gets none.
 */
export async function writeTradeLinks(env: TradeLinksEnv, planPath: string): Promise<TradeLinksResult> {
  await checkGuidesRoot(env.guidesDirectory, env.pobDirectory);
  const refData = env.referenceData();
  const loaded = await loadPlan(env.guidesDirectory, planPath, refData);
  const plan = loaded.plan;
  if (plan.league === null) return { links: null, written: null, reason: 'the plan names no league (an offline run)' };
  const league = plan.league;
  const refused = (why: string) => new CompileError(`no trade links were written for ${planPath}: ${why}. Nothing was written.`);
  const besideFile = async (name: string) => readIfExists(path.join(loaded.realDir, name));
  const recordBytes = await besideFile(RECORD_FILE);
  if (recordBytes === null) throw refused(`there is no ${RECORD_FILE} beside the plan; the links read a final compile's build`);
  let record: Partial<CompileRecord>;
  try {
    record = JSON.parse(recordBytes.toString('utf8')) as Partial<CompileRecord>;
  } catch (error) {
    throw refused(`${RECORD_FILE} isn't JSON (${(error as Error).message})`);
  }
  if (record?.mode !== 'final' || record.pobFile?.location !== 'builds') {
    throw refused("the plan's last compile wasn't a final compile; the links read the final build, so compile it final first");
  }
  let copy: { name: string; xml: string } | null = null;
  for (const name of [FINAL_COPY_FILE, FINAL_CAMPAIGN_COPY_FILE]) {
    const bytes = await besideFile(name);
    if (bytes !== null && sha1(bytes) === record.pobFile.sha1) copy = { name, xml: bytes.toString('utf8') };
  }
  if (copy === null) throw refused(`neither ${FINAL_COPY_FILE} nor ${FINAL_CAMPAIGN_COPY_FILE} beside the plan is the final compile's copy`);
  const sockets = socketTableOf(refData);
  const stages = plan.stages.filter((s) => s.variant !== undefined && LINK_VARIANTS.includes(s.variant));
  const links: TradeLinkEntry[] = [];
  const { ctx } = env;
  await ctx.loadXml(copy.xml, { displayName: path.posix.basename(record.pobFile.path).replace(/\.xml$/i, '') });
  for (const stage of stages) {
    const slots: Array<{ slot: string; jewelType?: 'Base' | 'Radius' }> = [];
    for (const s of slotTexts(stage)) if (s.sameAs === undefined && isRare(s.text)) slots.push({ slot: s.slot });
    for (const j of stage.items.treeJewels) {
      if (isRare(j.text)) slots.push({ slot: `Jewel ${j.node}`, jewelType: /^\s*Radius:/im.test(j.text) ? 'Radius' : 'Base' });
    }
    if (slots.length === 0) continue;
    await ctx.client.manageSets({ setType: 'loadout', action: 'select', title: stage.loadoutName });
    await ctx.client.setLevel(stage.level);
    for (const { slot, jewelType } of slots) {
      const spec = linkSpecOf(plan.prices, stage.id, slot);
      let generated: Awaited<ReturnType<typeof ctx.client.tradeGenerateQuery>>;
      try {
        generated = await ctx.client.tradeGenerateQuery({
          slot,
          ...(spec.weights ? { statWeights: spec.weights } : {}),
          ...(spec.required ? { requiredMods: spec.required } : {}),
          ...(jewelType ? { jewelType } : {}),
          includeCorrupted: false,
          excludeCorrupted: true,
          maxLevel: stage.level,
          socketsByCategory: sockets,
        });
      } catch (error) {
        // A spec PoB refuses (an unknown sort stat, a bad must-have) is named with its stage and slot.
        if (error instanceof EngineActionError) throw refused(`stage ${stage.id}'s ${slot}: ${error.error}`);
        throw error;
      }
      let query = generated.query as unknown as TradeQueryBody;
      const known = env.tradeStats();
      if (known !== null) query = dropUnknownIds(query, known);
      while (COMPLEXITY_BUDGET - linkComplexity(query) < COMPLEXITY_HEADROOM && weightedFilterCount(query) > 1) {
        query = dropLowestWeighted(query, 1);
      }
      links.push({ stage: stage.id, slot, url: tradeQueryUrl(league, query), ids: known !== null ? 'checked' : 'unchecked' });
    }
  }
  await writeBesidePlan(env.guidesDirectory, planPath, loaded, TRADE_LINKS_FILE, `${JSON.stringify(links, null, 2)}\n`);
  const relDir = path.posix.dirname(loaded.relPath);
  return { links, written: relDir === '.' ? TRADE_LINKS_FILE : `${relDir}/${TRADE_LINKS_FILE}` };
}
