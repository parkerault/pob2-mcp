/**
 * WU-110 (amendment 11 §5, D-437; C-55): node power's `MainDamage` stat, its `cull`, and the pool moves on a weapon set
 * without the main group, in process and engine-required. AC-P79's MainDamage and pool bullets, and AC-P80's samples.
 *
 * The real server runs in process (`startSessionFixture`, test actions on for Lua queries) over private builds, state
 * and guides folders. The fixtures are the repository's own, written from the pinned game data:
 * - the culling rung: the committed `fifteen-stage` plan's stage 15 (a Warrior / Titan with Rolling Slam, as
 *   `nodePower.test.ts` makes it the rung `n`, against a Pinnacle boss), its main group at Count 2 and with the support
 *   Culling Strike I (`Data/Skills/sup_dex.lua`: Culling Strike against a rare or unique enemy) in Ruthless's place;
 * - the weapon-sets plan (`tests/fixtures/plans/weapon-sets/plan.json`, stage 2: two passives tagged to each set), its
 *   main group, Boneshatter, socketed on weapon set 1 (D-426's group `weaponSet`).
 * Every expected value comes from PoB itself (the compile record's counted fields, PoB's own CullMultiplier, the
 * record's figures with set 2 active, and a Full DPS call's pool moves), never from the tool's own output.
 *
 * - AC-P79 (5): `MainDamage` equals the compile record's `measures.damage.map` on the same stage (the main group's five
 *   fields by the record's Count rule, `COUNT_RULE`), and carries PoB's `CullMultiplier` only with `cull: true`: with
 *   it, it equals the map figure of the same stage compiled with `skills.cull` (schema 7), which carries the multiplier.
 * - AC-P79 (6): a pool move on a weapon set without the main group still ranks by Full DPS.
 * - AC-P80: `tool-calls.json` holds `rebuild`, `free` and `MainDamage` samples of get_node_power.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { NodePowerParams, NodePowerResult } from '../../src/engine/schemas';
import { COUNT_RULE, type CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const ENGINE_TIMEOUT = 600_000;

type Json = Record<string, any>;

const N = 'Non-budget (L90) {n}';
const TWO_SETS = 'Act 1 two weapon sets (L14) {2}';
/** The damage figure's five fields (amendment 11's Names): each by its Count rule. */
const FIGURE_FIELDS = ['TotalDPS', 'TotalDot', 'IgniteDPS', 'BleedDPS', 'PoisonDPS'];

/** The culling rung: fifteen-stage's stage 15 as rung n, its main group at Count 2 with Culling Strike I. */
function cullingPlan(): Json {
  const p = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'plans', 'fifteen-stage', 'plan.json'), 'utf8')) as Json;
  p.schemaVersion = 5;
  p.ledger = [];
  const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });
  const s = p.stages.find((x: Json) => x.id === '15');
  const group = s.skills.groups[s.skills.main.group - 1];
  group.count = 2;
  group.gems = group.gems.map((g: Json) => (g.name === 'Ruthless' ? { ...g, name: 'Culling Strike I', level: 1, quality: 0 } : g));
  p.stages = [
    {
      ...s,
      id: 'n',
      variant: 'non-budget',
      loadoutName: N,
      ascendancyPoints: 8,
      variantBasis: { level: judgment('test: the fixture level'), gemLevels: judgment('test: the fixture gems'), ascendancyPoints: judgment('test: 8') },
      skills: { ...s.skills, rolledGroup: s.skills.main.group },
      claims: [],
    },
  ];
  return p;
}

/** The culling rung at schema 7, stating its cull (`skills.cull`), so the record's map figure carries the multiplier. */
function cullStatedPlan(): Json {
  const p = cullingPlan();
  p.schemaVersion = 7;
  p.stages[0].skills.cull = "Culling Strike I's Culling Strike on Rolling Slam";
  return p;
}

/** The weapon-sets plan with stage 2's main group socketed on weapon set 1. */
function mainOnSetOnePlan(): Json {
  const p = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'plans', 'weapon-sets', 'plan.json'), 'utf8')) as Json;
  const s = p.stages.find((x: Json) => x.id === '2');
  s.skills.groups[s.skills.main.group - 1].weaponSet = 1;
  return p;
}

const close = (a: unknown, b: unknown, rel = 1e-9) =>
  typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));

