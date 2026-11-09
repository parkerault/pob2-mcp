# pob2-mcp: notes for Claude Code sessions

An MCP server (TypeScript, SDK 1.20.2, stdio) over a headless Path of Building 2 engine: `luajit` runs
the pinned PathOfBuilding-PoE2 checkout in `vendor/` through our Lua bridge in `pob-api/`. The README
covers setup, registration and configuration. The binding design is the project spine, `docs/spec/README.md`:
contracts, decisions, test strategy and the state of the project, with an index of the slice specs in
`docs/stabilization/spec/` and `docs/build-guide/spec/`.

## Setting up a checkout or worktree

```bash
mise trust && pnpm install --frozen-lockfile && mise run pob:fetch
```

- **`mise trust` first.** Every `mise` command in an untrusted checkout fails with exit code 1.
- In a new git worktree, also run `git config --worktree commit.gpgsign false` if commit signing would
  prompt (a signing prompt hangs a headless session).
- `mise run setup` is the first-time equivalent (install, build, fetch the pin).

## The gate

```bash
mise run test; echo "test rc=$?"
pnpm build; echo "build rc=$?"
```

Both must exit 0. `mise run test` fetches the pin if needed, builds, and runs the full Jest suite.

## Cautions

- **No pipes in mise tasks.** mise's task shell is `sh -c -o errexit` without pipefail, so a failing
  command before a `|` doesn't fail the task. Keep `mise.toml` tasks pipe-free, and let exit codes
  propagate.
- **Tests never touch the network or the real builds folder (D-34).** Jest's setup makes global `fetch`
  throw, scrubs `POESESSID`/`POE_SESSION_ID`, and points `POB_DIRECTORY` and `XDG_STATE_HOME` at temp
  dirs. HTTP in tests goes through `fixtureFetch` and the committed fixtures in `tests/fixtures/`. No
  test makes requests to pathofexile.com or poe.ninja, and no agent contacts pathofexile.com or sends a
  request that carries a cookie or personal data without the user's approval: the rate limits are shared
  with the user's IP and account. In development, agents may query poe.ninja's documented economy endpoints
  politely: serial requests, a back-off on HTTP 429, and nothing fetched twice that a cache could hold. Its
  builds, profiles and character API is closed to third parties by poe.ninja's terms, so no agent or tool
  uses it (build-guide D-297, D-335). Requests to poe2db.tw need no approval either, at the league digest's pace:
  serial, at least 3 s apart, no cookie, one retry after 60 s on a 429 or 5xx, nothing fetched twice (D-400, D-497).
- **Trade searches go one client at a time, slowly.** With the user's approval, only one agent at a time
  sends trade requests, through the session's pob2 server. An agent that starts its own server keeps trade
  off, as `spawnServer` does. Tell the user before a pricing run starts, because their browser shares the
  limit. The server paces trade searches itself: at least 45 s between one search's start and the next, and
  at most 7 in any 5 minutes, waiting inside the tool call (D-461). So make one trade call at a time; calls
  in parallel queue past the 60 s wait cap and come back `would_wait`. Ad-hoc pricing (studies, probes) makes
  at most 30 searches without asking. On the first 429, `rate_limited` or `locked_out`, stop, report when the
  lockout ends, and don't retry before then.
- **The session's pob2 server runs the code built when it started.** After a rebuild, reconnect it with `/mcp`
  before relying on new tool behaviour.
- **Spawned test servers use `spawnServer`** (`tests/helpers/spawnServer.ts`). It gives the child an
  explicit safe env: trade and poe.ninja disabled, trade requests pointed at a dead address, temp
  folders. In-process tests use `startTestServer` (`tests/helpers/server.ts`).
- **Never read or print `.env`.** It holds the user's trade session cookie. Don't cat, grep, source or
  copy it, and never set `POESESSID` yourself.
- **Engine tests fail without the engine; `POB_SKIP_ENGINE=1` skips them.** They need `luajit` (from
  mise) and the pinned `vendor/` checkout, so run them through `mise run test`. They are registered with
  `engineDescribe` (`tests/helpers/engine.ts`).
