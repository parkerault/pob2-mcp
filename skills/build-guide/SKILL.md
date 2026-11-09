---
name: build-guide
description: Build a Path of Exile 2 build and its guide from an open brief, through the pob2 MCP server. Brainstorm a deck of candidate builds, verify the ones the user picks, let the user finalize 1 to 3 of them, then for each design and compile its endgame (entering maps, budget and non-budget), write its endgame guide (level with any build of the class, then switch) and verify its claims; on request, add a build's campaign for the full guide (level 1 through the campaign to the endgame). Use when the user runs /pob2:build-guide <free text> [--offline [--test <path>]] [--no-ninja], the fixed roll /pob2:build-guide <ascendancy> <skill> included, resumes a run with /pob2:build-guide --resume <run folder> or --campaign <run folder> <card id>, or asks for a build guide.
---

# build-guide

You are the **runner**: you start the run, call one agent per step with the Agent tool, interview the user at
the gates, keep the run log and run the run checker (slice 03 of `${CLAUDE_PLUGIN_ROOT}/docs/build-guide/spec/`, with its amendments). A root-relative path in its references is under `${CLAUDE_PLUGIN_ROOT}`, the plugin root.

**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again
after a compaction: the rules every pob2 runner follows (D-501), on `.env`, the network, trade and pricing, where you
write, agents and your Bash.

## After a compaction (D-420): read this first

A compaction keeps at most part of this skill and none of its references (`${CLAUDE_PLUGIN_ROOT}/scripts/compact-reminder.sh` prints this rule
after each one). If this session was just compacted during a run, before your next step or answer:
1. Re-read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole, the run's `run-log.json`, the current step's reference and, at a gate, the visit's notes (`interviews/<gate>-<visit>.md`, with its `## Pending decision`); in a /pob2:compile, /pob2:pricing or /pob2:writer run, that command's `${CLAUDE_PLUGIN_ROOT}/skills/<piece>/SKILL.md` in place of build-guide's.
2. At a gate, print its display again with `pob2-run-log <runFolder> display <gate> [--build <id>]` (the design and final gates take `--build <id>`, the build at the gate), which records no second visit.
3. Act on no yes the notes don't hold: a yes you remember that the notes don't record isn't one, so restate the pending decision and wait for it.

The run has **three phases, each ending at a gate the user answers** (D-287): the brainstorm (gate `brainstorm`),
the verification (gate `verification`) and the finalization (gate `final`). The verification gate finalizes 1 to 3
cards (D-411); each becomes a **build** in its own folder, `builds/<id>/` (D-412), its files there and its gate
verdicts in `reports/gates/`, and the builds run in turn: its design, the design gate (gate `design`, D-362), its
final compile (F1), its **endgame guide**, checks and final gate; its **full guide**, with the campaign, only on
request (D-415). Only the user starts a round. Every card names its **named damage source**, the main source of
damage, never a token role (D-122 as D-295 words it). Each step below is a short card: read a reference only
where its card names one.

## Hard rules (the pipeline's, beside the shared rules)

- **Your pob2 tools** are `mcp__pob2__get_classes`, `mcp__pob2__lookup_game_data` and `mcp__pob2__search_tree_nodes`
  for the brief check (the last for the ascendancy lock, D-342; the last two, with `mcp__pob2__check_model_coverage`,
  at a gate, D-390), `mcp__pob2__guide_run {new_run}` (FR-W3), and `mcp__pob2__guide_run {resume: <run folder>}` for a
  resume (D-415): no engine call and nothing written, its reply `Resuming run folder <abs>`, `runFolderRel: <rel>` and
  `loadedBuildUnsaved: …`; and `mcp__pob2__compile_plan`'s engine-free calls: `{plan_path, draft_name}`, an escalation
  accept's draft (§5); `remove_draft`, a picked card's skeleton (§4); `read_back` and `adopt`, the user's edits (§3);
  `notes_path`, the notes (§6). Every other compile, engine change and price call is a coordinator step's.
