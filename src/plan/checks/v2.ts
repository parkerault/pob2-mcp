/**
 * V2: the stage's config (D-114, C-32, D-192; slice 2 §3.7), and its effective config for the record
 * (D-212).
 *
 * V2 runs in TypeScript over `compile_stage`'s V2 inputs (the stage's allocated node names, equipped items,
 * gems, active skills, flask and charm toggles, and its config set's `input` and `placeholder` tables after
 * the recalculation), `compile_check`'s producer lookups and config defaults, the plan, the C1/E1 data and
 * the baseline list (D-230). A finding never fails the compile (D-192).
 *
 * | Code | Finding when |
 * |---|---|
 * | `producer-unknown` | an earned entry is on and its producer doesn't exist in the game data (D-221) |
 * | `producer-absent` | the producer exists but isn't in the stage (item: an equipped item; gem: a gem of the skill set, a captured Tame Beast as PoB's companion gem, D-402; passive: an allocated node, ascendancy included, or a notable an item grants, such as an anoint; skill: an active skill; flask or charm: equipped with its toggle on), names compared ignoring case |
 * | `source-unresolved` | a scenario entry's `source.file` isn't a loaded C1/E1 file, or its key doesn't resolve |
 * | `quest-not-reached` | a quest-reward option (a C1 `pob-config-key`) is on in the stage's effective config and its quest comes after `progress` |
 * | `default-unlisted` | an option on by default, or placeholder-driven in the stage's config set, that the stage doesn't list and the baseline list doesn't cover: it doesn't name it; or it is conditional and PoB shows it for the stage (D-250); or the stage fights a boss and it is one of the enemy's level, armour, evasion, resistances or crit (D-252) |
 * | `toggle-empty` | a toggle is active on a slot holding no flask or charm |
 *
 * **On** (A-P5): `true`, a non-zero number, or a list value other than the option's first list entry.
 *
 * **Placeholder-driven** (D-212): a numeric option (`count`, `integer`, `countAllowZero`, `float`) with no
 * effective input in the set (nil, or 0 for a `count`) whose placeholder is set (non-zero for a `count`),
 * as `BuildModList` decides (`Classes/ConfigTab.lua:889-899`); and `enemyLevel` when its input isn't above 0
 * and its placeholder is (`UpdateLevel`, `:870-880`). The rule also covers the numeric options without an
 * `apply` whose placeholder PoB's calculations read directly: the enemy's damage, penetration, overwhelm,
 * speed, crit and roll range that `enemyIsBoss` sets (`Modules/CalcDefence.lua:2106-2114, 2090, 2095,
 * 3396`, `Modules/ConfigOptions.lua:2185`), which D-212 names among the placeholders that count as set.
 *
 * **configEffective** holds every option that affects the calculation: each listed one (`explicit`, class
 * `earned` or `scenario`), each default-on one the stage doesn't list (`default`, its value in the set) and
 * each placeholder-driven one it doesn't list (`placeholder`, the placeholder's value); an unlisted option's
 * class is `baseline` when the baseline list covers it there (D-230, D-250, D-252), else `unlisted`.
 */
import type { ConfigOptionDefault, StageChecks } from '../../engine/schemas.js';
import type { ConfigValue, Finding, StageRecord, Verdict } from '../record.js';
import type { PlanReferenceData } from '../referenceData.js';
import type { Stage } from '../schema.js';
import type { ConfigBaseline } from './configBaseline.js';
import { C1, FactReader } from './facts.js';

/** The numeric option types whose placeholder PoB applies when there is no input (BuildModList). */
const NUMERIC_TYPES = new Set(['count', 'integer', 'countAllowZero', 'float']);
/** The option whose placeholder `UpdateLevel` applies (ConfigTab.lua:870-880). */
const ENEMY_LEVEL = 'enemyLevel';
/** The option that makes a stage's enemy a boss (any value but its first list entry, "None"). */
const ENEMY_IS_BOSS = 'enemyIsBoss';
/**
 * D-252: the enemy stats a boss stage sets from E1 (its level, armour, evasion, resistances and crit), which
 * the baseline list never covers there: PoB's boss placeholders are its own PoE1-derived means (pin §B5).
 */
export const BOSS_SCENARIO_OPTIONS: readonly string[] = [
  ENEMY_LEVEL, 'enemyArmour', 'enemyEvasion',
  'enemyFireResist', 'enemyColdResist', 'enemyLightningResist', 'enemyChaosResist',
  'enemyCritChance', 'enemyCritDamage',
];

/** A producer's lookup key in `compile_check`'s reply: `<kind>:<name in lowercase>`. */
export const producerKey = (kind: string, name: string): string => `${kind}:${name.toLowerCase()}`;

