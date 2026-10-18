# Gates and their verdict files

A gate is the check a step must pass before the run moves on. A gate step (R1b, the D1 gate, the D2 gate)
writes its verdict itself, to `reports/gates/<stage>-<concept>-a<attempt>.json` (`run-folder.md`), and
returns one verdict line; the runner reads the file to route. The run checker re-reads the last D1 gate's
file and recomputes it from the plan and the record, so the shapes below are a contract: keep the field
names exactly.

## Every verdict file

```json
{
  "stage": "D1-gate",
  "concept": "r1-a-2",
  "attempt": 1,
  "verdict": { "compiled": "pass", "v1": "pass", "v2": "pass" },
  "findings": [
    { "part": "v1", "code": "level-points", "stage": "b", "message": "stage b spends 108 points at level 1" }
  ]
}
```

- `stage`, `concept` and `attempt` match the file name and the step's header.
- Each `verdict` part is `pass`, `fail` or `unverified`. Only the budget may stay `unverified` (D-164): a
  gate whose compile failed leaves its other parts `unverified`, and any other part `unverified` is a failure,
  routed as a compile, V1 or V2 failure.
- Each finding names the `part` it belongs to, a stable `code`, the plan `stage` it concerns (a plan
  stage id such as `b`; omitted only for a finding about no one stage), and a `message` citing record
  fields and C1/E1 keys. A V1 or V2 finding keeps the `code` the compile record gives it; floor, budget
  and rolledSkill findings use the codes below. Read the V1 and V2 findings from
  `mcp__pob2__compile_plan`'s text, which prints every one up to 200; past that, a line says how many more,
  and you Grep the record's `stages.<id>.v1.findings` and `stages.<id>.v2.findings` for them.
- **Two findings are equal when their plan `stage`, `part` and `code` are**, whichever gate reports them:
  a V1 finding the user accepted at the D1 gate is the same finding when the D2 gate or the final record
  reports it again, and it covers that plan stage only.
