# Pricing

How a coordinator step prices items (slice 03 §9; D-112, D-133, D-160, D-164, D-169, D-202, D-218,
D-370…D-373, D-415, D-422, D-442, D-444, D-456, D-461). Only coordinator steps price; no other agent type has a price tool
(D-178).

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
- `mcp__pob2__get_item_price`: one item by name. Exchange items from poe.ninja; the trade site for the rest
  (D-444): whatever the currency exchange sells, by PoB's name (runes, soul cores, idols, Distilled Emotions,
  essences, omens, uncut and lineage support gems, currency and the rest of poe.ninja's exchange categories), is
  priced from poe.ninja's exchange by its category, an `Exchange value:` in the primary currency, with no trade
  request (D-387); everything else (uniques, gear and tablets) from live trade listings.
- `mcp__pob2__search_trade_items`: a search with `mods`: magic and normal items, flasks, charms, every slot of
  `m`, and a rare of `b` or `n` that is over its target (below).
- `mcp__pob2__search_stats`, `mcp__pob2__trade_query_options`: building a query. `trade_query_options {slot}`
  also lists a slot's required-mod choices with their trade ids, for `find_upgrades`; it sends no trade request.
- `mcp__pob2__get_leagues`: the leagues the trade site lists.
- `mcp__pob2__get_currency_rates` (poe.ninja's economy endpoints): currency values in divines, for totals. It is
  the one poe.ninja tool: there are no poe.ninja tools beyond the currency rates (D-335). `get_item_price`
  reads the same currency exchange for every exchange item, by its category (D-387, D-444), and sends no trade
  request for one, so an exchange item keeps its price after pricing stops (below).

Each call prices one item; there is no batch mode (D-224). Every price result, `find_upgrades`' included,
carries two lines (C-49):

```
League: <league>
Checked: YYYY-MM-DDTHH:MM:SSZ
```

The league is the price's `league`, and the date part of the `Checked:` time is the price's `date`.

## Order (D-133)

1. R1b prices each concept's key items.
   D1-build may price gear with `mcp__pob2__find_upgrades` while it designs a rare (D-444): its calls are price
   calls, logged and stopped like any pricing step's (below).
2. D1-finish, D1's last step (D-356, D-418), prices every filled slot **and every tree jewel** (D-249) of the three
   endgame rungs, entering maps, budget and non-budget (ids `m-<slot>`, `b-<slot>` and `n-<slot>`, D-281), and
   the anoint of `b` and `n` like a slot (`b-anoint`, `n-anoint`, D-358), each with the tool "Which tool"
   names. Each slot or jewel gets its own entry, except slots holding identical item text, which may share one.
3. D2 prices the campaign uniques.

Before any search, reuse an entry with the same item, query and league from any plan in this run
(D-169): the server keeps no cache.

## Which tool (D-372)

- **A rare gear slot or rare tree jewel of `b` or `n`:** `mcp__pob2__find_upgrades`, the weighted search below.
- **A unique, and an item the currency exchange sells:** `mcp__pob2__get_item_price`, by name: a rune, soul
  core or idol in a socket, each Distilled Emotion of an anoint (by the name the record's anoint recipe gives), a
  lineage support gem. **Exchange items from poe.ninja; the trade site for the rest** (D-444): players buy an
  exchange item on the currency exchange, not on the trade site, so the tool prices it from poe.ninja's exchange,
  by its category, and sends no trade request; only a unique, or an exchange item its category doesn't list
  (searched by name, and never after pricing stops), is priced from trade listings. An exchange item's price is
  its exchange value (D-387): amount and currency from the `Exchange value:` line, `query`
  `{"exchange": "<category>", "name": "<item>"}` with the category the result names. A result with an
  `Unavailable (…)` line records no price: the item is `unavailable`, its note the line's parenthesis (`Runes;
  trade site: no listings`). With `--no-ninja`, no exchange item is priced: each is `unavailable`, note `no
  poe.ninja`.
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
| `n`, non-budget | day 21 | 100–200 divines in all. Each rare has its own target, set by D1-build: by default 150 divines shared evenly over `n`'s rares and rare tree jewels (D1-finish shares it again once D1-tree's socket tests add jewels, D-453, keeping a reasoned share); a slot that carries the build (a weapon, a skill-levels amulet) may take more, with a reason; together at most 200 |

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

**Weapons by compile** (D-456). Never compare weapons by a listing's DPS: `find_upgrades` scores a listing by PoB's
Full DPS, which isn't the build's figure (D-437). For a weapon slot, re-check its top 3 weapon listings on the
build's own damage figure: each on a temporary stage (id `tmp…`) that copies the rung with that weapon, compiled
measure-only with the rung, its map figure read and the stage removed. The entry records the listing that measures
best within the budget, and its `note` says it was re-checked by compile (`fit 85%; re-checked by compile`).

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
after it. A result with a prefix records no price from its listings. A `find_upgrades` stop that the server's pace
caused after a search ran, `Stopped early: the 45 s gap between trade searches cut the loop short after <n>
search(es).` (or the cap of 7 searches in 300 s), has no prefix: the call returned the best listings of the searches
it ran, so record its first listing as any other (`ok`).

| Outcome | Means | Do |
|---|---|---|
| `ok` | a dated price | record it |
| `would_wait` | the limiter refused a wait over 60 s and sent nothing | price other items, then call this one again later |
| `locked_out` | the account is locked out | stop trade-site pricing until the user approves a retry at a gate ("After pricing stops") |
| `rate_limited` | the trade site answered 429 | stop trade-site pricing until the user approves a retry at a gate ("After pricing stops") |
| `http`, `network`, `timeout`, `no_session`, `disabled`, … | the call failed | the item is `unavailable` |
| `error` | an error without the prefix, or a stop without it that returned no listing | the item is `unavailable` |

## Pace (D-160, D-461, C-11)

**The server paces trade searches itself** (D-461): it sends a search no sooner than 45 s after the previous
search's send, at most 7 in any 300 s, beside the trade site's own windows, and waits inside the call: the limiter
waits up to 60 s and refuses a longer wait with `would_wait`, sending nothing. Listing fetches don't wait on the
floor. `mcp__pob2__find_upgrades` keeps a fixed 90 s budget from the call's arrival, so a call makes at most two
searches; when the gap cuts its weight-adjust loop short, it still returns the best listings of the searches it ran
(above, "Classifying outcomes").
- **One trade call at a time.** The pricing steps run alone, each making one trade call at a time: calls in
  parallel queue past the 60 s cap and come back `would_wait`.
- A coordinator has no clock, so it paces by order: on `would_wait`, price other items first and re-call the
  refused one later. **An item's third refusal makes it `unavailable`** (note `rate-limited`), as does the step
  ending before the item is priced. On `locked_out` or `rate_limited`, trade-site pricing stops until the user
  approves a retry at the next gate: every remaining item the trade site would price is `unavailable`, and later
  steps make no trade request ("After pricing stops", below).
- **The pricing notice** (D-461). Before a step that prices on the trade site starts (R1b, D1-build's gear
  searches, D1-finish, the D1 gate's re-price pass, D2), the runner tells the user that pricing starts, about how
  many searches it makes (the trade-site items it prices, a weighted search up to two each), that they go at least
  45 s apart (about <n> minutes), and that the user's browser shares the trade site's limit, so trade there waits
  too. Offline, and while a pricing stop is open, nothing prices on the trade site, and there is no notice.

## After pricing stops (D-415, D-422, D-444)

**The stop holds until the user approves a retry at a gate.** A step whose `priceOutcomes` counts a `locked_out` or
`rate_limited` call stops trade-site pricing: `run-log.mjs` records the stop in the run log's `pricing.stops[]
{at, step, outcome}` with that step's `stage` entry. The next gate asks first, "Pricing stopped at <step> after
<outcome>: retry?", and the runner logs the user's answer with `run-log.mjs pricing` as `pricing.retries[]
{checkpoint, answer, at}`, `retry-pricing` or `no-retry` (`checkpoints.md`, "The pricing question"). **A stop is
open** for a step when `run-log.json`'s last `pricing.stops[]` entry has no `retry-pricing` answer after it
(`retries[].at` past the stop's `at`) and no resume after it (`resumes[].lengths.stages` past its `at`): a resume
still clears a stop, so the new session prices afresh. Every pricing step reads both lists (and the runner's prompt
says so) before its first price or league call. After `retry-pricing` at the verification gate, the next pricing step
prices; at the design gate, the D1 gate's re-price pass runs before F1.

**While a stop is open, no step makes a trade-site request:** `mcp__pob2__get_leagues`, `mcp__pob2__get_item_price`
for a unique or any item the exchange doesn't sell, `mcp__pob2__search_trade_items`, `mcp__pob2__search_stats` and
`mcp__pob2__find_upgrades`. **poe.ninja's exchange stays allowed** (D-422 allows it), so every item the currency
exchange sells keeps its price: `mcp__pob2__get_item_price` for a rune, soul core, idol, Distilled Emotion, lineage
support gem or any other exchange item reads poe.ninja's exchange and sends no trade request (not with
`--no-ninja`), counted as `exchange` ("Reporting the calls"). Pass the plan's `league` in the call, so it asks
the trade site for no league. An exchange item its category doesn't list (a "Legacy of …" rune) goes to the trade
site by name, which the server doesn't try after its own limit until it restarts, even after a `retry-pricing`: its
result is `Unavailable (<category>): …`, and the item is `unavailable`. `mcp__pob2__trade_query_options` (the trade ids, from the server's
own data) stays allowed too. With a stop open:
- every item still to price that the trade site would price is `unavailable`, note `rate-limited` (or `locked
  out`), and the rung's total `unverified` (D-164);
- the plan's league is the one recorded before the stop: a plan, skeleton or price entry of this run that
  carries it (D-233); never a `get_leagues` call to check it;
- the D1 gate's final re-price pass is skipped, and its market day keeps its computation from
  `data/economy/prices.json` and the prices' dates (`gates.md`).

## The final re-price pass

Before the D1 budget verdict is final, the D1 gate step calls each rate-limited `unavailable` entry of
`plan.json` once more and updates it; a refusal leaves it `unavailable`. A weighted-search entry (its `query` has
a `target`) needs its rung loaded: compile measure-only, select the rung's loadout, and call `find_upgrades`
with the entry's arguments. The pass is skipped while a pricing stop is open, and in offline mode; after the
design gate's `retry-pricing`, it runs before F1 and prices every `unavailable` entry the stop left.

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

**In players' words** (D-442). Anything the user reads (a card's key prices, the dossier, a display, a guide, the
audit) names a currency as players do: "exalt" and "exalts", never the trade id `exalted`; "divine" and "divines";
"chaos". Plans, records and price entries keep the trade ids (`"currency": "exalted"`). **A price whose range rounds
to 0.0 divines** is shown as seen, with no conversion: `1 exalt (seen 2026-10-24)`, never "0.0–0.0 divines (seen 1
exalted)". The same holds for a rung's total (the audit's ranges, `render-audit.mjs`) and a "no rate for" line.

`gates.md` ("Price days, targets and ranges") defines the D1 gate's record of this exactly; the run checker
recomputes it from the plan's prices and `data/economy/prices.json`.

## Reporting the calls

A coordinator step counts its price-tool calls by outcome and returns the counts in one line,
`prices: ok 12, exchange 3, would_wait 1` (or `prices: none`). The runner records them as that step's
`priceOutcomes` in the run log's `stages[]` (`run-log.md`): each key `ok`, `error` or a `[trade:<kind>]` kind, and
**`exchange`** for a call `mcp__pob2__get_item_price` answered from poe.ninja's currency exchange: its result says
the item is "a currency-exchange item … priced from poe.ninja's currency exchange" and has an `Exchange value:`
line, or an `Unavailable (<category>): …` line saying the trade site isn't tried. Such a call sends no trade
request. Count an exchange call as `exchange`, never as `ok`: once pricing has stopped, the run checker fails a
step whose counts hold any key but `exchange` (D-444). An exchange item the server priced from trade listings by
its name instead (its result says so; `Unavailable (<category>; trade site: …)` when it found none) is a trade
call, counted by its outcome. The pricing steps are R1b, D1-build (its `find_upgrades`
calls), D1-finish, the D1 gate and D2. When a step's counts hold a `locked_out` or `rate_limited` call, its `stage`
entry records the stop, and the runner tells every later coordinator step so until a gate's `retry-pricing` or a
resume ("After pricing stops"). A `find_upgrades` call is a price call; `manage_sets` and `trade_query_options`
aren't.

## Offline mode (D-201, D-233)

No step calls a trade or poe.ninja tool, even if one is available. Every price is:

```json
{ "id": "b-helmet", "item": "…", "query": { "…": "…" }, "amount": null, "currency": null,
  "date": "<the run folder's date>", "league": null, "status": "unavailable", "note": "offline run" }
```

and the plan's `league` is null, which the plan schema allows only then. No step has `priceOutcomes`.
