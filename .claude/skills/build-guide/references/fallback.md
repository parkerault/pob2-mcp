# The Agent-tool fallback

(slice 03 §5.6; D-172, A-23, R-26)

## When

The skill runs the workflows' steps itself, with the Agent tool, when:

- the Workflow tool isn't in the session;
- a `Workflow({name, args})` call fails before any agent starts; or
- the accepted test config says `"orchestration": "agent-tool"`.

The run log then records `orchestration: "agent-tool"`. Once the run falls back it stays on the fallback,
and a timeline entry says why.

## What stays the same

Everything but the orchestrator: the same agent types (always as `subagent_type`, never a default agent,
which would see every tool), the same task headers (`task-header.md`) and stage references, the same
gates, retries and caps, routing, resume paths and artifacts. At most **3 Agent calls in flight** at any
time (D-161). The skill takes each step's gate verdict or report from the agent's final JSON and writes
it to `reports/` as the workflow would have (`run-folder.md`).

What changes: the skill stamps every agent call's `startedAt` and `endedAt` (in `stages[]` and
`timeline[]`), since it can read the clock, and it builds each header itself from the run state.

## The steps, in order

The research workflow `build-guide-research` (slice 03 §5.2), once per research round:

| # | Step (`stage`) | Agent type | Runs | Compile |
|---|---|---|---|---|
| 1 | `R1a` | `build-guide-researcher` | up to 3 in parallel, each writing its own `research/p<round>-r1a-<n>.md` | `none` |
| 2 | `R1b` | `build-guide-coordinator` | one concept at a time, in id order; at most 3 concepts carried per round; up to 2 retries each | `measure-only` |
| 3 | `R1b-assemble` | `build-guide-coordinator` | once, writing `dossier.md` | `none` |

The design-and-write workflow `build-guide-design` (slice 03 §5.3), once per chosen concept:

| # | Step (`stage`) | Agent type | Runs | Compile |
|---|---|---|---|---|
| 1 | `D1` | `build-guide-coordinator` | the endgame variants; up to 2 retries | `measure-only` |
| 2 | `D1-gate` | `build-guide-coordinator` | a fresh step after each D1 attempt | `measure-only` |
| 3 | `D2` | `build-guide-coordinator` | the campaign stages; up to 2 retries | `measure-only` |
| 4 | `D2-gate` | `build-guide-coordinator` | a fresh step after each D2 attempt; on a pass, the final compile | `measure-only`, then `final` |
| 5 | `W1` | `build-guide-writer` | writes `guide.md` | `none` |
| 6 | `V3` | `build-guide-provenance` | with the three V4 lenses, at most 3 in flight | `none` |
| 7 | `V4` (`ledger`, `sources`, `prose`) | `build-guide-verifier` | one fresh agent per lens | `none` |

Steps off the happy path:

| Step (`stage`) | Agent type | When |
|---|---|---|
| `dossier-fix` | `build-guide-coordinator` | a V3/V4 finding in `dossier.md` (it edits `dossier.md` only; counts as R1b) |
| `revise-map` | `build-guide-coordinator` | first, when the design resumes for a checkpoint-2 revision |

## Routing V3 and V4 findings (slice 03 §5.5)

Each `unresolved` finding names its `owner`, the step that wrote the claim:

| Finding is in | Owner | After the owner's re-run |
|---|---|---|
| `guide.md` | `W1` | V3, V4 |
| an endgame stage of `plan.json`, a ledger entry citing one, an endgame price | `D1` | D1 gate, D2 gate and final compile, W1, V3, V4 |
| a campaign stage, or a ledger entry citing only campaign stages | `D2` | D2 gate and final compile, W1, V3, V4 |
| `dossier.md` | `dossier-fix` | V3, V4 |

One round re-runs each owner once with all its findings (earliest owner first), then the steps after it.
A re-run counts as that owner's retry; the regenerations after it don't. Each round re-runs V3 and all
three lenses. A third round for the same owner escalates. Findings marked `accepted-offline`, and findings
the user accepted at an escalation, aren't routed. With no `unresolved` finding left, the result is
`ready`.

## Resuming (slice 03 §5.3; D-236)

- **`revision`** (checkpoint 2): `revise-map` maps each request to its owner by the table above; each
  owner re-runs once with only its own requests as `findings`, earliest first, then the steps after it.
  The revision counts against no cap; a gate failure after it gets the usual 2 retries.
- **`guided-retry`** (escalation choice 2): the escalated stage runs once more with its findings and the
  user's guidance in `findings`, outside the cap; a failure escalates again.
- **`accepted`** (escalation choice 1): the failed gate step runs again with the findings in `accepted`;
  equal findings fail no gate from then on, and W1's header carries them so the guide lists them. After a
  V3/V4 escalation W1 re-runs, so the guide states the accepted findings, then V3 and V4, with those
  findings covered by id (D-253).
