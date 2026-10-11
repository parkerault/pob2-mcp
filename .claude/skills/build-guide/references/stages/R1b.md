# R1b: card skeleton, measure-only compile, key-item prices, the checklist (`build-guide-coordinator`)

Slice 03 §5.2 (the verification phase) and §7.5, §7.7; spine C-36, C-52, D-208, D-286, D-292, D-334, D-338.
One step per picked card, one at a time, at most 3 per verification round. It turns a card into an endgame
skeleton plan, compiles it measure-only, prices the card's key items, runs the advisory checklist with its
probes, and writes the card's verification half. **Gate:** the skeleton compiled with no compile error. You
write the gate's verdict file yourself. A failed attempt re-runs with your verdict as findings, at most 2
counted retries; then the card is `failed`, its last verdict the evidence (D-141).

## Inputs

- **Header:** `stage: "R1b"`, `attempt`, `concept` (the card id, `r<round>-<letter>-<n>`, D-319), `mode`,
  `runFolder`, `runFolderRel`, `compile: "measure-only"`, `findings` (the earlier attempt's verdict file and
  its findings: fix what each names), `faults` (FI-1, offline test runs only), and `writes:
  ["concepts/<id>/plan.json", "reports/gates/R1b-<id>-a<attempt>.json", "cards/<id>.md",
  "probes/<id>/<n>/"]`: the card, for its verification half, and its probes, `n` from 1 to 4 (D-338).
- **Prompt:** the card's id and title, and how to price in this run (offline; stopped; or paced; and with
  `--no-ninja`, no currency rates).
- **The card's identity** `{className, ascendancy, skill}`, `skill` its **named damage source** (D-286), is the
  skeleton's `roll`. The named damage source is the main source of damage, never a token role: its group is
  the skeleton's `rolledGroup`.
