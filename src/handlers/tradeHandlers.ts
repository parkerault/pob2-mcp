import { wrapHandler } from '../utils/errorHandling.js';
import type { TradeApiClient, FetchEntry } from '../trade/tradeClient.js';
import { TradeQueryBuilder } from '../services/tradeQueryBuilder.js';
import type { StatMapper } from '../services/statMapper.js';
import type { ItemListing } from '../types/tradeTypes.js';
import { convert, type CurrencyService, type Rates } from '../trade/currency.js';
import { modTexts } from '../trade/modLines.js';

export interface TradeContext {
  tradeClient: TradeApiClient;
  statMapper: StatMapper;
  currency: CurrencyService;
  /** The default league (D-20): `POE_LEAGUE`, else the first current league on trade2. */
  resolveLeague: () => Promise<string>;
}

type TextResult = { content: Array<{ type: string; text: string }> };

function text(output: string): TextResult {
  return { content: [{ type: 'text', text: output }] };
}

/** Message for a search_stats call when the live stat catalogue could not be loaded. */
export const STATS_UNAVAILABLE = 'trade stat data unavailable';

// ========================================
// Trade Site URLs (trade2)
// ========================================

const TRADE_SITE = 'https://www.pathofexile.com/trade2/search/poe2';

/** `https://www.pathofexile.com/trade2/search/poe2/<league>/<search id>` (D-39 league encoding). */
export function tradeSearchUrl(league: string, searchId: string): string {
  return `${TRADE_SITE}/${encodeURIComponent(league)}/${encodeURIComponent(searchId)}`;
}

function tradeItemUrl(league: string, searchId: string, itemId: string): string {
  return `${tradeSearchUrl(league, searchId)}#${itemId}`;
}

// ========================================
// Price normalization (C-12)
// ========================================

/** A normalized price, to 2 decimal places (AC-T46). */
function fmt2(n: number): string {
  return n.toFixed(2);
}

/** `<amount> <currency>` as listed. */
function nativePrice(price: { amount: number; currency: string }): string {
  return `${price.amount} ${price.currency}`;
}

interface NormalizedPrices {
  rates: Rates | null;
  /** Per listing: the price in the primary currency, or null where it can't be normalized. */
  values: Array<number | null>;
  /** The one note to show when any price could not be normalized. */
  note: string | null;
}

/** Normalize the listings' prices to the league's primary currency (C-12 `convert`). */
async function normalizePrices(currency: CurrencyService, league: string, listings: ItemListing[]): Promise<NormalizedPrices> {
  if (!listings.some((l) => l.listing.price)) return { rates: null, values: listings.map(() => null), note: null };
  const rates = await currency.getRates(league);
  if (!rates) {
    return {
      rates: null,
      values: listings.map(() => null),
      note: 'Note: currency rates unavailable (poe.ninja), so prices could not be normalized; showing native prices.',
    };
  }
  const unknown = new Set<string>();
  const values = listings.map((l) => {
    const price = l.listing.price;
    if (!price) return null;
    const v = convert(price.amount, price.currency, rates.primary, rates);
    if (v === null) unknown.add(price.currency);
    return v;
  });
  const note =
    unknown.size > 0
      ? `Note: some prices could not be normalized to ${rates.primary} (no poe.ninja rate for: ${[...unknown].sort().join(', ')}); they show native prices only.`
      : null;
  return { rates, values, note };
}

// ========================================
// search_trade_items
// ========================================

/** The `search_trade_items` arguments: exactly the schema's property names (AC-T18). */
export interface SearchTradeItemsArgs {
  league: string;
  item_name?: string;
  item_type?: string;
  min_price?: number;
  max_price?: number;
  price_currency?: string;
  item_rarity?: string;
  min_rune_sockets?: number;
  corrupted?: boolean;
  identified?: boolean;
  mods?: Array<{ stat_id: string; min?: number; max?: number }>;
  limit?: number;
}

