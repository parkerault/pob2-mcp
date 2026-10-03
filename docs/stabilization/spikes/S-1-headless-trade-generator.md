# Spike S-1: Running PoB2's trade query generator headless

Pinned PoB2 `v0.23.1` (`7d6f530`), test build `Grenadator.xml`, date 2026-10-03. Citations point into `src/` of the
v0.23.1 checkout unless prefixed. **[V]** = verified (run, live request, or code read); **[I]** = inference.

## Verdict: PARTIAL

| Criterion | Result |
|---|---|
| Valid query for the body armour slot | **PASS [V].** Generated headless for Body Armour, Weapon 1 (crossbow) and Ring 1. All 86 trade IDs exist in live `/api/trade2/data/stats`. The structure contains every field of S-3's `search-weighted-pob-shape.request.json` except dev head's empty `not` group. |
| trade2 accepts it | **Cannot be verified without a login [V].** Anonymous trade2 rejects any `type:"weight"` group, whatever its size: HTTP 400 *"Query is too complex… Logging in will increase this limit."* S-3 saw this with 1–3 filters; my two generated queries (31–32 filters) were rejected too, both sent before the coordinator's stop. Everything else in the generated query is accepted: with the weight group replaced by a `count` group of the top-6 weighted IDs, I got 200, `complexity:30`, 10,000 hits. |
| Evaluate 10 fetched items → per-stat deltas | **PASS [V].** 10 items fetched live, plus the 30 in S-3's committed fixtures (body armour, ring, unique belt). All 40 went through PoB's own result-evaluation path with none rejected. The score matches `TradeQuery:GetResultEvaluation` exactly. |
| Latency recorded | **PASS [V]** (see below). |

