# Pricing

How a coordinator step prices items (slice 03 §9; D-112, D-133, D-160, D-164, D-169, D-202, D-218,
D-370…D-373, D-415, D-422, D-442, D-444, D-456, D-461, D-464, D-465, D-471, D-472, D-473, D-474; amendment 14: D-483,
D-484, D-486, D-494). Only coordinator steps price; no other agent type has a price tool (D-178), and D1-tree makes no
trade call at all (D-490).

## Never

- Never fetch pathofexile.com or poe.ninja yourself, by WebFetch, WebSearch or any other way. Prices come
  only from the server's price tools, which pace themselves within the trade site's limits (C-11).
- Never read `.env` or handle the session cookie. If trade says there is no session, the price is
  `unavailable`.
- In offline mode, never call a price tool at all (below).
- Never change or prune a design for a price (D-371): designers overestimate gear prices, and the user judges
  the cost. The one exception is a rare's affixes (D-483): the spec loop (below) sets their tiers, and drops the least
  important, for the rare's price; a unique, a gem or a mechanic the build rests on never goes for a price.
- Never write a listing's lines into a plan, and never rewrite an item to match a listing (D-483): a rare is a spec,
  priced by the depth of the market for it. No step's brief asks for a listing match.

## The tools (server `pob2`)

- `mcp__pob2__find_upgrades`: PoB2's weighted trade search for one slot of the loaded build, the rares of `b`
  and `n` (below). With `link_only: true` it sends no request (D-494): its reply is PoB's ranking of the slot's affixes,
  `Ranking (PoB's order: gain at the middle roll, weight per point): <affix> <gain> <w>; …` (the top 12), and the
  search's link, last.
- `mcp__pob2__manage_sets`: only `{set_type: "loadout", action: "select"}`, to load a rung before
  `find_upgrades` prices its slots.
- `mcp__pob2__get_item_price`: one item by name. Exchange items from poe.ninja; the trade site for the rest
  (D-444): whatever the currency exchange sells, by PoB's name (runes, soul cores, idols, Distilled Emotions,
  essences, omens, uncut and lineage support gems, currency and the rest of poe.ninja's exchange categories), is
  priced from poe.ninja's exchange by its category, an `Exchange value:` in the primary currency, with no trade
  request (D-387); everything else (uniques, gear and tablets) from live trade listings.
- `mcp__pob2__search_trade_items`: a search with `mods`, sorted by price, anonymous (no session cookie): a rare's
  depth check (below), magic and normal items, every slot of `m`, a unique whose corruption or sockets matter
  (`item_name`, `corrupted`, `min_rune_sockets`, D-484), and a unique jewel by the line it allocates (below). Its reply
  gives `Found: <the search's total> | Showing: <n>` and the listings cheapest first, each with its `Rune sockets:` and
  `(Corrupted)` when it has them.
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
   calls, logged and stopped like any pricing step's (below). **In a revision-14 run D1-build prices every rare gear
   slot of `b` and `n` as it designs it, by the spec loop** (D-483, "A rare of `b` or `n`" below), so D1-tree measures
   items the budget buys.
