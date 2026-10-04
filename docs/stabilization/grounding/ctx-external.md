# ctx-external — GGG + poe.ninja grounding for the pob2-mcp spec

Researched 2026-10-03. **[V]** = read in the authoritative source during this research · **[I]** = inference.
No trade API (`/api/trade2/*`) and no poe.ninja API endpoint was called. Doc pages were fetched with
WebFetch and, for verbatim text, with `curl -A 'pob2-mcp-server/0.1'`. Copies are in
`scratchpad/formalize/ext/`.

**Which copy of the GGG docs was used:** fresh (2026-10-03). The fresh `/developer/docs/index` and
`/developer/docs/authorization` match the saved `scratchpad/devdocs.html` / `authdocs.html` byte for byte
except for the Cloudflare challenge token (`diff` = 1 line each). Also fetched fresh: `/reference`,
`/changelog`, `/data`, `/game`.

---

## 1. GGG developer docs (https://www.pathofexile.com/developer/docs)

### 1.1 Rate Limits section (heading "Rate Limits"), verbatim [V]

> In order to protect our services we employ the use of rate limits on the majority of our endpoints. These limits are dynamic and can change at any time depending on our requirements.
> For this reason we include headers in response headers that should be parsed and followed by your application.

Example given (normal): `HTTP/1.1 200 OK` · `X-Rate-Limit-Policy: ladder-view` · `X-Rate-Limit-Rules: client` · `X-Rate-Limit-Client: 10:5:10` · `X-Rate-Limit-Client-State: 1:5:0`
Example given (exceeded): `HTTP/1.1 429 Too Many Requests` · same policy and rules · `X-Rate-Limit-Client: 10:5:10` · `X-Rate-Limit-Client-State: 11:5:10` · `Retry-After: 10`

Breakdown (verbatim):

| Header | Doc text |
|---|---|
| `X-Rate-Limit-Policy` | "The policy that applies to this request." / "Policies may be the same across different API endpoints but are treated the same for rate limiting purposes." |
| `X-Rate-Limit-Rules` | "A comma-delimited list of applicable rules." / "This can be used to determine the header key for the next two headers." / "Common rules are: ip, account, and client." |
| `X-Rate-Limit-{$rule}` | "A comma-delimited list of text representing the rule." "These are made up of three numbers separated by a colon with each representing:" **"the maximum hits"**, **"the period (in seconds) tested"**, **"the time restricted (in seconds) if the rule is broken"** |
| `X-Rate-Limit-{$rule}-State` | "A comma-delimited list of text representing the request's current state." "Similarly to the header above, these are made up of three numbers separated by a colon with each representing:" **"the current hit count"**, **"the period (in seconds) tested"**, **"the active time restricted in seconds (this will be 0 if the request is not rate limited)"** |
| `Retry-After` | "Time to wait (in seconds) until the rate limit expires." |

Consequence (verbatim, last line of the section): **"Exceeding these limits frequently will result in your application access being revoked."**

Implications:
- The limit is **per policy**. Rules within a policy are listed in `-Rules`, and each rule's header lists several windows separated by commas [V].
- In the exceeded example, a state of `11` against a max of `10` triggers the restriction. So the max is the number of hits *allowed* in the window, and hit max+1 is penalised for the third number of seconds [V example; the semantics are I].
- Rule names are lower-case in the docs (`ip, account, client`). trade2 sends `Ip` / `Account` (fixtures). Header names are case-insensitive, so the limiter must match rule names case-insensitively. PoB lower-cases them (`TradeQueryRateLimiter.lua:69,87`) [V].

### 1.2 Neighbouring rules that bind the limiter and retry design [V]

Heading "Errors" → "Invalid Requests Threshold", verbatim:
> Applications (and users) that make too many invalid requests in a short period of time will be restricted from further access to our service.
> Invalid requests include any response codes in the HTTP 4xx range. This includes common codes such as 401 (Unauthorized), 403 (Forbidden), and 429 (Too Many Requests).
> Reasonable attempts must be made in order to avoid passing the threshold.

Heading "Errors" → "HTTP Status Codes" (documented APIs): 200 OK, 202 Accepted, 400 Bad Request, 404 Not Found,
429 Too many requests ("You are making too many API requests and have been rate limited."), 500 Internal Server Error.
"Error Messages": `{"error": {"code": 2, "message": "Invalid query"}}`. Quote: "If your application makes decisions based on the error response make sure you use the code rather than the message as the message is subject to change."
Codes: 0 Accepted, 1 Resource not found, **2 Invalid query**, 3 Rate limit exceeded, 4 Internal error, 5 Unexpected content type, 6 Forbidden, 7 Temporarily Unavailable, 8 Unauthorized, 9 Method not allowed, 10 Unprocessable Entity.
→ trade2's 400 body uses this same envelope and code 2 (fixtures). That match is [V]. That trade2 follows the table generally is [I].