- **Run probes from a temp cwd, never the repo root.** Anything that starts the server or the engine by
  hand runs from `mktemp -d`, with `POB_DIRECTORY` and `XDG_STATE_HOME` pointed at temp dirs.
- **The user's builds folder is off limits.** It is on the Windows drive (`/mnt/c/...`). Only the user
  works against it.
- **Only the session starts the engine.** Tool code reaches the engine through the engine session
  (`src/engine/session.ts`), which holds one lock per tool call, restores a snapshot after a crash and
  checks the loaded file for changes on disk.
- **Every write into the builds folder goes through `buildFileWriter`** (`src/services/buildFileWriter.ts`):
  backup first, canonical on-disk name, refused over a file that changed on disk.
- **The spine never falls behind an approved amendment.** The approval commit puts an approved amendment's rows
  (decisions, contracts, gates, milestone, work units, risks) into `docs/spec/README.md` with status approved, and its
  status line reads "Folded through amendment <n> (approved; as built through <n−1>)"; the last unit of the build
  marks the rows as built and drops the parenthesis. An amendment built in two milestones adds a middle step: the first
  milestone's docs unit marks that milestone's rows built, and the line reads "(approved; as built through <n−1> and
  amendment <n>'s M-<m>)". `tests/static/specSpine.test.ts` fails when the spine falls behind.

## Code conventions

- ESM TypeScript with Node16 resolution: relative imports end in `.js`, and `import type` is used for
  types. Jest compiles `src/` as CommonJS, so `src/` has **no `import.meta`, `__dirname` or top-level
  `await`**.
- A tool is a JSON-Schema literal in `src/server/toolSchemas.ts`, a `TOOL_META` entry in
  `src/server/toolMeta.ts`, a `case` in `src/server/toolRouter.ts`, and a `handle<Name>` in
  `src/handlers/`, wrapped with `wrapHandler`. Handlers fail by throwing; the router turns that into an
  `isError` result.
- **stdout belongs to MCP.** Log only to stderr, as `console.error('[Component] ...')`.
- Only `src/index.ts` reads `process.env`. Everything else gets the env through the server deps.
- Lua in `pob-api/` uses two-space indentation and `local M = {} ... return M`. PoB2's own files in
  `vendor/` are never modified.
- After changing a tool's name, group or description, run `pnpm build && pnpm docs:tools --write` to
  regenerate the README tool table; `tests/static/readme.test.ts` fails until it matches.
- `tests/fixtures/tool-hygiene-allowlist.json` and `tests/static/poe1-cruft-waivers.json` are empty
  and stay empty: fix the tool or the text instead of adding an entry.

## Upgrading the PoB2 pin

The pin is `pob-pin.json` (`repo`, `tag`, `commit`, `version`, `headlessWrapperSha1`). Upgrading it is
a user decision, because the golden values move. Once the user decides, run the upgrade script on a branch:
`node scripts/pin-upgrade.mjs <tag>` (D-508), a tagged release `v<n>.<n>.<n>` only, never a branch or a commit. It
does the mechanical part of the steps below, commits nothing, and writes the list of what needs judgment to
`vendor/.pin-upgrade/<tag>/pin-upgrade-report.json`. It runs the full gate, so run it like one: in the background, one
at a time, at `nice -n 19`. The procedure (spike S-2, `docs/stabilization/spikes/S-2-pin-v0.23.1.md`), each step with
what the script does and what is left:

1. Update `pob-pin.json` to the new tag and commit, its `manifest.xml` version, and the CRLF-normalized
   sha1 of `src/HeadlessWrapper.lua`. The script writes them, and the pin's values in `tests/unit/pobPin.test.ts`
   and `tests/integration/protocol.lua.test.ts`.
2. Run `mise run pob:fetch`. The script does, after staging the new tree with `scripts/fetch-pob.sh <tag> <commit>
   <dest>`.
3. Re-run the PoB internals probe and the golden tests (`mise run test`). The golden build's recorded
   stats must equal the engine's. The script runs the probe (`scripts/pob-internals.lua`, its list
   `scripts/pob-internals.symbols.json`) on both trees and lists each symbol missing or changed, then the gate, listing
   each golden figure that moved, old and new, and every other failure.
