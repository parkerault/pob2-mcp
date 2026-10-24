/**
 * WU-92 (amendment 9 §11, D-417, D-418; C-55): `get_node_power`, and `get_passive_upgrades` drawing its main-tree
 * candidates from the same pass, in process and engine-required. AC-P73, every bullet.
 *
 * The real server runs in process (`startSessionFixture`, test actions on for Lua queries) over private builds, state
 * and guides folders. The fixtures are the repository's own:
 * - the three-rung build: the committed `fifteen-stage` plan's endgame stages 13, 14 and 15 (a Warrior / Titan whose
 *   trees contain each other and carry weapon-set nodes) made the rungs `m`, `b` and `n`, compiled measure-only in a
 *   run folder that `guide_run {new_run}` made;
 * - the golden build (`grenadator.xml`) and `granted-supports.xml` (node 11641, "Grants Skill: Virtuous Barrier"; at the
 *   pin every passive with a "Grants Skill:" line is an ascendancy node, so its protection holds for ascendancy branches).
 * Every expected value comes from PoB itself (its own `CalcsTab:PowerBuilder`, Lua queries of the specs, the compile
 * record, `calc_with`), never from the tool's own output.
 *
 * - AC-P73 (1): for one stat the figures equal PowerBuilder's for every node listed; two stats in one request, the
 *   second stat's figures equal a one-stat call's.
 * - AC-P73 (2): the lists hold small passives and keystones, and leave out every branch holding a `keep` node, a
 *   skill-granting node or a weapon-set node.
 * - AC-P73 (3): the best swap applied to the plan and compiled: connected, no more points, V1's `tree-shape` and
 *   `tree-continuity` pass, no weapon-set or ascendancy node added; a gain past the removed branch counts its new path.
 * - AC-P73 (4): on the three rungs, `m`'s swap with `protect_for` `b` and `n`, applied to all three and compiled.
 * - AC-P73 (5): a swap over `max_loss`, one lowering movement speed, and one lowering the clear group's radius (a
 *   clear group that isn't the main skill) are not returned.
 * - AC-P73 (6): Mana regen ranks alone; an unknown stat and Offence/Defence are refused with the list.
 * - AC-P73 (7): the active loadout, the level and the revision are unchanged by a call, and by a failing one.
 * - AC-P73 (8): `get_passive_upgrades` ranks a notable none of its old keywords matches, with its DPS field.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import type { NodePowerParams, NodePowerResult, PowerSwap } from '../../src/engine/schemas';
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

/** The three-rung plan: the fifteen-stage fixture's stages 13-15 as the rungs m, b and n (D-282's ladder). */
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

/** The best swap as the tool's text gives it: the removed and added node ids, the attribute choices, the points. */
interface TextSwap {
  removed: number[];
  added: number[];
  attributes: Record<number, string>;
  used: number;
  freed: number;
  branch: number;
}