2. D1-finish, D1's last step (D-356, D-418), prices every filled slot **and every tree jewel** (D-249) of the three
   endgame rungs, entering maps, budget and non-budget (ids `m-<slot>`, `b-<slot>` and `n-<slot>`, D-281), and
   the anoint of `b` and `n` like a slot (`b-anoint`, `n-anoint`, D-358), each with the tool "Which tool"
   names. Each slot or jewel gets its own entry, except slots holding identical item text, which may share one.
   In a revision-14 run it runs the loop's steps 4 to 10 on D1-tree's rare jewels, and re-prices each rare's spec as
   compiled by one depth check (reusing D1-build's entry while its query and league are the same, D-169); it never
   re-runs the loop on a gear slot, and never rewrites an item to a listing.
   **No Flask slot is priced** (D-472: a plain flask costs nothing worth counting), and **a pinned weapon's Swap
   slot** (`sameAs`, D-464) has no entry of its own: its set-1 slot's entry prices it once.
3. D2 prices the campaign uniques.

Before any search, reuse an entry with the same item, query and league from any plan in this run
(D-169): the server keeps no cache.

## Which tool (D-372, D-483)

- **A rare gear slot or rare tree jewel of `b` or `n`:** `mcp__pob2__find_upgrades` to rank its affixes
  (`link_only`) and for the budget search, and `mcp__pob2__search_trade_items` for its depth checks: the spec loop
  below. `m`'s rares are specs too, priced by a depth check alone (below).
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
- **A magic or normal item, and every slot of `m`:** `mcp__pob2__search_trade_items` with `mods`. `m` is mostly
  the campaign's own gear. No flask (unpriced, D-472) and no charm (the charm slots stay empty).
- **A corrupted unique is priced uncorrupted** (D-471): by name, without the corrupted line as a required affix,
  its `note` `priced uncorrupted: buy copies and corrupt until one rolls <line>`; the budget doesn't count the
  corruption. This is the cheap unique's rule: one under 1 divine uncorrupted may carry a corruption outcome, an
  implicit or an extra socket, and the guide tells the player to corrupt copies. A unique priced at or over
  `references/corruption.json`'s line (1 divine, at the run's rates) can't carry a corrupted line (D1-finish returns it
  to D1-build), but for the extra socket below. With no price to judge by (offline, an `unavailable`
  price, a pricing stop, `--no-ninja` with no rates) the line stays, and the `note` adds `cheapness unchecked:
  <why>` (offline, `offline run` says it). A gem corrupted to +1 level is priced as the gem.
- **A unique that isn't cheap, bought corrupted with an extra socket** (D-484, the user's ruling of 2026-11-02:
  "extra sockets allowed within budget, corruption implicits out"): allowed when that corrupted copy is in budget,
  and priced as it, by the depth rule (below): `mcp__pob2__search_trade_items {league, item_name, corrupted: true,
  min_rune_sockets: <the plan's count>, limit: 10}`. Its corruption implicits never enter `m`, `b` or `n`; one may be
  a find over the budget (`trades.json`, kind `scaling`, D-486), which the guide's late endgame scaling section names.
