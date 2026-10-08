# The run log `run-log.json`

The skill writes `run-log.json` in the run folder as soon as the folder exists, and rewrites it whole
after every workflow return, checkpoint, question and escalation, so an interrupted run still leaves
one (FR-W2, D-158). Only the skill writes it. The run checker requires every field below.

## Fields

| Field | Content |
|---|---|
| `schemaVersion` | `1` |
| `runFolder` | the absolute path `guide_run {new_run}` returned |
| `slug` | the run's slug (`run-folder.md`) |
| `roll` | `{ascendancy, skill}`, the names as `get_classes` and the gem lookup gave them |
| `mode` | `offline` or `online` |
| `orchestration` | `workflow`, or `agent-tool` for the fallback (`fallback.md`) |
| `testConfig` | `none`, `accepted` (a `--test` file with `--offline`) or `refused` (a `--test` file without `--offline`) |
| `status` | `running`, then `completed`, `not-accepted`, `stopped` or `escalated` |
| `startedAt`, `endedAt` | ISO 8601 UTC; `endedAt` is `null` while `running` |
| `caps` | always `{"concepts": 3, "lensesPerPass": 3, "retriesPerStage": 2, "fanOut": 3}`; `concepts` is per research round |
| `timeline[]` | `{what, startedAt, endedAt}`, one per workflow call, checkpoint, question and fallback agent call, in order |
| `stages[]` | one per attempt: `{stage, concept?, lens?, pass?, attempt, startedAt, endedAt, agents, outcome, findings}` |
| `agents` | `{total, byType: {<agent type>: n}, maxConcurrent}` |
| `retries[]` | `{stage, concept, count}`: cap-counted retries only |
| `rounds[]` | `{round, note, firstId, concepts, conceptsCompiled, startedBy}`, one per research round |
| `concepts[]` | `{id, title, round, status, attempts}`; `status` is `viable`, `failed` or `not-carried` |
| `conceptsCompiled` | how many skeletons R1b compiled in the whole run: the sum over `rounds[]` |
| `v4Passes[]` | `{concept, pass, lenses}` |
| `checkpoints[]` | `{checkpoint, visit, shown, answer, answeredBy, at}` |
| `escalations[]` | `{stage, concept, attempts, findings, choice, guidance?}` |
| `revisions[]` | `{round, requests: [{text, owner}]}` |
| `pricing` | `{calls: [{at, stage, tool, item, outcome}], totals: {calls, ok, unavailable, wouldWait, lockedOut, rateLimited}}` |
| `faults[]` | offline test mode only: `{id, target, applied, observed}`; empty otherwise |
| `outputs` | `{plan, record, dossier, guide, pobFile, importCode}`: run-folder paths, the record's PoB path and import code; `null` until produced |

### Entry rules

- **`stages[]`** has one entry per agent invocation, in run order: each R1a researcher, each V4 lens and
  each fallback call is its own entry. `outcome` is `pass` or `fail` for a gate step, `done` for a step
  that only produces, `infeasible` or `escalated` for the attempt that ended the flow that way, and
  `null-result` for an agent that returned nothing. `findings` is a count. `agents` is how many agents
  the attempt used (1 for one call).
- **Times.** Timestamps are ISO 8601 UTC from a real clock: the skill runner reads it with
  `date -u +%Y-%m-%dT%H:%M:%SZ`. Workflow scripts can't read a clock, so in workflow mode an attempt's
  `startedAt` and `endedAt` are `null` unless a record supplies them (a compile record's `compiledAt`, a
  price's `Checked:` line). In fallback mode the skill stamps every attempt. `startedAt` ≤ `endedAt`
  wherever both are set, and `timeline[]` is in order. No agent gains Bash or a network tool for timing.
- **`retries[]`** counts only cap-counted retries: a user's revision and a guided retry count against no
  cap (D-236), so they don't appear here; their attempts still appear in `stages[]`.
- **`rounds[]`**: the first round is `startedBy: "user"` (the invocation); a later round is `user` when
  the user answered "ask for more" at checkpoint 1, `pre-supplied` when the test config did. `concepts`
  lists the ids the round carried; `conceptsCompiled` how many of them R1b compiled.
- **`checkpoints[]`**: `checkpoint` is `1`, `2`, `unsaved-build` or `escalation`; `visit` counts that
  checkpoint's visits from 1; `shown` is what was presented, in short; `answer` the effective answer
  (`pick:c2`, `more`, `stop`, `accept`, `revise:<text>`, `proceed`, `retry:<guidance>`, …);
  `answeredBy` is `user`, `pre-supplied` (the test config) or `default` (the test config had no answer
  left, `offline-and-test.md`). Only an accepted test config gives `pre-supplied` or `default`.
- **`escalations[]`**: `findings` is the list of findings the escalation showed (each with `stage`,
  `code` or `id`, and `part` for a gate finding); `choice` is `accept`, `retry`, `checkpoint-1` or `stop`
  (D-236).
- **`pricing.calls`**: every price-tool call any coordinator step made, as the step reported it
  (`pricing.md`). `outcome` is `ok`, the `<kind>` of an error's `[trade:<kind>]` prefix (`would_wait`,
  `locked_out`, `rate_limited`, `http`, …), or `error` for an error without the prefix. `at` is the
  result's `Checked:` time, `null` for an error. `totals.calls`, `ok`, `wouldWait`, `lockedOut` and
  `rateLimited` count `calls` by outcome; `unavailable` counts the price entries that ended `unavailable`.
