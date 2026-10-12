/**
 * The path tools keep the tree valid in shape (WU-66, D-360; AC-K66): engine-required, in process.
 *
 * `find_path_to_node` and `get_nearby_nodes` read the engine's allocation (no `build_name`) after
 * `lua_new_build {Ranger, Pathfinder}` and `lua_set_tree` with run A's shapes (the 2026-10-11 recorded run;
 * the node lists are its plan's, see `tests/fixtures/plans/run-a-trees/plan.json`). Neither may return a path
 * that opens a second tree on a start, crosses an unallocated start, or leaves the Sorceress start by its exits
 * (4739, 44871) without Path of the Sorceress (12795) allocated.
 *
 * Each returned path is checked against D-360's rule as stated, here over the pinned tree data read as plain
 * JSON (`shapeProblems`): with the path allocated, each main-tree component (class starts not joining their
 * exits) holds exactly one open start exit, each open start's exits lie in at most one component, and the
 * ascendancy nodes are one tree with their start. An open start is the allocated class start, or an allocated
 * ascendancy node with main-tree links (12795). A node `get_nearby_nodes` lists at distance d must have a
 * `find_path_to_node` path of d nodes, which the same check accepts.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'run-a-trees', 'plan.json');
const TREE_JSON = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'TreeData', '0_5', 'tree.json');
const ENGINE_TIMEOUT = 300_000;

type Json = Record<string, any>;
const sorted = (xs: Iterable<number>) => [...xs].sort((a, b) => a - b);
const PLAN: Json = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const stageOf = (id: string): Json => PLAN.stages.find((s: Json) => s.id === id);

/** Run A's stage 1 (plan.json, stage "1"): the 7 nodes off the Ranger start's exit 56651. */
const RUN_A_STAGE_1 = [56651, 35234, 35660, 18548, 28992, 22795, 42781];
/** Run A's stage 6 tree off the Sorceress exit 44871 (plan.json, stage "6"), which holds Arcane Mixtures. */
const ARCANE_MIXTURES = 46972;
/** Heavy Ammunition, on run A's tree off the Ranger exit 13828 (stage 2). */
const HEAVY_AMMUNITION = 11826;
const PATH_OF_THE_SORCERESS = 12795;
/** The Pathfinder path from its start to 12795 (Passive Points, Path Seeker): 1583 - 12183 - 16433 - 12795. */
const TO_12795 = [12183, 16433];

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
const isClassStart = (id: number) => nodeOf(id).classesStart !== undefined;
const isStart = (id: number) => isClassStart(id) || nodeOf(id).isAscendancyStart === true;
const isMain = (id: number) => !isStart(id) && nodeOf(id).ascendancyName === undefined;
const mainLinks = (id: number) => sorted([...(links.get(id) ?? [])].filter(isMain));
const classStart = (name: string): number =>
  Number(Object.entries<Json>(TREE.nodes).find(([, n]) => (n.classesStart ?? []).includes(name))![0]);
const RANGER_START = classStart('Ranger');
const SORCERESS_START = classStart('Sorceress');
const PATHFINDER_START = Number(
  Object.entries<Json>(TREE.nodes).find(([, n]) => n.isAscendancyStart === true && n.ascendancyName === 'Pathfinder')![0],
);

/** The components of `ids` over the links `joins` allows, each sorted. */
function components(ids: Iterable<number>, joins: (a: number, b: number) => boolean): number[][] {
  const member = new Set(ids);
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
      for (const o of links.get(cur) ?? []) if (member.has(o) && !seen.has(o) && joins(cur, o)) (seen.add(o), queue.push(o));
    }
    out.push(sorted(comp));
  }
  return out;
}

