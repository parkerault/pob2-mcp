/**
 * M2 (WU-34, C-47): the ranker amendments, in process and engine-required. AC-K20, AC-K21, AC-K22 and AC-K44.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handlers, session, bridge
 * and luajit). Every expected value comes from PoB or from the other tools, never from the ranker's own
 * output:
 * - `suggest_supports`' pool and its null measurements are `list_support_candidates` (measured), called
 *   through the session; its possibly unmodelled gems are `check_model_coverage {gems:[name]}`, one call
 *   per pool candidate;
 * - `get_passive_upgrades`' measured pool is rebuilt by a Lua query (`__test_eval`) the way node power's pass
 *   takes it (D-417, WU-92): every unallocated main-tree Normal, Notable or Keystone node with modifiers within 6
 *   points of the tree; its null measurements are PoB's calculator over each path (Lua query); its lines'
 *   statuses are `check_model_coverage {nodes:[…]}` over the pool, read per node section;
 * - ascendancy membership, allocation and `pathDist` are Lua queries of `build.spec.nodes`.
 * AC-E32 and AC-E39 run unchanged in `engineTree.test.ts` and `engineItemsSkills.test.ts`; AC-B3's read
 * check of the `include_ascendancy` sample runs in `engineKinds.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { GOLDEN_XML, startSessionFixture, writeBuild, type SessionFixture } from '../helpers/engineSession';
import type { EngineKind } from '../../src/engine/session';
import type { PoBLuaApiClient } from '../../src/pobLuaBridge';
import type { SupportCandidatesResult } from '../../src/engine/schemas';

const ENGINE_TIMEOUT = 300_000;
const CANT_MEASURE = "## What PoB can't fully measure";
const ASCENDANCY_SECTION = '## Ascendancy notables (cost in ascendancy points)';
const UNMODELLED = 'possibly unmodelled; check config';

/** A measured candidate, as a test derives it from PoB. */
interface PoolNode {
  id: number;
  name: string;
  path: number[];
  /** Its stat lines (`node.sd`). */
  lines: number;
  ascendancy: boolean;
}

/** A Lua table that may come back as `{}` for an empty list. */
const arr = <T>(v: T[] | Record<string, never> | undefined | null): T[] => (Array.isArray(v) ? v : []);

/** The text of one `## ` section: from its heading to the next `## ` heading or the closing tip. */
function section(text: string, heading: string): string | null {
  const start = text.indexOf(`\n${heading}\n`);
  if (start < 0) return null;
  const rest = text.slice(start + heading.length + 2);
  const next = rest.search(/\n## |\n💡 /);
  return next < 0 ? rest : rest.slice(0, next);
}

/** The text before the first added section: the title, the ranking and its notes. */
function ranking(text: string): string {
  const cut = text.indexOf('\n## ');
  return cut < 0 ? text : text.slice(0, cut);
}

/** The can't-measure entries of a passive ranker: `- **<name>** [<id>]…: <reasons>`, one line each. */
function passiveEntries(text: string): Array<{ name: string; id: number; line: string }> {
  return [...text.matchAll(/^- \*\*(.+?)\*\* \[(\d+)\].*$/gm)].map((m) => ({ name: m[1], id: Number(m[2]), line: m[0] }));
}

/** The ranked entries' heading lines: `<n>. **<name>** [<id>]<mark>`, with the next line's path cost. */
function rankedEntries(text: string): Array<{ name: string; id: number; line: string; cost: number; unit: string }> {
  return [...text.matchAll(/^(\d+\. \*\*(.+?)\*\* \[(\d+)\].*)\n {3}Path cost: (\d+) (.+?)  \|/gm)].map((m) => ({
    line: m[1],
    name: m[2],
    id: Number(m[3]),
    cost: Number(m[4]),
    unit: m[5],
  }));
}

/** Every `[<id>]` the output names. */
const idsIn = (text: string): number[] => [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))];

