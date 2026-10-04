# Formalization gap analysis (vision v2 → spec), 2026-10-03

> **Note (after the spec review, 2026-10-03):** some PROPOSED resolutions below were refined by the
> adversarial spec review. Examples: the complexity model (C4), the link encoding (C10) and the output
> size (C8). The spec spine's decision log ([`spec/README.md`](spec/README.md) §6) is authoritative. See
> [`review-spec.md`](review-spec.md).

Step 4 of `spec-formalizer`: the ratified [vision](vision.md) was run against the gap checklist,
after a fresh grounding pass. That pass had five read-only research agents covering:
- the TypeScript code;
- the Lua bridge and the PoB2 `v0.23.1` internals;
- the MCP spec, SDK 1.20.2 and the Claude Code docs;
- the docs for Node 24, pnpm, mise, jest, zod and chokidar;
- the docs for GGG and poe.ninja.

Their fact sheets live in the session scratchpad and aren't committed. The facts the spec relies on
are restated in it with their citations.

Every gap was resolved in one of three ways:

- **DECIDE:** a user answer was needed. All four are answered, and are marked HUMAN below.
- **PROPOSED:** decided and recorded by the coordinator, and overridable by the user. These become
  `D-n` entries in the spec.
- **DEFERRED:** consciously left out. These become out-of-scope items or human-decision gates.

**Live check (2026-10-03):** Claude Code 2.1.289 connected over stdio to the *current* build (SDK
1.20.2). It listed 30 tools and completed a `tools/call`. That was run with a throwaway
`--mcp-config`; the user's Claude Code config was not touched. The SDK does not need to be upgraded.

## A. Collaborative editing (follows from the Q6 answer)

| # | Gap | Resolution |
|---|---|---|
| A1 | Today's server writes `.xml` snapshots, backups and exports into `<builds>/.pob-mcp/{snapshots,exports}/`, and presets into `<builds>/.pob-mcp-presets/` (`buildExportService.ts:41-42`, `configHandlers.ts:18-21`). PoB2's build browser lists every subfolder and every `.xml` file (`BuildListHelpers.lua:22-76`), so those snapshots would appear inside PoB2 as builds. | **HUMAN (2026-10-03):** move snapshots, backups, exports and config presets to a Linux state directory, `${XDG_STATE_HOME:-~/.local/state}/pob2-mcp/`. The server writes into the builds folder only when it saves a build. No data migration: the user's builds folder has no `.pob-mcp/` today. |
| A2 | The user saves in PoB2 while the engine holds that build. Today TypeScript doesn't even record which file the engine loaded: the name passed at load is free-form ("API Build", "Init Test"…). | **HUMAN (2026-10-03): auto-reload when clean.** If the file changed on disk and the engine has no unsaved edits, the server reloads it before the next engine call and says so. If the engine has unsaved edits, it warns, and Claude must reload (discarding those edits) or save under a new name. The tracking is **PROPOSED**: the server records the loaded file's path and content fingerprint at load and save, the engine revision, and the last-saved revision. "Dirty" means the revision is greater than the last-saved revision. |
| A3 | Saving over a file the user changed since load would clobber their PoB2 edits. | **PROPOSED:** a write to an existing file needs `overwrite: true`, **and** is refused when that file's fingerprint differs from the one recorded at load/save. The refusal tells Claude to reload or save under a new name. No flag overrides it. Backups stay on. |
| A4 | PoB2 on Windows doesn't watch files, so after Claude saves, PoB2 still shows the old version. | **PROPOSED:** every successful save over the file that is open in PoB2 says "re-open it in PoB2 to see the change". |
| A5 | Headless dev-mode autosave targets `/Builds/~~temp~~.xml`, the filesystem root. That is not your folder, but it fails, and the failure wedges the engine (below). | **PROPOSED:** turn it off (`main.disableDevAutoSave = true`). |
| A6 | Where the crash-recovery snapshot (one taken after each edit) is kept. | **PROPOSED:** in memory only. A server restart loses unsaved engine edits, and the files on disk are the source of truth. It is distinct from the user-facing `snapshot_build`. |

