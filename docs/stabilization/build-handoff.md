# Build handoff: stabilization epic

Written 2026-10-04 by the coordinator session for the build fleet. Every build agent reads this file
first. If anything here conflicts with the spec, the spec wins, and you report the conflict.

## What to build

- **Spec.** `docs/stabilization/spec/README.md` is the spine: contracts C-n, decisions D-n,
  autonomy envelope §7, DAG §8, guardrails §9, test strategy §12. Four slice specs hold the
  work-unit blocks and acceptance criteria (AC-n):
  - `01-foundation.md`: WU-01…05
  - `02-engine.md`: WU-06…13, WU-22
  - `03-trade.md`: WU-14…17, WU-23
  - `04-advice-docs.md`: WU-18…21

  Background lives in `docs/stabilization/grounding/ctx-*.md`, cited fact sheets on the existing
  code, Lua, MCP, tooling and external APIs. `vision.md`, `recon.md` and `spikes/` are background,
  not requirements.
- **Ratified.** The user ratified the spec on 2026-10-04, including every PROPOSED decision as
  written: D-49, D-51 (a)–(h), D-53, D-57, and WU-22 on the alpha path. Treat PROPOSED decisions as
  settled.
- **User directive.** Build every non-human unit in one run: WU-02…WU-19, WU-22 and WU-23.
  - There are no intermediate human testing rounds.
  - The human units come at the very end, with the user: the live smoke test (WU-20) and final
    acceptance (WU-21).
  - Until then, nothing waits on the user unless a human-decision gate (spine §7.3) genuinely fires.
- **Done means.**
  - Every AC owned by the units above is green or recorded, per spine §5 M-3 minus the WU-20/21
    sign-offs.
  - The hygiene allowlist and the PoE1-cruft waiver file are both empty (AC-G6).
  - `mise run test` and `pnpm build` exit 0 from a clean tree.

## Worktrees and branches

- **Integration worktree:** `/home/parker/projects/pob2-mcp-wt/build`, branch `stabilization/build`,
  branched off `fd289ba`. Work lands here, unit by unit, in DAG order.
- **Lane worktrees:** `/home/parker/projects/pob2-mcp-wt/<lane>`, branch `build/<lane>`. Each is
  created off a specific `stabilization/build` commit when a parallel lane starts. A lane is rebased
  onto `stabilization/build`, then fast-forward merged into it, then removed.
- **The main checkout** `/home/parker/projects/pob2-mcp` (branch `stabilization/foundation`) is never
  touched by the fleet.
- **Directory discipline.** Always `cd` to your worktree's absolute path before running anything.
  Subagent cwd drifts.
- **Bootstrap a new worktree:** `mise trust && pnpm install --frozen-lockfile && mise run pob:fetch`.
  - `pob:fetch` exists once WU-02 lands.
  - Any mise command run before `mise trust` fails with rc 1.
  - Also run `git config --worktree commit.gpgsign false` in every new worktree.
    `extensions.worktreeConfig` is already on.

## Gate commands (run from the worktree root)

```
cd <worktree> && rm -rf build coverage && pnpm exec jest --clearCache >/dev/null
mise run test; echo "test rc=$?"     # C-19: builds, then runs the full Jest suite
pnpm build;    echo "build rc=$?"
```

Before WU-02 lands, `mise run test` may not exist yet. Use `pnpm build && pnpm test`.

A unit is done only when a fresh verifier, never the doer, confirms all five items of the unit gate
in spine §12:

1. Exit codes are 0.
2. Every AC maps to a named passing test, or a recorded script check, that meets the fidelity rule.
3. The code-diff review is clean.
4. The allowlist and waiver changes are only the sanctioned ones.
5. No files outside the unit's `touches` changed, apart from the implied scope and the serialized
   wiring files.

**Timing ACs under load.** The NFR timing ACs (AC-E8, AC-F3, AC-F10, AC-T22, AC-T34, AC-T40) can
false-fail when several worktrees run suites at once.

- If one fails on time alone, re-run it in isolation before calling it a regression.
- Record "tooling false-failure" only if the isolated re-run passes.

## Commits (D-48)

- Commit only inside your worktree, with `git -c commit.gpgsign=false commit …`. Pass
  `-c commit.gpgsign=false` to `rebase`, `merge`, `cherry-pick` and `revert` too. A signing prompt
  hangs headless agents.
- Commit messages: `<type>(WU-nn): <what>`, ending with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never push. The coordinator sign-rebases with the user present at the end (HG-8).

## Hard rules (spine §9, restated because violating them is unrecoverable)

- **Secrets.**
  - Never read, print, grep, cat or source any `.env` file.
  - Never set `POESESSID`.
  - Worktrees have no `.env`. Do not copy one in.
- **Network.**
  - Allowed: GitHub (`pob:fetch`) and the npm registry.
  - Forbidden: pathofexile.com, poe.ninja and any other host. Tests use the committed fixtures via
    `fixtureFetch`.
  - A unit that seems to need a live trade or ninja request is HG-1: stop and report it.
- **Filesystem.**
  - Write only inside your worktree and temp dirs.
  - Never touch `/mnt/c/...`; the user's real Windows builds folder is HG-6.
  - Probes that start the server or engine run from a temp cwd (`mktemp -d`), never the repo root.
- **Identity.** No name or email in any request, fixture or file content. The User-Agent is D-25's.
- **Dependencies.**
  - Only WU-02 changes `package.json` dependencies or the lockfile.
  - The one sanctioned exception is WU-14, which removes `bottleneck`.
  - Any other dependency need: stop and report.
- **Serena.** Do not use the Serena MCP tools. One server instance is shared by concurrent worktrees,
  so it would point at the wrong checkout. Use Read, Grep and Bash.

## Autonomy

- **Decide and record (spine §7).** When the spec is silent on an implementation detail, make the
  smallest choice consistent with the contracts and conventions (spine §2.2). Report it in your
  `deviations` output with a one-line rationale. The coordinator folds these into the spine's
  decision log afterwards. Do not edit the spine or slice specs yourself.
- **The spec looks wrong.** If a contradiction with the real code or pinned PoB2 makes an AC
  unachievable, do not silently change the behaviour. Implement the closest faithful behaviour and
  report a `deviation` with evidence (`file:line`).
  - If it changes a contract or the user-visible tool surface (HG-3, HG-5), report `blocked`
    instead.
- **Stop conditions.**
  - A human-decision gate HG-1…HG-8 fires.
  - The same gate failure signature occurs 3 times in a row (`blocked:loop`).
  - A unit needs a file owned by a not-yet-merged unit.

  On a stop, report `blocked` with evidence. Downstream units of the same lane park; independent
  lanes continue.
- **Notification path.**
  - Workflow results return to the coordinator session.
  - The coordinator surfaces any STOP to the user with a push notification.
  - The coordinator records verdicts in `docs/stabilization/worklog.md`, on this branch, written only
    in the integration worktree.