export interface V2Input {
  stage: Stage;
  /** `compile_stage`'s V2 inputs for the stage. */
  checks: StageChecks;
  /** `compile_check`'s producers: `producerKey(kind, name)` → whether it exists in the game data. */
  producers: ReadonlyMap<string, boolean>;
  /** `compile_check`'s config baseline: per option, what a new config set holds for it. */
  defaults: Readonly<Record<string, ConfigOptionDefault>>;
  /** The baseline list (D-230). */
  baseline: ConfigBaseline;
  ref: PlanReferenceData;
}

export interface V2Result {
  verdict: Verdict;
  configEffective: StageRecord['configEffective'];
}

/** A-P5, with the option's list known: true, a non-zero number, or a list value other than its first. */
export function isOnFor(value: ConfigValue, option: ConfigOptionDefault | undefined): boolean {
  if (option?.type === 'list') return option.first === undefined ? true : String(value) !== String(option.first);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return value !== '';
}

/** Whether PoB applies the option's placeholder in a set with these tables (D-212). */
export function isPlaceholderDriven(
  option: string,
  type: string,
  input: Readonly<Record<string, ConfigValue>>,
  placeholder: Readonly<Record<string, ConfigValue>>,
): boolean {
  const i = input[option];
  const p = placeholder[option];
  if (option === ENEMY_LEVEL) {
    const hasInput = typeof i === 'number' && i > 0;
    return !hasInput && typeof p === 'number' && p > 0;
  }
  if (!NUMERIC_TYPES.has(type)) return false;
  const hasInput = i !== undefined && (i !== 0 || type !== 'count');
  const placeholderSet = p !== undefined && (p !== 0 || type !== 'count');
  return !hasInput && placeholderSet;
}

const same = (a: string, b: string | undefined) => b !== undefined && a.toLowerCase() === b.toLowerCase();

/**
 * D-402: the gem a companion's producer names, and PoB's names for it once captured: the compile turns a stage's Tame
 * Beast gem into PoB's companion gem, "Tamed Companion" until it summons a beast and "Companion: <beast>" after
 * (`Modules/CalcDefence.lua:203-207`), so a Tame Beast producer is present when that gem is.
 */
const TAME_BEAST = 'Tame Beast';
const CAPTURED_TAME_BEAST = /^(companion: .+|tamed companion)$/i;

/** Whether the producer is in the stage (D-114). */
function producerPresent(kind: string, name: string, checks: StageChecks): boolean {
  const itemNamed = (it: StageChecks['items'][number]) => same(name, it.name) || same(name, it.title) || same(name, it.baseName);
  switch (kind) {
    case 'item':
      return checks.items.some(itemNamed);
    case 'gem':
      return checks.gems.some((g) => same(name, g.name) || (same(name, TAME_BEAST) && CAPTURED_TAME_BEAST.test(g.name)));
    case 'passive':
      return checks.nodeNames.some((n) => same(name, n));
    case 'skill':
      return checks.activeSkills.some((s) => same(name, s));
    case 'flask':
    case 'charm': {
      const prefix = kind === 'flask' ? 'Flask ' : 'Charm ';
      return checks.items.some((it) => it.slot.startsWith(prefix) && it.active === true && itemNamed(it));
    }
    default:
      return false;
  }
}

/** The C1 quest-reward options: PoB's config var → its progress key (`q.<key>.pob-config-key`). */
function questOptions(facts: FactReader): Map<string, string> {
  const out = new Map<string, string>();
  for (const key of facts.ref.progressKeys) {
    const option = facts.string(C1.progress, `${key}.pob-config-key`);
    if (option !== null) out.set(option.value, key);
  }
  return out;
}

