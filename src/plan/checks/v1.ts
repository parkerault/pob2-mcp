/**
 * V1: is the stage valid at its level (D-108, D-192; slice 2 §3.7).
 *
 * V1 runs in TypeScript over `compile_stage`'s V1 inputs (PoB's own counts, attributes, requirements and
 * warning lines), the plan and the C1 data. It computes every limit itself, from C1 and the plan; the usage
 * is PoB's. A finding never fails the compile (D-192): it goes into the record, and the verdict passes
 * exactly when there is none. A verdict that rests on an M or L fact carries a note naming it (A-29).
 *
 * | Code | Finding when |
 * |---|---|
 * | `passive-points` | PoB's regular count (`PointsUsed − min(ws1, ws2)`, Build.lua:1029) exceeds (level − 1) + the quests' passive points up to `progress` + `ExtraPoints`; at the last progress key the Martyr point is allowed, with a note |
 * | `weapon-set-points` | `ws1` or `ws2` exceeds the quests' weapon-set points up to `progress` + `PassivePointsToWeaponSetPoints` |
 * | `ascendancy-points` | `AscUsed` exceeds the points of the trials available at `progress`; on a variant stage also `AscUsed` > `ascendancyPoints`, or `ascendancyPoints` > those points (D-193) |
 * | `gem-availability` | a skill gem's tier or level exceeds the highest uncut skill-gem level available at `progress`, or a support gem's tier the highest uncut support level; a Spirit gem gets a note (A-31) |
 * | `gem-level-requirement` | a gem's level requirement exceeds the stage level |
 * | `item-level-requirement` | an equipped item's level requirement exceeds the stage level |
 * | `attributes` | Str < ReqStr, Dex < ReqDex or Int < ReqInt, naming the item or gem |
 * | `resistance-penalty` | the stage lists `resistancePenalty` with a value other than C1's for its progress point |
 * | `pob-warning` | a PoB warning line other than the informational "Weapon set 2 passives available", and PoB's "too many passive points" when the stage spends the Martyr point PoB doesn't know |
 * | `tree-continuity` | the stage's tree doesn't contain its predecessor's apart from `respec.dropped`, or `respec.dropped` isn't exactly the dropped set (D-144, A-P3) |
 *
 * **The resistance penalty's C1 value** for a progress key is `resistance-penalty.<region>` for the key's
 * region. The interlude value is keyed by area-level ranges (`"<lo>-<hi>"`), so the key's own area level
 * picks the range. The key is the last reward quest reached, so a stage between two keys is checked at
 * the earlier one.
 */
import type { StageChecks } from '../../engine/schemas.js';
import type { Finding, Verdict } from '../record.js';
import type { PlanReferenceData } from '../referenceData.js';
import type { Stage } from '../schema.js';
import { C1, FactReader, type Trial } from './facts.js';

/** PoB's informational warning (Build.lua:1051-1055): unspent weapon set 2 points are no defect. */
export const INFORMATIONAL_WARNING = /^You have \d+ Weapon set 2 passives available$/;

/**
 * PoB's cap on regular points (Build.lua:1007, 1030): 99 + every quest's points + ExtraPoints. It doesn't
 * know the Martyr point, so a stage that spends it (A-29, a note) also gets this line, which is then no
 * defect: it is filtered with the informational line.
 */
export const TOO_MANY_PASSIVES_WARNING = /^You have too many passive points allocated$/;

/** The plan option V1 reads (C-32). */
const RESISTANCE_PENALTY = 'resistancePenalty';

const ATTRIBUTE_NAMES: Record<string, string> = { Str: 'Strength', Dex: 'Dexterity', Int: 'Intelligence' };

export interface V1Input {
  stage: Stage;
  /** The stage's continuity predecessor (A-P3), or null for the first stage of the campaign track. */
  predecessor: Stage | null;
  /** `compile_stage`'s V1 inputs for the stage. */
  checks: StageChecks;
  ref: PlanReferenceData;
}

export interface V1Result {
  verdict: Verdict;
  /** PoB's warning lines: kept (each a `pob-warning` finding) and filtered (informational). */
  pobWarnings: { kept: string[]; filtered: string[] };
}

/**
 * A-P3: stages without `variant` form the campaign track, and each variant its own track, each in plan
 * order. A variant track's first stage continues from the last campaign stage before it.
 */
export function predecessorOf(stages: readonly Stage[], index: number): Stage | null {
  const stage = stages[index];
  const before = stages.slice(0, index);
  const last = (match: (s: Stage) => boolean): Stage | null => {
    for (let i = before.length - 1; i >= 0; i--) if (match(before[i])) return before[i];
    return null;
  };
  if (stage.variant === undefined) return last((s) => s.variant === undefined);
  return last((s) => s.variant === stage.variant) ?? last((s) => s.variant === undefined);
}

