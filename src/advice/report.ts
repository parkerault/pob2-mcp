/**
 * Engine inputs and text for the advice tools (FR-A1): `validate_build`, `analyze_defenses`,
 * `get_build_issues` and the "Top Issues" of `lua_load_build`'s summary.
 *
 * The inputs are read from the engine inside the tool's engine call: PoB's warning lines
 * (`get_warnings`), the stats named in `ADVICE_STAT_FIELDS` (all in `get_stats`' default list, AC-E26),
 * the item slots and the rule breaks (`get_rule_breaks`, D-383). A build file other than the loaded build is read with `withTemporaryBuild` (D-9),
 * so the engine's build, `revision` and `loaded` are left unchanged. The judgments come only from
 * `judge()`; this module only formats values and issues.
 */
import type { PoBLuaApiClient } from '../pobLuaBridge.js';
import type { EngineCallContext, LoadedBuild } from '../engine/session.js';
import type { BuildService } from '../services/buildService.js';
import {
  DAMAGE_TYPES,
  JUDGE_STAT_FIELDS,
  RESIST_ELEMENTS,
  formatNumber,
  judge,
  type Issue,
  type JudgedSlot,
  type RuleBreaks,
} from './judge.js';

/** The stats the advice tools show, plus the ones `judge` reads. */
export const ADVICE_STAT_FIELDS: readonly string[] = [
  'Life', 'LifeUnreserved', 'EnergyShield', 'Mana', 'ManaUnreserved', 'Spirit', 'SpiritUnreserved', 'Ward',
  'TotalEHP', 'PhysicalDamageReduction', 'EvadeChance', 'DeflectChance', 'EffectiveBlockChance',
  'Armour', 'Evasion', 'EnergyShieldRecharge',
  ...RESIST_ELEMENTS.map((e) => `${e}Resist`),
  ...JUDGE_STAT_FIELDS,
];

/** What the advice tools read from the engine for one build. */
export interface AdviceInputs {
  stats: Record<string, unknown>;
  warnings: string[];
  items: JudgedSlot[];
  /** What the game won't allow in the build (D-383). */
  ruleBreaks: RuleBreaks;
  /** The engine's character level (`get_stats` `_meta.level`), when known. */
  level: number | null;
}

/** `judge()` over one build's advice inputs. */
export function judgeInputs(inputs: AdviceInputs): Issue[] {
  return judge(inputs.stats, inputs.warnings, inputs.items, inputs.ruleBreaks);
}

/** Read the advice inputs from the engine's current build. */
export async function readAdviceInputs(client: PoBLuaApiClient): Promise<AdviceInputs> {
  const warnings = await client.getWarnings();
  const { _meta: meta, ...stats } = await client.getStats([...ADVICE_STAT_FIELDS]);
  const items = await client.getItems();
  const ruleBreaks = await client.getRuleBreaks();
  return { stats, warnings, items, ruleBreaks, level: typeof meta?.level === 'number' ? meta.level : null };
}

/** The build an advice tool analysed: its name, and whether it was loaded temporarily. */
export interface AdviceSubject {
  label: string;
  temporary: boolean;
  inputs: AdviceInputs;
  issues: Issue[];
}

export interface AdviceContext {
  buildService: Pick<BuildService, 'readBuildFile'>;
  /** The running engine call's context (C-3). */
  engine: () => EngineCallContext;
  /** The build the engine holds (C-3 `loaded`). */
  loadedBuild: () => LoadedBuild | null;
}

function loadedLabel(loaded: LoadedBuild | null): string {
  if (!loaded) return 'the engine build';
  return loaded.path ?? loaded.displayName;
}

/**
 * Read and judge a build. No `buildName`, or the loaded build's own file: the engine's build as it is
 * (with any unsaved changes). Any other build file: loaded with `withTemporaryBuild` (D-9), so the
 * engine's build is never replaced.
 */
export async function readAdviceSubject(context: AdviceContext, buildName?: string): Promise<AdviceSubject> {
  const engine = context.engine();
  const loaded = context.loadedBuild();
  const subject = async (label: string, temporary: boolean, inputs: AdviceInputs): Promise<AdviceSubject> => ({
    label,
    temporary,
    inputs,
    issues: judgeInputs(inputs),
  });
  if (!buildName || buildName.trim() === '') {
    return subject(loadedLabel(loaded), false, await readAdviceInputs(engine.client));
  }
  const file = await context.buildService.readBuildFile(buildName);
  if (loaded?.path === file.rel) {
    return subject(file.rel, false, await readAdviceInputs(engine.client));
  }
  const inputs = await engine.withTemporaryBuild(file.bytes.toString('utf8'), () => readAdviceInputs(engine.client), {
    file: file.rel,
  });
  return subject(file.rel, true, inputs);
}

