# D1-finish: the anoint, prices, ledger and claims (`build-guide-coordinator`)

The second of D1's two steps (D-356), a fresh coordinator step after D1-build (`D1-build.md`). D1-build left
the three endgame rungs of `plan.json` (`m`, `b`, `n`) built and measured; you add the anoint on `b` and `n`,
price every slot, write the ledger and the claims, and read the plan and the record through
`mcp__pob2__guide_run`'s views, never whole. A fresh D1 gate step (`D1-gate.md`) then checks the plan.

## Inputs

- **Header:** `stage: "D1-finish"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`,
  `compile: "measure-only"`, `writes: ["plan.json"]`, `accepted` (findings the user accepted; they need no
  fix), and `findings`:
  - on a D1 gate retry, the findings D1-build had: fix the ones that are yours (a price, the anoint, a claim);
  - the user's request from the design gate's `revise:<text>` or a final-gate revision (`code:
    "user-request"`), when it concerns the anoint, the prices, the ledger or the claims, which you make;
  - in the fix round, the V4 findings routed to D1 (`{id, artifact, location, claim, issue, evidence, hinge,
    owner}`).
- **`changed`**, only when D1-build ran before you in the same fix round, revision or design-gate `revise:`:
  the locations D1-build returned (`plan.json stages[6].items`). Then "After D1-build" below is your job.
- **Prompt:** how to price in this run (offline; stopped; or paced), and with `--no-ninja` that there are no
  currency rates.
- **Read**, the independent calls in one response:
  - each rung: `mcp__pob2__guide_run {view: {plan: "<runFolderRel>/plan.json", stage: "<id>"}}` for `m`, `b`
    and `n`, batched. A view gives the stage's section of the plan, its key-figure line from the record and
    whether the plan's build changed since that compile. Its JSON isn't `plan.json`'s formatting: to anchor an
    Edit, Grep or Read `plan.json` at that place;
  - the claims: `mcp__pob2__guide_run {view: {plan: "<runFolderRel>/plan.json", claims: true}}`, one line each;
  - the card `cards/<id>.md` (its chain, enabler, links and estimates: the hinge facts), and `run-log.json`
    (has pricing stopped? a `stages[]` entry whose `priceOutcomes` counts a `locked_out` or `rate_limited`
    call);
  - prices to reuse: Grep the run's other plans (`concepts/*/plan.json`) for `"prices"` and Read the hits.

## Work

1. **The anoint** (D-358), on `b` and `n` only; `m` has none (it is a plan error there).
   - Pick one valuable notable that is **off the stage's tree, or costly to path to** (many points from the
     tree), and that the stage's tree doesn't allocate. Find candidates with `mcp__pob2__search_tree_nodes` and
     `mcp__pob2__get_passive_upgrades` on the loaded build.
   - Write it as `items.anoint {notable, reason}` on the stage. The compiler writes `{enchant}Allocates
     <notable>` on the stage's amulet, which PoB grants with no path and no point, and refuses a notable with
     no recipe of three Distilled Emotions, one the tree allocates, or a stage without an amulet.
   - **Measure it** with a measure-only compile (`mcp__pob2__compile_plan {plan_path:
     "<runFolderRel>/plan.json", measure_only: true, stages: ["b", "n"]}`), against the key-figure lines
     before it. Prefer what the rung lacks: EHP or the Arbiter verdict when the Arbiter one-shots it, else the
     headline DPS. `reason` states what it adds, as measured, and why it isn't on the tree.
   - The record gives its recipe (`stages.<id>.anoint`: the notable, its node id and the three emotions);
     the guide names both, and `m` points ahead to `b`'s.
