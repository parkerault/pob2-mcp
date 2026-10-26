# D1-finish: the anoint, prices, ledger and claims (`build-guide-coordinator`)

The last of D1's three steps (D-356, D-418), a fresh coordinator step after D1-build (`D1-build.md`) and D1-tree
(`D1-tree.md`). D1-build left the three endgame rungs of `plan.json` (`m`, `b`, `n`) built and measured, with
their needs, and D1-tree spent their spare points and shortened their travel; you add the anoint on `b` and `n`,
price every slot, write the ledger (the boss estimate among it) and the claims, the needs' and the ascendancy
order's among them, measure the trades the design gate shows, and read the plan and the record through
`mcp__pob2__guide_run`'s views, never whole. A fresh D1 gate step (`D1-gate.md`) then checks the plan.

## Inputs

- **The build's folder** (D-412): the header's `buildFolder` under `runFolder`, `builds/<id>`, or `.` for a run
  migrated from schema 3. `plan.json`, `compile-record.json` and the compiled XML are there; below, a bare
  `plan.json` or `compile-record.json` is that folder's, and `<plan>` is `<runFolderRel>/<buildFolder>/plan.json`
  (`<runFolderRel>/plan.json` when `buildFolder` is `.`). The cards, `run-log.json` and the other builds' folders
  are at the run folder's root.
- **Header:** `stage: "D1-finish"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`, `buildFolder`,
  `compile: "measure-only"`, `writes: ["<buildFolder>/plan.json", "<buildFolder>/trades.json"]`, `accepted`
  (findings the user accepted; they need no fix), and `findings`:
  - on a D1 gate retry, the findings D1-build had: fix the ones that are yours (a price, the anoint, a claim);
  - on a D1 gate retry for its `tree` part (`tree-swap`), or a tree revision, D1-tree ran before you and moved
    the trees: re-measure the anoint (step 1), anoint a rung D1-tree left without one (it removes an anoint whose
    notable a swap allocated), write the claims of the needs it added (step 4), and fix every claim that names a
    node the tree no longer holds;
  - the user's request from the design gate's `revise:<text>` or a final-gate revision (`code:
    "user-request"`), when it concerns the anoint, the prices, the ledger or the claims, which you make;
  - in the fix round, the V4 findings routed to D1 (`{id, artifact, location, claim, issue, evidence, hinge,
    owner}`).
- **`changed`**, only when D1-build ran before you in the same fix round, revision or design-gate `revise:`:
  the locations D1-build returned (`plan.json stages[6].items`). Then "After D1-build" below is your job.
- **Prompt:** how to price in this run (offline; stopped; or paced), and with `--no-ninja` that there are no
  currency rates; D1-tree's `unspent: <rung> <k>: <why>` lines, each a `reason` claim on that rung saying why
  its regular points aren't all spent (D-418); D1-build's `left out:` lines, each a `reason` claim on its first
  stage (D-396); and its `lever unpulled:` and `override:` lines, each a `reason` claim on the first endgame
  stage (D-406, D-407).
- **Read**, the independent calls in one response:
  - each rung: `mcp__pob2__guide_run {view: {plan: "<plan>", stage: "<id>"}}` for `m`, `b`
    and `n`, batched. A view gives the stage's section of the plan (its `tree.needs` among it), its key-figure
    line from the record and whether the plan's build changed since that compile. Its JSON isn't `plan.json`'s
    formatting: to anchor an Edit, Grep or Read `plan.json` at that place;
  - the claims: `mcp__pob2__guide_run {view: {plan: "<plan>", claims: true}}`, one line each;
  - `<buildFolder>/pieces.md` (D-434), when D1-build wrote it: its `scheduled` and `out` rows, for step 4's
    pieces' claims;
  - the card `cards/<id>.md` (its chain, enabler, links and estimates: the hinge facts), and `run-log.json`
    (is pricing stopped, D-444? a `pricing.stops[]` entry with no `retry-pricing` answer in `pricing.retries[]`
    and no resume, `resumes[].lengths.stages`, after it: `references/run-log.md`, "Pricing stops");
  - the reference files `.claude/skills/build-guide/references/toughness-targets.json` (D-441: the non-budget
    rung's `TotalEHP` targets by engagement, 20,000 close and 15,000 distance, `under` 0.9 and `over` 1.5 of
    the target) and `.claude/skills/build-guide/references/boss-floor.json` (D-448: the non-budget rung's boss
    figure floor, 250,000), for step 5, and `<buildFolder>/trades.json` when it exists (D1-tree's `unmodelled`
    entries);
  - prices to reuse: Grep the run's other plans (`concepts/*/plan.json`, `builds/*/plan.json`) for `"prices"`
    and Read the hits.

