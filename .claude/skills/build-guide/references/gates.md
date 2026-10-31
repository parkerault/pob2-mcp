# Gates and their verdict files

A gate is the check a step must pass before the run moves on. A gate step (R1b, the D1 gate, the D2 gate, F1)
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
  routed as a compile, V1 or V2 failure. Two exceptions (amendment 9): the D1 gate's `tree` part `unverified`
  with `tool-error` re-runs the gate alone (D-419), and a part `unverified` with `tool-refused` takes the refused
  route, to no producer (D-421; both below).
- Each finding names the `part` it belongs to, a stable `code`, the plan `stage` it concerns (a plan
  stage id such as `b`; omitted only for a finding about no one stage), and a `message` citing record
  fields and C1/E1 keys. A V1 or V2 finding keeps the `code` the compile record gives it; floor, budget
  and rolledSkill findings use the codes below. Read the V1 and V2 findings from
  `mcp__pob2__compile_plan`'s text, which prints every one up to 200; past that, a line says how many more,
  and you Grep the record's `stages.<id>.v1.findings` and `stages.<id>.v2.findings` for them.
- **Two findings are equal when their plan `stage`, `part` and `code` are**, whichever gate reports them:
  a V1 finding the user accepted at the D1 gate is the same finding when the D2 gate or the final record
  reports it again, and it covers that plan stage only.
- Extra fields are allowed (for example R1b's `errors`, the D2 gate's and F1's `finalCompile`, the D1 gate's
  and F1's `planSha1`, FI-3's `forced`).
- **R1b's optional `damage` part** (D-436, amendment 11): `pass` or `fail`. Each kind of damage the card's
  structure names shows a figure above 0 on the named source's group in the skeleton's record (a hit `TotalDPS`,
  or `AverageDamage` for an on-kill group; damage over time `TotalDot`; an ailment its own field, `IgniteDPS`,
  `BleedDPS`, `PoisonDPS`; a minion `MinionTotalDPS`); a kind that shows nothing is a `damage-missing` finding,
  and **a `damage-missing` finding fails the attempt** though the skeleton compiled: R1b retries within its
  counted retries, then the card is `failed` with it. `damage: "fail"` needs that finding.

| Gate | Parts | Passes when |
|---|---|---|
| `R1b` | `compiled`, and `damage` when its verdict has it (D-436) | the skeleton compiled with no compile error (C-36), and no `damage-missing` finding: each kind of damage the card names shows a figure on the named source |
| `D1-gate` | `compiled`, `v1`, `v2`, `floor`, `budget`, `rolledSkill`, `tree` | see below |
| `D2-gate` | `compiled`, `v1`, `v2` | the whole plan compiled and V1 and V2 pass for every stage (V1 includes tree continuity, D-192: the campaign track, then the endgame ladder `m` → `b` → `n`, each respec, a stage whose scaling changes from the one before it, D-438, checked with its gold cost, D-282, on a plan at schema 7 or earlier; a schema-8 plan has no respec and no continuity check, each loadout's tree its own, D-452); the final compile then succeeded |
| `F1` | `compiled`, `v1`, `v2` | the endgame-only build's final compile (D-413, `stages/F1.md`): the plan is the one the passing D1 gate compiled (its `planSha1`), it compiled measure-only with V1 and V2 passing for every stage, and the final compile then succeeded; its verdict file is `reports/gates/F1-<id>-a<n>.json`, in the D2 gate's shape with `stage: "F1"` |

## The D1 gate's parts (slice 03 §5.3)

The D1 gate compiles `plan.json` measure-only, reads the record, and measures each rung's tree with PoB's node
power. "Endgame stages" are the plan's stages with a `variant`: the rungs of the endgame ladder, entering maps
(`m`), budget (`b`) and non-budget (`n`), each gated the same way (D-281). D1 is three steps, each a fresh
coordinator step: D1-build, D1-tree and D1-finish (D-356, D-418), then the gate.

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
  one, and each counts). In a build held to amendment 13: **Flask slots are skipped** (D-472: a plain flask is
  unpriced, so it has no entry and maps to none), and **a pinned weapon's Swap slot** (`sameAs`, D-464) maps to its
  set-1 slot's entry, or to none, and that entry counts once for both. Each rung's total is a range at its price
  day, never a pass mark:
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
  stat set's** (amendment 1 S7): the PoB file opens on `skills.main`, so the guide's damage figures, the named
  source's by the record's Count rule (D-294, D-437), are that stat set's. On every stage with a `rolledGroup`,
  `skills.main.group` is that group; D1 sets `skills.main.statSet`; and the named source's figure, directly or
  every breakdown field its ledger formula reads, is `<stage>.g<main.group>s<main.activeSkill>p<main.statSet>`.
