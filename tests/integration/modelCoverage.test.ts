/**
 * K2 (WU-32, C-38): `check_model_coverage`, in process and engine-required, on the golden build.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handler, session, bridge
 * and luajit). Every expected status comes from PoB itself, never from the tool's earlier output:
 * - Lua queries (`__test_eval`, test actions on, through `session.run`) call `modLib.parseMod` on a line or
 *   a joined line, and the test re-derives the status by §2.4's rules (`deriveStatus`) with the server's
 *   name scan;
 * - gem marks are recomputed by PoB's red-tooltip rule: a described line whose `lineMap` stat is in
 *   neither `statSet.statMap` nor `data.skillStatMap`;
 * - build mode is checked against single-source calls on the same item text (`BuildRaw()`), nodes and
 *   gems, which a Lua query enumerates.
 *
 * AC-K10…AC-K14 and AC-K46 (the name scan: `pobSourceNames` and the once-per-process `fs` spy) run here;
 * AC-K46's contract part is in `contract.test.ts`. The read kind (AC-K14's last clause, AC-B3) is the
 * generic engine-kind check over the `check_model_coverage` samples in `engineKinds.test.ts`; the static
 * part below checks those samples exist.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { TOOL_META } from '../../src/server/toolMeta';
import { resolvePobSrc } from '../../src/engine/pobPath';
import { forgetPobSourceNames, pobSourceNames } from '../../src/engine/pobSourceNames';
import { remainderText } from '../../src/handlers/coverageHandlers';

const ENGINE_TIMEOUT = 240_000;
const FIXTURES = path.resolve(__dirname, '..', 'fixtures');
const AMULET = fs.readFileSync(path.join(FIXTURES, 'items', 'coverage-amulet.txt'), 'utf8');
const POB_SRC = resolvePobSrc(process.env);

const UNMODELLED = 'possibly unmodelled; check config';

/** One listed entry of the tool's text. */
interface Entry {
  source: string;
  status: string;
  line: string;
  joinedWith: string[];
  remainder?: string;
  unread?: string[];
  stat?: string;
}

interface Coverage {
  /** `Counts over N lines …: <n> <status>, …` */
  total: number;
  counts: Record<string, number>;
  entries: Entry[];
}

/** Parse the tool's text: the counts line, then `## <source>` groups of `[<status>] <line>` entries. */
function parseCoverage(text: string): Coverage {
  const lines = text.split('\n');
  const countLine = lines.find((l) => l.startsWith('Counts over '));
  if (!countLine) throw new Error(`no counts line:\n${text.slice(0, 1000)}`);
  const m = /^Counts over (\d+) lines? \(a joined line counts once\): (.*)\.$/.exec(countLine);
  if (!m) throw new Error(`bad counts line: ${countLine}`);
  const counts: Record<string, number> = {};
  if (m[2] !== 'none') {
    for (const part of m[2].split(', ')) {
      const c = /^(\d+) (.+)$/.exec(part);
      if (!c) throw new Error(`bad count: ${part}`);
      counts[c[2]] = Number(c[1]);
    }
  }
  const entries: Entry[] = [];
  let source: string | undefined;
  let current: Entry | undefined;
  for (const line of lines) {
    let e: RegExpExecArray | null;
    if (line.startsWith('## ')) {
      source = line.slice(3);
      current = undefined;
    } else if (source && (e = /^\[([^\]]+)\] (.*)$/.exec(line))) {
      current = { source, status: e[1], line: e[2], joinedWith: [] };
      entries.push(current);
    } else if (current && (e = /^ {2}joined with: (.*)$/.exec(line))) {
      current.joinedWith.push(e[1]);
    } else if (current && (e = /^ {2}remainder: (.*)$/.exec(line))) {
      current.remainder = e[1];
    } else if (current && (e = /^ {2}unread mods: (.*)$/.exec(line))) {
      current.unread = e[1].split(', ');
    } else if (current && (e = /^ {2}stat: (.*)$/.exec(line))) {
      current.stat = e[1];
    } else if (line.trim() === '') {
      current = undefined;
    }
  }
  return { total: Number(m[1]), counts, entries };
}

