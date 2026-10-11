# Amendment 4: cost and scope

**Status: PROPOSED, 2026-10-11, for the user's approval.** The user's decisions after run A (`../worklog.md`,
"2026-10-11: the user's direction on cost and scope"), D-345…D-350 and issues I-1…I-3, are binding; each section
below restates the one it carries out. D-351…D-361 are the coordinator's proposals, and the user may override any
of them. At approval the coordinator folds the memo into the spine and slices 01–03. Paths without a directory
are under `.claude/skills/build-guide/`.

**Evidence** (`../studies/2026-10-11-*`): *cost study 1* (`cost-1-mechanics`), *cost study 2*
(`cost-2-claims-and-rules`), *the issues report* (`run-a-issues`). Run A, WU-59's open-brief run (Pathfinder /
Explosive Concoction), cost 296.2M cache read and 1.78M recorded output, against an estimate of about 130M.

**Names.** D1 designs the endgame rungs (`m` entering maps, `b` budget, `n` non-budget); D2 the campaign; W1
writes `guide.md` and `audit.md`; V4 checks claims, today in three lenses (ledger, sources, prose); V1 is the
compiler's plan validity checks; the runner is the session running the skill; "the checker" is
`scripts/check-run.mjs`; "the record" is `compile-record.json`.

## 1. Open questions

- **Q1, the support-socket thresholds for granted skills** (D-359): by character level for a tree-granted skill,
  by item level for an item-granted one. PoB2 and our data have none. *Needed:* the tables and their source.
  *Until then:* WU-67 waits, and the guide never sends Jeweller's Orbs to a granted skill.
- **Q2, the clear-speed rule** (D-353). *Recommended:* from hits to kill, 1 is fast, 2–3 medium, 4 or more
  slow; one step slower when the clear skill has no area (no `AreaOfEffectRadiusMetres`). Run A's rungs (5 and 3
  throws, 1.8 m area) would read slow and medium.
- **Q3, does a final-gate revision count against the 1M?** *Recommended:* no. The budget covers the run to the
  final gate's first answer, and each revision is reported beside it; cost study 1's estimate assumes one pass.
- **Q4, the cache-read target** (D-357). *Recommended:* 150M, reported, not a gate; a miss goes to the user with
  the cost per step.
- **Q5, which rungs carry an anoint** (D-358). *Recommended:* `b` and `n` carry one or say why not; `m` may.
- **Q6, dropping runs B and P2** (D-361). *Recommended:* yes, with no replacement: this amendment doesn't change
  the failure routes.

## 2. D-351: claims only where the build hinges (D-345: verify only that; remove costly superfluous content)

- **A claim is written for one of two things:**
  - **a hinge fact,** whose being wrong would make the build fail at its rung: run A's `m-trap-weapon` (a
    main-hand weapon switches the skill off);
  - **a reason resting on a measurement:** `s6-ignite` (Ignite III over Elemental Armament II).
