# Adversarial review of `vision.md` (v1 → v2), 2026-10-03

**Gate verdict: PASS after fold-in.** No finding was refuted outright, but about a third of the
individual sub-claims were. All confirmed findings are folded into `vision.md` v2. One new human
question came out of it (Q6, which builds folder to use).

## Process

- **Phase 1, six independent lens agents.** Each was read-only and hunted one class of problem in
  vision v1 plus recon and the spikes: gaps, ground-truth fidelity, reasoning errors,
  self-contradiction, intent fit, and architecture fit/executability. 69 raw findings.
- **Phase 2, dedup.** 69 → 25 clusters. Convergence across lenses was recorded and used to raise
  severity.
- **Phase 3, verification.** Five fresh skeptic agents verified every cluster against ground truth
  (code on `stabilization/foundation`, the PoB2 `v0.23.1` clone, the fixtures, and experiments run
  live on the engine and Node 24). Each was told to default to "false positive".
- **Coordinator spot checks** of the verifiers:
  - the cookie is sent on every trade request (`tradeClient.ts:222-224`);
  - the integration suite passes 7/7 as no-ops when luajit is missing;
  - `util.parseEnv` exists in Node 24.
- **Verifier experiments** included:
  - edit → kill → restore loses the edit;
  - 109/109 `PlayerStat` pairs are reproduced on the tag;
  - `process.loadEnvFile` edge cases;
  - TS1343 for `import.meta` under ts-jest;
  - the full-manifest hash check takes 164 ms;
  - an offline poe.ninja rate map: 1 chaos ≈ 163 ex, so "2 chaos" ≈ 327 ex.

## Confirmed findings, ranked by blast radius (→ where folded in v2)

