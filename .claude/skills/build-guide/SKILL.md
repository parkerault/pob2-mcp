---
name: build-guide
description: Build a Path of Exile 2 build and its guide from an open brief, through the pob2 MCP server. Brainstorm a deck of candidate builds, verify the ones the user picks, let the user finalize 1 to 3 of them, then for each design and compile its endgame (entering maps, budget and non-budget), write its endgame guide (level with any build of the class, then switch) and verify its claims; on request, add a build's campaign for the full guide (level 1 through the campaign to the endgame). Use when the user runs /build-guide <free text> [--offline [--test <path>]] [--no-ninja], the fixed roll /build-guide <ascendancy> <skill> included, resumes a run with /build-guide --resume <run folder> or --campaign <run folder> <card id>, or asks for a build guide.
---

# build-guide

You are the **runner**: you start the run, call one agent per step with the Agent tool, interview the user at
the gates, keep the run log and run the run checker (slice 03 of `docs/build-guide/spec/`, with its amendments).

## After a compaction (D-420): read this first

A compaction keeps at most part of this skill and none of its references. If this session was just compacted
during a run, before your next step or answer:
1. Re-read `.claude/skills/build-guide/SKILL.md` whole, the run's `run-log.json`, the current step's reference and, at a gate, the visit's notes (`interviews/<gate>-<visit>.md`, with its `## Pending decision`).
2. At a gate, print its display again with `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> display <gate> [--build <id>]` (the design and final gates take `--build <id>`, the build at the gate), which records no second visit.
3. Act on no yes the notes don't hold: a yes you remember that the notes don't record isn't one, so restate the pending decision and wait for it.

The run session's `SessionStart` hook prints the same rule after every compaction (`compact-reminder.sh`, D-420).

The run has **three phases, each ending at a gate the user answers** (D-287): the brainstorm (gate `brainstorm`),
the verification (gate `verification`) and the finalization (gate `final`). The verification gate finalizes 1 to 3
cards (D-411); each becomes a **build** with its own folder, `builds/<id>/` (D-412), and the builds run in turn:
its design, the design gate (gate `design`, D-362), which shows the user its endgame before anything else is
written, its final compile (F1), its **endgame guide**, checks and final gate. A build's **full guide**, with the
campaign, comes only on request (D-415). Only the user starts a round. Every card names its **named damage
source**, the main source of damage, never a token role (D-122 as D-295 words it). Each step below is a short
card: read a reference only where its card names one.

## Hard rules (for you and for every agent)

- **Never read, print or copy any `.env` file**, and never set `POESESSID`.
- **Never contact pathofexile.com or poe.ninja yourself**: no WebFetch, WebSearch or Bash to them. There are no
  poe.ninja tools beyond the currency rates (`mcp__pob2__get_currency_rates`, D-335) and no player evidence.
- **No trade request after pricing stops** (D-415, D-422). Pricing stops for the session at a `locked_out` or
  `rate_limited` call: a `stages[]` entry after the last resume (from `resumes[<last>].lengths.stages`; every
  entry when the log has no resume) whose `priceOutcomes` counts one. From then on, tell every coordinator step
  that pricing has stopped: no step calls a tool that sends a trade request (`mcp__pob2__get_leagues`,
  `mcp__pob2__get_item_price` for an item, `mcp__pob2__search_trade_items`, `mcp__pob2__search_stats`,
  `mcp__pob2__find_upgrades`). `mcp__pob2__trade_query_options` sends none, and `mcp__pob2__get_item_price` for a
  Distilled Emotion reads poe.ninja's currency exchange (not with `--no-ninja`), so both stay allowed.
- **Write only inside the run folder**: the `Known issues` lists (step 14) and the interview notes; by script the
  run log, the round copy and `audit.md`; each agent its header's `writes`.
- **Your pob2 tools** are `mcp__pob2__get_classes`, `mcp__pob2__lookup_game_data` and
  `mcp__pob2__search_tree_nodes` for the brief check (the last for the ascendancy lock, D-342; the last two, with
  `mcp__pob2__check_model_coverage`, at a gate, D-390), `mcp__pob2__guide_run {new_run}` (FR-W3), and
  `mcp__pob2__guide_run {resume: <run folder>}` for a resume (D-415): no engine call and nothing written, its reply
  `Resuming run folder <abs>`, `runFolderRel: <rel>` and `loadedBuildUnsaved: …`. Every compile, engine change and
  price call is a coordinator step's.
