# WU-30: compile-time spike

Date 2026-10-08. Pin PathOfBuilding-PoE2 `v0.23.1` (commit `7d6f530`). **[V]** = measured or read here,
**[I]** = inference.

**Decision: S1 confirmed.** Every stage request finished in under 20 s (slowest 3.10 s) and every
15-stage whole call took at most 100 s (slowest 33.58 s), so D-229's pass mark holds. A final
`compile_plan` always compiles the whole plan in one call, and a `stages` subset stays limited to
`guide_run`'s validate mode and `compile_plan`'s measure-only mode (A-P8). HG-13 does not fire, so WU-30's
gate on WU-41 is clear.

## The question

WU-30 times a worst-case 15-stage compile before WU-41 builds the compiler. Three spec items depend on
the answer:

- **D-229**, the pass mark. Every per-stage engine request must finish in under 20 s, a third below the
  bridge's 30 s request timeout (C-4). A 15-stage plan must compile in at most 100 s in total.
- **HG-13**, the human gate that fires when the pass mark is missed. The user would then pick a new budget
  or an incremental scheme, and WU-41 would wait.
- **A-P8**, the `stages` subset rule, called S1. A subset is accepted only by `guide_run`'s validate mode
  and `compile_plan`'s measure-only mode, and a final compile is always the whole plan. WU-30 either
  confirms S1 or raises HG-13.

The rule for the decision is AC-P2: "S1 confirmed" if every run's whole call is ≤ 100 s and every stage
request is < 20 s. Otherwise the unit ends `blocked:needs-human` on HG-13.

## Machine

| | |
|---|---|
| CPU | AMD Ryzen 9 9950X3D, 16 cores / 32 threads |
| RAM | 47 GiB visible to WSL |
| OS | Ubuntu 24.04.4 LTS on WSL2, kernel 6.6.87.2-microsoft-standard-WSL2 |
| Runtimes | Node v24.16.0; LuaJIT 2.1.1784580905 (mise) |
| Other load | Other build lanes ran Jest suites with their own engines during the session. Each run records the 1-minute load average at its start and end. |

## Pin

`pob-pin.json`: repo `PathOfBuildingCommunity/PathOfBuilding-PoE2`, tag `v0.23.1`, commit
`7d6f530cbdab20389ff8bc6ba97a37ac27f74e41`, version `0.23.1`, `headlessWrapperSha1`
`77a3e3a9b7387ebc57ef0a35bb17c382282e3c7c`. Fetched into the lane with `mise run pob:fetch`.

## Method

- **Harness.** The probe (appendix) is a Jest file in a `mktemp -d` directory. It runs from that
  directory with a Jest config whose `roots` point there and which reuses the repo's ts-jest transform and
  C-18 global setup, so cookies are scrubbed and `fetch` is disabled. `POB_DIRECTORY`, `XDG_STATE_HOME` and
  `POB_GUIDES_DIRECTORY` are temp dirs, and `luajit` comes from the checkout's mise. It drives a real engine
  through `tests/helpers/luaLineClient.ts`, the repo's raw line client, with `POB_API_TEST_ACTIONS=1`, so
  each request crosses the TS↔Lua seam as one JSON line each way.
- **Requests.** A compile is one engine request per stage plus a fixed overhead of five (D-221). The probe
  sends exactly that sequence:
  1. `compile_check`, as one `__test_eval` (C-2's test-only eval action). This is the read-only preflight
     of C-41 step 5. It receives the whole plan as JSON and checks every gem name (`resolve_gem`) and every
     item text (`add_item_text` with `validateOnly`). It also checks that every node exists, that every
     node connects under PoB's weapon-set rule (`CanPathThroughAllocMode`: an untagged node through
     untagged nodes only, a node tagged with set n also through nodes tagged n), every attribute choice and
     jewel socket, every config option and list value, and the main group. It builds the config baseline
     from the defaults loop over `ConfigOptions`. The producer lookup that WU-42 adds is not emulated.
  2. `new_build`, the real action, for Warrior / Titan.
  3. 15 × `compile_stage`, each one `__test_eval` that decodes its stage from JSON and follows spike S-a's
     recipe (grounding `2026-10-07-pob-pin-and-spikes.md` §C) in C-41 step 7's order:
     - **Tree.** Stage 1 retitles spec 1. Later stages call `BuildOps.create_spec`. Then
       `SwitchAttributeNode` sets the attribute choices and `ImportFromNodeList` imports the nodes with
       their weapon-set tags.
     - **Items.** Stage 1 retitles item set 1. Later stages call `NewItemSet`, then `SetActiveItemSet`.
       Tree jewels and the 18 items each go in through `BuildOps.add_item_text`.
     - **Toggles.** Five `BuildOps.set_flask_active` calls, then `useSecondWeaponSet`.
     - **Skills.** Stage 1 retitles skill set 1. Later stages call `NewSkillSet`. Each group is a
       `BuildOps.create_socket_group` call, and each gem a `BuildOps.add_gem` call.
     - **Main selection.** `BuildOps.set_main_selection`, plus the stat set through
       `srcInstance.statSet` (C-44).
     - **Config and level.** Stage 1 retitles config set 1. Later stages call `NewConfigSet`. Then one
       `BuildOps.set_config` call with every listed option and `BuildOps.set_level` in manual mode.

     After the build, each stage request does what C-41's reply needs:
     - one measurement, every finite numeric scalar of `mainOutput` (639–657 per stage);
     - the per-skill breakdown that `lua_get_stats` gains in C-45. For every active skill and stat set
       (17 pairs per stage), it selects the pair, rebuilds and reads the offense fields. Then it restores
       `mainSocketGroup`, every `mainActiveSkill`, every touched `srcInstance.statSet` and `skill_number`,
       and rebuilds;
     - one `RefreshStatList`, through `BuildOps.get_warnings`;
     - the reads for V1 and V2: allocation with tags, `CountAllocNodes`, attributes and requirements, gem
       tiers and level requirements, item levels and names, warnings, node, skill and slot names, and the
       config set's `input` and `placeholder` tables.

     Requests are 16–18 KB and replies 100–106 KB.
  4. `compile_finish`, one `__test_eval`. It runs `SyncLoadouts`, checks that there are 15 loadouts and
     that each stage's loadout resolves to exactly that stage's four sets, selects the level-90 stage's
     loadout, and sets level 90 in auto mode.
  5. The export (`export_build_xml`, the real action). Then, in TS, the import-code encode
     (deflate + base64url) and the XML write.
  6. The session's snapshot (`export_build_xml` again).
- **Timing.** Each request is timed on the TS side with `performance.now()` around the round trip. The
  whole call runs from just before the plan JSON is built to just after the snapshot. Each stage also
  reports per-phase Lua CPU time (`os.clock`, because headless PoB's `GetTime` returns 0,
  `HeadlessWrapper.lua:103`) and counts every full output rebuild (`CalcsTab:BuildOutput`).
- **Runs.** Each run starts a fresh engine. It first makes one untimed generator call (below), which
  leaves the engine warm, as a server that has already served calls would be. Three runs make up the
  measured set. The request timeout is 120 s, so a slow stage would be recorded rather than cut at C-4's
  30 s; no stage came near 30 s.

