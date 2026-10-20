# The run folder

Every run of the build-guide skill works inside one run folder, which the server creates. This page is
the layout, who writes each file, how the PoB file is named, and what the run checker holds a run folder
to (slice 03 §2 and FR-W7, as amendments 1, 3 and 9 change them; spine C-34, C-36, C-52; D-412, D-415).

## Creating it

After the brief check, the runner's first server write is `mcp__pob2__guide_run {new_run: <slug>}` (D-207,
D-216). It makes no engine call, and replies with three lines:

```
Created run folder <absolute path>
plan_path for this run: <slug>/<YYYY-MM-DD>-<n>/plan.json
loadedBuildUnsaved: true | false
```

- `runFolder` is the absolute path. Every step and every agent uses it; no agent needs the guides root.
- `runFolderRel` is `<slug>/<YYYY-MM-DD>-<n>`, the run folder relative to the guides root. A plan's
  `plan_path` for `mcp__pob2__compile_plan` and `mcp__pob2__guide_run {validate}` is
  `<runFolderRel>/builds/<id>/plan.json` for a build (`<runFolderRel>/plan.json` for a build migrated from
  schema 3, in `.`), `<runFolderRel>/concepts/<id>/plan.json` for a card's skeleton, or
  `<runFolderRel>/probes/<id>/<n>/plan.json` for one of its probes.
- `loadedBuildUnsaved` says whether the engine's loaded build has unsaved changes. The first compile
  replaces that build, so when it is `true` the runner asks the user first (D-210, `checkpoints.md`).

**The slug** comes from the brief (D-285), in lower case, with each run of characters outside `[a-z0-9]`
replaced by one `-` and no `-` at either end; the server takes at most 64 characters:

- the brief names an ascendancy and a skill: `<ascendancy>-<skill>` (Titan / Blood Hunt gives
  `titan-blood-hunt`);
- an ascendancy and no skill: `<ascendancy>-open` (`titan-open`);
- a skill and no ascendancy: `open-<skill>` (`open-blood-hunt`);
- neither: `open-<first playstyle tag>` (`open-minion`), or `open` for a brief with no playstyle tag.

The cards the user finalizes are recorded in the run log, not in the folder name. Each run gets a new dated
folder; only a resume writes into an earlier run's folder, its own (D-153 as D-415 amends it).

## Resuming it (D-415)

`/build-guide --resume <run folder>` (or `--campaign <run folder> <id>`) goes on with an earlier run in a later
session. The run folder is absolute, or relative to the guides root. The runner's first server call is
`mcp__pob2__guide_run {resume: <run folder>}`: like `new_run` it makes no engine call, and it writes nothing. It
checks that the folder is a run folder (two levels below the guides root) holding a `run-log.json`, and replies
with three lines:

```
Resuming run folder <absolute path>
runFolderRel: <slug>/<YYYY-MM-DD>-<n>
loadedBuildUnsaved: true | false
```

`runFolder`, `runFolderRel` and `loadedBuildUnsaved` are then as for a new run; the unsaved-build question is
asked once per resume (`checkpoints.md`).

## Layout and ownership

