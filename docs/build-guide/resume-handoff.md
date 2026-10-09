# Build-guide build: resume handoff for a fresh coordinator

Written 2026-10-08, after the waves 2–3 gate. Read this, then `build-handoff.md` (the fleet's rules) and
the tail of `worklog.md` (every verdict, decision and friction note so far). Don't re-read the whole
spec; pull each unit's block and ACs at dispatch time.

## State (updated 2026-10-09, after the M-12 exit)

- **Integration:** worktree `/home/parker/projects/pob2-mcp-wt/guide`, branch `build-guide/build`. The gate passed
  at `d844178`: 120 suites, 1,842 tests; 84 tools.
- **Done:**
  - all 19 units;
  - amendment 1 (`spec/amendment-1-simplify.md`, user-approved): no workflows; the user's session calls agents
    directly; verify once, fix once, re-check, list the rest as known issues;
  - D-263: no headless sessions; WU-47's runs are interactive sessions the user starts;
  - D-264: the fix round edits claims in place;
  - D-265: small items;
  - D-266: `buildSha1` in the compile record.
- **M-12** is met with recorded exceptions E1–E4 (work-log, "M-12 exit"). The last run environment is
  `/tmp/m12b.B0zi` (worktree `m12b`, launcher `start.sh`, Opus).
- **Costs:** the user is on a subscription, so report tokens, not dollars. The Opus attempt 3 used 1.33M output
  and 193M cache-read tokens; its run A alone used 817K output and 107M cache read.

## What's left

1. **The user's agenda, in order:**
   - endgame content: the bridge from 62 to 90, trees with reasons and an order, gem-level timing,
     survival-first advice;
   - whether the precision dial is too high (human guides are mostly judgment);
   - tuning length, specificity and topics against specific human-written guides;
   - creative builds that use less popular skills, for inspiration.

   Ask the user before fetching any web pages. Never pathofexile.com or poe.ninja.
2. **WU-48**, the live Titan / Blood Hunt run: it needs the user's approval (HG-14). It is the first live test of
   D-264, D-265 and D-266.
3. **Finalization with the user:**
   - fold D-239…D-266, amendment 1 and C-33's `buildSha1` into the spine and slice 03;
   - sign-rebase;
   - the push decision;
   - remove the worktrees (`m12b`, and `guide` after merging);
   - the open `buildExportService` symlink item.

## Orchestration conventions used so far

- One doer per unit, run as a background `general-purpose` agent. The prompt points at the handoff,
  the unit's block and ACs, the lane command, and context from merged units. Doers report under 40
  lines.
- One read-only adversarial reviewer per unit, or two small units per reviewer. Findings are sent
  back to the same doer with SendMessage; it fixes them and reports a new head.
- Merges: the coordinator rebases the lane onto `build-guide/build` (or asks the doer to when the
  conflicts are on count sites), checks `pnpm build` plus the affected suites, then
  `git merge --ff-only`, removes the lane worktree and deletes its branch.
- Wave gate: a fresh verifier runs `mise run test` and `pnpm build` from clean, plus the fresh-clone
  check and AC-B1…B7, and samples AC fidelity. The coordinator records the verdict in the work-log and
  commits it.
- Tool-adding units move every count site: spine §1.3, `tests/mcp/toolDisposition.test.ts`
  (`BUILD_GUIDE_NEW`, lane `build-guide`) and the two README prose lines. The second of two parallel
  tool-adding lanes reconciles.

## To fold into the spine at the end (all recorded in the work-log)

D-239…D-255 (the work-log lists each); the C-48 counting wording; spine §1.3's two missing count
sites; the slice 01 §2.1 `statSet` reply field; §2.4's 106 files / 18,805 names; the WU-30 rulings (HG-13 not fired; Full DPS off
in the compiler); the accepted deviations; the pre-existing `buildExportService.ts` dangling-symlink
gap (stab D-42) for the user.
