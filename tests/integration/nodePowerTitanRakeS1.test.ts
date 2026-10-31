/**
 * WU-127 (amendment 13 §8, D-467; C-55): the rebuild with repair on the Titan Rake run's r2-s-1 plan, in process and
 * engine-required (AC-K76's r2-s-1 threshold), and AC-K77's fixture and sample rows.
 *
 * The fixture is `tests/fixtures/plans/titan-rake/r2-s-1/plan.json`, the Titan Rake live run's bleed build (the user's
 * grant, HG-6 at approval: copied unchanged from the run folder's `builds/r2-s-1/plan.json`), compiled measure-only in a
 * run folder `guide_run {new_run}` made, its rung `n` loaded. Every expected value comes from PoB itself: the compile
 * record of the plan, and of the plan with the rebuild applied, compiled again.
 *
 * - AC-K76 (1): `rebuild` at reach 12 with `targets` (the compiled `n`'s TotalEHP and lowest max hit), `pace_exchange: 3`,
 *   `keep` the plan's needs less its attribute needs, `stats: ["MainDamage", "TotalEHP"]`: a legal rebuild gaining at least
 *   +46% Main damage, its TotalEHP and lowest max hit at or above the targets, within the 120 s long action, in Appendix A's
 *   `(target …)` form; the rebuilt tree, compiled, gives PoB's own figures to the same effect.
 * - AC-K77: the two Titan Rake plans' sha1s equal the run folder's (recorded at the copy, 2026-10-30); `tool-calls.json`
 *   holds a `get_node_power` sample with `targets`, `pace_exchange` and `pool_groups`.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import type { NodePowerResult, PowerSwap } from '../../src/engine/schemas';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const TITAN_RAKE = path.join(FIXTURES, 'plans', 'titan-rake');
const PLAN = path.join(TITAN_RAKE, 'r2-s-1', 'plan.json');
const ENGINE_TIMEOUT = 900_000;
const LONG_ACTION_SECONDS = 120;

/** The sha1s of the run folder's `builds/<id>/plan.json`, taken at the copy (HG-6's grant; the work-log records them). */
const RUN_FOLDER_SHA1 = {
  'r2-s-1': '1f477797aaace127e69ba7a64343ba0d761e359d',
  'r2-s-2': '0a298c1ff83f28241c7c72a7eef55deb64652c17',
};

type Json = Record<string, any>;

const readPlan = (): Json => JSON.parse(fs.readFileSync(PLAN, 'utf8')) as Json;
const stageOf = (plan: Json, id: string): Json => plan.stages.find((s: Json) => s.id === id);
const ATTRIBUTE_STATS = new Set(['Str', 'Dex', 'Int']);

