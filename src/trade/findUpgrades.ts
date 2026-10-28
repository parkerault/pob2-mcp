/**
 * The `find_upgrades` search pipeline (C-21): C-14 flow steps 1–9.
 *
 * `runUpgradeSearch(input, ctx)` runs inside the tool's one `session.run` (the engine lock is held
 * through the HTTP phase, D-8a) and returns either
 * - a **fallback** (D-49: no usable session, a rejected session, or a query still too complex after one
 *   reduction), a result rather than a failure, carrying the trade-site link for the generated query; or
 * - the **searched** listings: sanitized fetch entries (D-56) in trade order, ready for evaluation,
 *   plus what the search did, any notes, and an early stop when one ended it.
 *
 * WU-23 then evaluates, prices, ranks and renders, inside the same `session.run`.
 *
 * Flow:
 *  1. input: validated by `parseFindUpgradesInput` (zod; an invalid field is named, D-27); the
 *     `report_stats` names, which only the engine can check, are checked by `trade_generate_query` at
 *     step 4, before any request (`reportStatsError` names the field);
 *  2. league known? the `league` input, else `POE_LEAGUE`;
 *  3. options: the input mapped to `trade_generate_query` params (C-13);
 *  4. query: the generated-query cache (LRU 32, keyed by session revision, slot and the canonical
 *     params), else `trade_generate_query`;
 *  5. session: no usable `POESESSID` → the fallback, with **no request sent** when the league is known;
 *  6. league resolved (D-20) when unknown;
 *  7. weighted and required stat ids absent from `/data/stats` are dropped, with a note;
 *  8. the complexity prefit (D-23);
 *  9. up to 5 searches with PoB's weight-adjust loop (`SearchWithQueryWeightAdjusted`), then the fetch
 *     of the chosen ids in blocks of ≤ 10, reusing entries already fetched; `null` and price-less
 *     entries are dropped and counted (D-56). Under the limiter's search pace (D-461: searches at least
 *     45 s apart) the 90 s deadline fits at most two searches; when the pace refuses the next one, the
 *     loop ends and the call fetches the best listings of the searches it ran, with the gap's stop.
 *
 * Bounds (D-22): every step checks the caller's signal, no step starts with < 1 s left, every engine
 * request's timeout is `min(default, remaining)` and the deadline ends it by abort just before that
 * (`deadlineBound`, D-75), and every trade request carries the deadline (the
 * client clips its timeout, the limiter refuses waits past it or past 60 s). The `/data/leagues` and
 * `/data/stats` loads take no deadline or signal (they are shared, cached loads), so the flow races them
 * against the caller's signal and a `min(15 s, remaining)` timer instead.
 *
 * The engine-lock wait happens before this flow runs (the caller's `session.run`); its `EngineBusyError`
 * is the router's to turn into the engine-busy stop (`engineBusyStopText`).
 */
import { z } from 'zod';
import type { EngineCallContext, EngineSession } from '../engine/session.js';
import { EngineActionError, EngineTimeoutError } from '../pobLuaBridge.js';
import type { TradeGenerateQueryParams, TradeGenerateQueryResult } from '../engine/schemas.js';
import type { Credentials } from './credentials.js';
import { TradeError, type TradeErrorKind } from './errors.js';
import { PaceWaitError } from './rateLimiter.js';
import { REQUEST_TIMEOUT_MS, type FetchEntry, type SearchResponse, type TradeApiClient } from './tradeClient.js';
import { resolveDefaultLeague } from './league.js';
import { tradeQueryUrl, tradeSearchUrl } from './links.js';
import {
  dropLowestWeighted,
  prefitQuery,
  tooComplexDropCount,
  weightGroup,
  weightedFilterCount,
  type TradeQueryBody,
} from './prefit.js';

// ---------------------------------------------------------------------------------------------------
// Constants (D-22, D-47, D-50)

/** No step starts with less than this left before the deadline (D-22). */
export const MIN_STEP_MS = 1_000;
/** `trade_generate_query`'s default engine timeout (D-47), clipped to the time left. */
export const GENERATE_TIMEOUT_MS = 60_000;
/**
 * The longest limiter wait any trade request of the call accepts (C-11; 60 s since D-461, so the 45 s
 * gap between searches is waited inside the call).
 */
export const SEARCH_MAX_WAIT_MS = 60_000;
/** PoB's `maxRecursion` (`TradeQueryRequests.lua:111`): at most 5 searches per call. */
export const MAX_SEARCHES = 5;
/** trade2 caps `total` at this many matches. */
export const RESULT_CAP = 10_000;
/** Listings per fetch request and per "page" (A-4). */
export const FETCH_BLOCK = 10;
/** The generated-query cache size (D-50). */
export const QUERY_CACHE_SIZE = 32;

/**
 * A deadline-bound engine step ends this long before the deadline (through its abort signal), so the
 * work after it still finishes within the 90 s (AC-T44 (e), D-75).
 */
