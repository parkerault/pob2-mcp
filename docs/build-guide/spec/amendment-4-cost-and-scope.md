# Amendment 4: cost and scope

**Status: ACCEPTED by the user, 2026-10-11, with answers** (`../worklog.md`, "Amendment 4: the user accepts all
proposals, with answers"). It carries out the user's decisions after run A, D-345…D-350, and issues I-1…I-3,
each restated where it applies. The coordinator's D-351…D-361 are accepted, with the answers in §1 applied;
D-362 is the user's own. The coordinator folds the memo into the spine and slices 01–03. Paths without a
directory are under `.claude/skills/build-guide/`.

**Evidence** (`../studies/2026-10-11-*`): *cost study 1* (`cost-1-mechanics`), *cost study 2*
(`cost-2-claims-and-rules`), *the issues report* (`run-a-issues`). Run A, WU-59's open-brief run (Pathfinder /
Explosive Concoction), cost 296.2M cache read and 1.78M recorded output, against an estimate of about 130M.

**Names.** D1 designs the endgame rungs (`m` entering maps, `b` budget, `n` non-budget); D2 the campaign; W1
writes `guide.md` and `audit.md`; V4 checks claims, today in three lenses (ledger, sources, prose); V1 is the
compiler's plan validity checks; the runner is the session running the skill; "the checker" is
`scripts/check-run.mjs`; "the record" is `compile-record.json`.

## 1. Answers

- **Q1** (D-359). No source has the socket thresholds. Jeweller's Orbs work on skill-granting items, not on
  tree-granted skills, whose counts are estimated: 3 supports in Act 2, rising to 5 by the campaign's end.
- **Q2** (D-353). Clear speed is rough: the skill's area, a bonus for on-death effects, a penalty for a long use
  time. Hits to kill normal monsters is dropped.
- **Q3** (D-357). A revision doesn't count against the 1M, for now.
- **Q4** (D-357). Output matters more; cache read is reported, and context kept minimal by a target.
- **Q5** (D-358). Anoints on `b` and `n`, none on `m`; `m` points players who can afford one ahead.
- **Q6** (D-361). Runs B and P2 are dropped.
- **New: D-362** (§13), a design gate on the endgame build.

## 2. D-351: claims only where the build hinges (D-345: verify only that; remove costly superfluous content)

- **A claim is written only for a hinge fact,** whose being wrong would make the build fail at its rung (run A's
  `m-trap-weapon`: a main-hand weapon switches the skill off), **or for a reason resting on a measurement**
  (`s6-ignite`: Ignite III over Elemental Armament II). `claims[].kind` is `hinge` or `reason` (plan
  `schemaVersion` 3).
- **What the compile proves carries no claim.** Requirements, gem availability, trial timing, resistance
  penalties and tree lists are build content that V1 checks; the guide renders them from the plan, the record or a
  data fact.
