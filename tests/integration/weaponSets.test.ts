/**
 * WU-101 (amendment 9 §17 D-426, §24.2 C-55a and the record's `outputsSet2`): weapon set 2 measured by the compile,
 * V1's Spirit check on both sets, and `get_node_power`'s pool moves, in process and engine-required. AC-P76, every
 * bullet.
 *
 * The fixture is `tests/fixtures/plans/weapon-sets/plan.json`, written from the pinned game data: a Warrior / Titan at
 * level 14 (Act 1, after the Ogham Manor), two stages on one tree track.
 * - Stage 1 uses one weapon set: no weapon-set passive, no item in a Swap slot.
 * - Stage 2 uses both: two passives tagged to each set, a Slim Mace and a Rattling Sceptre in set 1 (the sceptre's
 *   100 Spirit, `Data/Bases/sceptre.lua`), a Slim Mace and a Splintered Tower Shield in set 2 (no Spirit), and Herald
 *   of Ash at level 1, which reserves 30 Spirit (`Data/Skills/act_str.lua`) on both sets, since a plan's group follows
 *   no slot. So set 1 holds its Spirit, set 2 doesn't.
 * Every expected value comes from PoB itself (its own weapon swap: the item set's `useSecondWeaponSet` and a rebuild,
 * as the items tab's swap button does, `Classes/ItemsTab.lua:292-330`; Lua queries of the loaded specs), from the
 * game data, or from a second compile; never from the tool's own output.
 *
 * - AC-P76 (1): a stage with set-2 passives and a set-2 weapon records `outputsSet2`, PoB's figures with set 2 active,
 *   its Spirit among them; V1 reports Spirit over on set 2 when only set 2 exceeds it; a stage without set 2 records
 *   none, and the stage's own measure stays set 1's.
 * - AC-P76 (2): `get_node_power` on the stage with weapon-set nodes returns a legal pool move that gains, tagged to its
 *   pool, which passes V1's `weapon-set-points` once applied and compiled; no swap tried moves a node across pools or
 *   between a pool and the main tree.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { NodePowerParams } from '../../src/engine/schemas';
import type { CompileRecord } from '../../src/plan/record';
import { SPIRIT_WARNING } from '../../src/plan/checks/v1';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'weapon-sets', 'plan.json');
const ENGINE_TIMEOUT = 600_000;
const TWO_SETS = 'Act 1 two weapon sets (L14) {2}';
/** The Rattling Sceptre's Spirit (`Data/Bases/sceptre.lua`) and Herald of Ash's at level 1 (`Data/Skills/act_str.lua`). */
const SCEPTRE_SPIRIT = 100;
const HERALD_SPIRIT = 30;

type Json = Record<string, any>;

const close = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