| Path in the run folder | Written by (only) | Content |
|---|---|---|
| `run-log.json` | the runner, through `scripts/run-log.mjs` (D-356) | the run log (`run-log.md`) |
| `research/p<k>-r1a-<n>.md` | R1a agent `n` of brainstorm round `k` | its sections, with source markers (`source-markers.md`) |
| `cards/<id>.md` | R1a, or RV for the rival's card (the brainstorm half; R1a-assemble or the rival's R1b only to rename it), then R1b (the verification half, after a gate's change; a card made at a gate whole) | a candidate card (`templates/card-template.md`, C-52) |
| `cards.md` | the R1a-assemble step; R1b-assemble adds a gate-made card's line | the deck: its header, the dealt cards by round with their engines, "Not dealt" and "Found, not used" (D-287, D-392, D-405) |
| `interviews/<gate>-<visit>.md` | the runner, with Write and Edit, during the interview: after each answer, and the pending decision before a yes (D-420) | a gate visit's interview notes and its `## Pending decision` (D-389, `checkpoints.md`) |
| `interviews/<gate>-<visit>-q<n>.md`, `probes/q-<gate>-<visit>-<n>/` | a gate question step (Q) | its report, and a coordinator's measured variant (D-390, `stages/Q.md`) |
| `concepts/<id>/plan.json` | the R1b step for card `<id>` | an endgame skeleton plan (C-31) with its key-item prices |
| `concepts/<id>/compile-record.json`, `concepts/<id>/compiled-build.xml` | `mcp__pob2__compile_plan`, measure-only (D-208) | the skeleton's compile record (C-33) and compiled XML |
| `probes/<id>/<n>/plan.json`, and its record and XML | the R1b step for card `<id>`; `mcp__pob2__compile_plan`, measure-only | a probe variant, one stage, `n` from 1 to 4 (D-292, D-331, D-338) |
| `dossier.md` | the R1b-assemble step | the dossier, the verification gate's comparison table (slice 03 §7.2, D-355) |
| `builds/<id>/` | the build's steps, one folder per finalized card (D-412) | everything that is one build's: the rows below |
| `builds/<id>/plan.json` | D1's three steps (D1-build, D1-tree, D1-finish) and D2; the D1 gate step only to apply FI-2 and the final re-price pass | the build's plan (C-31) |
| `builds/<id>/compile-record.json`, `builds/<id>/compiled-build.xml` | `mcp__pob2__compile_plan` | the record of the last compile of the build's plan; after its final compile (F1's, or the D2 gate's for its campaign) it names the PoB file and holds `importCode` |
| `builds/<id>/guide.md` | W1; the runner replaces its `Known issues` list each cycle (step 14, D-265) | the guide, the reader layer (slice 03 §8, D-276): the endgame guide, or the full guide once the build has its campaign (D-414) |
| `builds/<id>/audit.md` | the runner, rendered by `scripts/render-audit.mjs --build <id>` after the final compile (D-355); W1 adds the accepted gate findings' rows to its `Known issues`, and the runner fills that table each cycle (step 14) | the audit layer (slice 03 §7.8, D-278) |
| `builds/<id>/reports/V4-<n>.md` | the verifier itself, one per pass, never overwritten (D-352) | the build's V4 full pass's, re-check's or campaign pass's report (`source-markers.md`, `stages/V4.md`) |
| `builds/<id>/rounds/<n>/` | the run checker's `--snapshot <n> --build <id>`, which the runner runs before a fix round, a revision or a campaign (A-34) | the round copy: `plan.json`, `compile-record.json` and `guide.md` as they stood, which `--changed <n> --build <id>` compares with; nobody reads it |
| `reports/gates/<stage>-<concept>-a<attempt>.json` | the gate step itself: R1b, D1-gate, F1 or D2-gate | its verdict (`gates.md`), at the run folder's root and keyed by the card id |

A run migrated from schema 3 (`run-log.mjs migrate`, D-415) keeps its one build at the root, as before amendment 9:
its `builds[]` entry has `folder: "."`, and its plan, record, guide, audit, V4 reports and round copies are the
root's. Every agent finds a build's files by its header's `buildFolder`, `builds/<id>` or `.`.

- Card ids are `r<round>-<researcher letter>-<n>` (`r1-a-2`): the runner letters the researchers `a`, `b` and `c`
  when it starts them, so parallel researchers never collide and ids stay unique across rounds (D-319); a card
  made at a gate is `r<k>-g-<n>` (D-391), and the rival's `r<k>-x-<n>`, with no deck line (D-408). A step's
  `concept`, a gate file's `<concept>` and `concepts/<id>/` use the card id. (Runs before amendment 3 used
  concept ids `c1`, `c2`, ….)
- `<stage>` in a gate file is `R1b`, `D1-gate`, `F1` or `D2-gate`; `<attempt>` counts from 1 per (stage,
  concept), as the header and the run log's `stages[]` do. A V4 report's `<n>` counts the build's V4 passes
  from 1, full pass, re-checks and campaign pass alike, apart from the other builds' (D-412).
- Every V4 report is kept: a re-check, a revision's check or a campaign pass writes the build's next `<n>`, never
  over an earlier report.
- Nothing else goes in the run folder or a build's folder. No agent writes outside it (D-177), and agents
  running in parallel write different files (C-36).

## The PoB file

Only a build's final compile writes a PoB file into the builds folder, through the server (C-17, D-208): F1's for
an endgame-only build (D-413), or the D2 gate's once the build has its campaign. Its `build_name` is
`<slug>-<YYYY-MM-DD>-<n>-<id>`: the run folder's last two segments and the card id, joined with `-`, so every run
writes new files and two builds of one run never share one (D-113, D-199, D-412). A build migrated from schema 3,
in `.`, keeps `<slug>-<YYYY-MM-DD>-<n>`, with no card id: the run checker's PoB file name rule. Every earlier
compile, the concept skeletons' and the D1 gate's included, is measure-only and writes only the record and the
compiled XML beside its plan.

