/**
 * M-19 (D-398): a load names the supports PoB drops from a granted skill's socket group. In process and
 * engine-required.
 *
 * PoB v0.23.1 rebuilds a granted skill's group (a passive's or an item's) from its grant on every calculation
 * (`Modules/CalcSetup.lua:1503-1542`): a matched group's gem list is wiped back to the granted gem, and a group
 * whose gem level differs from the grant is removed for a new one. So a file that keeps supports in such a group
 * loses them on load. Every tool path that loads or imports a build file (a file load, a reload, an import from a
 * code, the session's reload of a file changed on disk, a temporary load of a file) then carries one warning line
 * per group, naming the dropped gems, the group and the passive or item that grants it; a temporary load's lines
 * name the file too, so compare_builds' two files tell apart. A group nothing grants (its passive isn't
 * allocated) is removed with its supports: its line says so and doesn't name the granted skill. A load that drops
 * nothing says nothing new.
 *
 * The fixture `granted-supports.xml` is written from the game data: a Mercenary with the Gemling Legionnaire
 * passive Essence of Virtue (node 11641, "Grants Skill: Virtuous Barrier", through node 34882), whose granted
 * group holds Virtuous Barrier with Precision I and Clarity I; a Stoic Sceptre ("Grants Skill: Level 10
 * Discipline") in Weapon 1, whose granted group holds Discipline with Precision II and Clarity II; and a socketed
 * Flash Grenade group with Heft that PoB keeps. The golden build's granted group holds no support. The
 * independent check is PoB's own state (`__test_eval`): each granted group holds only its granted skill.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { GOLDEN_XML, startSessionFixture, writeBuild, type SessionFixture } from '../helpers/engineSession';
import { encodePobCode } from '../../src/utils/buildCode';

const ENGINE_TIMEOUT = 240_000;
const FIXTURE = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'builds', 'granted-supports.xml'), 'utf8');
/** The fixture with the passive's granted gem at level 20 against the grant's 1: PoB's unmatched-group path. */
const FIXTURE_LEVEL_20 = FIXTURE.replace(
  'variantId="AscendancyGemlingVirtuousBarrier" level="1"',
  'variantId="AscendancyGemlingVirtuousBarrier" level="20"',
);
/** The fixture without Essence of Virtue allocated: nothing grants Virtuous Barrier. */
const FIXTURE_UNALLOCATED = FIXTURE.replace('nodes="34882,11641"', 'nodes="34882"');

const REASON = ": PoB rebuilds a granted skill's group from its grant on every calculation, so no figure includes them.";
const TREE =
  'PoB dropped Precision I, Clarity I from the group "Virtuous Barrier", granted by the passive Essence of Virtue ' +
  `(node 11641)${REASON}`;
const ITEM = `PoB dropped Precision II, Clarity II from the group "Discipline", granted by the item Stoic Sceptre${REASON}`;
const WARNINGS = [`Warning: ${TREE}`, `Warning: ${ITEM}`];

/** The reply's D-398 lines. */
function droppedLines(text: string): string[] {
  return text.split('\n').filter((line) => /^Warning: (in \S+, )?PoB dropped /.test(line));
}

