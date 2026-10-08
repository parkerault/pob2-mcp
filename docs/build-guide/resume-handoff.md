# Build-guide build: resume handoff for a fresh coordinator

Written 2026-10-08, after the waves 2–3 gate. Read this, then `build-handoff.md` (the fleet's rules) and
the tail of `worklog.md` (every verdict, decision and friction note so far). Don't re-read the whole
spec; pull each unit's block and ACs at dispatch time.

## State (updated after the wave-5 gate)

- **Integration:** worktree `/home/parker/projects/pob2-mcp-wt/guide`, branch `build-guide/build`
  (`git log --oneline -1` for the head).
- **Merged and gated:** WU-30…WU-46 and WU-49, 18 of this run's 19 units. Gates: wave 1, waves 2–3,
  wave 4 (with the M-11 exit) and wave 5, all PASS. Tools: 84 (83 without poe.ninja). No lane is open
  (`git worktree list` shows only `guide` and the stabilization `build`).
- **Main checkout** `/home/parker/projects/pob2-mcp` (branch `stabilization/foundation`, spec at
  `b34db2a`) is untouched by the fleet. The stabilization worktree `pob2-mcp-wt/build` is not ours.

## What's left

1. **WU-47, the recorded offline pipeline run** (M-12). The user chose **Sonnet** for its headless
   session (2026-10-08).
   - **Procedure:** slice 03's "### WU-47" block, owning AC-W4, W15…W22 and W26.
   - **Setup:**
     - a fresh worktree at the integration head, bootstrapped with `pnpm build`;
     - temp builds, state and guides dirs, plus a temp cwd for the server;
     - an MCP config registering this worktree's server as `pob2` with those dirs,
       `POE_TRADE_DISABLED=true`, `POE_NINJA_DISABLED=true` and
       `POE_TRADE_BASE=http://127.0.0.1:9/api/trade2`;
     - the server started through a wrapper that puts mise's luajit and node on PATH (WU-43's probe did
       this).
   - **The headless session:** `claude -p --model sonnet --strict-mcp-config --mcp-config <cfg>`, with
     WebSearch and WebFetch denied and `--add-dir <temp guides root>` (the gate's risk 1).
   - **Runs:** run A (workflows; FI-1 and FI-2), run B (`agent-tool`; FI-1, FI-2, FI-3, no escalation
     answer), then the seeded V4 check (AC-W15) and the probes (AC-W4, W21, W26).
   - **Evidence:** the session transcripts and each workflow's `journal.jsonl` at
     `~/.claude/projects/<cwd-slug>/<session>/subagents/workflows/<runId>/journal.jsonl`.
   - **Record:** each session's cost.
   - **Delegate:** have one runner agent do the setup and runs, and return a terse record (paths,
     outcomes, the AC-by-AC evidence, cost). Then a separate verifier checks the record, re-runs
     `check-run.mjs` on both run folders, and does AC-W22's per-H2 review of run A's guide.
   - **If a run misses:** a quality clause gets one coordinator re-run of that run, then a finding
     against the owning unit's stage references. A code failure re-opens the owning unit.
   - **If structured output fails live** (the gate's risk 2: custom agentType plus schema, nullable
     type arrays): that re-opens WU-44/45/46. Probe it first with one cheap headless call before the
     full runs.
2. **The M-12 exit check** (spine §7), recorded in the work-log.
3. **WU-48** (the live Titan / Blood Hunt run) waits for the user's approval (HG-14).
4. **Finalization with the user:**
   - fold the work-log's coordinator decisions (D-239…D-255 and the rest) into the spine;
   - sign-rebase;
   - the push decision;
   - remove the worktrees.

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
