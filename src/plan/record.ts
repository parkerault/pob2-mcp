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
 *
 * **Measures and the anoint** (WU-65; D-353, D-358), additive, so `recordVersion` stays 2. Each endgame stage
 * (one with a `variant`) gets `measures`, computed here so no agent computes or checks them: `dps`, the
 * headline (the main group's Count-scaled figure, D-294, D-378); `ehp`, PoB's `TotalEHP`; on the budget and
 * non-budget rungs, `arbiter`, the Arbiter of Divinity's largest hit of each damage type and each mixed hit
 * over the stage's max hit (`arbiterMeasure`); and a rough `clearSpeed` (`clearSpeedOf`). No kill time and no
 * hits to kill. An anointed stage's record gives the notable and its recipe of three Distilled Emotions.
 *
 * **A minion's skill** (WU-78; D-377, D-378), additive. Each stage's `minionSkills` holds the resolved selection
 * of every group that names a `minionSkill`, and only those: the minion, the skill's name, its index in the
 * minion's live list and its stat set. A group's damage figure (`figureField`) is `MinionTotalDPS` when the group
 * names a minion skill (or is a plain summon, below), else `TotalDPS`, at the same key `g<group>s<skill>p<statSet>`;
 * the headline, the key-figure line and the clear measure read it. `outputs` carries the minion's own numbers
 * flattened as `Minion<Field>` (D-376), and Count applies to them by PoB's Full DPS rule for a minion.
 *
 * **A plain summon's figure** (WU-80, D-397). A summon that names no minion skill, such as Skeletal Warrior, has its
 * minion's figure too: `figureField` is also `MinionTotalDPS` when the selected skill's `skillOutputs` entry carries
 * `Minion<Field>` fields (`summonsMinion`, the checker's D-385 test and `get_passive_upgrades`' D-388 one). The
 * headline and the key-figure line read it, and the clear measure decides by the same test (`minionFigures`): a plain
 * summon's clear speed is its minion's area and use rate.
 *
 * **Pace on every endgame stage** (WU-88, D-407; the user's HG-12 grant), additive. Every endgame stage (`progress`
 * `endgame`: a variant, and a card skeleton, R1b's one stage with no `variant`) gets the pace measures: the rough
 * `clearSpeed`, now with `noArea` when PoB gives the clear skill no radius (its band is then `slow`, so a display can
 * say "slow (PoB gives no area)"), and `movementSpeed`, the player's movement speed as PoB's `EffectiveMovementSpeedMod`.
 * `dps`, `ehp` and `arbiter` stay on the variant stages only. A campaign stage has no `measures`.
 *
 * **A tamed beast** (WU-87, D-402; the user's HG-12 grant), additive. A stage that names a `companion` gets
 * `companion`: the beast PoB summons, its DPS (its minion's `MinionTotalDPS` at its group's breakdown key), the player's
 * Spirit, the species' Spirit percentage and PoB's reservation for it, and each kept modifier with how it was applied
 * (`companion.ts`). Its `stats` lines are custom modifiers, so they are in `customModsWritten` and the stage carries the
 * custom-modifier mark.
 *
 * **The level the build works from** (WU-93, D-413; C-33, the user's HG-12 grant), additive. Every stage gets
 * `requirements {level, by[]}`: the highest level requirement among its equipped items and socketed gems, as PoB
 * computes them, and the items and gems that set it (`stageRequirements`). They are `compile_stage`'s V1 inputs, the
 * ones V1's `gem-level-requirement` and `item-level-requirement` read: a gem's is PoB's `reqLevel`, its granted
 * effect's `levelRequirement` at its level (`Classes/SkillsTab.lua:1308`), for every gem of the plan's groups; an
 * item's is PoB's `requirements.level` (`Classes/Item.lua:1287-1288`: the item text's, else its base's, raised to
 * its runes'), for every item in the item slots.
 *
 * **A skill on a weapon set and the travel skill** (WU-102; D-426, D-427, §24.2; the user's HG-12 grant), additive. A
 * stage that uses weapon set 2 (`outputsSet2`'s stages, which now include a stage with a group on set 2) gets
 * `skillOutputsSet2`, every group's figures with set 2 active, keyed as `skillOutputs`. Every measured stage's clear
 * measure gets `travel` (`travelOf`): the first enabled group other than the clear group whose active skill has PoB's
 * Travel skill type, with its uses per second, or null. The clear measure and `travel` read a group's figures on its
 * own set (`groupFigures`).
 *
 * **One damage figure, against map monsters and a boss** (WU-111; amendment 11 §5, §9b; D-437, D-447), additive. Each
 * variant stage's `measures` gain `damage {map, boss}`: the named source's damage figure (`damageFigure`: `TotalDPS` ×
 * Count, `TotalDot` × Count only when it stacks, `IgniteDPS`, `BleedDPS` and `PoisonDPS` once; a minion's
 * `MinionTotalDPS` × Count), read on its own weapon set, the map figure times its `CullMultiplier` when the stage states
 * `skills.cull`; and `boss`, PoB alone against a Pinnacle boss (`bossDamage`) over `bossGroups`, the boss rotation's
 * entries (the named source alone without `skills.boss`), each measured with only `enemyIsBoss` set to `Pinnacle`. With
 * `skills.cull`, `cull {map, boss}` is the named source's `CullPercent` under each. Every measured stage, a card
 * skeleton's included, gains `sourceTypes` (the named source's PoB skill types) and, when the named source's group holds a
 * gem of PoB's skill types `Meta` and `Triggers`, `trigger {by, usesPerSecond}`. `measures.dps` stays as written.
 *
 * **The toughness reading and the resisting figure** (WU-120; amendment 12 §4, §9; D-449, D-454; the user's HG-12 grant,
 * HG-23), additive. Every variant stage's `measures` gain `toughness` (`toughnessOf`: the lowest max hit and immune types
 * of its own measure, the chance layers, and on `n` the conditioned read) and `damage.resisting`. On `b` and `n` the
 * Arbiter rows read the Pinnacle pass (its max hits, immune types and chances at the Arbiter): an immune type's row, a max
 * hit of 0, each row's `deflectedRatio`, `deflectedVerdict` and `hitsSurvived` (the least over its type's hits, an
 * unevadable hit's evade chance 0), and `arbiter.avoid` when the build evades or deflects at the Arbiter. A rung's
 * deciding row (`decidingRow`) gives its single Arbiter figure.
 */
import type { StageArbiterChances, StageChecks, StageSkillMeta } from '../engine/schemas.js';
import { isMultiSegmentRef, parseFormula, stageValue, type StageOutputs } from './ledger.js';
import type { Fact } from './referenceData.js';
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
 * A minion (D-378) is merged as an actor of its own with `count = activeSkillCount` and `dotScale = 1`
 * (`:366-378`): its hits (`MinionTotalDPS`) and impale (`MinionImpaleDPS`) are × the count, and its damage over
 * time (`MinionTotalDot`) and its ailments are as measured.
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
  // D-378: a minion's figures (the `Minion<Field>` numbers, D-376).
  ['MinionTotalDPS', 'count'],
  ['MinionImpaleDPS', 'count'],
  ['MinionTotalDot', 'once'],
  ['MinionBleedDPS', 'once'],
  ['MinionCorruptingBloodDPS', 'once'],
  ['MinionIgniteDPS', 'once'],
  ['MinionBurningGroundDPS', 'once'],
  ['MinionPoisonDPS', 'once'],
  ['MinionCausticGroundDPS', 'once'],
  ['MinionDecayDPS', 'once'],
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

// ---------------------------------------------------------------------------------------------------
// The endgame measures (WU-65, D-353) and the anoint's recipe (D-358)

/** A verdict on one of the Arbiter's hits: its top roll over the stage's max hit, `survives` below 1. */
export type ArbiterVerdict = 'survives' | 'one-shot';

/** One hit of the Arbiter of Divinity (`enemies/arbiter-of-divinity.json`, `hits.<id>`): its top roll and types. */
export interface ArbiterHit {
  id: string;
  /** The top roll (`max` of the fact's range): level-79 base, before mitigation, non-crit. */
  max: number;
  /** Its damage types (`hits.<id>.type`, split at `-`): one for a plain hit, more for a mixed one. */
  types: string[];
  /**
   * WU-120 (amendment 12 §4, R-54): `false` when the data says the hit can't be evaded (`hits.<id>.evadable: false`),
   * which makes its evade chance 0; absent or true means evadable.
   */
  evadable?: boolean;
}

/** The data file holding the Arbiter's hits (C-35). */
export const ARBITER_FILE = 'enemies/arbiter-of-divinity.json';

/**
 * The Arbiter's hits from its data file's facts: every `hits.<id>` range with its `hits.<id>.type`, in file
 * order. A hit without a type, or a type that isn't a string, is left out. WU-120 (amendment 12 §4, Appendix A): a hit
 * whose `hits.<id>.evadable` fact is `false` is unevadable (`evadable: false`); absent or `true`, it is evadable.
 */
export function arbiterHitsOf(facts: Readonly<Record<string, Fact>>): ArbiterHit[] {
  const out: ArbiterHit[] = [];
  for (const [key, fact] of Object.entries(facts)) {
    const m = /^hits\.([a-z0-9-]+)$/.exec(key);
    const value = fact.value as unknown;
    if (!m || typeof value !== 'object' || value === null || typeof (value as { max?: unknown }).max !== 'number') continue;
    const type = facts[`${key}.type`]?.value;
    if (typeof type !== 'string' || type === '') continue;
    const evadable = facts[`${key}.evadable`]?.value !== false;
    out.push({ id: m[1], max: (value as { max: number }).max, types: type.split('-'), evadable });
  }
  return out;
}

/** One part of a mixed hit: its share of the top roll, the stage's max hit of that type and their ratio. */
export interface ArbiterPart {
  type: string;
  hit: number;
  /** The max hit of the part's type; null when PoB gave none, or (with `immune`) none is finite. */
  maxHit: number | null;
  /** Its share over the max hit: 0 for an immune part; null when PoB gave no max hit, or one of 0. */
  ratio: number | null;
  /** WU-120 (D-449): PoB makes the build immune to the part's type: it counts 0, and the row reads the other part. */
  immune?: true;
}

/** A row of `measures.arbiter`: one per damage type the Arbiter deals and one per mixed hit. */
export interface ArbiterRow {
  /** The damage type, or a mixed hit's types joined by `-` as the data names them (`physical-lightning`). */
  type: string;
  mixed: boolean;
  /** The hit's id in the data (`hits.<id>`): the largest of its type. */
  hitId: string;
  /** Its top roll. */
  hit: number;
  /**
   * The stage's `<Type>MaximumHitTaken` (WU-120: the Pinnacle pass's, D-449). For a mixed hit, the largest hit of that
   * mix the stage takes: the hit over the summed ratio. Null when PoB gave no finite max hit, or the type is immune.
   */
  maxHit: number | null;
  /**
   * The hit over the max hit; for a mixed hit, its parts' ratios summed. WU-120 (D-449): 0 for an immune type; null when
   * PoB gave no max hit, or a max hit of 0 (then the verdict is `one-shot`).
   */
  ratio: number | null;
  verdict: ArbiterVerdict | null;
  /** A mixed hit's parts, its top roll split evenly between its types. */
  parts?: ArbiterPart[];
  /** WU-120 (D-449, gap 26): PoB makes the build immune to the row's type (every part of a mixed row): ratio 0, `survives`. */
  immune?: true;
  /**
   * WU-120 (D-449): the row's hit, deflected, over the max hit (`avoid.method`: PoB's max hit with every hit deflected, or
   * the ratio × (1 − DeflectEffect / 100)); null when the build doesn't deflect at the Arbiter or the row has no ratio.
   */
  deflectedRatio?: number | null;
  /** WU-120 (D-449): the deflected ratio's verdict, `survives` below 1; null with no deflection or no verdict. */
  deflectedVerdict?: ArbiterVerdict | null;
  /**
   * WU-120 (D-449; Names): the share of the type's hits the build survives, 0 to 100, the least over the type's hits: per
   * hit, 100 when it survives the full hit; else its evade chance plus (100 − the evade chance) × the deflect chance / 100
   * when it survives the deflected hit; else its evade chance. An unevadable hit's evade chance is 0. Null with no verdict.
   */
  hitsSurvived?: number | null;
}

/**
 * WU-120 (amendment 12 §4, D-449; Appendix A): the chances at the Arbiter, on `b` and `n` when the evade or the deflect
 * chance is above 0: its accuracy (`enemies/arbiter-of-divinity.json#base.accuracy`), PoB's melee evade and deflect
 * chances at it (percent), PoB's `DeflectEffect`, and how the deflected ratio is read: `pass` (PoB's max hit with every hit
 * deflected) or `formula` (the ratio × (1 − DeflectEffect / 100), optimistic with armour).
 */
export interface ArbiterAvoid {
  accuracy: number;
  evade: number;
  deflect: number;
  deflectEffect: number;
  method: 'pass' | 'formula';
  /**
   * PG-100 (§4, §17): on a build whose companion takes part of each deflected hit (PoB's
   * `TakenFromCompanionBeforeYouFromDeflected`, the unique body Forgotten Warden), that percent. PoB's max hit already counts
   * it at its own deflect chance, so hits survived counts deflection partly twice and reads high: the gate notes it.
   * Absent when the build has none.
   */
  companionDeflected?: number;
}

export interface ArbiterMeasure {
  /** `one-shot` when any row is, `survives` when every row survives; null when a row has no verdict. */
  verdict: ArbiterVerdict | null;
  /** The row with the largest ratio: the hit the survival label names. */
  worst: { type: string; hitId: string; ratio: number } | null;
  rows: ArbiterRow[];
  /** WU-120 (D-449): the chances at the Arbiter, when the build evades or deflects there. */
  avoid?: ArbiterAvoid;
}

/**
 * WU-120 (amendment 12 §4, D-449): what the Arbiter rows read beside the max hits: the types PoB makes the build immune
 * to, and the Pinnacle pass's chances at the Arbiter (`compile_stage`'s `boss.arbiter`), with the max hits of its
 * deflected pass.
 */
export interface ArbiterInputs {
  immune?: readonly string[];
  chances?: StageArbiterChances;
}

/** The order of the plain damage types in `measures.arbiter`. */
const DAMAGE_TYPES = ['physical', 'fire', 'cold', 'lightning', 'chaos'];
const capitalised = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

/** The verdict of a ratio (D-353): below 1 the stage survives the hit, else it is one-shot. */
export const arbiterVerdict = (ratio: number): ArbiterVerdict => (ratio < 1 ? 'survives' : 'one-shot');

/** One hit read against a set of max hits: its ratio, verdict, max hit and parts (a mixed hit), and whether it is immune. */
interface HitRead {
  ratio: number | null;
  verdict: ArbiterVerdict | null;
  maxHit: number | null;
  parts?: ArbiterPart[];
  immune: boolean;
}

/**
 * D-353, WU-120 (D-449): a hit's top roll against `maxHits` (`<Type>MaximumHitTaken` by field). A type in `immune` counts
 * 0; a max hit of 0 is a one-shot with no ratio; a type PoB gave no finite max hit for has no verdict. A mixed hit's
 * parts are its top roll split evenly between its types (the data's split is "half converted"), their ratios summed.
 */
function readHit(hit: ArbiterHit, maxHits: Readonly<Record<string, number>>, immune: ReadonlySet<string>): HitRead {
  type Read = { kind: 'immune' } | { kind: 'value'; value: number } | { kind: 'none' };
  const maxHitOf = (type: string): Read => {
    if (immune.has(type)) return { kind: 'immune' };
    const v = maxHits[`${capitalised(type)}MaximumHitTaken`];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? { kind: 'value', value: v } : { kind: 'none' };
  };
  if (hit.types.length === 1) {
    const m = maxHitOf(hit.types[0]);
    if (m.kind === 'immune') return { ratio: 0, verdict: 'survives', maxHit: null, immune: true };
    if (m.kind === 'none') return { ratio: null, verdict: null, maxHit: null, immune: false };
    if (m.value === 0) return { ratio: null, verdict: 'one-shot', maxHit: 0, immune: false };
    const ratio = hit.max / m.value;
    return { ratio, verdict: arbiterVerdict(ratio), maxHit: m.value, immune: false };
  }
  const reads = hit.types.map((type) => ({ type, share: hit.max / hit.types.length, m: maxHitOf(type) }));
  const parts: ArbiterPart[] = reads.map(({ type, share, m }) =>
    m.kind === 'immune'
      ? { type, hit: share, maxHit: null, ratio: 0, immune: true as const }
      : m.kind === 'none'
        ? { type, hit: share, maxHit: null, ratio: null }
        : { type, hit: share, maxHit: m.value, ratio: m.value === 0 ? null : share / m.value },
  );
  if (reads.some((r) => r.m.kind === 'none')) return { ratio: null, verdict: null, maxHit: null, parts, immune: false };
  if (reads.some((r) => r.m.kind === 'value' && r.m.value === 0)) return { ratio: null, verdict: 'one-shot', maxHit: 0, parts, immune: false };
  const ratio = parts.reduce((sum, p) => sum + p.ratio!, 0);
  return { ratio, verdict: arbiterVerdict(ratio), maxHit: ratio === 0 ? null : hit.max / ratio, parts, immune: reads.every((r) => r.m.kind === 'immune') };
}

/**
 * WU-120 (D-449): a hit read deflected. `pass`: against the max hits of the deflected pass. `formula`: the full read's
 * ratio × (1 − `deflectEffect` / 100), exact without armour and optimistic with it (PoB applies armour to the full hit
 * first); an immune hit stays 0 and a max hit of 0 stays a one-shot.
 */
function readDeflected(
  hit: ArbiterHit,
  full: HitRead,
  deflected: { maxHits: Readonly<Record<string, number>>; immune: ReadonlySet<string> } | null,
  deflectEffect: number,
): HitRead {
  if (deflected !== null) return readHit(hit, deflected.maxHits, deflected.immune);
  if (full.verdict === null || full.ratio === null) return { ...full, parts: undefined };
  const ratio = full.ratio * (1 - deflectEffect / 100);
  return { ratio, verdict: arbiterVerdict(ratio), maxHit: ratio === 0 ? null : hit.max / ratio, immune: full.immune };
}

/**
 * WU-120 (D-449; Names): the share of one hit the build survives, 0 to 100: 100 when it survives the full hit; else the
 * evade chance plus (100 − the evade chance) × the deflect chance / 100 when it survives the deflected hit; else the
 * evade chance. Null when the full hit has no verdict.
 */
function hitSurvived(full: HitRead, deflected: HitRead | null, evade: number, deflect: number): number | null {
  if (full.verdict === null) return null;
  if (full.verdict === 'survives') return 100;
  if (deflect > 0 && deflected?.verdict === 'survives') return evade + ((100 - evade) * deflect) / 100;
  return evade;
}

/**
 * D-353: for each damage type the Arbiter deals, its largest hit's top roll over the stage's
 * `<Type>MaximumHitTaken`; for each mixed hit, the largest of that mix, its parts' ratios summed (a part is
 * the top roll split evenly between the mix's types: the data's split is "half converted"). `survives`
 * below 1, else `one-shot`.
 *
 * WU-120 (amendment 12 §4, D-449): `outputs` are the Pinnacle pass's max hits when the compile has them. A type in
 * `inputs.immune` reads ratio 0, `survives`, `immune: true` (a mixed row's immune part counts 0); a max hit of 0 is a
 * one-shot. Every hit of a row's type is read with its own ratio and `evadable` fact: the row keeps its largest hit's
 * ratio and verdict, and its `hitsSurvived` is the least over the type's hits (`hitSurvived`), at the chances at the
 * Arbiter (`inputs.chances`; none, 0). With a deflect chance above 0, each row has its largest hit's `deflectedRatio` and
 * `deflectedVerdict`, by the deflected pass's max hits (`method: pass`) or the formula. `avoid` is given when the evade
 * or the deflect chance is above 0, with `companionDeflected` on a build whose companion takes part of each deflected hit
 * (PG-100).
 */
export function arbiterMeasure(outputs: Readonly<Record<string, number>>, hits: readonly ArbiterHit[], inputs: ArbiterInputs = {}): ArbiterMeasure {
  const immune = new Set(inputs.immune ?? []);
  const chances = inputs.chances;
  const evade = chances?.evade ?? 0;
  const deflect = chances?.deflect ?? 0;
  const deflectEffect = chances?.deflectEffect ?? 0;
  const pass = deflect > 0 && chances?.deflected !== undefined ? { maxHits: chances.deflected.maxHits, immune: new Set(chances.deflected.immune) } : null;
  const byType = new Map<string, ArbiterHit[]>();
  for (const hit of hits) {
    const key = hit.types.join('-');
    byType.set(key, [...(byType.get(key) ?? []), hit]);
  }
  const keys = [...byType.keys()].sort((a, b) => {
    const rank = (k: string) => (k.includes('-') ? DAMAGE_TYPES.length : Math.max(0, DAMAGE_TYPES.indexOf(k)));
    return rank(a) - rank(b);
  });
  const rows: ArbiterRow[] = keys.map((key) => {
    const ofType = byType.get(key)!;
    // The largest hit of the type: the first of the largest top roll, in file order.
    const hit = ofType.reduce((best, h) => (h.max > best.max ? h : best));
    let least: number | null | undefined;
    let row: ArbiterRow | undefined;
    for (const h of ofType) {
      const full = readHit(h, outputs, immune);
      const deflected = deflect > 0 ? readDeflected(h, full, pass, deflectEffect) : null;
      const survived = hitSurvived(full, deflected, h.evadable === false ? 0 : evade, deflect);
      least = least === undefined ? survived : least === null || survived === null ? null : Math.min(least, survived);
      if (h !== hit) continue;
      row = {
        type: key,
        mixed: h.types.length > 1,
        hitId: h.id,
        hit: h.max,
        maxHit: full.maxHit,
        ratio: full.ratio,
        verdict: full.verdict,
        ...(full.parts !== undefined ? { parts: full.parts } : {}),
        ...(full.immune ? { immune: true as const } : {}),
        deflectedRatio: deflected?.ratio ?? null,
        deflectedVerdict: deflected?.verdict ?? null,
      };
    }
    return { ...row!, hitsSurvived: least ?? null };
  });
  const verdict: ArbiterVerdict | null = rows.some((r) => r.verdict === 'one-shot')
    ? 'one-shot'
    : rows.length > 0 && rows.every((r) => r.verdict === 'survives')
      ? 'survives'
      : null;
  let worst: ArbiterMeasure['worst'] = null;
  for (const r of rows) if (r.ratio !== null && (worst === null || r.ratio > worst.ratio)) worst = { type: r.type, hitId: r.hitId, ratio: r.ratio };
  const out: ArbiterMeasure = { verdict, worst, rows };
  if (chances !== undefined && (evade > 0 || deflect > 0)) {
    out.avoid = { accuracy: chances.accuracy, evade, deflect, deflectEffect, method: deflect > 0 && pass === null ? 'formula' : chances.method };
    // PG-100: a companion's share of deflected hits, for the gate's note.
    if ((chances.companionDeflected ?? 0) > 0) out.avoid.companionDeflected = chances.companionDeflected;
  }
  return out;
}

/**
 * WU-120 (amendment 12, Names): a rung's deciding row, from which every single Arbiter figure of the rung comes: its
 * one-shot row with the lowest hits survived (of two alike, the larger ratio; a row without a ratio, a max hit of 0,
 * counts as the largest), else its row with the largest ratio (`worst`). A record without hits survived reads 0, so its
 * deciding row is its worst. Null when no row has a ratio and none is one-shot.
 */
export function decidingRow(arbiter: Pick<ArbiterMeasure, 'rows' | 'worst'>): ArbiterRow | null {
  const ratioOf = (r: ArbiterRow) => r.ratio ?? Number.POSITIVE_INFINITY;
  let pick: ArbiterRow | null = null;
  for (const r of arbiter.rows) {
    if (r.verdict !== 'one-shot') continue;
    const [hs, best] = [r.hitsSurvived ?? 0, pick?.hitsSurvived ?? 0];
    if (pick === null || hs < best || (hs === best && ratioOf(r) > ratioOf(pick))) pick = r;
  }
  if (pick !== null) return pick;
  const worst = arbiter.worst;
  return worst === null ? null : (arbiter.rows.find((r) => r.type === worst.type && r.hitId === worst.hitId) ?? null);
}

// ---------------------------------------------------------------------------------------------------
// The toughness reading (WU-120; amendment 12 §4, D-449)

/** A max hit and its damage type (lowercase). */
export interface MaxHit {
  type: string;
  value: number;
}

/**
 * `measures.toughness.chance` (D-449): PoB's `ConfiguredNotHitChance` and `ConfiguredDamageChance` (percent;
 * `Modules/CalcDefence.lua`:2051-2061, :3310), `factor` = 1 ÷ ((1 − notHit/100) × damage/100), the EHP multiple the chance
 * layers give, and `share` = 1 − 1 ÷ `factor`, the part of the EHP that evade, block and deflection make. With nothing
 * getting through (a product of 0), `factor` is null and `share` 1.
 */
export interface ChanceMeasure {
  notHit: number;
  damage: number;
  factor: number | null;
  share: number;
}

/** `measures.toughness.conditioned` (D-449): the conditioned read's `TotalEHP` and lowest max hit, on `n`. */
export interface ConditionedMeasure {
  ehp: number | null;
  lowestMaxHit: MaxHit | null;
}

/**
 * `measures.toughness` (D-449), on every variant stage: the lowest max hit of the stage's own measure (map monsters) and
 * the types PoB makes it immune to, which the lowest max hit leaves out; the chance layers; on `n`, the conditioned read.
 * Null fields where PoB gives none.
 */
export interface ToughnessMeasure {
  lowestMaxHit: MaxHit | null;
  immune: string[];
  chance: ChanceMeasure | null;
  conditioned?: ConditionedMeasure;
}

/** The conditioned read `compile_stage` gives on `n` (D-449). */
export interface ConditionedReply {
  ehp?: number;
  maxHits: Readonly<Record<string, number>>;
  immune: readonly string[];
}

/**
 * D-449: the least of the five `<Type>MaximumHitTaken` in `maxHits` with its type, the immune types left out; of two
 * alike, the first in the order physical, fire, cold, lightning, chaos. Null when none is finite.
 */
export function lowestMaxHitOf(maxHits: Readonly<Record<string, number>>, immune: readonly string[] = []): MaxHit | null {
  let low: MaxHit | null = null;
  for (const type of DAMAGE_TYPES) {
    if (immune.includes(type)) continue;
    const v = maxHits[`${capitalised(type)}MaximumHitTaken`];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (low === null || v < low.value) low = { type, value: v };
  }
  return low;
}

/** D-449: the chance layers from a stage's outputs (`ChanceMeasure`); null when PoB gives either chance as no number. */
export function chanceOf(outputs: Readonly<Record<string, number>>): ChanceMeasure | null {
  const [notHit, damage] = [outputs.ConfiguredNotHitChance, outputs.ConfiguredDamageChance];
  if (typeof notHit !== 'number' || !Number.isFinite(notHit) || typeof damage !== 'number' || !Number.isFinite(damage)) return null;
  const taken = (1 - notHit / 100) * (damage / 100);
  if (!(taken > 0)) return { notHit, damage, factor: null, share: 1 };
  const factor = 1 / taken;
  return { notHit, damage, factor, share: 1 - 1 / factor };
}

/**
 * D-449: a variant stage's toughness from its own outputs and immune types (`compile_stage`'s `immune`), with the
 * conditioned read on `n`.
 */
export function toughnessOf(outputs: Readonly<Record<string, number>>, immune: readonly string[], conditioned?: ConditionedReply): ToughnessMeasure {
  return {
    lowestMaxHit: lowestMaxHitOf(outputs, immune),
    immune: [...immune],
    chance: chanceOf(outputs),
    ...(conditioned !== undefined
      ? {
          conditioned: {
            ehp: typeof conditioned.ehp === 'number' && Number.isFinite(conditioned.ehp) ? conditioned.ehp : null,
            lowestMaxHit: lowestMaxHitOf(conditioned.maxHits, conditioned.immune),
          },
        }
      : {}),
  };
}

export type ClearSpeed = 'slow' | 'medium' | 'fast';
const CLEAR_SPEEDS: readonly ClearSpeed[] = ['slow', 'medium', 'fast'];

/**
 * D-353: the phrase list for "its gem text explodes monsters or spreads an effect on death". A sentence of a
 * clear-group gem's description counts when it holds a death phrase and an explode or spread phrase
 * (`Enemies ... will Combust on death`, `explode in a Plague Burst on death`, `spreading their effects when a
 * Cursed enemy dies`).
 */
export const ON_DEATH_PHRASES: readonly RegExp[] = [/\bon death\b/i, /\bdies\b/i, /\bdie\b/i, /\bkilled\b/i, /\bkilling\b/i, /\bon kill\b/i];
export const SPREAD_PHRASES: readonly RegExp[] = [/\bexplod(e|es|ing)\b/i, /\bexplosions?\b/i, /\bburst\b/i, /\bcombust(s)?\b/i, /\bspread(s|ing)?\b/i];

/** Whether a gem text explodes monsters or spreads an effect on death (the phrase list). */
export function explodesOnDeath(text: string): boolean {
  return text
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => ON_DEATH_PHRASES.some((re) => re.test(sentence)) && SPREAD_PHRASES.some((re) => re.test(sentence)));
}

/** `measures.clearSpeed`: a rough label, assuming a normal monster dies to one use (D-353, Q2). */
export interface ClearSpeedMeasure {
  speed: ClearSpeed;
  /** Always true: an estimate from the area, the gem text and the use time, not a measurement. */
  rough: true;
  /** The clear skill: its group (1-based), its breakdown key and skill name; null when the stage has none. */
  group: number | null;
  key: string | null;
  skill: string | null;
  /**
   * Its `AreaOfEffectRadiusMetres` (a minion's `MinionAreaOfEffectRadiusMetres`, D-378), 0 when PoB gives none. WU-102: a
   * clear group with `weaponSet: 2` is read from `skillOutputsSet2` (`groupFigures`), this and its uses per second.
   */
  radiusMetres: number;
  /** The band by the radius alone: below 2 m slow, below 4 m medium, else fast. */
  band: ClearSpeed;
  /**
   * D-407: PoB gives the clear skill no area (no radius above 0, as for a Skeletal Warrior's strike), so its band is
   * `slow` for want of a radius, not from a small one: a display says "slow (PoB gives no area)". True too when the
   * stage has no clear skill to read (`skill` null).
   */
  noArea: boolean;
  /** One step faster: a gem text of its group explodes monsters or spreads an effect on death. */
  onDeath: boolean;
  /** Its uses per second (`Speed`, a minion's `MinionSpeed`), null when PoB gives none. */
  usesPerSecond: number | null;
  /** One step slower: a use takes over 1 second (`Speed` below 1, an estimate). */
  longUse: boolean;
  /**
   * D-427 (§24.2): the stage's travel skill, beside the movement speed: the first enabled group, other than the clear
   * group, whose active skill has PoB's Travel skill type (`travelOf`); null when the stage has none. The band stays
   * radius-based: PoB gives no distance per use, so no pace is computed. Absent from records written before M-22.
   */
  travel?: TravelMeasure | null;
}

/** D-427: a stage's travel skill: its group (the plan's number), its name and its uses per second (`Speed`). */
export interface TravelMeasure {
  group: number;
  skill: string;
  /** PoB's `Speed` for the skill, measured with its group's weapon set active; null when PoB gives none. */
  usesPerSecond: number | null;
}

/** D-427: an active skill with PoB's Travel skill type, as `compile_stage` reports it (`travelSkills`). */
export interface TravelSkill {
  group: number;
  activeSkill: number;
  skill: string;
}

/**
 * WU-102 (D-426): the figures a group is read from, those of its own weapon set: `skillOutputsSet2` for a group with
 * `weaponSet: 2` when the record has it, else `skillOutputs`. On a stage measured with set 2 active
 * (`items.useSecondWeaponSet`), `skillOutputs` is set 2's too, and the stage has no set-1 measure.
 */
export function groupFigures(
  stage: Pick<Stage, 'skills'>,
  rec: Pick<StageRecord, 'skillOutputs' | 'skillOutputsSet2'>,
  group: number,
): StageRecord['skillOutputs'] {
  return stage.skills.groups[group - 1]?.weaponSet === 2 && rec.skillOutputsSet2 !== undefined ? rec.skillOutputsSet2 : rec.skillOutputs;
}

/**
 * D-427 (§24.2): the clear measure's `travel`: of the stage's travel skills (`compile_stage`'s `travelSkills`, each an
 * enabled group's active skill with PoB's Travel type), the first by group number, then active skill, whose group isn't
 * the clear group (`clearGroupOf`). Its uses per second are PoB's `Speed` at its first stat set, from the figures of
 * its group's weapon set: `skillOutputsSet2` for a group on set 2 (WU-102) when the record has it, else
 * `skillOutputs`. Null when no such skill is there.
 */
export function travelOf(
  stage: Pick<Stage, 'skills'>,
  rec: Pick<StageRecord, 'skillOutputs' | 'skillOutputsSet2' | 'minionSkills'>,
  travelSkills: readonly TravelSkill[],
): TravelMeasure | null {
  const clear = clearGroupOf(stage, rec)?.group ?? null;
  const pick = [...travelSkills]
    .sort((a, b) => a.group - b.group || a.activeSkill - b.activeSkill)
    .find((t) => t.group !== clear);
  if (pick === undefined) return null;
  const figures = groupFigures(stage, rec, pick.group);
  const speed = figures[selectionKey({ group: pick.group, activeSkill: pick.activeSkill, statSet: 1 })]?.fields.Speed;
  return { group: pick.group, skill: pick.skill, usesPerSecond: typeof speed === 'number' && Number.isFinite(speed) ? speed : null };
}

/** The band of a radius (D-353): below 2 m slow, from 2 m below 4 m medium, 4 m or more fast. */
export function clearBand(radiusMetres: number): ClearSpeed {
  return radiusMetres < 2 ? 'slow' : radiusMetres < 4 ? 'medium' : 'fast';
}

/**
 * D-353: the band, a step faster for an on-death effect, a step slower for a long use, kept within the bands. D-407:
 * `noArea` when PoB gives no radius above 0; the steps still apply, as D-353 sets them.
 */
export function clearSpeedOf(input: {
  radiusMetres: number | undefined;
  usesPerSecond: number | undefined;
  texts: readonly string[];
  group?: number | null;
  key?: string | null;
  skill?: string | null;
}): ClearSpeedMeasure {
  const radiusMetres = typeof input.radiusMetres === 'number' && Number.isFinite(input.radiusMetres) ? input.radiusMetres : 0;
  const usesPerSecond = typeof input.usesPerSecond === 'number' && Number.isFinite(input.usesPerSecond) ? input.usesPerSecond : null;
  const band = clearBand(radiusMetres);
  const noArea = !(radiusMetres > 0);
  const onDeath = input.texts.some(explodesOnDeath);
  const longUse = usesPerSecond !== null && usesPerSecond < 1;
  const at = CLEAR_SPEEDS.indexOf(band) + (onDeath ? 1 : 0) - (longUse ? 1 : 0);
  return {
    speed: CLEAR_SPEEDS[Math.min(CLEAR_SPEEDS.length - 1, Math.max(0, at))],
    rough: true,
    group: input.group ?? null,
    key: input.key ?? null,
    skill: input.skill ?? null,
    radiusMetres,
    band,
    noArea,
    onDeath,
    usesPerSecond,
    longUse,
  };
}

/**
 * The clear skill (D-353): the first enabled `clear` group, else the main group; null for neither. A clear group
 * that isn't the main group is measured at its first active skill, or, when it names a minion skill, at its summon
 * (its resolved selection's `activeSkill` in `rec`, D-378): a Pounce group's summon is its second skill.
 */
export function clearGroupOf(
  stage: Pick<Stage, 'skills'>,
  rec?: Pick<StageRecord, 'minionSkills'>,
): { group: number; activeSkill: number; statSet: number } | null {
  const main = stage.skills.main;
  const k = stage.skills.groups.findIndex((g) => g.enabled && g.role === 'clear');
  if (k >= 0 && k + 1 !== main.group) {
    const minion = rec !== undefined ? minionSkillOf(rec, k + 1) : undefined;
    return { group: k + 1, activeSkill: minion?.activeSkill ?? 1, statSet: 1 };
  }
  return stage.skills.groups[main.group - 1]
    ? { group: main.group, activeSkill: main.activeSkill, statSet: main.statSet ?? 1 }
    : null;
}

/** The names of the clear skill's group's enabled gems, the skill and its supports, whose texts it reads. */
export function clearGemNames(stage: Pick<Stage, 'skills'>): string[] {
  const clear = clearGroupOf(stage);
  if (clear === null) return [];
  return stage.skills.groups[clear.group - 1].gems.filter((g) => g.enabled).map((g) => g.name);
}

/**
 * D-377: a group's resolved minion selection in the record (`minionSkills`): the group, its summon (the active
 * skill's index and name), the minion, the skill's name, its index in the minion's live skill list (`skills`) and
 * its stat set with the skill's stat-set labels.
 */
export interface MinionSkillRecord {
  group: number;
  activeSkill: number;
  summon?: string;
  minion: string;
  minionId: string;
  name: string;
  index: number;
  statSet: number;
  statSets: string[];
  skills: string[];
}

/** The stage's resolved minion selection of `group` (1-based), when the group names a minion skill. */
export function minionSkillOf(rec: Pick<StageRecord, 'minionSkills'>, group: number): MinionSkillRecord | undefined {
  return (rec.minionSkills ?? []).find((m) => m.group === group);
}

/** A skill selection: a group, its active skill and its stat set (1 when absent), as `skills.main` holds it. */
export interface SkillSelection {
  group: number;
  activeSkill: number;
  statSet?: number;
}

/** The record key of a selection's figures, `g<group>s<activeSkill>p<statSet>` (C-45). */
export function selectionKey(sel: SkillSelection): string {
  return `g${sel.group}s${sel.activeSkill}p${sel.statSet ?? 1}`;
}

/**
 * D-385, D-388, D-397: whether a skill's measured figures are its minion's. PoB measures a summon by its minion and
 * gives the minion's numbers as `Minion<Field>` fields (D-376), so the skill's fields carry one: a plain summon such
 * as Skeletal Warrior, which names no minion skill, too. The checker's test (`check-run.mjs`, `summonsMinion`) and
 * `get_passive_upgrades`' (a main output with `MinionTotalDPS`).
 */
export function summonsMinion(fields: Readonly<Record<string, unknown>> | undefined): boolean {
  return Object.keys(fields ?? {}).some((field) => /^Minion[A-Z]/.test(field));
}

/**
 * D-378, D-397: whether a group's figures at a record key are its minion's: the group names a minion skill (the
 * record holds its resolved selection), or the skill at the key summons a minion (its `skillOutputs` entry carries
 * `Minion<Field>` fields, `summonsMinion`). The damage figure (`figureField`) and the clear measure
 * (`stageMeasures`) both decide by it.
 */
export function minionFigures(rec: Pick<StageRecord, 'minionSkills' | 'skillOutputs'>, group: number, key: string): boolean {
  return minionSkillOf(rec, group) !== undefined || summonsMinion(rec.skillOutputs[key]?.fields);
}

/**
 * D-378, D-397: the field of a group's damage figure at a selection's key: `MinionTotalDPS` when its figures are its
 * minion's (`minionFigures`), else `TotalDPS`.
 */
export function figureField(rec: Pick<StageRecord, 'minionSkills' | 'skillOutputs'>, sel: SkillSelection): 'MinionTotalDPS' | 'TotalDPS' {
  return minionFigures(rec, sel.group, selectionKey(sel)) ? 'MinionTotalDPS' : 'TotalDPS';
}

/**
 * The clear skill's breakdown entry. D-363: the stat set the plan's main selection names when the clear skill is
 * the main skill, else its first stat set, the one PoB selects by default, so the measure doesn't depend on a
 * stat set whose radius PoB resolves in hash order (Earthquake's Aftershock).
 */
export function clearEntryOf(
  stage: Pick<Stage, 'skills'>,
  skillOutputs: StageRecord['skillOutputs'],
  rec?: Pick<StageRecord, 'minionSkills'>,
): { group: number; key: string; skill: string; fields: Record<string, number> } | null {
  const clear = clearGroupOf(stage, rec);
  if (clear === null) return null;
  const key = `g${clear.group}s${clear.activeSkill}p${clear.statSet}`;
  const e = skillOutputs[key];
  return e === undefined ? null : { group: clear.group, key, skill: e.skill, fields: e.fields };
}

/**
 * The headline (D-294, D-378, D-397): the main group's Count-scaled figure (`figureField`: `MinionTotalDPS` for a
 * group that names a minion skill or whose skill summons a minion, else `TotalDPS`),
 * `countedSkillOutputs[g<main.group>s<main.activeSkill>p<main.statSet>].fields.<figure>`, else the main skill's
 * counted figure; null when PoB measured none.
 */
export function headlineDps(
  stage: { skills: Pick<Stage['skills'], 'main'> },
  rec: Pick<StageRecord, 'countedOutputs' | 'countedSkillOutputs' | 'minionSkills' | 'skillOutputs'>,
): number | null {
  const m = stage.skills.main;
  const key = selectionKey(m);
  const field = figureField(rec, m);
  const v = rec.countedSkillOutputs[key]?.fields[field] ?? rec.countedOutputs.fields[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------------------------------
// One damage figure, against map monsters and a boss (WU-111; amendment 11 §5, §9b; D-437, D-447)

/** The ailments PoB caps at one per enemy unless the skill lets them stack, and each one's field (a minion's too). */
export const BOSS_AILMENTS = [
  { key: 'ignite', field: 'IgniteDPS', minion: 'MinionIgniteDPS' },
  { key: 'bleed', field: 'BleedDPS', minion: 'MinionBleedDPS' },
  { key: 'poison', field: 'PoisonDPS', minion: 'MinionPoisonDPS' },
] as const;
export type BossAilment = (typeof BOSS_AILMENTS)[number]['key'];

/** The fields the boss measure reads per skill beside C-45's and `MEASURE_FIELDS`: a minion's ailments (D-447). */
export const BOSS_MEASURE_FIELDS: readonly string[] = BOSS_AILMENTS.map((a) => a.minion);

/**
 * The damage figure (amendment 11's Names, D-437, WU-106's group figure) of one skill and stat set's `fields`, with its
 * group's `count`: `TotalDPS` × count, `TotalDot` × count only when its damage over time stacks (`dotCanStack`), and
 * `IgniteDPS`, `BleedDPS` and `PoisonDPS` once, each field PoB gives (`COUNT_RULE`); a minion's (`minion`, D-378,
 * D-397) is its `MinionTotalDPS` × count. Null when PoB gives none of them.
 */
export function damageFigure(
  fields: Readonly<Record<string, number>> | undefined,
  count: number,
  dotCanStack: boolean,
  minion: boolean,
): number | null {
  if (fields === undefined) return null;
  const num = (f: string): number | null => (typeof fields[f] === 'number' && Number.isFinite(fields[f]) ? fields[f] : null);
  if (minion) {
    const v = num('MinionTotalDPS');
    return v === null ? null : v * count;
  }
  const parts: [string, number][] = [
    ['TotalDPS', count],
    ['TotalDot', dotCanStack ? count : 1],
    ['IgniteDPS', 1],
    ['BleedDPS', 1],
    ['PoisonDPS', 1],
  ];
  let total: number | null = null;
  for (const [field, scale] of parts) {
    const v = num(field);
    if (v !== null) total = (total ?? 0) + v * scale;
  }
  return total;
}

/** `measures.damage` (D-437): the named source's damage figure against map monsters and against a Pinnacle boss. */
export interface DamageMeasure {
  /** Against map monsters (the stage's own config); times the named source's `CullMultiplier` with `skills.cull`. */
  map: number | null;
  /** PoB alone against a Pinnacle boss (`bossDamage`): the untriggered rotation entries' sum, never culled. */
  boss: number | null;
  /**
   * WU-120 (amendment 12 §9, D-454): the resisting figure, against the map enemy with 40% fire, cold and lightning
   * resistance (the waystone modifier's top roll), curses at full strength; times its `CullMultiplier` with `skills.cull`,
   * as the map figure. Absent from records written before amendment 12.
   */
  resisting?: number | null;
}

/** `measures.cull` (D-437): the named source's `CullPercent` (0–100) against map monsters and a Pinnacle boss. */
export interface CullMeasure {
  map: number;
  boss: number;
}

/**
 * `measures.trigger` (D-437): the named source's group holds a gem of PoB's skill types `Meta` and `Triggers` (Cast on
 * Critical and its kind): `by` is its name, and `usesPerSecond` the named source's `Speed` as PoB rates it, its hand-cast
 * speed (PoB doesn't model Energy).
 */
export interface TriggerMeasure {
  by: string;
  usesPerSecond: number | null;
}

/**
 * One entry of `measures.bossGroups` (D-447, Appendix A): a boss rotation entry measured against a Pinnacle boss. `figure`
 * is its damage figure (`damageFigure`, Count applied); `usesPerSecond` its `Speed` (a minion's `MinionSpeed`);
 * `triggered` PoB's own trigger test (`isTriggered`) and `triggeredBy` the meta gem that triggers it, null for an inbuilt
 * or item trigger or an untriggered entry; `turns` the plan's; `ignite`, `bleed` and `poison` its ailment figures
 * (`IgniteDPS` and so on, a minion's `MinionIgniteDPS`) when PoB doesn't let that ailment stack, else 0.
 */
export interface BossGroupMeasure {
  group: number;
  activeSkill: number;
  statSet: number;
  figure: number | null;
  usesPerSecond: number | null;
  triggered: boolean;
  triggeredBy: string | null;
  turns: boolean;
  ignite: number;
  bleed: number;
  poison: number;
}

/** PoB's skill types that mark a meta gem that triggers its socketed skills (D-437). */
export const META_TRIGGER_TYPES: readonly string[] = ['Meta', 'Triggers'];

/**
 * The boss measure `compile_stage` gives with `boss` in its params (D-437, D-447). WU-120 (D-449): with the Pinnacle
 * pass's max hits and immune types, and on `b` and `n` the chances at the Arbiter.
 */
export interface BossMeasureReply {
  skillOutputs: StageRecord['skillOutputs'];
  skillMeta: Readonly<Record<string, StageSkillMeta>>;
  maxHits?: Readonly<Record<string, number>>;
  immune?: readonly string[];
  arbiter?: StageArbiterChances;
}

/** WU-120 (D-454): the resisting measure `compile_stage` gives with `resisting` in its params, keyed as `skillOutputs`. */
export interface ResistingMeasureReply {
  skillOutputs: StageRecord['skillOutputs'];
  skillMeta: Readonly<Record<string, StageSkillMeta>>;
}

/** What the new measures read of `compile_stage`'s reply besides the record (WU-111). */
export interface MeasureInputs {
  /** Each `skillOutputs` key's meta. */
  skillMeta?: Readonly<Record<string, StageSkillMeta>>;
  /** Each `skillOutputsSet2` key's meta. */
  skillMetaSet2?: Readonly<Record<string, StageSkillMeta>>;
  /** The boss measure, on a variant stage. */
  boss?: BossMeasureReply;
  /** WU-120 (D-449): the types whose max hit PoB makes infinite in the stage's own measure. */
  immune?: readonly string[];
  /** WU-120 (D-454): the resisting measure, on a variant stage. */
  resisting?: ResistingMeasureReply;
  /** WU-120 (D-449): the conditioned read, on `n`. */
  conditioned?: ConditionedReply;
}

/** The named source's selection, as a rotation entry (stat set 1 when `skills.main` names none). */
export function namedSource(stage: Pick<Stage, 'skills'>): { group: number; activeSkill: number; statSet: number } {
  const m = stage.skills.main;
  return { group: m.group, activeSkill: m.activeSkill, statSet: m.statSet ?? 1 };
}

/**
 * WU-111 (D-447): the boss rotation's entries: `skills.boss.entries`, or the named source alone (with `turns` false)
 * when the stage states none.
 */
export function bossRotation(stage: Pick<Stage, 'skills'>): { group: number; activeSkill: number; statSet: number; turns: boolean }[] {
  const entries = stage.skills.boss?.entries;
  if (entries === undefined || entries.length === 0) return [{ ...namedSource(stage), turns: false }];
  return entries.map((e) => ({ group: e.group, activeSkill: e.activeSkill, statSet: e.statSet, turns: e.turns === true }));
}

/** The plan groups the boss measure reads (D-447): the named source's, then each rotation entry's, each once. */
export function bossMeasureGroups(stage: Pick<Stage, 'skills'>): number[] {
  return [...new Set([stage.skills.main.group, ...bossRotation(stage).map((e) => e.group)])];
}

const finiteOr = <T>(v: unknown, or: T): number | T => (typeof v === 'number' && Number.isFinite(v) ? v : or);

/** A group's Count: the plan's `count`, 1 when it has none. */
const countOf = (stage: Pick<Stage, 'skills'>, group: number): number => stage.skills.groups[group - 1]?.count ?? 1;

/** Whether a group's figures are its minion's (D-378, D-397): it names a minion skill, or its fields carry `Minion<Field>`s. */
const minionAt = (rec: Pick<StageRecord, 'minionSkills'>, group: number, fields: Readonly<Record<string, number>> | undefined): boolean =>
  minionSkillOf(rec, group) !== undefined || summonsMinion(fields);

/** A rotation entry against a Pinnacle boss, with whether its ailments are part of its figure (not a minion's). */
export type BossGroupInput = BossGroupMeasure & { inFigure: boolean };

/**
 * One rotation entry against a Pinnacle boss (D-447), from the boss measure: its figure (Count and the boss measure's own
 * `DotCanStack` applied), uses per second, PoB's trigger test, the plan's `turns`, and each ailment that doesn't stack.
 * `inFigure` is true when its ailments are part of its figure (not a minion's: a minion's figure is `MinionTotalDPS`).
 */
export function bossGroupOf(
  stage: Pick<Stage, 'skills'>,
  rec: Pick<StageRecord, 'minionSkills'>,
  boss: BossMeasureReply,
  entry: { group: number; activeSkill: number; statSet: number; turns: boolean },
): BossGroupInput {
  const key = selectionKey(entry);
  const fields = boss.skillOutputs[key]?.fields;
  const meta = boss.skillMeta[key];
  const minion = minionAt(rec, entry.group, fields);
  const ailment = (a: (typeof BOSS_AILMENTS)[number]): number =>
    meta?.stacks[a.key] === true ? 0 : finiteOr(fields?.[minion ? a.minion : a.field], 0);
  return {
    group: entry.group,
    activeSkill: entry.activeSkill,
    statSet: entry.statSet,
    figure: damageFigure(fields, countOf(stage, entry.group), meta?.stacks.dot === true, minion),
    usesPerSecond: finiteOr(fields?.[minion ? 'MinionSpeed' : 'Speed'], null),
    triggered: meta?.triggered === true,
    triggeredBy: meta?.triggered === true ? (meta.triggeredBy ?? null) : null,
    turns: entry.turns,
    ignite: ailment(BOSS_AILMENTS[0]),
    bleed: ailment(BOSS_AILMENTS[1]),
    poison: ailment(BOSS_AILMENTS[2]),
    inFigure: !minion,
  };
}

/**
 * `measures.damage.boss`, PoB alone (D-447): the untriggered entries' figures summed, an ailment that doesn't stack
 * counted once, at its largest entry (as PoB's own Full DPS keeps the largest, `Calcs.lua:192-196`): each entry's
 * non-stacking ailments are taken out of its figure and the largest of each ailment over the entries added back. A
 * minion's ailments aren't part of its figure (`MinionTotalDPS`), so they are listed and take no part in the sum. A
 * triggered entry is listed but not summed (PoB rates it at its hand-cast speed). When no entry can be summed, it is
 * `fallback`, the named source's figure at its hand-cast speed.
 */
export function bossDamage(groups: readonly BossGroupInput[], fallback: number | null): number | null {
  const summed = groups.filter((g) => !g.triggered && g.figure !== null);
  if (summed.length === 0) return fallback;
  let total = 0;
  for (const g of summed) total += g.figure! - (g.inFigure ? g.ignite + g.bleed + g.poison : 0);
  for (const a of BOSS_AILMENTS) total += Math.max(0, ...summed.filter((g) => g.inFigure).map((g) => g[a.key]));
  return total;
}

/**
 * The named source's figures on its own weapon set (D-437): `skillOutputsSet2` and its meta for a group with
 * `weaponSet: 2` on a stage that has them, else `skillOutputs` with the counted figures' `DotCanStack`.
 */
function sourceFigures(
  stage: Pick<Stage, 'skills'>,
  rec: Pick<StageRecord, 'skillOutputs' | 'skillOutputsSet2' | 'countedSkillOutputs'>,
  pob: MeasureInputs,
): {
  fields: Readonly<Record<string, number>> | undefined;
  meta: StageSkillMeta | undefined;
  metas: Readonly<Record<string, StageSkillMeta>> | undefined;
  dotCanStack: boolean;
  figures: StageRecord['skillOutputs'];
} {
  const key = selectionKey(namedSource(stage));
  if (stage.skills.groups[stage.skills.main.group - 1]?.weaponSet === 2 && rec.skillOutputsSet2 !== undefined) {
    const meta = pob.skillMetaSet2?.[key];
    return { fields: rec.skillOutputsSet2[key]?.fields, meta, metas: pob.skillMetaSet2, dotCanStack: meta?.stacks.dot === true, figures: rec.skillOutputsSet2 };
  }
  const meta = pob.skillMeta?.[key];
  return {
    fields: rec.skillOutputs[key]?.fields,
    meta,
    metas: pob.skillMeta,
    dotCanStack: rec.countedSkillOutputs[key]?.dotCanStack ?? meta?.stacks.dot === true,
    figures: rec.skillOutputs,
  };
}

/**
 * The new measures of a measured stage (WU-111; D-437, D-441, D-447): on every one, `sourceTypes` and, when the named
 * source's group holds a gem of PoB's types `Meta` and `Triggers` (one of its active skills has both, at its first stat
 * set, on the group's weapon set), `trigger`; on a variant stage with the boss measure, `damage`, `bossGroups` and, with
 * `skills.cull`, `cull`. WU-120 (D-454): `damage.resisting` with the resisting measure.
 */
export function sourceMeasures(
  stage: Pick<Stage, 'skills' | 'variant'>,
  rec: Pick<StageRecord, 'skillOutputs' | 'skillOutputsSet2' | 'countedSkillOutputs' | 'minionSkills'>,
  pob: MeasureInputs,
): Pick<StageMeasures, 'damage' | 'cull' | 'trigger' | 'sourceTypes' | 'bossGroups'> {
  const source = namedSource(stage);
  const { fields, meta, metas, dotCanStack, figures } = sourceFigures(stage, rec, pob);
  const minion = minionAt(rec, source.group, fields);
  const out: Pick<StageMeasures, 'damage' | 'cull' | 'trigger' | 'sourceTypes' | 'bossGroups'> = {};
  const groupKeys = Object.keys(figures)
    .map((k) => ({ k, m: /^g(\d+)s(\d+)p(\d+)$/.exec(k) }))
    .filter((x) => x.m !== null && Number(x.m[1]) === source.group && Number(x.m[3]) === 1)
    .sort((a, b) => Number(a.m![2]) - Number(b.m![2]))
    .map((x) => x.k);
  const trigger = groupKeys.find((k) => META_TRIGGER_TYPES.every((t) => metas?.[k]?.types.includes(t)));
  if (trigger !== undefined) {
    out.trigger = { by: figures[trigger].skill, usesPerSecond: finiteOr(fields?.[minion ? 'MinionSpeed' : 'Speed'], null) };
  }
  out.sourceTypes = [...(meta?.types ?? [])];
  if (stage.variant === undefined || pob.boss === undefined) return out;
  const culls = stage.skills.cull !== undefined;
  const map = damageFigure(fields, countOf(stage, source.group), dotCanStack, minion);
  const groups = bossRotation(stage).map((e) => bossGroupOf(stage, rec, pob.boss!, e));
  const bossSource = bossGroupOf(stage, rec, pob.boss, { ...source, turns: false });
  out.damage = {
    map: map === null ? null : map * (culls ? finiteOr(fields?.CullMultiplier, 1) : 1),
    boss: bossDamage(groups, bossSource.figure),
  };
  // WU-120 (D-454): the resisting figure, by the map figure's rule, from the resisting measure's own fields and meta.
  if (pob.resisting !== undefined) {
    const key = selectionKey(source);
    const rFields = pob.resisting.skillOutputs[key]?.fields;
    const resisting = damageFigure(rFields, countOf(stage, source.group), pob.resisting.skillMeta[key]?.stacks.dot === true, minionAt(rec, source.group, rFields));
    out.damage.resisting = resisting === null ? null : resisting * (culls ? finiteOr(rFields?.CullMultiplier, 1) : 1);
  }
  if (culls) {
    const bossFields = pob.boss.skillOutputs[selectionKey(source)]?.fields;
    out.cull = { map: finiteOr(fields?.CullPercent, 0), boss: finiteOr(bossFields?.CullPercent, 0) };
  }
  out.bossGroups = groups.map(({ inFigure: _inFigure, ...g }) => g);
  return out;
}

/**
 * `measures`, per endgame stage (D-353, D-407; `measuredStage`). Every endgame stage, a card skeleton's included, has
 * the pace measures, `clearSpeed` and `movementSpeed`. `dps` and `ehp` are on an endgame variant stage (one with a
 * `variant`) only, and `arbiter` only on the budget and non-budget rungs. WU-111 (D-437, D-447): `sourceTypes` and
 * `trigger` on every one, `damage`, `cull` and `bossGroups` on a variant stage (`sourceMeasures`).
 */
export interface StageMeasures {
  /** On a variant stage only (D-353): the headline. */
  dps?: number | null;
  /** On a variant stage only (D-353): PoB's `TotalEHP`. */
  ehp?: number | null;
  arbiter?: ArbiterMeasure;
  clearSpeed: ClearSpeedMeasure;
  /**
   * D-407: the player's movement speed, PoB's `EffectiveMovementSpeedMod` (`MOVEMENT_SPEED_FIELD`): movement speed ×
   * action speed as a multiplier, the sidebar's "Movement Speed Modifier" (1.25 is +25%); null when PoB gives none.
   */
  movementSpeed: number | null;
  /** WU-111 (D-437): on a variant stage, the named source's damage figure against map monsters and a Pinnacle boss. */
  damage?: DamageMeasure;
  /** WU-111 (D-437): on a variant stage that states `skills.cull`, the named source's `CullPercent` under each. */
  cull?: CullMeasure;
  /** WU-111 (D-437): on any measured stage whose named source's group holds a meta gem that triggers. */
  trigger?: TriggerMeasure;
  /** WU-111 (D-437, D-441): the named source's PoB skill types, its live ones (a support's added types included). */
  sourceTypes?: string[];
  /** WU-111 (D-447): on a variant stage, the boss rotation's entries against a Pinnacle boss. */
  bossGroups?: BossGroupMeasure[];
  /**
   * WU-120 (amendment 12 §4, D-449): on a variant stage, the lowest max hit and immune types of its own measure, the chance
   * layers and, on `n`, the conditioned read. Absent from records written before amendment 12.
   */
  toughness?: ToughnessMeasure;
}

/** The rungs `measures.arbiter` is given on (D-353): `b` and `n`. */
export const ARBITER_VARIANTS: readonly string[] = ['budget', 'non-budget'];

/** D-407: the PoB output field `measures.movementSpeed` reads (`CalcDefence.lua`: `MovementSpeedMod * ActionSpeedMod`). */
export const MOVEMENT_SPEED_FIELD = 'EffectiveMovementSpeedMod';

/**
 * D-353, D-407: whether a stage gets `measures`: an endgame stage, `progress` `endgame` (a variant, or a card
 * skeleton, which has none), or any stage with a `variant`. A campaign stage (`start`, `q.<key>`) gets none.
 */
export function measuredStage(stage: Pick<Stage, 'progress' | 'variant'>): boolean {
  return stage.variant !== undefined || stage.progress === 'endgame';
}

/**
 * An endgame stage's measures from its record (D-353, D-407): the pace measures on every one; `dps`, `ehp` and, on
 * `b` and `n`, `arbiter`, on a variant stage. D-427 (WU-102): given the stage's travel skills (`compile_stage`'s
 * `travelSkills`), the clear measure carries `travel` (`travelOf`), the travel skill or null. WU-111: given the reply's
 * skill meta and boss measure (`pob`), the new measures (`sourceMeasures`).
 *
 * WU-120 (amendment 12 §4, D-449): a variant stage's `toughness` (`toughnessOf`: its own outputs and immune types, the
 * conditioned read on `n`); the Arbiter rows read the Pinnacle pass's max hits and immune types and its chances at the
 * Arbiter when the boss measure has them, else (a reply from before amendment 12) the stage's own outputs.
 */
export function stageMeasures(
  stage: Pick<Stage, 'skills' | 'variant'>,
  rec: Pick<StageRecord, 'outputs' | 'skillOutputs' | 'skillOutputsSet2' | 'countedOutputs' | 'countedSkillOutputs' | 'minionSkills'>,
  arbiterHits: readonly ArbiterHit[],
  gemTexts: Readonly<Record<string, string>>,
  travelSkills?: readonly TravelSkill[],
  pob?: MeasureInputs,
): StageMeasures {
  const ehp = rec.outputs.TotalEHP;
  const move = rec.outputs[MOVEMENT_SPEED_FIELD];
  const movementSpeed = typeof move === 'number' && Number.isFinite(move) ? move : null;
  // WU-102: the clear group's figures on its own weapon set (`groupFigures`): a clear group on set 2 reads skillOutputsSet2.
  const clearGroup = clearGroupOf(stage, rec)?.group;
  const entry = clearEntryOf(stage, clearGroup === undefined ? rec.skillOutputs : groupFigures(stage, rec, clearGroup), rec);
  // D-378, D-397: a clear skill whose figures are its minion's (a group that names a minion skill, or a plain summon)
  // is measured by its minion's area and use rate, by the damage figure's own test.
  const minion = entry !== null && minionFigures(rec, entry.group, entry.key);
  const clearSpeed: ClearSpeedMeasure = {
    ...clearSpeedOf({
      radiusMetres: entry?.fields[minion ? 'MinionAreaOfEffectRadiusMetres' : 'AreaOfEffectRadiusMetres'],
      usesPerSecond: entry?.fields[minion ? 'MinionSpeed' : 'Speed'],
      texts: clearGemNames(stage).flatMap((name) => (gemTexts[name] !== undefined ? [gemTexts[name]] : [])),
      group: entry?.group ?? null,
      key: entry?.key ?? null,
      skill: entry?.skill ?? null,
    }),
    // D-427: the travel skill beside the movement speed (the HG-12 grant for the record's `travel`).
    ...(travelSkills !== undefined ? { travel: travelOf(stage, rec, travelSkills) } : {}),
  };
  // WU-111 (D-437, D-447): the named source's types and trigger on every measured stage, its figures on a variant one.
  const added = pob !== undefined ? sourceMeasures(stage, rec, pob) : {};
  // D-407: a card skeleton (no variant) has the pace measures only (the HG-12 grant covers these two fields).
  if (stage.variant === undefined) return { clearSpeed, movementSpeed, ...added };
  const boss = pob?.boss;
  const arbiter = (): ArbiterMeasure =>
    boss?.maxHits !== undefined
      ? arbiterMeasure(boss.maxHits, arbiterHits, { immune: boss.immune ?? [], ...(boss.arbiter !== undefined ? { chances: boss.arbiter } : {}) })
      : arbiterMeasure(rec.outputs, arbiterHits, { immune: pob?.immune ?? [] });
  return {
    dps: headlineDps(stage, rec),
    ehp: typeof ehp === 'number' && Number.isFinite(ehp) ? ehp : null,
    ...(ARBITER_VARIANTS.includes(stage.variant) ? { arbiter: arbiter() } : {}),
    clearSpeed,
    movementSpeed,
    ...added,
    toughness: toughnessOf(rec.outputs, pob?.immune ?? [], pob?.conditioned),
  };
}

/** D-358: an anointed stage's notable and its recipe of three Distilled Emotions. */
export interface AnointRecord {
  /** The notable's PoB name, as written after `Allocates ` on the amulet. */
  notable: string;
  node: number;
  /** The recipe as the tree names the emotions (`Paranoia`, `Greed`, `Isolation`). */
  recipe: string[];
  /** PoB's item names of the emotions (`Liquid Paranoia`, `Diluted Liquid Greed`, …). */
  emotions: string[];
}

/** D-402 (WU-87): one kept modifier of a stage's tamed beast, and how the compile applied it, by its table row's model. */
export interface CompanionModRecord {
  /** Its id and name in `data/monsters/monster-mods.md`. */
  id: string;
  name: string;
  model: 'stats' | 'condition' | 'none';
  /**
   * `custom-modifiers`: its lines went into the stage's custom modifiers; `config`: its config option was written, on;
   * `nothing`: PoB can't take it (a `none` row, or no line PoB parses whole).
   */
  applied: 'custom-modifiers' | 'config' | 'nothing';
  /**
   * A `stats` row's lines as the compile writes them: `Companions have …` on the beast, the line itself on the player,
   * `Minions have …` on the minions; `written` false for a line PoB can't parse whole, which would add nothing.
   */
  lines?: { text: string; reaches: 'companion' | 'player' | 'minions'; written: boolean }[];
  /** A `stats` row with a line written: an estimate (D-293), so the stage carries the custom-modifier mark. */
  estimate?: true;
  /** A `condition` row: the config option it sets, written as earned state, on. */
  option?: string;
  /** How it was applied, in words. */
  how: string;
}

/**
 * D-402 (WU-87): a stage's tamed beast, as PoB measured it. A beast reserves a percentage of the player's Spirit (its
 * species' `companionReservation`), not a flat amount, so its reserved Spirit grows with the Spirit the build stacks.
 */
export interface CompanionRecord {
  /** The plan's `companion.species`, and the beast PoB summons: its name and monster id. */
  species: string;
  monster: string;
  monsterId: string;
  /** The group holding the Tame Beast gem (the plan's number), its companion skill and their breakdown key. */
  group: number;
  activeSkill: number;
  key: string;
  /** The companion's DPS: its minion's `MinionTotalDPS` at `key`, as PoB measures it; null when PoB gives none. */
  dps: number | null;
  /** The player's Spirit, PoB's `Spirit`. */
  spirit: number | null;
  /** The species' Spirit cost: a percentage of the player's Spirit (`companionReservation`, `Data/Spectres.lua`). */
  speciesReservationPercent: number;
  /** PoB's reservation for the companion: its percentage after the build's reservation modifiers, and the Spirit it takes. */
  reservedSpiritPercent: number;
  reservedSpirit: number;
  /** Each kept modifier, in the plan's order, with how it was applied. */
  mods: CompanionModRecord[];
}

/** WU-93 (D-413): an item or a gem that sets a stage's level requirement. */
export interface RequirementSource {
  kind: 'item' | 'gem';
  /** The item's name, or the gem's, as PoB holds them. */
  name: string;
  /** An item's slot. */
  slot?: string;
  /** A gem's group (the plan's number, 1-based) and its gem level. */
  group?: number;
  gemLevel?: number;
}

/**
 * WU-93 (D-413, C-33): the level a stage works from: the highest level requirement among its equipped items and
 * socketed gems, as PoB computes them (at least 1), and every item and gem whose requirement it is (none when nothing
 * requires a level above 0). The endgame guide says when the build comes online from `m`'s.
 */
export interface StageRequirements {
  level: number;
  by: RequirementSource[];
}

/**
 * D-413: a stage's requirements from `compile_stage`'s V1 inputs: its items (in slot order) and its plan groups' gems
 * (in group order), each with PoB's level requirement (`checks.items[].levelRequirement`,
 * `checks.gems[].levelRequirement`), the same inputs V1's level-requirement findings read.
 */
export function stageRequirements(checks: Pick<StageChecks, 'items' | 'gems'>): StageRequirements {
  const all: { req: number; source: RequirementSource }[] = [
    ...checks.items.map((i) => ({ req: i.levelRequirement, source: { kind: 'item' as const, name: i.name, slot: i.slot } })),
    ...checks.gems.map((g) => ({ req: g.levelRequirement, source: { kind: 'gem' as const, name: g.name, group: g.group, gemLevel: g.level } })),
  ].filter((x) => Number.isFinite(x.req));
  const level = Math.max(1, ...all.map((x) => x.req));
  return { level, by: all.filter((x) => x.req === level).map((x) => x.source) };
}

export interface StageRecord {
  loadoutName: string;
  level: number;
  /** This stage's `compile_stage` request, in ms. */
  elapsedMs: number;
  /** PoB's main output, as measured: the main skill's figures and the defences. */
  outputs: Record<string, number>;
  /**
   * D-426: on a stage that uses weapon set 2 (passives tagged to set 2, an item in a Swap slot, or a skill group
   * socketed in one), the same key-figure map as `outputs`, measured with set 2 active: Life, Spirit and its
   * reservation (`SpiritUnreserved`) among them. It is `outputs` itself on a stage measured with set 2 active
   * (`items.useSecondWeaponSet`), and absent from a stage that doesn't use set 2 and from records written before M-22.
   */
  outputsSet2?: Record<string, number>;
  /** D-293, D-321: the main skill's figures with the main group's Count applied (`countedFigures`). */
  countedOutputs: CountedFigures & { group: number };
  skillOutputs: Record<string, { skill: string; statSetLabel: string; fields: Record<string, number> }>;
  /**
   * WU-102 (D-426, §24.2): on a stage that uses weapon set 2 (as for `outputsSet2`, or a group with `weaponSet: 2`), every
   * group's figures measured with set 2 active, keyed as `skillOutputs` is, so a group on either set has a figure of
   * its own: a group on set 1 reads `skillOutputs`, one on set 2 `skillOutputsSet2`. It is `skillOutputs` itself on a
   * stage measured with set 2 active, and absent where `outputsSet2` is. Raw figures: no Count is applied to it.
   */
  skillOutputsSet2?: Record<string, { skill: string; statSetLabel: string; fields: Record<string, number> }>;
  /** D-293, D-321: each `skillOutputs` entry, under the same key, with its group's Count applied. */
  countedSkillOutputs: Record<string, CountedFigures & { skill: string; statSetLabel: string }>;
  /** Every option the stage lists, earned and scenario, as written into its config set (C-32). */
  configWritten: Record<string, ConfigValue>;
  /**
   * D-293: the lines written into PoB's `customMods` option, the stage's `config.customMods` texts in order: the modifier
   * lines only. D-469: on a schema-9 plan the compile also writes each line's reason as the comment line `# <reason>`
   * before it, which PoB skips and this list leaves out (the saved file's text holds them).
   */
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
  /** PoB's warning lines, kept (each a V1 `pob-warning` finding, or `skill-slots` for PoB's skill-slot line, D-428) or filtered as informational. */
  pobWarnings: { kept: string[]; filtered: string[] };
  v1: Verdict | null;
  v2: Verdict | null;
  /**
   * WU-65, D-353: on an endgame stage, its measures. WU-88, D-407: a card skeleton's too (`measuredStage`), with the
   * pace measures only; absent from a skeleton's record written before amendment 8.
   */
  measures?: StageMeasures;
  /** WU-65, D-358: on an anointed stage, the notable and its recipe. */
  anoint?: AnointRecord;
  /**
   * WU-78, D-377: the resolved minion selection of each group that names a `minionSkill`, in group order; empty when
   * none does. Absent from records written before amendment 6.
   */
  minionSkills?: MinionSkillRecord[];
  /**
   * WU-87, D-402: on a stage that names a companion, the tamed beast: its DPS, the Spirit it reserves and its kept
   * modifiers, each with how it was applied.
   */
  companion?: CompanionRecord;
  /**
   * WU-93, D-413: the highest level requirement among the stage's equipped items and socketed gems, and what sets it
   * (`stageRequirements`). Absent from records written before amendment 9.
   */
  requirements?: StageRequirements;
  /**
   * WU-119 (amendment 12 §7, D-452): on each stage of a schema-8 plan with a stage before it (`predecessorOf`, which skips
   * temporary stages), what its tree changes from that stage's: `from` its id, `refunded` how many nodes that stage holds
   * and this one doesn't, `added` the reverse, regular and ascendancy nodes alike (`treeChangeOf`). The guide's respec line
   * gives the counts. Absent from a plan of version 7 or earlier, whose `respec` says it, and from records before M-25.
   */
  treeChange?: { from: string; refunded: number; added: number };
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

/** Whether a `pob-computed` ref names a field of the record: `<stageId>.<Field>`,
 * `<stageId>.g<group>s<skill>p<statSet>.<Field>`, or (WU-111, D-447) a boss reference, as the ledger resolves them
 * (`stageValue`). */
export function refResolves(ref: string, stages: Readonly<Record<string, StageOutputs>>): boolean {
  if (!isMultiSegmentRef(ref)) return false;
  const [stageId, ...rest] = ref.split('.');
  const stage = Object.prototype.hasOwnProperty.call(stages, stageId) ? stages[stageId] : undefined;
  if (!stage) return false;
  return typeof stageValue(stage, rest) === 'number';
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