engineDescribe('D-398: a load names the supports PoB drops from a granted group', () => {
  let f: SessionFixture;

  beforeAll(async () => {
    expect(FIXTURE_LEVEL_20).not.toBe(FIXTURE);
    expect(FIXTURE_UNALLOCATED).not.toBe(FIXTURE);
    f = await startSessionFixture({
      testActions: true,
      files: {
        'grenadator.xml': GOLDEN_XML,
        'granted-supports.xml': FIXTURE,
        'granted-copy.xml': FIXTURE,
        'granted-supports-l20.xml': FIXTURE_LEVEL_20,
        'granted-unallocated.xml': FIXTURE_UNALLOCATED,
        'changing.xml': GOLDEN_XML,
      },
    });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  /** The engine's granted groups (source → their gems' skill ids), as PoB holds them. */
  async function grantedGroups(): Promise<Record<string, string[]>> {
    const code = `
      local out = {}
      for _, g in ipairs(build.skillsTab.socketGroupList) do
        if g.source then
          local gems = {}
          for _, gem in ipairs(g.gemList) do table.insert(gems, gem.skillId) end
          out[g.source] = gems
        end
      end
      return out`;
    const { value } = await f.session.run({ tool: 'test:granted-group', kind: 'read' }, async (ctx) => {
      return (await ctx.client.request('__test_eval', { code })).result as Record<string, string[]>;
    });
    return value;
  }

  it(
    'D-398: lua_load_build of a file whose granted groups hold supports names them, the group and its passive or item, one line per group',
    async () => {
      const load = await f.call('lua_load_build', { build_name: 'granted-supports.xml' });
      expect(load.isError).toBe(false);
      expect(droppedLines(load.text)).toEqual(WARNINGS);
      // PoB's own state: each group keeps only its granted skill.
      expect(await grantedGroups()).toEqual({
        'Tree:11641': ['VirtuousBarrierPlayer'],
        'Item:1:Stoic Sceptre': ['DisciplinePlayer'],
      });
      // The socketed group's support is kept, and not named.
      expect(load.text).not.toMatch(/Heft/);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-398: a granted gem whose level differs from the grant (PoB replaces the group) gets the same line',
    async () => {
      const load = await f.call('lua_load_build', { build_name: 'granted-supports-l20.xml' });
      expect(load.isError).toBe(false);
      expect(droppedLines(load.text)).toEqual(WARNINGS);
      expect((await grantedGroups())['Tree:11641']).toEqual(['VirtuousBarrierPlayer']);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "D-398: a group whose passive isn't allocated is removed: its line says so, and doesn't name the granted skill",
    async () => {
      const load = await f.call('lua_load_build', { build_name: 'granted-unallocated.xml' });
      expect(load.isError).toBe(false);
      expect(droppedLines(load.text)).toEqual([
        'Warning: PoB dropped Precision I, Clarity I with the group "Virtuous Barrier": the passive Essence of Virtue ' +
          "(node 11641), which grants its skill, isn't allocated, so PoB removed the group.",
        `Warning: ${ITEM}`,
      ]);
      expect(await grantedGroups()).toEqual({ 'Item:1:Stoic Sceptre': ['DisciplinePlayer'] });
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-398: lua_reload_build and import_build (a PoB code) name them too',
    async () => {
      await f.call('lua_load_build', { build_name: 'granted-supports.xml' });
      const reload = await f.call('lua_reload_build', {});
      expect(reload.isError).toBe(false);
      expect(droppedLines(reload.text)).toEqual(WARNINGS);

      const imported = await f.call('import_build', { source: encodePobCode(FIXTURE) });
      expect(imported.isError).toBe(false);
      expect(droppedLines(imported.text)).toEqual(WARNINGS);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "D-398: the session's reload of a file changed on disk names them",
    async () => {
      const load = await f.call('lua_load_build', { build_name: 'changing.xml' });
      expect(load.isError).toBe(false);
      expect(droppedLines(load.text)).toEqual([]);
      writeBuild(path.join(f.builds, 'changing.xml'), FIXTURE);
      const read = await f.call('lua_get_build_info', {});
      expect(read.isError).toBe(false);
      expect(read.text).toContain('Reloaded changing.xml');
      expect(droppedLines(read.text)).toEqual(WARNINGS);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "D-398: a temporary load of the file (analyze_build) names them and the file, and the working build's next call doesn't",
    async () => {
      await f.call('lua_load_build', { build_name: 'grenadator.xml' });
      const analysis = await f.call('analyze_build', { build_name: 'granted-supports.xml' });
      expect(analysis.isError).toBe(false);
      expect(droppedLines(analysis.text)).toEqual([`Warning: in granted-supports.xml, ${TREE}`, `Warning: in granted-supports.xml, ${ITEM}`]);
      const next = await f.call('lua_get_build_info', {});
      expect(droppedLines(next.text)).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "D-398: compare_builds of two files with the same groups gives each file's lines, told apart by the file",
    async () => {
      await f.call('lua_load_build', { build_name: 'grenadator.xml' });
      const comparison = await f.call('compare_builds', { build1: 'granted-supports.xml', build2: 'granted-copy.xml' });
      expect(comparison.isError).toBe(false);
      expect(droppedLines(comparison.text)).toEqual([
        `Warning: in granted-supports.xml, ${TREE}`,
        `Warning: in granted-supports.xml, ${ITEM}`,
        `Warning: in granted-copy.xml, ${TREE}`,
        `Warning: in granted-copy.xml, ${ITEM}`,
      ]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-398: a build whose granted group holds no support (the golden build) gets no line',
    async () => {
      const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
      expect(load.isError).toBe(false);
      expect(droppedLines(load.text)).toEqual([]);
      expect(await grantedGroups()).toEqual({ 'Tree:11641': ['VirtuousBarrierPlayer'] });
    },
    ENGINE_TIMEOUT,
  );
});