/** A stat value as text, `n/a` when the engine gave no number. */
export function showStat(value: unknown, suffix = ''): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value)}${suffix}` : 'n/a';
}

/** A stat value rounded to a whole number (the effective hit pool), `n/a` when the engine gave no number. */
export function showWhole(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatNumber(Math.round(value)) : 'n/a';
}

/** What the advice tools judge by, stated once in each output. */
export const JUDGMENT_BASIS =
  "Judgments are PoB2's own: its warning lines, what its data says the game won't allow (a passive whose unlock " +
  'constraint is unmet), resistances below their maximum (Missing<Elem>Resist > 0), ' +
  "and each damage type's max hit taken below the configured enemy's hit of that type (engine comparisons). " +
  'Facts are stated without judgment.';

/** One line per issue, judgments first: `⚠` for a judgment, `ℹ` for a fact. */
export function renderIssueLines(issues: readonly Issue[]): string[] {
  return issues.map((issue) => `  ${issue.category === 'fact' ? 'ℹ' : '⚠'} ${issue.text}`);
}

/** The issue section: a count of judgments and facts, then the issue lines. */
export function renderIssueSection(issues: readonly Issue[]): string[] {
  const judgments = issues.filter((i) => i.category === 'judgment').length;
  const facts = issues.length - judgments;
  if (issues.length === 0) {
    return [
      'Issues: none. PoB shows no warning, no allocated passive is locked, no resistance is below its maximum, ' +
        "and no max hit taken is below the configured enemy's hit of its type.",
    ];
  }
  const head =
    judgments === 0
      ? `Issues: none judged (PoB shows no warning, no locked passive, no resistance gap, no max hit below the enemy's hit); ${facts} fact(s):`
      : `Issues (${judgments} judged${facts > 0 ? `, ${facts} fact(s)` : ''}):`;
  return [head, ...renderIssueLines(issues)];
}

/** The header line naming the analysed build. */
function subjectHeader(title: string, subject: AdviceSubject): string[] {
  const level = subject.inputs.level !== null ? ` (level ${subject.inputs.level})` : '';
  const lines = [`=== ${title}: ${subject.label}${level} ===`];
  if (subject.temporary) lines.push("Loaded temporarily from its file; the engine's build is unchanged.");
  return lines;
}

function resistLines(stats: Record<string, unknown>): string[] {
  return RESIST_ELEMENTS.map(
    (e) => `  ${e}: ${showStat(stats[`${e}Resist`], '%')} (missing to its maximum: ${showStat(stats[`Missing${e}Resist`], '%')})`,
  );
}

function maxHitLines(stats: Record<string, unknown>): string[] {
  return DAMAGE_TYPES.map(
    (t) => `  ${t}: ${showStat(stats[`${t}MaximumHitTaken`])} vs ${showStat(stats[`${t}EnemyDamage`])}`,
  );
}

function poolLines(stats: Record<string, unknown>): string[] {
  return [
    `Life: ${showStat(stats.Life)} (unreserved ${showStat(stats.LifeUnreserved)}) | Energy Shield: ${showStat(stats.EnergyShield)} | Ward: ${showStat(stats.Ward)}`,
    `Mana: ${showStat(stats.Mana)} (unreserved ${showStat(stats.ManaUnreserved)}) | Spirit: ${showStat(stats.Spirit)} (unreserved ${showStat(stats.SpiritUnreserved)})`,
  ];
}

/** `analyze_defenses`: PoB2's defence values, then the judged issues. */
export function renderDefenceAnalysis(subject: AdviceSubject): string {
  const s = subject.inputs.stats;
  return [
    ...subjectHeader('Defence Analysis', subject),
    '',
    `Effective Hit Pool (TotalEHP): ${showWhole(s.TotalEHP)}`,
    ...poolLines(s),
    `Armour: ${showStat(s.Armour)} | Evasion: ${showStat(s.Evasion)} | Energy Shield recharge: ${showStat(s.EnergyShieldRecharge)}`,
    `Physical damage reduction: ${showStat(s.PhysicalDamageReduction, '%')}`,
    `Evade chance: ${showStat(s.EvadeChance, '%')} | Deflect chance: ${showStat(s.DeflectChance, '%')} | Effective block chance: ${showStat(s.EffectiveBlockChance, '%')}`,
    '',
    'Resistances:',
    ...resistLines(s),
    '',
    "Max hit taken vs the configured enemy's hit, per damage type:",
    ...maxHitLines(s),
    '',
    ...renderIssueSection(subject.issues),
    '',
    JUDGMENT_BASIS,
  ].join('\n');
}

/** `validate_build`: the judged issues first, then the values they rest on. */
export function renderValidation(subject: AdviceSubject): string {
  const s = subject.inputs.stats;
  return [
    ...subjectHeader('Build Validation', subject),
    '',
    ...renderIssueSection(subject.issues),
    '',
    'Values (PoB2):',
    `Effective Hit Pool (TotalEHP): ${showWhole(s.TotalEHP)}`,
    ...poolLines(s),
    'Resistances:',
    ...resistLines(s),
    "Max hit taken vs the configured enemy's hit:",
    ...maxHitLines(s),
    '',
    JUDGMENT_BASIS,
  ].join('\n');
}
