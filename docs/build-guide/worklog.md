# Build-guide epic: work-log

The coordinator's record of the build: verdicts, merges, gate evidence, decisions and friction. Written
only in the integration worktree (`/home/parker/projects/pob2-mcp-wt/guide`, branch `build-guide/build`).

## 2026-10-08: build start

- **Spec:** `docs/build-guide/spec/` at `b34db2a`. The user approved implementation on 2026-10-08 and
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

### Baseline gate at `eaf2075`

- Bootstrap rc=0; `mise run test` rc=1 (1 failed of 1041, 116 s); `pnpm build` rc=0.
- The one failure: stab AC-G2 (`tests/static/readme.test.ts`) asserted `docs/` holds only
  `stabilization/`, which this epic's `docs/design/` and `docs/build-guide/` broke. **Coordinator
  decision:** the assertion now lists the epic folders (`build-guide`, `design`, `stabilization`); the
  stale-file list it exists for is unchanged. The test passes after the change.

## 2026-10-08: wave 1 (WU-30, WU-31, WU-33, WU-37, WU-38, WU-40, WU-49)

All seven started off `83ae021` in parallel lanes. Each had one doer, then a read-only reviewer
(WU-37 with WU-49, WU-30 with WU-40), then fixes by the same doer.

### Verdicts

- **WU-49** (dated trade outputs, `[trade:<kind>]` errors): done `dbadd71`; review clean.
- **WU-37** (guides-folder root): done `284bdf9`; review: 1 low (`createRunFolder` accepted an invalid
  date and created `0NaN-NaN-NaN-1`), fixed `674abcc` (an invalid date or a year outside `YYYY` is
  refused before any `mkdir`).
- **WU-33** (per-skill breakdown, skill-part fix): done `a0736fb`; review: 2 low (a hidden effect with
  an empty PoB name rendered a nameless heading; a missing-group error said "nil"), fixed `cb6ed6a`,
  which also stabilized a flaky attribute-order check. All six deviations accepted, among them an
  additive `statSet` field in `set_main_selection`'s reply (slice 01 §2.1 said "unchanged"; fold in)
  and a group-exists check before mutating, which fixes a pre-existing C-3 violation.
- **WU-38** (plan schema, reference, ledger): done `70dcfab`; review PASS with 2 low (export an
  extendable source-tag schema for WU-39's data files; copy §3.3's WORD/NUMBER/REF lines verbatim into
  the reference), fixed `47316d9`. Fixture: Warrior/Titan, Boneshatter rolled, checked in the engine.
- **WU-31** (`lookup_game_data`, `search_tree_nodes` ascendancy filter): done `e0c6e36`; review: 1 medium
  (unique and mechanic modes searched only each unique's selected variant, so alternative rolls such as
  Prism of Belief's "+(1-3) to Level of all Blood Hunt Skills" were invisible) and 3 low (`gem_level`
  failed the whole call when one result lacked the level; AC-K5's exact-name-first rule was untested;
  "gem level 1" format). Fixed `dec0950`, with three coordinator decisions (below). The fix commit was
  not re-reviewed; the wave gate checks it.
- **WU-30** (compile-time spike): done `acdc42f`; review PASS, 1 low (the rebuild-deferral claim covered
  only the saved file), fixed `247a08a`. **D-229 holds; HG-13 does not fire:** slowest stage request
  3.10 s, whole 15-stage compiles 25.8–33.6 s (≤ 7.13 s and ≤ 48.3 s under fleet load). A sensitivity
  run with every skill group in PoB's Full DPS mode, under load, took 160.68 s with a 25.50 s stage;
  the plan schema can't request Full DPS, so the coordinator ruled the gate met for the specified
  plan and imposed requirements on WU-41 (below). The user is told.
- **WU-40** (`encode_build_code`): done `7af4453`; review PASS, no findings (encoding checked against
  PoB2's `ImportTab.lua`); rebased and reconciled with WU-31 as `1ed4178`.

### Merges (integration `build-guide/build`)

`674abcc` (WU-37) → `ce62a95` (WU-49) → `cd605e5` (WU-38) → `1a431a9` (WU-33) → `9baaef7` (WU-31, full
gate re-run by the coordinator on the rebased lane: rc 0, 102 suites, 1254 tests) → `247a08a` (WU-30) →
`fbfd85d` (WU-40). Tools: 79, 78 without poe.ninja.

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

### Wave gate: PASS at `fbfd85d`

An independent verifier ran from a clean tree (build, coverage and the Jest cache cleared):
- `mise run test` rc=0, 103 of 103 suites and 1266 of 1266 tests, none skipped, 147 s;
- `pnpm build` rc=0;
- `scripts/fresh-clone-check.sh` rc=0: 79 tools (78 without poe.ninja) and Life 2,977.

Cross-cutting checks: AC-B1 (79/78, disposition set equal, README table equal to `pnpm docs:tools`),
AC-B2 (waivers `[]`), AC-B4, AC-B5 (golden files unchanged since `b34db2a`), and AC-B7 (dependencies
byte-identical to `b34db2a`) hold. No touches violations. Per-unit AC fidelity holds, with two low
notes on the unreviewed WU-31 fix commit:
- D-239's 5-matched-lines cap per unique and its "(and N more matching lines)" note have no test. It is
  assigned to WU-32, which also extends the lookup code.
- D-241's test rebuilds its expected lines the way the code does. **D-241 wording, as folded:** values
  come from PoB's calculation merge of the effect's level and the stat set's level
  (`CalcActiveSkill.lua:792-797`). The lines use the gem header's "of base" wording, so they differ
  slightly from PoB's per-stat-set tooltip (`GemTooltip.lua:217-221`).
