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

At most **two compiles per attempt**, both measure-only: an optional bootstrap compile (step 2), then the
last compile of the whole skeleton (step 8). Validation comes before any price call, so no trade call (the
trade site's limits are shared with the user's account) is spent on an item validation would reject.

1. **Tree targets.** From the proposal, list the ascendancy nodes, notables and keystones the concept rests
   on, each with its node id (`search_tree_nodes {query}`, or `{ascendancy}` for the ascendancy's own
   nodes). `search_tree_nodes` gives no links between nodes, so the paths come from step 2.
2. **Bootstrap compile** (at most once per attempt; skip it when the skeleton's tree is already pathed,
   e.g. on a retry whose findings aren't about the tree). Write `concepts/<id>/plan.json` as a
   tree-minimal skeleton: the roll, versions and league of step 3, its one stage with an empty tree (no
   `nodes`, `ascendancyNodes`, weapon-set nodes or attribute choices), no item slots, jewels or toggles,
   the rolled skill alone in one group (with its `role`, `main` and `rolledGroup`), the scenario's
   `enemyIsBoss` and resistance penalty, no claims and no prices. Compile it:
   `compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", measure_only: true}`. The engine
   then holds the class and ascendancy with only their start nodes allocated, so
   `find_path_to_node {target_node_id: <id>}` gives the nodes between the start and each target, and
   `get_nearby_nodes` shows what lies around them. The last compile overwrites the bootstrap's record and
   XML. If the bootstrap compile fails, stop: report its errors with `compiled: false`.
3. **Write the skeleton** `concepts/<id>/plan.json` (C-31), a plan that tests the concept at the
   endgame, not a guide:
   - `roll` is the run's roll (class, ascendancy, skill), exactly as the prompt names them.
   - `versions`: `pobTag` and `pobCommit` from `pob-pin.json`; `treeVersion`, `enginePatch` and
     `externalPatch` as the plan reference describes. The compile record notes any that differ from the
     engine.
   - `league`: offline, `null`; online, the current trade league from `get_leagues`. If trade can't be
     reached, reuse the league of another plan in this run, else `Standard`, and return
     `leagueUnverified: true`. The dossier then marks the league unverified, and **D1 doesn't take its
     league from a skeleton whose league is unverified**.
   - **One stage**, `id` `<id>e` (the concept id and `e`, e.g. `c2e`: so a dossier ref like
     `c2e.Life` names this concept's record), `progress: "endgame"`, no `variant`, a `level` the
     concept is meant to play at (90 when the proposal doesn't say), and
     `loadoutName` `<short title> (L<level>) {<id>e}`.
   - `tree`: the targets of step 1 and the paths step 2 found to them, so every node connects to the
     class start through listed nodes, and no more points than the level allows
     (`data/campaign/limits.json`).
   - `items`: each key unique's text from `lookup_game_data {mode: "unique", query: <exact name>}`
     (full text comes only for a single match); plain bases or simple rares for the other slots the
     skill needs (its weapon first).
   - `skills`: the rolled skill's group with the concept's supports, each group with a `role` (the
     rolled skill's is `clear` or `single_target`), `main` on the rolled skill, and `rolledGroup`.
   - `config`: the earned states the concept relies on, each that is on with its producer and uptime;
     `scenario` lists `enemyIsBoss` and the endgame resistance penalty, each from a data fact with its
     tag, as in the worked example.
   - `claims` may stay empty; any claim carries a source. `ledger` is `[]`.
   - `prices`: offline, the key items' `unavailable` entries of step 5; online, `[]` for now.
4. **Validate**: `guide_run {validate: "<runFolderRel>/concepts/<id>/plan.json"}`. Fix every error it
   reports (schema errors by JSON path; unknown gems with suggestions; item text; nodes and their
   connection; config options) and validate again, until it reports none. If one can't be fixed, stop
   before any price call and report it with `compiled: false`.
5. **Prices** (`.claude/skills/build-guide/references/pricing.md`), one `prices[]` entry per key item
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
6. **Validate again** once the prices are written (the schema checks them and the league), so the last
   compile compiles the priced plan and its record's `planSha1` is that plan's.
7. **FI-1**, only when the header's `faults` holds it: now, right before the last compile, add
   `{"name": "FI-1 Unknown Gem", "level": 1, "quality": 0, "enabled": true}` to the gems of the main
   socket group (`skills.main.group`). Don't validate again and don't remove it in this attempt. Without
   FI-1 in the header, the skeleton holds no `FI-1 Unknown Gem`: remove one an earlier attempt added.
8. **The last compile**, of the whole skeleton, measure-only and never with `build_name`:
   `compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", measure_only: true}`. It writes
   `concepts/<id>/compile-record.json` and `concepts/<id>/compiled-build.xml` beside the plan and
   nothing to the builds folder (D-208). If it fails, don't fix and recompile: report its error lines.
   The workflow re-runs the step with them as findings.
9. **Key numbers**: read `concepts/<id>/compile-record.json` (C-33). Report the rolled skill's damage
   figures (its `g<group>s<skill>p<statSet>` fields), `Life`, `EnergyShield`, the four
   `Missing<Elem>Resist` values, and each `<Type>MaximumHitTaken`, as `{stage, field, value}`.

A `possibly unread` line the concept depends on goes under what PoB can't verify; D1 confirms it by
measurement (`.claude/skills/build-guide/references/lookups.md`), not R1b.

## Writes

`concepts/<id>/plan.json` only. The server writes the record and the XML beside it.

## Returns

Your last message is this JSON and nothing after it:

```json
{
  "compiled": true,
  "errors": [],
  "compiles": 2,
  "recordPath": "concepts/c2/compile-record.json",
  "numbers": [ { "stage": "c2e", "field": "Life", "value": 4210 } ],
  "prices": [ { "id": "c2-weapon", "item": "…", "status": "unavailable", "amount": null, "currency": null,
                "date": "2026-10-08", "league": null, "note": "offline run" } ],
  "priceCalls": [],
  "faultsApplied": [],
  "leagueUnverified": false
}
```

- `compiled`: whether the last compile (step 8) succeeded. `errors`: its error lines verbatim, one per entry
  (the `stage <id>: …` lines, or the schema's `<path>: <message>` lines); an error that stopped you
  before the compile (a validation error you couldn't fix, a refused call) also goes here, with
  `compiled: false`.
- `compiles`: how many `compile_plan` calls this attempt made (the bootstrap and the last; at most 2).
- `recordPath`: the last compile's record, relative to the run folder; `null` when the last compile
  didn't succeed (a record beside the skeleton is then the bootstrap's or an earlier attempt's).
- `prices`: the skeleton's `prices[]` entries for the key items, as written.
- `priceCalls`: every price-tool call, `{at, tool, item, outcome}` (`pricing.md`); `[]` offline.
- `faultsApplied`: `[{"id": "FI-1", "observed": "<the compile error naming the gem>"}]` when you
  applied FI-1, else `[]`.
- `leagueUnverified`: `true` when trade couldn't be reached online and the league is a fallback (step 3).

## Fault directives

**FI-1** (`.claude/skills/build-guide/references/offline-and-test.md`): step 7, before the last compile
and never in the bootstrap. It must make the last compile fail with a per-stage error naming the gem
(D-162). Report that error in `errors` and in `faultsApplied`.
