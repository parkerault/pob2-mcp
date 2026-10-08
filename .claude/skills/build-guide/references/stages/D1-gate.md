# D1-gate: check the endgame variants (`build-guide-coordinator`)

Slice 03 §5.3 step 2; spine D-118, D-119, D-122, D-141, D-164, D-217, D-219, D-234. A fresh coordinator
step after every D1 attempt: it runs the final re-price pass, compiles `plan.json` measure-only, reads the
record, and returns the D1 gate's verdict with the basis the run checker recomputes it from. You check; you
don't design. Fix nothing in the plan: a failure goes back to D1 as findings.

## Inputs

- **Header:** `stage: "D1-gate"`, `attempt` (counts this concept's D1 gate attempts), `concept`, `mode`,
  `runFolder`, `runFolderRel`, `compile: "measure-only"`, `accepted` (findings the user accepted),
  `faults` (FI-2, FI-3: offline test runs only), `writes` (`["plan.json"]` when the re-price pass or FI-2
  may edit it, else `[]`).
- **Read:** `plan.json`; after the compile, `compile-record.json`; `run-log.json` (has pricing
  stopped?); `.claude/skills/build-guide/references/gates.md` (the parts, the codes and the verdict file),
  `.claude/skills/build-guide/references/pricing.md`.

## Work

1. **FI-2** (only when the header's `faults` holds it): before anything else, set the first endgame stage's
   (the first stage with a `variant`) `level` to `1` in `plan.json`, and the `(L<n>)` in its
   `loadoutName` to `(L1)`, so the plan stays valid. Don't undo it in this attempt.
2. **The final re-price pass** (§9), online only, and only while pricing hasn't stopped (the prompt says,
   and `run-log.json` records no `locked_out` or `rate_limited` call): call each `prices[]` entry that is
   `unavailable` because of a rate limit (note `rate-limited`) once more, and update it in `plan.json`; a
   refusal leaves it `unavailable`. Report every call in `priceCalls`. Offline, or once pricing has
   stopped, skip it.
3. **Compile** the whole plan measure-only: `compile_plan {plan_path: "<runFolderRel>/plan.json",
   measure_only: true}`, with no `stages`. A compile error is part `compiled` failing (code
   `compile-error`, the error line as the message, the plan stage it names as `stage`); then every other
   part is `unverified` and the step ends.
4. **Read the record** (`compile-record.json`, C-33) and fill each part (`gates.md`). "Endgame stages" are
   the plan's stages with a `variant`.
   - **v1, v2**: `fail` when any endgame stage's `v1` or `v2` verdict in the record has a finding. Each
     record finding becomes a gate finding with its record `code`, part `v1` or `v2`, and the plan stage.
   - **floor**: per endgame stage, `MissingFireResist`, `MissingColdResist` and `MissingLightningResist`
     are 0, and `MissingChaosResist` is 0 or the stage has a `chaosResistException` (then a
     `chaos-exception` finding on a passing floor names the stage's `ChaosResist` value and the reason);
     and the **reference hits** (D-119, D-254): every endgame stage has a waystone-scaled hit for each of
     `enemyPhysicalDamage`, `enemyFireDamage`, `enemyColdDamage`, `enemyLightningDamage` and
     `enemyChaosDamage` in its scenario (else `reference-hit-missing-<type>`); each equals the ceiling of
     the record's value of its ledger entry `hit_<stage id>_<type>`, that value rounded to 2 decimals and
     then up to a whole number, since PoB takes these options as whole numbers (D-256: 96.4789 gives 97,
     402.000003 gives 402; else `reference-hit-ledger-<type>`); and each is below the record's
     `<Type>MaximumHitTaken` (else `max-hit-<type>`). `<type>` is lower case (`physical`, `chaos`). The other codes:
     `missing-fire-resist`, `missing-cold-resist`, `missing-lightning-resist`, `missing-chaos-resist`.
     `chaos-exception` and `near-ceiling` are information on a passing part, never a failure.
   - **budget** (D-219, D-249): the budget variant's filled slots **and tree jewels**, each mapped to its
     `prices[].id`. Online, convert with `get_currency_rates` (a divine counts 1) and total, rounded to 2
     decimals: at most 20 divines `pass`; above 20 and at most 22 `pass` with a `near-ceiling` finding (the
     guide must say "near the ceiling"); above 22 `fail` (`over-budget`). Any slot or jewel price
     `unavailable`, or a currency without a rate: `unverified` (code `unverified`), and the total is
     `null`. Offline, every price is unavailable, so the budget is `unverified` and no rate is fetched.
     The non-budget variant's total is reported against the ~200-divine reference, never gated.
   - **rolledSkill** (D-122, D-217): per endgame stage, the `skills.rolledGroup` group's role is `clear` or
     `single_target` (else `rolled-role`), and its figure is the largest among the stage's groups with that
     role (else `rolled-not-largest`). Compare one record field for every group of that role
     (`g<group>s<skill>p<statSet>.<Field>` from the stage's `skillOutputs`, the same `<Field>` for each),
     or a ledger value (`ledger:<id>`), and list every group of that role.
5. **Report every failure** the record shows, the accepted ones included: the workflow sets aside a
   failure equal to one in the header's `accepted` (same plan stage, part and code), not you.

## Writes

Only what the header's `writes` names: `plan.json`, for FI-2 and the re-price pass; nothing otherwise.

## Returns

Your last message is this JSON and nothing after it (the field names are a contract, `gates.md`):

```json
{
  "verdict": { "compiled": "pass", "v1": "pass", "v2": "pass", "floor": "pass", "budget": "unverified", "rolledSkill": "pass" },
  "findings": [
    { "part": "budget", "code": "unverified", "stage": "b", "message": "every budget price is unavailable (offline run)" },
    { "part": "floor", "code": "chaos-exception", "stage": "b", "message": "ChaosResist 28: no slot can carry chaos resistance without dropping a core item or breaking the budget" }
  ],
  "basis": {
    "floor": [ { "stage": "b", "missing": { "Fire": 0, "Cold": 0, "Lightning": 0 }, "chaos": 47,
                 "hits": [ { "type": "Physical", "hit": 402, "maxHitTaken": 5100 },
                           { "type": "Chaos", "hit": 97, "maxHitTaken": 3000 } ] } ],
    "budget": { "rates": [], "slots": [ { "stage": "b", "slot": "Helmet", "priceId": "b-helmet" },
                                        { "stage": "b", "jewel": 1001, "priceId": "b-jewel-1001" } ],
                "totals": [ { "stage": "b", "divines": null } ], "nonBudget": [ { "stage": "n", "divines": null, "reference": 200 } ] },
    "rolledSkill": [ { "stage": "b", "group": 1, "role": "clear",
                       "figures": [ { "group": 1, "figure": "g1s1p1.TotalDPS", "value": 50000 } ] } ]
  },
  "recordPath": "compile-record.json",
  "priceCalls": [],
  "faultsApplied": []
}
```

- `verdict`: each part `pass`, `fail` or `unverified`.
- `findings`: `{part, code, stage, message}`, the message citing record fields and C1/E1 keys
  (`b.MissingColdResist 12`, `enemies/map-monsters.json#damage.by-level[79]`). A check that rests on an M
  or L fact says so (A-29).
- `basis`: the numbers the run checker recomputes the verdict from, exactly as `gates.md` gives it: one
  `floor` entry per endgame stage (the three gated values, the chaos value `MissingChaosResist`, all five
  reference hits with their `<Type>MaximumHitTaken`); every budget slot and tree jewel with its `priceId`, the
  rates, each budget total (`null` when unverified) and the non-budget totals; per endgame stage the rolled
  group, its role and a figure for every group of that role. Copy each value as the record gives it, or
  rounded to 2 decimals: the run checker compares the copies with the record to 2 decimals.
- `priceCalls`: the re-price pass's calls; `[]` offline.
- `faultsApplied`: `[{"id": "FI-2", "observed": "<the V1 finding it caused>"}]`, and `{"id": "FI-3",
  "observed": "gate run as usual; outcome forced by the workflow"}`, for each directive the header held.

## Fault directives

- **FI-2**: step 1, before the compile. It must make V1 fail for that stage (its points and requirements
  exceed level 1). Report the V1 finding as usual and in `faultsApplied`.
- **FI-3**: no edit. Run the gate as usual and report FI-3 in `faultsApplied`; the workflow forces the
  outcome to `infeasible` with evidence `FI-3 (injected)`.