2. **Prices.** One `prices[]` entry per filled slot and tree jewel of **every** rung (D-249, D-281), ids
   `m-<slot>`, `b-<slot>` and `n-<slot>` (`m-boots`, `b-ring1`, `b-jewel-<node>`), and the anoint like a slot,
   `b-anoint` and `n-anoint`: its item the recipe's three emotions, `query` each emotion's query and `amount`
   their sum. `m`'s total aims at 5 divines, `b`'s at 20 (the D1 gate's budgets). Two slots share an entry
   only when their item text is identical. Rares are affix-target searches (`mcp__pob2__search_trade_items`
   with `mods`); a unique or an emotion is `mcp__pob2__get_item_price`, one item per call. No item-base or
   mod-tier search serves crafting (D-348): the guide names mods to buy on trade. Reuse an entry with the
   same item, query and league from any plan of this run first.
   - An entry: `{id, item, query, amount, currency, date, league, status}`, `league` the plan's, `date` the
     result's `Checked:` date; `unavailable` has `amount` and `currency` null and a `note`.
   - Classify a failed call by its `[trade:<kind>]` prefix only: `would_wait` (price others, call it again
     later; its third refusal makes it `unavailable`, note `rate-limited`); `locked_out` or `rate_limited` (stop
     pricing for the rest of the run: every remaining item `unavailable`); any other kind, `unavailable`.
   - Offline: no price call; every entry is `unavailable`, note `offline run`, `league` null, dated the run
     folder's date. Pricing stopped: no call; `unavailable`, note `pricing stopped`. League `unverified`
     (D1-build's return): `unavailable`, note `trade unreachable`. Count every call by its outcome for your
     return.
3. **Ledger** (D-106, as D-352 and D-353 narrow it). A ledger entry `{id, claim, formula, inputs}`, its
   inputs tagged, holds a hand calculation only where PoB doesn't model a mechanic the build relies on: a
   `possibly unread` line D1-build measured as unread, or a partly parsed line, which PoB applies none of. The
   record measures the rest (`stages.<id>.measures`: the headline DPS, EHP, the Arbiter verdict on `b` and `n`,
   a rough clear speed), so write no `hit_*` entry, no Arbiter report, and no kill time, hits to kill or
   mapping signal. A ledger edit never needs a recompile.
4. **Claims** (D-351). A claim is written only where the build hinges, and its `kind` says which:
   - `hinge`: a fact whose being wrong would make the build fail at its rung: a trap (an interaction that
     breaks or kills the build, such as a main-hand weapon that switches the skill off, up to 4), the chaos
     exception's reason, an affix whose source narrows its slot's base, a trigger into the next rung;
   - `reason`: a reason resting on a measurement: why a support, node, item or the anoint is in (a
     measure-only compile with a temporary stage for the other option, the record or a ledger value), an
     either/or pick (up to 2, the deciding factor measured, and online the price difference), the named
     source in the single-target role, and each rung's buy order, one claim per rung (`m`'s buys within 5
     divines, `b`'s buy order, `n`'s upgrade order from `b`), the guide numbering them as you order them.

   What the compile proves carries no claim: requirements, gem and stage levels, record numbers, ledger
   values, prices and tree lists, which the guide renders from the plan and the record. Superfluous content
   (kill times, minor picks) gets none: the run aims at most 56 claims. Never quote a
   `mcp__pob2__suggest_supports` gain as a number in a claim: it is a transient measurement no record field
   holds; state a support's effect from its gem text, a ledger entry or a record field.
   - **Sources.** Each claim has a `source` tag `{kind, ref, confidence?}` (`pob-computed` with a record field
     `<stageId>.<Field>`, `pob-data` with a lookup result, `judgment` with its reasoning and a confidence) or
     cites `ledger:<id>`, `price:<id>` or `data:<file>#<key>`. Its source supports every part of it, each
     number, mechanic and qualifier; it cites each fact it rests on; and it carries its source's caveats (a
     confidence M or L, a disputed fact, a `judgment`). A `ledger:<id>` claim's numbers are the entry's value or
     its inputs, an input as written or × 100 as a percentage.
   - **Affix sources** (D-277): for each rare affix target, look the affix up
     (`mcp__pob2__lookup_game_data {mode: "mechanic", query: <the affix text>, kind: "mod"}`; with `kind:
     "essence"`, each `[essence]` hit names an essence and the item types it applies to). When the base types
     narrow the base, add a `hinge` claim naming the affix's source and the base it needs ("Arcane Surge on
     Crit is desecrated, so the gloves need energy shield"), tagged `pob-data` with the lookup as its ref.
     Affix targets are text: no tier labels and no trade links.
   - Offline: a claim that would need an external source is tagged `external-unavailable` (ref exactly
     `external source unavailable (offline run)`, with a confidence).
5. **Validate** with `mcp__pob2__guide_run {validate: "<runFolderRel>/plan.json"}` until it reports no error.
   No final compile: the D1 gate compiles.
6. **Claim.** `done`. A budget your prices break goes to the D1 gate, which routes it back to D1-build.

## The fix round and revisions (D-264, D-352)

With V4 findings or the user's requests in `findings`, you edit the plan in place; you never write it anew.

1. **Fix the claims in place**, with Edit. For each finding, fix every claim the issue touches, wherever it
   is in your stages, not only the flagged location: its wording, its citation (`source`), its caveat, or
   its source itself. A `hinge: no` finding is fixed by removing or narrowing the statement, never by new
   research or a recompile.
2. **Recompile only for a build change**: gear (an item, a tree jewel, a flask or charm, the anoint, or a price
   entry), the tree, the gems or the config (earned or scenario). The anoint and a price entry are yours:
   change them, measure as step 1 does, and the D1 gate runs after you. Any other build change is
   D1-build's: make none, and return its finding ids as `build: <ids>`; the runner runs D1-build with them,
   then you once more, then the gates.
   - **After D1-build** (your header has `changed`): D1-build made the build changes; you follow them.
     Re-price each slot whose item changed, re-measure the anoint on a changed rung (step 1's measure-only
     compile), and fix the claims and the ledger on what moved. Never return `build:` for a finding D1-build
     handled: a build change still missing is the D1 gate's to find. Return `done`; the D1 gate runs after you.
3. **A ledger edit needs no recompile.** A change to a ledger entry's formula, inputs or claim text needs no
   recompile and no gate: the record's `buildSha1` leaves out the ledger, and the run checker re-evaluates
   the plan's current ledger (D-352).
4. **Otherwise compile nothing.** A claims-only edit changes only `stages[].claims`, `source` and `tag` fields
   and the `ledger`; anything else, a respec's note or a `chaosResistException`'s reason included, is a build
   change (step 2). After your edits, validate once (`mcp__pob2__guide_run {validate:
   "<runFolderRel>/plan.json"}`) so the plan still validates, and leave `compile-record.json` and the PoB file
   as the final compile left them: no gate runs after you, and the run checker requires the sha1 of the plan
   without its claims, sources, tags and ledger to equal the final record's `buildSha1` (D-266, D-352).

## Writes

`plan.json` only. The server writes the record and the XML beside it.

## Returns

At most 8 lines: `done`; how many `mcp__pob2__compile_plan` calls you made; the anoint of `b` and `n`; your
price calls counted by outcome (`prices: ok 12, would_wait 1`, or `prices: none`); and in the fix round or a
revision, `recompiled: yes` or `recompiled: no`, the finding ids you fixed and the locations you changed
(`plan.json stages[3].claims[2]`, `plan.json ledger[4]`), and `build: <ids>` when D1-build must make a change.

```
D1-finish r1-a-2 attempt 1: done
compiles: 2
anoint: b Unbending, n Unbending
prices: none (offline)
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
