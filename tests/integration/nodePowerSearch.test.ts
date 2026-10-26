/**
 * WU-110 (amendment 11 §7, D-439; C-55): node power's swap search frees several branches together, the rebuild pass,
 * `free`, and the max-hit guard, in process and engine-required. AC-P79's search bullets and its NFR.
 *
 * The real server runs in process (`startSessionFixture`, test actions on for Lua queries) over private builds, state
 * and guides folders. The fixtures are the repository's own, written from the pinned game data:
 * - the branches tree: the committed `fifteen-stage` plan's stage 13 (a Warrior / Titan, as `nodePower.test.ts` makes
 *   it the rung `m`), with the first node of the trail to Fleshcrafting (21164, the tree's only Energy Shield gain near
 *   it) allocated, and three dead ends off the tree that give nothing on Energy Shield: Arcane Surge's 20499 and 2336
 *   (2 points), the totems' 44787 and 51683 (2 points) and the Rage node 39621 (1 point). Fleshcrafting is 5 points
 *   from the tree, behind branches of 2, 2 and 1 points, none enough alone (the Throatseeker case of §7);
 * - the golden build (`grenadator.xml`), whose node 32976 ("5% increased Maximum Life if you have at least 10 Red
 *   Support Gems Socketed") holds up its lowest maximum hit taken;
 * - the three-rung build (`fifteen-stage` stages 13 to 15 as m, b and n), AC-P73's, for the NFR.
 * Every expected value comes from PoB itself (its own depends and paths, Lua queries of the specs, `calc_with`, the
 * compile record of the tree with the move applied), never from the tool's own output.
 *
 * - AC-P79 (1): the swap search frees the three branches together and finds the 5-point path; `bestSwap.branches`
 *   lists them.
 * - AC-P79 (2): `rebuild: true` returns the fixture's expected removed and added nodes, judged as one swap.
 * - AC-P79 (3): `free: [ids]` frees exactly those nodes and what disconnects, and reports the refill's gain.
 * - AC-P79 (4): a swap that lowers the lowest per-type maximum hit by more than 2% is refused; with
 *   `max_loss: {maxHit: 10}` it passes.
 * - AC-P79 (NFR): a swap call and a rebuild call on the AC-P73 fixture each finish under 90 seconds.
 * - The fix round's jewel sockets: a jewel socket that holds a jewel (rung m's treeJewels) is never removed, by the
 *   swap search, the rebuild or `free`, so a returned tree still compiles.
 */
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { NodePowerParams, NodePowerResult } from '../../src/engine/schemas';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const ENGINE_TIMEOUT = 600_000;

type Json = Record<string, any>;

/** The rungs made from the fifteen-stage fixture's endgame stages: stage id → [rung, variant, loadout name]. */
const RUNGS: Record<string, [string, string, string]> = {
  '13': ['m', 'entering-maps', 'Entering maps (L74) {m}'],
  '14': ['b', 'budget', 'Budget (L82) {b}'],
  '15': ['n', 'non-budget', 'Non-budget (L90) {n}'],
};
const M = RUNGS['13'][2];
const B = RUNGS['14'][2];
const N = RUNGS['15'][2];

/** The three-rung plan: the fifteen-stage fixture's stages 13-15 as the rungs m, b and n (as nodePower.test.ts). */
function threeRungPlan(): Json {
  const p = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'plans', 'fifteen-stage', 'plan.json'), 'utf8')) as Json;
  p.schemaVersion = 5;
  p.ledger = [];
  const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });
  p.stages = p.stages
    .filter((s: Json) => RUNGS[s.id])
    .map((s: Json) => {
      const [id, variant, loadoutName] = RUNGS[s.id];
      return {
        ...s,
        id,
        variant,
        loadoutName,
        ascendancyPoints: 8,
        variantBasis: { level: judgment('test: the fixture level'), gemLevels: judgment('test: the fixture gems'), ascendancyPoints: judgment('test: 8') },
        skills: { ...s.skills, rolledGroup: 1 },
        claims: [],
      };
    });
  return p;
}

