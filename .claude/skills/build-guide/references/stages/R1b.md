# R1b: concept skeleton, measure-only compile, key-item prices (`build-guide-coordinator`)

Slice 03 §5.2 step 3; spine C-36, D-208. One step per carried concept, one at a time. It turns a research
proposal into an endgame skeleton plan, compiles it measure-only, and prices the concept's key items.
**Gate:** the skeleton compiled with no compile error. You write the gate's verdict file yourself. A
failed attempt re-runs with your verdict as findings, at most 2 counted retries; then the concept is
`failed`, its last verdict the evidence (D-141).

## Inputs

- **Header:** `stage: "R1b"`, `attempt`, `concept` (`c<n>`), `mode`, `runFolder`, `runFolderRel`,
  `compile: "measure-only"`, `findings` (the earlier attempt's verdict file and its findings: fix what each
  names), `faults` (FI-1, offline test runs only), `writes: ["concepts/<id>/plan.json",
  "reports/gates/R1b-<id>-a<attempt>.json"]`.
- **Prompt:** the roll, the concept's title, the research file that proposed it, and how to price in
  this run (offline; stopped; or paced).
- **Read:** the proposal (`## Concept: <title>` in that research file) and the round's other research
  files for the mechanics; `docs/build-guide/plan-reference.md` (every field, and the worked example);
  `pob-pin.json` (the pin's tag and commit); the data under `data/` for scenario inputs; `run-log.json`
  (has pricing stopped? a `stages[]` entry whose `priceOutcomes` counts a `locked_out` or `rate_limited`
  call); the other plans of this run (`concepts/*/plan.json`), for prices to reuse. On
  attempt 2 or 3, your earlier skeleton at `concepts/<id>/plan.json` is there to fix.

## Work

At most **two compiles per attempt**, both measure-only: an optional bootstrap compile (step 3), then the
last compile of the whole skeleton (step 8). Validation comes before any price call, so no trade call (the
trade site's limits are shared with the user's account) is spent on an item validation would reject.

1. **Tree targets.** From the proposal, list the ascendancy nodes, notables and keystones the concept rests
   on, each with its node id (`mcp__pob2__search_tree_nodes {query}`, or `{ascendancy}` for the ascendancy's own
   nodes). `mcp__pob2__search_tree_nodes` gives no links between nodes, so the paths come from step 3.
2. **FI-1**, only when the header's `faults` holds it: FI-1 goes into this attempt's **first** compile, so a
   faulted attempt compiles nothing clean and a concept FI-1 fails leaves no clean record (D-265). That first
   compile is the bootstrap (step 3), which you then always run, even when the skeleton's tree is already
   pathed: add `{"name": "FI-1 Unknown Gem", "level": 1, "quality": 0, "enabled": true}` to the gems of the
   bootstrap skeleton's main socket group (`skills.main.group`) before you compile it. Don't validate first,
   and don't remove the gem in this attempt. The compile fails with an error naming the gem; stop there, as
   step 3 says, and write the verdict (step 9). Without FI-1 in the header, the skeleton holds no
   `FI-1 Unknown Gem`: remove one an earlier attempt left.
3. **Bootstrap compile** (at most once per attempt; skip it when the skeleton's tree is already pathed,
   e.g. on a retry whose findings aren't about the tree, unless step 2 applies FI-1). Write
   `concepts/<id>/plan.json` as a tree-minimal skeleton: the roll, versions and league of step 4, its one
   stage with an empty tree (no
   `nodes`, `ascendancyNodes`, weapon-set nodes or attribute choices), no item slots, jewels or toggles,
   the rolled skill alone in one group (with its `role`, `main` and `rolledGroup`), the scenario's
   `enemyIsBoss` and resistance penalty, no claims and no prices. Compile it:
   `mcp__pob2__compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", measure_only: true}`. The engine
   then holds the class and ascendancy with only their start nodes allocated, so
   `mcp__pob2__find_path_to_node {target_node_id: <id>}` gives the nodes between the start and each target, and
   `mcp__pob2__get_nearby_nodes` shows what lies around them. The last compile overwrites the bootstrap's record and
   XML. If the bootstrap compile fails, stop: report its errors with `compiled: false`.
4. **Write the skeleton** `concepts/<id>/plan.json` (C-31), a plan that tests the concept at the
   endgame, not a guide:
   - `roll` is the run's roll (class, ascendancy, skill), exactly as the prompt names them.
   - `versions`: `pobTag` and `pobCommit` from `pob-pin.json`; `treeVersion`, `enginePatch` and
     `externalPatch` as the plan reference describes. The compile record notes any that differ from the
     engine.
   - `league`: offline, `null`; online, the current trade league from `mcp__pob2__get_leagues`. If trade can't be
     reached, reuse the league of another plan in this run, else `Standard`, and return
     `leagueUnverified: true`. The dossier then marks the league unverified, and **D1 doesn't take its
     league from a skeleton whose league is unverified**.
   - **One stage**, `id` `<id>e` (the concept id and `e`, e.g. `c2e`: so a dossier ref like
     `c2e.Life` names this concept's record), `progress: "endgame"`, no `variant`, a `level` the
     concept is meant to play at (90 when the proposal doesn't say), and
     `loadoutName` `<short title> (L<level>) {<id>e}`.
   - `tree`: the targets of step 1 and the paths step 3 found to them, so every node connects to the
     class start through listed nodes, and no more points than the level allows
     (`data/campaign/limits.json`).
   - `items`: each key unique's text from `mcp__pob2__lookup_game_data {mode: "unique", query: <exact name>}`
     (full text comes only for a single match); plain bases or simple rares for the other slots the
     skill needs (its weapon first).
   - `skills`: the rolled skill's group with the concept's supports, each group with a `role` (the
     rolled skill's is `clear` or `single_target`), `main` on the rolled skill, and `rolledGroup`.
   - `config`: the earned states the concept relies on, each that is on with its producer and uptime;
     `scenario` lists `enemyIsBoss` and the endgame resistance penalty, each from a data fact with its
     tag, as in the worked example.
   - `claims` may stay empty; any claim carries a source. `ledger` is `[]`.
   - `prices`: offline, the key items' `unavailable` entries of step 6; online, `[]` for now.
5. **Validate**: `mcp__pob2__guide_run {validate: "<runFolderRel>/concepts/<id>/plan.json"}`. Fix every error it
   reports (schema errors by JSON path; unknown gems with suggestions; item text; nodes and their
   connection; config options) and validate again, until it reports none. If one can't be fixed, stop
   before any price call and report it with `compiled: false`.
6. **Prices** (`.claude/skills/build-guide/references/pricing.md`), one `prices[]` entry per key item
   (each key unique; a key base only where the concept depends on it), with id `<id>-<item>` (e.g.
   `c2-weapon`):
   - **offline:** no price call. Each entry is `unavailable` with note `offline run`, `amount`,
     `currency` and `league` null, dated the run folder's date (the `YYYY-MM-DD` in its last path
     segment).
   - **pricing stopped** (the prompt says so, or a `run-log.json` `stages[]` entry's `priceOutcomes` counts
     a `locked_out` or `rate_limited` call): no price call; each entry is `unavailable`, note `pricing stopped`.
   - **online:** reuse an entry with the same item, query and league from any plan of this run first;
     otherwise one call per item, paced by order. Record each result's league and its `Checked:` date;
     count every call by its outcome for your return.
7. **Validate again** once the prices are written (the schema checks them and the league), so the last
   compile compiles the priced plan and its record's `planSha1` is that plan's.
8. **The last compile**, of the whole skeleton, measure-only and never with `build_name`:
   `mcp__pob2__compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", measure_only: true}`. It writes
   `concepts/<id>/compile-record.json` and `concepts/<id>/compiled-build.xml` beside the plan and
   nothing to the builds folder (D-208). If it fails, don't fix and recompile: put its error lines in the
   verdict. The runner re-runs the step with them as findings.
9. **The verdict file** `reports/gates/R1b-<id>-a<attempt>.json` (`.claude/skills/build-guide/references/gates.md`),
   written last, whatever happened:

   ```json
   { "stage": "R1b", "concept": "c2", "attempt": 1, "verdict": { "compiled": "pass" }, "findings": [],
     "errors": [], "compiles": 2, "recordPath": "concepts/c2/compile-record.json", "faultsApplied": [],
     "leagueUnverified": false }
   ```

   - `verdict.compiled`: whether the last compile (step 8) succeeded. A failure has one finding per error
     line, `{part: "compiled", code: "compile-error", stage: "<id>e", message: <the line verbatim>}`, and
     `errors` lists the lines (the `stage <id>: …` lines, or the schema's `<path>: <message>` lines). An
     error that stopped you before the compile (a validation error you couldn't fix, a refused call) is a
     failure too.
   - `compiles`: how many `mcp__pob2__compile_plan` calls this attempt made (the bootstrap and the last; at most 2).
   - `recordPath`: the last compile's record, relative to the run folder; `null` when the last compile
     didn't succeed (a record beside the skeleton is then the bootstrap's or an earlier attempt's; never a
     faulted attempt's, whose first compile failed).
   - `faultsApplied`: `[{"id": "FI-1", "observed": "<the compile error naming the gem>"}]` when you
     applied FI-1, else `[]`.
   - `leagueUnverified`: `true` when trade couldn't be reached online and the league is a fallback (step 4).

A `possibly unread` line the concept depends on goes under what PoB can't verify; D1 confirms it by
measurement (`.claude/skills/build-guide/references/lookups.md`), not R1b.

## Writes

`concepts/<id>/plan.json` and the verdict file `reports/gates/R1b-<id>-a<attempt>.json`. The server writes
the record and the XML beside the plan.

## Returns

At most 8 lines: the outcome, the verdict file, and your price calls counted by outcome (`pricing.md`):

```
R1b c2 attempt 1: compiled
reports/gates/R1b-c2-a1.json
prices: none (offline)
```

## Fault directives

**FI-1** (`.claude/skills/build-guide/references/offline-and-test.md`): step 2, in the attempt's first
compile, the bootstrap, which always runs then (D-265). It must make that compile fail with a per-stage
error naming the gem (D-162), and the attempt stops there: no clean compile, so no clean record. Report the
error in the verdict's `errors` and `faultsApplied`.
