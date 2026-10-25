# Amendment 11: builds a player would run

**Status: DRAFT, 2026-10-25,** with the user's toughness targets from the reference-library study (§9); waiting for
the independent review. It carries:
- the user's notes during and after the open-brief half of the live test (WU-109, run `open-clear/2026-10-24-1`),
  the user's choices of 2026-10-24 and 2026-10-25 quoted where they're used;
- the comparison study (`../studies/2026-10-24-reap-infernalist-comparison.md`, cited as [study]) and the user's
  verdict (work-log 2026-10-24);
- the problems the run's own session recorded at its design gate (cited as [run]);
- two read-only surveys of the code and docs these changes touch (2026-10-25), cited by file and line;
- the small items amendment 10 left for the next fold.

It is written against spec v1.6 and amendments 8 to 10, all built and merged (M-23 at `5f023e5`). Paths are from the
repository root, except stage files (`R1b.md` and so on), under `.claude/skills/build-guide/references/stages/`,
and the skill's other files, under `.claude/skills/build-guide/`. Decisions continue from D-436, work units from
WU-110, criteria from AC-W89, AC-P79 and AC-K72; the milestone is M-24. No contract or PoB gap is added. The plan
schema gains version 7 (§5, §6). Each decision ends with the rows and rules it amends. Appendix A fixes the
formats.

**Names.**
- The **damage figure** is a group's five-field figure, Count-scaled: `TotalDPS + TotalDot + IgniteDPS + BleedDPS +
  PoisonDPS` (WU-106's group figure, `R1b.md`:355–361); a minion's is `MinionTotalDPS` (D-378, D-397).
- A **scaling change** is a step on the build's ladder where the stats that scale its damage or defence change: a
  level that brings a new skill or gem, a new gear item, an ascendancy node, a keystone or a notable.
- A **trade** is an option the design measures and shows at the design gate, with what it gains and what it costs,
  for the user to take or leave.
- An **unmodelled** node or item is one whose stat lines PoB doesn't apply (`get_node_power`'s coverage check says
  so), such as "Meta Skills gain X% increased Energy" (`vendor/…/Data/ModCache.lua`:6189–6193).

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
  path must fit one freed branch (`pob-api/API/NodePower.lua`:700–708). There is no rebuild mode: the comparison's
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
  refuses D1-build after D1-finish in a design revise that already ran D1-build (`check-run.mjs`:3539, against
  `checkpoints.md`:264–268); runes, soul cores and idols can't be priced; a rate limit stops pricing for the
  session; node power has no max-hit guard [run].

## 3. What already fits

- **The compile, V1, the record and the gate's design field** carry everything the design gate shows; the runner
  prints the field and reads no plan (A-35). New figures are new record and field entries.
- **Weapon set 2's second measure** (`outputsSet2`, amendment 9 §24.2) is the precedent for a second measure of a
  stage under other conditions (§5's boss figure).
- **Needs** (`tree.needs`, D-418) already keep what node power can't see, with a claim (`D1-build.md`:218–236); the
  run's designers wrote the Energy nodes as needs. §7 shows their cost.
- **Respecs exist in the plan** (`respec {dropped, goldCost, note}`, `src/plan/schema.ts`:161–167) and V1 checks
  them (`tree-continuity`, `src/plan/checks/v1.ts`:504–528). §6 changes who writes them and when.
- **The travel skill is in the record** (`measures.clearSpeed.travel`, D-427), for the boots exception (§8).
- **Find-upgrades' `required` stats** (D-370, at most 3 per price) carry a movement-speed requirement.
- **The pieces' leave-one-out probes** (D-433) already run; §4 changes what they report, not what they do.

## 4. D-436: verification checks that the build works

The verification gate answers "it compiles and the skills work as expected" (the user, 2026-10-24); the user decides
which cards to finalize. Numbers come first at the design gate, measured on the full build.

- **What R1b checks** (its skeleton and compile unchanged):
  1. **It compiles:** `verdict.compiled: "pass"`, as today.
  2. **The named source deals the card's damage:** each kind of damage the card's structure names shows a figure
     above 0 on the named source's group, in the skeleton's record: a hit `TotalDPS` (or `AverageDamage` for an
     on-kill group), damage over time `TotalDot`, an ailment its own field (`IgniteDPS`, `BleedDPS`, `PoisonDPS`),
     a minion `MinionTotalDPS`. A source a meta gem triggers is rated by PoB at its hand-cast speed (§5) and says so.
  3. **Each piece in does something:** each leave-one-out (D-433) reports `yes` when leaving the piece out moves any
     of its figures by 1% or more, `no` when none moves, `PoB can't see it` for a piece the coverage check calls
     unmodelled. The percentages stay in R1b's own notes, not in the card, the dossier or a display.
