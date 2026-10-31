/**
 * WU-127 (amendment 13 §8, D-467; C-55): node power judged on toughness targets, with the repair, the pace exchange,
 * `pool_groups` on the boss config and `free` on a pool node, on the Titan Rake run's r2-s-2 plan, in process and
 * engine-required. AC-K76's r2-s-2 bullets.
 *
 * The fixture is `tests/fixtures/plans/titan-rake/r2-s-2/plan.json`, the Titan Rake live run's bleed-and-poison build
 * (the user's grant, HG-6 at approval: copied unchanged, its sha1 checked in `nodePowerTitanRakeS1.test.ts`), compiled
 * measure-only in a run folder `guide_run {new_run}` made, its rung `n` loaded. Every expected value comes from PoB itself
 * (the compile record of the plan, and of the plan with the move applied, compiled again), never from the tool's own
 * figures; each tool call's reply is the bridge's own (a spy on `PoBLuaApiClient.prototype.nodePower`).
 *
 * - AC-K76 (1): `rebuild` at reach 12 with `targets` (the compiled `n`'s TotalEHP and lowest max hit), `pace_exchange: 3`,
 *   `keep` the plan's needs less its attribute needs, `stats: ["MainDamage", "TotalEHP"]`: a legal rebuild gaining at least
 *   +41% Main damage, its TotalEHP and lowest max hit at or above the targets, within the 120 s long action; its line has
 *   Appendix A's `(target …)` form; the rebuilt tree, compiled, gives PoB's own figures to the same effect.
 * - AC-K76 (2): with the EHP target 10× the compiled figure, the line reads `misses its targets after repair` and no move is
 *   legal.
 * - AC-K76 (3): `free: [43778]` with `pace_exchange: 3` adds Crushing Verdict and reads legal; with `max_loss:
 *   {clearUses: 2}` and no `pace_exchange` it reads over the clear-uses guard.
 * - AC-K76 (6): `pool_groups {"2": <Shield Wall's group>}` names the group and ranks the set-2 pool by its figure on the boss
 *   config; without it the line reads as before; the pool move's gain agrees with the change in that group's boss figure
 *   between measure-only compiles before and after the move (R-64).
 * - AC-K76 (7): `free` on Cranial Impact's set-1 need nodes [44406, 63451] returns a gain, measured within set 1's pool.
 *
 * The gains, the repair steps and the times are printed (`[WU-127 …]`) for the work-log (AC-K76).
 */
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import type { NodePowerResult, PowerSwap } from '../../src/engine/schemas';

const REPO = path.resolve(__dirname, '..', '..');
const PLAN = path.join(REPO, 'tests', 'fixtures', 'plans', 'titan-rake', 'r2-s-2', 'plan.json');
const ENGINE_TIMEOUT = 900_000;
/** The long action's limit (D-47, D-417): node power's request times out past it. */
const LONG_ACTION_SECONDS = 120;

type Json = Record<string, any>;

const readPlan = (): Json => JSON.parse(fs.readFileSync(PLAN, 'utf8')) as Json;
const stageOf = (plan: Json, id: string): Json => plan.stages.find((s: Json) => s.id === id);
const ATTRIBUTE_STATS = new Set(['Str', 'Dex', 'Int']);
/** A rung's needs less its attribute needs (D-467: the attribute guard keeps the requirements), and the dropped ones. */
function needsOf(stage: Json): { keep: number[]; dropped: Array<{ claim: string; nodes: number[] }> } {
  const needs = stage.tree.needs as Array<{ nodes: number[]; stat?: string; claim: string }>;
  return {
    keep: needs.filter((n) => !ATTRIBUTE_STATS.has(n.stat ?? '')).flatMap((n) => n.nodes),
    dropped: needs.filter((n) => ATTRIBUTE_STATS.has(n.stat ?? '')).map((n) => ({ claim: n.claim, nodes: n.nodes })),
  };
}

