/**
 * Trade-site links (D-39).
 *
 * - **League encoding:** `encodeURIComponent(league)`, so a space is `%20`. That is what PoB's
 *   `buildUrl` effectively does (its trailing `gsub(" ", "+")` never matches after the percent-encoding).
 * - **Search link:** `https://www.pathofexile.com/trade2/search/poe2/<league>/<search id>`.
 * - **Query link** (the fallback link, FR-T7): the same path with `?q=<encodeURIComponent(JSON.stringify(query))>`,
 *   which the trade site runs as a fresh search when the browser is logged in.
 * - **Exact-item link** (D-90, which replaces PoB's weighted recipe): the query link over a minimal query
 *   that pins one listing: the search's status, the item's name (omitted when empty) and base type, the
 *   seller's account, and `price {min = max = amount, option = currency}`. It has no `stats`, so it stays
 *   short (a few hundred characters, not PoB's ~4,000).
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

/** What pins one listing on the trade site (D-90). */
export interface ExactItem {
  /** The search's trade status option (e.g. `securable`). */
  status: string;
  /** The item's own name; empty for items without one (the `name` key is then omitted). */
  name: string;
  /** The item's base type. */
  baseType: string;
  /** The seller's account name. */
  account: string;
  /** The listing's price, or null when it has none (the `price` filter is then omitted). */
  price: { amount: number; currency: string } | null;
}

/** The D-90 pinning query for one listing: status, name, base type, the seller and the exact price. No `stats`. */
export function exactItemQuery(item: ExactItem): object {
  const filters: Record<string, unknown> = { account: { input: item.account } };
  if (item.price) filters.price = { min: item.price.amount, max: item.price.amount, option: item.price.currency };
  return {
    query: {
      status: { option: item.status },
      ...(item.name ? { name: item.name } : {}),
      type: item.baseType,
      filters: { trade_filters: { filters } },
    },
  };
}

/** The exact-item link for one listing: the query link over its D-90 pinning query. */
export function exactItemUrl(league: string, item: ExactItem): string {
  return tradeQueryUrl(league, exactItemQuery(item));
}
