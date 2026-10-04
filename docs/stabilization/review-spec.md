# Adversarial review of the spec (v1 → v2), 2026-10-03

**Gate verdict: PASS after fold-in.** The spec v1 (`spec/`) was reviewed with the full harness:
- **Phase 1:** 8 independent lenses, which raised 107 raw findings.
- **Phase 2:** the findings were merged into 52 clusters.
- **Phase 3:** 5 fresh skeptic verifiers checked them, defaulting to "false positive".

Every material cluster was confirmed in full or in part. About a dozen sub-claims and three proposed
fixes were refuted or replaced. All confirmed findings are folded into spec v2.

## Process

- **Lenses (one class of problem each):**
  1. invented decisions;
  2. unverifiable acceptance criteria;
  3. task-graph integrity and AC enforcement-site drift;
  4. environment and contract fit;
  5. ground-truth fidelity;
  6. completeness;
  7. third-party dependency assumptions;
  8. cross-document contradiction.
- **Ground truth:**
  - the code on `stabilization/foundation`;
  - the PoB2 `v0.23.1` clone (luajit probes on the golden build);
  - the fixtures;
  - installed `node_modules` (SDK 1.20.2, Jest 29.7, zod 3.25.76);
  - Node 24 probes;
  - official docs: MCP 2025-06-18, Claude Code, mise, GGG developer docs, poe.ninja API;
  - read-only `stat` on `/mnt/c`.
- **Verifiers:**
  - V1 engine session;
  - V2 files and state;
  - V3 trade;
  - V4 gates and harness;
  - V5 the ground-truth findings.

## Confirmed findings, ranked by blast radius (→ where folded in v2)

