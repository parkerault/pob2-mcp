---
name: build-guide
description: Build a Path of Exile 2 guide (level 1 through the campaign to two endgame variants) and a PoB2 build for an ascendancy and a rolled main skill, through the pob2 MCP server. Research concepts, let the user pick one, design and compile the plan, write the guide and verify its claims. Use when the user runs /build-guide <ascendancy> <skill> [--offline [--test <path>]] or asks for a build guide for an ascendancy and skill roll.
---

# build-guide

You are the **runner**: you start the run, call one agent per step with the Agent tool, ask the user at the
checkpoints, keep the run log, write the verifiers' reports and run the run checker. Agents research,
design, compile, write and check (slice 03 of `docs/build-guide/spec/`, as its amendment 1 simplifies it;
spine C-36).

## Hard rules (for you and for every agent)

- **Never read, print or copy any `.env` file**, and never set `POESESSID`. The trade cookie stays with
  the server.
- **Never contact pathofexile.com or poe.ninja yourself**: no WebFetch, WebSearch or Bash to them.
  Trade and poe.ninja are reached only through the server's price tools, only by coordinator steps
  (`references/pricing.md`). Web research uses only poe2db.tw, maxroll.gg, game8.co, poe-vault.com and
  patch-note mirrors, and none at all in offline mode.
- **Write only inside the run folder.** You write `run-log.json` and the V4 reports under `reports/`. Each
  agent writes only its header's `writes`. The PoB file reaches the builds folder only through the final
  compile.
- **Your pob2 tools** are `mcp__pob2__get_classes` and `mcp__pob2__lookup_game_data` for the roll check, and
  `mcp__pob2__guide_run {new_run}` (FR-W3). Every compile, every engine change and every price call is a
  coordinator step's.
- **Agents run only through the Agent tool, as one of the four build-guide types**, named in
  `subagent_type` (`.claude/agents/build-guide/`). A default agent would see every tool.
- **Read only what routes the run:** the gate verdict files under `reports/gates/`, your own
  `run-log.json`, the test config, the agents' returns and the verifiers' reports. Never read `plan.json`, a
  compile record, `dossier.md` or `guide.md` (one final record was 268 KB), with Read or with Bash.
- **Your Bash reads, and runs the run checker; nothing else** (D-265). It runs read-only commands, `ls`,
  `cat`, `head`, `grep`, `wc` and `jq` (with `cd`, pipes and `&&` between them as you need), and the run
  checker, `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`. Never a network client
  (`curl`, `wget`, `nc`, `ssh`) or any host, and never a command that writes, moves or deletes a file: no
  `>`, `>>`, `tee`, `cp`, `mv`, `rm`, `mkdir`, `touch` or `sed -i`. Write every file with Write (or Edit),
  never with Bash or a script. The agents have no Bash at all.

| Agent type (`subagent_type`) | Steps |
|---|---|
| `build-guide-researcher` | R1a: lookup-only research, up to 3 in parallel |
| `build-guide-coordinator` | R1b, R1b-assemble, D1, D1-gate, D2, D2-gate (and its final compile); the only type that compiles or prices |
| `build-guide-writer` | W1: writes `guide.md`, and at step 14 its known issues |
| `build-guide-verifier` | V4: every claim true, one lens each (`ledger`, `sources`, `prose`), a full pass or a re-check; it can't write |

## Calling an agent

Every step is one Agent call, for example:

```
Agent({subagent_type: "build-guide-coordinator", description: "D1 c1 attempt 1", prompt: "<header, then the reference line>"})
```

- **The prompt** is the task header (`references/task-header.md`), a fenced `json` block, then one line
  naming its stage reference: `Read .claude/skills/build-guide/references/stages/<stage>.md and do that
  step.` Add only what the stage reference lists under "Prompt".
- **In flight:** at most 3 agents at once, and a coordinator step never overlaps another agent (FR-W3: one
  engine, one coordinator). R1a's researchers and the V4 lenses run in parallel with
  `run_in_background: true`; every other step runs alone.
