/**
 * AC-P75 (WU-100; amendment 9 §24.2's C-43a and C-37a…C-37d, D-425): the researchers' lookups without a build.
 *
 * In process and engine-required, with no build loaded: the server starts over an empty builds folder and no test
 * loads one, so every call runs on the engine's own new build. Expected values come from PoB and the pinned tree,
 * never from the tool's earlier output:
 * - the tree distance: the pinned `TreeData/<version>/tree.json` read here (its `classesStart` names the starts), and
 *   `TreeService.findShortestPaths` with the start (or node) as the only allocated node, as C-43a defines it; "today's
 *   output" is the `search_nodes` action's reply rendered in the format the tool had before C-43a;
 * - gem levels: `__test_eval` reads `grantedEffect.levels[n]` and `data.costs` (PoB's resource strings and divisors);
 * - bases: `data.itemBases` (hidden bases left out, as `data.itemBaseLists` leaves them);
 * - config options: `Modules/ConfigOptions` as PoB loads it;
 * - constants: `data.gameConstants`, `data.characterConstants` and `data.monsterConstants`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { TreeService } from '../../src/services/treeService';
import type { BuildService } from '../../src/services/buildService';
import type { ActionReply, LookupHit } from '../../src/engine/schemas';
import { renderHit } from '../../src/handlers/lookupHandlers';

const ENGINE_TIMEOUT = 240_000;
const REPO = path.resolve(__dirname, '..', '..');
const TREE_DATA = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'TreeData');

/** One hit of a `search_tree_nodes` text: its id, whether it names an ascendancy, and its distance line. */
interface Hit {
  id: number;
  name: string;
  ascendancy?: string;
  distance?: string;
}

/** The hits of a `search_tree_nodes` text, in output order. */
function hits(text: string): Hit[] {
  const out: Hit[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const head = /^\*\*(.+)\*\*(?: \[[A-Z]+\])?(?: \[ALLOCATED\])?$/.exec(lines[i]);
    if (!head) continue;
    const id = /^ {2}Node ID: (\d+)$/.exec(lines[i + 1] ?? '');
    if (!id) throw new Error(`no node id after ${lines[i]}`);
    const hit: Hit = { id: Number(id[1]), name: head[1] };
    for (let j = i + 2; j < lines.length && lines[j].startsWith('  ') && !lines[j].startsWith('  Stats:'); j++) {
      const asc = /^ {2}Ascendancy: (.+)$/.exec(lines[j]);
      if (asc) hit.ascendancy = asc[1];
      const dist = /^ {2}Distance: (.+)$/.exec(lines[j]);
      if (dist) hit.distance = dist[1];
    }
    out.push(hit);
  }
  return out;
}