- **"Works"** means 1 to 3 hold; "works, except <what>" means it compiles but a kind or a piece shows nothing;
  `failed` means it doesn't compile. The status id stays `viable` (D-392); only the words change.
- **The card's Verified line and Pieces measured** (Appendix A) carry the kinds and the yes/no answers, no figures.
- **The dossier** (Appendix A) drops the number columns (`Named source DPS`, `Life`, `EHP`, `Clear speed`) and
  `key pieces`, and gains `Damage` (the kinds PoB shows for the named source) and `Pieces` (how many do something,
  and which don't).
- **The verification display** shows no damage, life, EHP, clear-speed or movement-speed figure. Each card shows its
  status words, synergy, damage kinds, pieces, key prices, risks, what PoB can't verify, its Bosses line as written,
  and its structure check. One line under the cards: "Numbers come at the design gate, measured on the full build."
- **Downstream readers lose their comparison:** the design gate's Effective HP still names its hit (D-423), but
  "so it compares with the dossier's" goes (`D1-gate.md`:155–160, `checkpoints.md`:251–254); D1-build reads the
  card's row for its kinds and pieces, not "its key numbers" (`D1-build.md`:36–37); W1 and D2 likewise.
- **The obvious build** (D-403) has no figures today and keeps none.

Amends D-292 and D-338 (what the probes report), D-294 and D-423 at verification, D-407's verification lines,
D-433 (percentages, `key pieces`), D-355's dossier, D-392's status words, `R1b.md`, `R1b-assemble.md`, the dossier
and card templates, `checkpoints.md`'s verification gate, `run-log.mjs`'s `skeletonFigures` and
`verificationDisplay`, `check-run.mjs`'s dossier columns.

## 5. D-437: one damage figure, against map monsters and a boss

- **The figure.** Wherever the design, the audit or the guide shows a build's damage, it's the named source's
  group's damage figure (Names), not `TotalDPS` alone and not PoB's Full DPS.
- **Culling counts only when the rotation culls.** The user (2026-10-25): "Map damage with cull if and only if the
  build explicitly utilizes culling in its skill rotation. Otherwise, map damage, no cull." The plan's new
  `skills.cull` (schema 7, a short text naming the culling source and the button that uses it, e.g. "Deathblow's
  Culling Strike on Reap") states it; with it the figure is multiplied by PoB's `CullMultiplier`, without it it
  isn't. A skill's own incidental cull (Reap's) doesn't count unless the design states it.
- **Two figures per endgame rung.** The compile measures each variant stage twice: under its own config (map
  monsters, as today) and again with only `enemyIsBoss` set to `Pinnacle`. The record gains `measures.damage {map,
  boss}` and, when `skills.cull` is set, `measures.cull {map, boss}`, PoB's `CullPercent` under each.
  `measures.dps` stays as written, for old readers.
- **A trigger PoB doesn't model.** When the named source's group holds a gem of PoB's skill types `Meta` and
  `Triggers` (Cast on Critical and its kind), the record gains `measures.trigger {by, usesPerSecond}`, and every
  display of the figure says the skill is rated at its hand-cast speed and PoB doesn't model Energy.
- **Node power ranks by the same figure.** `get_node_power` gains the stat `MainDamage`: the clear group's damage
  figure (its `clear_group`, D-417 and AC-P77), multiplied by `CullMultiplier` when the call passes `cull: true`.
  D1-tree and the D1 gate call it with `stats: ["MainDamage", "TotalEHP"]` and `cull` from the plan. The best-swap
  line reads "+<x>% damage", not "Full DPS".
- **The design display** (Appendix A): `Damage: <map> per second against map monsters; <boss> against a Pinnacle
  boss.`; then, with `skills.cull`, `Culls normal monsters at <x>%, bosses at <y>%.`; then the trigger line when
  there is one. The audit and the guide's figures follow.

Amends D-294's headline, D-337 (Full DPS's role in the design), D-417 and D-419 (the ranking stat and the swap
line), the record's `headlineDps` for displays, `keyFigureLine`, `render-audit.mjs`'s `headlineDps`, the guide
templates, and `check-run.mjs`'s figure checks (`measures.damage` where present).

## 6. D-438: respec when the scaling changes, otherwise grow

The user's rule (§1) replaces one tree track (D-282) as the default's justification; growing stays the default.
- **D1-build names each rung's scaling** in the plan's new `tree.scales` (schema 7, one short line: "crit damage,
  ailment magnitude, physical spell levels"), and each campaign stage's in D2.
- **A rung whose scaling changes from the rung before is a respec rung.** D1-build writes its `respec` itself:
  `note` names the change and its gate ("the Apron of Emiran: bleeding aggravated, bleed magnitude over hit
  damage"), `dropped` starts empty, `goldCost` its estimate. Gold is a note, never a reason to skip a respec. A
  respec the user asks for at a gate reaches the plan the same way: the revise runs D1-build first, even when only
  the tree changes (today a tree-only revise runs D1-tree alone, `checkpoints.md`:264–268).
- **D1-tree on a respec rung** keeps the rung's needs and only the prior rung's nodes that still serve the new
  scaling: a node serves when it is a need of this rung, or removing its branch in this rung costs 1% or more of
  `MainDamage` or `TotalEHP`. It frees the rest for node power and writes `respec.dropped` as the prior nodes the
  rung no longer holds; V1's `tree-continuity` check stays. On a grow rung, `keep` holds the prior rung's tree as
  today.
- **`protect_for` follows grow links only:** a rung protects nodes for a later rung that grows from it, never for
  one that respecs from it. This replaces the user's run override ("neither build should allocate nodes that only
  benefit the other", [run]).
- **"A respec is never the loop's"** (`D1-tree.md`:39–41) becomes: D1-tree completes the respecs D1-build marked and
  never marks one itself; it returns `respec: <stage> needs one: <why>` for D1-build when it finds a scaling
  change D1-build missed.

Amends D-282 (and D-144 where it states one track), amendment 9's "a respec is never the loop's" (§12, D-418),
`D1-build.md`:135–139, `D1-tree.md`:34–55, `D1-gate.md`:122–129, `gates.md`:45 and :114–117, `D2.md`:96–109,
`checkpoints.md`'s revise paths, `plan-reference.md`'s Tree tracks.

## 7. D-439: the tree search frees several branches, rebuilds, and shows what it can't measure

- **Several branches at once.** Node power's swap search tries freeing up to 3 of its 5 weakest branches together
  (every pair and triple, fewest points first), so a path longer than any one branch fits. `MAX_TRIES` rises to 40.
- **A rebuild pass.** `get_node_power` gains `rebuild: true`: it frees every node outside `keep`, the protected
  nodes and the paths that connect them to the start, refills the points greedily by gain per point, and judges the
  result as one swap. D1-tree runs it once per rung after its swap loop and takes it when it beats the loop's tree
  under the same judge.
- **A max-hit guard.** The lowest of PoB's five per-type maximum hits taken joins the guards, at `TotalEHP`'s
  allowance (2%) [run].
- **Unmodelled needs are shown as trades.** The user (2026-10-24), on forbidding them: "I'm worried that would
  weaken a build that relies on an unmeasurable mechanic." So an unmodelled node stays allowed as a need that names
  the mechanic it serves. D1-tree measures its cost: one swap call with those nodes left out of `keep`, whose best
  gain is what the points would buy elsewhere. The design field gains a trade per such need, shown as "Kept for
  <mechanic>, which PoB can't measure: the same <n> points elsewhere would add <x>% damage." Node power's coverage
  check also runs on the rung's needs in compact mode (today it checks only the swap's nodes,
  `src/handlers/treeHandlers.ts`:1008–1050).

Amends D-417 to D-419, `NodePower.lua`'s `SWAP_BRANCHES`, `MAX_TRIES` and `GUARDS`, `get_node_power`'s schema and
description (and the README table), `D1-tree.md`'s loop, `D1-gate.md`'s tree part.

## 8. D-440: boots carry the best movement speed for the level

The user (2026-10-25): "Any build should always be using the highest movement speed tier for that level. 30% on
entering maps, 35% on budget and non-budget. Unique boots can bypass this rule if and only if the unique is required
to make some other aspect of the build work. Movement speed is a premium stat, so whatever the build gets in exchange
must be of equal or greater value." The travel-skill exception stands (the user, 2026-10-25).
- **The tiers** (`vendor/…/Data/ModItem.lua`:450–455, boots only): 10% (item level 1), 15% (16), 20% (33), 25%
  (46), 30% (65), 35% (82). Entering maps needs 30%, budget and non-budget 35%; a campaign stage, the highest tier
  its area level allows (the user, 2026-10-25: "Campaign boots should use the highest tier for that level"). A corruption's extra 3–5% is never required.
- **Required in the price query:** the boots' `prices[].query.required` names the tier's movement speed (one of
  D-370's 3), and D1-finish prices them so.
- **V1 checks it:** a new code `movement-tier` when a stage's boots carry less than its tier, naming the boots and
  the tier. The design accepts it only for an exception, with its reason:
  - the build moves with a travel skill (the record's travel skill, D-427);
  - a unique boot the build needs for another of its mechanics, shown at the gate as a trade: the speed it gives
    up against what it gives (measured, or the card's estimate when PoB can't see it).

Amends `D1-build.md`'s price queries, `D1-finish.md`, `D2.md`:118, V1's code table (`02-plan-compiler.md`), the
gate's accepted findings, the worked examples that show 30% boots (`checkpoints.md`:243, `D1-gate.md`:214).

## 9. D-441: a defence trade below the toughness target

The user (2026-10-25): "A rung below a set EHP at non-budget gets a defence trade shown", and "ranged and melee
builds should have different EHP floors. My gut is 8k-10k for ranged, 15k for melee… My guess is different
archetypes will have different average EHP. Final draft waits on those studies." After the study: "Melee 20k, ranged
15k would be a good target, but I think there should probably be a little bit of wiggle room, maybe +/- 10%? That
would get us in the range of "good" defenses and still allow some forgiveness for builds that need it for DPS."
- **The targets:** the non-budget rung's `TotalEHP`, against its reference hits (D-423), is 20,000 for a melee
  build and 15,000 for a ranged one. **Melee** means the named source has PoB's `Melee` skill type; everything else
  (attacks at range, spells, minions, totems) is **ranged**.
- **The band:** within 10% of the target is good. Under 90% of it (18,000 melee, 13,500 ranged) the design shows a
  defence trade. Above the band nothing changes. The gate always shows the rung's EHP against its target.
- **The study** (`../studies/2026-10-25-toughness-floors.md`): 30 published league starters at level 90 or above,
  from a private reference library of Mobalytics' verified guides, measured under the design's own non-budget enemy.
  Melee median 31.3k (lowest 17.3k); ranged attacks 22.7k, casters 19.1k, minions 14.7k. Under 90% of these
  targets fall 1 of 13 melee builds (17.3k) and 3 of 17 ranged ones (4.6k, 7.7k, 12.9k), all three one-shot by the
  Arbiter.
- **When:** the rung is under 90% of its target. It isn't a gate failure; the gate shows the trade and the user
  decides.
- **What the design measures** (D1-finish, on the non-budget rung):
  - each armour-slot unique with no life or ES and no resistances, against a defensive rare of its slot (life or
    ES and resistances), with the cheapest substitute for the unique's effect when the unique is a need (Crimson
    Assault for the Apron's aggravation, [study] §4.2);
  - node power's best swap ranked by `TotalEHP`, with `MainDamage` allowed to fall.
  Each trade shows its EHP gain and its damage cost (Appendix A).
- **The record** gains the named source's skill types, so the archetype is read from the record, not guessed.

Amends D-353 (the design gate's toughness lines), `D1-finish.md`, `D1-gate.md`'s design field, `checkpoints.md`'s
design gate.

## 10. D-442: the gates' words

- **Names carry the main skill and the ascendancy:** a few words of the build's own, then the main skill, then the
  ascendancy, like the user's "Reaping Bonfire Detonate Dead Blood Mage". The main skill is the named damage
  source, the skill whose damage the build measures, not a skill that feeds it (the run's "Reaping Bonfire Reap
  Infernalist" dealt its damage with Detonate Dead). Replaces "a player's name of 2–4 words"
  (`card-template.md`:49, `R1a-synthesize.md`:122–126, `R1a.md`:267, `R1a-assemble.md`:96–98, `checkpoints.md`:92).
- **The brainstorm gate drops `out:`.** Each composite shows its `in` and `scheduled` pieces; `pieces.md` and the
  card keep the out rows and their reasons. The design gate's pieces line counts the out pieces without naming
  them: `- Pieces: <n> in, <n> scheduled (<names>), <n> out`.
- **Prices in players' words.** A price whose range rounds to 0.0 divines shows as seen: `about 1 exalt (seen
  2026-10-24)`, with no conversion. In anything the user reads, currencies take players' words: "exalt" and
  "exalts", not the trade id `exalted`; "divine" and "divines"; "chaos". Plans, records and price entries keep the
  trade ids. The same holds for rung totals (`render-audit.mjs`'s `rangeText`) and "no rate for" lines.

Amends D-392 (names), D-432 (the out line), D-434 (the design pieces line), D-374 (what the user sees),
`pricing.md`:228–239, the card and dossier templates' price cells, `render-audit.mjs`, `run-log.mjs`'s
`pieceLines` and `piecesLine`.

## 11. D-443: the rival is removed

The user (2026-10-24): "Drop it completely." RV.md is deleted with every step, row and rule that runs it (SKILL.md
row 4b and its rules, the researcher's RV role, `checkpoints.md`'s rival on request and marks, `run-log.md`,
`run-folder.md`, `task-header.md`, `R1b.md`'s rival checks, `R1b-assemble.md`'s rival row, the templates'
mentions, `patterns.md`:34). A new run never deals an `x` card. The scripts keep reading old runs: the `x` id, RV's
outcomes, the rival's dossier row, `not-dealt` and the cap exception stay accepted in a run whose log already holds
an RV entry, and nowhere else. Amends D-408 and amendment 8 §10.

## 12. D-444: pricing stops until the next gate, and prices more items

- **The stop.** After a rate limit or a lockout, no step prices until the user approves a retry at the next gate
  (the user's rule, [run]); the gate asks. The run log records the stop and the approval, and each step reads both.
  Amends D-415 and D-422's session-long stop.
- **D1-build logs its trade calls.** It may call `find_upgrades` for gear; it logs `priceOutcomes` like the pricing
  steps and reads the stop. Amends `run-log.mjs`'s `PRICING` and `check-run.mjs`'s `PRICING_STAGES`, `D1-build.md`.
- **Whatever the currency exchange sells is priced from poe.ninja's exchange.** The user (2026-10-25): "that's a
  rule that applies to all items that can be purchased on the currency exchange, as players don't typically use the
  trade site for anything that can be purchased from the exchange unless they are selling in bulk, and bulk prices
  are different. I believe the only things listed on poe.ninja that aren't available in the currency exchange are
  uniques (gear and tablets) and lineage support gems." So runes, soul cores, idols ("Perfect Body Rune", "Rune of
  Cruelty", "Legacy of Deathblow", "Wolf Idol"), and every other exchange item, take the exchange route; the trade
  site prices only what the exchange doesn't sell: uniques (gear and tablets), lineage support gems, and rares
  (`find_upgrades`). Today `get_item_price` searches by unique name only (`src/services/tradeQueryBuilder.ts`:79–83),
  and the exchange route maps Distilled Emotions only (`src/handlers/tradeHandlers.ts`:306–318). A spike comes first:
  poe.ninja's exchange categories and the item kinds each lists (its economy endpoints, serial requests, fixtures
  recorded), checking the user's list of what isn't on the exchange. No pathofexile.com request is needed. Then the
  route by category, a `pricing.md` rule ("exchange items from poe.ninja; the trade site for the rest"), and
  fixtures. Amends D-387 and `pricing.md`:22–24 and :56–62.

## 13. D-445: published guides are allowed, and cited

The user (2026-10-24) chose "Allowed, cited": agents may read published build guides, on the hosts D-171 allows,
for facts and ideas. A card that draws on one names it in its Evidence (`external | <url>`), and the brainstorm
gate shows "drawn from <guide>" under the card, so the user can tell a known build from the pipeline's own.
Replaces `R1a.md`:277's "a reference build only from one the user named"; the verifier's host rule is unchanged.

## 14. D-446: the fold

- **V1's codes** `empty-weapon-set` and `weapon-skill-supports` get decision rows, and all four codes amendments 9
  and 10 added (`skill-slots`, `empty-weapon-set`, `weapon-skill-supports`, `implicit-variant`) join slice 02's V1
  code table (`02-plan-compiler.md`:917–942), with `movement-tier` (§8).
- **Pieces measured takes `in` rows only** (D-433's wording): Appendix A's example in amendment 10 and `R1b.md`:408
  drop their scheduled piece, and the checker rejects a probe on a row that isn't `in` (`check-run.mjs`:4352).
- **`bestSwap.weaponSet`** is checked: 1 or 2 when present (`check-run.mjs`:3941–3943).
- **The order rule:** D1-build may follow D1-finish in an attempt whenever D1-finish returned `build:`
  (`check-run.mjs`:3539, :3642).

## 15. Costs

Baseline, the open-brief run (output tokens): R1a 1.14M, R1b 683K, RV 85K, D1 1.59M for five design attempts.
Estimated changes, for a run with two builds:
- the rival removed: −85K;
- verification without figures: about −10K (shorter dossier and display);
- D1-tree's rebuild pass and unmodelled costs: about +10K a build (tool calls, few tokens);
- the boss measure: engine time in the compile, no tokens;
- D1-finish's defence trades, when a rung is under its floor: about +25K a build.

About −30K to −60K on a two-build run. Node power's calls take longer (NFR in §17).

## 16. Work units (M-24)

| Unit | What |
|---|---|
| WU-110 | Node power: several branches, the rebuild pass, the max-hit guard, `MainDamage` with `cull`, the coverage check on needs (`pob-api/API/NodePower.lua`, `src/handlers/treeHandlers.ts`, `src/server/toolSchemas.ts`, the README table) |
| WU-111 | The plan and the record: schema 7 (`skills.cull`, `tree.scales`), the boss measure, `measures.damage`, `measures.cull`, `measures.trigger`, the named source's skill types (D-441), `keyFigureLine`, V1's `movement-tier` (`src/plan/`, `pob-api/API/Compile.lua` where the second measure needs it, `docs/build-guide/plan-reference.md`) |
| WU-112 | Pricing: the spike on poe.ninja's exchange categories, then the exchange route for every exchange item (`src/handlers/tradeHandlers.ts`, `src/services/`, `src/trade/`, fixtures), `references/pricing.md`'s rule |
| WU-113 | Scripts: `run-log.mjs` (the verification display, the brainstorm and design displays, D1-build's price outcomes, the stop and the retry, the rival only for old runs), `check-run.mjs` (the dossier columns, the design field, the order rule, `bestSwap.weaponSet`, pieces `in` only, the rival only for old runs), `render-audit.mjs` (the figures, players' currency words), `scripts/run-usage.mjs`, `tests/fixtures/pipeline/`, `references/run-log.md` |
| WU-114 | Research and verification docs: `R1a.md`, `R1a-synthesize.md`, `R1a-assemble.md` (names, sources), `R1b.md`, `R1b-assemble.md`, the card and dossier templates, `checkpoints.md` (the brainstorm and verification gates only), `SKILL.md`, RV.md's removal, the researcher's and coordinator's definitions, `task-header.md`, `run-folder.md`, `references/stages/README.md`, `pricing.md`'s words and the stop |
| WU-115 | Design docs: `D1-build.md`, `D1-tree.md`, `D1-finish.md`, `D1-gate.md`, `checkpoints.md` (the design gate and revise paths only), `gates.md`, `D2.md`, `W1.md` and the guide and audit templates, `patterns.md` (within its cap) |
| WU-116 | The live test: the fixed roll (Gemling Legionnaire, Twister, Frost Wall by Cast on Critical), the user's, with the coordinator; it also closes WU-109 |

Order: WU-110, WU-111, WU-112 and WU-113 in parallel, the formats fixed by Appendix A; then WU-114 and WU-115
(they cite the built tool descriptions); then WU-116. `checkpoints.md` is split by section between WU-114 and WU-115
and merged by rebase. The coordinator writes the decision rows (§14) at integration. WU-115 writes D-441's targets
and band as one table in `D1-finish.md`, so a later study changes one place.

## 17. Acceptance criteria (M-24)

- **AC-P79 (WU-110).** Engine, on fixture builds:
  - a tree whose best gain is a 5-point path behind two 1-point weak branches: the swap search finds it (one branch
    at a time can't);
  - `rebuild: true` with `keep` holding the start's neighbour returns a full-tree change judged as one swap;
  - a swap that lowers the lowest max hit by more than 2% is refused by the guard;
  - `MainDamage` equals the clear group's five fields × Count, and × `CullMultiplier` only with `cull: true`;
  - compact mode prints the coverage line for an unmodelled need;
  - a call on the AC-P73 fixture takes at most twice its time before the change (NFR).
- **AC-P80 (WU-110).** The README table matches the new description; `tool-calls.json` holds `rebuild` and
  `MainDamage` samples.
- **AC-P81 (WU-111).** Plan and engine:
  - a schema-6 plan compiles unchanged; a schema-6 plan using `skills.cull` or `tree.scales` errs at its path;
  - a variant stage's record holds `measures.damage {map, boss}`, the boss figure measured with only `enemyIsBoss:
    "Pinnacle"` changed, and equal to a separate compile with that config;
  - with `skills.cull`, `measures.cull` holds both thresholds and the map figure carries the multiplier; without
    it, neither does;
  - a group with Cast on Critical gives `measures.trigger {by: "Cast on Critical", usesPerSecond}`;
  - the record holds the named source's PoB skill types (Spark: `Spell`, …; Boneshatter: `Melee`, …);
  - V1's `movement-tier` fires on budget boots with 30% and not with 35%, and on entering-maps boots with 25% and
    not with 30%.
- **AC-K72 (WU-112).** Fixture-backed: each of the four named items, and one item from every other exchange
  category the spike found, is priced from its poe.ninja exchange category with no trade-site request; a unique is
  still priced on the trade site; an exchange item poe.ninja doesn't list is `unavailable` with the category it
  tried. The spike's category list, and where it differs from the user's list, is in the work-log.
- **AC-W89 (WU-113).** Script unit, on fixture runs:
  - the verification display prints no damage, life, EHP, clear-speed or movement-speed figure, the status words
    "works" and "works, except …", the damage kinds and the pieces line;
  - a run with this amendment's dossier columns passes; an old composite run's twelve and an old assemble run's
    eleven still pass;
  - the brainstorm display has no `out:` line; the design pieces line counts out pieces without names;
  - the design display prints both figures, the cull line only with `skills.cull`, the trigger line, and each trade;
  - the non-budget rung's toughness line names its target; a design field with `band: "under"` and no defence
    trade fails;
  - a price that rounds to 0.0 prints as seen in exalts; no user-facing line says "exalted";
  - `priceOutcomes` on D1-build is accepted; a retry approved at a gate is recorded and read;
  - an old run with an RV entry still passes; a new run with an `x` card fails;
  - D1-build after a D1-finish that returned `build:` passes in an attempt that already ran D1-build;
  - `bestSwap.weaponSet: 3` fails; a probe on a scheduled row fails.
- **AC-W90 (WU-114).** Static: `R1b.md` states the three checks and the yes/no answers; the dossier template has the
  new columns; `checkpoints.md`'s verification gate shows no figures and says where numbers come; names carry the
  main skill and ascendancy; RV.md is gone and no doc runs a rival; `R1a.md` allows published guides with their
  citation; `pricing.md` states the stop until a gate's retry and players' currency words; `SKILL.md` stays within
  325 lines.
- **AC-W91 (WU-115).** Static: `D1-build.md` writes `tree.scales`, marks respec rungs and writes their `respec`,
  states `skills.cull` and the boots tier with its exceptions; `D1-tree.md` keeps only serving prior nodes on a
  respec rung, protects along grow links only, runs the rebuild pass and measures unmodelled needs' cost;
  `D1-finish.md` measures the defence trades under the floor; `D1-gate.md`'s design field holds `damage`, `cull`,
  `trigger` and `trades`; `checkpoints.md`'s design gate shows them; `patterns.md` stays within 13,000 words.
- **AC-W92 (WU-116).** The live test: the user's judgment of the fixed-roll run, recorded in the work-log; it also
  completes AC-W88.

## 18. Risks

- **The rebuild pass can wander:** a greedy refill from the kept core may lose a structure the swap loop kept. It
  is judged like any swap, needs stay kept, and D1-tree takes it only when it wins.
- **"Still serves" at 1%** may drop a node whose value shows only with later gear. A need keeps anything the design
  knows it needs; the gate shows the respec's dropped nodes.
- **No numbers at verification** means a weak card reaches the design. The user chose that; the design's attempt
  limit and the gate's trades bound the cost.
- **The boss figure doubles the compile's calcs** on variant stages (no recompile, one config change and a calc).
- **Two toughness targets from 30 builds** is a small sample of league starters only (two minion builds, no
  totems), and PoB's EHP swings with the defence type (evasion and deflection read high, armour low at
  non-budget's hits). The 10% band absorbs the spread near a target; a later study can split the ranged target.

## 19. Migration and compatibility

- **Old runs stay readable:** the checker and the displays accept the old dossier columns, figures (`measures.dps`),
  the rival's entries in a run that holds them, and the old pieces lines. A run is held to this amendment's rules
  when its log is created by the new `run-log.mjs` (a `skillRevision: 11` field it writes); old logs lack it.
- **Plans:** schema 7 adds two optional fields; a schema-6 plan compiles as before.
- **Records:** new `measures` fields; old records lack them, and the displays fall back to `measures.dps` with its
  old label.
- **Rollback:** each unit is its own commits on M-24's branch; nothing changes a user's builds.

## 20. Choices for the user

1. **The toughness targets (taken 2026-10-25):** melee 20,000 and ranged 15,000 at non-budget, with a 10% band; the
   trade shows under 90% of the target (§9).
2. **Pricing runes and the like (taken 2026-10-25):** every currency-exchange item from poe.ninja's exchange; the
   trade site for uniques, lineage support gems and rares (§12).
3. **Campaign stages and movement speed (taken 2026-10-25):** the highest tier for each stage's level (§8).

## Appendix A. Formats

### The dossier (a run with `skillRevision: 11`)

`| Card | Round | Status | Synergy | Damage | Pieces | Key prices | League | Main risk |`

- `Status`: `works`, `works, except <what>`, `failed after <N> attempts: …`, or `can't be finalized yet: …`.
- `Damage`: the named source and the kinds PoB shows for it, `Detonate Dead: hit, bleed, ignite (rated at its
  hand-cast speed)`; `—` for a failed card.
- `Pieces`: `4 of 4 do something`, or `3 of 4: Venopuncture does nothing in PoB; Beetlebite: PoB can't see it`;
  `—` for a plain card.
- `Key prices`: as today, a range that rounds to 0.0 written as seen, `about 1 exalt (seen 2026-10-24)`.

### Pieces measured (the card)

`| Piece | Left out by | Does something |`, the last cell `yes`, `no` or `PoB can't see it`; `in` rows only.

### The verification display, one card

```
2. Culling Bonfire Detonate Dead Infernalist (r2-g-1): works.
   Synergy: Reap's crits trigger Detonate Dead; its corpse blast bleeds and ignites; Deathblow culls.
   Damage: Detonate Dead: hit, bleed, ignite (rated at its hand-cast speed).
   Pieces: 4 of 4 do something.
   Bosses: <the card's Bosses line, as written>
   Key prices: Apron of Emiran about 1 exalt (seen 2026-10-24); …
   Risks: …
```
Under the cards: `Numbers come at the design gate, measured on the full build.`

### The design gate, one rung (the lines that change)

```
- Damage: 2,717,385 per second against map monsters; 222,149 against a Pinnacle boss.
- Culls normal monsters at 91%, bosses at 13%.
- Detonate Dead is triggered by Cast on Critical: PoB rates it at its hand-cast speed (1.46 a second) and doesn't model Energy.
- Effective HP: 6,759 (against T15 map hits, area 79: 439 physical).
- Passive tree: 56 of 118 points on travel; best swap left: +6.1% damage by moving 5 points from <nodes> to <nodes>
- Kept for Cast on Critical's Energy, which PoB can't measure: the same 6 points elsewhere would add 17% damage.
- Boots: Trampletoe, 25% movement speed (10% under the tier), for overkill damage hitting nearby enemies.
- Toughness: 6,759 against the 15,000 ranged target, under its band (13,500).
- Defence: a rare body with life and resistances and Crimson Assault: +17% EHP, −9% damage.
```
The pieces line, once per build: `- Pieces: 5 in, 1 scheduled (Seismic Cry), 2 out`.

### The D1 gate's design field (additions)

Per rung: `damage {map, boss}`, `cull {map, boss} | null`, `trigger {by, usesPerSecond} | null`, on the non-budget
rung `toughness {archetype: "melee" | "ranged", target, band: "under" | "within" | "over"}`, and `trades[]`,
each `{kind: "unmodelled" | "boots" | "defence", what, gain, cost}`, `gain` and `cost` short phrases with their
numbers. `pieces` loses `outNames`. `dps` stays for old readers.

### The plan (schema 7)

- `skills.cull`: optional text, the culling source and the button that uses it.
- `stages[].tree.scales`: optional text, the stats that scale the stage.

### `get_node_power` (additions)

- `stats` accepts `MainDamage`; `cull: boolean` (default false) multiplies it by `CullMultiplier`.
- `rebuild: boolean` (default false): the rebuild pass, in place of the swap search.
- The guards gain the lowest per-type maximum hit taken, at `TotalEHP`'s allowance.