Heading "Authorizing a Request" (authorization page): "An HTTP 401 error will occur when the token has expired or has been revoked." / "Similarly, an HTTP 403 error occurs when using a token that does not have the correct scope for the resource." This applies to **OAuth bearer tokens**, not to a `POESESSID` cookie [V].

### 1.3 User-Agent requirement (heading "Developer Guidelines" → "User Agent"), verbatim [V]

> Any application that interacts with our API must set an identifiable User Agent header prefixed using the following format:
> `User-Agent: OAuth {$clientId}/{$version} (contact: {$contact}) ...`
> Example: `User-Agent: OAuth mypoeapp/1.0.0 (contact: mypoeapp@gmail.com) SomeOptionalThingHere`

Section lead-in: "Failing to meet any guidelines listed here may result in your application's access being revoked."
- **Who it applies to:** literally "any application that interacts with our API". The required prefix contains an OAuth `clientId`, so in practice only a registered OAuth app can comply. "Our API" means the documented API ("We can only support resources defined in our API Reference or listed in our Data Exports"). The docs set no UA rule for the internal trade endpoints [I].
- pob2-mcp has no client id. App registration is closed: "We are currently unable to process new applications." (heading "Getting Started" → "Registering your Application") [V].

### 1.4 Third-party notice (heading "Developer Guidelines" → "Third-Party Notice"), verbatim [V]

> You may not present your project or tool in a way that could be construed as it being developed or officially authorised by Grinding Gear Games. This includes but is not limited to using our company or game logos in a way that imitates official platforms. Every public or widely available application should include some form of the following statement in a visible location:
> **This product isn't affiliated with or endorsed by Grinding Gear Games in any way.**

The repo `README.md` contains no such notice (`grep -i "affiliated|endorsed"` finds nothing) [V]. The fork is a public GitHub repo [I: "public or widely available" plausibly applies].

### 1.5 ToS 7i and internal website APIs (heading "Available Resources"), verbatim [V]

> We can only support resources defined in our API Reference or listed in our Data Exports.
> Requests for access to any other internal website APIs or in-game resources will be denied. **It is against our Terms of Use (section 7i) to reverse-engineer endpoints outside of this documentation.**

Also under "API Policies and Third-Party Requirements": "We reserve the right to remove access to any or all of our APIs and services without notice at our discretion."
Under "Executable apps that run independently from the game": "While not encouraged, these are permitted. They must use a public OAuth client if interacting with our APIs."
Under "Executable apps that interact with the game or game files": "This behaviour is strictly against our Terms of Use (sections 7b, 7c, 7i)."
Data Exports page (`/developer/docs/data`): "We do not officially provide access to any in-game data outside of our supported APIs ." [V]

### 1.6 Pre-OAuth GGG staff statement on trade rate-limit headers (only staff source on the trade API)

Forum thread "PoE Trade API Questions", https://www.pathofexile.com/forum/view-thread/2079853. Reply by **Novynn, tagged "Grinding Gear Games"**, Jan 29, 2018 (PoE1 trade, pre-trade2). PoB cites this thread at `TradeQueryRateLimiter.lua:5`. Verbatim [V]:
> Each rule is made up of three parts: request limit, interval (in seconds), timeout (in seconds).
> The "X-Rate-Limit-{Method}-State" format is similar … It's made up of: current hits, interval (the same as above), active timeout (in seconds).
> The "X-Rate-Limit-Policy" header shows the policy that's active on the API endpoint (searches/exchange queries use the same policy) so requests to either of these endpoints will contribute to the same rate-limit rules.
> We also provide a "Retry-After" header that gives the time you're rate-limited for in seconds (if you are rate-limited).
> Including your session ID ("logged in") will change how certain policies track your limits. In the case of the trade search policy, logging in will rate-limit you based on your account instead of your IP (with the same limits) and the rate-limit based on your IP will allow double the requests per interval.

The last sentence is **out of date** for trade2. S-4 saw the `Account` rule *added to* `Ip` (`Account,Ip`), not replacing it, and a logged-in Ip search limit of `8:10` vs `5:10` anonymous (not double) [V S-4 doc].
A later reply by SlippyCheeze#7036 (Feb 20, 2018, *not* tagged GGG) about backend caching is not authoritative [V tag absent].

---

## 2. Is any part of trade2 officially documented? **No.** [V]

