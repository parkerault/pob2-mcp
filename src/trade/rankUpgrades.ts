/**
 * `find_upgrades` evaluation, pricing, ranking and selection (C-14 flow steps 10–13, WU-23).
 *
 * These run after the search pipeline (`runUpgradeSearch`, C-21) inside the same `session.run`:
 * 10. **Evaluate**: `trade_evaluate_items` over the sanitized entries, one action call per 10. A block
 *     never starts with < 1 s left, its engine timeout is `min(default, remaining)`, and a block cut by
 *     the deadline ends evaluation with the "budget ran out" stop (D-22). Items PoB could not evaluate
 *     are reported as rejected.
 *
 *     The deadline ends an engine step through an abort signal, a moment before the request's clipped
 *     timeout would fire: the bridge kills the engine on a timeout (C-4), and the session then discards
 *     the call's result (C-3 step 6), so a timeout would lose the listings already evaluated. An abort
 *     rejects the request and leaves the engine running; its late reply is dropped by id.
 * 11. **Prices** (C-12, D-11, D-33, D-54), after evaluation: the league's rates, bounded by the time
 *     left (a cut or failed lookup means no rates, D-11), then each listing's price converted into the
 *     display currency (the requested `currency`; `exalted` for `exalted_equivalent`); over-budget
 *     listings dropped and counted; unconvertible ones flagged and never counted over budget; without
 *     rates nothing is post-filtered.
 * 12. **Rank** by `rank_by`, ties by listing id; the price modes fall back to `stat_value` (with a note)
 *     when rates are unavailable or the conversion is partial. `is_upgrade` is
 *     `round(score, 4) > round(baseline, 4)`.
 * 13. **Select**: the upgrades, up to `limit`; with `include_non_upgrades`, the top `limit` regardless.
 */
import type { EngineCallContext } from '../engine/session.js';
import type { TradeEvaluateItemsResult } from '../engine/schemas.js';
import { convert, type Rates } from './currency.js';
import {
  FINISH_RESERVE_MS,
  MIN_STEP_MS,
  STOP_BUDGET,
  deadlineBound,
  stoppedEarlyNote,
  weightedSumOf,
  type Env,
  type FindUpgradesInput,
  type SearchStop,
  type UpgradeSearchResult,
} from './findUpgrades.js';
import { NO_MATCHES, NO_UPGRADE, type UpgradeReport } from './renderUpgrades.js';
import type { FetchEntry } from './tradeClient.js';

// ---------------------------------------------------------------------------------------------------
// Constants

/** Fetched entries per `trade_evaluate_items` call (C-14 step 10). */
export const EVALUATE_BLOCK = 10;
/** The engine's default request timeout (`POB_TIMEOUT_MS`, else 30 s, D-47), clipped to the time left. */
export const DEFAULT_ENGINE_TIMEOUT_MS = 30_000;

/** Re-exported: deadline-bound steps share the reserve (D-75), defined with the search pipeline. */
export { FINISH_RESERVE_MS };

export const NO_RATES_NOTE =
  'Currency rates unavailable: showing native prices; the budget was enforced by the trade site only.';

export type RankBy = FindUpgradesInput['rank_by'];

// ---------------------------------------------------------------------------------------------------
// Rows

export interface StatDelta {
  base: number | null;
  new: number | null;
  delta: number | null;
  pct?: number | null;
}

/** One evaluated listing. */
export interface ListingRow {
  id: string;
  /** Position in trade order (the order trade2 returned the listings). */
  tradeIndex: number;
  entry: FetchEntry;
  name: string;
  baseType: string;
  account: string | null;
  whisper: string | null;
  price: { amount: number; currency: string } | null;
  /** The listing's weighted sum (`pseudoMods` "Sum: <w>", A-9), for the exact-item link. */
  weightedSum: number | null;
  score: number;
  stats: Record<string, StatDelta>;
  itemText: string;
  isUpgrade: boolean;
  /** The price in the display currency (step 11), or null when not converted. */
  normalized: number | null;
  /** The price in divine (for `stat_value_per_price`), or null. */
  divine: number | null;
  /** Rates were available, but this listing's price could not be converted (D-54). */
  priceNotConverted: boolean;
}

/** PoB's 4-decimal comparison (C-14 step 12). */
export function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

