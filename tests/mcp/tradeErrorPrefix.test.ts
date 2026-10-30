/**
 * AC-K43 (WU-49, D-218): an error a `TradeError` (C-10) causes in `get_item_price`, `search_trade_items`
 * or `get_leagues` reads `Error: [trade:<kind>] Failed to <action>: <message>`, with `<kind>` the
 * `TradeErrorKind` unchanged. Other errors get no prefix.
 *
 * - In process (startTestServer, C-18), with `fixtureFetch`'s synthetic trade2 responses
 *   (`tests/helpers/tradeFixtures.ts`), the injected clock (`now = () => T0 + elapsed`) and an explicit
 *   `league`. Each case starts a fresh server, except the lockout case, which follows the 429 on the
 *   same server. The rate limiter (C-11) refuses a locked-out or over-long send without a request.
 * - Direct handler calls with a stub trade client that throws `new TradeError(kind, "m")` for every
 *   `TradeErrorKind` value (read from `src/trade/errors.ts`), and a plain `Error`.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { performance } from 'perf_hooks';
import { describe, it, expect, afterEach } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type FixtureRoute, type RecordedCall } from '../helpers/fixtureFetch';
import { DATA_ROUTES, fetchRoute, readTrade2, searchResponse, searchSequence, type SyntheticResponse } from '../helpers/tradeFixtures';
import { handleGetItemPrice, handleGetLeagues, handleSearchTradeItems, type TradeContext } from '../../src/handlers/tradeHandlers';
import { TradeError, type TradeErrorKind } from '../../src/trade/errors';
import type { TradeApiClient } from '../../src/trade/tradeClient';
import type { StatMapper } from '../../src/services/statMapper';
import type { CurrencyService } from '../../src/trade/currency';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

const ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };
const LEAGUE = 'Runes of Aldur';
const T0 = Date.parse('2026-10-07T12:00:00Z');

/** The kinds D-218 names (spec 01 §2.9), each a `TradeErrorKind`. */
const SPEC_KINDS = [
  'no_session',
  'session_rejected',
  'too_complex',
  'invalid_query',
  'rate_limited',
  'locked_out',
  'would_wait',
  'auth',
  'http',
  'network',
  'timeout',
  'disabled',
] as const satisfies readonly TradeErrorKind[];

/** The members of the `TradeErrorKind` union, read from its source. */
function sourceKinds(): string[] {
  const file = path.resolve(__dirname, '..', '..', 'src', 'trade', 'errors.ts');
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const kinds: string[] = [];
  sf.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === 'TradeErrorKind' && ts.isUnionTypeNode(node.type)) {
      for (const t of node.type.types) {
        if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) kinds.push(t.literal.text);
      }
    }
  });
  return kinds;
}

/** The search capture's anonymous rate-limit headers (rules `Ip`; the 300 s window is `30:300:1800`). */
const RING_LIMIT_HEADERS: Record<string, string> = Object.fromEntries(
  Object.entries(readTrade2<{ headers: Record<string, string> }>('search-ring-divine.headers.json').headers).filter(([k]) =>
    k.startsWith('x-rate-limit-'),
  ),
);
const RATE_LIMITED: SyntheticResponse = {
  status: 429,
  headers: { ...RING_LIMIT_HEADERS, 'retry-after': '60' },
  body: { error: { code: 3, message: 'Rate limit exceeded' } },
};
const SERVER_ERROR: SyntheticResponse = { status: 500, body: { error: { code: 1, message: 'Internal error' } } };
/** A search whose state reports the 300 s window full (30 hits of 30), with no active penalty. */
const FULL_300S_WINDOW: SyntheticResponse = searchResponse('wu49-full-window', 12, {
  ...RING_LIMIT_HEADERS,
  'x-rate-limit-ip-state': '1:10:0,1:60:0,30:300:0,22:21600:0',
});

let server: TestServer | null = null;
let calls: RecordedCall[] = [];

afterEach(async () => {
  await server?.close();
  server = null;
});

async function freshServer(search: SyntheticResponse[], extra: FixtureRoute[] = []): Promise<void> {
  const ff = fixtureFetch([...extra, ...DATA_ROUTES, searchSequence(search), fetchRoute(), { match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } }]);
  calls = ff.calls;
  const start = performance.now();
  server = await startTestServer({ fetch: ff.fetch, env: ENV, now: () => T0 + (performance.now() - start) });
}

async function callTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const res = (await server!.client.callTool({ name, arguments: args })) as ToolResult;
  return { text: res.content.map((c) => c.text).join('\n'), isError: res.isError === true };
}

