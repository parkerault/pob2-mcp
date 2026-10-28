/**
 * AC-T18 (WU-15, D-51h): `search_trade_items` is PoE2-correct. In process (startTestServer, C-18);
 * HTTP only via `fixtureFetch`, which records each search body.
 *
 * - The handler reads the schema's argument names (`item_rarity`, `mods:[{stat_id,min,max}]`,
 *   `price_currency`, …) and writes them to the trade2 filters.
 * - Links are trade2 links: `https://www.pathofexile.com/trade2/search/poe2/<encoded league>/<id>`.
 * - `categoryMap` covers the PoE2 categories; `min_rune_sockets` writes
 *   `equipment_filters.filters.rune_sockets.min`; no body has a `socket_filters` group.
 * - A static check: the schema's property names equal the names the handler reads.
 *
 * AC-K75 (WU-118, D-461), in process: the server deps set the trade limiter's search pace (on in the
 * entry and by default, off in the test helpers), so a second `search_trade_items` call waits out the
 * 45 s gap inside the call (on a fake clock); a 429 lands in the state dir's `trade-429.jsonl`, and a
 * log that can't be written leaves the tool's result unchanged.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import ts from 'typescript';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { spawnServerEnv } from '../helpers/spawnServer';
import { fixtureFetch, type RecordedCall } from '../helpers/fixtureFetch';
import { getTradeToolSchemas } from '../../src/server/toolSchemas';
import { TRADE_429_LOG } from '../../src/server/createServer';
import { TRADE_SEARCH_PACE, type SearchPace } from '../../src/trade/rateLimiter';
import { entryTradePace } from '../../src/index';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };
const SEARCH = /^https:\/\/www\.pathofexile\.com\/api\/trade2\/search\/poe2\//;
const TRADE2 = path.resolve(__dirname, '..', 'fixtures', 'trade2');
/**
 * The committed ring search response, served without its rate-limit headers: this suite sends a
 * dozen searches, and under the captured Ip policy (5 per 10 s) the limiter would make it wait
 * ~20 s. The limiter itself is covered by AC-T4…T8.
 */
const RING_SEARCH = JSON.parse(fs.readFileSync(path.join(TRADE2, 'search-ring-divine.response.json'), 'utf8')) as {
  id: string;
};
const RING_SEARCH_ID = RING_SEARCH.id;

let server: TestServer;
let calls: RecordedCall[];