/** A stage's tree with a main-tree move applied: its removed nodes out (of the tree and the needs), its added nodes in. */
function applyMove(stage: Json, s: PowerSwap): void {
  const gone = new Set((s.removed ?? []).map((n) => n.id));
  const added = (s.added ?? []).map((n) => n.id);
  const tree = stage.tree;
  tree.nodes = [...tree.nodes.filter((id: number) => !gone.has(id)), ...added.filter((id) => !tree.nodes.includes(id))];
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

describe('AC-K77: the Titan Rake fixtures and the get_node_power sample', () => {
  it("tests/fixtures/plans/titan-rake/ holds the two plans, each byte-equal to the run folder's (its sha1)", () => {
    expect(fs.readdirSync(TITAN_RAKE).sort()).toEqual(['r2-s-1', 'r2-s-2']);
    for (const [id, sha1] of Object.entries(RUN_FOLDER_SHA1)) {
      const file = path.join(TITAN_RAKE, id, 'plan.json');
      expect(fs.readdirSync(path.dirname(file))).toEqual(['plan.json']);
      expect({ id, sha1: crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex') }).toEqual({ id, sha1 });
    }
  });

  it('no machine path is in either plan', () => {
    for (const id of Object.keys(RUN_FOLDER_SHA1)) {
      const text = fs.readFileSync(path.join(TITAN_RAKE, id, 'plan.json'), 'utf8');
      expect({ id, paths: text.match(/\/mnt\/|\/home\/|[A-Za-z]:[\\/]|Users[\\/]/g) }).toEqual({ id, paths: null });
    }
  });

  it("tool-calls.json holds a get_node_power sample with targets, pace_exchange and pool_groups, run by the tool hygiene suite", () => {
    const samples = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Array<{ tool: string; args: Json; expect: string }>;
    const ours = samples.filter((s) => s.tool === 'get_node_power' && s.expect === 'ok');
    expect(ours.some((s) => s.args.targets !== undefined && typeof s.args.pace_exchange === 'number' && s.args.pool_groups !== undefined)).toBe(true);
    // The exchange without MainDamage is a refused sample (D-467).
    expect(samples.some((s) => s.tool === 'get_node_power' && s.expect === 'error' && s.args.pace_exchange !== undefined && !(s.args.stats ?? []).includes('MainDamage'))).toBe(true);
  });
});

engineDescribe('WU-127: the rebuild with repair on the Titan Rake r2-s-1 plan (D-467; AC-K76)', () => {
  let f: SessionFixture;
  let rec: Json;

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

  const figures = (r: Json) => {
    const n = r.stages.n;
    return { damage: n.measures.damage.map as number, ehp: n.outputs.TotalEHP as number, maxHit: n.measures.toughness.lowestMaxHit.value as number };
  };

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    rec = await compile('tr-s1', readPlan());
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it(
    'AC-K76 (1): rebuild at reach 12 with the targets gains at least +46% Main damage, legal, at or above both targets, within 120 s, in the (target …) form; compiled, PoB agrees',
    async () => {
      const n = stageOf(readPlan(), 'n');
      const needs = n.tree.needs as Array<{ nodes: number[]; stat?: string; claim: string }>;
      const keep = needs.filter((x) => !ATTRIBUTE_STATS.has(x.stat ?? '')).flatMap((x) => x.nodes);
      const dropped = needs.filter((x) => ATTRIBUTE_STATS.has(x.stat ?? '')).map((x) => ({ claim: x.claim, nodes: x.nodes }));
      const before = figures(rec);
      const targets = { ehp: before.ehp, maxHit: before.maxHit };

      const spy = jest.spyOn(PoBLuaApiClient.prototype, 'nodePower');
      let text: string;
      let r: NodePowerResult;
      let seconds: number;
      try {
        const t0 = performance.now();
        const out = await f.call('get_node_power', {
          loadout: n.loadoutName, rebuild: true, max_distance: 12, targets, pace_exchange: 3, keep, stats: ['MainDamage', 'TotalEHP'], limit: 0,
        });
        seconds = (performance.now() - t0) / 1000;
        expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
        text = out.text;
        expect(spy).toHaveBeenCalledTimes(1);
        r = await (spy.mock.results[0].value as Promise<NodePowerResult>);
      } finally {
        spy.mockRestore();
      }
      const s = r.bestSwap!;
      expect({ verdict: r.swaps[0].verdict, reason: r.swaps[0].reason }).toEqual({ verdict: 'legal', reason: undefined });
      expect(s.gainPercent![0]).toBeGreaterThanOrEqual(46);
      expect(s.ehp!).toBeGreaterThanOrEqual(targets.ehp);
      expect(s.maxHit!).toBeGreaterThanOrEqual(targets.maxHit);
      expect(seconds).toBeLessThan(LONG_ACTION_SECONDS);
      const line = text.split('\n').find((l) => l.startsWith('Rebuild: '))!;
      expect(line).toMatch(/^Rebuild: \+[\d.]+% Main damage \(\+[\d,]+\); EHP [\d,]+ \(target [\d,]+\), lowest max hit [\d,]+ \w+ \(target [\d,]+\)(; repaired: .*?)?\. Remove /);
      console.error(
        `[WU-127 AC-K76 r2-s-1] rebuild with repair: +${(s.gainPercent![0] as number).toFixed(2)}% Main damage in ${seconds.toFixed(1)} s ` +
          `(${r.cpuSeconds.toFixed(1)} s CPU, ${r.calculations} calculations); EHP ${s.ehp} (target ${targets.ehp}), lowest max hit ${s.maxHit} ${s.maxHitType} ` +
          `(target ${targets.maxHit}); repair steps: ${JSON.stringify((s.repair ?? []).map((st) => ({ freed: st.freed.map((x) => x.id), added: st.added.map((x) => x.id) })))}; ` +
          `dropped attribute needs: ${JSON.stringify(dropped)}`,
      );

      // PoB's own figures for the rebuilt tree, compiled.
      const plan = readPlan();
      applyMove(stageOf(plan, 'n'), s);
      const after = figures(await compile('tr-s1-rebuilt', plan, ['n']));
      const gain = ((after.damage - before.damage) / before.damage) * 100;
      console.error(`[WU-127 AC-K76 r2-s-1] compiled: map ${before.damage} → ${after.damage} (+${gain.toFixed(2)}%), EHP ${before.ehp} → ${after.ehp}, lowest max hit ${before.maxHit} → ${after.maxHit}`);
      expect(gain).toBeGreaterThanOrEqual(46);
      expect(after.ehp).toBeGreaterThanOrEqual(targets.ehp);
      expect(after.maxHit).toBeGreaterThanOrEqual(targets.maxHit);
      expect(Math.abs(after.damage - (before.damage + s.gain![0]!)) / after.damage).toBeLessThan(1e-6);
    },
    ENGINE_TIMEOUT,
  );
});