## The synthetic plan

The spec's worst case, as built. The untimed generator call derives node lists, item bases and the config
baseline from the engine's own data, and the probe checks the result. Every stage's allocation after
import has the expected counts, and `compile_check` reports no defects. [V]

| Axis | Spec | Built |
|---|---|---|
| Stages | 15, levels 2 to 90 | Levels 2, 8, 14, 20, 26, 32, 38, 44, 50, 56, 62, 68, 74, 82, 90. Loadout names `Stage <n> (L<level>) {<n>}`. |
| Set sharing | none | 15 tree specs and 15 item, skill and config sets. Stage 1 uses the new build's spec 1 and set 1 of each kind, retitled. |
| Tree | grows to 123 regular points, 24 weapon-set tags, 8 ascendancy nodes | Class Warrior, ascendancy Titan. At level 90 the tree has 123 untagged nodes, plus 12 nodes tagged weapon set 1 and 12 tagged set 2, and 8 Titan nodes. Smaller stages scale with the level, and ascendancy nodes come in 2, 4, 6, 8 from levels 20, 38, 56, 74. Every attribute node gets an attribute choice. |
| Items | every `ITEM_SLOTS` slot filled at endgame | All 18 `ITEM_SLOTS` (both weapon sets, Ring 3, three charms, two flasks) at **every** stage. Rares on the highest base each stage's level allows; flasks and charms normal. All five flask and charm toggles on. |
| Tree jewels | (not named) | The paths to the four jewel sockets nearest the start are spliced into the tree's growth, so stages 4–15 socket 1–4 rare jewels. |
| Skills | 6 socket groups of up to 6 gems | 6 groups × 6 gems at **every** stage: Rolling Slam, Tempest Bell, Boneshatter, Earthquake, Blood Hunt and Herald of Ash, each with five supports drawn from Heavy Swing, Concentrated Area, Impact Shockwave, Ferocity, Ruthless, Bloodlust, Elemental Focus and Stomping Ground. That makes 17 (active skill, stat set) pairs per stage for the breakdown. |
| Config | as many writes as the fresh-set baseline has options on | 36 writes per stage: the 36 options that are on in a fresh config set (`resistancePenalty`, `enemyIsBoss`, nine quest rewards, …). Each is written with its default, except `enemyIsBoss`, which is `None`, `Boss` or `Pinnacle` by level. |
| Full DPS | (not named) | Off, because the plan schema (C-31) has no Full DPS field and `create_socket_group` defaults it off. Every group in Full DPS was measured separately, as a sensitivity bound. |

Where the spec was open, every choice above is the heavier one. That covers 147 non-ascendancy nodes
rather than 123, full slots and full groups at every stage rather than at endgame only, a persistent buff,
and tree jewels.

## Results: the three measured runs

Full DPS off, S-a's calls as written. The probe is exactly the source in the appendix.

### Per-stage request times

| Stage | Level | Nodes: untagged / set 1 / set 2 / ascendancy | Tree jewels | Output rebuilds | Run 1 (s) | Run 2 (s) | Run 3 (s) | Median (s) | Max (s) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2 | 1 / 0 / 0 / 0 | 0 | 87 | 1.24 | 0.99 | 0.85 | 0.99 | 1.24 |
| 2 | 8 | 10 / 1 / 1 / 0 | 0 | 87 | 1.75 | 1.44 | 1.32 | 1.44 | 1.75 |
| 3 | 14 | 18 / 2 / 2 / 0 | 0 | 87 | 2.19 | 1.50 | 1.33 | 1.50 | 2.19 |
| 4 | 20 | 26 / 3 / 2 / 2 | 1 | 88 | 3.10 | 1.07 | 1.19 | 1.19 | 3.10 |
| 5 | 26 | 35 / 4 / 3 / 2 | 1 | 88 | 2.96 | 1.69 | 1.62 | 1.69 | 2.96 |
| 6 | 32 | 43 / 4 / 4 / 2 | 1 | 88 | 2.24 | 1.71 | 1.28 | 1.71 | 2.24 |
| 7 | 38 | 51 / 5 / 5 / 4 | 1 | 88 | 1.76 | 1.23 | 1.83 | 1.76 | 1.83 |
| 8 | 44 | 59 / 6 / 6 / 4 | 2 | 89 | 2.37 | 1.94 | 1.91 | 1.94 | 2.37 |
| 9 | 50 | 68 / 7 / 6 / 4 | 2 | 89 | 2.48 | 2.20 | 1.30 | 2.20 | 2.48 |
| 10 | 56 | 76 / 8 / 7 / 6 | 2 | 89 | 1.36 | 1.59 | 1.99 | 1.59 | 1.99 |
| 11 | 62 | 84 / 8 / 8 / 6 | 2 | 89 | 2.05 | 2.18 | 2.20 | 2.18 | 2.20 |
| 12 | 68 | 93 / 9 / 9 / 6 | 3 | 90 | 2.43 | 1.54 | 1.61 | 1.61 | 2.43 |
| 13 | 74 | 101 / 10 / 10 / 8 | 3 | 90 | 1.86 | 2.22 | 2.44 | 2.22 | 2.44 |
| 14 | 82 | 112 / 11 / 11 / 8 | 4 | 91 | 2.49 | 2.51 | 1.85 | 2.49 | 2.51 |
| 15 | 90 | 123 / 12 / 12 / 8 | 4 | 91 | 2.09 | 1.70 | 2.47 | 2.09 | 2.47 |

Slowest stage request across the three runs: **3.10 s** (limit < 20 s). [V]

### Per-run times

| Request | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| `compile_check` (preflight) | 385 ms | 392 ms | 391 ms |
| `new_build` | 107 ms | 102 ms | 107 ms |
| 15 × `compile_stage`, sum | 32.40 s | 25.50 s | 25.18 s |
| slowest `compile_stage` | 3.10 s (stage 4) | 2.51 s (stage 14) | 2.47 s (stage 15) |
| `compile_finish` | 102 ms | 16 ms | 16 ms |
| export (`export_build_xml`) | 445 ms | 58 ms | 60 ms |
| import-code encode and XML write (TS) | 2.4 ms | 1.6 ms | 1.6 ms |
| snapshot (`export_build_xml`) | 125 ms | 55 ms | 54 ms |
| **whole call** | **33.58 s** | **26.14 s** | **25.82 s** |
| 1-minute load average, start → end | 2.1 → 7.4 | 7.4 → 5.5 | 5.5 → 4.4 |
| compiled XML | 337 KiB, 15 loadouts | 337 KiB, 15 loadouts | 337 KiB, 15 loadouts |

Slowest whole call: **33.58 s** (limit ≤ 100 s). [V]

### Where the time goes

- **Output rebuilds are about 85% of stage time.** [V] Each `BuildOps` mutation call (`add_item_text`,
  `set_flask_active`, `create_socket_group`, `add_gem`, `set_main_selection`, `set_config`, `set_level`)
  ends with a full `CalcsTab:BuildOutput`. Each of those runs PoB's calcs twice, for the MAIN and CALCS
  environments (`Classes/CalcsTab.lua:484-487`), and each pass includes the Full DPS pass over every
  Full-DPS group (`Modules/Calcs.lua:516`). A stage built with S-a's calls makes 87–91 rebuilds: 18 items,
  0–4 jewels, 5 toggles, 6 groups, 36 gems, the main selection, config, level, 17 breakdown pairs, the
  breakdown's restore, and `get_warnings`. At level 90 the rebuilds took 1.33–1.97 s of a 1.70–2.47 s
  request.
