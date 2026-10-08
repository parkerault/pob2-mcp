/**
 * The compiler's pure parts (WU-41), as unit tests.
 *
 * - AC-P47 (unit part, D-213): `compareAllocation` reports every node PoB dropped, added or tagged with
 *   another weapon set, naming the node and the stage; an equal allocation gives none. The class and
 *   ascendancy start nodes, which PoB allocates itself, are ignored.
 * - A-P2 (§3.6 step 4): `groupSets` shares a set between stages whose content is deep-equal, titled
 *   `<base> {<ids>}`; the highest-level stage (the last among ties, A-P9) is the saved one.
 * - The text: plan errors name the stage after a `stages[n]` path; the compile modes refuse every other
 *   argument combination (C-41, C-50).
 * - The record (C-33): `versionNotes` names every version the engine doesn't run; `unresolvedRefs` lists the
 *   `pob-computed` tags that name no record field.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { compareAllocation, groupSets, loadoutBase, renderPlanErrors, savedStage, type StageAllocation } from '../../src/plan/compiler';
import { validatePlan, type Stage } from '../../src/plan/schema';
import { compileRequestOf, guideRunRequestOf } from '../../src/handlers/planHandlers';
import { unresolvedRefs, versionNotes } from '../../src/plan/record';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'two-stage', 'plan.json');

function fixtureStages(): Stage[] {
  const v = validatePlan(fs.readFileSync(FIXTURE, 'utf8'));
  if (!v.ok) throw new Error(JSON.stringify(v.errors));
  return v.plan.stages;
}

/** A stage with these nodes, tags and ascendancy nodes (the rest of the stage doesn't matter here). */
function stageWith(tree: { nodes: number[]; set1?: number[]; set2?: number[]; asc?: number[] }): Pick<Stage, 'id' | 'tree'> {
  return {
    id: '2',
    tree: {
      nodes: tree.nodes,
      ascendancyNodes: tree.asc ?? [],
      weaponSetNodes: { set1: tree.set1 ?? [], set2: tree.set2 ?? [] },
      attributeChoices: [],
    },
  };
}

const START = 47175;
const ASC_START = 32534;
const alloc = (nodes: Array<[number, number]>): StageAllocation => ({
  nodes: [[START, 0] as [number, number], [ASC_START, 0] as [number, number], ...nodes].map(([id, mode]) => ({ id, mode })),
  startNodes: [START, ASC_START],
});

describe('AC-P47 (D-213): compareAllocation', () => {
  const stage = stageWith({ nodes: [10, 11, 12, 13], set1: [12], set2: [13], asc: [90] });
  const equal: Array<[number, number]> = [[10, 0], [11, 0], [12, 1], [13, 2], [90, 0]];

  it('AC-P47: an equal allocation (start nodes aside) gives no defect', () => {
    expect(compareAllocation(stage, alloc(equal))).toEqual([]);
  });

  it('AC-P47: a plan node PoB dropped is a defect naming the node and the stage', () => {
    expect(compareAllocation(stage, alloc(equal.filter(([id]) => id !== 11)))).toEqual([
      'stage 2: node 11 was dropped by PoB on import (it isn\'t allocated); the plan allocates it untagged',
    ]);
  });

  it('AC-P47: a node PoB added is a defect naming the node and the stage', () => {
    expect(compareAllocation(stage, alloc([...equal, [14, 0]]))).toEqual(['stage 2: node 14 was allocated by PoB but isn\'t in the plan']);
  });

  it('AC-P47: a node PoB tags 2 where the plan tags it 1 is a defect naming the node and the stage', () => {
    const retagged = equal.map(([id, mode]): [number, number] => (id === 12 ? [12, 2] : [id, mode]));
    expect(compareAllocation(stage, alloc(retagged))).toEqual(['stage 2: node 12 is weapon set 2 in PoB, but the plan tags it weapon set 1']);
  });

  it('AC-P47: several differences are each reported, in node order', () => {
    const many: Array<[number, number]> = [[10, 1], [12, 1], [13, 2], [90, 0], [5, 0]];
    expect(compareAllocation(stage, alloc(many))).toEqual([
      'stage 2: node 10 is weapon set 1 in PoB, but the plan tags it untagged',
      'stage 2: node 11 was dropped by PoB on import (it isn\'t allocated); the plan allocates it untagged',
      'stage 2: node 5 was allocated by PoB but isn\'t in the plan',
    ]);
  });
});