**Effect on the decisions.** The Lua path in the trade-architecture decision (D-5: generation and evaluation in Lua through PoB2's own classes, HTTP in TypeScript) works. Weighted search, however, needs a logged-in session. That conflicts with "session cookie optional" (D-7) for `find_upgrades` (D-6). Without a login there are two paths:
- **(a)** PoB's "No Session Mode": hand back a weighted trade2 link for the user's logged-in browser (`TradeQuery.lua:1019-1023`) [V code].
- **(b)** The anonymous fallback described below.

Untested: whether a `POESESSID` cookie lifts the limit [I]. It was not tried, because no request may carry user identity. PoB uses OAuth Bearer tokens (`TradeQueryRequests.lua:64-67`).

## PoB2 dialog options → generator inputs

"Required stats" and "stat to sort by" are PoB's own UI labels. Required stats are **trade-mod filters** (trade stat ID + min), checked by the trade server. They are **not** engine-output thresholds, so D-6's "required_stats (stat + min)" needs restating [V].

| UI control | Source | Generator input → query effect |
|---|---|---|
| "Stat to Sort By" (labels) / "Adjust search weights" popup (`TradeStatWeightMultiplierListControl`, slider 0.01–1.0 per stat) | `TradeQuery.lua:622-725`; `TradeQueryGenerator.lua:1227-1247` | `options.statWeights=[{stat,label,weightMult,transform}]`, drawn from `data.powerStatList` (`Modules/Data.lua:127`). Default: FullDPS 1.0 + TotalEHP 0.5 (`TradeQuery.lua:179-190`). Each mod's weight = `WeightedRatioOutputs` (`:159-194`). |
| "+ Add Required Stat" ×3 with a "Min" box | `:1341-1431` | `options.requiredMods=[{tradeId,value}]` → `and` group with `min` (`:1037-1040`). The choices are the slot-eligible Explicit/Implicit/Corrupted entries in `modData`. |
| Max Price + currency (10 currencies; default "Exalted Orb Equivalent" = no `option`) | `:1203-1212`, `:755-767` | `maxPrice`, `maxPriceType` → `trade_filters.price` (`:1050-1059`) |
| Max Level | `:1214-1217` | `maxLevel` → `req_filters.lvl.max` |
| # of Empty Sockets (not shown for rings/amulet/belt/flask/charm/jewel) | `:1219-1225` | `sockets` → `equipment_filters.rune_sockets.min` |
| Corrupted Mods | `:1113-1116` | `includeCorrupted` → also weights Corrupted mods (`:914-916`) |
| Mirrored Items | `:1121-1123` | `includeMirrored` → off adds `misc_filters.mirrored=false` |
| Rune Behaviour: Copy Current / Keep / Remove (weapon, helmet, body, gloves, boots) | `:1126-1142`, `:1266-1273` | `includeRunes` = Keep; after the fetch, the same setting copies, keeps or strips runes on results (`TradeQuery.lua:1040-1068`) |
| Anoint Behaviour (amulet) | `:1144-1160` | after the fetch only |
| Jewel Type / Jewel Slot / unique rows | `:1166-1201` | `jewelType`, `special` (not tested) |
| Trader pane: trade type (Instant buyout…) | `TradeQuery.lua:298-311` | `generator.tradeTypeIndex` → `status.option` (securable/available/onlineleague/online/any) |
| Trader pane: "Sort By" (Stat Value, Stat Value/Price, Price, Weighted Sum) | `TradeQuery.lua:351-379`, `:906-979` | ordering after the fetch, done by the caller |

## Shim design (no PoB files modified)

**Generation**
1. `new("TradeQueryGenerator", {itemsTab = build.itemsTab})`. The constructor reads only `queryTab.itemsTab` (`:114-122`). `InitMods` loads the shipped, pre-generated `Data/QueryMods.lua`, so no HTTP is needed (`:369-377`). Cache the instance: the first load costs 61 ms, later calls 0 ms.
2. Set the fields the dialog normally sets:
   - `tradeTypeIndex` (read at `:961`, set at `:1258`)
   - `requesterCallback` and `requesterContext` (`:1096-1098`)
   - Clear `lastMaxPrice`, `lastMaxPriceTypeIndex` and `lastMaxLevel`. `StartQuery` lets these sticky values override the options passed in (`:770-778`).
3. `StartQuery(build.itemsTab.slots[name], options)` (`:769`). It opens a "Please Wait" popup (`:870-872`), which is harmless headless; `FinishQuery` closes it again (`:1093`). Verified: zero popups left afterwards.
4. **Resume the coroutine directly; do not call `OnFrame`.** `OnFrame` (`:740-753`) re-raises a coroutine error only in devMode. Otherwise `FinishQuery` runs anyway and emits a query built from partial weights. Headless `GetTime()` always returns 0 (`HeadlessWrapper.lua:103`), so the yield at `:694-698` never fires and one resume finishes the job.
5. Wrap `calcContext.calcFunc` to count calls. Copy `gen.modWeights` before `FinishQuery`, which trims it to `MAX_FILTERS=35` minus extras (`:108`, `:994-1024`).

**Evaluation**
1. `new("TradeQuery", build.itemsTab)`. The constructor builds no UI and does no I/O (`TradeQuery.lua:22-65`).
2. Fetch JSON → PoB item text uses PoB's parser, which sits inside the `FetchResultBlock` callback (`TradeQueryRequests.lua:273-450`). Enqueue a request, pop it, and call its callback with the raw body. No HTTP is involved. The parser keeps only each line's `description` (`:400-408`). Fractured and desecrated lines inside `explicitMods` (S-3 mod-shape section) therefore become plain explicit lines: the calc is still correct, but their origin is lost. `socketedItems` is ignored; rune effects arrive through `runeMods` as `{enchant}{rune}` lines (`:413-415`) [V code].
3. Then `FilterToSafeItems` (`TradeQuery.lua:985-994`), followed by the rune/anoint handling (`:1040-1068`).
4. For each item: `calcFunc({repSlotName, repItem})`, then `ReduceOutput` + `WeightedRatioOutputs` (`:780-836`). Per-stat values are read with `data.powerStatList.GetFromOutput`, and raw output keys such as `ChaosResist` also work. The handler returns only numbers, so it avoids the crash where encoding PoB's raw calc output (which contains reference cycles) kills luajit (E1).

## Measured latency [V] (WSL2, RTX-5090 box, CPU-only)

| Step | Time |
|---|---|
| PoB boot / Grenadator load (one-time, existing bridge) | 1.0–1.1 s / 0.44–0.55 s |
| Generate Body Armour (80 engine evaluations; 38 positive weights, 29–32 kept in the query) | 2.3–3.1 s |
| Generate Weapon 1 (crossbow, 129 evaluations, 48 weights) | 3.9–4.4 s |
| Generate Ring 1 (104 evaluations, 23 weights) | 3.3–3.7 s |
| Per engine evaluation | ≈29–37 ms |
| Evaluate 10 items (parse + calc) | 660 ms on the first call (warm-up), then 230–290 ms (≈23–25 ms per item) |
| trade2 search / fetch round-trip | 190–340 ms / 204 ms |

Observed unauthenticated rate limits:
- Search: `5:10:60, 15:60:300, 30:300:1800, 600:21600:3600`
- Fetch: `12:4:10, 16:12:300, 50:300:300, 1000:21600:1800`

The 30 s bridge timeout (`src/pobLuaBridge.ts:84`) covers generation. However, generation blocks the single-threaded engine for up to about 4.5 s, so calls must queue behind it (the request IDs and FIFO queue in D-8). Results should be cached by (build hash, slot, weights, includeCorrupted, rune behaviour).

Example, best live body armour with Rune Behaviour = copy: score 1.356, against 1.5 for no change (the sum of the weights). TotalEHP −3,418 (−28.9%), Life −83, ChaosResist −44: the explicit mods lose 55, and "copy" keeps the current +11% rune. With "remove" the delta is −55. Best fixture chest: FullDPS +6,839 (+3.1%).

## Proposed handlers (new `pob-api/API/Trade.lua`)

```jsonc
// trade_generate_query
{ "slot":"Body Armour", "statWeights":[{"stat":"FullDPS","weight":1},{"stat":"TotalEHP","weight":0.5}],
  "requiredMods":[{"tradeId":"explicit.stat_3299347043","min":100}], "maxPrice":200, "currency":null,
  "maxLevel":80, "sockets":null, "includeCorrupted":true, "includeMirrored":false,
  "augmentBehaviour":"copy|keep|remove", "status":"securable" }
→ { "ok":true, "result":{ "query":{…PoB JSON…}, "rankedWeights":[{"id","weight","meanStatDiff"}],
    "minWeight":82.1, "itemCategory":"armour.chest", "meta":{"calcCount":80,"ms":2343} } }
// trade_evaluate_items
{ "slot":"Body Armour", "fetchResults":[ …raw /fetch "result" entries… ], "statWeights":[…],
  "reportStats":["Life","ChaosResist"], "augmentBehaviour":"copy" }
→ { "ok":true, "result":{ "baseline":{"score":1.5}, "rejected":0, "items":[{ "id","name",
    "price":{"amount","currency"}, "score":1.356, "stats":{"TotalEHP":{"base","new","delta","pct"},…} }] } }
// trade_query_options {slot} → sort stats (data.powerStatList minus ignoreForItems), eligible
//   required-mod trade IDs (as getModList, :1341-1362), currencies, statuses, which options the slot shows
```

**What stays in TypeScript**
- HTTP and the separate search and fetch limiters (parse `X-Rate-Limit-*`).
- Auth/session handling.
- Fitting the query to the trade2 complexity budget, using `rankedWeights` without re-running Lua. Without a login, switch to the anonymous fallback below, and also return the weighted link. S-3 found that a search ID is base64url(gzip(query)), so the link can be built offline.
- PoB's min-weight adjust loop (halve the minimum when results are short, raise it when clipped at 10k; `TradeQueryRequests.lua:105-199`).
- Price normalisation (poe.ninja), result ordering, and building the trade2 URL.

## Anonymous fallback design (no login)

> **Superseded (2026-10-03):** the user chose a logged-in session with a trade-site link as the
> fallback (vision D-15). The anonymous prefilter-and-re-rank design below is **not** being built. It
> is kept as a record of what was measured.

Steps for each `find_upgrades` call:
1. `trade_generate_query` returns `rankedWeights`. This takes 2–4.5 s, cacheable per (build, slot, weights).
2. TypeScript builds an anonymous query:
   - category, rarity, max price, status and max level, exactly as in the generated query;
   - an **`and` group holding only the user's required mods** (the PoB dialog's "+ Add Required Stat" entries);
   - a weight-derived prefilter (below).
