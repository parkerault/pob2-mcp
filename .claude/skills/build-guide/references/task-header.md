# The task header

Every agent prompt, in both orchestrations (the workflows and the Agent-tool fallback), starts with a
fenced `json` block: the task header (slice 03 §5.1). The agent reads its job from the header and from
the stage reference it names; the rest of the prompt adds nothing the header contradicts.

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
| `stage` | `R1a`, `R1b`, `R1b-assemble`, `dossier-fix`, `D1`, `D1-gate`, `D2`, `D2-gate`, `W1`, `V3`, `V4` or `revise-map` |
| `attempt` | this step's attempt for its (stage, concept), from 1 |
| `concept` | the concept id (`c<n>`), where the step concerns one |
| `lens` | V4 only: `ledger`, `sources` or `prose` |
| `pass` | V3 and V4 only: the verification round, from 1 |
| `mode` | `offline` or `online`, as the run log records it |
| `runFolder` | the run folder's absolute path, from `guide_run {new_run}` |
| `runFolderRel` | the run folder relative to the guides root; a plan's `plan_path` is `<runFolderRel>/plan.json` |
| `compile` | `none`, `measure-only` or `final`: what this step may ask `compile_plan` for |
| `buildName` | final compile only: `<slug>-<YYYY-MM-DD>-<n>` (`run-folder.md`) |
| `findings` | earlier attempts' findings, routed V3/V4 findings, or the user's revision requests and guidance |
| `accepted` | findings the user accepted at an escalation, as the run log records them; an equal finding (same plan stage, part and code, or a V3/V4 `id`) fails no gate |
| `faults` | offline test mode only: this step's fault directives (`offline-and-test.md`) |
| `writes` | the run-folder paths this step may write, relative to `runFolder`; nothing else |
| `reference` | the step's stage reference, under `references/stages/` |

Rules:

- **Only the header's paths.** A step writes only the paths in `writes`, all inside the run folder
  (D-177). Steps running in parallel never share a path.
- **Fresh verifiers** (R-5, D-142). A V3 or V4 prompt carries the header and nothing written by the steps
  that produced the plan or the guide: no D1, D2 or W1 output text, only paths. The verifier reads the
  artifacts itself.
- **Compile only as the header says.** `compile: "none"` means no `compile_plan` call;
  `measure-only` means `measure_only: true`; only the D2 gate's passing step carries `final`, with
  `buildName`.
- **Faults travel only in headers**, only in offline test mode, and only to the steps they target.
