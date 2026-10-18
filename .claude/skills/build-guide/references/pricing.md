# Pricing

How a coordinator step prices items (slice 03 §9; D-112, D-133, D-160, D-164, D-169, D-202, D-218,
D-370…D-373). Only coordinator steps price; no other agent type has a price tool (D-178).

## Never

- Never fetch pathofexile.com or poe.ninja yourself, by WebFetch, WebSearch or any other way. Prices come
  only from the server's price tools, which pace themselves within the trade site's limits (C-11).
- Never read `.env` or handle the session cookie. If trade says there is no session, the price is
  `unavailable`.
- In offline mode, never call a price tool at all (below).
- Never change or prune a design for a price (D-371): designers overestimate gear prices, and the user judges
  the cost.

## The tools (server `pob2`)

- `mcp__pob2__find_upgrades`: PoB2's weighted trade search for one slot of the loaded build, the rares of `b`
  and `n` (below).
- `mcp__pob2__manage_sets`: only `{set_type: "loadout", action: "select"}`, to load a rung before
  `find_upgrades` prices its slots.
- `mcp__pob2__get_item_price`: one item by name or base, priced from live listings: uniques. A Distilled
  Emotion, by PoB's name (`Liquid Envy`), is a currency-exchange item, not a trade listing, so the tool prices
  it from poe.ninja's currency exchange instead: an `Exchange value:` in the primary currency (D-387).
- `mcp__pob2__search_trade_items`: a search with `mods`: magic and normal items, flasks, charms, every slot of
  `m`, and a rare of `b` or `n` that is over its target (below).
- `mcp__pob2__search_stats`, `mcp__pob2__trade_query_options`: building a query. `trade_query_options {slot}`
  also lists a slot's required-mod choices with their trade ids, for `find_upgrades`; it sends no trade request.
- `mcp__pob2__get_leagues`: the leagues the trade site lists.
- `mcp__pob2__get_currency_rates` (poe.ninja's economy endpoints): currency values in divines, for totals. It is
  the one poe.ninja tool: there are no poe.ninja tools beyond the currency rates (D-335). `get_item_price`
  reads the same currency exchange for a Distilled Emotion (D-387).

Each call prices one item; there is no batch mode (D-224). Every price result, `find_upgrades`' included,
carries two lines (C-49):

```
League: <league>
Checked: YYYY-MM-DDTHH:MM:SSZ
```

The league is the price's `league`, and the date part of the `Checked:` time is the price's `date`.

## Order (D-133)

1. R1b prices each concept's key items.
2. D1-finish, D1's second step (D-356), prices every filled slot **and every tree jewel** (D-249) of the three
   endgame rungs, entering maps, budget and non-budget (ids `m-<slot>`, `b-<slot>` and `n-<slot>`, D-281), and
   the anoint of `b` and `n` like a slot (`b-anoint`, `n-anoint`, D-358), each with the tool "Which tool"
   names. Each slot or jewel gets its own entry, except slots holding identical item text, which may share one.
3. D2 prices the campaign uniques.

Before any search, reuse an entry with the same item, query and league from any plan in this run
(D-169): the server keeps no cache.

## Which tool (D-372)

- **A rare gear slot or rare tree jewel of `b` or `n`:** `mcp__pob2__find_upgrades`, the weighted search below.
- **A unique, and each Distilled Emotion of an anoint:** `mcp__pob2__get_item_price`, by the name the record's
  anoint recipe gives. An emotion's price is its exchange value (D-387): amount and currency from the
  `Exchange value:` line, `query` `{"exchange": "Delirium", "name": "<emotion>"}`.
- **A magic or normal item, a flask, a charm, and every slot of `m`:** `mcp__pob2__search_trade_items` with
  `mods`. `m` is mostly the campaign's own gear.

No item-base or mod-tier search serves crafting (D-348): the guide names mods to buy on trade.

## Targets and price days (D-370, D-371)

The reader gets the guide at league start, buys early endgame gear around day 7 and reaches late endgame two to
three weeks in. So each rung is priced for a league day, against a target:

| Rung | Price day | Target |
|---|---|---|
| `m`, entering maps | day 7 | 5 divines in all |
| `b`, budget | day 7 | about 5 divines a rare slot or rare tree jewel |
| `n`, non-budget | day 21 | 100–200 divines in all. Each rare has its own target, set by D1-build: by default 150 divines shared evenly over `n`'s rares; a slot that carries the build (a weapon, a skill-levels amulet) may take more, with a reason; together at most 200 |

- Uniques, magic items, flasks, charms and the anoint count toward a rung's total, with no target of their own.
- A rare's target travels in its entry's `query` as `target: {divines, day}` (on `n`, with `reason` when the
  slot takes more than its share), so the D1 gate and the run checker read it from the plan.
- **A target never fails a gate** (D-371). A rare whose converted range has its midpoint above its target, and
  `m`'s total above 5 divines, are `over-target` findings: information for the user, who judges the cost at the
  verification gate (the key prices on each card) and at the final gate (each rung's total and its over-target
  slots). No design goes back to D1, and none is `infeasible`, for its price.
- **An over-target rare keeps its designed item.** D1-finish may add a fallback, the entry `<id>-fallback`
  (`b-amulet-fallback`): fewer or lower required affixes, priced the same way. The guide shows it beside the
  slot, its price converted to the rung's price day like any other (the render's "Over target" sentence gives
  it), and says it isn't measured. No `basis.budget.slots` entry names a fallback, so it counts in no total.
