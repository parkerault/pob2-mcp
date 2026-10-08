# The task header

Every agent prompt starts with a fenced `json` block: the task header (slice 03 §5.1, as amendment 1
changes it). The runner builds it from the run state; the agent reads its job from the header and from the
stage reference it names, and the rest of the prompt adds nothing the header contradicts.

````
```json
{
  "stage": "D1",
  "attempt": 1,
  "concept": "c1",
  "mode": "offline",
  "runFolder": "/abs/guides/titan-blood-hunt/2026-10-08-1",
  "runFolderRel": "titan-blood-hunt/2026-10-08-1",
  "compile": "measure-only",
  "findings": [],
  "accepted": [],
  "faults": [],
  "writes": ["plan.json"],
  "reference": ".claude/skills/build-guide/references/stages/D1.md"
}
```
````

| Field | Content |
|---|---|
| `stage` | `R1a`, `R1b`, `R1b-assemble`, `D1`, `D1-gate`, `D2`, `D2-gate`, `W1` or `V4` |
| `attempt` | this step's attempt for its (stage, concept), from 1: every call counts, retries and re-runs included |
| `concept` | the concept id (`c<n>`), where the step concerns one |
| `lens` | V4 only: `ledger`, `sources` or `prose` |
| `check` | V4 only: `full` (step 11, every claim in the lens) or `recheck` (step 13, only `findings` and `changed`) |
| `mode` | `offline` or `online`, as the run log records it |
| `runFolder` | the run folder's absolute path, from `mcp__pob2__guide_run {new_run}` |
| `runFolderRel` | the run folder relative to the guides root; a plan's `plan_path` is `<runFolderRel>/plan.json` |
| `compile` | `none`, `measure-only` or `final`: what this step may ask `mcp__pob2__compile_plan` for |
| `buildName` | the D2 gate only: `<slug>-<YYYY-MM-DD>-<n>` (`run-folder.md`), for its final compile |
| `findings` | what to fix or check: the earlier attempt's gate verdict (its file and findings), the V4 findings routed to this owner, the user's revision requests (`code: "user-request"`) or guidance (`code: "user-guidance"`); for a V4 re-check, the lens's own open findings; `[]` otherwise |
| `changed` | a V4 re-check only: the locations the fix round's owners changed (`plan.json stages[2].claims[1]`, `guide.md Summary`), or `"all"` when the fix round re-ran D1 or D2 (every claim is checked again) |
| `accepted` | gate findings the user accepted at an escalation, from its verdict file; an equal finding (same plan stage, part and code) fails no gate |
| `faults` | offline test mode only: this step's fault directives (`offline-and-test.md`) |
| `writes` | the run-folder paths this step may write, relative to `runFolder`; nothing else |
| `reference` | the step's stage reference, under `references/stages/` |

Rules:

- **Only the header's paths.** A step writes only the paths in `writes`, all inside the run folder
  (D-177). Steps running in parallel never share a path. A gate step's `writes` include its verdict file,
  `reports/gates/<stage>-<concept>-a<attempt>.json`.
- **Fresh verifiers** (R-5, D-142). A V4 prompt is the header and the reference line, nothing else: no D1,
  D2 or W1 output text, only paths. The verifier reads the artifacts itself. A re-check's `findings` are the
  verifier's own, and `changed` holds locations, never text.
- **Compile only as the header says.** `compile: "none"` means no `mcp__pob2__compile_plan` call;
  `measure-only` means `measure_only: true`; only the D2 gate carries `final`, with `buildName`, and it
  compiles measure-only first.
- **Faults travel only in headers**, only in offline test mode, and only to the steps they target.
