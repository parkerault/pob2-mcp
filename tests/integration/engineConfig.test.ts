/**
 * Engine ops: config and presets (WU-12) on the golden build: AC-E42, AC-E43, AC-E44 and AC-E45,
 * engine-required and in process.
 *
 * The real server runs in process (`startTestServer`: real `Client`, router, handlers, session, bridge
 * and luajit) over a private builds folder holding the golden build, with `POB_DIRECTORY` and
 * `XDG_STATE_HOME` pointed at temp dirs, so the state dir is the entry's own `<XDG_STATE_HOME>/pob2-mcp`
 * (C-16). Tool outputs are read through MCP; the independent checks are Lua queries (`__test_eval`)
 * against PoB's own config state (`build.configTab`) and PoB's own option list (`Modules/ConfigOptions`).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, beforeEach, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { CALL_TIMEOUT_MS, GOLDEN_XML, type ToolOutcome } from '../helpers/engineSession';
import { startTestServer, type TestServer } from '../helpers/server';

const ENGINE_TIMEOUT = 240_000;

/** A scalar as the config tools print it (bare boolean or number, JSON string), maybe marked "(default)". */
const SCALAR_VALUE = /^(true|false|-?\d+(\.\d+)?(e[+-]?\d+)?|"(?:[^"\\]|\\.)*")( \(default\))?$/;

/** get_config's option lines (`key: value` under the section headers) as a map. */
function optionLines(text: string): Map<string, string> {
  const lines = text.split('\n');
  const firstSection = lines.findIndex((l) => /^=== .+ ===$/.test(l) && !l.startsWith('=== Configuration'));
  expect(firstSection).toBeGreaterThan(0);
  const out = new Map<string, string>();
  for (const line of lines.slice(firstSection)) {
    if (line === '' || /^=== .+ ===$/.test(line)) continue;
    const at = line.indexOf(': ');
    expect({ line, hasSeparator: at > 0 }).toEqual({ line, hasSeparator: true });
    out.set(line.slice(0, at), line.slice(at + 2));
  }
  return out;
}

