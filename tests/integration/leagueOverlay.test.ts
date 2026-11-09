/**
 * AC-W159 (WU-166, amendment 16 §19, D-523; C-66), the engine half: the league overlay.
 *
 * - **Lua-direct** (bootstrap step 5e, `pob-api/API/Overlay.lua`): the engine started with a sidecar list in
 *   `POB2_OVERLAY_SIDECARS` adds a socketable for every slot key of `data/league/rune-slots.json` and a unique; an item of
 *   each slot type parses with the overlay entry loaded and takes its line; an entry the pin already defines (a soul core
 *   and a unique of PoB's) is skipped, logged and left as PoB has it; the items tab's rune list holds the overlay's.
 * - **Through the server** (`startSessionFixture`, its own temporary `deps.stateDir`): `guide_run {new_run}` names the
 *   league folder; a plan whose helmet holds an overlay soul core compiles before the sidecar exists with the item text's
 *   own rune line, and, once a sidecar appears in the league folder after the engine started, the engine restarts before
 *   the next compile and measures the soul core from the sidecar's line, the record's `overlay` naming it; the lookups
 *   mark the overlay's entries "not in PoB's release".
 *
 * The sidecars are written here, by hand, in Appendix A.11's form; their entries are invented, none poe2db's.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type LuaLineClient } from '../helpers/luaLineClient';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';
import { OVERLAY_LIMITS } from '../../src/services/leagueOverlay';

const REPO = path.resolve(__dirname, '..', '..');
const LICH = path.join(REPO, 'tests', 'fixtures', 'plans', 'm27-wu137', 'lich', 'plan.json');
const SLOTS = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'league', 'rune-slots.json'), 'utf8')).labels as Record<string, string[]>;
const ENGINE_TIMEOUT = 600_000;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Every PoB slot key the table maps a label to. */
const KEYS = [...new Set(Object.values(SLOTS).flat())].sort();
/** The pin's own statOrders for "+# to maximum Life" and "+#% to Chaos Resistance" (rune lines, Data/ModRunes.lua). */
const LIFE_ORDER = 887;
const CHAOS_ORDER = 1024;
const TEST_RUNE = 'Saltmarsh Test Rune';
const TEST_UNIQUE = 'Saltmarsh Loop';
const PIN_CORE = "Hayoxi's Soul Core of Heatproofing";
const CORE = "Brinewarden's Soul Core of Tides";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'league-overlay-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function writeSidecar(file: string, sidecar: Json): string {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(sidecar, null, 2)}\n`);
  return file;
}

/** A sidecar with one socketable on every slot key, a unique on a pin base, and two entries the pin already defines. */
const ALL_SLOTS = writeSidecar(path.join(tmp, 'lua', 'saltmarsh-rites.overlay.json'), {
  schemaVersion: 1,
  league: 'Saltmarsh Rites',
  fetched: '2026-11-09',
  socketables: [
    { name: TEST_RUNE, type: 'Rune', rank: [20], socketBound: false, slots: KEYS.map((k) => ({ label: k, keys: [k], lines: ['+7 to maximum Life'], statOrder: [LIFE_ORDER] })) },
    { name: PIN_CORE, type: 'SoulCore', rank: [50], socketBound: false, slots: [{ label: 'Helmets', keys: ['helmet'], lines: ['+99 to maximum Life'], statOrder: [LIFE_ORDER] }] },
    // Two malformed entries, each refused whole: a statOrder that isn't a number (it would break the rune list's sort,
    // outside the per-file pcall) and a type that isn't a string.
    { name: 'Bad Order Rune', type: 'Rune', rank: [1], socketBound: false, slots: [{ label: 'Helmets', keys: ['helmet'], lines: ['+1 to maximum Life'], statOrder: ['x'] }] },
    { name: 'Bad Type Rune', type: 5, rank: [1], socketBound: false, slots: [{ label: 'Helmets', keys: ['helmet'], lines: ['+1 to maximum Life'], statOrder: [LIFE_ORDER] }] },
    // And a rank that isn't a number (PoB reads rank[1] of every rune of a slot type).
    { name: 'Bad Rank Rune', type: 'Rune', rank: ['x'], socketBound: false, slots: [{ label: 'Helmets', keys: ['helmet'], lines: ['+1 to maximum Life'], statOrder: [LIFE_ORDER] }] },
  ],
  uniques: [
    { name: TEST_UNIQUE, base: 'Gold Ring', level: 30, implicits: ['(6-15)% increased Rarity of Items found'], explicits: ['+(30-40) to maximum Life', '+(10-15)% to Cold Resistance'] },
    { name: 'Andvarius', base: 'Gold Ring', level: 1, implicits: [], explicits: ['+1 to maximum Life'] },
  ],
  skipped: [],
});

