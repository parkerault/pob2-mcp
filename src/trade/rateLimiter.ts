/**
 * The trade rate limiter (C-11).
 *
 * State is kept per **server policy** (`X-Rate-Limit-Policy`). For each policy it knows the rules
 * the server sent (`X-Rate-Limit-Rules`, then `X-Rate-Limit-<rule>` = `max:period:penalty` windows
 * and `X-Rate-Limit-<rule>-State` = `hits:period:active`), the requests sent, and a lockout time.
 *
 * - **Margin.** A window admits a request only while `sent-in-window + 1 <= max - margin` (margin 1,
 *   as PoB); when `max - margin < 1` the window's `max` is used.
 * - **Window edges.** A window of `period` P counts the sends in `(t - P - G, t]`, where G is
 *   `WINDOW_GUARD_MS` (1 s), and a send that waits for an old one to leave goes at `old + P + G`.
 *   That covers PoB's inclusive window (`timestamp >= now - window`) and its `+ window + 1` second
 *   guard: two sends that count against each other are always more than P + 1 s apart, so a server
 *   that counts its window inclusively, or at 1 s resolution, still sees at most `max - margin`.
 * - **Adopting server state** (D-35). When a window's state reports more hits than counted locally,
 *   synthetic sends at `now` make up the difference.
 * - **Lockouts.** A state with `active > 0`, or a 429, locks the policy until
 *   `now + max(active, Retry-After)` seconds; admissions then throw `locked_out`.
 * - **First request per endpoint class.** Until a class has a policy, its first request goes alone
 *   and the others wait until it settles (a response with or without headers, or an error).
 * - **No long sleeps.** A wait past the deadline or past `maxWaitMs` (default 30 s) throws
 *   `would_wait` without sleeping.
 * - **No send with under 1 s left** (D-22, risk R-1). A send that has to wait is refused as
 *   `would_wait` when it would go out with less than `MIN_SEND_LEFT_MS` before the deadline, both at
 *   admission and again after the wait (a sleep can overshoot, and waiting on a class's first request
 *   has no known end): a request sure to be cut by the deadline must not spend an account slot.
 *
 * Admitted requests reserve their send time at admission (in FIFO order per policy), so concurrent
 * admissions see each other.
 */
import { TradeError } from './errors.js';

export type Endpoint = 'search' | 'fetch';

export interface RateWindow {
  max: number;
  /** seconds */
  period: number;
  /** seconds */
  penalty: number;
}

export interface RateWindowState {
  hits: number;
  /** seconds */
  period: number;
  /** seconds of active penalty */
  active: number;
}

export interface ParsedRule {
  windows: RateWindow[];
  state: RateWindowState[];
}

export interface ParsedRateLimitHeaders {
  /** `X-Rate-Limit-Policy`, when present. */
  policy?: string;
  /** Keyed by lower-cased rule name. */
  rules: Record<string, ParsedRule>;
  /** `Retry-After` in seconds, when present and valid. */
  retryAfterS?: number;
}

type HeaderSource = Headers | Readonly<Record<string, string>>;

function headerGetter(headers: HeaderSource): (name: string) => string | null {
  if (typeof (headers as Headers).get === 'function') {
    const h = headers as Headers;
    return (name) => h.get(name);
  }
  const lower = new Map<string, string>();
  for (const [k, v] of Object.entries(headers as Record<string, string>)) lower.set(k.toLowerCase(), v);
  return (name) => lower.get(name.toLowerCase()) ?? null;
}

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function parseTriples(value: string | null): number[][] {
  return splitList(value)
    .map((part) => part.split(':').map((n) => Number(n)))
    .filter((t) => t.length === 3 && t.every((n) => Number.isFinite(n)));
}

/** Parse `Retry-After` as integer seconds (A-5), or undefined. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const n = Number(value.trim());
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : undefined;
}

/** Parse the rate-limit headers of one response. Rule names are case-insensitive. */
export function parseRateLimitHeaders(headers: HeaderSource): ParsedRateLimitHeaders {
  const get = headerGetter(headers);
  const out: ParsedRateLimitHeaders = { rules: {} };
  const policy = get('x-rate-limit-policy');
  if (policy && policy.trim() !== '') out.policy = policy.trim();
  for (const rule of splitList(get('x-rate-limit-rules')).map((r) => r.toLowerCase())) {
    const windows = parseTriples(get(`x-rate-limit-${rule}`)).map(([max, period, penalty]) => ({ max, period, penalty }));
    const state = parseTriples(get(`x-rate-limit-${rule}-state`)).map(([hits, period, active]) => ({ hits, period, active }));
    out.rules[rule] = { windows, state };
  }
  const retryAfterS = parseRetryAfter(get('retry-after'));
  if (retryAfterS !== undefined) out.retryAfterS = retryAfterS;
  return out;
}

