/**
 * WU-137 (amendment 14; AC-P90's schema rows): plan schema 10 through `validatePlan`, the compile's own validation (FR-P1,
 * D-163), and `buildSha1`. The engine row (a jewel in Crystalline Phylactery, 17788) is
 * `tests/integration/compileSchema10Jewel.test.ts`.
 *
 * Appendix A's plan (schema 10):
 * - a price entry's `listing {corrupted, sockets, count, position}` and `spec {base, weights, ranking, mustHaves, leftOut,
 *   searches}`, both left out of `buildSha1` (D-484, D-483, D-386's rule);
 * - `stages[].tree.exclude [{nodes, reason}]`, a reason required (D-490);
 * - `stages[].tree.search.targets {ehp, maxHit, why}` and `userMoves`, and `rebuild: "none: <the tool's reason>"` (D-490);
 * - `stages[].tree.end.endAfter: "swap"` (D-481);
 * - the plan's `itemSwaps [{stages, slot, from, to, bossBefore, bossAfter, reason}]` (D-481);
 * - `stages[].items.treeJewels` naming a `containJewelSocket` node of `tree.ascendancyNodes` (D-492); any other ascendancy
 *   node errs at its path.
 * Each errs at its own path on a schema-9 plan (D-320, D-332).
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { buildSha1 } from '../../src/plan/buildHash';
import { loadReferenceData } from '../../src/plan/referenceData';
import { END_AFTER, isAscendancyJewelSocket, PLAN_SCHEMA_VERSIONS, validatePlan, type PlanError } from '../../src/plan/schema';
import { TREE_JEWEL_SOCKETS } from '../../src/server/toolSchemas';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const LICH = path.join(REPO, 'tests', 'fixtures', 'plans', 'm27-wu137', 'lich', 'plan.json');
const judgment = (r: string) => ({ kind: 'judgment', ref: r, confidence: 'L' });
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;

/** The two-stage fixture at `version`, with the endgame rungs `b` and `n` after it (stage 2's content). */
function plan(version: number): Json {
  const p = read(TWO_STAGE);
  p.schemaVersion = version;
  for (const [id, variant, level] of [
    ['b', 'budget', 80],
    ['n', 'non-budget', 90],
  ] as const) {
    const s = JSON.parse(JSON.stringify(p.stages[1]));
    Object.assign(s, {
      id,
      loadoutName: `${variant} (L${level}) {${id}}`,
      level,
      progress: 'endgame',
      variant,
      ascendancyPoints: 0,
      variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') },
      claims: [],
    });
    p.stages.push(s);
  }
  return p;
}

const FIGURES = {
  ehp: 21000,
  lowestMaxHit: { type: 'physical', value: 4100 },
  life: 3138,
  boss: 380000,
  bossEntries: [{ group: 1, label: 'Boneshatter', figure: 300000 }],
};
const SEARCH = { swaps: 12, lastGain: 0.8, capHit: false, rebuild: 'taken', removed: [], bossFall: null };

const LISTING = { corrupted: false, sockets: 1, count: 14, position: 5 };
const SPEC = {
  base: 'Rough Greaves',
  weights: [
    { stat: 'FullDPS', weight: 1 },
    { stat: 'TotalEHP', weight: 0.5 },
    { stat: 'MovementSpeed', weight: 0.3, why: 'boots carry the 35% tier (D-440)' },
  ],
  ranking: [
    { affix: '+# to maximum Life', gain: 1.8, weight: 0.012 },
    { affix: '#% increased Movement Speed', gain: 0.9, weight: 0.03 },
  ],
  mustHaves: [
    { affix: '#% increased Movement Speed', tradeId: 'explicit.stat_2250533757', tier: 1, min: 35 },
    { affix: '+# to maximum Life', tradeId: 'explicit.stat_3299347043', tier: 3, min: 60 },
    { affix: '+#% to Fire Resistance', tradeId: 'explicit.stat_3372524247', tier: 2, min: 31, zeroScored: true, why: 'the fire cap' },
  ],
  leftOut: [{ affix: '+# to Evasion Rating', why: 'the build stacks no evasion' }],
  searches: 3,
};
const SWAP = {
  stages: ['b', 'n'],
  slot: 'Boots',
  from: 'Rough Greaves: 35% movement speed, +60 to maximum Life',
  to: 'Bones of Ullr',
  bossBefore: { b: 300000, n: 410000 },
  bossAfter: { b: 290000, n: 405000 },
  reason: 'the user asked for the unique; the boss figures fall 1–3% for its minion levels',
};

