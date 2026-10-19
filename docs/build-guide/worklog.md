# Build-guide epic: work-log

The coordinator's record of the build: verdicts, merges, gate evidence, decisions and friction. Written
only in the integration worktree (`/home/parker/projects/pob2-mcp-wt/guide`, branch `build-guide/build`).

## 2026-10-08: build start

- **Spec:** `docs/build-guide/spec/` at `a091a6b`. The user approved implementation on 2026-10-08 and
  settled the three open questions:
  - asking before a compile discards unsaved work in the loaded build (D-210);
  - the budget tolerance: at most 20 divines passes, over 20 up to 22 passes with a "near the ceiling"
    note, over 22 fails (D-219);
  - the survival floor gates chaos resistance too, uncapped only through a recorded per-stage exception
    when capping it is infeasible (D-234; the user: "only leave chaos res uncapped if it's absolutely
    necessary").
- **Handoff:** `docs/build-guide/build-handoff.md`.
- **Scope of this run:** WU-30…WU-47. WU-48 (the live alpha) waits for HG-14.
- **Orchestration:** individual background agents (no Workflow), one doer per unit, a read-only
  reviewer per unit (small units may share one), and an independent verifier per wave gate.

### Baseline gate at `7eaa0c8`

- Bootstrap rc=0; `mise run test` rc=1 (1 failed of 1041, 116 s); `pnpm build` rc=0.
- The one failure: stab AC-G2 (`tests/static/readme.test.ts`) asserted `docs/` holds only
  `stabilization/`, which this epic's `docs/design/` and `docs/build-guide/` broke. **Coordinator
  decision:** the assertion now lists the epic folders (`build-guide`, `design`, `stabilization`); the
  stale-file list it exists for is unchanged. The test passes after the change.

## 2026-10-08: wave 1 (WU-30, WU-31, WU-33, WU-37, WU-38, WU-40, WU-49)

All seven started off `63fe84e` in parallel lanes. Each had one doer, then a read-only reviewer
(WU-37 with WU-49, WU-30 with WU-40), then fixes by the same doer.

### Verdicts

- **WU-49** (dated trade outputs, `[trade:<kind>]` errors): done `26ecc02`; review clean.
- **WU-37** (guides-folder root): done `fece2a3`; review: 1 low (`createRunFolder` accepted an invalid
  date and created `0NaN-NaN-NaN-1`), fixed `44d608e` (an invalid date or a year outside `YYYY` is
  refused before any `mkdir`).
- **WU-33** (per-skill breakdown, skill-part fix): done `931d85c`; review: 2 low (a hidden effect with
  an empty PoB name rendered a nameless heading; a missing-group error said "nil"), fixed `f71fa81`,
  which also stabilized a flaky attribute-order check. All six deviations accepted, among them an
  additive `statSet` field in `set_main_selection`'s reply (slice 01 §2.1 said "unchanged"; fold in)
  and a group-exists check before mutating, which fixes a pre-existing C-3 violation.
- **WU-38** (plan schema, reference, ledger): done `4bc24d5`; review PASS with 2 low (export an
  extendable source-tag schema for WU-39's data files; copy §3.3's WORD/NUMBER/REF lines verbatim into
  the reference), fixed `2e47473`. Fixture: Warrior/Titan, Boneshatter rolled, checked in the engine.
- **WU-31** (`lookup_game_data`, `search_tree_nodes` ascendancy filter): done `cacfa51`; review: 1 medium
  (unique and mechanic modes searched only each unique's selected variant, so alternative rolls such as
  Prism of Belief's "+(1-3) to Level of all Blood Hunt Skills" were invisible) and 3 low (`gem_level`
  failed the whole call when one result lacked the level; AC-K5's exact-name-first rule was untested;
  "gem level 1" format). Fixed `32e17e5`, with three coordinator decisions (below). The fix commit was
  not re-reviewed; the wave gate checks it.
- **WU-30** (compile-time spike): done `aa991f5`; review PASS, 1 low (the rebuild-deferral claim covered
  only the saved file), fixed `1ec4944`. **D-229 holds; HG-13 does not fire:** slowest stage request
  3.10 s, whole 15-stage compiles 25.8–33.6 s (≤ 7.13 s and ≤ 48.3 s under fleet load). A sensitivity
  run with every skill group in PoB's Full DPS mode, under load, took 160.68 s with a 25.50 s stage;
  the plan schema can't request Full DPS, so the coordinator ruled the gate met for the specified
  plan and imposed requirements on WU-41 (below). The user is told.
- **WU-40** (`encode_build_code`): done `19e3140`; review PASS, no findings (encoding checked against
  PoB2's `ImportTab.lua`); rebased and reconciled with WU-31 as `19e3140`.

### Merges (integration `build-guide/build`)

`44d608e` (WU-37) → `26ecc02` (WU-49) → `2e47473` (WU-38) → `f71fa81` (WU-33) → `32e17e5` (WU-31, full
gate re-run by the coordinator on the rebased lane: rc 0, 102 suites, 1254 tests) → `1ec4944` (WU-30) →
`19e3140` (WU-40). Tools: 79, 78 without poe.ninja.

### Coordinator decisions (to fold into the spine)

- **D-239** (amends C-37): unique mode prints compact entries (name, type, base, up to 5 matched lines
  with their variant) when more than one unique is returned; full item text only for a single result.
  `{slot:"Jewel"}` had printed about 100 KB.
- **D-240** (amends C-37): mechanic mode takes an optional `kind` (`gem`, `unique`, `passive`, `mod`),
  and its header gives per-kind hit totals. Broad queries had filled every slot with gems.
- **D-241** (amends C-37): each stat set shows its base Attack Damage % and base critical hit chance
  where PoB's gem tooltip does.
- **Tool disposition lane:** every tool this epic adds uses lane `build-guide` in
  `tests/mcp/toolDisposition.test.ts`, which counts the new tools from a `BUILD_GUIDE_NEW` list.
- **Count sites:** spine §1.3 misses `tests/mcp/toolDisposition.test.ts` and the two tool-count
  sentences in README prose (about lines 21 and 60); every tool-adding unit moves them too.
- **WU-41 requirements from WU-30:** create every socket group with `includeInFullDPS=false`, with a
  test that the compiled fifteen-stage fixture has none on; if rebuilds are deferred, assert each
  stage's `outputs`/`skillOutputs` equal the non-deferred path on the fixture.

### Open items

- **Pre-existing (stab D-42):** `realPathOf` in `src/services/buildExportService.ts` (about lines
  61-76) treats a dangling symlink as its own location, so a write through a link pointing outside the
  export root would land outside. Found by WU-37; outside this epic's units. For the user to schedule.

### Friction

- Timing ACs (stab AC-F3, AC-E8, AC-T22, AC-T40) false-failed at load averages of 26–28 with seven lanes
  running suites; each passed in isolation.
- dkjson encodes an empty Lua table as `[]`, so reply schemas must accept `[]` for empty maps.
- Headless PoB's `GetTime()` returns 0; time Lua work with `os.clock`.
- PoB's `SaveDB` attribute and element order varies between processes; compare XML canonically.
- A stale `build/` makes the README table test (AC-G1) fail after a tool-adding rebase; run `pnpm build`.

### Wave gate: PASS at `19e3140`

An independent verifier ran from a clean tree (build, coverage and the Jest cache cleared):
- `mise run test` rc=0, 103 of 103 suites and 1266 of 1266 tests, none skipped, 147 s;
- `pnpm build` rc=0;
- `scripts/fresh-clone-check.sh` rc=0: 79 tools (78 without poe.ninja) and Life 2,977.

Cross-cutting checks: AC-B1 (79/78, disposition set equal, README table equal to `pnpm docs:tools`),
AC-B2 (waivers `[]`), AC-B4, AC-B5 (golden files unchanged since `a091a6b`), and AC-B7 (dependencies
byte-identical to `a091a6b`) hold. No touches violations. Per-unit AC fidelity holds, with two low
notes on the unreviewed WU-31 fix commit:
- D-239's 5-matched-lines cap per unique and its "(and N more matching lines)" note have no test. It is
  assigned to WU-32, which also extends the lookup code.
- D-241's test rebuilds its expected lines the way the code does. **D-241 wording, as folded:** values
  come from PoB's calculation merge of the effect's level and the stat set's level
  (`CalcActiveSkill.lua:792-797`). The lines use the gem header's "of base" wording, so they differ
  slightly from PoB's per-stat-set tooltip (`GemTooltip.lua:217-221`).

## 2026-10-08: waves 2 and 3 (WU-39, WU-32; WU-34, WU-35, WU-36)

WU-39 started after WU-38 merged; WU-32 after WU-31. WU-35 and WU-36 started off WU-32's head while it
was in review (they consume it only through wiring) and rebased before merging; WU-34 waited for
WU-32's review, because it consumes the coverage statuses.

### Verdicts

- **WU-39** (C1/E1 data files, loader, progress keys): done `4b61c88`. Review: the values hold against
  the pin and the grounding (monster tables at all 100 levels, 29 quest rows, Spirit, books, resistance
  penalties, Arbiter, waystones). 1 medium: a resolved fact carried its source's tag, not its own, so
  the Arbiter's fight-life input resolved at H where A-30 requires L. 4 data items. Fixed `d4d5fc5`:
  - a fact's tag is now its source's kind, ref and accessed date plus the fact's own patch and
    confidence;
  - trial 3 is available from `q.act-4-abandoned-prison-goddess-of-justice` at L (coordinator decision:
    the grounding's 60+ Barya route; no Act 1–4 area reaches level 60, and the interludes do);
  - each reward note says only what its source says (Seven Pillars is "swappable");
  - `0.5.x` on sources the grounding doesn't pin to 0.5.5;
  - passive-point facts re-sourced to the pin (`Build.lua:79-98, :1006`; 99 + 24 = 123).
- **WU-32** (`check_model_coverage`): done `8315c21`. Review: statuses agree with PoB's own parse flags
  on 2,315 of 2,322 unique lines and all 6,056 node lines. 1 medium: the "partly parsed" note said PoB
  applies part of the line, but PoB drops the whole line when there is a remainder (`Item.lua:2158`,
  `PassiveTree.lua:489`). 2 low: a zero-crossing range rolled at 0; build mode skipped tree-socket
  jewels. Fixed `afea7f4` with D-242 and D-243 (below). 27 mod names stay flagged `possibly unread`,
  down from 132. The scan finds 106 files and 18,805 names; the spec's 107/18,806 counted
  `ModParser.lua`.
- **WU-36** (`set_tree_state`, tree-jewel slots, the `update_tree_delta` fix): done `3fd22ac`. The
  coordinator rebased it as `3fd22ac`, resolving one import conflict; full gate rc 0, 109 suites, 1359
  tests. Review: no high findings; the compiler builds trees through `set_tree`, never the auto-path.
  1 medium: an add next to a weapon-set-tagged branch made PoB re-allocate the branch untagged and reset
  its attribute choices to Strength. **Coordinator decision:** restore attribute choices; refuse any
  add that would change an allocated node's weapon-set tag, after a dry run, leaving the build
  unchanged. 2 low: a remove-then-add re-route lost nodes; the ascendancy-count tests were too loose.
  The code already counts like PoB's `CountAllocNodes`. Fixed `3070336`.
- **WU-35** (`manage_sets`, loadouts, the auto-level flag): done `e96c8fa`. Review: 1 medium. A copied
  skill set shared each gem's stat-set tables with the original (PoB's `CopySkillSet` copies
  shallowly), so a skill-part change on set 2 changed set 1, and the export kept it. Fixed `0ac33f5`
  with D-244 and D-245 (below), rebased over WU-36 as `0ac33f5`; gate rc 0, 110 suites, 1406 tests.
- **WU-34** (ranker amendments): done `d93448f`. Review: 1 major. The server's 5000-char truncation
  cut the can't-measure section, which renders last, exactly at its ascendancy entries. 2 minor: the
  multiple-choice ascendancy notables appeared nowhere; the section header overstated `possibly unread`
  lines. Fixed `198888c` with D-246 and D-247 (each can't-measure reason now labelled `not applied`,
  `advisory`, `choice` or `no value`; when entries must go, the longer ranking loses them first). All
  seven deviations were accepted; `suggest_supports`' output (about 17k chars on the golden build)
  stays complete.

### Merges

`d4d5fc5` (WU-39) → `8315c21`, `afea7f4` (WU-32) → `3fd22ac`, `3070336` (WU-36) → `e96c8fa`, `0ac33f5`
(WU-35). Tools: 82, 81 without poe.ninja. WU-41 started off `0ac33f5`.

### Coordinator decisions (to fold into the spine)

- **D-242** (amends C-38): build mode includes jewels in allocated tree sockets, named
  `Jewel socket <nodeId>: <name>`.
- **D-243** (amends C-38, D-226): the name scan also counts a mod name as read when it fits a `..`
  concatenation in PoB's source. That means ending in a ≥ 6-char capitalized literal fragment, or
  matching a chain shape such as `*Can*` whose parts are scanned names. `possibly unread` is advisory,
  and the pipeline confirms it by measurement before hand-calculating.
- **D-244** (amends D-190): `manage_sets {action:"list"}` is routed as kind `read`, through a general
  per-call rule (`engineKindFor` in `toolRouter.ts`); `guide_run`'s rule joins it in WU-41.
- **D-245** (amends C-39): a set title carries at most one `{…}` tag, at its end, of non-empty
  comma-separated ids; an untitled copy drops the source's tag ("S {1}" gives "S (Copy)").
- **D-246** (amends C-47): `get_passive_upgrades` bounds its own output so no can't-measure line is
  ever cut: ranked entries lose their stat bullets first, then the lowest ranked entries go.
- **D-247** (amends C-47): an ascendancy notable with no stat lines (a multiple-choice notable) is
  listed as can't-measure, with its options.
- **C-48 wording:** ascendancy points are counted as PoB's `PassiveSpec:CountAllocNodes` counts
  (multiple-choice options and free-allocate nodes excluded), not "all allocated ascendancy nodes minus
  the start node".
- **Slice 01 §2.1:** `set_main_selection`'s reply gains an optional `statSet` (WU-33). The C-37
  amendments D-239…D-241 are recorded under wave 1.

### Notes for WU-41 and WU-42 (verified by reviewers)

- Full DPS stays off for every group; if rebuilds are deferred, per-stage outputs must be shown equal.
- Title each stage's tree spec `<name> {<one id>}`. Set the main selection after
  `use_second_weapon_set`. D-215's retitle includes tree spec 1. Never call `CopyLoadout`.
- An allocated attribute node with no choice gives no stat; V1 (or the compile) must flag it.
- WU-42: in `resistance-penalty.interlude {"54-59": -40, "60-64": -50}`, no progress key reaches the
  −40 bucket, because every interlude row is at area 61–64. A stage early in the interludes sits at the
  last Act 4 key, so V1 would expect −30. The range-string keys must be parsed.
- Trial 1's progress key lets an end-of-Act-1 stage spend 2 ascendancy points, with no level check to
  catch it.

### Friction

- Lanes started off an in-review head need a rebase onto the fixed head. The two tool-adding lanes
  (WU-35, WU-36) conflicted on every count site and on the tool lists; the second to merge reconciled.
- Subagents share the session scratchpad. Two wrote the same `probe.mjs` and `gate2.log`; use
  per-unit subfolders or `mktemp -d`.
- Timing ACs (AC-T22, AC-E8) false-failed again under parallel load.

### Merge and wave gate: PASS at `198888c`

`198888c` (WU-34) merged. An independent verifier ran from a clean tree, with the WU-41 lane running
alongside:
- `mise run test` rc=0, 112 of 112 suites and 1421 of 1421 tests, 159 s;
- `pnpm build` rc=0;
- `scripts/fresh-clone-check.sh` rc=0: 82 tools (81 without poe.ninja), Life 2,977.

AC-B1…B5 and AC-B7 hold; D-244's `list` samples run as `read`. Every review-fix test derives its
expectation independently. No touches violations. Low notes:
- D-246 didn't reserve room for notices the session prepends (no `refit`, D-53). Assigned to a WU-34
  follow-up.
- **Accepted deviation:** WU-36's file-local helpers in `BuildOps.lua` (about 250 lines beside
  `set_tree` and `update_tree_delta`) sit outside the functions §8 names; they are local to those
  functions' features and touch nothing else.

## 2026-10-08: wave 4 (WU-41, WU-42, WU-43, WU-44; WU-34 follow-up)

### Verdicts

- **WU-34 follow-up** `0d780cc`: `get_passive_upgrades` returns `refit`, so prepended session notices
  can't push can't-measure lines past C-1's cut; the tip goes before ranked entries.
- **WU-41** (compiler, `compile_plan`, `guide_run`, record, write ledger): done `92738c6`. NFR: a
  15-stage compile takes 20.9–23.0 s, slowest stage 2.25 s; per-call rebuilds are deferred, with
  per-stage outputs equal to the eager path. Two reviewers checked it.
  - **Safety:** PASS. Nothing can overwrite or lose a user file. Two lows: `runFolderOf` split on
    `\`; the guides-root overlap check was case-sensitive on drvfs. One wording item.
  - **Fidelity:** two problems.
    - High: an off-hand's legality (Giant's Blood, Instruments of Power, Lord of the Wilds) was checked
      against the previous stage's tree. Planned off-hands were refused, or dropped silently from shared
      sets.
    - Medium: PoB's `ConfigTab:Save` drops an input equal to the active set's placeholder, so
      non-active stages lost explicit options (one probe: 56 outputs differed on reload).
  - **Fixes** (`8579f07`, `408ffd9`):
    - each stage's tree, and its non-off-hand items, are calculated before the off-hands go in;
    - a `compareItems` check runs per stage and per item set; any drop is an error;
    - weapon flags are read from the measured `mainEnv.modDB`, so item-granted flags like Treefingers
      count;
    - D-248;
    - `loadoutWarnings` (PoB2's own GUI switch can still drop such an off-hand) and `saveWarnings`
      (saving the file in PoB2 drops restored options again).
  - The fidelity reviewer re-ran its probes and variants: Titan tree and item Giant's Blood, Lord of
    the Wilds, weapon swap, flag loss, a mid-stage placeholder. All compile and reload exactly.
  - **Accepted, not done:** catching an impossible shared-set off-hand in `compile_check`. It needs a
    calculation; the stage is refused at compile instead, after the loaded build is replaced.
- **WU-43** (skill, run checker, harness): done `82c2d92`. AC-W23 was met by a headless `claude -p`
  probe (Sonnet, about $0.16, strict MCP config, temp dirs): the researcher's allowlist reaches
  `lookup_game_data` directly. The handoff now allows headless sessions only for spec-required probes
  and runs.
  - **Review:** one high, two medium.
    - High: the checker chose what to recompute from the skill's own `stages[]`.
    - Medium: it passed a completed run whose gate honestly failed.
    - Medium: accepted findings matched by gate stage, not plan stage.
  - **Fixed** `dcc9e9d` with D-249 and hardening; rebased onto WU-41 as `dcc9e9d`.
- **WU-44** (research workflow): done `32630f0`.
  - **Review:** two medium. Dead R1a researchers were never re-run. R1b couldn't path a skeleton's
    tree, which starved keystone- and notable-led concepts.
  - **Fixed** `962d0b6`:
    - R1a retries;
    - R1b may run one bootstrap measure-only compile of a tree-minimal skeleton, then path with
      `find_path_to_node`;
    - R1a foci table in R1a.md: mechanics 0–1 skill- or support-led concepts, items 1–2, tree 1;
      at most 3 carried;
    - the discovery calls named;
    - validate before pricing;
    - retries keyed by stage, concept, round and researcher;
    - an unreachable-trade `Standard` league marked `leagueUnverified`, which D1 must not inherit.
  - AC-W18 reads now as "R1a attempts with outcome `done` equal the research files".
- **WU-42** (V1/V2, config baseline): done `3bf2ad2`.
  - **Review:** two medium.
    - Persistent minion skill gems (e.g. Skeletal Brute, tier 13) were classed as Spirit gems and
      escaped the tier check.
    - Skill-conditional default-on options (e.g. `FlickerStrikeBypassCD`) were baseline
      unconditionally.
  - **Fixed** `c3dba2e` with D-250…D-252. All nine deviations accepted, among them the widened
    placeholder rule (D-212), quest checkboxes in the baseline list, and the Martyr-point warning
    filter.

### Merges

`0d780cc` (WU-34 follow-up) → `408ffd9` (WU-41) → `dcc9e9d` (WU-43) → `962d0b6` (WU-44) → `c3dba2e`
(WU-42). Tools: 84, 83 without poe.ninja. WU-45 started off `962d0b6`.

### Coordinator decisions (to fold into the spine)

- **D-248** (amends §3.6 step 9, D-212): the compiler puts every listed config option PoB's save
  dropped back into its stage's ConfigSet in the exported XML, and checks each survives. `saveWarnings`
  names options a re-save in PoB2 would drop.
- **D-249** (amends D-116, D-147): tree jewels count toward the budget. Each filled slot or jewel needs
  a distinct price entry unless the item text is identical. Totals are compared at 2 decimals.
- **D-250** (amends D-230, V2): a skill-conditional config option is baseline only while PoB hides it
  for the stage. A shown, default-on, unlisted option is `default-unlisted`.
- **D-251** (amends V1): at a region's last progress key, the next region's entry penalty is also
  accepted, with a note.
- **D-252** (amends V2): on a boss-scenario stage, the enemy level, armour, evasion, resistances and crit
  options are scenario entries citing E1, never baseline.
- **R1 rules** (amend slice 03 §5): R1b may run a bootstrap measure-only compile. The R1a foci split
  lives in R1a.md. Retries are keyed by round and researcher.
- **Run-checker rules** (amend FR-W7): the concept comes from the gate report files. A completed run
  fails on any recomputed or reported gate failure not covered by an accepted finding. Findings are
  equal by plan stage, part and code.

### Wave gate: PASS at `c3dba2e`. **M-11 exit: PASS.**

An independent verifier ran from a clean tree:
- `mise run test` rc=0: 121 of 121 suites and 1685 of 1685 tests (173 s), then the NFR step, 2 of 2
  (67 s);
- `pnpm build` rc=0;
- `scripts/fresh-clone-check.sh` rc=0: 84 tools (83 without poe.ninja), Life 2,977.

**NFR:** a 15-stage final compile takes 23.64 s (limit 100 s, NFR-20); the slowest stage request is
2.23 s (limit under 20 s, NFR-21); deferred outputs equal the eager path on every stage, and Full DPS is
off.

**M-11 items:**
- every AC-P maps to a passing test;
- the two-stage fixture compiles to one loadout per stage, with nothing titled `Default`;
- it reloads with Life and CombinedDPS within 1e-9;
- its import code round-trips;
- V1 and V2 pass;
- AC-B6 and AC-B8 hold;
- WU-30's report is committed.

AC-B2…B5 and AC-B7 hold. No touches violations. Low notes:
- AC-P50's expected class predates D-250 and D-252; it holds only for the non-boss fixture, and AC-P42
  tests the amended rule.
- D-251 accepts only the two boundary values; an area-60 interlude zone before the first interlude key
  is an edge case.
- The pipeline fixtures' compile records are hand-written, but match the real record's shape for every
  field the checker reads.

## 2026-10-08: wave 5 (WU-45, WU-46)

### Verdicts

- **WU-45** (design-and-write workflow, writer, D1/D2/W1 references, guide template): done `f110d92`.
  - **Review:** two medium findings.
    - An accepted V3/V4 escalation returned `ready` without re-running W1, so the guide hid the
      failure and the checker failed the run.
    - The floor compared max hit taken against UNMODDED T15 hits, about 19% low, and never gated the
      waystone's extra elemental damage.
  - **Fixed** `1c233d6` with D-253 and D-254, plus:
    - a respec line in the endgame sections;
    - "each capped" conditional on there being no chaos exception;
    - informational findings no longer counted as failures;
    - `resume.attempts` required;
    - an unverified league kept and stated.
  - The run checker's floor recompute now applies D-254's rules, and the pipeline fixtures were
    regenerated.
- **WU-46** (V3 provenance, V4 verifiers, §5.5 routing, checkpoint-2 revision): done `f04b1ad`.
  - **Review:** independence (R-5) holds on every path. Two medium findings:
    - an accepted finding matched by id only, so a reused id excused a different issue;
    - W1 wasn't told to write anew after a D1/D2 re-run in the same round.
  - **Fixed** `a6e4d50` with D-255, plus:
    - equality by report, id, artifact and location section;
    - `accepted-offline` only from the sources lens for `external-unavailable` claims;
    - offline reports open no sources;
    - a test that revision text never reaches V3/V4.

### Merges

`1c233d6` (WU-45) → `a6e4d50` (WU-46).

### Wave gate: PASS at `a6e4d50`

An independent verifier ran from a clean tree:
- `mise run test` rc=0, 121 suites and 1846 tests, plus the NFR step (24.57 s, slowest stage 2.25 s);
- `pnpm build` rc=0;
- the fresh-clone check rc=0 (84/83 tools, Life 2,977).

AC-B1, B2, B5 and B7 hold; allowlists name no trade or mutating tool; 138 backticked repo paths and
17 data facts exist. AC-W8…W14, W24 and W25 are faithful. The run checker passes its own fixtures,
and the regenerated fixtures are consistent (hits equal their ledger values; the online budget is
21.5 divines with "near the ceiling"; D-234 holds). The verifier's own harness run validated every
scripted result against its schema, and showed resume is deterministic.

### Coordinator decisions (to fold into the spine)

- **D-253** (amends §5.3, §5.4): on resuming after the user accepts a V3/V4 escalation, W1 re-runs once
  with the accepted findings (outside the cap). V3 and V4 then run with them covered by id. Their
  headers carry only gate, id, artifact and location.
- **D-254** (amends D-119, D1, the D1 gate, FR-W7): each endgame stage has five reference hits
  (physical, fire, cold, lightning, chaos). Each is waystone-scaled at the top of its modifier ranges,
  at area 79 for the budget variant and 82 for the non-budget variant, and equals a ledger entry
  `hit_<stage>_<type>`. The D1 gate and the checker require all five and their equality.
- **D-255** (amends FR-W7): under `--partial`, rule (l) (unresolved findings) is skipped for an
  `escalated` or `stopped` run whose escalation recorded the finding. Offline reports open no sources.
- **Finding equality** (amends §5.4): accepted V3/V4 findings cover only findings with the same
  report, id, artifact and location (a guide location compared by its section). Verifiers never reuse
  an accepted id. `accepted-offline` is allowed only from the sources lens, for a claim tagged
  `external-unavailable`.
- **Run-log rules:** dossier-fix logs its retries as its own stage (spec §5.5 says it counts as R1b);
  revision retries are keyed by round; resumes carry `retries` and `attempts`.

### The user's decision for WU-47 (2026-10-08)

The offline end-to-end run uses **Sonnet** in its headless session. M-12 tests the pipeline's
mechanics, not guide quality; the live run (WU-48) uses the user's default model.

### Risks the gate flagged for WU-47

1. The run folder sits under the temp guides root, outside the worktree, so the headless session needs
   `--add-dir <guides root>` (or matching allow rules), or agents can't read and write it.
2. Structured output through a custom agent type with a `tools:` allowlist is unproven live. So are
   the nullable type arrays and an empty-properties schema. If they fail, every agent returns null.
3. Run B ends with a default `stop`, so the accepted, guided-retry and revision resumes get no live
   evidence.
4. FI-3 in run B forces `infeasible` only if c1's D1 gate returns at all; that depends on agent
   behaviour.

## WU-47 (2026-10-08)

- Dispatched one runner agent at integration head `d4a2175`: worktree `bg-47`, Sonnet headless sessions,
  strict MCP config, temp dirs, web tools denied, cost caps as a runaway backstop ($3 per probe, $80 run A,
  $50 run B). It probes structured output and the Workflow tool first, then does runs A and B, the seeded V4
  check and the probes. Record: scratchpad `wu47/record.md`.

### WU-47 attempt 1: M-12 not met (runner record `wu47/record.md`, head `c0510ae`)

- **Cost:** $34.25 on Sonnet. Run A $14.50, plus $5.18 for its first attempt, which the platform killed;
  run B $11.31; probes $0.09–0.27 each; the seeded check $2.10.
- **PASS:** AC-W4, W15, W16, W20, W21.
- **AC-W22:** every H2 is present and complete; followability is a quality miss.
- **FAIL:**
  - AC-W17: check-run rc 1, 41 violations; 36 unresolved V4 findings (quality).
  - AC-W18: run A ended `stopped`.
  - AC-W19: one clause; `--partial` rc 1, no attempt times stamped in agent-tool mode.
  - AC-W26: one clause; the invalid-skill reply lists no closest names, because the lookup is
    substring-only.
- **Blocker F1, a code/spec conflict.** D-254 has each reference hit equal its ledger entry at 2
  decimals, but PoB types `enemy*Damage` as `countAllowZero` (whole numbers; the vendor's
  `ConfigOptions.lua:2267-2275`, mirrored by `BuildOps.lua:764`). Every D1 floor fails.
  - **D-256 (coordinator):** reference hits are whole numbers. The scenario value is the ledger
    entry's value rounded **up** (conservative for the survival floor). The D1 gate, check-run and V4's
    ledger lens compare against that ceiling. `<Type>MaximumHitTaken` must exceed it. This amends
    D-254.
- **Platform friction:**
  - F2: `claude -p` kills background workflows 10 min after the last turn; set
    `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`.
  - F3: Workflow lookup depends on cwd (the runner `cd`'d into the run folder).
  - F4: Workflow results reach the main loop truncated.
- **Other findings (F6–F11) go to triage:** a stray W1 file, checker tolerance, claim count, pricing
  totals, D1 re-run overwriting the final compile record.

### WU-47 triage (read-only verifier; `wu47/triage.md`)

- **Clusters behind the failures:**
  - Run A's 41 violations: 19 V4 ledger findings (F1 fallout); 17 real V4 findings; 2 claim counts
    (a checker bug, F8); 1 rolled-skill tolerance (a checker bug, F7); 1 stray file (F6); 1 status
    (expected for a stopped run).
  - Run B's 34 violations: all null attempt stamps in agent-tool mode (F5).
- **The 17 real V4 findings:**
  - Two code bugs:
    - `lookup_game_data` omits PoB's gem `Tier`;
    - V1 lets a tier-7 gem sit at gem level 5, below the tier rule's floor.
  - One prompt gap: W1 is sent to the dossier for why the concept won, but that reason is in the run
    log.
  - 14 agent misses, which V4 correctly caught. The revision loop would have routed them if the run
    had continued.
- **Refuted:**
  - F8 as a V4 miscount: the checker counted after D1 retagged a claim.
  - F10 as a defect: a routed re-run ends with a final compile by design.
- **F4 (truncated results):**
  - The task notification's result is cut at about 10K characters; the full result is in its
    output file.
  - The runner copied 13 of 14 reports exactly; only the 10K import code got a placeholder.

**Coordinator decisions (2026-10-08):**

- **D-256 (refined).** The reference-hit scenario value is `ceil(round2(ledger value))`. `round2`
  absorbs float32 noise in the inputs (402.0000030 must not become 403). The guide quotes the ledger
  value; the config holds the ceiling.
- **D-257.** The writer agent gets `Edit`, so it can fix a guide without rewriting it whole (F6).
- **D-258 (amends C-37).**
  - When nothing matches, `lookup_game_data` replies with up to 5 closest names of the queried kind,
    in a fixed order.
  - Gem entries show PoB's `Tier`.
  - The skill's invalid-roll refusal quotes those names (AC-W26).
- **D-259.** V1 enforces the gem tier floor: a gem's level must be at least its tier's floor (the
  `gems.json` cut rule). Before this fix, V1 checked only that the uncut gem was available.
- **D-260.**
  - The D2-gate verdict and the run log's `outputs` drop `importCode`; the compile record is its one
    home.
  - The skill runner Reads the notification's output file when a result is truncated.
  - Considered and rejected for now: a deterministic save-reports script. The task output file's
    format isn't a documented contract.
- **D-261.** `pricing.totals.unavailable` counts every `unavailable` `prices[]` entry across every
  plan the run wrote, and check-run checks it.
- **D-262.** Under `--partial`, check-run skips the V4 claim-count rules when a plan-changing step ran
  after the last V4 pass.
- **F2 and F3** go into the headless recipe and SKILL.md:
  - set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`;
  - the runner's Bash is only `date` and the checker, with no `cd` and no compound commands.
- **F5.** `fallback.md` gets a concrete attempt-stamping procedure.
- **Quality prompts.** Only the triage's general one-line rules (§5.4) go in, no run-specific facts.

**Fix lanes:**
- **Lane P (pipeline):** the triage's L1 (checker), L2 (stage references and SKILL.md) and L3 (compact
  design result) together, in `bg-47p`.
- **Lane S (server):** L4 (the lookup tool) and L5 (the V1 tier floor), in `bg-47s`.

### D-263 (the user's ruling, 2026-10-08): no headless sessions

The tool is meant for interactive use, so a headless `claude -p` run is not a real-world test, and we
don't fix headless-only issues.

- **Withdrawn:** F2, the env var for the 10-minute background kill. The handoff's headless exception is
  replaced by "never start one".
- **WU-47's runs:** interactive sessions the user starts in the isolated environment, with the strict
  MCP config and temp dirs. The kept evidence is the same: transcripts and journals.
- **Kept, because they happen interactively too:** F3 (`cd` breaks workflow lookup), F4 (truncated
  workflow results) and F5 (fallback stamping).
- **Lane P** was told to amend WU-47 step 3 in `03-pipeline.md`.

### WU-47 fix lanes: results so far

- **Lane S** (`bg/wu-47s`, e2fdc8a).
  - **Doer gate:** test rc 0 (1852), build rc 0.
  - **Review:** no high findings. The tier rule, the exemptions, a deterministic ranking and the test
    fidelity all checked clean.
  - **Fixes sent back to the doer:**
    - **(med) D-258a:** gem-mode suggestions with supports mixed in can hold no valid roll ("Ruthlss"
      gives 5 supports). Gem mode now lists up to 5 closest active gems, then up to 3 closest supports
      under their own header.
    - **(low)** Suggestions are computed only for queries of at most 100 characters. A 6K-character
      mechanic query would pass the 30 s engine timeout.
    - **(low)** Revert the fifteen-stage fixture edit: it didn't make that fixture valid.
- **Lane P** (`bg/wu-47p`, 755538a).
  - **Doer gate:** test rc 0 (1885), build rc 0. AC-F3, T22 and T40 false-failed under load and passed
    alone.
  - The reviewer is running.
- **Lane S merged** at `850f1a8`. Its review fixes are done: D-258a's two groups (5 active, then 3
  support), suggestions only for queries of at most 100 characters, and the fixture edit reverted.
  - Coordinator check after the rebase: build rc 0; 87/87 in the affected suites; waivers `[]`;
    dependencies unchanged.
- **Lane P** review: no high findings and five low ones, all fixed.
  - **D-262 skip conditions:** R1b-assemble is added, and the skip fires only for an attempt that
    wrote (`done` or `infeasible`) for the covered concept.
  - **W1** returns no import code (D-260).
  - **Checkpoint entries** record `rule` for pre-supplied and default answers, and V4's prose lens
    checks "why this concept" against it.
  - **Pipeline fixtures** are valid under V1 and D-256.
  - Lane P merged at `c3e8447`. Doer gate: test rc 0 (1901), build rc 0. Coordinator check: build
    rc 0; 330/330 in the affected suites.
- **To fold in:** the checkpoint `rule` field into slice 03's §6 table.
- **Gate after the fix lanes: PASS at `ce69ce0`** (independent verifier).
  - test rc 0: 121 suites, 1901 tests, plus the NFR step (15-stage compile 24.8 s, slowest stage
    2.37 s).
  - build rc 0.
  - Fresh-clone check rc 0: 84/83 tools, golden Life 2,977.
  - Waivers `[]`; dependencies unchanged.
  - Fidelity sample: D-256, D-258/258a, D-259, D-260 and D-262 each assert the decision through the
    real path. Minor gap: D-262's `infeasible` outcome and a dossier-fix logged under another concept
    are untested.
  - No drift.
- **The WU-47 re-run is interactive (D-263)** in worktree `m12`, branch `bg/m12`. Sessions, in order:
  - P1, with Workflow and Agent denied: the invalid-roll refusals and AC-W4;
  - run A;
  - run B;
  - P2, with its own builds folder holding the fixture: AC-W21, AC-W15 on a seeded copy of run A
    outside the guides root, and AC-W26's unsaved build.

### WU-47 attempt 2 (interactive, D-263): analysis, before fixing (2026-10-08)

**Sessions** (worktree `m12` at `815a457`, env `/tmp/m12.DbTF`):
- P1 probes: invalid rolls and AC-W4.
- Run A (`-2`): $19.86, 38.2M cache read, 417K output.
- Run B (`-3`): about 27.9M cache read, 146K output.
- P2 (AC-W15, W21, W26 unsaved) not run yet.