- **Superfluous content is removed, not verified:** kill times, campaign resistance maths, burn-gap and
  flask-second calculations, minor picks. "What PoB can't show" keeps only hinge caveats, each said once (one of
  D-350's cuts).
- **Expected count.** Run A's 133 claims were 29 hinge, 42 compile-proven, 27 reasons and 35 superfluous, and no
  compile-proven claim or reason was wrong (cost study 2 §1). This rule keeps at most 56.

## 3. D-352: one checker (D-350's cut: one checker, the ledger checked mechanically)

- **One V4 pass** checks every hinge claim against its source and reads `guide.md` as an editor against the plan
  and the record, replacing the three lenses (D-268, NFR-23).
- **The ledger's arithmetic is the checker's,** which already re-evaluates every formula (D-271,
  `check-run.mjs`:53); V4 checks only that a hinge claim's entry models what the claim says.
- **Narrow re-checks.** Before a fix round or a revision, the runner copies the plan, record and guide to
  `rounds/<n>/`. The checker's `--changed <n>` then lists the claims whose text, source or cited record values
  changed, and the changed guide H2s; V4 re-checks only those. This replaces the every-claim re-check after a
  recompile (D-264) and a revision's full pass (`03-pipeline.md`:699-706).
- **Reports kept.** Each pass writes `reports/V4-<n>.md` itself, never overwriting one (run A's round 2 did); the
  verifier gains Write to `reports/` only (amends D-231).
- **Estimates aren't the build.** A change to a ledger entry's formula or inputs, like a claim edit, needs no
  recompile and no gate. The checker re-evaluates the ledger (D-271), so it leaves the ledger out of the build's
  sha1 (`[record-plan]`). Only a change to the gear, tree, gems or config recompiles and re-runs the gates.
  - *This amends* `D1.md`:233-236 and `D2.md`'s matching rule.
  - *Evidence:* run A's first fix round recompiled for charge-limited estimates alone (budget boss DPS 1,774 →
    1,762, 0.7%). It re-ran both gates, D2 and W1, then all three lenses over every claim, about 45M (the user's
    account of run A's rounds, 2026-10-11).
- **Triage before fixing.** V4 marks each finding `hinge` or not.
  - A finding on a non-hinge statement is fixed by removing or narrowing the statement, never by new research or
    a recompile.
  - A difference under 5% in an estimate is no finding.
  - *Evidence:* of the first full pass's 19 findings, one touched what the build hinges on: "one throw ignites"
    against PoB's 42% and 71%. The rest were kill times (4), rounding and trivia (3), wording (5), repeated
    caveats (2), an offline price over-claim, campaign-reward credits and timings (3).
  - *Also seen:* the second full pass found two issues the first had missed. Attention spread over 133 claims
    misses things, which is the case for checking fewer.

## 4. D-353: the endgame measures, computed by the compiler (D-347: DPS, EHP, the Arbiter verdict, clear speed)

The record gains `measures` per endgame stage, so no agent computes or checks them:

- `dps`, the headline (the named source's Count-scaled figure, D-294), and `ehp`, `TotalEHP`;
- `arbiter` (`b`, `n`): for each damage type the Arbiter deals (`enemies/arbiter-of-divinity.json`), its largest
  hit's top roll over `<Type>MaximumHitTaken`: `survives` below 1, else `one-shot`. A mixed hit sums its parts'
  ratios;
- `clearSpeed`, labelled rough (Q2), assuming a normal monster dies to one use: by the clear skill's radius
  (`AreaOfEffectRadiusMetres`, 0 if absent), slow below 2 m, medium to 4 m, fast beyond; one step faster when its
  gem text explodes monsters or spreads an effect on death (a phrase list in the compiler); one step slower when a
  use takes over 1 second (`Speed` below 1, an estimate). No agent researches it. Run A's 1.8 m starts at slow.

**The survival label follows the Arbiter verdict** ("survives the Arbiter's hits", "one-shot by the Arbiter's
<hit>"). Run A's rungs read "solid" while the slam one-shot them (max hits 0.66 and 0.85 of it; cost study 2 §2).
The five waystone-scaled map hits (D-254) stay the D1 gate's floor.

**The ledger shrinks.** The compiler fills the reference hits from the data (D-254's formula, rounded up by
D-256) when the plan omits them, so 15 `hit_*` entries go; 4 Arbiter ratios become `measures`; 3 hits-to-kill and
12 kill-time entries go (amends D-116, D-119, D-132). What PoB can't compute stays, as estimates (D-296; run A:
`boss_dps_*`, `full_flask_seconds_b`).

## 5. D-354: the campaign (D-346: the effort goes to the endgame; D-348: no crafting)

- **Per act** (campaign stage), D2 plans and the guide states the tree path order, the support gem order, a rough
  upgrade order, the build-specific mods to target, and a target life from the record's `Life`. The loadouts stay
  in the PoB file; campaign claims are hinge claims only (run A had 5).
- **No resistances, max hits or EHP.** D2 stops picking gear for "a resistance it lacks" (`D2.md`:70-77), and the
  template's campaign survival rows go (`guide-template.md`:56-60).
- **No crafting** (D-348): the guide names mods to buy on trade; the item-base and mod-tier Greps (7M) and
  amendment 3's "bank the enabler" go.

## 6. D-355: the audit file and the dossier (D-350's cuts: the audit generated, the dossier reduced)

- **`audit.md` is rendered by a script,** `scripts/render-audit.mjs`, which the runner runs after the final
  compile (loading the server's modules, like the checker). It writes the stage table, the coverage flags, the
  inputs by confidence and the estimates (ledger entries, Count and custom modifiers, with reasons); no Run notes
  or hand-calculation prose. It also renders each endgame rung's Checks block (budget, Arbiter verdict, clear and
  movement speed), which W1 copies verbatim.
- **The dossier shrinks to the verification gate's comparison table** (amends D-200, D-269). D1, D2 and W1 read
  their card and its row, not run A's 7,681-word dossier.

## 7. D-356: mechanics (D-350: the long agents' paging and context growth)

1. **Narrow views.** `guide_run {view: {plan, stage}}` returns one stage's plan section and key figures;
   `{view: {plan, claims: true}}` every claim, compact (run A's: 48K characters against 226K paged); each stays
   under Read's 25K-token cut-off (`plan.json` is about 92K). `compile_plan`'s reply gains a key-figure line per
   stage, so agents stop Grepping the record.
2. **Per-step excerpts.** Stage references state the rules they need, not whole files or bare D-numbers (run A:
   88 reads, 5.0M, chasing D-numbers); `plan-reference.md`'s 11.6M falls to about 2.6M.
3. **Batching.** The agent definitions say to batch independent read-only calls (run A: 987 single-call turns).
4. **D1 splits:** `D1-build` takes the three rungs to a passing floor; `D1-finish` starts fresh, through the
   views, and adds the anoint, prices, ledger and claims. Run A's D1 carried 306K of context by turn 52. D2,
   shrunk by D-354, splits only if the lean run shows it past the peak-context target (D-357).
5. **A leaner runner:** V4 writes its own report, `scripts/run-log.mjs` appends the run log, a per-step card
   replaces `cat`ing references, and `SKILL.md` is halved.

## 8. D-357: the budgets (D-349: at most 1M output tokens a run)

**The counter comes first.** Transcripts under-record output (a 60K-character Write logs 8 tokens; run A's 1.78M
was really about 2.3–2.5M, cost study 1 §3). Spike WU-64 establishes a reliable per-run counter, with each agent's
peak context, before any budget AC relies on one.

**For a run like run A without faults** (Q4: output first):

- **Output at most 1M** (D-349), the one gate; a final-gate revision is reported beside it, not counted (Q3).
  Cost study 1's cuts reach about 0.97M with one pass of each step (V4 291K → 90K, D1 −80K, W1 210K → 120K,
  research 614K → 400K, D2 160K → 90K): a thin margin.
- **Peak context per agent: a design target of 150K,** reported, not a gate. An agent's context sum grows with
  the square of its turns; cost study 1 priced the D1 and D2 splits by restarting at 100–150K (saving 17–23M), and
  the range's top spreads that saving without more splits. Lower isn't realistic yet: run A's D1 hit 152K on its
  opening reads. A step past it is the next to split.
- **Cache read, reported:** about 140–180M expected: run A's 296M less the levers' 100–130M, 7M for crafting, and
  some 10–20M (coordinator's estimate) for one checker over at most 56 claims, before the unpriced cuts.

**Over budget,** the knobs left, both the user's call, are thinking effort (63% of output) and a smaller model
for gates and bookkeeping (cost study 1 §4 (g); D-275 fixes Opus).

## 9. D-358: amulet anoints (I-1)

- **`items.anoint {notable, reason}`** on `b` and `n`, none on `m` (Q5). The compiler writes `{enchant}Allocates
  <notable>` on the amulet, which PoB grants with no path or point (`CalcSetup.lua:17-21, 1405-1414`), and the
  record gives its recipe of three Distilled Emotions. `compile_check` refuses a notable without a recipe (875
  have one), one already allocated, or a stage without an amulet.
- **D1-finish considers one notable** that is valuable but off the tree or costly to path, measures it with a
  measure-only compile, and records why. In run A, Firestarter, Slow Burn and Total Incineration qualify.
- **The guide** names the anoint and its recipe on `b` and `n`, priced like a slot; on `m`, a line tells a player
  who can afford one before maps to look ahead to the budget anoint.

## 10. D-359: support sockets on granted skills (I-2)

No source has the thresholds (Q1), and PoB2 has no rule (`CalcSetup.lua:247-256, 1531-1541`).

- **Item-granted skills:** Jeweller's Orbs can add sockets on the item, so their supports follow its sockets.
- **Tree-granted skills:** no Jeweller's Orbs. The count follows character level by an **estimated** table, a
  `judgment` fact (confidence L) in `data/campaign/gems.json`, with area levels from `data/campaign/areas.json`:
  - **3 below level 40:** Act 2 (16–31) into Act 3;
  - **4 from level 40,** where run A's plan gave the concoction its fourth support: Act 3's second half (to 45),
    Act 4 and the interludes;
  - **5 from level 60:** the campaign's end (the interludes start at 54–56 and rise about 8).
- **V1 gains `support-sockets`:** a tree-granted group over the estimated ceiling at the stage's level. The guide
  says once that the thresholds are estimates, and never saves Jeweller's Orbs for a tree-granted skill as run A's
  `guide.md:94` did.

## 11. D-360: tree validity (I-3)

**The rule.** Take a stage's main-tree nodes, with class starts not joining their exits. The stage passes when:

1. each tree (connected component) holds exactly one start exit: a node linked to the class start, or a main-tree
   link of an allocated alternate-start node (Path of the Sorceress, 12795, links exits 4739 and 44871);
2. each start holds at most one tree;
3. an alternate start holds a tree only while its granting node is allocated;
4. the ascendancy nodes form one tree with their own start, over ascendancy links.

So a build has at most two trees with Path of the Sorceress, and one without.

- **V1 code `tree-shape`,** computed in `pob-api/API/Compile.lua`'s `check_tree` (:182-285), which today tests
  only reachability. It names the stage, the start and each tree's nodes. `D1.md:112` states the rule.
- **`find_path_to_node` and `get_nearby_nodes`** (`src/services/treeService.ts:292-413`) never path through an
  unallocated start, and leave a start only while it holds no tree. Tools that follow PoB's own paths
  (`update_tree_delta`, `get_passive_upgrades`) are caught at compile.

Run A had four trees from stage 6. PoB2 v0.23.1 doesn't enforce the rule (the user reports its UI does; a newer
release may differ); it holds either way.

## 12. D-361: WU-59 re-scoped; the lean run

- **Runs B and P2 are dropped** (Q6). P1 and run A stand as WU-59's record. Withdrawn: AC-W45 (run B's failure
  routes), AC-W46 (P2, a non-skill damage source), and the run-B clauses of AC-W37 and AC-W49. AC-W37 (each gate
  prints its display) gets its evidence from the lean run.
- **Milestones.** M-14's exit is WU-59 as recorded. New **M-15, the lean pipeline offline:** WU-64…WU-72, exit
  the lean run's record. M-13, the live alpha, follows it.
- **The lean run** (WU-72): run A's brief and answers (`first-n:2`, `first-viable`; `accept` at the design gate,
  D-362; a claims-only `revise:` and `accept` at the final gate), offline, with no injected faults, so run A minus
  its faults (3.6M) is the baseline. The revision exercises the narrow re-check.

## 13. D-362: the design gate (the user's decision)

- **Placement:** a fourth user gate, after D1 and the D1 gate (the endgame build passes its floor) and before D2,
  W1 and V4: the user judges the endgame build before the leveling loadouts and the guide exist.
- **Display,** printed whoever answers it (the gate-display rule, D-265 (b)): each rung's measures (DPS, EHP, the
  Arbiter verdict, clear speed), the anoint, the key gear, gems and tree in brief, and the open estimates.