- Extra fields are allowed (for example R1b's `errors`, the D2 gate's `finalCompile`, FI-3's `forced`).

| Gate | Parts | Passes when |
|---|---|---|
| `R1b` | `compiled` | the skeleton compiled with no compile error (C-36) |
| `D1-gate` | `compiled`, `v1`, `v2`, `floor`, `budget`, `rolledSkill` | see below |
| `D2-gate` | `compiled`, `v1`, `v2` | the whole plan compiled and V1 and V2 pass for every stage (V1 includes tree continuity, D-192: the campaign track, then the endgame ladder `m` → `b` → `n`, each rung's respec and gold cost checked, D-282); the final compile then succeeded |

## The D1 gate's parts (slice 03 §5.3)

The D1 gate compiles `plan.json` measure-only and reads the record. "Endgame stages" are the plan's
stages with a `variant`: the rungs of the endgame ladder, entering maps (`m`), budget (`b`) and non-budget
(`n`), each gated the same way (D-281).

- **floor** (the survival floor; D-118, D-119, D-234). Per endgame stage, at the Endgame resistance
  penalty (−60%):
  - fire, cold and lightning: `MissingFireResist`, `MissingColdResist` and `MissingLightningResist` are
    0, i.e. capped;
  - chaos: `MissingChaosResist` is 0 too. **Chaos may stay uncapped only through the stage's
    `chaosResistException {reason, tag}`**, and D1 uses it only when capping chaos is infeasible (for
    example Chaos Inoculation, or no slot that can carry chaos resistance without dropping a core item or
    going far over its price target). With the exception the floor passes and the gate adds a finding naming the value
    and the reason; the guide's `Checks` state both. Without it, `MissingChaosResist` above 0 fails the
    floor;
  - **the reference hits** (D-119, D-254, D-353): the stage holds a waystone-scaled hit for each of the
    `enemyPhysicalDamage`, `enemyFireDamage`, `enemyColdDamage`, `enemyLightningDamage` and
    `enemyChaosDamage` options: physical, and each element the waystone's extra-damage modifier may add. The
    compiler writes each hit the plan leaves out, and the floor reads every hit from the record's
    `configWritten`, not from a ledger entry (D1 writes no `hit_*` entry). A hit is the damage at the variant's
    area level (`enemies/map-monsters.json#damage.by-level[<area level>]`: 79 for the budget variant's T15,
    `enemies/waystones.json#area-level.max` for the non-budget one, and 69 for the entering-maps rung's T5,
    `enemies/waystones.json#area-level.offset` plus 5, D-281, D-327) × (1 + the top of
    `mods.increased-monster-damage` / 100), × the top of `mods.extra-damage-as-element` / 100 for an element;
    PoB takes these options as whole numbers, so the hit is that value rounded to 2 decimals, then rounded up
    (D-256; 96.4789 gives 97, and 402.000003 gives 402). `<Type>MaximumHitTaken` is greater than the hit.

  The guide's statement of the exception (checked by the run checker): **one line** of the variant's
  `Checks` holds both the exception's full `reason` text and the stage's uncapped chaos resistance
  (the record's `ChaosResist`) as a number with `%`, for example "Chaos resistance stays at 28% because
  no slot can carry chaos resistance without dropping a core item or going far over its price target".
- **budget** (D-164, D-249, D-281, D-370, D-371, D-373), for every endgame rung, `m`, `b` and `n`: every filled
  slot **and every tree jewel** (`items.treeJewels`), and the anoint of `b` and `n`, has a `prices[]` entry,
  converted to divines with `mcp__pob2__get_currency_rates`' rates and then to the rung's price day (below). Each
  filled slot or jewel has its own entry, except slots holding identical item text (two identical rings may share
  one, and each counts). Each rung's total is a range at its price day, never a pass mark:
  - every rung's total known: **pass**;
  - any price of a rung `unavailable`, or a currency without a rate: **unverified** (code `unverified`, that
    rung's total `null`), which doesn't fail the gate, and the guide can't state that total (D-164). Offline,
    every price is unavailable, so the budget is unverified;
  - **never fail** (D-371): a target is never a pass mark, a budget finding never sends D1 back, and no design
    is `infeasible` for its price;
  - `over-target`, information on a passing or unverified part: a rare of `b` or `n` whose range's midpoint is
    above its target, and `m`'s total when its midpoint is above 5 divines.
- **rolledSkill**, the named damage source's part (D-122, D-148, D-217, D-293, D-295). The build's named
  damage source is the main source of damage, never a token role. For a fixed skill that skill is the named
  source, and its own hits, ailments and projectiles count when another skill fires, spreads or copies them.
  In each endgame stage, the named source's group (`skills.rolledGroup`; the name stays, D-295) has role
  `clear` or `single_target`, never `utility` or `leveling`, and its figure × its Count is the largest among
  the stage's groups with that role. A figure is named as a record `skillOutputs` field
  (`g<group>s<skill>p<statSet>.<Field>`), the same field for every group compared; a group whose damage is its
  minion's, one that names a minion skill or whose compared skill summons a minion (its record entry carries
  `Minion<Field>` fields), is compared by its minion's `Minion<Field>` at the same key, its figure
  `MinionTotalDPS` in place of `TotalDPS`, which is 0 for a summon (D-378, D-385). **One rule reads it**
  (D-340): a field with a counted copy is read **Count-scaled**, from the record's
  `countedSkillOutputs[g<group>s<skill>p<statSet>].fields.<Field>` (the per-copy figure × that group's Count by
  PoB's Full DPS rule, WU-55; `TotalDPS` has one); any other field is read from the raw
  `skillOutputs[g<group>s<skill>p<statSet>].fields.<Field>`, the per-copy value, and is labelled "per copy"
  wherever it is quoted when the group's count is above 1. Or a figure is a ledger entry's value
  (`ledger:<id>`), whose formula carries any Count itself. **The named source is the main skill, and its figure is the main
  stat set's** (amendment 1 S7): the PoB file opens on `skills.main`, so the guide's headline figure, the
  Count-scaled one (D-294), is the one the user sees as PoB's Full DPS. On every stage with a `rolledGroup`,
  `skills.main.group` is that group; D1 sets `skills.main.statSet`; and the named source's figure, directly or
  every breakdown field its ledger formula reads, is `<stage>.g<main.group>s<main.activeSkill>p<main.statSet>`.

### The basis: what the run checker reads from the D1 gate's file

The D1 gate's file also carries `basis`: only what the plan and the record don't say. The run checker
recomputes the floor from the plan and the record alone, and reads the budget's slot→price map with its market and
rates, and each endgame stage's figures, from here; it fills every number from the record itself.

```json
"basis": {
  "budget": {
    "rates": [ { "currency": "exalted", "divines": 0.0025 } ],
    "market": { "league": "Forbidden Rites", "day": 41, "late": false },
    "slots": [ { "stage": "m", "slot": "Boots", "priceId": "m-boots" },
               { "stage": "b", "slot": "Helmet", "priceId": "b-helmet" },
               { "stage": "b", "slot": "Amulet", "priceId": "b-amulet" },
               { "stage": "b", "jewel": 1001, "priceId": "b-jewel-1001" },
               { "stage": "b", "slot": "Anoint", "priceId": "b-anoint" },
               { "stage": "n", "slot": "Helmet", "priceId": "n-helmet" } ],
    "totals": [ { "stage": "m", "low": 1.6, "high": 3.6, "day": 7 },
                { "stage": "b", "low": 14, "high": 32, "day": 7 },
                { "stage": "n", "low": 88, "high": 140, "day": 21 } ]
  },
  "rolledSkill": [
    { "stage": "b", "figures": [ { "group": 1, "figure": "g1s1p1.TotalDPS" },
                                 { "group": 2, "figure": "g2s1p1.TotalDPS" } ] }
  ]
}
```

- `budget.rates`: the rates used (`divines` is what one unit of the currency is worth; a divine counts 1).
- `budget.market`: `{league, day, late}`, the market the prices were seen in (step 1 below).
- `budget.slots`: one entry for every filled slot (`{stage, slot, priceId}`) and every tree jewel
  (`{stage, jewel: <node id>, priceId}`) of every endgame rung, `m`, `b` and `n`, and the anoint of `b` and `n`
  as a slot (`{stage, slot: "Anoint", priceId}`), each naming a `prices[].id`. A fallback entry
  (`<id>-fallback`) is in no slot.
- `budget.totals`: one entry per endgame rung, `{stage, low, high, day}`: its total range in divines at its
  price day (`day` 7 for `m` and `b`, 21 for `n`), rounded by step 6 below; `low` and `high` are `null` when the
  rung is unverified. W1 quotes them in the guide through the render.
- `rolledSkill`: per endgame stage, one figure for **every** group of the named source's group's role: the
  record field (or `ledger:<id>`) compared, with no value (`g1s1p1.MinionTotalDPS` for a group that names a
  minion skill). The checker reads the values from the record by
  the same rule (D-340): Count-scaled where the field has a counted copy, else per copy.
- Findings with codes `chaos-exception` and `over-target` are information: they are never failures, and need no
  acceptance. An `over-target` finding carries, beside its message, `slot` (or `jewel`, the node id; neither for
  `m`'s total), `low` and `high` (its range, rounded by step 6) and `target` (in divines):

  ```json
  { "part": "budget", "code": "over-target", "stage": "b", "slot": "Amulet", "low": 3.2, "high": 7.2, "target": 5,
    "message": "b Amulet: about 3.2–7.2 divines around day 7, over its 5-divine target" }
  ```

### Price days, targets and ranges (D-370, D-373)

Prices stay in `plan.json` as seen; the gate converts them only to report them. Each step below reads
`data/economy/prices.json`, and the run checker recomputes every number by these steps from the plan's prices,
`basis.budget.rates` and `basis.budget.slots`.

| Rung | Price day | Target |
|---|---|---|
| `m` | 7 | 5 divines in all |
| `b` | 7 | each rare's `query.target.divines`: 5 |
| `n` | 21 | each rare's `query.target.divines`, set by D1-build (together at most 200); 100–200 in all |

A target is the entry's `query.target` (`{divines, day}`). An entry without one has no target and gets no
`over-target` finding: uniques, magic items, flasks, charms and the anoint.

1. **The market.** `league` is the plan's `league` (`null` offline). The seen date is the latest `date` among
   the `ok` entries `basis.budget.slots` names. `day` is the whole days from the league's `start` to the seen
   date, the league found by `name` among the file's `league.*` facts; `null` when the league isn't there or no
   entry is `ok`. `late` is `true` when the league has an `end` before the seen date, or `day` is above 60
   (`conversion.late-day`); else `false`.
2. **An entry's price in divines,** `p`: its `amount` times its currency's rate (a divine counts 1), unrounded.
3. **Its factors** `[lo, hi]` to the rung's price day `D` (7 or 21). The row is `under-10` when `p` is under 10
   (`conversion.threshold`), else `10-or-more`; its factors are `conversion.<row>.to-day-<D>`, `{min, max}`.
   - `late`: `[min ÷ 4, max ÷ 2]` (`conversion.late-divisor`);
   - else, `day` 21 or above, or `null`: `[min, max]`;
   - else (`day` under 21, `conversion.first-day`): `[1, 1]`, no conversion.
4. **Its range** is `[p × lo, p × hi]`, and its midpoint `(p × lo + p × hi) ÷ 2`.
5. **A rung's total** is the sum of the lows and the sum of the highs over the rung's `basis.budget.slots`
   entries; an entry two identical slots share counts once for each. A rung with any of those entries
   `unavailable`, or in a currency without a rate, has no total: `low` and `high` are `null`.
6. **Rounding**, for every `low` and `high` written (a total's, a finding's): each end on its own, from the
   unrounded value: 10 or more to a whole divine (`Math.round(x)`), under 10 to one decimal
   (`Math.round(x × 10) ÷ 10`). Midpoints compare unrounded.
7. **`over-target`**: on `b` and `n`, each entry the rung's `basis.budget.slots` entries name (once, however
   many slots share it) with a `query.target` whose `ok` price has a rate and whose midpoint is above
   `query.target.divines`, named by the first of those slots that maps to it; on `m`, its total, when it has one
   and its midpoint is above 5. Only the entries the slots name count, here as in step 5: a fallback
   (`<id>-fallback`) carries its slot's target but is in no slot, so it is never counted and never over target.

The gate adds by hand, so the run checker holds it to its own recompute with a margin: `market` equal; each
recorded `low` and `high`, a total's or a finding's, within one rounding step of the checker's (0.1 when the
checker's value is under 10, 1 when it is 10 or more); and the same `over-target` findings, except where the
checker's midpoint is within 0.1 divine of the target (1 divine for a target of 10 or more). The render takes the
totals and the over-target slots from the gate's file, and converts an over-target slot's fallback to the rung's
price day by steps 2 to 4 at the file's `market` and rates, rounded by step 6.

### Finding codes the gate names

The run checker recomputes the floor, budget and rolledSkill parts and names each failure by their codes; the
`v1` row's code is the compile record's, and the gate reports and routes it as every V1 finding. Either way an
accepted finding (same plan stage, part and code) covers the matching failure. The budget has no failure code:
it never fails (D-371).

| Part | Code | Means |
|---|---|---|
| floor | `missing-fire-resist`, `missing-cold-resist`, `missing-lightning-resist` | that resistance is below its cap (or the record lacks it) |
| floor | `missing-chaos-resist` | chaos resistance below its cap with no `chaosResistException` |
| floor | `chaos-exception` | chaos below its cap, kept by the exception: a finding on a passing floor |
| floor | `max-hit-<type>` (`max-hit-physical`, …) | `<Type>MaximumHitTaken` isn't above that reference hit |
| floor | `reference-hit-missing-<type>` | the stage has no positive `enemy<Type>Damage` hit of that type |
| floor | `reference-hit-ledger-<type>` (its name kept) | the record's hit, as the compiler wrote it in `configWritten`, isn't derived from the damage at the variant's area level and the tops of the waystone damage modifiers (D-254) and rounded up to a whole number (D-256), or the record has no value for it (D-353) |
| budget | `over-target` | a rare of `b` or `n` whose range's midpoint is above its target, or `m`'s total above 5 divines: information, never a failure |
| budget | `unverified` | an unavailable price or a missing rate: the rung's total isn't known |
| rolledSkill | `rolled-role` | the rolled group's role isn't `clear` or `single_target` |
| rolledSkill | `rolled-not-largest` | another group of that role has the larger figure |
| rolledSkill | `rolled-not-main` | the stage's `skills.main.group` isn't its `rolledGroup` |
| rolledSkill | `rolled-stat-set` | the stage sets no `skills.main.statSet`, or the rolled figure (or a breakdown field its ledger formula reads) isn't the main skill's stat set |
| rolledSkill | `rolled-not-compared`, `rolled-no-figure` | a same-role group isn't compared, or its figure isn't in the record |
| v1 | `not-granted` | a group whose skill gem, or whose `minionSkill`, a passive grants (`Grants Skill:`), on a stage that allocates none of those passives (D-380): PoB measures the skill anyway, the game doesn't give it. The compile passes (D-192), the `v1` part fails, and D1 or D2 allocates a granting passive from that stage on |

## The D1 gate's outcome

The runner routes by the verdict file and D1's claim, D1-build's return (slice 03 §5.3's table; a pass now goes to
the design gate, D-362). The budget is `pass` or `unverified`, never a failure: no budget finding routes back to D1
(D-371).

| Gate verdict | D1's claim | Outcome |
|---|---|---|
| compiled, V1, V2, floor, rolledSkill pass; budget pass or unverified | any | the design gate (D-362), then D2 after its `accept` |
| compile, V1 or V2 fails | any | D1 re-runs with the findings; after 2 counted retries, `escalated` |
| only floor or rolledSkill fails | `infeasible` | `infeasible`, with the verdict as evidence (D-141) |
| only floor or rolledSkill fails | `done` | D1 re-runs with the findings; after 2 counted retries, `infeasible` |
| any part but the budget `unverified` | any | as a compile, V1 or V2 failure |
| `"forced": "infeasible"` (FI-3) | any | `infeasible`, evidence `FI-3 (injected)` |
| any failure, after a guided retry or an accepted re-run | any | `escalated` again (D-236) |

## The D2 gate's outcome

The D2 gate compiles measure-only and, when the compile, V1 and V2 pass for every stage, runs the final
compile in the same step (`stages/D2-gate.md`). A pass goes to W1. A failure, a failed or refused final
compile included (part `compiled`, code `final-compile`), re-runs D2 with the findings; after 2 counted
retries, `escalated`. After a guided retry or an accepted re-run, any failure escalates again.

The runner logs each gate attempt with the outcome its verdict file routes to, and the run checker holds the
log to the files: a pass is a verdict that passes, an `infeasible` one is forced by FI-3 or fails only floor
or `rolledSkill` (with D1 claiming infeasible, or after 2 counted retries), and an attempt failed by a
fault on attempt 1 runs free only when the verdict's `faultsApplied` names the fault and every failing finding
is on the stage the fault breaks (S6).

A finding the user accepted at an escalation (same plan stage, part and `code`) fails neither that gate
nor a later one (`checkpoints.md`). A current guide passed every gate: the run checker fails a run whose
guide is current (no design step ran after its W1) and whose recomputed floor or named damage
source fails, or whose D1 or D2 gate before that W1 has a failing part, unless accepted findings cover every
failure. Only a pass, or an `unverified` budget,
proceeds, to the design gate and after its `accept` to D2.
