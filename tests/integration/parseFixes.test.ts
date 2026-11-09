/**
 * AC-P95 (WU-139, amendment 14 §18, D-492, PG-103; engine, Lua-direct): the bridge's parse fix for Crystalline
 * Phylactery.
 *
 * PoB's tree at the pin gives node 17788 (the Lich's jewel socket, and its Abyssal Lich copy) the line "100% increased
 * Effect of bonuses gained from Socketed Jewel", which PoB parses only partly (`Data/ModCache.lua`:1356), so a jewel
 * there counts once. `pob-api/API/ParseFixes.lua`, applied by `bootstrap.lua`, sets the line's parse-cache entry to
 * `SocketedJewelEffect INC 100` and re-processes the node and its switch copies.
 *
 * Builds load directly through the engine's `load_build_xml` (not through `compile_plan`). The fixtures
 * (`tests/fixtures/plans/m27-wu139/`) are written from the pinned game data: a level-90 Witch, Lich or Abyssal Lich,
 * with the Lich path to 17788 (58751, 17788) and the Witch's path to the nearest main-tree jewel socket (61419) both
 * allocated, as PoB's own pathing finds them, and one Ruby with a line of its mod pool, "20% increased Armour"
 * (JewelArmour, `Data/ModJewel.lua`:10), in 17788 or in 61419. Only the Ruby moves between the two files of an
 * ascendancy, so the difference is the socket's.
 *
 * AC-B5's golden values hold with the fix applied: `tests/integration/golden.test.ts` runs on the same bootstrap.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type LuaLineClient } from '../helpers/luaLineClient';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'plans', 'm27-wu139');
const PIN_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const ENGINE_TIMEOUT = 180_000;

const LINE = '100% increased Effect of bonuses gained from Socketed Jewel';
const PHYLACTERY = 17788;
const MAIN_SOCKET = 61419;
/** The Ruby's line value: "20% increased Armour". */
const JEWEL_VALUE = 20;

const ASCENDANCIES = [
  { name: 'Lich', file: 'lich' },
  { name: 'Abyssal Lich', file: 'abyssal-lich' },
] as const;

const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

/** What a loaded build reads: its ascendancy, the sockets holding the Ruby, and the Armour increase in its mod DB. */
const MEASURE = `
  local spec = build.spec
  local sockets = {}
  for nodeId, itemId in pairs(spec.jewels) do
    if itemId and itemId > 0 then sockets[#sockets + 1] = nodeId end
  end
  return {
    ascendancy = spec.curAscendClassName,
    phylactery = spec.allocNodes[${PHYLACTERY}] ~= nil,
    mainSocket = spec.allocNodes[${MAIN_SOCKET}] ~= nil,
    sockets = sockets,
    nodeJewelEffect = spec.nodes[${PHYLACTERY}].modList:Sum('INC', nil, 'SocketedJewelEffect'),
    armourInc = build.calcsTab.mainEnv.player.modDB:Sum('INC', nil, 'Armour'),
  }`;

interface Measure {
  ascendancy: string;
  phylactery: boolean;
  mainSocket: boolean;
  sockets: number[];
  nodeJewelEffect: number;
  armourInc: number;
}

/** A parse as Lua returns it: the mod list (or nil) and the remainder (or nil). */
interface Parse {
  list?: Array<{ name: string; type: string; value: number }>;
  extra?: string;
}

