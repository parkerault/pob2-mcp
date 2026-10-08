# R1b: concept skeleton, measure-only compile, key-item prices (`build-guide-coordinator`)

Slice 03 §5.2 step 3; spine C-36, D-208. One step per carried concept, one at a time. It turns a research
proposal into an endgame skeleton plan, compiles it measure-only, and prices the concept's key items.
**Gate:** the skeleton compiled with no compile error. A failed attempt re-runs with the errors as
findings, at most 2 retries; then the concept is `failed`, with its last errors as evidence (D-141).

## Inputs

- **Header:** `stage: "R1b"`, `attempt`, `concept` (`c<n>`), `mode`, `runFolder`, `runFolderRel`,
  `compile: "measure-only"`, `findings` (earlier attempts' gate findings: fix what each names), `faults`
  (FI-1, offline test runs only), `writes: ["concepts/<id>/plan.json"]`.
- **Prompt:** the roll, the concept's title, the research file that proposed it, and how to price in
  this run (offline; stopped; or paced).
- **Read:** the proposal (`## Concept: <title>` in that research file) and the round's other research
  files for the mechanics; `docs/build-guide/plan-reference.md` (every field, and the worked example);
  `pob-pin.json` (the pin's tag and commit); the data under `data/` for scenario inputs; `run-log.json`
  (has pricing stopped?); the other plans of this run (`concepts/*/plan.json`), for prices to reuse. On
  attempt 2 or 3, your earlier skeleton at `concepts/<id>/plan.json` is there to fix.

## Work

1. **Write the skeleton** `concepts/<id>/plan.json` (C-31), a plan that tests the concept at the
   endgame, not a guide:
   - `roll` is the run's roll (class, ascendancy, skill), exactly as the prompt names them.
   - `versions`: `pobTag` and `pobCommit` from `pob-pin.json`; `treeVersion`, `enginePatch` and
     `externalPatch` as the plan reference describes. The compile record notes any that differ from the
     engine.
   - `league`: offline, `null`; online, the current trade league from `get_leagues`. If trade can't be
     reached, reuse the league of another plan in this run, else `Standard`.
   - **One stage**, `id` `<id>e` (the concept id and `e`, e.g. `c2e`: so a dossier ref like
     `c2e.Life` names this concept's record), `progress: "endgame"`, no `variant`, a `level` the
     concept is meant to play at (90 when the proposal doesn't say), and
     `loadoutName` `<short title> (L<level>) {<id>e}`.
   - `tree`: the ascendancy nodes and the notables and keystones the concept rests on, connected to
     the class start through listed nodes (`search_tree_nodes` to find them; `get_nearby_nodes` and
     `find_path_to_node` read the loaded build, so use them only after a compile), and no more points
     than the level allows (`data/campaign/limits.json`).
   - `items`: each key unique's text from `lookup_game_data {mode: "unique", query: <exact name>}`
     (full text comes only for a single match); plain bases or simple rares for the other slots the
     skill needs (its weapon first).
   - `skills`: the rolled skill's group with the concept's supports, each group with a `role` (the
     rolled skill's is `clear` or `single_target`), `main` on the rolled skill, and `rolledGroup`.
   - `config`: the earned states the concept relies on, each that is on with its producer and uptime;
     `scenario` lists `enemyIsBoss` and the endgame resistance penalty, each from a data fact with its
     tag, as in the worked example.
   - `claims` may stay empty; any claim carries a source. `ledger` is `[]`.
2. **Prices** (`.claude/skills/build-guide/references/pricing.md`), one `prices[]` entry per key item
   (each key unique; a key base only where the concept depends on it), with id `<id>-<item>` (e.g.
   `c2-weapon`):
   - **offline:** no price call. Each entry is `unavailable` with note `offline run`, `amount`,
     `currency` and `league` null, dated the run folder's date (the `YYYY-MM-DD` in its last path
     segment).
   - **pricing stopped** (the prompt says so, or `run-log.json` records a `locked_out` or `rate_limited`
     call): no price call; each entry is `unavailable`, note `pricing stopped`.
   - **online:** reuse an entry with the same item, query and league from any plan of this run first;
     otherwise one call per item, paced by order. Record each result's league and its `Checked:` date;
     report every call in `priceCalls`.
3. **Validate**: `guide_run {validate: "<runFolderRel>/concepts/<id>/plan.json"}`. Fix every error it
   reports (schema errors by JSON path; unknown gems with suggestions; item text; nodes and their
   connection; config options) and validate again, until it reports none or you can't fix one.
4. **FI-1**, only when the header's `faults` holds it: now, right before the compile, add
   `{"name": "FI-1 Unknown Gem", "level": 1, "quality": 0, "enabled": true}` to the gems of the main
   socket group (`skills.main.group`). Don't validate again and don't remove it in this attempt. Without
   FI-1 in the header, the skeleton holds no `FI-1 Unknown Gem`: remove one an earlier attempt added.
5. **Compile once**, measure-only and never with `build_name`:
   `compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", measure_only: true}`. It writes `concepts/<id>/compile-record.json` and
   `concepts/<id>/compiled-build.xml` beside the plan and nothing to the builds folder (D-208). If it
   fails, don't fix and recompile: report its error lines. The workflow re-runs the step with them as
   findings.
6. **Key numbers**: read `concepts/<id>/compile-record.json` (C-33). Report the rolled skill's damage
   figures (its `g<group>s<skill>p<statSet>` fields), `Life`, `EnergyShield`, the four
   `Missing<Elem>Resist` values, and each `<Type>MaximumHitTaken`, as `{stage, field, value}`.

Optional, before step 3: a `possibly unread` line the concept depends on may be confirmed by measurement
(`.claude/skills/build-guide/references/lookups.md`). Remove the temporary stage before step 3; the
attempt's last compile is always the whole skeleton.

## Writes

`concepts/<id>/plan.json` only. The server writes the record and the XML beside it.

## Returns

Your last message is this JSON and nothing after it:

```json
{
  "compiled": true,
  "errors": [],
  "recordPath": "concepts/c2/compile-record.json",
  "numbers": [ { "stage": "c2e", "field": "Life", "value": 4210 } ],
  "prices": [ { "id": "c2-weapon", "item": "…", "status": "unavailable", "amount": null, "currency": null,
                "date": "2026-10-08", "league": null, "note": "offline run" } ],
  "priceCalls": [],
  "faultsApplied": []
}
```

- `compiled`: whether the step-5 compile succeeded. `errors`: its error lines verbatim, one per entry
  (the `stage <id>: …` lines, or the schema's `<path>: <message>` lines); an error that stopped you
  before the compile (a validation error you couldn't fix, a refused call) also goes here, with
  `compiled: false`.
- `recordPath`: the record's path relative to the run folder, or `null` when nothing compiled.
- `prices`: the skeleton's `prices[]` entries for the key items, as written.
- `priceCalls`: every price-tool call, `{at, tool, item, outcome}` (`pricing.md`); `[]` offline.
- `faultsApplied`: `[{"id": "FI-1", "observed": "<the compile error naming the gem>"}]` when you
  applied FI-1, else `[]`.

## Fault directives

**FI-1** (`.claude/skills/build-guide/references/offline-and-test.md`): step 4. It must make the compile
fail with a per-stage error naming the gem (D-162). Report that error in `errors` and in `faultsApplied`.
