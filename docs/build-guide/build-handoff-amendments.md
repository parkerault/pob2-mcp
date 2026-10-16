# Build handoff: amendments 2 and 3 (M-14)

Written 2026-10-10 by the coordinator session for the build fleet. Every build agent reads this file
first. If anything here conflicts with the spec, the spec wins, and you report the conflict. It replaces
`build-handoff.md` (the M-10…M-12 build) for this run; that file's history stays as written.

## M-16: amendment 5, gear pricing (read this first)

Added 2026-10-16. For this build, this section overrides the M-15 section and "What to build" below; the other
sections ("Worktrees and branches" onward) still apply as written. M-16 is this handoff's label for the build; the
spine gets it at the v1.6 fold.

- **Spec.** `docs/build-guide/spec/amendment-5-pricing.md` is binding for this build: D-370…D-375, WU-74…WU-76
  (§9) and their ACs. It is not folded into the spine and slices yet; the fold to v1.6 follows the build. Where the
  amendment and the slices' current text disagree inside D-370…D-375's scope, the amendment wins; anywhere else
  the spine and slices bind, and you report a conflict.
- **Background, not requirements:** `studies/2026-10-16-pricing.md` (the conversion table's source, its §2 for
  league dates) and `../worklog.md`, "pricing strategy, a detour before the reference-build run".
- **Ratified.** The user accepted amendment 5 on 2026-10-16, D-375 included.
- **Directive.** Build WU-74, then WU-75, then WU-76, in series; the coordinator merges each before the next
  starts. The Lightning Arrow Deadeye reference run is the coordinator's and the user's, after M-16.
- **HG-12 is granted for WU-74 only:** `find_upgrades`' output gains C-49's `League:` and `Checked:` lines, and a
  stop for a trade-site limit carries C-49's `[trade:<kind>]` prefix with the `TradeErrorKind`. Its arguments,
  ranking and the rest of its output stay as they are. Any other tool-contract change is still HG-12: stop and
  report `blocked`.
