# The run folder

Every run of the build-guide skill works inside one run folder, which the server creates. This page is
the layout, who writes each file, and how the PoB file is named (slice 03 §2; spine C-34, C-36). The run
checker, `scripts/check-run.mjs`, holds a run folder to it.

## Creating it

After the roll check, the skill's first server write is `guide_run {new_run: <slug>}` (D-207, D-216).
It makes no engine call, and replies with three lines:

```
Created run folder <absolute path>
plan_path for this run: <slug>/<YYYY-MM-DD>-<n>/plan.json
loadedBuildUnsaved: true | false
```

- `runFolder` is the absolute path. Every step and every agent uses it; no agent needs the guides root.
- `runFolderRel` is `<slug>/<YYYY-MM-DD>-<n>`, the run folder relative to the guides root. A plan's
  `plan_path` for `compile_plan` and `guide_run {validate}` is `<runFolderRel>/plan.json`, or
  `<runFolderRel>/concepts/<id>/plan.json` for a concept skeleton.
- `loadedBuildUnsaved` says whether the engine's loaded build has unsaved changes. The first compile
  replaces that build, so when it is `true` the skill asks the user first (D-210, `checkpoints.md`).

**The slug** is `<ascendancy>-<skill>` in lower case, with each run of characters outside `[a-z0-9]`
replaced by one `-` and no `-` at either end: Titan / Blood Hunt gives `titan-blood-hunt`. The server
takes at most 64 characters. Each run gets a new dated folder and never writes into an earlier run's
folder (D-153).

## Layout and ownership

| Path in the run folder | Written by (only) | Content |
|---|---|---|
| `run-log.json` | the skill | the run log (`run-log.md`, D-158) |
| `research/p<k>-r1a-<n>.md` | R1a agent `n` of research round `k` | its sections, with source markers (`source-markers.md`) |
| `concepts/<id>/plan.json` | the R1b step for concept `<id>` | an endgame skeleton plan (C-31) with its key-item prices |
| `concepts/<id>/compile-record.json`, `concepts/<id>/compiled-build.xml` | `compile_plan`, measure-only (D-208) | the skeleton's compile record (C-33) and compiled XML |
| `dossier.md` | the R1b assembly step; the dossier fix step | the dossier (slice 03 §7.2) |
| `plan.json` | the D1 and D2 steps; the D1 gate step only to apply FI-2 and the final re-price pass | the plan (C-31) |
| `compile-record.json`, `compiled-build.xml` | `compile_plan` | the record of the last compile of `plan.json`; after the final compile it names the PoB file and holds `importCode` |
| `guide.md` | W1 | the guide (slice 03 §8) |
| `reports/gates/<stage>-<concept>-a<attempt>.json` | the skill, from workflow results | gate verdicts (`gates.md`) |
| `reports/v3-<concept>-p<pass>.json`, `reports/v4-<lens>-<concept>-p<pass>.json` | the skill, from workflow results | V3 and V4 reports (`source-markers.md`) |

- Concept ids are `c1`, `c2`, … in proposal order, unique within the run across research rounds.
- `<stage>` in a gate file is `R1b`, `D1-gate` or `D2-gate`; `<attempt>` counts from 1 per (stage,
  concept); `<pass>` is the V3/V4 round, from 1; `<lens>` is `ledger`, `sources` or `prose`.
- Nothing else goes in the run folder. No agent writes outside it (D-177), and agents running in
  parallel write different files (C-36).
- The skill writes every gate verdict and V3/V4 report a workflow returns into `reports/` unchanged, then
  the run log (FR-W6).

## The PoB file

Only the run's final compile writes a PoB file into the builds folder, through the server (C-17,
D-208). Its `build_name` is `<slug>-<YYYY-MM-DD>-<n>`: the run folder's last two segments joined with
`-`, so every run writes a new file (D-113, D-199). Every earlier compile, the concept skeletons'
included, is measure-only and writes only the record and the compiled XML beside its plan.

A re-compile within the run rewrites that same file. The server's write ledger allows it only while the
file is unchanged since this run wrote it; otherwise `compile_plan` refuses, with C-17's changed-on-disk
wording when someone edited the file, or its "already exists" wording when the ledger has no entry for
this run (D-211). A refusal is a failed attempt like any other: report it, never work around it.

## What the run checker checks

`node .claude/skills/build-guide/scripts/check-run.mjs <runFolder> [--partial]` uses Node built-ins only.
Without `--partial`, only a `completed` run passes; `--partial` accepts a run that ended earlier and
checks what it produced. It checks this layout, the run log (`run-log.md`), the dossier's and the
guide's headings, every source marker (`source-markers.md`), the import code, the caps, offline pricing,
and the V3/V4 reports. It recomputes the last D1 gate's floor, budget and rolled-skill verdicts from the
records (`gates.md`) and its own claim counts, and fails wherever they differ from what the agents
reported. Each violation is one stderr line `check-run: [<rule>] <message>`.