4. Update the recorded values where the new release legitimately changed them, and re-check the bridge's
   `construct()` helper and `pob-api/API/Trade.lua` against the new release. Left to judgment: the report names
   `scripts/check-construct.lua` and `Trade.lua`'s lines when a PoB file they mirror changed, and the tree version
   when PoB's newest isn't `0_5`.
5. Re-check the skills-tab refresh in `BuildOps.get_main_output` (`pob-api/API/BuildOps.lua`): it calls
   `skillsTab:UpdateGlobalGemCountAssignments()` so PoB's skill-slot warning fires headless (D-428). If the
   new release renames that method, the guard skips it silently and the warning stops; the engine test
   `tests/integration/skillSlots.test.ts` then fails. The script lists the method when it is gone, and PoB's warning
   when its text is; the skill-slot tests find the warning's line by its text.
6. Re-check the bridge's parse fixes, `pob-api/API/ParseFixes.lua` (D-492), and its function patches,
   `pob-api/API/Patches.lua` (D-509). Each entry corrects a PoB bug (PG-103: Crystalline Phylactery) and names its
   retirement test, whose "bug still present" case fails once the new release fixes the bug (PG-103's is in
   `tests/integration/parseFixes.test.ts`). The script retires an entry only when that case fails on its assertion and
   nothing else in its test file fails: it removes the entry and that case and re-runs the failed suites. Any other outcome of a retirement test (an error, a
   hook that throws, a skipped case) is judgment, and so is the rest of a retired entry (its `pob-gaps.md` entry, its
   test file's other cases).
7. Rebuild the rule-changer index, `data/rules/` (D-401), and re-check the league digests (D-400). The data builders
   are game knowledge's, in `skills/game-knowledge/scripts/`. List the new pin's candidates with
   `mise exec -- node skills/game-knowledge/scripts/rules-index.mjs candidates --json`, have agents rewrite the
   entries that changed (amendment 8 §3), then run `node skills/game-knowledge/scripts/rules-index.mjs check` and
   `join --write`. Run `node skills/game-knowledge/scripts/league-digest.mjs --reflag <slug>` on each digest in
   `data/league/`. The script writes the candidates, lists the entries that differ from the old pin's, and re-flags
   each digest (written only when a flag or the pin's label changes); the rewrite and the join are left.
8. Re-check the bridge patches' fingerprints (D-509): each entry of both patch modules records the sha1 of the PoB
   code it relies on, checked by `tests/static/patchFingerprints.test.ts` through `scripts/patch-fingerprints.mjs`.
   The script lists each one that changed on the new tree. A changed fingerprint means re-check the patch against the
   new code and then update its `sha1`, never retire it on that alone.

**League launch.** Commit the new league's digest before or at its launch: the readers take only running leagues, so
an early digest waits for its start (D-507). Re-run the digest script when poe2db's dates move; it rewrites the other
digests' `League:` sentences too. Correct `data/economy/prices.json`'s league name and dates (D-514). Each under the
rules above: poe2db at the digest's pace, anything else with the user's approval.

## Where things are

- `docs/spec/README.md`: the project spine, the single source of truth for what crosses slices and for the
  project's state. The two spines it replaced, `docs/stabilization/spec/README.md` and
  `docs/build-guide/spec/README.md`, are kept as history.
- `docs/stabilization/grounding/`: fact sheets on the code, PoB2's Lua internals, MCP and the tooling.
- The repository is also the Claude Code plugin `pob2` (amendment 15, D-499): its manifests in `.claude-plugin/`,
  the build-guide skill in `skills/build-guide/` (run as `/pob2:build-guide`), game knowledge's references and data
  builders in `skills/game-knowledge/`, the four agent types in `agents/` (`pob2:build-guide-coordinator` and the
  rest), the run scripts' commands in `bin/` (`pob2-check-run`, `pob2-run-log`, `pob2-render-audit`,
  `pob2-render-notes`) and the compaction reminder's hook in `hooks/hooks.json`. Skill and agent text names plugin
  files from the plugin root (D-500).
- `scripts/fresh-clone-check.sh`: clones HEAD into a temp dir, runs `mise run setup`, and checks the
  result as a server, with no trade or poe.ninja requests.
