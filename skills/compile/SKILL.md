---
name: compile
description: Measure a player's own Path of Exile 2 character from its Path of Building (PoB) file, a builds-folder build or an import code, through the pob2 MCP server, and on request make it better. It reads the file into a plan (every item kept with its own rolls, nothing written to the file), measures it under its own configuration, shows its damage, its toughness and its distance to the endgame targets, calls out configuration that looks wrong and asks which Spirit buffs stay on; when asked, it runs a design round toward the targets within the player's budget, shown at a design gate with a draft PoB file, and writes the accepted design as a new PoB file beside the player's, never over it. Use when the user runs /pob2:compile <build name or import code> [--offline] [--no-ninja] or /pob2:compile --resume <run folder>, or asks in their own words, such as "what does my character do", "measure my build MyCharacter123", "make my character better" or "how can I make this build better". Not for a build guide, from a brief or from the player's file ("a build guide for my build MyCharacter123", use /pob2:build-guide), what the gear costs or which rung it sits on ("what is my gear worth", use /pob2:pricing), or a game question (use /pob2:game-knowledge). A review of a PoB file isn't a pob2 skill yet.
---

# compile

You are the **runner** of compile (D-519, amendment 16 §15 and §17): you read the player's PoB file into a plan, have it
measured, show the user what it measured and what seems wrong, and on request run the better round, in a run folder of
its own, `Guides/compile/<date>-<n>/`. A root-relative path in its references is under `${CLAUDE_PLUGIN_ROOT}`, the plugin
root.

**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again
after a compaction: the rules every pob2 runner follows (D-501), on `.env`, the network, trade and pricing, where you
write (your own run folder), agents and your Bash. A pricing stop ends a compile run (D-516).

## What you never do

- **Write the user's PoB file.** The reader keeps its own copy in the run folder; the better round's draft and final
  file go into the builds folder through the server, under their own names, never over a file (C-17).
- **Read** `plan.json`, `read.json` or a compile record: the reader's reply, the measure's report (measure.md), the
  gate verdict files and the agents' returns route the run.
- **Price** outside the round's place, D1-finish and the D1 gate; tell the user before pricing starts, as the shared
  rules say. Any other compile, engine change or price call is a coordinator step's.

Your pob2 tools: `mcp__pob2__list_builds`, `mcp__pob2__guide_run {new_run: "compile"}` and `{resume}`,
`mcp__pob2__plan_from_build`, and `mcp__pob2__compile_plan {plan_path, draft_name}` for an escalation accept's draft.

## Calling an agent

