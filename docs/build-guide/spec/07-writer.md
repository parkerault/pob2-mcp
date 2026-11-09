# Slice 07: The writer, `/pob2:writer`, and the guide's rules

**Status: written current 2026-11-09 (WU-167, D-525), as built at M-30.** Part of the project spine,
[`docs/spec/README.md`](../../spec/README.md) ("spine"), which wins any disagreement; fold fixes back into it. It
covers the writer piece (D-522's writer part; contract C-65) and the rules every guide follows since M-30, wherever W1
writes it (a `/pob2:build-guide` run, a run from a player's file, or a writer run): a guide's rules on owned content,
the line for a buff switched as needed (D-518), the line for a granted skill's quality (D-512) and the overlay's mark
(D-523). Its work units are WU-165, built, and WU-164's guide part, built, with WU-168's writer case, open; its
criteria AC-W157, AC-W158 and AC-W160's writer part. Its source is amendment 16 (`amendment-16-pieces-and-launch.md`,
approved 2026-11-08, cited "a16 §n"), §12, §14, §15, §18 and §19 with Appendix A.2, A.6 and A.9, and the work-log's
record of M-30 (`../worklog.md`, "WL:n", WL:7449 on), which wins where the build differs from the amendment's text: each
difference is stated where it applies, and the coordinator's calls are marked so. Slice 03 §8 keeps the guide
template's history (the reader layer, its H2 table and word budgets, D-276 on), with a note pointing here. Paths are
root-relative: from the repository root, which is the plugin root (C-57).

## 1. Scope

The writer writes the guide for a build that is already designed and finished, in a run folder of its own, changing
nothing in the run that holds the build (a16 §18): a `/pob2:build-guide` run's build, a run from a player's file, or a
`/pob2:compile` run whose better round was accepted. It is the smallest of the pieces (a16 §29: the roadmap's "compile
and the writer" names it, though a guide from a file reaches W1 through `/pob2:build-guide`).

In scope:
- the piece's `SKILL.md`, in `skills/writer/` (its one file; W1's stage reference and the guide templates stay
  build-guide's, read by path, a16 §21);
- the source a writer run reads, `pob2-run-log init`'s refusal of a source that can't carry a guide, W1's `source`, the
  renders' source, the checker on a writer run;
- the guide's rules on owned content, switched buffs, granted quality and the overlay, in W1 and the two guide
  templates, for every run;
- the requests it answers: "write the guide for the build I just made", "write a guide for my improved character",
  "rewrite the guide for that run" (its description);
- its real case (§6).

Out of scope, each with its home:
- a guide from the player's own PoB file or character, which designs it first: `/pob2:build-guide` (slice 03, the file
  run);
- designing, compiling, pricing or changing the build: its own run (the final gate's changes in `/pob2:build-guide`, or
  a new `/pob2:compile` better round, slice 05); then the guide is written again;
- the guide template's reader layer as it grew (the H2s, their word budgets, the cap; D-276 to D-487): slice 03 §8, its
  history, and the templates themselves;
- what the gear costs (`/pob2:pricing`, slice 06) and a game question (`/pob2:game-knowledge`, slice 04).

## 2. The contract

C-65 in the spine is the binding summary; this section gives its detail as built.

### 2.1 What it reads

- **The shared rules first:** `skills/build-guide/references/runner-rules.md`, read whole before anything else and
  after a compaction (D-501); "write only inside the run folder" means the writer's own.
- **The source,** a run folder under the guides root, `<slug>/<YYYY-MM-DD>-<n>` or its absolute path, holding a build
  that passed F1: a `/pob2:build-guide` run's build (its card id or name, one of its `builds[]`), a file run's (slug
  `file`, its build `file`), or a `/pob2:compile` run whose better round was accepted (no build: its one build at the
  root). Its log's `source` is `{kind: "run-folder", name: <the folder relative to the guides root>, build?}` (C-61).
  **Finding it** (as built, WL:8093–8094): a request naming no folder lists the runs, newest first, leaving out pricing
  and writer runs, with each one's builds, and asks; a request naming a PoB file ("a guide for MyCharacter123 better") is
  matched first against the compile runs' final files, each F1 verdict's `finalCompile.pobFile`, a match being that
  run's better round; otherwise a PoB file or a character is `/pob2:build-guide`'s guide from a file, and the runner
  says so and stops.
- **From the source** (the minimum a guide needs without a brainstorm, a16 §18): the build's card (`cards/<id>.md`, or
  the file card `cards/file.md` for a file run's or a better round's build), its plan, whose claims the guide renders,
  its last D1-gate verdict and a final compile that passed (F1, or the D2 gate) with its final record; with them its V4
  reports, `trades.json` and `trade-links.json`, and its `run-log.json` for routing. The runner reads none of them whole:
  it routes on the source's log, its gate verdict files, W1's return and the checker.