/** A range key `"<lo>-<hi>"` of an object-valued C1 fact, parsed; null when it isn't one. */
export function parseRangeKey(key: string): { lo: number; hi: number } | null {
  const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(key);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  return lo <= hi ? { lo, hi } : null;
}

/** The value of a range-keyed record for `at` (the first range holding it), or null. */
export function valueInRange(ranges: Readonly<Record<string, number | string>>, at: number): number | null {
  for (const [key, value] of Object.entries(ranges)) {
    const r = parseRangeKey(key);
    if (r !== null && at >= r.lo && at <= r.hi && typeof value === 'number') return value;
  }
  return null;
}

const sortNumbers = (xs: Iterable<number>) => [...xs].sort((a, b) => a - b);

function sumQuest(facts: FactReader, progress: string, field: string, code: string): number {
  let total = 0;
  for (const key of facts.reached(progress)) {
    const n = facts.number(C1.progress, `${key}.${field}`);
    if (n !== null) {
      total += n.value;
      facts.rely(code, n.fact);
    }
  }
  return total;
}

/** Returns whether the stage's regular points pass only with the Martyr point. */
function checkPoints(stage: Stage, checks: StageChecks, facts: FactReader, findings: Finding[]): boolean {
  const { used, weaponSet1, weaponSet2 } = checks.counts;
  const regular = used - Math.min(weaponSet1, weaponSet2);
  const fromLevels = stage.level - 1;
  const fromQuests = sumQuest(facts, stage.progress, 'passive-points', 'passive-points');
  const extra = checks.extraPoints;
  let allowed = fromLevels + fromQuests + extra;
  const how = `${fromLevels} from levels, ${fromQuests} from quests up to ${stage.progress}, ${extra} extra`;
  let martyrSpent = false;
  if (regular > allowed && facts.isLastKey(stage.progress)) {
    const martyr = facts.number(C1.limits, 'passive-points.martyr');
    if (martyr !== null) {
      facts.rely('passive-points', martyr.fact);
      allowed += martyr.value;
      martyrSpent = regular <= allowed;
    }
  }
  if (regular > allowed) {
    findings.push({
      code: 'passive-points',
      message:
        `PoB counts ${regular} regular passive points (${used} allocated − min(weapon set 1 ${weaponSet1}, weapon set 2 ` +
        `${weaponSet2})), but level ${stage.level} at ${stage.progress} allows ${allowed} (${how})`,
      data: { used: regular, allowed },
    });
  }

  const wsQuests = sumQuest(facts, stage.progress, 'weapon-set-points', 'weapon-set-points');
  const wsAllowed = wsQuests + checks.passivePointsToWeaponSetPoints;
  for (const [set, n] of [
    [1, weaponSet1],
    [2, weaponSet2],
  ] as const) {
    if (n > wsAllowed) {
      findings.push({
        code: 'weapon-set-points',
        message:
          `weapon set ${set} holds ${n} passives, but ${stage.progress} allows ${wsAllowed} weapon-set points ` +
          `(${wsQuests} from quests, ${checks.passivePointsToWeaponSetPoints} from passives)`,
        data: { set, used: n, allowed: wsAllowed },
      });
    }
  }
  return martyrSpent;
}

function checkAscendancy(stage: Stage, checks: StageChecks, facts: FactReader, findings: Finding[]): void {
  const used = checks.counts.ascendancy;
  const at = facts.progressIndex(stage.progress);
  const trials = facts.trials();
  const available = trials.filter((t) => facts.progressIndex(t.availableFrom) >= 0 && facts.progressIndex(t.availableFrom) <= at);
  const allowed = available.reduce((sum, t) => sum + t.points, 0);
  // The trials the stage's points rest on, in order, until they cover what it spends (or the next gate).
  const relied: Trial[] = [];
  let covered = 0;
  for (const t of trials) {
    if (covered >= used) break;
    relied.push(t);
    covered += t.points;
  }
  for (const t of relied) for (const f of t.facts) facts.rely('ascendancy-points', f);
  const trialIds = available.map((t) => `trial.${t.n}`);
  if (used > allowed) {
    findings.push({
      code: 'ascendancy-points',
      message:
        `PoB counts ${used} ascendancy points, but ${stage.progress} allows ${allowed}` +
        (trialIds.length > 0 ? ` (${trialIds.join(', ')})` : ' (no trial is available yet)'),
      data: { used, allowed, trials: trialIds },
    });
  }
  if (stage.variant !== undefined && stage.ascendancyPoints !== undefined) {
    if (used > stage.ascendancyPoints) {
      findings.push({
        code: 'ascendancy-points',
        message: `PoB counts ${used} ascendancy points, but the variant states ascendancyPoints ${stage.ascendancyPoints} (D-193)`,
        data: { used, declared: stage.ascendancyPoints },
      });
    }
    if (stage.ascendancyPoints > allowed) {
      findings.push({
        code: 'ascendancy-points',
        message: `the variant states ascendancyPoints ${stage.ascendancyPoints}, but ${stage.progress} allows ${allowed} (D-193)`,
        data: { declared: stage.ascendancyPoints, allowed },
      });
    }
  }
}

