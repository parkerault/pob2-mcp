/**
 * The trade rate limiter (C-11).
 *
 * State is kept per **server policy** (`X-Rate-Limit-Policy`). For each policy it knows the rules
 * the server sent (`X-Rate-Limit-Rules`, then `X-Rate-Limit-<rule>` = `max:period:penalty` windows
 * and `X-Rate-Limit-<rule>-State` = `hits:period:active`), the requests sent, and a lockout time.
 *
 * - **Windows per request kind** (D-422). Under one policy name the trade site sends different `Ip`
 *   windows to a request with the session cookie (`auth`) and to one without (`anon`): search
 *   `8:10,15:60,60:300,600:10800` logged in against `5:10,15:60,30:300,600:21600` anonymous (spike
 *   S-4). So the windows are kept per kind, each replaced by its own kind's next response, and a
 *   request is admitted under its own kind's windows, counted over every send of the policy (both
 *   kinds: exact if the site counts them together, conservative if it doesn't). A kind with no
 *   response yet is admitted under every window known for the policy. Before this, one kind's
 *   response overwrote the other's windows, so after a logged-in `find_upgrades` an anonymous
 *   `get_item_price` search was admitted under the logged-in 60-per-300 s window, past the anonymous 30.
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
 * - **The search pace** (D-461, an option the server sets). Beside the site's windows, a search request
 *   (either kind) is sent no sooner than `gapMs` (45 s) after the previous search's send, and at most
 *   `cap.max` (7) searches go in any `cap.periodMs` (300 s). Fetches don't wait on it. Its state is the
 *   limiter's, across policies and kinds. A wait the pace sets and the limiter refuses is a `PaceWaitError`
 *   (`would_wait`), so a caller can tell the server's own gap from the site's windows.
 * - **No long sleeps.** A wait past the deadline or past `maxWaitMs` (default 60 s, D-461) throws
 *   `would_wait` without sleeping.
 * - **No send with under 1 s left** (D-22, risk R-1). A send that has to wait is refused as
 *   `would_wait` when it would go out with less than `MIN_SEND_LEFT_MS` before the deadline, both at
 *   admission and again after the wait (a sleep can overshoot, and waiting on a class's first request
 *   has no known end): a request sure to be cut by the deadline must not spend an account slot.
 * - **A 429 is logged** to stderr with the server's rate-limit headers and the limiter's own counts,
 *   so a refusal the limiter didn't foresee can be traced (no cookie or other header is logged), and
 *   handed as a `Trade429Entry` to the `on429` sink, which the server appends to
 *   `<stateDir>/trade-429.jsonl` (D-461, C-16). The limiter never sees a request header: only the
 *   response's rate-limit headers, as numbers, go into the entry.
 *
 * Admitted requests reserve their send time at admission (in FIFO order per policy), so concurrent
 * admissions see each other.
 */
import { TradeError } from './errors.js';

export type Endpoint = 'search' | 'fetch';

/** A request with the session cookie (`auth`) or without (`anon`); each kind has its own windows. */
export type RequestKind = 'anon' | 'auth';

function kindOf(auth: boolean | undefined): RequestKind {
  return auth ? 'auth' : 'anon';
}

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
/** Default longest wait the limiter will sleep through (C-11, raised from 30 s by D-461). */
export const DEFAULT_MAX_WAIT_MS = 60_000;
/**
 * Extra delay after an old send leaves a window before the next send that waited for it (PoB's
 * "extra second ... to avoid problems caused by the low resolution of os.time()",
 * `TradeQueryRateLimiter.lua:173,192`).
 */
export const WINDOW_GUARD_MS = 1_000;
/** After a wait, a send needs at least this long left before its deadline (D-22: no step starts with < 1 s left). */
export const MIN_SEND_LEFT_MS = 1_000;