export const FINISH_RESERVE_MS = 250;

/** The early-stop reasons (C-14 "Stopping early"); a renderer prints `Stopped early: <reason>.`. */
export const STOP_BUDGET = 'the 90 s budget ran out';
export const STOP_ENGINE_BUSY = 'the engine was busy';

const LINK_INTRO = 'Open this search in a browser where you are logged in to pathofexile.com:';

// ---------------------------------------------------------------------------------------------------
// Input (C-14 step 1)

export const FIND_UPGRADES_CURRENCIES = [
  'exalted_equivalent',
  'exalted',
  'chaos',
  'divine',
  'aug',
  'transmute',
  'regal',
  'vaal',
  'annul',
  'alch',
  'mirror',
] as const;
export const FIND_UPGRADES_STATUSES = ['securable', 'available', 'onlineleague', 'online', 'any'] as const;
export const FIND_UPGRADES_RANK_BY = ['stat_value', 'stat_value_per_price', 'price', 'trade_weight'] as const;
const BEHAVIOURS = ['copy', 'keep', 'remove'] as const;

/** `find_upgrades` input (C-14): the zod schema the handler validates with (D-27). */
export const findUpgradesInputSchema = z.object({
  slot: z.string().min(1),
  sort_stats: z
    .array(
      z.object({
        stat: z
          .string()
          .min(1)
          .refine((s) => !s.endsWith('TakenHit'), (s) => ({ message: `stat ${s} is not supported for upgrade search` })),
        weight: z.number().min(0.01).max(1),
      }),
    )
    .min(1)
    .max(10)
    .optional(),
  required_mods: z
    .array(z.object({ trade_id: z.string().min(1), min: z.number() }))
    .max(3)
    .optional(),
  max_price: z.number().positive().optional(),
  currency: z.enum(FIND_UPGRADES_CURRENCIES).default('exalted_equivalent'),
  max_level: z.number().int().min(1).max(100).optional(),
  min_empty_rune_sockets: z.number().int().min(1).max(6).optional(),
  weight_corrupted_mods: z.boolean().optional(),
  include_mirrored: z.boolean().default(true),
  rune_behaviour: z.enum(BEHAVIOURS).default('copy'),
  anoint_behaviour: z.enum(BEHAVIOURS).default('copy'),
  jewel_type: z.enum(['base', 'radius']).optional(),
  status: z.enum(FIND_UPGRADES_STATUSES).default('securable'),
  league: z.string().min(1).optional(),
  fetch_pages: z.number().int().min(1).max(10).default(2),
  rank_by: z.enum(FIND_UPGRADES_RANK_BY).default('stat_value'),
  report_stats: z.array(z.string().min(1)).max(10).optional(),
  limit: z.number().int().min(1).max(20).default(10),
  include_non_upgrades: z.boolean().default(false),
});

/** The validated `find_upgrades` input, defaults applied. */
export type FindUpgradesInput = z.output<typeof findUpgradesInputSchema>;

/** Validate raw tool arguments (C-14 step 1). Throws an error naming the first invalid field (D-27). */
export function parseFindUpgradesInput(args: unknown): FindUpgradesInput {
  const parsed = findUpgradesInputSchema.safeParse(args ?? {});
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue.path.length > 0 ? issue.path.join('.') : '(arguments)';
  throw new Error(`invalid find_upgrades argument ${field}: ${issue.message}`);
}

/** C-14 step 3's currency mapping: the input value `exalted_equivalent` is PoB's `null` currency. */
export function currencyParam(currency: FindUpgradesInput['currency']): string | null {
  return currency === 'exalted_equivalent' ? null : currency;
}

/** The inverse: the `currency` input value for one of PoB's currency ids (C-15 lists them this way). */
export function currencyInputValue(id: string | null): string {
  return id === null ? 'exalted_equivalent' : id;
}

/** C-14 step 3: the input as `trade_generate_query` params (C-13). */
export function toGenerateParams(input: FindUpgradesInput): TradeGenerateQueryParams {
  const params: TradeGenerateQueryParams = { slot: input.slot };
  if (input.sort_stats) params.statWeights = input.sort_stats.map((s) => ({ stat: s.stat, weight: s.weight }));
  if (input.required_mods && input.required_mods.length > 0) {
    params.requiredMods = input.required_mods.map((m) => ({ tradeId: m.trade_id, min: m.min }));
  }
  if (input.max_price !== undefined) params.maxPrice = input.max_price;
  params.currency = currencyParam(input.currency);
  if (input.max_level !== undefined) params.maxLevel = input.max_level;
  if (input.min_empty_rune_sockets !== undefined) params.sockets = input.min_empty_rune_sockets;
  if (input.weight_corrupted_mods !== undefined) params.includeCorrupted = input.weight_corrupted_mods;
  params.includeMirrored = input.include_mirrored;
  params.runeBehaviour = input.rune_behaviour;
  if (input.jewel_type) params.jewelType = input.jewel_type === 'base' ? 'Base' : 'Radius';
  params.status = input.status;
  // Checked by the engine at generation, before any request, so a bad name fails fast (C-14 step 1).
  if (input.report_stats && input.report_stats.length > 0) params.reportStats = [...input.report_stats];
  return params;
}

