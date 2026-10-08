/**
 * C-43 (WU-31): `search_tree_nodes`' ascendancy filter, its `'any'` fix and its sort before the cap.
 * In process and engine-required, on the golden build (a Gemling Legionnaire).
 *
 * The real server runs in process (`startSessionFixture`). Expected values come from PoB: Lua queries
 * (`__test_eval` over `build.spec.tree.nodes`) for the ascendancy's nodes and names, and the
 * `search_nodes` action's full list (`maxResults:100000`, through `session.run`) for the order.
 *
 * AC-K7…AC-K9. The `{query:"Life", limit:5}` sample's engine-kind and hygiene checks (AC-K8's last
 * point) run in `engineKinds.test.ts` and `toolHygiene.test.ts`; the static part below checks the sample.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { TOOL_META } from '../../src/server/toolMeta';
import type { ActionReply } from '../../src/engine/schemas';

const ENGINE_TIMEOUT = 240_000;
const FIXTURES = path.resolve(__dirname, '..', 'fixtures');

interface ShownNode {
  id: number;
  name: string;
  /** The `[TYPE]` tag, lower-cased; `normal` when there is none. */
  type: string;
  ascendancy?: string;
}

/** The nodes of a `search_tree_nodes` text, in output order. */
function shownNodes(text: string): ShownNode[] {
  const out: ShownNode[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const head = /^\*\*(.+)\*\*(?: \[([A-Z]+)\])?(?: \[ALLOCATED\])?$/.exec(lines[i]);
    if (!head) continue;
    const id = /^ {2}Node ID: (\d+)$/.exec(lines[i + 1] ?? '');
    if (!id) throw new Error(`no node id after ${lines[i]}`);
    const asc = /^ {2}Ascendancy: (.+)$/.exec(lines[i + 2] ?? '');
    const tag = head[2] && head[2] !== 'ALLOCATED' ? head[2].toLowerCase() : 'normal';
    out.push({ id: Number(id[1]), name: head[1], type: tag, ...(asc ? { ascendancy: asc[1] } : {}) });
  }
  return out;
}

const TYPE_RANK: Record<string, number> = { keystone: 1, notable: 2, jewel: 3, mastery: 4, ascendancy: 5, normal: 6 };

describe('AC-K8: the search_tree_nodes sample stays in the kind and hygiene checks (static)', () => {
  it('AC-K8: tool-calls.json still has {query:"Life", limit:5} as an ok sample of a read tool', () => {
    const samples = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Array<{
      tool: string;
      args: Record<string, unknown>;
      expect: string;
    }>;
    expect(samples).toContainEqual({ tool: 'search_tree_nodes', args: { query: 'Life', limit: 5 }, expect: 'ok' });
    expect(samples).toContainEqual({ tool: 'search_tree_nodes', args: { ascendancy: 'Gemling Legionnaire' }, expect: 'ok' });
    expect(TOOL_META.search_tree_nodes).toEqual({ engine: 'read', group: 'core' });
  });
});