A re-compile of the build (the fix round's, a revision's, or its campaign's D2 gate) rewrites that same file. The
server's write ledger allows it only while the file is unchanged since this run wrote it; otherwise
`mcp__pob2__compile_plan` refuses, with C-17's changed-on-disk wording when someone edited the file (the user, in
PoB), or its "already exists" wording when the ledger has no entry for this run (D-211). A refusal is reported,
never worked around: F1 reports it as `ledger-refused` and escalates at once, since no retry changes it; the D2
gate reports it as a failed final compile (`final-compile`, `gates.md`).

## What the run checker checks

`node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>` checks what the folder holds, whatever
the run's status, and every build in its folder (D-412); when a guide exists, every guide check applies (amendment 1
§4.2). It uses Node built-ins,
the server's own compiled ledger evaluator, `build/plan/ledger.js`, and build projection,
`build/plan/buildHash.js` (D-266), and the audit render `scripts/render-audit.mjs` (D-355). Each violation is
one stderr line `check-run: [<rule>] <message>`.

- **The artifacts.** This layout. Every plan claim, the skeletons' and probes' included, has its `kind`, `hinge`
  or `reason` (D-351). The dossier is one H1, the `Brief:` line and one table with the comparison's eleven
  columns, clear speed among them (D-407; ten in a run from before amendment 8), one row per card R1b verified,
  with no H2, H3 or marker; a failed or not-yet-finalizable card has `—` in its number, price and league cells
  (D-355). Every research marker resolves and parses as a C-30 tag. Offline, every price is `unavailable` and no
  step priced.
- **The reader layer** (D-276, D-283, D-414). The guide's template is its plan's: the endgame guide's 12 H2s
  for a plan with no campaign stage, at most 2,300 words, its `Switching over` naming each reward pick; else the
  full guide's 14 H2s in order, its Leveling H3s equal to the record's loadout names, at most 3,000 words. The
  build's `guide` in `builds[]` (`endgame` or `full`) is its plan's. Either guide has its `Checks` H3s and `What
  PoB can't show` ending with the H3 `Known issues`; its words count a word being a run of non-space characters holding a letter or a digit, the H1, the import code and
  the Known issues list not counted. No footnote marker (`[^`), confidence label (`confidence L`) or finding id
  (`v4-<n>-<k>`) anywhere outside the import code. The import code, the first fenced block of `Your PoB file`,
  equals the record's (D-205). One fixed-form verdict line per endgame rung in `Survival by stage`, each number
  equal to the record's value rounded at the written number's last significant digit ("2,740" matches 2,736):
  the level, the four resistances, the physical max hit and its hit, the least other max hit and the largest
  other hit (the hits the compiler wrote, the stage's `enemy<Type>Damage` in `configWritten`, D-353), and the
  DPS, the stage's `measures.dps`: the main group's figure × its Count, its minion's `MinionTotalDPS` when it
  names a minion skill (D-378). The budget and non-budget labels are the record's
  `measures.arbiter` verdict, in the template's words ("survives the Arbiter's hits", "one-shot by the Arbiter's
  <type> hit", "not measured against the Arbiter"); the entering-maps label stays solid, watch or risky (D-353).
  Each rung's `Checks` block is its block in the render, copied verbatim (D-355). Every campaign reward choice
  the campaign passes is picked, the same pick on every stage after it, the endgame stages included, and the
  guide's `Campaign route and rewards` names each pick by its first line (D-265); a plan with no campaign stage
  carries the same pick on every rung for each reward choice the campaign offers, named in `Switching over`
  (D-413, D-414).
- **The audit layer** (D-278, D-355). `audit.md` beside a current guide, with its six H2s in order, equal to what
  `render-audit.mjs` renders from the current plan, final record and last D1 gate verdict file, `Known issues`
  aside.
- **The V4 reports** (D-352). One `reports/V4-<n>.md` in the build's folder per logged pass (`V4`, `V4-recheck`,
  `V4-campaign`), numbered in the build's run order from 1 and never overwritten, in `stages/V4.md`'s form: its H1 the pass's kind, its four fields, its
  `Checked` items and its findings (ids `v4-<n>-<k>`, fields in order, `reader` on each `unresolved` one, the
  verdict the log's outcome). A re-check of `rounds/<n-1>/` reports again every finding the report before it
  left open, and its `Checked` lists every item `--changed <n-1>` prints, as the files stood when it ran (the
  next round copy, or the run folder; the step-14 Known issues lines aside). An `accepted-offline` finding names
  a claim tagged external-unavailable in the plan as that report saw it: the round copy made after it, or the
  current plan when no step wrote it since.
- **Known issues, by sentence** (D-265, D-276). The open findings are the `unresolved` findings of the
  highest-numbered report of the guide. Each is under the guide's `Known issues` as its `reader` sentence, word
  for word, and in `audit.md`'s table as its row `| <id> | V4 | — | <reader> |`; every accepted gate finding has
  its row (code, gate, plan stage) and its sentence in the guide; no other line or row: no stale one from an
  earlier cycle, and `None.` only when nothing is open or accepted.
- **The final record.** V1 and V2 pass for every stage, accepted findings aside. `sha1(plan.json)` equals the
  record's `planSha1`, unless claims-only owners (`claims-edited`, D-264) edited the plan after the final
  compile: then the record must still be that compile's (final, its PoB file the one the build's last F1 or D2
  gate named),
  and the sha1 of the plan's build-affecting part (everything but `stages[].claims`, the `ledger`, the
  `source` and `tag` fields and each price's `note`, as the server's `build/plan/buildHash.js` computes it) must
  equal the record's `buildSha1` (D-266, D-352, D-386): a ledger-only or price-note edit passes, a gear edit fails. A record without `buildSha1` (from
  before D-266) is a violation only then. The decoded `importCode` matches the record's `pobFile` sha1, with one
  tree set per plan stage, titled by the record's loadout names (D-215). The ledger is the checker's (D-365):
  every entry's current formula evaluates over the record with the server's evaluator, that value and not the
  record's stored one is the entry's wherever the checker reads it, and a claim citing an entry states its
  value (at its last significant digit, or within 5%).