function checkGems(stage: Stage, checks: StageChecks, facts: FactReader, findings: Finding[], notes: Finding[]): void {
  const at = facts.progressIndex(stage.progress);
  const availableMax = (series: string) => {
    const levels = facts.series(series);
    const reached = levels.filter((l) => facts.progressIndex(l.availableFrom) >= 0 && facts.progressIndex(l.availableFrom) <= at);
    return { levels, max: reached.reduce((m, l) => Math.max(m, l.n), 0) };
  };
  const skill = availableMax('uncut-skill');
  const support = availableMax('uncut-support');
  for (const gem of checks.gems) {
    const where = `skill group ${gem.group} gem ${gem.index}`;
    if (gem.kind === 'spirit') {
      notes.push({
        code: 'gem-availability',
        message: `${gem.name} (${where}) is a Spirit gem; C1 has no Spirit gem table, so its availability isn't checked (A-31)`,
        data: { gem: gem.name, group: gem.group, index: gem.index },
      });
    } else {
      const series = gem.kind === 'skill' ? skill : support;
      const tier = gem.tier ?? 0;
      const needed = gem.kind === 'skill' ? Math.max(tier, gem.level) : tier;
      const level = series.levels.find((l) => l.n === needed);
      if (level !== undefined) facts.rely('gem-availability', level.fact);
      if (needed > series.max) {
        const kind = gem.kind === 'skill' ? 'skill' : 'support';
        findings.push({
          code: 'gem-availability',
          message:
            `${gem.name} (${where}, tier ${tier}${gem.kind === 'skill' ? `, level ${gem.level}` : ''}) needs an uncut ` +
            `${kind} gem of level ${needed}, but ${stage.progress} reaches uncut ${kind} gems of level ${series.max} at most`,
          data: { gem: gem.name, tier, ...(gem.kind === 'skill' ? { level: gem.level } : {}), max: series.max },
        });
      }
    }
    if (gem.levelRequirement > stage.level) {
      findings.push({
        code: 'gem-level-requirement',
        message: `${gem.name} (${where}) at gem level ${gem.level} requires character level ${gem.levelRequirement}, above the stage's ${stage.level}`,
        data: { gem: gem.name, level: gem.level, levelRequirement: gem.levelRequirement, stageLevel: stage.level },
      });
    }
  }
}

function checkItems(stage: Stage, checks: StageChecks, findings: Finding[]): void {
  for (const item of checks.items) {
    if (item.levelRequirement > stage.level) {
      findings.push({
        code: 'item-level-requirement',
        message: `${item.name} (${item.slot}) requires character level ${item.levelRequirement}, above the stage's ${stage.level}`,
        data: { slot: item.slot, item: item.name, levelRequirement: item.levelRequirement, stageLevel: stage.level },
      });
    }
  }
}

function checkAttributes(checks: StageChecks, findings: Finding[]): void {
  for (const attr of ['Str', 'Dex', 'Int']) {
    const have = checks.attributes[attr] ?? 0;
    const required = checks.attributes[`Req${attr}`] ?? 0;
    if (have < required) {
      const source = checks.requirementSources[attr];
      findings.push({
        code: 'attributes',
        message: `${ATTRIBUTE_NAMES[attr]} ${have} is below the ${required} required by ${source?.name ?? 'an unnamed source'}`,
        data: { attribute: attr, have, required, source: source?.name ?? null, sourceKind: source?.source ?? null },
      });
    }
  }
}