/** A Lua scalar as get_config prints a value the build sets. */
function printed(v: unknown): string {
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

engineDescribe('engine ops: config and presets on the golden build (WU-12)', () => {
  let tmp: string;
  let builds: string;
  let xdg: string;
  let server: TestServer;

  const call = async (tool: string, args: Record<string, unknown> = {}): Promise<ToolOutcome> => {
    const result = (await server.client.callTool({ name: tool, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS })) as {
      isError?: boolean;
      content?: Array<{ type: string; text?: string }>;
    };
    return { isError: result.isError === true, text: (result.content ?? []).map((c) => c.text ?? '').join('\n') };
  };

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await server.session.run({ tool: 'test:engine-config', kind: 'read' }, async (ctx) => {
      return (await ctx.client.request('__test_eval', { code })).result as T;
    });
    return value;
  }

  /** The active config set's input, scalars only, straight from PoB. */
  const engineInput = () =>
    luaQuery<Record<string, string | number | boolean>>(`
      local out = {}
      for k, v in pairs(build.configTab.configSets[build.configTab.activeConfigSetId].input) do
        local t = type(v)
        if t == 'string' or t == 'number' or t == 'boolean' then out[k] = v end
      end
      return out`);

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-config-'));
    builds = path.join(tmp, 'builds');
    xdg = path.join(tmp, 'xdg');
    fs.mkdirSync(builds);
    fs.writeFileSync(path.join(builds, 'grenadator.xml'), GOLDEN_XML, 'utf8');
    // pobDirectory and stateDir follow the entry's defaults for this env (C-16: <XDG_STATE_HOME>/pob2-mcp).
    server = await startTestServer({ env: { POB_DIRECTORY: builds, XDG_STATE_HOME: xdg, POB_API_TEST_ACTIONS: '1' } });
    expect(server.deps.stateDir).toBe(path.join(xdg, 'pob2-mcp'));
  }, ENGINE_TIMEOUT);

  beforeEach(async () => {
    const load = await call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    if (server) await server.close();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }, 30000);

  it(
    'AC-E42: get_config on the golden build lists PoB2\'s ConfigOptions keys with scalar values, and contains no Bandit, Pantheon or [object Object]',
    async () => {
      const out = await call('get_config');
      expect(out.isError).toBe(false);
      expect(out.text).not.toMatch(/bandit/i);
      expect(out.text).not.toMatch(/pantheon/i);
      expect(out.text).not.toContain('[object Object]');
      expect(out.text).not.toContain('undefined');

      // Every listed value is a scalar.
      const lines = optionLines(out.text);
      const notScalar = [...lines].filter(([, v]) => !SCALAR_VALUE.test(v));
      expect(notScalar).toEqual([]);

      // The keys are exactly PoB2's own config options (Modules/ConfigOptions, as ConfigTab loads them).
      const pobKeys = await luaQuery<string[]>(`
        local seen, keys = {}, {}
        for _, varData in ipairs(LoadModule('Modules/ConfigOptions')) do
          if varData.var and not seen[varData.var] then seen[varData.var] = true; keys[#keys + 1] = varData.var end
        end
        table.sort(keys)
        return keys`);
      expect(pobKeys.length).toBeGreaterThan(400);
      expect([...lines.keys()].sort()).toEqual([...pobKeys].sort());

      // Each option the build sets shows PoB's own value; the others are marked (default).
      const input = await engineInput();
      const shownSet = [...lines].filter(([k]) => k in input).map(([k, v]) => [k, v]);
      expect(shownSet).toEqual([...lines].filter(([k]) => k in input).map(([k]) => [k, printed(input[k])]));
      expect(shownSet.length).toBeGreaterThan(10);
      const unsetShown = [...lines].filter(([k]) => !(k in input));
      expect(unsetShown.length).toBeGreaterThan(0);
      for (const [, v] of unsetShown) expect(v).toMatch(/ \(default\)$/);
      expect(lines.get('enemyIsBoss')).toBe('"Pinnacle"');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E43: set_config {config_name, value} on a boolean option reports the actual previous value, which get_config showed before the call',
    async () => {
      const input = await engineInput();
      // One boolean option the golden build sets (true) and one it leaves unset (PoB: false).
      expect(input.conditionSurrounded).toBe(true);
      expect(input.conditionLowLife).toBeUndefined();

      for (const [key, value, expectedBefore] of [
        ['conditionSurrounded', false, 'true'],
        ['conditionLowLife', true, 'false (default)'],
      ] as const) {
        const shownBefore = optionLines((await call('get_config')).text).get(key);
        expect(shownBefore).toBe(expectedBefore);

        const set = await call('set_config', { config_name: key, value });
        expect(set.isError).toBe(false);
        expect(set.text).toContain(`${key}:\n  Previous value: ${shownBefore}\n  New value: ${String(value)}\n`);

        // The change is real: PoB's input holds it, and get_config shows it.
        expect((await engineInput())[key]).toBe(value);
        expect(optionLines((await call('get_config')).text).get(key)).toBe(String(value));
      }
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E43: set_config with an unknown key (PoE1 bandit) or a wrong-typed value is an error and changes nothing',
    async () => {
      const before = await engineInput();
      const bandit = await call('set_config', { config_name: 'bandit', value: 'None' });
      expect(bandit.isError).toBe(true);
      expect(bandit.text).toContain("unknown config option 'bandit'");
      const badType = await call('set_config', { config_name: 'conditionLowLife', value: 3 });
      expect(badType.isError).toBe(true);
      expect(badType.text).toContain('checkbox');
      expect(await engineInput()).toEqual(before);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E44: set_enemy_stats {level: 85} -> get_config shows enemy level 85, and build.configTab.input.enemyLevel == 85',
    async () => {
      const before = await luaQuery<{ input: number | null; level: number }>(
        `return { input = build.configTab.input.enemyLevel, level = build.configTab.enemyLevel }`,
      );
      expect(before.level).not.toBe(85);

      const set = await call('set_enemy_stats', { level: 85 });
      expect(set.isError).toBe(false);
      expect(set.text).toContain(`Enemy level (enemyLevel): ${before.level} (default) → 85`);

      const shown = await call('get_config');
      expect(shown.isError).toBe(false);
      expect(shown.text).toContain('Enemy level in effect: 85\n');
      expect(optionLines(shown.text).get('enemyLevel')).toBe('85');

      const after = await luaQuery<{ isInput85: boolean; level: number }>(
        `return { isInput85 = build.configTab.input.enemyLevel == 85, level = build.configTab.enemyLevel }`,
      );
      expect(after).toEqual({ isInput85: true, level: 85 });
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-E45: save_config_preset creates <XDG_STATE_HOME>/pob2-mcp/presets/p1.json; after changing values load_config_preset restores them; list_config_presets lists p1',
    async () => {
      const saved = await call('get_config');
      const savedLines = optionLines(saved.text);
      const savedInput = await engineInput();

      const save = await call('save_config_preset', { name: 'p1' });
      expect(save.isError).toBe(false);
      const file = path.join(xdg, 'pob2-mcp', 'presets', 'p1.json');
      expect(fs.existsSync(file)).toBe(true);
      expect(JSON.parse(fs.readFileSync(file, 'utf8')).input).toEqual(savedInput);

      // Change a set boolean, a set list option, and an option the build leaves unset.
      expect((await call('set_config', { config_name: 'conditionSurrounded', value: false })).isError).toBe(false);
      expect((await call('set_config', { config_name: 'enemyIsBoss', value: 'Uber' })).isError).toBe(false);
      expect((await call('set_enemy_stats', { level: 85, fire_resist: 10 })).isError).toBe(false);
      const changed = optionLines((await call('get_config')).text);
      expect([changed.get('conditionSurrounded'), changed.get('enemyIsBoss'), changed.get('enemyLevel'), changed.get('enemyFireResist')]).toEqual(
        ['false', '"Uber"', '85', '10'],
      );

      const load = await call('load_config_preset', { name: 'p1' });
      expect(load.isError).toBe(false);

      // get_config shows the saved values again: every option, and the enemy level in effect.
      const restored = await call('get_config');
      const restoredLines = optionLines(restored.text);
      expect(restoredLines.get('conditionSurrounded')).toBe(savedLines.get('conditionSurrounded'));
      expect(restoredLines.get('enemyIsBoss')).toBe('"Pinnacle"');
      expect(restoredLines.get('enemyLevel')).toBe(savedLines.get('enemyLevel'));
      expect(restoredLines.get('enemyFireResist')).toBe(savedLines.get('enemyFireResist'));
      expect(restored.text).toBe(saved.text);
      expect(await engineInput()).toEqual(savedInput);

      const list = await call('list_config_presets');
      expect(list.isError).toBe(false);
      expect(list.text).toMatch(/^\d+\. p1$/m);
    },
    ENGINE_TIMEOUT,
  );
});
