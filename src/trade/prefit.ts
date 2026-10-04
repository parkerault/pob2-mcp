/**
 * The trade query complexity prefit (D-23) and the weighted-filter trims it and the single
 * `too_complex` retry use.
 *
 * trade2 rejects a query whose complexity is over its budget (about 200 for a logged-in search, A-3)
 * with a 400, and every 4xx counts toward GGG's invalid-request threshold. So before sending, the
 * query's complexity is estimated with PoB dev head's budget model, which over-estimates on every
 * fixture data point (A-3):
 *
 *   estimate = 54 (weight group) + 4 (category + rarity) + 4 (and group)
 *            + 4 per filter in the and / not / weight groups
 *            + 3 per each of: mirrored:false, a price, a max level, a rune-socket minimum
 *            + 2 per extra top-level query key
 *
 * and the lowest-weight weighted filters are dropped until `200 - estimate >= 4`.
 */

/** trade2's complexity budget (A-3). */
export const COMPLEXITY_BUDGET = 200;
/** The headroom the prefit keeps under the budget (D-23). */
export const COMPLEXITY_HEADROOM = 4;

/** The keys every PoB query has under `query`; anything else is an "extra query key" (PoB's `queryExtra`). */
const STANDARD_QUERY_KEYS = new Set(['filters', 'status', 'stats']);

export interface StatFilter {
  id: string;
  value?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface StatGroup {
  type: string;
  value?: Record<string, unknown> | null;
  filters: StatFilter[];
  [k: string]: unknown;
}

/** The shape of a PoB trade query (`FinishQuery`'s table), as far as the prefit reads it. */
export interface TradeQueryBody {
  query: {
    filters?: Record<string, { filters?: Record<string, unknown>; [k: string]: unknown } | undefined>;
    status?: unknown;
    stats?: StatGroup[];
    [k: string]: unknown;
  };
  sort?: unknown;
  engine?: unknown;
  [k: string]: unknown;
}

function groups(query: TradeQueryBody, type: string): StatGroup[] {
  const stats = query.query?.stats;
  return Array.isArray(stats) ? stats.filter((g) => g && g.type === type) : [];
}

function filterCount(query: TradeQueryBody, type: string): number {
  return groups(query, type).reduce((n, g) => n + (Array.isArray(g.filters) ? g.filters.length : 0), 0);
}

function subFilter(query: TradeQueryBody, group: string, name: string): unknown {
  return query.query?.filters?.[group]?.filters?.[name];
}

/** The weight group (PoB always emits it first), or undefined. */
export function weightGroup(query: TradeQueryBody): StatGroup | undefined {
  return groups(query, 'weight')[0];
}

/** The number of filters in the weight group. */
export function weightedFilterCount(query: TradeQueryBody): number {
  return filterCount(query, 'weight');
}

/** D-23's complexity estimate for a query. */
export function estimateComplexity(query: TradeQueryBody): number {
  const filters = filterCount(query, 'and') + filterCount(query, 'not') + filterCount(query, 'weight');
  const flag = (present: boolean) => (present ? 3 : 0);
  const mirroredFalse = subFilter(query, 'misc_filters', 'mirrored') === false;
  const price = subFilter(query, 'trade_filters', 'price') !== undefined;
  const maxLevel = (subFilter(query, 'req_filters', 'lvl') as { max?: unknown } | undefined)?.max !== undefined;
  const sockets = (subFilter(query, 'equipment_filters', 'rune_sockets') as { min?: unknown } | undefined)?.min !== undefined;
  const extraKeys = Object.keys(query.query ?? {}).filter((k) => !STANDARD_QUERY_KEYS.has(k)).length;
  return (
    54 +
    4 +
    4 +
    4 * filters +
    flag(mirroredFalse) +
    flag(price) +
    flag(maxLevel) +
    flag(sockets) +
    2 * extraKeys
  );
}

/** A filter's weight magnitude (a negated weight is an inverted stat, still a strong filter). */
function weightOf(filter: StatFilter): number {
  const w = Number((filter.value as { weight?: unknown } | undefined)?.weight);
  return Number.isFinite(w) ? Math.abs(w) : 0;
}

/**
 * A deep copy of `query` without the `count` lowest-weight weighted filters (ties: the later filter
 * goes first, as it ranks lower in PoB's order). The remaining filters keep their order.
 */
export function dropLowestWeighted<T extends TradeQueryBody>(query: T, count: number): T {
  const copy = JSON.parse(JSON.stringify(query)) as T;
  const group = weightGroup(copy);
  if (!group || count <= 0) return copy;
  const ranked = group.filters
    .map((f, i) => ({ i, w: weightOf(f) }))
    .sort((a, b) => (a.w !== b.w ? a.w - b.w : b.i - a.i));
  const drop = new Set(ranked.slice(0, Math.min(count, ranked.length)).map((r) => r.i));
  group.filters = group.filters.filter((_, i) => !drop.has(i));
  return copy;
}

/**
 * The prefit (D-23): drop the lowest-weight weighted filters until `200 - estimate >= 4`. Never drops
 * the last weighted filter. Returns the query to send (a copy) and how many filters were dropped.
 */
export function prefitQuery<T extends TradeQueryBody>(query: T): { query: T; dropped: number; estimate: number } {
  let current = JSON.parse(JSON.stringify(query)) as T;
  let dropped = 0;
  while (COMPLEXITY_BUDGET - estimateComplexity(current) < COMPLEXITY_HEADROOM && weightedFilterCount(current) > 1) {
    current = dropLowestWeighted(current, 1);
    dropped += 1;
  }
  return { query: current, dropped, estimate: estimateComplexity(current) };
}

/** How many weighted filters the single `too_complex` retry drops: the lowest 25 %, at least 1 (D-23). */
export function tooComplexDropCount(weightedFilters: number): number {
  return Math.max(1, Math.ceil(weightedFilters * 0.25));
}
