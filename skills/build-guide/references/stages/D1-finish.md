# D1-finish: the anoint, prices, ledger and claims (`build-guide-coordinator`)

The last of D1's three steps (D-356, D-418), a fresh coordinator step after D1-build (`skills/build-guide/references/stages/D1-build.md`) and D1-tree
(`skills/build-guide/references/stages/D1-tree.md`). D1-build left the three endgame rungs of `plan.json` (`m`, `b`, `n`) built and measured, with
their needs, and D1-tree spent their spare points and shortened their travel; you add the anoint on `b` and `n`,
price every slot, re-check D1-build's boss estimate and write the rest of the ledger and the claims, the needs',
the ascendancy order's and the boss fall's among them, measure the trades the design gate shows, and read the plan
and the record through
`mcp__pob2__guide_run`'s views, never whole. A fresh D1 gate step (`skills/build-guide/references/stages/D1-gate.md`) then checks the plan. In a revision-14
run two narrower jobs come to you by the header's `scope` (D-481, D-486): a one-item swap (`swap`) and the late endgame
scaling pass (`scaling`), each below ("The `swap` scope", "The `scaling` scope").

## Inputs

- **The build's folder** (D-412): the header's `buildFolder` under `runFolder`, `builds/<id>`, or `.` for a run
  migrated from schema 3. `plan.json`, `compile-record.json` and the compiled XML are there; below, a bare
  `plan.json` or `compile-record.json` is that folder's, and `<plan>` is `<runFolderRel>/<buildFolder>/plan.json`
  (`<runFolderRel>/plan.json` when `buildFolder` is `.`). The cards, `run-log.json` and the other builds' folders
  are at the run folder's root.
