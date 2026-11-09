/**
 * AC-W134 (WU-152, amendment 16 §6, D-510, PG-106; engine, Lua-direct): the bridge's gem-group recount.
 *
 * PoB's skills tab counts a group against the skill slots once any enabled gem in it is granted by neither an item nor
 * the tree, supports included (`Classes/SkillsTab.lua`:1577-1582), so a support placed in a granted skill counts the
 * group (PG-106). The game's rule, which `pob-api/API/Patches.lua`'s PG-106 entry applies over PoB's own count: an
 * enabled group counts when its first enabled active gem (not a support) isn't granted; a group the compile marks
 * switched (`Patches.SWITCHED`, D-518) counts as if enabled.
 *
 * The fixtures (`tests/fixtures/builds/pg106-*.xml`) are written from the pinned game data, in PG-108's shape: a Witch
 * holding a Shrine Sceptre, "Grants Skill: Level 20 Purity of Ice" (`Data/Bases/sceptre.lua`:65-73), whose skill PoB
 * marks `fromItem` (`Data/Skills/act_int.lua`:16240), so PoB adds its own granted group from the sceptre; beside it
 * nine plain one-gem groups and a plain Purity of Ice copy carrying Clarity I, as an import writes one
 * (`Classes/ImportTab.lua`:1062-1078). `pg106-switched.xml` adds a tenth plain group, Shield Charge, disabled. The
 * skill slots are PoB's 9 (`Modules/CalcSetup.lua`:728). Every count is PoB's own `GlobalGemAssignments.GemGroupCount`
 * and every warning PoB's own line, read through the engine's `get_warnings` (which refreshes the count as every
 * calculation does, D-428).
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type LuaLineClient } from '../helpers/luaLineClient';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'builds');
const ENGINE_TIMEOUT = 180_000;

const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

/** PoB's skill-slot warning (`Modules/Build.lua`:2222), by its opening words. */
const SLOT_WARNING = 'You have too many gem groups allocated.';

interface Count {
  allowed: number;
  groups: number;
  /** PoB's lineage bookkeeping for the copy's support, which the wrap leaves PoB's. */
  clarity: number | false;
  /** Each group as PoB holds it: its label, its source, whether it's enabled, and its enabled gems' names. */
  list: Array<{ label: string; source: string | false; enabled: boolean; gems: string[] }>;
}

/** Marks the group labelled `label` switched, as the compile marks a group it writes disabled (D-518). */
const MARK = (label: string) => `
  local Patches = require('API.Patches')
  local marked = 0
  for _, g in ipairs(build.skillsTab.socketGroupList) do
    if g.label == ${JSON.stringify(label)} then g[Patches.SWITCHED] = true marked = marked + 1 end
  end
  return marked`;

/** PoB's skill slots, its group count, its lineage count of the copy's support, and its groups. */
const COUNT = `
  local list = {}
  for _, g in ipairs(build.skillsTab.socketGroupList) do
    local gems = {}
    for _, gem in ipairs(g.gemList) do
      if gem.enabled then gems[#gems + 1] = gem.gemData and gem.gemData.name or gem.nameSpec end
    end
    list[#list + 1] = { label = g.label or '', source = g.source or false, enabled = g.enabled == true, gems = gems }
  end
  return {
    allowed = build.calcsTab.mainEnv.modDB:Sum('BASE', nil, 'SkillSlots'),
    groups = GlobalGemAssignments.GemGroupCount,
    clarity = GlobalGemAssignments['Clarity I'] and GlobalGemAssignments['Clarity I'].count or false,
    list = list,
  }`;

