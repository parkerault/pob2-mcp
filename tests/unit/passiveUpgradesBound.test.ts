/**
 * D-246 (C-47 with C-1's 5000-char truncation): `get_passive_upgrades` bounds its own text so no
 * can't-measure line is ever cut. The engine tests (`tests/integration/rankerAmendments.test.ts`) show the
 * golden build's outputs fit; the golden build can't reach the later steps (dropping ranked entries), so
 * this unit check drives the handler with a stub engine whose stat and coverage lines are long enough to
 * need them: stat lines first, then ranked entries from the bottom of the longer ranking, said in one line.
 */
import { describe, expect, it } from '@jest/globals';
import { handleGetPassiveUpgrades } from '../../src/handlers/treeHandlers';
import type { PoBLuaApiClient } from '../../src/pobLuaBridge';

const LONG = (id: number, words: number) => `Line of node ${id}: ${'with a long description '.repeat(words)}end`;

/** A stub engine: 4 keywords x 8 reachable notables, an ascendancy of 8, long lines on every node. */
function stubEngine(opts: { statWords: number; unparsed: number; lineWords: number }) {
  const mainNode = (k: number, i: number) => {
    const id = 1000 + k * 100 + i;
    return { id, name: `Main ${id}`, type: 'notable', allocated: false, stats: [LONG(id, opts.statWords), LONG(id, opts.statWords)], path: [id], pathDist: 1 + (i % 3) };
  };
  const ascNode = (i: number) => {
    const id = 9000 + i;
    return { id, name: `Asc ${id}`, type: 'notable', allocated: false, ascendancyName: 'Testasc', stats: [LONG(id, opts.statWords)], path: [id], pathDist: 1 + (i % 2) };
  };
  const keywordCalls: string[] = [];
  const client = {
    getWarnings: async () => [],
    getStats: async () => ({ _meta: { level: 90 } }),
    getItems: async () => [],
    getTree: async () => ({ ascendClassId: 1, ascendClassName: 'Testasc', nodes: [] }),
    searchNodes: async (params: { keyword?: string; ascendancy?: string }) => {
      if (params.ascendancy) return { nodes: Array.from({ length: 8 }, (_, i) => ascNode(i)), count: 8, total: 8 };
      keywordCalls.push(params.keyword!);
      const k = keywordCalls.length - 1;
      return { nodes: Array.from({ length: 8 }, (_, i) => mainNode(k, i)), count: 8, total: 8 };
    },
    // Every candidate improves both stats, the lower ids more.
    calcWith: async (params: { addNodes?: number[] }) => {
      if (!params.addNodes) return { CombinedDPS: 1000, TotalEHP: 1000 };
      const id = params.addNodes[0];
      return { CombinedDPS: 1000 + 100000 / id, TotalEHP: 1000 + 50000 / id };
    },
    checkCoverage: async (params: { nodes: number[] }) => ({
      counts: {},
      gems: [],
      checked: { items: 0, nodes: params.nodes.length, gems: 0 },
      entries: params.nodes.slice(0, opts.unparsed).map((id) => ({
        kind: 'node', source: `Node ${id}`, nodeId: id, status: 'unparsed', line: LONG(id, opts.lineWords),
      })),
    }),
  };
  return client as unknown as PoBLuaApiClient;
}

function handle(client: PoBLuaApiClient, maxResults: number) {
  return handleGetPassiveUpgrades(
    { getLuaClient: () => client, ensureLuaClient: async () => {}, sourceScan: async () => ({ names: new Set<string>(), templates: [] }) },
    'both',
    maxResults,
    true,
  );
}

async function run(client: PoBLuaApiClient, maxResults: number): Promise<string> {
  return (await handle(client, maxResults)).content[0].text;
}

const ranks = (text: string): number[] => [...text.matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]));