beforeAll(async () => {
  const ff = fixtureFetch([
    { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
    { match: SEARCH, respond: { status: 200, headers: { 'content-type': 'application/json' }, body: RING_SEARCH } },
    { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-ring-divine' } },
    { match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
  ]);
  calls = ff.calls;
  server = await startTestServer({ fetch: ff.fetch, env: ENV });
});

afterAll(async () => {
  await server?.close();
});

async function search(args: Record<string, unknown>): Promise<{ res: ToolResult; body: any }> {
  const before = calls.length;
  const res = (await server.client.callTool({ name: 'search_trade_items', arguments: args })) as ToolResult;
  const sent = calls.slice(before).filter((c) => SEARCH.test(c.url));
  expect(sent).toHaveLength(1);
  expect(sent[0].method).toBe('POST');
  return { res, body: JSON.parse(sent[0].body as string) };
}

describe('AC-T18 (WU-15): search_trade_items request body and links', () => {
  it('AC-T18: the schema argument names become the trade2 filters', async () => {
    const { res, body } = await search({
      league: 'Runes of Aldur',
      item_type: 'ring',
      item_rarity: 'rare',
      mods: [{ stat_id: 'explicit.stat_3299347043', min: 40 }],
      max_price: 2,
      price_currency: 'divine',
      corrupted: false,
      limit: 3,
    });
    expect(res.isError).toBeFalsy();
    const filters = body.query.filters;
    expect(filters.type_filters.filters.category.option).toBe('accessory.ring');
    expect(filters.type_filters.filters.rarity.option).toBe('rare');
    expect(body.query.stats).toEqual([{ type: 'and', filters: [{ id: 'explicit.stat_3299347043', value: { min: 40 } }] }]);
    expect(filters.trade_filters.filters.price).toEqual({ max: 2, option: 'divine' });
    expect(filters.misc_filters.filters.corrupted.option).toBe('false');
  });

  it('AC-T18: the output links are trade2 links with the encoded league and the search id', async () => {
    const { res } = await search({ league: 'Runes of Aldur', item_type: 'ring', limit: 3 });
    const text = res.content[0].text;
    const links = [...text.matchAll(/https:\/\/www\.pathofexile\.com\/\S+/g)].map((m) => m[0]);
    const shown = Number(/Showing: (\d+)/.exec(text)?.[1]);
    expect(shown).toBeGreaterThan(0);
    // One link, the search's: each listing names its id instead of repeating the ~200-character
    // search id (which would overrun the 5000-character truncation at limit 10, C-1).
    expect(links.length).toBe(1);
    expect([...text.matchAll(/^ {3}Listing: #([0-9a-f]{64})$/gm)]).toHaveLength(shown);
    const searchCall = calls.filter((c) => SEARCH.test(c.url)).at(-1)!;
    expect(searchCall.url).toBe('https://www.pathofexile.com/api/trade2/search/poe2/Runes%20of%20Aldur');
    const base = `https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/${RING_SEARCH_ID}`;
    expect(links[0]).toBe(base);
    expect(text).not.toMatch(/pathofexile\.com\/trade\/search\//);
  });

  it('AC-T18: categoryMap maps crossbow, spear, flail, focus, buckler, talisman and charm', async () => {
    const expected: Record<string, string> = {
      crossbow: 'weapon.crossbow',
      spear: 'weapon.spear',
      flail: 'weapon.flail',
      focus: 'armour.focus',
      buckler: 'armour.buckler',
      talisman: 'weapon.talisman',
      charm: 'flask', // PoB2's getTradeCategory: charms search the flask category
    };
    for (const [type, category] of Object.entries(expected)) {
      const { body } = await search({ league: 'Runes of Aldur', item_type: type, limit: 1 });
      expect(body.query.filters.type_filters.filters.category.option).toBe(category);
      expect(body.query.type).toBeUndefined();
    }
  });

  it('AC-T18: min_rune_sockets writes equipment_filters.rune_sockets.min and no body has socket_filters', async () => {
    const { body } = await search({ league: 'Runes of Aldur', item_type: 'body armour', min_rune_sockets: 2, limit: 1 });
    expect(body.query.filters.equipment_filters.filters.rune_sockets.min).toBe(2);
    for (const c of calls.filter((x) => SEARCH.test(x.url))) {
      expect(c.body).not.toContain('socket_filters');
    }
  });

  it('AC-T18: identified and price_currency on min_price are passed through', async () => {
    const { body } = await search({ league: 'Runes of Aldur', min_price: 1, identified: true, limit: 1 });
    expect(body.query.filters.trade_filters.filters.price).toEqual({ min: 1 });
    expect(body.query.filters.misc_filters.filters.identified.option).toBe('true');
  });
});

/** The property names `handleSearchTradeItems` destructures from its `args`, read from the source. */
function handlerArgNames(): string[] {
  const file = path.resolve(__dirname, '..', '..', 'src', 'handlers', 'tradeHandlers.ts');
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let fn: ts.FunctionDeclaration | undefined;
  sf.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'handleSearchTradeItems') fn = n;
  });
  if (!fn) throw new Error('handleSearchTradeItems not found');
  const names: string[] = [];
  const otherArgsUses: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === 'args'
    ) {
      for (const el of node.name.elements) {
        const key = el.propertyName ?? el.name;
        if (ts.isIdentifier(key)) names.push(key.text);
      }
    } else if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'args') {
      otherArgsUses.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(fn);
  return [...names, ...otherArgsUses];
}

describe('AC-T18 (WU-15): schema and handler agree (static)', () => {
  it('AC-T18: the schema property names equal the names the handler reads', () => {
    const schema = getTradeToolSchemas().find((t) => t.name === 'search_trade_items');
    const schemaNames = Object.keys(schema.inputSchema.properties).sort();
    expect(handlerArgNames().sort()).toEqual(schemaNames);
    expect(schemaNames).toEqual(
      expect.arrayContaining(['item_rarity', 'mods', 'price_currency', 'min_rune_sockets']),
    );
    expect(schemaNames).not.toContain('min_links');
    expect(schema.inputSchema.properties.mods.items.properties).toHaveProperty('stat_id');
  });
});

describe('AC-K75 (WU-118, D-461): the server sets the search pace and logs each 429', () => {
  const made: string[] = [];
  const tmpDir = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-pace-'));
    made.push(dir);
    return dir;
  };
  afterAll(() => {
    for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
  });

  const ARGS = { league: 'Runes of Aldur', item_type: 'ring', limit: 1 };
  /** The ring search, with a roomy search policy so only the pace can hold a search back. */
  const ROOMY = {
    'content-type': 'application/json',
    'x-rate-limit-policy': 'trade-search-request-limit',
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '100:10:60',
    'x-rate-limit-ip-state': '1:10:0',
  };

  /** An in-process server on a fake clock whose trade sleep advances it; records each search's time. */
  async function pacedServer(deps: { tradePace?: SearchPace | null; stateDir?: string; status?: number }) {
    let t = 5_000_000;
    const sleeps: number[] = [];
    const sent: number[] = [];
    const ff = fixtureFetch([
      { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
      {
        match: SEARCH,
        respond: () => {
          sent.push(t);
          return deps.status === 429
            ? new Response(JSON.stringify({ error: { code: 3, message: 'Rate limit exceeded' } }), {
                status: 429,
                headers: { ...ROOMY, 'x-rate-limit-ip-state': '100:10:60', 'retry-after': '60' },
              })
            : new Response(JSON.stringify(RING_SEARCH), { status: 200, headers: ROOMY });
        },
      },
      { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-ring-divine' } },
      { match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
    ]);
    const server = await startTestServer({
      fetch: ff.fetch,
      env: ENV,
      now: () => t,
      tradeSleep: async (ms: number) => {
        sleeps.push(ms);
        t += ms;
      },
      ...('tradePace' in deps ? { tradePace: deps.tradePace } : {}),
      ...(deps.stateDir ? { stateDir: deps.stateDir } : {}),
    });
    const call = async () => (await server.client.callTool({ name: 'search_trade_items', arguments: ARGS })) as ToolResult;
    return {
      server,
      call,
      sleeps,
      sent,
      advance: (ms: number) => {
        t += ms;
      },
    };
  }

  it('AC-K75: with the pace on, a second search_trade_items call 10 s after the first waits inside the call and is sent 45 s after it', async () => {
    const s = await pacedServer({ tradePace: TRADE_SEARCH_PACE });
    try {
      expect((await s.call()).isError).toBeFalsy();
      s.advance(10_000);
      const second = await s.call();
      expect(second.isError).toBeFalsy();
      expect(s.sent.map((x) => x - s.sent[0])).toEqual([0, 45_000]);
      expect(s.sleeps).toEqual([35_000]);
    } finally {
      await s.server.close();
    }
  });

  it("AC-K75: the pace is on by default in createServer and in the entry; the test helpers turn it off", async () => {
    // createServer's default (no tradePace in the deps) is the pace.
    const byDefault = await pacedServer({ tradePace: undefined });
    try {
      await byDefault.call();
      await byDefault.call();
      expect(byDefault.sent.map((x) => x - byDefault.sent[0])).toEqual([0, 45_000]);
    } finally {
      await byDefault.server.close();
    }
    // startTestServer's default: off, so trade suites keep their speed.
    const helper = await pacedServer({});
    try {
      await helper.call();
      await helper.call();
      expect(helper.sent.map((x) => x - helper.sent[0])).toEqual([0, 0]);
      expect(helper.sleeps).toEqual([]);
    } finally {
      await helper.server.close();
    }
    // The entry: on, unless a test's spawned server turns it off; spawnServer does.
    expect(entryTradePace({})).toEqual(TRADE_SEARCH_PACE);
    expect(entryTradePace({ POB_TEST_TRADE_PACE: 'on' })).toEqual(TRADE_SEARCH_PACE);
    expect(entryTradePace({ POB_TEST_TRADE_PACE: 'off' })).toBeNull();
    expect(spawnServerEnv().POB_TEST_TRADE_PACE).toBe('off');
  });

  it("AC-K75: a 429 from a tool call is logged in the state dir's trade-429.jsonl; a log that can't be written leaves the tool's result unchanged", async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const good = path.join(tmpDir(), 'state');
      const a = await pacedServer({ stateDir: good, status: 429 });
      const expected = await a.call();
      await a.server.close();
      expect(expected.isError).toBe(true);
      expect(expected.content[0].text).toMatch(/rate limited by the trade site; retry after 60 s/);
      const lines = fs.readFileSync(path.join(good, TRADE_429_LOG), 'utf8').split('\n').filter((l) => l !== '');
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toMatchObject({
        endpoint: 'search',
        kind: 'anon',
        status: 429,
        rules: { ip: { limits: '100:10:60', state: '100:10:60' } },
        retryAfter: 60,
        lockoutS: 60,
      });

      // The state dir's place is taken by a file: the log can't be written, and the result is the same.
      const blocked = tmpDir();
      fs.writeFileSync(path.join(blocked, 'state'), 'not a folder');
      const b = await pacedServer({ stateDir: path.join(blocked, 'state'), status: 429 });
      const result = await b.call();
      await b.server.close();
      expect(result).toEqual(expected);
      expect(errors.mock.calls.map((c) => String(c[0])).some((m) => /could not write the 429 log/.test(m))).toBe(true);
    } finally {
      errors.mockRestore();
    }
  });
});