describe('A-P2 (§3.6 step 4): groupSets and the saved stage', () => {
  it('A-P2: the fixture\'s deep-equal items share one set titled by setTitle; its different skills and configs get one set each', () => {
    const stages = fixtureStages();
    const g = groupSets(stages);
    expect(g.item.groups).toEqual([{ kind: 'item', title: 'Act 1 gear {1,2}', stageIds: ['1', '2'] }]);
    expect(g.skill.groups).toEqual([
      { kind: 'skill', title: 'Act 1 Clearfell (L5) {1}', stageIds: ['1'] },
      { kind: 'skill', title: 'Act 1 Ogham Manor (L14) {2}', stageIds: ['2'] },
    ]);
    expect(g.config.groups.map((x) => x.stageIds)).toEqual([['1'], ['2']]);
    expect(g.item.groupOf.get('2')).toBe(0);
  });

  it('A-P2: equality ignores key order; without setTitle the base is the first member\'s loadout name without its {id}', () => {
    const [one, two] = fixtureStages();
    const three: Stage = { ...two, id: '3', loadoutName: 'Act 2 (L20) {3}', skills: JSON.parse(JSON.stringify(one.skills)) };
    // The same skills content with its keys in another order.
    three.skills = Object.fromEntries(Object.entries(three.skills).reverse()) as Stage['skills'];
    const g = groupSets([one, two, three]);
    expect(g.skill.groups.map((x) => x.title)).toEqual(['Act 1 Clearfell (L5) {1,3}', 'Act 1 Ogham Manor (L14) {2}']);
    expect(loadoutBase(one)).toBe('Act 1 Clearfell (L5)');
  });

  it('A-P9: the saved stage is the highest-level one, the last among ties', () => {
    expect(savedStage([{ id: 'a', level: 5 }, { id: 'b', level: 14 }, { id: 'c', level: 14 }, { id: 'd', level: 3 }]).id).toBe('c');
  });
});

describe('C-41, C-50: argument combinations and error lines', () => {
  it('C-41: compile_plan takes measure-only or final, and refuses every other combination', () => {
    expect(compileRequestOf({ plan_path: 'a/b/plan.json', measure_only: true })).toEqual({ mode: 'measure-only', planPath: 'a/b/plan.json' });
    expect(compileRequestOf({ plan_path: 'a/b/plan.json', measure_only: true, stages: ['2'] })).toEqual({
      mode: 'measure-only',
      planPath: 'a/b/plan.json',
      stages: ['2'],
    });
    expect(compileRequestOf({ plan_path: 'a/b/plan.json', build_name: 'x' })).toEqual({ mode: 'final', planPath: 'a/b/plan.json', buildName: 'x' });
    expect(compileRequestOf({ plan_path: 'a/b/plan.json', build_name: 'x', measure_only: false })).toEqual({
      mode: 'final',
      planPath: 'a/b/plan.json',
      buildName: 'x',
    });
    const refused: Array<[Record<string, unknown>, RegExp]> = [
      [{ plan_path: 'p', measure_only: true, build_name: 'x' }, /build_name and measure_only: true conflict/],
      [{ plan_path: 'p', build_name: 'x', stages: ['1'] }, /build_name and stages conflict/],
      [{ plan_path: 'p' }, /give build_name for a final compile, or measure_only: true/],
      [{ plan_path: 'p', stages: ['1'] }, /give build_name/],
      [{ plan_path: 'p', measure_only: true, new_run: 'x' }, /new_run: run folders are created by guide_run/],
      [{ plan_path: 'p', measure_only: true, validate_only: true }, /validate_only: plans are validated by guide_run/],
      [{ measure_only: true }, /plan_path must be a non-empty string/],
      [{ plan_path: 'p', measure_only: 'yes' }, /measure_only must be true or false/],
    ];
    for (const [args, re] of refused) expect(() => compileRequestOf(args)).toThrow(re);
  });

  it('C-50: guide_run takes exactly one of new_run and validate; stages only with validate', () => {
    expect(guideRunRequestOf({ new_run: 'titan' })).toEqual({ mode: 'new_run', slug: 'titan' });
    expect(guideRunRequestOf({ validate: 'a/b/plan.json', stages: ['1'] })).toEqual({ mode: 'validate', planPath: 'a/b/plan.json', stages: ['1'] });
    expect(() => guideRunRequestOf({ new_run: 'a', validate: 'b' })).toThrow(/new_run and validate conflict/);
    expect(() => guideRunRequestOf({})).toThrow(/give new_run/);
    expect(() => guideRunRequestOf({ new_run: 'a', stages: ['1'] })).toThrow(/stages goes only with validate/);
    expect(() => guideRunRequestOf({ validate: 'a', build_name: 'x' })).toThrow(/has no argument "build_name"/);
  });

  it('D-163: a stages[n] error path is followed by the stage id', () => {
    const raw = { stages: [{ id: 'a' }, { id: 'b' }, {}] };
    expect(
      renderPlanErrors(
        [
          { path: 'stages[1].level', message: 'too small' },
          { path: 'stages[2].id', message: 'Required' },
          { path: 'ledger', message: 'Required' },
        ],
        raw,
      ),
    ).toEqual(['stages[1].level (stage b): too small', 'stages[2].id: Required', 'ledger: Required']);
  });
});