- Still true: every filled slot and tree jewel has a price (D-249); an `unavailable` price, or a currency
  without a rate, makes the rung's total `unverified`, and the guide can't state it (D-164); offline runs price
  nothing.

## A rare of `b` or `n`: the weighted search (D-372)

PoB2's weighted search ("trade for these items") is how players search: an AND group of the affixes the item must
have, and weights for the rest. It finds the best item a budget buys. An exact search with high minimum rolls
finds a few dear items instead: dropping one low-value affix took one guide's 420–900-divine amulet search to 10
divines.

D1-build writes each such rare's entry before you price it, with `query: {slot, required, target}`: the slot as
`find_upgrades` names it (`Helmet`, `Ring 1`, `Jewel <node id>`), its **required affixes**, at most 3, each
`{affix, min}`, and its target. The required affixes are what the slot can't do without: the build's damage
type, a resistance the floor needs, skill levels. An affix PoB can't value (one it doesn't parse) is always
required, never left to the weights.

1. **Load the rung.** A measure-only compile loads the build; then select the rung's loadout,
   `mcp__pob2__manage_sets {set_type: "loadout", action: "select", title: "<the rung's loadout name, as the
   record has it>"}`, before you price its slots. Price `b`'s rares, then select `n`'s loadout and price its.
2. **The trade ids.** `mcp__pob2__trade_query_options {slot}` lists the slot's required-mod choices with their
   trade ids: map each required affix to one.
3. **The search budget** (`max_price`): the target turned into today's market, the target over the midpoint of
   its conversion factors (below, "Converting to the price day"), times the run's exalts per divine (from
   `mcp__pob2__get_currency_rates`), as a whole number. Take the factors of the under-10 row; when that puts
   the budget at 10 divines or more, take the 10-or-more row instead. With `b`'s 5-divine target on day 41 of
   a league: the under-10 row to day 7 is ×0.4–0.9, its midpoint 0.65, so 5 ÷ 0.65 ≈ 7.7 divines; at 400 exalts
   a divine, `max_price: 3077`.
