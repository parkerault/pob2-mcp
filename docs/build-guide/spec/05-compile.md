# Slice 05: Compile, `/pob2:compile`, and the file reader

**Status: written current 2026-11-09 (WU-167, D-525), as built at M-30.** Part of the project spine,
[`docs/spec/README.md`](../../spec/README.md) ("spine"), which wins any disagreement; fold fixes back into it. It
covers the compile piece (D-519, D-521; contract C-63) and what it stands on: the file reader `plan_from_build`
(D-517, C-62), the compile on a read plan (D-518 and D-519's part of C-41) and the piece runs as compile uses them
(D-516, C-61, whose detail is slice 03's). Its work units are WU-160, WU-161 and WU-162, built, and WU-168's compile
cases, open; its criteria AC-W148 to AC-W154 and AC-W160's compile part. Its source is amendment 16
(`amendment-16-pieces-and-launch.md`, approved 2026-11-08, cited "a16 §n"), §12 to §15, §17 and §20 with Appendix A.5
to A.9, and the work-log's record of M-30 (`../worklog.md`, "WL:n", WL:7449 on), which wins where the build differs
from the amendment's text: each difference is stated where it applies, and the coordinator's calls are marked so.
Slices 01 and 02 carry notes for the tool and the compile on a read plan that point here; they are folded at amendment
18 (D-506). Paths are root-relative: from the repository root, which is the plugin root (C-57).

## 1. Scope

Compile is the player's own character, read from its Path of Building (PoB) file, measured as it is, and on request
made better (a16 §15, §17; the user's answer 2, "(a) first"). The main case is an imported character (the user,
2026-11-06: "I imagine the most common use case will be users importing their game character to PoB, then pointing the
skill at that file"): its state today, real rolls and all, not a planned endgame.

In scope:
- the piece's `SKILL.md` and its stage reference `references/stages/measure.md`, in `skills/compile/`;
- the file reader, `plan_from_build`, the 86th server tool, and the plan it writes (plan schema 11's read fields and
  `switch`);
- the compile on a read plan: the file's configuration written as set, `measure_as`, the owned exemptions, Spirit buffs
  switched as needed, the record's additions;
- the better round (D-521): the pipeline's four D1 steps in the scope `better`, its design gate and F1, in a compile
  run;
- the requests it answers: "what does my character do", "measure my build MyCharacter123", "make my character better",
  "how can I make this build better" (its description);
- its real cases (§6).

Out of scope, each with its home:
- a guide, from a brief or from the player's file: `/pob2:build-guide` (slice 03; its file run, D-522, runs compile's
  read and measure first); the guide for a better round already accepted: `/pob2:writer` (slice 07);
- what the gear costs, which rung the character sits on, upgrades within a budget: `/pob2:pricing` (slice 06), whose
  placement scope the better round's `place` step runs;
- a game question: `/pob2:game-knowledge` (slice 04);
- a review of a PoB file: no pob2 skill yet (amendment 17, D-506), whose findings will point to the better round;
- the pipeline's design stage references (D1-build, D1-tree, D1-finish, D1-gate, F1) and the guide templates: they stay
  in `skills/build-guide/` (slice 03), and compile reads them by path (a16 §21); each D1 step has a `scope: "better"`
  section for it.

## 2. The contract

C-63 in the spine is the binding summary, with C-62 (the reader) and C-41's M-30 note (the compile on a read plan);
this section gives their detail as built.

### 2.1 What it reads

- **The shared rules first:** `skills/build-guide/references/runner-rules.md`, read whole before anything else and
  after a compaction (D-501). Its "write only inside the run folder" means compile's own, `Guides/compile/<date>-<n>/`
  (C-61).
- **The player's file,** through the reader only: a builds-folder build, matched by name against `list_builds` (a file
  name equal to the name the user gave, case and `.xml` ignored, is the build; otherwise the runner lists the closest
  names and asks, never guessing; a16 §12), or an import code, which goes only to the reader, never into the log or a
  reply.
- **`plan_from_build`** (C-62; `src/handlers/planFromBuildHandlers.ts`, `src/services/fileReader.ts`, and the parser in
  `src/services/readBack.ts`): engine kind `none`, group `core`, no engine lock, nothing fetched. Two calls (a16 §13,
  Appendix A.7):
  - the first takes `run_folder` with exactly one of `build_name` and `import_code` (decoded under D-50's 16 MiB cap)
    and no answer, a call carrying one refused ("the first call takes no answer"); it reads the file's active loadout,
    keeps the decoded document as `source.xml` in the run folder and writes `plan.json` (schema 11, one read stage) and
    `read.json`;
  - the second takes `run_folder` and the answers only (`loadout`, `tree`, `main_group`, `buffs_on`, `buffs_swap`,
    `switch_off`, `stand_in`; group numbers are the plan's; `src/handlers/planFromBuildHandlers.ts`'s `ANSWERS`),
    reads `source.xml` again, refuses a builds-folder file whose sha1 changed, and writes both files again. A changed
    `loadout` renumbers the groups, so it clears the answers that name them.

  It reads the file as written, never through a load: every item, one on a base the pin lacks included (PG-110);
  every gem of a granted group, which a load drops (D-398); each roll from the item's text, never PoB's misnumbered
  `<ModRange>` copy (PG-109), except that an item with no `{range:` tag reads its `<ModRange>`, numbered by PoB's load
  rule (`Classes/ItemsTab.lua`:1108–1125; WL:7514, :7544). Base names match as PoB matches them (`Classes/Item.lua`:
  781–818); node names come from the tree service.
- **The read plan** (Appendix A.5): one stage `f`, `progress: "endgame"`, no variant, at the file's level, its
  `loadoutName` "<the loadout's title> (L<level>) {f}", its `source` `{kind, name, sha1, loadout}`; items, groups and
  tree jewels marked `owned: true` (a stand-in also `standIn: true`); `config.file`, the loadout's config set by input
  name and value, custom modifiers among them; `config.earned` empty and `config.scenario` only `enemyIsBoss`, at the
  file's value; `league` null; `roll` from the file.
- **`read.json`** (Appendix A.7, with the as-built extras): the source and its sha1, `treeVersion`, the file's loadouts
  and the one read, the group map (plan to file), `left`, `dropped`, `levels`, `questions`, `notRead`, `importLeague`
  when `<Import lastLeague>` has one, `answers`; as built also `grantedQuality` (a file's quality on a kept granted
  copy), `legacy`, `doubleDefined` (PG-111's bases), `corruptLevels`, `unconfirmed` (the main skill until it is
  answered) and `partyFilled`, counted from `<ImportedBuffs>` only, since PoB's load ignores `<ExportedBuffs>`
  (WL:7510–7514, :7548–7549, :7590).
- **The measure** reads `read.json` whole, the read stage through `guide_run {view}`, the toughness targets and the boss
  floor, and the record by Grep, never whole (`skills/compile/references/stages/measure.md`, "Inputs").
- **The better round** reads the pipeline's D1 stage references by path, each with its `better` section,
  `skills/pricing/references/stages/price.md` for its `place` step (the placement scope, slice 06), and the file card.

### 2.2 What it writes

Everything goes in its run folder, at the folder's root (C-61; Appendix A.6's compile row): `run-log.json`;
`source.xml`, `plan.json` and `read.json` (the reader); `measure.md`, `compile-record.json` and `compiled-build.xml`
(the measure and its compile); `cards/file.md` when a design round follows; with the better round, `trades.json`,
`trade-links.json`, `pieces.md`, `reports/gates/`, `interviews/`, and F1's root copies `final-build.xml` and
`readback.json`. The last two are a departure from Appendix A.6, which omits them (the coordinator's call,
WL:7518–7520, :7570–7573).

In the builds folder it writes only the better round's draft (the D1 gate's, by `draft_name`: the source's name and
` better`, written as `<name> (draft)`, `draftCandidates` in `src/plan/compiler.ts`) and F1's final file (`first_free`,
under its own name, the run's date added when the name is taken), both through `buildFileWriter` (C-17), never under
the user's file's name. An accepted escalation's draft is written by the runner's `compile_plan {plan_path,
draft_name}` and logged as the escalation's `draftFile`, a departure from Appendix A.6 (the coordinator's call,
WL:7848–7853, :7892–7893). It never writes the user's file: the reader keeps its own copy.

