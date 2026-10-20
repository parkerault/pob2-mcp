/**
 * WU-93 (amendment 9; AC-P74's unit part): plan schema 6's tree needs, V1's `missing-reason` for them and `buildSha1`
 * (D-418, D-266); the record's `requirements` (D-413, C-33); a card skeleton's reference hits (D-423); and the pure
 * parts of `guide_run {resume}` (D-415): its argument and its no-engine router rule. The engine parts are
 * `tests/integration/compileNeedsRequirements.test.ts`, and `resume` against real folders is
 * `tests/integration/guideRunResume.test.ts`.
 *
 * - D-418: `stages[].tree.needs[] {nodes, stat?, claim?}` is schema version 6, strict like the rest; a need's nodes are
 *   the stage's `tree.nodes` (a schema error otherwise); a need with no `claim`, or one naming no claim of the stage, is
 *   V1's `missing-reason`, not a schema error; only `claim` is left out of `buildSha1`.
 * - D-413: a stage's `requirements` is the highest level requirement among its items and gems, as PoB computes them
 *   (`compile_stage`'s V1 inputs), and every item or gem that sets it.
 * - D-423: a card skeleton (an endgame stage with no `variant`) gets the budget rung's reference hits, the T15 map hit.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { buildProjection, buildSha1 } from '../../src/plan/buildHash';
import { checkV1 } from '../../src/plan/checks/v1';
import { SKELETON_HIT_RUNG, referenceHitRung, referenceHits, withReferenceHits } from '../../src/plan/compiler';
import { stageRequirements } from '../../src/plan/record';
import { loadReferenceData } from '../../src/plan/referenceData';
import { PLAN_SCHEMA_VERSIONS, validatePlan, type PlanError, type Stage } from '../../src/plan/schema';
import { guideRunRequestOf } from '../../src/handlers/planHandlers';
import { engineKindFor } from '../../src/server/toolRouter';
import type { StageChecks } from '../../src/engine/schemas';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');

/** The two-stage fixture at schema 6, stage 2 keeping two needs: one with a stat and a claim, one bare. */
function plan(): Json {
  const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
  p.schemaVersion = 6;
  const two = p.stages[1];
  two.claims.push({ id: 's2-why-life', text: 'The tree keeps its life nodes for the floor.', kind: 'reason', source: { kind: 'judgment', ref: 'test', confidence: 'M' } });
  two.tree.needs = [
    { nodes: [55473, 39581], stat: 'Life', claim: 's2-why-life' },
    { nodes: [6839] },
  ];
  return p;
}

function errorsOf(input: unknown): PlanError[] {
  const r = validatePlan(input, ref);
  return r.ok ? [] : r.errors;
}

function stageOf(p: Json, index: number): Stage {
  const r = validatePlan(p, ref);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan.stages[index];
}

/** V1's inputs for a stage holding nothing beyond its plan: no warnings, no requirements. */
function checksFor(stage: Stage, over: Partial<StageChecks> = {}): StageChecks {
  return {
    counts: { used: stage.tree.nodes.length, ascendancy: 0, secondaryAscendancy: 0, sockets: 0, weaponSet1: 0, weaponSet2: 0 },
    extraPoints: 0,
    passivePointsToWeaponSetPoints: 0,
    attributes: { Str: 50, Dex: 50, Int: 50, ReqStr: 0, ReqDex: 0, ReqInt: 0 },
    requirementSources: {},
    gems: [],
    items: [],
    warnings: [],
    nodeNames: [],
    activeSkills: [],
    config: { input: {}, placeholder: {} },
    shownOptions: [],
    grantedSkills: [],
    ...over,
  } as StageChecks;
}

/** V1's `missing-reason` findings on stage 2 of `p`. */
function needFindings(p: Json) {
  const stage = stageOf(p, 1);
  const v1 = checkV1({ stage, predecessor: stageOf(p, 0), checks: checksFor(stage), ref });
  return v1.verdict.findings.filter((f) => f.code === 'missing-reason');
}

