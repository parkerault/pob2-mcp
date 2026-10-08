# Build-guide spec: gap analysis (2026-10-07)

Inputs:
- the design doc `docs/design/2026-10-07-build-guide-workflow.md` (rows 1–49);
- the grounding reports in `docs/design/grounding/`;
- the review record;
- the recon `docs/build-guide/recon.md`.

Status: the user accepted every PROPOSED item on 2026-10-07 and settled item 4. Item 32 is a human
gate at M-4.

Legend:
- **PROPOSED:** the formalizer's decide-and-record. It lands in the spec unless the user objects.
- **DECIDE:** needs the user.
- **DEFER:** stays a named gate.

## Boundaries and scope

1. **The alpha exit.** M-4 is the Titan / Blood Hunt run, accepted by the user's sign-off after they play it,
   plus objective checks:
   - V1–V4 pass;
   - the import code round-trips;
   - one loadout per stage.

   Not in alpha: plugin packaging, per-agent engines, and unique-jewel trade rows. **PROPOSED.**
2. **Where the skill and workflows live.** Project scope: `.claude/skills/build-guide/` and
   `.claude/workflows/` in this repo. The repo has no `.claude/` today. User scope is the plugin's job,
   later. **PROPOSED.**
3. **Re-running and versioning.** Each run writes a new dated folder, `<guides>/<slug>/<YYYY-MM-DD>-<n>/`,
   and never overwrites an earlier run. Re-compiling within a run overwrites that run's own outputs.
   **PROPOSED.**

## Functional completeness

4. **The guides folder default (row 35).**
   - Recommended: `Guides`, a sibling of the builds folder, e.g. `…/Path of Building (PoE2)/Guides`. It
     is visible in Windows Explorer and sits outside the folder PoB2 browses.
   - Overridable with the new `POB_GUIDES_DIRECTORY`.
   - Jest redirects it to a temp folder, like the builds folder.

   **Settled by the user, 2026-10-07:** the recommendation.
5. **How the plan reaches the server.**
   - Agents write `plan.json` with their file tools.
   - `compile_plan` reads it only from inside the guides folder: no path traversal, no symlinks out.
   - The compiler writes:
     - the PoB file into the builds folder through `buildFileWriter`;
     - `compile-record.json` and the import code into the run folder.

   **PROPOSED.**
6. **How compile runs.** One `compile_plan` tool call holds the session lock and sends one engine
   request per stage, so each request stays under its 30 s timeout. A `stages` argument compiles a
   subset, so a large plan can be compiled in parts if a whole-plan call nears the client's 120 s
   limit. A spike (WU-S) measures compile time first. **PROPOSED.**
7. **How checkpoint 1 is presented.**
   - The skill shows the concepts as a short comparison: synergy, numbers, key prices, risks, and what
     PoB can't verify.
   - It asks with AskUserQuestion: pick one, ask for more, or stop.
   - The full dossier is in the run folder.

   **PROPOSED.**
8. **The run log.** Each run writes `run-log.json` to its folder: stage times, agent counts, retries, and
   the price searches used. Row 27 needs this to measure cost. **PROPOSED.**

## Non-functional requirements

9. **Compile speed.** A 15-stage plan compiles in at most 100 s on this machine. The spike WU-S sets
   the real figure; if the spike misses, it becomes a human gate. **PROPOSED.**
10. **The pricing pace.** It stays inside every rate-limit window the server tracks, and never triggers a
    429. Measured, not capped (row 33). **PROPOSED.**
11. **The first run's cost.** At most 3 concepts and 3 verify lenses (row 27). The run log records
    actuals. **PROPOSED.**

## Errors and edge cases

12. **Compile errors.** Compiling is all-or-nothing per call. An error in any stage writes no PoB file
    and returns the error per stage: an unknown gem, an item text that doesn't parse, an unknown node,
    or a broken weapon-set or attribute choice. **PROPOSED.**
13. **Plan validation.** Schema errors come back with the JSON path, and nothing is compiled.
    **PROPOSED.**
14. **Trade unavailable** (no cookie, rate-limited, or down). Those prices are recorded as
    "unavailable". The guide can't claim a variant is under budget, and checkpoint 2 shows that
    explicitly. Nothing is guessed. **PROPOSED.**
15. **The engine crashes mid-compile.** The session's existing recovery runs (C-5), and the compile call
    fails. Re-running is safe because compiling is idempotent: the same plan gives the same output.
    **PROPOSED.**
16. **No viable concept, or a concept that fails, or a check that fails.** Covered by row 41: two
    retries, then escalate. **settled.**

## Data ownership and lifecycle

17. **The plan schema.**
    - JSON, with `schemaVersion`.
    - Validated by **zod**, which is already a direct dependency (`package.json`, `zod ^3.25.76`), so no
      dependency change.
    - Agents get the schema as a committed reference with a worked example. `compile_plan` has a
      validate-only mode that returns the errors.

    **PROPOSED.**
18. **C1 (campaign data) and E1 (enemy profiles) are sourced data files, not code.**
    - They live under `data/campaign/` and `data/enemies/`, JSON with a citation and patch per value.
    - The compiler and checks load them, and the agents read them.
    - Per-guide values are copied into the plan, so a guide stays reproducible.
    - This **diverges from D-3 and D-30** ("no constants of our own in advice"). Justification: these are
      cited game facts tied to a patch, not invented advice thresholds.
    - They stay out of `src/` strings, so the static scans and the empty waiver files stay as they are.

    **PROPOSED.**
