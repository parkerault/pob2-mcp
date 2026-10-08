# D2-gate: check every stage, then the final compile (`build-guide-coordinator`)

Slice 03 §5.3 step 4; spine C-17, C-33, D-113, D-192, D-199, D-205, D-208, D-211. A fresh coordinator step
after every D2 attempt (and after a D1 gate in the fix round or a revision). It compiles the whole plan
measure-only and checks that it compiled and that V1 (tree continuity included) and V2 pass for **every**
stage. When they do, it runs the final compile, the run's only write into the builds folder, in the same
step. You check; you don't design. Fix nothing in the plan: a failure goes back to D2 as findings.

## Inputs

- **Header:** `stage: "D2-gate"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`,
  `compile: "final"`, `buildName`, `accepted` (findings the user accepted), `writes`: the verdict file
  `reports/gates/D2-gate-<concept>-a<attempt>.json`.
- **Read:** `plan.json`; after each compile, `mcp__pob2__compile_plan`'s text (every V1 and V2 finding) and
  `compile-record.json` (a large record: Read it in parts, or Grep the fields you need);
  `.claude/skills/build-guide/references/gates.md`.

## Work

1. **The check.** Compile the whole plan measure-only: `mcp__pob2__compile_plan {plan_path:
   "<runFolderRel>/plan.json", measure_only: true}`, with no `stages`. A compile error is part `compiled`
   failing (code `compile-error`, the error line as the message, the plan stage it names as `stage`); then
   `v1` and `v2` are `unverified`, and you write the verdict file.
2. For every stage in `stagesCompiled`, each finding of its `v1` and `v2` verdicts becomes a gate finding:
   part `v1` or `v2`, the record's `code` unchanged, the plan stage as `stage`, the record's message. A part
   with any finding is `fail`. One equal to a finding in the header's `accepted` (same plan stage, part and
   code) is reported with `"accepted": true`, and fails no part.
3. **The final compile**, only when the compile, V1 and V2 pass (accepted findings aside): call
   `mcp__pob2__compile_plan {plan_path: "<runFolderRel>/plan.json", build_name: "<the header's buildName>"}`
   exactly once: the whole plan, not measure-only. It writes the PoB file into the builds folder through
   the server (C-17), and `compile-record.json` with `importCode` and the PoB file's path (D-205).
4. A refusal of the final compile (C-17's "already exists" or changed-on-disk wording, the write ledger's
   rule, D-211) or a compile error is a failed final compile: part `compiled` fails with code
   `final-compile`, the error lines verbatim. Never retry it, never pick another `build_name`, and never work
   around it. On success, the new record's `v1` and `v2` verdicts over every stage are the verdict's, as in
   step 2.

## Writes

The verdict file `reports/gates/D2-gate-<concept>-a<attempt>.json`, and nothing else: the server writes the
record, the XML and the PoB file.

```json
{
  "stage": "D2-gate",
  "concept": "c1",
  "attempt": 1,
  "verdict": { "compiled": "pass", "v1": "pass", "v2": "pass" },
  "findings": [],
  "finalCompile": { "compiled": true, "errors": [], "recordPath": "compile-record.json", "pobFile": "titan-blood-hunt-2026-10-08-1.xml" }
}
```

- `verdict`: each part `pass`, `fail` or `unverified`; `findings`: `{part, code, stage, message, accepted?}`.
- `finalCompile`, when step 3 ran: `compiled`, whether it succeeded; `errors`, its error lines verbatim;
  `pobFile`, the new record's `pobFile.path`, or `null` when it failed. Don't copy the import code:
  `compile-record.json` is its one home, and W1 copies it from there (D-260).

## Returns

At most 8 lines: the verdict in one line, the verdict file, and the PoB file when the final compile wrote
it.

```
D2-gate c1 attempt 1: compiled pass, v1 pass, v2 pass; final compile written
reports/gates/D2-gate-c1-a1.json
titan-blood-hunt-2026-10-08-1.xml
```

## Fault directives

None.