Evidence:
- The API Reference (`/developer/docs/reference`) documents only `https://api.pathofexile.com` endpoints (`/profile`, `/item-filter`, `/league`, `/pvp-match`, `/account/*`, `/character`, `/stash`, `/league-account`, `/guild`, `/public-stash-tabs`) plus the CDN `currency-exchange`. The word "trade" appears only in the Currency Exchange description ("aggregate Currency Exchange trade history") [V grep].
- The changelog (3.25 → 3.29.3b, PoE2 EA 0.1.1 → 0.5.0) has no trade-search entry [V grep]. The scope list has no `account:trade` (Accounts: profile, leagues, stashes, characters, league_accounts, item_filter; Services: leagues, leagues:ladder, pvp_matches, pvp_matches:ladder, psapi, cxapi) [V authorization page].
- The "Available Resources" text calls everything else "internal website APIs" (§1.5) [V].
- Forum: the only GGG staff statement found is §1.6 (2018, PoE1, about headers only). Thread 3215533 (Nov 2021, staff JC_GGG) only links the developer docs. Thread 3655582 (PoE2 trade fetch help) has no staff reply [V WebFetch].
- **Partial overlap:** the trade2 fetch `item` resembles the documented `Item` type but **diverges** from it, so the docs cannot serve as its contract [V]:
  - Docs: `enchantMods`/`runeMods` are "?array of string". Fixtures: arrays of objects (15 `runeMods`, 3 `enchantMods` objects).
  - Docs: `extended` is "only present in the Public Stash API" with `prefixes`/`suffixes`. Fixtures: `extended: {es|ar|ev|ward, hashes}`.
  - Docs `ItemMod` = `{description, flags{fractured, mutated, crafted, desecrated, vestigial}}`. Fixtures add `domain`, `hash`, `mods[]`.

**So the ground truth for trade2 is (a) the committed fixtures, (b) spikes S-3/S-4, (c) PoB2 v0.23.1's client code.**

### 2.1 Committed fixtures — `tests/fixtures/trade2/` (27 files; captured 2026-10-03 19:58–20:04 UTC, unauthenticated, no cookie, UA `pob2-mcp-server/0.1`, league `Runes of Aldur`, realm `poe2`) [V]

| Fixture | Endpoint / request | Status | Notable headers | What it proves |
|---|---|---|---|---|
| `search-body-armour.*` | `POST /api/trade2/search/poe2/Runes%20of%20Aldur`; `armour.chest`, rare, `misc_filters` `fractured_item`+`corrupted` = `"true"`, status `available`, sort `price asc` | 200 | policy `trade-search-request-limit`; rules `Ip`; `x-rate-limit-ip: 5:10:60,15:60:300,30:300:1800,600:21600:3600`; state `1:10:0,1:60:0,2:300:0,21:21600:0` | search response = `{id, complexity, result, total}`; total 6045, **100 ids**, complexity 11; no `inexact` key |
| `fetch-body-armour.*` | `GET /api/trade2/fetch/<10 ids>?query=<search id>` (**no `realm` param**) | 200 | policy `trade-fetch-request-limit`; `x-rate-limit-ip: 12:4:10,16:12:300,50:300:300,1000:21600:1800` | fetch = `{result:[{id, listing, item}]}`, 10 items; mod lines are objects; fractured/desecrated lines inside `explicitMods` with `flags`/`domain`; `runeMods`/`socketedItems`; `extended.{ar,ev,es,ward,hashes}`; **instant-buyout listing shape** (`fee`, no `whisper`, `account.online: null`); prices `~b/o` 1–15 `exalted` |
| `search-ring-divine.*` | ring, rare, `price {option:"divine", min:1}`, status **`online`** | 200 | search Ip headers | currency-restricted price filter accepted; total 1112, complexity 9 |
| `fetch-ring-divine.*` | 10 ids | 200 | fetch Ip headers | **in-person listing shape**: `whisper` (localized en_US/pt_BR/ru_RU), `account.{lastCharacterName, language, realm:"poe2", online:{league, status?}}`; `~price`/`~b/o` 1 `divine`; `item.note` overrides tab price ([4]); seller online in a *different* league (`online.league: "Forbidden Rites"` on [3],[6],[8]) |
| `search-belt-unique-chaos.*` | belt, unique, `price {option:"chaos", min:1}`, `available` | 200 | — | `total` **capped at 10000** |
| `fetch-belt-unique-chaos.*` | 10 ids | 200 | — | uniques; `mutated`; `grantedSkills`; `flavourText`; `~b/o` 1 **`chaos`** (chaos is a real listing currency) |
| `search-weighted-pob-shape.*` | PoB2 weighted group (3 filters + `min`), empty `and`/`not`, `misc_filters.mirrored:false`, `price.max 30` (no option), sort `statgroup.0 desc` | **400** | rules `Ip` only | body `{"error":{"code":2,"message":"Query is too complex. Please reduce the amount of filters used.\nLogging in will increase this limit."}}` |
| `search-weighted-2-filters.*` | 2-filter weight group | **400** | state 300-window 5 | same body |
| `search-weighted-1-filter.*` | 1-filter weight group + category only | **400** | state 300-window 8 | same body. **A weight group of any size is refused anonymously.** 400s count toward the rate-limit state |
| `search-and-3-stats.*` | `and` group of 3 stat mins, `nonunique`, `price.max 30` (no option) | 200 | state `1:10:0,2:60:0,8:300:0,30:21600:0` | anonymous non-weighted fallback query accepted; complexity 12, total 10000 |

