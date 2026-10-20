# D2-gate: check every stage, then the final compile (`build-guide-coordinator`)

A fresh coordinator step after every D2 attempt, which adds a build's campaign on request (D-415), and after a D1
gate in the fix round or a revision of a build with its campaign. It compiles the build's whole plan measure-only
and checks that it compiled and that V1 (the tree's shape included, `tree-shape`) and V2 pass for **every**
stage. When they do, it runs the build's final compile in the same step, rewriting the PoB file F1 wrote (D-413),
the only write into the builds folder. You check; you don't design. Fix nothing in the plan: a failure goes back to
D2 as findings.

## Inputs

- **The build's folder** (D-412): the header's `buildFolder` under `runFolder`, `builds/<id>`, or `.` for a run
  migrated from schema 3. `plan.json` and `compile-record.json` are there, and `<plan>` is
  `<runFolderRel>/<buildFolder>/plan.json` (`<runFolderRel>/plan.json` when `buildFolder` is `.`).
- **Header:** `stage: "D2-gate"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`, `buildFolder`,
  `compile: "final"`, `buildName`, `accepted` (the findings the user accepted for this build), `writes`: the
  verdict file `reports/gates/D2-gate-<concept>-a<attempt>.json` (at the run folder's root).
- **`buildName`**, as the runner builds it by the run checker's PoB file name rule: `<slug>-<YYYY-MM-DD>-<n>-<card
  id>`, the run folder's last two segments and the card id joined with `-` (D-412), the name F1 wrote; for a build
  in `.` (a migrated run's), `<slug>-<YYYY-MM-DD>-<n>`, with no card id. Use it as given: never pick another.
- **Read:** nothing before the compile: you compile `plan.json` by its path and judge only what the compile
  reports. After each compile, `mcp__pob2__compile_plan`'s text: each stage's line with its V1 and V2 verdict,
  and every V1 and V2 finding up to 200; when a line says how many more, Grep `compile-record.json`'s
  `stages.<id>.v1.findings` and `stages.<id>.v2.findings` for them. Never Read the record whole. The verdict
  file's form is under "Writes" below.

## Work

1. **The check.** Compile the whole plan measure-only: `mcp__pob2__compile_plan {plan_path:
   "<plan>", measure_only: true}`, with no `stages`. A compile error is part `compiled`
   failing (code `compile-error`, the error line as the message, the plan stage it names as `stage`); then
   `v1` and `v2` are `unverified`, and you write the verdict file.
2. For every stage in `stagesCompiled`, each finding of its `v1` and `v2` verdicts becomes a gate finding:
   part `v1` or `v2`, the record's `code` unchanged, the plan stage as `stage`, the record's message. A part
   with any finding is `fail`. One equal to a finding in the header's `accepted` (same plan stage, part and
   code) is reported with `"accepted": true`, and fails no part.
3. **The final compile**, only when the compile, V1 and V2 pass (accepted findings aside): call
   `mcp__pob2__compile_plan {plan_path: "<plan>", build_name: "<the header's buildName>"}`
   exactly once: the whole plan, not measure-only. It writes the PoB file into the builds folder through
   the server (C-17), and `compile-record.json` with `importCode` and the PoB file's path (D-205).
4. A refusal of the final compile (C-17's "already exists" or changed-on-disk wording, the write ledger's
   rule, D-211) or a compile error is a failed final compile: part `compiled` fails with code
   `final-compile`, the error lines verbatim. Never retry it, never pick another `build_name`, and never work
   around it. On success, the new record's `v1` and `v2` verdicts over every stage are the verdict's, as in
   step 2.
5. **A refused call** (D-421): when the permission system refuses `mcp__pob2__compile_plan`, part `compiled` is
   `unverified` with code `tool-refused` and every other part `unverified`; write the verdict file, and return
   `refused: mcp__pob2__compile_plan`. It isn't a compile failure: the runner re-runs this step once the user
   allowed the tool.

## Writes

The verdict file `reports/gates/D2-gate-<concept>-a<attempt>.json`, and nothing else: the server writes the
record, the XML and the PoB file.

```json
{
  "stage": "D2-gate",
  "concept": "r1-a-2",
  "attempt": 1,
  "verdict": { "compiled": "pass", "v1": "pass", "v2": "pass" },
  "findings": [],
  "finalCompile": { "compiled": true, "errors": [], "recordPath": "builds/r1-a-2/compile-record.json", "pobFile": "titan-blood-hunt-2026-10-08-1-r1-a-2.xml" }
}
```

- `verdict`: each part `pass`, `fail` or `unverified`; `findings`: `{part, code, stage, message, accepted?}`.
- `finalCompile`, when step 3 ran: `compiled`, whether it succeeded; `errors`, its error lines verbatim;
  `recordPath`, the record from `runFolder`; `pobFile`, the new record's `pobFile.path`, or `null` when it failed. Don't copy the import code:
  `compile-record.json` is its one home, and W1 copies it from there (D-260).

## Returns

At most 8 lines: the verdict in one line, the verdict file, and the PoB file when the final compile wrote
it.

```
D2-gate r1-a-2 attempt 1: compiled pass, v1 pass, v2 pass; final compile written
reports/gates/D2-gate-r1-a-2-a1.json
titan-blood-hunt-2026-10-08-1-r1-a-2.xml
```

## Fault directives

None.
