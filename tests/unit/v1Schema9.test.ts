/**
 * WU-128 (amendment 13 §4, §5, §12; AC-P86, AC-P87 and AC-P89's V1 rows over hand-made inputs): V1 on a schema-9 plan.
 * The engine rows (the trees `check_tree` computes for a socketed Split Personality, PoB's corruption) are
 * `tests/integration/compileSchema9Start.test.ts` and `compileSchema9Items.test.ts`.
 *
 * - §4 (D-463): `tree-shape` counts a Split Personality's start like any open start (one tree each), and reports
 *   `alternate-class-start` when the jewel names the class's own start, or a start an allocated ascendancy node already
 *   opens; a start the ascendancy could open but doesn't is the jewel's to open. The starts are written as `compile_check`
 *   gives them (`treeStartSchema`): Path of the Warrior (57253, Pathfinder) and Path of the Sorceress (12795) link the
 *   Warrior start's exits 3936 and 38646 and the Sorceress start's 4739 and 44871 (`TreeData/0_5/tree.json`).
 * - §5 (D-464): `empty-weapon-set` reads a `sameAs` Swap slot as filled; a slot with no text of its own is read nowhere
 *   as text.
 * - §12 (D-471): `corruption`, a `corrupt` gem on `m`, a campaign stage or a card skeleton, or a support gem; none on `b`
 *   and `n` for a skill gem.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { checkCorruption, checkTreeShape, checkV1, checkWeaponSetGroups, CORRUPTION_VARIANTS } from '../../src/plan/checks/v1';
import { loadReferenceData } from '../../src/plan/referenceData';
import { validatePlan, type Stage } from '../../src/plan/schema';
import type { StageChecks, StageTrees, TreeStart } from '../../src/engine/schemas';
import type { Finding } from '../../src/plan/record';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const judgment = (r: string) => ({ kind: 'judgment', ref: r, confidence: 'L' });

const codes = (fs: readonly Finding[], code: string) => fs.filter((f) => f.code === code);

// ---------------------------------------------------------------------------------------------------
// §4: the trees

const RANGER: TreeStart = { node: 50459, name: 'Ranger', exits: [13828, 56651] };
const PATH_OF_THE_WARRIOR = (granted: boolean): TreeStart => ({
  node: 47175,
  name: 'Warrior',
  exits: [3936, 38646],
  grantedBy: 57253,
  grantedByName: 'Path of the Warrior',
  granted,
});
const SPLIT = (node: number, name: string, exits: number[], granted = true): TreeStart => ({
  node,
  name,
  exits,
  grantedBy: 54127,
  grantedByName: 'Split Personality',
  granted,
  jewel: true,
});
const JEWEL_WARRIOR = SPLIT(47175, 'Warrior', [3936, 38646]);

const trees = (starts: TreeStart[], main: { nodes: number[]; exits: number[] }[]): StageTrees => ({ stage: 'n', starts, main });
const shape = (t: StageTrees): Finding[] => {
  const out: Finding[] = [];
  checkTreeShape(t, out);
  return out;
};

describe("§4 (D-463): tree-shape and Split Personality's start", () => {
  it("AC-P86: the jewel's start holds one tree, like any open start: a class tree and a Warrior tree pass", () => {
    expect(shape(trees([RANGER, JEWEL_WARRIOR], [{ nodes: [13828, 1], exits: [13828] }, { nodes: [3936, 46325], exits: [3936] }]))).toEqual([]);
  });

  it("AC-P86: two trees from the jewel's start give one-tree-per-start, naming the jewel's start", () => {
    const found = shape(trees([RANGER, JEWEL_WARRIOR], [{ nodes: [3936, 46325], exits: [3936] }, { nodes: [38646], exits: [38646] }]));
    expect(found.map((x) => x.data)).toEqual([
      {
        stage: 'n',
        rule: 'one-tree-per-start',
        start: 47175,
        startName: 'Warrior',
        trees: [
          { exits: [3936], nodes: [3936, 46325] },
          { exits: [38646], nodes: [38646] },
        ],
      },
    ]);
  });

  it("AC-P86: a variant naming the class's own start gives alternate-class-start, and the class start keeps its one tree", () => {
    const warrior: TreeStart = { node: 47175, name: 'Warrior', exits: [3936, 38646] };
    const found = shape(trees([warrior, JEWEL_WARRIOR], [{ nodes: [3936, 46325], exits: [3936] }]));
    expect(found.map((x) => x.data)).toEqual([
      { stage: 'n', rule: 'alternate-class-start', start: 47175, startName: 'Warrior', grantedBy: 54127, grantedByName: 'Split Personality', openedBy: null },
    ]);
    expect(found[0].message).toBe(
      'stage n: Split Personality in socket 54127 names the Warrior start (47175), which the class start already opens, so the jewel adds no start (D-463)',
    );
    // Two trees off the class start are still one-tree-per-start, named for the class start, not the jewel.
    const two = shape(trees([warrior, JEWEL_WARRIOR], [{ nodes: [3936], exits: [3936] }, { nodes: [38646], exits: [38646] }]));
    expect(two.map((x) => [x.data!.rule, x.data!.start, x.data!.grantedBy])).toEqual([
      ['alternate-class-start', 47175, 54127],
      ['one-tree-per-start', 47175, undefined],
    ]);
  });

  it('AC-P86: a variant naming a start an allocated ascendancy node already opens gives alternate-class-start, naming that node', () => {
    const found = shape(trees([RANGER, PATH_OF_THE_WARRIOR(true), JEWEL_WARRIOR], [{ nodes: [3936], exits: [3936] }]));
    expect(found.map((x) => x.data)).toEqual([
      { stage: 'n', rule: 'alternate-class-start', start: 47175, startName: 'Warrior', grantedBy: 54127, grantedByName: 'Split Personality', openedBy: 57253 },
    ]);
    expect(found[0].message).toContain('which Path of the Warrior (57253) already opens');
  });

  it("§4: a start the ascendancy could open, its node unallocated, is the jewel's to open: no finding", () => {
    expect(shape(trees([RANGER, PATH_OF_THE_WARRIOR(false), JEWEL_WARRIOR], [{ nodes: [3936], exits: [3936] }]))).toEqual([]);
  });

  it("R-63: a jewel whose socket the stage doesn't reach without its start opens nothing: a tree leaving it alone is alternate-start", () => {
    const found = shape(trees([RANGER, SPLIT(47175, 'Warrior', [3936, 38646], false)], [{ nodes: [3936], exits: [3936] }]));
    expect(found.map((x) => [x.data!.rule, x.data!.grantedBy])).toEqual([['alternate-start', 54127]]);
    expect(found[0].message).toContain('that start holds a tree only while Split Personality sits in a socket (54127) the stage reaches without that start (D-463)');
  });
});

// ---------------------------------------------------------------------------------------------------
// §5 and §12: a stage's items and gems

type Kind = 'entering-maps' | 'budget' | 'non-budget' | 'skeleton' | 'campaign';

/** A stage of the two-stage fixture's stage-2 content: `kind` decides its variant or progress. */
function rawStage(id: string, kind: Kind): Json {
  const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
  const s = p.stages[1];
  Object.assign(s, { id, loadoutName: `Stage ${id} (L14) {${id}}`, claims: [] });
  if (kind === 'campaign') s.progress = 'q.act-4-isle-of-kin-blind-beast';
  else {
    s.progress = 'endgame';
    if (kind !== 'skeleton') Object.assign(s, { variant: kind, ascendancyPoints: 0, variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') } });
  }
  return s;
}

/** The stage, validated in a schema-9 plan of its own. */
function stageOf(raw: Json): Stage {
  const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
  Object.assign(p, { schemaVersion: 9, stages: [raw], ledger: [] });
  const r = validatePlan(p, ref);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan.stages[0];
}

/** V1's inputs with `gems`, nothing else that finds anything. */
function checksWith(gems: Json[] = []): StageChecks {
  return {
    counts: { used: 0, ascendancy: 0, secondaryAscendancy: 0, sockets: 0, weaponSet1: 0, weaponSet2: 0 },
    extraPoints: 0,
    passivePointsToWeaponSetPoints: 0,
    attributes: { Str: 500, Dex: 500, Int: 500, ReqStr: 0, ReqDex: 0, ReqInt: 0 },
    requirementSources: {},
    gems,
    items: [],
    warnings: [],
    nodeNames: [],
    activeSkills: [],
    config: { input: {}, placeholder: {} },
    shownOptions: [],
    grantedSkills: [],
  } as unknown as StageChecks;
}

/** The stage-2 groups' gems as PoB's checks give them: Boneshatter (skill), Rage I and Brutality I (supports), Rolling Slam. */
const STAGE_GEMS = [
  { group: 1, index: 1, name: 'Boneshatter', level: 20, kind: 'skill', levelRequirement: 0 },
  { group: 1, index: 2, name: 'Rage I', level: 1, kind: 'support', levelRequirement: 0 },
  { group: 1, index: 3, name: 'Brutality I', level: 1, kind: 'support', levelRequirement: 0 },
  { group: 2, index: 1, name: 'Rolling Slam', level: 3, kind: 'skill', levelRequirement: 0 },
];

describe('§5 (D-464): a pinned weapon in V1', () => {
  it("AC-P87: empty-weapon-set reads a sameAs Swap slot as filled: a group on set 2 whose only set-2 slot is shared isn't one", () => {
    const raw = rawStage('n', 'non-budget');
    raw.items.slots = [
      { slot: 'Weapon 1', text: 'Rarity: Normal\nWooden Club' },
      { slot: 'Weapon 1 Swap', sameAs: 'Weapon 1' },
      ...raw.items.slots.filter((e: Json) => !e.slot.startsWith('Weapon')),
    ];
    raw.skills.groups[1].weaponSet = 2;
    const found: Finding[] = [];
    checkWeaponSetGroups(stageOf(raw), found);
    expect(found).toEqual([]);
    // Without the shared slot, the same group is on an empty set.
    raw.items.slots = raw.items.slots.filter((e: Json) => e.slot !== 'Weapon 1 Swap');
    const empty: Finding[] = [];
    checkWeaponSetGroups(stageOf(raw), empty);
    expect(codes(empty, 'empty-weapon-set').map((x) => x.data!.group)).toEqual([2]);
  });

  it('§5: V1 runs whole over a stage with a shared slot (no item text read from it)', () => {
    const raw = rawStage('n', 'non-budget');
    raw.items.slots = [
      { slot: 'Weapon 1', text: 'Rarity: Normal\nWooden Club' },
      { slot: 'Weapon 2', text: 'Rarity: Normal\nSplintered Tower Shield' },
      { slot: 'Weapon 2 Swap', sameAs: 'Weapon 2' },
    ];
    const r = checkV1({ stage: stageOf(raw), predecessor: null, checks: checksWith(STAGE_GEMS), ref, schemaVersion: 9 });
    expect(codes(r.verdict.findings, 'empty-weapon-set')).toEqual([]);
  });
});

describe('§12 (D-471): corruption', () => {
  it('Appendix A: the finishing-touch rungs, b and n', () => {
    expect([...CORRUPTION_VARIANTS]).toEqual(['budget', 'non-budget']);
  });

  const corrupted = (kind: Kind, gem: [number, number]) => {
    const raw = rawStage(kind === 'non-budget' ? 'n' : 'x', kind);
    raw.skills.groups[0].gems[0].level = 20;
    raw.skills.groups[gem[0]].gems[gem[1]].corrupt = 'plus_one_level';
    const found: Finding[] = [];
    checkCorruption(stageOf(raw), checksWith(STAGE_GEMS), found);
    return found;
  };

  it('AC-P89: a corrupted skill gem on b or n is no finding', () => {
    expect(corrupted('non-budget', [0, 0])).toEqual([]);
    expect(corrupted('budget', [1, 0])).toEqual([]);
  });

  it('AC-P89: a corrupted skill gem on m, a campaign stage or a card skeleton is corruption, at its corrupt', () => {
    for (const kind of ['entering-maps', 'campaign', 'skeleton'] as const) {
      const found = corrupted(kind, [0, 0]);
      expect({ kind, data: found.map((x) => x.data) }).toEqual({
        kind,
        data: [{ gem: 'Boneshatter', group: 1, index: 1, rule: 'rung', variant: kind === 'entering-maps' ? kind : null, path: 'skills.groups[0].gems[0].corrupt' }],
      });
    }
    expect(corrupted('entering-maps', [0, 0])[0].message).toBe(
      'Boneshatter (skill group 1 gem 1) is written with corrupt on the entering-maps rung: a corrupted gem belongs on the budget and non-budget rungs only (D-471)',
    );
  });

  it('AC-P89: a corrupted support gem is corruption on any stage, n included', () => {
    const found = corrupted('non-budget', [0, 1]);
    expect(found.map((x) => x.data)).toEqual([{ gem: 'Rage I', group: 1, index: 2, rule: 'support', path: 'skills.groups[0].gems[1].corrupt' }]);
    expect(found[0].message).toBe('Rage I (skill group 1 gem 2) is a support gem written with corrupt: only a skill gem is corrupted to +1 level (D-471)');
  });

  it('AC-P89: checkV1 runs it: the code is corruption', () => {
    const raw = rawStage('m', 'entering-maps');
    raw.skills.groups[0].gems[0].corrupt = 'plus_one_level';
    const r = checkV1({ stage: stageOf(raw), predecessor: null, checks: checksWith(STAGE_GEMS), ref, schemaVersion: 9 });
    expect(codes(r.verdict.findings, 'corruption')).toHaveLength(1);
    expect(r.verdict.pass).toBe(false);
  });
});