/**
 * The C-14 step-1 error for a `report_stats` name the engine rejected at generation: `trade_generate_query`
 * fails with `reportStats[<i>]: <reason>` (1-based), which names the input field `report_stats.<i-1>`
 * the way the zod check does (D-27). Null for any other error.
 */
export function reportStatsError(error: unknown): Error | null {
  if (!(error instanceof EngineActionError) || error.action !== 'trade_generate_query') return null;
  const m = /^reportStats\[(\d+)\]:?\s*(.*)$/s.exec(error.error);
  if (!m) return null;
  return new Error(`invalid find_upgrades argument report_stats.${Number(m[1]) - 1}: ${m[2]}`);
}

// ---------------------------------------------------------------------------------------------------
// The seam (C-21)

export type Env = Readonly<Record<string, string | undefined>>;

export type UpgradeSearchResult =
  | { kind: 'fallback'; reason: string; hint: string; link: string; notes: string[] }
  | {
      kind: 'searched';
      league: string;
      slot: string;
      query: object;
      statWeights: Array<{ stat: string; label: string; weight: number }>;
      baselineScore: number;
      searches: number;
      total: number;
      /** Sanitized (D-56), in trade order, ≤ fetch_pages × 10. */
      entries: FetchEntry[];
      dropped: { nullEntries: number; unpriced: number };
      droppedStatIds: string[];
      notes: string[];
      stoppedEarly?: SearchStop;
      /** https://www.pathofexile.com/trade2/search/poe2/<league>/<last search id> */
      searchUrl: string;
    };

export interface UpgradeSearchContext {
  engine: EngineCallContext;
  trade: Pick<TradeApiClient, 'search' | 'fetch' | 'getStats' | 'getLeagues'>;
  credentials: () => Credentials;
  env: Env;
  signal: AbortSignal;
  /** Epoch ms (D-22: the call's arrival + 90 s), on the `now` clock. */
  deadline: number;
  /** The clock `deadline` is on (the server passes its monotonic clock); default `Date.now`. */
  now?: () => number;
  progress: (message: string) => Promise<void>;
  /**
   * The engine session whose `revision` keys the generated-query cache (C-14 step 4). An amendment to
   * C-21's ctx: the engine call context carries no revision, so the caller passes the session. It is
   * required, so a caller cannot leave it out and silently lose the cache.
   */
  session: Pick<EngineSession, 'revision'>;
}

/** A failure of the search that the tool reports as `isError`; the message ends with the trade-site link when there is one. */
export class UpgradeSearchError extends Error {
  constructor(
    message: string,
    readonly link?: string,
  ) {
    super(link ? `${message}\n${LINK_INTRO}\n${link}` : message);
    this.name = 'UpgradeSearchError';
  }
}

// ---------------------------------------------------------------------------------------------------
// Early stops (C-14 "Stopping early")

/** The trade-site limits that stop a search early (C-14 "Stopping early"): the limiter's refusals and a 429. */
export type TradeLimitKind = Extract<TradeErrorKind, 'would_wait' | 'locked_out' | 'rate_limited'>;

export interface SearchStop {
  reason: string;
  waitS?: number;
  /** Set when a trade-site limit caused the stop: the `TradeErrorKind`, which the stop line names (C-49, D-372). */
  kind?: TradeLimitKind;
}

/**
 * D-461: the stop when the server's search pace refused the loop's next search after `searches` ran:
 * `the 45 s gap between trade searches cut the loop short after <n> search(es)`.
 */
export function paceStop(searches: number, refusal: PaceWaitError): SearchStop {
  const ran = `after ${searches} search${searches === 1 ? '' : 'es'}`;
  if (refusal.gapMs > 0) {
    return { reason: `the ${Math.round(refusal.gapMs / 1000)} s gap between trade searches cut the loop short ${ran}` };
  }
  const cap = refusal.cap;
  return {
    reason: `the cap of ${cap?.max} trade searches in ${Math.round((cap?.periodMs ?? 0) / 1000)} s cut the loop short ${ran}`,
  };
}

/** The rate-limit stop: `the trade site's rate limit requires waiting <n> s`, with the limit's kind. */
export function rateLimitStop(waitS: number | undefined, kind: TradeLimitKind): SearchStop {
  if (waitS === undefined || !Number.isFinite(waitS)) {
    return { reason: "the trade site's rate limit requires waiting longer than this call can", kind };
  }
  return { reason: `the trade site's rate limit requires waiting ${waitS} s`, waitS, kind };
}