Headers common to all 10 responses [V]:
- `set-cookie: POESESSID=<redacted-anonymous-session>; path=/; domain=.pathofexile.com; secure; HttpOnly; SameSite=Lax`. Every response mints an anonymous session.
- `access-control-expose-headers: X-Rate-Limit-Policy, X-Rate-Limit-Rules, X-Rate-Limit-Ip, X-Rate-Limit-Ip-State`.
- `server: cloudflare`. No `Retry-After` was seen anywhere.

### 2.2 HTTP status / error table for search and fetch

| Case | Response | Proven by | Status of evidence |
|---|---|---|---|
| search OK | 200 `{id, complexity, result[≤100], total≤10000}` | 5 search fixtures | **fixture** |
| search, weighted, anonymous | 400 code 2, message above | 3 fixtures | **fixture** |
| search, weighted, logged-in, within budget | 200, complexity 180, total 8354, 100 ids | S-4 doc (raw not committed) | spike-asserted [V doc] |
| search, logged-in, over complexity budget | 400 code 2 + `Account` in rules; **message text unknown** | — | **assumed** (D-15) |
| search with expired/invalid cookie | probably the same as anonymous | S-4 says "[I: not tested]" | **assumed** |
| search, zero results | PoB: `result` empty and no `error` → "No Matching Results Found" (`TradeQueryRequests.lua:219,232-235`) | PoB code | code-only |
| search, other 400 errors | PoB formats `"[ " .. code .. ": " .. message .. " ]"` (`:229-231`) | PoB code | code-only |
| PoB's handling of the login message | PoB maps a message containing "Logging in will increase this limit" to "Authorization is invalid. Please Re-Log and reset" (`:226-227`), which misreports the cause | PoB code | code-only |
| 429 | GGG docs example (documented API): 429 + `Retry-After` seconds + state third number > 0. PoB: `Retry-After:%s+(%d+)` (integer seconds), backoff `max(min(2^attempts,60), retryAfter)` (`:43-50`) | docs + PoB | **no trade2 fixture** |
| 401 | PoB: `"Response code: 401"` with `invalid_token` in body → "Authorization is invalid. Please Re-Log and reset" (`:58-61`). This is the OAuth bearer path | PoB code; GGG OAuth docs | **not observed for cookies** |
| 403 | GGG docs: wrong-scope OAuth token | docs | **not observed for trade2** |
| 404 / 500 / 503 / Cloudflare challenge | generic GGG table only | docs | **not observed** |
| fetch OK | 200 `{result:[{id, listing, item}]}` | 3 fixtures (10 ids each) | **fixture** |
| fetch with >10 ids | unknown; recon claims "limited to 10 ids by GGG" | PoB `max_block_size = 10` (`TradeQueryRequests.lua:249`); our guard `tradeClient.ts:93-95` | **asserted only** (S-3 §6: "Not tested: fetches of more than 10 ids") |
| fetch of a delisted id (`null` entries?) | unknown | — | **not observed** |
| fetch with `&realm=poe2` | 200 (S-4 used `?query=<id>&realm=poe2`); fixtures omit `realm` and also got 200 | S-4 doc + fixtures | both forms work [V] |

### 2.3 Specific evidence the spec needs

