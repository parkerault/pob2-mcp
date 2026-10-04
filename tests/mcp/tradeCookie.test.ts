/**
 * AC-T2 (WU-14, I-8e): the session cookie goes only to trade2 search and fetch requests made with
 * `auth: true`, and never appears in tool output, error messages or stderr.
 *
 * In process (startTestServer, C-18) with the real router, handlers and trade client; HTTP only via
 * `fixtureFetch`. The credential getter returns the sentinel `SENTINEL7f3a`. The kept tools search
 * anonymously (`auth: false`); the authenticated requests are made by a `TradeApiClient` built on
 * the same `fixtureFetch` and credential getter.
 */
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type FixtureRoute, type RecordedCall } from '../helpers/fixtureFetch';
import { TradeApiClient, TradeError } from '../../src/trade/tradeClient';
import { RateLimiter } from '../../src/trade/rateLimiter';
import type { Credentials } from '../../src/trade/credentials';
import { userAgent } from '../../src/utils/userAgent';

const SENTINEL = 'SENTINEL7f3a';
const credentials = (): Credentials => ({ sessionId: SENTINEL, source: 'dotenv' });
const TRADE_ENV = { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_TRADE_BASE: undefined };

const DATA_ROUTES: FixtureRoute[] = [
  { match: /\/api\/trade2\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
  { match: /\/api\/trade2\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } },
  { match: /poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
];
const WEIGHTED_QUERY = {
  query: { status: { option: 'securable' }, stats: [{ type: 'weight', filters: [{ id: 'pseudo.pseudo_total_life', value: { weight: 1 } }] }] },
  sort: { 'statgroup.0': 'desc' },
};

let server: TestServer | null = null;
let errorSpy: jest.SpiedFunction<typeof console.error> | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
  errorSpy?.mockRestore();
  errorSpy = null;
});

function captureStderr(): string[] {
  const lines: string[] = [];
  errorSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(' '));
  });
  return lines;
}

async function callText(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const res = (await server!.client.callTool({ name, arguments: args })) as {
    content: Array<{ text: string }>;
    isError?: boolean;
  };
  return { text: res.content.map((c) => c.text).join('\n'), isError: Boolean(res.isError) };
}

function directClient(fetch: typeof globalThis.fetch): TradeApiClient {
  return new TradeApiClient({ fetch, credentials, limiter: new RateLimiter(), userAgent: userAgent() });
}

const isAuthTrade = (c: RecordedCall) => /\/api\/trade2\/(search|fetch)\//.test(c.url);