const tradeRequests = () => calls.filter((c) => /\/api\/trade2\/(search|fetch)\//.test(c.url)).length;

describe('AC-K43 (WU-49, D-218): the [trade:<kind>] prefix through the server', () => {
  it('AC-K43: a search answered 429 (Retry-After: 60) gives [trade:rate_limited]; the next call on that server gives [trade:locked_out] with no new request', async () => {
    await freshServer([RATE_LIMITED]);
    const limited = await callTool('get_item_price', { item_name: 'x', league: LEAGUE });
    expect(limited.isError).toBe(true);
    expect(limited.text.startsWith('Error: [trade:rate_limited] ')).toBe(true);
    expect(limited.text).toMatch(/^Error: \[trade:rate_limited\] Failed to get item price: rate limited by the trade site/);
    expect(tradeRequests()).toBe(1);

    const before = calls.length;
    const locked = await callTool('get_item_price', { item_name: 'x', league: LEAGUE });
    expect(locked.isError).toBe(true);
    expect(locked.text.startsWith('Error: [trade:locked_out] ')).toBe(true);
    expect(locked.text).toMatch(/^Error: \[trade:locked_out\] Failed to get item price: /);
    expect(calls.length).toBe(before);
  });

  it('AC-K43: after a search whose state reports a full 300 s window, the next call gives [trade:would_wait] with no new request', async () => {
    await freshServer([FULL_300S_WINDOW]);
    const first = await callTool('get_item_price', { item_name: 'x', league: LEAGUE });
    expect(first.isError).toBe(false);
    expect(tradeRequests()).toBe(2);

    const before = calls.length;
    const refused = await callTool('get_item_price', { item_name: 'x', league: LEAGUE });
    expect(refused.isError).toBe(true);
    expect(refused.text.startsWith('Error: [trade:would_wait] ')).toBe(true);
    expect(refused.text).toMatch(/^Error: \[trade:would_wait\] Failed to get item price: the trade site's rate limit would need a wait of \d+ s/);
    expect(calls.length).toBe(before);
  });

  it('AC-K43: a search answered 500 gives [trade:http]', async () => {
    await freshServer([SERVER_ERROR]);
    const res = await callTool('get_item_price', { item_name: 'x', league: LEAGUE });
    expect(res.isError).toBe(true);
    expect(res.text.startsWith('Error: [trade:http] ')).toBe(true);
    expect(res.text).toMatch(/^Error: \[trade:http\] Failed to get item price: the trade site returned HTTP 500/);
  });

  it('AC-K43: search_trade_items with a search answered 429 gives [trade:rate_limited]', async () => {
    await freshServer([RATE_LIMITED]);
    const res = await callTool('search_trade_items', { league: LEAGUE, limit: 3 });
    expect(res.isError).toBe(true);
    expect(res.text.startsWith('Error: [trade:rate_limited] ')).toBe(true);
    expect(res.text).toMatch(/^Error: \[trade:rate_limited\] Failed to search trade items: /);
  });

  it('D-218: get_leagues with /data/leagues answered 500 gives [trade:http]', async () => {
    await freshServer([SERVER_ERROR], [{ match: /\/api\/trade2\/data\/leagues/, respond: SERVER_ERROR }]);
    const res = await callTool('get_leagues', {});
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/^Error: \[trade:http\] Failed to get leagues: the trade site returned HTTP 500/);
  });
});

/** A trade context whose client throws `error` from every request. */
function throwingContext(error: Error): TradeContext {
  const fail = async (): Promise<never> => {
    throw error;
  };
  const tradeClient = { search: fail, fetch: fail, getLeagues: fail, getStats: fail } as unknown as TradeApiClient;
  return {
    tradeClient,
    statMapper: {} as StatMapper,
    currency: { getRates: async () => null } as unknown as CurrencyService,
    resolveLeague: async () => LEAGUE,
  };
}

/** The message each handler throws with a client that throws `error`. */
async function handlerMessages(error: Error): Promise<Record<string, string>> {
  const ctx = throwingContext(error);
  const messageOf = async (p: Promise<unknown>): Promise<string> => {
    try {
      await p;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    throw new Error('the handler did not throw');
  };
  return {
    'get item price': await messageOf(handleGetItemPrice(ctx, { item_name: 'x', league: LEAGUE })),
    'search trade items': await messageOf(handleSearchTradeItems(ctx, { league: LEAGUE })),
    'get leagues': await messageOf(handleGetLeagues(ctx)),
  };
}

/**
 * D-474 (AC-K79): the error of `get_item_price` and `search_trade_items` ends with the pace line; this context sets no
 * pace, so the server's default is reported. `get_leagues` carries none.
 */
const PACE_ON = 'Pace: 45 s between searches, at most 7 in 5 minutes.';
const paced = (action: string): string => (action === 'get leagues' ? '' : `\n${PACE_ON}`);

describe('AC-K43 (WU-49, D-218): the trade handlers keep the error kind', () => {
  it('AC-K43: the kinds checked are exactly the TradeErrorKind union', () => {
    expect([...sourceKinds()].sort()).toEqual([...SPEC_KINDS].sort());
  });

  it.each(SPEC_KINDS.map((k) => [k]))('AC-K43: a TradeError of kind %s gives "[trade:<kind>] Failed to <action>: m" from all three handlers', async (kind) => {
    const messages = await handlerMessages(new TradeError(kind, 'm'));
    for (const [action, message] of Object.entries(messages)) {
      expect(message.startsWith(`[trade:${kind}] Failed to `)).toBe(true);
      expect(message).toBe(`[trade:${kind}] Failed to ${action}: m${paced(action)}`);
    }
  });

  it('AC-K43: a plain Error gives no [trade: prefix', async () => {
    const messages = await handlerMessages(new Error('m'));
    for (const [action, message] of Object.entries(messages)) {
      expect(message).not.toContain('[trade:');
      expect(message).toBe(`Failed to ${action}: m${paced(action)}`);
    }
  });
});