describe('D-418: plan schema 6, a tree\'s needs', () => {
  it('version 6 is the current version, and a schema-6 plan with needs validates, with or without a need\'s claim', () => {
    expect([...PLAN_SCHEMA_VERSIONS]).toEqual([1, 2, 3, 4, 5, 6]);
    const r = validatePlan(plan(), ref);
    expect(r.ok ? r.plan.stages[1].tree.needs : r.errors).toEqual([
      { nodes: [55473, 39581], stat: 'Life', claim: 's2-why-life' },
      { nodes: [6839] },
    ]);
    // A plan without needs still validates at 6, and an empty list is no need.
    const none = plan();
    delete none.stages[1].tree.needs;
    expect(errorsOf(none)).toEqual([]);
    const empty = plan();
    empty.stages[1].tree.needs = [];
    expect(errorsOf(empty)).toEqual([]);
  });

  it('a need naming a node the stage\'s tree.nodes lacks is refused, at that node', () => {
    const p = plan();
    // 900001 is in no stage; 13397 is stage 1's and stage 2's, so it is fine; stage 1 lacks 6839.
    p.stages[1].tree.needs[1].nodes = [6839, 900001];
    p.stages[0].tree.needs = [{ nodes: [13397, 6839] }];
    expect(errorsOf(p)).toEqual([
      { path: 'stages[0].tree.needs[0].nodes[1]', message: expect.stringContaining("node 6839 isn't in tree.nodes: a need keeps nodes the stage's tree allocates (D-418)") },
      { path: 'stages[1].tree.needs[1].nodes[1]', message: expect.stringContaining("node 900001 isn't in tree.nodes") },
    ]);
    // An ascendancy node isn't a need's: needs keep main-tree nodes, as node power swaps them.
    const asc = plan();
    asc.stages[1].tree.ascendancyNodes = [24226];
    asc.stages[1].tree.needs = [{ nodes: [24226] }];
    expect(errorsOf(asc).map((e) => e.path)).toEqual(['stages[1].tree.needs[0].nodes[0]']);
  });

  it('a need is strict: at least one node, a non-empty stat and claim, no other key', () => {
    const paths = (edit: (p: Json) => void) => {
      const p = plan();
      edit(p);
      return errorsOf(p).map((e) => e.path);
    };
    expect(paths((p) => (p.stages[1].tree.needs[1].nodes = []))).toEqual(['stages[1].tree.needs[1].nodes']);
    expect(paths((p) => (p.stages[1].tree.needs[0].stat = ''))).toEqual(['stages[1].tree.needs[0].stat']);
    expect(paths((p) => (p.stages[1].tree.needs[0].claim = ''))).toEqual(['stages[1].tree.needs[0].claim']);
    expect(paths((p) => (p.stages[1].tree.needs[0].reason = 'why'))).toEqual(['stages[1].tree.needs[0]']);
    expect(paths((p) => delete p.stages[1].tree.needs[0].nodes)).toEqual(['stages[1].tree.needs[0].nodes']);
    expect(paths((p) => (p.stages[1].tree.needs = { nodes: [6839] }))).toEqual(['stages[1].tree.needs']);
  });

  it('a plan of version 1 to 5 with needs is refused by the version rule, at the needs, naming version 6', () => {
    for (const version of [1, 2, 3, 4, 5]) {
      const p = plan();
      p.schemaVersion = version;
      if (version < 3) for (const s of p.stages) for (const c of s.claims) delete c.kind;
      expect(errorsOf(p)).toEqual([
        {
          path: 'stages[1].tree.needs',
          message: `a tree's needs (D-418) needs schemaVersion 6 or later; this plan declares schemaVersion ${version}, whose plans have no tree needs (D-320, D-332)`,
        },
      ]);
    }
  });
});

describe("D-418: V1's missing-reason for a need", () => {
  it('a need with no claim is a V1 finding at its claim, not a schema error; one naming a claim of the stage is none', () => {
    const p = plan();
    expect(errorsOf(p)).toEqual([]);
    expect(needFindings(p)).toEqual([
      {
        code: 'missing-reason',
        message: "tree need 2 (node 6839) has no claim: name the stage's reason claim saying why the tree keeps these nodes (D-418)",
        data: { path: 'tree.needs[1].claim', need: 2, nodes: [6839] },
      },
    ]);
    p.stages[1].tree.needs[1].claim = 's2-why-life';
    expect(needFindings(p)).toEqual([]);
  });

  it('a need naming no claim of its stage is the same finding, naming the claim, even when another stage has that claim', () => {
    const p = plan();
    p.stages[1].tree.needs[1].claim = 's1-life';
    expect(p.stages[0].claims.some((c: Json) => c.id === 's1-life')).toBe(true);
    expect(errorsOf(p)).toEqual([]);
    const findings = needFindings(p);
    expect(findings).toEqual([
      {
        code: 'missing-reason',
        message: expect.stringContaining('tree need 2 (node 6839) names claim "s1-life", which isn\'t a claim of this stage'),
        data: { path: 'tree.needs[1].claim', need: 2, nodes: [6839], claim: 's1-life' },
      },
    ]);
    // So the stage's V1 fails, as for any missing reason (D-322).
    const stage = stageOf(p, 1);
    expect(checkV1({ stage, predecessor: stageOf(p, 0), checks: checksFor(stage), ref }).verdict.pass).toBe(false);
  });
});