19. **Prices are recorded in the plan,** with date, league and query. Re-runs within a run reuse the
    recorded prices. The server keeps **no price cache**, which keeps **D-46** ("trade responses are
    never cached") intact. This replaces the review's "cached within a run" wording. **PROPOSED.**
20. **The compile record and ledger.** The compile record holds per-stage outputs, keyed by named
    fields. Ledger formulas reference those names, and the compiler evaluates them with a small safe
    arithmetic evaluator. No `eval`, and no new dependency. **PROPOSED.**

## Dependencies and integration

21. **Web research.** Agents use WebSearch and WebFetch:
    - allowed: poe2db.tw, maxroll.gg, game8, poe-vault and patch-note mirrors;
    - never pathofexile.com or poe.ninja (the standing rule);
    - poe2wiki.net and mobalytics refuse agent fetches.

    **PROPOSED.**
22. **The Workflow tool might be unavailable or not enabled.** The skill then falls back to running the
    same stages with the Agent tool. Same artifacts, no fan-out beyond 3. **PROPOSED.**

## Interfaces and contracts

23. **Growth of the tool surface.** Each tool's schema is sent to the model in every session, so growth
    costs tokens. Where it's natural, existing tools are extended rather than duplicated:
    - `search_tree_nodes` gains `ascendancy`;
    - `set_main_skill` gains a skill-part selector;
    - `lua_get_stats` gains a per-skill breakdown;
    - `add_item` gains jewel slots.

    The new tools are grouped: one gem/unique/mechanic lookup tool with modes, one coverage check, one set
    tool, one tree-state tool, `compile_plan`, and `encode_build_code`. The target is no more than 8 new
    tools, which keeps the total under 86. **PROPOSED.**
24. **Contract deltas.**
    - D-77 and D-78 are amended per row 43.
    - C-1's stale count of 76 is corrected.
    - The hard-coded count of 77 moves to the new total in four tests and `scripts/fresh-clone-check.mjs`.

    **PROPOSED.**
25. **Existing defects in scope** (found by recon):
    - `update_tree_delta` neither auto-paths nor enforces the ascendancy cap that it describes;
    - `set_main_selection` writes PoB1's `skillPart`, not PoB2's `statSet`;
    - the two `search_tree_nodes` bugs;
    - D-65's text is stale.

    All fixed or corrected in slice 1. **PROPOSED.**
26. **The engine-kind rule for new tools.** A tool marked `read` must leave the exported build and the
    revision counter unchanged (`engineKinds.test.ts`). So lookups and measurements of a non-main skill
    part restore the exact prior state, and a test proves it. **PROPOSED.**

## Security and permissions

27. **Write roots.**
    - The server writes only to the builds folder (through `buildFileWriter`), the state folder, and
      the guides folder.
    - The guides folder joins the allowed roots, with the same no-traversal and no-symlink rules.
    - Agents write only into the current run folder.

    **PROPOSED.**
28. **Secrets and identity.** The rules are unchanged: never read `.env`, no identity in requests, trade
    only through the server. Research agents get no trade tools; only the coordinator prices.
    **PROPOSED.**

## Acceptance thresholds

29. **What V4 checks:**
    - every ledger entry is re-derived;
    - every claim tagged "external" has its source opened;
    - PoB-data claims are re-checked with the lookup tools: all of them in the endgame sections, and at
      least 1 in 5 elsewhere.

    The guide passes only with no unresolved finding. **PROPOSED.**
30. **The import code.** `encode_build_code` output decodes back to XML whose sets, loadouts, level mode
    and stage count match the compiled file. **PROPOSED.**

## Autonomy and guardrails

31. **Live requests during the build.** None: tests and agents stay offline (D-34). M-3's end-to-end
    pipeline test runs with trade and poe.ninja disabled, and prices show as "unavailable".
    **PROPOSED.**
32. **The live alpha run (M-4).** The coordinator runs the Titan / Blood Hunt pipeline with:
    - live trade and poe.ninja requests through the server, paced;
    - web research on the allowed hosts;
    - the guide written to the guides folder and the PoB file to the builds folder.

    This needs the user's approval, as the stabilization smoke test did. **DEFER:** the user hasn't
    approved it yet. It is a human gate at the start of M-4, and the coordinator asks then.
33. **Human gates for the build:**
    - any dependency change;
    - a PoB2 pin change (row 40, deferred);
    - any change to an existing tool's contract beyond rows 43 and 24;
    - the WU-S spike missing its compile-time budget.

    **PROPOSED.**

## Risks

34. **The risk register:**
    - compile time against the client's limits (spike WU-S);
    - quality of the concepts on off-meta pairings (first-run measurement);
    - PoB modeling gaps (the ledger plus V4);
    - trade rate limits (pacing);
    - 1.0 in nine weeks (row 39);
    - the Workflow tool's availability (item 22);
    - the token cost of the tool surface (item 23).

    **PROPOSED.**

## Deferred (named gates)

35. These carry their unblocking conditions from the design doc:
    - plugin packaging (row 36);
    - the pin upgrade (row 40);
    - unique-jewel trade rows (row 37);
    - per-agent inline engines (row 30).

    **DEFER.**