engineDescribe('M2: ranker amendments (WU-34, C-47)', () => {
  let f: SessionFixture;

  async function run<T>(kind: EngineKind, fn: (client: PoBLuaApiClient) => Promise<T>): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:ranker-amendments', kind }, (ctx) => fn(ctx.client));
    return value;
  }

  async function luaQuery<T>(code: string): Promise<T> {
    return run('read', async (client) => (await client.request('__test_eval', { code })).result as T);
  }

  async function okTool(tool: string, args: Record<string, unknown>): Promise<string> {
    const out = await f.call(tool, args);
    expect({ tool, args, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, args, isError: false, text: '' });
    return out.text;
  }

  /** The statuses `check_model_coverage` gives each listed line, as `[<status>] <line>` strings. */
  async function coverageLines(args: Record<string, unknown>): Promise<string[]> {
    const text = await okTool('check_model_coverage', args);
    return text.split('\n').filter((l) => /^\[[^\]]+\] /.test(l));
  }

  /** PoB's own view of nodes: ascendancy, allocation and path cost. */
  async function nodeFacts(ids: number[]): Promise<Record<string, { asc: string | false; alloc: boolean; dist: number | false; name: string }>> {
    if (ids.length === 0) return {};
    return luaQuery(`
      local out = {}
      for _, id in ipairs({ ${ids.join(', ')} }) do
        local node = build.spec.nodes[id]
        out[tostring(id)] = {
          asc = node.ascendancyName or false,
          alloc = build.spec.allocNodes[id] ~= nil,
          dist = (type(node.path) == 'table' and #node.path > 0 and (node.pathDist or 1000) < 1000) and node.pathDist or false,
          name = node.name,
        }
      end
      return out`);
  }

  async function newTitan(): Promise<void> {
    await okTool('lua_new_build', { class_name: 'Warrior', ascendancy: 'Titan' });
    const asc = await luaQuery<string>('return build.spec.curAscendClassName');
    expect(asc).toBe('Titan');
  }

  /** The Titan notables' ids by name (8 at the pin). */
  async function titanNotables(): Promise<Record<string, number>> {
    return luaQuery(`
      local out = {}
      for id, node in pairs(build.spec.nodes) do
        if node.ascendancyName == 'Titan' and node.isNotable then out[node.name] = id end
      end
      return out`);
  }

  /**
   * The main-tree pool, rebuilt as node power's pass takes it (D-417): every unallocated node of the main tree of
   * type Normal, Notable or Keystone with modifiers (a modKey), that no item grants and no locked ascendancy node
   * hides, within 6 points of the tree (PoB's pathDist, as PowerBuilder reads it) and with PoB's path to it.
   */
  async function mainPool(): Promise<PoolNode[]> {
    const nodes = await luaQuery<Array<{ id: number; name: string; path: number[]; lines: number }>>(`
      local spec = build.spec
      local granted = build.calcsTab.mainEnv.grantedPassives or {}
      local types = { Normal = true, Notable = true, Keystone = true }
      local out = {}
      for id, node in pairs(spec.nodes) do
        local hidden = false
        for _, uid in ipairs(node.unlockConstraint and node.unlockConstraint.nodes or {}) do
          local u = spec.nodes[uid]
          if u and u.ascendancyName and not u.alloc then hidden = true end
        end
        local dist = node.pathDist or 1000
        for _, leap in ipairs(node.intuitiveLeapLikesAffecting or {}) do
          if leap.alloc then dist = math.max(math.min(leap.pathDist or 1000, dist), 1) end
        end
        if types[node.type] and not node.ascendancyName and not node.alloc and node.modKey ~= '' and not granted[id]
            and not hidden and dist <= 6 and type(node.path) == 'table' and #node.path > 0 then
          local path = {}
          for i = #node.path, 1, -1 do path[#path + 1] = node.path[i].id end
          out[#out + 1] = { id = id, name = node.name, path = path, lines = #(node.sd or {}) }
        end
      end
      return out`);
    return arr(nodes).map((n) => ({ ...n, path: arr(n.path), ascendancy: false }));
  }

  /** The build's own ascendancy pool: every unallocated notable of its ascendancy that PoB has a path to. */
  async function ascendancyPool(): Promise<PoolNode[]> {
    const nodes = await luaQuery<Array<{ id: number; name: string; path: number[]; lines: number }>>(`
      local out = {}
      local asc = build.spec.curAscendClassName
      for id, node in pairs(build.spec.nodes) do
        if node.ascendancyName == asc and node.isNotable and not build.spec.allocNodes[id]
            and type(node.path) == 'table' and #node.path > 0 and (node.pathDist or 1000) < 1000 then
          local path = {}
          for _, p in ipairs(node.path) do path[#path + 1] = p.id end
          out[#out + 1] = { id = id, name = node.name, path = path, lines = #(node.sd or {}) }
        end
      end
      return out`);
    return arr(nodes).map((n) => ({ ...n, path: arr(n.path), ascendancy: true }));
  }

  /** The pool nodes whose path PoB's calculator gives no value for the focus's stat(s) (or fails on). */
  async function nullMeasured(pool: PoolNode[], focus: 'dps' | 'defence' | 'both'): Promise<Set<number>> {
    if (pool.length === 0) return new Set();
    const values = await luaQuery<Array<{ id: number; ok: boolean; dps: boolean; ehp: boolean }>>(`
      local calcFunc = build.calcsTab:GetMiscCalculator()
      local out = {}
      for _, c in ipairs({ ${pool.map((c) => `{ id = ${c.id}, path = { ${c.path.join(', ')} } }`).join(', ')} }) do
        local add = {}
        for _, id in ipairs(c.path) do add[build.spec.nodes[id]] = true end
        -- Full DPS is off: the ranker reads CombinedDPS, TotalDPS, TotalEHP and Life only.
        local ok, res = pcall(calcFunc, { addNodes = add }, false)
        local num = function(k) return ok and type(res) == 'table' and type(res[k]) == 'number' end
        out[#out + 1] = { id = c.id, ok = ok and type(res) == 'table',
          dps = num('CombinedDPS') or num('TotalDPS'), ehp = num('TotalEHP') or num('Life') }
      end
      return out`);
    return new Set(
      arr(values)
        .filter((v) => !v.ok || (focus !== 'defence' && !v.dps) || (focus !== 'dps' && !v.ehp))
        .map((v) => v.id),
    );
  }

  /**
   * Per pool node, the `[<status>] <line>` lines `check_model_coverage` doesn't rate fully parsed: one call over the
   * whole pool, read per node section (`## Node <id> <name>`).
   */
  async function notFullyParsed(pool: PoolNode[]): Promise<Map<number, string[]>> {
    const out = new Map<number, string[]>();
    if (pool.length === 0) return out;
    const text = await okTool('check_model_coverage', { nodes: pool.map((c) => c.id) });
    for (const sectionText of text.split(/^## /m).slice(1)) {
      const id = /^Node (\d+)/.exec(sectionText)?.[1];
      if (id === undefined) continue;
      const lines = sectionText.split('\n').filter((l) => /^\[[^\]]+\] /.test(l) && !l.startsWith('[fully parsed] '));
      if (lines.length > 0) out.set(Number(id), [...(out.get(Number(id)) ?? []), ...lines]);
    }
    return out;
  }

  /** Checks each listed reason's kind label (C-47, D-243): `advisory` for possibly unread lines, `not applied` for the rest. */
  function expectKinds(entry: { line: string }, lines: string[]): void {
    const groups = entry.line.replace(/^- \*\*.+?\*\* \[\d+\][^:]*: /, '').split(' | ');
    for (const line of lines) {
      const group = groups.find((g) => g.includes(line));
      expect({ line, group: group ?? null }).toEqual({ line, group: expect.any(String) });
      const kind = line.startsWith('[possibly unread] ') ? 'advisory: ' : 'not applied: ';
      expect({ line, kind: group!.startsWith(kind) }).toEqual({ line, kind: true });
    }
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  describe('on the golden build', () => {
    beforeAll(async () => {
      const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
      expect(load.isError).toBe(false);
    }, ENGINE_TIMEOUT);

    it(
      'AC-K20: suggest_supports {group_index:11, count:3} ranks the pool\'s first 3 by delta descending (ties by name), and its can\'t-measure section names exactly, once each, the pool candidates with a null measurement or a line check_model_coverage {gems:[name]} marks possibly unmodelled',
      async () => {
        const main = await luaQuery<number>('return build.mainSocketGroup');
        expect(main).toBe(11);

        const out = await okTool('suggest_supports', { group_index: 11, count: 3 });

        // The pool and its measurements, as list_support_candidates measures them (an independent call).
        const pool = await run('read', async (client) =>
          (await client.request('list_support_candidates', { groupIndex: 11, measure: true })).result as SupportCandidatesResult,
        );
        const candidates = arr(pool.candidates);
        expect(candidates.length).toBeGreaterThan(20);
        expect(out).toContain(`Candidate pool: ${candidates.length} support gems`);

        // The ranking: the first 3 by delta descending, ties by name (a null delta last).
        const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
        const expectedTop = [...candidates]
          .sort((a, b) => {
            const da = typeof a.delta === 'number' ? a.delta : -Infinity;
            const db = typeof b.delta === 'number' ? b.delta : -Infinity;
            return da !== db ? db - da : byName(a.name, b.name);
          })
          .slice(0, 3)
          .map((c) => c.name);
        const listed = [...out.matchAll(/^\d+\. \*\*(.+?)\*\* — /gm)].map((m) => m[1]);
        expect(listed).toEqual(expectedTop);

        // The expected can't-measure set: null measurements, plus possibly unmodelled gems.
        const nullMeasured = candidates.filter((c) => typeof c.delta !== 'number' || typeof c.value !== 'number').map((c) => c.name);
        const unmodelled: string[] = [];
        const unmodelledLines = new Map<string, string[]>();
        for (const name of [...new Set(candidates.map((c) => c.name))]) {
          const lines = (await coverageLines({ gems: [name] })).filter((l) => l.startsWith(`[${UNMODELLED}] `));
          if (lines.length > 0) {
            unmodelled.push(name);
            unmodelledLines.set(name, lines.map((l) => l.slice(UNMODELLED.length + 3)));
          }
        }
        // ~48.5% of supports have such a line (R-22), so the pool has some.
        expect(unmodelled.length).toBeGreaterThan(0);
        const expected = [...new Set([...nullMeasured, ...unmodelled])].sort();

        const cant = section(out, CANT_MEASURE);
        expect(cant).not.toBeNull();
        const named = [...cant!.matchAll(/^- \*\*(.+?)\*\*: (.*)$/gm)].map((m) => ({ name: m[1], reasons: m[2] }));
        expect(named.map((n) => n.name).sort()).toEqual(expected);
        expect(new Set(named.map((n) => n.name)).size).toBe(named.length);
        // Each entry gives its reasons: the error of a failed measurement, the unmodelled lines.
        for (const n of named) {
          if (nullMeasured.includes(n.name)) expect(n.reasons).toContain('could not be measured');
          for (const line of unmodelledLines.get(n.name) ?? []) expect(n.reasons).toContain(`"${line}"`);
        }
        // The ranking comes first, the section after it.
        expect(out.indexOf(CANT_MEASURE)).toBeGreaterThan(out.indexOf(`3. **${expectedTop[2]}**`));
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K21: get_passive_upgrades {focus:"both", max_results:3} lists in its can\'t-measure section exactly the measured pool\'s candidates (D-417: every node within 6 points) with a line check_model_coverage doesn\'t rate fully parsed or a null measurement; no output id is an ascendancy node; the output stays within 5000 chars',
      async () => {
        const out = await okTool('get_passive_upgrades', { focus: 'both', max_results: 3 });

        // The measured pool, rebuilt as node power's pass takes it (D-417).
        const pool = await mainPool();
        expect(pool.length).toBeGreaterThan(100);
        const measuredLine = /^Measured (\d+) nearby passives/m.exec(out);
        expect(measuredLine).not.toBeNull();
        expect(Number(measuredLine![1])).toBe(pool.length);

        // Null measurements (PoB's calculator over each path gives no DPS or no EHP number), and the lines
        // check_model_coverage doesn't rate fully parsed.
        const nullIds = await nullMeasured(pool, 'both');
        const notFull = await notFullyParsed(pool);

        const expected = pool.filter((c) => notFull.has(c.id) || nullIds.has(c.id)).map((c) => c.id).sort((a, b) => a - b);
        const cant = section(out, CANT_MEASURE);
        expect(cant).not.toBeNull();
        const entries = passiveEntries(cant!);
        expect(entries.map((e) => e.id).sort((a, b) => a - b)).toEqual(expected);
        expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
        // Each entry has such a line (shown with its status, under its kind) or a null measurement.
        for (const e of entries) {
          const lines = notFull.get(e.id) ?? [];
          expect(lines.length > 0 || nullIds.has(e.id)).toBe(true);
          for (const line of lines) expect(e.line).toContain(line);
          expectKinds(e, lines);
          if (nullIds.has(e.id)) expect(e.line).toContain('no value');
        }
        // D-243: a possibly unread line is advisory, never "not applied". On the golden build Battle-hardened's
        // "+5 to Strength and Dexterity" is one: PoB applies Str and Dex, it only never reads the StrDex name.
        const hardened = entries.find((e) => e.name === 'Battle-hardened');
        expect(hardened?.line).toContain('advisory: [possibly unread] +5 to Strength and Dexterity');
        expect(hardened?.line).not.toContain('not applied');
        expect(cant).toContain('the measured change may already include it');

        // D-77 kept: no id in the output is an ascendancy node.
        const facts = await nodeFacts(idsIn(out));
        for (const [id, fact] of Object.entries(facts)) expect([id, fact.asc]).toEqual([id, false]);
        expect(out).not.toContain(ASCENDANCY_SECTION);

        // The whole default output stays within C-1's 5000 chars: no truncation notice.
        expect(out.length).toBeLessThanOrEqual(5000);
        expect(out).not.toContain('[Response truncated');
        const defaults = await okTool('get_passive_upgrades', {});
        expect(defaults.length).toBeLessThanOrEqual(5000);
        expect(defaults).not.toContain('[Response truncated');
        expect(defaults).toContain(CANT_MEASURE);
        // D-417: the pool is every node within 6 points, so its can't-measure section is longer; the default output
        // gives up the ranked entries' stat lines at most, never a ranked entry.
        expect(defaults).not.toMatch(/passive-point ranks/);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'C-47 null measurements: a candidate whose calculation fails in PoB (a Lua hook on calcs.initEnv) is not ranked, and each ranker lists it in its can\'t-measure section with the error; the call still succeeds',
      async () => {
        const hook = (condition: string) =>
          luaQuery(`
            local calcs = build.calcsTab.calcs
            _G.__wu34_initEnv = _G.__wu34_initEnv or calcs.initEnv
            calcs.initEnv = function(b, mode, override, ...)
              if mode == 'CALCULATOR' and (${condition}) then error('wu34 forced failure') end
              return _G.__wu34_initEnv(b, mode, override, ...)
            end
            return true`);
        const unhook = () => luaQuery('build.calcsTab.calcs.initEnv = _G.__wu34_initEnv or build.calcsTab.calcs.initEnv; return true');

        // get_passive_upgrades: the top-ranked notable's path fails to calculate.
        const before = await okTool('get_passive_upgrades', { focus: 'both', max_results: 3 });
        const top = rankedEntries(ranking(before))[0];
        expect(top).toBeDefined();
        let passives: string;
        try {
          await hook(`override and override.addNodes and override.addNodes[build.spec.nodes[${top.id}]]`);
          passives = await okTool('get_passive_upgrades', { focus: 'both', max_results: 3 });
        } finally {
          await unhook();
        }
        expect(rankedEntries(ranking(passives)).map((e) => e.id)).not.toContain(top.id);
        const failed = passiveEntries(section(passives, CANT_MEASURE) ?? '').find((e) => e.id === top.id);
        expect(failed?.line).toContain("no value: PoB's calculator failed:");
        expect(failed?.line).toContain('wu34 forced failure');

        // suggest_supports: the best candidate fails to calculate on group 11.
        const supportsBefore = await okTool('suggest_supports', { group_index: 11, count: 3 });
        const best = /^1\. \*\*(.+?)\*\* — /m.exec(supportsBefore)![1];
        const length = await luaQuery<number>('return #build.skillsTab.socketGroupList[11].gemList');
        let supports: string;
        try {
          await hook(`#b.skillsTab.socketGroupList[11].gemList > ${length} and b.skillsTab.socketGroupList[11].gemList[${length + 1}].gemData.name == '${best.replace(/'/g, "\\'")}'`);
          supports = await okTool('suggest_supports', { group_index: 11, count: 3 });
        } finally {
          await unhook();
        }
        expect([...supports.matchAll(/^\d+\. \*\*(.+?)\*\* — /gm)].map((m) => m[1])).not.toContain(best);
        const entry = [...(section(supports, CANT_MEASURE) ?? '').matchAll(/^- \*\*(.+?)\*\*: (.*)$/gm)].find((m) => m[1] === best);
        expect(entry?.[2]).toContain('could not be measured');
        expect(entry?.[2]).toContain('wu34 forced failure');
      },
      ENGINE_TIMEOUT,
    );

    it(
      'C-47 / D-227 on the golden build: include_ascendancy counts the ascendancy points used as PoB does (CountAllocNodes skips the start node and the chosen option of a multiple-choice notable), ranks only unallocated Gemling Legionnaire notables at their pathDist, and marks exactly those needing more than the points left; the main ranking is unchanged',
      async () => {
        const pob = await luaQuery<{ asc: string; used: number; option: boolean }>(`
          local _, ascUsed = build.spec:CountAllocNodes()
          local option = false
          for _, node in pairs(build.spec.allocNodes) do
            if node.ascendancyName and node.isMultipleChoiceOption then option = true end
          end
          return { asc = build.spec.curAscendClassName, used = ascUsed, option = option }`);
        expect(pob.asc).toBe('Gemling Legionnaire');
        // The golden build has an implant option allocated, which costs no point.
        expect(pob.option).toBe(true);
        const left = 8 - pob.used;

        const plain = await okTool('get_passive_upgrades', { focus: 'dps' });
        const out = await okTool('get_passive_upgrades', { focus: 'dps', include_ascendancy: true });
        expect(out).toContain(`Gemling Legionnaire: ${pob.used} of 8 ascendancy points used, ${left} left.`);
        // The passive-point ranking is the same with and without the option: the longer text may show fewer of its
        // entries (D-246 drops ranks from the bottom, and says so), never others or in another order.
        const ids = (text: string) => rankedEntries(ranking(text)).map((e) => [e.id, e.cost]);
        const shown = ids(out);
        expect(shown.length).toBeGreaterThan(0);
        expect(shown).toEqual(ids(plain).slice(0, shown.length));
        if (shown.length < ids(plain).length) expect(out).toMatch(new RegExp(`passive-point ranks ${shown.length + 1}-${ids(plain).length}`));

        const asc = section(out, ASCENDANCY_SECTION);
        expect(asc).not.toBeNull();
        const ranked = rankedEntries(asc!);
        expect(ranked.length).toBeGreaterThanOrEqual(1);
        const cant = passiveEntries(section(out, CANT_MEASURE) ?? '');
        const facts = await nodeFacts([...ranked.map((r) => r.id), ...cant.map((c) => c.id)]);
        for (const r of ranked) {
          const fact = facts[String(r.id)];
          expect({ id: r.id, asc: fact.asc, alloc: fact.alloc, cost: r.cost }).toEqual({
            id: r.id,
            asc: 'Gemling Legionnaire',
            alloc: false,
            cost: fact.dist,
          });
        }
        const marked = [...ranked, ...cant].filter((e) => facts[String(e.id)].asc === 'Gemling Legionnaire');
        expect(marked.some((e) => (facts[String(e.id)].dist as number) > left)).toBe(true);
        for (const e of marked) {
          const dist = facts[String(e.id)].dist as number;
          expect({ id: e.id, marked: e.line.endsWith(` (over budget: needs ${dist}, ${left} left)`) }).toEqual({ id: e.id, marked: dist > left });
        }
      },
      ENGINE_TIMEOUT,
    );

    it.each([{ include_ascendancy: true }, { include_ascendancy: true, max_results: 20 }])(
      'D-246: get_passive_upgrades %j keeps within 5000 chars with no truncation notice, and its can\'t-measure section lists exactly the main and ascendancy pools\' candidates with a line not fully parsed, a null measurement, or (D-247) no stat lines of their own',
      async (args) => {
        const out = await okTool('get_passive_upgrades', args);
        expect(out.length).toBeLessThanOrEqual(5000);
        expect(out).not.toContain('[Response truncated');

        // Both pools, derived independently: the main tree's (focus "both") and the build's own ascendancy's.
        const main = await mainPool();
        const ascendancy = await ascendancyPool();
        expect(ascendancy.length).toBeGreaterThanOrEqual(1);
        const pool = [...main, ...ascendancy];
        const nullIds = await nullMeasured(pool, 'both');
        const notFull = await notFullyParsed(pool);
        const expected = pool
          .filter((c) => notFull.has(c.id) || nullIds.has(c.id) || (c.ascendancy && c.lines === 0))
          .map((c) => c.id)
          .sort((a, b) => a - b);
        expect(expected.some((id) => ascendancy.some((c) => c.id === id))).toBe(true);

        const cant = section(out, CANT_MEASURE);
        expect(cant).not.toBeNull();
        const entries = passiveEntries(cant!);
        expect(entries.map((e) => e.id).sort((a, b) => a - b)).toEqual(expected);
        for (const e of entries) {
          const lines = notFull.get(e.id) ?? [];
          for (const line of lines) expect(e.line).toContain(line);
          expectKinds(e, lines);
        }

        // When the text had to be shortened, one line says what was left out, and the ranked entries
        // left are each ranking's first ones, in order.
        const note = /^Shortened to stay within 5000 characters; left out: (.*)\.$/m.exec(out);
        if (note) expect(out).not.toMatch(/^ {3}- /m);
        for (const part of [ranking(out), section(out, ASCENDANCY_SECTION) ?? '']) {
          const ranks = [...part.matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]));
          expect(ranks).toEqual(ranks.map((_, i) => i + 1));
        }
      },
      ENGINE_TIMEOUT,
    );

    it(
      'D-246 with a session notice (the router\'s refit, D-53): after an on-disk reload of a build with a long path, the "Reloaded" notice plus the text stay within 5000 chars, nothing is truncated, and the can\'t-measure section is complete',
      async () => {
        // A long relative path makes the session's notice long (it names the file), so the text must
        // give up room to it: 3 folders and a file name of 150 characters each.
        const rel = [1, 2, 3].map((n) => `${String(n).repeat(150)}`).join('/') + `/${'g'.repeat(146)}.xml`;
        const file = path.join(f.builds, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, GOLDEN_XML, 'utf8');
        try {
          await okTool('lua_load_build', { build_name: rel });
          const args = { include_ascendancy: true, max_results: 20 };
          const plain = await okTool('get_passive_upgrades', args);
          expect(plain.startsWith('=== Passive Upgrades')).toBe(true); // no notice

          // The same bytes plus a newline: the session reloads the file and puts its notice first.
          writeBuild(file, `${GOLDEN_XML}\n`);
          const out = await okTool('get_passive_upgrades', args);
          expect(out.startsWith(`Reloaded ${rel}: it changed on disk`)).toBe(true);
          const head = out.slice(0, out.indexOf('\n\n') + 2);
          // Without the room reserved, the plain text and the notice would pass C-1's limit.
          expect(plain.length + head.length).toBeGreaterThan(5000);
          expect(out.length).toBeLessThanOrEqual(5000);
          expect(out).not.toContain('[Response truncated');
          expect(out).toMatch(/^Shortened to stay within 5000 characters; left out: .*the closing tip/m);

          // The can't-measure section is whole: the same entries, line for line, as without the notice.
          const entries = (text: string) => passiveEntries(section(text, CANT_MEASURE) ?? '').map((e) => e.line);
          expect(entries(out)).toEqual(entries(plain));
          const main = await mainPool();
          const ascendancy = await ascendancyPool();
          const pool = [...main, ...ascendancy];
          const nullIds = await nullMeasured(pool, 'both');
          const notFull = await notFullyParsed(pool);
          const expected = pool
            .filter((c) => notFull.has(c.id) || nullIds.has(c.id) || (c.ascendancy && c.lines === 0))
            .map((c) => c.id)
            .sort((a, b) => a - b);
          expect(passiveEntries(section(out, CANT_MEASURE) ?? '').map((e) => e.id).sort((a, b) => a - b)).toEqual(expected);
        } finally {
          await okTool('lua_load_build', { build_name: 'grenadator.xml' });
          fs.rmSync(path.join(f.builds, '1'.repeat(150)), { recursive: true, force: true });
        }
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('on a new Mercenary / Gemling Legionnaire build', () => {
    it(
      'D-247: an unallocated multiple-choice ascendancy notable (Implanted Gems, no stat lines of its own) is in the can\'t-measure section as "its effect is the option chosen", naming the option nodes PoB links to it',
      async () => {
        await okTool('lua_new_build', { class_name: 'Mercenary', ascendancy: 'Gemling Legionnaire' });
        const choices = await luaQuery<Array<{ id: number; name: string; lines: number; options: Array<{ id: number; name: string }> }>>(`
          local out = {}
          local asc = build.spec.curAscendClassName
          for id, node in pairs(build.spec.nodes) do
            if node.ascendancyName == asc and node.isNotable and node.isMultipleChoice and not build.spec.allocNodes[id] then
              local options = {}
              for _, other in ipairs(node.linked or {}) do
                if other.isMultipleChoiceOption then options[#options + 1] = { id = other.id, name = other.name } end
              end
              out[#out + 1] = { id = id, name = node.name, lines = #(node.sd or {}), options = options }
            end
          end
          return out`);
        const implanted = arr(choices).find((c) => c.name === 'Implanted Gems');
        expect(implanted).toBeDefined();
        expect(implanted!.lines).toBe(0);
        const options = arr(implanted!.options).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        expect(options.length).toBe(3);

        const out = await okTool('get_passive_upgrades', { focus: 'defence', include_ascendancy: true });
        const entry = passiveEntries(section(out, CANT_MEASURE) ?? '').find((e) => e.id === implanted!.id);
        expect(entry).toBeDefined();
        expect(entry!.line).toContain(
          `choice: its effect is the option chosen; options: ${options.map((o) => `${o.name} [${o.id}]`).join(', ')}`,
        );
        // It is not in the ascendancy ranking: PoB measures it as nothing.
        expect(rankedEntries(section(out, ASCENDANCY_SECTION) ?? '').map((e) => e.id)).not.toContain(implanted!.id);
        // No option node is offered as a notable of its own.
        for (const o of options) expect(idsIn(ranking(out) + (section(out, ASCENDANCY_SECTION) ?? ''))).not.toContain(o.id);
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('on a new Warrior / Titan build', () => {
    it(
      'AC-K22: {focus:"defence", include_ascendancy:true} ranks only unallocated Titan notables under "Ascendancy notables", each priced at its pathDist; no other ascendancy\'s node appears and the passive-point ranking holds none; Crushing Impacts is in the can\'t-measure section; without include_ascendancy no Titan node appears',
      async () => {
        await newTitan();
        const notables = await titanNotables();
        expect(Object.keys(notables)).toHaveLength(8);

        const out = await okTool('get_passive_upgrades', { focus: 'defence', include_ascendancy: true });
        const asc = section(out, ASCENDANCY_SECTION);
        expect(asc).not.toBeNull();
        const ranked = rankedEntries(asc!);
        expect(ranked.length).toBeGreaterThanOrEqual(1);
        const facts = await nodeFacts(idsIn(out));
        for (const r of ranked) {
          expect({ id: r.id, asc: facts[String(r.id)].asc, alloc: facts[String(r.id)].alloc }).toEqual({ id: r.id, asc: 'Titan', alloc: false });
          expect({ id: r.id, cost: r.cost }).toEqual({ id: r.id, cost: facts[String(r.id)].dist });
          expect(r.unit).toMatch(/^ascendancy points?$/);
        }

        // No other ascendancy's node anywhere; none in the passive-point ranking.
        for (const [id, fact] of Object.entries(facts)) expect([id, [false, 'Titan'].includes(fact.asc)]).toEqual([id, true]);
        const mainIds = idsIn(ranking(out));
        for (const id of mainIds) expect([id, facts[String(id)].asc]).toEqual([id, false]);

        // Crushing Impacts ("Your Hits are Crushing Blows" gives no mod list) is in the can't-measure section.
        const cant = section(out, CANT_MEASURE);
        expect(cant).not.toBeNull();
        expect(passiveEntries(cant!).map((e) => e.id)).toContain(notables['Crushing Impacts']);

        // Without include_ascendancy, no Titan node appears.
        const plain = await okTool('get_passive_upgrades', { focus: 'defence' });
        expect(plain).not.toContain(ASCENDANCY_SECTION);
        const plainFacts = await nodeFacts(idsIn(plain));
        for (const [id, fact] of Object.entries(plainFacts)) expect([id, fact.asc]).toEqual([id, false]);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K44: with Stone Skin, Mysterious Lineage and Colossal Capacity allocated (6 points, r = 2), every Titan notable in the output ends with " (over budget: needs <pathDist>, 2 left)" exactly when its pathDist exceeds 2; Mountain Splitter is in the can\'t-measure section with the mark, Crushing Impacts without it',
      async () => {
        await newTitan();
        const notables = await titanNotables();
        const picked = ['Stone Skin', 'Mysterious Lineage', 'Colossal Capacity'].map((n) => notables[n]);
        const paths = await luaQuery<Record<string, number[]>>(`
          local out = {}
          for _, id in ipairs({ ${picked.join(', ')} }) do
            local ids = {}
            for _, n in ipairs(build.spec.nodes[id].path) do ids[#ids + 1] = n.id end
            out[tostring(id)] = ids
          end
          return out`);
        for (const id of picked) expect([id, arr(paths[String(id)]).length]).toEqual([id, 2]);

        const tree = await run('read', (client) => client.getTree());
        const nodes = [...new Set([...arr(tree.nodes), ...picked.flatMap((id) => arr(paths[String(id)]))])];
        await okTool('lua_set_tree', { nodes: nodes.map(String) });
        const used = await luaQuery<{ nodes: number; pob: number }>(`
          local n = 0
          for id, node in pairs(build.spec.allocNodes) do
            if node.ascendancyName and node.type ~= 'AscendClassStart' then n = n + 1 end
          end
          local _, ascUsed = build.spec:CountAllocNodes()
          return { nodes = n, pob = ascUsed }`);
        expect(used).toEqual({ nodes: 6, pob: 6 });

        const out = await okTool('get_passive_upgrades', { focus: 'defence', include_ascendancy: true });
        expect(out).toContain('Titan: 6 of 8 ascendancy points used, 2 left.');

        // Every line naming a Titan notable: ranked headings and can't-measure entries.
        const named = [
          ...rankedEntries(section(out, ASCENDANCY_SECTION) ?? '').map((e) => ({ id: e.id, line: e.line })),
          ...passiveEntries(section(out, CANT_MEASURE) ?? '').map((e) => ({ id: e.id, line: e.line })),
        ];
        const facts = await nodeFacts(named.map((n) => n.id));
        const titan = named.filter((n) => facts[String(n.id)].asc === 'Titan');
        expect(titan.length).toBeGreaterThanOrEqual(2);
        for (const n of titan) {
          const dist = facts[String(n.id)].dist as number;
          expect(typeof dist).toBe('number');
          const mark = ` (over budget: needs ${dist}, 2 left)`;
          expect({ id: n.id, dist, marked: n.line.endsWith(mark) }).toEqual({ id: n.id, dist, marked: dist > 2 });
          if (dist <= 2) expect(n.line).not.toContain('over budget');
        }

        // Not hidden: Mountain Splitter (pathDist 4, its line unparsed) is listed with the mark; Crushing
        // Impacts (pathDist 2) without it.
        const cant = passiveEntries(section(out, CANT_MEASURE) ?? '');
        const splitter = cant.find((e) => e.id === notables['Mountain Splitter']);
        const crushing = cant.find((e) => e.id === notables['Crushing Impacts']);
        expect(facts[String(notables['Mountain Splitter'])]?.dist).toBe(4);
        expect(splitter?.line.endsWith(' (over budget: needs 4, 2 left)')).toBe(true);
        expect(facts[String(notables['Crushing Impacts'])]?.dist).toBe(2);
        expect(crushing).toBeDefined();
        expect(crushing!.line).not.toContain('over budget');
      },
      ENGINE_TIMEOUT,
    );
  });
});
