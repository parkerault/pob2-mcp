# Spike S-4: does a logged-in session lift trade2's weighted-query rejection?

Date: 2026-10-03. League: Runes of Aldur. Pinned PoB2 `v0.23.1`, test build `Grenadator.xml`.
Requests sent: **2** (1 search, 1 fetch). User-Agent `pob2-mcp-server/0.1`, plus the user's own `POESESSID`
cookie, read from the repo's gitignored `.env` by the script itself. The cookie was never put on a
command line, printed, or saved anywhere. **[V]** = verified.

## Verdict: PASS

Spikes S-1 and S-3 got HTTP 400 for this exact weighted query when sent anonymously. **With the
cookie, trade2 accepted it** [V]:

| | Result |
|---|---|
| Search | HTTP **200**, 698 ms, `total` 8,354, `complexity` **180**, 100 ids |
| Fetch (top 10) | HTTP 200, 10 items |
| Engine evaluation of the 10 (S-1 shim, `augmentBehaviour: copy`) | 538 ms total: parse 120 ms, calc 323 ms |

The query was S-1's generated Body Armour query (`S-1-prototype/q_body.json`), with
`sort: {"statgroup.0": "desc"}` added. It has 29 weighted filters with min sum 82.1, one required-mod
`and` filter, a max price of 200 (Exalted-equivalent), max level 80, non-unique, and not mirrored.
Complexity 180 is close to the ~200 budget that S-1 estimated even for logged-in users, so the
TypeScript side still needs to fit queries to that budget (D-5).

## Logged-in rate limits (new: an `Account` rule on top of `Ip`) [V]

| Policy | `X-Rate-Limit-Rules` | Account | Ip (logged in) |
|---|---|---|---|
| `trade-search-request-limit` | `Account,Ip` | `3:5:60` | `8:10:60,15:60:120,60:300:1800,600:10800:3600` |
| `trade-fetch-request-limit` | `Account,Ip` | `6:4:10` | `12:4:60,16:12:60,100:300:300,1000:10800:1800` |

The Ip limits differ from the anonymous ones S-3 recorded (e.g. search was `5:10:60,15:60:300,…`).
The limiter must parse the rules from the headers on every response; it can't hard-code them. The
binding constraint for a logged-in user is **3 searches per 5 s per account**.

## Engine re-rank of the trade2 top 10 (weights: FullDPS 1.0, TotalEHP 0.5; no change = 1.5)

| PoB score | Item | Price | FullDPS | TotalEHP | Life | ChaosRes |
|---|---|---|---|---|---|---|
| 1.507 | Corruption Shelter, Sacrificial Regalia | 50 ex | +8,281 (+3.8%) | −740 (−6.3%) | −185 | −21 |
| 1.491 | Vortex Cloak, Sacrificial Regalia | 2 chaos | +8,281 (+3.8%) | −1,101 (−9.3%) | −143 | −44 |
| 1.491 | Eagle Shelter, Sacrificial Regalia | 10 ex | +15,357 (+7.0%) | −1,874 (−15.8%) | −73 | −33 |
| … | (7 more, all below 1.49) | | | | | |
| 1.462 | Beast Shroud, Sacrificial Regalia | 30 ex | +15,357 (+7.0%) | −2,562 (−21.7%) | −101 | −44 |

Observations [V]:
- **trade2's weighted order ≠ engine order.** trade2 sorts by the weighted sum of mod values. It
  can't see the base type or what the current item already provides. Here, 9 of the top 10 by
  weighted sum are net downgrades for this build. They lose armour/EHP against the equipped chest,
  which is armour-based, while these are Sacrificial Regalia. So **engine re-ranking is
  essential**, and `find_upgrades` should fetch more than one page (S-1 suggested 30–50) before
  ranking. At `6:4:10` per account, 50 items is 5 fetches, about 4 s.
- Prices come in several currencies in one result set (`2 chaos` next to `50 exalted`), so they
  must be normalized (D-11) before ranking by value per cost.

## Consequences for the spec

- **D-15 resolved by the user:** the session cookie is read from the repo's gitignored `.env`
  (`POESESSID=…`). The user accepts a cookie on disk for this single-user project. When the cookie
  is missing or expired, `find_upgrades` falls back to the trade-site link
  (`trade2/search/poe2/<league>?q=<query>`) for the user to open in a logged-in browser.
- **Detecting an expired cookie:** an invalid cookie is probably treated as anonymous, so the
  symptom would be the same 400 "Query is too complex… Logging in will increase this limit" (error
  code 2) [I: not tested; we have no expired cookie to test with]. Treat error code 2 on a weighted
  query as "session missing/expired": fall back to the link and tell the user to refresh
  `POESESSID`.
- The server must load `.env` itself. MCP hosts don't load it, and Node ≥ 20.12 has
  `process.loadEnvFile()`, so no dependency is needed. Resolve the path from the package root,
  not the cwd.
- The env var name is `POESESSID` (the user's choice). The legacy `POE_SESSION_ID` is accepted as an
  alias.

Script: kept in the session scratchpad only, because it reads the cookie. Its essentials: read
`.env`, POST the query with `Cookie: POESESSID=…`, fetch the top 10 with `?query=<id>&realm=poe2`,
then feed the fetch body to `S-1-prototype/run.lua` with an `evaluate` request. The raw fetch
response was not committed (it contains third-party seller data).
