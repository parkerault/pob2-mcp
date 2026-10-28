/**
 * The trade rate limiter (C-11). Unit tests with a fake clock: AC-T4, AC-T5 (NFR-9), AC-T6, AC-T7,
 * AC-T8. Header sets come from the committed trade2 fixtures (A-1, A-2).
 *
 * AC-K75 (WU-118, D-461): the server's search pace (the 45 s floor, the 7-in-300 s cap), the 60 s wait
 * caps, and the 429 log (`<stateDir>/trade-429.jsonl`), through the real limiter, the real trade client
 * over `fixtureFetch` and the server's real 429 sink, with a fake clock.
 */
import { describe, it, expect, jest, afterAll, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_MAX_WAIT_MS,
  PaceWaitError,
  RateLimiter,
  TRADE_SEARCH_PACE,
  parseRateLimitHeaders,
  type Endpoint,
  type RateWindow,
  type SearchPace,
  type Trade429Entry,
} from '../../src/trade/rateLimiter';
import { TradeError } from '../../src/trade/errors';
import { TradeApiClient } from '../../src/trade/tradeClient';
import { SEARCH_MAX_WAIT_MS } from '../../src/trade/findUpgrades';
import { TRADE_429_LOG, createTrade429Log } from '../../src/server/createServer';
import { fixtureFetch } from '../helpers/fixtureFetch';

const TRADE2 = path.resolve(__dirname, '..', 'fixtures', 'trade2');

function fixtureHeaders(name: string): Record<string, string> {
  return (JSON.parse(fs.readFileSync(path.join(TRADE2, `${name}.headers.json`), 'utf8')) as { headers: Record<string, string> })
    .headers;
}

function response(headers: Record<string, string> = {}, status = 200): Response {
  return new Response('{}', { status, headers });
}

/** A manual clock: `sleep` advances it (single logical thread of time). */
function manualClock(start = 1_000_000) {
  let t = start;
  const sleep = jest.fn(async (ms: number) => {
    t += ms;
  });
  return {
    now: () => t,
    sleep,
    advance(ms: number) {
      t += ms;
    },
  };
}