engineDescribe('WU-101: weapon set 2 measured, Spirit on both sets, and pool moves (D-426, C-55a; AC-P76)', () => {
  let f: SessionFixture;
  let run: { planPath: string; abs: string };
  let record: CompileRecord;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:weapon-sets-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function ok(tool: string, args: Record<string, unknown>): Promise<string> {
    const out = await f.call(tool, args);
    expect({ tool, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, isError: false, text: '' });
    return out.text;
  }

  const readRecord = () => JSON.parse(fs.readFileSync(path.join(run.abs, 'compile-record.json'), 'utf8')) as CompileRecord;

  /** Recompile the run's plan after `change`. */
  async function recompile(change: (plan: Json) => void): Promise<CompileRecord> {
    const file = path.join(f.guides, run.planPath);
    const plan = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
    change(plan);
    fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
    await ok('compile_plan', { plan_path: run.planPath, measure_only: true });
    return readRecord();
  }

  /**
   * PoB's own figures and warning lines for a loadout at level 14, with weapon set 1 and with weapon set 2 active, as
   * its swap button sets them (the item set's useSecondWeaponSet, then a rebuild on an empty skill cache).
   */
  async function pobSets(loadout: string): Promise<{ one: Json; two: Json; warnings: { one: string[]; two: string[] } }> {
    return lua(`
      local l = build:GetLoadoutByName(${JSON.stringify(loadout)})
      build:SetActiveLoadout(l)
      build.characterLevel = 14
      build.characterLevelAutoMode = false
      build.configTab:BuildModList()
      local set = build.itemsTab.activeItemSet
      local prior = set.useSecondWeaponSet
      local warnings = {}
      local function measure(two, key)
        set.useSecondWeaponSet = two
        wipeGlobalCache()
        build.buildFlag = true
        build.calcsTab:BuildOutput()
        local o = build.calcsTab.mainOutput
        local out = {}
        for _, k in ipairs({ 'Life', 'Spirit', 'SpiritUnreserved', 'FullDPS', 'TotalEHP', 'Str', 'Dex', 'Int', 'Armour' }) do
          out[k] = o[k]
        end
        build:RefreshStatList()
        local lines = {}
        for _, line in ipairs(build.controls.warnings.lines or {}) do
          lines[#lines + 1] = (tostring(line):gsub('%^x%x%x%x%x%x%x', ''):gsub('%^%d', ''))
        end
        warnings[key] = lines
        return out
      end
      local two = measure(true, 'two')
      local one = measure(false, 'one')
      set.useSecondWeaponSet = prior
      return { one = one, two = two, warnings = warnings }`);
  }

  /** A loadout's allocated main-tree nodes by weapon-set tag (0, 1, 2), as PoB holds them. */
  async function tags(loadout: string): Promise<Record<string, number>> {
    return lua(`
      local l = build:GetLoadoutByName(${JSON.stringify(loadout)})
      local spec = build.treeTab.specList[l.specId]
      local out = {}
      for id, n in pairs(spec.allocNodes) do
        if not n.ascendancyName and n.type ~= 'ClassStart' and n.type ~= 'AscendClassStart' then out[tostring(id)] = n.allocMode or 0 end
      end
      return out`);
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const made = await f.call('guide_run', { new_run: 'weapon-sets' });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    run = { planPath, abs };
    fs.copyFileSync(FIXTURE, path.join(f.guides, planPath));
    await ok('compile_plan', { plan_path: planPath, measure_only: true });
    record = readRecord();
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it(
    "AC-P76 (1): a stage with set-2 passives and a set-2 weapon records outputsSet2, PoB's own figures with set 2 active, its Spirit among them; a stage without set 2 records none, and the stage's own measure stays set 1's",
    async () => {
      const one = record.stages['1'];
      const two = record.stages['2'];
      expect('outputsSet2' in one).toBe(false);
      expect(two.outputsSet2).toBeDefined();
      const set2 = two.outputsSet2!;
      // The same key-figure map as outputs: every finite number of PoB's main output.
      for (const k of ['Life', 'EnergyShield', 'Mana', 'Spirit', 'SpiritUnreserved', 'FullDPS', 'TotalEHP', 'FireResist', 'PhysicalMaximumHitTaken']) {
        expect({ k, outputs: typeof two.outputs[k], outputsSet2: typeof set2[k] }).toEqual({ k, outputs: 'number', outputsSet2: 'number' });
      }
      const keys = new Set(Object.keys(two.outputs));
      const shared = Object.keys(set2).filter((k) => keys.has(k)).length;
      expect(shared).toBeGreaterThan(0.95 * Math.max(keys.size, Object.keys(set2).length));

      // PoB's own swap: the record's two maps are its figures with each set active.
      const pob = await pobSets(TWO_SETS);
      for (const k of Object.keys(pob.two)) {
        expect({ k, set1: close(two.outputs[k], pob.one[k]), set2: close(set2[k], pob.two[k]) }).toEqual({ k, set1: true, set2: true });
      }
      // The game data: the sceptre's Spirit is set 1's alone, and both Heralds reserve on both sets.
      expect(two.outputs.Spirit - set2.Spirit).toBe(SCEPTRE_SPIRIT);
      expect(set2.Spirit - set2.SpiritUnreserved).toBe(2 * HERALD_SPIRIT);
      expect(two.outputs.Spirit - two.outputs.SpiritUnreserved).toBe(2 * HERALD_SPIRIT);
      // Set 2's tree and weapons differ, so its figures do.
      expect(set2.Life).not.toBe(two.outputs.Life);
      expect(set2.FullDPS).not.toBe(two.outputs.FullDPS);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-P76 (1): V1 reports Spirit over on weapon set 2 when only set 2 exceeds it, as PoB warns with set 2 active; the stage without set 2 has no such finding',
    async () => {
      const two = record.stages['2'];
      const set2 = two.outputsSet2!;
      expect(two.outputs.SpiritUnreserved).toBeGreaterThanOrEqual(0);
      expect(set2.SpiritUnreserved).toBeLessThan(0);
      // PoB itself warns with set 2 active, and not with set 1.
      const pob = await pobSets(TWO_SETS);
      expect(pob.warnings.two).toContain(SPIRIT_WARNING);
      expect(pob.warnings.one).not.toContain(SPIRIT_WARNING);

      const line = `${SPIRIT_WARNING} on weapon set 2`;
      const spirit = (two.v1?.findings ?? []).filter((x) => String(x.message).includes(SPIRIT_WARNING));
      expect(spirit).toEqual([
        expect.objectContaining({
          code: 'pob-warning',
          data: { line, set: 2, spirit: set2.Spirit, unreserved: set2.SpiritUnreserved },
        }),
      ]);
      expect(two.v1?.pass).toBe(false);
      expect(two.pobWarnings.kept).toContain(line);
      expect(two.pobWarnings.kept).not.toContain(SPIRIT_WARNING);
      expect((record.stages['1'].v1?.findings ?? []).filter((x) => String(x.message).includes(SPIRIT_WARNING))).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-P76 (2): get_node_power returns a legal pool move that gains, tagged to its pool, measured with its set active and passing weapon-set-points once applied and compiled; no swap tried moves a node across pools or between a pool and the main tree",
    async () => {
      const before = await tags(TWO_SETS);
      const pool = (set: number) => Object.entries(before).filter(([, m]) => m === set).map(([id]) => Number(id)).sort((a, b) => a - b);
      expect(pool(1).length).toBeGreaterThan(0);
      expect(pool(2).length).toBeGreaterThan(0);

      const exported = await canonicalExport(f.session);
      const params: NodePowerParams = { stats: ['FullDPS', 'TotalEHP'], loadout: TWO_SETS, limit: 0 };
      const { value: r } = await f.session.run({ tool: 'test:weapon-sets-power', kind: 'read' }, (ctx) => ctx.client.nodePower(params));
      // The call leaves the build as it was: the weapon set it switched to for set 2's pool is put back.
      expect(await canonicalExport(f.session)).toBe(exported);

      expect((r.poolSwaps ?? []).map((p) => [p.set, p.nodes])).toEqual([
        [1, pool(1).length],
        [2, pool(2).length],
      ]);
      // No swap tried moves a node across pools, or between a pool and the main tree; the main swap moves no tagged node.
      for (const p of r.poolSwaps!) {
        for (const s of p.swaps) {
          // WU-110 (D-439): `branches` in place of `branch`; a pool move stays one branch at a time.
          expect({ set: p.set, branches: s.branches.length, branch: pool(p.set).includes(s.branches[0].id) }).toEqual({ set: p.set, branches: 1, branch: true });
          for (const n of s.removed ?? []) expect({ set: p.set, node: n.id, tag: before[String(n.id)] }).toEqual({ set: p.set, node: n.id, tag: p.set });
          for (const n of s.added ?? []) expect({ set: p.set, node: n.id, tag: before[String(n.id)] }).toEqual({ set: p.set, node: n.id, tag: undefined });
        }
      }
      for (const n of r.bestSwap?.removed ?? []) expect({ node: n.id, tag: before[String(n.id)] }).toEqual({ node: n.id, tag: 0 });

      // Each pool is measured with its own set active: its base is the record's figure on that set.
      const figureOn = (rec: CompileRecord, set: number) => (set === 2 ? rec.stages['2'].outputsSet2! : rec.stages['2'].outputs);
      for (const p of r.poolSwaps!) expect({ set: p.set, base: close(p.base[0], figureOn(record, p.set).FullDPS) }).toEqual({ set: p.set, base: true });

      const gaining = r.poolSwaps!.filter((p) => p.bestSwap !== undefined && (p.bestSwap.gain?.[0] ?? 0) > 0);
      expect(gaining.length).toBeGreaterThan(0);
      const move = gaining[0];
      const swap = move.bestSwap!;
      const removed = (swap.removed ?? []).map((n) => n.id);
      const added = (swap.added ?? []).map((n) => n.id);
      expect(removed.length).toBeGreaterThan(0);
      expect(added.length).toBeGreaterThan(0);

      // The tool's line names the pool, in the main swap's form, with the bridge's nodes.
      const text = await ok('get_node_power', { loadout: TWO_SETS, limit: 0 });
      expect(text).toMatch(/^Best swap: /m);
      for (const p of r.poolSwaps!) expect(text).toMatch(new RegExp(`^Best swap \\(weapon set ${p.set}\\): `, 'm'));
      const lineText = new RegExp(`^Best swap \\(weapon set ${move.set}\\): (.*)$`, 'm').exec(text)![1];
      expect(lineText).toMatch(/^\+\d+\.\d\d% Full DPS \([^)]*\); Effective Hit Pool [+-]\d+\.\d\d% \([^)]*\)\. Remove \d+ points?: .*\. Add \d+ points?: .*\. Searched from branch .* \[\d+\]: its new paths use \d+ of the \d+ freed points?, counted after the branch is removed\.$/);
      const ids = (t: string) => [...t.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      expect(ids(lineText.slice(lineText.indexOf(' Remove '), lineText.indexOf('. Add ')))).toEqual(removed);
      expect(ids(lineText.slice(lineText.indexOf('. Add '), lineText.indexOf('. Searched from branch')))).toEqual(added);

      // Applied to the plan (nodes and the pool's weaponSetNodes) and compiled: PoB holds the added nodes in the pool.
      const attributes = Object.fromEntries((swap.added ?? []).filter((n) => n.attributeChoice).map((n) => [n.id, n.attributeChoice!]));
      const rec2 = await recompile((plan) => {
        const st = plan.stages.find((s: Json) => s.id === '2');
        const gone = new Set(removed);
        const key = move.set === 1 ? 'set1' : 'set2';
        st.tree.nodes = [...st.tree.nodes.filter((id: number) => !gone.has(id)), ...added];
        st.tree.weaponSetNodes[key] = [...st.tree.weaponSetNodes[key].filter((id: number) => !gone.has(id)), ...added];
        st.tree.attributeChoices = [
          ...st.tree.attributeChoices.filter((c: Json) => !gone.has(c.node)),
          ...Object.entries(attributes).map(([node, attribute]) => ({ node: Number(node), attribute })),
        ];
      });
      const after = await tags(TWO_SETS);
      for (const id of added) expect({ node: id, tag: after[String(id)] }).toEqual({ node: id, tag: move.set });
      for (const id of removed) expect({ node: id, tag: after[String(id)] }).toEqual({ node: id, tag: undefined });
      for (const [id, tag] of Object.entries(before)) {
        if (!removed.includes(Number(id))) expect({ node: id, tag: after[id] }).toEqual({ node: id, tag });
      }
      // Within the pool's points: no more nodes in it, none in the other pool or the main tree, and V1 passes
      // weapon-set-points with no finding the stage didn't have.
      const count = (t: Record<string, number>, set: number) => Object.values(t).filter((m) => m === set).length;
      expect(count(after, move.set)).toBeLessThanOrEqual(count(before, move.set));
      expect(count(after, 3 - move.set)).toBe(count(before, 3 - move.set));
      expect(count(after, 0)).toBe(count(before, 0));
      const codes = (rec: CompileRecord) => [...new Set((rec.stages['2'].v1?.findings ?? []).map((x) => x.code))].sort();
      expect(codes(rec2)).not.toContain('weapon-set-points');
      expect(codes(rec2).filter((c) => !codes(record).includes(c))).toEqual([]);
      // The gain the tool measured is the compile's on the pool's set.
      const gain = figureOn(rec2, move.set).FullDPS - figureOn(record, move.set).FullDPS;
      expect(Math.abs(gain - swap.gain![0]!)).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(gain)));
      expect(gain).toBeGreaterThan(0);
    },
    ENGINE_TIMEOUT,
  );
});