## B. Boundaries, alpha, deferrals

| # | Gap | Resolution |
|---|---|---|
| B1 | There was no objective alpha. | **PROPOSED: alpha = the trade vertical.** It covers the pin, test harness, deletions, engine robustness, the trade client, and `find_upgrades` working end to end from Claude Code on the golden build (registration documented). **Done** = alpha plus the engine-op fixes, the TS↔Lua contract, the advice rewrite, and the docs. |
| B2 | PoB's unique-jewel trade rows. | **DEFERRED** (HUMAN): a follow-up epic once the core is stable. |
| B3 | `find_upgrades` slots: PoB's generator can't generate charm slots or weapon jewel sockets, and tree jewel sockets need a jewel type (`TradeHelpers.lua:298-299`, `TradeQueryGenerator.lua:822-826`). | **PROPOSED:** follow PoB. The slot list is what PoB supports, jewel sockets require `jewel_type`, and an unsupported slot errors with the supported list. |
| B4 | Next PoB pin bump (it crosses PoB's class-system rewrite). | **DEFERRED:** a later epic. The `construct()` helper and golden tests keep it cheap. |

## C. `find_upgrades` behaviour

| # | Gap | Resolution |
|---|---|---|
| C1 | Defaults. | **PROPOSED, follow PoB's dialog:** sort weights come from the build's saved `<TradeSearchWeights>`, falling back to FullDPS 1.0 + TotalEHP 0.5. Mirrored items included. Status "Instant buyout" (`securable`). Fetch pages 2. Rune behaviour "copy". |
| C2 | League default. trade2 lists two non-Standard softcore leagues (Forbidden Rites, an event league; Runes of Aldur, the challenge league), and no field marks the challenge league. PoB's rule would pick Forbidden Rites. | **HUMAN (2026-10-03):** the first non-Standard league in trade2's `/data/leagues` order, unless `POE_LEAGUE` overrides it. Today that is Forbidden Rites, which is also the golden build's `lastLeague`. **PROPOSED refinement:** "non-Standard" also excludes `Hardcore` and any `HC `-prefixed id, so a reordered list can never pick a hardcore league. |
| C3 | Searches per call (PoB's min-weight adjust loop). | **PROPOSED:** at most 5, which is PoB's own `maxRecursion` (`TradeQueryRequests.lua:111`). |
| C4 | Query complexity. Every rejected 400 counts against your rate limits and GGG's invalid-request threshold. | **PROPOSED:** pre-fit each query to trade2's complexity budget using PoB dev-head's 4-per-filter model, calibrated to S-4: `60 + 4 × stat filters` ≤ 200, which gives the observed 180 for 30 filters. Allow at most **one** trim-and-retry on an over-complexity 400. |
| C5 | Login detection. | **PROPOSED:** decided by the rate-limit header alone. `Account` in `X-Rate-Limit-Rules` (case-insensitive) means the session was recognised; a 400 code 2 without it means the cookie is missing or expired. GGG says to branch on codes, not message text. An HTTP 401/403 gets a generic "trade rejected the request" message plus the refresh hint (no trade2 evidence exists for either). |
| C6 | Time budget. Claude Code has no per-call timeout for stdio tools, but moves a call to the background after 120 s. | **PROPOSED:** a 90 s total budget per call. If the rate limiter would need to wait more than 30 s, or a lockout penalty is active, stop and return what has been evaluated so far plus the trade-site link and the wait time. *(The numbers are coordinator choices.)* |
| C7 | Cancellation. A cancelled call keeps running unless it checks the signal. | **PROPOSED:** check `extra.signal` between steps, then release the engine lock and stop. |
| C8 | Output size. The client warns at 10k tokens and caps at 25k. | **PROPOSED:** default `limit` of 10 listings with item text. `is_upgrade` = score > baseline when both are rounded to 4 decimals. |
| C9 | Price normalization. | **PROPOSED:** read `core.primary` from every poe.ninja response (never hard-code divine), join on the trade currency id, show prices in the budget currency, and cache for 60 min with `If-None-Match` (poe.ninja refreshes PoE2 hourly). |
| C10 | URLs. PoB's exact-item URL on the tag omits the `poe2` realm segment. | **PROPOSED:** both links use `/trade2/search/poe2/<league>?q=<query>`, verified in the live smoke. |
| C11 | Network error or 5xx. | **PROPOSED:** no automatic retry (it would count against your limits). Return an actionable error plus the link. |
| C12 | Unverified trade2 shapes: the `pseudoMods` "Sum:" weight line that PoB's adjust loop reads, the instant-buyout (`securable`) listing, `/data/leagues`. No fixture covers any of them. | **HUMAN: approved, and done 2026-10-03.** The capture took exactly two logged-in requests (`search-weighted-session.*`, `fetch-weighted-session.*`), plus the existing `/data/leagues` capture committed as `data-leagues.*`. They prove the `Sum:` pseudo-mod line, the instant-buyout listing shape (`fee`, `hideout_token`, no whisper), and the `Account,Ip` rules with their values. **Still unverified:** a 429 with `Retry-After`, the expired-cookie response, and the logged-in over-complexity 400. The human-only live smoke records whichever it sees. |

## D. Engine, protocol and state

| # | Gap | Resolution |
|---|---|---|
| D1 | Load wedge, refined. *Any* failed load after a good one wedges the engine through dev-mode autosave (`Build.lua:2443`). | **PROPOSED:** fixed by A5. The robustness test runs valid → bad → valid. |
| D2 | `get_stats` with `fields:["ReqStrItem"]` crashes luajit the same way `calc_with` does (a reference cycle). | **PROPOSED:** reply encoding moves inside the `pcall`, and values are filtered to numbers, strings and booleans before encoding. |
| D3 | The lazy engine start is missing on 6 engine paths (`plan_leveling`, `validate_build`, …). | **PROPOSED:** the engine starts in the router, under the engine lock, not in handlers. |
| D4 | The bridge passes the whole `process.env` to luajit. | **PROPOSED:** pass a scrubbed env (no `POESESSID` / `POE_SESSION_ID`). |
| D5 | The server doesn't exit on stdin EOF (the SDK doesn't listen for it). | **PROPOSED:** the entry file handles stdin `end`/`close`: it kills luajit and exits. |
| D6 | PoB's warnings go stale after edits. Refreshing them (`RefreshStatList`) can change the character level in auto-level mode. | **PROPOSED:** the advice tools refresh warnings explicitly and keep the level unchanged. |
| D7 | `totalEnemyDamage` sums five damage types, while each `<Type>MaximumHitTaken` covers one. | **PROPOSED:** compare per type: `<Type>MaximumHitTaken` vs `<Type>EnemyDamage`. |
| D8 | The `HeadlessWrapper.lua` pin hash. S-2 recorded the raw-LF sha1. | **PROPOSED:** store the CRLF-normalized sha1 (`77a3e3a…`), the same scheme as the manifest. |
| D9 | Unknown tool and invalid arguments are protocol errors under MCP 2025-06-18, so "`isError` on every error" overreaches. | **PROPOSED:** every error *a tool handler produces* is an `isError` result, and the router catches it (a throw would become JSON-RPC −32603). |

## E. Interfaces, tooling, environment

| # | Gap | Resolution |
|---|---|---|
| E1 | zod version. | **PROPOSED:** `zod@^3.25.76` (v3 API; SDK 1.20.2 silently breaks on v4 schemas). It covers the runtime schemas for Lua replies (D-10) and the input validation of new tools. |
| E2 | pnpm via corepack isn't reproducible on a fresh box (mise doesn't enable corepack). | **PROPOSED:** `node = { version = "24", postinstall = "corepack enable" }`. |
| E3 | mise tasks run under `sh -o errexit` without pipefail. | **PROPOSED:** gate tasks contain no pipes; each step is its own list entry. |
| E4 | The coverage thresholds in `jest.config.cjs` fail jest whenever coverage is collected. | **PROPOSED:** remove the thresholds; coverage is reported only. |
| E5 | Registration. | **PROPOSED:** `claude mcp add pob2 -s user -e "POB_DIRECTORY=/mnt/c/Users/parke/Documents/Path of Building (PoE2)/Builds" -- mise exec -C /home/parker/projects/pob2-mcp -- node build/index.js`, after `mise trust`. |
| E6 | `util.parseEnv` keeps a UTF-8 BOM, which would make the cookie key silently miss. | **PROPOSED:** the credential getter strips a leading BOM. |
| E7 | Reproducibility nits: the LuaJIT asdf plugin is unpinned; `LUAROCKS_VERSION` leaks into every environment; `@types/chokidar` is unused. | **PROPOSED:** pin the plugin, move `LUAROCKS_VERSION` to the install-only env, drop the unused type package. |
| E8 | Watcher on `/mnt/c`. Whether chokidar polling sees Windows-side PoB2 saves is untested. | **PROPOSED:** poll at a 1 s interval, `.xml` only; the user's live smoke verifies it. |

