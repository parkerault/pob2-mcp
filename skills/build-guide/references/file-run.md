# A run from a PoB file: the steps before the ladder (D-522)

The runner's steps for `/pob2:build-guide` from a player's own PoB file (amendment 16 §18, C-51): the character read
into a plan, measured, placed on the ladder, made better first when the user wants it, then the pipeline's own steps
from the design on (`skills/build-guide/SKILL.md` §4 to §8) around its rung. Its one build is `file`, in `builds/file/`
(D-412), its card the file card `cards/file.md`: R1a, R1b and the verification gate don't run, and nothing asks to go
back to a verification gate. Read this once, at the start, and after a compaction.

## 1. Start

- **The request.** `/pob2:build-guide <build name or import code> [--offline [--test <path>]] [--no-ninja]`, or the
  user's own words asking for a guide to their build or file ("a build guide for my build MyCharacter123"). **A build
  the user names** is matched against `mcp__pob2__list_builds`: the file whose name, without its folder, equals the name
  the user gave, case and `.xml` ignored, is the build. When no file matches, or several do (one name in two folders),
  list the closest names, each with its folder, and ask which; never guess. A long code with no spaces is an import code:
  it goes only to the reader, never in the log or your reply.
- **The brief** (C-51, Appendix A.6): `from`, the build's name as `list_builds` gave it, or `"import code"`; `better`,
  `true` when the user wants the character made better first (in the request, or at your one question before the read:
  "make it better first, within a budget you name, or keep it as it is?"); `campaign`, `false` only when the user
  declines the campaign (the guide from level 1, D2 after F1), which you offer once at the start; and any other field the
  words give (`budget`, `notes`), never invented. The file gives the class, ascendancy and skill: no brief check.
- **The folder and the log.** `mcp__pob2__guide_run {new_run: "file"}`: keep `runFolder`, `runFolderRel` and
  `loadedBuildUnsaved`. Then `pob2-run-log <runFolder> init` with `{"slug": "file", "brief", "mode", "testConfig",
  "noNinja"}` (`init` refuses a `from` without the slug `file`, and the slug without it). Then
  `skills/build-guide/references/start.md`'s steps 3 to 5 as written: the test config, the unsaved build, the league
  digests' line.

## 2. Read and measure (steps 2 and 3 of `skills/compile/SKILL.md`)

- **Read**: `mcp__pob2__plan_from_build {run_folder: <runFolderRel>, build_name}` or `{run_folder, import_code}`, its
  questions as an interview, then its second call with the answers only; it writes `source.xml`, `plan.json` and
  `read.json` at the folder's root. Log `read` `done`; a refusal logs `read` `fail` and ends the run `stopped`.
- **Measure**: a fresh `pob2:build-guide-coordinator`, `stage: "measure"`, `compile: "measure-only"`, `buildFolder: "."`,
  `writes: ["measure.md", "plan.json", "cards/file.md"]`, its reference
  `skills/compile/references/stages/measure.md`, the user's words about the character in its prompt. Log `measure`.
- **The display**, as compile's step 4: the measured file, the headline, each target's distance, the callouts, the
  Spirit question. An answer that changes the plan runs read (its second call: `buffs_on`, `buffs_swap`, `switch_off`,
  `main_group`) and measure again, each logged again.
- **The build**: `pob2-run-log <runFolder> build` with `{"id": "file", "roll": {className, ascendancy, skill}, "name",
  "status": "queued"}`, the roll and name from the file card's Identity and name (`cards/file.md`).

## 3. Place (step `place`)

Tell the user before pricing starts (`skills/build-guide/references/runner-rules.md`), then a fresh coordinator,
`stage: "place"`, its reference `skills/pricing/references/stages/price.md` (its placement scope), `buildFolder: "."`,
`writes: ["plan.json"]`, `budget` and `rung` null, `maxSearches` your notice's bound. Without trade (offline,
`--no-ninja`, or a stop before a rung is known) ask the user for the rung, never assumed: entering maps, budget or
non-budget, passed as `rung`. Below the endgame (level under 65, or the owner's word) the place is "in the campaign": no
rung is placed, and the ladder's three rungs are designed, seeded from the character (choice A). Log `place` with its
`priceOutcomes`. A pricing stop is the pipeline's: no trade request until a gate's `retry-pricing` or a resume.

## 4. The better round (with the brief's `better`; §17)

The budget asked in the user's words, which go verbatim in each design step's prompt. D1-build, D1-tree, D1-finish and
the D1 gate, each with `scope: "better"`, `concept: "file"`, `buildFolder: "builds/file"`: D1-build's first attempt
writes `builds/file/plan.json` from the read plan at the root. Route them as SKILL.md §4 does; a target the budget can't
reach is a finding with its `cost`, not a failed attempt. The D1 gate's `draft_name` is the source's name and ` better`
(an import code's: the file card's name and ` better`); log its draft in `builds[].draftFile`. **The design gate**
(`display design --build file`), an interview: **accept** places the result again, **revise** (`revise:<text>`) runs D1
again, **stop** ends the run `stopped`. After the accept: `place` once more, `buildFolder: "builds/file"`, `writes:
["builds/file/plan.json"]`, every price the plan holds reused (the user's rung again without trade).

## 5. The ladder (step 6a onward)

SKILL.md §4 to §8 on the build `file`, D1's four steps with `scope: "ladder"`, `concept: "file"`, `buildFolder:
"builds/file"`. D1-build's first attempt writes `builds/file/plan.json` from the read plan at the root, or edits the
better round's. **The D1 gate** never fails the placed rung (the stage that keeps the reader's `source`) for its floor,
tree or budget: a floor or tree failing only on the placed rung's findings, each floor finding with its `cost`, routes
as a pass, to the design gate. **The design gate** takes accept (the guide or the file only, and late endgame scaling),
`accept:file`, revise or stop. F1, then the campaign unless the brief declined it: D2 and the D2 gate (SKILL.md §7's
chain, the D2 gate's `buildName` the session name and ` (campaign)`), then W1 and steps 11 to 16. The final gate takes
accept, campaign, revise or decline. An escalation takes accept, retry or stop; an `infeasible` design, or a design gate
answered stop, ends the run `stopped`.

## 6. A resume

`/pob2:build-guide --resume <run folder>`: "Resuming a run" in `skills/build-guide/references/start.md`, its steps 1
to 5, then the step a stop ended runs again; a build stopped at its design gate after a passing D1 gate is back at that
gate. There is no verification gate.