/** D-360's rule over an allocation (start nodes included, as PoB allocates them): the broken parts, or []. */
function shapeProblems(allocation: Iterable<number>): string[] {
  const alloc = new Set(allocation);
  const problems: string[] = [];
  // The open starts and their exits: the allocated class start, and each allocated ascendancy node with main-tree links.
  const exitStart = new Map<number, number>();
  for (const id of alloc) {
    if (isClassStart(id) || (nodeOf(id).ascendancyName !== undefined && !isStart(id))) {
      for (const e of mainLinks(id)) exitStart.set(e, id);
    }
  }
  const trees = components([...alloc].filter(isMain), () => true);
  const treesPerStart = new Map<number, number>();
  for (const t of trees) {
    const exits = t.filter((n) => exitStart.has(n));
    if (exits.length !== 1) problems.push(`a tree holds ${exits.length} open start exits: ${t.join(',')}`);
    for (const s of new Set(exits.map((e) => exitStart.get(e)!))) treesPerStart.set(s, (treesPerStart.get(s) ?? 0) + 1);
  }
  for (const [s, k] of treesPerStart) if (k > 1) problems.push(`start ${s} holds ${k} trees`);
  const asc = [...alloc].filter((n) => nodeOf(n).ascendancyName !== undefined);
  const ascTrees = components(asc, (a, b) => nodeOf(a).ascendancyName === nodeOf(b).ascendancyName);
  if (ascTrees.length > 1) problems.push(`the ascendancy holds ${ascTrees.length} trees`);
  return problems;
}

/** The node ids a tool text lists in brackets (`Name [id]`), in order. */
const bracketIds = (text: string): number[] => [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));

