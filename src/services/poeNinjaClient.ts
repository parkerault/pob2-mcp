/**
 * poe.ninja PoE2 HTTP client: the currency exchange overview, and nothing else.
 *
 * `GET https://poe.ninja/poe2/api/economy/exchange/current/overview?league=<league>&type=Currency`
 * with the D-25 User-Agent. The conversion logic lives in `src/trade/currency.ts` (C-12); this
 * module only does the HTTP, including the conditional request (`If-None-Match`; poe.ninja:
 * "ETag-based. Use conditional requests").
 */

export const POE_NINJA_OVERVIEW_URL = 'https://poe.ninja/poe2/api/economy/exchange/current/overview';
/** Per-request timeout. */
export const POE_NINJA_TIMEOUT_MS = 15_000;

/** The parts of the overview response the currency service reads (https://poe.ninja/docs/api). */
export interface CurrencyOverviewResponse {
  core?: {
    /** The league's primary reference currency, per response (D-33). */
    primary?: string;
    secondary?: string;
    /** Units of each currency per 1 primary (A-14). */
    rates?: Record<string, number>;
    items?: Array<{ id: string; name?: string }>;
  };
  /** `primaryValue` = value in the primary currency; `id` = the trade currency id. */
  lines?: Array<{ id: string; primaryValue?: number }>;
  items?: Array<{ id: string; name?: string }>;
}

export type OverviewResult =
  | { status: 'ok'; body: CurrencyOverviewResponse; etag: string | null }
  | { status: 'not_modified' };

export class PoeNinjaClient {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly userAgent: string;

  /** No I/O (C-7). */
  constructor(deps: { fetch: typeof globalThis.fetch; userAgent: string }) {
    this.fetchImpl = deps.fetch;
    this.userAgent = deps.userAgent;
  }

  /**
   * Fetch the currency overview for a league. With `etag`, the request is conditional and a 304
   * comes back as `not_modified`. Any other non-2xx, a timeout or a transport failure throws.
   */
  async currencyOverview(league: string, etag?: string | null): Promise<OverviewResult> {
    const url = `${POE_NINJA_OVERVIEW_URL}?league=${encodeURIComponent(league)}&type=Currency`;
    const headers: Record<string, string> = { 'User-Agent': this.userAgent, Accept: 'application/json' };
    if (etag) headers['If-None-Match'] = etag;

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new DOMException('timeout', 'TimeoutError')),
      POE_NINJA_TIMEOUT_MS,
    );
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(url, { method: 'GET', headers, signal: controller.signal });
      } catch {
        throw new Error(
          controller.signal.aborted ? 'poe.ninja did not answer in time' : 'network error contacting poe.ninja',
        );
      }
      if (response.status === 304) return { status: 'not_modified' };
      if (!response.ok) throw new Error(`poe.ninja returned HTTP ${response.status}`);
      let body: CurrencyOverviewResponse;
      try {
        body = (await response.json()) as CurrencyOverviewResponse;
      } catch {
        throw new Error('poe.ninja returned an unreadable response');
      }
      return { status: 'ok', body, etag: response.headers.get('etag') };
    } finally {
      clearTimeout(timer);
    }
  }
}
