---
name: build-guide
description: Build a Path of Exile 2 guide (level 1 through the campaign to two endgame variants) and a PoB2 build for an ascendancy and a rolled main skill, through the pob2 MCP server. Research concepts, let the user pick one, design and compile the plan, write the guide and verify every claim. Use when the user runs /build-guide <ascendancy> <skill> [--offline [--test <path>]] or asks for a build guide for an ascendancy and skill roll.
---

# build-guide

You are the **skill runner**: you start the run, hand work to agents through two saved workflows, ask
the user at the checkpoints, and keep the run log. Agents do the research, design, writing and checking
(slice 03 of `docs/build-guide/spec/`; spine C-36). The hand-off (D-129): research workflow →
checkpoint 1 → design workflow for the chosen concept → checkpoint 2.

## Hard rules (for you and for every agent)

- **Never read, print or copy any `.env` file**, and never set `POESESSID`. The trade cookie stays with
  the server.
- **Never contact pathofexile.com or poe.ninja yourself**: no WebFetch, WebSearch or Bash to them.
  Trade and poe.ninja are reached only through the server's price tools, only by coordinator steps
  (`references/pricing.md`). Web research uses only poe2db.tw, maxroll.gg, game8.co, poe-vault.com and
  patch-note mirrors, and none at all in offline mode.
- **Write only inside the run folder.** You write `run-log.json` and `reports/`; each agent writes only
  its header's `writes`. The PoB file reaches the builds folder only through the final compile.
- **You call no `pob2` tool** except `get_classes` and `lookup_game_data` for the roll check and
  `guide_run {new_run}` (FR-W3). Every compile, every engine change and every price call is a
  coordinator step's, and no coordinator step overlaps any other agent.
- **Agents run only as the five build-guide types** (`.claude/agents/build-guide/`), named as
  `agentType` in the workflows and `subagent_type` in the fallback. A default agent would see every tool.

| Agent type | Runs |
|---|---|
| `build-guide-researcher` | R1a: lookup-only research, up to 3 in parallel |
| `build-guide-coordinator` | R1b, R1b-assemble, dossier-fix, D1, D1-gate, D2, D2-gate (and the final compile), revise-map; the only type that compiles or prices |
| `build-guide-writer` | W1: writes `guide.md` |
| `build-guide-provenance` | V3: every claim tagged (no write access) |
| `build-guide-verifier` | V4: every claim true, one lens each: `ledger`, `sources`, `prose` (no write access) |

## 1. Parse the invocation (FR-W1)

`/build-guide <ascendancy> <skill> [--offline [--test <path>]]`. Multi-word names are quoted:
`/build-guide Titan "Blood Hunt"`.

- `--offline` starts offline mode (`references/offline-and-test.md`): no web, no prices.
- `--test <path>` is a test config. It is accepted only with `--offline` (`testConfig: "accepted"`);
  without `--offline` it is refused (`testConfig: "refused"`), ignored, and you ask the user at every
  checkpoint (D-157). No `--test`: `testConfig: "none"`.

## 2. Start (FR-W2), in this order, before any agent runs

1. **Roll check** (D-238).
   - Call `get_classes`. The ascendancy must be listed (case-insensitive). Note its class.
   - Call `lookup_game_data {mode: "gem", query: <skill>}`. A result headed `## <skill>`
     (case-insensitive) must say `Kind: active`. A support gem, or no such result, fails.
   - On a failure, **stop**: list the closest valid names from those results (ascendancies from
     `get_classes`; gem names from the lookup, or from a lookup on a shorter query), and say how to
     re-run. Create no run folder and write nothing.
   - Use the names exactly as the tools gave them from here on: `roll = {className, ascendancy, skill}`.
2. **Run folder.** Call `guide_run {new_run: <slug>}` (`references/run-folder.md` gives the slug rule).
   Keep its absolute path (`runFolder`), its root-relative path (`runFolderRel`) and
   `loadedBuildUnsaved`.
3. **Run log.** Read the test config if one was given with `--offline`. A file that can't be read or
   isn't the documented shape is refused (`testConfig: "refused"`) and stops the run (`stopped`, the
   reason naming the malformed config in `timeline[]` and in your reply; `references/offline-and-test.md`).
   Write `run-log.json` with
   `status: "running"`, the mode, `orchestration` and `testConfig` (`references/run-log.md` has a first
   write). Read the time with `date -u +%Y-%m-%dT%H:%M:%SZ`.
