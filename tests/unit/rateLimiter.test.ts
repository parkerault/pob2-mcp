/**
 * The trade rate limiter (C-11). Unit tests with a fake clock: AC-T4, AC-T5 (NFR-9), AC-T6, AC-T7,
 * AC-T8. Header sets come from the committed trade2 fixtures (A-1, A-2).
 */
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { RateLimiter, parseRateLimitHeaders, type Endpoint, type RateWindow } from '../../src/trade/rateLimiter';
import { TradeError } from '../../src/trade/errors';

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

  it('AC-T6: a required wait of 40 s with the default maxWaitMs throws would_wait {waitS: 40} without sleeping', async () => {
    const clock = manualClock();
    const limiter = new RateLimiter({ now: clock.now, sleep: clock.sleep });
    // max 2 - margin 1 = 1 per 39 s; the next send waits 39 s plus the 1 s guard = 40 s.
    const headers = { ...base, 'x-rate-limit-ip': '2:39:60' };
    await limiter.run('search', async () => response(headers));
    const send = jest.fn(async () => response(headers));
    const err = await rejection(limiter.run('search', send));
    expect(err).toBeInstanceOf(TradeError);
    expect(err.kind).toBe('would_wait');
    expect(err.waitS).toBe(40);
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

  it("waiting on a class's first request until under 1 s is left refuses without sending", async () => {
    let t = 1_000_000;
    const limiter = new RateLimiter({ now: () => t });
    const first = deferred<Response>();
    const p1 = limiter.run('search', () => first.promise);
    const send2 = jest.fn(async () => response());
    const p2 = limiter.run('search', send2, { deadline: t + 5_000 });
    await flush();
    t += 4_500; // the first request took 4.5 s to answer
    first.resolve(response({ ...base, 'x-rate-limit-ip-state': '1:10:0' }));
    await p1;
    const err = await rejection(p2);
    expect(err.kind).toBe('would_wait');
    expect(send2).not.toHaveBeenCalled();
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