describe('C-33: the record\'s version notes and unresolved refs', () => {
  it('C-33: versionNotes names each of pobTag, pobCommit and treeVersion that differs from the running engine', () => {
    const versions = { pobTag: 'v0.23.1', pobCommit: 'abc', treeVersion: '0_5', enginePatch: '0.5.4', externalPatch: '0.5.5' };
    expect(versionNotes(versions, { pobTag: 'v0.23.1', pobCommit: 'abc', treeVersion: '0_5' })).toEqual([]);
    expect(versionNotes(versions, { pobTag: 'v0.24.0', pobCommit: 'def', treeVersion: '0_5' })).toEqual([
      'versions.pobTag is "v0.23.1", but the engine runs "v0.24.0"',
      'versions.pobCommit is "abc", but the engine runs "def"',
    ]);
  });

  it('C-33: a pob-computed tag naming no output of a compiled stage, or a stage not compiled, is unresolved; others are not', () => {
    const v = validatePlan(fs.readFileSync(FIXTURE, 'utf8'));
    if (!v.ok) throw new Error('fixture');
    const plan = v.plan;
    plan.stages[0].claims.push(
      { id: 'x1', text: 'x', source: { kind: 'pob-computed', ref: '1.NoSuchOutput' } },
      { id: 'x2', text: 'x', source: { kind: 'pob-computed', ref: '2.Life' } },
      { id: 'x3', text: 'x', source: { kind: 'pob-computed', ref: '1.g1s1p1.TotalDPS' } },
      { id: 'x4', text: 'x', source: { kind: 'pob-computed', ref: '1.g9s1p1.TotalDPS' } },
    );
    plan.ledger[0].inputs.push({ name: 'life', value: 1, tag: { kind: 'pob-computed', ref: '1.Mana' } });
    const stages = { '1': { outputs: { Life: 155 }, skillOutputs: { g1s1p1: { fields: { TotalDPS: 10 } } } } };
    expect(unresolvedRefs(plan, stages)).toEqual([
      { where: 'stages[0].claims[5].source', ref: '1.NoSuchOutput' },
      { where: 'stages[0].claims[6].source', ref: '2.Life' },
      { where: 'stages[0].claims[8].source', ref: '1.g9s1p1.TotalDPS' },
      { where: 'ledger[0].inputs[1].tag', ref: '1.Mana' },
    ]);
  });
});