- **Header:** `stage: "D1-finish"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`, `buildFolder`,
  `compile: "measure-only"`, `writes: ["<buildFolder>/plan.json", "<buildFolder>/trades.json"]` (the `scaling` kind
  beside your own kinds, D-486), `scope` (amendment 14, when the step is narrower: `"swap"` or `"scaling"`; absent,
  the whole step below), `accepted` (findings the user accepted; they need no fix), and `findings`:
  - on a D1 gate retry, the findings D1-build had: fix the ones that are yours (a price, the anoint, a claim);
  - on a D1 gate retry for its `tree` part (`tree-swap`), or a tree revision, D1-tree ran before you and moved
    the trees: re-measure the anoint (step 1), anoint a rung D1-tree left without one (it removes an anoint whose
    notable a swap allocated), write the claims of the needs it added and of its boss fall (step 4), and fix every
    claim that names a node the tree no longer holds;
  - the user's request from the design gate's `revise:<text>` or a final-gate revision (`code:
    "user-request"`), when it concerns the anoint, the prices, the ledger or the claims, or is a one-item swap
    (`scope: "swap"`), which you make. In a revision-14 run each carries its `id` and `words`, the user's text
    verbatim (for a read-back, `readback.json`'s changes) beside any restatement (D-482): make what the words say and
    nothing they don't, a condition as a condition, and return one `request:` line per request (Returns). **Never
    rewrite an item to match a listing** (D-483), whatever a brief says: a rare is a spec, and its price the depth
    of the market for it;
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
    and no resume, `resumes[].lengths.stages`, after it: `skills/build-guide/references/run-log.md`, "Pricing stops");
  - the reference files `skills/build-guide/references/toughness-targets.json` (D-441: the non-budget
    rung's `TotalEHP` targets by engagement, 20,000 close and 15,000 distance, `under` 0.9 and `over` 1.5 of
    the target; D-449: `arbiter.hitsSurvivedFloor`, 0.8, the share of the Arbiter's hits a rung survives,
    evading or deflecting them, below which its one-shot row makes it a one-shot rung) and
    `skills/build-guide/references/boss-floor.json` (D-448: the non-budget rung's boss figure floor,
    250,000), for step 5, `skills/build-guide/references/corruption.json` (D-471: the cheap line, an
    uncorrupted price under 1 divine), and `<buildFolder>/trades.json` when it exists (D1-tree's `unmodelled` and
    `boss` entries, and in a revision-14 build D1-build's `scaling` finds);
  - `n`'s defence plan, `stages[].defence` (D-451; in its view): an evasion `base`, pure or hybrid, makes the
    build an evasion build for step 5's avoidance trade;
  - prices to reuse: Grep the run's other plans (`concepts/*/plan.json`, `builds/*/plan.json`) for `"prices"`
    and Read the hits.

## Work

1. **The anoint** (D-358), on `b` and `n` only; `m` has none (it is a plan error there).
   - Pick one valuable notable that is **off the stage's tree, or costly to path to** (many points from the
     tree), and that the stage's tree doesn't allocate. Find candidates with `mcp__pob2__search_tree_nodes` and
     `mcp__pob2__get_passive_upgrades` on the loaded build. **The anoint-only notables** (D-473: a notable with a
     recipe, no connections and the anoint frame, such as Thaumaturgic Generator; 16 at the pin) are always among
     the candidates: no tree reaches them, so `mcp__pob2__search_tree_nodes` finds them by their lines. No second
     anoint: its only way, the Raven-Touched Shard, is a rune over the budget (D-465).
   - Write it as `items.anoint {notable, reason}` on the stage. The compiler writes `{enchant}Allocates
     <notable>` on the stage's amulet, which PoB grants with no path and no point, and refuses a notable with
     no recipe of three Distilled Emotions, one the tree allocates, or a stage without an amulet.
   - **Measure it** with a measure-only compile (`mcp__pob2__compile_plan {plan_path:
     "<plan>", measure_only: true, stages: ["b", "n"]}`), against the key-figure lines
     before it. Prefer what the rung lacks: EHP or the Arbiter verdict when the Arbiter one-shots it, else the
     named source's damage (its `damage <map> against map monsters, <resisting> against resisting rares, <boss>
     against a Pinnacle boss`). `reason` states what it adds, as measured, and why it isn't on the tree.
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
   - **No entry for a Flask slot** (D-472): a plain flask costs nothing worth counting. **No entry for a pinned
     weapon's Swap slot** (`sameAs`, D-464): it is its set-1 slot's item, priced once by that slot's entry.
   - **The pace line first** (D-474; `skills/build-guide/references/pricing.md`, "Pace"): read your first trade call's reply for
     `Pace: 45 s between searches, at most 7 in 5 minutes.`; with no such line, or `Pace: off (test setting).`,
     make no more trade calls and return the stop `pace: missing` or `pace: off`, the call counted `pace`.
   - **`n`'s shares, re-split** (D-453), before you price: D1-tree adds a price entry for each tree jewel its
     socket tests take, so share `n`'s default 150 divines evenly again over its rares and rare tree jewels,
     keeping any share an entry's `query.target.reason` gives, and write each entry's `target.divines`. An
     over-target jewel keeps its lines, like any over-target rare (a minion build's `b` jewel among them).
   - **One trade call at a time** (D-461): the server waits at least 45 s between one search and the next, inside
     the call, and refuses a wait over 60 s (`would_wait`); calls in parallel queue past it, so never batch them.
   - **The rares of `b` and `n`: specs** (D-483; `skills/build-guide/references/pricing.md`, "A rare of `b` or `n`: the spec loop"). In a
     revision-14 run D1-build priced each rare gear slot of `b` and `n` by the spec loop as it designed it; you
     **re-price each spec as compiled**, by one depth check at its must-haves' tiers (the `mcp__pob2__search_trade_items`
     call its `query` records: the base, the must-haves as `mods` at their tiers' lowest rolls, `corrupted: false`, the
     base's standard rune sockets, `limit: 10`), writing its `amount`, `currency`, `date`, `listing` and `note` again;
     reuse D1-build's entry while its query and league are the same (D-169). You never re-run the loop on a gear slot,
     **never edit an item for its price, and never rewrite an item to a listing**: a listing's lines never enter the
     plan. A spec whose depth check now fails its target stays as compiled, its price recorded (an `over-target`
     finding at the gate). With `--no-ninja`, make only the `mcp__pob2__search_trade_items` call.
   - **D1-tree's rare jewels: the loop** (D-483). D1-tree wrote each rare jewel it took with its lines as must-haves at
     their best tier allowed and left its entry `not priced yet`. For each, with its rung loaded (step 1's compile,
     the rung's loadout selected): rank its lines, `mcp__pob2__find_upgrades {slot: "Jewel <node>", link_only: true,
     sort_stats: <the build's weights>, weight_corrupted_mods: false, jewel_type}` (the loop's step 1), to order their
     importance (step 4), then run the loop's steps 5 to 10 on it: the depth check at its tiers (`n` first), the
     budget search, the depth check at the mix, lowering the least important line a tier or dropping it. The one
     exception to "never edit an item for its price": you may lower that jewel's tiers or drop a line as the loop
     says, never add one; then re-measure it on its rung (a measure-only compile) and write its `spec` (its `ranking`
     PoB's top 4 the jewel's base can roll; 2 prefixes and 2 suffixes at most) and `listing`. The dearer jewel the loop
     started from is your `scaling` find (step 5).
   - **`m`'s rares** are specs too (D-483): their must-haves at their floor tiers' lowest rolls, priced by one depth
     check (`mcp__pob2__search_trade_items`, `limit: 10`) by the depth rule, with no `spec` field; `m`'s magic and
     normal items by `mods` as below.
   - **The depth rule** (D-483): a price is the 5th-cheapest of at least 10 listings sorted by price, its `listing`
     `{corrupted, sockets, count, position}` (the search's `Found:` count, `position` 5) and its `note` the count and
     the position (`18 found, the 5th cheapest`), never a listing's name. Under 10 found, the loop's step 8 (lower,
     drop, another source) applies to a spec it may change (a jewel); a spec it may not change is `unavailable`, note
     `thin: <count>`. Pass `rune_behaviour: "remove"` on every `mcp__pob2__find_upgrades` pricing call.
   - **Weapons by compile** (D-456): never compare weapons by a listing's DPS. `mcp__pob2__find_upgrades` scores
     by PoB's Full DPS, which isn't the build's figure (D-437), so compare weapon specs on the build's own damage
     figure (D-483: specs, never listings): each on a temporary stage (id `tmp…`, D-453) that copies the rung with
     that weapon, compiled measure-only with the rung, its map figure read and the stage removed; the entry records the
     spec that measures best within the budget, and its `note` says it was re-checked by compile. A build priced
     before revision 14 re-checked its top 3 weapon listings this way.
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
     rest (D-444, `skills/build-guide/references/pricing.md`); a magic or normal item, and every slot of `m` by
     `mcp__pob2__search_trade_items` with `mods`. One item per call. **A unique whose corruption or sockets matter**
     (D-484): `mcp__pob2__get_item_price` can't filter or show either, so a unique whose plan copy is corrupted (but
     for the cheap rule below, priced uncorrupted by name) or holds more sockets than its own is priced by `mcp__pob2__search_trade_items
     {item_name, corrupted: <as the plan's copy>, min_rune_sockets: <the plan's count when above the unique's own>,
     limit: 10}` by the depth rule, its `listing` matching the compiled copy; a random-roll unique (Morior Invictus)
     adds `mods`, each line the figures rely on at its range's midpoint. **Boots** (D-440): `m`'s boots search carries
     its tier's movement speed among `mods` (30%), and `b`'s and `n`'s rare boots name theirs in `required` (35%,
     D1-build wrote it) in a build before revision 14. In a revision-14 run it is a must-have of the boots' spec (35%,
     D1-build's), held at the tier and never lowered or dropped (D-483), so your depth check carries it among `mods`.
   - **A corrupted unique is priced uncorrupted** (D-471): by name, without the corrupted line as a required
     affix, its `note` `priced uncorrupted: buy copies and corrupt until one rolls <line>`. Under
     `skills/build-guide/references/corruption.json`'s line (1 divine, at the run's rates) it keeps the line; at or over it, it can't
     carry one: return `build: corruption <stage> <slot>` (`build: corruption n Ring 1`), and the runner sends the
     attempt back to D1-build to drop the line (D-446's route). With no price to judge by (offline, an
     `unavailable` price, pricing stopped, `--no-ninja` with no rates) the line stays and the `note` adds
     `cheapness unchecked: <why>` (offline, the note `offline run` says it). A gem's corruption costs nothing to
     price: the gem is priced as any gem. **A unique that isn't cheap with the extra socket** (D-484): its corrupted
     copy, `Corrupted` and one socket more than its own, is allowed when that copy is in budget: price it as that
     corrupted copy (`corrupted: true`, `min_rune_sockets` the plan's count), never uncorrupted; its corruption
     implicits never enter a rung (return `build: corruption <stage> <slot>` for one that does).
   - **A unique jewel** (D-473) is priced by name (Megalomaniac by `mcp__pob2__search_trade_items` on the line it
     allocates), with **no `target`** in its query, which would send it to the weighted search; its budget share
     (`b` 5 divines like a rare jewel, `n` its share) stays in its `note`. An option-form stat (Megalomaniac's
     "Allocates <notable>") is unverified on the trade site until the live test: an `unavailable` price with its
     note is expected.
   - **A slot that serves a set-2 skill** (D-473; `pieces.md`'s `## Skill levels`): pass `mcp__pob2__find_upgrades`
     `sort_stats` weighting that skill (from the stats `mcp__pob2__trade_query_options` lists), since the default
     weights read the main skill (`skills/build-guide/references/pricing.md`, "A rare of `b` or `n`").
   - **No fallback entry** in a revision-14 build (D-483): the dearer spec is a find over the budget (`trades.json`,
     kind `scaling`, step 5), never a `<id>-fallback` entry (the run checker's `budget` fails one). A build whose last
     D1 gate ran before revision 14 keeps its older rule: an over-target rare kept its item (D-371), and you may add
     its fallback entry, `<id>-fallback` (`b-amulet-fallback`), with fewer or lower required affixes, priced the same
     way, which the guide shows beside the slot. Never change the build for a price, but for a
     corrupted line on a unique at or over the cheap line (D-471, above) and D1-tree's jewels (the loop, above).
   - An entry: `{id, item, query, amount, currency, date, league, status, note?, listing?, spec?}`, `league` the
     plan's, `date` the result's `Checked:` date; `unavailable` has `amount` and `currency` null and a `note`;
     `listing` on a price read from a search's listings (D-484), `spec` on a `b` or `n` rare (D-483), both outside
     `buildSha1` (`skills/build-guide/references/pricing.md`, "Recording a price"). **The priced copy matches the compiled copy**: a
     listing's corruption is the item's `Corrupted` line and its rune sockets at least the item's, but for a cheap
     unique priced uncorrupted, whose `note` says so.
   - Classify a failed call by its `[trade:<kind>]` prefix only: `would_wait` (price others, call it again
     later; its third refusal makes it `unavailable`, note `rate-limited`); `locked_out` or `rate_limited` (stop
     trade-site pricing until a gate's `retry-pricing` or a resume, D-444: every remaining item the trade site
     prices `unavailable`, while exchange items keep their price); any other kind, `unavailable`. The
     prefix may stand anywhere in the line: `mcp__pob2__find_upgrades` reads `Stopped early: [trade:<kind>]
     <reason>.`. Its stop with no prefix, `Stopped early: the 45 s gap between trade searches cut the loop short
     after <n> search(es).`, returned the best listings of the searches it ran: price from them (D-461). Its
     **fallback** (D-494) starts `[trade:no_session] `, `[trade:session_rejected] ` or `[trade:too_complex] `, then
     `Trade search not run: …`: the first two are a session problem for this step (price the rest by depth checks,
     which search anonymously; the runner tells the user), the third a cue to drop the least important must-have
     and call again; an item is `unavailable` only after its own failed call.
   - Offline: no price call; every entry is `unavailable`, note `offline run`, `league` null, dated the run
     folder's date, D1-build's `not priced yet` entries included. Pricing stopped: no trade-site call;
     `unavailable`, note `pricing stopped`, and no tool that sends a trade request at all (D-422, D-444:
     `mcp__pob2__get_leagues`, `mcp__pob2__get_item_price` for an item the trade site prices,
     `mcp__pob2__search_trade_items`, `mcp__pob2__search_stats`, `mcp__pob2__find_upgrades`);
     `mcp__pob2__trade_query_options` and `mcp__pob2__find_upgrades {link_only: true}` send none (a jewel's spec is
     ranked, its tiers kept as D1-tree wrote them), and `mcp__pob2__get_item_price` for an exchange item reads
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
     A ledger entry `boss_<stage>` stands for the rotation where PoB can't read part of it (`skills.boss`), and
     **always when the rotation has a `triggered` entry or an entry with `turns`** (the run checker fails a rung
     without it then). **D1-build writes it** in those cases (D-468), so D1-tree judges the tree on it; **re-check it
     after the anoint and the gear**, by the rules below: its record references re-evaluate at each compile, but its
     corrections (time shares, trigger rates and the like) stand until you check them again. Write it yourself on a
     rung where PoB can't read another part of the rotation. Read the rotation's measure by Grep of
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
       area or movement for clear, a boss-only gain, another damage group or a mechanic PoB doesn't measure, the
       producer of an earned state, the user's request (no attribute need: D-467); a need with `stat` `TotalEHP`
       holds the floor (D1-tree writes one for a swap that failed the floor or V1 when measured); a need with no
       `stat` that D1-tree's boss target wrote names the boss floor it keeps (D-468), not the toughness floor; a
       deflection or evasion need says what it does for the hits survived (D-451). It cites the need's `stat` as a
       record field
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
       `data:campaign/progress.json#q.<key>.options[<i>]`. The endgame guide names each pick with its reason;
     - **the boss fall** (D-468): on a rung whose `tree.search.bossFall` holds D1-tree's reason, one `reason` claim,
       id `boss-fall-<rung>`, saying why the fall of the boss figure or its entries is fine, citing the figures it
       compares (`tree.start` and `tree.end`) and what the fall buys, from the record (`<stageId>.<Field>`): V4
       checks it against its source as it checks a hinge claim, and the D1 gate's design field names it;
     - **a boss fall after gear moved** (D-490): when gear changed after D1-tree (your own prices' re-measures, a
       jewel the loop lowered, a one-item swap) and the rung's boss figure at your last compile is more than 2% under
       `tree.end`'s, the same claim `boss-fall-<rung>` (one claim covering D1-tree's reason too) names the item that
       moved it and why the fall is fine; after a swap it cites the plan's `itemSwaps[]` record;
     - **a buff entry's value** (D-468): a boss-rotation entry whose own figure misleads (a warcry whose own hit is
       its figure, while its buff carries the rotation) is valued by the boss figure with and without it, each on a
       temporary stage: one `reason` claim, id `boss-value-<rung>-g<group>`, its text starting `valued by <the buff,
       in a few words>: <+x>% to the rotation` ("valued by the exposure: +6% to the rotation"), citing both
       measures. The D1 gate shows it beside the entry, as the designer's;
     - **no mana flask** (D-472): on a rung D1-build left without a mana flask, one claim saying the build spends no
       mana (Blood Magic), citing the node or item that moves the costs.
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
     entry's value or its inputs, an input as written or × 100 as a percentage. **The value too** (D-494): the
     entry's value × 100 is its percentage, so a claim of 86% against an entry evaluating to 0.86 holds, as the run
     checker's ledger rule reads it.
   - **Affix sources** (D-277): for each rare affix target, look the affix up
     (`mcp__pob2__lookup_game_data {mode: "mechanic", query: <the affix text>, kind: "mod"}`; with `kind:
     "essence"`, each `[essence]` hit names an essence and the item types it applies to). When the base types
     narrow the base, add a `hinge` claim naming the affix's source and the base it needs ("Arcane Surge on
     Crit is desecrated, so the gloves need energy shield"), tagged `pob-data` with the lookup as its ref.
     Affix targets are text: no tier labels and no trade links.
   - Offline: a claim that would need an external source is tagged `external-unavailable` (ref exactly
     `external source unavailable (offline run)`, with a confidence).
5. **The trades** (D-439, D-440, D-441, D-448, D-450, D-468), which the design gate shows for the user to take or
   leave: write `<buildFolder>/trades.json` whole (Writes), D1-tree's `unmodelled` and `boss` entries as they are
   and your `boots`, `defence`, `damage` and `avoidance` entries in place of the old ones. None is a gate failure. In
   a revision-14 build D1-build's `scaling` finds stay too, but for the measure and the price you add (below), and
   your own `scaling` finds (`by: "D1-finish"`) replace only your old ones.
   - **Revision 14's fields** (D-486): every entry also carries `price {amount, currency, count, date} | null`, `from`
     and `to` (by unique name or base and key affixes, or `null`): on a trade that buys gear (a defence trade's rare,
     the avoidance trade's gear line, a swap's item) `from` the item it replaces, `to` the one it puts in and `price`
     the new item's depth price; on a tree move or a finding of none, all three `null`.
   - **Finds over the budget** (D-486, D-483): your own loops' dearer specs (a D1-tree jewel the loop lowered, a
     swap's rare) are `scaling` finds, `{stage, kind: "scaling", slot, from, to, price, damage, ehp, measured,
     repriced, by: "D1-finish"}`. **Measure the finds**, at most 5 a build, the largest gains first (D1-build's
     estimates among them): each on a temporary stage that copies the rung with the dear item in the slot, compiled
     measure-only with the rung, its `damage` and `ehp` the changes in percent and `measured: true` written on the
     entry, whoever wrote it (its `by` stays); the plan is restored after. Finds stay out of the rungs and their
     totals: no price entry and no `basis.budget.slots` entry names one.
   - **Boots** (D-440): one `boots` trade for each rung whose `items.bootsException` holds (its V1 note
     `boots-exception`): `what` the boots, their movement speed and how far under the tier ("Trampletoe, 25%
     movement speed, 10% under the tier"), `reason` the exception's, both changes null. Unique boots get this
     trade only, never the defence trade below; a defence trade's rare boots carry the tier's speed.
   - **Each trade is measured on a temporary stage** (D-453, D-456): an id `tmp…` that copies the rung with the
     move made, compiled measure-only with the rung (`stages` naming both) and removed after. Read there its EHP
     and damage changes, the Arbiter's **deciding row** (below) by Grep of `compile-record.json`'s
     `measures.arbiter.rows` (its max hit from the Pinnacle pass and its hits survived), and **each boss-rotation
     entry** of `measures.bossGroups`, triggered entries included. `bossAfter` comes from that measure: the
     temporary stage's boss figure (`measures.damage.boss`, or on a rung the plan estimates, `boss_<stage>`'s
     formula read over the temporary stage's entries), never the boss figure × (1 + `damageChange` / 100). The
     boss is judged on the rotation (D-468): a trade's `bossAfter` shows it, and no per-entry cut is named or
     undone. Trades stay the user's choice: nothing is undone.
   - Node power's calls in a trade keep the rung's needs only (`skills/build-guide/references/stages/D1-tree.md`, "The arguments"; D-450), so a trade on
     `n` may free nodes the budget rung holds, and (D-467) pass D1-tree's other arguments **without `targets`**, so
     their `max_loss` allowances judge EHP as before (D-448's three, below). The damage trade passes
     `pace_exchange: 3` in place of `clearUses: 2` (the user's one rule); the defence trade, which buys toughness,
     passes no `pace_exchange` and keeps `clearUses: 2` in its `max_loss`.
   - **The rungs' readings.** Compile `b` and `n` measure-only (`stages: ["b", "n"]`): each key-figure line gives
     its EHP (`TotalEHP`), its lowest max hit and its Arbiter verdict, the reply each ledger value (`boss_n = …`).
     A rung's **deciding row** is its one-shot row with the lowest hits survived, else its row with the largest
     ratio; the rung is a **one-shot rung** (D-449) when that row is `one-shot` and its `hitsSurvived` / 100 is
     below `skills/build-guide/references/toughness-targets.json`'s `arbiter.hitsSurvivedFloor`, 0.8, read unrounded (79.6% is under it). On
     `n`, the target is `skills/build-guide/references/toughness-targets.json`'s for the plan's `n.skills.engagement.kind`; the rung is
     **under** its band below `under` × the target (18,000 close, 13,500 distance), **over** it above `over` × the
     target (30,000 close, 22,500 distance), else **within**. Its boss figure is the `boss_n` value when the plan
     has it, else `measures.damage.boss`; it is **under the floor** below `skills/build-guide/references/boss-floor.json`'s `floor`.
   - **The defence trade on a one-shot rung** (D-450), `b` or `n`, whatever its band: within the defence trade's
     allowance (damage may fall at most 15%), measure, each on its temporary stage:
     1. **pool lines**: the build's pool line (life, energy shield, or mana under damage taken from mana first) on
        a rare slot that can roll it, at a realistic roll, in place of the slot's least valuable line;
     2. on a build that evades or deflects, **avoidance sources**: deflection and evasion nodes within reach, a
        rare slot's deflection or evasion line, more deflected share;
     3. **tree moves**: node power's best swap ranked by `TotalEHP` and its best unallocated EHP nodes (`stats:
        ["TotalEHP", "MainDamage"]`, `limit: 15`), up to 5 of them measured for the deciding row's max hit (node
        power can't rank by it);
     4. the unique-against-rare comparison below, when the rung has an armour-slot unique with no life, energy
        shield or resistances.

     Write up to three `defence` entries, in this order: **first every entry that clears the rung** (its deciding
     row survives the full hit, or reaches the floor), pool lines first among them; then the rest, by hits
     survived on a build that evades or deflects, else by the deciding row's max hit. A pool line that doesn't
     clear stays in the list, and a clearing entry is never cut for one that doesn't. Each carries `maxHit {type,
     before, after}`, the deciding row's max hit, and on a build that evades or deflects `hitsSurvived {before,
     after}`; its `reason` is `one-shot by the Arbiter's <type> hit`. None found: `none found: <why>`.
   - **Which max hit.** Every one-shot figure here (the `maxHit` fields, "clears the full hit", the damage trade's
     rule below) is the deciding row's max hit from the Pinnacle pass, measured on the temporary stage. Node power's
     `maxHit` guard reads the map measure, so it is only a pre-filter.
   - **A defence trade on `n` under its band** (D-441), when the rung isn't one-shot (a one-shot rung's trade above
     serves both): each armour-slot unique other than boots with no life or energy shield and no resistances,
     against a defensive rare of its slot (life or energy shield and resistances) with the cheapest substitute for
     the unique's effect when the unique is a need (Crimson Assault for the Apron of Emiran's aggravation), both
     measured; and node power's best swap ranked by `TotalEHP`, with **`MainDamage` allowed to fall at most 15%**
     (the arguments above, with `stats: ["TotalEHP", "MainDamage"]` and `max_loss: {MainDamage: 15, clearUses:
     2}`). Its `reason` is `under the toughness band`. **The best damage move beside them** (D-467): an `n` under
     its band also gets the damage trade below, so the user sees what damage the toughness costs.
   - **A damage trade**, when the rung is over its band, under it, or under the floor: node power's best swap
     ranked by `MainDamage` (the same arguments, `stats: ["MainDamage", "TotalEHP"]`), its `TotalEHP` allowance as
     `max_loss: {TotalEHP: <the percent the rung's EHP may fall to it>}` with `pace_exchange: 3`, by the rung's band,
     **the three allowances**: over its band, no lower than
     the target; within it, no lower than the band's bottom (90% of the target); already under it, by at most
     15%. A rung under the floor and over its band has one damage trade; one under its band shows its defence
     trades and the damage trade, and the user picks. Under the floor, D1-tree's `boss` trade, when it wrote one,
     shows the boss side too. **On a one-shot rung** a damage trade may not lower the deciding
     row's max hit: measure its move on the temporary stage, pass `maxHit: 0` in `max_loss` as a pre-filter when
     that type is the lowest max hit, and write its `maxHit` before and after.
   - **The avoidance trade** (D-450; the user, 2026-10-27, "measure, show, judge"), on `b` and `n` of every
     evasion build, pure or hybrid (`n`'s `defence.base` includes `evasion`), one-shot or not, so the user sees
     what more avoidance costs. Two `avoidance` entries, each with its EHP change, damage change and
     `hitsSurvived` before and after:
     - **the next avoidance spend**: up to 20 tree points on deflection and evasion nodes within reach
       (`mcp__pob2__search_tree_nodes`, `mcp__pob2__get_nearby_nodes`), taken by hits survived per point, each
       cluster with its path measured, the points freed from node power's weakest list (`limit: 50`); fewer
       points when the sources run out. Its `reason` says what the same points give on node power's best EHP
       nodes, measured the same way: "the same 20 points on the best EHP nodes: +14% EHP, hits survived 45%";
     - **a gear line**, at its price and 0 points: the best deflection or evasion line a rare slot can roll
       (`mcp__pob2__lookup_game_data {mode: "mechanic", query: <the stat>, kind: "mod"}`), in place of the slot's
       least valuable line, its price in `what` ("a rare helmet's deflection rating line (about 2 divines, 0
       points)"; `price unknown` offline or while pricing is stopped).

     Above the floor the design keeps judging (the user: "80% is the floor, but that doesn't mean the agent
     shouldn't try to go higher if possible"): these entries say what more costs; none found is `none found:
     <why>`.
   - Each trade found gives its EHP and damage changes in percent (`ehpChange`, `damageChange`), `what` the move
     ("moving 4 points from <nodes> to <nodes>", "a rare body with life and resistances and Crimson Assault"),
     `reason` why it is shown ("one-shot by the Arbiter's physical hit", "under the toughness band", "over the
     toughness band", "under the boss floor"; a defence trade's reason is one of its first two). Every entry carries
     `maxHit` and `hitsSurvived` (D-450), `null` where they don't apply (`maxHit` on a one-shot rung's defence and
     damage entries; `hitsSurvived` on the defence and avoidance entries of a build that evades or deflects), and
     `bossEntries` and `nodes` (D-468, a build held to amendment 13), `null` on yours: only D1-tree's `boss` trade
     sets them. When none is found, the trade says so: `what: "none found: <why>"`, its changes, `bossAfter`,
     `maxHit` and `hitsSurvived` null. The run checker
     fails a one-shot rung with no `defence` entry, a damage trade on a one-shot rung whose `maxHit.after` is
     below `before`, an evasion build's `b` or `n` with no `avoidance` entry, a rung out of its band with no trade
     of its kind (an `n` under its band with no `damage` entry too), and an `n` under the floor at the gate with no
     `damage` or `boss` entry.
6. **Validate** with `mcp__pob2__guide_run {validate: "<plan>"}` until it reports no error.
   No final compile: the D1 gate compiles.
7. **Claim.** `done`. A price over its target is information for the user (D-371): it never sends the design
   back.

## The `swap` scope (D-481)

Your header's `scope: "swap"` (revision 14): the user asked, at the design gate or the final gate, for **one slot's
item**, on one or more rungs, and nothing else: a unique by name, a rare by the affixes the user names, or the one item
a read-back found changed (`readback.json`), with no gem, tree or config change. The runner routes it to you alone,
then the D1 gate (about 0.5M tokens, against about 1.3M for the full chain): no D1-build or D1-tree runs. A plan still
at schema 9 gets D1-build first, to move it to 10 (§25). Do only this:

1. **Write the item as the user gave it**: a read-back's item exactly as edited; a unique as named (its text from
   `mcp__pob2__lookup_game_data {mode: "unique"}`); a rare whose affixes the user named, those affixes as its
   must-haves, the spec loop (`skills/build-guide/references/pricing.md`) only setting the tiers the user didn't state and pricing it.
   Nothing the user didn't ask for is added (D-482): no extra affix, no "better roll" on `n`. A departure (the market
   holds no such item, a must-have the base can't roll) is returned as `request: <id> departs: <how>`, and the runner
   asks the user before the gate.
2. **Compile** the swapped rungs measure-only, and rewrite each one's `tree.end` from that compile with `endAfter:
   "swap"` (schema 10); `tree.start` stays as written.
3. **Re-measure your own trades** on the swapped rungs, each on its temporary stage as step 5 does, the plan restored
   after, so no trade is "measured on the earlier item" and every defence trade's reason stays one of its two forms.
4. **Drop D1-tree's `boss` trades** on the swapped rungs: they were measured on the old item, and stay out until the
   tree runs again. Its `unmodelled` trades stay (they name pieces, not measures of the item).
5. **Re-check the claims** that cite the slot or a figure that moved, **re-price the slot** (a `scaling` find when
   its loop left a dearer spec), and **record the swap** in the plan's `itemSwaps[]` (schema 10): `{stages, slot,
   from, to, bossBefore: {<stage>: <n>}, bossAfter: {<stage>: <n>}, reason}`, `from` and `to` by unique name or base
   and affixes, the boss figures before and after on each swapped rung; a boss figure that fell needs its `reason`,
   and the claim `boss-fall-<rung>` (step 4). On a rung whose `tree.end` reads `endAfter: "swap"`, the run checker
   takes that reason in place of the `boss` trade a fall on the tree needs, and of the `damage` or `boss` trade an
   `n` under the floor needs; a swap with no `itemSwaps[]` entry fails (`swap`).

```json
"itemSwaps": [{"stages": ["b", "n"], "slot": "Weapon 1", "from": "Voltaic Staff: +4 lightning spell levels, spell damage, cast speed",
               "to": "Voltaic Staff: +3 lightning spell levels, spell damage", "bossBefore": {"b": 310000, "n": 520000},
               "bossAfter": {"b": 296000, "n": 500000},
               "reason": "the user's 5-divine staff: one lightning spell level less, about 4% under the old staff's boss figure"}]
```

At the final gate (a guide build's), the swap then runs the D1 gate, F1, W1's patch and the re-check (`skills/build-guide/references/fix-round.md`).

## The `scaling` scope (D-486)

Your header's `scope: "scaling"` (revision 14): the user answered yes to "late endgame scaling, yes or no?" at the
design gate's accept, and you run before F1. Re-price the finds over the budget in `trades.json` (kind `scaling`) by
the depth rule (`skills/build-guide/references/pricing.md`), one depth check each, announced by the runner and paced like any pricing
step, **at most 15 trade searches a build**, and measure any of the top 5 (by gain) not yet measured, each on a
temporary stage as step 5 does. **Write only `trades.json`**: each find's `price` and `repriced: true`, and for a find
you measure, its `damage`, `ehp` and `measured: true`. **Restore the plan byte for byte**: Read its text before your
first temporary stage and Write that text back when you're done, so F1's check of the plan the gate passed (its
`planSha1`) holds. Finds stay out of the rungs and their totals. Offline, nothing is priced: the finds stay listed
unpriced (`price: null`). No claim, no price entry, no other file.

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
  {"stage": "n", "kind": "defence", "what": "a rare body with +90 life in place of its cold resistance line",
   "ehpChange": 6, "damageChange": 0, "bossAfter": 180000, "reason": "one-shot by the Arbiter's physical hit",
   "maxHit": {"type": "physical", "before": 3451, "after": 3520}, "hitsSurvived": {"before": 79.6, "after": 100},
   "bossEntries": null, "nodes": null, "price": {"amount": 3, "currency": "divine", "count": 14, "date": "2026-10-15"},
   "from": "Vaal Cuirass: armour, fire resistance, cold resistance", "to": "Vaal Cuirass: armour, fire resistance, life"},
  {"stage": "n", "kind": "defence", "what": "12 points into deflection (Freedom of Movement, Agile Succession)",
   "ehpChange": 4, "damageChange": -3, "bossAfter": 172800, "reason": "one-shot by the Arbiter's physical hit",
   "maxHit": {"type": "physical", "before": 3451, "after": 3451}, "hitsSurvived": {"before": 79.6, "after": 84.2},
   "bossEntries": null, "nodes": null, "price": null, "from": null, "to": null},
  {"stage": "n", "kind": "avoidance", "what": "20 points into deflection (Freedom of Movement, Agile Succession, Sure Footing)",
   "ehpChange": 6, "damageChange": -8, "bossAfter": 165600,
   "reason": "the same 20 points on the best EHP nodes: +14% EHP, hits survived 79%",
   "maxHit": null, "hitsSurvived": {"before": 79.6, "after": 90.1}, "bossEntries": null, "nodes": null, "price": null, "from": null, "to": null},
  {"stage": "n", "kind": "avoidance", "what": "a rare helmet's deflection rating line (about 2 divines, 0 points)",
   "ehpChange": 1, "damageChange": 0, "bossAfter": 180000, "reason": "in place of the helmet's least valuable line",
   "maxHit": null, "hitsSurvived": {"before": 79.6, "after": 82.4}, "bossEntries": null, "nodes": null,
   "price": {"amount": 2, "currency": "divine", "count": 21, "date": "2026-10-15"},
   "from": "Soldier Greathelm: life, cold resistance, stun threshold", "to": "Soldier Greathelm: life, cold resistance, deflection rating"},
  {"stage": "n", "kind": "damage", "what": "moving 4 points from Bone Breaker to Vicious Bite",
   "ehpChange": -6, "damageChange": 12, "bossAfter": 201600, "reason": "under the boss floor",
   "maxHit": {"type": "physical", "before": 3451, "after": 3451}, "hitsSurvived": null, "bossEntries": null,
   "nodes": null, "price": null, "from": null, "to": null},
  {"stage": "n", "kind": "scaling", "slot": "Jewel 26725", "from": "Ruby: cold damage, crit damage, cast speed, damage against rares",
   "to": "Ruby: cold damage, crit damage, cast speed", "price": {"amount": 30, "currency": "divine", "count": 11, "date": "2026-10-15"},
   "damage": 2.1, "ehp": 0, "measured": true, "repriced": false, "by": "D1-finish"}
]}
```

## Returns

At most 8 lines: `done`; how many `mcp__pob2__compile_plan` calls you made; the anoint of `b` and `n`; your
price calls counted by outcome (`prices: ok 12, exchange 4, would_wait 1`, or `prices: none`), and `pace: missing`
or `pace: off` when the pace line stopped your pricing (D-474); the trades by
kind (`trades: boots 1, defence 2, avoidance 2, damage 1`, or `trades: none`); and in the fix round or a
revision, `recompiled: yes` or `recompiled: no`, the finding ids you fixed and the locations you changed
(`plan.json stages[3].claims[2]`, `plan.json ledger[4]`), and `build: <ids>` when D1-build must make a change
(`build: corruption <stage> <slot>` for a unique too dear to carry its corrupted line, step 2). With a `scope`, the
first line names it (`D1-finish r1-s-2 attempt 2 (swap): done`), and a swap returns its `swap:` line, `swap: <slot> on
<stages>: <from> → <to>`; the scaling pass returns `finds: <n> repriced, <m> measured` and its price counts. Then,
outside the 8 lines, one `request: <id> made` or `request: <id> departs: <how>` line per user request (D-482).

```
D1-finish r1-a-2 attempt 1: done
compiles: 3
anoint: b Unbending, n Unbending
prices: none (offline)
trades: defence 2, avoidance 2, damage 1
```

```
D1-finish r1-a-2 attempt 3: done
recompiled: no
fixed: v4-1-2, v4-1-4
changed: plan.json stages[6].claims[2], plan.json ledger[4]
build: v4-1-3
```

```
D1-finish r1-s-2 attempt 2 (swap): done
compiles: 4
swap: Weapon 1 on b, n: Voltaic Staff: +4 lightning spell levels, spell damage, cast speed → Voltaic Staff: +3 lightning spell levels, spell damage
prices: ok 2
trades: defence 1, damage 1, scaling 1
request: u1 made
```

## Fault directives

None. FI-2 and FI-3 are the D1 gate's (`skills/build-guide/references/stages/D1-gate.md`).
