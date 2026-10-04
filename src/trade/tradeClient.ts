/**
 * The trade2 HTTP client (C-10). Replaces `src/services/tradeClient.ts`.
 *
 * - **Requests.** `search` POSTs `{base}/search/{realm}/{league}`; `fetch` GETs
 *   `{base}/fetch/{ids}?query={id}&realm={realm}` (1..10 ids); `getStats`/`getLeagues` GET
 *   `{base}/data/stats|leagues`. Every request sends the D-25 User-Agent and `Accept: application/json`.
 * - **Cookie** (FR-T1). `Cookie: POESESSID=…` goes only on search and fetch, and only with
 *   `auth: true`; the credential getter is read per request. `auth: true` without a session throws
 *   `no_session` without sending. `Set-Cookie` is ignored.
 * - **Limiter.** Every search and fetch passes through the rate limiter (C-11).
 * - **Timeout.** Each request gets `min(15 s, deadline - now)` from a `setTimeout`-driven controller
 *   (Jest fake timers drive it; `AbortSignal.timeout` would not fire under them).
 * - **Classification** (D-24): the caller's abort is rethrown; then timeout; then a fetch failure is
 *   `network` (its message is never shown: it can echo header values); then by status, error code,
 *   the request's own body and the rate-limit headers, never by message text.
 * - **Caching** (D-46). Only `/data/stats` (process lifetime) and `/data/leagues` (4 h). Construction
 *   does no I/O.
 */
import type { ItemListing, StatData } from '../types/tradeTypes.js';
import { describeMissingSession, type Credentials } from './credentials.js';
import { TradeError } from './errors.js';
import { DEFAULT_RETRY_AFTER_S, parseRetryAfter, type Endpoint, type RateLimiter } from './rateLimiter.js';

export { TradeError } from './errors.js';
export type { TradeErrorKind } from './errors.js';

/** One raw `result` entry of a fetch response (may be `null` on the wire). */
export type FetchEntry = ItemListing;
export type StatsData = StatData;
export interface LeagueEntry {
  id: string;
  realm: string;
  text: string;
}
export interface SearchResponse {
  id: string;
  total: number;
  complexity?: number;
  result: string[];
  inexact?: boolean;
}

export interface TradeRequestOptions {
  auth: boolean;
  signal?: AbortSignal;
  /** Epoch ms. */
  deadline?: number;
  maxWaitMs?: number;
}

export interface TradeApiClientDeps {
  fetch: typeof globalThis.fetch;
  credentials: () => Credentials;
  limiter: RateLimiter;
  userAgent: string;
  /** env `POE_TRADE_BASE`. */
  baseUrl?: string;
  /** env `POE_TRADE_REALM`, default `poe2`. */
  realm?: string;
  now?: () => number;
}

export const DEFAULT_TRADE_BASE = 'https://www.pathofexile.com/api/trade2';
/** Per-request timeout cap (C-10). */
export const REQUEST_TIMEOUT_MS = 15_000;
/** `/data/leagues` cache lifetime (C-10). */
export const LEAGUES_TTL_MS = 4 * 60 * 60 * 1000;
/** Fetch block size (A-4). */
export const MAX_FETCH_IDS = 10;

const NETWORK_MESSAGE = 'network error contacting the trade site';

interface Exchange {
  response: Response;
  text: string;
  cookieSent: boolean;
}

/** Does a search body carry a weighted-sum stat group? (D-24 applies only to those.) */
function hasWeightGroup(body: unknown): boolean {
  const query = (body as { query?: { stats?: unknown } } | null)?.query;
  const stats = query?.stats;
  return Array.isArray(stats) && stats.some((g) => (g as { type?: unknown } | null)?.type === 'weight');
}

/** The trade error envelope `{error: {code, message}}`, if the body has one. */
function errorEnvelope(text: string): { code?: number; message?: string } {
  try {
    const parsed = JSON.parse(text) as { error?: { code?: unknown; message?: unknown } } | null;
    const e = parsed?.error;
    if (!e || typeof e !== 'object') return {};
    return {
      ...(typeof e.code === 'number' ? { code: e.code } : {}),
      ...(typeof e.message === 'string' ? { message: e.message } : {}),
    };
  } catch {
    return {};
  }
}