describe("D-266, D-418: buildSha1 leaves out only a need's claim", () => {
  const base = buildSha1(plan());
  const after = (edit: (p: Json) => void) => {
    const p = plan();
    edit(p);
    return buildSha1(p);
  };

  it("a change to a need's claim keeps buildSha1: set, changed or removed", () => {
    expect(after((p) => (p.stages[1].tree.needs[1].claim = 's2-why-life'))).toBe(base);
    expect(after((p) => (p.stages[1].tree.needs[0].claim = 's2-rage'))).toBe(base);
    expect(after((p) => delete p.stages[1].tree.needs[0].claim)).toBe(base);
    const projected = buildProjection(plan()) as Json;
    expect(projected.stages[1].tree.needs).toEqual([{ nodes: [55473, 39581], stat: 'Life' }, { nodes: [6839] }]);
  });

  it("a change to a need's nodes or stat changes it, and so does adding or removing a need", () => {
    const changes: [string, (p: Json) => void][] = [
      ['a node added', (p) => p.stages[1].tree.needs[1].nodes.push(5710)],
      ['a node removed', (p) => p.stages[1].tree.needs[0].nodes.pop()],
      ['the stat', (p) => (p.stages[1].tree.needs[0].stat = 'TotalEHP')],
      ['the stat removed', (p) => delete p.stages[1].tree.needs[0].stat],
      ['a need added', (p) => p.stages[1].tree.needs.push({ nodes: [5710] })],
      ['the needs removed', (p) => delete p.stages[1].tree.needs],
    ];
    for (const [what, edit] of changes) expect({ what, changed: after(edit) !== base }).toEqual({ what, changed: true });
  });

  it('a plan without needs hashes as before schema 6: the projection adds nothing to a tree', () => {
    const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
    const projected = buildProjection(p) as Json;
    expect(projected.stages.map((s: Json) => Object.keys(s.tree).sort())).toEqual([
      ['ascendancyNodes', 'attributeChoices', 'nodes', 'weaponSetNodes'],
      ['ascendancyNodes', 'attributeChoices', 'nodes', 'weaponSetNodes'],
    ]);
  });
});

describe("D-413: the record's requirements", () => {
  const gem = (group: number, index: number, name: string, level: number, levelRequirement: number) =>
    ({ group, index, name, level, kind: 'skill', levelRequirement }) as StageChecks['gems'][number];
  const item = (slot: string, name: string, levelRequirement: number) => ({ slot, name, baseName: name, levelRequirement }) as StageChecks['items'][number];

  it("a gem's level requirement above the items' sets the level, and only that gem is named", () => {
    const r = stageRequirements({
      items: [item('Weapon 1', 'Wooden Club', 1), item('Boots', 'Hale Rough Greaves', 16)],
      gems: [gem(1, 1, 'Wolf Pack', 20, 90), gem(1, 2, 'Brutality I', 1, 0), gem(2, 1, 'Rolling Slam', 15, 64)],
    });
    expect(r).toEqual({ level: 90, by: [{ kind: 'gem', name: 'Wolf Pack', group: 1, gemLevel: 20 }] });
  });

  it('an item above every gem sets it; a tie names every item and gem at that level, items first', () => {
    expect(stageRequirements({ items: [item('Body Armour', 'Rusted Cuirass', 70)], gems: [gem(1, 1, 'Boneshatter', 15, 64)] })).toEqual({
      level: 70,
      by: [{ kind: 'item', name: 'Rusted Cuirass', slot: 'Body Armour' }],
    });
    expect(
      stageRequirements({
        items: [item('Helmet', 'Iron Cap', 64), item('Gloves', 'Stocky Mitts', 12)],
        gems: [gem(1, 1, 'Boneshatter', 15, 64), gem(2, 1, 'Boneshatter', 15, 64)],
      }),
    ).toEqual({
      level: 64,
      by: [
        { kind: 'item', name: 'Iron Cap', slot: 'Helmet' },
        { kind: 'gem', name: 'Boneshatter', group: 1, gemLevel: 15 },
        { kind: 'gem', name: 'Boneshatter', group: 2, gemLevel: 15 },
      ],
    });
  });

  it('a stage requiring no level is level 1 with nothing named', () => {
    expect(stageRequirements({ items: [], gems: [] })).toEqual({ level: 1, by: [] });
    expect(stageRequirements({ items: [item('Weapon 1', 'Wooden Club', 0)], gems: [gem(1, 1, 'Wolf Pack', 1, 0)] })).toEqual({ level: 1, by: [] });
  });
});

