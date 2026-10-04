/**
 * Trade-site links (D-39).
 *
 * - **League encoding:** `encodeURIComponent(league)`, so a space is `%20`. That is what PoB's
 *   `buildUrl` effectively does (its trailing `gsub(" ", "+")` never matches after the percent-encoding).
 * - **Search link:** `https://www.pathofexile.com/trade2/search/poe2/<league>/<search id>`.
 * - **Query link** (the fallback link, FR-T7): the same path with `?q=<encodeURIComponent(JSON.stringify(query))>`,
 *   which the trade site runs as a fresh search when the browser is logged in.
 * - **Exact-item link:** the query link over the last query sent, with the weight group narrowed to the
 *   listing's weighted sum (`{min: floor(w, 1) - 1, max: round(w, 1) + 1}`) and the seller's account
 *   filter, PoB's recipe (`TradeQuery.lua:1250-1265`).
 */

/** The trade site's search page for the PoE2 realm. */
export const TRADE_SEARCH_BASE = 'https://www.pathofexile.com/trade2/search/poe2';

/** `https://www.pathofexile.com/trade2/search/poe2/<league>/<search id>`. */
export function tradeSearchUrl(league: string, searchId: string): string {
  return `${TRADE_SEARCH_BASE}/${encodeURIComponent(league)}/${encodeURIComponent(searchId)}`;
}

/** `https://www.pathofexile.com/trade2/search/poe2/<league>?q=<the query as URL-encoded JSON>`. */
export function tradeQueryUrl(league: string, query: object): string {
  return `${TRADE_SEARCH_BASE}/${encodeURIComponent(league)}?q=${encodeURIComponent(JSON.stringify(query))}`;
}

/** PoB's `floor(val, 1)` (`Common.lua:660`): round down to one decimal, with its 0.0001 guard. */
function floor1(value: number): number {
  return Math.floor(value * 10 + 0.0001) / 10;
}

/** PoB's `round(val, 1)` (`Common.lua:648`). */
function round1(value: number): number {
  return Math.floor(value * 10 + 0.5) / 10;
}

/** One decimal, without binary-float noise in the JSON (141.2, not 141.20000000000002). */
function tidy(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The exact-item link for one listing: the last query sent, with `stats[0].value` replaced by
 * `{min: floor(w,1) - 1, max: round(w,1) + 1}` (w = the listing's weighted sum) and
 * `filters.trade_filters.filters.account.input` set to the seller's account. The query is not mutated.
 */
export function exactItemUrl(league: string, query: object, weightedSum: number, account: string): string {
  const exact = JSON.parse(JSON.stringify(query)) as {
    query?: {
      stats?: Array<{ value?: unknown }>;
      filters?: { trade_filters?: { filters?: Record<string, unknown>; [k: string]: unknown }; [k: string]: unknown };
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  exact.query = exact.query ?? {};
  const stats = exact.query.stats;
  if (Array.isArray(stats) && stats.length > 0 && stats[0] && typeof stats[0] === 'object') {
    stats[0].value = { min: tidy(floor1(weightedSum) - 1), max: tidy(round1(weightedSum) + 1) };
  }
  exact.query.filters = exact.query.filters ?? {};
  exact.query.filters.trade_filters = exact.query.filters.trade_filters ?? { filters: {} };
  exact.query.filters.trade_filters.filters = exact.query.filters.trade_filters.filters ?? {};
  exact.query.filters.trade_filters.filters.account = { input: account };
  return tradeQueryUrl(league, exact);
}