/**
 * Search the PoE2 trade site for items. Listings keep the trade site's order (D-61); each shows its
 * native price and, where poe.ninja can place the currency, its primary-currency equivalent.
 */
export async function handleSearchTradeItems(context: TradeContext, args: SearchTradeItemsArgs): Promise<TextResult> {
  return wrapHandler('search trade items', async () => {
    const {
      league,
      item_name,
      item_type,
      min_price,
      max_price,
      price_currency,
      item_rarity,
      min_rune_sockets,
      corrupted,
      identified,
      mods,
      limit = 5,
    } = args;

    const builder = new TradeQueryBuilder().withOnlineStatus('available').withSort('price', 'asc');
    if (item_name) builder.withName(item_name);
    if (item_type) builder.withType(item_type);
    if (item_rarity) builder.withRarity(item_rarity);
    if (min_rune_sockets !== undefined) builder.withMinRuneSockets(min_rune_sockets);
    if (corrupted !== undefined) builder.withCorrupted(corrupted);
    if (identified !== undefined) builder.withIdentified(identified);
    if (mods && mods.length > 0) {
      builder.withStats(mods.map((m) => ({ id: m.stat_id, min: m.min, max: m.max })));
    }
    if (min_price !== undefined || max_price !== undefined) {
      builder.withPriceRange(min_price, max_price, price_currency || undefined);
    }
    const query = builder.build();

    // The kept tools search anonymously (auth: false): the cookie is only for weighted search (C-10).
    const searchResult = await context.tradeClient.search(league, query, { auth: false });
    if (searchResult.result.length === 0) {
      return text(`No items found matching your search criteria in ${league} league.`);
    }

    const count = Math.max(1, Math.min(10, Math.floor(Number(limit) || 5)));
    const items = presentEntries(
      await context.tradeClient.fetch(searchResult.result.slice(0, count), searchResult.id, { auth: false }),
    );
    const prices = await normalizePrices(context.currency, league, items);
    return text(formatSearchResults(items, searchResult.total, league, searchResult.id, prices));
  });
}

/** The fetch entries that are listings (trade2 may return `null` for a listing that is gone). */
function presentEntries(entries: Array<FetchEntry | null>): ItemListing[] {
  return entries.filter((e): e is FetchEntry => e !== null && typeof e === 'object' && !!e.item && !!e.listing);
}

function formatSearchResults(
  items: ItemListing[],
  totalResults: number,
  league: string,
  searchId: string,
  prices: NormalizedPrices,
): string {
  let output = `=== Trade Search (${league}) ===\n`;
  output += `Found: ${totalResults} | Showing: ${items.length}\n`;
  output += `🔗 ${tradeSearchUrl(league, searchId)}\n`;
  if (prices.note) output += `${prices.note}\n`;
  output += '\n';

  // Listings keep the order the trade site returned them in (D-61: no value scoring or re-ranking).
  items.forEach((listing, i) => {
    const item = listing.item;
    const price = listing.listing.price;
    const seller = listing.listing.account;

    output += `${i + 1}. ${item.name || item.typeLine}\n`;
    if (item.name && item.typeLine && item.name !== item.typeLine) {
      output += `   Base: ${item.typeLine}\n`;
    }

    if (price) {
      const primary = prices.values[i];
      output += `   Price: ${nativePrice(price)}`;
      if (primary !== null && prices.rates) output += ` (≈ ${fmt2(primary)} ${prices.rates.primary})`;
      output += '\n';
    } else {
      output += `   Price: Not listed\n`;
    }

    output += `   ilvl: ${item.ilvl}`;
    if (item.corrupted) output += ' (Corrupted)';
    output += '\n';

    const runeSockets = Array.isArray(item.sockets) ? item.sockets.length : 0;
    if (runeSockets > 0) output += `   Rune sockets: ${runeSockets}\n`;

    const statParts = keyStatParts(listing);
    if (statParts.length > 0) output += `   Stats: ${statParts.join(', ')}\n`;

    if (listing.listing.whisper) {
      output += `   ${seller?.online ? '🟢' : '🔴'} ${seller?.name ?? 'unknown seller'}\n`;
    } else {
      output += `   ⚡ instant buyout · ${seller?.name ?? 'unknown seller'}\n`;
    }
    output += `   🔗 ${tradeItemUrl(league, searchId, listing.id)}\n\n`;
  });

  output += `\n🟢=online 🔴=offline ⚡=instant buyout`;
  return output;
}