- **tree**, the passive tree's travel (D-418, D-419, D-467). After the compile, which loads every rung, the gate
  runs D1-tree's judge at reach 12 on each rung: `mcp__pob2__get_node_power` in compact mode with D1-tree's
  arguments: the rung's loadout; `keep`, the nodes of its needs (`tree.needs`) and nothing else, and no
  `protect_for` (D-452: one tree per loadout, so a swap may touch any node of the rung but its needs);
  `clear_group`; `targets`, the plan's `tree.start` (its EHP and lowest max hit: the finished tree keeps the
  toughness it started with, and a move may trade it inside itself); `pace_exchange: 3` (each pace figure may fall
  L% for 3 × L% more damage); `pool_groups`, so a weapon set's pool without the clear group ranks by its own group
  against a Pinnacle boss; `max_distance: 12`; and `stats: ["MainDamage", "TotalEHP"]`, `cull: true` on a rung
  with `skills.cull` (D-437; `stages/D1-tree.md`). Two calls a rung: the swap search, which frees its weakest
  branches alone and in pairs and triples (D-439), and the rebuild with repair (`rebuild: true`); on a rung whose
  `tree.search.rebuild` is `undone: <why>`, the swap search alone. A rung **fails** when its best swap left, or its
  rebuild, gains at least **5%** damage (`Main damage`) and is legal on the targets, with the move as its finding
  (code `tree-swap`); the part passes when no rung does. D1-tree stops its loop under 1%, so a finished loop leaves
  room for the anoint and the prices D1-finish adds. **A tool failure is not a design failure:** when `get_node_power` fails or times
  out, the part is `unverified` with code `tool-error`, and no `tree-swap` finding (a rung measured at 5% or more
  included): the gate re-runs alone (the outcome table). The design field's rungs carry each one's `tree:
  {travel, points, bestSwap, needs}`: `travel` and `points` whole numbers, the travel at most the points;
  `bestSwap` `null` or `{gainPercent, removed: [names], added: [names], branches}`, `branches` the branches the
  swap freed, a non-empty list, and `weaponSet` 1 or 2 on a pool move; `needs` the needs' reasons as text. The
  run checker checks the part's shape and that its verdict agrees with its findings and the rungs' `bestSwap`;
  it can't recompute node power without the engine.

### The design field's figures, toughness, boss floor and trades (amendment 11)

The D1 gate's `design` field (`stages/D1-gate.md` step 6) carries, per rung, the named source's `damage {map,
boss}` (D-437), its `cull` and `trigger` or `null`, `boss {measured, estimate, corrections}` (D-447: the estimate
is the ledger's `boss_<stage>` value, which is the rung's boss figure when it exists), and `trades[]` from
`<buildFolder>/trades.json` (D-439); on the non-budget rung also `toughness {engagement, reason, target, band}`
(D-441) and the boss's `floor` and `under` (D-448). None is a gate part, and none fails the gate: the design gate
shows each trade and the user decides. The run checker holds them to their sources, in a run held to amendment
11's rules:
- **The toughness band** from the record's `TotalEHP`, the plan's `skills.engagement` and
  `references/toughness-targets.json` (`targets` 20,000 close and 15,000 distance; `under` 0.9, `over` 1.5): a
  design field whose band or engagement disagrees fails, and so does a non-budget rung with no
  `skills.engagement`. A rung under its band has a `defence` trade, one over it a `damage` trade.
