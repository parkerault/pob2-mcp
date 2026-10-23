/**
 * K1 (WU-31, C-37): `lookup_game_data`, in process and engine-required, on the golden build.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handler, session, bridge
 * and luajit). Every expected value comes from PoB itself, never from the tool's earlier output:
 * - Lua queries (`__test_eval`, test actions on, through `session.run`) recompute what PoB's gem tooltip
 *   shows: `data.describeStats(calcLib.buildSkillInstanceStats({level, quality}, ge, statSet), scope)` per
 *   stat set, the `qualityStats` lines at value × 20, `SkillTypeName` of the support rules, and the
 *   per-level `levelRequirement` and `calcLib.getGemStatRequirement` values;
 * - the unique text is `main.uniqueDB.list[…]:BuildRaw()`;
 * - the order and bounds compare the tool's text with the Lua action's full list (`maxResults:10000`),
 *   read through `session.run`.
 *
 * AC-K1…AC-K5 and AC-K45 run here, with the coordinator's amendments to C-37: unique lines from every
 * non-legacy variant, the per-gem gem_level fallback, compact uniques (D-239), the mechanic `kind` filter
 * and per-kind totals (D-240) and the stat sets' base attack damage and crit chance (D-241). AC-K6 (the
 * read kind) is the generic engine-kind check over the `lookup_game_data` samples in
 * `engineKinds.test.ts`; the static part below checks those samples exist.
 *
 * D-258 (amends C-37, WU-47): gem blocks show PoB's `Tier` (a Lua query of `data.gems`), and a query that
 * matches nothing lists the 5 closest names of the kind searched. The expected names are recomputed here
 * from PoB's own name lists (Lua queries of `data.gems`, `main.uniqueDB`, the build's tree,
 * `data.itemMods` and `data.essences`) with this file's own edit distance (`osa`), never from the tool's
 * output.
 *
 * AC-K51 (WU-60, D-277): a mechanic mod hit is followed by the base types that can roll it. The expected
 * base types come from PoB's own items: every base of `data.itemBaseLists` made into a real item, asked
 * `item:GetModSpawnWeight(mod)`, within the item's own affix table (`item.affixes`) for a crafting mod.
 * Essence hits (kind `essence`) are recomputed from `data.essences` and the mods they name.
 *
 * AC-K58…AC-K65 (WU-53, D-299): amendment 3's lookup additions. The expected values are recomputed with
 * PoB's own engine and data: "usable by", a support's reach and the unlocks build the skill with
 * `calcs.createActiveSkill` and a real support list, as PoB's CalcSetup does, after PoB's one support per
 * gem family; `altQualityStats` through the describer for the Gemling lines; the granted effects, minion
 * lists and hit flags for the children; `data.itemBaseLists` for the base implicits.
 *
 * AC-K71 (WU-77, D-379): gem mode finds a minion skill by name, after the gems. The expected lines are
 * recomputed from PoB's data: the gems whose active effects' minions list the skill, `is_commandable_skill`
 * in a stat set, the tree's "Grants Skill: <name>" lines, and the described stat sets.
 *
 * D-384: every expected gem set is recomputed without the gems PoB marks legacy, which the lookups leave out
 * (`LIVE_GEMS`); the legacy and unobtainable cases themselves are in `ruleBreaks.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { TOOL_META } from '../../src/server/toolMeta';
import type { LookupGameDataResult, LookupGem, LookupHit, LookupMinionSkill } from '../../src/engine/schemas';
import { renderHit } from '../../src/handlers/lookupHandlers';

/**
 * D-258's similarity measure, recomputed: the optimal string alignment distance (insertions, deletions,
 * substitutions and swaps of two adjacent characters, each costing 1) over code points, with ASCII letters
 * lowercased.
 */
function osa(x: string, y: string): number {
  const chars = (s: string) => [...s.replace(/[A-Z]/g, (c) => c.toLowerCase())];
  const a = chars(x);
  const b = chars(y);
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** A candidate name of D-258's ranking: its name, kind and detail (a unique's type, a passive's ascendancy, a mod's table). */
interface Candidate {
  name: string;
  kind: string;
  detail?: string;
}

/** Byte order, as Lua compares strings. */
const byteCmp = (a: string, b: string) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

