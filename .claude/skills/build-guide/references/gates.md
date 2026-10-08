# Gates and their verdict files

A gate is the check a step must pass before the run moves on. A gate step returns a verdict; the skill
writes it unchanged to `reports/gates/<stage>-<concept>-a<attempt>.json` (`run-folder.md`). The run
checker re-reads the last D1 gate's file and recomputes it from the records, so the shapes below are a
contract: keep the field names exactly.

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

- `stage`, `concept` and `attempt` match the file name.
- Each `verdict` part is `pass`, `fail` or `unverified`.
- Each finding names the `part` it belongs to, a stable `code`, the plan `stage` it concerns (a plan
  stage id such as `b`; omitted only for a finding about no one stage), and a `message` citing record
  fields and C1/E1 keys. A V1 or V2 finding keeps the `code` the compile record gives it; floor, budget
  and rolledSkill findings use the codes below.
- **Two findings are equal when their plan `stage`, `part` and `code` are**, whichever gate reports them:
  a V1 finding the user accepted at the D1 gate is the same finding when the D2 gate or the final record
  reports it again, and it covers that plan stage only (§5.4).
- Extra fields are allowed (for example R1b's `errors`, the D2 gate's `finalCompile`, FI-3's `forced`).

| Gate | Parts | Passes when |
|---|---|---|
| `R1b` | `compiled` | the skeleton compiled with no compile error (C-36) |
| `D1-gate` | `compiled`, `v1`, `v2`, `floor`, `budget`, `rolledSkill` | see below |
| `D2-gate` | `compiled`, `v1`, `v2` | the whole plan compiled and V1 and V2 pass for every stage (V1 includes tree continuity, D-192) |

## The D1 gate's parts (slice 03 §5.3)

The D1 gate compiles `plan.json` measure-only and reads the record. "Endgame stages" are the plan's
stages with a `variant`.

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
    Each equals, rounded to 2 decimals, the record's value of the ledger entry `hit_<stage id>_<type>`
    that derives it from the area-level damage table and the top of each waystone damage modifier's
    range (`stages/D1.md`), and `<Type>MaximumHitTaken` is greater than the hit.

  The guide's statement of the exception (checked by the run checker): **one line** of the variant's
  `Checks` holds both the exception's full `reason` text and the stage's uncapped chaos resistance
  (the record's `ChaosResist`) as a number with `%`, for example "Chaos resistance stays at 28% because
  no slot can carry chaos resistance without dropping a core item or breaking the budget".
- **budget** (D-116, D-147, D-164, D-219, D-249), for the budget variant: every filled slot **and every
  tree jewel** (`items.treeJewels`) has a `prices[]` entry, converted to divines with
  `get_currency_rates`' rates. Each filled slot or jewel has its own entry, except slots holding identical
  item text (two identical rings may share one, and each counts). Totals are compared **rounded to 2
  decimals**.
  - total **≤ 20 divines: pass**;
  - total **> 20 and ≤ 22: pass, with a "near the ceiling" note** the guide's budget `Checks` must carry
    in those words;
  - total **> 22: fail**;
  - any slot price `unavailable`, or a currency without a rate: **unverified**, which doesn't fail the
    gate, and the guide can't claim the variant is under budget.
  The non-budget total is reported against the ~200-divine reference (D-117), never gated.
- **rolledSkill** (D-122, D-148, D-217). In each endgame stage, the rolled skill's group
  (`skills.rolledGroup`) has role `clear` or `single_target`, never `utility` or `leveling`, and its
  figure is the largest among the stage's groups with that role. A figure is a record `skillOutputs`
  field (`g<group>s<skill>p<statSet>.<Field>`), the same field for every group compared, or a ledger
  entry's value (`ledger:<id>`).

### The basis: what the run checker recomputes from

The D1 gate's file also carries `basis`. The checker re-reads every number from the record and the plan
and fails where the basis or the verdict differs.

```json
"basis": {
  "floor": [
    { "stage": "b", "missing": { "Fire": 0, "Cold": 0, "Lightning": 0 }, "chaos": 47,
      "hits": [ { "type": "Physical", "hit": 402.0, "maxHitTaken": 5100 },
                { "type": "Fire", "hit": 96.48, "maxHitTaken": 9800 } ] }
  ],
  "budget": {
    "rates": [ { "currency": "exalted", "divines": 0.01 } ],
    "slots": [ { "stage": "b", "slot": "Helmet", "priceId": "b-helmet" },
               { "stage": "b", "jewel": 1001, "priceId": "b-jewel" } ],
    "totals": [ { "stage": "b", "divines": 21.5 } ],
    "nonBudget": [ { "stage": "n", "divines": 168.0, "reference": 200 } ]
  },
  "rolledSkill": [
    { "stage": "b", "group": 1, "role": "clear",
      "figures": [ { "group": 1, "figure": "g1s1p1.TotalDPS", "value": 50000 },
                   { "group": 2, "figure": "g2s1p1.TotalDPS", "value": 21000 } ] }
  ]
}
```

- `floor`: one entry per endgame stage: the three gated values, the chaos value
  (`MissingChaosResist`), and each of the five reference hits with its `<Type>MaximumHitTaken`.
- Findings with codes `chaos-exception` and `near-ceiling` report on a passing part: they are never
  failures, and need no acceptance.
- `budget`: one `slots` entry for every filled slot (`{stage, slot, priceId}`) and every tree jewel
  (`{stage, jewel: <node id>, priceId}`) of every budget-variant stage, naming a `prices[].id`; the
  `rates` used (`divines` is what one unit of the currency is worth; a divine counts 1); each budget
  stage's total, `null` when unverified.
- `rolledSkill`: per endgame stage, the rolled group, its role, and one figure for **every** group of
  that role.

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
| floor | `reference-hit-ledger-<type>` | the hit differs from its ledger entry `hit_<stage id>_<type>`, or the record has no value for it |
| budget | `over-budget` | the total is above 22 divines |
| budget | `near-ceiling` | above 20, at most 22: a finding on a passing budget |
| budget | `unverified` | an unavailable price or a missing rate |
| rolledSkill | `rolled-role` | the rolled group's role isn't `clear` or `single_target` |
| rolledSkill | `rolled-not-largest` | another group of that role has the larger figure |
| rolledSkill | `rolled-not-compared`, `rolled-no-figure` | a same-role group isn't compared, or its figure isn't in the record |

## The D1 gate's outcome

| Gate verdict | D1's claim | Outcome |
|---|---|---|
| compiled, V1, V2, floor, rolledSkill pass; budget pass or unverified | any | D2 |
| compile, V1 or V2 fails | any | D1 re-runs with the findings; after 2 retries, `escalated` |
| only floor, budget or rolledSkill fails | `infeasible` | `infeasible`, with the verdict as evidence (D-141) |
| only floor, budget or rolledSkill fails | `done` | D1 re-runs with the findings; after 2 retries, `infeasible` |

A finding the user accepted at an escalation (same plan stage, part and `code`) fails neither that gate
nor a later one (`checkpoints.md`). A completed run's guide passed every gate: the run checker fails a
completed run whose recomputed floor, budget or rolled skill fails, or whose last D1 or D2 gate has a
failing part, unless accepted findings cover every failure. Only a pass, or an `unverified` budget,
proceeds to D2.
