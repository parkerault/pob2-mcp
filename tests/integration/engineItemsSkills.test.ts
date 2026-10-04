/**
 * Engine ops: items, gems, skills (WU-11) on the golden build: AC-E35, AC-E36, AC-E37, AC-E39, AC-E40 and
 * AC-E41, engine-required and in process.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handlers, session,
 * bridge and luajit) over a private builds folder holding the golden build. Tool outputs are read
 * through MCP; engine replies through the session's bridge client (`session.run`); independent checks
 * are Lua queries (`__test_eval`) against PoB's own state and functions.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { EngineKind } from '../../src/engine/session';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import type { SupportCandidatesResult } from '../../src/engine/schemas';

const ENGINE_TIMEOUT = 240_000;
const RUBY_RING = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'items', 'ruby-ring.txt'), 'utf8');

/** `Key: value` lines of a tool's text, as a map (the last occurrence wins). */
function statLines(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split('\n')) {
    const m = /^(\w+): (.+)$/.exec(line);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

/** The `<Slot>` start tag for `name` inside the export's ItemSet. */
function exportSlot(xml: string, name: string): string {
  const tags = [...xml.matchAll(/<Slot\b[^>]*>/g)].map((m) => m[0]).filter((t) => t.includes(`name="${name}"`));
  expect(tags).toHaveLength(1);
  return tags[0];
}

/**
 * The Lua cross-check of a group's candidate pool: every non-legacy support gem in `data.gems` that
 * `calcLib.canGrantedEffectSupportActiveSkill` accepts for one of the group's active skills
 * (`displaySkillList`), minus the supports already in the group. Sorted names.
 */
function calcLibPoolQuery(groupIndex: number): string {
  return `
    local group = build.skillsTab.socketGroupList[${groupIndex}]
    local inGroup = {}
    for _, gem in ipairs(group.gemList) do
      if gem.gemData and gem.gemData.grantedEffect.support then inGroup[gem.gemData.name] = true end
    end
    local names = {}
    for _, gemData in pairs(build.data.gems) do
      local ge = gemData.grantedEffect
      if ge.support and not ge.legacy and not inGroup[gemData.name] then
        for _, activeSkill in ipairs(group.displaySkillList) do
          if calcLib.canGrantedEffectSupportActiveSkill(ge, activeSkill) then
            table.insert(names, gemData.name)
            break
          end
        end
      end
    end
    table.sort(names)
    return names`;
}

engineDescribe('engine ops: items, gems, skills on the golden build (WU-11)', () => {
  let f: SessionFixture;

  async function run<T>(kind: EngineKind, fn: (client: PoBLuaApiClient) => Promise<T>): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:engine-items-skills', kind }, (ctx) => fn(ctx.client));
    return value;
  }

  async function luaQuery<T>(code: string): Promise<T> {
    return run('read', async (client) => (await client.request('__test_eval', { code })).result as T);
  }

  async function candidates(groupIndex: number): Promise<SupportCandidatesResult> {
    return run('read', async (client) => (await client.request('list_support_candidates', { groupIndex })).result);
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  beforeEach(async () => {
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
  }, ENGINE_TIMEOUT);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await f?.close();
  });

  it(
    'AC-E35: add_item with the ruby ring into Ring 1 changes at least one lua_get_stats stat; add_multiple_items with two items reports both added',
    async () => {
      const before = statLines((await f.call('lua_get_stats')).text);
      expect(before.size).toBeGreaterThan(5);

      const added = await f.call('add_item', { item_text: RUBY_RING, slot_name: 'Ring 1' });
      expect(added.isError).toBe(false);
      expect(added.text).toContain('Ruby Ring');
      expect(added.text).toContain('→ Ring 1');

      const after = statLines((await f.call('lua_get_stats')).text);
      const changed = [...before.keys()].filter((k) => after.get(k) !== before.get(k));
      expect(changed.length).toBeGreaterThanOrEqual(1);

      // The engine has the ring in Ring 1 (its own item list, not the tool's text).
      const ring1 = (await run('read', (c) => c.getItems())).find((i) => i.slot === 'Ring 1');
      expect(ring1?.baseName).toBe('Ruby Ring');

      // Two items in one call: both reported, and both equipped where asked.
      const multi = await f.call('add_multiple_items', {
        items: [
          { item_text: RUBY_RING, slot_name: 'Ring 1' },
          { item_text: RUBY_RING, slot_name: 'Ring 2' },
        ],
      });
      expect(multi.isError).toBe(false);
      expect(multi.text).toContain('Added 2 items');
      expect(multi.text).toContain('→ Ring 1');
      expect(multi.text).toContain('→ Ring 2');
      const items = await run('read', (c) => c.getItems());
      const ringIds = ['Ring 1', 'Ring 2'].map((slot) => items.find((i) => i.slot === slot));
      expect(ringIds.map((i) => i?.baseName)).toEqual(['Ruby Ring', 'Ruby Ring']);
      expect(ringIds[0]?.id).not.toBe(ringIds[1]?.id);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E36: add_gem "Brutality" is an error listing a suggestion that starts with Brutality; a known gem name is added and get_skill_setup shows it',
    async () => {
      const groupBefore = await luaQuery<number>('return #build.skillsTab.socketGroupList[1].gemList');

      const unknown = await f.call('add_gem', { group_index: 1, gem_name: 'Brutality' });
      expect(unknown.isError).toBe(true);
      const suggested = /Did you mean: (.+)$/m.exec(unknown.text);
      expect(suggested).not.toBeNull();
      const names = suggested![1].split(', ');
      expect(names.length).toBeGreaterThanOrEqual(1);
      expect(names.length).toBeLessThanOrEqual(5);
      expect(names.some((n) => n.startsWith('Brutality'))).toBe(true);
      // Rejected means not added.
      expect(await luaQuery<number>('return #build.skillsTab.socketGroupList[1].gemList')).toBe(groupBefore);

      // A suggested name is a real gem: it is added, and the engine resolved it to PoB's gem data.
      const known = names.find((n) => n.startsWith('Brutality'))!;
      const added = await f.call('add_gem', { group_index: 1, gem_name: known });
      expect(added.isError).toBe(false);
      const setup = await f.call('get_skill_setup', { main_only: false });
      expect(setup.isError).toBe(false);
      const group1 = setup.text.split('**Group ').find((s) => /^1( \(MAIN\))?\*\*/.test(s))!;
      expect(group1).toContain(known);
      const resolved = await luaQuery<string | null>(
        `local gl = build.skillsTab.socketGroupList[1].gemList; local g = gl[#gl]; return g.gemData and g.gemData.name`,
      );
      expect(resolved).toBe(known);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E37: toggle_flask\'s slot enum is Flask 1-2 / Charm 1-3; toggling Charm 1 on sets get_items active (slot.active) and the export\'s ItemSet Slot active="true"; off reverts both',
    async () => {
      const tools = await f.server.client.listTools();
      const toggle = tools.tools.find((t) => t.name === 'toggle_flask')!;
      const props = toggle.inputSchema.properties as Record<string, { enum?: string[] }>;
      expect(props.slot.enum).toEqual(['Flask 1', 'Flask 2', 'Charm 1', 'Charm 2', 'Charm 3']);

      const slotActive = () => luaQuery<boolean>(`return build.itemsTab.slots['Charm 1'].active == true`);
      const reported = async () => (await run('read', (c) => c.getItems())).find((i) => i.slot === 'Charm 1')?.active;
      const exported = async () => exportSlot(await run('read', (c) => c.exportBuildXml()), 'Charm 1');

      // The golden build loads every charm inactive.
      expect(await slotActive()).toBe(false);
      expect(await reported()).toBe(false);
      expect(await exported()).not.toContain('active="true"');

      const on = await f.call('toggle_flask', { slot: 'Charm 1', active: true });
      expect(on.isError).toBe(false);
      expect(on.text).toContain('Charm 1 activated');
      expect(await slotActive()).toBe(true);
      expect(await reported()).toBe(true);
      expect(await exported()).toContain('active="true"');

      const off = await f.call('toggle_flask', { slot: 'Charm 1', active: false });
      expect(off.isError).toBe(false);
      expect(await slotActive()).toBe(false);
      expect(await reported()).toBe(false);
      expect(await exported()).not.toContain('active="true"');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E39 (i, ii) and analyze_skills: on the main socket group, suggest_supports measures exactly the list_support_candidates pool (= the calcLib.canGrantedEffectSupportActiveSkill set) and orders by delta, ties by name; analyze_skills lists the same set',
    async () => {
      const main = await luaQuery<number>('return build.mainSocketGroup');
      expect(main).toBe(11);

      // (i) list_support_candidates = PoB's own check, run independently in Lua.
      const pool = await candidates(main);
      const poolNames = pool.candidates.map((c) => c.name).sort();
      expect(poolNames.length).toBeGreaterThan(20);
      expect(poolNames).toEqual(await luaQuery<string[]>(calcLibPoolQuery(main)));

      // suggest_supports, with every bridge request recorded on the real client.
      const calls: Array<{ action: string; params: unknown; reply: any }> = [];
      const original = PoBLuaApiClient.prototype.request;
      jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, ...args: any[]) {
        const reply = await (original as any).apply(this, args);
        calls.push({ action: args[0], params: args[1], reply });
        return reply;
      } as any);
      const suggested = await f.call('suggest_supports', { group_index: main, count: 20 });
      jest.restoreAllMocks();
      expect(suggested.isError).toBe(false);

      const measuredCalls = calls.filter((c) => c.action === 'list_support_candidates');
      expect(measuredCalls).toHaveLength(1);
      expect(measuredCalls[0].params).toEqual({ groupIndex: main, measure: true });
      const measured = measuredCalls[0].reply.result as SupportCandidatesResult;
      // The pool suggest_supports measured is exactly list_support_candidates' set.
      expect(measured.candidates.map((c) => c.name).sort()).toEqual(poolNames);
      expect(suggested.text).toContain(`Candidate pool: ${poolNames.length} support gems`);
      expect(measured.measured?.groupIndex).toBe(main);
      for (const c of measured.candidates) expect(typeof c.delta).toBe('number');

      // (ii) Results ordered by measured delta descending, ties by name.
      const expected = [...measured.candidates]
        .sort((a, b) => (b.delta! - a.delta!) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, 20)
        .map((c) => c.name);
      const listed = [...suggested.text.matchAll(/^\d+\. \*\*(.+?)\*\* — /gm)].map((m) => m[1]);
      expect(listed).toEqual(expected);
      const deltas = listed.map((n) => measured.candidates.find((c) => c.name === n)!.delta!);
      for (let i = 1; i < deltas.length; i++) expect(deltas[i]).toBeLessThanOrEqual(deltas[i - 1]);

      // analyze_skills lists, for the main group, the same candidate set.
      const analysis = await f.call('analyze_skills');
      expect(analysis.isError).toBe(false);
      const section = analysis.text.split('## Group ').find((s) => s.startsWith(`${main}:`))!;
      expect(section).toContain('[MAIN]');
      const listLine = /Compatible supports not in this group \((\d+), PoB's own check\):\n\s+(.+)/.exec(section);
      expect(listLine).not.toBeNull();
      expect(Number(listLine![1])).toBe(poolNames.length);
      expect(listLine![2].split('; ').sort()).toEqual(poolNames);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E39 (iii): suggest_supports on a group that is not the main one measures on that group (a Lua hook records the main socket group whenever a candidate is being calculated) and leaves the build unchanged',
    async () => {
      const main = await luaQuery<number>('return build.mainSocketGroup');
      const target = 3;
      expect(target).not.toBe(main);
      const before = await run('read', (c) => c.getStats(['CombinedDPS', 'Life']));
      const lengthBefore = await luaQuery<number>(`return #build.skillsTab.socketGroupList[${target}].gemList`);

      // Every CALCULATOR-mode environment PoB builds during the call records the main socket group and
      // whether the target group holds an extra gem (a candidate under measurement).
      await luaQuery(`
        local calcs = build.calcsTab.calcs
        _G.__wu11_seen = {}
        _G.__wu11_initEnv = _G.__wu11_initEnv or calcs.initEnv
        calcs.initEnv = function(b, mode, ...)
          if mode == 'CALCULATOR' then
            table.insert(_G.__wu11_seen, { main = b.mainSocketGroup, len = #b.skillsTab.socketGroupList[${target}].gemList })
          end
          return _G.__wu11_initEnv(b, mode, ...)
        end
        return true`);
      let suggested: Awaited<ReturnType<SessionFixture['call']>>;
      try {
        suggested = await f.call('suggest_supports', { group_index: target, count: 5 });
      } finally {
        await luaQuery('build.calcsTab.calcs.initEnv = _G.__wu11_initEnv; return true');
      }
      expect(suggested.isError).toBe(false);
      expect(suggested.text).toContain(`Measured on group ${target} as the main skill`);

      const seen = await luaQuery<Array<{ main: number; len: number }>>('return _G.__wu11_seen');
      const measuring = seen.filter((s) => s.len > lengthBefore);
      const pool = await candidates(target);
      expect(measuring.length).toBeGreaterThanOrEqual(pool.candidates.length);
      expect(new Set(measuring.map((s) => s.main))).toEqual(new Set([target]));

      // The top delta matches an independent full recalculation on the target group as main skill.
      const top = /^1\. \*\*(.+?)\*\* — ([+-][\d,.]+) /m.exec(suggested.text)!;
      expect(top).not.toBeNull();
      const reportedDelta = Number(top[2].replace(/,/g, ''));
      const name = top[1].replace(/'/g, "\\'");
      const independent = await luaQuery<number>(`
        local group = build.skillsTab.socketGroupList[${target}]
        local gemData
        for _, gd in pairs(build.data.gems) do if gd.name == '${name}' then gemData = gd end end
        local orig = build.mainSocketGroup
        build.mainSocketGroup = ${target}
        build.calcsTab:BuildOutput()
        local base = build.calcsTab.mainOutput.CombinedDPS
        table.insert(group.gemList, { level = build.skillsTab:ProcessGemLevel(gemData), quality = 0, count = 1,
          enabled = true, enableGlobal1 = true, enableGlobal2 = true, gemId = gemData.id, nameSpec = gemData.name,
          skillId = gemData.grantedEffectId, gemData = gemData })
        build.calcsTab:BuildOutput()
        local with = build.calcsTab.mainOutput.CombinedDPS
        table.remove(group.gemList)
        build.mainSocketGroup = orig
        build.calcsTab:BuildOutput()
        return with - base`);
      expect(Math.abs(reportedDelta - independent)).toBeLessThanOrEqual(Math.max(0.1, Math.abs(independent) * 0.001));

      // The build is as it was: main group, gem lists and stats.
      expect(await luaQuery<number>('return build.mainSocketGroup')).toBe(main);
      expect(await luaQuery<number>(`return #build.skillsTab.socketGroupList[${target}].gemList`)).toBe(lengthBefore);
      expect(await run('read', (c) => c.getStats(['CombinedDPS', 'Life']))).toEqual(before);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E40: lua_new_build {class_name:"Monk", ascendancy:"Invoker"} -> lua_get_build_info shows Monk / Invoker',
    async () => {
      const created = await f.call('lua_new_build', { class_name: 'Monk', ascendancy: 'Invoker' });
      expect(created.isError).toBe(false);
      expect(created.text).toContain('Monk / Invoker');

      const info = await f.call('lua_get_build_info');
      expect(info.isError).toBe(false);
      expect(info.text).toContain('Class: Monk');
      expect(info.text).toContain('Ascendancy: Invoker');
      // PoB's own spec agrees.
      expect(await luaQuery<string[]>('return { build.spec.curClassName, build.spec.curAscendClassName }')).toEqual([
        'Monk',
        'Invoker',
      ]);

      // A name the class doesn't have is an error and leaves the engine's build alone.
      const wrong = await f.call('lua_new_build', { class_name: 'Monk', ascendancy: 'Deadeye' });
      expect(wrong.isError).toBe(true);
      expect(wrong.text).toContain('Invoker');
      expect(await luaQuery<string[]>('return { build.spec.curClassName, build.spec.curAscendClassName }')).toEqual([
        'Monk',
        'Invoker',
      ]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E41: lua_get_stats shows EvadeChance and DeflectChance lines on the golden build',
    async () => {
      const stats = await f.call('lua_get_stats');
      expect(stats.isError).toBe(false);
      const engine = await run('read', (c) => c.getStats(['EvadeChance', 'DeflectChance']));
      expect(stats.text).toMatch(new RegExp(`^EvadeChance: ${engine.EvadeChance}$`, 'm'));
      expect(stats.text).toMatch(new RegExp(`^DeflectChance: ${engine.DeflectChance}$`, 'm'));
      expect(stats.text).not.toContain('EvasionChance');

      const defense = await f.call('lua_get_stats', { category: 'defense' });
      expect(defense.isError).toBe(false);
      expect(defense.text).toMatch(/^EvadeChance: /m);
      expect(defense.text).toMatch(/^DeflectChance: /m);
    },
    ENGINE_TIMEOUT,
  );
});