describe('D-246: get_passive_upgrades keeps its whole text within 5000 characters', () => {
  it('a text that fits is left whole, with no note', async () => {
    const text = await run(stubEngine({ statWords: 1, unparsed: 2, lineWords: 1 }), 3);
    expect(text.length).toBeLessThanOrEqual(5000);
    expect(text).not.toContain('Shortened to stay within');
    expect(text).toMatch(/^ {3}- Line of node/m);
  });

  it('stat lines go first: every ranked entry is kept, and one line says the stat lines were left out', async () => {
    const text = await run(stubEngine({ statWords: 6, unparsed: 4, lineWords: 2 }), 10);
    expect(text.length).toBeLessThanOrEqual(5000);
    expect(text).toMatch(/^Shortened to stay within 5000 characters; left out: the ranked entries' stat lines \(search_tree_nodes shows them\)\.$/m);
    expect(text).not.toMatch(/^ {3}- /m);
    expect(ranks(text)).toEqual([...Array.from({ length: 10 }, (_, i) => i + 1), ...Array.from({ length: 8 }, (_, i) => i + 1)]);
  });

  it('then ranked entries from the bottom of the longer ranking; every can\'t-measure line stays whole', async () => {
    const unparsed = 12;
    const text = await run(stubEngine({ statWords: 6, unparsed, lineWords: 7 }), 20);
    expect(text.length).toBeLessThanOrEqual(5000);
    const note = /^Shortened to stay within 5000 characters; left out: (.*)\.$/m.exec(text);
    expect(note).not.toBeNull();
    const mainLeft = /passive-point ranks (\d+)-20/.exec(note![1]);
    expect(mainLeft).not.toBeNull();
    expect(note![1]).toContain("the ranked entries' stat lines (search_tree_nodes shows them); the closing tip; passive-point ranks");
    expect(text).not.toContain('💡');

    // Each ranking keeps its first entries, in order; the longer one loses entries first.
    const main = text.slice(0, text.indexOf('## Ascendancy notables'));
    const asc = text.slice(text.indexOf('## Ascendancy notables'), text.indexOf("## What PoB can't fully measure"));
    const mainShown = ranks(main);
    const ascShown = ranks(asc);
    expect(mainShown).toEqual(mainShown.map((_, i) => i + 1));
    expect(ascShown).toEqual(ascShown.map((_, i) => i + 1));
    expect(mainShown.length).toBe(Number(mainLeft![1]) - 1);
    const ascLeft = /ascendancy ranks (\d+)-8/.exec(note![1]);
    expect(ascShown.length).toBe(ascLeft ? Number(ascLeft[1]) - 1 : 8);
    // The longer ranking loses an entry first, ties going to the passive-point ranking.
    if (ascShown.length < 8) expect([ascShown.length - 1, ascShown.length]).toContain(mainShown.length);
    else expect(mainShown.length).toBeGreaterThanOrEqual(8);
    expect(mainShown.length).toBeGreaterThan(0);

    // The can't-measure section is complete: one whole line per unparsed node.
    const cant = text.slice(text.indexOf("## What PoB can't fully measure"));
    const entries = [...cant.matchAll(/^- \*\*(.+?)\*\* \[(\d+)\].*: not applied: \[unparsed\] (.*)$/gm)];
    expect(entries).toHaveLength(unparsed);
    for (const e of entries) expect(e[3]).toBe(LONG(Number(e[2]), 7));
  });

  it('the closing tip goes before any ranked entry: a text just over the limit without stat lines loses only the tip', async () => {
    // Find a can't-measure size where the text without stat lines is over 5000 but fits without the tip.
    let found: string | null = null;
    for (let unparsed = 1; unparsed <= 32 && !found; unparsed++) {
      for (let words = 1; words <= 12 && !found; words++) {
        const client = stubEngine({ statWords: 6, unparsed, lineWords: words });
        const text = await run(client, 20);
        if (/left out: the ranked entries' stat lines \(search_tree_nodes shows them\); the closing tip\.$/m.test(text)) found = text;
      }
    }
    expect(found).not.toBeNull();
    expect(found!.length).toBeLessThanOrEqual(5000);
    expect(found).not.toContain('💡');
    expect(ranks(found!)).toEqual([...Array.from({ length: 20 }, (_, i) => i + 1), ...Array.from({ length: 8 }, (_, i) => i + 1)]);
  });

  it('refit (the router\'s notice room, D-53): with the room a notice takes reserved, the text plus that room stays within 5000 and every can\'t-measure line stays whole', async () => {
    const unparsed = 12;
    const result = await handle(stubEngine({ statWords: 6, unparsed, lineWords: 7 }), 20);
    expect(typeof result.refit).toBe('function');
    const full = result.content[0].text;
    for (const reserved of [75, 262, 900]) {
      const text = result.refit!(reserved);
      expect({ reserved, fits: text.length + reserved <= 5000 }).toEqual({ reserved, fits: true });
      expect(text).toMatch(/^Shortened to stay within 5000 characters; left out: /m);
      const entries = [...text.matchAll(/^- \*\*(.+?)\*\* \[(\d+)\].*: not applied: \[unparsed\] (.*)$/gm)];
      expect(entries).toHaveLength(unparsed);
      for (const e of entries) expect(e[3]).toBe(LONG(Number(e[2]), 7));
    }
    // With no room reserved, refit renders what the plain result holds.
    expect(result.refit!(0)).toBe(full);
  });
});