engineDescribe('AC-W159 (WU-166, D-523): the overlay, bootstrap step 5e (Lua-direct)', () => {
  let lua: LuaLineClient;
  let facts: Json;

  beforeAll(async () => {
    lua = await startLuaLineClient({ env: { POB2_OVERLAY_SIDECARS: JSON.stringify([ALL_SLOTS]) } });
    const reply = await lua.request(
      '__test_eval',
      {
        code: `
local Overlay = require('API.Overlay')
local keys = ${JSON.stringify(KEYS).replace(/^\[/, '{').replace(/\]$/, '}')}
local out = { added = Overlay.names(), slots = {}, pinCore = data.itemMods.Runes[${JSON.stringify(PIN_CORE)}].helmet[1],
  isOverlay = { rune = Overlay.is_overlay(${JSON.stringify(TEST_RUNE)}), pinCore = Overlay.is_overlay(${JSON.stringify(PIN_CORE)}), andvarius = Overlay.is_overlay('Andvarius') } }
-- One base per slot key: the first base (by name) whose broad or specific augment type is the key.
local names = {}
for name in pairs(data.itemBases) do names[#names + 1] = name end
table.sort(names)
local byKey = {}
for _, name in ipairs(names) do
  local ok, item = pcall(new, 'Item', 'Rarity: Normal\\n' .. name)
  if ok and item and item.base and (item.base.weapon or item.base.armour or item.base.tags.wand or item.base.tags.staff or item.base.tags.sceptre) then
    local broad, specific = item:GetSocketedAugmentTypes()
    for _, k in ipairs({ broad, specific }) do
      if k and not byKey[k] then byKey[k] = name end
    end
  end
end
for _, k in ipairs(keys) do
  local base = byKey[k]
  local row = { key = k, base = base }
  if base then
    -- PoB's own item of the slot type, and one holding the overlay's rune, each parsed and its runes rebuilt.
    local okPlain, plain = pcall(new, 'Item', 'Rarity: Normal\\n' .. base .. '\\nSockets: S')
    row.plain = okPlain and plain.base ~= nil
    local okRune, item = pcall(function()
      local it = new('Item', 'Rarity: Normal\\n' .. base .. '\\nSockets: S\\nRune: ${TEST_RUNE}\\n{rune}+1 to maximum Life')
      it:UpdateRunes()
      return it
    end)
    row.parsed = okRune
    row.lines = {}
    if okRune then for _, l in ipairs(item.runeModLines or {}) do row.lines[#row.lines + 1] = l.line end end
  end
  out.slots[#out.slots + 1] = row
end
-- The items tab's rune list (its file-local), through the upvalue step 5e set.
local itemsTab = common.classes.ItemsTab
local list
for i = 1, 200 do
  local n, v = debug.getupvalue(itemsTab.GetValidRunesForItem, i)
  if n == nil then break end
  if n == 'runeModLines' then list = v end
end
out.runeListHas = false
out.runeListBad = false
out.runeListSorted = true
for i, r in ipairs(list or {}) do
  if r.name == ${JSON.stringify(TEST_RUNE)} then out.runeListHas = true end
  if r.name == 'Bad Order Rune' or r.name == 'Bad Type Rune' or r.name == 'Bad Rank Rune' then out.runeListBad = true end
  if type(r.order) ~= 'number' then out.runeListSorted = false end
end
out.badInData = data.itemMods.Runes['Bad Order Rune'] ~= nil or data.itemMods.Runes['Bad Type Rune'] ~= nil or data.itemMods.Runes['Bad Rank Rune'] ~= nil
-- The unique, in PoB's unique database.
local unique
for _, it in pairs(main.uniqueDB.list) do if it.title == ${JSON.stringify(TEST_UNIQUE)} then unique = it end end
out.unique = unique and { base = unique.baseName, explicit = #unique.explicitModLines, implicit = #unique.implicitModLines } or false
local andvarius = 0
for _, it in pairs(main.uniqueDB.list) do if it.title == 'Andvarius' then andvarius = andvarius + 1 end end
out.andvarius = andvarius
return out`,
      },
      { timeoutMs: 300_000 },
    );
    expect(reply.ok).toBe(true);
    facts = reply.result as Json;
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await lua?.close();
  });

  it('adds the socketable and the unique, and only those: the entries the pin already defines are skipped (retired) and logged', () => {
    expect(facts.added).toEqual([TEST_UNIQUE, TEST_RUNE].sort());
    expect(facts.isOverlay).toEqual({ rune: true, pinCore: false, andvarius: false });
    // PoB's own soul core and unique stay as PoB has them.
    expect(facts.pinCore).toBe('+40% of Armour also applies to Cold Damage');
    expect(facts.andvarius).toBe(1);
    expect(lua.stderr()).toContain(`[Overlay] ${PIN_CORE} is in PoB's release: skipped (retired)`);
    expect(lua.stderr()).toContain("[Overlay] Andvarius is in PoB's release: skipped (retired)");
  });

  it('an item of each slot type parses with the overlay entry loaded, PoB\'s own item of that type too, and takes the overlay\'s line', () => {
    const rows = facts.slots as Json[];
    // Every key but PoB's own "martial weapon wand or staff" (a key no item type has) has an item type.
    const withBase = rows.filter((r) => r.base);
    expect(rows.filter((r) => !r.base).map((r) => r.key)).toEqual(['martial weapon wand or staff']);
    expect(withBase.length).toBe(KEYS.length - 1);
    for (const r of withBase) {
      expect({ key: r.key, plain: r.plain, parsed: r.parsed }).toEqual({ key: r.key, plain: true, parsed: true });
      // The rebuilt rune line is the overlay's (+7, once per key the item's types match), never the text's +1.
      expect({ key: r.key, lines: r.lines.every((l: string) => /^\+\d+ to maximum Life$/.test(l) && l !== '+1 to maximum Life'), some: r.lines.length > 0 }).toEqual({ key: r.key, lines: true, some: true });
    }
  });

  it('refuses an entry whose statOrder or rank is no number or whose type is no string, logged, and step 5e goes on to the others', () => {
    expect({ inData: facts.badInData, inList: facts.runeListBad, ordered: facts.runeListSorted }).toEqual({ inData: false, inList: false, ordered: true });
    expect(lua.stderr()).toContain('Bad Order Rune: the statOrder of "+1 to maximum Life" is not a number');
    expect(lua.stderr()).toContain('Bad Type Rune: its type is not a string');
    expect(lua.stderr()).toContain('Bad Rank Rune: its rank is not a number');
  });

  it("puts the socketable in the items tab's rune list, and the unique in PoB's unique database", () => {
    expect(facts.runeListHas).toBe(true);
    expect(facts.unique).toEqual({ base: 'Gold Ring', explicit: 2, implicit: 1 });
  });
});

