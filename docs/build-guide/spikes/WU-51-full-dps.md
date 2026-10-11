# WU-51: Full DPS compile cost with only the named groups (S-N2)

Date 2026-10-10. Pin PathOfBuilding-PoE2 `v0.23.1` (commit `7d6f530`). Lane head `acec4d1`. Evidence labels:
- **[V]** = measured here, or read in the source. A measured [V] figure is in a table that `summarize.mjs`
  (appendix) prints from the probe's results files, or follows from such a table by arithmetic.
- **[V, not retained]** = measured here, but read from the probe's raw output with an ad-hoc query that isn't
  in the appendix. That raw output (`results.json`, `all.json` and the logs, in the `mktemp -d` directory)
  wasn't kept. So the figure can't be checked again without a new run.
- **[I]** = inference.

**Decision: within NFR-21, so the final compile computes Full DPS for the named source's groups.** The
measurement put `includeInFullDPS` on for each stage's `rolledGroup` only. In the three quiet runs, the slowest
stage request took 3.08 s. NFR-21's limit is under 20 s per stage request. The slowest whole call took
31.92 s, against NFR-20's limit of 100 s for fifteen stages. Two runs were made under heavy load from other
lanes, with the 1-minute load average reaching 26. They still stayed at 9.22 s per stage and 71.18 s per
call [V, not retained]. So the compiler sets the flag when it creates the named groups, and PoB computes Full
DPS during the final compile. The flags are not left to be written at export only (§3.6 step 9, D-293).
The coordinator has ruled that measure-only compiles compute Full DPS for the named groups too (D-337).

## The question

- **D-293** says the delivered file sets `groupCount` and `includeInFullDPS` on the named source's groups
  only. A reader who opens the file then sees Full DPS with the plan's Count. WU-51 (S-N2) decides how that
  happens:
  - within NFR-21, the final compile computes Full DPS for those groups;
  - otherwise the flags are written at export only, and PoB computes nothing for them during the compile.
- **NFR-21**: every per-stage engine request finishes in under 20 s, a third below the bridge's 30 s request
  timeout (D-229). **NFR-20**: a fifteen-stage plan compiles in at most 100 s, in one call.
- **D-306** describes the compiler as built: every socket group is created with `includeInFullDPS` off
  (`pob-api/API/Compile.lua:632`). PoB's per-call output rebuilds are deferred, so a stage rebuilds a fixed
  number of times.
- **R-32** is the risk that PoB's Full DPS mode breaks those limits. Its basis is WU-30's sensitivity run with
  every group in Full DPS: 160.68 s, with one stage at 25.50 s. That run used WU-30's emulation of the
  compiler, before WU-41 existed. The emulation made 87–91 rebuilds per stage, with none deferred, and the
  run was made while the load rose from 5.3 to 23.6.
- **D-329**: the measurement uses the fifteen-stage fixture, `tests/fixtures/plans/fifteen-stage/plan.json`.
  Its 15 stages run from level 2 to level 90, with no set sharing. Each stage has six socket groups of six
  gems, all 18 item slots and up to 4 tree jewels. Every stage's `rolledGroup` is group 1, which holds Rolling
  Slam, the roll's skill.

## Machine

| | |
|---|---|
| CPU | AMD Ryzen 9 9950X3D, 16 cores / 32 threads |
| RAM | 47 GiB visible to WSL |
| OS | Ubuntu 24.04.4 LTS on WSL2, kernel 6.6.87.2-microsoft-standard-WSL2 |
| Runtimes | Node v24.16.0; LuaJIT 2.1.1784580905 (mise) |
| Other load | Other build lanes ran Jest suites with their own engines during the session. Each compile records `uptime`'s three load averages at its start and its end. |

## Pin

`pob-pin.json`: repo `PathOfBuildingCommunity/PathOfBuilding-PoE2`, tag `v0.23.1`, commit
`7d6f530cbdab20389ff8bc6ba97a37ac27f74e41`, version `0.23.1`, `headlessWrapperSha1`
`77a3e3a9b7387ebc57ef0a35bb17c382282e3c7c`. The vendor checkout is clean at that commit.

## Method

- **The real compiler.** Each measured compile is `compile_plan` in final mode on the fifteen-stage fixture.
  It goes through the in-process server (`startSessionFixture`, test actions on), as AC-P37's test
  (`tests/integration/compilePlanNfr.test.ts`) runs it:
  - a fresh server and engine for every compile;
  - one `lua_get_build_info` call to start the engine;
  - `guide_run {new_run}` to make the run folder, with the fixture copied in;
  - then the timed call.

  The probe is a Jest file in a `mktemp -d` directory, with a Jest config whose `roots` point there. It reuses
  the repo's ts-jest transform and C-18 global setup, so cookies are scrubbed and `fetch` is disabled. It runs
  from that directory, with `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY` in temp dirs. Nothing
  under `src/`, `pob-api/` or `tests/` was changed.
- **Setting the flag.** The plan schema can't ask for Full DPS yet; WU-55 adds that. Before each compile, one
  untimed `__test_eval` installs probe-only Lua wrappers in that engine:
  - **`BuildOps.create_socket_group`.** While a stage is compiled, the group about to become the stage's
    `rolledGroup` is created with `includeInFullDPS` on. That happens before any calculation of the stage.
    `build_skills` reaches the wrapper because it calls `BuildOps.create_socket_group` through the module table
    (`Compile.lua:631-633`).
  - **The `compile_stage` handler.** The handler sits in the dispatch table, which `Server.lua` reads on every
    request. The wrapper records, per stage:
    - the Lua CPU time of the whole request (`os.clock`);
    - the calcs tab's full output rebuilds (count and CPU);
    - PoB's `calcs.calcFullDPS` calls (count and CPU);
    - which groups of the stage's skill set are in Full DPS once the request is done.

  Both variants run with the same wrappers. The only difference is the target table: the stage's
  `rolledGroup` ("named"), or nothing ("off").