**Passed:**
- AC-W4, AC-W19 (run B: all clauses; F5 stamping works), AC-W26 (both invalid-roll refusals; the skill
  refusal quotes D-258a's active names).
- AC-W16 and AC-W20 for these sessions.
- Run A's checker has 7 violations, down from 41. Every earlier fix held: D-256, D-257, D-258, D-260,
  F3, F7. D-259 and D-262 weren't triggered.

**Run A escalated in the V3/V4 revision loop after pass 3**, not at a gate. Root causes:
- **RC-1: the loop doesn't converge.** All 9 findings raised in passes 2 and 3 were in text pass 1 read
  and passed (findings per pass: 12, 3, 6). Why:
  - V4 samples 1 in 5 non-endgame claims;
  - check depth is undefined;
  - no rule says what a marker covers;
  - owners fix by location;
  - FI-2 spends a D1 retry (RC-6).
- **RC-2…RC-5: agent misses with prompt gaps.**
  - An unmarked dossier sentence, copied by R1b-assemble.
  - A claim resting on two facts cites one.
  - A low-confidence note stated as settled; the rule exists only in D2.md.
  - **The guide calls the explosion figure PoB's headline.** D1 never sets `main.statSet`, so the PoB
    file opens on the Dash set.
- **RC-6: FI-2 burns D1's routing budget.** The spec's own AC-W18 clauses conflict.

**Run B and P1 findings outside the ACs:**
- B1: the escalation findings in the run log aren't verbatim.
- B2: a D1 coordinator wrote `gen.py` to the session scratchpad.
- B3: `compile_plan` shows at most 10 findings per stage, and the record (268 KB) is over Read's cap,
  so gate findings were incomplete.
- B4: the fallback runner read both workflow scripts.
- B5: the run log went stale in fallback mode.
- B6: bare `guide_run` calls.
- P1-a: with neither Workflow nor Agent, the log says `orchestration: workflow`.
- Run A: D-261's count was taken with 2 `grep` calls outside the Bash rule.
- Run A: the FI-1 timing wording disagrees between `R1b.md` and `offline-and-test.md`.

### Amendment 1 approved (2026-10-08): a simpler pipeline

The user approved S1…S9 (`spec/amendment-1-simplify.md`, 829bccf) and confirmed dropping workflows.
- **S1:** one orchestration path; the session calls agents directly.
- **S2:** verify once, fix once, re-check, and report the rest as known issues; no verification
  escalation.
- **S3:** the dossier isn't verified.
- **S4:** a slim run log, with no timestamps.
- **S5:** the checker checks artifacts.
- **S6:** injected faults are free on attempt 1; a persistent fault's attempts count.
- **S7:** keep the stat-set fix, every finding printed, `mcp__pob2__` tool names and three claim rules.
- **S8:** WU-47 rewritten.
- **S9:** the re-run uses Opus.

The coordinator settled Q1…Q5 as the amendment proposed. The fold-in to the spine and slice 03 waits
for finalization, together with D-239…D-263.

**Accepted cost of S1.** Nine ACs whose tests were the workflow harness (W3, W6–W10, W13, W24, W25)
lose automated tests. The control flow now rests on SKILL.md. The checker verifies its invariants from
each run's log: caps, order, one verification pass and one re-check, escalations only from gates.
- **Amendment 1 implemented** in `bg/amend-1`, head 93b3438: +2.8K/−8.6K lines. Doer gate: test rc 0
  (1,783), build rc 0.
- **Review: 1 high, 5 medium, 4 low, all sent back.**
  - **High:** the D1 gate recompute was skipped unless the gate compiled. Only `budget` may be
    `unverified`.
  - **Medium:**
    - the stat-set check could be bypassed: tie `main.group` to `rolledGroup`, and check the stat set
      inside ledger formulas;
    - routing wasn't tied to the verdict files;
    - S6's free retry came from `faults[]` alone;
    - legal routes failed once a guide existed;
    - a guide rewritten in the fix round went unverified. If any design step re-runs, the re-check is a
      full pass, still with no second fix round.
  - **Low:**
    - D-256 hits must be tied to the stage's area level;
    - `completed` requires checkpoint 2 to be answered accept;
    - `compile_plan` prints at most 200 findings, then says to Grep the record;
    - two reference disagreements: the D1 gate's writes, and the guided-retry rule.
- **Amendment 1 review fixes done** (doer gate: test rc 0, 1,810; build rc 0). The reviewer's probes
  p1–p6 and p9 now fail as intended; p7 and p8 pass.
  - **Deviations accepted:**
    - budget `unverified` is allowed online too (D-164: an unavailable price);
    - a forced `infeasible` is valid with FI-3 in `faults[]` plus the gate's `forced` field;
    - the rolled figure must also name `main.activeSkill`;
    - a fix round re-runs all three lenses whenever D1 or D2 re-ran.
  - Merged by rebase and ff at `7558988`. Coordinator check: build rc 0; 270/270 in the affected
    suites.
- **Gate after amendment 1: PASS at `499b1f2`** (independent verifier).
  - test rc 1 with only AC-T22 failing on time (8.48 s against 8 s); it passed alone, so it's a tooling
    false-failure. 1,809/1,810 tests.
  - build rc 0. Fresh clone rc 0: 84/83 tools, golden Life 2,977.
  - Waivers `[]`; dependencies unchanged.
  - Every review probe behaves as intended.
  - Fidelity holds for review items 1 and 3–6, and SKILL.md is coherent.
  - Two nits fixed in 96bdb05:
    - the runner has no Grep tool, so step 14 Reads from W1's returned `known-issues-line`;
    - the D1 gate reads the pricing state from the log itself.
- **The re-run environment** is rebuilt as worktree `m12b` at the new head, with a fresh temp root and
  model `opus` (S9). The attempt-2 evidence stays in `/tmp/m12.DbTF` and worktree `m12`'s transcripts.
- **Friction (launcher):** Claude Code warns that a `Write(path)` deny rule matches nothing, because `Edit(path)` rules cover every file-editing tool. The launcher dropped `Write(//mnt/**)`. Attempts 1 and 2 were still protected by their `Edit(//mnt/**)` rule, and the AC-W20 scans found no `/mnt/` path.
- **WU-47 attempt 3 (Opus):** run A `completed`; run B `escalated` (default stop, as expected); P1 done. AC-W15 seed: a copy of run A in `/tmp/m12b.B0zi/seed`, with FI-4 doubling ledger `mana_4_balance` and FI-5 setting the log mode to online. P2 is next.

### WU-47 attempt 3 (Opus, amendment 1): results (2026-10-09)

**Cost:** P1 $1.08, run A $77.05 (2h12m, 27 agents, 107M cache read, 817K output), run B $32.29,
P2 $21.55. Total $131.97. Amendment S9's estimate of about $32 for run A was wrong; it rested on
unverified list prices.

**PASS:**
- AC-W4, W15 (the ledger lens flags `mana_4_balance`; all 6 external-unavailable claims are unresolved),
  W16(a, b, d), W20, W21, W26 (all three).
- AC-W18, all clauses: run A `completed`, the free FI-2 re-run, both checkpoints pre-supplied with
  `rule`.
- Most of AC-W17: the build file equals the import code and the guide, 8 loadouts, V1/V2 pass, every fixed
  finding passes its re-check, and every open finding is listed under Known issues.
- **AC-W19 clauses passing:** no-viable display, D1 ×3 then escalation, default stop, no builds file.
- **Amendment 1 followed:** one full pass; one fix round (D1 → gate → D2 → gate+final → W1); a full
  re-check with `changed: "all"`; 5 open findings listed as known issues.
- **S7 stat set fixed:** the PoB file opens on the explosion stat set the guide quotes.

**FAIL:**
- **AC-W17, checker rc 1:** `check-run.mjs:754-762` checks the full pass's accepted-offline locations
  against the plan after the fix round moved those claims. A checker bug.
- **AC-W19, two clauses:**
  - checker rc 1 on a stray `scratch-note.txt` written by D1 c2 a1, outside its `writes`; the limit is
    enforced only in prose;
  - the second checkpoint-1 display (FI-3's evidence) was skipped for a pre-supplied answer;
    `checkpoints.md` doesn't say the display still prints.
- **AC-W16(e):** passes once this list is recorded. Non-checker Bash in run B's runner: `ls`,
  `cd … && cat …`, `cd`. In P2's runner: `cat` and `ls` of prompts and config. Two coordinator Bash
  attempts were refused.
- **AC-W22:** Campaign rewards is incomplete. The guide lists the 8 reward choices and picks none (re-opens
  D2, then W1).
  - Followable from level 1 to 62. Gaps from there:
    - no bridge from 62 to 90;
    - tree nodes unnamed and without a why;
    - gem levels against character-level requirements;
    - survival advice.
  - Known issues are written in pipeline jargon.

**Other:**
- The verifiers' recall still varies: W15's fresh pass found 5 sources findings that run A's re-check
  didn't, including an off-list host in a scenario source.
- A `/effort` during run A's setup saved `xhigh` as the user's default.

### The user's direction after attempt 3 (2026-10-09)

The user is on a subscription: report costs in tokens, not dollars.

**Now:** fix the small items without a full re-run, and change the fix round to fix claims in place
(D-264). Then close M-12 with recorded exceptions.

**D-264, claims fixed in place.**
- In the fix round each owner (D1, D2 or W1) edits the claims its findings name in place, with Edit:
  wording, citation, caveat or source. It recompiles only when a finding needs a build change (gear,
  tree, gems, config, scenario or ledger).
- **No recompile:** the gates don't re-run, W1 patches the guide in place, and the re-check is
  targeted: the raising lens, its findings and the changed locations.
- **A recompile:** the gates run as now, W1 still patches in place, and the re-check is full, the
  current rule. That path should now be rare.
- **Why:** in run A the claim-level fixes cascaded into a full redesign, a guide rewrite and a full
  re-check: about a third of the run's 107M cache reads.

**Small items (D-265):**
- (a) Checker: check the accepted-offline locations of a superseded full-pass report against its own
  plan, not the post-fix plan (`check-run.mjs:754-762`).
- (b) `checkpoints.md`: a pre-supplied answer still prints the display, including checkpoint 1's
  comparison lines and an infeasible concept's evidence.
- (c) Campaign rewards: D2 picks every reward choice with a one-line reason, and W1 writes the picks.
- (d) Known issues: W1 writes each as a plain sentence the reader can act on, with the finding id in
  parentheses.
- (e) The runner's Bash may run read-only commands and the checker. Never a network client, never a
  write. F3's `cd` rule went with the workflows.
- (f) R1b applies FI-1 before its first compile, so a failed concept leaves no clean record.

**Recorded exceptions for M-12** (no re-run):
- the stray `scratch-note.txt` in run B, which the checker caught: D-177 holds by prompt only;
- verifier recall varies between passes: a fresh pass found 5 more sources findings.

**Next agenda, in order:**
1. Endgame content: the bridge from 62 to 90, tree points named with reasons and an order, gem-level
   timing, survival-first advice.
2. The precision dial: is it set too high? A human guide is mostly judgment.
3. Tune length, specificity and topics against specific human-written guides.
4. Study creative builds that use less popular skills, for inspiration.

### D-264 and D-265 lane (`bg/d264`)

- **Doer:** 3e1c4df, gate rc 0 (1834). Earlier coordinator changes:
  - (d) `reader` sentences come from V4, and the runner writes Known issues. No extra W1 call: W1 is the
    heaviest step.
  - `reader` is required only on unresolved findings.
- **Review:** 1 high, 3 medium, 4 low, all sent back.
  - **High:** a claims-only fix could swap gear, gems or tree undetected; no lens compares them to the
    PoB file.
    - **D-266 (coordinator):** the compile record gains `buildSha1`, a hash of the plan with claims,
      sources and tags removed. When a claims-only owner ran, the checker requires the current plan's
      projection to equal it. An additive C-33 field.
  - **Medium:**
    - (a)'s skip is narrowed to superseding reports that checked everything;
    - (c) reward picks apply to the endgame stages too (D1 carries them);
    - the sources lens always re-checks the changed locations.
  - **Low:**
    - the runner replaces the Known issues list, and the checker forbids extra lines;
    - wording fixes;
    - an exhaustive Bash allowlist;
    - behavioural tests replace the tests that grepped the checker's own source.
- **D-264/D-265/D-266 lane merged** at `0771ede`. Coordinator check: build rc 0; 282/282 in the
  affected suites.
  - **Doer deviations accepted:**
    - the projection keeps `ledger[].claim`, `respec.note` and `chaosResistException.reason`, so edits to
      those take the recompile path;
    - D2 writes the reward picks onto the endgame stages, and D1 keeps them;
    - a raising lens that skips its re-check fails.
- **Gate: PASS at `0771ede`** (independent verifier).
  - test rc 0: 120 suites, 1,842 tests, plus the NFR step. build rc 0.
  - Fresh clone rc 0: 84/83 tools, Life 2,977.
  - Waivers `[]`; dependencies unchanged.
  - Every review demo now fails on its rule: gear, gem, tree, price and ledger swaps under a claims-only
    edit, the stale accepted-offline location, the endgame pick, and stale Known issues lines.
  - Fidelity holds for D-266 and items 3 and 4.

### M-12 exit (2026-10-09): met with recorded exceptions, closed by the user's direction without a re-run

The offline pipeline runs end to end in the user's interactive session (D-263), on the single
orchestration path (amendment 1). Evidence is attempt 3 on Opus (`/tmp/m12b.B0zi`), re-checked by the
merged checker. Each AC:

**Passed:**
- AC-W4, W15, W18, W20, W21, W26;
- W16(a, b, d);
- W16(e): the non-checker Bash commands are listed in this work-log, and none is a network client;
- W17, except the checker clause.

**AC-W19:**
- pass: everything except two clauses;
- the second checkpoint-1 display (D-265 b): fixed in the references, not yet verified live;
- check-run rc 0: exception E2 below.

**AC-W22:** every H2 is complete except Campaign rewards, which D-265 (c) fixed and enforces in the
checker; not yet verified live. Followability is a quality gap, carried to the endgame-content agenda.

**Recorded exceptions:**
- **E1.** Run A's checker gives rc 1 on 8 `[campaign-rewards]` (the real defect, since fixed) and 41
  `[report-shape]` (reports written before `reader` existed).
- **E2.** Run B's stray `scratch-note.txt`. The checker caught it; D-177 holds by prompt only.
- **E3.** Verifier recall varies between passes: a fresh pass found 5 more sources findings, including an
  off-list host cited in a scenario source.
- **E4.** D-264's claims-only path, D-265 (b)/(c)/(d)/(e) and D-266 are verified by tests and the review
  demos, not by a live run. WU-48 will be their first live run.

**Next:** the user's agenda: endgame content, the precision dial, tuning against human guides, creative
builds. Then WU-48 (HG-14) and finalization, which includes folding D-239…D-266 and amendment 1 into the
spine and slice 03, plus C-33's `buildSha1`.

### Guide style, after comparing Fubgun's Lightning Arrow Deadeye guides (user, 2026-10-09)

- **The finding.** Ours runs about 9,800 words of body plus 2,500 of sources: roughly 3× both Fubgun pages.
  - It has a marker every 16 words, "confidence L" 49 times, and the same caveat in every stage.
  - In the user's words, it "reads more like an enterprise architecture design document than a video
    game guide".
- **Settled by the user:**
  1. **Two layers.** The reader layer is the guide. An audit appendix holds sources, hand calculations,
     model coverage and known-issue ids. It is kept for agents, and no human is expected to read it.
  2. **Verify only what carries weight:** plan numbers, and the mechanics the build depends on. Advice
     and rules of thumb are labelled as advice and not verified.
  3. **Each caveat once,** where it matters. No per-sentence confidence labels.
  4. **Length:** 2,000–3,000 words for the reader layer.
  5. **Not a game tutorial.** Mention a game mechanic only when it bears on this build's synergies,
     constraints or requirements. Basic game knowledge (for example "an uncut gem of level N cuts tier N
     or lower") is cut.
  6. **Keep our strengths, short:** survival numbers as a verdict, the stage-matched PoB file, the
     ascendancy and trial timing, gem timing, reasons for choices, FAQ.
- **Adopt from Fubgun:**
  - fallbacks ("if you lack X, use Y") and swap rules of thumb;
  - support, link and quality priority;
  - per-slot affix targets and buy order (trade links online);
  - campaign practicals: boss order, currency habits, keeping gold for the respec;
  - variants with gates, including an "entering maps" loadout as the bridge to the endgame.
- **Held back:** crafting recipes. They depend on orb mechanics our data doesn't cover. No atlas section.

### Amendment 2 approved (2026-10-09): guide style

`spec/amendment-2-guide-style.md`, 8fd8261. The user approved:
- **The lighter verification.** The plan holds the facts, verified as today. The prose lens reads
  `guide.md` like an editor. The checker keeps structural guards plus a fixed-form survival and damage
  verdict line per endgame rung, matched against the record.
- **The open questions:**
  - Q1: the entering-maps rung's budget is 5 divines (players finish the campaign with 5–10);
  - Q2: the first person marks advice;
  - Q3: one tree track from `m` to `b` to `n`, with V1 checking respec gold;
  - Q4: affix targets as text, with links deferred to WU-48.
- **The targets:** about 70–90 stage claims instead of 232, and an estimated 11–14M V4 cache reads instead
  of 37.6M.

Not implemented yet. The user will supply more guides to compare, then off-meta builds. Never pick or fetch
sources unasked: a Maxroll read I started on my own was stopped by the user.

### Guide comparison 2: ronarray's Martial Artist Monk (user-supplied, 2026-10-09)

- **Sources:**
  - Mobalytics `martial-artist-monk-build-league-starter-to-endgame`, all 8 tabs, read through Playwright;
  - its 14 linked YouTube videos, fetched with yt-library: 6 build, 2 crafting, 5 farming, plus the
    embedded build video.
  - Three agents did the reading, about 430K subagent tokens on Opus.
- **The page:**
  - 8 loadout tabs, from Lvl 1-23 through Uber. The default tab has about 2,050 prose words; all tabs
    hold about 3,500–4,500 unique words.
  - Mostly gut feel, about 12 numbers. First person throughout. No tutorial content.
  - Inconsistent: three different ascendancy orders, and gear prose copied into 5 tabs with drift. Our
    rule that the guide renders the plan prevents both.
  - Commenters ask for benchmarks, which supports keeping our survival and DPS verdicts.
- **The videos carry the precision:**
  - Thresholds come as a floor, a target and what he did (for example Chaos Inoculation at 4k energy
    shield, better 6k).
  - Swap triggers are items you own or panel stats, each with an "until then, keep X".
  - Each "why" is a mechanism plus one number.
  - He never opens PoB; all his numbers come from the in-game panel.
  - Farming and crafting are generic: they fail the swap test (G4) and stay out.
- **Checked:**
  - **Trinity.** PoB models it only through a user-set "Total Resonance Count", capped at 300
    (`ConfigOptions.lua:673`).
  - **Chaos Inoculation.** It is already a named exception reason under D-234, so no gate change is needed.
  - **Desecrated mods.** Arcane Surge on Crit is desecrated and rolls only on gloves with energy shield
    (`ModVeiled.lua:163`). Our lookup names the mod table, but not base weights or essences.
- **Proposed amendment-2 changes,** awaiting the user. "Clear" means an obvious improvement; "judgment"
  means a user call.
  - **P1 (rules):** each caveat ends with its fallback. Clear.
  - **P2 (§6, §8–10):** triggers are stat or item thresholds with an "until then". Clear.
  - **P3 (§2):** the loadout ladder on one line with triggers, and "items are stat examples". Clear, about
    +40 words.
  - **P4 (§5):** a "when you're short" line covering the spirit drop order and mana fixes, checkable in
    PoB. Clear, about +40.
  - **P5 (§8, §9):** a numbered upgrade order for `m`; each buy step gets a reason; the fallback column
    becomes "affix to drop first". Clear, about +50.
  - **P6 (§4):** hold and save rows: gem level caps with a reason, and what to stockpile before a swap.
    Clear, about +20.
  - **P7 (G5):** the gate into `b` may be a key rare with a stat floor, not only a unique. Clear, wording
    only.
  - **P8 (§12):** state the config assumptions behind the headline figure (resonance count, charges,
    rage). Clear, about +30.
  - **P9 (§9, §10):** name the affix source when it limits the base. Clear for the reader. It needs a
    claim, or a lookup extension for base weights and essences.
  - **P10 (§11 or §13):** 2–4 trap bullets, only ones sourced from item or gem text or PoB. Judgment,
    about +60.
  - **P11 (§5 or §13):** 1–2 either/or picks with a PoB delta, plus a price when online. Judgment, about
    +50.
  - **P12 (§6):** a rotation clause when a leveling stage's damage is a combo, within the 110-word cap.
    Judgment.
  - **Rejected:**
    - a "you'll know it's working" line (needs per-element hit ranges we don't expose);
    - a content-fit line;
    - video offloading;
    - crafting recipes, prices and tier labels;
    - atlas content;
    - the vendor regex;
    - campaign alt-character tricks;
    - patch bugs and traps found only by playing;
    - sidegrade variants.

**The user's decisions (2026-10-09):** "Agreed on everything else. Fold it in now."
- **P1 softened.** The user asked whether requiring a fallback for every suggestion would massively increase
  research. As a rule, yes: the cost is less the research than the strictness. The designers would have to
  find and source a fallback for each caveat, and the prose lens would flag every miss, which drives fix
  rounds.
  - So fallbacks are stated only where D1 or D2 already weighed one.
  - This now covers all fallbacks, including the existing slot-table and leveling gear fallbacks, whose cells
    may be empty.
  - None is required, and none is checked.
- **P2 softened.** "There might not always be clear thresholds … 'when you can afford it' or 'when it starts
  feeling underpowered'. I'm wary of making the rules/lenses too strict."
  - A threshold is used when the plan has one; otherwise a first-person judgment trigger is fine.
  - The lens doesn't check a trigger's form.
- **P3–P12 adopted** as optional items: none is required, and the comparison-2 additions add no guard.
- **The vendor regex moves from rejected to deferred** (amendment 2 §10, Q6). The user notes it is plain regex
  and that community tools build the shortest one for chosen mods. It is unblocked by grounding the game's
  supported syntax from a source the user names.
- **Section budgets rebalanced:** Leveling 660→620, route 240→210 and At a glance 160→150 make room for the
  additions. The total is about 2,840, with the cap still 3,000.

### Off-meta build 1: Melting Maelstrom Shaman (user-supplied, 2026-10-09)

- **Source:** Troy Tesko's video (patch 0.5.5), already in yt-library as `GsLBMXy3tDk`. It was read from the
  transcript plus about 25 frames, at about 161K subagent tokens on Opus. No links were opened.
- **Links kept for later, not opened:**
  - The creator's PoB export, `https://poe.ninja/poe2/pob/2abaf`, from the video description. Fetching
    it from poe.ninja needs the user's approval.
  - His PoE2 guide playlist, `youtube.com/playlist?list=PLTXChyYiMk9JhdkR5uQw7vPt49t965QjZ`.
  - The video's frames, in `~/projects/yt-library/videos/GsLBMXy3tDk/frames/`.
- **The build:**
  - The damage comes from the Melting Maelstrom mana flask: every 3 seconds, 100% of the mana spent in
    those seconds is dealt as chaos damage within 3 metres.
  - The flask is spammed, because each use's window stacks (the creator's observation, not item text).
  - Corpsewade boots trigger Decompose every 1.2 m. Archmage adds 6.7% of max mana to its cost, which
    supports and Eldritch Battery multiply.
  - Brutus' Brain clerics supply the corpses through Sacrifice.
  - The Forsaken Bangle charm, tripled by the Magnum Opus anoint, recoups the flask's self-damage.
  - Endgame only: the flask needs level 60.
- **PoB sees none of the damage,** checked:
  - The nova line is not parsed (`ModCache.lua:5363`, nil).
  - Magnum Opus is not parsed (`:5022`).
  - The Bangle recoup line is a partial parse, so it is not applied (`:3233`).
  - Corpsewade's trigger is not parsed, so PoB treats Decompose as a self-cast.
- **Our pipeline would reject it twice:**
  - R1a's feasibility read requires the rolled skill as the main damage source (`R1a.md:100-101`).
  - D-122 and D-148 (the rolled skill is the main damage and the clear skill) fail for every skill in the
    chain, which are all fuel or utility.
  - Our boundary holds as designed: we can't verify damage PoB can't see.
- **Candidate ideas,** collected for a concept-discovery write-up after the remaining off-meta builds; not
  adopted:
  - **I1, a resource-flow pass in R1a.** List what the rolled skill consumes and produces (mana, corpses,
    charges, flask charges), and run 2–3 mechanic lookups on those resources across uniques. This finds
    supplemental damage and sustain engines that keep D-122 intact. Cheap.
  - **I2, `check_model_coverage` flags unparsed "deal … Damage to Enemies" lines** as unmodelled damage
    sources, so D1 must ledger them. This guards the D-122 gate and the headline figure when an item
    out-damages the rolled skill unseen. Cheap.
  - **I3, input demand** (presses per second, "must keep moving") in a concept's Risks and in At a glance's
    cons. Cheap.
  - **I4, a level-gated engine item** gets a named swap stage in D2, as the rolled skill's requirement does.
    Cheap, wording.
  - **Not attempted:**
    - an "item is the build" mode that relaxes D-122. It is against the randomizer premise and all hand
      calculation; it would be the user's call;
    - modelling the flask ourselves;
    - broad all-uniques interaction searches.

### Off-meta builds 2–6: perra's "Broken Off-Meta Builds" (user-supplied, 2026-10-10)

- **Sources:**
  - The Mobalytics index and 4 written guides; The Eraser's guide is archived (410), and Stormcaller has a
    video only.
  - 10 videos. Skipped: one gameplay showcase and one glove-craft video.
  - Six agents, about 1.38M subagent tokens on Opus.
  - Builds, links and corrections are in `reference-builds.md`.
- **All five are Gemling Legionnaire,** on 0.5.5.
- **Every headline number is wrong in PoB:**
  - **Mirage Sniper:** PoB never runs the Mirage Archer branch, because no gem has
    `skill_can_own_mirage_archers`. It shows one player Snipe at 30% less damage, not about 6 mirages.
  - **Glacial Bolt:** Kaom's Madness's +3 fissures are unmapped but its penalties apply, and there is no
    crystal-overlap setting. The minion-detonation core (Biting Frost popping crystals) is undocumented
    anywhere.
  - **The Eraser:** Scouring Flame's support stat is unmapped, and Tasalio's per-stack lines are missing
    from the data. The ignite is about 2.25× low, and the Contagion spread is invisible.
  - **Stormcaller:** the arrow count never multiplies DPS (no overlap stat), Tornado Shot's copies are
    zero, and the 94% charge retention is unmapped.
  - **HotG:** Glory appears in no calculation module, so a Glory-gated skill computes as spammable.
- **Gemling in PoB,** checked:
  - The `GemlingQuality` flag applies `altQualityStats`; 47 of 244 such stats are unmapped.
  - Gem Studded's if/elseif gives one colour on a tie (`CalcSetup.lua:2155-2162`), so a 17/17/17 balance
    gets only Red.
  - Supports from every weapon set are counted.
- **Our lookup is blind to Gemling quality effects,** checked: `describeStatSet` passes only level and
  quality, and `qualityLines` reads only `qualityStats`. Nothing in `pob-api` reads `altQualityStats`.
- **Linking patterns** across all six off-meta builds:
  - the skill's inputs and outputs: consumed resources, objects left behind, ailments and events emitted,
    and who consumes them;
  - a "chance not to consume" pushed to 100% turns a per-use cost into a one-time unlock (HotG Glory,
    Barrage charges);
  - force a condition by lowering its threshold or reserving into it (Surrounded with 1 enemy, low life
    through reservation);
  - zero a resource, then harvest every drawback priced in it (CI);
  - a proxy or helper multiplies the rolled skill (Mirage Archer, Barrage, Tornado Shot), with count =
    duration ÷ cooldown;
  - minions that deal no damage, used as triggers or headcount (Brutus' Brain);
  - convert the damage type so another mechanic applies (Blackflame, then Contagion);
  - quality as a second stat line (Gemling);
  - weapon set 2 doing a non-damage job;
  - utility gems kept at a low level for cost;
  - a defence stat that also scales damage (block);
  - filler gems to satisfy a count.
- **Budget ladder:** Josiah's tiers (7 divines, then 10–20, 50–70, then Mageblood/Headhunter) line up with
  our `m`, `b` and `n` rungs. His 7-divine entry keeps "nothing that loses value on resale".
- **Candidate ideas,** continuing I1–I4; none adopted:
  - **I1, widened:** an inputs-and-outputs pass covering resources, objects, ailments and events,
    retention ("not consume" or "not remove"), conditions, and drawbacks priced in a zeroed resource.
    Re-run it on the next bottleneck. Queries must be narrow, since results are capped at 20–30. Cheap.
  - **I2, reworded:** coverage flags unmodelled mechanics, not only unparsed damage lines:
    - proxy gems;
    - usage-gated skills (`HasUsageCondition`, Glory);
    - unmapped count lines;
    - a gem description promising what its stats lack;
    - Gem Studded ties.

    Today, coverage gives Mirage Archer a false all-clear. Cheap to moderate.
  - **I3, both ways:** input demand is a con; a proxy or breakpoint that removes it is a pro. The two Glacial
    Bolt variants split on it alone. Cheap.
  - **I4, generalized:** threshold-gated engines get a named stage or rung. This covers item level, lineage
    supports at 65, quality at 40%, a mod roll value, and budget-gated pieces. Cheap wording.
  - **I5, lookup shows and searches Gemling quality effects** (`altQualityStats`), labelled. Cheap code,
    and the highest value for any Gemling roll.
  - **I6, lookup "usable by":** an active gem's skill types, plus the meta gems that accept it (Snipe → Mirage
    Archer). Cheap code.
  - **I7, lookup searches item-base implicits** (the Absent Amulet recurs). Cheap code.
  - **I8, D1 ledger idioms:**
    - proxy count;
    - usage-gate rate (income ÷ requirement, unless 100% no-consume);
    - hits per target (overlap, fissures);
    - "PoB's default is optimistic": a claim naming the enabler.

    Judgment wording.
  - **I9, D1:** non-DPS breakpoints as claims (ignite duration of at least 2 s), and utility gems levelled
    for cost. Cheap wording.
- **Open for the user, D-122** ("the rolled skill is the main source of damage"):
  - Does damage from the rolled skill's own hits, ailments and projectiles count when another skill
    fires, spreads or copies them? Mirage Archer firing Snipe, Contagion spreading Perfect Strike's
    ignite, Tornado Shot copying Stormcaller arrows.
  - This would be a clarification, not a relaxation.
- **Not attempted:**
  - hunting undocumented interactions;
  - modelling proxies, overlap, Glory or spread in Lua;
  - patching `vendor/`;
  - broad searches of every unique against every gem.

### The user's answers and a new direction (2026-10-10)

- **D-122, clarified (the user: yes):** damage from the rolled skill's own hits, ailments and projectiles
  counts as the rolled skill's damage when another skill fires, spreads or copies them (Mirage Archer firing
  Snipe, Contagion spreading Perfect Strike's ignite, Tornado Shot copying Stormcaller arrows). To fold into
  the spine at finalization.
- **Direction asked for (discussion open, nothing adopted):** generalize beyond "ascendancy + skill". A user
  may name only an ascendancy, only a playstyle, or nothing but a style. The user's suggestion: lean less on
  PoB numbers and verifiers, brainstorm from a pattern library, and run the numbers only on candidates that
  pass a sniff test. The user expects the Gemling quality effects to be nerfed in 1.0.
- **PoB's Count field (the user's pointer; grounded):**
  - It is the "Count:" box beside "Include in Full DPS" on each socket group (`Classes/SkillsTab.lua:218-223`),
    saved in the build file as `groupCount` (`:307`, `:470`).
  - It multiplies the group's contribution to Full DPS only (`Modules/Calcs.lua:342-411`); damage over time
    is multiplied only when it can stack (`dotScale`). The main skill's own DPS ignores it.
  - It also multiplies reservation for skills reserved per copy and for totems with Ancestral Bond
    (`Modules/CalcDefence.lua:283-288`).
  - Our compiler creates every group with Full DPS off (`pob-api/API/Compile.lua:632`), and nothing in
    `pob-api/` or `src/` sets `groupCount`. So the pipeline reads the plain main-skill figure today.
  - The user: players use Count to approximate copies and overlaps; "more of an art than a science".
- **Observation:** the funnel the user describes already exists in shape. R1a's three researchers propose
  concepts, R1b compiles each as a skeleton, and checkpoint 1 asks the user to pick, ask for more or stop.
  Generalizing mostly changes the funnel's mouth: the input, the library, the sniff test and Count.

**The user's decisions on generalization (2026-10-10):**

- **Adopted as proposed:**
  - constraints as the input;
  - the pattern library;
  - the text-check sniff test;
  - Count in the plan and the compiler, with Full DPS as the headline;
  - PoB kept for defences;
  - DPS estimates labelled rather than verified for exactness;
  - the main-damage rule reworded to the build's named damage source;
  - the "won't do" list.
- **Three phases, each gated by the user:** brainstorm, verification and finalization.
  - Each surviving concept goes to the user, with what has and hasn't been verified stated plainly.
  - The user moves it to the next phase or asks for more candidates.
  - The user's reason: a better experience than waiting a long time for a guide that isn't what they wanted.
  - Mapped onto today's pipeline:
    - a new gate after brainstorming, before any skeleton is compiled;
    - skeletons only for the concepts the user picks;
    - today's checkpoint 1 becomes the gate after verification;
    - checkpoint 2 stays as the final gate.
- **poe.ninja on by default:** popularity and the build index (the user: "a treasure trove").
  - Only web requests that need PII or a cookie require explicit approval, so trade stays gated.
  - An override flag disables it.
  - Tests stay offline (D-34 is unchanged).
  - **To ground:** the PoE2 build index API (shape, rate limits, terms).
  - **To reword when implemented:**
    - the project CLAUDE.md line "No agent or test makes requests to … poe.ninja";
    - the build-guide skill's "never contact poe.ninja yourself" rule (`SKILL.md:17-20`).
  - The server already holds a poe.ninja client for currency rates only (`src/services/poeNinjaClient.ts`). The
    build index would be a new server tool, so one client, cache and rate limiter cover it.
- **Open:** whether development-time agents may now call poe.ninja, for example to ground the API.

### Off-meta builds 7–30: the user's YouTube list (2026-10-10)

**Coverage and cost.**

- The user supplied 15 build guides (14 cards; one agent took both Earthshatter videos) and 9 "random build"
  playthroughs by Schwingy, studied for process.
- 23 agents, 2.36M subagent tokens on Opus, about 102K each. Briefs are in the scratchpad (`offmeta-brief-2.md`,
  `random-brief.md`).
- Patches:
  - 0.3.x: 2;
  - 0.4: 6;
  - 0.5: most;
  - 0.5.5: 3;
  - one Path of Exile 1 video (Eye of Winter), studied for process only.
- Each build's chain and links are in `reference-builds.md`. Two downloads were throttled to about 240 KiB/s at
  720p and re-fetched at 480p.
- The Gemling bias of the first list is gone: 4 of the 22 builds are Gemling.

**The pattern library, consolidated into families.**

About 40 new pattern names came in. They fold into ten families. Each entry carries a search step in its
card.

1. **Loops and relays:**
   - inputs-and-outputs;
   - closed trigger loop with a seed and a decay timer (Earthshatter);
   - relay past a self-exclusion (Eventide, Flicker);
   - automate the routine action (Crossbow);
   - kill-gated consumer (Eventide);
   - debuff loop split across two skills (Bone Cage);
   - condition carrier (Walking Calamity);
   - placed detonator (Shield Charge).
2. **State consumers (builder and finisher):**
   - builder that can't spend (Wing Blast);
   - keep the event for the engine (Crossbow);
   - staged handover (Shockchain);
   - state-keyed payoffs (Fangs);
   - the anti-pattern, a payoff thief (Wing Blast, Fangs).
3. **Resource conversions:**
   - zeroed resource;
   - split pools or cost redirection (Oracle, Widowhail);
   - cost to a gated resource:
     - inflated cost as fuel (Ancestral Cry);
     - drawback as fuel (Empyrean);
     - support cost as trigger fuel (Bone Cage);
   - overflow resource and threat-scaled generator (Walking Calamity);
   - the enabler funds its own payoffs (Gathering Storm);
   - mirrored stat (Enervating Nova).
4. **Stat bridges:**
   - stat-to-damage (Widowhail, Twister);
   - attribute bridge (Supporting Fire);
   - scope bridge, "also affects you" (Empyrean);
   - one stat broadcast to its siblings (Bone Cage);
   - object stat as damage (Earthshatter);
   - stat-as-base convergence (Mana Flare);
   - damage-source substitution (Shield Charge);
   - defence that scales damage, and defence that scales defence (Walking Calamity);
   - pivot bridge (Fangs).
5. **Copies and rate:**
   - proxy multiplier;
   - repeat to cap (Infernal Cry);
   - cooldown recovery as DPS (Supporting Fire);
   - sequence ramp fed by use rate (Varashta);
   - proc farm with a free action (Supporting Fire);
   - count events, not damage (Eventide);
   - burst-window stacking (Gathering Storm);
   - slow the emitter (Eye of Winter);
   - stacking rate caps (Shield Charge).
6. **Levels, quality and tags:**
   - level-carrier host (Infernal Cry);
   - quality as a stat line;
   - low-level utility gems;
   - type-granting support unlock (Flicker);
   - tag audit (Walking Calamity, Fangs).
7. **Conditions:**
   - forced condition; permanence = reservation of at least 1 minus the threshold (Gathering Storm);
   - outcome lock (Chayula);
   - saturated type count (Twister);
   - drawback cancellation (Shockchain);
   - drawback offload (Twister).
8. **Item and slot tricks:**
   - amplified slot as stat stick (Widowhail);
   - socket amplifier plus latent lines (Mana Flare);
   - support moved to gear (Empyrean);
   - skill granted by an item base (Enervating);
   - weapon set 2 job;
   - bimodal roll plus luck (Enervating).
9. **Actors:**
   - inert minions;
   - buff relay (Chayula);
   - actor rerouting (Varashta);
   - reactive carrier (Mana Flare);
   - movement delivers the radius (Gathering Storm);
   - control as defence (Shockchain, Fangs);
   - hit count as sustain (Eye of Winter).
10. **Tree:**
    - keystone as pathing anchor (Oracle);
    - a node-effect multiplier steers cluster choice (Ancestral Cry);
    - a radius jewel instead of an anoint (Twister).

**Families seen in two or more independent builds:**

- relay past a self-exclusion;
- stat-to-damage bridge;
- cost redirection;
- cost to a gated resource (3);
- builder and finisher with a payoff thief (3);
- command skills with Archon of Undeath and Muster (Varashta, Supporting Fire);
- Concussive Runes heavy-stun shockwaves (Flicker, Ancestral Cry);
- Gemling quality (Infernal Cry and Earthshatter here, plus perra's five).

**Process heuristics, by phase** (mostly from the random-build videos).

- **Brainstorm.** Questions to ask of every candidate:
  1. What is the damage source, what does it read, and which slot carries it? (Shield Charge, Enervating)
  2. Fix the payoff first, then judge each piece by whether it feeds it. (Empyrean)
  3. What does the payoff consume or require, and can the skill create it? If not, it's a builder and a
     finisher, and the lock must fit by tag. (Wing Blast, Shockchain)
  4. The enabler: name it, the level it arrives at, and how to get it ("dormant until X"). Its downside is
     the next buy. (Eye of Winter, Gathering Storm)
  5. Which routine action already produces the resource it needs? (Empyrean, Walking Calamity)
  6. Read the skill's own text for payout conditions, ramps and hidden scaling. (Wing Blast, Varashta, Eye of
     Winter)
  7. Tag audit: which +level sources and supports can reach it? (Walking Calamity, Fangs)
  8. Search other skills' text for the main skill's tags, and pair-test the planned skills. (Shield Charge,
     Empyrean)
  9. Give it the standard kit before calling it weak. (Bone Cage)
  10. How does the required state fail? Plan one fix per failure. (Fangs)
- **Verification.** Checks on the skeleton, each reported as verified, estimate or risk:
  1. For ailments and damage over time, a pillar checklist: base, type-specific scaling, duration, 100%
     application.
  2. The enabler's numeric conditions at the target level, and what they force out of the build (Bone Cage
     caps its own life). A permanence check on forced conditions.
  3. Attribute requirements at the target level, including after swaps.
  4. A dead-slot audit (toggle each source, and flag a zero change). Does each support touch the activation
     or the payload?
  5. DPS with the condition on and off at a realistic uptime. Stacks per second against rate caps.
  6. Clear and bosses reported separately, with encounter mods (+resistance, bosses that resist your
     element).
  7. Risks PoB can't show:
     - payoff thieves;
     - placement limits;
     - the exposed phase;
     - cooldown dead windows;
     - hidden clauses on links between items ("from a Hit", "you use yourself"), stated as theory.
  8. Skill-shape probes (projectile speed up and down).
- **Finalization (the guide):**
  - bridge skills that share the weapon, element or resource while a payoff is level-gated (Gathering Storm,
    Walking Calamity, Varashta);
  - bank the enabler, and pivot when points or level allow; pillars marked "buy now, works at stage X";
  - fallback ladders: the staged handover, a cost-ordered ladder for an unmet condition, a fix ladder for
    clearing;
  - fix by mechanism, cheapest first, and defend the exposed phase;
  - report effective HP and max hit honestly, and say when damage stays low and control carries;
  - a boss loadout separate from mapping.

**How PoB follows these builds.**

- **Count fits copies and rate:**
  - Spell Cascade 1–3;
  - mimics;
  - Reavers = 8;
  - Volcanic Steps = movement speed ÷ 12;
  - aftershocks;
  - overlapping twisters;
  - Archon's cooldown gain ≈ 2.5.

  It doesn't fit per-hit ramps, cooldown-capped triggers (Mana Flare), stack fills (Corrupted Blood) or
  per-hit surges.
- **A second idiom:** hand-calculate, then inject the result as a custom mod. Examples: Chayula's "Allies in
  your Presence Gain N%…", Verglas's gain-as-extra, a ramp's "more".
- **Config stand-ins:**
  - the three ground boxes for The Taming;
  - Corrupted Blood stacks;
  - Heavy Stunned;
  - Current Mana %.
- **Confirmed by me:**
  - the Concussive Runes shockwave has no skill definition (`Data/Gems.lua:19614` grants
    `ConcussiveRunesPlayer`, and no `skills[...]` entry exists);
  - energy-based meta gems (Cast on Critical, Cast on Minion Death, Cast on Elemental Ailment) aren't modelled
    at all. Trigger configs are looked up by skill name (`CalcTriggers.lua:1447-1453`), the only entry is
    PoE1's `"cast on critical strike"` (`:1089`), and nothing in `Modules/` models energy;
  - a skill granted by a support takes the support gem's level (`CalcSetup.lua:1850-1876`).
- **Agent-reported, not checked by me:**
  - Archon of Undeath is absent from `Modules/`;
  - Verglas, The Taming, Way of the Stonefist, Polcirkeln, Primal Bounty and Crushing Blows are unparsed;
  - Muster's count differs from the game's.
- **Data drift:**
  - rolls above the data range have to be typed in (Widowhail 280%, Chober Chaber +4, Fireflower +6);
  - mutated (Vaal) uniques only import;
  - some numbers lag the game (The Mhacha's Gift: 3 in game vs 2 in PoB; Dialla's Desire: 10 vs 5);
  - Loreweave and the Runemastered Olrovasara are missing.
- **Evidence:** creators rarely show PoB numbers. They show in-game tooltip DPS, footage and boss kills.
  poe.ninja character and PoB links appear in about a third of the guides. That backs poe.ninja as evidence
  by default.

**Budget and campaign.**

- Earthshatter's budget and endgame pair is the best ladder example: the damage chain is identical, and the
  swaps cost defence, consistency and spirit, with numeric thresholds.
- Varashta is the only campaign guide (SSF, no uniques).
- The random-build videos are mostly campaign. The early game is dominated by bridge skills, attribute
  lockouts and "dormant until X".

**Candidate ideas, continuing I1–I9; none adopted.**

- **I10, pattern library v1.** Ten families with variants, each with:
  - a search step;
  - how PoB follows it (modelled, Count, custom mod, hand calculation, not modelled);
  - examples from `reference-builds.md` (30 entries: 21 off-meta builds, 9 playthroughs).

  Shapes only. Each use is re-checked against current data. Judgement; cheap to write.
- **I11, candidate card fields:**
  - the damage source and its slot;
  - what the payoff consumes or requires;
  - the enabler (level, acquisition, "dormant until");
  - the resource producer;
  - how PoB follows each link;
  - evidence (poe.ninja characters, the creator);
  - risks;
  - a fallback ladder.
- **I12, the verification checklist above,** reported as verified, estimate or risk. None of it is a required
  gate.
- **I13, lookup additions (cheap code):**
  - type-granting unlocks (`addSkillTypes` against `requireSkillTypes`);
  - "what can this support ride";
  - named phrase searches ("also apply to", "while already at maximum", "per 100 maximum", "for each type
    of", "cannot … but", "instead of you", "your <tag> … shatter");
  - a skill's hit-making children, for the payoff-thief audit;
  - skill stat sets.
- **I14, coverage flags** (extends I2):
  - energy-based meta gems;
  - skills granted by supports (level);
  - granted skills with no definition;
  - rolls above the data range.
- **I15, Count plus custom-mod injection** as plan fields, each with a reason. This extends the Count
  decision.
- **I16, campaign:** bridge skills for level-gated payoffs, and "dormant until X" in Leveling.
- **I17, poe.ninja peers:** what similar characters run. The Fangs creator used this.
- **Not attempted:**
  - modelling meta-gem energy or shockwaves in Lua;
  - patching `vendor/`;
  - turning the checklists into required gates.

**The user's answers (2026-10-10, continued).**

- **poe.ninja in development:** "It's fine to use poe.ninja in development, just be polite with request
  rate." This closes the open question above. pathofexile.com and requests carrying a cookie or PII stay
  gated, and tests stay offline (D-34).
- **Also adopted on 2026-10-10,** under the user's "Everything else looks good" but left out of the list
  above:
  - PoB keeps its job for the delivered file, as well as for defences;
  - the finished guide still checks that every stated interaction exists in game text;
  - the verifiers stop checking DPS figures for exactness when they rest on Count or a hand calculation.
- **Amendment 3: "Go ahead, and let's start keeping a list of PoB gaps and bugs."** This answered my offer
  to write amendment 3 with:
  - the open-ended input;
  - the three gated phases;
  - the pattern library;
  - the candidate card;
  - the verification checklist (advisory);
  - Count and custom modifiers;
  - poe.ninja on by default;
  - the lookup additions.

  Ideas I10–I17 are drafted into the memo and stay proposals until the user approves it.
- **The PoB gaps list** was started as `pob-gaps.md` (PG-1 to PG-50). Every agent citation was re-checked
  against the code.
- **Amendment 3's review:**
  - One adversarial reviewer ran three lenses: invented decisions, citations and completeness. It cost 172K
    tokens and checked about 45 citations.
  - Findings I verified and folded in:
    - Full DPS breaks the compile limits (a test run with Full DPS on every group took 160.68 s, against
      D-159/D-229's 100 s budget);
    - the checklist's toggles have no measure-only tool (`toggle_*` and `set_config` are `mutate` tools,
      `toolMeta.ts:114-117`);
    - cards lacked an identity for R1b;
    - the deck had no assembly step;
    - offline answers were undefined;
    - the round cap (NFR-23) and the other routes back to checkpoint 1 were missing from the change table;
    - R1a's foci assumed a rolled skill;
    - figures computed with custom modifiers were unmarked;
    - the tool-count tests;
    - eight citations needed correcting.
- **Amendment 3's questions.** The user took the recommendations on Q1–Q7 ("Take the recommendations"). The
  user also asked whether EHP should sit beside the headline now, or wait until after approval.
  - Recommended and folded in as Q8: now. `TotalEHP` is already in the compile record, because the compiler
    copies every PoB output (`pob-api/API/Compile.lua:961-964`), so it adds no compile time.
  - It is shown beside max hit, which stays the basis of the survival verdict.
  - It is added to the card, R1b-assemble's key numbers, and amendment 2's verdict line (checked against
    `TotalEHP`).

**Worktrees removed (2026-10-10, at the user's request).**

- **Removed:** `pob2-mcp-wt/build` (`stabilization/build`) and `pob2-mcp-wt/m12b` (`bg/m12b`). Both were clean, and
  both branches are contained in `build-guide/build`.
- **Fast-forwarded:** `stabilization/foundation` to `build-guide/build` (`50a8928`, 108 commits) in the main
  checkout.
- **Removed:** `pob2-mcp-wt/guide`.
- **Where work happens now:** in `/home/parker/projects/pob2-mcp`. Nothing was pushed, and the sign-rebase stays a
  finalization step.
- **The gate in the main checkout:**
  - `mise run test`: rc 0, with 120 suites and 1,842 tests, plus the NFR suite's 2 tests.
  - `pnpm build`: rc 0.
- **The running pob2 server** (started from the main checkout's `build/index.js`) gains the build-guide tools
  only after it restarts.
- **A fresh worktree** is planned for amendment 3's parallel implementation.
- **Amendment 3 approved** by the user (2026-10-10, "I approve amendment 3"), Q8 (EHP) included.
  Implementation waits for git bookkeeping.

**Git bookkeeping (2026-10-10, with the user present).**

- **Deleted 7 merged local branches:** `bg/m12b`, `build-guide/build`, `build/a3`, `build/lua`, `build/trade`,
  `build/trade2`, `stabilization/build`.
- **Sign-rebased the 186 unsigned commits after `fd289ba`,** keeping their dates.
  - The tree is identical to the pre-sign history.
  - All 191 commits above `main` show good signatures.
  - The old history is kept locally as `refs/archive/pre-sign-2026-10-10`, which is not pushed.
- **Updated the commit hashes the docs cite:**
  - 119 citations were remapped to the signed commits, by position.
  - 35 more already pointed at unit-branch originals that were never on the main line; they were mapped to
    their main-line copies by subject.
  - All 94 cited commits now resolve on the main line.
- **Then:** fast-forward `main`, push it to `origin` (the user's fork, tracking `origin/main`), and delete
  `stabilization/foundation`. Amendment 3's implementation starts on a feature branch.

**Before compaction (2026-10-10).**

- **Study reports kept.** The 34 study reports (guide comparisons 1 and 2, Maelstrom, perra's set, the YouTube
  list, the random-build playthroughs) are copied verbatim to `docs/build-guide/studies/`, with an index. The
  three agent briefs they followed are in `studies/briefs/`.
  - Until now they lived only in temporary transcripts.
  - They hold the per-pattern search steps and process notes that work unit N-5 (the pattern library) needs.
- **Branch.** Work continues on the feature branch `build-guide/amendment-3`, off `main` at `afbcc6b`.
- **Next step, open for the user.**
  - Option 1: fold the finalization items into the spec first. These are D-239…D-266 (decisions made during
    the build), amendments 1–3, and C-33, folded into the spine (`spec/README.md`) and slice 03. Amendment 3's
    implementation would then build against one consolidated spec.
  - Option 2: start amendment 3's implementation directly.
  - Recommended: option 1.
  - Then amendment 3. Its independent units are S-N1 (the poe.ninja API spike), S-N2 (the Full DPS timing
    spike), N-2 (lookup), N-3 (coverage) and N-5 (content), with a fresh worktree for the parallel build.

### Spec fold v1.3 (2026-10-10)

The user chose option 1: fold first, then build amendment 3.

**Process.**
- A planner agent mapped every item to its target and assigned the new ids. That covered D-239…D-266,
  ten settled decisions the work-log never numbered, amendments 1–3 and C-33.
- Four editors applied the map in parallel, one per spec file.
- Three read-only review lenses checked it: id integrity and the task graph, stale or contradictory text,
  and fidelity to sources.

**The map's main finding: amendment 2 is approved but not built.**
- `src/plan/schema.ts:217` has no `entering-maps` variant.
- The guide template keeps its old headings, and there is no `audit.md`.
- See "Not implemented yet." above.

It is folded as target design, like amendment 3, with units WU-60…WU-62.

**The user's rulings (2026-10-10).**
- **F4. Live run.** New milestone M-14, "open builds offline": amendments 2 and 3 are built and their
  offline run with an open brief (WU-59) is recorded. The live Titan / Blood Hunt run (WU-48, M-13) comes
  after M-14.
- **F5. Tool cap.** The user said: "I didn't explicitly ask for a cap, so I'm fine with whichever is the
  cleanest." So D-173's numeric cap and NFR-24 are retired (D-316). Grouping stays. The poe.ninja tools
  are one per distinct query shape, set by S-N1 (WU-50).

**The fold's gap list ("F-n" in the spec).** The coordinator resolved the planner's other 25 gaps. They are
recorded as decision rows marked PROPOSED by the coordinator. The text below is the resolution list as
written.

**The coordinator's resolutions (PROPOSED, 2026-10-10).**

- **F1.** Fold amendment 2 as target design.
  - Keep the map's numbering: no chronological renumbering.
  - Split amendment 2 into WU-60, WU-61 and WU-62 as the map proposes.
  - WU-62 merges before WU-57 and WU-58.
- **F2.** D-305…D-314 become decision rows.
- **F3.** Slice 01 hosts WU-50 (S-N1), N-1, N-2 and N-3, with AC-K criteria.
- **F6. Card ids** are `r<round>-<researcher letter>-<n>`, for example `r1-a-2`, with files at
  `cards/<id>.md`.
  - The runner letters the researchers when it starts them, so parallel researchers never collide.
  - `research/p<k>-r1a-<n>.md` stays.
  - If WU-57 (N-6) finds the research files unused, it removes them and records a decision row.
- **F7. One `schemaVersion` bump** covers all of these: `count` (an integer of at least 1, default 1),
  `countReason`, `customMods` (optional) and the `entering-maps` variant.
  - The first of WU-61 and WU-55 to merge makes the bump, and the second extends the same, unreleased
    version.
  - The plan reference and the worked example are updated in the same unit.
- **F8. The record keeps the raw figures** as they are.
  - New fields beside them hold figure × count, and a mark flags each figure computed with custom
    modifiers. `recordVersion` bumps.
  - The verdict line and the headline read the named source's Count-scaled figure, with `TotalEHP` beside
    it (Q8).
  - WU-55 (N-4) names the exact fields and writes them into C-33's text in the same unit.
- **F9. A missing reason is a V1 finding of error severity, not a schema error.** This covers a missing
  `countReason` when `count` isn't 1, and a `customMods` entry with no reason. The amendment names the test
  `planChecks.test.ts`.
- **F10, F11, F12, F20. Missing acceptance criteria** (N-2, the four N-3 flags, N-8, the D-122 wording test).
  - Each unit's first step pins its acceptance criteria in its slice spec, from the amendment's text, and
    the coordinator reviews them before any code is written. Record this as a proceed-on assumption (A-n).
  - "Like WU-47" (N-8) means WU-47's recorded procedure, with an open brief in place of a roll. The brief,
    the test answers and the faults are chosen when the unit starts.
  - "Culmination II, then Ailith's Chimes" (AM3:429-430) is settled by the same step.
- **F13. Test answers** are `answers.brainstorm`, `answers.verification` and `answers.final`.
  `checkpoint1` and `checkpoint2` are retired in run-log v3.
- **F14.** S-N1 sets the popularity threshold from the data and records it as a decision row.
- **F15.** The poe.ninja tool details (names, arguments, outputs, kinds, cache lifetime, back-off) are
  outputs of S-N1 (WU-50), recorded in C-54 when it merges.
- **F16.** The pattern library's cap is 6,000 words, counted by the checker.
- **F17.** The checker accepts run logs of schema v2 and v3. v2 is accepted only so recorded runs (WU-47's)
  still check.
- **F18.** The spine editor rates R-32…R-37 on the register's existing scale, marked PROPOSED.
- **F19.** Unchanged: the trade-link field stays deferred to WU-48, as amendment 2 says (a human-decision
  gate).
- **F21.** `m` follows D-256's area-level tie, with the entering-maps rung's area level from D-281. The row
  says the coordinator inferred this.
- **F22.** WU-60 and WU-53 both edit `Lookup.lua`, so they serialize, WU-60 first (consistent with F1).
- **F23.** Record both work-log notes as risks with their work-log lines: trial 1's progress key (WL:201-202)
  and D-251's area-60 interlude edge (WL:338-339).
- **F24. Intended.** `buildSha1` tracks build content, and sources and tags are citations. Say so in C-33's
  text, naming `config.scenario[].source` and `respec.goldCost.source`.
- **F25.** S-N2 measures the fifteen-stage fixture.
- **F26.** `"league": "unverified"` stays the offline convention, stated beside D-233.
- **F27.** Probe variants live at `probes/<card-id>/<n>/` in the run folder.

**After the editors finished, the coordinator added two more rulings (both PROPOSED).**
- **Version-1 plans** stay accepted after the schema bump, since the new fields are optional and default.
- **`--no-ninja`** means the run calls no tool in the `ninja` group: neither C-54's tools nor
  `get_currency_rates`. Price totals then become `unverified`, which is pricing's existing path when rates
  are missing.

**The spine editor corrected F26 to match the code.** `"league": "unverified"` marks an online run that
can't reach trade. Offline, `league` is null (`D1.md:43-51`; D-330).
- **A non-skill card's identity, D-334 (PROPOSED).** The fix pass left this open: amendment 3 says a card
  whose damage source isn't a skill "can be dealt and verified", but not how it passes the identity check,
  which wants `Kind: active`. The ruling:
  - its `skill` names the damage source and is checked by a lookup of its kind;
  - verification runs only the checklist's read-only checks, with no skeleton or probe compile until HG-21's
    plan field exists;
  - the card says so.

**The review of the fold.**
- Three lenses found 51 findings: 18 stale or contradictory text, 15 fidelity, 18 ids and graph.
  - About 137 of the 150 claims the fidelity lens sampled held.
  - The id lens found no undefined ids, no cycles, and the user's three ordering rulings all hold.
- Clustered, that came to 21 material clusters and 23 low items.
- One verify-and-fix pass checked each one against the amendments, the work-log and the code. Every cluster
  except 8 (a non-skill card's identity, settled as D-334 above) was fixed.

**The convergent high finding.** D-297 allowed polite poe.ninja requests, but the spine kept stab HG-1 (any
live request to poe.ninja stops for the user) and stab D-34 unamended. The fix:
- D-297 now amends stab D-34, stab HG-1, D-181 and D-201, for poe.ninja only;
- D-316 resolves stab HG-3 for the C-54 tools;
- the project `CLAUDE.md` line is reworded in this commit. Tests stay offline; pathofexile.com and requests
  carrying a cookie or personal data still need approval; agents may query poe.ninja politely in development.

**Other notable fixes.**
- M-10…M-12's exits now cover only their own units' ACs. M-14 lists the target ACs, as the coordinator's
  PROPOSED addition to the user's ruling.
- D-277 is restored: only amendment 2's optional items are optional.
- Amendment 1's coordinator-settled parts are no longer labelled as the user's.
- D-332 (version-1 plans) and D-333 (`--no-ninja`) are recorded.
- WU-57 hard-depends on WU-50, with WU-52 a soft dependency on offline stubs.
- The engine-action units now own AC-B3…AC-B5.

**Not changed.**
- The allowlist rules R-1…R-6 in slice 03 keep their names, because `buildGuidePipeline.test.ts` cites them.
- The exception labels E1–E4 stay, because the work-log uses them.

**Skill drift found and left for WU-57.** `.claude/agents/build-guide-verifier.md:11-13`, and its test, still
carry the pre-D-264 re-check rule. Fixed now:
- `references/run-folder.md:41` said the runner "appends" known issues. The runner replaces the list (D-265).

**Gate.** `jest tests/static`: 195/195. One assertion pinned slice 03's `outputs` row word for word, so that row
keeps its old wording. The fold changes only docs, `CLAUDE.md` and one skill reference line.

**Spec state.** The spine is v1.3. The decision log runs D-100…D-334, the contracts C-30…C-54, and the units
WU-30…WU-62:
- WU-50…WU-59 are amendment 3;
- WU-60…WU-62 are amendment 2;
- M-14 comes before the M-13 alpha.

**Next:** implement amendments 2 and 3 from the folded spec. The independent first wave is:
- WU-50 (the poe.ninja spike, S-N1);
- WU-51 (the Full DPS timing spike, S-N2);
- WU-56 (the pattern library and card template, N-5);
- WU-60 (amendment 2's lookup work), with WU-53 after it on `Lookup.lua`;
- WU-54 (coverage flags, N-3).

## 2026-10-10: amendments 2 and 3, build start (M-14)

- **Spec:** the spine v1.3 at `7e2ea82`. The user approved implementation ("Go ahead", 2026-10-10).
- **Handoff:** `docs/build-guide/build-handoff-amendments.md` (`acec4d1`).
- **Scope:** WU-50…WU-58 and WU-60…WU-62. WU-59, the offline run with an open brief, is the coordinator's,
  after WU-58. WU-48, the live run, waits for M-14.
- **Integration worktree:** `/home/parker/projects/pob2-mcp-wt/amend`, branch `build-guide/amendments`, off
  `acec4d1`. Lanes are `pob2-mcp-wt/bg-<nn>` on `bg/wu-<nn>`. The main checkout is untouched until the end,
  because the user's pob2 server runs from its `build/`.
- **Orchestration,** as for M-10…M-12: one background doer per unit, a read-only reviewer per unit (small units
  may share one), and an independent verifier per wave gate. No Workflow.
- **poe.ninja.** WU-50 queries it politely under the handoff's rules (D-297). It caches every raw response in
  `pob2-mcp-wt/ninja-cache/`, so WU-52 builds its fixtures without refetching.

## 2026-10-10: wave A (WU-50, WU-51, WU-54, WU-56, WU-60, WU-61)

The spine's amendment lanes name six independent units. The earlier "next step" list left out WU-61, but it
starts with the others (spine §8). All six started off `acec4d1`.
- WU-54 begins with A-33's step: it pins its flags' criteria, from AC-K53 upward, and stops for the
  coordinator's review.
- WU-51 records the load average with each timing run, because the other lanes load the machine.

### Baseline gate at `acec4d1`: PASS

Run in the integration worktree, from a clean tree (build, coverage and the Jest cache cleared), while
wave A's lanes started:
- `mise run test` rc=0: 120 of 120 suites and 1842 of 1842 tests, then the NFR step (`--runInBand`, 2 of 2);
- `pnpm build` rc=0.

### WU-50: blocked by poe.ninja's terms (HG-12; the user's decision)

The doer stopped on a handoff stop condition: the terms forbid this use. Its report is `306bc7b` on
`bg/wu-50` (`docs/build-guide/spikes/WU-50-poe-ninja.md`).

**The evidence.** poe.ninja's API Reference (`/docs/api`) says the builds and profiles API, "and every other
non-economy endpoint (character, Path of Building, authentication), are internal. They are undocumented,
unsupported, and not available for third-party use". It gives two reasons: server load ("risen sharply as
AI-assisted development has taken off") and the privacy of players who hide their characters.
- The coordinator checked the quote against the cached page body, without refetching it.
- **The coordinator's error.** The stabilization grounding already quoted this clause on 2026-10-03
  (`docs/stabilization/grounding/ctx-external.md:182-183`). Amendment 3 and R-35 didn't cite it.

**The requests.** 5 in total, all HTTP 200: `/`, `/docs`, `/docs/api`, `/poe1/data` and `/privacy`.
- Serial, at least 3.5 s apart, with the D-25 User-Agent and no cookie.
- No builds, character or API endpoint and no JS bundle was fetched.

**What is still allowed.** Only the economy endpoints (leagues, exchange and stash overviews), and none of
them carries skill, ascendancy or character data.

**Blocked:**
- C-54's tools, and their unit, WU-52 (AC-K47…AC-K49);
- D-298's popularity threshold and D-324;
- the cards' player-evidence status and Evidence block;
- the brief's seeding from under-played builds.

D-297's poe.ninja-on-by-default needs restating for the economy endpoints only. Wave B (WU-53, WU-55,
WU-62) doesn't depend on WU-50, so the other lanes continue. WU-57 waits for the user's decision.

**The options put to the user:**
- **A.** Withdraw the player-evidence tools; every card says "no player evidence".
- **B.** The user supplies popularity notes in the brief, and cards cite them as user-supplied.
- **C.** An economy-only signal (the stash overview's `listingCount`). It measures market supply, not
  players.
- **D.** GGG's official API. It needs an application to GGG, and stays gated by HG-1.

The doer recommends A, plus B.

### D-335 (the user's decision, 2026-10-10): no player-evidence tools

The user chose "No tool; your notes". To be folded into the spine:
- **Withdrawn:** C-54's poe.ninja tools and their unit, WU-52 (AC-K47…AC-K49). The count sites stay at 84,
  and 83 with poe.ninja disabled.
- **Cards** say "no player evidence" unless the brief carries the user's own popularity notes. A card cites
  those notes as user-supplied.
- **D-298's under-played seeding** (at least two under-played cards per deck) becomes a judgment the
  coordinator makes from the pattern library, labelled `judgment`. It has no threshold, so D-324 is
  withdrawn.
- **D-297 is restated.** poe.ninja is used only through its documented economy endpoints: C-12's currency
  rates, plus polite development queries. Its builds, profiles and character API is not used, by any agent
  or tool, in development or in runs.
- **D-333's `--no-ninja`** still turns off the economy tool (`get_currency_rates`).
- **WU-57** no longer depends on WU-50's tool names or threshold. WU-50's report is merged as the record
  of the block.
- **CLAUDE.md** (this branch): the development allowance now names the economy endpoints only, and states
  that the builds API is closed by poe.ninja's terms.

### WU-54: criteria review (A-33) and D-336 (PROPOSED by the coordinator)

**The pinned criteria** (`fbfe1bb`): AC-K53 (energy-based meta gems), AC-K54 (skills granted by a support),
AC-K55 (granted skills with no definition), AC-K56 (Gem Studded ties) and AC-K57 (one shape for the flags,
and build mode). Each is pinned to real gems and nodes at the pin, with a Lua-query equality over the
whole set. The coordinator approved them with these choices:
- **Flags in their own list.** The flags go in a separate `flags[]` list, never as a status, so no count
  and no C-47 output changes. Three flags are per gem, and Skeletal Brute has no lines to carry one.
- **The Gem Studded flag is static.**
- **The energy note** says only that PoB doesn't model Energy. Cast on Melee Kill and Spellslinger get a
  trigger rate from Path of Exile 1-style configs, not from Energy.

**D-336: AC-K50 restated.** Amendment 3 misread Mirage Archer's gap. Its only mapped-but-"unread" line is
"cannot consume Charges" (`Condition:CannotConsumeCharges`). PoB does read that condition, in the skill data
(`Data/Skills/act_dex.lua:222`), which the name scan doesn't search. The real gap is the stat
`triggered_by_lingering_mirage`, which has no stat map and no described line (PG-4). Two flags replace the
one:
- **`mapped but unread`** (PG-24): Aftershock I's `AftershockChance` is flagged. For this flag, a name
  counts as read by an exact match, by a use in `Data/` skill definitions, or by a template whose fixed
  parts all match. D-243's suffix rule had let `AftershockChance` through. D-243's line statuses are
  unchanged (AC-K57).
- **`stat not mapped`** (PG-4, PG-49): a support or meta gem stat with no stat map (global or the skill's
  own) and no described line. Mirage Archer reports it, which ends its false all-clear. The set is pinned by
  a Lua-query equality, and presentational stats are excluded by a stated rule, never by a hand list.

### Wave A doer reports

- **WU-51** (`28c1972`): done. The decision line reads "Within NFR-21: the final compile computes Full DPS
  for the named source's groups."
  - Three quiet runs at a 1-minute load average ≤ 8: whole call 26.22–27.77 s with Full DPS off, and
    29.93–31.92 s with it on for the named groups (median ×1.14). Slowest stage 3.08 s.
  - With every group in Full DPS, through the real compiler: 61–67 s, slowest stage 6.17 s. R-32's
    160.68 s came from WU-30's emulation under load.
- **WU-60** (`0bce0f5`): done; gate rc=0/0 (1850 tests).
  - Essences are a fifth mechanic kind, `essence`, which touches the tool's `kind` enum, its README row
    and `tool-calls.json`.
  - "Can roll" means `GetModSpawnWeight` > 0, restricted to bases that use the mod's own affix table.
- **WU-61** (`df7e4a0`): done; gate rc=0/0 (1851 tests).
  - `schemaVersion` 2. A version-1 plan is held to version 1's shape. `VERSION_ADDITIONS` is the list
    WU-55 extends.
  - The two-stage fixture and the worked example now declare version 2.
  - The ladder goes by rung, `m` → `b` → `n`, whatever the plan order. No fixture verdict moved.
- **WU-56** (`38a1d99`): done. Static tests 210 of 210.
  - `patterns.md` is 5,589 words: 60 entries in ten families.
  - An `AWAITING_SKILL_WIRING` entry exempts `patterns.md` from AC-W1 until WU-57 lists it in `SKILL.md`.
- **WU-50** (`306bc7b`): blocked by the terms; resolved by D-335.

**Reviews** are running: WU-60; WU-61 with WU-51; WU-56.

### Reviews: WU-61 and WU-51

- **WU-61:** two low findings, now being fixed.
  - The first rung continued from the last campaign stage *before it in plan order*. It now follows the
    last campaign stage overall, as D-282 words it.
  - `schemaVersion`'s literal union is now built from `PLAN_SCHEMA_VERSIONS`.
  - Every deviation was accepted. To fold into D-332: a version-1 plan that uses a version-2 field is an
    error, so WU-55 inherits that an explicit `count` in a version-1 plan is an error too. To fold into
    D-282: V1 checks a rung's `respec.dropped`, and the gold cost gets only its schema check (A-32).
  - Notes for WU-62:
    - The pipeline fixtures declare `schemaVersion: 1`, so adding an `m` stage needs version 2 and
      regenerated compile records, because `buildProjection` keeps the version.
    - `check-run.mjs:299-301` maps `entering-maps` to area 82, not 69.
    - `check-run.mjs:69` (`VARIANT_H2`) has no `m` heading.
    - `check-run.mjs:688` takes the first endgame stage in plan order, not rung `m`.
- **WU-51:** the decision stands. The reviewer recomputed the sums, medians and the ×1.14 ratio, and
  confirmed that only group 1 was flagged (15 of 90 groups in the saved file) and that `FullDPS` was
  computed. One low finding is being fixed: claims resting on an unkept `results.json`, and per-compile
  checks that were observed but not asserted, are relabelled.

### D-337 (PROPOSED by the coordinator, 2026-10-10): Full DPS in measure-only compiles too

D-293 and §3.6 step 9 keep Full DPS out of measure-only compiles "unless S-N2 shows it is cheap". S-N2
(WU-51) shows ×1.14 on the whole call and at most 3.08 s per stage. That is cheap, so every compile
(measure-only and final) puts the named source's groups in Full DPS. Verification and finalization then
report the same headline figure, and the compiler has no mode branch. Groups outside the named source stay
out of Full DPS (D-306, narrowed). WU-55 builds it.

### Review: WU-56

FINDINGS: 2 medium and 6 low. Being fixed.
- **Grounding.** All 60 entries were checked against their sources: 57 held, and 3 failed. The failures
  were a misfit example (Time-Lost Emeralds), an ungrounded "Dazed" config, and a caution under the wrong
  entry. One more holds but carried no citation.
- **The AC-W1 exemption failed open.** It now expires once a WU-57 file exists.
- **Test fidelity.** The AC-W27…AC-W29 assertions are tightened to the spec's named elements.
- **For the next fold: an AC gap.**
  - The checklist has R1b write `probes/<card-id>/<n>/` and the card's results. But R1b's header `writes`
    don't list them, and the checker's layout list (`check-run.mjs:385`) rejects `probes/` and `cards/`.
    Slice 03's run-folder table has the `probes/` row as a WU-57 target (`03-pipeline.md:98`), but no
    AC-W2 clause makes the checker accept these paths.
  - Proposed: AC-W2 (ff) (WU-58). The checker accepts `probes/<card-id>/<n>/` and `cards.md`, and rejects
    other files there. The run log records each card's probe count, so D-292's cap of 4 can be audited.
  - WU-57 adds the paths to R1b's header `writes`.

### Merges and wave B start

**Merged** (fast-forward, each lane rebased first; the gate runs at the wave gate):
- WU-61 at `2304e7e`;
- WU-51 at `294e174`;
- WU-50's report at `306bc7b`.

Their lanes were removed.

**Review of WU-60: FINDINGS, being fixed.**
- **High.** `Exclusive` mods were given rollable bases from their tag weights. PoB uses that table only
  as the essence fallback (`ItemsTab.lua:3076`; the coordinator checked it). 243 such mods have weights.
  Only the item's own affix table, `Corruption` and `Desecrated` are weighed now.
- **Medium.** The format and essence tests copied the implementation's rules. Literal expectations are
  being added.
- **Low.** `lookups.md` wording, and an essence suggesting itself as the closest name.
- **For the fold.** WU-60 touched three serialized files outside its touches: `toolSchemas.ts`'s `kind`
  enum, the README row and `tool-calls.json`. That conflicts with nothing, now that WU-52 is withdrawn.
  §2.2's header and AC-K4 need the `essence` kind and the name-match rule.

**Wave B started** off `306bc7b`:
- WU-55 (Count and custom modifiers). It extends version 2's `VERSION_ADDITIONS` and builds D-337.
- WU-62 (amendment 2's pipeline). It carries the WU-61 reviewer's notes on fixtures and `check-run.mjs`.

WU-53 starts once WU-60 merges.

### WU-56 merged at `2aca7b4`

All eight review findings were fixed: 212 static tests pass, and `patterns.md` is 5,642 words. One review
finding was wrong: "Dazed" is grounded. The crossbow study's line 51 records PoB's `conditionEnemyDazed`
option, at `ConfigOptions.lua:1684`, so it was restored with a `[crossbow]` citation. Static tests at
the integration head: 212 of 212. The lane was removed.

### WU-60 merged at `331ba26`; WU-53 started

- **The fixes.** Base types now come only from the tables PoB rolls on a base: the item's own affix table,
  `Corruption`, and tagged `Desecrated` mods. Exclusive mods, IncursionLimb mods and untagged Desecrated
  mods carry a `notRolled` reason instead.
- **Tests.** Literal expectations were added: IncreasedLife3's line, JewelBleedingEffect's "2 of 4 bases",
  two Exclusive mods, and both Greater Essence of Haste hits.
- **Results.** `lookupGameData` 27 of 27. Contract, engineKinds, toolHygiene and static: 489 of 489. The
  wave gate runs the full suite.
- **WU-53** started off `331ba26` with A-33's step: it pins its criteria from AC-K58 upward, and settles
  the "Culmination II, then Ailith's Chimes" example. The description has 23 characters left, so WU-53
  reports how its additions will fit.

### WU-54 built (`79a61f4`); one more fix before review

- **Gate:** rc=0/0 (1852 tests).
- **The flags at the pin:**
  - `mapped but unread`: 38 lines over 36 gems.
  - `stat not mapped`: 318 (gem, stat) pairs over 115 gems.
  - Energy: 16 gems.
  - Level from support: 52 pairs.
  - Granted skill undefined: 8.
  - Gem Studded: 3 lines.
- **Deviations accepted:**
  - a line flag carries its entry's full source;
  - names that skill data reads are collected at run time from the loaded tags;
  - every string field of a tag counts as read (with only `var`, 18 more lines were flagged wrongly);
  - a stat counts as described when removing it changes PoB's described lines.
- **D-336, extended: one `stat not mapped` flag per gem.** The flag was noisy: it reported stats PoB takes
  from skill types, such as `is_area_damage`, and the golden build showed 19 flags, 12 of them Pounce's.
  - The note lists the gem's unmapped stat ids and says PoB may derive some of them from the gem's skill
    types.
  - No hand list or id-prefix cut is used beyond `display_`.
- `check_model_coverage`'s description and `references/lookups.md` gain a short account of the flags.
  The coordinator allowed both edits.

### WU-53: criteria review (A-33)

**The pinned criteria** (`883931c`): AC-K58…AC-K65.
- AC-K58: Gemling quality effects.
- AC-K59: "usable by", with skill types and the meta gems that accept a gem.
- AC-K60: item-base implicits, as a sixth mechanic kind, `base`.
- AC-K61: type-granting unlocks.
- AC-K62: what a support can ride.
- AC-K63: phrase searches, with `…` gaps.
- AC-K64: hit-making children.
- AC-K65: stat-set numbers on mechanic hits.

Every example was probed at the pin. **The amendment's example holds as a pair on a skill.** On Whirling
Assault, Culmination II adds `ComboStacking`, which Ailith's Chimes requires (`sup_dex.lua:121`,
`:1634-1635`). The rule follows PoB's own re-check after added types (`CalcActiveSkill.lua:182-212`) and its
one-per-family rule (`CalcSetup.lua:517-527`).

**Approved.** One change: AC-K62 prints the complement when a support supports more than half of all active
gems. Uhtred's Exodus would otherwise list 398 names; it now reads "398 of 399 active gems: all except Abyssal
Apparition".

**Touches granted:**
- `toolSchemas.ts`: the `kind` enum, and the description trimmed by moving detail into the parameter
  descriptions. The description is 1,859 of 2,048 characters, and its first sentence is unchanged.
- `tool-calls.json`: three samples.
- `patterns.md`: short edits where it says these lookups are coming.

**Not pinned, accepted:**
- unlocks for a support with no skill given;
- chains of helpers;
- children outside gem data, such as ascendancy procs, item effects and Mirage Archer's mirages (PG-4);
- "trigger gems" beyond the meta gems.

### Review: WU-54

FINDINGS: 1 high, 2 medium and 2 low. Being fixed.

**What held:**
- No regressions: the old and new `Coverage.lua` give byte-identical statuses and counts over every node, all
  961 gems and the golden build.
- AC-B4.
- Speed: 0.19 s for everything.
- The energy, undefined-granted-skill, Gem Studded and `stat not mapped` rules, spot-checked against
  `vendor/`.

**What didn't:**
- **High: 14 of 38 `mapped but unread` lines were false.** PoB reads those names, and the coordinator
  checked all three cases:
  - minion `limit` names, through `CalcPerform.lua:1298-1303`;
  - stage caps built as `"Multiplier:"..name.."MaxStages"`, at `CalcActiveSkill.lua:866-869`;
  - `AdditionalFlickersPerPowerCharge`, read by a `:Sum` in skill data at `act_int.lua:8673`.

  The fix: minion limits, and string literals passed to modList calls in `Data/Skills`, now count as read.
- **Medium:** names containing `:` skipped AC-K50's whole-template fit.
- **Medium:** the AC-K50 tests copied the implementation. Literal counts and cases with their PoB sources
  are being added.
- **Low:** the energy note's wording.
- **Low:** the `level from support` note now says PoB computes a skill with a global effect only when it is
  enabled.

### Coordinator session crash (2026-10-11), and recovery

The coordinator's terminal (tmux) crashed, and every background agent stopped with it. The state, read from
the lanes:
- **WU-54:** the review fixes are committed (`0a9c278`), and the tree is clean.
- **WU-55:** `707e6e5` and `34f1900`, tree clean, no report.
- **WU-62:** `f64e255`, tree clean, no report.
- **WU-53:** the spec commits, plus uncommitted code. Its doer was resumed from its saved transcript.

The coordinator runs the full gate in the three clean lanes, one at a time. Jest's cache is shared, so no
lane clears it while others run. After the gates, each lane goes to review: a lane that passes goes
straight to its reviewer; a lane that fails goes back to its doer first.

**Friction.** A long-lived coordinator session in tmux can die with the terminal. Lane worktrees and
commits survive, but agent reports are lost unless the agent is resumed.

### Recovery gates and wave B reviews

**Gates in the clean lanes,** run by the coordinator one after another, with no Jest cache clear:
- **WU-55** (`34f1900`): rc=0/0 (1869 tests, then the NFR step).
- **WU-62** (`f64e255`): rc=0/0 (1901 tests).
- **WU-54** (`0a9c278`): test rc=1. One suite failed to compile: a `PobSourceScan` fake in
  `passiveUpgradesBound.test.ts` lacks the new `skillCallNames` field. The doer was resumed to fix it.

**Rebased onto `b4d0382`:**
- **WU-55:** clean, now `34f1900`. Plan and static suites: 299 of 299.
- **WU-62:** it conflicted with WU-56 in `tests/static/buildGuidePipeline.test.ts`, where both had added
  blocks at the end. The coordinator kept both sides and restored the closing lines the merge had dropped
  (`f4ca8f0`). Static and checker suites: 417 of 417.

**WU-53** (`995b765`): built and rebased; gate rc=1/0. The only failure was AC-E8, the bridge cold start
(5,415 ms against its 5 s limit). It passes alone in 4,552 ms: a tooling false-failure.
- The description is 1,859 characters.
- Deviations:
  - same-named gems count separately, so a long list can repeat a name;
  - the complement form prints "all" when no gem is excluded;
  - the 6,435 unlock pairs are recorded as a count only, because computing them takes about 29 s.

**Reviews running:** WU-55, WU-62 and WU-53. WU-55's and WU-62's doer reports were lost in the crash, so
their reviewers also build the AC maps.

### Reviews: WU-62, and the WU-54 re-check

**WU-62: FINDINGS, 1 medium and 4 low.** A fresh fixer is working on them, because the doer's session was
lost.
- **Held:**
  - 346 of 346 tests pass, and the checker exits 0 on all three good fixtures;
  - the fixtures with an `m` rung are at version 2 and validate;
  - `areaLevelOf` maps `entering-maps` to 69;
  - the first rung is taken by rung order (a test moves `m` after `b`);
  - the `m` floor, budget and rolled skill recompute (a mutation fails);
  - the audit template has §7.8's six H2s;
  - no vendor regex and no trade-link field (HG-19, HG-22);
  - clauses (a)…(u) are still enforced.
- **The AC map:** AC-W2 (v)…(z) and the amended (b) and (l) are behaviour tests in
  `buildGuideCheckRun.test.ts`. AC-W11 is static, at `buildGuidePipeline.test.ts:765`.
- **Medium:** the template gave only 5 of §8's 14 word budgets, and W1 doesn't read §8.
- **Low:**
  - the FAQ's "3–5 questions" rule was missing;
  - the guard against pipeline text skipped every fenced block, not only the import code;
  - a fault string named stage b;
  - `references/lookups.md:61` still points at the removed H2 "Confidence and what PoB can't model". WU-53
    and WU-54 also edit that file, so the coordinator fixes this line after those three merge.
- **Out-of-touch edits accepted** as needed for consistency: `pricing.md`, `checkpoints.md`,
  `offline-and-test.md`, and the writer and coordinator agents.

**WU-54 re-check:** 4 of the 5 findings are resolved; `mapped but unread` is down to 23 lines.
- **Medium:** the skill-name wildcard let `*Cooldown` mark Combat Frenzy's cooldown as read. That template
  reads an output field, for three other skills only (`CalcOffence.lua:3452`, `:3529-3549`). The wildcard
  is now limited to templates PoB builds from `activeGrantedEffect.name` in a modList call
  (`Multiplier:*MaxStages`, `*MinimumStage`). The count becomes 24.
- **Medium:** the equality test still mirrors the code, so literal anchors were added: Combat Frenzy,
  `AttackSpeedScalesCost` and `ActiveWolfLimit`.
- **Low:** `modListCallLiterals` gets a unit test, and AC-K53's opening is reworded.
- **The reviewer's scope finding was wrong.** The coordinator had allowed `pobSourceNames.ts` and the test
  fake.

### WU-54 merged at `2629841`

All four re-check findings were fixed. `mapped but unread` is 24 lines.
- A skill name fills `*` only in templates PoB builds from `activeGrantedEffect.name` in a modList read.
  The server finds them and passes them as `sourceSkillTemplates`.
- There are now seven literal anchors with their PoB sources, and a new unit test,
  `tests/unit/pobSourceNames.test.ts`.
- Targeted suites: 315 of 315. The full gate passed at `22e266b`; the wave gate re-runs it.
- The lane was removed.

### Review: WU-55

FINDINGS: 6 low. The behaviour matches the spec.
- **Count is applied once.** PoB reads `groupCount` only for Full DPS, reservation and Umbral Well. The
  record multiplies the per-copy `TotalDPS` by Count, and PoB's own `FullDPS` is never multiplied again.
- **Full DPS** covers only each stage's `rolledGroup`, in both modes (D-337).
- **`customMods`** are written in their own `set_config` call, after the listed options.
- **Version-1 plans** that use the new fields are refused.
- **The AC map:**
  - AC-P51 and AC-P52: `planChecks`;
  - AC-P53…AC-P56: `compileCount.test.ts`;
  - AC-P37 (narrowed): `compilePlanNfr`;
  - AC-B3: `engineKinds`;
  - AC-B4: `contract`;
  - AC-B5: `golden`, `engineTree` and `skillBreakdown`.
- **The NFR compile:** 32.3 s for 15 stages.

**Fixed by a fresh fixer** (the doer's session was lost):
1. A version-1 plan can carry PoB's `customMods` option as a config entry. Stages whose written config holds
   it are now marked too.
2. `plan-reference.md` wrongly said PoB applies Count only to Full DPS. It also scales reservation and
   Umbral Well.
3. The record's doc now says the raw `FullDPS`/`FullDotDPS` are already counted by PoB.
4. An AC-B3 sample now uses `count` and `customMods`.

**Accepted:** the worked example stays the two-stage fixture, with separate snippets for the new fields
(the reviewer's finding 5).

**To fold into the spec:**
- **C-33's new fields** (`recordVersion: 2`):
  - per stage: `countedOutputs {group, count, dotCanStack, fields}`;
  - per stage: `countedSkillOutputs[g<g>s<s>p<p>] {skill, statSetLabel, count, dotCanStack, fields}`;
  - per stage: `customModsWritten: string[]` and `computedWithCustomMods`;
  - per ledger entry: `computedWithCustomMods`.

  The counted `fields` hold:
  - `TotalDPS` and `ImpaleDPS`, multiplied by Count;
  - `TotalDot`, multiplied only when `dotCanStack` is true;
  - the ailment and ground DPS figures, unchanged.

  The headline is `countedSkillOutputs[g<main.group>s<activeSkill>p<statSet>].fields.TotalDPS`. The V1
  finding is `missing-reason`, with `data.path`.
- **C-41:** a new `compile_check` error class, for a custom-modifier line PoB can't parse whole.

### WU-62 merged at `a8506ef`

The fixer closed the four findings:
- every section's word budget now comes from §8's table (lines 1011–1024, a total of 2,840), and a static
  test reads that table from the spec;
- the FAQ placeholder holds the "3–5 questions" rule;
- the fence guard exempts only the import code, and two new checker tests cover it;
- the fault string now names stage m.

One deviation was accepted: the nine sections that had no budget placeholder carry `[About N words.]` lines,
which W1 deletes. Static and checker suites at the merge: 421 of 421. The lane was removed.

WU-57 can start once WU-55 merges (its last hard dependency; WU-50's is moot under D-335).

### Review: WU-53, and the fold-2 lane

**WU-53: FINDINGS, 7 low.** A fresh fixer is working on them.
- **Checked against PoB's own engine.** The reviewer built skills with `calcs.createActiveSkill`, using real
  support lists and PoB's one-per-family rule:
  - unlocks matched for 24 gems, among them Whirling Assault's "Ailith's Chimes: after … Culmination II";
  - `Can support` matched for six supports, including the complement form;
  - "usable by", Gemling quality and children also matched.
- **Size and speed.** The largest single-gem reply is 8,407 characters (Vulnerability, 174 unlock lines).
  The slowest single gem takes 0.55 s in Lua.
- **The fixes:**
  - test the `(none)` form;
  - mark AC-K61's 6,435 as informational (6,339 by name);
  - replace the copied test oracles with `createActiveSkill`;
  - print repeated gem names once with `×n`, and show the long lists for every gem with exactly the queried
    name (the Unleash support was unreachable);
  - one stale `patterns.md` line;
  - move three dropped description facts into the parameter descriptions;
  - label unnamed effects by their first stat set, as PoB's tooltip does (Charged Mark, Voltaic Barrier).

**Fold-2 lane** (`bg/fold-2`, off `efae21b`). A spec editor folds D-335…D-337 into the spec, plus the
built facts of WU-50, WU-51, WU-54, WU-56, WU-60, WU-61 and WU-62, and WU-55's record fields and C-41 error
class. It also writes D-338, PROPOSED by the coordinator:
- R1b's probe paths go in its header `writes`, which WU-57 does;
- a new AC-W2 (ff) for WU-58: the checker accepts `probes/` and `cards.md`, and the run log counts probes.

The spine becomes v1.4. WU-57 starts after this fold and WU-55 merge.

### WU-55 merged at `418b5b5`

The fixer closed the four findings:
- `measuredWithCustomMods` marks a stage whose written config holds PoB's `customMods` option, including a
  version-1 plan's earned or scenario entry;
- the Count docs are corrected (`Calcs.lua:520-521` for the record's `outputs`);
- a new Count sample (#58) compiles `tests/fixtures/plans/two-stage-count/`. That needed a `$COUNT_PLAN`
  placeholder in `engineKinds.test.ts` and `toolHygiene.test.ts`, which are serialized wiring files.

The rebase onto `efae21b`, which includes WU-54, was clean. On the rebased head, the shared-file suites (plan,
compileCount, contract, engineKinds, toolHygiene, modelCoverage and static) passed 658 of 658. The lane was
removed.

### WU-53 merged at `506d89e`; lookups.md touch-up

The fixer closed all seven findings:
- **Engine oracle.** The AC-K59, AC-K61 and AC-K62 checks now use PoB's `calcs.createActiveSkill` as the
  oracle. It agreed with PoB's direct support test on all 268,191 (support, effect) pairs.
- **Same-named gems.** A repeated name prints once as `×n`, and gems that all have exactly the queried name
  each show their long lists. The Unleash support now shows `Can support (47 of 399)`.
- **Unnamed effects** fall back to their first stat set's label: "Charged Mark", and "Beam" for Voltaic
  Barrier.
- **The description** is 1,894 characters.

The rebase onto `533a25e`, which includes WU-54, WU-55 and WU-62, was clean, and the README table was
unchanged. The shared-file suites (lookup, modelCoverage, contract, engineKinds, toolHygiene and static)
passed 605 of 605. The lane was removed.

The coordinator's `d294756` fixes two stale passages in `references/lookups.md`:
- the same-name rule, from WU-53;
- the guide's renamed H2, "What PoB can't show", plus `audit.md`'s "What PoB doesn't model". This was WU-62's
  low finding 4 (D-278).

**Friction, again:** a stale `build/` in the integration worktree failed AC-G1 until `pnpm build` ran.

### Wave gate (waves A and B): PASS at `370fddb`

An independent verifier ran the gate from a clean tree, with `build/`, `coverage/` and the Jest cache
cleared and `POB_SKIP_ENGINE` unset.
- `mise run test` rc=0: 122 of 122 suites and 1984 of 1984 tests, none skipped. The NFR step passed 2 of 2;
  the fifteen-stage compile took 27.4 s.
- `pnpm build` rc=0.
- Both waiver files are `[]`, and `package.json` and the lockfile are unchanged since `acec4d1` (AC-B7).
- The tool count is 84, and 83 with poe.ninja disabled (AC-G1, AC-E65, AC-T41, AC-T45).
- **Absence checks.** Every AC of WU-53, WU-54, WU-55, WU-56, WU-60, WU-61 and WU-62 has a passing test,
  and AC-P37 is in its narrowed form.

### Spec fold v1.4 merged (`8224211`, `b5f19b7`)

- **New decision rows:**
  - D-335, the user's;
  - D-336…D-338, PROPOSED by the coordinator.
- **Restated:** D-297 (economy endpoints only) and D-298 (judgment, no threshold).
- **Withdrawn, as stubs:** C-54, WU-52, AC-K47…AC-K49, D-324, and AC-W5's poe.ninja clause.
- **As-built:** WU-50, WU-51, WU-53, WU-54, WU-55, WU-56, WU-60, WU-61 and WU-62. The coordinator flipped
  WU-53 and WU-55 after they merged during the fold.
- **The conflict.** It was in slice 01's §5 test table, between WU-53's row and the fold's rows. The
  coordinator kept both sides.
- **For WU-57**, from the editor's report:
  - the card template's "players use it (poe.ninja)" status word and Evidence fields predate D-335. AC-W27's
    static test pins them, so WU-57 restates both;
  - R1b's header `writes` gains the probe and card paths (D-338);
  - the poe.ninja lines in `SKILL.md` and the coordinator agent are reworded (AC-W33).
- **Static tests:** 233 of 233.

**Next:** WU-57, the pipeline. Its dependencies are all merged: WU-55, WU-56 and WU-62. WU-50's edge is moot
under D-335.

### WU-57: AC-W32 pinned (A-33); built (`f74c478`)

- **AC-W32 (pinned and approved).** D-295's wordings of D-122 and D-148 appear in D1, `gates.md` and the
  coordinator agent. "named damage source" appears in `SKILL.md` and eight stage references. No skill or
  agent `.md` matches "rolled (main) skill". Identifiers stay, and so does "the roll".
- **Built.** Gate rc=0/0 (2019 tests).
- **ACs:** AC-W14, AC-W27 (restated for D-335), AC-W30…AC-W33, plus a block for D1's Count, the D1 gate's
  figure × count, D2's bridge skills and EHP.
- **Deviations, in review:**
  - steps 2a/2b/2c are sub-steps;
  - the skeleton stage id is `r1a2e`;
  - a non-skill card's R1b verdict is `compiled: fail`, code `not-a-skill`, never retried;
  - the slugs `open-<skill>` and `open`;
  - the runner reads `cards.md`;
  - the `cards.md` format;
  - `AWAITING_SKILL_WIRING` removed;
  - wording and route edits in seven references outside the touches.
- **For WU-58:**
  - card ids where the checker matches `c<n>` (`check-run.mjs` :462, :663, :1298, :1343, :1351, :1788);
  - `KNOWN_TOP` gains `cards/`, `cards.md` and `probes/`;
  - the verdict form gains "Effective HP about <n>." (dd);
  - the D1-gate recompute and the verdict-line DPS read `countedSkillOutputs` (ee);
  - an R1b `not-a-skill` fail gets no retry;
  - run-log v3: the brief, the roll null until the verification gate, the gate names, R1a-assemble, the
    `verification` escalation, the answers `pick:`/`verify:`/`first-n`, and the `answers.*` test keys;
  - the checker's messages still say "rolled skill" and "checkpoint 1".

### Review: WU-57

FINDINGS: 2 medium and 5 low. The doer was resumed to fix them.

**What held:** 456 of 456 tests; the checker reports `ok` on `run-ok`; WU-58's files are untouched; and every
poe.ninja or popularity hit is either D-335's rule or the user's notes. All deviations were accepted.

**The findings and their fixes:**
- **Medium: a non-skill card showed as "failed".** It now has its own status, "can't be finalized yet: its
  damage source isn't a skill" (D-303, D-334). It has no plan path and is not in D-141's failure list.
- **Medium: nothing produced the deck's under-played cards.** Fixed by D-339 (PROPOSED by the coordinator,
  2026-10-11):
  - each R1a focus writes 3 cards, at least one of them on a library shape it judges under-played,
    labelled `judgment`;
  - R1a-assemble deals 6–9 cards and keeps at least two under-played cards in the deck, which accumulates
    over rounds;
  - a round under 6 cards is short, with the reason recorded in the run log, and the checker accepts it only
    with a reason.
- **Low: D-296's estimate label** on the verification gate's DPS.
- **Low: D-340 (PROPOSED by the coordinator).** A compared field with a counted copy is read from
  `countedSkillOutputs`; any other field comes from the raw per-copy `skillOutputs`, labelled "per copy" when
  Count > 1.
- **Low: stale `c1` ids** in the gate and source-marker examples. `D2-gate.md` was granted as a touch for
  this.
- **Low: AC-W31's test** now also asserts the three gate step rows.

**For WU-58** (the reviewer's additions):
- an R1b `not-a-skill` fail is terminal;
- the slug comes from the brief;
- the run log names the probe-count field;
- `run-log.md`'s first write must match `SKILL.md`'s.

### WU-57 merged at `c872dea`

All seven review findings are fixed.
- **D-339, as applied.** A card's pitch labels it `Under-played (judgment)`. R1a-assemble returns
  `short: <why>`, and the runner records `shortReason` on its `stages[]` entry.
  - The doer's addition, accepted: a round is also short when the deck still holds fewer than two
    under-played cards after it.
- **D-340** is written in `gates.md` and `D1-gate.md`.
- Static and checker suites at the merge: 462 of 462. The lane was removed.

WU-58 started off `c872dea`, carrying WU-57's "for WU-58" list and the reviewer's additions.

### WU-58 built (`ef93a2a`); WU-59 prep with the user's brief

**WU-58.**
- Gate: rc=0/0, with 2076 tests.
- AC-W2 (aa)…(ff) are covered in `buildGuideCheckRun.test.ts`, and 12 mutation checks confirm the tests
  bite. The checker exits 0 on `run-ok`, `run-ok-online`, `run-escalated` and `run-ok-v2`.
- Deviations, in review:
  - `playstyle` is a list of strings;
  - each R1b entry carries a `probes` count;
  - `run-ok-v2` is the old `run-ok`, because WU-47's recorded runs predate WU-62's guide format;
  - Effective HP is optional in schema 2;
  - card ids use researcher letters a–c only.
- Two pinned static assertions moved: the verdict-line form is now plain equality, and the rule sentence
  uses `pick:r1-a-2`.

**WU-59's brief (the user, 2026-10-11).** The skill is **Explosive Concoction**, with any ascendancy. At the
pin it is an ascendancy skill:
- its gem is `SkillGemAscendancyExplosiveConcoction`, with `fromTree = true`;
- only the Pathfinder node "Grants Skill: Explosive Concoction" grants it (`TreeData/0_5/tree.lua:86216`).

A correct brainstorm therefore narrows to Pathfinder and says why. No study and no pattern-library entry
mentions the skill.

**WU-59 prep** (lane `bg/wu-59`) has started. It pins the criteria (A-33) and designs:
- run A (the open brief);
- run B (the failure routes);
- the P1 and P2 probes;
- the faults that drive WU-47's exception E4 paths: D-264's claims-only path, D-265 (b)–(e) and D-266.

It also builds `/tmp/m14.*` in the shape of `/tmp/m12b.B0zi`.

### Review: WU-58

FINDINGS: 5 low. A fresh fixer is working on them.
- **No false rejections.** The reviewer ran every path of the skill as fixture copies:
  - a fixed roll, and an open brief (`{}` → `open`);
  - `more` at both gates;
  - a second verification round;
  - a short round with its reason;
  - a `not-a-skill` card;
  - `first-n` and `first-viable`;
  - the `verification` escalation answer;
  - offline and online pricing.
- **(aa)…(ff) and D-339** each fail their broken copies.
- **The fixes:**
  - the final gate's answer is held to the end status;
  - the escalation answer is matched to `escalations[k].choice`;
  - the probe count includes failed probes. That one-line edit to `R1b.md` is granted;
  - a card file for a round that never ran fails;
  - a schema-2 log rejects the schema-3-only fields.

**D-341 (PROPOSED by the coordinator, 2026-10-11): D-326 restated.** The checker accepts schema-2 run logs
under the schema-2 log rules. Artifacts are held to the current formats, though. Since WU-62, the guide's 14
H2s and `audit.md` don't depend on the log schema, so WU-47's recorded runs can't pass. M-12's record stands
as written, closed with exceptions E1–E4. Keeping schema 2 now keeps logs written before v3 readable; it no
longer keeps WU-47's runs checkable. `run-ok-v2` is the regression fixture for the schema-2 log rules.

### WU-58 merged at `85c70c9`

All five review findings are fixed:
- **The final gate's answer is now tied to the run's end status** (`checkpoints.md:78`, `:86`, `:136`):
  - accept → `completed`;
  - a default `stop` → `stopped`;
  - any other answer → `not-accepted`.
- **Escalation answers** match their escalations one for one.
- **The probe count** includes failed probes.
- **Card files** for rounds that never ran now fail.
- **A schema-2 log** now rejects the schema-3-only fields.

The static and checker suites pass 532 of 532, and the checker exits 0 on all four good fixtures. The lane
was removed.

Every M-14 unit is now merged except WU-59, the recorded run. The final wave gate runs next, and then the
WU-59 worktree is created at the gated head.

### Wave gate (WU-57, WU-58 and fold v1.4): PASS at `3482642`

An independent verifier ran the gate from clean, with the Jest cache cleared and `POB_SKIP_ENGINE` unset:
- `mise run test` rc=0: 122 of 122 suites and 2095 of 2095 tests, none skipped. The NFR step passed 2 of 2;
  the fifteen-stage compile took 25.8 s.
- `pnpm build` rc=0.
- Both waivers are `[]`, there is no dependency change, and the tool count is 84 (83 with poe.ninja
  disabled).
- The ACs of WU-57 (AC-W14, W27, W30…W33) and WU-58 (AC-W2 (aa)…(ff) and D-339) pass, and the checker
  exits 0 on all four good fixtures.
- None of the earlier units regressed.

**Every M-14 build unit is merged and gated.** WU-59's worktree, `pob2-mcp-wt/m14`, is a detached checkout
of `3482642`, bootstrapped and built.

### WU-59's criteria merged (`f1105d0`); D-342, the user's direction: an ascendancy-locked skill

**The criteria.** WU-59's are AC-W34…AC-W50, pinned by the prep step (A-33) and reviewed by the
coordinator.
- **The environment** is `/tmp/m14.zfPx`. Its launcher matches attempt 3's safety settings, and its paths
  check out.
- **Sessions:**
  - P1: invalid briefs and the test-config refusals;
  - run A: the open brief, with answers `first-n:2`, `first-viable`, then a claims-only `revise:` and
    `accept`, and FI-1/FI-2 on attempt 1 only;
  - run B: `more`, no viable card, FI-3 and an escalation answered by default;
  - P2: a seeded `not-a-skill` card.
- **Estimate:** about 205M cache read and 1.6–2.1M output in total, on Opus.
- **A slip.** The prep agent's launcher test ran `claude` once without a TTY. It exited at argument
  parsing: no session, no model call, nothing written.

**The risk the prep found.** Nothing makes a card for a tree-granted skill use the ascendancy that grants
it. The identity check confirms only that the ascendancy exists and the skill is active, and PoB computes
an Explosive Concoction group on any class.

**D-342 (the user's direction, 2026-10-11): check whether the skill limits the ascendancy, and fail fast if
a card ignores it.** It becomes a new unit, WU-63, with no server change:
`search_tree_nodes {query: "Grants Skill: <skill>"}` already prints the granting node's ascendancy.
- R1a and R1a-assemble run that search for the brief's skill. If an ascendancy node grants it, every card
  uses that ascendancy and says why.
- R1b's identity check repeats the search. A card whose ascendancy doesn't own the granting node fails
  before any compile with code `wrong-ascendancy`. That failure is terminal, never retried.
- The checker accepts `wrong-ascendancy` as terminal.

The run worktree `m14` moves to the head that includes WU-63 once it is gated.

### WU-63: built, reviewed, fixes under way

**Built.** The lock code is in `7135280`; `9e9cceb` adds the finalize bar (a `wrong-ascendancy` card is never
finalized, not even "anyway"). Static and checker suites: 538 of 538.

**Review: FINDINGS, 1 medium and 4 low.** The flow and both checker bars hold, and `not-a-skill` didn't
regress. The pinned tree has 54 tree-granted skills, each granted by a single ascendancy node.

**Coordinator rulings, extending D-342:**
- **Lock every skill on the card.** The lock checks every skill the card names (its damage source, chain
  and links), not only the damage source.
- **When the lock applies.** It applies only when:
  - every granting node is an ascendancy node;
  - none of those nodes is the card's;
  - no unique grants the skill. The Covenant also grants Life Remnants.
- **Check the brief at step 1.** A brief naming an ascendancy that can't use its skill stops at step 1's
  brief check, before any agent starts. The runner gains the `search_tree_nodes` lookup, and AC-W34's
  wording follows.
- **Test fidelity:**
  - an order assertion (the lock comes before FI-1);
  - a consistent `wrong-ascendancy` fixture card;
  - a pre-supplied pick of a locked card ends the run `stopped`.

### WU-63 merged at `736733f`; the run worktree is ready

The fixes cover every review item:
- the lock checks every skill a card names;
- it applies only when every source is an ascendancy node and no unique grants the skill;
- a self-contradicting brief stops at step 1's brief check, with `search_tree_nodes` added to the runner
  (FR-W3 and AC-W34 updated);
- an order assertion and a consistent Explosive Concoction-on-Warrior fixture card.

**Deviations accepted:**
- the unique search uses the mechanic-mode query on the skill name, because The Covenant's line is
  "Grants Skill: Level (1-20) Life Remnants";
- a pre-supplied pick of any card the gate can't finalize ends the run `stopped`;
- R1b runs the lock first for every card.

**Left for fold v1.5:** FR-W2's text on the roll check.

**Checks at `736733f`:** static and checker suites 543 of 543, and the checker exits 0 on all four good
fixtures.

**The run worktree.** `m14` is moved to `736733f` and built. `/tmp/m14.zfPx/README.md` gains a sixth P1
command, `/build-guide Titan "Explosive Concoction" --offline`, which should stop at the brief check. It is
evidence for D-342, to fold into AC-W47.

**Waiting on the user** to start the WU-59 sessions.

## 2026-10-11: WU-59, P1 check 3 fails; WU-57 re-opened

**What happened.** For `/build-guide a Fork build, any ascendancy --offline`, AC-W47 (c) expects a stop that says
Fork is a support gem. Instead the runner looked Fork up, found a support gem, and parsed the brief as
`{around: "Fork", notes: "any ascendancy"}`. With no `skill` field, the brief check had nothing to reject. The
runner then saw that the Agent tool was missing and stopped before step 2. It created no folder; the guides root
is still empty.

**Two defects in the skill text (WU-57 owns the brief):**
1. **The brief's fields.** `skill` is defined as an active gem, and `around` as "an item or mechanic", so a
   support gem routes to `around` and the D-258 refusal never fires. AC-W47 (c) and the skill disagree.
2. **No rule for a missing Agent tool.** The runner improvised a check before step 2. P1's checks 4 and 5
   (AC-W48) need steps 2 and 3 (the run folder, and a run log that records the refused config) to run first,
   so the same improvisation would fail them.

**Coordinator rulings (PROPOSED):**
- **D-343.** In free text, a support gem named as the build's subject goes in `around`, and the reply says it
  is a support whose researchers will look for skills it can support. The fixed roll's second name is always
  `skill`, so `/build-guide Pathfinder Fork` stops with "Fork is a support gem" (D-258). P1 check 3 becomes
  that fixed roll, and a seventh check runs the free-text Fork brief: Fork goes in `around`, the run makes its
  folder and run log, then stops at the first agent step.
- **D-344.** Steps 1 to 4 always run before any agent. A missing Agent tool stops the run at its first agent
  step: `status: "stopped"`, with the reason in the run log and the reply.

**Next:** the user runs P1's checks 4 to 6 in the same session, for evidence. A doer fixes WU-57 in `amend`,
and P1 then re-runs from the start on the fixed head.

### WU-57 re-open: fixed, reviewed, accepted at `312c264`

**P1 evidence, first attempt** (the session's run folder is moved to `/tmp/m14.zfPx/attempt1-p1/`):
- **Check 4** stopped early for the missing Agent tool: no folder and no run log. That is defect 2.
- **Check 5** passed AC-W48 (b): the config was refused, `status: "stopped"`, and the checker exits 0.
- **Check 6** passed the D-342 brief check: it names node 38004, stops before any agent, and creates no folder.

**The fix.**
- **The doer, `757cebb`.** It implemented D-343 and D-344 in SKILL.md and R1a.md, rewrote AC-W47, and added static
  and checker tests.
- **Accepted deviations:**
  - no run-log field for a stop reason (the reply carries it, as for a refused config);
  - a sentence in R1a.md;
  - WU-59's P1 count updated;
  - AC-W47 retitled "the brief check".
- **Review 1: FAIL.**
  - *Blocker:* the fixed roll was defined by whether its names are valid, so the misspelled checks 1 and 2 could
    pass as free text.
  - *Should-fix:* AC-W48 didn't require check 4's stop.
  - *Should-fix:* `around` wasn't recorded by the lookup's name.
  - *Nit:* step 3's stop path wasn't spelled out.
  - *Nit:* the checker test missed check 4's log shape.
  - *Declined nit:* widening D-344 to a refused Agent call. The missing-return rule owns that case.
- **The doer, `10d4792`.** It fixed all five: the fixed roll is now defined by its shape, as two names whatever
  the lookups find. Gate: 2117 of 2117, rc 0 and 0.
- **Review 2: PASS for P1.**
  - *Should-fix:* a gem-lookup miss could stop a brief whose subject is an item or a mechanic.
  - *Nit:* an unquoted `Blood Hunt` counts as two names.
- **The doer, `312c264`.** It fixed both:
  - a lookup miss stops a run only for a name the user gives as the skill, and items and mechanics go in
    `around`;
  - an unquoted brief that the gem lookup finds whole is one name.

  The coordinator read the diff and accepts it. Static suites 284 of 284, checker suites 270 of 270. Only the
  skill text and the static test changed, so the full gate was skipped: `10d4792`'s gate covers everything else.

**Next.** The run worktree moves to `312c264`. `/tmp/m14.zfPx/README.md`'s P1 list now has seven checks:
- check 3 is `/build-guide Pathfinder Fork --offline`;
- check 7 is the free-text Fork brief.

P1 then re-runs from the start.

### WU-59 P1 (second attempt, at `312c264`): all seven checks pass

Evidence: transcript `a30c5754-…` under the m14 project key, plus the guides root.

| # | Brief | Outcome |
|---|---|---|
| 1 | `Pathfinder "Explosive Concotion"` | stops; lists the lookup's active names in order, Explosive Concoction first; no folder |
| 2 | `"Pathfindr" "Explosive Concoction"` | stops; names Pathfinder from `get_classes`; no folder |
| 3 | `Pathfinder Fork` | stops: "Fork is a support gem"; no folder |
| 4 | free text, `--test A.json`, online | `open-explosive-concoction/…-1`: `mode: "online"`, `testConfig: "refused"`, `stopped`, no stages; checker ok |
| 5 | free text, `--offline --test M.json` | `…-2`: `testConfig: "refused"`, `stopped`; the reply names the retired keys; checker ok |
| 6 | `Titan "Explosive Concoction"` | runs the lock lookups; stops naming node 38004 and Pathfinder; no folder |
| 7 | `a Fork build, any ascendancy` | says Fork is a support gem; `open/…-1` with `brief: {around: "Fork"}`, `stopped`, no stages; checker ok |

- **No agent ran**, and no web or `/mnt` call was made. The m14 worktree's `git status --porcelain` is empty.
- **Nit for the analysis:** the runner's Bash used `echo` beside `cat`/`jq` and the checker (`echo "rc=$?"`).
  `echo` writes nothing, but D-265's list doesn't name it.
- **Next:** run A.

### WU-59 run A: the gates printed no display (AC-W37 fails); WU-57 re-opened again

- **Run A:** folder `open-explosive-concoction/2026-10-11-3`, transcript `17907107-…`.
- **The gates.** The brainstorm gate (`first-n:2` → `pick:r1-a-1,r1-b-1`) and the verification gate
  (`first-viable` → `pick:r1-a-1`) were both answered `pre-supplied`. The runner went straight from "assembling
  the deck" to R1b, and from R1b-assemble to D1. It printed neither the deck nor the comparison lines.
- **The rule it skipped.** `references/checkpoints.md` ("A pre-supplied answer still prints the display",
  D-265 (b)) and AC-W37 require each gate visit to print its display, pre-supplied answers included. SKILL.md's
  gate paragraphs (step 2c, step 5) don't repeat the rule; only the reference holds it.
- **The deck itself is sound.**
  - 7 dealt cards, 4 of them labelled under-played, and 2 not dealt (a missing source, a duplicate).
  - Every card is Ranger Pathfinder, so the D-342 lock held for "any ascendancy".
  - Every card says "no player evidence".
- **Decision.** Run A continues untouched; the user doesn't type into it. Its design, guide, V4 and final-gate
  evidence doesn't depend on this.
- **The fix.** WU-57's doer puts the display rule in SKILL.md at every gate, in `amend`. The run worktree moves
  only after run A ends, so run B, which has two brainstorm visits and several verification visits, carries
  AC-W37's evidence at the fixed head. Run A's AC-W37 result is recorded as a fail at `312c264`.
- **Fixed at `4eb18ef`; the coordinator read the diff and accepts it.**
  - A new Hard rules bullet: "Every gate visit prints its display first, in your reply, whoever answers it
    (D-265)". A pre-supplied or default answer then states what it resolved to.
  - Each gate paragraph opens with a pointer to it: steps 2c, 5 and 16, and the §5 escalation.
  - Static suite 286 of 286, checker suite 270 of 270. Only SKILL.md and the static test changed.
- **Pending:** move `m14` to `4eb18ef` and rebuild it after run A ends, before run B.

### WU-59 run A ended; its token cost; run B on hold

- **Result.**
  - `status: "completed"`, roll Ranger / Pathfinder / Explosive Concoction, and `check-run` exits 0.
  - The final gate answers came from the test config (`pre-supplied`): `revise:` (the Mana Flask claim), then
    `accept`.
  - The seeded check AC-W44 (f) passes on a scratch copy. An item text added in `plan.json` gives
    `[record-plan]`, exit 1.
- **The run worktree** is at `4eb18ef` (the gate-display fix), rebuilt, with an empty `git status`.
- **Cost, all on Opus.** Cache read 296.2M, cache write 9.05M, output 1.78M, over 37 transcripts and 1695 API turns.
  The estimate was about 130M cache read.

**By kind:**

| Kind | Runs | Cache read |
|---|---|---|
| V4 | 11 | 104.9M |
| D1 | 4 | 41.2M |
| R1a | 3 | 36.8M |
| D2 | 3 | 36.0M |
| R1b | 4 | 25.5M |
| runner | 1 | 21.6M |
| W1 | 4 | 16.3M |
| gates and assembles | | 14.0M |

**Where the turns came from:**
- **One pass of each step:** about 208M. D1 attempt 1 and D2 attempt 1 each took about 33M, over 104–109 turns
  with a peak context of 500–545K.
- **Real failures:** about 45M. V4's first pass failed all three lenses, which led to a D1 fix round, D2, a W1 fix
  and three rechecks.
- **The test's `revise:`:** about 40M. A claims-only change re-ran full V4 passes on all three lenses (about 30M),
  and two lenses failed again.
- **Injected faults:** about 3.6M. FI-1 caused two R1b retries, and FI-2 one D1 retry.

**The mechanism.** Cache read is the sum, over an agent's turns, of its context size. Context grows with every
tool result, and nothing leaves it.
- Agents read `plan.json` (206 KB: 133 claims, 48K characters; ledger 42K; config 26K) 130 times, 116 of them as
  partial reads, about 3.3M characters in all.
- Agents read `compile-record.json` (388 KB) 61 times.
- Long agents take 100 or more small sequential steps: D2 ran 38 Grep, 38 Edit and 29 Read calls.

**Run B is on hold** until the user has looked into the cost. With costs like run A's, it would probably exceed
150M.

## 2026-10-11: the user's direction on cost and scope (amendment 4, in preparation)

After run A (296M cache read, 1.78M output), the user compared the output with Fubgun's guide. Decisions:

- **D-345, verify only what the build hinges on.**
  - Before spending tokens verifying a claim, ask whether the build's success or failure hinges on it.
  - Superfluous content that is expensive to verify is removed, not verified.
  - The bar is a top human guide, and those are full of errors.
- **D-346, the endgame gets the effort.**
  - The campaign needs a rough upgrade order, the tree pathing and the support gem order, plus a target life per
    act.
  - No resistance or defence calculations in the campaign.
  - Name the build-specific mods to target, and leave resistance balancing to the player until the endgame.
- **D-347, the endgame's measures.**
  - Report DPS and EHP, and whether the build survives the Arbiter of Divinity's max hit, which decides whether it
    can clear all content.
  - Clear speed is rough (fast, medium or slow), plus how many hits or clicks a kill takes.
  - No boss kill time.
- **D-348, no crafting guidance.** Players buy gear on trade.
- **D-349, the output budget.** A run uses at most 1M output tokens.
- **D-350, the cuts to investigate.** The coordinator's six cuts are approved for investigation:
  - claims cut to the ones the build hinges on;
  - one checker, with the ledger checked mechanically;
  - the audit file generated, or limited to estimates;
  - the dossier reduced to the comparison table;
  - no boss kill-time modelling;
  - caveats said once.

  The paging and context growth of the long agents are investigated too.

**Issues the user found in run A:**
- **I-1, amulet anoints.** No guide mentions one. An anoint fits a notable from an unreachable part of the tree.
- **I-2, support slots on granted skills.** They follow level: character level for a tree-granted skill, item level
  for an item-granted one. The guide assumes Jeweller's Orbs for Explosive Concoction. The thresholds need finding.
- **I-3, more than one tree root.** The compiled tree has several roots.
  - The Pathfinder's Path of the Sorceress (node 12795: "Can Allocate Passive Skills from the Sorceress's starting
    point") can make a second root legal.
  - **The user's rule** (checked against real builds that take Path of the Sorceress):
    - the class-start tree and the Sorceress-start tree are separate, and that is legal;
    - each start holds only **one** tree, so two branches from the same start are illegal;
    - at most 2 trees in all, and 1 without Path of the Sorceress.

    Run A's build has **four** trees, so it breaks the rule. The investigator confirms this per loadout and finds
    the fix point.
  - Still to check, per loadout:
    - Sorceress-side nodes before 12795 is allocated;
    - any other root;
    - whether the compiler validates connectivity.

**Next:**
- Three read-only investigations: the cost mechanics, the claims and content inventory with the rules behind it,
  and I-1…I-3.
- Then the amendment 4 draft for the user.
- Later, the user's own poe.ninja Explosive Concoction build is compared with run A.
- Run B stays on hold.

### The three investigations reported (reports in `studies/`, dated 2026-10-11)

- **Cost mechanics** (`cost-1-mechanics.md`).
  - **Context over all turns** totalled 305M: `plan.json` 59M, the reference docs 42M (`plan-reference.md` 11.6M
    over 22 reads), retained thinking 39M, the system prompt and the brief 37M.
  - **Why the agents page `plan.json`:** Read stops at line 755 of 2,848. The V4 checkers are told to read the
    whole plan. And `compile_plan` returns no per-stage figures, so agents Grep the record after every compile.
  - **Output is under-recorded** in the transcripts: a 60K-character Write is logged at 8 tokens. The real output
    is about 2.3–2.5M, 63% of it thinking. D-349 therefore needs a reliable counter.
  - **Levers by cache read saved**, which overlap to about 100–130M in all:

    | Lever | Saving |
    |---|---|
    | re-check only the changed claims | ~41M |
    | narrow plan and record views | ~37M |
    | batched tool calls | ~32M |
    | split D1 and D2 | 17–23M |
    | per-stage reference excerpts | ~18M |
    | runner fixes | ~6.5M |
- **Claims and rules** (`cost-2-claims-and-rules.md`).
  - **The 133 claims:**

    | Class | Count | Note |
    |---|---|---|
    | the build hinges on it | 29 | 24 of them endgame |
    | proven by the compile | 42 | |
    | reasons | 27 | |
    | superfluous | 35 | 12 are Arbiter kill times |

    No compile-proven claim or reason was ever found wrong.
  - **A guide defect.** Both endgame rungs say "solid", but the Arbiter's slam one-shots them (max hit 0.66 and
    0.85 of the slam).
  - **Rules.** The report gives each costly layer's rules at file:line. A revise re-runs all three lenses in full
    (P3:699-706), and round 2 overwrote round 1's reports.
- **Run A issues** (`run-a-issues.md`).
  - **I-1:** an anoint is the amulet line "Allocates <notable>". 875 notables have a three-emotion recipe. It
    compiles today, but no step, template or tool has a place for it.
  - **I-2:** PoB2 has no support-socket rule for granted skills, and our data has no thresholds, so they need the
    user's source. Nothing checks support counts. `guide.md:94`, which saves Jeweller's Orbs for the concoction, is
    wrong under the user's rule.
  - **I-3:** PoB2 keeps a separate Sorceress tree (node 12795 links to the Sorceress exits 4739 and 44871). Run A
    has two Ranger trees from stage 2 and four trees from stage 6.
    - PoB2 v0.23.1 enforces one exit per start neither in the UI code nor on import; a headless probe confirms
      import. The user says the UI blocks it; a newer PoB2 may differ.
    - The fix goes in `pob-api/API/Compile.lua:182-285` and in `find_path_to_node`.

### Amendment 4 drafted (PROPOSED), for the user's approval

`spec/amendment-4-cost-and-scope.md` (about 3,200 words) holds proposals D-351…D-361, work units WU-64…WU-72,
milestone M-15, and AC-W51…W58, AC-P60…P67 and AC-K66. It has six open questions:
- Q1: the support-socket thresholds and their source;
- Q2: the clear-speed rule;
- Q3: whether a revision counts against the 1M;
- Q4: 150M cache read as a reported target;
- Q5: anoints on `b` and `n`;
- Q6: dropping runs B and P2.

The coordinator read the draft in full and found no blocker; it goes to the user as written.

### Amendment 4: the user accepts all proposals, with answers (2026-10-11)

- **The proposals.** All are accepted (D-351…D-361, the triage and ledger rules included), with one change: D-353
  drops hits to kill normal monsters.
- **Q1, support sockets.** No source has the thresholds.
  - Jeweller's Orbs work on items that grant skills, but not for skills granted by passives.
  - Until exact numbers turn up, use estimates: 3 supports in Act 2, rising to 5 by the campaign's end.
- **Q2, clear speed.** Rough, and not worth much effort.
  - The proxy is the skill's area, assuming a normal monster dies to one use: 0–2 m slow, 2–4 m medium, 4 m or more
    fast.
  - Explode-on-death or spread-on-death effects give a bonus; a long use time gives a penalty. No exact formula.
- **Q3.** A revision doesn't count against the 1M, for now. Revisit it if revisions prove heavy.
- **Q4.** Output tokens matter more than cache reads, but keep each agent's context to a minimum. The target is the
  coordinator's call.
- **Q5.** Anoints on budget and non-budget. A player who can afford one before maps can look ahead.
- **Q6.** Runs B and P2 are dropped.
- **D-362 (the user): a design gate.** The user gates the endgame build before the leveling loadouts and the guide
  are made. Today's gates are brainstorm, verification and final, with nothing between D1 and D2. The coordinator
  sees no reason against it.

### Spec v1.5 folded at `9d4654e`

- **The fold.** A doer folded D-339…D-362, amendment 4, M-15, WU-63's block (AC-W61, AC-W62), the as-built WU-57
  and WU-58, WU-59's re-scope, and WU-64…WU-72 with their ACs. The diff is 4 files, +1354/−446. Static tests
  286 of 286.
- **Review: FAIL, with 4 should-fix findings and no blocker.** A fresh fixer fixed them all:
  - **HG-12:** the acceptance of amendment 4 is recorded as the user's HG-12 decision on D-360's tool changes.
    *Confirm with the user.*
  - **Open items:** A-34 (the round copy by script) and A-35 (the design gate's display, from the D1 gate's
    verdict file).
  - **The checker:** FR-W7 (2) and (3) gain the `[ledger]`, floor and verdict-line targets, and
    `buildHash.ts` moves to WU-65.
  - **The verifier:** AC-W14 and R-5 gain targets for its Write access.
  - **The nits.**
- **For WU-71.** AC-W2 (t) and FI-4's doubled formula still describe `[ledger]` as it is built. Update them when
  WU-71 changes the check.
- **Next:** the user compacts the context. Then the M-15 build starts, with WU-64 and WU-65 first.

## 2026-10-11: M-15 build start (amendment 4)

- **The user signed off every amendment 4 change** ("All amendment 4 changes are signed off on. Start the
  implementation."). That settles HG-12 for D-360's changes to `find_path_to_node` and `get_nearby_nodes`:
  WU-66 may change both tools' behaviour as D-360 states. Spec v1.5 (`9d4654e`) is binding.
- **The fleet's rules** (`build-handoff-amendments.md`) gain an M-15 section: spec v1.5, the directive
  WU-64…WU-71, M-15's serialized files, no poe.ninja for any M-15 unit, and HG-12 granted for WU-66 only.
- **Wave 1:** WU-64 (the output-counter spike) in lane `bg-64` and WU-65 (plan schema 3, the anoint, the
  record's `measures`, the key-figure lines, `buildSha1` without the ledger) in lane `bg-65`, both off the
  integration head. Before WU-64 starts, the coordinator asked the Claude Code guide agent which Claude Code
  sources carry final output-token counts (telemetry, the status line), as the spike's candidate ground truth.
- **The guide agent's answer** (official Claude Code docs):
  - OpenTelemetry's `api_request` event and `claude_code.token.usage` metric count output once per API request,
    subagents included (`query_source` = `subagent`). The exporters are `console`, `otlp` and `none`; no file
    exporter is documented.
  - The status line's output field is the latest response only.
  - `/usage` is meant for API users.
  - Hooks carry no usage.

  So the spike tests a transcript estimate against telemetry from a short control session the user runs, through
  a localhost OTLP receiver that drops identity attributes.
- **Dispatched:** the WU-65 doer in `bg-65`. The WU-64 doer in `bg-64` stops at "awaiting control" for the user's
  control session.
- **WU-64: awaiting the control** (head `1bde3d1`, static tests 286 of 286). The spike holds
  `scripts/run-usage.mjs` (the transcript counter), `scripts/otlp-receiver.mjs` (127.0.0.1 only; keeps
  `api_request`/`api_error` and the token metrics, drops identity and resource attributes; the coordinator
  read it), `spikes/WU-64-control.md` and the report, which is half done.
  - **Run A, by the counter:**
    - recorded output 1.79M; estimated output 2.50M; thinking 1.59M; cache read 296.2M;
    - 425 of 1,696 requests carry only a stale record.
  - **Held-out check against complete records:**
    - total +0.2%;
    - per step kind −1.4% to +5.2%;
    - per agent −12.9% to +20.4%;
    - P1 +4.0%.
  - **Peak context:** 23 of 37 agents went past the 150K target, the largest D1 attempt 1 at 545K.
  - **Found in Claude Code 2.1.296:**
    - `api_request` carries `request_id`, equal to the transcript's `requestId`, with `query_source` and
      `agent.name`;
    - `/exit` writes a `cost-state` entry, the `/usage` ledger, into the transcript.
  - **Next:** the user runs the control session (about 3 minutes); then the doer is resumed with its paths.
- **WU-65: built** (head `1649a25`, 4 commits; the doer used 433K tokens, Opus). The doer reports `mise run test`
  rc=0 (124 suites, 2139 tests) and `pnpm build` rc=0.
  - **Key-figure line:** DPS, life, ES, EHP, the four resistances and the V1/V2 finding counts. Endgame stages add
    clear speed; `b` and `n` add the Arbiter verdict with the worst hit and ratio.
  - **Deviations claimed:**
    - the clear skill's choice and the radius source;
    - the mixed Arbiter hit split evenly;
    - filled reference hits as scenario entries, so they reach `configWritten` and V2;
    - `skillOutputs` gains `AreaOfEffectRadiusMetres`;
    - `compile_check` gains `describeGems`, `anoints` and `gemTexts`;
    - `checks.nodeNames` gains item-granted notables;
    - `v1.ts` unchanged.
  - **Outside `touches`:** `compileAllocation.test.ts`, `buildGuideCheckRun.test.ts` (dropped the "ledger formula
    is a build change" row) and 16 pipeline fixture records with `buildSha1` recomputed.
  - **Friction for later units:**
    - `check-run.mjs` loads `build/plan/buildHash.js`, but its comment and failure text at :1143-1153 describe the
      old projection;
    - :1308 reads reference hits from ledger `hit_*` entries, where it should read `configWritten`. Both are
      WU-71's.
  - **A possible defect:** Earthquake's Aftershock measured 1.8 m on some runs and 2.7 m on others. The reviewer
    checks whether the area measure is deterministic.
  - **Review and gate:** dispatched to an independent reviewer.
- **WU-65 review: FAIL, one blocker** (reviewer 229K tokens, Opus). The gate passes from clean: 124 suites, 2139
  tests, NFR 2 of 2, build rc=0. Waivers are `[]` and the dependencies unchanged. The ACs map to faithful tests,
  scope is met, and every deviation is accepted.
  - **The blocker: `clearSpeed` isn't reproducible for Earthquake.** `record.ts:383` takes the largest-area stat
    set. In PoB2, two radius stats of Aftershock's stat set map to `skill("radius")`:
    - its own map, 18 (`Data/Skills/act_str.lua:4212`);
    - the global base map, 27 (`Data/SkillStatMap.lua:633`).

    They are applied in `pairs()` order (`CalcActiveSkill.lua:97`), the last winning (`:895-896`). LuaJIT seeds
    its string hash per process, so it read 2.7 m in 3 engine starts and 1.8 m in 5. A scan of the pinned data
    finds only this collision.
  - **Nits:**
    - `compiler.ts:536`: two DPS code paths;
    - `v2.ts:13`: the `producer-absent` text omits item-granted notables;
    - `Compile.lua:549`: a comment.
    - The reviewer's 4.0 m nit is rejected: the user's Q2 says "4 m or more fast", as built. Slice 02's text is
      tightened to match.
- **D-363 (the coordinator's decision, PROPOSED):** the area is measured deterministically. A stat set whose
  radius PoB2 resolves in hash order is read by its own stat map, which here is also the smaller, cautious
  radius. An engine test asserts the value over several engine starts. The doer's context was over 400K, so a
  fresh fixer gets the blocker and the nits.
- **D-363 revised, on the user's direction.** Q2 was "not super important... a rough estimate is fine", so
  the fix should be the cheapest one. The radius is read from the clear skill's first stat set, which is
  deterministic for Earthquake's Impact. One ordinary engine test; no general rule and no multi-start test. The
  fixer was redirected, and slice 02's text was changed to match.
- **The WU-65 fixer's first pass came back before the redirect reached it.** At `161dd44` it holds:
  - a general own-stat-map radius rule in `Compile.lua` (:829-929), replacing the radius fields in
    `skillOutputs`;
  - a six-engine-start test that failed on the unfixed code and passed 7 of 7 with the fix;
  - the three nits, with `CompileResult.mains` added so every stage's DPS goes through `headlineDps`.

  The gate passed: 125 suites, 2140 tests, build rc=0. The redirect then resumed it: it replaces the rule with the
  first stat set and swaps in one plain test. That leaves PoB's own outputs untouched and the code smaller.
  - **For the fold:** slice 02:792's `producer-absent` text for passives should gain "or a notable an item grants".
- **WU-65, the simple rule** (fixer `3b59e19`; its total use was 187K tokens). The reverted rule and its
  multi-start test are gone. The gate passed: 124 suites, 2140 tests, build rc=0.
  - **Stat set 1 can be the wrong part of a skill:** Stampede's first stat set is Footsteps. The coordinator's
    commit `07bd741` (two lines, two unit tests) reads the main selection's `statSet` when the clear skill is the
    main skill, else stat set 1. Slice 02's text matches.
  - **Narrow re-review:** the reviewer was resumed on `1649a25..07bd741`, with the full gate.
- **WU-65 re-review: PASS** (the reviewer's total use was 252K tokens).
  - **Gate from clean:** 124 suites, 2142 tests, NFR 2 of 2, build rc=0.
  - **Confirmed:**
    - the blocker is gone, and the Earthquake test is deterministic;
    - `Compile.lua` differs from `1649a25` only by a comment;
    - the reverted code is gone;
    - nits 1–3 are done;
    - the Stampede fixture change and `CompileResult.mains` are accepted.
  - **One should-fix:** a `clear`-role group that is the main group ignored the main selection's stat set. The
    coordinator fixed it in `3bfe70e`, with a unit test (the unit suite passes 10 of 10).
- **WU-65 merged** at `3bfe70e`, fast-forward after a rebase. At the merged head: `pnpm build` rc=0, static and
  unit suites 1190 of 1190. Lane `bg-65` removed.
- **Wave 2:** lanes `bg-66` (WU-66, `tree-shape` and the path tools; HG-12 granted) and `bg-68` (WU-68,
  `guide_run`'s views), both off `3bfe70e`. Serialized: `Compile.lua` and `v1.ts` go to WU-66, then WU-67;
  `planHandlers.ts` to WU-68.
- **WU-68: built** (head `f79b5f0`; the doer used 196K tokens). The doer reports the gate passing: 124 suites,
  2,154 tests, build rc=0; the counts stay 84/83.
  - **The views:**
    - `{view: {plan, stage}}` gives a header, the record's current/stale status, the key-figure line and the stage
      as compact JSON, 11.7–16.0 KB on the fifteen-stage fixture;
    - `{view: {plan, claims: true}}` gives one line per claim, 1.6 KB, capped at 50,000 characters at a stage
      boundary.
  - **Deviations:**
    - `toolRouter.ts`: a call with `view` is kind `none`;
    - the views skip the schema check;
    - the stage view has a status line;
    - the description's first sentence changed.
  - **Friction for WU-69:** the verifier has no `guide_run` today. A per-tool allowlist would also give it
    `new_run` and `validate`, and `validate` starts the engine. `buildGuidePipeline.test.ts` keeps `guide_run`
    coordinator-only. The claims view prints ledger ids, not values.
  - **Friction for WU-70:**
    - the stage JSON isn't the file's own formatting, so anchoring an Edit still needs Read or Grep;
    - views take no lock, so they can be batched.
  - **Review:** dispatched.
- **WU-68 review: PASS** (reviewer 138K tokens). No blocker and no should-fix. Its own gate: 124 suites, 2,154
  tests, NFR 2 of 2, build rc=0.
  - **Confirmed:**
    - the tests are faithful: the real router and a real measure-only compile; all 16 replies are at most 25,000
      bytes;
    - the byte bound is sound;
    - C-50's routing holds;
    - path traversal is contained: absolute paths, `..`, symlinks out and a directory are all refused.
  - **Every deviation is accepted.**
  - **Nits:**
    - the 50,000-character cap is a rule of thumb;
    - the stage view is uncapped;
    - *for the fold:* C-50's kind sentence should gain "or `view`" (`toolRouter.ts:142`).
  - The reviewer wrote a gate log into the session scratchpad. The coordinator deleted it.
- **WU-68 merged** at `f79b5f0`. At the merged head: build rc=0, static and unit suites 1190 of 1190. Lane
  `bg-68` removed. **WU-69 is next** (V4: one pass); WU-66 is still building.
- **WU-66: built** (head `dd6f973`, 3 commits). The doer reports the gate passing: 126 suites, 2154 tests, build
  rc=0.
  - **The finding:** `tree-shape`, one per broken rule. Its data is `{stage, rule, start, startName,
    trees[{exits, nodes}]}`, with `rule` one of `one-tree-per-start`, `one-exit-per-tree`, `alternate-start` or
    `ascendancy`. On run A's stage 2 it says the Ranger start (50459) holds 2 trees.
  - **The path tools:**
    - they never enter a start;
    - they leave a start only while it holds no tree;
    - they never step from the main tree onto an open start's exit or into an ascendancy node.
  - **`compile_check`** replies with `trees[]`. AC-B4 is wired.
  - **Deviations:**
    - (1) PoB prunes a Sorceress tree without 12795, and an ascendancy node cut off from 1583, so D-213's
      not-connected check refuses those plans before V1 runs. The tests assert that refusal and run
      `checkTreeShape` on `compile_check`'s trees.
    - (2) "One exit per tree" is applied literally, so a connected loop back to the start's other exit is a
      finding.
    - (3) No path runs through an unallocated 12795.
    - (4) A Ranger tree that walks across the main tree onto 4739 without 12795 is valid.
    - (5) Implied scope: `compiler.ts`, `types.ts` (`isClassStart`), the two-stage fixture's second Warrior
      tree joined to the first, `plan-reference.md`, five tests.
    - (6) The finding gains `data.rule`.
  - **Friction:** the two-stage-count, off-hand-item and fifteen-stage fixtures still hold two Warrior trees, so
    they give `tree-shape` findings. No test needs them clean. *For the fold:* `plan-reference.md`'s `tree.nodes`
    row.
- **D-364 (the coordinator's ruling on deviation 2, PROPOSED):**
  - A tree is a connected group of allocated nodes, the start not counted, and a start holds at most one.
  - A tree that touches two exits of its start through its own nodes is one tree, and legal. That follows the
    user's I-3 words, "two **unconnected** start nodes"; in game, the second exit is a node adjacent to an
    allocated one.
  - V1 drops `one-exit-per-tree`. The path tools may stay conservative and never route a loop.
  - Sent to the doer, with a rebase onto the integration head.
- **WU-69: built** (head `d52419f`; the doer used 282K tokens). Static and unit suites 1194 of 1194.
  - **V4 is one pass.** It checks the hinge claims against their sources and reads `guide.md` as an editor. It
    keeps `reports/V4-<n>.md`, and its tools are Read, Glob, Grep, Write (`reports/` only), WebFetch and the five
    lookups.
  - **Triage:** `hinge: yes|no`. A non-hinge finding is removed or narrowed; under 5% in an estimate is no
    finding. A revision runs no full pass: the round copy, then a re-check.
  - **Deviations:**
    - V4 Greps `plan.json`'s claims arrays. The runner pasting the claims view would break two rules: the
      verifier's prompt is exactly the header and one line, and the runner never reads the plan. Adding
      `guide_run` to V4 would break a third: only the coordinator names a compile tool.
    - V4 no longer reads `audit.md` (D-355).
    - Finding ids are `v4-<n>-<k>`.
    - A re-check reports an untouched open finding as `unresolved` again.
    - Edits outside the touch list: `run-folder.md`, the stages README, `source-markers.md`.
  - **For WU-70:**
    - `checkpoints.md`, `run-log.md`, `task-header.md` (`lens`), the `W1.md` and audit-template rows, and
      `D1.md`'s ids;
    - the round-copy command (A-34);
    - D1 and D2 recompiling for a ledger formula.
  - **For WU-71:**
    - `--changed` prints `claim stages[<i>].claims[<k>] (<id>)` or `section <H2 title>`, one per line;
    - the report's form;
    - a re-check `<n>` uses `--changed <n-1>`;
    - open findings are the latest report's `unresolved`;
    - ids match `v4-\d+-\d+`;
    - FI-4's doubled formula goes to `[ledger]`.
  - **Review:** dispatched.
- **WU-66, D-364 applied** (head `ae331e4`, rebased cleanly on `ac47ef7`; the doer's total use was 335K
  tokens).
  - `one-exit-per-tree` is dropped.
  - A new test: a connected loop through two exits of the Mercenary start (59779 - 97 - 59915) passes.
  - The gate passed: 126 suites, 2166 tests, build rc=0.
  - **Review:** dispatched, with the full gate.
- **WU-69 review: PASS** (static and unit 1194 of 1194). Every deviation is accepted, including Grep for the
  claims: `guide_run` also carries `new_run`, which would break the verifier's read-only rule.
  - **One should-fix:** `run-folder.md:96` and `:127-128` still describe the lens re-check. No unit owns that
    file, so the doer fixes it now.
  - **Nits:** sent to the doer.
  - **Cross-unit, for WU-71:**
    - `check-run.mjs:103`'s id pattern and `:1387`'s lens column must accept `v4-<n>-<k>` and `V4`;
    - checkpoints.md's revision line is unpinned until WU-70 restates it;
    - until WU-71, the checker rejects `reports/V4-1.md` (`:795-797`). That's harmless, since nobody runs
      before WU-72.
- **D-365 (the coordinator's ruling, PROPOSED).** After a ledger-only fix, which skips the recompile under
  D-352, the record's ledger values are stale. So V4 compares guide figures only with the record's measured
  values (stats, `measures`, key figures). Figures that come from the ledger belong to the checker's `[ledger]`,
  over the plan's current formulas. WU-71 must make `[ledger]` cover the guide's ledger-cited figures.
- **WU-69 fixes** (`5922583`; the doer's total was 296K tokens): `run-folder.md` restated; D-365 in `V4.md`
  (guide figures only against measured values); the nits. Static and unit suites 1194 of 1194. The coordinator
  read the diff and confirmed that every stage has a `claims` array (`schema.ts:278`), so the Grep order gives
  `<i>`.
- **WU-69 merged** at `4481752`. At the merged head: build rc=0, static and unit suites 1194 of 1194. Lane
  `bg-69` removed.
- **WU-70 runs as two doers in series in lane `bg-70`** (off `4481752`), to keep each context lean, which is
  R-42 and the point of amendment 4:
  - **A, control flow:**
    - `SKILL.md`: the design gate, D1's two steps, the round copy (A-34), the per-step card, halving it;
    - `D1-build.md` and `D1-finish.md` from `D1.md`;
    - `D1-gate.md` (A-35's display);
    - `checkpoints.md`, `run-log.md`, `offline-and-test.md` and `task-header.md`;
    - batching in the agent definitions;
    - AC-W60 static, and AC-W59 static for D1.
  - **B, content:**
    - `D2.md` (D-354's campaign, AC-W59 static for D2);
    - `W1.md`, `R1b-assemble.md` (D-355's table) and the templates;
    - excerpts and D-351's claim rule in the remaining stage references;
    - AC-W53.

  One review covers both.
- **WU-66 review: PASS** (reviewer 178K tokens). No blocker and no should-fix. Its own gate: 126 suites, 2166
  tests, NFR 2 of 2 (the fifteen-stage compile took 28.9 s), build rc=0. `vendor/` is clean at `7d6f530`.
  - **The tests catch regressions:** run against the old search, AC-K66's three checks fail.
  - **The C-1 bound holds:** the handlers, schemas and text are untouched. Probe: with 12795, the path to 4739 is
    `[4739]`; with a tree on 56651, 13828 gets no path; the loop is never routed.
  - **The Lua also finds** Path of the Warrior, 57253, with the Warrior exits 3936 and 38646.
  - **Every deviation is accepted.** The two-Warrior-tree fixtures are left as they are: no test needs V1 clean
    on them, and the pipeline fixtures aren't compiled.
  - **Nits:**
    - `v1.ts:509-551` groups trees across weapon sets (rare; left);
    - the "No path found" hint is unchanged, since C-1 freezes the output (left).
  - **For the fold:**
    - AC-P65: two shapes are refused by the compile before V1;
    - AC-K66: read "leaves the Sorceress start by its exits without 12795";
    - §3.7, §2.11 and D-360 still say "one start exit"; D-364 removed that.
- **WU-66 merged** at `ae331e4`. At the merged head: build rc=0, static and unit suites 1194 of 1194. Lane
  `bg-66` removed.
- **WU-67 started** in lane `bg-67` (off `ae331e4`), in parallel with WU-70 part A. The two share no files.
- **WU-67: built** (`e94c01a`; the doer used 167K tokens).
  - **What it adds:**
    - `support-sockets.tree-granted` = `{"1-39":3,"40-59":4,"60-100":5}` in `gems.json`, a `judgment` source at
      L;
    - `checkSupportSockets` (`v1.ts`), called last in `checkV1`.
  - **Recognition is by elimination.** Neither the plan, PoB's gem list nor the V1 inputs record where a skill
    comes from (`schema.ts:172-184`, `Compile.lua:1135-1158`). So the group's skill is tier 0, and no
    `Grants Skill:` line in the stage's items names it.
  - **The doer's suite runs:** static and unit 1199; compile engine suites 54.
  - **Review by the coordinator.** The diff is 134 lines in 3 files, so a full reviewer wasn't worth its cost on
    a low-risk unit. Two changes, in `46a011a`:
    - PoB2 gives granted skills an explicit `Tier = 0` (`Data/Gems.lua`), so only an explicit 0 counts. An
      unknown tier (no gem data) is never flagged, and a unit test covers it.
    - The finding adds "if an item grants it, its item text lacks the `Grants Skill:` line". That names the cause
      of the one false positive the doer found, which is a plan defect anyway.
  - **Disabled supports count.** That's accepted: rough is fine.
- **WU-67 merged** at `46a011a`. At the merged head: build rc=0; static, unit and compile engine suites 1254 of
  1254. Lane `bg-67` removed. Slice 02's units are all merged; WU-70 A is running.
- **WU-70 A: built** (`2413dd8`, rebased to `e97bfc8` onto `eacebb3`; the doer used 415K tokens). Static and
  unit suites 1226 of 1226 after the rebase. `SKILL.md` went from 442 to 221 lines.
  - **Steps:**
    1. Start;
    2. R1a, R1a-assemble, the brainstorm gate;
    3. R1b, R1b-assemble, the verification gate;
    4. D1-build, D1-finish, D1-gate, the design gate;
    5. D2, D2-gate;
    6. W1, V4, the round copy (`--snapshot`), the fix round, the V4 re-check;
    7. known issues, the checker, the final gate.
  - **Deviations, accepted:**
    - `references/start.md` and `references/fix-round.md` take the detail cut from `SKILL.md`;
    - the round copy is `check-run.mjs <folder> --snapshot <n>`, the name A-34 and WU-71's block give;
    - every D1 attempt runs build then finish: the fix round goes to D1-finish first, which returns
      `build: <ids>` for a build change;
    - no design gate in the fix round or a revision;
    - the log stages are `V4` and `V4-recheck`;
    - the budget includes `b-anoint`;
    - one-line edits in `gates.md`, `pricing.md` and `run-folder.md`.
  - **For WU-71:**
    - the `design` checkpoint's answers, default and log sequences;
    - the D1 gate verdict's `design: {rungs[{stage, dps, ehp, arbiter, clearSpeed, anoint, gear, gems, tree}],
      estimates}`;
    - `D1-build` and `D1-finish` replace `D1` in the log;
    - `run-log.mjs` needs wiring into `SKILL.md`;
    - `run-folder.md`'s checker section;
    - `check-run.mjs` still expects `D1`, `V4-<lens>` and `hit_*`.
- **WU-70 B started:** a fresh doer, since A's context was over 400K.
- **WU-70 B: built** (`ea8125c`). Static and unit suites 1252 of 1252. The pipeline tests went from 245 to 271,
  and 49 of them fail against `e97bfc8`'s skill text.
  - **Line counts:** `D2.md` 160 to 209, because it states the pricing and data rules it used to send agents to
    whole files for; `W1.md` 206 to 207; the guide template 199 to 194; the dossier template 88 to 19.
  - **Deviations:**
    - the audit template is restated as the exact form `render-audit.mjs` produces, with no Run notes;
    - three cross-checks against `check-run.mjs` were dropped, since that file is WU-71's;
    - consistency edits in D1-build, `run-log.md`, `run-folder.md`, `source-markers.md` and `lookups.md`;
    - W1 still adds accepted gate findings under `Known issues`.
  - **For WU-71:**
    - a render step and a Bash entry for `render-audit.mjs` in `SKILL.md`. Part B couldn't add them, because the
      path test fails while the script is missing;
    - the Checks block's form;
    - the survival label on `b` and `n`: "survives the Arbiter's hits" or "one-shot by the Arbiter's <type> hit",
      or "not measured…";
    - the anoint line's form;
    - the dossier table's columns, and `dossier-sections` moved to them.
- **D-366 (the coordinator's ruling, PROPOSED):** D2 may keep `reason` claims that name each campaign stage's
  tree path, its notables and keystones in order, plus one per reward pick, about 10.
  - **Why:** the plan holds node ids only and W1 has no tree tool, but the guide must name the path (D-346).
  - **Cost:** V4 doesn't check `reason` claims, and they count toward AC-W58's 56.
  - **The rejected alternative:** node names in `guide_run`'s stage view. That's more code for the same result.
- **WU-70 review:** one reviewer for parts A and B.
- **WU-70 review: FAIL on one should-fix** (S1). Static and unit suites 1252 of 1252; the reviewer confirmed that
  49 of part B's tests fail against part A's text. No blocker, and every deviation is accepted.
  - **S1:** D1-finish after D1-build (in a fix round, or a design `revise:`) isn't told what moved. It may return
    `build:` again and loop, a changed slot keeps its old price, the log has no outcome, and the design card has
    no route for a `build:` return.
  - **Nits:**
    - N1: W1 reads `plan.json` whole, stage by stage; the views are enough now that D-366's claims name the path;
    - N2: the default `stop` is missing from `SKILL.md`;
    - N3: wording;
    - N4: the verifier's `exists:` re-run rule was dropped, so a re-run would stop the run;
    - N5: a stale template example;
    - N6: D1-gate's bare D-numbers;
    - N7: `rounds/<n>/` is missing from the layout.
  - **N8, open:** `buildSha1` includes `prices`, so a price fix recompiles and re-runs the D1 gate, D2 gate and
    W1 chain. That's conservative, and it matters only online, since offline runs have no prices. It's left as
    built; revisit if the live run (M-13) shows the cost.
  - **For WU-71, beyond the doers' lists:**
    - D2's `design`-visit rule applies to the design phase only;
    - handle S1's D1-finish;
    - `b-anoint` in `basis` is undefined;
    - the dossier is ten columns;
    - the audit render writes `None.` under Known issues and keeps W1's accepted-finding rows on a re-render;
    - re-render after every final compile;
    - `SKILL.md` is capped at 221 lines.
  - **The fixes** went to part B's doer (333K, under the limit).
- **WU-70 fixes** (`090bf5a`; the doer's total was 408K tokens). S1 is fixed: D1-finish gets D1-build's `changed`,
  re-prices and re-claims what moved, never returns `build:`, and is logged `done`. N4 is restored. N2, N3 and
  N5–N7 are done.
  - **N1, partly:** W1 Greps `plan.json` by field and never reads a tree, but it can't use the views, because its
    tools are file tools only (D-257). Respec notes now name dropped nodes.
  - Static and unit suites 1259 of 1259. The coordinator read S1's diff and found it as specified.
- **WU-70 merged** at `090bf5a`. At the merged head: build rc=0, static and unit suites 1259 of 1259. Lane
  `bg-70` removed.
- **WU-71:**
  - **The brief:** `docs/build-guide/briefs/WU-71-formats.md` collects every format the checker must match, from
    the M-15 reports and reviews, plus D-363…D-366.
  - **Two doers in series** in lane `bg-71`:
    - A, the scripts: `--snapshot`, `--changed`, `render-audit.mjs`, `run-log.mjs`, their `SKILL.md` wiring,
      and AC-W54's listing clause;
    - B, the checker's rules and the fixtures.
- **WU-71 A: built** (`9d79934`; the doer used 346K tokens). Static and unit suites 1278 of 1278, build rc=0, and
  `SKILL.md` stays at 221 lines.
  - **The command forms:**
    - `check-run.mjs <folder> --snapshot <n>` refuses an existing round;
    - `check-run.mjs <folder> --changed <n>` prints only the two line forms;
    - `render-audit.mjs <folder>`;
    - `run-log.mjs <folder> <init|stage|checkpoint|escalation|set> '<json>'`.
  - **Choices:**
    - movement speed from `outputs.EffectiveMovementSpeedMod`;
    - `b-anoint` as a basis slot entry, stated in `D1-gate.md`;
    - the coverage flags from the record's `customModsWritten` and `pobWarnings.kept`;
    - `--changed` finds a claim's cited values by its source: ledger entries through the evaluator over the
      current formulas, price entries, and `pob-computed` fields both raw and counted.
  - **Deviations:**
    - the audit re-renders before every W1 of a fix round or revision;
    - the Estimates come from the evaluator, not the record's stored ledger;
    - null renders as "unknown" or "not measured";
    - the layout accepts `rounds/<n>/`.
  - **WU-71 B started:** the checker's rules and the fixtures.
- **WU-71 B: built** (`e0a8189` and `c552e8f`; the doer used 680K tokens, the largest context of this build).
  Static and unit suites 1300 of 1300, 298 of them in the checker file. The checker exits 0 on `run-ok`,
  `run-ok-online`, `run-escalated` and `run-ok-v2`.
  - **Deviations:**
    - schema-2 logs keep `D1`;
    - `[ledger]` checks a `ledger:<id>` claim's numbers against the current value, at its last significant digit
      or within 5%;
    - re-check coverage is against `rounds/<n>/`;
    - added rules: a re-check carries every open finding; a V4 log outcome equals its report's verdict; a
      finding's claim id matches its location; the budget includes the anoint.
  - **Not checked:** that a full pass's `## Checked` lists every hinge claim, and the D1 gate's `design` field.
  - **Review:** one reviewer for parts A and B. It is focused on whether the checker would reject a valid real
    run, and on rules stricter than the spec.
- **WU-71 review: PASS, with 2 should-fixes and 4 nits.** Static and unit suites 1300 of 1300; the four fixtures
  rc=0.
  - **The real-run simulation.** The reviewer rebuilt a run-A-like log only through `run-log.mjs`, by
    `run-log.md`'s call forms. The checker took it, with four fix-round and revision variants. The
    `render-audit.mjs` re-render reproduced the fixture's `audit.md` byte for byte. The V4 report, dossier and
    verdict-line forms pass. All writes stay in the run folder, and nothing touches the network.
  - **Every deviation is accepted.**
  - **Should-fix 1:** the verdict-line DPS is checked against the gate's `basis.rolledSkill` (`:1435`), but W1
    writes `measures.dps`.
  - **Should-fix 2:** `[ledger]` (`:1270`) requires a ledger claim to state the entry's value, which D1-finish isn't
    told; a true claim stating an input fails. Both would reject a valid run.
  - **Nits:**
    - exact apostrophe and dash characters;
    - HTML comments in the dossier;
    - `--snapshot` partial rounds and an uncaught throw;
    - a stray `run-log.json.tmp`;
    - apostrophes breaking `run-log.mjs`'s single-quoted JSON, so it reads stdin with a heredoc.
  - **Fixes:** dispatched to a fresh fixer, since part B's doer ended at 680K.
- **WU-71 fixes** (6 commits to `e6feb0c`; the fixer used 166K tokens).
  - The verdict-line DPS is checked against `measures.dps` (`:1445`). The gate's figure stays for its own
    recompute and for records without `measures`.
  - `[ledger]` also accepts a claim's number equal to an input or the input × 100 (`:1277`), with the rule in
    `D1-finish.md:90`. FI-4 still fails.
  - **Nits:**
    - typography is normalised;
    - HTML comments are skipped;
    - `--snapshot` copies via a temp folder and renames it, exiting with one clean line;
    - `run-log.json.tmp` is ignored;
    - `run-log.mjs` reads `-` from stdin, and the examples are quoted heredocs.
  - The coordinator also restated `W1.md:79`: the DPS line is `measures.dps`, whatever the gate names.
- **WU-71 merged** at `237780b`. At the merged head:
  - build rc=0, static and unit suites 1307 of 1307;
  - the four pipeline fixtures rc=0.

  Lane `bg-71` removed. **WU-65…WU-71 are all merged.**
- **The wave gate:** the run worktree `m15`, detached at the integration head, is bootstrapped and gated from
  scratch by an independent verifier. It then serves as WU-72's run worktree.
- **WU-72's environment:** `/tmp/m15.C1xp`, built from run A's (`/tmp/m14.zfPx`).
  - `start.sh runL` runs with telemetry (the WU-64 receiver, copied in, on 127.0.0.1:4318, writing
    `telemetry/events.jsonl`); `runL-plain` runs without it.
  - `mcp/` is the isolated `pob2` from the `m15` worktree, with trade and poe.ninja off.
  - `cfg/L.json` holds run A's answers plus `design: ["accept"]`, and `faults: []`.
  - The README holds the user's instructions, with the new scripts on the approve list.
- **M-15 wave gate: PASS at `fb8c446`** (an independent verifier, in the fresh worktree `m15`).
  - **Bootstrap:** clean.
  - **`mise run test` rc=0** from clean, with the Jest cache cleared: 127 of 127 suites, 2283 of 2283 tests, none
    skipped. The NFR step passed 2 of 2, and no timing re-runs were needed. It took about 4m50s.
  - **`pnpm build` rc=0.**
  - **Cross-cutting checks:**
    - both waivers are `[]`;
    - `package.json` and `pnpm-lock.yaml` are unchanged since `acec4d1`;
    - `vendor/` is clean at `7d6f530` (v0.23.1);
    - the README table matches, with 84 rows.
  - **The four pipeline fixtures:** rc=0.
  - **The AC map:** every AC owned by WU-65…WU-71 maps to a passing test. AC-W51 (WU-64) and AC-W56…AC-W58
    (WU-72) are unmapped, as expected.
  - `m15` is left built for WU-72.
- **Next:** WU-72, the lean run, started by the user. WU-64's control session is pending.

## 2026-10-14: WU-72, the lean run, ended

- **The run:** `/tmp/m15.C1xp/guides/open-explosive-concoction/2026-10-12-1`, run by the user with telemetry
  (`start.sh runL`). The transcript is `~/.claude/projects/-home-parker-projects-pob2-mcp-wt-m15/a3f7b5d1-….jsonl`,
  with 42 subagent files.
  - **The log:** `status: completed`. The design gate answered `accept`. The final gate's `revise:` ran as a re-check,
    with no full pass, then `accept`.
  - **The steps:** R1a ×3, R1a-assemble, R1b ×2, R1b-assemble, D1-build, D1-finish, D1-gate, D2, D2-gate, W1, V4
    (`fail`), then the fix round: D1-finish and D2 (both `claims-edited`), W1, V4-recheck (`pass`). Then the
    revision: D1-finish, W1, V4-recheck (`pass`).
- **The checker exits 1, with one violation:** `[order] stages[17] V4-recheck attempt 2: is call 1 of V4-recheck`.
  - `V4.md:21` gives every V4 call's header `stage: "V4"`.
  - `run-log.md:51` says `attempt` "matches the header".
  - The log names re-checks `V4-recheck`, and the checker counts per log name. The runner logged both re-checks as
    attempt 2.
  - So it's an ambiguous text and a runner slip, not a build problem.
- **Tokens:**

  | Measure | Lean run | Run A |
  |---|---|---|
  | Output (estimated) | 1.23M | 2.50M |
  | Recorded transcript output | 0.87M | |
  | Thinking | 0.74M (60%) | |
  | Cache read (main and subagents) | 129.6M | 296M |
  | Cache write | 3.74M | |

  - Telemetry output is 1.23M, and the session's `/cost` ledger 1.23M, so three sources agree.
  - Telemetry's total cache read is 177.5M, including 267 `agent_summary` requests: Claude Code's own subagent
    summaries.
  - The revision's agents (W1 6.9K, D1-finish 5.2K, the V4 re-check 12.9K) leave about **1.20M before the revision:
    over D-349's 1M**.
- **Output by family:** R1a 280K, D1 248K, W1 226K, D2 167K, R1b 138K, V4 134K, runner 38K.
- **Peak context against the 150K target:** D1-build 414K, D2 395K, W1 350K, R1a researcher a 312K, V4 full 253K,
  R1b 248K; the runner 196K.
- **Dispatched:**
  - an independent verifier for AC-W56…AC-W58 (the gate displays, the lean plan and guide, what's inflated), with
    a guide review;
  - WU-64's doer, resumed to finish the spike with this run's telemetry as its ground truth, in place of the
    user's short control session.
- **WU-64: done and merged** at `1474fd7` (the doer's total was 230K tokens). The coordinator reviewed it: the
  report's decision section, a grep for identity data (none; only the receiver's list of dropped attribute
  names), and the counter's totals, which matched the coordinator's own run. Static suite 351 of 351. Lane
  `bg-64` removed.
  - **The lean run served as the control.** All 837 transcript requests join telemetry on `request_id`; inputs
    and caches are equal on every one, and the 573 complete records are exact.
  - **The 264 stale requests:** the estimate is +1.2% in total, the per-request p5–p95 is ±33% with a median of
    +2.2%, and the run total is +0.35%.
  - **Three sources agree to the token** at 1,232,323: telemetry, the token metric and the session ledger.
  - **The cache-read gap is `agent_summary`:** 47.88M cache read and 5.85K output. These are Claude Code's
    timer-driven progress summaries of running subagents, absent from any transcript.
  - **The decision:**
    - telemetry backs D-357's budget, with the session ledger as the cross-check;
    - the transcript estimate is the fallback at ±7%;
    - per-step figures come from the transcripts joined to telemetry;
    - `agent_summary` output counts toward the budget, and its cache read gets its own line;
    - every recorded run starts the receiver and ends with `/exit`.
  - **AC-W51:** all six parts met. The user's short control session isn't needed; its protocol is kept for a
    later re-check.
- **The WU-72 verification** (an independent verifier): M-15 can't close on this record as it stands.
  - **AC-W56, not met:**
    - the run is `completed`;
    - the checker exits 1, the one `[order]` violation only;
    - **the gate displays:** brainstorm and design were printed, but verification and both final visits printed
      none. The skill text is plain (SKILL.md:28, :134, :200), so it's a runner error, as in run A (D-265,
      AC-W37). Text alone hasn't held the runner to it twice.
  - **The attempt numbers:** the text is ambiguous (`V4.md:21`, `task-header.md:29` and `run-log.md:50`), and the
    runner also slipped (1, 2, 2). The smallest fix is one clause: a re-check's `attempt` counts that card's
    re-checks from 1.
  - **AC-W58, met:**
    - 30 claims (11 hinge, 19 reason), every one with a kind. D2 has 6 hinge and 14 reason (6 paths, 8 picks): over
      D-366's "about 10", within its letter;
    - `b` and `n` carry the measures, a label matching the Arbiter verdict (both `survives`, 0.97 and 0.89) and the
      Cremation anoint; `m` has none;
    - no kill time, hits to kill or campaign defences;
    - V1 has zero findings on all 9 stages;
    - V4-1…V4-3 are kept.
  - **AC-W57, output not met:** about **1.20M before the revision**. 11 of 21 agents and the runner went past
    150K.
  - **The guide:** 2,930 words, and it reads as a game guide, with a lean campaign per D-354. **Problems:**
    - the stale card title "Burning packs call extra flasks" (quality-0 gems throw no extra flasks);
    - "one button for bosses" against a flask lasting about 9.4 s;
    - the maps amulet's +1 dropped with no reason;
    - pipeline notes left in the text ("1.251× base", "unconfirmed offline");
    - every DPS figure models the granted skill as a socketed level-16 or 20 gem with five supports, while PoB's
      own granted copy shows about 160 DPS, so a reader can't tell whether the build works.
  - **The design display drifted.** The design gate's figures (budget EHP 9,305, Arbiter 0.99) differ from the
    final record's (10,409 and 0.97), and no later display showed the new ones. The likely cause, unverified:
    D2's campaign rewards carry into the endgame rungs.
  - **Duplicate claims:** the 5-charge cost is stated three times; the revision added a third.
  - **Where output and context went:**
    1. Thinking: 60% of output. W1's first call recorded 163K output against about 25K of tool input.
    2. Reads against the stage text:
       - V4 read `plan.json` in 8 chunks (129K characters), and W1 read it in 10 (109K);
       - `plan-reference.md` went whole into D1-build (51K), R1b (53K) and D2 (31K), and `patterns.md` whole into
         R1a (43K);
       - the runner read `guide.md` and `audit.md` whole, twice.
    3. Call volume:
       - D1-build ran 129 turns, with 10 compiles, 36 `find_path_to_node` calls and 2 whole-plan writes;
       - R1a researcher a made 65 lookups;
       - W1 typed the 15K-character import code three times.
  - **Decisions for the user:** waive or re-run for M-15's exit; the budget lever, under D-357 (thinking effort, a
    smaller model); and how far to go on the mechanical fixes.
- **The user's decisions (2026-10-14):**
  - **M-15 closes as "fix, then waive".** The coordinator fixes the gate displays, the attempt numbers and the
    final gate's figures. This record is accepted with its misses noted, and there is no second lean run; the next
    real run exercises the fixes.
  - **The budget lever is held** until the user's poe.ninja comparison.
- **WU-73** (an M-15 follow-up, small), with the coordinator's decisions, PROPOSED:
  - **D-367:** `run-log.mjs` prints each gate visit's display (`display <gate>`) and refuses a `checkpoint` entry
    whose visit printed none. The order becomes mechanical, so the runner's discipline is no longer needed (run A
    and the lean run both missed displays).
  - **D-368:** a re-check's `attempt` counts that card's re-checks from 1, as the checker counts. `V4.md:21`,
    `task-header.md:29` and `run-log.md:50` say so.
  - **D-369:** the final gate's display carries each endgame rung's figures from the final record, so drift since
    the design gate shows.
  - **Cheap guide fixes:**
    - the Checks block writes movement speed as "+25%";
    - W1 writes no pipeline notes in the reader text;
    - the title comes from the final build, not a stale card hook;
    - a revision cites an existing claim rather than adding a duplicate.
- **Held for the poe.ninja comparison:** the budget lever (D-357), and the DPS model of the granted skill (a
  socketed level-16 or 20 gem with five supports, against PoB's own granted copy at about 160 DPS).
- **WU-73: done** (doer `d340e96`, `26e5a12`; 274K tokens). Static and unit suites 1318 of 1318; the four fixtures
  rc=0; build rc=0. No server code changed, so the engine suites are unaffected.
  - **D-367:**
    - `run-log.mjs <folder> display <brainstorm|verification|design|final|escalation>` prints the display from
      the run folder and records `{checkpoint, visit}` in a new `displays[]`;
    - `checkpoint` refuses an answer whose visit printed none;
    - the checker has a new rule, `[display]`;
    - the hard rule and the gate paragraphs in `SKILL.md` (221 lines) and `checkpoints.md` say so.
  - **D-368:** one clause each in `V4.md`, `task-header.md` and `run-log.md`.
  - **D-369:** `display final` shows each rung's final figures, with the design gate's on the next line wherever
    they moved. It also runs the checker in-process and shows its result.
  - **The guide fixes:** movement speed as "+25%"; no pipeline notes (W1, with V4's editor read flagging them); a
    title from the final build; no duplicate claims (D1-finish, D2).
  - **Deviations, accepted:**
    - a missing input prints a "No …" line, and the visit is still recorded, so `stop` can be logged;
    - the final display shows more (the PoB file, the gate verdicts, the known issues);
    - schema-3 logs from before D-367 (run A's, the lean run's) now fail `[display]`; the checker tests' helper
      rebuilds `displays[]`.
  - **The coordinator's review:** it read the refusal and display bookkeeping, and smoke-tested a fixture copy.
    `checkpoint` without a display gives exit 1 with the D-367 line, and display then checkpoint gives exit 0. One
    hardening was added (`51bb4bf`): `checkpoint` names the expected visit when the runner's is wrong ("the final
    gate's next visit is 2, not 5"), so a miscounted visit can't loop on the display error.
- **WU-73 merged** at `51bb4bf`. At the merged head: build rc=0, static and unit suites 1318 of 1318. Lane
  `bg-73` removed.

### M-15 closed (2026-10-14), on the user's waiver

- **Built:** WU-64…WU-71 and WU-73, each reviewed. The wave gate passed at `fb8c446` (127 suites, 2283 tests).
  WU-73 changed only skill text, scripts and tests after that.
- **WU-72's record:** `completed`; output 1.23M by telemetry (run A 2.5M); cache read 129.6M (run A 296M). AC-W58
  is met.
- **Waived by the user ("fix, then waive"):**
  - AC-W56's checker exit (one `[order]` attempt number) and 3 of 5 gate displays. D-368 and D-367 fix both.
  - AC-W57's output: 1.20M before the revision, against 1M. The lever is held for the poe.ninja comparison.
- **Next:**
  1. The spec fold to v1.6: D-363…D-369 plus the fold notes in this work-log.
  2. The user's poe.ninja comparison, which settles the budget lever and the granted skill's DPS model.
  3. The sign-rebase and the cleanup.

## 2026-10-14: the user's comparison with poe.ninja builds

- **The budget:** "1.23 is close enough to the limit that I'm willing to hold off on further optimization for
  now". More improvement rounds are expected, and optimizing now may be premature. The D-357 lever stays unpulled.
- **The user's review of runL's build** (imported into PoB2 as `EC`):
  - it leaves a lot on the table: no charms, an empty jewel socket, many open affixes;
  - the tree's pathing looks odd: are the paths the most efficient?
  - is the campaign's node order ideal?
  - the planners may not weigh a respec strategy: take closer nodes with a smaller payoff, then respec to the
    farther, better nodes once points allow, unless the build needs them at once. That's quality of life in the
    campaign, to be weighed against its complexity cost;
  - the budget and non-budget gear is identical; only the passives differ. That's excusable offline, with no
    prices.
- **The sources:** the user put two poe.ninja Explosive Concoction builds in their PoB2 builds folder, `EC-78k`
  and `EC-98k`, named for their DPS. EC-98k probably uses Oil Barrage as its main skill, with Explosive
  Concoction secondary, yet its Explosive Concoction DPS is well above ours. Both are real level-90+ characters,
  so they were viable, but probably not optimized. Their PoB warnings are probably PoB's failures, since
  poe.ninja imports come from the game.
- **The coordinator's plan:** one analyst agent reaches the builds through the user's pob2 server's read-only
  tools. It never saves, imports or exports, so nothing is written to the builds folder. It names the
  poe.ninja builds only as EC-78k and EC-98k, and writes the study `studies/2026-10-14-ec-comparison.md`.
- **The comparison study:** `studies/2026-10-14-ec-comparison.md` (analyst 289K tokens; read-only pob2 tools; no
  player names, as the coordinator checked).
  - **The skill model was right:** both real builds carry Explosive Concoction as a level-20 gem group with five
    supports at L91–93, and PoB's level-1 granted copy sits unused in all three.
  - **The hit-DPS gap:** ×3.10 (98k) and ×2.19 (78k); with our ignite counted, ×1.67 and ×1.33. Their figures are
    against a Pinnacle boss at 50% resistance, ours against a 0% map monster, and theirs rest on conditional
    toggles (moving, flask on, Rage).
  - **The causes:**
    1. speed ×1.46, measured (+107% against our +14%);
    2. +3 fire levels (Sunsplinter) and added fire on three slots, ≈×1.32;
    3. permanently held conditions (Lavianga's Spirits, moving), ≈×1.22;
    4. support multipliers, ≈×1.17 (Mana Bounty adds nothing).

    Our research found those conditions and Multishot II (cards r1-c-2, r1-c-3 and r1-a-3), but the test config's
    first-two rule never designed them.
  - **The user's observations:**
    - left on the table, confirmed: no charms (they run three), the allocated jewel socket 26725 empty, 24 of 36
      rare affix slots used;
    - pathing is efficient (96 nodes against a greedy 99): the targets are far-apart ignite and crit clusters
      reached through 49 attribute nodes;
    - campaign trees are nested by design (no respec). Act 3 is the weak stage. Respec planning is a skip;
    - budget against non-budget: the same bases with better rolls, plus two damage lines;
    - the PoB warnings are PoB gaps: The Hollow Mask's reservation line, the import's tenth gem group, an
      unmodelled curse level cap; the chaos resistance shortfall is a real choice.
  - **The lessons, recommended:**
    - **Do:**
      - (1) search +level sources across tags and slots;
      - (2) `suggest_supports` at the top rung;
      - (4) an unparsed key enabler becomes an earned config stand-in;
      - (6) the non-budget rung changes build-defining items;
      - (8) raise the granted-skill socket judgment's confidence.
    - **Do cheaply:**
      - (3) measure the 2–3 largest multipliers of every dealt card;
      - (5) fill jewel sockets and charm slots (a charm checklist), and give non-budget rares 6 affixes;
      - (7) also report DPS against a Pinnacle boss.
    - **Skip:** (9) path optimisation and (10) campaign respecs.

## 2026-10-15: the user's answers on the comparison's lessons

The user's direction on the study's lessons (`studies/2026-10-14-ec-comparison.md`). Folded into amendment 5 when it
is written; nothing is built yet.

- **+gem levels** are the strongest single damage source for any skill, so the planners should rank them first.
  They are also the most expensive affixes on trade: a rare amulet with a top +levels roll is often among a build's
  most expensive items, up to hundreds of divines. The budget rungs must price them.
- **`suggest_supports`:** its numbers aren't trusted, since PoB2's coverage of support effects is spotty. The rule:
  supports on a damage dealer add damage, judged on the gem's effect; PoB's figure is not the judge.
- **Custom modifiers:** lean heavily on PoB's custom modifier field to work around PoB2's modelling gaps. The skill
  already has it (`config.customMods {text, reason}`, D-293; figures marked estimates, D-296), but runL used none for
  its key enablers.
- **Budget rares:** a budget build still fills every affix; cheaper gear more likely carries dead stats. Guides list
  the mandatory affixes, then a priority list for the rest. The priority list is guide text; PoB can't model it.
- **DPS figures:** the community convention is a Pinnacle boss config, so the numbers aren't inflated. Today the
  rungs model map monsters (`enemyIsBoss` `None`, `map-monsters.json#pob-enemy-is-boss`).
- **Campaign respec planning:** on the to-do list, after the endgame builds are satisfactory.
- **Next, the user's proposal:** a run on Lightning Arrow Deadeye, compared with Fubgun's guide for it, which the
  user rates high quality: a better comparison than off-meta builds of a meme skill. Open questions put to the user:
  the run's mode (offline, so the design is the planner's own; or live, M-13's alpha with prices) and the guide's
  patch (the pin, PoB2 v0.23.1, models patch 0.5).

## 2026-10-15: pricing strategy, a detour before the reference-build run

The user asked to settle how guides budget gear before the Lightning Arrow Deadeye comparison. Treated as
architectural: the result goes into amendment 5's spec text.

- **The user's direction** (train of thought, not strict instruction):
  - the target is a guide generated at league start, with late endgame reached 2–3 weeks in: budget early endgame
    gear at about day-7 prices, late endgame gear at about day-21 prices;
  - guides top out at mid-high gear, 100–200 divines. A perfectly rolled high-level rare (all T1–T2, no dead
    affixes) is always expensive, and one alone approaches the ~200 divine cap, so guides never lean on perfect gear.
    A build's peak with no budget is a research question, not the main use;
  - every league has its own meta, so last league's price for a given item doesn't transfer. The method must be
    general: rough heuristics for currency and gear inflation, ballpark gear estimates. Wrong estimates aren't a
    catastrophe; the user can re-price a build at any point in the league;
  - prices are K-shaped: mid-high gear gets cheaper over a league, top-tier gear much dearer. Demand isn't linear;
    the confounders are many;
  - uniques are mostly near-worthless drops, so their price history would be noise.
- **The 0.4 data** (`poe2-exchange-archive/out/fate-of-the-vaal`, poe2scout daily exchange prices in exalts):
  - a price index (the median exchange item's price relative to day 41) reads 0.13, 0.15, 0.25, 0.37, 1.0, 1.74 on
    days 3, 7, 14, 21, 41, 70. The divine reads 97, 146, 377, 301, 321, 301 exalts;
  - against the index, grouped by day-41 price, cheap items were dearer early (1.6× on day 7) and dear items far
    cheaper early (0.12–0.15×): the K-shape in exchange goods. Grouping by day-41 price exaggerates both ends;
  - same-kind ladders (uncut gems by level, emotion and essence tiers) are too noisy to give per-tier gear curves.
- **Agreed direction:** measure the general price level by league day from exchange data across several leagues;
  assume, and state, how gear tiers move against it; test on a real guide's gear sets.
- **Approvals (the user, 2026-10-15):**
  - trade searches through the pob2 server for the test basket (about 50; the capture is capped at 80, serial, and
    stops on any rate limit). The user refreshed the cookie in `.env`; no agent read it;
  - poe2scout dumps run by the coordinator with the user's script, with a User-Agent contact the user supplied for
    this purpose.
- **Running:**
  - a capture agent prices the four gear sets of the Mobalytics guide the user named
    (`mobalytics.gg/poe-2/builds/martial-artist-monk-build-league-starter-to-endgame`; its links target Forbidden
    Rites, about day 41) into `studies/data/2026-10-16-forbidden-rites-basket.json`, with no seller names;
  - poe2scout dumps of Forbidden Rites, Runes of Aldur, Rise of the Abyssal and Dawn of the Hunt into the
    archive's `out/`.
- **Housekeeping:** the machine restarted on 2026-10-15 and `/tmp` was cleared, so every old run environment
  (`/tmp/m12b.B0zi`, `/tmp/m12.DbTF`, `/tmp/m14.zfPx`, `/tmp/m15.C1xp`) is gone. The findings are in the studies and
  this log; runL's transcript is under `~/.claude/projects/`; its build is in the user's builds folder as `EC`.
- **The capture (2026-10-16 UTC):** the agent's 18th search drew a trade-site 429 with a 600 s lockout. It stopped there and
  retried nothing. The cause is unknown: the server's limiter follows the site's headers with a one-request margin.
  The user suspects the site limits tool requests more strictly than browser ones. **For the live-run checklist:**
  a run pricing 20–40 items may hit the same wall. The coordinator resumed after the lockout at one search every
  ~100 s, 15 searches, with no further limit. Complete except Uber Endgame, which is beyond the user's cap.
- **The user on gear prices** (from experience, 2026-10-15):
  - the summary "steady in divines from day 21 to 40, unsettled before, climbing late" matches the last few leagues;
  - the exchange is an imperfect proxy: some pairs are thinly traded, and divines are scarcer than gear early in a
    league, so gear priced in divines is priced accordingly;
  - early endgame gear peaks around day 7, then declines: nobody needs it after day 7. Late endgame gear plateaus
    around day 21 and rises slowly to league end. Second characters funded from currency reserves confound good-gear
    prices;
  - **the anchor:** by day 7, when the user buys early endgame gear, most items cost a few divines. That gear is a big
    upgrade on campaign gear, usually enough for most six-mod T15 maps, and past it prices hit diminishing returns;
  - the 155-divine early endgame quarterstaff is a league-end price.
- **The user on the snapshot and the rule** (2026-10-16):
  - the guide's trade links search exact affixes with high minimum rolls, so they always return a small pool of
    very expensive items. And as the second most popular Mobalytics guide, its followers bid those items up, and
    crafters sell to them at a premium. A better guide widens the pool with weighted searches, as PoB2's "trade for
    these items" does;
  - dropping the least useful affix usually takes a +skill-levels amulet from hundreds of divines to tens. The
    user searched for the 420–900 divine Mid Endgame amulet without "#% increased Energy Shield from Equipped Body
    Armour", and the cheapest listing was 10 divines;
  - our own builds are unlikely to meet that demand premium unless their gear overlaps a meta build's;
  - the conversion table is close to what the user expects of day-7 and day-21 prices;
  - the concern: designers overestimating gear prices and pruning a promising build as too expensive. The cap needs
    wiggle room, and the user decides whether a build costs too much.
- **What the pipeline does today** (read for the reply): pricing uses `search_trade_items` (exact affixes with
  minimums, the same shape as the guide's links) and `get_item_price`; the server's `find_upgrades` (PoB's weighted
  trade-dialog search, with required mods and a max price) isn't in the coordinator's tools. The D1 gate fails a
  budget variant above 22 divines; D1 re-designs, and after 2 retries the concept is `infeasible`. That is the
  pruning the user is wary of. Concept cards show key prices at the pick, with no price rule.
- **The user on `find_upgrades`** (2026-10-16): PoB2's weights may be wrong when the build's damage rests on a mod PoB
  doesn't support, unless the custom config lines enter the weight calculation. The user's habit: PoB2's weighted
  search plus an AND stat group for the affixes the item must have; rarely needed, a tool in the toolbox.
  Everything else in the proposal (weighted pricing with the mandatory affixes required and a converted max price;
  the budget as a target and a report, never a gate failure; meta overlap not modelled) "sounds good".
  - **Checked in the pin:** the weights come from `calcsTab:GetMiscCalculator()` (`TradeQueryGenerator.lua:844`),
    whose env adds `build.configTab.modList` (`CalcSetup.lua:743`), and the config's `customMods` lines are parsed
    into that list (`ConfigOptions.lua:2279`; a line PoB can't parse is skipped). So custom modifiers set in the build
    do move the weights. An item affix PoB can't parse gets no weight at all; `find_upgrades`' `required_mods` is the
    AND group (at most 3, `pob-api/API/Trade.lua:70`).
- **The study and the proposal** (2026-10-16): `studies/2026-10-16-pricing.md` with its script
  `studies/data/2026-10-16-pricing.py` (`bb8c990`). Checking the derivation corrected the conversion table the user
  had seen: for items under 10 divines the day-7 factor is ×0.4–0.9 across four leagues (the draft's ×0.2–0.6 leaned
  on Forbidden Rites alone); the other rows held. `spec/amendment-5-pricing.md` proposes D-370…D-374 (targets by
  price day; the budget never fails a gate; `b` and `n` rares by `find_upgrades`; conversion to the price day; what
  the guide and the gates show) and WU-74…WU-76. An Explore agent mapped the touch points (175K tokens). Found on
  the way: `find_upgrades` has no `Checked:` line and no `[trade:<kind>]` prefix on its stops (WU-74), and it reads
  the active loadout, so pricing a rung needs a loadout select. The EC lessons become their own amendment.
- **Amendment 5 accepted** by the user, 2026-10-16 ("Looks good"), with the corrected day-7 row. D-370…D-374 and
  WU-74…WU-76 stand as written; the fold to v1.6 carries them with D-363…D-369.
- **D-375, the user's request** (2026-10-16): the endgame designer (D1-build) reads the pattern library, so the
  Lightning Arrow Deadeye run is the baseline for later design changes; added to amendment 5 and WU-75. The user
  named a techniques video for the library (`S1AzLxb3fZw`, "Some nerd interactions to improve your characters",
  787prada, 2026-09-11, 56 min), fetched into `yt-library`; a study agent is on it. The user follows the roadmap:
  build amendment 5, then the Deadeye run, then an engine-lens amendment from the videos and the run's misses. The
  user hadn't seen the study or the amendment because they live in this worktree: give absolute paths.
- **The techniques-video study** (`studies/2026-10-16-S1AzLxb3fZw-nerd-interactions.md`; the agent used 234K tokens,
  10 frames): 14 techniques, four on existing shapes only; five new shapes proposed (Travel by action, Charge-type
  converter, Harmless self-trigger, Duration to the floor, Off-tree defence layer); two engines the creator built
  (the wolf charge loop, and the same wolf deaths feeding volatility) and one inferred (a cull hub). Not in the pin:
  the "Grip of Kulamok" ring and volatility's base chaos line. Spot-checked: Inner Turmoil's "Take no Damage from
  Volatility" and Charge Profusion II's random-type charge match the pin. The new shapes await the user's approval
  (C-53's maintenance rule).
- **Library: the five shapes added** (the user approved, 2026-10-16: "Go ahead"): Charge-type converter (family 3),
  Travel by action and Duration to the floor (5), Harmless self-trigger (7), Off-tree defence layer (8), citing
  `[nerd-interactions]`. Cut to the library's terse form to fit D-325's 6,000-word cap: the library is now at
  exactly 6,000 words, so the next addition needs a trim or a decision on the cap (the engine-lens amendment).
- **WU-74 done by its doer** (`ad28e07` on `bg/wu-74`, 258K tokens): both gate commands exit 0 (129 suites, 2,300
  tests). The loadout select works: after selecting `b`, `find_upgrades` reads `b`'s ring as the current item and
  scores against it; with `n` selected, against `n`'s. Deviations for the fold: the header splits into `League:`,
  `Checked:` and the status line; the stop line reads `Stopped early: [trade:<kind>] <reason>.`, so C-14's output
  block and stop wording (stab `03-trade.md:489-496`, `:542`) and slice 01 §2.9's "keeps C-14's wording" need
  updating; `Checked:` is the wall-clock time of the first search. AC-T46 collided with the stabilization spec's
  AC-T46, so amendment 5's server AC is renamed AC-K68.
- **WU-74 verified and merged** (`b6ac354`, fast-forward; the lane is removed). The independent verifier (112K
  tokens) passed all five unit-gate checks: both exit codes 0 (129 suites, 2,300 tests, plus the NFR step), each AC
  on a real code path, a clean diff, empty waivers and unchanged dependencies, scope inside the grant. Low findings:
  L1, the AC-K68 test can't tell first-search dating from report-time dating within one fake second (the code dates
  by the first search, as C-49 requires); L2, the prefix follows `Stopped early: `, so WU-75's `pricing.md` matches
  `[trade:<kind>]` anywhere in the line; L3, the fold notes above.
- **WU-75 built and merged** (`11dfd10`, fast-forward; the doer used 377K tokens, the verifier 195K). The verifier
  passed every check (129 suites, 2,308 tests; AC-W63's eight tests assert the amendment's numbers; no old-gate
  leftovers; all 22 files in scope) and found nothing blocking. The doer defined the D1 gate's new `basis.budget`
  in `gates.md` ("Price days, targets and ranges"), WU-76's input. Its own choices, all judged sound: "not priced
  yet" `b`/`n` rare entries from D1-build with `query {slot, required:[{affix,min}], target}`; `manage_sets` in the
  coordinator's set P; `prices.json` outside the loader's `DATA_FOLDERS`; card key prices at day 7; fallbacks
  `<id>-fallback` in no total; `--no-ninja` makes only the over-target call.
- **Amendment 5 corrected on the review's findings** (the coordinator's, within the user's acceptance):
  - the over-target call is `search_trade_items` with the required affixes as `mods`: a second `find_upgrades`
    ranked by price re-sorts only its fetched page of the weight-sorted search (`rankUpgrades.ts:304-320`), so it
    doesn't find the cheapest listing with the required affixes;
  - `n`'s Checks line gets the "Over target" sentence too, as `b`'s has (an omission in §6).
  Both go to WU-76, with the review's low notes: `gates.md` step 7 should count only entries `basis.budget.slots`
  names; a fallback's price is shown unconverted; "Over target" is dropped when `b`'s total is unknown.
- **For the v1.6 fold:** `03-pipeline.md:384` (no agent definition names a tool that changes the build) and
  `R1b.md:198` ("mutate tools you don't hold") conflict with the coordinator holding `manage_sets` for D-372's
  loadout select; `plan-reference.md`'s `prices[].query` row needs D-372's query (WU-75 left it).
- **WU-76 built, verified and merged** (`abe1e6a`, fast-forward; the doer used 348K tokens plus a short fix round,
  the verifier 182K). The verifier passed the gate (one AC-T22 timing flake at 8,141 ms under load, passing alone),
  AC-W64 (hand-checked: the 60-divine `b` case is 15–31 at day 7; a day-67 late market gives 2.2–9.9), the
  `gates.md` arithmetic, no budget failure path, the rendered lines and scope. Fixed before merge: the final display
  no longer gives D-164's line for an unavailable fallback; a test for refusing a basis slot that names a fallback;
  `D1-gate.md` dates the market from the slots' prices only, as `gates.md` and the checker do. Full gate after the
  fixes: 129 suites, 2,316 tests, rc 0; build rc 0.
- **Choices to fold** (the doer's, judged sound): a fallback shows inside its slot's parentheses on the Checks line
  ("Weapon 1 (about 3.2–7.2; fallback about 1.2–2.7)", or "fallback price unknown"), which adds to §6's verbatim
  line; a fallback is never a D-164 reason and a basis slot naming one fails; the gate's totals and findings are
  compared only while the gate is fresh; the basis check requires `market` and `totals`; the conversion lives once in
  `render-audit.mjs`, exported to the checker. Low, unfixed: the checker matches over-target findings by price
  entry, so naming the second slot of a shared entry passes against step 7's "first slot".
- **M-16 built:** WU-74…WU-76 are on `build-guide/amendments`. Next: the wave gate in a fresh run worktree, then the
  Lightning Arrow Deadeye run's environment (the user supplies Fubgun's guide link and PoB).
- **M-16 wave gate: PASS at `d0b557c`** (an independent verifier, in the fresh run worktree `m16`, left built).
  Bootstrap clean; `mise run test` rc 0 from clean (129 of 129 suites, 2,316 of 2,316 tests, none skipped; the NFR
  step 2 of 2; about 320 s); `pnpm build` rc 0; both waivers `[]`; `package.json` and the lockfile unchanged since
  `fb8c446`; `vendor/` clean at `7d6f530` (v0.23.1); the README table matches, 84 rows; the checker exits 0 on all
  four pipeline fixtures; AC-K67, AC-K68, AC-W63 and AC-W64 each map to passing tests; `prices.json` equals §5.

## 2026-10-16: the baseline guide changes; amendment 6 proposed

- **The user's direction:**
  - The baseline guide is now Navira's Fracturing Disciple of Varashta (MisoxShiru, Mobalytics,
    `naviras-fracturing-varashta-league-starter`). It is the only guide the user found whose PoB holds every stage as
    a loadout, and it replaces Fubgun's Lightning Arrow Deadeye guide.
  - Copy `.env` to the run's folder: "I am not concerned about leaking a temporary session cookie". It was copied
    unread to `/home/parker/projects/pob2-mcp-wt/m16/.env`, mode 600. That's where the run's server reads the cookie
    (`<packageRoot>/.env`), and the session runs in that worktree.
- **The run environment:** `/home/parker/projects/pob2-mcp-runs/m16-varashta/`, outside `/tmp` so a restart keeps it.
  - `start.sh run` starts the session with telemetry; `run-plain` starts it without.
  - `mcp/`: the `m16` server with trade and poe.ninja on, `POE_LEAGUE="Forbidden Rites"` (league day 42).
  - `cfg/settings.json`: web search is denied, and fetches from mobalytics.gg, maxroll.gg, game8.co, poe-vault.com,
    pobb.in, poe.ninja, YouTube, Twitch and Reddit. Reading any `.env` and the `reference/` folder is denied, and so is
    editing under `/mnt`. poe2db is allowed.
  - `reference/`: the guide's text and Navira's PoB (code and decoded XML), with 8 trees, 8 item sets and 8 skill
    sets from Act 1 to Uber endgame.
  - The smoke test ran offline (trade pointed at a dead address). The server starts with 83 tools, including
    `find_upgrades` and `manage_sets`, and lists Disciple of Varashta.
- **The gap.** `lookup_game_data` finds no "Navira's Fracturing": it is the Water Djinn's second skill, not a gem.
  So the brief check would stop the run. Nothing selects a minion's skill, so plans compute the djinn's first skill,
  a shield that deals no damage. The user chose to add minion-skill selection before the run.
- **The spike** (an agent, 426K tokens) is kept as `studies/2026-10-16-minion-skill-spike.md`.
  - PoB computes Navira's Fracturing: 1,027 DPS in the guide's early endgame set, 3,231 late.
  - No tool or record can read a minion's numbers today: the bridge returns flat fields only, and the minion fields
    the server asks for have never existed.
  - PoB doesn't check the passive that unlocks a command.
  - The touch-point map is in the coordinator's scratchpad (`amend6-touchpoints.md`) for the M-17 handoff.
- **Amendment 6 proposed** (`spec/amendment-6-minion-skills.md`): D-376…D-380; WU-77…WU-79 in series; AC-K69…K71,
  AC-P68, AC-P69, AC-W65, AC-W66.
- **Amendment 6 accepted** by the user, 2026-10-16 ("Go ahead"). The handoff gains "M-17: amendment 6": HG-12 is
  granted for the amendment's contract changes only; WU-77 owns the reusable Lua selector, and WU-78 the compile's
  flattened outputs; Navira's PoB is never committed as a fixture, because the repo is public. The map is kept as
  `studies/2026-10-16-minion-skill-map.md`.

## 2026-10-16: M-17, amendment 6's build

- **WU-77 built** (`0a767b8` on `bg/wu-77`; the doer used 376K tokens). Gate rc 0 (130 suites, 2,335 tests), build
  rc 0, waivers `[]`, dependencies unchanged.
  - **ACs:** AC-K69 and AC-K70 are in `tests/integration/minionSkill.test.ts`; AC-K71 is in `lookupGameData.test.ts`.
  - **The doer's choices, to judge:**
    - `set_main_skill` with `minion_skill` makes the summon the main active skill;
    - `BuildOps.select_minion_skill({groupIndex, name, statSet?, activeSkill?})` refuses a disabled non-main group;
    - both stat-set lookups are always written;
    - minion skills match by exact name in gem mode;
    - there is one result per granted effect;
    - the sweep covers minion children only.
  - **Friction for WU-78:**
    - `lookup_game_data`'s description is at 2,046 of 2,048 characters;
    - `BuildOps.output_field` is exported for `Compile.lua`'s `outputs`;
    - `set_main_selection` now returns `{statSet?, minion?}`;
    - the compile's per-group outputs already carry `Minion*` fields.
  - An independent verifier is running.
- **WU-77 verified: PASS** (an independent verifier, 192K tokens).
  - **Gate:** rc 0 (130 suites, 2,335 tests), build rc 0.
  - **ACs:** AC-K69…K71 are faithful.
  - **Scope:** 17 files, all WU-77's. Waivers `[]`, dependencies unchanged.
  - **The doer's choices:** all seven judged sound.
  - **Findings:** four, all low.
    - Sent back to the doer: no test of a successful stat set above 1 (Kelari's Deception, set 2); a duplicated
      stat-set label helper in `BuildOps.lua`.
    - **To WU-78:** the selector refuses a disabled group that isn't main (PoB builds no skills for it). The compile
      must make such a group main around the call, or `compile_check` must refuse it.
    - **For the v1.6 fold:** AC-K71's "every hit-making child" sweep covers minion children only. 41 of 85 granted
      or triggered children can't be found by name, and a result for them is beyond the HG-12 grant. Reword it to
      "every minion child".
  - **Note for WU-79:** there is one lookup result per granted effect, so the brief check counts the `Cast by:` lines
    across all of a name's results.
- **WU-77 merged** at `cadd4d9` (fast-forward; lane `bg-77` removed).
  - **The fix round** (`cadd4d9` before the rebase, about 8K tokens) added a test of Kelari's Deception at minion stat
    set 2, with stat set 3 refused naming both labels, and removed the duplicated label helper.
  - **The targeted suites:** `minionSkill`, `skillBreakdown` and `contract` rc 0; build rc 0.
  - **Untested:** the duplicate-name refusal, because no minion at the pin has a duplicate name.
- **WU-78 built** (`2a7d1cf` on `bg/wu-78`; the doer used 414K tokens). Gate rc 0 (131 suites, 2,355 tests), build
  rc 0, waivers `[]`, dependencies unchanged.
  - **ACs:** AC-P68 is in `tests/integration/compileMinion.test.ts`, with the fixture plans `minion-wolf` (Wolf Pack
    with Leap Slam, Count 2) and `varashta-navira` (written from game data). AC-P69 is in `planSchema.test.ts`,
    `compileMinion.test.ts` and `planChecks.test.ts`.
  - **The doer's choices, to judge:**
    - the compile makes each minion-skill group main for its own selection, so a disabled group works too;
    - `compile_check` refuses a main group that names a minion skill but whose `main.activeSkill` isn't the summon;
    - the figure field is read from the record's `stages.<id>.minionSkills[]`;
    - `not-granted` fires for enabled or main groups only, never for item-granted gems;
    - item-added minion skills are refused;
    - the two-stage fixture stays at version 3;
    - `outputs` carries every finite `Minion<Field>`.
  - **For WU-79:**
    - D1's pinned "at `schemaVersion: 3`" (`buildGuidePipeline.test.ts:1989`) must become 4;
    - `not-granted` needs its row in `gates.md`;
    - the record field is `stages.<id>.minionSkills[]`.
  - An independent verifier is running. It is also measuring what the bigger `outputs` add to a record.
- **WU-78 verified: PASS** (an independent verifier, 186K tokens).
  - **Gate:** test rc 1 as run, from one tooling false-failure: AC-T22 took 9.57 s against 8 s under load and passes
    alone. The `--runInBand` step was run separately and passes 2 of 2. Build rc 0.
  - **ACs:** AC-P68 and AC-P69 are faithful. The two fixture plans are from game data only.
  - **Scope:** 15 files, all WU-78's. Waivers `[]`, dependencies unchanged.
  - **The doer's choices:** all six accepted.
  - **Findings:** four, all low, sent back to the doer:
    - two orphaned doc comments;
    - `clearGroupOf` measures a non-main minion clear group at active skill 1;
    - the static check ignores a gem's `enabled` and searches every minion type's list, so a disabled summon fails
      hard in `compile_stage` instead of as a defect.
  - **The size of `outputs`:** a summon stage's `outputs` has 1,433 keys, 723 of them `Minion*`. That is +28.9 KB
    (+59%) to `record.json`. Agents read records by Grep only, and D-376 makes every field a ref, so it stays as
    built. Note it at the v1.6 fold.
- **WU-78 merged** (fast-forward; lane `bg-78` removed).
  - **The fix round:**
    - V1's doc comment and the contract test's comment are back above their own code;
    - a non-main minion clear group is measured at its summon (a new `planMeasures` case);
    - `compile_check` reads each gem's `enabled`, so a disabled summon gem is a defect naming the gem (a new
      `compileMinion` case), and it checks the minion type PoB picks for a new gem;
    - `Compile.lua` reuses `BuildOps.numbered`.
  - **Targeted suites:** 6 suites, 225 tests, rc 0; build rc 0.
- **WU-79 built** (`9f2519a` on `bg/wu-79`; the doer used 415K tokens).
  - **Gate:** `mise run test` rc 1, twice, on AC-T22 alone (Ring 1 about 9.5 s against 8 s under the suite's own
    load). It passes alone, and the `--runInBand` step passes run separately. 2,369 of 2,370 tests pass. Build rc 0,
    waivers `[]`, dependencies unchanged. The checker exits 0 on all four pipeline fixtures.
  - **ACs:** AC-W65 is in `buildGuidePipeline.test.ts` (7 tests); AC-W66 is in `buildGuideCheckRun.test.ts` (4 tests,
    on a minion copy of `run-ok-online`), plus a `--changed` case and the renderer's campaign headline.
  - **Pinned text updated:** T1–T4 and D1's schema version (now 4), and the verdict-line message in three places.
  - **The doer's choices, to judge:**
    - `figureOf` and `citedValues` are unchanged;
    - the rolled recompute treats `TotalDPS` and `MinionTotalDPS` as one field, and refuses a gate that compares a
      minion group by `TotalDPS`;
    - D1-build writes every plan at schema 4;
    - `not-granted` sits in the gate findings table;
    - PG-51 is added (PoB's own copy of a tree-granted summon: level 1, no supports).
  - **AC-T22 now fails on time in every full gate since WU-78** (9.5–9.6 s against 8 s; 8.14 s was the worst before
    M-17). The verifier is timing it alone, before and after M-17.
- **WU-79 verified: PASS** (an independent verifier, 197K tokens).
  - **Gate:** rc 1 on AC-T22 alone (Ring 1 at 9.42 s). It passes alone 3 of 3, so it's a tooling false-failure. The
    `--runInBand` step passes 2 of 2. Build rc 0.
  - **ACs:** AC-W65 and AC-W66 are faithful. The doer's claim that 4 of the 6 AC-W66 tests fail on the old scripts is
    confirmed.
  - **Context cost:** about 965 words added across 21 skill files, with no contradictions.
  - **Scope:** 29 files, all WU-79's. Waivers `[]`, dependencies unchanged.
  - **The doer's choices:** all six accepted.
  - **Findings:** three, all low, sent back to the doer:
    - the brief check should count distinct summoning gems, not `Cast by:` lines;
    - the minion verdict-line test's `measures.dps` should be tied to `record.ts`'s `headlineDps`;
    - `gates.md`'s findings heading should cover the V1 row.
  - **AC-T22 timed alone, mean of 3:** 17.6 s before M-17 (`660783e`), 17.3 s after; each slot within ±2%. So M-17
    didn't slow it. Under the full suite the margin was already thin (24.8–31.7 s before; AC-T40 failed on time once
    instead), and M-17's two new engine suites (`minionSkill` 89 s, `compileMinion` 29 s) narrow it. If it keeps
    recurring, move the trade timing test into the `--runInBand` step.
  - **The verifier's slip:** one gate log went to the session scratchpad before it read the handoff's rule against
    that.
- **WU-79 merged** (fast-forward; lane `bg-79` removed).
  - **The fix round:**
    - `start.md` counts the distinct summoning gems in the `Cast by:` lines;
    - `minionRun()` ties `measures.dps` to `record.ts`'s `headlineDps`;
    - `gates.md`'s table is retitled "Finding codes the gate names", and a new static assertion pins the heading.
  - **Targeted suites:** 636 of 636 tests rc 0; the checker rc 0 on the four pipeline fixtures.
- **M-17 built:** WU-77…WU-79 are on `build-guide/amendments`. Next: the wave gate in a fresh run worktree `m17`,
  which then serves the Varashta baseline run.
- **M-17 wave gate: PASS at `b4df4b6`** (an independent verifier, 108K tokens, in the fresh run worktree `m17`, left
  built).
  - **Bootstrap:** clean.
  - **`mise run test` rc 1, from a tooling false-failure only:** AC-T22's Ring 1 took 10.12 s under load, and the test
    passes alone (15.9 s for five slots). The `--runInBand` step passes 2 of 2 when run alone. Otherwise 2,369 of 2,370
    tests pass, in 131 suites.
  - **`pnpm build` rc 0.**
  - **Cross-cutting checks:** waivers `[]`; dependencies unchanged since `660783e`; `vendor/` clean at `7d6f530`; the
    README table matches, 84 rows; the checker exits 0 on all four pipeline fixtures.
  - **ACs:** AC-K69…K71, AC-P68, AC-P69, AC-W65 and AC-W66 each map to passing tests, and one per unit was
    spot-checked as faithful.
  - **The probe, through the built server:**
    - the gem lookup returns Navira's Fracturing as `Kind: minion skill`, one summon, `Commanded: yes`, granted by
      node 10561, so the brief check accepts it as written;
    - `compile_plan` on the `varashta-navira` fixture prints `DPS 649 (Navira's Fracturing, minion)`;
      `measures.dps` = `MinionTotalDPS` × 1 = `FullDPS`;
    - the saved build holds `skillMinionSkill="2"`;
    - V1 reports no `not-granted`.
  - **Finding (low):** AC-T22 now fails on time in every full gate, and the failure stops `mise run test` before its
    compile-time step. Moving AC-T22 into the `--runInBand` step would fix both; it's the user's call, after the run.
- **M-17 total:** about 1.92M tokens across three doers, three verifiers and the wave gate (and 426K for the spike).
- **The baseline run's environment** now points at `m17`.
  - `/home/parker/projects/pob2-mcp-runs/m16-varashta/`: `start.sh` and the server wrapper use `m17`; the settings
    pre-approve the skill's three scripts; the README holds the user's steps.
  - `.env` was copied unread to `m17` (mode 600), and `m16`'s copy was removed.
  - The offline smoke test through the wrapper passes: 83 tools, and the lookup finds the command.
  - **Next:** the user starts the run with `start.sh run`, then
    `/build-guide "Disciple of Varashta" "Navira's Fracturing"`.

## 2026-10-17: the library's word cap rises to 10,000 (D-381); AC-T22 runs alone

The user decided both on 2026-10-17, before the baseline run: raise the pattern library's cap ("I'll let you decide
how much"), and fix the trade-timing test.

- **D-381 (decided by the user; the coordinator chose the number): the pattern library's cap is 10,000 words,**
  replacing D-325's 6,000. AC-W28's static test still counts it.
  - **Why the cap had to move:** the library sat at 5,999 of 6,000 words after M-17, and the engine-lens amendment
    adds to it.
  - **Why 10,000:** at 5,999 words the file is 42,467 characters (about 10.6K tokens) on 741 lines. At 10,000 words it
    would be about 18K tokens on about 1,240 lines. That still comes back whole from one read (the Read tool's default
    is 2,000 lines), so every reader still reads it whole. It leaves about 4,000 words for the engine-lens amendment
    and later studies.
  - **The cost:** every agent that reads the library whole reads up to about 7K tokens more at the cap. Those agents
    are each R1a researcher, and D1-build under D-375.
  - **Still a cap:** it keeps the library a curated set of shapes, not an archive. Entries stay terse.
  - **Code:** `tests/static/buildGuidePipeline.test.ts` gains `LIBRARY_WORD_CAP = 10_000`. Both word-count
    assertions use it (AC-W28's, and the M-17 test on the Actor rerouting entry). No skill file states the number.
- **AC-T22 moves to the `--runInBand` step.** This is the trade-query generation test: five slots at 8 s each, on the
  golden build.
  - **The problem:** since WU-78 it failed on time in every full gate (9.4–10.1 s against 8 s under load) and passed
    every time alone. Each failure also stopped `mise run test` before its compile-time step.
  - **The new file:** `tests/integration/tradeQueryNfr.test.ts` holds AC-T22 as it stood. It gets its own engine and
    temp builds dir on the golden build. `trade.lua.test.ts` loses the test, and its header points to the new file.
  - **The wiring:**
    - `jest.config.cjs` leaves the new file out of the parallel run.
    - `mise.toml`'s last step lists both timing files in one `--runInBand` Jest call, so both run even when one
      fails, and either failure fails the task.
    - The static checks in `compilePlan.test.ts` cover both files: the main run lists neither, the step lists
      exactly the two, and the step is its own entry after `pnpm test`, with no pipe.
- **For the v1.6 fold:**
  - D-381 joins the decisions table.
  - C-53 and D-325's "6,000" becomes "10,000 (D-381)". The places: the spine `README.md:625-626` and `:927`, and
    `03-pipeline.md:1126-1127`, `:2170` and `:2528` (F16).
  - C-19's row (`README.md:236`) and `02-plan-compiler.md:759` and `:1362` name AC-T22's file beside
    `compilePlanNfr.test.ts`.
- **Gate: `mise run test` rc 0, `pnpm build` rc 0** (on this machine at a load average under 1).
  - The parallel run: 2,369 of 2,369 tests in 131 suites, in 213 s.
  - The `--runInBand` step: 3 of 3 tests in 2 suites. AC-T22 took 14.7 s for its five slots; the compile-time file
    took 81 s.
  - This is the first full gate since WU-78 with no tooling false-failure.

## 2026-10-17: the engine-lens amendment's scope gains tamed rare beasts

The user raised Tame Beast. A captured rare beast keeps some of its monster modifiers. Navira's Varashta guide tames
a beast with Frozen Ground Trail, so the beast makes the Chilled Ground that Navira's Fracturing consumes, and the
build becomes one button. The user asked to add it to the engine-lens amendment's scope ("Yes", 2026-10-17).

- **The library:** no entry covers it. The only companion mention is Twister's example under Drawback cancellation.
- **PoB2 at the pin:**
  - **The gem:** `TameBeastPlayer` (`Data/Skills/act_dex.lua:8874`). A capture turns it into `SummonBeastPlayer`,
    "Companion: {0}" (`:870`).
  - **The beast:** the companion's species comes from the build's beast library (`CalcActiveSkill.lua:904-906`
    reads `build.beastList`). The build file saves it as `<BeastCompanion id>` (`Build.lua:1126-1129`, `:1166-1167`).
    PoB's UI sets it under "Manage Beasts…" (`:458`, `:1533-1561`).
  - **The beasts' data:** `Data/Spectres.lua` holds 619 monsters, 192 of them `monsterCategory = "Beast"`. Each
    has life, resistances, damage, `skillList`, `spawnLocation`, `companionReservation` (its Spirit cost) and the
    species' own `modList`.
  - **The rare modifiers are missing.** PoB has only the gem's text, "Tamed Beast retains up to four monster
    modifiers when summoned" (`display_tame_beast_mod_limit`). It has no table of rare monster modifiers and no way
    to give the companion one. No frozen-ground trail appears anywhere in its data.
- **Our server:** nothing reads or sets the beast library (nothing in `pob-api/` uses `beastList`). So a plan can't
  model a tamed beast at all, not even its damage or Spirit cost. The spectre library has the same gap.
- **What the missing modifiers cost:**
  - In Navira's build, the modifier changes who makes the Chilled Ground, not how hard Navira's Fracturing hits.
    The gap there is knowing the modifier exists, so R1a can propose it and W1 can say how to get it.
  - Modifiers with a numeric effect would need our own modelling, one by one.
- **The scope for the engine-lens amendment:**
  1. A committed table of rare monster modifiers, sourced from the game data on poe2db. Each row holds the name,
     the in-game text, what it does, and whether a tamed beast can keep it. `lookup_game_data` answers questions
     about it.
  2. Server support for the beast library: a plan names the companion's species, so its damage, defences and Spirit
     cost are measured. The spectre library may come along on the same path.
  3. A library entry for the shape "a tamed rare beast supplies a condition the engine needs", with Navira's build
     as its example.
  4. A `docs/build-guide/pob-gaps.md` entry for the rare modifiers PoB2 lacks.
- **The baseline run:** it uses `m17`, detached at `b4df4b6`, so these additions can't leak into it. The comparison
  should record the beast as a miss: nothing in the run's tools or library covers it.

## 2026-10-17: the baseline run's feedback, collected for one amendment

The user is giving feedback while the Varashta baseline run goes on. It is collected in
`studies/2026-10-17-varashta-run-feedback.md`. When the run is finished, it all becomes one amendment.

- **The brainstorm gate (visit 1):**
  - The display should pitch each card to a player: a shared core first, then each card's hook, how it plays, what
    it needs and when, and the catch.
  - Human-friendly names replace card ids. Confidence reads "not confirmed in game", and appears only where it
    differs between cards.
  - The gate becomes an interview: the user asks questions first, and a choice can carry changes ("this one,
    but…"). The user accepts more complex offline testing for better UX.

## 2026-10-17: the compile measured PoB's own Navira, not the plan's (D-382); the baseline run's blocker

The baseline run (`disciple-of-varashta-navira-s-fracturing/2026-10-17-1`) stopped at the verification gate. The run
session diagnosed it; the user paused the run until it is fixed.

- **The symptom, in all three R1b skeletons:** the record's main group, g1s1p1, was PoB's own level-1, unsupported
  Navira (MinionTotalDPS 543, 451 and 817). The plan's Navira landed at PoB's group 2 with its minion skill left on
  Navira's Embrace, and Full DPS was 0. V1 and V2 passed it. The same skeletons without nodes 32705 and 10561
  measured 33,922, 22,177 and 39,113, and the cards carry those workaround figures.
- **The cause (`pob-api/API/Compile.lua`):** the compile addressed the plan's groups by their plan position as if it
  were PoB's `socketGroupList` index: the minion-skill selection, the main selection, `granted_skills` (D-380),
  `stage_gems` (V1's input) and the C-45 breakdown's keys. Its comment said PoB's own groups come after the plan's.
  PoB breaks that. Every MAIN-mode calculation appends a group, with a `source`, for each granted skill that has no
  group yet, and removes stale ones (vendor `Modules/CalcSetup.lua:1501-1663`; node 32705's Navira is
  `source = "Tree:32705"`). A stage with an off-hand runs a calculation before its skills are built (the off-hand
  check), so PoB's Navira went in first and every plan index was off by one. The R1b bootstrap compiles had no items,
  so no calculation came first; the fixture `varashta-navira` equips none either, so the tests missed it.
- **The later-stage note was real:** that early calculation ran with the previous stage's skill set active, so PoB
  added the new stage's granted group to the earlier stage's set. The new test shows it: stage a without the node,
  stage b with it and an off-hand, and stage a's set gained `Tree:32705`.
- **D-382 (the fix; the coordinator chose the direction, the number is the next free one):**
  - **The plan's groups are the active skill set's groups without a `source`, in order** (`group_indices`). Every
    use reads PoB's index from it: `select_minion_skills`, `select_main`, `granted_skills` and `stage_gems`.
    `created.index` alone wouldn't do: a reused skill set creates no groups, and a calculation can remove a stale
    PoB group anywhere in the list.
  - **Every group number in the reply stays the plan's:** the plan's groups first, in plan order, then PoB's own, in
    PoB's order. This is the contract the compiler already assumed (`record.ts`, V1, the ledger's
    `g<group>s<skill>p<statSet>` refs, the D1 gate's rolled-skill part, `check-run.mjs`), so nothing outside the Lua
    changes. `skill_outputs` keys its breakdown and the DoT flags by that number.
  - **The stage's skill set is selected before its first calculation**, with the tree and the items, so PoB's
    groups for this stage's tree and items go into the stage's own set. `build_skills` only adds the groups now.
  - Not changed: PoB's group order, and when PoB calculates.
- **Tests** (`tests/integration/compileMinion.test.ts`, the new describe "D-382: the plan's groups are found at PoB's
  own index, wherever PoB's granted groups land"). All four failed before the fix, as the diagnosis predicted:
  - a fresh item set with a Twig Focus: PoB's groups are `['Tree:32705', '']`, and the main selection, the minion
    skill, g1s1p1 (the no-item figure) and `measures.dps` are the plan's Navira; PoB's copy is g2;
  - a stage `a` reusing the item set (`settle_off_hands`) and the skill set: both stages measure the plan's Navira;
  - a second group with Kelari, the Tainted Sands, whose node isn't allocated: V1 reports `not-granted` for group 2,
    and every finding or note that names a gem names one in its group (before the fix: no finding at all);
  - stage `a` without the node, stage `b` with it and an off-hand: stage a's set holds no `Tree:32705` group.
  - `SUMMON_QUERY` now reads the plan's first group (the first without a `source`) and returns its PoB index and the
    groups' sources; AC-P68 also checks that the index is 1 with no items.
- **Gate: `mise run test` rc 0, `pnpm build` rc 0.** The parallel run: 2,373 of 2,373 tests in 131 suites, in 192 s.
  The `--runInBand` step: 3 of 3 (AC-T22's five slots took 14.0 s).
- **For the run:** its server must be rebuilt from this commit and reconnected. The skeletons' gate reports
  (`reports/gates/R1b-r2-c-{1,2,3}-a1.json`) came from the bugged compile, and the design phase compiles a fresh plan,
  so its figures will be the plan's group with both nodes allocated. They may differ from the cards' workaround
  figures, which were measured without the two nodes.
- **For the v1.6 fold:**
  - D-382 joins the decisions table.
  - `02-plan-compiler.md:546-547` (compile_stage's reply): `<group>` in `g<group>s<skill>p<statSet>`, and every
    group number in the reply, is the plan's group number, PoB's own groups numbered after the plan's.
  - The compile_stage steps: the skill set is selected with the tree and the items, before the stage's first
    calculation.
  - `pob-gaps.md` PG-51's "at the end of the socket groups" now says where PoB's group lands.

## 2026-10-17: the Varashta baseline run completes

The run (`disciple-of-varashta-navira-s-fracturing/2026-10-17-1`, on the `m17` worktree at `b76967b`) completed, and
the user accepted the guide at the final gate.

- **The build:** `r2-c-1`, the skeleton-death engine. Navira's DPS was 10,897 entering maps, 40,733 on the budget
  variant and 95,437 on the non-budget variant. Most prices are unknown: the trade site rate-limited the first design
  pass.
- **The checker:** four violations. One is the real 429 (NFR-22). Three are rolled-skill (D-378) false positives on
  plain summon groups.
- **The feedback file** (`studies/2026-10-17-varashta-run-feedback.md`) now also holds:
  - the verification gate: legacy gems, and the Powered by Verisium miss;
  - the users brainstorm and its discussion;
  - the design gate: the Oracle-only nodes, and Skeletal Cleric, which the designer had measured;
  - the final gate, and the runner's nine-item gap list with a triage.
- **Next:**
  - the comparison with Navira's guide;
  - the defects in the gap list;
  - the one feedback amendment.

## 2026-10-17: the baseline run's defect batch (D-383…D-388, PG-52, PG-53)

The defects in the Varashta run's gap list (`studies/2026-10-17-varashta-run-feedback.md` §5.1), fixed test-first,
one commit each. The skill-side rules (legacy means not in the game; the gates as interviews) stay for the one
feedback amendment.

- **D-383, unlock constraints** (`e71937d`). A node with an `unlockConstraint` is allocatable only while every node
  it names is allocated (vendor `Classes/PassiveSpec.lua:1248-1251`); 197 of the pin's 200 constraints name the
  Oracle's The Unseen Path (5571).
  - `compile_check` refuses such a node: "node 22133 (Command Skill Cooldown) is locked: PoB unlocks it only while
    node 5571 (The Unseen Path, an Oracle node) is allocated". V1 needs no rule: a refused plan never compiles.
  - A new read, `get_rule_breaks`, lists a loaded build's locked nodes. `judge()` reports them after PoB's
    warnings, so `validate_build`, `get_build_issues` and the load summary name them. PoB drops a listed node no
    path reaches on load, so a locked node only survives with a path to it.
  - Tests: AC-P26's defect table, `tests/unit/judge.test.ts`, `tests/integration/ruleBreaks.test.ts`.
- **D-384, legacy gems and uniques no longer obtainable** (`2ff277d`). Legacy is the granted effect's `legacy =
  true` (eight skills, Commandment among them), not `Tier = 0`; no longer obtainable is PoB's item database rule
  (source "No longer obtainable", or a Race Events league; `Classes/ItemDBControl.lua:118-119`).
  - `lookup_game_data` leaves them out of every mode, gem lists included (supports, unlocks, "usable by"), and
    names the ones a query matched ("Left out: …"). Its description was trimmed to stay within 2,048 characters.
  - `compile_check` refuses them; `add_gem`, `setup_skill_with_gems`, `add_item` and `add_multiple_items` add them,
    as PoB does, with a warning; `get_rule_breaks` and `judge()` report them.
  - Tests: `ruleBreaks.test.ts`, AC-P26, `judge.test.ts`; the lookup suite recomputes its gem sets without legacy
    gems (`LIVE_GEMS`), and AC-K61's Whirling Assault count drops from 29 to 28.
- **D-385, the rolled-skill rule for plain summons** (`46eb095`). A group whose compared skill summons a minion (its
  record entry carries `Minion<Field>` fields) is compared by its minion's figure, whether or not it names a
  minion skill. `check-run.mjs`, `gates.md`, `D1-gate.md` and `D1-build.md`. The Varashta run's three rolled-skill
  violations are this rule's false positives.
  - Left as it is: the record's `figureField` still reads `TotalDPS` for a plain summon that is the *main* skill
    (planMeasures' D-378 test asserts it). A build whose named skill is a plain summon would get a headline of 0;
    worth a decision with the feedback amendment.
- **D-386, a price's note is no build content** (`24f5b93`). `buildSha1`'s projection leaves out `prices[].note`;
  every other price field still counts. The five fixture records whose hash matched their plan are refreshed, and
  the checker's message and the skill's wording (`run-folder.md`, `D1-finish.md`, `D2.md`) name the note.
- **D-387, Distilled Emotions from the currency exchange** (`18b46bf`). One polite request confirmed poe.ninja's
  exchange overview lists them, category `Delirium`, by PoB's names (26 items, values in divines); it is the
  committed fixture `tests/fixtures/poeninja/delirium-overview.response.json`.
  - `get_item_price` recognises an emotion by name (`Liquid Envy`, every tier and the Ancient ones) and prices it
    from that overview, cached as the rates are, with no trade request and no fallback to listings.
  - `pricing.md`: an emotion's price is its `Exchange value:`. The poe2scout dumps aren't used.
  - Tests: `tests/mcp/exchangePrice.test.ts`.
- **D-388, ranking a summon main skill** (`d8e2b5f`). `get_passive_upgrades` read the player's CombinedDPS and
  TotalDPS, 0 for a summon. It now reads `MinionTotalDPS` when the main skill summons a minion (`calc_with` reads
  `Minion<Field>` as `get_stats` does), says so on the base line, and searches minion notables first.
  `suggest_supports` already ranked by the minion's CombinedDPS, as PoB's gem selector does; its reply now names the
  field `MinionCombinedDPS`. Tests: `tests/integration/minionRanking.test.ts`.
- **PG-52, PG-53** (`551b002`, `pob-gaps.md`). At your Command's multiplier has no `actor = "parent"`, so on the minion
  it is 0 and PoB applies nothing; Muster's count takes every Minion-and-Persistent skill, Navira and Cast on Minion
  Death included.
- **Two fixtures broke the new rules**, as they should: the fifteen-stage plan (a Titan plan) held two Oracle-only
  nodes (8693 and 35393, stages 9-15) and Bloodlust in five groups of every stage, and AC-P43's breadth-first tree
  reached five Oracle-only nodes. The fixture drops them (`9231ba9`), and AC-P43's search skips any node with an unlock
  constraint.
- **Gate:** `mise run test` rc 0 (134 suites, 2,397 tests; the `--runInBand` step 3 of 3), `pnpm build` rc 0.
- **For the v1.6 fold:** D-383…D-388 join the decisions table. C-37 (`lookup_game_data`): legacy gems and unobtainable
  uniques are left out and named. The compile check's defect list (02-plan-compiler) gains locked nodes, legacy gems
  and unobtainable uniques. FR-A1 (`judge()`) gains the rule breaks. D-266's projection gains D-386. D-372's
  routing: an emotion's price comes from the exchange (D-387). C-47 (`get_passive_upgrades`) gains D-388.

## 2026-10-17: the baseline build against Navira's guide

The comparison is `studies/2026-10-17-varashta-comparison.md` (`cdee5c4`). Both PoB files were measured read-only in
the `m17` engine at `b76967b`.

- **The same core, different supply.** Both builds turn minion deaths into Ice Nova's Chilled Ground for Navira's
  Fracturing. Ours got that core from the user's round-2 note at the brainstorm gate. Navira's feeds Ice Nova with
  Powered by Verisium's infusions, and runs about eight minion types on a sceptre (334 Spirit against our 100), with
  Kelari as its boss answer.
- **The figures:** Navira's Fracturing does 119,260 against our 51,349 on a pinnacle boss (×2.3). Against map
  monsters, with the same At your Command handling, it's 151,195 against 95,437 (×1.6). Muster is most of the gap.
  Effective hit pool: 24,192 against 13,954.
- **For the engine-lens amendment:**
  - the supply search covers a resource's class;
  - "what scales per type, and what pays for more types";
  - a single-target answer on every card;
  - a stated way to value what PoB can't measure (Encroaching Ground was found but never used).
- **For the feedback amendment:** a gate answers "can X make an engine?" questions. A card's pitch leads with
  one-button clearing, a named boss answer, cost and respec.
- **For the next server batch:**
  - loading a PoB whose tree-granted groups hold supports drops the supports silently (`CalcSetup.lua:1503-1534`);
    this needs a `pob-gaps.md` entry and a load warning;
  - on a heavy minion build (Navira's PoB), the session's snapshot after a change timed out, even at 300 s, for a
    loadout switch, a custom-modifier `set_config` and a `toggle_gem`. It needs a probe.
- **Still open from the defect batch:** the compile record's headline reads `TotalDPS` for a plain summon that is the
  main skill, so its headline DPS would be 0. That needs a decision; it goes to the feedback amendment.

## 2026-10-18: general lessons from the comparison; amendment 7 drafted

- **The comparison's general lessons** (`c8659f1`, its new §7). Almost none of the gap to Navira's build comes from
  tuning; it comes from the build's structure. The user's diagnosis: the pipeline settles on a local maximum without
  lateral moves, and tuning the wrong strategy wastes tokens. Players judge a build by clear speed (damage, area and
  pace between packs), with bosses as a floor. §7.2 lists twelve remedies, and §7.3 sorts them between the
  engine-lens amendment, this one and a pattern library. New content is known only through the community's
  crowd-sourced services or videos (the user).
- **Amendment 7, gates as interviews** (`spec/amendment-7-gate-interviews.md`), DRAFT for the user's review. It folds
  in all of the Varashta run's feedback, D-389 to D-397:
  - every gate takes questions before the decision, which the runner restates and confirms;
  - the runner answers from cards, research and lookups, or through a new gate question step (stage `Q`);
  - a pick can carry changes;
  - cards are named pitches, led by clear speed, under a deck header with a found-not-used list;
  - plain words at every gate;
  - a seed card from a reference build the user names;
  - scripted interviews in the test config;
  - legacy means not in the game;
  - no dead gems in a loadout;
  - a plain summon's headline is its minion's figure (the defect batch's open item).

  Work units WU-80 to WU-82; §15 lists the four choices with a real alternative.

**Git bookkeeping (2026-10-18, with the user present).**

- **The gate at `5f68bb2`:** `mise run test` rc 0 (134 suites and 2,397 tests, plus the timing suites' 3 tests);
  `pnpm build` rc 0.
- **Fast-forwarded `main`** from `afbcc6b` to `5f68bb2` (243 commits) in the main checkout, which is now on `main`.
  `build/` is rebuilt, and the user reconnected the pob2 server to it.
- **Removed (by the user):** the worktrees `amend`, `m14`, `m15`, `m16` and `m17`, all clean and contained in
  `main`, and the merged branches `build-guide/amendment-3` and `build-guide/amendments`. `pob2-mcp-wt/` keeps only
  `ninja-cache/`.
- **Not pushed.** 240 of the commits above `origin/main` are unsigned. The sign-rebase now runs on `main`, and the
  hashes the docs cite are remapped after it, as on 2026-10-10.
- **Where work happens now:** `/home/parker/projects/pob2-mcp` on `main`. Next: the user's review of amendment 7.
- **Amendment 7, a new card at the gate** (the user, 2026-10-18: "new card for change requests that aren't a
  straightforward revision of an existing card"). D-391 now sorts a change into a revision, which keeps the card's
  identity and chain core, or a new card (`r<k>-g-<n>`), which R1b writes and verifies in the same round with no
  brainstorm round. When unsure, a new card. The cards it draws on stay in the deck. Today such a request can only
  become "brainstorm more", a whole round with no guarantee the combination is dealt.

## 2026-10-18: poe2db and poe2wiki as sources; the league digest

- **Asked whether we use poe2wiki and poe2db** (the user's own go-to sources):
  - **poe2db** has been an allowed host since D-171, in online runs only. The committed reference data cites it. The
    Varashta run cited it 4 times in about 350 research citations, as a last resort when a lookup returned nothing
    (Navira's page; Puppet Master's buff). Nothing directs its use.
  - **poe2wiki** was never used. It still refuses agents: Anubis, a proof-of-work bot shield, blocks both its pages
    and `api.php`. Getting past it with a real browser would override the operator's choice, so it stays out unless
    the user decides otherwise.
- **The probe** (8 requests to poe2db, serial). robots.txt disallows only `/*/marked` and `/*/markdown_history`.
  - **The homepage's popover summaries** are content-addressed files on `cdn.poe2db.tw`, which return 403 to a
    direct request. Not pursued.
  - **The league's list pages carry every entry's full text,** one request each:
    - `Runes_of_Aldur_gems`: 57 gems, about 2,400 words;
    - `Runes_of_Aldur_uniques`: 50 uniques, about 3,150 words;
    - `Runes_of_Aldur_items`: 309 items, about 11,900 words, mostly currency;
    - the homepage's league section names the new ascendancies and passives.
  - **The gems page holds Powered by Verisium,** the piece Navira's build ran on and our run missed.
- **Agreed with the user: a committed per-league digest,** in the engine-lens amendment. It brings the comparison's
  §7.2 remedy 3 forward.
  - A script fetches the list pages once per patch and parses the HTML exactly, not through WebFetch's summary.
  - It writes each entry's name, kind, tags, text, URL, access date, and whether the PoB pin knows it.
  - It is committed with fixture tests, with no network (D-34).
  - Every brainstorm reads it first, offline runs included.
  - The user triggers a refresh when a league or patch lands. An online run may warn when the digest's league isn't
    current.
- **Rule changers, for the engine-lens amendment** (the user, 2026-10-18). Way of the Stonefist (Martial Artist,
  node 39595) turns equipped gloves into Fists of Stone with more powerful related explicit modifiers, "something
  that a naive researcher wouldn't think to look for".
  - **The pattern library has no such lens.** Its keystone entries are about pathing and attribute bridges.
  - **The pinned PoB ignores all three of the node's lines** (`check_model_coverage`: 3 unparsed).
  - **Added as the comparison's remedy 13:** a lens, plus a one-sentence list of every rule-changing ascendancy
    notable and keystone. Each entry says what rule it changes, what that makes valuable, and whether PoB models it.
  - **The list is written once per pin** from the tree's text: 22 ascendancies, 209 notables, about 2,800 words,
    plus 33 keystones. It is redone at a pin upgrade.
- **Rule-changing uniques join remedy 13** (agreed with the user, 2026-10-18). There is one index across ascendancy
  nodes, keystones, gems and uniques, built once per pin and searched by mechanic, never loaded whole.
  - **Each entry holds:** what it creates and what it pays off on; only its explicit penalties. The index says once
    that most uniques give up a rare's resistances, life and defences.
  - **A script precomputes the pairs** by joining what one entry creates with what another pays off on.
  - **Price is dropped as a popularity signal:** it is popularity plus rarity, and a widely used unique that drops
    anywhere can cost a few chaos (the user).
- **Amendment 7 approved** by the user, 2026-10-18 ("Amendment 7 looks good, I accept the recommendations"), with the
  first option in each §15 choice:
  - the runner restates the decision and waits for a yes;
  - it starts a gate question step after a one-line notice;
  - it reads card and research files itself;
  - the seed card stays in this amendment.

  Next: the sign-rebase and the force push the user authorized (`origin/main` has the unsigned commits since the
  user's push), then M-18, amendment 7's build.

**Git bookkeeping: the sign-rebase (2026-10-18, with the user present).**

- **The user pushed `main` unsigned** (to `8ade8a8`) and authorized a force push after the sign-rebase.
- **Re-signed the 246 unsigned commits above `acec4d1`.** Each is re-created with the same tree, parent chain,
  message, author, committer and both dates; only the signature is new.
  - All 246 show good signatures.
  - Every commit's tree is identical, and the metadata matches commit for commit.
  - The old history is kept locally as `refs/archive/pre-sign-2026-10-18`, which is not pushed.
- **Updated the commit hashes the docs cite: 277 citations in 9 files.**
  - Citations of the re-signed commits are mapped exactly; two all-digit hashes were done by hand.
  - Citations of unit-branch originals are mapped to their one main-line copy by subject. The exception is a
    line that cites both the original and its rebased copy (WU-70 A), which keeps the original.
  - `58663e7` (a test comment, from before the range) has no main-line copy and is unchanged.
- **Then force-pushed `main` to `origin`,** with a lease on `8ade8a8`.

## 2026-10-18: M-18, amendment 7's build

- **The user said "Go ahead"** to the build, 2026-10-18.
- **The handoff gains "M-18: amendment 7"** (`build-handoff-amendments.md`):
  - WU-80 and WU-81 run in parallel, and WU-82 follows WU-81;
  - WU-80 owns `src/` and its tests;
  - WU-81 owns the skill's scripts, their tests and the pipeline fixtures, and defines the formats WU-82 describes;
  - HG-12 is granted for D-397's headline, key-figure line and record only;
  - no network.
- **The integration worktree** is `pob2-mcp-wt/amend`, on a new `build-guide/amendments` branch off `main`. The
  lanes are `bg-80` and `bg-81`.
- **WU-80 built** (`787522a` on `bg/wu-80`; the doer used 193K tokens). Gate rc 0 (135 suites, 2,400 tests; the
  `--runInBand` step 3 of 3), build rc 0, waivers `[]`, dependencies unchanged.
  - **The change:** `figureField` reads `MinionTotalDPS` when a group names a minion skill, or when its selected
    `skillOutputs` entry carries `Minion<Field>` fields. The test is a shared `summonsMinion(fields)`, which
    `get_passive_upgrades` (D-388) now calls too. The headline and the key-figure line follow it.
  - **AC-P70** is in `tests/integration/compilePlainSummon.test.ts` (2 engine tests). The unit edges are in
    `planMeasures.test.ts`.
  - **The coordinator's decisions on the doer's report:**
    - **Accepted:** the key-figure label is the record's own skill name, `(Skeletal Warrior Minion, minion)`, not
      the AC's `(Skeletal Warrior, minion)`. The record holds PoB's granted-effect name; the gem's name would need a
      new field in the engine reply. AC-P70's wording changes at the fold.
    - **Accepted:** `figureField` takes `(rec, {group, activeSkill, statSet?})`.
    - **Changed (fix round):** the clear-speed measure follows the same rule. Otherwise a plain summon as the main
      group reads "slow" from the player's radius of 0. It falls under D-397's intent: the figure of a plain summon
      is its minion's.
  - **Relayed to WU-81:** the renderer's copy of the headline rule and its test (`buildGuideScripts.test.ts:242-244`)
    still read only `minionSkills`. They are WU-81's under D-397's reach.
  - **The doer's slip:** one gate log was written to `/tmp` rather than a `mktemp -d` dir, then deleted.
- **WU-80's fix round** (`7c3718a`; the doer's total was 216K tokens).
  - The new `minionFigures(rec, group, key)` decides for both `figureField` and the clear measure.
  - Gate rc 0 (135 suites, 2,401 tests), build rc 0.
  - **The doer's finding:** the Skeletal Warrior still reads "slow", now from its own numbers. At the pin, PoB gives
    the warrior's strike no area radius (no `MinionAreaOfEffectRadiusMetres`), so its radius is 0 on either side.
    The unit tests cover a minion with a 4.5 m radius ("fast").
  - An independent verifier is running.
- **WU-80 verified: PASS** (an independent verifier, 120K tokens).
  - **Gate:** rc 0 (135 suites, 2,401 tests; the `--runInBand` step 3 of 3), build rc 0.
  - **AC-P70 is faithful.** The summon case fails on the base code (expected 78.0, received 0) and passes on the unit.
  - **Scope:** 5 files under `src/` and `tests/`. Waivers `[]`, no tool or description changed.
  - **The coordinator's three rulings** are implemented as stated.
  - **Findings, all low:**
    - a plain summon with no `skillOutputs` entry at the main key falls back to `TotalDPS`. This is theoretical, and
      a test pins it;
    - a non-main clear group is measured at its first active skill, so the rule misses a plain summon in second
      place. That predates the unit and is outside D-397;
    - a stale header comment, fixed by the coordinator (`5d8d4d1`).
- **WU-81 built** (`7986e85` on `bg/wu-81`; the doer used 468K tokens). Gate rc 0 (134 suites, 2,416 tests, plus
  the `--runInBand` step), build rc 0, waivers `[]`, `src/` and dependencies untouched. The checker exits 0 on all five
  pipeline fixtures.
  - **Fixtures:** `run-interview` is new: it stops at the verification gate and is written from game data.
    `run-ok`, `run-ok-online` and `run-escalated` are migrated to the new deck and Pitch format, since the checker
    now requires the deck header. `run-ok-v2` is unchanged.
  - **AC-W67** is in `buildGuideScripts.test.ts`. **AC-W68** is in `buildGuideScripts.test.ts` and
    `buildGuideCheckRun.test.ts`. D-397's reach is in the renderer and the verification display; the checker
    needed none.
  - **The doer's choices, to judge:**
    - `questions` is optional and counts 0 when absent;
    - a pick of new cards only is written `pick:` with no id;
    - stage `Q`, and `interviews/` and `probes/q-…/` in the layout;
    - a `test-config` command in `run-log.mjs`;
    - a new card may draw on a not-dealt card;
    - a verification `pick:`'s changes need no card line;
    - the "not confirmed in game" default is printed by the display;
    - the verification display reads figures from the records;
    - `parseCard` and `parseDeck` are shared with the checker;
    - figures print with thousands separators.
  - **It defines the formats WU-82 describes:** the card's Pitch fields, the deck's H2s, the interview notes, the
    gate question report, the checkpoint JSON and the test config's object entries.
  - An independent verifier is running.
- **WU-81 verified: PASS** (an independent verifier).
  - **Gate:** rc 0 (134 suites, 2,416 tests; the `--runInBand` step 3 of 3), build rc 0. The checker exits 0 on all
    five fixtures.
  - **AC-W67 and AC-W68 are faithful.** On the base scripts, the brainstorm display prints card ids, the design
    display prints "compiled pass", and the checker exits 1 on `run-interview` with 14 violations.
  - **The migration lost no coverage.** All ten of the doer's choices are accepted.
  - **Findings, all low:**
    - the verification display's clear speed never appears, because a skeleton's record has no
      `measures.clearSpeed` (`compiler.ts:1054` measures only variant stages). Fix round: when the record has none,
      the display shows the card's "How it clears" line marked as an estimate. Measuring a skeleton's clear speed goes
      to the engine-lens amendment (the comparison's remedy 9, scoring clear speed);
    - the checker's message for notes that don't cite a gate question report says the opposite. Fix round;
    - the "Changed at the gate" line is matched by visit only. Left as is: no card can be both changed at the
      brainstorm and re-verified;
    - cosmetic: the escalation sentence repeats the finding's stage id and fault code. Left as is.
- **WU-81's fix round** (`047bb17`). Gate rc 0 (2,417 tests, plus the 3 timing tests), build rc 0. The checker
  exits 0 on all five fixtures.
  - **The verification display:** with no measured clear speed, a verified card's "How it clears" ends "(an
    estimate; measured at the design)".
  - **The checker's message** now says the notes don't cite the report.
- **WU-81 merged** (fast-forward, after a rebase onto WU-80). `studies/2026-10-18-wu81-formats.md` keeps the formats
  for WU-82.
- **The integration head after WU-80 and WU-81** (`047bb17`):
  - build rc 0;
  - the four touched suites, 675 tests, rc 0;
  - the checker exits 0 on all five fixtures.
- **WU-82 started** in lane `bg-82`, at `047bb17`. The skill's text is 61,727 words before it (`SKILL.md`,
  `references/`, `templates/` and the agent definitions).
- **WU-82 built** (`36251dc` on `bg/wu-82`; the doer used 470K tokens). Gate rc 0, build rc 0, waivers `[]`. The
  checker exits 0 on all five fixtures.
  - **AC-W69** is in `buildGuidePipeline.test.ts`, describe "AC-W69 (WU-82, D-389…D-396)". Thirteen pins changed,
    each with its assertion.
  - **Words:** 61,727 → 64,393 (+2,666). `checkpoints.md` gains 693 (it holds the interview procedure), `SKILL.md`
    141, and the new `stages/Q.md` is 313.
  - **The doer's choices, to judge:**
    - `SKILL.md`'s line cap goes 221 → 229;
    - R1a-assemble may rename a card on a clash;
    - R1b's header gains `changes`;
    - a breaking change fails R1b with `gate-change`;
    - a dropped gem's reason is a `reason` claim;
    - the seed card's mark sits under Evidence, and researcher `a` gets the reference;
    - held-back reasons are in plain words;
    - the runner checks a test config at start;
    - a refused scripted entry ends the run `stopped`.
  - An independent verifier is running. It also dry-runs four gate visits by reading the text.
- **WU-82 verified: PASS** (an independent verifier).
  - **Gate:** rc 0 (135 suites, 2,435 tests; the `--runInBand` step 3 of 3), build rc 0. The checker exits 0 on all
    five fixtures.
  - **AC-W69 is faithful:** all 14 of its tests fail on `047bb17`'s text. No stale AskUserQuestion, multiple-choice,
    Title or free-line text remains. All nine of the doer's choices are accepted.
  - **The dry-run:** a brainstorm visit with two questions and a two-card combination, a finalize with a revision,
    and a design revise that is really a new card all read unambiguously.
  - **Findings, all sent back to the doer:**
    - **medium:** a scripted entry the deck refuses leaves notes the default `stop` doesn't count, which the checker
      fails. Fix: check the deck rules before the asks;
    - **medium:** the coordinator's question step said to "copy the plan", which breaks its rule against reading
      plans whole. It named no plan, and nothing for the brainstorm gate. The coordinator's ruling:
      - at the brainstorm gate, a researcher's labelled estimate, or verifying the card;
      - at the verification gate, the card's concept plan;
      - at the design and final gates, the run's plan;
      - in every case a measure-only variant of one stage, written as R1b and D1-build write probes;
    - **low:** seven text gaps: the gate-change failure's return, a dropped gem's hand-off to D1-finish, the D1-build
      row's `user-request`, the script's full path, the new-cards-only `pick:` and the refused-entry `default` in
      `run-log.md`, the R1b row, and the design gate's carried words. One rule was also repeated three times.
- **WU-82's fix round** (`3fa8531`). Gate rc 0, build rc 0. The static and script suites pass (744 tests), and the
  checker exits 0 on all five fixtures.
  - **Words:** 64,431, a net +38 for the fixes. Repeated text was cut to pay for them. `SKILL.md` is 230 lines.
  - **The fixes:**
    - M1: a scripted entry's new cards are checked against the deck before any ask;
    - M2: `Q.md` follows the coordinator's ruling;
    - L2: D1-build returns `left out: <gem> on <stages>: <why>` lines, which the runner passes to D1-finish;
    - the object-entry rule is stated once, in `offline-and-test.md`;
    - the other low items as listed.
- **WU-82 merged** (fast-forward, after a rebase). **M-18 built:** WU-80…WU-82 are on `build-guide/amendments`.
  Next: the wave gate, in a fresh worktree `m18`.
- **M-18 wave gate: PASS at `3fa8531`** (an independent verifier, 164K tokens, in the fresh worktree `m18`).
  - **Bootstrap:** clean. `vendor/` is at the pin.
  - **Gate:** `mise run test` rc 0 (135 suites, 2,435 tests; the `--runInBand` step 3 of 3); `pnpm build` rc 0.
  - **Cross-cutting checks:** waivers `[]`; dependencies, `src/server/` and the README unchanged since `eb78489`;
    the checker exits 0 on all five fixtures.
  - **ACs:** AC-P70 and AC-W67…AC-W69 pass, and one per unit was spot-checked as faithful.
  - **Probes through the built code:**
    - a plain summon compiles to `DPS 78 (Skeletal Warrior Minion, minion)`, `measures.dps` = 39.0 × 2;
    - `display brainstorm` prints 8 named cards, each with its five pitch lines, and no id before "For reference";
    - `test-config` accepts the skill's example and refuses five malformed entries.
  - **Seams:** the skill text's formats match the scripts' constants.
  - **Findings, all low:**
    - AC-P70's wording, which changes at the fold;
    - a label R1a-assemble drops still showed on the card as "Unusual";
    - the template wrapped the `Under-played (judgment):` label across two lines;
    - a stale checker comment.

    The coordinator fixed the last three, with the static and script suites (744 tests) passing and the checker at
    0 on all five fixtures.
- **M-18 total:** about 1.97M tokens: the three doers with their fix rounds 1.21M (WU-80 216K, WU-81 476K, WU-82
  518K), the three verifiers 595K, and the wave gate 164K.
- **M-18 merged to `main`, signed.** The 12 integration commits above `eb78489` were re-signed with the same trees
  and metadata (all 12 show good signatures). `main` fast-forwarded to them. The unsigned originals are kept locally
  as `refs/archive/pre-sign-m18-2026-10-18`.
  - **11 cited hashes remapped:** the integration commits exactly; the lane originals to their one main-line copy
    by subject. No line holds two hashes that collapsed into one.
  - **Not pushed.**
  - **Left for the user:** removing the worktrees `amend`, `bg-80`, `bg-81`, `bg-82` and `m18` and the merged
    branches; the classifier blocks worktree removal for the coordinator.

## 2026-10-18: the fix batch and the v1.6 fold (M-19); the skill-split design

- **The user's direction:** run the server fix batch and the skill-split design doc in parallel, and go as far
  through the roadmap as possible while they're away. The coordinator's answer, which the user accepted: the fix
  batch and the fold to v1.6 are built and verified; the skill-split doc and the engine-lens amendment are drafted
  for review; nothing is built from a draft, signed or pushed, and the live run waits for the user.
- **Cleanup done by the user:** worktrees `amend`, `bg-80`, `bg-81` and `bg-82` removed with their branches; `main`
  pushed at `dac3563`. `m18` was moved to `dac3563` and rebuilt for the next live run.
- **Integration:** worktree `int`, branch `roadmap/2026-10-18`, off `main` at `dac3563`. Commits there are unsigned
  while the user is away (the main checkout signs through 1Password); the sign-rebase comes when the user is back.
- **The handoff** gains an M-19 section (`9fd32fa`): lane `bg-83` (D-398, the load warning for supports dropped from
  a tree-granted group, with PG-54; the probe of snapshot timeouts on a heavy minion build, fixed as D-399 only if
  the fix is local) and lane `bg-fold` (the fold to v1.6). HG-12 is granted for D-398's warning only. The probe may
  read one file under the run environment's `reference/`, Navira's PoB, copied to a temp dir and never committed.
- **Dispatched:** both doers, in parallel.
- **The run environment** (`/home/parker/projects/pob2-mcp-runs/m16-varashta/`) now points at `m18`: `start.sh`,
  `mcp/pob2-main.sh` (its variable is now `RUN_WT`) and the README. `m18` has no `.env`; copying one in is the
  user's call, as it was for `m16`.
- **The skill-split design** (`docs/design/2026-10-18-skill-split.md`), DRAFT for the user's review. Seven pieces:
  the user's five (discovery, research, review, compile, writer) plus game knowledge as the base and pricing.
  `/build-guide` stays as the sum of the pieces; the run folder's files are the interfaces. Extraction order: game
  knowledge (with the engine-lens amendment), review, compile and writer with a PoB-to-plan tool, pricing, then
  discovery and research. §6 lists four choices.
- **Amendment 8, finding the build's engine** (`spec/amendment-8-engine-lens.md`), DRAFT for the user's review.
  D-400…D-409 (D-398 and D-399 are the fix batch's): a poe2db league digest (D-400); one index of rule-changing nodes,
  keystones, gems and uniques with precomputed pairs (D-401); rare monster modifiers and the tamed beast (D-402); the
  obvious build always in the deck, from new standard kits (D-403); the supply search by family, following strange
  words (D-404); at most half the deck on one engine (D-405); a structure check on paper before each skeleton (D-406);
  clear speed measured on skeletons and leading every display, with a stated override of PoB's ranking (D-407); a
  rival card with fresh context before the verification gate (D-408); the library's new entries (D-409). Work units
  WU-84…WU-91 (no WU-83: that number is only the fix batch's lane name). §15 lists five choices.
- **The two drafts' independent review** (260K tokens): 2 blockers, 21 should-fix, 15 nits, all resolved in the
  drafts the same day.
  - **Blockers:** the rival read figures from R1b's verdict files, which hold none (it now reads the dossier, the
    verified cards' comparison table, and never their cards or research); and a card resting on new content could
    never pass the sniff test (the digest's and the monster table's text now confirm a link; a card the pin can't
    compile is dealt as "can't be finalized yet").
  - **The main should-fixes:** the rival sits outside D-287's cap of 3 R1b steps per verification round, once per
    run; the engine is copied onto each deck line, and D-405's rule yields to the 6-card minimum and to the user's
    note; levers and overrides travel as D1-build return lines that D1-finish writes as `reason` claims (a plan has
    no notes field); the facts go in `data/` (`league/`, `rules/`, `monsters/`), which settles where they live for
    both drafts; the index leaves out legacy and unobtainable items; the seed card moves to researcher `b`; the
    HG-12 grants and the seven poe2db requests are asked for explicitly; the acceptance criteria are written at
    amendment 7's level, with "Where the inputs went" and "What changes" tables. The amendment's choices drop from 5
    to 4, the split's from 4 to 3.
- **The re-check** (315K tokens in all for the reviewer): 22 of 23 resolved, 1 partly, 6 new should-fix findings and
  some nits, all fixed. The digest's text now amends D-287's sniff test explicitly, cited `data |
  league/<slug>.md#<entry-id>`, which the run checker learns to resolve (it reads only JSON `facts` files today); a
  picked card that waits on the pin compiles nothing (`not-in-pin`), like a damage source that isn't a skill; D-405
  rounds half down (4 of 8 or 9) and matches engines by the index's vocabulary; "A count as a multiplier" is a new
  entry beside "Filler to satisfy a count", and every new library entry awaits the user's review (D-290); the pattern
  library is still read first; an on-request rival is stage `RV`, not a gate question.
- **The v1.6 fold, done by its doer** (`23e9d5c` on `bg/fold-v16`, 5 commits; 728K tokens): 5 files, +1919/−510;
  the static tests pass, 384 of 384, with no pinned text changed. It folds D-363…D-397, amendments 5–7, M-16…M-18
  with their wave gates, risks R-43…R-47 and every work-log fold note; AC-P70 reads `(Skeletal Warrior Minion,
  minion)`. Where an amendment and the build differ, the as-built text is folded and the difference stated (twelve
  places). **Left open for the user:** the defect batch's tool changes (D-383, D-384, D-387, D-388) have no recorded
  HG-12 grant, so the spine lists them as pending the user's confirmation. D-398 and D-399 wait for the fix batch's
  merge. An independent reviewer is running.
- **The fix batch, done by its doer** (`9b581b9` on `bg/fix-batch`, 3 commits; 298K tokens). Gate: test rc 0 (137
  suites, 2,446 tests, plus the timing step; one AC-F3 tooling false-failure at load average 8.6, passing alone and
  on the re-run), build rc 0.
  - **D-398** (`4b047c5`): every load path names, one line per group, the supports PoB drops from a granted group:
    file load and reload, import, the session's reload after a change on disk, and the temporary loads of
    `analyze_build` and `compare_builds`. The engine's `load_build_xml` replies `droppedSupports`. It covers
    item-granted groups too (Navira's sceptre loses its Purity of Ice supports the same way); on the probe copy it
    named Kelari, Navira and the sceptre. **PG-54** (`21b3fac`).
  - **D-399, the snapshot timeouts** (`9b581b9`). Not the minions: PoB's save re-parses every item, and one rare
    Runeforged item's unread "Runic Ward:" line before a socketed rune made its text read back different, so every
    snapshot gave it one more socket and rune and its parse grew slower (the Items saver: 0.02 s, 0.16 s, 2.0 s,
    12.7 s, then minutes; the engine reached 1 GB). The export now builds each item's text without re-parsing it.
    On the probe copy the same eight switches and changes took 0.04–0.24 s each. Tests fail before the fix.
  - **A consequence for the comparison:** Navira figures measured after changes in a session may hold extra rune
    bonuses. A caveat is added to the comparison study's §8. Re-measuring would settle it.
  - **PG-55** goes to the unread "Runic Ward:" line (the coordinator adds it at the merge), so amendment 8's gap
    entry for rare monster modifiers becomes PG-56.
  - An independent verifier is running, including a check that the export writes the same document as before for
    builds without such an item, since saves into the builds folder go through it.
- **The fold's review: FAIL on 3 should-fix findings, no blocker, 5 nits** (468K tokens). Every row D-363…D-397
  was checked; the amendments are unedited and no proposal is folded. The should-fixes: D-390's as-built text put a
  coordinator question step at the brainstorm gate, which the built skill forbids; six rows that v1.6 decisions
  change lacked their "amended by" marks (D-267, D-372, D-312, D-249, D-213, C-33's headline sentence); slice 02's
  open-items list still held two settled items. Fix round sent to the doer.
- **The fold's fix round** (`fe65953`, the doer's 746K total) fixed all 8 findings; the reviewer's re-check
  **PASS** (496K in all for the reviewer). The coordinator aligned D-373's rounding with the build (`6d70767`: whole
  divines at 10 or more, as `roundDivines` does). **Spec v1.6 merged** into `roadmap/2026-10-18` (fast-forward,
  7 commits); static tests 384 of 384. Open for the user: HG-12 for the defect batch's tool changes (D-383, D-384,
  D-387, D-388). D-398 and D-399 join the spine after the fix batch merges.
- **The fix batch verified: PASS** (184K tokens), four low findings. Gate rc 0 (137 suites, 2,446 tests), build
  rc 0, no timing failure. Both D-399 tests fail on the old export; 5 of 6 D-398 engine tests fail without the
  warning (the sixth is the golden build, which drops nothing). **Saves are unchanged by D-399:** the golden, low-str
  and granted-supports builds, saved twice, changed and saved again, come out canonically identical before and after
  the fix, figures included; the Runic Ward gloves grew to six sockets before it and stay at one after.
  - **Recorded, no code change (low 2):** for a file PoB didn't write itself, whose ModRange values don't match its
    item text, a save now keeps the stored range value (a test copy of the golden build kept `0.123456` where the old
    export wrote `0.5`); every figure was identical.
  - **Fix round sent** for lows 1, 3 and 4: name the file on a temporary load's warning lines; neutral examples in the
    unit test; an engine test for an item-granted group, and no false "dropped" line when no group matches the
    grant.
- **The fix batch's fix round** (`6221fff` after the rebase; the doer's 331K total, 3 commits plus 1): a temporary
  load's lines name their file; neutral examples in the unit test; an engine test for an item-granted group; a group
  nothing grants (its passive unallocated, its item unequipped) gets a truthful line ("…isn't allocated, so PoB
  removed the group") and an optional `grantMissing` in the engine reply. The coordinator read the code diff.
- **Merged** into `roadmap/2026-10-18` (fast-forward; `4b047c5` D-398, `21b3fac` PG-54, `9b581b9` D-399, `6221fff`).
  The spine gains D-398 and D-399 (`f2880dc`), and R-47 is resolved by D-399. **PG-55** (the unread "Runic Ward:"
  line) is added. PG-51's fold note (where PoB's own group lands, D-382) was already in its text.
- **M-19 wave gate: PASS** at `0b9cecc`, from a clean build: `mise run test` rc 0 (137 suites, 2,449 tests; the
  `--runInBand` step 3 of 3), `pnpm build` rc 0. The "restoring the snapshot failed" lines in the log are the
  session tests that inject that failure.
- **The pin** (the user, 2026-10-18: pin to the PoB they run on Windows, 0.23.1): already so. `pob-pin.json` names
  tag `v0.23.1` (`7d6f530`), and the vendor checkout describes as `v0.23.1`.
- **M-19's agents:** about 2.07M tokens: the fold doer 746K and its reviewer 496K, the fix batch's doer 331K and
  verifier 184K, the drafts' reviewer 315K. The coordinator's own session is on top.
- **M-19 merged to `main`, signed** (with the user present). The 25 integration commits above `dac3563` were
  re-signed with the same trees and metadata (all 25 show good signatures; the tip's tree is identical), and `main`
  fast-forwarded to them. The unsigned originals are kept locally as `refs/archive/pre-sign-m19-2026-10-18`.
  - **15 cited hashes remapped** in this log: the integration commits exactly, the lane originals to their main-line
    copy by subject. No line holds two hashes that collapsed into one.
  - **Not pushed.**
  - **Left for the user:** removing the worktrees `int`, `bg-83` and `bg-fold` and the branches
    `roadmap/2026-10-18`, `bg/fix-batch` and `bg/fold-v16` (the classifier blocks worktree removal for the
    coordinator); reconnecting the pob2 server after `build/` is rebuilt.

## 2026-10-18: the user's rulings on the fold, the skill split and amendment 8

- **The defect batch's tool changes confirmed** ("I approve the sign off on the changes in the fold"): D-383's and
  D-384's refusals and left-out lists, D-387's emotion prices and D-388's ranker field. The spine's HG-12 row and its
  §3 note say so.
- **The skill-split design accepted** ("I accept the suggestions in the skill split doc"), with each §6
  recommendation: game knowledge first, right after amendment 8 is built; the PoB-to-plan tool designed in the
  compile-and-writer extraction; the plugin after two extractions.
- **Amendment 8: choices 1, 3 and 4 accepted** (the rival every run; the structure check in R1b; the index written
  once per pin). **Choice 2, the beast library, held:** the user asked what "the table, the library entry and the gap
  entry carry the miss" means. The HG-12 grants and the poe2db requests are still open.
- **Found while answering:** a tamed beast reserves a share of the player's Spirit. PoB reads it from each monster's
  `companionReservation` (`Modules/CalcDefence.lua:204`): from 13.8% to 56.1% across the 619 monsters in
  `Data/Spectres.lua`, 32.7% at the median. Without the beast library a plan can't carry that reservation, so a
  minion build's spare Spirit, and with it the number of minion types, reads high.

## 2026-10-18: amendment 8 approved; the M-20 build starts

- **The user's ruling:** "Build the beast library, and approve the grants and requests." Choice 2 takes the
  alternative (WU-87 is built); HG-12 is granted for D-407's record fields and D-402's `companion` field; the poe2db
  requests are approved. Amendment 8's status is APPROVED.
- **The user's two points on tamed beasts, added to D-402:** most kept modifiers change stats (Haste: movement and
  attack speed for allies, usually the one players want most), and a tamed beast reserves a percentage of Spirit
  where most minions reserve a flat amount, which changes the arithmetic of stacking Spirit. A plan now names the
  beast's kept modifiers, and each table row says how a plan models it: `stats` (custom modifiers, estimates),
  `condition` (a config entry) or `none`.
- **The monster-modifier probe** (3 requests to poe2db, serial, the server's User-Agent, no cookie):
  - `Modifiers`, the hub, which links `Monster_Modifiers` and `Tame_Beast`;
  - `Monster_Modifiers`: 268 modifiers with their stat lines ("Hasted": 30% increased Movement Speed and Attack and
    Cast Speed; Haste Aura; Trail of Ice);
  - `Tame_Beast`: 178 modifiers under its own heading, taken to be the ones a tamed beast keeps, and 295 beasts.
- **The first digest needs no request:** the league pages saved by the morning's probe are kept, with the two new
  pages, in `/home/parker/projects/pob2-mcp-wt/poe2db-cache/` (outside the repository), and the digest script reads
  them with `--from`.
- **The shared vocabulary** `data/rules/vocabulary.md` is written by the coordinator before the build (about 70
  families), since the index, the monster table and the deck's engine field all use it. The amendment's example
  tag `glove-modifiers` becomes the vocabulary's `item-modifiers`.
- **The handoff** gains an M-20 section: waves, owners, serialized files, the entry-id format for Markdown data
  files (`### <Name>` then `- Id: <id>`), HG-12 for WU-87 and WU-88 only, and no network for any build agent.
- **The estimate:** about 4.5–5.5M tokens for the eight units, their verifiers and the wave gate (M-18's three
  units took 1.97M), the index's content pass the largest single part.
- **M-20 wave 1 dispatched:** WU-84 (`bg-84`), WU-85 (`bg-85`), WU-86 (`bg-86`) and WU-88 (`bg-88`), each off the
  integration head `f1eaaa7` (worktree `m20`, branch `build-guide/m20`). Commits here are unsigned until the
  sign-rebase.
- **WU-88 done by its doer** (`41500ad`, 235K tokens). Gate rc 0 (139 suites, 2,463 tests), build rc 0. A skeleton's
  record (any endgame stage without a variant) gains `measures {clearSpeed, movementSpeed}`; variant stages gain
  `movementSpeed`. It is PoB's `EffectiveMovementSpeedMod`, a multiplier (1.25 = +25%). `clearSpeed.noArea` marks a
  clear skill with no radius (a Skeletal Warrior's strike). The key-figure line is unchanged, since its text is part
  of the contract. **For WU-89:** print the record's `speed` with the no-area flag, not the band (an on-death step
  can make `speed` medium while the band is slow); `render-audit.mjs` still reads movement speed from `outputs`.
  The verifier is running.
- **WU-86 done by its doer** (`618e06f`, 311K tokens). Gate rc 0 (139 suites, 2,472 tests), build rc 0. The table
  holds 97 modifiers, one per name (75 unnamed rows left out): 25 `stats`, 13 `condition`, 59 `none`. All 97 are
  keepable: poe2db's Tame Beast list holds every named modifier, so it doesn't pick out a subset, and the table's
  head says so. "Trail of Ice" is the only ice trail and links the Chilled Ground keyword, so the row takes it to be
  the guide's "Frozen Ground Trail", as an inference. The judgments live in a map in the script, so a new modifier
  without one fails the run. **For WU-87:** no PoB line reaches only the companion (`Minions have …` reaches every
  minion); PoB has no option for an enemy on Ignited Ground, so fire rows use the Ignited option.
- **The ally auras' figures:** the saved pages gave no lines for them, so the coordinator spent the four remaining
  approved requests on their keyword pages (serial, the server's User-Agent): Haste Aura grants 20% increased Attack
  and Cast Speed and 10% increased Movement Speed; Extra Physical Damage Aura 40% increased Physical Damage; Energy
  Shield Aura 20% of maximum Life as added Energy Shield; Elemental Resistance Aura +35% to all Elemental
  Resistances; each to allies within 5 metres. All seven approved requests are used. A fix round sends them to
  WU-86. `none` joins the vocabulary as the empty value (WU-86's proposal).
- **WU-88 verified: FAIL on one blocker** (154K tokens). Gate, AC-P71 (4 of 5 engine tests fail on the old code),
  waivers and ownership pass; the grant is kept (only `measures` changed). The blocker: a skeleton never got D-353's
  on-death step, because `compiler.ts:893` fetched gem texts only for variant stages (a Contagion skeleton read slow,
  its budget rung medium). Fix round sent, with a skeleton-against-rung test. **For WU-89:** with no clear skill
  measured, don't print "PoB gives no area"; update `run-log.mjs:701-702` and the comment at
  `buildGuideScripts.test.ts:555`.
- **WU-84 done by its doer** (`a45d3f4`). Gate rc 0 (138 suites, 2,462 tests), build rc 0. `league-digest.mjs`
  with `--from`, `--reflag`, `--save`; the fetch path is tested on a stubbed `fetch` (order, 3 s spacing, the
  User-Agent, no cookie, one retry after 60 s). **The first digest,** `data/league/runes-of-aldur.md`: 324 entries,
  303 in the pin (57 gems, all in the pin; 46 uniques, 44; 163 socketables; 54 other items, 35; 2 ascendancies; 2
  passives); 86 currency entries left out; `powered-by-verisium` is there. In-pin names are checked against the
  tree's JSON for ascendancies and passives, and `Data/Bases` with `ModRunes.lua` for items. **Ruling:** socketables
  stay in the body but leave the head (one count line, plus any that change a rule), since the head with them is
  about 5,100 words, twice the estimate, and every researcher reads it whole. Sent back to the doer before
  verification.
- **WU-88's fix round** (`0089306`): skeletons take the on-death step (the gem texts are fetched for every measured
  stage), with a Contagion skeleton-against-rung engine test that fails on the old filter; "every measured stage's
  movement speed". The doer's full gate failed only AC-T22 on time under load (21 s), passing alone. The verifier
  re-checks.
- **WU-86's fix round** (`379062e`): a modifier's own keyword page, when saved, gives its figures. Haste Aura: 20%
  increased Attack Speed, 20% increased Cast Speed, 10% increased Movement Speed; Extra Physical Damage Aura: 40%
  increased Physical Damage; Energy Shield Aura: "Gain 20% of maximum Life as Extra maximum Energy Shield" (PoB's
  wording); Elemental Resistance Aura: +35% to all Elemental Resistances; each to allies within 5 metres. Gate rc 0
  (2,478 tests). **Declined:** a `damage` family (WU-86's proposal). A generic damage increase fits every build and
  would pair with nearly everything in `pairs.md`; the join is for mechanics, so such rows create `none`. The
  verifier is running.
- **WU-88 verified: PASS** on the re-check (the fix round's targeted suites, 24 tests; the new test fails on the old
  filter); the verifier's total 161K. **Merged** into `build-guide/m20` (fast-forward).
- **WU-89 dispatched** (`bg-89`, off `7d8799e`, with WU-88 merged). It may also change the dossier template's
  column line (the checker's column list must match it) and writes its formats to a new
  `studies/2026-10-18-wu89-formats.md`, for WU-91, as WU-81 did for WU-82.
- **WU-84's ruling done** (`68a00f9`): the digest's head is 206 lines and 3,165 words (was 324 and about 5,100): the
  socketables' count line, then 44 socketables the doer judges rule changers (18 Legacy runes), each with a reason.
  The judgments are a committed file, `data/league/runes-of-aldur.rule-changers.json`. The doer's gate failed only
  AC-T22 on time at load 17, passing alone. The verifier samples the judgments.
- **WU-85 done by its doer** (`7be99fa`, 9 commits). Gate rc 0 (139 suites, 2,474 tests), build rc 0. `nodes.md`:
  241 lines (208 notables, 33 keystones; Devotion to the King is in `tree.json` but not in the tree PoB loads), 125
  `[rule]` (95 notables, 30 keystones); 252 unique blocks; 72 gem blocks of 173 candidates; `pairs.md` 235 lines in 45
  family blocks. 59 doubtful entries were left out of `[rule]`. `candidates` drives the pinned PoB with luajit to
  reuse the server's legacy and unobtainable tests. **Note:** `pairs.md` has no `infusion` block: three entries
  create infusions (Powered by Verisium among them), but the skills that consume them aren't rule changers, so
  nothing pays off on them in the index. D-404's supply search must therefore Grep `creates:` across the index's
  files, the monster table and the digest, not only `pairs.md` (for WU-91).
- **Vocabulary, eight families added** (WU-85's proposals, for its 64 rule changers tagged `none`): `ammunition`,
  `stacking-buff`, `accuracy`, `luck`, `thorns`, `attribute`, `passive-tree`, `support-gem`. A retag round goes to
  the doer before verification. **For WU-89:** `pairs.md` cites nodes as `rules/nodes.md#<node id>`, and node entries
  are lines, so the resolver must find the line whose parenthesis starts with that id.
- **WU-89 told** the node-line citation form (`rules/nodes.md#<node id>` resolves to the line whose parenthesis starts
  with that id).
- **WU-86 verified: PASS** with 2 should-fix findings (219K tokens). Gate pass (AC-T22 and AC-P37's lever case failed
  on time at load 24, passing alone); the script run on the saved pages reproduces the committed table; 31 rows read
  by hand, every config option exists and every `stats` line but one parses. Should-fix: poe2db's Tame Beast list
  is the whole modifier table with duplicates dropped, so "every modifier keepable" is an inference and the head must
  say so; and PoB does parse `Companions have …` lines (`ModParser.lua:1272-1273`), so a modifier on the beast itself
  can be modelled, for WU-87 too. A short fix round with the lows went to the doer.
- **WU-85's retag** (`91b438b`, rebased onto `ea7485b`): 34 of the 64 entries tagged `none` now carry a family (9
  nodes, 20 uniques, 5 gems); 30 stay `none` (Witchbane, Heartstopper, the wall and grenade supports among them).
  `pairs.md`: 237 pair lines in 47 family blocks (`thorns` and `support-gem` are new). Gate rc 0 (141 suites, 2,489
  tests). The verifier is running, with a content sample of at least 25 `[rule]` entries.
- **The coordinator's session crashed** (the terminal pane), stopping four agents: WU-86's fix round (its commit
  `d907df9` had landed), WU-89 (nothing committed; its lane was clean at `7d8799e`), and the WU-84 and WU-85
  verifiers. No stray test or engine process was left. All four were resumed from their saved transcripts; WU-89 was
  told to commit as it goes.
- **WU-84 verified: FAIL on one blocker.** All five gate checks pass (rebuilding from the saved pages gives a
  byte-identical digest; all 324 in-pin flags agree with an independent check; 41 of the 44 socketable judgments
  hold). The blocker: a uniques fixture entry (Berek's Grip) matches the saved page exactly apart from its hover
  attributes, against the rule that no saved page or slice of one is committed; the other entries are lightly edited
  copies. Should-fix: a repeated-line filter cut Mageblood's four lines to one; most unique head lines quote the
  base's implicit line. A fix round went to the doer with the lows (two reasons, the criterion for socketables, a
  redirect off poe2db.tw refused, stable ids across kinds). The head's 27% overshoot is accepted.
- **A second crash, and its cause** (the user: "Running the tests is crashing the session. They peg my 16 core Ryzen 9
  9950X3D at 100% … I couldn't even type in the session input before it crashed"). Several lanes ran the full gate
  at once, each with Jest's default of threads − 1 = 31 workers, each able to start a PoB engine, all at normal
  priority. Memory was fine (2 of 47 GB used). **The fix** (`e2731bc`): `jest.config.cjs` caps a full run at
  `maxWorkers: '50%'`; the handoff's M-20 section adds "Running tests": every test call at `nice -n 19`, a full gate
  under one shared `flock` lock so only one runs at a time, started in the background; targeted suites at
  `--maxWorkers=4`. The four stopped agents (WU-84's fix round, WU-86's gate, WU-89, the WU-85 verifier) were resumed
  under the rule.
