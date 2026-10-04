# Slice 03: Trade (credentials, client, limiter, currency, Lua trade actions, `find_upgrades`)

Part of the [spec spine](README.md). It covers work units WU-14…WU-17 and WU-23, and acceptance
criteria AC-T1…AC-T45.

This slice delivers the alpha's user value (G-4): **"find upgrades for slot X under budget Y, with
optional required mods Z, ranked by weighted stats S"**. PoB2 runs it headless with its own query
generator and evaluator. trade2 is queried under a strict rate limiter, using the user's session for
weighted search, and a trade-site link is the fallback. Results come back actionable from chat, within
a fixed time and size budget.

## 1. Existing system context (this slice)

Detail and citations are in [grounding/ctx-ts.md](../grounding/ctx-ts.md) §8,
[grounding/ctx-external.md](../grounding/ctx-external.md) and [grounding/ctx-lua.md](../grounding/ctx-lua.md) §5.
The spikes ([S-1](../spikes/S-1-headless-trade-generator.md), [S-3](../spikes/S-3-trade2-fixtures.md),
[S-4](../spikes/S-4-session-weighted-search.md)) are the evidence.

- **`TradeApiClient` (`src/services/tradeClient.ts`, 297 lines).**
  - **Endpoints:** `search` POSTs `/api/trade2/search/poe2/<league>`; `fetch` GETs
    `/fetch/<ids>?query=&realm=`, with a guard of ≤ 10 ids; `/data/stats` and `/data/leagues` are GETs.
  - **Rate limiting:** a Bottleneck limiter allows 4 requests/s in bursts of 8. Its header parsing reads
    a window length as the limit (`:255-272`).
  - **Credentials and identity:** the cookie (`POE_SESSION_ID`) goes on **every** request, including
    `/data/*` (`:222`). The User-Agent misattributes the PoB org (`:218`).
  - **Errors and caching:** no fetch timeout; errors dump the raw body; the cache ignores TTL and
    collides on keys.
  - **Callers:** after WU-04 the only remaining one is `src/handlers/tradeHandlers.ts`.
- **Other trade code.**
  - `statMapper.ts` has a 51-entry static PoE1 fallback (37 entries are absent on trade2).
    `search_stats` fuzzy-searches it without awaiting `/data/stats` (`tradeHandlers.ts:470-496`).
  - `tradeQueryBuilder.ts` maps free-text `item_type` through `categoryMap` (`:41-67`). The map lacks
    crossbow, spear, flail, focus, buckler, talisman and charm, and the builder writes a nonexistent
    `socket_filters` group.
  - **`search_trade_items` schema and handler disagree** (`toolSchemas.ts:1435-1500` vs
    `tradeHandlers.ts:33-48`):

    | | Fields |
    |---|---|
    | Schema | `league, item_name, item_type, min_price, max_price, price_currency, item_rarity, min_links, corrupted, identified, mods:[{stat_id,min,max}], limit` |
    | Handler reads | `rarity` and `stats:[{id}]` instead of `item_rarity` and `mods` |

    The handler also builds PoE1 URLs (`/trade/search/`) and does no price normalization.
  - `tradeTypes.ts` types mod lines as `string[]`, but they are objects (S-3 §1).
- **`PoeNinjaClient` (`src/services/poeNinjaClient.ts`).** It assumes Exalted = 1 (`:102-104,177-186`),
  while the feed is Divine-primary (`core.primary`). It caches for 5 min without an ETag.
- **trade2 facts** (fixtures in `tests/fixtures/trade2/`: 36 files; 4 fetch fixtures, 40 items):
  - **Search:** returns ≤ 100 ids, with `total` capped at 10000.
  - **Anonymous weighted search:** 400 `{error:{code:2, message:"Query is too complex…Logging in will
    increase this limit."}}`.
  - **Logged-in weighted search:** 200, complexity 180, with rules `Account,Ip`; Account search
    `3:5:60`, fetch `6:4:10`.
  - **Complexity data points** (A-3): belt 9, ring 9, body-armour 11, and-3 12, weighted-session 180.
  - **Weighted fetch:** results carry `pseudoMods[0] = {description:"Sum: <w>", domain:"pseudo",
    hash:"statgroup.0"}`.
  - **Mod lines** are objects `{description, flags?, domain, hash, mods?}` with `[Tag|Text]` markup.
    Fractured, desecrated and crafted lines sit inside `explicitMods`. Inside `socketedItems`, lines can
    be strings.
  - **Listing shapes:** an instant-buyout (`securable`/`available`) listing has `fee` and
    `hideout_token` and no `whisper`. An in-person listing has `whisper`.
  - **Prices:** `{type, amount, currency}`, with mixed currencies in one result set.
  - **Not covered:** no fixture has a `null` entry or a price-less listing.
  - **Request URLs:** they encode a space in the league as `%20`.
  - **`/data/*`** responses carry no rate-limit headers.
- **GGG docs** (ctx-external §1).
  - **Headers:** `X-Rate-Limit-Policy`/`-Rules`/`-<rule>`/`-<rule>-State` and `Retry-After` (seconds).
    Rule names are case-insensitive.
  - **Penalties:** every 4xx counts toward an "Invalid Requests Threshold". "Exceeding these limits
    frequently will result in your application access being revoked."
  - **Errors:** code 2 means "Invalid query", and clients should "use the code rather than the message".
  - **Policy:** trade2 isn't officially documented, so R-1 applies.
- **poe.ninja docs:** <https://poe.ninja/docs/api>. They document `core.primary`, `core.rates` ("rate
  against the primary"), `lines[].primaryValue`, and "ETag-based. Use conditional requests". They ask
  for a UA with a contact (D-25 deviation).
- **PoB2's trade classes on the tag** (ctx-lua §5).
  - **Generation:** `TradeQueryGenerator` (`StartQuery`/coroutine/`FinishQuery`). `FinishQuery`
    applies `MAX_FILTERS=35`, always emits the `and` group, and sorts `modWeights` by
    (`meanStatDiff`, `|weight|`) with an unstable sort.
  - **Evaluation:** `TradeQuery` (`FilterToSafeItems`, `ReduceOutput`, `GetResultEvaluation`) and
    `WeightedRatioOutputs`. That function reads outputs with `skipTransform`, so on the item path
    `ReduceOutput` has already transformed the values, which double-applies the `*TakenHit` transforms.
  - **Fetch handling:** `TradeQueryRequests` (`SearchWithQueryWeightAdjusted` with `maxRecursion = 5`;
    the fetch-JSON → item-text parser, which reads `listing.price.amount` unguarded at `:437`;
    `buildUrl`).
  - **Hazards:** `options.account` crashes the generator; `PullPoENinjaCurrencyConversion` writes a file.
  - **S-1's headless shim** (`docs/stabilization/spikes/S-1-prototype/TradeShim.lua`) drove both
    generation and evaluation.
- **Share sites.** `buildCode.ts:58-63` sends `Mozilla/5.0 (compatible; pob2-mcp-server)` to pobb.in and
  pastebin, with the comment "bot filters block plain UAs".

## 2. Functional requirements

- **FR-T1.** The user's session is taken from the environment or `.env` on every request. A refreshed
  cookie works without a restart. The cookie only ever goes to trade2 search and fetch, and never appears
  in output, errors or logs.
- **FR-T2.** All trade traffic goes through one limiter that obeys every rule the server sends, with a
  safety margin. It never sends a request that would break a window, and it refuses rather than sleeps
  through a lockout or a long wait.
- **FR-T3.** Trade failures come back as actionable messages, classified by status, error code, the
  request's own body and rate-limit headers, never by message text.
- **FR-T4.** Prices are normalized with poe.ninja's per-response primary currency. Without rates the
  tools degrade gracefully and say so.
- **FR-T5.** The kept trade tools (`search_trade_items`, `get_item_price`, `search_stats`, `get_leagues`,
  `get_currency_rates`) are PoE2-correct.
- **FR-T6.** `find_upgrades` mirrors PoB2's trade dialog for one slot:
  - it generates PoB's weighted query against the loaded build;
  - searches and fetches within the bounds of D-22;
  - evaluates every candidate in the engine;
  - post-filters on the normalized budget;
  - ranks by `rank_by`.

  It returns per listing: score vs baseline, `is_upgrade`, per-stat deltas, price native and
  normalized, a whisper or an exact-item link, and PoB item text, all within an output budget. It says
  explicitly when nothing in budget is an upgrade.
