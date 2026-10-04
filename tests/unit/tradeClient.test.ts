/**
 * The trade2 HTTP client (C-10). Unit tests over `fixtureFetch` (C-18) with the committed trade2
 * fixtures and responses synthesized from them: AC-T9 (D-24 classification), AC-T10 (fetch
 * guard and URL), AC-T12 (D-46 caching), plus the client side of AC-T6 (429).
 */
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { TradeApiClient, TradeError } from '../../src/trade/tradeClient';
import { RateLimiter } from '../../src/trade/rateLimiter';
import type { Credentials } from '../../src/trade/credentials';
import { fixtureFetch, type FixtureRoute } from '../helpers/fixtureFetch';

const TRADE2 = path.resolve(__dirname, '..', 'fixtures', 'trade2');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(TRADE2, name), 'utf8')) as Record<string, unknown>;

const WEIGHTED_BODY = read('search-weighted-session.request.json');
const AND_BODY = read('search-and-3-stats.request.json');
const TOO_COMPLEX_BODY = read('search-weighted-pob-shape.response.json'); // {error:{code:2,message:…}}
const POB_SHAPE_HEADERS = (read('search-weighted-pob-shape.headers.json') as { headers: Record<string, string> }).headers;
const SESSION_SEARCH_HEADERS = (read('search-weighted-session.headers.json') as { headers: Record<string, string> }).headers;
const UA = 'pob2-mcp-server/test';
const SESSION = 'SESSIONabc123';

const withSession = (): Credentials => ({ sessionId: SESSION, source: 'dotenv' });
const noSession = (): Credentials => ({ sessionId: null, source: null });