/** `is_upgrade` = `round(score, 4) > round(baselineScore, 4)` (C-14 step 12). */
export function isUpgrade(score: number, baseline: number): boolean {
  return round4(score) > round4(baseline);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** The listing fields a row shows (name, base, seller, whisper, price). */
function describeEntry(entry: FetchEntry): Pick<ListingRow, 'name' | 'baseType' | 'account' | 'whisper' | 'price'> {
  const item = (entry as unknown as { item?: Record<string, unknown> }).item ?? {};
  const listing = (entry as unknown as { listing?: Record<string, unknown> }).listing ?? {};
  const name = str(item.name).trim() || str(item.typeLine).trim();
  const baseType = str(item.baseType).trim() || str(item.typeLine).trim();
  const account = str((listing.account as { name?: unknown } | undefined)?.name).trim() || null;
  const whisper = str(listing.whisper).trim() || null;
  const p = listing.price as { amount?: unknown; currency?: unknown } | undefined;
  const price =
    p && typeof p.amount === 'number' && Number.isFinite(p.amount) && typeof p.currency === 'string' && p.currency !== ''
      ? { amount: p.amount, currency: p.currency }
      : null;
  return { name, baseType, account, whisper, price };
}

// ---------------------------------------------------------------------------------------------------
// Step 10: evaluate

export interface EvaluateContext {
  engine: EngineCallContext;
  signal: AbortSignal;
  /** Epoch ms (D-22), on the `now` clock. */
  deadline: number;
  /** The clock `deadline` is on (the server passes its monotonic clock); default `Date.now`. */
  now?: () => number;
  env: Env;
}

export interface Evaluation {
  rows: ListingRow[];
  rejected: Array<{ id: string; reason: string }>;
  /** Set when the deadline cut evaluation (the rows evaluated so far are kept). */
  stop?: SearchStop;
}

/** The engine's default request timeout: `POB_TIMEOUT_MS`, else 30 s (as the bridge client reads it). */
export function engineDefaultTimeout(env: Env): number {
  const configured = Number.parseInt(env.POB_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_ENGINE_TIMEOUT_MS;
}

/**
 * C-14 step 10: score `entries` (sanitized, in trade order) against the loaded build, 10 per action
 * call, with the generation's effective weights so scores compare with `baselineScore`.
 */
export async function evaluateEntries(
  entries: FetchEntry[],
  opts: {
    slot: string;
    statWeights: Array<{ stat: string; weight: number }>;
    baselineScore: number;
    reportStats?: string[];
    runeBehaviour: FindUpgradesInput['rune_behaviour'];
    anointBehaviour: FindUpgradesInput['anoint_behaviour'];
  },
  ctx: EvaluateContext,
): Promise<Evaluation> {
  const rows: ListingRow[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];
  const defaultTimeout = engineDefaultTimeout(ctx.env);
  const now = ctx.now ?? Date.now;
  const remaining = () => ctx.deadline - now();

  for (let start = 0; start < entries.length; start += EVALUATE_BLOCK) {
    if (ctx.signal.aborted) throw ctx.signal.reason;
    if (remaining() < MIN_STEP_MS) return { rows, rejected, stop: { reason: STOP_BUDGET } };
    const block = entries.slice(start, start + EVALUATE_BLOCK);
    // The clipped timeout of C-14; the deadline signal fires FINISH_RESERVE_MS before it.
    const timeoutMs = Math.max(1, Math.min(defaultTimeout, remaining()));
    const bound = deadlineBound(ctx);
    let result: TradeEvaluateItemsResult;
    try {
      result = await ctx.engine.client.tradeEvaluateItems(
        {
          slot: opts.slot,
          items: block,
          statWeights: opts.statWeights,
          ...(opts.reportStats && opts.reportStats.length > 0 ? { reportStats: opts.reportStats } : {}),
          runeBehaviour: opts.runeBehaviour,
          anointBehaviour: opts.anointBehaviour,
        },
        { timeoutMs, signal: bound.signal },
      );
    } catch (error) {
      if (ctx.signal.aborted) throw ctx.signal.reason;
      // Cut by the deadline: keep what was evaluated so far (C-14 "Stopping early").
      if (bound.reached()) return { rows, rejected, stop: { reason: STOP_BUDGET } };
      throw error;
    } finally {
      bound.done();
    }

    const byId = new Map<string, TradeEvaluateItemsResult['items'][number]>();
    for (const item of result.items ?? []) if (typeof item?.id === 'string') byId.set(item.id, item);
    for (const r of result.rejected ?? []) rejected.push({ id: r.id, reason: r.reason });
    block.forEach((entry, i) => {
      const id = typeof entry.id === 'string' ? entry.id : `#${start + i + 1}`;
      const item = byId.get(id);
      if (!item) return; // reported in `rejected`
      if (typeof item.score !== 'number' || !Number.isFinite(item.score)) {
        rejected.push({ id, reason: 'PoB returned no score for the item' });
        return;
      }
      rows.push({
        id,
        tradeIndex: start + i,
        entry,
        ...describeEntry(entry),
        weightedSum: weightedSumOf(entry),
        score: item.score,
        stats: (item.stats ?? {}) as Record<string, StatDelta>,
        itemText: item.itemText,
        isUpgrade: isUpgrade(item.score, opts.baselineScore),
        normalized: null,
        divine: null,
        priceNotConverted: false,
      });
    });
  }
  return { rows, rejected };
}

// ---------------------------------------------------------------------------------------------------
// Step 11: prices

/** The display currency: the requested one, `exalted` for `exalted_equivalent` (C-14 step 11). */
export function displayCurrency(currency: FindUpgradesInput['currency']): string {
  return currency === 'exalted_equivalent' ? 'exalted' : currency;
}

export interface Pricing {
  /** The rows left after the budget post-filter, in their input order. */
  kept: ListingRow[];
  overBudget: number;
  /** Rates were available, and at least one kept listing could not be converted (D-54). */
  partial: boolean;
  ratesAvailable: boolean;
  notes: string[];
}

/** C-14 step 11 over evaluated rows. Rows are updated in place with their converted prices. */
export function priceRows(rows: ListingRow[], opts: { display: string; maxPrice?: number; rates: Rates | null }): Pricing {
  const { display, maxPrice, rates } = opts;
  if (!rates) {
    for (const row of rows) {
      row.normalized = null;
      row.divine = null;
      row.priceNotConverted = false;
    }
    return { kept: [...rows], overBudget: 0, partial: false, ratesAvailable: false, notes: [NO_RATES_NOTE] };
  }
  const kept: ListingRow[] = [];
  let overBudget = 0;
  for (const row of rows) {
    row.normalized = row.price ? convert(row.price.amount, row.price.currency, display, rates) : null;
    row.divine = row.price ? convert(row.price.amount, row.price.currency, 'divine', rates) : null;
    if (row.normalized !== null && !Number.isFinite(row.normalized)) row.normalized = null;
    if (row.divine !== null && !Number.isFinite(row.divine)) row.divine = null;
    row.priceNotConverted = row.normalized === null;
    // D-11: the post-filter on the normalized price; an unconverted price is never over budget (D-54).
    if (maxPrice !== undefined && row.normalized !== null && row.normalized > maxPrice * (1 + 1e-9)) {
      overBudget += 1;
      continue;
    }
    kept.push(row);
  }
  const unconverted = kept.filter((r) => r.priceNotConverted).length;
  const notes: string[] = [];
  if (unconverted > 0) {
    notes.push(
      `${unconverted} listing${unconverted === 1 ? '' : 's'} could not be priced in ${display} (flagged "price not converted"); ` +
        'they were not checked against the budget.',
    );
  }
  return { kept, overBudget, partial: unconverted > 0, ratesAvailable: true, notes };
}

// ---------------------------------------------------------------------------------------------------
// Step 12: rank

const byId = (a: ListingRow, b: ListingRow) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** `score − 0.1 × log10(price in divine)` (PoB `TradeQuery.lua:960-963`). */
export function scorePerPrice(row: ListingRow): number | null {
  if (row.divine === null || !(row.divine > 0)) return null;
  return row.score - 0.1 * Math.log10(row.divine);
}

export interface Ranking {
  ordered: ListingRow[];
  /** The mode actually used (a price mode may fall back to `stat_value`). */
  rankedBy: RankBy;
  note?: string;
}

/** C-14 step 12. Ties break by listing id. */
export function rankRows(rows: ListingRow[], rankBy: RankBy, pricing: Pick<Pricing, 'ratesAvailable' | 'partial'>): Ranking {
  let mode: RankBy = rankBy;
  let note: string | undefined;
  if (rankBy === 'price' || rankBy === 'stat_value_per_price') {
    const missing = rankBy === 'stat_value_per_price' && rows.some((r) => scorePerPrice(r) === null);
    if (!pricing.ratesAvailable || pricing.partial || missing) {
      mode = 'stat_value';
      const why = !pricing.ratesAvailable ? 'currency rates are unavailable' : 'some prices could not be converted';
      note = `rank_by "${rankBy}" fell back to "stat_value": ${why}.`;
    }
  }
  const ordered = [...rows];
  switch (mode) {
    case 'stat_value':
      ordered.sort((a, b) => b.score - a.score || byId(a, b));
      break;
    case 'price':
      ordered.sort((a, b) => (a.normalized as number) - (b.normalized as number) || byId(a, b));
      break;
    case 'stat_value_per_price':
      ordered.sort((a, b) => (scorePerPrice(b) as number) - (scorePerPrice(a) as number) || byId(a, b));
      break;
    case 'trade_weight':
      ordered.sort((a, b) => a.tradeIndex - b.tradeIndex || byId(a, b));
      break;
  }
  return { ordered, rankedBy: mode, ...(note ? { note } : {}) };
}

// ---------------------------------------------------------------------------------------------------
// Step 13: select

/** By default only upgrades, up to `limit`; with `includeNonUpgrades`, the top `limit` regardless. */
export function selectRows(ordered: ListingRow[], limit: number, includeNonUpgrades: boolean): ListingRow[] {
  return (includeNonUpgrades ? ordered : ordered.filter((r) => r.isUpgrade)).slice(0, limit);
}

// ---------------------------------------------------------------------------------------------------
// Steps 10–13 together: from the searched listings to the report the renderer prints

export interface CompleteContext extends EvaluateContext {
  /** The engine's loaded build (C-3), for the `Build:` line. */
  loaded: { displayName: string; path: string | null } | null;
  currency: { getRates(league: string): Promise<Rates | null> };
  progress: (message: string) => Promise<void>;
  /** The wall-clock time (epoch ms) that dates the report's prices: `UpgradeReport.checkedAt` (C-49, D-372). */
  checkedAt: number;
}

type Searched = Extract<UpgradeSearchResult, { kind: 'searched' }>;

/** The slot's equipped item (`get_items`), `empty`, or `unknown` when it can't be read in time. */
async function currentItem(slot: string, ctx: EvaluateContext): Promise<string> {
  const remaining = ctx.deadline - (ctx.now ?? Date.now)();
  if (remaining < MIN_STEP_MS) return 'unknown';
  const bound = deadlineBound(ctx);
  try {
    const timeoutMs = Math.max(1, Math.min(engineDefaultTimeout(ctx.env), remaining));
    const reply = (await ctx.engine.client.request('get_items', {}, { timeoutMs, signal: bound.signal })) as unknown as {
      items?: unknown;
      result?: unknown;
    };
    const raw = reply.items ?? (reply.result as { items?: unknown } | undefined)?.items ?? reply.result;
    const items = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
    const found = items.find((it) => (it as { slot?: unknown } | null)?.slot === slot) as
      | { name?: unknown; baseName?: unknown; id?: unknown }
      | undefined;
    if (!found || typeof found.name !== 'string' || found.name.trim() === '') return 'empty';
    const name = found.name.trim();
    const base = typeof found.baseName === 'string' ? found.baseName.trim() : '';
    // PoB's item names already end with the base for rares and uniques ("Chimeric Suit, Death Mail").
    return base && !name.includes(base) ? `${name}, ${base}` : name;
  } catch (error) {
    if (ctx.signal.aborted) throw ctx.signal.reason;
    console.error(`[find_upgrades] reading the current ${slot} item failed: ${error instanceof Error ? error.message : String(error)}`);
    return 'unknown';
  } finally {
    bound.done();
  }
}

/**
 * The league's rates (C-12), bounded like every step (D-22): not started with < 1 s left, cut at
 * `min(15 s, remaining)` (less the finish reserve), and ended by the caller's abort. `budgetCut` says
 * the deadline ended it. A cut or failed lookup is "no rates" (D-11); the evaluated rows are kept.
 */
async function boundedRates(league: string, ctx: CompleteContext): Promise<{ rates: Rates | null; budgetCut: boolean }> {
  const now = ctx.now ?? Date.now;
  if (ctx.deadline - now() < MIN_STEP_MS) return { rates: null, budgetCut: true };
  const left = Math.max(0, ctx.deadline - FINISH_RESERVE_MS - now());
  const clipped = left < 15_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => resolve({ rates: null, budgetCut: clipped }), Math.min(15_000, left));
      onAbort = () => reject(ctx.signal.reason);
      ctx.signal.addEventListener('abort', onAbort, { once: true });
      ctx.currency.getRates(league).then((rates) => resolve({ rates, budgetCut: false }), () => resolve({ rates: null, budgetCut: false }));
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort) ctx.signal.removeEventListener('abort', onAbort);
  }
}

