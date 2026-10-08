# Build-guide build: resume handoff for a fresh coordinator

Written 2026-10-08, after the waves 2–3 gate. Read this, then `build-handoff.md` (the fleet's rules) and
the tail of `worklog.md` (every verdict, decision and friction note so far). Don't re-read the whole
spec; pull each unit's block and ACs at dispatch time.

## State

- **Integration:** worktree `/home/parker/projects/pob2-mcp-wt/guide`, branch `build-guide/build`.
  `fc200ba` is the head at the time of writing (`git log --oneline -1` for the current one).
- **Merged and gated:** WU-30, WU-31, WU-32, WU-33, WU-34, WU-35, WU-36, WU-37, WU-38, WU-39, WU-40,
  WU-49. Waves 1 and 2–3 passed their independent gates. Tools: 82 (81 without poe.ninja).
- **In flight when this was written** (check `git worktree list`; a lane that exists is unmerged):
  - WU-41 (the compiler, `compile_plan`, `guide_run`), lane `bg-41` off `413bec7`. It must rebase
    onto the integration head before merging.
  - A WU-34 follow-up, lane `bg-34b` off `ec2c822`: `get_passive_upgrades` returns `refit` so prepended
    session notices can't push can't-measure lines past C-1's cut (D-53, D-246).
- **Main checkout** `/home/parker/projects/pob2-mcp` (branch `stabilization/foundation`, spec at
  `b34db2a`) is untouched by the fleet. The stabilization worktree `pob2-mcp-wt/build` is not ours.

## What's left (spine §8)

1. WU-41 → review → merge. Its brief carried the reviewers' pitfalls (work-log "Notes for WU-41 and
   WU-42").
2. Then in parallel: **WU-42** (V1 and V2 inside compile; `data/config-baseline.json`) and **WU-43**
   (the skill, run log, checkpoints, offline mode, run checker, workflow harness). They are
   filesystem-disjoint.
   - WU-42 gets the notes on the interlude resistance bucket and on attribute nodes without a choice.
   - WU-43 must carry D-243: `possibly unread` is advisory, confirmed by measurement before
     hand-calculating.
3. Then WU-44 → WU-45 → WU-46, in series: they share `tests/unit/buildGuideWorkflows.test.ts` and the
   coordinator agent file.
4. Then **WU-47**, the recorded offline pipeline run. It needs:
   - a headless Claude Code session with its own MCP config registering this server as `pob2`;
   - temp builds, state and guides dirs, trade and poe.ninja disabled, WebSearch and WebFetch denied;
   - the procedure in slice 03's WU-47 block.
5. A gate after each wave; then the M-12 exit check.
6. **WU-48** (the live Titan / Blood Hunt run) waits for the user's approval (HG-14).

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

D-239…D-247; the C-48 counting wording; spine §1.3's two missing count sites; the slice 01 §2.1
`statSet` reply field; §2.4's 106 files / 18,805 names; the WU-30 rulings (HG-13 not fired; Full DPS off
in the compiler); the accepted deviations; the pre-existing `buildExportService.ts` dangling-symlink
gap (stab D-42) for the user.
