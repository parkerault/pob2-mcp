/**
 * V1 and V2's rules without the engine (WU-42, slice 2 §3.7): the continuity predecessor (A-P3), the
 * resistance penalty at a progress key (range-keyed interlude values), "on" and placeholder-driven
 * (A-P5, D-212), the baseline list's loader (D-230), and checks over hand-made stage inputs. The engine
 * criteria (AC-P39…AC-P44, AC-P50) are `tests/integration/planChecks.test.ts`.
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
import { producersOf } from '../../src/plan/compiler';
import { loadReferenceData } from '../../src/plan/referenceData';
import { validatePlan, type Stage } from '../../src/plan/schema';
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

describe('A-P3: the continuity predecessor', () => {
  it('a campaign stage continues from the last campaign stage; a variant track from its own last stage, else the last campaign stage before it', () => {
    const s = (id: string, variant?: 'budget' | 'non-budget') => ({ id, ...(variant ? { variant } : {}) }) as unknown as Stage;
    const stages = [s('c1'), s('b1', 'budget'), s('c2'), s('n1', 'non-budget'), s('b2', 'budget'), s('c3')];
    const pred = (i: number) => predecessorOf(stages, i)?.id ?? null;
    expect([0, 1, 2, 3, 4, 5].map(pred)).toEqual([null, 'c1', 'c1', 'c2', 'b1', 'c2']);
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