/** The plan at `version` with every schema-10 addition on `n` (stages[3]) and on its first price. */
function withAdditions(version: number): Json {
  const p = plan(version);
  const n = p.stages[3];
  n.tree.exclude = [{ nodes: [999999], reason: 'Mind Over Matter: the build keeps its mana for Arc (D1-build out)' }];
  n.tree.start = FIGURES;
  n.tree.end = { ...FIGURES, endAfter: 'swap' };
  n.tree.search = { ...SEARCH, targets: { ehp: 20500, maxHit: 4000, why: 'gear moved after D1-tree: the lower of tree.start and the compile' }, userMoves: 2, rebuild: "none: Strength would be 80, under the 112 its gear and gems need, after repair" };
  p.prices[0].listing = LISTING;
  p.prices[0].spec = SPEC;
  p.itemSwaps = [SWAP];
  return p;
}

function errorsOf(input: unknown): PlanError[] {
  const r = validatePlan(input, ref);
  return r.ok ? [] : r.errors;
}

describe('WU-137: plan schema 10 (Appendix A, AC-P90)', () => {
  it('schema 10 stays accepted (schema 11, amendment 16, is the current version); 1 to 9 too', () => {
    expect([...PLAN_SCHEMA_VERSIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(errorsOf(plan(10))).toEqual([]);
    expect(errorsOf(plan(9))).toEqual([]);
    expect(errorsOf({ ...plan(10), schemaVersion: 12 })).toEqual([
      { path: 'schemaVersion', message: 'schemaVersion is 12; the accepted versions are [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]' },
    ]);
  });

  it("AC-P90: a schema-10 plan with a price's listing and spec, tree.exclude, tree.search.targets and userMoves, rebuild \"none: <why>\", tree.end.endAfter \"swap\" and itemSwaps validates, each kept as written", () => {
    const p = withAdditions(10);
    const r = validatePlan(p, ref);
    expect(r.ok ? [] : r.errors).toEqual([]);
    if (!r.ok) return;
    const n = r.plan.stages[3];
    expect(r.plan.prices[0].listing).toEqual(LISTING);
    expect(r.plan.prices[0].spec).toEqual(SPEC);
    expect(n.tree.exclude).toEqual(p.stages[3].tree.exclude);
    expect(n.tree.search).toEqual(p.stages[3].tree.search);
    expect(n.tree.end?.endAfter).toBe('swap');
    expect(r.plan.itemSwaps).toEqual([SWAP]);
    expect([...END_AFTER]).toEqual(['swap']);
  });

  it('AC-P90: each addition errs at its own path on a schema-9 plan, naming version 10', () => {
    const errors = errorsOf(withAdditions(9));
    expect(errors.map((e) => e.path).sort()).toEqual(
      [
        'itemSwaps',
        'prices[0].listing',
        'prices[0].spec',
        'stages[3].tree.end.endAfter',
        'stages[3].tree.exclude',
        'stages[3].tree.search.rebuild',
        'stages[3].tree.search.targets',
        'stages[3].tree.search.userMoves',
      ].sort(),
    );
    for (const e of errors) expect({ path: e.path, message: e.message }).toEqual({ path: e.path, message: expect.stringMatching(/needs schemaVersion 10 or later; this plan declares schemaVersion 9/) });
  });

  it('AC-P90: a schema-9 plan keeps its rebuild outcomes "taken", "none" and "undone: <why>"', () => {
    for (const rebuild of ['taken', 'none', 'undone: the compile refused it (attributes)']) {
      const p = plan(9);
      p.stages[3].tree.search = { ...SEARCH, rebuild };
      expect({ rebuild, errors: errorsOf(p) }).toEqual({ rebuild, errors: [] });
    }
    const p = plan(10);
    p.stages[3].tree.search = { ...SEARCH, rebuild: 'none:' };
    expect(errorsOf(p).map((e) => e.path)).toEqual(['stages[3].tree.search.rebuild']);
  });

  it('AC-P90: a tree.exclude entry with no reason errs at its reason; one with no node, or naming a node the stage allocates, errs at its nodes', () => {
    const p = plan(10);
    const n = p.stages[3];
    n.tree.exclude = [{ nodes: [999999] }, { nodes: [], reason: 'none named' }];
    expect(errorsOf(p).map((e) => e.path)).toEqual(['stages[3].tree.exclude[0].reason', 'stages[3].tree.exclude[1].nodes']);
    const allocated = plan(10);
    allocated.stages[3].tree.exclude = [{ nodes: [999999, allocated.stages[3].tree.nodes[0]], reason: 'allocated' }];
    const errors = errorsOf(allocated);
    expect(errors.map((e) => e.path)).toEqual(['stages[3].tree.exclude[0].nodes[1]']);
    expect(errors[0].message).toMatch(/is in tree\.nodes: an excluded node is one the tree search may never add \(D-490\)/);
  });

  it("AC-P90: buildSha1 is equal with and without a price's listing and spec; a change to the price itself still changes it", () => {
    const bare = plan(10);
    const recorded = plan(10);
    recorded.prices[0].listing = LISTING;
    recorded.prices[0].spec = SPEC;
    expect(errorsOf(recorded)).toEqual([]);
    expect(buildSha1(recorded)).toBe(buildSha1(bare));
    const repriced = plan(10);
    repriced.prices[0].amount = (repriced.prices[0].amount as number) + 1;
    expect(buildSha1(repriced)).not.toBe(buildSha1(bare));
  });

  it("D-484: a listing's position is within its count; a spec's tier is 1 or more and its weights 0.01 to 1", () => {
    const p = plan(10);
    p.prices[0].listing = { ...LISTING, position: 15 };
    p.prices[1].spec = { ...SPEC, mustHaves: [{ ...SPEC.mustHaves[0], tier: 0 }], weights: [{ stat: 'FullDPS', weight: 2 }] };
    expect(errorsOf(p).map((e) => e.path)).toEqual(['prices[0].listing.position', 'prices[1].spec.weights[0].weight', 'prices[1].spec.mustHaves[0].tier']);
    const unranked = plan(10);
    unranked.prices[0].spec = { ...SPEC, ranking: null };
    expect(errorsOf(unranked)).toEqual([]);
  });

  it("D-481: a swap's stages are stages of the plan, its boss figures keyed by them, and its slot an item slot or a tree jewel socket", () => {
    const p = plan(10);
    p.itemSwaps = [
      { ...SWAP, stages: ['b', 'x'], bossBefore: { b: 1, z: 2 }, bossAfter: { b: 1 } },
      { ...SWAP, slot: 'Arm 1' },
      { ...SWAP, slot: 'Jewel 26725', stages: ['n'], bossBefore: { n: 1 }, bossAfter: { n: 1 } },
    ];
    const errors = errorsOf(p);
    expect(errors.map((e) => e.path)).toEqual(['itemSwaps[1].slot', 'itemSwaps[0].stages[1]', 'itemSwaps[0].bossBefore.z']);
    const noReason = plan(10);
    const { reason: _reason, ...rest } = SWAP; // eslint-disable-line @typescript-eslint/no-unused-vars
    noReason.itemSwaps = [rest];
    expect(errorsOf(noReason).map((e) => e.path)).toEqual(['itemSwaps[0].reason']);
  });

  describe('§18 (D-492): a tree jewel in an ascendancy jewel socket', () => {
    it("Crystalline Phylactery (17788) is one of the tree's jewel sockets; its neighbour 58751 isn't", () => {
      expect(TREE_JEWEL_SOCKETS).toContain(17788);
      expect(isAscendancyJewelSocket(17788)).toBe(true);
      expect(isAscendancyJewelSocket(58751)).toBe(false);
    });

    it('AC-P90: the Lich fixture, schema 10, names 17788 (in tree.ascendancyNodes) in items.treeJewels and validates', () => {
      const lich = read(LICH);
      expect(lich.stages[0].tree.ascendancyNodes).toContain(17788);
      expect(lich.stages[0].tree.nodes).not.toContain(17788);
      expect(lich.stages[0].items.treeJewels.map((j: Json) => j.node)).toEqual([17788]);
      expect(errorsOf(lich)).toEqual([]);
    });

    it('AC-P90: items.treeJewels naming an ascendancy node with no socket errs at its path', () => {
      const lich = read(LICH);
      lich.stages[0].items.treeJewels[0].node = 58751;
      const errors = errorsOf(lich);
      expect(errors.map((e) => e.path)).toEqual(['stages[0].items.treeJewels[0].node']);
      expect(errors[0].message).toMatch(/ascendancy node 58751 has no jewel socket/);
    });

    it('AC-P90: on a schema-9 plan the ascendancy socket errs at its path, naming version 10; a node in neither list errs as before', () => {
      const lich = read(LICH);
      lich.schemaVersion = 9;
      const errors = errorsOf(lich);
      expect(errors.map((e) => e.path)).toEqual(['stages[0].items.treeJewels[0].node']);
      expect(errors[0].message).toMatch(/a tree jewel in an ascendancy jewel socket \(D-492\) needs schemaVersion 10 or later/);
      const off = read(LICH);
      off.stages[0].items.treeJewels[0].node = 26725;
      expect(errorsOf(off).map((e) => e.path)).toEqual(['stages[0].items.treeJewels[0].node']);
    });
  });
});
