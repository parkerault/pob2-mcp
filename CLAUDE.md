# pob2-mcp: notes for Claude Code sessions

An MCP server (TypeScript, SDK 1.20.2, stdio) over a headless Path of Building 2 engine: `luajit` runs
the pinned PathOfBuilding-PoE2 checkout in `vendor/` through our Lua bridge in `pob-api/`. The README
covers setup, registration and configuration. The binding design is the spec spine,
`docs/stabilization/spec/README.md` (contracts, decisions, test strategy), with its slice specs beside
it.

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
  uses it (build-guide D-297, D-335).
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
a user decision, because the golden values move. The procedure (spike S-2,
`docs/stabilization/spikes/S-2-pin-v0.23.1.md`):

1. Update `pob-pin.json` to the new tag and commit, its `manifest.xml` version, and the CRLF-normalized
   sha1 of `src/HeadlessWrapper.lua`.
2. Run `mise run pob:fetch`.
3. Re-run the PoB internals probe and the golden tests (`mise run test`). The golden build's recorded
   stats must equal the engine's.
4. Update the recorded values where the new release legitimately changed them, and re-check the bridge's
   `construct()` helper and `pob-api/API/Trade.lua` against the new release.

## Where things are

- `docs/stabilization/spec/README.md`: the spec spine, the source of truth for contracts and decisions.
- `docs/stabilization/grounding/`: fact sheets on the code, PoB2's Lua internals, MCP and the tooling.
- `scripts/fresh-clone-check.sh`: clones HEAD into a temp dir, runs `mise run setup`, and checks the
  result as a server, with no trade or poe.ninja requests.