/**
 * The early stop a trade error means, or null when it is not one: the limiter's refusals and a 429
 * (the rate-limit stop). The engine-busy stop is not here: the lock wait is the caller's `session.run`,
 * so its `EngineBusyError` surfaces in the router, which renders `engineBusyStopText`.
 */
export function stopForError(error: unknown): SearchStop | null {
  if (error instanceof TradeError) {
    if (error.kind === 'would_wait' || error.kind === 'locked_out') return rateLimitStop(error.waitS, error.kind);
    if (error.kind === 'rate_limited') return rateLimitStop(error.retryAfterS, error.kind);
  }
  return null;
}

/**
 * The note an early stop renders as: `Stopped early: <reason>.`, and for a trade-site limit
 * `Stopped early: [trade:<kind>] <reason>.`, C-49's prefix with the `TradeErrorKind` unchanged (D-372), so
 * a caller classifies the stop as it does the other trade tools' errors.
 */
export function stoppedEarlyNote(stop: SearchStop): string {
  return `Stopped early: ${stop.kind ? `[trade:${stop.kind}] ` : ''}${stop.reason}.`;
}

/**
 * The `find_upgrades` result when its deadline passed while it waited for the engine lock
 * (`EngineBusyError` from `session.run`, C-14 "Stopping early"): nothing was generated, searched or
 * evaluated, so there is no listing and no link. A result, not `isError`.
 */
export function engineBusyStopText(slot?: unknown): string {
  const head = typeof slot === 'string' && slot.trim() ? `=== find_upgrades: ${slot.trim()} ===\n` : '';
  return (
    `${head}${stoppedEarlyNote({ reason: STOP_ENGINE_BUSY })}\n` +
    'Another engine call held the engine until this call\'s 90 s budget ran out, so no trade search was run. ' +
    'Try again once that call has finished.'
  );
}

/**
 * The `find_upgrades` error text when its deadline arrived during the engine session's own steps
 * (`EngineDeadlineError`: the engine start, the snapshot restore after a crash, or the disk-change
 * reload), before PoB generated the query. `step` is what the engine was doing.
 */
export function engineDeadlineStopText(step: string): string {
  return (
    `Stopped early: ${STOP_BUDGET} before PoB generated the trade query (the engine was ${step}), so no trade ` +
    'search was run. Try again: the next engine call finishes that work first.'
  );
}

// ---------------------------------------------------------------------------------------------------
// The generated-query cache (C-14 step 4; data model: under the engine mutex)

/** JSON with object keys sorted at every level, so equal params give equal keys. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

class QueryCache {
  private readonly entries = new Map<string, TradeGenerateQueryResult>();
  constructor(private readonly size: number) {}

  get(key: string): TradeGenerateQueryResult | undefined {
    const hit = this.entries.get(key);
    if (hit !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, hit);
    }
    return hit;
  }

  set(key: string, value: TradeGenerateQueryResult): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.size) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }
}

/** One cache per engine session (the server has one session; tests may run several). */
const caches = new WeakMap<object, QueryCache>();

function cacheFor(session: object): QueryCache {
  let cache = caches.get(session);
  if (!cache) {
    cache = new QueryCache(QUERY_CACHE_SIZE);
    caches.set(session, cache);
  }
  return cache;
}

// ---------------------------------------------------------------------------------------------------
// Helpers

/** Raised by a deadline-bound step's signal when the deadline (less the finish reserve) arrives. */
export class DeadlineReached extends Error {
  constructor() {
    super(STOP_BUDGET);
    this.name = 'DeadlineReached';
  }
}

/**
 * The abort signal for one deadline-bound engine step (D-75): the caller's signal, plus one that fires
 * `FINISH_RESERVE_MS` before the deadline. Ending the step this way rejects the request without killing
 * the engine, unlike the bridge's timeout (C-4: a timeout SIGKILLs the engine, and the session then
 * reports a crash, C-3 step 7). `done()` clears the timer.
 */
export function deadlineBound(ctx: { signal: AbortSignal; deadline: number; now?: () => number }): {
  signal: AbortSignal;
  reached(): boolean;
  done(): void;
} {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new DeadlineReached()), Math.max(0, ctx.deadline - FINISH_RESERVE_MS - (ctx.now ?? Date.now)()));
  return {
    signal: AbortSignal.any([ctx.signal, deadline.signal]),
    reached: () => deadline.signal.aborted,
    done: () => clearTimeout(timer),
  };
}

/** Thrown inside the flow when a step would start with < 1 s left. */
class BudgetExhausted extends Error {
  constructor() {
    super(STOP_BUDGET);
  }
}