- **Answers:**
  - `accept`: on to D2 and the guide;
  - `revise:<text>`: a D1 fix round with the text (`D1-build` for a build change, `D1-finish` otherwise), the D1
    gate, then this gate again;
  - `verification`: back to the verification gate, to finalize another card;
  - `stop`.
- **Plumbing:** checkpoint `design` in the run log; `answers.design[]` in the test config; when the answers run
  out, `stop`, with the rule recorded. It goes in `SKILL.md` and `references/` (`checkpoints.md`, `run-log.md`,
  `offline-and-test.md`) in WU-70, and in the checker, fixtures and static tests in WU-71.
- The final gate's `revise:` stays for guide-level changes.

## 14. What is superseded or changed

| Where | Change |
|---|---|
| C-30, D-276, D-279: a claim per stated fact | Hinge facts and measured reasons only (D-351) |
| D-179, D-231, D-264, D-268, NFR-23's three lenses | One pass, narrow re-checks, kept reports (D-352) |
| `D1.md`:233-236, `D2.md`: a ledger change recompiles; `[record-plan]`'s sha1 | Ledger edits need no compile; triage (D-352) |
| D-116, D-119, D-132, D-254, D-294: kill times, hand-computed hits, the verdict line | Record `measures`, the survival label (D-353) |
| `D2.md`:70-77, `guide-template.md`:56-60; amendment 3's "bank the enabler" | No campaign defences or crafting (D-354) |
| D-278, AC-W2 (z), W1's `audit.md`; D-200, D-269, the dossier | A rendered audit; the comparison table (D-355) |
| D-273 (2), `compile_plan`'s reply; D-270, the run log | Key-figure lines; D1's two steps; a scripted log (D-356) |
| C-31, plan schema 2 | Schema 3: `claims[].kind`, `items.anoint` (D-351, D-358) |
| `check_tree`, `D1.md:112` | `tree-shape` (D-360) |
| WU-59; AC-W37, W45, W46, W49; M-14 | Runs B and P2 dropped; M-15 (D-361) |
| D-287's three gates; D-270's checkpoint names | A fourth gate, `design`, between D1 and D2 (D-362) |