/** V2 for one compiled stage. */
export function checkV2(input: V2Input): V2Result {
  const { stage, checks, defaults } = input;
  const facts = new FactReader(input.ref);
  const findings: Finding[] = [];
  const effective: StageRecord['configEffective'] = {};

  // Producers of the earned entries that are on (A-P5: an entry that is off needs none).
  for (const e of stage.config.earned) {
    if (!isOnFor(e.value, defaults[e.option]) || e.producer === undefined) continue;
    const { kind, name } = e.producer;
    const data = { option: e.option, kind, name };
    if (input.producers.get(producerKey(kind, name)) !== true) {
      findings.push({ code: 'producer-unknown', message: `${e.option}: its producer, ${kind} "${name}", doesn't exist in the game data`, data });
    } else if (!producerPresent(kind, name, checks)) {
      const where: Record<string, string> = {
        item: 'no equipped item has that name',
        gem: 'the skill set has no gem of that name',
        passive: 'no allocated node has that name',
        skill: 'the stage has no active skill of that name',
        flask: 'no equipped flask of that name has its toggle on',
        charm: 'no equipped charm of that name has its toggle on',
      };
      findings.push({ code: 'producer-absent', message: `${e.option}: its producer, ${kind} "${name}", isn't in the stage: ${where[kind]}`, data });
    }
  }

  // Scenario sources resolve (A-P11: V2 checks that they resolve, not their values).
  for (const e of stage.config.scenario) {
    const found = input.ref.resolveFact(e.source.file, e.source.key);
    if (!found.ok) {
      findings.push({
        code: 'source-unresolved',
        message: `${e.option}: its source ${e.source.file}#${e.source.key} doesn't resolve: ${found.reason}`,
        data: { option: e.option, file: e.source.file, key: e.source.key },
      });
    }
  }

  // The effective config (D-212): listed, then default-on and placeholder-driven options it doesn't list.
  const listed = new Map<string, { value: ConfigValue; cls: 'earned' | 'scenario' }>();
  for (const e of stage.config.earned) listed.set(e.option, { value: e.value, cls: 'earned' });
  for (const e of stage.config.scenario) listed.set(e.option, { value: e.value, cls: 'scenario' });
  for (const [option, { value, cls }] of listed) effective[option] = { value, origin: 'explicit', class: cls };
  const { input: setInput, placeholder } = checks.config;
  // D-250: a conditional option (one PoB shows only for some builds) keeps the baseline only while PoB hides
  // it for this stage; shown, it is the stage's own state, which the plan lists. D-252: on a boss stage the
  // enemy's level, defences, resistances and crit come from E1.
  const shown = new Set(checks.shownOptions);
  const boss = listed.has(ENEMY_IS_BOSS) && isOnFor(listed.get(ENEMY_IS_BOSS)!.value, defaults[ENEMY_IS_BOSS]);
  const baselineFor = (option: string): { ok: true } | { ok: false; why: string } => {
    if (!Object.prototype.hasOwnProperty.call(input.baseline.options, option)) return { ok: false, why: 'neither the stage nor the baseline list names it' };
    if (defaults[option]?.conditional === true && shown.has(option)) {
      return { ok: false, why: 'PoB shows it for this stage, so the baseline list no longer covers it (D-250): list it as earned state' };
    }
    if (boss && BOSS_SCENARIO_OPTIONS.includes(option)) {
      return { ok: false, why: 'the stage fights a boss, so the baseline list no longer covers it (D-252): list it as a scenario input from E1' };
    }
    return { ok: true };
  };
  for (const option of Object.keys(defaults).sort()) {
    if (listed.has(option)) continue;
    const info = defaults[option];
    let entry: { value: ConfigValue; origin: 'default' | 'placeholder' } | null = null;
    if (info.default !== undefined && isOnFor(info.default, info)) {
      entry = { value: setInput[option] ?? info.default, origin: 'default' };
    } else if (isPlaceholderDriven(option, info.type, setInput, placeholder)) {
      entry = { value: placeholder[option], origin: 'placeholder' };
    }
    if (entry === null) continue;
    const baseline = baselineFor(option);
    effective[option] = { ...entry, class: baseline.ok ? 'baseline' : 'unlisted' };
    if (!baseline.ok) {
      findings.push({
        code: 'default-unlisted',
        message:
          `${option} is ${entry.origin === 'default' ? 'on by default' : "driven by PoB's placeholder"} ` +
          `(${JSON.stringify(entry.value)}), but ${baseline.why}`,
        data: { option, value: entry.value, origin: entry.origin },
      });
    }
  }

  // Quest rewards beyond the stage's progress point, on in its effective config.
  const quests = questOptions(facts);
  const at = facts.progressIndex(stage.progress);
  for (const [option, e] of Object.entries(effective)) {
    const quest = quests.get(option);
    if (quest === undefined || facts.progressIndex(quest) <= at || !isOnFor(e.value, defaults[option])) continue;
    findings.push({
      code: 'quest-not-reached',
      message: `${option} is on (${e.origin}), but its quest, ${quest}, comes after the stage's progress point ${stage.progress}`,
      data: { option, quest, progress: stage.progress, origin: e.origin },
    });
  }

  // Toggles on empty slots.
  for (const t of stage.items.toggles) {
    if (t.active && !checks.items.some((it) => it.slot === t.slot)) {
      findings.push({ code: 'toggle-empty', message: `the toggle on ${t.slot} is active, but no flask or charm is equipped there`, data: { slot: t.slot } });
    }
  }

  return { verdict: { pass: findings.length === 0, findings, notes: facts.notes() }, configEffective: effective };
}