export class TradeApiClient {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly credentials: () => Credentials;
  private readonly limiter: RateLimiter;
  private readonly userAgent: string;
  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly now: () => number;

  private stats: Promise<StatsData> | null = null;
  private leagues: { value: LeagueEntry[]; fetchedAt: number } | null = null;
  private leaguesInFlight: Promise<LeagueEntry[]> | null = null;

  /** No I/O (C-7). */
  constructor(deps: TradeApiClientDeps) {
    this.fetchImpl = deps.fetch;
    this.credentials = deps.credentials;
    this.limiter = deps.limiter;
    this.userAgent = deps.userAgent;
    this.baseUrl = (deps.baseUrl || DEFAULT_TRADE_BASE).replace(/\/+$/, '');
    this.realm = deps.realm || 'poe2';
    this.now = deps.now ?? Date.now;
  }

  /** POST a search. Never cached (D-46). */
  async search(league: string, query: object, opts: TradeRequestOptions): Promise<SearchResponse> {
    const url = `${this.baseUrl}/search/${this.realm}/${encodeURIComponent(league)}`;
    const ex = await this.exchange('search', url, { method: 'POST', body: JSON.stringify(query) }, opts);
    this.throwIfError(ex, hasWeightGroup(query));
    const parsed = this.parseJson(ex) as Partial<SearchResponse>;
    return {
      id: String(parsed.id ?? ''),
      total: typeof parsed.total === 'number' ? parsed.total : 0,
      result: Array.isArray(parsed.result) ? parsed.result : [],
      ...(typeof parsed.complexity === 'number' ? { complexity: parsed.complexity } : {}),
      ...(typeof parsed.inexact === 'boolean' ? { inexact: parsed.inexact } : {}),
    };
  }

  /** GET up to 10 listings of a search. Returns the raw `result` entries, `null`s included. Never cached. */
  async fetch(ids: string[], queryId: string, opts: TradeRequestOptions): Promise<Array<FetchEntry | null>> {
    if (ids.length < 1 || ids.length > MAX_FETCH_IDS) {
      throw new RangeError(`trade fetch takes 1 to ${MAX_FETCH_IDS} ids, got ${ids.length}`);
    }
    const url =
      `${this.baseUrl}/fetch/${ids.map(encodeURIComponent).join(',')}` +
      `?query=${encodeURIComponent(queryId)}&realm=${encodeURIComponent(this.realm)}`;
    const ex = await this.exchange('fetch', url, { method: 'GET' }, opts);
    this.throwIfError(ex, false);
    const parsed = this.parseJson(ex) as { result?: unknown };
    return Array.isArray(parsed.result) ? (parsed.result as Array<FetchEntry | null>) : [];
  }

  /** `/data/stats`: loaded lazily, cached for the process once it succeeds. */
  getStats(): Promise<StatsData> {
    if (!this.stats) {
      const load = (async () => {
        const ex = await this.exchange(null, `${this.baseUrl}/data/stats`, { method: 'GET' }, { auth: false });
        this.throwIfError(ex, false);
        return this.parseJson(ex) as StatsData;
      })();
      this.stats = load;
      // A failure is not cached: the next call retries.
      load.catch(() => {
        if (this.stats === load) this.stats = null;
      });
    }
    return this.stats;
  }

  /** `/data/leagues` in API order, cached for 4 h. */
  async getLeagues(): Promise<LeagueEntry[]> {
    if (this.leagues && this.now() - this.leagues.fetchedAt < LEAGUES_TTL_MS) return this.leagues.value;
    if (!this.leaguesInFlight) {
      this.leaguesInFlight = (async () => {
        try {
          const ex = await this.exchange(null, `${this.baseUrl}/data/leagues`, { method: 'GET' }, { auth: false });
          this.throwIfError(ex, false);
          const parsed = this.parseJson(ex) as { result?: Array<Partial<LeagueEntry>> };
          const value = (Array.isArray(parsed.result) ? parsed.result : [])
            .filter((l) => typeof l?.id === 'string')
            .map((l) => ({ id: l.id as string, realm: String(l.realm ?? ''), text: String(l.text ?? l.id) }));
          this.leagues = { value, fetchedAt: this.now() };
          return value;
        } finally {
          this.leaguesInFlight = null;
        }
      })();
    }
    return this.leaguesInFlight;
  }

  // ---------------------------------------------------------------------------------------------