function bestSwapOf(text: string): TextSwap | null {
  const line = /^Best swap: .*$/m.exec(text)?.[0];
  if (!line || line.startsWith('Best swap: none')) return null;
  const at = (s: string) => line.indexOf(s);
  const removeText = line.slice(at(' Remove '), at('. Add '));
  const addText = line.slice(at('. Add '), at('. Searched from branch'));
  const ids = (t: string) => [...t.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const attributes: Record<number, string> = {};
  for (const m of addText.matchAll(/\[(\d+)\] \(attribute: (\w+)\)/g)) attributes[Number(m[1])] = m[2];
  const tail = /Searched from branch .*? \[(\d+)\]: its new paths use (\d+) of the (\d+) freed points?/.exec(line);
  expect(tail).not.toBeNull();
  return { removed: ids(removeText), added: ids(addText), attributes, used: Number(tail![2]), freed: Number(tail![3]), branch: Number(tail![1]) };
}

/** A stage's tree with the swap applied: the removed nodes and their choices out, the added nodes and choices in. */
function applySwap(stage: Json, swap: { removed: number[]; added: number[]; attributes: Record<number, string> }): void {
  const gone = new Set(swap.removed);
  stage.tree.nodes = [...stage.tree.nodes.filter((id: number) => !gone.has(id)), ...swap.added.filter((id) => !stage.tree.nodes.includes(id))];
  const added = new Set(Object.keys(swap.attributes).map(Number));
  stage.tree.attributeChoices = [
    ...stage.tree.attributeChoices.filter((c: Json) => !gone.has(c.node) && !added.has(c.node)),
    ...Object.entries(swap.attributes).map(([node, attribute]) => ({ node: Number(node), attribute })),
  ];
}

const findingCodes = (rec: CompileRecord, stage: string): string[] => (rec.stages[stage].v1?.findings ?? []).map((x: Json) => x.code);
const usedPoints = (rec: CompileRecord, stage: string): number | undefined =>
  (rec.stages[stage].v1?.findings ?? []).find((x: Json) => x.code === 'passive-points')?.data?.used as number | undefined;

engineDescribe('WU-92: get_node_power and get_passive_upgrades on node power (D-417, D-418; AC-P73)', () => {
  let f: SessionFixture;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:node-power-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  /** The bridge's own reply (the action the tool calls), for the raw figures; the tool's default stats. */
  async function power(params: Omit<NodePowerParams, 'stats'> & { stats?: string[] }): Promise<NodePowerResult> {
    const full: NodePowerParams = { stats: ['FullDPS', 'TotalEHP'], ...params };
    const { value } = await f.session.run({ tool: 'test:node-power', kind: 'read' }, (ctx) => ctx.client.nodePower(full));
    return value;
  }

  async function ok(tool: string, args: Record<string, unknown>): Promise<string> {
    const out = await f.call(tool, args);
    expect({ tool, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, isError: false, text: '' });
    return out.text;
  }

  /** A measure-only compile of `plan` in a new run: the record and the run's plan path. */
  async function compile(slug: string, plan: Json): Promise<{ record: CompileRecord; planPath: string; abs: string }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    await ok('compile_plan', { plan_path: planPath, measure_only: true });
    return { record: JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord, planPath, abs };
  }

  /** Recompile a run's plan after `change` (the run folder's plan file, as D1 edits it). */
  async function recompile(run: { planPath: string; abs: string }, change: (plan: Json) => void): Promise<CompileRecord> {
    const file = path.join(f.guides, run.planPath);
    const plan = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
    change(plan);
    fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
    await ok('compile_plan', { plan_path: run.planPath, measure_only: true });
    return JSON.parse(fs.readFileSync(path.join(run.abs, 'compile-record.json'), 'utf8')) as CompileRecord;
  }

  /** A loadout's spec as PoB holds it: allocated ids, weapon-set tags, depends, and the class's attribute nodes. */
  async function specFacts(loadout: string): Promise<{ alloc: number[]; tagged: number[]; ascendancy: number[]; depends: Record<string, number[]> }> {
    return lua(`
      local l = build:GetLoadoutByName(${JSON.stringify(loadout)})
      local spec = build.treeTab.specList[l.specId]
      local out = { alloc = {}, tagged = {}, ascendancy = {}, depends = {} }
      for id, n in pairs(spec.allocNodes) do
        out.alloc[#out.alloc + 1] = id
        if (n.allocMode or 0) ~= 0 then out.tagged[#out.tagged + 1] = id end
        if n.ascendancyName then out.ascendancy[#out.ascendancy + 1] = id end
        local d = {}
        for _, x in ipairs(n.depends or {}) do d[#d + 1] = x.id end
        out.depends[tostring(id)] = d
      end
      return out`);
  }

  /** The nodes PoB drops when it imports `loadout`'s tree without `remove` (PassiveSpec:ImportFromNodeList on a copy). */
  async function droppedWithout(loadout: string, remove: number[]): Promise<number[]> {
    const dropped = await lua<number[]>(`
      local l = build:GetLoadoutByName(${JSON.stringify(loadout)})
      local spec = build.treeTab.specList[l.specId]
      local gone = {}
      for _, id in ipairs({ ${remove.join(', ')} }) do gone[id] = true end
      local ids, tags = {}, {}
      for id, n in pairs(spec.allocNodes) do
        if not gone[id] then
          ids[#ids + 1] = id
          if (n.allocMode or 0) ~= 0 then tags[id] = n.allocMode end
        end
      end
      local copy = new('PassiveSpec', build, spec.treeVersion)
      copy.jewels = copyTable(spec.jewels or {})
      copy:ImportFromNodeList(nil, spec.curClassId, spec.curAscendClassId, spec.curSecondaryAscendClassId or 0, ids, tags,
        copyTable(spec.hashOverrides or {}, true), {})
      local out = {}
      for _, id in ipairs(ids) do if not copy.allocNodes[id] then out[#out + 1] = id end end
      return out`);
    return Array.isArray(dropped) ? dropped : [];
  }

  beforeAll(async () => {
    f = await startSessionFixture({
      testActions: true,
      files: {
        'grenadator.xml': fs.readFileSync(path.join(FIXTURES, 'builds', 'grenadator.xml'), 'utf8'),
        'granted-supports.xml': fs.readFileSync(path.join(FIXTURES, 'builds', 'granted-supports.xml'), 'utf8'),
      },
    });
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('on the three-rung build (fifteen-stage stages 13-15 as m, b and n)', () => {
    let ladder: { record: CompileRecord; planPath: string; abs: string };

    beforeAll(async () => {
      ladder = await compile('np-ladder', threeRungPlan());
    }, ENGINE_TIMEOUT);

    it(
      "AC-P73 (1): for one stat, every listed node's gain alone and with its path, and every listed branch's loss alone and whole, equal PoB's PowerBuilder's; two stats go in one request, and the second stat's figures equal a one-stat call's",
      async () => {
        const one = await power({ stats: ['FullDPS'], maxDistance: 3, limit: 1000 });
        expect(one.best.length).toBeGreaterThan(10);
        expect(one.weakest.length).toBeGreaterThan(10);

        // PoB's own PowerBuilder on the same state (the active loadout at its level), run for Full DPS alone.
        const pob = await lua<Record<string, { s: number | null; p: number | null }>>(`
          local stat
          for _, s in ipairs(data.powerStatList) do if s.stat == 'FullDPS' then stat = s end end
          local calcs = build.calcsTab
          local priorStat, priorDepth = calcs.powerStat, calcs.nodePowerMaxDepth
          calcs:BuildOutput()
          calcs.powerStat = stat
          calcs.nodePowerMaxDepth = 3
          calcs:PowerBuilder()
          calcs.powerStat, calcs.nodePowerMaxDepth = priorStat, priorDepth
          local out = {}
          for id, n in pairs(build.spec.nodes) do
            if n.power and n.power.singleStat then out[tostring(id)] = { s = n.power.singleStat, p = n.power.pathPower or false } end
          end
          return out`);
        const close = (a: number | null | undefined, b: number | null | undefined) =>
          typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
        for (const n of one.best) {
          const p = pob[String(n.id)];
          expect({ id: n.id, alone: close(n.alone[0], p?.s), path: close(n.withPath[0], p?.p) }).toEqual({ id: n.id, alone: true, path: true });
        }
        for (const n of one.weakest) {
          const p = pob[String(n.id)];
          // PoB's figure for an allocated node is the change when it is removed; the tool gives it as a loss.
          expect({ id: n.id, alone: close(-n.lossAlone[0]!, p?.s), branch: close(-n.loss[0]!, p?.p) }).toEqual({ id: n.id, alone: true, branch: true });
        }

        // Two stats: one node_power request through the tool, and its second stat's figures equal the one-stat call's.
        const spy = jest.spyOn(PoBLuaApiClient.prototype, 'request');
        let text: string;
        try {
          text = await ok('get_node_power', { stats: ['TotalEHP', 'FullDPS'], max_distance: 3, limit: 1000 });
          expect(spy.mock.calls.filter((c) => (c[0] as string) === 'node_power')).toHaveLength(1);
        } finally {
          spy.mockRestore();
        }
        const two = await power({ stats: ['TotalEHP', 'FullDPS'], maxDistance: 3, limit: 1000 });
        const oneBest = new Map(one.best.map((n) => [n.id, n]));
        const oneWeak = new Map(one.weakest.map((n) => [n.id, n]));
        let compared = 0;
        for (const n of two.best) {
          const o = oneBest.get(n.id);
          if (!o) continue;
          compared++;
          expect({ id: n.id, alone: n.alone[1], path: n.withPath[1] }).toEqual({ id: n.id, alone: o.alone[0], path: o.withPath[0] });
        }
        for (const n of two.weakest) {
          const o = oneWeak.get(n.id);
          if (!o) continue;
          compared++;
          expect({ id: n.id, alone: n.lossAlone[1], loss: n.loss[1] }).toEqual({ id: n.id, alone: o.lossAlone[0], loss: o.loss[0] });
        }
        expect(compared).toBeGreaterThan(20);
        // The tool's text lists the same nodes, in the bridge's order.
        const listed = [...text!.slice(text!.indexOf('## Best unallocated')).matchAll(/^\d+\. \*\*.+?\*\* \[(\d+)\]/gm)].map((m) => Number(m[1]));
        expect(listed).toEqual([...two.best.map((n) => n.id), ...two.weakest.map((n) => n.id)]);
        expect(text!).toMatch(/^Ranked by Effective Hit Pool \(TotalEHP\); also measured: Full DPS \(FullDPS\)\./m);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P73 (2): the lists hold small passives and keystones, and leave out every branch holding a keep node or a weapon-set node',
      async () => {
        const facts = await specFacts(M);
        // Keep a node deep in a long branch: a node with dependants whose own branch isn't protected otherwise.
        const tagged = new Set(facts.tagged);
        const candidates = Object.entries(facts.depends)
          .map(([id, d]) => ({ id: Number(id), d }))
          .filter((x) => x.d.length >= 3 && !x.d.some((y) => tagged.has(y)) && !facts.ascendancy.includes(x.id))
          .sort((a, b) => b.d.length - a.d.length || a.id - b.id);
        expect(candidates.length).toBeGreaterThan(0);
        const keep = candidates[0].d[candidates[0].d.length - 1];

        const r = await power({ loadout: M, stats: ['IgniteChance', 'FullDPS'], keep: [keep], limit: 1000 });
        const types = new Set([...r.best, ...r.weakest].map((n) => n.type));
        expect(types.has('Normal')).toBe(true);
        expect(types.has('Keystone')).toBe(true);
        expect(r.weakest.length).toBeGreaterThan(5);
        for (const n of r.weakest) {
          expect({ id: n.id, keep: n.branch.includes(keep) }).toEqual({ id: n.id, keep: false });
          expect({ id: n.id, tagged: n.branch.filter((id) => tagged.has(id)) }).toEqual({ id: n.id, tagged: [] });
        }
        // Every allocated node whose PoB branch holds the kept node or a weapon-set node is absent; others are present.
        const listed = new Set(r.weakest.map((n) => n.id));
        const holding = Object.entries(facts.depends).filter(([, d]) => d.includes(keep) || d.some((y) => tagged.has(y))).map(([id]) => Number(id));
        expect(holding.length).toBeGreaterThan(tagged.size);
        for (const id of holding) expect({ id, listed: listed.has(id) }).toEqual({ id, listed: false });
        expect(r.protected).toMatchObject({ keep: 1, 'weapon set': tagged.size });
      },
      ENGINE_TIMEOUT,
    );

    it(
      "D-246 at level 90 (D-417): get_passive_upgrades {focus: 'both'} on rung n keeps within 5000 chars with no truncation notice and its 10 ranked entries, every can't-measure line whole, the rest of the pool counted",
      async () => {
        const text = await ok('get_passive_upgrades', { focus: 'both' });
        expect(text.length).toBeLessThanOrEqual(5000);
        expect(text).not.toContain('[Response truncated');
        expect(Number(/^Measured (\d+) nearby passives/m.exec(text)![1])).toBeGreaterThan(1000);
        const ranked = [...text.matchAll(/^\d+\. \*\*.+?\*\* \[(\d+)\]\n {3}Path cost: /gm)].map((m) => Number(m[1]));
        expect(ranked).toHaveLength(10);
        const cant = text.slice(text.indexOf("## What PoB can't fully measure"));
        const entries = [...cant.matchAll(/^- \*\*.+?\*\* \[(\d+)\]: (.*)$/gm)].map((m) => ({ id: Number(m[1]), line: m[2] }));
        // Each listed entry is a ranked one, with every line check_model_coverage doesn't rate fully parsed, whole.
        for (const e of entries) {
          expect(ranked).toContain(e.id);
          const lines = (await ok('check_model_coverage', { nodes: [e.id] })).split('\n').filter((l) => /^\[[^\]]+\] /.test(l) && !l.startsWith('[fully parsed] '));
          expect(lines.length).toBeGreaterThan(0);
          for (const line of lines) expect(e.line).toContain(line);
        }
        expect(cant).toMatch(/^…and \d+ more passives? in reach that PoB can't fully measure \(check_model_coverage gives their lines\)/m);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "the swap search on rung n leaves out the branches weapon-set nodes hang off (PoB's depends misses them), so every branch it tries gives a legal swap and a gaining one is found",
      async () => {
        const r = await power({ loadout: N, limit: 1000 });
        expect(r.heldBranches).toBeGreaterThan(0);
        expect(r.swaps.length).toBeGreaterThan(0);
        expect(r.swaps.filter((s) => s.verdict === 'illegal').map((s) => s.branch)).toEqual([]);
        if (!r.bestSwap) expect(r.swaps.filter((s) => s.verdict !== 'illegal')).toHaveLength(5);
        expect(r.bestSwap).toBeDefined();
        expect(r.bestSwap!.gain![0]).toBeGreaterThan(0);
        // PoB's own import agrees: removing each tried branch drops nothing else; the branches the search used to waste
        // its tries on (removing them drops weapon-set nodes) are no longer listed.
        const branchOf = new Map(r.weakest.map((w) => [w.id, w.branch]));
        for (const s of r.swaps) expect({ branch: s.branch, dropped: await droppedWithout(N, branchOf.get(s.branch)!) }).toEqual({ branch: s.branch, dropped: [] });
        const facts = await specFacts(N);
        const tagged = new Set(facts.tagged);
        for (const id of [16168, 36629, 45916, 5692, 26532]) {
          const dropped = await droppedWithout(N, facts.depends[String(id)]);
          expect(dropped.length).toBeGreaterThan(0);
          expect(dropped.every((x) => tagged.has(x))).toBe(true);
          expect({ id, listed: branchOf.has(id) }).toEqual({ id, listed: false });
        }
      },
      ENGINE_TIMEOUT,
    );

    it(
      "AC-P73 (4): protect_for leaves out every branch b or n builds on: m's weakest list holds such branches without it (27373's among them), and none with it",
      async () => {
        const m = await specFacts(M);
        const inM = new Set(m.alloc);
        const builtOn = new Set<number>();
        for (const later of [B, N]) {
          const s = await specFacts(later);
          for (const id of m.alloc) if ((s.depends[String(id)] ?? []).some((d) => !inM.has(d))) builtOn.add(id);
        }
        expect(builtOn.has(27373)).toBe(true);
        const holding = (rows: Array<{ id: number; branch: number[] }>) => rows.filter((w) => w.branch.some((id) => builtOn.has(id))).map((w) => w.id);
        const without = await power({ loadout: M, limit: 1000 });
        expect(holding(without.weakest)).toContain(27373);
        const protectedFor = await power({ loadout: M, protectFor: [B, N], limit: 1000 });
        expect(holding(protectedFor.weakest)).toEqual([]);
        expect(protectedFor.protected['later rung']).toBeGreaterThan(0);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P73 (5): a swap that costs another stat more than max_loss is not returned, and is returned when max_loss allows it',
      async () => {
        // Keep everything but the Armour branch (26532, 41657, 46023): only it and its parts can be removed.
        const facts = await specFacts(M);
        const branch = facts.depends['26532'];
        expect([...branch].sort((a, b) => a - b)).toEqual([26532, 41657, 46023]);
        const keep = facts.alloc.filter((id) => !branch.includes(id));
        const strict = await power({ loadout: M, keep, limit: 0 });
        const whole = strict.swaps.find((s) => s.branch === 26532) as PowerSwap;
        expect(whole.verdict).toBe('over-loss');
        expect(whole.reason).toMatch(/^TotalEHP would fall [\d.]+%, more than 2%$/);
        const loss = -(whole.gainPercent![1] as number);
        expect(loss).toBeGreaterThan(2);
        expect(strict.bestSwap?.branch).not.toBe(26532);
        const text = await ok('get_node_power', { loadout: M, keep, limit: 0 });
        expect(bestSwapOf(text)?.branch).not.toBe(26532);

        const loose = await power({ loadout: M, keep, limit: 0, maxLoss: { TotalEHP: Math.ceil(loss) + 1 } });
        expect(loose.bestSwap?.branch).toBe(26532);
        expect(loose.bestSwap!.gain![0]).toBeGreaterThan(Math.max(0, ...strict.swaps.filter((s) => s.gain).map((s) => (s.branch === 26532 ? 0 : s.gain![0]!))));
      },
      ENGINE_TIMEOUT,
    );

    it(
      "AC-P73 (5): with a clear group that isn't the main skill, the guard reads that group's radius and uses per second (as the compile record's clear entry), and a swap lowering its radius is not returned",
      async () => {
        // m's main group is 1 (Rolling Slam); group 4 is Earthquake, a clear group with an area (clearEntryOf: its
        // first active skill and stat set, g4s1p1).
        expect(await lua<number>('return build.mainSocketGroup')).toBe(1);
        const entry = ladder.record.stages.m.skillOutputs.g4s1p1;
        expect(entry.skill).toBe('Earthquake');
        const radius = entry.fields.AreaOfEffectRadiusMetres;
        expect(radius).toBeGreaterThan(0);

        // Keep everything but the single-node branch with the most attack area: Reverberating Impact (59767, "12%
        // increased Area of Effect for Attacks"); the only swap removes it. (A 4% node moves Earthquake's radius by less
        // than the 0.1 m PoB rounds it to.)
        const facts = await specFacts(M);
        expect(facts.depends['59767']).toEqual([59767]);
        const AREA = 59767;
        const keep = facts.alloc.filter((id) => id !== AREA);
        const guarded = await power({ loadout: M, keep, clearGroup: 4, limit: 0 });
        expect(guarded.clear).toMatchObject({ group: 4, radius, usesPerSecond: entry.fields.Speed });
        const tried = guarded.swaps.find((s) => s.branch === AREA) as PowerSwap;
        expect(tried.gain![0]).toBeGreaterThan(0);
        expect(tried.clear!.radius!).toBeLessThan(radius);
        expect(tried.verdict).toBe('over-loss');
        expect(tried.reason).toMatch(/^the clear skill's radius would fall [\d.]+%, more than 0%$/);
        expect(guarded.bestSwap).toBeUndefined();
        const text = await ok('get_node_power', { loadout: M, keep, clear_group: 4, limit: 0 });
        expect(text).toMatch(/^Best swap: none: /m);

        // The same swap passes when the radius may fall, and when the clear group is the main one (no area to lose).
        const allowed = await power({ loadout: M, keep, clearGroup: 4, limit: 0, maxLoss: { clearRadius: 100 } });
        expect(allowed.bestSwap?.branch).toBe(AREA);
        const mainGroup = await power({ loadout: M, keep, limit: 0 });
        expect(mainGroup.clear.group).toBe(1);
        expect(mainGroup.bestSwap?.branch).toBe(AREA);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "AC-P73 (5): with a clear group that isn't the main skill, a swap lowering its uses per second is not returned (clearUses)",
      async () => {
        // Keep everything but node 24880, "3% increased Attack Speed": the only swap removes it, and Earthquake (group
        // 4, an attack) uses itself less often.
        const facts = await specFacts(M);
        expect(facts.depends['24880']).toEqual([24880]);
        const keep = facts.alloc.filter((id) => id !== 24880);
        const guarded = await power({ loadout: M, keep, clearGroup: 4, limit: 0 });
        const tried = guarded.swaps.find((s) => s.branch === 24880) as PowerSwap;
        expect(tried.gain![0]).toBeGreaterThan(0);
        expect(tried.clear!.radius).toBe(guarded.clear.radius);
        expect(tried.clear!.usesPerSecond!).toBeLessThan(guarded.clear.usesPerSecond!);
        expect(tried.verdict).toBe('over-loss');
        expect(tried.reason).toMatch(/^the clear skill's uses per second would fall [\d.]+%, more than 0%$/);
        expect(guarded.bestSwap).toBeUndefined();
        const allowed = await power({ loadout: M, keep, clearGroup: 4, limit: 0, maxLoss: { clearUses: 100 } });
        expect(allowed.bestSwap?.branch).toBe(24880);
      },
      ENGINE_TIMEOUT,
    );

    it('AC-P73 (6): Mana regen alone ranks; an unknown stat and Offence/Defence are refused with the list', async () => {
      const r = await power({ loadout: M, stats: ['Mana regen'], limit: 10 });
      expect(r.stats).toEqual([{ id: 'ManaRegen', label: 'Mana regen' }]);
      expect(r.best.length).toBeGreaterThan(3);
      const perPoint = r.best.map((n) => n.perPoint!);
      expect(perPoint).toEqual([...perPoint].sort((a, b) => b - a));
      for (const n of r.best) expect(n.withPath[0]! / n.distance).toBeCloseTo(n.perPoint!, 9);
      const text = await ok('get_node_power', { loadout: M, stats: ['ManaRegen'], limit: 3 });
      expect(text).toContain('## Best unallocated nodes, by path gain per point on Mana regen');

      for (const stat of ['Bogus Stat', 'Offence/Defence']) {
        const out = await f.call('get_node_power', { stats: [stat] });
        expect(out.isError).toBe(true);
        expect(out.text).toContain('FullDPS (Full DPS)');
        expect(out.text).toContain('ManaRegen (Mana regen)');
        expect(out.text).toContain('MinionLife (Minion Life)');
      }
      expect((await f.call('get_node_power', { stats: ['Bogus Stat'] })).text).toContain('unknown power stat "Bogus Stat"');
      expect((await f.call('get_node_power', { stats: ['Offence/Defence'] })).text).toContain('no path figure and no loss');
    }, ENGINE_TIMEOUT);

    it(
      'AC-P73 (7): the active loadout, the level and the revision are the same after a call on another loadout at another level, and after one that fails',
      async () => {
        const state = async () => ({
          loadouts: await ok('manage_sets', { set_type: 'loadout', action: 'list' }),
          level: await lua<number>('return build.characterLevel'),
          auto: await lua<boolean>('return build.characterLevelAutoMode'),
          revision: f.session.revision,
          xml: await canonicalExport(f.session),
        });
        const before = await state();
        expect(before.loadouts).toContain('- "Non-budget (L90) {n}" [active]');
        await ok('get_node_power', { loadout: M, level: 70, limit: 0 });
        expect(await state()).toEqual(before);
        // Fails after the loadout and level were switched (the clear group is checked against m's skill set).
        const failed = await f.call('get_node_power', { loadout: M, clear_group: 99, limit: 0 });
        expect(failed.isError).toBe(true);
        // m's six groups and PoB's two for Raise Shield, the implicit of the Runeforged Fortress Tower Shield in Weapon 2
        // and Weapon 2 Swap, which the compile now fills on the bare base (D-435; `Data/Bases/shield.lua`).
        expect(failed.text).toContain("clear group 99: the loadout's skill set has 8 socket groups");
        expect(await state()).toEqual(before);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "AC-P73 (3, 4): m's best swap with protect_for b and n, applied to all three rungs and compiled, leaves every rung connected, within its points, passing V1's tree-shape and tree-continuity, removes no node b or n builds on, and adds no weapon-set or ascendancy node",
      async () => {
        const text = await ok('get_node_power', { loadout: M, protect_for: [B, N], limit: 0 });
        expect(text).toMatch(/^=== Node power: loadout "Entering maps \(L74\) \{m\}", level 74 \(compact\) ===$/m);
        expect(text).toMatch(/^Travel: \d+ of \d+ points give nothing alone on Full DPS or Effective Hit Pool\.$/m);
        const swap = bestSwapOf(text);
        expect(swap).not.toBeNull();
        expect(swap!.removed.length).toBeGreaterThan(0);
        expect(swap!.added.length).toBeGreaterThan(0);
        expect(swap!.added.length).toBeLessThanOrEqual(swap!.removed.length);
        expect(swap!.used).toBeLessThanOrEqual(swap!.freed);

        // What b and n build on, from PoB's own specs: an m node whose dependants in b's or n's tree leave m's tree.
        const m = await specFacts(M);
        const inM = new Set(m.alloc);
        const builtOn = new Set<number>();
        for (const later of [B, N]) {
          const s = await specFacts(later);
          for (const id of m.alloc) if ((s.depends[String(id)] ?? []).some((d) => !inM.has(d))) builtOn.add(id);
        }
        expect(builtOn.size).toBeGreaterThan(0);
        for (const id of swap!.removed) expect({ id, builtOn: builtOn.has(id) }).toEqual({ id, builtOn: false });
        const mTagged = new Set(m.tagged);
        const mAsc = new Set(m.ascendancy);
        for (const id of swap!.removed) expect({ id, tagged: mTagged.has(id), asc: mAsc.has(id) }).toEqual({ id, tagged: false, asc: false });

        const before = ladder.record;
        const loadouts: Record<string, string> = { m: M, b: B, n: N };
        const tagsBefore: Record<string, number[]> = {};
        for (const rung of ['m', 'b', 'n']) tagsBefore[rung] = (await specFacts(loadouts[rung])).tagged.sort((a, b) => a - b);
        // The compile fails when PoB drops or adds a node on import (D-213), so a compile that succeeds is connected.
        const after = await recompile(ladder, (plan) => {
          for (const s of plan.stages) applySwap(s, swap!);
        });
        const plan = JSON.parse(fs.readFileSync(path.join(f.guides, ladder.planPath), 'utf8')) as Json;
        for (const rung of ['m', 'b', 'n']) {
          const codes = findingCodes(after, rung);
          expect({ rung, shape: codes.includes('tree-shape'), continuity: codes.includes('tree-continuity') }).toEqual({ rung, shape: false, continuity: false });
          // No more regular points than before (the fixture's trees already run over their level's budget).
          expect(usedPoints(after, rung)).toBeLessThanOrEqual(usedPoints(before, rung)!);
          // PoB holds every listed node; each added node is untagged and not an ascendancy node; the tags are the same.
          const s = await specFacts(loadouts[rung]);
          const alloc = new Set(s.alloc);
          const planStage = plan.stages.find((x: Json) => x.id === rung);
          for (const id of planStage.tree.nodes) expect({ rung, id, kept: alloc.has(id) }).toEqual({ rung, id, kept: true });
          // Each added node is held, and isn't an ascendancy node; in m (the rung searched) it is untagged. A later rung
          // that already held one keeps its own tag: every rung's weapon-set nodes are the same as before.
          for (const id of swap!.added) {
            expect({ rung, id, kept: alloc.has(id), asc: s.ascendancy.includes(id) }).toEqual({ rung, id, kept: true, asc: false });
            if (rung === 'm') expect({ id, tagged: s.tagged.includes(id) }).toEqual({ id, tagged: false });
          }
          expect(s.tagged.sort((a, b) => a - b)).toEqual(tagsBefore[rung]);
        }
      },
      ENGINE_TIMEOUT,
    );

    it(
      "AC-P73 (3): when the cheapest gain lies past the removed branch, the swap's points count its new path, measured after the removal",
      async () => {
        // Fleshcrafting (21164) is m's only real Energy Shield gain within 6 points. Its path from m's tree:
        const path21164 = await lua<number[]>(`
          local l = build:GetLoadoutByName(${JSON.stringify(M)})
          local spec = build.treeTab.specList[l.specId]
          local ids = {}
          local p = spec.nodes[21164].path
          for i = #p, 1, -1 do ids[#ids + 1] = p[i].id end
          return ids`);
        expect(path21164[path21164.length - 1]).toBe(21164);
        expect(path21164.length).toBeGreaterThanOrEqual(4);
        const trail = path21164.slice(0, -1);
        // A dead end off the trail (not its first node): a small passive with no Energy Shield and no attribute choice,
        // whose only link into the tree is that trail node, and which doesn't touch Fleshcrafting.
        const q = await lua<number>(`
          local l = build:GetLoadoutByName(${JSON.stringify(M)})
          local spec = build.treeTab.specList[l.specId]
          local trailIds = { ${trail.join(', ')} }
          local trail = {}
          for _, id in ipairs(trailIds) do trail[id] = true end
          local best
          for i = 2, #trailIds do
            local t = trailIds[i]
            for _, o in ipairs(spec.nodes[t].linked) do
              local sd = table.concat(o.sd or {}, ' ')
              local alone = true
              for _, x in ipairs(o.linked) do
                if x.id ~= t and (x.alloc or trail[x.id] or x.id == 21164) then alone = false end
              end
              if alone and not o.alloc and not trail[o.id] and o.id ~= 21164 and o.type == 'Normal' and not o.isAttribute
                  and not o.ascendancyName and not sd:find('Energy Shield') and o.modKey ~= '' and (not best or o.id < best) then
                best = o.id
              end
            end
          end
          return best`);
        expect(typeof q).toBe('number');
        const plan = threeRungPlan();
        plan.stages = plan.stages.filter((s: Json) => s.id === 'm');
        const added = [...trail, q];
        const attrs = await lua<number[]>(`
          local out = {}
          for _, id in ipairs({ ${added.join(', ')} }) do if build.spec.nodes[id].isAttribute then out[#out + 1] = id end end
          return out`);
        plan.stages[0].tree.nodes.push(...added);
        for (const id of Array.isArray(attrs) ? attrs : []) plan.stages[0].tree.attributeChoices.push({ node: id, attribute: 'strength' });
        const run = await compile('np-past', plan);
        const tree = plan.stages[0].tree.nodes as number[];

        // Only the trail and the dead end may go: the branch from the trail's first node is all of them.
        const keep = tree.filter((id) => !added.includes(id));
        const r = await power({ loadout: M, stats: ['EnergyShield'], keep, limit: 0 });
        const whole = r.swaps.find((s) => s.branch === trail[0]) as PowerSwap;
        expect(whole).toBeDefined();
        expect(whole.freed).toBe(added.length);
        expect(['legal']).toContain(whole.verdict);
        // Net: the dead end out, Fleshcrafting in; but its path after the branch's removal is the whole trail plus
        // the notable, so the swap's new paths take every freed point, not the 1 its path from the old tree took.
        expect(whole.removed!.map((n) => n.id)).toEqual([q]);
        expect(whole.added!.map((n) => n.id)).toEqual([21164]);
        expect(whole.used).toBe(trail.length + 1);
        expect(r.bestSwap?.added?.map((n) => n.id)).toEqual([21164]);

        // Applied and compiled: connected, no more points, the shape rule kept.
        const after = await recompile(run, (p) => applySwap(p.stages[0], { removed: [q], added: [21164], attributes: {} }));
        expect(findingCodes(after, 'm')).not.toContain('tree-shape');
        const alloc = new Set((await specFacts(M)).alloc);
        for (const id of [...keep, ...trail, 21164]) expect({ id, kept: alloc.has(id) }).toEqual({ id, kept: true });
        expect(alloc.has(q)).toBe(false);
        expect(usedPoints(after, 'm')).toBeLessThanOrEqual(usedPoints(run.record, 'm')!);
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('on the golden build', () => {
    beforeAll(async () => {
      await ok('lua_load_build', { build_name: 'grenadator.xml' });
    }, ENGINE_TIMEOUT);

    it('AC-P73 (5): a swap that lowers movement speed is not returned, and is when movement may fall', async () => {
      // The branch of 32564 ("Movement Speed and Slow Effect on You") holds the build's movement speed nodes.
      const facts = await lua<{ branch: number[]; alloc: number[]; move: string[] }>(`
        local spec = build.spec
        local out = { branch = {}, alloc = {}, move = {} }
        for _, d in ipairs(spec.nodes[32564].depends) do
          out.branch[#out.branch + 1] = d.id
          for _, line in ipairs(d.sd or {}) do if line:find('Movement Speed') then out.move[#out.move + 1] = line end end
        end
        for id in pairs(spec.allocNodes) do out.alloc[#out.alloc + 1] = id end
        return out`);
      expect(facts.move.length).toBeGreaterThan(0);
      const keep = facts.alloc.filter((id) => !facts.branch.includes(id));
      const guarded = await power({ stats: ['TotalEHP'], keep, limit: 0 });
      const tried = guarded.swaps.find((s) => s.branch === 32564) as PowerSwap;
      expect(tried.gain![0]).toBeGreaterThan(0);
      expect(tried.movement!).toBeLessThan(guarded.movement!);
      expect(tried.verdict).toBe('over-loss');
      expect(tried.reason).toMatch(/^movement speed would fall [\d.]+%, more than 0%$/);
      expect(guarded.bestSwap?.branch).not.toBe(32564);
      const allowed = await power({ stats: ['TotalEHP'], keep, limit: 0, maxLoss: { movement: 100 } });
      expect(allowed.swaps.find((s) => s.branch === 32564)?.verdict).toBe('legal');
      expect(allowed.bestSwap).toBeDefined();
    }, ENGINE_TIMEOUT);

    it(
      "AC-P73 (8): get_passive_upgrades ranks a notable whose text holds none of its old search keywords, and keeps its DPS field (CombinedDPS, else TotalDPS)",
      async () => {
        const text = await ok('get_passive_upgrades', { focus: 'dps', max_results: 40 });
        expect(text).toMatch(/^Base DPS: [\d,]+ \(CombinedDPS, else TotalDPS\)/m);
        const ranked = [...text.matchAll(/^\d+\. \*\*(.+?)\*\* \[(\d+)\]\n {3}Path cost: (\d+) points?.*\n {3}DPS Δ: ([+-]?[\d,]+)/gm)].map((m) => ({
          name: m[1],
          id: Number(m[2]),
          cost: Number(m[3]),
          dps: Number(m[4].replace(/,/g, '')),
        }));
        expect(ranked.length).toBeGreaterThan(5);
        // The old pool (WU-34): notables whose name, stat lines or mods hold "damage", "critical", "life",
        // "energy shield" or "resistance" (and "minion" for a summon), read here from PoB's own node data.
        const nodes = await lua<Record<string, { notable: boolean; text: string }>>(`
          local out = {}
          for _, id in ipairs({ ${ranked.map((r) => r.id).join(', ')} }) do
            local n = build.spec.nodes[id]
            local parts = { n.name or '' }
            for _, s in ipairs(n.sd or {}) do parts[#parts + 1] = tostring(s) end
            for _, m in ipairs(n.modList or {}) do parts[#parts + 1] = tostring(m) end
            out[tostring(id)] = { notable = n.isNotable == true, text = table.concat(parts, ' '):lower() }
          end
          return out`);
        const KEYWORDS = ['damage', 'critical', 'life', 'energy shield', 'resistance', 'minion'];
        const outside = ranked.filter((r) => nodes[String(r.id)].notable && !KEYWORDS.some((k) => nodes[String(r.id)].text.includes(k)));
        expect(outside.length).toBeGreaterThan(0);
        // Its DPS figure: CombinedDPS with its whole path, against the base, from PoB's calculator (calc_with).
        const pick = outside[0];
        const { value } = await f.session.run({ tool: 'test:calc', kind: 'read' }, async (ctx) => {
          const pathIds = await ctx.client.request('__test_eval', {
            code: `local ids = {} for _, p in ipairs(build.spec.nodes[${pick.id}].path) do ids[#ids + 1] = p.id end return ids`,
          });
          const base = await ctx.client.calcWith({ fields: ['CombinedDPS'] });
          const out = await ctx.client.calcWith({ addNodes: pathIds.result as number[], fields: ['CombinedDPS'] });
          return { base: base.CombinedDPS, out: out.CombinedDPS, cost: (pathIds.result as number[]).length };
        });
        expect(pick.cost).toBe(value.cost);
        expect(pick.dps).toBe(Math.round(value.out - value.base));
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('on granted-supports.xml (Essence of Virtue, Gemling Legionnaire node 11641, grants Virtuous Barrier)', () => {
    it('AC-P73 (2): no listed branch holds the skill-granting node', async () => {
      await ok('lua_load_build', { build_name: 'granted-supports.xml' });
      const facts = await lua<{ grants: boolean; alloc: number[]; holding: number[] }>(`
        local spec = build.spec
        local grants = false
        for _, line in ipairs(spec.nodes[11641].sd or {}) do if line:match('^Grants Skill:') then grants = true end end
        local out = { grants = grants and spec.allocNodes[11641] ~= nil, alloc = {}, holding = {} }
        for id, n in pairs(spec.allocNodes) do
          out.alloc[#out.alloc + 1] = id
          for _, d in ipairs(n.depends or {}) do if d.id == 11641 then out.holding[#out.holding + 1] = id end end
        end
        return out`);
      expect(facts.grants).toBe(true);
      expect(facts.holding.length).toBeGreaterThanOrEqual(1);
      const r = await power({ stats: ['Life'], limit: 100 });
      for (const n of r.weakest) expect({ id: n.id, holds: n.branch.includes(11641) }).toEqual({ id: n.id, holds: false });
      for (const id of facts.holding) expect(r.weakest.map((n) => n.id)).not.toContain(id);
      expect(r.protected).toMatchObject({ 'grants a skill': 1 });
      const text = await ok('get_node_power', { stats: ['Life'] });
      expect(text).toMatch(/^Protected nodes \(never removed, nor any branch holding one\): .*1 grants a skill/m);
    }, ENGINE_TIMEOUT);
  });
});

describe('D-47 (amended by D-417): node_power is a 120 s long action', () => {
  it('the bridge times node_power out at 120 s, trade_generate_query at 60 s, and every other action at the default', () => {
    const client = new PoBLuaApiClient({ env: {}, spawn: (() => undefined) as never, pobSrc: '/nonexistent', pobApiDir: '/nonexistent', pin: {} as never });
    const timeout = (action: string) => (client as unknown as { defaultTimeout(a: string): number }).defaultTimeout(action);
    expect(timeout('node_power')).toBe(120_000);
    expect(timeout('trade_generate_query')).toBe(60_000);
    expect(timeout('get_stats')).toBe(30_000);
  });
});
