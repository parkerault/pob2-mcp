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

The doer stopped on a handoff stop condition: the terms forbid this use. Its report is `793ed26` on
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

**The pinned criteria** (`b06c72c`): AC-K53 (energy-based meta gems), AC-K54 (skills granted by a support),
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

- **WU-51** (`6bd9591`): done. The decision line reads "Within NFR-21: the final compile computes Full DPS
  for the named source's groups."
  - Three quiet runs at a 1-minute load average ≤ 8: whole call 26.22–27.77 s with Full DPS off, and
    29.93–31.92 s with it on for the named groups (median ×1.14). Slowest stage 3.08 s.
  - With every group in Full DPS, through the real compiler: 61–67 s, slowest stage 6.17 s. R-32's
    160.68 s came from WU-30's emulation under load.
- **WU-60** (`e3d4113`): done; gate rc=0/0 (1850 tests).
  - Essences are a fifth mechanic kind, `essence`, which touches the tool's `kind` enum, its README row
    and `tool-calls.json`.
  - "Can roll" means `GetModSpawnWeight` > 0, restricted to bases that use the mod's own affix table.
- **WU-61** (`9657f93`): done; gate rc=0/0 (1851 tests).
  - `schemaVersion` 2. A version-1 plan is held to version 1's shape. `VERSION_ADDITIONS` is the list
    WU-55 extends.
  - The two-stage fixture and the worked example now declare version 2.
  - The ladder goes by rung, `m` → `b` → `n`, whatever the plan order. No fixture verdict moved.
- **WU-56** (`29c20f1`): done. Static tests 210 of 210.
  - `patterns.md` is 5,589 words: 60 entries in ten families.
  - An `AWAITING_SKILL_WIRING` entry exempts `patterns.md` from AC-W1 until WU-57 lists it in `SKILL.md`.
- **WU-50** (`793ed26`): blocked by the terms; resolved by D-335.

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
