import { wrapHandler } from '../utils/errorHandling.js';
import { TradeApiClient } from '../services/tradeClient.js';
import { TradeQueryBuilder } from '../services/tradeQueryBuilder.js';
import { StatMapper } from '../services/statMapper.js';
import { ItemListing } from '../types/tradeTypes.js';
import { CostBenefitAnalyzer } from '../services/costBenefitAnalyzer.js';
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

    // Execute search
    const searchResult = await context.tradeClient.searchItems(league, query);

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
    const items = await context.tradeClient.fetchItems(itemIdsToFetch, searchResult.id);

    // Format results with real-time currency rates
    const output = await formatSearchResults(items, searchResult.total, league, searchResult.id, context.ninjaClient);

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
    const searchResult = await context.tradeClient.searchItems(league, query);

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
    const items = await context.tradeClient.fetchItems(itemIdsToFetch, searchResult.id);

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
    const leagueData = await context.tradeClient.getLeagues();

    if (!leagueData.result || leagueData.result.length === 0) {
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

    for (const league of leagueData.result) {
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

/**
 * Fetch and map currency rates from poe.ninja
 * Maps full currency names to short names used by trade API
 */
async function getCurrencyRatesMap(ninjaClient: PoeNinjaClient | undefined, league: string): Promise<Map<string, number>> {
  if (!ninjaClient) {
    return new Map();
  }

  try {
    const rates = await ninjaClient.getCurrencyExchangeMap(league);

    // Map poe.ninja names to trade API currency names
    const mappedRates = new Map<string, number>();

    // Common currency mappings
    const nameMap: Record<string, string[]> = {
      'Divine Orb': ['divine', 'div'],
      'Chaos Orb': ['chaos', 'c'],
      'Exalted Orb': ['exalted', 'exa', 'ex'],
      'Mirror of Kalandra': ['mirror'],
      'Orb of Alchemy': ['alchemy', 'alch'],
      'Orb of Fusing': ['fusing', 'fuse'],
      'Orb of Regret': ['regret'],
      'Gemcutter\'s Prism': ['gcp'],
      'Chromatic Orb': ['chrome', 'chromatic'],
      'Jeweller\'s Orb': ['jewellers', 'jew'],
      'Orb of Alteration': ['alt', 'alteration'],
      'Vaal Orb': ['vaal'],
      'Cartographer\'s Chisel': ['chisel'],
      'Blessed Orb': ['blessed'],
      'Orb of Scouring': ['scouring', 'scour'],
    };

    // Add mappings
    for (const [fullName, chaosValue] of rates.entries()) {
      // Add the full name
      mappedRates.set(fullName, chaosValue);

      // Add short name mappings
      for (const [key, aliases] of Object.entries(nameMap)) {
        if (fullName === key) {
          for (const alias of aliases) {
            mappedRates.set(alias, chaosValue);
          }
        }
      }
    }

    return mappedRates;
  } catch (error) {
    console.error('[Trade] Failed to fetch currency rates from poe.ninja:', error);
    return new Map();
  }
}

async function formatSearchResults(items: ItemListing[], totalResults: number, league: string, searchId: string, ninjaClient?: PoeNinjaClient): Promise<string> {
  let output = `=== Trade Search (${league}) ===\n`;
  output += `Found: ${totalResults} | Showing: ${items.length}\n`;
  output += `🔗 ${getTradeSearchUrl(league, searchId)}\n\n`;

  // Fetch real-time currency rates from poe.ninja
  const currencyRates = await getCurrencyRatesMap(ninjaClient, league);

  // Analyze items for cost/benefit with real rates
  const analyzer = new CostBenefitAnalyzer();
  const analyses = analyzer.analyzeAndRank(items, currencyRates);

  for (let i = 0; i < analyses.length; i++) {
    const analysis = analyses[i];
    const listing = analysis.listing;
    const item = listing.item;
    const price = listing.listing.price;
    const seller = listing.listing.account;
    const metrics = analysis.metrics;

    // Rank by value, not by search order
    const valueRank = analysis.rank || (i + 1);
    const searchRank = items.indexOf(listing) + 1;

    output += `${searchRank}. ${item.name || item.typeLine}`;

    // Show value indicator
    const tierEmoji = {
      'excellent': ' 💎',
      'good': ' ✨',
      'average': '',
      'poor': ' ⚠️'
    }[metrics.valueTier];
    output += tierEmoji;

    if (metrics.isBudgetPick) {
      output += ' 💰';
    }

    output += `\n`;

    if (item.name && item.typeLine && item.name !== item.typeLine) {
      output += `   Base: ${item.typeLine}\n`;
    }

    if (price) {
      output += `   Price: ${price.amount} ${price.currency}`;
      if (analysis.priceInChaos > 0 && price.currency !== 'chaos') {
        output += ` (~${analysis.priceInChaos.toFixed(0)} chaos)`;
      }
      output += `\n`;
    } else {
      output += `   Price: Not listed\n`;
    }

    // Show value score
    output += `   Value: ${metrics.valueScore.toFixed(0)}/100 (${metrics.valueTier})`;
    if (valueRank <= 3) {
      output += ` - #${valueRank} best value`;
    }
    output += `\n`;

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
    const stats = analysis.stats;
    const statParts: string[] = [];
    if (stats.life > 0) statParts.push(`+${stats.life} Life`);
    if (stats.es > 0) statParts.push(`+${stats.es} ES`);
    if (stats.totalResist > 0) statParts.push(`+${stats.totalResist}% Res`);
    if (statParts.length > 0) {
      output += `   Stats: ${statParts.join(', ')}\n`;
    }

    output += `   ${seller.online ? '🟢' : '🔴'} ${seller.name}\n`;
    output += `   🔗 ${getTradeItemUrl(league, searchId, listing.id)}\n\n`;
  }

  output += `\n💎=excellent ✨=good ⚠️=poor 💰=budget 🟢=online 🔴=offline`;
  return output;
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
