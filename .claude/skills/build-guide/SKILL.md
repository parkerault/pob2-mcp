---
name: build-guide
description: Build a Path of Exile 2 guide (level 1 through the campaign to two endgame variants) and a PoB2 build from an open brief, through the pob2 MCP server. Brainstorm a deck of candidate builds, verify the ones the user picks, let the user finalize one, then design and compile the plan, write the guide and verify its claims. Use when the user runs /build-guide <free text> [--offline [--test <path>]] [--no-ninja], the fixed roll /build-guide <ascendancy> <skill> included, or asks for a build guide.
---

# build-guide

You are the **runner**: you start the run, call one agent per step with the Agent tool, ask the user at the
gates, keep the run log and run the run checker (slice 03 of `docs/build-guide/spec/`, with amendments 1 to 4).

The run has **three phases, each ending at a gate the user answers** (D-287): the brainstorm (gate `brainstorm`),
the verification (gate `verification`) and the finalization (gate `final`). Inside the finalization, the design
gate (gate `design`, D-362) shows the user the endgame build before the campaign and the guide exist. Only the user
starts a round. Every card names its **named damage source**, the main source of damage, never a token role (D-122
as D-295 words it). Each step below is a short card: read a reference only where its card names one.

## Hard rules (for you and for every agent)

- **Never read, print or copy any `.env` file**, and never set `POESESSID`.
- **Never contact pathofexile.com or poe.ninja yourself**: no WebFetch, WebSearch or Bash to them. There are no
  poe.ninja tools beyond the currency rates (`mcp__pob2__get_currency_rates`, D-335) and no player evidence.
- **Write only inside the run folder**: the `Known issues` lists (step 14), and by script the run log, the round
  copy and `audit.md`; each agent its header's `writes`.
- **Your pob2 tools** are `mcp__pob2__get_classes`, `mcp__pob2__lookup_game_data` and
  `mcp__pob2__search_tree_nodes` for the brief check (the last for the ascendancy lock, D-342), and
  `mcp__pob2__guide_run {new_run}` (FR-W3). Every compile, engine change and price call is a coordinator step's.
- **Agents run only through the Agent tool, as one of the four build-guide types**, named in `subagent_type`.
- **Every gate visit prints its display first, in your reply, whoever answers it** (D-265, D-367): the user, a
  pre-supplied answer or a default, at the brainstorm, verification, design and final gates and at an escalation.
  `run-log.mjs <runFolder> display <gate>` prints it; then resolve and log the answer (`checkpoint` refuses a visit
  with no display). A pre-supplied or default answer replaces only the question: after the display, state the answer
  it resolved to, as in `Test config: first-n:2 → verify r1-a-1, r1-b-1` (`references/checkpoints.md`).