- **What the probe asserts, and what was only observed.** The probe asserts one thing: no compile returned
  `isError` (`expect(compiles.every((c) => !c.error))`). Nothing else fails a run. The checks below were
  observed in its output, not asserted:
  - In every named compile, the saved file had 15 of its 90 groups in Full DPS. In every off compile it had
    none. `summarize.mjs` prints these counts in the whole-call table. [V]
  - In every named compile, the Lua side reported group `[1]` in Full DPS on every stage. `summarize.mjs`
    prints this in the Lua CPU table. [V]
  - The record listed 15 stages. [V, not retained]
  - The groups in Full DPS were the `Stage <n> Rolling Slam` groups. Their labels were printed only for a
    one-pair trial run made before the measured set to check the probe, and only for its first three
    stages. That run isn't part of the results. [V, not retained]
  - Every off compile's stages reported `[]` from the Lua side. This was printed only for three stages of
    the same trial run. [V, not retained]
- **Timing.** The whole call is timed with `performance.now()` around the `callTool`. It includes the
  session's snapshot export after the call. Per-stage times are the record's `stages.*.elapsedMs`: the
  compiler's own `performance.now()` around each `compile_stage` request. The bridge's request timeout was
  raised to 120 s (`POB_TIMEOUT_MS`), so a slow stage would be recorded rather than cut at 30 s. No stage came
  near 30 s.
- **Runs and load.**
  - The compiles run in pairs, one "off" and one "named", and the order alternates from pair to pair.
  - Each pair starts only once the 1-minute load average is at most 8.
  - A compile counts as quiet when the 1-minute load at its start and at its end are both at most 8.
  - A pair counts as measured only when both of its compiles are quiet.
  - The probe ran pairs until three were quiet. That took five pairs: pairs 1 and 4 were hit by load. All ten
    compiles are listed under "Load averages" below.

## Results: three quiet runs of each variant

Measured pairs: 2, 3 and 5. Off 1–3 and Named 1–3 below are those pairs' compiles, in pair order.

### Per-stage request times (`compile_stage`, s)

| Stage | Level | Off 1 | Off 2 | Off 3 | Named 1 | Named 2 | Named 3 | Off median | Named median | Added (median) | Named max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2 | 0.96 | 0.98 | 0.93 | 1.14 | 1.16 | 1.21 | 0.96 | 1.16 | +0.21 | 1.21 |
| 2 | 8 | 1.47 | 1.79 | 1.43 | 1.52 | 1.53 | 1.55 | 1.47 | 1.53 | +0.06 | 1.55 |
| 3 | 14 | 1.55 | 1.73 | 1.67 | 1.69 | 1.88 | 1.77 | 1.67 | 1.77 | +0.10 | 1.88 |
| 4 | 20 | 1.20 | 1.12 | 1.16 | 1.86 | 1.75 | 2.14 | 1.16 | 1.86 | +0.71 | 2.14 |
| 5 | 26 | 1.94 | 1.77 | 1.60 | 1.77 | 1.79 | 1.38 | 1.77 | 1.77 | +0.00 | 1.79 |
| 6 | 32 | 1.98 | 2.00 | 1.93 | 1.31 | 1.42 | 1.93 | 1.98 | 1.42 | -0.55 | 1.93 |
| 7 | 38 | 1.38 | 1.15 | 1.16 | 2.05 | 1.96 | 2.26 | 1.16 | 2.05 | +0.89 | 2.26 |
| 8 | 44 | 2.05 | 2.10 | 1.91 | 2.12 | 2.04 | 2.14 | 2.05 | 2.12 | +0.08 | 2.14 |
| 9 | 50 | 1.99 | 1.96 | 2.01 | 1.84 | 2.31 | 1.60 | 1.99 | 1.84 | -0.16 | 2.31 |
| 10 | 56 | 1.41 | 1.37 | 1.18 | 1.84 | 1.56 | 2.65 | 1.37 | 1.84 | +0.47 | 2.65 |
| 11 | 62 | 2.21 | 2.17 | 2.10 | 2.27 | 2.31 | 2.50 | 2.17 | 2.31 | +0.14 | 2.50 |
| 12 | 68 | 1.62 | 1.56 | 1.51 | 2.60 | 2.73 | 2.03 | 1.56 | 2.60 | +1.04 | 2.73 |
| 13 | 74 | 2.55 | 2.32 | 2.27 | 1.60 | 1.92 | 2.30 | 2.32 | 1.92 | -0.40 | 2.30 |
| 14 | 82 | 2.40 | 1.71 | 2.68 | 2.62 | 2.89 | 2.66 | 2.40 | 2.66 | +0.26 | 2.89 |
| 15 | 90 | 2.19 | 2.77 | 1.83 | 2.84 | 3.08 | 2.85 | 2.19 | 2.85 | +0.66 | 3.08 |

Slowest stage request with Full DPS on the named groups: **3.08 s** (limit < 20 s). [V]

Three stages are faster at the median with Full DPS on: stages 6, 9 and 13. The Lua CPU medians show the same
pattern (below), so the cause isn't load. It is engine work that moves from stage to stage,
most likely LuaJIT's garbage-collection cycles landing on different stages when Full DPS allocates more. [I]
The per-call totals are consistent: Full DPS adds 2.2–5.6 s to the stage sum in every pair.

### Whole-call times

| | Off 1 | Off 2 | Off 3 | Named 1 | Named 2 | Named 3 |
|---|---|---|---|---|---|---|
| pair (order) | 2 (second) | 3 (first) | 5 (first) | 2 (first) | 3 (second) | 5 (second) |
| `compile_check` | 481 ms | 521 ms | 487 ms | 474 ms | 513 ms | 533 ms |
| 15 × `compile_stage`, sum | 26.89 s | 26.52 s | 25.37 s | 29.07 s | 30.34 s | 30.96 s |
| slowest `compile_stage` | 2.55 s (stage 13) | 2.77 s (stage 15) | 2.68 s (stage 14) | 2.84 s (stage 15) | 3.08 s (stage 15) | 2.85 s (stage 15) |
| `compile_finish` | 69 ms | 65 ms | 65 ms | 77 ms | 86 ms | 88 ms |
| export (step 9) | 70 ms | 66 ms | 68 ms | 67 ms | 68 ms | 79 ms |
| record `timing.totalMs` | 27.70 s | 27.35 s | 26.15 s | 29.86 s | 31.20 s | 31.85 s |
| **whole call (wall)** | **27.77 s** | **27.42 s** | **26.22 s** | **29.93 s** | **31.27 s** | **31.92 s** |
| 1-minute load, start → end | 5.35 → 4.23 | 4.05 → 3.59 | 6.58 → 5.29 | 7.45 → 5.56 | 3.55 → 3.01 | 5.29 → 4.19 |
| groups in Full DPS in the saved file | 0 of 90 | 0 of 90 | 0 of 90 | 15 of 90 | 15 of 90 | 15 of 90 |