4. **The call:** `mcp__pob2__find_upgrades {slot, required_mods: [{trade_id, min}, …], max_price,
   currency: "exalted_equivalent", rank_by: "stat_value", include_non_upgrades: true, fetch_pages: 1}`, plus
   `jewel_type` for a tree jewel, as `trade_query_options` gives it. Leave `sort_stats` out: the default
   weights are the build's saved trade weights, else full DPS 1 and EHP 0.5, from the stage's own calculation,
   custom modifiers included. `exalted_equivalent` counts a listing in any currency. `include_non_upgrades`
   matters: the designed item is the baseline, so few listings beat it.
5. **The price.** PoB2 writes the budget into the trade query and sorts by the weighted sum, so the first
   listing is the best item the budget buys. Its price, as listed, is the entry's `amount` and `currency`; its
   score against the designed item (the listing's `Score <its score> vs <the baseline>` line, the first over the
   second as a whole percent) is the entry's `note`, `fit 85%`.
6. **No listing fits:** the slot is over its target. Search for the cheapest listing with the required
   affixes: `mcp__pob2__search_trade_items` with the slot's item type (`jewel` for a tree jewel) and its
   required affixes as `mods`, each `{stat_id, min}` (the trade ids of step 2). The trade site sorts that search
   by price, so its first listing is the cheapest with the required affixes, and its price is the entry's.
   `note` is then `over target`. A second `find_upgrades` call can't find it: its search is sorted by the
   weighted sum, and ranking by price re-sorts only the page it fetched.
7. **The entry's `query`** keeps `slot`, `required` and `target` and adds the arguments of the call whose
   price it records: for `find_upgrades`, `required_mods`, `max_price`, `currency`, `rank_by`,
   `include_non_upgrades` and `fetch_pages`, plus `jewel_type` for a tree jewel; for the over-target search,
   its `search_trade_items` arguments (`league`, `item_type`, `mods`).

With `--no-ninja` there is no rate for `max_price`: make only the `search_trade_items` call of step 6. Each
call's league and `Checked:` date are the entry's, as for the other tools.

## Recording a price (C-31, D-237)

Each result becomes a `prices[]` entry in the plan the step writes:

```json
{ "id": "b-helmet", "item": "Life and cold-resistance helmet",
  "query": { "slot": "Helmet",
             "required": [ { "affix": "+# to maximum Life", "min": 60 }, { "affix": "+#% to Cold Resistance", "min": 25 } ],
             "required_mods": [ { "trade_id": "explicit.stat_3299347043", "min": 60 },
                                { "trade_id": "explicit.stat_4220027924", "min": 25 } ],
             "max_price": 3077, "currency": "exalted_equivalent", "rank_by": "stat_value",
             "include_non_upgrades": true, "fetch_pages": 1, "target": { "divines": 5, "day": 7 } },
  "amount": 600, "currency": "exalted", "date": "2026-10-15", "league": "Forbidden Rites", "status": "ok",
  "note": "fit 85%" }
```

- `id` (`[A-Za-z0-9_-]+`, unique in the plan) is what a `price:<id>` claim cites.
- `league` equals the plan's `league`.
- `query` is the call's query or arguments; a rare of `b` or `n` adds `required` and `target`.
- An `unavailable` entry has `amount` and `currency` null and a `note` giving the reason: `offline run`,
  `rate-limited`, `trade disabled`, `no session cookie`, ….

## Classifying outcomes (D-218)

An error from these tools reads `Error: [trade:<kind>] Failed to <action>: <message>`. `find_upgrades` names a
stop for a trade-site limit as `Stopped early: [trade:<kind>] <reason>.`. Classify a result by the `<kind>` in
its `[trade:<kind>]` prefix, wherever the prefix appears in the line, and nothing else; never parse the prose
after it. A result with a prefix records no price from its listings.

| Outcome | Means | Do |
|---|---|---|
| `ok` | a dated price | record it |
| `would_wait` | the limiter refused a wait over 30 s and sent nothing | price other items, then call this one again later |
| `locked_out` | the account is locked out | stop pricing for the rest of the run |
| `rate_limited` | the trade site answered 429 | stop pricing for the rest of the run |
| `http`, `network`, `timeout`, `no_session`, `disabled`, … | the call failed | the item is `unavailable` |
| `error` | an error, or a stop, without the prefix | the item is `unavailable` |