Every agent step is the build-guide coordinator's, one at a time: `Agent({subagent_type: "pob2:build-guide-coordinator", description:
"<stage> file attempt <n>", prompt: "<header, then the reference line>"})`. The prompt is the task header
(`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/task-header.md`), `concept: "file"` on the round's steps,
`buildFolder: "."`, the plan `<runFolderRel>/plan.json`, then `Read <root>/<reference> and do that step.`, `<root>` the
header's `root`, `${CLAUDE_PLUGIN_ROOT}`. Returns, refusals, missing returns and the user's words (D-482) go as
`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/SKILL.md` says in "Calling an agent". Log every step with `pob2-run-log`
(`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/run-log.md`, "Piece runs").

## The steps

| # | Step | Who | Writes | Does |
|---|---|---|---|---|
| 1 | Start | you | `run-log.json` | the build, the run folder, `init` (§1) |
| 2 | `read` | you | source.xml, `plan.json`, `read.json` | `mcp__pob2__plan_from_build`, its questions, its second call (§2) |
| 3 | `measure` | coordinator, `${CLAUDE_PLUGIN_ROOT}/skills/compile/references/stages/measure.md` | measure.md, the record, `compiled-build.xml` | the measure, the callouts, the Spirit question (§3) |
| 4 | The display | you | — | what it measured, short (§4) |
| 5 | Better, on request | coordinator | the round's plan, `trades.json`, verdicts, the PoB files | `place`, D1-build to the D1 gate, the design gate, F1 (§5) |
| 6 | End | you | — | `pob2-check-run <runFolder>`, status `completed` (§6) |

## 1. Start

- **The build.** `/pob2:compile <build name or import code> [--offline] [--no-ninja]`, or the user's words naming
  their build. A name (`MyCharacter123`) is matched against `mcp__pob2__list_builds`: a file name equal to it, case
  and `.xml` ignored, is the build; otherwise list the closest names and ask, never guessing. A long code with no
  spaces is an import code: it goes only to the reader, never in the log or your reply.
- **The folder and the log.** `mcp__pob2__guide_run {new_run: "compile"}`: keep `runFolder`, `runFolderRel` and
  `loadedBuildUnsaved`. Then `pob2-run-log <runFolder> init` with `{"piece": "compile", "mode", "testConfig": "none",
  "noNinja", "source"}`, `source` `{"kind": "builds-folder", "name"}` or `{"kind": "import-code"}`. Print the lines
  `init` printed after its first (the running leagues' digests). When `loadedBuildUnsaved` is true, ask before the
  measure: proceed (the loaded build's unsaved changes are discarded) or stop.
- **A resume**, `/pob2:compile --resume <run folder>` (the retry after a pricing stop, D-516): `mcp__pob2__guide_run
  {resume}`, `pob2-run-log <runFolder> resume` with this session's `noNinja`, then the step the stop ended, again.

## 2. Read (step 2)

The first call: `mcp__pob2__plan_from_build {run_folder: <runFolderRel>, build_name}` or `{run_folder, import_code}`.
Its reply names what it left out and its questions; ask them as an interview, one at a time, in plain words: the main
skill (the groups by name, PoB's choice marked as possibly its guess), a stand-in for an item on a base the pin
lacks, the loadout when the file holds several, an older tree. Then the second call with the answers only
(`main_group`, `loadout`, `tree`, `stand_in`). A refusal logs `read` `fail` and ends the run `stopped`, its reason
told. Log `read` `done`.

## 3. Measure (step 3)

Header `stage: "measure"`, `compile: "measure-only"`, `writes: ["measure.md", "plan.json"]`, and `"cards/file.md"`
when the user's request already asked for the better round; the prompt carries the user's words about the character
(that it is in the campaign; what it is for). Log `measure` `done` or `fail`.

## 4. The display (step 4)

Read measure.md and tell the user, short and player-facing: the measured file first
(`<runFolder>/compiled-build.xml`, to open in PoB), the headline figures, each target's distance as where the
character is headed, endgame or in the campaign (level under 65, choice A) for the owner to correct, the shown
callouts, each with why (nothing is changed without the user's word), and the Spirit question when it has one. An
answer that changes the plan runs steps 2 and 3 again: the Spirit answer goes to the second call as `buffs_on`,
`buffs_swap` and `switch_off` (`{<switched group>: [<its off groups>]}`, the lists the user confirmed), a corrected main
skill as `main_group`; the owner's word on the campaign goes in the measure's prompt. Then offer the better round.

## 5. Better, on request (D-521, §17)

The user asked for it, in the request or after the display. A measure that wrote no file card runs once more first,
`compile: "none"`, `writes: ["cards/file.md"]`.

- **The budget**, asked in the user's words, which go verbatim in each design step's prompt. Without trade, the round
  designs at the floor tiers, its prices `unavailable`; say so once.
- **Place** (amendment 16 §16). Below the endgame (level under 65, or the owner's word) it isn't placed: the round
  aims at entering maps' targets (choice A). With trade, pricing's placement scope places it; without trade (offline,
  `--no-ninja`, or a stop before a rung is known), ask the user for the rung: entering maps, budget or non-budget,
  never assumed. Log `place` with its `priceOutcomes`; a rung the user named goes in D1-build's prompt.
- **D1-build, D1-tree, D1-finish, the D1 gate**, each with `scope: "better"` in its header and its stage reference
  (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/stages/`), in that order, routed as
  `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/SKILL.md` §4 routes them; the D1 gate's `draft_name` is the source's name
  and ` better` (an import code's: the file card's name and ` better`). A target the budget can't reach is a finding
  with what it would cost (`cost`), not a failed attempt: a floor failing only on such findings goes to the design
  gate. An escalation takes accept, retry or stop (§5 there); there is no verification gate to go back to.
- **The design gate**, an interview (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`): print
  `pob2-run-log <runFolder> display design`, which names the draft first; answer every question, restate the decision,
  wait for a yes, and log checkpoint `design`, `concept: "file"`: **accept**, F1; **revise** (`revise:<text>`, the
  user's words as `findings`), D1 again from the step the change needs, then the D1 gate and this gate; **stop**, the
  run ends `stopped`.
- **F1** (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/stages/F1.md`): `compile: "final"`, `buildName` the
  draft's name (`<name> better`), `firstFree: true` on its first write, `draftFile` the D1 gate verdict's `draft`; its
  prompt names that verdict file. A pass ends the round: tell the user the final file's name, from the verdict's
  `finalCompile.pobFile`. A fault re-runs F1 once, uncounted, then escalates.

## 6. End

Set the run's `status` (`pob2-run-log <runFolder> set`): `completed` after the measure when no round follows, or after
the round's F1; `stopped` on a stop. Run `pob2-check-run <runFolder>` after the log's last write, and tell the user the run folder, the measured
file, the final file when the round wrote one, and each violation the checker printed.
