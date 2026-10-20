/**
 * D-422 (WU-98): the trade site's 429 behind D1-finish's 22nd price call.
 *
 * Under one policy name the trade site sends logged-in requests (the cookie: `find_upgrades`) and
 * anonymous ones (`get_item_price`, `search_trade_items`) different `Ip` windows (spike S-4; the
 * committed captures: search 8:10, 15:60, 60:300 logged in against 5:10, 15:60, 30:300 anonymous).
 * The limiter kept one set of windows per policy and replaced it with each response's, so after a
 * logged-in response an anonymous search was admitted under the logged-in 60-per-300 s window. These
 * tests drive the real client and limiter over `fixtureFetch`, with a fake trade site that answers
 * with the captured headers and enforces each kind's windows; nothing reaches the network.
 */
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { TradeApiClient, TradeError } from '../../src/trade/tradeClient';
import { RateLimiter } from '../../src/trade/rateLimiter';
import type { Credentials } from '../../src/trade/credentials';
import { fixtureFetch } from '../helpers/fixtureFetch';
import { readTrade2 } from '../helpers/tradeFixtures';

type Kind = 'anon' | 'auth';
type HeaderMap = Record<string, string>;

const SESSION = 'SESSIONkinds42';
const withSession = (): Credentials => ({ sessionId: SESSION, source: 'dotenv' });
const LEAGUE = 'Forbidden Rites';
const QUERY = { query: { status: { option: 'available' }, name: 'Prism of Belief' }, sort: { price: 'asc' } };

/** Only the rate-limit headers of a capture (the policy, the rules, each rule's windows). */
function rateLimitHeaders(fixture: string): HeaderMap {
  const all = readTrade2<{ headers: HeaderMap }>(`${fixture}.headers.json`).headers;
  return Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('x-rate-limit-') && !k.endsWith('-state')));
}

const CAPTURES: Record<'search' | 'fetch', Record<Kind, HeaderMap>> = {
  search: { anon: rateLimitHeaders('search-body-armour'), auth: rateLimitHeaders('search-weighted-session') },
  fetch: { anon: rateLimitHeaders('fetch-body-armour'), auth: rateLimitHeaders('fetch-weighted-session') },
};

interface SiteWindow {
  max: number;
  period: number;
  penalty: number;
}

const windowsOf = (value: string): SiteWindow[] =>
  value.split(',').map((t) => {
    const [max, period, penalty] = t.split(':').map(Number);
    return { max, period, penalty };
  });

/** The rules a capture's headers name, lower-cased, with their windows. */
function rulesOf(headers: HeaderMap): Record<string, SiteWindow[]> {
  return Object.fromEntries(
    headers['x-rate-limit-rules'].split(/,\s*/).map((r) => [r.toLowerCase(), windowsOf(headers[`x-rate-limit-${r.toLowerCase()}`])]),
  );
}

/**
 * A fake trade site's search endpoint. It answers each kind with that kind's captured windows and a
 * state it counts itself, and refuses with a 429 a request that takes any window of its kind past its
 * max. Every request counts in one `Ip` tally (the site's per-IP count), and logged-in ones in the
 * `Account` tally; a window counts the hits in the closed interval [t - period, t].
 */