- **`outputs`**: `plan`, `record`, `dossier` and `guide` are paths relative to the run folder;
  `pobFile` is the final record's `pobFile.path`; `importCode` is its `importCode`.

## What the workflows return for the log

Each workflow returns `stats` beside its result (slice 03 §5.2, §5.3), and the skill folds it in:

```json
"stats": {
  "attempts": [ { "stage": "R1b", "concept": "c1", "attempt": 1, "agents": 1, "outcome": "pass", "findings": 0 } ],
  "agents": { "total": 6, "byType": { "build-guide-researcher": 3, "build-guide-coordinator": 3 }, "maxConcurrent": 3 },
  "retries": [ { "stage": "R1b", "concept": "c2", "count": 1 } ],
  "priceCalls": [ { "at": "2026-10-08T10:12:31Z", "stage": "R1b", "tool": "get_item_price", "item": "…", "outcome": "ok" } ],
  "faults": [ { "id": "FI-1", "target": { "concepts": ["c1"], "persistent": true }, "applied": 1, "observed": "…" } ],
  "revision": [ { "request": "…", "owner": "W1" } ]
}
```

- `attempts` become `stages[]` entries (times `null` in workflow mode); `agents` adds into `agents`
  (`maxConcurrent` is the largest seen); `retries` merge by (stage, concept); `priceCalls` append to
  `pricing.calls`; `faults` append to `faults[]`; `revision`, after a checkpoint-2 revision, becomes that
  revision's `requests` (`{text, owner}`).
- `gateVerdicts`, `v3Reports` and `v4Reports` are written to `reports/` unchanged (`run-folder.md`);
  each report goes in `v4Passes[]` and each verdict's concept in `concepts[]` as the run proceeds.

## Reading the requirements from the log

- **NFR-23** (the cost caps): every `rounds[].conceptsCompiled` ≤ 3, every `v4Passes[].lenses` ≤ 3,
  every `retries[].count` ≤ 2, and `agents.maxConcurrent` ≤ 3.
- **NFR-22** (no 429s, no lock-outs): `pricing.totals.rateLimited` = 0 and `lockedOut` = 0.

## A first write

```json
{
  "schemaVersion": 1,
  "runFolder": "/abs/guides/titan-blood-hunt/2026-10-08-1",
  "slug": "titan-blood-hunt",
  "roll": { "ascendancy": "Titan", "skill": "Blood Hunt" },
  "mode": "offline",
  "orchestration": "workflow",
  "testConfig": "accepted",
  "status": "running",
  "startedAt": "2026-10-08T10:00:00Z",
  "endedAt": null,
  "caps": { "concepts": 3, "lensesPerPass": 3, "retriesPerStage": 2, "fanOut": 3 },
  "timeline": [ { "what": "guide_run new_run", "startedAt": "2026-10-08T10:00:00Z", "endedAt": "2026-10-08T10:00:01Z" } ],
  "stages": [], "agents": { "total": 0, "byType": {}, "maxConcurrent": 0 }, "retries": [], "rounds": [],
  "concepts": [], "conceptsCompiled": 0, "v4Passes": [], "checkpoints": [], "escalations": [], "revisions": [],
  "pricing": { "calls": [], "totals": { "calls": 0, "ok": 0, "unavailable": 0, "wouldWait": 0, "lockedOut": 0, "rateLimited": 0 } },
  "faults": [],
  "outputs": { "plan": null, "record": null, "dossier": null, "guide": null, "pobFile": null, "importCode": null }
}
```