/** The fallback reason and hint for a missing or unusable session (C-14 step 5). */
function sessionFallback(creds: Credentials): { reason: string; hint: string } {
  if (creds.problem === 'op-reference') {
    return {
      reason: 'POESESSID holds an unresolved 1Password reference',
      hint:
        'Put the session cookie value itself in POESESSID (in the .env file next to package.json, or in the ' +
        "server's environment): this server does not resolve op:// references.",
    };
  }
  if (creds.problem === 'malformed') {
    return {
      reason: 'POESESSID is malformed',
      hint:
        'Copy the POESESSID cookie value again from your browser (pathofexile.com) into the .env file next to ' +
        'package.json; a cookie value has no spaces, quotes, semicolons or control characters.',
    };
  }
  return {
    reason: 'no POESESSID set',
    hint:
      'Set POESESSID (your pathofexile.com session cookie) in the .env file next to package.json, or in the ' +
      "server's environment. It is read on every call, so no restart is needed.",
  };
}

const SESSION_REJECTED = {
  reason: 'the trade site did not accept the session cookie (POESESSID); it has probably expired',
  hint: 'Log in on pathofexile.com, then refresh POESESSID in the .env file with the new session cookie (no restart needed).',
};

function tooComplexFallback(error: TradeError): { reason: string; hint: string } {
  const server = error.serverMessage ? `: ${error.serverMessage.replace(/\s+/g, ' ').trim()}` : '';
  return {
    reason: `the trade site still found the query too complex after removing its lowest-weight filters${server}`,
    hint: 'Try fewer sort stats or required mods, or open the search below and remove filters there.',
  };
}

