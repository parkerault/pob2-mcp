# Build handoff: build-guide epic

Written 2026-10-08 by the coordinator session for the build fleet. Every build agent reads this file
first. If anything here conflicts with the spec, the spec wins, and you report the conflict.

## What to build

- **Spec.** `docs/build-guide/spec/README.md` is the spine: contracts C-30…C-50, decisions
  D-100…D-238, the autonomy envelope (§6), milestones (§7), the work-unit graph and the
  serialized-wiring rule (§8), guardrails (§9), and the test strategy with the cross-cutting ACs
  AC-B1…AC-B8 (§12). Three slice specs hold the work-unit blocks and acceptance criteria:
  - `01-server-tools.md`: WU-31…WU-36, WU-49 (AC-K1…AC-K46)
  - `02-plan-compiler.md`: WU-30, WU-37…WU-42 (AC-P1…AC-P50)
  - `03-pipeline.md`: WU-43…WU-48 (AC-W1…AC-W26)

  Background, not requirements: `docs/build-guide/recon.md` (existing seams),
  `docs/design/grounding/` (PoB internals, the Claude Code platform, external game data),
  `docs/build-guide/spec-review-2026-10-07.md` (why the spec says what it says). The stabilization
  spine `docs/stabilization/spec/README.md` still binds wherever this spine cites it ("stab").
- **Ratified.** The user approved the spec for implementation on 2026-10-08 and settled the three
  questions put to them (D-210, D-219, D-234). Treat every PROPOSED decision as settled.
- **Directive.** Build WU-30…WU-47 in one run. WU-47 is the coordinator's recorded offline pipeline
  run. WU-48 (the live Titan / Blood Hunt run) is human, behind HG-14, and is not part of this run.
- **Done means:** the M-10, M-11 and M-12 exits (spine §7) hold at the integration head, including
  `mise run test` and `pnpm build` exiting 0 from a clean tree, both empty waiver files (AC-B2), and
  unchanged dependencies (AC-B7).

## Worktrees and branches

- **Integration worktree:** `/home/parker/projects/pob2-mcp-wt/guide`, branch `build-guide/build`,
  branched off `b34db2a`. Work lands here, unit by unit, in DAG order. The work-log
  `docs/build-guide/worklog.md` is written only here, by the coordinator.
- **Lane worktrees:** `/home/parker/projects/pob2-mcp-wt/bg-<nn>` on branch `bg/wu-<nn>`, created off
  the integration head current when the unit starts. A lane is rebased onto `build-guide/build`, then
  fast-forward merged, then removed.
- **Never touched by the fleet:** the main checkout `/home/parker/projects/pob2-mcp` (branch
  `stabilization/foundation`) and the stabilization worktree `/home/parker/projects/pob2-mcp-wt/build`.
- **Directory discipline.** `cd` to your worktree's absolute path at the start of every Bash call.
  Subagent cwd drifts.
- **Bootstrap a new worktree:** `mise trust && pnpm install --frozen-lockfile && mise run pob:fetch`,
  then `git config --worktree commit.gpgsign false`.

## Gate commands (from the worktree root)

```
cd <worktree> && rm -rf build coverage && pnpm exec jest --clearCache >/dev/null
mise run test; echo "test rc=$?"     # builds, then the full Jest suite (C-19; after WU-41 also the NFR --runInBand step)
pnpm build;    echo "build rc=$?"
```