| # | Finding | Verdict / sev. | Folded into |
|---|---|---|---|
| K3 | `/mnt/c` is case-insensitive (one inode for any casing; `realpath` keeps the caller's casing), so a case-variant name bypassed the user's "never overwrite a changed file" rule | CONFIRMED / high | D-52, R-14, C-3/C-17, AC-E60, AC-E61, WU-20 item 7 |
| K2 | C-17 called `noteSaved` after byte/text writes (`restore_snapshot`, `set_build_notes`), so a later save silently undid them. Its `restore_snapshot` exemption contradicted HUMAN D-19 | CONFIRMED / high | C-17 steps 3 and 6 (engine-content writes only; no exemption), AC-E63 |
| K6 | The write rules and the state-dir move arrived only at M-3, while alpha runs against the user's real Windows folder | CONFIRMED / high | **New WU-22** (M-2, on the alpha path), WU-20 depends on it |
| K5 | `analyze_build`, `compare_builds`, `validate_build` and `analyze_defenses` loaded builds behind the session's back until M-3 | CONFIRMED / high | WU-08 load guard (`ctx.client` rejects raw loads), D-51f, AC-E56 |
| K50 | The auto-reload contradicted the revision, snapshot and dirty-flag rules (it either lost the snapshot or cleared the dirty flag after a mutation) | CONFIRMED / high | C-3 step 4a, spine §4, AC-E57 |
| K4 | The bridge restarted itself mid-call (giving a blank build under the user's name); the snapshot wasn't tied to the loaded build; a failed restore looped; the failed-reload path was undefined | PARTIAL / high (the "half-written file gets loaded" sub-claim is refuted: pre-validation rejects it) | D-59, C-3 steps 3–7, C-4, AC-E8, AC-E21 |
| K7 | The v1→v2 protocol switch was split across two parallel units, and neither could pass the gate alone | CONFIRMED / high | WU-06 also changes the TS readiness probe; WU-07 depends on WU-06 |
| K1 | The fresh-clone check claimed "no trade request", but `find_upgrades` fetched leagues and stats before checking the session | CONFIRMED / high (5 lenses) | D-49 (fallback before any network), C-14 step order, AC-T43, AC-G4 tripwire |
| K28 | Output size: one exact-item link is ~4,000 chars (the whole URL-encoded query), so 10 listings ≈ 48k chars, past the token warning; `limit` up to 50 was unbounded | CONFIRMED / high (raised) | D-53 (30,000-char budget, compact overflow), `limit` ≤ 20, NFR-10, AC-T40 |
| K59 | The baseline as "Σ weights" was wrong for base-0 stats | PARTIAL / high. The `*TakenHit` half and the proposed `WRO(base,base)` fix were refuted. New sub-finding: PoB's item path ranks the Taken stats backwards | D-57 (baseline = `WRO(base, ReduceOutput(base))`; `*TakenHit` excluded), AC-T42 |
| K60 | Trade links encoded the league as `Forbidden+Rites`; PoB's `buildUrl` actually yields `%20` | CONFIRMED / high | D-39, C-14 links, AC-T32 |
| K10 | Timeouts and aborts: `AbortSignal.any([t, undefined])` throws; Jest fake timers don't fire `AbortSignal.timeout`; SDK cancel reasons are strings | CONFIRMED / high | C-10 (a `setTimeout`-driven controller; classification by signal), C-18 `fixtureFetch` aborts, AC-T9(i,k,l) |
| K18 | The engine-kind check was tautological; kinds were ambiguous for lifecycle and file tools | CONFIRMED / high. The raw-bytes observable was refuted: the first `get_stats` reorders `<FullDPSSkill>` | AC-E16 (canonical export), C-8 explicit kind table |
| K8 | Gate deadlocks: the cruft scan couldn't reach zero at WU-04; non-owner fixers couldn't remove allowlist entries; contract coverage broke when later units added actions; touches lists and the shared-file list were incomplete; error-only samples bypassed hygiene | CONFIRMED / high | D-45, strict owned waivers, spine §8 (shared list, implied scope), WU-16→WU-09 edge, AC-F20/F26 |
| K12 | Spawned children escaped the harness: the env scrub was per-file only; e2e servers read the real `.env` and had live network | CONFIRMED / medium | C-18 `globalSetup` + `spawnServer`, AC-F16(f), AC-F28 |
| K9 | The fidelity rule ("every AC crosses the real seam") was impossible for unit-class ACs | CONFIRMED / medium | Spine §12, allowed fakes per test class |
| K11 | `engineDescribe` was async, which Jest forbids; the helper names differed between documents | CONFIRMED / medium | C-18 `globalSetup` probe, synchronous `engineDescribe` |
| K13 | Error code 2 is GGG's generic "Invalid query", so every code-2 400 had been misread as "too complex" or "session" | CONFIRMED / medium | D-24 (weighted-body only), `invalid_query`, A-13, AC-T9 |
| K15 | NFR-4's 90 s wasn't achievable: unclipped step timeouts, and the lock wait was undefined | CONFIRMED / medium | D-22 (deadline from arrival, clipping), AC-T34(e,f), AC-T44(e) |
| K16 | No contract carried the MCP `extra` (signal, progress) to the router | CONFIRMED / medium | C-1 router `call` context |
| K19 | `lua_stop`/`lua_new_build`/null-`loaded` semantics were underspecified | PARTIAL / medium. Refuted: "discarding on stop is a semantics change" (it is today's behaviour) | C-3 rule L, D-51e, AC-E59 |
| K20 | `find_upgrades` edge cases: unpriced listings crash PoB's parser block; zero results; all rejected; partial progress lost | PARTIAL / medium (null entries are dropped by `pairs`, not crashed on) | D-56, C-13 per-item `pcall`, AC-T44 |
| K21 | C-17 failure paths were undefined | CONFIRMED / medium | C-17 steps 1–6, AC-E61 |
| K22 | Limiter gaps: first-request settling; a 429 without a policy; unbounded waits for kept tools | PARTIAL / medium (persisting lockouts across processes was rejected) | C-11, D-35, AC-T6, AC-T7 |
| K23 | The 60 s name-keyed parse cache went stale after saves | CONFIRMED / medium | D-58, AC-E64 |
| K29 | Partial currency conversion was invented and differed from PoB | CONFIRMED / medium | D-54, AC-T31(ix) |
| K30 | The tie-break was invented and determinism unachievable (unstable sort, randomized LuaJIT hashing) | CONFIRMED / medium | D-55, AC-T21 (two fresh processes) |
| K34 | AC preconditions couldn't arise on the golden build (charms load inactive; auto-level; a vacuous file check) | CONFIRMED / medium | AC-E37, AC-A1, AC-E5 |
| K35 | ACs needed test hooks no contract defined | CONFIRMED / medium | `__test_eval`, `onEvent`, `enginePid`, `startTestServer` returns `session` |
| K36 | AC-T30(d) was inconsistent with PoB's adjust loop | CONFIRMED / medium | AC-T30(d) |
| K37 | ACs asserted impossible values: exact float equality; RSS < 200 MiB (a ts-jest worker is ~500 MiB); fixture counts | CONFIRMED / medium | AC-T15, AC-E52, AC-T14 |
| K38 | The README rules contradicted each other (migration notes vs a banned-names list) | CONFIRMED / medium | Marked migration block (AC-G2, AC-G3) |
| K41 | Injected `fetch`/`spawn` weren't threaded into the clients, so in-process ACs passed vacuously | CONFIRMED / medium | C-7 threading in WU-03, AC-F10 |
| K51 | AC-F22 pinned "exactly 74" forever | CONFIRMED / medium | AC-F22 derived from `tool-disposition.json` |
| K52 | The vision's "explicit error if no snapshot" had silently become notice-and-proceed | CONFIRMED / medium | D-8 restated, C-3 step 3, AC-E58 |
| K53 | A 429 wasn't one of `find_upgrades`' early stops | CONFIRMED / medium | C-14 early stop, AC-T34(d) |
| K54 | AC sample calls used argument names that don't exist (`gemName`, `key`, `category/price/stats`) | CONFIRMED / medium | AC-E36, AC-E43, AC-T18, D-51h |
| K62 | AC-F19's `masteryEffects` check couldn't pass within WU-04's touches | CONFIRMED / medium | AC-F19 narrowed; WU-10 and AC-E30 own the rest |
| K65 | D-23's model was fit to one point and mis-cited | PARTIAL / medium (the claim "every default call 400s" was refuted: the golden Body Armour has 29 filters, not 33) | D-23 (PoB dev head's model verbatim), A-3 with 5 data points, AC-T29 |
| K14 | The plugin pin used an abbreviated SHA (mise rejects those), and its check was vacuous | CONFIRMED / medium | D-32 full SHA, AC-F7 scratch `MISE_DATA_DIR` |
| K17 | Env ownership was contradictory; `POB_ARGS` and other kept vars were dropped | PARTIAL / low | C-4 env from deps, AC-F11, spine §11 "Kept" row |
| K42 | Enforcement-site drift | PARTIAL / low | AC-T11 bullet 3 deleted; AC-E26 static clause → AC-A6; `get_items` → WU-11; AC-E31 → WU-09; AC-E53 bullet → AC-F27 |
| K43 | WU-17 was too large | PARTIAL / low | Split: WU-17 (pipeline, C-21) + WU-23 (evaluation and output) |
| K55, K56, K57, K58, K61, K63, K64, K66, K67 | Spine/slice summary mismatches; fixture counts; unowned NFRs; state-file wording; the truncation list; jest roots; existing-system nits; the Lua `save_build` left behind; the share-site UA | CONFIRMED or PARTIAL / low | Spine C-n summaries, §4, §11, §12 NFR owners; D-25 exception; D-60; A-15 |
| K24, K25, K26, K27, K31, K33, K40, K44, K45, K46, K47, K48, K49 | Low notes | CONFIRMED / low | Folded throughout (D-50 tuning constants, D-51 behaviour changes, A-11/A-14 bases, `\baim\b`, etc.) |

## Refuted or replaced (considered, not acted on as proposed)

- **K32 "drop the prefit".** Replaced by K65's refit. The prefit stays, now using PoB's own model.
- **K59 `WRO(base,base)` as the baseline.** Wrong on the item path: it would flag every no-change item
  as an upgrade.
- **K18 raw export bytes as the observable.** The first `get_stats` reorders `<FullDPSSkill>`, so the
  comparison uses a canonical export instead.
- **K19 "keep `loaded` on `lua_stop`".** That would itself change behaviour, since today's stop discards
  the build. Discarding is kept, and the discarded changes are now named.
- **K22 persisting lockouts across processes.** Not worth the complexity; D-35 records the trade-off.
- **K4(d) a half-written file gets loaded.** Every truncation of the golden XML fails `ParseXML`.
- **K20 null fetch entries crash the parser.** They are skipped. Unpriced listings, however, do crash it.
- **K57 `select_spec`/`select_item_set` lack ACs.** They are covered by contract and hygiene tests.
- **K61 "find_upgrades will be truncated".** Not on the current path, but the list is now explicit.
- **K65 "every default call 400s".** Not established.

## Incidents during the review (no harm)

- A V1 probe run with `mise exec -C <repo>` wrote three scratch `.xml` files into the repo root. The
  verifier moved them out at once. `git status` was confirmed clean afterwards.
- A V4 probe ran `require('./')` from the repo root, which briefly constructed today's server. It made no
  trade requests, because today's code has trade off by default, and it called no tools.

**Guardrail added (spine §9):** probes that start the server or engine run from a temp cwd.

## For the user's ratification

These spec decisions change user-visible behaviour beyond the vision §4 rows, or otherwise merit a
look:

- **D-51, (a)–(h).** Includes `analyze_defenses`' `build_name` becoming optional, an always-on
  backup on restore, Save-As re-pointing the loaded build, and `min_links` → `min_rune_sockets`.
- **D-57.** The five "damage taken" sort stats aren't offered by `find_upgrades`, because PoB's own item
  scoring ranks them backwards.
- **D-53.** The `find_upgrades` output is capped at 30,000 characters, with compact lines past that.
- **D-49.** Fallbacks (no or expired cookie) are results that carry a link, not errors.
- **D-21 / WU-22.** Alpha now includes the safe-write unit, so nothing writes into the Windows builds
  folder unguarded.
