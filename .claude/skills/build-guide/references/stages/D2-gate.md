# D2-gate: check every stage, then the final compile (`build-guide-coordinator`)

Slice 03 §5.3 step 4; spine C-17, C-33, D-113, D-192, D-199, D-205, D-208, D-211. A fresh coordinator step
after every D2 attempt. It compiles the whole plan measure-only and checks that it compiled and that V1
(tree continuity included) and V2 pass for **every** stage. Once that verdict passes, the workflow starts
this gate's final compile, the run's only write into the builds folder. The header's `compile` says which
of the two calls you are: `measure-only` is the check, `final` is the final compile. You check; you don't
design. Fix nothing in the plan: a failure goes back to D2 as findings.

## Inputs

- **Header:** `stage: "D2-gate"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`, `compile`
  (`measure-only` or `final`), `buildName` (with `final` only), `accepted` (findings the user accepted),
  `writes: []`.
- **Read:** `plan.json`; after the compile, `compile-record.json`;
  `.claude/skills/build-guide/references/gates.md`.

## Work

**`compile: "measure-only"`, the check:**

1. Compile the whole plan measure-only: `compile_plan {plan_path: "<runFolderRel>/plan.json",
   measure_only: true}`, with no `stages`. A compile error is part `compiled` failing (code
   `compile-error`, the error line as the message, the plan stage it names as `stage`); then `v1` and `v2`
   are `unverified` and the step ends.
2. Read `compile-record.json`. For every stage in `stagesCompiled`, each finding of its `v1` and `v2`
   verdicts becomes a gate finding: part `v1` or `v2`, the record's `code` unchanged, the plan stage as
   `stage`, the record's message. A part with any finding is `fail`.
3. Report every failure, the accepted ones included: the workflow sets aside a failure equal to one in the
   header's `accepted` (same plan stage, part and code), not you.
4. Don't run the final compile: the workflow starts it, as a second call of this gate attempt, once this
   verdict passes.

**`compile: "final"`, the final compile** (the measure-only check of this attempt passed):

1. Call `compile_plan {plan_path: "<runFolderRel>/plan.json", build_name: "<the header's buildName>"}`
   exactly once: the whole plan, not measure-only. It writes the PoB file into the builds folder through
   the server (C-17), and `compile-record.json` with `importCode` and the PoB file's path (D-205).
2. A refusal (C-17's "already exists" or changed-on-disk wording, the write ledger's rule, D-211) or a
   compile error is a failed final compile: report the error lines in `errors`. Never retry it, never pick
   another `build_name`, and never work around it.
3. On success, read the new record and return its `v1` and `v2` verdicts over every stage, as in the check,
   and its `pobFile.path`. Don't return the import code: `compile-record.json` is its one home, and W1 copies
   it from there (D-260).

## Writes

Nothing: `writes` is empty. The server writes the record, the XML and the PoB file.

## Returns

Your last message is this JSON and nothing after it.

The check (`measure-only`):

```json
{
  "verdict": { "compiled": "pass", "v1": "fail", "v2": "pass" },
  "findings": [
    { "part": "v1", "code": "tree-continuity", "stage": "3", "message": "stage 3 drops node 4031 from stage 2 with no respec" }
  ],
  "recordPath": "compile-record.json"
}
```

The final compile (`final`):

```json
{
  "compiled": true,
  "errors": [],
  "recordPath": "compile-record.json",
  "pobFile": "titan-blood-hunt-2026-10-08-1.xml",
  "verdict": { "v1": "pass", "v2": "pass" },
  "findings": []
}
```

- `verdict`: each part `pass`, `fail` or `unverified`; `findings`: `{part, code, stage, message}`.
- `compiled`: whether the final compile succeeded; `errors`: its error lines verbatim.
- `pobFile`: the new record's `pobFile.path`, or `null` when it failed. The workflow records the final
  compile in this attempt's verdict as `finalCompile {compiled, errors, recordPath, pobFile}`, with no import
  code (D-260).

## Fault directives

None.
