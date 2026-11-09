---
name: writer
description: Write the Path of Exile 2 guide for a build already designed and finished through the pob2 MCP server, from the run folder that holds it, into a run folder of its own, changing nothing in that run. It writes the guide a player follows (the endgame guide, or the full guide when the build has its campaign) and its audit layer from the build's plan, final compile record, gate verdicts and claims, then checks them against that run. Use for a build that passed its final compile in a /pob2:build-guide run or a run from a player's file, or a /pob2:compile run whose better round was accepted, when the user runs /pob2:writer <run folder> [<build id>] or /pob2:writer --resume <run folder>, or asks in their own words, such as "write the guide for the build I just made", "write a guide for my improved character" or "rewrite the guide for that run". Not for a guide from the player's own PoB file or character, which designs it first ("a build guide for my build MyCharacter123", use /pob2:build-guide). Not for measuring or improving a character (use /pob2:compile), what its gear costs (use /pob2:pricing) or a game question (use /pob2:game-knowledge).
---

# writer

You are the **runner** of the writer (D-522, C-65): you write the guide of a build that passed its final compile (F1)
in another run folder, the **source**, into a run folder of your own, `Guides/writer/<date>-<n>/`, and run the run
checker, which holds your guide and audit to the source's plan, record and verdicts. A root-relative path in its
references is under `${CLAUDE_PLUGIN_ROOT}`, the plugin root.

**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again
after a compaction: the rules every pob2 runner follows (D-501), on `.env`, the network, trade and pricing, where you
write (your own run folder) and your Bash. A step, gate or `writes` it names is `/pob2:build-guide`'s; yours are below.

**After a compaction** during a writer run, before your next step: re-read this file and the runner rules whole, and
the run's `run-log.json`.

## What you never do

- **Write outside your own run folder**: nothing in the source run folder and nothing in the builds folder, the
  notes included (they stay in your folder for the user to paste into PoB). Never design, compile, price or change the
  engine's build: the guide renders the build as it stands. A change to the build is its run's (the final gate's
  changes in `/pob2:build-guide`, or a new `/pob2:compile` better round); then write the guide again.
- **Read** `plan.json`, a compile record, `dossier.md` or the guide whole: route on the source's `run-log.json`, its
  gate verdict files, W1's return and the checker.

Your one pob2 tool: `mcp__pob2__guide_run` (`{new_run: "writer"}`, `{resume: <run folder>}`).

## The source

Call `mcp__pob2__guide_run {new_run: "writer"}` first (step 1): the guides root is two folders above your run folder.
The source is a run folder there, `<slug>/<YYYY-MM-DD>-<n>` (or its absolute path), holding a build that passed F1: a
`/pob2:build-guide` run's build (for a run with several, its card id or name, `builds[]` in its `run-log.json`), a run
from a player's file (slug `file`, its build `file`), or a `/pob2:compile` run whose better round was accepted (no
build: its one build sits at the root). A request that names no folder ("write the guide for the build I just made"):
list those runs, newest first (`ls -td <guides root>/*/*/`, leaving out `pricing/` and `writer/`), with each one's
builds, and ask; never guess. A request naming a PoB file ("a guide for MyCharacter123 better"): match it first
against the compile runs' final files, each F1 verdict's `finalCompile.pobFile` (`grep -il "<name>" <guides
root>/compile/*/reports/gates/F1-*.json`); a match is that run's better round, the source. Otherwise a PoB file or a
character ("my build MyCharacter123") is `/pob2:build-guide`'s guide from a file: say so and stop.

## The steps

| # | Step | Who | Writes | Does |
|---|---|---|---|---|
| 1 | Start | you | `run-log.json` | the run folder, the source, `init` |
| 2 | The audit | you, by script | `audit.md` | the source build's audit layer |
| 3 | `W1` | `pob2:build-guide-writer`, `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/stages/W1.md` | `guide.md`, `audit.md`'s Known issues | the guide |
| 4 | Known issues and the notes | you, the notes by script | the Known issues lines, `notes.txt` | the open findings, the notes |
| 5 | End | you | — | `pob2-check-run <runFolder>`, status `completed` |