/** Fleshcrafting, and the first node of the trail to it, allocated in the branches tree. */
const FLESHCRAFTING = 21164;
const TRAIL_START = 28982;
/** The three dead ends: Arcane Surge's (2 points), the totems' (2 points) and the Rage node (1 point). */
const BRANCHES: Array<{ id: number; nodes: number[] }> = [
  { id: 20499, nodes: [20499, 2336] },
  { id: 44787, nodes: [44787, 51683] },
  { id: 39621, nodes: [39621] },
];
const BRANCH_NODES = BRANCHES.flatMap((b) => b.nodes);

/** The branches tree: rung m with the trail's first node (an attribute node, Strength) and the three dead ends. */
function branchesPlan(): Json {
  const plan = threeRungPlan();
  plan.stages = plan.stages.filter((s: Json) => s.id === 'm');
  const tree = plan.stages[0].tree;
  tree.nodes.push(TRAIL_START, ...BRANCH_NODES);
  tree.attributeChoices.push({ node: TRAIL_START, attribute: 'strength' });
  return plan;
}

const close = (a: unknown, b: unknown, rel = 1e-9) =>
  typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
const ids = (nodes: Array<{ id: number }> | undefined) => (nodes ?? []).map((n) => n.id).sort((a, b) => a - b);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