engineDescribe("AC-P95 (WU-139): the bridge's parse fix for Crystalline Phylactery (D-492, PG-103)", () => {
  let engine: LuaLineClient;

  const evalLua = async <T>(code: string): Promise<T> => {
    const reply = await engine.request('__test_eval', { code }, { timeoutMs: 120_000 });
    expect({ ok: reply.ok, error: reply.error }).toEqual({ ok: true, error: undefined });
    return reply.result as T;
  };

  const measure = async (file: string): Promise<Measure> => {
    const reply = await engine.request('load_build_xml', { xml: fixture(file), name: file }, { timeoutMs: 120_000 });
    expect({ file, ok: reply.ok, error: reply.error }).toEqual({ file, ok: true, error: undefined });
    return evalLua<Measure>(MEASURE);
  };

  beforeAll(async () => {
    engine = await startLuaLineClient({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await engine?.close();
  });

  it(
    "with 17788 allocated and a Ruby in it, the jewel's line counts twice against the same Ruby in a main-tree socket, for a Lich and an Abyssal Lich",
    async () => {
      for (const asc of ASCENDANCIES) {
        const inPhylactery = await measure(`${asc.file}-ruby-in-phylactery.xml`);
        const inMain = await measure(`${asc.file}-ruby-in-main-socket.xml`);
        // The same tree in both: the ascendancy, 17788 and the main-tree socket allocated; only the Ruby moves.
        for (const [m, socket] of [[inPhylactery, PHYLACTERY], [inMain, MAIN_SOCKET]] as const) {
          expect({ asc: asc.name, ascendancy: m.ascendancy, phylactery: m.phylactery, mainSocket: m.mainSocket, sockets: m.sockets })
            .toEqual({ asc: asc.name, ascendancy: asc.name, phylactery: true, mainSocket: true, sockets: [socket] });
        }
        // In a main-tree socket the line counts at its value; in the Phylactery, at twice it.
        expect({ asc: asc.name, main: inMain.armourInc, phylactery: inPhylactery.armourInc })
          .toEqual({ asc: asc.name, main: JEWEL_VALUE, phylactery: 2 * JEWEL_VALUE });
        expect({ asc: asc.name, nodeJewelEffect: inPhylactery.nodeJewelEffect }).toEqual({ asc: asc.name, nodeJewelEffect: 100 });
      }
    },
    ENGINE_TIMEOUT,
  );

  it(
    'the fix re-processes 17788 and each of its switch copies (the Abyssal Lich\'s among them): each reads SocketedJewelEffect INC 100 and no remainder',
    async () => {
      const nodes = await evalLua<Array<{ copy: string; jewelEffect: number; extra: boolean; lineExtra: string | null }>>(`
        local tree = main.tree[latestTreeVersion]
        local node = tree.nodes[${PHYLACTERY}]
        local function read(copy, n)
          local lineExtra = false
          for i, stat in ipairs(n.sd) do
            if stat == ${JSON.stringify(LINE)} then lineExtra = n.mods[i] and n.mods[i].extra or false end
          end
          return { copy = copy, jewelEffect = n.modList:Sum('INC', nil, 'SocketedJewelEffect'), extra = n.extra == true, lineExtra = lineExtra }
        end
        local out = { read('base', node) }
        local names = {}
        for name in pairs(node.options or {}) do names[#names + 1] = name end
        table.sort(names)
        for _, name in ipairs(names) do out[#out + 1] = read(name, node.options[name]) end
        return out`);
      expect(nodes.map((n) => n.copy)).toEqual(['base', 'Abyssal Lich']);
      for (const n of nodes) expect(n).toEqual({ copy: n.copy, jewelEffect: 100, extra: false, lineExtra: false });
    },
    ENGINE_TIMEOUT,
  );

  // D-509: the retirement test's "bug still present" case holds only its assertion, so a setup error fails the case
  // before it and not this one, which returns when the setup left nothing to assert on (amendment 16 §5); PG-103's
  // entry names it as its `test`.
  describe('with the fix list off', () => {
    let off: { cached: Parse; parsed: Parse; rubies: Array<{ asc: string; armourInc: number; nodeJewelEffect: number }> } | undefined;

    it(
      "turns the fix list off, reads PoB's own parses of the line and the Ruby in 17788, and turns the list back on",
      async () => {
        // The tree's line is the one the fix lists.
        const tree = fs.readFileSync(path.join(PIN_SRC, 'TreeData', '0_5', 'tree.lua'), 'utf8');
        expect(tree).toContain(`[2]="${LINE}",`);
        try {
          const reverted = await evalLua<Array<{ pg: string }>>(`return require('API.ParseFixes').revert()`);
          expect(reverted.map((r) => r.pg)).toEqual(['PG-103']);

          // PoB's own reading: its cache entry (Data/ModCache.lua) and its parser's.
          const cached = await evalLua<Parse>(`local list, extra = modLib.parseMod(${JSON.stringify(LINE)}) return { list = list, extra = extra }`);
          const parsed = await evalLua<Parse>(
            `local list, extra = require('API.ParseFixes').pob_parse(${JSON.stringify(LINE)}) return { list = list, extra = extra }`,
          );
          // And the Ruby in 17788, which the node's line scales.
          const rubies = [];
          for (const asc of ASCENDANCIES) {
            const m = await measure(`${asc.file}-ruby-in-phylactery.xml`);
            rubies.push({ asc: asc.name, armourInc: m.armourInc, nodeJewelEffect: m.nodeJewelEffect });
          }
          off = { cached, parsed, rubies };

          // The fix's mod is what PoB's parser gives the older wording it does read (ModParser.lua:895-897).
          const older = await evalLua<Parse>(
            `local list, extra = require('API.ParseFixes').pob_parse('100% increased Effect of the Socketed Jewel') return { list = list, extra = extra }`,
          );
          expect(older.extra).toBeUndefined();
          expect((older.list ?? []).map((m) => [m.name, m.type, m.value])).toEqual([['SocketedJewelEffect', 'INC', 100]]);
        } finally {
          await evalLua(`require('API.ParseFixes').apply() return true`);
        }
        const back = await measure('lich-ruby-in-phylactery.xml');
        expect(back.armourInc).toBe(2 * JEWEL_VALUE);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "with the fix list off, PoB's own parse of the line leaves a remainder and the Ruby counts once in 17788 (if this fails, PoB parses the line itself: remove PG-103's entry from pob-api/API/ParseFixes.lua)",
      () => {
        // Unset only when the case before failed, which carries the setup error (D-509): this case asserts the bug alone.
        if (!off) return;
        // Each parse leaves a remainder and gives no SocketedJewelEffect, so the node adds nothing and the Ruby in 17788
        // counts as in a main-tree socket.
        const reading = (source: string, parse: Parse) => ({
          source,
          remainder: typeof parse.extra === 'string' && parse.extra.trim().length > 0,
          jewelEffect: (parse.list ?? []).some((m) => m.name === 'SocketedJewelEffect'),
        });
        expect({ parses: [reading('ModCache.lua', off.cached), reading('ModParser', off.parsed)], rubies: off.rubies }).toEqual({
          parses: [
            { source: 'ModCache.lua', remainder: true, jewelEffect: false },
            { source: 'ModParser', remainder: true, jewelEffect: false },
          ],
          rubies: ASCENDANCIES.map((asc) => ({ asc: asc.name, armourInc: JEWEL_VALUE, nodeJewelEffect: 0 })),
        });
      },
    );
  });
});

describe('ParseFixes.lua lists each fix with its PoB gap (D-492)', () => {
  it('names PG-103 for the Phylactery line and node 17788; bootstrap applies the list after the tree loads, before the server starts', () => {
    const src = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'ParseFixes.lua'), 'utf8');
    expect(src).toContain(`pg = 'PG-103'`);
    expect(src).toContain(`line = '${LINE}'`);
    expect(src).toContain(`mods = { { name = 'SocketedJewelEffect', type = 'INC', value = 100 } }`);
    expect(src).toMatch(/nodes = \{ 17788 \}/);
    const bootstrap = fs.readFileSync(path.join(REPO, 'pob-api', 'bootstrap.lua'), 'utf8');
    expect(bootstrap.indexOf("require('API.ParseFixes').apply()")).toBeGreaterThan(bootstrap.indexOf("dofile('HeadlessWrapper.lua')"));
    expect(bootstrap.indexOf("require('API.ParseFixes').apply()")).toBeLessThan(bootstrap.indexOf("dofile(SCRIPT_DIR .. '/API/Server.lua')"));
  });
});