- **Every gate visit prints its display first, in your reply, whoever answers it** (D-265, D-367): the user, a
  pre-supplied answer or a default, at the brainstorm, verification, design and final gates and at an escalation.
  `pob2-run-log <runFolder> display <gate>` prints it (with `--build <id>` at a build's design and final gates);
  then resolve and log the answer (`checkpoint` refuses a visit with no display). A pre-supplied or default answer
  replaces only the question: after the display, state the answer it resolved to, as in `Test config: first-n:2 →
  verify r1-a-1, r1-b-1` (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`).
- **Every gate visit and escalation is an interview** (D-389, D-390), never an AskUserQuestion: answer every
  question before any decision, from the card and research files, your lookups, or a gate question step (stage
  `Q`) after one line saying what you start and why, without asking first. Then restate the decision by the
  cards' names and wait for a yes. A question is never a decision. Write the visit's notes after each answer, and
  the restated decision, the user's words verbatim, under `## Pending decision` before you ask for the yes; log
  the checkpoint from the notes (D-420, `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`).
- **Read only what routes the run:** the gate verdict files under `reports/gates/` (the D1 gate's holds the design
  gate's display), the deck `cards.md`, `run-log.json`, the test config, the agents' returns, the verifiers' reports,
  a read-back's `readback.json` (D-479), the digest's first lines (§1), and at a gate the card and research files
  (D-390). Never read `plan.json`, a compile record, `dossier.md` or `guide.md`, with Read or with Bash; step 14 reads
  only the `Known issues` lines it edits.

## Calling an agent

```
Agent({subagent_type: "pob2:build-guide-coordinator", description: "D1-build r1-a-2 attempt 1", prompt: "<header, then the reference line>"})
```

- **The prompt** is the task header (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/task-header.md`), a fenced `json` block, then `Read
  <root>/skills/build-guide/references/stages/<stage>.md and do that step.` Add only what the card lists. A
  build's steps carry its folder, `buildFolder` (`builds/<id>`, or `.`), and their `writes` under it. The header's `root` is `${CLAUDE_PLUGIN_ROOT}`, which `<root>` stands for.
- **The user's words** (D-482; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`): a request goes verbatim, nothing of yours added. Log a
  step's `request: <id> made|departs: <how>` lines (outside its 8) as `requests`; stop at a departure to ask (`ask`).
- **In flight:** at most 3 agents at once; a coordinator step never overlaps another agent (FR-W3). R1a's
  researchers and a gate's research questions run in parallel, `run_in_background: true`; any other step alone.
- **Returns.** At most 8 lines. A gate step's verdict is its file under `reports/gates/`, and the verifier writes
  its own report, `<buildFolder>/reports/V4-<n>.md`, and never overwrites one (R-5 as D-352 amends it): route on
  that file. An agent returning without its file is re-run once, uncounted, logged `missing`; a second miss ends
  the run `stopped`. A verifier's `exists: reports/V4-<n>.md` is a missing return: re-run at the next free `<n>`.
- **A refused call** (D-421; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/gates.md`, "The refused route"). Claude Code's permission system can
  refuse a tool call inside a step. The step stops and returns `refused: <tool>`; a gate step's verdict file has
  the part the call served `unverified` with code `tool-refused`. On that line or that code, log the step with
  outcome `refused`, ask the user to allow the tool, then re-run the step alone, next, uncounted: it routes to no
  producer and spends no retry.
- **The run log.** Add each step's, gate's and question's entry with `pob2-run-log` (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/run-log.md`), and
  each build's status as it changes (`build`; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/run-log.md`, "Builds").

The verifier's prompt is always exactly this, `<root>` the header's `root`, so it carries nothing a producing step wrote (R-5, D-142):

````
```json
<the task header: stage V4, its check and writes>
```
Read <root>/skills/build-guide/references/stages/V4.md and do that step.
````

## The steps

| # | Step | Agent type | Writes | Returns, user, retries |
|---|---|---|---|---|
| 1 | Start (§1) | you | `run-log.json` | parses and checks the brief, or resumes a run (§7); asks the user when `loadedBuildUnsaved` (D-210) |
| 2a | R1a, brainstorm round *k* | `pob2:build-guide-researcher`, ≤ 3 in parallel, lettered `a`, `b`, `c` | `research/p<k>-r1a-<n>.md`; 3 cards `cards/r<k>-<letter>-<m>.md`, their brainstorm halves | its files and its cards' names |
| 2b | R1a-synthesize | `pob2:build-guide-coordinator` | `cards.md`, the composites' cards `cards/r<k>-s-<n>.md` | `composites: <n>`, a line per composite, the counts of cards listed, not composed and superseded; `short: <why>` for a short round |
| 2c | The brainstorm gate (§2) | you | log | asks the user: verify 1–3 composites or cards (step 3), brainstorm more (step 2a, round *k*+1) or stop |
| 3 | R1b, one picked card at a time, ≤ 3 per verification round | `pob2:build-guide-coordinator` | `concepts/<id>/plan.json`, `reports/gates/R1b-<id>-a<n>.json`, `cards/<id>.md` (a gate's edit to its brainstorm half, or a gate-made card whole, then its verification half), `probes/<id>/<p>/` | compiled or not, and on a damage pass `skeleton: <relpath>`, its skeleton file in the builds folder, logged `skeletonFile` (D-479); a compile failure re-runs, ≤ 2 counted retries, then the card is `failed` |
| 4a | R1b-assemble | `pob2:build-guide-coordinator` | `dossier.md`; a gate-made card's line in `cards.md` | the verification gate's comparison, one line per card |
| 5 | The verification gate (§3) | you | log | asks the user: finalize 1–3 cards, in their order (step 6a for the first), verify other cards (step 3), brainstorm more (step 2a) or stop; after a resume, a build's guide, campaign or design gate (§7) |
| 6a | D1-build, the endgame rungs | `pob2:build-guide-coordinator` | `plan.json` (its endgame stages, `skills.main.statSet` set), `pieces.md` (D-434) | `done` or `infeasible`; its `pieces:` and `stronger structure:` lines |
| 6b | D1-tree, the travel | `pob2:build-guide-coordinator`, fresh | `plan.json` (the rungs' trees, needs, tree jewels and their prices, `tree.start`, `tree.end`, `tree.search`), `trades.json`, `pieces.md`'s jewel lines | `done` or `stale-server`, each rung's travel; `unspent:` and `jewel:` lines |
| 6c | D1-finish | `pob2:build-guide-coordinator`, fresh | `plan.json` (the anoint, prices, ledger and claims), `trades.json` | `done` or `build:`; its price calls by outcome; with `scope: "swap"` or `"scaling"` (§4; D-481, D-486) |
| 7a | D1-gate | `pob2:build-guide-coordinator`, fresh | `reports/gates/D1-gate-<c>-a<n>.json`, with the design display; `plan.json` (FI-2 and the final re-price pass); on a pass, the draft PoB file through the server | one verdict line, and `draft: <relpath>`; route by §4 |
| 7b | The design gate (§4) | you | log | asks the user: accept (step 8, then the guide), the PoB file only (step 8), revise (D1 again), verification (step 5) or stop |
| 8 | F1, the final compile | `pob2:build-guide-coordinator`, fresh | `reports/gates/F1-<c>-a<n>.json`; the PoB file through the server, the draft removed, then `trade-links.json` (D-488) | one verdict line; a fault re-runs once, uncounted, then escalates |
| 9a | D2, the campaign, on request (§7) | `pob2:build-guide-coordinator` | `plan.json` (its campaign stages) | `done` |
| 9b | D2-gate and the campaign's final compile | `pob2:build-guide-coordinator`, fresh | `reports/gates/D2-gate-<c>-a<n>.json`; the `-campaign` PoB file through the server | one verdict line; a failure re-runs D2, ≤ 2 counted retries, then escalates |
| 10 | W1, the guide and the audit layer | `pob2:build-guide-writer` | `guide.md`, `audit.md` | at most 8 lines, with its `known-issues-line` and `audit-known-issues-line` |
| 11 | V4, one full pass | `pob2:build-guide-verifier`, one, no lenses | its own report, `reports/V4-<n>.md` | at most 8 lines: the report and its verdict |
| 12 | Fix round, once, only with open findings, uncounted | the owners: D1, D2, W1 | their own files: claims edited in place, a `hinge: no` statement removed or narrowed; a compile only for a build change | the ids fixed, the locations changed, and whether it recompiled |
| 13 | V4 re-check | `pob2:build-guide-verifier`, one: only what `pob2-check-run --changed <n>` lists | its own report, `reports/V4-<n>.md` | at most 8 lines: the report and its verdict; no further round |
| 14 | Known issues | you | each open finding's `reader` sentence, into `guide.md`'s `Known issues`, and its row into `audit.md`'s | — |
| 15 | Run checker | you: `display final` runs it | — | its result, in the final gate's display (step 16) |
| 16 | The final gate (§6) | you | log | asks the user: accept, accept and finalize more cards, add the campaign (step 9a), ask for changes (a revision), or decline |

**Retries.** The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each; F1 re-runs once on a fault,
uncounted, and its second failure escalates (D-413). Uncounted: an attempt failed by a fault directive on attempt
1 only (a persistent one's count: S6), a guided retry, the fix round, a revision, the design gate's `revise:`, the
re-run after a missing return, a refused step's re-run (D-421), and the D1 gate's lone re-run after a `tool-error`
(D-419). The D1 gate, the D2 gate and F1 escalate; verification never re-checks beyond one re-check after a fix
round or a revision, but for one more round behind its `ask` (D-482, §6).

## 1. Start (step 1)

Read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/start.md` and do it, in its order, before any agent runs; its last step prints the staleness
line: line 3 of each running league's digest, which `init` or `resume` printed after the `digests:` line a researcher's header copies (D-400,
D-507). `init` records `--no-ninja` as `noNinja`, and a resume replaces it with its session's (D-412, D-420): read it from `run-log.json` for every
pricing step, the D1 gate included, which then prices without currency rates (D-333). No Agent tool: the run stops (D-344).

**A resume** (D-415; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/start.md`, "Resuming a run", has its order): `/pob2:build-guide --resume <run folder>`
goes on with an earlier run in its own folder, and `--campaign <run folder> <id>` resumes it and answers
`campaign:<id>`: `mcp__pob2__guide_run {resume}`, `migrate` for a schema-3 log, `resume` with this session's
`noNinja`, the unsaved-build question once per resume, then the verification gate (§3, §7), with no brief check.

## 2. Brainstorm (steps 2a to 2c)

- **R1a** (2a), round `k`: three researchers, foci `mechanics`, `items` and `tree`, which you letter `a`, `b` and `c`
  when you start them, so parallel researchers never collide (D-319). Prompt: the brief, the focus and letter (to
  `b`, a reference build the user named, for a seed card, D-393), and in a later round the user's note.
- **R1a-synthesize** (2b, D-429), after the round's researchers, composes the round's builds, the composites; a run
  whose first brainstorm round ran **R1a-assemble** (it deals cards) keeps that step for every later round. Prompt:
  the round, the brief, the user's note, and each researcher's letter, research file, cards and whether it returned.
  It returns `composites: <n>`, a line `r<k>-s-<n>: <name>` per composite, then `cards: <n> listed | not composed:
  <n> | superseded: <n>`. **A short round**: it returns `short: <why>`; record the reason in the run log, as
  `shortReason` on its `stages[]` entry, whole for one engine (D-405).
- **The brainstorm gate** (2c; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`). Print its display, `display brainstorm` (the brief,
  then the deck), whoever answers (Hard rules). Answers: **verify** 1–3 composites or cards, picked (a composite's
  changes may add or drop pieces) or made at the gate (its `from` cards, composites or piece keys, D-432; step 3);
  **brainstorm more** with the user's note (2a, round `k + 1`; only this answer starts one); **stop**.

## 3. Verification (steps 3 to 5)

- **R1b** (3), the picked cards, then the new ones, in order, one at a time; `concept` the card id, `changes` its
  gate change (D-391). A failed compile, or a gate change that breaks the card, re-runs with that verdict as
  `findings`, the user's words kept, up to 2 counted retries; then the card is `failed` (D-141). FI-1 applies here. A
  card whose damage source isn't a skill (a minion's skill is one, D-379) compiles nothing (D-334): the card's status
  is "can't be finalized yet: its damage source isn't a skill" (D-303), never `failed`; one on an entry the PoB pin
  lacks, "waits on the pin" (`not-in-pin`, D-400). A card whose ascendancy doesn't own the node that grants its skill
  compiles nothing either (D-342): its verdict's `wrong-ascendancy` finding is never retried, and the card is
  `failed`. A `damage-missing` finding (a damage kind the card names shows nothing, D-436) re-runs as a failure.
- **R1b-assemble** (4a). Prompt: the verification round, the research files (and whether each researcher returned),
  and each card `{id, name, status, attempts, verdict}`. Once it wrote `dossier.md`, log the run's `dossier` (`set`).
- **The verification gate** (5; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`). Print its display, `display verification`, whoever
  answers (Hard rules). Answers: **finalize** 1–3 cards (`pick:<id>[,<id>…]`, D-411), in the user's order, each with
  its revision in `changes`: not a card that can't be finalized yet, nor a `wrong-ascendancy` card, failed or not,
  since the build it describes can't exist, D-342; nor a card that already has a build in the run (a second design
  of it is a `revise:` at its design gate, or a new card made from it); **verify other cards**; **brainstorm more**;
  or **stop**. After a resume, also `guide:<id>`, `campaign:<id>` and `design:<id>` (§7). Every route back from a
  design comes here: an `infeasible` design, an escalation's option 3, the design gate's `verification`, and FI-3.
- **The queue** (D-411). Log each finalized card's build with `pob2-run-log <runFolder> build`, `{"id", "roll":
  {className, ascendancy, skill}, "status": "queued"}`, the card's identity (D-286); new builds go ahead of the
  cards still queued. The builds run in turn, one loaded build (FR-W3): a card's design (§4), F1, its guide,
  checks and final gate (§6), then the next. A visit here from a build's route keeps the cards still queued: they
  resume after the visit, behind any card it finalizes, and the visit's `stop` ends them `stopped`.
- **The user's edits** (D-479), here and at the design and final gates: the user changed the gate's PoB file? Read it
  back, show the changes, and on a yes adopt it and take them as a revision (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`).

## 4. Design (steps 6a to 8; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/gates.md`)

One build at a time, the first queued card's, in its folder. D1 is **three agent steps** (D-356, D-418): D1-build,
D1-tree, then D1-finish, each a fresh coordinator step. Every design attempt (fresh, or a gate retry) runs all three,
in that order; a change to the tree alone (the gate's `tree-swap`, the user's tree request, a respec among them,
D-452) runs D1-tree, then D1-finish (on a plan at schema 8 or earlier, D1-build first, to move it to 9, amendment 13
§22). **D1-finish's `build: <ids>` sends an attempt back to D1-build**, in the same attempt (D-446), logged `build`,
its findings D1-build's; D1-tree and D1-finish then run again. D1-tree never returns `respec:` (D-452).

- **D1-build** (6a): prompt, write `plan.json` anew (attempt 1 of a fresh design) or edit it; `findings`, the
  last D1 gate verdict on a retry, or a finalize's revision. Returns `done` or `infeasible`, with a reason, its
  `for D1-tree:` line, its `pieces:` line, `pieces.md`'s rows by status (D-434), and any `stronger structure:`
  line (D-457), within its 8 lines. Log its `priceOutcomes` (D-444).
- **D1-tree** (6b): prompt, D1-build's `for D1-tree:` line as returned, when D1-build ran before it; `findings`,
  a `tree-swap` verdict or the user's tree request. Returns each rung's travel, `unspent:` lines, a `not made:`
  line for each tree change the user asked for that it couldn't make, and a `jewel:` line per socket taken (D-453):
  print those and D1-build's `stronger structure:` lines under the design gate's display, so the user hears them.
  **`stale-server`** (D-467): its first node power reply ignored the targets, a session server built before M-26:
  log it `stale-server`, ask the user to reconnect the server with `/mcp`, then run D1-tree again, next.
- **D1-finish** (6c): prompt, how to price (offline; stopped, the shared rules' trade stop; or paced), no currency rates when the
  log's `noNinja` is true, D1-tree's `unspent:` lines as it returned them, and D1-build's `left out:` lines, with
  its `lever unpulled:` and `override:` lines (D-406, D-407). Log its `priceOutcomes`.
- **The D1 gate** (7a), fresh after every D1. Route by its verdict file and D1-build's claim, by the table in
  `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/gates.md`, "The D1 gate's outcome": compiled, V1, V2, floor, `rolledSkill` and tree pass, budget pass
  or unverified: the design gate (7b); a failure re-runs the D1 steps the table names, up to 2 counted retries, then
  escalates (§5); `infeasible`, back to the verification gate with the verdict as evidence. Log each gate attempt
  with the outcome its verdict file routes to; the run checker holds the log to the files. Its `draft: <relpath>`
  line, the draft mode's reply on a pass, is the build's `draftFile`: log it with `build` (D-466). At the build's first
  draft, remove its card's skeleton (D-479), `remove_draft: <its skeletonFile>` on the plan `concepts/<id>/plan.json`
  (under `runFolderRel`), and log `skeleton {"concept"}`; one the user changed stays, as does an unpicked card's.
- **The design gate** (7b; D-362; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`). Print its display, `display design --build <id>`
  (the D1 gate verdict file's `design` field, A-35), whoever answers (Hard rules). Answers (checkpoint `design`,
  `concept` the card id): **accept**, F1 (step 8), then the endgame guide; **file only** (`accept:file`), F1, then
  the claims pass (§6, D-477): the build ends `file-only`; **revise** (`revise:<text>`), D1 again from the step the
  change needs (a respec is a tree request, `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`), with the text as `findings` (`code:
  "user-request"`), then the D1 gate and this gate again; **verification**: the build ends `dropped`, step 5;
  **stop**: the build ends `stopped`, the next queued card's design next. A default `stop` (`answers.design[]` used
  up) ends the run, the queued cards `stopped`. After `retry-pricing` here, an accept runs the D1 gate's re-price
  pass, then F1 (D-444).
- **The design gate, amendment 14** (D-480, D-481, D-486): an accept asks, unless the user's words answered them, "the
  endgame guide, or the PoB file only?" ("accept" alone is never the guide) and "late endgame scaling, yes or no?"
  (logged `scaling`); a yes runs D1-finish's scaling pass (`scope: "scaling"`) before F1. A revise of one slot's item
  and nothing else is a one-item swap, D1-finish (`scope: "swap"`) then the D1 gate and this gate, its restatement
  naming the route and its cost: "a one-item swap: the finishing step and the design check, about 0.5M tokens".
- **F1** (8; D-413; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/stages/F1.md`), fresh, after the design gate's `accept` or `accept:file`: header `compile:
  "final"`, `buildName`, `firstFree`, `draftFile` (the build's) and `accepted` (this build's accepted findings); its
  prompt names the passing D1 gate's verdict file. `buildName` is the build's session name (D-466: `builds[].name`,
  else its card's), `firstFree: true` on its first final write, the recorded `pobFile` on a re-compile; a build
  designed before amendment 13 keeps `<slug>-<YYYY-MM-DD>-<n>-<id>` (D-412; `<slug>-<YYYY-MM-DD>-<n>` in `.`). Route
  by its verdict file (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/gates.md`, "F1's outcome"): a pass logs the build's `pobFile` (the verdict's
  `finalCompile.pobFile`) and, on `draft removed`, `draftFile` null; then after `accept` renders `audit.md`
  (`pob2-render-audit <runFolder> --build <id>`, D-355) and runs W1, after `accept:file` the claims pass (§6); a
  fault re-runs F1 once, uncounted, then escalates (§5); `ledger-refused` escalates at once.
- **An answer change** (D-480): after F1's pass on `accept` and before W1's entry, the user may take the file only:
  log `answer-change`, a W1 still running `cancelled`, run `pob2-render-audit <runFolder> --withdraw <id>`, then the
  claims pass (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`).

## 5. Gate escalations (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`; D-236)

The D1 gate, F1 and the D2 gate escalate, each for its build (D-411). Record `{stage, concept, verdict, choice,
guidance?}` and checkpoint `escalation`. Print its display, `display escalation`, whoever answers (Hard rules);
answers: 1. **accept** (not after a compile failure, nor F1's ledger refusal), the failing findings into the
later headers' `accepted` of **that build's** steps only, going on as if the gate passed (after the D1 gate, first
the draft: `mcp__pob2__compile_plan {plan_path, draft_name}`, its path into `builds[].draftFile`, D-466; the D2
gate and F1 run once more, uncounted); 2. **guidance and one more retry**: the producer (D1 or D2; after F1, D1,
its gate and the design gate again, then F1) gets one more attempt, uncounted, with the verdict and the user's
guidance in `findings`, then its gate. If the gate fails, whatever part fails, it escalates again; 3. **back to the
verification gate** (the choice `verification`): the build ends `dropped`; 4. **stop**: the build ends
`escalated`, the next queued card's design next. After F1's ledger refusal the user can also restore or remove the
changed PoB file and answer accept: F1 runs again and accepts no finding.

## 6. Write, verify and the final gate (steps 10 to 16)

- **W1** (10): `accepted` that build's accepted gate findings; its prompt names the last D1 gate verdict file. It
  writes the template its plan decides (D-414). Log the build's `guide`, `endgame` or `full`, with `build`.
- **Step 11, the full pass.** Start one verifier (D-352), `check: "full"`, `findings: []` and `writes:
  ["<buildFolder>/reports/V4-<n>.md"]`. `<n>` is always one more than the highest `reports/V4-<n>.md` the build's
  folder holds (`ls <runFolder>/<buildFolder>/reports`), 1 for the build's first. One pass with no lenses: it
  checks every hinge claim of `plan.json` against its source and reads every H2 of `guide.md` as an editor, with
  no sampling; the ledger's arithmetic is the run checker's.
- **The claims pass** (D-477; `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/fix-round.md`), only for a build taken `accept:file` and held to amendment
  13 by its last D1 gate (none for one designed before the boundary): it stays `designing` after F1's pass for one
  verifier, stage `V4-claims`, `check: "claims"`, `findings: []`, `<n>` as above, every hinge claim and no guide;
  an `unresolved` finding gets a fix round with D1 alone (no design gate) and one re-check; then it ends `file-only`.
  Held to amendment 14, it ends after its notes (D-487): W1 with `scope: "notes"`, then the `notes_path` write.
- **Step 12, the fix round** (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/fix-round.md`), once, only when the report has an `unresolved`
  finding. First the round copy (A-34): `pob2-check-run <runFolder>
  --snapshot <n> --build <id>`, `<n>` that report's number. Then each finding goes to its `owner`: D1 (D1-finish,
  and D1-build, D1-tree and D1-finish when D1-finish returns `build: <ids>`), D2, and W1 last. Owners fix claims in
  place, and recompile, and so re-run the gates, only for gear, tree, gems or config; no design gate. Re-render
  `audit.md` before W1.
- **Step 13, the re-check** (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/fix-round.md`): `pob2-check-run <runFolder> --changed <n> --build <id>`,
  then one verifier, `check: "recheck"`, `changed` the lines it printed, verbatim. It re-checks only those, whether
  or not an owner recompiled: no re-check covers every claim (D-352). **One more round** (D-482), behind an `ask`
  (`open-finding`) on a finding left open that needs gear: `round`, one fix round and `V4-recheck` once a build.
- **Step 14, known issues** (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/fix-round.md`): replace both `Known issues` lists whole with the last
  report's open findings and W1's accepted-finding lines, reading only the lines you edit. Then **the notes**
  (D-487), every cycle: `pob2-render-notes <runFolder> --build <id>`, then `mcp__pob2__compile_plan {plan_path,
  notes_path: "<runFolderRel>/<buildFolder>/notes.txt"}`; a refusal (the file changed on disk) is told and left.
- **Step 16, the final gate** (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`). Print its display, `display final --build <id>` (each
  rung's final figures, D-369, and the checker's result among them), whoever answers (Hard rules); answers (checkpoint
  `final`, its `concept` the card id): **accept** (`completed`); **accept, then verification** (`accept:verification`:
  `completed`, and once the queue is empty the verification gate again, for more cards); **campaign** (`campaign`:
  `completed` with its endgame guide, then its campaign, §7, and back here); **ask for changes**; or **decline**
  (`decline:<note>`, the build ends `not-accepted`). Asking for changes is a revision (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/fix-round.md`): the
  round copy, the owners' chain, then step 13's re-check: **a revision runs no full pass** (D-352); a one-item swap
  runs D1-finish (`swap`), the D1 gate, F1, W1's patch and the re-check (D-481). Steps 12 to 16
  then follow as after a full pass. Once the build ends: the next queued card's design, else the verification gate
  when an answer asked for it, else the run's end (§8). A default `stop` ends the run, the queued cards `stopped`.

## 7. The campaign, and a resume's answers (steps 9a and 9b; D-415)

- **A build's campaign**, from its final gate's `campaign` or a resume's `campaign:<id>`, runs the chain in
  `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/fix-round.md`, "A build's campaign": D2 (9a) and the D2 gate (9b), whose `buildName` is the session
  name and ` (campaign)`, with `firstFree` on its first write (D-466; an older build's adds `-campaign`).
- **A resume's answers** at the verification gate, each naming one build (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`):
  `guide:<id>`, a `file-only` build (log it `writing`, the render, W1, V4's full pass, steps 12 to 16);
  `campaign:<id>`, a `completed` or `file-only` build's campaign; `design:<id>`, a `stopped` or `dropped` build whose
  last D1 gate passed (log it `designing`; its design gate again from that verdict; F1 checks the plan is unchanged).

## 8. Finish

1. Set the run's `status` with `pob2-run-log <runFolder> set`, the run log's last write: `completed` when any build
   ended `completed` or `file-only`, else the last build's end, or `stopped` when no card was finalized. Each
   build's status, guide and PoB file are in `builds[]` already; no import code, whose one home is the record (D-260).
2. Run the run checker at step 15 and once more after the run log's last write (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/run-folder.md`).
3. Tell the user: the run folder; per build, its guide, its PoB file and where its import code is (the guide's
   `Your PoB file`, and `compile-record.json`), its status and its known issues (a file-only build's: its claims
   pass's open findings, each one's `reader` sentence, D-477); and each violation the checker printed.

## Other references

`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/pricing.md`, `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/offline-and-test.md`, `${CLAUDE_PLUGIN_ROOT}/skills/game-knowledge/references/source-markers.md`, `${CLAUDE_PLUGIN_ROOT}/skills/game-knowledge/references/lookups.md`,
`${CLAUDE_PLUGIN_ROOT}/skills/game-knowledge/references/patterns.md` (C-53), the design's targets `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/toughness-targets.json` (D-441) and
`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/boss-floor.json` (D-448), corruption's cheap line `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/corruption.json` (D-471),
`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/stages/`, `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/templates/card-template.md` (C-52) and `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/scripts/`.
