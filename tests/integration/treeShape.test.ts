/**
 * V1's `tree-shape` (WU-66, D-360; AC-P65): engine-required, in process.
 *
 * The rule (I-3, in the user's words: "the build can't have two unconnected ranger start nodes or two
 * unconnected sorceress start nodes"): each tree leaves its start by one exit, each start holds at most one
 * tree, an alternate start (Path of the Sorceress, 12795) holds one only while its node is allocated, and the
 * ascendancy nodes form one tree with their start. PoB2 v0.23.1 enforces none of it.
 *
 * The shapes are run A's (the 2026-10-11 recorded run, Ranger/Pathfinder), committed as
 * `tests/fixtures/plans/run-a-trees/plan.json`: its stages 2 and 5 whole, with the ledger, prices and claims
 * emptied. Every plan here is one stage of it, compiled measure-only through `compile_plan` in a run folder
 * `guide_run {new_run}` made. Expectations come from the plan, run A's stage 1 (the tree off exit 56651) and the
 * pinned tree data read here as plain JSON, never from the check's own output.
 *
 * A Sorceress tree without 12795, and an ascendancy node cut off from 1583, can't be compiled: PoB prunes
 * nodes that reach no start (PassiveSpec.lua:1762-1786), so `check_tree`'s connectivity defect (D-213) refuses
 * the plan before any stage is built, and V1 never runs. For those two, the test asserts the refusal and runs
 * V1's `checkTreeShape` over the trees `check_tree` computed for the stage (`compile_check`'s `trees`, read
 * through the engine session), which is what `compile_plan` hands V1.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { checkStageOf } from '../../src/plan/compiler';
import { checkTreeShape } from '../../src/plan/checks/v1';
import type { StageTrees } from '../../src/engine/schemas';
import type { Stage } from '../../src/plan/schema';
import type { CompileRecord, Finding } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'run-a-trees', 'plan.json');
const TREE_JSON = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'TreeData', '0_5', 'tree.json');
const ENGINE_TIMEOUT = 300_000;

type Json = Record<string, any>;
const fixturePlan = (): Json => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const stageOf = (plan: Json, id: string): Json => plan.stages.find((s: Json) => s.id === id);
/** A plan holding only stage `id`, so no predecessor's continuity applies. */
const onlyStage = (plan: Json, stage: Json): Json => ({ ...plan, stages: [stage] });
const sorted = (xs: Iterable<number>) => [...xs].sort((a, b) => a - b);

/** Run A's stage 1 (plan.json, stage "1"): the 7 nodes off the Ranger start's exit 56651. */
const RUN_A_STAGE_1 = [56651, 35234, 35660, 18548, 28992, 22795, 42781];

// ---------------------------------------------------------------------------------------------------
// The pinned tree data, read here as plain JSON

const TREE: Json = JSON.parse(fs.readFileSync(TREE_JSON, 'utf8'));
const links = new Map<number, Set<number>>();
for (const [id, node] of Object.entries<Json>(TREE.nodes)) {
  for (const c of node.connections ?? []) {
    const [a, b] = [Number(id), Number(c.id)];
    if (!(String(b) in TREE.nodes)) continue;
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    links.get(a)!.add(b);
    links.get(b)!.add(a);
  }
}
const nodeOf = (id: number): Json => TREE.nodes[String(id)];
const isStart = (id: number) => nodeOf(id).classesStart !== undefined || nodeOf(id).isAscendancyStart === true;
const classStart = (name: string): number =>
  Number(Object.entries<Json>(TREE.nodes).find(([, n]) => (n.classesStart ?? []).includes(name))![0]);
const mainLinks = (id: number) => sorted([...links.get(id)!].filter((o) => !isStart(o) && nodeOf(o).ascendancyName === undefined));

const RANGER_START = classStart('Ranger');
const SORCERESS_START = classStart('Sorceress');
const PATH_OF_THE_SORCERESS = 12795;
const PATHFINDER_START = Number(
  Object.entries<Json>(TREE.nodes).find(([, n]) => n.isAscendancyStart === true && n.ascendancyName === 'Pathfinder')![0],
);