3. One search returns at most 100 IDs [V: 100 of 10,000].
4. Fetch in pages of 10. Each page goes to `trade_evaluate_items` (≈25 ms per item).
5. Rank by the engine delta of the sort stat, apply any engine-stat constraints, normalise prices, and also return the weighted link.

**Can the generator's weights choose the stat minimums? Yes for selecting the prefilter, no for ranking [V data].**
- An `and` group requires *every* mod in it. Grenadator's top-weighted chest mods include rare ones (corrupted "+# to Level of all Corrupted Skill Gems", "#% of Damage taken from Mana before Life"), so an `and` group of the top K would match almost nothing [I].
- Put the weight-derived mods in a **`count` group** instead: "at least n of the top-K explicit mods". Each mod's `min` can be the mid-roll value the generator tested (`:646`).
  - Anonymous trade2 accepted K=6 at total complexity 30 with every other filter included [V].
  - S-3 measured 12 for three `and` stats plus a price cap, which suggests about 2–3 points per stat filter. K≈8–10 is probably still allowed [I].
- I applied `rankedWeights` client-side to 20 fetched chests (weight × mod value, which is what trade2 would compute). Spearman correlation with the engine score is only **0.42** [V]. The weights are measured on the *current* item's base (`:782`, `:833-841`), so they miss differences in base-type defences. Final ranking needs engine evaluation, which is cheap.
- None of those 20 chests reached PoB's minimum weight of 82 (their client-side sums were 13–73). All 40 items evaluated were downgrades, because they were the cheapest matches (sorted by price, ascending) [V]. The fallback should sort towards quality instead: `price desc` under the cap, or the top weighted stat (`"stat.<id>":"desc"`). Neither sort was tested on trade2 [I].