/** Default `Retry-After` for a 429 without one (D-50). */
export const DEFAULT_RETRY_AFTER_S = 60;
/** Default longest wait the limiter will sleep through (C-11). */
export const DEFAULT_MAX_WAIT_MS = 30_000;
/**
 * Extra delay after an old send leaves a window before the next send that waited for it (PoB's
 * "extra second ... to avoid problems caused by the low resolution of os.time()",
 * `TradeQueryRateLimiter.lua:173,192`).
 */
export const WINDOW_GUARD_MS = 1_000;
/** After a wait, a send needs at least this long left before its deadline (D-22: no step starts with < 1 s left). */
export const MIN_SEND_LEFT_MS = 1_000;

interface PolicyState {
  /** Rule name → its windows (as last sent by the server). */
  rules: Map<string, RateWindow[]>;
  /** Send times (ms) of requests admitted under this policy, ascending; may include reservations in the future. */
  sent: number[];
  /** Synthetic sends adopted from server state, per `<rule>:<period>` window. */
  synthetic: Map<string, number[]>;
  lockedUntil: number;
}

export interface RateLimiterOptions {
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  margin?: number;
}

export interface RunOptions {
  deadline?: number;
  signal?: AbortSignal;
  maxWaitMs?: number;
}

/** An abortable `setTimeout` sleep that rejects with the signal's reason. */
function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Resolve when `p` settles, or reject early with the signal's reason. */
function untilSettledOrAborted(p: Promise<unknown>, signal?: AbortSignal): Promise<void> {
  const settled = p.then(
    () => undefined,
    () => undefined,
  );
  if (!signal) return settled;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    settled.then(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    });
  });
}

function insertSorted(list: number[], t: number): void {
  let i = list.length;
  while (i > 0 && list[i - 1] > t) i--;
  list.splice(i, 0, t);
}

function removeOne(list: number[], t: number): void {
  const i = list.indexOf(t);
  if (i >= 0) list.splice(i, 1);
}

export class RateLimiter {
  private readonly now: () => number;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly margin: number;
  private readonly policies = new Map<string, PolicyState>();
  /** Endpoint class → its last known policy name. */
  private readonly classPolicy = new Map<Endpoint, string>();
  /** Endpoint class → the in-flight first request (while the class has no policy). */
  private readonly firstInFlight = new Map<Endpoint, Promise<unknown>>();

  constructor(opts: RateLimiterOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? defaultSleep;
    this.margin = opts.margin ?? 1;
  }

  /**
   * Wrap one HTTP exchange for an endpoint class: admit (or refuse), send, record the response's
   * headers, and return the response. A 429 is returned (and locks its policy), not thrown.
   */
  async run(endpoint: Endpoint, send: () => Promise<Response>, opts: RunOptions = {}): Promise<Response> {
    // Before the class has a policy, its first request goes alone.
    const arrived = this.now();
    let waited = false;
    for (;;) {
      if (opts.signal?.aborted) throw opts.signal.reason;
      if (this.classPolicy.has(endpoint)) break;
      const inFlight = this.firstInFlight.get(endpoint);
      if (!inFlight) {
        if (waited) this.refuseIfTooLate(opts, this.now() - arrived);
        return this.runFirst(endpoint, send);
      }
      await untilSettledOrAborted(inFlight, opts.signal);
      waited = true;
    }
    if (waited) this.refuseIfTooLate(opts, this.now() - arrived);

    const policyName = this.classPolicy.get(endpoint)!;
    const policy = this.policy(policyName);
    const sendAt = this.admit(policy, opts);
    try {
      const wait = sendAt - this.now();
      if (wait > 0) await this.sleep(wait, opts.signal);
      if (opts.signal?.aborted) throw opts.signal.reason;
      const now = this.now();
      if (now < policy.lockedUntil) {
        throw lockedOut(policy.lockedUntil - now);
      }
      if (wait > 0) this.refuseIfTooLate(opts, wait);
    } catch (error) {
      // Not sent: release the reservation.
      removeOne(policy.sent, sendAt);
      throw error;
    }
    const response = await send();
    this.record(endpoint, response);
    return response;
  }