- **The boss floor** from `references/boss-floor.json` (`floor` 250,000) and the boss figure: a `boss.floor`
  other than the file's, or a `boss.under` that disagrees, fails; a rung under the floor has a `damage` trade,
  whose `bossAfter` is the boss figure × (1 + `damageChange` / 100) in a build held to amendment 11 (amendment 12
  measures it, below).
- **The boss estimate** (D-447): a design field whose `boss.estimate` differs from the ledger's value fails; a
  `boss_<stage>` formula with no `<stage>.boss.g<group>s<skill>p<statSet>` reference, or one outside the stage's
  rotation (`skills.boss`), fails; and a rotation with a `triggered` entry (the record's `measures.bossGroups`)
  or an entry with `turns`, and no `boss_<stage>` entry, fails.
- **A trade that found nothing** says so, `what: "none found: <why>"` with its changes `null`, and counts as the
  trade shown.

### The toughness reading, the resisting figure and the trades (amendment 12)

In a build whose last D1 gate is held to amendment 12's rules (`skillRevision` 12 from its boundary, §22), the
design field (`stages/D1-gate.md` step 6) also carries, per variant rung, `damage.resisting` (D-454: the named
source's figure against the map enemy with 40% fire, cold and lightning resistance); per `b` and `n` rung, `maxHit
{lowest, immune, arbiter, oneShot}` (D-449); and on `n`, `toughness`'s `chanceShare`, `conditioned {ehp, band}`,
`ailmentCut` and `warning {kind, type, fix} | null`. None is a gate part, and none fails the gate. The run checker
recomputes them from the record and `references/toughness-targets.json`:
- **The deciding row** is a rung's one-shot Arbiter row with the lowest hits survived, else its row with the largest
  ratio; **a one-shot rung** is one whose deciding row is `one-shot` with `hitsSurvived` / 100 below the targets
  file's `arbiter.hitsSurvivedFloor`, 0.8, unrounded (79.6% is one-shot, 80% isn't), evasion and deflection counting
  alike. A design field whose `oneShot`, deciding row, chances, lowest max hit, chance-layer share, conditioned band
  or ailment cut disagrees fails; so does a record row whose hits survived exceeds Names' rule (100% when it
  survives the full hit; else the evade chance plus the rest × the deflect chance when its deflected hit survives;
  else the evade chance).
- **The warning** (G4, G5 its first case): the one-shot warning when the EHP is within or over its band and `n` is a
  one-shot rung; else the conditioned warning when the conditioned EHP is under its band; else none. Its `fix` is the
  fix family of its type: "the pool, armour or a physical shift" (physical), "the pool, armour, a physical shift or
  lightning resistance" (the physical-lightning mix), else "the pool or <type> resistance".
- **The trades** (D-450): a one-shot rung (`b` or `n`) has a `defence` trade, its reason `one-shot by the Arbiter's
  <type> hit`; its defence and damage entries carry `maxHit {type, before, after}`, the deciding row's Pinnacle-pass
  max hit, and a damage trade there whose `maxHit.after` is below `before` fails; an evasion build's `b` and `n` (its
  `n`'s `defence.base` includes `evasion`) have an `avoidance` trade. `none found: <why>` counts as the trade shown.
- **`trades.json` by revision** (§22, Appendix A): every entry of a build held to revision 12 has the 9 fields, `maxHit`
  and `hitsSurvived` `null` where they don't apply (`maxHit` on a one-shot rung's defence and damage entries,
  `hitsSurvived` on the defence and avoidance entries of a build that evades or deflects); kinds `unmodelled`,
  `boots`, `defence`, `damage` and `avoidance`, a defence or avoidance trade on `b` or `n`; a defence
  trade's `reason` is `one-shot by the Arbiter's <type> hit` or `under the toughness band`, either one followed only
  by a boss cut, `; cuts <entry> against a boss by <x>%`. `bossAfter` is measured on the trade's temporary stage
  (D-456), so the checker doesn't recompute it. A build held to 11 keeps the 7 fields and amendment 11's rule for
  `bossAfter`.
- **The defence plan** (D-451): a schema-8 plan's `n` has `defence {base, chance, mitigation, pool, physicalHit}`; a
  schema-7 plan's has none to state.

### The tree search, the boss target and the trades (amendment 13)

In a build whose last D1 gate is held to amendment 13's rules (§22), the design field also carries, per rung (D-467,
D-468, D-473; `stages/D1-gate.md` step 6): in `boss`, `start`, `end`, `entries [{label, start, end, final,
valuedBy}]` and `bossFall {claim, reason} | null`; and `life {start, end}`, `swapCap`, `rebuild`,
`removedForOthers` and `levels`. None is a gate part, and none fails the gate. The run checker holds them:
- **To their sources**, while the gate is fresh: the plan's `tree.start`, `tree.end` and `tree.search` (D1-tree's),
  and each entry's `final` to the record's boss figure of its group.