- **The D1 gate, recomputed** from the record and the plan (`gates.md`): the floor (at each rung's area
  level, 69 for entering maps, each reference hit the one the compiler wrote, D-254's formula rounded by D-256),
  the budget (every rung's total range at its price day and each `over-target` finding, by `gates.md`'s "Price
  days, targets and ranges", the anoint priced like a slot; it never fails, D-371) and the
  named damage source (the `rolledSkill` part), its figure's stat set equal to `skills.main.statSet`, and a
  group that names a minion skill compared by its minion's `Minion<Field>` (D-378); the `tree` part's shape and
  its agreement with its findings, which it can't recompute without the engine (D-419). The checker fails a
  verdict that differs from its own, and, once a guide exists, any failure no accepted finding covers.
- **The run log and the control flow** (`run-log.md`, schema 4): the fields and their values, `builds[]` in
  finalize order with each build's end, the stage names `D1-build`, `D1-tree`, `D1-finish`, `F1`, `RV`, `V4`,
  `V4-recheck` and `V4-campaign`; steps in a legal order per build, each gate visit's answer followed (D-411): the
  queued cards designed in turn; in the design, D1-build, D1-tree, D1-finish, the D1 gate, then the design gate;
  F1 only after a `design` visit answered `accept` or `accept:file` (D-362, D-413), a `revise:` running D1 again,
  its gate and the design gate, and `verification` the verification gate; D2 only for a campaign; entries after a
  build's or the run's end only behind a resume, placed by its `resumes[]` entry's lengths (D-415); a refused step
  re-run next, alone (D-421); each gate attempt routed as its verdict file says; R1b
  at most 3 counted attempts and each gate at most 2 counted retries (S6 honoured: only an attempt-1 failure the
  verdict's `faultsApplied` explains is free); one full V4 pass per guide, and at most one re-check per fix
  round or revision, covering only what `check-run.mjs --changed <n>` lists (D-352); a revision checked by a
  re-check, never a full pass; a claims-only owner only before any gate of its round and never directly before
  a gate (a claims-only D1 may be followed by a D2 that recompiles, and its D2 gate); escalations only from the
  gates, each naming its verdict file; a `rule` on every pre-supplied or default answer; each gate visit's
  display in `displays[]` before its answer (D-367); the run's `completed` only when a build ended `completed`
  or `file-only` (checkpoint 2's accept, in a schema-2 log, whose D1 stays one step); and no `rate_limited` or
  `locked_out` price outcome (NFR-22).
- **What is current.** The runner can't delete files, so the log says which artifacts are current: a build's
  guide is when no design step of its card ran after its W1, and its final record when no producer that
  recompiled ran after its last F1 or D2 gate (a claims-only D1 or D2 leaves it current).
  A guide, V4 reports or a record from an earlier cycle or concept aren't held to the current plan.