- **`data/economy/prices.json`** (WU-75) holds the conversion table (amendment §5) and the league table as
  `judgment` facts, confidence L, citing the study, in the form `data/campaign/gems.json` uses for D-359's socket
  estimate. League start dates are the study's day-0 dates. Give an `end` only for Dawn of the Hunt, Rise of the
  Abyssal and Fate of the Vaal (each data range's last date); Runes of Aldur and Forbidden Rites have none, and
  D-373's day-60 rule reads Runes of Aldur as late.
- **Network.** None. Tests use `fixtureFetch` and never contact the trade site or poe.ninja (D-34). Never read
  `.env` or set `POESESSID`; a test that needs a session uses a fake value, as the existing `find_upgrades` tests
  do.
- **Tool count.** No tool is added: the counts stay as they are. If a tool's description changes, regenerate the
  README table (`pnpm build && pnpm docs:tools --write`).
- **Done means:** amendment 5's ACs (AC-T46, AC-K67, AC-W63, AC-W64) pass; `mise run test` and `pnpm build`
  exit 0 from a clean tree; both waiver files are `[]` (AC-B2); dependencies are unchanged (AC-B7).
- **Cost.** Keep context lean: read the amendment whole (it is short) and the files it names by the lines you
  need; run targeted Jest suites while you work, and the full gate once at the end.

## M-15: amendment 4, the lean pipeline (read this first)

Added 2026-10-11. For the M-15 build, this section overrides "What to build" below and adds to the other
sections, which still apply as written.

- **Spec v1.5** (folded at `ba9daf8`). The spine `docs/build-guide/spec/README.md` holds:
  - decisions through D-362, and A-34 and A-35;
  - M-15 in §7;
  - WU-64…WU-72 in §8, with amendment 4's lanes.

  The slices hold the unit blocks and ACs:
  - `01-server-tools.md`: WU-66's path tools, AC-K66;
  - `02-plan-compiler.md`: WU-65…WU-68 (§5), AC-P60…AC-P67 (§6);
  - `03-pipeline.md`: WU-64 and WU-69…WU-72, AC-W51…AC-W60 (§13).

  Text marked *Target (WU-nn, D-nnn)* is what you build.
- **Background, not requirements:**
  - `spec/amendment-4-cost-and-scope.md`;
  - the three reports `studies/2026-10-11-cost-1-mechanics.md`, `…-cost-2-claims-and-rules.md` and
    `…-run-a-issues.md`.
- **Ratified.** The user signed off every amendment 4 change on 2026-10-11. D-345…D-362, A-34 and A-35 are
  settled.
- **Directive.** Build WU-64…WU-71. WU-72, the lean recorded run, belongs to the coordinator and the user.
- **Done means:**
  - M-15's exit (spine §7) holds at the integration head;
  - `mise run test` and `pnpm build` exit 0 from a clean tree;
  - both waiver files are `[]` (AC-B2);
  - dependencies are unchanged (AC-B7).
- **HG-12 is granted for WU-66 only.** The grant covers changing `find_path_to_node` and `get_nearby_nodes`
  exactly as D-360 and C-1 state: their paths never open a second tree on one start, and their arguments and
  output format stay unchanged. Every other tool-contract change is still HG-12: stop and report `blocked`.
  WU-68's `guide_run` views are inside C-50's target (D-356), not a new contract.
- **Network.** No M-15 unit needs poe.ninja, and none contacts it. GitHub (`mise run pob:fetch`) and the npm
  registry only.
- **Serialized files for M-15.** The coordinator merges one unit at a time, in this order:
  - `pob-api/API/Compile.lua` and `src/plan/checks/v1.ts`: WU-65, then WU-66, then WU-67 (`v1.ts`);
  - `src/plan/schema.ts`: WU-65 only, the version-3 bump. Validators accept versions 1, 2 and 3;
  - `src/handlers/planHandlers.ts`: WU-65 (the reply), then WU-68 (the views);
  - the skill (`SKILL.md`, `references/`, `templates/`, the agent definitions), `check-run.mjs` and
    `tests/static/buildGuidePipeline.test.ts`: WU-69, then WU-70, then WU-71.
- **Tool count.** M-15 adds no tool: the counts stay 84, and 83 without poe.ninja. WU-68 changes `guide_run`'s
  schema and description, so it regenerates the README table (`pnpm build && pnpm docs:tools --write`).
- **Engine wiring.** A unit that changes a Lua reply updates `src/engine/schemas.ts`, `src/pobLuaBridge.ts`
  and `tests/integration/contract.test.ts` (AC-B3, AC-B4, AC-B5).
- **Cost.** The point of amendment 4 is a cheaper pipeline, so keep your own context lean:
  - read the spec by unit block, AC and the sections they cite, not whole files;
  - run targeted Jest suites while you work, and the full gate once at the end.

## What to build

- **Spec.** `docs/build-guide/spec/README.md` is the spine, v1.3:
  - contracts C-30…C-54;
  - decisions D-100…D-334;
  - the autonomy envelope (§6) and milestones (§7), M-14 among them;
  - the work-unit graph, its amendment lanes and the serialized-wiring rule (§8);
  - guardrails (§9);
  - the test strategy, with the cross-cutting ACs AC-B1…AC-B8 (§12).

  The slice specs hold the work-unit blocks and acceptance criteria:
  - `01-server-tools.md`: WU-50, WU-52, WU-53, WU-54, WU-60 (target ACs AC-K47…AC-K52);
  - `02-plan-compiler.md`: WU-51, WU-55, WU-61 (AC-P51…AC-P59);
  - `03-pipeline.md`: WU-56…WU-59, WU-62 (AC-W2 (v)…(ee), AC-W27…AC-W33, and the target clauses of AC-W5,
    AC-W11 and AC-W14).

  Text marked *Target (WU-nn, D-nnn)* is what you build. The as-built text beside it is what exists today.
- **Background, not requirements:**
  - the amendments: `spec/amendment-1-simplify.md`, `amendment-2-guide-style.md`, `amendment-3-open-builds.md`.
    They record why; the spine and slices are binding.
  - `docs/build-guide/worklog.md`, the section "Spec fold v1.3 (2026-10-10)": the gap resolutions F1–F27.
  - `docs/build-guide/pob-gaps.md` (PG-n) and `docs/build-guide/studies/` (the 34 study reports).
  - The stabilization spine `docs/stabilization/spec/README.md` ("stab") still binds wherever this spine
    cites it.
- **Ratified.** The user approved amendments 2 and 3 and the fold. Treat every PROPOSED decision
  (D-317…D-334) as settled.
- **Directive.** Build WU-50…WU-58 and WU-60…WU-62. WU-59, the offline run with an open brief, is the
  coordinator's: it is recorded like WU-47, in an interactive session (D-263), after WU-58. WU-48 (the
  live run) is not part of this build.
- **Done means:** M-14's exit (spine §7) holds at the integration head. That includes:
  - `mise run test` and `pnpm build` exiting 0 from a clean tree;
  - both waiver files empty (AC-B2);
  - unchanged dependencies (AC-B7).

## Worktrees and branches

- **Integration worktree:** `/home/parker/projects/pob2-mcp-wt/amend`, branch `build-guide/amendments`,
  branched off this handoff's commit. Work lands here, unit by unit, in DAG order. The coordinator writes
  the work-log `docs/build-guide/worklog.md` only here.
- **Lane worktrees:** `/home/parker/projects/pob2-mcp-wt/bg-<nn>`, on branch `bg/wu-<nn>`, created off the
  integration head current when the unit starts.
  - A lane is rebased onto `build-guide/amendments`, then fast-forward merged, then removed.
