/**
 * WU-102's fix round (B1; D-426, §24.2, PG-74): a group on a weapon set is socketed in that set's weapon slot whose item
 * grants no skill, so PoB doesn't give the weapon's granted skill the group's supports; when both of the set's slots
 * hold an item that grants a skill, the main hand, and V1's `weapon-skill-supports` names the skill whose figure PoB
 * overstates. In process and engine-required.
 *
 * PG-74: PoB gives an item-granted skill's group (one with a `source`) the supports of every group processed in the same
 * slot, " Swap" stripped (`Modules/CalcSetup.lua:1727-1732`, `:1913-1928`); the game doesn't.
 *
 * The fixture is `tests/fixtures/plans/weapon-set-slots/plan.json`, written from the pinned game data: a Warrior / Titan at
 * level 80 (the tree of `tests/fixtures/plans/weapon-sets`' stage 1), one group of Rapid Assault and Brutality I (a
 * support), four endgame stages with no variant:
 * - `on`: a Hardwood Spear in Weapon 1, whose base implicit is "Grants Skill: Spear Throw" (`Data/Bases/spear.lua`), and
 *   nothing in Weapon 2; the group on set 1 (`weaponSet: 1`). `off`: the same with no `weaponSet`.
 * - `fb`: the spear and a Splintered Tower Shield in Weapon 2 ("Grants Skill: Raise Shield", `Data/Bases/shield.lua`);
 *   the group on set 1. `fbn`: the same with no `weaponSet`.
 * Every expected value comes from PoB itself (the group's slot and slotEnabled, its own figure for Spear Throw as the main
 * skill, with the group's slot as compiled and moved), from the record of the plan without `weaponSet`, or from the data.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'weapon-set-slots', 'plan.json');
const ENGINE_TIMEOUT = 600_000;
const ON = 'A group on set 1 beside a spear (L80) {on}';
const FB = 'A group on set 1 beside a spear and a shield (L80) {fb}';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

engineDescribe('WU-102 fix round: a group on a weapon set takes the slot whose item grants no skill (PG-74)', () => {
  let f: SessionFixture;
  let record: CompileRecord;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:weapon-set-slots-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  /**
   * A loadout's plan group as PoB holds it (its slot, the slot's weapon set, its slotEnabled with set 1 and with set 2
   * active) and Spear Throw's TotalDPS as the main skill, PoB's own group for the spear's granted skill: with the plan
   * group where the compile put it, and with it moved to `moveTo` (then put back).
   */
  async function pob(loadout: string, moveTo?: string): Promise<Json> {
    return lua(`
      local l = build:GetLoadoutByName(${JSON.stringify(loadout)})
      build:SetActiveLoadout(l)
      build.characterLevel = 80
      build.characterLevelAutoMode = false
      build.configTab:BuildModList()
      local set = build.itemsTab.activeItemSet
      local priorMain = build.mainSocketGroup
      local function rebuild()
        wipeGlobalCache()
        build.buildFlag = true
        build.calcsTab:BuildOutput()
      end
      rebuild()
      local plan, spear
      for i, g in ipairs(build.skillsTab.socketGroupList) do
        if not g.source and not plan then plan = g end
        if g.source and g.gemList[1] and g.gemList[1].nameSpec == 'Spear Throw' then spear = i end
      end
      local out = { slot = plan.slot or '', slotSet = plan.slot and build.itemsTab.slots[plan.slot].weaponSet or 0, enabled = {} }
      for _, two in ipairs({ false, true }) do
        set.useSecondWeaponSet = two
        rebuild()
        out.enabled[two and 'two' or 'one'] = plan.slotEnabled == true
      end
      set.useSecondWeaponSet = false
      local function spearDps()
        build.mainSocketGroup = spear
        build.skillsTab.socketGroupList[spear].mainActiveSkill = 1
        rebuild()
        return build.calcsTab.mainOutput.TotalDPS
      end
      out.spear = spear ~= nil
      if spear then
        out.spearDps = spearDps()
        ${moveTo === undefined ? '' : `local was = plan.slot
        plan.slot = ${JSON.stringify(moveTo)}
        out.movedDps = spearDps()
        plan.slot = was`}
      end
      build.mainSocketGroup = priorMain
      rebuild()
      return out`);
  }

  /** A stage's breakdown entries for Spear Throw, by key, as the record holds them. */
  const spearEntries = (id: string) =>
    Object.fromEntries(Object.entries(record.stages[id].skillOutputs).filter(([, e]) => e.skill === 'Spear Throw'));

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const made = await f.call('guide_run', { new_run: 'weapon-set-slots' });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.copyFileSync(FIXTURE, path.join(f.guides, planPath));
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    if (out.isError) throw new Error(`compile_plan failed: ${out.text}`);
    record = JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it(
    "beside a spear, whose Spear Throw is granted, a group on set 1 is socketed in set 1's off-hand slot (Weapon 2, empty), which PoB ties to set 1",
    async () => {
      const on = await pob(ON);
      expect({ slot: on.slot, slotSet: on.slotSet, enabled: on.enabled, spear: on.spear }).toEqual({
        slot: 'Weapon 2',
        slotSet: 1,
        enabled: { one: true, two: false },
        spear: true,
      });
    },
    ENGINE_TIMEOUT,
  );

  it(
    "the spear's Spear Throw keeps the figure it has in the same plan without weaponSet; in the main hand the group's supports would raise it (PG-74)",
    async () => {
      const on = spearEntries('on');
      expect(Object.keys(on).length).toBeGreaterThan(0);
      expect(on).toEqual(spearEntries('off'));
      // PoB's own Spear Throw as compiled equals the record's, and moving the group into the spear's slot raises it:
      // the leak the slot pick avoids.
      const pobOn = await pob(ON, 'Weapon 1');
      const key = Object.keys(on).find((k) => k.endsWith('p1'))!;
      expect(Math.abs(pobOn.spearDps - on[key].fields.TotalDPS)).toBeLessThanOrEqual(1e-9 * Math.max(1, pobOn.spearDps));
      expect(pobOn.spearDps).toBeGreaterThan(0);
      expect(pobOn.movedDps).toBeGreaterThan(pobOn.spearDps);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "with a spear and a shield, both granting a skill, the group goes to the main hand, and V1's weapon-skill-supports names Spear Throw, whose figure PoB overstates",
    async () => {
      const fb = await pob(FB);
      expect({ slot: fb.slot, slotSet: fb.slotSet }).toEqual({ slot: 'Weapon 1', slotSet: 1 });
      const found = (id: string) => (record.stages[id].v1?.findings ?? []).filter((x) => x.code === 'weapon-skill-supports');
      expect(found('fb')).toEqual([
        expect.objectContaining({
          code: 'weapon-skill-supports',
          data: { group: 1, weaponSet: 1, slot: 'Weapon 1', skills: ['Spear Throw'], supports: ['Brutality I'], path: 'skills.groups[0].weaponSet' },
        }),
      ]);
      expect(found('fb')[0].message).toMatch(/^skill group 1 \(Rapid Assault\) is on weapon set 1, and both of its weapon slots hold an item that grants a skill \(Weapon 1: Spear Throw; Weapon 2: Raise Shield\)/);
      expect(record.stages.fb.v1?.pass).toBe(false);
      for (const id of ['on', 'off', 'fbn']) expect({ id, found: found(id) }).toEqual({ id, found: [] });
      // PoB does overstate it: Spear Throw's figure beside the group in its slot exceeds the same plan's without weaponSet.
      const key = Object.keys(spearEntries('fb')).find((k) => k.endsWith('p1'))!;
      expect(spearEntries('fb')[key].fields.TotalDPS).toBeGreaterThan(spearEntries('fbn')[key].fields.TotalDPS);
    },
    ENGINE_TIMEOUT,
  );

  it("stages whose items pick different slots for the same groups don't share a skill set; stages with no weaponSet share as before", () => {
    const skillSets = record.sets.filter((s) => s.kind === 'skill').map((s) => [...s.stages].sort());
    expect(skillSets).toContainEqual(['on']);
    expect(skillSets).toContainEqual(['fb']);
    expect(skillSets).toContainEqual(['fbn', 'off']);
  });
});
