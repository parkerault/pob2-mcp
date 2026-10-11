# Build-guide coordinator: succession handoff (2026-10-11)

**Audience:** a fresh session taking over as coordinator of the amendments 2 and 3 build (milestone M-14).

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
2. **The WU-59 run.** *Who acts: the user.* They start the sessions in the order `/tmp/m14.zfPx/README.md` gives:
   P1, which now has six commands including the D-342 brief check, then run A, run B and P2. Each one runs with
   `bash /tmp/m14.zfPx/start.sh <session>`.
   - **Estimate, all on Opus:** about 205M cache read and 1.6–2.1M output in total. Run A takes about 130M and
     3–3.5 h; run B about 70M and 1.5–2 h.
   - **The brief is the user's:** **Explosive Concoction, any ascendancy**. It's an ascendancy skill, granted only by
     Pathfinder node 38004.
3. **Fold v1.5 into the spec.** *Who acts: you; docs only.* The work-log holds the content.
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

- **Integration head:** `1ee2cd1` or later, on `build-guide/amendments`, in `/home/parker/projects/pob2-mcp-wt/amend`.
- **Live worktrees:**
  - `amend`, the integration worktree;
  - `m14`, detached at `e62799b` and built: the WU-59 run worktree.
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
