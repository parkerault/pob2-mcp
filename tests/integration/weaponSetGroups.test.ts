/**
 * WU-102 (amendment 9 §24.2; D-426, D-427): a skill on a weapon set (the plan's `skills.groups[].weaponSet`), the
 * record's `skillOutputsSet2`, V1's `empty-weapon-set`, `list_gems`' `skill_type` (C-56) and the clear measure's `travel`,
 * in process and engine-required. AC-W81's engine bullets.
 *
 * The fixture is `tests/fixtures/plans/weapon-set-groups/plan.json`, written from the pinned game data: a Warrior / Titan
 * at level 80, the tree of `tests/fixtures/plans/weapon-sets` (its stage 1, and for stage `p2` its stage 2 with the
 * passives tagged to each set), five endgame stages with no variant (card skeletons, so each has the pace measures):
 * - `ws`: a Slim Mace in set 1 and a Wooden Club in set 2 (`Data/Bases/mace.lua`: 11-17 at 1.55 attacks a second, 6-10
 *   at 1.45), Boneshatter on set 1 (`weaponSet: 1`, the main group), Rolling Slam on set 2 (`weaponSet: 2`, the clear
 *   group), Leap Slam on both (no `weaponSet`). Leap Slam's granted effect, `LeapSlamPlayer`, has PoB's Travel type
 *   (`Data/Skills/act_str.lua`), Rolling Slam's and Boneshatter's don't.
 * - `both`: the same items and groups with no `weaponSet`: today's compile, and set 2's only use the Swap-slot item.
 * - `g2`: a Slim Mace in set 1 and nothing in set 2's slots; Rolling Slam on set 2 is set 2's only use.
 * - `none`: no set-2 use and no travel skill (Boneshatter and Rolling Slam only).
 * - `p2`: one weapon, no `weaponSet`, two passives tagged to set 2: set 2's only use is its passives.
 * Every expected value comes from PoB itself (its weapon swap, the item set's `useSecondWeaponSet`, and its main socket
 * group, then a rebuild, as the items and skills tabs set them), from the saved XML, or from the game data's files.
 *
 * - AC-W81: a group with `weaponSet: 1` and one with `weaponSet: 2` compile with PoB's slots for their sets (`Weapon 1`,
 *   tagged set 1, and `Weapon 1 Swap`, tagged set 2, in PoB and in the saved file); each is enabled only while its set is
 *   active (PoB's `slotEnabled`, and its active skills); the stage records `skillOutputsSet2` with the set-2 group's
 *   figure and `skillOutputs` with the set-1 group's, each PoB's own on that set; a group with no `weaponSet` keeps
 *   today's figures (no slot, and the same figures as in a plan that names no set); a group on a set with no weapon
 *   fails V1 (`empty-weapon-set`).
 * - The coordinator's note (WU-101's verifier): each way a stage uses set 2 alone gives `outputsSet2` and
 *   `skillOutputsSet2`: a group on set 2 (`g2`), a Swap-slot item (`both`), set-2 passives (`p2`); `none` has neither.
 * - AC-W81: `list_gems` with `skill_type: "Travel"` returns the pin's Travel gems (the gems whose granted effect lists
 *   `SkillType.Travel` in the data files), ignoring case; an unknown type fails and lists PoB's types.
 * - AC-W81: a stage with a travel skill records `travel` with its uses per second (PoB's own `Speed` for it); a stage with
 *   none records `travel: null`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'weapon-set-groups', 'plan.json');
const POB_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const ENGINE_TIMEOUT = 600_000;
const WS = 'Groups on both weapon sets (L80) {ws}';
const BOTH = 'No group on a set (L80) {both}';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const close = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

/** The pin's gems whose granted effect has PoB's Travel skill type, read from the data files (not from the engine). */
function travelGems(): string[] {
  const travel = new Set<string>();
  const dir = path.join(POB_SRC, 'Data', 'Skills');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.lua'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of text.matchAll(/^skills\["([^"]+)"\] = \{([\s\S]*?)^\}/gm)) {
      const types = /^\tskillTypes = \{([^\n]*)\}/m.exec(m[2]);
      if (types && types[1].includes('[SkillType.Travel]')) travel.add(m[1]);
    }
  }
  const gems = fs.readFileSync(path.join(POB_SRC, 'Data', 'Gems.lua'), 'utf8');
  const names: string[] = [];
  for (const m of gems.matchAll(/^\t\["Metadata\/Items\/Gems\/[^"]+"\] = \{([\s\S]*?)^\t\},/gm)) {
    const id = /grantedEffectId = "([^"]+)"/.exec(m[1]);
    const name = /\n\t\tname = "([^"]+)"/.exec(m[1]);
    if (id && name && travel.has(id[1])) names.push(name[1]);
  }
  return names.sort();
}