/** `search_tree_nodes`' text as it was before C-43a (luaHandlers.ts at 9af0916), from the `search_nodes` reply. */
function todaysText(args: { query?: string; ascendancy?: string; node_type?: string }, results: ActionReply<'search_nodes'>['results']): string {
  const lines: string[] = ['=== Passive Tree Node Search ===', ''];
  if (args.query) lines.push(`Searching for: "${args.query}"`);
  if (args.ascendancy) lines.push(`Ascendancy: ${args.ascendancy}`);
  if (args.node_type) lines.push(`Node type filter: ${args.node_type}`);
  lines.push('');
  if (!results.nodes || results.nodes.length === 0) {
    lines.push('No matching nodes found.', '', 'Tips:', '- Try a shorter or more general keyword', '- Check spelling', '- Remove the node type filter to see more results');
    return lines.join('\n');
  }
  const total = results.total ?? results.count;
  let countLine = `Found ${total} matching node${total === 1 ? '' : 's'}`;
  if (total > results.nodes.length) countLine += ` (showing the first ${results.nodes.length}, sorted by type, then name)`;
  lines.push(`${countLine}:`, '');
  for (const node of results.nodes) {
    lines.push(`**${node.name}**${node.type !== 'normal' ? ` [${node.type.toUpperCase()}]` : ''}${node.allocated ? ' [ALLOCATED]' : ''}`);
    lines.push(`  Node ID: ${node.id}`);
    if (node.ascendancyName) lines.push(`  Ascendancy: ${node.ascendancyName}`);
    if (node.stats && node.stats.length > 0) {
      lines.push('  Stats:');
      for (const stat of node.stats.slice(0, 3)) lines.push(`    - ${stat}`);
      if (node.stats.length > 3) lines.push(`    - ... and ${node.stats.length - 3} more`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** The `## ` blocks of a lookup's text. */
function blocks(text: string): string[] {
  return text.split(/^## /m).slice(1).map((b) => `## ${b}`.trimEnd());
}

/** PoB's colour codes removed, as PoB's StripEscapes removes them. */
const stripEscapes = (s: string) => s.replace(/\^x[0-9A-Fa-f]{6}/g, '').replace(/\^[0-9]/g, '');

engineDescribe('AC-P75 (WU-100, D-425): the researchers\' lookups with no build loaded', () => {
  let f: SessionFixture;
  let treeService: TreeService;
  let treeVersion: string;
  let rawTree: { nodes: Record<string, { classesStart?: string[]; ascendancyName?: string; name?: string }> };

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:researcher-lookups-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function searchAction(params: Record<string, unknown>): Promise<ActionReply<'search_nodes'>['results']> {
    const { value } = await f.session.run({ tool: 'test:researcher-lookups-search', kind: 'read' }, async (ctx) => ctx.client.searchNodes(params as never));
    return value;
  }

  async function ok(tool: string, args: Record<string, unknown>): Promise<string> {
    const out = await f.call(tool, args);
    expect({ tool, args, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, args, isError: false, text: '' });
    return out.text;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true, files: {} });
    treeService = new TreeService({} as BuildService, {});
    // The engine's tree, read with no build loaded (the builds folder is empty, and nothing loads one): its new
    // build's tree version.
    treeVersion = await luaQuery<string>('return build.spec.treeVersion');
    expect(f.session.loaded?.path ?? null).toBeNull();
    rawTree = JSON.parse(fs.readFileSync(path.join(TREE_DATA, treeVersion, 'tree.json'), 'utf8'));
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  describe('C-43a: search_tree_nodes with `from`', () => {
    it(
      'AC-P75: from "Warrior" gives each main-tree hit the distance findShortestPaths gives from node 47175, and an ascendancy hit none',
      async () => {
        // Node 47175 is the start whose classesStart names Warrior (the pinned tree).
        expect(rawTree.nodes['47175'].classesStart).toContain('Warrior');
        const treeData = await treeService.getTreeData(treeVersion);
        const text = await ok('search_tree_nodes', { query: 'Life', limit: 30, from: 'Warrior' });
        const shown = hits(text);
        expect(shown).toHaveLength(30);
        let main = 0;
        for (const hit of shown) {
          const node = rawTree.nodes[String(hit.id)];
          let want: string;
          if (node.ascendancyName !== undefined) {
            want = 'none';
          } else {
            main += 1;
            const paths = treeService.findShortestPaths(new Set(['47175']), String(hit.id), treeData);
            want = paths.length > 0 ? `${paths[0].cost} points from Warrior` : 'none';
          }
          expect({ id: hit.id, distance: hit.distance }).toEqual({ id: hit.id, distance: want });
        }
        expect(main).toBeGreaterThan(0);
        expect(shown.some((h) => /^\d+ points from Warrior$/.test(h.distance ?? ''))).toBe(true);

        // The tree's legacy name for the same start gives the same points.
        const legacy = hits(await ok('search_tree_nodes', { query: 'Life', limit: 30, from: 'Marauder' }));
        expect(legacy.map((h) => [h.id, h.distance?.replace(/ from Marauder$/, '')])).toEqual(shown.map((h) => [h.id, h.distance?.replace(/ from Warrior$/, '')]));
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P75: from an ascendancy measures from its class\'s start; every hit of {ascendancy:"Titan"} shows Distance: none',
      async () => {
        const fromTitan = hits(await ok('search_tree_nodes', { query: 'Life', limit: 30, from: 'Titan' }));
        const fromWarrior = hits(await ok('search_tree_nodes', { query: 'Life', limit: 30, from: 'Warrior' }));
        expect(fromTitan.map((h) => [h.id, h.distance?.replace(/ from Titan$/, '')])).toEqual(fromWarrior.map((h) => [h.id, h.distance?.replace(/ from Warrior$/, '')]));

        const titan = Object.entries(rawTree.nodes).filter(([, n]) => n.ascendancyName === 'Titan').map(([id]) => Number(id));
        const shown = hits(await ok('search_tree_nodes', { ascendancy: 'Titan', from: 'Warrior', limit: 30 }));
        expect(shown.map((h) => h.id).sort((a, b) => a - b)).toEqual(titan.sort((a, b) => a - b));
        expect(shown.every((h) => h.ascendancy === 'Titan' && h.distance === 'none')).toBe(true);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P75: from a node id gives distances from that node (0 to itself), and its exact name gives the same',
      async () => {
        const heavy = Object.entries(rawTree.nodes).filter(([, n]) => n.name === 'Heavy Buffer').map(([id]) => id);
        expect(heavy).toHaveLength(1);
        const from = heavy[0];
        const treeData = await treeService.getTreeData(treeVersion);
        const shown = hits(await ok('search_tree_nodes', { query: 'Energy Shield', limit: 30, from }));
        expect(shown.length).toBeGreaterThan(5);
        for (const hit of shown) {
          const node = rawTree.nodes[String(hit.id)];
          const paths = node.ascendancyName !== undefined ? [] : treeService.findShortestPaths(new Set([from]), String(hit.id), treeData);
          const want = paths.length > 0 ? `${paths[0].cost} points from ${from}` : 'none';
          expect({ id: hit.id, distance: hit.distance }).toEqual({ id: hit.id, distance: want });
        }
        const self = hits(await ok('search_tree_nodes', { query: 'Heavy Buffer', from }));
        expect(self).toEqual([{ id: Number(from), name: 'Heavy Buffer', distance: `0 points from ${from}` }]);

        const byName = hits(await ok('search_tree_nodes', { query: 'Energy Shield', limit: 30, from: 'Heavy Buffer' }));
        expect(byName.map((h) => [h.id, h.distance?.replace(/ from Heavy Buffer$/, '')])).toEqual(shown.map((h) => [h.id, h.distance?.replace(new RegExp(` from ${from}$`), '')]));
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P75: from "Nobody" fails and lists the class names the tree\'s starts carry',
      async () => {
        const classNames = [...new Set(Object.values(rawTree.nodes).flatMap((n) => n.classesStart ?? []))].sort();
        expect(classNames).toEqual(expect.arrayContaining(['Warrior', 'Sorceress', 'Monk', 'Huntress', 'Mercenary', 'Druid', 'Witch', 'Ranger']));
        const out = await f.call('search_tree_nodes', { query: 'Life', from: 'Nobody' });
        expect(out.isError).toBe(true);
        expect(out.text).toContain('"Nobody"');
        expect(out.text).toContain(`valid class names: ${classNames.join(', ')}`);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P75: with no from, the output equals today\'s: the search_nodes reply in the pre-C-43a format, and the from output less its distance lines',
      async () => {
        const cases: Array<{ query?: string; ascendancy?: string; node_type?: string; limit?: number }> = [
          { query: 'Life', limit: 30 },
          { query: 'Life', node_type: 'keystone' },
          { ascendancy: 'Titan' },
          { query: 'Heavy Buffer' },
          { query: 'zzzz no such node' },
        ];
        for (const args of cases) {
          const text = await ok('search_tree_nodes', args);
          expect(text).not.toMatch(/Distance/);
          const reply = await searchAction({
            ...(args.query ? { keyword: args.query } : {}),
            ...(args.ascendancy ? { ascendancy: args.ascendancy } : {}),
            nodeType: args.node_type,
            maxResults: Math.min(args.limit || 20, 30),
          });
          expect({ args, text }).toEqual({ args, text: todaysText(args, reply) });

          const withFrom = await ok('search_tree_nodes', { ...args, from: 'Warrior' });
          const stripped = withFrom
            .split('\n')
            .filter((l) => !l.startsWith('Distances from Warrior (') && !/^ {2}Distance: /.test(l))
            .join('\n');
          expect({ args, stripped }).toEqual({ args, stripped: text });
        }
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('C-37a: gem mode prints each level\'s cost, Spirit, cooldown and stored uses, and a support\'s multipliers', () => {
    interface Level {
      cost?: Record<string, number>;
      spirit?: number;
      cooldown?: number;
      storedUses?: number;
      manaMultiplier?: number;
      reservationMultiplier?: number;
    }

    /** Each named gem's levels 1..naturalMaxLevel as PoB holds them, PoB's data.costs, and the gem's kind. */
    async function pobLevels(name: string): Promise<{ support: boolean; maxLevel: number; levels: Level[]; costs: Array<{ resource: string; text: string; divisor: number }> }> {
      return luaQuery(`
        local gem
        for _, g in pairs(data.gems) do
          if g.name == ${JSON.stringify(name)} and g.grantedEffect and (not gem) then gem = g end
        end
        local ge = gem.grantedEffect
        local levels = {}
        for l = 1, gem.naturalMaxLevel do
          local lv = ge.levels[l] or {}
          local cost
          if type(lv.cost) == 'table' then
            cost = {}
            for k, v in pairs(lv.cost) do cost[k] = v end
          end
          levels[l] = { cost = cost, spirit = lv.spiritReservationFlat, cooldown = lv.cooldown, storedUses = lv.storedUses,
            manaMultiplier = lv.manaMultiplier, reservationMultiplier = lv.reservationMultiplier }
        end
        local costs = {}
        for _, c in ipairs(data.costs) do
          table.insert(costs, { resource = c.Resource, text = c.ResourceString, divisor = c.Divisor })
        end
        return { support = ge.support == true, maxLevel = gem.naturalMaxLevel, levels = levels, costs = costs }`);
    }

    /** The level's row as C-37a words it, from PoB's raw values (a cost per PoB's tooltip: value ÷ divisor, 2 places). */
    function expectedRow(level: Level, support: boolean, costs: Array<{ resource: string; text: string; divisor: number }>): string {
      const parts: string[] = [];
      const costTexts = costs
        .filter((c) => level.cost && typeof level.cost[c.resource] === 'number')
        .map((c) => c.text.replace('{0}', String(Math.round((level.cost![c.resource] / c.divisor) * 100) / 100)).trim());
      expect(Object.keys(level.cost ?? {}).length).toBe(costTexts.length);
      if (costTexts.length > 0) parts.push(`Cost ${costTexts.join(', ')}`);
      if (level.spirit !== undefined) parts.push(`${support ? 'Additional Spirit' : 'Spirit'} ${level.spirit}`);
      if (level.cooldown !== undefined) {
        parts.push(`Cooldown ${level.cooldown} s${level.storedUses !== undefined ? ` (${level.storedUses} ${level.storedUses === 1 ? 'use' : 'uses'})` : ''}`);
      } else if (level.storedUses !== undefined) {
        parts.push(`Stored uses ${level.storedUses}`);
      }
      if (level.manaMultiplier !== undefined) parts.push(`Cost multiplier ${100 + level.manaMultiplier}%`);
      if (level.reservationMultiplier !== undefined) parts.push(`Reservation multiplier ${100 + level.reservationMultiplier}%`);
      return parts.length > 0 ? parts.join('; ') : '(none)';
    }

    /** The tool's per-level rows, one entry per gem level (a row `a–b` expanded). */
    function shownRows(text: string): Map<number, string> {
      const lines = text.split('\n');
      const at = lines.findIndex((l) => l.startsWith('Cost, Spirit and cooldown by gem level'));
      expect(at).toBeGreaterThan(0);
      const out = new Map<number, string>();
      for (const line of lines.slice(at + 1)) {
        const m = /^ {2}(\d+)(?:–(\d+))?: (.+)$/.exec(line);
        if (!m) break;
        for (let l = Number(m[1]); l <= Number(m[2] ?? m[1]); l++) out.set(l, m[3]);
      }
      return out;
    }

    const GEMS: Array<{ name: string; holds: Array<keyof Level> }> = [
      { name: 'Leap Slam', holds: ['cost'] },
      { name: 'Herald of Ash', holds: ['spirit'] },
      { name: 'Flameblast', holds: ['cost', 'cooldown', 'storedUses'] },
      { name: 'Precision I', holds: ['spirit'] },
      { name: 'Heightened Curse', holds: ['manaMultiplier', 'reservationMultiplier'] },
    ];

    for (const { name, holds } of GEMS) {
      it(
        `AC-P75: ${name}: every gem level's row equals PoB's levels[n] (${holds.join(', ')})`,
        async () => {
          const pob = await pobLevels(name);
          expect(pob.levels).toHaveLength(pob.maxLevel);
          for (const key of holds) expect({ name, key, held: pob.levels.every((l) => l[key] !== undefined) }).toEqual({ name, key, held: true });
          const text = await ok('lookup_game_data', { mode: 'gem', query: name, max_results: 1 });
          const block = blocks(text).find((b) => b.startsWith(`## ${name}\n`));
          expect(block).toBeDefined();
          const rows = shownRows(block!);
          expect([...rows.keys()]).toEqual(pob.levels.map((_, i) => i + 1));
          for (let l = 1; l <= pob.maxLevel; l++) {
            expect({ name, level: l, row: rows.get(l) }).toEqual({ name, level: l, row: expectedRow(pob.levels[l - 1], pob.support, pob.costs) });
          }
          if (pob.support) expect(block!).toMatch(/^Kind: support/m);
        },
        ENGINE_TIMEOUT,
      );
    }

    it(
      'AC-P75: a per-minute cost is shown per second, PoB\'s tooltip form, and Flameblast\'s level-1 row reads it',
      async () => {
        const pob = await pobLevels('Flameblast');
        const perMinute = pob.levels[0].cost?.ManaPerMinute;
        expect(typeof perMinute).toBe('number');
        const text = await ok('lookup_game_data', { mode: 'gem', query: 'Flameblast', max_results: 1 });
        expect(shownRows(text).get(1)).toContain(`Cost ${Math.round((perMinute! / 60) * 100) / 100} Mana per second`);
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('C-37b: mode base', () => {
    interface PobBase {
      name: string;
      type: string;
      level: number;
      str?: number;
      dex?: number;
      int?: number;
      implicit?: string;
      armour?: Record<string, number>;
    }

    async function pobBases(type: string): Promise<PobBase[]> {
      return luaQuery(`
        local out = {}
        for name, base in pairs(data.itemBases) do
          if base.type == ${JSON.stringify(type)} and not base.hidden then
            local req = base.req or {}
            table.insert(out, { name = name, type = base.type, level = req.level or 0, str = req.str, dex = req.dex, int = req.int,
              implicit = base.implicit, armour = base.armour })
          end
        end
        return out`);
    }

    /** PoB's order for the bases: required level, highest first, then by name. */
    const byLevel = (a: PobBase, b: PobBase) => b.level - a.level || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

    function requirementText(b: PobBase): string {
      const bits: string[] = [];
      if (b.level > 0) bits.push(`level ${b.level}`);
      if (b.str) bits.push(`${b.str} Str`);
      if (b.dex) bits.push(`${b.dex} Dex`);
      if (b.int) bits.push(`${b.int} Int`);
      return `Requires: ${bits.length > 0 ? bits.join(', ') : 'none'}`;
    }

    it(
      'AC-P75: {slot:"Wand"} lists the wand bases with their implicits and required levels, highest first; `level` filters them',
      async () => {
        const wands = (await pobBases('Wand')).sort(byLevel);
        expect(wands.length).toBeGreaterThan(5);
        expect(wands.length).toBeLessThanOrEqual(30);
        const text = await ok('lookup_game_data', { mode: 'base', slot: 'Wand', max_results: 30 });
        const shown = blocks(text);
        expect(shown.map((b) => b.split('\n')[0])).toEqual(wands.map((w) => `## ${w.name}`));
        for (const [i, w] of wands.entries()) {
          const lines = shown[i].split('\n');
          expect(lines).toContain('Type: Wand');
          expect(lines).toContain(requirementText(w));
          const implicits = lines.filter((l) => l.startsWith('Implicit: ')).map((l) => l.slice('Implicit: '.length));
          expect({ name: w.name, implicits }).toEqual({ name: w.name, implicits: w.implicit ? w.implicit.split('\n').filter(Boolean) : ['(none)'] });
        }

        const level = 20;
        const low = wands.filter((w) => w.level <= level);
        expect(low.length).toBeGreaterThan(0);
        expect(low.length).toBeLessThan(wands.length);
        const filtered = await ok('lookup_game_data', { mode: 'base', slot: 'wand', level, max_results: 30 });
        expect(blocks(filtered).map((b) => b.split('\n')[0])).toEqual(low.map((w) => `## ${w.name}`));
        expect(filtered).toContain(`item type Wand, required level at most ${level}`);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P75: an armour base\'s defences equal PoB\'s (body armours and shields, the highest 30 of each)',
      async () => {
        for (const type of ['Body Armour', 'Shield']) {
          const bases = (await pobBases(type)).sort(byLevel).slice(0, 30);
          const shown = blocks(await ok('lookup_game_data', { mode: 'base', slot: type, max_results: 30 }));
          expect(shown.map((b) => b.split('\n')[0])).toEqual(bases.map((b) => `## ${b.name}`));
          let withBlock = 0;
          for (const [i, b] of bases.entries()) {
            const a = b.armour ?? {};
            const bits: string[] = [];
            if (a.Armour) bits.push(`Armour ${a.Armour}`);
            if (a.Evasion) bits.push(`Evasion ${a.Evasion}`);
            if (a.EnergyShield) bits.push(`Energy Shield ${a.EnergyShield}`);
            if (a.Ward) bits.push(`Ward ${a.Ward}`);
            if (a.BlockChance) bits.push(`Block ${a.BlockChance}%`);
            if (a.MovementPenalty) bits.push(`Movement penalty ${Math.round(a.MovementPenalty * 10000) / 100}%`);
            if (a.BlockChance) withBlock += 1;
            const defences = shown[i].split('\n').find((l) => l.startsWith('Defences: '));
            expect({ name: b.name, defences }).toEqual({ name: b.name, defences: bits.length > 0 ? `Defences: ${bits.join(', ')}` : undefined });
          }
          if (type === 'Shield') expect(withBlock).toBeGreaterThan(0);
        }
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P75: an unknown slot fails and lists PoB\'s item types that have bases',
      async () => {
        const types = await luaQuery<string[]>(`
          local seen, out = {}, {}
          for _, list in pairs(data.itemBaseLists) do
            for _, entry in ipairs(list) do
              if not seen[entry.base.type] then seen[entry.base.type] = true table.insert(out, entry.base.type) end
            end
          end
          table.sort(out)
          return out`);
        expect(types).toContain('Wand');
        const out = await f.call('lookup_game_data', { mode: 'base', slot: 'Nonsense' });
        expect(out.isError).toBe(true);
        expect(out.text).toContain(`unknown slot "Nonsense"; valid item types: ${types.join(', ')}`);
        const missing = await f.call('lookup_game_data', { mode: 'base', query: 'Wand' });
        expect(missing.isError).toBe(true);
        expect(missing.text).toMatch(/base mode needs a slot/);
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('C-37c: mode config, and get_config\'s labels', () => {
    async function pobOption(key: string): Promise<{ label: string; type: string; list?: Array<{ val: string; label: string }> }> {
      return luaQuery(`
        for _, o in ipairs(LoadModule('Modules/ConfigOptions')) do
          if o.var == ${JSON.stringify(key)} then
            local list
            if o.list then
              list = {}
              for _, item in ipairs(o.list) do table.insert(list, { val = tostring(item.val), label = item.label }) end
            end
            return { label = o.label, type = o.type, list = list }
          end
        end`);
    }

    it(
      'AC-P75: {mode:"config", query:"Ailment calculation"} finds ailmentMode by words of its label and prints its key, type and list labels',
      async () => {
        const query = 'Ailment calculation';
        const pob = await pobOption('ailmentMode');
        expect(stripEscapes(pob.label).toLowerCase()).toContain(query.toLowerCase());
        expect('ailmentmode').not.toContain(query.toLowerCase());
        expect(pob.type).toBe('list');
        expect(pob.list!.length).toBeGreaterThan(1);
        const text = await ok('lookup_game_data', { mode: 'config', query });
        const block = blocks(text).find((b) => b.startsWith('## ailmentMode\n'));
        expect(block).toBeDefined();
        const lines = block!.split('\n');
        expect(lines).toContain(`Label: ${stripEscapes(pob.label)}`);
        expect(lines.find((l) => l.startsWith('Type: '))).toMatch(new RegExp(`^Type: ${pob.type}; `));
        expect(lines).toContain(`Values: ${pob.list!.map((v) => (v.label !== v.val ? `${v.val} (${stripEscapes(v.label)})` : v.val)).join('; ')}`);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P75: config mode prints the condition that shows an option and its tooltip\'s first line (bannerPlanted, enemyIsBoss)',
      async () => {
        const banner = await luaQuery<{ ifSkill: string[] }>(`
          for _, o in ipairs(LoadModule('Modules/ConfigOptions')) do
            if o.var == 'bannerPlanted' then return { ifSkill = o.ifSkill } end
          end`);
        const text = await ok('lookup_game_data', { mode: 'config', query: 'bannerPlanted' });
        expect(blocks(text)[0].split('\n')).toContain(`Shown when: ifSkill ${banner.ifSkill.join(' or ')}`);

        const boss = await luaQuery<{ tooltip: string }>(`
          for _, o in ipairs(LoadModule('Modules/ConfigOptions')) do
            if o.var == 'enemyIsBoss' then return { tooltip = o.tooltip } end
          end`);
        const bossText = await ok('lookup_game_data', { mode: 'config', query: 'enemyIsBoss' });
        expect(blocks(bossText)[0].split('\n')).toContain(`Tooltip: ${stripEscapes(boss.tooltip).split('\n')[0].trim()}`);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-P75 (C-37c): get_config prints each option\'s label after its value, `key: value — label`',
      async () => {
        const labels = await luaQuery<Array<{ key: string; label?: string }>>(`
          local out, seen = {}, {}
          for _, o in ipairs(LoadModule('Modules/ConfigOptions')) do
            if o.var and not seen[o.var] then
              seen[o.var] = true
              table.insert(out, { key = o.var, label = type(o.label) == 'string' and o.label or nil })
            end
          end
          return out`);
        const text = await ok('get_config', {});
        // The option lines: every line under the section headers (some keys hold spaces, `questAct 1…`).
        const all = text.split('\n');
        const first = all.findIndex((l) => /^=== .+ ===$/.test(l) && !l.startsWith('=== Configuration'));
        expect(first).toBeGreaterThan(0);
        const lines = new Map(all.slice(first).filter((l) => l !== '' && !/^=== .+ ===$/.test(l)).map((l) => [l.slice(0, l.indexOf(': ')), l]));
        let labelled = 0;
        for (const { key, label } of labels) {
          const line = lines.get(key);
          expect({ key, shown: line !== undefined }).toEqual({ key, shown: true });
          const want = label ? stripEscapes(label).trim() : '';
          if (want) {
            labelled += 1;
            expect({ key, ends: line!.endsWith(` — ${want}`) }).toEqual({ key, ends: true });
          } else {
            expect({ key, line }).toEqual({ key, line: expect.not.stringContaining(' — ') });
          }
        }
        expect(labelled).toBeGreaterThan(100);
        expect(lines.get('conditionLowLife')).toBe('conditionLowLife: false (default) — Are you always on Low Life?');
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('C-37d: mechanic kind constant', () => {
    it(
      'AC-P75: kind "constant" finds BaseMaximumRage with its value in data.gameConstants; constants rank after every other kind',
      async () => {
        const value = await luaQuery<number>('return data.gameConstants.BaseMaximumRage');
        expect(typeof value).toBe('number');
        const text = await ok('lookup_game_data', { mode: 'mechanic', query: 'BaseMaximumRage', kind: 'constant' });
        expect(text.split('\n')).toContain(`[constant] game: BaseMaximumRage = ${value}`);

        // Each table's matches, and the order: every constant hit after every other kind's.
        const tables = await luaQuery<Array<{ table: string; name: string; value: number }>>(`
          local out = {}
          for tableName, key in pairs({ game = 'gameConstants', character = 'characterConstants', monster = 'monsterConstants' }) do
            for name, v in pairs(data[key]) do
              if tostring(name):lower():find('resist', 1, true) then table.insert(out, { table = tableName, name = tostring(name), value = v }) end
            end
          end
          return out`);
        expect(tables.length).toBeGreaterThan(0);
        const { value: full } = await f.session.run({ tool: 'test:researcher-lookups-mechanic', kind: 'read' }, async (ctx) =>
          ctx.client.lookupGameData({ mode: 'mechanic', query: 'resist', maxResults: 100000 }),
        );
        const all = full.results as LookupHit[];
        const firstConstant = all.findIndex((h) => h.kind === 'constant');
        expect(firstConstant).toBeGreaterThan(0);
        expect(all.slice(firstConstant).every((h) => h.kind === 'constant')).toBe(true);
        const constantLines = all.slice(firstConstant).map(renderHit).sort();
        expect(constantLines).toEqual(tables.map((t) => `[constant] ${t.table}: ${t.name} = ${t.value}`).sort());
        expect(full.kinds?.constant).toBe(tables.length);
      },
      ENGINE_TIMEOUT,
    );
  });
});