engineDescribe('C-43: search_tree_nodes on the golden build (WU-31)', () => {
  let f: SessionFixture;

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:search-nodes-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function searchAction(params: Record<string, unknown>): Promise<ActionReply<'search_nodes'>['results']> {
    const { value } = await f.session.run({ tool: 'test:search-nodes-action', kind: 'read' }, async (ctx) => {
      return ctx.client.searchNodes(params as never);
    });
    return value;
  }

  async function search(args: Record<string, unknown>): Promise<ShownNode[]> {
    const out = await f.call('search_tree_nodes', args);
    expect({ args, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ args, isError: false, text: '' });
    return shownNodes(out.text);
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  it(
    'AC-K7: {ascendancy:"Titan"} with no query lists exactly the tree\'s Titan node ids (17 at the pin, 8 notables)',
    async () => {
      const pob = await luaQuery<{ ids: number[]; notables: number[]; class: string }>(`
        local ids, notables = {}, {}
        for id, node in pairs(build.spec.tree.nodes) do
          if node.ascendancyName == "Titan" then
            table.insert(ids, id)
            if node.isNotable then table.insert(notables, id) end
          end
        end
        table.sort(ids)
        table.sort(notables)
        return { ids = ids, notables = notables, class = build.spec.curAscendClassName }`);
      expect(pob.class).toBe('Gemling Legionnaire');
      expect(pob.ids).toHaveLength(17);
      expect(pob.notables).toHaveLength(8);

      const nodes = await search({ ascendancy: 'Titan' });
      expect(nodes.map((n) => n.id).sort((a, b) => a - b)).toEqual(pob.ids);
      expect(nodes.every((n) => n.ascendancy === 'Titan')).toBe(true);
      expect(nodes.filter((n) => n.type === 'notable').map((n) => n.id).sort((a, b) => a - b)).toEqual(pob.notables);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K7: {ascendancy:"Titan", query:"Crushing"} lists Crushing Impacts and only Titan nodes; an unknown ascendancy and {} are errors',
    async () => {
      const titan = new Set(
        await luaQuery<number[]>(`
          local ids = {}
          for id, node in pairs(build.spec.tree.nodes) do
            if node.ascendancyName == "Titan" then table.insert(ids, id) end
          end
          return ids`),
      );
      const nodes = await search({ ascendancy: 'Titan', query: 'Crushing' });
      expect(nodes.map((n) => n.name)).toContain('Crushing Impacts');
      expect(nodes.every((n) => titan.has(n.id))).toBe(true);

      const names = await luaQuery<string[]>(`
        local seen, out = {}, {}
        for _, node in pairs(build.spec.tree.nodes) do
          local name = node.ascendancyName
          if name and not seen[name] then seen[name] = true; table.insert(out, name) end
        end
        table.sort(out)
        return out`);
      expect(names).toEqual(expect.arrayContaining(['Titan', 'Gemling Legionnaire']));
      const unknown = await f.call('search_tree_nodes', { ascendancy: 'Nonesuch' });
      expect(unknown.isError).toBe(true);
      expect(unknown.text).toContain(names.join(', '));

      const empty = await f.call('search_tree_nodes', {});
      expect(empty.isError).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "AC-K8: node_type 'any' returns the same ids in the same order as no node_type ({query:\"Life\", limit:30})",
    async () => {
      const any = await search({ query: 'Life', limit: 30, node_type: 'any' });
      const none = await search({ query: 'Life', limit: 30 });
      expect(any.length).toBe(30);
      expect(any.map((n) => n.id)).toEqual(none.map((n) => n.id));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K8: with keystone, notable or jewel every result has that type, and ascendancy notables still show [NOTABLE]',
    async () => {
      for (const [type, query] of [
        ['keystone', 'Life'],
        ['notable', 'Life'],
        ['jewel', 'Jewel'],
      ] as const) {
        const nodes = await search({ query, node_type: type, limit: 30 });
        expect({ type, some: nodes.length > 0 }).toEqual({ type, some: true });
        expect({ type, types: [...new Set(nodes.map((n) => n.type))] }).toEqual({ type, types: [type] });
      }
      const titanNotables = await search({ ascendancy: 'Titan', node_type: 'notable' });
      expect(titanNotables).toHaveLength(8);
      expect(titanNotables.every((n) => n.type === 'notable' && n.ascendancy === 'Titan')).toBe(true);
      const crushing = await search({ query: 'Crushing Impacts', node_type: 'notable' });
      expect(crushing.find((n) => n.name === 'Crushing Impacts')).toMatchObject({ type: 'notable', ascendancy: 'Titan' });
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-K9: {query:"Life", limit:5} shows the first 5 of search_nodes {keyword:"life", maxResults:100000}, which is ordered by type rank, then name, then id',
    async () => {
      const full = await searchAction({ keyword: 'life', maxResults: 100000 });
      expect(full.nodes.length).toBe(full.count);
      expect(full.total).toBe(full.nodes.length);
      expect(full.nodes.length).toBeGreaterThan(30);
      for (let i = 1; i < full.nodes.length; i++) {
        const a = full.nodes[i - 1];
        const b = full.nodes[i];
        const ka: Array<number | string> = [TYPE_RANK[a.type], a.name, a.id];
        const kb: Array<number | string> = [TYPE_RANK[b.type], b.name, b.id];
        let cmp = 0;
        for (let k = 0; k < ka.length && cmp === 0; k++) cmp = ka[k] < kb[k] ? -1 : ka[k] > kb[k] ? 1 : 0;
        expect({ i, a: ka, b: kb, ordered: cmp < 0 }).toEqual({ i, a: ka, b: kb, ordered: true });
      }

      const shown = await search({ query: 'Life', limit: 5 });
      expect(shown.map((n) => n.id)).toEqual(full.nodes.slice(0, 5).map((n) => n.id));
      expect(shown.map((n) => n.type)).toEqual(full.nodes.slice(0, 5).map((n) => n.type));
    },
    ENGINE_TIMEOUT,
  );
});