/** The gem names a `list_gems` reply lists, one `**<name>** [...]` line each. */
const listed = (text: string) => [...text.matchAll(/^\*\*(.+)\*\* \[/gm)].map((m) => m[1]).sort();

engineDescribe('WU-102: a skill on a weapon set, skillOutputsSet2, the travel skill and skill_type (D-426, D-427; AC-W81)', () => {
  let f: SessionFixture;
  let run: { planPath: string; abs: string };
  let record: CompileRecord;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:weapon-set-groups-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  /**
   * A loadout's plan groups (the groups without a `source`, in order) as PoB holds them: each one's slot and its slot's
   * weapon set; with set 1 and with set 2 active, each one's `slotEnabled` and the player's active skills' names; and
   * PoB's own `fields` for each group as the main skill on each set (its first active skill, its main socket group, then
   * a rebuild). Everything it changes is put back.
   */
  async function pobGroups(loadout: string, fields: string[]): Promise<Json> {
    return lua(`
      local l = build:GetLoadoutByName(${JSON.stringify(loadout)})
      build:SetActiveLoadout(l)
      build.characterLevel = 80
      build.characterLevelAutoMode = false
      build.configTab:BuildModList()
      local set = build.itemsTab.activeItemSet
      local prior, priorMain = set.useSecondWeaponSet, build.mainSocketGroup
      local groups = {}
      for i, g in ipairs(build.skillsTab.socketGroupList) do
        if not g.source then groups[#groups + 1] = { index = i, g = g } end
      end
      local function rebuild()
        wipeGlobalCache()
        build.buildFlag = true
        build.calcsTab:BuildOutput()
      end
      local out = { slots = {}, slotSets = {}, enabled = {}, active = {}, figures = {} }
      for k, e in ipairs(groups) do
        out.slots[k] = e.g.slot or ''
        out.slotSets[k] = e.g.slot and build.itemsTab.slots[e.g.slot].weaponSet or 0
      end
      for _, two in ipairs({ false, true }) do
        local key = two and 'two' or 'one'
        set.useSecondWeaponSet = two
        build.mainSocketGroup = priorMain
        rebuild()
        local en, names = {}, {}
        for k, e in ipairs(groups) do en[k] = e.g.slotEnabled == true end
        for _, s in ipairs(build.calcsTab.mainEnv.player.activeSkillList) do
          names[#names + 1] = s.activeEffect.grantedEffect.name
        end
        out.enabled[key], out.active[key] = en, names
        local figs = {}
        for k, e in ipairs(groups) do
          build.mainSocketGroup = e.index
          e.g.mainActiveSkill = 1
          rebuild()
          local row = {}
          for _, field in ipairs({ ${fields.map((x) => JSON.stringify(x)).join(', ')} }) do row[field] = build.calcsTab.mainOutput[field] end
          figs[k] = row
        end
        out.figures[key] = figs
      end
      set.useSecondWeaponSet = prior
      build.mainSocketGroup = priorMain
      rebuild()
      return out`);
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const made = await f.call('guide_run', { new_run: 'weapon-set-groups' });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    run = { planPath, abs };
    fs.copyFileSync(FIXTURE, path.join(f.guides, planPath));
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    if (out.isError) throw new Error(`compile_plan failed: ${out.text}`);
    record = JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it(
    "AC-W81: groups with weaponSet 1 and 2 compile with PoB's slots for their sets, in PoB and in the saved file; a group with no weaponSet gets no slot",
    async () => {
      const ws = await pobGroups(WS, []);
      expect({ slots: ws.slots, sets: ws.slotSets }).toEqual({ slots: ['Weapon 1', 'Weapon 1 Swap', ''], sets: [1, 2, 0] });
      const both = await pobGroups(BOTH, []);
      expect({ slots: both.slots, sets: both.slotSets }).toEqual({ slots: ['', '', ''], sets: [0, 0, 0] });
      // The saved build keeps the slots: PoB writes a group's slot as its <Skill slot="…"> attribute.
      const xml = fs.readFileSync(path.join(run.abs, 'compiled-build.xml'), 'utf8');
      const skills = [...xml.matchAll(/<Skill\b[^>]*>/g)].map((m) => m[0]);
      const slotOf = (label: string) =>
        [...new Set(skills.filter((s) => s.includes(`label="${label}"`)).map((s) => /\bslot="([^"]*)"/.exec(s)?.[1] ?? ''))].sort();
      expect(slotOf('Boneshatter')).toEqual(['', 'Weapon 1']);
      expect(slotOf('Rolling Slam')).toEqual(['', 'Weapon 1 Swap']);
      expect(slotOf('Leap Slam')).toEqual(['']);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-W81: each group is enabled only while its set is active, by PoB's own slotEnabled and active skills; a group on no set is enabled on both",
    async () => {
      const ws = await pobGroups(WS, []);
      expect(ws.enabled).toEqual({ one: [true, false, true], two: [false, true, true] });
      // Rolling Slam, not the main skill, is among the player's skills only on set 2; Leap Slam on both. (PoB always
      // builds the main group, Boneshatter, so it is no evidence either way.)
      expect({ one: ws.active.one.includes('Rolling Slam'), two: ws.active.two.includes('Rolling Slam') }).toEqual({ one: false, two: true });
      expect({ one: ws.active.one.includes('Leap Slam'), two: ws.active.two.includes('Leap Slam') }).toEqual({ one: true, two: true });
      const both = await pobGroups(BOTH, []);
      expect(both.enabled).toEqual({ one: [true, true, true], two: [true, true, true] });
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-W81: the stage records skillOutputsSet2 with the set-2 group's figure and skillOutputs with the set-1 group's, each PoB's own on that set, keyed alike",
    async () => {
      const s = record.stages.ws;
      expect(s.skillOutputsSet2).toBeDefined();
      const set2 = s.skillOutputsSet2!;
      expect(Object.keys(set2).sort()).toEqual(Object.keys(s.skillOutputs).sort());
      const fields = ['TotalDPS', 'Speed'];
      const pob = await pobGroups(WS, fields);
      // Boneshatter (group 1, set 1) in skillOutputs; Rolling Slam (group 2, set 2) in skillOutputsSet2.
      expect(s.skillOutputs.g1s1p1.skill).toBe('Boneshatter');
      expect(set2.g2s1p1.skill).toBe('Rolling Slam');
      for (const field of fields) {
        expect({ field, set1: close(s.skillOutputs.g1s1p1.fields[field], pob.figures.one[0][field]) }).toEqual({ field, set1: true });
        expect({ field, set2: close(set2.g2s1p1.fields[field], pob.figures.two[1][field]) }).toEqual({ field, set2: true });
        // Leap Slam, on both sets, has its figure on each.
        expect({ field, one: close(s.skillOutputs.g3s1p1.fields[field], pob.figures.one[2][field]) }).toEqual({ field, one: true });
        expect({ field, two: close(set2.g3s1p1.fields[field], pob.figures.two[2][field]) }).toEqual({ field, two: true });
      }
      expect(s.skillOutputs.g1s1p1.fields.TotalDPS).toBeGreaterThan(0);
      expect(set2.g2s1p1.fields.TotalDPS).toBeGreaterThan(0);
      // Set 2's Wooden Club is slower than set 1's Slim Mace, so a skill's figure differs between the sets.
      expect(set2.g2s1p1.fields.Speed).toBeLessThan(s.skillOutputs.g2s1p1.fields.Speed);
      expect(set2.g3s1p1.fields.Speed).toBeLessThan(s.skillOutputs.g3s1p1.fields.Speed);
      // outputsSet2 rides on the same measure: the main output with set 2 active.
      expect(s.outputsSet2).toBeDefined();
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-W81: a group with no weaponSet keeps today's figures: Leap Slam's are the same as in the stage whose plan names no set",
    () => {
      const ws = record.stages.ws;
      const both = record.stages.both;
      expect(ws.skillOutputs.g3s1p1).toEqual(both.skillOutputs.g3s1p1);
      expect(ws.skillOutputsSet2!.g3s1p1).toEqual(both.skillOutputsSet2!.g3s1p1);
      // The set-1 group measured on its own set is unchanged too.
      expect(ws.skillOutputs.g1s1p1).toEqual(both.skillOutputs.g1s1p1);
    },
  );

  it(
    'AC-W81: a group on a set with no weapon fails V1 (empty-weapon-set); a group on a set holding a weapon, or on no set, does not',
    () => {
      const g2 = record.stages.g2;
      const empty = (id: string) => (record.stages[id].v1?.findings ?? []).filter((x) => x.code === 'empty-weapon-set');
      expect(g2.v1?.pass).toBe(false);
      expect(empty('g2')).toEqual([
        expect.objectContaining({
          code: 'empty-weapon-set',
          data: { group: 2, weaponSet: 2, slots: ['Weapon 1 Swap', 'Weapon 2 Swap'], path: 'skills.groups[1].weaponSet' },
        }),
      ]);
      expect(empty('g2')[0].message).toMatch(/^skill group 2 \(Rolling Slam\) is on weapon set 2 /);
      for (const id of ['ws', 'both', 'none', 'p2']) expect({ id, findings: empty(id) }).toEqual({ id, findings: [] });
    },
  );

  it(
    "each way a stage uses set 2, alone, gives outputsSet2 and skillOutputsSet2: a group on set 2 (g2), a Swap-slot item (both), set-2 passives (p2); a stage with none has neither",
    () => {
      const has = (id: string) => ({ id, outputsSet2: record.stages[id].outputsSet2 !== undefined, skillOutputsSet2: record.stages[id].skillOutputsSet2 !== undefined });
      for (const id of ['ws', 'g2', 'both', 'p2']) expect(has(id)).toEqual({ id, outputsSet2: true, skillOutputsSet2: true });
      expect(has('none')).toEqual({ id: 'none', outputsSet2: false, skillOutputsSet2: false });
      expect('skillOutputsSet2' in record.stages.none).toBe(false);
      // g2's only set-2 use is its group: no Swap-slot item and no set-2 passive.
      const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
      const st = (id: string) => plan.stages.find((s: Json) => s.id === id);
      expect(st('g2').items.slots.some((s: Json) => / Swap$/.test(s.slot))).toBe(false);
      expect(st('g2').tree.weaponSetNodes.set2).toEqual([]);
      expect(st('both').skills.groups.some((g: Json) => g.weaponSet !== undefined)).toBe(false);
      expect(st('both').tree.weaponSetNodes.set2).toEqual([]);
      expect(st('p2').items.slots.some((s: Json) => / Swap$/.test(s.slot))).toBe(false);
      expect(st('p2').skills.groups.some((g: Json) => g.weaponSet !== undefined)).toBe(false);
      expect(st('p2').tree.weaponSetNodes.set2.length).toBeGreaterThan(0);
    },
  );

  it(
    "AC-W81: list_gems with skill_type Travel returns the pin's Travel gems, ignoring case; an unknown type fails and lists PoB's types",
    async () => {
      const expected = travelGems();
      expect(expected).toContain('Leap Slam');
      const out = await f.call('list_gems', { skill_type: 'Travel', max_results: 200 });
      expect(out.isError).toBe(false);
      expect(listed(out.text)).toEqual(expected);
      expect(out.text).toContain('skill_type=Travel');
      const lower = await f.call('list_gems', { skill_type: 'travel', max_results: 200 });
      expect(listed(lower.text)).toEqual(expected);
      const bad = await f.call('list_gems', { skill_type: 'Nonsense' });
      expect(bad.isError).toBe(true);
      expect(bad.text).toMatch(/unknown skill type "Nonsense"; PoB's skill types are: .*\bTravel\b/);
      expect(bad.text).toMatch(/\bWarcry\b/);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-W81: a stage with a travel skill records travel with its uses per second, PoB's own Speed for it; a stage with none records travel null",
    async () => {
      const ws = record.stages.ws.measures!.clearSpeed;
      // The clear group is Rolling Slam (group 2, role clear); the travel skill is the first other group with the
      // Travel type, Leap Slam (group 3), on both sets, so its figure is skillOutputs'.
      expect(ws.group).toBe(2);
      expect(ws.travel).toEqual({ group: 3, skill: 'Leap Slam', usesPerSecond: record.stages.ws.skillOutputs.g3s1p1.fields.Speed });
      const pob = await pobGroups(WS, ['Speed']);
      expect(close(ws.travel!.usesPerSecond, pob.figures.one[2].Speed)).toBe(true);
      expect(ws.travel!.usesPerSecond).toBeGreaterThan(0);
      for (const id of ['both', 'g2', 'p2']) expect({ id, skill: record.stages[id].measures!.clearSpeed.travel?.skill }).toEqual({ id, skill: 'Leap Slam' });
      expect(record.stages.none.measures!.clearSpeed.travel).toBeNull();
    },
    ENGINE_TIMEOUT,
  );
});
