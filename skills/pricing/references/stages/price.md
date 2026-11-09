# price: the replace cost, the place and the upgrades (`build-guide-coordinator`)

The pricing piece's one coordinator step (D-520, C-64), a fresh step that `/pob2:pricing`'s runner starts on a
player's file read into a plan (`mcp__pob2__plan_from_build`, D-517). You price what the character wears the cheapest
way to the same must-have stats (the **replace cost**), place it on the endgame ladder by that cost (the **place**),
and, with a budget the player named, find the upgrades within it. **The pricing procedure**,
`skills/pricing/references/pricing.md`, holds the rest: its tools, the spec loop's depth price, the outcomes, the
pace, the stop, recording a price and the conversion to a price day. Below is what this step adds. Its **placement
scope** (the header's `stage: "place"`: the league, the replace cost and the place, nothing else) also serves
compile's better round and a file run, each in its own folder.

## Inputs

- **The run folder's root**, a piece run's (no `builds/`): `plan.json`, one read stage (id `f`, its `source`, its
  items, tree jewels and groups marked `owned`), `read.json` (`importLeague`, the loadout, `left`), `run-log.json`
  (the stop and `noNinja`). `<plan>` is `<runFolderRel>/plan.json` (in a file run,
  `<runFolderRel>/<buildFolder>/plan.json`). Read the plan through `mcp__pob2__guide_run {view: {plan: "<plan>",
  stage: "<id>"}}`, never whole.
- **Header:** `stage: "price"` (or `"place"`), `attempt`, `mode`, `runFolder`, `runFolderRel`, `buildFolder` (`.`),
  `compile: "measure-only"`, `writes` (`["plan.json", "prices.md", "upgrades.json"]`; `["plan.json"]` for `place`),
  `root`, `reference`, and the pricing piece's own four: `league` (the player's answer to the league question, else
  `null`), `budget` (divines for the upgrades, the player's, else `null`), `rung` (the player's word: `"m"`, `"b"`,
  `"n"` or `"campaign"`, else `null`) and `maxSearches`, the most trade searches the runner's notice announced.
- **Before your first price or league call**, read `run-log.json`: a pricing stop is open when its last
  `pricing.stops[]` entry has no resume after it. While one is open, no trade-site request (the procedure's "After
  pricing stops"); the exchange stays allowed. Offline, no price tool at all. `noNinja` true: no currency rates.

## Work

1. **Load the character.** While the read stage is unplaced (id `f`, no `variant`), `mcp__pob2__compile_plan
   {plan_path: "<plan>", measure_only: true, measure_as: "non-budget"}`; once placed (a resume, or a run again), the
   stage is measured as its own rung, `{plan_path: "<plan>", measure_only: true}` with no `measure_as`, which a placed
   stage refuses. Then `mcp__pob2__manage_sets {set_type: "loadout", action: "select", title: <the stage's
   loadoutName>}`, since `mcp__pob2__find_upgrades` acts on the loaded build. A compile error is a `fail` return.
2. **The cap** (D-461, §16 step 3). Never make more trade searches than the header's `maxSearches`, the notice's
   bound. Count each: a depth check or any `mcp__pob2__search_trade_items` call 1, a unique priced on trade by
   `mcp__pob2__get_item_price` 1, an exchange item it priced from trade listings instead (its reply says so) 1, a
   `mcp__pob2__find_upgrades` call its reply's `Searches <n>` (none for `link_only` or a fallback); exchange values,
   rates and leagues none. Before a call that may search, check the searches left: a rare's depth check needs 2 (its
   thin retry), a `find_upgrades` call 2, any other call that may search 1. With too few left, stop searching: every
   item still to price is `unavailable`, `note` `search cap`, each upgrade slot still to search gets its `link_only`
   link, and you return `searches: cap <made> of <maxSearches>`. Price what the exchange sells (step 5's sockets and
   gems) before what the trade site prices, so a search the exchange's fallback made counts first.
