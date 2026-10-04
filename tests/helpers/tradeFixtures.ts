/**
 * trade2 responses synthesized from the committed fixtures (spec 03 §6, "Synthesizing fixtures").
 *
 * Derived listings keep the fixture's structure and change only `id`, `listing.price`,
 * `pseudoMods[0].description` and, where asked, `listing.whisper`. Search responses keep the
 * `{id, complexity, result, total}` shape of `search-weighted-session`, with synthesized ids and totals.
 * The cases no fixture covers (a `null` fetch entry, a price-less listing) use the minimum the code reads.
 * Rate-limit headers are the logged-in captures' (`search-weighted-session`, `fetch-weighted-session`)
 * unless a case overrides them.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { FixtureRoute } from './fixtureFetch';

export const TRADE2_DIR = path.resolve(__dirname, '..', 'fixtures', 'trade2');

export function readTrade2<T = unknown>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(TRADE2_DIR, file), 'utf8')) as T;
}

type Headers = Record<string, string>;
const headersOf = (name: string): Headers => readTrade2<{ headers: Headers }>(`${name}.headers.json`).headers;

/** The logged-in search and fetch captures' response headers (Account + Ip rules). */
export const SEARCH_HEADERS: Headers = headersOf('search-weighted-session');
export const FETCH_HEADERS: Headers = headersOf('fetch-weighted-session');
/** The anonymous weighted-search rejection's headers (rules `Ip` only). */
export const ANONYMOUS_SEARCH_HEADERS: Headers = headersOf('search-weighted-pob-shape');
/** trade2's 400 code-2 envelope ("Query is too complex … Logging in will increase this limit."). */
export const TOO_COMPLEX_BODY = readTrade2<{ error: { code: number; message: string } }>('search-weighted-pob-shape.response.json');

/**
 * PoB's generated Body Armour query for the golden build (spike S-1), as sent in the logged-in capture:
 * 29 weighted filters, an `and` group with one required mod, a price max of 200 and a max level of 80.
 */
export const GENERATED_BODY_ARMOUR_QUERY = readTrade2<Record<string, unknown>>('search-weighted-session.request.json');

export interface FetchListing {
  id: string;
  item: Record<string, unknown> & { pseudoMods?: Array<{ description: string; domain?: string; hash?: string }> };
  listing: Record<string, unknown> & { price?: { type: string; amount: number; currency: string }; whisper?: string };
}

/** The 10 logged-in weighted fetch results (each with a `Sum: <w>` pseudo mod). */
export const FETCH_TEMPLATE: FetchListing[] = readTrade2<{ result: FetchListing[] }>('fetch-weighted-session.response.json').result;

/** A 64-hex id in the fixtures' format (`sha256(...)`). */
export function syntheticId(seed: string): string {
  return crypto.createHash('sha256').update(`pob2-mcp-synthetic:${seed}`).digest('hex');
}

/** `n` synthetic ids for one search. */
export function syntheticIds(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => syntheticId(`${prefix}:${i}`));
}

export interface DeriveOptions {
  /** `null` drops the price (a price-less listing); omitted keeps the template's. */
  price?: { amount: number; currency: string; type?: string } | null;
  /** The weighted sum; omitted keeps the template's. */
  sum?: number;
  whisper?: string;
}

/** A listing derived from `FETCH_TEMPLATE[templateIndex % 10]` with a new id. */
export function deriveListing(id: string, templateIndex: number, opts: DeriveOptions = {}): FetchListing {
  const entry = JSON.parse(JSON.stringify(FETCH_TEMPLATE[templateIndex % FETCH_TEMPLATE.length])) as FetchListing;
  entry.id = id;
  if (opts.price === null) delete entry.listing.price;
  else if (opts.price) entry.listing.price = { type: opts.price.type ?? '~b/o', amount: opts.price.amount, currency: opts.price.currency };
  if (opts.sum !== undefined && Array.isArray(entry.item.pseudoMods) && entry.item.pseudoMods[0]) {
    entry.item.pseudoMods[0].description = `Sum: ${opts.sum}`;
  }
  if (opts.whisper !== undefined) entry.listing.whisper = opts.whisper;
  return entry;
}

/** A synthesized search response body: `total` matches, the first `min(total, 100)` ids. */
export function searchBody(searchId: string, total: number, ids?: string[]): { id: string; complexity: number; result: string[]; total: number } {
  return { id: searchId, complexity: 180, result: ids ?? syntheticIds(searchId, Math.min(total, 100)), total };
}

