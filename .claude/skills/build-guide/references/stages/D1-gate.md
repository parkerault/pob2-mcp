# D1-gate: check the endgame variants (`build-guide-coordinator`)

A fresh coordinator step after every D1 attempt (D1-build, D1-tree, then D1-finish): it runs the final re-price
pass, compiles `plan.json` measure-only, reads the record, judges each rung's tree with PoB's node power, and
writes the D1 gate's verdict file, which the runner routes on and the run checker recomputes, with the design
gate's display in it (A-35), and on a pass the draft PoB file the user opens at the design gate (D-466). You
check; you don't design. Fix nothing in the plan: a failure goes back to D1 as findings.

## Inputs

- **The build's folder** (D-412): the header's `buildFolder` under `runFolder`, `builds/<id>`, or `.` for a run
  migrated from schema 3. `plan.json`, `compile-record.json` and the compiled XML are there; below, a bare
  `plan.json` or `compile-record.json` is that folder's, and `<plan>` is `<runFolderRel>/<buildFolder>/plan.json`
  (`<runFolderRel>/plan.json` when `buildFolder` is `.`). `run-log.json` and the verdict files are at the run
  folder's root.
- **Header:** `stage: "D1-gate"`, `attempt` (counts this concept's D1 gate attempts), `concept`, `mode`,
  `runFolder`, `runFolderRel`, `buildFolder`, `compile: "measure-only"`, `accepted` (findings the user
  accepted), `faults` (FI-2, FI-3: offline test runs only), `writes`: the verdict file
  `reports/gates/D1-gate-<concept>-a<attempt>.json`, and `<buildFolder>/plan.json` when the re-price pass or
  FI-2 may edit it.
- **Prompt:** with `--no-ninja`, that there are no currency rates (D-333); after the design gate's `accept` (or
  `accept:file`) with a `retry-pricing` answer at that visit, that this is **the re-price pass** (D-444): F1 runs
  after you, and no design gate.
- **Read**, the independent calls in one response: each rung through `mcp__pob2__guide_run {view: {plan:
  "<plan>", stage: "<id>"}}` (`m`, `b`, `n`: its `tree` with its `needs`, `start`, `end` and `search`, its
  `loadoutName`, `skills.groups`, `skills.cull`, `skills.engagement`, `skills.boss`, `items.slots`, `defence` and
  claims), and Grep `plan.json` for its
  `prices` entries and its `boss_<stage>` ledger entries; `run-log.json` (is pricing stopped, D-444? a
  `pricing.stops[]` entry with no `retry-pricing` answer in `pricing.retries[]` and no resume,
  `resumes[].lengths.stages`, after it: `references/run-log.md`, "Pricing stops"); `data/economy/prices.json`,
  the league table and the conversion table; and `<buildFolder>/pieces.md`'s table (D-434), when the build has
  one, for step 6 (its `## Skill levels` too, D-473), with `<buildFolder>/trades.json` (D-439), when it exists,
  and the reference files
  `.claude/skills/build-guide/references/toughness-targets.json` (D-441; its `arbiter.hitsSurvivedFloor`, 0.8,
  D-449) and
  `.claude/skills/build-guide/references/boss-floor.json` (D-448). After the compile, `mcp__pob2__compile_plan`'s text: each stage's key-figure line, its ledger values, and
  every V1 and V2 finding up to 200; when a line says how many more, Grep `compile-record.json`'s
  `stages.<id>.v1.findings` and `stages.<id>.v2.findings` for them. Grep the record for the fields the text
  lacks; never Read it whole. This page states the parts and codes (`gates.md` holds the same table).

## Work