- **Agents run only through the Agent tool, as one of the four build-guide types**, named in `subagent_type`.
- **Every gate visit prints its display first, in your reply, whoever answers it** (D-265, D-367): the user, a
  pre-supplied answer or a default, at the brainstorm, verification, design and final gates and at an escalation.
  `run-log.mjs <runFolder> display <gate>` prints it (with `--build <id>` at a build's design and final gates);
  then resolve and log the answer (`checkpoint` refuses a visit with no display). A pre-supplied or default answer
  replaces only the question: after the display, state the answer it resolved to, as in `Test config: first-n:2 →
  verify r1-a-1, r1-b-1` (`references/checkpoints.md`).
- **Every gate visit and escalation is an interview** (D-389, D-390), never an AskUserQuestion: answer every
  question before any decision, from the card and research files, your lookups, or a gate question step (stage
  `Q`) after one line saying what you start and why, without asking first. Then restate the decision by the
  cards' names and wait for a yes. A question is never a decision. Write the visit's notes after each answer, and
  the restated decision, the user's words verbatim, under `## Pending decision` before you ask for the yes; log
  the checkpoint from the notes (D-420, `references/checkpoints.md`).
- **Read only what routes the run:** the gate verdict files under `reports/gates/` (the D1 gate's holds the design
  gate's display), the deck `cards.md`, `run-log.json`, the test config, the agents' returns, the verifiers' reports,
  the digest's first lines (§1), and at a gate the card and research files (D-390). Never read `plan.json`, a compile
  record, `dossier.md` or `guide.md`, with Read or with Bash; step 14 reads only the `Known issues` lines it edits.
- **Your Bash reads, and runs the run checker and the two scripts; nothing else** (D-265). The whole list:
  - `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq`, alone or piped into one another (`cd` before them is fine),
    each with no redirection (`>`, `>>`, `<`), no `tee`, no flag that writes a file (`-o`, `-i` or `-delete` where
    the tool writes with it), and no command substitution (`$(…)`, backticks) feeding another tool;
  - the run checker, `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`, with `--changed <n>`
    for a re-check's set (step 13), and with `--snapshot <n>` for the round copy (step 12, A-34), each with
    `--build <id>`, the build's folder (D-412);
  - the audit render, `node .claude/skills/build-guide/scripts/render-audit.mjs <runFolder> --build <id>` (D-355);
  - the run log, `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> <kind> - <<'JSON'`, the entry, `JSON` (D-356),
    its migration, `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> migrate` (D-415),
    a gate's display, `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> display <gate>` (D-367),
    and `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> test-config <path>` (D-394).

  Nothing else: no other `node` call (`node -e` included), no `git`, `find`, `sort`, `sed`, `awk`, network
  client (`curl`, `wget`, `nc`, `ssh`) or host, and nothing else that writes, moves or deletes a file. Write
  every other file with Write (or Edit), never with Bash. The agents have no Bash at all.
- **Legacy means not in the game** (D-395): no build uses a gem PoB marks legacy or a unique PoB says is no
  longer obtainable. `Tier = 0` alone isn't legacy.

## Calling an agent

```
Agent({subagent_type: "build-guide-coordinator", description: "D1-build r1-a-2 attempt 1", prompt: "<header, then the reference line>"})
```

- **The prompt** is the task header (`references/task-header.md`), a fenced `json` block, then `Read
  .claude/skills/build-guide/references/stages/<stage>.md and do that step.` Add only what the card lists. A
  build's steps carry its folder, `buildFolder` (`builds/<id>`, or `.` for a build migrated from schema 3), and
  their `writes` under it.
- **In flight:** at most 3 agents at once; a coordinator step never overlaps another agent (FR-W3). R1a's
  researchers and a gate's research questions run in parallel, `run_in_background: true`; any other step alone.
- **Returns.** At most 8 lines. A gate step's verdict is its file under `reports/gates/`, and the verifier
  writes its own report, `<buildFolder>/reports/V4-<n>.md`, and never overwrites one (R-5 as D-352 amends it):
  route on that file. An agent returning without its file is re-run once, uncounted, logged `missing`; a second
  miss ends the run `stopped`. A verifier's `exists: reports/V4-<n>.md` is a missing return: re-run at the next
  free `<n>`.
- **A refused call** (D-421; `references/gates.md`, "The refused route"). Claude Code's permission system can
  refuse a tool call inside a step. The step stops and returns `refused: <tool>`; a gate step's verdict file has
  the part the call served `unverified` with code `tool-refused`. On that line or that code, log the step with
  outcome `refused`, ask the user to allow the tool, then re-run the step alone, next, uncounted: it routes to no
  producer and spends no retry.
- **The run log.** Add each step's, gate's and question's entry with `run-log.mjs` (`references/run-log.md`), and
  each build's status as it changes (`build`).

The verifier's prompt is always exactly this, so it carries nothing a producing step wrote (R-5, D-142):

````
```json
<the task header: stage V4, its check and writes>
```
Read .claude/skills/build-guide/references/stages/V4.md and do that step.
````

## The steps

| # | Step | Agent type | Writes | Returns, user, retries |
|---|---|---|---|---|
| 1 | Start (§1) | you | `run-log.json` | parses and checks the brief, or resumes a run (§7); asks the user when `loadedBuildUnsaved` (D-210) |
| 2a | R1a, brainstorm round *k* | `build-guide-researcher`, ≤ 3 in parallel, lettered `a`, `b`, `c` | `research/p<k>-r1a-<n>.md`; 3 cards `cards/r<k>-<letter>-<m>.md`, their brainstorm halves | its files and its cards' names |
| 2b | R1a-assemble | `build-guide-coordinator` | `cards.md` | the deck's counts: dealt, not dealt, under-played; `short: <why>` for a short round |
| 2c | The brainstorm gate (§2) | you | log | asks the user: verify 1–3 cards (step 3), brainstorm more (step 2a, round *k*+1) or stop |
| 3 | R1b, one picked card at a time, ≤ 3 per verification round | `build-guide-coordinator` | `concepts/<id>/plan.json`, `reports/gates/R1b-<id>-a<n>.json`, `cards/<id>.md` (a gate's edit to its brainstorm half, or a gate-made card whole, then its verification half), `probes/<id>/<p>/` | compiled or not; a compile failure re-runs, ≤ 2 counted retries, then the card is `failed` |
| 4a | R1b-assemble | `build-guide-coordinator` | `dossier.md`; a gate-made card's line in `cards.md` | the verification gate's comparison, one line per card |
| 4b | RV, the rival, once per run (§3) | `build-guide-researcher` | `cards/r<k>-x-<n>.md` | its card, or `none-found` with what it tried |
| 5 | The verification gate (§3) | you | log | asks the user: finalize 1–3 cards, in their order (step 6a for the first), verify other cards (step 3), brainstorm more (step 2a) or stop; after a resume, a build's guide, campaign or design gate (§7) |
| 6a | D1-build, the endgame rungs | `build-guide-coordinator` | `plan.json` (its endgame stages, `skills.main.statSet` set) | `done` or `infeasible` |
| 6b | D1-tree, the travel | `build-guide-coordinator`, fresh | `plan.json` (the rungs' trees and needs) | `done`, each rung's travel; `unspent:` lines |
| 6c | D1-finish | `build-guide-coordinator`, fresh | `plan.json` (the anoint, prices, ledger and claims) | `done`; its price calls by outcome |
| 7a | D1-gate | `build-guide-coordinator`, fresh | `reports/gates/D1-gate-<c>-a<n>.json`, with the design display; `plan.json` (FI-2 and the final re-price pass) | one verdict line; route by §4 |
| 7b | The design gate (§4) | you | log | asks the user: accept (step 8, then the guide), the PoB file only (step 8), revise (D1 again), verification (step 5) or stop |
| 8 | F1, the final compile | `build-guide-coordinator`, fresh | `reports/gates/F1-<c>-a<n>.json`; the PoB file through the server | one verdict line; a fault re-runs once, uncounted, then escalates |
| 9a | D2, the campaign, on request (§7) | `build-guide-coordinator` | `plan.json` (its campaign stages) | `done` |
| 9b | D2-gate and the campaign's final compile | `build-guide-coordinator`, fresh | `reports/gates/D2-gate-<c>-a<n>.json`; the `-campaign` PoB file through the server | one verdict line; a failure re-runs D2, ≤ 2 counted retries, then escalates |
| 10 | W1, the guide and the audit layer | `build-guide-writer` | `guide.md`, `audit.md` | at most 8 lines, with its `known-issues-line` and `audit-known-issues-line` |
| 11 | V4, one full pass | `build-guide-verifier`, one, no lenses | its own report, `reports/V4-<n>.md` | at most 8 lines: the report and its verdict |
| 12 | Fix round, once, only with open findings, uncounted | the owners: D1, D2, W1 | their own files: claims edited in place, a `hinge: no` statement removed or narrowed; a compile only for a build change | the ids fixed, the locations changed, and whether it recompiled |
| 13 | V4 re-check | `build-guide-verifier`, one: only what `check-run.mjs --changed <n>` lists | its own report, `reports/V4-<n>.md` | at most 8 lines: the report and its verdict; no further round |
| 14 | Known issues | you | each open finding's `reader` sentence, into `guide.md`'s `Known issues`, and its row into `audit.md`'s | — |
| 15 | Run checker | you: `display final` runs it | — | its result, in the final gate's display (step 16) |
| 16 | The final gate (§6) | you | log | asks the user: accept, accept and finalize more cards, add the campaign (step 9a), ask for changes (a revision), or decline |

A build's `plan.json`, record, `guide.md`, `audit.md`, V4 reports and round copies are in its folder,
`<buildFolder>/` (D-412); the gate verdicts stay in the run folder's `reports/gates/`, named by card id.

**Retries.** The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each; F1 re-runs once on a fault,
uncounted, and its second failure escalates (D-413). Uncounted: an attempt failed by a fault directive on attempt
1 only (a persistent one's count: S6), a guided retry, the fix round, a revision, the design gate's `revise:`, the
re-run after a missing return, a refused step's re-run (D-421), and the D1 gate's lone re-run after a `tool-error`
(D-419). The D1 gate, the D2 gate and F1 escalate; verification never re-checks beyond one re-check after a fix
round or a revision.

## 1. Start (step 1)

Read `references/start.md` and do it, in its order, before any agent runs; its last step prints the league digest's
staleness line, `head -3 data/league/<newest>.md`, the newest by fetch date (D-400). `init` records `--no-ninja` as
`noNinja`, and a resume replaces it with its session's (D-412, D-420): read it from `run-log.json` for every pricing
step, the D1 gate included, which then prices without currency rates (D-333). No Agent tool: the run stops (D-344).

**A resume** (D-415; `references/start.md`, "Resuming a run", has its order): `/build-guide --resume <run folder>`
goes on with an earlier run in its own folder, and `--campaign <run folder> <id>` resumes it and answers
`campaign:<id>`: `mcp__pob2__guide_run {resume}`, `migrate` for a schema-3 log, `resume` with this session's
`noNinja`, the unsaved-build question once per resume, then the verification gate (§3, §7). The brief check doesn't
run again.

## 2. Brainstorm (steps 2a to 2c)

- **R1a** (2a), round `k`: three researchers, foci `mechanics`, `items` and `tree`, which you letter `a`, `b` and `c`
  when you start them, so parallel researchers never collide (D-319). Prompt: the brief, the focus and letter (to
  `b`, a reference build the user named, for a seed card, D-393), and in a later round the user's note.
- **R1a-assemble** (2b), after the round's researchers. Prompt: the round, the brief, the user's note, and each
  researcher's letter, research file, cards and whether it returned. **A short round**: it returns `short: <why>`;
  record the reason in the run log, as `shortReason` on its `stages[]` entry, whole for one engine (D-405).
- **The brainstorm gate** (2c; `references/checkpoints.md`). Print its display, `display brainstorm` (the brief,
  then the deck), whoever answers (Hard rules). Answers: **verify** 1–3 cards, picked or made at the gate (step
  3); **brainstorm more** with the user's note (2a, round `k + 1`; only this answer starts one); **stop**.

## 3. Verification (steps 3 to 5)

- **R1b** (3), the picked cards, then the new ones, in order, one at a time; `concept` the card id, `changes` its
  gate change (D-391). A failed compile, or a gate change that breaks the card, re-runs with that verdict as
  `findings`, the user's words kept, up to 2 counted retries; then the card is `failed` (D-141). FI-1 applies here. A
  card whose damage source isn't a skill (a minion's skill is one, D-379) compiles nothing (D-334): the card's status
  is "can't be finalized yet: its damage source isn't a skill" (D-303), never `failed`; one on an entry the PoB pin
  lacks, "waits on the pin" (`not-in-pin`, D-400). A card whose ascendancy doesn't own the node that grants its skill
  compiles nothing either (D-342): its verdict's `wrong-ascendancy` finding is never retried, and the card is
  `failed`, as is a rival's card R1b doesn't deal (`not-dealt`, D-408).
- **R1b-assemble** (4a). Prompt: the verification round, the research files (and whether each researcher
  returned), and each card `{id, name, status, attempts, verdict}`. Once it wrote `dossier.md`, log the run's
  `dossier` with `set`.
- **RV, the rival** (4b; D-408), once per run, after the first verification round's R1b-assemble: one
  `build-guide-researcher`, its prompt the brief and its card id `r<k>-x-<n>`, nothing from the run's research,
  cards or interviews. On `done`, R1b for its card, outside the round's 3, then R1b-assemble for its row alone;
  on `none-found`, log its `tried`. Then the gate. On request at a gate: `references/checkpoints.md`.
- **The verification gate** (5; `references/checkpoints.md`). Print its display, `display verification`, whoever
  answers (Hard rules). Answers: **finalize** 1–3 cards (`pick:<id>[,<id>…]`, D-411), in the user's order, each with
  its revision in `changes`: not a card that can't be finalized yet, nor a `not-dealt` rival, nor a
  `wrong-ascendancy` card, failed or not, since the build it describes can't exist, D-342; nor a card that already
  has a build in the run (a second design of it is a `revise:` at its design gate, or a new card made from it);
  **verify other cards**; **brainstorm more**; or **stop**. After a resume, also `guide:<id>`, `campaign:<id>` and
  `design:<id>` (§7). Every route back from a design comes here: an `infeasible` design, an escalation's option 3,
  the design gate's `verification`, and FI-3.
- **The queue** (D-411). Log each finalized card's build with `run-log.mjs <runFolder> build`, `{"id", "roll":
  {className, ascendancy, skill}, "status": "queued"}`, the card's identity (D-286); new builds go ahead of the
  cards still queued. The builds run in turn, one loaded build (FR-W3): a card's design (§4), F1, its guide,
  checks and final gate (§6), then the next. A visit here from a build's route keeps the cards still queued: they
  resume after the visit, behind any card it finalizes, and the visit's `stop` ends them `stopped`. Log each
  build's `status` as it moves (`references/run-log.md`, "Builds").

## 4. Design (steps 6a to 8; `references/gates.md`)

One build at a time, the first queued card's, in its folder. D1 is **three agent steps** (D-356, D-418):
D1-build, D1-tree, then D1-finish, each a fresh coordinator step. Every design attempt (fresh, or a gate retry)
runs all three, in that order; a change to the tree alone (the gate's `tree-swap`, the user's tree request) runs
D1-tree, then D1-finish.

- **D1-build** (6a): prompt, write `plan.json` anew (attempt 1 of a fresh design) or edit it; `findings`, the
  last D1 gate verdict on a retry, or a finalize's revision. Returns `done` or `infeasible`, with a reason, and
  its `for D1-tree:` line.
- **D1-tree** (6b): prompt, D1-build's `for D1-tree:` line as it returned it, when D1-build ran before it;
  `findings`, a `tree-swap` verdict or the user's tree request. Returns each rung's travel, `unspent:` lines, and a
  `not made:` line for each tree change the user asked for that it couldn't make: print those under the design
  gate's display, so the user hears it.
- **D1-finish** (6c): prompt, how to price (offline; stopped, Hard rules; or paced), no currency rates when the
  log's `noNinja` is true, D1-tree's `unspent:` lines as it returned them, and D1-build's `left out:` lines, with
  its `lever unpulled:` and `override:` lines (D-406, D-407). Log its `priceOutcomes`.
- **The D1 gate** (7a), fresh after every D1. Route by its verdict file and D1-build's claim, by the table in
  `references/gates.md`, "The D1 gate's outcome": compiled, V1, V2, floor, `rolledSkill` and tree pass, budget pass
  or unverified: the design gate (7b); a failure re-runs the D1 steps the table names, up to 2 counted retries, then
  escalates (§5); `infeasible`, back to the verification gate with the verdict as evidence. Log each gate attempt
  with the outcome its verdict file routes to; the run checker holds the log to the files.
- **The design gate** (7b; D-362; `references/checkpoints.md`). Print its display, `display design --build <id>`
  (the D1 gate verdict file's `design` field, A-35), whoever answers (Hard rules). Answers (checkpoint `design`,
  `concept` the card id): **accept**, F1 (step 8), then the endgame guide; **file only** (`accept:file`), F1 alone:
  the build ends `file-only`; **revise** (`revise:<text>`), D1 again from the step the change needs
  (`references/checkpoints.md`), with the text as `findings` (`code: "user-request"`), then the D1 gate and this
  gate again; **verification**: the build ends `dropped`, step 5; **stop**: the build ends `stopped`, the next queued
  card's design next. A default `stop` (`answers.design[]` used up) ends the run, the queued cards `stopped`.
- **F1** (8; D-413; `stages/F1.md`), fresh, after the design gate's `accept` or `accept:file`: header `compile:
  "final"`, `buildName`, and `accepted` (this build's accepted findings); its prompt names the passing D1 gate's
  verdict file. `buildName` is `<slug>-<YYYY-MM-DD>-<n>-<id>`, the run folder's last two segments and the card id
  joined with `-` (D-412); a migrated build in `.` keeps `<slug>-<YYYY-MM-DD>-<n>`. Route by its verdict file
  (`references/gates.md`, "F1's outcome"): a pass logs the build's `pobFile` (the verdict's `finalCompile.pobFile`),
  then after `accept` renders `audit.md` (`render-audit.mjs <runFolder> --build <id>`, D-355) and runs W1, after
  `accept:file` ends the build `file-only`; a fault re-runs F1 once, uncounted, then escalates (§5);
  `ledger-refused` escalates at once.

## 5. Gate escalations (`references/checkpoints.md`; D-236)

The D1 gate, F1 and the D2 gate escalate, each for its build (D-411). Record `{stage, concept, verdict, choice,
guidance?}` and checkpoint `escalation`. Print its display, `display escalation`, whoever answers (Hard rules);
answers: 1. **accept** (not after a compile failure, nor F1's ledger refusal), the failing findings into the
later headers' `accepted` of **that build's** steps only, going on as if the gate passed (the D2 gate and F1 run
once more, uncounted); 2. **guidance and one more retry**: the producer (D1 or D2; after F1, D1, its gate and the
design gate again, then F1) gets one more attempt, uncounted, with the verdict and the user's guidance in
`findings`, then its gate. If the gate fails, whatever part fails, it escalates again; 3. **back to the
verification gate** (the choice `verification`): the build ends `dropped`; 4. **stop**: the build ends
`escalated`, the next queued card's design next. After F1's ledger refusal the user can also restore or remove the
changed PoB file and answer accept: F1 runs again and accepts no finding.

## 6. Write, verify and the final gate (steps 10 to 16)

Each build's own: its folder's guide, audit and reports, its V4 reports numbered apart from the other builds'.

- **W1** (10): `accepted` that build's accepted gate findings; its prompt names the last D1 gate verdict file. It
  writes the template its plan decides (D-414): the endgame guide for a plan with no campaign stage, the full
  guide after D2. Log the build's `guide`, `endgame` or `full`, with `build` when it returns.
- **Step 11, the full pass.** Start one verifier (D-352), `check: "full"`, `findings: []` and `writes:
  ["<buildFolder>/reports/V4-<n>.md"]`. `<n>` is always one more than the highest `reports/V4-<n>.md` the build's
  folder holds (`ls <runFolder>/<buildFolder>/reports`), 1 for the build's first. One pass with no lenses: it
  checks every hinge claim of `plan.json` against its source and reads every H2 of `guide.md` as an editor, with
  no sampling; the ledger's arithmetic is the run checker's.
- **Step 12, the fix round** (`references/fix-round.md`), once, only when the report has an `unresolved`
  finding. First the round copy (A-34): `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>
  --snapshot <n> --build <id>`, `<n>` that report's number. Then each finding goes to its `owner`: D1 (D1-finish,
  and D1-build, D1-tree and D1-finish when D1-finish returns `build: <ids>`), D2, and W1 last. Owners fix claims in
  place, and recompile, and so re-run the gates, only for gear, tree, gems or config; no design gate. Re-render
  `audit.md` before W1.
- **Step 13, the re-check** (`references/fix-round.md`): `check-run.mjs <runFolder> --changed <n> --build <id>`,
  then one verifier, `check: "recheck"`, `changed` the lines it printed, verbatim. It re-checks only those, whether
  or not an owner recompiled: no re-check covers every claim (D-352).
- **Step 14, known issues** (`references/fix-round.md`): replace both `Known issues` lists whole with the last
  report's open findings and W1's accepted-finding lines, reading only the lines you edit.
- **Step 16, the final gate** (`references/checkpoints.md`). Print its display, `display final --build <id>` (each
  rung's final figures, D-369, and the checker's result among them), whoever answers (Hard rules); answers
  (checkpoint `final`, its `concept` the card id): **accept** (`completed`); **accept, then verification**
  (`accept:verification`: `completed`, and once the queue is empty the verification gate again, for more cards);
  **campaign** (`campaign`: `completed` with its endgame guide, then its campaign, §7, and back here); **ask for
  changes**; or **decline** (`decline:<note>`, the build ends `not-accepted`). Asking for changes is a revision
  (`references/fix-round.md`): the round copy, the owners' chain, then step 13's re-check: **a revision runs no
  full pass** (D-352). Steps 12 to 16 then follow as after a full pass. Once the build ends: the next queued card's
  design, else the verification gate when an answer asked for it, else the run's end (§8). A default `stop` ends
  the run, the queued cards `stopped`.

## 7. The campaign, and a resume's answers (steps 9a and 9b; D-415)

- **A build's campaign**, from its final gate's `campaign` or a resume's `campaign:<id>`, runs the chain in
  `references/fix-round.md`, "A build's campaign": D2 (9a) and the D2 gate (9b), whose `buildName` adds `-campaign`.
- **A resume's answers** at the verification gate, each naming one build (`references/checkpoints.md`):
  `guide:<id>`, a `file-only` build (log it `writing`, the render, W1 with the endgame template, V4's full pass,
  steps 12 to 16); `campaign:<id>`, a `completed` or `file-only` build's campaign, which `--campaign <run folder>
  <id>` answers; `design:<id>`, a `stopped` or `dropped` build whose last D1 gate passed (log it `designing`; its
  design gate again from the existing verdict file, its answers as in §4; F1 checks the plan is unchanged).

## 8. Finish

1. Set the run's `status` with `run-log.mjs <runFolder> set`, the run log's last write: `completed` when any build
   ended `completed` or `file-only`, else the last build's end, or `stopped` when no card was finalized. Each
   build's status, guide and PoB file are in `builds[]` already; no import code, whose one home is the record
   (D-260).
2. Run the run checker at step 15 and once more after the run log's last write (`references/run-folder.md`).
3. Tell the user: the run folder; per build, its guide, its PoB file and where its import code is (the guide's
   `Your PoB file`, and `compile-record.json`), its status and its known issues; and each violation the checker
   printed.

## Other references

`references/pricing.md`, `references/offline-and-test.md`, `references/source-markers.md`, `references/lookups.md`,
`references/patterns.md` (C-53), `references/stages/`, `templates/card-template.md` (C-52) and `scripts/`.