engineDescribe('AC-W134 (WU-152): the gem-group recount, by the game\'s rule (D-510, PG-106)', () => {
  let engine: LuaLineClient;

  const evalLua = async <T>(code: string): Promise<T> => {
    const reply = await engine.request('__test_eval', { code }, { timeoutMs: 120_000 });
    expect({ ok: reply.ok, error: reply.error }).toEqual({ ok: true, error: undefined });
    return reply.result as T;
  };

  const load = async (file: string): Promise<void> => {
    const reply = await engine.request('load_build_xml', { xml: fixture(file), name: file }, { timeoutMs: 120_000 });
    expect({ file, ok: reply.ok, error: reply.error }).toEqual({ file, ok: true, error: undefined });
  };

  /** PoB's warning lines, through the engine's own read (the recount runs in its refresh). */
  const warnings = async (): Promise<string[]> => {
    const reply = await engine.request('get_warnings', {}, { timeoutMs: 120_000 });
    expect({ ok: reply.ok, error: reply.error }).toEqual({ ok: true, error: undefined });
    return (reply.result as { lines: string[] }).lines;
  };

  /** PoB's warnings, read through the engine (its refresh recounts), then PoB's count. */
  const measure = async (): Promise<{ count: Count; slotWarnings: string[] }> => {
    const lines = await warnings();
    const count = await evalLua<Count>(COUNT);
    return { count, slotWarnings: lines.filter((l) => l.startsWith(SLOT_WARNING)) };
  };

  beforeAll(async () => {
    engine = await startLuaLineClient({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await engine?.close();
  });

  it(
    'nine plain groups and a plain Purity of Ice copy with a support: PoB\'s count is 9 against its 9 slots, and the build has no skill-slot warning',
    async () => {
      await load('pg106-purity-copy.xml');
      const { count, slotWarnings } = await measure();
      // The fixture as PoB holds it: nine plain groups, the copy with its support, and PoB's own group from the sceptre.
      expect(count.list.filter((g) => !g.source && g.gems.length === 1).map((g) => g.label)).toHaveLength(9);
      expect(count.list.filter((g) => g.label === 'Purity of Ice copy')).toEqual([
        { label: 'Purity of Ice copy', source: false, enabled: true, gems: ['Purity of Ice', 'Clarity I'] },
      ]);
      expect(count.list.filter((g) => g.source).map((g) => ({ source: /^Item:1:/.test(String(g.source)), gems: g.gems })))
        .toEqual([{ source: true, gems: ['Purity of Ice'] }]);
      expect({ allowed: count.allowed, groups: count.groups, slotWarnings }).toEqual({ allowed: 9, groups: 9, slotWarnings: [] });
      // PoB's lineage bookkeeping is PoB's own: the copy's support is counted once.
      expect(count.clarity).toBe(1);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'with a tenth plain group disabled and marked switched, the count is 10 and PoB warns past its 9 slots; unmarked, the disabled group counts nothing',
    async () => {
      await load('pg106-switched.xml');
      const unmarked = await measure();
      expect(unmarked.count.list.filter((g) => g.label === 'Switched').map((g) => g.enabled)).toEqual([false]);
      expect({ groups: unmarked.count.groups, slotWarnings: unmarked.slotWarnings }).toEqual({ groups: 9, slotWarnings: [] });

      // The mark's name, fixed here for the compile to set (WU-161).
      expect(await evalLua<string>(`return require('API.Patches').SWITCHED`)).toBe('pob2Switched');
      expect(await evalLua<number>(MARK('Switched'))).toBe(1);
      const marked = await measure();
      expect(marked.count.groups).toBe(10);
      expect(marked.slotWarnings).toEqual([`${SLOT_WARNING} Max allowed is 9. You have 10 non-item/non-granted gem groups allocated.`]);
    },
    ENGINE_TIMEOUT,
  );

  describe('with the patch reverted', () => {
    let pobOwn: number | undefined;

    it(
      "reverts PG-106, reads PoB's own count of the first fixture, and applies the patch again",
      async () => {
        expect(await evalLua<string[]>(`return require('API.Patches').applied()`)).toContain('PG-106');
        try {
          expect(await evalLua<boolean>(`return require('API.Patches').revert('PG-106')`)).toBe(true);
          await load('pg106-purity-copy.xml');
          pobOwn = (await measure()).count.groups;
        } finally {
          await evalLua(`require('API.Patches').apply('PG-106') return true`);
        }
        expect(await evalLua<string[]>(`return require('API.Patches').applied()`)).toContain('PG-106');
        expect((await measure()).count.groups).toBe(9);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "with the patch reverted, PoB's own count of the first fixture is 10 (if this fails, PoB no longer counts a granted skill's supports: remove PG-106's entry from pob-api/API/Patches.lua)",
      () => {
        expect(pobOwn).toBe(10);
      },
    );
  });
});
