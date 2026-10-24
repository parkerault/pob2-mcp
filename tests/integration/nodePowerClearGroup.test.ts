/**
 * WU-108 (amendment 10 §10, D-435; C-55; AC-P77): `get_node_power`'s `clear_group` is the plan's group number, as the
 * compile record numbers it, mapped to PoB's socket-group index at call time with Compile.lua's `group_indices` logic:
 * the groups no item or passive grants first, in order, then PoB's own. In process and engine-required.
 *
 * The defect: the bridge read `clear_group` as PoB's index, where a group PoB adds for an item's granted skill can come
 * first (D-382), so the guard measured another skill (on the live test's r1-b-3, plan group 1 was PoB's group 3).
 *
 * The fixture is `tests/fixtures/plans/clear-group-granted/plan.json`, written from the pinned game data: a Warrior /
 * Titan at level 80 (the tree of `tests/fixtures/plans/weapon-set-slots`) holding a Hardwood Spear ("Grants Skill:
 * Spear Throw", `Data/Bases/spear.lua`) and a Splintered Tower Shield in the off-hand ("Grants Skill: Raise Shield",
 * `Data/Bases/shield.lua`), each written with its implicit; group 1 Rapid Assault (the main skill), group 2 Seismic
 * Cry (`role: clear`, the live test's clear skill; its first stat set has an area). The off-hand makes the compile
 * calculate before the plan's groups go in (D-382), so PoB adds the spear's Spear Throw group before them; the compile
 * now lists the plan's groups first (`plan_groups_first`, D-435), so the first test reads the compiled order, and the
 * second puts PoB's granted groups back in front, the order an earlier compile left in a saved build (the live test's
 * r1-b-3) and PoB's own for a build whose items went in before its groups. Every expected value comes from PoB (its
 * group list) or the compile record.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { NodePowerParams, NodePowerResult } from '../../src/engine/schemas';
import { clearEntryOf, type CompileRecord } from '../../src/plan/record';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'clear-group-granted', 'plan.json');
const ENGINE_TIMEOUT = 600_000;
const LOADOUT = 'A spear and a shield, a clear group after them (L80) {cg}';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

engineDescribe("WU-108: get_node_power's clear_group is the plan's group number, PoB's granted groups not counted (D-435; AC-P77)", () => {
  let f: SessionFixture;
  let record: CompileRecord;
  let plan: Json;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:clear-group-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function power(params: Omit<NodePowerParams, 'stats'>): Promise<NodePowerResult> {
    const full: NodePowerParams = { stats: ['FullDPS', 'TotalEHP'], ...params };
    const { value } = await f.session.run({ tool: 'test:node-power', kind: 'read' }, (ctx) => ctx.client.nodePower(full));
    return value;
  }

  /** The loadout's socket groups as PoB lists them: each one's label, first gem, and whether PoB added it (`source`). */
  async function pobGroups(): Promise<{ label: string; gem: string; granted: boolean }[]> {
    return lua(`
      build:SetActiveLoadout(build:GetLoadoutByName(${JSON.stringify(LOADOUT)}))
      local out = {}
      for i, g in ipairs(build.skillsTab.socketGroupList) do
        out[i] = { label = tostring(g.displayLabel or g.label or ''), gem = tostring(g.gemList[1] and g.gemList[1].nameSpec or ''),
          granted = g.source ~= nil }
      end
      return out`);
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const made = await f.call('guide_run', { new_run: 'clear-group-granted' });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.copyFileSync(FIXTURE, path.join(f.guides, planPath));
    plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    if (out.isError) throw new Error(`compile_plan failed: ${out.text}`);
    record = JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  /** The clear entry the record measured: group 2, Seismic Cry, its radius and uses per second at its first stat set. */
  function clearEntry(): { radius: number; uses: number } {
    const entry = clearEntryOf(plan.stages[0], record.stages.cg.skillOutputs, record.stages.cg);
    expect(entry).toMatchObject({ group: 2, key: 'g2s1p1', skill: 'Seismic Cry' });
    const radius = entry!.fields.AreaOfEffectRadiusMetres;
    const uses = entry!.fields.Speed;
    expect(radius).toBeGreaterThan(0);
    expect(uses).toBeGreaterThan(0);
    return { radius, uses };
  }

  /** The record's number for the group of `skill` (its breakdown key's group). */
  const recordNumber = (skill: string): number => {
    const key = Object.keys(record.stages.cg.skillOutputs).find((k) => record.stages.cg.skillOutputs[k].skill === skill)!;
    return Number(/^g(\d+)s/.exec(key)![1]);
  };

  it(
    "the compile lists the plan's groups first, PoB's own after them, and the record's group number for the clear group guards that group's skill (its radius and uses per second, as the record's clear entry)",
    async () => {
      const { radius, uses } = clearEntry();
      const groups = await pobGroups();
      expect(groups.map((g) => [g.gem, g.granted])).toEqual([
        ['Rapid Assault', false],
        ['Seismic Cry', false],
        ['Spear Throw', true],
        ['Raise Shield', true],
      ]);
      const r = await power({ loadout: LOADOUT, clearGroup: 2, limit: 0 });
      expect(r.clear).toMatchObject({ group: 2, label: 'Seismic Cry', radius, usesPerSecond: uses });
      const text = (await f.call('get_node_power', { loadout: LOADOUT, clear_group: 2, limit: 15 })).text;
      expect(text).toMatch(/\| clear group 2 \(Seismic Cry\): radius [\d.]+ m, [\d.]+ uses per second$/m);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "with PoB's granted groups listed before the plan's (the order an earlier compile left, as on the live test's r1-b-3), the record's number still guards the clear group's skill, not the granted skill PoB lists in its place; the default is the main group, and PoB's own groups are numbered after the build's own",
    async () => {
      const { radius, uses } = clearEntry();
      // PoB's own order for a build whose spear and shield went in before its groups: its granted groups first.
      const order = await lua<string[]>(`
        build:SetActiveLoadout(build:GetLoadoutByName(${JSON.stringify(LOADOUT)}))
        local groups = build.skillsTab.socketGroupList
        local own, mine = {}, {}
        for _, g in ipairs(groups) do
          if g.source then own[#own + 1] = g else mine[#mine + 1] = g end
        end
        for i, g in ipairs(own) do groups[i] = g end
        for k, g in ipairs(mine) do groups[#own + k] = g end
        build.mainSocketGroup = #own + 1
        build.buildFlag = true
        local out = {}
        for i, g in ipairs(groups) do out[i] = tostring(g.gemList[1] and g.gemList[1].nameSpec or '') end
        return out`);
      expect(order).toEqual(['Spear Throw', 'Raise Shield', 'Rapid Assault', 'Seismic Cry']);

      const r = await power({ loadout: LOADOUT, clearGroup: 2, limit: 0 });
      expect(r.clear).toMatchObject({ group: 2, label: 'Seismic Cry', radius, usesPerSecond: uses });
      // Not the figures of the skill PoB holds at index 2 (Raise Shield) or of the granted Spear Throw.
      for (const skill of ['Raise Shield', 'Spear Throw']) {
        const e = record.stages.cg.skillOutputs[`g${recordNumber(skill)}s1p1`];
        expect({ skill, same: e.fields.AreaOfEffectRadiusMetres === radius && e.fields.Speed === uses }).toEqual({ skill, same: false });
      }

      // Without clear_group: the main group, Rapid Assault, numbered 1 as the plan numbers it (PoB's index 3).
      const main = await power({ loadout: LOADOUT, limit: 0 });
      expect(main.clear).toMatchObject({ group: 1, label: 'Rapid Assault' });
      expect(await lua<number>('return build.mainSocketGroup')).toBe(3);

      // The record's number for Spear Throw's group (the plan's two groups, then PoB's own) selects that group.
      const number = recordNumber('Spear Throw');
      expect(number).toBe(3);
      const spear = await power({ loadout: LOADOUT, clearGroup: number, limit: 0 });
      expect(spear.clear.group).toBe(number);
      expect(spear.clear.usesPerSecond).toBe(record.stages.cg.skillOutputs[`g${number}s1p1`].fields.Speed);

      const failed = await f.call('get_node_power', { loadout: LOADOUT, clear_group: order.length + 1, limit: 0 });
      expect(failed.isError).toBe(true);
      expect(failed.text).toContain(`clear group ${order.length + 1}: the loadout's skill set has ${order.length} socket groups`);
    },
    ENGINE_TIMEOUT,
  );
});