describe('AC-T2 (WU-14, I-8e): the session cookie reaches only authenticated trade2 search and fetch', () => {
  it('AC-T2: only auth:true search/fetch carry the cookie; /data/*, poe.ninja and the kept tools carry none', async () => {
    const stderr = captureStderr();
    const ff = fixtureFetch([
      ...DATA_ROUTES,
      { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-body-armour' } },
      { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-body-armour' } },
    ]);
    server = await startTestServer({ fetch: ff.fetch, credentials, env: TRADE_ENV });

    const outputs = [
      await callText('search_trade_items', { league: 'Runes of Aldur', limit: 3 }),
      await callText('get_leagues', {}),
      await callText('get_currency_rates', { league: 'Runes of Aldur' }),
    ];
    for (const o of outputs) expect(o.isError).toBe(false);
    const toolCalls = ff.calls.length;

    const client = directClient(ff.fetch);
    const search = await client.search('Forbidden Rites', WEIGHTED_QUERY, { auth: true });
    await client.fetch(search.result.slice(0, 10), search.id, { auth: true });

    const tool = ff.calls.slice(0, toolCalls);
    const direct = ff.calls.slice(toolCalls);
    // The tools did reach every kind of endpoint.
    expect(tool.some((c) => /\/data\/stats$/.test(c.url))).toBe(true);
    expect(tool.some((c) => /\/data\/leagues$/.test(c.url))).toBe(true);
    expect(tool.some((c) => /poe\.ninja\//.test(c.url))).toBe(true);
    expect(tool.filter(isAuthTrade).map((c) => c.method)).toEqual(['POST', 'GET']);
    // No tool request (auth:false searches, /data/*, poe.ninja) carries a cookie.
    expect(tool.filter((c) => c.headers.cookie !== undefined)).toEqual([]);
    // Exactly the auth:true search and fetch carry it.
    expect(direct.map((c) => `${c.method} ${c.url.replace(/\?.*$/, '').replace(/\/fetch\/.*/, '/fetch/…')}`)).toEqual([
      'POST https://www.pathofexile.com/api/trade2/search/poe2/Forbidden%20Rites',
      'GET https://www.pathofexile.com/api/trade2/fetch/…',
    ]);
    for (const c of direct) expect(c.headers.cookie).toBe(`POESESSID=${SENTINEL}`);
    expect(ff.calls.filter((c) => c.headers.cookie !== undefined)).toHaveLength(2);

    for (const o of outputs) expect(o.text).not.toContain(SENTINEL);
    expect(stderr.filter((l) => l.includes(SENTINEL))).toEqual([]);
  });

  it.each([
    [400, { error: { code: 2, message: 'Query is too complex.' } }],
    [401, { error: { code: 0, message: 'Unauthorized' } }],
    [429, { error: { code: 3, message: 'Rate limit exceeded' } }],
    [500, { error: { code: 1, message: 'Internal error' } }],
  ])('AC-T2: when trade2 answers %i, the sentinel appears in no output, error message or stderr line', async (status, body) => {
    const stderr = captureStderr();
    const headers = { 'content-type': 'application/json', 'retry-after': '1' };
    const ff = fixtureFetch([
      ...DATA_ROUTES,
      { match: /\/api\/trade2\/(search|fetch)\//, respond: { status, headers, body } },
    ]);
    server = await startTestServer({ fetch: ff.fetch, credentials, env: TRADE_ENV });

    const tool = await callText('search_trade_items', { league: 'Runes of Aldur', limit: 3 });
    expect(tool.isError).toBe(true);
    expect(tool.text).not.toContain(SENTINEL);

    const client = directClient(ff.fetch);
    const errors: unknown[] = [];
    await client.search('Forbidden Rites', WEIGHTED_QUERY, { auth: true }).catch((e) => errors.push(e));
    await client.fetch(['a', 'b'], 'q', { auth: true }).catch((e) => errors.push(e));
    expect(errors.length).toBeGreaterThan(0);
    for (const e of errors) {
      expect(e).toBeInstanceOf(TradeError);
      expect((e as TradeError).message).not.toContain(SENTINEL);
      expect(JSON.stringify(e)).not.toContain(SENTINEL);
    }
    // The authenticated requests did carry it (so its absence above is meaningful).
    expect(ff.calls.some((c) => c.headers.cookie === `POESESSID=${SENTINEL}`)).toBe(true);
    expect(stderr.filter((l) => l.includes(SENTINEL))).toEqual([]);
  });

  it('AC-T2: when fetch rejects with a TypeError whose message contains the cookie header, the sentinel is not shown', async () => {
    const stderr = captureStderr();
    const leaky = (_url: string, init: RequestInit | undefined): Response => {
      const cookie = new Headers(init?.headers).get('cookie') ?? `POESESSID=${SENTINEL}`;
      throw new TypeError(`fetch failed: invalid header value "cookie: ${cookie}"`);
    };
    const ff = fixtureFetch([...DATA_ROUTES, { match: /\/api\/trade2\/(search|fetch)\//, respond: leaky }]);
    server = await startTestServer({ fetch: ff.fetch, credentials, env: TRADE_ENV });

    const tool = await callText('search_trade_items', { league: 'Runes of Aldur', limit: 3 });
    expect(tool.isError).toBe(true);
    expect(tool.text).not.toContain(SENTINEL);
    expect(tool.text).toContain('network error contacting the trade site');

    const client = directClient(ff.fetch);
    for (const p of [
      client.search('Forbidden Rites', WEIGHTED_QUERY, { auth: true }),
      client.fetch(['a'], 'q', { auth: true }),
    ]) {
      const err = await p.then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(TradeError);
      expect((err as TradeError).kind).toBe('network');
      expect((err as TradeError).message).not.toContain(SENTINEL);
      expect(JSON.stringify(err)).not.toContain(SENTINEL);
    }
    expect(stderr.filter((l) => l.includes(SENTINEL))).toEqual([]);
  });
});