- Median whole call: off **27.42 s**, named **31.27 s**, a ratio of 1.14. The stage sums have the same ratio
  (1.14). [V]
- Slowest whole call with Full DPS on the named groups: **31.92 s** (limit ≤ 100 s). [V]

### Load averages (every compile)

All ten compiles, from `uptime`, as 1, 5 and 15 minutes. **[V, not retained]**: an ad-hoc query printed this
table from the raw output, which wasn't kept. The measured pairs' 1-minute figures and whole-call times also
appear in `summarize.mjs`'s whole-call table, but the loaded runs' rows appear only here. "Quiet" means the
1-minute average was at most 8 at the start and at the end. The 5-minute average was above 8 at the start of some quiet runs, because of
earlier spikes. The 1-minute average is the one that covers the compile's own 25–70 s window.

| Pair | Order | Variant | Whole call | Slowest stage | Load at start | Load at end | Quiet |
|---|---|---|---|---|---|---|---|
| 1 | first | off | 25.15 s | 2.47 s (stage 14) | 6.93, 5.33, 3.56 | 6.48, 5.38, 3.63 | yes |
| 1 | second | named | 71.18 s | 7.07 s (stage 7) | 6.48, 5.38, 3.63 | 26.11, 12.57, 6.32 | **no, over 8** |
| 2 | first | named | 29.93 s | 2.84 s (stage 15) | 7.45, 10.20, 6.15 | 5.56, 9.48, 6.04 | yes |
| 2 | second | off | 27.77 s | 2.55 s (stage 13) | 5.35, 9.37, 6.03 | 4.23, 8.78, 5.92 | yes |
| 3 | first | off | 27.42 s | 2.77 s (stage 15) | 4.05, 8.67, 5.90 | 3.59, 8.18, 5.81 | yes |
| 3 | second | named | 31.27 s | 3.08 s (stage 15) | 3.55, 8.10, 5.79 | 3.01, 7.53, 5.68 | yes |
| 4 | first | named | 47.72 s | 9.22 s (stage 14) | 3.01, 7.53, 5.68 | 17.85, 10.34, 6.70 | **no, over 8** |
| 4 | second | off | 48.87 s | 4.20 s (stage 2) | 20.10, 10.93, 6.91 | 22.54, 13.14, 7.87 | **no, over 8** |
| 5 | first | off | 26.22 s | 2.68 s (stage 14) | 6.58, 10.41, 7.48 | 5.29, 9.79, 7.35 | yes |
| 5 | second | named | 31.92 s | 2.85 s (stage 15) | 5.29, 9.79, 7.35 | 4.19, 9.02, 7.18 | yes |

- **Load from other lanes inflates a compile by up to about 2.3×.** In pair 1, the named compile took 71.18 s
  while the load rose to 26. The quiet named compiles had a median of 31.27 s. The loaded runs are not part of the
  measured set, but they bound the contended case. With Full DPS on the named groups and a load of 18–26, no
  stage took longer than 9.22 s, and no call longer than 71.18 s. Both are still inside the limits. [V, not
  retained]
- **CPU time inflates under load too.** In the loaded named run of pair 1, the Lua CPU summed over the stages
  was 59.9 s, against 26.3–28.1 s in the quiet named runs. [V, not retained: per-run sums from an ad-hoc
  query; `summarize.mjs` prints only the median over the measured runs, 27.51 s.] So `os.clock` doesn't shield
  the measurement from contention on this machine. Shared cores and caches are the likely cause. [I]

### Where the time goes

Lua CPU per stage (`os.clock`, s), as the median over the three measured runs of each variant:

| Stage | Rebuilds | `calcFullDPS` calls | Off: request CPU | Off: in `calcFullDPS` | Named: request CPU | Named: in `calcFullDPS` | Named: groups in Full DPS |
|---|---|---|---|---|---|---|---|
| 1 | 34 | 136 | 0.86 | 0.07 | 1.05 | 0.24 | [1] |
| 2 | 34 | 136 | 1.33 | 0.13 | 1.39 | 0.27 | [1] |
| 3 | 34 | 136 | 1.51 | 0.14 | 1.60 | 0.38 | [1] |
| 4 | 34 | 136 | 1.05 | 0.09 | 1.69 | 0.40 | [1] |
| 5 | 34 | 136 | 1.60 | 0.14 | 1.61 | 0.36 | [1] |
| 6 | 34 | 136 | 1.79 | 0.18 | 1.29 | 0.28 | [1] |
| 7 | 34 | 136 | 1.05 | 0.10 | 1.86 | 0.46 | [1] |
| 8 | 34 | 136 | 1.86 | 0.19 | 1.93 | 0.45 | [1] |
| 9 | 34 | 136 | 1.81 | 0.20 | 1.66 | 0.41 | [1] |
| 10 | 34 | 136 | 1.24 | 0.12 | 1.66 | 0.31 | [1] |
| 11 | 34 | 136 | 1.97 | 0.23 | 2.10 | 0.50 | [1] |
| 12 | 34 | 136 | 1.41 | 0.13 | 2.36 | 0.59 | [1] |
| 13 | 34 | 136 | 2.11 | 0.25 | 1.74 | 0.35 | [1] |
| 14 | 34 | 136 | 2.17 | 0.26 | 2.41 | 0.58 | [1] |
| 15 | 34 | 136 | 1.98 | 0.15 | 2.58 | 0.69 | [1] |

- **Every stage makes 34 full output rebuilds, and each one runs PoB's Full DPS pass four times.** That is 136
  `calcFullDPS` calls per stage, in both variants. [V] `CalcsTab:BuildOutput` builds the MAIN and CALCS outputs
  (`Classes/CalcsTab.lua:484-487`), and each of those calls `calcFullDPS` (`Modules/Calcs.lua:516`). It then
  builds the node and misc calculators (`CalcsTab.lua:495-496`), which call it again (`Calcs.lua:79`, `:130`).
- **With no group in Full DPS, the pass still costs about 2.4 s per compile.** That is 0.07–0.26 s per stage.
  [V] It is mostly the `calcs.initEnv` that `calcFullDPS` runs before it looks for flagged skills
  (`Calcs.lua:255`). [I]