**Candidates vs rate limit.** I'd suggest 30–50 candidates (3–5 fetches) by default, with a hard maximum of 100, one search page [I; measure in the trade unit against fixtures].

| Candidates | Fetches | Fetch wall time (RTT ≈0.2 s, spaced to respect 12 per 4 s) | Engine eval | Calls per 5 min before hitting the 50-per-300 s rule |
|---|---|---|---|---|
| 30 | 3 | ≈1.5 s | ≈0.75 s | 16 |
| 50 | 5 | ≈2.5 s | ≈1.25 s | 10 |
| 100 | 10 | ≈5 s (10 per 4 s and 10 per 12 s are both under the caps) | ≈2.5 s | 5 |

Each call also costs one search. The search rules (5 per 10 s, 15 per 60 s, 30 per 300 s) are not the bottleneck. Breaking the 16-per-12 s or 50-per-300 s fetch rule locks the whole IP out for 300 s, and that budget is shared with other trade tools. The TypeScript limiter must therefore budget each call up front and stop early, rather than waiting for a 429.

## Risks and unknowns

- **Auth [V/I].** Without a login, weighted search is impossible [V]. Whether `POESESSID` lifts the limit is unknown [I]. The anonymous fallback ranks well only if its prefilter and sort choice are good (above).
- **Filter budget [V code].** v0.23.1 caps the query at a flat 35 filters. Dev head instead budgets trade2 "complexity" (200 total: 54 for the weight group, 4 per filter; dev `TradeQueryGenerator.lua:1000-1001`). By that model, a 29-filter v0.23.1 query is about 191, so it sits right at the limit even when logged in [I]. Do the budgeting in TypeScript.
- **v0.23.1 vs dev head.** These files differ by 150–650 diff lines each. Dev head uses `new("X"):X(...)` constructors, adds a `blockedMods` "not" group and a pseudo-stat map, drops the `.query` wrapper, and passes the callback a table rather than JSON. A pin bump will break the shim, so keep it in one module guarded by a golden test.
- **`QueryMods.lua` freshness [V].** 2,178 of 2,179 v0.23.1 IDs exist in today's trade2 stats (stale: `rune.stat_3170380905`); dev head is 2,171 of 2,171. Regenerating the file needs lcurl (`:379-635`), so only a pin bump can refresh it.
- **Order of tied weights [V].** Entries with equal `meanStatDiff` come out in a different order from run to run (2 swaps seen), which changes what survives truncation. The shim breaks ties by ID.
- Not tested: unique and jewel rows (Megalomaniac, Heart of the Well, Against the Darkness) and radius jewels.