- **The boss target**: a rung whose boss figure, or an entry, fell from start to end carries the designer's reason
  (`bossFall`, its claim `boss-fall-<rung>` in the plan); a boss figure that fell shows a `boss` trade; on `n`,
  D1-tree's own change never takes the boss figure under the floor from a start at or above it. Under the floor at
  the gate, `n` shows a `damage` or `boss` trade; under its toughness band, a `damage` trade beside its `defence`
  trades (the best damage move, D-467).
- **`trades.json`** has the 11 fields: the 9, and `bossEntries` and `nodes`, `null` but on a `boss` trade, which also
  carries `bossAfter`, the alternative tree's boss figure (Appendix A). A defence trade's `reason` names no boss
  cut: the boss is judged on the rotation (D-468).

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
- Findings with codes `chaos-exception` and `over-target` (and V1's `boots-exception`, D-440) are information:
  they are never failures, and need no acceptance. An `over-target` finding carries, beside its message, `slot`
  (or `jewel`, the node id; neither for `m`'s total), `low` and `high` (its range, rounded by step 6) and `target`
  (in divines):

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
`v1` row's code is the compile record's, and the gate reports and routes it as every V1 finding. The tree part it
checks for shape and agreement only (D-419). Either way an
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
| tree | `tree-swap` | a rung's best swap left, or its rebuild with repair, gains at least 5% damage (`Main damage`, D-437; a pool move ranked by its `pool_groups` group) and is legal on the rung's targets, its `tree.start` (D-467): its message names the rung, the gain, and the nodes moved from and to (D-419) |
| tree | `tool-error` | `mcp__pob2__get_node_power` failed or timed out on a rung: the part is `unverified`, and the gate re-runs alone (D-419) |
| any part | `tool-refused` | the permission system refused the tool call the part needed: `unverified`, the refused route (D-421) |
| v1 | `movement-tier` | a schema-7 stage's boots carry less movement speed than its tier: 30% on `m`, 35% on `b` and `n`, a campaign stage's the highest its area level allows (D-440); a valid `items.bootsException` makes it the V1 note `boots-exception` instead |
| v1 | `boots-exception` | the boots under their tier, covered by the stage's `items.bootsException` (a travel skill in the record for `travel`, unique boots for `unique`): read from the record's `stages.<id>.v1.notes`, information on a passing `v1`, never a failure (D-440) |
| R1b `damage` | `damage-missing` | a kind of damage the card names shows nothing on the named source: the attempt fails, and R1b retries within its counted retries (D-436) |
| v1 | `curse-level-cap` | a schema-8 plan's enabled gem whose curse (or Frost Bomb's exposure, or Thunderstorm's Wet) stops applying below the stage's area level: its cap, at the gem's level with gear's +levels, above 0 and below 69 on `m`, 79 on `b`, 82 on `n`, or a campaign stage's `area-level`; PoB never reads the cap (D-455, PG-86) |
| v1 | `custom-defence` | a schema-8 plan's custom modifier line whose parsed mods add a pool or a defence (life, energy shield, mana, ward, armour, evasion, deflection, block, resistance, damage taken) and whose `reason` names no `coverage: <status>` result from `mcp__pob2__check_model_coverage` (D-451) |
| v1 | `not-granted` | a group whose skill gem, or whose `minionSkill`, a passive grants (`Grants Skill:`), on a stage that allocates none of those passives (D-380): PoB measures the skill anyway, the game doesn't give it. The compile passes (D-192), the `v1` part fails, and D1 or D2 allocates a granting passive from that stage on |

## The D1 gate's outcome

The runner routes by the verdict file and D1's claim, D1-build's return (slice 03 §5.3's table; a pass now goes to
the design gate, D-362). The budget is `pass` or `unverified`, never a failure: no budget finding routes back to D1
(D-371). When several parts fail, the first row that applies routes: a compile, V1 or V2 failure before the floor
and `rolledSkill`, and both before the tree. "D1 re-runs" is its three steps, D1-build, D1-tree and D1-finish
(D-418), then the gate; the gate's 2 counted retries are one count, whichever part fails.

| Gate verdict | D1's claim | Outcome |
|---|---|---|
| compiled, V1, V2, floor, rolledSkill and tree pass; budget pass or unverified | any | the design gate (D-362), then F1 after its `accept` or `accept:file` (D-413); D2 runs only for a build's campaign (D-415) |
| the same, on the re-price pass (after the design gate's `accept` or `accept:file` with a `retry-pricing` answer at that visit, D-444) | any | F1, with no second design gate; a re-price pass that doesn't pass routes as this table's other rows |
| compile, V1 or V2 fails | any | D1 re-runs with the findings; after 2 counted retries, `escalated` |
| only floor or rolledSkill fails | `infeasible` | `infeasible`, with the verdict as evidence (D-141) |
| only floor or rolledSkill fails | `done` | D1 re-runs with the findings; after 2 counted retries, `infeasible` |
| only the tree fails (`tree-swap`) | any | D1-tree, then D1-finish, then the gate, with the verdict as `findings` (D-418, D-419); after 2 counted retries, `escalated` |
| only the tree `unverified`, with `tool-error` | any | logged `fail`; the gate alone re-runs, once, uncounted; a second `tool-error` escalates (D-419) |
| any part `unverified` with `tool-refused` | any | the refused route (below): logged `refused`, then the gate again, uncounted, routed to no producer (D-421) |
| any part but the budget `unverified` | any | as a compile, V1 or V2 failure |
| `"forced": "infeasible"` (FI-3) | any | `infeasible`, evidence `FI-3 (injected)` |
| any failure, after a guided retry or an accepted re-run | any | `escalated` again (D-236) |

**The draft** (D-466): a pass that leads to the design gate writes the design's draft PoB file into the builds
folder (`stages/D1-gate.md` step 6), and the runner records its path in `builds[].draftFile`; an escalation's
`accept`, which goes on as if the gate passed, has the runner write it. A route to D1-tree alone on a plan at schema
8 or earlier (a build designed before amendment 13) runs D1-build first, to move the plan to 9 (§22). An escalation's option 2 (guidance) after
the D1 gate runs D1 from the step the guidance needs (D1-build, or D1-tree for the tree alone), then the gate. Inside an attempt, D1-finish's `build: <ids>` (logged `build`) sends
D1 back to D1-build in the same attempt (D-446); D1-tree and D1-finish then run again. In a run held to amendment
12's rules D1-tree has no `respec` outcome (D-452): a respec the user asks for is a tree request. An older run's
log keeps its routes: there D1-tree's `respec: <stage> needs one: <why>` (logged `respec`) sent D1 back to D1-build
too (D-438).

## The D2 gate's outcome

The D2 gate compiles measure-only and, when the compile, V1 and V2 pass for every stage, runs the final
compile in the same step (`stages/D2-gate.md`). It runs only after D2, which adds a build's campaign on request
(D-413, D-415); an endgame-only build's final compile is F1's. A pass goes to W1. A failure, a failed or refused
final compile included (part `compiled`, code `final-compile`), re-runs D2 with the findings; after 2 counted
retries, `escalated`. After a guided retry or an accepted re-run, any failure escalates again.

## F1's outcome (D-413)

F1 (`stages/F1.md`), a fresh coordinator step after the design gate's `accept` or `accept:file`, is the final
compile of an endgame-only build. It checks that the plan is the one the passing D1 gate compiled (the gate's
`planSha1`, the plan the user accepted), compiles it measure-only, and when the compile, V1 and V2 pass for every
stage runs the final compile with `buildName`. Its header carries `accepted`, as the D2 gate's does: the findings
the user accepted at a D1 gate escalation (option 1), which F1 doesn't count as failures. Its compile's own V1 and
V2 hold the final record to the rules the checker reads.

| F1's verdict | Outcome |
|---|---|
| compiled, V1 and V2 pass; the final compile written | `render-audit.mjs <runFolder> --build <id>`, then W1; after `accept:file`, a build held to amendment 13 by its last D1 gate goes to its claims pass (`V4-claims`, D-477: `SKILL.md` §6, `fix-round.md`), its fix round with D1 alone and its re-check, then ends `file-only`; an older build ends `file-only` |
| a fault, not a design finding: the plan changed since the gate (`plan-changed`), a V1 or V2 failure not in `accepted`, or a compile error on the plan the gate passed (`compile-error`, `final-compile`) | F1 re-runs once, uncounted; a second failure escalates |
| `ledger-refused` (part `compiled`): the write ledger refused the final compile (D-211: the PoB file already exists, or changed on disk) | escalates at once, since no retry changes it |
| any failure, after a guided retry or an accepted re-run | escalates again |

**F1's escalation** (stage `F1`, the verdict file `reports/gates/F1-<id>-a<n>.json`), in the escalation forms of
`run-log.mjs` and the checker:
1. **accept**, not after a compile failure or a ledger refusal: the failing findings join `accepted`, and F1
   runs once more, uncounted;
2. **guidance and one more retry**: D1 (D1-build, D1-tree and D1-finish as the guidance needs), the D1 gate,
   and the design gate again, since the build changed; then F1;
3. **back to the verification gate**: the build ends `dropped`;
4. **stop**: the build ends `escalated`.

For a ledger refusal, the user can also restore or remove the changed file and answer 1: F1 runs again and
accepts no finding.

## The refused route (D-421)

Claude Code's permission system can refuse a tool call inside a step. A refused call isn't a tool error: the
step stops, and its return carries the line `refused: <tool>`. A gate step first writes its verdict file, the
part the call served `unverified` with code `tool-refused`: `compiled` for `mcp__pob2__compile_plan` (every other
part `unverified` with it), `tree` for `mcp__pob2__get_node_power`. The runner, on that line or that code, logs
the step with outcome `refused`, asks the user to allow the tool, and re-runs the refused step alone, next,
uncounted. A verdict with `tool-refused` routes to no producer: never back to D1 or D2, and no retry is spent.

## Logging and accepted findings

The runner logs each gate attempt with the outcome its verdict file routes to, and the run checker holds the
log to the files: a pass is a verdict that passes, an `infeasible` one is forced by FI-3 or fails only floor
or `rolledSkill` (with D1 claiming infeasible, or after 2 counted retries), and an attempt failed by a
fault on attempt 1 runs free only when the verdict's `faultsApplied` names the fault and every failing finding
is on the stage the fault breaks (S6). A D1 gate whose only issue is the tree's `tool-error` is logged `fail`.

A finding the user accepted at an escalation (same plan stage, part and `code`) fails neither that gate
nor a later one (`checkpoints.md`). A current guide passed every gate: the run checker fails a run whose
guide is current (no design step ran after its W1) and whose recomputed floor or named damage
source fails, or whose D1 or D2 gate or F1 before that W1 has a failing part, unless accepted findings cover
every failure. Only a pass, or an `unverified` budget,
proceeds, to the design gate and after its `accept` or `accept:file` to F1.
