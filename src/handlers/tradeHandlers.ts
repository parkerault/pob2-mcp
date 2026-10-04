import { wrapHandler } from '../utils/errorHandling.js';
import type { TradeApiClient, FetchEntry } from '../trade/tradeClient.js';
import { TradeQueryBuilder } from '../services/tradeQueryBuilder.js';
import { StatMapper } from '../services/statMapper.js';
import { ItemListing } from '../types/tradeTypes.js';
import { PoeNinjaClient } from '../services/poeNinjaClient.js';

interface TradeContext {
  tradeClient: TradeApiClient;
  statMapper?: StatMapper;
  ninjaClient?: PoeNinjaClient;
}

// ========================================
// Trade Site URL Helpers
// ========================================

function getTradeSearchUrl(league: string, searchId: string): string {
  return `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}/${searchId}`;
}

function getTradeItemUrl(league: string, searchId: string, itemId: string): string {
  // Individual items can be highlighted in the search results
  return `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}/${searchId}#${itemId}`;
}

/**
 * Search the Path of Exile trade site for items
 */
export async function handleSearchTradeItems(
  context: TradeContext,
  args: {
    league: string;
    item_name?: string;
    item_type?: string;
    min_price?: number;
    max_price?: number;
    price_currency?: string;
    online_only?: boolean;
    rarity?: 'normal' | 'magic' | 'rare' | 'unique' | 'any';
    min_links?: number;
    stats?: Array<{ id: string; min?: number; max?: number }>;
    sort?: 'price_asc' | 'price_desc';
    limit?: number;
  }
): Promise<{
  content: Array<{
    type: string;
    text: string;
  }>;
}> {
  return wrapHandler('search trade items', async () => {
    const {
      league,
      item_name,
      item_type,
      min_price,
      max_price,
      price_currency = 'chaos',
      online_only = true,
      rarity,
      min_links,
      stats,
      sort = 'price_asc',
      limit = 5,
    } = args;

    // Build the query
    const builder = new TradeQueryBuilder();

    if (item_name) {
      builder.withName(item_name);
    }

    if (item_type) {
      builder.withType(item_type);
    }

    if (rarity) {
      builder.withRarity(rarity);
    }

    if (min_links) {
      builder.withLinks(min_links);
    }

    if (stats && stats.length > 0) {
      builder.withStats(stats);
    }

    builder.applyOptions({
      league,
      onlineOnly: online_only,
      minPrice: min_price,
      maxPrice: max_price,
      priceCurrency: price_currency,
      sort,
      limit,
    });

    const query = builder.build();

    // Execute search. The kept tools search anonymously (auth: false): the cookie is only for
    // weighted search (C-10).
    const searchResult = await context.tradeClient.search(league, query, { auth: false });

    if (!searchResult.result || searchResult.result.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No items found matching your search criteria in ${league} league.`,
          },
        ],
      };
    }

    // Fetch first batch of items (up to limit)
    const itemIdsToFetch = searchResult.result.slice(0, Math.min(limit, 10));
    const items = presentEntries(
      await context.tradeClient.fetch(itemIdsToFetch, searchResult.id, { auth: false }),
    );

    // Format results in the order the trade site returned them
    const output = formatSearchResults(items, searchResult.total, league, searchResult.id);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  });
}

/**
 * Get current market price for an item
 */
export async function handleGetItemPrice(
  context: TradeContext,
  args: {
    item_name: string;
    league?: string;
    item_type?: string;
    rarity?: 'unique' | 'rare' | 'magic' | 'normal';
  }
): Promise<{
  content: Array<{
    type: string;
    text: string;
  }>;
}> {
  return wrapHandler('get item price', async () => {
    const { item_name, league = 'Standard', item_type, rarity } = args;

    // Build query
    const builder = new TradeQueryBuilder()
      .withName(item_name)
      .withOnlineStatus('available');

    if (item_type) {
      builder.withType(item_type);
    }

    if (rarity) {
      builder.withRarity(rarity);
    }

    builder.withSort('price', 'asc');

    const query = builder.build();

    // Search
    const searchResult = await context.tradeClient.search(league, query, { auth: false });

    if (!searchResult.result || searchResult.result.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No price data found for "${item_name}" in ${league}.`,
          },
        ],
      };
    }

    // Fetch first 10 items to get price range
    const itemIdsToFetch = searchResult.result.slice(0, Math.min(10, searchResult.result.length));
    const items = presentEntries(
      await context.tradeClient.fetch(itemIdsToFetch, searchResult.id, { auth: false }),
    );

    // Calculate price statistics
    const prices = items
      .map(item => item.listing.price)
      .filter(price => price !== undefined)
      .map(price => ({
        amount: price!.amount,
        currency: price!.currency,
      }));

    if (prices.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No priced listings found for "${item_name}" in ${league}.`,
          },
        ],
      };
    }

    // Group by currency
    const byCurrency = new Map<string, number[]>();
    for (const price of prices) {
      if (!byCurrency.has(price.currency)) {
        byCurrency.set(price.currency, []);
      }
      byCurrency.get(price.currency)!.push(price.amount);
    }

    // Format output
    let output = `=== Price Check: ${item_name} ===\n`;
    output += `League: ${league}\n`;
    output += `Total Listings: ${searchResult.total}\n\n`;

    for (const [currency, amounts] of byCurrency.entries()) {
      amounts.sort((a, b) => a - b);
      const min = amounts[0];
      const max = amounts[amounts.length - 1];
      const median = amounts[Math.floor(amounts.length / 2)];
      const avg = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;

      output += `${currency}:\n`;
      output += `  Low: ${min.toFixed(1)} ${currency}\n`;
      output += `  Median: ${median.toFixed(1)} ${currency}\n`;
      output += `  Average: ${avg.toFixed(1)} ${currency}\n`;
      output += `  High: ${max.toFixed(1)} ${currency}\n`;
      output += `  Sample Size: ${amounts.length} listings\n\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  });
}