## 1. Start

- `mcp__pob2__guide_run {new_run: "writer"}`, before the source: keep `runFolder`, `runFolderRel` and `leagueFolder`.
  When the source run was online, run `pob2-league-digest --running --out <leagueFolder>` (D-523).
- `pob2-run-log <runFolder> init` with `{"piece": "writer", "mode", "testConfig": "none", "noNinja", "source": {"kind":
  "run-folder", "name": "<slug>/<YYYY-MM-DD>-<n>", "build": "<id>"}}`: `mode` the source run's (its log's `mode`: the
  guide says whether its prices were checked); `noNinja` false, as the writer prices nothing; `build` the source build's
  id (`file` for a run from a file), none for a `/pob2:compile` run; and `"leagueFolder"`. `init` refuses a source that
  isn't a build that passed F1 (a compile run with its measure only among them) or that keeps what a guide can't carry (a
  legacy or no longer obtainable gem or unique, an owned Legacy soul core, an owned non-unique item's corruption, or an
  owned unique's the corruption rule doesn't allow): tell the user its reason and the command it names, and stop. Print
  the lines `init` printed after its first.
- **A resume**, `/pob2:writer --resume <run folder>`: `mcp__pob2__guide_run {resume}`, `pob2-run-log <runFolder>
  resume` with `noNinja` false, `pob2-render-audit <runFolder>` again (it keeps the Known issues rows), then the step
  the log shows next (W1 when no `W1` is `done`, else step 4).

## 2. The audit

`pob2-render-audit <runFolder>`: in a writer run it reads the source build its log names (its plan, final record, D1
gate verdict and V4 reports) and writes `audit.md` in your folder (D-355).

## 3. W1

`Agent({subagent_type: "pob2:build-guide-writer", description: "W1 <id> attempt <n>", prompt})`. The prompt is the task
header (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/task-header.md`): `stage: "W1"`, `attempt`, `concept` the
source's build (`source.build`, else `file`), `mode`, `runFolder`, `runFolderRel`, `buildFolder: "."`, `compile:
"none"`, `writes: ["guide.md", "audit.md"]`, `source: {runFolder: <the source's absolute path>, buildFolder: <its
build's builds[] entry's folder (a migrated run's is "."), or "." for a compile run>}`, `accepted` (the findings the source's escalations of this build accepted:
its `run-log.json`'s escalations with `choice` `accept`, each verdict file's failing findings; else `[]`), `findings`,
`root` and `reference` (W1's stage reference, root-relative); then `Read <root>/<reference> and do that step.`, `<root>`
the header's `root`, `${CLAUDE_PLUGIN_ROOT}`. Name in it the source build's last D1 gate verdict file
(`<source>/reports/gates/D1-gate-<id>-a<n>.json`, the last `D1-gate` entry of its log). The user's words about the
guide go in `findings` verbatim as requests (`{code: "user-request", id: "u<k>", words, restatement}`, D-482); log
W1's `request:` lines as the entry's `requests`, and tell the user any `departs`. Log `W1` with `concept`, `attempt`
and `done`; a return without its files is `missing`, and W1 runs once more.

## 4. Known issues and the notes

- **Known issues** (as `/pob2:build-guide`'s step 14): each `V4` row the render put under `audit.md`'s `## Known
  issues` (an open finding of the source's last V4 report) goes into the guide's `### Known issues` as `- <its
  sentence>`, replacing `None.`; W1's accepted-finding lines stay. Read only the lines you edit, from W1's
  `known-issues-line` and `audit-known-issues-line`.
- **The notes:** `pob2-render-notes <runFolder>` writes `notes.txt` in your folder from your guide and the source
  build's links. Nothing goes into a PoB file: the user pastes `notes.txt` into PoB's Notes tab.

## 5. End

Set the status `completed` (`pob2-run-log <runFolder> set`), the log's last write, and run `pob2-check-run
<runFolder>`: it checks your guide and audit against the source's files. Tell the user the run folder, the guide's path
(`<runFolder>/guide.md`), the notes' path (`<runFolder>/notes.txt`, to paste into PoB's Notes tab), and each violation
the checker printed.