engineDescribe('WU-110: get_node_power ranks by MainDamage, with cull, and a pool without the main group by Full DPS (D-437; AC-P79)', () => {
  let f: SessionFixture;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:node-power-main-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function power(params: NodePowerParams): Promise<NodePowerResult> {
    const { value } = await f.session.run({ tool: 'test:node-power-main', kind: 'read' }, (ctx) => ctx.client.nodePower(params));
    return value;
  }

  async function ok(tool: string, args: Record<string, unknown>): Promise<string> {
    const out = await f.call(tool, args);
    expect({ tool, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, isError: false, text: '' });
    return out.text;
  }

  async function compile(slug: string, plan: Json): Promise<CompileRecord> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    await ok('compile_plan', { plan_path: planPath, measure_only: true });
    return JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord;
  }

  /**
   * The record's damage figure for a stage's named source (both fixtures' main selection: group 1, its first skill and
   * stat set): its counted fields' sum, each by its Count rule.
   */
  function recordFigure(rec: CompileRecord, stage: string): { figure: number; count: number; raw: number } {
    const st = rec.stages[stage];
    const key = 'g1s1p1';
    const counted = st.countedSkillOutputs[key];
    const raw = st.skillOutputs[key].fields;
    let figure = 0;
    let rawSum = 0;
    for (const field of FIGURE_FIELDS) {
      expect({ field, rule: COUNT_RULE.has(field) }).toEqual({ field, rule: true });
      figure += counted.fields[field] ?? 0;
      rawSum += raw[field] ?? 0;
    }
    return { figure, count: counted.count, raw: rawSum };
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('on the culling rung (Count 2, Culling Strike I against a Pinnacle boss)', () => {
    let record: CompileRecord;

    beforeAll(async () => {
      record = await compile('np-main-damage', cullingPlan());
    }, ENGINE_TIMEOUT);

    it(
      "AC-P79 (5): MainDamage equals the record's measures.damage.map on the same stage, the main group's five fields by COUNT_RULE, and carries PoB's CullMultiplier only with cull: true, equal to the map figure of the stage compiled with skills.cull",
      async () => {
        const map = record.stages.n.measures!.damage!.map!;
        expect(typeof map).toBe('number');
        const { figure, count, raw } = recordFigure(record, 'n');
        expect(close(map, figure)).toBe(true);
        expect(count).toBe(2);
        // The Count rule moved the figure: the hit is doubled, the ailments are not.
        expect(figure).toBeGreaterThan(raw);
        expect(close(record.stages.n.countedSkillOutputs.g1s1p1.fields.TotalDPS, 2 * record.stages.n.skillOutputs.g1s1p1.fields.TotalDPS)).toBe(true);

        const r = await power({ stats: ['MainDamage', 'TotalEHP'], loadout: N, limit: 0, maxDistance: 2 });
        expect(r.stats).toEqual([
          { id: 'MainDamage', label: 'Main damage' },
          { id: 'TotalEHP', label: 'Effective Hit Pool' },
        ]);
        expect({ base: r.base[0], map, equal: close(r.base[0], map) }).toEqual({ base: r.base[0], map, equal: true });
        // Ranked by it: the best swap's first gain is MainDamage's change, a percentage of that base.
        if (r.bestSwap) expect(close(r.bestSwap.gainPercent![0], (r.bestSwap.gain![0]! / map) * 100)).toBe(true);

        // PoB's own culling multiplier for the main skill, on this rung against its Pinnacle boss.
        const cullMultiplier = await lua<number>(`
          build:SetActiveLoadout(build:GetLoadoutByName(${JSON.stringify(N)}))
          build.buildFlag = true
          build.calcsTab:BuildOutput()
          return build.calcsTab.mainOutput.CullMultiplier`);
        expect(cullMultiplier).toBeGreaterThan(1);
        const culled = await power({ stats: ['MainDamage', 'TotalEHP'], loadout: N, limit: 0, maxDistance: 2, cull: true });
        expect(close(culled.base[0], map * cullMultiplier)).toBe(true);
        expect(culled.base[1]).toBe(r.base[1]);

        const text = await ok('get_node_power', { stats: ['MainDamage', 'TotalEHP'], loadout: N, limit: 3, max_distance: 2, cull: true });
        expect(text).toMatch(/^Ranked by Main damage \(MainDamage\); also measured: Effective Hit Pool \(TotalEHP\)\./m);
        // cull without MainDamage is refused, before the engine runs.
        const refused = await f.call('get_node_power', { stats: ['FullDPS'], loadout: N, cull: true });
        expect(refused.isError).toBe(true);
        expect(refused.text).toContain('cull multiplies MainDamage by its CullMultiplier; name MainDamage in stats');

        // The same rung compiled with its cull stated: the record's map figure carries the multiplier, as cull: true does.
        const stated = await compile('np-main-damage-cull', cullStatedPlan());
        const culledMap = stated.stages.n.measures!.damage!.map!;
        expect(close(culledMap, map * cullMultiplier)).toBe(true);
        const again = await power({ stats: ['MainDamage', 'TotalEHP'], loadout: N, limit: 0, maxDistance: 2, cull: true });
        expect({ base: again.base[0], culledMap, equal: close(again.base[0], culledMap) }).toEqual({ base: again.base[0], culledMap, equal: true });
      },
      ENGINE_TIMEOUT,
    );
  });

  describe("on the weapon-sets plan with the main group on weapon set 1", () => {
    let record: CompileRecord;

    beforeAll(async () => {
      record = await compile('np-main-set-one', mainOnSetOnePlan());
    }, ENGINE_TIMEOUT);

    it(
      'AC-P79 (6): with MainDamage ranking, the pool move on weapon set 2, which holds no main group, still ranks by Full DPS: the same moves as a Full DPS call; set 1\'s ranks by MainDamage',
      async () => {
        const main = await power({ stats: ['MainDamage', 'TotalEHP'], loadout: TWO_SETS, limit: 0 });
        const full = await power({ stats: ['FullDPS', 'TotalEHP'], loadout: TWO_SETS, limit: 0 });
        expect(main.poolSwaps!.map((p) => p.set)).toEqual([1, 2]);
        const [one, two] = main.poolSwaps!;
        // Set 2: Full DPS in MainDamage's place, its base the record's Full DPS with set 2 active.
        expect(two.stats).toEqual([
          { id: 'FullDPS', label: 'Full DPS' },
          { id: 'TotalEHP', label: 'Effective Hit Pool' },
        ]);
        expect(close(two.base[0], record.stages['2'].outputsSet2!.FullDPS)).toBe(true);
        const fullTwo = full.poolSwaps!.find((p) => p.set === 2)!;
        const shape = (p: typeof two) =>
          p.swaps.map((s) => ({ branches: s.branches.map((b) => b.id), verdict: s.verdict, added: (s.added ?? []).map((n) => n.id), gain: s.gain?.[0] ?? null }));
        expect(shape(two)).toEqual(shape(fullTwo));
        expect(two.bestSwap?.added?.map((n) => n.id)).toEqual(fullTwo.bestSwap?.added?.map((n) => n.id));
        // A pool move stays one branch at a time.
        for (const p of main.poolSwaps!) for (const s of p.swaps) expect(s.branches).toHaveLength(1);
        // Set 1 holds the main group: its pool ranks by MainDamage, the record's figure on set 1.
        expect(one.stats).toBeUndefined();
        expect(close(one.base[0], recordFigure(record, '2').figure)).toBe(true);
        expect(close(main.base[0], one.base[0])).toBe(true);

        const text = await ok('get_node_power', { stats: ['MainDamage', 'TotalEHP'], loadout: TWO_SETS, limit: 3 });
        expect(text).toMatch(/^Weapon set 2: \d+ nodes?; with it active, Full DPS [\d,.]+ \| Effective Hit Pool [\d,.]+\. It holds no main group, so Full DPS ranks its move in place of Main damage\.$/m);
        expect(text).toMatch(/^Weapon set 1: \d+ nodes?; with it active, Main damage [\d,.]+ \| Effective Hit Pool [\d,.]+\.$/m);
      },
      ENGINE_TIMEOUT,
    );
  });
});

describe("AC-P80: tool-calls.json holds get_node_power's rebuild, free and MainDamage samples", () => {
  it('each runs as a sample call of the tool hygiene suite', () => {
    const samples = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Array<{ tool: string; args: Json; expect: string }>;
    const ours = samples.filter((s) => s.tool === 'get_node_power');
    expect(ours.some((s) => s.args.rebuild === true && s.expect === 'ok')).toBe(true);
    expect(ours.some((s) => Array.isArray(s.args.free) && s.args.free.length > 0 && s.expect === 'ok')).toBe(true);
    expect(ours.some((s) => Array.isArray(s.args.stats) && s.args.stats.includes('MainDamage') && s.expect === 'ok')).toBe(true);
  });
});
