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
 * AC-K46's contract part is in `contract.test.ts`. The review fixes run here too: a partly parsed line
 * applies nothing, statuses follow PoB's own BuildModList and ProcessStats over every unique and node,
 * ranged item lines follow getRangedModList, build mode checks jewels in allocated tree sockets (D-242),
 * and names PoB builds by concatenation count as read (D-243). The read kind (AC-K14's last clause, AC-B3) is the
 * generic engine-kind check over the `check_model_coverage` samples in `engineKinds.test.ts`; the static
 * part below checks those samples exist.
 *
 * WU-54 (D-300, D-336): the flags beside the statuses. AC-K50 (`mapped but unread`, `stat not mapped`) and
 * AC-K53…AC-K56 each check a named example through the tool's text, then the whole set through the action
 * against a Lua query of PoB's own data (every gem, every support or meta gem, every passive node). AC-K57
 * checks that no status or count moves and that build mode reports the flags single-source calls give.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { TOOL_META } from '../../src/server/toolMeta';
import { resolvePobSrc } from '../../src/engine/pobPath';
import { concatTemplates, forgetPobSourceNames, pobSourceNames, pobSourceScan, type PobSourceScan } from '../../src/engine/pobSourceNames';
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

/** Whether `name` from `pos` fits the template parts from `k`; a `*` part is empty or a scanned name. */
function fits(scan: PobSourceScan, name: string, parts: string[], k = 0, pos = 0): boolean {
  if (k === parts.length) return pos === name.length;
  if (parts[k] === '*') {
    for (let end = pos; end <= name.length; end++) {
      const run = name.slice(pos, end);
      if ((run === '' || scan.names.has(run)) && fits(scan, name, parts, k + 1, end)) return true;
    }
    return false;
  }
  return name.startsWith(parts[k], pos) && fits(scan, name, parts, k + 1, pos + parts[k].length);
}

/**
 * Whether a mod name is read by name (§2.4 and D-243): in the scan; a compound "Condition:X" whose parts
 * are; equal to, or ending with, a template literal of 6+ characters that starts with a capital; or fitting
 * a template.
 */
function readByName(scan: PobSourceScan, name: string): boolean {
  if (scan.names.has(name)) return true;
  if (name.includes(':')) return name.split(':').filter(Boolean).every((p) => readByName(scan, p));
  const literals = scan.templates.flatMap((t) => t.split('*')).filter((l) => l.length >= 6 && /^[A-Z]/.test(l));
  if (literals.some((l) => name.endsWith(l))) return true;
  return scan.templates.some((t) => fits(scan, name, t.split(/(\*)/).filter((x) => x !== '')));
}

/** §2.4's status rules, applied to PoB's parse (an empty list with a remainder applies nothing: unparsed). */
function deriveStatus(p: Parse, scan: PobSourceScan): string {
  if (!p.hasList) return 'unparsed';
  if (p.n === 0) return p.extra !== undefined ? 'unparsed' : 'parsed to nothing';
  if (p.extra !== undefined) return 'partly parsed';
  return p.names.every((name) => readByName(scan, name)) ? 'fully parsed' : 'possibly unread';
}

/** What PoB does with a line: applies a non-empty mod list, applies an empty one, or drops it. */
type Applied = 'applied' | 'nothing' | 'dropped';
const STATUS_APPLIED: Record<string, Applied> = {
  'fully parsed': 'applied',
  'possibly unread': 'applied',
  'parsed to nothing': 'nothing',
  'partly parsed': 'dropped',
  unparsed: 'dropped',
};

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

describe('D-243: concatenation templates of the name scan (static)', () => {
  it('D-243: concatTemplates keeps each `..` chain as its literals and `*` for other operands, skipping comments and literals no mod name could hold', () => {
    const lua = [
      'local a = source.name .. "ConvertTo" .. target.name',
      'local b = calc(skillModList, cfg, val.type.."CostEfficiency", "CostEfficiency")',
      'if flag(cfg, damageType.."Can"..ailmentType) or flag(cfg, "Can"..ailmentType) then end',
      'local c = ("Multiplier:") .. name',
      'local d = f "Called" .. x',
      'local e = prefix .. " text with spaces"',
      '-- local commented = x .. "InAComment"',
      '--[[ local block = y .. "InABlock" ]]',
      'local s = [[NotCode ' + '..' + ' "Quoted"]]',
      'local t = x .. [[LongName]]',
      'local v = select("#", ...) .. "Varargs"',
    ].join('\n');
    expect(concatTemplates(lua).sort()).toEqual(
      ['*ConvertTo*', '*CostEfficiency', '*Can*', 'Can*', 'Multiplier:*', '*LongName', '*Varargs'].sort(),
    );
  });
});

engineDescribe('K2: check_model_coverage on the golden build (WU-32, C-38)', () => {
  let f: SessionFixture;
  let scan: PobSourceScan;

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
    scan = await pobSourceScan(POB_SRC);
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
      scan = await pobSourceScan(POB_SRC);
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
    'AC-K14: {build:true} lists no fully parsed entry; each listed entry has the status a single-source call gives; the counts sum to the lines checked; jewels in allocated tree sockets are checked (D-242)',
    async () => {
      const build = parseCoverage(await okTool({ build: true }));
      expect(build.entries.length).toBeGreaterThan(0);
      expect(build.entries.filter((e) => e.status === 'fully parsed')).toEqual([]);

      // What build mode covers, enumerated by a Lua query from the build's own records: the active item set's
      // slots (BuildRaw text), the jewels the active spec puts in allocated tree sockets (spec.jewels), the
      // allocated nodes and the gems.
      const what = await luaQuery<{
        items: Array<{ source: string; raw: string }> | Record<string, never>;
        nodes: number[] | Record<string, never>;
        gems: string[] | Record<string, never>;
      }>(`
        local items, nodes, gems, seen = {}, {}, {}, {}
        for slotName, slot in pairs(build.itemsTab.activeItemSet) do
          local item = type(slot) == 'table' and (slot.selItemId or 0) > 0 and build.itemsTab.items[slot.selItemId]
          if item then table.insert(items, { source = 'Item ' .. slotName .. ': ' .. item.name, raw = item:BuildRaw() }) end
        end
        for nodeId, itemId in pairs(build.spec.jewels) do
          local item = itemId > 0 and build.spec.allocNodes[nodeId] and build.itemsTab.items[itemId]
          if item then table.insert(items, { source = 'Jewel socket ' .. nodeId .. ': ' .. item.name, raw = item:BuildRaw() }) end
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
      // The golden build has two jewels in allocated tree sockets (Heart of the Well and Against the
      // Darkness); the single-source calls below include them, so the counts only match if build mode
      // checks them too (D-242).
      expect(items.filter((i) => i.source.startsWith('Jewel socket ')).map((i) => i.source.replace(/^Jewel socket \d+: /, '')).sort()).toEqual([
        'Against the Darkness, Time-Lost Diamond',
        'Heart of the Well, Diamond',
      ]);

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

  // -------------------------------------------------------------------------------------------------
  // Review fixes: what PoB applies, ranged lines, concatenated names

  /** The check_coverage action itself, through the bridge (C-5 validated), with an empty name scan. */
  async function coverageAction(params: Record<string, unknown>) {
    const { value } = await f.session.run({ tool: 'test:coverage-action', kind: 'read' }, async (ctx) =>
      ctx.client.checkCoverage({ sourceNames: [], ...params } as never),
    );
    return value;
  }

  it(
    'review fix: a partly parsed line applies none of itself; the note says so, and PoB\'s item mod list holds nothing from it',
    async () => {
      const text = await okTool({ item_text: AMULET });
      expect(text).toMatch(/^- partly parsed: PoB applies none of the line: it understood only part of it, and the remainder shows what it didn't understand/m);
      const partial = '10% of Physical damage dealt by your Hits causes Blood Loss';
      const pob = await luaQuery<{ applied: string[]; partial: string[] }>(`
        local item = require('API.Util').construct('Item', ${JSON.stringify(AMULET)})
        local applied = {}
        for _, mod in ipairs(item.baseModList) do table.insert(applied, mod.name .. ' ' .. mod.type .. ' ' .. tostring(mod.value)) end
        local partial = {}
        for _, mod in ipairs((modLib.parseMod(${JSON.stringify(partial)}))) do table.insert(partial, mod.name) end
        return { applied = applied, partial = partial }`);
      const applied = arr(pob.applied);
      expect(applied).toContain('Life BASE 30');
      // The line's partial parse names a mod (PhysicalDamage), and PoB applies no mod of that name.
      expect(arr(pob.partial).length).toBeGreaterThan(0);
      for (const name of arr(pob.partial)) expect(applied.filter((a) => a.startsWith(`${name} `))).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'review fix: over every unique (selected variant), each item line\'s status agrees with what PoB\'s BuildModList applies (a mod list, an empty one, or nothing: the line dropped)',
    async () => {
      const uniques = arr(
        await luaQuery<Array<{ name: string; raw: string; applied: Applied[] | Record<string, never> }>>(`
          local construct = require('API.Util').construct
          local out = {}
          for key, u in pairs(main.uniqueDB.list) do
            local raw = u:BuildRaw()
            local item = construct('Item', raw)
            local applied = {}
            for _, list in ipairs({ 'enchantModLines', 'runeModLines', 'implicitModLines', 'explicitModLines' }) do
              for _, ml in ipairs(item[list] or {}) do
                if item:CheckModLineVariant(ml) then
                  table.insert(applied, ml.extra and 'dropped' or (#ml.modList > 0 and 'applied' or 'nothing'))
                end
              end
            end
            table.insert(out, { name = tostring(u.title or key), raw = raw, applied = applied })
          end
          table.sort(out, function(a, b) return a.name < b.name end)
          return out`),
      );
      expect(uniques.length).toBeGreaterThan(400);
      // The few uniques whose text passes add_item's 10 KB limit (thousands of variant lines) are refused by
      // the action, as add_item refuses them; the rest are compared.
      const tooLong = uniques.filter((u) => Buffer.byteLength(u.raw, 'utf8') > 10240);
      expect(tooLong.length).toBeLessThan(10);
      const mismatches: string[] = [];
      let lines = 0;
      for (const u of uniques.filter((x) => !tooLong.includes(x))) {
        const result = await coverageAction({ itemText: u.raw });
        const tool = result.entries.map((e) => STATUS_APPLIED[e.status]);
        const pob = arr(u.applied);
        lines += pob.length;
        if (JSON.stringify(tool) !== JSON.stringify(pob)) mismatches.push(`${u.name}: tool ${tool.join(',')} / PoB ${pob.join(',')}`);
      }
      expect(lines).toBeGreaterThan(2000);
      expect(mismatches).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'review fix: over every passive node, each line\'s status agrees with what PoB\'s ProcessStats applies, and lines absorbed by a join get PoB\'s empty dummy list',
    async () => {
      const pob = await luaQuery<Record<string, Array<{ applied: Applied; dummy: boolean }>>>(`
        local out = {}
        for id, node in pairs(build.spec.nodes) do
          if node.mods and #node.mods > 0 then
            local lines = {}
            for i, m in ipairs(node.mods) do
              lines[i] = {
                applied = (not m.list or m.extra) and 'dropped' or (#m.list > 0 and 'applied' or 'nothing'),
                dummy = m.list ~= nil and #m.list == 0 and m.extra == nil,
              }
            end
            out[tostring(id)] = lines
          end
        end
        return out`);
      const ids = Object.keys(pob);
      expect(ids.length).toBeGreaterThan(1000);
      const result = await coverageAction({ nodes: ids });
      const byNode = new Map<string, typeof result.entries>();
      for (const e of result.entries) {
        const key = String(e.nodeId);
        byNode.set(key, [...(byNode.get(key) ?? []), e]);
      }
      const mismatches: string[] = [];
      for (const id of ids) {
        const lines = pob[id];
        let i = 0;
        for (const e of byNode.get(id) ?? []) {
          if (lines[i]?.applied !== STATUS_APPLIED[e.status]) mismatches.push(`${id}#${i + 1}: tool ${e.status} / PoB ${lines[i]?.applied}`);
          for (let j = 1; j <= (e.joinedWith?.length ?? 0); j++) {
            if (!lines[i + j]?.dummy) mismatches.push(`${id}#${i + j + 1}: absorbed, but PoB's list isn't the empty dummy`);
          }
          i += 1 + (e.joinedWith?.length ?? 0);
        }
        if (i !== lines.length) mismatches.push(`${id}: tool covers ${i} lines, PoB has ${lines.length}`);
      }
      expect(mismatches).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  /**
   * A unique's BuildRaw() text, with the range of the line containing `needle` set to `range`, and that
   * line's variant (when it has one) selected.
   */
  async function uniqueTextWithRange(title: string, needle: string, range: number): Promise<string> {
    const raw = await luaQuery<string>(`
      for _, item in pairs(main.uniqueDB.list) do
        if item.title == ${JSON.stringify(title)} then return item:BuildRaw() end
      end`);
    const lines = raw.split('\n');
    const hit = lines.filter((l) => l.includes(needle));
    expect({ title, needle, found: hit.length }).toEqual({ title, needle, found: 1 });
    const variant = /\{variant:(\d+)\}/.exec(hit[0])?.[1];
    return lines
      .map((l) => {
        if (variant && /^Selected Variant: \d+$/.test(l)) return `Selected Variant: ${variant}`;
        if (!l.includes(needle)) return l;
        return /\{range:[\d.]+\}/.test(l) ? l.replace(/\{range:[\d.]+\}/, `{range:${range}}`) : `{range:${range}}${l}`;
      })
      .join('\n');
  }

  /** PoB's own processing of an item text: per selected line containing `needle`, its line, extra and mod count. */
  const processedQuery = (text: string, needle: string) => `
    local item = require('API.Util').construct('Item', ${JSON.stringify(text)})
    local out = {}
    for _, list in ipairs({ 'implicitModLines', 'explicitModLines' }) do
      for _, ml in ipairs(item[list]) do
        if item:CheckModLineVariant(ml) and ml.line:find(${JSON.stringify(needle)}, 1, true) then
          local ranged = itemLib.applyRange(ml.line, ml.range, 1)
          local _, rangedExtra = modLib.parseMod(ranged)
          table.insert(out, { extra = ml.extra ~= nil, mods = #ml.modList, rangedFails = rangedExtra ~= nil, zero = itemLib.isZeroValueLine(ranged) and true or false })
        end
      end
    end
    return out`;

  it(
    'review fix: a range crossing zero rolled at 0 ("+(-40-40)% to Fire Resistance" at 0.5 on Ventor\'s Gamble) is parsed to nothing, as getRangedModList makes it',
    async () => {
      const text = await uniqueTextWithRange("Ventor's Gamble", '(-40-40)% to Fire Resistance', 0.5);
      const cov = parseCoverage(await okTool({ item_text: text }));
      const fire = cov.entries.filter((e) => /to Fire Resistance$/.test(e.line));
      expect(fire.map((e) => e.status)).toEqual(['parsed to nothing']);
      const pob = arr(await luaQuery<Array<{ extra: boolean; mods: number; rangedFails: boolean; zero: boolean }>>(processedQuery(text, 'to Fire Resistance')));
      // PoB applies an empty list for it: the zero-value rule, not a failed parse.
      expect(pob).toEqual([{ extra: false, mods: 0, rangedFails: true, zero: true }]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'review fix: a ranged line whose ranged parse fails keeps its range-1 parse (Heart of the Well\'s Physical Thorns line at range 0.25), as getRangedModList does',
    async () => {
      const needle = 'Physical Thorns damage equal to (4-6)%';
      const text = await uniqueTextWithRange('Heart of the Well', needle, 0.25);
      const cov = parseCoverage(await okTool({ item_text: text }));
      const thorns = cov.entries.filter((e) => e.line.includes('Physical Thorns damage equal to'));
      expect(thorns).toHaveLength(1);
      expect(STATUS_APPLIED[thorns[0].status]).toBe('applied');
      const pob = arr(await luaQuery<Array<{ extra: boolean; mods: number; rangedFails: boolean; zero: boolean }>>(processedQuery(text, needle)));
      expect(pob).toEqual([{ extra: false, mods: expect.any(Number), rangedFails: true, zero: false }]);
      expect(pob[0].mods).toBeGreaterThan(0);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-243: names PoB builds by concatenation are read (EvasionConvertToArmour, ManaCostEfficiency, PhysicalCanPin, Fire/Cold/LightningExposureEffect); a made-up name is still flagged',
    async () => {
      const lines = [
        'Converts all Evasion Rating to Armour',
        '15% increased Mana Cost Efficiency',
        'Physical Damage is Pinning',
        '10% increased Exposure Effect',
      ];
      const pob = await parses(lines);
      // Each line parses whole (no remainder), into these computed names.
      expect(pob.map((p) => ({ list: p.n > 0, extra: p.extra }))).toEqual(lines.map(() => ({ list: true, extra: undefined })));
      const produced = pob.flatMap((p) => p.names);
      const computed = ['EvasionConvertToArmour', 'ManaCostEfficiency', 'PhysicalCanPin', 'FireExposureEffect', 'ColdExposureEffect', 'LightningExposureEffect'];
      expect(produced).toEqual(expect.arrayContaining(computed));
      // None is a scanned identifier: only the concatenation rule reads them.
      expect(computed.filter((n) => scan.names.has(n))).toEqual([]);
      for (const n of computed) expect({ n, read: readByName(scan, n) }).toEqual({ n, read: true });
      expect(scan.templates).toEqual(expect.arrayContaining(['*ConvertTo*', '*CostEfficiency', '*Can*', '*ExposureEffect']));

      // Through the tool: an amulet with the four lines rates each fully parsed, none possibly unread.
      const amulet = ['Rarity: RARE', 'Computed Names', 'Gold Amulet', 'Item Level: 80', 'Implicits: 0', ...lines].join('\n');
      const cov = parseCoverage(await okTool({ item_text: amulet }));
      expect(cov.entries.map((e) => ({ line: e.line, status: e.status }))).toEqual(lines.map((line) => ({ line, status: 'fully parsed' })));
      // And Iron Reflexes (node 28492), the keystone, is fully parsed too.
      const iron = parseCoverage(await okTool({ nodes: ['28492'] })).entries.find((e) => e.line === lines[0]);
      expect(iron?.status).toBe('fully parsed');

      // A made-up name is still flagged by the action's own classifier, with the real scan.
      const madeUp = await luaQuery<{ status: string; unread: string[] | Record<string, never> }>(`
        local C = require('API.Coverage')
        local scan = require('dkjson').decode(${JSON.stringify(JSON.stringify({ names: [...scan.names], templates: scan.templates }))})
        return C.classify({ { name = 'ZzqxNonexistentMod', type = 'BASE', value = 1 } }, nil, C.reader(scan.names, scan.templates))`);
      expect({ status: madeUp.status, unread: arr(madeUp.unread) }).toEqual({ status: 'possibly unread', unread: ['ZzqxNonexistentMod'] });
      expect(readByName(scan, 'ZzqxNonexistentMod')).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-243: the possibly unread note says it is advisory and to confirm by measurement',
    async () => {
      const text = await okTool({ item_text: AMULET });
      expect(text).toMatch(/^- possibly unread: .*This is advisory: PoB may still read the name through a name it computes another way, so confirm it by measurement/m);
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // WU-54 (D-300, D-336): flags beside the statuses, AC-K50 and AC-K53…AC-K57

  /** One flag of the tool's text. */
  interface Flag {
    flag: string;
    source: string;
    line?: string;
    note: string;
  }

  /** The text's flag section: `- [<flag>] <source>`, then `  line: <line>` for a line's flag, then the note. */
  function parseFlags(text: string): Flag[] {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^Flags \(\d+\): /.test(l));
    if (start < 0) return [];
    const count = Number(/^Flags \((\d+)\)/.exec(lines[start])![1]);
    const out: Flag[] = [];
    let current: Flag | undefined;
    for (const line of lines.slice(start + 1)) {
      let m: RegExpExecArray | null;
      if ((m = /^- \[([^\]]+)\] (.*)$/.exec(line))) {
        current = { flag: m[1], source: m[2], note: '' };
        out.push(current);
      } else if (current && current.note === '' && current.line === undefined && (m = /^ {2}line: (.*)$/.exec(line))) {
        current.line = m[1];
      } else if (current && current.note === '' && (m = /^ {2}(\S.*)$/.exec(line))) {
        current.note = m[1];
      } else {
        break;
      }
    }
    expect(out).toHaveLength(count);
    return out;
  }

  const ofFlag = (flags: Flag[], name: string) => flags.filter((x) => x.flag === name);
  const flagKey = (x: { flag: string; source: string; line?: string; note: string }) =>
    JSON.stringify([x.flag, x.source, x.line ?? null, x.note]);
  const tallyKeys = (keys: string[]) => {
    const t: Record<string, number> = {};
    for (const k of keys) t[k] = (t[k] ?? 0) + 1;
    return t;
  };

  /** The check_coverage action with the real scan, through the bridge (C-5 validated). */
  async function scannedAction(params: Record<string, unknown>) {
    return coverageAction({
      sourceNames: [...scan.names],
      sourceTemplates: scan.templates,
      sourceCallNames: scan.skillCallNames,
      ...params,
    });
  }

  /** Every gem name (its lowest id with a granted effect, as the lookup resolves names) and its kind. */
  async function gemCatalogue() {
    return arr(
      await luaQuery<Array<{ name: string; support: boolean; meta: boolean; energy: boolean; additional: boolean }>>(`
        local byName = {}
        for id, gem in pairs(data.gems) do
          if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect then
            if not byName[gem.name] or id < byName[gem.name].id then byName[gem.name] = { id = id, gem = gem } end
          end
        end
        local out = {}
        for name, rec in pairs(byName) do
          local gem = rec.gem
          local effects = { gem.grantedEffect }
          for _, e in ipairs(gem.additionalGrantedEffects or {}) do table.insert(effects, e) end
          local meta, energy = false, false
          for _, e in ipairs(effects) do
            local t = e.skillTypes or {}
            if t[SkillType.Meta] then meta = true end
            if t[SkillType.Meta] and t[SkillType.GeneratesEnergy] then energy = true end
          end
          table.insert(out, { name = name, support = gem.grantedEffect.support == true, meta = meta, energy = energy,
            additional = gem.additionalGrantedEffectId1 ~= nil })
        end
        table.sort(out, function(a, b) return a.name < b.name end)
        return out`),
    );
  }

  /** A Lua chunk prelude: `want` (the gems as checked) and `gemNamed(name)` (lowest id, as the lookup). */
  const wantPrelude = (gems: Array<{ name: string; level: number; quality: number }>) => `
    local want = require('dkjson').decode(${JSON.stringify(JSON.stringify(gems))})
    local byName = {}
    for id, gem in pairs(data.gems) do
      if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect then
        if not byName[gem.name] or id < byName[gem.name].id then byName[gem.name] = { id = id, gem = gem } end
      end
    end
    local function gemNamed(name) return byName[name].gem end
    local function effectsOf(gem)
      local effects = { gem.grantedEffect }
      for _, e in ipairs(gem.additionalGrantedEffects or {}) do table.insert(effects, e) end
      return effects
    end
    local function labelOf(ge, ss, i)
      if type(ss.label) == 'string' and ss.label ~= '' then return ss.label end
      return (ge.name ~= '' and ge.name) or ('Stat set ' .. i)
    end`;

  /** Whether `name` from `pos` fits the template parts from `k`, a `*` part being empty or a `known` name. */
  function fitsWith(known: (n: string) => boolean, name: string, parts: string[], k = 0, pos = 0): boolean {
    if (k === parts.length) return pos === name.length;
    if (parts[k] === '*') {
      for (let end = pos; end <= name.length; end++) {
        const run = name.slice(pos, end);
        if ((run === '' || known(run)) && fitsWith(known, name, parts, k + 1, end)) return true;
      }
      return false;
    }
    return name.startsWith(parts[k], pos) && fitsWith(known, name, parts, k + 1, pos + parts[k].length);
  }

  /** The names the loaded game data reads (D-336): skill-data tag strings, minion limits, skill names. */
  interface DataNames {
    tags: Set<string>;
    limits: Set<string>;
    skills: Set<string>;
  }

  /**
   * D-336's strict reading: exactly a scanned name, a skill-data mod-list read literal, a skill-data tag
   * name or a minion limit; a compound "X:Y" whose parts are read; or else a whole template fit whose
   * `*` is empty, such a name or a skill name without whitespace. D-243's suffix rule doesn't apply.
   */
  function strictlyRead(data: DataNames, name: string): boolean {
    const calls = new Set(scan.skillCallNames);
    const known = (n: string) => scan.names.has(n) || calls.has(n) || data.tags.has(n) || data.limits.has(n);
    if (known(name)) return true;
    if (name.includes(':') && name.split(':').filter(Boolean).every((p) => strictlyRead(data, p))) return true;
    const wild = (n: string) => known(n) || data.skills.has(n);
    return scan.templates
      .filter((t) => /[^*]/.test(t))
      .some((t) => fitsWith(wild, name, t.split(/(\*+)/).filter((x) => x !== '').map((x) => (x.startsWith('*') ? '*' : x))));
  }

  /** Every string a mod tag in the loaded skill data names (any tag field but `type`), every minion
   * limit, and every skill name with its whitespace removed. */
  async function skillDataNames(): Promise<DataNames> {
    const out = await luaQuery<{ tags: string[]; limits: string[]; skills: string[] }>(`
      local names, limits, skills = {}, {}, {}
      local function tags(mod)
        if type(mod) ~= 'table' then return end
        for _, tag in ipairs(mod) do
          if type(tag) == 'table' then
            for k, v in pairs(tag) do
              if k ~= 'type' and type(v) == 'string' then names[v] = true end
              if k ~= 'type' and type(v) == 'table' then
                for _, s in ipairs(v) do if type(s) == 'string' then names[s] = true end end
              end
            end
          end
        end
        if type(mod.value) == 'table' and type(mod.value.mod) == 'table' then tags(mod.value.mod) end
      end
      local function list(l) for _, mod in ipairs(type(l) == 'table' and l or {}) do tags(mod) end end
      for _, skill in pairs(data.skills) do
        list(skill.baseMods)
        for _, ss in ipairs(skill.statSets or {}) do
          for _, entry in pairs(ss.statMap or {}) do list(entry) end
          list(ss.baseMods)
        end
        if type(skill.name) == 'string' and skill.name ~= '' then skills[(skill.name:gsub('%s+', ''))] = true end
      end
      for _, entry in pairs(build.data.skillStatMap) do list(entry) end
      for _, set in ipairs({ data.minions or {}, data.spectres or {} }) do
        for _, m in pairs(set) do if type(m) == 'table' and type(m.limit) == 'string' then limits[m.limit] = true end end
      end
      local function keys(t) local o = {} for k in pairs(t) do table.insert(o, k) end table.sort(o) return o end
      return { tags = keys(names), limits = keys(limits), skills = keys(skills) }`);
    return { tags: new Set(arr(out.tags)), limits: new Set(arr(out.limits)), skills: new Set(arr(out.skills)) };
  }

  it(
    'AC-K50 (mapped but unread): Aftershock I flags its AftershockChance line; Mirage Archer\'s "cannot consume Charges" line is read through skill-data condition tags',
    async () => {
      const aftershock = await okTool({ gems: ['Aftershock I'] });
      const line = 'Supported skills have 25% chance to cause an additional Aftershock';
      const flags = ofFlag(parseFlags(aftershock), 'mapped but unread');
      expect(flags.map((x) => ({ source: x.source, line: x.line }))).toEqual([{ source: 'Gem Aftershock I / Aftershock I', line }]);
      expect(flags[0].note).toContain('AftershockChance');
      // D-243's suffix rule reads it (it ends with the template literal "Chance"); the strict reading doesn't:
      // "aftershock" appears in no file of Modules/ or Classes/, and Data/SkillStatMap.lua:2706 only maps it.
      const dataNames = await skillDataNames();
      expect(readByName(scan, 'AftershockChance')).toBe(true);
      expect(strictlyRead(dataNames, 'AftershockChance')).toBe(false);
      // The line's status is unchanged: fully parsed, as AC-K13's rule rates a mapped stat.
      expect(parseCoverage(aftershock).entries.find((e) => e.line === line)?.status).toBe('fully parsed');

      const mirage = await okTool({ gems: ['Mirage Archer'] });
      const charges = parseCoverage(mirage).entries.find((e) => e.line === 'Socketed Skills cannot consume Charges');
      expect(charges?.status).toBe('fully parsed');
      expect(ofFlag(parseFlags(mirage), 'mapped but unread').filter((x) => x.line === 'Socketed Skills cannot consume Charges')).toEqual([]);
      // Read through a condition tag: Data/Skills/act_dex.lua:222 (Barrage) tests var "CannotConsumeCharges".
      expect(dataNames.tags.has('CannotConsumeCharges')).toBe(true);
      expect(scan.names.has('CannotConsumeCharges')).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K50 (mapped but unread, literal): PoB reads Raise Zombie\'s limit, Flameblast\'s stage cap and Flicker Strike\'s extra strikes, so none is flagged',
    async () => {
      // Each gem's line for the stat below, and the mod name its stat map gives (Lua query).
      const cases = [
        // Data/Minions.lua:29 gives Raised Zombie `limit = "ActiveZombieLimit"`; Modules/CalcPerform.lua:1298-1303
        // sums the minion data's limit by name.
        { gem: 'Raise Zombie', stat: 'base_number_of_zombies_allowed', mod: 'ActiveZombieLimit' },
        // Modules/CalcActiveSkill.lua:866-869 builds "Multiplier:"..name:gsub("%s+", "").."MaxStages".
        { gem: 'Flameblast', stat: 'flameblast_maximum_stages', mod: 'Multiplier:FlameblastMaxStages' },
        // Data/Skills/act_int.lua:8673: skillModList:Sum("BASE", cfg, "AdditionalFlickersPerPowerCharge").
        { gem: 'Flicker Strike', stat: 'flicker_strike_additional_flickers_from_power_charges', mod: 'AdditionalFlickersPerPowerCharge' },
      ];
      const dataNames = await skillDataNames();
      for (const c of cases) {
        const text = await okTool({ gems: [c.gem] });
        const result = await scannedAction({ gems: [c.gem] });
        const line = arr(result.entries).find((e) => e.stat === c.stat);
        expect({ gem: c.gem, found: line !== undefined }).toEqual({ gem: c.gem, found: true });
        const flagged = arr(result.flags).filter((x) => x.flag === 'mapped but unread' && x.line === line!.line);
        expect({ gem: c.gem, flagged }).toEqual({ gem: c.gem, flagged: [] });
        // The text agrees.
        expect(ofFlag(parseFlags(text), 'mapped but unread').filter((x) => x.line === line!.line)).toEqual([]);
        const mods = arr(
          await luaQuery<string[]>(`
            local out = {}
            for _, mod in ipairs(build.data.skillStatMap[${JSON.stringify(c.stat)}] or {}) do table.insert(out, mod.name) end
            for _, skill in pairs(data.skills) do
              for _, ss in ipairs(skill.statSets or {}) do
                for _, mod in ipairs((ss.statMap or {})[${JSON.stringify(c.stat)}] or {}) do table.insert(out, mod.name) end
              end
            end
            return out`),
        );
        expect({ gem: c.gem, mods }).toEqual({ gem: c.gem, mods: expect.arrayContaining([c.mod]) });
        expect({ mod: c.mod, read: strictlyRead(dataNames, c.mod) }).toEqual({ mod: c.mod, read: true });
        // The suffix-free scan alone doesn't read it: the strict reading's additions do.
        expect({ mod: c.mod, scanned: scan.names.has(c.mod) }).toEqual({ mod: c.mod, scanned: false });
      }
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K50 (mapped but unread): over every gem, the flagged lines equal the mapped lines whose stat map yields a mod name the strict reading finds unread (Lua query)',
    async () => {
      const catalogue = await gemCatalogue();
      expect(catalogue.length).toBeGreaterThan(900);
      const result = await scannedAction({ gems: catalogue.map((g) => g.name) });
      const checked = arr(result.gems).map((g) => ({ name: g.name, level: g.level, quality: g.quality }));
      expect(checked).toHaveLength(catalogue.length);
      const mapped = arr(
        await luaQuery<Array<{ source: string; line: string; names: string[] | Record<string, never> }>>(`
          ${wantPrelude(checked)}
          local function names(list, acc)
            for _, mod in ipairs(list) do
              if type(mod) == 'table' then
                if type(mod.name) == 'string' then table.insert(acc, mod.name) end
                if type(mod.value) == 'table' and type(mod.value.mod) == 'table' then names({ mod.value.mod }, acc) end
              end
            end
            return acc
          end
          local out = {}
          for _, w in ipairs(want) do
            local gem = gemNamed(w.name)
            for _, ge in ipairs(effectsOf(gem)) do
              for i, ss in ipairs(ge.statSets or {}) do
                local lines, lineMap = data.describeStats(calcLib.buildSkillInstanceStats({ level = w.level, quality = w.quality }, ge, ss), ss.statDescriptionScope)
                for _, line in ipairs(lines) do
                  local stat = lineMap[line]
                  local entry = stat and ((ss.statMap and ss.statMap[stat]) or build.data.skillStatMap[stat])
                  if entry then
                    table.insert(out, { source = 'Gem ' .. gem.name .. ' / ' .. labelOf(ge, ss, i),
                      line = (line:gsub('%s*\\n%s*', ' ')), names = names(entry, {}) })
                  end
                end
              end
            end
          end
          return out`),
      );
      expect(mapped.length).toBeGreaterThan(1000);
      const dataNames = await skillDataNames();
      const expected: string[] = [];
      const unreadOf = new Map<string, string[]>();
      for (const m of mapped) {
        const unread = [...new Set(arr(m.names).filter((n) => !strictlyRead(dataNames, n)))];
        if (unread.length === 0) continue;
        const key = JSON.stringify([m.source, m.line]);
        expected.push(key);
        unreadOf.set(key, unread);
      }
      const flagged = arr(result.flags).filter((x) => x.flag === 'mapped but unread');
      const actual = flagged.map((x) => JSON.stringify([x.source, x.line]));
      expect(tallyKeys(actual)).toEqual(tallyKeys(expected));
      // Each note names the unread mod names.
      for (const x of flagged) {
        for (const n of unreadOf.get(JSON.stringify([x.source, x.line])) ?? []) expect({ line: x.line, note: x.note }).toEqual({ line: x.line, note: expect.stringContaining(n) });
      }
      // No status moved: the gem entries are still AC-K13's two statuses.
      expect(arr(result.entries).every((e) => e.status === 'fully parsed' || e.status === UNMODELLED)).toBe(true);
      // The count at the pin (default levels, or the golden build's for its gems).
      expect(expected).toHaveLength(23);
      expect(expected).toContain(JSON.stringify(['Gem Aftershock I / Aftershock I', 'Supported skills have 25% chance to cause an additional Aftershock']));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K50 (stat not mapped): Mirage Archer reports triggered_by_lingering_mirage, which ends its false all-clear',
    async () => {
      const text = await okTool({ gems: ['Mirage Archer'] });
      // Every described line is fully parsed: without the flag this would be an all-clear.
      expect(parseCoverage(text).entries.every((e) => e.status === 'fully parsed')).toBe(true);
      // One flag for the gem, no line; its note lists the stat ids sorted, triggered_by_lingering_mirage among them.
      const flags = ofFlag(parseFlags(text), 'stat not mapped');
      expect(flags).toHaveLength(1);
      expect(flags[0].source).toBe('Gem Mirage Archer');
      expect(flags[0].line).toBeUndefined();
      const ids = unmappedIds(flags[0].note);
      expect(ids).toContain('triggered_by_lingering_mirage');
      expect(ids).toEqual([...ids].sort());
      expect(flags[0].note).toContain("PoB may derive some of these from the gem's skill types.");
      // Display-only stats are left out (Mirage Archer's quality_display_lingering_mirage_is_gem).
      expect(ids.some((id) => id.startsWith('quality_display_') || id.startsWith('display_'))).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  /** The stat ids a `stat not mapped` note lists. */
  function unmappedIds(note: string): string[] {
    const m = /^PoB has no stat map for (.+); what (it|they) drives? may not be modelled\. PoB may derive (it|some of these) from the gem's skill types\.$/.exec(note);
    expect({ note, matches: m !== null }).toEqual({ note, matches: true });
    const ids = m![1].split(', ');
    expect({ note, wording: [m![2], m![3]] }).toEqual({ note, wording: ids.length === 1 ? ['it', 'it'] : ['they', 'some of these'] });
    return ids;
  }

  it(
    'AC-K50 (stat not mapped): over every support or meta gem, one flag per gem whose sorted stat ids equal a Lua query\'s by the rule',
    async () => {
      const catalogue = (await gemCatalogue()).filter((g) => g.support || g.meta);
      const result = await scannedAction({ gems: catalogue.map((g) => g.name) });
      const checked = arr(result.gems).map((g) => ({ name: g.name, level: g.level, quality: g.quality }));
      const expected = arr(
        await luaQuery<string[]>(`
          ${wantPrelude(checked)}
          local function same(a, b)
            if #a ~= #b then return false end
            for i = 1, #a do if a[i] ~= b[i] then return false end end
            return true
          end
          local out, seen = {}, {}
          for _, w in ipairs(want) do
            local gem = gemNamed(w.name)
            for _, ge in ipairs(effectsOf(gem)) do
              for _, ss in ipairs(ge.statSets or {}) do
                local stats = calcLib.buildSkillInstanceStats({ level = w.level, quality = w.quality }, ge, ss)
                local full = data.describeStats(stats, ss.statDescriptionScope)
                for stat, v in pairs(stats) do
                  if type(v) == 'number' and v ~= 0 and not ((ss.statMap and ss.statMap[stat]) or build.data.skillStatMap[stat])
                      and not stat:find('^display_') and not stat:find('^quality_display_') then
                    local without = {}
                    for k, x in pairs(stats) do if k ~= stat then without[k] = x end end
                    local key = gem.name .. '|' .. stat
                    if not seen[key] and same(full, data.describeStats(without, ss.statDescriptionScope)) then
                      seen[key] = true
                      table.insert(out, key)
                    end
                  end
                end
              end
            end
          end
          table.sort(out)
          return out`),
      );
      // The Lua query's pairs, as gem -> its stat ids sorted.
      const expectedByGem: Record<string, string[]> = {};
      for (const key of expected) {
        const [gem, stat] = key.split('|');
        (expectedByGem[gem] ??= []).push(stat);
      }
      for (const gem of Object.keys(expectedByGem)) expectedByGem[gem].sort();
      const flagged = arr(result.flags).filter((x) => x.flag === 'stat not mapped');
      const actualByGem: Record<string, string[]> = {};
      for (const x of flagged) {
        expect(x.line).toBeUndefined();
        const gem = x.source.replace(/^Gem /, '');
        expect({ gem, repeated: gem in actualByGem }).toEqual({ gem, repeated: false });
        actualByGem[gem] = unmappedIds(x.note);
      }
      expect(actualByGem).toEqual(expectedByGem);
      expect(actualByGem['Mirage Archer']).toContain('triggered_by_lingering_mirage');
      // Gems that are neither support nor meta get none.
      const active = await scannedAction({ gems: ['Fireball', 'Gas Grenade', 'Snipe'] });
      expect(arr(active.flags).filter((x) => x.flag === 'stat not mapped')).toEqual([]);
      // The counts at the pin: one flag per gem, listing every qualifying stat.
      expect(flagged).toHaveLength(115);
      expect(expected).toHaveLength(318);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K53: Cast on Critical reports one energy not modelled flag and keeps its statuses; over every meta gem and Trail of Caltrops, exactly the Meta + GeneratesEnergy gems are flagged; no scanned file names GeneratesEnergy',
    async () => {
      const text = await okTool({ gems: ['Cast on Critical'] });
      expect(ofFlag(parseFlags(text), 'energy not modelled')).toEqual([
        { flag: 'energy not modelled', source: 'Gem Cast on Critical', note: "PoB doesn't model Energy; any trigger rate it shows isn't based on Energy." },
      ]);
      const entries = parseCoverage(text).entries;
      expect(entries).toHaveLength(5);
      expect(entries.every((e) => e.status === UNMODELLED)).toBe(true);

      const catalogue = await gemCatalogue();
      const metas = catalogue.filter((g) => g.meta);
      expect(metas).toHaveLength(29);
      const caltrops = catalogue.find((g) => g.name === 'Trail of Caltrops');
      expect(caltrops).toMatchObject({ meta: false });
      const result = await scannedAction({ gems: [...metas.map((g) => g.name), 'Trail of Caltrops'] });
      const flagged = arr(result.flags)
        .filter((x) => x.flag === 'energy not modelled')
        .map((x) => {
          expect(x.line).toBeUndefined();
          return x.source.replace(/^Gem /, '');
        })
        .sort();
      const expected = catalogue.filter((g) => g.energy).map((g) => g.name).sort();
      expect(flagged).toEqual(expected);
      expect(expected).toHaveLength(16);
      expect(expected).toEqual(expect.arrayContaining(['Cast on Critical', 'Cast on Melee Kill', 'Spellslinger', 'Barrier Invocation']));
      expect(expected).not.toContain('Mirage Archer');
      expect(expected).not.toContain('Trail of Caltrops');

      expect((await pobSourceNames(POB_SRC)).has('GeneratesEnergy')).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K54: Paquate\'s Pact reports level from support naming Twisted Pact and its checked level; over every support gem with a granted effect, one flag per defined, non-support, visible granted skill',
    async () => {
      const text = await okTool({ gems: ["Paquate's Pact"] });
      const level = Number(/Paquate's Pact at gem level (\d+)/.exec(text)![1]);
      expect(level).toBe(1);
      const flags = ofFlag(parseFlags(text), 'level from support');
      expect(flags).toHaveLength(1);
      expect(flags[0]).toMatchObject({ source: "Gem Paquate's Pact" });
      expect(flags[0].line).toBeUndefined();
      expect(flags[0].note).toContain('Twisted Pact');
      expect(flags[0].note).toContain(`level, ${level} `);
      // Twisted Pact's lines keep their statuses: the marked ones are PoB's red-tooltip lines (AC-K13's rule).
      const cov = parseCoverage(text);
      expect(cov.entries.some((e) => e.source === "Gem Paquate's Pact / Twisted Pact")).toBe(true);
      const pob = await luaQuery<{ red: string[] | Record<string, never> }>(redLinesQuery("Paquate's Pact"));
      expect(cov.entries.filter((e) => e.status === UNMODELLED).map((e) => `${e.source} | ${e.line}`)).toEqual(arr(pob.red));

      const supports = (await gemCatalogue()).filter((g) => g.support && g.additional);
      const result = await scannedAction({ gems: [...supports.map((g) => g.name), 'Pounce', 'Mirage Archer'] });
      const levels = new Map(arr(result.gems).map((g) => [g.name, g.level]));
      const expected = arr(
        await luaQuery<string[]>(`
          local out = {}
          for _, name in ipairs(${luaStrings(supports.map((g) => g.name))}) do
            local gem
            for id, g in pairs(data.gems) do
              if type(g) == 'table' and g.name == name and g.grantedEffect and (not gem or id < gem.id) then gem = g end
            end
            local i = 1
            while gem['additionalGrantedEffectId' .. i] do
              local id = gem['additionalGrantedEffectId' .. i]
              local e = data.skills[id]
              if e and not e.support and not e.hideFromSideBar then
                table.insert(out, name .. '|' .. ((e.name ~= '' and e.name) or id) .. '|' .. id .. '|' .. (e.hasGlobalEffect and 'global' or '-'))
              end
              i = i + 1
            end
          end
          table.sort(out)
          return out`),
      );
      const actual = arr(result.flags)
        .filter((x) => x.flag === 'level from support')
        .map((x) => {
          const gem = x.source.replace(/^Gem /, '');
          const m = /^PoB computes (.+) \((\S+)\), the skill this support grants, at the support gem's level, (\d+) \(Modules\/CalcSetup\.lua:1851-1876\)\. The game may use another level\.( PoB computes it only when it is enabled in the skill's options\.)?$/.exec(x.note);
          expect({ note: x.note, matches: m !== null }).toEqual({ note: x.note, matches: true });
          expect({ gem, level: Number(m![3]) }).toEqual({ gem, level: levels.get(gem) });
          return `${gem}|${m![1]}|${m![2]}|${m![4] ? 'global' : '-'}`;
        })
        .sort();
      expect(actual).toEqual(expected);
      expect(expected).toHaveLength(52);
      // Empowered Sparks I grants two skills named Empowered Sparks; the flag names the visible one.
      // TriggeredSparkEmpowerPlayer is hideFromSideBar, which CalcSetup.lua:1855 skips.
      expect(actual.filter((k) => k.startsWith('Empowered Sparks I|'))).toEqual(['Empowered Sparks I|Empowered Sparks|TriggeredEmpoweredSparkPlayer|-']);
      // A granted skill with a global effect is computed only when its enableGlobal switch is on
      // (CalcSetup.lua:1855): Morrigan's Insight's Nature's Exchange, the one such skill at the pin.
      expect(actual.filter((k) => k.endsWith('|global'))).toEqual(["Morrigan's Insight|Nature's Exchange|TriggeredMorrigansInsightPlayer|global"]);
      expect(actual.filter((k) => k.startsWith('Concussive Runes|'))).toEqual([]);
      expect(actual.filter((k) => k.startsWith('Pounce|') || k.startsWith('Mirage Archer|'))).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K55: Concussive Runes reports granted skill undefined naming ConcussiveRunesPlayer; over every gem with an additional granted effect, exactly the undefined ids are flagged; Supporting Fire and Skeletal Brute show the flag without a flagged line',
    async () => {
      const text = await okTool({ gems: ['Concussive Runes'] });
      const flags = ofFlag(parseFlags(text), 'granted skill undefined');
      expect(flags).toHaveLength(1);
      expect(flags[0]).toMatchObject({ source: 'Gem Concussive Runes' });
      expect(flags[0].line).toBeUndefined();
      expect(flags[0].note).toContain('ConcussiveRunesPlayer');
      const entries = parseCoverage(text).entries;
      expect(entries.map((e) => e.line)).toEqual(['Supported Skills Trigger a Runic Shockwave on Heavy Stunning an enemy']);
      const pob = await luaQuery<{ red: string[] | Record<string, never> }>(redLinesQuery('Concussive Runes'));
      expect(entries.filter((e) => e.status === UNMODELLED).map((e) => `${e.source} | ${e.line}`)).toEqual(arr(pob.red));

      const withAdditional = (await gemCatalogue()).filter((g) => g.additional);
      expect(withAdditional.length).toBe(156);
      const result = await scannedAction({ gems: withAdditional.map((g) => g.name) });
      const expected = arr(
        await luaQuery<string[]>(`
          local out = {}
          for _, name in ipairs(${luaStrings(withAdditional.map((g) => g.name))}) do
            local gem
            for id, g in pairs(data.gems) do
              if type(g) == 'table' and g.name == name and g.grantedEffect and (not gem or id < gem.id) then gem = g end
            end
            local i = 1
            while gem['additionalGrantedEffectId' .. i] do
              local id = gem['additionalGrantedEffectId' .. i]
              if not data.skills[id] then table.insert(out, name .. '|' .. id) end
              i = i + 1
            end
          end
          table.sort(out)
          return out`),
      );
      const actual = arr(result.flags)
        .filter((x) => x.flag === 'granted skill undefined')
        .map((x) => {
          const gem = x.source.replace(/^Gem /, '');
          const m = /^This gem grants (\S+), which PoB has no skill data for/.exec(x.note);
          expect(m).not.toBeNull();
          return `${gem}|${m![1]}`;
        })
        .sort();
      expect(actual).toEqual(expected);
      expect(expected.map((k) => k.split('|')[0]).sort()).toEqual(
        ['Concussive Runes', 'Skeletal Arsonist', 'Skeletal Brute', 'Skeletal Frost Mage', 'Skeletal Reaver', 'Skeletal Sniper', 'Skeletal Storm Mage', 'Supporting Fire'].sort(),
      );

      // The flag shows where no line would: Supporting Fire's lines are all fully parsed; Skeletal Brute has none.
      const fire = await okTool({ gems: ['Supporting Fire'] });
      const fireEntries = parseCoverage(fire).entries;
      expect(fireEntries).toHaveLength(2);
      expect(fireEntries.every((e) => e.status === 'fully parsed')).toBe(true);
      expect(ofFlag(parseFlags(fire), 'granted skill undefined').map((x) => x.source)).toEqual(['Gem Supporting Fire']);
      const brute = await okTool({ gems: ['Skeletal Brute'] });
      expect(parseCoverage(brute).entries).toEqual([]);
      expect(ofFlag(parseFlags(brute), 'granted skill undefined').map((x) => x.source)).toEqual(['Gem Skeletal Brute']);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K56: Gem Studded flags its three colour lines support colour tie and keeps every status; over every passive node, exactly the lines on a MostNumerous…SocketedSupports condition are flagged; the flag is static',
    async () => {
      const ids = arr(
        await luaQuery<number[]>(`
          local ids = {}
          for id, node in pairs(build.spec.nodes) do if node.name == 'Gem Studded' then table.insert(ids, id) end end
          table.sort(ids)
          return ids`),
      );
      expect(ids).toHaveLength(1);
      const source = `Node ${ids[0]} Gem Studded`;
      const text = await okTool({ nodes: ['Gem Studded'] });
      const colours = [
        'Red: Hits against you have no Critical Damage Bonus',
        'Blue: Skills have 30% less cost',
        'Green: 40% less Movement Speed Penalty from using Skills while Moving',
      ];
      const flags = ofFlag(parseFlags(text), 'support colour tie');
      expect(flags.map((x) => ({ source: x.source, line: x.line }))).toEqual(colours.map((line) => ({ source, line })));
      for (const x of flags) expect(x.note).toMatch(/red, then green, then blue/);
      // Every line keeps the status PoB's parse gives it; the first line has no flag.
      const cov = parseCoverage(text);
      const first = 'For each colour of Socketed Support Gem that is most numerous, gain:';
      expect(cov.entries.map((e) => e.line)).toEqual([first, ...colours]);
      const pob = await parses([first, ...colours]);
      cov.entries.forEach((e, i) => expect({ line: e.line, status: e.status }).toEqual({ line: e.line, status: deriveStatus(pob[i], scan) }));

      // Over every node: the flagged lines are those whose parse has a Condition tag on a MostNumerous one.
      const census = await luaQuery<{ ids: number[]; tie: string[] | Record<string, never>; majority: string[] | Record<string, never> }>(`
        local ids, tie, majority = {}, {}, {}
        local TIE = { MostNumerousRedSocketedSupports = true, MostNumerousGreenSocketedSupports = true, MostNumerousBlueSocketedSupports = true }
        for id, node in pairs(build.spec.nodes) do
          if node.sd and #node.sd > 0 then table.insert(ids, id) end
          for _, sd in ipairs(node.sd or {}) do
            for line in tostring(sd):gmatch('[^\\n]+') do
              for _, mod in ipairs((modLib.parseMod(line)) or {}) do
                for _, tag in ipairs(mod) do
                  if type(tag) == 'table' and tag.type == 'Condition' and type(tag.var) == 'string' then
                    if TIE[tag.var] then table.insert(tie, 'Node ' .. id .. ' ' .. node.name .. ' | ' .. line) end
                    if tag.var:match('^Majority.*SocketedSupports$') then table.insert(majority, 'Node ' .. id .. ' ' .. node.name .. ' | ' .. line) end
                  end
                end
              end
            end
          end
        end
        table.sort(ids)
        table.sort(tie)
        table.sort(majority)
        return { ids = ids, tie = tie, majority = majority }`);
      expect(arr(census.ids).length).toBeGreaterThan(1000);
      const all = await coverageAction({ nodes: arr(census.ids) });
      const flagged = arr(all.flags)
        .filter((x) => x.flag === 'support colour tie')
        .map((x) => `${x.source} | ${x.line}`)
        .sort();
      expect(flagged).toEqual(arr(census.tie));
      expect(flagged).toEqual(colours.map((line) => `${source} | ${line}`).sort());
      // Crystallised Immunities' strict-majority lines aren't flagged.
      const majority = arr(census.majority);
      expect(majority.length).toBe(3);
      expect(majority.every((m) => m.includes('Crystallised Immunities'))).toBe(true);
      for (const m of majority) expect(flagged).not.toContain(m);

      // Static: the golden build's socketed supports don't tie, and the flags are reported all the same.
      const counts = await luaQuery<{ R: number; G: number; B: number }>(`
        local m = build.calcsTab.mainEnv.modDB.multipliers
        return { R = m.RedSupportGems or 0, G = m.GreenSupportGems or 0, B = m.BlueSupportGems or 0 }`);
      const top = Math.max(counts.R, counts.G, counts.B);
      expect([counts.R, counts.G, counts.B].filter((n) => n === top)).toHaveLength(1);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K57: a flag changes no status or count; build mode reports the flags single-source calls give, after a group with Cast on Critical, Paquate\'s Pact and Concussive Runes is added',
    async () => {
      // No status moves: the gem lines keep PoB's red-tooltip rule, the node lines PoB's parse, and the
      // counts cover the entries.
      const gems = ['Cast on Critical', "Paquate's Pact", 'Concussive Runes', 'Mirage Archer', 'Aftershock I'];
      const text = await okTool({ gems, nodes: ['Gem Studded'] });
      const cov = parseCoverage(text);
      expect(parseFlags(text).length).toBeGreaterThan(0);
      expect(cov.total).toBe(cov.entries.length);
      expect(Object.values(cov.counts).reduce((a, b) => a + b, 0)).toBe(cov.total);
      for (const name of gems) {
        const pob = await luaQuery<{ red: string[] | Record<string, never> }>(redLinesQuery(name));
        const marked = cov.entries.filter((e) => e.source.startsWith(`Gem ${name} / `) && e.status === UNMODELLED).map((e) => `${e.source} | ${e.line}`);
        expect({ name, marked }).toEqual({ name, marked: arr(pob.red) });
      }
      const nodeEntries = cov.entries.filter((e) => e.source.startsWith('Node '));
      const pob = await parses(nodeEntries.map((e) => e.line));
      nodeEntries.forEach((e, i) => expect({ line: e.line, status: e.status }).toEqual({ line: e.line, status: deriveStatus(pob[i], scan) }));

      const golden = parseFlags(await okTool({ build: true }));
      console.error(`[modelCoverage] AC-K57 golden build mode: ${golden.length} flags (${golden.map((x) => `${x.flag} ${x.source}`).join('; ')})`);

      try {
        const created = await f.call('create_socket_group', { label: 'WU-54 flags' });
        expect(created.isError).toBe(false);
        const group = Number(/Socket group (\d+) created/.exec(created.text)![1]);
        for (const [gem_name, level] of [['Cast on Critical', 20], ["Paquate's Pact", 1], ['Concussive Runes', 1]] as const) {
          const added = await f.call('add_gem', { group_index: group, gem_name, level });
          expect({ gem_name, isError: added.isError }).toEqual({ gem_name, isError: false });
        }

        const build = await okTool({ build: true });
        const buildFlags = parseFlags(build);
        expect(parseCoverage(build).entries.filter((e) => e.status === 'fully parsed')).toEqual([]);

        // Single-source calls over what build mode checks (AC-K14's set).
        const what = await luaQuery<{
          items: Array<{ source: string; raw: string }> | Record<string, never>;
          nodes: number[] | Record<string, never>;
          gems: string[] | Record<string, never>;
        }>(`
          local items, nodes, gems, seen = {}, {}, {}, {}
          for slotName, slot in pairs(build.itemsTab.activeItemSet) do
            local item = type(slot) == 'table' and (slot.selItemId or 0) > 0 and build.itemsTab.items[slot.selItemId]
            if item then table.insert(items, { source = 'Item ' .. slotName .. ': ' .. item.name, raw = item:BuildRaw() }) end
          end
          for nodeId, itemId in pairs(build.spec.jewels) do
            local item = itemId > 0 and build.spec.allocNodes[nodeId] and build.itemsTab.items[itemId]
            if item then table.insert(items, { source = 'Jewel socket ' .. nodeId .. ': ' .. item.name, raw = item:BuildRaw() }) end
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
        const single: string[] = [];
        for (const item of arr(what.items)) {
          for (const x of parseFlags(await okTool({ item_text: item.raw }))) single.push(flagKey({ ...x, source: item.source }));
        }
        for (const x of parseFlags(await okTool({ nodes: arr(what.nodes).map(String) }))) single.push(flagKey(x));
        for (const x of parseFlags(await okTool({ gems: arr(what.gems) }))) single.push(flagKey(x));
        expect(tallyKeys(buildFlags.map(flagKey))).toEqual(tallyKeys(single));

        // The added gems' flags are among them.
        expect(buildFlags.some((x) => x.flag === 'energy not modelled' && x.source === 'Gem Cast on Critical')).toBe(true);
        expect(buildFlags.some((x) => x.flag === 'level from support' && x.source === "Gem Paquate's Pact")).toBe(true);
        expect(buildFlags.some((x) => x.flag === 'granted skill undefined' && x.source === 'Gem Concussive Runes')).toBe(true);
      } finally {
        const reload = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
        expect(reload.isError).toBe(false);
      }
    },
    ENGINE_TIMEOUT,
  );
});
