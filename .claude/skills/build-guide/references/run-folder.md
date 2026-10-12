# The run folder

Every run of the build-guide skill works inside one run folder, which the server creates. This page is
the layout, who writes each file, how the PoB file is named, and what the run checker holds a run folder
to (slice 03 §2 and FR-W7, as amendments 1 and 3 change them; spine C-34, C-36, C-52).

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
  `<runFolderRel>/plan.json`, `<runFolderRel>/concepts/<id>/plan.json` for a card's skeleton, or
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

The card the user finalizes is recorded in the run log, not in the folder name. Each run gets a new dated folder and never writes into an earlier run's
folder (D-153).

## Layout and ownership

| Path in the run folder | Written by (only) | Content |
|---|---|---|
| `run-log.json` | the runner, through `scripts/run-log.mjs` (D-356) | the run log (`run-log.md`) |
| `research/p<k>-r1a-<n>.md` | R1a agent `n` of brainstorm round `k` | its sections, with source markers (`source-markers.md`) |
| `cards/<id>.md` | R1a (the brainstorm half), then R1b (the verification half) | a candidate card (`templates/card-template.md`, C-52) |
| `cards.md` | the R1a-assemble step | the deck: the dealt cards by round, then "Not dealt" (D-287) |
| `concepts/<id>/plan.json` | the R1b step for card `<id>` | an endgame skeleton plan (C-31) with its key-item prices |
| `concepts/<id>/compile-record.json`, `concepts/<id>/compiled-build.xml` | `mcp__pob2__compile_plan`, measure-only (D-208) | the skeleton's compile record (C-33) and compiled XML |
| `probes/<id>/<n>/plan.json`, and its record and XML | the R1b step for card `<id>`; `mcp__pob2__compile_plan`, measure-only | a probe variant, one stage, `n` from 1 to 4 (D-292, D-331, D-338) |
| `dossier.md` | the R1b-assemble step | the dossier, the verification gate's comparison table (slice 03 §7.2, D-355) |
| `plan.json` | D1's two steps (D1-build, D1-finish) and D2; the D1 gate step only to apply FI-2 and the final re-price pass | the plan (C-31) |
| `compile-record.json`, `compiled-build.xml` | `mcp__pob2__compile_plan` | the record of the last compile of `plan.json`; after the final compile it names the PoB file and holds `importCode` |
| `guide.md` | W1; the runner replaces its `Known issues` list each cycle (step 14, D-265) | the guide, the reader layer (slice 03 §8, D-276) |
| `audit.md` | the runner, rendered by `scripts/render-audit.mjs` after the final compile (D-355); W1 adds the accepted gate findings' rows to its `Known issues`, and the runner fills that table each cycle (step 14) | the audit layer (slice 03 §7.8, D-278) |
| `reports/gates/<stage>-<concept>-a<attempt>.json` | the gate step itself: R1b, D1-gate or D2-gate | its verdict (`gates.md`) |
| `rounds/<n>/` | the run checker's `--snapshot <n>`, which the runner runs before a fix round or a revision (A-34) | the round copy: `plan.json`, `compile-record.json` and `guide.md` as they stood, which `--changed <n>` compares with; nobody reads it |
| `reports/V4-<n>.md` | the verifier itself, one per pass, never overwritten (D-352) | the V4 full pass's or a re-check's report (`source-markers.md`, `stages/V4.md`) |

- Card ids are `r<round>-<researcher letter>-<n>` (`r1-a-2`): the runner letters the researchers `a`, `b`
  and `c` when it starts them, so parallel researchers never collide and ids stay unique across rounds
  (D-319). A step's `concept`, a gate file's `<concept>` and `concepts/<id>/` use the card id. (Runs before
  amendment 3 used concept ids `c1`, `c2`, ….)
- `<stage>` in a gate file is `R1b`, `D1-gate` or `D2-gate`; `<attempt>` counts from 1 per (stage,
  concept), as the header and the run log's `stages[]` do. A V4 report's `<n>` counts the run's V4 passes
  from 1, full pass and re-checks alike.
- Every V4 report is kept: a re-check or a revision's check writes the next `<n>`, never over an earlier
  report.
- Nothing else goes in the run folder. No agent writes outside it (D-177), and agents running in
  parallel write different files (C-36).

## The PoB file

Only the run's final compile writes a PoB file into the builds folder, through the server (C-17,
D-208). Its `build_name` is `<slug>-<YYYY-MM-DD>-<n>`: the run folder's last two segments joined with
`-`, so every run writes a new file (D-113, D-199). Every earlier compile, the concept skeletons'
included, is measure-only and writes only the record and the compiled XML beside its plan.

