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
 * headline (the named source's Count-scaled `TotalDPS`, D-294); `ehp`, PoB's `TotalEHP`; on the budget and
 * non-budget rungs, `arbiter`, the Arbiter of Divinity's largest hit of each damage type and each mixed hit
 * over the stage's max hit (`arbiterMeasure`); and a rough `clearSpeed` (`clearSpeedOf`). No kill time and no
 * hits to kill. An anointed stage's record gives the notable and its recipe of three Distilled Emotions.
 */
import { isMultiSegmentRef, parseFormula, type StageOutputs } from './ledger.js';
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
}

/** The data file holding the Arbiter's hits (C-35). */
export const ARBITER_FILE = 'enemies/arbiter-of-divinity.json';

/**
 * The Arbiter's hits from its data file's facts: every `hits.<id>` range with its `hits.<id>.type`, in file
 * order. A hit without a type, or a type that isn't a string, is left out.
 */
export function arbiterHitsOf(facts: Readonly<Record<string, Fact>>): ArbiterHit[] {
  const out: ArbiterHit[] = [];
  for (const [key, fact] of Object.entries(facts)) {
    const m = /^hits\.([a-z0-9-]+)$/.exec(key);
    const value = fact.value as unknown;
    if (!m || typeof value !== 'object' || value === null || typeof (value as { max?: unknown }).max !== 'number') continue;
    const type = facts[`${key}.type`]?.value;
    if (typeof type !== 'string' || type === '') continue;
    out.push({ id: m[1], max: (value as { max: number }).max, types: type.split('-') });
  }
  return out;
}

/** One part of a mixed hit: its share of the top roll, the stage's max hit of that type and their ratio. */
export interface ArbiterPart {
  type: string;
  hit: number;
  maxHit: number | null;
  ratio: number | null;
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
   * The stage's `<Type>MaximumHitTaken`. For a mixed hit, the largest hit of that mix the stage takes: the hit
   * over the summed ratio. Null when PoB gave no finite positive max hit.
   */
  maxHit: number | null;
  /** The hit over the max hit; for a mixed hit, its parts' ratios summed. */
  ratio: number | null;
  verdict: ArbiterVerdict | null;
  /** A mixed hit's parts, its top roll split evenly between its types. */
  parts?: ArbiterPart[];
}

export interface ArbiterMeasure {
  /** `one-shot` when any row is, `survives` when every row survives; null when a row has no verdict. */
  verdict: ArbiterVerdict | null;
  /** The row with the largest ratio: the hit the survival label names. */
  worst: { type: string; hitId: string; ratio: number } | null;
  rows: ArbiterRow[];
}

/** The order of the plain damage types in `measures.arbiter`. */
const DAMAGE_TYPES = ['physical', 'fire', 'cold', 'lightning', 'chaos'];
const capitalised = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

/** The verdict of a ratio (D-353): below 1 the stage survives the hit, else it is one-shot. */
export const arbiterVerdict = (ratio: number): ArbiterVerdict => (ratio < 1 ? 'survives' : 'one-shot');

/**
 * D-353: for each damage type the Arbiter deals, its largest hit's top roll over the stage's
 * `<Type>MaximumHitTaken`; for each mixed hit, the largest of that mix, its parts' ratios summed (a part is
 * the top roll split evenly between the mix's types: the data's split is "half converted"). `survives`
 * below 1, else `one-shot`.
 */
export function arbiterMeasure(outputs: Readonly<Record<string, number>>, hits: readonly ArbiterHit[]): ArbiterMeasure {
  const maxHitOf = (type: string): number | null => {
    const v = outputs[`${capitalised(type)}MaximumHitTaken`];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  };
  const largest = new Map<string, ArbiterHit>();
  for (const hit of hits) {
    const key = hit.types.join('-');
    const seen = largest.get(key);
    if (seen === undefined || hit.max > seen.max) largest.set(key, hit);
  }
  const keys = [...largest.keys()].sort((a, b) => {
    const rank = (k: string) => (k.includes('-') ? DAMAGE_TYPES.length : Math.max(0, DAMAGE_TYPES.indexOf(k)));
    return rank(a) - rank(b);
  });
  const rows: ArbiterRow[] = keys.map((key) => {
    const hit = largest.get(key)!;
    if (hit.types.length === 1) {
      const maxHit = maxHitOf(hit.types[0]);
      const ratio = maxHit === null ? null : hit.max / maxHit;
      return { type: key, mixed: false, hitId: hit.id, hit: hit.max, maxHit, ratio, verdict: ratio === null ? null : arbiterVerdict(ratio) };
    }
    const parts: ArbiterPart[] = hit.types.map((type) => {
      const share = hit.max / hit.types.length;
      const maxHit = maxHitOf(type);
      return { type, hit: share, maxHit, ratio: maxHit === null ? null : share / maxHit };
    });
    const ratio = parts.every((p) => p.ratio !== null) ? parts.reduce((sum, p) => sum + p.ratio!, 0) : null;
    const maxHit = ratio === null || ratio === 0 ? null : hit.max / ratio;
    return { type: key, mixed: true, hitId: hit.id, hit: hit.max, maxHit, ratio, verdict: ratio === null ? null : arbiterVerdict(ratio), parts };
  });
  const verdict: ArbiterVerdict | null = rows.some((r) => r.verdict === 'one-shot')
    ? 'one-shot'
    : rows.length > 0 && rows.every((r) => r.verdict === 'survives')
      ? 'survives'
      : null;
  let worst: ArbiterMeasure['worst'] = null;
  for (const r of rows) if (r.ratio !== null && (worst === null || r.ratio > worst.ratio)) worst = { type: r.type, hitId: r.hitId, ratio: r.ratio };
  return { verdict, worst, rows };
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
  /** Its `AreaOfEffectRadiusMetres`, 0 when PoB gives none. */
  radiusMetres: number;
  /** The band by the radius alone: below 2 m slow, below 4 m medium, else fast. */
  band: ClearSpeed;
  /** One step faster: a gem text of its group explodes monsters or spreads an effect on death. */
  onDeath: boolean;
  /** Its uses per second (`Speed`), null when PoB gives none. */
  usesPerSecond: number | null;
  /** One step slower: a use takes over 1 second (`Speed` below 1, an estimate). */
  longUse: boolean;
}