A unit is done only when an independent verifier, never the doer, confirms the five unit-gate checks
(stab §12, with this spine's touches and wiring list):

1. Both exit codes are 0.
2. Every AC the unit owns maps to a named passing test, or a recorded script check, that meets the
   fidelity rule: it asserts the spec, not the as-built, through the real code path.
3. The code-diff review is clean.
4. `tests/fixtures/tool-hygiene-allowlist.json` and `tests/static/poe1-cruft-waivers.json` are `[]`.
5. No files outside the unit's `touches` (spine §8 table plus the slice block) changed, apart from its
   implied scope and the serialized wiring files.

**Timing ACs under load.** Timing assertions (this epic's NFR-20/NFR-21 compile-time ACs; stab AC-E8,
AC-F3, AC-F10, AC-T22, AC-T34, AC-T40) can false-fail while several worktrees run suites at once. If one
fails on time alone, re-run it in isolation; record "tooling false-failure" only if that passes.

## Wiring and counts (spine §8)

- The serialized files are listed in spine §8. Edit them in short wiring steps; the coordinator merges
  one unit at a time in DAG order, and a lane rebases before it merges.
- A tool-adding unit (WU-31, WU-32, WU-35, WU-36, WU-40; WU-41 adds two) moves every count site in
  spine §1.3 by its own new tools from its rebased base, and regenerates the README table with
  `pnpm build && pnpm docs:tools --write`. Never hand-edit the table.
- New Lua goes in new modules registered by one line in `pob-api/API/Handlers.lua`. `BuildOps.lua`
  edits stay inside the functions your unit names.

## Commits

- Commit only inside your worktree, with `git -c commit.gpgsign=false commit …`; pass
  `-c commit.gpgsign=false` to `rebase`, `merge`, `cherry-pick` and `revert` too. A signing prompt hangs
  a headless agent.
- Messages: `<type>(WU-nn): <what>`, ending with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never push. The coordinator sign-rebases with the user present at the end (HG-8).

## Hard rules (spine §9; violating them is unrecoverable)

- **Secrets.** Never read, print, grep, cat, source or copy any `.env`. Never set `POESESSID`.
  Worktrees have no `.env`; don't copy one in.
- **Network.** Allowed: GitHub (`mise run pob:fetch`) and the npm registry. Forbidden: pathofexile.com,
  poe.ninja and every other host, including WebSearch and WebFetch. Tests reach HTTP only through
  `fixtureFetch`. A unit that seems to need a live request is HG-1: stop and report.
- **Filesystem.** Write only inside your worktree and temp dirs (use `mktemp -d`). Never touch
  `/mnt/c/...` (the user's builds and guides folders, HG-6). Probes that start the server or engine run
  from a temp cwd with `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY` at temp dirs.
- **Identity.** No name or email in any request, fixture or file content, except git authorship.
- **Dependencies.** No unit changes `package.json` dependency sections or `pnpm-lock.yaml` (HG-10,
  AC-B7). `zod` and `zod-to-json-schema` are already direct dependencies.
- **Agents.** Don't spawn subagents and don't call the Workflow tool; you are a leaf worker.
  - **No headless sessions (D-263, the user's ruling, 2026-10-08).** The tool is used interactively, so a
    headless `claude -p` session is not a real-world test. Never start one, and don't fix headless-only
    issues. WU-47's runs are interactive sessions the user starts in the isolated environment.
- **Serena.** Don't use the Serena MCP tools: one shared instance points at the wrong checkout. Use
  Read, Grep and Bash.

## Known friction (from the stabilization build)

- `luajit` is on PATH only under mise. Engine-required tests fail with "luajit not found" under a bare
  `pnpm exec jest`; run targeted suites as `mise exec -- pnpm exec jest <path>`, or `mise run test`.
- `mise exec -C <dir>` changes cwd and breaks vendor-relative Lua scripts. Probe scripts that start
  the engine by hand need `LUA_PATH`/`LUA_CPATH` set; prefer driving the engine through the server.
- In-process tests can't call `ctx.client.loadBuildXml` (EngineLoadGuardError); reload through
  `session.run` with kind `load`.
- The WSL2 wall clock can step backwards. Measure durations with `performance.now()`, never `Date.now()`
  differences.
- Write and Edit refuse a file you haven't Read first.
- Long Jest runs: give the Bash call an explicit timeout (up to 600000 ms) so it isn't backgrounded;
  never run `cat > file` without stdin.
- `tsc -p tsconfig.test.json` reports TS6059 rootDir errors that predate this epic; ignore them.
- Jest's "worker process has failed to exit gracefully" warning predates this epic.
- The permission classifier has blocked `git rm`; use plain `rm` then `git add -A <path>`.

## Autonomy

- **Decide and record.** When the spec is silent on an implementation detail, make the smallest
  choice consistent with the contracts and the conventions (spine §1.2), and report it under
  `deviations` with a one-line rationale. The coordinator folds these into the spine. Don't edit the
  spec files yourself.
- **The spec looks wrong.** If the real code or the pinned PoB2 makes an AC unachievable, implement the
  closest faithful behaviour and report a deviation with `file:line` evidence. If it would change a
  tool contract or the tool surface beyond C-37…C-50 (HG-12), or a dependency (HG-10), or the pin
  (HG-11), report `blocked` instead.
- **Stop conditions:** a human gate fires (stab HG-1…HG-9, spine HG-10…HG-15); the same gate failure
  signature three times in a row (`blocked:loop`); a unit needs a file owned by a not-yet-merged unit.
  On a stop, report `blocked` with evidence. Independent lanes continue.
- **WU-30 is a stop-gate.** If it finds a stage request at 20 s or more, or a 15-stage plan above 100 s
  (D-229), that is HG-13 and WU-41 waits for the user.

## Reporting (doers)

End with a terse report, under 40 lines: the head commit; each owned AC mapped to its test (file and
test name) or script check; the gate exit codes; `deviations` (one line each, with rationale);
`friction` (tooling traps the next unit will hit); and `blocked` with evidence, if any. No diffs, no
logs.

## Notification path

Agent results return to the coordinator session, which records each verdict in
`docs/build-guide/worklog.md` the moment it's made, surfaces any STOP to the user (chat plus a push
notification), and writes a compact resume handoff before its context grows large.
