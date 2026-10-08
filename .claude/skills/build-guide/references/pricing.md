# Pricing

How a coordinator step prices items (slice 03 §9; D-112, D-133, D-160, D-164, D-169, D-202, D-218,
D-219). Only coordinator steps price; no other agent type has a price tool (D-178).

## Never

- Never fetch pathofexile.com or poe.ninja yourself, by WebFetch, WebSearch or any other way. Prices come
  only from the server's price tools, which pace themselves within the trade site's limits (C-11).
- Never read `.env` or handle the session cookie. If trade says there is no session, the price is
  `unavailable`.
- In offline mode, never call a price tool at all (below).

## The tools (server `pob2`)

- `get_item_price`: one item by name or base, priced from live listings.
- `search_trade_items`: a search with `mods`, for a rare as an affix target.
- `search_stats`, `trade_query_options`: building a query.
- `get_leagues`: the leagues the trade site lists.
- `get_currency_rates` (poe.ninja): currency values in divines, for totals.

Each call prices one item; there is no batch mode (D-224). Every price result carries two lines (C-49):

```
League: <league>
Checked: YYYY-MM-DDTHH:MM:SSZ
```

The league is the price's `league`; the `Checked:` time is the call's `at` in the run log, and its date
is the price's `date`.

## Order (D-133)

1. R1b prices each concept's key items.
2. D1 prices every filled slot **and every tree jewel** (D-249) of both endgame variants, with rares as
   affix-target searches (`search_trade_items` with `mods`). Each slot or jewel gets its own entry, except
   slots holding identical item text, which may share one.
3. D2 prices the campaign uniques.

Before any search, reuse an entry with the same item, query and league from any plan in this run
(D-169): the server keeps no cache.

## Recording a price (C-31, D-237)

Each result becomes a `prices[]` entry in the plan the step writes:

```json
{ "id": "b-helmet", "item": "Life and cold-resistance helmet", "query": { "query": { "…": "…" } },
  "amount": 150, "currency": "exalted", "date": "2026-10-08", "league": "Forbidden Rites", "status": "ok" }
```

- `id` (`[A-Za-z0-9_-]+`, unique in the plan) is what a `price:<id>` claim cites.
- `league` equals the plan's `league`.
- An `unavailable` entry has `amount` and `currency` null and a `note` giving the reason: `offline run`,
  `rate-limited`, `trade disabled`, `no session cookie`, ….

## Classifying outcomes (D-218)

An error from these tools reads `Error: [trade:<kind>] Failed to <action>: <message>`. Classify it by
the `<kind>` in the prefix and nothing else; never parse the prose after it.

| Outcome | Means | Do |
|---|---|---|
| `ok` | a dated price | record it |
| `would_wait` | the limiter refused a wait over 30 s and sent nothing | price other items, then call this one again later |
| `locked_out` | the account is locked out | stop pricing for the rest of the run |
| `rate_limited` | the trade site answered 429 | stop pricing for the rest of the run |
| `http`, `network`, `timeout`, `no_session`, `disabled`, … | the call failed | the item is `unavailable` |
| `error` | an error without the prefix | the item is `unavailable` |

## Pace (D-160, C-11)

The limiter sleeps through a wait of 30 s or less inside the call, and refuses a longer one with
`would_wait`, sending nothing. A coordinator has no clock, so it paces by order: on `would_wait`, price
other items first and re-call the refused one later. **An item's third refusal makes it `unavailable`**
(note `rate-limited`), as does the step ending before the item is priced. On `locked_out` or
`rate_limited`, stop pricing for the rest of the run: every remaining item is `unavailable`, and later
steps make no price call.

## The final re-price pass

Before the D1 budget verdict is final, the D1 gate step calls each rate-limited `unavailable` entry of
`plan.json` once more and updates it; a refusal leaves it `unavailable`. The pass is skipped once pricing
has stopped, and in offline mode.

## Divines and the budget (D-116, D-117, D-219)

Totals convert with `get_currency_rates`. The D1 gate records the rates it used (`gates.md`). If the
rates are unavailable, totals are `unverified`.

- Budget variant, slots and tree jewels together (D-249), the total rounded to 2 decimals: **at most 20
  divines passes; above 20 and at most 22 passes, and the guide says "near the ceiling"; above 22
  fails.**
- Non-budget variant: reported against the ~200-divine reference, never gated.
- A variant with any `unavailable` slot price can't be claimed to be under budget; the guide and
  checkpoint 2 say so (D-164).

## Reporting the calls

A coordinator step returns every price-tool call it made as `priceCalls`:
`[{at, stage, tool, item, outcome}]`, with `at` the `Checked:` time or `null` for an error. The skill
appends them to the run log's `pricing.calls` (`run-log.md`).

## Offline mode (D-201, D-233)

No step calls a trade or poe.ninja tool, even if one is available. Every price is:

```json
{ "id": "b-helmet", "item": "…", "query": { "…": "…" }, "amount": null, "currency": null,
  "date": "<the run folder's date>", "league": null, "status": "unavailable", "note": "offline run" }
```

and the plan's `league` is null, which the plan schema allows only then. `priceCalls` is empty.