  /**
   * After a wait of `waitedMs` (> 0), refuse as the deadline's `would_wait` when less than
   * `MIN_SEND_LEFT_MS` remains: the request would be cut before it could finish (D-22, R-1).
   */
  private refuseIfTooLate(opts: RunOptions, waitedMs: number): void {
    if (opts.deadline === undefined) return;
    if (opts.deadline - this.now() >= MIN_SEND_LEFT_MS) return;
    const waitS = Math.max(1, Math.ceil(waitedMs / 1000));
    throw new TradeError(
      'would_wait',
      `the trade site's rate limit needed a wait of ${waitS} s, which left too little time before the deadline; try again later`,
      { waitS },
    );
  }

  /** The parsed state of one policy (test and diagnostics hook). */
  inspect(policyName: string): { rules: Record<string, RateWindow[]>; lockedUntil: number } | null {
    const p = this.policies.get(policyName);
    if (!p) return null;
    return { rules: Object.fromEntries([...p.rules].map(([k, v]) => [k, v.map((w) => ({ ...w }))])), lockedUntil: p.lockedUntil };
  }

  /** The policy an endpoint class currently maps to, if any (test and diagnostics hook). */
  policyFor(endpoint: Endpoint): string | undefined {
    return this.classPolicy.get(endpoint);
  }

  /** Record a response's headers outside `run` (e.g. a fixture fed directly). */
  observe(endpoint: Endpoint, response: Pick<Response, 'status' | 'headers'>): void {
    this.record(endpoint, response);
  }

  // ---------------------------------------------------------------------------------------------

  private async runFirst(endpoint: Endpoint, send: () => Promise<Response>): Promise<Response> {
    const sentAt = this.now();
    const exchange = send();
    this.firstInFlight.set(endpoint, exchange);
    try {
      const response = await exchange;
      this.record(endpoint, response, sentAt);
      return response;
    } finally {
      this.firstInFlight.delete(endpoint);
    }
  }

  private policy(name: string): PolicyState {
    let p = this.policies.get(name);
    if (!p) {
      p = { rules: new Map(), sent: [], synthetic: new Map(), lockedUntil: 0 };
      this.policies.set(name, p);
    }
    return p;
  }

  /**
   * Admission (C-11 steps 1-3): throws `locked_out` or `would_wait`, else reserves and returns the
   * send time.
   */
  private admit(policy: PolicyState, opts: RunOptions): number {
    const now = this.now();
    if (now < policy.lockedUntil) throw lockedOut(policy.lockedUntil - now);

    const sendAt = this.earliestSendTime(policy, now);
    const wait = sendAt - now;
    const maxWaitMs = opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    const pastDeadline =
      opts.deadline !== undefined && (sendAt > opts.deadline || (wait > 0 && opts.deadline - sendAt < MIN_SEND_LEFT_MS));
    if (!Number.isFinite(sendAt) || pastDeadline || wait > maxWaitMs) {
      const waitS = Number.isFinite(wait) ? Math.ceil(wait / 1000) : Infinity;
      throw new TradeError(
        'would_wait',
        `the trade site's rate limit would need a wait of ${Number.isFinite(waitS) ? `${waitS} s` : 'an unbounded time'}; try again later`,
        { waitS },
      );
    }
    insertSorted(policy.sent, sendAt);
    return sendAt;
  }

  /** The earliest time >= now (and >= every reservation) at which every window admits one more send. */
  private earliestSendTime(policy: PolicyState, now: number): number {
    let t = Math.max(now, policy.sent.length ? policy.sent[policy.sent.length - 1] : now);
    for (let iter = 0; iter < 10_000; iter++) {
      let moved = false;
      for (const [rule, windows] of policy.rules) {
        for (const w of windows) {
          const limit = w.max - this.margin < 1 ? w.max : w.max - this.margin;
          if (limit < 1) return Infinity;
          // The guarded window (t - P - G, t]: a superset of the inclusive [t - P, t] (see the header).
          const spanMs = w.period * 1000 + WINDOW_GUARD_MS;
          const stamps = this.windowStamps(policy, rule, w).filter((s) => s > t - spanMs && s <= t);
          if (stamps.length + 1 > limit) {
            // Wait until enough of the oldest sends leave the guarded window.
            const k = stamps.length - limit; // 0-based index of the send that must leave
            const next = stamps[k] + spanMs;
            if (next > t) {
              t = next;
              moved = true;
            }
          }
        }
      }
      if (!moved) return t;
    }
    return Infinity;
  }

