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
 * | `gem-availability` | a skill gem's tier or level exceeds the highest uncut skill-gem level available at `progress`, or a support gem's tier the highest uncut support level; a Spirit gem (at one of C1's Spirit tiers) gets a note (A-31) |
 * | `gem-below-tier` | a skill gem's level is below its tier: by C1's `tier-rule`, an uncut gem of level N engraves a skill of tier N or lower at gem level N, so a tier-T skill gem starts at gem level T (D-259) |
 * | `gem-level-requirement` | a gem's level requirement exceeds the stage level |
 * | `item-level-requirement` | an equipped item's level requirement exceeds the stage level |
 * | `attributes` | Str < ReqStr, Dex < ReqDex or Int < ReqInt, naming the item or gem |
 * | `resistance-penalty` | the stage lists `resistancePenalty` with a value other than C1's at its progress point (at a region's last key, also the next region's entry value, D-251) |
 * | `pob-warning` | a PoB warning line other than the informational "Weapon set 2 passives available", and PoB's "too many passive points" when the stage spends the Martyr point PoB doesn't know |
 * | `tree-continuity` | the stage's tree doesn't contain its predecessor's apart from `respec.dropped`, or `respec.dropped` isn't exactly the dropped set (D-144). The predecessor is the previous stage on the stage's track: the campaign track, or the endgame ladder `m` → `b` → `n` (D-282, `predecessorOf`), so each rung's respec, which carries its gold cost, is checked against the rung before it |
 * | `missing-reason` | a socket group's `count` is above 1 and it has no `countReason`, or a `config.customMods` entry has no `reason` (D-293, D-322): Count and custom modifiers are estimates the plan must explain. One finding per group or entry; `data.path` is the missing field's path in the stage |
 * | `tree-shape` | the stage's trees, as `check_tree` computes them, break D-360's rule: each start (the class start, or an alternate start whose node is allocated) holds at most one tree, a loop through two of its exits being one tree (D-364); an alternate start holds one only while its node is allocated; and the ascendancy nodes form one tree with their start (`checkTreeShape`) |
 * | `support-sockets` | a tree-granted skill's group holds more supports than C1's estimated ceiling at the stage's level (`support-sockets.tree-granted`, a `judgment` fact at L, D-359); never an item-granted group, whose supports follow its item's sockets, or a gem's own group (`checkSupportSockets`) |
 * | `not-granted` | a group whose skill gem a passive grants ("Navira, the Last Mirage", node 32705), or whose `minionSkill` one grants (Navira's Fracturing, node 10561), by a `Grants Skill: <name>` line, on a stage that allocates none of those passives (D-380). PoB checks neither (spike A4). Only an enabled group or the main group, and never a gem an item of the stage grants (`checkNotGranted`) |
 *
 * **The resistance penalty's C1 value** for a progress key is `resistance-penalty.<region>` for the key's
 * region. The interlude value is keyed by area-level ranges (`"<lo>-<hi>"`), so the key's own area level
 * picks the range. The key is the last reward quest reached, so at the last key of a region the next
 * region's entry value is accepted too, with a note naming the boundary (D-251).
 *
 * **Spirit gems** (A-31): a gem that reserves Spirit is noted, not checked, only when its tier is one of C1's
 * `spirit-tiers`; any other non-support gem is checked against the uncut skill gems, and against the tier
 * floor (D-259). A tier-0 gem isn't cut (C1's `skill-tiers` note), so it has no floor; a support gem's level
 * isn't cut either, so neither has one.
 */
import type { StageChecks, StageTrees, TreeStart } from '../../engine/schemas.js';
import type { Finding, Verdict } from '../record.js';
import type { PlanReferenceData, ResolvedFact } from '../referenceData.js';
import { PLAN_VARIANTS, type Stage } from '../schema.js';
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
  /** The stage's continuity predecessor (`predecessorOf`, D-282), or null when no stage comes before it on its track. */
  predecessor: Stage | null;
  /** `compile_stage`'s V1 inputs for the stage. */
  checks: StageChecks;
  ref: PlanReferenceData;
  /** `compile_check`'s trees for the stage (D-360). Without them, `tree-shape` isn't checked. */
  trees?: StageTrees;
}

