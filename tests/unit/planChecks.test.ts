/**
 * V1 and V2's rules without the engine (WU-42, slice 2 §3.7): the continuity predecessor and the endgame
 * ladder (WU-61, D-282; AC-P59), the entering-maps variant (WU-61, D-281; AC-P58), Count and custom modifiers
 * with their reasons (WU-55, D-293, D-322; AC-P51, AC-P52) and the record's Count rule, the resistance penalty at
 * a progress key (range-keyed interlude values), "on" and placeholder-driven (A-P5, D-212), the baseline
 * list's loader (D-230), and checks over hand-made stage inputs. The engine criteria (AC-P39…AC-P44,
 * AC-P50) are `tests/integration/planChecks.test.ts`.
 *
 * C1 values are read here as plain JSON from `data/`, never from the checks.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { checkV1, parseRangeKey, predecessorOf, resistancePenaltyAt, valueInRange } from '../../src/plan/checks/v1';
import { checkV2, isOnFor, isPlaceholderDriven, producerKey } from '../../src/plan/checks/v2';
import { FactReader } from '../../src/plan/checks/facts';
import { ConfigBaselineError, loadConfigBaseline, parseConfigBaseline } from '../../src/plan/checks/configBaseline';
import { measuredWithCustomMods, producersOf } from '../../src/plan/compiler';
import { COUNT_RULE, countedFields, countedFigures, formulaReadsStages } from '../../src/plan/record';
import { loadReferenceData } from '../../src/plan/referenceData';
import { validatePlan, type PlanVariant, type Stage } from '../../src/plan/schema';
import type { ConfigOptionDefault, StageChecks } from '../../src/engine/schemas';

const REPO = path.resolve(__dirname, '..', '..');
const DATA = path.join(REPO, 'data');
const ref = loadReferenceData(DATA);
type Json = Record<string, any>;
const readJson = (rel: string): Json => JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));
const PROGRESS = readJson('campaign/progress.json');
const ORDER: string[] = PROGRESS.facts.order.value;

function fixture(): Json {
  return JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json'), 'utf8'));
}
function stagesOf(plan: Json): Stage[] {
  const v = validatePlan(JSON.stringify(plan), ref);
  if (!v.ok) throw new Error(JSON.stringify(v.errors));
  return v.plan.stages;
}

/** Stage inputs for a stage that holds nothing beyond its plan: no warnings, no requirements. */
function checksFor(stage: Stage, over: Partial<StageChecks> = {}): StageChecks {
  return {
    counts: { used: stage.tree.nodes.length, ascendancy: stage.tree.ascendancyNodes.length, secondaryAscendancy: 0, sockets: 0, weaponSet1: 0, weaponSet2: 0 },
    extraPoints: 0,
    passivePointsToWeaponSetPoints: 0,
    attributes: { Str: 20, Dex: 7, Int: 7, ReqStr: 0, ReqDex: 0, ReqInt: 0 },
    requirementSources: {},
    gems: [],
    items: [],
    warnings: [],
    nodeNames: [],
    activeSkills: [],
    config: { input: {}, placeholder: {} },
    shownOptions: [],
    ...over,
  } as StageChecks;
}

const judgment = (r: string) => ({ kind: 'judgment', ref: r, confidence: 'M' });

/**
 * The fixture with the endgame ladder after it (D-281): stages `m`, `b` and `n`, each stage 2's content at the
 * endgame with the variant fields, and each tree its predecessor's plus one node: `m` adds 900001, `b` 900002
 * and `n` 900003. The schema doesn't look node ids up; the engine isn't involved here.
 */
function ladderPlan(): Json {
  const plan = fixture();
  const base = plan.stages[1];
  let nodes: number[] = [...base.tree.nodes];
  const rung = (id: string, variant: PlanVariant, level: number, added: number): Json => {
    nodes = [...nodes, added];
    const stage = JSON.parse(JSON.stringify(base));
    Object.assign(stage, {
      id,
      loadoutName: `Endgame ${variant} (L${level}) {${id}}`,
      level,
      progress: 'endgame',
      variant,
      ascendancyPoints: 0,
      variantBasis: { level: judgment('level'), gemLevels: judgment('gems'), ascendancyPoints: judgment('trials') },
      claims: [],
    });
    stage.tree.nodes = nodes;
    return stage;
  };
  plan.stages.push(rung('m', 'entering-maps', 65, 900001), rung('b', 'budget', 90, 900002), rung('n', 'non-budget', 95, 900003));
  return plan;
}

describe('AC-P58 (WU-61, D-281): the entering-maps variant', () => {
  it('AC-P58: validatePlan accepts a stage with variant "entering-maps" and the variant fields (ascendancyPoints, variantBasis, rolledGroup)', () => {
    const plan = ladderPlan();
    const v = validatePlan(JSON.stringify(plan), ref);
    expect(v.ok ? 'ok' : v.errors).toBe('ok');
    if (!v.ok) return;
    const m = v.plan.stages.find((s) => s.id === 'm')!;
    expect({ variant: m.variant, ascendancyPoints: m.ascendancyPoints, basis: Object.keys(m.variantBasis!), rolledGroup: m.skills.rolledGroup }).toEqual({
      variant: 'entering-maps',
      ascendancyPoints: 0,
      basis: ['level', 'gemLevels', 'ascendancyPoints'],
      rolledGroup: 1,
    });
  });

  it('AC-P58: the variant-stage rules apply to m as to b and n (D-193, D-217, D-234)', () => {
    const errorPaths = (edit: (m: Json) => void) => {
      const plan = ladderPlan();
      edit(plan.stages[2]);
      const v = validatePlan(JSON.stringify(plan), ref);
      return v.ok ? [] : v.errors.map((e) => e.path);
    };
    expect(errorPaths((m) => (m.chaosResistException = { reason: 'Chaos Inoculation', tag: judgment('ci') }))).toEqual([]);
    expect(errorPaths((m) => delete m.ascendancyPoints)).toEqual(['stages[2].ascendancyPoints']);
    expect(errorPaths((m) => delete m.skills.rolledGroup)).toEqual(['stages[2].skills.rolledGroup']);
  });
});

