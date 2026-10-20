# Build handoff: amendments 2 and 3 (M-14)

Written 2026-10-10 by the coordinator session for the build fleet. Every build agent reads this file
first. If anything here conflicts with the spec, the spec wins, and you report the conflict. It replaces
`build-handoff.md` (the M-10…M-12 build) for this run; that file's history stays as written.

## M-21: amendment 9, endgame builds first and trees that minimize travel (read this first)

Added 2026-10-19. For this build, this section overrides the M-20 and older sections and "What to build" below;
"Worktrees and branches" onward still applies, with the integration worktree named here. M-20's rules on running
tests, fixtures and "done" (its last bullets) apply unchanged.

- **Spec.** `docs/build-guide/spec/amendment-9-endgame-first.md` is binding: D-411…D-424, WU-92…WU-98 (§18) and
  their ACs (§19). M-22 (§17: D-425…D-428, WU-100…WU-103) is not part of this build; WU-99 is the user's live test
  after the wave gate. The spine and slices are v1.6, with amendment 8 built; where amendment 9 and they disagree
  inside D-411…D-424's scope, amendment 9 wins; anywhere else report a conflict. Read §3, §4, the decisions your
  unit touches, its row in §18 and its AC in §19.
- **Approved** by the user on 2026-10-19 ("Draft looks good, go ahead"), after an independent review and its
  re-check (§22).
- **HG-12 is granted for the amendment's tool changes only:** the new tool `get_node_power` (C-55, group `core`,
  engine `read`, its 120 s long action); `get_passive_upgrades`'s candidate source (its arguments and output
  unchanged); `guide_run {resume}` (no engine call); the compile record's `requirements` and skeleton stages
  measured against the rungs' reference hits; plan schema 6 (`tree.needs`, only `claim` out of `buildSha1`); the
  listed tool count 84 to 85. Any other tool-contract change is still HG-12: stop and report.