interface PolicyState {
  /** Request kind → rule name → its windows (as the server last sent them to that kind). */
  rules: Map<RequestKind, Map<string, RateWindow[]>>;
  /** Send times (ms) of requests admitted under this policy, ascending; may include reservations in the future. */
  sent: number[];
  /** Synthetic sends adopted from server state, per `<rule>:<period>` window. */
  synthetic: Map<string, number[]>;
  lockedUntil: number;
}

/** D-461: the server's own pace for search requests, applied beside the site's windows. */
export interface SearchPace {
  /** The least time from one search's send to the next search's send, in ms (0: no gap). */
  gapMs: number;
  /** At most `max` searches sent in any `periodMs` (null: no cap). */
  cap: { max: number; periodMs: number } | null;
}

/** The pace the server runs with (D-461, the user's ruling): 45 s between searches, at most 7 in 300 s. */
export const TRADE_SEARCH_PACE: SearchPace = { gapMs: 45_000, cap: { max: 7, periodMs: 300_000 } };

/** One 429, as the limiter saw it (D-461's log line, less its time, which the sink stamps). */
export interface Trade429Entry {
  endpoint: Endpoint;
  kind: RequestKind;
  status: 429;
  /** Per rule (lower-cased): its windows and state from the headers, as `n:n:n` triples, or null when absent. */
  rules: Record<string, { limits: string | null; state: string | null }>;
  /** `Retry-After` in seconds, or null when absent or invalid. */
  retryAfter: number | null;
  /** The lockout the limiter applied, in seconds. */
  lockoutS: number;
  /** The limiter's own count in each window it admits this kind under. */
  counted: Array<{ rule: string; period: number; max: number; n: number }>;
}

export interface RateLimiterOptions {
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  margin?: number;
  /** D-461: the search pace (default none: only the site's windows hold a search back). */
  searchPace?: SearchPace | null;
  /** D-461: receives each 429's entry; a sink that throws is ignored (the call's result never changes). */
  on429?: (entry: Trade429Entry) => void;
}

/**
 * The limiter's `would_wait` when the server's own search pace (D-461), not the site's windows, set the
 * send time: `gapMs` is the pace's gap, so a caller can say the gap cut it short.
 */
export class PaceWaitError extends TradeError {
  constructor(
    waitS: number,
    readonly gapMs: number,
    readonly cap: SearchPace['cap'],
    tooLate = false,
  ) {
    const gapS = Math.round(gapMs / 1000);
    const pace =
      gapMs > 0
        ? `trade searches go at least ${gapS} s apart`
        : `at most ${cap?.max} trade searches go in ${Math.round((cap?.periodMs ?? 0) / 1000)} s`;
    super(
      'would_wait',
      tooLate
        ? `${pace} (the server's pace), and the wait of ${waitS} s left too little time before the deadline; try again later`
        : `${pace} (the server's pace), so this search would wait ${Number.isFinite(waitS) ? `${waitS} s` : 'an unbounded time'}; try again later`,
      { waitS },
    );
  }
}

export interface RunOptions {
  deadline?: number;
  signal?: AbortSignal;
  maxWaitMs?: number;
  /** The request carries the session cookie (default false): it is admitted under the logged-in windows. */
  auth?: boolean;
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
  /** D-461: the search pace, or null when off. */
  private readonly pace: SearchPace | null;
  /** D-461: send times (ms) of searches under the pace, ascending; may include reservations in the future. */
  private readonly searchSends: number[] = [];
  private readonly on429?: (entry: Trade429Entry) => void;

  constructor(opts: RateLimiterOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? defaultSleep;
    this.margin = opts.margin ?? 1;
    const pace = opts.searchPace ?? null;
    this.pace = pace && (pace.gapMs > 0 || pace.cap !== null) ? pace : null;
    this.on429 = opts.on429;
  }

