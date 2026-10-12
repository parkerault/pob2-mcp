# Build-guide coordinator: succession handoff (2026-10-11)

**Audience:** a fresh session taking over as coordinator of the build-guide amendments build: M-14 is recorded, and M-15 (amendment 4) is being built now.

**Trust posture:**
- **Gated PASS at `278b89c`:** everything through WU-58. An independent verifier ran the full gate from clean:
  2095 of 2095 tests, none skipped.
- **Since then:** WU-59's criteria (docs) and WU-63 (skill text, the checker and tests). The coordinator checked these
  with the static and checker suites (543 of 543) and the four good fixtures. The full gate hasn't been re-run since
  `278b89c`. The run itself is the next end-to-end check.

## Read first, in order

1. **The work-log tail:** `/home/parker/projects/pob2-mcp-wt/amend/docs/build-guide/worklog.md`, from "## 2026-10-10:
   amendments 2 and 3, build start". It records every verdict, decision and merge of this build. It's the source of
   truth for state, so read it before acting. Write it only in the integration worktree `amend`.
2. **The fleet's rules:** `docs/build-guide/build-handoff-amendments.md`. These are the rules every doer and reviewer
   prompt points at: lanes, the gate commands, the network and secret rules, commits.
3. **This file:** the queue, and the state that no durable doc holds.
4. **The spec, v1.4:** `docs/build-guide/spec/README.md` and the slices. It's folded through D-338; D-339…D-342 aren't
   folded yet (queue item 3). Pull each unit's block and ACs when you need them, not the whole spec.
5. **WU-59's run environment:** `/tmp/m14.zfPx/README.md`, the user's instructions for the recorded run.
6. **Memory:**
   - `build-guide-workflow.md` (current);
   - `poe-ninja-dev-ok.md`;
   - `worktrees-only-for-parallel-builds.md`;
   - `report-token-costs.md`;
   - `user-picks-sources.md`;
   - `guide-style.md`;
   - `no-human-effort-estimates.md`.

## Working rules

Each rule lives in memory or `CLAUDE.md`. Don't re-derive them.

- **Secrets and requests:**
  - never read `.env`, and never set `POESESSID`;
  - poe.ninja's documented economy endpoints only (D-335);
  - pathofexile.com and any request carrying a cookie or personal data need the user's approval;
  - tests stay offline.
- **Agents:**
  - no headless `claude -p` (D-263): the user starts interactive runs;
  - no Serena;
  - no Workflow unless the user asks.
- **Commits:**
  - unsigned inside lanes and in `amend`;
  - the sign-rebase happens with the user present (HG-8);
  - never push unless asked, and never to `upstream`.
- **Reporting:** cost in tokens (output, cache read, cache write) and the model, never dollars. Gloss every spec label
  with its meaning.
- **Coordinator method:**
  - one background doer per unit;
  - a read-only reviewer per unit, which defaults to finding problems;
  - fixes go to the doer, or to a fresh fixer when the doer's context is huge (over about 400K);
  - an independent verifier runs the wave gate;
  - the coordinator records each verdict in the work-log the moment it's made, and never reads agent transcripts.
- **Jest:** don't clear the Jest cache while other lanes run Jest. The verifier may clear it when it gates alone.

## The queue

1. **Done:** WU-63 is merged at `e62799b`, with static and checker suites passing 543 of 543. The run worktree `m14` was
   moved to `e62799b` and built. The work-log's last section has the details.
2. **The WU-59 run, paused.** *Who acts: the user, once amendment 4 decides run B.*
   - **P1** passed on its second attempt, at `30abc7a`.
   - **Run A** ended `completed` at `30abc7a`, and the run checker exits 0. Its gates printed no display (AC-W37
     fails at that head). The fix is `96b1785`, and the run worktree `m14` is rebuilt there.
   - **Run A's cost** was 296M cache read and 1.78M output against an estimate of 130M. The work-log's section
     "WU-59 run A ended" has the breakdown.
   - **Run B and P2 are on hold.** Re-scope them after amendment 4, which changes what a run produces.