- **Never touched by the fleet:** the main checkout `/home/parker/projects/pob2-mcp` (branch
  `build-guide/amendment-3`). The user's pob2 MCP server runs from its `build/`.
- **Directory discipline.** `cd` to your worktree's absolute path at the start of every Bash call, because
  subagent cwd drifts.
- **Bootstrap a new worktree:**
  ```
  mise trust && pnpm install --frozen-lockfile && mise run pob:fetch
  git config --worktree commit.gpgsign false
  ```

## Gate commands (from the worktree root)

```
cd <worktree> && rm -rf build coverage && pnpm exec jest --clearCache >/dev/null
mise run test; echo "test rc=$?"     # builds, then the full Jest suite and the NFR --runInBand step
pnpm build;    echo "build rc=$?"
```

A unit is done only when an independent verifier, never the doer, confirms the five unit-gate checks:

1. Both exit codes are 0.
2. Every AC the unit owns maps to a named passing test, or a recorded script check. That test or check
   meets the fidelity rule: it asserts the spec, not the as-built, through the real code path.
3. The code-diff review is clean.
4. `tests/fixtures/tool-hygiene-allowlist.json` and `tests/static/poe1-cruft-waivers.json` are `[]`.
5. No files changed outside the unit's `touches` (the spine §8 table plus the slice block), apart from its
   implied scope and the serialized wiring files.

A spike or content unit with no code (WU-50, WU-51, WU-56) gates on its script check or static tests and
on `pnpm exec jest tests/static`. The full gate runs at the wave gate.

**Timing ACs under load.** These can false-fail while several worktrees run suites at once:
- this epic's NFR-20 and NFR-21 compile-time ACs;
- stab AC-E8, AC-F3, AC-F10, AC-T22, AC-T34 and AC-T40.

If one fails on time alone, re-run it in isolation. Record "tooling false-failure" only if that passes.

## Wiring and counts (spine §8)

- **Serialized files.** They are listed in spine §8. The amendment units add:
  - `Lookup.lua`: WU-60, then WU-53;
  - `src/plan/schema.ts`, `src/plan/checks/v1.ts` and `plan-reference.md`: WU-55 and WU-61;
  - the skill's `SKILL.md`, `check-run.mjs`, `guide-template.md`, `build-guide-coordinator.md` and the
    pipeline tests: WU-62, then WU-57, then WU-58.

  Edit them in short wiring steps. The coordinator merges one unit at a time, in DAG order, and a lane
  rebases before it merges.
- **Engine wiring.** WU-53, WU-54, WU-55 and WU-60 each change an engine action's reply. Each one updates
  that action's reply schema in `src/engine/schemas.ts`, its wrapper types in `src/pobLuaBridge.ts`, and its
  case in `tests/integration/contract.test.ts` (AC-B3, AC-B4; AC-B5 for WU-55).
- **The schema bump (D-320).** WU-55 and WU-61 both change the plan schema. Whichever merges first makes
  §3.2's `schemaVersion` bump, and the second extends it. Validators accept versions 1 and 2 (D-332).
- **Tool counts.** WU-52 is the only unit that adds tools: the poe.ninja tools in group `ninja`, their
  number set by WU-50. It restates every count site in spine §1.3 and regenerates the README table with
  `pnpm build && pnpm docs:tools --write`. Never hand-edit the table. The count without poe.ninja stays 83
  (D-316).
- **New Lua.** It goes in the module the unit names. `BuildOps.lua` edits stay inside the functions your
  unit names.

## Commits

- Commit only inside your worktree, with `git -c commit.gpgsign=false commit …`. Pass
  `-c commit.gpgsign=false` to `rebase`, `merge`, `cherry-pick` and `revert` too: a signing prompt hangs an
  agent.
- Messages are `<type>(WU-nn): <what>`, ending with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never push. The coordinator sign-rebases with the user present at the end (HG-8).

## Hard rules (spine §9; breaking one is unrecoverable)

- **Secrets.** Never read, print, grep, cat, source or copy any `.env`. Never set `POESESSID`. Worktrees
  have no `.env`; don't copy one in.
- **Network.**
  - **Allowed:** GitHub (`mise run pob:fetch`) and the npm registry.
  - **poe.ninja (D-297):** only the units whose block says so (WU-50 now; WU-52 to record fixtures). Every
    request must follow these rules:
    - send one request at a time, at least 3 s apart;
    - on HTTP 429 or 5xx, stop and wait at least 60 s before one retry;
    - cache every response in your temp dir, and never fetch a URL twice;
    - use `curl` with the server's User-Agent `pob2-mcp-server/<package.json version>` (stab D-25), and no
      cookie, name, email or other identifying header;
    - fetch poe.ninja URLs only, and only ones reached from poe.ninja itself;
    - keep the total small: a few dozen requests, not a crawl.
  - **Forbidden:** pathofexile.com, and every other host, including through WebSearch and WebFetch. Links
    found on poe.ninja that lead elsewhere (a GitHub repo, a forum thread) are recorded in your report, not
    opened.
  - **Tests** reach HTTP only through `fixtureFetch` and committed fixtures (D-34).
  - Anything else that seems to need a live request is HG-1: stop and report.