- **Read:** the card `cards/<id>.md` (its brainstorm half: identity, chain, enabler, links and risks) and the
  round's research files for the mechanics; `docs/build-guide/plan-reference.md` (every field, and the worked example);
  `pob-pin.json` (the pin's tag and commit); the data under `data/` for scenario inputs; `run-log.json`
  (has pricing stopped? a `stages[]` entry whose `priceOutcomes` counts a `locked_out` or `rate_limited`
  call); the other plans of this run (`concepts/*/plan.json`), for prices to reuse. On
  attempt 2 or 3, your earlier skeleton at `concepts/<id>/plan.json` is there to fix.

## Work

At most **two compiles per attempt**, both measure-only: an optional bootstrap compile (step 3), then the
last compile of the whole skeleton (step 8). Validation comes before any price call, so no trade call (the
trade site's limits are shared with the user's account) is spent on an item validation would reject. The
verification checklist's probe variants (below) come on top: up to 4 per card (D-292).

A card whose damage source isn't a skill (D-334) gets none of steps 1 to 8: see "A card whose damage source
isn't a skill" below.

1. **Tree targets.** From the card's chain and links, list the ascendancy nodes, notables and keystones the
   card rests on, each with its node id (`mcp__pob2__search_tree_nodes {query}`, or `{ascendancy}` for the ascendancy's own
   nodes). `mcp__pob2__search_tree_nodes` gives no links between nodes, so the paths come from step 3.
2. **FI-1**, only when the header's `faults` holds it: FI-1 goes into this attempt's **first** compile, so a
   faulted attempt compiles nothing clean and a card FI-1 fails leaves no clean record (D-265). That first
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
   the named damage source alone in one group (with its `role`, `main` and `rolledGroup`), the scenario's
   `enemyIsBoss` and resistance penalty, no claims and no prices. Compile it:
   `mcp__pob2__compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", measure_only: true}`. The engine
   then holds the class and ascendancy with only their start nodes allocated, so
   `mcp__pob2__find_path_to_node {target_node_id: <id>}` gives the nodes between the start and each target, and
   `mcp__pob2__get_nearby_nodes` shows what lies around them. The last compile overwrites the bootstrap's record and
   XML. If the bootstrap compile fails, stop: report its errors with `compiled: false`.
4. **Write the skeleton** `concepts/<id>/plan.json` (C-31), a plan that tests the card at the
   endgame, not a guide:
   - `roll` is the card's identity (class, ascendancy, named damage source), exactly as the card names it
     (D-286).
   - `versions`: `pobTag` and `pobCommit` from `pob-pin.json`; `treeVersion`, `enginePatch` and
     `externalPatch` as the plan reference describes. The compile record notes any that differ from the
     engine.
   - `league`: offline, `null`; online, the current trade league from `mcp__pob2__get_leagues`. If trade can't be
     reached, reuse the league of another plan in this run, else `Standard`, and return
     `leagueUnverified: true`. The dossier then marks the league unverified, and **D1 doesn't take its
     league from a skeleton whose league is unverified**.
   - **One stage**, `id` the card id without its hyphens, then `e` (`r1a2e` for card `r1-a-2`: a stage id
     is letters and digits only, so a dossier ref like `r1a2e.Life` names this card's record),
     `progress: "endgame"`, no `variant`, a `level` the card is meant to play at (90 when the card doesn't
     say), and `loadoutName` `<short title> (L<level>) {<stage id>}`.
   - `tree`: the targets of step 1 and the paths step 3 found to them, so every node connects to the
     class start through listed nodes, and no more points than the level allows
     (`data/campaign/limits.json`).
   - `items`: each key unique's text from `mcp__pob2__lookup_game_data {mode: "unique", query: <exact name>}`
     (full text comes only for a single match); plain bases or simple rares for the other slots the
     skill needs (its weapon first).
   - `skills`: the named damage source's group with the card's supports, each group with a `role` (the
     named source's is `clear` or `single_target`), `main` on the named source, and `rolledGroup`; a
     `count` with its `countReason` where the card's chain has several copies act at once (D-293).
   - `config`: the earned states the card relies on, each that is on with its producer and uptime;
     `scenario` lists `enemyIsBoss` and the endgame resistance penalty, each from a data fact with its
     tag, as in the worked example.
   - `claims` may stay empty; any claim carries a source. `ledger` is `[]`.
   - `prices`: offline, the key items' `unavailable` entries of step 6; online, `[]` for now.
5. **Validate**: `mcp__pob2__guide_run {validate: "<runFolderRel>/concepts/<id>/plan.json"}`. Fix every error it
   reports (schema errors by JSON path; unknown gems with suggestions; item text; nodes and their
   connection; config options) and validate again, until it reports none. If one can't be fixed, stop
   before any price call and report it with `compiled: false`.
6. **Prices** (`.claude/skills/build-guide/references/pricing.md`), one `prices[]` entry per key item
   (each key unique; a key base only where the card depends on it), with id `<id>-<item>` (e.g.
   `r1-a-2-weapon`):
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
   verdict. The runner re-runs the step with them as findings. If it succeeds, run the verification
   checklist (below), then write the card's verification half (below), before the verdict.
9. **The verdict file** `reports/gates/R1b-<id>-a<attempt>.json` (`.claude/skills/build-guide/references/gates.md`),
   written last, whatever happened:

   ```json
   { "stage": "R1b", "concept": "r1-a-2", "attempt": 1, "verdict": { "compiled": "pass" }, "findings": [],
     "errors": [], "compiles": 2, "recordPath": "concepts/r1-a-2/compile-record.json", "faultsApplied": [],
     "leagueUnverified": false }
   ```

   - `verdict.compiled`: whether the last compile (step 8) succeeded. A failure has one finding per error
     line, `{part: "compiled", code: "compile-error", stage: "<stage id>", message: <the line verbatim>}`, and
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

A `possibly unread` line the card depends on goes under what PoB can't verify; D1 confirms it by
measurement (`.claude/skills/build-guide/references/lookups.md`), not R1b.

## Verification checklist (advisory, D-292)

Slice 03 §7.7. Run these eight checks on the card's skeleton after the last compile (step 8) and before
the verdict file (step 9). Write each result into the card's `Checklist results` table
(`.claude/skills/build-guide/templates/card-template.md`): one of the four words **verified, estimate,
risk, not checked**, and one line of detail. None is a gate: a result never changes the verdict, and none
starts a fix round or a retry. If the last compile failed, every check is `not checked`.

**From the plan and the record (no extra compile):**

1. **Pillars** for ailments and damage over time: base damage, type-specific scaling, duration, and 100%
   application. A pillar with no source is a `risk`.
2. **The enabler's conditions** at the target level, in numbers, and what they force out of the build
   (Minion Pact needs a minion with at least your maximum life, so your own life is held under it). A forced
   condition gets a permanence check: reservation of at least 1 minus the threshold (life at 75% needs 25%
   reserved).
3. **Attribute requirements** at the target level, for the defining items and every gem
   (`mcp__pob2__lookup_game_data {mode: "gem", query}` gives a gem's requirements by level), including after
   a swap that removes a supplier.
4. **Risks PoB can't show:** payoff thieves (from the lookup's hit-making children of the build's
   skills, D-299: triggered and granted skills, minions), placement and targeting limits, the exposed
   phase, cooldown dead windows on interruptible casts, and hidden clauses on links ("from a Hit", "you use
   yourself"), stated as theory. Each is `risk` or `not checked`, never `verified`.

**From compile variants (probes).** The mutating tools are `mutate` tools you don't hold (D-231), so each
probe is a copy of the skeleton plan with one change, written to `probes/<card-id>/<n>/plan.json` (D-331;
`n` counts from 1 in run order) and compiled measure-only as one stage:
`mcp__pob2__compile_plan {plan_path: "<runFolderRel>/probes/<card-id>/<n>/plan.json", measure_only: true}`.
Compare its record with the skeleton's.

5. **A dead-slot audit:** remove one support or source, the one most likely dead (the chain doesn't name
   it, or it touches only the activation), and compare. A change below 1% is a `risk`. Say for each support
   whether it touches the activation or the payload.
6. **Condition on and off:** toggle the earned config entry the payoff rests on off, and compare. Report
   the figure at a realistic uptime, on × uptime + off × (1 − uptime), as an `estimate` with the uptime's
   reason.
7. **Encounter mods:** in the scenario config, add the top of the waystone's monster elemental resistance
   range (`enemies/waystones.json#mods.monster-elemental-resistance`, its `max`, as D1 takes the top of
   each waystone modifier) to the enemy's resistance against the damage source's element. Without a
   compile, read whether the bosses resist that element (`enemies/arbiter-of-divinity.json#res.<element>`),
   and report each that does as a `risk`.
8. **A skill-shape probe,** only where the skill's text suggests one, such as projectile speed up and down
   for damage that grows with travel.

**The probe budget.** Up to 4 probe variants per card, beyond the attempt's two compiles, run in the order
above (5, 6, 7, 8): each a one-stage, measure-only compile, within NFR-21's per-request limit. A probe that
doesn't fit the budget, or whose compile fails, is reported `not checked`, and it never fails the step.
Probes don't count in the verdict's `compiles`.

A card whose damage source isn't a skill (D-334) has no skeleton: run checks 1–4 from the card and the
lookups, report 5–8 `not checked`, and write "not compiled: its damage source isn't a skill" in its
verification half.

## The card's verification half (C-52)

Write it into `cards/<id>.md`, under `## Verification half`, replacing the `Not checked yet.` lines R1a left
(`.claude/skills/build-guide/templates/card-template.md`). Edit only that half: the brainstorm half is R1a's.

- **Verified:** from the last compile's record, the defences (`Life`, `EnergyShield`, the four
  `Missing<Elem>Resist`, each `<Type>MaximumHitTaken`, and `TotalEHP`, D-294) and the named source's modelled
  DPS: its Count-scaled figure, `countedSkillOutputs[g<group>s<skill>p<statSet>].fields.TotalDPS` (the per-copy
  figure × its group's Count, WU-55), with its stat set and group.
- **Estimates** (D-296): each Count above 1 with its `countReason`, each custom modifier with its reason, and
  every figure the record marks `computedWithCustomMods`, defences included; the clear and boss figures kept
  separate, never summed.
- **Checklist results**, from the checklist above; **a fallback ladder**, cheapest first; **key item prices**,
  from step 6, each dated or `unavailable` with its note.

**A card whose damage source isn't a skill** (D-334) compiles nothing, so it has no skeleton, record or probe.
Run checks 1–4, write its verification half as above, and write the verdict with `compiled: "fail"`, one
finding `{part: "compiled", code: "not-a-skill", message: "not compiled: its damage source isn't a skill
(D-334)"}`, `compiles: 0` and `recordPath: null`. The runner doesn't re-run it: no retry can compile it, and
the card can't be finalized yet (D-303).

## Writes

Only the header's `writes` (D-338): `concepts/<id>/plan.json`, the verdict file
`reports/gates/R1b-<id>-a<attempt>.json`, the card `cards/<id>.md` (its verification half), and each probe's
`probes/<id>/<n>/plan.json`, `n` from 1 to 4. The server writes each compile's record and XML beside its plan.

## Returns

At most 8 lines: the outcome, the verdict file, the card with its checklist and probe counts (`probes <n>`:
every probe run, a probe whose compile failed included), and your price calls counted by outcome (`pricing.md`):

```
R1b r1-a-2 attempt 1: compiled
reports/gates/R1b-r1-a-2-a1.json
cards/r1-a-2.md: checklist 8 run (2 not checked), probes 3
prices: none (offline)
```

## Fault directives

**FI-1** (`.claude/skills/build-guide/references/offline-and-test.md`): step 2, in the attempt's first
compile, the bootstrap, which always runs then (D-265). It must make that compile fail with a per-stage
error naming the gem (D-162), and the attempt stops there: no clean compile, so no clean record. Report the
error in the verdict's `errors` and `faultsApplied`.
