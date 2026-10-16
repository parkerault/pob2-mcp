# Amendment 5: gear pricing

**Status: ACCEPTED by the user, 2026-10-16** ("Looks good"). It carries out the user's pricing direction of 2026-10-15 and
2026-10-16 (`../worklog.md`, "pricing strategy, a detour before the reference-build run" and its bullets), as
D-370…D-374, and adds D-375 at the user's request of the same day: the endgame designer reads the pattern library. The coordinator folds it into the spine and slices 01–03 with D-363…D-369 at v1.6. The lessons
of the Explosive Concoction comparison (`../studies/2026-10-14-ec-comparison.md`) are not here; they follow as their
own amendment. Paths without a directory are under `.claude/skills/build-guide/`.

**Evidence:** *the pricing study* (`../studies/2026-10-16-pricing.md`): five leagues of exchange prices by league
day, the conversion table, and one guide's gear sets priced on day 41 of Forbidden Rites.

**Names.** The endgame rungs are `m` (entering maps, T5), `b` (budget, T15) and `n` (non-budget, T16 and up). D1-build
designs them; D1-finish prices them and adds the anoint, ledger and claims; the D1 gate checks them before the
design gate and D2. "The checker" is `scripts/check-run.mjs`; "the renderer" is `scripts/render-audit.mjs`.

## 1. The user's direction

- **The reader:** gets the guide at league start, buys early endgame gear around day 7 and reaches late endgame two to
  three weeks in. By day 7 most early endgame items cost a few divines; that gear clears most six-mod T15 maps, and
  past it prices hit diminishing returns. Guides top out at 100–200 divines.
- **Estimates are ballpark.** Wrong ones aren't a catastrophe: the user can re-price a build at any point.
- **The method must be general.** Every league has its own meta, so last league's price for an item doesn't
  transfer; heuristics for how prices move with the league day do.
- **Search the way players do:** PoB2's weighted search ("trade for these items"), with an AND group for the affixes
  the item must have. An exact search with high minimum rolls finds a few dear items: dropping one low-value affix
  took a guide's 420–900 divine amulet search to 10 divines.
- **Never prune a build for price.** Designers overestimate gear prices; give the target wiggle room and let the
  user decide whether a build costs too much.

## 2. D-370: price days and targets