/**
 * The statement before the search link (C-14 output, "Zero results"):
 * - every search total 0 → `No listings matched the search.`, with no "upgrade" wording;
 * - otherwise, with no upgrade, `No upgrade within budget.` is always stated, after
 *   `All <n> fetched items were rejected: <first 3 reasons>.` when nothing was evaluated because
 *   every fetched item was rejected (or `<r> of <n> fetched items were rejected: …` when only some
 *   were, e.g. the deadline cut evaluation, or some entries were unavailable);
 * - null when there are upgrades.
 */
export function closingStatement(c: {
  searches: number;
  total: number;
  fetched: number;
  evaluated: number;
  rejected: Array<{ reason: string }>;
  upgrades: number;
  stopped: boolean;
}): string | null {
  if (c.fetched === 0 && c.total === 0 && c.searches > 0 && !c.stopped) return NO_MATCHES;
  if (c.upgrades > 0) return null;
  if (c.evaluated === 0 && c.rejected.length > 0) {
    const n = c.rejected.length;
    const reasons = c.rejected.slice(0, 3).map((r) => r.reason.replace(/\.+$/, ''));
    const which =
      n === c.fetched
        ? `All ${n} fetched items were rejected`
        : `${n} of ${c.fetched} fetched item${c.fetched === 1 ? '' : 's'} ${n === 1 ? 'was' : 'were'} rejected`;
    return `${which}: ${reasons.join('; ')}.\n${NO_UPGRADE}`;
  }
  return NO_UPGRADE;
}

