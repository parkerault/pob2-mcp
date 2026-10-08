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
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { TOOL_META } from '../../src/server/toolMeta';
import type { LookupGameDataResult, LookupHit } from '../../src/engine/schemas';
import { renderHit } from '../../src/handlers/lookupHandlers';

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

engineDescribe('K1: lookup_game_data on the golden build (WU-31, C-37)', () => {
  let f: SessionFixture;

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:lookup-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
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
    for id, g in pairs(data.gems) do
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
        for id, g in pairs(data.gems) do
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
        for id, g in pairs(data.gems) do
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
    'C-37 gem_level (review fix): a returned gem without that level is shown at its default level with a note; it is an error only when no returned gem has it',
    async () => {
      const text = await okTool({ mode: 'gem', query: 'Blood', gem_level: 20, max_results: 30 });
      const gems = blocks(text).map(parseGem);
      const pob = await luaQuery<Record<string, { has: boolean; default: number }>>(`
        local out = {}
        for _, g in pairs(data.gems) do
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
          for id, g in pairs(data.gems) do
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
      expect(full.kinds).toEqual({ gem: count('gem'), unique: count('unique'), passive: count('passive'), mod: count('mod') });
      expect(count('unique')).toBeGreaterThan(0);
      const header = `${all.length} hits: ${count('gem')} gem, ${count('unique')} unique, ${count('passive')} passive, ${count('mod')} mod.`;

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
    const rank: Record<string, number> = { gem: 1, unique: 2, passive: 3, mod: 4 };
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
});