engineDescribe('WU-66: the path tools keep the tree valid in shape (D-360, AC-K66)', () => {
  let f: SessionFixture;

  /** A new Ranger/Pathfinder build holding `nodes` (main-tree and ascendancy), and its allocation as PoB holds it. */
  async function allocate(nodes: number[]): Promise<Set<number>> {
    expect((await f.call('lua_new_build', { class_name: 'Ranger', ascendancy: 'Pathfinder' })).isError).toBe(false);
    const set = await f.call('lua_set_tree', { nodes: nodes.map(String) });
    expect(set.isError).toBe(false);
    const { value } = await f.session.run({ tool: 'test:path-tools', kind: 'read' }, (ctx) => ctx.client.getTree());
    const held = new Set<number>((value.nodes ?? []).map(Number));
    // PoB keeps every node it was given (a valid shape to start from) and allocates the two starts itself.
    expect(sorted(held)).toEqual(sorted(new Set([...nodes, RANGER_START, PATHFINDER_START])));
    expect(shapeProblems(held)).toEqual([]);
    return held;
  }

  /** `find_path_to_node`'s path to `target` (its allocation order, the target last), or null when it finds none. */
  async function pathTo(target: number): Promise<number[] | null> {
    const out = await f.call('find_path_to_node', { target_node_id: String(target) });
    expect(out.isError).toBe(false);
    if (/^No path found/m.test(out.text)) return null;
    const order = out.text.split('Allocation Order:')[1];
    expect(order).toBeDefined();
    const ids = bracketIds(order);
    expect(ids[ids.length - 1]).toBe(target);
    return ids;
  }

  /** The path is one D-360 allows from `held`: it crosses no start, and the allocation it makes is valid in shape. */
  function expectValid(held: Set<number>, path: number[]): void {
    expect(path.filter(isStart)).toEqual([]);
    expect(shapeProblems([...held, ...path])).toEqual([]);
  }

  /** `get_nearby_nodes`' nodes by distance (the tool lists up to 10 per distance). */
  async function nearby(maxDistance: number): Promise<Map<number, number>> {
    const out = await f.call('get_nearby_nodes', { max_distance: maxDistance });
    expect(out.isError).toBe(false);
    const found = new Map<number, number>();
    for (const block of out.text.split(/^\*\*Distance /m).slice(1)) {
      const d = Number(/^(\d+)\*\*/.exec(block)![1]);
      for (const id of bracketIds(block)) found.set(id, d);
    }
    return found;
  }

  /** Every node `get_nearby_nodes` lists at distance d has a valid `find_path_to_node` path of d nodes. */
  async function expectNearbyValid(held: Set<number>, maxDistance: number): Promise<Map<number, number>> {
    const found = await nearby(maxDistance);
    for (const [id, d] of found) {
      const p = await pathTo(id);
      expect(p).not.toBeNull();
      expect([id, p!.length]).toEqual([id, d]);
      expectValid(held, p!);
    }
    return found;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  }, 60_000);

  it('the tree data: the Ranger start leaves by 13828 and 56651, and 12795 links the Sorceress start\'s exits 4739 and 44871', () => {
    expect(mainLinks(RANGER_START)).toEqual([13828, 56651]);
    expect(mainLinks(SORCERESS_START)).toEqual([4739, 44871]);
    expect(mainLinks(PATH_OF_THE_SORCERESS)).toEqual([4739, 44871]);
    expect(nodeOf(PATH_OF_THE_SORCERESS).name).toBe('Path of the Sorceress');
    expect([...links.get(PATHFINDER_START)!]).toContain(TO_12795[0]);
    expect([...links.get(TO_12795[1])!]).toContain(PATH_OF_THE_SORCERESS);
  });

  it(
    'AC-K66: with run A\'s stage-1 tree off 56651, neither tool opens a second tree off the Ranger start by 13828',
    async () => {
      const held = await allocate(RUN_A_STAGE_1);
      const p = await pathTo(HEAVY_AMMUNITION);
      if (p !== null) {
        expectValid(held, p);
        expect(p[0]).not.toBe(13828);
      }
      // 13828 itself: the Ranger start holds a tree, so it is not left again, and a path onto 13828 from the tree
      // would give that tree two exits.
      expect(await pathTo(13828)).toBeNull();
      const found = await expectNearbyValid(held, 4);
      expect(found.has(13828)).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K66: a start that holds no tree is left by one exit: the bare Ranger start reaches 56651, and an allocated 12795 reaches 4739, in one node',
    async () => {
      const bare = await allocate([]);
      expect(await pathTo(56651)).toEqual([56651]);
      await expectNearbyValid(bare, 3);

      const held = await allocate([...RUN_A_STAGE_1, ...TO_12795, PATH_OF_THE_SORCERESS]);
      expect(await pathTo(4739)).toEqual([4739]);
      expect(await pathTo(44871)).toEqual([44871]);
      await expectNearbyValid(held, 3);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K66: without 12795, no path leaves the Sorceress start by 4739 or 44871: neither through 12795 nor through the unallocated start',
    async () => {
      const held = await allocate([...RUN_A_STAGE_1, ...TO_12795]);
      for (const target of [4739, 44871, 31326]) {
        const p = await pathTo(target);
        if (p !== null) {
          expectValid(held, p);
          expect(p).not.toContain(PATH_OF_THE_SORCERESS);
          expect(p).not.toContain(SORCERESS_START);
        }
      }
      // 12795 itself is reached inside the ascendancy, and nothing beyond it in the main tree.
      expect(await pathTo(PATH_OF_THE_SORCERESS)).toEqual([PATH_OF_THE_SORCERESS]);
      await expectNearbyValid(held, 3);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K66: with run A\'s Sorceress tree off 4739 and 12795, no path opens a second Sorceress tree by 44871 (run A\'s Arcane Mixtures branch)',
    async () => {
      const stage5 = stageOf('5');
      const nodes = [...stage5.tree.nodes.filter((n: number) => !RUN_A_STAGE_1.includes(n)), ...stage5.tree.ascendancyNodes];
      const held = await allocate(nodes);
      expect(held.has(4739)).toBe(true);
      expect(held.has(PATH_OF_THE_SORCERESS)).toBe(true);
      for (const target of [ARCANE_MIXTURES, 44871]) {
        const p = await pathTo(target);
        if (p !== null) expectValid(held, p);
      }
      expect(await pathTo(44871)).toBeNull();
      const found = await expectNearbyValid(held, 4);
      expect(found.has(44871)).toBe(false);
    },
    ENGINE_TIMEOUT,
  );
});
