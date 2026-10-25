# Amendment 11: builds a player would run

**Status: REVISION 1, 2026-10-25,** after the independent review (§21: four lenses and a skeptical verifier) and the
user's answers the same day; waiting for the user's read. A study of boss damage in published builds is running at
the user's request ("I want to see what the report says before I make any decisions about how and what to
measure"); it may add a decision. It carries:
- the user's notes during and after the open-brief half of the live test (WU-109, run `open-clear/2026-10-24-1`),
  the user's choices of 2026-10-24 and 2026-10-25 quoted where they're used;
- the comparison study (`../studies/2026-10-24-reap-infernalist-comparison.md`, cited as [study]), the toughness
  study (`../studies/2026-10-25-toughness-floors.md`) and the user's verdict (work-log 2026-10-24);
- the problems the run's own session recorded at its design gate (cited as [run]);
- two read-only surveys of the code and docs these changes touch (2026-10-25), cited by file and line;
- the small items amendment 10 left for the next fold.

It is written against spec v1.6 and amendments 8 to 10, all built and merged (M-23 at `5f023e5`). Paths are from the
repository root, except stage files (`R1b.md` and so on), under `.claude/skills/build-guide/references/stages/`,
and the skill's other files, under `.claude/skills/build-guide/`. Decisions continue from D-436, work units from
WU-110, criteria from AC-W89, AC-P79 and AC-K72; the milestone is M-24. No contract or PoB gap is added. The plan
schema gains version 7 (§5, §6, §8). Each decision ends with the rows and rules it amends. Appendix A fixes the
formats; §20 lists the proceed-on assumptions.

**Names.**
- The **named source** is the build's damage skill: the plan's `skills.main.group`, which the D1 gate requires to
  be its `rolledGroup` (`D1-gate.md`:104–120, D-286).
- The **damage figure** is a group's five fields, each by the record's Count rule (`COUNT_RULE`,
  `src/plan/record.ts`:118–140): `TotalDPS` × Count, `TotalDot` × Count only when the damage over time stacks,
  `IgniteDPS`, `BleedDPS` and `PoisonDPS` once; a minion's is `MinionTotalDPS` (D-378, D-397). It is WU-106's group
  figure (`R1b.md`:355–361).
- A **scaling change** is a step on the build's ladder where the stats that scale its damage or defence change: a
  level that brings a new skill or gem, a new gear item, an ascendancy node, a keystone or a notable.
- A **trade** is an option the design measures and shows at the design gate, with what it gains and what it costs,
  for the user to take or leave.
- An **unmodelled** node or item is one whose stat lines PoB doesn't apply (`check_model_coverage` says so), such as
  "Meta Skills gain X% increased Energy" (`vendor/…/Data/ModCache.lua`:6189–6194).

## 1. The user's direction

During the run and after it:

> The goal is to see whether it can make good builds, not whether it can make good builds in a hermetically sealed
> box. (2026-10-24, on how live tests run)

> Could we instead just gate it on "it compiles and the skills work as expected", and let the user decide?
> (2026-10-24, on the verification gate)

> The usual reason for a respec is when the player levels up and a new skill or item can be equipped; some nodes may
> not benefit that skill or item, so the points are reallocated to nodes that do. It could be a level gate, a gear
> gate, an ascendency node gate, or a keystone or notable gate. The rule of thumb is: respec when the build changes
> in a way that scales differently. If the scaling stats don't change, grow the tree. (2026-10-24)

> Overall, the build was close, just a few tree and gear misses hobbled it. It got probably 90% of the way there on
> its own, which isn't bad. So yes, in the right range, just a few small misses that would have made a large
> improvement. (2026-10-24, the verdict)

The user's choices are quoted in the decisions that use them.

## 2. What the live test showed

From [study], the run and the surveys:
- **Verification showed a bare skeleton's numbers as the build's**: about 10k damage and under 3k EHP, against the
  user's own Gemling's 566.5k and 14k, and "Damage: not measured per second" on two cards. The damage line read
  `TotalDPS` only, so a bleed card showed no bleed (`run-log.mjs`:1383). Cast on Critical was judged at a skeleton's
  base crit. The user: a mechanic that looks weak "in isolation on an ungeared character" may "have synergies with
  other mechanics that would make it a clear winner".
- **The design gate's damage line was hit damage only** (`measures.dps` is `headlineDps`, the main group's
  `TotalDPS` × Count, `src/plan/record.ts`:562–599): Culling's 61k, while PoB's Full DPS, which node power ranks by,
  was 2.72M, ×11.1 from culling normal monsters at 91%. Against a Pinnacle boss the build does 222k ([study] §4.4).