describe('AC-P59 (WU-61, D-282): the continuity predecessor, one endgame track', () => {
  const s = (id: string, variant?: PlanVariant) => ({ id, ...(variant ? { variant } : {}) }) as unknown as Stage;
  const preds = (stages: Stage[]) => stages.map((_, i) => predecessorOf(stages, i)?.id ?? null);

  it('AC-P59: m continues from the last campaign stage, b from m, n from b; a campaign stage from the last campaign stage', () => {
    expect(preds([s('1'), s('2'), s('m', 'entering-maps'), s('b', 'budget'), s('n', 'non-budget')])).toEqual([null, '1', '2', 'm', 'b']);
  });

  it('AC-P59: the ladder goes by rung whatever the plan order, a rung the plan lacks is skipped, and stages of one rung follow plan order', () => {
    expect(preds([s('1'), s('2'), s('b', 'budget'), s('n', 'non-budget'), s('m', 'entering-maps')])).toEqual([null, '1', 'm', 'b', '2']);
    // Without m (every version-1 plan): b continues from the campaign, and n from b, where A-P3 had n from the campaign.
    expect(preds([s('1'), s('2'), s('b', 'budget'), s('n', 'non-budget')])).toEqual([null, '1', '2', 'b']);
    expect(preds([s('1'), s('b1', 'budget'), s('b2', 'budget'), s('n', 'non-budget')])).toEqual([null, '1', 'b1', 'b2']);
    // The ladder's first stage continues from the campaign's end, the last campaign stage in the plan, even one
    // listed after it; with no campaign stage, from none.
    expect(preds([s('c1'), s('m', 'entering-maps'), s('c2')])).toEqual([null, 'c2', 'c1']);
    expect(preds([s('c1'), s('b1', 'budget'), s('c2'), s('n1', 'non-budget'), s('b2', 'budget'), s('c3')])).toEqual([null, 'c3', 'c1', 'b2', 'b1', 'c2']);
    expect(preds([s('b', 'budget'), s('n', 'non-budget')])).toEqual([null, 'b']);
  });
});

describe('AC-P59 (WU-61, D-282): tree-continuity along the ladder, through checkV1', () => {
  /** Each stage's tree-continuity findings, with the predecessor the compiler passes (compiler.ts, step 7). */
  function continuity(plan: Json): Record<string, unknown[]> {
    const stages = stagesOf(plan);
    return Object.fromEntries(
      stages.map((stage, i) => [
        stage.id,
        checkV1({ stage, predecessor: predecessorOf(stages, i), checks: checksFor(stage), ref }).verdict.findings
          .filter((f) => f.code === 'tree-continuity')
          .map((f) => f.data),
      ]),
    );
  }
  const none = { '1': [], '2': [], m: [], b: [], n: [] };
  const drop = (plan: Json, id: string, node: number) => {
    const stage = plan.stages.find((x: Json) => x.id === id);
    stage.tree.nodes = stage.tree.nodes.filter((n: number) => n !== node);
  };
  const respec = (plan: Json, id: string, dropped: number[]) => {
    plan.stages.find((x: Json) => x.id === id).respec = { dropped, goldCost: { value: 1000, source: judgment('respec cost') }, note: 'swap a node' };
  };

  it('AC-P59: a ladder whose every rung contains the rung before it has no finding', () => {
    expect(continuity(ladderPlan())).toEqual(none);
  });

  it('AC-P59: n dropping a node only b had, with no respec, is a finding on n against b; a respec naming it clears it', () => {
    // n still holds all of stage 2's tree, so A-P3's per-variant track (n from the campaign) found nothing here.
    const plan = ladderPlan();
    drop(plan, 'n', 900002);
    expect(continuity(plan)).toEqual({ ...none, n: [{ predecessor: 'b', dropped: [900002] }] });
    respec(plan, 'n', [900002]);
    expect(continuity(plan)).toEqual(none);
  });

  it('AC-P59: b dropping a node of m is a finding on b against m; m dropping a campaign node is a finding on m against stage 2', () => {
    const plan = ladderPlan();
    drop(plan, 'b', 900001);
    drop(plan, 'm', 32416);
    expect(continuity(plan)).toEqual({ ...none, m: [{ predecessor: '2', dropped: [32416] }], b: [{ predecessor: 'm', dropped: [900001] }] });
    respec(plan, 'b', [900001]);
    respec(plan, 'm', [32416]);
    expect(continuity(plan)).toEqual(none);
  });

  it('AC-P59: listed out of rung order, the rungs are still checked m → b → n', () => {
    const plan = ladderPlan();
    plan.stages.push(plan.stages.splice(2, 1)[0]); // plan order 1, 2, b, n, m
    drop(plan, 'b', 900001);
    expect(continuity(plan)).toEqual({ ...none, b: [{ predecessor: 'm', dropped: [900001] }] });
  });
});

