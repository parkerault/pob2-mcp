/**
 * WU-18: advice on engine data (FR-A1, D-30), engine-required.
 *
 * - AC-A1 (Lua-direct, real luajit + the pinned PoB): the `get_warnings` action returns PoB's warning
 *   lines and leaves `characterLevel` and `characterLevelAutoMode` as they were, also when PoB's level
 *   estimate differs from the level; the committed low-Strength fixture yields PoB's Strength warning.
 * - AC-A3, AC-A4, AC-A5 (in process): the real Client, router, handlers, session and engine over a
 *   private temp builds folder (`startSessionFixture`). These tools send no HTTP.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type Json, type LuaLineClient } from '../helpers/luaLineClient';
import {
  CALL_TIMEOUT_MS,
  GOLDEN_XML,
  goldenWithLevel,
  startSessionFixture,
  type SessionFixture,
} from '../helpers/engineSession';
import { canonicalizeAcrossReload } from '../helpers/reloadCanonical';
import { judge } from '../../src/advice/judge';
import { renderIssueLines } from '../../src/advice/report';

const REPO = path.resolve(__dirname, '..', '..');
const LOW_STR_XML = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'builds', 'grenadator-low-str.xml'), 'utf8');
/** The golden build with PoB's automatic level estimate switched on. */
const AUTO_LEVEL_XML = GOLDEN_XML.replace('characterLevelAutoMode="false"', 'characterLevelAutoMode="true"');
const ENGINE_TIMEOUT = 240_000;
const T = CALL_TIMEOUT_MS + 60_000;

/** Up to `n` allocated non-ascendancy leaf nodes (one allocated neighbour), lowest ids first. */
const PICK_LEAVES = (n: number) => `
local spec = build.spec
local ids = {}
for id, node in pairs(spec.allocNodes) do
  if not node.ascendancyName and node.type ~= 'ClassStart' then
    local linked = 0
    for _, other in ipairs(node.linked or {}) do
      if spec.allocNodes[other.id] then linked = linked + 1 end
    end
    if linked == 1 then ids[#ids + 1] = id end
  end
end
table.sort(ids)
local out = {}
for i = 1, math.min(${n}, #ids) do out[i] = ids[i] end
return out`;

const LEVEL_STATE = 'return { level = build.characterLevel, auto = build.characterLevelAutoMode }';

engineDescribe('AC-A1 (WU-18, D-30): get_warnings reads PoB\'s warnings without moving the level', () => {
  let engine: LuaLineClient;
  const call = async (action: string, params: Json = {}): Promise<Json> => {
    const reply = await engine.request(action, params, { timeoutMs: 120_000 });
    if (reply.ok !== true) throw new Error(`${action} failed: ${JSON.stringify(reply).slice(0, 500)}`);
    return reply;
  };
  const levelState = async (): Promise<{ level: number; auto: boolean }> => (await call('__test_eval', { code: LEVEL_STATE })).result;

  beforeAll(async () => {
    engine = await startLuaLineClient({ testActions: true });
  }, ENGINE_TIMEOUT);
  afterAll(async () => {
    await engine?.close();
  });

  it('AC-A1: on the golden build (auto level off) get_warnings returns a string array and characterLevel stays 90', async () => {
    await call('load_build_xml', { xml: GOLDEN_XML, name: 'Grenadator' });
    expect(await levelState()).toEqual({ level: 90, auto: false });

    const reply = await call('get_warnings');
    expect(Array.isArray(reply.result.lines)).toBe(true);
    for (const line of reply.result.lines) expect(typeof line).toBe('string');
    // PoB's own line for the golden build (10 gem groups against PoB's limit of 9), colour codes stripped.
    expect(reply.result.lines).toContain(
      'You have too many gem groups allocated. Max allowed is 9. You have 10 non-item/non-granted gem groups allocated.',
    );
    expect(reply.result.lines.join('\n')).not.toMatch(/\^(x[0-9A-Fa-f]{6}|\d)/);

    expect((await call('get_build_info')).info.level).toBe(90);
    expect(await levelState()).toEqual({ level: 90, auto: false });
  }, ENGINE_TIMEOUT);

  it('AC-A1: auto-level case: after removing 5 nodes, get_warnings leaves characterLevel and the auto flag unchanged', async () => {
    await call('load_build_xml', { xml: AUTO_LEVEL_XML, name: 'Grenadator (auto level)' });
    const before = await levelState();
    expect(before.auto).toBe(true);

    const leaves = (await call('__test_eval', { code: PICK_LEAVES(5) })).result as number[];
    expect(leaves).toHaveLength(5);
    await call('update_tree_delta', { removeNodes: leaves });
    // update_tree_delta does not run RefreshStatList: the level is still the one PoB estimated at load.
    expect(await levelState()).toEqual(before);

    await call('get_warnings');

    expect((await call('get_build_info')).info.level).toBe(before.level);
    expect(await levelState()).toEqual(before);

    // The case is real: PoB's own refresh (what get_warnings runs) would have moved the level.
    const raw = (await call('__test_eval', { code: `build:RefreshStatList() ${LEVEL_STATE}` })).result;
    expect(raw.auto).toBe(true);
    expect(raw.level).not.toBe(before.level);
  }, ENGINE_TIMEOUT);

  it('AC-A1: Str case: the low-Strength fixture yields PoB\'s "do not meet the Strength requirement" line', async () => {
    await call('load_build_xml', { xml: LOW_STR_XML, name: 'Grenadator (low Str)' });
    const lines = (await call('get_warnings')).result.lines as string[];
    expect(lines.some((l) => /do not meet the Strength requirement/.test(l))).toBe(true);

    // The golden build itself meets it (Strength 119 against Herald of Ash's 116).
    await call('load_build_xml', { xml: GOLDEN_XML, name: 'Grenadator' });
    const golden = (await call('get_warnings')).result.lines as string[];
    expect(golden.some((l) => /do not meet the Strength requirement/.test(l))).toBe(false);
  }, ENGINE_TIMEOUT);
});

