# Offline mode, the test config and fault directives

(slice 03 §11; D-201, D-233, A-28, D-157)

## Offline mode (`--offline`)

Started only explicitly, with `--offline`; the run log records `mode: "offline"`. In offline mode:

- **No web and no prices.** No step calls a trade tool, `mcp__pob2__get_currency_rates`, WebSearch or WebFetch, even
  if one is available. In the M-12 environment those tools are removed, so the rule is enforced, not just
  followed.
- **Research uses only the server's lookup tools and the committed C1/E1 files** (`data/campaign/`,
  `data/enemies/`), not `docs/design/grounding/`. A claim taken from C1/E1 cites its fact as
  `data:<file>#<key>` in the plan, or `data | <file>#<key>` in markdown (D-232).
- **Every price is `unavailable`** with `note: "offline run"`, `league: null`, `amount` and `currency`
  null, dated the run folder's date (D-164); the plan's `league` is null, which the plan schema allows
  only when every price is like that (D-233). See `pricing.md`.
- **A claim that would need an external source** is tagged `external-unavailable`, with ref exactly
  `external source unavailable (offline run)` and a confidence (C-30). V4 accepts that tag (status
  `accepted-offline`) only when the run log's mode is `offline`; in any other run it is an `unresolved`
  finding, and the run checker fails it.
- The guide's first section says the run was offline: prices are unavailable and no external source was
  consulted.

## The test config (`--test <path>`, offline only; A-28)

`--test <path>` names a JSON file:

```json
{
  "answers": {
    "checkpoint1": ["first-viable"],
    "checkpoint2": ["accept"],
    "escalation": ["retry:keep the budget variant's helmet"],
    "unsavedBuild": "proceed"
  },
  "faults": [
    { "id": "FI-1", "concepts": ["c1"], "persistent": true },
    { "id": "FI-2", "concepts": "all", "persistent": false }
  ]
}
```

- **Accepted only with `--offline`.** Then `testConfig: "accepted"`: its answers replace the user's at
  checkpoints and questions (`checkpoints.md` lists what each answer means and the defaults when they run
  out), and its faults are applied.
- **Without `--offline`** the runner records `testConfig: "refused"`, ignores the file (no answer, no
  fault) and asks the user at every checkpoint (D-157). Say so in the reply.
- A file that can't be read or isn't this shape, given with `--offline`, is refused too
  (`testConfig: "refused"`), and the run stops before research: status `stopped`, and the reason in the
  reply (`stopped: malformed test config <path>: <what is wrong>`).
- Without `--test`, `testConfig: "none"`.

## Fault directives (test config only)

Each directive names its target concepts (a list of ids, or `"all"`) and whether it is `persistent`
(every attempt) or applies to attempt 1 only (`persistent` missing or `false`). The runner puts a
directive only into the task headers of the steps it targets, in the header's `faults` (`task-header.md`).
The step that applies one reports it, and the runner logs each directive in `faults[]` as
`{id, target, applied, observed}` (`target` as the test config wrote it; `applied` counts the headers that
carried it; `observed` says what failed as a result).

**Retries** (amendment 1 S6). An attempt failed by a directive that applies to attempt 1 only re-runs
free: it counts against no retry cap. A persistent directive's failed attempts count, so the cap still
ends the flow: run A's persistent FI-1 fails `c1` after 3 attempts, and run B's persistent FI-2 escalates
`c2`'s D1 gate on its third failure. The run checker counts the same way.

| Id | Applied by, when | Edit | Must then fail |
|---|---|---|---|
| FI-1 | the R1b step, before the attempt's first compile: the bootstrap, which then always runs (`stages/R1b.md` step 2), so a faulted attempt compiles nothing clean and a concept it fails leaves no clean record (D-265) | add a support gem named `FI-1 Unknown Gem` to the skeleton's main socket group | that first compile, with a per-stage error naming the gem (D-162); the attempt stops there |
| FI-2 | the D1 gate step, before its compile | set the first endgame stage's `level` to 1 in `plan.json`, and its `loadoutName`'s `(L<n>)` to `(L1)` so the plan stays valid (C-31 ties the two) | V1, for that stage: its points and requirements exceed level 1 |
| FI-3 | the D1 gate step | none: the gate's outcome is forced to `infeasible`, with evidence `FI-3 (injected)` | control flow only: the route back to checkpoint 1 |

FI-4 and FI-5 (the seeded V4 checks) are applied by the build coordinator to a copy of a run folder, not
through the skill.
