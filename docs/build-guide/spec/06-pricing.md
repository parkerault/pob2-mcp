# Slice 06: Pricing, `/pob2:pricing`

**Status: written current 2026-11-09 (WU-167, D-525), as built at M-30.** Part of the project spine,
[`docs/spec/README.md`](../../spec/README.md) ("spine"), which wins any disagreement; fold fixes back into it. It
covers the pricing piece (D-520; contract C-64): its files, the pricing procedure it now holds (`pricing.md`, moved
from build-guide's references), the replace cost, the place on the ladder and the upgrades within a budget, and the
piece runs as pricing uses them (D-516, C-61, whose detail is slice 03's). Its work unit is WU-163, built, with
WU-168's pricing cases, open; its criteria AC-W155 and AC-W160's pricing part. Its source is amendment 16
(`amendment-16-pieces-and-launch.md`, approved 2026-11-08, cited "a16 §n"), §12 and §16 with Appendix A.2, A.6 and
A.10, and the work-log's record of M-30 (`../worklog.md`, "WL:n", WL:7449 on), which wins where the build differs from
the amendment's text: each difference is stated where it applies, and the coordinator's calls are marked so. Slice 03
§9 keeps the pipeline's pricing procedure as it grew (D-133 to D-494), with a note pointing here; the procedure's text
is the pricing piece's since M-30. Paths are root-relative: from the repository root, which is the plugin root (C-57).

## 1. Scope

Pricing answers what a player's character is worth and what to buy next (a16 §16; the user's answers 2 and 6, "both"):
what its gear costs to replace, the cheapest way to the same must-have stats; which endgame rung that cost places it
on ("The pricing stage should determine that, or the user can say the rung if trade is unavailable"); and, with a
budget the player names, the trade listings that improve it within that budget.

In scope:
- the piece's `SKILL.md`, `references/pricing.md` (the pricing procedure, moved) and `references/stages/price.md` (its
  one coordinator step), in `skills/pricing/`;
- the league a run prices in, the replace cost, an owned rare's spec, the place, the upgrades and `upgrades.json`;
- the run checker's pricing rules on a pricing run (`placement`, `owned-spec`, `upgrades`, with the pipeline's
  `pricing`, `nfr-22`, `offline-prices`, `budget`, `listing` and `spec`);
- `price.md`'s placement scope (`stage: "place"`), which compile's better round and a file run run to place a character;
- the requests it answers: "what is my gear worth", "how much would it cost to rebuild my character", "price my build
  MyCharacter123", "is my character budget or non-budget", "which rung is my character on", "what should I buy for 50
  divines" (its description);
- its real cases (§6).

Out of scope, each with its home:
- reading the file into a plan: the file reader, `plan_from_build` (slice 05), which pricing's runner calls;
- measuring the character or making it better: `/pob2:compile` (slice 05);
- a guide, from a brief or from the player's own build: `/pob2:build-guide` (slice 03);
- a game question: `/pob2:game-knowledge` (slice 04);
- the pipeline's own pricing steps (R1b, D1-build, D1-finish, D1-gate, D2): they keep pricing inline and read the
  procedure at its new path (a16 §16; the drafter's call, recorded); slice 03 §9 keeps their history;
- the trade tools themselves (C-14, C-49): unchanged; only their use is capped at the player's budget.

## 2. The contract

C-64 in the spine is the binding summary; this section gives its detail as built.

### 2.1 What it reads

- **The shared rules first:** `skills/build-guide/references/runner-rules.md`, read whole before anything else and
  after a compaction (D-501), its trade rules among them: one trade client at a time, the notice before pricing, a
  stop ends the run (C-61).
- **The player's file,** through the reader only (`plan_from_build`, C-62; slice 05 §2.1): a builds-folder build
  matched by name against `list_builds` (the runner asks when none or several match, never guessing), or an import code,
  which goes only to the reader. A request naming no build lists the builds and asks.
- **The read plan and `read.json`**: the one read stage (id `f`, its `source`, its items, tree jewels and groups marked
  owned), `importLeague`, the loadout, `left`; the runner reads the stage once through `guide_run {view}`, for the
  notice's count, and never reads `plan.json` or a record whole.
- **`run-log.json`**: an open pricing stop (its last `pricing.stops[]` entry with no resume after it) and `noNinja`.
- **The pricing procedure,** `skills/pricing/references/pricing.md`, which `price.md` names for the rest: its tools, the
  order, which tool prices what, the targets and price days, the spec loop's depth price (D-483), recording a price,
  classifying outcomes, the pace (D-461), after pricing stops, the final re-price pass, the conversion to a price day
  (D-373), reporting the calls and offline mode.
- **The trade site and poe.ninja,** only through the server's price tools (`search_trade_items`, `find_upgrades`,
  `get_item_price`, `get_currency_rates`, `get_leagues`), never fetched; the exchange for what it sells.

