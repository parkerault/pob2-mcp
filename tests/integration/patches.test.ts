/**
 * AC-W133's engine half (WU-152, amendment 16 §5, D-509, C-60): the bridge's patch frame as the engine runs it.
 *
 * `pob-api/bootstrap.lua` applies the parse fixes (step 5c, `API/ParseFixes.lua`) and then the function patches (step
 * 5d, `API/Patches.lua`) before the server writes its banner; each entry of `Patches.lua` applies in its own pcall, so
 * one whose method is missing is logged as `[Patches] <pg> not applied: <error>` and the engine starts without it.
 * The static half (each entry's PG id, fingerprints and test; the fingerprints on the pin; bootstrap's order) is
 * `tests/static/patchFingerprints.test.ts`.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type LuaLineClient } from '../helpers/luaLineClient';

const REPO = path.resolve(__dirname, '..', '..');
const POB_API = path.join(REPO, 'pob-api');
const SCRIPT = path.join(REPO, 'scripts', 'patch-fingerprints.mjs');
const ENGINE_TIMEOUT = 180_000;

const PHYLACTERY_LINE = '100% increased Effect of bonuses gained from Socketed Jewel';

/** Each entry of a module as Lua holds it: its fields, and whether `apply` and `revert` are functions. */
const ENTRIES = (module: 'Patches' | 'ParseFixes') => `
  local mod = require('API.${module}')
  local out = {}
  for _, e in ipairs(mod.${module === 'Patches' ? 'PATCHES' : 'FIXES'}) do
    local fps = {}
    for _, fp in ipairs(e.fingerprints or {}) do
      fps[#fps + 1] = { file = fp.file, func = fp.func, line = fp.line, from = fp.from, to = fp.to, sha1 = fp.sha1 }
    end
    out[#out + 1] = {
      pg = e.pg, stub = e.stub == true, fingerprints = fps,
      test = e.test and { file = e.test.file, case = e.test.case } or false,
      apply = type(e.apply) == 'function', revert = type(e.revert) == 'function',
    }
  end
  return out`;

interface LuaEntry {
  pg: string;
  stub: boolean;
  fingerprints: Array<Record<string, string>>;
  test: { file: string; case: string } | false;
  apply: boolean;
  revert: boolean;
}

/** What the static reader (`scripts/patch-fingerprints.mjs`) reads from the same modules. */
function staticEntries(): Array<{ module: string; pg: string; stub: boolean; fingerprints: Array<Record<string, unknown>>; test: unknown }> {
  const out = execFileSync(process.execPath, [SCRIPT, '--json'], { cwd: os.tmpdir(), env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 60000 });
  return JSON.parse(out).entries;
}