- **W1** (`skills/build-guide/references/stages/W1.md`, its "A writer run" section) reads every input from the source,
  the build's files in its build folder and the run's at its root, as from its own run.

### 2.2 What it writes

Only its own run folder, `Guides/writer/<date>-<n>/` (C-61; Appendix A.6's writer row): `run-log.json`, `guide.md`,
`audit.md` (the render, then W1's `Known issues` lines) and `notes.txt`. Nothing in the source, and nothing in the
builds folder. **As built** (the coordinator's call, WL:8064–8068, :8073–8074, :8091–8092): the notes stay in
`notes.txt` for the user to paste into PoB's Notes tab; the doer's call that wrote them into the source build's final PoB
file (`compile_plan {plan_path, notes_path}`, safe through `buildFileWriter` but outside the writer's folder, over the
round's final file at WU-168 against choice G's "never over an existing file", and before the checker) was dropped. A
test compares the guides root and a builds folder by sha1.

### 2.3 The rules it follows

- **The steps** (`skills/writer/SKILL.md`): start (`guide_run {new_run: "writer"}` before the source; when the source
  run was online, `pob2-league-digest --running --out <leagueFolder>`, D-523; `pob2-run-log <runFolder> init` with
  `piece: "writer"`, `mode` the source run's, `noNinja` false, `source`); the audit (`pob2-render-audit <runFolder>`,
  which in a writer run reads the source build its log names); `W1` (`pob2:build-guide-writer`); the Known issues and
  the notes (`pob2-render-notes <runFolder>`); the end (`pob2-check-run`, status `completed`).
- **`init` refuses a source** that isn't a build that passed F1 (`writerSourceProblems`,
  `skills/build-guide/scripts/run-log.mjs`; rule `writer-source`): a folder outside the guides root or without a run
  log; a schema-3 run; a pricing or writer run; a compile run named with a build; a build the log doesn't hold; a
  compile run with its measure only (no D1-gate verdict and no final record) or a better round not accepted, the
  refusal naming the better round or a file run; a build missing its card, its D1-gate verdict or a passing final
  compile. **As built, no claims are required at `init`** (a departure from a16 §18's "and the claims"; WL:8057,
  :8072): the plan whose claims the guide renders is required, and the checker holds the guide to them.
- **`init` refuses owned content a guide can't carry** (rule `owned-guide`; `guideCantCarry` and `ownedCorruption`;
  a16 §15, §18), naming each and pointing to a file run, whose ladder replaces it with a trade its design gate shows: a
  gem PoB marks legacy or a unique it says is no longer obtainable (D-395); on an owned item, a "Legacy of …" soul core
  or the Raven-Touched Shard (D-465); corruption on an owned rare, magic or normal item (D-471); an owned unique's
  corruption that the corruption rule doesn't allow (D-484). **As built** (WL:8075–8082, :8089–8091): the gate verifier
  found the first build refused only owned rares with a corrupted line; the fix refuses corruption on any owned
  non-unique item and runs owned uniques through the checker's corruption logic. The coordinator keeps the existing
  rule that an offline, unpriced unique's bare `Corrupted` line passes ("cheapness unchecked", `pricing.md`), as in the
  pipeline (WL:8095–8097).
- **W1's task header** gains `source` (C-36). **As built, a departure from a16 Appendix A.2** (WL:8059, :8072): it is
  `{runFolder: <the source's absolute path>, buildFolder: <its build's folder, or "." for a better round>}`, not the
  folder relative to the guides root and the build id. The header's `concept` is the source's build (`file` for a file
  run or a better round), `accepted` the findings the source's escalations of that build accepted, and the user's words
  about the guide go in `findings` as requests (D-482).
- **The renders** (a16 §18): `pob2-render-audit <runFolder> --source <folder> [--build <id>]` and `pob2-render-notes`
  the same way read the source and write into the writer's folder. As built (WL:8057–8058), a bare `pob2-render-audit
  <runFolder>` or `pob2-render-notes <runFolder>` in a writer run reads the source its log names. A writer's render
  takes `[--build <id>]` naming the source's build, which amends D-516's "a piece run's root build takes no `--build`"
  for the writer only (WL:8055–8057, :8083–8084). A resume renders `audit.md` again, keeping its Known issues rows
  (WL:8095).
- **The checker on a writer run** (C-61's piece tags: `run`'s rules, game knowledge's and the writer's) checks the
  guide and the audit against the source's files (the source checks deferred from WU-159, WL:8044–8045): the source
  itself (`writer-source`, `owned-guide`), the verdict line, the audit's render, the import code, the guide's sections,
  the switched-buff lines; each planted fault against the source fails its own rule alone, and a writer run leaves the
  source's files sha1-identical (AC-W158).
- **A better round's guide** (WL:8058–8059; W1's "A writer run"): the endgame template with that rung's `Endgame` H2
  alone; its configuration is the player's (`config.file`), so "Switching over" names no reward pick, "What PoB can't
  show" says once that the figures use it, and the verdict line's hits are the rung's, from the audit's Stage detail,
  computed on a `config.file` stage by D-254's formula.
- **The guide's rules on owned content** (a16 §15, §16, §18; every run): in a guide, owned content meets every rule
  (D-395, D-465, D-471, D-484), and an owned rare is a spec, never the character's own rolls: its base and its price
  entry's `spec` must-haves (the entry whose `query.slot` is its slot), each at its `min`; with no spec, its base and the
  affixes it needs, with no value; its uniques stay named. The checker's `owned-guide` fails a guide that prints an owned
  rare's rolled line; as built it reads only the lines naming the rare's slot or base, a roll anchored, after a correct
  guide failed on a scratch copy ("5%" inside "25%"; WL:8068–8070, :8094–8095).
- **A buff switched as needed** (D-518; a16 §14, Appendix A.9): for each group of a rung with `switch {when, off}`, one
  line in its skills, under the gems: `- <skill>: switch it on <when>; switch <skills> off for it.`, `<skills>` the
  `off` groups' skills by name, the clause left out when `off` is empty. The templates' "When you're short" line on
  Spirit points to these lines. The checker's writer rule `switched-buffs` fails a guide without one.
- **A granted skill's quality** (D-512; the user's facts, choice E): where a rung's wand, staff or sceptre grants a
  skill the build uses, one line where the gear names it: raise its quality to 20 with Arcanist's Etchers, which gives
  the skill that quality. A quarterstaff gives none, and no other item's base quality does. Item-granted skills do get
  skill level and quality modifiers (PG-115 doesn't hold, the handoff's binding fact), so no line caveats them.
- **An overlay item** (D-523; a16 §19): for each item a stage's record names in `overlay`, the guide says it is
  "measured with <name>'s lines from poe2db, not in PoB's release", and once the limits `audit.md` states under `## What
  PoB doesn't model`.
- **The routing** (choice F): its description quotes players' requests; build-guide's and compile's descriptions each
  carry a sentence routing a finished build or an accepted better round here (WL:8092–8093), and a request naming a
  player's file or character goes to `/pob2:build-guide`.

## 3. Requirements

1. **One file** (D-522; a16 §21): `skills/writer/SKILL.md`; W1's stage reference and the guide templates stay
   build-guide's, read by path.
2. **The command** is `/pob2:writer <run folder> [<build id>]`, or `/pob2:writer --resume <run folder>`; a player's own
   words start it too.
3. **Its `SKILL.md`** has fewer than 150 lines (104 at M-30's last unit), frontmatter `name` and `description` only, at
   most 1,536 characters (1,153), quoting at least two requests in a player's words; its runner reads
   `runner-rules.md` whole first and after a compaction (D-501, D-505).
4. **It writes only its own run folder,** never the source and never the builds folder.
5. **It writes a guide only for a build that passed F1,** refusing every other source, and any source keeping content a
   guide can't carry.
6. **Every guide** holds owned content to every rule, writes owned rares as specs, writes a line per buff switched as
   needed, the granted-quality line where a wand, staff or sceptre grants a used skill, and the overlay's mark.
7. **Its real case gives** §6's expected result.

## 4. Acceptance criteria

- **AC-W157 (switched buffs in the guide; WU-164).** On a fixture build with a switched buff, W1's guide has a16 §14's
  line for it, and the checker's `switched-buffs` fails a guide without it. Unit and static tests:
  `tests/unit/fileRun.test.ts` ("AC-W157 (WU-164, D-518, §14): a guide writes one line per buff switched as needed")
  and `tests/static/fileRun.test.ts` ("AC-W157 (WU-164, D-518, §14): the designers keep a buff switched as needed, and
  the guide writes its line"). **Holds** (WU-164, merged at `7e66ded`).
- **AC-W158 (`/pob2:writer`; WU-165).** `skills/writer/SKILL.md` exists with fewer than 150 lines, frontmatter `name`
  and `description` only, at most 1,536 characters, quoting at least two requests in a player's words; a fixture writer
  run on a fixture file run's folder passes the checker, its guide and audit in its own folder and none in the source;
  `pob2-run-log init` refuses a measure-only compile run as the source, naming the better round; on a better round's
  source the owned rares are specs and a planted legacy gem is refused. Static and unit tests:
  `tests/static/writerPiece.test.ts` ("AC-W158 (WU-165, D-522): skills/writer/SKILL.md"; "… W1's writer section, the
  task header's source and the run log's refusal") and `tests/unit/writerPiece.test.ts` (a writer run on a fixture file
  run's folder; `init`'s refusals; a writer run on a better round's source; a writer run writes only its own folder;
  the renders read a writer run's source), on the fixtures `tests/fixtures/pieces/writer-file-run` (on WU-164's fixture
  file run) and `writer-better-run` (on WU-162's better round). **Holds** (WU-165, merged at `74cf4c2`).
- **AC-W160 (the pieces' real cases; WU-168, after M-30), the writer's part.** The work-log records the writer run of
  §6: the request in a player's words and the command it started, the `pob2:` types started and their tool calls, the
  run folder, what it wrote against §6's expected result, and the source's files unchanged. Recorded. **Open** until
  WU-168.

AC-W145 to AC-W147 (piece runs) are slice 03's and C-61's. WU-164 and WU-165 also hold AC-W162: their changed
assertions are listed in §5.

## 5. Work units

Status lines give the commits on the integration branch `build-guide/m30` (the work-log's M-30 section, WL:7449 on);
the coordinator remaps them to the signed commits at HG-8.

### WU-165: `/pob2:writer`
- kind: build
- status: built (three commits on `8c73c4a`, one a fix round; merged at `74cf4c2`)
- depends-on: [WU-164]
- touches: [`skills/writer/SKILL.md` (new), `skills/build-guide/references/stages/W1.md` (its writer section),
  `task-header.md` (`source`), `run-log.md`, `skills/build-guide/scripts/render-audit.mjs` and `render-notes.mjs`
  (`--source`), `run-log.mjs` (`writerSourceProblems`, `guideCantCarry`), `check-run.mjs` (a writer run against its
  source, `writer-source`, `owned-guide`'s reading), the descriptions of `skills/build-guide/SKILL.md` and
  `skills/compile/SKILL.md` (the routing sentences), the fixtures `tests/fixtures/pieces/writer-file-run` and
  `writer-better-run` (new; WU-159's `writer-run` laid beside its source), `tests/static/writerPiece.test.ts` and
  `tests/unit/writerPiece.test.ts` (new)]
- produces: [C-65; `/pob2:writer`]
- acceptance: [AC-W158]
- milestone: M-30
- summary: The piece (a16 §18). As built (WL:8046–8108): §2's source, refusals, header, renders and checker as built,
  with the coordinator's ruling that the writer writes only its own folder; the log's `mode` the source's; the
  writer matching a named file against compile runs' final files first. **AC-W162's list** (each forced by D-522):
  `pieceRuns.test.ts`'s `piece('writer')` and AC-W145's writer `init` lay `run-a14` beside the fixture as its source;
  `pieceRuns.test.ts`:433, `render-notes <writer> --build r1-a-2` now accepted (the source's build, §18's `[--build
  <id>]`).

### WU-164: a guide from a file (the guide's part)
- kind: build
- status: built (four commits on `ab635bb`, two of them fix rounds; merged at `7e66ded`)
- depends-on: [WU-162, WU-163]
- touches (the guide's part): [`skills/build-guide/references/stages/W1.md` (the switched-buff and quality lines),
  `skills/build-guide/templates/guide-template.md` and `guide-endgame-template.md` (the same lines, the "When you're
  short" pointer), `skills/build-guide/scripts/check-run.mjs` (`switched-buffs`, `owned-guide`)]
- produces: [the guide's lines for D-512 and D-518; `switched-buffs`; `owned-guide`]
- acceptance: [AC-W157; its file-run criteria, AC-W144 and AC-W156, are slice 03's]
- milestone: M-30
- summary: The rest of the unit is the file run (slice 03). As built (WL:7955–7971, :8019–8034): the quality line
  caveats no item-granted skill; W1's wording on quality modifiers matches a16 §8 after the verifier's note.

### WU-168: the pieces' real cases (the writer's part)
- kind: human, then the coordinator
- status: open; after M-30 merges
- depends-on: [M-30's merge; HG-38; HG-39; an accepted better round from slice 05 §6]
- touches: [the work-log]
- acceptance: [AC-W160 (the writer's part)]
- milestone: M-30
- summary: §6's run.

The writer's other text came with other units: WU-159 (piece runs: `init`'s writer fields, the step `W1` in a piece
run, the writer run's layout; slice 03) and WU-166 (the fetch line in its start and W1's overlay mark; slices 01 and
04).

## 6. Real cases

**How it's run:** as slice 05 §6 says (a16 §20; choice G, HG-38, HG-39), after M-30 merges, from a request in a
player's words, every step asked of a `pob2:` type.

1. **The writer on an accepted better round** (a16 §20: "`/pob2:writer` on an accepted better round"). The source is
   one of slice 05 §6's compile runs whose better round the user accepted. A request such as "write a guide for my
   improved character" or "write the guide for the build I just made" starts `/pob2:writer`. Expected:
   - **The source:** a request naming no folder lists the runs, newest first, and asks; one naming the round's final
     file ("<name> better") is matched to that compile run.
   - **`init`:** accepts the run, its better round having passed F1. When the accepted round keeps owned content a guide
     can't carry (a corrupted rare, magic or normal item; a Legacy soul core or the Raven-Touched Shard; a legacy gem;
     an owned unique's corruption the rule doesn't allow), `init` refuses it, naming each item, and points to
     `/pob2:build-guide <the file>`: that refusal is the expected result, not a defect, and the run ends there.
   - **The guide** (when accepted): `audit.md` rendered from the source; W1, a `pob2:build-guide-writer`, writes
     `guide.md` on the endgame template with the round's one rung's `Endgame` H2; each owned rare as a spec, never its
     own rolls; a switched-buff line for each buff the user left switched as needed at the Spirit answer
     (ResurrectForbidden's, when it was the source); the granted-quality line where the round keeps a wand's, staff's
     or sceptre's granted skill (ResurrectForbidden's sceptre and Purity of Ice; CullTheConquerer's staff and Sigil of
     Power, its wand and Mana Drain); `notes.txt` in the writer's folder, nothing in the builds folder; the source's
     files sha1-identical; `pob2-check-run` passes; status `completed`.