## 15. Work units

| Unit | Slice | What | Depends on | Risk |
|---|---|---|---|---|
| WU-64 | 03 | Spike: the per-run output counter (report and script) | — | medium: no ground truth |
| WU-65 | 02 | Schema 3, the anoint, `measures`, reference hits, key-figure lines, `plan-reference.md` | — | medium |
| WU-66 | 02, 01 | `tree-shape`; the path tools | WU-65 (`Compile.lua`, `v1.ts`) | medium |
| WU-67 | 02 | `support-sockets` and its estimated table | WU-66 (`v1.ts`) | low |
| WU-68 | 02 | `guide_run`'s views; README tool table | WU-65 | low |
| WU-69 | 03 | V4: one pass, narrow re-checks, triage, kept reports; `SKILL.md`'s verification | WU-68 | medium |
| WU-70 | 03 | D1 split, the design gate, D2 and W1 scope, templates, dossier, excerpts, batching, runner card | WU-65, WU-69 | high: the largest text change |
| WU-71 | 03 | The checker and scripts: `--changed`, the audit and run-log scripts, `design`, new checks, fixtures | WU-70 | medium |
| WU-72 | 03 | The lean recorded run | WU-64…WU-71 | high: the budgets may miss |

```
WU-64 ───────────────────────────────────────────────┐
WU-65 ─┬─ WU-66 ── WU-67 ─────────────────────────────┤
       └─ WU-68 ── WU-69 ── WU-70 ── WU-71 ───────────┴── WU-72
```