/** A stage's tree with a move applied: its removed nodes out (of the tree, the sets and the needs), its added nodes in. */
function applyMove(stage: Json, s: PowerSwap, pool?: 1 | 2): void {
  const gone = new Set((s.removed ?? []).map((n) => n.id));
  const added = (s.added ?? []).map((n) => n.id);
  const tree = stage.tree;
  tree.nodes = [...tree.nodes.filter((id: number) => !gone.has(id)), ...added.filter((id) => !tree.nodes.includes(id))];
  for (const key of ['set1', 'set2']) tree.weaponSetNodes[key] = tree.weaponSetNodes[key].filter((id: number) => !gone.has(id));
  if (pool) tree.weaponSetNodes[`set${pool}`].push(...added);
  const choices = new Map<number, string>();
  for (const n of s.added ?? []) if (n.attributeChoice) choices.set(n.id, n.attributeChoice);
  tree.attributeChoices = [
    ...tree.attributeChoices.filter((c: Json) => !gone.has(c.node) && !choices.has(c.node)),
    ...[...choices].map(([node, attribute]) => ({ node, attribute })),
  ];
  tree.needs = tree.needs
    .map((n: Json) => ({ ...n, nodes: n.nodes.filter((id: number) => !gone.has(id)) }))
    .filter((n: Json) => n.nodes.length > 0);
}

/** A line of the tool's text by its head. */
const lineOf = (text: string, head: RegExp): string => {
  const line = text.split('\n').find((l) => head.test(l));
  expect({ head: String(head), found: line !== undefined }).toEqual({ head: String(head), found: true });
  return line!;
};
const num = (s: string) => Number(s.replace(/,/g, ''));
const pct = (after: number, before: number) => ((after - before) / Math.abs(before)) * 100;

