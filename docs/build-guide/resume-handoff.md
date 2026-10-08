# Build-guide build: resume handoff for a fresh coordinator

Written 2026-10-08, after the waves 2–3 gate. Read this, then `build-handoff.md` (the fleet's rules) and
the tail of `worklog.md` (every verdict, decision and friction note so far). Don't re-read the whole
spec; pull each unit's block and ACs at dispatch time.

## State (updated after the wave-4 gate)

- **Integration:** worktree `/home/parker/projects/pob2-mcp-wt/guide`, branch `build-guide/build`
  (`git log --oneline -1` for the head).
- **Merged and gated:** every unit through WU-44, plus WU-49 (17 of 18 non-human units minus WU-45…47).
  M-10 and M-11 exits pass (wave-4 gate at `1d6f260`). Tools: 84 (83 without poe.ninja).
- **In flight when last updated:** WU-45 (design-and-write workflow), lane `bg-45` off `bbad209`.
  It rebases onto the integration head before merging. `git worktree list` shows unmerged lanes.
- **Main checkout** `/home/parker/projects/pob2-mcp` (branch `stabilization/foundation`, spec at
  `b34db2a`) is untouched by the fleet. The stabilization worktree `pob2-mcp-wt/build` is not ours.

## What's left (spine §8)

1. WU-45 → review → merge.
2. **WU-46** (V3 provenance and V4 claim-verification agents wired into the design workflow; V4 accepts
   `external-unavailable` only offline). It shares `tests/unit/buildGuideWorkflows.test.ts` and the
   coordinator agent file with WU-44/45, so it runs after WU-45.
3. **WU-47**, the recorded offline pipeline run. Follow slice 03's WU-47 block. It needs a headless
   Claude Code session per the handoff's exception: strict MCP config, its own `pob2` server with temp
   dirs, trade and poe.ninja disabled, web tools denied, and its cost reported. WU-43's report recorded
   how: a wrapper puts mise's luajit and node on PATH, and the journal is at
   `~/.claude/projects/<cwd-slug>/<session>/subagents/workflows/<runId>/journal.jsonl`. An independent
   verifier checks the record. The user was told the cost will be noticeably more than WU-43's $0.16
   probe.
4. A wave gate after WU-45/46, then the M-12 exit check after WU-47.
5. **WU-48** (the live Titan / Blood Hunt run) waits for the user's approval (HG-14).
6. Finalization with the user: fold the work-log's coordinator decisions (D-239…D-252 and the rest)
   into the spine; sign-rebase; the push decision.

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

D-239…D-252 (the work-log lists each); the C-48 counting wording; spine §1.3's two missing count sites; the slice 01 §2.1
`statSet` reply field; §2.4's 106 files / 18,805 names; the WU-30 rulings (HG-13 not fired; Full DPS off
in the compiler); the accepted deviations; the pre-existing `buildExportService.ts` dangling-symlink
gap (stab D-42) for the user.