describe('the resistance penalty at a progress key (C-35 limits, §3.7)', () => {
  it('parses "<lo>-<hi>" range keys and picks the range holding a level', () => {
    expect(parseRangeKey('54-59')).toEqual({ lo: 54, hi: 59 });
    expect(parseRangeKey('59-54')).toBeNull();
    expect(parseRangeKey('act1')).toBeNull();
    expect(valueInRange({ '54-59': -40, '60-64': -50 }, 59)).toBe(-40);
    expect(valueInRange({ '54-59': -40, '60-64': -50 }, 60)).toBe(-50);
    expect(valueInRange({ '54-59': -40, '60-64': -50 }, 65)).toBeNull();
  });

  // Hand-derived from data/campaign/progress.json (each key's region and area level, and the next key's
  // region) and data/campaign/limits.json (act1 0, act2 -10, act3 -20, act4 -30, interlude -40 at 54-59 and
  // -50 at 60-64, endgame -60). At the last key of a region the next region's entry value is accepted too
  // (D-251): the interludes' entry is their lowest range, -40.
  const CASES: { key: string; expected: number; accepted: number[]; boundary: string | null }[] = [
    { key: 'start', expected: 0, accepted: [0], boundary: null },
    { key: 'q.act-1-clearfell-beira', expected: 0, accepted: [0], boundary: null },
    { key: 'q.act-1-ogham-manor-candlemass', expected: 0, accepted: [0, -10], boundary: 'q.act-2-keth-kabala' },
    { key: 'q.act-2-keth-kabala', expected: -10, accepted: [-10], boundary: null },
    { key: 'q.act-2-spires-of-deshar-sisters-of-garukhan-shrine', expected: -10, accepted: [-10, -20], boundary: 'q.act-3-jungle-ruins-mighty-silverfist' },
    { key: 'q.act-3-jiquani-s-machinarium-blackjaw', expected: -20, accepted: [-20], boundary: null },
    { key: 'q.act-3-aggorat-blood-sacrifice', expected: -20, accepted: [-20, -30], boundary: 'q.act-4-isle-of-kin-blind-beast' },
    { key: 'q.act-4-halls-of-the-dead-ngamahu-s-test', expected: -30, accepted: [-30], boundary: null },
    { key: 'q.act-4-abandoned-prison-goddess-of-justice', expected: -30, accepted: [-30, -40], boundary: 'q.interlude-1-wolvenhold-oswin' },
    { key: 'q.interlude-1-wolvenhold-oswin', expected: -50, accepted: [-50], boundary: null },
    { key: 'q.interlude-2-khari-bazaar-clearing-the-way', expected: -50, accepted: [-50], boundary: null },
    { key: 'q.epilog-kingsmarch-siege-of-oriath', expected: -50, accepted: [-50, -60], boundary: 'endgame' },
    { key: 'endgame', expected: -60, accepted: [-60], boundary: null },
  ];

  it('D-251: each key\'s value, and at the last key of a region the next region\'s entry value too', () => {
    const facts = new FactReader(ref);
    for (const c of CASES) {
      expect(ORDER).toContain(c.key);
      const got = resistancePenaltyAt(facts, c.key);
      const shape = got.expected === null ? { reason: got.reason } : { expected: got.expected, accepted: got.accepted, boundary: got.boundary?.next ?? null };
      expect({ key: c.key, ...shape }).toEqual({ key: c.key, expected: c.expected, accepted: c.accepted, boundary: c.boundary });
    }
  });

  it('D-251 in V1: -40 passes at the last Act 4 key with a note naming the boundary; -50 there is a finding', () => {
    const plan = fixture();
    const s = plan.stages[0];
    s.progress = 'q.act-4-abandoned-prison-goddess-of-justice';
    const run = (value: number) => {
      s.config.scenario.find((e: Json) => e.option === 'resistancePenalty').value = value;
      const [one] = stagesOf(plan);
      return checkV1({ stage: one, predecessor: null, checks: checksFor(one), ref }).verdict;
    };
    const ok = run(-40);
    expect(ok.findings.filter((f) => f.code === 'resistance-penalty')).toEqual([]);
    expect(ok.notes.filter((n) => n.code === 'resistance-penalty' && n.data?.next !== undefined).map((n) => n.data)).toEqual([
      { progress: s.progress, next: 'q.interlude-1-wolvenhold-oswin', region: 'act4', nextRegion: 'interlude', accepted: [-30, -40] },
    ]);
    expect(run(-50).findings.filter((f) => f.code === 'resistance-penalty').map((f) => f.data)).toEqual([
      { listed: -50, expected: -30, accepted: [-30, -40] },
    ]);
  });

  it('A-29: the verdict rests on the key\'s region and area level too, so their M grades are noted', () => {
    // The epilogue key: region interlude (M) at area level 62 (M), then the endgame.
    const plan = fixture();
    const s = plan.stages[0];
    s.progress = 'q.epilog-kingsmarch-siege-of-oriath';
    s.config.scenario.find((e: Json) => e.option === 'resistancePenalty').value = -50;
    const [one] = stagesOf(plan);
    const notes = checkV1({ stage: one, predecessor: null, checks: checksFor(one), ref }).verdict.notes
      .filter((n) => n.code === 'resistance-penalty' && n.data?.fact !== undefined)
      .map((n) => n.data);
    expect(notes).toEqual(expect.arrayContaining([
      { file: 'campaign/progress.json', fact: 'q.epilog-kingsmarch-siege-of-oriath.region', confidence: 'M' },
      { file: 'campaign/progress.json', fact: 'q.epilog-kingsmarch-siege-of-oriath.area-level', confidence: 'M' },
      { file: 'campaign/limits.json', fact: 'resistance-penalty.interlude', confidence: 'M' },
    ]));
  });
});

describe('A-P5 and D-212: on, and placeholder-driven', () => {
  const list: ConfigOptionDefault = { type: 'list', apply: true, conditional: false, default: -60, first: 0 };
  it('a list option is on when its value isn\'t its first entry; others when true or non-zero', () => {
    expect(isOnFor(-60, list)).toBe(true);
    expect(isOnFor(0, list)).toBe(false);
    expect(isOnFor('0', list)).toBe(false);
    expect(isOnFor(true, { type: 'check', apply: true, conditional: false })).toBe(true);
    expect(isOnFor(false, { type: 'check', apply: true, conditional: false })).toBe(false);
    expect(isOnFor(0, { type: 'count', apply: true, conditional: false })).toBe(false);
    expect(isOnFor(3, undefined)).toBe(true);
  });

  it('a numeric option without input takes its placeholder (a count also when its input is 0); enemyLevel by UpdateLevel', () => {
    expect(isPlaceholderDriven('x', 'count', {}, { x: 5 })).toBe(true);
    expect(isPlaceholderDriven('x', 'count', { x: 0 }, { x: 5 })).toBe(true);
    expect(isPlaceholderDriven('x', 'count', {}, { x: 0 })).toBe(false);
    expect(isPlaceholderDriven('x', 'countAllowZero', { x: 0 }, { x: 5 })).toBe(false);
    expect(isPlaceholderDriven('x', 'countAllowZero', {}, { x: 0 })).toBe(true);
    expect(isPlaceholderDriven('x', 'integer', {}, { x: -10 })).toBe(true);
    expect(isPlaceholderDriven('x', 'check', {}, { x: 1 })).toBe(false);
    expect(isPlaceholderDriven('enemyLevel', 'count', { enemyLevel: 0 }, { enemyLevel: 14 })).toBe(true);
    expect(isPlaceholderDriven('enemyLevel', 'count', { enemyLevel: 20 }, { enemyLevel: 14 })).toBe(false);
  });
});