/** The components of `ids` over the tree's links, start nodes joining nothing; each sorted. */
function components(ids: readonly number[]): number[][] {
  const member = new Set(ids.filter((id) => !isStart(id)));
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const id of member) {
    if (seen.has(id)) continue;
    seen.add(id);
    const comp: number[] = [];
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.pop()!;
      comp.push(cur);
      for (const o of links.get(cur) ?? []) if (member.has(o) && !seen.has(o)) (seen.add(o), queue.push(o));
    }
    out.push(sorted(comp));
  }
  return out;
}

engineDescribe('WU-66: V1 tree-shape on run A\'s trees (D-360, AC-P65)', () => {
  let f: SessionFixture;
  let runs = 0;

  async function newRun(plan: Json): Promise<{ abs: string; plan: string }> {
    runs += 1;
    const out = await f.call('guide_run', { new_run: `shapes-${runs}` });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(out.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, plan: planPath };
  }

  /** A measure-only compile through the tool: its text, error flag and (when it compiled) the record. */
  async function measure(plan: Json): Promise<{ isError: boolean; text: string; record?: CompileRecord }> {
    const r = await newRun(plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, measure_only: true });
    if (out.isError) return { isError: true, text: out.text };
    const record = JSON.parse(fs.readFileSync(path.join(r.abs, 'compile-record.json'), 'utf8')) as CompileRecord;
    return { isError: false, text: out.text, record };
  }

  /** `compile_check`'s trees for one stage, through the engine session (it changes nothing). */
  async function treesOf(plan: Json, stage: Json): Promise<StageTrees> {
    const { value } = await f.session.run({ tool: 'test:tree-shape', kind: 'read' }, (ctx) =>
      ctx.client.compileCheck({ className: plan.roll.className, ascendancy: plan.roll.ascendancy, stages: [checkStageOf(stage as Stage)] }),
    );
    expect(value.trees).toHaveLength(1);
    return value.trees[0];
  }

  const v1Of = (record: CompileRecord, id: string, code: string): Finding[] =>
    (record.stages[id].v1?.findings ?? []).filter((x) => x.code === code);

  /** Stage 5 without run A's stage-1 tree: the class tree off 13828 and the Sorceress tree off 4739, with 12795. */
  function classAndSorceress(plan: Json): Json {
    const stage = structuredClone(stageOf(plan, '5'));
    stage.tree.nodes = stage.tree.nodes.filter((n: number) => !RUN_A_STAGE_1.includes(n));
    stage.tree.attributeChoices = stage.tree.attributeChoices.filter((c: Json) => !RUN_A_STAGE_1.includes(c.node));
    return stage;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  }, 60_000);

  it('the fixture holds run A\'s shapes: stage 2 has two trees off the Ranger start, stage 5 a third off the Sorceress start with 12795', () => {
    const plan = fixturePlan();
    expect(plan.roll).toMatchObject({ className: 'Ranger', ascendancy: 'Pathfinder' });
    expect(mainLinks(RANGER_START)).toEqual([13828, 56651]);
    expect(mainLinks(PATH_OF_THE_SORCERESS)).toEqual([4739, 44871]);
    expect(mainLinks(SORCERESS_START)).toEqual([4739, 44871]);
    const two = components(stageOf(plan, '2').tree.nodes);
    expect(two.map((c) => c.length).sort((a, b) => a - b)).toEqual([7, 12]);
    expect(two).toContainEqual(sorted(RUN_A_STAGE_1));
    const five = components(classAndSorceress(plan).tree.nodes);
    expect(five.map((c) => [c.includes(13828), c.includes(4739)])).toEqual(expect.arrayContaining([[true, false], [false, true]]));
    expect(five).toHaveLength(2);
    expect(stageOf(plan, '5').tree.ascendancyNodes).toContain(PATH_OF_THE_SORCERESS);
  });

  it(
    'AC-P65: two trees off one Ranger start (run A stage 2) give tree-shape naming the stage, the Ranger start and each tree\'s nodes',
    async () => {
      const plan = fixturePlan();
      const stage = stageOf(plan, '2');
      const { isError, text, record } = await measure(onlyStage(plan, stage));
      expect(isError).toBe(false);
      const other = sorted(stage.tree.nodes.filter((n: number) => !RUN_A_STAGE_1.includes(n)));
      const found = v1Of(record!, '2', 'tree-shape');
      expect(found).toHaveLength(1);
      expect(found[0].data).toEqual({
        stage: '2',
        rule: 'one-tree-per-start',
        start: RANGER_START,
        startName: 'Ranger',
        trees: expect.arrayContaining([
          { exits: [56651], nodes: sorted(RUN_A_STAGE_1) },
          { exits: [13828], nodes: other },
        ]),
      });
      expect((found[0].data as Json).trees).toHaveLength(2);
      expect(found[0].message).toContain(`stage 2: the Ranger start (${RANGER_START}) holds 2 trees`);
      for (const n of stage.tree.nodes) expect(found[0].message).toMatch(new RegExp(`\\b${n}\\b`));
      // Run A's stage 2 passed V1 otherwise; the shape alone fails it now, and the text prints the finding.
      expect(record!.stages['2'].v1!.findings.map((x) => x.code)).toEqual(['tree-shape']);
      expect(record!.stages['2'].v1!.pass).toBe(false);
      expect(text).toContain(`  - tree-shape: ${found[0].message}`);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-P65: a class tree plus a Sorceress tree with 12795 passes',
    async () => {
      const plan = fixturePlan();
      const { isError, text, record } = await measure(onlyStage(plan, classAndSorceress(plan)));
      expect(text).not.toMatch(/- tree-shape:/);
      expect(isError).toBe(false);
      expect(v1Of(record!, '5', 'tree-shape')).toEqual([]);
      expect(record!.stages['5'].v1!.pass).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-P65: a Sorceress tree without 12795 gives tree-shape (alternate-start); the compile refuses it, since PoB prunes the tree',
    async () => {
      const plan = fixturePlan();
      const stage = classAndSorceress(plan);
      stage.tree.ascendancyNodes = stage.tree.ascendancyNodes.filter((n: number) => n !== PATH_OF_THE_SORCERESS);
      const sorceressTree = components(stage.tree.nodes).find((c) => c.includes(4739))!;

      const refused = await measure(onlyStage(plan, stage));
      expect(refused.isError).toBe(true);
      expect(refused.text).toMatch(/nothing was compiled/);
      for (const n of sorceressTree) expect(refused.text).toMatch(new RegExp(`^stage 5: node ${n} \\(.*\\) is not connected to its start`, 'm'));

      const findings: Finding[] = [];
      checkTreeShape(await treesOf(plan, stage), findings);
      expect(findings.map((x) => x.data)).toEqual([
        {
          stage: '5',
          rule: 'alternate-start',
          start: SORCERESS_START,
          startName: 'Sorceress',
          grantedBy: PATH_OF_THE_SORCERESS,
          trees: [{ exits: [4739], nodes: sorceressTree }],
        },
      ]);
      expect(findings[0].message).toContain(`stage 5: a tree leaves the Sorceress start (${SORCERESS_START}) by 4739`);
      expect(findings[0].message).toContain('only while Path of the Sorceress (12795) is allocated');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-P65: an ascendancy node cut off from 1583 gives tree-shape (ascendancy); the compile refuses it, since PoB prunes the node',
    async () => {
      const plan = fixturePlan();
      const stage = classAndSorceress(plan);
      // 49503 joins Brew Concoction (57141) and Explosive Concoction (38004) to the Pathfinder start.
      expect([...links.get(49503)!]).toEqual(expect.arrayContaining([PATHFINDER_START, 57141]));
      stage.tree.ascendancyNodes = stage.tree.ascendancyNodes.filter((n: number) => n !== 49503);
      const cut = [38004, 57141];

      const refused = await measure(onlyStage(plan, stage));
      expect(refused.isError).toBe(true);
      for (const n of cut) expect(refused.text).toMatch(new RegExp(`^stage 5: node ${n} \\(.*\\) is not connected to its start`, 'm'));

      const findings: Finding[] = [];
      checkTreeShape(await treesOf(plan, stage), findings);
      const own = sorted([PATHFINDER_START, ...stage.tree.ascendancyNodes.filter((n: number) => !cut.includes(n))]);
      expect(findings.map((x) => x.data)).toEqual([
        { stage: '5', rule: 'ascendancy', start: PATHFINDER_START, startName: 'Pathfinder', trees: [{ nodes: own }, { nodes: cut }] },
      ]);
      expect(findings[0].message).toContain(`stage 5: the Pathfinder nodes form 2 trees`);
      expect(findings[0].message).toContain(`cut off: (2 nodes: 38004, 57141)`);
    },
    ENGINE_TIMEOUT,
  );
});
