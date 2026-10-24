# The task header

Every agent prompt starts with a fenced `json` block: the task header (slice 03 §5.1, as amendments 1
to 10 change it). The runner builds it from the run state; the agent reads its job from the header and from the
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
  "reference": ".claude/skills/build-guide/references/stages/D1-build.md"
}
```
````

| Field | Content |
|---|---|
| `stage` | `R1a`, `R1a-synthesize` (the round's composites, D-429), `R1a-assemble` (in a run whose first brainstorm round used it), `R1b`, `R1b-assemble`, `RV` (the rival, D-408), `D1-build`, `D1-tree`, `D1-finish` (D1's three steps, D-356, D-418), `D1-gate`, `F1` (an endgame-only build's final compile, D-413), `D2`, `D2-gate`, `W1`, `V4` (`V4-campaign` for its campaign pass, D-415), or `Q` (a gate question, D-390) |
| `attempt` | this step's attempt for its (stage, concept), from 1: every call counts, retries and re-runs included; a V4 re-check's counts that card's re-checks from 1, apart from its full pass, as the run log's `V4-recheck` entries do (D-368) |
| `concept` | the card id (`r<round>-<letter>-<n>`, `r1-a-2`; D-286, D-319; letter `x` for the rival's card, D-408; letter `s` for a composite, `r<k>-s-<n>`, D-429), where the step concerns one card: R1b and every step of the finalization |
| `check` | V4 only: `full` (step 11: one pass, no lenses, over every hinge claim and every H2 of the guide), `recheck` (step 13: only `findings` and `changed`, D-352) or `campaign` (stage `V4-campaign`: the campaign stages' hinge claims, `findings` and `changed`, D-415) |
| `mode` | `offline` or `online`, as the run log records it |
| `runFolder` | the run folder's absolute path, from `mcp__pob2__guide_run {new_run}` |
| `runFolderRel` | the run folder relative to the guides root; a build's `plan_path` is `<runFolderRel>/<buildFolder>/plan.json` (`<runFolderRel>/plan.json` when `buildFolder` is `.`) |
| `buildFolder` | a build's steps only (D1-build, D1-tree, D1-finish, D1-gate, F1, D2, D2-gate, W1, V4), and a Q about a finalized build: the build's folder under `runFolder`, `builds/<id>` (D-412), or `.` for a build migrated from schema 3, whose files stayed at the root. Its `plan.json`, record, guide, audit, V4 reports and round copies are there; the run's files (`run-log.json`, `cards/`, `dossier.md`, `interviews/`, `reports/gates/`) are at the run folder's root |
| `compile` | `none`, `measure-only` or `final`: what this step may ask `mcp__pob2__compile_plan` for |
| `buildName` | F1 and the D2 gate only: `<slug>-<YYYY-MM-DD>-<n>-<id>`, the run folder's last two segments and the card id joined with `-` (D-412; `run-folder.md`), for its final compile; `<slug>-<YYYY-MM-DD>-<n>` for a build in `.`. A D2 gate after a campaign adds `-campaign`, a new file beside the endgame one (D-415) |
| `findings` | what to fix or check: the earlier attempt's gate verdict (its file and findings), the V4 findings routed to this owner, the user's requests (`code: "user-request"`), from the design gate's or the final gate's `revise:<text>` or a revision riding on the verification gate's finalize (D1-build's first attempt, D-391), or guidance (`code: "user-guidance"`); for D1-build in the fix round, the findings D1-finish returned under `build:`; for D1-tree, the D1 gate's `tree-swap` findings on a tree retry, or the user's requests about the tree alone (D-418); for a V4 re-check or campaign pass, the ids of the last report's `unresolved` findings; `[]` otherwise |
| `changed` | a V4 re-check or campaign pass, W1 in the fix round, and a D1-finish after D1-build (the locations D1-build returned). The re-check's: the lines `check-run.mjs --changed <n>` printed, verbatim, one item each: `claim stages[<i>].claims[<k>] (<id>)` or `section <H2 title>` (D-352). W1's: the locations the fix round's owners returned (`plan.json stages[2].claims[1]`), or `"all"` when a gate re-ran in the fix round (an owner recompiled: W1 brings every number and the import code up to the new record) |
| `changes` | R1b only, a gate's change to its card (D-391): `{visit, words}` revises it; `{visit, name, from, words}` makes it, `from` the cards it draws on, composites included, and the piece keys (a Pieces row's key or an Ideas line's id, D-432); a card made from pieces is a composite, with the Pieces tables |
| `accepted` | gate findings the user accepted at an escalation of this build, from its verdict file: a build's steps carry only its own (D-411); an equal finding (same plan stage, part and code) fails no gate of that build. F1's header carries those of the D1 gate's escalations and its own (D-413) |
| `faults` | offline test mode only: this step's fault directives (`offline-and-test.md`) |
| `writes` | the run-folder paths this step may write, relative to `runFolder`; nothing else. R1a's are its research file and its cards, `cards/r<k>-<letter>-1.md` to `-3.md`; R1a-synthesize's `cards.md`, its composites' cards `cards/r<k>-s-<n>.md` and the round's cards, for a rename (D-429, D-392); R1a-assemble's `cards.md` and the round's cards, for a rename (D-392); R1b's include its card `cards/<id>.md` and its probes `probes/<id>/<n>/` (D-338); R1b-assemble's `dossier.md`, and `cards.md` for a card made at a gate (D-391); RV's its card `cards/r<k>-x-<n>.md` (D-408); Q's its report `interviews/<gate>-<visit>-q<n>.md`, and a coordinator's variant `probes/q-<gate>-<visit>-<n>/` (D-390); D1-build's, D1-tree's, D1-finish's and D2's `<buildFolder>/plan.json`, and D1-build's `<buildFolder>/pieces.md` too (D-434); a gate step's (D1-gate, F1, D2-gate) its verdict file under `reports/gates/`; W1's are `<buildFolder>/guide.md` and `<buildFolder>/audit.md` (D-278); V4's its own report, `<buildFolder>/reports/V4-<n>.md` (D-352), the build's next number |
| `reference` | the step's stage reference, under `references/stages/` |

Rules:

- **Only the header's paths.** A step writes only the paths in `writes`, all inside the run folder
  (D-177). Steps running in parallel never share a path. A gate step's `writes` include its verdict file,
  `reports/gates/<stage>-<concept>-a<attempt>.json`.
- **Fresh verifiers** (R-5, D-142). A V4 prompt is the header and the reference line, nothing else: no D1,
  D2 or W1 output text, only paths. The verifier reads the artifacts itself. A re-check's `findings` are
  finding ids from the last report, and `changed` holds the checker's location lines, never text.
- **Compile only as the header says.** `compile: "none"` means no `mcp__pob2__compile_plan` call;
  `measure-only` means `measure_only: true`; only F1 and the D2 gate carry `final`, with `buildName`, and each
  compiles measure-only first.
- **Faults travel only in headers**, only in offline test mode, and only to the steps they target.
