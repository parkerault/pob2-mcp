/**
 * What the game won't allow in a loaded build (D-383), engine-required: `get_rule_breaks` and the advice
 * tools that judge through it (`validate_build`, `get_build_issues`).
 *
 * - D-383: a node whose unlock constraint is unmet. PoB unlocks such a node only while every node its
 *   constraint names is allocated (vendor Classes/PassiveSpec.lua:1248-1251); 197 of the pin's 200 constraints
 *   name the Oracle's The Unseen Path (5571). PoB's tree view refuses them, but a node list (a saved file, an
 *   import, `set_tree`) allocates them anyway.
 *
 * - D-384: a gem PoB marks legacy (its granted effect's `legacy`, which PoB's gem selector hides unless "Show
 *   legacy gems" is ticked; not PoB's `Tier = 0`) and a unique PoB marks no longer obtainable (its item
 *   database's own rule: source "No longer obtainable", or a Race Events league). The lookups leave them out and
 *   say so, the editing tools add them with a warning, as PoB allows them, and the advice tools judge them.
 *
 * The real Client, router, handlers, session and engine run in process over a private builds folder
 * (`startSessionFixture`); the fixtures are the golden build with one change each.
 */
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { CALL_TIMEOUT_MS, GOLDEN_XML, startSessionFixture, type SessionFixture } from '../helpers/engineSession';

const T = CALL_TIMEOUT_MS + 60_000;

/**
 * Eight attribute nodes from the golden tree to Physical and Lightning Damage (18353), one of the Oracle-only
 * nodes: PoB drops a listed node that no path reaches on load, so the locked node needs a path.
 */
const ORACLE_PATH = [62498, 3446, 27082, 53719, 59777, 27296, 59785, 1200, 18353];