describe("D-423: a card skeleton's reference hits", () => {
  const skeleton = (over: Json = {}) =>
    ({
      id: 'r1a1e',
      progress: 'endgame',
      config: { earned: [], scenario: [{ option: 'enemyIsBoss', value: 'None' }] },
      ...over,
    }) as unknown as Stage;

  it("an endgame stage with no variant gets the budget rung's hits, the T15 map hit; a rung keeps its own; a campaign stage none", () => {
    expect(SKELETON_HIT_RUNG).toBe('budget');
    expect(referenceHitRung({ progress: 'endgame' })).toBe('budget');
    expect(referenceHitRung({ progress: 'endgame', variant: 'non-budget' })).toBe('non-budget');
    expect(referenceHitRung({ progress: 'q.act-1-clearfell-beira' })).toBeUndefined();
    const filled = withReferenceHits(skeleton(), ref);
    expect(filled.config.scenario.slice(1)).toEqual(referenceHits('budget', ref));
    expect(filled.config.scenario.slice(1).map((e) => [e.option, e.value])).toEqual([
      ['enemyPhysicalDamage', 402],
      ['enemyFireDamage', 97],
      ['enemyColdDamage', 97],
      ['enemyLightningDamage', 97],
      ['enemyChaosDamage', 97],
    ]);
    const campaign = skeleton({ progress: 'q.act-1-clearfell-beira' });
    expect(withReferenceHits(campaign, ref)).toBe(campaign);
  });

  it('a hit the skeleton lists keeps its value; the others are filled', () => {
    const s = skeleton({ config: { earned: [], scenario: [{ option: 'enemyIsBoss', value: 'None' }, { option: 'enemyColdDamage', value: 5 }] } });
    expect(withReferenceHits(s, ref).config.scenario.map((e) => [e.option, e.value])).toEqual([
      ['enemyIsBoss', 'None'],
      ['enemyColdDamage', 5],
      ['enemyPhysicalDamage', 402],
      ['enemyFireDamage', 97],
      ['enemyLightningDamage', 97],
      ['enemyChaosDamage', 97],
    ]);
  });
});

describe('D-415: guide_run {resume}, its argument and its kind', () => {
  it('resume is one of the exactly-one modes, a non-empty string, without stages', () => {
    expect(guideRunRequestOf({ resume: 'open-clear/2026-10-19-1' })).toEqual({ mode: 'resume', runFolder: 'open-clear/2026-10-19-1' });
    expect(guideRunRequestOf({ resume: '/abs/Guides/open-clear/2026-10-19-1' })).toEqual({ mode: 'resume', runFolder: '/abs/Guides/open-clear/2026-10-19-1' });
    expect(() => guideRunRequestOf({ resume: '' })).toThrow(/resume must be a non-empty string/);
    expect(() => guideRunRequestOf({ resume: 3 })).toThrow(/resume must be a non-empty string/);
    expect(() => guideRunRequestOf({ resume: 'a/b', new_run: 'x' })).toThrow(/new_run and resume conflict: give exactly one of new_run, resume, validate and view/);
    expect(() => guideRunRequestOf({ resume: 'a/b', validate: 'a/b/plan.json' })).toThrow(/resume and validate conflict/);
    expect(() => guideRunRequestOf({ resume: 'a/b', stages: ['1'] })).toThrow(/stages goes only with validate, not with resume/);
    expect(() => guideRunRequestOf({})).toThrow(/resume \(a run folder, to go on with an earlier run\)/);
  });

  it('a call carrying resume is routed as kind none, as new_run is, whatever else it carries', () => {
    expect(engineKindFor('guide_run', { resume: 'a/b' })).toBe('none');
    expect(engineKindFor('guide_run', { resume: 'a/b', validate: 'a/b/plan.json' })).toBe('none');
    expect(engineKindFor('guide_run', { validate: 'a/b/plan.json' })).toBe('read');
  });
});