2a. **Amendment 4: cost and scope. ACCEPTED by the user on 2026-10-11, with answers.**
   - **The document:** `docs/build-guide/spec/amendment-4-cost-and-scope.md`.
   - **Decisions:** D-345…D-350 are the user's; D-351…D-361 were proposed and accepted; D-362 is the user's
     design gate. Plus the ledger and triage rules under D-352.
   - **Evidence:** the three reports in `docs/build-guide/studies/2026-10-11-*`.
   - **The work:** milestone M-15, units WU-64…WU-72 with their DAG, and AC-W51…W60, AC-P60…P67 and AC-K66.
   - **Folded:** spec v1.5 at `ba9daf8` (D-339…D-362, amendment 4, M-15; reviewed and fixed). Item 3 below is
     done. **Still to confirm with the user:** that their acceptance of amendment 4 is the HG-12 decision for
     D-360's changes to `find_path_to_node` and `get_nearby_nodes`.
   - **The M-15 build: IN PROGRESS** (started 2026-10-11, after the user signed off every amendment 4 change; that
     settles HG-12 for WU-66). The work-log section "2026-10-11: M-15 build start" records every verdict. *Who acts:
     you, by the coordinator method.*
     - **Merged and gated:** WU-65…WU-71 are on `build-guide/amendments`, each reviewed. The M-15 wave gate
       PASSed at `27b90fe`: 127 suites, 2283 tests, build rc=0, waivers `[]`, dependencies and `vendor/`
       unchanged.
     - **WU-72, the lean run, is ready.** *Who acts: the user.* Its environment is `/tmp/m15.C1xp` (its README
       has the steps). Its worktree is `m15`, detached at `27b90fe` and built. `start.sh runL` runs with
       telemetry, `runL-plain` without. When the user reports it done, have an independent verifier check the
       record against AC-W56…AC-W58 (slice 03 §13) and the budgets (AC-W57: output at most 1M by WU-64's counter,
       peak context per agent, cache read per step). The transcripts are under
       `~/.claude/projects/-home-parker-projects-pob2-mcp-wt-m15/`.
     - **WU-64, the counter spike:** paused at "awaiting control" (lane `bg-64`, head `734764b`). The user runs
       `docs/build-guide/spikes/WU-64-control.md` in their own terminal and hands back `$D`, the transcript path
       and any `/usage` figures. Then resume a fresh doer (the first doer's agent is gone after a restart) to
       finish the report and decide the budget counter. It blocks only WU-72.
     - **Then:** the wave gate. An independent verifier runs `mise run test` and `pnpm build` from clean at the
       integration head, since the full engine suite has run only per lane. Then the user's WU-72 lean run, with a
       new run worktree at the M-15 head (the M-14 one, `m14`, is at `96b1785`) and telemetry on, per WU-64's
       outcome.
     - **Coordinator decisions this build, PROPOSED and in the work-log only (fold them into the spine):**
       - D-363: clear speed's stat set;
       - D-364: a loop through two exits of one start is one tree;
       - D-365: V4 checks guide figures against measured values only;
       - D-366: D2's tree-path `reason` claims.

       Also fold the spec nits listed in the work-log: C-50's "or `view`"; AC-P65 and AC-K66's wording; §3.7,
       §2.11 and D-360's "one start exit"; slice 02:792 `producer-absent`.
   - **After M-15:** the user brings their own poe.ninja Explosive Concoction build to compare with run A.
3. **Done: fold v1.5 into the spec** (see 2a). *Who acts: you; docs only.* The work-log holds the content.
   - **Decision rows to add:**
     - D-339: the deck and short rounds;
     - D-340: counted versus raw fields;
     - D-341: D-326 restated, so schema 2 means log rules only;
     - D-342: the user's ascendancy lock.
   - **Status:** WU-57 and WU-58 become as-built.
   - **New unit:** the WU-63 block and its ACs.
   - **WU-58:** fold its extra checks (the end status, escalation matching, schema-2 field rejection) and the
     `probes`/`shortReason` run-log fields.

   You can fold before or after the run. It doesn't affect the run.
4. **Analyse WU-59 when the user reports the sessions done.** *Who acts: you, with an independent verifier.*
   - Check the record against AC-W34…AC-W50 (slice 03 §13).
   - Run the seeded negative check of AC-W44 (f) on a copy of run A's folder: change an item text in `plan.json`,
     expect `[record-plan]` and exit 1.
   - Do the coordinator's guide review (AC-W43).
   - Have a verifier re-check the record. Transcripts are under `~/.claude/projects/<the m14 worktree's project
     key>/`, and the guides under `/tmp/m14.zfPx/guides*`.
   - A failure re-opens the owning unit.
   - M-14 closes when the record passes (D-315).
5. **Finish the build.** *Who acts: you, with the user present.*
   - Sign-rebase the integration branch, which holds 68+ unsigned commits since `acec4d1` (HG-8; the user approves
     in 1Password).
   - Fast-forward `build-guide/amendment-3` in the main checkout.
   - Remove the worktrees `amend`, `m14` and any lanes.
   - Tell the user to restart the pob2 server (`/mcp`), because the main checkout's `build/` changes.
   - Push only if asked.
6. **Later, gated by the user:** M-13, the live run (WU-48), after M-14. Its approval gates are HG-14 and D-182.
   The deferred items are HG-19…HG-22.

## Standing context

- **Merged and gated:** WU-50 and WU-51 (spike reports), WU-53, 54, 55, 56, 57, 58, 60, 61 and 62. WU-52 is
  withdrawn (D-335).
- **Decisions this build:**
  - D-335, the user's: no player-evidence tools;
  - D-336…D-341, PROPOSED by the coordinator;
  - D-342, the user's direction.
- **CLAUDE.md** on the integration branch allows only poe.ninja's economy endpoints. The main checkout gets that
  at the final fast-forward.

### Transient

- **Integration head:** `d748621` or later, on `build-guide/amendments`, in `/home/parker/projects/pob2-mcp-wt/amend`. Lanes:
  `bg-64` (WU-64, paused). Run worktrees: `m14` (`96b1785`) and `m15` (`27b90fe`, built).
- **Live worktrees:**
  - `amend`, the integration worktree;
  - `m14`, detached at `96b1785` and built: the WU-59 run worktree.
- **The main checkout** `/home/parker/projects/pob2-mcp` is on `build-guide/amendment-3` at `acec4d1`. The fleet
  doesn't touch it, because the user's pob2 server runs from its `build/`.
- **Temp dirs:**
  - `/tmp/m14.zfPx`, WU-59's environment;
  - `/tmp/m12b.B0zi` and `/tmp/m12.DbTF`, the old WU-47 evidence (delete when the user agrees);
  - `/home/parker/projects/pob2-mcp-wt/ninja-cache/`, 5 poe.ninja HTML pages (delete when the user agrees).
- **Model and effort:** Opus 5.5. The coordinator session ran at about 51% context when this was written.
- **Crash note:** a tmux crash on 2026-10-11 killed every agent. Lane commits survived. Agents from an earlier
  session can be resumed with SendMessage only within that session's lifetime. Otherwise use a fresh fixer.

## Appendix: open agent work at hand-off

The WU-63 doer was resumed to bar finalizing `wrong-ascendancy` cards and to rebase, and hadn't reported when this
was written. Its first report (head `e62f0f2`, 537 of 537 static and checker tests) is summarised in the work-log's
last section. Its deviations were accepted: the search also runs for card-named skills, and a self-contradicting
brief ends short.
