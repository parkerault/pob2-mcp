/**
 * Engine wire protocol v2, Lua side (C-2): AC-E1…AC-E6, Lua-direct.
 *
 * Every test spawns luajit with `pob-api/bootstrap.lua` against the pinned PoB checkout and speaks
 * C-2 through `tests/helpers/luaLineClient.ts`, a raw line client: no bridge logic sits in between.
 * Engine-required: without a runnable engine these fail with the cause (`engineDescribe`, C-18).
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type Json, type LuaLineClient } from '../helpers/luaLineClient';

const REPO = path.resolve(__dirname, '..', '..');
const GOLDEN = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'builds', 'grenadator.xml'), 'utf8');
const PIN = JSON.parse(fs.readFileSync(path.join(REPO, 'pob-pin.json'), 'utf8')) as { version: string };

/** `export_stats`' default field list (`pob-api/API/BuildOps.lua` DEFAULT_STAT_FIELDS). */
const DEFAULT_STAT_FIELDS = [
  'Life', 'EnergyShield', 'Mana', 'Spirit', 'Ward',
  'Armour', 'Evasion',
  'FireResist', 'ColdResist', 'LightningResist', 'ChaosResist',
  'BlockChance', 'SpellBlockChance',
  'LifeRegen', 'ManaRegen',
  'TotalDPS', 'FullDPS', 'CombinedDPS',
];

const POE1_ROOT_XML =
  '<?xml version="1.0" encoding="UTF-8"?><PathOfBuilding><Build level="1" className="Witch"/></PathOfBuilding>';
/** The golden build cut in half, as a truncate-then-write save in progress would leave it. */
const MALFORMED_XML = GOLDEN.slice(0, Math.floor(GOLDEN.length / 2));

/** Passes pre-validation, then raises inside Build:Init (no class 999), which launch:OnFrame's PCall catches. */
const RAISING_XML =
  '<?xml version="1.0" encoding="UTF-8"?><PathOfBuilding2><Build level="1" targetVersion="0_1"/>' +
  '<Tree activeSpec="1"><Spec treeVersion="0_5" classId="999" ascendClassId="0" nodes=""/></Tree></PathOfBuilding2>';
/** Pass pre-validation, but Build:Init opens the game-version conversion popup instead of loading. */
const NO_TARGET_VERSION_XMLS: Array<{ kind: string; xml: string }> = [
  { kind: 'a missing', xml: '<?xml version="1.0" encoding="UTF-8"?><PathOfBuilding2><Build level="1"/></PathOfBuilding2>' },
  { kind: 'a legacy', xml: '<?xml version="1.0" encoding="UTF-8"?><PathOfBuilding2><Build level="1" targetVersion="0_0"/></PathOfBuilding2>' },
];

const ENGINE_TIMEOUT = 180_000;

/** Lua for AC-E3: the first unallocated node adjacent to an allocated non-ascendancy node. */
const PICK_ADJACENT_NODE = `
local spec = build.spec
local ids = {}
for id, node in pairs(spec.allocNodes) do
  if not node.ascendancyName then ids[#ids + 1] = id end
end
table.sort(ids)
for _, id in ipairs(ids) do
  local linked = {}
  for _, other in ipairs(spec.allocNodes[id].linked or {}) do linked[#linked + 1] = other end
  table.sort(linked, function(a, b) return a.id < b.id end)
  for _, other in ipairs(linked) do
    if not other.alloc and not other.ascendancyName
      and other.type ~= 'ClassStart' and other.type ~= 'AscendClassStart' then
      return other.id
    end
  end
end
return nil`;

async function expectAlive(client: LuaLineClient): Promise<void> {
  const reply = await client.request('ping');
  expect(reply).toMatchObject({ ok: true, pong: true });
}

async function buildName(client: LuaLineClient): Promise<string> {
  const reply = await client.request('get_build_info');
  expect(reply.ok).toBe(true);
  return reply.info.name as string;
}