/** C1's resistance penalty at a progress key, and the fact it rests on; null with the reason otherwise. */
export function expectedResistancePenalty(
  facts: FactReader,
  progress: string,
): { value: number; fact: NonNullable<ReturnType<FactReader['fact']>> } | { value: null; reason: string } {
  const region = facts.string(C1.progress, `${progress}.region`);
  if (region === null) return { value: null, reason: `C1 gives ${progress} no region` };
  const fact = facts.fact(C1.limits, `resistance-penalty.${region.value}`);
  if (fact === null) return { value: null, reason: `C1 has no resistance penalty for ${region.value}` };
  if (typeof fact.value === 'number') return { value: fact.value, fact };
  if (typeof fact.value === 'object' && fact.value !== null && !Array.isArray(fact.value)) {
    const area = facts.number(C1.progress, `${progress}.area-level`);
    if (area === null) return { value: null, reason: `C1 gives ${progress} no area level to pick its ${region.value} penalty by` };
    const value = valueInRange(fact.value as Record<string, number | string>, area.value);
    if (value === null) return { value: null, reason: `C1's ${region.value} penalty has no range holding area level ${area.value}` };
    return { value, fact };
  }
  return { value: null, reason: `C1's ${region.value} penalty isn't a number or a range table` };
}

function checkResistancePenalty(stage: Stage, facts: FactReader, findings: Finding[], notes: Finding[]): void {
  const entry = [...stage.config.earned, ...stage.config.scenario].find((e) => e.option === RESISTANCE_PENALTY);
  if (entry === undefined) return;
  const expected = expectedResistancePenalty(facts, stage.progress);
  if (expected.value === null) {
    notes.push({
      code: 'resistance-penalty',
      message: `the listed ${RESISTANCE_PENALTY} isn't checked: ${expected.reason}`,
      data: { listed: entry.value },
    });
    return;
  }
  facts.rely('resistance-penalty', expected.fact);
  if (entry.value !== expected.value) {
    findings.push({
      code: 'resistance-penalty',
      message: `the stage lists ${RESISTANCE_PENALTY} ${JSON.stringify(entry.value)}, but C1 gives ${expected.value} at ${stage.progress}`,
      data: { listed: entry.value, expected: expected.value },
    });
  }
}

function checkWarnings(checks: StageChecks, martyrSpent: boolean, findings: Finding[]): V1Result['pobWarnings'] {
  const kept: string[] = [];
  const filtered: string[] = [];
  for (const line of checks.warnings) {
    if (INFORMATIONAL_WARNING.test(line) || (martyrSpent && TOO_MANY_PASSIVES_WARNING.test(line))) {
      filtered.push(line);
    } else {
      kept.push(line);
      findings.push({ code: 'pob-warning', message: line, data: { line } });
    }
  }
  return { kept, filtered };
}

function checkContinuity(stage: Stage, predecessor: Stage | null, findings: Finding[]): void {
  const current = new Set([...stage.tree.nodes, ...stage.tree.ascendancyNodes]);
  const dropped = predecessor === null
    ? []
    : sortNumbers(new Set([...predecessor.tree.nodes, ...predecessor.tree.ascendancyNodes].filter((n) => !current.has(n))));
  const declared = stage.respec === undefined ? null : sortNumbers(new Set(stage.respec.dropped));
  const from = predecessor === null ? 'no earlier stage' : `stage ${predecessor.id}`;
  if (declared === null) {
    if (dropped.length > 0) {
      findings.push({
        code: 'tree-continuity',
        message: `the tree drops ${dropped.length === 1 ? 'node' : 'nodes'} ${dropped.join(', ')} of ${from} with no respec (D-144)`,
        data: { predecessor: predecessor?.id ?? null, dropped },
      });
    }
  } else if (declared.length !== dropped.length || declared.some((n, i) => n !== dropped[i])) {
    findings.push({
      code: 'tree-continuity',
      message:
        `respec.dropped names ${declared.length > 0 ? declared.join(', ') : 'no node'}, but the tree drops ` +
        `${dropped.length > 0 ? dropped.join(', ') : 'no node'} of ${from} (D-144)`,
      data: { predecessor: predecessor?.id ?? null, dropped, declared },
    });
  }
}

/** V1 for one compiled stage. */
export function checkV1(input: V1Input): V1Result {
  const { stage, checks } = input;
  const facts = new FactReader(input.ref);
  const findings: Finding[] = [];
  const notes: Finding[] = [];
  const martyrSpent = checkPoints(stage, checks, facts, findings);
  checkAscendancy(stage, checks, facts, findings);
  checkGems(stage, checks, facts, findings, notes);
  checkItems(stage, checks, findings);
  checkAttributes(checks, findings);
  checkResistancePenalty(stage, facts, findings, notes);
  const pobWarnings = checkWarnings(checks, martyrSpent, findings);
  checkContinuity(stage, input.predecessor, findings);
  return { verdict: { pass: findings.length === 0, findings, notes: [...facts.notes(), ...notes] }, pobWarnings };
}