/**
 * Get available leagues
 */
export async function handleGetLeagues(
  context: TradeContext
): Promise<{
  content: Array<{
    type: string;
    text: string;
  }>;
}> {
  return wrapHandler('get leagues', async () => {
    const leagues = await context.tradeClient.getLeagues();

    if (leagues.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No leagues found.',
          },
        ],
      };
    }

    let output = '=== Available Leagues ===\n\n';

    for (const league of leagues) {
      output += `- ${league.id}`;
      if (league.text) {
        output += ` (${league.text})`;
      }
      if (league.realm) {
        output += ` [${league.realm}]`;
      }
      output += '\n';
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  });
}

// ========================================
// Helper Functions
// ========================================

/** The fetch entries that are listings (trade2 may return `null` for a listing that is gone). */
function presentEntries(entries: Array<FetchEntry | null>): ItemListing[] {
  return entries.filter((e): e is FetchEntry => e !== null && typeof e === 'object');
}

function formatSearchResults(items: ItemListing[], totalResults: number, league: string, searchId: string): string {
  let output = `=== Trade Search (${league}) ===\n`;
  output += `Found: ${totalResults} | Showing: ${items.length}\n`;
  output += `🔗 ${getTradeSearchUrl(league, searchId)}\n\n`;

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
      output += `   Price: ${price.amount} ${price.currency}\n`;
    } else {
      output += `   Price: Not listed\n`;
    }

    output += `   ilvl: ${item.ilvl}`;

    if (item.corrupted) {
      output += ' (Corrupted)';
    }

    output += '\n';

    // Links
    if (item.sockets && item.sockets.length > 0) {
      const maxLinks = getMaxLinks(item.sockets);
      if (maxLinks > 1) {
        output += `   Links: ${maxLinks}L\n`;
      }
    }

    // Show key stats in condensed format
    const statParts = keyStatParts(listing);
    if (statParts.length > 0) {
      output += `   Stats: ${statParts.join(', ')}\n`;
    }

    output += `   ${seller.online ? '🟢' : '🔴'} ${seller.name}\n`;
    output += `   🔗 ${getTradeItemUrl(league, searchId, listing.id)}\n\n`;
  });

  output += `\n🟢=online 🔴=offline`;
  return output;
}

/** The first `+N <stat>` value among the item's implicit, explicit and crafted mods, or 0. */
function firstModValue(modsText: string, patterns: string[]): number {
  for (const pattern of patterns) {
    const match = modsText.match(new RegExp(`\\+(\\d+)(?:%)?\\s*${pattern}`, 'i'));
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

/** Condensed life / energy shield / total resistance summary for one listing. */
function keyStatParts(listing: ItemListing): string[] {
  const item = listing.item;
  const mods = [...(item.implicitMods || []), ...(item.explicitMods || []), ...(item.craftedMods || [])].join('\n');
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

function getMaxLinks(sockets: Array<{ group: number }>): number {
  const groups = new Map<number, number>();
  for (const socket of sockets) {
    const count = groups.get(socket.group) || 0;
    groups.set(socket.group, count + 1);
  }
  return Math.max(...groups.values());
}

/**
 * Search for stat IDs by name (fuzzy matching)
 */
export async function handleSearchStats(
  context: TradeContext,
  args: {
    query: string;
    limit?: number;
  }
): Promise<{
  content: Array<{
    type: string;
    text: string;
  }>;
}> {
  return wrapHandler('search stats', async () => {
    const { query, limit = 10 } = args;

    if (!context.statMapper) {
      return {
        content: [
          {
            type: 'text',
            text: 'Stat mapper not available.',
          },
        ],
      };
    }

    const results = context.statMapper.fuzzySearch(query, limit);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No stats found matching "${query}".`,
          },
        ],
      };
    }

    let output = `=== Stat Search Results for "${query}" ===\n\n`;
    output += `Found ${results.length} matching stats:\n\n`;

    for (let i = 0; i < results.length; i++) {
      const stat = results[i];
      output += `${i + 1}. ${stat.pobName}\n`;
      output += `   Trade ID: ${stat.tradeId}\n`;
      output += `   Category: ${stat.category}\n`;

      if (stat.description) {
        output += `   Description: ${stat.description}\n`;
      }

      if (stat.aliases.length > 0) {
        output += `   Aliases: ${stat.aliases.slice(0, 3).join(', ')}`;
        if (stat.aliases.length > 3) {
          output += ` (+${stat.aliases.length - 3} more)`;
        }
        output += '\n';
      }

      output += '\n';
    }

    output += `\nTo use in searches, reference the Trade ID in the stats parameter.`;

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  });
}