  /**
   * Wrap one HTTP exchange for an endpoint class: admit (or refuse), send, record the response's
   * headers, and return the response. A 429 is returned (and locks its policy), not thrown.
   */
  async run(endpoint: Endpoint, send: () => Promise<Response>, opts: RunOptions = {}): Promise<Response> {
    const kind = kindOf(opts.auth);
    // Before the class has a policy, its first request goes alone.
    const arrived = this.now();
    let waited = false;
    for (;;) {
      if (opts.signal?.aborted) throw opts.signal.reason;
      if (this.classPolicy.has(endpoint)) break;
      const inFlight = this.firstInFlight.get(endpoint);
      if (!inFlight) {
        if (waited) this.refuseIfTooLate(opts, this.now() - arrived);
        return this.runFirst(endpoint, kind, send, opts);
      }
      await untilSettledOrAborted(inFlight, opts.signal);
      waited = true;
    }
    if (waited) this.refuseIfTooLate(opts, this.now() - arrived);

    const policyName = this.classPolicy.get(endpoint)!;
    const policy = this.policy(policyName);
    const { sendAt, paced } = this.admit(endpoint, policy, kind, opts);
    const counted = endpoint === 'search' && this.pace !== null;
    try {
      const wait = sendAt - this.now();
      if (wait > 0) await this.sleep(wait, opts.signal);
      if (opts.signal?.aborted) throw opts.signal.reason;
      const now = this.now();
      if (now < policy.lockedUntil) {
        throw lockedOut(policy.lockedUntil - now);
      }
      if (wait > 0) this.refuseIfTooLate(opts, wait, paced);
    } catch (error) {
      // Not sent: release the reservations.
      removeOne(policy.sent, sendAt);
      if (counted) removeOne(this.searchSends, sendAt);
      throw error;
    }
    const response = await send();
    this.record(endpoint, kind, response);
    return response;
  }

  /**
   * After a wait of `waitedMs` (> 0), refuse as the deadline's `would_wait` when less than
   * `MIN_SEND_LEFT_MS` remains: the request would be cut before it could finish (D-22, R-1). `paced`:
   * the search pace set the wait (D-461), so the refusal is a `PaceWaitError`.
   */
  private refuseIfTooLate(opts: RunOptions, waitedMs: number, paced = false): void {
    if (opts.deadline === undefined) return;
    if (opts.deadline - this.now() >= MIN_SEND_LEFT_MS) return;
    const waitS = Math.max(1, Math.ceil(waitedMs / 1000));
    if (paced && this.pace) throw new PaceWaitError(waitS, this.pace.gapMs, this.pace.cap, true);
    throw new TradeError(
      'would_wait',
      `the trade site's rate limit needed a wait of ${waitS} s, which left too little time before the deadline; try again later`,
      { waitS },
    );
  }

  /**
   * The parsed state of one policy (test and diagnostics hook): the windows a request of the given
   * kind (`auth`, default false) is admitted under, and the lockout time.
   */
  inspect(policyName: string, auth = false): { rules: Record<string, RateWindow[]>; lockedUntil: number } | null {
    const p = this.policies.get(policyName);
    if (!p) return null;
    const rules = this.admissionRules(p, kindOf(auth));
    return { rules: Object.fromEntries([...rules].map(([k, v]) => [k, v.map((w) => ({ ...w }))])), lockedUntil: p.lockedUntil };
  }

  /** The policy an endpoint class currently maps to, if any (test and diagnostics hook). */
  policyFor(endpoint: Endpoint): string | undefined {
    return this.classPolicy.get(endpoint);
  }

  /** Record a response's headers outside `run` (e.g. a fixture fed directly); `auth` is the request's kind. */
  observe(endpoint: Endpoint, response: Pick<Response, 'status' | 'headers'>, auth = false): void {
    this.record(endpoint, kindOf(auth), response);
  }

  // ---------------------------------------------------------------------------------------------