- **A unique by name, unless its corruption or sockets matter** (D-484): `mcp__pob2__get_item_price` can't filter or
  show either, so a unique whose plan copy is corrupted (but under the cheap rule above) or holds more sockets than
  its own goes to `mcp__pob2__search_trade_items` with `item_name`, `corrupted` (as the plan's copy) and
  `min_rune_sockets` (the plan's count, when above the unique's own), priced by the depth rule.
- **A random-roll unique** (Morior Invictus, D-483): its figures rest on rolled lines, so price it by
  `mcp__pob2__search_trade_items {item_name, corrupted: <as the plan's copy>, min_rune_sockets: <the plan's count when
  above the unique's own>, mods: [<each line the figures rely on, at its range's midpoint>]}`, by the depth rule.
  PoB's default roll is the midpoint (`Modules/Main.lua`:105), so the plan's text and the query agree; a copy with a
  wanted corruption is an outlier, never the price.
- **A unique jewel** (D-473): by name (`mcp__pob2__get_item_price`), or, for one that allocates a notable
  (Megalomaniac's "Allocates <notable>"), by `mcp__pob2__search_trade_items` on the line it allocates, with **no
  `target` in its query** (a target sends it to the weighted search); its share of the budget (`b` 5 divines like
  a rare jewel, `n` its share) goes in its `note`. The option-form stat is unverified until the live test: an
  `unavailable` price with its note is expected.
- **No rune over the budget** (D-465): a "Legacy of …" soul core or the Raven-Touched Shard is never priced, on the
  trade site or the exchange, unless the brief asks for it (its `around`, `like` or `notes`, or a gate answer's
  words): no plan holds one without that say.

No item-base or mod-tier search serves crafting (D-348): the guide names mods to buy on trade.

**Price notes** (D-473, from the finishing-touches study): **fractured lines** are priced as plain explicit mods
(never the fractured filter), the roll loosened one tier; **unique jewels** by what they allocate; and the usual
**price drivers** are +3 or more skill levels with only the top matching damage lines, and amulets with Spirit,
crit and defences, so a slot that carries them may take more than its even share.

## Targets and price days (D-370, D-371)

The reader gets the guide at league start, buys early endgame gear around day 7 and reaches late endgame two to
three weeks in. So each rung is priced for a league day, against a target:

| Rung | Price day | Target |
|---|---|---|
| `m`, entering maps | day 7 | 5 divines in all |
| `b`, budget | day 7 | about 5 divines a rare slot or rare tree jewel |
| `n`, non-budget | day 21 | 100–200 divines in all. Each rare has its own target, set by D1-build: by default 150 divines shared evenly over `n`'s rares and rare tree jewels (D1-finish shares it again once D1-tree's socket tests add jewels, D-453, keeping a reasoned share); a slot that carries the build (a weapon, a skill-levels amulet) may take more, with a reason; together at most 200 |

- Uniques, magic items and the anoint count toward a rung's total, with no target of their own; flasks are
  unpriced (D-472), and a corrupted unique counts uncorrupted (D-471).
- A rare's target travels in its entry's `query` as `target: {divines, day}` (on `n`, with `reason` when the
  slot takes more than its share), so the D1 gate and the run checker read it from the plan.
- **A target never fails a gate** (D-371). A rare whose converted range has its midpoint above its target, and
  `m`'s total above 5 divines, are `over-target` findings: information for the user, who judges the cost at the
  verification gate (the key prices on each card) and at the final gate (each rung's total and its over-target
  slots). No design goes back to D1, and none is `infeasible`, for its price.
- **An over-target rare** (D-483, which supersedes D-371's "an over-target slot keeps its designed item" for rares):
  the spec loop lowers its least important must-have a tier, then drops it, until a depth check fits the target, and
  the dearer spec it started from becomes a find over the budget (`trades.json`, kind `scaling`, D-486), shown at the
  design gate and, on request, in the guide's late endgame scaling section. A revision-14 build writes no
  `<id>-fallback` entry (the run checker's `budget` fails one). A build whose last D1 gate ran before revision 14
  keeps its older entries: there an over-target rare kept its designed item, and D1-finish may have added
  `<id>-fallback` with fewer or lower required affixes, which the guide shows beside the slot and no total counts.
- Still true: every filled slot and tree jewel has a price (D-249); an `unavailable` price, or a currency
  without a rate, makes the rung's total `unverified`, and the guide can't state it (D-164); offline runs price
  nothing. A slot the loop left thin, with no other source of its stat, is `unavailable` with `note` `thin:
  <count>` (D-483), shown at the gate.

## A rare of `b` or `n`: the spec loop (D-483)

A rare is priced as a **spec**, never as one listing. The user (2026-11-01): "you can't base a build guide on an item
that only has one listing ... A build guide has to be flexible enough that any player could implement it from whatever
is currently available." A rare's spec is its base, its **must-haves** (the 3 or 4 affixes its figures rely on), each
at a **tier** (the game's numbering: T1 the best the base can roll), and the weights that ranked them; whatever else a
listing has is accepted. Its price is the **depth price**: the 5th-cheapest of at least 10 listings of a search for its
must-haves, sorted by price. No slot is priced from fewer than 10 listings. The search's count and the price's place in
it are the entry's `listing`, and the spec is its `spec` ("Recording a price").

- **The rung's item level** for tiers is 69 on `m` and 82 on `b` and `n` (amendment 14's choice: `b`'s 35% boots need
  82); a campaign stage's is its C1 area level. A must-have's **best tier allowed** is the best tier PoB's mod data
  lets the base roll at that item level; its **floor** is two tiers under it (T3 when T1 is allowed); a tier's
  **lowest roll** is the low end of its range.
- **Who** (D-444): D1-build runs the loop for each rare gear slot of `b` and `n` while it designs it, so D1-tree
  measures items the budget buys and its targets aren't stranded by a later gear change; D1-finish runs steps 4 to 10
  for D1-tree's rare jewels, and re-prices each spec as compiled by one depth check. `m`'s rares are specs too, their
  must-haves at their floor tiers' lowest rolls, priced by one depth check (step 5's call) with no `spec` field (a
  `spec` is a `b` or `n` rare's); `m`'s other slots go by `mcp__pob2__search_trade_items` with `mods`, as above.

1. **Rank** (no request). Load the rung: a measure-only compile with the slot's base in the slot, then select the
   rung's loadout, `mcp__pob2__manage_sets {set_type: "loadout", action: "select", title: "<the rung's loadout name,
   as the record has it>"}`. Call `mcp__pob2__find_upgrades {slot, link_only: true, sort_stats: <the weights>,
   weight_corrupted_mods: false, league}`, plus `jewel_type` for a tree jewel, as `mcp__pob2__trade_query_options`
   gives it: it ranks the slot's item class's affixes in PoB's order (the gain at the middle roll), each with its
   weight per point, the top 12. **The weights** are `FullDPS` 1 and `TotalEHP` 0.5, plus the stats this build needs
   from PoB's list (`Spirit` for its reservations, `ManaRegen` for its sustain, `Str`, `Dex` or `Int` for a
   requirement, `EffectiveMovementSpeedMod` on boots), each with a one-line `why`. **But for a slot that serves a
   set-2 skill** (D-473; `pieces.md`'s `## Skill levels`), pass `sort_stats` weighting that skill, from the stats
   `trade_query_options` lists: the default weights read the main skill.
2. **The base and its tiers.** PoB ranks per item class, so look each ranked affix up,
   `mcp__pob2__lookup_game_data {mode: "mechanic", query: <the affix text>, kind: "mod"}`: its `Base types:` say
   whether the base can roll it (drop it when it can't), and its tiers, `  Tiers on <bases> (this mod: T<n>):` then
   `    T<n> (item level <l>): <range>`, give the best tier allowed at the rung's item level, the floor and each
   tier's lowest roll. **PoB's top 4** are the first four in PoB's order that the base can roll.
3. **The must-haves**: 3 or 4, from the top of the ranking. Add what PoB scores at zero but the build needs (an
   effect PoB doesn't model, a requirement, the boots' movement speed, D-440), marked `zeroScored: true`, and keep
   prefixes and suffixes legal (at most 3 and 3; 2 and 2 on a rare jewel). A must-have outside PoB's top 4 carries a
   one-line `why`, and each of PoB's top 4 left out goes in `leftOut` with its `why`. **A must-have PoB scores at zero
   is always required, and never lowered or dropped for its importance** (D-372's "an affix PoB can't value is always
   required", kept); the boots' movement speed holds its rung's tier the same way (D-440). List them most important
   first, a zero-scored one first: the trade link requires the first three (D-488).
   `mcp__pob2__trade_query_options {slot}` lists the slot's required-mod choices with their trade ids: map each
   must-have to one.
4. **Importance** is the loss of one tier step: the must-have's weight per point × (this tier's lowest roll − the
   next tier's lowest roll), from the ranking, with no extra compile.
5. **`n` first, at T1.** `n`'s must-haves start at their best tier allowed, and its first search is a **depth
   check** there: `mcp__pob2__search_trade_items {league, item_type: <the base>, mods: [<each must-have's trade id,
   min its tier's lowest roll>], corrupted: false, min_rune_sockets: <the base's standard count, when above 0>,
   limit: 10}`, sorted by price. With at least 10 found and the 5th cheapest within `n`'s target, that is `n`'s
   price, one trade search. When `b`'s must-haves are the same and that 5th cheapest is within `b`'s target too, `b`
   takes it.
6. **The budget search** (`b`, and `n` when its first check fails): `mcp__pob2__find_upgrades {slot, required_mods:
   <the 3 most important must-haves at their floor tiers' lowest rolls, a zero-scored one always among them>,
   sort_stats: <the weights, which carry a 4th>, weight_corrupted_mods: false, include_non_upgrades: true, max_price,
   currency: "exalted_equivalent", fetch_pages: 1, rune_behaviour: "remove", min_empty_rune_sockets: <the base's
   standard count, when above 0>, league}` (one call, usually two trade searches). Each listing names its required
   affixes' tiers, `tiers: <affix> T<n>, …` (`T1+T2` on a line that merges two mods). Set each must-have to the best
   tier at which at least 5 of the listings under the budget meet all of them together: the best mix the budget buys.
   `include_non_upgrades` matters: the compiled rare is the baseline, so few listings beat it.
7. **The depth check** at that mix (one trade search, as in step 5): at least 10 found and the 5th cheapest within
   the target prices the slot.
8. **Over the target or thin** (fewer than 10 found): lower the least important must-have one tier (never under its
   floor, never a zero-scored one) and check depth again; with every such must-have at its floor, drop the least
   important one and record `another source of <stat>: <where>` (another slot, the tree, a unique), which the
   designer takes or the gate shows. **At most 5 trade searches a slot**, the budget search counting as 2. Past the
   cap, or with nothing left to lower or drop, the designer moves the stat to another source; with none, the slot's
   entry is `unavailable`, `note` `thin: <count>`, and the gate shows it.
9. **The compiled rare** holds its must-haves at the tiers the loop ended at, each line at its tier's lowest roll (so
   every listing found meets the PoB file's figures), with its base's implicit lines and its runes in its sockets,
   and nothing else, titled by its key affixes (D-489).
10. **The dearer spec** the loop started from (before a tier was lowered or an affix dropped) is the slot's find over
    the budget (`trades.json`, kind `scaling`, D-486) when it gains anything; the design gate shows the largest 3 a
    rung.

- **`max_price`** (D-373), the search budget: the target turned into today's market, the target over the midpoint of
  its conversion factors (below, "Converting to the price day"), times the run's exalts per divine (from
  `mcp__pob2__get_currency_rates`), as a whole number. Take the factors of the under-10 row; when that puts the
  budget at 10 divines or more, take the 10-or-more row instead. With `b`'s 5-divine target on day 41 of a league:
  the under-10 row to day 7 is ×0.4–0.9, its midpoint 0.65, so 5 ÷ 0.65 ≈ 7.7 divines; at 400 exalts a divine,
  `max_price: 3077`. A depth check is within the target when its 5th cheapest is at most that budget.
  `exalted_equivalent` counts a listing in any currency.
- **`rune_behaviour: "remove"`** on every pricing call of `mcp__pob2__find_upgrades`: its default, `copy`, puts the
  plan's runes, and sockets up to the plan's count, on every listing (`Classes/ItemsTab.lua`:1761–1763), so the scores
  would read the plan's item, not the listing.
- **Sockets** (D-484): a rare's searches ask for its base's standard rune sockets (`data/items/sockets.json`: none on
  jewellery, belts and quivers), never the Exceptional extra, so the price, the listing and the trade link describe one
  item.
- **When the loop can't run:**
  - **offline**, or without the trade tools: no ranking (`ranking: null`, `searches: 0`); the designer picks the
    must-haves with their reasons (the run checker holds no `why` or `leftOut` rule on that spec), and the rares
    compile at their floor tiers' lowest rolls, every price `unavailable` (note `offline run`);
  - **a pricing stop open** ("After pricing stops"): `link_only` sends no request, so the ranking stays allowed; no
    search runs; the rares compile at the tiers the loop reached, else their floors, and their entries are
    `unavailable`, as today;
  - **no session cookie** (`find_upgrades` returns only its link, "Classifying outcomes"): the loop runs as depth
    checks alone, which search anonymously, from the best tier allowed down one step at a time, within the cap;
  - **`--no-ninja`**: no rate turns a target into a `max_price`, so no budget search: one depth check a spec, at its
    floor tiers on `b` and its best tiers allowed on `n`, recorded as seen, and the totals are `unverified` (D-333).
- **Re-pricing a spec**: D1-finish's re-price and the D1 gate's final re-price pass price a spec as compiled, by one
  depth check at its must-haves' tiers (its `query`'s call); the loop never runs again.
- **Weapons by compile** (D-456). Never compare weapons by a listing's DPS: `find_upgrades` scores a listing by PoB's
  Full DPS, which isn't the build's figure (D-437). Compare weapon specs, never listings: each candidate (a base and
  its must-haves at their tiers) on a temporary stage (id `tmp…`) that copies the rung with that weapon, compiled
  measure-only with the rung, its map figure read and the stage removed; the loop prices the one that measures best,
  and its `note` says it was re-checked by compile. A listing's lines never enter a plan.
- **An edited item** (D-479): an item the user edited in a PoB file the server read back is taken literally, its
  lines as written; its price is the depth price of a search for its lines at their values (the four heaviest by the
  slot's weights when it has more), `mcp__pob2__search_trade_items` with them as `mods`.
- **Campaign gear late in a league** (D2; the user, 2026-11-02): from about the second week of a league, players on
  their second characters "drive up the prices of the best gear usable at low levels": "a T8 item at item level 20
  will be nearly as expensive as a T1 or T2 item at item level 82". Low-level gear's price tracks the best tier its
  item level allows, not a levelling player's wealth, so campaign rares use two or three affixes, and a late-league
  price for low-level gear is read as that, not as the league-start price the day conversion assumes.
- **The volume** (R-76): a `b` slot usually takes 3 trade searches (the budget search's two and a depth check), an
  `n` slot usually 1, at most 5 a slot: about 20 to 35 a build, 15 to 26 minutes at the 45 s pace (D-461). The
  pricing notice counts them before the step starts ("Pace").

## Recording a price (C-31, D-237, D-484)

Each result becomes a `prices[]` entry in the plan the step writes. A rare of `b` or `n`, priced by its spec's depth
check (schema 10):

```json
{ "id": "b-boots", "item": "Iron Greaves: movement speed, life, fire resistance",
  "query": { "slot": "Boots", "target": { "divines": 5, "day": 7 }, "league": "Forbidden Rites", "item_type": "Iron Greaves",
             "mods": [ { "stat_id": "explicit.stat_2250533757", "min": 35 }, { "stat_id": "explicit.stat_3299347043", "min": 100 },
                       { "stat_id": "explicit.stat_3372524247", "min": 31 } ],
             "corrupted": false, "min_rune_sockets": 1, "limit": 10 },
  "amount": 2, "currency": "divine", "date": "2026-10-15", "league": "Forbidden Rites", "status": "ok",
  "note": "18 found, the 5th cheapest",
  "listing": { "corrupted": false, "sockets": 1, "count": 18, "position": 5 },
  "spec": { "base": "Iron Greaves",
            "weights": [ { "stat": "FullDPS", "weight": 1 }, { "stat": "TotalEHP", "weight": 0.5 },
                         { "stat": "EffectiveMovementSpeedMod", "weight": 0.5, "why": "boots carry their rung's movement speed tier (D-440)" } ],
            "ranking": [ { "affix": "# to maximum Life", "gain": 1.9, "weight": 0.0142 },
                         { "affix": "#% increased Movement Speed", "gain": 1.4, "weight": 0.05 },
                         { "affix": "#% to Fire Resistance", "gain": 1.1, "weight": 0.031 },
                         { "affix": "#% increased Armour", "gain": 0.6, "weight": 0.006 } ],
            "mustHaves": [ { "affix": "#% increased Movement Speed", "tradeId": "explicit.stat_2250533757", "tier": 1, "min": 35 },
                           { "affix": "# to maximum Life", "tradeId": "explicit.stat_3299347043", "tier": 2, "min": 100 },
                           { "affix": "#% to Fire Resistance", "tradeId": "explicit.stat_3372524247", "tier": 3, "min": 31 } ],
            "leftOut": [ { "affix": "#% increased Armour", "why": "the build's toughness is its life; armour gains half what fire resistance does" } ],
            "searches": 3 } }
```

- `id` (`[A-Za-z0-9_-]+`, unique in the plan) is what a `price:<id>` claim cites.
- `league` equals the plan's `league`.
- `query` is the arguments of the call whose price it records (for a rare, its depth check), and on a rare of `b` or
  `n` its `slot` (the slot as `find_upgrades` names it, `Jewel <node id>` for a tree jewel: the trade links find its
  spec by it) and its `target`, `{divines, day}`.
- `item`, a rare's base and key affixes, as its title is (D-489), never a generated name.
- **`listing`** (D-484, schema 10; outside `buildSha1`, like `note`): `{corrupted, sockets, count, position}`, the
  listing's corruption and rune sockets, the search's total (its `Found:`) and the price's place in it (5 for the depth
  price). **The priced copy matches the compiled copy**: the run checker's `listing` fails an entry whose
  `listing.corrupted` differs from the item's `Corrupted` line, or whose `listing.sockets` is under the item's
  `Sockets:` count, but for a cheap unique priced uncorrupted under D-471, whose `note` says so. A rare's searches ask
  for its base's standard sockets, so its listing has them. A price by name (`mcp__pob2__get_item_price`) has no
  `listing`.
- **`spec`** (D-483, schema 10; on a `b` or `n` rare or rare tree jewel only; outside `buildSha1`): `{base, weights,
  ranking, mustHaves, leftOut, searches}` (`docs/build-guide/plan-reference.md`): `ranking` PoB's top 4 the base can
  roll, or `null` when the loop couldn't rank; each must-have `{affix, tradeId, tier, min, zeroScored?, why?}`, most
  important first; `searches`, the trade searches the loop made, at most 5. The run checker's `spec` holds the `why`
  and `leftOut` rules (none on a spec with `ranking: null`), a weight beside `FullDPS` and `TotalEHP` with its `why`,
  the order and the cap.
- **`note`** records the count and the price's position (`18 found, the 5th cheapest`), never a listing's name or a
  fit; a cheap unique's says `priced uncorrupted: …`, and a weapon's adds `re-checked by compile`.
- An `unavailable` entry has `amount` and `currency` null and a `note` giving the reason: `offline run`,
  `rate-limited`, `trade disabled`, `no session cookie`, `thin: <count>`, ….

## Classifying outcomes (D-218)

An error from these tools reads `Error: [trade:<kind>] Failed to <action>: <message>`. `find_upgrades` names a
stop for a trade-site limit as `Stopped early: [trade:<kind>] <reason>.`. Classify a result by the `<kind>` in
its `[trade:<kind>]` prefix, wherever the prefix appears in the line, and nothing else; never parse the prose
after it. A result with a prefix records no price from its listings. A `find_upgrades` stop that the server's pace
caused after a search ran, `Stopped early: the 45 s gap between trade searches cut the loop short after <n>
search(es).` (or the cap of 7 searches in 300 s), has no prefix: the call returned the best listings of the searches
it ran, so read them as any call's (`ok`).

**`find_upgrades`' fallback** (D-494) is a result, not an error, sent when no weighted search ran: its first line is
`[trade:no_session] `, `[trade:session_rejected] ` or `[trade:too_complex] `, then `Trade search not run: <reason>.`,
and its link last. Read the first two as a session problem for this step: no more budget searches; the step's other
rares are priced by depth checks, which search anonymously (the spec loop, "When the loop can't run"), and the runner
tells the user at once. Read `too_complex` as a cue to drop the least important must-have from `required_mods` and
call again. **An item is `unavailable` only after its own failed call**: a fallback never marks other items so. A
`link_only` reply (`Link only: …`) is no fallback: it ran no search by design.

| Outcome | Means | Do |
|---|---|---|
| `ok` | a dated price | record it |
| `would_wait` | the limiter refused a wait over 60 s and sent nothing | price other items, then call this one again later |
| `locked_out` | the account is locked out | stop trade-site pricing until the user approves a retry at a gate ("After pricing stops") |
| `rate_limited` | the trade site answered 429 | stop trade-site pricing until the user approves a retry at a gate ("After pricing stops") |
| `pace` | the step's first trade call's reply had no pace line, or `Pace: off (test setting).` (D-474) | make no more trade calls and return the stop `pace: missing` or `pace: off` ("Pace") |
| `no_session`, `session_rejected` | `find_upgrades` ran no weighted search: no cookie, or one the site refused (D-494) | no more budget searches this step; the rest by depth checks; the runner tells the user |
| `too_complex` | the trade site refused the query as too complex (D-494) | drop the least important must-have and call again |
| `http`, `network`, `timeout`, `disabled`, … | the call failed | the item is `unavailable` |
| `error` | an error without the prefix, or a stop without it that returned no listing | the item is `unavailable` |

## Pace (D-160, D-461, C-11)

**The server paces trade searches itself** (D-461): it sends a search no sooner than 45 s after the previous
search's send, at most 7 in any 300 s, beside the trade site's own windows, and waits inside the call: the limiter
waits up to 60 s and refuses a longer wait with `would_wait`, sending nothing. Listing fetches don't wait on the
floor. `mcp__pob2__find_upgrades` keeps a fixed 90 s budget from the call's arrival, so a call makes at most two
searches; when the gap cuts its weight-adjust loop short, it still returns the best listings of the searches it ran
(above, "Classifying outcomes").
- **The pace line first** (D-474). Every reply of `mcp__pob2__search_trade_items`, `mcp__pob2__get_item_price` and
  `mcp__pob2__find_upgrades`, an error's included, carries the server's pace: its last line (in `find_upgrades`, the
  line before the trade-site link, which stays last), `Pace: 45 s between searches, at most 7 in 5 minutes.`. A
  pricing step's **first trade call reads it**: with no pace line (a session server built before M-26, which may
  not pace at all) or `Pace: off (test setting).`, the step makes no more trade calls, prices the rest
  `unavailable` (note `pricing stopped`), counts that call as `pace`, and returns the stop `pace: missing` or
  `pace: off`. The runner records it as a pricing stop and asks the user to reconnect the server with `/mcp`, then
  re-runs the step. A first call that errs before it reaches the server's handler (an argument the router refuses)
  carries no line and doesn't count: read the next call's.
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
  **It counts trade searches, not calls** (D-483): in a revision-14 run, D1-build's spec loop usually makes 3 a `b`
  rare (the budget search's two and a depth check) and 1 an `n` rare, at most 5 a slot, about 20 to 35 a build (15
  to 26 minutes at the 45 s pace); D1-finish one depth check a spec it re-prices and one a unique or other item; the
  late endgame scaling pass at most 15 (D-486). A `link_only` call is no search.

## After pricing stops (D-415, D-422, D-444)

**The stop holds until the user approves a retry at a gate.** A step whose `priceOutcomes` counts a `locked_out` or
`rate_limited` call, or a `pace` call (D-474: the server's pace line missing or off; the user reconnects the server
with `/mcp` before the retry), stops trade-site pricing: `run-log.mjs` records the stop in the run log's `pricing.stops[]
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
`mcp__pob2__find_upgrades`, but for its `link_only: true`, which sends none: the spec loop's ranking stays allowed
(D-483). **poe.ninja's exchange stays allowed** (D-422 allows it), so every item the currency
exchange sells keeps its price: `mcp__pob2__get_item_price` for a rune, soul core, idol, Distilled Emotion, lineage
support gem or any other exchange item reads poe.ninja's exchange and sends no trade request (not with
`--no-ninja`), counted as `exchange` ("Reporting the calls"). Pass the plan's `league` in the call, so it asks
the trade site for no league. An exchange item its category doesn't list goes to the trade site by name (never a
rune over the budget without the brief's say, D-465), which the server doesn't try after its own limit until it restarts, even after a `retry-pricing`: its
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
`plan.json` once more and updates it; a refusal leaves it `unavailable`. **A spec is re-priced as compiled** (D-483):
a rare's entry with a `spec` gets one depth check at its must-haves' tiers, the `search_trade_items` call its `query`
records, with its `listing` and `note` written again; the loop never runs again. An older build's weighted-search
entry (its `query` has a `target` and `required_mods`) needs its rung loaded: compile measure-only, select the
rung's loadout, and call `find_upgrades` with the entry's arguments. The pass is skipped while a pricing stop is open, and in offline mode; after the
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
`prices: ok 12, exchange 3, would_wait 1` (or `prices: none`), and the stop `pace: missing` or `pace: off` when the
pace line stopped it. The runner records them as that step's
`priceOutcomes` in the run log's `stages[]` (`run-log.md`): each key `ok`, `error`, `pace` or a `[trade:<kind>]` kind, and
**`exchange`** for a call `mcp__pob2__get_item_price` answered from poe.ninja's currency exchange: its result says
the item is "a currency-exchange item … priced from poe.ninja's currency exchange" and has an `Exchange value:`
line, or an `Unavailable (<category>): …` line saying the trade site isn't tried. Such a call sends no trade
request. Count an exchange call as `exchange`, never as `ok`: once pricing has stopped, the run checker fails a
step whose counts hold any key but `exchange` (D-444). An exchange item the server priced from trade listings by
its name instead (its result says so; `Unavailable (<category>; trade site: …)` when it found none) is a trade
call, counted by its outcome. The pricing steps are R1b, D1-build (its `find_upgrades`
calls and, in a revision-14 run, its spec loop's depth checks), D1-finish, the D1 gate and D2; D1-tree makes no
trade call, and the run checker fails a non-zero count on its entry (D-490). When a step's counts hold a `locked_out` or `rate_limited` call, its `stage`
entry records the stop, and the runner tells every later coordinator step so until a gate's `retry-pricing` or a
resume ("After pricing stops"). A `find_upgrades` call is a price call, but for `link_only`, which sends no request
and isn't counted, like `manage_sets` and `trade_query_options`.

## Offline mode (D-201, D-233)

No step calls a trade or poe.ninja tool, even if one is available. Every price is:

```json
{ "id": "b-helmet", "item": "…", "query": { "…": "…" }, "amount": null, "currency": null,
  "date": "<the run folder's date>", "league": null, "status": "unavailable", "note": "offline run" }
```

and the plan's `league` is null, which the plan schema allows only then. No step has `priceOutcomes`. A rare of `b`
or `n` still carries its `spec`, with `ranking: null` and `searches: 0`: its must-haves are the designer's, at their
floor tiers' lowest rolls (D-483).