- **Read only what routes the run:** the gate verdict files under `reports/gates/` (the D1 gate's holds the
  design gate's display), the deck `cards.md`, your own `run-log.json`, the test config, the agents' returns and
  the verifiers' reports. Never read `plan.json`, a compile record, `dossier.md` or `guide.md`, with Read or
  with Bash; step 14 reads only the `Known issues` lines it edits.
- **Your Bash reads, and runs the run checker and the two scripts; nothing else** (D-265). The whole list:
  - `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq`, alone or piped into one another (`cd` before them is fine),
    each with no redirection (`>`, `>>`, `<`), no `tee`, no flag that writes a file (`-o`, `-i` or `-delete` where
    the tool writes with it), and no command substitution (`$(…)`, backticks) feeding another tool;
  - the run checker, `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`, with `--changed <n>`
    for a re-check's set (step 13), and with `--snapshot <n>` for the round copy (step 12, A-34);
  - the audit render, `node .claude/skills/build-guide/scripts/render-audit.mjs <runFolder>` (D-355);
  - the run log, `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> <kind> - <<'JSON'`, the entry, `JSON` (D-356),
    and a gate's display, `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> display <gate>` (D-367).

  Nothing else: no other `node` call (`node -e` included), no `git`, `find`, `sort`, `sed`, `awk`, network
  client (`curl`, `wget`, `nc`, `ssh`) or host, and nothing else that writes, moves or deletes a file. Write
  every other file with Write (or Edit), never with Bash. The agents have no Bash at all.

## Calling an agent

```
Agent({subagent_type: "build-guide-coordinator", description: "D1-build r1-a-2 attempt 1", prompt: "<header, then the reference line>"})
```

- **The prompt** is the task header (`references/task-header.md`), a fenced `json` block, then `Read
  .claude/skills/build-guide/references/stages/<stage>.md and do that step.` Add only what the card lists.
- **In flight:** at most 3 agents at once; a coordinator step never overlaps another agent (FR-W3). R1a's
  researchers run in parallel with `run_in_background: true`; every other step runs alone.
- **Returns.** At most 8 lines. A gate step's verdict is its file under `reports/gates/`, and the verifier
  writes its own report, `reports/V4-<n>.md`, and never overwrites one (R-5 as D-352 amends it): route on that
  file. An agent returning without its file is re-run once, uncounted, logged `missing`; a second miss ends the
  run `stopped`. A verifier's `exists: reports/V4-<n>.md` is a missing return: re-run at the next free `<n>`.
- **The run log.** Add each step's, gate's and question's entry with `run-log.mjs` (`references/run-log.md`).

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
| 1 | Start (§1) | you | `run-log.json` | parses and checks the brief; asks the user when `loadedBuildUnsaved` (D-210) |
| 2a | R1a, brainstorm round *k* | `build-guide-researcher`, ≤ 3 in parallel, lettered `a`, `b`, `c` | `research/p<k>-r1a-<n>.md`; 3 cards `cards/r<k>-<letter>-<m>.md`, their brainstorm halves | its files and its cards' titles |
| 2b | R1a-assemble | `build-guide-coordinator` | `cards.md` | the deck's counts: dealt, not dealt, under-played; `short: <why>` for a short round |
| 2c | The brainstorm gate (§2) | you | log | asks the user: verify 1–3 cards (step 3), brainstorm more (step 2a, round *k*+1) or stop |
| 3 | R1b, one picked card at a time, ≤ 3 per verification round | `build-guide-coordinator` | `concepts/<id>/plan.json`, `reports/gates/R1b-<id>-a<n>.json`, `cards/<id>.md` (its verification half), `probes/<id>/<p>/` | compiled or not; a compile failure re-runs, ≤ 2 counted retries, then the card is `failed` |
| 4 | R1b-assemble | `build-guide-coordinator` | `dossier.md` | the verification gate's comparison, one line per card |
| 5 | The verification gate (§3) | you | log | asks the user: finalize one card, verify other cards (step 3), brainstorm more (step 2a) or stop |
| 6a | D1-build, the endgame rungs | `build-guide-coordinator` | `plan.json` (its endgame stages, `skills.main.statSet` set) | `done` or `infeasible` |
| 6b | D1-finish | `build-guide-coordinator`, fresh | `plan.json` (the anoint, prices, ledger and claims) | `done`; its price calls by outcome |
| 7a | D1-gate | `build-guide-coordinator`, fresh | `reports/gates/D1-gate-<c>-a<n>.json`, with the design display; `plan.json` (FI-2 and the final re-price pass) | one verdict line; route by §4 |
| 7b | The design gate (§4) | you | log | asks the user: accept (step 8), revise (D1 again), verification (step 5) or stop |
| 8 | D2, the campaign | `build-guide-coordinator` | `plan.json` (its campaign stages) | `done` |
| 9 | D2-gate and the final compile | `build-guide-coordinator`, fresh | `reports/gates/D2-gate-<c>-a<n>.json`; the PoB file through the server | one verdict line; a failure re-runs D2, ≤ 2 counted retries, then escalates |
| 10 | W1, the guide and the audit layer | `build-guide-writer` | `guide.md`, `audit.md` | at most 8 lines, with its `known-issues-line` and `audit-known-issues-line` |
| 11 | V4, one full pass | `build-guide-verifier`, one, no lenses | its own report, `reports/V4-<n>.md` | at most 8 lines: the report and its verdict |
| 12 | Fix round, once, only with open findings, uncounted | the owners: D1, D2, W1 | their own files: claims edited in place, a `hinge: no` statement removed or narrowed; a compile only for a build change | the ids fixed, the locations changed, and whether it recompiled |
| 13 | V4 re-check | `build-guide-verifier`, one: only what `check-run.mjs --changed <n>` lists | its own report, `reports/V4-<n>.md` | at most 8 lines: the report and its verdict; no further round |
| 14 | Known issues | you | each open finding's `reader` sentence, into `guide.md`'s `Known issues`, and its row into `audit.md`'s | — |
| 15 | Run checker | you: `display final` runs it | — | its result, in the final gate's display (step 16) |
| 16 | The final gate (§6) | you | log | asks the user: accept, ask for changes (a revision), or anything else |

**Retries.** The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each. Uncounted: an attempt
failed by a fault directive on attempt 1 only (a persistent one's count: S6), a guided retry, the fix round, a
revision, the design gate's `revise:`, and the re-run after a missing return. Only the D1 and D2 gates escalate;
verification never re-checks beyond one re-check after a fix round or a revision.

## 1. Start (step 1)

`/build-guide <free text> [--offline [--test <path>]] [--no-ninja]`. Read `references/start.md` and do it, in
its order, before any agent runs: the brief and its check, `mcp__pob2__guide_run {new_run: <slug>}`, the test
config and the run log's first write, and the unsaved-build question. With `--no-ninja` (D-333), tell every
pricing step, the D1 gate included, to price without currency rates. No Agent tool: the run stops (D-344).

## 2. Brainstorm (steps 2a to 2c)

- **R1a** (2a), round `k`: three researchers, foci `mechanics`, `items` and `tree`, which you letter `a`, `b`
  and `c` when you start them, so parallel researchers never collide (D-319). Prompt: the brief, the focus and
  letter, and in a later round the user's note.
- **R1a-assemble** (2b), after the round's researchers return. Prompt: the round, the brief, the user's note,
  and each researcher's letter, research file, cards and whether it returned. **A short round**: it returns
  `short: <why>`; record the reason in the run log, as `shortReason` on its `stages[]` entry, and say so.
- **The brainstorm gate** (2c; `references/checkpoints.md`). Print its display, `display brainstorm` (the brief,
  then the deck), whoever answers (Hard rules). Ask with AskUserQuestion in `multiSelect` mode, up to 4 cards a
  question and up to 3 questions, plus one question for more or stop: **verify** 1–3 cards (step 3);
  **brainstorm more** with the user's note (2a, round `k + 1`; only this answer starts one); **stop**.

## 3. Verification (steps 3 to 5)

- **R1b** (3), each picked card in order, one at a time; `concept` the card id. A failed compile re-runs with
  that verdict file as `findings`, up to 2 counted retries; then the card is `failed` (D-141). FI-1 applies
  here. A card whose damage source isn't a skill (a minion's skill is one, D-379) compiles nothing (D-334): the
  card's status is "can't be finalized yet: its damage source isn't a skill" (D-303), never `failed`. A card
  whose ascendancy doesn't own the node that grants its skill compiles nothing either (D-342): its verdict's
  `wrong-ascendancy` finding is never retried, and the card is `failed`.
- **R1b-assemble** (4). Prompt: the verification round, the research files (and whether each researcher
  returned), and each card `{id, title, status, attempts, verdict}`.
- **The verification gate** (5; `references/checkpoints.md`). Print its display, `display verification` (the
  dossier), whoever answers (Hard rules). Ask: **finalize** one card (its identity becomes the run's `roll`; not a
  card that can't be finalized yet, nor a `wrong-ascendancy` card, failed or not, since the build it describes can't
  exist, D-342); **verify other cards** (step 3); **brainstorm more** (2a); or **stop**. Every route back from the
  design comes here: an `infeasible` design, an escalation's option 3, the design gate's `verification`, and FI-3.

## 4. Design (steps 6a to 9; `references/gates.md`)

D1 is **two agent steps** (D-356): D1-build, then D1-finish, a fresh coordinator step. Every design attempt
(fresh, or a gate retry) runs both, in that order.

- **D1-build** (6a): prompt, write `plan.json` anew (attempt 1 of a fresh design) or edit it; `findings`, the
  last D1 gate verdict on a retry. Returns `done` or `infeasible`, with a reason.
- **D1-finish** (6b): prompt, how to price (offline; stopped, once any `stages[]` entry's `priceOutcomes` counts
  a `locked_out` or `rate_limited` call; or paced). Log its price outcomes as `priceOutcomes`.
- **The D1 gate** (7a), fresh after every D1. Route by its verdict file and D1-build's claim:
  - compiled, V1, V2, floor and `rolledSkill` pass, budget pass or unverified: the design gate (7b);
  - a compile, V1 or V2 failure: D1 re-runs with the verdict, up to 2 counted retries; the third escalates (§5);
  - any part but the budget `unverified` (only the budget may stay unverified, D-164): a failure, routed as a
    compile, V1 or V2 failure;
  - only floor or `rolledSkill` failing (the budget never fails, D-371): `infeasible`, back to the verification gate
    with the verdict as evidence, when D1-build claimed it; else D1 re-runs, up to 2 counted retries, then `infeasible`;
  - `"forced": "infeasible"` (FI-3): `infeasible`; after a guided retry or an accepted re-run, any failure
    escalates again. Log each gate attempt with the outcome its verdict file routes to; the run checker holds
    the log to the files.
- **The design gate** (7b; D-362; `references/checkpoints.md`). Print its display, `display design` (the D1
  gate verdict file's `design` field, A-35), whoever answers (Hard rules). Ask (checkpoint `design`):
  **accept**, on to step 8; **revise** (`revise:<text>`), a D1 fix round with the text as `findings` (`code:
  "user-request"`): D1-build then D1-finish for a build change (gear, tree, gems or config), else D1-finish (on
  `build:`, D1-build, then D1-finish with its `changed`), then the D1 gate and this gate again;
  **verification**, step 5; **stop**, also when `answers.design[]` is used up (`default`).
- **D2** (8) adds the campaign; tell it how to price. **The D2 gate** (9) checks every stage and, when the
  compile, V1 and V2 pass, runs the final compile with `buildName` (`<slug>-<YYYY-MM-DD>-<n>`, the run folder's
  last two segments joined with `-`). A failure re-runs D2, up to 2 counted retries; the third escalates (§5). On
  a pass, render `audit.md` (`render-audit.mjs <runFolder>`, D-355), then W1.

## 5. Gate escalations (`references/checkpoints.md`; D-236)

Record `{stage, concept, verdict, choice, guidance?}` and checkpoint `escalation`. Print its display, `display
escalation` (the stage, the attempts and the verdict file), whoever answers (Hard rules), and ask: 1. **accept**
(not after a compile failure), the failing findings into every later header's `accepted`, going on as if the gate
passed (the D2 gate runs once more, uncounted); 2. **guidance and one more retry**: the producer (D1 or D2) gets one
more attempt, uncounted, with the verdict and the user's guidance (`code: "user-guidance"`) in `findings`, then its
gate. If the gate fails, whatever part fails, it escalates again; 3. **back to the verification gate** (the choice
`verification`); 4. **stop**: the run ends `escalated`.

## 6. Write, verify and the final gate (steps 10 to 16)

- **W1** (10): `accepted` every accepted gate finding; its prompt names the last D1 gate verdict file.
- **Step 11, the full pass.** Start one verifier (D-352), `check: "full"`, `findings: []` and `writes:
  ["reports/V4-<n>.md"]`. `<n>` is always one more than the highest `reports/V4-<n>.md` the run folder holds
  (`ls <runFolder>/reports`), 1 for the run's first. One pass with no lenses: it checks every hinge claim of
  `plan.json` against its source and reads every H2 of `guide.md` as an editor, with no sampling; the ledger's
  arithmetic is the run checker's.
- **Step 12, the fix round** (`references/fix-round.md`), once, only when the report has an `unresolved`
  finding. First the round copy (A-34): `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>
  --snapshot <n>`, `<n>` that report's number. Then each finding goes to its `owner`: D1 (D1-finish, and
  D1-build when D1-finish returns `build: <ids>`), D2, and W1 last. Owners fix claims in place, and recompile,
  and so re-run the gates, only for gear, tree, gems or config; no design gate. Re-render `audit.md` before W1.
- **Step 13, the re-check** (`references/fix-round.md`): `check-run.mjs <runFolder> --changed <n>`, then one
  verifier, `check: "recheck"`, `changed` the lines it printed, verbatim. It re-checks only those, whether or
  not an owner recompiled: no re-check covers every claim (D-352).
- **Step 14, known issues** (`references/fix-round.md`): replace both `Known issues` lists whole with the last
  report's open findings and W1's accepted-finding lines, reading only the lines you edit.
- **Step 16, the final gate** (`references/checkpoints.md`). Print its display, `display final` (each rung's final
  figures, D-369, and the checker's result among them), whoever answers (Hard rules), and ask: **accept**
  (`completed`), **ask for changes**, or anything else (`not-accepted`). Asking for changes is a revision
  (`references/fix-round.md`): the round copy, the owners' chain, then step 13's re-check: **a revision runs no full
  pass** (D-352). Steps 12 to 16 then follow as after a full pass.

## 7. Finish

1. Set `status` and `outputs` (`plan`, `record`, `dossier`, `guide` and the PoB file; not the import code,
   whose one home is the record, D-260) with `run-log.mjs <runFolder> set`: the run log's last write.
2. Run the run checker, `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`, at step 15 and
   once more after the last log write of every run (`references/run-folder.md`).
3. Tell the user: the run folder, the guide, the PoB file and where its import code is (the guide's `Your PoB
   file`, and `compile-record.json`), the status, the known issues, and each violation the checker printed.

## References

`references/start.md`, `references/fix-round.md`, `references/checkpoints.md`, `references/run-log.md`,
`references/task-header.md`, `references/run-folder.md`, `references/gates.md`, `references/pricing.md`,
`references/offline-and-test.md`, `references/source-markers.md`, `references/lookups.md`, `references/patterns.md`
(C-53), `references/stages/` (one per step, `references/stages/R1a-assemble.md` among them),
`templates/card-template.md` (C-52), `scripts/check-run.mjs`, `scripts/render-audit.mjs` and `scripts/run-log.mjs`.
