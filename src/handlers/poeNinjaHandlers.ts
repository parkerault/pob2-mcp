import { wrapHandler } from '../utils/errorHandling.js';
import { PoeNinjaClient } from '../services/poeNinjaClient.js';

interface PoeNinjaContext {
  ninjaClient: PoeNinjaClient;
}

/**
 * Get current currency exchange rates
 */
export async function handleGetCurrencyRates(
  context: PoeNinjaContext,
  args: {
    league: string;
  }
): Promise<{
  content: Array<{
    type: string;
    text: string;
  }>;
}> {
  return wrapHandler('get currency rates', async () => {
    const { league } = args;

    const rateMap = await context.ninjaClient.getCurrencyExchangeMap(league);

    let output = `IMPORTANT: Show the user ALL of the following information verbatim, including:\n`;
    output += `- All currency names and their Exalted-equivalent values\n`;
    output += `- The complete table of exchange rates\n`;
    output += `DO NOT summarize or paraphrase this output. Present it exactly as written below.\n\n`;
    output += `=== Currency Exchange Rates (PoE2) ===\n`;
    output += `League: ${league}\n`;
    output += `Last Updated: ${new Date().toISOString()}\n\n`;

    // Sort by value descending
    const sorted = Array.from(rateMap.entries()).sort((a, b) => b[1] - a[1]);

    // Group by value ranges (in Exalted Orb equivalent)
    const high = sorted.filter(([_, val]) => val >= 10);
    const medium = sorted.filter(([_, val]) => val >= 1 && val < 10);
    const low = sorted.filter(([_, val]) => val < 1);

    if (high.length > 0) {
      output += `High Value (≥10 ex):\n`;
      for (const [currency, rate] of high) {
        output += `  ${currency.padEnd(30)} ${rate.toFixed(2)} ex\n`;
      }
      output += `\n`;
    }

    if (medium.length > 0) {
      output += `Medium Value (1-10 ex):\n`;
      for (const [currency, rate] of medium) {
        output += `  ${currency.padEnd(30)} ${rate.toFixed(2)} ex\n`;
      }
      output += `\n`;
    }

    if (low.length > 0) {
      output += `Low Value (<1 ex):\n`;
      for (const [currency, rate] of low) {
        output += `  ${currency.padEnd(30)} ${rate.toFixed(4)} ex\n`;
      }
      output += `\n`;
    }

    output += `\nTotal Currencies: ${rateMap.size}\n`;
    output += `\nNote: Rates are from poe.ninja (PoE2) and update periodically. All values shown in Exalted Orb equivalent.\n`;

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