- **With the rolled group flagged, the pass costs 6.25 s per compile.** Each call then also calculates the
  flagged group's skill (`calcs.perform`, `Calcs.lua:332-362`). The difference, 3.9 s, matches the 3.85 s
  added to the median whole call. Summed over the 15 stages in the median run, the request CPU is 24.03 s off
  and 27.51 s named. [V]
- **The rest of a stage is unchanged.** Tree, items, gems, config, the C-45 per-skill breakdown and the V1/V2
  reads cost the same in both variants.

### What changes in the record

In all five pairs, the two compiles differ in only two fields:
- `outputs.FullDPS`, on every stage (0 off; 16.4 at stage 1 rising to 626.6 at stage 15 named);
- `outputs.FullDotDPS`, on stage 15.

Every other output, every `skillOutputs` field (C-45's per-skill breakdown) and every stage's V1 and V2 pass
flag is equal between the variants. [V] So computing Full DPS doesn't disturb any figure the record already
holds. V1 fails on every stage of this fixture in both variants, with equal pass flags, so the Full DPS flag
doesn't change a verdict.

## Sensitivity: every group in Full DPS

The same probe with all six groups of every stage in Full DPS (`WU51_MODE=all`), through the real compiler.
This bounds a named source with several groups, and updates R-32's basis.

| Run | Whole call (wall) | Stage sum | Slowest stage | 1-minute load, start → end | Quiet |
|---|---|---|---|---|---|
| 1 | 67.42 s | 66.27 s | 6.10 s (stage 15) | 7.76 → 5.33 | yes |
| 2 | 61.41 s | 60.35 s | 5.50 s (stage 14) | 5.33 → 3.90 | yes |
| 3 | 69.49 s | 67.00 s | 8.33 s (stage 15) | 3.83 → 13.28 | no |
| 4 | 63.23 s | 62.22 s | 6.17 s (stage 15) | 6.60 → 3.55 | yes |

The full load averages (1, 5, 15 minutes), start → end [V, not retained]:
- run 1: 7.76, 9.58, 7.40 → 5.33, 8.52, 7.19;
- run 2: 5.33, 8.52, 7.19 → 3.90, 7.54, 6.93;
- run 3: 3.83, 7.46, 6.91 → 13.28, 8.88, 7.40;
- run 4: 6.60, 10.34, 8.44 → 3.55, 8.71, 8.00.

All 90 groups were in Full DPS in every saved file. That was observed, not asserted. [V, not retained]

- **Every group in Full DPS fits the limits too, with a smaller margin.** The quiet whole calls took
  61.41–67.42 s, about 2.3× the "off" compile, against 100 s. The slowest stage took 6.17 s, against 20 s. [V]
  In the quiet runs, 33–36 s of the 55–60 s of Lua CPU was spent in `calcFullDPS`. [V, not retained: the
  split came from an ad-hoc query, and `summarize.mjs` doesn't print it for this mode.]
- **R-32's figure doesn't apply to the compiler as built.** The 160.68 s / 25.50 s run came from WU-30's
  emulation, which made 87–91 rebuilds per stage with none deferred, under a load that reached 23.6. The
  compiler defers rebuilds (34 per stage, D-306). With every group in Full DPS it takes 61–69 s, loaded run
  included, and with the named group only it takes 30–32 s. [V]

## Decision

The rule (AC-P57, D-293): if Full DPS for the named groups fits NFR-21, the final compile computes it; otherwise
the flags are written at export only.

- Every stage request with Full DPS on the named groups finished in under 20 s: at most 3.08 s in the quiet
  runs [V]. Under a load of 18–26 it was at most 9.22 s [V, not retained].
- Every whole call took at most 100 s: at most 31.92 s quiet [V], and 71.18 s loaded [V, not retained].
- The decision rests on the quiet figures alone. The loaded ones only add margin.

**Within NFR-21: the final compile computes Full DPS for the named source's groups.**

- WU-55 creates the named source's groups with `includeInFullDPS` on during the final compile, in step 7. It
  doesn't patch the flags into the XML at export.
- **Measure-only compiles compute Full DPS for the named groups too (D-337).** D-293 keeps Full DPS out of
  measure compiles unless S-N2 shows it is cheap. The coordinator ruled that the ×1.14 measured here counts as
  cheap. Measure-only compiles do the same step-7 work, so the same cost applies (below).

## Notes for WU-55 (not decisions)

- **Where the flag goes.** `build_skills` creates every group with `includeInFullDPS = false`
  (`Compile.lua:631-633`). Setting it there for the named groups is what this probe emulated, before any
  calculation of the stage.
  - `build_skills` creates groups only when the stage's skill set is fresh (`Compile.lua:628-629`).
  - So stages that share a skill set share its flags, as they share its groups. [I]
- **Count adds no calculation.** PoB runs one `calcs.perform` per Full DPS skill (`Modules/Calcs.lua:362`).
  It reads the group's Count through `calcs.getActiveSkillCount`:
  - the call is at `Calcs.lua:344`;
  - the function returns `groupCount` (`Modules/CalcDefence.lua:151-152`).

  It then multiplies when it merges the results (`Calcs.lua:322`). So `groupCount` above 1 shouldn't change
  the cost measured here. [V: source read; I: not timed]
- **Measure-only compiles.** Step 7 is the same in both modes (§3.6), so Full DPS on the named groups would add
  the same 1.14× to a measure-only compile: a median of 27.42 s rising to 31.27 s on this fixture. [I] D-337
  makes measure-only compiles compute it, so WU-55 sets the flag in both modes.
- **AC-P37's test.** `compilePlanNfr.test.ts:83` asserts that no group is in Full DPS. WU-55's block already
  narrows that check to the groups outside the named source. The test's 100 s and 20 s thresholds keep about
  3× and 6× margins on this fixture.
- **A named source with several groups** adds one skill calculation per group to each of the 136 Full DPS
  passes in a stage. The all-groups run bounds six groups at 61–67 s.

## AC-P57 script check

Run from the worktree root. It checks the report's parts, and that the decision follows the rule from the
tables' own figures.

```bash
f=docs/build-guide/spikes/WU-51-full-dps.md
test -f "$f" && echo "report: present"
grep -q '^## Machine' "$f" && grep -q '^## Pin' "$f" && grep -q '^## Method' "$f" && echo "machine, pin, method: present"
awk -F'|' 'NF==14 && $2+0>=1 && $2+0<=15 {n++; if ($13+0>m) m=$13+0} END {printf "per-stage rows: %d; slowest named stage: %.2f s; under 20 s: %s\n", n, m, (m<20?"yes":"no")}' "$f"
grep -q '| Off 1 | Off 2 | Off 3 | Named 1 | Named 2 | Named 3 |' "$f" && echo "runs: 3 per variant"
awk -F'|' '/\*\*whole call \(wall\)\*\*/ {for (i=3;i<NF;i++) {v=$i; gsub(/[^0-9.]/,"",v); if (v+0>m) m=v+0; k++}} END {printf "whole calls: %d; slowest: %.2f s; within 100 s: %s\n", k, m, (m<=100?"yes":"no")}' "$f"
echo "load rows: $(grep -c '^| [1-5] | \(first\|second\) | \(off\|named\) |' "$f")"
grep -q '^## Appendix: probe source' "$f" && grep -q '^### `wu51.probe.ts`' "$f" && echo "appendix: probe source present"
grep -m1 -o '^\*\*Within NFR-21: the final compile computes Full DPS for the named source.s groups.\*\*' "$f"
```

Output (2026-10-10):

```
report: present
machine, pin, method: present
per-stage rows: 15; slowest named stage: 3.08 s; under 20 s: yes
runs: 3 per variant
whole calls: 6; slowest: 31.92 s; within 100 s: yes
load rows: 10
appendix: probe source present
**Within NFR-21: the final compile computes Full DPS for the named source's groups.**
```

## Appendix: probe source

Four files in a `mktemp -d` directory. Run `./run.sh` there. `WU51_REPO` names the checkout, which needs
`mise trust`, `pnpm install` and `mise run pob:fetch` first.

- The defaults are `WU51_PAIRS=3`, `WU51_MAX_PAIRS=6`, `WU51_MAX_LOAD=8` and `WU51_WAIT_S=1800`. The measured
  set used the defaults.
- `WU51_MODE=all` runs the sensitivity bound.
- `node summarize.mjs results.json [all.json]` prints the tables above.

### `run.sh`

```bash
#!/usr/bin/env bash
# Runs the WU-51 probe from this temp dir: temp builds, state and guides folders; luajit from the checkout's mise.
# Env: WU51_REPO (checkout), WU51_PAIRS (quiet pairs wanted, default 3), WU51_MAX_PAIRS (default 6),
# WU51_MAX_LOAD (default 8), WU51_WAIT_S (longest wait for a quiet machine before a pair, default 1800), WU51_OUT.
set -euo pipefail
cd "$(dirname "$0")"
export WU51_REPO="${WU51_REPO:-/home/parker/projects/pob2-mcp-wt/bg-51}"
LJ=$(dirname "$(cd "$WU51_REPO" && mise which luajit)")
NODE=$(cd "$WU51_REPO" && mise which node)
mkdir -p builds state guides
export PATH="$LJ:$PATH" POB_DIRECTORY="$PWD/builds" XDG_STATE_HOME="$PWD/state" POB_GUIDES_DIRECTORY="$PWD/guides"
export WU51_OUT="${WU51_OUT:-$PWD/results.json}"
exec "$NODE" "$WU51_REPO/node_modules/jest/bin/jest.js" --config "$PWD/jest.config.cjs" --runInBand wu51.probe
```

### `jest.config.cjs`

```js
// Jest config for the WU-51 probe: the repo's ts-jest setup and C-18 global setup, with roots in this temp dir
// so the probe never lives in, or runs from, the repo. WU51_REPO names the checkout.
const W = process.env.WU51_REPO || '/home/parker/projects/pob2-mcp-wt/bg-51';
module.exports = {
  rootDir: W,
  roots: [__dirname],
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchman: false,
  globalSetup: W + '/tests/setup/global.ts',
  setupFiles: [W + '/tests/setup/env.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: W + '/tsconfig.test.json', diagnostics: false }] },
  testMatch: ['**/*.probe.ts'],
  moduleNameMapper: { '^@repo/(.*)$': W + '/$1', '^(\\.{1,2}/.*)\\.js$': '$1' },
  testTimeout: 6 * 3600 * 1000,
};
```

### `wu51.probe.ts`

```ts
/**
 * WU-51 (S-N2) probe: what a final compile of the fifteen-stage fixture costs with PoB's Full DPS on for each
 * stage's `rolledGroup` only ("named"), against the same compile with no group in Full DPS ("off").
 *
 * The compile is the real one: `compile_plan` in final mode through the in-process server (startSessionFixture,
 * test actions on), exactly as AC-P37's test runs it: a fresh server and engine per compile, one
 * `lua_get_build_info` to start the engine, then the call. The plan schema can't ask for Full DPS yet (WU-55), so
 * before the call one untimed `__test_eval` installs probe-only Lua wrappers in the engine:
 *  - BuildOps.create_socket_group: while a stage is compiled, the group about to become index `target` (the
 *    stage's rolledGroup, from DATA.targets) is created with includeInFullDPS on, before any calculation of the
 *    stage. Compile.lua calls it through the BuildOps table (`Compile.lua:631-633`), so the wrapper is reached.
 *  - the compile_stage handler (Handlers' dispatch table, looked up per request): per stage, Lua CPU time
 *    (os.clock) of the whole request, the calcs tab's full output rebuilds (count, CPU) and PoB's
 *    calcs.calcFullDPS calls (count, CPU), and which groups of the stage's skill set are in Full DPS after it.
 * Both variants run with the same wrappers; only DATA.targets differs ({} for "off").
 *
 * Runs come in pairs (one "off", one "named", order alternating), each pair started once the 1-minute load
 * average is at most WU51_MAX_LOAD. WU51_MODE=all instead runs single compiles with every group in Full DPS
 * (a sensitivity bound, as WU-30's "every group in Full DPS", now through the real compiler). A compile is "quiet" when the load at its start and end is at most that.
 * The bridge's request timeout is raised to 120 s (POB_TIMEOUT_MS), so a slow stage is recorded, not cut at
 * C-4's 30 s. Results go to $WU51_OUT after every compile.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { performance } from 'perf_hooks';
import { startSessionFixture, type SessionFixture } from '@repo/tests/helpers/engineSession';

type Json = any;
type Variant = 'off' | 'named' | 'all';

const REPO = process.env.WU51_REPO ?? '/home/parker/projects/pob2-mcp-wt/bg-51';
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'fifteen-stage', 'plan.json');
const PAIRS = Number(process.env.WU51_PAIRS ?? '3');
const MAX_PAIRS = Number(process.env.WU51_MAX_PAIRS ?? '6');
const MAX_LOAD = Number(process.env.WU51_MAX_LOAD ?? '8');
const WAIT_S = Number(process.env.WU51_WAIT_S ?? '1800');
const OUT = process.env.WU51_OUT ?? path.join(__dirname, 'results.json');
const MODE = process.env.WU51_MODE === 'all' ? 'all' : 'pairs';
const CALL_TIMEOUT_MS = 900_000;

const INSTALL = String.raw`
local H = require('API.Handlers').handlers
local B = require('API.BuildOps')
local W = rawget(_G, 'WU51')
if not W then
  W = { stage = H.compile_stage, create = B.create_socket_group, stats = {}, targets = {} }
  rawset(_G, 'WU51', W)
  -- The stage's rolledGroup is created with includeInFullDPS on, before any calculation of the stage.
  B.create_socket_group = function(p)
    local cur = W.cur
    if cur and cur.target and type(p) == 'table' and build and build.skillsTab then
      local ss = build.skillsTab.skillSets[build.skillsTab.activeSkillSetId or 1]
      local nextIndex = ss and #ss.socketGroupList + 1
      for _, gi in ipairs(cur.target) do
        if gi == nextIndex then p.includeInFullDPS = true end
      end
    end
    return W.create(p)
  end
  H.compile_stage = function(params)
    local id = type(params) == 'table' and tostring(params.id) or '?'
    local st = { target = W.targets[id], cpu = 0, rebuilds = 0, rebuildCpu = 0, fullDps = 0, fullDpsCpu = 0 }
    W.cur = st
    local ct = build and build.calcsTab
    local calcs = ct and ct.calcs
    local own = ct and rawget(ct, 'BuildOutput')
    local bo = ct and ct.BuildOutput
    if ct then
      rawset(ct, 'BuildOutput', function(self, ...)
        local c = os.clock()
        local r = bo(self, ...)
        st.rebuilds = st.rebuilds + 1
        st.rebuildCpu = st.rebuildCpu + (os.clock() - c)
        return r
      end)
    end
    local fd = calcs and calcs.calcFullDPS
    if fd then
      calcs.calcFullDPS = function(...)
        local c = os.clock()
        local r = fd(...)
        st.fullDps = st.fullDps + 1
        st.fullDpsCpu = st.fullDpsCpu + (os.clock() - c)
        return r
      end
    end
    local c0 = os.clock()
    local ok, res = pcall(W.stage, params)
    st.cpu = os.clock() - c0
    if ct then rawset(ct, 'BuildOutput', own) end
    if fd then calcs.calcFullDPS = fd end
    local flagged = {}
    local ss = build and build.skillsTab and build.skillsTab.skillSets[build.skillsTab.activeSkillSetId or 1]
    for gi, g in ipairs(ss and ss.socketGroupList or {}) do
      if g.includeInFullDPS then flagged[#flagged + 1] = gi end
    end
    st.flagged = flagged
    W.cur = nil
    W.stats[id] = st
    if not ok then error(res, 0) end
    return res
  end
end
W.targets = DATA.targets
W.stats = {}
return { installed = true }
`;

const lua = async <T = Json>(f: SessionFixture, body: string, data?: unknown): Promise<T> => {
  const code = (data === undefined ? '' : `local DATA = require('dkjson').decode([==[${JSON.stringify(data)}]==])\n`) + body;
  const { value } = await f.session.run({ tool: 'wu51:lua', kind: 'read' }, async (ctx: Json) => {
    const reply = await ctx.client.request('__test_eval', { code }, { timeoutMs: 120_000 });
    if (!reply.ok) throw new Error(`__test_eval failed: ${reply.error}`);
    return reply.result as T;
  });
  return value;
};

const uptime = (): string => execFileSync('uptime', { encoding: 'utf8' }).trim();
const load1 = (): number => os.loadavg()[0];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForQuiet(): Promise<{ waitedS: number; quiet: boolean }> {
  const t0 = performance.now();
  while (load1() > MAX_LOAD) {
    if ((performance.now() - t0) / 1000 > WAIT_S) return { waitedS: (performance.now() - t0) / 1000, quiet: false };
    await sleep(15_000);
  }
  return { waitedS: (performance.now() - t0) / 1000, quiet: true };
}

async function compileOnce(variant: Variant, pair: number, slot: number, plan: Json): Promise<Json> {
  // Per stage id, the group indices to put in Full DPS: the rolledGroup ("named"), every group ("all"), none ("off").
  const targets: Record<string, number[]> = {};
  for (const s of plan.stages) {
    if (variant === 'named' && s.skills.rolledGroup) targets[s.id] = [s.skills.rolledGroup];
    if (variant === 'all') targets[s.id] = s.skills.groups.map((_: Json, i: number) => i + 1);
  }
  const f = await startSessionFixture({ testActions: true, deps: { env: { POB_TIMEOUT_MS: '120000' } } as Json });
  try {
    const info = await f.call('lua_get_build_info');
    if (info.isError) throw new Error(info.text);
    await lua(f, INSTALL, { targets });
    const name = `wu51-${variant}-${pair}`;
    const run = await f.call('guide_run', { new_run: name });
    if (run.isError) throw new Error(run.text);
    const planPath = /^plan_path for this run: (\S+)$/m.exec(run.text)![1];
    fs.copyFileSync(FIXTURE, path.join(f.guides, planPath));

    const loadStart = os.loadavg();
    const uptimeStart = uptime();
    const t0 = performance.now();
    const out = await f.server.client.callTool(
      { name: 'compile_plan', arguments: { plan_path: planPath, build_name: name } },
      undefined,
      { timeout: CALL_TIMEOUT_MS },
    );
    const wallMs = performance.now() - t0;
    const loadEnd = os.loadavg();
    const uptimeEnd = uptime();
    const text = (out.content as Array<{ text: string }>).map((c) => c.text).join('\n');
    const quiet = loadStart[0] <= MAX_LOAD && loadEnd[0] <= MAX_LOAD;
    const base = { pair, slot, variant, quiet, loadStart, loadEnd, uptimeStart, uptimeEnd, wallMs };
    if (out.isError) return { ...base, error: text };

    const record = JSON.parse(fs.readFileSync(path.join(f.guides, path.posix.dirname(planPath), 'compile-record.json'), 'utf8'));
    const luaStats = await lua(f, 'return WU51.stats');
    const xml = fs.readFileSync(path.join(f.builds, `${name}.xml`), 'utf8');
    const skillTags = [...xml.matchAll(/<Skill\b[^>]*>/g)].map((m) => m[0]);
    const xmlFlagged = skillTags.filter((t) => /includeInFullDPS="true"/.test(t)).map((t) => /label="([^"]*)"/.exec(t)?.[1] ?? '?');
    const stageMs: Record<string, number> = {};
    const fullDps: Record<string, number | null> = {};
    for (const [id, s] of Object.entries<Json>(record.stages)) {
      stageMs[id] = s.elapsedMs;
      fullDps[id] = typeof s.outputs.FullDPS === 'number' ? s.outputs.FullDPS : null;
    }
    const ms = Object.values(stageMs);
    return {
      ...base,
      timing: record.timing,
      stagesCompiled: record.stagesCompiled.length,
      stageMs,
      stageMaxMs: Math.max(...ms),
      stageSumMs: ms.reduce((a, b) => a + b, 0),
      lua: luaStats,
      xmlBytes: xml.length,
      xmlSkillGroups: skillTags.length,
      xmlFlagged,
      fullDps,
      outputs: Object.fromEntries(Object.entries<Json>(record.stages).map(([id, s]) => [id, s.outputs])),
      skillOutputs: Object.fromEntries(Object.entries<Json>(record.stages).map(([id, s]) => [id, s.skillOutputs])),
      v: Object.fromEntries(Object.entries<Json>(record.stages).map(([id, s]) => [id, { v1: s.v1?.pass, v2: s.v2?.pass }])),
    };
  } finally {
    await f.close();
  }
}

/** Per stage, the outputs and breakdown fields whose values differ between two compiles of a pair. */
function diffPair(a: Json, b: Json): Json {
  const out: Json = {};
  for (const id of Object.keys(a.outputs ?? {})) {
    const keys = new Set([...Object.keys(a.outputs[id]), ...Object.keys(b.outputs[id] ?? {})]);
    const outputs = [...keys].filter((k) => a.outputs[id][k] !== b.outputs[id]?.[k]).sort();
    const skill: string[] = [];
    for (const g of new Set([...Object.keys(a.skillOutputs[id]), ...Object.keys(b.skillOutputs[id] ?? {})])) {
      const fa = a.skillOutputs[id][g]?.fields ?? {};
      const fb = b.skillOutputs[id]?.[g]?.fields ?? {};
      for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) if (fa[k] !== fb[k]) skill.push(`${g}.${k}`);
    }
    out[id] = { outputs, skillOutputs: skill.sort() };
  }
  return out;
}

test('WU-51: final fifteen-stage compile, Full DPS on the rolled groups vs off', async () => {
  const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const compiles: Json[] = [];
  const pairs: Json[] = [];
  const save = () =>
    fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), maxLoad: MAX_LOAD, compiles, pairs }, null, 2));
  let quietPairs = 0;
  for (let pair = 1; pair <= MAX_PAIRS && quietPairs < PAIRS; pair++) {
    const wait = await waitForQuiet();
    const order: Variant[] = MODE === 'all' ? ['all'] : pair % 2 === 1 ? ['off', 'named'] : ['named', 'off'];
    const got: Record<string, Json> = {};
    for (const [i, variant] of order.entries()) {
      const c = await compileOnce(variant, pair, i + 1, plan);
      c.waitedS = i === 0 ? wait.waitedS : 0;
      compiles.push(c);
      got[variant] = c;
      save();
      console.error(
        `[WU-51] pair ${pair} ${variant}: ${c.error ? 'ERROR ' + c.error.slice(0, 200) : `whole ${(c.wallMs / 1000).toFixed(2)} s, ` +
          `record ${(c.timing.totalMs / 1000).toFixed(2)} s, stage max ${(c.stageMaxMs / 1000).toFixed(2)} s`}, ` +
          `load ${c.loadStart[0].toFixed(2)} -> ${c.loadEnd[0].toFixed(2)}${c.quiet ? '' : ' (LOADED)'}`,
      );
    }
    const both = got.off && got.named && !got.off.error && !got.named.error;
    const quiet = order.every((v) => got[v] && !got[v].error && got[v].quiet);
    if (quiet) quietPairs += 1;
    pairs.push({ pair, order, quiet, diff: both ? diffPair(got.off, got.named) : null });
    save();
  }
  // Keep the per-stage outputs out of the saved summary: they are only for the diff.
  for (const c of compiles) {
    delete c.outputs;
    delete c.skillOutputs;
  }
  save();
  expect(compiles.every((c) => !c.error)).toBe(true);
});
```

### `summarize.mjs`

```js
// Summarizes the WU-51 probe's results file(s) as Markdown tables: node summarize.mjs results.json [all.json]
import fs from 'fs';

const [file, allFile] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
const LEVELS = [2, 8, 14, 20, 26, 32, 38, 44, 50, 56, 62, 68, 74, 82, 90];
const s = (ms) => (ms / 1000).toFixed(2);
const sd = (ms) => (ms >= 0 ? '+' : '-') + s(Math.abs(ms));
const med = (a) => { const b = [...a].sort((x, y) => x - y); const n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };
const ok = r.compiles.filter((c) => !c.error);
const quietPairs = new Set(r.pairs.filter((p) => p.quiet).map((p) => p.pair));
const measured = ok.filter((c) => quietPairs.has(c.pair));
const by = (v) => measured.filter((c) => c.variant === v).sort((a, b) => a.pair - b.pair);
const off = by('off');
const named = by('named');
const ids = Object.keys(off[0].stageMs).sort((a, b) => a - b);

console.log(`Measured pairs: ${[...quietPairs].join(', ')}; every compile: ${r.compiles.map((c) => `${c.pair}/${c.variant}${c.quiet ? '' : '(loaded)'}${c.error ? '(error)' : ''}`).join(' ')}\n`);

console.log('### Per-stage request times (`compile_stage`, s)\n');
console.log(`| Stage | Level | ${off.map((c, i) => `Off ${i + 1}`).join(' | ')} | ${named.map((c, i) => `Named ${i + 1}`).join(' | ')} | Off median | Named median | Added (median) | Named max |`);
console.log(`|${'---|'.repeat(4 + off.length + named.length + 2)}`);
for (const id of ids) {
  const o = off.map((c) => c.stageMs[id]);
  const n = named.map((c) => c.stageMs[id]);
  console.log(`| ${id} | ${LEVELS[id - 1]} | ${o.map(s).join(' | ')} | ${n.map(s).join(' | ')} | ${s(med(o))} | ${s(med(n))} | ${sd(med(n) - med(o))} | ${s(Math.max(...n))} |`);
}

console.log('\n### Whole-call times\n');
const cols = [...off.map((c, i) => ['Off ' + (i + 1), c]), ...named.map((c, i) => ['Named ' + (i + 1), c])];
console.log(`| | ${cols.map(([h]) => h).join(' | ')} |`);
console.log(`|---|${cols.map(() => '---|').join('')}`);
const row = (label, f) => console.log(`| ${label} | ${cols.map(([, c]) => f(c)).join(' | ')} |`);
row('pair (order)', (c) => `${c.pair} (${c.slot === 1 ? 'first' : 'second'})`);
row('`compile_check`', (c) => `${Math.round(c.timing.checkMs)} ms`);
row('15 × `compile_stage`, sum', (c) => `${s(c.stageSumMs)} s`);
row('slowest `compile_stage`', (c) => { const id = Object.keys(c.stageMs).find((k) => c.stageMs[k] === c.stageMaxMs); return `${s(c.stageMaxMs)} s (stage ${id})`; });
row('`compile_finish`', (c) => `${Math.round(c.timing.finishMs)} ms`);
row('export (step 9)', (c) => `${Math.round(c.timing.exportMs)} ms`);
row('record `timing.totalMs`', (c) => `${s(c.timing.totalMs)} s`);
row('**whole call (wall)**', (c) => `**${s(c.wallMs)} s**`);
row('1-min load, start → end', (c) => `${c.loadStart[0].toFixed(2)} → ${c.loadEnd[0].toFixed(2)}`);
row('XML groups in Full DPS', (c) => `${c.xmlFlagged.length} of ${c.xmlSkillGroups}`);
console.log(`\nWhole call, median: off ${s(med(off.map((c) => c.wallMs)))} s, named ${s(med(named.map((c) => c.wallMs)))} s; slowest stage overall: off ${s(Math.max(...off.map((c) => c.stageMaxMs)))} s, named ${s(Math.max(...named.map((c) => c.stageMaxMs)))} s.`);
console.log(`Ratio of medians (named / off), whole call: ${(med(named.map((c) => c.wallMs)) / med(off.map((c) => c.wallMs))).toFixed(3)}; stage sum: ${(med(named.map((c) => c.stageSumMs)) / med(off.map((c) => c.stageSumMs))).toFixed(3)}`);

console.log('\n### Lua CPU per stage (os.clock, s; medians over the measured runs)\n');
console.log('| Stage | Rebuilds | `calcFullDPS` calls | Off: request CPU | Off: in `calcFullDPS` | Named: request CPU | Named: in `calcFullDPS` | Named: groups in Full DPS |');
console.log('|---|---|---|---|---|---|---|---|');
for (const id of ids) {
  const L = (cs, k) => med(cs.map((c) => c.lua[id][k]));
  const flagged = [...new Set(named.map((c) => JSON.stringify(c.lua[id].flagged)))].join(' ');
  console.log(`| ${id} | ${[...new Set([...off, ...named].map((c) => c.lua[id].rebuilds))].join('/')} | ${[...new Set([...off, ...named].map((c) => c.lua[id].fullDps))].join('/')} | ${L(off, 'cpu').toFixed(2)} | ${L(off, 'fullDpsCpu').toFixed(2)} | ${L(named, 'cpu').toFixed(2)} | ${L(named, 'fullDpsCpu').toFixed(2)} | ${flagged} |`);
}
const sumL = (cs, k) => med(cs.map((c) => ids.reduce((a, id) => a + c.lua[id][k], 0)));
console.log(`\nSum over 15 stages (median run): off request CPU ${sumL(off, 'cpu').toFixed(2)} s, in calcFullDPS ${sumL(off, 'fullDpsCpu').toFixed(2)} s; named request CPU ${sumL(named, 'cpu').toFixed(2)} s, in calcFullDPS ${sumL(named, 'fullDpsCpu').toFixed(2)} s.`);

console.log('\n### What changes in the record\n');
for (const p of r.pairs.filter((p) => p.diff)) {
  const outs = new Map();
  let skill = 0;
  for (const [id, d] of Object.entries(p.diff)) {
    for (const k of d.outputs) outs.set(k, [...(outs.get(k) ?? []), id]);
    skill += d.skillOutputs.length;
  }
  console.log(`pair ${p.pair}: outputs differing: ${[...outs].map(([k, v]) => `${k} (stages ${v.join(',')})`).join('; ') || 'none'}; skillOutputs fields differing: ${skill}`);
}
console.log(`\nFullDPS per stage (named, pair ${named[0].pair}): ${ids.map((id) => `${id}: ${named[0].fullDps[id]?.toFixed(1)}`).join(', ')}`);
console.log(`V1/V2 pass flags equal between variants: ${off.every((o) => named.every((n) => JSON.stringify(o.v) === JSON.stringify(n.v)))}`);

if (allFile) {
  const a = JSON.parse(fs.readFileSync(allFile, 'utf8'));
  console.log('\n### Sensitivity: every group in Full DPS\n');
  console.log('| Run | Whole call (wall) | Stage sum | Slowest stage | 1-min load, start → end | Quiet |');
  console.log('|---|---|---|---|---|---|');
  for (const c of a.compiles) {
    if (c.error) { console.log(`| ${c.pair} | error: ${c.error.slice(0, 80)} | | | | |`); continue; }
    const id = Object.keys(c.stageMs).find((k) => c.stageMs[k] === c.stageMaxMs);
    console.log(`| ${c.pair} | ${s(c.wallMs)} s | ${s(c.stageSumMs)} s | ${s(c.stageMaxMs)} s (stage ${id}) | ${c.loadStart[0].toFixed(2)} → ${c.loadEnd[0].toFixed(2)} | ${c.quiet ? 'yes' : 'no'} |`);
  }
}
```