const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;

// The text's own rune line, +1%, is what PoB keeps for a rune it doesn't know; one it knows it rebuilds from its data.
const HELMET = ['Rarity: Rare', 'Brine Crown', 'Sorcerous Tiara', 'Sockets: S', `Rune: ${CORE}`, 'Implicits: 0', '{rune}+1% to Chaos Resistance', '+40 to maximum Energy Shield'].join('\n');
/** The sidecar that adds the helmet's soul core, +17% to Chaos Resistance. */
const CORE_SIDECAR = (league: string, file = 'saltmarsh-rites.overlay.json') =>
  writeSidecar(path.join(league, file), {
    schemaVersion: 1,
    league: 'Saltmarsh Rites',
    fetched: '2026-11-09',
    socketables: [{ name: CORE, type: 'SoulCore', rank: [50], socketBound: false, slots: [{ label: 'Helmets', keys: ['helmet'], lines: ['+17% to Chaos Resistance'], statOrder: [CHAOS_ORDER] }] }],
    uniques: [{ name: TEST_UNIQUE, base: 'Gold Ring', level: 30, implicits: ['(6-15)% increased Rarity of Items found'], explicits: ['+(30-40) to maximum Life'] }],
    skipped: [],
  });

/** The LICH fixture's stage with the helmet, compiled measure-only in a run folder of `f`; its record. */
async function compileHelmet(f: SessionFixture, slug: string): Promise<CompileRecord> {
  const plan = read(LICH);
  const s = plan.stages[0];
  s.items.slots = [...s.items.slots.filter((x: Json) => x.slot !== 'Helmet'), { slot: 'Helmet', text: HELMET }];
  plan.stages = [s];
  const made = await f.call('guide_run', { new_run: slug });
  if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
  const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
  const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
  fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
  const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
  expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
  return read(path.join(abs, 'compile-record.json')) as unknown as CompileRecord;
}