/** The golden build with `ids` added to its spec's node list. */
function withNodes(...ids: number[]): string {
  const out = GOLDEN_XML.replace(/(<Spec\b[^>]*\bnodes=")([^"]*)"/, (_m, head: string, nodes: string) => `${head}${nodes},${ids.join(',')}"`);
  if (out === GOLDEN_XML) throw new Error('golden <Spec nodes> not found');
  return out;
}

engineDescribe('D-383: get_rule_breaks and the advice tools judge what the game won\'t allow', () => {
  let f: SessionFixture;

  beforeAll(async () => {
    f = await startSessionFixture({
      files: { 'grenadator.xml': GOLDEN_XML, 'locked.xml': withNodes(...ORACLE_PATH) },
    });
  }, T);
  afterAll(async () => f?.close(), 30_000);

  it('D-383: the golden build has no rule breaks, and validate_build reports none', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const { value } = await f.session.run({ tool: 'test:breaks', kind: 'read' }, (ctx) => ctx.client.getRuleBreaks());
    expect(value).toEqual({ lockedNodes: [], legacyGems: [], unobtainableUniques: [] });
    const out = await f.call('validate_build', {});
    expect(out.text).not.toContain('is locked');
  }, T);

  it('D-383: an Oracle-only node in a Mercenary build is a locked node; validate_build and get_build_issues name it', async () => {
    expect((await f.call('lua_load_build', { build_name: 'locked.xml' })).isError).toBe(false);
    const { value } = await f.session.run({ tool: 'test:breaks', kind: 'read' }, (ctx) => ctx.client.getRuleBreaks());
    expect(value.lockedNodes).toEqual([
      { id: 18353, name: 'Physical and Lightning Damage', needs: [{ id: 5571, name: 'The Unseen Path', ascendancy: 'Oracle' }] },
    ]);
    const line =
      'Node 18353 (Physical and Lightning Damage) is locked: PoB unlocks it only while node 5571 (The Unseen Path, an ' +
      'Oracle node) is allocated.';
    for (const tool of ['validate_build', 'get_build_issues']) {
      const out = await f.call(tool, {});
      expect({ tool, isError: out.isError }).toEqual({ tool, isError: false });
      expect({ tool, text: out.text }).toEqual({ tool, text: expect.stringContaining(line) });
    }
  }, T);

  it('D-383: validate_build on another file judges that file\'s locked node too', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const out = await f.call('validate_build', { build_name: 'locked.xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('Node 18353 (Physical and Lightning Damage) is locked');
  }, T);
});

const LEGACY_WARNING = '⚠ Commandment is a legacy gem: PoB marks it legacy, and it is no longer in the game.';
const UNOBTAINABLE_WARNING = "⚠ Thunderstep is no longer obtainable: PoB's unique data marks it so.";
const THUNDERSTEP = 'Rarity: UNIQUE\nThunderstep\nSteeltoe Boots';

engineDescribe('D-384: legacy gems and uniques no longer obtainable', () => {
  let f: SessionFixture;

  beforeAll(async () => {
    f = await startSessionFixture({ files: { 'grenadator.xml': GOLDEN_XML } });
  }, T);
  afterAll(async () => f?.close(), 30_000);

  const load = async () => expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
  const breaks = async () =>
    (await f.session.run({ tool: 'test:breaks', kind: 'read' }, (ctx) => ctx.client.getRuleBreaks())).value;

  it('D-384: gem mode leaves a legacy gem out and names it; Commandment is no match', async () => {
    const out = await f.call('lookup_game_data', { mode: 'gem', query: 'Commandment' });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('Nothing matched');
    expect(out.text).toContain('Left out: Commandment, which PoB marks legacy: it is no longer in the game.');
    expect(out.text).not.toMatch(/^## Commandment/m);
  }, T);

  it("D-384: mechanic mode leaves out a legacy gem's lines and a unique no longer obtainable, and names them", async () => {
    const gem = await f.call('lookup_game_data', { mode: 'mechanic', query: 'Cooldown Recovery Rate for Command Skills', kind: 'gem', max_results: 30 });
    expect(gem.isError).toBe(false);
    expect(gem.text).not.toMatch(/^\[gem\] Commandment\b/m);
    expect(gem.text).toMatch(/Left out: .*Commandment.*legacy/);
    // Thunderstep has the line too (vendor Data/Uniques/boots.lua).
    const unique = await f.call('lookup_game_data', { mode: 'mechanic', query: 'to Maximum Lightning Resistance', kind: 'unique', max_results: 30 });
    expect(unique.isError).toBe(false);
    expect(unique.text).not.toMatch(/^\[unique\] Thunderstep/m);
    expect(unique.text).toMatch(/Left out: .*Thunderstep.*no longer obtainable/);
  }, T);

  it('D-384: unique mode leaves out a unique no longer obtainable, by name or by slot', async () => {
    const byName = await f.call('lookup_game_data', { mode: 'unique', query: 'Thunderstep' });
    expect(byName.isError).toBe(false);
    expect(byName.text).toContain('Nothing matched');
    expect(byName.text).toContain("Left out: Thunderstep, which PoB's unique data marks no longer obtainable.");
    const bySlot = await f.call('lookup_game_data', { mode: 'unique', slot: 'Boots', max_results: 30 });
    expect(bySlot.text).not.toMatch(/^## Thunderstep/m);
    expect(bySlot.text).toMatch(/Left out: .*Thunderstep/);
  }, T);

  it('D-384: add_gem adds a legacy gem with a warning, and the advice tools judge it', async () => {
    await load();
    const out = await f.call('add_gem', { group_index: 1, gem_name: 'Commandment', level: 1 });
    expect(out.isError).toBe(false);
    expect(out.text).toContain(LEGACY_WARNING);
    expect((await breaks()).legacyGems).toEqual([expect.objectContaining({ name: 'Commandment', group: 1 })]);
    const validate = await f.call('validate_build', {});
    expect(validate.text).toMatch(/Commandment \(socket group 1(, "[^"]*")?\) is a legacy gem: PoB marks it legacy, and it is no longer in the game\./);
  }, T);

  it('D-384: setup_skill_with_gems adds a legacy support with a warning', async () => {
    await load();
    const out = await f.call('setup_skill_with_gems', { active_gem: 'Fireball', support_gems: ['Commandment'] });
    expect(out.isError).toBe(false);
    expect(out.text).toContain(LEGACY_WARNING);
  }, T);

  it('D-384: add_item and add_multiple_items equip a unique no longer obtainable with a warning, and the advice tools judge it', async () => {
    await load();
    const one = await f.call('add_item', { item_text: THUNDERSTEP, slot_name: 'Boots' });
    expect(one.isError).toBe(false);
    expect(one.text).toContain(UNOBTAINABLE_WARNING);
    expect((await breaks()).unobtainableUniques).toEqual([{ name: 'Thunderstep', slot: 'Boots' }]);
    const issues = await f.call('get_build_issues', {});
    expect(issues.text).toContain("Thunderstep (Boots) is no longer obtainable: PoB's unique data marks it so.");
    await load();
    const many = await f.call('add_multiple_items', { items: [{ item_text: THUNDERSTEP, slot_name: 'Boots' }] });
    expect(many.isError).toBe(false);
    expect(many.text).toContain(UNOBTAINABLE_WARNING);
  }, T);
});