| # | Finding | Conv. | Verdict / sev. | Folded into |
|---|---|---|---|---|
| K3 | `find_upgrades` is a multi-step transaction. A per-message FIFO lets parallel edits interleave (the SDK dispatches requests concurrently). Timeout start and the cache were undefined. | 4 | CONFIRMED / high | D-8a–c, D-6 caching, I-2 |
| K16 | Engine tests skip green in every fresh worktree (`vendor/` absent) and pass as no-ops without luajit. `REQUIRE_ENGINE` was undefined. mise distrusts new worktree paths. There is no CI. | 4 | CONFIRMED / high | D-17, I-6 |
| K1 | "Restore the last loaded XML" after a crash silently discards in-engine edits (shown by experiment). | 3 | CONFIRMED / medium | D-8d, I-2 |
| K2 | Treating "400 code 2" as "cookie expired" is ambiguous: code 2 is also the logged-in over-complexity error. The `Account` rate-limit rule is the reliable session signal. | 5 | PARTIAL / medium | D-15(2), I-8c |
| K4 | The engine is opt-in (`POB_LUA_ENABLED`) while trade is on by default. luajit is not on PATH for MCP hosts. There was no Claude Code registration. The server did network I/O before the handshake. | 4 | CONFIRMED / medium | D-14, D-16 |
| K5 | The §6 "parallel lanes" all edit the same shared files. T1 is not independent of the deletions. The shared-file list was incomplete. | 3 | PARTIAL / medium | §6 (serialized wiring, D4 → T1, B → C) |
| K6 | DAG nodes were missing (pin implementation, fixture source). E1/E4/E5/E6/E9 and D-14/D-15 had no owner. `construct()` is needed by T2 too. | 4 | PARTIAL / medium | §6 (P, F0, ownership map) |
| K7 | §4 was incomplete or wrong: 8 tools had no bucket, 7 were in two buckets, and "keep as-is" included tools broken on the tag (`lua_get_tree` PoE1 classes, `lua_get_stats` `_meta`, `list_builds` dir, PoE1 slot enums). | 4 | CONFIRMED / medium | §4 full table, D-4 |
| K8 | I-5's banned single words hit legitimate PoE2 content (Fire Mastery, Guardian Bow, Bandit Mask, Shaper of Winter, the `powerStatList` "Spell Suppression Chance"). | 5 | CONFIRMED / medium | I-5 |
| K9a | I-8 said "no request carries user identity", contradicting D-15's cookie. The User-Agent points at PoB's org. | 4 | CONFIRMED / medium | D-7, I-8e |
| K9b | Ranking was defined four ways. PoB's dialog semantics apply: weighted "stats to sort by", and the trader "Sort By" default is Stat Value. | 5 | CONFIRMED / medium | §1.4, D-6 `rank_by`, I-8b |
| K9c | Budget authority was unclear (trade2's Exalted-equivalent vs poe.ninja). The poe.ninja feed is Divine-primary. "Never chaos" was over-broad. Behaviour with poe.ninja off was unspecified. | 3 | CONFIRMED / medium | D-11 |
| K9d | I-8 relied on fixtures that don't exist (no logged-in 200, no 401/403/429, no mixed currency). "Satisfies required stats" was a tautology. | 3 | CONFIRMED / medium | I-8a–f |
| K10 | The output wasn't actionable from chat: no whisper or exact-item URL, no item text, no `is_upgrade` or "no upgrade" result. | 1 | CONFIRMED / medium (top user value) | D-6 output, I-8b |
| K11 | The default builds dir was wrong on WSL, the watcher can't see `/mnt/c` writes, and the engine could silently use a stale build. | 3 | CONFIRMED / medium | D-16, Q6 |
| K12 | `find_upgrades` parameters were open: slots, anoint behaviour, `jewel_type`, league default, the "include corrupted" meaning, stale stat ids. | 3 | PARTIAL / medium | D-6 inputs |
| K13 | D-9's load→modify→save clobbered the working build (single global engine build). | 1 | CONFIRMED / medium | D-9, I-1d |
| K14 | "Remove thresholds" left no resistance or survivability checks. The engine exports `Missing<Elem>Resist`, `*MaximumHitTaken` and `totalEnemyDamage`. | 2 | CONFIRMED / medium | D-3 |
| K17 | The pin check: I-7 tested the version only, the 11-file list missed the Calc and Trade modules, HeadlessWrapper's hash scheme mismatched, `POB_FORK_PATH` was ambiguous, and "refuse to start" killed the engine-free tools. | 5 | CONFIRMED / medium | D-2, I-7 |
| K18 | `process.loadEnvFile` throws when `.env` is missing, lets host env win, loads `op://` literally, is one-shot, and Jest would pick up the real cookie. | 2 | CONFIRMED / medium | D-15(1) credential getter |
| K20 | The server wasn't importable for in-process tests (side effects at import, network before connect, cookie sent at startup). | 1 | CONFIRMED / medium | D-14, D-16, D-17 |
| K22 | I-1 was 5 tests owned by different lanes. "Normalized XML" was undefined and flaky. | 2 | CONFIRMED / medium | I-1a–d |
| K15 | "Fetch 30–50" was unsupported. PoB fetches 10 × pages (default 2). | 2 | PARTIAL / low | D-6 `fetch_pages` |
| K19 | `import.meta.url` breaks the CommonJS ts-jest build (TS1343). | 1 | CONFIRMED / low | D-2 `packageRoot()` |
| K21 | The typed-contract unit overlapped B. Types are erased at runtime, so runtime schemas are needed. | 1 | PARTIAL / low | D-10 |
| K23 | Recon and S-3 cite dev head while the vision targets the tag. Three S-3 statements are dev-only. A reference to an "option c" was left dangling. | 3 | CONFIRMED / low | v2 header, recon banner, S-3 and S-1 notes |
| K24 | Stale text: the recon cookie claims, §6, §8, the S-4 OAuth note, the D-4 count, the D-15 label. | 3 | CONFIRMED / low | rewritten throughout |
| K25 | `calculate_trading_profit` is inert by construction. A coverage gate would push test padding. | 1 | PARTIAL / low | D-4(d), D-17, I-10 |

## Refuted sub-claims (considered, not acted on)

- The trigger for K1 is rare, because Lua errors are already `pcall`'d. The fix stands, at medium
  severity.
- K2: "weapons produce 48 weights" counts weights before truncation (the tag caps at 35 filters, and
  real queries had 29–31). "401/403 = expired cookie" is unsupported (PoB's 401 path is OAuth).
- K3: exports within one process *are* byte-stable. A revision counter is still the simpler key.
- K5: the proposed per-domain **registry refactor is not needed**, because post-deletion wiring edits
  are small, and the refactor would itself conflict with every unit.
- K6: a separate Lua-utility DAG node is unnecessary (it folds into P).
- K7: `export_build_summary`'s "Spell Suppression" row is dead code (its real defect is the PoE1
  class array). `lua_get_stats`' PoE1 dodge names exist on the tag and are filtered as 0 (its real
  defect is the nonexistent `EvasionChance`).
- K9b: "value per price is the natural budget sort" is opinion. PoB's default, Stat Value, stays the
  default.
- K12: "one stale id rejects the whole search" is unverified. Multi-slot budgeting is outside the
  stated intent.
- K14: the engine does **not** export `<elem>ResistMax`. Merging the three advice tools is optional.
- K15: "PoB fetches 10" is wrong for the UI (it is 10 × pages). "Deeper pages are the same
  population" is unsupported.
- K16: "signed commits block headless agents" was not shown (agent commits signed fine
  interactively). Kept as an orchestrator note only.
- K20: the trade base URL is already injectable (`POE_TRADE_BASE`), and no current test imports
  `index.ts`.
- K21: runtime validation in `send()` is a design preference, not a necessity (adopted anyway).
- K23: the recon disclosed its dev-head basis, and D-13's 274/274 is version-independent.
- K24: the `suggest_crafting` label did credit the user.
- K25: "I-3 duplicates I-4" is false (I-3 covers handlers no tool reaches, and pin bumps). "The README
  table has no value" is opinion.

Raw lens and verifier outputs were kept in the session scratchpad (not committed). This table is
the durable record.
