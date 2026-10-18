/**
 * M-19 (D-398): a load names the supports PoB drops from a granted skill's socket group. In process and
 * engine-required.
 *
 * PoB v0.23.1 rebuilds a granted skill's group (a passive's or an item's) from its grant on every calculation
 * (`Modules/CalcSetup.lua:1503-1542`): a matched group's gem list is wiped back to the granted gem, and a group
 * whose gem level differs from the grant is removed for a new one. So a file that keeps supports in such a group
 * loses them on load. Every tool path that loads or imports a build file (a file load, a reload, an import from a
 * code, the session's reload of a file changed on disk, a temporary load of a file) then carries one warning line
 * per group, naming the dropped gems, the group and the passive that grants it; a load that drops nothing says
 * nothing new.
 *
 * The fixture `granted-supports.xml` is written from the game data: a Mercenary with the Gemling Legionnaire
 * passive Essence of Virtue (node 11641, "Grants Skill: Virtuous Barrier", through node 34882), whose granted
 * group holds Virtuous Barrier and two supports that take a persistent buff, Precision I and Clarity I, and a
 * socketed Flash Grenade group with Heft that PoB keeps. The golden build's granted group holds no support.
 * The independent check is PoB's own state (`__test_eval`): the granted group holds only Virtuous Barrier.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { GOLDEN_XML, startSessionFixture, writeBuild, type SessionFixture } from '../helpers/engineSession';
import { encodePobCode } from '../../src/utils/buildCode';

const ENGINE_TIMEOUT = 240_000;
const FIXTURE = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'builds', 'granted-supports.xml'), 'utf8');
/** The fixture with the granted gem at level 20 against the grant's 1: PoB's unmatched-group path. */
const FIXTURE_LEVEL_20 = FIXTURE.replace(
  'variantId="AscendancyGemlingVirtuousBarrier" level="1"',
  'variantId="AscendancyGemlingVirtuousBarrier" level="20"',
);

const WARNING =
  'Warning: PoB dropped Precision I, Clarity I from the group "Virtuous Barrier", granted by the passive ' +
  "Essence of Virtue (node 11641): PoB rebuilds a granted skill's group from its grant on every calculation, " +
  'so no figure includes them.';

/** The reply's D-398 lines. */
function droppedLines(text: string): string[] {
  return text.split('\n').filter((line) => line.startsWith('Warning: PoB dropped '));
}

engineDescribe('D-398: a load names the supports PoB drops from a granted group', () => {
  let f: SessionFixture;

  beforeAll(async () => {
    expect(FIXTURE_LEVEL_20).not.toBe(FIXTURE);
    f = await startSessionFixture({
      testActions: true,
      files: {
        'grenadator.xml': GOLDEN_XML,
        'granted-supports.xml': FIXTURE,
        'granted-supports-l20.xml': FIXTURE_LEVEL_20,
        'changing.xml': GOLDEN_XML,
      },
    });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  /** The engine's granted group for node 11641: its gems' skill ids, as PoB holds them. */
  async function grantedGroupGems(): Promise<string[]> {
    const code = `
      local out = {}
      for _, g in ipairs(build.skillsTab.socketGroupList) do
        if g.source == 'Tree:11641' then
          for _, gem in ipairs(g.gemList) do table.insert(out, gem.skillId) end
        end
      end
      return out`;
    const { value } = await f.session.run({ tool: 'test:granted-group', kind: 'read' }, async (ctx) => {
      return (await ctx.client.request('__test_eval', { code })).result as string[];
    });
    return value;
  }

  it(
    'D-398: lua_load_build of a file whose granted group holds supports names them, the group and its passive, in one line',
    async () => {
      const load = await f.call('lua_load_build', { build_name: 'granted-supports.xml' });
      expect(load.isError).toBe(false);
      expect(droppedLines(load.text)).toEqual([WARNING]);
      // PoB's own state: the group keeps only the granted skill.
      expect(await grantedGroupGems()).toEqual(['VirtuousBarrierPlayer']);
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
      expect(droppedLines(load.text)).toEqual([WARNING]);
      expect(await grantedGroupGems()).toEqual(['VirtuousBarrierPlayer']);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-398: lua_reload_build and import_build (a PoB code) name them too',
    async () => {
      await f.call('lua_load_build', { build_name: 'granted-supports.xml' });
      const reload = await f.call('lua_reload_build', {});
      expect(reload.isError).toBe(false);
      expect(droppedLines(reload.text)).toEqual([WARNING]);

      const imported = await f.call('import_build', { source: encodePobCode(FIXTURE) });
      expect(imported.isError).toBe(false);
      expect(droppedLines(imported.text)).toEqual([WARNING]);
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
      expect(droppedLines(read.text)).toEqual([WARNING]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "D-398: a temporary load of the file (analyze_build) names them, and the working build's next call doesn't",
    async () => {
      await f.call('lua_load_build', { build_name: 'grenadator.xml' });
      const analysis = await f.call('analyze_build', { build_name: 'granted-supports.xml' });
      expect(analysis.isError).toBe(false);
      expect(droppedLines(analysis.text)).toEqual([WARNING]);
      const next = await f.call('lua_get_build_info', {});
      expect(droppedLines(next.text)).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-398: a build whose granted group holds no support (the golden build) gets no line',
    async () => {
      const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
      expect(load.isError).toBe(false);
      expect(droppedLines(load.text)).toEqual([]);
      expect(await grantedGroupGems()).toEqual(['VirtuousBarrierPlayer']);
    },
    ENGINE_TIMEOUT,
  );
});
