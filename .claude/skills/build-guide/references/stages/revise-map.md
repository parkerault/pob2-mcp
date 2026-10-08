# revise-map: map the user's revision requests to their owners (`build-guide-coordinator`)

Slice 03 §5.3 ("Resuming", `revision`), §5.5 and §10; spine D-236. At checkpoint 2 the user may ask for
changes. The design workflow then resumes with `{reason: "revision", round, requests}`, and this step runs
first: it decides, for each request, which step owns what the request changes. Every owner then re-runs
once with only its own requests, earliest first, followed by every step after it and V3 and V4 (slice 03
§5.5). A revision counts against no retry cap (D-236). This step only maps: it changes nothing.

## Inputs

- **Header:** `stage: "revise-map"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`,
  `compile: "none"`, `writes: []`, and `findings`:
  - the requests, one each: `{id: "r1", code: "user-request", message: <the user's words>}`;
  - on a re-run, why the earlier attempts' mappings couldn't be used (`unusable-mapping`, or `null-result`);
  - on a guided retry, the user's guidance last (`code: "user-guidance"`), which you follow.
- **Read** (as each request needs; paths relative to `runFolder`): `guide.md`, `plan.json` (which stages
  have a `variant`: those are the endgame), `dossier.md`, `compile-record.json`, `run-log.json`;
  `.claude/skills/build-guide/references/source-markers.md` for where each kind of claim lives.

## Work

For each request, find what must change to satisfy it, and map it to that artifact's owner by slice 03
§5.5's table:

| The request changes | `owner` | Then re-run (the workflow does this) |
|---|---|---|
| only `guide.md`: wording, order, explanations, emphasis, a missing section or warning, with no number, item, gem, tree, config or price changing | `W1` | V3, V4 |
| an endgame stage of `plan.json` (the budget or non-budget variant): its gear, gems, tree, config, level, ascendancy points, a price, or a ledger entry citing an endgame stage | `D1` | D1 gate, D2 gate and final compile, W1, V3, V4 |
| a campaign stage of `plan.json`: the leveling skills, gear, tree, respecs, campaign prices, or a ledger entry citing only campaign stages | `D2` | D2 gate and final compile, W1, V3, V4 |
| `dossier.md`: the concept comparison, the research notes, a dossier claim | `dossier-fix` | V3, V4 |

- **The earliest owner whose artifact must change.** The guide is regenerated after D1 or D2 re-runs, so a
  request that changes an endgame item and how the guide describes it is `D1` alone.
- **Two independent changes, two entries.** A request that needs both the dossier and the guide changed
  (nothing in the plan) gets one entry for `dossier-fix` and one for `W1`. A request touching both
  variants and the campaign gets `D1` and `D2`.
- **Beyond a revision's reach.** A request for another concept, skill or ascendancy can't be met by
  re-running a step of this design (a new concept is picked at checkpoint 1): map it to `D1`, where the
  concept's choices live, and say in `why` that it asks for more than a revision can change.
- No compile, no price call, no write. Lookups (`.claude/skills/build-guide/references/lookups.md`) are
  allowed when a request's owner depends on a game fact.

## Writes

Nothing (the header's `writes` is empty).

## Returns

Your last message is this JSON and nothing after it:

```json
{
  "mapping": [
    { "id": "r1", "owner": "W1", "why": "asks for a clearer rotation section; no plan value changes" },
    { "id": "r2", "owner": "D2", "why": "asks to level with a different skill before level 12" }
  ]
}
```

- Every request `id` of the header appears at least once; `owner` is `dossier-fix`, `D1`, `D2` or `W1`;
  `why` is one line.
- The workflow refuses a mapping that leaves a request out or names another id or owner, and re-runs this
  step with the reasons (up to 2 retries).

## Fault directives

None.
