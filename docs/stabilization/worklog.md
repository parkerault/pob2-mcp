# Stabilization epic: build work-log

Dated build narrative: what was built, decisions and deviations with their rationale, and gate
evidence (commands, exit codes, key numbers). Only the integration worktree writes to it. The handoff
is `build-handoff.md`.

## 2026-10-04: build start

- Spec ratified by the user, including every PROPOSED decision.
- User directive: build the full spec (WU-02…19, WU-22, WU-23) with no intermediate human testing.
  The user runs the live smoke test and final acceptance (WU-20, WU-21) at the end.
- Integration worktree `/home/parker/projects/pob2-mcp-wt/build`, branch `stabilization/build`, off
  `fd289ba`. Commit signing is off in this worktree only (D-48).
- Wave plan:
  1. WU-02 → WU-03 → WU-04.
  2. Three lanes, then rebase-merge in DAG order:
     - build lane: WU-05 → 06 → 07 → 08;
     - trade lane: WU-14 → 15;
     - lua lane: WU-16, starting after WU-07.
  3. Three lanes, then merge:
     - files lane: WU-22;
     - a3 lane: WU-09 → 10 → 11;
     - trade lane: WU-17 → 23.
  4. WU-12 → 13 → 18 → 19, then the final gate and a whole-branch review.

## 2026-10-04: wave 1 (WU-02…WU-04) gate fix

- **Gate failure.** The first W1 gate at `fa9cdbe` failed 4 tests in 3 static suites: the
  deleted-plumbing check (AC-F19), the PoE1-cruft scan (AC-F20) and the dead-module scan (AC-F21).
  Root cause: WU-04's commit removed the D-4 tools from the surface, but none of the module files
  were deleted. This was not a WU-02 or WU-03 regression; the gate was green at `fb9881d`
  (34/34 suites, 346 tests).
- **Fix.** `git rm` of the 15 modules WU-04 lists, which stop being referenced, plus
  `src/types/optimization.ts`. That file is not in the spec's list, but nothing imports it once the
  others are gone (AC-F21). Also removed the unit tests of the deleted crafting modules
  (`craftingAdvisorHandler`, `craftingDataService`). Dropped the
  `handlers/advancedOptimizationHandlers.ts` entry from `tests/unit/pathTraversal.test.ts`, because
  the file it checks no longer exists.
- **Decision: `src/services/costBenefitAnalyzer.ts` is kept (deviation from WU-04's delete list).**
  WU-04 deletes the "modules that become unreferenced". This one does not become unreferenced:
  `formatSearchResults` in `src/handlers/tradeHandlers.ts` (import at line 6, use at line 369)
  ranks the kept `search_trade_items` results with it. Deleting it would change a kept tool's
  output, which is the trade lane's job (WU-15 rewrites `search_trade_items`). The AC-F19 test's
  `DELETED_MODULES` list leaves it out for this reason. WU-15 decides whether it survives.
  The AC-F21 dead-module scan keeps it honest: if WU-15 stops importing it, the scan goes red until
  the file is deleted.
- **Gate evidence at the fix commit:** clean tree (`rm -rf build coverage`, `jest --clearCache`).
  `mise run test` rc 0, with 37/37 suites and 366/366 tests. `pnpm build` rc 0.
- **WU-02/WU-03 script checks from the W1 verifier (exit codes):**
  - AC-F1:
    - the HeadlessWrapper sha1 with CRLF normalization, and `pob-pin.json` equal to the C-6
      literal: 0.
  - AC-F2:
    - a fresh `pob:fetch` gives `7d6f530`: 0;
    - a second `pob:fetch` makes no network command: 0.
  - AC-F5: `rg POB_FORK_PATH src/` matches only `src/engine/pobPath.ts`: 0.
  - AC-F6: `check-construct.lua`: 0.
  - AC-F7:
    - `rg '\|' mise.toml` finds no match (pass): 1;
    - the plugin pin checks out `bd4977e`: 0;
    - a fresh clone runs `mise run setup`: 0.
    - A full `mise install` in a scratch data dir was not run, because it needs hosts outside the
      allowlist.
  - AC-F8:
    - `pnpm why zod` shows a single version: 0;
    - no `@types/chokidar` or `@types/node-fetch` (pass): 1;
    - no `coverageThreshold` (pass): 1;
    - `pnpm install --frozen-lockfile`: 0;
    - `jest --coverage` without the 3 WU-04 suites: 0.
  - AC-F9:
    - `mise run test` at `fb9881d`: 0;
    - with an injected failing test, `mise run test` gives 1 and `jest` gives 1, so the exit codes
      match.
  - AC-F14: no removed env flags in `src/` (pass): 1.
  - AC-F17:
    - vendor missing: 1;
    - `POB_SKIP_ENGINE=1`: 0, with the suite skipped;
    - luajit missing: 1;
    - no `if (!ready) return` (pass): 1.
- **Non-gating.** Jest still prints "A worker process has failed to exit gracefully" in the full
  run. `jest --detectOpenHandles` on the new in-process suites (`tests/mcp/deletedTools`,
  `tests/mcp/toolSet`) reports no open handle, so the leak is somewhere else. It is left for a later
  unit.