### 2.2 What it writes

All of it in its run folder, `Guides/pricing/<date>-<n>/`, at the folder's root (C-61; Appendix A.6's pricing row):
`run-log.json`; `source.xml`, `plan.json` and `read.json` (the reader); `compile-record.json` and `compiled-build.xml`
(the step's measure-only compile); `prices.md` and, with a budget, `upgrades.json` (the step). In `plan.json` the step
writes only `league`, `prices[]` and the place; the runner writes only `upgrades.json`'s `chosen` and `spent`, at the
display. Nothing goes into the builds folder, and the player's file is never written. As built, F1's root files
(`final-build.xml`, `readback.json`) still fail a pricing run's `layout` (WL:7572–7573).

### 2.3 The rules it follows

- **The steps** (`skills/pricing/SKILL.md`): start (`guide_run {new_run: "pricing"}`; online, `pob2-league-digest
  --running --out <leagueFolder>`, D-523; `pob2-run-log <runFolder> init` with `piece: "pricing"` and `source`; the
  budget asked once when `--budget` wasn't given); `read` (the reader's questions as an interview; the Spirit question is
  compile's, and pricing measures the file as read); the notice; `price` (one fresh `pob2:build-guide-coordinator`,
  alone); the display; the end (`pob2-check-run`, status `completed` or `stopped`).
- **The notice** (D-461; `CLAUDE.md`'s 30 searches without asking): online, before any trade request, the runner tells
  the player that pricing starts, the most searches it makes, that they go at least 45 s apart, and that their browser
  shares the limit. **As built** (the coordinator's call, WL:7866–7869, :7916–7919): the bound is counted from one view
  of the read stage, 2 a rare item or rare tree jewel (its depth check and the thin retry), 1 a unique or a magic or
  normal item (flasks and charms aside), 1 a socketed rune, soul core or idol (the exchange may not list it), and with a
  budget 2 a gear slot; over 30 the player's yes comes first; the bound goes in the header as `maxSearches`, and the
  step never makes more (a `find_upgrades` call counted by its reply's `Searches <n>`). Offline, no notice and
  `maxSearches` 0.
- **The step's header** (C-36's task header): `stage: "price"` (or `"place"`), `buildFolder: "."`, `compile:
  "measure-only"`, and the piece's own four, `league`, `budget`, `rung` and `maxSearches`. As built these four are in
  `price.md` only; a16 Appendix A.2 wasn't updated for them (WL:7820, :7917).
- **Loading the character:** a measure-only compile first, since `find_upgrades` and `manage_sets` act on the loaded
  build; `measure_as: "non-budget"` only while the read stage is unplaced, and a placed stage (a resume, or a run again)
  is measured as its own rung, since `compile_plan` refuses `measure_as` on it (WL:7860–7862, :7913–7915).
- **The league** (the user's "no trade between leagues"): the header's `league` when the player gave one; else the
  file's `importLeague` when `get_leagues` lists it and it isn't Standard, hardcore or SSF; otherwise, before any
  search, the step returns `league: ask (<leagues>)` and the runner asks. Trade's league for designs (D-20) is
  unchanged.
- **The rates,** online without `--no-ninja`: one `get_currency_rates` call, each currency the prices use recorded in
  `prices[]` as an entry `rate-<currency id>`, which the run checker reads (as built, WL:7817).
- **The replace cost** (D-520): every filled slot of the read stage but its flasks and charms (D-472; charms deferred)
  and every tree jewel, each its own entry, `id` `f-<slot>` (`f-jewel-<node>` for a tree jewel), `query.slot` naming
  the slot as `find_upgrades` names it (as built, WL:7818):
  - **an owned rare** (gear or a tree jewel) by its spec (below), at the spec loop's depth price: the 5th cheapest of
    at least 10 found. A thin result (fewer than 10) is checked once more without its 4th must-have, which goes to the
    spec's `leftOut` with the why `thin with it: <count>`; still thin, `unavailable` (as built, WL:7819–7820, :7922);
  - **a unique** by its name with `get_item_price`, its price the summary's median (as built, WL:7819–7820); a
    corrupted one by the corruption rule (D-471, D-484): a cheap one priced uncorrupted, a dear one's extra socket as
    that corrupted copy;
  - **a magic or normal item** with `search_trade_items` and its mods;
  - **what its sockets hold**, each rune, soul core or idol its own entry (`<item id>-socket-<k>`, `query.socket`), by
    name from poe.ninja's exchange; an owned "Legacy of …" soul core or Raven-Touched Shard is the character's own,
    priced the same (D-519's exemption from D-465);
  - **the gems** (a16 §16's "uncut gems"; the coordinator's call, WL:7866–7867, :7880–7883): each gem of the read
    stage's groups but a granted skill, its own entry `f-gem-<group>-<gem>`, from the exchange: a skill gem as `Uncut
    Skill Gem (Level <n>)`, a Spirit gem as `Uncut Spirit Gem (Level <n>)`, a gem corrupted +1 at its level less 1, a
    support as `Uncut Support Gem (Level <its tier>)`, a lineage support by its own name; counted by the place. The doer
    had left gems unpriced; the ruling holds them to §16's list, as the pipeline's own procedure prices a lineage support
    by name;
  - before any search, an entry the plan holds with the same item, query and league is reused (D-169): a resume reuses
    every price a stopped run left.
- **An owned rare's spec** (the coordinator's call "a guide's rares as must-have stats", accepted; also a file run's
  placed rung, slice 03): its must-haves are the 3 or 4 of its own explicit lines that rank highest in PoB's weights for
  the slot (`find_upgrades {link_only: true}` gives PoB's top 12 with no request, D-494), each at the lowest roll of the
  tier its value falls in at the item's own item level (at most 82); a fractured line searched as a plain explicit mod
  (`price-fractured-as-plain`), a crafted or desecrated line by its text, a corrupted implicit left out; the depth check
  `corrupted: false`. The entry's `spec` is `{base, weights, ranking, mustHaves, leftOut, searches}`. The checker's
  `owned-spec` holds each spec to the owned item's lines.
- **The place** (answer 2; D-371's targets; choices A and B), from the replace cost:
  - below the endgame (level under 65, the first waystone tier's area level, or the owner's word): no rung, "in the
    campaign", the stage staying `f`;
  - the cost known (online, rates recorded, every entry `ok`): `m` when the whole cost's midpoint is at most 5 divines;
    else `b` when no rare's, rare tree jewel's or unique's own midpoint is over 5 divines (choice B); else `n`, said to
    be over 200 divines when its day-21 midpoint is. As built, a midpoint within 0.1 divine of 5 allows either side,
    the gates' margin (`check-run.mjs`'s `targetMargin`; WL:7821–7822);
  - the cost unknown (offline, a stop before every item is priced, `--no-ninja`, an `unavailable` price): the player
    names the rung, the step returning `place: ask` until the header's `rung` holds it; never assumed `n`. A missing
    cookie isn't "without trade": depth checks search anonymously;
  - placing renames the stage to its rung's id and adds `variant`, `ascendancyPoints` and `variantBasis`; price ids keep
    `f-`. A resume may place again.
- **The upgrades** (answer 6; C-14's use capped at the budget): with a budget, online, no open stop and not
  `--no-ninja`, one `find_upgrades` call per gear slot, the price capped at the budget, one call at a time; each listing
  with its price, PoB's gains (Full DPS and EHP as fractions, the lowest max hit's type and change) and its link. Without
  a cookie each slot gets `find_upgrades`' link alone. With no budget, no upgrade search runs and no `upgrades.json` is
  written (as built, WL:7821). Upgrades are listings, which improve this character; a guide names specs
  (`guide-items-are-specs`). The player picks at the display: three unlike gains have no exchange rate
  (`targets-not-vetoes`).
- **`prices.md`** (as built, WL:7818–7819, :7918–7919): `League:` and `Rates:` lines; `Searches: <made> of at most <max>.`,
  which the checker's `pricing` rule holds to the announced bound; the replace cost by slot with its day-7 range and the
  total; `Place: <rung or "in the campaign">, <by the replace cost | the user's word | by its level>.`, the third basis
  "by its level" only below the endgame, read by the checker's `placement`; the upgrades.
- **`upgrades.json`** (Appendix A.10): `{budget, league, checked, slots: [{slot, listings | link}], chosen, spent}`;
  the checker's third pricing rule, `upgrades`, holds its shape (as built, WL:7819).
- **A pricing stop ends the run** (D-516): when the step's counts hold `rate_limited`, `locked_out` or `pace`,
  `pob2-run-log` records it in `pricing.stops[]`; the runner asks for the rung first when none is placed (the step then
  runs once more with `rung`, making no trade request), sets the status `stopped`, tells the player when the lockout
  ends, and stops. A stop wins over a `place: ask` (WL:7922). `/pob2:pricing --resume <run folder>` after the lockout is
  the retry: the resume clears the stop, the budget and league come back from `upgrades.json` and `prices.md`, and the
  step reuses every price the plan holds (WL:7922–7923).
- **Owned content in a pricing run** (D-519): an owned item, group or tree jewel is exempt from the rules that would
  reject what the game allows (slice 05 §2.3), the checker's `spec` and `listing` among them. As built (a merge-forced
  change, WL:7933–7937): a price entry whose `query.slot` names an owned slot or tree jewel of the read stage is owned,
  exempt from `spec` and `listing` and held to `owned-spec`; in a file run, where other rungs sit beside the read stage,
  the pipeline's rules hold (slice 03).
- **The placement scope** (`stage: "place"`, `writes: ["plan.json"]`): the league, the replace cost and the place,
  nothing else. Compile's better round runs it (slice 05) and a file run runs it (slice 03), each in its own folder;
  `maxSearches` is counted without the upgrades (WL:7931–7933).
- **The routing** (choice F): its description quotes the requests above, and names `/pob2:build-guide` for a guide,
  `/pob2:compile` for measuring or improving, `/pob2:game-knowledge` for a game question.

## 3. Requirements

1. **One folder** (D-520; a16 §21): `skills/pricing/` holds `SKILL.md`, `references/pricing.md` and
   `references/stages/price.md`.
2. **`pricing.md` moved,** its text unchanged but for paths (a byte-identical rename, as built, WL:7857–7858), and no
   file under `skills/`, `agents/`, `src/`, `scripts/` (the words-loaded baseline aside) or `tests/` names the old path.
3. **The command** is `/pob2:pricing <build name or import code> [--budget <divines>] [--offline] [--no-ninja]`, or
   `--resume <run folder>`; a player's own words start it too.
4. **Its `SKILL.md`** has fewer than 150 lines (134 at M-30's last unit), frontmatter `name` and `description` only, at
   most 1,536 characters (1,184), quoting at least two requests in a player's words; its runner reads `runner-rules.md`
   whole first and after a compaction (D-501, D-505).
5. **It never writes the player's file** or the builds folder, and only coordinator steps price (D-178).
6. **Trade runs one client at a time,** announced first, never past the announced bound, with the player's yes above
   30 searches; a stop ends the run, and the resume after the lockout is the retry.
7. **The place is never assumed:** the replace cost places the character, or the player names the rung.
8. **Its real cases give** §6's expected results.

## 4. Acceptance criteria

- **AC-W155 (`/pob2:pricing`; WU-163).** `skills/pricing/SKILL.md` (fewer than 150 lines, `name` and `description`
  only, at most 1,536 characters, quoting at least two requests in a player's words) and `price.md` exist; `pricing.md`
  is at its new path, its text unchanged but for paths, and no file under `skills/`, `agents/`, `src/`, `scripts/` (the
  baseline aside) or `tests/` names the old one; `placement` gives `m`, `b` and `n` on three fixture price sets, `n` for
  a dear unique (choice B) and "in the campaign" for the importer fixture at level 50 (choice A), and `owned-spec`
  passes a16 §16's spec; each fails a planted fault; `price.md` asks for the rung without trade or under `--no-ninja`,
  and for an unlisted league; without a cookie the upgrades are links; `upgrades.json` has Appendix A.10's shape; online
  (through `fixtureFetch`) and offline fixture runs pass the checker; pipeline fixtures keep their results. Static, unit
  and engine tests: `tests/static/pricingPiece.test.ts` (its `SKILL.md`; `price.md`; `pricing.md` moved),
  `tests/unit/pricingPiece.test.ts` (`placement` on the ladder; the gems, the over-200 line and the searches line; the
  importer fixture read by `plan_from_build`; `upgrades.json`'s shape; the offline fixture run) and
  `tests/integration/pricingRun.test.ts` (the fixture runs online through `fixtureFetch` and offline, on the hand-built
  `tests/fixtures/builds/pricing-character.xml`, the resume after a stop and the server's real pace among them), with
  the fixture `tests/fixtures/pieces/pricing-run`. All HTTP goes through `fixtureFetch`, which throws on an unmatched
  URL; no trade or poe.ninja request was made (WL:7806–7807, :7871–7872). **Holds** (WU-163, merged at `56e9e22`).
- **AC-W160 (the pieces' real cases; WU-168, after M-30), pricing's part.** The work-log records, for each pricing run
  of §6: the request in a player's words and the command it started, the `pob2:` types started and their tool calls,
  the run folder, what it priced against §6's expected results, and the source's sha1 in `read.json` equal to its
  copy's. Recorded. **Open** until WU-168.

AC-W145 to AC-W147 (piece runs) are slice 03's and C-61's; AC-W146 holds a pricing run's stop and resume
(`tests/unit/pieceRuns.test.ts`, "AC-W146 (WU-159, D-516): a pricing stop ends a piece run, and a resume is the retry").
WU-163 also holds AC-W162: its changed assertions are listed in §5.

## 5. Work units

Status lines give the commits on the integration branch `build-guide/m30` (the work-log's M-30 section, WL:7449 on);
the coordinator remaps them to the signed commits at HG-8.

### WU-163: `/pob2:pricing`
- kind: build
- status: built (four commits on `327fefd`: the feature, its words-loaded entry, a fix round and phase 2; merged at
  `56e9e22`)
- depends-on: [WU-159, WU-161; phase 2 after WU-162]
- touches: [`skills/pricing/` (new: `SKILL.md`, `references/stages/price.md`; `references/pricing.md` moved from
  `skills/build-guide/references/`), every file naming the old path (build-guide's `SKILL.md`, `start.md`,
  `runner-rules.md`, `checkpoints.md`, `gates.md`, `offline-and-test.md`, `run-log.md`, `stages/README.md`, `R1b.md`,
  `D2.md`, `D1-build.md`, `D1-finish.md`, `agents/build-guide-coordinator.md`, `skills/game-knowledge/references/lookups.md`,
  `tests/helpers/skillPaths.ts`), `agents/build-guide-coordinator.md` (the `price` row, phase 2),
  `skills/compile/SKILL.md` (the placement line, phase 2), `skills/build-guide/scripts/check-run.mjs` (`placement`,
  `owned-spec`, `upgrades`, the owned replace cost), `scripts/words-loaded.baseline.json` (`since.price`),
  `tests/fixtures/builds/pricing-character.xml` (new), `tests/fixtures/pieces/pricing-run`, its three test files (new)]
- produces: [C-64; `/pob2:pricing`]
- acceptance: [AC-W155]
- milestone: M-30
- summary: The piece (a16 §16). As built (WL:7805–7822, :7855–7884, :7913–7951): §2.3's notice, header, league, rates,
  replace cost, gems, place, upgrades, `prices.md` and stop as built, with the coordinator's two rulings (gems priced;
  the notice's bound and the step's cap); the checker counts gem entries without requiring one per gem, since a
  passive's granted skill isn't a gem; uncut gems count no search (the exchange lists them); a placed stage measured as
  its own rung, tested through the real compile (a `rate_limited` stop, the player's rung `b`, the resume refused with
  `measure_as` and run without it, the stage placed again on `m`). Phase 2: the coordinator's `price` row beside
  `measure` (its `stage: "place"` running the placement scope alone) and compile's place line; the merge forced the
  owned replace cost's exemption (§2.3). Its words-loaded entry, `since.price`, names a lane commit, remapped at
  signing. **AC-W162's list** (each forced by D-520's move of `pricing.md`, values unchanged):
  `buildGuideAmendment11Design.test.ts`:446, `buildGuidePipeline.test.ts`:2198, :2894 (`SHARED_REF`), :2902, :2906,
  :2908, :4124, :4128 (through `referencePath`), `amendment15Paths.test.ts`:211, `amendment15Layout.test.ts`'s
  `withoutPaths`, `wordsLoaded.test.ts`'s `OLD_PRICING`, `pricingExchangeRule.test.ts`:12 and `skillPaths.ts`'s
  `referencePath`; WU-159's `pieces/pricing-run` fixture now placed on `b` with `query.slot` and a spec (the head's
  checker fails the old one on `placement`); and, forced by phase 2's owned replace cost, one of WU-163's own
  assertions (a planted stray spec also fails `spec`).

### WU-168: the pieces' real cases (pricing's part)
- kind: human, then the coordinator
- status: open; after M-30 merges
- depends-on: [M-30's merge; HG-38; HG-39]
- touches: [the work-log]
- acceptance: [AC-W160 (pricing's part)]
- milestone: M-30
- summary: §6's runs, offline, the user naming the rung; a trade run only with the user's approval, announced.

Pricing's other text came with other units: WU-159 (piece runs: `init`'s pricing fields, the step `price`, the stop
that ends a piece run, the resume; slice 03) and WU-166 (the fetch line in its start; slices 01 and 04).

## 6. Real cases

**How they're run:** as slice 05 §6 says (a16 §20; choice G, HG-38, HG-39): after M-30 merges, in a `--plugin-dir`
session with the server rebuilt and reconnected, each run started from a request in a player's words, every step
asked of a `pob2:` type, each character read from the builds folder by the name the user gives and checked unchanged
by sha1 against its copy in `~/pob2-real-cases/`. **Offline, the user naming the rung** (a16 §20): a trade run only
with the user's approval, announced, one client, at the server's pace (`CLAUDE.md`).

1. **ResurrectForbidden, offline.** A request such as "what is my gear worth? my build is ResurrectForbidden" starts
   `/pob2:pricing`. Expected: the read and its questions as slice 05 §6's case 1 (the main skill asked; no Spirit
   question, since pricing measures the file as read); no notice and `maxSearches` 0; the runner asks for the rung
   after the read (level 100, in the endgame); the step's measure-only compile with `measure_as` (the stage unplaced),
   every entry `unavailable` with the note `offline run`, `league` null, no rates, no upgrades and no `upgrades.json`;
   the stage placed on the rung the user named, renamed to its id with `variant`, `ascendancyPoints` and
   `variantBasis`; `prices.md`'s `Place: <the rung>, the user's word.`; `pob2-check-run` passes; status `completed`.
2. **CullTheConquerer, offline.** As case 1, a request such as "price my build CullTheConquerer"; level 70, in the
   endgame. Its `importLeague` is Forbidden Rites, which an online run would price in when trade lists it.
3. **An online run, only with the user's approval.** The notice first, with its bound counted from the read stage
   (2 a rare or rare jewel, 1 a unique, magic or normal item or socketed rune, 2 a gear slot with a budget), the
   player's yes over 30; the league: CullTheConquerer's `importLeague` when trade lists it, while ResurrectForbidden,
   with none, is asked about; the place by the replace cost, `prices.md`'s `Searches:` line never past the bound; on the
   first 429, `rate_limited` or `locked_out`, the run ends `stopped` with the lockout's end told, and the resume after
   it is the retry.

The campaign path (choice A) has no real case; the importer fixture read at level 50 is placed "in the campaign"
(AC-W155).