/** The band of a radius (D-353): below 2 m slow, from 2 m below 4 m medium, 4 m or more fast. */
export function clearBand(radiusMetres: number): ClearSpeed {
  return radiusMetres < 2 ? 'slow' : radiusMetres < 4 ? 'medium' : 'fast';
}

/** D-353: the band, a step faster for an on-death effect, a step slower for a long use, kept within the bands. */
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
    onDeath,
    usesPerSecond,
    longUse,
  };
}

/** The clear skill (D-353): the first enabled `clear` group, else the main group; null for neither. */
export function clearGroupOf(stage: Pick<Stage, 'skills'>): { group: number; activeSkill: number } | null {
  const k = stage.skills.groups.findIndex((g) => g.enabled && g.role === 'clear');
  if (k >= 0) return { group: k + 1, activeSkill: 1 };
  const main = stage.skills.main;
  return stage.skills.groups[main.group - 1] ? { group: main.group, activeSkill: main.activeSkill } : null;
}

/** The names of the clear skill's group's enabled gems, the skill and its supports, whose texts it reads. */
export function clearGemNames(stage: Pick<Stage, 'skills'>): string[] {
  const clear = clearGroupOf(stage);
  if (clear === null) return [];
  return stage.skills.groups[clear.group - 1].gems.filter((g) => g.enabled).map((g) => g.name);
}

/**
 * The clear skill's breakdown entry. D-363: its first stat set, the one PoB selects by default, so the measure
 * doesn't depend on a stat set whose radius PoB resolves in hash order (Earthquake's Aftershock).
 */
export function clearEntryOf(
  stage: Pick<Stage, 'skills'>,
  skillOutputs: StageRecord['skillOutputs'],
): { group: number; key: string; skill: string; fields: Record<string, number> } | null {
  const clear = clearGroupOf(stage);
  if (clear === null) return null;
  const key = `g${clear.group}s${clear.activeSkill}p1`;
  const e = skillOutputs[key];
  return e === undefined ? null : { group: clear.group, key, skill: e.skill, fields: e.fields };
}

/**
 * The headline (D-294): the named source's Count-scaled figure,
 * `countedSkillOutputs[g<main.group>s<main.activeSkill>p<main.statSet>].fields.TotalDPS`, else the main skill's
 * counted `TotalDPS`; null when PoB measured none.
 */
export function headlineDps(
  stage: { skills: Pick<Stage['skills'], 'main'> },
  rec: Pick<StageRecord, 'countedOutputs' | 'countedSkillOutputs'>,
): number | null {
  const m = stage.skills.main;
  const key = `g${m.group}s${m.activeSkill}p${m.statSet ?? 1}`;
  const v = rec.countedSkillOutputs[key]?.fields.TotalDPS ?? rec.countedOutputs.fields.TotalDPS;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** `measures`, per endgame stage (D-353). `arbiter` is only on the budget and non-budget rungs. */
export interface StageMeasures {
  dps: number | null;
  ehp: number | null;
  arbiter?: ArbiterMeasure;
  clearSpeed: ClearSpeedMeasure;
}

/** The rungs `measures.arbiter` is given on (D-353): `b` and `n`. */
export const ARBITER_VARIANTS: readonly string[] = ['budget', 'non-budget'];

/** An endgame stage's measures from its record (D-353). */
export function stageMeasures(
  stage: Pick<Stage, 'skills' | 'variant'>,
  rec: Pick<StageRecord, 'outputs' | 'skillOutputs' | 'countedOutputs' | 'countedSkillOutputs'>,
  arbiterHits: readonly ArbiterHit[],
  gemTexts: Readonly<Record<string, string>>,
): StageMeasures {
  const ehp = rec.outputs.TotalEHP;
  const entry = clearEntryOf(stage, rec.skillOutputs);
  const clearSpeed = clearSpeedOf({
    radiusMetres: entry?.fields.AreaOfEffectRadiusMetres,
    usesPerSecond: entry?.fields.Speed,
    texts: clearGemNames(stage).flatMap((name) => (gemTexts[name] !== undefined ? [gemTexts[name]] : [])),
    group: entry?.group ?? null,
    key: entry?.key ?? null,
    skill: entry?.skill ?? null,
  });
  return {
    dps: headlineDps(stage, rec),
    ehp: typeof ehp === 'number' && Number.isFinite(ehp) ? ehp : null,
    ...(stage.variant !== undefined && ARBITER_VARIANTS.includes(stage.variant) ? { arbiter: arbiterMeasure(rec.outputs, arbiterHits) } : {}),
    clearSpeed,
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
  /** WU-65, D-353: on an endgame stage (one with a `variant`), its measures. */
  measures?: StageMeasures;
  /** WU-65, D-358: on an anointed stage, the notable and its recipe. */
  anoint?: AnointRecord;
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