  /** Real and synthetic send times counted by one window, ascending. */
  private windowStamps(policy: PolicyState, rule: string, w: RateWindow): number[] {
    const synthetic = policy.synthetic.get(`${rule}:${w.period}`) ?? [];
    return synthetic.length ? [...policy.sent, ...synthetic].sort((a, b) => a - b) : policy.sent;
  }

  /**
   * Record a response for an endpoint class; returns the policy it applied to. `firstSentAt` is the
   * send time of a class's first request, which is counted only now that its policy is known.
   */
  private record(endpoint: Endpoint, response: Pick<Response, 'status' | 'headers'>, firstSentAt?: number): PolicyState {
    const parsed = parseRateLimitHeaders(response.headers);
    const name = parsed.policy ?? this.classPolicy.get(endpoint) ?? `class:${endpoint}`;
    this.classPolicy.set(endpoint, name);
    const policy = this.policy(name);
    if (firstSentAt !== undefined) insertSorted(policy.sent, firstSentAt);

    for (const [rule, r] of Object.entries(parsed.rules)) {
      if (r.windows.length) policy.rules.set(rule, r.windows);
    }
    this.adoptState(policy, parsed);

    if (response.status === 429) {
      const active = maxActive(parsed);
      const seconds = Math.max(active, parsed.retryAfterS ?? DEFAULT_RETRY_AFTER_S);
      policy.lockedUntil = Math.max(policy.lockedUntil, this.now() + seconds * 1000);
    }
    return policy;
  }

  /** Adopt higher server hit counts (D-35) and active penalties from one response. */
  private adoptState(policy: PolicyState, parsed: ParsedRateLimitHeaders): void {
    const now = this.now();
    for (const [rule, r] of Object.entries(parsed.rules)) {
      for (const s of r.state) {
        const w = (policy.rules.get(rule) ?? []).find((x) => x.period === s.period) ?? { max: 0, period: s.period, penalty: 0 };
        const periodMs = w.period * 1000;
        // Local count over the half-open window: at the edge this counts fewer local sends, so more
        // synthetic ones are adopted (the conservative side).
        const local = this.windowStamps(policy, rule, w).filter((t) => t > now - periodMs && t <= now).length;
        if (s.hits > local) {
          const key = `${rule}:${w.period}`;
          const list = policy.synthetic.get(key) ?? [];
          // Drop synthetic sends that have left every guarded window of this period.
          const kept = list.filter((t) => t > now - periodMs - WINDOW_GUARD_MS);
          for (let i = local; i < s.hits; i++) kept.push(now);
          policy.synthetic.set(key, kept);
        }
      }
    }
    const active = maxActive(parsed);
    if (active > 0) {
      const seconds = Math.max(active, parsed.retryAfterS ?? 0);
      policy.lockedUntil = Math.max(policy.lockedUntil, now + seconds * 1000);
    }
    this.prune(policy, now);
  }

  /** Forget sends older than the longest window. */
  private prune(policy: PolicyState, now: number): void {
    let longest = 0;
    for (const windows of policy.rules.values()) for (const w of windows) longest = Math.max(longest, w.period * 1000);
    if (longest === 0) return;
    const cutoff = now - longest - WINDOW_GUARD_MS;
    let i = 0;
    while (i < policy.sent.length && policy.sent[i] <= cutoff) i++;
    if (i > 0) policy.sent.splice(0, i);
  }
}

function maxActive(parsed: ParsedRateLimitHeaders): number {
  let active = 0;
  for (const r of Object.values(parsed.rules)) for (const s of r.state) active = Math.max(active, s.active);
  return active;
}

function lockedOut(remainingMs: number): TradeError {
  const waitS = Math.ceil(remainingMs / 1000);
  return new TradeError(
    'locked_out',
    `the trade site's rate limit has locked this client out; try again in ${waitS} s`,
    { waitS },
  );
}