async function rejection(p: Promise<unknown>): Promise<TradeError> {
  try {
    await p;
  } catch (error) {
    return error as TradeError;
  }
  throw new Error('expected a rejection');
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((r) => setImmediate(r));

afterEach(() => {
  jest.useRealTimers();
});

describe('AC-T4 (WU-14, I-8d): per-policy rule parsing', () => {
  it('AC-T4: the logged-in search headers yield policy trade-search-request-limit with account [3:5:60] and 4 ip windows', () => {
    const limiter = new RateLimiter();
    limiter.observe('search', { status: 200, headers: new Headers(fixtureHeaders('search-weighted-session')) });
    expect(limiter.policyFor('search')).toBe('trade-search-request-limit');
    const policy = limiter.inspect('trade-search-request-limit')!;
    expect(policy.rules.account).toEqual([{ max: 3, period: 5, penalty: 60 }]);
    expect(policy.rules.ip).toHaveLength(4);
    expect(policy.rules.ip).toEqual([
      { max: 8, period: 10, penalty: 60 },
      { max: 15, period: 60, penalty: 120 },
      { max: 60, period: 300, penalty: 1800 },
      { max: 600, period: 10800, penalty: 3600 },
    ]);
    expect(Object.keys(policy.rules).sort()).toEqual(['account', 'ip']);
  });

  it('AC-T4: the logged-in fetch headers yield account [6:4:10]', () => {
    const limiter = new RateLimiter();
    limiter.observe('fetch', { status: 200, headers: new Headers(fixtureHeaders('fetch-weighted-session')) });
    expect(limiter.policyFor('fetch')).toBe('trade-fetch-request-limit');
    expect(limiter.inspect('trade-fetch-request-limit')!.rules.account).toEqual([{ max: 6, period: 4, penalty: 10 }]);
  });

  it.each(['search-body-armour', 'search-ring-divine', 'search-weighted-pob-shape', 'fetch-body-armour', 'fetch-belt-unique-chaos'])(
    'AC-T4: the anonymous fixture %s yields only the ip rule',
    (name) => {
      const parsed = parseRateLimitHeaders(fixtureHeaders(name));
      expect(Object.keys(parsed.rules)).toEqual(['ip']);
      expect(parsed.rules.ip.windows.length).toBeGreaterThan(0);
    },
  );

  it('AC-T4: rule-name case is ignored (Account = account), in the rules list and in header names', () => {
    const mixed = {
      'X-Rate-Limit-Policy': 'p',
      'X-Rate-Limit-Rules': 'ACCOUNT, Ip',
      'X-RATE-LIMIT-ACCOUNT': '3:5:60',
      'x-rate-limit-account-state': '1:5:0',
      'X-Rate-Limit-IP': '8:10:60',
    };
    const parsed = parseRateLimitHeaders(mixed);
    expect(parsed.policy).toBe('p');
    expect(parsed.rules.account.windows).toEqual([{ max: 3, period: 5, penalty: 60 }]);
    expect(parsed.rules.account.state).toEqual([{ hits: 1, period: 5, active: 0 }]);
    expect(parsed.rules.ip.windows).toEqual([{ max: 8, period: 10, penalty: 60 }]);
    // The same through a real Headers object.
    expect(parseRateLimitHeaders(new Headers(mixed))).toEqual(parsed);
  });
});

/**
 * How a server might count the sends in the window that ends at send `s`. Both readings are
 * inclusive of the window's start, which is the strict reading (PoB counts `timestamp >= now -
 * window`):
 * - `ms`: every send in the closed interval `[s - period, s]`;
 * - `1s`: timestamps truncated to whole seconds, so every send whose second is in
 *   `[sec(s) - period, sec(s)]`.
 */
const SERVER_READINGS = {
  ms: (x: number, s: number, periodMs: number) => x >= s - periodMs && x <= s,
  '1s': (x: number, s: number, periodMs: number) => Math.floor(x / 1000) >= Math.floor(s / 1000) - periodMs / 1000 && x <= s,
} as const;

/** Under both server readings, no window ending at a send holds more than `max - 1` sends. */
function assertWithinMargin(sends: number[], windows: RateWindow[], priorHits: Map<number, { at: number; hits: number }>): void {
  for (const [reading, inWindow] of Object.entries(SERVER_READINGS)) {
    for (const w of windows) {
      const periodMs = w.period * 1000;
      const prior = priorHits.get(w.period);
      for (const s of sends) {
        let count = sends.filter((x) => inWindow(x, s, periodMs)).length;
        if (prior && inWindow(prior.at, s, periodMs)) count += prior.hits;
        expect({ reading, window: `${w.max}:${w.period}`, at: s, count: Math.min(count, w.max - 1) }).toEqual({
          reading,
          window: `${w.max}:${w.period}`,
          at: s,
          count,
        });
      }
    }
  }
}

describe('AC-T5 (WU-14, NFR-9): no send exceeds any window max - 1', () => {
  it('AC-T5: a burst of 10 under the logged-in search policy keeps <= 2 sends per 5 s and every Ip window <= max - 1', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const headers = fixtureHeaders('search-weighted-session');
    const limiter = new RateLimiter();
    const sends: number[] = [];
    const send = async () => {
      sends.push(Date.now());
      return response(headers);
    };

    // The first response teaches the policy (its state reports 1 hit = this send, 27 on the 3 h window).
    await limiter.run('search', send);
    const burst = Array.from({ length: 10 }, () => limiter.run('search', send));
    await jest.advanceTimersByTimeAsync(60_000);
    await Promise.all(burst);

    expect(sends).toHaveLength(11);
    const policy = limiter.inspect('trade-search-request-limit')!;
    // Account 3:5 minus margin 1 = at most 2 sends in any closed 5 s interval [a, a + 5000].
    for (const a of sends) expect(sends.filter((x) => x >= a && x <= a + 5000).length).toBeLessThanOrEqual(2);
    assertWithinMargin(sends, policy.rules.account, new Map());
    // Ip windows: the server already counted 26 other requests on the 3 h window when the first answered.
    assertWithinMargin(sends, policy.rules.ip, new Map([[10800, { at: sends[0], hits: 26 }]]));
    // It paces the burst rather than refusing it: pairs go 6 s apart (the 5 s window plus PoB's 1 s
    // guard), never exactly 5 s apart, and the last send is 30 s after the first.
    expect(sends.map((x) => x - sends[0])).toEqual([0, 0, 6_000, 6_000, 12_000, 12_000, 18_000, 18_000, 24_000, 24_000, 30_000]);
  });

  it('AC-T5: concurrent sends never land exactly one window apart (regression: pairs at 0, 0, 5000, 5000 put 4 in a closed 5 s interval)', async () => {
    jest.useFakeTimers({ now: 2_000_000 });
    const headers = fixtureHeaders('search-weighted-session');
    const limiter = new RateLimiter();
    const sends: number[] = [];
    const send = async () => {
      sends.push(Date.now());
      return response(headers);
    };
    await limiter.run('search', send);
    const burst = Array.from({ length: 7 }, () => limiter.run('search', send));
    await jest.advanceTimersByTimeAsync(60_000);
    await Promise.all(burst);

    expect(sends).toHaveLength(8);
    const account = limiter.inspect('trade-search-request-limit')!.rules.account[0];
    expect(account).toEqual({ max: 3, period: 5, penalty: 60 });
    // Any send that waited for an older one to leave the Account window is more than 5 s + 1 s later.
    for (let i = 2; i < sends.length; i++) expect(sends[i] - sends[i - 2]).toBeGreaterThanOrEqual(6_000);
    // No closed 5 s interval, and no 5 s window counted at 1 s resolution, holds more than 2.
    assertWithinMargin(sends, [account], new Map());
  });

  it('AC-T5: 200 random-interval requests across the search and fetch policies never exceed any max - 1', async () => {
    jest.useFakeTimers({ now: 5_000_000 });
    const byEndpoint: Record<Endpoint, { headers: Record<string, string>; sends: number[] }> = {
      search: { headers: fixtureHeaders('search-weighted-session'), sends: [] },
      fetch: { headers: fixtureHeaders('fetch-weighted-session'), sends: [] },
    };
    const limiter = new RateLimiter();

    // Deterministic PRNG (mulberry32).
    let seed = 0x5eed;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };

    const pending: Promise<unknown>[] = [];
    let refused = 0;
    for (let i = 0; i < 200; i++) {
      const endpoint: Endpoint = rand() < 0.4 ? 'search' : 'fetch';
      const target = byEndpoint[endpoint];
      pending.push(
        limiter
          .run(
            endpoint,
            async () => {
              target.sends.push(Date.now());
              return response(target.headers);
            },
            { maxWaitMs: 120_000 },
          )
          .catch((e) => {
            if (e instanceof TradeError && e.kind === 'would_wait') refused++;
            else throw e;
          }),
      );
      await jest.advanceTimersByTimeAsync(Math.floor(rand() * 5000));
    }
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    await Promise.all(pending);

    const sent = byEndpoint.search.sends.length + byEndpoint.fetch.sends.length;
    expect(sent + refused).toBe(200);
    expect(sent).toBeGreaterThan(150);
    for (const [endpoint, { sends, headers }] of Object.entries(byEndpoint)) {
      const parsed = parseRateLimitHeaders(headers);
      const policy = limiter.inspect(parsed.policy!)!;
      expect(limiter.policyFor(endpoint as Endpoint)).toBe(parsed.policy);
      const prior = new Map<number, { at: number; hits: number }>();
      for (const s of parsed.rules.ip.state) if (s.hits > 1) prior.set(s.period, { at: sends[0], hits: s.hits - 1 });
      assertWithinMargin(sends, policy.rules.account, new Map());
      assertWithinMargin(sends, policy.rules.ip, prior);
    }
  });
});

