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
  "concept": "c1",
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
    breaking the budget). With the exception the floor passes and the gate adds a finding naming the value
    and the reason; the guide's `Checks` state both. Without it, `MissingChaosResist` above 0 fails the
    floor;
  - **the reference hits** (D-119, D-254): the stage's scenario holds a waystone-scaled hit for each of
    the `enemyPhysicalDamage`, `enemyFireDamage`, `enemyColdDamage`, `enemyLightningDamage` and
    `enemyChaosDamage` options: physical, and each element the waystone's extra-damage modifier may add.
    Each equals the ceiling of the record's value of the ledger entry `hit_<stage id>_<type>` that
    derives it from the area-level damage table and the top of each waystone damage modifier's range
    (`stages/D1.md`): PoB takes these options as whole numbers, so the hit is that value rounded to 2
    decimals, then rounded up (D-256; 96.4789 gives 97, and 402.000003 gives 402). `<Type>MaximumHitTaken`
    is greater than the hit. The hit is the variant's: its scenario entry cites
    `enemies/map-monsters.json#damage.by-level[<area level>]` at the variant's area level (79 for the budget
    variant's T15, `enemies/waystones.json#area-level.max` for the non-budget one, and 69 for the
    entering-maps rung's T5: `enemies/waystones.json#area-level.offset` plus 5, D-281, D-327), and the ledger
    entry's
    value is that damage × (1 + the top of `mods.increased-monster-damage` / 100), × the top of
    `mods.extra-damage-as-element` / 100 for an element.

  The guide's statement of the exception (checked by the run checker): **one line** of the variant's
  `Checks` holds both the exception's full `reason` text and the stage's uncapped chaos resistance
  (the record's `ChaosResist`) as a number with `%`, for example "Chaos resistance stays at 28% because
  no slot can carry chaos resistance without dropping a core item or breaking the budget".
- **budget** (D-116, D-147, D-164, D-219, D-249, D-281), for the budget variant and the entering-maps rung:
  every filled slot **and every tree jewel** (`items.treeJewels`) has a `prices[]` entry, converted to divines with
  `mcp__pob2__get_currency_rates`' rates. Each filled slot or jewel has its own entry, except slots holding
  identical item text (two identical rings may share one, and each counts). Totals are compared **rounded
  to 2 decimals**.
  - total **≤ 20 divines: pass**;
  - total **> 20 and ≤ 22: pass, with a "near the ceiling" note** the guide's budget `Checks` must carry
    in those words;
  - total **> 22: fail**;
  - the entering-maps rung's budget is **5 divines**: **≤ 5 pass; > 5 and ≤ 5.5 pass with "near the
    ceiling"** in its `Checks`; **> 5.5 fail** (D-281);
  - any slot price `unavailable`, or a currency without a rate: **unverified**, which doesn't fail the
    gate, and the guide can't claim the stage is within its budget. Offline, both are unverified.
  The non-budget total is reported against the ~200-divine reference (D-117), never gated.
- **rolledSkill**, the named damage source's part (D-122, D-148, D-217, D-293, D-295). The build's named
  damage source is the main source of damage, never a token role. For a fixed skill that skill is the named
  source, and its own hits, ailments and projectiles count when another skill fires, spreads or copies them.
  In each endgame stage, the named source's group (`skills.rolledGroup`; the name stays, D-295) has role
  `clear` or `single_target`, never `utility` or `leveling`, and its figure × its Count is the largest among
  the stage's groups with that role. A figure is named as a record `skillOutputs` field
  (`g<group>s<skill>p<statSet>.<Field>`), the same field for every group compared, and compared
  **Count-scaled**: the record's `countedSkillOutputs[g<group>s<skill>p<statSet>].fields.<Field>`, the per-copy
  figure × that group's Count by PoB's Full DPS rule (WU-55; equal to the raw figure when the count is 1), so
  name a field the counted fields hold (`TotalDPS`). Or a figure is a ledger entry's value (`ledger:<id>`),
  whose formula carries any Count itself. **The named source is the main skill, and its figure is the main
  stat set's** (amendment 1 S7): the PoB file opens on `skills.main`, so the guide's headline figure, the
  Count-scaled one (D-294), is the one the user sees as PoB's Full DPS. On every stage with a `rolledGroup`,
  `skills.main.group` is that group; D1 sets `skills.main.statSet`; and the named source's figure, directly or
  every breakdown field its ledger formula reads, is `<stage>.g<main.group>s<main.activeSkill>p<main.statSet>`.

### The basis: what the run checker reads from the D1 gate's file

The D1 gate's file also carries `basis`: only what the plan and the record don't say. The run checker
recomputes the floor from the plan and the record alone, and reads the budget's slot→price map with its
rates, and each endgame stage's figures, from here; it fills every number from the record itself.

```json
"basis": {
  "budget": {
    "rates": [ { "currency": "exalted", "divines": 0.01 } ],
    "slots": [ { "stage": "b", "slot": "Helmet", "priceId": "b-helmet" },
               { "stage": "b", "jewel": 1001, "priceId": "b-jewel" } ],
    "totals": [ { "stage": "b", "divines": 21.5 } ],
    "nonBudget": [ { "stage": "n", "divines": 168.0, "reference": 200 } ]
  },
  "rolledSkill": [
    { "stage": "b", "figures": [ { "group": 1, "figure": "g1s1p1.TotalDPS" },
                                 { "group": 2, "figure": "g2s1p1.TotalDPS" } ] }
  ]
}
```

- `budget.slots`: one entry for every filled slot (`{stage, slot, priceId}`) and every tree jewel
  (`{stage, jewel: <node id>, priceId}`) of every budget-variant and entering-maps stage, naming a
  `prices[].id`; `rates`, the
  rates used (`divines` is what one unit of the currency is worth; a divine counts 1).
- `budget.totals` (each budget-variant and entering-maps stage's total, `null` when unverified) and
  `budget.nonBudget` are what W1 quotes in the guide; the run checker computes its own total from the prices
  and rates.
- `rolledSkill`: per endgame stage, one figure for **every** group of the named source's group's role: the
  record field (or `ledger:<id>`) compared, with no value. The checker reads the values from the record,
  Count-scaled as above.
- Findings with codes `chaos-exception` and `near-ceiling` report on a passing part: they are never
  failures, and need no acceptance.

### Finding codes for floor, budget and rolledSkill

The run checker recomputes these parts and names each failure by these codes, so an accepted finding
(same plan stage, part and code) covers the matching failure:

| Part | Code | Means |
|---|---|---|
| floor | `missing-fire-resist`, `missing-cold-resist`, `missing-lightning-resist` | that resistance is below its cap (or the record lacks it) |
| floor | `missing-chaos-resist` | chaos resistance below its cap with no `chaosResistException` |
| floor | `chaos-exception` | chaos below its cap, kept by the exception: a finding on a passing floor |
| floor | `max-hit-<type>` (`max-hit-physical`, …) | `<Type>MaximumHitTaken` isn't above that reference hit |
| floor | `reference-hit-missing-<type>` | the stage has no positive `enemy<Type>Damage` hit of that type |
| floor | `reference-hit-ledger-<type>` | the hit isn't the ceiling of its ledger entry `hit_<stage id>_<type>` (D-256), or the record has no value for it, or the hit isn't derived from the damage at the variant's area level and the tops of the waystone damage modifiers (D-254) |
| budget | `over-budget` | the total is above 22 divines (above 5.5 for the entering-maps rung) |
| budget | `near-ceiling` | above 20, at most 22 (above 5, at most 5.5 for the entering-maps rung): a finding on a passing budget |
| budget | `unverified` | an unavailable price or a missing rate |
| rolledSkill | `rolled-role` | the rolled group's role isn't `clear` or `single_target` |
| rolledSkill | `rolled-not-largest` | another group of that role has the larger figure |
| rolledSkill | `rolled-not-main` | the stage's `skills.main.group` isn't its `rolledGroup` |
| rolledSkill | `rolled-stat-set` | the stage sets no `skills.main.statSet`, or the rolled figure (or a breakdown field its ledger formula reads) isn't the main skill's stat set |
| rolledSkill | `rolled-not-compared`, `rolled-no-figure` | a same-role group isn't compared, or its figure isn't in the record |

## The D1 gate's outcome

The runner routes by the verdict file and D1's claim (slice 03 §5.3's table, unchanged):

| Gate verdict | D1's claim | Outcome |
|---|---|---|
| compiled, V1, V2, floor, rolledSkill pass; budget pass or unverified | any | D2 |
| compile, V1 or V2 fails | any | D1 re-runs with the findings; after 2 counted retries, `escalated` |
| only floor, budget or rolledSkill fails | `infeasible` | `infeasible`, with the verdict as evidence (D-141) |
| only floor, budget or rolledSkill fails | `done` | D1 re-runs with the findings; after 2 counted retries, `infeasible` |
| any part but the budget `unverified` | any | as a compile, V1 or V2 failure |
| `"forced": "infeasible"` (FI-3) | any | `infeasible`, evidence `FI-3 (injected)` |
| any failure, after a guided retry or an accepted re-run | any | `escalated` again (D-236) |

## The D2 gate's outcome

The D2 gate compiles measure-only and, when the compile, V1 and V2 pass for every stage, runs the final
compile in the same step (`stages/D2-gate.md`). A pass goes to W1. A failure, a failed or refused final
compile included (part `compiled`, code `final-compile`), re-runs D2 with the findings; after 2 counted
retries, `escalated`. After a guided retry or an accepted re-run, any failure escalates again.

The runner logs each gate attempt with the outcome its verdict file routes to, and the run checker holds the
log to the files: a pass is a verdict that passes, an `infeasible` one is forced by FI-3 or fails only floor,
budget or `rolledSkill` (with D1 claiming infeasible, or after 2 counted retries), and an attempt failed by a
fault on attempt 1 runs free only when the verdict's `faultsApplied` names the fault and every failing finding
is on the stage the fault breaks (S6).

A finding the user accepted at an escalation (same plan stage, part and `code`) fails neither that gate
nor a later one (`checkpoints.md`). A current guide passed every gate: the run checker fails a run whose
guide is current (no design step ran after its W1) and whose recomputed floor, budget or named damage
source fails, or whose D1 or D2 gate before that W1 has a failing part, unless accepted findings cover every
failure. Only a pass, or an `unverified` budget,
proceeds to D2.