- **Fetch ids per request:** 10 is PoB's block size (`TradeQueryRequests.lua:249`) and its default `maxFetchPerSearch = 10` (`:12`). PoB's "Fetch Pages" setting sets `maxFetchPerSearch = 10 * pages` with pages clamped to 1..10, default 2 (`TradeQuery.lua:314-321`) [V]. All 3 fixture fetches used exactly 10 ids [V]. **No evidence of a server-enforced maximum** [I: commonly cited; unverified].
- **Search ids per response:** 100 maximum, `total` capped at 10000 [V fixtures]. PoB re-searches when `total` hits 10000 (`TradeQueryRequests.lua:122`) [V].
- **Listing price shape:** `listing.price = {type: "~b/o"|"~price", amount: number, currency: string}`. Currency ids seen: `exalted`, `divine`, `chaos`. All amounts were integers [V fixtures]. Fractional amounts and unpriced listings were not observed. PoB reads `listing.price.amount/currency/type` without nil checks (`TradeQueryRequests.lua:437-439`) [V].
- **Whisper presence:**
  - 20/20 listings from status `available` have `fee` (gold) and no `whisper`. 10/10 from status `online` have `whisper` and no `fee` [V fixtures].
  - PoB maps its dialog options to API status values: "Instant buyout"→`securable`, "Instant buyout and in person"→`available`, "In person (online in league)"→`onlineleague`, "In person (online)"→`online`, "Any (includes offline)"→`any` (`TradeQuery.lua:298-304` + `TradeQueryGenerator.lua:954-960`) [V].
  - **`securable` (PoB's "instant buyout") has no fixture.** That it yields the `fee`/no-whisper shape is [I].
  - PoB reads `listing.whisper` unguarded (`TradeQueryRequests.lua:441`) [V].
- **Listing extras:** `listing.method: "psapi"` on all 30, `indexed` (ISO-8601), `stash {name, x, y}`, `account.name` (`name#0000`). No `whisper_token`, no `gone` [V fixtures].
- **`Account` rule evidence:**
  - S-4 doc table [V doc]: `trade-search-request-limit` rules `Account,Ip`, Account `3:5:60`, Ip `8:10:60,15:60:120,60:300:1800,600:10800:3600`. `trade-fetch-request-limit` rules `Account,Ip`, Account `6:4:10`, Ip `12:4:60,16:12:60,100:300:300,1000:10800:1800`.
  - PoB's in-code sample independently shows an `Account` rule `{5s: request 3, timeout 60}` and Ip `{10:8:60, 60:15:120, 300:60:1800}` (`TradeQueryRateLimiter.lua:10-35`). These match S-4's Account rule and the first three Ip windows [V].
  - **No committed headers fixture shows `Account`.** Tests must synthesize it (I-8d already says so).
- **PoB limiter behaviour worth mirroring** [V `TradeQueryRateLimiter.lua`]:
  - parses `Retry-After` as seconds (:79-82);
  - lower-cases rule names (:87);
  - keys state by policy (:43-58);
  - reduces every max by `limitMargin = 1` "so the user can safely interact with the trade site" (:41, :273-281);
  - blocks a second request until the first response's headers are known (:152-164).
- **Anonymous `Ip` limits** (fixtures): search `5:10:60,15:60:300,30:300:1800,600:21600:3600`; fetch `12:4:10,16:12:300,50:300:300,1000:21600:1800`. The state counts all traffic from the IP: 21 searches in the 6 h window at the first request [V S-3].

---

## 3. poe.ninja PoE2 API

### 3.1 Official docs exist: **https://poe.ninja/docs/api** ("API Reference"), verbatim [V]

- What is supported: "The economy overview endpoints documented on this page are the supported public surface of the poe.ninja API. They cover economy pricing for Path of Exile 1 and Path of Exile 2."
- Not allowed: "The builds / profiles API, and every other non-economy endpoint (character, Path of Building, authentication), are internal. They are undocumented, unsupported, and not available for third-party use…"
- "Clients that misbehave against these endpoints, or make excessive use of the economy endpoints, will be blocked."
- No stability guarantee: "…There is no versioning and no SLA, and breaking changes can happen to the economy endpoints without notice. … we usually keep them stable and provide redirects when routes move, but treat that as best effort rather than a promise."
- **If you are building an app:** "Desktop apps and other clients should proxy these requests through their own backend rather than calling the endpoints directly from end-user machines. That lets you cache responses, set a proper User-Agent, and control request volume instead of pushing per-user traffic straight at us."
- **Usage guidelines:**
  - "Responses are HTTP-cached (roughly 5 minutes, ETag-based). Use conditional requests and respect the cache headers; do not bypass caching."
  - "The underlying data refreshes infrequently (PoE 1 overviews roughly every 15 minutes, **PoE 2 roughly hourly**), so polling faster than a few minutes wastes bandwidth for no fresher data."
  - "**Send a descriptive User-Agent that identifies your app and a contact.**"
  - "Be reasonable with concurrency and volume; this is a community resource."
  - "Don't use the API to directly replicate the site."
- **No numeric rate limit is published** [V: absent from the page]. The figure "12 requests per 5 minutes" found by web search comes from a community repo that cites no source. Do not use it.
- The poe.ninja docs page has no GitHub/API-repo link. `/swagger/index.html`, `/api` and `/robots.txt` are 404 [V curl]. Site footer: "poe.ninja is not affiliated with or endorsed by Grinding Gear Games." [V]

### 3.2 Documented endpoints for PoE2 [V poe.ninja/docs/api]

| Endpoint | Doc |
|---|---|
| `GET /poe2/api/economy/leagues` | "Lists the active economy leagues as a plain array. **The first entry is the current temporary challenge league**; use its id as the league parameter on the other endpoints." `EconomyLeagueDto {id: "League identifier. Pass this as the league query parameter on the other endpoints.", name: "Human-readable league name."}` |
| `GET /poe2/api/economy/exchange/current/overview?league={league}&type={type}` | PoE2 `type`: `Currency, Fragments, Abyss, UncutGems, LineageSupportGems, Essences, SoulCores, Idols, Runes, Ritual, Expedition, Delirium, Breach, Verisium` |
| `GET /poe2/api/economy/stash/current/item/overview?league={league}&type={type}` | uniques/tablets; `Poe2ItemOverviewLineDto` with `primaryValue` "in the league's primary reference currency" |

Exchange-overview response schema as documented:
- `lines[]` = `CurrencyExchangeOverviewLineDto`:
  - `id` "Stable identifier for the traded currency within this overview."
  - `primaryValue` "Price expressed in the primary reference currency (see core.primary)."
  - `volumePrimaryValue`
  - `maxVolumeCurrency` "The paired currency with the highest observed trade volume."
  - `maxVolumeRate` "Exchange rate against the highest-volume paired currency."
  - `sparkline`
- `core` = `CurrencyExchangeEconomyCoreDto`:
  - `primary` "Primary reference currency that line values are quoted in."
  - `secondary` "Secondary reference currency used for cross-rates."
  - `rates` "Map of currency id to its rate against the primary reference currency."
  - `items` "Metadata (names, icons) for the currencies referenced by id."
- A **top-level `items[]` is not documented** [V absent].

### 3.3 Saved response — `scratchpad/trade/ninja.json` (captured 2026-10-03 ~14:00; league probably `Runes of Aldur` [I]; **not committed**; vision F0 has not been done yet: `git ls-files` shows no ninja fixture) [V]

- Top-level keys: `core`, `lines` (47), `items` (47).
- `core`:
  - `primary: "divine"`, `secondary: "chaos"`.
  - `rates: {"exalted": 440.6, "chaos": 2.7}`.
  - `core.items` has 3 entries (`divine`, `exalted`, `chaos`), each `{id, name, image, category, detailsId}`.
- `lines[]`:
  - every line has `{id, primaryValue, volumePrimaryValue, maxVolumeCurrency, maxVolumeRate, sparkline{totalChange, data[7]}}`; all 47 have `primaryValue > 0`;
  - the primary currency is itself a line: `divine` with `primaryValue: 1`;
  - `exalted` 0.00227, `chaos` 0.371, `mirror` 9924.
- Top-level `items[]`: `{id, name, image, category ∈ {Currency, Vaal}, detailsId}`. Its id set equals the `lines` id set.
- **Semantics, checked numerically** [V arithmetic / I meaning]:
  - `rates[c]` = units of `c` per 1 primary: `rates.exalted × primaryValue(exalted)` = 440.6 × 0.00227 = 1.000; `2.7 × 0.371` = 1.002.
  - `maxVolumeRate` = units of *this line's* currency per 1 `maxVolumeCurrency`: exalted line `440.6` per divine; chaos line `2.7` per divine; divine line `0.371` per chaos.
- **Join key:** all 47 `lines[].id` are trade2 `/data/static` ids, e.g. `exalted`, `divine`, `chaos`, `annul`, `alch` (`scratchpad/trade/static.json`). These are the same ids as `listing.price.currency` [V]. 3 trade Currency ids have no poe.ninja line: `transmutation-shard`, `regal-shard`, `artificers-shard` [V].
  - Normalisation contract [I]: `normalized = amount × lines[currency].primaryValue`, in units of `core.primary`.
  - If the currency is missing → it cannot be normalised.
- **S-4 check:** 2 chaos × 0.371 × 440.6 = 326.9 ex. This matches vision D-11's "≈327 ex" [V].

### 3.4 Our client and PoB2 usage [V]

- `src/services/poeNinjaClient.ts:110,148`: `https://poe.ninja/poe2/api/economy/exchange/current/overview?league=<encodeURIComponent(league)>&type=Currency`. UA `pob2-mcp-server/0.1` (`:151`), which has **no contact**. 5-minute in-memory TTL (`:112`). No conditional requests (`If-None-Match`).
- `:102-104`: the comment claims the "base unit is the Exalted Orb". `:177-186`: `rateMap.set('Exalted Orb', 1.0)`. It keys by **display name**, not trade id. It never reads `core.primary`. `tests/unit/poeNinjaClient.test.ts:5-16` mocks `core: {rates: {chaos: 0.781}}` with no `primary`, and `exalted` = 1.
- PoB2 v0.23.1 `TradeQuery.lua:114-175`:
  - same endpoint and query (`?type=Currency&league=<urlEncode(league)>`);
  - self-limited to **1 request/hour** (`:116-119`);
  - stores `lines[].id → primaryValue` as divines. Comments: "these use the same ids as the trade site" (:158-160), "poe.ninja uses divs as the primary currency" (:162). It hard-codes that assumption and ignores `core.primary`.
- Both pass the **trade league name** (e.g. `Runes of Aldur`) as `league`. The docs say to pass an id from `/poe2/api/economy/leagues`. Whether those ids equal trade league names is **unverified** (that endpoint was not called).

---

## 4. League discovery

- **Endpoint used:** `GET https://www.pathofexile.com/api/trade2/data/leagues` (`tradeClient.ts:148`; PoB `TradeQueryRequests.lua:516-538`) [V].
  - **No committed fixture.** The only capture is `scratchpad/trade/leagues.json` (2026-10-03 18:58 UTC) [V]:
    ```json
    {"result":[{"id":"Forbidden Rites","realm":"poe2","text":"Forbidden Rites"},
               {"id":"HC Forbidden Rites","realm":"poe2","text":"HC Forbidden Rites"},
               {"id":"Runes of Aldur","realm":"poe2","text":"Runes of Aldur"},
               {"id":"HC Runes of Aldur","realm":"poe2","text":"HC Runes of Aldur"},
               {"id":"Standard","realm":"poe2","text":"Standard"},
               {"id":"Hardcore","realm":"poe2","text":"Hardcore"}]}
    ```
  - Entry shape is `{id, realm, text}` only: no start/end dates, no event/challenge flag, no rules [V].
  - No SSF entries [V]. All entries are `realm: "poe2"` (this trade2 feed appears PoE2-only [I]).
  - Response headers (`hdr_leagues.txt`): `cache-control: public, max-age=14400`, `cf-cache-status: HIT`, `age: 6525`. **No `x-rate-limit-*` headers** [V]. The same holds for `/data/stats`, `/data/static`, `/data/items`.
- **Two concurrent non-Standard softcore leagues.** Third-party sources, not GGG [I]:
  - `Runes of Aldur` = the 0.5 "Return of the Ancients" challenge league (live since 2026-05-29).
  - `Forbidden Rites` = the 0.5.5 event league (from 2026-09-04, "resetting all players in a new economy", running "until … 1.0").
  - Sources: maxroll.gg "0.5.5 Forbidden Rites Patch Notes"; maxroll.gg "Runes Of Aldur Overview … 0.5.4"; poe2 fextralife wiki.
  - The fixture ring listings in Runes of Aldur show sellers currently online in `Forbidden Rites` [V].
- **PoB2's deterministic rule** (`TradeQuery.lua:397-411, 46, 423-427`) [V]:
  1. Keep entries with `realm == "poe2"`, in API order (`TradeQueryRequests.lua:529-532`).
  2. Move `Standard` and `Hardcore` to the end.
  3. Default selection index 1.
  - On this capture that selects **`Forbidden Rites`**, not `Runes of Aldur`. HC variants are not filtered. They are only skipped here because the API lists each SC league before its HC league [V order].
  - PoB's PoE1 path (`api/leagues?type=main&compact=1`, `TradeQuery.lua:70-100`) drops ids containing `"SSF"`.
- **Patterns visible in the capture** [V; not a documented contract]:
  - HC challenge/event leagues are `"HC " + name`; the permanent ones are `Standard` / `Hardcore`.
  - Nothing distinguishes challenge from event.
- **Authoritative alternatives:**
  - GGG `GET https://api.pathofexile.com/league?realm=poe2` gives `League.category.current` ("set for the active challenge leagues"), `event`, `rules[].id` (e.g. `Hardcore`, `NoParties` (SSF)), `startAt`/`endAt`. **But it requires the `service:leagues` scope = confidential OAuth client** ("Requires a confidential client with the client_credentials grant type"), so it is **unavailable** [V reference + authorization pages].
  - poe.ninja `GET /poe2/api/economy/leagues`: "first entry is the current temporary challenge league". This is documented, but unverified which of the two leagues it returns and whether its `id` equals the trade id.

---

## Contradictions with vision.md

1. **D-6: "the current non-Standard poe2 league from `/data/leagues`" is not well-defined.**
   - The feed currently has **two** non-Standard softcore leagues (`Forbidden Rites`, `Runes of Aldur`) plus their `HC ` variants.
   - No field marks the challenge league.
   - PoB2's own default (first in API order) would pick `Forbidden Rites`, while S-3/S-4 and every fixture use `Runes of Aldur`.
   - The spec must choose a rule. Options: PoB's first-in-order rule; poe.ninja's "first entry"; or refuse and ask for `league`/`POE_LEAGUE` when more than one candidate exists. It must also exclude `HC `/`Hardcore`, and it needs a committed `/data/leagues` fixture (none exists).
2. **D-6 default trade status "instant buyout" ≠ the fixtures' `available`.**
   - In PoB, instant buyout is API value `securable`; `available` is "Instant buyout and in person" (`TradeQueryGenerator.lua:954-960`).
   - No `securable` response is captured. Its shape (fee, no whisper) is inferred.
   - With the default, outputs will essentially never carry a `whisper`, so the exact-item-URL path (D-6, I-8b) is the main path, not the fallback.
3. **D-7 identity: a User-Agent that names "a contact" vs current practice.**
   - GGG's prescribed format `OAuth {clientId}/{version} (contact: …)` cannot be followed without an OAuth client id (registration closed).
   - poe.ninja requires "a descriptive User-Agent that identifies your app and a contact".
   - Every capture so far (and `poeNinjaClient.ts:151`) used `pob2-mcp-server/0.1` with **no contact**.
   - The spec must fix the exact string and the contact, which must not be user identity. The obvious contact, the fork URL, names the user's GitHub account: needs a human call.
4. **D-7 / D-15 vs GGG policy.** vision.md does not mention that the trade2 endpoints are "internal website APIs" and that "It is against our Terms of Use (section 7i) to reverse-engineer endpoints outside of this documentation". It also omits that executable apps "must use a public OAuth client if interacting with our APIs". Recon §5 records these; vision does not. The spec should state the accepted risk explicitly (account/IP restriction, "application access being revoked").
5. **D-15 trim-and-retry vs GGG's "Invalid Requests Threshold".**
   - Every 400 is an "invalid request" ("any response codes in the HTTP 4xx range"), and 400s count toward the rate-limit state (fixtures: state rose across the three 400s).
   - "Reasonable attempts must be made in order to avoid passing the threshold."
   - The retry bound must be small and specified. Pre-fitting the query to the ~200 complexity budget (S-4: 180) should be the primary mechanism, with retries the exception.
6. **D-15 classification precedence is ambiguous and partly unproven.**
   - The rule "(or its message contains 'Logging in will increase this limit') → session not recognised" conflicts with "400 code 2 with `Account` present → over complexity limit" if a logged-in over-budget 400 carries the same message. That body has **no fixture**.
   - GGG also says to branch on `code`, not `message` ("the message is subject to change").
   - The spec should make `Account ∈ X-Rate-Limit-Rules` the primary discriminator and the message a fallback, and mark the logged-in-400 body as assumed.
7. **D-15 / I-8c "401/403 → auth message"** has no trade2 evidence. GGG's 401/403 semantics are for OAuth bearer tokens, and PoB's 401 branch requires `invalid_token` in the body (OAuth). For a cookie, these codes are hypothetical. Mark them as assumed in the spec.
8. **D-11: "poe.ninja's PoE2 feed is Divine-primary".**
   - True in the capture.
   - The docs define `core.primary` as a per-response field ("the league's primary reference currency"), not a constant. The spec must read `core.primary` on every response and never hard-code `divine`. PoB2 v0.23.1 does hard-code it, so it is a bad model to copy.
   - Normalisation must join on the **trade currency id** (`lines[].id` = `listing.price.currency`), not display names as `poeNinjaClient.ts` does now.
9. **D-11 vs poe.ninja usage guidelines.**
   - poe.ninja says desktop/client apps "should proxy these requests through their own backend rather than calling the endpoints directly from end-user machines", use **conditional requests (ETag)**, and not poll faster than a few minutes (PoE2 data refreshes "roughly hourly").
   - pob2-mcp calls directly from the user's machine with a 5-minute TTL and no ETag.
   - A single-user tool calling about once an hour is defensible, but the spec should set a cache TTL of about 1 h or more (PoB uses 1/hour) and send `If-None-Match`.
10. **D-11 / I-8: "A poe.ninja fixture is committed"** — not yet true. F0 has not run: `git ls-files` lists no ninja or leagues fixture. The only captures (`scratchpad/trade/ninja.json`, `leagues.json`) live in the session scratchpad and will be lost unless F0 commits them.
11. **I-8d / D-15 rate-limit values.** The `Account` rule values (`3:5:60`, `6:4:10`) and the logged-in Ip values come only from the S-4 doc and PoB's sample comment. No committed headers fixture contains them, which I-8d already acknowledges with "synthesized". Note also that logged-in **Ip** limits differ from anonymous ones (search `8:10:60,…` vs `5:10:60,…`). Any hard-coded fallback before the first response would be wrong. Mirror PoB: block the second request until the first response's headers are parsed.

## Unverifiable from docs — must be marked as fixture-grounded or assumed in the spec

**Fixture-grounded (committed `tests/fixtures/trade2/`):**
- the search request/response shape, 100-id page, 10000 `total` cap, `complexity`;
- the fetch `{result:[{id, listing, item}]}` shape and the item/mod object shapes;
- both listing shapes (`available` → fee/no whisper; `online` → whisper);
- price `{type, amount, currency}` with `exalted`/`divine`/`chaos`;
- the anonymous weighted-search 400 body;
- anonymous `Ip` rate-limit headers for both policies;
- the anonymous `set-cookie`.

**Spike-asserted, no committed fixture:**
- logged-in weighted search 200 (complexity 180);
- `Account` rule values and logged-in Ip values (S-4);
- that the search `id` = base64url(gzip(query)) (S-3);
- `/data/leagues`, `/data/stats`, `/data/static`, `/data/items` shapes and their lack of rate-limit headers (scratchpad captures only);
- the poe.ninja response shape (scratchpad only).

**Assumed (no evidence of any kind):**
- a server-enforced maximum of 10 ids per fetch;
- the 429 body and `Retry-After` on trade2;
- the expired-cookie response;
- the logged-in over-complexity 400 message;
- 401/403/404/5xx/Cloudflare-challenge behaviour on trade2;
- fetch behaviour for delisted ids;
- fractional prices and unpriced listings;
- `pseudoMods` "Sum:" lines (need an accepted weighted query);
- the `securable` response shape;
- the meaning of a price filter with no `option` ("exalted equivalent") and its conversion basis (S-4 shows it disagrees with poe.ninja);
- the trade2 complexity budget (~200) as a stable number;
- whether poe.ninja league ids equal trade2 league ids;
- which league poe.ninja's `/poe2/api/economy/leagues` lists first;
- poe.ninja's actual rate limit (none published).

**Documented but not about trade2 (usable only by analogy):** GGG header grammar, the error envelope and code table, the `Retry-After` unit (seconds), the invalid-request threshold, and the revocation consequence.