export interface V1Result {
  verdict: Verdict;
  /** PoB's warning lines: kept (each a `pob-warning` finding) and filtered (informational). */
  pobWarnings: { kept: string[]; filtered: string[] };
}

/**
 * The continuity predecessor (§3.7). Stages without `variant` form the campaign track, in plan order. The
 * endgame stages form one track, the ladder (D-282): `m` (`entering-maps`) continues from the last campaign
 * stage, `b` (`budget`) from `m`, and `n` (`non-budget`) from `b`. The ladder goes by rung (`PLAN_VARIANTS`'
 * order), then plan order within a rung, so a plan that lists `m` after `b` still puts it first. A rung the
 * plan doesn't have is skipped: without `m`, `b` continues from the last campaign stage. The ladder's first
 * stage continues from the campaign's end, the last campaign stage in the plan wherever the rung is listed
 * (D-281: `m` sits between the campaign's end and `b`), and from no stage when the plan has no campaign
 * stage. This replaces A-P3's per-variant tracks, where `n` continued from the campaign rather than from `b`.
 */
export function predecessorOf(stages: readonly Stage[], index: number): Stage | null {
  const stage = stages[index];
  const lastCampaignBefore = (at: number): Stage | null => {
    for (let i = at - 1; i >= 0; i--) if (stages[i].variant === undefined) return stages[i];
    return null;
  };
  if (stage.variant === undefined) return lastCampaignBefore(index);
  const rung = (s: Stage) => PLAN_VARIANTS.indexOf(s.variant!);
  const ladder = stages
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.variant !== undefined)
    .sort((a, b) => rung(a.s) - rung(b.s) || a.i - b.i);
  const at = ladder.findIndex(({ i }) => i === index);
  return at > 0 ? ladder[at - 1].s : lastCampaignBefore(stages.length);
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
  // C1's Spirit gem tiers: a gem that reserves Spirit is a Spirit gem only at one of them; a persistent minion
  // with a skill tier (Skeletal Brute, 13) comes from an uncut skill gem and is checked as one.
  const spiritTiersFact = facts.fact(C1.gems, 'spirit-tiers');
  const spiritTiers = new Set(
    Array.isArray(spiritTiersFact?.value) ? (spiritTiersFact!.value as string[]).map(Number).filter(Number.isFinite) : [],
  );
  // D-259: C1's cut rule. An uncut gem of level N engraves a skill of tier N or lower, at gem level N.
  const tierRule = facts.fact(C1.gems, 'tier-rule');
  for (const gem of checks.gems) {
    const where = `skill group ${gem.group} gem ${gem.index}`;
    const tier = gem.tier ?? 0;
    if (gem.kind === 'spirit' && spiritTiers.has(tier)) {
      facts.rely('gem-availability', spiritTiersFact!);
      notes.push({
        code: 'gem-availability',
        message: `${gem.name} (${where}) is a Spirit gem; C1 has no Spirit gem table, so its availability isn't checked (A-31)`,
        data: { gem: gem.name, group: gem.group, index: gem.index },
      });
    } else {
      const isSkill = gem.kind !== 'support';
      const series = isSkill ? skill : support;
      const needed = isSkill ? Math.max(tier, gem.level) : tier;
      const level = series.levels.find((l) => l.n === needed);
      if (level !== undefined) facts.rely('gem-availability', level.fact);
      if (needed > series.max) {
        const kind = isSkill ? 'skill' : 'support';
        findings.push({
          code: 'gem-availability',
          message:
            `${gem.name} (${where}, tier ${tier}${isSkill ? `, level ${gem.level}` : ''}) needs an uncut ` +
            `${kind} gem of level ${needed}, but ${stage.progress} reaches uncut ${kind} gems of level ${series.max} at most`,
          data: { gem: gem.name, tier, ...(isSkill ? { level: gem.level } : {}), max: series.max },
        });
      }
      // The tier floor (D-259): a tier-T skill gem is cut from an uncut gem of level N >= T, at gem level N.
      if (isSkill && tierRule !== null && tier > 0) {
        facts.rely('gem-below-tier', tierRule);
        if (gem.level < tier) {
          findings.push({
            code: 'gem-below-tier',
            message:
              `${gem.name} (${where}) is at gem level ${gem.level}, below its tier ${tier}: C1's tier-rule ` +
              `("${String(tierRule.value)}") cuts a tier-${tier} skill gem at gem level ${tier} or higher`,
            data: { gem: gem.name, tier, level: gem.level, fact: 'tier-rule' },
          });
        }
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

/** C1's penalty for a region as a number, or its range table (`"<lo>-<hi>"` → value) for a range-keyed one. */
function regionPenalty(facts: FactReader, region: string): { fact: ResolvedFact; value: number | Record<string, number | string> } | null {
  const fact = facts.fact(C1.limits, `resistance-penalty.${region}`);
  if (fact === null) return null;
  if (typeof fact.value === 'number') return { fact, value: fact.value };
  if (typeof fact.value === 'object' && fact.value !== null && !Array.isArray(fact.value)) {
    return { fact, value: fact.value as Record<string, number | string> };
  }
  return null;
}

/** What C1 says the resistance penalty is at a progress key (§3.7, D-251). */
export type PenaltyExpectation =
  | {
      /** The penalty of the key's own region (a range-keyed region: the range holding the key's area level). */
      expected: number;
      /** Every value V1 accepts: `expected`, and at a region boundary also the next region's entry value. */
      accepted: number[];
      /** The boundary when the next progress key lies in another region (D-251), else null. */
      boundary: { region: string; next: string; nextRegion: string } | null;
      /** The facts the expectation rests on (A-29). */
      facts: ResolvedFact[];
    }
  | { expected: null; reason: string; facts: ResolvedFact[] };

/**
 * C1's resistance penalty at a progress key: its region's value, a range-keyed region's (the interludes)
 * picked by the key's own area level. The key is the last reward quest reached, so a stage at the last key
 * of a region may already stand in the next region's areas before that region's first reward quest: there
 * any value from the key's region's through the next region's entry value (the lowest range of a range-keyed
 * one) is accepted (D-251).
 */
export function resistancePenaltyAt(facts: FactReader, progress: string): PenaltyExpectation {
  const used: ResolvedFact[] = [];
  const region = facts.string(C1.progress, `${progress}.region`);
  if (region === null) return { expected: null, reason: `C1 gives ${progress} no region`, facts: used };
  used.push(region.fact);
  const own = regionPenalty(facts, region.value);
  if (own === null) return { expected: null, reason: `C1 has no resistance penalty for ${region.value} as a number or a range table`, facts: used };
  used.push(own.fact);
  let expected: number;
  if (typeof own.value === 'number') {
    expected = own.value;
  } else {
    const area = facts.number(C1.progress, `${progress}.area-level`);
    if (area === null) return { expected: null, reason: `C1 gives ${progress} no area level to pick its ${region.value} penalty by`, facts: used };
    used.push(area.fact);
    const value = valueInRange(own.value, area.value);
    if (value === null) return { expected: null, reason: `C1's ${region.value} penalty has no range holding area level ${area.value}`, facts: used };
    expected = value;
  }
  const keys = facts.ref.progressKeys;
  const next = keys[facts.progressIndex(progress) + 1];
  const nextRegion = next === undefined ? null : facts.string(C1.progress, `${next}.region`);
  if (next === undefined || nextRegion === null || nextRegion.value === region.value) {
    return { expected, accepted: [expected], boundary: null, facts: used };
  }
  used.push(nextRegion.fact);
  const theirs = regionPenalty(facts, nextRegion.value);
  if (theirs === null) return { expected, accepted: [expected], boundary: null, facts: used };
  used.push(theirs.fact);
  let entry: number | null = null;
  if (typeof theirs.value === 'number') {
    entry = theirs.value;
  } else {
    let lowest = Infinity;
    for (const [key, value] of Object.entries(theirs.value)) {
      const r = parseRangeKey(key);
      if (r !== null && typeof value === 'number' && r.lo < lowest) {
        lowest = r.lo;
        entry = value;
      }
    }
  }
  const accepted = entry === null || entry === expected ? [expected] : [expected, entry];
  return { expected, accepted, boundary: { region: region.value, next, nextRegion: nextRegion.value }, facts: used };
}

function checkResistancePenalty(stage: Stage, facts: FactReader, findings: Finding[], notes: Finding[]): void {
  const entry = [...stage.config.earned, ...stage.config.scenario].find((e) => e.option === RESISTANCE_PENALTY);
  if (entry === undefined) return;
  const at = resistancePenaltyAt(facts, stage.progress);
  for (const f of at.facts) facts.rely('resistance-penalty', f);
  if (at.expected === null) {
    notes.push({
      code: 'resistance-penalty',
      message: `the listed ${RESISTANCE_PENALTY} isn't checked: ${at.reason}`,
      data: { listed: entry.value },
    });
    return;
  }
  if (at.boundary !== null) {
    notes.push({
      code: 'resistance-penalty',
      message:
        `${stage.progress} is the last ${at.boundary.region} progress key before ${at.boundary.next} (${at.boundary.nextRegion}): ` +
        `a stage there may stand in either region, so ${at.accepted.join(' or ')} is accepted (D-251)`,
      data: { progress: stage.progress, next: at.boundary.next, region: at.boundary.region, nextRegion: at.boundary.nextRegion, accepted: at.accepted },
    });
  }
  if (typeof entry.value !== 'number' || !at.accepted.includes(entry.value)) {
    findings.push({
      code: 'resistance-penalty',
      message:
        `the stage lists ${RESISTANCE_PENALTY} ${JSON.stringify(entry.value)}, but C1 gives ${at.accepted.join(' or ')} at ${stage.progress}`,
      data: { listed: entry.value, expected: at.expected, ...(at.boundary !== null ? { accepted: at.accepted } : {}) },
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

/**
 * D-293, D-322: Count above 1 and every custom modifier are hand-made estimates, so each carries its reason.
 * A group without `count` counts as 1 and needs none.
 */
export function checkReasons(stage: Pick<Stage, 'skills' | 'config'>, findings: Finding[]): void {
  stage.skills.groups.forEach((g, k) => {
    const count = g.count ?? 1;
    if (count > 1 && g.countReason === undefined) {
      findings.push({
        code: 'missing-reason',
        message: `skill group ${k + 1}${g.label !== undefined ? ` (${g.label})` : ''} has count ${count} but no countReason: say why ${count} copies act at once (D-293)`,
        data: { path: `skills.groups[${k}].countReason`, group: k + 1, count },
      });
    }
  });
  (stage.config.customMods ?? []).forEach((m, k) => {
    if (m.reason === undefined) {
      findings.push({
        code: 'missing-reason',
        message: `custom modifier ${k + 1} ("${m.text}") has no reason: say what it stands for and how it was calculated (D-293)`,
        data: { path: `config.customMods[${k}].reason`, text: m.text },
      });
    }
  });
}

const nodeList = (nodes: readonly number[]) => `${nodes.length} node${nodes.length === 1 ? '' : 's'}: ${nodes.join(', ')}`;
const startText = (s: TreeStart) => `the ${s.name} start${s.node !== undefined ? ` (${s.node})` : ''}`;

/**
 * `tree-shape` (D-360, I-3), over the stage's trees as `check_tree` computes them (`compile_check`'s `trees`):
 * the main tree's components, class starts not joining their exits, and the ascendancy's. PoB2 v0.23.1
 * enforces none of the rule, so V1 does. A start exit counts when its start is open: the class start, or an
 * alternate start whose node the stage allocates (Path of the Sorceress, 12795, opens the Sorceress start's
 * exits 4739 and 44871). A tree is one connected group of allocated nodes, the start not counted, so a loop
 * touching two exits of its start through its own nodes is one tree, and legal (D-364: the user's rule is "two
 * unconnected start nodes"). One finding per broken rule, naming the stage, the start and each tree's nodes:
 * - `alternate-start`: a tree leaves only by an alternate start's exit, and the stage doesn't allocate its node;
 * - `one-tree-per-start`: a start's exits lead into more than one tree;
 * - `ascendancy`: the ascendancy nodes aren't one tree with their start over ascendancy links.
 */
export function checkTreeShape(trees: StageTrees | undefined, findings: Finding[]): void {
  if (trees === undefined) return;
  const stage = trees.stage;
  const open = new Map<number, TreeStart>();
  const closed = new Map<number, TreeStart>();
  for (const s of trees.starts) {
    for (const e of s.exits) (s.grantedBy === undefined || s.granted === true ? open : closed).set(e, s);
  }
  const held = new Map<TreeStart, { exits: number[]; nodes: number[] }[]>();
  for (const t of trees.main) {
    const exits = t.exits.filter((e) => open.has(e));
    const locked = t.exits.filter((e) => closed.has(e));
    if (exits.length === 0 && locked.length > 0) {
      const s = closed.get(locked[0])!;
      findings.push({
        code: 'tree-shape',
        message:
          `stage ${stage}: a tree leaves ${startText(s)} by ${locked.join(' and ')} (${nodeList(t.nodes)}), but that start holds ` +
          `a tree only while ${s.grantedByName ?? 'its node'} (${s.grantedBy}) is allocated (D-360)`,
        data: { stage, rule: 'alternate-start', start: s.node ?? null, startName: s.name, grantedBy: s.grantedBy, trees: [{ exits: locked, nodes: t.nodes }] },
      });
    }
    for (const s of new Set(exits.map((e) => open.get(e)!))) {
      const list = held.get(s) ?? [];
      list.push({ exits: exits.filter((e) => open.get(e) === s), nodes: t.nodes });
      held.set(s, list);
    }
  }
  for (const [s, list] of held) {
    if (list.length < 2) continue;
    findings.push({
      code: 'tree-shape',
      message:
        `stage ${stage}: ${startText(s)} holds ${list.length} trees, where a start holds at most one (D-360): ` +
        list.map((t, i) => `tree ${i + 1} leaves by ${t.exits.join(' and ')} (${nodeList(t.nodes)})`).join('; '),
      data: { stage, rule: 'one-tree-per-start', start: s.node ?? null, startName: s.name, trees: list },
    });
  }
  const asc = trees.ascendancy;
  if (asc !== undefined && asc.trees.length > 1) {
    const [own, ...cut] = asc.trees;
    findings.push({
      code: 'tree-shape',
      message:
        `stage ${stage}: the ${asc.name} nodes form ${asc.trees.length} trees, where they form one with the ${asc.name} start ` +
        `(${asc.start}) over ascendancy links (D-360): the start's tree (${nodeList(own.nodes)}); cut off: ` +
        cut.map((t) => `(${nodeList(t.nodes)})`).join('; '),
      data: { stage, rule: 'ascendancy', start: asc.start, startName: asc.name, trees: asc.trees.map((t) => ({ nodes: t.nodes })) },
    });
  }
}

/** C1's estimated support ceiling for a tree-granted skill, keyed by character-level ranges (D-359). */
const TREE_GRANTED_SUPPORTS = 'support-sockets.tree-granted';

/** A `Grants Skill:` line of an item text, PoB's `{…}` tags and the level dropped: the skill's name. */
const GRANTS_SKILL = /^(?:\{[^}]*\})*\s*Grants Skill:\s*(?:Level\s+\S+\s+)?(.+?)\s*$/i;

/** The skills the stage's items and jewels grant, by their texts' `Grants Skill:` lines, lowercased. */
function itemGrantedSkills(items: Stage['items']): Set<string> {
  const out = new Set<string>();
  for (const { text } of [...items.slots, ...items.treeJewels]) {
    for (const line of text.split(/\r?\n/)) {
      const m = GRANTS_SKILL.exec(line);
      if (m) out.add(m[1].toLowerCase());
    }
  }
  return out;
}

/**
 * `support-sockets` (D-359, I-2). A skill a passive grants takes no Jeweller's Orb, so its supports follow
 * character level by C1's estimated table (`support-sockets.tree-granted`, a `judgment` fact at L, read by range
 * like the interlude's penalty); an item-granted skill's follow its item's sockets and a gem's its own, so
 * neither is checked. Neither the plan's groups nor PoB's gem list say where a group's skill comes from (PoB's
 * own granted groups, `group.source`, are left out of the gem list), so a group's skill is its first non-support
 * gem, and the group is tree-granted by elimination: the skill is tier 0 in PoB's data (an unknown tier is never
 * flagged), which no uncut gem engraves (C1's
 * `skill-tiers`), and no `Grants Skill:` line of the stage's item texts names it. One finding per group over the
 * ceiling, counting every support the group holds; the verdict rests on the estimate, so it is noted (A-29).
 */
export function checkSupportSockets(
  stage: Pick<Stage, 'level' | 'items'>,
  checks: Pick<StageChecks, 'gems'>,
  facts: FactReader,
  findings: Finding[],
): void {
  const table = facts.fact(C1.gems, TREE_GRANTED_SUPPORTS);
  if (table === null || typeof table.value !== 'object' || Array.isArray(table.value)) return;
  const ceiling = valueInRange(table.value as Record<string, number | string>, stage.level);
  if (ceiling === null) return;
  const byItem = itemGrantedSkills(stage.items);
  const groups = new Map<number, StageChecks['gems']>();
  for (const gem of checks.gems) groups.set(gem.group, [...(groups.get(gem.group) ?? []), gem]);
  for (const [group, gems] of [...groups].sort(([a], [b]) => a - b)) {
    const skill = gems.filter((g) => g.kind !== 'support').sort((a, b) => a.index - b.index)[0];
    if (skill === undefined || skill.tier !== 0 || byItem.has(skill.name.toLowerCase())) continue;
    facts.rely('support-sockets', table);
    const supports = gems.filter((g) => g.kind === 'support').length;
    if (supports <= ceiling) continue;
    findings.push({
      code: 'support-sockets',
      message:
        `${skill.name} (skill group ${group}) is a tree-granted skill (tier 0, and no item of the stage grants it) with ` +
        `${supports} supports, above the estimated ceiling of ${ceiling} at level ${stage.level} ` +
        `(${C1.gems}#${TREE_GRANTED_SUPPORTS}, confidence ${table.fact.confidence}, D-359): a skill a passive grants takes no Jeweller's Orb. ` +
        `If an item grants it, its item text lacks the \`Grants Skill:\` line`,
      data: { group, skill: skill.name, supports, ceiling, level: stage.level, fact: TREE_GRANTED_SUPPORTS },
    });
  }
}

/**
 * `not-granted` (D-380). A skill a passive grants is the player's only while the stage allocates that passive, and
 * PoB measures it either way: it builds a socketed copy of a tree-granted summon, and it computes a minion's
 * command from the minion's skill list whatever the tree holds (spike A4). `compile_stage` names each group's
 * skill gem and `minionSkill` that a passive's `Grants Skill:` line grants, with whether the stage allocates any
 * granting passive (`checks.grantedSkills`). A group PoB doesn't use (disabled, and not the main group) and a gem
 * the stage's items grant (their `Grants Skill:` lines) are left out. One finding per group and skill.
 */
export function checkNotGranted(
  stage: Pick<Stage, 'items' | 'skills'>,
  checks: Pick<StageChecks, 'grantedSkills'>,
  findings: Finding[],
): void {
  const byItem = itemGrantedSkills(stage.items);
  for (const g of checks.grantedSkills ?? []) {
    if (g.allocated) continue;
    const group = stage.skills.groups[g.group - 1];
    if (group === undefined || (!group.enabled && stage.skills.main.group !== g.group)) continue;
    if (g.kind === 'gem' && byItem.has(g.name.toLowerCase())) continue;
    const nodes = g.nodes.map((n) => `${n.name} (node ${n.id})`).join(' or ');
    const what = g.kind === 'gem' ? `its skill gem ${g.name}` : `its minion skill ${g.name}`;
    findings.push({
      code: 'not-granted',
      message:
        `skill group ${g.group} uses ${what}, which a passive grants (${nodes}), but the stage allocates none of them (D-380): ` +
        `in game the skill isn't available at this stage, though PoB measures it`,
      data: { group: g.group, kind: g.kind, name: g.name, nodes: g.nodes.map((n) => n.id) },
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
  checkReasons(stage, findings);
  checkTreeShape(input.trees, findings);
  checkSupportSockets(stage, checks, facts, findings);
  checkNotGranted(stage, checks, findings);
  return { verdict: { pass: findings.length === 0, findings, notes: [...facts.notes(), ...notes] }, pobWarnings };
}