- **FR-T7.** Without a usable session, `find_upgrades` returns the trade-site link for the generated
  query, with the reason and the fix, without contacting the trade site when the league is known. This
  is a result, not a failure (D-49).
- **FR-T8.** `trade_query_options` tells the caller what PoB offers for a slot: sort stats, saved
  weights, required-mod choices, currencies, statuses, and which options apply.

## 3. Interface contracts defined in this slice

### C-9: Credentials (new)

```ts
// src/trade/credentials.ts
export interface Credentials { sessionId: string | null; source: 'process-env' | 'dotenv' | null; problem?: 'op-reference' | 'malformed' }
export function createCredentialGetter(opts: { env: Readonly<Record<string, string | undefined>>; dotenvPath: string;
                                               readFile?: (p: string) => string }): () => Credentials;
```

- **Re-read on every call.** Nothing is cached.
- **Precedence:**
  1. `env.POESESSID` (trimmed, non-empty);
  2. `env.POE_SESSION_ID`;
  3. the dotenv file's `POESESSID`;
  4. the dotenv file's `POE_SESSION_ID`.

  Whitespace-only values count as absent.
- **Dotenv file.** `dotenvPath` = `<packageRoot>/.env`. It is read with `readFileSync(path, 'utf8')`.
  - `ENOENT` means `{sessionId: null, source: null}`.
  - A leading U+FEFF is stripped, then the content is parsed with `util.parseEnv`.
  - `parseEnv` handles CRLF, the `export ` prefix and quotes, and an unquoted `#` truncates the value
    (ctx-tooling §1a).
- **Invalid values.**
  - A value starting with `op://` returns `{sessionId: null, source, problem: 'op-reference'}`.
  - A value with any character outside the RFC 6265 cookie-octet set (e.g. whitespace inside, a quote, a
    semicolon, a backslash, a control character) returns `{sessionId: null, source, problem:
    'malformed'}`.
- **No side effects.** It never mutates `process.env`, never logs the value, and never includes it in an
  error.

### C-10: Trade HTTP client (modified)

```ts
// src/trade/tradeClient.ts (replaces src/services/tradeClient.ts)
export class TradeApiClient {
  constructor(deps: { fetch: typeof fetch; credentials: () => Credentials; limiter: RateLimiter; userAgent: string;
                      baseUrl?: string /* env POE_TRADE_BASE */; realm?: string /* env POE_TRADE_REALM, 'poe2' */; now?: () => number });
  search(league: string, query: object, opts: { auth: boolean; signal?: AbortSignal; deadline?: number; maxWaitMs?: number }):
    Promise<{ id: string; total: number; complexity?: number; result: string[]; inexact?: boolean }>;
  fetch(ids: string[] /* 1..10 */, queryId: string, opts: { auth: boolean; signal?: AbortSignal; deadline?: number; maxWaitMs?: number }):
    Promise<Array<FetchEntry | null>>;              // raw `result` entries, untouched (may contain null)
  getStats(): Promise<StatsData>;                  // lazy; cached for the process; 15 s timeout
  getLeagues(): Promise<Array<{ id: string; realm: string; text: string }>>;  // cached 4 h
}
export class TradeError extends Error { kind: TradeErrorKind; status?: number; code?: number; retryAfterS?: number; waitS?: number; serverMessage?: string }
export type TradeErrorKind = 'no_session' | 'session_rejected' | 'too_complex' | 'invalid_query' | 'rate_limited' | 'locked_out'
  | 'would_wait' | 'auth' | 'http' | 'network' | 'timeout' | 'disabled';
```

**Requests.**

| Rule | Value |
|---|---|
| Search | `POST {base}/search/{realm}/{encodeURIComponent(league)}`, JSON body |
| Fetch | `GET {base}/fetch/{ids.join(',')}?query={queryId}&realm={realm}` |
| Headers | `User-Agent: <D-25 constant>`, `Accept: application/json`; `Content-Type: application/json` on POST only |
| Cookie | `Cookie: POESESSID=<sessionId>` **only** on search and fetch, **only** when `auth:true` |
| `auth:true` with no session | throws `TradeError('no_session')` without sending |
| `Set-Cookie` | ignored |
| Limiter | every search and fetch passes through C-11 with `deadline` and `maxWaitMs` |

**Timeout.** It isn't `AbortSignal.timeout`, because Jest fake timers don't fire that. Instead:
- `t = new AbortController()`;
- `setTimeout(() => t.abort(new DOMException('timeout', 'TimeoutError')), min(15000, deadline − now))`,
  cleared in `finally`;
- `signal = opts.signal ? AbortSignal.any([t.signal, opts.signal]) : t.signal`. Never pass `undefined`
  to `AbortSignal.any`.

**Classification** (D-24), checked in this order. When the server's body has the error envelope, the
message is kept as `serverMessage` (truncated to 300 characters) for display, never parsed.
1. `opts.signal?.aborted` → rethrow the caller's reason (cancellation, D-22).
2. `t.signal.aborted` → `timeout`.
3. A fetch `TypeError` → `network`, with the message "network error contacting the trade site". **The
   `TypeError` message is never shown**, because it can echo header values.
4. Responses:

   | Response | Kind |
   |---|---|
   | 2xx | success; limiter state updated from headers |
   | 400 `error.code == 2`, the body has a `type:"weight"` stat group, and the cookie was sent | `too_complex` if `X-Rate-Limit-Rules` contains `account` (case-insensitive), else `session_rejected` (A-13) |
   | any other 400 `error.code == 2` | `invalid_query`, with `serverMessage` |
   | 401 / 403 | `auth` |
   | 429 | `rate_limited` with `retryAfterS` from `Retry-After` (integer seconds, default 60). The limiter enters a penalty for that policy |
   | other 4xx / 5xx | `http` with `status`, `code` and `serverMessage` |

**Caching** (D-46). Only `getStats` (process lifetime) and `getLeagues` (4 h) are cached. Search and
fetch are never cached. The client is constructed with no I/O.

### C-11: Rate limiter (new)

```ts
// src/trade/rateLimiter.ts
export class RateLimiter {
  constructor(opts: { now?: () => number; sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; margin?: number /* 1 */ });
  // Wraps one HTTP exchange for an endpoint class; returns the Response after recording its headers.
  run(endpoint: 'search' | 'fetch', send: () => Promise<Response>, opts?: { deadline?: number; signal?: AbortSignal; maxWaitMs?: number /* default 30000 */ }): Promise<Response>;
}
```