export type SyntheticResponse = { status: number; headers?: Headers; body?: unknown };

/** A search response with `total` matches, under search id `searchId`. */
export function searchResponse(searchId: string, total: number, headers: Headers = SEARCH_HEADERS): SyntheticResponse {
  return { status: 200, headers, body: searchBody(searchId, total) };
}

/** A 400 code-2 search rejection with the given `X-Rate-Limit-Rules`. */
export function codeTwoRejection(rules: 'Account,Ip' | 'Ip'): SyntheticResponse {
  const headers = { ...(rules === 'Ip' ? ANONYMOUS_SEARCH_HEADERS : SEARCH_HEADERS), 'x-rate-limit-rules': rules };
  return { status: 400, headers, body: TOO_COMPLEX_BODY };
}

function toResponse(r: SyntheticResponse): Response {
  const body = r.body === undefined ? null : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
  return new Response(body, { status: r.status, headers: { 'content-type': 'application/json', ...(r.headers ?? {}) } });
}

export const SEARCH_URL = /\/api\/trade2\/search\//;
export const FETCH_URL = /\/api\/trade2\/fetch\//;

/**
 * A search route answering the n-th search with `responses[n]` (the last one repeats). A response may be
 * a function of the request body (parsed JSON), or `'hang'` to never answer (until aborted).
 */
export function searchSequence(
  responses: Array<SyntheticResponse | ((body: unknown) => SyntheticResponse) | 'hang'>,
): FixtureRoute & { count(): number } {
  let n = 0;
  const route: FixtureRoute & { count(): number } = {
    match: (url, init) => SEARCH_URL.test(url) && (init?.method ?? 'GET').toUpperCase() === 'POST',
    respond: (_url, init) => {
      const r = responses[Math.min(n, responses.length - 1)];
      n += 1;
      if (r === 'hang') return new Promise<Response>(() => undefined);
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      return toResponse(typeof r === 'function' ? r(body) : r);
    },
    count: () => n,
  };
  return route;
}

/** The ids and `query` parameter of a recorded fetch URL. */
export function parseFetchUrl(url: string): { ids: string[]; queryId: string } {
  const u = new URL(url);
  const ids = decodeURIComponent(u.pathname.split('/fetch/')[1] ?? '').split(',').filter((s) => s !== '');
  return { ids, queryId: u.searchParams.get('query') ?? '' };
}

export interface FetchRouteOptions {
  /** Per id: `null` = trade2 has no listing (a `null` entry); a function result overrides the derivation. */
  entryFor?: (id: string, indexInBlock: number) => FetchListing | null | undefined;
  headers?: Headers;
  /** `'hang'` makes the n-th fetch (0-based) never answer until aborted. */
  behaviour?: (n: number) => 'hang' | SyntheticResponse | undefined;
}

/**
 * A fetch route answering with listings derived from `FETCH_TEMPLATE`: the k-th requested id of a
 * block gets template entry k (so the first fetched entry's `Sum` is the template's first, 142.2).
 */
export function fetchRoute(opts: FetchRouteOptions = {}): FixtureRoute & { count(): number } {
  let n = 0;
  return {
    match: FETCH_URL,
    respond: (url) => {
      const k = n;
      n += 1;
      const special = opts.behaviour?.(k);
      if (special === 'hang') return new Promise<Response>(() => undefined);
      if (special) return toResponse(special);
      const { ids } = parseFetchUrl(url);
      const result = ids.map((id, i) => {
        const custom = opts.entryFor?.(id, i);
        return custom === undefined ? deriveListing(id, i) : custom;
      });
      return toResponse({ status: 200, headers: opts.headers ?? FETCH_HEADERS, body: { result } });
    },
    count: () => n,
  };
}

/** `/data/stats` and `/data/leagues` from the fixtures. */
export const DATA_ROUTES: FixtureRoute[] = [
  { match: /\/api\/trade2\/data\/stats/, respond: { fixture: 'trade2/data-stats' } },
  { match: /\/api\/trade2\/data\/leagues/, respond: { fixture: 'trade2/data-leagues' } },
];

/** Every stat id in the `/data/stats` fixture. */
export function fixtureStatIds(): Set<string> {
  const data = readTrade2<{ result: Array<{ entries: Array<{ id: string }> }> }>('data-stats.response.json');
  return new Set(data.result.flatMap((g) => g.entries.map((e) => e.id)));
}
