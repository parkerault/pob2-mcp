/**
 * Currency service (C-12). Replaces the conversion logic of `src/services/poeNinjaClient.ts`; the
 * client keeps the HTTP.
 *
 * - **Parsing.** `primary = core.primary`, read from every response (D-33; never hard-coded).
 *   `valueInPrimary(c)` is 1 for the primary, `1 / core.rates[c]` when `c` is in `core.rates`
 *   (units of `c` per 1 primary, A-14), `lines[c].primaryValue` when a line has `id == c`, else null.
 *   Currency ids are the trade currency ids (`listing.price.currency`).
 * - **Conversion.** `convert(a, f, t) = a × valueInPrimary(f) / valueInPrimary(t)`, or null.
 * - **Caching.** Per league for 60 min; refreshes send `If-None-Match` with the stored ETag, and a
 *   304 renews the entry.
 * - **Failure.** A network error, a non-2xx or an unreadable body gives `null` (callers degrade,
 *   D-11), logged to stderr. `POE_NINJA_DISABLED=true` gives `null` without a request.
 * - **Other exchange categories** (D-387, D-444): `getExchange(league, type)` reads any category of poe.ninja's
 *   currency exchange (`Runes`, `SoulCores`, `Idols`, `Delirium` for the Distilled Emotions, …;
 *   `src/trade/exchange.ts`) into the same `Rates` shape, cached the same way per league and category: each item's
 *   value in the primary currency and its display name.
 */
import { PoeNinjaClient, type CurrencyOverviewResponse } from '../services/poeNinjaClient.js';

export interface Rates {
  league: string;
  /** The primary currency's trade id (e.g. `divine`). */
  primary: string;
  /** Epoch ms of the response (renewed by a 304). */
  fetchedAt: number;
  /** Value of 1 unit of `currencyId` in the primary currency, or null when unknown. */
  valueInPrimary(currencyId: string): number | null;
  /** Display name for a currency id (`Divine Orb`), or the id itself when poe.ninja names none. */
  nameOf(currencyId: string): string;
  /** Every currency with a known value, highest value first (then by id). */
  currencies(): Array<{ id: string; name: string; valueInPrimary: number }>;
}

/** Convert an amount between two currencies through the primary, or null if either is unknown. */
export function convert(amount: number, from: string, to: string, rates: Rates): number | null {
  const vf = rates.valueInPrimary(from);
  const vt = rates.valueInPrimary(to);
  if (vf === null || vt === null) return null;
  return (amount * vf) / vt;
}

/**
 * A currency value for display: 2 decimals from 1 up, 4 significant digits below, so a small
 * fraction of the primary (1 exalted ≈ 0.002270 divine) never shows as 0.00.
 */
export function formatCurrencyValue(v: number): string {
  return v >= 1 ? v.toFixed(2) : Number(v.toPrecision(4)).toString();
}

function positive(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Build `Rates` from one overview response. Returns null when the response names no primary
 * currency (a response we can't read).
 */
export function parseRates(league: string, body: CurrencyOverviewResponse, fetchedAt: number): Rates | null {
  const primary = body?.core?.primary;
  if (typeof primary !== 'string' || primary === '') return null;

  const coreRates = new Map<string, number>();
  for (const [id, rate] of Object.entries(body.core?.rates ?? {})) {
    const r = positive(rate);
    if (r !== null) coreRates.set(id, r);
  }
  const lineValues = new Map<string, number>();
  for (const line of Array.isArray(body.lines) ? body.lines : []) {
    if (!line || typeof line.id !== 'string') continue;
    const v = positive(line.primaryValue);
    if (v !== null && !lineValues.has(line.id)) lineValues.set(line.id, v);
  }
  const names = new Map<string, string>();
  for (const it of [...(body.core?.items ?? []), ...(Array.isArray(body.items) ? body.items : [])]) {
    if (it && typeof it.id === 'string' && typeof it.name === 'string' && !names.has(it.id)) names.set(it.id, it.name);
  }

  const valueInPrimary = (c: string): number | null => {
    if (c === primary) return 1;
    const rate = coreRates.get(c);
    if (rate !== undefined) return 1 / rate;
    return lineValues.get(c) ?? null;
  };

  return {
    league,
    primary,
    fetchedAt,
    valueInPrimary,
    nameOf: (c) => names.get(c) ?? c,
    currencies() {
      const ids = new Set<string>([primary, ...coreRates.keys(), ...lineValues.keys()]);
      return [...ids]
        .map((id) => ({ id, name: names.get(id) ?? id, valueInPrimary: valueInPrimary(id) as number }))
        .sort((a, b) => b.valueInPrimary - a.valueInPrimary || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    },
  };
}

/** Cache lifetime per league (C-12). */
export const RATES_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  rates: Rates;
  etag: string | null;
  body: CurrencyOverviewResponse;
}

export class CurrencyService {
  private readonly client: PoeNinjaClient;
  private readonly env: Readonly<Record<string, string | undefined>>;
  private readonly now: () => number;
  /** Keyed by `<type>\0<league>`. */
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<Rates | null>>();

  /** No I/O (C-7). */
  constructor(deps: {
    fetch: typeof globalThis.fetch;
    userAgent: string;
    env: Readonly<Record<string, string | undefined>>;
    now?: () => number;
  }) {
    this.client = new PoeNinjaClient({ fetch: deps.fetch, userAgent: deps.userAgent });
    this.env = deps.env;
    this.now = deps.now ?? Date.now;
  }

  /** The league's rates, or null when poe.ninja is disabled or unavailable. Concurrent callers share one request. */
  getRates(league: string): Promise<Rates | null> {
    return this.getExchange(league, 'Currency');
  }

  /**
   * D-387, D-444: one category of the league's currency exchange (`Currency`, `Runes`, `Delirium`, …) as `Rates`, or null when
   * poe.ninja is disabled or unavailable. Concurrent callers share one request.
   */
  getExchange(league: string, type: string): Promise<Rates | null> {
    if (this.env.POE_NINJA_DISABLED === 'true') return Promise.resolve(null);
    const key = `${type}\0${league}`;
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.rates.fetchedAt < RATES_TTL_MS) return Promise.resolve(cached.rates);
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.refresh(league, type, cached).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    return pending;
  }

  private async refresh(league: string, type: string, cached: CacheEntry | undefined): Promise<Rates | null> {
    const key = `${type}\0${league}`;
    try {
      const result = await this.client.exchangeOverview(league, type, cached?.etag ?? null);
      if (result.status === 'not_modified') {
        if (!cached) throw new Error('poe.ninja answered 304 without a cached response');
        const rates = parseRates(league, cached.body, this.now()) as Rates;
        this.cache.set(key, { ...cached, rates });
        return rates;
      }
      const rates = parseRates(league, result.body, this.now());
      if (!rates) throw new Error('poe.ninja response has no core.primary');
      this.cache.set(key, { rates, etag: result.etag, body: result.body });
      return rates;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const what = type === 'Currency' ? 'currency rates' : `exchange values (${type})`;
      console.error(`[CurrencyService] ${what} unavailable for league "${league}": ${msg}`);
      return null;
    }
  }
}