1. **FI-2** (only when the header's `faults` holds it): before anything else, set the first endgame stage's
   (the ladder's first rung: `m`, else `b`) `level` to `1` in `plan.json`, and the `(L<n>)` in its
   `loadoutName` to `(L1)`, so the plan stays valid. Don't undo it in this attempt.
2. **The final re-price pass** (§9), online only, and only while pricing isn't stopped: call each
   `prices[]` entry that is `unavailable` because of a rate limit (note `rate-limited`), or of a stop the user's
   `retry-pricing` has since lifted (note `pricing stopped`, D-444), once more, and
   update it in `plan.json`; a refusal leaves it `unavailable`. A weighted-search entry (its `query` has a
   `target`) needs its rung loaded: compile measure-only as step 3 does, select the rung's loadout
   (`mcp__pob2__manage_sets {set_type: "loadout", action: "select", title: "<its loadout name>"}`) and call
   `mcp__pob2__find_upgrades` with the arguments its `query` records; step 3 then compiles the re-priced plan. Count every call by its outcome for your return. Offline, or while pricing is stopped, skip it.
   **No trade call once pricing has stopped** (D-422), in any step: no `mcp__pob2__get_leagues`,
   `mcp__pob2__get_item_price` for an item, `mcp__pob2__search_trade_items`, `mcp__pob2__search_stats` or
   `mcp__pob2__find_upgrades`, until a gate's `retry-pricing` lifts the stop (D-444). The market's league is the
   plan's, recorded before the stop, and the market day keeps its computation (step 4).
   `mcp__pob2__get_currency_rates` reads poe.ninja, not the trade site, and stays allowed (not with
   `--no-ninja`), as does `mcp__pob2__get_item_price` for an exchange item.
3. **Compile** the whole plan measure-only: `mcp__pob2__compile_plan {plan_path: "<plan>",
   measure_only: true}`, with no `stages`; it loads every rung's loadout. A compile error is part `compiled`
   failing (code `compile-error`, the error line as the message, the plan stage it names as `stage`); then every
   other part is `unverified`, the tree included, with no finding of its own (no node power call runs), and you
   write the verdict file. A compile the permission system refused (D-421) isn't a compile error: part
   `compiled` is `unverified` with code `tool-refused`, every other part `unverified` as above; write the verdict
   file and return `refused: mcp__pob2__compile_plan`. Grep the new `compile-record.json` for `"planSha1"`: the
   verdict file carries it (F1 checks the plan the user accepts against it, D-413).
4. **Read the record** (`compile-record.json`, C-33) and fill each part (`gates.md`). "Endgame stages" are
   the plan's stages with a `variant`: the rungs `m`, `b` and `n`, each gated the same way (D-281). Once the compile ran, every part but the budget is `pass` or `fail`:
   only the budget may stay `unverified` (D-164), and the tree when `mcp__pob2__get_node_power` fails
   (`tool-error`) or is refused (`tool-refused`, D-421).
   - **v1, v2**: `fail` when any endgame stage's `v1` or `v2` verdict in the record has a finding. Each
     record finding becomes a gate finding with its record `code`, part `v1` or `v2`, and the plan stage (boots
     under their tier with no valid exception are V1's `movement-tier`, D-440). **A boots exception** is a V1
     note, not a finding: read `stages.<id>.v1.notes` for `boots-exception` (the boots under their tier, covered
     by the stage's `items.bootsException`), report it as a `boots-exception` finding, part `v1`, its message the
     note's, which is information and fails nothing, as `chaos-exception` is on a passing floor; `v1` stays
     `pass`.
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
     `missing-chaos-resist`. `chaos-exception` and `over-target` are information, never a failure, and so is
     V1's `boots-exception` (D-440).
   - **budget** (D-249, D-281, D-358, D-370, D-371, D-373): for each rung, `m`, `b` and `n`, the stage's filled
     slots **and tree jewels**, and the anoint of `b` and `n` (`b-anoint`, `n-anoint`, priced like a slot), each
     mapped to its `prices[].id`. In a build held to amendment 13: **no Flask slot** (D-472: flasks are unpriced,
     so leave them out of `basis.budget.slots`), and **a pinned weapon's Swap slot** (`sameAs`, D-464) maps to its
     set-1 slot's entry, or is left out, and that entry counts once in the rung's total. Online, get the rates with `mcp__pob2__get_currency_rates` (a divine counts 1;
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
     `g<group>s<skill>p<statSet>.<Field>` (the same `<Field>` for each; a group whose damage is its minion's (it
     names a minion skill, or its compared skill summons a minion, its record entry carrying `Minion<Field>`
     fields) is compared by its minion's `Minion<Field>` at the same key, its figure `MinionTotalDPS` where the
     others' is `TotalDPS`, D-378, D-385), read by one rule (D-340): a field with a counted copy Count-scaled, from the stage's
     `countedSkillOutputs[g<group>s<skill>p<statSet>].fields.<Field>` (each group's per-copy figure × its
     Count, WU-55; `TotalDPS` has one); any other field from the raw
     `skillOutputs[g<group>s<skill>p<statSet>].fields.<Field>`, the per-copy value, labelled "per copy" in
     your messages when the group's count is above 1. Or compare a ledger value (`ledger:<id>`, its formula
     carrying any Count). List every group of that role. **The rolled figure's stat set
     is the stage's `skills.main.statSet`** (S7): the stage's `skills.main.group` is its `rolledGroup` (else
     `rolled-not-main`), and a stage without `statSet`, a rolled figure `g<group>s<skill>p<n>` other than
     `g<main.group>s<main.activeSkill>p<main.statSet>`, or a rolled `ledger:<id>` figure whose formula reads
     another breakdown field fails with `rolled-stat-set`.
   - **tree** (D-419, D-467), PoB's node power on each rung, after the compile loaded them: the same judge as
     D1-tree's, at reach 12. On `m`, `b` and `n`, in that order, call `mcp__pob2__get_node_power` twice, compact
     (`limit: 0`), with D1-tree's arguments (`D1-tree.md`, "The arguments"): `loadout` the rung's loadout name,
     exactly as the record has it (`stages.<id>.loadoutName`); `keep` the nodes of its `tree.needs`, nothing else,
     and no `protect_for` (D-452: each loadout's tree is its own, so a swap may touch any node of the rung but its
     needs); `clear_group`, always, the record's group number of the rung's first enabled `role: "clear"` group
     (the `g<N>` of its `skillOutputs` keys), else the main group's (the tool's default is the main group);
     **`targets`** the plan's `tree.start` (`{ehp: <its ehp>, maxHit: <its lowestMaxHit.value>}`), **`pace_exchange:
     3`**, and **`pool_groups`** for a weapon set without the clear group, as D1-tree passes them; `max_distance:
     12`; `stats: ["MainDamage", "TotalEHP"]`, with `cull: true` on a rung with `skills.cull` (D-437), so the gate
     ranks by the figure the design shows. The first call is **the swap search**, the second **the rebuild with
     repair** (`rebuild: true`); on a rung whose `tree.search.rebuild` is `undone: <why>`, the swap search alone.
     Step 3's compile loaded every rung. Each reply's `Travel: <T> of <P> points` line gives the rung's `travel`
     and `points` (its untagged main-tree nodes), and its `Best swap:` line the swap left: `none: …`, or `+<x>%
     Main damage (+<n>); …`, its gain in percent the first figure, then its EHP and lowest max hit beside their
     targets, `Remove <N> points: <Name> [<id>], …` and `Add <M> points: <Name> [<id>], …`, the nodes by name, and
     `Searched from branch …` or `branches …`, the branches it freed. **Pool moves** (C-55a, D-426): on a rung with
     weapon-set passives, the reply adds one line per weapon set's pool after it, `Best swap (weapon set <n>): …`
     in the same form (ranked by its `pool_groups` group against a Pinnacle boss, which its line names), a move
     within that pool (only its nodes removed, only nodes tagged to it added, the pool within its points) measured
     with set `<n>` active. A pool move is allowed, as D1-tree applies it; the rung's swap left is the line, main
     or pool, that gains most. The rebuild's `Rebuild:` line, when legal (its `(target …)` form), is the
     rebuild left. A rung whose swap left or rebuild left gains **5%** damage (`Main damage`) or more fails the
     part, one `tree-swap` finding per such rung, its message the bigger move (`b: +6.2% damage by moving 5 points
     from Dexterity, Agile Succession to Cold Nature, Rhythm of Ice`; a pool move's naming its set (`b: weapon set 2:
     +5.4% damage by moving 2 points from Dexterity, Intelligence to Melee Damage`); a rebuild's
     `n: rebuild: +7.1% damage by freeing 14 points for Coated Arms, Impair`); else the part passes. When a call
     fails or times out, the part is `unverified` with one `tool-error` finding, its `stage` the rung and its
     message the error line, and no `tree-swap` finding even on a rung measured at 5% or more: the gate re-runs
     alone and judges every rung then. A refused call (D-421) is `unverified` with `tool-refused`: stop calling,
     write the verdict file, and return `refused: mcp__pob2__get_node_power`.
5. **Accepted findings.** Report every failure the record shows. One equal to a finding in the header's
   `accepted` (same plan stage, part and code) is reported with `"accepted": true`, and fails no part.
6. **The design gate's display** (D-362, A-35). Whenever the compile ran, write the verdict file's `design`
   field, compactly: the runner prints it at the design gate and reads no plan or record for it. First
   `pieces` (D-434), once for the build, since pieces belong to the build, not a rung: `{in, scheduled, out,
   scheduledNames}` from `pieces.md`'s table, `in`, `scheduled` and `out` its rows counted by Status
   (whole numbers), `scheduledNames` the Piece of each `scheduled` row, in the table's order; the display prints
   it as `- Pieces: <n> in, <n> scheduled (<names>), <n> out`, counting the out pieces without naming them
   (D-442), before the rungs. Leave `pieces` out when the build's folder has no `pieces.md` (a build designed
   before amendment 10). Then one entry per endgame rung in `rungs[]`, in ladder order:
   - `stage`; `dps` and `ehp`, the record's `measures.dps` and `measures.ehp`, rounded to whole numbers;
     `arbiter`, on `b` and `n`, the verdict of `measures.arbiter` with its worst hit and ratio (`survives,
     worst physical 0.82`), else `null`; `clearSpeed`, `measures.clearSpeed.speed` (a rough estimate);
     (`dps` stays for old readers: the display shows `damage`);
   - `ehpHit` (D-423), the hit that `ehp` was measured against, which the display's Effective HP line names:
     the rung's reference hits as the record's `configWritten` holds them, by map tier, area level and the
     physical hit (`T15 map hits, area 79: 402 physical`);
   - `anoint`: the notable and its recipe from the record's `stages.<id>.anoint` (`Unbending: Ire, Guilt,
     Greed`), or `null` (`m`);
   - `gear` and `gems`: one short line each, under 120 characters: the key uniques and rare targets; the named
     source's group and its main supports;
   - `tree` (D-419): `{travel, points, bestSwap, needs}` from the tree part: `travel` and `points`, whole
     numbers, from the rung's `Travel:` line; `bestSwap`, the swap left (the main swap or a pool move, whichever
     gains most), `null` when every line says none, else `{gainPercent,
     removed: [<names>], added: [<names>], branches}`, `gainPercent` the swap's damage gain (Main damage; a
     pool move's on a set without the main group, Full DPS) as a number, the names as the
     reply gives them, `branches` the branches it freed (D-439), each `{name, points}` as its `Searched from`
     sentence names it, and for a pool move `weaponSet`, its pool's set (`1` or `2`), which the display names
     (`best swap left (weapon set 2): …`); `needs`, one short line per need of the rung's `tree.needs`, under 120 characters, what
     it keeps and why, from its claim (`Mana on Kill and Mana Regeneration: the howl spam's mana`). The display
     prints the travel and the swap left, then each need, so the user sees why a long branch stays. A rung the
     tool didn't measure (`tool-error`, `tool-refused`): `{"travel": 0, "points": 0, "bestSwap": null, "needs":
     [...]}`, and an `estimates[]` line saying so;
   - **amendment 11's figures** (D-437, D-447), from the record's `stages.<id>.measures`: `damage {map, boss}`,
     `measures.damage`, the named source's damage figure against map monsters (with its cull when the rung
     states `skills.cull`) and PoB alone against a Pinnacle boss; `cull {map, boss}`, `measures.cull`'s two
     thresholds in percent, only on a rung with `skills.cull`, else `null`; `trigger {by, usesPerSecond}`,
     `measures.trigger`, when a meta gem triggers the named source, else `null`; `boss {measured, estimate,
     corrections}`: `measured` the record's `measures.damage.boss`, `estimate` the ledger's `boss_<stage>` value
     from this compile's reply (`boss_n = …`) when the plan has that entry, else `null`, and `corrections` its
     claim's phrases, split at `; ` (`[]` without the entry). The rung's **boss figure** is the estimate when
     there is one, else the measured figure;
   - `trades[]` (D-439), the rung's entries of `<buildFolder>/trades.json`, copied as the file holds them (`[]`
     for none, and when the file is absent): D1-tree's `unmodelled` and `boss` and D1-finish's `boots`, `defence`,
     `damage` and `avoidance`, each with its `maxHit` and `hitsSurvived` in a build held to amendment 12 (D-450),
     and its `bossEntries` and `nodes` in one held to amendment 13 (D-468). A gate that re-runs alone reads the
     same file;
   - on the non-budget rung only: `toughness {engagement, reason, target, band}` (D-441), `engagement` and `reason`
     the plan's `n.skills.engagement`, `target` `toughness-targets.json`'s for that kind, and `band` the record's
     `TotalEHP` against it: `under` below `under` × the target, `over` above `over` × the target, else `within`;
     and in `boss`, `floor`, `boss-floor.json`'s `floor`, and `under`, `true` when the boss figure is below it
     (D-448);
   - **amendment 12's toughness reading and resisting figure** (D-449, D-454), from the record's
     `stages.<id>.measures` and `references/toughness-targets.json`:
     - per variant rung, `damage.resisting`: `damage {map, resisting, boss}`, `resisting` the record's
       `measures.damage.resisting`, the named source's figure against the map enemy with 40% fire, cold and
       lightning resistance (`null` where the record's is);
     - per `b` and `n` rung, `maxHit {lowest, immune, arbiter, oneShot}`: `lowest` the record's
       `measures.toughness.lowestMaxHit` (`{type, value}`, or `null`) and `immune` its `immune` list; `arbiter`
       the **deciding row** of `measures.arbiter.rows` (the rung's one-shot row with the lowest `hitsSurvived`,
       else its row with the largest ratio), `{type, evade, deflect, hitsSurvived, deflectedRatio, method}`:
       `type` the row's, `evade`, `deflect` and `method` the record's `measures.arbiter.avoid` (`0`, `0` and
       `null` without it), `hitsSurvived` and `deflectedRatio` the row's, unrounded; `null` when no row has a
       ratio. `oneShot` is `true` when that row is `one-shot` and its `hitsSurvived` / 100 is below the floor,
       `arbiter.hitsSurvivedFloor` (0.8; 79.6% is under it, though the display shows 79%), else `false`;
     - on `n`, `toughness` gains `chanceShare`, the record's `measures.toughness.chance.share` × 100, the percent of
       the EHP that evade, block and deflection make (`null` when the record's is); `conditioned {ehp, band}`, the
       record's `measures.toughness.conditioned.ehp` (every condition against the build: unlucky rolls, been hit
       recently, not blinded, Wind Dancer at 0) and its band against the same target, or `null`; `ailmentCut`,
       deflection's average cut to ailment damage from hits, the record's `DeflectChance` (against the map enemy)
       × `DeflectEffect` / 100, which PoB doesn't apply (PG-97), `null` when the build deflects nothing; and
       `warning {kind, type, fix}`, in plain words on the display: **`one-shot`** when the EHP is within or over
       its band and `n` is a one-shot rung, `type` the deciding row's; else **`conditioned`** when the conditioned
       EHP is under its band, `type` the conditioned lowest max hit's; else `null`. `fix` is the fix family for
       the type: "the pool, armour or a physical shift" for `physical`, "the pool, armour, a physical shift or
       lightning resistance" for `physical-lightning`, else "the pool or <type> resistance" ("the pool or fire
       resistance"). The display adds PG-100's note itself when the record's `avoid.companionDeflected` is set.
   - **amendment 13's tree search and boss target** (D-467, D-468, D-473), per rung, from the plan's `tree.start`,
     `tree.end` and `tree.search` (D1-tree's), copied, and this compile, so a `design:` resume prints them again:
     - in `boss`: `start` and `end`, `tree.start.boss` and `tree.end.boss`; `entries`, one per boss-rotation entry,
       `{label, start, end, final, valuedBy}`, its figure in `tree.start.bossEntries` and `tree.end.bossEntries`
       (by `label`) and `final` its group's figure in this record's `measures.bossGroups`; `valuedBy` `{figure,
       reason}` from D1-finish's `boss-value-<rung>-g<group>` claim (a buff entry valued by the boss figure with
       and without it: `figure` its percent, `reason` the claim's short phrase), else `null`; and `bossFall`
       `{claim: "boss-fall-<rung>", reason: <tree.search.bossFall>}`, or `null` when `tree.search.bossFall` is;
     - `life {start, end}`, `tree.start.life` and `tree.end.life` (Life isn't a target; the user's toughness
       reading is EHP and the lowest max hit, which the targets held);
     - `swapCap`, `{swaps, lastGain}` from `tree.search` when its `capHit` is true, else `null`;
     - `rebuild`, `tree.search.rebuild` as written (`taken`, `none` or `undone: <why>`);
     - `removedForOthers`, `tree.search.removed` as written, `[{names, skill}]`;
     - `levels`, `[{skill, plus: 0}]` for each damage skill `pieces.md`'s `## Skill levels` leaves at +0 on the
       rung, `[]` for none (and on `m`, which the audit doesn't cover).

     The draft's name isn't in the field: its one home is the run log's `builds[].draftFile` (the draft, below).

   Then `estimates[]`, one short line per open estimate the display rests on: a group's Count, a custom
   modifier, a ledger hand calculation (a `boss_<stage>` estimate among them), an `unverified` budget, the rough
   clear speed once, and a rung whose tree wasn't measured (`b: the passive tree wasn't measured: the node power
   call failed`). The run checker recomputes the band, the estimate, the floor and the trades from the record,
   the plan, the ledger, the two reference files and `trades.json`, and fails a design field that disagrees, a
   non-budget rung whose plan has no `skills.engagement`, or a non-budget rung out of its band or under the floor
   with no trade of its kind. In a build held to amendment 12 it also recomputes the deciding row, the one-shot
   rung, the lowest max hit, the chance-layer share, the conditioned band, the ailment cut and the warning, and
   fails a one-shot rung with no `defence` trade, a damage trade there that lowers the deciding row's max hit,
   an evasion build's `b` or `n` with no `avoidance` trade, and a schema-8 plan's `n` with no `defence` plan. In a
   build held to amendment 13 it holds the step's additions to the plan's `tree.start`, `tree.end` and
   `tree.search` and the record, a fall with no reason or no boss trade, and D1-tree's own change taking `n`'s
   boss figure under the floor.

   **The draft** (D-466), the step's last act, only on a pass that leads to the design gate: compiled, V1, V2,
   floor, rolledSkill and tree pass, the budget `pass` or `unverified`, and not the re-price pass (F1 runs after
   it, with no design gate) nor FI-3. Once the verdict file is written, call `mcp__pob2__compile_plan {plan_path:
   "<plan>", draft_name: "<the build's session name>"}`: its `name` in `run-log.json`'s `builds[]`, else its
   card's name. It runs no engine: the server copies step 3's whole-plan `compiled-build.xml` into the builds
   folder as `<name> (draft).xml`, the name cleaned (`(draft 2)` beside a draft the user changed), so the user can
   open the design in PoB before deciding; a `revise:` that passes again overwrites it. Its reply's first line is
   `Draft written: <relpath>`: return it as `draft: <relpath>`, which the runner records in `builds[].draftFile`.
   A refusal (the plan changed since step 3's compile) writes nothing: return `draft: none: <its line>`. No other
   write reaches the builds folder from this step.

## Writes

The verdict file `reports/gates/D1-gate-<concept>-a<attempt>.json`, and `<buildFolder>/plan.json` only where the
header's `writes` names it (FI-2 and the re-price pass). The field names are a contract (`gates.md`):

```json
{
  "stage": "D1-gate",
  "concept": "r1-a-2",
  "attempt": 1,
  "verdict": { "compiled": "pass", "v1": "pass", "v2": "pass", "floor": "pass", "budget": "unverified", "rolledSkill": "pass", "tree": "pass" },
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
    "pieces": { "in": 5, "scheduled": 0, "out": 1, "scheduledNames": [] },
    "rungs": [
      { "stage": "b", "dps": 98412, "ehp": 31250, "ehpHit": "T15 map hits, area 79: 402 physical",
        "arbiter": "one-shot, worst physical 1.05",
        "maxHit": { "lowest": { "type": "physical", "value": 3320 }, "immune": [],
                    "arbiter": { "type": "physical", "evade": 40, "deflect": 70, "hitsSurvived": 82, "deflectedRatio": 0.63, "method": "pass" },
                    "oneShot": false },
        "clearSpeed": "fast", "anoint": "Unbending: Ire, Guilt, Greed",
        "gear": "Sekhema's Resolve; rare boots, 35% movement speed and resistances",
        "gems": "Twister with Martial Tempo and Rupture; Herald of Blood",
        "tree": { "travel": 9, "points": 113, "bestSwap": { "gainPercent": 3.4, "removed": ["Dexterity", "Agile Succession"], "added": ["Cold Nature", "Rhythm of Ice"],
                                                         "branches": [ { "name": "Agile Succession", "points": 2 } ] },
                  "needs": [ "Mana on Kill and Mana Regeneration: Twister's mana in long fights", "Freedom of Movement: deflection for the Arbiter's slam" ] },
        "damage": { "map": 98412, "resisting": 81000, "boss": 121000 }, "cull": null, "trigger": null,
        "boss": { "measured": 121000, "estimate": null, "corrections": [], "start": 118000, "end": 121000,
                  "entries": [ { "label": "Twister", "start": 100000, "end": 106000, "final": 106000, "valuedBy": null },
                               { "label": "Hammer of the Gods", "start": 18000, "end": 15000, "final": 15000, "valuedBy": null } ],
                  "bossFall": { "claim": "boss-fall-b", "reason": "Hammer of the Gods gives up 3,000 for 6,000 more Twister on the boss" } },
        "life": { "start": 3300, "end": 3250 }, "swapCap": { "swaps": 30, "lastGain": 1.4 }, "rebuild": "taken",
        "removedForOthers": [], "levels": [ { "skill": "Hammer of the Gods", "plus": 0 } ],
        "trades": [ { "stage": "b", "kind": "avoidance", "what": "20 points into deflection (Freedom of Movement, Sure Footing)",
                      "ehpChange": 5, "damageChange": -7, "bossAfter": 112500,
                      "reason": "the same 20 points on the best EHP nodes: +12% EHP, hits survived 82%",
                      "maxHit": null, "hitsSurvived": { "before": 82, "after": 88.3 }, "bossEntries": null, "nodes": null },
                    { "stage": "b", "kind": "avoidance", "what": "a rare helmet's deflection rating line (about 2 divines, 0 points)",
                      "ehpChange": 1, "damageChange": 0, "bossAfter": 121000, "reason": "in place of the helmet's least valuable line",
                      "maxHit": null, "hitsSurvived": { "before": 82, "after": 84.1 }, "bossEntries": null, "nodes": null } ] },
      { "stage": "n", "dps": 240100, "ehp": 17900, "ehpHit": "T16 map hits, area 82: 439 physical",
        "arbiter": "one-shot, worst physical 1.01",
        "maxHit": { "lowest": { "type": "physical", "value": 3451 }, "immune": [],
                    "arbiter": { "type": "physical", "evade": 32, "deflect": 70, "hitsSurvived": 79.6, "deflectedRatio": 0.61, "method": "pass" },
                    "oneShot": true },
        "clearSpeed": "fast", "anoint": "Unbending: Ire, Guilt, Greed",
        "gear": "a Spiked Spear with physical damage; rare boots, 35% movement speed",
        "gems": "Twister with Martial Tempo, Rupture and Bloodlust; Herald of Blood",
        "tree": { "travel": 12, "points": 120, "bestSwap": null, "needs": [ "Freedom of Movement: deflection for the Arbiter's slam" ] },
        "damage": { "map": 240100, "resisting": 198000, "boss": 180000 }, "cull": null, "trigger": null,
        "boss": { "measured": 180000, "estimate": null, "corrections": [], "floor": 250000, "under": true,
                  "start": 175000, "end": 180000,
                  "entries": [ { "label": "Twister", "start": 160000, "end": 165000, "final": 165000, "valuedBy": null },
                               { "label": "Infernal Cry", "start": 15000, "end": 15000, "final": 15000,
                                 "valuedBy": { "figure": 6, "reason": "the exposure" } } ],
                  "bossFall": null },
        "life": { "start": 2980, "end": 2943 }, "swapCap": null, "rebuild": "none",
        "removedForOthers": [ { "names": ["Herald Damage"], "skill": "Herald of Blood" } ], "levels": [],
        "trades": [ { "stage": "n", "kind": "defence", "what": "a rare body with +90 life in place of its cold resistance line",
                      "ehpChange": 6, "damageChange": 0, "bossAfter": 180000, "reason": "one-shot by the Arbiter's physical hit",
                      "maxHit": { "type": "physical", "before": 3451, "after": 3520 }, "hitsSurvived": { "before": 79.6, "after": 100 },
                      "bossEntries": null, "nodes": null },
                    { "stage": "n", "kind": "defence", "what": "12 points into deflection (Freedom of Movement, Agile Succession)",
                      "ehpChange": 4, "damageChange": -3, "bossAfter": 172800, "reason": "one-shot by the Arbiter's physical hit",
                      "maxHit": { "type": "physical", "before": 3451, "after": 3451 }, "hitsSurvived": { "before": 79.6, "after": 84.2 },
                      "bossEntries": null, "nodes": null },
                    { "stage": "n", "kind": "avoidance", "what": "20 points into deflection (Freedom of Movement, Agile Succession, Sure Footing)",
                      "ehpChange": 6, "damageChange": -8, "bossAfter": 165600,
                      "reason": "the same 20 points on the best EHP nodes: +14% EHP, hits survived 79%",
                      "maxHit": null, "hitsSurvived": { "before": 79.6, "after": 90.1 }, "bossEntries": null, "nodes": null },
                    { "stage": "n", "kind": "avoidance", "what": "a rare helmet's deflection rating line (about 2 divines, 0 points)",
                      "ehpChange": 1, "damageChange": 0, "bossAfter": 180000, "reason": "in place of the helmet's least valuable line",
                      "maxHit": null, "hitsSurvived": { "before": 79.6, "after": 82.4 }, "bossEntries": null, "nodes": null },
                    { "stage": "n", "kind": "damage", "what": "moving 4 points from Bone Breaker to Vicious Bite",
                      "ehpChange": -6, "damageChange": 12, "bossAfter": 201600, "reason": "under the boss floor",
                      "maxHit": { "type": "physical", "before": 3451, "after": 3451 }, "hitsSurvived": null,
                      "bossEntries": null, "nodes": null } ],
        "toughness": { "engagement": "distance", "reason": "Twister flies across the screen", "target": 15000, "band": "within",
                       "chanceShare": 51, "conditioned": { "ehp": 10900, "band": "under" }, "ailmentCut": 34,
                       "warning": { "kind": "one-shot", "type": "physical", "fix": "the pool, armour or a physical shift" } } }
    ],
    "estimates": [ "b: clear speed is a rough estimate from the skill's area" ]
  },
  "planSha1": "4f0c3b9e1d2a7c6b5e8f9a0b1c2d3e4f5a6b7c8d",
  "recordPath": "builds/r1-a-2/compile-record.json",
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
- `design`: the design gate's display (step 6), `pieces` (absent for a build with no `pieces.md`), `rungs[]`
  and `estimates[]`; absent only when the compile failed.
- `planSha1`: the record's `planSha1` after step 3's compile, the plan this gate passed; F1 compiles only that
  plan (D-413), and `design:<id>` after a resume is offered only while `plan.json` is still it.
- `recordPath`: the record, from `runFolder` (`<buildFolder>/compile-record.json`).
- `faultsApplied`: `[{"id": "FI-2", "observed": "<the V1 finding it caused>"}]`, and for FI-3
  `{"id": "FI-3", "observed": "gate run as usual; outcome forced to infeasible"}`, for each directive the
  header held.

## Returns

At most 8 lines: the verdict in one line, the verdict file, each rung's travel, the re-price pass's calls
counted by outcome, `draft: <relpath>` (or `draft: none: <why>`) after step 6's draft, and `refused: <tool>` when the
permission system refused a call (D-421).

```
D1-gate r1-a-2 attempt 1: compiled pass, v1 pass, v2 pass, floor pass, budget unverified, rolledSkill pass, tree pass
reports/gates/D1-gate-r1-a-2-a1.json
travel: m 8 of 88, b 9 of 113, n 12 of 120
prices: none (offline)
draft: Twister Deadeye (draft).xml
```

## Fault directives

- **FI-2**: step 1, before the compile. It must make V1 fail for that stage (its points and requirements
  exceed level 1). Report the V1 finding as usual and in `faultsApplied`.
- **FI-3**: no edit. Run the gate as usual, report FI-3 in `faultsApplied`, and add
  `"forced": "infeasible"` and `"evidence": "FI-3 (injected)"` to the verdict file: the runner routes the
  attempt as `infeasible`.