  /**
   * Send one request (through the limiter for search/fetch) and read its body, under the
   * per-request timeout. Classifies everything except HTTP status (C-10 steps 1-3).
   */
  private async exchange(
    endpoint: Endpoint | null,
    url: string,
    init: { method: 'GET' | 'POST'; body?: string },
    opts: TradeRequestOptions,
  ): Promise<Exchange> {
    if (opts.signal?.aborted) throw opts.signal.reason;

    const headers: Record<string, string> = { 'User-Agent': this.userAgent, Accept: 'application/json' };
    if (init.method === 'POST') headers['Content-Type'] = 'application/json';
    let cookieSent = false;
    if (opts.auth && endpoint !== null) {
      const creds = this.credentials();
      if (!creds.sessionId) throw new TradeError('no_session', describeMissingSession(creds));
      headers['Cookie'] = `POESESSID=${creds.sessionId}`;
      cookieSent = true;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeoutSignal: AbortSignal | undefined;
    const send = (): Promise<Response> => {
      const t = new AbortController();
      timeoutSignal = t.signal;
      const budget =
        opts.deadline === undefined ? REQUEST_TIMEOUT_MS : Math.min(REQUEST_TIMEOUT_MS, opts.deadline - this.now());
      timer = setTimeout(() => t.abort(new DOMException('timeout', 'TimeoutError')), Math.max(0, budget));
      const signal = opts.signal ? AbortSignal.any([t.signal, opts.signal]) : t.signal;
      return this.fetchImpl(url, { method: init.method, headers, body: init.body, signal });
    };

    try {
      const response =
        endpoint === null
          ? await send()
          : await this.limiter.run(endpoint, send, {
              deadline: opts.deadline,
              signal: opts.signal,
              maxWaitMs: opts.maxWaitMs,
            });
      const text = await response.text();
      return { response, text, cookieSent };
    } catch (error) {
      if (opts.signal?.aborted) throw opts.signal.reason;
      if (error instanceof TradeError) throw error;
      if (timeoutSignal?.aborted) {
        throw new TradeError('timeout', 'the trade site did not answer in time; try again later');
      }
      // A fetch TypeError (or any other transport failure): never show its message (FR-T1).
      throw new TradeError('network', NETWORK_MESSAGE);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  /** Classify a non-2xx response (C-10 step 4, D-24). */
  private throwIfError(ex: Exchange, weighted: boolean): void {
    const { response, text, cookieSent } = ex;
    const status = response.status;
    if (status >= 200 && status < 300) return;
    const { code, message } = errorEnvelope(text);
    const details = {
      status,
      ...(code !== undefined ? { code } : {}),
      ...(message !== undefined ? { serverMessage: message } : {}),
    };
    const shown = (prefix: string) => (message ? `${prefix}: ${message.slice(0, 300)}` : prefix);

    if (status === 400 && code === 2) {
      if (weighted && cookieSent) {
        const rules = (response.headers.get('x-rate-limit-rules') ?? '').toLowerCase();
        if (rules.split(/,\s*/).includes('account')) {
          throw new TradeError('too_complex', shown('the trade query is too complex'), details);
        }
        throw new TradeError(
          'session_rejected',
          'the trade site did not accept the session cookie (POESESSID); it has probably expired — log in on pathofexile.com and copy a fresh POESESSID into .env',
          details,
        );
      }
      throw new TradeError('invalid_query', shown('the trade site rejected the query'), details);
    }
    if (status === 401 || status === 403) {
      throw new TradeError(
        'auth',
        `trade rejected the request (HTTP ${status}); if you use a session cookie, refresh POESESSID in .env`,
        details,
      );
    }
    if (status === 429) {
      const retryAfterS = parseRetryAfter(response.headers.get('retry-after')) ?? DEFAULT_RETRY_AFTER_S;
      throw new TradeError('rate_limited', `rate limited by the trade site; retry after ${retryAfterS} s`, {
        ...details,
        retryAfterS,
      });
    }
    throw new TradeError('http', shown(`the trade site returned HTTP ${status}`), details);
  }

  private parseJson(ex: Exchange): unknown {
    try {
      return JSON.parse(ex.text);
    } catch {
      throw new TradeError('http', `the trade site returned an unreadable response (HTTP ${ex.response.status})`, {
        status: ex.response.status,
      });
    }
  }
}