## F. Security, policy, guardrails

| # | Gap | Resolution |
|---|---|---|
| F1 | trade2 is an undocumented internal website API. GGG's docs say reverse-engineering endpoints outside their docs is against their Terms of Use (section 7i), and that executable apps must use a public OAuth client, which isn't possible (registrations are closed). PoB2 itself uses trade2 under a special grant. You were told this when OAuth was ruled out, and chose the cookie path. | **PROPOSED** as a risk-register entry (R-1), noted as user-accepted. Mitigations: user-initiated calls only (no background polling), the limiter obeys every rule GGG sends, and an honest User-Agent. |
| F2 | User-Agent contact. GGG's required format (`OAuth {clientId}/{version} (contact: …)`) is for registered OAuth apps and can't be met. A contact (the fork URL) would identify you. | **PROPOSED:** `<package name>/<package version>` (today `pob2-mcp-server/0.2.2`) with no contact, sent everywhere (trade, poe.ninja, build-code fetches). |
| F3 | Build agents hitting live GGG or poe.ninja. Rate limits are per IP and per account, so an agent's test run could lock you out of trading. | **PROPOSED (guardrail):** build agents never make live requests to pathofexile.com or poe.ninja. All tests use fixtures. Only the coordinator's fixture capture (C12) and your smoke test go live. |
| F4 | Several Claude Code sessions each run their own server, and they share your IP and account limits. | **PROPOSED:** each process reads the limit-state headers on every response (they count every client on the IP/account), and that state rather than a local count gates requests. The remaining risk is recorded. |
| F5 | GGG's third-party notice. | **PROPOSED:** add "This product isn't affiliated with or endorsed by Grinding Gear Games in any way." to the README. |
| F6 | `export_build`'s `output_directory` is not sandboxed. | **PROPOSED:** confine it to the builds folder or the state folder, like every other path argument. |

## Deferred (out of this spec)

- Unique-jewel trade rows: follow-up epic (HUMAN).
- Multi-slot "where should I spend X" optimisation: a vision non-goal.
- The next PoB pin bump: a later epic.
- `structuredContent` / `outputSchema` tool outputs: not adopted. Text results stay. Agent SDK docs
  say text blocks are dropped when `structuredContent` is set, which would hide warnings.
- Regenerating PoB's `QueryMods.lua`: only a pin bump refreshes it.
