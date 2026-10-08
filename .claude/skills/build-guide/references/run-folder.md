# The run folder

Every run of the build-guide skill works inside one run folder, which the server creates. This page is
the layout, who writes each file, how the PoB file is named, and what the run checker holds a run folder
to (slice 03 §2 and FR-W7, as amendment 1 changes them; spine C-34, C-36).

## Creating it

After the roll check, the runner's first server write is `mcp__pob2__guide_run {new_run: <slug>}` (D-207,
D-216). It makes no engine call, and replies with three lines:

```
Created run folder <absolute path>
plan_path for this run: <slug>/<YYYY-MM-DD>-<n>/plan.json
loadedBuildUnsaved: true | false
```

- `runFolder` is the absolute path. Every step and every agent uses it; no agent needs the guides root.
- `runFolderRel` is `<slug>/<YYYY-MM-DD>-<n>`, the run folder relative to the guides root. A plan's
  `plan_path` for `mcp__pob2__compile_plan` and `mcp__pob2__guide_run {validate}` is
  `<runFolderRel>/plan.json`, or `<runFolderRel>/concepts/<id>/plan.json` for a concept skeleton.
- `loadedBuildUnsaved` says whether the engine's loaded build has unsaved changes. The first compile
  replaces that build, so when it is `true` the runner asks the user first (D-210, `checkpoints.md`).

**The slug** is `<ascendancy>-<skill>` in lower case, with each run of characters outside `[a-z0-9]`
replaced by one `-` and no `-` at either end: Titan / Blood Hunt gives `titan-blood-hunt`. The server
takes at most 64 characters. Each run gets a new dated folder and never writes into an earlier run's
folder (D-153).

## Layout and ownership

| Path in the run folder | Written by (only) | Content |
|---|---|---|
| `run-log.json` | the runner | the run log (`run-log.md`) |
| `research/p<k>-r1a-<n>.md` | R1a agent `n` of research round `k` | its sections, with source markers (`source-markers.md`) |
| `concepts/<id>/plan.json` | the R1b step for concept `<id>` | an endgame skeleton plan (C-31) with its key-item prices |
| `concepts/<id>/compile-record.json`, `concepts/<id>/compiled-build.xml` | `mcp__pob2__compile_plan`, measure-only (D-208) | the skeleton's compile record (C-33) and compiled XML |
| `dossier.md` | the R1b-assemble step | the dossier (slice 03 §7.2) |
| `plan.json` | the D1 and D2 steps; the D1 gate step only to apply FI-2 and the final re-price pass | the plan (C-31) |
| `compile-record.json`, `compiled-build.xml` | `mcp__pob2__compile_plan` | the record of the last compile of `plan.json`; after the final compile it names the PoB file and holds `importCode` |
| `guide.md` | W1; the runner appends the open findings to its `Known issues` (step 14) | the guide (slice 03 §8) |
| `reports/gates/<stage>-<concept>-a<attempt>.json` | the gate step itself: R1b, D1-gate or D2-gate | its verdict (`gates.md`) |
| `reports/v4-<lens>.json`, `reports/v4-<lens>-recheck.json` | the runner, from the verifier's return, unchanged | the V4 full pass and re-check reports (`source-markers.md`) |

- Concept ids are `c1`, `c2`, … in proposal order, unique within the run across research rounds.
- `<stage>` in a gate file is `R1b`, `D1-gate` or `D2-gate`; `<attempt>` counts from 1 per (stage,
  concept), as the header and the run log's `stages[]` do; `<lens>` is `ledger`, `sources` or `prose`.
- A revision's verification rewrites the V4 reports; the run log's order says which re-check belongs to the
  last full pass.
- Nothing else goes in the run folder. No agent writes outside it (D-177), and agents running in
  parallel write different files (C-36).

## The PoB file

Only the run's final compile writes a PoB file into the builds folder, through the server (C-17,
D-208). Its `build_name` is `<slug>-<YYYY-MM-DD>-<n>`: the run folder's last two segments joined with
`-`, so every run writes a new file (D-113, D-199). Every earlier compile, the concept skeletons'
included, is measure-only and writes only the record and the compiled XML beside its plan.

A re-compile within the run (the fix round's, or a revision's) rewrites that same file. The server's write
ledger allows it only while the file is unchanged since this run wrote it; otherwise
`mcp__pob2__compile_plan` refuses, with C-17's changed-on-disk wording when someone edited the file, or its
"already exists" wording when the ledger has no entry for this run (D-211). A refusal is a failed attempt
like any other: report it, never work around it.

## What the run checker checks

`node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>` checks what the folder holds, whatever
the run's status; when a guide exists, every guide check applies (amendment 1 §4.2). It uses Node built-ins
and the server's own compiled ledger evaluator, `build/plan/ledger.js`. Each violation is one stderr line
`check-run: [<rule>] <message>`.

- **The artifacts.** This layout. The dossier's H2s; the guide's H2s, its `Checks` H3s, and its Leveling H3s
  equal to the record's loadout names. Every marker resolves and parses as a C-30 tag. Offline, every price
  is `unavailable` and no step priced. The guide's import code equals the record's (D-205), and every
  finding open after the re-check is under `Known issues`, by id, with every accepted gate finding.
- **The final record.** V1 and V2 pass for every stage, accepted findings aside. `sha1(plan.json)` equals the
  record's `planSha1`. The decoded `importCode` matches the record's `pobFile` sha1, with one tree set per
  plan stage, titled by the record's loadout names (D-215). Every ledger entry, re-evaluated over the record
  by the server's evaluator, equals the record's value to 2 decimals.
- **The D1 gate, recomputed** from the record and the plan (`gates.md`): the floor, the budget and the
  rolled skill, its figure's stat set equal to `skills.main.statSet`. The checker fails a verdict that
  differs from its own, and, once a guide exists, any failure no accepted finding covers.
- **The run log and the control flow** (`run-log.md`): the fields and their values; steps in a legal order;
  R1b at most 3 counted attempts and each gate at most 2 counted retries (S6 honoured); one full V4 pass and
  at most one re-check per verification cycle; escalations only from the gates, each naming its verdict
  file; and a `rule` on every pre-supplied or default answer.