## Pace (D-160, C-11)

The limiter sleeps through a wait of 30 s or less inside the call, and refuses a longer one with
`would_wait`, sending nothing. A coordinator has no clock, so it paces by order: on `would_wait`, price
other items first and re-call the refused one later. **An item's third refusal makes it `unavailable`**
(note `rate-limited`), as does the step ending before the item is priced. On `locked_out` or
`rate_limited`, stop pricing for the rest of the run: every remaining item is `unavailable`, and later
steps make no price call.

## The final re-price pass

Before the D1 budget verdict is final, the D1 gate step calls each rate-limited `unavailable` entry of
`plan.json` once more and updates it; a refusal leaves it `unavailable`. A weighted-search entry (its `query` has
a `target`) needs its rung loaded: compile measure-only, select the rung's loadout, and call `find_upgrades`
with the entry's arguments. The pass is skipped once pricing has stopped, and in offline mode.

## Converting to the price day (D-373)

Prices stay in `plan.json` as seen: the conversion is reporting only, so a re-price on another day needs no
migration. Totals convert to divines with `mcp__pob2__get_currency_rates`, and the D1 gate records the rates it
used (`gates.md`). If the rates are unavailable, totals are `unverified`; so with `--no-ninja`, which calls no
tool in group `ninja` (D-333), every total is `unverified`.

**The market's league day** is the date the prices were seen less the league's start date, from the league
table in `data/economy/prices.json` (the `league.*` facts: `name`, `start`, and `end` for a league that ended). A
market past day 60, or in a league whose end date has passed, reads as **late**. A league not in the table
converts as days 21–60, and the guide says its day is unknown.

**The conversion table** (the same file's `conversion.*` facts, a `judgment` of confidence L from the pricing
study, `docs/build-guide/studies/2026-10-16-pricing.md`), by the item's price in divines when seen:

| Item's price when seen | To day 21 | To day 7 |
|---|---|---|
| Under 10 divines | ×0.6–0.85 | ×0.4–0.9 |
| 10 divines or more | ×0.5–0.85 | ×0.2–0.4 |
| Seen late in a league (past day 60) or after it ended | the row above, then ÷2–4 | the row above, then ÷2–4 |

- For a market before day 21 no conversion applies: the factors are 1, and the guide says the prices are from an
  early market.
- **An entry's range** is its price in divines times each end of its row's factors (late: the low factor over 4,
  the high over 2). **A total is a range:** the entries' lows summed and their highs summed, each end rounded to
  a whole divine at 10 or more and to one decimal under 10.
- **A rung's price day** is its target's: `m` and `b` day 7, `n` day 21.

`gates.md` ("Price days, targets and ranges") defines the D1 gate's record of this exactly; the run checker
recomputes it from the plan's prices and `data/economy/prices.json`.

## Reporting the calls

A coordinator step counts its price-tool calls by outcome and returns the counts in one line,
`prices: ok 12, would_wait 1` (or `prices: none`). The runner records them as that step's `priceOutcomes`
in the run log's `stages[]` (`run-log.md`): each key `ok`, `error` or a `[trade:<kind>]` kind. Once any
step's counts hold a `locked_out` or `rate_limited` call, pricing has stopped for the rest of the run, and
the runner tells every later coordinator step so. A `find_upgrades` call is a price call; `manage_sets` and
`trade_query_options` aren't.

## Offline mode (D-201, D-233)

No step calls a trade or poe.ninja tool, even if one is available. Every price is:

```json
{ "id": "b-helmet", "item": "…", "query": { "…": "…" }, "amount": null, "currency": null,
  "date": "<the run folder's date>", "league": null, "status": "unavailable", "note": "offline run" }
```

and the plan's `league` is null, which the plan schema allows only then. No step has `priceOutcomes`.