- **The fixed overhead of five requests takes about a second or less together** (0.62–1.16 s). Most of
  that is `compile_check` at about 0.4 s.
- **Lua phases at level 90 (CPU seconds, three runs):** items 0.62–1.36, skills 0.57–0.58, breakdown
  0.24–0.52, toggles 0.08, tree 0.06–0.08, `RefreshStatList` 0.01–0.09, config and level 0.03–0.04, the
  measurement and the V1/V2 reads under 0.01.

## Sensitivity and margin

All runs were made with the same probe, using the `WU30_MODE` and `WU30_FULLDPS` switches in the appendix.
The four variants were measured back to back on a quiet machine (1-minute load 1.2–7.4):

| Variant | Run 1 | Run 2 | Run 3 | Slowest stage |
|---|---|---|---|---|
| **Measured plan:** Full DPS off, S-a's calls as written | 33.58 s | 26.14 s | 25.82 s | 3.10 s |
| Every group in Full DPS, S-a's calls as written | 89.16 s | 84.27 s | 81.46 s | 7.63 s |
| Full DPS off, per-call rebuilds deferred | 8.95 s | 9.92 s | 8.97 s | 1.42 s |
| Every group in Full DPS, per-call rebuilds deferred | 28.42 s | 28.87 s | 30.30 s | 2.72 s |

- **Full DPS is the axis that eats the margin.** With all six groups in Full DPS, every rebuild also
  calculates six skills in each of its two passes. The whole call then runs at 81–89 s, still inside
  100 s but with only an 11–19% margin. The plan schema can't put a group in Full DPS, so this is a bound,
  not the measured case. [V] Every run labelled "every group in Full DPS" put all six groups in Full DPS.
  The only other setting tried was the first trial's group 1, listed below. `create_socket_group` sets the
  flag only when asked (`includeInFullDPS = params.includeInFullDPS == true`, `pob-api/API/BuildOps.lua:736`),
  so the measured case holds only if the compiler creates every group with `includeInFullDPS=false`.
- **Load from the other build lanes inflates the times by up to about 2×.** These runs were made earlier
  in the session while other lanes ran engine suites. The probe was the same except for the compiled
  XML's file name and how it imports the line client.
  - Measured plan: 30.06, 48.30 and 34.17 s (slowest stage 7.13 s, load rising to 19.3), and 23.93 s once
    more.
  - Every group in Full DPS: 94.12 and 92.03 s, then **160.68 s with a 25.50 s stage** while the load rose
    from 5.3 to 23.6, and an earlier single run of 84.95 s.
  - A first trial of a lighter shape (no tree jewels, Perfect Strike in place of Herald of Ash, Full DPS on
    group 1 only): 49.65 s, slowest stage 5.04 s, at a load of 19–30.

  That one contended run would miss D-229. It is the Full DPS bound under contention, not the specified
  plan. Every run of the specified plan, contended or not, passed with at least a 2× margin. [V]
- **Deferring the per-call rebuilds cuts a compile about 3×, and the saved file is canonically identical.** The
  deferred variant makes the same calls, but `BuildOps`' rebuild is a no-op while the stage's jewels,
  items, toggles, groups and gems go in. One rebuild then runs before the main selection, which needs
  `displaySkillList`. That leaves 22 rebuilds per stage. In all six run pairs (three with Full DPS off,
  three with it on), the deferred and the as-written compiles saved a canonically identical file. The
  comparison script, `xmlcmp.py` in the appendix, sorts attributes, child elements and node lists, because
  PoB's `SaveDB` order varies between processes (S-2). [V] The comparison has limits:
  - It covers the saved file only: every stage's inputs, plus the 102 `PlayerStat` values of the active
    level-90 loadout.
  - It does not compare each stage's `outputs` or `skillOutputs` replies.
  - It is evidence for the lever, not proof that per-stage measurements are unchanged.

## Decision

AC-P2's rule asks whether every run's whole call is ≤ 100 s and every stage request < 20 s. The measured
runs give 25.82–33.58 s whole and at most 3.10 s per stage. Every other run of the specified plan in this
session, including those under load, stayed at or under 48.30 s whole and 7.13 s per stage. **The pass mark
(D-229) holds, so S1 is confirmed (A-P8).**

- A final `compile_plan` compiles the whole plan in one call, under one session lock.
- `stages` subsets are accepted only by `guide_run` validate and by `compile_plan` measure-only.
- No incremental compile scheme is needed, and HG-13 does not fire.

## Notes for WU-41 (not decisions)

- **Consider deferring the rebuilds in `compile_stage`.** If `compile_stage` calls `BuildOps` as S-a does,
  it makes 87–91 rebuilds per stage. Skipping them while inserting items, jewels, toggles, groups and gems,
  with one rebuild before the main selection, saved a canonically identical file here at a third of the
  time. If WU-41 defers the rebuilds, it must show on the fixture that each stage's `outputs` and
  `skillOutputs` equal those of the non-deferred path. This spike compared only the saved file. Deferring
  would also keep NFR-20 (15 stages ≤ 100 s) and NFR-21 (each stage < 20 s) robust if Full DPS ever
  entered the plan, for example by mapping the group `role` to Full DPS.
- **Create every group with `includeInFullDPS=false`.** The plan schema (C-31) has no Full DPS field, and
  `create_socket_group` sets the flag only when asked (`pob-api/API/BuildOps.lua:736`). The pass mark was
  measured with Full DPS off; with every group in Full DPS the margin shrinks to 11–19%.
- **Run the NFR-20/21 tests alone,** as the spine places them, in `mise run test`'s `--runInBand` step.
  Contention from parallel suites inflated timings by up to about 2× in this session.
- **Empty Lua tables encode as `[]`.** dkjson writes an empty Lua table that way, for example a stage's
  weapon-set tags at level 2. The reply schemas must accept `[]` where they expect an empty map.
- **Ring 3 accepts an item.** `add_item_text` with `slotName = "Ring 3"` equips an item there with no
  extra-ring modifier, so all 18 `ITEM_SLOTS` can be filled. [V]

## Appendix: probe source

Three files in a `mktemp -d` directory, plus the XML comparison script `xmlcmp.py`. Run `./run.sh` there; `WU30_REPO` names the checkout, which needs
`mise trust`, `pnpm install` and `mise run pob:fetch` first. Defaults: `WU30_RUNS=3`, `WU30_MODE=recipe`,
`WU30_FULLDPS=none`. The measured set is the defaults.

### `run.sh`

