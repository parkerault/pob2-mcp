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
import { checkV1, expectedResistancePenalty, parseRangeKey, predecessorOf, valueInRange } from '../../src/plan/checks/v1';
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
const LIMITS = readJson('campaign/limits.json');
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

  it('every progress key gets its region\'s value; an interlude key the range holding its own area level', () => {
    const facts = new FactReader(ref);
    for (const key of ORDER) {
      const region = PROGRESS.facts[`${key}.region`].value as string;
      const value = LIMITS.facts[`resistance-penalty.${region}`].value;
      let want: number;
      if (typeof value === 'number') {
        want = value;
      } else {
        const level = PROGRESS.facts[`${key}.area-level`].value as number;
        const hit = Object.entries<number>(value).find(([k]) => {
          const [lo, hi] = k.split('-').map(Number);
          return level >= lo && level <= hi;
        });
        want = hit![1];
      }
      const got = expectedResistancePenalty(facts, key);
      expect({ key, value: got.value }).toEqual({ key, value: want });
    }
  });
});

describe('A-P5 and D-212: on, and placeholder-driven', () => {
  const list: ConfigOptionDefault = { type: 'list', apply: true, default: -60, first: 0 };
  it('a list option is on when its value isn\'t its first entry; others when true or non-zero', () => {
    expect(isOnFor(-60, list)).toBe(true);
    expect(isOnFor(0, list)).toBe(false);
    expect(isOnFor('0', list)).toBe(false);
    expect(isOnFor(true, { type: 'check', apply: true })).toBe(true);
    expect(isOnFor(false, { type: 'check', apply: true })).toBe(false);
    expect(isOnFor(0, { type: 'count', apply: true })).toBe(false);
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

  it('PoB\'s "too many passive points" line is a finding unless the stage spends the Martyr point', () => {
    const plan = fixture();
    const [one] = stagesOf(plan);
    const line = 'You have too many passive points allocated';
    const v1 = checkV1({ stage: one, predecessor: null, checks: checksFor(one, { warnings: [line] }), ref });
    expect(v1.pobWarnings).toEqual({ kept: [line], filtered: [] });
    expect(v1.verdict.findings).toEqual([{ code: 'pob-warning', message: line, data: { line } }]);
  });

  it('a Spirit gem gets a note, not an availability check (A-31); a support gem is checked by tier', () => {
    const [one] = stagesOf(fixture());
    const gems: StageChecks['gems'] = [
      { group: 1, index: 1, name: 'Herald of Ice', level: 20, tier: 14, kind: 'spirit', levelRequirement: 0 },
      { group: 1, index: 2, name: 'Some Support', level: 1, tier: 5, kind: 'support', levelRequirement: 0 },
    ];
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
    buffOnslaught: { type: 'check', apply: true },
    conditionUsingFlask: { type: 'check', apply: true },
    multiplierRage: { type: 'count', apply: true },
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
      defaults: { ...defaults, [option]: { type: 'check', apply: true, default: true } },
      baseline: { schemaVersion: 1, options: { [option]: { rationale: 'r' } } },
      ref,
    });
    expect(v2.configEffective[option]).toEqual({ value: true, origin: 'default', class: 'baseline' });
    expect(v2.verdict.findings.map((f) => [f.code, f.data])).toEqual([
      ['quest-not-reached', { option, quest, progress: one.progress, origin: 'default' }],
    ]);
  });

  it('producersOf lists each producer once, in plan order', () => {
    const [one, two] = stagesOf(fixture());
    expect(producersOf([one, two])).toEqual([{ kind: 'gem', name: 'Rage I' }]);
  });
});
