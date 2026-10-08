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

What changes: the skill builds each header itself from the run state, and it stamps every agent call's
`startedAt` and `endedAt` (in `stages[]` and `timeline[]`), since it can read the clock. The run checker
fails a fallback run with any `null` stamp, so stamp mechanically:

1. **Before each Agent call**, run `date -u +%Y-%m-%dT%H:%M:%SZ` as its own Bash call and keep the reading
   as that call's `startedAt`.
2. **After each Agent call returns**, run the same `date` command again and keep the reading as its
   `endedAt`.
3. **Sequential calls** (R1b's concepts one at a time, D1 then the D1 gate): one reading serves twice, as
   the returned call's `endedAt` and the next call's `startedAt`, so a `date` call sits between every two
   Agent calls.
4. **Calls in flight together** (R1a's researchers, V3 with the V4 lenses): one reading before you start
   them is each one's `startedAt`; a call that runs in the background gets its `endedAt` from a `date` run
   when its notification arrives, a foreground call from the `date` run right after it returns.
5. **Write the readings into the attempt**: its `stages[]` entry's `startedAt` and `endedAt`, and a
   `timeline[]` entry `{what, startedAt, endedAt}` naming the step, the concept and the attempt, in the next
   run-log write. Never leave a stamp to fill in later: a later reading isn't that call's time.

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

Steps off the happy path (slice 03 §5.3, §5.5):

| Step (`stage`) | Agent type | When | Compile |
|---|---|---|---|
| `dossier-fix` | `build-guide-coordinator` | a V3/V4 finding in `dossier.md`, or a revision request mapped to it (it edits `dossier.md` only) | `none` |
| `revise-map` | `build-guide-coordinator` | first, when the design resumes for a checkpoint-2 revision; it writes nothing | `none` |

## V3 and V4 (slice 03 §5.3 step 6, §7.4)

Each pass runs `V3` and the three `V4` lenses as fresh agents, at most 3 in flight. Their headers carry the
§5.1 fields only: no `findings` but why an earlier attempt of the same pass couldn't be used, and in
`accepted` only the `gate`, `id`, `artifact` and `location` of findings the user accepted (R-5, D-142). A
verifier that returns nothing, or a report that can't be used, re-runs within its pass, as a retry of its
stage (`V3`, or `V4` for the lenses). A report can't be used when its `stage`, `lens`, `concept`, `pass` or
`mode` differ from its header, a finding lacks a §7.4 field or names another owner, `verdict` disagrees
with its `unresolved` findings, an online report says `accepted-offline` (C-30), or its coverage falls short
of D-179 (`rederived` = `entries`; `dataChecked` = `data`; `recheckedEndgame` ≥ `pobDataEndgame`;
`recheckedOther` ≥ `pobDataOther` / 5, rounded up; `opened` = `external` online, 0 offline). Every report
returned goes to `reports/`; a later attempt of the same pass replaces its file.

## Routing V3 and V4 findings (slice 03 §5.5)

Each `unresolved` finding names its `owner`, the step that wrote the claim:

| Finding is in | Owner | After the owner's re-run |
|---|---|---|
| `guide.md` | `W1` | V3, V4 |
| an endgame stage of `plan.json`, a ledger entry citing one, an endgame price | `D1` | D1 gate, D2 gate and final compile, W1, V3, V4 |
| a campaign stage, or a ledger entry citing only campaign stages | `D2` | D2 gate and final compile, W1, V3, V4 |
| `dossier.md` | `dossier-fix` | V3, V4 |

- One round re-runs each owner once with all its findings in its header's `findings`, earliest first
  (`dossier-fix`, `D1`, `D2`, `W1`), then the steps after it; a step two owners share runs once. The D2
  gate after a D1 re-run is a fresh gate. W1 after a D1 or D2 re-run in the round writes the guide anew
  from the current plan and record, and only then applies its own findings or requests, if it has any; D2
  after D1 likewise re-plans the campaign against the new endgame first.
- A re-run spends one of that owner's 2 retries (D-127; `dossier-fix` counts as its own stage in
  `retries[]`); the regenerations after it don't. A gate failure after it re-runs its producer as usual,
  from the retries left. An owner with no retry left (a third round) ends the flow `escalated`, at the
  first finding's report (`V3` or `V4`), with that pass's findings as evidence.
- Each round re-runs V3 and all three lenses, as the next pass. Findings marked `accepted-offline`, and
  findings the user accepted at an escalation (the same report, `id`, `artifact` and `location`; a
  `<H2 title>, line <n>` location by its section), aren't routed. With no
  `unresolved` finding left, the result is `ready`.

## Resuming (slice 03 §5.3; D-236)

Every resume carries `attempts` (each stage's attempts so far; for V3 and V4 the highest pass). A guided
retry and an accepted resume also carry `retries`, the cap-counted retries each stage of the concept already
used (the run log's `retries[]`), so a routed re-run never takes a stage past 2 across calls.

- **`revision`** (checkpoint 2), `{reason: "revision", round, requests, attempts}`: `revise-map` maps each
  request to its owner by the table above and returns `{mapping: [{id, owner, why}]}` (requests are
  `r1`, `r2`, … in order). A mapping that leaves a request out or names another id or owner re-runs it,
  up to 2 retries; then `escalated` at `revise-map`. Each owner re-runs once with only its own requests as
  `findings` (`code: "user-request"`), earliest first, then the steps after it, then V3 and V4, routed as
  above. The revision counts against no cap: a gate failure after it gets the usual 2 retries, and every
  `retries[]` entry of the call carries the revision `round`.
- **`guided-retry`** (escalation choice 2): the escalated stage runs once more with its findings and the
  user's guidance in `findings`, outside the cap; a failure escalates again.
  - At `V3` or `V4`, the findings' owners re-run once with their findings and the guidance, then the steps
    after them, then one pass of V3 and V4 whose failure escalates again; at `revise-map`, it maps once
    more (the resume carries the revision's `round` and `requests`); at `dossier-fix`, it re-runs once,
    then V3 and V4.
- **`accepted`** (escalation choice 1): the failed gate step runs again with the findings in `accepted`;
  equal findings fail no gate from then on, and W1's header carries them so the guide lists them. After a
  V3/V4 escalation W1 re-runs, so the guide states the accepted findings, then V3 and V4, with those
  findings covered by id (D-253). Not offered at `W1` or `dossier-fix`, which escalate only when they
  return nothing, nor at `revise-map`, which mapped nothing.
- A resume after an escalation that came from a revision passes that revision's `round` back, and its
  `retries` are that round's.