- **Returns.** An agent writes its header's `writes` and returns at most 8 lines: what it wrote and the
  outcome. A gate step's verdict is its own file under `reports/gates/`: read that file to route. The
  verifier can't write (R-5): it returns its report as JSON, and you write that JSON unchanged with Write
  to `reports/v4-<lens>.json`, or `reports/v4-<lens>-recheck.json` for a re-check.
- **A missing return.** An agent that returns without its file (a gate step without its verdict file, a
  verifier without a report) is re-run once, uncounted, its attempt logged `missing`. A second miss ends
  the run `stopped`, naming the step.
- **The run log.** Rewrite `run-log.json` whole after every step, checkpoint and question
  (`references/run-log.md`), so an interrupted run still leaves one.

The verifier's prompt is always exactly this, the header and the reference line, so it carries nothing a
producing step wrote (R-5, D-142):

````
```json
<the task header: stage V4, its lens and check>
```
Read .claude/skills/build-guide/references/stages/V4.md and do that step.
````

## The steps

| # | Step | Agent type | Writes | Returns, user, retries |
|---|---|---|---|---|
| 1 | Start (§1) | you | `run-log.json` | asks the user when `loadedBuildUnsaved` (D-210) |
| 2 | R1a, research round *k* | `build-guide-researcher`, ≤ 3 in parallel | `research/p<k>-r1a-<n>.md` | its file and concept titles |
| 3 | R1b, one concept at a time, ≤ 3 per round (D-235) | `build-guide-coordinator` | `concepts/<id>/plan.json`, `reports/gates/R1b-<id>-a<n>.json` | compiled or not; a compile failure re-runs, ≤ 2 counted retries, then the concept is `failed` |
| 4 | R1b-assemble | `build-guide-coordinator` | `dossier.md` | the checkpoint-1 comparison, one line per concept |
| 5 | Checkpoint 1 (§3) | you | log | asks the user: pick, more (step 2, round *k*+1) or stop |
| 6 | D1, the endgame | `build-guide-coordinator` | `plan.json` (its endgame stages, `skills.main.statSet` set) | `done` or `infeasible` |
| 7 | D1-gate | `build-guide-coordinator`, fresh | `reports/gates/D1-gate-<c>-a<n>.json`; `plan.json` (FI-2 and the final re-price pass) | one verdict line; route by §4 |
| 8 | D2, the campaign | `build-guide-coordinator` | `plan.json` (its campaign stages) | `done` |
| 9 | D2-gate and the final compile | `build-guide-coordinator`, fresh | `reports/gates/D2-gate-<c>-a<n>.json`; the PoB file through the server | one verdict line; a failure re-runs D2, ≤ 2 counted retries, then escalates |
| 10 | W1, the guide | `build-guide-writer` | `guide.md` | at most 8 lines |
| 11 | V4, one full pass | `build-guide-verifier` ×3 in parallel (`ledger`, `sources`, `prose`) | none; you write `reports/v4-<lens>.json` | its report |
| 12 | Fix round, once, only with open findings, uncounted | the owners: D1, D2, W1 | their own files: claims edited in place; a compile only for a build change | the ids fixed, the locations changed, and whether it recompiled |
| 13 | V4 re-check | `build-guide-verifier`, in parallel: each lens that raised a finding, or all three when a gate re-ran in the fix round | none; you write `reports/v4-<lens>-recheck.json` | its report; no further round |
| 14 | Known issues, only with open findings | `build-guide-writer` | `guide.md`'s `Known issues` lines | at most 8 lines |
| 15 | Run checker | you (Bash) | — | its result, shown at step 16 |
| 16 | Checkpoint 2 (§6) | you | log | asks the user: accept, ask for changes (a revision), or anything else |