/** The weighted sum a weighted fetch result carries (`pseudoMods`: "Sum: <w>", A-9), or null. */
export function weightedSumOf(entry: FetchEntry | null | undefined): number | null {
  const mods = entry?.item?.pseudoMods;
  if (!Array.isArray(mods)) return null;
  for (const mod of mods) {
    const text = typeof mod === 'string' ? mod : (mod as { description?: unknown } | null)?.description;
    if (typeof text !== 'string') continue;
    const m = /^\s*Sum:\s*(-?\d+(?:\.\d+)?)/.exec(text);
    if (m) {
      const value = Number(m[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function hasPrice(entry: FetchEntry): boolean {
  const price = (entry as { listing?: { price?: unknown } }).listing?.price;
  return price !== null && typeof price === 'object';
}

function weightMin(query: TradeQueryBody): number {
  const min = Number((weightGroup(query)?.value as { min?: unknown } | null | undefined)?.min);
  return Number.isFinite(min) ? min : 0;
}

/** A copy of `query` whose weight group has `value.min = min` (other value keys kept). */
function withWeightMin<T extends TradeQueryBody>(query: T, min: number): T {
  const copy = JSON.parse(JSON.stringify(query)) as T;
  const group = weightGroup(copy);
  if (group) group.value = { ...(group.value ?? {}), min };
  return copy;
}

/** Every stat id the trade site knows, from `/data/stats`. */
function knownStatIds(stats: unknown): Set<string> {
  const ids = new Set<string>();
  const groups = (stats as { result?: unknown } | null)?.result;
  if (!Array.isArray(groups)) return ids;
  for (const group of groups) {
    const entries = (group as { entries?: unknown } | null)?.entries;
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const id = (e as { id?: unknown } | null)?.id;
      if (typeof id === 'string') ids.add(id);
    }
  }
  return ids;
}

/** A copy of `query` without the weighted and required (`and`) filters whose ids `known` lacks. */
function dropUnknownStats<T extends TradeQueryBody>(query: T, known: Set<string>): { query: T; dropped: string[] } {
  const copy = JSON.parse(JSON.stringify(query)) as T;
  const dropped: string[] = [];
  for (const group of copy.query?.stats ?? []) {
    if (!group || (group.type !== 'weight' && group.type !== 'and') || !Array.isArray(group.filters)) continue;
    group.filters = group.filters.filter((f) => {
      if (typeof f?.id === 'string' && known.has(f.id)) return true;
      if (typeof f?.id === 'string' && !dropped.includes(f.id)) dropped.push(f.id);
      return false;
    });
  }
  return { query: copy, dropped };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------------------------------
// The pipeline

export async function runUpgradeSearch(input: FindUpgradesInput, ctx: UpgradeSearchContext): Promise<UpgradeSearchResult> {
  const notes: string[] = [];
  const now = ctx.now ?? Date.now;
  const remaining = () => ctx.deadline - now();
  /** Between steps: the caller's abort stops the flow; a step never starts with < 1 s left. */
  const checkpoint = () => {
    if (ctx.signal.aborted) throw ctx.signal.reason;
    if (remaining() < MIN_STEP_MS) throw new BudgetExhausted();
  };
  const progress = async (message: string) => {
    try {
      await ctx.progress(message);
    } catch (error) {
      console.error(`[find_upgrades] progress notification failed: ${errorMessage(error)}`);
    }
  };

  /**
   * A request that takes no deadline or signal itself (the client's shared `/data/*` loads), bounded
   * here (D-22, C-14): it does not start with < 1 s left, the caller's abort ends the wait, and it gets
   * `min(15 s, remaining)`. When the time left was the shorter bound, running out is the budget's cut
   * (`BudgetExhausted`); otherwise it is the request's own timeout. An abandoned load keeps running in
   * the client (its own 15 s timeout ends it) but no longer holds up this call or the engine lock.
   */
  const bounded = async <T>(start: () => Promise<T>): Promise<T> => {
    checkpoint();
    const left = remaining();
    const clipped = left < REQUEST_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try {
      return await new Promise<T>((resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(clipped ? new BudgetExhausted() : new TradeError('timeout', 'the trade site did not answer in time; try again later')),
          Math.max(0, Math.min(REQUEST_TIMEOUT_MS, left)),
        );
        onAbort = () => reject(ctx.signal.reason);
        ctx.signal.addEventListener('abort', onAbort, { once: true });
        start().then(resolve, reject);
      });
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (onAbort) ctx.signal.removeEventListener('abort', onAbort);
    }
  };

  // 2. League, when the input or POE_LEAGUE names it.
  let league: string | null = input.league?.trim() || ctx.env.POE_LEAGUE?.trim() || null;
  /** Step 6 (D-20), bounded; a budget cut ends the call (no league means no link and no search). */
  const resolveLeague = async (): Promise<string> => {
    try {
      return await bounded(() => resolveDefaultLeague(ctx.env, ctx.trade));
    } catch (error) {
      if (ctx.signal.aborted) throw ctx.signal.reason;
      if (error instanceof BudgetExhausted) {
        throw new UpgradeSearchError(`Stopped early: ${STOP_BUDGET} before the trade league was resolved.`);
      }
      throw error;
    }
  };

  // 3–4. Options, then the query (cached per session revision, slot and canonical params).
  const params = toGenerateParams(input);
  let generated: TradeGenerateQueryResult;
  try {
    checkpoint();
  } catch (error) {
    if (error instanceof BudgetExhausted) {
      throw new UpgradeSearchError(`Stopped early: ${STOP_BUDGET} before PoB generated the trade query.`);
    }
    throw error;
  }
  const cacheKey = `${ctx.session.revision}\u0000${input.slot}\u0000${canonicalJson(params)}`;
  const cache = cacheFor(ctx.session);
  const cached = cache.get(cacheKey);
  await progress('generating query');
  if (cached) {
    generated = cached;
  } else {
    // The clipped timeout of C-14 is only a backstop: the deadline ends the step by abort a moment
    // before it, so the engine is not killed (D-75).
    const timeoutMs = Math.max(1, Math.min(GENERATE_TIMEOUT_MS, remaining()));
    const bound = deadlineBound(ctx);
    try {
      generated = await ctx.engine.client.tradeGenerateQuery(params, { timeoutMs, signal: bound.signal });
    } catch (error) {
      if (ctx.signal.aborted) throw ctx.signal.reason;
      if (bound.reached() || (error instanceof EngineTimeoutError && timeoutMs < GENERATE_TIMEOUT_MS)) {
        throw new UpgradeSearchError(`Stopped early: ${STOP_BUDGET} while PoB generated the trade query.`);
      }
      throw reportStatsError(error) ?? error;
    } finally {
      bound.done();
    }
    cache.set(cacheKey, generated);
  }
  if (typeof generated.baselineScore !== 'number' || !Number.isFinite(generated.baselineScore)) {
    throw new Error(`PoB returned no baseline score for ${input.slot}`);
  }
  const baselineScore = generated.baselineScore;
  const statWeights = generated.statWeights.map((w) => ({ stat: w.stat, label: w.label, weight: w.weight }));
  const generatedQuery = generated.query as unknown as TradeQueryBody;

  // 5. Session (D-49): decided before any request when the league is known.
  const creds = ctx.credentials();
  if (!creds.sessionId || creds.problem) {
    if (league === null) league = await resolveLeague();
    const { reason, hint } = sessionFallback(creds);
    return { kind: 'fallback', reason, hint, link: tradeQueryUrl(league, generatedQuery), notes };
  }

  // 6. League (resolve).
  if (league === null) league = await resolveLeague();
  const leagueName: string = league;

  // 7. Stale stat ids (bounded: the load takes no deadline itself).
  let stats: unknown;
  try {
    stats = await bounded(() => ctx.trade.getStats());
  } catch (error) {
    if (ctx.signal.aborted) throw ctx.signal.reason;
    if (error instanceof BudgetExhausted) {
      // Cut by the deadline before any search: the early stop, with the generated query's link.
      return {
        kind: 'searched',
        league: leagueName,
        slot: input.slot,
        query: generatedQuery,
        statWeights,
        baselineScore,
        searches: 0,
        total: 0,
        entries: [],
        dropped: { nullEntries: 0, unpriced: 0 },
        droppedStatIds: [],
        notes,
        stoppedEarly: { reason: STOP_BUDGET },
        searchUrl: tradeQueryUrl(leagueName, generatedQuery),
      };
    }
    console.error(`[find_upgrades] /data/stats failed: ${errorMessage(error)}`);
    throw new UpgradeSearchError('trade stat data unavailable', tradeQueryUrl(leagueName, generatedQuery));
  }
  const known = knownStatIds(stats);
  const { query: freshQuery, dropped: droppedStatIds } = dropUnknownStats(generatedQuery, known);
  if (droppedStatIds.length > 0) {
    notes.push(
      `Dropped ${droppedStatIds.length} stat id${droppedStatIds.length === 1 ? '' : 's'} the trade site no longer ` +
        `knows: ${droppedStatIds.join(', ')}.`,
    );
  }
  if (weightedFilterCount(freshQuery) === 0) {
    throw new UpgradeSearchError(
      `none of the weighted stats PoB generated for ${input.slot} are known to the trade site`,
      tradeQueryUrl(leagueName, generatedQuery),
    );
  }

  // 8. Prefit (D-23).
  const fit = prefitQuery(freshQuery);
  if (fit.dropped > 0) {
    notes.push(
      `Removed the ${fit.dropped} lowest-weight weighted filter${fit.dropped === 1 ? '' : 's'} to keep the query ` +
        `under the trade site's complexity limit.`,
    );
  }

  // 9. Search and fetch.
  const maxFetch = input.fetch_pages * FETCH_BLOCK;
  const tradeOpts = () => ({ auth: true, signal: ctx.signal, deadline: ctx.deadline, maxWaitMs: SEARCH_MAX_WAIT_MS });
  let query: TradeQueryBody = fit.query;
  let searches = 0;
  let retried = false;
  let lastSearch: SearchResponse | null = null;
  /** The most recent clipped search, and the ids of it already fetched. */
  let previous: { search: SearchResponse; fetchedIds: string[] } | null = null;
  /** Every id fetched so far → its raw entry (`null` when trade2 had no listing for it). */
  const fetched = new Map<string, FetchEntry | null>();
  /** The final pick, in trade order. */
  let chosen: string[] | null = null;
  /** D-461: set when the search pace refused the loop's next search (the call still fetches its pick). */
  let paceCut: SearchStop | undefined;

  const fetchBlock = async (ids: string[], queryId: string): Promise<void> => {
    checkpoint();
    const result = await ctx.trade.fetch(ids, queryId, tradeOpts());
    const byId = new Map<string, FetchEntry>();
    for (const entry of result) {
      if (entry && typeof entry === 'object' && typeof entry.id === 'string') byId.set(entry.id, entry);
    }
    ids.forEach((id, i) => {
      const positional = result[i];
      const unlabelled = positional && typeof positional === 'object' && typeof positional.id !== 'string' ? positional : null;
      fetched.set(id, byId.get(id) ?? unlabelled ?? null);
    });
  };

  /** Sanitize (D-56) the entries of `ids` that were fetched, in order. */
  const sanitize = (ids: string[]) => {
    const entries: FetchEntry[] = [];
    const dropped = { nullEntries: 0, unpriced: 0 };
    for (const id of ids) {
      if (!fetched.has(id)) continue;
      const entry = fetched.get(id);
      if (entry === null || entry === undefined || typeof entry !== 'object') dropped.nullEntries += 1;
      else if (!hasPrice(entry)) dropped.unpriced += 1;
      else entries.push(entry);
    }
    return { entries, dropped };
  };

  const searched = (ids: string[], stoppedEarly?: SearchStop): UpgradeSearchResult => {
    const { entries, dropped } = sanitize(ids);
    return {
      kind: 'searched',
      league: leagueName,
      slot: input.slot,
      query,
      statWeights,
      baselineScore,
      searches,
      total: lastSearch?.total ?? 0,
      entries,
      dropped,
      droppedStatIds,
      notes,
      ...(stoppedEarly ? { stoppedEarly } : {}),
      searchUrl: lastSearch?.id ? tradeSearchUrl(leagueName, lastSearch.id) : tradeQueryUrl(leagueName, query),
    };
  };
  const fallback = (f: { reason: string; hint: string }): UpgradeSearchResult => ({
    kind: 'fallback',
    reason: f.reason,
    hint: f.hint,
    link: tradeQueryUrl(leagueName, query),
    notes,
  });

  /**
   * The listings to fetch after search `r` (PoB's pick): its best `maxFetch`, or when it found fewer, its
   * ids then the previous clipped search's (fetched ones first).
   */
  const pickAfter = (r: SearchResponse): string[] => {
    const pick: string[] = [];
    const add = (id: string) => {
      if (pick.length < maxFetch && !pick.includes(id)) pick.push(id);
    };
    if (previous && r.total < maxFetch) {
      // Not enough in the last search: fill from the previous clipped search, fetched entries first.
      for (const id of r.result) add(id);
      for (const id of previous.fetchedIds) add(id);
      for (const id of previous.search.result) add(id);
    } else {
      for (const id of r.result.slice(0, maxFetch)) add(id);
    }
    return pick;
  };

  try {
    // The adjust loop (PoB's SearchWithQueryWeightAdjusted, ≤ 5 searches).
    for (;;) {
      checkpoint();
      await progress(`search ${searches + 1}`);
      let r: SearchResponse;
      try {
        searches += 1;
        r = await ctx.trade.search(leagueName, query, tradeOpts());
      } catch (error) {
        if (error instanceof PaceWaitError && lastSearch) {
          // D-461: the gap refused the next search, which wasn't sent. The searches that ran stand: fetch
          // the best listings of the last one, though its count called for narrowing.
          searches -= 1;
          chosen = pickAfter(lastSearch);
          paceCut = paceStop(searches, error);
          break;
        }
        if (error instanceof TradeError && error.kind === 'too_complex') {
          const count = weightedFilterCount(query);
          const drop = tooComplexDropCount(count);
          if (retried || searches >= MAX_SEARCHES || count - drop < 1) return fallback(tooComplexFallback(error));
          retried = true;
          query = dropLowestWeighted(query, drop);
          notes.push(
            `The trade site found the query too complex; retried once without the ${drop} lowest-weight weighted ` +
              `filter${drop === 1 ? '' : 's'}.`,
          );
          continue;
        }
        throw error;
      }
      lastSearch = r;
      if ((r.total > maxFetch && r.total < RESULT_CAP) || searches >= MAX_SEARCHES) {
        chosen = pickAfter(r);
        break;
      }
      if (r.total < maxFetch) {
        // Too few matches: lower the minimum weighted sum.
        query = withWeightMin(query, weightMin(query) / 2);
        continue;
      }
      // Clipped at 10000: fetch the best 10, and move the minimum halfway to the best one's sum.
      const firstIds = r.result.slice(0, FETCH_BLOCK);
      if (firstIds.length > 0) await fetchBlock(firstIds, r.id);
      previous = { search: r, fetchedIds: firstIds };
      let sum = 0;
      for (const id of firstIds) {
        const s = weightedSumOf(fetched.get(id));
        if (s !== null) {
          sum = s;
          break;
        }
      }
      query = withWeightMin(query, (sum + weightMin(query)) / 2);
    }

    // Fetch the pick, reusing entries already fetched; blocks of ≤ 10 per search id.
    const pick = chosen;
    const searchOf = new Map<string, string>();
    for (const id of pick) {
      if (searchOf.has(id)) continue;
      if (lastSearch && lastSearch.result.includes(id)) searchOf.set(id, lastSearch.id);
      else if (previous) searchOf.set(id, previous.search.id);
    }
    const blocks: Array<{ ids: string[]; queryId: string }> = [];
    const pending = new Map<string, string[]>();
    for (const id of pick) {
      if (fetched.has(id)) continue;
      const queryId = searchOf.get(id) ?? lastSearch!.id;
      if (!pending.has(queryId)) pending.set(queryId, []);
      pending.get(queryId)!.push(id);
    }
    for (const [queryId, ids] of pending) {
      for (let i = 0; i < ids.length; i += FETCH_BLOCK) blocks.push({ ids: ids.slice(i, i + FETCH_BLOCK), queryId });
    }
    for (let k = 0; k < blocks.length; k++) {
      checkpoint();
      await progress(`fetching ${k + 1}/${blocks.length}`);
      await fetchBlock(blocks[k].ids, blocks[k].queryId);
    }
    return searched(pick, paceCut);
  } catch (error) {
    if (ctx.signal.aborted) throw ctx.signal.reason ?? error;
    // What was fetched so far: the pick, else the last clipped search's first page.
    const sofar = chosen ?? previous?.fetchedIds ?? [];
    if (error instanceof BudgetExhausted) return searched(sofar, { reason: STOP_BUDGET });
    const stop = stopForError(error);
    if (stop) return searched(sofar, stop);
    if (error instanceof TradeError) {
      switch (error.kind) {
        case 'no_session':
          return fallback(sessionFallback(ctx.credentials()));
        case 'session_rejected':
          return fallback(SESSION_REJECTED);
        case 'too_complex':
          return fallback(tooComplexFallback(error));
        case 'timeout':
          // A timeout that leaves too little of the budget for another request is the deadline's cut.
          if (remaining() < REQUEST_TIMEOUT_MS) return searched(sofar, { reason: STOP_BUDGET });
          break;
        default:
          break;
      }
      if (error.kind === 'http' || error.kind === 'network' || error.kind === 'timeout') {
        // After some listings were fetched, stop early with them; before, it is a failure (D-49).
        if (sanitize(sofar).entries.length > 0) return searched(sofar, { reason: error.message });
      }
      throw new UpgradeSearchError(error.message, tradeQueryUrl(leagueName, query));
    }
    throw error;
  }
}