function makeClient(routes: FixtureRoute[], credentials: () => Credentials = withSession, extra: { now?: () => number } = {}) {
  const ff = fixtureFetch(routes);
  const limiter = new RateLimiter(extra.now ? { now: extra.now } : {});
  const client = new TradeApiClient({ fetch: ff.fetch, credentials, limiter, userAgent: UA, ...extra });
  return { client, calls: ff.calls, limiter };
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

const SEARCH = /\/api\/trade2\/search\//;

afterEach(() => {
  jest.useRealTimers();
});

describe('AC-T9 (WU-14, D-24, I-8c): classification', () => {
  it('AC-T9 (a): weighted body, cookie sent, 400 code 2 with rules Ip -> session_rejected', async () => {
    const { client, calls } = makeClient([
      { match: SEARCH, respond: { status: 400, headers: POB_SHAPE_HEADERS, body: TOO_COMPLEX_BODY } },
    ]);
    const err = (await rejection(client.search('Forbidden Rites', WEIGHTED_BODY, { auth: true }))) as TradeError;
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('session_rejected');
    expect(err.status).toBe(400);
    expect(err.code).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0].headers.cookie).toBe(`POESESSID=${SESSION}`);
  });

  it('AC-T9 (b): weighted body, cookie sent, 400 code 2 with rules Account,Ip -> too_complex', async () => {
    const headers = {
      ...POB_SHAPE_HEADERS,
      'x-rate-limit-rules': 'Account,Ip',
      'x-rate-limit-account': '3:5:60',
      'x-rate-limit-account-state': '1:5:0',
    };
    const { client } = makeClient([{ match: SEARCH, respond: { status: 400, headers, body: TOO_COMPLEX_BODY } }]);
    const err = (await rejection(client.search('Forbidden Rites', WEIGHTED_BODY, { auth: true }))) as TradeError;
    expect(err.kind).toBe('too_complex');
    expect(err.serverMessage).toBe((TOO_COMPLEX_BODY.error as { message: string }).message);
  });

  it('AC-T9 (b): the Account rule is matched case-insensitively', async () => {
    const headers = { ...POB_SHAPE_HEADERS, 'x-rate-limit-rules': 'ip, ACCOUNT' };
    const { client } = makeClient([{ match: SEARCH, respond: { status: 400, headers, body: TOO_COMPLEX_BODY } }]);
    const err = (await rejection(client.search('Forbidden Rites', WEIGHTED_BODY, { auth: true }))) as TradeError;
    expect(err.kind).toBe('too_complex');
  });

  it('AC-T9 (c): an and-only body without a cookie, 400 code 2 -> invalid_query with serverMessage', async () => {
    const { client, calls } = makeClient([
      { match: SEARCH, respond: { status: 400, headers: POB_SHAPE_HEADERS, body: TOO_COMPLEX_BODY } },
    ]);
    const err = (await rejection(client.search('Runes of Aldur', AND_BODY, { auth: false }))) as TradeError;
    expect(err.kind).toBe('invalid_query');
    expect(err.serverMessage).toBe((TOO_COMPLEX_BODY.error as { message: string }).message);
    expect(calls[0].headers.cookie).toBeUndefined();
  });

  it('AC-T9 (c): a weighted body sent WITHOUT a cookie, 400 code 2 -> invalid_query (D-24 needs the cookie)', async () => {
    const { client } = makeClient([{ match: SEARCH, respond: { status: 400, headers: POB_SHAPE_HEADERS, body: TOO_COMPLEX_BODY } }]);
    const err = (await rejection(client.search('Runes of Aldur', WEIGHTED_BODY, { auth: false }))) as TradeError;
    expect(err.kind).toBe('invalid_query');
  });

  it.each([401, 403])('AC-T9 (d/e): %i -> auth', async (status) => {
    const { client } = makeClient([{ match: SEARCH, respond: { status, body: '<html>forbidden</html>' } }]);
    const err = (await rejection(client.search('Standard', AND_BODY, { auth: true }))) as TradeError;
    expect(err.kind).toBe('auth');
    expect(err.status).toBe(status);
    expect(err.message).toContain(`HTTP ${status}`);
    expect(err.message).toMatch(/POESESSID/);
    expect(err.message).not.toContain('<html>');
  });

  it('AC-T9 (f) / AC-T6: 429 with Retry-After 7 -> rate_limited {retryAfterS: 7}, then locked_out for 7 s', async () => {
    let t = 2_000_000;
    const now = () => t;
    const routes: FixtureRoute[] = [
      {
        match: SEARCH,
        respond: (() => {
          let n = 0;
          return () =>
            n++ === 0
              ? new Response('', { status: 429, headers: { ...SESSION_SEARCH_HEADERS, 'retry-after': '7' } })
              : new Response(JSON.stringify({ id: 'q', total: 0, result: [] }), { status: 200, headers: SESSION_SEARCH_HEADERS });
        })(),
      },
    ];
    const { client, calls } = makeClient(routes, withSession, { now });
    const err = (await rejection(client.search('Standard', AND_BODY, { auth: false }))) as TradeError;
    expect(err.kind).toBe('rate_limited');
    expect(err.retryAfterS).toBe(7);
    expect(err.status).toBe(429);

    t += 6_500;
    const locked = (await rejection(client.search('Standard', AND_BODY, { auth: false }))) as TradeError;
    expect(locked.kind).toBe('locked_out');
    expect(locked.waitS).toBe(1);
    expect(calls).toHaveLength(1);

    t += 500;
    await client.search('Standard', AND_BODY, { auth: false });
    expect(calls).toHaveLength(2);
  });

  it('AC-T9 (f): a 429 without Retry-After reports the 60 s default', async () => {
    const { client } = makeClient([{ match: SEARCH, respond: { status: 429 } }]);
    const err = (await rejection(client.search('Standard', AND_BODY, { auth: false }))) as TradeError;
    expect(err.kind).toBe('rate_limited');
    expect(err.retryAfterS).toBe(60);
  });

  it('AC-T9 (g): 503 with a long body -> http, status 503, serverMessage <= 300 chars', async () => {
    const long = 'Service unavailable. '.repeat(30); // 630 chars
    const { client } = makeClient([{ match: SEARCH, respond: { status: 503, body: { error: { code: 1, message: long } } } }]);
    const err = (await rejection(client.search('Standard', AND_BODY, { auth: false }))) as TradeError;
    expect(err.kind).toBe('http');
    expect(err.status).toBe(503);
    expect(err.code).toBe(1);
    expect(err.serverMessage!.length).toBeLessThanOrEqual(300);
    expect(err.serverMessage).toBe(long.slice(0, 300));
    expect(err.message.length).toBeLessThan(400);
  });

  it('AC-T9 (g): a 503 whose long body is not the error envelope is not dumped into the message', async () => {
    const html = `<html>${'x'.repeat(400)}</html>`;
    const { client } = makeClient([{ match: SEARCH, respond: { status: 503, body: html } }]);
    const err = (await rejection(client.search('Standard', AND_BODY, { auth: false }))) as TradeError;
    expect(err.kind).toBe('http');
    expect(err.status).toBe(503);
    expect(err.serverMessage).toBeUndefined();
    expect(err.message).not.toContain('xxxx');
  });

  it('AC-T9 (h): fetch rejects with TypeError("fetch failed") -> network, without the TypeError text', async () => {
    const { client } = makeClient([
      {
        match: SEARCH,
        respond: () => {
          throw new TypeError('fetch failed');
        },
      },
    ]);
    const err = (await rejection(client.search('Standard', AND_BODY, { auth: true }))) as TradeError;
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('network');
    expect(err.message).toBe('network error contacting the trade site');
    expect(err.message).not.toContain('fetch failed');
  });

  it('AC-T9 (i): a hung request times out after 15 s (fake timers)', async () => {
    jest.useFakeTimers();
    const { client } = makeClient([{ match: SEARCH, respond: () => new Promise<Response>(() => undefined) }]);
    const p = rejection(client.search('Standard', AND_BODY, { auth: false }));
    await jest.advanceTimersByTimeAsync(14_999);
    let settled = false;
    void p.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    const err = (await p) as TradeError;
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('timeout');
  });

  it('AC-T9 (i): the timeout is clipped to the deadline', async () => {
    jest.useFakeTimers();
    const { client } = makeClient([{ match: SEARCH, respond: () => new Promise<Response>(() => undefined) }]);
    const p = rejection(client.search('Standard', AND_BODY, { auth: false, deadline: Date.now() + 2_000 }));
    await jest.advanceTimersByTimeAsync(2_000);
    expect(((await p) as TradeError).kind).toBe('timeout');
  });

  it('AC-T9 (j): auth:true with no session -> no_session, 0 requests sent', async () => {
    const { client, calls } = makeClient([{ match: /./, respond: { status: 200, body: {} } }], noSession);
    const err = (await rejection(client.search('Standard', WEIGHTED_BODY, { auth: true }))) as TradeError;
    expect(err.kind).toBe('no_session');
    const err2 = (await rejection(client.fetch(['a'], 'q', { auth: true }))) as TradeError;
    expect(err2.kind).toBe('no_session');
    expect(calls).toHaveLength(0);
  });

  it('AC-T9 (j): an op:// or malformed cookie is no_session with the reason, not the value', async () => {
    const { client, calls } = makeClient([{ match: /./, respond: { status: 200, body: {} } }], () => ({
      sessionId: null,
      source: 'dotenv',
      problem: 'op-reference',
    }));
    const err = (await rejection(client.search('Standard', WEIGHTED_BODY, { auth: true }))) as TradeError;
    expect(err.kind).toBe('no_session');
    expect(err.message).toMatch(/op:\/\//);
    expect(calls).toHaveLength(0);
  });

  it('AC-T9 (k): a caller signal aborted with a string reason rejects with that reason (already aborted)', async () => {
    const { client, calls } = makeClient([{ match: SEARCH, respond: { status: 200, body: {} } }]);
    const ac = new AbortController();
    ac.abort('caller cancelled');
    const err = await rejection(client.search('Standard', AND_BODY, { auth: false, signal: ac.signal }));
    expect(err).toBe('caller cancelled');
    expect(calls).toHaveLength(0);
  });

  it('AC-T9 (k): a caller signal aborted mid-request rejects with that reason, not network or timeout', async () => {
    const { client } = makeClient([{ match: SEARCH, respond: () => new Promise<Response>(() => undefined) }]);
    const ac = new AbortController();
    const p = rejection(client.search('Standard', AND_BODY, { auth: false, signal: ac.signal }));
    await new Promise((r) => setImmediate(r));
    ac.abort('caller cancelled');
    expect(await p).toBe('caller cancelled');
  });

  it('AC-T9 (k): a caller abort during a rate-limit wait rejects with the reason', async () => {
    jest.useFakeTimers({ now: 3_000_000 });
    const headers = { 'x-rate-limit-policy': 'p', 'x-rate-limit-rules': 'ip', 'x-rate-limit-ip': '2:10:60' };
    const { client, calls } = makeClient([
      { match: SEARCH, respond: () => new Response(JSON.stringify({ id: 'q', total: 0, result: [] }), { status: 200, headers }) },
    ]);
    await client.search('Standard', AND_BODY, { auth: false });
    const ac = new AbortController();
    const p = rejection(client.search('Standard', AND_BODY, { auth: false, signal: ac.signal }));
    await jest.advanceTimersByTimeAsync(1_000);
    ac.abort('stop');
    expect(await p).toBe('stop');
    expect(calls).toHaveLength(1);
  });

  it('AC-T9 (l): a call with no caller signal does not throw at signal construction, and sends an abortable request', async () => {
    let seenSignal: AbortSignal | null | undefined;
    const { client } = makeClient([
      {
        match: SEARCH,
        respond: (_url, init) => {
          seenSignal = init?.signal;
          return new Response(JSON.stringify({ id: 'q1', total: 3, complexity: 9, result: ['a', 'b', 'c'] }), { status: 200 });
        },
      },
    ]);
    const res = await client.search('Standard', AND_BODY, { auth: false });
    expect(res).toEqual({ id: 'q1', total: 3, complexity: 9, result: ['a', 'b', 'c'] });
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(seenSignal!.aborted).toBe(false);
  });
});