- **What the compile proves carries no claim.** Requirements, gem availability, trial timing, resistance
  penalties and tree lists are build content that V1 checks, and the record is their proof. The guide renders
  them from the plan, the record or a data fact (narrowing D-276's "no fact of its own").
- **Superfluous content is removed, not verified:** kill times, campaign resistance maths, burn-gap and
  flask-second calculations, minor picks.
- **`claims[].kind`** is `hinge` or `reason` (plan `schemaVersion` 3).
- **Caveats once** (one of D-350's cuts): "What PoB can't show" keeps only hinge caveats, each said once.
- **Expected count.** Run A had 133 claims: 29 hinge, 42 compile-proven, 27 reasons, 35 superfluous (cost study 2
  §1). This rule keeps the 29 plus the measured reasons, at most 56. None of the compile-proven claims or reasons
  was found wrong.

## 3. D-352: one checker (D-350's cut: one checker, the ledger checked mechanically)

- **One V4 pass** checks every hinge claim against its source, and reads `guide.md`, reasons included, as an
  editor against the plan and the record. It replaces the three lenses (D-268, NFR-23).
- **The ledger's arithmetic is the checker's,** which already re-evaluates every formula (D-271,
  `check-run.mjs`:53). V4 checks only that a hinge claim's ledger entry models what the claim says.
- **Narrow re-checks.** Before a fix round or a revision, the runner copies the plan, the record and the guide to
  `rounds/<n>/`. Afterwards the checker's `--changed <n>` lists the claims whose text, source or cited record
  values changed, and the guide H2s that changed; V4 re-checks only those. This replaces the re-check of every
  claim after a recompile (D-264) and a revision's full pass (`03-pipeline.md`:699-706).
- **Reports kept.** Each pass writes `reports/V4-<n>.md` itself, never overwriting one (run A's round 2 did).
  The verifier gains Write, limited to `reports/` (amends D-231).

## 4. D-353: the endgame measures, computed by the compiler (D-347: DPS, EHP, the Arbiter verdict, clear speed)

The record gains `measures` per endgame stage, so no agent computes or checks them:

- `dps`: the headline, the named source's Count-scaled figure (D-294); `ehp`: `TotalEHP`;
- `arbiter` (`b`, `n`): for each damage type the Arbiter deals (`enemies/arbiter-of-divinity.json`), its largest
  hit's top roll over `<Type>MaximumHitTaken`, and `survives` (below 1) or `one-shot`. A mixed hit sums its
  parts' ratios;
- `hitsToKill`: a normal T15 monster's life (`enemies/map-monsters.json#life.by-level[79]` times the top of
  `enemies/waystones.json#mods.more-monster-life`) over the clear skill's `AverageDamage`, rounded up;
- `clearSpeed`: `fast`, `medium` or `slow`, by Q2's rule.

**The survival label follows the Arbiter verdict:** "survives the Arbiter's hits" or "one-shot by the Arbiter's
<hit>". Run A's rungs read "solid" while the slam one-shot them (max hits 0.66 and 0.85 of it; cost study 2 §2).
The map floor, five waystone-scaled reference hits (D-254), stays the D1 gate's.

**The ledger shrinks.** The compiler fills the reference hits from the data (D-254's formula, rounded up to
whole numbers by D-256) when the plan omits them, so 15 `hit_*` entries go; 4 Arbiter ratios and 3 hits-to-kill
entries become `measures`; the 12 kill-time entries go (amends D-116, D-119). It keeps what PoB can't compute
(run A: `boss_dps_*`, `full_flask_seconds_b`), as estimates (D-296).

## 5. D-354: the campaign (D-346: the effort goes to the endgame; D-348: no crafting)

- **Per act** (campaign stage), D2 plans and the guide states: the tree path order, the support gem order, a rough
  upgrade order, the build-specific mods to target, and a target life from the record's `Life`.
- **No resistances, max hits or EHP.** D2 stops picking gear for "a resistance it lacks" (`D2.md`:70-77), and the
  template's campaign survival rows go (`guide-template.md`:56-60). V1's `resistance-penalty` check stays.
- **Campaign claims are hinge claims only** (run A had 5). The loadouts stay in the PoB file.
- **No crafting** (D-348). The guide names mods to buy on trade. D1 and D2 drop the item-base and mod-tier Greps
  (7M, cost study 1 §4), and amendment 3's "bank the enabler" for a craft goes.

## 6. D-355: the audit file and the dossier (D-350's cuts: the audit generated, the dossier reduced)

- **`audit.md` is rendered by a script,** `scripts/render-audit.mjs`, run by the runner after the final compile
  and loading the server's modules like the checker (D-271). It writes the stage table, the coverage flags, the
  inputs by confidence and the estimates (each remaining ledger entry, Count and custom modifier, with its
  reason): no Run notes, no hand-calculation prose. The runner fills Known issues as today.
- **The script also renders each endgame rung's Checks block** (budget, Arbiter verdict, hits to kill, clear and
  movement speed), which W1 copies verbatim.
- **The dossier shrinks to the verification gate's comparison table** (amends D-200, D-269). The cards keep the
  detail; D1, D2 and W1 read their card and its row, not run A's 7,681-word dossier.

## 7. D-356: mechanics (D-350: the long agents' paging and context growth)

1. **Narrow views.** `guide_run {view: {plan, stage}}` returns one stage's plan section and key record figures;
   `{view: {plan, claims: true}}` every claim, compact (run A's: 48K characters, against 226K paged). Each stays
   under Read's 25K-token cut-off; `plan.json` is about 92K tokens. `compile_plan`'s reply gains a line per stage
   (level, headline, `TotalEHP`, `Life`, V1 and V2 results, measures), so agents stop Grepping the record.
2. **Per-step excerpts.** Each stage reference states the rules it needs, not whole files or bare D-numbers (run
   A: 88 reads, 5.0M, chasing D-numbers). `plan-reference.md`'s 11.6M falls to about 2.6M.
3. **Batching.** The agent definitions say to batch independent read-only calls (run A: 987 single-call turns).
4. **D1 splits:** `D1-build` takes the three rungs to a passing floor; `D1-finish` starts fresh, through the
   views, and adds the anoint, prices, ledger and claims. Run A's D1 carried 306K of context by turn 52. D2,
   shrunk by D-354, splits only if the lean run shows its context past 150K (cost study 1's restart point).
5. **A leaner runner:** V4 writes its own report, `scripts/run-log.mjs` appends the run log, a per-step card
   replaces `cat`ing references, and `SKILL.md` is halved.

**Saving,** with D-352's narrow re-checks (about 41M): 100–130M, the levers overlapping (cost study 1 §4).

## 8. D-357: the budgets (D-349: at most 1M output tokens a run)

**The counter comes first.** The transcripts under-record output (a 60K-character Write logs 8 tokens): run A's
recorded 1.78M was really about 2.3–2.5M (cost study 1 §3). Spike WU-64 establishes a reliable per-run counter
before any budget AC relies on one.

**Targets,** for a run shaped like run A without faults:

- **Output at most 1M** (D-349). Cost study 1's cuts reach about 0.97M with one pass of each step: V4 291K → 90K,
  D1 −80K (it writes the plan once, then edits), W1 210K → 120K, research 614K → 400K, D2 160K → 90K. The margin
  is thin.
- **Cache read at most 150M,** half of run A: 296M, less the levers' 100–130M, less 7M for crafting, less some
  10–20M (coordinator's estimate) for one checker over at most 56 claims in place of a three-lens pass of about
  30M, gives about 140–180M before the dossier, campaign and audit cuts, which the studies don't price.

**Over budget,** the knobs left are per-step thinking effort (63% of output) and a smaller model for the gates,
assembly and bookkeeping (cost study 1 §4 (g)): the user's decision, since D-275 fixes Opus.

## 9. D-358: amulet anoints (I-1)

- **The plan gains `items.anoint {notable, reason}`** on endgame stages. The compiler writes `{enchant}Allocates
  <notable>` on the amulet, which PoB grants with no path or point (`CalcSetup.lua:17-21, 1405-1414`). The record
  lists the notable and its recipe of three Distilled Emotions. `compile_check` refuses a notable without a recipe
  (875 have one), one already allocated, or a stage without an amulet.
- **D1-finish considers one notable** that is valuable but off the tree or costly to path, measures it with a
  measure-only compile, and records the reason. In run A, Firestarter, Slow Burn and Total Incineration qualify.
- **The guide's endgame rung names the anoint and its recipe;** it is priced like a slot. No new tool.

## 10. D-359: support sockets on granted skills (I-2)

- **The rule** (the user): a granted skill's support sockets follow a level table, by character level when the
  tree grants it and by item level when an item does. PoB2 has no such rule (`CalcSetup.lua:247-256,
  1531-1541`), so the table needs the user's source (Q1).
- **The table** becomes a cited fact in `data/campaign/gems.json`, and **V1 gains `support-sockets`:** a granted
  skill's group holds more supports than the table allows at the stage's level, or the granting item's.
- **No Jeweller's Orbs for a granted skill** in D1, D2 or the guide template. Run A's `guide.md:94` saves them for
  "the concoction's third and fourth support sockets", wrong under the rule.

## 11. D-360: tree validity (I-3)

**The rule.** Take a stage's main-tree nodes, with class starts not joining their exits. The stage passes when:

1. each tree (connected component) holds exactly one start exit: a node linked to the class start, or a main-tree
   link of an allocated alternate-start node (Path of the Sorceress, 12795, links exits 4739 and 44871);
2. each start holds at most one tree;
3. an alternate start holds a tree only while its granting node is allocated;
4. the ascendancy nodes form one tree with their own start, over ascendancy links.

So a build has at most two trees with Path of the Sorceress, and one without.

**Enforcement.**

- **V1 code `tree-shape`,** computed in `pob-api/API/Compile.lua`'s `check_tree` (:182-285), which today tests
  only reachability. It names the stage, the start and each tree's nodes. `D1.md:112` states the rule.
- **`find_path_to_node` and `get_nearby_nodes`** (`src/services/treeService.ts:292-413`) never path through an
  unallocated start, and start a path from a start only while it holds no tree. `update_tree_delta` and
  `get_passive_upgrades` follow PoB's paths; the compile catches what they let through.

Run A had two Ranger trees from stage 2 and four from stage 6. PoB2 v0.23.1 enforces the rule neither in its UI
nor on import (the user reports its UI blocks it, so a newer release may differ); the rule holds either way.

## 12. D-361: WU-59 re-scoped; the lean run

- **Runs B and P2 are dropped.** P1 (passed) and run A stand as WU-59's record. Withdrawn: AC-W45 (run B's
  failure routes), AC-W46 (P2, a card whose damage source isn't a skill), and the run-B clauses of AC-W37 and
  AC-W49. AC-W37 (each gate prints its display; run A failed it, fixed at `96b1785`) gets its evidence from the
  lean run.
- **Milestones.** M-14's exit is WU-59 as recorded. New **M-15, the lean pipeline offline:** WU-64…WU-72, exit
  the lean run's record. M-13, the live alpha, follows it.
- **The lean run** (WU-72): run A's brief and answers (`first-n:2`, `first-viable`, a claims-only `revise:`,
  `accept`), offline, with no injected faults, so run A minus its faults (3.6M) is the baseline. The revision
  exercises the narrow re-check.

## 13. What is superseded or changed

| Where | Change |
|---|---|
| C-30, D-276, D-279: a claim per stated fact | Hinge facts and measured reasons only (D-351) |
| D-179, D-231, D-264, D-268, NFR-23's three lenses | One pass, narrow re-checks, kept reports (D-352) |
| D-116, D-119, D-132, D-254, D-294: kill times, hand-computed hits, the verdict line | Record `measures`, the survival label (D-353) |
| `D2.md`:70-77, `guide-template.md`:56-60; amendment 3's "bank the enabler" | No campaign defences; no crafting (D-354) |
| D-278, AC-W2 (z): W1 writes `audit.md`; D-200, D-269: the dossier | Script-rendered audit; the comparison table (D-355) |
| D-273 (2), `compile_plan`'s reply; D-270, the run log | Key-figure lines; `D1-build`, `D1-finish`; a scripted log (D-356) |
| C-31, plan schema 2 | Schema 3: `claims[].kind`, `items.anoint` (D-351, D-358) |
| `check_tree`, `D1.md:112` | `tree-shape` (D-360) |
| WU-59; AC-W37, W45, W46, W49; M-14 | Runs B and P2 dropped; M-15 (D-361) |

## 14. Work units

| Unit | Slice | What | Depends on | Risk |
|---|---|---|---|---|
| WU-64 | 03 | Spike: the per-run output counter, a report and a script | — | medium: no ground truth yet |
| WU-65 | 02 | Plan schema 3, the anoint, `measures`, reference hits, key-figure lines, `plan-reference.md` | — | medium |
| WU-66 | 02, 01 | `tree-shape`; the path tools | WU-65 (`Compile.lua`, `v1.ts`) | medium |
| WU-67 | 02 | `support-sockets` and its table | Q1; WU-66 (`v1.ts`) | low, once the table exists |
| WU-68 | 02 | `guide_run`'s views; README tool table | WU-65 | low |
| WU-69 | 03 | V4: one pass, narrow re-checks, kept reports, Write; `SKILL.md`'s verification and revision | WU-68 | medium |
| WU-70 | 03 | D1 split, D2 and W1 scope, templates, dossier, excerpts, batching, runner card | WU-65, WU-69 | high: the largest text change |
| WU-71 | 03 | The checker and scripts: `--changed`, `render-audit.mjs`, `run-log.mjs`, new checks, fixtures | WU-70 | medium |
| WU-72 | 03 | The lean recorded run | WU-64…WU-71; WU-67 if Q1 is answered | high: the budgets may miss |

```
WU-64 ───────────────────────────────────────────────┐
WU-65 ─┬─ WU-66 ── WU-67 (after Q1) ···················┤
       └─ WU-68 ── WU-69 ── WU-70 ── WU-71 ───────────┴── WU-72
```

WU-66 and WU-68 run in parallel after WU-65. WU-69…WU-71 run in series: they share `SKILL.md`,
`check-run.mjs` and the pipeline tests.

**Acceptance criteria:**

- **AC-W51 (WU-64, D-357).** `docs/build-guide/spikes/WU-64-output-counter.md` names the counter and its method,
  runs it on run A's transcripts and on a control whose output is known independently, agrees with complete usage
  records within 7% (cost study 1's estimate error) or says why not, and decides: fit for a budget AC, or not.
- **AC-P60 (WU-65, D-351, D-358).** Unit. `validatePlan` accepts `schemaVersion` 3 with `claims[].kind` and an
  endgame `items.anoint`, refuses a campaign anoint, and still accepts version 2.
- **AC-P61 (WU-65, D-358).** Engine. A recipe notable's anoint compiles, its stats move, and the record lists its
  three emotions. A notable without a recipe, one allocated, and a stage without an amulet each give `isError`
  naming the stage.
- **AC-P62 (WU-65, D-353).** Engine. `measures.arbiter` on `b` and `n` has a row per damage type and mixed hit
  (hit, max hit, ratio, verdict); a fixture whose physical max hit is below the slam reads `one-shot`.
- **AC-P63 (WU-65, D-353).** Engine. `dps` and `ehp` equal the headline and `TotalEHP`; `hitsToKill` and
  `clearSpeed` follow D-353 and Q2; a plan without reference hits gets D-256's whole numbers.
- **AC-P64 (WU-65, D-356).** Engine. `compile_plan`'s reply has a key-figure line per stage.
- **AC-P65 (WU-66, D-360).** Engine, on run A's shapes: two trees off one Ranger start, a Sorceress tree without
  12795, and an ascendancy node cut off from 1583 each give `tree-shape`; one class tree plus one Sorceress tree
  with 12795 passes.
- **AC-K66 (WU-66, D-360).** Engine. Neither `find_path_to_node` nor `get_nearby_nodes` returns a path that opens
  a second tree on a start, crosses an unallocated start, or reaches the Sorceress exits without 12795.
- **AC-P66 (WU-67, D-359).** Unit. With the user's table cited, `support-sockets` flags a tree-granted group over
  the stage level's count and an item-granted group over its item level's, never a gem's group.
- **AC-P67 (WU-68, D-356).** Engine. On the fifteen-stage fixture, the views return one stage's section with its
  key figures, and every claim compact, each under 25K tokens.
- **AC-W52 (WU-69, D-352).** Static. `V4.md` and the verifier define one pass with no lenses, the re-check over
  `--changed`'s set, and `reports/V4-<n>.md`; a revision runs no full pass.
- **AC-W53 (WU-70, D-351, D-354…D-356, D-358, D-359).** Static. Stage references carry excerpts (no whole
  `plan-reference.md`, no bare D-number rule); agent definitions carry the batching rule; D1 is two steps. The
  templates have the five campaign items per act, no campaign defences, the anoint line, the survival label, the
  Checks block, no crafting and no Jeweller's Orbs for a granted skill; the dossier template is the table.
- **AC-W54 (WU-71, D-352).** Checker unit. After a claims-only edit, and after a recompile moving one stage,
  `--changed` lists exactly the changed claims and H2s. A re-check missing one fails; so does an overwritten
  report.
- **AC-W55 (WU-71, D-351, D-353, D-355).** Checker unit. A claim without a `kind`, an `audit.md` or Checks block
  differing from the script's render (Known issues aside), and a label disagreeing with `measures.arbiter` each
  fail.
- **AC-W56 (WU-72, D-361).** The lean run ends `completed`, the checker exits 0, and every gate visit prints its
  display (AC-W37).
- **AC-W57 (WU-72, D-349, D-357).** By WU-64's counter, output is at most 1M in Q3's scope (a miss goes to the
  user), and cache read is reported against 150M, per step beside run A.
- **AC-W58 (WU-72, D-351…D-360).** At most 56 claims, each with a kind; `b` and `n` carry the measures and a
  matching label; no kill time, and no campaign defences; every stage passes `tree-shape`; anoints follow Q5's
  answer; every V4 report is kept.