/** The first `+N <stat>` value among the given mod texts, or 0. */
function firstModValue(modsText: string, patterns: string[]): number {
  for (const pattern of patterns) {
    const match = modsText.match(new RegExp(`\\+(\\d+)(?:%)?\\s*${pattern}`, 'i'));
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

/** Condensed life / energy shield / total resistance summary for one listing. */
function keyStatParts(listing: ItemListing): string[] {
  const mods = modTexts(listing.item, ['implicitMods', 'explicitMods', 'craftedMods']).join('\n');
  const life = firstModValue(mods, ['to maximum Life', 'maximum Life']);
  const es = firstModValue(mods, ['to maximum Energy Shield', 'maximum Energy Shield']);
  const totalResist = ['Fire', 'Cold', 'Lightning', 'Chaos']
    .map((el) => firstModValue(mods, [`to ${el} Resistance`, `${el} Resistance`]))
    .reduce((a, b) => a + b, 0);
  const parts: string[] = [];
  if (life > 0) parts.push(`+${life} Life`);
  if (es > 0) parts.push(`+${es} ES`);
  if (totalResist > 0) parts.push(`+${totalResist}% Res`);
  return parts;
}

// ========================================
// get_item_price
// ========================================

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function spread(values: number[]): { low: number; median: number; average: number; high: number } {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    low: sorted[0],
    median: median(sorted),
    average: sorted.reduce((s, v) => s + v, 0) / sorted.length,
    high: sorted[sorted.length - 1],
  };
}

/**
 * Price check an item by name: the cheapest listings, each with its native price and its
 * primary-currency equivalent, and a summary in the primary currency (C-12).
 */
export async function handleGetItemPrice(
  context: TradeContext,
  args: {
    item_name: string;
    league?: string;
    item_type?: string;
    rarity?: 'unique' | 'rare' | 'magic' | 'normal';
  },
): Promise<TextResult> {
  return wrapHandler('get item price', async () => {
    const { item_name, item_type, rarity } = args;
    const league = args.league || (await context.resolveLeague());

    const builder = new TradeQueryBuilder().withName(item_name).withOnlineStatus('available').withSort('price', 'asc');
    if (item_type) builder.withType(item_type);
    if (rarity) builder.withRarity(rarity);

    const searchResult = await context.tradeClient.search(league, builder.build(), { auth: false });
    if (searchResult.result.length === 0) {
      return text(`No price data found for "${item_name}" in ${league}.`);
    }

    const items = presentEntries(
      await context.tradeClient.fetch(searchResult.result.slice(0, 10), searchResult.id, { auth: false }),
    ).filter((l) => l.listing.price);
    if (items.length === 0) {
      return text(`No priced listings found for "${item_name}" in ${league}.`);
    }

    const { rates, values, note } = await normalizePrices(context.currency, league, items);

    let output = `=== Price Check: ${item_name} ===\n`;
    output += `League: ${league}\n`;
    output += `Total Listings: ${searchResult.total} · Priced listings fetched: ${items.length}\n`;
    if (note) output += `${note}\n`;
    output += '\nListings (cheapest first, as listed):\n';
    items.forEach((l, i) => {
      const price = l.listing.price!;
      output += `  ${i + 1}. ${l.item.name || l.item.typeLine}: ${nativePrice(price)}`;
      const v = values[i];
      if (v !== null && rates) output += ` (≈ ${fmt2(v)} ${rates.primary})`;
      output += '\n';
    });

    // Per-currency counts (and, without a normalized summary, the per-currency price spread).
    const byCurrency = new Map<string, number[]>();
    for (const l of items) {
      const price = l.listing.price!;
      if (!byCurrency.has(price.currency)) byCurrency.set(price.currency, []);
      byCurrency.get(price.currency)!.push(price.amount);
    }
    output += `\nListed in: ${[...byCurrency.entries()].map(([c, a]) => `${c} ×${a.length}`).join(', ')}\n`;

    const normalized = values.filter((v): v is number => v !== null);
    if (rates && normalized.length > 0) {
      const s = spread(normalized);
      output += `\nSummary in ${rates.nameOf(rates.primary)} (${rates.primary}), from ${normalized.length} of ${items.length} listings:\n`;
      output += `  Low: ${fmt2(s.low)} ${rates.primary}\n`;
      output += `  Median: ${fmt2(s.median)} ${rates.primary}\n`;
      output += `  Average: ${fmt2(s.average)} ${rates.primary}\n`;
      output += `  High: ${fmt2(s.high)} ${rates.primary}\n`;
    } else {
      for (const [currency, amounts] of byCurrency.entries()) {
        const s = spread(amounts);
        output += `\n${currency} (${amounts.length} listings, native prices):\n`;
        output += `  Low: ${s.low} ${currency}\n`;
        output += `  Median: ${s.median} ${currency}\n`;
        output += `  Average: ${fmt2(s.average)} ${currency}\n`;
        output += `  High: ${s.high} ${currency}\n`;
      }
    }
    output += `\n🔗 ${tradeSearchUrl(league, searchResult.id)}\n`;
    return text(output);
  });
}

// ========================================
// get_leagues
// ========================================

/** The trade2 leagues in API order, with the D-20 default marked. */
export async function handleGetLeagues(context: TradeContext): Promise<TextResult> {
  return wrapHandler('get leagues', async () => {
    const leagues = await context.tradeClient.getLeagues();
    if (leagues.length === 0) return text('No leagues found.');

    let defaultLeague: string | null = null;
    let defaultProblem: string | null = null;
    try {
      defaultLeague = await context.resolveLeague();
    } catch (error) {
      defaultProblem = error instanceof Error ? error.message : String(error);
    }

    let output = '=== Available Leagues (PoE2 trade) ===\n\n';
    for (const league of leagues) {
      output += `- ${league.id}`;
      if (league.text && league.text !== league.id) output += ` (${league.text})`;
      if (league.realm) output += ` [${league.realm}]`;
      if (league.id === defaultLeague) output += ' ← default';
      output += '\n';
    }
    if (defaultLeague !== null) {
      output += `\nDefault league: ${defaultLeague} (POE_LEAGUE if set, else the first current league above).\n`;
      if (!leagues.some((l) => l.id === defaultLeague)) {
        output += `Note: the default league is not in the trade site's list.\n`;
      }
    } else if (defaultProblem) {
      output += `\nDefault league: none (${defaultProblem}).\n`;
    }
    return text(output);
  });
}

// ========================================
// search_stats
// ========================================

/** Search the live trade2 stat catalogue for stat ids (no static fallback). */
export async function handleSearchStats(
  context: TradeContext,
  args: {
    query: string;
    limit?: number;
  },
): Promise<TextResult> {
  return wrapHandler('search stats', async () => {
    const { query, limit = 10 } = args;
    if (!context.statMapper.isLoaded()) throw new Error(STATS_UNAVAILABLE);

    const results = context.statMapper.fuzzySearch(query, limit);
    if (results.length === 0) return text(`No stats found matching "${query}".`);

    let output = `=== Stat Search Results for "${query}" ===\n\n`;
    output += `Found ${results.length} matching stats:\n\n`;
    results.forEach((stat, i) => {
      output += `${i + 1}. ${stat.text}\n`;
      output += `   Trade ID: ${stat.tradeId}\n`;
      if (stat.category) output += `   Category: ${stat.category}\n`;
      output += '\n';
    });
    output += `To filter search_trade_items by a stat, pass its Trade ID as mods[].stat_id.`;
    return text(output);
  });
}