- **Integration worktree:** `/home/parker/projects/pob2-mcp-wt/m21`, branch `build-guide/m21`, off `main`. Lanes
  `bg-<nn>` on `bg/wu-<nn>`, off the integration head when the unit starts. Never touched: the main checkout,
  `/home/parker/projects/pob2-mcp-wt/m18` (the live runs'), and the stale M-20 worktrees (`m20`, `bg-84`…`bg-91`).
- **Waves.** Wave 1: WU-92, WU-93, WU-94 in parallel. Wave 2, after wave 1 merges: WU-96, WU-97 and WU-98 in
  parallel, then WU-95 (it owns the pipeline static test and the references the stage files point at). The
  coordinator merges each unit after its verifier passes.
- **Who owns what** (each unit also owns its new tests, in new files):
  - **WU-92:** the bridge's `node_power` handler (a new `pob-api/API/NodePower.lua`, registered in
    `pob-api/API/Handlers.lua`); its reply schema in `src/engine/schemas.ts`, its wrapper and long-action timeout in
    `src/pobLuaBridge.ts`, its case in `tests/integration/contract.test.ts`; `src/handlers/treeHandlers.ts`
    (`get_node_power`, and `get_passive_upgrades`' candidates); its entries in `src/server/toolSchemas.ts`,
    `toolMeta.ts` and `toolRouter.ts`; the README table (`pnpm build && pnpm docs:tools --write`) and the tool-count
    sites.
  - **WU-93:** `src/plan/schema.ts`, `src/plan/buildHash.ts`, `src/plan/compiler.ts`, `src/plan/record.ts`,
    `src/plan/checks/` (V1's `missing-reason` for needs), `docs/build-guide/plan-reference.md`,
    `src/handlers/planHandlers.ts` (`guide_run {resume}`) and `guide_run`'s entries in `toolSchemas.ts` and
    `toolRouter.ts`.
  - **WU-94:** `.claude/skills/build-guide/scripts/check-run.mjs`, `run-log.mjs`, `render-audit.mjs`,
    `scripts/run-usage.mjs`, `tests/fixtures/pipeline/`.
  - **WU-96:** `references/stages/D1-build.md` (and its `schemaVersion: 6`), `D1-finish.md`, `D1-gate.md`, the new
    `D1-tree.md` and `F1.md`, `R1b.md` (its league rule only), `R1b-assemble.md` and `templates/dossier-template.md`
    (D-423: the dossier's EHP names the hit), `references/gates.md`, `references/patterns.md` (the travel rule only).
  - **WU-97:** the new `templates/guide-endgame-template.md`, `references/stages/W1.md`, `references/stages/V4.md`.
  - **WU-98:** `src/trade/` (the 429's fix, if it is ours), `scripts/compact-reminder.sh`,
    `docs/build-guide/run-settings.example.json`.
  - **WU-95:** `SKILL.md`; `references/` `checkpoints.md`, `run-folder.md`, `run-log.md`, `start.md`, `pricing.md`,
    `fix-round.md`, `task-header.md`, `offline-and-test.md`; the four definitions in `.claude/agents/build-guide/`;
    `tests/static/buildGuidePipeline.test.ts`.
  - **The coordinator:** the work-log and the spec.
- **Serialized files:** `toolSchemas.ts`, `toolRouter.ts`, `toolMeta.ts` and the README table: WU-92, then WU-93,
  which rebases onto WU-92's merge before its own. `tests/static/buildGuidePipeline.test.ts`: WU-95; WU-96 and WU-97
  put their static checks in new files, and when their text breaks a pinned assertion there, update only that
  assertion and say so in the report.
- **Formats fixed before the build,** so the scripts (WU-94) and the stage files (WU-95 to WU-97) agree:
  - F1's verdict file: `reports/gates/F1-<id>-a<n>.json`, the D2 gate verdict's shape (`gates.md`), `stage: "F1"`.
  - The D1 gate verdict gains part `tree` (`pass`, `fail` or `unverified`), finding codes `tree-swap` and
    `tool-error`; its `design` field gains, per rung, `tree: {travel, points, bestSwap, needs}`, `bestSwap` null or
    `{gainPercent, removed: [names], added: [names]}`, `needs` the needs' reasons as text.
  - The refused route: stage outcome `refused`; verdict code `tool-refused`; return line `refused: <tool>`.
  - V4's campaign pass: stage `V4-campaign`, header `check: "campaign"`, report H1 `campaign pass of rounds/<n>`.
  - The run log's schema 4 (§6), `resumes[]` entries with the four lists' lengths (§9), and the answer forms (§5,
    §9): `pick:<id>[,<id>…]`, `accept:file`, `campaign`, `accept:verification`, `decline:<note>`, `guide:<id>`,
    `campaign:<id>`, `design:<id>`.
  - **As WU-94 built them** (merged at `578efe3`; the stage files and `SKILL.md` follow these, or the checker fails
    the run):
    - `run-log.mjs <runFolder> build '{"id", "roll", "status": "queued"}'` adds a build at each finalize; `build
      '{"id", "status"?, "guide"?, "pobFile"?}'` updates it; `resume '{"noNinja": …}'` writes a `resumes[]` entry
      `{date, pinCommit, digest, noNinja, lengths: {stages, checkpoints, escalations, displays}}` and sets the
      status `running`; `init` requires `noNinja`; `migrate` takes no JSON; `display design|final --build <id>`.
    - F1's write-ledger refusal is code `ledger-refused` in part `compiled`; an F1 escalation's accept after it
      retries F1 and accepts no finding.
    - A build in `"."` (a migrated run's) keeps the PoB file name `<slug>-<YYYY-MM-DD>-<n>`, with no card id; F1's
      `buildName` follows the checker (`check-run.mjs`, the PoB file name rule).
    - A D1 gate whose `tree` part is `unverified` with `tool-error` is logged with outcome `fail`, and the next step
      is the D1 gate alone.
    - A user's `stop` at a design gate ends that build only; a default (test-config) `stop` at the design or final
      gate ends the run, the queued cards `stopped`; the test config's `not-accept` resolves to `decline:<note>`.
    - The design display's tree lines follow its Gems line: `- Passive tree: <travel> of <points> points on travel;
      best swap left: none | +<x>% Full DPS by moving <n> points from <removed> to <added>`, then `- Kept on the
      tree: <need>`, one per need; the final display appends each rung's travel.
    - `V4-campaign`'s report H1 is exactly `# V4-<n>: campaign pass of rounds/<n-1>`.
    - The endgame reward-pick rule is skipped for a design whose last D1 gate came before a migrated run's first
      resume; `design:<id>` is offered only while the plan is unchanged since that gate (F1 checks it).
- **No network** beyond GitHub and npm for a worktree's bootstrap. WU-98 investigates the 429 by reading the
  limiter's code and testing it through `fixtureFetch`; nothing contacts the trade site.

## M-20: amendment 8, finding the build's engine (built)

Added 2026-10-18. For this build, this section overrides the M-19 and older sections and "What to build" below;
"Worktrees and branches" onward still applies, with the integration worktree named here.

- **Spec.** `docs/build-guide/spec/amendment-8-engine-lens.md` is binding: D-400…D-409, WU-84…WU-91 (§15) and
  their ACs (§16). The spine and slices are v1.6 and bind everywhere else; where the amendment and v1.6 disagree
  inside D-400…D-409's scope, the amendment wins; anywhere else report a conflict. Read the amendment's §2–§11 for
  the rules your unit touches, §14 ("What changes") for the files, and your unit's row and AC.
- **Approved** by the user on 2026-10-18 ("Build the beast library, and approve the grants and requests").
- **HG-12 is granted for two changes only:** `compile_plan`'s record gains `clearSpeed` and movement speed on card
  skeletons (WU-88, D-407), and the plan schema's `companion` field with the compile that reads it (WU-87, D-402).
  No tool is added and no tool's arguments change. Any other tool-contract change is still HG-12: stop and report.
- **Integration worktree:** `/home/parker/projects/pob2-mcp-wt/m20`, branch `build-guide/m20`, off `main`. Lanes
  `bg-<nn>` on `bg/wu-<nn>`, off the integration head when the unit starts. The main checkout and
  `/home/parker/projects/pob2-mcp-wt/m18` (the next live run's) are never touched.
- **Waves.** Wave 1: WU-84, WU-85, WU-86, WU-88 in parallel. Wave 2: WU-87 (after WU-88 and WU-86), WU-89 (after
  WU-88), WU-90 (after WU-85). Wave 3: WU-91. The coordinator merges each unit after its verifier passes.
- **Shared, fixed before the build:** `data/rules/vocabulary.md`, the mechanic families every `Creates:`,
  `Pays off on:` and `engine:` uses. Use only its words; propose a new one in your report, never in an entry. Only
  the coordinator edits it.
- **The entry id** (for D-400's and D-402's citations, and the index's blocks). In a Markdown data file, every entry
  is an H3 `### <Name>` whose next line is `- Id: <id>`, the id matching `^[a-z0-9]+(-[a-z0-9]+)*$` and unique in
  its file. A citation is `data | <path under data/>#<id>`, such as `data | league/runes-of-aldur.md#powered-by-verisium`.
  WU-89 teaches the run checker to resolve it.
- **Who owns what** (each unit also owns its new tests; new test files, never another unit's):
  - **WU-84:** `.claude/skills/build-guide/scripts/league-digest.mjs`, `data/league/`, `tests/fixtures/poe2db/league/`.
  - **WU-85:** `.claude/skills/build-guide/scripts/rules-index.mjs`, `data/rules/` except `vocabulary.md`.
  - **WU-86:** `.claude/skills/build-guide/scripts/monster-mods.mjs`, `data/monsters/`,
    `tests/fixtures/poe2db/monsters/`, PG-56 in `docs/build-guide/pob-gaps.md`.
  - **WU-88:** `src/plan/compiler.ts`, `src/plan/record.ts` and what reads the record's measures in `src/`;
    `docs/build-guide/plan-reference.md` only where it documents the record's measures.
  - **WU-87:** `src/plan/schema.ts`, the compile path for the companion (`src/plan/`, `pob-api/API/Compile.lua` or
    wherever the compile sets PoB's state), `plan-reference.md`'s `companion` row, the engine reply schema and
    contract case if an engine reply changes.
  - **WU-89:** `check-run.mjs`, `run-log.mjs`, `render-audit.mjs`, `tests/fixtures/pipeline/`.
  - **WU-90:** `.claude/skills/build-guide/references/patterns.md`.
  - **WU-91:** the skill text in §14's rows (`SKILL.md`, `references/`, `templates/`, `.claude/agents/build-guide/`,
    the new `references/stages/RV.md`) and `tests/static/buildGuidePipeline.test.ts`.
  - **The coordinator:** `data/rules/vocabulary.md`, `CLAUDE.md`'s pin-upgrade step, the work-log.
- **Serialized files:** `compiler.ts`, `record.ts` and `plan-reference.md`: WU-88, then WU-87.
  `tests/static/buildGuidePipeline.test.ts`: WU-90 (only the library's word cap), then WU-91.
- **poe2db, offline.** The coordinator's probes saved the pages under `/home/parker/projects/pob2-mcp-wt/poe2db-cache/`
  (`Runes_of_Aldur*.html`, `home.html`, `league.html`, `Monster_Modifiers.html`, `Tame_Beast.html`). WU-84 and WU-86
  read them through their scripts' `--from` option to build the committed data. Never fetch: no build agent touches
  the network. Never commit a saved page or a slice of one: test fixtures are small pages you write in the same HTML
  structure. The committed data is the game's own text with poe2db's URLs.
- **Game knowledge needs a source.** Every entry an agent writes (an index line, a rule sentence, a model in the
  monster table) comes from the game text in the pinned data or the saved pages, and "PoB models it" from
  `check_model_coverage` run through your worktree's own server (a temp-dir probe or a Jest helper), never the
  `mcp__pob2__*` tools.
- **No legacy content** (D-384, D-395): the index and the tables leave out gems PoB marks legacy and uniques it says
  are no longer obtainable; reuse the server's own test for both.
- **Fixtures.** The repository is public. Write fixtures from the game data, never from a guide author's PoB.
  `/home/parker/projects/pob2-mcp-runs/` is off limits.
- **Done means:** the unit's AC passes through the real code path; `mise run test` and `pnpm build` exit 0 from a
  clean tree; both waiver files are `[]`; dependencies unchanged.
- **Running tests (2026-10-18, after full runs in parallel lanes saturated the user's machine and crashed the
  session).** Every Jest or `mise run test` call runs at the lowest priority, and a full gate holds a shared lock so
  only one runs at a time across all worktrees:
  ```
  cd <lane> && nice -n 19 flock /tmp/claude-1000/-home-parker-projects-pob2-mcp/68a01821-fdbc-4f0e-a6c7-3d9a92cb5935/scratchpad/pob2-gate.lock \
    sh -c 'mise run test > <a mktemp file> 2>&1; echo "test rc=$?"; pnpm build >> <the same file> 2>&1; echo "build rc=$?"'
  ```
  Start it with the Bash tool's `run_in_background: true` (waiting for the lock can take a while) and wait for its
  notification; read the counts from the file. Targeted suites: `nice -n 19 mise exec -- pnpm exec jest <paths>
  --maxWorkers=4`, no lock. `jest.config.cjs` caps a full run at half the threads (`maxWorkers: '50%'`) once your
  lane is rebased onto the integration head.

## M-19: the server fix batch and the spec fold to v1.6 (built)

Added 2026-10-18, for work the coordinator runs while the user is away. For this batch, this section overrides
the M-18 section and the ones below it where they disagree; "Worktrees and branches" onward still applies,
with the integration worktree and branch named here.

- **Integration worktree:** `/home/parker/projects/pob2-mcp-wt/int`, branch `roadmap/2026-10-18`, off `main` at
  `dac3563`. Lanes branch off it and are rebased and fast-forwarded into it. The coordinator writes the work-log
  only there. The main checkout and `/home/parker/projects/pob2-mcp-wt/m18` (the next live run's worktree) are
  never touched.
- **Two lanes, run in parallel.** They share no file. If either needs the other's file, stop and report.

### Lane `bg-83`: the server fix batch (branch `bg/fix-batch`)

The background is `studies/2026-10-17-varashta-comparison.md` §3 ("How to read them", the first bullet) and §6
("The server"), and the work-log's "For the next server batch" (2026-10-17).

- **D-398, a load warning for supports in a tree-granted group.** PoB v0.23.1 rebuilds a tree-granted skill's
  socket group from its grant on every calculation (`vendor/.../Modules/CalcSetup.lua:1503-1534`): a group whose
  gem level differs from the grant isn't matched, and a matched group's gem list is wiped back to the granted gem.
  So a PoB file, probably saved by a newer PoB, that holds supports in such a group loses them silently on load,
  and every figure after that is measured without them.
  - Every tool reply that loads or imports a build file names each dropped gem and its group, in one warning line
    per group. Find every such path (`lua_load_build`, `import_build`, the session's reload, any other); a load
    that drops nothing says nothing new.
  - **HG-12 is granted for this warning only:** no tool is added, no tool's arguments change, and the counts stay.
    If the warning travels in an engine reply, update its reply schema (`src/engine/schemas.ts`), its wrapper type
    (`src/pobLuaBridge.ts`) and its case in `tests/integration/contract.test.ts` (AC-B3, AC-B4).
  - **PG-54** in `docs/build-guide/pob-gaps.md`, in its file's format: what PoB does, the code reference, the
    effect, and the warning that now names it. Link it to PG-51 (PoB's own copy of a tree-granted summon).
  - **Tests:** an engine test loads a fixture build whose tree-granted group holds supports and asserts the
    warning names them; a build without such a group gets no warning. Write the fixture from the game data: an
    ascendancy node that grants a skill, with supports added to its group. The repository is public; no
    fixture comes from a guide author's PoB.
- **The probe: a snapshot after a change times out on a heavy minion build.** On Navira's PoB (about eight minion
  types), the session's snapshot after a change (`export_build_xml`) timed out: a loadout switch at the default
  30 s `POB_TIMEOUT_MS`, and a custom-modifier `set_config` and a `toggle_gem` even at 300 s. Loading the file and
  read-only stats were fine.
  - **The probe build:** `/home/parker/projects/pob2-mcp-runs/m16-varashta/reference/navira-pob.xml` is the one
    file you may read under `reference/`. Copy it into a `mktemp -d` builds folder and work only on the copy.
    Never commit it, any part of it, or any fixture derived from it, and never paste its content into a report.
  - **Find the cause:** reproduce through the server (from a temp cwd, with `POB_DIRECTORY`, `XDG_STATE_HOME` and
    `POB_GUIDES_DIRECTORY` in temp dirs), then time the steps inside the snapshot and the change with `os.clock`
    in a throwaway copy of the Lua, never in `vendor/`.
  - **Fix it if the fix is local** (in `pob-api/` or `src/engine/`): the same snapshot, made faster or made
    without the slow step, with a test that fails before the fix. Record it as D-399. A test may use a heavy
    build written from the game data, not Navira's.
  - **Stop and report instead** if the fix changes what a snapshot holds or when the session takes one, adds a
    configuration setting, or needs `vendor/` changed. Those are the user's calls.
- **Commits:** `fix: … (D-398)`, `fix: … (D-399)`, `docs(build-guide): pob-gaps PG-54 …`.

### Lane `bg-fold`: the spec fold to v1.6 (branch `bg/fold-v16`)

- **What folds.** Everything since v1.5 (`9d4654e`, folded through D-362):
  - the decisions D-363…D-397 (and D-398, D-399 if the fix batch has merged when you finish; the coordinator adds
    them otherwise). D-363…D-368 and D-381…D-388 are in the work-log; D-369…D-375 in amendment 5;
    D-376…D-380 in amendment 6; D-389…D-397 in amendment 7 (whose D-391 is the approved new-card text);
  - amendments 5, 6 and 7 (accepted 2026-10-16, 2026-10-16 and 2026-10-18; each file's status line says so),
    with their work units and ACs as built: M-16 (amendment 5), M-17 (amendment 6), M-18 (amendment 7);
  - every "for the fold" or "for the v1.6 fold" note in the work-log after the line `### Spec v1.5 folded at
    \`9d4654e\``, and each build's recorded deviations the verifiers judged sound;
  - AC-P70's label: "Skeletal Warrior Minion", the minion's name, where the amendment's text names its skill.
  - **Not** the engine-lens amendment, the skill-split doc, the studies' remedies or anything still a proposal.
- **How.** Fold v1.5's way (its status paragraph in `spec/README.md`): the spine and slices become
  authoritative; each row a decision supersedes or changes is marked "amended by D-3nn (v1.6)"; the status line
  becomes v1.6 with a paragraph listing what it folds; the amendment files stay as the rationale record and are
  not edited. Where an amendment and the work-log's as-built record disagree, the as-built record wins, with the
  difference stated.
- **Owns:** `docs/build-guide/spec/README.md`, `01-server-tools.md`, `02-plan-compiler.md`, `03-pipeline.md`,
  `docs/build-guide/plan-reference.md` if a decision changes the plan's reference, and
  `tests/static/buildGuidePipeline.test.ts` only where it pins spec text that the fold changes (say so).
- **Gate:** `pnpm exec jest tests/static` passes. A fold changes no code.
- **Report:** the head commit, the decisions and notes folded (one line each where a choice was needed), any
  amendment-versus-as-built difference, and anything left open for the user.
- **Commits:** `docs(build-guide): spec v1.6 fold, …`.

## M-18: amendment 7, gates as interviews (built)

Added 2026-10-18. For this build, this section overrides the M-17, M-16 and M-15 sections and "What to build" below;
the other sections ("Worktrees and branches" onward) still apply as written. M-18 is this handoff's label for the
build; the spine gets it at the v1.6 fold.

- **Spec.** `docs/build-guide/spec/amendment-7-gate-interviews.md` is binding for this build: D-389…D-397,
  WU-80…WU-82 (§13) and their ACs (AC-P70, AC-W67…AC-W69). It is not folded into the spine and slices yet. Where
  the amendment and the slices' current text disagree inside D-389…D-397's scope, the amendment wins; anywhere else
  the spine and slices bind, and you report a conflict. Read the amendment whole: §2–§10 are the rules, §13 the units.
- **Background, not requirements:** `studies/2026-10-17-varashta-run-feedback.md` (the feedback the amendment
  answers) and `studies/2026-10-17-varashta-comparison.md` §6–§7. Read only what your unit needs.
- **Ratified.** The user approved amendment 7 on 2026-10-18 with §15's recommended options, and said "Go ahead"
  to the build.
- **Directive.** WU-80 and WU-81 run in parallel, each in its own lane; WU-82 starts after WU-81 merges. The
  coordinator merges each unit after its verifier passes.
- **Who owns what.**
  - **WU-80 (slice 02, D-397)** owns `src/` and its tests: `figureField` (`src/plan/record.ts:426`), the headline
    (`:448-460`), the compile's key-figure line, and whatever else in `src/` reads a group's figure through
    `figureField`. The rule: a group's figure is `MinionTotalDPS` when it names a minion skill, or when its
    `skillOutputs` entry carries `Minion<Field>` fields (the checker's D-385 test, `check-run.mjs:347`); otherwise
    `TotalDPS`. `get_passive_upgrades` already decides this way (`src/handlers/treeHandlers.ts`, D-388); keep the
    two consistent. AC-P70 is an engine test.
  - **WU-81 (slice 03 scripts)** owns `.claude/skills/build-guide/scripts/` (`run-log.mjs`, `check-run.mjs`,
    `render-audit.mjs`), their tests and `tests/fixtures/pipeline/`. That includes D-397's reach into the checker,
    the renderer and the verification display, if any of them reads a plain summon's figure as `TotalDPS` today; the
    checker's own test is D-385's. It also owns:
    - the card id's new letter `g` (`r<k>-g-<n>`, D-391), in `CARD_ID` and the deck check;
    - the checkpoint's `questions`, `changes`, `newCards` and `note`;
    - the test config's object entries (D-394);
    - every display rewritten in plain words (D-392);
    - a fixture run in the new card format (AC-W67, AC-W68).

    WU-81 defines the formats: the card's Pitch fields as the display parses them, the deck header's sections, the
    interview notes' layout. Write them down in its report, for WU-82.
  - **WU-82 (slice 03 skill text)** owns `SKILL.md`, `references/`, `templates/`, the agent definitions under
    `.claude/agents/build-guide/`, the new `references/stages/Q.md`, and `tests/static/buildGuidePipeline.test.ts`.
    It writes the text to match WU-81's formats as merged, not its own reading of the amendment.
- **Serialized files:** `tests/static/buildGuidePipeline.test.ts`: WU-81 (only where a script's pinned message
  changes), then WU-82. No other file is shared between WU-80 and WU-81; if you find you need one, stop and report.
- **HG-12 is granted for D-397 only:** `compile_plan`'s headline (`measures.dps`), its key-figure line
  (`DPS <n> (<skill>, minion)`) and its record read a plain summon's group by its minion. No tool is added, no tool's
  arguments change, and the counts stay as they are. Any other tool-contract change is still HG-12: stop and report
  `blocked`.
- **No legacy content.** Since D-384 the lookups leave legacy gems out and `compile_plan` refuses them. A fixture or
  test plan uses none.
- **Fixtures.** The repository is public. Write fixtures from the game data, never from a guide author's PoB.
  `/home/parker/projects/pob2-mcp-runs/` is the baseline run's: read it for formats if you need to, never write
  there, and never read its `.env` or `reference/`.
- **Network.** None. Tests use committed fixtures and never contact the trade site, poe.ninja or poe2db (D-34).
- **Done means:**
  - amendment 7's ACs for your unit pass;
  - `mise run test` and `pnpm build` exit 0 from a clean tree (AC-T22 and the compile-time test run alone in the
    `--runInBand` step since 2026-10-17; a timing failure under load is re-run alone before it counts);
  - both waiver files are `[]` (AC-B2);
  - dependencies are unchanged (AC-B7).

  If a tool's description changes, regenerate the README table (`pnpm build && pnpm docs:tools --write`).
- **Cost.** Keep context lean. Read the amendment whole and the files it names by the lines you need. Run targeted
  Jest suites while you work, and the full gate once at the end.

## M-17: amendment 6, a minion's skill (built)

Added 2026-10-16. For this build, this section overrides the M-16 and M-15 sections and "What to build" below; the
other sections ("Worktrees and branches" onward) still apply as written. M-17 is this handoff's label for the build;
the spine gets it at the v1.6 fold.

- **Spec.** `docs/build-guide/spec/amendment-6-minion-skills.md` is binding for this build: D-376…D-380, WU-77…WU-79
  (§8) and their ACs. It is not folded into the spine and slices yet. Where the amendment and the slices' current
  text disagree inside D-376…D-380's scope, the amendment wins; anywhere else the spine and slices bind, and you report
  a conflict.
- **Background, not requirements:**
  - `studies/2026-10-16-minion-skill-spike.md`: what PoB computes, measured, as A1…A5;
  - `studies/2026-10-16-minion-skill-map.md`: the touch-point map, with `file:line` at `ca2b79d`. Read the parts your
    unit owns.
- **Ratified.** The user accepted amendment 6 on 2026-10-16 ("Go ahead").
- **Directive.** Build WU-77, then WU-78, then WU-79, in series. The coordinator merges each before the next starts.
- **HG-12 is granted for this build's contract changes only:**
  - `set_main_skill` gains `minion_skill` and `minion_stat_set`, and its reply names the minion selection;
  - `get_skill_setup`, `analyze_skills` and the stats breakdown show a summon's minion skills;
  - `lookup_game_data`'s gem mode gains the minion-skill result (D-379);
  - `compile_plan`, its check and its record gain plan schema 4's fields, their defects, the resolved selection and
    D-378's figure;
  - V1 gains `not-granted`.

  No tool is added, and the counts stay as they are. Any other tool-contract change is still HG-12: stop and report
  `blocked`.
- **Who builds what.**
  - **WU-77** writes one Lua function that selects a group's minion skill by name and stat set. It resolves the name
    against the live list, validates the stat set, writes PoB's fields as `Modules/Build.lua:461-475` does, and
    rebuilds. It is usable for any group: `set_main_selection` calls it for the main group, and WU-78's compile calls
    it for every group that names one. Its snapshot and restore cover the stat-set lookup tables (spike A3).
  - **WU-78** owns the compile's flattened `Minion<Field>` outputs (`Compile.lua`'s `outputs`). WU-77 owns
    `export_stats` and `stats_breakdown`.
- **Serialized files:**
  - `pob-api/API/BuildOps.lua`: WU-77, then WU-78;
  - `pob-api/API/Lookup.lua`: WU-77;
  - `src/plan/schema.ts`, `src/plan/checks/v1.ts`, `pob-api/API/Compile.lua` and `docs/build-guide/plan-reference.md`:
    WU-78;
  - the skill text, the agent definitions, `check-run.mjs`, `render-audit.mjs` and the pipeline tests: WU-79.
- **Engine wiring.** WU-77 changes the replies of `get_skills`, `set_main_selection` and the lookup; WU-78 changes
  `compile_check`'s and `compile_stage`'s. Each updates the action's reply schema in `src/engine/schemas.ts`, its
  wrapper types in `src/pobLuaBridge.ts` and its case in `tests/integration/contract.test.ts` (AC-B3, AC-B4).
- **The schema bump (D-320).** WU-78 makes plan schema version 4, with a `VERSION_ADDITIONS` entry. Validators accept
  versions 1 to 4 (D-332).
- **Fixtures.** The repository is public. Don't commit Navira's PoB, or any part of it, as a fixture.
  - You may read it for a probe: `/home/parker/projects/pob2-mcp-runs/m16-varashta/reference/navira-pob.xml`.
  - AC-P68's Disciple of Varashta plan is written from the game data: the Sorceress tree, nodes 32705 and 10561, and
    a "Navira, the Last Mirage" group.
  - AC-K70 uses `tests/fixtures/builds/grenadator.xml`.
- **Leave alone:** `/home/parker/projects/pob2-mcp-wt/m16` and `/home/parker/projects/pob2-mcp-runs/` are the baseline
  run's. Don't write there. `m16` holds a `.env`: never read or copy it.
- **Network.** None. Tests use committed fixtures and never contact the trade site or poe.ninja (D-34).
- **Done means:**
  - amendment 6's ACs (AC-K69…AC-K71, AC-P68, AC-P69, AC-W65, AC-W66) pass;
  - `mise run test` and `pnpm build` exit 0 from a clean tree;
  - both waiver files are `[]` (AC-B2);
  - dependencies are unchanged (AC-B7).

  If a tool's description changes, regenerate the README table (`pnpm build && pnpm docs:tools --write`).
- **Cost.** Keep context lean. Read the amendment whole (it is short), the spike, and the map's parts for your unit.
  Read the files they name by the lines you need. Run targeted Jest suites while you work, and the full gate once at
  the end.

## M-16: amendment 5, gear pricing (built)

Added 2026-10-16. For this build, this section overrides the M-15 section and "What to build" below; the other
sections ("Worktrees and branches" onward) still apply as written. M-16 is this handoff's label for the build; the
spine gets it at the v1.6 fold.

- **Spec.** `docs/build-guide/spec/amendment-5-pricing.md` is binding for this build: D-370…D-375, WU-74…WU-76
  (§9) and their ACs. It is not folded into the spine and slices yet; the fold to v1.6 follows the build. Where the
  amendment and the slices' current text disagree inside D-370…D-375's scope, the amendment wins; anywhere else
  the spine and slices bind, and you report a conflict.
- **Background, not requirements:** `studies/2026-10-16-pricing.md` (the conversion table's source, its §2 for
  league dates) and `../worklog.md`, "pricing strategy, a detour before the reference-build run".
- **Ratified.** The user accepted amendment 5 on 2026-10-16, D-375 included.
- **Directive.** Build WU-74, then WU-75, then WU-76, in series; the coordinator merges each before the next
  starts. The Lightning Arrow Deadeye reference run is the coordinator's and the user's, after M-16.
- **HG-12 is granted for WU-74 only:** `find_upgrades`' output gains C-49's `League:` and `Checked:` lines, and a
  stop for a trade-site limit carries C-49's `[trade:<kind>]` prefix with the `TradeErrorKind`. Its arguments,
  ranking and the rest of its output stay as they are. Any other tool-contract change is still HG-12: stop and
  report `blocked`.
- **`data/economy/prices.json`** (WU-75) holds the conversion table (amendment §5) and the league table as
  `judgment` facts, confidence L, citing the study, in the form `data/campaign/gems.json` uses for D-359's socket
  estimate. League start dates are the study's day-0 dates. Give an `end` only for Dawn of the Hunt, Rise of the
  Abyssal and Fate of the Vaal (each data range's last date); Runes of Aldur and Forbidden Rites have none, and
  D-373's day-60 rule reads Runes of Aldur as late.
- **Network.** None. Tests use `fixtureFetch` and never contact the trade site or poe.ninja (D-34). Never read
  `.env` or set `POESESSID`; a test that needs a session uses a fake value, as the existing `find_upgrades` tests
  do.
- **Tool count.** No tool is added: the counts stay as they are. If a tool's description changes, regenerate the
  README table (`pnpm build && pnpm docs:tools --write`).
- **Done means:** amendment 5's ACs (AC-K68, AC-K67, AC-W63, AC-W64) pass; `mise run test` and `pnpm build`
  exit 0 from a clean tree; both waiver files are `[]` (AC-B2); dependencies are unchanged (AC-B7).
- **Cost.** Keep context lean: read the amendment whole (it is short) and the files it names by the lines you
  need; run targeted Jest suites while you work, and the full gate once at the end.

## M-15: amendment 4, the lean pipeline (read this first)

Added 2026-10-11. For the M-15 build, this section overrides "What to build" below and adds to the other
sections, which still apply as written.

- **Spec v1.5** (folded at `9d4654e`). The spine `docs/build-guide/spec/README.md` holds:
  - decisions through D-362, and A-34 and A-35;
  - M-15 in §7;
  - WU-64…WU-72 in §8, with amendment 4's lanes.

  The slices hold the unit blocks and ACs:
  - `01-server-tools.md`: WU-66's path tools, AC-K66;
  - `02-plan-compiler.md`: WU-65…WU-68 (§5), AC-P60…AC-P67 (§6);
  - `03-pipeline.md`: WU-64 and WU-69…WU-72, AC-W51…AC-W60 (§13).

  Text marked *Target (WU-nn, D-nnn)* is what you build.
- **Background, not requirements:**
  - `spec/amendment-4-cost-and-scope.md`;
  - the three reports `studies/2026-10-11-cost-1-mechanics.md`, `…-cost-2-claims-and-rules.md` and
    `…-run-a-issues.md`.
- **Ratified.** The user signed off every amendment 4 change on 2026-10-11. D-345…D-362, A-34 and A-35 are
  settled.
- **Directive.** Build WU-64…WU-71. WU-72, the lean recorded run, belongs to the coordinator and the user.
- **Done means:**
  - M-15's exit (spine §7) holds at the integration head;
  - `mise run test` and `pnpm build` exit 0 from a clean tree;
  - both waiver files are `[]` (AC-B2);
  - dependencies are unchanged (AC-B7).
- **HG-12 is granted for WU-66 only.** The grant covers changing `find_path_to_node` and `get_nearby_nodes`
  exactly as D-360 and C-1 state: their paths never open a second tree on one start, and their arguments and
  output format stay unchanged. Every other tool-contract change is still HG-12: stop and report `blocked`.
  WU-68's `guide_run` views are inside C-50's target (D-356), not a new contract.
- **Network.** No M-15 unit needs poe.ninja, and none contacts it. GitHub (`mise run pob:fetch`) and the npm
  registry only.
- **Serialized files for M-15.** The coordinator merges one unit at a time, in this order:
  - `pob-api/API/Compile.lua` and `src/plan/checks/v1.ts`: WU-65, then WU-66, then WU-67 (`v1.ts`);
  - `src/plan/schema.ts`: WU-65 only, the version-3 bump. Validators accept versions 1, 2 and 3;
  - `src/handlers/planHandlers.ts`: WU-65 (the reply), then WU-68 (the views);
  - the skill (`SKILL.md`, `references/`, `templates/`, the agent definitions), `check-run.mjs` and
    `tests/static/buildGuidePipeline.test.ts`: WU-69, then WU-70, then WU-71.
- **Tool count.** M-15 adds no tool: the counts stay 84, and 83 without poe.ninja. WU-68 changes `guide_run`'s
  schema and description, so it regenerates the README table (`pnpm build && pnpm docs:tools --write`).
- **Engine wiring.** A unit that changes a Lua reply updates `src/engine/schemas.ts`, `src/pobLuaBridge.ts`
  and `tests/integration/contract.test.ts` (AC-B3, AC-B4, AC-B5).
- **Cost.** The point of amendment 4 is a cheaper pipeline, so keep your own context lean:
  - read the spec by unit block, AC and the sections they cite, not whole files;
  - run targeted Jest suites while you work, and the full gate once at the end.

## What to build

- **Spec.** `docs/build-guide/spec/README.md` is the spine, v1.3:
  - contracts C-30…C-54;
  - decisions D-100…D-334;
  - the autonomy envelope (§6) and milestones (§7), M-14 among them;
  - the work-unit graph, its amendment lanes and the serialized-wiring rule (§8);
  - guardrails (§9);
  - the test strategy, with the cross-cutting ACs AC-B1…AC-B8 (§12).

  The slice specs hold the work-unit blocks and acceptance criteria:
  - `01-server-tools.md`: WU-50, WU-52, WU-53, WU-54, WU-60 (target ACs AC-K47…AC-K52);
  - `02-plan-compiler.md`: WU-51, WU-55, WU-61 (AC-P51…AC-P59);
  - `03-pipeline.md`: WU-56…WU-59, WU-62 (AC-W2 (v)…(ee), AC-W27…AC-W33, and the target clauses of AC-W5,
    AC-W11 and AC-W14).

  Text marked *Target (WU-nn, D-nnn)* is what you build. The as-built text beside it is what exists today.
- **Background, not requirements:**
  - the amendments: `spec/amendment-1-simplify.md`, `amendment-2-guide-style.md`, `amendment-3-open-builds.md`.
    They record why; the spine and slices are binding.
  - `docs/build-guide/worklog.md`, the section "Spec fold v1.3 (2026-10-10)": the gap resolutions F1–F27.
  - `docs/build-guide/pob-gaps.md` (PG-n) and `docs/build-guide/studies/` (the 34 study reports).
  - The stabilization spine `docs/stabilization/spec/README.md` ("stab") still binds wherever this spine
    cites it.
- **Ratified.** The user approved amendments 2 and 3 and the fold. Treat every PROPOSED decision
  (D-317…D-334) as settled.
- **Directive.** Build WU-50…WU-58 and WU-60…WU-62. WU-59, the offline run with an open brief, is the
  coordinator's: it is recorded like WU-47, in an interactive session (D-263), after WU-58. WU-48 (the
  live run) is not part of this build.
- **Done means:** M-14's exit (spine §7) holds at the integration head. That includes:
  - `mise run test` and `pnpm build` exiting 0 from a clean tree;
  - both waiver files empty (AC-B2);
  - unchanged dependencies (AC-B7).

## Worktrees and branches

- **Integration worktree:** `/home/parker/projects/pob2-mcp-wt/amend`, branch `build-guide/amendments`,
  branched off this handoff's commit. Work lands here, unit by unit, in DAG order. The coordinator writes
  the work-log `docs/build-guide/worklog.md` only here.
- **Lane worktrees:** `/home/parker/projects/pob2-mcp-wt/bg-<nn>`, on branch `bg/wu-<nn>`, created off the
  integration head current when the unit starts.
  - A lane is rebased onto `build-guide/amendments`, then fast-forward merged, then removed.
- **Never touched by the fleet:** the main checkout `/home/parker/projects/pob2-mcp` (branch `main` since
  2026-10-18). The user's pob2 MCP server runs from its `build/`.
- **Directory discipline.** `cd` to your worktree's absolute path at the start of every Bash call, because
  subagent cwd drifts.
- **Bootstrap a new worktree:**
  ```
  mise trust && pnpm install --frozen-lockfile && mise run pob:fetch
  git config --worktree commit.gpgsign false
  ```

## Gate commands (from the worktree root)

```
cd <worktree> && rm -rf build coverage && pnpm exec jest --clearCache >/dev/null
mise run test; echo "test rc=$?"     # builds, then the full Jest suite and the NFR --runInBand step
pnpm build;    echo "build rc=$?"
```

A unit is done only when an independent verifier, never the doer, confirms the five unit-gate checks:

1. Both exit codes are 0.
2. Every AC the unit owns maps to a named passing test, or a recorded script check. That test or check
   meets the fidelity rule: it asserts the spec, not the as-built, through the real code path.
3. The code-diff review is clean.
4. `tests/fixtures/tool-hygiene-allowlist.json` and `tests/static/poe1-cruft-waivers.json` are `[]`.
5. No files changed outside the unit's `touches` (the spine §8 table plus the slice block), apart from its
   implied scope and the serialized wiring files.

A spike or content unit with no code (WU-50, WU-51, WU-56) gates on its script check or static tests and
on `pnpm exec jest tests/static`. The full gate runs at the wave gate.

**Timing ACs under load.** These can false-fail while several worktrees run suites at once:
- this epic's NFR-20 and NFR-21 compile-time ACs;
- stab AC-E8, AC-F3, AC-F10, AC-T22, AC-T34 and AC-T40.

If one fails on time alone, re-run it in isolation. Record "tooling false-failure" only if that passes.

## Wiring and counts (spine §8)

- **Serialized files.** They are listed in spine §8. The amendment units add:
  - `Lookup.lua`: WU-60, then WU-53;
  - `src/plan/schema.ts`, `src/plan/checks/v1.ts` and `plan-reference.md`: WU-55 and WU-61;
  - the skill's `SKILL.md`, `check-run.mjs`, `guide-template.md`, `build-guide-coordinator.md` and the
    pipeline tests: WU-62, then WU-57, then WU-58.

  Edit them in short wiring steps. The coordinator merges one unit at a time, in DAG order, and a lane
  rebases before it merges.
- **Engine wiring.** WU-53, WU-54, WU-55 and WU-60 each change an engine action's reply. Each one updates
  that action's reply schema in `src/engine/schemas.ts`, its wrapper types in `src/pobLuaBridge.ts`, and its
  case in `tests/integration/contract.test.ts` (AC-B3, AC-B4; AC-B5 for WU-55).
- **The schema bump (D-320).** WU-55 and WU-61 both change the plan schema. Whichever merges first makes
  §3.2's `schemaVersion` bump, and the second extends it. Validators accept versions 1 and 2 (D-332).
- **Tool counts.** WU-52 is the only unit that adds tools: the poe.ninja tools in group `ninja`, their
  number set by WU-50. It restates every count site in spine §1.3 and regenerates the README table with
  `pnpm build && pnpm docs:tools --write`. Never hand-edit the table. The count without poe.ninja stays 83
  (D-316).
- **New Lua.** It goes in the module the unit names. `BuildOps.lua` edits stay inside the functions your
  unit names.

## Commits

- Commit only inside your worktree, with `git -c commit.gpgsign=false commit …`. Pass
  `-c commit.gpgsign=false` to `rebase`, `merge`, `cherry-pick` and `revert` too: a signing prompt hangs an
  agent.
- Messages are `<type>(WU-nn): <what>`, ending with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never push. The coordinator sign-rebases with the user present at the end (HG-8).

## Hard rules (spine §9; breaking one is unrecoverable)

- **Secrets.** Never read, print, grep, cat, source or copy any `.env`. Never set `POESESSID`. Worktrees
  have no `.env`; don't copy one in.
- **Network.**
  - **Allowed:** GitHub (`mise run pob:fetch`) and the npm registry.
  - **poe.ninja (D-297):** only the units whose block says so (WU-50 now; WU-52 to record fixtures). Every
    request must follow these rules:
    - send one request at a time, at least 3 s apart;
    - on HTTP 429 or 5xx, stop and wait at least 60 s before one retry;
    - cache every response in your temp dir, and never fetch a URL twice;
    - use `curl` with the server's User-Agent `pob2-mcp-server/<package.json version>` (stab D-25), and no
      cookie, name, email or other identifying header;
    - fetch poe.ninja URLs only, and only ones reached from poe.ninja itself;
    - keep the total small: a few dozen requests, not a crawl.
  - **Forbidden:** pathofexile.com, and every other host, including through WebSearch and WebFetch. Links
    found on poe.ninja that lead elsewhere (a GitHub repo, a forum thread) are recorded in your report, not
    opened.
  - **Tests** reach HTTP only through `fixtureFetch` and committed fixtures (D-34).
  - Anything else that seems to need a live request is HG-1: stop and report.
- **Filesystem.** Write only inside your worktree and temp dirs, made with `mktemp -d`. Never touch
  `/mnt/c/...`, the user's builds and guides folders (HG-6). A probe that starts the server or the engine
  runs from a temp cwd, with `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY` pointed at temp
  dirs. Don't use the session scratchpad, which other agents share.
- **Identity.** No name or email in any request, fixture or file content, except git authorship.
- **Dependencies.** No unit changes `package.json`'s dependency sections or `pnpm-lock.yaml` (HG-10, AC-B7).
- **Agents.** You are a leaf worker:
  - don't spawn subagents, and don't call the Workflow tool;
  - never start a headless `claude -p` session (D-263);
  - don't use the Serena MCP tools (its one shared instance points at the wrong checkout). Use Read, Grep
    and Bash.
- **The pob2 MCP tools** (`mcp__pob2__*`) run the user's server from the main checkout, not your lane's
  code. Don't use them to test your unit. Test through Jest and temp-dir probes against your worktree's
  build.

## Known friction (from the M-10…M-12 build)

- **Running tests.**
  - `luajit` is on PATH only under mise. Run targeted suites as `mise exec -- pnpm exec jest <path>`, or run
    `mise run test`.
  - Long Jest runs need an explicit Bash timeout of up to 600000 ms, so they aren't backgrounded.
  - A stale `build/` fails the README table test (AC-G1) after a rebase that adds tools: run `pnpm build`.
- **Probing the engine.**
  - `mise exec -C <dir>` changes cwd and breaks vendor-relative Lua scripts. Prefer driving the engine
    through the server.
  - In-process tests can't call `ctx.client.loadBuildXml` (EngineLoadGuardError). Reload through
    `session.run` with kind `load`.
- **Engine data quirks.**
  - dkjson encodes an empty Lua table as `[]`, so a reply schema must accept `[]` for an empty map.
  - Headless PoB's `GetTime()` returns 0. Time Lua work with `os.clock`.
  - PoB's `SaveDB` attribute and element order varies between processes, so compare XML canonically.
  - The WSL2 wall clock can step backwards. Measure durations with `performance.now()`.
- **Harmless warnings.** `tsc -p tsconfig.test.json` reports TS6059 rootDir errors, and Jest prints "worker
  process has failed to exit gracefully". Both predate this epic; ignore them.
- **Tool quirks.**
  - Write and Edit refuse a file you haven't Read first.
  - The permission classifier has blocked `git rm`. Use plain `rm`, then `git add -A <path>`.
- **Static tests.** `tests/static/buildGuidePipeline.test.ts` pins some skill and spec text word for word.
  When you change pinned text, update the assertion in the same commit and say so in your report.

## Autonomy

- **Decide and record.** When the spec is silent on an implementation detail, make the smallest choice
  consistent with the contracts and the conventions (spine §1.2). Report it under `deviations`, with a
  one-line rationale. The coordinator folds these into the spine.
- **Spec edits.** Don't edit the spec files, with one exception: a unit that A-33 names (WU-53, WU-54)
  pins its criteria in its slice's §4 as its first step, then stops for the coordinator's review.
  - A spike's settled values go in its report. The coordinator records them in the spine.
- **The spec looks wrong.** If the real code or the pinned PoB2 makes an AC unachievable, implement the
  closest faithful behaviour and report a deviation with `file:line` evidence. Report `blocked` instead if
  the fix would change any of these:
  - a tool contract, or the tool surface beyond C-37…C-54 (HG-12);
  - a dependency (HG-10);
  - the pin (HG-11).
- **Stop conditions.** On a stop, report `blocked` with evidence. Independent lanes continue.
  - A human gate fires: stab HG-1…HG-9, or spine HG-10…HG-22.
  - The same gate failure signature comes back three times in a row (`blocked:loop`).
  - A unit needs a file owned by a unit that hasn't merged yet.

## Reporting (doers)

End with a terse report, under 40 lines:
- the head commit;
- each owned AC, mapped to its test (file and test name) or script check;
- the gate exit codes;
- `deviations`, one line each, with rationale;
- `friction`: tooling traps the next unit will hit;
- `blocked`, with evidence, if any.

No diffs, no logs.

## Notification path

Agent results return to the coordinator session. It records each verdict in the work-log the moment it's
made, and surfaces any STOP to the user (in chat, plus a push notification). It writes a compact resume
handoff before its context grows large.