engineDescribe('wire protocol v2, Lua side (C-2)', () => {
  let engine: LuaLineClient;

  beforeAll(async () => {
    engine = await startLuaLineClient();
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    if (engine) await engine.close();
  });

  it('AC-E1: the banner is the first line (ready, apiVersion 2.0.0, pinned version, no id); replies echo ids in order', async () => {
    const banner = JSON.parse(engine.firstLine) as Json;
    expect(banner.ok).toBe(true);
    expect(banner.ready).toBe(true);
    expect(banner.version.apiVersion).toBe('2.0.0');
    expect(banner.version.number).toBe('0.23.1');
    expect(banner.version.number).toBe(PIN.version);
    expect(banner).not.toHaveProperty('id');

    engine.send({ id: 7, action: 'ping' });
    engine.send({ id: 8, action: 'version' });
    engine.send({ id: 9, action: 'ping' });
    const replies = [await engine.next(), await engine.next(), await engine.next()];
    expect(replies.map((r) => r.id)).toEqual([7, 8, 9]);
    expect(replies[0]).toMatchObject({ id: 7, ok: true, pong: true });
    expect(replies[1]).toMatchObject({ id: 8, ok: true, version: { apiVersion: '2.0.0', number: '0.23.1' } });
    expect(replies[2]).toMatchObject({ id: 9, ok: true, pong: true });
  }, ENGINE_TIMEOUT);

  it('AC-E2: __test_cycle replies ENCODE for its id and the engine keeps answering; nosuch is UNKNOWN_ACTION; __test_eval returns its value', async () => {
    const cycle = await engine.request('__test_cycle', undefined, { id: 5 });
    expect(cycle).toMatchObject({ id: 5, ok: false, code: 'ENCODE' });
    expect(typeof cycle.error).toBe('string');
    await expectAlive(engine);

    const unknown = await engine.request('nosuch', {}, { id: 6 });
    expect(unknown).toMatchObject({ id: 6, ok: false, code: 'UNKNOWN_ACTION' });

    const evalReply = await engine.request('__test_eval', { code: 'return 1+1' });
    expect(evalReply).toMatchObject({ ok: true, result: 2 });
  }, ENGINE_TIMEOUT);

  it('C-2: an unparsable line replies INVALID_JSON without an id; a raising handler is EXCEPTION; ok=false without a code is FAILED', async () => {
    engine.writeLine('{not json');
    const invalid = await engine.next();
    expect(invalid).toMatchObject({ ok: false, code: 'INVALID_JSON' });
    expect(invalid).not.toHaveProperty('id');

    const raised = await engine.request('__test_eval', { code: 'error("boom")' }, { id: 11 });
    expect(raised).toMatchObject({ id: 11, ok: false, code: 'EXCEPTION' });
    expect(raised.error).toContain('boom');

    const failed = await engine.request('set_level', {}, { id: 12 });
    expect(failed).toMatchObject({ id: 12, ok: false, code: 'FAILED', error: 'missing level' });
    await expectAlive(engine);
  }, ENGINE_TIMEOUT);

  it('C-2: load_build_xml replies result.name (no build_id); new_build replies result.name', async () => {
    const loaded = await engine.request('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
    expect(loaded).toMatchObject({ ok: true, result: { name: 'Grenadator' } });
    expect(loaded).not.toHaveProperty('build_id');

    const fresh = await engine.request('new_build', {});
    expect(fresh.ok).toBe(true);
    expect(typeof fresh.result.name).toBe('string');
    expect(fresh.result.name).toBe(await buildName(engine));
  }, ENGINE_TIMEOUT);

  it('AC-E3: calc_with on an adjacent unallocated node replies only numbers for the default field list, and the engine survives', async () => {
    const loaded = await engine.request('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
    expect(loaded.ok).toBe(true);

    const pick = await engine.request('__test_eval', { code: PICK_ADJACENT_NODE });
    expect(pick.ok).toBe(true);
    expect(typeof pick.result).toBe('number');
    const nodeId = pick.result as number;

    const allocated = await engine.request('__test_eval', {
      code: `local n = build.spec.nodes[${nodeId}]; return n ~= nil and n.alloc == true`,
    });
    expect(allocated).toMatchObject({ ok: true, result: false });

    const calc = await engine.request('calc_with', { addNodes: [nodeId] });
    expect(calc.ok).toBe(true);
    const output = calc.output as Json;
    const keys = Object.keys(output);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain('Life');
    for (const key of keys) {
      expect(DEFAULT_STAT_FIELDS).toContain(key);
      expect(typeof output[key]).toBe('number');
    }
    await expectAlive(engine);
  }, ENGINE_TIMEOUT);

  it('AC-E4: get_stats omits the non-scalar ReqStrItem, lists it in _meta.omitted, and the engine stays alive', async () => {
    const loaded = await engine.request('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
    expect(loaded.ok).toBe(true);

    const reply = await engine.request('get_stats', { fields: ['ReqStrItem', 'Life'] });
    expect(reply.ok).toBe(true);
    expect(reply.stats.Life).toBe(2977);
    expect(reply.stats).not.toHaveProperty('ReqStrItem');
    expect(reply.stats._meta.omitted).toContain('ReqStrItem');
    await expectAlive(engine);
  }, ENGINE_TIMEOUT);

  it('AC-E6: a valid load whose post-check is forced to fail replies LOAD_FAILED, never ok:true', async () => {
    const reply = await engine.request('load_build_xml', {
      xml: GOLDEN,
      name: 'Forced',
      __forcePostCheckFailure: true,
    });
    expect(reply.ok).toBe(false);
    expect(reply.code).toBe('LOAD_FAILED');
    expect(reply.error).toMatch(/post-check/);
  }, ENGINE_TIMEOUT);

  it('AC-E6/C-2: a valid-root load that raises inside PoB (invalid classId) replies LOAD_FAILED carrying the promptMsg text, never ok:true', async () => {
    const before = await engine.request('load_build_xml', { xml: GOLDEN, name: 'BeforeRaise' });
    expect(before).toMatchObject({ ok: true, result: { name: 'BeforeRaise' } });

    const reply = await engine.request('load_build_xml', { xml: RAISING_XML, name: 'BadClass' });
    expect(reply.ok).toBe(false);
    expect(reply.code).toBe('LOAD_FAILED');
    expect(reply.error).toContain('PoB raised while loading the build');
    expect(reply.error).toContain('PassiveSpec.lua');
    expect(reply.error).not.toMatch(/\^\d/); // PoB colour codes are stripped

    // promptMsg is cleared before each load, so the next valid load succeeds.
    const after = await engine.request('load_build_xml', { xml: GOLDEN, name: 'AfterRaise' });
    expect(after).toMatchObject({ ok: true, result: { name: 'AfterRaise' } });
    expect(await buildName(engine)).toBe('AfterRaise');
    const state = await engine.request('__test_state');
    expect(state.result).toMatchObject({ promptMsg: null, popups: 0 });
  }, ENGINE_TIMEOUT);

  for (const variant of NO_TARGET_VERSION_XMLS) {
    it(`AC-E6/C-2: a <Build> with ${variant.kind} targetVersion replies LOAD_FAILED naming the cause and leaves no popup`, async () => {
      const before = await engine.request('load_build_xml', { xml: GOLDEN, name: 'BeforeConversion' });
      expect(before).toMatchObject({ ok: true, result: { name: 'BeforeConversion' } });

      const reply = await engine.request('load_build_xml', { xml: variant.xml, name: 'NoVersion' });
      expect(reply.ok).toBe(false);
      expect(reply.code).toBe('LOAD_FAILED');
      expect(reply.error).toContain('targetVersion is missing or legacy (expected 0_1)');
      const state = await engine.request('__test_state');
      expect(state.result.popups).toBe(0);

      const after = await engine.request('load_build_xml', { xml: GOLDEN, name: 'AfterConversion' });
      expect(after).toMatchObject({ ok: true, result: { name: 'AfterConversion' } });
      expect(await buildName(engine)).toBe('AfterConversion');
      const life = await engine.request('get_stats', { fields: ['Life'] });
      expect(life.stats.Life).toBe(2977);
    }, ENGINE_TIMEOUT);
  }
});

engineDescribe('wire protocol v2 without POB_API_TEST_ACTIONS', () => {
  let engine: LuaLineClient;

  beforeAll(async () => {
    engine = await startLuaLineClient({ testActions: false });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    if (engine) await engine.close();
  });

  it('AC-E2: without POB_API_TEST_ACTIONS, __test_cycle and __test_eval reply UNKNOWN_ACTION', async () => {
    const cycle = await engine.request('__test_cycle', undefined, { id: 21 });
    expect(cycle).toMatchObject({ id: 21, ok: false, code: 'UNKNOWN_ACTION' });
    const evalReply = await engine.request('__test_eval', { code: 'return 1+1' }, { id: 22 });
    expect(evalReply).toMatchObject({ id: 22, ok: false, code: 'UNKNOWN_ACTION' });
    expect(evalReply).not.toHaveProperty('result');
    await expectAlive(engine);
  }, ENGINE_TIMEOUT);

  it('AC-E6: without POB_API_TEST_ACTIONS the __forcePostCheckFailure override is ignored', async () => {
    const reply = await engine.request('load_build_xml', {
      xml: GOLDEN,
      name: 'Grenadator',
      __forcePostCheckFailure: true,
    });
    expect(reply).toMatchObject({ ok: true, result: { name: 'Grenadator' } });
  }, ENGINE_TIMEOUT);
});

const BAD_LOADS: Array<{ kind: string; xml: string; cause: string }> = [
  { kind: 'PoE1-root XML', xml: POE1_ROOT_XML, cause: 'root element is PathOfBuilding, expected PathOfBuilding2' },
  { kind: 'malformed XML', xml: MALFORMED_XML, cause: 'XML parse error' },
  { kind: 'empty string', xml: '', cause: 'empty XML' },
];

describe('AC-E5 sequences', () => {
  for (const bad of BAD_LOADS) {
    engineDescribe(`AC-E5: valid golden → ${bad.kind} → valid (G2) → valid (G3)`, () => {
      let engine: LuaLineClient;

      beforeAll(async () => {
        engine = await startLuaLineClient();
      }, ENGINE_TIMEOUT);

      afterAll(async () => {
        if (engine) await engine.close();
      });

      const expectCleanState = async () => {
        const state = await engine.request('__test_state');
        expect(state.ok).toBe(true);
        expect(state.result.devAutoSaveDisabled).toBe(true);
        expect(state.result.popups).toBe(0);
      };

      it(`AC-E5 (${bad.kind}): the bad load replies LOAD_FAILED naming the cause, leaves the build untouched, and later valid loads succeed`, async () => {
        const first = await engine.request('load_build_xml', { xml: GOLDEN, name: 'Grenadator' });
        expect(first).toMatchObject({ ok: true, result: { name: 'Grenadator' } });
        expect(await buildName(engine)).toBe('Grenadator');
        await expectCleanState();

        const failed = await engine.request('load_build_xml', { xml: bad.xml, name: 'Bad' });
        expect(failed.ok).toBe(false);
        expect(failed.code).toBe('LOAD_FAILED');
        expect(failed.error).toContain(bad.cause);
        expect(await buildName(engine)).toBe('Grenadator');
        await expectCleanState();

        const g2 = await engine.request('load_build_xml', { xml: GOLDEN, name: 'G2' });
        expect(g2).toMatchObject({ ok: true, result: { name: 'G2' } });
        expect(await buildName(engine)).toBe('G2');
        await expectCleanState();

        const g3 = await engine.request('load_build_xml', { xml: GOLDEN, name: 'G3' });
        expect(g3).toMatchObject({ ok: true, result: { name: 'G3' } });
        expect(await buildName(engine)).toBe('G3');
        await expectCleanState();

        const life = await engine.request('get_stats', { fields: ['Life'] });
        expect(life.stats.Life).toBe(2977);
      }, ENGINE_TIMEOUT);
    });
  }
});