/** The issue lines of a section (judgments `⚠`, facts `ℹ`), in order. */
function issueLines(text: string): string[] {
  return text.split('\n').filter((l) => /^ {2}[⚠ℹ] /.test(l));
}

/** The lines after the load summary's "**Top Issues:**" heading. */
function topIssueLines(loadText: string): string[] {
  const at = loadText.indexOf('**Top Issues:**');
  if (at < 0) throw new Error(`no Top Issues in the load summary:\n${loadText}`);
  return issueLines(loadText.slice(at));
}

engineDescribe('AC-A3, AC-A4, AC-A5 (WU-18): the advice tools on the golden build', () => {
  let f: SessionFixture;

  interface EngineState {
    xml: string;
    loaded: unknown;
    revision: number;
  }
  const exportXml = async (): Promise<string> =>
    (await f.session.run({ tool: 'test:export', kind: 'read' }, (ctx) => ctx.client.exportBuildXml())).value;
  const engineState = async (): Promise<EngineState> => ({
    xml: await exportXml(),
    loaded: structuredClone(f.session.loaded),
    revision: f.session.revision,
  });
  /** `revision`, `loaded` and the canonical export unchanged (AC-E51 semantics, across the temporary load). */
  const expectUnchanged = async (before: EngineState): Promise<void> => {
    expect(f.session.revision).toBe(before.revision);
    expect(f.session.loaded).toEqual(before.loaded);
    expect(canonicalizeAcrossReload(await exportXml())).toBe(canonicalizeAcrossReload(before.xml));
  };

  /** What judge() finds for the engine's build, read independently of the tools (default get_stats). */
  const expectedIssueLines = async (): Promise<string[]> => {
    const { value } = await f.session.run({ tool: 'test:judge', kind: 'read' }, async (ctx) => {
      const warnings = await ctx.client.getWarnings();
      const stats = await ctx.client.getStats();
      const items = await ctx.client.getItems();
      return judge(stats, warnings, items);
    });
    return renderIssueLines(value);
  };

  let loadText = '';
  beforeAll(async () => {
    f = await startSessionFixture({ files: { 'grenadator.xml': GOLDEN_XML, 'other.xml': goldenWithLevel(80) } });
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
    loadText = load.text;
  }, T);
  afterAll(async () => f?.close(), 30_000);

  it('AC-A3: analyze_defenses with no build_name reports EHP 11,833, PDR, evade, deflect, block, resists with their gaps and each max hit vs the enemy hit', async () => {
    const out = await f.call('analyze_defenses', {});
    expect(out.isError).toBe(false);
    const { value: s } = await f.session.run({ tool: 'test:stats', kind: 'read' }, (ctx) => ctx.client.getStats());
    const fmt = (v: unknown) => Number(v).toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(Number(v)) ? 0 : 1 });

    expect(out.text).toContain('=== Defence Analysis: grenadator.xml (level 90) ===');
    expect(out.text).toContain('Effective Hit Pool (TotalEHP): 11,833');
    expect(out.text).toContain(`Physical damage reduction: ${fmt(s.PhysicalDamageReduction)}%`);
    expect(out.text).toContain(`Evade chance: ${fmt(s.EvadeChance)}%`);
    expect(out.text).toContain(`Deflect chance: ${fmt(s.DeflectChance)}%`);
    expect(out.text).toContain(`Effective block chance: ${fmt(s.EffectiveBlockChance)}%`);
    for (const e of ['Fire', 'Cold', 'Lightning', 'Chaos']) {
      expect(out.text).toContain(`  ${e}: ${fmt(s[`${e}Resist`])}% (missing to its maximum: ${fmt(s[`Missing${e}Resist`])}%)`);
    }
    for (const t of ['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos']) {
      expect(out.text).toContain(`  ${t}: ${fmt(s[`${t}MaximumHitTaken`])} vs ${fmt(s[`${t}EnemyDamage`])}`);
    }
    expect(out.text).not.toMatch(/undefined|NaN|\[object Object\]/);
  }, T);

  it('AC-A3: analyze_defenses\' issues equal judge()\'s for the same stats', async () => {
    const out = await f.call('analyze_defenses', {});
    const expected = await expectedIssueLines();
    // The golden build has PoB's gem-group warning and a chaos resistance gap: the list is not empty.
    expect(expected.length).toBeGreaterThan(0);
    expect(issueLines(out.text)).toEqual(expected);
  }, T);

  it('AC-A3: analyze_defenses {build_name:"other.xml"} reports that build and leaves loaded, revision and the canonical export unchanged', async () => {
    const before = await engineState();
    const out = await f.call('analyze_defenses', { build_name: 'other.xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('=== Defence Analysis: other.xml (level 80) ===');
    expect(out.text).toContain("the engine's build is unchanged");
    await expectUnchanged(before);
  }, T);

  it('AC-A3: validate_build {build_name:"other.xml"} reports that build and leaves loaded, revision and the canonical export unchanged', async () => {
    const before = await engineState();
    const out = await f.call('validate_build', { build_name: 'other.xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('=== Build Validation: other.xml (level 80) ===');
    await expectUnchanged(before);
  }, T);

  it('AC-A4: get_build_issues\' issue list equals the load summary\'s "Top Issues" list, element for element', async () => {
    const out = await f.call('get_build_issues', {});
    expect(out.isError).toBe(false);
    const issues = issueLines(out.text);
    const top = topIssueLines(loadText);
    expect(issues.length).toBeGreaterThan(0);
    expect(top).toEqual(issues);
    expect(issues).toEqual(await expectedIssueLines());
  }, T);

  it('AC-A4: neither list contains 89, "jewel socket(s) empty", "quest points" or "Flask 3"', async () => {
    const issues = issueLines((await f.call('get_build_issues', {})).text).join('\n');
    const top = topIssueLines(loadText).join('\n');
    for (const text of [issues, top]) {
      expect(text).not.toContain('89');
      expect(text).not.toMatch(/jewel socket\(s\) empty/i);
      expect(text).not.toMatch(/quest points/i);
      expect(text).not.toContain('Flask 3');
    }
  }, T);

  it('AC-A4: validate_build with no build_name judges the engine build through the same judge()', async () => {
    const out = await f.call('validate_build', {});
    expect(out.isError).toBe(false);
    expect(issueLines(out.text)).toEqual(await expectedIssueLines());
  }, T);

  it('AC-A5: the golden build wears a Bright Thawing Charm, and validate_build\'s output contains no "Freeze"', async () => {
    const { value: items } = await f.session.run({ tool: 'test:items', kind: 'read' }, (ctx) => ctx.client.getItems());
    expect(items.some((i) => i.shown && !i.inactive && /Bright Thawing Charm/.test(i.name ?? ''))).toBe(true);
    for (const args of [{}, { build_name: 'grenadator.xml' }]) {
      const out = await f.call('validate_build', args);
      expect(out.isError).toBe(false);
      expect(out.text).not.toMatch(/freeze/i);
    }
  }, T);

  it('AC-A5: the three tool descriptions state that judgments come from PoB\'s warnings and engine comparisons', async () => {
    const { tools } = await f.server.client.listTools();
    for (const name of ['validate_build', 'analyze_defenses', 'get_build_issues']) {
      const tool = tools.find((t) => t.name === name);
      expect(tool).toBeDefined();
      expect(tool!.description).toContain("PoB's own warning lines");
      expect(tool!.description).toContain('engine comparisons');
      expect(tool!.description!.length).toBeLessThanOrEqual(2048);
    }
    // D-51a: analyze_defenses' build_name is optional.
    const defenses = tools.find((t) => t.name === 'analyze_defenses')!;
    expect(defenses.inputSchema.required ?? []).not.toContain('build_name');
  }, T);
});