| Rung | Price day | Target |
|---|---|---|
| `m` | day 7 | 5 divines in all (D-281's number) |
| `b` | day 7 | about 5 divines a rare slot: the user's "a few divines" |
| `n` | day 21 | 100–200 divines in all. D1-build gives each rare slot its own target, the slot targets summing to at most 200; by default they share 150 evenly, and a slot that carries the build (a weapon, a skill-levels amulet) may take more, with a reason |

Uniques, magic items, flasks and charms count toward a rung's total but have no slot target of their own. Each
rare's price entry records its target in its `query` (`target: {divines, day}`, §4), so the checker reads it from
the plan.

## 3. D-371: the budget is a target, never a gate failure

*Replaces* D-147's "never above about 20 divines" and D-219's tolerance, both the user's earlier settlements, by the
user's direction of 2026-10-16. D-116's 20 divines gives way to D-370's slot target; D-117's ~200 and D-281's 5
become targets.

- **The D1 gate's budget part** reads `pass` or `unverified`, never `fail`. A rare whose converted range has its
  midpoint above its target is an information finding, `over-target`, naming the slot and its range. `m`'s total
  over 5 divines is one too. `over-budget` and `near-ceiling` go.
- **Routing:** a budget finding never sends D1 back, and no concept is `infeasible` for its price. D1-build drops
  "can't meet a budget" from its reasons to claim `infeasible`.
- **An over-target slot** keeps its designed item. D1-finish may add a fallback: fewer or lower required affixes,
  priced the same way. The guide shows the fallback beside the target and says it isn't measured.
- **The user judges the cost** at the verification gate (key prices on each card, §6) and at the final gate (each
  rung's total and its over-target slots).
- **Unchanged:** every filled slot and tree jewel has a price (D-249); an `unavailable` price makes the rung's
  total `unverified`, and the guide can't state it (D-164); offline runs price nothing.

## 4. D-372: rares priced by weighted search

**Each rare gear slot and rare tree jewel of `b` and `n`** is priced with `mcp__pob2__find_upgrades`, PoB2's weighted
trade search (the server's C-14 contract):

- the rung's loadout is active: D1-finish compiles measure-only, which loads the build, and selects the loadout with
  `mcp__pob2__manage_sets` (`set_type: "loadout"`, `action: "select"`) before pricing its slots;
- `required_mods`: the slot's **required affixes**, at most 3, each with its minimum. They are what the slot can't
  do without: the build's damage type, a resistance the floor needs, skill levels. They form the search's AND group.
  An affix PoB can't value (one it doesn't parse) is always required, never left to the weights;
- `max_price`: the slot's target converted to the market's day (D-373: the target over the midpoint of its row's
  factors), in exalts at the run's rate with `currency: "exalted_equivalent"`, so a listing in any currency counts;
- the default weights (the build's saved trade weights, else full DPS 1 and EHP 0.5). The weights come from the
  stage's own calculation, custom modifiers included (`TradeQueryGenerator.lua:844`, `CalcSetup.lua:743`);
- `rank_by: "stat_value"`, `include_non_upgrades: true` (the designed item is the baseline, so few listings beat
  it), `fetch_pages: 1`.

PoB2 writes the max price into the trade query and sorts by the weighted sum, so the first listing is the best item
the budget buys. Its price is the entry's `amount`; its score against the designed item is the entry's `note`
("fit 85%"). The entry's `query` holds the call's arguments and the slot's target, so the required affixes travel
with the price. When no
listing fits, the slot is over target: `search_trade_items` with the required affixes as `mods` gives the cheapest
listing that has them, since the trade site sorts that search by price. (A second `find_upgrades` call can't: its
search is sorted by the weighted sum, so ranking by price re-sorts only the page it fetched; WU-75's review.)

**Everything else is priced as today:** uniques and emotions by `get_item_price`, magic and normal items, flasks and
charms by `search_trade_items`, and every `m` slot by `search_trade_items` (`m` is mostly the campaign's own gear).

**Server changes (WU-74):**

- `find_upgrades`' header gains C-49's `League:` and `Checked:` lines, so a price is dated as the other tools' are;
- a stop for a trade-site limit names its `TradeErrorKind` with C-49's prefix (`[trade:rate_limited]` for a 429)
  in its stop line, so `pricing.md`'s classification applies unchanged.

## 5. D-373: converting to the price day

**The market's league day** is the run's date less the league's start date, from a table of league start and end
dates in `data/economy/prices.json`. A league whose end date has passed, or a day past 60, reads as late. A league
not in the table converts as days 21–60, and the guide says its day is unknown.

**The conversion table** (the study's §5), a `judgment` fact (confidence L) in the same file, as D-359's socket
estimate is:

| Item's price when seen | To day 21 | To day 7 |
|---|---|---|
| Under 10 divines | ×0.6–0.85 | ×0.4–0.9 |
| 10 divines or more | ×0.5–0.85 | ×0.2–0.4 |
| Seen late in a league (past day 60) or after it ended | the row above, then ÷2–4 | the row above, then ÷2–4 |

For a market before day 21 no conversion applies; the table's factors are 1 and the guide says the prices are from
an early market.

- **A total is a range:** each entry converted at both ends of its row, summed, rounded to whole divines over 10
  and to one decimal under.
- **The D1 gate records it:** `basis.budget` gains `market: {league, day, late}` and each total becomes
  `{low, high, day}`. The checker recomputes them from the plan's prices and the file.
- **Prices stay as seen** in `plan.json`: the conversion is reporting only, so a re-price on another day needs no
  migration.

## 6. D-374: what the reader and the user see

- **The guide says once,** in its pricing line: the league and date the prices were seen (and the league day), that
  early endgame is estimated at about day 7 and late endgame at about day 21, that trade moves a lot, and that the
  build can be re-priced with the skill at any time.
- **Each rung's Checks budget line** (the renderer's, copied verbatim):
  - `m`: "Budget: about A–B divines around day 7, against a 5-divine target."
  - `b`: "Budget: about A–B divines around day 7, aiming at about 5 a slot. Over target: <slot> (about A–B)."
  - `n`: "Budget: about A–B divines around day 21, against the 100–200 target. Over target: <slot> (about A–B)."
    `b` and `n` give the "Over target" sentence only when a slot is over its target.
  - unavailable prices: "Budget: unknown", with D-164's reason, as today.
- **The slot table** (template row 9) gives each rare's required affixes as what to buy, the rest of its affixes as
  the priority after them, and an over-target slot's fallback.
- **Cards and the dossier** show key prices converted, as ranges with their day, so a dead league's 2,500-divine
  amulet doesn't reach the pick as a raw number.

## 7. D-375: the endgame designer reads the pattern library

The user's request (2026-10-16): give the endgame designer the pattern library, so that the Lightning Arrow Deadeye
reference run is the baseline for later changes to how builds are designed (an engine-lens layer is next). Today only
the R1a researchers read it (C-53, D-290).

- **D1-build reads `references/patterns.md` whole** before designing `b` and `n`, as R1a does: about 10K tokens of
  context, against the 150K peak-context target (D-357).
- **It asks the brainstorm questions of the build,** not of a new concept: what feeds the payoff, which routine
  action already makes the resource it needs, which +level sources and supports reach the skill, how its required
  state fails.
- **A shape is a starting point.** Every use is checked with a lookup and measured with a compile like any other
  change; the plan's `reason` cites the lookup and the measurement, never the library.
- `patterns.md`'s opening line names both readers.

## 8. What changes

| Was | Becomes |
|---|---|
| D-147, D-219: `b` at most 20 divines, 22 with "near the ceiling", above 22 fails | D-370's slot targets; never fails (D-371) |
| D-281: `m` at most 5, 5.5 with "near the ceiling", above fails | a 5-divine target; never fails |
| D-117: `n` against ~200, never gated | 100–200, with slot targets (D-370) |
| D1 gate: `over-budget`, `near-ceiling`; budget fail re-runs D1 | `over-target` (information); no budget route |
| Rares by `search_trade_items` with `mods` | `b` and `n` rares by `find_upgrades` (D-372) |
| A total in divines on the day seen | a range at the price day, with the market's league day (D-373) |
| Only R1a reads the pattern library | D1-build reads it too (D-375) |

## 9. Work units

| Unit | Slice | What | Depends on | Risk |
|---|---|---|---|---|
| WU-74 | 01 | `find_upgrades`: `League:` and `Checked:` lines, prefixed stop kinds; an engine test on a compiled plan's loadout | — | low |
| WU-75 | 03 | The skill text: `pricing.md`, D1-build (with D-375's library read), D1-finish, the D1 gate and `gates.md`, W1, V4, R1a, R1b, the cards and dossier, checkpoints, templates, `patterns.md`'s opening, the coordinator's tools; `data/economy/prices.json` | WU-74 | medium: many files |
| WU-76 | 03 | The checker and the renderer: targets, ranges, `over-target`, routes; fixtures and tests | WU-75 | medium |

WU-75 and WU-76 run in series: they share the pipeline tests.

**Acceptance criteria:**

- **AC-K68 (WU-74, D-372).** Unit, through `fixtureFetch`. `find_upgrades`' output has `League:` and `Checked:` lines;
  a 429 stop reads `[trade:rate_limited]`.
- **AC-K67 (WU-74, D-372).** Engine. After a measure-only compile of a three-rung fixture plan and a loadout select
  of `b`, `find_upgrades` on a rare slot with two `required_mods` and a `max_price` sends a query with an `and`
  group of those two, a `weight` group and `trade_filters.price.max`, and scores listings against `b`'s item, not
  `n`'s.
- **AC-W63 (WU-75, D-370…D-375).** Static. `D1-build.md` has D1-build read `references/patterns.md` whole before
  designing `b` and `n`, with the lookup-and-measure rule; `pricing.md` has D-370's targets, D-372's call and
  D-373's method; `data/economy/prices.json` has the table and the league dates as `judgment` facts; the coordinator's tools include
  `find_upgrades` and `manage_sets`; D1-build has no `infeasible` for price; no skill file keeps the 20-divine
  ceiling, the 22- or 5.5-divine tolerance, or "near the ceiling".
- **AC-W64 (WU-76, D-371, D-373).** Checker unit.
  - A `b` total of 60 divines with an `over-target` finding passes the D1 gate and routes to the design gate.
  - A budget `fail` is refused as an unknown value.
  - The rendered Checks lines give ranges at the price day and name the over-target slots; the checker's recompute
    from the plan and `prices.json` matches the D1 gate's.
  - An `unavailable` price still makes the total `unverified`, with D-164's sentence.

## 10. Risks

- **The trade site's rate limit.** The study's capture drew a 429 and a 600-second lockout on its 18th search,
  although the server's limiter follows the site's headers. Two rungs of about ten rares make about 20 searches
  and 20 listing fetches. The live alpha (M-13) watches for it; if it recurs, a minimum gap between trade searches
  in the server's limiter is the next step.
- **Weights from a gap in the model.** When the build's damage rests on a mod PoB doesn't support, the weights
  undervalue what feeds it. Custom modifiers count in the weights (D-293's lines move them), and required affixes
  cover the rest.
- **The table is rough.** It comes from exchange goods, not gear, and the leagues disagree by 2–3×. The guide shows
  ranges and says so once; the user can re-price.