engineDescribe('WU-127: node power on the Titan Rake r2-s-2 plan: targets with repair, the pace exchange, pool groups, free on a pool node (D-467; AC-K76)', () => {
  let f: SessionFixture;
  let rec: Json;
  let targets: { ehp: number; maxHit: number };
  let loadout: string;

  /** A measure-only compile of `plan` (its `stages`, by default all) in a run of its own: the record. */
  async function compile(slug: string, plan: Json, stages?: string[]): Promise<Json> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true, ...(stages ? { stages } : {}) });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    return JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as Json;
  }

  /** One get_node_power call through the tool: its text, the bridge's reply behind it and its wall time. */
  async function nodePower(args: Record<string, unknown>): Promise<{ text: string; reply: NodePowerResult; seconds: number }> {
    const spy = jest.spyOn(PoBLuaApiClient.prototype, 'nodePower');
    try {
      const t0 = performance.now();
      const out = await f.call('get_node_power', { loadout, ...args });
      const seconds = (performance.now() - t0) / 1000;
      expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
      expect(spy).toHaveBeenCalledTimes(1);
      const reply = await (spy.mock.results[0].value as Promise<NodePowerResult>);
      return { text: out.text, reply, seconds };
    } finally {
      spy.mockRestore();
    }
  }

  /** PoB's own figures on a compiled `n`: its map damage figure, TotalEHP and lowest max hit. */
  const figures = (r: Json) => {
    const n = r.stages.n;
    return { damage: n.measures.damage.map as number, ehp: n.outputs.TotalEHP as number, maxHit: n.measures.toughness.lowestMaxHit.value as number };
  };

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    rec = await compile('tr-s2', readPlan());
    const n = rec.stages.n;
    targets = { ehp: n.outputs.TotalEHP, maxHit: n.measures.toughness.lowestMaxHit.value };
    loadout = stageOf(readPlan(), 'n').loadoutName;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  let rebuild: { text: string; reply: NodePowerResult; seconds: number };
  let pooled: { text: string; reply: NodePowerResult; seconds: number };

  describe('the rebuild with repair (AC-K76 (1), (2))', () => {
    it(
      'AC-K76 (1): rebuild at reach 12 with the targets gains at least +41% Main damage, legal, at or above both targets, within 120 s, in the (target …) form',
      async () => {
        const { keep, dropped } = needsOf(stageOf(readPlan(), 'n'));
        rebuild = await nodePower({ rebuild: true, max_distance: 12, targets, pace_exchange: 3, keep, stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        const r = rebuild.reply;
        const s = r.bestSwap!;
        expect(r.mode).toBe('rebuild');
        expect({ verdict: r.swaps[0].verdict, reason: r.swaps[0].reason }).toEqual({ verdict: 'legal', reason: undefined });
        expect(r.targets).toEqual(targets);
        expect(s.gainPercent![0]).toBeGreaterThanOrEqual(41);
        expect(s.ehp!).toBeGreaterThanOrEqual(targets.ehp);
        expect(s.maxHit!).toBeGreaterThanOrEqual(targets.maxHit);
        expect(rebuild.seconds).toBeLessThan(LONG_ACTION_SECONDS);
        const line = lineOf(rebuild.text, /^Rebuild: /);
        const m = /^Rebuild: \+([\d.]+)% Main damage \(\+[\d,]+\); EHP ([\d,]+) \(target ([\d,]+)\), lowest max hit ([\d,]+) (\w+) \(target ([\d,]+)\)(; repaired: .*?)?\. Remove /.exec(line);
        expect({ line, form: m !== null }).toEqual({ line, form: true });
        expect(num(m![1])).toBeCloseTo(s.gainPercent![0] as number, 2);
        expect([num(m![3]), num(m![6])]).toEqual([Math.round(targets.ehp), Math.round(targets.maxHit)]);
        // The reply names each repair step's points.
        for (const step of s.repair ?? []) expect(line).toContain(`freed ${step.freed.length} point${step.freed.length === 1 ? '' : 's'} (${step.freed.map((x) => `${x.name} [${x.id}]`).join(', ')})`);
        console.error(
          `[WU-127 AC-K76 r2-s-2] rebuild with repair: +${(s.gainPercent![0] as number).toFixed(2)}% Main damage in ${rebuild.seconds.toFixed(1)} s ` +
            `(${r.cpuSeconds.toFixed(1)} s CPU, ${r.calculations} calculations); EHP ${s.ehp} (target ${targets.ehp}), lowest max hit ${s.maxHit} ${s.maxHitType} ` +
            `(target ${targets.maxHit}); repair steps: ${JSON.stringify((s.repair ?? []).map((st) => ({ freed: st.freed.map((x) => x.id), added: st.added.map((x) => x.id) })))}; ` +
            `dropped attribute needs: ${JSON.stringify(dropped)}`,
        );
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K76 (2): with the EHP target 10× the compiled figure, the rebuild line reads "misses its targets after repair" and no move is legal',
      async () => {
        const { keep } = needsOf(stageOf(readPlan(), 'n'));
        const far = { ehp: targets.ehp * 10, maxHit: targets.maxHit };
        const out = await nodePower({ rebuild: true, max_distance: 12, targets: far, pace_exchange: 3, keep, stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        expect(out.reply.bestSwap).toBeUndefined();
        expect(out.reply.swaps.map((s) => s.verdict)).toEqual(['misses-targets']);
        const t = out.reply.swaps[0];
        expect(t.ehp!).toBeLessThan(far.ehp);
        const line = lineOf(out.text, /^Rebuild: /);
        expect(line).toMatch(/^Rebuild: misses its targets after repair: EHP [\d,]+ of [\d,]+, lowest max hit [\d,]+ of [\d,]+[;.]/);
        expect(line).toContain(`of ${Math.round(far.ehp).toLocaleString('en-US')}`);
        expect(out.seconds).toBeLessThan(LONG_ACTION_SECONDS);
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('free, the pace exchange and a pool node (AC-K76 (3), (7))', () => {
    it(
      'AC-K76 (3): free [43778] with pace_exchange 3 adds Crushing Verdict and reads legal; with max_loss {clearUses: 2} and no pace_exchange it reads over the clear-uses guard',
      async () => {
        const traded = await nodePower({ free: [43778], pace_exchange: 3, stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        const s = traded.reply.swaps[0];
        expect({ verdict: s.verdict, reason: s.reason }).toEqual({ verdict: 'legal', reason: undefined });
        expect((s.added ?? []).map((n) => n.name)).toContain('Crushing Verdict');
        // The move slows the clear skill (Crushing Verdict's reduced attack speed), within the exchange: G ≥ 3 × L.
        const base = traded.reply.clear.usesPerSecond!;
        const loss = ((base - s.clear!.usesPerSecond!) / base) * 100;
        expect(loss).toBeGreaterThan(2);
        expect(s.gainPercent![0] as number).toBeGreaterThanOrEqual(3 * loss);
        expect(lineOf(traded.text, /^Free: /)).toMatch(/^Free: \+[\d.]+% Main damage .*Crushing Verdict \[18505\]/);

        const guarded = await nodePower({ free: [43778], max_loss: { clearUses: 2 }, stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        const g = guarded.reply.swaps[0];
        expect(g.verdict).toBe('over-loss');
        const fell = /^the clear skill's uses per second would fall ([\d.]+)%, more than 2%$/.exec(g.reason ?? '');
        expect({ reason: g.reason, form: fell !== null }).toEqual({ reason: g.reason, form: true });
        expect(Math.abs(Number(fell![1]) - loss)).toBeLessThan(0.006);
        expect(lineOf(guarded.text, /^Free: /)).toMatch(/^Free: none: over-loss: the clear skill's uses per second would fall [\d.]+%, more than 2%\./);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "AC-K76 (7): free on Cranial Impact's set-1 need nodes [44406, 63451] returns a gain, the move measured within weapon set 1's pool",
      async () => {
        const out = await nodePower({ free: [44406, 63451], stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        const r = out.reply;
        expect(r.freePool).toBe(1);
        const s = r.swaps[0];
        expect(s.gain).toBeDefined();
        expect(typeof s.gain![0]).toBe('number');
        expect(['legal', 'no-gain', 'over-loss']).toContain(s.verdict);
        // Within the pool: what it removes and adds is tagged to set 1 in the plan's terms (the removed nodes are its set-1 nodes).
        const set1 = new Set(stageOf(readPlan(), 'n').tree.weaponSetNodes.set1 as number[]);
        for (const n of s.removed ?? []) expect({ id: n.id, set1: set1.has(n.id) }).toEqual({ id: n.id, set1: true });
        const line = lineOf(out.text, /^Free \(weapon set 1\): /);
        expect(line).toMatch(/^Free \(weapon set 1\): (\+|-|none: )/);
        expect(line).not.toMatch(/not measured/);
      },
      ENGINE_TIMEOUT,
    );
  });

  describe("pool_groups: the set-2 pool ranked by Shield Wall's figure on the boss config (AC-K76 (6), R-64)", () => {
    /** Shield Wall's group on set 2, the boss rotation's largest entry there. */
    const SHIELD_WALL = 4;
    /** The rung's needs but the set-2 pool's, so the pool has branches to move. */
    const keepBut2 = () => {
      const n = stageOf(readPlan(), 'n');
      const set2 = new Set(n.tree.weaponSetNodes.set2 as number[]);
      return needsOf(n).keep.filter((id) => !set2.has(id));
    };

    it(
      'with pool_groups {"2": 4} the set-2 line names the group and ranks by its figure; without it the line reads as before',
      async () => {
        const n = stageOf(readPlan(), 'n');
        expect(n.skills.groups[SHIELD_WALL - 1].label).toMatch(/^Shield Wall/);
        expect(n.skills.groups[SHIELD_WALL - 1].weaponSet).toBe(2);
        const plain = await nodePower({ keep: keepBut2(), stats: ['MainDamage', 'TotalEHP'], limit: 0, max_distance: 6 });
        expect(lineOf(plain.text, /^Best swap \(weapon set 2/)).toMatch(/^Best swap \(weapon set 2\): /);
        const plainPool = plain.reply.poolSwaps!.find((p) => p.set === 2)!;
        expect(plainPool.group).toBeUndefined();

        pooled = await nodePower({ keep: keepBut2(), stats: ['MainDamage', 'TotalEHP'], limit: 0, max_distance: 6, pool_groups: { '2': SHIELD_WALL } });
        const pool = pooled.reply.poolSwaps!.find((p) => p.set === 2)!;
        expect(pool.group).toEqual({ group: SHIELD_WALL, label: n.skills.groups[SHIELD_WALL - 1].label });
        const line = lineOf(pooled.text, /^Best swap \(weapon set 2/);
        expect(line).toMatch(new RegExp(`^Best swap \\(weapon set 2, ranked by group ${SHIELD_WALL}, Shield Wall.*, against a Pinnacle boss\\): \\+[\\d.]+% Boss damage \\(group ${SHIELD_WALL}\\)`));
        // Its figure is the group's boss figure (the compile's boss measure, the same Count): hits and ailments of group 4.
        const bg = rec.stages.n.measures.bossGroups.find((g: Json) => g.group === SHIELD_WALL);
        const count = n.skills.groups[SHIELD_WALL - 1].count ?? 1;
        const ailments = bg.ignite + bg.bleed + bg.poison;
        const pobCount = (bg.figure - ailments) / count + ailments;
        expect(Math.abs(pool.base[0]! - pobCount) / pobCount).toBeLessThan(1e-6);
        expect(pool.bestSwap).toBeDefined();
        // The other set keeps today's ranking (set 1 holds the main group).
        expect(lineOf(pooled.text, /^Best swap \(weapon set 1/)).toMatch(/^Best swap \(weapon set 1\): /);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "R-64: the pool move's gain agrees with the change in group 4's boss figure between measure-only compiles before and after it",
      async () => {
        const pool = pooled.reply.poolSwaps!.find((p) => p.set === 2)!;
        const s = pool.bestSwap!;
        const plan = readPlan();
        applyMove(stageOf(plan, 'n'), s, 2);
        const after = await compile('tr-s2-pool', plan, ['n']);
        const b0 = rec.stages.n.measures.bossGroups.find((g: Json) => g.group === SHIELD_WALL);
        const b1 = after.stages.n.measures.bossGroups.find((g: Json) => g.group === SHIELD_WALL);
        const count = stageOf(plan, 'n').skills.groups[SHIELD_WALL - 1].count ?? 1;
        // The record counts the plan's Count (2 walls); node power's figure is PoB's own Count for the group (1), D-467.
        const atCount = (g: Json, c: number) => ((g.figure - g.ignite - g.bleed - g.poison) / count) * c + g.ignite + g.bleed + g.poison;
        const change1 = atCount(b1, 1) - atCount(b0, 1);
        const recordPct = pct(b1.figure, b0.figure);
        console.error(
          `[WU-127 R-64] pool move +${(s.gainPercent![0] as number).toFixed(3)}% (${s.gain![0]}); the record's group-4 boss figure ` +
            `${b0.figure} → ${b1.figure} (+${recordPct.toFixed(3)}%), at PoB's Count ${change1}`,
        );
        expect(Math.abs(s.gain![0]! - change1)).toBeLessThanOrEqual(0.01 * Math.abs(change1));
        expect(Math.abs((s.gainPercent![0] as number) - recordPct)).toBeLessThanOrEqual(1);
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('the rebuilt tree compiled (AC-K76 (1), PoB\'s own figures)', () => {
    it(
      'the rebuild applied to the plan and compiled measure-only gains at least +41% on the map figure, with TotalEHP and the lowest max hit at or above the targets',
      async () => {
        const s = rebuild.reply.bestSwap!;
        const plan = readPlan();
        applyMove(stageOf(plan, 'n'), s);
        const after = figures(await compile('tr-s2-rebuilt', plan, ['n']));
        const before = figures(rec);
        const gain = pct(after.damage, before.damage);
        console.error(`[WU-127 AC-K76 r2-s-2] compiled: map ${before.damage} → ${after.damage} (+${gain.toFixed(2)}%), EHP ${before.ehp} → ${after.ehp}, lowest max hit ${before.maxHit} → ${after.maxHit}`);
        expect(gain).toBeGreaterThanOrEqual(41);
        expect(after.ehp).toBeGreaterThanOrEqual(targets.ehp);
        expect(after.maxHit).toBeGreaterThanOrEqual(targets.maxHit);
        // Node power's own reading of the move is PoB's.
        expect(Math.abs(after.damage - (before.damage + s.gain![0]!)) / after.damage).toBeLessThan(1e-6);
        expect(Math.abs(after.ehp - s.ehp!) / after.ehp).toBeLessThan(1e-6);
      },
      ENGINE_TIMEOUT,
    );
  });
});