3. **The league** (the player's rule: no trade between leagues). The header's `league` when it has one; else
   `read.json`'s `importLeague` when `mcp__pob2__get_leagues` lists it and it isn't Standard, a hardcore league
   (Hardcore, `HC …`) or a Solo Self-Found one (`SSF …`); an ended league isn't listed. Otherwise, before any search,
   return `league: ask (<the listed leagues>)`: the runner asks the player and runs this step again with the answer.
   While a stop is open, the league is the plan's, recorded before it; no `get_leagues` call. Offline, `null`. The
   plan's `league` is it, and so is every price's.
4. **The rates.** Online and without `noNinja`: `mcp__pob2__get_currency_rates {league}`, each currency the prices use
   recorded as an entry `rate-<currency id>` (`rate-exalted`, `rate-chaos`): `item` the currency's name, `query`
   `{"rates": "<currency id>", "league": "<league>"}`, `amount` what one unit is worth in divines, `currency`
   `"divine"`, `status` `"ok"`, `date` the rates' date, `note` in players' words (`400 exalts a divine`). The run
   checker reads the rates from these entries.
5. **The replace cost** (D-520). Every filled slot of the read stage but its flasks and charms (unpriced: D-472, and
   charms deferred), and every tree jewel, each its own entry: `id` `f-<slot>` (the slot in lower case, spaces as `-`:
   `f-body-armour`, `f-weapon-1-swap`; `f-jewel-<node id>`), `query.slot` the slot as `mcp__pob2__find_upgrades` names
   it (`Helmet`, `Jewel <node id>`), beside the call's own arguments. The run checker maps each entry to its slot by
   `query.slot`.
   - **A rare** (gear or a tree jewel): its spec from the owned rare (below), priced at the spec loop's depth price
     (the procedure, D-483) by one depth check, `mcp__pob2__search_trade_items {league, item_type: <its base>, mods:
     [<each must-have's trade id, min its tier's lowest roll>], corrupted: false, min_rune_sockets: <the base's
     standard count, when above 0>, limit: 10}`: the 5th cheapest of at least 10 found. Thin (fewer than 10): drop the
     4th must-have, when it has four, and check once more, the dropped one in `leftOut` with the why `thin with it:
     <count>`; still thin, `unavailable`, `note` `thin: <count>`. At most 2 searches a rare, `spec.searches` counting
     them.
   - **A unique**: by name with `mcp__pob2__get_item_price`, its price the summary's `Median:` in the primary currency
     (the native median when the reply has no rates), or as the procedure's "Which tool" prices it: a corrupted one by
     the corruption rule (D-471, D-484), a cheap one uncorrupted, a dear one's corrupted extra socket as that
     corrupted copy; a random-roll unique by its rolled lines. An owned unique PoB marks no longer obtainable is
     priced by name too, `unavailable` with its note when the trade site has none.
   - **A magic or normal item** (a flask aside): `mcp__pob2__search_trade_items` with `mods`, as the procedure prices
     one.
   - **What its sockets hold**: each rune, soul core or idol (an item's `Rune:` lines, in order), its own entry, `id`
     `<the item's id>-socket-<k>`, `query` `{"slot": "<its item's slot>", "socket": <k>, …}` with the call's
     arguments: by name with `mcp__pob2__get_item_price`, from poe.ninja's exchange (`{"exchange": "<category>",
     "name": "<item>"}`, the procedure). An owned "Legacy of …" soul core or Raven-Touched Shard is the character's
     own, priced the same (D-519's exemption from D-465).
   - **The gems** (§16: uncut gems from poe.ninja's exchange): each gem of the read stage's groups but a skill an item
     or a passive grants (an item's `Grants Skill:` line, a passive's), its own entry, `id` `f-gem-<group>-<gem>`,
     `query` `{"group": <its group's number>, "gem": <its place in the group>, …}` (both from 1) with the call's
     arguments: by name with `mcp__pob2__get_item_price` from the exchange, a skill gem as `Uncut Skill Gem (Level
     <its level>)`, a Spirit gem (one that reserves Spirit) as `Uncut Spirit Gem (Level <its level>)`, a gem corrupted
     +1 at its level less 1 (the procedure's rule: priced as the gem), at most 20; a support gem as `Uncut Support Gem
     (Level <its tier>)`, its `Tier:` from `mcp__pob2__lookup_game_data {mode: "gem", query: <its name>}`; a lineage
     support by its own name. Identical gems share one call, each still its own entry. The place counts them.
   - Before any search, reuse an entry the plan holds with the same item, query and league (D-169): a resume reuses
     every price a stopped run left.
6. **The place** (answer 2; D-371's targets, choice A, choice B), from the replace cost:
   - **Below the endgame** (the stage's `level` under 65, the first waystone tier's area level, or the header's `rung`
     `"campaign"`, the owner's word): no rung. Its place is "in the campaign" (by its level, or the owner's word), and
     the stage stays `f`.
   - **The cost is known** (online, rates recorded, every entry `ok` and in a currency with a rate): each entry in
     divines at the market's day, its range at day 7 by the procedure's conversion (`data/economy/prices.json`: the
     market's day is the latest `ok` entry's date less the league's `start`, late past day 60 or the league's `end`).
     `m` when the whole cost's midpoint (every entry, sockets and gems included) is at most 5 divines; else `b` when
     no rare's or rare tree jewel's own entry, and no unique's (choice B), has a midpoint over 5 divines; else `n`,
     and when the whole cost's day-21 midpoint is over 200 divines, say so.
   - **The cost isn't known** (offline, a stop before every item is priced, `noNinja`, or an `unavailable` price): the
     header's `rung`, the player's word; with none, return `place: ask`, and the runner asks and runs this step again
     with it (every price the plan holds reused, no new search). Never assume `n`. A missing session cookie isn't
     "without trade": depth checks search anonymously.
   - **Placing** renames the stage to its rung's id (`m`, `b` or `n`) and its `loadoutName`'s `{<id>}` to it, and adds
     `variant` (`entering-maps`, `budget` or `non-budget`), `ascendancyPoints` (the allocated ascendancy nodes but the
     start node, at most 8) and `variantBasis` (`{level, gemLevels, ascendancyPoints}`, each `{"kind": "judgment",
     "ref": "the character's own, from its file", "confidence": "H"}`). Price ids keep `f-`. A second run (a resume)
     may place again: the stage takes the new rung's id and `variant`.
7. **The upgrades** (stage `price` only; answer 6; C-14 capped at the player's budget), after the replace cost and
   within the cap. With a `budget`, online, no stop and not `noNinja` (no rate holds a listing to a budget in
   divines): for each gear slot (not a flask, charm or tree jewel), one `mcp__pob2__find_upgrades {slot, max_price:
   <budget>, currency: "divine", sort_stats: [FullDPS 1, TotalEHP 0.5], report_stats: ["<the lowest max hit's
   type>MaximumHitTaken"], rune_behaviour: "keep", fetch_pages: 1, limit: 3, league}`, one call at a time: PoB's
   weighted search, at most two searches a call. Each listing: its price as seen, PoB's gains (Full DPS and EHP as
   fractions, the lowest max hit's type and change) and its link (its `Buy:` link, else the search's). Upgrades are
   listings, which improve this character; a guide names specs. **Without a cookie** (`[trade:no_session]` or
   `[trade:session_rejected]`): that slot gets the reply's link alone, and every other slot `mcp__pob2__find_upgrades
   {slot, link_only: true, league}`'s link, no search. A slot with no upgrade within the budget has no listing. After
   a stop, each slot still to search gets its `link_only` link. With no budget, no upgrade search runs and no
   `upgrades.json` is written.
8. **Count** your price calls by outcome (the procedure's "Reporting the calls"; `link_only`, `manage_sets` and
   `trade_query_options` aren't counted).

### A rare's spec from the owned rare (D-520)

Its **must-haves** are the 3 or 4 of its own explicit lines (its affixes: not its implicits, its rune lines or its
`Corrupted` line) that rank highest in PoB's weights for the slot: rank them with `mcp__pob2__find_upgrades {slot,
link_only: true, sort_stats: <the weights>, weight_corrupted_mods: false, league}` (plus `jewel_type` for a tree
jewel), the procedure's step 1, which sends no request; fewer when it carries fewer. A line PoB scores at zero is a
must-have only when the build needs it (the procedure's step 3), `zeroScored: true`. Each is required **at the lowest
roll of the tier its value falls in**: `mcp__pob2__lookup_game_data {mode: "mechanic", query: <the affix>, kind:
"mod"}`'s tiers at the item's own item level (its `Item Level:` line, at most 82). A **fractured** line is searched as
a plain explicit mod (its `explicit.` trade id, never the fractured filter, as the player's rule has it); a
**crafted** or **desecrated** line by its text, as an explicit mod; a **corrupted implicit** is left out (corruption
is never on rares). The entry's `spec` is `{base, weights, ranking, mustHaves, leftOut, searches}` (the procedure's
"Recording a price"): `base` the item's, `ranking` PoB's top 4 the base can roll, `leftOut` each of those the item
carries but doesn't require, with its `why`. The `item` is its base and key affixes (D-489). Its `listing` is the 5th
cheapest's. The run checker's `owned-spec` holds each spec to the owned item's lines.

### Offline

No price tool (`mode: "offline"`): every entry `unavailable`, `note` `offline run`, `league` `null`, dated the run
folder's date (the procedure's "Offline mode"); no rates, no upgrades; the place is the header's `rung` (the runner
asked it first) or "in the campaign".

## Writes

- **`plan.json`**: `league`, `prices[]` (every entry of steps 4 and 5) and the place (step 6). Nothing else changes.
  The step writes its files at a stop or at the cap too, with what it priced.
- **`prices.md`** (stage `price`), short and in players' words (D-442: "exalts", "divines"):

  ```
  # Prices: <the file's name, or "an import code"> (<loadout>, level <n>)

  League: <league>. Rates: <n> exalts and <n> chaos a divine, seen <date>.
  Searches: <made> of at most <maxSearches>.

  ## Replace cost

  | Slot | Item | Price | About, at day 7 |
  |---|---|---|---|
  | Helmet | Soldier Greathelm: life, cold resistance | 2 divines | 1.4–3.2 divines |
  | All | | | <low>–<high> divines |

  ## Place

  Place: <entering maps (m) | budget (b) | non-budget (n) | in the campaign>, <by the replace cost | the user's word | by its level>.
  <one line: why, against D-371's targets>

  ## Upgrades within <budget> divines

  - Helmet: <the listing's item> for <price> (+8% damage, +2% EHP, +120 cold max hit) <link>
  ```

  The `Place:` line is the run checker's (`placement`): the rung the plan holds, or "in the campaign" for a stage with
  none, and its basis (`by its level` only below the endgame); on `n` with the whole cost over 200 divines at day 21,
  its why line says "over 200 divines". The `Searches:` line, online, is the run checker's too (`pricing`): never more
  than announced. Offline or with a price unknown, the replace cost's ranges say so.
- **`upgrades.json`** (stage `price`, with a budget), Appendix A.10's shape: `{"budget": {"divines": <n>}, "league",
  "checked": "<the replies' Checked: time>", "slots": [{"slot", "listings": [{"price": {"amount", "currency"}, "gain":
  {"fullDps", "ehp", "maxHit": {"type", "change"}}, "link"}]}], "chosen": [], "spent": 0}`; a slot with only a link
  (no cookie, or a stop) is `{"slot", "listings": [], "link"}`. The runner writes `chosen` and `spent` at the display.
- `mcp__pob2__compile_plan` writes `compile-record.json` and `compiled-build.xml` beside the plan.

## Returns

At most 8 lines: `prices: ok 12, exchange 3` (or `prices: none`), and `pace: missing` or `pace: off` when the pace
line stopped you; `searches: <made> of <maxSearches>`, or `searches: cap <made> of <maxSearches>` at the cap; `league:
<name>` or `league: ask (<leagues>)`; `place: <m|b|n|campaign> (<by the replace cost|the user's word>)` or `place:
ask`; `upgrades: <n> slots` or `upgrades: none (<why>)`; the files you wrote. A `league: ask` writes nothing.