### 2.3 The rules it follows

- **The steps** (`skills/compile/SKILL.md`): start (`guide_run {new_run: "compile"}`; online, `pob2-league-digest
  --running --out <leagueFolder>`, D-523; then `pob2-run-log <runFolder> init` with `piece: "compile"` and `source`);
  `read` (the reader's two calls, its questions asked as an interview, one at a time: the main skill, a stand-in for an
  unknown base, the loadout, an older tree); `measure` (a fresh `pob2:build-guide-coordinator`); the display; the
  better round on request; the end (`pob2-check-run`, status `completed`). Every agent step is the coordinator's, one
  at a time.
- **The tree version** (a16 §13): a `treeVersion` the pin lacks is refused, naming it; an older one the pin holds is a
  question. As built, no `plan.json` is written until the answer is `tree: "newest"`, and `stop` removes one written
  earlier (WL:7510–7511).
- **One loadout, one stage:** the file's active loadout on the first call, or the one the second call's `loadout`
  names, a title from `read.json`'s loadouts; a title that doesn't pair is refused, with the file's loadouts listed.
- **PoB's gaps in a player's file** (a16 §13):
  - PG-108, the copies: PoB's own granted groups aren't written; per granted skill the copy with the most enabled
    supports is kept, a copy with no support dropped when its level equals PoB's group's and kept, both levels named,
    when it differs; the kept copy goes on its granting item's weapon set;
  - PG-110, an unknown base: the item and a gem the pin lacks are left out and asked about (`stand_in`). As built, a
    gem's question is informational (field `gem`), and a tree jewel on an unknown base is asked as `stand_in.Jewel
    <node>` (WL:7509–7510, :7549–7551, :7590–7591);
  - PG-111: the 19 double-defined bases keep their `Implicits:` line;
  - PG-113, the main skill: asked, the file's `mainSocketGroup` marked as PoB's choice, possibly its guess;
  - PG-114, granted quality: the kept copy is written at quality 0, and a file's other value is named.
- **The Spirit question** (PG-107; a16 §14, §15). Only when unreserved Spirit is below 0 on the measured set, the
  measure lists each buff with its reservation and a proposed `off` list; the runner asks, and the second call takes
  `buffs_on` (kept on), `buffs_swap` (moved to the other weapon set) and `switch_off` (`{<switched group>: [<its off
  groups>]}`). The buffs in neither list become switched as needed, `when: "as needed"`, `off` the user's list, `[]`
  without one.
  - `switch_off` is a departure from Appendix A.7, which has no field to carry the `off` list a16 §14 asks for (the
    coordinator's call, WL:7551–7557).
  - It is refused for a group not switched, a group naming itself, an `off` number the plan lacks, a non-numeric key, a
    duplicate, or no Spirit answer yet. Buff lists given again without it, or a loadout change, clear it
    (WL:7592–7594, :7669).
  - The reader finds the Spirit buffs without the engine (WL:7511).
- **The compile on a read plan** (C-41's M-30 note; WU-161):
  - `config.file` is written as set, the plan's custom lines after the file's, and no reference hit is filled on the
    stage;
  - `measure_as: "non-budget"` is taken only with `measure_only`, and only on a read stage while it is unplaced (a placed
    stage is measured as its own rung; WL:7680–7687, :7913–7915). It runs the passes an `n` stage gets (the Pinnacle
    boss pass with the Arbiter read, the resisting and conditioned reads, a toughness read at `n`'s reference hits),
    each putting the file's configuration back after;
  - owned items skip PoB's `NormaliseQuality` (`keepQuality` on `add_item_text`, `pob-api/API/BuildOps.lua`:1655, the
    handoff's binding fact), so an owned item keeps the quality its text gives: CullTheConquerer's wand measures at
    quality 1, not 20;
  - a granted skill's quality comes from its wand, staff or sceptre (D-512).
- **The owned exemptions** (a16 §15; the user's "I want to make sure our skill's tests won't reject a build that works
  in-game"). While a character is measured and priced (compile, pricing, and compile's better round), an owned item,
  group or tree jewel is exempt from:
  - V1's `sockets`, `affix-cap`, `corruption` and `movement-tier`;
  - `compile_check`'s refusal of legacy and unobtainable content (D-384);
  - D-465's rule on Legacy soul cores and the Raven-Touched Shard;
  - the checker's `rare-title`, its item `corruption`, both parts of `flasks`, and pricing's `spec` and `listing`.

  Only the reader marks content owned; a design that replaces an item drops the mark, and the replacement meets every
  rule. As built, a stand-in is owned too, so the exemptions also cover text the user types (WL:7567–7568); the
  checker counts a read stage's empty Flask 1 as owned; a run of another piece, or a pipeline run, owns nothing
  (WL:7686–7687, :7760). In a guide (a file run's placed rung, or the writer) owned content meets every rule (slices
  03 and 07).
- **The callouts** (the user's answer 4, "Keep as set, but call out anything that seems wrong to the user"): every
  configuration input that seems wrong, each with why, none changed. (a) A state nothing in the build produces; (b) a
  custom modifier line no item or node explains; (c) an enemy setting other than PoB's default that seems wrong; (d) a
  filled party tab; (e) a condition or charge count held up that the build's producers can't keep up; (f) a granted
  skill's gem quality the game can't give; (g) anything else that seems wrong.
  - **Callout (a), as built** (the coordinator's call, WL:7712–7713, :7762–7767, :7785–7788): V2 has no table from an
    input to its producer, so a read stage's checks take PoB's own invalid-option judgement ("conditional with missing
    source", `Classes/ConfigTab.lua`:578–631), read through `debug.getupvalue` (`pob-api/API/Compile.lua`,
    `invalid_options`), as V2's `unproduced-state` callouts. It is partial: inputs PoB doesn't gate, such as charges
    or "enemy Chilled", get none, and `measure.md` has the measure judge those itself by what the build produces. It
    is pin-sensitive and fails closed: if a release renames the upvalue, its engine test fails at the pin
    (`CLAUDE.md`'s pin-upgrade step 8).
  - V2's findings on `config.file` are `from-file` callouts, never a failed verdict: the checker's `record-verdicts`
    leaves them out (WL:7757), and D1-gate and F1 fail nothing on them (WL:7885).
  - A callout the user wants fixed is changed by the user in PoB and the file read again: the better round keeps the
    configuration as set (a16 §17), and the runner never edits the plan (the coordinator's call, WL:7848–7851).
- **The summary against `n`'s targets,** the only rung that has them: the toughness band (`ehp` against the target for
  the engagement) with the lowest max hit and its type, the boss floor, the one-shot floor (80% of the Arbiter's hits
  survived) and clear speed, each with its distance, as where the character is headed, never as failures. Below the
  endgame (under level 65, or the owner's word; choice A) it says so first. As built, the D1 gate's toughness band reads
  `measures.ehp` on a stage naming `source`, the read stage's toughness at its rung's hits (WL:7708–7709, :7758).
- **Switched buffs** (D-518): a group with `switch: {when, off}` is written disabled and marked (`Patches.SWITCHED`) so
  the recount counts its slot (D-510); each switch is measured once more with it on and its `off` groups off, and
  restored after; V1's `switched-spirit` names a switch that leaves unreserved Spirit below 0. As built, a switch is
  measured on its group's own weapon set, else the stage's (a16 §14's proceed-on; WL:7684–7685, :7761).
- **The record's additions** (Appendix A.8): per stage `owned`, `switches` and `overlay`. Beyond A.8, ruled inside
  HG-12's grant by the coordinator, and shown only on read plans (WL:7680–7684): `measuredAs`; `spirit` per buff (the
  Spirit question's reservations); `switches[].weaponSet`; V2's `file` class and `from-file` kind; the reply's tag "(from
  the file)". A plan without a read stage compiles to its old record (AC-W152).
- **The file card,** `cards/file.md`, when a design round follows: the card format's brainstorm half, from the read
  plan, the record, the report and the user's words, with no verification half, named after the source and the main
  skill. In a file run the measure also writes `dossier.md`'s one row (slice 03; the coordinator's call, WL:7999–8000).
- **The better round** (D-521; a16 §17):
  - **Before it:** the budget, asked in the user's words; `place`, pricing's placement scope (`stage: "place"`, `writes:
    ["plan.json"]`), or without trade the user names the rung, never assumed. Below the endgame there is no rung, and
    the round aims at `m`'s targets.
  - **D1-build, D1-tree, D1-finish and the D1 gate** with `scope: "better"`, routed as `/pob2:build-guide` routes them,
    but with no `build` entry, no skeleton and no verification gate: an `infeasible` round ends the run `stopped`.
  - **What it may change:** the passive tree's points, supports and gem levels, any slot's gear within the budget, the
    anoint, a buff switched as needed. **What it keeps:** the class, the ascendancy and its nodes, the main skill and
    its weapon type, the level, the configuration as set, each owned item unless replacing it gains within the budget.
  - **As built** (WL:7798–7803, :7848–7853, :7885–7898): a target the budget can't reach is the survival floor only, a
    finding with its `cost`, which routes to the design gate and is listed there under "Not reached within your
    budget"; a stage below the endgame takes `m`; a rung the user names is written by D1-build with `ascendancyPoints`
    and `variantBasis`; the floor on a `config.file` stage uses D-254's formula, since no reference hit is written, and
    its reward picks are the player's own. The design gate has no question step `Q`: the runner answers from the
    display, the verdict, `trades.json` and its lookups. An escalation takes accept, retry or stop; stop ends a compile
    run `stopped`, with no scaling question and no `verification` choice (the coordinator's calls). A resume runs the
    stopped step again; a piece run cut before its first D1 gate is held to its log's revision (`pieceHeld`).
- **The design gate** (D-367's display, the interview): `pob2-run-log <runFolder> display design` names the draft
  first, then the pitch, the headline changes, each with what it gains and costs; accept runs F1, revise runs D1 again,
  stop ends the run. F1 writes the final file by `first_free` under its own name, never the source's. The checker's flow
  rule (`checkFlow4`) holds a compile run with a better round to the D1 loop's order, D1-build to F1.
- **Pricing:** only in `place` and the round's D1-finish and D1 gate, announced first, as the shared rules say. A pricing
  stop ends the run `stopped`, and `/pob2:compile --resume <run folder>` after the lockout is the retry (C-61). The
  checker holds a compile run that logged `place` or a D1 step to pricing's rules too (WL:7570–7571).
- **The routing** (choice F): its description quotes players' requests and names `/pob2:build-guide` for a guide,
  `/pob2:pricing` for prices and the rung, `/pob2:game-knowledge` for a game question and `/pob2:writer` for the guide of
  an accepted round (WL:8092–8093). As built, "what's wrong with my build" isn't quoted, since a16 §15 and §17 don't
  count it as compile's (WL:7895–7896).

## 3. Requirements

1. **One folder** (D-519; a16 §21): `skills/compile/` holds `SKILL.md` and `references/stages/measure.md`; the design
   stage references stay build-guide's, read by path.
2. **The command** is `/pob2:compile <build name or import code> [--offline] [--no-ninja]`, or `/pob2:compile
   --resume <run folder>`; a player's own words start it too.
3. **Its `SKILL.md`** has fewer than 150 lines (134 at M-30's last unit), frontmatter `name` and `description` only, at
   most 1,536 characters, quoting at least two requests in a player's words and naming the other pob2 commands for the
   rest; its runner reads `runner-rules.md` whole first and after a compaction (D-501, D-505).
4. **It never writes the user's file,** and writes only its run folder and, through `buildFileWriter`, the better
   round's draft and final file under their own names.
5. **The file reader** (C-62) is the one new server tool: 86 tools, 85 with poe.ninja off, 79 with trade and poe.ninja
   off; its description under 2,048 characters (1,619 as built, WL:7595); its refusals are `isError`s that write
   nothing; the runner calls it, never an agent, so no agent's tool set changes (R-4).
6. **The read plan** passes plan schema 11 and keeps the character as it is: owned items with their own rolls and
   quality, the configuration as set.
7. **The measure** writes `measure.md` (the headline, the targets, the callouts, the inputs judged fine, the Spirit
   question, the read's notes), and the file card when a round follows.
8. **Owned content passes** the rules that would reject what the game allows, while a character is measured and
   priced, and only then.
9. **The better round** runs only on request, keeps what a16 §17 keeps, shows a missed target with its cost, and writes
   no file over another.
10. **Its real cases give** §6's expected results.

## 4. Acceptance criteria

- **AC-W148 (the reader's contract; WU-160).** The server lists 86 tools (85 with poe.ninja off, 79 with trade and
  poe.ninja off), `plan_from_build` among them with engine kind `none`, group `core` and a description under 2,048
  characters; the README table is regenerated; the tool-hygiene allowlist stays empty; each refusal of a16 §13 is an
  `isError` that writes nothing, a missing tree version among them; a copy of the importer fixture on the `0_4` tree
  asks the tree question; the first call keeps `source.xml` and its sha1; neither the builds folder nor the source
  changes. MCP and unit tests: `tests/mcp/planFromBuild.test.ts` ("AC-W148 (WU-160, D-517): plan_from_build is listed
  as the 86th tool"; "… refuses, writing nothing; the first call keeps source.xml"). **Holds** (WU-160, merged at
  `3f889b0`).
- **AC-W149 (the reader on the fixtures; WU-160).** By name and by code the importer fixture gives the same plan but
  `source`, each rule of a16 §13 met on its case; the plan passes schema 11; the poe.ninja fixture gives its main group
  as set, no `importLeague`, set 2 and its untitled spec; neither fixture holds a character hash or account name. Unit
  test: `tests/unit/planFromBuildReader.test.ts` (the committed fixtures; the importer fixture; the poe.ninja fixture;
  `<ModRange>` numbered as PoB's load numbers it), on `tests/fixtures/builds/imported-character.xml` (and its code)
  and `imported-ninja.xml`, built by hand from the game data. **Holds** (WU-160).
- **AC-W150 (the reader's real cases; WU-160).** The probe of a16 §20 reads each real case, with choice D's library file
  too, and gives §20's expected read results; nothing is written outside its temporary folders; each file's sha1 is
  unchanged. Recorded: WL:7493–7503, and again at the fix round's head, WL:7596–7598. **Holds.**
- **AC-W151 (the compile on a read plan; WU-161).** The importer fixture's read plan compiles measure-only with
  `measure_as`: no V1, V2 or checker failure for owned content, every exemption of a16 §15 exercised; its `config.file`
  inputs written as read, no reference hit filled, V2's findings `from-file`; the boss, resisting, Arbiter and
  toughness reads in the record, no variant given; the same item in a design's slot without the mark fails as today.
  Engine and unit tests: `tests/integration/compileReadPlan.test.ts` ("AC-W151, AC-W152 (WU-161): compile_plan on a read
  plan", its AC-W151 blocks, callout (a)'s among them) and `tests/unit/readPlanCompile.test.ts` (its AC-W151 blocks, the
  checker's rules on owned content). The probe's compile half is recorded at WL:7670–7679. **Holds** (WU-161, merged at
  `594191f`).
- **AC-W152 (switched buffs; WU-161).** A stage with one switched group measures with it off and marks it for the
  recount; the record's `switches` holds its set with its `off` groups off, measured on set 2 on a stage using set 2; V1
  reports `switched-spirit` for a switch that leaves Spirit below 0 and nothing for one that fits; a stage without
  `switch` compiles to its old record. Engine and unit tests: the same two files' AC-W152 blocks. **Holds** (WU-161).
- **AC-W153 (`/pob2:compile`; WU-162).** `skills/compile/SKILL.md` exists with fewer than 150 lines, frontmatter `name`
  and `description` only, at most 1,536 characters, naming when to use it with at least two requests in a player's
  words in quotes, and `/pob2:build-guide`, `/pob2:pricing` and `/pob2:game-knowledge` for the rest; it reads
  `runner-rules.md` first; `measure.md` holds a16 §15's parts; the coordinator's step table names `measure`; game
  knowledge's description names the three new commands; every root-folder path resolves. Static test:
  `tests/static/compileSkill.test.ts` ("AC-W153 (WU-162, D-519): skills/compile/SKILL.md"; "… the measure step's
  reference holds §15's parts"). **Holds** (WU-162, merged at `fda5b5d`; 134 lines after WU-163's and WU-166's lines).
- **AC-W154 (the better round; WU-162).** D1-build, D1-tree, D1-finish and D1-gate each hold a `scope: "better"`
  section; a fixture compile run with a better round (offline) passes the checker, its D1 loop in order; the checker
  fails a planted round whose missed target isn't shown as a finding; its design display names the draft first; no file
  name equals the source's; on the importer fixture at level 50 (choice A) the round's targets are `m`'s. Static and
  unit tests: `tests/static/compileSkill.test.ts` ("AC-W154 (WU-162, D-521): the better scope in the four D1 stage
  references") and `tests/unit/compileBetterRound.test.ts` (its five AC-W154 blocks), on the fixture
  `tests/fixtures/pieces/compile-better-run`, rebuilt on the real path at the fix round (`plan_from_build` on the
  importer fixture, the engine's measure and F1; WL:7885–7888, checked real at WL:7902–7906). **Holds** (WU-162).
- **AC-W160 (the pieces' real cases; WU-168, after M-30), compile's part.** The work-log records, for each compile run
  of §6: the request in a player's words and the command it started, the `pob2:` types started and their tool calls,
  the run folder, what it measured against §6's expected results, and the source's sha1 in `read.json` equal to its
  copy's. Recorded. **Open** until WU-168.

AC-W145 to AC-W147 (piece runs) are slice 03's and C-61's; their tests include a fixture compile run that passes the
checker and fails on a planted fault of its piece's rule only (`tests/unit/pieceRuns.test.ts`, "AC-W147 (WU-159,
D-516): the checker by piece"). Every M-30 build unit also holds AC-W162: every pipeline fixture gives the checker's
result it gave at `cf16e07`, and each changed test assertion is listed with the decision that forces it (this
piece's units' lists: WL:7504–7508, :7679–7680, :7795–7798, :7894–7895; §5).

## 5. Work units

Status lines give the commits on the integration branch `build-guide/m30` (the work-log's M-30 section, WL:7449 on);
the coordinator remaps them to the signed commits at HG-8. The units' order is the spine's M-30 line (§9.3).

### WU-160: `plan_from_build`, the file reader
- kind: build
- status: built (two commits on `7150437`, one a fix round; merged at `3f889b0`)
- depends-on: [M-29]
- touches: [`src/services/fileReader.ts` (new), `src/services/readBack.ts` (the parser's fields),
  `src/handlers/planFromBuildHandlers.ts` (new), `src/handlers/planHandlers.ts`, `src/server/toolSchemas.ts`,
  `toolMeta.ts`, `toolRouter.ts`, `src/plan/schema.ts` (schema 11's read fields and `switch`),
  `docs/build-guide/plan-reference.md`, `README.md` (the table and the counts),
  `docs/build-guide/run-settings.example.json`, `scripts/fresh-clone-check.mjs` (86 tools),
  `tests/fixtures/builds/imported-character.xml`, its code and `imported-ninja.xml` (new), the fixtures' README,
  `tests/fixtures/tool-calls.json` and `tool-disposition.json`, the count tests, `tests/helpers/planFromBuild.ts`,
  `tests/mcp/planFromBuild.test.ts` and `tests/unit/planFromBuildReader.test.ts` (new)]
- produces: [C-62; plan schema 11's read fields]
- acceptance: [AC-W148, AC-W149, AC-W150]
- milestone: M-30
- summary: The reader (a16 §13). As built (WL:7489–7516, :7541–7569, :7588–7607): the first call also refuses a plan
  a design step wrote, and a folder already holding a read (a second file into a read run folder would have replaced
  its `source.xml` silently); `switch_off` (the coordinator's call, §2.3); a gem the pin lacks asked informationally; a
  stand-in owned too; no `plan.json` on an older tree until `tree: "newest"`; Spirit buffs found without the engine; an
  unsupported copy of unknown level kept with `granted: null`; flask and charm toggles from the item set's `active`
  flags; `read.json`'s extra fields; `resolveRunFolder` takes the argument's name, `guide_run`'s replies unchanged byte
  for byte. **AC-W162's list** (each forced by D-517's 86th tool): `gemCorruption.test.ts` AC-E65 (85 → 86, 84 → 85),
  `findUpgrades.test.ts` AC-T45, `tradeQueryOptions.test.ts` AC-T41, `readme.test.ts` AC-G1,
  `toolDisposition.test.ts`'s `BUILD_GUIDE_NEW` and `runSettingsExample.test.ts`'s allow set.

### WU-161: the compile on a read plan
- kind: build
- status: built (two commits on `5abe462`, one a fix round; merged at `594191f`)
- depends-on: [WU-160; merged after WU-159]
- touches: [`src/plan/compiler.ts`, `src/plan/record.ts`, `src/plan/checks/v1.ts`, `src/plan/checks/v2.ts`,
  `src/engine/schemas.ts`, `src/handlers/planHandlers.ts`, `docs/build-guide/plan-reference.md`,
  `pob-api/API/Compile.lua` (`config.file`, `measure_as`'s passes, `invalid_options`, the
  switched mark and `measure_switches`), `pob-api/API/BuildOps.lua` (`keepQuality`),
  `skills/build-guide/scripts/check-run.mjs` (the owned exemptions, `record-verdicts`, the band's `measures.ehp`),
  `tests/integration/compileReadPlan.test.ts` and `tests/unit/readPlanCompile.test.ts` (new)]
- produces: [C-41's M-30 part, D-518's measure, `switched-spirit`]
- acceptance: [AC-W151, AC-W152]
- milestone: M-30
- summary: `config.file` and its callouts, `measure_as`, the owned exemptions, the switched buffs (a16 §14, §15). As
  built (WL:7665–7687, :7700–7713, :7733–7745, :7755–7778): the record's extras ruled inside the grant; `measure_as`
  only `"non-budget"`, only with `measure_only` and a read stage; the file's configuration written raw; a switch
  measured on its group's own set; a read stage with a rung reads toughness at the rung's hits; `keepQuality` gives an
  item with no quality line 0, as PoB's parser does (`Classes/Item.lua`:1350–1351); `record-verdicts` leaves `from-file`
  findings out; callout (a) as `unproduced-state` from PoB's own judgement (§2.3); the D1 gate's band from
  `measures.ehp` on a stage naming `source`; the unobtainable unique's exemption tested on Thunderstep and on a unique
  jewel carrying its own "No longer obtainable" line. All 22 committed fixture plans compiled at base and head with
  equal records but for the times, sha1s and codes, but for one figure the gate verifier traced to PoB, not the unit
  (PG-116, `docs/build-guide/pob-gaps.md`). **AC-W162's list:** `compilePlan.test.ts` AC-P38, `compile_plan`'s
  properties gaining `measure_as` (D-519).

### WU-162: `/pob2:compile`
- kind: build
- status: built (four commits on `99c8905`, one a fix round; merged at `fda5b5d`)
- depends-on: [WU-159, WU-161]
- touches: [`skills/compile/` (new: `SKILL.md`, `references/stages/measure.md`), `agents/build-guide-coordinator.md`
  (the `measure` row), `skills/build-guide/references/stages/D1-build.md`, `D1-tree.md`, `D1-finish.md`, `D1-gate.md`,
  `F1.md` (their `better` sections), `skills/build-guide/scripts/run-log.mjs` and `check-run.mjs` (the better round's
  display, `checkFlow4`'s D1-loop order, the `better` rule, `pieceHeld`), `skills/game-knowledge/SKILL.md` (its
  description), `scripts/words-loaded.baseline.json` (the `measure` entry), `docs/build-guide/run-settings.example.json`
  (`list_builds`), the fixtures `tests/fixtures/pieces/compile-run` and `compile-better-run`,
  `tests/static/compileSkill.test.ts` and `tests/unit/compileBetterRound.test.ts` (new)]
- produces: [C-63; `/pob2:compile`]
- acceptance: [AC-W153, AC-W154]
- milestone: M-30
- summary: The piece and its better round (a16 §15, §17). As built (WL:7789–7804, :7823–7854, :7885–7912): see §2.3's
  "The better round"; `measure.md` has the measure judge the inputs PoB doesn't gate (the coordinator's call); a
  measure with `compile: "none"` writes only the file card; the source-name check ignores `first_free`'s date and the
  draft suffix; the better-round fixture rebuilt on the real path, which exposed the two `config.file` checker gaps it
  fixed (the floor's hits, the reward picks). Its words-loaded entry, `since.measure`, names a lane commit, remapped at
  signing. **AC-W162's list:** `pieceRuns.test.ts`'s `interview` tag `['compile', 'research']` and `better: ['compile']`
  (D-521); `amendment15GameKnowledge.test.ts`'s AC-W124 description test (the three commands, D-519, C-58 amended);
  `buildGuideD1Tree.test.ts`'s H2 list (D-521); `runSettingsExample.test.ts`'s allow list (`list_builds`, D-519).

### WU-168: the pieces' real cases (compile's part)
- kind: human, then the coordinator
- status: open; after M-30 merges
- depends-on: [M-30's merge; the user's `--plugin-dir` session, HG-38; the characters named, HG-39]
- touches: [the work-log]
- acceptance: [AC-W160 (compile's part); AC-W140 if WU-157 hasn't run]
- milestone: M-30
- summary: §6's runs, each from a request in a player's words, every step asked of a `pob2:` type.

Compile's other text came with other units: WU-159 (piece runs: `init`'s compile fields, the steps `read`, `measure`
and `place`, the id `file`, the scope `better`, the compile run's layout; slice 03), WU-163 (its `price` row and the
placement line in `SKILL.md`'s step 5; slice 06), WU-164 (`measure.md`'s dossier row for a file run; slice 03), WU-165
(the description's routing sentence to `/pob2:writer`; slice 07) and WU-166 (the fetch line in its start; slices 01
and 04).

## 6. Real cases

**How they're run** (a16 §20, D-524; choice G, HG-38, HG-39): after M-30 merges, in a session the user starts with
`claude --plugin-dir` on the main checkout (or after `/reload-plugins`), with the server rebuilt and reconnected
(`/mcp`). The coordinator starts each run from a request in a player's words, never the command (choice F): a request
that starts another command, or none, is a description to fix before the run goes on. Every step is asked of a `pob2:`
agent type. The characters are read from the builds folder by the names the user gives at HG-39, each checked
unchanged against its copy in `~/pob2-real-cases/` by sha1 (`read.json`'s sha1 equal to the copy's). Choice G's grant,
for these runs only (HG-6): their own folders in the guides folder, and the better round's draft and final PoB files
in the builds folder under their own names, never over an existing file. No character hash or account name is recorded
anywhere. A wrong result is fixed in the piece's files and the case run again; the work-log is the record (AC-W160).

**The expected results** below are the build's probe's (AC-W150, AC-W151): the probe read each file as an import code
in memory from a temporary folder, its server started as `spawnServer` starts one, and compiled it measure-only with
the main skill answered as below (WL:7493–7503, :7670–7679). The figures are the read plan's before the Spirit answer,
every buff on as the file has them; the engagement the measure sets changes only which toughness target they're held
against.

1. **ResurrectForbidden** (`ResurrectForbidden.xml`; an unmodified poe.ninja export, a level 100 Forbidden Rites
   character). A request such as "measure my build ResurrectForbidden" starts `/pob2:compile`.
   - **The read:** Spear Throw's copy with Frost Nexus kept, on both weapon sets; Virtuous Barrier's level 20 copy kept
     beside the tree's level 1 group; Righteous Descent's copy dropped (level 19, as PoB's); Purity of Ice's supported
     copy kept on set 2, at quality 0 in the plan; `useSecondWeaponSet` true; no `importLeague`; the main skill asked,
     the file's group 14 (Twister) as plan group 11.
   - **The measure** (main group 11): no skill-slot warning after the recount, only the Spirit one; Purity of Ice
     measured at its sceptre's quality 10; the Spirit question, 254 reserved against 215 Spirit (39 over), the six buffs
     Trinity 100, Charge Regulation 40, Herald of Ice 30, Wind Dancer 30, Combat Frenzy 30 and Ghost Dance 24; Twister
     306,058 on maps, 288,051 on resisting rares and 306,058 on the boss; the Arbiter survived; EHP 48,855 at `n`'s
     reference hits (the file's own configuration gave 68,502); the lowest max hit 5,200 chaos. Level 100: in the
     endgame. The Spirit answer reads and measures it again, with the buffs the user doesn't keep on switched as needed.
   - **The better round, offline:** the user names the rung, never assumed; the round designs at the floor tiers, its
     prices `unavailable`, said once; the design gate's display names the draft, "ResurrectForbidden better (draft)",
     first; on accept F1 writes the final file, "ResurrectForbidden better" by `first_free` (the run's date added when
     that name is taken), never over the user's file; `pob2-check-run` passes.
2. **CullTheConquerer** (`CullTheConquerer-oauth-import.xml`; imported with PoB2's own OAuth importer, unchanged, a
   level 70 Lich). A request such as "what does my character CullTheConquerer do" starts `/pob2:compile`.
   - **The read:** Mana Drain's copy dropped (level 18, as PoB's from the wand); Sigil of Power's supported copy kept on
     set 2, its staff in `Weapon 1 Swap`; `useSecondWeaponSet` false; `importLeague` Forbidden Rites; the main skill
     asked, the file's group 3 (Essence Drain) as plan group 2, marked as PoB's guess; the Blasphemy group's two skills
     listed.
   - **The measure** (main group 2): Mana Drain measured at its wand's quality 1 (`NormaliseQuality` would have made it
     20); Sigil of Power at its staff's quality 18; V1 passes, so no Spirit question; Essence Drain 3,469 on maps, on
     resisting rares and on the boss; the Arbiter survived; EHP 15,221 at `n`'s reference hits (the file's own
     19,291); the lowest max hit 10,497 physical. Level 70, past the campaign's last area level (64): in the endgame.
   - **The better round, offline:** as case 1, the draft "CullTheConquerer better (draft)", the final file
     "CullTheConquerer better".
3. **The library file** (choice D; `~/projects/poe2-guide-library/guides/twister-spirit-walker-snoobae/pob/build.xml`,
   read in place): the reader's case, read in the file run of slice 03. It isn't in the builds folder, and
   `plan_from_build` takes a builds-folder name or an import code, so its run starts from an import code of the file.
   The first call reads its active loadout, "Mid Endgame", one of 10, and the reply asks the loadout question, which the
   second call answers with `loadout`.

**No campaign character** is among the real cases: the user has none (choice A; WL:6989–6991). The campaign path
rests on the fixtures: the importer fixture read again at level 50 aims the better round at `m`'s targets (AC-W154) and
is placed "in the campaign" (AC-W155).