/** `modLib.parseMod`'s result, as a Lua query returns it. */
interface Parse {
  hasList: boolean;
  n: number;
  extra?: string;
  names: string[];
}

/** A mod name the scan has; a compound "Condition:X" name when each ':'-separated part is in it. */
const named = (scan: Set<string>, name: string) => scan.has(name) || (name.includes(':') && name.split(':').every((p) => scan.has(p)));

/** §2.4's status rules, applied to PoB's parse (an empty list with a remainder applies nothing: unparsed). */
function deriveStatus(p: Parse, scan: Set<string>): string {
  if (!p.hasList) return 'unparsed';
  if (p.n === 0) return p.extra !== undefined ? 'unparsed' : 'parsed to nothing';
  if (p.extra !== undefined) return 'partly parsed';
  return p.names.every((name) => named(scan, name)) ? 'fully parsed' : 'possibly unread';
}

/** A Lua chunk returning `modLib.parseMod(<line>)` as a `Parse`, for each line given. */
const parseQuery = (lines: string[]) => `
  local out = {}
  local function names(list, acc)
    for _, mod in ipairs(list) do
      if type(mod.name) == 'string' then table.insert(acc, mod.name) end
      if type(mod.value) == 'table' and type(mod.value.mod) == 'table' then names({ mod.value.mod }, acc) end
    end
    return acc
  end
  for i, line in ipairs(${luaStrings(lines)}) do
    local list, extra = modLib.parseMod(line)
    out[i] = { hasList = list ~= nil, n = list and #list or -1, extra = extra, names = list and names(list, {}) or {} }
  end
  return out`;

function luaStrings(lines: string[]): string {
  return `{ ${lines.map((l) => JSON.stringify(l)).join(', ')} }`;
}

const arr = <T>(v: T[] | Record<string, never> | undefined): T[] => (Array.isArray(v) ? v : []);

describe('K2: check_model_coverage is a read tool with ok samples (static, AC-K14, AC-B3)', () => {
  it('AC-K14: TOOL_META says read/core, and tool-calls.json has the item_text and build ok samples and the two error samples', () => {
    expect(TOOL_META.check_model_coverage).toEqual({ engine: 'read', group: 'core' });
    const samples = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Array<{
      tool: string;
      args: Record<string, unknown>;
      expect: string;
      stateChange?: boolean;
    }>;
    const mine = samples.filter((s) => s.tool === 'check_model_coverage');
    expect(mine.filter((s) => s.expect === 'ok').map((s) => s.args)).toEqual([{ item_text: '$RUBY_RING_TEXT' }, { build: true }]);
    for (const s of mine) expect(s.stateChange).toBeUndefined();
    expect(mine.filter((s) => s.expect === 'error').map((s) => s.args)).toEqual([{}, { build: true, gems: ['Heft'] }]);
  });
});

