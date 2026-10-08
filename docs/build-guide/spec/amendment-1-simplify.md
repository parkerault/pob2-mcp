# Amendment 1: a simpler guide pipeline

**Status: APPROVED by the user, 2026-10-08** (S1…S9; dropping workflows confirmed). The coordinator
settled the refinements and open questions as proposed below: S6's refinement (an attempt-1 fault re-runs
free, a persistent fault's attempts count), Q1 (one `Known issues` heading), Q2 (R1b keeps its 2 compile
retries), Q3 (the checker keeps recomputing the D1 gate, from the record), Q4 (a checkpoint-2 revision gets
one full pass, then the same fix-once and re-check) and Q5 (`priceOutcomes` on pricing steps). It amends the
spine (`README.md`) and slice 03 (`03-pipeline.md`); the full fold-in happens at finalization with
D-239…D-263. Evidence: the two recorded WU-47 runs (`../worklog.md:422-615`). "Runner" means the user's own Claude Code session following `SKILL.md`.

## 1. Summary

Most WU-47 failures came from rules about the run, not the guide: rounding between copies, run-log
stamps, counts and verbatim copies, retry accounting, stale claim counts, import codes passing through
workflow results, and a second orchestration path. Meanwhile, the verification loop could not converge.
In run A, all 9 findings raised in passes 2 and 3 were in text that pass 1 had read and passed
(`worklog.md:589-596`). The checks that caught real defects were V1/V2 (the compiler's plan checks), the
compile, the ledger re-derivation and the three V4 truth lenses. This amendment keeps those and drops the
rest. It uses one orchestration path (the runner calls agents directly), one verification pass with one
fix round (whatever stays open is printed in the guide), a slim run log, and a checker that checks
artifacts rather than self-reports. About 5,200 lines of scripts, references and tests go (§7).

## 2. The changes

| | Change | What it removes | Assurance lost | What replaces it, or why that's acceptable |
|---|---|---|---|---|
| S1 | **One orchestration path.** The runner calls agents with the Agent tool, by custom `subagent_type`, in parallel and in the background where §3 allows. Each agent writes its files and returns at most 8 lines | Both saved workflows (`.claude/workflows/build-guide-*.js`, 1,923 lines). The workflow harness and its tests. The run log's `orchestration` field. `references/fallback.md` (the Agent-tool fallback, D-172). The `revise-map` agent step, which existed only because a script can't judge a request; the runner now maps requests itself | (a) **Deterministic control flow in code**: caps, ids, routing and resumes were JavaScript, unit-tested with scripted agents (AC-W6…W10, W12, W13, W24, W25). (b) **Schema-validated returns**: each `agent()` call validated its return (12 return schemas, e.g. `build-guide-design.js:345-456`) | (a) Far fewer branches to follow: verification can't retry or escalate, the dossier fix is gone, and the three resume kinds reduce to gate escalations. The runner routes on the verdict files that gate steps write. The checker checks the result. WU-47 run B drives every failure route. Attempt 2's run B already passed every route of AC-W19 (the failure-route run) on this path (`worklog.md:583`). (b) The artifacts are the contract. The final compile validates the plan (D-163: schema errors by JSON path, nothing compiled), and the checker reads the verdict files and V4 reports by their fixed shape. A gain: the subagent transcripts record every agent's tool calls, which a workflow's `journal.jsonl` never did (`03-pipeline.md:659-661`) |
| S2 | **Verify once, fix once, report the rest.** One full pass of the three V4 lenses (`ledger`, `sources`, `prose`) over the plan and the guide, with no sampling. Then one fix round routed to the owners, and a re-check of only those findings and the claims the owners changed. Whatever is still open becomes a known issue in the guide and is shown at checkpoint 2. Verification never escalates | V3, the separate tag-coverage pass, and its agent. D-179's sampling (the sources lens re-checked only 1 in 5 non-endgame PoB-data claims). Repeated passes. Routed re-runs that spent an owner's 2 retries and escalated on a third round (§5.5). D-253 (W1 re-runs after the user accepts a V3/V4 escalation). The claim-coverage counts | D-179's "the guide passes only with no unresolved finding": a guide can now reach checkpoint 2 with open findings | Every claim is checked once, at a defined depth (S7's three claim rules), instead of sampled and re-run. Extra passes didn't converge: 12, then 3, then 6 findings. What stays open is stated in the guide and shown to the user, who can ask for a revision. V3's well-formed-tag check already exists in the checker (`check-run.mjs:400-484`). Its "every number and mechanic claim has a marker" check moves to the sources lens |
| S3 | **The dossier isn't verified after checkpoint 1** | The `dossier-fix` stage, its owner and its routing row. The dossier is dropped from V4's scope | Errors in the dossier's concept write-ups stay | The dossier serves the checkpoint-1 pick. The guide can't cite it, because C-30 (the source tag) has no dossier citation (`source-markers.md:9-27`), so the guide's truth doesn't rest on it. RC-2 (an unmarked dossier sentence) was a dossier-only defect |
| S4 | **A slim run log** (§4.1) | `startedAt`, `endedAt` and `timeline[]`, so the runner no longer needs `date`. Also `caps`, `agents`, `retries[]`, `rounds[]`, `concepts[]`, `v4Passes[]`, `orchestration`, the `pricing` calls and totals with D-261's recount (`unavailable` counted across every plan), and the per-checkpoint `shown`/`at` | Per-step times (D-158 promised "stage times"). NFR-23 (the cost caps: ≤ 3 concepts per round, 3 lenses, 2 retries, 3 agents in flight) and NFR-22 (no 429s or lock-outs while pricing) can no longer be read from log totals | Order and attempt numbers in `stages[]` give retries and concepts per round. Fan-out and timing are in the transcript. NFR-22 reads per-step price-outcome counts kept on `stages[]` (Q5) |
| S5 | **The checker checks artifacts** (§4.2) | The claim-count rules, the cap rules, the stamp rules, D-262 and D-255 (the `--partial` skip rules for stale counts and escalated runs), the report↔log cross-checks, and the D1 gate's copied numbers (`basis`), whose 2-decimal comparison caused F7, a false rolled-skill failure | Cross-checks of agents' self-reported counts. Those reports no longer exist | New checks: the plan is the one the final compile used; the PoB file equals the import code, with one loadout per stage; the ledger re-evaluates; every open finding is a known issue |
| S6 | **Injected faults never consume a retry** | RC-6. FI-2 used up one of D1's two retries, so a real failure had one left, and AC-W18's own clauses conflicted (`worklog.md:602-603`) | — | FI-1 (an unknown gem in a skeleton; the compile must fail), FI-2 (an endgame stage set to level 1; V1 must fail) and FI-3 (a forced `infeasible` D1 gate) stay, and so do FI-4 and FI-5 (a doubled ledger formula and an online-mode log, seeded on a copy of run A) for the seeded ledger check. **Refinement needed:** a *persistent* directive exists to exhaust a cap. Run B reaches its escalation only that way, and it would loop forever if it never counted. So: an attempt-1 fault's failed attempt re-runs free; a persistent fault's attempts count |
| S7 | **Keep four fixes from the attempt-2 analysis** (`worklog.md:597-615`) | Everything else on that list: B1 (verbatim escalation findings; escalations now cite the verdict file), B2 (a coordinator's scratch script), B4, B5 and P1-a (all about the fallback or the `orchestration` field), the D-261 grep note, and the FI-1 timing wording | — | (1) D1 sets `skills.main.statSet` to the stat set the rolled-skill gate compares, and the checker requires the rolled figure's stat set to equal it. This is RC-5: the PoB file opened on Blood Hunt's Dash set while the guide quoted the explosion figure. (2) `compile_plan` prints every V1/V2 finding (`src/handlers/planHandlers.ts:111,124-125` caps them at 10 per stage), which was B3. (3) Stage references name tools as `mcp__pob2__…`; run B made bare `guide_run` calls (B6). (4) Three general claim rules in `source-markers.md`: a claim is supported in every part, it cites each fact it rests on, and it carries its source's caveats (RC-2…RC-4) |
| S8 | **WU-47 rewritten for the slim shape** (§5) | The Workflow-path run and its ACs | — | Run B keeps the failure routes (no viable concept, FI-3 infeasible, a D1 gate escalation answered by the default `stop`) on the single path |
| S9 | **The M-12 re-run uses Opus**, the user's default model and the real run's model | The user's earlier Sonnet choice (`worklog.md:406-409`) | — | Cost at list prices, assuming attempt 2 ran Sonnet 5.5. Opus 5.5 is $4/$20 per million input/output tokens and Sonnet 5.5 is $2/$10; cache reads are $0.20 on both. Attempt 2's run A cost $19.86 (38.2M cache-read tokens, 417K output). With the same token profile it would cost about 1.6× on Opus, roughly $32. Cache reads are most of the spend, which is why the ratio stays below 2×. The slimmer pipeline runs fewer agents and passes, so it should cost less than attempt 2 |

## 3. The slim pipeline

**Standing rules.**
- The runner calls agents only with the Agent tool. Every call names one of four types: `build-guide-researcher`, `-coordinator`, `-writer` or `-verifier`. The provenance type goes.
- Every prompt is the task header (slice 03 §5.1) plus the stage reference's path.
- At most 3 agents are in flight at once, and a coordinator step never overlaps another agent (FR-W3: one engine, one coordinator).
- An agent writes only its header's `writes` and returns at most 8 lines: what it wrote and the outcome. The one exception is the verifier. It can't write (R-5: verifiers can't edit what they check), so it returns its report as JSON and the runner writes that file unchanged.
- The runner reads verdict files, its own log and the verifier returns. It never reads `plan.json`, the records, the dossier or the guide; one final record was 268 KB (`worklog.md:608`).
- The runner's only Bash command is the checker. It rewrites `run-log.json` after every step.

| # | Step | Agent type | Writes | Returns / user / retries |
|---|---|---|---|---|
| 1 | Start: parse the invocation, run the roll check (D-238: the ascendancy exists and the skill is an active gem), `guide_run {new_run}`, write the first log | runner | `run-log.json` | **Asks the user** when `loadedBuildUnsaved` (D-210: the first compile would discard unsaved work) |
| 2 | R1a research, round *k* | researcher, ≤ 3 in parallel, background | `research/p<k>-r1a-<n>.md` | file and concept titles |
| 3 | R1b, one concept at a time, ≤ 3 per round (D-235: the cap is per research round) | coordinator | `concepts/<id>/plan.json`, its measure-only record and XML, `reports/gates/R1b-<id>-a<n>.json` | compiled or not. **Retry:** a compile failure re-runs with its errors, ≤ 2 times, then the concept is `failed` (Q2). FI-1 applies here |
| 4 | R1b-assemble | coordinator | `dossier.md` | the checkpoint-1 comparison, one line per concept |
| 5 | Checkpoint 1 | runner | log | **Asks the user:** pick a concept, ask for more (step 2, round *k*+1), or stop |
| 6 | D1, the endgame design | coordinator | `plan.json` endgame stages, including `skills.main.statSet` (S7) | `done` or `infeasible` |
| 7 | D1 gate | fresh coordinator | final re-price, measure-only compile, `reports/gates/D1-gate-<c>-a<n>.json` | one verdict line. The runner reads the file and routes by slice 03 §5.3's table, unchanged: a pass goes to step 8; a compile, V1 or V2 failure re-runs D1, ≤ 2 retries, then escalates; a floor, budget or rolled-skill failure is `infeasible` (back to checkpoint 1 with evidence) when D1 claimed it, otherwise D1 re-runs, ≤ 2 retries, then `infeasible`. FI-2 and FI-3 apply here |
| 8 | D2, the campaign | coordinator | `plan.json` campaign stages | `done` |
| 9 | D2 gate and final compile | fresh coordinator | measure-only compile; on a V1/V2 pass the final compile (the PoB file, and the record with `importCode`); `reports/gates/D2-gate-<c>-a<n>.json` | **Retry:** D2 re-runs, ≤ 2 times, then escalates |
| — | Gate escalation (steps 7 and 9 only) | runner | log | **Asks the user** D-236's four choices, unchanged: accept (it becomes a known issue, and an equal finding, same plan stage, part and code, fails no later gate), guidance plus one uncounted retry, back to checkpoint 1, or stop |
| 10 | W1, the guide | writer | `guide.md`, accepted gate failures under `Known issues` | ≤ 8 lines |
| 11 | Verify: one full pass | verifier ×3 in parallel (`ledger`, `sources`, `prose`) | none (R-5); the runner writes `reports/v4-<lens>.json` | its report. It reads the plan, the final record, the guide and the data files. Every claim is checked against S7's three rules. The sources lens reports any number or mechanic statement that has no marker |
| 12 | Fix round, once, only with open findings, uncounted | the owners: D1 (endgame stages, their ledger entries and prices), D2 (the campaign), W1 (the guide) | their own files | The earliest owner runs first, then the steps after it: D1 → 7 → 9 → 10; D2 → 9 → 10; W1 alone. Each owner fixes every claim the issue touches, not just the flagged location, and returns the ids it fixed and the locations it changed. The gates keep their 2 retries; an escalation here is a gate escalation |
| 13 | Re-check | each lens that raised a finding, in parallel | the runner writes `reports/v4-<lens>-recheck.json` | It checks only its own findings and the changed locations. There is no further round |
| 14 | Known issues | runner | appends every still-open finding to `guide.md`'s `Known issues`, one line each: id, lens, location, issue | — |
| 15 | Checker | runner (Bash) | — | `check-run.mjs <runFolder>`; the result is shown at step 16 |
| 16 | Checkpoint 2 | runner | log | **Asks the user** to accept, after showing the guide, the PoB file, the gate verdicts, the known issues and the checker's result. Accept ends the run `completed`. Asking for changes is a revision (D-236): the runner maps each request to D1, D2 or W1 with step 12's table, runs that chain with the requests as findings, then steps 11–16 again (Q4), uncounted. Any other answer ends it `not-accepted` |

**Retries, in full.** The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each. An
attempt failed by an attempt-1 fault, a guided retry, the fix round and a revision are uncounted. An
agent that returns without its file is re-run once, uncounted; a second miss ends the run `stopped`,
naming the step.

## 4. Run log and checker scope (S4, S5)

### 4.1 `run-log.json`, schema version 2

| Field | Content |
|---|---|
| `schemaVersion`, `status`, `mode`, `testConfig` | `2`; `running`, `completed`, `not-accepted`, `stopped` or `escalated`; `offline` or `online`; `none`, `accepted` or `refused` |
| `stages[]` | One per agent call, in run order: `{stage, concept?, attempt, outcome, priceOutcomes?}`. `stage` is `R1a`, `R1b`, `R1b-assemble`, `D1`, `D1-gate`, `D2`, `D2-gate`, `W1`, `V4-<lens>` or `V4-<lens>-recheck`. `outcome` is `pass`, `fail`, `done`, `infeasible`, `escalated` or `missing`. `priceOutcomes` counts a pricing step's calls by `[trade:<kind>]` outcome (D-218), for NFR-22 |
| `checkpoints[]` | `{checkpoint, visit, answer, answeredBy, rule?}`. `checkpoint` is `1`, `2`, `unsaved-build` or `escalation`. `rule` records how a pre-supplied or default answer was reached, and W1 quotes it (`worklog.md:551-556`) |
| `escalations[]` | Gate escalations only: `{stage, concept, verdict, choice, guidance?}`. `verdict` is the path of the verdict file, so the log copies no findings |
| `faults[]` | `{id, target, applied, observed}`, offline test mode only |
| `outputs` | `{plan, record, dossier, guide, pobFile}`. The import code stays in the record (D-260) |

### 4.2 What `check-run.mjs` checks

`--partial` goes. The checker checks what the folder holds, and when a guide exists, every guide check
applies. It runs before checkpoint 2.

| | Check |
|---|---|
| **Kept** | The layout. The guide's H2s, the `Checks` H3s, and Leveling H3s equal to the record's loadout names. Markers resolve and parse as C-30 tags, now the only tag-syntax check. The offline rules on prices and tags. The guide's import code equals the record's (D-205). V1/V2 pass in the final record. The D1 gate recomputed from the record and the plan (Q3): the floor, including scenario hits equal to `ceil(round2(ledger value))` (D-256: PoB takes whole-number hits); the budget (D-219: ≤ 20 divines passes, ≤ 22 passes with a note); and the rolled skill. The gate file now supplies only the budget's slot→price map with its rates, and each stage's rolled-skill figure field |
| **New** | **The record matches the plan:** `sha1(plan.json)` equals the final record's `planSha1` (`src/plan/record.ts:60`). The final compile validated that plan (D-163), so this also proves the plan validates. **The PoB file equals the import code:** the decoded `importCode` (Node's `zlib`) matches the record's `pobFile` sha1, with one tree set per plan stage titled by the record's loadout names (D-103, D-215: one loadout per stage). **The ledger re-derives:** every plan entry, re-evaluated over the record with the server's compiled evaluator (`build/plan/ledger.js`, type-only imports), equals the record's value to 2 decimals. **The rolled figure's stat set** equals `skills.main.statSet` (S7). **Every finding open after the re-check** appears, by id, under `Known issues` |
| **Log** | The §4.1 fields are present and their values are allowed; `testConfig: accepted` only offline |
| **Dropped** | AC-W2 (j) caps and (m) claim counts; the stamp and order rules; D-261's recount; D-262 and D-255; FR-W6's report↔log checks (`check-run.mjs:597-625`); V3 and coverage checks; the basis copies (F7); V3/V4 accepted-finding equality |

## 5. WU-47, the offline end-to-end run (S8, S9)

**Procedure.**
1. **Setup** and 2. **Server:** unchanged (`03-pipeline.md:649-656`).
3. **Session:** interactive (D-263: no headless sessions), on the user's default model, Opus (S9). The kept evidence is the session transcript and its subagent transcripts, which record each agent's tool calls.
4. **Run A:** `/build-guide Titan "Blood Hunt" --offline --test A.json`. Answers: checkpoint 1 `["first-viable"]`, checkpoint 2 `["accept"]`. Faults: FI-1 `{concepts:["c1"], persistent:true}` and FI-2 `{concepts:"all", persistent:false}`.
5. **Run B:** `--test B.json`. Answers: checkpoint 1 `["pick:c1","pick:c2"]`, no escalation answer. Faults: FI-1 `{concepts:"all", persistent:true}` gives no viable concept; FI-3 `{concepts:["c1"]}` makes c1 infeasible; FI-2 `{concepts:["c2"], persistent:true}` drives a D1 gate escalation, answered by the default `stop`.
6. **Probes and review:** P1 (AC-W4 and AC-W26's invalid rolls) and P2 (AC-W15, W21 and W26's unsaved build), as in attempt 2 (`worklog.md:567-572`), then the coordinator's guide review (AC-W22).

The "no Workflow tool → `blocked: A-23`" clause (A-23: a skill can start a saved workflow) (`03-pipeline.md:674-675`) is removed. The
quality-clause rule (`:677-680`, one re-run before a prompt finding) is kept.

| AC | Status | New text, where changed |
|---|---|---|
| W4 (a `--test` without `--offline` is refused) | kept | — |
| W15 (seeded ledger check) | changed | As now, but the lenses run on the copy as step 11 runs them; "pass 1" is dropped |
| W16 (no network) | changed | (a) and (d) kept. (b) Scanning the transcripts, subagents included, finds no `WebSearch`, `WebFetch` or price-tool use. (c) removed, since the log has no `pricing`; (b) and (d) cover it. (e) Every Bash command in the transcripts is the checker, or is listed in the work-log; none runs a network client, and no agent type has Bash |
| W17 (run A artifacts) | changed | Kept: the checker exits 0 (now including §4.2's new checks), `guide_run {validate}`, V1/V2, the one builds-folder file, `encode_build_code` = `importCode` = the guide's code with one loadout per stage, the concepts' records, *(quality)* a dossier of 2–3 concepts. "Final V3 and V4 have no unresolved finding" becomes: every finding open after the re-check is under `Known issues` (the checker), and *(quality)* every pass-1 finding an owner reported fixed passes its re-check |
| W18 (run A log) | changed | `mode: offline`, `testConfig: accepted`, *(quality)* `status: completed`. `stages[]` is in run order; the time and `timeline` clauses go. The R1a entries equal the research files, ≤ 3. c1 has 3 R1b attempts and is `failed`, its last R1b verdict names `FI-1 Unknown Gem`, and the transcript's checkpoint-1 display lists it as failed. The chosen concept's D1 gate attempt 1 has a V1 finding for FI-2's stage; D1's re-run after it is uncounted (S6), and *(quality)* the gate passes within 2 counted retries. Both checkpoints are `pre-supplied`, with their `rule`. `faults[]`: FI-1 applied 3 times, FI-2 once. NFR-23 holds, read from `stages[]` and the transcript |
| W19 (run B failure routes) | changed | The `orchestration` clause goes; `status: escalated`. The transcript's first checkpoint-1 display is the no-viable view with each concept's FI-1 evidence, and the second shows c1's FI-3 evidence. c2's D1 gate has 3 attempts, each with a V1 finding, then one escalation; no D2 or W1 ran. The escalation's `choice` is `stop`, and its checkpoint is `answeredBy: default`. No builds-folder file comes from run B. `check-run.mjs` exits 0 (no `--partial`) |
| W20 (write roots) | kept | The kept evidence now includes the subagent transcripts |
| W21 (allowlists enforced) | changed | One `build-guide-researcher`, started with the Agent tool, is told to call `mcp__pob2__guide_run {new_run:"probe"}`; it can't, and no `probe/` folder appears. The Workflow half is removed. The verifier-Write probe is kept |
| W22 (the coordinator's guide review), W26 (start-up refusals) | kept | — |

**The other slice 03 ACs.**
- AC-W1 (the skill's static check): changed. It now requires the four agent types, `--offline`, `--test`, and a step list naming each step's agent type; there are no workflow names.
- AC-W2 (the checker's fixture tests): changed per §4.2. (j), (m) and the partial-mode clause are removed. (l) becomes "an open finding missing from `Known issues`". New broken copies: (r) the plan's sha1 differs from the record's `planSha1`; (s) the import code doesn't match the PoB file, or the loadout count doesn't match the stages; (t) a ledger entry doesn't re-evaluate; (u) the rolled figure's stat set isn't `main.statSet`.
- AC-W5 (agent definitions): changed. There are four definitions, and R-6 becomes "every Agent call `SKILL.md` names gives a `subagent_type`".
- AC-W11 (the guide template): changed. `Known issues` replaces `Accepted failures`.
- AC-W12 (verifier independence): changed. It becomes a static check that `SKILL.md`'s verifier prompt carries only the header and the reference path (D-142: V4 is an agent that didn't write the plan).
- AC-W14 (the verifier definition and fallback list): changed to the verifier definition only.
- AC-W23 (the allowlist probe): kept as recorded at WU-43 (`worklog.md:257-260`).
- Removed, all workflow-harness tests: AC-W3, W6, W7, W8, W9, W10, W13, W24 and W25.

## 6. Superseded and changed

**Spine (`README.md`).**
- **The slice table (`:31`), the capability glossary (`:41`) and G-13 (`:146`, the pipeline's goal):** V3 and the workflows are removed, and O1 (orchestration) is the runner. G-13 now reads "verified by V4, open findings stated in the guide".
- **C-30 (`:192-195`):** "V3 checks that tags are present" becomes "the checker checks tag syntax, and the sources lens flags unsourced number and mechanic claims".
- **C-36's table (`:317-322`) and its retries bullet (`:334-337`):** D1, D2 and W1 are run by the runner through the Agent tool. The V3 row is removed. V4's gate becomes "open findings become known issues". Retries apply to the three gates only.
- **D-127 (`:427`, ≤ 2 retries per stage, then escalate):** this no longer applies to verification; it is kept for the gates.
- **D-129 (`:429`, a skill plus two saved workflows):** superseded by S1.
- **D-141's last clause (`:441`, a failed check re-runs then escalates), as §5.5 applied it to V3/V4, and D-166 (`:465`):** replaced by one fix round. D-166 says failures follow D-141.
- **D-152 (`:451`, the skill and workflows live in project scope):** `.claude/workflows/` is dropped.
- **D-158 (`:457`, the run log's content):** replaced by §4.1.
- **D-161 (`:460`, "the run log records actuals"):** these are read from `stages[]` and the transcript.
- **D-172 (`:471`, the Agent-tool fallback):** superseded; it is now the only path.
- **D-179 (`:478`):** no sampling, and open findings are listed instead of blocking.
- **D-218 (`:512`):** the run log classifies price outcomes per step.
- **D-235 (`:529`):** rounds are read from the checkpoint-1 answers of `more`.
- **D-236 (`:530`):** the runner, not a coordinator, maps revision requests, and the four escalation choices apply to gate escalations only.
- **A-22 (`:547`):** reads "subagents share the session's MCP server".
- **A-23 (`:548`, a skill can start a saved workflow):** withdrawn.
- **M-12 (`:589`, the offline pipeline milestone) and M-13 items 3–4 (`:593-595`, the alpha):** "V1–V4 passing" becomes "V1/V2 and the gates pass, and V4 ran with every open finding a known issue". NFR-23 and NFR-22 are read as in §4.1.
- **§8's rows for WU-43…WU-47 (`:621-625`) and the lanes note (`:636-637`):** changed.
- **§9 (`:691`):** "D-172" is dropped from the fan-out rule.
- **R-23 (`:706`), "V4 samples":** V4 now checks all claims.
- **R-26 (`:709`, the Workflow tool unavailable):** closed.
- **§12's static class (`:737`), NFR-22 (`:783`) and NFR-23 (`:784`):** changed.

**Slice 03.**
- **§1's Workflow facts (`:18-37`):** no longer relied on.
- **§2's layout (`:66-87`):** gate steps write their verdict files. V3 rows go, V4 reports are named as in §3, and `dossier.md` has one writer.
- **FR-W2 step 3 and the log rule (`:103-111`):** changed.
- **FR-W4 (`:117-120`, the hand-off) and FR-W5 (`:121-122`, Workflow tool or fallback):** replaced by §3.
- **FR-W6 (`:123-124`, the runner persists returned reports):** changed: gate steps write their own verdicts.
- **FR-W7 (`:125-147`, the run checker):** replaced by §4.2. Its "Node built-ins only" rule is relaxed to allow the server's own compiled ledger module.
- **§4 (`:151-200`):** four types. The provenance row (`:176`) is removed, and the coordinator loses the dossier fix and the revision mapping. R-5 is kept, and the runner writes the verifier reports. R-6 becomes `subagent_type` only.
- **§5.1 (`:204-213`):** the header loses `pass`, and its stage list changes.
- **§5.2–§5.3 (`:215-318`):** replaced by §3. The D1 gate's rules and table (`:250-289`) are kept, the D1 verdict's `basis` is trimmed, and the resumes are reduced to gate escalations and revisions.
- **§5.4 (`:320-338`):** caps and escalations apply at the gates only.
- **§5.5 (`:340-354`):** replaced by steps 12–14.
- **§5.6 (`:356-363`):** removed.
- **§6 (`:365-402`):** replaced by §4.1.
- **§7.4 (`:430-457`):** V3 and the claim counting are removed, and the 1-in-5 rule (`:449`) goes.
- **§8 (`:475`):** `Known issues` replaces `Accepted failures`.
- **§9 (`:507`):** the price log is kept as per-step counts.
- **§10 (`:519-525`):** checkpoint 2 shows the known issues and the checker's result, and `shown`/`at` are no longer recorded.
- **§11.2 (`:558`):** `orchestration` is removed.
- **§11.3 (`:560-572`):** gains S6's rule.
- **§12's note and the WU-43…WU-47 blocks (`:576-680`):** changed.
- **WU-48 checklist (`:703-709`):** item 5 becomes "known issues listed", and item 7 reads NFR-22 per step.
- **§13 and §14 (`:724-965`):** changed as §5.
- **§15's O-2 and O-3 (`:977-978`):** changed.

**Work-log decisions not yet folded into the spine.**
- **Superseded:**
  - D-253 (`:390`);
  - D-255 (`:397`);
  - the V3/V4 part of finding equality (`:399-402`; gate equality is kept);
  - the run-log rules (`:403-404`);
  - the Sonnet choice for WU-47 (`:406-409`);
  - D-260's second bullet, "read the truncated workflow result" (`:495`; its first bullet, the record as the import code's one home, is kept);
  - D-261 (`:498`) and D-262 (`:500`);
  - the runner's `date` and its no-`cd` rule for workflow lookup (`:502-504`);
  - F5's fallback stamping (`:505`).
- **Kept:** D-254 (five waystone-scaled reference hits per endgame stage), D-256, D-257 (the writer has Edit), D-258/258a (the lookup's closest-name suggestions), D-259 (V1's gem-tier floor), D-263, and the checkpoint `rule` (`:551-556`).

## 7. Implementation impact

**Deleted.**
- `.claude/workflows/build-guide-research.js` (528 lines) and `build-guide-design.js` (1,395)
- `.claude/skills/build-guide/references/fallback.md`
- `.claude/skills/build-guide/references/stages/V3.md`, `dossier-fix.md` and `revise-map.md`
- `.claude/agents/build-guide/build-guide-provenance.md`
- `tests/helpers/workflowHarness.ts` (502)
- `tests/unit/workflowHarness.test.ts` (224) and `tests/unit/buildGuideWorkflows.test.ts` (2,157)
- `tests/fixtures/pipeline/workflows/` (3 fixture scripts)

**Changed.**
- `SKILL.md`: §3–§8 rewritten as §3's step list, with the verifier prompt template; Bash is the checker only.
- `references/run-log.md`: §4.1.
- `references/run-folder.md`: the layout, and who writes the reports.
- `references/gates.md`: gate steps write their verdict files; the trimmed `basis`; the stat-set rule.
- `references/checkpoints.md`: gate escalations only; the runner maps revisions; no `shown`/`at`.
- `references/task-header.md`: the stage list; no `pass`.
- `references/source-markers.md`: claim counting and the V3 report removed; S7's three claim rules added.
- `references/offline-and-test.md`: `orchestration` removed; S6's fault rule.
- `references/pricing.md`: per-step price-outcome counts.
- `references/stages/README.md`: a step returns its files plus at most 8 lines.
- `stages/V4.md`: the full pass, the re-check mode, the unsourced-claim rule; no dossier, no sampling.
- `stages/D1.md`: set `skills.main.statSet`.
- `stages/D1-gate.md` and `D2-gate.md`: write their own verdict file.
- `stages/W1.md`: `Known issues`.
- `stages/R1a.md`, `R1b.md`, `R1b-assemble.md`, `D2.md` and `W1.md`: `mcp__pob2__…` names and short returns.
- `templates/guide-template.md`: `Known issues` replaces `Accepted failures` (`:156`).
- `scripts/check-run.mjs`: §4.2.
- `.claude/agents/build-guide/` (coordinator, researcher, verifier, writer): descriptions and return rules, with no workflows or fallback.
- `src/handlers/planHandlers.ts:111-125`: print every finding. No test asserts the cap of 10.
- The spine and slice 03: fold this amendment in on approval.

**Tests.**
- `tests/static/buildGuidePipeline.test.ts`: AC-W1, W5, W11 and W14 rewritten. The V3, `revise-map` and fallback blocks (`:843`, `:928`, `:955`) removed. The WU-47 blocks (`:985`, `:1040`) trimmed to S7. The D-263 block (`:1090`) kept.
- `tests/unit/buildGuideCheckRun.test.ts`:
  - **Keep:** budget (`:422`), gate acceptance and equality (`:338`, `:390`), accepted-offline (`:550`), D-256 (`:624`) and the checkpoint `rule` (`:813`).
  - **Remove:** `--partial` (`:433`), the keyed retries (`:464`), V3/V4 equality (`:506`), V4 opening sources (`:573`), D-255 (`:587`), F7 (`:662`), D-261 (`:710`), D-262 (`:738`) and the report↔log check (`:295`).
  - **Rewrite:** `:57`, `:239` and `:250`, plus new cases (r)–(u).
- `tests/fixtures/pipeline/run-ok`, `run-ok-online` and `run-escalated`: regenerate with the slim log, no V3 report, and V4 reports named as in §3.
- New: a `renderCompileText` case with more than 10 findings.

## 8. Open questions

- **Q1. Where do known issues go?** S2 says "the guide's Checks section", but the guide has two `Checks` H3s, one per endgame variant (§8). A Leveling finding has no home there. Proposed: one `### Known issues` under "Confidence and what PoB can't model", replacing `Accepted failures`.
- **Q2. Does R1b keep its 2 compile retries?** S2 names only D1 and D2. R1b's cap ends in `failed`, never an escalation, and run A's FI-1 clause rests on it. Proposed: keep it.
- **Q3. Does the checker keep recomputing the D1 gate's floor, budget and rolled skill?** S5 neither lists nor drops this. It is the only code check of those three verdicts, and S7's stat-set check lives in it. Proposed: keep it, reading the record directly.
- **Q4. After a checkpoint-2 revision, a full pass (proposed) or a re-check of changed claims only?** A full pass costs three lens runs per revision.
- **Q5. NFR-22's evidence.** S4 drops `pricing`. Proposed: `priceOutcomes` on each pricing step's `stages[]` entry.
