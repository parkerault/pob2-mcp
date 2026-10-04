import { wrapHandler } from '../utils/errorHandling.js';
import type { CurrencyService } from '../trade/currency.js';

interface PoeNinjaContext {
  currency: CurrencyService;
}

/** A value for display: 2 decimals from 1 up, 4 significant digits below. */
function formatValue(v: number): string {
  return v >= 1 ? v.toFixed(2) : Number(v.toPrecision(4)).toString();
}

/**
 * Current currency exchange rates from poe.ninja, in the league's primary currency (C-12, D-33):
 * the primary is read from each response, never assumed.
 */
export async function handleGetCurrencyRates(
  context: PoeNinjaContext,
  args: {
    league: string;
  },
): Promise<{ content: Array<{ type: string; text: string }> }> {
  return wrapHandler('get currency rates', async () => {
    const { league } = args;
    const rates = await context.currency.getRates(league);
    if (!rates) {
      throw new Error(`currency rates for "${league}" are unavailable from poe.ninja right now; try again later`);
    }

    const primaryName = rates.nameOf(rates.primary);
    const currencies = rates.currencies();

    let output = `=== Currency Exchange Rates (PoE2): ${league} ===\n`;
    output += `Source: poe.ninja · values in ${primaryName} (${rates.primary}) · fetched ${new Date(rates.fetchedAt).toISOString()}\n\n`;
    const width = Math.max(...currencies.map((c) => `${c.name} (${c.id})`.length));
    for (const c of currencies) {
      const label = `${c.name} (${c.id})`.padEnd(width);
      let line = `  ${label}  ${formatValue(c.valueInPrimary)} ${rates.primary}`;
      if (c.id !== rates.primary && c.valueInPrimary < 1) {
        line += ` · ${formatValue(1 / c.valueInPrimary)} per ${rates.primary}`;
      }
      output += `${line}\n`;
    }
    output += `\nTotal currencies: ${currencies.length}\n`;
    output += `Note: 1 ${primaryName} = 1 ${rates.primary}; each value is what one unit is worth in ${primaryName}. Rates are cached for up to 60 minutes.\n`;

    return { content: [{ type: 'text', text: output }] };
  });
}