```bash
#!/usr/bin/env bash
# Runs the WU-30 probe from this temp dir: temp builds, state and guides folders; luajit from the checkout's mise.
# Env: WU30_REPO (checkout), WU30_RUNS (default 3), WU30_MODE (recipe|deferred), WU30_FULLDPS (none|all), WU30_OUT.
set -euo pipefail
cd "$(dirname "$0")"
export WU30_REPO="${WU30_REPO:-/home/parker/projects/pob2-mcp-wt/bg-30}"
LJ=$(dirname "$(cd "$WU30_REPO" && mise which luajit)")
mkdir -p builds state guides
export PATH="$LJ:$PATH" POB_DIRECTORY="$PWD/builds" XDG_STATE_HOME="$PWD/state" POB_GUIDES_DIRECTORY="$PWD/guides"
export WU30_RUNS="${WU30_RUNS:-3}" WU30_OUT="${WU30_OUT:-$PWD/results.json}"
exec node "$WU30_REPO/node_modules/jest/bin/jest.js" --config "$PWD/jest.config.cjs" --runInBand wu30.probe
```

### `jest.config.cjs`

```js
// Jest config for the WU-30 probe: the repo's ts-jest setup and C-18 global setup, with roots in this temp dir
// so the probe never lives in, or runs from, the repo. WU30_REPO names the checkout.
const W = process.env.WU30_REPO || '/home/parker/projects/pob2-mcp-wt/bg-30';
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
  testTimeout: 3600000,
};
```

### `wu30.probe.ts`

```ts
/**
 * WU-30 compile-time probe. Runs from a mktemp -d dir with temp POB_DIRECTORY, XDG_STATE_HOME and
 * POB_GUIDES_DIRECTORY, through the repo's luaLineClient (POB_API_TEST_ACTIONS=1), one engine request per
 * compile step: compile_check, new_build, one compile_stage per stage, compile_finish, export, snapshot.
 * Each step is a `__test_eval` payload (or the real action, for new_build and the two exports) that
 * follows spike S-a's recipe. Writes the timings to $WU30_OUT. Run it with run.sh (WU30_REPO names the checkout).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { performance } from 'perf_hooks';
import { startLuaLineClient, type LuaLineClient, type Json } from '@repo/tests/helpers/luaLineClient';

const RUNS = Number(process.env.WU30_RUNS ?? '3');
/** 'recipe': S-a's calls as they are, each BuildOps mutation rebuilding the output. 'deferred': the same calls with
 * the per-call rebuilds skipped while the stage's items, toggles and skills go in (a margin probe for WU-41). */
const MODE = process.env.WU30_MODE === 'deferred' ? 'deferred' : 'recipe';
/** Full DPS: the plan schema has no such field and create_socket_group defaults it off, so the compiled plan has
 * none ('none'). 'all' puts every group in Full DPS, a heavier bound the schema can't express (sensitivity only). */
const FULLDPS = process.env.WU30_FULLDPS === 'all' ? 'all' : 'none';
const OUT = process.env.WU30_OUT ?? path.join(__dirname, 'results.json');
const REQ_TIMEOUT_MS = 120_000; // generous on purpose: the probe records a slow stage instead of cutting it at C-4's 30 s
const LEVELS = [2, 8, 14, 20, 26, 32, 38, 44, 50, 56, 62, 68, 74, 82, 90];
const ACTIVES = ['Rolling Slam', 'Tempest Bell', 'Boneshatter', 'Earthquake', 'Blood Hunt', 'Herald of Ash'];
const SUPPORTS = ['Heavy Swing', 'Concentrated Area', 'Impact Shockwave', 'Ferocity', 'Ruthless', 'Bloodlust',
  'Elemental Focus', 'Stomping Ground'];
const ITEM_SLOTS = ['Weapon 1', 'Weapon 1 Swap', 'Weapon 2', 'Weapon 2 Swap', 'Helmet', 'Body Armour', 'Gloves', 'Boots',
  'Amulet', 'Ring 1', 'Ring 2', 'Ring 3', 'Belt', 'Charm 1', 'Charm 2', 'Charm 3', 'Flask 1', 'Flask 2'];
const SLOT_KIND: Record<string, string> = {
  'Weapon 1': 'mace', 'Weapon 1 Swap': 'mace', 'Weapon 2': 'shield', 'Weapon 2 Swap': 'shield', Helmet: 'helmet',
  'Body Armour': 'body', Gloves: 'gloves', Boots: 'boots', Amulet: 'amulet', 'Ring 1': 'ring', 'Ring 2': 'ring',
  'Ring 3': 'ring', Belt: 'belt', 'Charm 1': 'charm', 'Charm 2': 'charm', 'Charm 3': 'charm', 'Flask 1': 'life',
  'Flask 2': 'mana',
};
const TOGGLES = ['Flask 1', 'Flask 2', 'Charm 1', 'Charm 2', 'Charm 3'];
/** Positions in the regular-node order where the paths to the four nearest tree jewel sockets are spliced in. */
const SOCKET_AT = [20, 50, 80, 105];

/** Tree size at a level: 123 regular points, 24 weapon-set tags (12 per set) and 8 ascendancy nodes at 90. */
function treeShape(level: number) {
  const f = (level - 1) / 89;
  const tags = Math.round(24 * f);
  return {
    regular: Math.max(1, Math.round(123 * f)),
    tag1: Math.ceil(tags / 2),
    tag2: Math.floor(tags / 2),
    asc: level >= 74 ? 8 : level >= 56 ? 6 : level >= 38 ? 4 : level >= 20 ? 2 : 0,
  };
}

const lua = (body: string, data?: unknown) =>
  (data === undefined ? '' : `local DATA = require('dkjson').decode([==[${JSON.stringify(data)}]==])\n`) + body;

// ---- Generator (untimed): tree pools, item bases, config baseline, from the engine's own data. ----
const GEN = String.raw`
local B = require('API.BuildOps')
local r = B.new_build({className = 'Warrior', ascendancy = 'Titan'})
local spec = build.spec
local tree = spec.tree
local classId, ascId = spec.curClassId, spec.curAscendClassId
local startId = tree.classes[classId].startNodeId
local ascName = spec.curAscendClassName
local ascStartId = tree.ascendNameMap[ascName].ascendClass.startNodeId
local function regularOk(n)
  return n and not n.ascendancyName and (n.type == 'Normal' or n.type == 'Notable' or n.type == 'Keystone' or n.type == 'Socket')
    and not n.isOnlyImage and not n.isFreeAllocate and not n.isProxy and not n.expansionJewel