A re-compile within the run (the fix round's, or a revision's) rewrites that same file. The server's write
ledger allows it only while the file is unchanged since this run wrote it; otherwise
`mcp__pob2__compile_plan` refuses, with C-17's changed-on-disk wording when someone edited the file, or its
"already exists" wording when the ledger has no entry for this run (D-211). A refusal is a failed attempt
like any other: report it, never work around it.

## What the run checker checks

`node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>` checks what the folder holds, whatever
the run's status; when a guide exists, every guide check applies (amendment 1 §4.2). It uses Node built-ins
and the server's own compiled ledger evaluator, `build/plan/ledger.js`, and build projection,
`build/plan/buildHash.js` (D-266). Each violation is one stderr line
`check-run: [<rule>] <message>`.

- **The artifacts.** This layout. The dossier's H2s. Every dossier and research marker resolves and parses
  as a C-30 tag. Offline, every price is `unavailable` and no step priced.
- **The reader layer** (D-276, D-283). The guide's 14 H2s in order, its `Checks` H3s, `What PoB can't show`
  ending with the H3 `Known issues`, and its Leveling H3s equal to the record's loadout names. At most 3,000
  words, a word being a run of non-space characters holding a letter or a digit, the H1, the import code and
  the Known issues list not counted. No footnote marker (`[^`), confidence label (`confidence L`) or finding id
  (`v4-<n>-<k>`) anywhere outside the import code. The import code, the first fenced block of `Your PoB file`,
  equals the record's (D-205). One fixed-form verdict line per endgame rung in `Survival by stage`, each number
  equal to the record's value rounded at the written number's last significant digit ("2,740" matches 2,736):
  the level, the four resistances, the physical max hit and its hit, the least other max hit and the largest
  other hit, and the named damage source's figure the D1 gate's verdict names. Every campaign reward choice the
  campaign passes is picked, the same pick on every stage after it, the endgame stages included, and the
  guide's `Campaign route and rewards` names each pick by its first line (D-265).
- **The audit layer** (D-278). `audit.md` beside a current guide, with its six H2s in order.
- **Known issues, by sentence** (D-265, D-276). Every finding open after the re-check is under the guide's
  `Known issues` as its `reader` sentence, word for word, and in `audit.md`'s table as its row; every accepted
  gate finding has its row (code, gate, plan stage) and its sentence in the guide; no other line or row: no
  stale one from an earlier cycle, and `None.` only when nothing is open or accepted. Every `unresolved` V4
  finding has its `reader`. A V4 report superseded by one that checked every claim again (a full re-check
  after a gate re-ran, or a revision's full pass) is held to the artifact as it was: once a step wrote that
  artifact after it, its locations aren't checked.
- **The final record.** V1 and V2 pass for every stage, accepted findings aside. `sha1(plan.json)` equals the
  record's `planSha1`, unless claims-only owners (`claims-edited`, D-264) edited the plan after the final
  compile: then the record must still be that compile's (final, its PoB file the one the last D2 gate named),
  and the sha1 of the plan's build-affecting part (everything but `stages[].claims` and the `source` and `tag`
  fields, as the server's `build/plan/buildHash.js` computes it) must equal the record's `buildSha1` (D-266).
  A record without `buildSha1` (from before D-266) is a violation only then. The decoded `importCode` matches the record's `pobFile` sha1, with one tree set per
  plan stage, titled by the record's loadout names (D-215). Every ledger entry, re-evaluated over the record
  by the server's evaluator, equals the record's value to 2 decimals.
- **The D1 gate, recomputed** from the record and the plan (`gates.md`): the floor (at each rung's area
  level, 69 for entering maps), the budgets (20 divines for the budget variant, 5 for entering maps) and the
  named damage source (the `rolledSkill` part), its figure's stat set equal to `skills.main.statSet`. The
  checker fails a verdict that
  differs from its own, and, once a guide exists, any failure no accepted finding covers.
- **The run log and the control flow** (`run-log.md`): the fields and their values; steps in a legal order;
  each gate attempt routed as its verdict file says; R1b at most 3 counted attempts and each gate at most 2
  counted retries (S6 honoured: only an attempt-1 failure the verdict's `faultsApplied` explains is free);
  one full V4 pass per guide, and at most one re-check per fix round or revision, covering only what
  `check-run.mjs --changed <n>` lists (D-352); a claims-only
  owner only before any gate of its round and never directly before a gate (a claims-only D1 may be followed
  by a D2 that recompiles, and its D2 gate); escalations only from the gates, each naming its verdict file; a `rule` on every
  pre-supplied or default answer; and `completed` only after the final gate's accept (checkpoint 2's, in a
  schema-2 log).
- **What is current.** The runner can't delete files, so the log says which artifacts are current: the guide
  is when no design step ran after its W1, and the final record when no producer that recompiled ran after
  the last D2 gate (a claims-only D1 or D2 leaves it current).
  A guide, V4 reports or a record from an earlier cycle or concept aren't held to the current plan.
