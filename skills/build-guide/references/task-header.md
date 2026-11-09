# The task header

Every agent prompt starts with a fenced `json` block: the task header (slice 03 §5.1, as amendments 1
to 14 change it). The runner builds it from the run state; the agent reads its job from the header and from the
stage reference it names, and the rest of the prompt adds nothing the header contradicts.

````
```json
{
  "stage": "D1-build",
  "attempt": 1,
  "concept": "r1-a-2",
  "mode": "offline",
  "runFolder": "/abs/guides/titan-blood-hunt/2026-10-08-1",
  "runFolderRel": "titan-blood-hunt/2026-10-08-1",
  "buildFolder": "builds/r1-a-2",
  "compile": "measure-only",
  "findings": [],
  "accepted": [],
  "faults": [],
  "writes": ["builds/r1-a-2/plan.json", "builds/r1-a-2/pieces.md"],
  "root": "/abs/plugins/pob2",
  "reference": "skills/build-guide/references/stages/D1-build.md"
}
```
````

| Field | Content |
|---|---|
| `stage` | `R1a`, `R1a-synthesize` (the round's composites, D-429), `R1a-assemble` (in a run whose first brainstorm round used it), `R1b`, `R1b-assemble`, `D1-build`, `D1-tree`, `D1-finish` (D1's three steps, D-356, D-418), `D1-gate`, `F1` (an endgame-only build's final compile, D-413), `D2`, `D2-gate`, `W1`, `V4` (`V4-campaign` for its campaign pass, D-415; `V4-claims` for a file-only build's claims pass, D-477), or `Q` (a gate question, D-390) |
| `attempt` | this step's attempt for its (stage, concept), from 1: every call counts, retries and re-runs included; a V4 re-check's counts that card's re-checks from 1, apart from its full pass, as the run log's `V4-recheck` entries do (D-368) |
| `concept` | the card id (`r<round>-<letter>-<n>`, `r1-a-2`; D-286, D-319; letter `g` for a card made at a gate, D-391; letter `s` for a composite, `r<k>-s-<n>`, D-429), where the step concerns one card: R1b and every step of the finalization |
| `check` | V4 only: `full` (step 11: one pass, no lenses, over every hinge claim and every H2 of the guide), `recheck` (step 13: only `findings` and `changed`, D-352), `campaign` (stage `V4-campaign`: the campaign stages' hinge claims, `findings` and `changed`, D-415) or `claims` (stage `V4-claims`: a file-only build held to amendment 13, every hinge claim of the plan and no guide, after F1's pass, D-477) |
| `scope` | D1-finish and W1 only, in a build held to amendment 14 (D-481, D-486, D-487; Appendix A), recorded on the stage entry as its `scope`: D1-finish's `swap` (a one-item swap, right after a design or final gate's `revise:`: the one slot's item as the user gave it, its trades re-measured on the swapped rungs, the swap in the plan's `itemSwaps[]`) or `scaling` (the late endgame scaling pass, after a design accept with `scaling: true` and before F1: the finds over the budget re-priced and measured, `trades.json` its only write); W1's `notes` (a file-only build's PoB notes, after its claims pass and any re-check); from revision 16, D1-build's, D1-tree's, D1-finish's and D1-gate's `better`, the better round on a player's read character (D-521), and `ladder`, a file run's rungs around its placed one (D-522). Absent otherwise: the step's whole job |
| `mode` | `offline` or `online`, as the run log records it |
| `runFolder` | the run folder's absolute path, from `mcp__pob2__guide_run {new_run}` |
| `runFolderRel` | the run folder relative to the guides root; a build's `plan_path` is `<runFolderRel>/<buildFolder>/plan.json` (`<runFolderRel>/plan.json` when `buildFolder` is `.`) |
| `buildFolder` | a build's steps only (D1-build, D1-tree, D1-finish, D1-gate, F1, D2, D2-gate, W1, V4), and a Q about a finalized build: the build's folder under `runFolder`, `builds/<id>` (D-412), or `.` for a build migrated from schema 3, whose files stayed at the root. Its `plan.json`, record, guide, audit, V4 reports and round copies are there; the run's files (`run-log.json`, `cards/`, `dossier.md`, `interviews/`, `reports/gates/`) are at the run folder's root |
| `compile` | `none`, `measure-only` or `final`: what this step may ask `mcp__pob2__compile_plan` for |
| `buildName` | F1 and the D2 gate only, for the final compile. In a build held to amendment 13 (D-466), **the build's session name**: its `name` in `run-log.json`'s `builds[]`, else its card's name (`Royal Fury Rake Titan`); the D2 gate's adds ` (campaign)`, a new file beside the endgame one (D-415); a re-compile's is the file name the run log recorded (`builds[].pobFile`). An older build keeps `<slug>-<YYYY-MM-DD>-<n>-<id>`, the run folder's last two segments and the card id joined with `-` (D-412; `skills/build-guide/references/run-folder.md`), `<slug>-<YYYY-MM-DD>-<n>` for a build in `.`, and the D2 gate's adds `-campaign` |
| `firstFree` | F1 and the D2 gate only, a build held to amendment 13 (D-466): `true` on the build's first final write (F1's) and on its campaign's first (the D2 gate's): the server cleans the name and writes the first free of `<name>`, `<name> <run date>`, `<name> <run date> <k>`; `false` on a re-compile, which passes the recorded name, so the write ledger still refuses a file the user changed (D-211) |
| `draftFile` | F1 only (D-466): `builds[].draftFile`, the draft the D1 gate wrote, which F1 removes after the final file is written; `null` for none |
| `findings` | what to fix or check: the earlier attempt's gate verdict (its file and findings), the V4 findings routed to this owner (in a build held to amendment 14, only `{id, report}`: each finding's id and its report's path, D-482), the user's requests (`code: "user-request"`; in a build held to amendment 14 each `{code, id, words, restatement}`, `id` `u<k>`, `words` the user's text verbatim or a read-back's `readback.json` changes, the runner's restatement beside them, D-482), from the design gate's or the final gate's `revise:<text>` or a revision riding on the verification gate's finalize (D1-build's first attempt, D-391), or guidance (`code: "user-guidance"`); for D1-build in the fix round, the findings D1-finish returned under `build:`; for D1-tree, the D1 gate's `tree-swap` findings on a tree retry, or the user's requests about the tree alone (D-418); for a V4 re-check or campaign pass, the ids of the last report's `unresolved` findings; `[]` otherwise |
| `changed` | a V4 re-check or campaign pass, W1 in the fix round, and a D1-finish after D1-build (the locations D1-build returned). The re-check's: the lines `pob2-check-run --changed <n>` printed, verbatim, one item each: `claim stages[<i>].claims[<k>] (<id>)` or `section <H2 title>` (D-352). W1's: the locations the fix round's owners returned (`plan.json stages[2].claims[1]`), or `"all"` when a gate re-ran in the fix round (an owner recompiled: W1 brings every number and the import code up to the new record) |
| `changes` | R1b only, a gate's change to its card (D-391): `{visit, words}` revises it; `{visit, name, from, words}` makes it, `from` the cards it draws on, composites included, and the piece keys (a Pieces row's key or an Ideas line's id, D-432); a card made from pieces is a composite, with the Pieces tables |
| `accepted` | gate findings the user accepted at an escalation of this build, from its verdict file: a build's steps carry only its own (D-411); an equal finding (same plan stage, part and code) fails no gate of that build. F1's header carries those of the D1 gate's escalations and its own (D-413) |
| `faults` | offline test mode only: this step's fault directives (`skills/build-guide/references/offline-and-test.md`) |
| `digests` | R1a and a researcher's `Q` (D-507, amendment 16 Appendix A.2): the running league digests' paths, newest first (the latest start first), root-relative (`data/league/<name>.md`; a user-side digest's absolute), copied verbatim from the `digests:` line `pob2-run-log`'s `init` or `resume` printed, `[]` when no running league has one. The step reads those digests and no other: each head whole, newest first, the bodies by Grep. Neither the runner nor the agent picks a digest itself |
| `source` | W1 in a `/pob2:writer` run only (D-522): `{runFolder, buildFolder}`, the source run folder's absolute path and its build's folder in it, which W1 reads; its own `buildFolder` is `.` |
| `writes` | the run-folder paths this step may write, relative to `runFolder`; nothing else. R1a's are its research file and its cards, `cards/r<k>-<letter>-1.md` to `-3.md`; R1a-synthesize's `cards.md`, its composites' cards `cards/r<k>-s-<n>.md` and the round's cards, for a rename (D-429, D-392); R1a-assemble's `cards.md` and the round's cards, for a rename (D-392); R1b's include its card `cards/<id>.md` and its probes `probes/<id>/<n>/` (D-338), and the skeleton file goes through the server, not `writes` (the draft calls, below); R1b-assemble's `dossier.md`, and `cards.md` for a card made at a gate (D-391); Q's its report `interviews/<gate>-<visit>-q<n>.md`, and a coordinator's variant `probes/q-<gate>-<visit>-<n>/` (D-390); D1-build's, D1-tree's, D1-finish's and D2's `<buildFolder>/plan.json`, D1-build's `<buildFolder>/pieces.md` too (D-434), and D1-tree's, for its `## Jewel lines` only (D-453), and D1-tree's and D1-finish's `<buildFolder>/trades.json`, each replacing only its own kinds of trade (D-439), and in a build held to amendment 14 D1-build's `<buildFolder>/trades.json` too, for its `scaling` finds only, D1-finish's taking `scaling` beside its own kinds, each replacing only the finds it wrote (`by`, D-486); a gate step's (D1-gate, F1, D2-gate) its verdict file under `reports/gates/`; W1's are `<buildFolder>/guide.md` and `<buildFolder>/audit.md` (D-278); V4's its own report, `<buildFolder>/reports/V4-<n>.md` (D-352), the build's next number; and with `scope: "notes"`, W1's is `<buildFolder>/notes.txt` alone (D-487) |
| `root` | the plugin root's absolute path, as the runner's `skills/build-guide/SKILL.md` shows it after `${CLAUDE_PLUGIN_ROOT}` is replaced (amendment 15, D-500); every root-relative path in a reference (one that starts with a folder at the root, such as `skills/` or `data/`) is under it |
| `reference` | the step's stage reference, root-relative under `root`: `skills/build-guide/references/stages/<stage>.md` |

Rules:

- **Only the header's paths.** A step writes only the paths in `writes`, all inside the run folder
  (D-177). Steps running in parallel never share a path. A gate step's `writes` include its verdict file,
  `reports/gates/<stage>-<concept>-a<attempt>.json`.
- **Fresh verifiers** (R-5, D-142). A V4 prompt is the header and the reference line, nothing else: no D1,
  D2 or W1 output text, only paths. The verifier reads the artifacts itself. A re-check's `findings` are
  finding ids from the last report, and `changed` holds the checker's location lines, never text.
- **The fix round's briefs** (D-482), in a build held to amendment 14: an owner's `findings` are the V4 finding ids
  and their report's path, `{id, report}`, with no scope and no facts of the runner's; the owner reads each finding in
  the report and decides what to recompile.
- **The user's words** (D-482). A user request's `words` are the user's, verbatim; the prompt adds no request, item,
  price or latitude they didn't name, and keeps a condition a condition. A step that takes requests returns one line
  per request outside its 8-line return, as D1-tree's `jewel:` lines are: `request: <id> made` or `request: <id>
  departs: <how>`. The runner logs them as the stage entry's `requests` and stops at the first `departs`.
- **Compile only as the header says.** `compile: "none"` means no `mcp__pob2__compile_plan` call;
  `measure-only` means `measure_only: true`; only F1 and the D2 gate carry `final`, with `buildName`, and each
  compiles measure-only first. The draft calls (below) and F1's trade links (`{plan_path, trade_links: true}`, D-488,
  which loads the final build and compiles nothing) aren't compiles: R1b makes its skeleton file's under
  `measure-only`, and F1 its draft's removal and its links under `final`.
- **The draft calls** (D-466), which run no engine: the D1 gate's step 6, on a pass that leads to the design gate,
  calls `mcp__pob2__compile_plan {plan_path, draft_name: <the build's session name>}`, which copies its whole-plan
  compile into the builds folder as `<name> (draft).xml`; F1, after its final compile, calls `{plan_path,
  remove_draft: <draftFile>}`; and R1b, as its last act on a damage pass (D-479), calls `{plan_path:
  "<runFolderRel>/concepts/<id>/plan.json", draft_name: "<card name> skeleton"}`, which writes the card's skeleton
  file, `<card name> skeleton (draft).xml`, and returns it as `skeleton: <relpath>`. No other step writes or deletes a
  draft (the runner writes an escalation accept's draft and removes a picked card's skeleton, `skills/build-guide/SKILL.md`), and the
  server's writer backs a draft up before it deletes it.
- **Faults travel only in headers**, only in offline test mode, and only to the steps they target.