engineDescribe('AC-W159 (WU-166, D-523): the overlay through the server, a sidecar in the league folder', () => {
  let f: SessionFixture;
  let league: string;
  const compile = (slug: string) => compileHelmet(f, slug);

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    league = path.join(path.resolve(f.server.deps.stateDir), 'league');
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it(
    "guide_run {new_run} names the league folder; a sidecar that appears there after the engine started is measured at the next compile, and the record's overlay names its item",
    async () => {
      const made = await f.call('guide_run', { new_run: 'overlay-check' });
      expect(made.text.split('\n')).toContain(`leagueFolder: ${league}`);
      // It exists once named, so pob2-league-digest --running, which writes only an existing league folder, can.
      expect(fs.statSync(league).isDirectory()).toBe(true);
      // Before any sidecar: the engine starts with none, and the text's own rune line is what PoB measures.
      const before = await compile('overlay-before');
      const stage = Object.keys(before.stages)[0];
      const pid = f.session.enginePid();
      expect(pid).not.toBeNull();
      expect(before.stages[stage].overlay).toBeUndefined();
      // The sidecar appears while the engine runs.
      CORE_SIDECAR(league);
      const after = await compile('overlay-after');
      // The engine restarted to read it (bootstrap step 5e), and the soul core's line is the sidecar's: +17% for +1%.
      expect(f.session.enginePid()).not.toBe(pid);
      expect(before.stages[stage].outputs.ChaosResist).toBeLessThan(50);
      expect(after.stages[stage].outputs.ChaosResist - before.stages[stage].outputs.ChaosResist).toBe(16);
      expect(after.stages[stage].overlay).toEqual([CORE]);
    },
    ENGINE_TIMEOUT,
  );

  it('the lookups mark the overlay\'s entries "not in PoB\'s release": a unique, and a socketable\'s mod hit', async () => {
    const unique = await f.call('lookup_game_data', { mode: 'unique', query: TEST_UNIQUE });
    expect(unique.isError).toBe(false);
    expect(unique.text).toContain(`## ${TEST_UNIQUE} (Ring)`);
    expect(unique.text).toContain("Not in PoB's release: the league overlay adds it from poe2db's lines (D-523).");
    // The overlay's limits, once in the reply (§19: wherever an overlay item is shown).
    expect(unique.text.split(OVERLAY_LIMITS).length - 1).toBe(1);
    const mod = await f.call('lookup_game_data', { mode: 'mechanic', query: '+17% to Chaos Resistance', kind: 'mod' });
    expect(mod.isError).toBe(false);
    expect(mod.text).toContain(`[mod] ${CORE} (helmet) (Runes mods): +17% to Chaos Resistance (not in PoB's release: the league overlay's, from poe2db)`);
    expect(mod.text.split(OVERLAY_LIMITS).length - 1).toBe(1);
    // PoB's own soul core carries no mark.
    const pin = await f.call('lookup_game_data', { mode: 'mechanic', query: '+11% to Chaos Resistance', kind: 'mod' });
    expect(pin.text).toContain('(Runes mods): +11% to Chaos Resistance');
    expect(pin.text).not.toContain("not in PoB's release");
    expect(pin.text).not.toContain(OVERLAY_LIMITS);
  }, ENGINE_TIMEOUT);
});