describe('D-230: the baseline list loader', () => {
  it('names the file and the option for an invalid entry, and the file for bad JSON or a wrong version', () => {
    const bad = parseConfigBaseline('x.json', JSON.stringify({ schemaVersion: 1, options: { enemyLevel: { rationale: '  ' }, b: { rationale: 'a\nb' } } }));
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors).toEqual([
      'x.json: options["enemyLevel"].rationale: the rationale must not be empty',
      'x.json: options["b"].rationale: the rationale is one line',
    ]);
    const v2 = parseConfigBaseline('x.json', JSON.stringify({ schemaVersion: 2, options: {} }));
    expect(v2.ok ? [] : v2.errors).toEqual(['x.json: schemaVersion: schemaVersion must be one of [1]']);
    const extra = parseConfigBaseline('x.json', JSON.stringify({ schemaVersion: 1, options: { a: { rationale: 'r', more: 1 } } }));
    expect(extra.ok ? [] : extra.errors.join('\n')).toMatch(/^x\.json: options\["a"\]: /);
    expect(parseConfigBaseline('x.json', '{').ok).toBe(false);
  });

  it('loads from an injected data directory, and a missing file is an error naming it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-baseline-'));
    try {
      expect(() => loadConfigBaseline(dir)).toThrow(ConfigBaselineError);
      expect(() => loadConfigBaseline(dir)).toThrow(path.join(dir, 'config-baseline.json'));
      fs.writeFileSync(path.join(dir, 'config-baseline.json'), JSON.stringify({ schemaVersion: 1, options: { a: { rationale: 'one line' } } }));
      expect(loadConfigBaseline(dir)).toEqual({ schemaVersion: 1, options: { a: { rationale: 'one line' } } });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('V1 over hand-made stage inputs', () => {
  it('tree-continuity: respec.dropped must be exactly the dropped set', () => {
    const plan = fixture();
    plan.stages[1].tree.nodes = plan.stages[1].tree.nodes.filter((n: number) => n !== 13397);
    plan.stages[1].tree.attributeChoices = [];
    plan.stages[1].respec = { dropped: [13397, 3936], goldCost: { value: 1, source: { kind: 'judgment', ref: 'x', confidence: 'M' } }, note: 'n' };
    const [one, two] = stagesOf(plan);
    const v1 = checkV1({ stage: two, predecessor: one, checks: checksFor(two), ref });
    expect(v1.verdict.findings.filter((f) => f.code === 'tree-continuity').map((f) => f.data)).toEqual([
      { predecessor: '1', dropped: [13397], declared: [3936, 13397] },
    ]);
  });

  it('a Spirit-reserving gem at a skill tier (a persistent minion) is checked as a skill gem', () => {
    const [one] = stagesOf(fixture());
    const gems: StageChecks['gems'] = [{ group: 1, index: 1, name: 'A Minion', level: 1, tier: 13, kind: 'spirit', levelRequirement: 0 }];
    // Stage 1 is at Beira, where uncut skill gems reach level 2 (uncut-skill.2.available-from).
    const v1 = checkV1({ stage: one, predecessor: null, checks: checksFor(one, { gems }), ref });
    expect(v1.verdict.findings.filter((f) => f.code === 'gem-availability').map((f) => f.data)).toEqual([
      { gem: 'A Minion', tier: 13, level: 1, max: 2 },
    ]);
    expect(v1.verdict.notes.filter((n) => n.data?.gem === 'A Minion')).toEqual([]);
  });

  it('D-259: a tier-7 skill gem at gem level 5 is gem-below-tier citing C1\'s tier-rule, though its uncut level is available; at gem level 7 it passes; tier 0, supports and Spirit-tier gems have no floor', () => {
    const gemsFile = readJson('campaign/gems.json');
    const rule = gemsFile.facts['tier-rule'];
    expect(rule).toMatchObject({ value: 'An uncut gem of level N engraves a skill of tier N or lower, at gem level N', confidence: 'H' });
    // Stage 2 is at Candlemass, where uncut skill gems reach level 7 (uncut-skill.7.available-from).
    const [, two] = stagesOf(fixture());
    expect(ORDER.indexOf(gemsFile.facts['uncut-skill.7.available-from'].value)).toBeLessThanOrEqual(ORDER.indexOf(two.progress));
    const run = (gems: StageChecks['gems']) => checkV1({ stage: two, predecessor: null, checks: checksFor(two, { gems }), ref }).verdict;
    const gem = (name: string, level: number, tier: number, kind: 'skill' | 'support' | 'spirit') =>
      ({ group: 1, index: 1, name, level, tier, kind, levelRequirement: 0 });

    const low = run([gem('Blood Hunt', 5, 7, 'skill')]);
    expect(low.findings.filter((f) => f.code === 'gem-below-tier').map((f) => f.data)).toEqual([
      { gem: 'Blood Hunt', tier: 7, level: 5, fact: 'tier-rule' },
    ]);
    expect(low.findings.find((f) => f.code === 'gem-below-tier')?.message).toContain(rule.value);
    // The availability check alone passes it: uncut level 7 is available at Candlemass.
    expect(low.findings.filter((f) => f.code === 'gem-availability')).toEqual([]);
    expect(low.pass).toBe(false);

    const at = run([gem('Blood Hunt', 7, 7, 'skill')]);
    expect(at.findings).toEqual([]);
    expect(at.pass).toBe(true);
    // A persistent minion at a skill tier is a skill gem, so it has the floor too.
    expect(run([gem('A Minion', 3, 5, 'spirit')]).findings.map((f) => f.code)).toEqual(['gem-below-tier']);

    // No floor: a tier-0 gem (not cut), a support (its level isn't cut) and a Spirit gem at a Spirit tier (A-31).
    expect(run([gem('Uncut', 1, 0, 'skill'), gem('Some Support', 1, 2, 'support'), gem('Herald of Ice', 1, 4, 'spirit')]).findings).toEqual([]);
  });

  it('PoB\'s "too many passive points" line is a finding unless the stage spends the Martyr point', () => {
    const plan = fixture();
    const [one] = stagesOf(plan);
    const line = 'You have too many passive points allocated';
    const v1 = checkV1({ stage: one, predecessor: null, checks: checksFor(one, { warnings: [line] }), ref });
    expect(v1.pobWarnings).toEqual({ kept: [line], filtered: [] });
    expect(v1.verdict.findings).toEqual([{ code: 'pob-warning', message: line, data: { line } }]);
  });

  it('a Spirit gem at a C1 Spirit tier gets a note, not an availability check (A-31); a support gem is checked by tier', () => {
    const [one] = stagesOf(fixture());
    const gems: StageChecks['gems'] = [
      { group: 1, index: 1, name: 'Herald of Ice', level: 20, tier: 14, kind: 'spirit', levelRequirement: 0 },
      { group: 1, index: 2, name: 'Some Support', level: 1, tier: 5, kind: 'support', levelRequirement: 0 },
    ];
    // C1's Spirit tiers (data/campaign/gems.json): 4, 8 and 14.
    expect(readJson('campaign/gems.json').facts['spirit-tiers'].value).toEqual(['4', '8', '14']);
    const v1 = checkV1({ stage: one, predecessor: null, checks: checksFor(one, { gems }), ref });
    expect(v1.verdict.notes.filter((n) => n.data?.gem === 'Herald of Ice').map((n) => n.code)).toEqual(['gem-availability']);
    const supportMax = Object.entries<Json>(readJson('campaign/gems.json').facts)
      .filter(([k, f]) => /^uncut-support\.\d+\.available-from$/.test(k) && ORDER.indexOf(f.value) <= ORDER.indexOf(one.progress))
      .reduce((m, [k]) => Math.max(m, Number(k.split('.')[1])), 0);
    expect(v1.verdict.findings.filter((f) => f.code === 'gem-availability').map((f) => f.data)).toEqual([
      { gem: 'Some Support', tier: 5, max: supportMax },
    ]);
  });
});

describe('AC-P66 (WU-67, D-359): support-sockets over the estimated table', () => {
  const GEMS = readJson('campaign/gems.json');
  const TABLE = GEMS.facts['support-sockets.tree-granted'];
  // Stage 2 of the fixture, with a Wooden Club that grants Firebolt (an item-granted skill, tier 0 like the tree's).
  const plan = fixture();
  plan.stages[1].items.slots[0].text = 'Rarity: Normal\nWooden Club\n{crafted}Grants Skill: Level 11 Firebolt';
  const [, base] = stagesOf(plan);
  const gem = (group: number, index: number, name: string, tier: number, kind: 'skill' | 'support') =>
    ({ group, index, name, level: 1, tier, kind, levelRequirement: 0 });
  /** A group of `skill` (tier `tier`) and `n` supports. */
  const group = (g: number, skill: string, tier: number, n: number): StageChecks['gems'] => [
    gem(g, 1, skill, tier, 'skill'),
    ...Array.from({ length: n }, (_, k) => gem(g, k + 2, `Support ${g}.${k + 1}`, 1, 'support')),
  ];
  const run = (level: number, gems: StageChecks['gems']) => {
    const stage = { ...base, level };
    return checkV1({ stage, predecessor: null, checks: checksFor(stage, { gems }), ref }).verdict;
  };
  const flagged = (v: ReturnType<typeof run>) => v.findings.filter((f) => f.code === 'support-sockets');

  it('AC-P66: gems.json holds the estimated table, a judgment fact at L: 3 below level 40, 4 from 40, 5 from 60', () => {
    expect(TABLE).toMatchObject({ value: { '1-39': 3, '40-59': 4, '60-100': 5 }, confidence: 'L' });
    expect(GEMS.sources.find((s: Json) => s.id === TABLE.source)).toMatchObject({ kind: 'judgment', confidence: 'L' });
  });

  it.each([
    [39, 3],
    [40, 4],
    [60, 5],
  ])('AC-P66: at level %i a tree-granted group with one support over the ceiling (%i) is support-sockets; at the ceiling it passes', (level, ceiling) => {
    const over = run(level, group(1, 'Explosive Concoction', 0, ceiling + 1));
    expect(flagged(over).map((f) => f.data)).toEqual([
      { group: 1, skill: 'Explosive Concoction', supports: ceiling + 1, ceiling, level, fact: 'support-sockets.tree-granted' },
    ]);
    expect(flagged(over)[0].message).toContain('campaign/gems.json#support-sockets.tree-granted');
    expect(over.pass).toBe(false);
    // The verdict rests on the L estimate, so it is noted (A-29).
    expect(over.notes.filter((n) => n.code === 'support-sockets').map((n) => n.data)).toEqual([
      { file: 'campaign/gems.json', fact: 'support-sockets.tree-granted', confidence: 'L' },
    ]);
    const at = run(level, group(1, 'Explosive Concoction', 0, ceiling));
    expect(flagged(at)).toEqual([]);
    expect(at.pass).toBe(true);
  });

  it('AC-P66: never an item-granted group (its item\'s Grants Skill line names it) or a gem\'s group, however many supports', () => {
    const gems = [...group(1, 'Firebolt', 0, 6), ...group(2, 'Lightning Arrow', 1, 6), ...group(3, 'Explosive Concoction', 0, 4)];
    const v = run(39, gems);
    // Only the tree-granted group 3 is flagged; at the ceiling of 3, without it, nothing is, and nothing is noted.
    expect(flagged(v).map((f) => f.data?.group)).toEqual([3]);
    const without = run(39, gems.filter((g) => g.group !== 3));
    expect(flagged(without)).toEqual([]);
    expect(without.notes.filter((n) => n.code === 'support-sockets')).toEqual([]);
    expect(without.pass).toBe(true);
  });

  it('never a skill whose tier PoB\'s data doesn\'t give, however many supports', () => {
    const unknown = group(1, 'Some Skill', 0, 6).map((g) => (g.kind === 'support' ? g : { ...g, tier: undefined }));
    expect(flagged(run(39, unknown))).toEqual([]);
  });
});

describe('V2 over hand-made stage inputs', () => {
  const defaults: Record<string, ConfigOptionDefault> = {
    buffOnslaught: { type: 'check', apply: true, conditional: false },
    conditionUsingFlask: { type: 'check', apply: true, conditional: false },
    multiplierRage: { type: 'count', apply: true, conditional: false },
  };
  const baseline = { schemaVersion: 1 as const, options: {} };

  it('a flask producer counts only with its toggle on; an item producer matches the base name', () => {
    const plan = fixture();
    plan.stages[0].config.earned.push(
      { option: 'conditionUsingFlask', value: true, producer: { kind: 'flask', name: 'Lesser Life Flask' }, uptime: 'u' },
      { option: 'buffOnslaught', value: true, producer: { kind: 'item', name: 'Rough Greaves' }, uptime: 'u' },
    );
    const [one] = stagesOf(plan);
    const producers = new Map(producersOf([one]).map((p) => [producerKey(p.kind, p.name), true]));
    const items = (active: boolean): StageChecks['items'] => [
      { slot: 'Boots', name: 'Hale Rough Greaves', baseName: 'Rough Greaves', levelRequirement: 0 },
      { slot: 'Flask 1', name: 'Lesser Life Flask', baseName: 'Lesser Life Flask', levelRequirement: 0, active },
    ];
    const gems: StageChecks['gems'] = [{ group: 1, index: 2, name: 'Rage I', level: 1, tier: 1, kind: 'support', levelRequirement: 0 }];
    const run = (active: boolean) =>
      checkV2({ stage: one, checks: checksFor(one, { items: items(active), gems }), producers, defaults, baseline, ref })
        .verdict.findings.filter((f) => f.code.startsWith('producer-'))
        .map((f) => f.data);
    expect(run(true)).toEqual([]);
    expect(run(false)).toEqual([{ option: 'conditionUsingFlask', kind: 'flask', name: 'Lesser Life Flask' }]);
  });

  it('a reward quest on by default beyond the stage\'s progress is quest-not-reached, even when the baseline list names it', () => {
    const plan = fixture();
    const stage = plan.stages[0];
    const [option, quest] = Object.entries<Json>(PROGRESS.facts)
      .filter(([k]) => k.endsWith('.pob-config-key'))
      .map(([k, f]) => [f.value as string, k.slice(0, -'.pob-config-key'.length)] as const)
      .find(([o, k]) => ORDER.indexOf(k) > ORDER.indexOf(stage.progress) && stage.config.earned.some((e: Json) => e.option === o))!;
    stage.config.earned = stage.config.earned.filter((e: Json) => e.option !== option);
    const [one] = stagesOf(plan);
    const v2 = checkV2({
      stage: one,
      checks: checksFor(one, {
        config: { input: { [option]: true }, placeholder: {} },
        gems: [{ group: 1, index: 2, name: 'Rage I', level: 1, tier: 1, kind: 'support', levelRequirement: 0 }],
        items: [{ slot: 'Flask 1', name: 'Lesser Life Flask', baseName: 'Lesser Life Flask', levelRequirement: 0, active: true }],
      }),
      producers: new Map([[producerKey('gem', 'Rage I'), true]]),
      defaults: { ...defaults, [option]: { type: 'check', apply: true, conditional: false, default: true } },
      baseline: { schemaVersion: 1, options: { [option]: { rationale: 'r' } } },
      ref,
    });
    expect(v2.configEffective[option]).toEqual({ value: true, origin: 'default', class: 'baseline' });
    expect(v2.verdict.findings.map((f) => [f.code, f.data])).toEqual([
      ['quest-not-reached', { option, quest, progress: one.progress, origin: 'default' }],
    ]);
  });

  it('D-250, D-252: the baseline list covers a conditional option only while PoB hides it, and no boss enemy stat on a boss stage', () => {
    const plan = fixture();
    const [one] = stagesOf(plan);
    const run = (shownOptions: string[], bossValue: string) => {
      const p2 = fixture();
      p2.stages[0].config.scenario.find((e: Json) => e.option === 'enemyIsBoss').value = bossValue;
      const [stage] = stagesOf(p2);
      const v2 = checkV2({
        stage,
        checks: checksFor(stage, {
          shownOptions,
          config: { input: { someSkillToggle: true }, placeholder: { enemyArmour: 49, enemySpeed: 700 } },
          gems: [{ group: 1, index: 2, name: 'Rage I', level: 1, tier: 1, kind: 'support', levelRequirement: 0 }],
          items: [{ slot: 'Flask 1', name: 'Lesser Life Flask', baseName: 'Lesser Life Flask', levelRequirement: 0, active: true }],
        }),
        producers: new Map([[producerKey('gem', 'Rage I'), true]]),
        defaults: {
          ...defaults,
          enemyIsBoss: { type: 'list', apply: true, conditional: false, default: 'Pinnacle', first: 'None' },
          someSkillToggle: { type: 'check', apply: true, conditional: true, default: true },
          enemyArmour: { type: 'countAllowZero', apply: true, conditional: false },
          enemySpeed: { type: 'countAllowZero', apply: false, conditional: false, defaultPlaceholder: 700 },
        },
        baseline: { schemaVersion: 1, options: { someSkillToggle: { rationale: 'r' }, enemyArmour: { rationale: 'r' }, enemySpeed: { rationale: 'r' } } },
        ref,
      });
      const cls = Object.fromEntries(['someSkillToggle', 'enemyArmour', 'enemySpeed'].map((o) => [o, v2.configEffective[o]?.class]));
      return { cls, unlisted: v2.verdict.findings.filter((f) => f.code === 'default-unlisted').map((f) => f.data!.option) };
    };
    expect(one.config.scenario.find((e) => e.option === 'enemyIsBoss')?.value).toBe('None');
    expect(run([], 'None')).toEqual({ cls: { someSkillToggle: 'baseline', enemyArmour: 'baseline', enemySpeed: 'baseline' }, unlisted: [] });
    expect(run(['someSkillToggle'], 'None')).toEqual({ cls: { someSkillToggle: 'unlisted', enemyArmour: 'baseline', enemySpeed: 'baseline' }, unlisted: ['someSkillToggle'] });
    expect(run([], 'Boss')).toEqual({ cls: { someSkillToggle: 'baseline', enemyArmour: 'unlisted', enemySpeed: 'baseline' }, unlisted: ['enemyArmour'] });
  });

  it('producersOf lists each producer once, in plan order', () => {
    const [one, two] = stagesOf(fixture());
    expect(producersOf([one, two])).toEqual([{ kind: 'gem', name: 'Rage I' }]);
  });
});

describe('AC-P51, AC-P52 (WU-55, D-293, D-322): Count and custom modifiers, their schema and their reasons', () => {
  /** Validation errors as `path: message` pairs, without the reference data (the shapes only). */
  const errorsOf = (plan: Json) => {
    const v = validatePlan(JSON.stringify(plan));
    return v.ok ? [] : v.errors;
  };
  /** V1's findings on stage 1 of `plan`, of the code WU-55 names. */
  const reasonFindings = (plan: Json) => {
    const [one] = stagesOf(plan);
    const v1 = checkV1({ stage: one, predecessor: null, checks: checksFor(one), ref });
    return { pass: v1.verdict.pass, findings: v1.verdict.findings.filter((f) => f.code === 'missing-reason') };
  };

  it('the fixture\'s stage 1 passes V1 with these hand-made inputs (the baseline for the cases below)', () => {
    expect(reasonFindings(fixture())).toEqual({ pass: true, findings: [] });
  });

  it('AC-P51: a group with count above 1 and no countReason is a V1 finding, missing-reason, so v1.pass is false; not a schema error', () => {
    const plan = fixture();
    plan.stages[0].skills.groups[1].count = 3;
    expect(errorsOf(plan)).toEqual([]);
    const { pass, findings } = reasonFindings(plan);
    expect(pass).toBe(false);
    expect(findings).toEqual([
      { code: 'missing-reason', message: expect.stringContaining('skill group 2 (Rolling Slam) has count 3 but no countReason'), data: { path: 'skills.groups[1].countReason', group: 2, count: 3 } },
    ]);
  });

  it('AC-P51: with a countReason there is no finding; a group without count counts as 1 and needs none, and so does count 1', () => {
    const plan = fixture();
    Object.assign(plan.stages[0].skills.groups[1], { count: 3, countReason: 'three totems are up at once' });
    expect(reasonFindings(plan)).toEqual({ pass: true, findings: [] });
    const one = fixture();
    one.stages[0].skills.groups[0].count = 1;
    expect(reasonFindings(one)).toEqual({ pass: true, findings: [] });
    // Without count, the group's figures take a count of 1 (record.ts, countedFigures).
    const [stage] = stagesOf(fixture());
    const c = countedFigures(stage, { TotalDPS: 10 }, { g2s1p1: { skill: 'Rolling Slam', statSetLabel: 'Slam', fields: { TotalDPS: 5 } } }, { main: false, skills: {} });
    expect(c.countedOutputs).toEqual({ group: 1, count: 1, dotCanStack: false, fields: { TotalDPS: 10 } });
    expect(c.countedSkillOutputs.g2s1p1).toMatchObject({ count: 1, fields: { TotalDPS: 5 } });
  });

  it('AC-P51: a count of 0, or one that isn\'t an integer, is a schema error at its path', () => {
    for (const bad of [0, 1.5, -2, '2']) {
      const plan = fixture();
      plan.stages[0].skills.groups[0].count = bad;
      expect({ bad, paths: errorsOf(plan).map((e) => e.path) }).toEqual({ bad, paths: ['stages[0].skills.groups[0].count'] });
    }
    const plan = fixture();
    plan.stages[0].skills.groups[0].countReason = '';
    expect(errorsOf(plan).map((e) => e.path)).toEqual(['stages[0].skills.groups[0].countReason']);
  });

  it('AC-P52: a customMods entry without a reason is a V1 finding; with one, none; a plan without customMods is valid', () => {
    expect(fixture().stages[0].config.customMods).toBeUndefined();
    expect(errorsOf(fixture())).toEqual([]);
    const plan = fixture();
    plan.stages[0].config.customMods = [{ text: '10% more Damage', reason: 'an effect PoB doesn\'t model' }, { text: '+20 to maximum Life' }];
    expect(errorsOf(plan)).toEqual([]);
    const { pass, findings } = reasonFindings(plan);
    expect(pass).toBe(false);
    expect(findings).toEqual([
      { code: 'missing-reason', message: expect.stringContaining('custom modifier 2 ("+20 to maximum Life") has no reason'), data: { path: 'config.customMods[1].reason', text: '+20 to maximum Life' } },
    ]);
    plan.stages[0].config.customMods[1].reason = 'a hand-calculated flat life';
    expect(reasonFindings(plan)).toEqual({ pass: true, findings: [] });
    // An empty list is no custom modifier at all.
    plan.stages[0].config.customMods = [];
    expect(errorsOf(plan)).toEqual([]);
    expect(reasonFindings(plan)).toEqual({ pass: true, findings: [] });
  });

  it('AC-P52: an entry\'s text is one non-empty line, its reason non-empty, and it has no other key; customMods isn\'t an earned or scenario option in version 2', () => {
    const paths = (edit: (p: Json) => void) => {
      const plan = fixture();
      edit(plan);
      return errorsOf(plan).map((e) => e.path);
    };
    expect(paths((p) => (p.stages[0].config.customMods = [{ text: '10% more Damage\n+20 to maximum Life', reason: 'r' }]))).toEqual(['stages[0].config.customMods[0].text']);
    expect(paths((p) => (p.stages[0].config.customMods = [{ text: '', reason: 'r' }]))).toEqual(['stages[0].config.customMods[0].text']);
    expect(paths((p) => (p.stages[0].config.customMods = [{ text: 'x', reason: '' }]))).toEqual(['stages[0].config.customMods[0].reason']);
    expect(paths((p) => (p.stages[0].config.customMods = [{ text: 'x', reason: 'r', source: 'y' }]))).toEqual(['stages[0].config.customMods[0]']);
    const at = fixture().stages[1].config.earned.length;
    expect(paths((p) => p.stages[1].config.earned.push({ option: 'customMods', value: '10% more Damage', producer: { kind: 'gem', name: 'Rage I' }, uptime: 'u' }))).toEqual([
      `stages[1].config.earned[${at}].option`,
    ]);
    // A version-1 plan keeps its own shape (D-332), where such an option is an ordinary one.
    expect(paths((p) => {
      p.schemaVersion = 1;
      p.stages[1].config.earned.push({ option: 'customMods', value: '10% more Damage', producer: { kind: 'gem', name: 'Rage I' }, uptime: 'u' });
    })).toEqual([]);
  });

  it('D-320, D-332: count, countReason and customMods are version 2: in a version-1 plan each use is an error at its path, naming the version', () => {
    const plan = fixture();
    plan.schemaVersion = 1;
    Object.assign(plan.stages[0].skills.groups[1], { count: 2, countReason: 'two copies' });
    plan.stages[1].skills.groups[0].count = 1;
    plan.stages[1].config.customMods = [];
    const errors = errorsOf(plan);
    expect(errors.map((e) => e.path).sort()).toEqual([
      'stages[0].skills.groups[1].count',
      'stages[0].skills.groups[1].countReason',
      'stages[1].config.customMods',
      'stages[1].skills.groups[0].count',
    ]);
    for (const e of errors) expect(e.message).toMatch(/needs schemaVersion 2 or later; this plan declares schemaVersion 1/);
    // Without them the version-1 plan is valid, every group counting 1.
    expect(errorsOf({ ...fixture(), schemaVersion: 1 })).toEqual([]);
  });
});

describe('WU-55 (D-293, D-321): the record\'s Count rule and custom-modifier marks, as pure functions', () => {
  it('countedFields: hits and impale × count; damage over time × count only when it stacks; the best ailment once; no other figure', () => {
    const fields = { TotalDPS: 100, ImpaleDPS: 10, TotalDot: 40, IgniteDPS: 7, PoisonDPS: 3, BleedDPS: 2, DecayDPS: 5, CombinedDPS: 157, Speed: 1.5, CritChance: 5 };
    expect(countedFields(fields, 3, false)).toEqual({ TotalDPS: 300, ImpaleDPS: 30, TotalDot: 40, IgniteDPS: 7, PoisonDPS: 3, BleedDPS: 2, DecayDPS: 5 });
    expect(countedFields(fields, 3, true)).toEqual({ TotalDPS: 300, ImpaleDPS: 30, TotalDot: 120, IgniteDPS: 7, PoisonDPS: 3, BleedDPS: 2, DecayDPS: 5 });
    expect(countedFields(fields, 1, true)).toEqual({ TotalDPS: 100, ImpaleDPS: 10, TotalDot: 40, IgniteDPS: 7, PoisonDPS: 3, BleedDPS: 2, DecayDPS: 5 });
    // An inherited property name is no rule.
    expect(countedFields({ constructor: 1, toString: 2 } as unknown as Record<string, number>, 2, false)).toEqual({});
    expect([...COUNT_RULE.keys()].sort()).toEqual(
      ['BleedDPS', 'BurningGroundDPS', 'CausticGroundDPS', 'CorruptingBloodDPS', 'DecayDPS', 'IgniteDPS', 'ImpaleDPS', 'PoisonDPS', 'TotalDPS', 'TotalDot'],
    );
  });

  it('countedFigures: each breakdown key takes its own group\'s count and stacking flag; the main figures take the main group\'s', () => {
    const plan = fixture();
    Object.assign(plan.stages[0].skills.groups[0], { count: 2, countReason: 'r' });
    Object.assign(plan.stages[0].skills.groups[1], { count: 5, countReason: 'r' });
    const [one] = stagesOf(plan);
    const entry = (fields: Record<string, number>) => ({ skill: 's', statSetLabel: 'l', fields });
    const c = countedFigures(
      one,
      { TotalDPS: 10, TotalDot: 4, Life: 300 },
      { g1s1p1: entry({ TotalDPS: 10, TotalDot: 4 }), g2s1p1: entry({ TotalDPS: 6, TotalDot: 2 }), g2s1p2: entry({ TotalDot: 2 }) },
      { main: true, skills: { g1s1p1: true, g2s1p2: true } },
    );
    expect(c.countedOutputs).toEqual({ group: 1, count: 2, dotCanStack: true, fields: { TotalDPS: 20, TotalDot: 8 } });
    expect(c.countedSkillOutputs).toEqual({
      g1s1p1: { skill: 's', statSetLabel: 'l', count: 2, dotCanStack: true, fields: { TotalDPS: 20, TotalDot: 8 } },
      g2s1p1: { skill: 's', statSetLabel: 'l', count: 5, dotCanStack: false, fields: { TotalDPS: 30, TotalDot: 2 } },
      g2s1p2: { skill: 's', statSetLabel: 'l', count: 5, dotCanStack: true, fields: { TotalDot: 10 } },
    });
  });

  it('formulaReadsStages: a formula reads a stage through a main-output or breakdown reference, never through an input', () => {
    const marked = new Set(['2']);
    expect(formulaReadsStages('(2.Life − 1.Life) ÷ 1.Life × per_cent', marked)).toBe(true);
    expect(formulaReadsStages('2.g1s1p1.TotalDPS', marked)).toBe(true);
    expect(formulaReadsStages('1.TotalDPS * x', marked)).toBe(false);
    expect(formulaReadsStages('1 +', marked)).toBe(false);
    expect(formulaReadsStages('2.Life', new Set())).toBe(false);
  });

  it('AC-P55 (D-321, D-332): measuredWithCustomMods marks a stage whose written config holds PoB\'s customMods option, whatever its source, a version-1 plan\'s earned or scenario entry included', () => {
    const marks = (plan: Json) => stagesOf(plan).map((s) => measuredWithCustomMods(s));
    const versionOne = (): Json => Object.assign(fixture(), { schemaVersion: 1 });
    expect(marks(fixture())).toEqual([false, false]);
    // Version 2: config.customMods.
    const two = fixture();
    two.stages[1].config.customMods = [{ text: '+100 to maximum Life', reason: 'r' }];
    expect(marks(two)).toEqual([false, true]);
    // Version 1: PoB's option listed as an earned entry, or as a scenario entry.
    const earned = versionOne();
    earned.stages[1].config.earned.push({ option: 'customMods', value: '+100 to maximum Life', producer: { kind: 'gem', name: 'Rage I' }, uptime: 'u' });
    expect(marks(earned)).toEqual([false, true]);
    const scenario = versionOne();
    scenario.stages[0].config.scenario.push({ ...scenario.stages[0].config.scenario[0], option: 'customMods', value: '10% more Damage' });
    expect(marks(scenario)).toEqual([true, false]);
    // An empty or blank value adds no modifier, so it carries no mark.
    for (const value of ['', '  ']) {
      const blank = versionOne();
      blank.stages[1].config.earned.push({ option: 'customMods', value, producer: { kind: 'gem', name: 'Rage I' }, uptime: 'u' });
      expect({ value, marks: marks(blank) }).toEqual({ value, marks: [false, false] });
    }
  });
});