**Policies.** State is kept per **server policy**.
- Before the first response, an endpoint class has no policy yet. Its first request is sent alone, and
  further requests for that class wait until it **settles**. A response with headers, one without, and
  an error all count as settling (PoB, `TradeQueryRateLimiter.lua:152-164`, without PoB's "never
  settles" flaw).
- A response carrying `X-Rate-Limit-Policy` maps the class to that policy.
- A response without a policy name applies to the class's last known policy, else to the synthetic
  policy `class:<endpoint>`. That includes a 429.

**Rules** come from `X-Rate-Limit-Rules` (comma-separated, lower-cased). For each rule:
- `X-Rate-Limit-<rule>` gives windows `max:period:penalty`;
- `X-Rate-Limit-<rule>-State` gives `hits:period:active`.

Headers are split on `/,\s*/`.

**State per policy:**
- the timestamps of requests sent;
- a `lockedUntil` time.

When a response's state reports `hits` greater than the local count for that window, synthetic
timestamps at `now` are added until the local count equals `hits` (D-35). When a state's `active` is
greater than 0, or a 429 arrives, `lockedUntil = now + max(active, Retry-After) s`.

**Admission.** Before sending:
1. If `now < lockedUntil`, throw `TradeError('locked_out', {waitS})`.
2. Otherwise compute `wait` = the smallest delay after which, **for every window**, the count of
   timestamps in the trailing `period` plus 1 is ≤ `max − margin`. When `max − margin < 1`, use `max`.
3. If `now + wait > deadline`, or `wait > maxWaitMs`, throw `TradeError('would_wait', {waitS})` without
   sleeping. The default `maxWaitMs` of 30 000 applies to every trade tool.
4. Otherwise sleep `wait` (abortable), record a timestamp, and send.

### C-12: Currency service (modified)

```ts
// src/trade/currency.ts (replaces the conversion logic of src/services/poeNinjaClient.ts; the client keeps the HTTP)
export interface Rates { league: string; primary: string; fetchedAt: number;
                         valueInPrimary(currencyId: string): number | null }
export function convert(amount: number, from: string, to: string, rates: Rates): number | null;
export class CurrencyService { constructor(deps: { fetch; userAgent; env; now? }); getRates(league: string): Promise<Rates | null> }
```

- **Source.** `GET https://poe.ninja/poe2/api/economy/exchange/current/overview?league=<league>&type=Currency`
  with the D-25 User-Agent (A-7: `league` is the trade league name).
- **Parsing.** `primary = core.primary`, read **every response** (D-33). `valueInPrimary(c)` is:
  - 1 when `c == primary`;
  - `1 / core.rates[c]` when `c` is in `core.rates` (A-14: units of `c` per 1 primary);
  - `lines[c].primaryValue` when a line has `id == c`;
  - `null` otherwise.
- **Conversion.** `convert(a, f, t, rates) = a × valueInPrimary(f) / valueInPrimary(t)`, or `null` if
  either value is null.
- **Caching.** Per league for 60 min. Refreshes send `If-None-Match` with the stored ETag (poe.ninja:
  "ETag-based. Use conditional requests"); a 304 renews `fetchedAt`.
- **Failure.** A network error or non-2xx returns `null` (the caller degrades, D-11), and the error is
  logged to stderr. `POE_NINJA_DISABLED=true` means `getRates` always returns `null`.

### C-13: Lua trade actions (new; `pob-api/API/Trade.lua`)

- **Registration.** One line in `Handlers.lua`, before its `return`:
  `for name, fn in pairs(require('API.Trade').handlers) do handlers[name] = fn end`.
- **Replies** contain only numbers, strings, booleans and tables of them (C-2 `ENCODE` never fires).
- **No I/O.** No files are written, and `PullPoENinjaCurrencyConversion`, `PriceItem`, `PullLeagueList`
  and `FetchLeagues` are never called.
- **Popups.** After each action `#main.popups` is unchanged.
- **Caching.** Generator and `TradeQuery` instances are cached and **re-bound when `build.itemsTab`
  changes** (tabs are recreated on each load).
- **`statWeights` everywhere excludes the five `*TakenHit` stats** (D-57). If they're passed, the action
  fails with "stat <x> is not supported for upgrade search".

**`trade_generate_query`.** Params:

| Param | Type | Default |
|---|---|---|
| `slot` | string | required |
| `statWeights` | `[{stat, weight}]` | build's saved `<TradeSearchWeights>` (minus `*TakenHit`), else FullDPS 1.0 + TotalEHP 0.5 (D-37) |
| `requiredMods` | `[{tradeId, min}]`, ≤ 3 | none |
| `maxPrice` | number | none |
| `currency` | string \| null | null = Exalted Orb Equivalent |
| `maxLevel` | integer | none |
| `sockets` | integer | none |
| `includeCorrupted` | boolean | true unless the slot's current item is corrupted |
| `includeMirrored` | boolean | true |
| `runeBehaviour` | `"copy"\|"keep"\|"remove"` | `"copy"` |
| `jewelType` | `"Base"\|"Radius"` | required for jewel slots |
| `status` | `"securable"\|"available"\|"onlineleague"\|"online"\|"any"` | `"securable"` |

Behaviour:
- `calcsTab:BuildOutput()` runs first.
- It drives PoB as S-1 did: clear the sticky `last*` fields; `StartQuery`; resume the coroutine directly
  until it is dead.
- **Then sort `gen.modWeights` by (`meanStatDiff` desc, `|weight|` desc, `tradeId` asc)** (D-55),
  copy it as `rankedWeights`, and call `FinishQuery`.
- It never sets `options.account`.

Result:
```
{ query: <PoB's query table as FinishQuery built it, incl. sort and the always-present 'and' group>,
  rankedWeights: [{tradeId, weight, meanStatDiff}],   -- full list before PoB's 35-filter cap, in D-55 order
  minWeight: number, itemCategory: string,
  statWeights: [{stat, label, weight}],               -- effective weights
  baselineScore: number,                              -- WeightedRatioOutputs(base, ReduceOutput(base), statWeights) (D-57)
  meta: {calcCount: integer, ms: number} }
```

Failures (`FAILED`):
- `slot <X> is not supported for weighted trade search; supported: <list>`, for Charm, Arm and Leg slots
  and weapon jewel sockets (D-38);
- `jewel_type is required for jewel slots`;
- `PoB found no mods to search for in <slot>`.

**`trade_evaluate_items`.** Params: `{slot, items: [<sanitized /fetch result entries>], statWeights,
reportStats?: [stat], runeBehaviour?, anointBehaviour?: "copy"|"keep"|"remove"}`.

Behaviour, per PoB, **for each item inside its own `pcall`:**
1. Parse the entry with PoB's own fetch parser (`FetchResultBlock` callback, as S-1 did).
2. `FilterToSafeItems`.
3. Rune and anoint handling (`CopyAnointsAndAugments`, rune strip, anoint clear), then `BuildRaw()`.
4. `calcFunc({repSlotName, repItem})`, then `ReduceOutput` and `WeightedRatioOutputs`, giving the same
   numbers as `GetResultEvaluation`.

A failed item goes to `rejected` with its reason. Items are iterated by index, so a gap never stops the
loop.

Result:
```
{ baselineScore: number,     -- as in trade_generate_query (D-57)
  rejected: [{id, reason}],
  items: [{ id, score: number,
            stats: { <stat>: {base: number, new: number, delta: number, pct: number|null} },  -- sort stats ∪ reportStats
            itemText: string }] }   -- the evaluated item's PoB text (after rune/anoint handling)
```

**`trade_query_options`.** Params: `{slot}`. Result:
```
{ slot, supported: boolean, reason?: string, itemCategory?: string,
  sortStats: [{stat, label}],                  -- powerStatList entries selectable for items, minus the five *TakenHit
  defaultWeights: [{stat, weight}], savedWeights: [{stat, weight}] | null,
  requiredModChoices: [{tradeId, text, kind: "explicit"|"implicit"|"corrupted"}],   -- sorted by tradeId
  currencies: [{id: string|null, label}],      -- PoB's 11 entries; null = Exalted Orb Equivalent
  statuses: [{id, label}],                     -- 5 entries
  shows: {sockets: boolean, runeBehaviour: boolean, anointBehaviour: boolean, jewelType: boolean} }
```

### C-21: Upgrade-search pipeline (new; internal seam between WU-17 and WU-23)

```ts
// src/trade/findUpgrades.ts (WU-17)
export type UpgradeSearchResult =
  | { kind: 'fallback'; reason: string; hint: string; link: string; notes: string[] }
  | { kind: 'searched'; league: string; slot: string; query: object; statWeights: Array<{stat: string; label: string; weight: number}>;
      baselineScore: number; searches: number; total: number;
      entries: FetchEntry[];                          // sanitized (D-56), in trade order, ≤ fetch_pages × 10
      dropped: { nullEntries: number; unpriced: number };
      droppedStatIds: string[]; notes: string[];
      stoppedEarly?: { reason: string; waitS?: number };
      searchUrl: string };                            // https://www.pathofexile.com/trade2/search/poe2/<league>/<last search id>
export function runUpgradeSearch(input: FindUpgradesInput, ctx: {
  engine: EngineCallContext; trade: TradeApiClient; credentials: () => Credentials; env: Env;
  signal: AbortSignal; deadline: number; progress: (message: string) => Promise<void> }): Promise<UpgradeSearchResult>;
```

It covers C-14 flow steps 1–9, and the results that end the call before evaluation: a fallback, or a
search stopped early. WU-23 then evaluates, prices, ranks and renders, inside the same `session.run`.

### C-14: `find_upgrades` tool (new)

**Input.** It is declared as a JSON-Schema literal in `toolSchemas.ts` and validated at runtime by a zod
schema in the handler. A test converts the zod schema with `zod-to-json-schema` and asserts that the two
agree on property names, types, enums, ranges and `required`.

| Field | Type | Default |
|---|---|---|
| `slot` | string | **required**; a PoB slot name (D-38) |
| `sort_stats` | `[{stat: string, weight: number 0.01–1}]`, 1–10 items, no `*TakenHit` | D-37 |
| `required_mods` | `[{trade_id: string, min: number}]`, ≤ 3 | none |
| `max_price` | number > 0 | none (no budget) |
| `currency` | `"exalted_equivalent"\|"exalted"\|"chaos"\|"divine"\|"aug"\|"transmute"\|"regal"\|"vaal"\|"annul"\|"alch"\|"mirror"` | `"exalted_equivalent"` |
| `max_level` | integer 1–100 | none |
| `min_empty_rune_sockets` | integer 1–6 | none |
| `weight_corrupted_mods` | boolean | D-37 |
| `include_mirrored` | boolean | `true` |
| `rune_behaviour`, `anoint_behaviour` | `"copy"\|"keep"\|"remove"` | `"copy"` |
| `jewel_type` | `"base"\|"radius"` (mapped to PoB's `"Base"`/`"Radius"`) | required for jewel slots |
| `status` | `"securable"\|"available"\|"onlineleague"\|"online"\|"any"` | `"securable"` |
| `league` | string | D-20 |
| `fetch_pages` | integer 1–10 | 2 |
| `rank_by` | `"stat_value"\|"stat_value_per_price"\|"price"\|"trade_weight"` | `"stat_value"` |
| `report_stats` | `[string]`, ≤ 10 | none |
| `limit` | integer 1–20 | 10 |
| `include_non_upgrades` | boolean | `false` |

**Engine kind** `read` (C-8). The **whole call** runs inside one `session.run`, holding the engine lock
through the HTTP phase (D-8a).

**The deadline** is `call.arrivedAt + 90 s` (D-22), set by the router and passed into `session.run`, so
it also bounds the lock wait. Every HTTP request's timeout is `min(15 s, remaining)`. Every engine
request's `timeoutMs` is `min(its default, remaining)`. No step starts with < 1 s remaining. Between steps
the flow checks the caller's `signal`; an abort stops it, and the lock is released.

**Flow.** Steps 1–9 are WU-17 (C-21), steps 10–13 are WU-23.

1. **Input.** Validate. Invalid input → `isError` naming the field (D-27).
2. **League (known?).** Use the `league` input, else `POE_LEAGUE`. If neither is set, the league is
   resolved at step 6.
3. **Options.** Map the inputs to C-13 params: `"exalted_equivalent"` → `null`; `jewel_type`
   `base`/`radius` → `Base`/`Radius`.
4. **Query.** Look up the **query cache**: an LRU of 32 keyed by `(session.revision, slot, canonical
   JSON of the C-13 params)`. On a miss, call `trade_generate_query`.
5. **Session (D-49).** `credentials()`. A `null` session, or `problem` set, returns the **fallback**:
   - the reason is "no POESESSID set", "POESESSID holds an unresolved 1Password reference" or
     "POESESSID is malformed";
   - the hint says where to set it;
   - the link is built from the generated query, using the step-2 league, else the step-6 league.

   **When the league is known, no request of any kind has been sent so far.**
6. **League (resolve).** If unknown: the first `getLeagues()` entry that is not `Standard`/`Hardcore` and
   doesn't start with `HC ` (D-20). If no such entry exists → `isError` "no current league; set
   POE_LEAGUE".
7. **Stale stat ids.** Drop weighted and required stat ids absent from `getStats()`, and note them.
   `getStats` failure → `isError` "trade stat data unavailable".
8. **Prefit (D-23).**
   - `estimate = 54 + 4 + 4 + 4·(and + not + weighted filters) + 3·[mirrored:false] + 3·[price] +
     3·[max level] + 3·[sockets] + 2·(extra query keys)`.
   - Remove the lowest-weight weighted filters until `200 − estimate ≥ 4`.
9. **Search (≤ 5 searches, PoB's `SearchWithQueryWeightAdjusted`).** Let `maxFetch = fetch_pages × 10`
   and `min` = the weight group's `value.min`. For `n` = 1…5:
   1. `r = search(auth:true)`, with `maxWaitMs: 30000` and the deadline.
   2. If `(r.total > maxFetch and r.total < 10000)` or `n == 5`, stop searching:
      - if a previous clipped search exists and `r.total < maxFetch`, take `r.result`, then the previous
        search's already-fetched entries, then its unfetched ids, up to `maxFetch`;
      - otherwise take `r.result[0:maxFetch]`.
   3. Else if `r.total < maxFetch`, set `min = min / 2`.
   4. Else (clipped at 10000), fetch `r.result[0:10]` and remember those entries and `r`. Set
      `min = (Sum + min) / 2`, where Sum is the first fetched entry with a parseable `Sum:`, else 0.

   Then fetch the chosen ids in blocks of ≤ 10 (`auth:true`), reusing entries already fetched.
   **Sanitize (D-56):** drop `null` entries and entries without `listing.price`, and count both.
10. **Evaluate.** `trade_evaluate_items` over the sanitized entries, one action call per 10.
11. **Prices (C-12).** `rates = getRates(league)`. Each listing's normalized price is converted into the
    **display currency**: the requested `currency`, with `exalted` for `exalted_equivalent`.
    - When `max_price` is set, drop listings whose normalized price exceeds it (D-11), and count them.
    - **Partial conversion (D-54):** if any remaining listing can't be converted, it is flagged "price
      not converted", is never counted over budget, and the price modes fall back.
    - **No rates:** skip the post-filter, show native prices, and add the note "Currency rates
      unavailable: showing native prices; the budget was enforced by the trade site only."
12. **Rank.**

    | `rank_by` | Order |
    |---|---|
    | `stat_value` | score, descending |
    | `stat_value_per_price` | `score − 0.1 × log10(convert(price → divine))`, descending (PoB `TradeQuery.lua:960-963`) |
    | `price` | normalized price, ascending |
    | `trade_weight` | the order trade2 returned (needs no rates) |

    - **The price modes** (`price`, `stat_value_per_price`) fall back to `stat_value`, with a note,
      when rates are unavailable or the conversion is partial.
    - Ties break by listing id.
    - `is_upgrade` = `round(score, 4) > round(baselineScore, 4)`.
13. **Select and render.** By default only `is_upgrade` listings, up to `limit`. With
    `include_non_upgrades`, the top `limit` regardless, with non-upgrades flagged. Render per the output
    format, under the D-53 budget.

**Stopping early (D-22, D-49).** The flow stops and returns what was evaluated so far, plus a note and
the link, on any of these:
- `would_wait`, `locked_out` or `rate_limited`:
  `Stopped early: the trade site's rate limit requires waiting <n> s.`;
- a step cut by the deadline: `Stopped early: the 90 s budget ran out.`;
- `EngineBusyError` from the lock wait: `Stopped early: the engine was busy.`;
- `http`, `network` or `timeout` **after ≥ 1 listing was evaluated**:
  `Stopped early: <message>.`

**Classified errors:**

| Error | What happens |
|---|---|
| `session_rejected` | the fallback, with the "refresh POESESSID" hint |
| `too_complex` | drop the lowest-weight 25 % of the weighted filters (at least 1) and retry the search **once**; a second `too_complex` → the fallback, whose reason includes `serverMessage` |
| `invalid_query`, `auth` | `isError` with the message, plus the link |
| `http`, `network`, `timeout` before any evaluation | `isError` with the message, plus the link |

**Zero results.**
- Every search total 0 → `No listings matched the search.` (no "upgrade" wording).
- Every fetched item rejected → `All <n> fetched items were rejected: <first 3 reasons>.`

**Progress (D-22).** When `call.progressToken` is present, send `notifications/progress` with strictly
increasing `progress` (no `total`). Messages, in order:
- `generating query`;
- `search <n>`;
- `fetching <k>/<m>`;
- `evaluating`;
- `done`.

**Links (D-39).**
- **League encoding:** `encodeURIComponent(league)`, so a space is `%20`.
- **Fallback link:** `https://www.pathofexile.com/trade2/search/poe2/<league>?q=<encodeURIComponent(JSON.stringify(query))>`.
- **Exact-item link:** the same form over the last query, with `stats[0].value = {min: floor(w,1)−1,
  max: round(w,1)+1}` (w = that listing's Sum) and `filters.trade_filters.filters.account.input =
  <seller account>`.

**Fallback result** (FR-T7, D-49: a result, `isError: false`):
```
Trade search not run: <reason>.
<hint: how to fix>
Open this search in a browser where you are logged in to pathofexile.com:
<link>
```

**Output (success).** Plain text. **Budget: ≤ 30,000 characters** (D-53). Listings render in rank order
in full while the next full listing fits. The rest render as compact lines: `<n>. <name>, <base>: <price>
· score <s> · <UPGRADE|not an upgrade> · seller <account>`, followed by a note saying they were
compacted to fit. The tool is **not** on the 5000-character truncation list.
```
=== find_upgrades: <slot> ===
Build: <loaded.displayName> (<loaded.path>)
League: <league> · <status label> · Budget: <max_price> <display currency> or "no budget" · Sort: <label> ×<w>, …
<notices from the session and this call, one per line>
Current item: <name or "empty"> · Baseline score <b>
Searches <s> · Matches <total> · Fetched <f> · Unavailable <null+unpriced> · Evaluated <e> · Rejected <r> · Over budget <d> · Upgrades <u>

1. <name>, <base type>: <amount> <currency> (≈ <normalized> <display currency>) · UPGRADE | not an upgrade
   Score <score> vs <baseline> (<+/-pct>%)
   <Stat label> <+/-delta> (<+/-pct>%) · … (sort stats, then report_stats)
   Buy: <whisper>                      ← when the listing has a whisper
   Buy: <exact-item link>              ← otherwise
   Item text:
   <PoB item text, indented 3 spaces>
…
No upgrade within budget.                ← when there are no upgrades (always stated)
Search on the trade site: <searchUrl>    ← always the last line
```

### C-15: `trade_query_options` tool (new)

- **Input:** `{slot: string}`. Engine kind: `read`.
- **Output:** C-13's `trade_query_options` result, rendered as text sections:
  - supported (or the reason);
  - sort stats (label and stat id);
  - weights (saved weights, or the defaults);
  - required-mod choices (`trade_id`: text, kind), sorted by id;
  - currencies (input value → label);
  - statuses (input value → label);
  - which `find_upgrades` options apply to the slot.
- **Choice lists** longer than 200 entries are truncated to the first 200, with a count of the rest.

## 4. Work units

### WU-14: Credentials, trade HTTP client, rate limiter
- kind: build
- depends-on: [WU-04]
- role: backend-dev
- touches: [`src/trade/` (new: `credentials.ts`, `tradeClient.ts`, `rateLimiter.ts`, `errors.ts`), `src/services/tradeClient.ts` (removed), `src/handlers/tradeHandlers.ts` (repoint imports; pass `auth:false`), `src/utils/userAgent.ts` (new), `src/services/poeNinjaClient.ts` and `src/utils/buildCode.ts` (User-Agent only), `src/server/createServer.ts` (wiring: limiter, client, credential getter, lazy stats), `src/index.ts` (credential getter with `<packageRoot>/.env`), `src/services/statMapper.ts` (lazy-loading hook only), `package.json`/lockfile (**remove `bottleneck`**; the single exception to the dependency rule)]
- produces: [C-9, C-10, C-11, the D-25 constants]
- consumes: [C-7, C-18]
- acceptance: [AC-T1, AC-T2, AC-T3, AC-T4, AC-T5, AC-T6, AC-T7, AC-T8, AC-T9, AC-T10, AC-T11, AC-T12, AC-T13]
- milestone: M-α
- summary: Build the client, limiter and credentials as C-9/C-10/C-11 specify, and repoint the existing
  trade handlers at the new client, keeping their behaviour (WU-15 fixes it). Make the User-Agent a
  single module (D-25, with the share-site variant). Add the league resolver (D-20).

### WU-15: Mod parsing, currency, kept trade tools
- kind: build
- depends-on: [WU-14]
- role: backend-dev
- touches: [`src/trade/modLines.ts` (new), `src/trade/currency.ts` (new), `src/services/poeNinjaClient.ts`, `src/handlers/poeNinjaHandlers.ts`, `src/handlers/tradeHandlers.ts`, `src/services/tradeQueryBuilder.ts`, `src/services/statMapper.ts`, `src/types/tradeTypes.ts`, `src/server/toolSchemas.ts` (trade/ninja tool schemas and descriptions), `tests/unit/poeNinjaClient.test.ts` (rewritten on the fixture), `tests/fixtures/trade2/expected-mod-text.json` (new; generated once with PoB's `escapeGGGString` by a committed luajit script)]
- produces: [C-12, `parseModLine`/`stripMarkup`]
- consumes: [C-10]
- acceptance: [AC-T14, AC-T15, AC-T16, AC-T17, AC-T18, AC-T19, AC-T20]
- milestone: M-α
- summary: Changes:
  - Mod-line types and a parser that accepts both string and object lines (S-3 §1–2).
  - The C-12 currency service.
  - `get_currency_rates` labels values in the primary currency.
  - Fix `search_trade_items`:
    - **the handler adopts the schema's argument names** (`item_rarity`, `mods:[{stat_id,min,max}]`,
      `price_currency`);
    - `categoryMap` covers the PoE2 categories;
    - the currency option on the price filter;
    - `trade2` URLs;
    - `min_links` is replaced by `min_rune_sockets` → `equipment_filters.rune_sockets.min` (D-51h);
    - no `socket_filters`.
  - `get_item_price` normalizes to the primary currency.
  - `search_stats` uses live stats only (the static fallback is deleted).
  - `get_leagues` marks the D-20 default.
  - Remove the hygiene allowlist and waiver entries these fixes close.

### WU-16: Lua trade actions
- kind: build
- depends-on: [WU-07]
- role: lua-dev
- touches: [`pob-api/API/Trade.lua` (new), `pob-api/API/Handlers.lua` (one registration line), `src/engine/schemas.ts` (three schemas), `src/pobLuaBridge.ts` (three typed wrappers), `tests/integration/trade.lua.test.ts` (new)]
- produces: [C-13]
- consumes: [C-2, C-4, C-6]
- acceptance: [AC-T21, AC-T22, AC-T23, AC-T24, AC-T25, AC-T26, AC-T27, AC-T42]
- milestone: M-α
- summary: Port S-1's `TradeShim.lua` into the three C-13 handlers. Apply the corrections:
  - mirrored items included by default;
  - the build's saved weights as the default;
  - the D-55 canonical order before `FinishQuery`;
  - the D-57 baseline and `*TakenHit` exclusion;
  - per-item `pcall`;
  - rebinding after a load;
  - supported-slot errors;
  - a required jewel type.

  Evaluation returns the item text. Tests run engine-required on the golden build, with the
  `fetch-*.response.json` fixtures as inputs. (WU-09 adds the contract-test cases.)

### WU-17: `find_upgrades` search pipeline (C-21) and `trade_query_options` tool
- kind: build
- depends-on: [WU-08, WU-15, WU-16]
- role: backend-dev
- touches: [`src/trade/findUpgrades.ts` (new), `src/trade/links.ts` (new), `src/trade/prefit.ts` (new), `src/handlers/tradeHandlers.ts` (`trade_query_options` entry point), `src/server/toolSchemas.ts`, `src/server/toolRouter.ts`, `src/server/toolMeta.ts`, `tests/fixtures/tool-disposition.json` (clear `trade_query_options` `pending`), `tests/fixtures/tool-calls.json` (one sample), `tests/helpers/tradeFixtures.ts` (new)]
- produces: [C-21, C-15]
- consumes: [C-3, C-9, C-10, C-11, C-13]
- acceptance: [AC-T28, AC-T29, AC-T30, AC-T32, AC-T33, AC-T34, AC-T38, AC-T41, AC-T43]
- milestone: M-α
- summary: Implement C-14 steps 1–9 as `runUpgradeSearch` (C-21), including:
  - the fallback ordering (D-49), the prefit (D-23) and PoB's adjust loop;
  - the deadline and its clipping (D-22), early stops and classified errors;
  - progress messages;
  - sanitizing (D-56), the query cache and links (D-39).

  Implement and wire `trade_query_options` (C-15). Tests:
  - engine-required tests use the golden build and `fixtureFetch` routes built from the trade2
    fixtures;
  - multi-page sets are synthesized by `tradeFixtures.ts`;
  - a fake clock covers the budget and limiter cases.

### WU-23: `find_upgrades` evaluation, pricing, ranking, output and tool
- kind: build
- depends-on: [WU-17]
- role: backend-dev
- touches: [`src/trade/renderUpgrades.ts` (new), `src/trade/rankUpgrades.ts` (new), `src/handlers/tradeHandlers.ts` (`find_upgrades` entry point), `src/server/toolSchemas.ts`, `src/server/toolRouter.ts`, `src/server/toolMeta.ts`, `tests/fixtures/tool-disposition.json` (clear `find_upgrades` `pending`), `tests/fixtures/tool-calls.json` (one sample)]
- produces: [C-14 (complete)]
- consumes: [C-3, C-12, C-13, C-21]
- acceptance: [AC-T31, AC-T35, AC-T36, AC-T37, AC-T39, AC-T40, AC-T44, AC-T45]
- milestone: M-α
- summary: Implement C-14 steps 10–13:
  - evaluation via `trade_evaluate_items`;
  - prices (D-11, D-33, D-54);
  - ranking and `is_upgrade`;
  - selection and rendering under the D-53 budget.

  Wire the `find_upgrades` tool. Its handler runs `runUpgradeSearch` and the evaluation inside one
  `session.run`, passing `call.signal`, the deadline and `sendProgress`.

## 5. Acceptance criteria

**Credentials, client, limiter (WU-14)**

- **AC-T1 (WU-14, C-9).** Unit. A table of cases, each asserting the getter result:

  | # | Input | Expected |
  |---|---|---|
  | (a) | env `POESESSID=a`, file has `POESESSID=b` | `a`, `process-env` |
  | (b) | env empty, file `POE_SESSION_ID=c` | `c`, `dotenv` |
  | (c) | file with BOM + `POESESSID=d` | `d` |
  | (d) | CRLF file | parsed |
  | (e) | `export POESESSID=e` | `e` |
  | (f) | `POESESSID="fg"` | `fg` |
  | (g) | missing file | `null`, `source: null` |
  | (h) | `POESESSID=op://V/I/f` | `null`, `problem: 'op-reference'` |
  | (i) | file changed between two calls | the second call returns the new value |
  | (j) | after any of the above | `process.env` unchanged |
  | (k) | `POESESSID="a b"` or a value containing `;` or a control char | `null`, `problem: 'malformed'` |
  | (l) | `POESESSID="   "` | `null` |
- **AC-T2 (WU-14, I-8e).** In-process. The credential getter returns the sentinel `SENTINEL7f3a`, and
  calls go to `search_trade_items`, `get_leagues` and `get_currency_rates`, plus a direct
  `client.search(auth:true)` and `client.fetch(auth:true)`. Using `fixtureFetch.calls`:
  - only `/api/trade2/search/` and `/api/trade2/fetch/` requests made with `auth:true` carry
    `cookie: POESESSID=SENTINEL7f3a`;
  - `/data/*`, poe.ninja and the kept tools' searches (`auth:false`) carry no `cookie` header;
  - the sentinel appears in no tool output, no thrown `TradeError.message`, and no captured
    `console.error` line, including when the server answers 400/401/429/500 and when `fetch` rejects
    with a `TypeError` whose message contains the cookie header.
- **AC-T3 (WU-14, D-25).** In-process. Every request recorded by `fixtureFetch` has a `user-agent` of:
  - `pob2-mcp-server/<package.json version>` on the trade and poe.ninja paths;
  - `Mozilla/5.0 (compatible; pob2-mcp-server/<version>)` on the `import_build` pobb.in path.

  A static check finds both defined only in `src/utils/userAgent.ts`. `rg -n "PathOfBuildingCommunity\\)|pob-mcp-server/1.0" src/`
  finds nothing, and `rg -n "Mozilla" src/` matches only `userAgent.ts`.
- **AC-T4 (WU-14, I-8d).** Unit. Feeding the `search-weighted-session.headers.json` headers to the
  limiter yields policy `trade-search-request-limit` with:
  - rule `account` windows `[{max:3, period:5, penalty:60}]`;
  - rule `ip` with 4 windows.

  Fetch headers yield `account` `[{6,4,10}]`. The anonymous fixtures yield only `ip`. Rule-name case
  is ignored (`Account` = `account`).
- **AC-T5 (WU-14, NFR-9).** Unit, fake clock.
  - Under the logged-in search policy, a burst of 10 admissions is scheduled so that no 5 s window holds
    more than 2 sends (the Account limit 3 minus margin 1), and no Ip window exceeds its `max − 1`.
  - A simulation of 200 random-interval requests across both policies never exceeds any `max − 1`.
- **AC-T6 (WU-14).** Unit, fake clock.
  - A response with state `ip` `…:…:45` (active penalty) → the next admission throws
    `locked_out {waitS: 45}` without calling `send`.
  - A 429 with `Retry-After: 7` → `rate_limited {retryAfterS: 7}`, and admissions throw `locked_out`
    for 7 s.
  - A 429 **with no policy header** on a class that has a known policy locks that policy.
  - A required wait of 40 s with the default `maxWaitMs` → `would_wait {waitS: 40}`, with no sleep.
- **AC-T7 (WU-14).** Unit.
  - Two concurrent `run('search', …)` calls before any search response has arrived: the second `send`
    starts only after the first settles.
  - When the first `send` rejects (network error), the second still proceeds.
  - When the first response has no rate-limit headers, the second still proceeds.
- **AC-T8 (WU-14, D-35).** Unit. With the local count at 1 in a window, a response state reporting
  `hits: 2` in that window makes the next admission wait as if 2 requests had been sent.
- **AC-T9 (WU-14, D-24, I-8c).** Unit, `fixtureFetch` with synthesized responses (error bodies from
  `search-weighted-pob-shape.response.json`):

  | Case | Request | Response | Expected kind / behaviour |
  |---|---|---|---|
  | (a) | weighted body, cookie sent | 400 code 2, rules `Ip` | `session_rejected` |
  | (b) | weighted body, cookie sent | 400 code 2, rules `Account,Ip` | `too_complex` |
  | (c) | `and`-only body, no cookie | 400 code 2 | `invalid_query`, with `serverMessage` |
  | (d) | — | 401 | `auth` |
  | (e) | — | 403 | `auth` |
  | (f) | — | 429, `Retry-After: 7` | `rate_limited`, 7 |
  | (g) | — | 503 with body >300 chars | `http`, status 503, `serverMessage` ≤ 300 chars |
  | (h) | — | fetch rejects `TypeError('fetch failed')` | `network`; the message doesn't contain the TypeError text |
  | (i) | — | a hung request (Jest fake timers, advanced 15 s) | `timeout` |
  | (j) | `auth:true`, no session | — | `no_session`, 0 requests sent |
  | (k) | a caller signal aborted with a string reason | — | the call rejects with that reason, not `network` or `timeout` |
  | (l) | a call with no caller signal | — | doesn't throw at signal construction |
- **AC-T10 (WU-14).** Unit. `fetch(ids)` with 11 ids throws before sending. The request URL is
  `…/fetch/<10 ids>?query=<id>&realm=poe2`.
- **AC-T11 (WU-14, D-14).** In-process.
  - With `fetch` mocked to never resolve, `initialize` and `listTools` complete within 1 s.
  - The first trade call that needs stats triggers exactly one `/data/stats` request, and a second
    call triggers none.
- **AC-T12 (WU-14, D-46).** Unit. Two identical `search()` calls send two requests (no caching), and two
  `getLeagues()` calls within 4 h send one.
- **AC-T13 (WU-14, D-20).** Unit.
  - On the `data-leagues` fixture with `POE_LEAGUE` unset, the resolver returns `Forbidden Rites`.
  - With `POE_LEAGUE=Runes of Aldur`, it returns that, with no request.
  - On a reordered list starting `HC Forbidden Rites, Standard, Runes of Aldur`, it returns
    `Runes of Aldur`.
  - On a list of only `Standard, Hardcore`, it throws "no current league; set POE_LEAGUE".

**Mod parsing, currency, kept tools (WU-15)**

- **AC-T14 (WU-15).** Unit, over the 40 items in the 4 fetch fixtures:
  - every mod line (object or string, incl. `socketedItems`) parses;
  - `stripMarkup` output equals `tests/fixtures/trade2/expected-mod-text.json`;
  - `flags.fractured`/`desecrated`/`crafted` and `domain` are preserved;
  - `magnitudes` min/max are parsed as numbers.
- **AC-T15 (WU-15, C-12).** Unit, poe.ninja fixture:
  - `primary == "divine"`;
  - `valueInPrimary("divine") == 1`;
  - `convert(1, "divine", "exalted", rates)` `toBeCloseTo(440.6, 9)`;
  - `convert(2, "chaos", "exalted", rates)` `toBeCloseTo(326.37, 2)`;
  - `convert(1, "exalted", "chaos", rates)` `toBeCloseTo(0.006128, 5)`;
  - an id present only in `lines[]` converts via `primaryValue`;
  - an unknown id → `null`.

  A synthesized response with `core.primary = "exalted"` and `rates {divine: 0.00227}` converts
  correctly (no hard-coded divine).
- **AC-T16 (WU-15).** Unit, fake clock.
  - A second `getRates` within 60 min sends no request.
  - After 60 min it sends `If-None-Match: <etag>`, and a 304 renews the cache.
  - A 500 → `null`, logged.
  - `POE_NINJA_DISABLED=true` → `null`, with no request.
- **AC-T17 (WU-15).** In-process. The `get_currency_rates` output names the primary currency, e.g.
  "values in Divine Orb". `rg -n "chaos equivalent" -i src/` finds nothing.
- **AC-T18 (WU-15).** In-process, `fixtureFetch` capturing the body.
  - `search_trade_items {league, item_type:"ring", item_rarity:"rare", mods:[{stat_id, min}],
    max_price, price_currency:"divine", corrupted:false}` sends a body with:
    - `type_filters.filters.category.option == "accessory.ring"`;
    - `rarity.option == "rare"`;
    - an `and` stat group with the stat;
    - `trade_filters.filters.price == {max, option:"divine"}`;
    - `misc_filters.filters.corrupted.option == "false"`.
  - The output's links have the form `https://www.pathofexile.com/trade2/search/poe2/<encoded league>/<id>`.
  - `categoryMap` maps crossbow, spear, flail, focus, buckler, talisman and charm.
  - `min_rune_sockets: 2` writes `equipment_filters.filters.rune_sockets.min == 2`, and no
    `socket_filters` key appears in any body.
  - The schema's property names equal the names the handler reads (static test).
- **AC-T19 (WU-15).** In-process.
  - `get_item_price` over the `fetch-ring-divine` fixture reports a price per listing and a summary in
    the primary currency, with per-currency counts.
  - With poe.ninja unavailable, it shows native prices and the "rates unavailable" note.
- **AC-T20 (WU-15).** In-process, with `/data/stats` from the fixture.
  - `search_stats {query:"maximum Life"}` returns `explicit.stat_3299347043`.
  - With `/data/stats` failing, it returns `isError` "trade stat data unavailable".
  - `STAT_MAPPINGS` no longer exists (`rg`).
  - `get_leagues` lists all 6 fixture leagues and marks `Forbidden Rites` as the default.

**Lua trade actions (WU-16)**

- **AC-T21 (WU-16, D-55).** Engine-required, golden build. `trade_generate_query {slot:"Body Armour"}`
  replies with:
  - `itemCategory == "armour.chest"`;
  - a `query` with a `weight` group of ≤ 33 filters and an `and` group;
  - `rankedWeights` sorted by (`meanStatDiff` desc, `|weight|` desc, `tradeId` asc).

  Every filter id exists in `data-stats.response.json`, except ids the test records as known-stale (S-1
  found `rune.stat_3170380905`). Generating in **two fresh engine processes** yields parsed `query` and
  `rankedWeights` that are deep-equal: arrays in order, object keys unordered.
- **AC-T22 (WU-16, NFR-5).** Engine-required. Generation for `Body Armour`, `Weapon 1`, `Ring 1`,
  `Amulet` and `Boots` each completes in ≤ 8 s and reports `meta.calcCount ≥ 1`.
- **AC-T23 (WU-16, D-38).** Engine-required.
  - `Charm 1`, `Arm 1` and `Weapon 1 Jewel Socket 1` → `FAILED`, with the supported list in the error.
  - A tree jewel slot without `jewelType` → `FAILED` "jewel_type is required".
  - With `jewelType: "Base"` → `ok`, with `itemCategory` ending in `jewel`.
  - `statWeights` containing `PhysicalTakenHit` → `FAILED` "not supported for upgrade search".
- **AC-T24 (WU-16).** Engine-required, golden build, `fetch-weighted-session.response.json` (10 body
  armours), default weights:
  - `trade_evaluate_items` returns 10 scored items (or reports each rejection with a reason);
  - for each item, `score` equals `TradeQuery:GetResultEvaluation` computed independently via a Lua query
    in the same engine, within 1e-9;
  - `stats.FullDPS` and `stats.TotalEHP` have `base`, `new`, `delta` and `pct`;
  - `itemText` parses back with `construct('Item', text)` into an item whose `base` is set;
  - an `items` array with a malformed entry inserted yields that entry in `rejected`, and the other 10
    still scored.
- **AC-T25 (WU-16).** Engine-required, golden build, using a fixture body armour that has rune sockets.
  - `runeBehaviour: "copy"` produces item text containing the golden build's current body-armour rune
    lines (the `{rune}`-tagged lines of the equipped item, read via a Lua query).
  - `"remove"` produces text without non-socket-bound rune lines.
  - The scores differ between the two.
- **AC-T26 (WU-16, C-15).** Engine-required. `trade_query_options {slot:"Body Armour"}` returns:
  - ≥ 20 `sortStats`, including `FullDPS` and `TotalEHP`, and none ending in `TakenHit`;
  - 11 `currencies`, with `null` first;
  - 5 `statuses`;
  - `shows.runeBehaviour == true`, `shows.anointBehaviour == false`;
  - ≥ 1 `requiredModChoices`, sorted by `tradeId`, each of whose `tradeId` exists in the stats fixture.

  For `Amulet`, `shows.anointBehaviour == true`.
- **AC-T27 (WU-16).** Engine-required.
  - After generation and evaluation, `__test_state.popups == 0`, and no file was created in the vendor
    tree or the temp builds dir.
  - Loading a different build (the golden build with its body armour removed) and generating again yields
    `rankedWeights` deep-equal to those of a **fresh process** that loaded only the modified build (the
    generator re-bound).
- **AC-T42 (WU-16, D-57).** Engine-required, golden build:
  - `baselineScore` is 1.5 for FullDPS 1 + TotalEHP 0.5;
  - it is 1.0 for FullDPS 1 + BlockChance 0.5 (the golden build's block is 0);
  - evaluating the **equipped** Body Armour's own text gives `score == baselineScore` (±1e-9), so its
    `is_upgrade` would be false.

**`find_upgrades` pipeline and `trade_query_options` (WU-17)**

These are engine-required, through `runUpgradeSearch` inside `session.run`, unless stated. Fetch is a
`fixtureFetch` serving:
- `data-leagues` and `data-stats`;
- the poe.ninja fixture;
- searches and fetches synthesized from fixtures.

The credential getter returns a sentinel cookie unless the AC says otherwise.

- **AC-T28 (WU-17, I-8a).** Input `{slot:"Body Armour", required_mods:[{trade_id:"explicit.stat_3299347043",
  min:80}], max_price:200, status:"available"}`. The first search body has:
  - a `weight` group whose filters are a subset of the generated query's;
  - an `and` group containing `{id:"explicit.stat_3299347043", value:{min:80}}`;
  - `trade_filters.filters.price == {max:200}` (no `option`, for exalted equivalent);
  - `status.option == "available"`.

  A required mod with an id absent from the stats fixture is removed and listed in `droppedStatIds`.
- **AC-T29 (WU-17, D-23).**
  - **Unit:** a query with 33 weighted filters, 0 `and` filters, a price and a max level gives
    `estimate` 200; prefit sends 32 weighted filters (`estimate` 196).
  - **Unit:** the golden build's default Body Armour query (29 weighted, no price) is sent unchanged.
  - **Pipeline:** a first search response of `too_complex` (400 code 2 with `Account,Ip`, weighted body)
    is followed by exactly one more search, with ⌈25 %⌉ fewer weighted filters. A second `too_complex`
    yields `kind: 'fallback'` whose reason includes the server message, with no third search.
- **AC-T30 (WU-17, PoB's adjust loop).** Unit over search totals, `fetch_pages: 2` (`maxFetch` 20):

  | # | Search totals | Expected |
  |---|---|---|
  | (a) | `[5, 50]` | 2 searches; the second `min` is half the first |
  | (b) | `[10000, 500]` | 2 searches; the second `min` = (first fetched entry's Sum + first `min`)/2, using the "Sum:" parse from `fetch-weighted-session` |
  | (c) | `[10000, 10000, 10000, 10000, 10000]` | stops at 5 searches |
  | (d) | `[10000, 8, 8, 8, 8]` | 5 searches; `min₂ = (Sum₁ + min₁)/2`, then searches 3–5 each halve it; the result is 20 entries (search 5's 8, then search 1's 10 already-fetched, then 2 unfetched ids from search 1) using 3 fetch requests |

  Never more than 5 searches in any case.
- **AC-T32 (WU-17, FR-T7).**
  - With a credential getter returning `null`, `league: "Forbidden Rites"`, the result is `kind:
    'fallback'`. The reason mentions POESESSID, and the link starts
    `https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites?q=`.
  - URL-decoding the `q` parameter gives JSON deep-equal to the generated query.
  - With `problem: 'op-reference'`, the reason mentions the 1Password reference; with `'malformed'`,
    the reason says malformed.
- **AC-T33 (WU-17).** The first search answers `session_rejected` → `kind: 'fallback'`, with "refresh
  POESESSID". No fetch is sent.
- **AC-T34 (WU-17, D-22, NFR-4).** Fake clock and fake limiter waits:
  - **(a)** A required wait of 40 s on the second search → `stoppedEarly` with "40 s", returned without
    sleeping.
  - **(b)** Cumulative waits approaching the deadline → no request is sent after the deadline, and the
    total elapsed fake time is ≤ 90 s.
  - **(c)** `locked_out` → the same early stop.
  - **(d)** A 429 with `Retry-After: 7` on the second search → `stoppedEarly` with "7 s".
  - **(e)** A hung fetch with 20 s left → it is aborted at ≤ 20 s (its timeout clipped), then
    `stoppedEarly` "budget ran out".
  - **(f)** A deadline that passes while waiting for the engine lock → "engine was busy".
- **AC-T38 (WU-17, the query cache).**
  - Two identical runs → `trade_generate_query` is called once (bridge spy).
  - After `set_character_level` (revision +1), a third run regenerates.
  - Search and fetch requests are sent on every run (D-46).
- **AC-T41 (WU-17, C-15).** In-process.
  - `trade_query_options {slot:"Ring 1"}` renders every C-15 section, with no `undefined`.
  - `tool-disposition.json` has no `pending` on `trade_query_options`, and `listTools` count is 75.
- **AC-T43 (WU-17, D-49).** With `env.POE_LEAGUE="Forbidden Rites"` and a credential getter returning
  `null`, `fixtureFetch.calls` is **empty** after the run: no `/data/*`, no search, no fetch. The
  `fixtureFetch` has no `data-*` routes, so any such request would throw.

**`find_upgrades` evaluation, pricing, ranking, output (WU-23)**

These are in-process and engine-required unless stated, with the same `fixtureFetch` routes as WU-17.

- **AC-T31 (WU-23, I-8b).** A synthesized result of 30 listings over 3 pages, priced in exalted, chaos
  and divine, including a "2 chaos" listing (≈ 326 ex), with `max_price: 200`:
  - (i) `rank_by` `stat_value` orders by score, descending;
  - (ii) `price` orders by normalized price, ascending;
  - (iii) `stat_value_per_price` orders by `score − 0.1·log10(divine price)`;
  - (iv) `trade_weight` keeps the trade order;
  - (v) the 2-chaos listing is dropped and counted under "Over budget";
  - (vi) `is_upgrade` equals `round(score,4) > round(baseline,4)` for every listed item;
  - (vii) every full listing has a `Buy:` line (whisper when the listing has one, otherwise the
    exact-item link) and an `Item text:` block;
  - (viii) with all scores ≤ the baseline (the fixture items re-priced, and the equipped item's own text
    as the only candidate), the output contains `No upgrade within budget.` and no listing (without
    `include_non_upgrades`);
  - (ix) with one listing in an unconvertible currency, `rank_by: "price"` falls back to `stat_value`
    with a note, and that listing is flagged and not counted over budget.
- **AC-T35 (WU-23).** Through the MCP tool, the fixture holds one fetch response open until the test
  releases it. Cancel the request through an `AbortController` passed to `client.callTool({…},
  undefined, {signal})`.
  - The pending fetch's `init.signal.aborted` becomes true.
  - No further `/fetch/` or `/search/` request is recorded.
  - A concurrent `lua_get_build_info`, queued behind the lock, completes within 1 s of the cancel.
- **AC-T36 (WU-23).** Through the MCP tool, with a `progressToken` (`onprogress` handler on `callTool`):
  the client receives ≥ 4 progress notifications with strictly increasing `progress`, and the messages
  appear in the order of C-14. Without a token, none are sent.
- **AC-T37 (WU-23, I-2).** While `find_upgrades` is in its fetch phase (a held fixture response),
  `set_character_level {level: 50}` is issued concurrently.
  - It completes only after `find_upgrades` returns.
  - `find_upgrades`' baseline and scores equal those of an undisturbed run at level 90.
  - The final `lua_get_build_info` shows 50.
- **AC-T39 (WU-23, D-11, D-33).** poe.ninja answers 500, so there are no rates.
  - The output shows native prices and contains "Currency rates unavailable".
  - `rank_by: "price"` falls back to `stat_value`, with a note, while `rank_by: "trade_weight"` is kept.
  - No listing is dropped as over budget.
- **AC-T40 (WU-23, NFR-3, NFR-10).** The golden build, Body Armour, the fixture search
  (`search-weighted-session`) and fetch (`fetch-weighted-session`, served for both pages with rewritten
  ids), and no limiter waits (fake limiter clock):
  - with defaults, the call completes in ≤ 15 s of wall time;
  - with `limit: 20, include_non_upgrades: true`, the output is ≤ 30,000 characters, and listings past
    the budget render as compact lines with the compaction note;
  - the last line starts with `Search on the trade site:`;
  - `find_upgrades` is not on the truncation list.
- **AC-T44 (WU-23, D-56).** Synthesized fetch data:
  - **(a)** A page with one `null` entry and one listing without `price` → both dropped, and the output's
    "Unavailable" count is 2. The other entries are evaluated.
  - **(b)** All search totals 0 → the output contains `No listings matched the search.`
  - **(c)** Every fetched item rejected → `All <n> fetched items were rejected:`.
  - **(d)** A `network` error on the second page after the first was evaluated → no `isError`, the
    first page's listings, and "Stopped early".
  - **(e)** A fake engine evaluate step that needs more than the remaining budget is not started (or its
    `timeoutMs` is clipped) → "budget ran out", and the call returns within the deadline.
- **AC-T45 (WU-23).**
  - **Header.** The output's `Build:` line names `grenadator` and `grenadator.xml`.
  - **Reload notice.** With `grenadator.xml` modified on disk and the engine clean, the output starts with
    the `Reloaded grenadator.xml` notice (C-3).
  - **Fallback rendering.** A fallback result renders with `isError` false and starts with
    `Trade search not run:`.
  - **Disposition.** `tool-disposition.json` has no `pending` left, and `listTools` count is 76 (AC-F25).

## 6. Test strategy (this slice)

| AC | Class |
|---|---|
| AC-T1, T4…T10, T12…T16, T29 (unit parts), T30, T34 | unit (fake clock and fake limiter as named) |
| AC-T2, T3, T11, T17…T20, T41 | in-process |
| AC-T21…T27, T42 | engine-required (bridge-level, Lua queries via `__test_eval`) |
| AC-T28, T29 (pipeline part), T32, T33, T38, T43 | engine-required, through `runUpgradeSearch` |
| AC-T31, T35…T37, T39, T40, T44, T45 | in-process + engine-required, through the MCP tool |

- **No live network.** Every trade and poe.ninja response comes from `tests/fixtures/` or is synthesized
  from them (D-34).
- **Synthesizing fixtures.** Derived listings keep the fixture's structure and change only `id`,
  `listing.price`, `pseudoMods[0].description` and, where needed, `listing.whisper`, through
  `tests/helpers/tradeFixtures.ts`. No new response *shapes* are invented. The cases not yet observed
  (429 body, expired cookie, `null` entries, price-less listings) use the minimum fields the code reads.
- **Live verification is WU-20.** It covers:
  - one real `find_upgrades` with the user's cookie;
  - recording any unverified response observed (expired cookie, 429, over-complexity);
  - opening one exact-item link and one fallback link in a logged-in browser;
  - checking that poe.ninja accepts the league name (A-7);
  - measuring the real output's token count;
  - optionally, trying the shorter offline search-id link form (D-39).