end
local function taggable(n) return (n.type == 'Normal' or n.type == 'Notable') and not n.containJewelSocket end
local function sortedLinks(n) local t = {} for _, o in ipairs(n.linked) do t[#t + 1] = o.id end table.sort(t) return t end
local bfs, parent, seen, queue, qi = {}, {}, { [startId] = true }, { startId }, 1
while qi <= #queue do
  local id = queue[qi]; qi = qi + 1
  for _, oid in ipairs(sortedLinks(spec.nodes[id])) do
    if not seen[oid] and regularOk(spec.nodes[oid]) then
      seen[oid] = true; parent[oid] = id; queue[#queue + 1] = oid; bfs[#bfs + 1] = oid
    end
  end
end
-- The regular-node order: BFS from the class start, with the path to the k-th nearest jewel socket spliced in
-- once the order reaches DATA.socketAt[k], so tree jewels arrive as the tree grows. Every prefix is connected.
local socketIds = {}
for _, id in ipairs(bfs) do if spec.nodes[id].type == 'Socket' then socketIds[#socketIds + 1] = id end end
local order, inOrder, k = {}, {}, 1
local function add(id) if not inOrder[id] then inOrder[id] = true; order[#order + 1] = id end end
local function addPath(id)
  local chain, cur = {}, id
  while cur and cur ~= startId and not inOrder[cur] do chain[#chain + 1] = cur; cur = parent[cur] end
  for i = #chain, 1, -1 do add(chain[i]) end
end
for _, id in ipairs(bfs) do
  while k <= #DATA.socketAt and #order >= DATA.socketAt[k] and socketIds[k] do addPath(socketIds[k]); k = k + 1 end
  add(id)
end
local ascOrder, aseen, aq, ai = {}, { [ascStartId] = true }, { ascStartId }, 1
while ai <= #aq do
  local id = aq[ai]; ai = ai + 1
  for _, oid in ipairs(sortedLinks(spec.nodes[id])) do
    local o = spec.nodes[oid]
    if not aseen[oid] and o.ascendancyName == ascName and o.type ~= 'AscendClassStart' and not o.isMultipleChoiceOption
        and not o.isMultipleChoice then
      aseen[oid] = true; aq[#aq + 1] = oid; ascOrder[#ascOrder + 1] = oid
    end
  end
end
local stages = {}
for si, sh in ipairs(DATA.shapes) do
  local inUntagged, nodes, tagged, ws, attrs, sockets = {}, {}, {}, {}, {}, {}
  for i = 1, sh.regular do inUntagged[order[i]] = true; nodes[#nodes + 1] = order[i] end
  for s = 1, 2 do
    local want, got, progress = (s == 1) and sh.tag1 or sh.tag2, 0, true
    while got < want and progress do
      progress = false
      for i = sh.regular + 1, #order do
        local id = order[i]
        if not tagged[id] and taggable(spec.nodes[id]) then
          local ok = false
          for _, o in ipairs(spec.nodes[id].linked) do
            if o.id == startId or inUntagged[o.id] or tagged[o.id] == s then ok = true break end
          end
          if ok then tagged[id] = s; nodes[#nodes + 1] = id; ws[tostring(id)] = s; got = got + 1; progress = true; break end
        end
      end
    end
    if got < want then error('could not place weapon-set tags for stage ' .. si) end
  end
  for i = 1, sh.asc do nodes[#nodes + 1] = ascOrder[i] end
  local k = 0
  for _, id in ipairs(nodes) do
    local n = spec.nodes[id]
    if n.isAttribute then k = k + 1; attrs[tostring(id)] = (k % 3) + 1 end
    if n.type == 'Socket' then sockets[#sockets + 1] = id end
  end
  stages[si] = { nodes = nodes, weaponSets = ws, attributes = attrs, sockets = sockets }
end
-- Item bases by kind, with their level requirement.
local kinds = {
  mace = function(b) return b.type == 'One Hand Mace' end,
  shield = function(b) return b.type == 'Shield' and b.subType == 'Armour' end,
  helmet = function(b) return b.type == 'Helmet' and b.subType == 'Armour' end,
  body = function(b) return b.type == 'Body Armour' and b.subType == 'Armour' end,
  gloves = function(b) return b.type == 'Gloves' and b.subType == 'Armour' end,
  boots = function(b) return b.type == 'Boots' and b.subType == 'Armour' end,
  amulet = function(b) return b.type == 'Amulet' end,
  ring = function(b) return b.type == 'Ring' end,
  belt = function(b) return b.type == 'Belt' end,
  charm = function(b) return b.type == 'Charm' end,
  life = function(b) return b.type == 'Flask' and b.subType == 'Life' end,
  mana = function(b) return b.type == 'Flask' and b.subType == 'Mana' end,
  jewel = function(b) return b.type == 'Jewel' and b.subType == nil end,
}
local bases = {}
for kind, pred in pairs(kinds) do
  local list = {}
  for name, b in pairs(build.data.itemBases) do
    if pred(b) and not name:find('Unique', 1, true) and not b.hidden then
      list[#list + 1] = { name = name, level = (b.req and b.req.level) or 0 }
    end
  end
  table.sort(list, function(a, b2) if a.level ~= b2.level then return a.level < b2.level end return a.name < b2.name end)
  bases[kind] = list
end
-- The fresh-set baseline: options whose default is on (true, non-zero, or a list value other than the first).
local ok, varList = pcall(LoadModule, 'Modules/ConfigOptions')
local configOn, seenVar = {}, {}
for _, v in ipairs(varList) do
  if v.var and not seenVar[v.var] then
    seenVar[v.var] = true
    local d = v.defaultState
    if v.defaultIndex then d = v.list[v.defaultIndex].val end
    local first = v.list and v.list[1] and v.list[1].val
    if d == true or (type(d) == 'number' and d ~= 0) or (v.type == 'list' and d ~= nil and d ~= first) then
      configOn[#configOn + 1] = { var = v.var, value = d, type = v.type }
    end
  end
end
return { classId = classId, ascendClassId = ascId, className = spec.curClassName, ascendClassName = ascName,
  startId = startId, ascStartId = ascStartId, stages = stages, bases = bases, configOn = configOn }
`;

// ---- compile_check (read-only preflight): gems, item text, nodes and connectivity, attribute choices, config. ----
const CHECK = String.raw`
local B = require('API.BuildOps')
local construct = require('API.Util').construct
local tree = main:LoadTree(latestTreeVersion)
local nodesT = tree.nodes
local ok, varList = pcall(LoadModule, 'Modules/ConfigOptions')
local byVar, baseline, nBaseline = {}, {}, 0
for _, v in ipairs(varList) do
  if v.var and not byVar[v.var] then
    byVar[v.var] = v
    local d = v.defaultState
    if v.defaultIndex then d = v.list[v.defaultIndex].val end
    baseline[v.var] = { type = v.type, apply = v.apply ~= nil, default = d, placeholder = v.defaultPlaceholderState,
      first = v.list and v.list[1] and v.list[1].val }
    nBaseline = nBaseline + 1
  end
end
local defects = {}
local function defect(st, msg) defects[#defects + 1] = 'stage ' .. st.id .. ': ' .. msg end
for _, st in ipairs(DATA.stages) do
  for _, grp in ipairs(st.groups) do
    for _, gem in ipairs(grp.gems) do
      local g, e = B.resolve_gem(gem.name)
      if not g then defect(st, e) end
    end
  end
  for _, it in ipairs(st.items) do
    local r, e = B.add_item_text({ text = it.text, validateOnly = true })
    if not r then defect(st, it.slot .. ': ' .. tostring(e)) end
  end
  for _, j in ipairs(st.jewels) do
    local okJ, item = pcall(construct, 'Item', j.text)
    if not okJ or not item or not item.baseName then defect(st, 'jewel ' .. j.node .. ' does not parse') end
    local n = nodesT[j.node]
    if not n or not n.isJewelSocket then defect(st, 'jewel node ' .. j.node .. ' is not a jewel socket') end
  end
  local mode = {}
  for _, id in ipairs(st.nodes) do
    if not nodesT[id] then defect(st, 'unknown node ' .. id) end
    mode[id] = st.weaponSets[tostring(id)] or 0
  end
  for id, choice in pairs(st.attributes) do
    local n = nodesT[tonumber(id)]
    if not n or not n.isAttribute then defect(st, 'attribute choice on ' .. id) end
  end
  local function reach(seeds, allow)
    local seen, q, qi = {}, {}, 1
    for _, s in ipairs(seeds) do q[#q + 1] = s; seen[s] = true end
    while qi <= #q do
      local id = q[qi]; qi = qi + 1
      for _, oid in ipairs(nodesT[id].linkedId or {}) do
        if not seen[oid] and mode[oid] ~= nil and allow(mode[oid]) then seen[oid] = true; q[#q + 1] = oid end
      end
    end
    return seen
  end
  local r0 = reach({ DATA.startId, DATA.ascStartId }, function(m) return m == 0 end)
  local r1 = reach({ DATA.startId }, function(m) return m == 0 or m == 1 end)
  local r2 = reach({ DATA.startId }, function(m) return m == 0 or m == 2 end)
  for id, m in pairs(mode) do
    if (m == 0 and not r0[id]) or (m == 1 and not r1[id]) or (m == 2 and not r2[id]) then
      defect(st, 'node ' .. id .. ' is not connected')
    end
  end
  for var, value in pairs(st.config) do
    local v = byVar[var]
    if not v then defect(st, 'unknown config option ' .. var)
    elseif v.type == 'list' then
      local found = false
      for _, e in ipairs(v.list) do if tostring(e.val) == tostring(value) then found = true end end
      if not found then defect(st, 'bad value for ' .. var) end
    end
  end
  if st.main.group > #st.groups then defect(st, 'main group out of range') end
end
return { defects = defects, baselineOptions = nBaseline }
`;

// ---- compile_stage: S-a's recipe for one stage, then the measurement, the C-45 breakdown, RefreshStatList and V1/V2 reads. ----
const STAGE = String.raw`
local B = require('API.BuildOps')
local st = DATA
local ct = build.calcsTab
local nRecalc, tRecalc = 0, 0
local orig = ct.BuildOutput
ct.BuildOutput = function(self) local c = os.clock(); orig(self); nRecalc = nRecalc + 1; tRecalc = tRecalc + (os.clock() - c) end
local realGMO = B.get_main_output
local phases, c0 = {}, os.clock()
local function mark(name) local c = os.clock(); phases[name] = (phases[name] or 0) + (c - c0); c0 = c end
local function must(r, e, what) if not r then error((what or 'call') .. ': ' .. tostring(e)) end return r end
local function finite(v) return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge end
local okRun, result = pcall(function()
  -- 1. Tree spec: stage 1 retitles spec 1, every other stage gets a new spec (never CopyLoadout).
  local treeTab = build.treeTab
  local specId
  if st.first then
    specId = 1
    treeTab.specList[1].title = st.title
    if treeTab.activeSpec ~= 1 then treeTab:SetActiveSpec(1) end
  else
    specId = must(B.create_spec({ title = st.title, activate = true }), nil, 'create_spec').index
  end
  local spec = build.spec
  spec.hashOverrides = {}
  for id, choice in pairs(st.attributes) do spec:SwitchAttributeNode(tonumber(id), choice) end
  local ws = {}
  for id, s in pairs(st.weaponSets) do ws[tonumber(id)] = s end
  spec:ImportFromNodeList(nil, st.classId, st.ascendClassId, 0, st.nodes, ws, copyTable(spec.hashOverrides, true), {}, nil)
  spec:AddUndoState()
  build.buildFlag = true
  mark('tree')
  -- 2. Item set: stage 1 retitles set 1, others NewItemSet; then the jewels and the items (add_item_text).
  local itemsTab = build.itemsTab
  local itemSetId
  if st.first then
    itemSetId = itemsTab.itemSetOrderList[1]
    itemsTab.itemSets[itemSetId].title = st.title
  else
    itemSetId = itemsTab:NewItemSet(#itemsTab.itemSets + 1, st.title).id
  end
  itemsTab:SetActiveItemSet(itemSetId, true)
  if st.deferRecalc then B.get_main_output = function() return ct.mainOutput end end
  for _, j in ipairs(st.jewels) do must(B.add_item_text({ text = j.text, slotName = 'Jewel ' .. j.node }), nil, 'jewel ' .. j.node) end
  for _, it in ipairs(st.items) do
    local r, e = B.add_item_text({ text = it.text, slotName = it.slot })
    must(r, e, 'item ' .. it.slot)
  end
  mark('items')
  for _, slot in ipairs(st.toggles) do must(B.set_flask_active({ slot = slot, active = true })) end
  itemsTab.activeItemSet.useSecondWeaponSet = st.useSecondWeaponSet
  mark('toggles')
  -- 3. Skill set and the groups and gems.
  local skillsTab = build.skillsTab
  local skillSetId
  if st.first then
    skillSetId = skillsTab.skillSetOrderList[1]
    skillsTab.skillSets[skillSetId].title = st.title
  else
    skillSetId = skillsTab:NewSkillSet(#skillsTab.skillSets + 1, st.title).id
  end
  skillsTab:SetActiveSkillSet(skillSetId, true)
  for gi, grp in ipairs(st.groups) do
    must(B.create_socket_group({ label = grp.label, enabled = true, includeInFullDPS = grp.fullDps }))
    for _, gem in ipairs(grp.gems) do
      local r, e = B.add_gem({ groupIndex = gi, gemName = gem.name, level = gem.level, quality = gem.quality })
      must(r, e, 'gem ' .. gem.name)
    end
  end
  B.get_main_output = realGMO
  mark('skills')
  -- 4. Main selection (group, active skill, stat set: C-44).
  must(B.set_main_selection({ mainSocketGroup = st.main.group, mainActiveSkill = st.main.skill }))
  local mg = skillsTab.socketGroupList[st.main.group]
  local dsk = mg.displaySkillList and mg.displaySkillList[st.main.skill]
  if dsk then
    local src = dsk.activeEffect.srcInstance
    src.statSet = src.statSet or {}
    src.statSet[dsk.activeEffect.grantedEffect.id] = st.main.statSet
  end
  mark('main')
  -- 5. Config set and every listed option, then the level (manual mode), which recalculates.
  local configTab = build.configTab
  local configSetId
  if st.first then
    configSetId = configTab.configSetOrderList[1]
    configTab.configSets[configSetId].title = st.title
  else
    configSetId = configTab:NewConfigSet(#configTab.configSets + 1, st.title).id
  end
  configTab:SetActiveConfigSet(configSetId, false, true)
  must(B.set_config(st.config))
  must(B.set_level(st.level))
  mark('config+level')
  -- 6. One measurement: every finite numeric scalar of mainOutput.
  local outputs = {}
  for k, v in pairs(ct.mainOutput) do if finite(v) then outputs[k] = v end end
  mark('measure')
  -- 7. The C-45 breakdown over every active skill and stat set, then the exact restore.
  local function offense(k) return k:find('DPS') or k:find('Damage') or k:find('Speed') or k:find('Crit') or k:find('Hit')
    or k:find('Accuracy') or k:find('Cost$') end
  local groups = skillsTab.socketGroupList
  local saved = { main = build.mainSocketGroup, skillNumber = ct.input.skill_number, mas = {}, statSets = {} }
  for gi, g in ipairs(groups) do saved.mas[gi] = g.mainActiveSkill end
  local skillOutputs, nSkills = {}, 0
  for gi, g in ipairs(groups) do
    local count = g.displaySkillList and #g.displaySkillList or 0
    for si = 1, count do
      local cur = g.displaySkillList[si]
      if cur then
        local ge = cur.activeEffect.grantedEffect
        local nSets = (ge.statSets and #ge.statSets > 0) and #ge.statSets or 1
        for pi = 1, nSets do
          local now = g.displaySkillList[si]
          local src = now.activeEffect.srcInstance
          if saved.statSets[src] == nil then saved.statSets[src] = { had = src.statSet ~= nil, copy = src.statSet and copyTable(src.statSet) } end
          build.mainSocketGroup = gi
          g.mainActiveSkill = si
          src.statSet = src.statSet or {}
          src.statSet[ge.id] = pi
          ct.input.skill_number = gi
          ct:BuildOutput()
          local fields = {}
          for k, v in pairs(ct.mainOutput) do if finite(v) and offense(k) then fields[k] = v end end
          skillOutputs['g' .. gi .. 's' .. si .. 'p' .. pi] = { skill = ge.name,
            statSetLabel = ge.statSets and ge.statSets[pi] and ge.statSets[pi].label or '', fields = fields }
          nSkills = nSkills + 1
        end
      end
    end
  end
  build.mainSocketGroup = saved.main
  for gi, g in ipairs(groups) do g.mainActiveSkill = saved.mas[gi] end
  for src, s in pairs(saved.statSets) do src.statSet = s.had and s.copy or nil end
  ct.input.skill_number = saved.skillNumber
  ct:BuildOutput()
  mark('breakdown')
  -- 8. One RefreshStatList (the get_warnings path).
  local warnings = must(B.get_warnings())
  mark('refreshStatList')
  -- 9. allocation, V1 and V2 inputs.
  local allocation = {}
  for id, n in pairs(spec.allocNodes) do allocation[#allocation + 1] = { id, n.allocMode or 0 } end
  local used, ascUsed, secUsed, sockets, ws1, ws2 = spec:CountAllocNodes()
  local out = ct.mainOutput
  local gems = {}
  for gi, g in ipairs(groups) do
    for _, gem in ipairs(g.gemList) do
      local gd = gem.gemData
      local lv = gd and gd.grantedEffect and gd.grantedEffect.levels and gd.grantedEffect.levels[gem.level]
      gems[#gems + 1] = { group = gi, name = gd and gd.name, tier = gd and gd.Tier,
        support = gd and gd.grantedEffect and gd.grantedEffect.support == true or false,
        levelRequirement = lv and lv.levelRequirement }
    end
  end
  local items, active = {}, {}
  for _, slotName in ipairs(DATA.slots) do
    local slot = itemsTab.slots[slotName]
    local item = slot and itemsTab.items[slot.selItemId]
    if item then items[slotName] = { name = item.name, level = item.requirements and item.requirements.level } end
    if slot and (slotName:match('^Flask') or slotName:match('^Charm')) then active[slotName] = slot.active == true end
  end
  local nodeNames = {}
  for id, n in pairs(spec.allocNodes) do nodeNames[#nodeNames + 1] = n.dn end
  local skillNames = {}
  for gi, g in ipairs(groups) do
    for _, d in ipairs(g.displaySkillList or {}) do skillNames[#skillNames + 1] = d.activeEffect.grantedEffect.name end
  end
  local cs = configTab.configSets[configSetId]
  local input, placeholder = {}, {}
  for k, v in pairs(cs.input) do if type(v) ~= 'table' then input[k] = v end end
  for k, v in pairs(cs.placeholder) do if type(v) ~= 'table' then placeholder[k] = v end end
  mark('reads')
  return {
    ids = { spec = specId, itemSet = itemSetId, skillSet = skillSetId, configSet = configSetId },
    allocation = allocation,
    counts = { used = used, asc = ascUsed, sockets = sockets, ws1 = ws1, ws2 = ws2 },
    outputs = outputs, skillOutputs = skillOutputs, nSkillStatSets = nSkills,
    v1 = { ExtraPoints = out.ExtraPoints, PassivePointsToWeaponSetPoints = out.PassivePointsToWeaponSetPoints,
      Str = out.Str, Dex = out.Dex, Int = out.Int, ReqStr = out.ReqStr, ReqDex = out.ReqDex, ReqInt = out.ReqInt,
      gems = gems, items = items, warnings = warnings.lines },
    v2 = { nodes = nodeNames, skills = skillNames, active = active, input = input, placeholder = placeholder },
  }
end)
ct.BuildOutput = nil
B.get_main_output = realGMO
if not okRun then error(result) end
result.phases = phases
result.recalcs = nRecalc
result.recalcSeconds = tRecalc
return result
`;

// ---- compile_finish: SyncLoadouts, the loadout check, the highest stage's loadout, auto level. ----
const FINISH = String.raw`
local B = require('API.BuildOps')
local c = os.clock()
build:SyncLoadouts()
local names = {}
for _, n in ipairs(build.controls.buildLoadouts.list) do
  if type(n) == 'string' and not n:match('^%^7%^7') and n ~= 'No Loadouts' then names[#names + 1] = n end
end
if #names ~= #DATA.stages then error('loadout count ' .. #names .. ' ~= stage count ' .. #DATA.stages) end
for _, st in ipairs(DATA.stages) do
  local lo = build:GetLoadoutByName(st.title)
  if not lo or lo.specId ~= st.ids.spec or lo.itemSetId ~= st.ids.itemSet or lo.skillSetId ~= st.ids.skillSet
      or lo.configSetId ~= st.ids.configSet then
    error('loadout ' .. st.title .. ' does not resolve to its four sets')
  end
end
build:SetActiveLoadout(build:GetLoadoutByName(DATA.active))
build.characterLevel = DATA.level
build.characterLevelAutoMode = true
local ctrl = build.controls and build.controls.characterLevel
if ctrl and ctrl.SetText then ctrl:SetText(DATA.level) end
build.configTab:BuildModList()
B.get_main_output()
return { loadouts = names, seconds = os.clock() - c }
`;

function itemText(slot: string, kind: string, base: string, stage: number, level: number): string {
  if (kind === 'life' || kind === 'mana' || kind === 'charm') {
    return `Rarity: NORMAL\n${base}\nQuality: +${Math.min(20, stage)}%`;
  }
  const lines = [`Rarity: RARE`, `Stage ${stage} ${slot}`, base, `Item Level: ${Math.min(82, level + 5)}`];
  if (kind === 'mace') {
    lines.push(`Adds ${1 + Math.floor(level / 5)} to ${3 + Math.floor(level / 3)} Physical Damage`,
      `${20 + level}% increased Physical Damage`, `+${10 + stage}% to Critical Damage Bonus`);
  }
  lines.push(`+${5 + level} to maximum Life`, `+${5 + Math.floor(level / 3)}% to Fire Resistance`,
    `+${5 + Math.floor(level / 3)}% to Cold Resistance`, `+${5 + Math.floor(level / 3)}% to Lightning Resistance`,
    `+${2 + Math.floor(level / 5)} to Strength`);
  return lines.join('\n');
}

function jewelText(base: string, stage: number, node: number): string {
  return [`Rarity: RARE`, `Stage ${stage} Jewel ${node}`, base, `${4 + stage}% increased Melee Damage`,
    `+${3 + stage} to Strength`, `${2 + Math.floor(stage / 2)}% increased maximum Life`].join('\n');
}

function pickBase(list: { name: string; level: number }[], level: number): string {
  let best = list[0];
  for (const b of list) if (b.level <= level) best = b;
  return best.name;
}

function buildPlan(gen: Json) {
  return LEVELS.map((level, i) => {
    const stage = i + 1;
    const g = gen.stages[i];
    const title = `Stage ${stage} (L${level}) {${stage}}`;
    const gemLevel = Math.min(20, Math.max(1, Math.ceil(level / 4.5)));
    const quality = level >= 60 ? 20 : 0;
    const config: Record<string, unknown> = {};
    for (const o of gen.configOn) config[o.var] = o.value;
    config.enemyIsBoss = level >= 74 ? 'Pinnacle' : level >= 38 ? 'Boss' : 'None';
    return {
      id: String(stage), first: stage === 1, level, title,
      classId: gen.classId, ascendClassId: gen.ascendClassId,
      nodes: g.nodes, weaponSets: g.weaponSets ?? {}, attributes: g.attributes ?? {},
      jewels: (g.sockets ?? []).map((node: number) => ({ node, text: jewelText(pickBase(gen.bases.jewel, level), stage, node) })),
      items: ITEM_SLOTS.map((slot) => ({ slot, text: itemText(slot, SLOT_KIND[slot], pickBase(gen.bases[SLOT_KIND[slot]], level), stage, level) })),
      toggles: TOGGLES, useSecondWeaponSet: false,
      groups: ACTIVES.map((active, gi) => ({
        label: `Stage ${stage} ${active}`, fullDps: FULLDPS === 'all',
        gems: [{ name: active, level: gemLevel, quality },
          ...[0, 1, 2, 3, 4].map((j) => ({ name: SUPPORTS[(gi + j) % SUPPORTS.length], level: 1, quality: 0 }))],
      })),
      main: { group: 1, skill: 1, statSet: 1 },
      config, slots: ITEM_SLOTS, deferRecalc: MODE === 'deferred',
    };
  });
}

async function timed(client: LuaLineClient, action: string, params: Json) {
  const t0 = performance.now();
  const reply = await client.request(action, params, { timeoutMs: REQ_TIMEOUT_MS });
  const ms = performance.now() - t0;
  if (!reply.ok) throw new Error(`${action} failed: ${reply.error}`);
  return { reply, ms };
}

test('WU-30 compile-time spike', async () => {
  const runs: Json[] = [];
  for (let run = 1; run <= RUNS; run++) {
    const client = await startLuaLineClient();
    try {
      const shapes = LEVELS.map(treeShape);
      const gen = (await timed(client, '__test_eval', { code: lua(GEN, { shapes, socketAt: SOCKET_AT }) })).reply.result;
      const loadBefore = os.loadavg();
      const t0 = performance.now();
      const plan = buildPlan(gen);
      const check = await timed(client, '__test_eval', {
        code: lua(CHECK, { stages: plan, startId: gen.startId, ascStartId: gen.ascStartId }),
      });
      expect(check.reply.result.defects ?? []).toEqual([]);
      const nb = await timed(client, 'new_build', { className: gen.className, ascendancy: gen.ascendClassName });
      const stages: Json[] = [];
      for (const st of plan) {
        const payload = lua(STAGE, st);
        const { reply, ms } = await timed(client, '__test_eval', { code: payload });
        const r = reply.result;
        stages.push({
          id: st.id, level: st.level, ms, requestBytes: payload.length, replyBytes: JSON.stringify(reply).length,
          luaPhases: r.phases, recalcs: r.recalcs, recalcSeconds: r.recalcSeconds, counts: r.counts,
          items: st.items.length, jewels: st.jewels.length, gems: st.groups.reduce((n, g) => n + g.gems.length, 0),
          configWrites: Object.keys(st.config).length, skillStatSets: r.nSkillStatSets,
          outputs: Object.keys(r.outputs).length, ids: r.ids, warnings: r.v1.warnings.length,
        });
      }
      const top = plan.reduce((a, b) => (b.level >= a.level ? b : a));
      const fin = await timed(client, '__test_eval', {
        code: lua(FINISH, { stages: plan.map((p, i) => ({ title: p.title, ids: stages[i].ids })), active: top.title, level: top.level }),
      });
      const exp = await timed(client, 'export_build_xml', {});
      const xml: string = exp.reply.xml;
      const e0 = performance.now();
      const code = zlib.deflateSync(Buffer.from(xml, 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      fs.writeFileSync(path.join(__dirname, `compiled-build-${MODE}-${FULLDPS}-${run}.xml`), xml);
      const encodeMs = performance.now() - e0;
      const snap = await timed(client, 'export_build_xml', {});
      const wholeMs = performance.now() - t0;
      runs.push({
        run, wholeMs, loadBefore, loadAfter: os.loadavg(),
        checkMs: check.ms, newBuildMs: nb.ms, finishMs: fin.ms, finishLuaSeconds: fin.reply.result.seconds,
        loadouts: fin.reply.result.loadouts, exportMs: exp.ms, snapshotMs: snap.ms, encodeMs,
        xmlBytes: xml.length, importCodeChars: code.length, stages,
        stageMaxMs: Math.max(...stages.map((s) => s.ms)), stageSumMs: stages.reduce((n, s) => n + s.ms, 0),
      });
      console.error(`[WU-30] ${MODE}/${FULLDPS} run ${run}: whole ${(wholeMs / 1000).toFixed(2)} s, stage max ${(Math.max(...stages.map((s) => s.ms)) / 1000).toFixed(2)} s`);
    } finally {
      await client.close();
    }
  }
  fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), mode: MODE, fullDps: FULLDPS, levels: LEVELS, runs }, null, 2));
});
```

### `xmlcmp.py`

Compares two saved builds canonically: `python3 xmlcmp.py a.xml b.xml`.

```python
import re, sys, xml.etree.ElementTree as ET
def norm(v):
    return ','.join(sorted(v.split(','), key=int)) if re.fullmatch(r'\d+(,\d+)+', v) else v
def canon(e):
    return (e.tag, tuple(sorted((k, norm(v)) for k, v in e.attrib.items())), (e.text or '').strip(), tuple(sorted(canon(c) for c in e)))
a, b = (ET.parse(p).getroot() for p in sys.argv[1:3])
print('canonically equal:', canon(a) == canon(b))
for ca, cb in zip(sorted(a, key=lambda e: e.tag), sorted(b, key=lambda e: e.tag)):
    if canon(ca) != canon(cb):
        sa = {canon(x) for x in ca}; sb = {canon(x) for x in cb}
        print('differs in', ca.tag, len(sa - sb), len(sb - sa))
        for x in list(sa - sb)[:3]: print('  A only:', str(x)[:400])
        for x in list(sb - sa)[:3]: print('  B only:', str(x)[:400])
```