describe('C-10 requests', () => {
  it('C-10: search POSTs to {base}/search/poe2/<encoded league> with UA, Accept, Content-Type and the cookie only when auth', async () => {
    const { client, calls } = makeClient([
      { match: SEARCH, respond: { fixture: 'trade2/search-weighted-session' } },
    ]);
    await client.search('Forbidden Rites', WEIGHTED_BODY, { auth: true });
    await client.search('Forbidden Rites', AND_BODY, { auth: false });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST https://www.pathofexile.com/api/trade2/search/poe2/Forbidden%20Rites',
      'POST https://www.pathofexile.com/api/trade2/search/poe2/Forbidden%20Rites',
    ]);
    expect(calls[0].headers).toMatchObject({
      'user-agent': UA,
      accept: 'application/json',
      'content-type': 'application/json',
      cookie: `POESESSID=${SESSION}`,
    });
    expect(JSON.parse(calls[0].body!)).toEqual(WEIGHTED_BODY);
    expect(calls[1].headers.cookie).toBeUndefined();
  });

  it('C-10: getStats and getLeagues send no cookie, no Content-Type, and getStats is cached for the process', async () => {
    const { client, calls } = makeClient([
      { match: /\/data\/stats$/, respond: { fixture: 'trade2/data-stats' } },
      { match: /\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } },
    ]);
    const [a, b] = await Promise.all([client.getStats(), client.getStats()]);
    expect(a).toBe(b);
    await client.getStats();
    await client.getLeagues();
    expect(calls.map((c) => c.url)).toEqual([
      'https://www.pathofexile.com/api/trade2/data/stats',
      'https://www.pathofexile.com/api/trade2/data/leagues',
    ]);
    for (const c of calls) {
      expect(c.headers.cookie).toBeUndefined();
      expect(c.headers['content-type']).toBeUndefined();
      expect(c.headers['user-agent']).toBe(UA);
    }
  });

  it('C-10: a failed getStats is not cached; the next call retries', async () => {
    let n = 0;
    const { client, calls } = makeClient([
      {
        match: /\/data\/stats$/,
        respond: () => (n++ === 0 ? new Response('down', { status: 503 }) : new Response('{"result":[]}', { status: 200 })),
      },
    ]);
    await expect(client.getStats()).rejects.toMatchObject({ kind: 'http', status: 503 });
    await expect(client.getStats()).resolves.toEqual({ result: [] });
    expect(calls).toHaveLength(2);
  });

  it('C-10: baseUrl and realm come from the deps', async () => {
    const ff = fixtureFetch([{ match: /./, respond: { status: 200, body: { id: 'x', total: 0, result: [] } } }]);
    const client = new TradeApiClient({
      fetch: ff.fetch,
      credentials: noSession,
      limiter: new RateLimiter(),
      userAgent: UA,
      baseUrl: 'http://localhost:9/api/trade2/',
      realm: 'pc',
    });
    await client.search('Standard', AND_BODY, { auth: false });
    expect(ff.calls[0].url).toBe('http://localhost:9/api/trade2/search/pc/Standard');
  });

  it('C-10: fetch returns the raw result entries, nulls included', async () => {
    const { client } = makeClient([{ match: /\/fetch\//, respond: { status: 200, body: { result: [null, { id: 'x' }] } } }]);
    expect(await client.fetch(['x', 'y'], 'q', { auth: false })).toEqual([null, { id: 'x' }]);
  });
});

describe('AC-T10 (WU-14): fetch guard and URL', () => {
  const IDS = Array.from({ length: 11 }, (_, i) => `id${i.toString().padStart(2, '0')}`);

  it('AC-T10: fetch with 11 ids throws before sending', async () => {
    const { client, calls } = makeClient([{ match: /./, respond: { status: 200, body: { result: [] } } }]);
    await expect(client.fetch(IDS, 'q', { auth: false })).rejects.toThrow(/1 to 10 ids/);
    await expect(client.fetch([], 'q', { auth: false })).rejects.toThrow(/1 to 10 ids/);
    expect(calls).toHaveLength(0);
  });

  it('AC-T10: the fetch URL is .../fetch/<10 ids>?query=<id>&realm=poe2, with the cookie only when auth', async () => {
    const { client, calls } = makeClient([{ match: /\/fetch\//, respond: { fixture: 'trade2/fetch-weighted-session' } }]);
    const ten = IDS.slice(0, 10);
    const result = await client.fetch(ten, 'AbC123', { auth: true });
    expect(result).toHaveLength(10);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(`https://www.pathofexile.com/api/trade2/fetch/${ten.join(',')}?query=AbC123&realm=poe2`);
    expect(calls[0].headers.cookie).toBe(`POESESSID=${SESSION}`);
    expect(calls[0].headers['content-type']).toBeUndefined();
    await client.fetch(ten, 'AbC123', { auth: false });
    expect(calls[1].headers.cookie).toBeUndefined();
  });
});

describe('AC-T12 (WU-14, D-46): only /data/* is cached', () => {
  it('AC-T12: two identical search() calls send two requests', async () => {
    const { client, calls } = makeClient([{ match: SEARCH, respond: { fixture: 'trade2/search-body-armour' } }]);
    const a = await client.search('Runes of Aldur', AND_BODY, { auth: false });
    const b = await client.search('Runes of Aldur', AND_BODY, { auth: false });
    expect(a).toEqual(b);
    expect(calls.filter((c) => SEARCH.test(c.url))).toHaveLength(2);
  });

  it('AC-T12: two identical fetch() calls send two requests', async () => {
    const { client, calls } = makeClient([{ match: /\/fetch\//, respond: { fixture: 'trade2/fetch-body-armour' } }]);
    await client.fetch(['a'], 'q', { auth: false });
    await client.fetch(['a'], 'q', { auth: false });
    expect(calls).toHaveLength(2);
  });

  it('AC-T12: two getLeagues() calls within 4 h send one request; after 4 h, another', async () => {
    let t = 10_000_000;
    const { client, calls } = makeClient([{ match: /\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } }], withSession, {
      now: () => t,
    });
    const first = await client.getLeagues();
    t += 4 * 60 * 60 * 1000 - 1;
    const second = await client.getLeagues();
    expect(second).toEqual(first);
    expect(first.map((l) => l.id)).toEqual([
      'Forbidden Rites',
      'HC Forbidden Rites',
      'Runes of Aldur',
      'HC Runes of Aldur',
      'Standard',
      'Hardcore',
    ]);
    expect(calls).toHaveLength(1);
    t += 1;
    await client.getLeagues();
    expect(calls).toHaveLength(2);
  });
});