engineDescribe('AC-W133 (WU-152): bootstrap applies the parse fixes, then the patches, before the server starts (D-509)', () => {
  let engine: LuaLineClient;

  const evalLua = async <T>(code: string): Promise<T> => {
    const reply = await engine.request('__test_eval', { code }, { timeoutMs: 120_000 });
    expect({ ok: reply.ok, error: reply.error }).toEqual({ ok: true, error: undefined });
    return reply.result as T;
  };

  beforeAll(async () => {
    engine = await startLuaLineClient({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await engine?.close();
  });

  it(
    'at the first request every entry but a stub is on, the parse fix is in the cache, and nothing logged a failure',
    async () => {
      const state = await evalLua<{ applied: string[]; stubs: string[]; fixed: boolean }>(`
        local Patches = require('API.Patches')
        local stubs = {}
        for _, e in ipairs(Patches.PATCHES) do if e.stub then stubs[#stubs + 1] = e.pg end end
        local entry = modLib.parseModCache[${JSON.stringify(PHYLACTERY_LINE)}]
        local mod = entry and entry[1] and entry[1][1]
        return { applied = Patches.applied(), stubs = stubs, fixed = mod ~= nil and mod.name == 'SocketedJewelEffect' and entry[2] == nil }`);
      const patches = await evalLua<LuaEntry[]>(ENTRIES('Patches'));
      expect(state.applied).toEqual(patches.filter((e) => !e.stub).map((e) => e.pg));
      expect(state.applied).toContain('PG-106');
      expect(state.stubs).toEqual(patches.filter((e) => e.stub).map((e) => e.pg));
      expect(state.fixed).toBe(true);
      expect(engine.stderr()).not.toMatch(/\[(Patches|ParseFixes)\][^\n]*not applied/);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "each entry as Lua holds it has a PG id, a fingerprint, its test, and (Patches.lua's) apply and revert; the static reader reads the same",
    async () => {
      const read = staticEntries();
      for (const module of ['Patches', 'ParseFixes'] as const) {
        const lua = await evalLua<LuaEntry[]>(ENTRIES(module));
        expect(lua.length).toBeGreaterThan(0);
        for (const e of lua) {
          expect({ pg: e.pg, id: /^PG-\d+$/.test(e.pg), fingerprints: e.fingerprints.length > 0, test: e.test !== false })
            .toEqual({ pg: e.pg, id: true, fingerprints: true, test: true });
          if (module === 'Patches') expect({ pg: e.pg, apply: e.apply, revert: e.revert }).toEqual({ pg: e.pg, apply: true, revert: true });
        }
        const file = `pob-api/API/${module}.lua`;
        expect(read.filter((r) => r.module === file).map((r) => ({ pg: r.pg, stub: r.stub, fingerprints: r.fingerprints.map((fp) => {
          const { file: f, func, line, from, to, sha1 } = fp as Record<string, string | undefined>;
          return Object.fromEntries(Object.entries({ file: f, func, line, from, to, sha1 }).filter(([, v]) => v !== undefined));
        }), test: r.test })))
          .toEqual(lua.map((e) => ({ pg: e.pg, stub: e.stub, fingerprints: e.fingerprints, test: e.test })));
      }
    },
    ENGINE_TIMEOUT,
  );

  it(
    "a wrap over a missing method refuses and sets nothing on PoB's class",
    async () => {
      const r = await evalLua<{ ok: boolean; err: string; set: boolean }>(`
        local ok, err = pcall(require('API.Patches').wrap, 'SkillsTab', 'NoSuchMethodForTest', function(pob) return pob end)
        return { ok = ok, err = tostring(err), set = rawget(common.classes.SkillsTab, 'NoSuchMethodForTest') ~= nil }`);
      expect(r).toEqual({ ok: false, err: 'PoB method SkillsTab.NoSuchMethodForTest is missing', set: false });
    },
    ENGINE_TIMEOUT,
  );
});

engineDescribe('AC-W133 (WU-152): an entry whose apply refuses is logged, and the engine starts without it (D-509)', () => {
  let tmp: string;
  let engine: LuaLineClient;

  beforeAll(async () => {
    // A copy of the bridge whose Patches.lua lists, first, an entry that wraps a method PoB doesn't have.
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-patches-'));
    const api = path.join(tmp, 'pob-api');
    fs.cpSync(POB_API, api, { recursive: true });
    const file = path.join(api, 'API', 'Patches.lua');
    const src = fs.readFileSync(file, 'utf8');
    const at = src.lastIndexOf('\nreturn M');
    expect(at).toBeGreaterThan(0);
    const broken = [
      '',
      'table.insert(M.PATCHES, 1, {',
      "  pg = 'PG-0',",
      "  fingerprints = { { file = 'Classes/SkillsTab.lua', func = 'function SkillsTabClass:NoSuchMethodForTest()', sha1 = '' } },",
      "  test = { file = 'none', case = 'none' },",
      "  apply = function() M.wrap('SkillsTab', 'NoSuchMethodForTest', function(pob) return pob end) end,",
      '  revert = function() end,',
      '})',
    ].join('\n');
    fs.writeFileSync(file, `${src.slice(0, at)}${broken}${src.slice(at)}`);
    engine = await startLuaLineClient({ testActions: true, apiDir: api });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await engine?.close();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it(
    'the banner comes, stderr names the entry and its missing method, the other entries are on, and a build loads',
    async () => {
      expect(engine.banner).toMatchObject({ ok: true, ready: true });
      expect(engine.stderr()).toContain('[Patches] PG-0 not applied: PoB method SkillsTab.NoSuchMethodForTest is missing');
      const reply = await engine.request('__test_eval', {
        code: `local P = require('API.Patches') return { applied = P.applied(), first = P.PATCHES[1].pg }`,
      }, { timeoutMs: 120_000 });
      expect(reply.ok).toBe(true);
      expect(reply.result.first).toBe('PG-0');
      expect(reply.result.applied).not.toContain('PG-0');
      expect(reply.result.applied).toContain('PG-106');
      const xml = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'builds', 'pg106-purity-copy.xml'), 'utf8');
      const loaded = await engine.request('load_build_xml', { xml, name: 'pg106-purity-copy.xml' }, { timeoutMs: 120_000 });
      expect({ ok: loaded.ok, error: loaded.error }).toEqual({ ok: true, error: undefined });
    },
    ENGINE_TIMEOUT,
  );
});
