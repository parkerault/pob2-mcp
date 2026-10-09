# The run log `run-log.json`

The runner writes `run-log.json` in the run folder as soon as the folder exists, and rewrites it whole
after every step, checkpoint and question, so an interrupted run still leaves one (FR-W2; schema version 2,
amendment 1 §4.1). Only the runner writes it. It records the run's control flow; the artifacts record the
rest, and the run checker reads both (`run-folder.md`).

## Fields

| Field | Content |
|---|---|
| `schemaVersion` | `2` |
| `runFolder` | the absolute path `mcp__pob2__guide_run {new_run}` returned |
| `slug` | the run's slug (`run-folder.md`) |
| `roll` | `{ascendancy, skill}`, the names as `mcp__pob2__get_classes` and the gem lookup gave them |
| `status` | `running`, then `completed`, `not-accepted`, `stopped` or `escalated` |
| `mode` | `offline` or `online` |
| `testConfig` | `none`, `accepted` (a `--test` file with `--offline`) or `refused` (a `--test` file without `--offline`) |
| `stages[]` | one per agent call, in run order: `{stage, concept?, attempt, outcome, priceOutcomes?}` |
| `checkpoints[]` | `{checkpoint, visit, answer, answeredBy, rule?}` |
| `escalations[]` | gate escalations only: `{stage, concept, verdict, choice, guidance?}` |
| `faults[]` | offline test mode only: `{id, target, applied, observed}`; empty otherwise |
| `outputs` | `{plan, record, dossier, guide, pobFile}`: run-folder paths and the record's PoB path; `null` until produced. No import code: the record holds it (D-260) |

### Entry rules

- **`stages[]`** has one entry per Agent call, in run order: each R1a researcher and each V4 lens is its own
  entry. `stage` is `R1a`, `R1b`, `R1b-assemble`, `D1`, `D1-gate`, `D2`, `D2-gate`, `W1`, `V4-<lens>` (the
  full pass) or `V4-<lens>-recheck`. `concept` is set for every step but R1a and R1b-assemble. `attempt`
  counts the calls of that (stage, concept) from 1, re-runs included, and matches the header and the
  verdict file name. `outcome`:
  - `pass` or `fail` for a gate step (R1b, D1-gate, D2-gate) and a V4 lens (`fail`: it reported an
    `unresolved` finding);
  - `done` for a step that only produces, `infeasible` for D1 claiming it and for a D1 gate routed so;
  - `claims-edited` for a D1 or D2 of the fix round or a revision that returned `recompiled: no`: it edited
    claims in place and compiled nothing, so no gate of its own follows it (D-264). The run checker tells it
    from a redesign: the final record stays current, the plan may differ from the record's `planSha1` only in
    its claims and source tags (its build projection's sha1 equals the record's `buildSha1`, D-266), and the
    re-check stays with the lenses that raised a finding, plus the sources lens;
  - `escalated` for the gate attempt that escalated;
  - `missing` for an agent that returned without its file.
  A gate attempt's outcome is the one its verdict file routes to (`gates.md`), and the run checker holds the
  two together.
- **`priceOutcomes`**, on a pricing step (R1b, D1, D1-gate, D2) that made price calls: its calls counted by
  outcome, `{"ok": 12, "would_wait": 1}`, each key `ok`, `error` or a `[trade:<kind>]` kind (D-218,
  `pricing.md`). Never in an offline run. NFR-22 reads it: no `rate_limited` and no `locked_out`.
- **`checkpoints[]`**: `checkpoint` is `1`, `2`, `unsaved-build` or `escalation`; `visit` counts that
  checkpoint's visits from 1; `answer` is the effective answer (`pick:c2`, `more`, `stop`, `accept`,
  `revise:<text>`, `proceed`, `retry:<guidance>`, `checkpoint-1`, …); `answeredBy` is `user`, `pre-supplied`
  (the test config) or `default` (the test config had no answer left, `offline-and-test.md`). Only an
  accepted test config gives `pre-supplied` or `default`, and then `rule` records how the answer was
  reached: the test config's answer exactly as written (`first-viable`, `pick:c2`) for `pre-supplied`, or
  the default that applied (`no checkpoint1 answer left: stop`) for `default`. A user's answer has no
  `rule`. W1 quotes the rule of the entry that picked the guide's concept (`stages/W1.md`), and the run
  checker requires it. Research rounds are read from the checkpoint 1 answers `more` (D-235).
- **`escalations[]`**: `stage` is `D1-gate` or `D2-gate`; `verdict` is the escalated attempt's verdict file,
  `reports/gates/<stage>-<concept>-a<attempt>.json`, so the log copies no findings; `choice` is `accept`,
  `retry`, `checkpoint-1` or `stop` (D-236), with the user's `guidance` for `retry`. The escalations are in
  the order of the `stages[]` entries whose outcome is `escalated`.
- **`faults[]`**: each directive the test config gave, with its `target` as written (`{concepts, persistent}`),
  `applied` (how many headers carried it) and `observed` (what failed as a result).
- **`outputs`**: `plan`, `record`, `dossier` and `guide` are paths relative to the run folder; `pobFile` is
  the D2 gate verdict's `finalCompile.pobFile`. Don't copy the import code into the log: its one home is
  `compile-record.json`, which `record` names, and the guide holds a copy (D-260).

## Reading the requirements from the log

- **NFR-23** (the cost caps): at most 3 R1a entries and 3 R1b concepts per research round; three lenses per
  pass; at most 2 counted retries per gate (the run checker counts them from `stages[]`, S6 included); and
  at most 3 agents in flight, which the session's transcript shows.
- **NFR-22** (no 429s, no lock-outs): no `priceOutcomes` counts a `rate_limited` or `locked_out` call.

## A first write

```json
{
  "schemaVersion": 2,
  "runFolder": "/abs/guides/titan-blood-hunt/2026-10-08-1",
  "slug": "titan-blood-hunt",
  "roll": { "ascendancy": "Titan", "skill": "Blood Hunt" },
  "status": "running",
  "mode": "offline",
  "testConfig": "accepted",
  "stages": [],
  "checkpoints": [],
  "escalations": [],
  "faults": [],
  "outputs": { "plan": null, "record": null, "dossier": null, "guide": null, "pobFile": null }
}
```