engineDescribe('K2: check_model_coverage on the golden build (WU-32, C-38)', () => {
  let f: SessionFixture;
  let scan: Set<string>;

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:coverage-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function parses(lines: string[]): Promise<Parse[]> {
    const out = await luaQuery<Array<Parse & { names: string[] | Record<string, never> }>>(parseQuery(lines));
    return arr(out).map((p) => ({ ...p, names: arr(p.names) }));
  }

  async function okTool(args: Record<string, unknown>): Promise<string> {
    const out = await f.call('check_model_coverage', args);
    expect({ args, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ args, isError: false, text: '' });
    return out.text;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
    scan = await pobSourceNames(POB_SRC);
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  // -------------------------------------------------------------------------------------------------
  // AC-K46: the name scan

  it('AC-K46: pobSourceNames(<PoB src>) contains Life and lacks CharmsUseNoCharges, which only Modules/ModParser.lua names; a second call returns the same Set', async () => {
    const names = await pobSourceNames(POB_SRC);
    expect(names.has('Life')).toBe(true);
    expect(names.has('CharmsUseNoCharges')).toBe(false);
    // The exclusion is what hides it: ModParser.lua does name it.
    expect(fs.readFileSync(path.join(POB_SRC, 'Modules', 'ModParser.lua'), 'utf8')).toContain('CharmsUseNoCharges');
    // Independently: every identifier of one scanned file is in the set (code, strings and comments alike).
    const calcPerform = fs.readFileSync(path.join(POB_SRC, 'Modules', 'CalcPerform.lua'), 'utf8');
    const missing = [...new Set(calcPerform.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])].filter((n) => !names.has(n));
    expect(missing).toEqual([]);
    expect(await pobSourceNames(POB_SRC)).toBe(names);
  });

  it(
    'AC-K46: two check_model_coverage calls in one server list each of Modules/ and Classes/ at most once (fs spy, from a cold scan)',
    async () => {
      forgetPobSourceNames();
      const readdir = jest.spyOn(fs.promises, 'readdir');
      try {
        await okTool({ item_text: AMULET });
        await okTool({ gems: ['Heft'] });
        const listed = readdir.mock.calls.map((c) => path.resolve(String(c[0])));
        const count = (dir: string) => listed.filter((p) => p === path.resolve(POB_SRC, dir)).length;
        // A cold scan lists each exactly once; the second call reuses it.
        expect({ Modules: count('Modules'), Classes: count('Classes') }).toEqual({ Modules: 1, Classes: 1 });
      } finally {
        readdir.mockRestore();
      }
      scan = await pobSourceNames(POB_SRC);
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K10: item statuses

  it(
    'AC-K10: the coverage amulet reports the table\'s five statuses, each equal to the status re-derived from modLib.parseMod(line)',
    async () => {
      const text = await okTool({ item_text: AMULET });
      const cov = parseCoverage(text);
      const expected: Record<string, string> = {
        '+30 to maximum Life': 'fully parsed',
        '+5 to any Attribute': 'parsed to nothing',
        'Charms use no Charges': 'possibly unread',
        '10% of Physical damage dealt by your Hits causes Blood Loss': 'partly parsed',
        'Your Hits are Crushing Blows': 'unparsed',
      };
      const lines = Object.keys(expected);
      expect(cov.entries.map((e) => e.line)).toEqual(lines);
      expect(cov.entries.every((e) => e.source === 'Item')).toBe(true);
      const pob = await parses(lines);
      lines.forEach((line, i) => {
        const entry = cov.entries[i];
        expect({ line, status: entry.status }).toEqual({ line, status: expected[line] });
        expect({ line, status: entry.status }).toEqual({ line, status: deriveStatus(pob[i], scan) });
      });
      // The partly parsed line shows the parser's remainder (its padding dropped).
      const partial = cov.entries[3];
      expect(pob[3].extra).toBeDefined();
      expect(partial.remainder).toBe(remainderText(pob[3].extra!));
      expect(partial.remainder).toBe('dealt by your Hits causes Blood Loss');
      // The possibly unread line names the mod the scan lacks.
      expect(cov.entries[2].unread).toEqual(['CharmsUseNoCharges']);
      expect(cov.total).toBe(5);
      expect(cov.counts).toEqual({
        'fully parsed': 1,
        'partly parsed': 1,
        unparsed: 1,
        'parsed to nothing': 1,
        'possibly unread': 1,
      });
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K11: item join

  it(
    'AC-K11: Waveshaper\'s BuildRaw() text joins "…Mana Regeneration Rate also" with "apply to Energy Shield Recharge Rate" in one entry that isn\'t unparsed',
    async () => {
      const raw = await luaQuery<string>(`
        for _, item in pairs(main.uniqueDB.list) do
          if item.title == 'Waveshaper' then return item:BuildRaw() end
        end`);
      expect(raw).toContain('apply to Energy Shield Recharge Rate');
      const cov = parseCoverage(await okTool({ item_text: raw }));
      const first = 'Increases and Reductions to Mana Regeneration Rate also';
      const second = 'apply to Energy Shield Recharge Rate';
      const joined = cov.entries.filter((e) => e.line === first);
      expect(joined).toHaveLength(1);
      expect(joined[0].joinedWith).toEqual([second]);
      expect(joined[0].status).not.toBe('unparsed');
      // Neither line appears alone.
      expect(cov.entries.filter((e) => e.line === second || e.joinedWith.length === 0 && e.line === first)).toEqual([]);
      // PoB parses the first line alone as a failure, and the join as the reported status.
      const [alone, both] = await parses([first, `${first} ${second}`]);
      expect(!alone.hasList || alone.extra !== undefined).toBe(true);
      expect(joined[0].status).toBe(deriveStatus(both, scan));
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K12: passives

  it(
    'AC-K12: Crushing Impacts: "Your Hits are Crushing Blows" is unparsed and "25% more Damage against Heavy Stunned Enemies" fully parsed',
    async () => {
      const cov = parseCoverage(await okTool({ nodes: ['Crushing Impacts'] }));
      const ids = await luaQuery<number[]>(`
        local ids = {}
        for id, node in pairs(build.spec.nodes) do
          if node.name == 'Crushing Impacts' then table.insert(ids, id) end
        end
        table.sort(ids)
        return ids`);
      expect(arr(ids)).toHaveLength(1);
      const source = `Node ${arr(ids)[0]} Crushing Impacts`;
      const byLine = Object.fromEntries(cov.entries.map((e) => [e.line, e]));
      expect(byLine['Your Hits are Crushing Blows']).toMatchObject({ source, status: 'unparsed' });
      expect(byLine['25% more Damage against Heavy Stunned Enemies']).toMatchObject({ source, status: 'fully parsed' });
      const pob = await parses(['Your Hits are Crushing Blows', '25% more Damage against Heavy Stunned Enemies']);
      expect(deriveStatus(pob[0], scan)).toBe('unparsed');
      expect(deriveStatus(pob[1], scan)).toBe('fully parsed');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K12: node 38570 (Demolitionist) gives one joined entry with the joined parse\'s status; its second line is never parsed to nothing',
    async () => {
      const sd = arr(await luaQuery<string[]>('return build.spec.nodes[38570].sd'));
      expect(sd).toHaveLength(2);
      const cov = parseCoverage(await okTool({ nodes: ['38570'] }));
      expect(cov.entries).toHaveLength(1);
      const [entry] = cov.entries;
      expect(entry.source).toBe('Node 38570 Demolitionist');
      expect(entry.line).toBe(sd[0]);
      expect(entry.joinedWith).toEqual([sd[1]]);
      const [alone, joined] = await parses([sd[0], `${sd[0]} ${sd[1]}`]);
      expect(!alone.hasList || alone.extra !== undefined).toBe(true);
      expect(entry.status).toBe(deriveStatus(joined, scan));
      expect(cov.entries.some((e) => e.line === sd[1])).toBe(false);
      expect(cov.counts['parsed to nothing']).toBeUndefined();
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K12: an unknown node is an isError naming it',
    async () => {
      const out = await f.call('check_model_coverage', { nodes: ['Crushing Impacts', 'Nonesuch Keystone'] });
      expect(out.isError).toBe(true);
      expect(out.text).toContain('Nonesuch Keystone');
      const byId = await f.call('check_model_coverage', { nodes: ['999999999'] });
      expect(byId.isError).toBe(true);
      expect(byId.text).toContain('999999999');
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K13: gems

  /**
   * PoB's red-tooltip rule for one gem, at its first build instance's level and quality, else at its natural
   * max level and quality 0: per stat set, the described lines whose stat no map has.
   */
  const redLinesQuery = (name: string) => `
    local gem, gemId
    for id, g in pairs(data.gems) do
      if g.name == ${JSON.stringify(name)} and g.grantedEffect and (not gemId or id < gemId) then gem, gemId = g, id end
    end
    local level, quality, found = gem.naturalMaxLevel, 0, false
    for _, group in ipairs(build.skillsTab.socketGroupList) do
      for _, inst in ipairs(group.gemList) do
        if not found and inst.gemData and inst.gemData.name == gem.name then
          level, quality, found = inst.level, inst.quality or 0, true
        end
      end
    end
    local effects = { gem.grantedEffect }
    for _, e in ipairs(gem.additionalGrantedEffects or {}) do table.insert(effects, e) end
    local red, all = {}, 0
    for _, ge in ipairs(effects) do
      for i, ss in ipairs(ge.statSets or {}) do
        local label = (ss.label and ss.label ~= '') and ss.label or ge.name
        local lines, lineMap = data.describeStats(calcLib.buildSkillInstanceStats({ level = level, quality = quality }, ge, ss), ss.statDescriptionScope)
        for _, line in ipairs(lines) do
          all = all + 1
          local stat = lineMap[line]
          if not (stat and ((ss.statMap and ss.statMap[stat]) or build.data.skillStatMap[stat])) then
            table.insert(red, 'Gem ' .. gem.name .. ' / ' .. label .. ' | ' .. line:gsub('%s*\\n%s*', ' '))
          end
        end
      end
    end
    return { red = red, all = all, level = level, quality = quality }`;

  it(
    'AC-K13: Blood Hunt marks both Explosion lines about Consumed Blood Loss; for Blood Hunt, Brutality I and Heft the marked lines equal PoB\'s red-tooltip lines (Brutality I and Heft none)',
    async () => {
      const blood = parseCoverage(await okTool({ gems: ['Blood Hunt'] }));
      const marked = blood.entries.filter((e) => e.status === UNMODELLED);
      // "Enemies lose Life equal to 25% of Consumed Blood Loss" and "… per <n> Blood Loss Consumed, up to …".
      const consumed = marked.filter(
        (e) => e.source === 'Gem Blood Hunt / Explosion' && /Consumed Blood Loss|Blood Loss Consumed/.test(e.line),
      );
      expect(consumed).toHaveLength(2);
      expect(consumed.some((e) => e.line === 'Enemies lose Life equal to 25% of Consumed Blood Loss')).toBe(true);

      for (const name of ['Blood Hunt', 'Brutality I', 'Heft']) {
        const cov = parseCoverage(await okTool({ gems: [name] }));
        const pob = await luaQuery<{ red: string[] | Record<string, never>; all: number }>(redLinesQuery(name));
        const tool = cov.entries.filter((e) => e.status === UNMODELLED).map((e) => `${e.source} | ${e.line}`);
        expect({ name, marked: tool }).toEqual({ name, marked: arr(pob.red) });
        // Every described line is listed once, fully parsed or marked.
        expect({ name, lines: cov.entries.length }).toEqual({ name, lines: pob.all });
        expect(cov.entries.every((e) => e.status === 'fully parsed' || e.status === UNMODELLED)).toBe(true);
        if (name !== 'Blood Hunt') expect({ name, marked: tool }).toEqual({ name, marked: [] });
      }
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K13: an unknown gem is an isError naming it',
    async () => {
      const out = await f.call('check_model_coverage', { gems: ['Heft', 'Nonesuch Strike'] });
      expect(out.isError).toBe(true);
      expect(out.text).toContain('Nonesuch Strike');
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K14: build mode, errors

  it(
    'AC-K14: {build:true} lists no fully parsed entry; each listed entry has the status a single-source call gives; the counts sum to the lines checked',
    async () => {
      const build = parseCoverage(await okTool({ build: true }));
      expect(build.entries.length).toBeGreaterThan(0);
      expect(build.entries.filter((e) => e.status === 'fully parsed')).toEqual([]);

      // What build mode covers, enumerated by a Lua query: equipped items (BuildRaw text), allocated nodes, gems.
      const what = await luaQuery<{
        items: Array<{ source: string; raw: string }> | Record<string, never>;
        nodes: number[] | Record<string, never>;
        gems: string[] | Record<string, never>;
      }>(`
        local items, nodes, gems, seen = {}, {}, {}, {}
        for _, slot in ipairs(build.itemsTab.orderedSlots) do
          local item = (slot.selItemId or 0) > 0 and not slot.nodeId and build.itemsTab.items[slot.selItemId]
          if item then table.insert(items, { source = 'Item ' .. slot.slotName .. ': ' .. item.name, raw = item:BuildRaw() }) end
        end
        for id in pairs(build.spec.allocNodes) do table.insert(nodes, id) end
        table.sort(nodes)
        for _, group in ipairs(build.skillsTab.socketGroupList) do
          for _, inst in ipairs(group.gemList) do
            if inst.gemData and inst.gemData.grantedEffect and not seen[inst.gemData.name] then
              seen[inst.gemData.name] = true
              table.insert(gems, inst.gemData.name)
            end
          end
        end
        return { items = items, nodes = nodes, gems = gems }`);
      const items = arr(what.items);
      const nodes = arr(what.nodes);
      const gems = arr(what.gems);
      expect(items.length).toBeGreaterThan(0);

      // Single-source calls over everything build mode checks.
      const single: Entry[] = [];
      const counts: Record<string, number> = {};
      let total = 0;
      const addCall = (cov: Coverage, source?: string) => {
        total += cov.total;
        for (const [s, n] of Object.entries(cov.counts)) counts[s] = (counts[s] ?? 0) + n;
        for (const e of cov.entries) single.push(source ? { ...e, source } : e);
      };
      for (const item of items) addCall(parseCoverage(await okTool({ item_text: item.raw })), item.source);
      addCall(parseCoverage(await okTool({ nodes: nodes.map(String) })));
      addCall(parseCoverage(await okTool({ gems })));

      // Build mode's listing equals the single-source entries that aren't fully parsed: the same source,
      // line, status and joined lines, as multisets (an item may repeat a line).
      const key = (e: Entry) => JSON.stringify([e.source, e.line, e.status, e.joinedWith]);
      const tally = (list: Entry[]) => {
        const t: Record<string, number> = {};
        for (const e of list) t[key(e)] = (t[key(e)] ?? 0) + 1;
        return t;
      };
      expect(tally(build.entries)).toEqual(tally(single.filter((e) => e.status !== 'fully parsed')));
      // The counts cover every line checked.
      expect(build.total).toBe(total);
      expect(build.counts).toEqual(counts);
      expect(Object.values(build.counts).reduce((a, b) => a + b, 0)).toBe(build.total);

      // Demolitionist (allocated) is one fully parsed join, so its second line is never listed.
      expect(nodes).toContain(38570);
      const second = arr(await luaQuery<string[]>('return build.spec.nodes[38570].sd'))[1];
      expect(build.entries.filter((e) => e.line === second)).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K14: {} and {build:true, gems:["Heft"]} are isError',
    async () => {
      const none = await f.call('check_model_coverage', {});
      expect(none.isError).toBe(true);
      expect(none.text).toMatch(/nothing to check/);
      const both = await f.call('check_model_coverage', { build: true, gems: ['Heft'] });
      expect(both.isError).toBe(true);
      expect(both.text).toMatch(/on its own/);
    },
    ENGINE_TIMEOUT,
  );
});
