# Adversarial review of the build-guide spec, with the binding fix plan (2026-10-07)

## How it ran

- **What was reviewed:** the spec at commit `16ac50b`, i.e. the spine plus slices 01, 02 and 03.
- **Lenses:** three agents, each hunting two classes of problem:
  - invented decisions, plus environment and contract fit;
  - unverifiable ACs, plus task-graph integrity;
  - ground-truth fidelity (weighted up, since this is brownfield), plus completeness.
- **Clustering:** the 36 raw findings merged into 22 clusters, S1–S22.
- **Verification:** two skeptic verifiers, defaulting to "refuted", checked the clusters against the code
  and the pinned PoB2 source:
  - 11 confirmed, 11 partly confirmed, none refuted outright;
  - refuted sub-claims are noted per cluster below.

## Who applies the fixes

Each fixer edits only its own files. That keeps the parallel fixers from colliding.

| Fixer | Files it owns | It applies |
|---|---|---|
| A | `spec/README.md` (spine) and `spec/02-plan-compiler.md` | Every spine-level change below; the S2-x items of `resolutions-2026-10-07.md`, and the spine side of all resolutions; S1, S2, S3, S4, S5, S7, S8, S16, S17, S20, S21; the spine side of S6, S9, S12 and S15 |
| B | `spec/01-server-tools.md` | The S1-x resolutions; S12 (WU-49's error prefix); S18; S19; S22; the slice-1 side of S6 |
| C | `spec/03-pipeline.md` | The S3-x resolutions; S6 (slice-3 edges and AC moves); S9 (the check-run side); S10; S11; S12 (§9 pacing); S13; S14; S15 |

Every new decision, contract and gate ID is pre-allocated below. The fixers use these exact IDs.

## Clusters, verdicts and binding fixes

**S1 (confirmed). AC-P23 and AC-P24 use arguments that don't exist and assert a level PoB overwrites.**
- The problems:
  - `import_build` takes `source`, not `code`;
  - `lua_get_stats` takes no `fields`;
  - loading doesn't pass `keepLevel`, so auto mode re-estimates the level.
- Fix (A): AC-P24 uses `import_build {source}`. It asserts the auto flag and the decoded `<Build level>`,
  not the post-load level. AC-P23 reads stats with `lua_get_stats {}`, or `{breakdown}` per C-45.

**S2 (partial). AC-P35's crash recovery is impossible, and a compile silently discards the user's loaded
build.**
- Surviving claim:
  - `ctx.newBuild` nulls the snapshot, so recovery after a crash mid-compile takes the no-snapshot path
    (`RESTORE_FAILED`);
  - a compile replaces the user's loaded build.
- Fix (A):
  - AC-P35 expects the no-snapshot path. The next read call fails with C-3's "could not be restored"
    error, and a later `compile_plan` succeeds.
  - **D-210:** `guide_run`'s `new_run` reply (C-50) includes `loadedBuildUnsaved`. The skill (C, slice 3)
    asks the user before the first compile when it's true.

**S3 (partial). Re-compiles are refused, and the overwrite guard can be fooled.**
- Surviving claims:
  - a measure-only compile rewrites the record, so a routed final re-compile is refused;
  - the in-memory changed-on-disk guard doesn't survive a restart and is refreshed by auto-reload;
  - `pobFile.sha1` is unused;
  - writing the PoB file before the record can orphan it;
  - the overwrite exemption trusts an agent-editable file.
- Refuted: the name collision.
- Fix (A), **D-211:**
  - The server keeps a write ledger in its state folder: `$XDG_STATE_HOME/pob2-mcp/guide-writes.json`,
    holding `{builds-relative path, sha1, runFolder, writtenAt}` per final compile. Agents can't write
    there.
  - A final compile may overwrite an existing builds-folder file only if:
    1. the ledger has an entry for that path whose `runFolder` is the plan's run folder; and
    2. the file's current sha1 equals the ledger's sha1, meaning nobody edited it since.

    Otherwise the compile is refused with C-17's changed-on-disk wording.
  - Measure-only compiles never touch the ledger or the PoB file.
  - Order of operations: check, then write the PoB file (through `buildFileWriter`), then the ledger
    entry, then the record. A failure after the PoB write still writes the ledger entry, so a retry can
    overwrite.
  - `compile-record.json` stays informational.
  - New AC-P pair: a re-compile after a measure-only compile succeeds; a user edit between compiles is
    refused, including after a server restart.

**S4 (confirmed). PoB's config placeholders are applied as values, not hints.**
- The problems:
  - `BuildModList` and `UpdateLevel` apply placeholders when no input is set;
  - `enemyIsBoss` sets placeholders for the enemy's level, damage, resists, pen, armour, evasion, speed
    and crit;
  - A-P4 is false, and the default audit skips placeholders;
  - Save drops a value equal to the active set's placeholder.
- Fix (A), **D-212:**
  - Correct A-P4.
  - The default audit (C-32) covers placeholder-driven options. Every config option whose placeholder
    affects calcs is either set explicitly per stage from E1/C1 (a scenario input), or listed in
    `data/config-baseline.json` with a rationale (S2-2).
  - The compile record stores each stage's effective values, explicit or placeholder, with their class.
  - Note the Save behaviour: an explicit value equal to its placeholder isn't written to the XML. The
    record is authoritative (D-13 row 13).

**S5 (partial). PoB's tree connectivity depends on weapon-set tags, and PoB prunes unconnected nodes
silently.**
- Surviving claim: an untagged node can't path through weapon-set nodes; orphans are pruned silently; the
  preflight check and compile step 7 ignore both.
- Refuted: "unknown ids aren't skipped". The preflight already rejects them.
- Fix (A), **D-213:**
  - The preflight applies PoB's connectivity rule (`CanPathThroughAllocMode`).
  - `compile_stage` compares PoB's resulting allocation, with tags, to the plan's, and fails the compile
    naming any difference.
  - New AC-P: a plan with an untagged node hanging off a weapon-set node is rejected.

**S6 (partial). The task graph has missing edges, unserialized shared files and misplaced ACs.**
- Fix (A, spine DAG):
  - add edges WU-46 ← WU-44 and WU-41 ← WU-39;
  - WU-35 and WU-36 depend on WU-32, and add `tests/e2e/serverTools.test.ts` to their touches;
  - serialize WU-44 → WU-45 → WU-46. They share `buildGuideWorkflows.test.ts` and
    `build-guide-coordinator.md`, so they no longer run in parallel;
  - serialize WU-36 and WU-40 on `engineKinds.test.ts` and `toolHygiene.test.ts`, whose `PLACEHOLDERS`
    map gains `$JEWEL_TEXT`. Add both files to the serialized-wiring list;
  - **D-214:** C-31's progress-key format is `q.<QuestRewards key>`, defined in WU-38's schema. WU-39
    implements the data, and the fixture `tests/fixtures/plans/two-stage/plan.json` and
    `plan-reference.md` join WU-39's touches;
  - drop AC-B6 from M-10's exit list (WU-37 owns it, under M-11).
- Fix (C): move AC-W4 and AC-W15 into WU-47's acceptance list, as their only owner.
- Fix (B): touches and edges for WU-35 and WU-36 as above.
- Refuted: `ITEM_SLOTS` (settled by S1-2), NFR-22 (WU-48 item 7 covers it), and the M-11 exit list (the
  spine wins, so slice 2 matches it).

**S7 (confirmed). A new build's default sets add an extra "Default" loadout.**
- Fix (A), **D-215:** the first stage reuses tree spec 1 and item, skill and config set 1, retitling
  them to its loadout name. Later stages create new sets. AC-P22 and AC-P24 check that the loadout count
  equals the stage count, with no "Default".

**S8 (confirmed). `compile_plan`'s non-compiling modes start the engine and mark the build dirty.**
- The problem: `compile_plan`'s `new_run` and validate-only modes run as kind `load`. They start luajit,
  bump `revision` and set `isDirty`.
- Fix (A), **D-216 and new contract C-50:** move both modes to a new tool `guide_run`.
  - Its `new_run` mode creates the run folder with no engine call at all; it runs outside
    `session.run`.
  - Its `validate` mode is kind `read`: it checks names against the game data through lookups and
    mutates nothing. The engine-kind test proves the export and revision are unchanged.
  - `compile_plan` keeps only the measure-only and final modes, as kind `load`.
  - The new-tool total becomes **7**, i.e. 84 tools, or 83 without poe.ninja. That's within the cap of 8.
  - Update C-41 and the tool-count references.
  - Slice-3 references to `new_run` and `validate` move to `guide_run` (C applies this).

**S9 (partial). The rolled-skill gate needs a role field, and the pipeline's gates trust agents'
self-reports.**
- Surviving claim:
  - C-31 has no skill role for the rolled-skill gate;
  - the check-run script recomputes neither the floor nor the budget;
  - AC-W2(m) trusts V4's self-reported counts.
- Refuted: `maxConcurrent` (the harness measures it).
- Fixes:
  - (A) **D-217:** C-31's skill groups gain `role`, one of `clear`, `single_target`, `utility` or
    `leveling`, and the plan records which group holds the rolled skill.
  - (C) The check-run script recomputes, from the compile record:
    - the survival floor (fire, cold and lightning at their caps, per S3-4);
    - the budget verdict, from the plan's price entries;
    - the rolled-skill gate;
    - the claim-coverage counts, from the guide and the plan.

    It flags any disagreement with the agents' verdicts.

**S10 (partial). The recorded-run ACs depend on agent quality, and timing data has no source.**
- Surviving claim:
  - "2 attempts", "2–3 concepts" and "nothing unresolved" depend on how well the agents perform, with no
    owner for a miss;
  - transcript retention and a per-attempt clock are ungrounded.
- Refuted: AC-W22, which is declared a judgment.
- Fix (C):
  - Rephrase the AC as: the fault-injected attempt (FI-2) fails first, then the stage passes within the
    retry cap.
  - A quality miss gets one coordinator re-run. If that misses too, it's logged as a finding against the
    prompts. Prompt tuning is the owning unit's rework, not a gate failure of the code.
  - Transcript evidence comes from the workflow's `journal.jsonl` (platform grounding §5).
  - Per-attempt times may be null in workflow mode. Stage times come from the skill runner between
    workflow phases, plus the `compiledAt` and `Checked:` lines in the records.

**S11 (partial). Allowlisted agents might not reach MCP tools without ToolSearch.**
- Surviving claim: nothing grounds allowlisted MCP tools being callable without ToolSearch, and AC-W21
  tests only denials.
- Fix (C): WU-43 adds an early positive probe. A researcher started through `agentType` calls
  `lookup_game_data` and gets a result. If deferred MCP tools need ToolSearch, ToolSearch joins every
  agent row: it grants nothing beyond the allowlist. The probe's outcome is recorded in the work log.

**S12 (partial). The pacing rule can't be carried out, and NFR-22 relies on parsing prose.**
- Surviving claim:
  - the coordinator has no clock for "retry after the stated wait";
  - anonymous searches (29 per 5 minutes) can hit `would_wait` during D1;
  - the error kind is lost in the tool's prose text, so NFR-22 rests on parsing.
- Refuted: "nothing can wait". Waits of 30 s or less are slept inside the call, and a refusal sends
  nothing.
- Fixes:
  - (B) **D-218:** WU-49 prefixes trade-tool errors with a stable `[trade:<kind>]`, using the real kinds in
    `src/trade/errors.ts` (`would_wait`, `locked_out`, `rate_limited`, ...). Corrected by the consistency
    pass: a 429 is `rate_limited`, and `find_upgrades` keeps its own wording.
  - (C) §9: on `would_wait`, the coordinator moves on to other work and re-calls the item later.
  - (C) After **3** refusals the item is `unavailable`.
  - (C) A final re-price pass for `unavailable` items runs before the D1 budget verdict becomes final.
  - (C) The run log classifies outcomes by the prefix.
  - (A) Record D-218 in the spine.

**S13 (confirmed). The live run sets no session permissions.**
- Fix (C): WU-48 gets a setup item. Project `.claude/settings.local.json` for the run, shown to the user
  at the live-run gate:
  - Write and Edit allowed only under the guides root;
  - WebFetch allowed for `poe2db.tw`, `maxroll.gg`, `game8.co`, `poe-vault.com` and the named patch-note
    mirrors;
  - WebFetch denied for `pathofexile.com` and `poe.ninja`.

**S14 (partial). The workflow-script contract isn't grounded, and the harness's loading method is
unstated.**
- Surviving claim: the contract comes from an ungrounded source, and the harness's load method is
  unstated.
- Fix:
  - The contract is now recorded in `docs/design/grounding/2026-10-07-claude-code-platform.md` §5. C
    cites it.
  - WU-43's harness reads `.claude/workflows/*.js` as text, takes out the `meta` literal, and runs the
    body in an `async function` with fakes for the globals.
  - The scripts use the `.js` extension.

**S15 (confirmed, low). The budget gate turns "about 20 divines" into a hard ceiling.**
- Fix (A and C), **D-219, PROPOSED, flagged to the user:**
  - at most 20 divines passes;
  - more than 20 and up to 22 passes with a "near the ceiling" note in the guide;
  - more than 22 fails.

  The user may change the tolerance.

**S16 (confirmed, low). Nothing stops the guides root sitting inside the builds folder.**
- Fix (A), **D-220:** `guide_run new_run` and `compile_plan` refuse a guides root whose real path equals,
  is inside, or contains the builds folder. New AC-P.

**S17 (confirmed, low). AC-P37's fixed 100 s threshold runs in the parallel test gate.**
- Fix (A): `compilePlanNfr.test.ts` runs as a separate `--runInBand` step of the `mise run test` task.
  That task is pipe-free (CLAUDE.md). The main Jest run excludes it.

**S18 (confirmed). AC-K24 tests on empty sets.**
- Fix (B): set 2 is made with `copy {id:1}`. The golden set 1 has `Charm 1` = item 5 and socket groups.

**S19 (confirmed). AC-K21 is narrower than §2.6 defines.**
- Fix (B): the first clause reads "a line not rated fully parsed **or** a null measurement". The
  converse runs over the whole measured pool, via a Lua query.

**S20 (confirmed). V2's unknown-producer check has no data channel, and the request count is wrong.**
- The problems: V2's producer-unknown check needs Lua lookups, and S2-5's request count leaves out the
  fixed steps.
- Fix (A), **D-221:**
  - `compile_check` returns, for each producer the plan names, whether it exists.
  - S2-5 is reworded: one request per stage, plus a fixed overhead of preflight, `new_build`,
    `compile_finish`, the XML export and the session's snapshot export.
  - New AC-P: the engine request count equals stages + the fixed overhead.

**S21 (confirmed, low). The preflight's config baseline mutates the user's build.**
- Fix (A): the preflight's config baseline comes from the defaults loop over
  `LoadModule("Modules/ConfigOptions")`, not from `CreateConfigSet`. A-P12's "mutates nothing" becomes
  true, and an AC checks the user's config-set count is unchanged.

**S22 (partial). The "possibly unread" scan has no mechanism, because headless PoB can't list files.**
- Surviving claim: headless PoB can't list files, and WU-32 names no mechanism for the scan.
- Refuted: the cite slip. `toolSchemas.ts:388` is correct.
- Fix (B): the server scans PoB's `Modules/` and `Classes/` once per process with Node `fs`, and passes
  the identifier names to Lua.

## Afterwards

- The three fixers applied the plan.
- A consistency pass reconciled the four files. The result: 20 WUs, no dependency cycles; ACs AC-K1…46,
  AC-P1…50, AC-W1…26 and AC-B1…8; contracts C-30…C-50; decisions D-100…D-238.
- The resolutions file was folded in as D-222…D-238 plus A-31 and A-32, then deleted.

## Questions for the user

All of these are PROPOSED until the user answers:
- **S3-4:** the survival floor gates fire, cold and lightning resistance at their caps; chaos is reported
  only.
- **D-219:** the budget tolerance.
- **D-210:** ask before discarding unsaved work in the loaded build.