4. **Unsaved build** (D-210). If `loadedBuildUnsaved` is `true`, ask the user before the first compile:
   proceed (the loaded build's unsaved changes will be discarded) or stop (the run ends `stopped`).
   In offline test mode `answers.unsavedBuild` answers it (`references/checkpoints.md`).

From here on, **rewrite the run log after every workflow return, checkpoint, question and escalation**,
so an interrupted run still leaves one.

## 3. Orchestration (FR-W5)

Use the Workflow tool: `Workflow({name, args})`, with `args` as a JSON object. If the Workflow tool isn't
in the session, a call fails before any agent starts, or the accepted test config says
`"orchestration": "agent-tool"`, run the same steps yourself with the Agent tool instead, as
`references/fallback.md` lists them (at most 3 Agent calls in flight). Record which in `orchestration`.

Every agent prompt starts with the task header (`references/task-header.md`) and names its stage
reference under `references/stages/`.

## 4. Research (slice 03 §5.2)

Run `Workflow({name: "build-guide-research", args: {runFolder, runFolderRel, roll, mode, pass, firstId,
note?, faults?}})`. `pass` is the research round, from 1; `firstId` is 1 in the first round, then one more
than the highest concept id so far; `note` is the user's note for a later round; `faults` only from an
accepted test config.

It returns `{status: "ok" | "no-viable", concepts: [{id, title, status, attempts, evidence}],
gateVerdicts, stats}`. Write each gate verdict to `reports/gates/` (FR-W6), then update `rounds[]`,
`concepts[]`, `conceptsCompiled`, `stages[]`, `agents`, `retries[]`, `pricing` and `faults[]`
(`references/run-log.md`).

## 5. Checkpoint 1 (`references/checkpoints.md`)

Show the concepts and ask: pick one, ask for more, or stop. **Ask for more** starts research round
`pass + 1` (step 4) with the user's note, up to 3 more concepts (D-235); only that answer starts a round.
**Stop** ends the run `stopped`.

## 6. Design and write (slice 03 §5.3)

Run `Workflow({name: "build-guide-design", args: {runFolder, runFolderRel, conceptId, mode, buildName,
faults?, resume?}})`, where `buildName` is `<slug>-<YYYY-MM-DD>-<n>`, the run folder's last two segments
joined with `-`. It returns `{status: "ready" | "infeasible" | "escalated", stage?, evidence?, accepted?,
gateVerdicts, v3Reports, v4Reports, stats}`. Write every verdict and report to `reports/` unchanged
(FR-W6), update the log, then:

- **`ready`** → checkpoint 2.
- **`infeasible`** → checkpoint 1, showing that concept's evidence (D-141).
- **`escalated`** → the escalation question (`references/checkpoints.md`): **accept** (resume with
  `{reason: "accepted", stage, findings}`; not offered for a compile error), **guidance and one more
  retry** (resume with `{reason: "guided-retry", stage, findings, guidance}`), **back to checkpoint 1**,
  or **stop** (the run ends `escalated`).

The gates the design workflow applies are in `references/gates.md`: the survival floor gates fire, cold,
lightning **and chaos** resistance at their caps, chaos staying uncapped only through a stage's recorded
`chaosResistException` (D-234); the budget variant, its filled slots and tree jewels together (D-249),
passes at ≤ 20 divines, passes with a "near the ceiling" note above 20 up to 22, and fails above 22
(D-219); the rolled skill is the main damage source of its role (D-217). When the user accepts findings
at an escalation, log them verbatim with their `gate` (`references/run-log.md`): a gate finding equal to
an accepted one (same plan stage, part and code) fails no later gate.

## 7. Checkpoint 2 (`references/checkpoints.md`)

Show the guide and its checks, and ask: **accept** (the run ends `completed`), **ask for changes** (resume
the design workflow with `{reason: "revision", round, requests}`, record it in `revisions[]`, then return
here; revisions count against no cap, D-236), or anything else (the run ends `not-accepted`, with the
user's note).

## 8. Finish

1. Set `status` and `endedAt`, and `outputs` (`plan`, `record`, `dossier`, `guide`, the record's PoB file
   and `importCode`); write the run log a last time.
2. Run the run checker: `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`, adding
   `--partial` unless the run is `completed`. It recomputes the gates and the claim counts from the
   records and fails where they differ from the agents' verdicts.
3. Tell the user: the run folder, the guide, the PoB file and its import code, the final status, and the
   checker's result (each violation it printed, if any).

## References

- `references/run-folder.md`: creating the run folder, the layout and who writes what, the PoB file name.
- `references/run-log.md`: every run-log field, the workflows' `stats`, the first write.
- `references/task-header.md`: the header every agent prompt starts with.
- `references/checkpoints.md`: checkpoints 1 and 2, the unsaved-build and escalation questions,
  revisions, pre-supplied answers.
- `references/gates.md`: the gates, their verdict files, and what the run checker recomputes.
- `references/pricing.md`: the pricing procedure, outcome classification and the budget thresholds.
- `references/offline-and-test.md`: offline mode, the test config and fault directives.
- `references/fallback.md`: the Agent-tool fallback and every step in order, with its agent type.
- `references/source-markers.md`: tags, citations and markers; counting claims; V3/V4 reports.
- `references/lookups.md`: the lookup tools, `check_model_coverage`'s statuses, hand calculations.
- `references/stages/`: one stage reference per step.
- `scripts/check-run.mjs`: the run checker.