## Work

1. **The anoint** (D-358), on `b` and `n` only; `m` has none (it is a plan error there).
   - Pick one valuable notable that is **off the stage's tree, or costly to path to** (many points from the
     tree), and that the stage's tree doesn't allocate. Find candidates with `mcp__pob2__search_tree_nodes` and
     `mcp__pob2__get_passive_upgrades` on the loaded build.
   - Write it as `items.anoint {notable, reason}` on the stage. The compiler writes `{enchant}Allocates
     <notable>` on the stage's amulet, which PoB grants with no path and no point, and refuses a notable with
     no recipe of three Distilled Emotions, one the tree allocates, or a stage without an amulet.
   - **Measure it** with a measure-only compile (`mcp__pob2__compile_plan {plan_path:
     "<plan>", measure_only: true, stages: ["b", "n"]}`), against the key-figure lines
     before it. Prefer what the rung lacks: EHP or the Arbiter verdict when the Arbiter one-shots it, else the
     named source's damage (its `damage <map> against map monsters, <boss> against a Pinnacle boss`). `reason`
     states what it adds, as measured, and why it isn't on the tree.
   - The record gives its recipe (`stages.<id>.anoint`: the notable, its node id and the three emotions);
     the guide names both, and `m` points ahead to `b`'s.
2. **Prices.** One `prices[]` entry per filled slot and tree jewel of **every** rung (D-249, D-281), ids
   `m-<slot>`, `b-<slot>` and `n-<slot>` (`m-boots`, `b-ring1`, `b-jewel-<node>`), and the anoint like a slot,
   `b-anoint` and `n-anoint`: its item the recipe's three emotions, `query` each emotion's query and `amount`
   their sum. The targets (D-370): `m` about 5 divines in all at day-7 prices; each rare of `b` about 5 at day
   7, and each rare of `n` its own at day 21, as D1-build wrote them in their entries' `query.target`. Two slots
   share an entry only when their item text is identical. No item-base or mod-tier search serves crafting
   (D-348): the guide names mods to buy on trade. Reuse an entry with the same item, query and league from any
   plan of this run first.
   - **The rares of `b` and `n`: the weighted search** (D-372), `mcp__pob2__find_upgrades`, PoB2's "trade for
     these items", from the entry D1-build wrote (`query.slot`, `query.required`, `query.target`). Step 1's
     measure-only compile loaded `b` and `n` (with no step 1 compile, as in a fix round, make it first);
     select `b`'s loadout (`mcp__pob2__manage_sets {set_type: "loadout", action: "select", title: "<b's
     loadout name, as the record has it>"}`) and price its rares, then `n`'s. Per rare: map each required
     affix to its trade id with `mcp__pob2__trade_query_options {slot}`, and call `mcp__pob2__find_upgrades`
     with `required_mods` (those ids with their minimums), `max_price` (below), `currency:
     "exalted_equivalent"`, `rank_by: "stat_value"`, `include_non_upgrades: true` and `fetch_pages: 1`, plus
     `jewel_type` for a tree jewel, as `mcp__pob2__trade_query_options` gives it. The first listing is the best item the budget buys: its price is the entry's `amount`
     and `currency`, its score against the designed item the `note` (`fit 85%`). When no listing fits, the
     slot is over its target: call `mcp__pob2__search_trade_items` with the slot's item type and its required
     affixes as `mods` (`{stat_id, min}`, the same trade ids); the trade site sorts that search by price, so
     its first listing is the cheapest with the required affixes, and its price is the entry's, with the
     `note` `over target`. The entry's `query` keeps `slot`, `required` and `target` and adds the call's
     arguments. With `--no-ninja`, make only the `mcp__pob2__search_trade_items` call.
   - **`max_price`** (D-373) is the target turned into today's market: the target over the midpoint of its
     factors in `data/economy/prices.json`, times the run's exalts per divine, a whole number. The factors are
     the rung's price day's (`conversion.under-10.to-day-<7|21>`; when that puts the budget at 10 divines or
     more, `conversion.10-or-more.to-day-<7|21>`). The market's league day is today's date less the league's
     `start`; past day 60 or the league's `end`, the low factor goes over 4 and the high over 2; before day 21
     the factors are 1. `b`'s 5 divines on day 41: the midpoint of ×0.4–0.9 is 0.65, so 7.7 divines, 3077
     exalts at 400 a divine.
   - **Everything else:** a unique, and every item the currency exchange sells (a rune, soul core or idol in a
     socket, an anoint's Distilled Emotions, a lineage support gem), by `mcp__pob2__get_item_price`, by name:
     exchange items from poe.ninja's exchange by their category, with no trade request, the trade site for the
     rest (D-444, `references/pricing.md`); a magic or normal item, a flask, a charm, and every slot of `m` by
     `mcp__pob2__search_trade_items` with `mods`. One item per call. **Boots** (D-440): `m`'s boots search carries
     its tier's movement speed among `mods` (30%), and `b`'s and `n`'s rare boots name theirs in `required` (35%,
     D1-build wrote it).
   - **An over-target rare keeps its item** (D-371). You may add a fallback entry, `<id>-fallback`
     (`b-amulet-fallback`): fewer or lower required affixes, priced the same way, with the same target. The
     guide shows it beside the slot and says it isn't measured. Never change the build for a price.
   - An entry: `{id, item, query, amount, currency, date, league, status, note?}`, `league` the plan's, `date`
     the result's `Checked:` date; `unavailable` has `amount` and `currency` null and a `note`.
   - Classify a failed call by its `[trade:<kind>]` prefix only: `would_wait` (price others, call it again
     later; its third refusal makes it `unavailable`, note `rate-limited`); `locked_out` or `rate_limited` (stop
     trade-site pricing until a gate's `retry-pricing` or a resume, D-444: every remaining item the trade site
     prices `unavailable`, while exchange items keep their price); any other kind, `unavailable`. The
     prefix may stand anywhere in the line: `mcp__pob2__find_upgrades` reads `Stopped early: [trade:<kind>]
     <reason>.`.
   - Offline: no price call; every entry is `unavailable`, note `offline run`, `league` null, dated the run
     folder's date, D1-build's `not priced yet` entries included. Pricing stopped: no trade-site call;
     `unavailable`, note `pricing stopped`, and no tool that sends a trade request at all (D-422, D-444:
     `mcp__pob2__get_leagues`, `mcp__pob2__get_item_price` for an item the trade site prices,
     `mcp__pob2__search_trade_items`, `mcp__pob2__search_stats`, `mcp__pob2__find_upgrades`);
     `mcp__pob2__trade_query_options` sends none, and `mcp__pob2__get_item_price` for an exchange item reads
     poe.ninja's currency exchange, so both stay allowed (the latter not with `--no-ninja`). League `unverified`
     (D1-build's return): `unavailable`, note `trade unreachable`. Count every call by its outcome for your
     return, an exchange item's as `exchange`.
3. **Ledger** (D-106, as D-352 and D-353 narrow it). A ledger entry `{id, claim, formula, inputs}`, its
   inputs tagged, holds a hand calculation only where PoB doesn't model a mechanic the build relies on: a
   `possibly unread` line D1-build measured as unread, or a partly parsed line, which PoB applies none of. The
   record measures the rest (`stages.<id>.measures`: the named source's damage against map monsters and against
   a Pinnacle boss, EHP, the Arbiter verdict on `b` and `n`, a rough clear speed), so write no `hit_*` entry, no
   Arbiter report, and no kill time, hits to kill or mapping signal. A ledger edit never needs a recompile.
   - **The boss estimate** (D-447): the user (2026-10-25), "Estimate DPS the same way you'd do for our guides".
     On each rung, write a ledger entry `boss_<stage>` where PoB can't read part of the boss rotation
     (`skills.boss`, D1-build's), and **always when the rotation has a `triggered` entry or an entry with
     `turns`** (the run checker fails a rung without it then). Read the rotation's measure by Grep of
     `compile-record.json`: `stages.<id>.measures.bossGroups[]` (each entry's `figure`, `usesPerSecond`,
     `triggered`, `triggeredBy`, `turns`, `ignite`, `bleed`, `poison`), `measures.damage.boss` (PoB alone: the
     untriggered entries summed, an ailment that doesn't stack once) and each entry's `CastRate` and `Cooldown`
     in its record fields. The figure is **sustained** damage per second over one cycle of the rotation, not a
     burst. Its formula starts from the record's boss figures by C-33's references, `<stage>.boss.g<group>s<skill>p<statSet>`
     (an entry's figure; `.ignite`, `.bleed`, `.poison` or `.usesPerSecond` after it for that field) and
     `<stage>.boss.measured` (PoB alone): at least one `boss.g` reference, and none outside the stage's rotation.
     Each other input carries its source tag (C-30); a stat no tool exposes (an ignite's stack potential, maximum
     charges, an ailment chance) is derived from game data as a `pob-data` input, or is a `judgment`. A correction
     lowers the figure as readily as it raises it. The corrections, by name:
     - **trigger rate:** a triggered spell's rate from its meta gem's energy rules and the build's crit, ailment
       or hit rate, in place of PoB's hand-cast speed; where two meta gems feed each other, the loop's rate; a
       gem never refills itself unless its text says so;
     - **procs:** per step, per hit or per metre; an on-hit proc counts per strike;
     - **landing:** projectiles, pillars, grenades or fragments that land on one boss beyond what PoB rates,
       within any cap on copies or hits (a pillar limit, a hit lockout); returning or nova projectiles count
       about half;
     - **hits per use:** a strike that hits more than once;
     - **buff:** a buff PoB has no stat for, applied as the stat its text grants, times its uptime; a buff on
       "your" skills reaches a totem's or a minion's skill only when its text says so;
     - **rotation share:** entries that take turns, each at its use time (a spell's `1 / CastRate`; an attack's
       or a channelled skill's from its gem or weapon data) within the cycle, and cooldowns from PoB's
       `Cooldown`; never `Speed` or `Time`, which a cooldown caps;
     - **burst over its cycle:** a charged or staged use (charges, stages, a cooldown) once per cycle;
     - **uptime:** a condition the plan sets whose duration (gem text) the cycle can't keep up;
     - **one ailment:** an ailment that doesn't stack counts once across the rotation, at its strongest entry,
       as PoB alone does.

     Its `claim` says what each correction corrects, a few words each, joined by `; ` and led by the
     correction's name ("trigger rate: Cast on Critical's 2.1 a second from the crit rate; one ailment: the
     ignite once"): the D1 gate shows them beside PoB's own figure. The entry's value is the rung's boss figure
     wherever it is shown; without the entry, the boss figure is `measures.damage.boss`.
4. **Claims** (D-351). A claim is written only where the build hinges, and its `kind` says which:
   - `hinge`: a fact whose being wrong would make the build fail at its rung: a trap (an interaction that
     breaks or kills the build, such as a main-hand weapon that switches the skill off, up to 4), the chaos
     exception's reason, an affix whose source narrows its slot's base, a trigger into the next rung;
   - `reason`: a reason resting on a measurement: why a support, node, item or the anoint is in (a measure-only
     compile with a temporary stage for the other option, the record or a ledger value; a shape from the pattern
     library cites its lookup and that measurement, never the library, D-375), a `left out:` gem, a
     `lever unpulled:` line (the lever, why, and the compiled figure it rests on), an `override:` line (PoB's
     first choice, ours, and what PoB can't measure that decides it), an either/or pick (up to 2, the deciding
     factor measured, and online the price difference), the named source in the single-target role, and each
     rung's buy order, one claim per rung (`m`'s buys toward its 5-divine target, `b`'s buy order, `n`'s upgrade
     order from `b`), the guide numbering them as you order them;
   - `reason`, for the tree and the reward picks (D-413, D-418):
     - **the needs:** every need of every rung's `tree.needs` gets a `reason` claim on its own stage, and you set
       its `claim` to that claim's id (one claim may cover several needs of its stage). It says what the nodes
       keep, naming them as `mcp__pob2__search_tree_nodes` names them, and why node power can't see it: sustain,
       an attribute a gem or item requires, area or movement for clear, a boss-only gain, the producer of an
       earned state, the user's request; a need with `stat` `TotalEHP` holds the floor (D1-tree writes one for a
       swap that failed the floor or V1 when measured). It cites the need's `stat` as a record field
       (`<stageId>.<stat>`) where it has one, else a lookup or a `judgment`. A need with no `claim`, or one
       naming no claim of its stage, is the D1 gate's V1 finding `missing-reason`; until you set them, every
       compile reports it, as expected;
     - **the ascendancy order:** one claim on `m`, id `m-ascendancy-order`, naming every node of `m`'s
       `tree.ascendancyNodes` by the name `mcp__pob2__search_tree_nodes {ascendancy: "<the roll's
       ascendancy>"}` gives it, in that array's order and no other, and why that order (what each adds when it is
       taken), tagged `pob-data` with the lookup as its ref. W1 renders it, since it reads no node ids, and V4
       checks its order against `ascendancyNodes`;
     - **the reward picks without D2**, in a plan with no campaign stage: one claim on `m` per pick D1-build
       made, the quest, the option taken and a one-line reason, citing
       `data:campaign/progress.json#q.<key>.options[<i>]`. The endgame guide names each pick with its reason.
   - `reason`, for the pieces (D-434), from `pieces.md`: one claim for each `scheduled` row (where it goes, as its
     Where says, and why: the boss button, the second weapon set and what the swap is for) on the first endgame
     stage that holds it, and one for each piece the card's `### Pieces` weighed that the build leaves out (its
     row's Why) on the first endgame stage, so W1 can explain the boss button and the swap. Cite the record's
     figure for a scheduled piece's group where it has one (`<stageId>.g<group>s<skill>p<statSet>.<Field>`), else
     a `judgment` naming the row and the drops its Why records. The `left out:` lines (D-396) stay for dead gems.

   What the compile proves carries no claim: requirements, gem and stage levels, record numbers, ledger
   values, prices and tree lists (a need's nodes aside), which the guide renders from the plan and the record. Superfluous content
   (kill times, minor picks) gets none: the run aims at most 56 claims. Never quote a
   `mcp__pob2__suggest_supports` gain as a number in a claim: it is a transient measurement no record field
   holds; state a support's effect from its gem text, a ledger entry or a record field.
   - **Sources.** Each claim has a `source` tag `{kind, ref, confidence?}` (`pob-computed` with a record field
     `<stageId>.<Field>`, `pob-data` with a lookup result, `judgment` with its reasoning and a confidence) or
     cites `ledger:<id>`, `price:<id>` or `data:<file>#<key>`, a JSON fact: a claim resting on a digest, index or
     monster-table entry cites its lookup, or a `judgment` naming the entry (D-400). Its source supports every
     part of it, each number, mechanic and qualifier; it cites each fact it rests on; and it carries its source's
     caveats (a confidence M or L, a disputed fact, a `judgment`). A `ledger:<id>` claim's numbers are the
     entry's value or its inputs, an input as written or × 100 as a percentage.
   - **Affix sources** (D-277): for each rare affix target, look the affix up
     (`mcp__pob2__lookup_game_data {mode: "mechanic", query: <the affix text>, kind: "mod"}`; with `kind:
     "essence"`, each `[essence]` hit names an essence and the item types it applies to). When the base types
     narrow the base, add a `hinge` claim naming the affix's source and the base it needs ("Arcane Surge on
     Crit is desecrated, so the gloves need energy shield"), tagged `pob-data` with the lookup as its ref.
     Affix targets are text: no tier labels and no trade links.
   - Offline: a claim that would need an external source is tagged `external-unavailable` (ref exactly
     `external source unavailable (offline run)`, with a confidence).
5. **The trades** (D-439, D-440, D-441, D-448), which the design gate shows for the user to take or leave: write
   `<buildFolder>/trades.json` whole (Writes), D1-tree's `unmodelled` entries as they are and your `boots`,
   `defence` and `damage` entries in place of the old ones. None is a gate failure.
   - **Boots** (D-440): one `boots` trade for each rung whose `items.bootsException` holds (its V1 note
     `boots-exception`): `what` the boots, their movement speed and how far under the tier ("Trampletoe, 25%
     movement speed, 10% under the tier"), `reason` the exception's, both changes null. Unique boots get this
     trade only, never the defence trade below; a defence trade's rare boots carry the tier's speed.
   - **The non-budget rung's band and floor.** Compile `n` measure-only (`stages: ["n"]`): its key-figure line
     gives its EHP (`TotalEHP`), its reply each ledger value (`boss_n = …`). The target is
     `toughness-targets.json`'s for the plan's `n.skills.engagement.kind`; the rung is **under** its band below
     `under` × the target (18,000 close, 13,500 distance), **over** it above `over` × the target (30,000 close,
     22,500 distance), else **within**. Its boss figure is the `boss_n` value when the plan has it, else
     `measures.damage.boss`; it is **under the floor** below `boss-floor.json`'s `floor`.
   - **A defence trade**, when the rung is under its band: each armour-slot unique other than boots with no
     life or energy shield and no resistances, against a defensive rare of its slot (life or energy shield and
     resistances) with the cheapest substitute for the unique's effect when the unique is a need (Crimson
     Assault for the Apron of Emiran's aggravation), measured with a temporary stage that copies the rung, both
     compiled measure-only (`stages` naming them), the temporary stage removed after; and node power's best
     swap ranked by `TotalEHP`, with **`MainDamage` allowed to fall at most 15%** (the arguments of `D1-tree.md`,
     "The arguments", with `stats: ["TotalEHP", "MainDamage"]` and `max_loss: {MainDamage: 15, clearUses: 2}`).
   - **A damage trade**, when the rung is over its band or under the floor: node power's best swap ranked by
     `MainDamage` (the same arguments, `stats: ["MainDamage", "TotalEHP"]`), its `TotalEHP` allowance as
     `max_loss: {TotalEHP: <the percent the rung's EHP may fall to it>, clearUses: 2}`, by the rung's band, **the
     three allowances**: over its band, no lower than
     the target; within it, no lower than the band's bottom (90% of the target); already under it, by at most
     15%. A rung under the floor and over its band has one damage trade; one under the floor and under its band
     shows both trades, and the user picks. Its `bossAfter` is the boss figure × (1 + `damageChange` / 100):
     the boss figure moves with the named source's.
   - Each trade found gives its EHP and damage changes in percent (`ehpChange`, `damageChange`), `what` the move
     ("moving 4 points from <nodes> to <nodes>", "a rare body with life and resistances and Crimson Assault"),
     `reason` why it is shown ("under the toughness band", "under the boss floor"). When none is found, the
     trade says so: `what: "none found: <why>"`, its changes and `bossAfter` null. The run checker fails a rung
     out of its band, or under the floor, with no trade of its kind.
6. **Validate** with `mcp__pob2__guide_run {validate: "<plan>"}` until it reports no error.
   No final compile: the D1 gate compiles.
7. **Claim.** `done`. A price over its target is information for the user (D-371): it never sends the design
   back.

## The fix round and revisions (D-264, D-352)

With V4 findings or the user's requests in `findings`, you edit the plan in place; you never write it anew.

1. **Fix the claims in place**, with Edit. For each finding, fix every claim the issue touches, wherever it
   is in your stages, not only the flagged location: its wording, its citation (`source`), its caveat, or
   its source itself. A `hinge: no` finding is fixed by removing or narrowing the statement, never by new
   research or a recompile. A fact an existing claim already states is cited from that claim, never added again
   as a duplicate.
2. **Recompile only for a build change**: gear (an item, a tree jewel, a flask or charm, the anoint, or a price
   entry), the tree, the gems or the config (earned or scenario). The anoint and a price entry are yours:
   change them, measure as step 1 does, and the D1 gate runs after you. Any other build change is
   D1-build's: make none, and return its finding ids as `build: <ids>`; the runner runs D1-build with them,
   then D1-tree (every D1-build is followed by the tree step, D-418), then you once more, then the gates, in the
   same attempt, your outcome logged `build` (D-446).
   - **After D1-build** (your header has `changed`): D1-build made the build changes; you follow them.
     Re-price each slot whose item changed, re-measure the anoint on a changed rung (step 1's measure-only
     compile), and fix the claims and the ledger on what moved. Never return `build:` for a finding D1-build
     handled: a build change still missing is the D1 gate's to find. Return `done`; the D1 gate runs after you.
     A piece whose `pieces.md` row moved has its claim fixed, added or removed with it (step 4), and the boss
     estimate and the trades follow the build (steps 3 and 5).
3. **A ledger edit needs no recompile.** A change to a ledger entry's formula, inputs or claim text needs no
   recompile and no gate: the record's `buildSha1` leaves out the ledger, and the run checker re-evaluates
   the plan's current ledger (D-352). A price's `note` is wording too, which `buildSha1` leaves out (D-386).
4. **Otherwise compile nothing.** A claims-only edit changes only `stages[].claims`, `source` and `tag` fields,
   a need's `claim` (D-266 leaves it out of `buildSha1`), the `ledger` and prices' `note`s; anything else, a respec's note or a `chaosResistException`'s reason included, is a build
   change (step 2). After your edits, validate once (`mcp__pob2__guide_run {validate:
   "<plan>"}`) so the plan still validates, and leave `compile-record.json` and the PoB file
   as the final compile left them: no gate runs after you, and the run checker requires the sha1 of the plan
   without its claims, sources, tags, ledger and price notes to equal the final record's `buildSha1` (D-266, D-352, D-386).

## Writes

`<buildFolder>/plan.json`, and `<buildFolder>/trades.json` (step 5; outside `buildSha1`, so a trade changes no
compile). The server writes the record and the XML beside it.

```json
{"trades": [
  {"stage": "n", "kind": "defence", "what": "a rare body with life and resistances and Crimson Assault",
   "ehpChange": 17, "damageChange": -9, "bossAfter": null, "reason": "under the toughness band"},
  {"stage": "n", "kind": "damage", "what": "moving 4 points from Bone Breaker to Vicious Bite",
   "ehpChange": -6, "damageChange": 12, "bossAfter": 201600, "reason": "under the boss floor"}
]}
```

## Returns

At most 8 lines: `done`; how many `mcp__pob2__compile_plan` calls you made; the anoint of `b` and `n`; your
price calls counted by outcome (`prices: ok 12, exchange 4, would_wait 1`, or `prices: none`); the trades by
kind (`trades: boots 1, defence 1, damage 1`, or `trades: none`); and in the fix round or a
revision, `recompiled: yes` or `recompiled: no`, the finding ids you fixed and the locations you changed
(`plan.json stages[3].claims[2]`, `plan.json ledger[4]`), and `build: <ids>` when D1-build must make a change.

```
D1-finish r1-a-2 attempt 1: done
compiles: 3
anoint: b Unbending, n Unbending
prices: none (offline)
trades: defence 1, damage 1
```

```
D1-finish r1-a-2 attempt 3: done
recompiled: no
fixed: v4-1-2, v4-1-4
changed: plan.json stages[6].claims[2], plan.json ledger[4]
build: v4-1-3
```

## Fault directives

None. FI-2 and FI-3 are the D1 gate's (`D1-gate.md`).