- **Throatseeker was never tried** (+17% for 5 points, ranked first by both ranking tools). On the non-budget
  rung, `keep` (the budget tree plus the rung's needs) covered all 118 nodes under the user's tree override, so
  node power had no branch to try; on the other rungs the weakest branches freed 1 or 2 points, and a candidate's
  path must fit the freed points (`pob-api/API/NodePower.lua`:700–708). There is no rebuild mode: the comparison's
  "rebuild" was an unconstrained swap whose weakest branch held the whole tree.
- **A respec the user allowed didn't happen**: D1-build passed it to D1-tree as words, and D1-tree may not respec
  (`D1-tree.md`:39–41) [run].
- **The level-95 tree swapped five measured crit-damage nodes for Energy nodes PoB doesn't apply.** The pinned PoB
  has no model of meta-skill Energy, and rates a skill Cast on Critical triggers at its hand-cast speed
  (`CalcTriggers.lua`:1436–1464, `CalcOffence.lua`:2708–2735). Those nodes may be what makes the trigger fire as
  often as PoB assumes.
- **The body armour gave up all defence** for aggravated bleeding: a defensive rare plus Crimson Assault (1 point)
  costs 9% damage for +17% EHP ([study] §4.2). No step compares a unique's lost defences with a rare.
- **The boots had 30% movement speed.** No design rule asks for movement speed; 35% (Hellion's) needs item level 82.
- **The rival** (RV, D-408) added a card the user didn't take, here and in the warcry run.
- **Smaller:** the brainstorm gate's `out:` line is a wall of text; prices show "0.0–0.0 divines (seen 1 exalted)";
  names don't say the skill or ascendancy; D1-build's trade calls can't be logged (`run-log.mjs`:155); the checker
  refuses D1-build after D1-finish in a design revise that already ran D1-build (`check-run.mjs`:3539, :3622–3623,
  against `checkpoints.md`:264–268); runes, soul cores and idols can't be priced; a rate limit stops pricing for the
  session; node power has no max-hit guard [run].

## 3. What already fits

- **The compile, V1, the record and the gate's design field** carry everything the design gate shows; the runner
  prints the field and reads no plan (A-35). New figures are new record and field entries.
- **Weapon set 2's second measure** (`outputsSet2`, amendment 9 §24.2) is the precedent for a second measure of a
  stage under other conditions (§5's boss figure).
- **Needs** (`tree.needs`, D-418) already keep what node power can't see, with a claim D1-finish writes
  (`D1-build.md`:218–236); the run's designers wrote the Energy nodes as needs. §7 shows their cost.
- **Respecs exist in the plan** (`respec {dropped, goldCost, note}`, `src/plan/schema.ts`:161–167) and V1 checks
  them (`tree-continuity`, `src/plan/checks/v1.ts`:504–528). §6 changes who writes them and when.
- **An exception the gate accepts by design** has a precedent: `chaosResistException` and V1's information-only
  codes (`check-run.mjs`:393, `chaos-exception`, `over-target`). §8's boots exception follows it.
- **The travel skill is in the record** (`measures.clearSpeed.travel`, D-427), for the boots exception (§8).
- **Find-upgrades' `required` stats** (D-372, at most 3 per price) carry a movement-speed requirement on the rare
  slots of `b` and `n`; `m`'s slots are priced with `search_trade_items`' `mods` (`pricing.md`:61–62).
- **The pieces' leave-one-out probes** (D-433) already run; §4 changes what they report, not what they do.

## 4. D-436: verification checks that the build works

The verification gate answers "it compiles and the skills work as expected" (the user, 2026-10-24); the user decides
which cards to finalize. Numbers come first at the design gate, measured on the full build.

- **What R1b checks** (its skeleton and compile unchanged):
  1. **It compiles:** `verdict.compiled: "pass"`, as today.
  2. **The named source deals the card's damage:** each kind of damage the card's structure names shows a figure
     above 0 on the named source's group, in the skeleton's record: a hit `TotalDPS` (or `AverageDamage` for an
     on-kill group), damage over time `TotalDot`, an ailment its own field (`IgniteDPS`, `BleedDPS`, `PoisonDPS`),
     a minion `MinionTotalDPS`. A kind that shows nothing is a finding, `damage-missing` ("bleed shows nothing on
     Detonate Dead"): the attempt fails and R1b retries within its counted retries (`R1b.md`:10–11); after them
     the card is `failed` with that finding. The user (2026-10-25) chose "Fail it and retry"; a failed card can
     still be finalized anyway (`checkpoints.md`, finalize). A source a meta gem triggers is rated by PoB at its
     hand-cast speed (§5), and the dossier says so.
  3. **Each piece in does something:** each leave-one-out (D-433) answers `yes` when leaving the piece out moves any
     of its figures by 1% or more (the dead-slot audit's line, `R1b.md`:310–311), `no` when none moves, `PoB can't
     see it` for a piece `check_model_coverage` calls unmodelled, and `not measured (<why>)` when the probe's
     compile failed. The percentages go in R1b's verdict file (`reports/gates/R1b-<id>-a<n>.json`, a `pieces[]`
     entry each), not in the card, the dossier or a display.
- **The status.** The id stays `viable` when 1 and 2 hold; `viable, except <what>` when a piece answers `no`; the
  displays turn them into "works" and "works, except <piece> does nothing in PoB" (`statusWords`,
  `run-log.mjs`:1396–1401). `failed` covers a failed compile and an unresolved `damage-missing`. Pieces PoB can't
  see don't change the status; the Pieces cell says so.
- **The card's Verified line and Pieces measured** (Appendix A) carry the kinds and the answers, no figures.
- **The dossier** (Appendix A) drops the number columns (`Named source DPS`, `Life`, `EHP`, `Clear speed`) and
  `key pieces`, and gains `Damage` (the kinds PoB shows for the named source) and `Pieces` (how many of the `in`
  pieces probed do something, and which don't).
- **The verification display** shows no damage, life, EHP, clear-speed or movement-speed figure. Each card keeps
  its name (no id, D-392), status words, its pitch lines as written (Why pick it, How it clears, Bosses, Needs, The
  catch, `run-log.mjs`:789), its made and changed lines, synergy, damage kinds, pieces, key prices, risks, what PoB
  can't verify, and its structure check. One line under the cards: "Numbers come at the design gate, measured on
  the full build."
- **Downstream readers lose their comparison:** the design gate's Effective HP still names its hit (D-423), but
  "so it compares with the dossier's" goes (`D1-gate.md`:155–160, `checkpoints.md`:251–254); D1-build reads the
  card's row for its kinds and pieces, not "its key numbers" (`D1-build.md`:36–37); W1 and D2 likewise
  (`W1.md`:85–86, `D2.md`:40). `source-markers.md`:44 stops calling the dossier "a table of record numbers".
- **The obvious build** (D-403) has no figures today and keeps none.

Amends D-292 (what the probes report), D-294 and D-423 at verification, D-407's verification lines, D-433
(percentages, `key pieces`), D-355's dossier, D-392's status words, `R1b.md`, `R1b-assemble.md`, the dossier and
card templates, `checkpoints.md`'s verification gate, `run-log.mjs`'s `skeletonFigures` and `verificationDisplay`,
`check-run.mjs`'s dossier columns and Pieces measured checks.

## 5. D-437: one damage figure, against map monsters and a boss

- **The figure.** Wherever the design, the final gate, the audit or the guide shows a build's damage on an endgame
  rung, it's the named source's damage figure (Names), not `TotalDPS` alone and not PoB's Full DPS. Campaign rows
  keep today's figure.
- **Culling counts only when the rotation culls.** The user (2026-10-25), asked what the tree search should
  optimise: "Map damage with cull if and only if the build explicitly utilizes culling in its skill rotation.
  Otherwise, map damage, no cull." This amendment applies the same rule to every display, so the design shows the
  figure the search tunes (proceed-on, §20). The plan's new `stages[].skills.cull` (schema 7, per rung, a short text
  naming the culling source and the button that uses it, e.g. "Legacy of Deathblow's Culling Strike on Detonate
  Dead") states it; with it the figure is multiplied by the named source's own `CullMultiplier` (a global cull,
  such as that rune's, reaches it); without it, it isn't. A cull only another skill carries isn't counted, nor a
  skill's own incidental cull (Reap's) unless the design states it.
- **Two figures per endgame rung.** The compile measures each variant stage twice: under its own config (map
  monsters, as today) and again with only `enemyIsBoss` set to `Pinnacle`, the community convention the user named
  (2026-10-15, work-log). A named source on weapon set 2 is read from set 2's outputs both times, as `outputsSet2`
  is. The record gains `measures.damage {map, boss}` and, when `skills.cull` is set, `measures.cull {map, boss}`,
  the named source's `CullPercent` under each. `measures.dps` stays as written, for old readers.
- **A trigger PoB doesn't model.** When the named source's group holds a gem of PoB's skill types `Meta` and
  `Triggers` (Cast on Critical and its kind), the record gains `measures.trigger {by, usesPerSecond}` on every
  stage it measures, skeletons included, and every display of the figure says the skill is rated at its hand-cast
  speed and PoB doesn't model Energy.
- **The source's skill types.** The record gains `measures.sourceTypes`, the named source's PoB skill types, for
  §9's archetype.
- **Node power ranks by the same figure.** `get_node_power` gains the stat `MainDamage`: the main group's damage
  figure by `COUNT_RULE`, multiplied by its `CullMultiplier` when the call passes `cull: true`. Node power already
  computes every stat on the main group; `clear_group` stays for the guards only (`NodePower.lua`:24–45). D1-tree
  and the D1 gate call it with `stats: ["MainDamage", "TotalEHP"]` and `cull` true when the rung has `skills.cull`;
  a need's call becomes `["<the need's stat>", "MainDamage"]` (`D1-tree.md`:107); D1-tree's 3% loop and the gate's
  5% line are on `MainDamage` (`D1-tree.md`:131, `D1-gate.md`:139). A pool move on a weapon set that doesn't hold
  the main group keeps Full DPS. The best-swap line reads "+<x>% damage" (`run-log.mjs`:1515,
  `check-run.mjs`:3948).
- **The displays** (Appendix A): the design gate's `Damage: <map> per second against map monsters; <boss> against
  a Pinnacle boss.`, then with `skills.cull` `Culls normal monsters at <x>%, bosses at <y>%.`, then the trigger
  line. The final gate's rung lines show the same two figures (`run-log.mjs`:1625–1631). The guide's verdict line
  and the audit's stage table take both (Appendix A); the checker compares them with `measures.damage` where the
  record has it, else `measures.dps` (`check-run.mjs`:1946–1957).

Amends D-294's headline, D-337 (Full DPS's role in the design), D-417 and D-419 (the ranking stat and the swap
line), the record's `headlineDps` for displays, `keyFigureLine`, `render-audit.mjs`'s `headlineDps`, the guide
templates' verdict lines, the audit template's stage table, `run-log.mjs`'s design and final displays, and
`check-run.mjs`'s figure checks.

## 6. D-438: respec when the scaling changes, otherwise grow

The user's rule (§1) replaces one tree track (D-282) as the default's justification; growing stays the default. It
applies to the endgame rungs and to campaign stages: the user (2026-10-25) chose "Include campaign", which lifts the
deferral of campaign respec planning (the user's direction of 2026-10-15, work-log) and amendment 9's deferral of
mid-campaign respecs (D-428).
- **D1-build names each rung's scaling** in the plan's new `stages[].tree.scales` (schema 7, one short line: "crit
  damage, ailment magnitude, physical spell levels"); D2 names each campaign stage's.
- **A stage whose scaling changes from the stage before is a respec stage.** The step that designs it (D1-build for
  `m`, `b`, `n`; D2 for campaign stages) writes its `respec`: `note` names the change and its gate ("the Apron of
  Emiran: bleeding aggravated, bleed magnitude over hit damage"), `dropped` starts empty, `goldCost` its estimate.
  On `b` and `n`, gold is a note, never a reason to skip a respec (the user, 2026-10-24: "By the time the user gets
  to mid to late endgame, the gold cost for respec is not an obstacle"); on `m` and campaign stages, the gold cost
  is weighed as D-282 weighs it today. When D2 adds a campaign under an existing build, `m` is a respec rung if its
  scaling differs from the last campaign stage's, and D2 writes that respec.
- **A respec the user asks for at a gate** reaches the plan the same way: a revise that asks for a respec runs
  D1-build first, even when only the tree changes (today a tree-only revise runs D1-tree alone,
  `checkpoints.md`:264–268). Other tree-only revises are unchanged.
- **D1-tree on a respec rung** keeps the rung's needs and only the prior rung's nodes that still serve the new
  scaling: a node serves when it is a need of this rung, or removing its branch in this rung costs 1% or more of
  `MainDamage` or `TotalEHP` (proceed-on, §20). It frees the rest for node power, writes `respec.dropped` as the
  prior nodes the rung no longer holds and their names into `respec.note` (the guide names them, `W1.md`:73), and
  removes a respec that drops nothing. V1's `tree-continuity` check stays. On a grow rung, `keep` holds the prior
  rung's tree as today.
- **Changes go up the ladder along grow links only** (`D1-tree.md`:74–80): a change on `m` reaches `b` only when
  `b` grows from `m`, and so on.
- **`protect_for` follows grow links only:** a rung protects nodes for a later rung that grows from it, never for
  one that respecs from it. This replaces the user's run override ("neither build should allocate nodes that only
  benefit the other", [run]).
- **"A respec is never the loop's"** (`D1-tree.md`:39–41) becomes: D1-tree completes the respecs D1-build marked and
  never marks one itself. When it finds a scaling change D1-build missed, it returns `respec: <stage> needs one:
  <why>` and logs the outcome `respec`; the runner routes D1-build next, in the same attempt (Appendix A's routes).

Amends D-282, amendment 9's "a respec is never the loop's" (§12, D-418) and its deferral of mid-campaign respecs
(D-428), `D1-build.md`:135–139, `D1-tree.md`:34–55 and :74–80, `D1-gate.md`:122–129, `gates.md`:45 and :114–117,
`D2.md`:96–109, `checkpoints.md`'s revise paths, `plan-reference.md`'s Tree tracks, `SKILL.md`'s D1 routing,
`run-log.mjs`'s D1-tree outcomes, `check-run.mjs`'s order table.

## 7. D-439: the tree search frees several branches, rebuilds, and shows what it can't measure

- **Several branches at once.** Node power's swap search, which today walks the weakest unprotected branches in turn
  until 5 give a legal swap, at most 20 tried (`NodePower.lua`:93–95, :1122–1136), also tries freeing pairs and
  triples of its 5 weakest branches together, fewest points first, so a path longer than any one branch fits (the
  Throatseeker case: a 5-point path behind 1- and 2-point branches). `MAX_TRIES` rises to 40 (proceed-on, §20).
  The result's `bestSwap.branch` becomes `branches[]`. Weapon-set pool moves stay one branch at a time.
- **A rebuild pass.** `get_node_power` gains `rebuild: true`: it frees every node outside `keep`, the protected
  nodes and the paths that connect them to the start, refills the points greedily by gain per point, and judges the
  result as one swap. D1-tree runs it once per rung after its swap loop and takes it when it beats the loop's tree
  under the same judge.
- **A max-hit guard.** The lowest of PoB's five per-type maximum hits taken joins the guards, as `max_loss` key
  `maxHit`, default 2% (proceed-on, §20), whatever the stats ranked.
- **Unmodelled needs are shown as trades.** The user worried that forbidding nodes PoB can't measure "would weaken
  a build that relies on an unmeasurable mechanic" (2026-10-24); the coordinator proposed this rule the same day and
  the user went on to the amendment. An unmodelled node stays allowed as a need that names the mechanic it serves.
  D1-tree measures its cost with node power's new `free: [ids]`: it frees exactly those nodes (and what then
  disconnects), refills the points greedily, and reports the gain, on each rung that holds the need, with the prior
  rung's copies freed too. D1-tree runs `check_model_coverage` on the rung's needs. Each such need becomes a trade
  (§7's file below): "Kept for <mechanic>, which PoB can't measure: the same <n> points elsewhere would add <x>%
  damage."
- **Trades reach the gate through a file.** D1-tree and D1-finish write `<buildFolder>/trades.json` (Appendix A,
  outside `buildSha1`), one entry per trade with its rung; the D1 gate reads it into the design field, and a gate
  that re-runs alone reads the same file. A build without the file (designed before this amendment) has no trades.

Amends D-417 to D-419, `NodePower.lua`'s `SWAP_BRANCHES`, `MAX_TRIES`, `GUARDS` and its result, `get_node_power`'s
schema and description (and the README table), `D1-tree.md`'s loop, `D1-gate.md`'s tree part and step 6.

## 8. D-440: boots carry the best movement speed for the level

The user (2026-10-25): "Any build should always be using the highest movement speed tier for that level. 30% on
entering maps, 35% on budget and non-budget. Unique boots can bypass this rule if and only if the unique is required
to make some other aspect of the build work. Movement speed is a premium stat, so whatever the build gets in exchange
must be of equal or greater value." And: "Campaign boots should use the highest tier for that level." The travel-skill
exception stands (2026-10-25): "a character that is built around a travel skill for movement, where sacrificing
movement speed frees up a more useful boots affix" (2026-10-24).
- **The tiers** (`vendor/…/Data/ModItem.lua`:450–455, boots only): 10% (item level 1), 15% (16), 20% (33), 25%
  (46), 30% (65), 35% (82). Entering maps needs 30%, budget and non-budget 35%; a campaign stage, the highest tier
  its area level allows (proceed-on: "for that level" read as the area level). A corruption's extra 3–5% is never
  required.
- **In the price query:** `b`'s and `n`'s rare boots name the tier's movement speed in `prices[].query.required`
  (one of D-372's 3); `m`'s boots carry it in `search_trade_items`' `mods`. D1-finish prices them so.
- **The exception lives in the plan.** A stage may carry `items.bootsException {kind, reason}` (schema 7):
  - `kind: "travel"`: the build moves with its travel skill (the record's, D-427), and `reason` names the affix the
    boots slot gains in place of the speed;
  - `kind: "unique"`: the unique boots are required for another of the build's mechanics, and `reason` says what
    they give and why it's worth at least the speed they give up ("equal or greater value").
- **V1 checks it:** a new code `movement-tier` when a stage's boots carry less than its tier, naming the boots and
  the tier. With a valid exception (a travel skill in the record for `travel`; unique boots for `unique`) the code is
  information-only, `boots-exception`, like `chaos-exception`; without one it fails the gate's `v1` part. A stage
  with no boots is skipped. The check runs on schema-7 plans only, so an old build's 30% boots don't fail a
  recompile.
- **The gate shows an exception as a trade** (Appendix A): the speed given up and the reason. Unique boots get this
  trade only, never the defence trade (§9); a defence trade's rare boots carry the tier's speed.

Amends `D1-build.md`'s price queries and items, `D1-finish.md`, `D2.md`:118, V1 and its code table
(`02-plan-compiler.md`:915–933), `check-run.mjs`'s information codes, the worked examples that show 30% boots
(`checkpoints.md`:243, `D1-gate.md`:214).

## 9. D-441: toughness targets, with trades below and above

The user (2026-10-25): "A rung below a set EHP at non-budget gets a defence trade shown", and "ranged and melee
builds should have different EHP floors… Final draft waits on those studies." After the study: "Melee 20k, ranged
15k would be a good target, but I think there should probably be a little bit of wiggle room, maybe +/- 10%? That
would get us in the range of "good" defenses and still allow some forgiveness for builds that need it for DPS." And,
asked about a rung far over its target: "Offer a damage trade."
- **The targets:** the non-budget rung's `TotalEHP`, against its reference hits (D-423), is 20,000 for a melee
  build and 15,000 for a ranged one. **The archetype** is read from `measures.sourceTypes` by the study's first
  match: a minion type (`Minion`, `CreatesMinion`, `CommandsMinions`) or a totem, trap or mine type (`SummonsTotem`,
  `Trapped`, `RemoteMined`) is ranged; then `Melee` is melee; everything else is ranged. The targets live in one
  file, `references/toughness-targets.json` (Appendix A), which D1-finish and the checker read.
- **The band:** 90% to 110% of the target is good.
  - **Under 90%** (18,000 melee, 13,500 ranged), the design shows a **defence trade**.
  - **Over 110%** (22,000 melee, 16,500 ranged), it shows a **damage trade**.
  - Neither is a gate failure: the gate shows the trade and the user decides. The gate always shows the rung's EHP
    against its target.
- **The study** (`../studies/2026-10-25-toughness-floors.md`): 30 published league starters at level 90 or above,
  from a private reference library of Mobalytics' verified guides, measured under the design's own non-budget enemy.
  Melee median 31.3k (lowest 17.3k); ranged attacks 22.7k, casters 19.1k, minions 14.7k. Under 90% of these targets
  fall 1 of 13 melee builds (17.3k) and 3 of 17 ranged ones (4.6k, 7.7k, 12.9k), all three one-shot by the Arbiter.
- **What D1-finish measures** on the non-budget rung (proceed-on in its details, §20):
  - **Defence trade:** each armour-slot unique other than boots with no life or ES and no resistances, against a
    defensive rare of its slot (life or ES and resistances), with the cheapest substitute for the unique's effect
    when the unique is a need (Crimson Assault for the Apron's aggravation, [study] §4.2); and node power's best
    swap ranked by `TotalEHP`, with `MainDamage` allowed to fall at most 15%.
  - **Damage trade:** node power's best swap ranked by `MainDamage`, with `TotalEHP` allowed to fall no lower than
    the target.
  - Each trade shows its EHP and damage changes (Appendix A). When none is found, the trade says so: `none found:
    <why>`.
- **The checker recomputes the band** from the record's `TotalEHP` and `sourceTypes` and the targets file, and
  fails a design field whose band or archetype disagrees, or whose rung is out of band with no trade entry.

Amends D-353 (the design gate's toughness lines), `D1-finish.md`, `D1-gate.md`'s design field, `checkpoints.md`'s
design gate, `check-run.mjs`'s design checks.

## 10. D-442: the gates' words

- **Names carry the main skill and the ascendancy:** a few words of the build's own, then the main skill, then the
  ascendancy, like the user's "Reaping Bonfire Detonate Dead Blood Mage". The main skill is the named source, not a
  skill that feeds it (the run's "Reaping Bonfire Reap Infernalist" dealt its damage with Detonate Dead). Replaces
  "a player's name of 2–4 words" (`card-template.md`:49, `R1a-synthesize.md`:122–126, `R1a.md`:267,
  `R1a-assemble.md`:96–98, `checkpoints.md`:92).
- **The brainstorm gate drops `out:`.** Each composite shows its `in` and `scheduled` pieces; `pieces.md` and the
  card keep the out rows and their reasons. The design gate's pieces line counts the out pieces without naming them
  (proceed-on, §20): `- Pieces: <n> in, <n> scheduled (<names>), <n> out`.
- **Prices in players' words.** A price whose range rounds to 0.0 divines shows as seen, `1 exalt (seen
  2026-10-24)`, with no conversion (the user: "it should just say 1 exalted"). In anything the user reads,
  currencies take players' words: "exalt" and "exalts", not the trade id `exalted`; "divine" and "divines";
  "chaos". Plans, records and price entries keep the trade ids. The same holds for rung totals
  (`render-audit.mjs`'s `rangeText`) and "no rate for" lines.

Amends D-392 (names), D-432 (the out line), D-434 (the design pieces line), D-374 (what the user sees),
`pricing.md`:228–239, the card and dossier templates' price cells, `render-audit.mjs`, `run-log.mjs`'s
`pieceLines` and `piecesLine`.

## 11. D-443: the rival is removed

The user (2026-10-24): "Drop it completely." RV.md is deleted with every step, row and rule that runs it: SKILL.md
row 4b and its rules, the researcher's RV role, `checkpoints.md`'s rival on request (:99–105) and marks,
`run-log.md`, `run-folder.md`, `task-header.md`, `R1b.md`'s rival checks, `R1b-assemble.md`'s rival row, the
templates' mentions, `patterns.md`:34, `offline-and-test.md`:120, `league-digest.mjs`:3's comment, and the tests that
pin them. A new run never deals an `x` card. The scripts keep reading old runs (§19's test: a log without
`skillRevision`): the `x` id, RV's outcomes, the rival's dossier row, `not-dealt` and the cap exception. The checker
dates an amendment-8-or-later run by `skillRevision` or `rivalRan` (`check-run.mjs`:995, :4034, :4612), so a new
run without a rival isn't read as an old one. Amends D-408 and amendment 8 §10.

## 12. D-444: pricing stops until the user approves a retry, and prices more items

- **The stop.** After a rate limit or a lockout, no step makes a trade-site request until the user approves a
  retry at the next gate (the user's rule, [run]). poe.ninja's exchange stays allowed, as D-422 allows it, so every
  exchange item keeps its price. The run log records the stop and the approval (Appendix A), and each pricing step
  reads both. A resume still clears a stop (`pricing.md`:190), as today (proceed-on, §20). NFR-22's check, which
  flags any run that hit a limit, is unchanged.
- **The approval.** The next gate asks before its other questions ("Pricing stopped at <step> after <outcome>:
  retry?"); the answer is `retry-pricing` or `no-retry`. After `retry-pricing` at the design gate, the D1 gate's
  re-price pass runs before F1; at the verification gate, the next pricing step prices.
- **D1-build logs its trade calls.** It may call `find_upgrades` for gear; it logs `priceOutcomes` like the pricing
  steps and reads the stop. Amends `run-log.mjs`'s `PRICING` and `check-run.mjs`'s `PRICING_STAGES`, `D1-build.md`.
- **Whatever the currency exchange sells is priced from poe.ninja's exchange.** The user (2026-10-25): "that's a
  rule that applies to all items that can be purchased on the currency exchange, as players don't typically use the
  trade site for anything that can be purchased from the exchange unless they are selling in bulk, and bulk prices
  are different. I believe the only things listed on poe.ninja that aren't available in the currency exchange are
  uniques (gear and tablets) and lineage support gems." So runes, soul cores and idols ("Perfect Body Rune",
  "Courtesan Mannan's Rune of Cruelty", "Legacy of Deathblow", "Wolf Idol"), and every other exchange item, take
  the exchange route; the trade site prices only what the exchange doesn't sell: uniques (gear and tablets),
  lineage support gems, and rares (`find_upgrades`). Today `get_item_price` searches by unique name only
  (`src/services/tradeQueryBuilder.ts`:79–83), and the exchange route maps Distilled Emotions only
  (`src/handlers/tradeHandlers.ts`:306–318). A spike comes first: poe.ninja's exchange categories and the item kinds
  each lists (its economy endpoints, serial requests, fixtures recorded), checking the user's list of what isn't on
  the exchange. No pathofexile.com request is needed. Then the route by category, `get_item_price`'s description
  (`src/server/toolSchemas.ts`:1483) and the README table, a `pricing.md` rule ("exchange items from poe.ninja; the
  trade site for the rest"), and fixtures. Amends D-387 and `pricing.md`:22–24 and :56–62.

Amends D-415 and D-422 (the stop's length and scope), `pricing.md`:188–199, `SKILL.md`:35–40, the gates' answers.

## 13. D-445: published guides are allowed, and cited

The user (2026-10-24) chose "Allowed, cited": agents may read published build guides, on the hosts D-171 allows,
for facts and ideas. A card that draws on one names it in its Evidence with the existing marker (`external | <url>`,
`source-markers.md`:17), and the brainstorm display shows "drawn from <guide's title or host>" under the card, so
the user can tell a known build from the pipeline's own. Replaces `R1a.md`:277's "a reference build only from one
the user named"; the verifier's host rule is unchanged.

## 14. D-446: the fold

- **V1's codes** `empty-weapon-set` and `weapon-skill-supports` get decision rows here, written by the coordinator
  at integration from `src/plan/checks/v1.ts`:755 and :812; all four codes amendments 9 and 10 added
  (`skill-slots`, `empty-weapon-set`, `weapon-skill-supports`, `implicit-variant`) join slice 02's V1 code table
  (`02-plan-compiler.md`:915–933), with `movement-tier` and `boots-exception` (§8).
- **Pieces measured takes `in` rows only** (D-433's wording): amendment 10's Appendix A example and `R1b.md`:408
  drop their scheduled piece, and the checker rejects a probe on a row that isn't `in` (`check-run.mjs`:4352).
- **`bestSwap.weaponSet`** is checked: 1 or 2 when present (`check-run.mjs`:3941–3943).
- **The order rule:** D1-finish logs the outcome `build` when it returns `build: <ids>`, and D1-build may follow it
  in the same attempt even when the attempt already ran D1-build (`check-run.mjs`:3539, :3622–3623;
  `run-log.mjs`:134).

## 15. Costs

Baseline, the open-brief run (output tokens): R1a 1.14M, R1b 683K, RV 85K, D1 1.59M for five design attempts.
Estimated changes, for a run with two builds:
- the rival removed: −85K;
- verification without figures: about −10K (shorter dossier and display); a `damage-missing` retry, when one
  happens, about +30K;
- D1-tree's rebuild pass, `free` measures and coverage checks: about +15K a build (tool calls, few tokens);
- the boss measure: engine time in the compile, no tokens;
- D1-finish's trades, when a rung is out of band: about +25K a build;
- campaign respecs (D2): about +10K a build with a campaign.

About −20K to −60K on a two-build run. Node power's calls take longer (the NFR in AC-P79).

## 16. Work units (M-24)

| Unit | What |
|---|---|
| WU-110 | Node power: several branches and `branches[]`, the rebuild pass, `free`, the `maxHit` guard, `MainDamage` with `cull`, pool moves on Full DPS (`pob-api/API/NodePower.lua`, `src/handlers/treeHandlers.ts`, its `toolSchemas.ts` entry, the README table, `tests/fixtures/tool-calls.json`, `tests/integration/nodePower*.test.ts`) |
| WU-111 | The plan and the record: schema 7 (`stages[].skills.cull`, `stages[].tree.scales`, `stages[].items.bootsException`), the boss measure (set 2 included), `measures.damage`, `measures.cull`, `measures.trigger` (skeletons included), `measures.sourceTypes`, `keyFigureLine`, V1's `movement-tier` and `boots-exception` (`src/plan/`, `pob-api/API/Compile.lua` where the second measure needs it, `docs/build-guide/plan-reference.md`, their tests) |
| WU-112 | Pricing: the poe.ninja exchange spike, then the exchange route for every exchange item (`src/handlers/tradeHandlers.ts`, `src/services/`, `src/trade/`, `get_item_price`'s `toolSchemas.ts` entry and README row, fixtures), `references/pricing.md`'s exchange rule |
| WU-113 | Scripts: `run-log.mjs` (the verification, brainstorm, design and final displays; D1-build's price outcomes; D1-tree's `respec` and D1-finish's `build` outcomes; the pricing stop, the retry answer and their log entries; `skillRevision` at `init` and `resume`; the "drawn from" line; the "damage" swap label; the rival only for old runs), `check-run.mjs` (the dossier columns, Pieces measured, the design field with the band recompute and trades, the guide's verdict line, the order table's new routes, `bestSwap.weaponSet` and `branches`, pieces `in` only, `boots-exception` as information, `damage-missing`, run dating by `skillRevision`, the pricing records, the rival only for old runs), `render-audit.mjs` (the figures, campaign rows unchanged, players' currency words), `scripts/league-digest.mjs`'s comment, `tests/fixtures/pipeline/`, `references/run-log.md`, and the script-side assertions of shared static tests |
| WU-114 | Research and verification docs: `R1a.md`, `R1a-synthesize.md`, `R1a-assemble.md` (names, sources), `R1b.md` (the checks, `damage-missing`, the answers, the verdict file's `pieces[]`), `R1b-assemble.md`, the card and dossier templates, `checkpoints.md` (the interview, brainstorm, verification and final-gate sections and the pre-supplied answers, the retry question), RV.md's removal, the researcher's and coordinator's definitions, `task-header.md`, `run-folder.md`, `references/stages/README.md`, `source-markers.md`, `offline-and-test.md`, `pricing.md` (players' words and the stop), and the tests that pin these |
| WU-115 | Design docs: `D1-build.md`, `D1-tree.md`, `D1-finish.md`, `D1-gate.md`, `checkpoints.md` (the design gate and revise paths), `gates.md`, `D2.md`, `W1.md`, the guide and audit templates, `patterns.md` (its line 34 included, within 13,000 words), `SKILL.md` (all of it: the rival's rows, the D1 routes, the stop, within 325 lines), `references/toughness-targets.json`, and the tests that pin these |
| WU-116 | The live test: the fixed roll (Gemling Legionnaire, Twister, Frost Wall by Cast on Critical), the user's, with the coordinator; it also closes WU-109 |

Order: WU-110, WU-111, WU-112 and WU-113 in parallel, the formats fixed by Appendix A; WU-112 rebases onto WU-110
for `toolSchemas.ts` and the README. Then WU-114 and WU-115 (they cite the built tool descriptions). Then WU-116.
Shared files: `checkpoints.md` is split by section (WU-114: interview, brainstorm, verification, final gate,
pre-supplied answers; WU-115: design gate, revise paths) and merged by rebase. A shared static test file
(`buildGuidePipeline.test.ts`, `buildGuidePiecesMeasured.test.ts`, `buildGuideDesignPieces.test.ts`) is edited by
`describe` block: each unit changes only the assertions on its own files. Before WU-110 starts, the coordinator
records node power's baseline times on the AC-P73 fixture (median of 5) in the work-log. At integration the
coordinator writes §14's decision rows and the V1 table, and amendment 10's Appendix A example.

## 17. Acceptance criteria (M-24)

- **AC-P79 (WU-110).** Engine, on fixture builds:
  - a fixture tree whose best gain is a 5-point path behind weak branches of 2, 2 and 1 points, none enough alone:
    the swap search finds it, and `bestSwap.branches` lists the freed branches;
  - `rebuild: true` on a fixture with a known better tree returns the fixture's expected removed and added nodes,
    judged as one swap;
  - `free: [ids]` frees exactly those nodes and what disconnects, and reports the refill's gain;
  - a swap that lowers the lowest per-type maximum hit by more than 2% is refused; with `max_loss: {maxHit: 10}` it
    passes;
  - `MainDamage` equals the compile record's `measures.damage.map` on the same stage (the main group, `COUNT_RULE`),
    and carries `CullMultiplier` only with `cull: true`;
  - a pool move on a weapon set without the main group still ranks by Full DPS;
  - the existing node-power tests pass with `branches` in place of `branch`;
  - a swap call and a rebuild call on the AC-P73 fixture each finish under 90 seconds, and the work-log records both
    against the baseline (NFR).
- **AC-P80 (WU-110).** The README table matches the new description; `tool-calls.json` holds `rebuild`, `free` and
  `MainDamage` samples.
- **AC-P81 (WU-111).** Plan and engine:
  - a schema-6 plan's record keeps every existing field equal to the pre-change record's; a schema-6 plan using
    `skills.cull`, `tree.scales` or `items.bootsException` errs at its path;
  - a variant stage's `measures.damage.boss` equals a separate compile of the stage with `enemyIsBoss: "Pinnacle"`;
    a named source on weapon set 2 is read from set 2 both times;
  - with `skills.cull`, `measures.cull` holds both thresholds and the map figure carries the named source's
    multiplier; without it, neither;
  - a group with Cast on Critical gives `measures.trigger {by: "Cast on Critical", usesPerSecond}`, on a skeleton
    stage too;
  - `measures.sourceTypes` holds the named source's PoB skill types (Spark: `Spell`; Boneshatter: `Melee`);
  - `movement-tier` fires on budget and non-budget boots with 30% and not with 35%; on entering-maps boots with 25%
    and not with 30%; on a campaign stage of area level 50 with 20% and not with 25%; never on a stage without boots
    or on a schema-6 plan;
  - with `bootsException {kind: "travel"}` and a travel skill in the record the finding is `boots-exception`; with
    `kind: "travel"` and no travel skill it stays `movement-tier`; with `kind: "unique"` and unique boots it is
    `boots-exception`.
- **AC-K72 (WU-112).** Fixture-backed: each of the four named items, and one item from every other exchange category
  the spike found, is priced from its poe.ninja exchange category with no trade-site request; a unique is still
  priced on the trade site; an exchange item poe.ninja doesn't list is `unavailable` with the category it tried.
  The spike's category list, and where it differs from the user's list, is in the work-log.
- **AC-W89 (WU-113).** Script unit, on fixture runs:
  - the verification display prints no damage, life, EHP, clear-speed or movement-speed figure; it prints "works",
    "works, except …", the damage kinds and the pieces line; a card id appears only under "For reference";
  - a `skillRevision: 11` run with the new dossier columns passes and with the old ones fails; an old composite
    run's twelve and an old assemble run's eleven still pass;
  - the new Pieces measured table passes with `yes`, `no`, `PoB can't see it` and `not measured (…)`; a probe on a
    scheduled row fails; old `Key | Drops | How` tables pass in old runs;
  - a `damage-missing` card's retry passes; its `failed` row passes;
  - the brainstorm display has no `out:` line and shows "drawn from …" for a card with an `external` source; the
    design pieces line counts out pieces without names;
  - the design and final displays print both figures; the cull line only with `skills.cull`; the trigger line; each
    trade; the swap line says "damage";
  - the guide's verdict line with two figures passes against `measures.damage`, and an old guide's against
    `measures.dps`;
  - a band or archetype that disagrees with the record and the targets file fails; an out-of-band rung without a
    trade entry fails, with `none found: …` it passes;
  - a price that rounds to 0.0 prints as seen in exalts; no user-facing line says "exalted";
  - `priceOutcomes` on D1-build is accepted; a pricing step after a stop without an approval fails, after
    `retry-pricing` passes;
  - D1-build after a D1-tree with outcome `respec` passes, and after a D1-finish with outcome `build` in an attempt
    that already ran D1-build;
  - `bestSwap.weaponSet: 3` fails; a `boots-exception` finding doesn't fail the gate's `v1` part;
  - an old run with an RV entry still passes; a `skillRevision: 11` run with an `x` card fails; a `skillRevision`
    run without a rival is dated as amendment-8-or-later; `resume` on an old log stamps `skillRevision`, and the
    entries after the stamp are held to the new rules.
- **AC-W90 (WU-114).** Static, one assertion each:
  - `R1b.md` states the three checks, `damage-missing` with its retry, the four answers and the verdict file's
    `pieces[]`;
  - the dossier template has the new columns and the Status values `viable` and `viable, except`;
  - `checkpoints.md`'s verification gate shows no figures and says "Numbers come at the design gate"; it asks the
    pricing retry question;
  - the card template, `R1a-synthesize.md`, `R1a.md`, `R1a-assemble.md` and `checkpoints.md`'s interview state the
    name rule (main skill, then ascendancy);
  - RV.md is gone; no doc under `.claude/skills/build-guide/references/` or `.claude/agents/` runs a rival;
  - `R1a.md` allows published guides with the `external` marker;
  - `pricing.md` states the stop until a gate's retry, its trade-site scope and players' currency words.
- **AC-W91 (WU-115).** Static, one assertion each:
  - `D1-build.md` writes `tree.scales`, marks respec rungs and writes their `respec`, writes `skills.cull` and
    `items.bootsException`, and names the boots tier per rung;
  - `D1-tree.md` keeps only serving prior nodes on a respec rung, propagates along grow links only, protects along
    grow links only, runs the rebuild pass, measures unmodelled needs with `free`, writes `trades.json`, and returns
    `respec:`;
  - `D1-finish.md` reads `references/toughness-targets.json` and measures the defence and damage trades;
  - `D1-gate.md`'s design field holds `damage`, `cull`, `trigger`, `toughness` and `trades` from `trades.json`;
  - `checkpoints.md`'s design gate shows them, and a respec request routes D1-build first;
  - `D2.md` names campaign scaling and writes campaign respecs, and its boots follow the tiers;
  - the guide templates' verdict lines carry two figures;
  - `SKILL.md` routes D1-tree's `respec` and D1-finish's `build`, has no rival row, and stays within 325 lines;
    `patterns.md` stays within 13,000 words.
- **AC-W92 (WU-116).** The live test: the user's judgment of the fixed-roll run, recorded in the work-log, with the
  decisions the run exercised (a respec, a trade, the boss figure, the boots tier, the verification checks) and those
  it didn't; it also completes AC-W88.

## 18. Risks

- **The rebuild pass can wander:** a greedy refill from the kept core may lose a structure the swap loop kept. It
  is judged like any swap, needs stay kept, and D1-tree takes it only when it wins.
- **"Still serves" at 1%** may drop a node whose value shows only with later gear. A need keeps anything the design
  knows it needs; the gate shows the respec's dropped nodes.
- **No numbers at verification** means a weak card reaches the design. The user chose that; the design's attempt
  limit and the gate's trades bound the cost.
- **The boss figure doubles the compile's calcs** on variant stages (no recompile, one config change and a calc).
- **Node power's combinations** multiply its calls; the 90-second limit and the baseline in AC-P79 keep it in
  check, below the point where Claude Code backgrounds an MCP call (A-25).
- **Campaign respecs** add D2 work the user had deferred; the gold cost is still weighed there.
- **Two toughness targets from 30 builds** is a small sample of league starters only (two minion builds, no
  totems), and PoB's EHP swings with the defence type (evasion and deflection read high, armour low at
  non-budget's hits). The 10% band absorbs the spread near a target; a later study can split the ranged target.

## 19. Migration and compatibility

- **Which rules a run is held to:** `run-log.mjs init` writes `skillRevision: 11`, and `resume` stamps it on an old
  log at the resume. The checker holds a log without it to the old rules, and the entries after the stamp to the
  new ones; an artifact written before the stamp is read by its own format (the dossier by its header, a Pieces
  measured table by its columns). `schemaVersion` stays 4: no field changes shape.
- **Old runs stay readable:** the old dossier columns, figures (`measures.dps`), the rival's entries and the old
  pieces lines are accepted where the rules above say so.
- **Plans:** schema 7 adds four optional fields; a schema-6 plan compiles as before, and `movement-tier` never
  runs on it.
- **Records:** new `measures` fields; old records lack them, and the displays and checks fall back to
  `measures.dps` with its old label.
- **Guides already written** keep their one-figure verdict lines; the checker reads them against `measures.dps`.
- **Rollback:** each unit is its own commits on M-24's branch; nothing changes a user's builds.

## 20. Choices for the user, and proceed-on assumptions

Taken on 2026-10-25:
1. **The toughness targets:** melee 20,000 and ranged 15,000 at non-budget, with a 10% band (§9).
2. **Pricing:** every currency-exchange item from poe.ninja's exchange; the trade site for uniques, lineage support
   gems and rares (§12).
3. **Campaign boots:** the highest tier for each stage's level (§8).
4. **A named damage kind that shows nothing at verification:** "Fail it and retry" (§4).
5. **Campaign respecs:** "Include campaign" (§6).
6. **Over the band:** "Offer a damage trade" (§9).

Proceed-on assumptions, the coordinator's, for the user's read:
- the 1% lines: a piece "does something" at 1% (the dead-slot audit's precedent) and a prior node "still serves" at
  1% (§4, §6);
- the tree search's pairs and triples of the 5 weakest branches and `MAX_TRIES` 40 (§7);
- the max-hit guard at 2% by default (§7);
- the defence trade's 15% damage limit, and the damage trade's EHP floor at the target (§9);
- the culling rule applied to every display, not only the search (§5);
- campaign boots by area level (§8);
- the design gate's pieces line as a count (§10);
- a resume still clears a pricing stop (§12);
- the unmodelled-needs rule (§7), the coordinator's proposal after the user's concern;
- old runs keep reading their rival (§11).

## 21. The independent review and its resolution

The review (2026-10-25): four lenses with fresh context, read only (ground-truth fidelity about 272K tokens,
invented decisions 187K, task graph and criteria 203K, completeness and compatibility 246K), found about 100 raw
findings, clustered into 33; a skeptical verifier (228K), defaulting to "refuted", confirmed 19, partly confirmed 8
and refuted or reduced to nits 6. The coordinator re-checked the top three in the code.

| Cluster | Verdict | Resolved in |
|---|---|---|
| K1 D1-tree's `respec:` had no route | confirmed | §6, Appendix A's routes, WU-113, AC-W89 |
| K2 boots exceptions couldn't pass `v1`; old plans would fail | confirmed | §8 `bootsException`, `boots-exception`, schema 7 only; AC-P81 |
| K3 `MainDamage` on the clear group; Count misstated | confirmed | Names, §5 (main group, `COUNT_RULE`), AC-P79 |
| K4 whose cull multiplier | partly | §5 (the named source's own; a global cull reaches it) |
| K5 trades had no channel to the gate | confirmed | §7 `trades.json`, Appendix A |
| K6 an out-of-band rung with no trade failed | confirmed | §9 `none found` |
| K7 resuming old runs; run dating by the rival | partly | §19, §11, AC-W89 |
| K8 the retry triggered nothing; the stop's scope | confirmed | §12 (trade-site only, `retry-pricing`, the re-price pass) |
| K9 wave-1 tests | refuted as a blocker | §16's shared-test rule |
| K10 the guide's verdict line and the final display | confirmed | §5, Appendix A, WU-113 |
| K11 the Pieces measured table | partly | §4, Appendix A (`Key`, `not measured`, the denominator) |
| K12 the D1-finish order rule unrecordable | confirmed | §14 (`build` outcome) |
| K13 the status id | confirmed | §4, Appendix A (`viable` in the dossier) |
| K14 `skills.cull`'s path | confirmed | §5 `stages[].skills.cull` |
| K15 the unmodelled-need measure | confirmed | §7 `free`, `check_model_coverage` |
| K16 the guard's key and the result shape | partly | §7 `maxHit`, `branches[]` |
| K17 AC-P79 unpassable | confirmed | AC-P79 (2+2+1, expected sets, 90 s) |
| K18 `m`'s boots and D-372 | confirmed | §3, §8 |
| K19 the rune's name | confirmed | §12 |
| K20 Full DPS stragglers | partly | §5 |
| K21 respec details, up the ladder | confirmed | §6 |
| K22 totems in the melee rule | partly | §9 (the study's first match) |
| K23 weapon set 2 | confirmed | §5, §7 |
| K24 ownership gaps | partly | §16 |
| K25 criteria | nits | §17 (one assertion each; AC-W92's list) |
| U1 the unique-boots value condition | confirmed | §8 (`reason`, "equal or greater value") |
| U2 "works, except" for a skill that shows nothing | confirmed | §4 (`damage-missing`, the user's choice) |
| U3 campaign respecs | partly | §6 (the user's choice, the deferral lifted) |
| U4 gold beyond mid/late endgame | nit | §6 (`b` and `n` only) |
| U5 the travel exception | confirmed | §8 (`reason` names the affix gained) |
| U6 above the band | nit | §9 (the user's choice: a damage trade) |
| U7 the unmodelled rule | refuted as material | §7, §20 (labelled) |
| U8 invented numbers | nits | §20's proceed-on list |

Refuted inside confirmed clusters: NFR-22 failing a stopped run (intended, kept); the named source's cull being 1
under a rune's Culling Strike (it's global); the `rolledSkill` comparison (D1 picks its field); a second versioning
field (harmless, kept as `skillRevision`); every tree-only revise running D1-build (only respec requests do).

## Appendix A. Formats

### The dossier (a run with `skillRevision: 11`)

`| Card | Round | Status | Synergy | Damage | Pieces | Key prices | League | Main risk |`

- `Status`: `viable`, `viable, except <what>`, `failed after <N> attempts: …` (a `damage-missing` included), or
  `can't be finalized yet: …`.
- `Damage`: the named source and the kinds PoB shows for it, `Detonate Dead: hit, bleed, ignite (rated at its
  hand-cast speed)`; `—` for a failed card.
- `Pieces`: of the `in` pieces probed, `4 of 4 do something`, or `3 of 4: Venopuncture does nothing in PoB;
  Beetlebite: PoB can't see it`; `—` for a plain card.
- `Key prices`: as today; a range that rounds to 0.0 is written as seen, `1 exalt (seen 2026-10-24)`.

### Pieces measured (the card)

`| Key | Left out by | Does something |`: `Key` the piece's key in `### Pieces`; the last cell `yes`, `no`, `PoB can't
see it` or `not measured (<why>)`; `in` rows only. The drops go in R1b's verdict file, `pieces: [{key, figure,
dropPercent}]`.

### The verification display, one card

```
2. Culling Bonfire Detonate Dead Infernalist: works.
   Synergy: Reap's crits trigger Detonate Dead; its corpse blast bleeds and ignites; Deathblow culls.
   Why pick it / How it clears / Bosses / Needs / The catch: <the card's pitch lines, as written>
   Damage: Detonate Dead: hit, bleed, ignite (rated at its hand-cast speed).
   Pieces: 4 of 4 do something.
   Key prices: Apron of Emiran 1 exalt (seen 2026-10-24); …
   Risks: …  PoB can't verify: …  <the structure check's line, when there is one>
```
Under the cards: `Numbers come at the design gate, measured on the full build.` Ids only under "For reference".

### The design gate, one non-budget rung (the lines that change)

```
- Damage: 2,717,385 per second against map monsters; 222,149 against a Pinnacle boss.
- Culls normal monsters at 91%, bosses at 13%.
- Detonate Dead is triggered by Cast on Critical: PoB rates it at its hand-cast speed (1.46 a second) and doesn't model Energy.
- Effective HP: 6,759 (against area 82's map hits: 439 physical).
- Toughness: 6,759 against the 15,000 ranged target, under its band (13,500).
- Passive tree: 56 of 118 points on travel; best swap left: +3.1% damage by moving 5 points from <nodes> to <nodes>
- Kept for Cast on Critical's Energy, which PoB can't measure: the same 6 points elsewhere would add 17% damage.
- Boots: Trampletoe, 25% movement speed, 10% under the tier, for overkill damage hitting nearby enemies.
- Defence: a rare body with life and resistances and Crimson Assault: +17% EHP, −9% damage.
```
The figures are illustrative. The pieces line, once per build: `- Pieces: 5 in, 1 scheduled (Seismic Cry), 2 out`.

### The final gate and the guide

- The final gate's rung lines: `<rung label>: <map> damage per second against map monsters, <boss> against a
  Pinnacle boss; Effective HP <n>`, as today otherwise.
- The guide's verdict line, the damage part: `<Skill> about <map> DPS against map monsters, about <boss> against a
  Pinnacle boss.` in place of `<Skill> about <n> DPS.`
- The audit's stage table: `Named source DPS` becomes `Damage, map / boss` on endgame rungs (campaign rows keep
  their figure).

### The D1 gate's design field (additions)

Per rung: `damage {map, boss}`, `cull {map, boss} | null` (percent, 0–100), `trigger {by, usesPerSecond} | null`,
on the non-budget rung `toughness {archetype: "melee" | "ranged", target, band: "under" | "within" | "over"}`, and
`trades[]` from `trades.json`. `pieces` loses `outNames`. `dps` stays for old readers. `tree.bestSwap` gains
`branches`.

### `<buildFolder>/trades.json`

`{"trades": [{"stage": "n", "kind": "unmodelled" | "boots" | "defence" | "damage", "what": "<short phrase>",
"ehpChange": <percent or null>, "damageChange": <percent or null>, "reason": "<short phrase>"}]}`; a defence or
damage trade with nothing found has `what: "none found: <why>"` and null changes. Written by D1-tree (`unmodelled`)
and D1-finish (`boots`, `defence`, `damage`), each replacing its own kinds' entries; outside `buildSha1`.

### The record (additions)

On each stage it measures: `measures.damage {map, boss}` on variant stages (numbers; the map figure carries the
cull multiplier when `skills.cull` is set), `measures.cull {map, boss}` (`CullPercent`, 0–100) when it is set,
`measures.trigger {by, usesPerSecond}` on any stage whose named source a meta gem triggers, and
`measures.sourceTypes` (string array).

### The plan (schema 7)

- `stages[].skills.cull`: optional text, the culling source and the button that uses it.
- `stages[].tree.scales`: optional text, the stats that scale the stage.
- `stages[].items.bootsException`: optional `{kind: "travel" | "unique", reason}`.

### `get_node_power` (additions)

- `stats` accepts `MainDamage`; `cull: boolean` (default false) multiplies it by the main group's `CullMultiplier`.
- `rebuild: boolean` (default false): the rebuild pass, in place of the swap search.
- `free: number[]`: free exactly these nodes, refill, report the gain.
- `max_loss.maxHit` (default 2): the lowest per-type maximum hit taken, a guard.
- The result's `bestSwap.branch` becomes `branches[]`.

### The run log (additions)

- `skillRevision: 11` at the top level (written at `init`, stamped at `resume` with the entry index it starts at).
- Outcomes: D1-tree `respec`; D1-finish `build`.
- Routes: D1-tree(`respec`) → D1-build; D1-finish(`build`) → D1-build, both in the same attempt.
- `pricing: {stops: [{at, step, outcome}], retries: [{checkpoint, answer: "retry-pricing" | "no-retry", at}]}`.
- A gate's answers gain `retry-pricing` and `no-retry`, asked only after a stop.

### `references/toughness-targets.json`

`{"rung": "non-budget", "targets": {"melee": 20000, "ranged": 15000}, "band": 0.10, "source":
"studies/2026-10-25-toughness-floors.md"}`