## Prototype

In [`S-1-prototype/`](S-1-prototype/) (copied from the session scratchpad; the raw live fetch `fetch_body.json` and eval outputs were not kept because they contain unanonymized third-party listings — use `tests/fixtures/trade2/` instead):
- Scripts: `TradeShim.lua` (shim), `run.lua` (driver, with cwd = PoB `src/`), `live_check*.py`
- Requests: `req_*.json`
- Generated queries: `q_*.json`; `q_body_count.json` is the anonymously accepted `count` variant

To reproduce, run `luajit run.lua <build.xml> <req.json> <out.json>` from the v0.23.1 `src/` with `LUA_PATH="../runtime/lua/?.lua;../runtime/lua/?/init.lua;;"`. To evaluate the committed fixtures, send a request with `"op":"evaluate"` and `"fetchBodyFile"` set to the **absolute** path of `tests/fixtures/trade2/fetch-*.response.json`, because paths resolve from PoB `src/`.

Essential code:

```lua
local gen = new("TradeQueryGenerator", { itemsTab = build.itemsTab })      -- cached
gen.lastMaxPrice, gen.lastMaxPriceTypeIndex, gen.lastMaxLevel = nil, nil, nil
gen.tradeTypeIndex = STATUS[req.status or "securable"]
gen.requesterContext = {}
gen.requesterCallback = function(_, json, err) result = { json = json, err = err } end
gen:StartQuery(build.itemsTab.slots[req.slot], options)
local co = gen.calcContext.co
while coroutine.status(co) ~= "dead" do
  local ok, err = coroutine.resume(co, gen)
  if not ok then gen.calcContext.co = nil; main:ClosePopup(); error(err) end
end
gen.calcContext.co = nil
local ranked = copyOf(gen.modWeights)                                       -- before truncation
gen:FinishQuery()                                                           -- → requesterCallback

-- evaluation
local tqr = new("TradeQueryRequests"); local items
tqr:FetchResultBlock("headless://", function(it) items = it end)
table.remove(tqr.requestQueue.fetch, 1).callback(fetchBody, nil)           -- PoB's own parser
local tq = new("TradeQuery", build.itemsTab); tq.tradeQueryGenerator = gen
local safe = tq:FilterToSafeItems(items, slot)
tq.statSortSelectionList = statWeights
local calcFunc, base = build.calcsTab:GetMiscCalculator()
for _, e in ipairs(safe) do
  local out = calcFunc({ repSlotName = slot, repItem = new("Item", e.item_string) })
  local score = gen.WeightedRatioOutputs(base, tq:ReduceOutput(out), statWeights)
  -- per stat: data.powerStatList.GetFromOutput(base|out, stat) → base/new/delta/pct
end
```