  /**
   * A class's first request goes alone. A search still keeps the pace (D-461): when an earlier search
   * failed before its class had a policy, the next first request waits out the gap from that send.
   * The wait is part of the in-flight first request, so the class's other requests wait behind it.
   */
  private async runFirst(
    endpoint: Endpoint,
    kind: RequestKind,
    send: () => Promise<Response>,
    opts: RunOptions,
  ): Promise<Response> {
    const counted = endpoint === 'search' && this.pace !== null;
    const now = this.now();
    let sendAt = now;
    if (counted) {
      sendAt = this.pacedTime(now, now);
      if (sendAt > now) this.refuseWait(sendAt, now, opts, true);
      insertSorted(this.searchSends, sendAt);
    }
    let sent = false;
    let sentAt = sendAt;
    const exchange = (async () => {
      const wait = sendAt - this.now();
      if (wait > 0) {
        await this.sleep(wait, opts.signal);
        if (opts.signal?.aborted) throw opts.signal.reason;
        this.refuseIfTooLate(opts, wait, true);
      }
      sentAt = this.now();
      sent = true;
      return send();
    })();
    this.firstInFlight.set(endpoint, exchange);
    try {
      const response = await exchange;
      this.record(endpoint, kind, response, sentAt);
      return response;
    } catch (error) {
      // Not sent: release the pace's reservation (a send that failed still counts).
      if (counted && !sent) removeOne(this.searchSends, sendAt);
      throw error;
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
  private admit(
    endpoint: Endpoint,
    policy: PolicyState,
    kind: RequestKind,
    opts: RunOptions,
  ): { sendAt: number; paced: boolean } {
    const now = this.now();
    if (now < policy.lockedUntil) throw lockedOut(policy.lockedUntil - now);

    // The site's windows first, then the pace (D-461) from there: both only admit more as time
    // passes, so the later of the two satisfies both.
    const siteAt = this.earliestSendTime(policy, kind, now);
    const counted = endpoint === 'search' && this.pace !== null;
    const sendAt = counted && Number.isFinite(siteAt) ? this.pacedTime(siteAt, now) : siteAt;
    const paced = sendAt > siteAt;
    this.refuseWait(sendAt, now, opts, paced);
    insertSorted(policy.sent, sendAt);
    if (counted) insertSorted(this.searchSends, sendAt);
    return { sendAt, paced };
  }

  /**
   * C-11 step 3: throw `would_wait` without sleeping when a send at `sendAt` is past the deadline, would
   * leave under 1 s before it, or needs a wait over `maxWaitMs` (a `PaceWaitError` when `paced`).
   */
  private refuseWait(sendAt: number, now: number, opts: RunOptions, paced: boolean): void {
    const wait = sendAt - now;
    const maxWaitMs = opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    const pastDeadline =
      opts.deadline !== undefined && (sendAt > opts.deadline || (wait > 0 && opts.deadline - sendAt < MIN_SEND_LEFT_MS));
    if (Number.isFinite(sendAt) && !pastDeadline && wait <= maxWaitMs) return;
    const waitS = Number.isFinite(wait) ? Math.ceil(wait / 1000) : Infinity;
    if (paced && this.pace) throw new PaceWaitError(waitS, this.pace.gapMs, this.pace.cap);
    throw new TradeError(
      'would_wait',
      `the trade site's rate limit would need a wait of ${Number.isFinite(waitS) ? `${waitS} s` : 'an unbounded time'}; try again later`,
      { waitS },
    );
  }

  /**
   * D-461: the earliest time >= `t` (and >= every search reservation) at which the pace admits one more
   * search: `gapMs` after the latest search's send, and fewer than `cap.max` sends in the `cap.periodMs`
   * before it. Old sends are forgotten here.
   */
  private pacedTime(t: number, now: number): number {
    const pace = this.pace;
    if (!pace) return t;
    const sends = this.searchSends;
    const keepMs = Math.max(pace.gapMs, pace.cap?.periodMs ?? 0);
    while (sends.length > 0 && sends[0] <= now - keepMs) sends.shift();
    if (sends.length === 0) return t;
    const last = sends[sends.length - 1];
    let at = Math.max(t, last + pace.gapMs);
    if (pace.cap) {
      const { max, periodMs } = pace.cap;
      const inWindow = sends.filter((s) => s > at - periodMs);
      // The oldest send that must leave the window: then `max - 1` remain, and this one makes `max`.
      if (inWindow.length >= max) at = Math.max(at, inWindow[inWindow.length - max] + periodMs);
    }
    return at;
  }

  /**
   * The windows a request of `kind` is admitted under: its own kind's, or, before that kind has had a
   * response, every window known for the policy.
   */
  private admissionRules(policy: PolicyState, kind: RequestKind): Map<string, RateWindow[]> {
    const own = policy.rules.get(kind);
    if (own) return own;
    const all = new Map<string, RateWindow[]>();
    for (const rules of policy.rules.values()) {
      for (const [rule, windows] of rules) all.set(rule, [...(all.get(rule) ?? []), ...windows]);
    }
    return all;
  }

  /** The earliest time >= now (and >= every reservation) at which every window admits one more send. */
  private earliestSendTime(policy: PolicyState, kind: RequestKind, now: number): number {
    const rules = this.admissionRules(policy, kind);
    let t = Math.max(now, policy.sent.length ? policy.sent[policy.sent.length - 1] : now);
    for (let iter = 0; iter < 10_000; iter++) {
      let moved = false;
      for (const [rule, windows] of rules) {
        for (const w of windows) {
          const limit = w.max - this.margin < 1 ? w.max : w.max - this.margin;
          if (limit < 1) return Infinity;
          // The guarded window (t - P - G, t]: a superset of the inclusive [t - P, t] (see the header).
          const spanMs = w.period * 1000 + WINDOW_GUARD_MS;
          const stamps = this.windowStamps(policy, rule, w.period).filter((s) => s > t - spanMs && s <= t);
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

  /** Real and synthetic send times counted by one window (`period` in seconds), ascending. */
  private windowStamps(policy: PolicyState, rule: string, period: number): number[] {
    const synthetic = policy.synthetic.get(`${rule}:${period}`) ?? [];
    return synthetic.length ? [...policy.sent, ...synthetic].sort((a, b) => a - b) : policy.sent;
  }

  /**
   * Record a response for an endpoint class and a request kind; returns the policy it applied to.
   * `firstSentAt` is the send time of a class's first request, which is counted only now that its
   * policy is known.
   */
  private record(
    endpoint: Endpoint,
    kind: RequestKind,
    response: Pick<Response, 'status' | 'headers'>,
    firstSentAt?: number,
  ): PolicyState {
    const parsed = parseRateLimitHeaders(response.headers);
    const name = parsed.policy ?? this.classPolicy.get(endpoint) ?? `class:${endpoint}`;
    this.classPolicy.set(endpoint, name);
    const policy = this.policy(name);
    if (firstSentAt !== undefined) insertSorted(policy.sent, firstSentAt);

    for (const [rule, r] of Object.entries(parsed.rules)) {
      if (!r.windows.length) continue;
      let rules = policy.rules.get(kind);
      if (!rules) {
        rules = new Map();
        policy.rules.set(kind, rules);
      }
      rules.set(rule, r.windows);
    }
    this.adoptState(policy, parsed);

    if (response.status === 429) {
      const active = maxActive(parsed);
      const seconds = Math.max(active, parsed.retryAfterS ?? DEFAULT_RETRY_AFTER_S);
      policy.lockedUntil = Math.max(policy.lockedUntil, this.now() + seconds * 1000);
      console.error(`[RateLimiter] ${this.describe429(name, kind, policy, response.headers)}`);
      this.log429(endpoint, kind, policy, response.headers, parsed, seconds);
    }
    return policy;
  }

  /** What this limiter counted in each window it admits `kind` under, now. */
  private countedWindows(policy: PolicyState, kind: RequestKind): Trade429Entry['counted'] {
    const now = this.now();
    const counted: Trade429Entry['counted'] = [];
    for (const [rule, windows] of this.admissionRules(policy, kind)) {
      for (const w of windows) {
        const spanMs = w.period * 1000 + WINDOW_GUARD_MS;
        const n = this.windowStamps(policy, rule, w.period).filter((t) => t > now - spanMs && t <= now).length;
        counted.push({ rule, period: w.period, max: w.max, n });
      }
    }
    return counted;
  }

  /**
   * One line for a 429: the server's rate-limit headers (numbers only) and what this limiter counted
   * in each window it admits the request's kind under. No other header is read.
   */
  private describe429(name: string, kind: RequestKind, policy: PolicyState, headers: HeaderSource): string {
    const get = headerGetter(headers);
    const server = splitList(get('x-rate-limit-rules')).map((rule) => {
      const r = rule.toLowerCase();
      return `${r} ${get(`x-rate-limit-${r}`) ?? '-'} state ${get(`x-rate-limit-${r}-state`) ?? '-'}`;
    });
    const counted = this.countedWindows(policy, kind).map((c) => `${c.rule} ${c.n}/${c.max} per ${c.period} s`);
    return (
      `HTTP 429 on ${name} (${kind} request): server ${server.join('; ') || 'sent no rules'}; ` +
      `Retry-After ${get('retry-after') ?? '-'}; counted ${counted.join(', ') || 'nothing'}`
    );
  }

  /**
   * D-461: hand the 429's entry to the sink. Only the rate-limit headers are read, re-joined from their
   * parsed numbers, so nothing else a response carries can reach the log; the request's headers (the
   * cookie among them) never reach the limiter at all. Neither building the entry nor the sink can
   * change the call's result.
   */
  private log429(
    endpoint: Endpoint,
    kind: RequestKind,
    policy: PolicyState,
    headers: HeaderSource,
    parsed: ParsedRateLimitHeaders,
    lockoutS: number,
  ): void {
    if (!this.on429) return;
    try {
      const get = headerGetter(headers);
      const triples = (value: string | null): string | null => {
        const t = parseTriples(value);
        return t.length ? t.map((x) => x.join(':')).join(',') : null;
      };
      const rules: Trade429Entry['rules'] = {};
      for (const rule of splitList(get('x-rate-limit-rules')).map((r) => r.toLowerCase())) {
        if (!/^[a-z0-9_-]+$/.test(rule)) continue;
        rules[rule] = { limits: triples(get(`x-rate-limit-${rule}`)), state: triples(get(`x-rate-limit-${rule}-state`)) };
      }
      this.on429({
        endpoint,
        kind,
        status: 429,
        rules,
        retryAfter: parsed.retryAfterS ?? null,
        lockoutS,
        counted: this.countedWindows(policy, kind),
      });
    } catch (error) {
      console.error(`[RateLimiter] the 429 log failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Adopt higher server hit counts (D-35) and active penalties from one response. */
  private adoptState(policy: PolicyState, parsed: ParsedRateLimitHeaders): void {
    const now = this.now();
    for (const [rule, r] of Object.entries(parsed.rules)) {
      for (const s of r.state) {
        const periodMs = s.period * 1000;
        // Local count over the half-open window: at the edge this counts fewer local sends, so more
        // synthetic ones are adopted (the conservative side).
        const local = this.windowStamps(policy, rule, s.period).filter((t) => t > now - periodMs && t <= now).length;
        if (s.hits > local) {
          const key = `${rule}:${s.period}`;
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

  /** Forget sends older than the longest window of either kind. */
  private prune(policy: PolicyState, now: number): void {
    let longest = 0;
    for (const rules of policy.rules.values()) {
      for (const windows of rules.values()) for (const w of windows) longest = Math.max(longest, w.period * 1000);
    }
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