engineDescribe('AC-W159 (WU-166, D-523): a changed sidecar list restarts the engine and keeps the build', () => {
  let f: SessionFixture;
  let league: string;
  let n = 0;
  /** A new sidecar in the league folder, holding a unique of its own. */
  const sidecarNow = () => {
    n += 1;
    return writeSidecar(path.join(league, `restart-${n}.overlay.json`), {
      schemaVersion: 1,
      league: 'Saltmarsh Rites',
      fetched: '2026-11-09',
      socketables: [],
      uniques: [{ name: `Brine Loop ${n}`, base: 'Gold Ring', level: 1, implicits: [], explicits: ['+(10-20) to maximum Life'] }],
      skipped: [],
    });
  };
  const level = async (): Promise<number> => {
    const { value } = await f.session.run({ tool: 'test:level', kind: 'read' }, async (ctx) => (await ctx.client.request('__test_eval', { code: 'return build.characterLevel' })).result as number);
    return value;
  };

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    league = path.join(path.resolve(f.server.deps.stateDir), 'league');
    fs.mkdirSync(league, { recursive: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it(
    'an unchanged sidecar list keeps the same engine across loads; a changed one restarts it, and lua_reload_build {} still reloads its file',
    async () => {
      expect((await f.call('lua_load_build', { build_name: 'grenadator' })).isError).toBe(false);
      const pid = f.session.enginePid();
      expect((await f.call('lua_load_build', { build_name: 'grenadator' })).isError).toBe(false);
      expect(f.session.enginePid()).toBe(pid);
      sidecarNow();
      const revision = f.session.revision;
      const reload = await f.call('lua_reload_build', {});
      expect({ isError: reload.isError, text: reload.isError ? reload.text : '' }).toEqual({ isError: false, text: '' });
      expect(reload.text).toContain("The league overlay's sidecars changed: the engine restarted to read them and restored the build");
      expect(f.session.enginePid()).not.toBe(pid);
      expect(f.session.loaded?.path).toBe('grenadator.xml');
      // The revision moves at the restart (the numbers may), then again for the reload.
      expect(f.session.revision).toBe(revision + 2);
      expect(f.session.isDirty()).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "a load that fails after a sidecar change keeps the build and its unsaved changes",
    async () => {
      expect((await f.call('set_character_level', { level: 77 })).isError).toBe(false);
      expect(f.session.isDirty()).toBe(true);
      const pid = f.session.enginePid();
      sidecarNow();
      const missing = await f.call('lua_load_build', { build_name: 'no-such-build' });
      expect(missing.isError).toBe(true);
      expect(f.session.enginePid()).not.toBe(pid);
      expect(f.session.loaded?.path).toBe('grenadator.xml');
      expect(f.session.isDirty()).toBe(true);
      expect(await level()).toBe(77);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'a lookup sees an entry of a sidecar written after the engine started, the build kept as it was',
    async () => {
      const pid = f.session.enginePid();
      const dirty = f.session.isDirty();
      const revision = f.session.revision;
      sidecarNow();
      const found = await f.call('lookup_game_data', { mode: 'unique', query: `Brine Loop ${n}` });
      expect(found.isError).toBe(false);
      expect(found.text).toContain(`## Brine Loop ${n} (Ring)`);
      expect(found.text).toContain("Not in PoB's release");
      expect(f.session.enginePid()).not.toBe(pid);
      expect(f.session.revision).toBe(revision + 1);
      expect(f.session.isDirty()).toBe(dirty);
      expect(f.session.loaded?.path).toBe('grenadator.xml');
      expect(await level()).toBe(77);
      // And no restart while the list stays as it is.
      const again = f.session.enginePid();
      expect((await f.call('lookup_game_data', { mode: 'unique', query: `Brine Loop ${n}` })).isError).toBe(false);
      expect(f.session.enginePid()).toBe(again);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "an engine not restarted (its build changed, with no snapshot to restore) keeps its sidecars, and the record's overlay names only what it loaded",
    async () => {
      // The build changed since the engine's spawn; a failed export leaves no snapshot (set here by hand).
      expect(f.session.revision).toBeGreaterThan(0);
      (f.session as unknown as { snapshot: unknown }).snapshot = null;
      const pid = f.session.enginePid();
      CORE_SIDECAR(league, 'core.overlay.json');
      const kept = await compileHelmet(f, 'overlay-kept');
      const stage = Object.keys(kept.stages)[0];
      // No restart: the engine never read the new sidecar, so the record names no overlay item, and the soul core's
      // line is the item text's own.
      expect(f.session.enginePid()).toBe(pid);
      expect(kept.stages[stage].overlay).toBeUndefined();
      // That compile left a snapshot, so the next call restarts and the engine reads the sidecar.
      const read2 = await compileHelmet(f, 'overlay-read');
      expect(f.session.enginePid()).not.toBe(pid);
      expect(read2.stages[stage].overlay).toEqual([CORE]);
      expect(read2.stages[stage].outputs.ChaosResist - kept.stages[stage].outputs.ChaosResist).toBe(16);
    },
    ENGINE_TIMEOUT,
  );
});

describe('the sidecar fixture (self-check)', () => {
  it('names a slot for every key of the table, each with its statOrder', () => {
    const sidecar = read(ALL_SLOTS);
    expect(sidecar.socketables[0].slots.map((s: Json) => s.keys[0])).toEqual(KEYS);
    for (const s of sidecar.socketables[0].slots) expect(s.statOrder.length).toBe(s.lines.length);
  });
});