/** The `n` (default 5) closest candidates (one per name, kind and detail): by distance, then name, kind and detail. */
function closest(query: string, list: Candidate[], n = 5): Array<Candidate & { distance: number }> {
  const seen = new Set<string>();
  const unique = list.filter((c) => {
    const key = `${c.name}\0${c.kind}\0${c.detail ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique
    .map((c) => ({ ...c, distance: osa(query, c.name) }))
    .sort((a, b) => a.distance - b.distance || byteCmp(a.name, b.name) || byteCmp(a.kind, b.kind) || byteCmp(a.detail ?? '', b.detail ?? ''))
    .slice(0, n);
}

/** Each "Closest … names (…):" header of the tool's text, with the `- <name> (<label>)` lines under it. */
function suggestionGroups(text: string): Array<{ header: string; lines: string[] }> {
  const groups: Array<{ header: string; lines: string[] }> = [];
  let current: { header: string; lines: string[] } | null = null;
  for (const line of text.split('\n')) {
    if (/^Closest .+ \(fewest edits from the query, then by name\):$/.test(line)) {
      current = { header: line, lines: [] };
      groups.push(current);
    } else if (current && line.startsWith('- ')) {
      current.lines.push(line);
    } else {
      current = null;
    }
  }
  return groups;
}

/** Every closest-name line of the tool's text, in order. */
const suggestionLines = (text: string): string[] => suggestionGroups(text).flatMap((g) => g.lines);

const ENGINE_TIMEOUT = 240_000;
const FIXTURES = path.resolve(__dirname, '..', 'fixtures');

interface StatSet {
  label: string;
  /** The base attack damage and crit chance lines (D-241). */
  base: string[];
  lines: string[];
}

/** One `## <name>` gem block of the tool's text, parsed. */
interface GemBlock {
  name: string;
  /** `Tier: <n>` (D-258). */
  tier?: number;
  weapon?: string;
  description?: string;
  /** `Stat sets at gem level <n>, quality <q>%:` */
  shownLevel?: number;
  note?: string;
  statSets: StatSet[];
  quality: string[];
  supports?: string[];
  cannotSupport?: string[];
  requiresLevel?: { span: string; values: number[] };
  attributes: Record<string, number[]>;
}

/** The `## ` blocks of a gem or unique result, after the header lines. */
function blocks(text: string): string[] {
  return text.split(/^## /m).slice(1).map((b) => `## ${b}`.trimEnd());
}

const listOf = (s: string): string[] => (s.startsWith('(') ? [] : s.split(', '));
const numbersOf = (s: string): number[] => s.split(', ').map(Number);

function parseGem(block: string): GemBlock {
  const lines = block.split('\n');
  const gem: GemBlock = { name: lines[0].replace(/^## /, ''), statSets: [], quality: [], attributes: {} };
  let target: string[] | null = null;
  let baseTarget: string[] | null = null;
  let inMain = true;
  for (const line of lines.slice(1)) {
    let m: RegExpExecArray | null;
    if (line.startsWith('  - ')) {
      if (target) target.push(line.slice(4));
    } else if (line.startsWith('  ') && line !== '  (no described stats)' && line !== '  (no quality effects)') {
      if (baseTarget) baseTarget.push(line.slice(2));
    } else if ((m = /^Stat sets at gem level (\d+), quality \d+%:$/.exec(line))) {
      gem.shownLevel = Number(m[1]);
    } else if ((m = /^Note: (.*)$/.exec(line))) {
      gem.note = m[1];
    } else if ((m = /^Stat set \d+: (.*)$/.exec(line))) {
      if (inMain) {
        const set = { label: m[1], base: [] as string[], lines: [] as string[] };
        gem.statSets.push(set);
        target = set.lines;
        baseTarget = set.base;
      } else {
        target = null;
        baseTarget = null;
      }
    } else if (line.startsWith('Also grants: ')) {
      inMain = false;
      target = null;
      baseTarget = null;
    } else if (line === 'At +20% Quality:') {
      inMain = false;
      target = gem.quality;
      baseTarget = null;
    } else if ((m = /^Tier: (\d+)$/.exec(line))) {
      gem.tier = Number(m[1]);
      target = null;
      baseTarget = null;
    } else if ((m = /^Weapon: (.*)$/.exec(line))) {
      gem.weapon = m[1];
    } else if ((m = /^Description: (.*)$/.exec(line))) {
      gem.description = m[1];
    } else if ((m = /^Supports: (.*)$/.exec(line))) {
      gem.supports = listOf(m[1]);
    } else if ((m = /^Can't support: (.*)$/.exec(line))) {
      gem.cannotSupport = listOf(m[1]);
    } else if ((m = /^Requires level \((gem levels 1–\d+)\): (.*)$/.exec(line))) {
      gem.requiresLevel = { span: m[1], values: numbersOf(m[2]) };
    } else if ((m = /^(Str|Dex|Int) \((gem levels 1–\d+)\): (.*)$/.exec(line))) {
      gem.attributes[m[1]] = numbersOf(m[3]);
    } else {
      target = null;
      baseTarget = null;
    }
  }
  return gem;
}

interface UniqueBlock {
  name: string;
  type: string;
  base?: string;
  /** The `Matched:` lines, as printed (a line from another variant ends with its variants). */
  matched: string[];
  selected?: string;
  /** The fenced item text: only when exactly one unique is returned (D-239). */
  raw?: string;
}

/** A unique block: `## <name> (<type>)`, `Base:`, `Matched:` lines, and the fenced text when it is the one. */
function parseUnique(block: string): UniqueBlock {
  const head = /^## (.*) \(([^()]*)\)$/.exec(block.split('\n')[0]);
  if (!head) throw new Error(`not a unique block: ${block.slice(0, 200)}`);
  const fence = block.indexOf('\n```\n');
  const body = fence >= 0 ? block.slice(0, fence) : block;
  const out: UniqueBlock = { name: head[1], type: head[2], matched: [] };
  for (const line of body.split('\n').slice(1)) {
    if (line.startsWith('Base: ')) out.base = line.slice(6);
    else if (line.startsWith('Matched: ')) out.matched.push(line.slice(9));
    else if (line.startsWith('Selected variant: ')) out.selected = line.slice(18);
  }
  if (fence >= 0) {
    const m = /\n```\n([\s\S]*)\n```$/.exec(block);
    if (!m) throw new Error(`unterminated item text: ${block.slice(0, 200)}`);
    out.raw = m[1];
  }
  return out;
}

/** The mechanic hit lines of the tool's text. */
const hitLines = (text: string): string[] => text.split('\n').filter((l) => /^\[[a-z]+\] /.test(l));

describe('AC-K6: lookup_game_data is a read tool with an ok sample per mode (static)', () => {
  it('AC-K6: TOOL_META says read/core, and tool-calls.json has an expect:"ok" sample for gem, unique and mechanic', () => {
    expect(TOOL_META.lookup_game_data).toEqual({ engine: 'read', group: 'core' });
    const samples = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Array<{
      tool: string;
      args: Record<string, unknown>;
      expect: string;
      stateChange?: boolean;
    }>;
    const modes = samples
      .filter((s) => s.tool === 'lookup_game_data' && s.expect === 'ok')
      .map((s) => {
        expect(s.stateChange).toBeUndefined();
        return s.args.mode;
      });
    expect([...new Set(modes)].sort()).toEqual(['gem', 'mechanic', 'unique']);
  });
});

describe('AC-K63: the build-guide skill lists the seven named phrase searches (static)', () => {
  it('AC-K63: lookups.md names each named search as a query, in backticks', () => {
    const file = path.resolve(__dirname, '..', '..', '.claude', 'skills', 'build-guide', 'references', 'lookups.md');
    const text = fs.readFileSync(file, 'utf8');
    for (const query of [
      'also apply to',
      'while already at maximum',
      'per 100 maximum',
      'for each type of',
      'cannot … but',
      'instead of you',
      'your … shatter',
    ]) {
      expect({ query, listed: text.includes(`\`${query}\``) }).toEqual({ query, listed: true });
    }
  });
});

/**
 * D-384: the gems the lookups search, for the queries below: PoB's gems without the ones PoB marks legacy
 * (their granted effect's `legacy`), which every mode leaves out.
 */
const LIVE_GEMS = `
local function liveGems()
  local out = {}
  for id, g in pairs(data.gems) do
    if not (type(g) == 'table' and type(g.grantedEffect) == 'table' and g.grantedEffect.legacy) then out[id] = g end
  end
  return out
end
`;

engineDescribe('K1: lookup_game_data on the golden build (WU-31, C-37)', () => {
  let f: SessionFixture;

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:lookup-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code: LIVE_GEMS + code });
      return reply.result as T;
    });
    return value;
  }

  /** The Lua action itself, through the bridge (C-5 validated). */
  async function lookupAction(params: Record<string, unknown>): Promise<LookupGameDataResult> {
    const { value } = await f.session.run({ tool: 'test:lookup-action', kind: 'read' }, async (ctx) => {
      return ctx.client.lookupGameData(params as never);
    });
    return value;
  }

  async function tool(args: Record<string, unknown>) {
    return f.call('lookup_game_data', args);
  }

  async function okTool(args: Record<string, unknown>): Promise<string> {
    const out = await tool(args);
    expect({ args, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ args, isError: false, text: '' });
    return out.text;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  /** PoB's tooltip data for one gem (by exact name), at a gem level and quality. */
  const gemTooltipQuery = (name: string, level: number, quality: number) => `
    local gem, gemId
    for id, g in pairs(liveGems()) do
      if g.name == ${JSON.stringify(name)} and (not gemId or id < gemId) then gem, gemId = g, id end
    end
    local ge = data.skills[gem.grantedEffectId]
    local sets = {}
    for i, ss in ipairs(ge.statSets) do
      local lines = data.describeStats(calcLib.buildSkillInstanceStats({ level = ${level}, quality = ${quality} }, ge, ss), ss.statDescriptionScope)
      sets[i] = { label = ss.label, lines = lines }
    end
    local quality = {}
    for _, q in ipairs(ge.qualityStats or {}) do
      local ss = ge.statSets[((q[3] or {})[1] or 0) + 1] or ge.statSets[1]
      for _, line in ipairs(data.describeStats({ [q[1]] = q[2] * 20 }, ss.statDescriptionScope, true)) do
        table.insert(quality, line)
      end
    end
    local levels, str, dex, int = {}, {}, {}, {}
    for l = 1, gem.naturalMaxLevel do
      local r = ge.levels[l] and ge.levels[l].levelRequirement or 1
      levels[l] = r
      str[l] = calcLib.getGemStatRequirement(r, gem.reqStr, ge.support)
      dex[l] = calcLib.getGemStatRequirement(r, gem.reqDex, ge.support)
      int[l] = calcLib.getGemStatRequirement(r, gem.reqInt, ge.support)
    end
    return {
      description = ge.description, weapon = gem.weaponRequirements, sets = sets, quality = quality,
      naturalMaxLevel = gem.naturalMaxLevel, reqStr = gem.reqStr, reqDex = gem.reqDex, reqInt = gem.reqInt,
      support = ge.support == true, levels = levels, str = str, dex = dex, int = int,
    }`;

  interface GemTooltip {
    description: string;
    weapon?: string;
    sets: Array<{ label: string; lines: string[] | Record<string, never> }>;
    quality: string[] | Record<string, never>;
    naturalMaxLevel: number;
    reqStr: number;
    reqDex: number;
    reqInt: number;
    support: boolean;
    levels: number[];
    str: number[];
    dex: number[];
    int: number[];
  }
  /** dkjson sends an empty Lua table as `{}` or `[]`. */
  const arr = <T>(v: T[] | Record<string, never>): T[] => (Array.isArray(v) ? v : []);

  it(
    'AC-K1: gem Blood Hunt (level 20, quality 0): Spear, the description, stat sets Dash then Explosion with the describer lines, and the quality lines',
    async () => {
      const text = await okTool({ mode: 'gem', query: 'Blood Hunt', gem_level: 20, gem_quality: 0 });
      const gem = parseGem(blocks(text)[0]);
      const pob = await luaQuery<GemTooltip>(gemTooltipQuery('Blood Hunt', 20, 0));

      expect(gem.name).toBe('Blood Hunt');
      expect(gem.weapon).toBe('Spear');
      expect(pob.weapon).toBe('Spear');
      expect(gem.description).toBe(pob.description);

      expect(gem.statSets.map((s) => s.label)).toEqual(['Dash', 'Explosion']);
      expect(gem.statSets.map(({ label, lines }) => ({ label, lines }))).toEqual(
        pob.sets.map((s) => ({ label: s.label, lines: arr(s.lines) })),
      );
      expect(gem.statSets[1].lines).toContain('Enemies lose Life equal to 25% of Consumed Blood Loss');

      expect(arr(pob.quality).length).toBeGreaterThan(0);
      expect(gem.quality).toEqual(arr(pob.quality));
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-K2: the first support gem by name with non-empty requireSkillTypes and excludeSkillTypes lists exactly those SkillType names under Supports: and Can't support:",
    async () => {
      const pick = await luaQuery<{ name: string; require: string[]; exclude: string[] }>(`
        local best
        for id, g in pairs(liveGems()) do
          local ge = g.grantedEffect
          if ge and ge.support and ge.requireSkillTypes and ge.requireSkillTypes[1] and ge.excludeSkillTypes and ge.excludeSkillTypes[1] then
            if not best or g.name < best.name or (g.name == best.name and id < best.id) then best = { id = id, name = g.name, ge = ge } end
          end
        end
        local req, exc = {}, {}
        for _, t in ipairs(best.ge.requireSkillTypes) do table.insert(req, SkillTypeName[t]) end
        for _, t in ipairs(best.ge.excludeSkillTypes) do table.insert(exc, SkillTypeName[t]) end
        return { name = best.name, require = req, exclude = exc }`);
      expect(pick.require.length).toBeGreaterThan(0);
      expect(pick.exclude.length).toBeGreaterThan(0);

      const text = await okTool({ mode: 'gem', query: pick.name });
      const gem = parseGem(blocks(text)[0]);
      expect(gem.name).toBe(pick.name);
      expect(gem.supports).toEqual(pick.require);
      expect(gem.cannotSupport).toEqual(pick.exclude);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K45: gem Blood Hunt lists the level requirement and the Dex requirement at gem levels 1-20, and no Str or Int line; the AC-K2 support has the level line only',
    async () => {
      const text = await okTool({ mode: 'gem', query: 'Blood Hunt' });
      const gem = parseGem(blocks(text)[0]);
      const pob = await luaQuery<GemTooltip>(gemTooltipQuery('Blood Hunt', 20, 0));
      expect(pob.naturalMaxLevel).toBe(20);
      expect(pob.reqStr).toBe(0);
      expect(pob.reqInt).toBe(0);

      expect(gem.requiresLevel?.span).toBe('gem levels 1–20');
      expect(gem.requiresLevel?.values).toEqual(pob.levels);
      expect(gem.requiresLevel?.values.slice(0, 4)).toEqual([0, 3, 6, 10]);
      expect(gem.requiresLevel?.values[19]).toBe(90);
      expect(gem.attributes.Dex).toEqual(pob.dex);
      expect(Object.keys(gem.attributes)).toEqual(['Dex']);
      // Without gem_level, the stat lines are at the gem's natural max level (20).
      expect(text).toContain('Stat sets at gem level 20, quality 0%:');

      const support = await luaQuery<{ name: string; levels: number[]; maxLevel: number }>(`
        local best
        for id, g in pairs(liveGems()) do
          local ge = g.grantedEffect
          if ge and ge.support and ge.requireSkillTypes and ge.requireSkillTypes[1] and ge.excludeSkillTypes and ge.excludeSkillTypes[1] then
            if not best or g.name < best.name or (g.name == best.name and id < best.id) then best = { id = id, name = g.name, g = g } end
          end
        end
        local levels = {}
        for l = 1, best.g.naturalMaxLevel do
          local lv = best.g.grantedEffect.levels[l]
          levels[l] = lv and lv.levelRequirement or 1
        end
        return { name = best.name, levels = levels, maxLevel = best.g.naturalMaxLevel }`);
      const supportGem = parseGem(blocks(await okTool({ mode: 'gem', query: support.name }))[0]);
      expect(supportGem.name).toBe(support.name);
      // §2.2's format, `gem levels 1–<n>`, also when n is 1.
      expect(supportGem.requiresLevel?.span).toBe(`gem levels 1–${support.maxLevel}`);
      expect(supportGem.requiresLevel?.values).toEqual(support.levels);
      expect(supportGem.attributes).toEqual({});
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-K3: unique Atziri's Acuity is one match whose text equals its uniqueDB BuildRaw() and says it causes Blood Loss; add_item puts it in Gloves",
    async () => {
      const text = await okTool({ mode: 'unique', query: "Atziri's Acuity" });
      const found = blocks(text);
      expect(found).toHaveLength(1);
      const unique = parseUnique(found[0]);
      const raw = await luaQuery<string>(`
        for _, item in pairs(main.uniqueDB.list) do
          if item.title == "Atziri's Acuity" then return item:BuildRaw() end
        end`);
      expect(unique.name).toBe("Atziri's Acuity");
      expect(unique.type).toBe('Gloves');
      expect(unique.raw).toBe(raw);
      expect(unique.raw).toContain('causes Blood Loss');

      const added = await f.call('add_item', { item_text: unique.raw, slot_name: 'Gloves' });
      expect({ isError: added.isError, text: added.isError ? added.text : '' }).toEqual({ isError: false, text: '' });
      const equipped = await f.call('get_equipped_items');
      expect(equipped.isError).toBe(false);
      expect(equipped.text).toMatch(/\*\*Gloves\*\*\n {2}Atziri's Acuity/);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K3: query "Aggravate Bleeding" includes Saitha\'s Spear and The Smiling Knight; "Blood Loss" in slot Gloves returns only Gloves; slot "Nonsense" is an error listing the types',
    async () => {
      const aggravate = blocks(await okTool({ mode: 'unique', query: 'Aggravate Bleeding' })).map(parseUnique);
      expect(aggravate.map((u) => u.name)).toEqual(expect.arrayContaining(["Saitha's Spear", 'The Smiling Knight']));

      const gloves = blocks(await okTool({ mode: 'unique', query: 'Blood Loss', slot: 'Gloves' })).map(parseUnique);
      expect(gloves.length).toBeGreaterThan(0);
      expect(new Set(gloves.map((u) => u.type))).toEqual(new Set(['Gloves']));

      const bad = await tool({ mode: 'unique', slot: 'Nonsense' });
      expect(bad.isError).toBe(true);
      const types = await luaQuery<string[]>(`
        local seen, out = {}, {}
        for _, item in pairs(main.uniqueDB.list) do
          if item.type and not seen[item.type] then seen[item.type] = true; table.insert(out, item.type) end
        end
        table.sort(out)
        return out`);
      expect(types).toEqual(expect.arrayContaining(['Gloves', 'Spear', 'Jewel']));
      expect(bad.text).toContain(types.join(', '));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'C-37 unique lines (review fix): unique "Blood Hunt" finds Prism of Belief through its non-selected Blood Hunt variant and names it; mechanic "Level of all Blood" names the variant; a line only legacy "Pre x.y" variants have is not matched',
    async () => {
      const prism = await luaQuery<{ index: number; selected: number; line: string; raw: string; type: string }>(`
        for _, item in pairs(main.uniqueDB.list) do
          if item.title == "Prism of Belief" then
            local index
            for i, name in ipairs(item.variantList) do if name == "Blood Hunt" then index = i end end
            for _, key in ipairs({ "implicitModLines", "explicitModLines" }) do
              for _, ml in ipairs(item[key]) do
                if ml.variantList and ml.variantList[index] then
                  return { index = index, selected = item.variant, line = ml.line, raw = item:BuildRaw(), type = item.type }
                end
              end
            end
          end
        end`);
      expect(prism.selected).not.toBe(prism.index);
      expect(prism.line).toContain('Blood Hunt');

      const found = blocks(await okTool({ mode: 'unique', query: 'Blood Hunt' })).map(parseUnique);
      const block = found.find((u) => u.name === 'Prism of Belief');
      expect(block).toBeDefined();
      expect(block!.type).toBe(prism.type);
      expect(block!.matched).toContain(`${prism.line} (variant ${prism.index}: Blood Hunt)`);
      if (found.length === 1) expect(block!.raw).toBe(prism.raw);

      const hits = hitLines(await okTool({ mode: 'mechanic', query: 'Level of all Blood' }));
      expect(hits).toContain(`[unique] Prism of Belief (${prism.type}; variant Blood Hunt): ${prism.line}`);

      // Atziri's Acuity keeps "Leech from Critical Hits is instant" only in its "Pre x.y" variants.
      const legacy = await luaQuery<{ names: string[]; selected: boolean }>(`
        for _, item in pairs(main.uniqueDB.list) do
          if item.title == "Atziri's Acuity" then
            for _, ml in ipairs(item.explicitModLines) do
              if ml.line == "Leech from Critical Hits is instant" then
                local names = {}
                for index in pairs(ml.variantList) do table.insert(names, item.variantList[index]) end
                table.sort(names)
                return { names = names, selected = item:CheckModLineVariant(ml) and true or false }
              end
            end
          end
        end`);
      expect(legacy.selected).toBe(false);
      expect(legacy.names.length).toBeGreaterThan(0);
      expect(legacy.names.every((n) => /^Pre \d/.test(n))).toBe(true);
      const query = 'Leech from Critical Hits is instant';
      const uniques = blocks(await okTool({ mode: 'unique', query })).map(parseUnique);
      expect(uniques.map((u) => u.name)).not.toContain("Atziri's Acuity");
      const legacyHits = hitLines(await okTool({ mode: 'mechanic', query, kind: 'unique', max_results: 30 }));
      expect(legacyHits.filter((l) => l.startsWith("[unique] Atziri's Acuity"))).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-239: several uniques are each shown in brief (name, type, base, no item text); a single returned unique carries its full BuildRaw() text',
    async () => {
      const text = await okTool({ mode: 'unique', slot: 'Jewel', max_results: 30 });
      const jewels = blocks(text).map(parseUnique);
      const pob = await luaQuery<Array<{ name: string; base: string; raw: string }>>(`
        local out = {}
        for key, item in pairs(main.uniqueDB.list) do
          if item.type == "Jewel" then table.insert(out, { id = key, name = item.title, base = item.baseName, raw = item:BuildRaw() }) end
        end
        -- By name, then by id (uniques share a name across bases, such as Grand Spectrum).
        table.sort(out, function(a, b) if a.name ~= b.name then return a.name < b.name end return a.id < b.id end)
        return out`);
      expect(jewels.length).toBe(Math.min(pob.length, 30));
      expect(jewels.length).toBeGreaterThan(1);
      expect(jewels.map((u) => ({ name: u.name, type: u.type, base: u.base, raw: u.raw }))).toEqual(
        pob.slice(0, 30).map((u) => ({ name: u.name, type: 'Jewel', base: u.base, raw: undefined })),
      );
      expect(text).not.toContain('```');
      expect(text.length).toBeLessThan(10_000);

      const one = blocks(await okTool({ mode: 'unique', slot: 'Jewel', max_results: 1 })).map(parseUnique);
      expect(one).toHaveLength(1);
      expect(one[0].name).toBe(pob[0].name);
      expect(one[0].raw).toBe(pob[0].raw);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-239 overflow: in a several-unique listing, a unique with more than 5 matching lines shows exactly its first 5 and "(and N more matching lines)", N counted from PoB\'s unique data',
    async () => {
      const query = 'resistance';
      // Every unique's mod lines (enchant, rune, implicit, explicit, class requirement) containing the query,
      // flattened to one line, by C-37's variant rule: a line of the selected variant counts; another
      // variant's line counts when one of its variants isn't a legacy "Pre x.y" one.
      const pob = await luaQuery<Array<{ id: string; name: string; type: string; lines: string[] }>>(`
        local q = ${JSON.stringify(query)}
        local function legacy(name)
          return type(name) == 'string' and (name:find('^Pre %d') ~= nil or name:find('%(Pre %d') ~= nil)
        end
        local out = {}
        for key, item in pairs(main.uniqueDB.list) do
          local lines = {}
          for _, list in ipairs({ 'enchantModLines', 'runeModLines', 'implicitModLines', 'explicitModLines', 'classRequirementModLines' }) do
            for _, ml in ipairs(item[list] or {}) do
              local line = tostring(ml.line):gsub('%s*\\n%s*', ' ')
              if line:lower():find(q, 1, true) then
                local counts = (not ml.variantList) or item:CheckModLineVariant(ml)
                if not counts then
                  for index in pairs(ml.variantList) do
                    if not legacy(item.variantList and item.variantList[index]) then counts = true end
                  end
                end
                if counts then table.insert(lines, line) end
              end
            end
          end
          if #lines > 0 then
            table.insert(out, { id = tostring(key), name = item.title or item.name or tostring(key), type = item.type, lines = lines })
          end
        end
        return out`);
      const byName = (a: { name: string; id: string }, b: { name: string; id: string }) =>
        a.name !== b.name ? (a.name < b.name ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      const matching = [...pob].sort(byName);
      // The first unique (by name) with more than 5 matching lines whose item type has other matches, so a
      // query narrowed to that type still lists several uniques in brief.
      const pick = matching.find(
        (u) => u.lines.length > 5 && matching.filter((o) => o.type === u.type).length > 1 &&
          matching.filter((o) => o.type === u.type).indexOf(u) < 30,
      );
      expect(pick).toBeDefined();

      const text = await okTool({ mode: 'unique', query, slot: pick!.type, max_results: 30 });
      const found = blocks(text);
      expect(found.length).toBe(Math.min(matching.filter((o) => o.type === pick!.type).length, 30));
      expect(found.length).toBeGreaterThan(1);
      expect(text).not.toContain('```');
      const block = found.find((b) => b.startsWith(`## ${pick!.name} (${pick!.type})`));
      expect(block).toBeDefined();
      const shown = parseUnique(block!).matched;
      expect(shown).toHaveLength(5);
      // The first 5 matching lines, in PoB's order (a line of another variant ends with its variant note).
      shown.forEach((line, i) => {
        const want = pick!.lines[i];
        expect({ i, ok: line === want || line.startsWith(`${want} (variant`) }).toEqual({ i, ok: true });
      });
      const overflow = block!.split('\n').filter((l) => /^\(and \d+ more matching lines?\)$/.test(l));
      expect(overflow).toEqual([`(and ${pick!.lines.length - 5} more matching lines)`]);
      // Uniques with 5 or fewer matching lines carry no overflow note.
      for (const b of found.filter((x) => x !== block)) {
        const name = /^## (.*) \(/.exec(b)![1];
        const u = matching.find((o) => o.name === name && o.type === pick!.type);
        if (u && u.lines.length <= 5) expect({ name, note: /more matching line/.test(b) }).toEqual({ name, note: false });
      }
    },
    ENGINE_TIMEOUT,
  );

  it(
    'C-37 gem_level (review fix): a returned gem without that level is shown at its default level with a note; it is an error only when no returned gem has it',
    async () => {
      const text = await okTool({ mode: 'gem', query: 'Blood', gem_level: 20, max_results: 30 });
      const gems = blocks(text).map(parseGem);
      const pob = await luaQuery<Record<string, { has: boolean; default: number }>>(`
        local out = {}
        for _, g in pairs(liveGems()) do
          if g.name:lower():find("blood", 1, true) then
            local ge = g.grantedEffect
            local natural = g.naturalMaxLevel or 1
            local default = natural
            if not ge.levels[natural] then
              local levels = {}
              for l in pairs(ge.levels) do table.insert(levels, l) end
              table.sort(levels)
              default = levels[1]
              for _, l in ipairs(levels) do if l <= natural then default = l end end
            end
            out[g.name] = { has = ge.levels[20] ~= nil, default = default }
          end
        end
        return out`);
      expect(gems.length).toBe(Object.keys(pob).length);
      const without = gems.filter((g) => !pob[g.name].has);
      expect(without.length).toBeGreaterThan(0);
      expect(gems.some((g) => pob[g.name].has)).toBe(true);
      for (const g of gems) {
        if (pob[g.name].has) {
          expect({ name: g.name, level: g.shownLevel, note: g.note }).toEqual({ name: g.name, level: 20, note: undefined });
        } else {
          expect({ name: g.name, level: g.shownLevel }).toEqual({ name: g.name, level: pob[g.name].default });
          expect(g.note).toMatch(/^gem_level 20 is outside this gem's levels/);
        }
      }

      const none = await tool({ mode: 'gem', query: without[0].name, gem_level: 20 });
      expect({ isError: none.isError, text: none.text }).toEqual({ isError: true, text: expect.stringContaining('gem_level 20') });
    },
    ENGINE_TIMEOUT,
  );

  it(
    "D-241: each stat set shows its base attack damage and crit chance from the level PoB's calculation reads (the granted effect's level overlaid by the stat set's), in the gem tooltip's wording",
    async () => {
      const gems = ['Blood Hunt', 'Herald of Blood', 'Ball Lightning'];
      let critLines = 0;
      for (const name of gems) {
        const gem = parseGem(blocks(await okTool({ mode: 'gem', query: name }))[0]);
        expect(gem.name).toBe(name);
        const expected = await luaQuery<Array<string[] | Record<string, never>>>(`
          local gem, gemId
          for id, g in pairs(liveGems()) do
            if g.name == ${JSON.stringify(name)} and (not gemId or id < gemId) then gem, gemId = g, id end
          end
          local ge = gem.grantedEffect
          local level = ${gem.shownLevel}
          local out = {}
          for i, ss in ipairs(ge.statSets) do
            local merged = {}
            for k, v in pairs(ge.levels[level] or {}) do merged[k] = v end
            for k, v in pairs(ss.levels and ss.levels[level] or {}) do merged[k] = v end
            local lines = {}
            if merged.baseMultiplier then table.insert(lines, string.format("Attack Damage: %g%% of base", merged.baseMultiplier * 100)) end
            if merged.critChance then table.insert(lines, string.format("Critical Hit Chance: %.2f%%", merged.critChance)) end
            out[i] = lines
          end
          return out`);
        const want = expected.map((l) => (Array.isArray(l) ? l : []));
        expect({ name, base: gem.statSets.map((st) => st.base) }).toEqual({ name, base: want });
        critLines += want.flat().filter((l) => l.startsWith('Critical Hit Chance')).length;
        if (name === 'Blood Hunt') {
          expect(gem.statSets[0]).toMatchObject({ label: 'Dash', base: ['Attack Damage: 243% of base'] });
        }
      }
      expect(critLines).toBeGreaterThan(0);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-240: mechanic kind keeps one kind of hit, and the header counts every kind; an unknown kind is an error',
    async () => {
      const query = 'Bleeding';
      const full = await lookupAction({ mode: 'mechanic', query, maxResults: 10000 });
      const all = full.results as LookupHit[];
      const count = (k: string) => all.filter((h) => h.kind === k).length;
      expect(full.total).toBe(all.length);
      expect(full.kinds).toEqual({ gem: count('gem'), unique: count('unique'), passive: count('passive'), mod: count('mod'), essence: count('essence'), base: count('base'), constant: count('constant') });
      expect(count('unique')).toBeGreaterThan(0);
      // WU-60: the essence hits are counted too; WU-53 (AC-K60): then the base hits; C-37d (WU-100): the constants, last.
      const header = `${all.length} hits: ${count('gem')} gem, ${count('unique')} unique, ${count('passive')} passive, ${count('mod')} mod, ${count('essence')} essence, ${count('base')} base, ${count('constant')} constant.`;

      const plain = await okTool({ mode: 'mechanic', query });
      expect(plain.split('\n')).toContain(header);

      const text = await okTool({ mode: 'mechanic', query, kind: 'unique', max_results: 30 });
      expect(text.split('\n')).toContain(header);
      const lines = hitLines(text);
      const uniques = all.filter((h) => h.kind === 'unique');
      expect(lines.length).toBe(Math.min(30, uniques.length));
      expect(lines).toEqual(uniques.slice(0, lines.length).map(renderHit));
      const filtered = await lookupAction({ mode: 'mechanic', query, kind: 'unique', maxResults: 10000 });
      expect(filtered.total).toBe(uniques.length);
      expect(filtered.kinds).toEqual(full.kinds);

      const bad = await tool({ mode: 'mechanic', query, kind: 'nonsense' });
      expect(bad.isError).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K4: mechanic "Crushing Blow" includes [passive] Crushing Impacts (Titan) with "Your Hits are Crushing Blows"; "Blood Loss" (30) has a Blood Hunt gem hit and an Atziri\'s Acuity unique hit; every hit is gem/unique/passive/mod and its line contains the query',
    async () => {
      const crushing = hitLines(await okTool({ mode: 'mechanic', query: 'Crushing Blow' }));
      const impacts = crushing.filter((l) => l.startsWith('[passive] Crushing Impacts'));
      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts.some((l) => l.includes('Titan') && l.endsWith(': Your Hits are Crushing Blows'))).toBe(true);

      const blood = hitLines(await okTool({ mode: 'mechanic', query: 'Blood Loss', max_results: 30 }));
      expect(blood.some((l) => l.startsWith('[gem] Blood Hunt'))).toBe(true);
      expect(blood.some((l) => l.startsWith("[unique] Atziri's Acuity"))).toBe(true);

      for (const [query, lines] of [
        ['Crushing Blow', crushing],
        ['Blood Loss', blood],
      ] as const) {
        const full = await lookupAction({ mode: 'mechanic', query, maxResults: 10000 });
        const hits = full.results as LookupHit[];
        expect(lines).toEqual(hits.slice(0, lines.length).map(renderHit));
        for (const hit of hits.slice(0, lines.length)) {
          expect(['gem', 'unique', 'passive', 'mod']).toContain(hit.kind);
          expect(hit.line.toLowerCase()).toContain(query.toLowerCase());
        }
      }
    },
    ENGINE_TIMEOUT,
  );

  /** Whether a full Lua list is in §2.2's order. */
  function expectOrdered(mode: 'gem' | 'unique' | 'mechanic', query: string, results: LookupGameDataResult['results']): void {
    // WU-60: essence hits last; WU-53 (AC-K60): base hits after them; C-37d (WU-100): constant hits after those.
    const rank: Record<string, number> = { gem: 1, unique: 2, passive: 3, mod: 4, essence: 5, base: 6, constant: 7 };
    const exact = (r: { name: string }) => r.name.toLowerCase() === query.toLowerCase();
    const idOf = (r: { kind: string; id: string }) => (r.kind === 'passive' ? Number(r.id) : r.id);
    for (let i = 1; i < results.length; i++) {
      const a = results[i - 1] as { kind: string; name: string; id: string };
      const b = results[i] as { kind: string; name: string; id: string };
      const key = (r: typeof a): Array<number | string> =>
        mode === 'mechanic' ? [rank[r.kind], r.name, idOf(r)] : [exact(r) ? 0 : 1, r.name, idOf(r)];
      const ka = key(a);
      const kb = key(b);
      let cmp = 0;
      for (let k = 0; k < ka.length && cmp === 0; k++) cmp = ka[k] < kb[k] ? -1 : ka[k] > kb[k] ? 1 : 0;
      // Mechanic hits of one source keep their line order (equal keys); names and ids never go backwards.
      expect({ i, a: ka, b: kb, ordered: cmp <= 0 }).toEqual({ i, a: ka, b: kb, ordered: true });
      if (mode !== 'mechanic') expect(cmp).toBe(-1);
    }
  }

  const MODE_QUERIES: Array<{ mode: 'gem' | 'unique' | 'mechanic'; args: Record<string, unknown>; action: Record<string, unknown> }> = [
    { mode: 'gem', args: { mode: 'gem', query: 'a' }, action: { mode: 'gem', query: 'a' } },
    { mode: 'unique', args: { mode: 'unique', query: 'a' }, action: { mode: 'unique', query: 'a' } },
    { mode: 'mechanic', args: { mode: 'mechanic', query: 'life' }, action: { mode: 'mechanic', query: 'life' } },
  ];

  for (const { mode, args, action } of MODE_QUERIES) {
    it(
      `AC-K5: ${mode} mode: max_results 50 gives at most 30 and the default at most 20, each the first N of the Lua action's full list, which is in §2.2's order`,
      async () => {
        const full = await lookupAction({ ...action, maxResults: 10000 });
        expect(full.total).toBe(full.results.length);
        expect(full.total).toBeGreaterThan(30);
        expectOrdered(mode, String(action.query), full.results);

        const shownOf = (text: string): string[] =>
          mode === 'mechanic' ? hitLines(text) : blocks(text).map((b) => (mode === 'gem' ? parseGem(b).name : parseUnique(b).name));
        const expectedOf = (n: number): string[] =>
          full.results.slice(0, n).map((r) => (mode === 'mechanic' ? renderHit(r as LookupHit) : (r as { name: string }).name));

        const capped = shownOf(await okTool({ ...args, max_results: 50 }));
        expect(capped.length).toBeLessThanOrEqual(30);
        expect(capped).toEqual(expectedOf(30));

        const byDefault = shownOf(await okTool(args));
        expect(byDefault.length).toBeLessThanOrEqual(20);
        expect(byDefault).toEqual(expectedOf(20));
      },
      ENGINE_TIMEOUT,
    );
  }

  it(
    'AC-K5: exact name matches come first: gem "Spark" lists Spark before names that sort ahead of it, and the tool shows the Lua order',
    async () => {
      const full = await lookupAction({ mode: 'gem', query: 'Spark', maxResults: 10000 });
      const names = full.results.map((r) => (r as { name: string }).name);
      expect(names[0]).toBe('Spark');
      // The exact match isn't first by name alone, so this exercises the exact-first rule.
      expect(names.slice(1).some((n) => n < 'Spark')).toBe(true);
      expectOrdered('gem', 'Spark', full.results);
      const shown = blocks(await okTool({ mode: 'gem', query: 'Spark' })).map((b) => parseGem(b).name);
      expect(shown).toEqual(names.slice(0, 20));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K5: an unknown mode, gem mode without query, unique mode with neither query nor slot, and gem_level 999 are errors; query "zzzz" is not, and says nothing matched',
    async () => {
      for (const args of [
        { mode: 'nonsense', query: 'Blood Hunt' },
        { mode: 'gem' },
        { mode: 'unique' },
        { mode: 'gem', query: 'Blood Hunt', gem_level: 999 },
      ]) {
        const out = await tool(args);
        expect({ args, isError: out.isError }).toEqual({ args, isError: true });
      }
      for (const mode of ['gem', 'unique', 'mechanic']) {
        const text = await okTool({ mode, query: 'zzzz' });
        expect(text).toContain('Nothing matched "zzzz"');
      }
    },
    ENGINE_TIMEOUT,
  );

  /** PoB's gem names (gems with a granted effect), each with whether PoB makes it a support. */
  const gemCandidates = async (asKind?: string): Promise<Candidate[]> => {
    const gems = await luaQuery<Array<{ name: string; support: boolean }>>(`
      local out = {}
      for _, g in pairs(liveGems()) do
        if type(g.name) == 'string' and g.grantedEffect then
          table.insert(out, { name = g.name, support = g.gemType == 'Support' or (g.tags and g.tags.support == true) or false })
        end
      end
      return out`);
    return gems.map((g) => ({ name: g.name, kind: asKind ?? (g.support ? 'support' : 'active') }));
  };

  /** PoB's unique names (`main.uniqueDB`), each with its item type. */
  const uniqueCandidates = async (itemType?: string): Promise<Candidate[]> => {
    const uniques = await luaQuery<Array<{ name: string; type: string }>>(`
      local out = {}
      for key, item in pairs(main.uniqueDB.list) do
        table.insert(out, { name = item.title or item.name or tostring(key), type = item.type })
      end
      return out`);
    return uniques.filter((u) => !itemType || u.type === itemType).map((u) => ({ name: u.name, kind: 'unique', detail: u.type }));
  };

  it(
    "D-258: every gem block shows PoB's Tier; Blood Hunt is Tier 7",
    async () => {
      const text = await okTool({ mode: 'gem', query: 'Blood', max_results: 30 });
      const gems = blocks(text).map(parseGem);
      const pob = await luaQuery<Record<string, number[]>>(`
        local out = {}
        for _, g in pairs(liveGems()) do
          if g.grantedEffect and g.name:lower():find('blood', 1, true) then
            out[g.name] = out[g.name] or {}
            table.insert(out[g.name], g.Tier)
          end
        end
        return out`);
      expect(gems.length).toBe(Object.keys(pob).length);
      for (const g of gems) expect({ name: g.name, tier: g.tier }).toEqual({ name: g.name, tier: expect.any(Number) });
      for (const g of gems) expect(pob[g.name]).toContain(g.tier);
      // A support gem's block carries its tier too.
      const supports = gems.filter((g) => g.supports !== undefined);
      expect(supports.length).toBeGreaterThan(0);

      const hunt = parseGem(blocks(await okTool({ mode: 'gem', query: 'Blood Hunt' }))[0]);
      expect(hunt.name).toBe('Blood Hunt');
      expect(pob['Blood Hunt']).toEqual([7]);
      expect(hunt.tier).toBe(7);
      // The raw reply carries it as a number.
      const raw = await lookupAction({ mode: 'gem', query: 'Blood Hunt', maxResults: 1 });
      expect((raw.results[0] as { tier?: number }).tier).toBe(7);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-258, D-258a: gem mode with no match lists the 5 closest active gems, then the 3 closest supports under their own header; "Blod Hunt" puts Blood Hunt first, and "No Such Skill" and "Ruthlss" (closest to supports) still get 5 active names',
    async () => {
      expect(osa('Blod Hunt', 'Blood Hunt')).toBe(1);
      expect(osa('ab', 'ba')).toBe(1);
      const gems = await gemCandidates();
      const actives = gems.filter((g) => g.kind === 'active');
      const supports = gems.filter((g) => g.kind === 'support');
      // "Ruthlss" and "Rage Vortx" sit closer to supports than to any active gem: one ranking across both
      // kinds would hold at most one active name (the review's case for D-258a).
      for (const query of ['Ruthlss', 'Rage Vortx']) {
        expect({ query, actives: closest(query, gems).filter((c) => c.kind === 'active').length <= 1 }).toEqual({ query, actives: true });
      }
      for (const query of ['Blod Hunt', 'No Such Skill', 'Ruthlss', 'Rage Vortx']) {
        const wantActive = closest(query, actives, 5);
        const wantSupport = closest(query, supports, 3);
        expect(wantActive).toHaveLength(5);
        expect(wantSupport).toHaveLength(3);
        const text = await okTool({ mode: 'gem', query });
        // The existing message stays; the names follow it, active gems first.
        expect(text).toContain(`Nothing matched "${query}".`);
        expect({ query, groups: suggestionGroups(text) }).toEqual({
          query,
          groups: [
            { header: 'Closest active gem names (fewest edits from the query, then by name):', lines: wantActive.map((c) => `- ${c.name} (active)`) },
            { header: 'Closest support gem names (fewest edits from the query, then by name):', lines: wantSupport.map((c) => `- ${c.name} (support)`) },
          ],
        });
        const raw = await lookupAction({ mode: 'gem', query });
        expect(raw.total).toBe(0);
        expect(raw.suggestions?.map((x) => ({ name: x.name, kind: x.kind, distance: x.distance }))).toEqual(
          [...wantActive, ...wantSupport].map((c) => ({ name: c.name, kind: c.kind, distance: c.distance })),
        );
      }
      const blod = suggestionLines(await okTool({ mode: 'gem', query: 'Blod Hunt' }));
      expect(blod[0]).toBe('- Blood Hunt (active)');

      // A query that matches lists no closest names, and its reply has none.
      const hit = await okTool({ mode: 'gem', query: 'Blood Hunt' });
      expect(hit).not.toContain('Closest');
      expect((await lookupAction({ mode: 'gem', query: 'Blood Hunt' })).suggestions).toBeUndefined();
    },
    ENGINE_TIMEOUT,
  );

  it(
    "D-258: unique mode with no match lists the 5 closest unique names with their types, only of `slot` when given",
    async () => {
      const all = await uniqueCandidates();
      const query = "Atziri's Acuty";
      const want = closest(query, all);
      expect(want[0].name).toBe("Atziri's Acuity");
      const text = await okTool({ mode: 'unique', query });
      expect(text).toContain(`Nothing matched "${query}".`);
      expect(text).toContain('Closest unique names (fewest edits from the query, then by name):');
      expect(suggestionLines(text)).toEqual(want.map((c) => `- ${c.name} (${c.detail})`));

      const gloves = closest('No Such Glove', await uniqueCandidates('Gloves'));
      expect(gloves).toHaveLength(5);
      const glovesText = await okTool({ mode: 'unique', query: 'No Such Glove', slot: 'Gloves' });
      expect(glovesText).toContain('Closest unique names of item type Gloves (fewest edits from the query, then by name):');
      expect(suggestionLines(glovesText)).toEqual(gloves.map((c) => `- ${c.name} (Gloves)`));
    },
    ENGINE_TIMEOUT,
  );

  it(
    "D-258: mechanic mode with no match lists the 5 closest names of the gems, uniques, passives, mods, essences (WU-60) and bases (WU-53) it searches, or of `kind`",
    async () => {
      const passives = (
        await luaQuery<Array<{ name: string; ascendancy?: string }>>(`
          local out = {}
          for _, node in pairs(build.spec.tree.nodes) do
            if type(node) == 'table' and type(node.sd) == 'table' and type(node.name) == 'string' and node.name ~= '' then
              table.insert(out, { name = node.name, ascendancy = node.ascendancyName })
            end
          end
          return out`)
      ).map((p): Candidate => ({ name: p.name, kind: 'passive', ...(p.ascendancy ? { detail: p.ascendancy } : {}) }));
      const mods = (
        await luaQuery<Array<{ name: string; table: string }>>(`
          local out = {}
          for tableName, entries in pairs(data.itemMods) do
            if type(entries) == 'table' then
              for id, entry in pairs(entries) do
                if type(entry) == 'table' then table.insert(out, { name = tostring(id), table = tableName }) end
              end
            end
          end
          return out`)
      ).map((m): Candidate => ({ name: m.name, kind: 'mod', detail: m.table }));
      const essences = (
        await luaQuery<string[]>(`
          local out = {}
          for _, essence in pairs(data.essences) do
            -- Only essences with a hit: one of their mods has text (Item, else Exclusive mods).
            local hasText = false
            for _, modId in pairs(essence.mods) do
              if data.itemMods.Item[modId] or data.itemMods.Exclusive[modId] then hasText = true end
            end
            if hasText then table.insert(out, essence.name) end
          end
          return out`)
      ).map((name): Candidate => ({ name, kind: 'essence' }));
      // WU-53 (AC-K60): the bases of PoB's base lists that have an implicit line, labelled with their type.
      const bases = (
        await luaQuery<Array<{ name: string; type: string }>>(`
          local out = {}
          for _, list in pairs(data.itemBaseLists) do
            for _, entry in ipairs(list) do
              if type(entry.base.implicit) == 'string' and entry.base.implicit:find('[^\\n]') then
                table.insert(out, { name = entry.name, type = entry.base.type })
              end
            end
          end
          return out`)
      ).map((b): Candidate => ({ name: b.name, kind: 'base', detail: b.type }));
      expect(passives.length).toBeGreaterThan(0);
      expect(mods.length).toBeGreaterThan(0);
      expect(essences.length).toBeGreaterThan(0);
      expect(bases.length).toBeGreaterThan(0);
      // C-37d (WU-100): PoB's game, character and monster constants, labelled with their table.
      const constants = (
        await luaQuery<Array<{ name: string; table: string }>>(`
          local out = {}
          for tableName, key in pairs({ game = 'gameConstants', character = 'characterConstants', monster = 'monsterConstants' }) do
            for name in pairs(data[key]) do table.insert(out, { name = tostring(name), table = tableName }) end
          end
          return out`)
      ).map((c): Candidate => ({ name: c.name, kind: 'constant', detail: c.table }));
      expect(constants.length).toBeGreaterThan(0);
      const label = (c: Candidate) => `- ${c.name} (${[c.kind, c.detail].filter(Boolean).join(', ')})`;

      // "Crushing Impact" is no line's text, but it is one edit from the Titan notable's name.
      const query = 'Crushing Impact';
      const onlyPassives = closest(query, passives);
      expect(onlyPassives[0]).toMatchObject({ name: 'Crushing Impacts', detail: 'Titan', distance: 1 });
      const text = await okTool({ mode: 'mechanic', query, kind: 'passive' });
      expect(text).toContain(`Nothing matched "${query}", kind passive.`);
      expect(text).toContain('Closest passive names (fewest edits from the query, then by name):');
      expect(suggestionLines(text)).toEqual(onlyPassives.map(label));

      const every = closest('zzzz qqqq', [...(await gemCandidates('gem')), ...(await uniqueCandidates()), ...passives, ...mods, ...essences, ...bases, ...constants]);
      const all = await okTool({ mode: 'mechanic', query: 'zzzz qqqq' });
      expect(all).toContain('Closest gem, unique, passive, mod, essence, base and constant names (fewest edits from the query, then by name):');
      expect(suggestionLines(all)).toEqual(every.map(label));

      // WU-60: with kind essence, only essence names; a misspelt essence is one edit from its name.
      const misspelt = 'Esence of Haste';
      const onlyEssences = closest(misspelt, essences);
      expect(onlyEssences[0]).toMatchObject({ name: 'Essence of Haste', distance: 1 });
      const essenceText = await okTool({ mode: 'mechanic', query: misspelt, kind: 'essence' });
      expect(essenceText).toContain(`Nothing matched "${misspelt}", kind essence.`);
      expect(essenceText).toContain('Closest essence names (fewest edits from the query, then by name):');
      expect(suggestionLines(essenceText)).toEqual(onlyEssences.map(label));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-258 (review): a query over 100 characters gets "Nothing matched" and a one-line note instead of closest names; a 5,000-character mechanic query returns quickly; 100 characters still get names',
    async () => {
      const long = 'q'.repeat(5000);
      const t0 = performance.now();
      const out = await tool({ mode: 'mechanic', query: long });
      const ms = performance.now() - t0;
      expect(out.isError).toBe(false);
      // Ranking 5,000 characters against every name took longer than the 30 s engine timeout before the cap.
      expect(ms).toBeLessThan(10_000);
      expect(out.text).toContain(`Nothing matched "${long}".`);
      expect(out.text).toContain('The query is 5000 characters long, over the 100 that closest names are listed for.');
      expect(out.text).not.toContain('Closest');
      const raw = await lookupAction({ mode: 'mechanic', query: long });
      expect({ suggestions: raw.suggestions, skipped: raw.suggestionsSkipped }).toEqual({
        suggestions: undefined,
        skipped: { queryLength: 5000, maxQueryLength: 100 },
      });

      // The boundary, in gem mode: 100 characters get names, 101 get the note.
      const at = await okTool({ mode: 'gem', query: 'z'.repeat(100) });
      expect(suggestionLines(at)).toHaveLength(8);
      expect(at).not.toContain('characters long');
      const over = await okTool({ mode: 'gem', query: 'z'.repeat(101) });
      expect(suggestionLines(over)).toEqual([]);
      expect(over).toContain('The query is 101 characters long, over the 100 that closest names are listed for.');
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // WU-60 (D-277, AC-K51): a mod hit's base types, and the essences as hits.

  /** The line under a mod hit that lists its base types (the format WU-60 sets). */
  const BASE_TYPES_PREFIX = '  Base types: ';

  /** The base types under the `[mod] <id> (<table> mods): …` hit, split at `; `; undefined without the hit or the line. */
  function baseTypesOf(text: string, table: string, id: string): string[] | undefined {
    const lines = text.split('\n');
    const i = lines.findIndex((l) => l.startsWith(`[mod] ${id} (${table} mods): `));
    if (i < 0 || !lines[i + 1]?.startsWith(BASE_TYPES_PREFIX)) return undefined;
    return lines[i + 1].slice(BASE_TYPES_PREFIX.length).split('; ');
  }

  /** One of PoB's base lists (`data.itemBaseLists`), as PoB's own items answer for one mod. */
  interface PobList {
    name: string;
    type: string;
    subType?: string;
    bases: string[];
    /** The bases whose item PoB gives the mod a non-zero spawn weight (within its affix table, below). */
    can: string[] | Record<string, never>;
    /** The bases with energy shield (`base.armour.EnergyShield`). */
    energyShield: string[] | Record<string, never>;
    /** The bases with Runic Ward (`base.armour.Ward`). */
    ward: string[] | Record<string, never>;
  }

  /**
   * PoB's own answer for one mod: every base of PoB's base lists made into a real item (`new("Item", …)`),
   * and whether `item:GetModSpawnWeight(mod) > 0`. `weighed`: PoB's item crafter weighs the mod at all,
   * which it does for the item's own affix table (`item.affixes`: Item, Flask, Charm, Jewel; only on those
   * items), the corrupted-enchant list (Corruption) and the desecrated list (Desecrated mods with a
   * desecrated tag), never for Exclusive or IncursionLimb. `byTags` counts the bases by weight alone, to
   * show where those rules matter.
   */
  const pobBaseLists = (table: string, id: string) =>
    luaQuery<{ text: string; lists: PobList[]; byTags: number; weighed: boolean }>(`
      local name = ${JSON.stringify(table)}
      local tbl = data.itemMods[name]
      local mod = tbl[${JSON.stringify(id)}]
      local tagged = false
      for _, tag in ipairs(mod.modTags or {}) do
        if tag == 'ulaman_mod' or tag == 'amanamu_mod' or tag == 'kurgal_mod' or tag == 'unveiled_mod' then tagged = true end
      end
      _G.__wu60Items = _G.__wu60Items or {}
      local entries, affixTables = {}, {}
      for listName, list in pairs(data.itemBaseLists) do
        for _, entry in ipairs(list) do
          local item = _G.__wu60Items[entry.name] or new('Item', 'Rarity: Rare\\nProbe\\n' .. entry.name)
          _G.__wu60Items[entry.name] = item
          affixTables[item.affixes] = true
          table.insert(entries, { list = listName, name = entry.name, item = item })
        end
      end
      local weighed = (affixTables[tbl] or name == 'Corruption' or (name == 'Desecrated' and tagged)) and true or false
      local lists, byName, byTags = {}, {}, 0
      for _, e in ipairs(entries) do
        local l = byName[e.list]
        if not l then
          l = { name = e.list, type = e.item.base.type, subType = e.item.base.subType, bases = {}, can = {}, energyShield = {}, ward = {} }
          byName[e.list] = l
          table.insert(lists, l)
        end
        table.insert(l.bases, e.name)
        local weighted = e.item:GetModSpawnWeight(mod) > 0
        if weighted then byTags = byTags + 1 end
        if weighted and weighed and (not affixTables[tbl] or e.item.affixes == tbl) then table.insert(l.can, e.name) end
        if ((e.item.base.armour or {}).EnergyShield or 0) > 0 then table.insert(l.energyShield, e.name) end
        if ((e.item.base.armour or {}).Ward or 0) > 0 then table.insert(l.ward, e.name) end
      end
      return { text = mod[1], lists = lists, byTags = byTags, weighed = weighed }`);

  /**
   * The base types §2.2's target (WU-60) lists, from PoB's lists: by item type, then by list name (byte
   * order); `<type> (all)` when every base of a type with several lists can roll it, else each list with a
   * base that can, with `(<n> of <m> bases: <names>)` when only some can; `none (…)` when no base can, or
   * the reason when PoB doesn't weigh the mod on a base at all.
   */
  function expectedBaseTypes(lists: PobList[], notRolled?: string): string[] {
    if (notRolled) return [`none (${notRolled})`];
    const byType = new Map<string, PobList[]>();
    for (const l of lists) byType.set(l.type, [...(byType.get(l.type) ?? []), l]);
    const out: string[] = [];
    for (const type of [...byType.keys()].sort(byteCmp)) {
      const ofType = byType.get(type)!.sort((a, b) => byteCmp(a.name, b.name));
      const can = ofType.reduce((n, l) => n + arr(l.can).length, 0);
      const total = ofType.reduce((n, l) => n + l.bases.length, 0);
      if (can > 0 && can === total && ofType.length > 1) {
        out.push(`${type} (all)`);
        continue;
      }
      for (const l of ofType) {
        const names = [...arr(l.can)].sort(byteCmp);
        if (names.length === 0) continue;
        out.push(names.length < l.bases.length ? `${l.name} (${names.length} of ${l.bases.length} bases: ${names.join(', ')})` : l.name);
      }
    }
    return out.length > 0 ? out : ['none (no base has a spawn weight for it)'];
  }

  it(
    'AC-K51: the mod hit for Arcane Surge on Crit (ModVeiled.lua:163) lists only gloves with energy shield, exactly the base types whose bases PoB gives it a non-zero spawn weight',
    async () => {
      const id = 'AbyssModGlovesKurgalSuffixArcaneSurgeOnCriticalHit';
      const pob = await pobBaseLists('Desecrated', id);
      expect(pob.text).toContain('Arcane Surge when you deal a Critical Hit');
      const text = await okTool({ mode: 'mechanic', query: pob.text, kind: 'mod', max_results: 30 });
      const listed = baseTypesOf(text, 'Desecrated', id);
      expect(listed).toEqual(expectedBaseTypes(pob.lists));

      // Only gloves with energy shield: each listed base type is one of PoB's Gloves lists whose subtype has
      // Energy Shield, every one of them is listed, and the armour, evasion and armour/evasion gloves are not.
      const byName = new Map(pob.lists.map((l) => [l.name, l]));
      const gloves = pob.lists.filter((l) => l.type === 'Gloves');
      const withEnergyShield = gloves.filter((l) => (l.subType ?? '').includes('Energy Shield')).map((l) => l.name);
      expect(withEnergyShield.length).toBeGreaterThan(0);
      expect(gloves.length).toBeGreaterThan(withEnergyShield.length);
      expect([...listed!].sort(byteCmp)).toEqual(withEnergyShield.sort(byteCmp));
      for (const name of listed!) {
        const l = byName.get(name)!;
        expect({ name, type: l.type }).toEqual({ name, type: 'Gloves' });
        // Each base has energy shield, except PoB's Runeforged bases of these lists, whose defence is Runic Ward.
        const es = new Set(arr(l.energyShield));
        const ward = new Set(arr(l.ward));
        const other = l.bases.filter((b) => !es.has(b) && !(ward.has(b) && b.startsWith('Runeforged ')));
        expect({ name, other }).toEqual({ name, other: [] });
        expect(es.size).toBeGreaterThan(0);
      }

      // The reply carries the same as data.
      const raw = await lookupAction({ mode: 'mechanic', query: pob.text, kind: 'mod', maxResults: 30 });
      const hit = (raw.results as LookupHit[]).find((h) => h.id === `Desecrated/${id}`);
      expect(hit?.baseTypes?.map((b) => b.name)).toEqual(listed);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-K51 (format): a mod hit's base types equal PoB's own items' spawn weights: whole item types collapse to '(all)', a partly covered list names its bases, an affix table's mod counts only on its items, and a mod no base can roll says none",
    async () => {
      const cases: Array<{ table: string; id: string; shows: RegExp }> = [
        // A life affix: whole item types, and single-list types by name.
        { table: 'Item', id: 'IncreasedLife3', shows: /^Body Armour \(all\)$/ },
        // A staff affix only some staves can roll (their `no_<element>_spell_mods` tags).
        { table: 'Item', id: 'GlobalLightningSpellGemsLevelTwoHandWeapon1', shows: /^Staff \(\d+ of \d+ bases: / },
        // A jewel affix of two of the four jewel bases.
        { table: 'Jewel', id: 'JewelBleedingEffect', shows: /^Jewel \(2 of 4 bases: / },
        // A charm affix: only charms take their affixes from the Charm table.
        { table: 'Charm', id: 'FlaskChanceRechargeOnKill2', shows: /^Charm$/ },
        // A corruption on boots of every kind.
        { table: 'Corruption', id: 'CorruptionMovementVelocity1', shows: /^Boots \(all\)$/ },
        // A unique's mod (Exclusive): PoB never rolls it on a base.
        { table: 'Exclusive', id: 'UniqueMutatedVaalArcaneSurgeEffect', shows: /^none \(Exclusive mods aren't rolled on a base\)$/ },
        // A mod no base can roll.
        { table: 'Item', id: 'GlobalLightningSpellGemsLevel1', shows: /^none \(no base has a spawn weight for it\)$/ },
      ];
      for (const { table, id, shows } of cases) {
        const pob = await pobBaseLists(table, id);
        const text = await okTool({ mode: 'mechanic', query: pob.text, kind: 'mod', max_results: 30 });
        const listed = baseTypesOf(text, table, id);
        const notRolled = pob.weighed ? undefined : `${table} mods aren't rolled on a base`;
        expect({ table, id, listed }).toEqual({ table, id, listed: expectedBaseTypes(pob.lists, notRolled) });
        expect({ table, id, shows: listed!.some((b) => shows.test(b)) }).toEqual({ table, id, shows: true });
        if (table === 'Charm') {
          // By tags alone the charm mod would roll on other bases too; PoB's crafting offers it on charms only.
          const can = pob.lists.reduce((n, l) => n + arr(l.can).length, 0);
          expect(pob.byTags).toBeGreaterThan(can);
        }
      }
      // A rune's mod has no spawn weights: its hit has no base-types line.
      const runes = await lookupAction({ mode: 'mechanic', query: 'Arcane Surge', kind: 'mod', maxResults: 30 });
      const rune = (runes.results as LookupHit[]).find((h) => h.table === 'Runes');
      expect(rune).toBeDefined();
      expect(rune!.baseTypes).toBeUndefined();
      const runeText = (await okTool({ mode: 'mechanic', query: 'Arcane Surge', kind: 'mod', max_results: 30 })).split('\n');
      const at = runeText.indexOf(renderHit(rune!));
      expect(at).toBeGreaterThanOrEqual(0);
      expect(runeText[at + 1]?.startsWith(BASE_TYPES_PREFIX) ?? false).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-K51: an essence query returns essence hits: \"Greater Essence of Haste\" lists each mod PoB's essence table grants with its item types and affix type; a query of one of its mod lines finds it; the header counts essence hits",
    async () => {
      const name = 'Greater Essence of Haste';
      const pob = await luaQuery<Array<{ id: string; types: string[]; lines: string[]; affix?: string }>>(`
        local essence
        for _, e in pairs(data.essences) do if e.name == ${JSON.stringify(name)} then essence = e end end
        local byId, out = {}, {}
        for itemType, modId in pairs(essence.mods) do
          local mod = data.itemMods.Item[modId] or data.itemMods.Exclusive[modId]
          if mod then
            if not byId[modId] then
              byId[modId] = { id = modId, types = {}, lines = {}, affix = mod.type }
              for _, line in ipairs(mod) do table.insert(byId[modId].lines, line) end
              table.insert(out, byId[modId])
            end
            table.insert(byId[modId].types, itemType)
          end
        end
        return out`);
      expect(pob.length).toBeGreaterThan(0);
      const mods = [...pob].sort((a, b) => byteCmp(a.id, b.id));
      const source = (m: (typeof pob)[number]) => `${name} (${[...m.types].sort(byteCmp).join(', ')}${m.affix ? `; ${m.affix}` : ''})`;
      const want = mods.flatMap((m) => m.lines.map((line) => `[essence] ${source(m)}: ${line}`));

      // By name: every line of every mod the essence grants.
      const text = await okTool({ mode: 'mechanic', query: name, kind: 'essence', max_results: 30 });
      expect(hitLines(text)).toEqual(want);

      // Without kind, the header counts them as essence hits.
      const full = await lookupAction({ mode: 'mechanic', query: name, maxResults: 10000 });
      const all = full.results as LookupHit[];
      expect(all.filter((h) => h.kind === 'essence').map(renderHit)).toEqual(want);
      expect(full.kinds?.essence).toBe(want.length);
      const k = full.kinds!;
      const plain = await okTool({ mode: 'mechanic', query: name });
      expect(plain.split('\n')).toContain(`${all.length} hits: ${k.gem} gem, ${k.unique} unique, ${k.passive} passive, ${k.mod} mod, ${k.essence} essence, ${k.base} base, ${k.constant} constant.`);

      // By mod text: the line of the mod it grants on the most item types finds an essence hit naming this essence.
      const widest = [...mods].sort((a, b) => b.types.length - a.types.length)[0];
      const line = widest.lines[0];
      const byText = hitLines(await okTool({ mode: 'mechanic', query: line, kind: 'essence', max_results: 30 }));
      expect(byText).toContain(`[essence] ${source(widest)}: ${line}`);
      for (const l of byText) {
        expect(l.startsWith('[essence] ')).toBe(true);
        expect(l.toLowerCase()).toContain(line.toLowerCase());
      }
    },
    ENGINE_TIMEOUT,
  );

  /** The line right after `line` in the tool's text; undefined when `line` isn't there. */
  function lineAfter(text: string, line: string): string | undefined {
    const lines = text.split('\n');
    const i = lines.indexOf(line);
    return i < 0 ? undefined : lines[i + 1];
  }

  it(
    "AC-K51 (literal, at the pin): weighted Exclusive mods aren't rolled on a base; IncreasedLife3's and JewelBleedingEffect's base-type lines; Greater Essence of Haste's hits; Essence of Delirium has no hits and isn't suggested for itself",
    async () => {
      // Exclusive mods whose tags give them weight on bases, which PoB still never rolls on a base.
      for (const [id, text] of [
        ['CorruptionUpgradeJewelLightningResist1', '+(15-20)% to Lightning Resistance'],
        ['LightningResistanceJewel', '+(12-15)% to Lightning Resistance'],
      ]) {
        expect((await pobBaseLists('Exclusive', id)).byTags).toBeGreaterThan(0);
        const out = await okTool({ mode: 'mechanic', query: text, kind: 'mod', max_results: 30 });
        expect({ id, line: lineAfter(out, `[mod] ${id} (Exclusive mods): ${text}`) }).toEqual({
          id,
          line: "  Base types: none (Exclusive mods aren't rolled on a base)",
        });
      }

      // A life affix on whole item types and single-list types; a jewel affix on two of the four jewels.
      const life = await okTool({ mode: 'mechanic', query: '+(30-39) to maximum Life', kind: 'mod', max_results: 30 });
      expect(lineAfter(life, '[mod] IncreasedLife3 (Item mods): +(30-39) to maximum Life')).toBe(
        '  Base types: Amulet; Belt; Body Armour (all); Boots (all); Gloves (all); Helmet (all); Ring; Shield (all)',
      );
      const bleed = await okTool({ mode: 'mechanic', query: 'increased Magnitude of Bleeding you inflict', kind: 'mod', max_results: 30 });
      expect(lineAfter(bleed, '[mod] JewelBleedingEffect (Jewel mods): (5-15)% increased Magnitude of Bleeding you inflict')).toBe(
        '  Base types: Jewel (2 of 4 bases: Diamond, Ruby)',
      );

      // An essence's hits, written out.
      expect(hitLines(await okTool({ mode: 'mechanic', query: 'Greater Essence of Haste', kind: 'essence' }))).toEqual([
        '[essence] Greater Essence of Haste (Bow, Crossbow; Suffix): (14-16)% increased Attack Speed',
        '[essence] Greater Essence of Haste (Dagger, Flail, One Hand Axe, One Hand Mace, One Hand Sword, Spear, Talisman, Two Hand Axe, Two Hand Mace, Two Hand Sword, Warstaff; Suffix): (23-25)% increased Attack Speed',
      ]);

      // Essence of Delirium's only mod is a passive grant with no text: no hits, and its name isn't suggested.
      const delirium = await okTool({ mode: 'mechanic', query: 'Essence of Delirium', kind: 'essence' });
      expect(delirium).toContain('Nothing matched "Essence of Delirium", kind essence.');
      expect(suggestionLines(delirium).length).toBeGreaterThan(0);
      expect(suggestionLines(delirium)).not.toContain('- Essence of Delirium (essence)');
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // WU-53 (D-299, AC-K58…AC-K65): amendment 3's lookup additions. Every expected value is recomputed
  // from PoB's data and functions (Lua queries), never from the tool's output.

  /**
   * Lua helpers for the shared rule: a gem's granted effects (its own, then its additional ones) and the ones
   * PoB makes active skills (not a support, not hideFromSideBar; CalcSetup.lua:1855). Whether PoB applies a
   * support comes from PoB's engine itself, never from a copy of the tool's test: `applied` builds the
   * skill with `calcs.createActiveSkill` and a support list, as CalcSetup does (CalcSetup.lua:1955), for the
   * build's player. The list is made with PoB's addBestSupport rule (one support per gem family;
   * CalcSetup.lua:502-543), restated because it is a local there; `raw` skips it.
   */
  const RULE_LUA = `
    local function isSupportGem(gem) return gem.gemType == 'Support' or (type(gem.tags) == 'table' and gem.tags.support == true) end
    local function effectsOf(gem)
      local out = { gem.grantedEffect }
      for _, e in ipairs(gem.additionalGrantedEffects or {}) do table.insert(out, e) end
      return out
    end
    local function isActive(e) return type(e) == 'table' and not e.support and not e.hideFromSideBar end
    local function activeEffects(gem)
      local out = {}
      for _, e in ipairs(effectsOf(gem)) do if isActive(e) then table.insert(out, e) end end
      return out
    end
    local function allGems()
      local out = {}
      for id, g in pairs(liveGems()) do
        if type(g) == 'table' and type(g.name) == 'string' and g.grantedEffect then table.insert(out, { id = id, name = g.name, gem = g }) end
      end
      table.sort(out, function(a, b) if a.name ~= b.name then return a.name < b.name end return a.id < b.id end)
      return out
    end
    local function gemNamed(name)
      for _, e in ipairs(allGems()) do if e.name == name then return e.gem, e.id end end
    end
    local function oneLine(s) return (tostring(s):gsub('%s*\\n%s*', ' ')) end
    local function typeNames(set)
      local out = {}
      for t, on in pairs(set or {}) do if on then table.insert(out, SkillTypeName[t] or tostring(t)) end end
      table.sort(out)
      return out
    end
    -- How PoB's gem tooltip names a granted effect: its name, else its first stat set's label
    -- (SkillsTab.lua:915-916); n is its place among the gem's granted effects.
    local function effectName(e, n)
      if type(e.name) == 'string' and e.name ~= '' then return e.name end
      local ss = e.statSets and e.statSets[1]
      if ss and type(ss.label) == 'string' and ss.label ~= '' then return ss.label end
      return 'Granted effect ' .. n
    end
    local calcs, player = build.calcsTab.calcs, build.calcsTab.mainEnv.player
    local function addBestSupport(s, list)
      local add = true
      for i, o in ipairs(list) do
        if s.grantedEffect == o.grantedEffect then
          add = false
          break
        elseif s.grantedEffect.gemFamily and o.grantedEffect.gemFamily then
          for _, f in ipairs(s.grantedEffect.gemFamily) do
            for _, g in ipairs(o.grantedEffect.gemFamily) do
              if f == g then add = false; list[i] = s; break end
            end
          end
        elseif s.grantedEffect.plusVersionOf == o.grantedEffect.id then
          add = false; list[i] = s
        elseif o.grantedEffect.plusVersionOf == s.grantedEffect.id then
          add = false
        end
      end
      if add then table.insert(list, s) end
    end
    -- The support effects PoB applies to the active effect e of gem, with the support effects sups socketed
    -- in that order: a set keyed by effect.
    local function applied(e, gem, sups, raw)
      local list = {}
      for _, sup in ipairs(sups) do
        local entry = { grantedEffect = sup, level = 1, quality = 0 }
        if raw then table.insert(list, entry) else addBestSupport(entry, list) end
      end
      local active = { grantedEffect = e, gemData = gem, level = 1, quality = 0, statSet = { index = 1 } }
      local skill = calcs.createActiveSkill(active, list, { mode = 'MAIN' }, player)
      local on = {}
      for i = 2, #skill.effectList do on[skill.effectList[i].grantedEffect] = true end
      return on
    end
    -- PoB applies the support alone to one of the gem's active effects.
    local function canAny(sup, gem)
      for _, e in ipairs(activeEffects(gem)) do if applied(e, gem, { sup })[sup] then return true end end
      return false
    end
  `;

  /** The ids of the gems named `name`, in the order gem mode returns them (by id), and whether each is a support. */
  async function gemsNamed(name: string): Promise<Array<{ id: string; support: boolean }>> {
    const got = await luaQuery<Array<{ id: string; support: boolean }> | Record<string, never>>(`${RULE_LUA}
      local out = {}
      for _, e in ipairs(allGems()) do
        if e.name == ${JSON.stringify(name)} then table.insert(out, { id = e.id, support = isSupportGem(e.gem) }) end
      end
      return out`);
    return Array.isArray(got) ? got : [];
  }

  /**
   * A name list as the spec prints it: one entry per gem, a name that several share printed once, where it
   * first appears, as `<name> ×<n>`; separated by `; `.
   */
  function nameListOf(names: string[]): string {
    const counts = new Map<string, number>();
    for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
    return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join('; ');
  }

  /** The `## <name>` block of a gem-mode reply (the first one with that name). */
  function gemBlockOf(text: string, name: string): string {
    const block = blocks(text).find((b) => b.split('\n')[0] === `## ${name}`);
    if (!block) throw new Error(`no gem block for ${name}`);
    return block;
  }

  /** The line of a block that starts with `prefix`, without the prefix; undefined when absent. */
  function lineWith(block: string, prefix: string): string | undefined {
    const line = block.split('\n').find((l) => l.startsWith(prefix));
    return line === undefined ? undefined : line.slice(prefix.length);
  }

  /** The lines right under `header` that start with `prefix` (without it), up to the first that doesn't. */
  function listUnder(block: string, header: string, prefix: string): string[] | undefined {
    const lines = block.split('\n');
    const at = lines.indexOf(header);
    if (at < 0) return undefined;
    const out: string[] = [];
    for (const line of lines.slice(at + 1)) {
      if (!line.startsWith(prefix)) break;
      out.push(line.slice(prefix.length));
    }
    return out;
  }

  const GEMLING_HEADER = "At +20% Quality, with the Gemling Legionnaire's Advanced Thaumaturgy:";

  /** The every-gem sweep: the Lua action's gem results for a, e, i, o, u and y (maxResults 10000), by id. */
  let sweepCache: Map<string, LookupGem> | undefined;
  async function sweep(): Promise<Map<string, LookupGem>> {
    if (sweepCache) return sweepCache;
    const byId = new Map<string, LookupGem>();
    for (const q of ['a', 'e', 'i', 'o', 'u', 'y']) {
      const r = await lookupAction({ mode: 'gem', query: q, maxResults: 10000 });
      for (const g of r.results as LookupGem[]) byId.set(g.id, g);
    }
    // Together they return every gem with a granted effect.
    const ids = await luaQuery<string[]>(`${RULE_LUA}
      local out = {}
      for _, e in ipairs(allGems()) do table.insert(out, e.id) end
      return out`);
    expect([...byId.keys()].sort(byteCmp)).toEqual([...ids].sort(byteCmp));
    sweepCache = byId;
    return byId;
  }

  it(
    "AC-K58 (Gemling quality): labelled Gemling lines for Hammer of the Gods, Blood Hunt and Snipe; Advanced Thaumaturgy is the only node granting them; the every-gem sweep equals PoB's altQualityStats described at value × 20 (257 gems); mechanic mode finds quality and Gemling lines",
    async () => {
      const hotg = gemBlockOf(await okTool({ mode: 'gem', query: 'Hammer of the Gods' }), 'Hammer of the Gods');
      expect(listUnder(hotg, GEMLING_HEADER, '  - ')).toEqual(['50% chance to not consume Glory']);
      expect(parseGem(hotg).quality).not.toContain('50% chance to not consume Glory');
      const blood = gemBlockOf(await okTool({ mode: 'gem', query: 'Blood Hunt' }), 'Blood Hunt');
      expect(listUnder(blood, GEMLING_HEADER, '  - ')).toEqual(['Enemies lose Life equal to +4% of Consumed Blood Loss']);
      const snipe = gemBlockOf(await okTool({ mode: 'gem', query: 'Snipe', max_results: 1 }), 'Snipe');
      expect(listUnder(snipe, GEMLING_HEADER, '  - ')).toEqual(['20% more Attack Speed', '20% longer Perfect Timing window']);

      // The node whose line sets GemlingQuality: Advanced Thaumaturgy (Gemling Legionnaire) only.
      const nodes = await luaQuery<Array<{ id: number; name: string; asc?: string }>>(`
        local out = {}
        for id, node in pairs(build.spec.tree.nodes) do
          for _, line in ipairs(node.sd or {}) do
            if line == 'Gem Quality grants Socketed Skills an additional effect' then
              table.insert(out, { id = id, name = node.name, asc = node.ascendancyName })
            end
          end
        end
        return out`);
      expect(nodes).toEqual([{ id: 14429, name: 'Advanced Thaumaturgy', asc: 'Gemling Legionnaire' }]);

      // The every-gem sweep against PoB's own describer.
      const want = await luaQuery<Record<string, { lines: string[] | Record<string, never>; has: boolean; empty: string[] | Record<string, never> }>>(`${RULE_LUA}
        local out = {}
        for _, e in ipairs(allGems()) do
          local lines, has, empty = {}, false, {}
          for _, ge in ipairs(effectsOf(e.gem)) do
            if type(ge.altQualityStats) == 'table' and #ge.altQualityStats > 0 then has = true end
            if type(ge.statSets) == 'table' then
              for _, q in ipairs(ge.altQualityStats or {}) do
                local ss = ge.statSets[((q[3] or {})[1] or 0) + 1] or ge.statSets[1]
                local described = data.describeStats({ [q[1]] = q[2] * 20 }, ss.statDescriptionScope, true) or {}
                local n = 0
                for _, line in ipairs(described) do if line then n = n + 1; table.insert(lines, oneLine(line)) end end
                if n == 0 then table.insert(empty, q[1]) end
              end
            end
          end
          out[e.id] = { lines = lines, has = has, empty = empty }
        end
        return out`);
      const gems = await sweep();
      let withGemling = 0;
      const emptyIn: string[] = [];
      for (const [id, gem] of gems) {
        const w = want[id];
        expect({ id, lines: gem.gemlingLines, has: gem.hasGemling }).toEqual({ id, lines: arr(w.lines), has: w.has });
        if (w.has) withGemling += 1;
        if (arr(w.empty).length > 0) emptyIn.push(gem.name);
      }
      expect(withGemling).toBe(257);
      expect(emptyIn.sort(byteCmp)).toEqual(['Detonate Living', 'Flash Grenade', 'Fortifying Cry', 'Siege Cascade']);
      // A gem whose Gemling entries all describe to no line says so.
      const silent = [...gems.values()].find((g) => g.hasGemling && g.gemlingLines.length === 0);
      if (silent) {
        const text = await okTool({ mode: 'gem', query: silent.name, max_results: 30 });
        expect(listUnder(gemBlockOf(text, silent.name), GEMLING_HEADER, '  ')).toEqual(['(no described line)']);
      }
      // A gem without an entry has no header.
      expect(gemBlockOf(await okTool({ mode: 'gem', query: "Ailith's Chimes" }), "Ailith's Chimes")).not.toContain(GEMLING_HEADER);

      // Mechanic mode searches the quality and Gemling lines.
      expect(hitLines(await okTool({ mode: 'mechanic', query: 'not consume Glory', kind: 'gem', max_results: 30 }))).toContain(
        '[gem] Hammer of the Gods (Gemling quality): 50% chance to not consume Glory',
      );
      expect(hitLines(await okTool({ mode: 'mechanic', query: 'metres to explosion radius', kind: 'gem', max_results: 30 }))).toContain(
        '[gem] Blood Hunt (quality): +0.4 metres to explosion radius',
      );
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-K59 (\"usable by\"): Snipe's skill types and its meta gems; Fireball, Spark and Whirling Assault; the every-gem sweep equals PoB's support test of each meta gem's support effect; supports get neither line",
    async () => {
      const snipe = gemBlockOf(await okTool({ mode: 'gem', query: 'Snipe', max_results: 1 }), 'Snipe');
      expect(lineWith(snipe, 'Skill types: ')).toBe(
        'Area, Attack, Barrageable, Bow, Channel, Cold, MirageArcherCanUse, PerfectTiming, Projectile, ProjectilesFromUser, RangedAttack, SkillConsumesFreeze',
      );
      expect(lineWith(snipe, 'Usable by: ')).toBe('Animus Splinters; Mirage Archer; Mirage Deadeye');
      const fireball = lineWith(gemBlockOf(await okTool({ mode: 'gem', query: 'Fireball' }), 'Fireball'), 'Usable by: ')!.split('; ');
      const spark = lineWith(gemBlockOf(await okTool({ mode: 'gem', query: 'Spark', max_results: 1 }), 'Spark'), 'Usable by: ')!.split('; ');
      expect(fireball).toContain('Fire Spell on Hit (trigger)');
      expect(fireball.some((m) => m.startsWith("Thundergod's Wrath"))).toBe(false);
      expect(spark).toContain("Thundergod's Wrath (trigger)");
      expect(spark.some((m) => m.startsWith('Fire Spell on Hit'))).toBe(false);
      for (const list of [fireball, spark]) {
        expect(list).toContain('Cast on Critical (trigger)');
        expect(list).toContain('Spell Totem');
      }
      expect(lineWith(gemBlockOf(await okTool({ mode: 'gem', query: 'Whirling Assault' }), 'Whirling Assault'), 'Usable by: ')).toBe(
        'Animus Splinters; Hollow Form',
      );

      // The every-gem sweep: PoB's own support test, each meta gem's support effect against the gem's active effects.
      const want = await luaQuery<{
        metas: number;
        oneSupportEach: boolean;
        gems: Record<string, { active: boolean; types: string[] | Record<string, never>; usable: string[] | Record<string, never>; extra: Array<string[] | false> | Record<string, never> }>;
      }>(`${RULE_LUA}
        local metas, oneEach = {}, true
        for _, e in ipairs(allGems()) do
          local isMeta, sups = false, {}
          for _, ge in ipairs(effectsOf(e.gem)) do
            if type(ge.skillTypes) == 'table' and ge.skillTypes[SkillType.Meta] then isMeta = true end
            if ge.support then table.insert(sups, ge) end
          end
          if isMeta then
            if #sups ~= 1 then oneEach = false end
            table.insert(metas, { name = e.name, sup = sups[1] })
          end
        end
        local gems = {}
        for _, e in ipairs(allGems()) do
          local entry = { active = not isSupportGem(e.gem), types = {}, usable = {}, extra = {} }
          if entry.active then
            entry.types = typeNames(e.gem.grantedEffect.skillTypes)
            for _, m in ipairs(metas) do
              if m.sup and canAny(m.sup, e.gem) then table.insert(entry.usable, m.name .. (m.sup.isTrigger and ' (trigger)' or '')) end
            end
          end
          for _, ge in ipairs(e.gem.additionalGrantedEffects or {}) do
            if ge.statSets then table.insert(entry.extra, (not ge.support) and typeNames(ge.skillTypes) or false) end
          end
          gems[e.id] = entry
        end
        return { metas = #metas, oneSupportEach = oneEach, gems = gems }`);
      expect({ metas: want.metas, oneSupportEach: want.oneSupportEach }).toEqual({ metas: 29, oneSupportEach: true });
      let noMeta: LookupGem | undefined;
      for (const [id, gem] of await sweep()) {
        const w = want.gems[id];
        if (w.active) {
          const usable = (gem.usableBy ?? []).map((m) => `${m.name}${m.trigger ? ' (trigger)' : ''}`);
          expect({ id, types: gem.skillTypes, usable }).toEqual({ id, types: arr(w.types), usable: arr(w.usable) });
          if (usable.length === 0 && !noMeta) noMeta = gem;
        } else {
          expect({ id, types: gem.skillTypes, usable: gem.usableBy }).toEqual({ id, types: undefined, usable: undefined });
        }
        const extra = arr(w.extra).map((t) => (t === false ? undefined : arr(t)));
        expect({ id, extra: gem.additional.map((a) => a.skillTypes) }).toEqual({ id, extra });
      }
      // A support's block has neither line; an active gem with no meta gem says so.
      const ailith = gemBlockOf(await okTool({ mode: 'gem', query: "Ailith's Chimes" }), "Ailith's Chimes");
      expect([lineWith(ailith, 'Skill types: '), lineWith(ailith, 'Usable by: ')]).toEqual([undefined, undefined]);
      expect(noMeta).toBeDefined();
      const lone = await okTool({ mode: 'gem', query: noMeta!.name, max_results: 30 });
      expect(blocks(lone).filter((b) => b.split('\n')[0] === `## ${noMeta!.name}`).some((b) => lineWith(b, 'Usable by: ') === '(no meta gem)')).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K60 (item-base implicits): kind base finds Absent Amulet\'s Cast on Critical variant and Solar Amulet\'s Spirit; for Spirit, Grants Skill and Resistance the base hits equal the lines of PoB\'s base lists; closest base names; the kind error and the header name base',
    async () => {
      expect(hitLines(await okTool({ mode: 'mechanic', query: 'Cast on Critical', kind: 'base', max_results: 30 }))).toContain(
        '[base] Absent Amulet (Amulet; variant Cast on Critical): Grants Skill: Level (1-20) Cast on Critical',
      );
      expect(hitLines(await okTool({ mode: 'mechanic', query: 'Spirit', kind: 'base', max_results: 30 }))).toContain(
        '[base] Solar Amulet (Amulet): +(10-15) to Spirit',
      );

      // PoB's base lists, each base name once, with its implicit lines (the variant tag removed).
      const bases = await luaQuery<Array<{ name: string; type: string; lines: Array<{ line: string; variants?: string[] }> }>>(`
        local out, seen = {}, {}
        for listName, list in pairs(data.itemBaseLists) do
          for _, entry in ipairs(list) do
            local b = entry.base
            if not seen[entry.name] and type(b.implicit) == 'string' then
              seen[entry.name] = true
              local lines = {}
              for raw in b.implicit:gmatch('[^\\n]+') do
                local n, rest = raw:match('^{variant:(%d+)}(.*)$')
                if n then table.insert(lines, { line = rest, variants = { b.variantList[tonumber(n)] } })
                else table.insert(lines, { line = raw }) end
              end
              table.insert(out, { name = entry.name, type = b.type, lines = lines })
            end
          end
        end
        return out`);
      expect(bases.length).toBe(501);
      bases.sort((a, b) => byteCmp(a.name, b.name));
      for (const query of ['Spirit', 'Grants Skill', 'Resistance']) {
        const q = query.toLowerCase();
        const want: string[] = [];
        for (const b of bases) {
          const byName = b.name.toLowerCase().includes(q);
          for (const l of b.lines) {
            if (byName || l.line.toLowerCase().includes(q)) {
              const where = l.variants ? `${b.type}; variant ${l.variants[0]}` : b.type;
              want.push(`[base] ${b.name} (${where}): ${l.line}`);
            }
          }
        }
        expect(want.length).toBeGreaterThan(0);
        const full = await lookupAction({ mode: 'mechanic', query, maxResults: 100000 });
        const got = (full.results as LookupHit[]).filter((h) => h.kind === 'base').map(renderHit);
        expect({ query, got }).toEqual({ query, got: want });
        expect(full.kinds?.base).toBe(want.length);
        if (query === 'Spirit') {
          const k = full.kinds!;
          const all = full.results.length;
          expect((await okTool({ mode: 'mechanic', query })).split('\n')).toContain(
            `${all} hits: ${k.gem} gem, ${k.unique} unique, ${k.passive} passive, ${k.mod} mod, ${k.essence} essence, ${k.base} base, ${k.constant} constant.`,
          );
        }
      }

      const misspelt = await okTool({ mode: 'mechanic', query: 'Solar Amulett', kind: 'base' });
      expect(misspelt).toContain('Nothing matched "Solar Amulett", kind base.');
      expect(suggestionLines(misspelt)[0]).toBe('- Solar Amulet (base, Amulet)');
      const bad = await tool({ mode: 'mechanic', query: 'Spirit', kind: 'nonsense' });
      expect(bad.isError).toBe(true);
      expect(bad.text).toContain('base');
    },
    ENGINE_TIMEOUT,
  );

  /**
   * AC-K61's lines for one active gem (by id), from PoB's engine: each support X that PoB applies alone to
   * none of the gem's active effects, with each support Y such that, socketed as (Y, X) after PoB's
   * one-support-per-family rule, PoB's createActiveSkill applies both to one active effect. One line per X,
   * `<X>: after <Y names>`, the names as a name list.
   */
  async function unlocksOf(id: string): Promise<string[]> {
    const got = await luaQuery<Array<{ name: string; after: string[] }> | Record<string, never>>(`${RULE_LUA}
      local gem = data.gems[${JSON.stringify(id)}]
      local effects = activeEffects(gem)
      local supports = {}
      for _, e in ipairs(allGems()) do if isSupportGem(e.gem) then table.insert(supports, e) end end
      local out = {}
      for _, x in ipairs(supports) do
        local xe = x.gem.grantedEffect
        if not canAny(xe, gem) then
          local after = {}
          for _, y in ipairs(supports) do
            local ye = y.gem.grantedEffect
            if y.id ~= x.id then
              for _, e in ipairs(effects) do
                local on = applied(e, gem, { ye, xe })
                if on[ye] and on[xe] then table.insert(after, y.name) break end
              end
            end
          end
          if #after > 0 then table.insert(out, { name = x.name, after = after }) end
        end
      end
      return out`);
    return (Array.isArray(got) ? got : []).map((u) => `${u.name}: after ${nameListOf(u.after)}`);
  }

  const UNLOCKED = 'Unlocked by another support:';
  const SEVERAL = 'Several gems are returned';

  /** The `## <name>` blocks of a gem-mode reply, in order. */
  const blocksNamed = (text: string, name: string): string[] => blocks(text).filter((b) => b.split('\n')[0] === `## ${name}`);

  /** The lines under a block's `Unlocked by another support:` (its `- ` lines or `  (none)`); undefined without it. */
  function unlockLines(block: string): string[] | undefined {
    const lines = block.split('\n');
    const at = lines.indexOf(UNLOCKED);
    if (at < 0) return undefined;
    const out: string[] = [];
    for (const l of lines.slice(at + 1)) {
      if (!l.startsWith('- ') && l !== '  (none)') break;
      out.push(l);
    }
    return out;
  }

  /** The lines AC-K61 expects under the header, from `unlocksOf`. */
  const unlockWant = (want: string[]): string[] => (want.length > 0 ? want.map((l) => `- ${l}`) : ['  (none)']);

  it(
    "AC-K61 (type-granting unlocks): Whirling Assault lists Ailith's Chimes after Culmination II among 28 lines; Gas Grenade's Nova Projectiles II isn't unlocked by its own family; Herald of Ash has none; the lines equal PoB's createActiveSkill for eight gems, Mace Strike's three among them",
    async () => {
      const wa = gemBlockOf(await okTool({ mode: 'gem', query: 'Whirling Assault' }), 'Whirling Assault');
      const waLines = listUnder(wa, UNLOCKED, '- ')!;
      expect(waLines).toContain("Ailith's Chimes: after Combo Finisher I; Combo Finisher II; Culmination I; Culmination II; Vruun's Inevitability");
      // 29 before D-384, which leaves the supports PoB marks legacy out of every gem's lists.
      expect(waLines).toHaveLength(28);
      // The example's facts, from PoB's data and engine.
      const facts = await luaQuery<{ types: string[]; req: string[]; adds: boolean; c2: boolean; ac: boolean; pair: boolean }>(`${RULE_LUA}
        local wa = gemNamed('Whirling Assault')
        local ac, c2 = gemNamed("Ailith's Chimes").grantedEffect, gemNamed('Culmination II').grantedEffect
        local req = {}
        for _, t in ipairs(ac.requireSkillTypes) do table.insert(req, SkillTypeName[t]) end
        local adds = false
        for _, t in ipairs(c2.addSkillTypes) do if t == SkillType.ComboStacking then adds = true end end
        local on = applied(wa.grantedEffect, wa, { c2, ac })
        return { types = typeNames(wa.grantedEffect.skillTypes), req = req, adds = adds, c2 = canAny(c2, wa), ac = canAny(ac, wa),
          pair = on[c2] == true and on[ac] == true }`);
      expect(facts).toEqual({ types: ['Area', 'Attack', 'Melee', 'MeleeSingleTarget'], req: ['ComboStacking'], adds: true, c2: true, ac: false, pair: true });

      // Family: on Gas Grenade, PoB's engine applies both Nova Projectiles I and II when both reach it, but
      // PoB keeps one support per family, so the pair never forms.
      const nova = await luaQuery<{ alone: boolean; raw: boolean; kept: boolean; family: boolean }>(`${RULE_LUA}
        local gg = gemNamed('Gas Grenade')
        local y, x = gemNamed('Nova Projectiles I').grantedEffect, gemNamed('Nova Projectiles II').grantedEffect
        local raw, kept = false, false
        for _, e in ipairs(activeEffects(gg)) do
          local on = applied(e, gg, { y, x }, true)
          if on[y] and on[x] then raw = true end
          local fam = applied(e, gg, { y, x })
          if fam[y] and fam[x] then kept = true end
        end
        local fam = false
        for _, f in ipairs(x.gemFamily or {}) do for _, g in ipairs(y.gemFamily or {}) do if f == g then fam = true end end end
        return { alone = canAny(x, gg), raw = raw, kept = kept, family = fam }`);
      expect(nova).toEqual({ alone: false, raw: true, kept: false, family: true });
      const gg = listUnder(gemBlockOf(await okTool({ mode: 'gem', query: 'Gas Grenade' }), 'Gas Grenade'), UNLOCKED, '- ')!;
      expect(gg.find((l) => l.startsWith('Nova Projectiles II: ') && l.includes('Nova Projectiles I;'))).toBeUndefined();
      expect(gg.find((l) => l.startsWith('Nova Projectiles II: ') && l.endsWith('Nova Projectiles I'))).toBeUndefined();

      // A gem with no unlock says so: Herald of Ash.
      expect(unlockLines(gemBlockOf(await okTool({ mode: 'gem', query: 'Herald of Ash' }), 'Herald of Ash'))).toEqual(['  (none)']);

      // The rule check: each returned gem's lines equal PoB's engine. Mace Strike's three gems share its
      // name, so its exact name returns all three, each with its lines, and no several-gems line.
      for (const [name, extra, count] of [
        ['Whirling Assault', {}, 1],
        ['Snipe', { max_results: 1 }, 1],
        ['Fireball', {}, 1],
        ['Gas Grenade', {}, 1],
        ['Raise Zombie', {}, 1],
        ['Cast on Critical', {}, 1],
        ['Herald of Ash', {}, 1],
        ['Mace Strike', {}, 3],
      ] as const) {
        const text = await okTool({ mode: 'gem', query: name, ...extra });
        const named = blocksNamed(text, name);
        const ids = (await gemsNamed(name)).slice(0, count);
        expect({ name, blocks: named.length, ids: ids.length }).toEqual({ name, blocks: count, ids: count });
        if (count > 1) expect({ name, note: text.includes(SEVERAL) }).toEqual({ name, note: false });
        for (const [i, block] of named.entries()) {
          const want = unlockWant(await unlocksOf(ids[i].id));
          expect({ name, id: ids[i].id, got: unlockLines(block) }).toEqual({ name, id: ids[i].id, got: want });
        }
      }
    },
    ENGINE_TIMEOUT,
  );

  /** AC-K62's gems for one support gem (by id), from PoB's engine: the active gems it is applied to alone, and the total. */
  async function reachOf(id: string): Promise<{ yes: string[]; no: string[]; total: number }> {
    const r = await luaQuery<{ yes: string[] | Record<string, never>; no: string[] | Record<string, never>; total: number }>(`${RULE_LUA}
      local sup = data.gems[${JSON.stringify(id)}].grantedEffect
      local yes, no, total = {}, {}, 0
      for _, e in ipairs(allGems()) do
        if not isSupportGem(e.gem) then
          total = total + 1
          table.insert(canAny(sup, e.gem) and yes or no, e.name)
        end
      end
      return { yes = yes, no = no, total = total }`);
    return { yes: arr(r.yes), no: arr(r.no), total: r.total };
  }

  /** The `Can support` line AC-K62 expects for a support gem's reach. */
  function canSupportOf(want: { yes: string[]; no: string[]; total: number }): string {
    const head = `${want.yes.length} of ${want.total} active gems): `;
    if (want.yes.length * 2 > want.total) return `${head}all except ${nameListOf(want.no)}`;
    return head + (want.yes.length > 0 ? nameListOf(want.yes) : '(none)');
  }

  it(
    "AC-K62 (what a support can ride): Ailith's Chimes and Culmination II in the list form, Uhtred's Exodus in the complement form; five supports equal PoB's createActiveSkill; shared names print once with ×n; Unleash's support and spell both get their lists; several gems get the note instead",
    async () => {
      const line = async (name: string, extra: Record<string, unknown> = {}) =>
        lineWith(gemBlockOf(await okTool({ mode: 'gem', query: name, ...extra }), name), 'Can support (');
      expect(await line("Ailith's Chimes")).toBe('2 of 399 active gems): Mantra of Destruction; Tempest Bell');
      const culm = (await line('Culmination II'))!;
      expect(culm.startsWith('93 of 399 active gems): ')).toBe(true);
      expect(culm).not.toContain('all except');
      const culmNames = culm.slice('93 of 399 active gems): '.length).split('; ');
      expect(culmNames).toContain('Whirling Assault');
      // Gems that share a name print once, with ×n; the count still counts every gem.
      expect(culmNames).toContain('Mace Strike ×3');
      expect(culmNames).toContain('Spear Stab ×2');
      expect(culmNames).not.toContain('Mace Strike');
      expect(await line("Uhtred's Exodus")).toBe('398 of 399 active gems): all except Abyssal Apparition');

      for (const [name, extra] of [
        ["Ailith's Chimes", {}],
        ['Culmination II', {}],
        ["Uhtred's Exodus", {}],
        ["Paquate's Pact", {}],
        ['Living Lightning', { max_results: 1 }],
      ] as const) {
        const [{ id }] = await gemsNamed(name);
        const want = await reachOf(id);
        expect(want.total).toBe(399);
        expect({ name, got: await line(name, extra) }).toEqual({ name, got: canSupportOf(want) });
      }

      // Unleash is a spell and a support. Both are named as the query, so each gets its long list, as
      // though it were the only result, and the several-gems line is left out.
      const unleash = await okTool({ mode: 'gem', query: 'Unleash' });
      const unleashBlocks = blocksNamed(unleash, 'Unleash');
      const unleashGems = await gemsNamed('Unleash');
      expect(unleashGems.map((g) => g.support)).toEqual([false, true]);
      expect(blocks(unleash)).toHaveLength(2);
      expect(unleashBlocks).toHaveLength(2);
      expect(unleash).not.toContain(SEVERAL);
      const [spell, support] = unleashBlocks;
      expect(lineWith(support, 'Can support (')).toBe(canSupportOf(await reachOf(unleashGems[1].id)));
      expect(lineWith(spell, 'Can support (')).toBeUndefined();
      expect(unlockLines(spell)).toEqual(unlockWant(await unlocksOf(unleashGems[0].id)));
      expect(unlockLines(support)).toBeUndefined();

      // Several gems returned, not all named as the query: neither long list, and the note says how to get them.
      const several = await okTool({ mode: 'gem', query: 'Culmination' });
      expect(blocks(several).map((b) => b.split('\n')[0])).toEqual(['## Culmination I', '## Culmination II']);
      expect(several).not.toContain('Can support (');
      expect(several).not.toContain(UNLOCKED);
      const note = several.split('\n').find((l) => l.startsWith(SEVERAL));
      expect(note).toBeDefined();
      expect(note).toContain('exact name');
      expect(note).toContain('max_results 1');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K63 (named phrase searches): gaps match the parts in order; "cannot … but" and "your … shatter" equal their filtered full lists; the five plain phrases each hit; a query of gaps alone is an error',
    async () => {
      for (const [query, first, re] of [
        ['cannot … but', 'cannot', /cannot.*but/i],
        ['your … shatter', 'shatter', /your.*shatter/i],
      ] as const) {
        const gap = await lookupAction({ mode: 'mechanic', query, maxResults: 100000 });
        const base = await lookupAction({ mode: 'mechanic', query: first, maxResults: 100000 });
        const want = (base.results as LookupHit[]).filter((h) => re.test(h.line)).map(renderHit);
        expect(want.length).toBeGreaterThan(0);
        expect({ query, got: (gap.results as LookupHit[]).map(renderHit) }).toEqual({ query, got: want });
        const count = (k: string) => (base.results as LookupHit[]).filter((h) => h.kind === k && re.test(h.line)).length;
        expect(gap.kinds).toEqual({ gem: count('gem'), unique: count('unique'), passive: count('passive'), mod: count('mod'), essence: count('essence'), base: count('base'), constant: count('constant') });
      }
      const dots = await lookupAction({ mode: 'mechanic', query: 'cannot ... but', maxResults: 100000 });
      const ellipsis = await lookupAction({ mode: 'mechanic', query: 'cannot … but', maxResults: 100000 });
      expect((dots.results as LookupHit[]).map(renderHit)).toEqual((ellipsis.results as LookupHit[]).map(renderHit));

      const cannot = (ellipsis.results as LookupHit[]).map(renderHit);
      expect(cannot.some((l) => l.startsWith('[gem] Combo Finisher I: ') && /cannot be used until enough Combo/.test(l))).toBe(true);
      expect(cannot).toContain("[unique] Lavianga's Spirits (Flask): This Flask cannot be Used but applies its Effect constantly");
      expect(hitLines(await okTool({ mode: 'mechanic', query: 'your … shatter', kind: 'unique', max_results: 30 }))).toContain(
        '[unique] Polcirkeln (Ring): Enemies Chilled by your Hits can be Shattered as though Frozen',
      );

      for (const phrase of ['also apply to', 'while already at maximum', 'per 100 maximum', 'for each type of', 'instead of you']) {
        const full = await lookupAction({ mode: 'mechanic', query: phrase, maxResults: 100000 });
        expect({ phrase, hits: full.results.length > 0 }).toEqual({ phrase, hits: true });
        for (const h of full.results as LookupHit[]) expect(h.line.toLowerCase()).toContain(phrase);
      }

      for (const query of ['…', '...', ' … ... ']) {
        const out = await tool({ mode: 'mechanic', query });
        expect({ query, isError: out.isError }).toEqual({ query, isError: true });
        expect(out.text).toContain('mechanic mode needs a query');
      }
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-K64 (hit-making children): Bloodhound's Mark, Pounce, Living Lightning, Artillery Ballista and Raise Zombie name theirs; Snipe and Mirage Archer have none; Charged Mark's and Voltaic Barrier's unnamed effects take their stat set's label; the every-gem sweep equals PoB's data by the rule (94 of 126 effects; 121 gems)",
    async () => {
      const children = async (name: string, extra: Record<string, unknown> = {}) =>
        listUnder(gemBlockOf(await okTool({ mode: 'gem', query: name, ...extra }), name), 'Hit-making children:', '')!.filter(
          (l) => l.startsWith('- ') || l === '  (none)',
        );
      expect(await children("Bloodhound's Mark")).toEqual(['- Blood Explosion (triggered)']);
      expect(await children('Pounce')).toEqual(['- Basic Attack (minion Wolf Companion)', '- Leap Slam (minion Wolf Companion)']);
      expect(await children('Living Lightning', { max_results: 1 })).toEqual(['- Zap (minion Living Lightning)']);
      expect(await children('Artillery Ballista')).toEqual(['- Ballista Bolt (granted)']);
      expect(await children('Raise Zombie')).toEqual(['- Basic Attack (minion Raised Zombie)']);
      expect(await children('Snipe', { max_results: 1 })).toEqual(['  (none)']);
      expect(await children('Mirage Archer')).toEqual(['  (none)']);

      // Unnamed effects take their first stat set's label, as PoB's gem tooltip names them: Charged Mark's
      // and Voltaic Barrier's triggered effects have no name.
      const unnamed = await luaQuery<Array<{ name: string; label: string }>>(`${RULE_LUA}
        local out = {}
        for _, gemName in ipairs({ 'Charged Mark', 'Voltaic Barrier' }) do
          local e = gemNamed(gemName).additionalGrantedEffects[1]
          table.insert(out, { name = e.name, label = e.statSets[1].label })
        end
        return out`);
      expect(unnamed).toEqual([
        { name: '', label: 'Charged Mark' },
        { name: '', label: 'Beam' },
      ]);
      for (const [gem, label] of [
        ['Charged Mark', 'Charged Mark'],
        ['Voltaic Barrier', 'Beam'],
      ] as const) {
        const block = gemBlockOf(await okTool({ mode: 'gem', query: gem }), gem);
        expect({ gem, also: lineWith(block, 'Also grants: ') }).toEqual({ gem, also: label });
        expect({ gem, children: await children(gem) }).toEqual({ gem, children: [`- ${label} (triggered)`] });
      }

      const want = await luaQuery<{ other: number; hit: number; gems: Record<string, string[] | Record<string, never>> }>(`${RULE_LUA}
        local function hits(e)
          local t = e.skillTypes or {}
          if t[SkillType.Attack] or t[SkillType.Damage] or t[SkillType.Projectile] then return true end
          for _, ss in ipairs(e.statSets or {}) do if ss.baseFlags and ss.baseFlags.hit then return true end end
          return false
        end
        local other, hit, gems = 0, 0, {}
        for _, g in ipairs(allGems()) do
          local out, seen = {}, {}
          local function add(s) if not seen[s] then seen[s] = true table.insert(out, s) end end
          for i, e in ipairs(g.gem.additionalGrantedEffects or {}) do
            if isActive(e) then
              other = other + 1
              if hits(e) then
                hit = hit + 1
                local t = e.skillTypes or {}
                local name = effectName(e, i + 1)
                add('- ' .. name .. ' (' .. ((t[SkillType.Triggered] or t[SkillType.InbuiltTrigger]) and 'triggered' or 'granted') .. ')')
              end
            end
          end
          for _, e in ipairs(effectsOf(g.gem)) do
            if isActive(e) then
              for _, m in ipairs(e.minionList or {}) do
                local md = data.minions[m]
                if md then
                  for _, sid in ipairs(md.skillList or {}) do
                    local s = data.skills[sid]
                    if s and hits(s) then add('- ' .. s.name .. ' (minion ' .. md.name .. ')') end
                  end
                end
              end
            end
          end
          gems[g.id] = out
        end
        return { other = other, hit = hit, gems = gems }`);
      expect({ other: want.other, hit: want.hit }).toEqual({ other: 126, hit: 94 });
      let withChild = 0;
      for (const [id, gem] of await sweep()) {
        const got = gem.children.map((c) => `- ${c.name} (${c.kind === 'minion' ? `minion ${c.minion}` : c.kind})`);
        expect({ id, got }).toEqual({ id, got: arr(want.gems[id]) });
        if (got.length > 0) withChild += 1;
      }
      expect(withChild).toBe(121);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-K71 (D-379): gem mode finds a minion skill by name: \"Navira's Fracturing\" is one result (Kind: minion skill, cast by Navira's minion, summoned by \"Navira, the Last Mirage\", Commanded: yes, granted by node 10561 of Disciple of Varashta, its cooldown, skill types and stat sets); \"Gas Arrow\" lists the gem first, then the minion skill; \"Navira, the Last Mirage\" is still a gem",
    async () => {
      // PoB's own data for the expected lines: who casts the skill (gem -> minionList -> minion's skillList), whether a
      // stat set lists is_commandable_skill, the passives with the line "Grants Skill: <name>", the cooldown, types
      // and described stat sets at the skill's highest level.
      const minionSkillQuery = (name: string) => `${RULE_LUA}
        local wanted = ${JSON.stringify(name)}
        local out = {}
        local byId = {}
        for _, g in ipairs(allGems()) do
          for _, e in ipairs(activeEffects(g.gem)) do
            for _, m in ipairs(e.minionList or {}) do
              local md = data.minions[m]
              for _, sid in ipairs(md and md.skillList or {}) do
                local s = data.skills[sid]
                if s and s.name == wanted then
                  byId[sid] = byId[sid] or { id = sid, castBy = {} }
                  local line = 'Cast by: ' .. md.name .. ' (summoned by ' .. g.name .. ')'
                  local seen = false
                  for _, l in ipairs(byId[sid].castBy) do if l == line then seen = true end end
                  if not seen then table.insert(byId[sid].castBy, line) end
                end
              end
            end
          end
        end
        for sid, entry in pairs(byId) do
          local s = data.skills[sid]
          local commanded = false
          for _, ss in ipairs(s.statSets) do
            for _, st in ipairs(ss.stats or {}) do if st == 'is_commandable_skill' then commanded = true end end
          end
          local nodes = {}
          for id, node in pairs(build.spec.tree.nodes) do
            for _, l in ipairs(node.sd or {}) do
              if l == 'Grants Skill: ' .. wanted then table.insert(nodes, { id = id, line = 'Granted by: ' .. node.name .. ' (' .. (node.ascendancyName and (node.ascendancyName .. ', ') or '') .. 'node ' .. id .. ')' }) end
            end
          end
          table.sort(nodes, function(a, b) return a.id < b.id end)
          local granted = {}
          for i, n in ipairs(nodes) do granted[i] = n.line end
          local top = 0
          for l in pairs(s.levels) do if type(l) == 'number' and l > top then top = l end end
          local sets = {}
          for i, ss in ipairs(s.statSets) do
            local lines = {}
            for _, l in ipairs(data.describeStats(calcLib.buildSkillInstanceStats({ level = top, quality = 0 }, s, ss), ss.statDescriptionScope) or {}) do
              table.insert(lines, '  - ' .. oneLine(l))
            end
            sets[i] = { header = 'Stat set ' .. i .. ': ' .. ((type(ss.label) == 'string' and ss.label ~= '') and ss.label or s.name), lines = lines }
          end
          table.sort(entry.castBy)
          table.insert(out, {
            id = sid, castBy = entry.castBy, commanded = commanded, grantedBy = granted,
            cooldown = s.levels[top].cooldown, types = typeNames(s.skillTypes), sets = sets,
          })
        end
        table.sort(out, function(a, b) return a.id < b.id end)
        return out`;
      interface Want {
        id: string;
        castBy: string[];
        commanded: boolean;
        grantedBy: string[] | Record<string, never>;
        cooldown?: number;
        types: string[];
        sets: Array<{ header: string; lines: string[] | Record<string, never> }>;
      }

      const [fracturing] = await luaQuery<Want[]>(minionSkillQuery("Navira's Fracturing"));
      // The spec's own facts, held against PoB's data.
      expect(fracturing.castBy).toEqual(['Cast by: Navira, the Last Mirage (summoned by Navira, the Last Mirage)']);
      expect(fracturing.commanded).toBe(true);
      expect(fracturing.grantedBy).toEqual(["Granted by: Navira's Fracturing (Disciple of Varashta, node 10561)"]);

      const raw = await lookupAction({ mode: 'gem', query: "Navira's Fracturing" });
      expect(raw.total).toBe(1);
      expect(raw.results.map((r) => [r.kind, (r as { id: string }).id])).toEqual([['minion-skill', fracturing.id]]);

      const text = await okTool({ mode: 'gem', query: "navira's fracturing" });
      expect(text).toContain('Found 1 match');
      const got = blocks(text);
      expect(got).toHaveLength(1);
      const lines = got[0].split('\n');
      expect(lines.slice(0, 5)).toEqual([
        "## Navira's Fracturing",
        'Kind: minion skill',
        'Cast by: Navira, the Last Mirage (summoned by Navira, the Last Mirage)',
        'Commanded: yes',
        "Granted by: Navira's Fracturing (Disciple of Varashta, node 10561)",
      ]);
      expect(lines).toContain(`Cooldown: ${fracturing.cooldown} s`);
      expect(lines).toContain(`Skill types: ${fracturing.types.join(', ')}`);
      for (const set of fracturing.sets) {
        const at = lines.indexOf(set.header);
        expect({ header: set.header, at: at >= 0 }).toEqual({ header: set.header, at: true });
        const listed = lines.slice(at + 1).filter((l) => l.startsWith('  - '));
        expect(listed.slice(0, arr(set.lines).length)).toEqual(arr(set.lines));
      }

      // Names a gem and a minion skill share: the gem first, then each minion skill (by id), with its casters.
      for (const name of ['Gas Arrow', 'Leap Slam']) {
        const want = await luaQuery<Want[]>(minionSkillQuery(name));
        expect(want.length).toBeGreaterThan(0);
        const gemIds = (await gemsNamed(name)).map((g) => g.id);
        const full = await lookupAction({ mode: 'gem', query: name, maxResults: 30 });
        const exact = full.results.filter((r) => r.name === name);
        expect({ name, order: exact.map((r) => [r.kind, (r as { id: string }).id]) }).toEqual({
          name,
          order: [...gemIds.map((id) => ['gem', id]), ...want.map((w) => ['minion-skill', w.id])],
        });
        // Every gem result comes before every minion skill.
        const kinds = full.results.map((r) => r.kind);
        expect(kinds.lastIndexOf('gem')).toBeLessThan(kinds.indexOf('minion-skill'));
        expect(full.total).toBe(full.results.length);
        const shown = blocks(await okTool({ mode: 'gem', query: name, max_results: 30 })).filter((b) => b.startsWith(`## ${name}\n`));
        expect(shown.map((b) => b.split('\n')[1].startsWith('Kind: minion skill'))).toEqual([...gemIds.map(() => false), ...want.map(() => true)]);
        for (const [i, w] of want.entries()) {
          const block = shown[gemIds.length + i].split('\n');
          expect({ name, castBy: block.filter((l) => l.startsWith('Cast by: ')) }).toEqual({ name, castBy: w.castBy });
          expect(block.includes('Commanded: yes')).toBe(w.commanded);
        }
        // Cut to max_results 1: the gem alone, and the total still counts the minion skills.
        const one = await lookupAction({ mode: 'gem', query: name, maxResults: 1 });
        expect(one.results.map((r) => r.kind)).toEqual(['gem']);
        expect(one.total).toBe(full.total);
      }

      // A tier-0 ascendancy gem is still a gem: "Navira, the Last Mirage", no minion skill of that name.
      const navira = await lookupAction({ mode: 'gem', query: 'Navira, the Last Mirage' });
      expect(navira.results.map((r) => r.kind)).toEqual(['gem']);
      expect((navira.results[0] as LookupGem).tier).toBe(0);
      const naviraText = gemBlockOf(await okTool({ mode: 'gem', query: 'Navira, the Last Mirage' }), 'Navira, the Last Mirage');
      expect(lineWith(naviraText, 'Kind: ')).toMatch(/^active\b/);
      expect(lineWith(naviraText, 'Tier: ')).toBe('0');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K71 (D-379, the sweep): every minion child a gem result names under "Hit-making children" is found by its own name as a minion skill whose casters include that minion and that gem',
    async () => {
      const found = new Map<string, LookupMinionSkill[]>();
      let checked = 0;
      for (const gem of (await sweep()).values()) {
        for (const child of gem.children) {
          if (child.kind !== 'minion') continue;
          if (!found.has(child.name)) {
            const r = await lookupAction({ mode: 'gem', query: child.name, maxResults: 30 });
            found.set(child.name, r.results.filter((x) => x.kind === 'minion-skill' && x.name === child.name) as LookupMinionSkill[]);
          }
          const casters = found.get(child.name)!.flatMap((s) => s.castBy.map((c) => `${c.minion} / ${c.gem}`));
          expect({ child: child.name, by: `${child.minion} / ${gem.name}`, found: casters.includes(`${child.minion} / ${gem.name}`) }).toEqual({
            child: child.name,
            by: `${child.minion} / ${gem.name}`,
            found: true,
          });
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(20);
      expect(found.size).toBeGreaterThan(10);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-K65 (stat sets named): mechanic gem hits name the stat set's number (Blood Hunt's Explosion, Wing Blast's Shockwave, Bloodhound's Mark's Blood Explosion, and the unnamed effects of Charged Mark and Voltaic Barrier by their label); every stat-set hit for Explosion names a stat set whose lines hold it",
    async () => {
      const hits = async (query: string) => hitLines(await okTool({ mode: 'mechanic', query, kind: 'gem', max_results: 30 }));
      expect(await hits('Consumed Blood Loss')).toContain('[gem] Blood Hunt (stat set 2: Explosion): Enemies lose Life equal to 25% of Consumed Blood Loss');
      expect(await hits('originating from a Unique enemy')).toContain(
        '[gem] Wing Blast (stat set 2: Shockwave): 50% more damage with Hits for Shockwaves originating from a Unique enemy',
      );
      expect(await hits('Heavy Stun buildup caused by Blood Loss')).toContain(
        "[gem] Bloodhound's Mark / Blood Explosion (stat set 1: Blood Explosion): Gains up to 100% more damage and 100% more area of effect based on the percentage of target's Heavy Stun buildup caused by Blood Loss",
      );
      // An unnamed effect is named by its first stat set's label, as its `Also grants:` line names it.
      const unnamed = await luaQuery<Array<{ gem: string; label: string; line: string }>>(`${RULE_LUA}
        local out = {}
        for _, gemName in ipairs({ 'Charged Mark', 'Voltaic Barrier' }) do
          local gem = gemNamed(gemName)
          local e = gem.additionalGrantedEffects[1]
          local ss = e.statSets[1]
          local lines = data.describeStats(calcLib.buildSkillInstanceStats({ level = gem.naturalMaxLevel, quality = 0 }, e, ss), ss.statDescriptionScope) or {}
          table.insert(out, { gem = gemName, label = ss.label, line = lines[1] and oneLine(lines[1]) or '' })
        end
        return out`);
      for (const u of unnamed) {
        expect(u.line).not.toBe('');
        const all = await lookupAction({ mode: 'mechanic', query: u.line, kind: 'gem', maxResults: 100000 });
        expect((all.results as LookupHit[]).map(renderHit)).toContain(`[gem] ${u.gem} / ${u.label} (stat set 1: ${u.label}): ${u.line}`);
      }

      const full = await lookupAction({ mode: 'mechanic', query: 'Explosion', kind: 'gem', maxResults: 100000 });
      const named = (full.results as LookupHit[])
        .map((h) => ({ h, m: /^(.*?)(?: \/ (.*))? \(stat set (\d+): (.*)\)$/.exec(h.source) }))
        .filter((x) => x.m !== null);
      expect(named.length).toBeGreaterThan(10);
      const checks = named.map(({ h, m }) => ({ id: h.id, gem: m![1], effect: m![2] ?? null, index: Number(m![3]), label: m![4], line: h.line }));
      const verdicts = await luaQuery<boolean[]>(`${RULE_LUA}
        local checks = require('dkjson').decode([==[${JSON.stringify(checks)}]==])
        local function defaultLevel(gem)
          local ge, natural = gem.grantedEffect, tonumber(gem.naturalMaxLevel) or 1
          if ge.levels[natural] then return natural end
          local best
          for l in pairs(ge.levels) do if type(l) == 'number' and l <= natural and (not best or l > best) then best = l end end
          if best then return best end
          for l in pairs(ge.levels) do if type(l) == 'number' and (not best or l < best) then best = l end end
          return best
        end
        local out = {}
        for i, c in ipairs(checks) do
          local gem = data.gems[c.id]
          local effect
          if c.effect == nil then effect = gem.grantedEffect else
            for j, e in ipairs(gem.additionalGrantedEffects or {}) do
              local name = effectName(e, j + 1)
              if name == c.effect then effect = e end
            end
          end
          local ok = false
          local ss = effect and effect.statSets and effect.statSets[c.index]
          if ss and gem.name == c.gem then
            local label = (type(ss.label) == 'string' and ss.label ~= '') and ss.label or ((effect.name ~= '' and effect.name) or ('Stat set ' .. c.index))
            if label == c.label then
              local stats = calcLib.buildSkillInstanceStats({ level = defaultLevel(gem), quality = 0 }, effect, ss)
              for _, line in ipairs(data.describeStats(stats, ss.statDescriptionScope) or {}) do
                if oneLine(line) == c.line then ok = true end
              end
            end
          end
          out[i] = ok
        end
        return out`);
      expect(checks.filter((_, i) => !verdicts[i])).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );
});