- **Filesystem.** Write only inside your worktree and temp dirs, made with `mktemp -d`. Never touch
  `/mnt/c/...`, the user's builds and guides folders (HG-6). A probe that starts the server or the engine
  runs from a temp cwd, with `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY` pointed at temp
  dirs. Don't use the session scratchpad, which other agents share.
- **Identity.** No name or email in any request, fixture or file content, except git authorship.
- **Dependencies.** No unit changes `package.json`'s dependency sections or `pnpm-lock.yaml` (HG-10, AC-B7).
- **Agents.** You are a leaf worker:
  - don't spawn subagents, and don't call the Workflow tool;
  - never start a headless `claude -p` session (D-263);
  - don't use the Serena MCP tools (its one shared instance points at the wrong checkout). Use Read, Grep
    and Bash.
- **The pob2 MCP tools** (`mcp__pob2__*`) run the user's server from the main checkout, not your lane's
  code. Don't use them to test your unit. Test through Jest and temp-dir probes against your worktree's
  build.

## Known friction (from the M-10…M-12 build)

- **Running tests.**
  - `luajit` is on PATH only under mise. Run targeted suites as `mise exec -- pnpm exec jest <path>`, or run
    `mise run test`.
  - Long Jest runs need an explicit Bash timeout of up to 600000 ms, so they aren't backgrounded.
  - A stale `build/` fails the README table test (AC-G1) after a rebase that adds tools: run `pnpm build`.
- **Probing the engine.**
  - `mise exec -C <dir>` changes cwd and breaks vendor-relative Lua scripts. Prefer driving the engine
    through the server.
  - In-process tests can't call `ctx.client.loadBuildXml` (EngineLoadGuardError). Reload through
    `session.run` with kind `load`.
- **Engine data quirks.**
  - dkjson encodes an empty Lua table as `[]`, so a reply schema must accept `[]` for an empty map.
  - Headless PoB's `GetTime()` returns 0. Time Lua work with `os.clock`.
  - PoB's `SaveDB` attribute and element order varies between processes, so compare XML canonically.
  - The WSL2 wall clock can step backwards. Measure durations with `performance.now()`.
- **Harmless warnings.** `tsc -p tsconfig.test.json` reports TS6059 rootDir errors, and Jest prints "worker
  process has failed to exit gracefully". Both predate this epic; ignore them.
- **Tool quirks.**
  - Write and Edit refuse a file you haven't Read first.
  - The permission classifier has blocked `git rm`. Use plain `rm`, then `git add -A <path>`.
- **Static tests.** `tests/static/buildGuidePipeline.test.ts` pins some skill and spec text word for word.
  When you change pinned text, update the assertion in the same commit and say so in your report.

## Autonomy

- **Decide and record.** When the spec is silent on an implementation detail, make the smallest choice
  consistent with the contracts and the conventions (spine §1.2). Report it under `deviations`, with a
  one-line rationale. The coordinator folds these into the spine.
- **Spec edits.** Don't edit the spec files, with one exception: a unit that A-33 names (WU-53, WU-54)
  pins its criteria in its slice's §4 as its first step, then stops for the coordinator's review.
  - A spike's settled values go in its report. The coordinator records them in the spine.
- **The spec looks wrong.** If the real code or the pinned PoB2 makes an AC unachievable, implement the
  closest faithful behaviour and report a deviation with `file:line` evidence. Report `blocked` instead if
  the fix would change any of these:
  - a tool contract, or the tool surface beyond C-37…C-54 (HG-12);
  - a dependency (HG-10);
  - the pin (HG-11).
- **Stop conditions.** On a stop, report `blocked` with evidence. Independent lanes continue.
  - A human gate fires: stab HG-1…HG-9, or spine HG-10…HG-22.
  - The same gate failure signature comes back three times in a row (`blocked:loop`).
  - A unit needs a file owned by a unit that hasn't merged yet.

## Reporting (doers)

End with a terse report, under 40 lines:
- the head commit;
- each owned AC, mapped to its test (file and test name) or script check;
- the gate exit codes;
- `deviations`, one line each, with rationale;
- `friction`: tooling traps the next unit will hit;
- `blocked`, with evidence, if any.

No diffs, no logs.

## Notification path

Agent results return to the coordinator session. It records each verdict in the work-log the moment it's
made, and surfaces any STOP to the user (in chat, plus a push notification). It writes a compact resume
handoff before its context grows large.