describe('AC-T6 (WU-14): lockouts and long waits', () => {
  const base = {
    'x-rate-limit-policy': 'trade-search-request-limit',
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '8:10:60,15:60:120',
  };

  it('AC-T6: an active penalty in the state (ip ...:...:45) makes the next admission throw locked_out {waitS: 45} without sending', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    await limiter.run('search', async () => response({ ...base, 'x-rate-limit-ip-state': '9:10:45,9:60:0' }));
    const send = jest.fn(async () => response(base));
    const err = await rejection(limiter.run('search', send));
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('locked_out');
    expect(err.waitS).toBe(45);
    expect(send).not.toHaveBeenCalled();
    expect(clock.sleep).not.toHaveBeenCalled();

    clock.advance(45_000);
    await limiter.run('search', send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('AC-T6: a 429 with Retry-After 7 locks the policy for 7 s', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    const r = await limiter.run('search', async () => response({ ...base, 'retry-after': '7' }, 429));
    expect(r.status).toBe(429);
    const send = jest.fn(async () => response(base));
    clock.advance(6_000);
    const err = await rejection(limiter.run('search', send));
    expect(err.kind).toBe('locked_out');
    expect(err.waitS).toBe(1);
    expect(send).not.toHaveBeenCalled();
    clock.advance(1_000);
    await limiter.run('search', send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('AC-T6: a 429 with no policy header on a class with a known policy locks that policy', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    await limiter.run('fetch', async () => response({ ...base, 'x-rate-limit-policy': 'trade-fetch-request-limit' }));
    expect(limiter.policyFor('fetch')).toBe('trade-fetch-request-limit');

    await limiter.run('fetch', async () => response({ 'retry-after': '20' }, 429));
    expect(limiter.policyFor('fetch')).toBe('trade-fetch-request-limit');
    expect(limiter.inspect('trade-fetch-request-limit')!.lockedUntil).toBe(clock.now() + 20_000);
    const send = jest.fn(async () => response());
    const err = await rejection(limiter.run('fetch', send));
    expect(err.kind).toBe('locked_out');
    expect(err.waitS).toBe(20);
    expect(send).not.toHaveBeenCalled();
    // No synthetic policy was created for the header-less 429.
    expect(limiter.inspect('class:fetch')).toBeNull();
  });

  it('AC-T6: a 429 without Retry-After locks for the 60 s default', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    await limiter.run('search', async () => response(base, 429));
    expect(limiter.inspect('trade-search-request-limit')!.lockedUntil).toBe(clock.now() + 60_000);
  });

  // D-461 raised the default maxWaitMs from 30 s to 60 s: the 40 s of C-11's example is now waited, so the
  // refusal is shown at 61 s (AC-K75 below has the 50 s and 61 s pair under both caps).
  it('AC-T6 (D-461): a required wait of 61 s with the default maxWaitMs throws would_wait {waitS: 61} without sleeping', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    // max 2 - margin 1 = 1 per 60 s; the next send waits 60 s plus the 1 s guard = 61 s.
    const headers = { ...base, 'x-rate-limit-ip': '2:60:60' };
    await limiter.run('search', async () => response(headers));
    const send = jest.fn(async () => response(headers));
    const err = await rejection(limiter.run('search', send));
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('would_wait');
    expect(err.waitS).toBe(61);
    expect(clock.sleep).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('AC-T6: a wait past the deadline throws would_wait too, while a wait within both limits sleeps', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    const headers = { ...base, 'x-rate-limit-ip': '2:10:60' };
    await limiter.run('search', async () => response(headers));
    const err = await rejection(limiter.run('search', async () => response(headers), { deadline: clock.now() + 5_000 }));
    expect(err.kind).toBe('would_wait');
    expect(err.waitS).toBe(11); // the 10 s window plus the 1 s guard
    await limiter.run('search', async () => response(headers), { deadline: clock.now() + 20_000 });
    expect(clock.sleep).toHaveBeenCalledTimes(1);
    expect(clock.sleep.mock.calls[0][0]).toBe(11_000);
  });
});

describe('D-22 / R-1 (D-87): no send after a wait with less than 1 s before the deadline', () => {
  const base = {
    'x-rate-limit-policy': 'trade-search-request-limit',
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '2:10:60',
  };

  it('a wait that would end with 0.5 s left is refused at admission as would_wait, without sleeping or sending', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    await limiter.run('search', async () => response(base));
    const send = jest.fn(async () => response(base));
    // The next send may go at +11 s (10 s window + 1 s guard); the deadline is at +11.5 s.
    const err = await rejection(limiter.run('search', send, { deadline: clock.now() + 11_500 }));
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('would_wait');
    expect(clock.sleep).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    // With 1 s or more left after the wait, the send goes.
    await limiter.run('search', send, { deadline: clock.now() + 12_000 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a sleep that overshoots into the last second refuses after the wait, without sending, and releases the reservation', async () => {
    let t = 1_000_000;
    const sleep = jest.fn(async (ms: number) => {
      t += ms + 700; // the timer fired late
    });
    const limiter = new RateLimiter({ now: () => t, sleep });
    await limiter.run('search', async () => response(base));
    const send = jest.fn(async () => response(base));
    // Admission sees 1.5 s left after the 11 s wait; the late timer leaves only 0.8 s.
    const err = await rejection(limiter.run('search', send, { deadline: t + 12_500 }));
    expect(err.kind).toBe('would_wait');
    expect(err.message).toMatch(/too little time before the deadline/);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    // The refused request's reservation was released: the next send goes at once (the window has passed).
    sleep.mockClear();
    await limiter.run('search', send, { deadline: t + 5_000 });
    expect(sleep).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  // The first response's policy (8:10:60, one hit) admits the waiter at once: admission needs no wait,
  // so only the check after waiting on the first request can refuse it.
  const roomy = { ...base, 'x-rate-limit-ip': '8:10:60', 'x-rate-limit-ip-state': '1:10:0' };

  it("waiting on a class's first request until under 1 s is left refuses without sending (admission itself needs no wait)", async () => {
    let t = 1_000_000;
    const sleep = jest.fn(async (ms: number) => {
      t += ms;
    });
    const limiter = new RateLimiter({ now: () => t, sleep });
    const first = deferred<Response>();
    const p1 = limiter.run('search', () => first.promise);
    const send2 = jest.fn(async () => response(roomy));
    const p2 = limiter.run('search', send2, { deadline: t + 5_000 });
    await flush();
    t += 4_500; // the first request took 4.5 s to answer: 0.5 s left
    first.resolve(response(roomy));
    await p1;
    const err = await rejection(p2);
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('would_wait');
    expect(err.message).toMatch(/too little time before the deadline/);
    expect(send2).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
    // Control: the policy admits a send at once, so a request with 1 s left goes without a wait.
    await limiter.run('search', send2, { deadline: t + 1_000 });
    expect(send2).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waiting on a class's first request that fails, until under 1 s is left, refuses without sending", async () => {
    let t = 1_000_000;
    const limiter = new RateLimiter({ now: () => t });
    const first = deferred<Response>();
    const p1 = limiter.run('search', () => first.promise);
    const send2 = jest.fn(async () => response(roomy));
    const p2 = limiter.run('search', send2, { deadline: t + 5_000 });
    await flush();
    t += 4_500; // the first request failed after 4.5 s: 0.5 s left, and the class still has no policy
    first.reject(new Error('network down'));
    await expect(p1).rejects.toThrow('network down');
    const err = await rejection(p2);
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('would_wait');
    expect(err.message).toMatch(/too little time before the deadline/);
    expect(send2).not.toHaveBeenCalled();

    // Control: when a failed first request leaves 1.5 s, the waiter goes as the class's next first request.
    const again = deferred<Response>();
    const p3 = limiter.run('search', () => again.promise);
    const send4 = jest.fn(async () => response(roomy));
    const p4 = limiter.run('search', send4, { deadline: t + 5_000 });
    await flush();
    t += 3_500;
    again.reject(new Error('network down'));
    await expect(p3).rejects.toThrow('network down');
    await p4;
    expect(send4).toHaveBeenCalledTimes(1);
  });

  it('control: without a wait, a send with under 1 s left is not refused by the limiter (the caller checks between steps)', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    await limiter.run('search', async () => response({ ...base, 'x-rate-limit-ip': '8:10:60' }));
    const send = jest.fn(async () => response(base));
    await limiter.run('search', send, { deadline: clock.now() + 500 });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('AC-T7 (WU-14): the first request per endpoint class is serialized', () => {
  it('AC-T7: the second send starts only after the first settles', async () => {
    const limiter = new RateLimiter();
    const first = deferred<Response>();
    const order: string[] = [];
    const p1 = limiter.run('search', () => {
      order.push('send1');
      return first.promise;
    });
    const p2 = limiter.run('search', async () => {
      order.push('send2');
      return response();
    });
    await flush();
    await flush();
    expect(order).toEqual(['send1']);
    order.push('settle1');
    first.resolve(
      response({ 'x-rate-limit-policy': 'p', 'x-rate-limit-rules': 'ip', 'x-rate-limit-ip': '8:10:60', 'x-rate-limit-ip-state': '1:10:0' }),
    );
    await Promise.all([p1, p2]);
    expect(order).toEqual(['send1', 'settle1', 'send2']);
  });

  it('AC-T7: when the first send rejects (network error), the second still proceeds', async () => {
    const limiter = new RateLimiter();
    const first = deferred<Response>();
    const send2 = jest.fn(async () => response());
    const p1 = limiter.run('fetch', () => first.promise);
    const p2 = limiter.run('fetch', send2);
    await flush();
    expect(send2).not.toHaveBeenCalled();
    first.reject(new TypeError('fetch failed'));
    await expect(p1).rejects.toThrow('fetch failed');
    await p2;
    expect(send2).toHaveBeenCalledTimes(1);
  });

  it('AC-T7: when the first response has no rate-limit headers, the second still proceeds', async () => {
    const limiter = new RateLimiter();
    const first = deferred<Response>();
    const send2 = jest.fn(async () => response());
    const p1 = limiter.run('search', () => first.promise);
    const p2 = limiter.run('search', send2);
    await flush();
    expect(send2).not.toHaveBeenCalled();
    first.resolve(response());
    await Promise.all([p1, p2]);
    expect(send2).toHaveBeenCalledTimes(1);
    expect(limiter.policyFor('search')).toBe('class:search');
  });

  it('AC-T7: the classes are independent (a pending first search does not hold a fetch)', async () => {
    const limiter = new RateLimiter();
    const first = deferred<Response>();
    const fetchSend = jest.fn(async () => response());
    const p1 = limiter.run('search', () => first.promise);
    await limiter.run('fetch', fetchSend);
    expect(fetchSend).toHaveBeenCalledTimes(1);
    first.resolve(response());
    await p1;
  });
});

describe('AC-T8 (WU-14, D-35): adopting higher server hit counts', () => {
  const headers = (state: string) => ({
    'x-rate-limit-policy': 'p',
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '3:10:60', // max 3 - margin 1 = 2 per 10 s
    'x-rate-limit-ip-state': state,
  });

  it('AC-T8: with a local count of 1, a state reporting hits 2 makes the next admission wait as if 2 had been sent', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    await limiter.run('search', async () => response(headers('2:10:0')));
    clock.advance(1_000);
    await limiter.run('search', async () => response(headers('3:10:0')));
    // 2 counted sends at t0 (1 real + 1 adopted) fill the window (limit 2) until t0 + 10 s, plus
    // the 1 s guard.
    expect(clock.sleep).toHaveBeenCalledTimes(1);
    expect(clock.sleep.mock.calls[0][0]).toBe(10_000);
  });

  it('AC-T8: the same sequence without the higher server count does not wait (control)', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    await limiter.run('search', async () => response(headers('1:10:0')));
    clock.advance(1_000);
    await limiter.run('search', async () => response(headers('2:10:0')));
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it('AC-T8: the adopted count is visible to would_wait', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    await limiter.run('search', async () => response(headers('2:10:0')));
    clock.advance(1_000);
    // The window is full (1 real + 1 adopted): this one waits 10 s, and its own response reports 3
    // hits, so the next one would have to wait for the window to roll again.
    await limiter.run('search', async () => response(headers('3:10:0')), { maxWaitMs: 60_000 });
    const err = await rejection(limiter.run('search', async () => response(headers('3:10:0')), { maxWaitMs: 1_000 }));
    expect(err.kind).toBe('would_wait');
  });
});

// -------------------------------------------------------------------------------------------------
// AC-K75 (WU-118, D-461): the search pace, the 60 s caps and the 429 log

/** Site windows that never hold a send back here (99 per 10 s), under the given policy. */
const roomy = (policy: string): Record<string, string> => ({
  'x-rate-limit-policy': policy,
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '100:10:60',
  'x-rate-limit-ip-state': '1:10:0',
});
const SEARCH_POLICY = 'trade-search-request-limit';
const FETCH_POLICY = 'trade-fetch-request-limit';

/** A limiter on a manual clock with the given pace; `sends` records each send's endpoint and time. */
function paced(pace: SearchPace | null) {
  const clock = manualClock();
  const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep, searchPace: pace });
  const t0 = clock.now();
  const sends: Array<[string, number]> = [];
  const sender = (what: string, headers: Record<string, string>) =>
    jest.fn(async () => {
      sends.push([what, clock.now() - t0]);
      return response(headers);
    });
  return { clock, limiter, t0, sends, sender };
}

describe('AC-K75 (WU-118, D-461): the pace floor between searches', () => {
  it("AC-K75: a search 10 s after another is sent 45 s after the first's send; a fetch isn't held by the floor", async () => {
    const { clock, limiter, sends, sender } = paced(TRADE_SEARCH_PACE);
    await limiter.run('search', sender('search 1', roomy(SEARCH_POLICY)));
    clock.advance(10_000);
    await limiter.run('fetch', sender('fetch 1', roomy(FETCH_POLICY)));
    // Either request kind keeps the floor: the second search carries the cookie, the first didn't.
    await limiter.run('search', sender('search 2', roomy(SEARCH_POLICY)), { auth: true });
    await limiter.run('fetch', sender('fetch 2', roomy(FETCH_POLICY)));
    expect(sends).toEqual([
      ['search 1', 0],
      ['fetch 1', 10_000],
      ['search 2', 45_000],
      ['fetch 2', 45_000],
    ]);
    // The one wait is the search's, inside its call.
    expect(clock.sleep.mock.calls.map((c) => c[0])).toEqual([35_000]);
  });

  it('AC-K75: the floor holds a search whose class has no policy yet: a first search that failed still sets the gap', async () => {
    const { clock, limiter, sends, sender } = paced(TRADE_SEARCH_PACE);
    await expect(
      limiter.run('search', async () => {
        sends.push(['search 1 (network error)', 0]);
        throw new TypeError('fetch failed');
      }),
    ).rejects.toThrow('fetch failed');
    expect(limiter.policyFor('search')).toBeUndefined();
    clock.advance(5_000);
    await limiter.run('search', sender('search 2', roomy(SEARCH_POLICY)));
    expect(sends).toEqual([
      ['search 1 (network error)', 0],
      ['search 2', 45_000],
    ]);
  });

  it('AC-K75: a floor wait past the wait cap or the deadline is refused as would_wait (a PaceWaitError), without sleeping or sending', async () => {
    const { clock, limiter, sender } = paced(TRADE_SEARCH_PACE);
    await limiter.run('search', sender('search 1', roomy(SEARCH_POLICY)));
    const send = sender('search 2', roomy(SEARCH_POLICY));
    const capped = await rejection(limiter.run('search', send, { maxWaitMs: 30_000 }));
    expect(capped).toBeInstanceOf(PaceWaitError);
    expect(capped.kind).toBe('would_wait');
    expect(capped.waitS).toBe(45);
    expect((capped as PaceWaitError).gapMs).toBe(45_000);
    expect(capped.message).toMatch(/trade searches go at least 45 s apart/);
    // The send at +45 s would leave 0.5 s before the deadline (D-22: no step with under 1 s left).
    const late = await rejection(limiter.run('search', send, { deadline: clock.now() + 45_500 }));
    expect(late).toBeInstanceOf(PaceWaitError);
    expect(clock.sleep).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    // The refusals released their reservations: with 1 s to spare, the search goes at +45 s.
    await limiter.run('search', send, { deadline: clock.now() + 46_000 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(clock.sleep.mock.calls.map((c) => c[0])).toEqual([45_000]);
  });

  it('AC-K75: searches sent together queue 45 s apart, and one that would wait past 60 s comes back would_wait', async () => {
    // A sleep that ends later, not at once, so the two calls are admitted at the same moment.
    let t = 1_000_000;
    const sleep = jest.fn((ms: number) => new Promise<void>((resolve) => setImmediate(() => ((t += ms), resolve()))));
    const limiter = new RateLimiter({ now: () => t, sleep, searchPace: TRADE_SEARCH_PACE });
    const t0 = t;
    const sends: Array<[string, number]> = [];
    const sender = (what: string) => async () => {
      sends.push([what, t - t0]);
      return response(roomy(SEARCH_POLICY));
    };
    await limiter.run('search', sender('search 1'));
    t += 1_000;
    const p2 = limiter.run('search', sender('search 2'));
    const p3 = rejection(limiter.run('search', sender('search 3')));
    await p2;
    const err = await p3;
    expect(err).toBeInstanceOf(PaceWaitError);
    expect(err.waitS).toBe(89); // queued behind search 2's reservation at +45 s, so due at +90 s
    expect(sends).toEqual([
      ['search 1', 0],
      ['search 2', 45_000],
    ]);
  });

  it("AC-K75 (control): the site's own window refusal stays a plain would_wait, not the pace's", async () => {
    const { limiter, sender } = paced(null);
    const tight = { ...roomy(SEARCH_POLICY), 'x-rate-limit-ip': '2:60:60' };
    await limiter.run('search', sender('search 1', tight));
    const err = await rejection(limiter.run('search', sender('search 2', tight)));
    expect(err.kind).toBe('would_wait');
    expect(err).not.toBeInstanceOf(PaceWaitError);
  });
});

describe("AC-K75 (WU-118, D-461): a wait behind a class's first request is bounded by the deadline and the cap", () => {
  /** A clock the test sets, with sleeps that end only when the test releases them. */
  function heldClock() {
    const clock = { t: 1_000_000 };
    const pending: Array<{ ms: number; release: () => void }> = [];
    const sleep = jest.fn((ms: number) => new Promise<void>((resolve) => pending.push({ ms, release: resolve })));
    return { clock, pending, sleep, now: () => clock.t };
  }

  /** A's first search fails on the network at t0 (no policy yet); B's, 5 s later, waits out 40 s of the pace. */
  async function behindPacedFirst() {
    const h = heldClock();
    const limiter = new RateLimiter({ now: h.now, sleep: h.sleep, searchPace: TRADE_SEARCH_PACE });
    const t0 = h.clock.t;
    await expect(
      limiter.run('search', async () => {
        throw new TypeError('fetch failed');
      }),
    ).rejects.toThrow('fetch failed');
    h.clock.t = t0 + 5_000;
    const sendB = jest.fn(async () => response(roomy(SEARCH_POLICY)));
    const pB = limiter.run('search', sendB);
    await flush();
    expect(h.pending.map((p) => p.ms)).toEqual([40_000]);
    return { ...h, limiter, t0, sendB, pB };
  }

  it("AC-K75: a search arriving with 10 s to its deadline during another request's paced first search is refused at once, as the server's pace, not the site's", async () => {
    const { clock, pending, limiter, t0, sendB, pB } = await behindPacedFirst();
    const sendC = jest.fn(async () => response(roomy(SEARCH_POLICY)));
    const arrived = clock.t;
    const err = await rejection(limiter.run('search', sendC, { deadline: arrived + 10_000 }));
    expect(err).toBeInstanceOf(PaceWaitError);
    expect(err.kind).toBe('would_wait');
    // B goes at +45 s, so C no sooner than +90 s: 85 s after its arrival at +5 s.
    expect(err.waitS).toBe(85);
    expect(err.message).toMatch(/trade searches go at least 45 s apart \(the server's pace\)/);
    expect(err.message).not.toMatch(/trade site's rate limit/);
    expect(clock.t).toBe(arrived); // refused without waiting
    expect(sendC).not.toHaveBeenCalled();
    // B is unaffected: it goes at +45 s.
    clock.t = t0 + 45_000;
    pending[0].release();
    await pB;
    expect(sendB).toHaveBeenCalledTimes(1);
  });

  it("AC-K75: the cap counts from the search's arrival: past 60 s behind a paced first search it is refused at once; within 60 s it waits and goes at the pace's time", async () => {
    const { clock, pending, limiter, t0, sendB, pB } = await behindPacedFirst();
    // No deadline, the default 60 s cap: 85 s from +5 s is refused at once.
    const early = await rejection(limiter.run('search', jest.fn(async () => response(roomy(SEARCH_POLICY)))));
    expect(early).toBeInstanceOf(PaceWaitError);
    expect(early.waitS).toBe(85);
    // Under an explicit 30 s cap, too.
    clock.t = t0 + 40_000;
    const capped = await rejection(
      limiter.run('search', jest.fn(async () => response(roomy(SEARCH_POLICY))), { maxWaitMs: 30_000 }),
    );
    expect(capped).toBeInstanceOf(PaceWaitError);
    expect(capped.waitS).toBe(50);
    // At +40 s the wait to +90 s is 50 s: within the cap, it waits behind B, then goes at the pace's time.
    const sendC: jest.Mock<() => Promise<Response>> = jest.fn(async () => response(roomy(SEARCH_POLICY)));
    const sentAt: number[] = [];
    sendC.mockImplementation(async () => {
      sentAt.push(clock.t);
      return response(roomy(SEARCH_POLICY));
    });
    const pC = limiter.run('search', sendC);
    await flush();
    clock.t = t0 + 45_000;
    pending[0].release(); // B sends and settles
    await pB;
    expect(sendB).toHaveBeenCalledTimes(1);
    await flush();
    await flush();
    expect(pending.map((p) => p.ms)).toEqual([40_000, 45_000]); // C's own wait, from +45 s to +90 s
    clock.t = t0 + 90_000;
    pending[1].release();
    await pC;
    expect(sentAt).toEqual([t0 + 90_000]);
  });

  it("AC-K75: a request waiting on a class's hung first request ends at its deadline less 1 s, or at maxWaitMs from its arrival, as would_wait", async () => {
    jest.useFakeTimers({ now: new Date('2026-10-28T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const limiter = new RateLimiter();
    const first = deferred<Response>();
    const p1 = limiter.run('fetch', () => first.promise);
    const start = Date.now();
    const send2 = jest.fn(async () => response());
    const p2 = rejection(limiter.run('fetch', send2, { deadline: start + 5_000 }));
    const send3 = jest.fn(async () => response());
    const p3 = rejection(limiter.run('fetch', send3, { maxWaitMs: 3_000 }));
    await jest.advanceTimersByTimeAsync(3_000);
    const capped = await p3;
    expect(capped.kind).toBe('would_wait');
    expect(capped.message).toMatch(/would need a wait of over 3 s/);
    expect(Date.now() - start).toBe(3_000);
    await jest.advanceTimersByTimeAsync(1_000);
    const late = await p2;
    expect(late.kind).toBe('would_wait');
    expect(late.message).toMatch(/too little time before the deadline/);
    expect(Date.now() - start).toBe(4_000);
    expect(send2).not.toHaveBeenCalled();
    expect(send3).not.toHaveBeenCalled();
    first.resolve(response());
    await p1;
  });
});

describe('AC-K75 (WU-118, D-461): at most 7 searches in any 300 s', () => {
  it("AC-K75: the server's pace is 45 s between searches and at most 7 in 300 s", () => {
    expect(TRADE_SEARCH_PACE).toEqual({ gapMs: 45_000, cap: { max: 7, periodMs: 300_000 } });
  });

  it('AC-K75: with the floor off, 7 searches sent in 300 s hold an 8th until the window admits it', async () => {
    const { clock, limiter, t0, sends, sender } = paced({ gapMs: 0, cap: { max: 7, periodMs: 300_000 } });
    for (let i = 0; i < 7; i++) {
      clock.advance(i === 0 ? 0 : 10_000);
      await limiter.run('search', sender(`search ${i + 1}`, roomy(SEARCH_POLICY)));
    }
    // No floor: the 7 went 10 s apart, without a wait.
    expect(sends.map(([, t]) => t)).toEqual([0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000]);
    expect(clock.sleep).not.toHaveBeenCalled();
    clock.advance(10_000); // +70 s
    // The 8th is due when the first leaves the 300 s window, at +300 s: a 230 s wait, refused at 60 s.
    const send8 = sender('search 8', roomy(SEARCH_POLICY));
    const err = await rejection(limiter.run('search', send8));
    expect(err).toBeInstanceOf(PaceWaitError);
    expect(err.waitS).toBe(230);
    expect(send8).not.toHaveBeenCalled();
    // Allowed to wait, it goes as the window admits it, and the 9th as the second send leaves.
    await limiter.run('search', send8, { maxWaitMs: 600_000 });
    await limiter.run('search', sender('search 9', roomy(SEARCH_POLICY)), { maxWaitMs: 600_000 });
    expect(sends.slice(7)).toEqual([
      ['search 8', 300_000],
      ['search 9', 310_000],
    ]);
    expect(clock.now() - t0).toBe(310_000);
  });
});

describe('AC-K75 (WU-118, D-461): the 60 s wait caps', () => {
  const base = { 'x-rate-limit-policy': SEARCH_POLICY, 'x-rate-limit-rules': 'Ip' };

  it.each([
    ["the limiter's default", undefined],
    ["find_upgrades' own cap", SEARCH_MAX_WAIT_MS],
  ])('AC-K75: a needed wait of 50 s is waited under %s; 61 s is would_wait', async (_label, maxWaitMs) => {
    expect(DEFAULT_MAX_WAIT_MS).toBe(60_000);
    expect(SEARCH_MAX_WAIT_MS).toBe(60_000);
    const opts = maxWaitMs === undefined ? {} : { maxWaitMs };
    // 1 per 49 s (max 2 - margin 1), plus the 1 s guard: 50 s.
    const fifty = { ...base, 'x-rate-limit-ip': '2:49:60' };
    const a = manualClock();
    const waits = new RateLimiter({ now: a.now, sleep: a.sleep });
    await waits.run('search', async () => response(fifty), opts);
    const send = jest.fn(async () => response(fifty));
    await waits.run('search', send, opts);
    expect(send).toHaveBeenCalledTimes(1);
    expect(a.sleep.mock.calls.map((c) => c[0])).toEqual([50_000]);

    const sixtyOne = { ...base, 'x-rate-limit-ip': '2:60:60' };
    const b = manualClock();
    const refuses = new RateLimiter({ now: b.now, sleep: b.sleep });
    await refuses.run('search', async () => response(sixtyOne), opts);
    const send2 = jest.fn(async () => response(sixtyOne));
    const err = await rejection(refuses.run('search', send2, opts));
    expect(err.kind).toBe('would_wait');
    expect(err.waitS).toBe(61);
    expect(send2).not.toHaveBeenCalled();
    expect(b.sleep).not.toHaveBeenCalled();
  });

  it("AC-K75: the 45 s gap is waited inside the call under find_upgrades' own cap", async () => {
    const { limiter, sends, sender } = paced(TRADE_SEARCH_PACE);
    await limiter.run('search', sender('search 1', roomy(SEARCH_POLICY)), { maxWaitMs: SEARCH_MAX_WAIT_MS });
    await limiter.run('search', sender('search 2', roomy(SEARCH_POLICY)), { maxWaitMs: SEARCH_MAX_WAIT_MS });
    expect(sends).toEqual([
      ['search 1', 0],
      ['search 2', 45_000],
    ]);
  });
});

describe('AC-K75 (WU-118, D-461): the 429 log', () => {
  const SENTINEL = 'SENTINEL429c00k1e';
  const LEAGUE = 'Forbidden Rites';
  const AT = Date.parse('2026-10-27T14:03:11Z');
  /** The logged-in search capture's rule shape, as a 429 would carry it (numbers illustrative). */
  const TOO_MANY: Record<string, string> = {
    'content-type': 'application/json',
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Account,Ip',
    'x-rate-limit-account': '3:5:60',
    'x-rate-limit-account-state': '4:5:60',
    'x-rate-limit-ip': '8:10:60,15:60:120,60:300:1800',
    'x-rate-limit-ip-state': '9:10:60,15:60:0,19:300:0',
    'retry-after': '600',
    // Headers that must never reach the log, the cookie echoed among them.
    'set-cookie': `POESESSID=${SENTINEL}; path=/; secure`,
    'x-echo': SENTINEL,
    'cf-ray': 'a4507add9fbb9e12-IAH',
  };
  const OK: Record<string, string> = {
    'content-type': 'application/json',
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Account,Ip',
    'x-rate-limit-account': '3:5:60',
    'x-rate-limit-account-state': '1:5:0',
    'x-rate-limit-ip': '8:10:60,15:60:120,60:300:1800',
    'x-rate-limit-ip-state': '1:10:0,1:60:0,1:300:0',
  };

  const made: string[] = [];
  function tmpDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-429-log-'));
    made.push(dir);
    return dir;
  }
  afterAll(() => {
    for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
  });

  /** A client and limiter whose 429s go to the server's sink in `stateDir`; the n-th search gets `statuses[n]`. */
  function tradeWithLog(stateDir: string, statuses: number[], on429?: (e: Trade429Entry) => void) {
    const clock = manualClock();
    const start = clock.now();
    let n = 0;
    const ff = fixtureFetch([
      {
        match: /\/api\/trade2\/search\//,
        respond: () => {
          const status = statuses[Math.min(n, statuses.length - 1)];
          n += 1;
          return status === 429
            ? new Response(JSON.stringify({ error: { code: 3, message: 'Rate limit exceeded' } }), { status, headers: TOO_MANY })
            : new Response(JSON.stringify({ id: `s${n}`, total: 0, result: [] }), { status, headers: OK });
        },
      },
    ]);
    const limiter = new RateLimiter({
      now: clock.now,
      sleep: clock.sleep,
      // The log's wall clock reads AT when the test starts and moves with the fake clock.
      on429: on429 ?? createTrade429Log({ stateDir, now: () => AT + (clock.now() - start) }),
    });
    const client = new TradeApiClient({
      fetch: ff.fetch,
      credentials: () => ({ sessionId: SENTINEL, source: 'dotenv' }),
      limiter,
      userAgent: 'pob2-mcp-server/test',
      now: clock.now,
    });
    const search = () => client.search(LEAGUE, { query: { status: { option: 'securable' } } }, { auth: true });
    return { clock, ff, limiter, search };
  }

  const logLines = (stateDir: string): string[] =>
    fs.readFileSync(path.join(stateDir, TRADE_429_LOG), 'utf8').split('\n').filter((l) => l !== '');

  it('AC-K75: a 429 appends one line to <stateDir>/trade-429.jsonl with the rate-limit headers, Retry-After, the counts, the time and the request kind', async () => {
    const stateDir = path.join(tmpDir(), 'state'); // missing: the sink makes it
    const { clock, search } = tradeWithLog(stateDir, [200, 429]);
    await search();
    clock.advance(1_000);
    const err = await rejection(search());
    expect(err.kind).toBe('rate_limited');
    const lines = logLines(stateDir);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      at: '2026-10-27T14:03:12Z',
      endpoint: 'search',
      kind: 'auth',
      status: 429,
      rules: {
        account: { limits: '3:5:60', state: '4:5:60' },
        ip: { limits: '8:10:60,15:60:120,60:300:1800', state: '9:10:60,15:60:0,19:300:0' },
      },
      retryAfter: 600,
      lockoutS: 600,
      // Both sends counted, raised to the hits the 429's state reports (D-35).
      counted: [
        { rule: 'account', period: 5, max: 3, n: 4 },
        { rule: 'ip', period: 10, max: 8, n: 9 },
        { rule: 'ip', period: 60, max: 15, n: 15 },
        { rule: 'ip', period: 300, max: 60, n: 19 },
      ],
    });
  });

  it('AC-K75: a request sent with a sentinel cookie leaves no trace of the sentinel, or of any request header, in the file', async () => {
    const stateDir = tmpDir();
    const { ff, search } = tradeWithLog(stateDir, [429]);
    await rejection(search());
    // The cookie went out on the request (and came back in the response's headers)...
    expect(ff.calls[0].headers.cookie).toBe(`POESESSID=${SENTINEL}`);
    // ...and nothing of it, or of any other header, is in the log.
    const text = fs.readFileSync(path.join(stateDir, TRADE_429_LOG), 'utf8');
    expect(text.includes(SENTINEL)).toBe(false);
    for (const word of ['POESESSID', 'cookie', 'user-agent', 'pob2-mcp-server', 'cf-ray', 'x-echo', 'content-type']) {
      expect(text.toLowerCase().includes(word.toLowerCase())).toBe(false);
    }
    expect(logLines(stateDir)).toHaveLength(1);
  });

  it('AC-K75: after 205 429s the file holds the last 200', async () => {
    const stateDir = tmpDir();
    const { clock, search } = tradeWithLog(stateDir, [429]);
    const times: string[] = [];
    for (let i = 0; i < 205; i++) {
      const err = await rejection(search());
      expect(err.kind).toBe('rate_limited');
      times.push(new Date(AT + i * 601_000).toISOString().replace(/\.\d{3}Z$/, 'Z'));
      clock.advance(601_000); // past the 600 s lockout
    }
    const lines = logLines(stateDir);
    expect(lines).toHaveLength(200);
    // Appended in order, the oldest 5 trimmed: each line's time tells them apart.
    expect(lines.map((l) => (JSON.parse(l) as { at: string; status: number }).at)).toEqual(times.slice(5));
    for (const line of lines) expect((JSON.parse(line) as { status: number }).status).toBe(429);
    expect(fs.readFileSync(path.join(stateDir, TRADE_429_LOG), 'utf8').endsWith('\n')).toBe(true);
    expect(fs.readdirSync(stateDir)).toEqual([TRADE_429_LOG]);
  });

  it("AC-K75: a log that can't be written (or a corrupt one, or a sink that throws) leaves the call's result unchanged", async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const outcome = async (stateDir: string, on429?: (e: Trade429Entry) => void) => {
      const { clock, limiter, search } = tradeWithLog(stateDir, [429], on429);
      const err = await rejection(search());
      const next = await rejection(search()); // the lockout holds either way
      return {
        first: { kind: err.kind, message: err.message, retryAfterS: err.retryAfterS, status: err.status },
        next: { kind: next.kind, waitS: next.waitS },
        lockedUntil: limiter.inspect(SEARCH_POLICY)!.lockedUntil - clock.now(),
      };
    };
    const good = tmpDir();
    const expected = await outcome(good);
    expect(expected.first.kind).toBe('rate_limited');
    expect(expected.next.kind).toBe('locked_out');
    expect(logLines(good)).toHaveLength(1);

    // The state dir's place is taken by a file: no folder can be made, so nothing can be written.
    const blocked = tmpDir();
    fs.writeFileSync(path.join(blocked, 'state'), 'not a folder');
    expect(await outcome(path.join(blocked, 'state'))).toEqual(expected);
    expect(errors.mock.calls.map((c) => String(c[0])).some((m) => /could not write the 429 log/.test(m))).toBe(true);

    // A folder where the log file should be: it can't be read or appended to.
    const dirInPlace = tmpDir();
    fs.mkdirSync(path.join(dirInPlace, TRADE_429_LOG));
    expect(await outcome(dirInPlace)).toEqual(expected);

    // A corrupt log, its last line cut short: the call is unchanged, the new line is appended on a line of its own.
    const corrupt = tmpDir();
    fs.writeFileSync(path.join(corrupt, TRADE_429_LOG), 'garbage\n{"at": "2026-10-27T1');
    errors.mockClear();
    expect(await outcome(corrupt)).toEqual(expected);
    const lines = logLines(corrupt);
    expect(lines).toHaveLength(3);
    expect((JSON.parse(lines[2]) as { status: number }).status).toBe(429);
    expect(errors.mock.calls.map((c) => String(c[0])).some((m) => /2 unreadable line/.test(m))).toBe(true);

    // A sink that throws: the limiter swallows it.
    expect(
      await outcome(tmpDir(), () => {
        throw new Error('sink failed');
      }),
    ).toEqual(expected);
    errors.mockRestore();
  });
});
