# Grounding fact sheets (2026-10-03)

These are the read-only research outputs the spec was formalized from. Every fact carries a citation
and is marked **[V]** (verified in the source or by a probe at the time) or **[I]** (inference). They
are point-in-time snapshots:

- repo citations are at commit `968a104`;
- PoB citations are on tag `v0.23.1` (`7d6f530`), written `tag:<path>:<line>`;
- external docs were read on 2026-10-03.

Prefer the spec (`../spec/`) where the two differ. The spec restates every fact it relies on.

| File | Covers |
|---|---|
| [`ctx-ts.md`](ctx-ts.md) | TypeScript server: module map, startup, env vars, tool registration and dispatch, handler conventions, bridge client, state on disk and in memory, trade and poe.ninja clients, tests, build |
| [`ctx-lua.md`](ctx-lua.md) | Lua bridge (`pob-api/`) and PoB2 `v0.23.1` internals: boot, wire protocol, the action table, load and wedge behaviour, warnings, SaveDB, manifest hashing, slots, outputs, trade classes |
| [`ctx-mcp.md`](ctx-mcp.md) | MCP protocol revision 2025-06-18, SDK 1.20.2 behaviour from source and probes, Claude Code as the client (registration, timeouts, output limits, concurrency) |
| [`ctx-tooling.md`](ctx-tooling.md) | Node 24 (`util.parseEnv`, child processes, fetch), chokidar 4, zod, Jest 29 / ts-jest, pnpm 11, mise tasks and trust, git sparse clone |
| [`ctx-external.md`](ctx-external.md) | GGG developer docs (rate limits, errors, User-Agent, ToS 7i), trade2 evidence table (fixture-proven vs assumed), poe.ninja API docs, league discovery |

The probe scripts these sheets mention lived in the session scratchpad and are not kept.