function fakeSearchSite(now: () => number) {
  const tallies: Record<string, number[]> = { ip: [], account: [] };
  const log: Array<{ at: number; kind: Kind; status: number }> = [];
  const respond = (_url: string, init: RequestInit | undefined): Response => {
    const t = now();
    const kind: Kind = new Headers(init?.headers).has('cookie') ? 'auth' : 'anon';
    tallies.ip.push(t);
    if (kind === 'auth') tallies.account.push(t);
    const headers: HeaderMap = { 'content-type': 'application/json', ...CAPTURES.search[kind] };
    let over: SiteWindow | null = null;
    for (const [rule, windows] of Object.entries(rulesOf(CAPTURES.search[kind]))) {
      headers[`x-rate-limit-${rule}-state`] = windows
        .map((w) => {
          const hits = tallies[rule].filter((x) => x >= t - w.period * 1000 && x <= t).length;
          if (hits > w.max && !over) over = w;
          return `${hits}:${w.period}:0`;
        })
        .join(',');
    }
    const refused = over as SiteWindow | null;
    log.push({ at: t, kind, status: refused ? 429 : 200 });
    if (refused) {
      headers['retry-after'] = String(refused.penalty);
      return new Response(JSON.stringify({ error: { code: 3, message: 'Rate limit exceeded' } }), { status: 429, headers });
    }
    return new Response(JSON.stringify({ id: 'q1', total: 0, result: [] }), { status: 200, headers });
  };
  return { respond, log };
}

/** A manual clock: the limiter's sleeps advance it. */
function manualClock(start = 10_000_000) {
  let t = start;
  return {
    now: () => t,
    sleep: jest.fn(async (ms: number) => {
      t += ms;
    }),
    advance(ms: number) {
      t += ms;
    },
  };
}

