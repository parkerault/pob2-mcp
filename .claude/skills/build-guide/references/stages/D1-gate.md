# D1-gate: check the endgame variants (`build-guide-coordinator`)

A fresh coordinator step after every D1 attempt (D1-build, then D1-finish): it runs the final re-price pass,
compiles `plan.json` measure-only, reads the record, and writes the D1 gate's verdict file, which the runner
routes on and the run checker recomputes, with the design gate's display in it (A-35). You check; you don't
design. Fix nothing in the plan: a failure goes back to D1 as findings.

## Inputs

- **Header:** `stage: "D1-gate"`, `attempt` (counts this concept's D1 gate attempts), `concept`, `mode`,
  `runFolder`, `runFolderRel`, `compile: "measure-only"`, `accepted` (findings the user accepted),
  `faults` (FI-2, FI-3: offline test runs only), `writes`: the verdict file
  `reports/gates/D1-gate-<concept>-a<attempt>.json`, and `plan.json` when the re-price pass or FI-2 may edit
  it.
- **Prompt:** with `--no-ninja`, that there are no currency rates (D-333).
- **Read**, the independent calls in one response: each rung through `mcp__pob2__guide_run {view: {plan:
  "<runFolderRel>/plan.json", stage: "<id>"}}` (`m`, `b`, `n`), and Grep `plan.json` for its `prices` entries;
  `run-log.json` (has pricing stopped? a `stages[]` entry whose `priceOutcomes` counts a `locked_out` or
  `rate_limited` call); and `data/economy/prices.json`, the league table and the conversion table. After the compile, `mcp__pob2__compile_plan`'s text: each stage's key-figure line, and
  every V1 and V2 finding up to 200; when a line says how many more, Grep `compile-record.json`'s
  `stages.<id>.v1.findings` and `stages.<id>.v2.findings` for them. Grep the record for the fields the text
  lacks; never Read it whole. This page states the parts and codes (`gates.md` holds the same table).

## Work

1. **FI-2** (only when the header's `faults` holds it): before anything else, set the first endgame stage's
   (the ladder's first rung: `m`, else `b`) `level` to `1` in `plan.json`, and the `(L<n>)` in its
   `loadoutName` to `(L1)`, so the plan stays valid. Don't undo it in this attempt.
2. **The final re-price pass** (§9), online only, and only while pricing hasn't stopped: call each
   `prices[]` entry that is `unavailable` because of a rate limit (note `rate-limited`) once more, and
   update it in `plan.json`; a refusal leaves it `unavailable`. A weighted-search entry (its `query` has a
   `target`) needs its rung loaded: compile measure-only as step 3 does, select the rung's loadout
   (`mcp__pob2__manage_sets {set_type: "loadout", action: "select", title: "<its loadout name>"}`) and call
   `mcp__pob2__find_upgrades` with the arguments its `query` records; step 3 then compiles the re-priced plan. Count every call by its outcome for your return. Offline, or once pricing has stopped, skip it.
3. **Compile** the whole plan measure-only: `mcp__pob2__compile_plan {plan_path: "<runFolderRel>/plan.json",
   measure_only: true}`, with no `stages`. A compile error is part `compiled` failing (code
   `compile-error`, the error line as the message, the plan stage it names as `stage`); then every other
   part is `unverified`, and you write the verdict file.
4. **Read the record** (`compile-record.json`, C-33) and fill each part (`gates.md`). "Endgame stages" are
   the plan's stages with a `variant`: the rungs `m`, `b` and `n`, each gated the same way (D-281). Once the compile ran, every part but the budget is `pass` or `fail`:
   only the budget may stay `unverified` (D-164).
   - **v1, v2**: `fail` when any endgame stage's `v1` or `v2` verdict in the record has a finding. Each
     record finding becomes a gate finding with its record `code`, part `v1` or `v2`, and the plan stage.
   - **floor**: per endgame stage, `MissingFireResist`, `MissingColdResist` and `MissingLightningResist`
     are 0, and `MissingChaosResist` is 0 or the stage has a `chaosResistException` (then a
     `chaos-exception` finding on a passing floor names the stage's `ChaosResist` value and the reason);
     and the **reference hits** (D-119, D-254, D-353): the compiler writes a waystone-scaled hit for each of
     `enemyPhysicalDamage`, `enemyFireDamage`, `enemyColdDamage`, `enemyLightningDamage` and
     `enemyChaosDamage` that the plan leaves out, and the record's `configWritten` holds every hit of the
     stage. Read each hit there, as the compiler wrote it, not from a ledger entry (D1 writes no `hit_*`
     entry): a stage with no positive hit of a type fails `reference-hit-missing-<type>`; a hit that isn't
     D-254's formula at the variant's area level, rounded by D-256, fails `reference-hit-ledger-<type>` (its
     name kept); and each hit must be below the record's `<Type>MaximumHitTaken` (else `max-hit-<type>`).
     D-254's formula: the damage at the variant's area level (`enemies/map-monsters.json#damage.by-level[<area
     level>]`, at 79 for the budget variant, `enemies/waystones.json#area-level.max` for the non-budget one,
     and 69 for the entering-maps rung: `enemies/waystones.json#area-level.offset` plus 5, D-281, D-327) × (1 +
     the top of the increased-damage modifier / 100), × the top of the extra-damage modifier / 100 for an
     element; D-256 rounds it to 2 decimals, then up to a whole number, since PoB takes these options as whole
     numbers (96.4789 gives 97, 402.000003 gives 402). `<type>` is lower case (`physical`, `chaos`). The other
     codes: `missing-fire-resist`, `missing-cold-resist`, `missing-lightning-resist`,
     `missing-chaos-resist`. `chaos-exception` and `over-target` are information, never a failure.
   - **budget** (D-249, D-281, D-358, D-370, D-371, D-373): for each rung, `m`, `b` and `n`, the stage's filled
     slots **and tree jewels**, and the anoint of `b` and `n` (`b-anoint`, `n-anoint`, priced like a slot), each
     mapped to its `prices[].id`. Online, get the rates with `mcp__pob2__get_currency_rates` (a divine counts 1;
     with `--no-ninja`, the prompt says there are no rates, so you don't call it and the budget is `unverified`,
     D-333). Then, with `data/economy/prices.json` (`gates.md`'s "Price days, targets and ranges" holds the same
     steps):
     1. **The market** `{league, day, late}`: the plan's league; `day`, the whole days from the league's `start`
        (its `league.*` fact) to the latest `date` of the `ok` prices your `basis.budget.slots` entries name
        (a fallback, in no slot, doesn't date it), `null` when the league isn't in the file or none is `ok`;
        `late` when the league's `end` is before that date or the day is above 60.
     2. **Each entry's range** at its rung's price day (`m` and `b` day 7, `n` day 21): its price in divines,
        `p`, times its row's factors, `conversion.under-10.to-day-<7|21>` when `p` is under 10, else
        `conversion.10-or-more.to-day-<7|21>`. Late, the low factor over 4 and the high over 2; a known day
        under 21, the factors are 1.
     3. **Each rung's total**: the lows summed and the highs summed, each end rounded to a whole divine at 10
        or more and to one decimal under 10. Every total known: `pass`.

     Any slot or jewel price `unavailable`, or a currency without a rate: `unverified` (code `unverified`), and
     that rung's `low` and `high` are `null`. Offline, every price is unavailable, so the budget is `unverified`
     and no rate is fetched. **The budget never fails** (D-371): a target is never a pass mark. Add an
     `over-target` finding, information only, for each rare of `b` and `n` whose range's midpoint is above its
     `query.target.divines`, with its `slot` (or `jewel`), `low`, `high` and `target`, and one for `m` when its
     total's midpoint is above 5 divines.
   - **rolledSkill**, the named damage source (D-122, D-217, D-293, D-295): per endgame stage, the
     `skills.rolledGroup` group, which holds the named damage source, has role `clear` or `single_target`
     (else `rolled-role`), and its figure **× its Count** is the largest among the stage's groups with that
     role (else `rolled-not-largest`). Compare one record field for every group of that role, named
     `g<group>s<skill>p<statSet>.<Field>` (the same `<Field>` for each; a group that names a minion skill is
     compared by its minion's `Minion<Field>` at the same key, its figure `MinionTotalDPS` where the others'
     is `TotalDPS`, D-378), read by one rule (D-340): a field with a counted copy Count-scaled, from the stage's
     `countedSkillOutputs[g<group>s<skill>p<statSet>].fields.<Field>` (each group's per-copy figure × its
     Count, WU-55; `TotalDPS` has one); any other field from the raw
     `skillOutputs[g<group>s<skill>p<statSet>].fields.<Field>`, the per-copy value, labelled "per copy" in
     your messages when the group's count is above 1. Or compare a ledger value (`ledger:<id>`, its formula
     carrying any Count). List every group of that role. **The rolled figure's stat set
     is the stage's `skills.main.statSet`** (S7): the stage's `skills.main.group` is its `rolledGroup` (else
     `rolled-not-main`), and a stage without `statSet`, a rolled figure `g<group>s<skill>p<n>` other than
     `g<main.group>s<main.activeSkill>p<main.statSet>`, or a rolled `ledger:<id>` figure whose formula reads
     another breakdown field fails with `rolled-stat-set`.
5. **Accepted findings.** Report every failure the record shows. One equal to a finding in the header's
   `accepted` (same plan stage, part and code) is reported with `"accepted": true`, and fails no part.
6. **The design gate's display** (D-362, A-35). Whenever the compile ran, write the verdict file's `design`
   field, compactly: the runner prints it at the design gate and reads no plan or record for it. One entry
   per endgame rung in `rungs[]`, in ladder order:
   - `stage`; `dps` and `ehp`, the record's `measures.dps` and `measures.ehp`, rounded to whole numbers;
     `arbiter`, on `b` and `n`, the verdict of `measures.arbiter` with its worst hit and ratio (`survives,
     worst physical 0.82`), else `null`; `clearSpeed`, `measures.clearSpeed.speed` (a rough estimate);
   - `anoint`: the notable and its recipe from the record's `stages.<id>.anoint` (`Unbending: Ire, Guilt,
     Greed`), or `null` (`m`);
   - `gear`, `gems` and `tree`: one short line each, under 120 characters: the key uniques and rare targets;
     the named source's group and its main supports; the ascendancy notables and the tree's main clusters.

   Then `estimates[]`, one short line per open estimate the display rests on: a group's Count, a custom
   modifier, a ledger hand calculation, an `unverified` budget, and the rough clear speed once.

## Writes

The verdict file `reports/gates/D1-gate-<concept>-a<attempt>.json`, and `plan.json` only where the header's
`writes` names it (FI-2 and the re-price pass). The field names are a contract (`gates.md`):

```json
{
  "stage": "D1-gate",
  "concept": "r1-a-2",
  "attempt": 1,
  "verdict": { "compiled": "pass", "v1": "pass", "v2": "pass", "floor": "pass", "budget": "unverified", "rolledSkill": "pass" },
  "findings": [
    { "part": "budget", "code": "unverified", "stage": "b", "message": "every budget price is unavailable (offline run)" },
    { "part": "floor", "code": "chaos-exception", "stage": "b", "message": "ChaosResist 28: no slot can carry chaos resistance without dropping a core item or going far over its price target" }
  ],
  "basis": {
    "budget": { "rates": [], "market": { "league": null, "day": null, "late": false },
                "slots": [ { "stage": "m", "slot": "Boots", "priceId": "m-boots" },
                           { "stage": "b", "slot": "Helmet", "priceId": "b-helmet" },
                           { "stage": "b", "jewel": 1001, "priceId": "b-jewel-1001" },
                           { "stage": "b", "slot": "Anoint", "priceId": "b-anoint" },
                           { "stage": "n", "slot": "Helmet", "priceId": "n-helmet" } ],
                "totals": [ { "stage": "m", "low": null, "high": null, "day": 7 },
                            { "stage": "b", "low": null, "high": null, "day": 7 },
                            { "stage": "n", "low": null, "high": null, "day": 21 } ] },
    "rolledSkill": [ { "stage": "b", "figures": [ { "group": 1, "figure": "g1s1p1.TotalDPS" },
                                                  { "group": 2, "figure": "g2s1p1.TotalDPS" } ] } ]
  },
  "design": {
    "rungs": [
      { "stage": "b", "dps": 98412, "ehp": 31250, "arbiter": "survives, worst physical 0.82",
        "clearSpeed": "fast", "anoint": "Unbending: Ire, Guilt, Greed",
        "gear": "Sekhema's Resolve; rare boots, 30% movement speed and resistances",
        "gems": "Blood Hunt with Martial Tempo and Rupture; Herald of Blood",
        "tree": "Brutal Fury and Crushing Impacts; the life and armour wheels by the Warrior start" }
    ],
    "estimates": [ "b: clear speed is a rough estimate from the skill's area" ]
  },
  "recordPath": "compile-record.json",
  "faultsApplied": []
}
```

- `verdict`: each part `pass`, `fail` or `unverified`.
- `findings`: `{part, code, stage, message, accepted?}`, the message citing record fields and C1/E1 keys
  (`b.MissingColdResist 12`, `enemies/map-monsters.json#damage.by-level[79]`). A check that rests on an M
  or L fact says so (A-29).
- `basis`: only what the plan and the record don't say (`gates.md`): the rates; the market `{league, day,
  late}`; every slot and tree jewel of the three rungs with its `priceId`, the anoint of `b` and `n` as a slot
  (`{"stage": "b", "slot": "Anoint", "priceId": "b-anoint"}`); each rung's total `{stage, low, high, day}`
  (`low` and `high` `null` when unverified); per endgame stage, the figure of every group of the named source's
  group's role, with no value. The run checker takes every number from the record (each figure by D-340's
  rule), and W1 quotes the totals and the figures.
- `design`: the design gate's display (step 6), `rungs[]` and `estimates[]`; absent only when the compile
  failed.
- `faultsApplied`: `[{"id": "FI-2", "observed": "<the V1 finding it caused>"}]`, and for FI-3
  `{"id": "FI-3", "observed": "gate run as usual; outcome forced to infeasible"}`, for each directive the
  header held.

## Returns

At most 8 lines: the verdict in one line, the verdict file, and the re-price pass's calls counted by
outcome.

```
D1-gate r1-a-2 attempt 1: compiled pass, v1 pass, v2 pass, floor pass, budget unverified, rolledSkill pass
reports/gates/D1-gate-r1-a-2-a1.json
prices: none (offline)
```

## Fault directives

- **FI-2**: step 1, before the compile. It must make V1 fail for that stage (its points and requirements
  exceed level 1). Report the V1 finding as usual and in `faultsApplied`.
- **FI-3**: no edit. Run the gate as usual, report FI-3 in `faultsApplied`, and add
  `"forced": "infeasible"` and `"evidence": "FI-3 (injected)"` to the verdict file: the runner routes the
  attempt as `infeasible`.
