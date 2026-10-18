/**
 * D-388: the ranking tools on a build whose main skill is a summon, engine-required. A summon's player
 * figures (`CombinedDPS`, `TotalDPS`) are 0; its damage is its minion's (D-378, D-385).
 *
 * - get_passive_upgrades ranks by the minion's `MinionTotalDPS` (the compile record's field for a group whose
 *   damage is its minion's) and says so; before D-388 its base DPS was 0 and no notable improved DPS.
 * - suggest_supports ranks as PoB's gem selector does, a minion skill by its minion's CombinedDPS, and now names
 *   that field `MinionCombinedDPS` in its reply, where it said `CombinedDPS`.
 *
 * The golden build with a Raise Zombie group made the main skill, in process (`startSessionFixture`).
 */
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { CALL_TIMEOUT_MS, startSessionFixture, type SessionFixture } from '../helpers/engineSession';

const T = CALL_TIMEOUT_MS + 120_000;

engineDescribe('D-388: the ranking tools rank a summon main skill by its minion\'s figure', () => {
  let f: SessionFixture;
  let group = 0;

  beforeAll(async () => {
    f = await startSessionFixture();
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const setup = await f.call('setup_skill_with_gems', { active_gem: 'Raise Zombie', support_gems: [] });
    group = Number(/Created socket group (\d+)/.exec(setup.text)![1]);
    expect((await f.call('set_main_skill', { group_index: group })).isError).toBe(false);
    const { value } = await f.session.run({ tool: 'test:stats', kind: 'read' }, (ctx) =>
      ctx.client.getStats(['CombinedDPS', 'TotalDPS', 'MinionTotalDPS']),
    );
    // The premise: the player's figures are 0, the minion's aren't.
    expect([value.CombinedDPS, value.TotalDPS]).toEqual([0, 0]);
    expect(value.MinionTotalDPS).toBeGreaterThan(0);
  }, T);
  afterAll(async () => f?.close(), 30_000);

  it('get_passive_upgrades measures DPS as MinionTotalDPS, says so, and finds notables that improve it', async () => {
    const out = await f.call('get_passive_upgrades', { focus: 'dps', max_results: 5 });
    expect(out.isError).toBe(false);
    const base = /^Base DPS: ([\d,]+) \(MinionTotalDPS: the main skill's minion deals its damage\)/m.exec(out.text);
    expect(base).not.toBeNull();
    expect(Number(base![1].replace(/,/g, ''))).toBeGreaterThan(0);
    expect(out.text).not.toContain('None of the measured notables improves DPS');
    expect(out.text).toMatch(/^1\. \*\*.+\*\* \[\d+\]$/m);
  }, T);

  it("suggest_supports names the minion's field it ranks by", async () => {
    const out = await f.call('suggest_supports', { group_index: group, count: 3 });
    expect(out.isError).toBe(false);
    expect(out.text).toMatch(new RegExp(`Measured on group ${group} as the main skill: MinionCombinedDPS baseline [\\d.,]+ \\(its minion's damage, as PoB's gem selector ranks a minion skill\\)\\.`));
    expect(out.text).toContain('by measured MinionCombinedDPS change');
  }, T);
});