function makeTrade(clock: ReturnType<typeof manualClock>) {
  const site = fakeSearchSite(clock.now);
  const ff = fixtureFetch([{ match: /\/api\/trade2\/search\//, respond: site.respond }]);
  const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
  const client = new TradeApiClient({ fetch: ff.fetch, credentials: withSession, limiter, userAgent: 'pob2-mcp-server/test', now: clock.now });
  return { site, calls: ff.calls, limiter, client };
}

async function rejection(p: Promise<unknown>): Promise<TradeError> {
  try {
    await p;
  } catch (error) {
    return error as TradeError;
  }
  throw new Error('expected a rejection');
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('D-422 (WU-98): the limiter paces each request kind by its own windows', () => {
  it('the captures differ: logged-in and anonymous requests get different Ip windows under one policy name', () => {
    for (const endpoint of ['search', 'fetch'] as const) {
      const { anon, auth } = CAPTURES[endpoint];
      expect(anon['x-rate-limit-policy']).toBe(auth['x-rate-limit-policy']);
      expect(anon['x-rate-limit-ip']).not.toBe(auth['x-rate-limit-ip']);
    }
    // The anonymous search window that a logged-in response used to overwrite: 30 per 300 s against 60.
    expect(rulesOf(CAPTURES.search.anon).ip).toContainEqual({ max: 30, period: 300, penalty: 1800 });
    expect(rulesOf(CAPTURES.search.auth).ip).toContainEqual({ max: 60, period: 300, penalty: 1800 });
  });

  it.each(['search', 'fetch'] as const)(
    '%s: a logged-in response leaves the anonymous windows in place, and each kind is admitted under its own',
    (endpoint) => {
      const { anon, auth } = CAPTURES[endpoint];
      const policy = anon['x-rate-limit-policy'];
      const limiter = new RateLimiter();
      limiter.observe(endpoint, { status: 200, headers: new Headers(anon) }, false);
      limiter.observe(endpoint, { status: 200, headers: new Headers(auth) }, true);
      expect(limiter.inspect(policy, false)!.rules).toEqual(rulesOf(anon));
      expect(limiter.inspect(policy, true)!.rules).toEqual(rulesOf(auth));
      // And the other way round: an anonymous response leaves the logged-in windows in place.
      limiter.observe(endpoint, { status: 200, headers: new Headers(anon) }, false);
      expect(limiter.inspect(policy, true)!.rules).toEqual(rulesOf(auth));
    },
  );

  it('a kind with no response yet is admitted under every window known for the policy', () => {
    const { auth } = CAPTURES.search;
    const limiter = new RateLimiter();
    limiter.observe('search', { status: 200, headers: new Headers(auth) }, true);
    expect(limiter.inspect(auth['x-rate-limit-policy'], false)!.rules).toEqual(rulesOf(auth));
  });

  it('regression: an anonymous price search after 29 logged-in searches is held back (would_wait), not sent into a 429', async () => {
    const clock = manualClock();
    const { site, client } = makeTrade(clock);

    // D1-finish's mix: a unique priced anonymously (get_item_price), then find_upgrades' logged-in
    // weighted searches, paced by the limiter (it sleeps through the waits here).
    await client.search(LEAGUE, QUERY, { auth: false });
    for (let i = 0; i < 29; i++) {
      await client.search(LEAGUE, QUERY, { auth: true, maxWaitMs: 600_000 });
      clock.advance(500);
    }
    expect(site.log).toHaveLength(30);
    expect(site.log.every((r) => r.status === 200)).toBe(true);
    const span = site.log[29].at - site.log[0].at;
    expect(span).toBeLessThan(300_000); // all 30 are inside one 300 s window

    // The next unique, anonymously: 30 searches are already in the 300 s window, and the anonymous limit
    // is 30, so the site would refuse it. The limiter (anonymous windows, every send counted) holds it.
    const err = await rejection(client.search(LEAGUE, QUERY, { auth: false }));
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('would_wait');
    expect(site.log).toHaveLength(30);
    expect(site.log.some((r) => r.status === 429)).toBe(false);

    // Once the two oldest searches have left the window (plus the 1 s guard), 28 are counted and the
    // anonymous search goes as the 29th (30 less the margin of 1), and the site accepts it.
    clock.advance(site.log[1].at + 301_000 - clock.now());
    await client.search(LEAGUE, QUERY, { auth: false });
    expect(site.log).toHaveLength(31);
    expect(site.log[30]).toMatchObject({ kind: 'anon', status: 200 });
  });

  it('control: the logged-in searches themselves still pace by the logged-in windows (the 30th goes, under 60 per 300 s)', async () => {
    const clock = manualClock();
    const { site, client } = makeTrade(clock);
    await client.search(LEAGUE, QUERY, { auth: false });
    for (let i = 0; i < 30; i++) await client.search(LEAGUE, QUERY, { auth: true, maxWaitMs: 600_000 });
    expect(site.log).toHaveLength(31);
    expect(site.log.every((r) => r.status === 200)).toBe(true);
    expect(site.log[30].at - site.log[0].at).toBeLessThan(300_000);
  });

  it("a 429 is logged to stderr with the site's rate-limit headers and the limiter's counts, never the cookie", async () => {
    const lines: string[] = [];
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    const clock = manualClock();
    const { auth } = CAPTURES.search;
    const ff = fixtureFetch([
      {
        match: /\/api\/trade2\/search\//,
        respond: {
          status: 429,
          headers: { ...auth, 'x-rate-limit-account-state': '4:5:60', 'x-rate-limit-ip-state': '2:10:0,2:60:0,2:300:0,40:10800:0', 'retry-after': '60' },
          body: { error: { code: 3, message: 'Rate limit exceeded' } },
        },
      },
    ]);
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    const client = new TradeApiClient({ fetch: ff.fetch, credentials: withSession, limiter, userAgent: 'pob2-mcp-server/test', now: clock.now });
    const err = await rejection(client.search(LEAGUE, QUERY, { auth: true }));
    expect(err.kind).toBe('rate_limited');

    const line = lines.find((l) => l.startsWith('[RateLimiter] HTTP 429'));
    expect(line).toBeDefined();
    expect(line).toContain('trade-search-request-limit (auth request)');
    expect(line).toContain('account 3:5:60 state 4:5:60');
    expect(line).toContain('ip 8:10:60,15:60:120,60:300:1800,600:10800:3600 state 2:10:0,2:60:0,2:300:0,40:10800:0');
    expect(line).toContain('Retry-After 60');
    expect(line).toMatch(/counted account \d+\/3 per 5 s/);
    for (const l of lines) expect(l).not.toContain(SESSION);
  });
});