engineDescribe('WU-110: get_node_power frees several branches, rebuilds, frees named nodes and guards the max hit (D-439; AC-P79)', () => {
  let f: SessionFixture;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:node-power-search-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  /** The bridge's own reply (the action the tool calls), for the raw figures. */
  async function power(params: Omit<NodePowerParams, 'stats'> & { stats?: string[] }): Promise<NodePowerResult> {
    const full: NodePowerParams = { stats: ['FullDPS', 'TotalEHP'], ...params };
    const { value } = await f.session.run({ tool: 'test:node-power-search', kind: 'read' }, (ctx) => ctx.client.nodePower(full));
    return value;
  }

  async function ok(tool: string, args: Record<string, unknown>): Promise<string> {
    const out = await f.call(tool, args);
    expect({ tool, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, isError: false, text: '' });
    return out.text;
  }

  /** A measure-only compile of `plan` in a new run: the record and the run's paths. */
  async function compile(slug: string, plan: Json): Promise<{ record: CompileRecord; planPath: string; abs: string }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    await ok('compile_plan', { plan_path: planPath, measure_only: true });
    return { record: JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord, planPath, abs };
  }

  /** A loadout's allocated node ids and PoB's depends of each (node.depends: the nodes its removal disconnects). */
  async function specFacts(loadout: string): Promise<{ alloc: number[]; depends: Record<string, number[]> }> {
    return lua(`
      local l = build:GetLoadoutByName(${JSON.stringify(loadout)})
      local spec = build.treeTab.specList[l.specId]
      local out = { alloc = {}, depends = {} }
      for id, n in pairs(spec.allocNodes) do
        out.alloc[#out.alloc + 1] = id
        local d = {}
        for _, x in ipairs(n.depends or {}) do d[#d + 1] = x.id end
        out.depends[tostring(id)] = d
      end
      return out`);
  }

  /**
   * PoB's own path to `target` (allocation order, the target last) once `loadout`'s tree is imported without `remove`
   * (PassiveSpec:ImportFromNodeList on a copy, which recomputes every path).
   */
  async function pathWithout(loadout: string, remove: number[], target: number): Promise<number[]> {
    return lua(`
      local l = build:GetLoadoutByName(${JSON.stringify(loadout)})
      local spec = build.treeTab.specList[l.specId]
      local gone = {}
      for _, id in ipairs({ ${remove.join(', ')} }) do gone[id] = true end
      local keep, tags = {}, {}
      for id, n in pairs(spec.allocNodes) do
        if not gone[id] then
          keep[#keep + 1] = id
          if (n.allocMode or 0) ~= 0 then tags[id] = n.allocMode end
        end
      end
      local copy = new('PassiveSpec', build, spec.treeVersion)
      copy.jewels = copyTable(spec.jewels or {})
      copy:ImportFromNodeList(nil, spec.curClassId, spec.curAscendClassId, spec.curSecondaryAscendClassId or 0, keep, tags,
        copyTable(spec.hashOverrides or {}, true), {})
      local out = {}
      local p = copy.nodes[${target}].path or {}
      for i = #p, 1, -1 do out[#out + 1] = p[i].id end
      return out`);
  }

  /** A stage's tree with a move applied: the removed nodes and their choices out, the added nodes and choices in. */
  function applyMove(stage: Json, move: { removed: number[]; added: number[]; attributes: Record<number, string> }): void {
    const gone = new Set(move.removed);
    stage.tree.nodes = [...stage.tree.nodes.filter((id: number) => !gone.has(id)), ...move.added.filter((id) => !stage.tree.nodes.includes(id))];
    const added = new Set(Object.keys(move.attributes).map(Number));
    stage.tree.attributeChoices = [
      ...stage.tree.attributeChoices.filter((c: Json) => !gone.has(c.node) && !added.has(c.node)),
      ...Object.entries(move.attributes).map(([node, attribute]) => ({ node: Number(node), attribute })),
    ];
  }

  const moveOf = (s: NonNullable<NodePowerResult['bestSwap']>) => ({
    removed: ids(s.removed),
    added: ids(s.added),
    attributes: Object.fromEntries((s.added ?? []).filter((n) => n.attributeChoice).map((n) => [n.id, n.attributeChoice!])),
  });

  beforeAll(async () => {
    f = await startSessionFixture({
      testActions: true,
      files: { 'grenadator.xml': fs.readFileSync(path.join(FIXTURES, 'builds', 'grenadator.xml'), 'utf8') },
    });
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('on the branches tree (rung m with three dead ends of 2, 2 and 1 points before a 5-point path)', () => {
    let fixture: { record: CompileRecord; planPath: string; abs: string };
    let keep: number[];
    let trail: number[];

    /** PoB's figures for the branches tree with `move` applied, compiled in a run of its own; then the fixture again. */
    async function compiledWith(slug: string, move: ReturnType<typeof moveOf>): Promise<Record<string, number>> {
      const plan = branchesPlan();
      applyMove(plan.stages[0], move);
      const moved = await compile(slug, plan);
      await ok('compile_plan', { plan_path: fixture.planPath, measure_only: true });
      return moved.record.stages.m.outputs;
    }

    beforeAll(async () => {
      fixture = await compile('np-branches', branchesPlan());
      const facts = await specFacts(M);
      keep = facts.alloc.filter((id) => !BRANCH_NODES.includes(id));
      trail = await pathWithout(M, BRANCH_NODES, FLESHCRAFTING);
    }, ENGINE_TIMEOUT);

    it('the fixture: PoB holds each dead end as a branch of its own, and Fleshcrafting is 5 points away once they go', async () => {
      const facts = await specFacts(M);
      for (const b of BRANCHES) expect({ branch: b.id, depends: sorted(facts.depends[String(b.id)]) }).toEqual({ branch: b.id, depends: sorted(b.nodes) });
      expect(facts.alloc).toContain(TRAIL_START);
      expect(trail).toHaveLength(5);
      expect(trail[trail.length - 1]).toBe(FLESHCRAFTING);
      for (const id of trail) expect(BRANCH_NODES).not.toContain(id);
    }, ENGINE_TIMEOUT);

    it(
      'AC-P79 (1): the swap search frees the 2-, 2- and 1-point branches together for the 5-point path no branch or pair reaches, and bestSwap.branches lists the three',
      async () => {
        const r = await power({ loadout: M, stats: ['EnergyShield'], keep, limit: 0 });
        expect(r.mode).toBe('swap');
        const best = r.bestSwap!;
        expect(best).toBeDefined();
        expect(best.branches.map((b) => ({ id: b.id, points: b.points }))).toEqual(BRANCHES.map((b) => ({ id: b.id, points: b.nodes.length })));
        expect(best.freed).toBe(5);
        expect(ids(best.removed)).toEqual(sorted(BRANCH_NODES));
        expect(ids(best.added)).toEqual(sorted(trail));
        expect(best.gain![0]).toBeGreaterThan(0);
        // None enough alone: no branch, and no pair, frees the points the path needs, so none of them adds a node.
        const tried = r.swaps.map((s) => ({ branches: s.branches.map((b) => b.id), freed: s.freed, verdict: s.verdict }));
        for (const t of tried.filter((x) => x.freed < 5)) expect(t).toEqual({ ...t, verdict: 'no-candidate' });
        expect(tried.filter((x) => x.branches.length === 1).length).toBeGreaterThanOrEqual(3);
        expect(tried.some((x) => x.branches.length === 2)).toBe(true);
        expect(r.swaps.length).toBeLessThanOrEqual(40);

        // The tool's line names the three branches, freed together.
        const text = await ok('get_node_power', { loadout: M, stats: ['EnergyShield'], keep, limit: 0 });
        const line = /^Best swap: .*$/m.exec(text)![0];
        expect(line).toMatch(/ Searched from branches .*\[20499\] \(2 points\), .*\[44787\] \(2 points\) and .*\[39621\] \(1 point\), freed together: their new paths use 5 of the 5 freed points, counted after the branches are removed\.$/);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "AC-P79 (2): rebuild frees every node outside keep and refills it, returning the fixture's expected removed and added nodes, judged as one swap: its gain is PoB's for the rebuilt tree",
      async () => {
        const r = await power({ loadout: M, stats: ['EnergyShield'], keep, limit: 0, rebuild: true });
        expect(r.mode).toBe('rebuild');
        expect(r.swaps).toHaveLength(1);
        expect(r.poolSwaps).toEqual([]);
        const s = r.bestSwap!;
        expect(s).toBeDefined();
        expect(s.verdict).toBe('legal');
        expect(s.branches).toEqual([]);
        expect(s.freed).toBe(BRANCH_NODES.length);
        expect(ids(s.removed)).toEqual(sorted(BRANCH_NODES));
        expect(ids(s.added)).toEqual(sorted(trail));

        const text = await ok('get_node_power', { loadout: M, stats: ['EnergyShield'], keep, limit: 0, rebuild: true });
        expect(text).toMatch(/^Rebuild: ([+-][\d.]+%|n\/a) Energy Shield \(\+[\d,.]+\)\. Remove 5 points: .*\. Add 5 points: .*\. /m);
        expect(text).toMatch(/Freed every node outside keep, the protected nodes and their paths to the start: 5 points; the refill uses 5 of them\.$/m);
        expect(text).not.toMatch(/^Best swap/m);

        // Judged as one swap: PoB's own figure for the rebuilt tree, compiled.
        const after = await compiledWith('np-rebuilt', moveOf(s));
        expect({ gain: close(s.gain![0], after.EnergyShield - fixture.record.stages.m.outputs.EnergyShield, 1e-6) }).toEqual({ gain: true });
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P79 (3): free frees exactly the named node and the node its removal disconnects, refills the points from other nodes, and reports the gain, which is PoB\'s for the tree with the move applied',
      async () => {
        const r = await power({ loadout: M, stats: ['FullDPS'], free: [20499], limit: 0 });
        expect(r.mode).toBe('free');
        expect(r.freeNodes!.map((n) => n.id)).toEqual([20499]);
        expect(r.swaps).toHaveLength(1);
        const s = r.swaps[0];
        // PoB's depends of 20499: itself and 2336, which hangs off it.
        expect(s.freed).toBe(2);
        expect(ids(s.removed)).toEqual([2336, 20499]);
        expect(ids(s.added)).not.toContain(20499);
        expect(s.added!.length).toBeGreaterThan(0);
        expect(s.used).toBeLessThanOrEqual(2);
        expect(s.gain![0]).toBeGreaterThan(0);

        const text = await ok('get_node_power', { loadout: M, stats: ['FullDPS'], free: [20499], limit: 0 });
        const line = /^Free: .*$/m.exec(text)![0];
        expect(line).toContain(`+${(s.gainPercent![0] as number).toFixed(2)}% Full DPS`);
        expect(line).toMatch(/Freed .*\[20499\] and what their removal disconnects: 2 points; the refill uses \d of them\.$/);

        // A node the loadout doesn't hold is refused, naming it.
        const refused = await f.call('get_node_power', { loadout: M, free: [FLESHCRAFTING], limit: 0 });
        expect(refused.isError).toBe(true);
        expect(refused.text).toContain(`[${FLESHCRAFTING}] isn't allocated in this loadout`);

        // The gain is PoB's own for the tree with the move applied, compiled.
        const after = await compiledWith('np-freed', moveOf(s));
        expect({ gain: close(s.gain![0], after.FullDPS - fixture.record.stages.m.outputs.FullDPS, 1e-6) }).toEqual({ gain: true });
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('on the three-rung build (AC-P73\'s fixture)', () => {
    beforeAll(async () => {
      await compile('np-nfr', threeRungPlan());
    }, ENGINE_TIMEOUT);

    it(
      "AC-P79 (NFR): a swap call and a rebuild call on rung m with protect_for b and n each finish under 90 seconds",
      async () => {
        const time = async (args: Record<string, unknown>) => {
          const t0 = performance.now();
          const text = await ok('get_node_power', args);
          return { seconds: (performance.now() - t0) / 1000, text };
        };
        const swap = await time({ loadout: M, protect_for: [B, N], limit: 0 });
        const rebuild = await time({ loadout: M, protect_for: [B, N], limit: 0, rebuild: true });
        console.error(`[WU-110 NFR] swap call ${swap.seconds.toFixed(2)} s, rebuild call ${rebuild.seconds.toFixed(2)} s (baseline swap median 12.66 s)`);
        expect(swap.text).toMatch(/^Best swap: /m);
        // The rebuild refills: with only protect_for's nodes and the protected ones kept, it moves points either way.
        expect(rebuild.text).toMatch(/^Rebuild: .*Remove [1-9]\d* points: .*\. Add [1-9]\d* points: /m);
        expect(swap.seconds).toBeLessThan(90);
        expect(rebuild.seconds).toBeLessThan(90);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "a jewel socket holding a jewel is protected: no branch the swap search lists holds one, the rebuild keeps them and its tree compiles, and free refuses one and a node whose removal disconnects one",
      async () => {
        // Rung m's socketed sockets, as the plan's treeJewels name them and PoB holds them (spec.jewels).
        const m = threeRungPlan().stages.find((st: Json) => st.id === 'm');
        const sockets = sorted((m.items.treeJewels as Json[]).map((j) => j.node as number));
        expect(sockets.length).toBeGreaterThan(0);
        const held = await lua<number[]>(`
          local l = build:GetLoadoutByName(${JSON.stringify(M)})
          local spec = build.treeTab.specList[l.specId]
          local out = {}
          for id, item in pairs(spec.jewels or {}) do if item ~= 0 and spec.allocNodes[id] then out[#out + 1] = id end end
          return out`);
        expect(sorted(held)).toEqual(sockets);

        const listed = await power({ loadout: M, limit: 1000 });
        for (const w of listed.weakest) expect({ id: w.id, sockets: w.branch.filter((id) => sockets.includes(id)) }).toEqual({ id: w.id, sockets: [] });
        for (const t of listed.swaps) expect({ branches: t.branches.map((b) => b.id), sockets: ids(t.removed).filter((id) => sockets.includes(id)) }).toEqual({ branches: t.branches.map((b) => b.id), sockets: [] });
        expect(listed.protected['holds a jewel']).toBe(sockets.length);

        // free refuses a socketed socket, and a node whose removal disconnects one (the untagged main-tree node with the
        // fewest dependants that include a socket, by PoB's depends), naming it.
        const parent = await lua<number>(`
          local l = build:GetLoadoutByName(${JSON.stringify(M)})
          local spec = build.treeTab.specList[l.specId]
          local sockets = {}
          for _, id in ipairs({ ${sockets.join(', ')} }) do sockets[id] = true end
          local best, size
          for id, n in pairs(spec.allocNodes) do
            if not sockets[id] and not n.ascendancyName and n.type ~= 'ClassStart' and n.type ~= 'AscendClassStart' and (n.allocMode or 0) == 0 then
              local holds = false
              for _, d in ipairs(n.depends or {}) do if sockets[d.id] then holds = true end end
              local k = #(n.depends or {})
              if holds and (not best or k < size or (k == size and id < best)) then best, size = id, k end
            end
          end
          return best`);
        expect(typeof parent).toBe('number');
        const named = await f.call('get_node_power', { loadout: M, free: [sockets[0]], limit: 0 });
        expect(named.isError).toBe(true);
        expect(named.text).toContain(`[${sockets[0]}] holds a jewel in this loadout`);
        const cut = await f.call('get_node_power', { loadout: M, free: [parent], limit: 0 });
        expect(cut.isError).toBe(true);
        expect(cut.text).toMatch(/free: removing them disconnects .* \[\d+\], which holds a jewel in this loadout/);

        // The rebuild with nothing kept frees most of the tree, never a socketed socket or the path to one, and refills
        // it: with every guard loose, a legal move that removes and adds nodes. (The sockets and the 20 weapon-set nodes
        // are kept, and the core that joins them to the start is one tree, as the tree is.)
        const r = await power({ loadout: M, limit: 0, rebuild: true, maxLoss: { TotalEHP: 100, maxHit: 100, movement: 100, clearRadius: 100, clearUses: 100 } });
        const s = r.swaps[0];
        expect({ verdict: s.verdict, reason: s.reason }).toEqual({ verdict: 'legal', reason: undefined });
        expect(r.bestSwap).toBeDefined();
        expect(s.freed).toBeGreaterThan(20);
        expect(s.removed!.length).toBeGreaterThan(0);
        expect(s.added!.length).toBeGreaterThan(0);
        expect(s.gain![0]).toBeGreaterThan(0);
        expect(ids(s.removed).filter((id) => sockets.includes(id))).toEqual([]);
        // Applied to the plan, the rebuilt tree compiles, and PoB holds every socket with its jewel.
        const plan = threeRungPlan();
        plan.stages = plan.stages.filter((st: Json) => st.id === 'm');
        const jewelsBefore = JSON.stringify(plan.stages[0].items.treeJewels);
        applyMove(plan.stages[0], moveOf(s));
        for (const id of sockets) expect(plan.stages[0].tree.nodes).toContain(id);
        expect(JSON.stringify(plan.stages[0].items.treeJewels)).toBe(jewelsBefore);
        const rebuilt = await compile('np-jewels-rebuilt', plan);
        expect(rebuilt.record.stages.m).toBeDefined();
        const after = await lua<number[]>(`
          local l = build:GetLoadoutByName(${JSON.stringify(M)})
          local spec = build.treeTab.specList[l.specId]
          local out = {}
          for id, item in pairs(spec.jewels or {}) do if item ~= 0 and spec.allocNodes[id] then out[#out + 1] = id end end
          return out`);
        expect(sorted(after)).toEqual(sockets);
        const tree = await specFacts(M);
        for (const id of [...ids(s.added)]) expect({ id, held: tree.alloc.includes(id) }).toEqual({ id, held: true });
        for (const id of ids(s.removed)) expect({ id, held: tree.alloc.includes(id) }).toEqual({ id, held: false });
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('on the golden build', () => {
    beforeAll(async () => {
      await ok('lua_load_build', { build_name: 'grenadator.xml' });
    }, ENGINE_TIMEOUT);

    it(
      'AC-P79 (4): a swap that lowers the lowest per-type maximum hit taken by more than 2% is refused, and passes with max_loss {maxHit: 10}',
      async () => {
        // Keep everything but node 32976: the only swap removes it.
        const facts = await lua<{ alloc: number[]; depends: number[] }>(`
          local spec = build.spec
          local out = { alloc = {}, depends = {} }
          for id in pairs(spec.allocNodes) do out.alloc[#out.alloc + 1] = id end
          for _, d in ipairs(spec.nodes[32976].depends or {}) do out.depends[#out.depends + 1] = d.id end
          return out`);
        expect(facts.depends).toEqual([32976]);
        const keep = facts.alloc.filter((id) => id !== 32976);
        const lowest = (o: Record<string, number>) =>
          Math.min(...['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'].map((t) => o[`${t}MaximumHitTaken`]));
        const fields = ['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'].map((t) => `${t}MaximumHitTaken`);

        // The node's line also moves movement speed, which this test lets fall, so the max-hit guard alone decides.
        const guarded = await power({ stats: ['FullDPS'], keep, limit: 0, maxDistance: 2, maxLoss: { movement: 100 } });
        const tried = guarded.swaps.find((s) => s.branches.length === 1 && s.branches[0].id === 32976)!;
        expect(tried).toBeDefined();
        expect(tried.gain![0]).toBeGreaterThan(0);
        // The base and the swap's figure are PoB's own: its lowest per-type maximum hit, before and with the swap.
        const { value: pob } = await f.session.run({ tool: 'test:max-hit', kind: 'read' }, async (ctx) => ({
          base: await ctx.client.calcWith({ fields }),
          swapped: await ctx.client.calcWith({ removeNodes: ids(tried.removed), addNodes: ids(tried.added), fields }),
        }));
        expect(guarded.maxHit).toBe(lowest(pob.base));
        expect(tried.maxHit).toBe(lowest(pob.swapped));
        const drop = ((guarded.maxHit! - tried.maxHit!) / guarded.maxHit!) * 100;
        expect(drop).toBeGreaterThan(2);
        expect(drop).toBeLessThan(10);
        expect(tried.verdict).toBe('over-loss');
        expect(tried.reason).toMatch(/^the lowest maximum hit taken would fall [\d.]+%, more than 2%$/);
        expect(guarded.bestSwap).toBeUndefined();
        // The none line names the limits in force: the call's movement 100%, the default maxHit 2%.
        const none = /^Best swap: none: .*$/m.exec(await ok('get_node_power', { stats: ['FullDPS'], keep, limit: 0, max_distance: 2, max_loss: { movement: 100 } }))![0];
        expect(none).toMatch(/\(movement speed 100%; the clear skill's radius 0% and uses per second 0%; the lowest maximum hit taken 2%\)\.$/);

        const allowed = await power({ stats: ['FullDPS'], keep, limit: 0, maxDistance: 2, maxLoss: { movement: 100, maxHit: 10 } });
        expect(allowed.bestSwap?.branches.map((b) => b.id)).toEqual([32976]);
        expect(allowed.bestSwap?.verdict).toBe('legal');
        const text = await ok('get_node_power', { stats: ['FullDPS'], keep, limit: 0, max_distance: 2, max_loss: { movement: 100, maxHit: 10 } });
        expect(text).toMatch(/^Best swap: \+[\d.]+% Full DPS .* Searched from branch .*\[32976\]: /m);
      },
      ENGINE_TIMEOUT,
    );
  });
});