WU-66 and WU-68 run in parallel after WU-65. WU-69…WU-71 run in series: they share `SKILL.md`,
`check-run.mjs` and the pipeline tests.

**Acceptance criteria:**

- **AC-W51 (WU-64, D-357).** `docs/build-guide/spikes/WU-64-output-counter.md` names the counter and its method,
  runs it on run A and on a control with known output, agrees with complete usage records within 7% (cost study
  1's estimate error) or says why not, and decides whether it can back a budget AC. It also reports each agent's
  peak context.
- **AC-P60 (WU-65, D-351, D-358).** Unit. `validatePlan` accepts `schemaVersion` 3 with `claims[].kind` and an
  `items.anoint` on `b` and `n`, refuses one on `m` or a campaign stage, and still accepts version 2.
- **AC-P61 (WU-65, D-358).** Engine. A recipe notable's anoint compiles, its stats move, and the record gives its
  three emotions; a notable without a recipe, an allocated one, or no amulet gives `isError` naming the stage.
- **AC-P62 (WU-65, D-353).** Engine. `measures.arbiter` has a row per damage type and mixed hit (hit, max hit,
  ratio, verdict); a fixture whose physical max hit is below the slam reads `one-shot`.
- **AC-P63 (WU-65, D-353).** Engine. `dps` and `ehp` equal the headline and `TotalEHP`; `clearSpeed` follows
  D-353 on a fixture per band and per step; a plan without reference hits gets D-256's whole numbers.
- **AC-P64 (WU-65, D-356).** Engine. `compile_plan`'s reply has a key-figure line per stage.
- **AC-P65 (WU-66, D-360).** Engine, on run A's shapes: two trees off one Ranger start, a Sorceress tree without
  12795, and an ascendancy node cut off from 1583 each give `tree-shape`; a class tree plus a Sorceress tree with
  12795 passes.
- **AC-K66 (WU-66, D-360).** Engine. Neither `find_path_to_node` nor `get_nearby_nodes` returns a path that opens
  a second tree on a start, crosses an unallocated start, or reaches the Sorceress exits without 12795.
- **AC-P66 (WU-67, D-359).** Unit. With the estimated table in `gems.json`, `support-sockets` flags a
  tree-granted group over the ceiling at levels 39, 40 and 60 (one more support than allowed), never an
  item-granted group or a gem's group.
- **AC-P67 (WU-68, D-356).** Engine. On the fifteen-stage fixture, the views return one stage's section with its
  key figures, and every claim compact, each under 25K tokens.
- **AC-W52 (WU-69, D-352).** Static. `V4.md` and the verifier define one pass with no lenses, the re-check over
  `--changed`'s set, and `reports/V4-<n>.md`; a revision runs no full pass.
- **AC-W53 (WU-70, D-351, D-354…D-356, D-358, D-359).** Static. Stage references carry excerpts, not whole files
  or bare D-numbers; agent definitions batch calls; D1 is two steps. The templates have D-354's campaign items
  without defences, the anoint lines, the survival label and Checks block, no crafting, no Jeweller's Orbs for a
  tree-granted skill, and the socket estimate once; the dossier template is the table.
- **AC-W54 (WU-71, D-352).** Checker unit. After a claims-only edit and after a recompile moving one stage,
  `--changed` lists exactly the changed claims and H2s; a re-check missing one, or an overwritten report, fails.
- **AC-W59 (WU-69…WU-71, D-352).**
  - *Static:* `D1.md` and `D2.md` recompile only for gear, tree, gems or config, and `V4.md` defines the triage.
  - *Checker unit:* a ledger-only edit after the final compile passes `[record-plan]`, and a gear edit still
    fails it.
- **AC-W60 (WU-70, WU-71, D-362).**
  - *Static:* `SKILL.md` and `checkpoints.md` place the gate between the D1 gate and D2, with its display, four
    answers and default `stop`; `offline-and-test.md` documents `answers.design[]`.
  - *Checker unit:* reaching D2 without a `design` visit fails; these pass: `revise:`, then D1, the D1 gate and a
    second visit; `verification`, then the verification gate; answers run out, then `stopped`.
- **AC-W55 (WU-71, D-351, D-353, D-355).** Checker unit. A claim without a `kind`, an `audit.md` or Checks block
  differing from the script's render (Known issues aside), and a label disagreeing with `measures.arbiter` each
  fail.
- **AC-W56 (WU-72, D-361, D-362).** The lean run ends `completed`, the checker exits 0, and every gate visit,
  the design gate's included, prints its display (AC-W37).
- **AC-W57 (WU-72, D-349, D-357).** By WU-64's counter, output before the final-gate revision is at most 1M (a
  miss goes to the user); each agent's peak context (against 150K) and cache read per step are reported.
- **AC-W58 (WU-72, D-351…D-360).** At most 56 claims, each with a kind; `b` and `n` carry the measures, a
  matching label and an anoint, and `m` no anoint; no kill time, hits to kill or campaign defences; every stage
  passes `tree-shape`; every V4 report is kept.