**Retries, in full.** The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each. These
attempts count against no cap: an attempt failed by a fault directive that applies to attempt 1 only (a
persistent directive's failed attempts do count: S6), a guided retry, the fix round and a revision, and the
re-run after a missing return. Verification never runs a lens again for its findings beyond the one
re-check, and never escalates; only the D1 and D2 gates escalate.

## 1. Start (FR-W1, FR-W2)

`/build-guide <ascendancy> <skill> [--offline [--test <path>]]`. Multi-word names are quoted:
`/build-guide Titan "Blood Hunt"`.

- `--offline` starts offline mode (`references/offline-and-test.md`): no web, no prices.
- `--test <path>` is a test config. It is accepted only with `--offline` (`testConfig: "accepted"`);
  without `--offline` it is refused (`testConfig: "refused"`), ignored, and you ask the user at every
  checkpoint (D-157). No `--test`: `testConfig: "none"`.

In this order, before any agent runs:

1. **Roll check** (D-238).
   - Call `mcp__pob2__get_classes`. The ascendancy must be listed (case-insensitive). Note its class.
   - Call `mcp__pob2__lookup_game_data {mode: "gem", query: <skill>}`. A result headed `## <skill>`
     (case-insensitive) must say `Kind: active`. A support gem, or no such result, fails.
   - On a failure, **stop**: list the closest valid names from those results, and say how to re-run.
     Ascendancies come from `mcp__pob2__get_classes`. For the skill, quote the names the lookup gave: when
     nothing matched, `mcp__pob2__lookup_game_data` says "Nothing matched …", then lists up to 5 names under
     `Closest active gem names (…):` and up to 3 under `Closest support gem names (…):`, each line
     `- <name> (active|support)` (D-258, D-258a). Quote the active names, in its order: only an active gem
     is a valid roll. When it matched only other gems, quote those gems' names; for a support gem, say it
     is a support. Create no run folder and write nothing.
   - Use the names exactly as the tools gave them from here on: `roll = {className, ascendancy, skill}`.
2. **Run folder.** Call `mcp__pob2__guide_run {new_run: <slug>}` (`references/run-folder.md` gives the slug
   rule). Keep its absolute path (`runFolder`), its root-relative path (`runFolderRel`) and
   `loadedBuildUnsaved`.
3. **Run log.** Read the test config if one was given with `--offline`. A file that can't be read or isn't
   the documented shape is refused (`testConfig: "refused"`) and stops the run (`stopped`, the reason in
   your reply; `references/offline-and-test.md`). Write `run-log.json` with `status: "running"`, the mode
   and `testConfig` (`references/run-log.md` has a first write).
4. **Unsaved build** (D-210). If `loadedBuildUnsaved` is `true`, ask the user before the first compile:
   proceed (the loaded build's unsaved changes will be discarded) or stop (the run ends `stopped`). In
   offline test mode `answers.unsavedBuild` answers it (`references/checkpoints.md`).

## 2. Research (steps 2 to 4)

- **R1a.** Three researchers, foci `mechanics`, `items` and `tree` (`references/stages/R1a.md`), each
  writing `research/p<k>-r1a-<n>.md` (round `k`, researcher `n`). A later round's prompt carries the
  user's note.
- **Concept ids.** Number the proposals the researchers returned `c<firstId>`, … in researcher order,
  each file's in file order; `firstId` is 1 in the first round, then one more than the highest id so far.
  Carry at most 3 per round (D-235); the rest are `not-carried`.
- **R1b**, for each carried concept in id order, one at a time. Its header's `writes` are
  `concepts/<id>/plan.json` and `reports/gates/R1b-<id>-a<n>.json`. A failed compile re-runs with that
  verdict file as `findings`, up to 2 counted retries; then the concept is `failed`, its last verdict file
  the evidence (D-141). FI-1 applies here.
- **R1b-assemble** writes `dossier.md` from the round's research files and the carried concepts'
  skeletons. Its prompt lists the round, `firstId`, the note, each research file (and whether its
  researcher returned), and each concept `{id, title, proposedIn, status, attempts, verdict}`; it returns
  the checkpoint-1 comparison.

## 3. Checkpoint 1 (step 5; `references/checkpoints.md`)

Show the comparison lines, each concept's status (`viable`, `failed`, `not-carried`) and the dossier's
path, and ask: pick one (a failed one may be picked anyway), ask for more, or stop. **Ask for more**
starts round `k + 1` (step 2) with the user's note, up to 3 more concepts (D-235); only that answer starts
a round. **Stop** ends the run `stopped`. After an `infeasible` design or an escalation sent back here,
show that concept's evidence (its last verdict file). With no viable concept, show each concept's last
verdict as its evidence.

## 4. Design (steps 6 to 9; `references/gates.md`)

`buildName` is `<slug>-<YYYY-MM-DD>-<n>`, the run folder's last two segments joined with `-`.

- **D1** writes `plan.json` anew on its first attempt of a fresh design, and edits it otherwise; its header
  carries the earlier D1 gate findings on a retry. It returns `done` or `infeasible`, with a reason.
- **The D1 gate** is a fresh coordinator step after every D1 attempt. Route by its verdict file and D1's
  claim (gates.md's "The D1 gate's outcome", unchanged):
  - compiled, V1, V2, floor and rolled skill pass, budget pass or unverified: step 8;
  - a compile, V1 or V2 failure: D1 re-runs with the verdict, up to 2 counted retries; the third failure
    escalates (§5);
  - any part but the budget `unverified` (only the budget may stay unverified, D-164): a failure, routed as a
    compile, V1 or V2 failure;
  - only floor, budget or rolled skill failing, D1 having claimed `infeasible`: `infeasible`, back to
    checkpoint 1 with the verdict as evidence; D1 having claimed `done`: D1 re-runs, up to 2 counted
    retries, then `infeasible`;
  - a verdict with `"forced": "infeasible"` (FI-3): `infeasible`;
  - after a guided retry or an accepted re-run (§5), any failure: the gate escalates again.
  Log each gate attempt with the outcome its verdict file routes to; the run checker holds the log to the
  files.
- **D2** adds the campaign stages; **the D2 gate** checks every stage and, when the compile, V1 and V2 pass,
  runs the final compile with `buildName` in the same step. A failure (the final compile's included)
  re-runs D2 with the verdict, up to 2 counted retries; the third escalates (§5). A pass goes to W1.
- **Pricing.** Tell each coordinator step how to price (the D1 gate reads it from `run-log.json` itself): offline; stopped (once any `stages[]` entry's
  `priceOutcomes` counts a `locked_out` or `rate_limited` call); or paced. Log each pricing step's outcome
  counts as its `priceOutcomes` (`references/pricing.md`).

## 5. Gate escalations (`references/checkpoints.md`; D-236)

Only the D1 and D2 gates escalate. Record the escalation as `{stage, concept, verdict, choice, guidance?}`,
`verdict` being the escalated attempt's verdict file, and the question as checkpoint `escalation`. Show
the stage, the attempts and the verdict file, and ask:

1. **accept** (not offered for a compile failure: nothing compiled). The verdict's failing findings are
   accepted: every later header's `accepted` carries them, an equal finding (same plan stage, part and
   code) fails no later gate, and W1 lists them under `Known issues`. After the D1 gate, go on as if it
   passed; after the D2 gate, run the D2 gate once more, uncounted, with them in `accepted`, so it runs the
   final compile.
2. **guidance and one more retry**: the producer (D1 or D2) gets one more attempt, uncounted, with the
   verdict and the user's guidance (`code: "user-guidance"`) in `findings`, then its gate. If the gate fails,
   whatever part fails, it escalates again.
3. **back to checkpoint 1**, the verdict file as that concept's evidence.
4. **stop**: the run ends `escalated`.

## 6. Write, verify and checkpoint 2 (steps 10 to 16)

- **W1** writes `guide.md`. Its header's `accepted` carries every accepted gate finding; its prompt names
  the last D1 gate verdict file (its budget totals).
- **Step 11, the full pass.** Start the three lenses in parallel, `check: "full"`; each checks every claim
  of `plan.json` and `guide.md` in its lens, with no sampling. Write each report to `reports/v4-<lens>.json`.
- **Step 12, the fix round**, once, only when a report has an `unresolved` finding (D-264). Send each
  finding to its `owner`: D1, D2 or W1. Each owner fixes, in place with Edit, every claim the issue touches,
  not only the flagged location: the claim's wording, citation, caveat or source. It recompiles only when a
  finding needs a build change: gear, tree, gems, config, scenario or a ledger formula. It returns the ids it
  fixed, the locations it changed and whether it recompiled. The earliest owner runs first (D1, then D2), and
  W1 always runs last: it fixes its own findings and patches the guide in place wherever it repeats a claim
  another owner changed (their locations in its header's `changed`).
  - **No owner recompiled** (claims only): no gate runs; D1 → W1, D2 → W1, D1 → D2 → W1 or W1 alone. Log each
    D1 or D2 of the round with outcome `claims-edited`. The final record and the PoB file stay the last D2
    gate's.
  - **An owner recompiled:** its gates run as now: **D1** → D1 gate → D2 gate → W1; **D2** → D2 gate → W1. A
    step that is itself an owner gets its findings in `findings` (D2 after D1: D1 → D1 gate → D2 → D2 gate →
    W1; that D2 runs its gate even for claim edits, since the D1 gate's compile replaced the final record).
    Log the owners `done`. W1 still patches the guide in place, its header's `changed` `"all"`: the import
    code and every record or ledger number the guide quotes may have moved.

  The round is uncounted; the gates in it keep their 2 counted retries, and an escalation in it is a gate
  escalation.
- **Step 13, the re-check.** When a gate re-ran in the fix round (an owner recompiled), the plan and the
  guide's numbers are new: all three lenses run once more, in parallel, with `check: "recheck"`, their own
  open findings in `findings` and `changed: "all"`, and check every claim, as a full pass does. Otherwise
  (claims only) each lens that raised a finding runs once, in parallel, with its own open findings in
  `findings` and the owners' changed locations in `changed`, and checks only those. Write each report to
  `reports/v4-<lens>-recheck.json`. Either way there is no further round: what stays open is a known issue.
- **Step 14, known issues.** A finding is open when it is `unresolved` in its lens's re-check, or
  `unresolved` in the full pass and not reported `fixed` by a re-check. With any open finding, W1 runs once
  more (D-265): its header's `findings` are the open findings as the reports give them, its `accepted` the
  accepted gate findings, and its prompt says `known issues`. It rewrites only the lines under `### Known
  issues`, each issue one plain sentence the reader can act on, followed by the finding's id in
  parentheses. Log it as W1 with outcome `known-issues`. With no open finding, nothing runs.
- **Step 15.** Run the run checker (§7).
- **Step 16, checkpoint 2.** Show the guide's path, the PoB file (the D2 gate verdict's `finalCompile`),
  the gate verdicts, the known issues and the checker's result, and ask: **accept** (the run ends
  `completed`), **ask for changes**, or anything else (the run ends `not-accepted`, with the user's note).
  Asking for changes is a revision (D-236): map each request to D1, D2 or W1 by step 12's owners (the
  guide's text is W1's; an endgame stage, its ledger entries and prices D1's; a campaign stage D2's), run
  that chain as step 12 does (claims in place, the gates only after a recompile), with the requests as
  `findings` (`code: "user-request"`), then steps 11 to 16 again. A revision counts against no cap.

## 7. Finish

1. Set `status` and `outputs` (`plan`, `record`, `dossier`, `guide` and the PoB file; not the import code,
   whose one home is the record, D-260), and write the run log a last time.
2. Run the run checker, `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`: at step 15,
   and once more after the last log write of every run. It checks the artifacts, recomputes the D1 gate
   from the record, and checks the run's control flow from the log (`references/run-folder.md`).
3. Tell the user: the run folder, the guide, the PoB file, where its import code is (the guide's first
   section, and `compile-record.json`), the final status, the known issues, and the checker's result
   (each violation it printed, if any).

## References

- `references/run-folder.md`: creating the run folder, the layout and who writes what, the PoB file name,
  what the run checker checks.
- `references/run-log.md`: every run-log field, and a first write.
- `references/task-header.md`: the header every agent prompt starts with.
- `references/checkpoints.md`: checkpoints 1 and 2, the unsaved-build and escalation questions,
  revisions, pre-supplied answers.
- `references/gates.md`: the gates, their verdict files, and what the run checker recomputes.
- `references/pricing.md`: the pricing procedure, outcome classification and the budget thresholds.
- `references/offline-and-test.md`: offline mode, the test config and fault directives.
- `references/source-markers.md`: tags, citations and markers; the claim rules; the V4 report.
- `references/lookups.md`: the lookup tools, `mcp__pob2__check_model_coverage`'s statuses, hand calculations.
- `references/stages/`: one stage reference per step.
- `scripts/check-run.mjs`: the run checker.