/** C-14 steps 10–13 over a `searched` pipeline result: the report `renderUpgradeReport` prints. */
export async function completeUpgradeSearch(searched: Searched, input: FindUpgradesInput, ctx: CompleteContext): Promise<UpgradeReport> {
  const notes = [...searched.notes];
  let stop = searched.stoppedEarly;
  const display = displayCurrency(input.currency);

  const current = await currentItem(input.slot, ctx);

  // 10. Evaluate (each block checks the budget itself).
  let evaluation: Evaluation = { rows: [], rejected: [] };
  if (searched.entries.length > 0) {
    await ctx.progress('evaluating');
    evaluation = await evaluateEntries(
      searched.entries,
      {
        slot: input.slot,
        statWeights: searched.statWeights.map((w) => ({ stat: w.stat, weight: w.weight })),
        baselineScore: searched.baselineScore,
        reportStats: input.report_stats,
        runeBehaviour: input.rune_behaviour,
        anointBehaviour: input.anoint_behaviour,
      },
      ctx,
    );
    if (evaluation.stop && !stop) stop = evaluation.stop;
  }

  // 11. Rates, after evaluation (C-14 step order), bounded by the time left: a slow or failing
  // poe.ninja (D-11) costs the prices, never the evaluated listings.
  let rates: Rates | null = null;
  if (evaluation.rows.length > 0) {
    if (ctx.signal.aborted) throw ctx.signal.reason;
    const r = await boundedRates(searched.league, ctx);
    rates = r.rates;
    if (r.budgetCut && !stop) stop = { reason: STOP_BUDGET };
  }

  // 11–13.
  const pricing = priceRows(evaluation.rows, { display, maxPrice: input.max_price, rates });
  const ranking = rankRows(pricing.kept, input.rank_by, pricing);
  const listings = selectRows(ranking.ordered, input.limit, input.include_non_upgrades);
  const upgrades = pricing.kept.filter((r) => r.isUpgrade).length;

  if (stop) notes.push(stoppedEarlyNote(stop));
  if (evaluation.rows.length > 0) notes.push(...pricing.notes);
  if (ranking.note) notes.push(ranking.note);

  const fetched = searched.entries.length + searched.dropped.nullEntries + searched.dropped.unpriced;
  const evaluated = evaluation.rows.length;
  const closing = closingStatement({
    searches: searched.searches,
    total: searched.total,
    fetched,
    evaluated,
    rejected: evaluation.rejected,
    upgrades,
    stopped: stop !== undefined,
  });

  await ctx.progress('done');
  return {
    slot: input.slot,
    build: ctx.loaded,
    league: searched.league,
    checkedAt: ctx.checkedAt,
    status: input.status,
    budget: input.max_price !== undefined ? `${input.max_price} ${display}` : null,
    sort: searched.statWeights,
    reportStats: input.report_stats ?? [],
    notices: notes,
    currentItem: current,
    baselineScore: searched.baselineScore,
    counts: {
      searches: searched.searches,
      total: searched.total,
      fetched,
      unavailable: searched.dropped.nullEntries + searched.dropped.unpriced,
      evaluated,
      rejected: evaluation.rejected.length,
      overBudget: pricing.overBudget,
      upgrades,
    },
    listings,
    display,
    query: searched.query,
    closing,
    searchUrl: searched.searchUrl,
  };
}
