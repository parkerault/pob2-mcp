/**
 * What the game won't allow in a loaded build (D-383), engine-required: `get_rule_breaks` and the advice
 * tools that judge through it (`validate_build`, `get_build_issues`).
 *
 * - D-383: a node whose unlock constraint is unmet. PoB unlocks such a node only while every node its
 *   constraint names is allocated (vendor Classes/PassiveSpec.lua:1248-1251); 197 of the pin's 200 constraints
 *   name the Oracle's The Unseen Path (5571). PoB's tree view refuses them, but a node list (a saved file, an
 *   import, `set_tree`) allocates them anyway.
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
    expect(value).toEqual({ lockedNodes: [] });
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
