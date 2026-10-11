# Build-guide workflow: spec spine

**Status:** v1.4, 2026-10-11. v1.2 (2026-10-08) folded the adversarial spec review's fixes and the
coordinator's resolutions (D-210…D-238, A-31, A-32). v1.3 (2026-10-10) folded:
- the decisions made during the build, D-239…D-266 (C-33 gains `buildSha1`), and the work-log's unnumbered
  ones, D-305…D-314;
- amendment 1 (built; D-267…D-275);
- amendment 2 (approved 2026-10-09; D-276…D-284);
- amendment 3 (approved 2026-10-10; D-285…D-304);
- the resolutions of the fold's open points (2026-10-10): the user's rulings D-315 (M-14) and D-316 (no
  numeric tool cap), and the coordinator's PROPOSED D-317…D-334, A-33 and HG-22.

v1.4 folds the decisions and build facts of the amendments' waves A and B (work-log, from "2026-10-10:
amendments 2 and 3, build start"):
- the user's D-335 (no player-evidence tools: poe.ninja's terms close its builds API), which withdraws C-54,
  WU-52 and D-324;
- the coordinator's PROPOSED D-336 (coverage flags), D-337 (Full DPS in every compile) and D-338 (R1b's
  probe and card writes);
- as built: WU-54, WU-56, WU-60, WU-61 and WU-62, and the spikes WU-50 (blocked) and WU-51; WU-55's
  record fields and error class, still target until it merges.

The amendment files stay as the rationale record; this spine and its slices are authoritative.

**Inputs.** Requirements come only from these:
- the change-vision [`../../design/2026-10-07-build-guide-workflow.md`](../../design/2026-10-07-build-guide-workflow.md)
  ("design"): decision rows 1–49, the Target state, capabilities K1…O1 with their DAG and run order, the
  quality bar and the non-goals. Its review record (`…-workflow-review.md`) is already folded into it;
- the grounding reports in [`../../design/grounding/`](../../design/grounding/): pin facts and spikes
  S-a/S-b ("pin §"), the Claude Code platform answers ("platform §"), external game data ("ext §");
- the recon [`../recon.md`](../recon.md) ("recon §"), the existing-system map with file:line references;
- the gap analysis [`../gaps.md`](../gaps.md) ("gap n"), items 1–35. The user accepted every PROPOSED
  item and settled item 4 on 2026-10-07; item 32 is HG-14 here;
- the adversarial review's binding fix plan [`../spec-review-2026-10-07.md`](../spec-review-2026-10-07.md)
  ("review Sn"), folded in as D-210…D-221 and C-50, and the coordinator's binding resolutions of the
  slice writers' open items (2026-10-07), folded in as D-222…D-238, A-31 and A-32;
- the work-log [`../worklog.md`](../worklog.md) ("WL:n"): the decisions made during the build, folded in
  as D-239…D-266 and D-305…D-314, and, from its section "2026-10-10: amendments 2 and 3, build start" on,
  as D-335…D-338; its section "Spec fold v1.3 (2026-10-10)" defines the fold's gap ids F1…F27 ("F-n");
- the spike reports [`../spikes/WU-50-poe-ninja.md`](../spikes/WU-50-poe-ninja.md) (S-N1) and
  [`../spikes/WU-51-full-dps.md`](../spikes/WU-51-full-dps.md) (S-N2);
- the user-approved amendments, folded in and kept as the rationale record:
  [`amendment-1-simplify.md`](amendment-1-simplify.md) (D-267…D-275),
  [`amendment-2-guide-style.md`](amendment-2-guide-style.md) (D-276…D-284) and
  [`amendment-3-open-builds.md`](amendment-3-open-builds.md) (D-285…D-304);
- the PoB gaps list [`../pob-gaps.md`](../pob-gaps.md) ("PG-n"), the running list of what the pinned PoB
  gets wrong or doesn't model, which amendment 3 and C-53 cite;
- the resolutions of the fold's open points (2026-10-10): D-315…D-334, A-33 and HG-22.

This spine is the single source of truth for what crosses slices: the contracts (C-30…C-54, C-54
withdrawn, plus the amended stabilization contracts in §3.1), the decision log (D-100…D-338), the autonomy
envelope (A-20…A-33, HG-10…HG-22), the milestones (M-10…M-14), the work-unit DAG (WU-30…WU-62), the guardrails,
the risks (R-20…R-39) and the cross-cutting acceptance criteria (AC-B). The stabilization spine
(`docs/stabilization/spec/README.md`, "stab spine") stays in force wherever this spine doesn't amend it.
No ID here collides with it. When a slice and this spine disagree, this spine wins; fold fixes back here.

| Slice spec | Scope | Work units | AC prefix |
|---|---|---|---|
| `01-server-tools.md` | K1 lookups, K2 coverage, M1 breakdown and the skill-part fix, M2 ranker amendments, L1 set and tree-state authoring, the existing defects, T1 dated price outputs, a mod's base types and essence hits (D-277), the coverage flags (D-300, D-336); *target:* the lookup additions (D-299). The poe.ninja tools (C-54) are withdrawn (D-335) | WU-31…WU-36, WU-49, WU-54, WU-60 (built); WU-50 (done, blocked by poe.ninja's terms); WU-52 (withdrawn, D-335); WU-53 (target, D-318) | AC-K |
| `02-plan-compiler.md` | The compile-time spike, the guides-folder root, the P1 plan schema, the C1/E1 data files, the import-code encoder, the P2 compiler and ledger (`compile_plan`'s measure-only and final modes, the write ledger), `guide_run` (the run-folder and validate modes), the V1/V2 checks, the entering-maps rung and the ladder track (D-281, D-282); *target:* Count and custom modifiers (D-293, D-337) | WU-30, WU-37…WU-42, WU-61 (built); WU-51 (done); WU-55 (target) | AC-P |
| `03-pipeline.md` | The skill, its runner and four agent types (D-267), V4 and the fix round, the guide's reader layer and the audit layer (amendment 2), the run log, the pricing procedure, the offline mode and the offline end-to-end run, the pattern library, the card template and the checklist's text, the alpha; *target:* the brief, the three phases and gates, cards, the verification checklist's run (amendment 3) | WU-43…WU-47, WU-56, WU-62 (built), WU-48 (human); WU-57…WU-59 (target) | AC-W |
| this spine | Cross-cutting criteria | — | AC-B |

**Reading rule for build agents.** Read the stab spine's §2.2 conventions, this spine, then your unit's
slice spec. Cite IDs in commits and the work-log. Anything no contract or decision settles is either a
proceed-on assumption (§6.2) or a human-decision gate (§6.3). Never invent a third category. A passage
marked *target* describes approved behaviour that isn't built yet (the amendment units not yet merged:
WU-53, WU-55, WU-57…WU-59); until its unit merges, the as-built behaviour stated beside it holds.

**Capability glossary** (the design's IDs): K1 game-data lookup · K2 model-coverage detection · M1
offense breakdown and skill-part selection · M2 ranker amendments · L1 set and state authoring · P1
build-plan format · P2 plan compiler · C1 campaign reference data · E1 enemy reference profiles · T1
dated pricing · V1 stage validity check · V2 config check · V4 claim verification (V3, the provenance
check, was removed by D-268) · R1 research (R1a parallel lookup-only agents, R1b the coordinator's
compile, measure and price) · D1 endgame design · D2 campaign plan · W1 guide writer · O1 orchestration,
now the runner: the user's session following `SKILL.md` (D-267).

---

## 1. Existing system context

Summarized from recon (an audit of `e6ebec1`), which holds the file:line evidence. Nothing here is
redefined; §3 tags every contract this epic relies on or changes.

### 1.1 Components in scope

| Component | Today (recon §1) | Changed by |
|---|---|---|
| Tool wiring: `toolSchemas.ts`, `toolMeta.ts`, `toolRouter.ts`, listing in `createServer.ts` | 77 `TOOL_META` entries (kinds `none`, `read`, `mutate`, `load`, `lifecycle`; groups `core`, `trade`, `ninja`). A tool without an entry is unlisted and unroutable. Unknown tool → −32602. Handler errors → `isError` | every tool-adding unit (§7) |
| Engine session `src/engine/session.ts` | One FIFO lock per tool call, any kind. Snapshot (a full XML export) after each successful `mutate`/`load`. A ctx load (`newBuild`, `loadFile`) drops the previous build's snapshot (`:778`), so a crash before the call's own snapshot takes the no-snapshot path (`RESTORE_FAILED`, `:230`, `:589`). `isDirty()` and `loaded` are public. Only `find_upgrades` has a deadline | none; `compile_plan` is one call (D-156) |
| Bridge client `src/pobLuaBridge.ts`; reply schemas `src/engine/schemas.ts` (43 actions) | 30 s per request, SIGKILL on timeout. Every reply is validated; a missing schema is a compile error | new actions (C-2/C-5 rows) |
| Lua: `pob-api/API/{Server,Handlers,BuildOps}.lua`; `Trade.lua` merged by one line at `Handlers.lua:493` | `pcall` dispatch; BuildOps returns `value` or `nil,'msg'` | new Lua modules, merged the same way |
| `buildFileWriter` `src/services/buildFileWriter.ts` | Canonical path, explicit overwrite, changed-on-disk guard, backup, temp file + rename | used by `compile_plan` (C-17) |
| Trade: `rateLimiter.ts`, `tradeClient.ts`, price tools | Waits over 30 s → `would_wait`. No price or listing cache. `get_item_price` names the league, gives no date | C-49 (D-202) |
| `lua_get_stats` | `category:'offense'` gives 38 main-skill fields; values are `mainOutput` scalars only; on the 5000-char truncation list | C-45 |
| `set_main_skill` → Lua `set_main_selection` | Writes PoE1's `srcInstance.skillPart`, not PoB2's `statSet`; `skill_part` is an undocumented router alias | C-44 |
| `search_tree_nodes` | `node_type:'any'` matches nothing; the loop stops at the cap before sorting; no ascendancy filter; query required; cap 30 | C-43 |
| `list_gems` | Names, tags, tier, attribute weightings; no description, stat text, stat sets or support rules | unchanged; K1 adds C-37 |
| `get_passive_upgrades`, `suggest_supports` | D-77, D-78: ascendancy notables excluded; unmeasured candidates sort as −∞ and fall off | C-47 |
| `lua_set_tree`, `update_tree_delta` | Lua neither auto-paths nor caps ascendancy points; the TS side reads `autoPathedNodes`, `skippedAscendancyNodes`, `ascendancyPointsUsed`, which Lua never sends | C-48 |
| Specs; item sets | Spec tools exist. Item sets: list and select only. No skill-set or config-set operations at all | C-39 |
| `add_item`, `toggle_flask` | `ITEM_SLOTS` has no tree-jewel sockets (Lua accepts any slot). `toggle_flask` acts on the active item set | C-46; `toggle_flask` unchanged |
| `set_character_level` → Lua `set_level` | Always forces manual mode; nothing sets `characterLevelAutoMode` | bridge flag only (D-196) |
| `src/utils/buildCode.ts` | Decode only; an encoder exists only in tests (`toolHygiene.test.ts:95`) | C-42 |
| `plan_leveling` data, `export_build_summary` | Hand-written table without area or quest data (not reused, D-131); summary without import code | unchanged |
| `.claude/` | 8 agent-os agents and 6 commands; no skills, no workflows | slice 3: the build-guide skill and its four agent types; no workflows (D-267) |

### 1.2 Conventions every unit follows

- **Stab spine §2.2:** ESM with Node16 resolution, relative imports ending in `.js`, `import type`; no
  `import.meta`, `__dirname` or top-level `await` in `src/`; log only to stderr as
  `console.error('[Component] …')`; only `src/index.ts` reads `process.env`; Lua in `pob-api/` uses
  two-space indentation and `local M = {} … return M`; `vendor/` is never modified.
- **A new tool is 4 code edits plus 4 fixture and doc edits** (recon §2): the schema literal, the
  `TOOL_META` entry, the router `case`, `handle<Name>` wrapped in `wrapHandler`; a `tool-disposition.json`
  entry (`bucket:"new"`); at least one `expect:"ok"` sample in `tool-calls.json`; the README table
  regenerated with `pnpm build && pnpm docs:tools --write` (D-83); the count sites (§1.3).
- **Checks that already apply to every tool:** router and registry agree; output text never contains
  `undefined`, `NaN` or `[object Object]`; descriptions are ≤ 2048 chars; engine kinds are verified by
  `engineKinds.test.ts` (a `read` sample leaves the canonical export and `revision` unchanged; a
  `mutate`/`load` sample changes both; a sample may declare `stateChange:false` with a reason).
- **Static scans with empty waiver files:** the PoE1-cruft scan over every string literal in
  `src/**/*.ts` (bans PoE1 boss names, `Shadow`, …); the advice-threshold scan over `src/advice/*`,
  `validationHandlers.ts`, `optimizationHandlers.ts`, `buildGoalsHandlers.ts` (bans `quest points`, …);
  `deletedPlumbing`; no dead modules; explicit env in every test spawn.
- **Every new Lua action** gets a C-5 zod schema, a typed bridge wrapper and a `contract.test.ts` case in
  the same merge. Actions are snake_case, params camelCase.
- **Dependencies today:** zod 3, fast-xml-parser, chokidar, the SDK; `zod-to-json-schema` is a
  devDependency. There is no YAML parser and no runtime JSON-Schema validator.

### 1.3 Existing data and state in scope

- **Build XML** (recon §4). Build-wide: `<Build level characterLevelAutoMode mainSocketGroup>`. Per tree
  spec: `<WeaponSet1>`/`<WeaponSet2 nodes>` (weapon-set tags), `<Sockets><Socket nodeId itemId>` (tree
  jewels), `<Overrides><AttributeOverride strNodes dexNodes intNodes>` (attribute choices). Per skill set:
  gems with a per-gem stat-set choice. Per item set: `useSecondWeaponSet`, `<Slot name itemId active>`.
  Per config set: only non-default `<Input>`s are saved (pin `Classes/ConfigTab.lua:739`).
- **State dir** (C-16): `$XDG_STATE_HOME/pob2-mcp/` with `snapshots/`, `backups/`, `exports/`,
  `presets/`; the recovery snapshot lives in memory (D-44). This epic adds one file there: the write
  ledger `guide-writes.json` (D-211).
- **Count sites** asserting 77 tools (76 without poe.ninja) at the recon, and 84 (83) since WU-41:
  `tests/mcp/tradeQueryOptions.test.ts:86, :91`; `tests/mcp/findUpgrades.test.ts:1086, :1089`;
  `tests/static/readme.test.ts:137` (rows) and `:4, :128` (text);
  `tests/integration/gemCorruption.test.ts:306, :310, :326`; `scripts/fresh-clone-check.mjs:10, :19, :27`
  (it derives the ninja-less count); the comment at `scripts/fresh-clone-check.sh:12`;
  `tests/mcp/toolDisposition.test.ts:36-40`, whose `build-guide` lane counts this epic's new tools from
  `BUILD_GUIDE_NEW`; and the README's two tool-count sentences, `README.md:21, :60` (D-305). They stay
  at 84 and 83: D-335 withdrew the poe.ninja tools (C-54), so no amendment unit moves them.
- **Golden values no change may move:** 109 `PlayerStat` pairs survive save and reload
  (`tests/integration/golden.test.ts`); `golden-stat-fields.json`; CombinedDPS 104489.78
  (`engineTree.test.ts:86`); Life 2,977 (`fresh-clone-check.mjs:123`).

### 1.4 Prior decisions in scope

- **Respected unchanged:** D-8/D-59 (a lock per call; only the session starts the engine), D-17 (the gate),
  D-18 (no server state in the builds folder), D-19 (disk-change policy), D-22/D-47 (only `find_upgrades` has
  a deadline; 30 s per engine request), D-26 (zod v3, never passed to the SDK), D-27 (handler errors are
  `isError`), D-36 (text output only), D-40 (no automatic retries), D-45 (strict hygiene allowlist), D-46
  (trade responses never cached), D-48 (unsigned commits during the build), D-52 (canonical build paths), D-83
  (generated README table), C-17 with D-60/D-80/D-86 (the writer).
- **Amended or scoped here:** D-77 and D-78 (by D-143, C-47); C-1 and the D-64/D-91 counts (D-174);
  D-65's text (D-198); D-3/D-30 (D-168, D-203); D-42/D-88 path confinement (D-177); C-16 and C-19,
  additively (D-211, review S17). D-34 (no live network from agents or tests) and stab HG-1 (a live request
  to pathofexile.com or poe.ninja needs the user) are amended by D-297, as D-335 restates it, for
  poe.ninja's documented economy endpoints only: polite requests to them are allowed in development and in
  runs (C-12's currency rates), its builds, profiles and character API is never used, pathofexile.com and
  any request that carries a cookie or personal data stay gated, and tests stay offline. Stab HG-3
  (tool-set changes need the user) is resolved for the tools gap 23 names (D-173), for `guide_run` inside
  D-173's cap (cap lifted, D-316; D-216), and for C-49's additive price outputs and error prefix by D-202
  and D-218 once ratified. D-316 also resolved it for C-54's poe.ninja tools, which D-335 withdrew, so it
  now covers no new tool.

## 2. Problem and goals

The user has played PoE1 and PoE2 for years but has never built a character from scratch. They want a
workflow that takes a brief and produces a written guide plus a PoB2 build that a newcomer can follow from
level 1 through endgame (D-101). The brief is any mix of an ascendancy, a skill, a playstyle, a budget, an
item or mechanic to build around, a reference build, or almost nothing; a randomizer roll of an ascendancy
and a main skill (first: Titan / Blood Hunt) is one case (D-285, target). The user is the guide's reader,
not its fact-checker, so the workflow checks its own claims and says plainly when it guesses (D-105,
D-142). PoB2 leaves much unmodelled: 12.9% of unique mod lines, about 30% of keystones and 32% of
ascendancy notables carry a line PoB ignores (pin §D), so hand calculations are routine.

| Goal | Statement | Proven by |
|---|---|---|
| G-10 | The server exposes PoB2's loaded game data, per-skill and per-skill-part numbers, and what PoB can't model (K1, K2, M1, M2) | AC-K |
| G-11 | The server can author every piece of a stage's state: sets, loadouts, weapon-set passives, attribute choices, tree jewels, flask toggles, a consistent main skill (L1) | AC-K |
| G-12 | A plan compiles into one PoB2 file with a loadout per stage, a compile record, a re-evaluated ledger, an import code, and V1/V2 verdicts (P1, P2, C1, E1, V1, V2) | AC-P, NFR-20, NFR-21 |
| G-13 | The pipeline produces the dossier, plan, record and guide, every claim tagged with its source and checked by V4, with the findings still open stated in the guide (R1, D1, D2, W1, V4, O1; D-268). Since WU-62 (D-276, D-278), the guide renders the plan without markers, the plan's claims carrying the sources, with `audit.md` beside it. *Target (WU-57, D-287):* the brainstorm adds the cards and the deck | AC-W, M-12 |
| G-14 | The Titan / Blood Hunt guide is one the user can actually level and map with | M-13 sign-off |
| G-15 | Nothing existing regresses: tool contracts, golden values, the offline rules | AC-B |

## 3. Interface contracts

Status tags: **existing** (relied on, unchanged), **modified** (delta and compatibility shown), **new**.
The summaries are binding; the slice named in §3.2 carries the full detail.

### 3.1 Stabilization contracts this epic relies on or amends

| ID | Boundary | Status | Delta and backward-compatibility impact |
|---|---|---|---|
| C-1 | MCP tool surface | modified | The tool set is stab §4's table plus C-37…C-42 and C-50: **84 tools, 83 with `POE_NINJA_DISABLED=true`**; all seven new tools are group `core` (D-216). Corrects C-1's stale "76" (it has been 77 since D-91). Existing tools change only as C-43…C-49 say. No poe.ninja tool is added: D-335 withdrew C-54, so group `ninja` keeps its one tool, `get_currency_rates`, and both counts stay 84 and 83. **Compat:** additive; nothing removed or renamed |
| D-64, D-91 | Count assertions (§1.3 sites) | modified | Each literal moves to the new total in the merge that adds a tool (§7 wiring rule). 84 and 83 since WU-41; no amendment unit moves them (D-335) |
| C-2, C-5 | Wire protocol v2; reply schemas | modified (D-222) | **New Lua actions** behind C-37…C-41. **Existing actions, additive:** `search_nodes` adds `ascendancy?` (with it, `keyword` is optional) and sorts before the cap; `get_stats` adds `breakdown?` and, only with it, a `breakdown` reply field; `set_level` adds `autoMode?` (default false, D-196); `set_tree` adds `weaponSets?` and `attributeChoices?`; `update_tree_delta`'s reply adds `autoPathedNodes`, `skippedAscendancyNodes` and `tree.ascendancyPointsUsed`, which the TS side already reads (D-194), and it refuses an add that would re-tag an allocated node (D-308); `set_main_selection`'s reply adds an optional `statSet` (D-309); `check_coverage` adds `sourceTemplates?` (D-243). Since WU-60 (D-277), `lookup_game_data`'s mechanic reply carries a mod hit's base types (`baseTypes`, `notRolled`) and essence hits, and `kinds` counts `essence`; since WU-54 (D-300, D-336), `check_coverage` takes `sourceCallNames?` and `sourceSkillTemplates?` and replies with `flags[]`. *Target:* `create_socket_group` adds `groupCount` (D-293, WU-55); `lookup_game_data` gains D-299's additions (WU-53). **Renamed:** `set_main_selection`'s `skillPart` param becomes `statSet` (D-195). **Compat:** every change is additive except that rename, which is internal: only `set_main_skill` calls the action |
| C-3 | Engine session | existing | New engine tools run in `session.run` by kind; `guide_run`'s run-folder mode runs outside it (D-216). `compile_plan` holds one lock for the whole call (D-156). A crash mid-compile runs C-3's recovery and fails the call (D-165). The compile's `new_build` drops the recovery snapshot (§1.1), so recovery takes the no-snapshot path: the next `read` or `mutate` call fails with "the loaded build could not be restored", and a later compile succeeds |
| C-4 | Bridge client | existing | Its 30 s per-request timeout bounds each compile stage request (NFR-21) |
| C-6 | PoB pin | existing | v0.23.1, game 0.5.4 data. Unchanged (HG-11) |
| C-7 | Server factory | modified | `ServerDeps` gains the guides root (C-34), resolved in `src/index.ts`. No I/O at construction. **Compat:** additive |
| C-8 | Tool registry metadata | modified | Seven entries, with the kinds in §3.2. The router's per-call rules (`engineKindFor`, `src/server/toolRouter.ts`) set two call-dependent kinds: a `guide_run` call is `none` unless it is a validate call without `new_run` (D-216), and `manage_sets {action:"list"}` is `read` (D-244) |
| C-11 | Rate limiter | existing | T1's pacing relies on its `would_wait`/`locked_out` answers (D-160, D-202) |
| C-16 | State dir | modified (additive) | Gains one file, the write ledger `guide-writes.json` (D-211). **Compat:** additive; the existing folders are untouched |
| C-17 | Build-file writes | existing | The compiled PoB file is written through it (D-155, D-199); a measure-only compile writes none (D-208). An existing target reaches it only under the write ledger's rule (D-211), and its own guard still applies |
| C-18 | Test harness | modified | `globalSetup` also points `POB_GUIDES_DIRECTORY` at a fresh temp dir; `spawnServer` passes it explicitly. **Compat:** additive |
| C-19 | Developer entry points | modified (additive) | The `test` task gains a separate step after `pnpm test`: `compilePlanNfr.test.ts` with `--runInBand`, which the main Jest run excludes (review S17). The task stays pipe-free and its exit code propagates. **Compat:** `mise run test` still runs every test |
| D-77, D-78 | Ranker behaviour | modified | See C-47 (D-143). AC-E39's ordering is kept |
| D-65 | `load_build_xml` contract text | modified (text) | Its "crash recovery still reloads without `keepLevel`" is stale; see D-198 |
| D-3, D-30 | Advice judgments | scoped | Binding for the advice tools only; see D-168, D-203 |
| D-42, D-88 | Path confinement | extended | The guides root joins the allowed roots (D-177) |
| D-46 | No trade-response cache | existing | Kept: prices live in the plan (D-169) |

### 3.2 Contracts of this epic

**C-30 Source tag** (new; all slices). Every claim in a plan, a data file, the dossier and the guide
carries one (D-105): `{kind, ref, accessed?, patch?, confidence?}`.
- `kind` is one of: `pob-computed` (ref = a compile-record field, C-33); `pob-data` (ref = a pinned PoB
  `file:line` or a lookup-tool result); `external` (ref = a URL, with `accessed` required); `judgment`;
  `external-unavailable` (ref = the text `external source unavailable (offline run)`), for a claim that
  would need an external source during an offline run (C-36, D-201).
- `confidence` is H, M or L (the grounding's scale). It is required for `external`, `judgment` and
  `external-unavailable` (quality bar: confidence is stated wherever PoB can't verify).
- Instead of a tag, a claim may cite a ledger entry (`ledger:<id>`, C-33; the entry's inputs carry their
  own tags), a price entry (`price:<id>`, the plan's `prices[]` entry with its date, league and query,
  D-237), or a C1/E1 fact (`data:<file>#<key>`, `<file>` relative to `data/`; the fact carries its own
  citation, D-232).
- The run checker checks tag syntax (every marker resolves and parses as a tag), and V4's sources lens
  reports any number or mechanic claim without a source; V4 checks that claims are true (D-179, D-268).
  V4 accepts `external-unavailable` only when the run log records offline mode; in any other run it is a
  finding.
- Since WU-62 (D-276), `guide.md` carries no markers: it renders the plan, whose claims carry the sources.
  Markers stay in the dossier and the research files.
- Offline, V4 checks a `data:` claim against the data-file fact and the citation stored there, without
  fetching the fact's URL (D-232).

**C-31 Build plan file** (new; slice 2 holds the full zod schema).
- `plan.json` in a run folder (C-34), JSON, validated by zod inside `compile_plan` and `guide_run`'s
  validate mode (D-167, D-216). `schemaVersion` is an integer; both accept only versions they know and
  otherwise fail naming them. A schema error names its JSON path and nothing is compiled (D-163).
  Since WU-61 (D-320, D-332), the versions they know are 1 and 2. A version-1 plan keeps version 1's shape:
  it defaults what version 2 added (no `entering-maps` variant; *target, WU-55:* `count` 1, no
  `customMods`), and a version-1 plan that uses a version-2 field is an error at that field's path, naming
  the version that added it.
- **Required top level:** `schemaVersion`; `roll` (class, ascendancy, rolled skill; *target:* the card's
  identity, `skill` its named damage source, fixed for the run at the verification pick, D-286, D-295);
  `versions` (the PoB pin tag and commit, the tree version, the game patch the engine data targets, and
  separately the patch of the prices and boss data, D-107); `league` (the pricing league; null only when
  every price is `unavailable` with `note: "offline run"`, which the schema enforces, D-233; an online run
  that can't reach the trade site writes `"unverified"`, D-313, D-330); `stages`; `ledger`; `prices`.
- **Required per stage:**
  - `id`; `loadoutName`, which carries the level and any `{id}` list (D-103, D-138); `level`;
  - `progress`: a C1 key for the campaign point reached, of the form `start`, `endgame` or
    `q.<QuestRewards key>` (D-214). V1 derives quest points, trial gates, the resistance penalty and gem
    availability from it;
  - `tree`: a complete, connected node list (recon §7 item 5), weapon-set tags, attribute choices and
    ascendancy nodes; a `respec` note with its gold cost wherever the tree drops a node the previous
    stage had (D-144);
  - `items`: item text per slot, tree jewels, flask and charm toggles, the second-weapon-set flag;
  - `skills`: socket groups, each with a `role` (`clear`, `single_target`, `utility` or `leveling`), gem
    levels and quality; the main skill at one group index shared by every stage (Target state 5); and
    `rolledGroup`, the 1-based index of the group that holds the rolled skill (*target:* the named damage
    source, D-295), set wherever the stage has it and required on endgame variant stages (D-217). On every
    stage with a `rolledGroup`, D1 sets `skills.main.statSet` and `main.group` is `rolledGroup` (D-273).
    Each group (WU-55, D-293, D-320; built) gains `count` (an integer of at least 1, default 1) and
    `countReason` (needed when `count` isn't 1; its absence is a V1 finding, D-322);
  - `config` (C-32) and `claims` (C-30-tagged). A campaign reward pick is listed on every stage at or after
    its quest, the endgame stages included (D-265 c).
- **Endgame variant stages** also require `variant` (`budget`, `non-budget`, or since WU-61
  `entering-maps`, D-281), per-gem levels, `ascendancyPoints` and `skills.rolledGroup` (D-217). D1 chooses
  these and the stage's `level` per variant, each with a source or a rationale; the schema fixes no values
  (D-193).
- One `schemaVersion` bump, to 2, covers `entering-maps`, `count`, `countReason` and `customMods` (D-320):
  WU-61 made it with `entering-maps`, and WU-55 (*target*) extends the same version with the other three.
- `ledger[]` entries are `{id, claim, formula, inputs}` (C-33). `prices[]` entries are `{id, item,
  query, amount, currency, date, league, status, note?}`, where `id` is what a `price:<id>` claim cites
  (D-237), `status` is `ok` or `unavailable` (D-164, D-169), and an `unavailable` entry's `note` gives
  the reason (`offline run` in offline mode, D-233).
- Stages may share item, skill or config sets; the compiler names shared sets with `{id}` lists (D-103).
- Agents get a committed reference with a worked example (D-167), kept equal to the zod schema by a test.

**C-32 Config classes** (new; part of C-31, checked by V2).
- **Earned player state** (stacks, charges, conditions, flask and charm toggles):
  `{option, value, producer, uptime}`. `producer` is `{kind, name}`, with kind item, gem, passive,
  skill, flask or charm. V2 checks the producer is present in that stage (D-114).
- **Scenario inputs** (enemy level, `enemyIsBoss`, enemy damage per type and resistances, waystone
  modifiers, quest rewards, the resistance penalty): `{option, value, source}`, where `source` points
  into a C1 or E1 file and key.
  - **Baseline** (a subclass, D-230): a default-on option that models a neutral state, such as full life
    or mana, may stay at its default only if the committed `data/config-baseline.json` lists it with a
    one-line rationale. The same file may list placeholder-driven options (D-212). A skill-conditional
    option is baseline only while PoB hides it for the stage (D-250), and on a boss-scenario stage the
    enemy's level, armour, evasion, resistances and crit are scenario entries citing E1, never baseline
    (D-252).
- **Custom modifiers** (WU-55, D-293; built) `config.customMods: [{text, reason}]`, a third kind beside
  earned state and scenario inputs, with no producer and no source key: each is a hand-calculated effect,
  written to PoB's `customMods` option, one line per entry. It is optional, and an entry without a reason is
  a V1 finding (D-320, D-322).
- `compile_plan` writes every listed option explicitly into the stage's config set, and writes
  `enemyIsBoss` into every config set (D-119; PoB's default is Pinnacle, pin §B5).
- **Placeholders are values** (D-212). PoB applies a numeric option's placeholder when it has no input,
  and `enemyIsBoss` sets the placeholders of the enemy's level, damage, resistances, penetration,
  armour, evasion, speed and crit. An option so driven counts as set.
- **Default audit** (V2): any default-on or placeholder-driven option the stage doesn't list, and
  `data/config-baseline.json` doesn't list, is a finding, e.g. the quest-reward checkboxes (pin
  `Modules/ConfigOptions.lua:78`) or the enemy's resistances. Slice 2 enumerates the defaults from the
  defaults loop over PoB's `ConfigOptions` module, which creates no config set (review S21), and the
  placeholders from the stage's config set after its recalculation.
- **Save drops some values** (D-212): PoB saves no `<Input>` whose value equals the active set's
  placeholder. So `compile_plan` puts every listed option the save dropped back into its stage's
  `<ConfigSet>` in the written file, and checks each is there with its value; the record's `saveWarnings`
  names the options a re-save in PoB2 would drop again (D-248). The compile record holds every stage's
  effective values, explicit, default or placeholder, with their class, and is authoritative (D-113).
- Reference hits enter as scenario inputs through the per-type enemy-damage options (pin §B5). Enemy life
  is no PoB option; it stays in the dossier and the ledger (E1 row).

**C-33 Compile record and ledger** (new; slice 2).
- `compile-record.json`, written by `compile_plan` next to the compiled plan (D-155, D-200). It holds:
  - the plan's `schemaVersion` and the engine versions actually used (pin tag and commit, tree version);
  - the plan's sha1 (`planSha1`) and `buildSha1`, the sha1 of the plan's build projection: the plan
    without `stages[].claims` and without every `source` and `tag` field at any depth (D-266). It tracks
    build content; sources and tags are citations, so an edit to `config.scenario[].source` or
    `respec.goldCost.source` alone leaves it unchanged, by design (D-328). `ledger[].claim`, `respec.note`
    and `chaosResistException.reason` stay in the projection;
  - the PoB file's canonical builds-folder path (for a measure-only compile, the compiled XML's path
    relative to the guides root instead, D-208) and its sha1, and `importCode` (D-205), whose one home is
    the record: no verdict file or run log copies it (D-260). These are informational: overwrite
    permission comes from the write ledger, never from the record (D-211);
  - `loadoutWarnings`, where switching loadouts in PoB2 can unequip a planned off-hand (D-310), and
    `saveWarnings`, the options a re-save in PoB2 would drop (D-248);
  - per stage, keyed by stage id: the loadout name, the level it was measured at, named outputs (PoB's
    `mainOutput` field names plus C-45's per-skill and per-stat-set fields), the effective config values
    with their origin and class (D-212), and the V1 and V2 verdicts with their findings (D-192);
  - per ledger entry, its re-evaluated value.
- `recordVersion: 2` (WU-55, D-293, D-321; built). The raw `outputs` and `skillOutputs` stay as PoB
  measured them, and these fields sit beside them (the fields WU-55 names, work-log "Review: WU-55"):
  - per stage, `countedOutputs {group, count, dotCanStack, fields}` (the main skill's figures with the main
    group's Count) and `countedSkillOutputs[g<g>s<s>p<p>] {skill, statSetLabel, count, dotCanStack,
    fields}` (each `skillOutputs` entry under the same key, with its group's Count);
  - the counted `fields` hold `TotalDPS` and `ImpaleDPS` × count, `TotalDot` × count only when
    `dotCanStack` is true, and the ailment and ground DPS figures unchanged, by PoB's own Full DPS rule
    (`Modules/Calcs.lua:342-411`). A figure Full DPS doesn't merge per skill has no counted copy;
  - PoB's raw `FullDPS` and `FullDotDPS` already include Count (PoB applies `groupCount` there), so nothing
    multiplies them again;
  - per stage, `customModsWritten: string[]` (the lines written into PoB's `customMods` option) and
    `computedWithCustomMods`, the mark: true when the stage's written config holds that option with text
    (from `customMods`, or a version-1 plan's earned or scenario entry for it), so every figure of the
    stage, defences included, was computed with a custom modifier present; per ledger entry,
    `computedWithCustomMods`, true when its formula reads such a stage.

  The headline and the verdict line read the named source's Count-scaled figure,
  `countedSkillOutputs[g<main.group>s<main.activeSkill>p<main.statSet>].fields.TotalDPS`, with `TotalEHP`
  beside it (D-294).
- **Ledger formulas** (in the plan) are arithmetic over numbers, `+ − × ÷`, parentheses and named
  references. A reference is either `<stageId>.<outputName>` from this record or an input declared in
  the entry with its C-30 tag. A small evaluator in `src/` computes them: no `eval`, no dependency
  (D-170). Slice 2 defines the grammar and its errors.
- V4 re-derives each entry from this record (D-142, D-179).

**C-34 Guides folder and run folder** (new; slice 2 owns the root, the path rules and run-folder
creation, slice 3 the layout inside a run).
- **Root:** `POB_GUIDES_DIRECTORY`, read only in `src/index.ts`. Default: `Guides` beside the builds
  folder (D-154), i.e. `…/Path of Building (PoE2)/Guides`, outside the folder PoB2 browses.
- **Root and builds folder are disjoint** (D-220): `guide_run`'s run-folder mode and `compile_plan`
  refuse a guides root whose real path equals, is inside, or contains the builds folder's real path.
- **Run folder:** `<root>/<slug>/<YYYY-MM-DD>-<n>/`, created by the server: `guide_run`'s run-folder
  mode makes it and returns its absolute path, which the skill and every agent use; no agent needs to
  know the root (D-207, D-216). A run never writes into an earlier run's folder; re-compiling within a
  run overwrites that run's own outputs (D-153).
- **Files** (D-200): `plan.json` (agents), `compile-record.json` (server), `dossier.md`, `guide.md`
  (includes the import code), `run-log.json` (D-158, D-270). Concept skeletons live in `concepts/<id>/`,
  research files in `research/`, gate verdicts (written by the gate steps) and V4 reports (written by the
  runner) in `reports/` (D-267); each compiled plan gets its record beside it, and a measure-only compile
  also its compiled XML (D-208). Since WU-62, `audit.md` (D-278). *Target:* the cards `cards/<id>.md`
  and the deck `cards.md` (D-287, D-319); probe variants in `probes/<card-id>/<n>/` (D-331), which R1b's
  checklist already writes (WU-56), and which R1b's header and the checker admit from WU-57 and WU-58
  (D-338).
- **Slug** (*target*, D-285): from the brief, e.g. `titan-blood-hunt`, `titan-open` or
  `open-<first playstyle tag>`; the picked card is recorded in the run log, not in the folder name. As
  built, it is `<ascendancy>-<skill>`.
- **Server path rules** (D-155, D-177): the `plan_path` of `compile_plan` and of `guide_run`'s validate
  mode resolves relative to the root, symlinks resolved, and must stay inside it. The server writes only
  the run folders it creates (D-207), files next to that plan, the target PoB file through C-17 (never
  in measure-only mode, D-208), and that file's entry in the write ledger in its state dir (D-211).
- **Agents** write only inside the current run folder (D-177).

**C-35 C1 and E1 data files** (new; slice 2).
- Repo-root `data/campaign/*.json` (C1) and `data/enemies/*.json` (E1), outside `src/` (D-168). The
  compiler and checks load them through a zod-validated loader (an invalid file is an error naming the
  file and key); agents read them directly.
- **Shape:** `{schemaVersion, sources[], facts}`, where each `sources[]` entry is a C-30 tag with an id,
  and each fact is `{value, source, patch, confidence, note?}`: every value carries its own citation and
  patch (gap 18).
- **C1 holds** (C1 row, D-131): acts and interludes with area levels (interludes: base levels plus the
  dynamic +8, M); the book schedule (24 passive points and 24 weapon-set points); ascendancy trial gates;
  quest rewards (100 Spirit in total, resistances, life, mana, the permanent choices); the resistance
  penalty per stage (−10 each, −60 in endgame); gem availability by uncut-gem tier; the passive-point
  maximum (123, plus the M-confidence Martyr point).
- **E1 holds** (E1 row, D-116, D-119, D-132): the non-quest Arbiter of Divinity's datamined hits by damage
  type and its 0.5.5 resistances, and three low-confidence inputs for its fight life (A-30);
  map-monster life and damage by area level (PoB's tables, `pob-data`); waystone modifiers (M); no rarity
  multipliers (A-27).
- Per-guide values are copied into the plan with their tags, so a guide stays reproducible (D-168).

**C-36 Stage artifacts** (new; slice 3). What passes between the run-order steps (design "Run order"), as
built after amendment 1. Every step but the runner's own is one Agent call by the runner, naming the
step's agent type (`build-guide-researcher`, `-coordinator`, `-writer` or `-verifier`) as `subagent_type`
(D-267):

| Step | Run by | Reads | Writes | Must pass before the next step |
|---|---|---|---|---|
| R1a | Researcher agents, ≤ 3 in parallel per research round (D-161, D-235) | the roll; L tools; C1/E1; web on D-171's hosts (none in offline mode) | `research/p<k>-r1a-<n>.md`, one per researcher, by focus (D-311): mechanics writes `Mechanics` and `Config gaps` and proposes 0–1 concept, items writes `Synergy search` and proposes 1–2, tree writes `Synergy search` and proposes 1; each proposal holds key uniques, ascendancy nodes, supports, keystones, a feasibility read, risks and what PoB can't verify; the round carries at most 3 (D-235) | — |
| R1b | Coordinator, one concept at a time, ≤ 3 per round | concept proposals | per concept: a skeleton plan, its measure-only compile record and XML (D-208), key-item prices (T1), its verdict file | each skeleton compiles; after 2 counted retries the concept is `failed` (D-272) |
| R1b-assemble | Coordinator | research files, skeletons, verdicts | `dossier.md` (its one writer; not verified, D-269) and the checkpoint-1 comparison | — |
| Checkpoint 1 | Runner, asking the user (offline mode: a pre-supplied answer, A-28) | the comparison, the dossier | the chosen concept | the user picks one, asks for more (a new research round of up to 3 concepts, started only by the user, D-235), or stops (D-157) |
| D1 | Coordinator | chosen concept, dossier, C1/E1 | `plan.json` endgame stages for the rungs `m`, `b` and `n` (D-281), every slot priced, `skills.main.statSet` (D-273) | — |
| D1 gate | Fresh coordinator | `plan.json`, the record | the final re-price pass, a measure-only compile, its verdict file | compile, V1 and V2; the survival floor (all four resistances capped, chaos only by a recorded exception, D-234; five reference hits, D-254, D-256); the budget (D-219, D-249); the rolled skill (D-217, D-273); else D-141 and D-272 |
| D2 | Coordinator | the D1 plan | the campaign stages and the reward picks in `plan.json` (D-265) | — |
| D2 gate | Fresh coordinator | `plan.json` | a measure-only compile; on a V1/V2 pass the final compile (the PoB file, and the record with `importCode`); its verdict file | compile, V1 and V2 for every stage |
| W1 | Writer agent | plan, final record, ledger, dossier, templates | `guide.md` with the import code, and `audit.md` (D-278) | — |
| V4 | Verifier agents, three lenses in parallel | plan, final record, guide, data files, lookup tools, sources | nothing: each returns its report, which the runner writes (D-267) | one full pass, one fix round, one re-check; findings still open become known issues in the guide (D-268, D-264) |
| Checker | Runner | the run folder | — | its result is shown at checkpoint 2 |
| Checkpoint 2 | Runner, asking the user (offline mode: a pre-supplied answer, A-28) | guide, PoB file, gate verdicts, known issues, the checker's result | — | the user accepts, or asks for changes, which re-run the owning step's chain and the verification, uncounted (D-236, D-268); any other answer ends the run `not-accepted` |

*Target (WU-57, D-287):* the run has three phases, each ending at a gate the user answers.
- **Brainstorm:** the R1a researchers read the pattern library (C-53) and write 2–3 cards each
  (`cards/<id>.md`, C-52); R1a-assemble (a coordinator step) merges duplicates, checks each card's
  identity, deals a card only when a lookup confirms every load-bearing link in game text, and writes
  `cards.md` (6–9 dealt per round); then the **brainstorm gate**: verify 1–3 cards, brainstorm more, or
  stop.
- **Verification:** R1b per picked card, at most 3 per verification round, with the advisory checklist and
  up to 4 one-stage probe variants (D-292), its header's `writes` naming the probes and the card (D-338);
  R1b-assemble; then the **verification gate**, which replaces
  checkpoint 1: finalize one card (a failed one may be picked), verify other cards from the deck, brainstorm
  more, or stop.
- **Finalization:** D1 through the **final gate** (checkpoint 2), as in the table.
- Every route back to checkpoint 1 (D-125, D-141, an escalation's choice 3, FI-3) goes to the verification
  gate. A fixed roll runs the same three phases, every card's skill being the rolled skill.

Each step writes only its own outputs, and parallel agents never write the same file. Engine-changing
calls and every trade call are made only by the one coordinator; lookups (`read`-kind tools) may also be
called by the R1a research agents and the V4 agents (D-130, D-231). No agent calls a poe.ninja tool beyond
the coordinator's `get_currency_rates`: D-335 withdrew the player-evidence tools (C-54).

- **Agent calls** (D-267). At most 3 agents run at once, and a coordinator step never overlaps another
  agent. An agent writes only its task header's `writes` and returns at most 8 lines; a gate step writes its
  own verdict file. The runner reads only the verdict files, its run log, the test config, the returns and
  the reports, never the plan, a record, the dossier or the guide.
- **Roll check.** Before any agent runs, the skill checks that the ascendancy exists and that the main
  skill is an active skill gem. If either check fails it stops, lists the closest valid names, and
  creates no run folder (D-238, D-258). *Target:* it checks the brief's named fields the same way (D-285).
- **Run folder.** The skill's next step is `guide_run {new_run: <slug>}` (C-50); it passes the returned
  absolute path to every step and agent (D-207, D-216). When the reply's `loadedBuildUnsaved` is true,
  the skill asks the user before the run's first compile, which replaces the engine's build (D-210).
- **Retries and revisions.** Retries apply to the R1b compile and the D1 and D2 gates only: 2 counted
  retries each, with D-272's uncounted cases. After that the D1 and D2 gates escalate, with D-236's four
  choices: accept with the failure stated in the guide, give guidance and retry once more, go back to
  checkpoint 1, or stop. Verification never escalates (D-268). User-requested revisions at checkpoint 2
  don't count against the retry cap.
- **Compiles in a run.** Only a run's final compile writes the PoB file into the builds folder (C-17);
  every earlier compile, R1b's skeletons included, uses the measure-only mode (D-208).
- **Offline mode** (D-201; the test mode M-12 runs in). The skill is started in it explicitly, and the run log
  records the mode. In it there is no trade, poe.ninja (`get_currency_rates` included), WebSearch or WebFetch;
  research uses only the server's lookup tools (and the committed C1/E1 files); every price is `unavailable`
  with `note: "offline run"` (D-164), and the plan's `league` is null, the one case C-31 allows (D-233); a
  claim that would need an external source is tagged `external-unavailable` (C-30), which V4 accepts only in
  this mode; a claim copied from C1/E1 cites `data:<file>#<key>`, which V4 checks against the data file
  (D-232). *Target:* `--no-ninja` turns off group `ninja`, whose one tool is `get_currency_rates` (D-333,
  D-335).
- **Pre-supplied checkpoint answers** (A-28). The skill accepts them only in offline mode, uses them in
  place of asking the user, and records each answer in the run log with the `rule` that produced it
  (D-270). Outside offline mode it refuses them and asks the user (D-157). *Target:* the answers are
  `answers.brainstorm`, `answers.verification` and `answers.final` (D-288, D-323).

**C-51 Build brief and invocation** (new; *target*, WU-57; slice 3; D-285, D-286, D-335).
- **Invocation:** `/build-guide <free text> [--offline [--test <path>]] [--no-ninja]`. The runner (the
  user's session following `SKILL.md`) parses the free text into the brief before any run folder exists, so
  its named fields are checked before any agent runs, and the brainstorm gate echoes it at its top.
  Amendment 3 says "the coordinator parses" without naming the coordinator agent; the runner reading is
  PROPOSED by the coordinator, 2026-10-10. `/build-guide <ascendancy> <skill>` still works.
- **Fields, all optional:** `ascendancy`; `skill`; `playstyle` (tags from the vocabulary below, plus free
  text); `budget` (`budget`, `non-budget`, or a figure in divines); `around` (an item or mechanic to build
  around); `like` (a reference build and what to change); `notes`; and, by D-335, `popularity`: the user's
  own notes on what players run, which cards cite as user-supplied (no tool supplies player evidence). A
  randomizer roll is `{ascendancy, skill}`; an empty brief means "surprise me".
- **Playstyle vocabulary** (cards use the same tags): delivery `melee`, `ranged-attack`, `spell`, `minion`,
  `totem-trap`, `mixed`; buttons `one-button`, `few-buttons`, `combo`; focus `clear`, `boss`, `balanced`;
  defence `tanky`, `balanced`, `glass`; pace `fast`, `steady`.
- **Checks:** named fields are checked as D-238 checks a roll; a failure stops before any run folder
  exists.
- **Slug:** from the brief (C-34).
- **`--no-ninja`:** the run calls no tool in group `ninja`, whose one tool is `get_currency_rates`, so
  price totals in divines are `unverified` (pricing's path when rates are missing) (D-297, D-333, D-335).
  Cards say "no player evidence" in every run unless the brief carries `popularity` (D-335).

**C-52 Candidate cards and the deck** (new; the template built by WU-56, the cards *target*, WU-57; slice 3;
D-286, D-287, D-291, D-292, D-319, D-331, D-335, D-338).
- **Identity:** `{className, ascendancy, skill}`, `skill` being the named damage source (D-295). It is
  checked at deck assembly (`get_classes`, then a gem lookup showing `Kind: active`, or for a non-skill source a
  lookup by its kind, D-334), and it is the card's
  skeleton `roll`.
- **Files:** `cards/<id>.md`, id `r<round>-<researcher letter>-<n>` (`r1-a-2`); the runner letters the
  researchers when it starts them, so parallel researchers never collide. Each card follows
  `templates/card-template.md`:
  - the brainstorm half (R1a; about 250–400 words): identity, pitch, chain, enabler, a links table (each
    link's confirming game text and lookup, how PoB follows it, hidden clauses as theory), evidence (the
    brief's `popularity` notes, cited as user-supplied, or "no player evidence", D-335), risks;
  - the verification half (R1b): verified defences (life, energy shield, resistances, max hit, effective
    HP) and modelled DPS; estimates (each Count and custom modifier with its reason, every figure computed
    with a custom modifier, clear and boss figures separate); checklist results; a fallback ladder;
    key-item prices.
- **Status words:** confirmed in game text; modelled in PoB; estimate (with the reason); players use it
  (the user's notes, D-335); not checked yet; needs in-game testing. The merged template
  (`templates/card-template.md`) still says "players use it (poe.ninja)" and draws its Evidence fields from
  poe.ninja; WU-57 brings it, and AC-W27's test, to D-335.
- **The deck:** `cards.md` (R1a-assemble) holds one line per dealt card, plus "Not dealt", which names each
  held-back card's unconfirmed link. A later round adds only new cards.
- **Probe variants:** `probes/<card-id>/<n>/` (D-331). R1b writes them and the card's results, so its
  header's `writes` name them (D-338).
- **Non-skill damage sources:** a card whose damage source isn't a skill (a flask nova) can be dealt and
  verified, and is marked "can't be finalized yet"; finalizing it is deferred (D-303, HG-21). Its identity's
  `skill` names the damage source and is checked by a lookup of its kind, and verification runs only the
  checklist's read-only checks, with no skeleton or probe compile (D-334).

**C-53 Pattern library** (new; built by WU-56, merge `228bec1`; slice 3; D-290, D-325).
- **File:** `.claude/skills/build-guide/references/patterns.md`, opening with the brainstorm questions. v1
  holds 60 entries in ten families, 5,642 words at the merge. `SKILL.md` lists it from WU-57; until then
  the static test's `AWAITING_SKILL_WIRING` entry exempts it from AC-W1's listing rule, an exemption that
  expires once WU-57's `references/stages/R1a-assemble.md` exists.
- **Each entry:** a name and shape (one general sentence true of any skill); a search step; how PoB follows
  it (modelled, Count, custom modifier, config stand-in, hand calculation or not modelled, citing PG ids);
  one to three examples; cautions.
- **Rules:** shapes only, each use re-checked against current game data; at most 6,000 words, counted by
  AC-W28's static test (D-325); every researcher reads it first.
- **Maintenance:** the coordinator proposes entries after each user-supplied study, and the user approves
  them.

**New and modified tools.** Every new tool is group `core` (the poe.ninja tools of C-54 were withdrawn,
D-335); modified tools keep their groups. Inputs and outputs are at the level the seams need;
slice 1 or 2 carries argument types, wording and samples.

| ID | Tool | Status | Kind | Input | Output and compatibility |
|---|---|---|---|---|---|
| C-37 | `lookup_game_data` | new | read | `mode` (`gem`, `unique` or `mechanic`), `query`, mode filters (gem level and quality; unique slot), `max_results` (default 20, cap 30, D-225) | **gem:** PoB's tier (D-258); description; stat sets ("skill parts") with tooltip lines from PoB's stat describer; quality effects; weapon requirement; the level requirement per gem level and the attribute requirements (D-228); for supports, what they can and can't support. **unique:** matches by name, mod text or slot, each as item text ready for `add_item`. **mechanic:** keyword hits across gems, uniques, passives (ascendancy included) and mods, each with its kind and matching line. **No match (D-258):** "nothing matched", then the closest names of the kind searched, by edit distance to the query, then by name: in gem mode up to 5 active gems, then up to 3 supports (D-258a); otherwise up to 5; none for a query over 100 characters (slice 01 §2.2). **Unique mode, more than one unique** (D-239): compact entries (name, type, base, at most 5 matched lines, then `(and <n> more matching lines)`); the full text only for a single result. **Mechanic mode** takes an optional `kind` and its header counts each kind's hits (D-240). **Stat sets** show `Attack Damage: <n>% of base` and `Critical Hit Chance: <n.nn>%` (D-241). **Mod base types and essences** (WU-60, D-277; built): a mod hit is followed by `  Base types: …`, the bases whose spawn weight for it is non-zero, weighed only on the tables PoB rolls on a base (the item's own affix table, `Corruption`, and `Desecrated` mods with a desecrated tag); a mod of any other table gets `none (<the notRolled reason>)`. Essences are a fifth hit kind, `essence`, `[essence] <essence> (<item types>; <affix type>): <line>`, matched by its line or by the essence's name. *Target:* D-299's additions (WU-53) |
| C-38 | `check_model_coverage` | new | read | one or more of `item_text`, `nodes` (ids or names), `gems`; or `build: true` for the loaded build | Per line, one status: fully parsed, partly parsed (with the remainder), unparsed, parsed to nothing (an empty mod list), possibly unread (a heuristic: spike S-b's by-name scan, D-226). A line is re-parsed alone, then with PoB's two-line join, before it is called unparsed (pin §B3). Per gem: skill stats possibly unmodelled (PoB's own red-tooltip rule, pin §B4), marked "check config" (D-123). Build mode also checks jewels in allocated tree sockets (D-242). The name scan also collects PoB's concatenation templates, so names PoB builds by `..` count as read (D-243). **Flags** (WU-54, D-300, D-336; built): a `flags[]` list beside the statuses, each `{flag, source, note, line?}`, changing no status and no count, listed in every mode: `mapped but unread`, `stat not mapped` (one per gem), `energy not modelled`, `level from support`, `granted skill undefined` and `support colour tie` (slice 01 §2.4) |
| C-39 | `manage_sets` | new | mutate | `set_type` (`item`, `skill`, `config`, `loadout`); `action` (`list`, `create`, `copy`, `rename`, `select`; loadouts list and select only); `id`, `title`; `use_second_weapon_set` for item sets | The sets of that type with ids, titles and the active one; for skill sets, the group at the build-wide main index; loadouts as `SyncLoadouts` lists them. Never calls `CopyLoadout`. A title's `{id}` list must match `[A-Za-z0-9,]` with no spaces. No delete (new ids are `#sets+1`, pin §C). A title holds at most one `{…}` tag, at its end, of non-empty ids; an untitled copy drops the tag (D-245). `list` runs as kind `read` (D-244) |
| C-40 | `set_tree_state` | new | mutate | On the active spec: `weapon_set_nodes` (allocated nodes tagged weapon set 1 or 2), `attribute_choices` (attribute node → strength, dexterity or intelligence) | The spec's tags and choices after the change, and the resulting attributes |
| C-41 | `compile_plan` | new | load (D-191) | `plan_path` (relative to the guides root); `build_name` (target in the builds folder, D-199; not used with `measure_only`); `stages` (optional subset, measure-only mode only, D-156; its semantics follow WU-30); `measure_only` (optional, D-208). Two modes, measure-only and final: run-folder creation and validation are `guide_run`'s (C-50, D-216) | Text summary: per stage the loadout, level, V1/V2 verdicts and ledger values, plus the paths written; the record itself is the file (C-33). The PoB file is saved in auto-level mode at the highest stage's level (D-138, D-149). The first stage reuses the new build's tree spec 1 and set 1 of each type, retitled, so the file holds one loadout per stage and nothing titled `Default` (D-215). The call replaces the engine's loaded build (D-191, D-210). It sends one engine request per stage plus a fixed overhead of five (D-221). **Measure-only mode:** compiles and measures in the engine as usual, then writes the compile record and the compiled XML beside the plan only; nothing goes to the builds folder or the write ledger. **Final mode:** an existing target is overwritten only under the write ledger's rule (D-211). **Errors** (`isError`): schema errors by JSON path (D-163); per-stage compile errors (unknown gem, item text that doesn't parse, unknown node, a node PoB's weapon-set connectivity rule leaves unconnected, broken weapon-set or attribute choice, an allocation PoB changed on import, D-213) with no PoB file written (D-162); an existing target with no write-ledger entry from this run (C-17's "already exists" wording), or one whose sha1 changed since this run's entry (C-17's changed-on-disk wording; D-211); a guides root overlapping the builds folder (D-220). Also (WU-55, D-293) a `compile_check` defect, a custom-modifier line PoB can't parse whole. **As built:** socket groups outside the named source are created with `includeInFullDPS` off (D-306, narrowed by D-337); off-hands are checked per stage, any dropped item is an error, and `loadoutWarnings` are recorded (D-310); config options PoB's save drops are restored in the written file (D-248); the text prints every V1/V2 finding up to 200 over all stages, then points to the record (D-273). `customMods` are written after the config options (WU-55, D-293, D-337; built), in a write of their own; every compile, measure-only included, creates the named source's groups (each stage's `rolledGroup`) with `includeInFullDPS` on and `groupCount` set to their `count`, so PoB computes Full DPS for them; every other group stays out (D-306, narrowed). S-N2 (WU-51) measured this at ×1.14 of the whole call |
| C-42 | `encode_build_code` | new | none | `build_name` (a builds-folder file, resolved as other build-file tools do, D-52) | The PoB2 import code: the inverse of `decodePobCode` (`buildCode.ts:71-105`). Decoding it reproduces the file's sets, loadouts, level mode and stage count (D-180) |
| C-43 | `search_tree_nodes` | modified | read | adds `ascendancy` (a name); `query` becomes optional when `ascendancy` is given | Every node of that ascendancy, notables included. `node_type:'any'` matches every type; results are sorted before the cap (D-175). **Compat:** callers now get correct results where they got none or an arbitrary subset |
| C-44 | `set_main_skill` | modified | mutate | documents `skill_part` (the 1-based stat set of the main active skill) | Selects PoB2's stat set, `srcInstance.statSet[grantedEffectId] = i` (pin `Modules/Build.lua:375-381`), which the build XML keeps (D-195). **Compat:** the undocumented argument used to write PoE1's `skillPart` |
| C-45 | `lua_get_stats` | modified | read | adds a per-skill breakdown option | Per active skill and per stat set: the `category:'offense'` fields, measured with that skill and part as main, then the exact prior state restored (D-176). Default and category views are unchanged. The tool is on C-1's 5000-char truncation list, so slice 1 bounds the breakdown |
| C-46 | `add_item` | modified | mutate | `slot_name` gains the tree-jewel socket slots | The jewel is socketed on the active spec (`<Sockets>`). **Compat:** additive enum |
| C-47 | `suggest_supports`, `get_passive_upgrades` | modified (amends D-77, D-78) | read | `get_passive_upgrades` adds `include_ascendancy` (default false, D-197) | Both add a list of what PoB can't measure beside the ranking: candidates whose measurement is null, and candidates with lines C-38 doesn't rate fully parsed. Ranking, `count` and AC-E39's order are unchanged. Included ascendancy notables are the build's own, priced in ascendancy points; those beyond the build's remaining ascendancy points (counted as `CountAllocNodes` counts them, D-307) are marked, not hidden (D-227). Multiple-choice notables are listed can't-measure with their options, each reason labelled `not applied`, `advisory`, `choice` or `no value` (D-247); `get_passive_upgrades` bounds its own output so no can't-measure line is cut (D-246). **Compat:** an added output section; defaults otherwise unchanged |
| C-48 | `update_tree_delta` | existing (defect fixed) | mutate | unchanged | Does what its description says: auto-paths added nodes along PoB's own path and enforces the 8-point ascendancy cap, returning the fields the TS side already reads (D-194). Points are counted as PoB's `CountAllocNodes` counts them (D-307). An add that would change an allocated node's weapon-set tag is refused after a dry run, with the build unchanged (D-308). **Compat:** calls that relied on no auto-path now get connected trees |
| C-49 | `get_item_price`, `search_trade_items`; `get_leagues` (error prefix only) | modified (D-202, D-218) | none | unchanged; no batch mode: each call prices one item, and the rate limiter paces within its existing windows (C-11, D-160, D-224) | T1: every price result states its date and league (`get_item_price` names the league but gives no date today, recon §1). Every error that a `TradeError` (C-10) causes in these three tools reads `Error: [trade:<kind>] Failed to <action>: <message>`, where `<kind>` is the error's `TradeErrorKind` unchanged (`src/trade/errors.ts`: `would_wait`, `locked_out`, `rate_limited` for a 429 from the trade site, `http`, `no_session`, …); the pipeline classifies pricing outcomes by it (D-218). Other errors get no prefix, and `find_upgrades` keeps C-14's own wording. Nothing is cached (D-46); prices are kept in the plan (D-169). **Compat:** added output fields and an error prefix; group `trade`, unchanged; defaults otherwise unchanged |
| C-50 | `guide_run` | new (D-216) | read; a call carrying `new_run` is routed as `none` | exactly one of `new_run` (a slug, D-207) and `validate` (a `plan_path` relative to the guides root), plus optional `stages` with `validate` | **Run-folder mode** (`new_run`): creates `<root>/<slug>/<YYYY-MM-DD>-<n>/` with the next free `<n>` and returns its absolute path, its root-relative path `<slug>/<YYYY-MM-DD>-<n>` (the run's `plan_path` is that plus `/plan.json`), and `loadedBuildUnsaved`: whether the engine's loaded build has unsaved changes that the next compile would discard (D-210). It reads no plan, takes no session lock and never starts the engine. **Validate mode:** the schema check (D-163) and `compile_check`, the compiler's read-only preflight (D-213, D-221), so unknown gems, nodes, item bases and config options are found without compiling, and unknown producers are listed (D-167); the export and `revision` are unchanged. **Errors** (`isError`): a slug that isn't one safe path segment, or a guides root overlapping the builds folder (D-220), with nothing created; schema errors by JSON path; preflight defects per stage. **Kind:** the router's `engineKindFor` routes every call but a validate call without `new_run` as `none` (D-244). **Compat:** new tool, group `core` |
| C-54 | *Withdrawn → D-335:* poe.ninja tools for popularity and the build index | withdrawn | — | — | poe.ninja's terms close its builds, profiles and character API to third-party use (spike WU-50), and every use C-54 named (popularity, the build index, peers) came from it. No tool is added; group `ninja` keeps only `get_currency_rates` (C-12), and the counts stay 84 and 83 |

## 4. Data and state model (deltas)

| Entity | System of record | Lifetime | Written by | Concurrency rule |
|---|---|---|---|---|
| Guides root and run folders | `POB_GUIDES_DIRECTORY` (C-34) | durable, the user's | `guide_run` (creates each run folder, D-207, D-216); `compile_plan` (records, and measure-only XML, beside the plan); skill and agents (plan, dossier, guide, run log) | one run per folder; one coordinator calls compile; parallel agents write disjoint files |
| `plan.json` | run folder | durable | agents' file tools (D-155) | edited only by the coordinator's current step, never during a compile |
| `compile-record.json` | run folder | replaced by each compile of its plan (D-153) | `compile_plan` | under the engine lock; informational only, never an overwrite permission (D-211) |
| Compiled PoB file | builds folder, through C-17 | durable | `compile_plan`, only in a run's final compile (D-208) | the write ledger's overwrite rule (D-211), then C-17's guard |
| Write ledger `guide-writes.json` | state dir (C-16) | durable | `compile_plan`, final mode only, right after the PoB file (D-211) | under the engine lock; temp file then rename; one entry per builds-relative path; no agent can write it (D-177) |
| C1 and E1 data files | repo `data/` | versioned with the repo | WU-39 | read-only at runtime |
| Engine build after a compile | engine and C-3's `loaded` record | until the next load | `compile_plan` (kind `load`), which replaces the user's loaded build; `guide_run`'s run-folder reply says whether that build has unsaved changes (D-210) | under the mutex; revision and snapshot per C-3 |
| Prices | `plan.json` `prices[]` | per run | coordinator | no server cache (D-46, D-169) |
| Run log `run-log.json` | run folder | durable | the runner only (D-267) | rewritten whole after every step; schema version 2 (D-270), *target* 3 (D-289); the checker accepts both (D-326) |
| `audit.md` | run folder | durable | W1; the runner fills its Known issues table (D-278) | written after the guide, never in parallel with it |
| Cards and the deck (*target*) | run folder: `cards/<id>.md`, `cards.md` | durable | R1a (brainstorm half), R1b (verification half), R1a-assemble (`cards.md`) (D-287, D-291) | ids `r<round>-<researcher letter>-<n>`, so parallel researchers write disjoint files (D-319) |
| Probe variants (*target*) | run folder: `probes/<card-id>/<n>/` | durable | R1b (the plan); `compile_plan` (its measure-only record and XML) (D-331, D-338) | one card at a time, so no two steps write one probe |
| Pattern library `references/patterns.md` | repo, in the skill | versioned with the repo | the coordinator proposes entries, the user approves them (D-290) | read-only at runtime |
| poe.ninja cache | *Withdrawn → D-335:* no poe.ninja tool is added, so there is no cache beyond C-12's currency rates | — | — | — |

**Migration:** none. Everything is new; the guides root is created by the first run, and the write
ledger by the first final compile.

## 5. Decision log

**Numbering.** D-1nn lifts design row nn (D-101…D-149). D-151…D-185 lift gap items 1–35 (D-150 + n).
D-190…D-208 are this spine's own. D-210…D-221 are the adversarial review's fixes (review Sn), and
D-222…D-238 the coordinator's resolutions of the slice writers' open items, both 2026-10-07.
D-239…D-266 are the coordinator's and the user's decisions during the build, with their final wording
(work-log). D-267…D-275 lift amendment 1's items, D-276…D-284 amendment 2's, D-285…D-304 amendment 3's
(each row names its source). D-305…D-314 lift the work-log's unnumbered coordinator decisions.
D-315…D-334 resolve the fold's open points (2026-10-10). D-335…D-338 are the decisions of the amendments'
build, waves A and B (2026-10-10 and 2026-10-11), folded in v1.4. **Status:** *settled* = a ratified design
row or a user decision; *accepted* = a gap item the user accepted on 2026-10-07; *deferred* = a named gate
(HG-15, HG-19…HG-22); **PROPOSED** = this spine's, overridable at ratification; *review fix* and
*resolution* = binding, overridable at ratification; **PROPOSED, pending the user** = a question put to
the user, proceeded on until answered; **PROPOSED by the coordinator, 2026-10-10** (or **2026-10-11**) =
binding until the user overrides it. Each row also says *built*, or **target** (approved, not built, with
its work units), or *superseded by D-n* or *withdrawn → D-n* (kept so the id stays readable). Proceed on
all of them; don't relitigate. Rationale
for lifted rows is in the source row or the amendment.

| ID | Decision | Status; divergence |
|---|---|---|
| D-100 | The inputs listed at the top are the only sources of requirements. The gaps' milestones M-3 and M-4 are M-12 and M-13 here (D-206) | — |
| D-101 | Output: a written guide plus a PoB2 build that someone who has never seen the build can follow | settled; amended by D-285 (target: its input is a brief) |
| D-102 | Shape: a staged pipeline around a build plan file | settled (user) |
| D-103 | Each guide stage is a PoB2 loadout; shared sets use `{id}` lists such as `Early Game {1,2}`. Braces hold only `[A-Za-z0-9,]`, no spaces; the loadout's name comes from its tree set; never `CopyLoadout` on `{id}` names (it crashes) | settled; spike S-a |
| D-104 | Endgame is designed first; the campaign is planned backward from it | settled |
| D-105 | Every claim shows its source: PoB-computed, PoB game data, external (linked), or judgment (C-30) | settled; **amended by D-276** (target: the guide renders the plan without markers) |
| D-106 | PoB numbers only where PoB models the mechanic; otherwise a hand calculation with stated assumptions (the ledger) | settled; amended by D-296 (target) |
| D-107 | Each guide names its engine data version (pin and targeted game patch) and, separately, the patch of its prices and boss data. The first guide: 0.5.4 engine data, 0.5.5 prices and boss resistances | settled |
| D-108 | Each campaign preset is valid at its level: points, gem and item level requirements, attributes, PoB warnings (V1) | settled |
| D-109 | The player is in a trade league. Buyable uniques are allowed in campaign presets, hard-to-get drops are not; availability is judged from dated listings; rares are affix targets | settled |
| D-110 | The leveling skill may differ from the main skill; a conventional leveling build carries until the main skill's level requirement | settled |
| D-111 | Budget ceilings are real prices, checked on the trade site at generation and dated | settled |
| D-112 | Trade and poe.ninja only through the server, from one coordinator, within a per-guide search budget (paced, D-133). Web research is allowed (D-171) | settled; **amended by D-297, as D-335 restates it**: poe.ninja only through the server's `get_currency_rates`, from the coordinator; no researcher calls poe.ninja |
| D-113 | The plan is the source of truth. The compiler builds the PoB file and a compile record from it; the guide's numbers come from the record, the ledger, dated prices and E1. The PoB file is a new file, never written over an existing one | settled |
| D-114 | Two config classes: earned player state names its producer and the guide explains uptime; scenario inputs name their E1 or C1 source. The compiler writes every relevant value; a default audit flags unjustified default-on values (C-32) | settled |
| D-115 | No encounter input; "as strong as possible" within budget, which applies to the non-budget variant (D-147) | settled |
| D-116 | Budget variant: about 20 divines or less; target T15 maps (area 79) without dying often. The non-quest Arbiter of Divinity is reported, not gated: max hit against its datamined hits, time-to-kill under E1's stated life assumption | settled; the tolerance of "about 20" is D-219; amended by D-249 (tree jewels count), D-281 (target: the entering-maps rung) |
| D-117 | Non-budget variant: about 200 divines as a reference, not a hard cap. Target: T16 (area 80) up to area 82, heavily modded waystones and tablets | settled; amended by D-281 (target) |
| D-118 | Survival floor first (capped resistances at PoB's Endgame −60% setting; max hit taken above the reference hits), then everything else on damage | settled; which resistances are gated is D-234 |
| D-119 | Endgame gate: the survival floor. Reported with confidence: time-to-kill and mapping signals. Every config set states `enemyIsBoss`. Mapping reference hits come from PoB's monster damage table at the area level with waystone damage modifiers | settled; **amended by D-254** |
| D-120 | Guides are mapping builds that can kill the pinnacles with extra effort. One loadout has a one-click clear skill and a single-target setup; when forced, favor mapping | settled |
| D-121 | Clear-speed signals (judgment): movement speed first, then clicks per pack | settled |
| D-122 | The rolled skill is the main source of damage, never a token role | settled; **amended by D-295** (target: the named damage source) |
| D-123 | Combo and buff states come from config where PoB2 covers them, otherwise from hand calculations; research lists the config gaps | settled |
| D-124 | Research proposes 2–3 concepts; the user picks one at checkpoint 1. R1a runs lookup-only agents in parallel; R1b, the coordinator, compiles, measures and prices each | settled; **amended by D-287** (target: 6–9 cards per brainstorm round) |
| D-125 | User checkpoints: the concept pick and the final guide. A concept infeasible in D1 returns to checkpoint 1 with evidence | settled; amended by D-287 (target: back to the verification gate) |
| D-126 | The guide is markdown in a per-guide folder inside a configurable guides folder outside the builds folder, and includes the import code | settled |
| D-127 | First run capped at 3 concepts and 3 verify lenses, measured, then the envelope is set (HG-15). Each stage retries at most twice after a failed check, then escalates | settled (user); **amended by D-268, D-272**: the retry cap and escalation apply to the gates only |
| D-128 | Plan format: a schema validated by P2. Refined to JSON with zod by D-167 | settled |
| D-129 | The pipeline is a skill plus two saved workflows split at checkpoint 1; the skill holds the hand-off | settled; **superseded by D-267** |
| D-130 | Engine concurrency: every step that changes the loaded build or calls trade runs through one coordinator. Lookups take the session lock and only queue. A per-agent inline server is deferred (HG-15) | settled; D-297's amendment (researchers may call the poe.ninja tools) is withdrawn by D-335 |
| D-131 | Campaign data: PoB's `Data/QuestRewards.lua` and `Data/WorldAreas.lua`, plus external sources for interlude levels (dynamic, +8). An uncut skill gem of level N cuts a skill of tier ≤ N. `plan_leveling`'s data is not reused | settled |
| D-132 | Mapping strength is a hand calculation: the clear skill's hit against PoB's monster life at the area level (area 79: 24,852), times waystone life modifiers and rarity and variety multipliers. For areas 80–82 it is a stated judgment | settled; see A-27 |
| D-133 | Pricing is paced, not capped, in priority order: concept key items, each variant's full slot list (rares as affix-target searches), then campaign uniques. Each price is dated and names its league. Its "cached within a run" is replaced by D-169 | settled |
| D-134 | No checkpoint after D1; revisit if the first run shows endgame mistakes leaking into the campaign plan (HG-15) | settled (user) |
| D-135 | Guides folder: an env var with a default outside the builds folder (D-154) | settled (user) |
| D-136 | Marketplace plugin packaging | deferred (HG-15) |
| D-137 | Unique-jewel trade rows | deferred (HG-15) |
| D-138 | Character level is build-wide. The file's level is the highest stage's level, saved in auto mode (D-149). Compile measures each stage at its own level. Loadout names carry the level, e.g. `Act 2 (L25) {2}`. V1 takes each stage's level from the plan | settled (user) |
| D-139 | 1.0 ships 2026-12-11. After a pin upgrade a guide is regenerated by re-running compile and checks on its plan. Patch notes are read from mirrors; fetching from pathofexile.com needs the user's approval | settled (user) |
| D-140 | Upgrading the pin to 0.5.5 data waits for the next PoB2 release | deferred (HG-11, HG-15) |
| D-141 | Failure paths: no viable concept → checkpoint 1 shows the best attempts and why each fails. Concept infeasible in D1 (floor unmet, over budget, or the rolled skill not the main damage source) → back to checkpoint 1 with evidence. Failed check → the stage re-runs with the findings, at most twice, then escalates | settled; **amended by D-268** (verification: one fix round, then known issues), D-287 (target: back to the verification gate) |
| D-142 | Claims are verified for truth by V4, an agent that didn't write the plan | settled |
| D-143 | Ranker amendments (C-47): both rankers list what PoB can't measure; `get_passive_upgrades` can include ascendancy notables | settled; **amends D-77, D-78** (their result shape) because unmeasurable candidates fall off or are excluded today; AC-E39's ordering is kept |
| D-144 | Tree continuity: each stage's tree contains the previous one's, except at named respec points, which the guide lists with their gold cost | settled; amended by D-282 (target: one endgame track) |
| D-145 | The compiler produces the PoB2 import code, and the guide includes it | settled |
| D-146 | Each endgame variant states its character level, gem levels and ascendancy points | open in the design; decided by D-193 |
| D-147 | Budget objective: reach T15 as cheaply as possible, never above about 20 divines. Non-budget: as strong as possible around 200 | settled (user); amended by D-249, D-281 (target) |
| D-148 | The rolled skill should be the clear skill; the single-target role only when it can't clear, and the guide says so | settled (user); **amended by D-295** (target) |
| D-149 | The PoB file is saved in auto-level mode; the compiler still measures at the plan's levels | settled (user) |
| D-151 | The alpha exit is M-13 (§7) | accepted |
| D-152 | The skill and workflows live in project scope: `.claude/skills/build-guide/` and `.claude/workflows/` | accepted; **amended by D-267**: `.claude/workflows/` dropped |
| D-153 | Each run writes a new dated folder `<guides>/<slug>/<YYYY-MM-DD>-<n>/` and never overwrites an earlier run; re-compiling within a run overwrites that run's outputs | accepted |
| D-154 | Guides root default: `Guides` beside the builds folder; override `POB_GUIDES_DIRECTORY`; Jest redirects it to a temp dir | **HUMAN** (user, 2026-10-07) |
| D-155 | Agents write `plan.json` with their file tools; `compile_plan` reads it only from inside the guides folder (no traversal, no symlinks out); it writes the PoB file through `buildFileWriter` and the compile record and import code into the run folder | accepted |
| D-156 | One `compile_plan` call holds the session lock and sends one engine request per stage, each under its 30 s timeout; `stages` compiles a subset. WU-30 measures first | accepted; **amended by D-221** (plus a fixed overhead of five requests) and D-229 (the 20 s margin) |
| D-157 | Checkpoint 1: the skill shows the concepts as a short comparison (synergy, numbers, key prices, risks, what PoB can't verify) and asks with AskUserQuestion: pick one, ask for more, or stop | accepted; amended by D-287 (target: the verification gate) |
| D-158 | Each run writes `run-log.json`: stage times, agent counts, retries, price searches used | accepted; **replaced by D-270**, which D-289 amends (target) |
| D-159 | A 15-stage plan compiles in ≤ 100 s on this machine; WU-30 sets the real figure; a miss is HG-13 | accepted; refined by D-229 (WU-30's pass mark); S-N2 (WU-51) measured Full DPS on the named groups within it (at most 31.92 s for 15 stages), so every compile computes it (D-337) |
| D-160 | Pricing stays inside every rate-limit window the server tracks and never triggers a 429; measured, not capped | accepted |
| D-161 | The first run uses at most 3 concepts and 3 verify lenses; the run log records actuals | accepted; the concept cap is per research round (D-235); amended by D-270 (actuals read from `stages[]` and the transcript), D-287 (target: per brainstorm and per verification round) |
| D-162 | Compiling is all-or-nothing per call: an error in any stage writes no PoB file and is returned per stage | accepted |
| D-163 | Schema errors return their JSON path and nothing compiles | accepted |
| D-164 | Trade unavailable (no cookie, rate-limited, down, or disabled): those prices are `unavailable`; the guide can't claim the variant is under budget; checkpoint 2 says so | accepted |
| D-165 | An engine crash mid-compile runs the session's recovery (C-3) and fails the call; compiling is idempotent | accepted; **citation corrected:** gap 15 cites C-5, which is the reply schemas; session recovery is C-3. The compile's `new_build` has dropped the snapshot, so recovery takes C-3's no-snapshot path (review S2, §3.1 C-3) |
| D-166 | Failures follow D-141 | accepted; amended by D-268 |
| D-167 | The plan is JSON with `schemaVersion`, validated by zod (already a dependency); agents get a committed reference and worked example; a validate-only mode checks a plan without compiling it (gap item: a `compile_plan` mode; now `guide_run`'s validate mode, D-216) | accepted; refines D-128's "YAML or JSON with a JSON Schema". **Amended by D-216:** the validate mode is `guide_run`'s |
| D-168 | C1 and E1 are sourced JSON data files under `data/campaign/` and `data/enemies/`, each value with citation and patch; loaded by the compiler and checks, read by agents, copied per guide into the plan; kept out of `src/` strings | accepted; **diverges from D-3/D-30** ("no constants of our own in advice"): these are cited game facts tied to a patch, not invented advice thresholds; D-203 scopes it |
| D-169 | Prices are recorded in the plan with date, league and query; re-runs within a run reuse them; the server keeps no price cache | accepted; keeps **D-46**; replaces D-133's "cached within a run" |
| D-170 | The compile record keys per-stage outputs by name; ledger formulas reference those names; a small safe evaluator, no `eval`, no dependency | accepted |
| D-171 | Web research uses WebSearch/WebFetch on poe2db.tw, maxroll.gg, game8, poe-vault and patch-note mirrors; never pathofexile.com or poe.ninja; poe2wiki.net and mobalytics refuse agents | accepted; runtime only (D-201) |
| D-172 | Without the Workflow tool, the skill runs the same stages with the Agent tool: same artifacts, fan-out ≤ 3 | accepted; **superseded by D-267**: the Agent tool is the only path |
| D-173 | Extend existing tools where natural (C-43…C-46); group new ones (C-37…C-42); at most 8 new tools, total under 86 | accepted; **resolves stab HG-3** for exactly these tools. D-216 adds a seventh, `guide_run` (C-50), inside the cap; **amended by D-316**: no numeric cap; the principle stays |
| D-174 | Contract deltas: D-77/D-78 per D-143; C-1's stale 76 corrected; the literal 77 moves to the new total at every count site (§1.3) | accepted |
| D-175 | Existing defects fixed in slice 1: `update_tree_delta` (D-194); the `set_main_selection` Lua action behind `set_main_skill` writes `skillPart` (D-195); the two `search_tree_nodes` bugs (C-43); D-65's stale text (D-198) | accepted |
| D-176 | A `read` tool leaves the exported build and `revision` unchanged, so lookups and measurements of a non-main skill part restore the exact prior state, and a test proves it | accepted |
| D-177 | The server writes only to the builds folder (via `buildFileWriter`), the state dir and the guides folder; the guides folder joins the allowed roots with the same no-traversal, no-symlink rules; agents write only into the current run folder | accepted; **extends D-42/D-88**, which confine path arguments to the builds folder and state dir, because plans and records must live outside both (D-126, D-18) |
| D-178 | Secrets and identity rules unchanged: never read `.env`, no identity in requests, trade only through the server. Research agents get no trade tools; only the coordinator prices | accepted; D-297's amendment (researchers get the poe.ninja tools) is withdrawn by D-335 |
| D-179 | V4 re-derives every ledger entry, opens the source of every `external` claim, and re-checks PoB-data claims with the lookup tools: all of them in endgame sections, at least 1 in 5 elsewhere. The guide passes only with no unresolved finding | accepted; **amended by D-268** (no sampling; open findings become known issues), D-279 and D-296 (target) |
| D-180 | `encode_build_code` output decodes to XML whose sets, loadouts, level mode and stage count match the compiled file | accepted |
| D-181 | No live requests during the build: tests and agents stay offline (D-34). M-12's run has trade and poe.ninja disabled; prices show `unavailable` | accepted; **amended by D-297, as D-335 restates it**: development agents may make polite requests to poe.ninja's documented economy endpoints only; tests stay offline |
| D-182 | The live alpha run needs the user's approval, asked at the start of M-13 | accepted; HG-14; **amended by D-297**: it covers trade only, since poe.ninja is reached only through its economy endpoints (D-335) |
| D-183 | The build's human gates are §6.3's | accepted |
| D-184 | The risk register is §9's | accepted |
| D-185 | Plugin packaging, the pin upgrade, unique-jewel trade rows and per-agent engines stay named gates | accepted; HG-15 |
| D-190 | Tool names and kinds: `lookup_game_data` (read), `check_model_coverage` (read), `manage_sets` (mutate), `set_tree_state` (mutate), `compile_plan` (load), `encode_build_code` (none), and, by D-216, `guide_run` (read; its `new_run` calls routed as none). The grouping is gap 23's; the names and argument names are the formalizer's | PROPOSED; amended by D-244 (`manage_sets` list runs as `read`) |
| D-191 | `compile_plan` is kind `load`: S-a's verified recipe starts with `new_build`, which replaces the engine's build (C-8). As with `import_build`, the compiled build stays loaded and its file is recorded by `noteSaved` (C-17), so agents can read it with the existing read tools. Rejected: `withTemporaryBuild` (kind `read`), which would hide the compiled build | PROPOSED |
| D-192 | V1 and V2 run inside `compile_plan` after each stage is measured, and their verdicts go into the record. A failed check is a finding, not a compile error: the call succeeds and D-141 applies. V1 also checks tree continuity (D-144). Basis: the quality bar's "passed the validity check at its level when compiled", and D-114 puts the default audit in the compiler. Rejected: separate check tools (they need each stage's compiled state, and would spend gap 23's spare slots under D-173's cap (cap lifted, D-316)) | PROPOSED |
| D-193 | Row 46: the plan schema requires `level`, per-gem levels and `ascendancyPoints` on every endgame variant stage (C-31). The D1 agent chooses them per variant and records a source (a C-30 tag) or a rationale (a `judgment` tag). The spec fixes no numbers. V1 checks requirements against them | PROPOSED |
| D-194 | `update_tree_delta` is fixed to its description (auto-path along PoB's path, as `search_nodes` exposes it; the 8-point ascendancy cap), since the TS side already reads the reply fields. Rejected: rewriting the description, a contract change (HG-12) | PROPOSED; amended by D-307, D-308 |
| D-195 | `skill_part` is documented in `set_main_skill`'s schema and selects PoB2's stat set through `set_main_selection`, replacing the `skillPart` write | PROPOSED |
| D-196 | Auto-level mode is bridge-only: `set_level` gains an optional auto flag used by `compile_plan`. `set_character_level` isn't among gap 23's extended tools, so exposing it is HG-12 | PROPOSED |
| D-197 | `get_passive_upgrades` includes ascendancy notables only with `include_ascendancy: true`: the build's own ascendancy, priced in ascendancy points. The default keeps D-77's output, whose exclusion fixed unallocatable notables priced in passive points | PROPOSED; refined by D-227; points counted per D-307 |
| D-198 | D-65's text is corrected: crash recovery restores with `keepLevel: true` (`src/engine/session.ts:555-558`), so an auto-mode level (D-149) survives a restore. The coordinator applies this and C-1's count to the stab spine's text at ratification; no work unit does | PROPOSED |
| D-199 | `compile_plan` writes to `build_name` in the builds folder. An existing file is refused unless this run wrote it and nobody changed it since, which the server's write ledger decides (a re-compile within the run, D-153, D-211); C-17's changed-on-disk guard still applies. This keeps D-113's "never over an existing file" | PROPOSED; **amended by D-211:** the exemption first came from a compile record in the run folder; it now comes from the write ledger, never from the record |
| D-200 | Run-folder names: `plan.json`, `compile-record.json` (gap 5), `run-log.json` (gap 8), `guide.md` (design), and `dossier.md` (the formalizer's name for the research dossier). Compile outputs go beside the compiled plan, so concept skeletons in sub-folders get their own records | PROPOSED |
| D-201 | M-12 runs fully offline, in the pipeline's offline mode (C-36): no trade, no poe.ninja, no WebSearch, no WebFetch. Research uses only the server's lookup tools (and the committed C1/E1 files); a claim that would need an external source is tagged "external source unavailable (offline run)" (`external-unavailable`, C-30), and V4 accepts that tag only in offline mode. Web research on D-171's hosts happens only in M-13, under the user's approval (HG-14). This keeps the build's host rule (GitHub and the npm registry only). Replaces the former HG-17 | PROPOSED; **amended by D-297, as D-335 restates it**: the build's host rule gains poe.ninja's documented economy endpoints at a polite rate; offline mode still turns poe.ninja off |
| D-202 | T1 (dated pricing) belongs to slice 1 (WU-49, C-49): the price-check outputs add the date and league (`get_item_price` gives no date today), plus any batch-pricing mode the pipeline needs, all within the rate limiter's existing windows (C-11, D-160). There is no server cache (D-46 stays); prices are recorded in the plan (D-169, gap 19). The pricing procedure (D-133 priority, D-160 pace, D-164 unavailable) stays a shared reference in the skill (WU-43). The ratified slicing names no T1 unit; this places it | PROPOSED; D-224 settles that no batch mode is needed |
| D-203 | D-3 and D-30 stay binding for the advice tools and for the files the advice-threshold scan covers. V1, V2 and the data loaders live outside them (`src/plan/`, `data/`) | PROPOSED |
| D-204 | C1 and E1 values come only from the pinned PoB data and `docs/design/grounding/2026-10-07-external-game-data.md` (accessed 2026-10-07), each with its source, patch and confidence. No web fetch during the build | PROPOSED |
| D-205 | The import code is the compile record's `importCode` field; W1 copies it into `guide.md` | PROPOSED; the record is its one home (D-260) |
| D-206 | Milestones are renumbered M-10…M-13 because the stab spine already uses M-0…M-3 | PROPOSED |
| D-207 | The server owns the run-folder layout. A run-folder mode (`new_run`, a slug), now `guide_run`'s (D-216), creates `<guides>/<slug>/<YYYY-MM-DD>-<n>/` and returns its absolute path; the skill and every agent use that path, so none needs the server's `POB_GUIDES_DIRECTORY` (the MCP registration's env, which agents can't see). Replaces the former HG-16 | PROPOSED; **amended by D-216:** first written as a `compile_plan` mode, to keep the new-tool count at 6, with a new tool rejected; D-216 moved the mode to the new tool `guide_run`, and the total is now 7 |
| D-208 | Concept-skeleton compiles (R1b) write no PoB file to the builds folder. `compile_plan`'s measure-only mode compiles and measures in the engine and writes the compile record and the compiled XML into the run folder only. Only a run's final compile writes into the builds folder, through `buildFileWriter` (C-17, D-199). Replaces A-26 | PROPOSED |
| D-210 | `guide_run`'s run-folder reply includes `loadedBuildUnsaved`: whether the engine's loaded build has unsaved changes (`session.isDirty()`). A compile replaces the loaded build (D-191), so when it's true the skill asks the user before the run's first compile | settled (user, 2026-10-08; review S2) |
| D-211 | **The write ledger.** The server keeps `guide-writes.json` in its state dir (C-16): per builds-relative path, `{path, sha1, runFolder, writtenAt}` from the last final compile that wrote it. No agent can write there (D-177). A final compile may overwrite an existing builds-folder file only when the ledger's entry for that path names the plan's run folder **and** the file's current sha1 equals the entry's, i.e. nobody edited it since. Otherwise it's refused: with C-17's changed-on-disk wording when this run's entry no longer matches the file, and with C-17's "already exists" wording when the ledger has no entry for this run (D-113). Measure-only compiles never touch the ledger or the PoB file. Order: check, write the PoB file through C-17, write the ledger entry, write the record; a failure after the PoB write still leaves the ledger entry, so a retry can overwrite. `compile-record.json` is informational. Basis: C-17's in-memory guard doesn't survive a restart and is refreshed by an auto-reload; the record is agent-editable; a measure-only compile rewrote the record and so blocked the run's final re-compile. **Amends D-199** | review fix (S3) |
| D-212 | **Config placeholders are values.** PoB applies a numeric option's placeholder when it has no input (`BuildModList`, pin `Classes/ConfigTab.lua:883-900`), the enemy level's through `UpdateLevel` (`:870-880`), and `enemyIsBoss` sets the placeholders of the enemy's level, damage, resistances, penetration, armour, evasion, speed and crit (`Modules/ConfigOptions.lua:1964-1997`). So the default audit (C-32) covers placeholder-driven options: each one that affects calcs is either set explicitly per stage from C1/E1 (a scenario input) or listed in `data/config-baseline.json` with a rationale (D-230). The compile record stores each stage's effective values, explicit, default or placeholder, with their class. PoB's Save writes no `<Input>` equal to its placeholder (`ConfigTab.lua:712-714, :741-742`), so the record, not the XML, is authoritative (D-113). Corrects slice 2's A-P4 | review fix (S4); amended by D-248; its baseline rule (D-230) amended by D-250, D-252 |
| D-213 | **Tree connectivity follows PoB's weapon-set rule.** The preflight applies `CanPathThroughAllocMode` (pin `Classes/PassiveSpec.lua:826-830`): an untagged node paths only through untagged nodes; a node tagged weapon set n also through nodes tagged n. `compile_stage` reads back PoB's allocation with its tags, and the compile fails naming any node PoB dropped, added or re-tagged, because PoB prunes unconnected nodes silently | review fix (S5) |
| D-214 | Progress keys (C-31) are `start`, `endgame` or `q.<QuestRewards key>`. WU-38's schema defines the format; WU-39 implements the data and the membership check, and owns the two-stage fixture's keys and `plan-reference.md` alongside | review fix (S6) |
| D-215 | The first stage reuses the new build's tree spec 1 and its item, skill and config set 1, retitled to that stage's titles; later stages create new ones. A compiled file holds exactly one loadout per stage and nothing titled `Default` | review fix (S7) |
| D-216 | **New tool `guide_run` (C-50)** takes `compile_plan`'s former run-folder and validate modes. The run-folder mode makes no engine call and runs outside `session.run`; the validate mode is kind `read`, checks names against the game data with read-only lookups, and mutates nothing. `compile_plan` keeps the measure-only and final modes, kind `load`. New tools: 7; totals 84, and 83 without poe.ninja, inside D-173's cap of 8 (cap lifted, D-316). Basis: as modes of a `load` tool, both started luajit, bumped `revision` and marked the build dirty. **Amends D-207 and D-167** | review fix (S8); its kind rule generalized by D-244 |
| D-217 | Each skill group (C-31) has a `role`: `clear`, `single_target`, `utility` or `leveling`. Each stage that has the rolled skill records the group holding it as `skills.rolledGroup`; the schema requires it on endgame variant stages and checks, wherever it is set, that the group holds the rolled skill. The rolled-skill gate (D-122, D-148) compares within the role | review fix (S9); amended by D-273 (`main.group` is `rolledGroup`), D-295 (target) |
| D-218 | WU-49 prefixes every error a `TradeError` causes in `get_item_price`, `search_trade_items` and `get_leagues` with a stable `[trade:<kind>]`, after `Error: `. `<kind>` is the `TradeErrorKind` unchanged (`src/trade/errors.ts`): `would_wait`, `locked_out`, `rate_limited` (a 429 from the trade site), `http`, `no_session`, …. `find_upgrades` keeps its own wording, since its rate-limit stops aren't errors. The pipeline's run log classifies pricing outcomes by the prefix (NFR-22) | review fix (S12); the review's `http_429` is corrected to the real kind, `rate_limited`; amended by D-270 (per-step `priceOutcomes`) |
| D-219 | **Budget tolerance** for "about 20 divines" (D-116, D-147): a total of at most 20 passes; more than 20 and at most 22 passes with a "near the ceiling" note in the guide; more than 22 fails | settled (user, 2026-10-08; review S15); amended by D-249, D-281 (target: `m` at 5 and 5.5) |
| D-220 | `guide_run`'s run-folder mode and `compile_plan` refuse a guides root whose real path equals, is inside, or contains the builds folder's real path | review fix (S16) |
| D-221 | `compile_check` returns, for each producer the plan names, whether it exists in the game data (V2's `producer-unknown`). A compile sends one engine request per compiled stage plus a fixed overhead of five: the preflight (`compile_check`), `new_build`, `compile_finish`, the XML export and the session's snapshot export. **Amends D-156**, including the coordinator's earlier "plus at most one read-only preflight request" | review fix (S20) |
| D-222 | The C-2/C-5 changes to existing Lua actions are a modified contract, listed in §3.1: additive params on `search_nodes`, `get_stats` (with an additive reply field), `set_level` and `set_tree`; `update_tree_delta`'s completed reply; `set_main_selection`'s `skillPart` param renamed `statSet`, which is internal because only `set_main_skill` calls it | resolution |
| D-223 | Tree-jewel slots join only `add_item`'s `slot_name` enum. The shared `ITEM_SLOTS` and AC-E38 are unchanged | resolution |
| D-224 | C-49 gets no batch mode: each call prices one item, and the rate limiter does the pacing | resolution; settles D-202's "any batch-pricing mode" |
| D-225 | `lookup_game_data`'s `max_results` defaults to 20 and is capped at 30 | resolution |
| D-226 | `check_model_coverage`'s "possibly unread" status follows spike S-b's by-name scan | resolution; **amended by D-243** |
| D-227 | With `include_ascendancy`, notables beyond the build's remaining ascendancy points are marked, not hidden | resolution; refines D-197; amended by D-307 (points counted as PoB counts them) |
| D-228 | `lookup_game_data`'s gem mode also gives the gem's level requirement per gem level and its attribute requirements, which D2 and V1 need | resolution |
| D-229 | **WU-30's pass mark** (HG-13's margin): every per-stage engine request finishes in under 20 s, a third below the 30 s request timeout (`POB_TIMEOUT_MS`), and a 15-stage plan compiles in at most 100 s in total. A miss is HG-13 | resolution; refines D-159, NFR-21; amends D-156 (the 20 s margin); unchanged by D-293 |
| D-230 | **Baseline config options.** C-32's scenario inputs gain a `baseline` subclass: default-on options that model a neutral state, such as full life or mana. Such an option may stay at its default only if the committed `data/config-baseline.json` lists it with a one-line rationale; the default audit accepts listed options; any other default-on option is justified as earned state or a scenario input, or set explicitly | resolution; **amended by D-250, D-252** |
| D-231 | Lookups (`read`-kind tools) may be called by the R1a research agents and the V4 agents. Engine-changing calls and every trade call are made only by the coordinator. C-36's wording is corrected to match D-130 | resolution; D-297's amendment (the researchers' poe.ninja tools) is withdrawn by D-335 |
| D-232 | Offline, V4 checks a claim derived from C1/E1 against the data-file fact and the citation stored there; the claim cites the fact as `data:<file>#<key>` (C-30). Fetching the fact's external URL isn't required offline | resolution |
| D-233 | The plan's `league` may be null only when every price is `unavailable` because the run is offline, i.e. with `note: "offline run"`; the schema enforces this conditionally | resolution; an online run that can't reach trade writes `"unverified"` (D-313, D-330) |
| D-234 | The survival floor (D-118) gates fire, cold, lightning **and chaos** resistance at their caps. Chaos may stay uncapped on an endgame variant stage only when that is absolutely necessary, and only through the stage's recorded exception, `chaosResistException: {reason, tag}` (C-31): the reason names what makes the cap infeasible (for example Chaos Inoculation, or no slot that can carry chaos resistance without dropping a core item or breaking the budget). With the exception, the floor passes with a finding and the guide's `Checks` states the uncapped value and the reason; without it, `MissingChaosResist` above 0 fails the floor | settled (user, 2026-10-08: "only leave chaos res uncapped if it's absolutely necessary") |
| D-235 | The 3-concept cap (D-127, D-161) applies per research round. "Ask for more" at checkpoint 1 starts a new round of up to 3 concepts. Only the user starts one, never automatically, and the run log records every round | resolution; amended by D-270 (rounds read from the checkpoint-1 answers `more`), D-287 (target) |
| D-236 | At checkpoint 2 the user may ask for changes: the coordinator maps each request to the stage responsible, re-runs it and every later stage, and re-runs the checks. These revisions don't count against the retry cap, but the run log records them. When retries are exhausted (D-127), the escalation offers four choices: accept, with the failure stated in the guide; give guidance and retry once more; go back to checkpoint 1; stop | resolution; **amended by D-267, D-268** (the runner maps revisions; the four choices are for gate escalations only), D-287 (target: back to the verification gate) |
| D-237 | A price claim cites `price:<id>`, where `<id>` is a `prices[].id`: the plan's price entry, which holds the date, league and query. `prices[]` entries gain an `id` | resolution |
| D-238 | Before any agent runs, the skill checks the roll: the ascendancy exists (`get_classes`) and the main skill is an active skill gem (a gem lookup). If either check fails, it stops and lists the closest valid names; no run folder is created | resolution; amended by D-258 (closest names), D-285, D-286 (target) |
| D-239 | `lookup_game_data`'s unique mode (C-37): when more than one unique is returned, each is a compact entry: name, type, base and at most 5 matched lines, each naming its variants when it comes from a variant other than the selected one, then `(and <n> more matching lines)`. The full `BuildRaw()` text comes only when exactly one unique is returned. Legacy "Pre x.y" variants are skipped. Basis: `{slot:"Jewel"}` printed about 100 KB | resolution (coordinator, 2026-10-08, WL:71-73); built |
| D-240 | `lookup_game_data`'s mechanic mode takes an optional `kind` (`gem`, `unique`, `passive` or `mod`), and its header gives each kind's hit total. Basis: broad queries filled every slot with gems | resolution (WL:74-75); built; extended by WU-60 (D-277): a fifth kind, `essence`, counted in the header |
| D-241 | In gem mode each stat set shows `Attack Damage: <n>% of base` and `Critical Hit Chance: <n.nn>%` where PoB's gem tooltip does. The values come from PoB's merge of the effect's level and the stat set's level (`CalcActiveSkill.lua:792-797`); the "of base" wording differs slightly from PoB's per-stat-set tooltip (`GemTooltip.lua:217-221`) | resolution (WL:76-77, :114-117); built |
| D-242 | `check_model_coverage`'s build mode also checks jewels in allocated tree sockets, sourced `Jewel socket <nodeId>: <name>` | resolution (WL:172-173); built |
| D-243 | The name scan also collects PoB's `..` concatenation templates, sent to Lua as `sourceTemplates`. A mod name counts as read when it ends in a template literal of 6 or more characters starting with a capital, or matches a template whose `*` parts are each empty or a scanned name. `possibly unread` is advisory: the pipeline confirms it by measurement before a hand calculation | resolution (WL:174-177); built; **amends D-226**; the suffix rule doesn't apply to D-336's `mapped but unread` flag |
| D-244 | `manage_sets {action:"list"}` runs as kind `read` through the router's per-call kind rules, `engineKindFor` (`src/server/toolRouter.ts`), which also hold `guide_run`'s rule (D-216) | resolution (WL:178-179); built; **amends D-190** (C-8) |
| D-245 | A set title (C-39) carries at most one `{…}` tag, at its end, of non-empty comma-separated ids of `[A-Za-z0-9]`. An untitled copy drops the source's tag: `S {1}` gives `S (Copy)` | resolution (WL:180-181); built |
| D-246 | `get_passive_upgrades` bounds its own output within C-1's 5000 characters, so no can't-measure line is cut: ranked entries lose their stat bullets first, then the lowest-ranked entries go, the longer ranking first. It returns `refit`, so notices the session prepends can't push lines past the cut | resolution (WL:182-183, :232-233); built |
| D-247 | An ascendancy notable with no stat lines of its own (a multiple-choice notable) is listed can't-measure, with its options. Each can't-measure reason is labelled `not applied`, `advisory`, `choice` or `no value` | resolution (WL:184-185, :160-161); built |
| D-248 | `compile_plan` puts every listed config option PoB's save dropped back into its stage's `<ConfigSet>` in the written XML, and checks each listed option is there with its value (`src/plan/savedConfig.ts`). The record's `saveWarnings` names the options a re-save in PoB2 would drop again. Basis: `ConfigTab:Save` compares with the active set's placeholder, so non-active stages lost explicit options | resolution (WL:297-299); built; **amends D-212** |
| D-249 | Tree jewels count toward the budget (D-116, D-147). Every filled slot and every tree jewel has its own `prices[]` entry, except slots holding identical item text; totals are compared rounded to 2 decimals | resolution (WL:300-301); built; **amends D-116, D-147, D-219** |
| D-250 | A skill-conditional config option is baseline (D-230) only while PoB hides it for the stage; shown, default-on and unlisted, it is `default-unlisted` | resolution (WL:302-303); built; **amends D-230** |
| D-251 | V1's `resistance-penalty`: at a region's last progress key, the next region's entry penalty is also accepted, with a note | resolution (WL:304-305); built |
| D-252 | On a boss-scenario stage, the enemy's level, armour, evasion, resistances and crit are scenario entries citing E1, never baseline | resolution (WL:306-307); built; **amends D-230** |
| D-253 | On resuming after the user accepted a V3/V4 escalation, W1 re-ran once with the accepted findings | resolution (WL:390-392); **superseded by D-268**: verification no longer escalates |
| D-254 | Each endgame stage holds five reference hits (physical, fire, cold, lightning, chaos), each waystone-scaled at the top of its modifier ranges at the variant's area level (79 for the budget variant; `enemies/waystones.json#area-level.max`, 82, for the non-budget variant), and each equal to the ledger entry `hit_<stage>_<type>`. The D1 gate and the run checker require all five | resolution (WL:393-396); built; **amends D-119**; amended by D-256, D-281 |
| D-255 | Under `--partial`, the checker skipped the unresolved-findings rule for an escalated or stopped run | resolution (WL:397-398); **superseded by D-271** (no `--partial`) |
| D-256 | Reference hits are whole numbers, since PoB types `enemy<Type>Damage` as `countAllowZero`. The scenario value is `ceil(round2(ledger value))`: `round2` absorbs float32 noise, so 402.0000030 stays 402. `<Type>MaximumHitTaken` must exceed it, and the hit is tied to the stage's area level. The guide quotes the ledger value | resolution (WL:444-447, refined :481-483, :651); built; **amends D-254**; quoting amended by D-276 (target) |
| D-257 | The writer agent has Edit, so it fixes a guide in place | resolution (WL:484); built |
| D-258 | When nothing matches, `lookup_game_data` lists the closest names of the kind searched, by edit distance, then by name: in gem mode up to 5 active gems, then up to 3 supports under their own heading (D-258a); otherwise up to 5; none for a query over 100 characters. Gem entries show PoB's `Tier`. The skill's invalid-roll refusal quotes the active names | resolution (WL:485-489, :533-535, :543-544); built; **amends C-37**, D-238 (the refusal's closest names) |
| D-259 | V1 enforces the gem tier floor: a tier-T skill gem is at gem level T or higher (C1's `tier-rule`) | resolution (WL:490-491); built |
| D-260 | The compile record is `importCode`'s one home: the D2-gate verdict and the run log's `outputs` carry no import code. Its second part, reading a truncated workflow result, went with the workflows | resolution (WL:492-497); built; second part **superseded by D-267** |
| D-261 | The run log's `pricing.totals.unavailable` counted every `unavailable` price across every plan of the run, and the checker recounted it | resolution (WL:498-499); **superseded by D-270** (no pricing totals) |
| D-262 | Under `--partial`, the checker skipped the V4 claim-count rules when a plan-changing step ran after the last V4 pass | resolution (WL:500-501, :548-549); **superseded by D-271** |
| D-263 | No headless sessions: the tool is meant for interactive use, so a headless `claude -p` run is not a real-world test, and headless-only issues aren't fixed. Pipeline runs are interactive sessions the user starts | settled (user, 2026-10-08, WL:513-524) |
| D-264 | **Claims fixed in place.** In the fix round each owner (D1, D2 or W1) edits the claims its findings name, with Edit: wording, citation, caveat or source. It recompiles only when a finding needs a build change (gear, tree, gems, config, scenario or a ledger formula). Without a recompile no gate runs, W1 patches the guide in place, and the re-check covers each raising lens's findings and the changed locations, plus the sources lens always. With a recompile the gates run, and all three lenses re-check every claim (`changed: "all"`). A raising lens that skips its re-check fails the run | settled (user, 2026-10-09, WL:729-738, :776-778, :790); built; **amends D-268**, D-270 (outcome `claims-edited`), D-271 |
| D-265 | Small items: (a) a V4 report superseded by one that checked every claim again is held to the artifact as it was; (b) a pre-supplied answer still prints the checkpoint's display; (c) D2 picks every campaign reward choice, listed on every stage at or after its quest, the endgame stages included, and the guide names each pick; (d) Known issues: each open finding's `reader` sentence (written by V4), then its id in parentheses, the runner replacing the whole list each cycle; (e) the runner's Bash runs only read-only `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq`, and the checker; (f) R1b applies FI-1 in its first compile, so a failed concept leaves no clean record | resolution (coordinator, 2026-10-09, under the user's direction; WL:740-750, :766-767, :776-783, :789); built; **amends D-267, D-268**, D-271; (d)'s id placement amended by D-276 (target) |
| D-266 | The compile record gains `buildSha1` (C-33): the sha1 of the plan's build projection, the plan without `stages[].claims` and without every `source` and `tag` field at any depth (`src/plan/buildHash.ts`). When claims-only owners (D-264) edited the plan after the final compile, the checker requires the projection's sha1 to equal it. Additive; `recordVersion` stays 1 | resolution (WL:772-774, :787-788); built; amends D-271 (the checker requires it); clarified by D-328 |
| D-267 | **One orchestration path** (amendment 1 S1). The runner, the user's session following `SKILL.md`, calls each step's agent with the Agent tool, naming one of four types as `subagent_type`: `build-guide-researcher`, `-coordinator`, `-writer`, `-verifier`. There are no saved workflows, no Agent-tool fallback, no provenance agent and no `revise-map` step: the runner maps revision requests itself. Each agent writes only its header's `writes` and returns at most 8 lines; a gate step writes its own verdict file; the verifier can't write, so it returns its report as JSON and the runner writes it unchanged. The runner reads only the verdict files, its log, the test config, the returns and the V4 reports | settled (user, 2026-10-08); built; **supersedes D-129, D-172** and D-260's second part; amends D-152, D-236, A-22, A-23; its Bash rule is amended by D-265 |
| D-268 | **Verify once, fix once, report the rest** (amendment 1 S2, Q1, Q4). One full pass of the three V4 lenses (`ledger`, `sources`, `prose`) over the plan and the guide, every claim, no sampling; one fix round routed to the owners; one re-check. What stays open becomes a known issue under the guide's `### Known issues` and is shown at checkpoint 2. Verification never escalates. V3 and its agent are gone: the checker checks tag syntax, and the sources lens reports unsourced claims. A checkpoint-2 revision gets one full pass, then the same fix round and re-check | settled (user, 2026-10-08: S2); Q1 and Q4 settled by the coordinator; built; **amends D-127, D-141, D-166, D-179, D-236**; supersedes D-253 and D-312's V3/V4 equality part; amended by D-264, D-265, D-276 and D-279 (target) |
| D-269 | The dossier isn't verified after checkpoint 1: it serves the pick, and the guide can't cite it. There is no `dossier-fix` stage (amendment 1 S3) | settled (user, 2026-10-08); built |
| D-270 | **The run log, schema version 2** (amendment 1 S4, Q5): `schemaVersion`, `runFolder`, `slug`, `roll`, `status`, `mode`, `testConfig`, `stages[]` (`{stage, concept?, attempt, outcome, priceOutcomes?}`), `checkpoints[]` (`{checkpoint, visit, answer, answeredBy, rule?}`), `escalations[]` (`{stage, concept, verdict, choice, guidance?}`), `faults[]`, `outputs`. No timestamps, caps, agent counts, or pricing calls and totals. NFR-22 reads each pricing step's `priceOutcomes`; NFR-23 is read from `stages[]` and the session transcript | settled (user, 2026-10-08: S4); Q5 settled by the coordinator; built; **replaces D-158**; supersedes D-261; amends D-161, D-218, D-235; amended by D-264 (outcome `claims-edited`) and D-289 (target) |
| D-271 | **The run checker checks artifacts, not self-reports** (amendment 1 S5, Q3). No `--partial`: it checks what the folder holds. The layout, the guide's structure and markers, the offline rules, the guide's import code against the record's, the plan against the record's `planSha1`, the PoB file against the import code with one loadout per stage, the ledger re-evaluated with the server's compiled evaluator, every open finding listed as a known issue, and the D1 gate recomputed from the record. It may load the server's compiled `build/plan/` modules | settled (user, 2026-10-08: S5); Q3 settled by the coordinator; built; supersedes D-255, D-262; amended by D-264, D-265, D-266, D-326, and D-283, D-289 (target) |
| D-272 | **Retries in full** (amendment 1 S6, Q2). The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each. Uncounted: an attempt failed by a fault directive that applies to attempt 1 only (a persistent directive's failed attempts count), a guided retry, the fix round, a revision, and one re-run after a missing return; a second miss ends the run `stopped` | settled (user, 2026-10-08: S6); the S6 refinement and Q2 settled by the coordinator; built; **amends D-127** |
| D-273 | **Four kept fixes** (amendment 1 S7). (1) D1 sets `skills.main.statSet`; on each stage with a `rolledGroup`, `main.group` is that group, and the rolled figure is the main skill's stat set (`g<main.group>s<main.activeSkill>p<main.statSet>`, directly or in every breakdown field its ledger formula reads). (2) `compile_plan` prints every V1/V2 finding, up to 200 over all stages, then one line pointing to the record. (3) Stage references name tools `mcp__pob2__…`. (4) Three claim rules: a claim is supported in every part, cites each fact it rests on, and carries its source's caveats | settled (user, 2026-10-08); built; amends D-217 (`main.group` is `rolledGroup`); (2) as built (the amendment said "every finding"); amended by D-279 (rule 3) and D-294 (the headline), target |
| D-274 | WU-47 is rewritten for the single path (amendment 1 S8): run A, run B, probes P1 and P2, and the AC changes in slice 3 | settled (user, 2026-10-08); done |
| D-275 | The M-12 re-run uses Opus, the user's default model (amendment 1 S9) | settled (user, 2026-10-08); done; supersedes the earlier Sonnet choice (WL:406-409) |
| D-276 | **The reader layer** (amendment 2 G1). `guide.md` is a game guide of 14 H2s (slice 3 §8), about 2,840 words, capped at 3,000. It renders the plan and the record, with no markers and no fact or number of its own; advice is in the first person; each caveat appears once; there is no pipeline text; numbers are rounded as a guide rounds them ("about 440"); affix targets are text. Known issues sit under `What PoB can't show`, as reader sentences | settled (user, 2026-10-09); built, WU-62 (merge `14f3553`); **amends D-105, C-30**, D-256's quoting, D-265 (d), D-268's Q1 |
| D-277 | **Optional guide items** (amendment 2's revision): used where the build has them, never required, and the prose lens doesn't flag a missing one: fallbacks (from alternatives D1 or D2 already weighed), threshold triggers (otherwise a first-person judgment trigger), up to 4 sourced traps, up to 2 either/or picks, hold and save rows, and rotation clauses. Only these are optional. The revision's other additions are section content (slice 3 §8): the loadout ladder line with each rung's trigger, the "when you're short" line, the entering-maps buy order, the config assumptions behind the headline, and an affix's source where it limits the base. To source affix limits, the lookup lists a mod's base types and searches essences | settled (user, 2026-10-09); built, WU-60 (the lookup: merge `fdcf6a7`) and WU-62 (the guide items: merge `14f3553`) |
| D-278 | **The audit layer** (amendment 2 G2): `audit.md` in the run folder, written and patched by W1, its Known issues table filled by the runner. H2s: `Hand calculations`, `Stage detail`, `What PoB doesn't model`, `Inputs by confidence`, `Run notes`, `Known issues` | settled (user, 2026-10-09); built, WU-62; amends C-34, C-36 |
| D-279 | **Claims and the editor lens** (amendment 2 G3). The plan holds the facts and is verified as before; a claim exists only for a fact the guide states or a gate needs, and first-person advice needs none. The prose lens reads `guide.md` like an editor against the plan, the record and `audit.md`, and never flags a missing optional item. Claim rule 3 becomes: a caveat appears once in the guide and is never later stated as settled | settled (user, 2026-10-09); built, WU-62; **amends D-179, D-268, D-273** |
| D-280 | **Not a tutorial** (amendment 2 G4): a sentence about how the game or PoB works stays only when it names something this build uses, needs or avoids, and changes what the reader does; the swap test cuts what would read as true in any other guide | settled (user, 2026-10-09); built, WU-62 |
| D-281 | **The entering-maps rung `m`** (amendment 2 G5, Q1): a third endgame stage, `variant: "entering-maps"`, between the campaign's end and `b`; area level 69 (T5); gated like `b` (the survival floor, the main damage rule), with a budget of 5 divines (≤ 5 passes, ≤ 5.5 passes with "near the ceiling", `unverified` offline); no Arbiter report or mapping signals. D1 designs it after `b` and `n`; D2 plans backward to it | settled (user, 2026-10-09); built, WU-61 (merge `74c5745`) and WU-62; **amends D-116, D-117, D-147, D-219, D-254**; refined by D-320, D-327 |
| D-282 | **One endgame tree track** (amendment 2 G5, Q3): `m` continues from the last campaign stage, `b` from `m`, `n` from `b`; V1 checks each rung's respec and gold cost. As built (WU-61): the track goes by rung, `m` → `b` → `n`, whatever the plan order (plan order only within a rung; a rung the plan lacks is skipped); the first rung follows the last campaign stage in the plan, wherever the rung is listed; V1 checks each rung's `respec.dropped` against the rung before it, and the gold cost gets only its schema check, since it carries a `judgment` tag (A-32) | settled (user, 2026-10-09); built, WU-61 (merge `74c5745`; no fixture verdict moved); **amends D-144**; replaces slice 2's A-P3 |
| D-283 | **The checker's guards** (amendment 2 G6): `guide.md` has at most 3,000 words (the H1, the import code and the Known issues list not counted); G1's headings in order; no markers in `guide.md`; its import code equals the record's; one fixed-form verdict line per endgame rung, compared part by part with the record; reward picks by name; Known issues by sentence, with their ids in `audit.md` | settled (user, 2026-10-09); built, WU-62; amends D-271; amended by D-294 (target) |
| D-284 | The vendor search regex is deferred (amendment 2 Q6) | deferred (HG-19) |
| D-285 | **The brief** (amendment 3 O1, Q1, Q2; C-51): seven optional fields (`ascendancy`, `skill`, `playstyle`, `budget`, `around`, `like`, `notes`); the playstyle vocabulary's five axes plus free text; an empty brief means "surprise me". The invocation is `/build-guide <free text> [--offline [--test <path>]] [--no-ninja]`; the runner parses the brief before any run folder exists, and the brainstorm gate echoes it (amendment 3 says "the coordinator parses"; the runner reading is PROPOSED by the coordinator, 2026-10-10, C-51); `/build-guide <ascendancy> <skill>` still works. Named fields are checked as D-238 checks a roll. The slug comes from the brief | settled (user, 2026-10-10); **target**, WU-57; amends D-101's input, D-238; amended by D-335 (an eighth optional field, `popularity`) |
| D-286 | **Each card's identity** is `{className, ascendancy, skill}`, `skill` being the named damage source, checked at deck assembly. It is the card's skeleton `roll`, and the verification pick makes it the run's `roll`, which the run log holds null until then (amendment 3 O1) | settled (user, 2026-10-10); **target**, WU-57; amends C-31's `roll`, D-238 |
| D-287 | **Three phases, three gates** (amendment 3 O2, Q3). Brainstorm: three researchers write 2–3 cards each; R1a-assemble merges them, checks their identities, deals a card only when a lookup confirms every load-bearing link in game text, and writes `cards.md` (6–9 dealt per round); the brainstorm gate (verify 1–3 cards, brainstorm more, or stop). Verification: R1b per picked card, at most 3 per verification round, with the checklist; R1b-assemble; the verification gate (finalize one, verify other cards, brainstorm more, or stop). Finalization: D1 through the final gate. Only the user starts a round. Every route back to checkpoint 1 goes to the verification gate | settled (user, 2026-10-10); **target**, WU-57; **amends D-124, D-125, D-141, D-157, D-161, D-235, D-236**, NFR-23 |
| D-288 | Offline test answers for the new gates; A-28's coordinator also answers the brainstorm gate (amendment 3 O2) | settled (user, 2026-10-10); **target**, WU-57; amends A-28; amended by D-323 (the answer keys) |
| D-289 | **The run log, schema version 3**: `brief`; `roll` as D-286 says; gate names `brainstorm`, `verification` and `final`, alongside `unsaved-build` and `escalation`; card ids; verification rounds; the escalation choice `verification` replaces `checkpoint-1` (amendment 3 O2) | settled (user, 2026-10-10); **target**, WU-58; **amends D-270, D-271**; amended by D-323; refined by D-326 |
| D-290 | **The pattern library** `references/patterns.md` (C-53): shapes only, each entry with a search step, how PoB follows it, examples and cautions; every researcher reads it first; the coordinator proposes entries after each user-supplied study, and the user approves them (amendment 3 O3, Q6) | settled (user, 2026-10-10); built, WU-56 (merge `228bec1`); refined by D-325 |
| D-291 | **The candidate card** (C-52; amendment 3 O4): `templates/card-template.md`; R1a fills the brainstorm half, R1b the verification half; the status words are confirmed in game text, modelled in PoB, estimate, players use it, not checked yet, and needs in-game testing | settled (user, 2026-10-10); the template built, WU-56; the cards **target**, WU-57; amended by D-335 ("players use it" cites the user's notes, never poe.ninja) |
| D-292 | **The verification checklist is advisory** (amendment 3 O5): R1b reports each check as verified, estimate, risk or not checked; none is a gate or starts a fix round. A check that needs a toggle runs as a plan variant, compiled measure-only as one stage, up to 4 per card beyond R1b's two compiles | settled (user, 2026-10-10); the checklist's text built, WU-56 (`references/stages/R1b.md`); its run **target**, WU-57; amends D-311; refined by D-338 |
| D-293 | **Count and custom modifiers** (amendment 3 O6, Q7). A skill group's `count` (default 1) and `countReason`; `config.customMods: [{text, reason}]`, written to PoB's `customMods` option after the config writes. The record applies Count itself (hits × count, damage over time only when it stacks) and marks every figure computed with a custom modifier present. The delivered file sets `groupCount` and `includeInFullDPS` on the named source's groups only. Full DPS stays out of measure compiles unless S-N2 (WU-51) shows it is cheap | settled (user, 2026-10-10); WU-51 done; **target**, WU-55; amends C-31, C-32, C-33, C-41, D-306; refined by D-320, D-321, D-322; its measure-compile clause settled by D-337 (S-N2 showed it cheap: every compile computes Full DPS for the named groups) |
| D-294 | **The headline and EHP** (amendment 3 O6, Q7, Q8). The headline is the named source's main stat-set figure × its Count; clear and boss figures stay separate. `TotalEHP` is shown beside max hit, never alone, and max hit stays the basis of the survival verdict. The verdict line quotes the Count-scaled figure and ends `Effective HP about <n>.`, checked against `TotalEHP`; R1b-assemble's key numbers add `TotalEHP` | settled (user, 2026-10-10); **target**, WU-55, WU-57, WU-58; **amends D-273, D-283**; refined by D-321 |
| D-295 | **The damage rule.** D-122 becomes: "The build's named damage source is the main source of damage, never a token role." For a fixed skill that skill is the named source, and its own hits, ailments and projectiles count when another skill fires, spreads or copies them (the user, 2026-10-10). D-148 becomes: "The named damage source should be the clear skill. It takes the single-target role only when it can't clear, and the guide says so." `rolledGroup` keeps its name, meaning the group of the named source | settled (user, 2026-10-10); **target**, WU-57; **amends D-122, D-148, D-217** |
| D-296 | **PoB's role.** PoB keeps its job for defences and the delivered file. A DPS figure that rests on Count or a hand calculation is a labelled estimate, not verified for exactness. The finished guide still checks that every stated interaction exists in game text | settled (user, 2026-10-10, WL:1395-1399); **target**, WU-57; amends D-106, D-179 |
| D-297 | **poe.ninja, economy endpoints only** (amendment 3 O7, **restated by D-335**). poe.ninja is used only through its documented economy endpoints: C-12's currency rates (`get_currency_rates`, group `ninja`, called by coordinator steps), and polite development queries (serial requests, back-off on HTTP 429, nothing fetched twice that a cache could hold). Its builds, profiles and character API is never used, by any agent or tool, in development or in runs. Off switches for `get_currency_rates`: `--no-ninja`, `--offline` and `POE_NINJA_DISABLED`. Only requests that need PII or a cookie need explicit approval, so these need none and D-182 covers trade only; tests stay offline (D-34). So D-297 also amends stab D-34 and stab HG-1, D-181 and D-201, for poe.ninja's economy endpoints only, while pathofexile.com and any request that carries a cookie or personal data stay gated. The project `CLAUDE.md` names the economy endpoints only and says the builds API is closed by poe.ninja's terms (reworded with D-335). *As first settled,* it added server tools for popularity, the build index and peers, which the researchers and the coordinator could call (C-54); D-335 withdrew them | settled (user, 2026-10-10); restated by D-335 (the user, 2026-10-10); in force; **amends D-112, D-181, D-182, D-201**, stab D-34, stab HG-1, HG-14; its amendments of D-130, D-178 and D-231 withdrawn by D-335; refined by D-333 |
| D-298 | **Under-played cards** (amendment 3 Q5, **restated by D-335**): each deck holds at least two cards that the coordinator judges under-played, from the pattern library, labelled `judgment`. There is no popularity threshold. *As first settled:* with poe.ninja on, at least two cards below a popularity threshold that D-324 would set | settled (user, 2026-10-10); restated by D-335 (the user, 2026-10-10); **target**, WU-57 |
| D-299 | **Lookup additions** (C-37; amendment 3 O8): Gemling quality effects (`altQualityStats`, labelled); "usable by"; item-base implicits; type-granting unlocks; what a support can ride; named phrase searches; a skill's hit-making children; stat sets | settled (user, 2026-10-10); **target**, WU-53 (its criteria AC-K58…AC-K65 pinned on its lane) |
| D-300 | **Coverage flags** (C-38; amendment 3 O8): energy-based meta gems; skills granted by a support; granted skills with no definition; stats mapped but read nowhere (ending Mirage Archer's false all-clear); Gem Studded ties | settled (user, 2026-10-10); built, WU-54 (merge `92371c2`); refined by D-336 |
| D-301 | **Campaign additions** (amendment 3 O9): D2 plans bridge skills while the named source is level-gated, and banks the enabler in hold and save rows; W1's Leveling says what is dormant until the enabler arrives, and Priorities marks early pillars "buy now, works at stage X". Optional items | settled (user, 2026-10-10); **target**, WU-57 |
| D-302 | **Won't do** (amendment 3 O11): no interaction database or graph; no hunting for undocumented interactions; no modelling of mechanics in Lua beyond Count and custom modifiers, and no patching of `vendor/`; no scoring candidates by formula; no required gates from the checklist | settled (user, 2026-10-10) |
| D-303 | A card whose damage source isn't a skill (a flask nova) can be dealt and verified, marked "can't be finalized yet"; finalizing it is deferred (amendment 3 Q4) | deferred (HG-21) |
| D-304 | Rolls above the data range (PG-41) are deferred (amendment 3 O8) | deferred (HG-20) |
| D-305 | The count sites (§1.3) include `tests/mcp/toolDisposition.test.ts`, whose `build-guide` lane counts this epic's tools from `BUILD_GUIDE_NEW`, and the README's two tool-count sentences (`README.md:21, :60`) | resolution (coordinator, 2026-10-08, WL:78-81); built |
| D-306 | The compiler creates every socket group with `includeInFullDPS` off, and deferred rebuilds must give per-stage outputs equal to the eager path. Basis: WU-30's run with Full DPS on took 160.68 s | resolution (WL:82-84, :194, :234-236); built; **narrowed by D-337** (target, WU-55): it holds for every group outside the named source, whose groups go in Full DPS in every compile |
| D-307 | Ascendancy points (C-48, and C-47's remaining points) are counted as PoB's `PassiveSpec:CountAllocNodes` counts them: multiple-choice options and free-allocate nodes are excluded | resolution (WL:186-188); built; amends D-194, D-227 |
| D-308 | `update_tree_delta` refuses any add that would change an allocated node's weapon-set tag, after a dry run and with the build unchanged, and keeps attribute choices | resolution (WL:149-151); built; amends D-194 |
| D-309 | `set_main_selection`'s reply gains an optional `statSet` | resolution (WL:189); built |
| D-310 | **Off-hands per stage.** Each stage's tree and non-off-hand items are calculated before its off-hands go in; a `compareItems` check per stage and per item set makes any dropped item an error; weapon flags come from the measured `modDB`. The record's `loadoutWarnings` say where switching loadouts in PoB2 can unequip a planned off-hand. An impossible shared-set off-hand is refused at compile, not in `compile_check` | resolution (WL:240-256); built |
| D-311 | **R1 rules.** R1b makes at most two measure-only compiles per attempt: an optional bootstrap of a tree-minimal skeleton (paths then come from `find_path_to_node`), then the whole skeleton. Validation comes before any price call. R1a's foci are mechanics (0–1 concept), items (1–2) and tree (1). A researcher that returned without its file re-runs once | resolution (WL:269-279, :308-309); built; amended by D-292 (target: probe variants) |
| D-312 | **Gate findings** are equal when their plan stage, part and code are. The checker takes the concept from the gate files, and fails a completed run on any recomputed or reported gate failure that no accepted finding covers. `chaos-exception` and `near-ceiling` findings report on a passing part and never fail | resolution (WL:310-312, :355-356, :399-402); built; its V3/V4 equality part is superseded by D-268 |
| D-313 | **An unverified league.** When an online run can't reach the trade site, R1b marks `leagueUnverified`; D1 never inherits a guessed league (never Standard), writes `"league": "unverified"` with every price `unavailable` (note `trade unreachable`), and the guide says the league couldn't be verified | resolution (WL:278, :358); built; kept by D-330 |
| D-314 | Trial 3 is available from `q.act-4-abandoned-prison-goddess-of-justice`, at confidence L (the grounding's 60+ Barya route) | resolution (coordinator, 2026-10-08, WL:133-134); built (C1 data) |
| D-315 | **M-14, open builds offline** (§7): amendments 2 and 3 are built (WU-50…WU-62; WU-52 withdrawn by D-335, and WU-50 done as the record of the block) and WU-59 is recorded as WU-47 was. Amendment 3's live-run row is WU-48: WU-48 depends on M-14, so the live alpha exercises the amended pipeline. Its trade approval (D-182, HG-14) is unchanged | settled (user, 2026-10-10); WU-50, WU-51, WU-54, WU-56, WU-60, WU-61, WU-62 done; **target**, WU-53, WU-55, WU-57…WU-59, then WU-48 |
| D-316 | **No numeric tool cap.** D-173's "at most 8 new tools, total under 86" and NFR-24 are retired; D-173's principle stays: extend existing tools where natural, and group new ones. The lifted cap stays, but D-335 withdrew the poe.ninja tools it was lifted for, so it now applies to no new poe.ninja tool: AC-B1's counts stay 84 and 83, and no unit restates them. D-316's resolution of stab HG-3 (tool-set changes need the user) for C-54's tools covers no tool now | settled (user, 2026-10-10); in force; **amends D-173**; withdraws NFR-24; its WU-52 part withdrawn by D-335 |
| D-317 | Amendment 2 is folded as target design and built as WU-60 (the lookup), WU-61 (the plan schema and V1) and WU-62 (the pipeline). WU-62 merges before WU-57 and WU-58, which edit its verdict line. WU-60 merges before WU-53, since both edit `pob-api/API/Lookup.lua` | PROPOSED by the coordinator, 2026-10-10; built: WU-60, WU-61 and WU-62 merged in this order, before WU-53, WU-57 and WU-58 |
| D-318 | Slice 1 hosts WU-50, WU-52, WU-53 and WU-54, with AC-K criteria; amendment 3 named only slices 2 and 3 | PROPOSED by the coordinator, 2026-10-10; WU-54 built, WU-50 done (blocked), WU-52 withdrawn (D-335), WU-53 **target** |
| D-319 | Card ids are `r<round>-<researcher letter>-<n>` (`r1-a-2`), in `cards/<id>.md`; the runner letters the researchers when it starts them, so parallel researchers never collide. `research/p<k>-r1a-<n>.md` stays; if WU-57 finds the research files unused, it removes them and records a decision row | PROPOSED by the coordinator, 2026-10-10; the card template's id form built, WU-56; **target**, WU-57 |
| D-320 | One plan `schemaVersion` bump covers `count` (an integer of at least 1, default 1), `countReason`, `customMods` (optional) and the `entering-maps` variant. The first of WU-61 and WU-55 to merge makes the bump; the second extends the same, unreleased version. Each updates the plan reference and the worked example in the same unit. WU-61 merged first and made the bump, to 2, with `entering-maps`; WU-55 adds its three fields to version 2's `VERSION_ADDITIONS` (`src/plan/schema.ts`) | PROPOSED by the coordinator, 2026-10-10; built, WU-61 (the bump); **target**, WU-55 (its fields); refines D-281, D-293; refined by D-332 |
| D-321 | The record keeps the raw figures as they are; new fields beside them hold each figure × count, and a mark flags each figure computed with custom modifiers. `recordVersion` bumps. The verdict line and the headline read the named source's Count-scaled figure, with `TotalEHP` beside it. WU-55 names the exact fields in C-33's text: `recordVersion: 2`, `countedOutputs`, `countedSkillOutputs`, `customModsWritten` and `computedWithCustomMods` (C-33) | PROPOSED by the coordinator, 2026-10-10; **target**, WU-55; refines D-293, D-294 |
| D-322 | A missing `countReason` (when `count` isn't 1) and a `customMods` entry without a reason are V1 findings, so the stage's `v1.pass` is false; they are not schema errors. WU-55 names the code `missing-reason`, its `data.path` the missing field's path | PROPOSED by the coordinator, 2026-10-10; **target**, WU-55; refines D-293 |
| D-323 | The test config's answers are `answers.brainstorm`, `answers.verification` and `answers.final`; `checkpoint1` and `checkpoint2` are retired in run-log v3 | PROPOSED by the coordinator, 2026-10-10; **target**, WU-57, WU-58; amends D-288, D-289 |
| D-324 | *Withdrawn → D-335:* S-N1 (WU-50) was to produce the poe.ninja tools' names, arguments, outputs, kinds, cache lifetime and back-off, and D-298's popularity threshold. poe.ninja's terms close the API they rest on, so there are no tools and no threshold | withdrawn (D-335) |
| D-325 | The pattern library's cap is 6,000 words, counted by AC-W28's static test (the run checker reads run folders, not the skill's files) | PROPOSED by the coordinator, 2026-10-10; built, WU-56 (5,642 words at the merge); refines D-290 |
| D-326 | The checker accepts run logs of schema versions 2 and 3; version 2 only so that recorded runs (WU-47's) still check | PROPOSED by the coordinator, 2026-10-10; **target**, WU-58; refines D-289; amends D-271 |
| D-327 | The entering-maps rung's reference hits are tied to its area level, 69 (D-281), as D-256 ties each stage's hits to its area level. Only that tie is the coordinator's inference: amendment 2 states the rung's area level, its waystone-scaled hits (D-254) and its ledger entries `hit_m_<type>`, but not the tie | PROPOSED by the coordinator, 2026-10-10; built, WU-62; refines D-281 |
| D-328 | `buildSha1` (D-266) tracks build content. Sources and tags are citations, so a change to `config.scenario[].source` or `respec.goldCost.source` alone leaves it unchanged, by design | PROPOSED by the coordinator, 2026-10-10; built (it describes the built projection); clarifies D-266 |
| D-329 | S-N2 (WU-51) measures the fifteen-stage fixture | PROPOSED by the coordinator, 2026-10-10; done, WU-51 (merge `9f74ad9`) |
| D-330 | `"league": "unverified"` (D-313) stays the convention for an online run that can't reach the trade site; offline, `league` is null (D-233) | PROPOSED by the coordinator (F26, corrected to the code), 2026-10-10; built (`references/stages/D1.md:43-51`; keeps D-313) |
| D-331 | Probe variants (D-292) live at `probes/<card-id>/<n>/` in the run folder | PROPOSED by the coordinator, 2026-10-10; R1b's checklist writes them (WU-56); **target**, WU-57, WU-58 (D-338) |
| D-332 | **Version-1 plans stay accepted.** After the bump (D-320), the plan validators (`compile_plan` and `guide_run`'s validate mode) accept plan `schemaVersion` 1 and 2, so C-31's "only versions they know" means {1, 2}. A version-1 plan defaults the new fields: `count` 1, no `customMods`, no `entering-maps` variant. So recorded runs' plans still validate and compile. As built (WU-61): a version-1 plan keeps version 1's shape, so a version-1 plan that uses a version-2 field is an error at that field's path, naming the version that added it (an `entering-maps` variant now; from WU-55 an explicit `count`, `countReason` or `customMods` too) | PROPOSED by the coordinator, 2026-10-10; built, WU-61; **target**, WU-55 (its fields); refines D-320 |
| D-333 | **`--no-ninja`** means the run calls no tool in group `ninja`, whose one tool, after D-335, is `get_currency_rates`. Price totals in divines are then `unverified`, pricing's existing path when rates are missing (`references/pricing.md:88-89`). (It first named C-54's tools too, and tied the cards' "no player evidence" to the switch; D-335 makes that the cards' wording in every run without the user's notes) | PROPOSED by the coordinator, 2026-10-10; **target**, WU-57; refines D-297; amended by D-335 |
| D-334 | **A card whose damage source isn't a skill** (D-303): its identity's `skill` names the damage source (an item, a passive or a modifier, D-295), and deck assembly checks it with `lookup_game_data` by that kind instead of requiring `Kind: active`. In verification it gets only the checklist's read-only checks (D-292): no skeleton or probe compile until HG-21's plan field exists. The card says so: "not compiled: its damage source isn't a skill" | PROPOSED by the coordinator, 2026-10-10; **target**, WU-57; refines D-303 |
| D-335 | **No player-evidence tools.** Spike WU-50 found that poe.ninja's API Reference closes the builds and profiles API, and every other non-economy endpoint (character, Path of Building, authentication), to third-party use, for server load and the privacy of players who hide their characters (`spikes/WU-50-poe-ninja.md` §3.1). Every player-evidence use rested on it. The user chose "No tool; your notes" (options A plus B): (a) C-54's tools and their unit WU-52 are withdrawn, with AC-K47…AC-K49 and D-324; the count sites stay at 84, and 83 with poe.ninja disabled; (b) cards say "no player evidence" unless the brief carries the user's own popularity notes (C-51's `popularity` field), which a card cites as user-supplied; (c) D-298's under-played cards become the coordinator's judgment from the pattern library, labelled `judgment`, with no threshold; (d) D-297 is restated: poe.ninja only through its documented economy endpoints, for C-12's currency rates and polite development queries, never its builds, profiles or character API, by any agent or tool, in development or in runs; (e) `--no-ninja` (D-333) still turns off `get_currency_rates`; (f) WU-57 no longer depends on WU-50 or WU-52; WU-50's report is kept as the record of the block (`d16c16c`); (g) the project `CLAUDE.md` names the economy endpoints only. Rejected: an economy-only signal (the stash overview's `listingCount`, which measures market supply, not players) and GGG's official API (an application to GGG, gated by HG-1) | settled (user, 2026-10-10; WL:1705-1722); in force; **withdraws C-54, WU-52, AC-K47…AC-K49, D-324**; **restates D-297, D-298**; amends C-51, C-52, D-285, D-291, D-315, D-316, D-333 |
| D-336 | **Coverage flags** (C-38, refining D-300). AC-K50's one flag becomes two, since amendment 3 misread Mirage Archer's gap: its only mapped-but-unread line, "cannot consume Charges" (`Condition:CannotConsumeCharges`), is read in the skill data (`Data/Skills/act_dex.lua:222`), and the real gap is the stat `triggered_by_lingering_mirage`, with no stat map and no described line (PG-4). (a) **`mapped but unread`** (PG-24): a gem line's stat maps to a mod name PoB reads nowhere. For this flag a name is read when it is exactly a scanned name; a string a mod tag in the loaded skill data names (any field but `type`); a minion's or spectre's `limit` (`CalcPerform.lua:1298-1303`); a string literal passed to a mod-list read in `Data/Skills/*.lua` (the scan's `sourceCallNames`); a compound `X:Y` of read parts; or a whole fit to a concatenation template, each `*` empty or a read name, D-243's suffix rule not applying. A `*` may also be a skill's name without whitespace, but only in the templates PoB builds from `activeGrantedEffect.name` inside a mod-list read (the scan's `sourceSkillTemplates`: `Multiplier:*MaxStages` and `Multiplier:*MinimumStage` at the pin, `CalcActiveSkill.lua:866-869`). 24 lines at the pin. (b) **`stat not mapped`** (PG-4, PG-49): a support or meta gem's non-zero stats with no stat map (global or the skill's own), in no described line (removing one leaves the described lines unchanged), and not display-only (`display_`, `quality_display_`); **one flag per gem** (the per-stat flag was noisy: 19 on the golden build, 12 of them Pounce's), its note listing the ids sorted and saying PoB may derive some from the gem's skill types; no hand list or other id-prefix cut. 115 gems, 318 stats at the pin; Mirage Archer reports it, ending its false all-clear. (c) Flags sit in a `flags[]` list beside the statuses (`{flag, source, note, line?}`), never as a status, so no count and no C-47 output changes; every mode lists every flag. The criteria are AC-K50 and AC-K53…AC-K57 | PROPOSED by the coordinator, 2026-10-10 (the criteria review); extended 2026-10-10 (one flag per gem) and 2026-10-11 (the skill-name templates, WU-54's re-check); built, WU-54 (merge `92371c2`); refines D-300 |
| D-337 | **Full DPS in every compile.** S-N2 (WU-51) measured the fifteen-stage fixture with `includeInFullDPS` on for each stage's `rolledGroup` only: ×1.14 on the whole call (median), at most 3.08 s per stage request and 31.92 s per call in three quiet runs, within NFR-20 and NFR-21. That is cheap, so every compile, measure-only included, creates the named source's groups with `includeInFullDPS` on and their `groupCount`, and PoB computes Full DPS for them; the flags are not left to the export. Verification and finalization then report the same headline figure, and the compiler has no mode branch. Groups outside the named source stay out of Full DPS (D-306, narrowed) | PROPOSED by the coordinator, 2026-10-10; WU-51 done (merge `9f74ad9`); **target**, WU-55; settles D-293's measure-compile clause; narrows D-306; amends §3.6 step 9 (slice 02) |
| D-338 | **R1b's probe and card writes.** R1b's checklist (WU-56, `references/stages/R1b.md`) writes each probe's plan at `probes/<card-id>/<n>/` (the server writes its measure-only record and XML beside it) and the card's results into `cards/<id>.md`, but R1b's header `writes` don't name them and the checker's layout list rejects `probes/` and `cards/`. WU-57 adds those paths to R1b's header `writes`. WU-58 meets the new clause AC-W2 (ff): the checker accepts `probes/<card-id>/<n>/`, the cards and `cards.md`, and rejects other files there; and the run log records each card's probe count, so D-292's cap of 4 probes per card can be audited | PROPOSED by the coordinator, 2026-10-10 (the WU-56 review's fold item); **target**, WU-57, WU-58; refines D-292, D-331 |

## 6. Autonomy envelope

### 6.1 Settled (proceed, don't relitigate)

Everything in §5 and every contract in §3. The stab spine's §6 decisions and §3 contracts, except where
§3.1 amends them.

### 6.2 Assumptions (proceed-on)

| ID | Assumption | Basis | If wrong |
|---|---|---|---|
| A-20 | Everything K1 and K2 read (gems, skills and stat sets, the stat describer, ascendancy nodes, uniques, `modLib.parseMod`, skill stat maps) is in memory after a headless boot | pin §B2 (probe b2) | The unit reports `blocked`; a missing piece is HG-12 |
| A-21 | S-a's recipe scales to a full plan, and PoB2's desktop GUI shows the loadouts as the headless save wrote them (S-a didn't test the GUI render) | pin §C | WU-30 or the user's import at M-13 shows it; escalate |
| A-22 | Subagents share the session's MCP server and so its one engine (reworded by D-267) | platform §1 (S-c) | No harm: the coordinator still serializes engine work |
| A-23 | *Withdrawn → D-267:* a skill started saved workflows; the runner now calls agents directly with the Agent tool | — | — |
| A-24 | A research agent's tool allowlist can name single MCP tools, limiting it to lookups | platform §3 | The skill keeps engine and trade tools with the coordinator only |
| A-25 | Claude Code backgrounds an MCP call after 120 s; that bounds one `compile_plan` call | stab D-22 rationale | `stages` subsets (D-156) |
| A-26 | *Withdrawn → D-208:* concept-skeleton compiles are measure-only and write no PoB file to the builds folder | — | — |
| A-27 | E1 carries no magic or rare monster life multiplier: none was found for 0.5 (ext §3) and PoB has none (pin §B6). Mapping-strength estimates use normal-monster life and state the rarity effect as judgment, confidence L | design "still open" list | A sourced figure is added to E1 with its citation |
| A-28 | The coordinator runs M-12 and answers its checkpoints: at checkpoint 1 it picks the first concept that passes its checks, or exercises the no-viable-concept path (D-141) if none does; at checkpoint 2 it reviews the guide. *Target (D-288):* at the brainstorm gate it picks the first dealt card, or follows the test config. The answers are recorded in the run log. The skill accepts pre-supplied checkpoint answers only in offline mode (C-36); M-13's checkpoints are the user's | needed for an unattended run | The user vetoes at ratification |
| A-29 | Values the grounding rates M or L (interlude +8, the third and fourth trials' 65+/75+ dispute, the Martyr point, waystone mod sizes) are used as recorded, and a check that rests on one says so in its finding. Trial 3 is available from `q.act-4-abandoned-prison-goddess-of-justice` at L (D-314) | ext §2–§4 | Corrected in the data file with a citation |
| A-30 | The Arbiter of Divinity's in-fight life is unpublished. E1's profile records three inputs for it, each labelled confidence L: the datamined base stats (poe2db's life 246,035 plus 24,603 energy shield at level 79, which is not the fight value); ext §4's extrapolated estimate (about 8M, from the Arbiter of Ash's about 34× fight-to-base ratio), with that method; and the user's community report (about twice the quest version's life, design row 16). The guide reports time-to-kill as a range under those assumptions | The Arbiter check is report-only (D-116); ext §4; design row 16 | A sourced in-fight figure replaces the range in E1, with its citation |
| A-31 | Spirit-gem availability isn't grounded beyond the Act 3 reward, so V1 notes Spirit gems instead of checking them | coordinator resolution (2026-10-07); C1 has no Spirit-gem table | A sourced table is added to C1, and V1 checks it |
| A-32 | Respec gold costs have no source, so `respec.goldCost` carries `judgment` tags | coordinator resolution (2026-10-07); no grounding row | A sourced cost table is added to C1 |
| A-33 | Where amendment 3 gives no acceptance criteria (WU-53's lookup additions, WU-54's flags other than Mirage Archer's, WU-59's run, and AC-W32's D-122 wording test), each unit's first step pins its criteria in its slice spec from the amendment's text, and the coordinator reviews them before any code is written. "Like WU-47" (WU-59) means WU-47's recorded procedure, with an open brief in place of a roll; the brief, the test answers and the faults are chosen when the unit starts. WU-59's criteria include the coordinator's guide review with amendment 2's style rules (the reader layer's rules, each caveat once, the not-a-tutorial rule; moved from AC-W22's target clause) and a run through the paths WU-47 left to tests and review demos: D-264's claims-only path, D-265 (b)–(e) and D-266 (WU-47's exception E4, which named WU-48 before M-14 put WU-59 first). The same step settles the example "Culmination II, then Ailith's Chimes" (amendment 3 O8) | coordinator resolution (2026-10-10, PROPOSED); the amendment names the features but no checks. Applied so far: WU-54 pinned AC-K53…AC-K57, and WU-53 pinned AC-K58…AC-K65 on its lane, each reviewed before code | The user supplies the criteria |

### 6.3 Human-decision gates (stop and escalate, `blocked:needs-human`)

The stab spine's HG-1…HG-9 stay in force. In particular HG-1, which D-297 (as D-335 restates it) narrows to
a live request to pathofexile.com or any request that carries a cookie or personal data (polite requests to
poe.ninja's documented economy endpoints need no approval; its builds, profiles and character API is never
used), HG-6 (the user's builds folder; it now covers the user's guides folder too) and HG-8 (signing).

| ID | Condition | Why a human | Unblocks with |
|---|---|---|---|
| HG-10 | Any dependency change (`package.json`, lockfile) | gap 33; stab §8 dependency rule | The user's decision |
| HG-11 | Any change to `pob-pin.json` | Golden values move; D-140 waits for the next PoB2 release | The user, after a PoB2 release |
| HG-12 | Any tool-set or tool-contract change beyond C-37…C-50 and D-143/D-174/D-175/D-202/D-216: any new tool, a poe.ninja one included (C-54 is withdrawn, D-335), exposing auto-level mode on `set_character_level`, retyping `search_tree_nodes` node types, … | UX scope; token cost (D-173, as amended by D-316); poe.ninja's terms (D-335) | The user's decision |
| HG-13 | WU-30 finds a 15-stage plan compiles in more than 100 s, or one stage's engine request takes 20 s or more, a third below the 30 s timeout (D-229) | gap 9 | The user picks a new budget or approach |
| HG-14 | Starting the live alpha run (M-13): live trade requests through the server, web research on D-171's hosts, writes to the real guides and builds folders. poe.ninja's economy endpoints need no approval (D-297, D-335); the live run follows M-14 (D-315) | gap 32; shared rate limits; the user's folders | The user's approval, asked at the start of M-13 |
| HG-15 | The deferred items: plugin packaging (D-136; when the tooling is feature-complete and stable); unique-jewel trade rows (D-137); per-agent inline engines (D-130; needs a probe); the pin upgrade (D-140); and two post-alpha reviews: the cost envelope (D-127) and a checkpoint after D1 (D-134) | Product scope | The user, after M-13 |
| HG-16 | *Withdrawn → D-207:* how the skill learns the guides root. The server creates the run folder and returns its path | — | — |
| HG-17 | *Withdrawn → D-201:* web hosts during M-12's run. M-12 runs fully offline; web research happens only in M-13 (HG-14) | — | — |
| HG-18 | *Withdrawn → A-30:* the Arbiter of Divinity's fight life. E1 records three low-confidence inputs, and the guide reports time-to-kill as a range | — | — |
| HG-19 | The vendor search regex (D-284) | Its syntax and length limit aren't grounded | Grounding the game's regex syntax and length limit from a source the user names; then the user decides one regex per leveling band and where it goes |
| HG-20 | Rolls above the data range (D-304, PG-41) | Deferred by amendment 3 | The user's decision |
| HG-21 | Finalizing a card whose damage source isn't a skill (D-303) | No plan field holds an item-effect damage source | A plan field for an item-effect damage source and its hand calculation, decided by the user |
| HG-22 | A trade-link field for the guide's affix targets (D-276). PROPOSED by the coordinator (F19): amendment 2 says the field comes with WU-48 if the price tool returns a link; this gate puts that addition to the user | Amendment 2 ties the field to WU-48, if the price tool returns a link | At WU-48, if the price tool returns a link: the user's decision |

## 7. Milestones and alpha definition

- **M-10, Server tools:** WU-31…WU-36 and WU-49. Exit: every AC-K of its units green (AC-K1…AC-K46);
  AC-B1…AC-B5 and AC-B7 green at the last merge. (AC-B6 belongs to WU-37, under M-11.) The amendment ACs
  (AC-K50…AC-K65; AC-K47…AC-K49 withdrawn by D-335) belong to M-14.
- **M-11, Plan compiler:** WU-30, WU-37…WU-42. Exit: every AC-P of its units green (AC-P1…AC-P50;
  AC-P51…AC-P59 belong to M-14), including a hand-written two-stage fixture plan (`tests/fixtures/plans/`)
  that compiles into a PoB2 file with one loadout per stage and nothing titled `Default` (D-215), reloads
  headless, and yields a compile record and an import code that round-trips (D-180). AC-B6 and AC-B8
  green, and AC-B1 at 84 and 83. NFR-20 and NFR-21 are met at D-229's margin, or HG-13 was raised and
  resolved. WU-30's report is committed.
- **M-12, Pipeline offline:** WU-43…WU-47. Exit: every AC-W of its units green (AC-W1…AC-W26 as built, the
  withdrawn ones aside, with AC-W2 (a)…(u); the target ACs and target clauses belong to M-14), and WU-47's
  recorded run produced every C-36 artifact under a temp guides root, in offline mode with no web tools
  (D-201), trade and poe.ninja disabled, prices `unavailable` (D-164, D-181), checkpoints answered by the
  coordinator (A-28), V1/V2 and the gates passing, V4 run with every open finding a known issue (D-268), and
  NFR-22 and NFR-23 read as D-270 says. **Status:** met on 2026-10-09 with recorded exceptions E1–E4, closed
  by the user's direction without a re-run (WL:799-826).
- **M-14, Open builds offline** (D-315; reached before M-13): WU-50…WU-62, amendments 2 and 3, WU-52
  withdrawn (D-335). Exit, the user's ruling (D-315): amendments 2 and 3 are built (WU-60…WU-62 for
  amendment 2, WU-50, WU-51 and WU-53…WU-59 for amendment 3), and their offline run with an open brief,
  WU-59, is recorded (like WU-47, amendment 3's N-8; A-33). Also, PROPOSED by the coordinator (2026-10-10;
  restated 2026-10-11 for D-335 and D-338): the amendment ACs as they now stand are green at the last merge:
  - slice 01: AC-K50, AC-K51, AC-K52, AC-K53…AC-K57 and AC-K58…AC-K65 (AC-K47…AC-K49 withdrawn, D-335);
  - slice 02: AC-P51…AC-P59;
  - slice 03: AC-W2 (v)…(ff) with its amended (b) and (l), AC-W27…AC-W33, AC-W11's reader-layer clause,
    and AC-W14 as reworded to D-264's re-check rule (AC-W5's target clause is withdrawn, D-335);
  - AC-B1…AC-B8, AC-B1 at 84 and 83 (D-335).
- **M-13, Alpha.** Reached when all of these hold (D-151):
  1. the M-10…M-12 and M-14 exits hold, and `mise run test` and `pnpm build` exit 0 (D-315);
  2. HG-14 was approved before the run started (trade; poe.ninja's economy endpoints need no approval,
     D-297, D-335);
  3. the live Titan / Blood Hunt run (WU-48), on the amended pipeline, produced its run folder with V1/V2
     and the gates passing, V4 run with every open finding a known issue, one loadout per stage in the PoB
     file, and an import code that round-trips (D-268, D-315);
  4. its run log shows NFR-22 and NFR-23 met, read as D-270 says;
  5. the user signs off in the work-log after playing the guide.

  Not in alpha: plugin packaging, per-agent engines, unique-jewel trade rows (D-151).

## 8. Work-unit graph (all slices)

Full blocks (kind, role, produces, consumes, acceptance) are in the slice specs. Edges are functional
dependencies; shared-file contention is handled by the serialized-wiring rule below. "Touches" lists
each unit's main files beyond its implied scope.

| WU | Title | Slice | Depends on | Touches | M |
|---|---|---|---|---|---|
| WU-30 | **Built.** Compile-time spike (gap 6's WU-S): S-a's recipe on a synthetic 15-stage plan; per-stage and whole-call times; decides `stages` semantics | 02 | — | `docs/build-guide/spikes/WU-30-compile-time.md` (new); probes only in temp dirs | M-11 |
| WU-31 | **Built.** K1: `lookup_game_data`; `search_tree_nodes` ascendancy filter and its two bugs (C-37, C-43) | 01 | — | `pob-api/API/Lookup.lua` (new), `BuildOps.lua` (`search_nodes`), `src/handlers/lookupHandlers.ts` (new), `luaHandlers.ts` (`search_tree_nodes`) | M-10 |
| WU-32 | **Built.** K2: `check_model_coverage` (C-38), with the server's name scan of PoB's source (D-226) | 01 | WU-31 | `pob-api/API/Coverage.lua` (new), `src/handlers/coverageHandlers.ts` (new), `src/engine/pobSourceNames.ts` (new), `tests/e2e/serverTools.test.ts` (new) | M-10 |
| WU-33 | **Built.** M1: per-skill and per-stat-set breakdown; the skill-part fix (C-44, C-45) | 01 | — | `BuildOps.lua` (`get_stats`, `set_main_selection`), `luaHandlers.ts` (`lua_get_stats`), `itemSkillHandlers.ts` (`set_main_skill`) | M-10 |
| WU-34 | **Built.** M2: ranker amendments (C-47) | 01 | WU-32 | `treeHandlers.ts`, `poe2SkillHandlers.ts`, `src/services/poe2SkillService.ts`, `BuildOps.lua` (`list_support_candidates`) | M-10 |
| WU-35 | **Built.** L1 sets: `manage_sets`, loadouts, the auto-level bridge flag (C-39, D-196) | 01 | WU-32 | `pob-api/API/Sets.lua` (new), `BuildOps.lua` (`set_level`), `src/handlers/setHandlers.ts` (new), `tests/e2e/serverTools.test.ts` | M-10 |
| WU-36 | **Built.** L1 tree state: `set_tree_state`; tree-jewel slots on `add_item`; the `update_tree_delta` fix (C-40, C-46, C-48) | 01 | WU-32 | `BuildOps.lua` (`set_tree`, `reimport_nodes`, `update_tree_delta`; `add_item_text` only if the jewel path needs it), `luaHandlers.ts` (`update_tree_delta`), `src/handlers/treeStateHandlers.ts` (new), `toolSchemas.ts` (`add_item`'s `slot_name` enum; not the shared `ITEM_SLOTS`, D-223), `tests/e2e/serverTools.test.ts`, `engineKinds.test.ts` and `toolHygiene.test.ts` (`$JEWEL_TEXT`) | M-10 |
| WU-37 | **Built.** Guides-folder root: env, default, path safety, Jest redirect (C-34 root rules, C-7, C-18) | 02 | — | `src/index.ts`, `createServer.ts`, `src/utils/guidesPath.ts` (new), `tests/setup/global.ts`, `tests/helpers/spawnServer.ts`, README env table | M-11 |
| WU-38 | **Built.** P1: plan schema, its committed reference and worked example, the ledger evaluator (C-30, C-31, C-32, C-33 ledger) | 02 | — | `src/plan/` (new), `docs/build-guide/plan-reference.md` (new), `tests/fixtures/plans/` (new) | M-11 |
| WU-39 | **Built.** C1 and E1 data files and their loader (C-35, A-30); the progress-key data (D-214) | 02 | WU-38 | `data/campaign/`, `data/enemies/` (new), `src/plan/referenceData.ts` (new), `src/plan/schema.ts` (the `progress` and `data:` checks), `tests/fixtures/plans/two-stage/plan.json` and `docs/build-guide/plan-reference.md` (their progress keys, D-214) | M-11 |
| WU-40 | **Built.** Import-code encoder and `encode_build_code` (C-42) | 02 | — | `src/utils/buildCode.ts`, `src/handlers/buildCodeHandlers.ts` (new), `engineKinds.test.ts` and `toolHygiene.test.ts` (test encoders replaced) | M-11 |
| WU-41 | **Built.** P2: the compiler, `compile_plan` (measure-only and final modes) and `guide_run` (run-folder and validate modes); compile record; the write ledger; ledger re-evaluation (C-33, C-41, C-50, D-207, D-208, D-211, D-216) | 02 | WU-30, WU-33, WU-35, WU-36, WU-37, WU-38, WU-39, WU-40 | `pob-api/API/Compile.lua` (new), `src/plan/compiler.ts`, `src/plan/record.ts` and `src/plan/writeLedger.ts` (new), `src/handlers/planHandlers.ts` (new), `src/server/toolRouter.ts` (the `guide_run` kind rule), `src/utils/guidesPath.ts` (D-220), `engineKinds.test.ts` and `toolHygiene.test.ts` (`$TWO_STAGE_PLAN`), `tests/fixtures/plans/` (the fifteen-stage fixture), `mise.toml` (`test` task) and `jest.config.cjs` (the NFR step, C-19); `buildFileWriter.ts` only if a new write kind is needed | M-11 |
| WU-42 | **Built.** V1 validity and V2 config checks inside compile (D-192) | 02 | WU-41, WU-39, WU-31 | `src/plan/checks/` (new), `src/plan/compiler.ts` (calls them), `Compile.lua`, `data/config-baseline.json` (new, D-230) | M-11 |
| WU-43 | **Built.** The skill and its runner (D-267): the roll check (D-238), the run folder, which `guide_run {new_run}` creates (D-207, D-216), the unsaved-build question (D-210), the run log (D-270), checkpoints (pre-supplied answers in offline mode only, A-28; research rounds, D-235; revisions, D-236, D-268), offline mode (D-201), retry caps and gate escalation (D-236, D-272), the pricing procedure over WU-49's dated outputs, the run checker (D-271); the early positive allowlist probe, which calls `lookup_game_data` (AC-W23) | 03 | WU-41, WU-49, WU-31 | `.claude/skills/build-guide/` (new), `tests/fixtures/pipeline/` (new) | M-12 |
| WU-44 | **Built.** Research: R1a lookup-only agents, R1b measure-only compile (D-208, D-311) and price, R1b-assemble | 03 | WU-43, WU-31, WU-32 | `.claude/agents/build-guide/` (researcher and coordinator, new), `.claude/skills/build-guide/` (R1 stage references, dossier template) | M-12 |
| WU-45 | **Built.** Design and write: D1, the D1 gate, D2, the D2 gate and final compile, W1 and the guide template (from ext §5) | 03 | WU-43, WU-34, WU-42, WU-44 | `.claude/skills/build-guide/` (D1, D1-gate, D2, D2-gate and W1 stage references, guide template), `.claude/agents/build-guide/` (writer, new; coordinator) | M-12 |
| WU-46 | **Built.** V4 claim verification: the verifier agent, its three lenses, the fix round and the re-check (D-268, D-264); V4 accepts `external-unavailable` only in offline mode (C-30) | 03 | WU-45, WU-44 | `.claude/agents/build-guide/` (verifier), `.claude/skills/build-guide/` (V4 stage reference, `SKILL.md`'s verification steps) | M-12 |
| WU-47 | **Built.** Offline end-to-end pipeline run, recorded on the single path, interactive, on Opus (D-181, D-201, A-28, D-263, D-274, D-275) | 03 | WU-44, WU-46 | none in the repo beyond the work-log; failures re-open the owning unit | M-12 |
| WU-48 | **Human:** the live Titan / Blood Hunt run on the amended pipeline, and the user's sign-off (D-315) | 03 | M-14 (WU-59); HG-14 | the user's guides and builds folders (coordinator and user only) | M-13 |
| WU-49 | **Built.** T1: dated price outputs on `get_item_price` and `search_trade_items` (date and league), no batch mode (D-224), the `[trade:<kind>]` error prefix on those two and `get_leagues` (D-218), within the limiter's existing windows (C-49, D-202) | 01 | — | `src/handlers/tradeHandlers.ts`; the trade fixtures in `tests/fixtures/` | M-10 |
| WU-50 | **Done** (`d16c16c`): S-N1 spike, blocked by poe.ninja's terms. Its report finds the builds and profiles API, and every other non-economy endpoint, closed to third-party use, so no tool and no threshold was settled; the user's D-335 resolves it, and the report stays as the record of the block. Five requests, all to public pages, none to an API endpoint | 01 | — | `docs/build-guide/spikes/WU-50-poe-ninja.md` (new); polite requests to poe.ninja only (§9) | M-14 |
| WU-51 | **Done** (`9f74ad9`). S-N2 spike: Full DPS compile cost with only the named groups included, on the fifteen-stage fixture (D-293, D-329): ×1.14, at most 3.08 s per stage, within NFR-21, so every compile computes it (D-337) | 02 | — | `docs/build-guide/spikes/WU-51-full-dps.md` (new); probes only in temp dirs | M-14 |
| WU-52 | *Withdrawn → D-335:* N-1, the poe.ninja tools (C-54) | 01 | — | *withdrawn → D-335* | — |
| WU-53 | **Built** (`25bde2a`). N-2: lookup additions (C-37, D-299), with engine tests | 01 | WU-60 (`Lookup.lua`, D-317) | `pob-api/API/Lookup.lua`, `src/handlers/lookupHandlers.ts`, `.claude/skills/build-guide/references/lookups.md`, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `contract.test.ts` | M-14 |
| WU-54 | **Built** (`92371c2`). N-3: coverage flags (C-38, D-300, D-336), with engine tests | 01 | — | `pob-api/API/Coverage.lua`, `src/handlers/coverageHandlers.ts`, `src/engine/pobSourceNames.ts` (the call names and skill-name templates), `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `contract.test.ts`; allowed by the coordinator: `check_model_coverage`'s description, `references/lookups.md`, the scan fake in `passiveUpgradesBound.test.ts` | M-14 |
| WU-55 | **Built** (`3fc1500`). N-4: plan schema and compiler: `count`, `countReason`, `customMods`; figure × count and custom-modifier marks in the record; `groupCount`; `includeInFullDPS` on the named groups in every compile (D-337); the plan checks; `plan-reference.md` (D-293, D-320…D-322) | 02 | WU-51 (done); WU-61 (merged: WU-55 extends its version bump, D-320) | `src/plan/schema.ts`, `compiler.ts`, `record.ts`, `checks/`, `pob-api/API/Compile.lua`, `BuildOps.lua` (`create_socket_group`), `docs/build-guide/plan-reference.md`, `tests/unit/planChecks.test.ts`, the compiler's engine tests, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `contract.test.ts` | M-14 |
| WU-56 | **Built** (`228bec1`). N-5: content: `references/patterns.md` v1, `templates/card-template.md`, the checklist in `references/stages/R1b.md` (D-290, D-291, D-292) | 03 | — | those three files, and `tests/static/buildGuidePipeline.test.ts` | M-14 |
| WU-57 | **Target.** N-6: the pipeline: the brief, the three phases and gates, R1a-assemble, cards, the checklist and probe budget (R1b's `writes`, D-338), Count in D1, the named damage source wording, and the poe.ninja rule: never contact pathofexile.com or poe.ninja yourself; there are no poe.ninja tools beyond the currency rates (D-285…D-301, D-319, D-323, D-335) | 03 | WU-55, WU-56, WU-62 | `.claude/skills/build-guide/` (`SKILL.md`, stage references, `references/`, templates), `.claude/agents/build-guide/` (the verifier's re-check line included, AC-W14), `tests/static/buildGuidePipeline.test.ts` | M-14 |
| WU-58 | **Target.** N-7: the run checker and the run log v3 (D-289, D-294, D-323, D-326) | 03 | WU-57 | `scripts/check-run.mjs`, `references/run-log.md`, `tests/unit/buildGuideCheckRun.test.ts`, `tests/fixtures/pipeline/` | M-14 |
| WU-59 | **Target.** N-8: the offline end-to-end run with an open brief, recorded as WU-47 was (A-33) | 03 | WU-51, WU-53…WU-58, WU-60…WU-62 | none in the repo beyond the work-log | M-14 |
| WU-60 | **Built** (`fdcf6a7`). Amendment 2's lookup: a mod hit lists the base types that can roll it (non-zero spawn weights, only on the tables PoB rolls), and essences are a fifth mechanic kind (D-277) | 01 | — | `pob-api/API/Lookup.lua`, the lookup handler, `.claude/skills/build-guide/references/lookups.md`, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `contract.test.ts`; serialized, beyond its touches: `toolSchemas.ts`' `kind` enum, the README row, `tool-calls.json` | M-14 |
| WU-61 | **Built** (`74c5745`). Amendment 2's plan changes: the `entering-maps` variant, plan `schemaVersion` 2, and the ladder track in V1 (D-281, D-282, D-320, D-332) | 02 | — | `src/plan/schema.ts`, `src/plan/checks/v1.ts`, `docs/build-guide/plan-reference.md`, `tests/unit/planChecks.test.ts` | M-14 |
| WU-62 | **Built** (`14f3553`). Amendment 2's pipeline: the guide template and `audit.md`, W1, V4's lenses, D1's `m` rung, D2, the gates, the checker's guards (D-276…D-283) | 03 | WU-61 | `.claude/skills/build-guide/` (templates, `audit-template.md` new, stage references, `references/`, `SKILL.md`, `scripts/check-run.mjs`), the pipeline tests and fixtures | M-14 |

**Critical path** (by unit count): WU-31 → WU-32 → WU-35 (or WU-36) → WU-41 → WU-43 → WU-44 → WU-45 →
WU-46 → WU-47, all built. From there (D-315): WU-61 → WU-62 (both built) → WU-57 → WU-58 → WU-59 (M-14)
→ WU-48 (M-13). WU-51 (done) → WU-55 and WU-56 (built) also feed WU-57. WU-50 feeds nothing: its report
records the block, and D-335 withdrew WU-52 and the popularity threshold (D-324).

**Parallel lanes:** the first wave is WU-30, WU-31, WU-33, WU-37, WU-38, WU-40 and WU-49. Then WU-32
(after WU-31) and WU-39 (after WU-38); then WU-34, WU-35 and WU-36 (after WU-32). All join at WU-41
except WU-34, which joins at WU-45, and WU-49, which joins at WU-43. WU-31 also feeds WU-43 directly,
because WU-43's early allowlist probe (AC-W23) calls `lookup_game_data`. After WU-41, WU-42 runs
alongside WU-43 → WU-44. In slice 3, WU-44 → WU-45 → WU-46 ran in series, because they share
`SKILL.md`, `build-guide-coordinator.md` and the pipeline tests.

**Amendment lanes** (M-14): wave A was WU-50, WU-51, WU-54, WU-56, WU-60 and WU-61, independent and started
together; wave B was WU-53 (after WU-60: both edit `Lookup.lua`, D-317), WU-55 (after WU-51) and WU-62
(after WU-61). WU-55 and WU-61 both change the plan schema: WU-61 merged first and made the version bump,
which WU-55 extends (D-320). WU-57 waits for WU-55, WU-56 and WU-62 (it edits WU-62's verdict line and
template, D-317); it no longer depends on WU-50 or WU-52 (D-335). WU-58 follows WU-57; WU-59 runs last.
Built or done: WU-50, WU-51, WU-54, WU-56, WU-60, WU-61, WU-62. Withdrawn: WU-52.

**Serialized-wiring rule** (as stab §8). These files are shared:
- `src/server/toolSchemas.ts`, `toolMeta.ts`, `toolRouter.ts`; the README tool table (always regenerated
  with `pnpm docs:tools --write`, never hand-edited);
- `tests/fixtures/tool-disposition.json`, `tests/fixtures/tool-calls.json`; the hygiene allowlist and
  the cruft waivers (both stay `[]`);
- every count site in §1.3;
- `src/index.ts`, `src/server/createServer.ts`, `src/utils/contextBuilder.ts`, `src/utils/buildCode.ts`,
  `src/handlers/luaHandlers.ts`;
- `src/pobLuaBridge.ts`, `src/engine/schemas.ts`, `pob-api/API/Handlers.lua`, `pob-api/API/BuildOps.lua`,
  `tests/integration/contract.test.ts`;
- `tests/integration/engineKinds.test.ts`, `tests/integration/toolHygiene.test.ts` (their `PLACEHOLDERS`
  maps gain `$JEWEL_TEXT` in WU-36 and `$TWO_STAGE_PLAN` in WU-41; WU-40 replaces their test encoders);
  `tests/e2e/serverTools.test.ts` (WU-32 creates it; WU-35 and WU-36 extend it);
- `tests/setup/global.ts`, `tests/helpers/spawnServer.ts`;
- for the amendment units: `pob-api/API/Lookup.lua` (WU-60, then WU-53); `src/plan/schema.ts`,
  `src/plan/checks/v1.ts` and `docs/build-guide/plan-reference.md` (WU-55, WU-61); and the skill's
  `SKILL.md`, `scripts/check-run.mjs`, `templates/guide-template.md`, `build-guide-coordinator.md` and the
  pipeline tests (WU-62, WU-57, WU-58, in that order).

Edits to these are short wiring steps, merged one unit at a time in DAG order; concurrent units rebase
before merging. The tool-adding units are WU-31, WU-32, WU-35, WU-36, WU-40 and WU-41; WU-41 adds two
(`compile_plan` and `guide_run`). Each one moves every count site from its rebased base by its own new
tools (+1 each) in the same merge, and regenerates the README table. After WU-41: 84, and 83 without
poe.ninja. No amendment unit adds a tool: WU-52, which would have added the poe.ninja tools, is withdrawn
(D-335), so the counts stay 84 and 83. WU-60 and WU-53 change `lookup_game_data`'s `kind` enum and
description and regenerate the README table, adding no tool. WU-49 changes three existing trade
tools (the two price tools' outputs, and the error prefix on those and `get_leagues`) and adds none, so it
moves no count and changes no tool schema (D-224); any `tool-calls.json` sample it adds is serialized like
the others, and it regenerates the README table if a description changes. New Lua goes in new modules
registered by one line in `Handlers.lua`, as `Trade.lua` is, so `BuildOps.lua` edits stay inside the
functions a unit names.

**Dependency rule.** No unit changes `package.json` dependencies or the lockfile (HG-10).

**Implied scope.** A unit's touches also include its own new files, the tests its ACs name, and the
existing tests of modules it changes.

## 9. Operational guardrails

- **Budget and loop guard.** One unit per agent context. The same gate-failure signature 3 times in a row
  → stop with `blocked:loop` and the failing output. A unit that needs a file owned by an unmerged unit
  stops and reports.
- **Secrets and identity.** Never read, print, grep, cat, source or copy `.env`; never set `POESESSID`;
  worktrees have no `.env`. No name or email in any request, fixture or file content except git
  authorship. The User-Agent is D-25's.
- **Network during the build.** GitHub (`mise run pob:fetch`) and the npm registry, and poe.ninja's
  documented economy endpoints at a polite rate (serial requests, back-off on HTTP 429, nothing fetched
  twice that a cache could hold) (D-297, as D-335 restates it). Never poe.ninja's builds, profiles or
  character API, which its terms close to third parties (D-335); never pathofexile.com, a request carrying
  a cookie or personal data, or any other host (D-34, HG-1 and D-201, as D-297 amends them). Tests reach
  HTTP only through `fixtureFetch` (D-34 unchanged for tests).
- **No headless sessions** for pipeline runs: they are interactive sessions the user starts (D-263).
- **Filesystem.** Write only inside your worktree and temp dirs. Never touch `/mnt/c/...`: the user's
  builds folder and the default guides folder are there (HG-6). Probes that start the server or engine
  run from `mktemp -d`, with `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY` at temp dirs.
  Every builds-folder write goes through `buildFileWriter` (C-17).
- **The M-12 run** uses its own server instance: temp `POB_DIRECTORY`, `XDG_STATE_HOME` and
  `POB_GUIDES_DIRECTORY`, `POE_TRADE_DISABLED=true`, `POE_NINJA_DISABLED=true`, web tools denied, and the
  skill in offline mode (D-201) with the coordinator's pre-supplied checkpoint answers (A-28). Never the
  user's registered `pob2` server.
- **Pipeline runtime rules** (M-13 and after): trade and poe.ninja only through the server, from the one
  coordinator (D-112, D-130); research and V4 agents get lookup tools only, never trade or mutating
  tools (D-178, D-231, A-24), and no agent gets a poe.ninja tool beyond the coordinator's
  `get_currency_rates` (D-335); agents
  write only in the current run folder (D-177); the R1b compile and the D1 and D2 gates retry at most
  twice, then the gates escalate, and verification never escalates (D-127, D-268, D-272); fan-out ≤ 3
  (D-161, D-267); fetching patch notes from pathofexile.com needs the user (D-139).
- **Worktrees and commits (D-48).** Bootstrap with `mise trust && pnpm install --frozen-lockfile && mise
  run pob:fetch`, then `git config --worktree commit.gpgsign false`. Commit, rebase, merge, cherry-pick
  and revert with `-c commit.gpgsign=false`; messages `<type>(WU-nn): <what>` with the build handoff's
  `Co-Authored-By` line. Never push; the coordinator sign-rebases with the user (HG-8). Don't use the
  Serena tools (one shared instance points at the wrong checkout).

## 10. Risk register

| ID | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R-20 | Compile time against the 30 s request timeout and Claude Code's 120 s backgrounding | medium / high | WU-30 first, at D-229's 20 s margin; one request per stage plus a fixed overhead (D-221); `stages` subsets (D-156); HG-13 |
| R-21 | Weak concepts for off-meta pairings | medium / medium | Checkpoint 1; D-141 failure paths; first-run measurement (D-127) |
| R-22 | PoB modelling gaps (12.9% of unique lines, ~30% of keystones, 32% of ascendancy notables, ~48.5% of supports) | certain / high | C-38 flags; the ledger; V4 (D-179); C-47's unmeasurable lists |
| R-23 | K2's heuristics misreport ("possibly unread", "possibly unmodelled"; Ancestral Call was a false positive of the raw test) | medium / medium | Statuses say "possibly"; PoB's own red-tooltip rule (pin §D calibration); the concatenation templates (D-243); V4 checks every claim (D-268) |
| R-24 | Trade limits shared with the user's account | medium / high | Paced pricing (D-160); one coordinator; prices kept in the plan; HG-14 |
| R-25 | 1.0 on 2026-12-11 ends both leagues: a guide lives about nine weeks; the pin is 0.5.4 while live is 0.5.5 | certain / medium | D-107's version statements; D-139 regeneration; HG-11 |
| R-26 | *Closed → D-267:* the Workflow tool is unavailable, or can't pause for a pick. There is no Workflow path | — | — |
| R-27 | Tool-surface token cost | certain / low | Extend existing tools where natural and group new ones (D-173, D-316); 7 new tools (D-216), and no poe.ninja tool added (D-335) |
| R-28 | Regressions in existing tools from `BuildOps.lua` edits (rankers, tree, main skill) | medium / high | AC-B3, AC-B5; contract tests; AC-E39 kept; existing tool tests stay |
| R-29 | `{id}` loadout hazards: `CopyLoadout` crashes; `#sets+1` ids collide after a delete | certain / medium | No `CopyLoadout` (D-103); no delete in C-39; `SyncLoadouts` before lookups |
| R-30 | The guides folder sits on case-insensitive drvfs (`/mnt/c`); traversal and symlink escapes | medium / medium | C-34's resolve-and-contain rule; AC-B8 tests with symlinks and `..` |
| R-31 | Low-confidence enemy data (Arbiter fight life, interlude levels) misleads | high / medium | Confidence stated (C-35); time-to-kill reported as a range, never gated (D-116, A-30) |
| R-32 | PoB's Full DPS mode breaks the compile limits: 160.68 s for 15 stages with every group on, one stage 25.50 s, against NFR-20 and NFR-21 | high / high (PROPOSED); mitigated by S-N2 | The record applies Count itself; only the named source's groups go in Full DPS (D-293, D-306 narrowed). S-N2 (WU-51) measured that at ×1.14 of the whole call, at most 3.08 s per stage and 31.92 s per call quiet, so every compile computes it (D-337); with every group on, through the real compiler, 61–67 s, so R-32's 160.68 s came from WU-30's emulation under load |
| R-33 | Count also multiplies reservation (skills reserved per copy, totems with Ancestral Bond) and scales Umbral Well buffs | medium / medium (PROPOSED) | D1 checks reservation and buffs after setting Count on such a group (D-293) |
| R-34 | Effective HP misleads: it depends on the assumed enemy damage and misses defences PoB doesn't model | medium / medium (PROPOSED) | Shown beside max hit, never alone; max hit stays the basis of the survival verdict; figures computed with custom modifiers are marked (D-294) |
| R-35 | poe.ninja's terms and limits. Realized: S-N1 (WU-50) found its builds, profiles and character API closed to third parties, so no player evidence can come from it; its guidelines publish no rate limit and block misbehaving clients, and the stabilization grounding had already quoted the clause (`docs/stabilization/grounding/ctx-external.md:182-183`) | certain / medium (realized) | D-335: no player-evidence tools; only the documented economy endpoints (C-12's currency rates, polite development queries: serial, back-off on 429, cached); `--no-ninja`, `--offline` and `POE_NINJA_DISABLED`; tests offline (D-34, D-297) |
| R-36 | Amendment 2's lighter verification loses precision: V4's comparison of guide numbers with the record becomes prose-lens judgment, except the verdict lines; "each caveat once" undoes claim rule 3; the headline quotes PoB's figure for the stat set the file opens on | certain / medium (PROPOSED) | The checker's fixed-form verdict lines (D-283); the user's review at the final gate |
| R-37 | The entering-maps rung is more than an enum value: the checker keys area level and budget on `'budget'`, the ladder track can move fixture verdicts, and D1 designs a third rung | medium / medium (PROPOSED); mitigated | WU-61's and WU-62's tests; rebuilt pipeline fixtures (D-281, D-282). Built: no fixture verdict moved with the ladder track, and the checker maps `entering-maps` to area 69 and takes the first rung by rung order |
| R-38 | Trial 1's progress key lets an end-of-Act-1 stage spend 2 ascendancy points, with no level check to catch it (WL:201-202) | medium / low (PROPOSED) | None recorded; open |
| R-39 | V1's `resistance-penalty` accepts only the two boundary values (D-251), so a stage in an area-60 interlude zone before the first interlude key is an edge case (WL:338-339) | low / low (PROPOSED) | None recorded; open |

## 11. Migration and compatibility

- **Backward compatibility.** The 77 tools keep their contracts except C-43…C-49, each with its
  compatibility note in §3.2; nothing is removed or renamed, and default outputs stay, so the golden
  values hold (AC-B5). Env: `POB_GUIDES_DIRECTORY` is added (WU-37). Bridge: additive actions and params,
  plus one internal param rename (D-222). `mise run test` gains a separate NFR step (C-19).
- **Data.** No migration. New `data/` in the repo; the guides root is created by the first run; the state
  dir gains the write ledger at the first final compile (D-211). The run log moved from schema version 1
  to 2 (D-270) and moves to 3 with WU-58 (D-289); the checker accepts versions 2 and 3, so recorded runs
  still check (D-326). The plan's `schemaVersion` moved to 2 with WU-61 (D-320), and the record's
  `recordVersion` moves to 2 with WU-55 (D-321); version-1 plans stay accepted (D-332).
- **Pipeline files.** `.claude/workflows/`, the workflow harness, `references/fallback.md` and the
  provenance agent were deleted by amendment 1 (D-267).
- **Stabilization docs.** C-1's count and D-65's text are corrected in the stab spine by the coordinator
  at ratification (D-198).
- **Cutover.** Each unit is one merge on the epic's integration branch; roll back by reverting it.

## 12. Test and verification strategy

**Test classes.** The stab spine's classes apply unchanged (unit, in-process MCP, engine-required,
Lua-direct, stdio e2e, static, script check, human), with the same allowed fakes and the fidelity rule.
This epic adds:

| Class | Where | Covers | Runs in |
|---|---|---|---|
| Plan fixtures | `tests/fixtures/plans/` with engine-required tests | C-31…C-33, C-41, C-50: the two-stage plan (M-11), schema and per-stage errors, idempotence, the write ledger | `mise run test`; the fifteen-stage NFR test in its separate `--runInBand` step (C-19) |
| Static (pipeline files) | `tests/static/` over `.claude/skills/build-guide/` and `.claude/agents/build-guide/` | the skill names the four agent types and every step's type (D-267); allowlists name no trade or mutating tool outside the coordinator (D-178), and no poe.ninja tool beyond the coordinator's `get_currency_rates` (D-335) | `mise run test` |
| Pipeline run | WU-47, recorded in the work-log with the run-folder listing; *target:* WU-59, recorded the same way with an open brief (A-33) | C-36 end to end, offline | the coordinator; an independent verifier checks the record |
| Human | WU-48 | the live run and play-test | the user |

**Unit gate.** Stab §12's five checks, by an independent verifier, with this spine's touches and wiring
list.

**Regression coverage for existing behaviour.** The existing suites stay and must pass unchanged except
for the count literals (§1.3): golden and hygiene tests, `engineKinds.test.ts`, `contract.test.ts`, the
README table test, the static scans, the ranker tests (AC-E39 order), and the fresh-clone check.

**Cross-cutting acceptance criteria** (owned here; slices cite them):
- **AC-B1 (tool surface).** After WU-41, `tools/list` returns 84 tools with every group enabled and 83
  with `POE_NINJA_DISABLED=true`; the set equals `tool-disposition.json`'s non-delete, non-pending names;
  the README table has 84 rows equal to `pnpm docs:tools` output. At each earlier tool-adding merge the
  same holds for that merge's count. The counts stay 84 and 83 through M-14: D-335 withdrew the poe.ninja
  tools (C-54, WU-52), so no unit restates them.
- **AC-B2 (hygiene).** At every unit gate, `tool-hygiene-allowlist.json` and `poe1-cruft-waivers.json`
  are `[]`. Every new tool has at least one `expect:"ok"` sample, a description of ≤ 2048 chars, and
  passes the output-text checks. The cruft, advice-threshold, `deletedPlumbing` and dead-module scans
  pass.
- **AC-B3 (engine kinds).** For every ok sample of a new or amended engine tool, a `read` tool leaves the
  canonical export identical and `revision` unchanged, and a `mutate` or `load` tool changes both.
  This includes `lua_get_stats` breaking down a non-main stat set, `lookup_game_data` (D-176), and both
  `guide_run` modes; its run-folder mode also never starts the engine (D-216).
- **AC-B4 (wire contract).** Every new Lua action has a C-5 schema, a typed bridge wrapper and a
  `contract.test.ts` case, added in the same merge.
- **AC-B5 (golden).** The 109 `PlayerStat` pairs, `golden-stat-fields.json`, CombinedDPS 104489.78 and
  the fresh-clone Life 2,977 are unchanged.
- **AC-B6 (offline harness).** Jest's `globalSetup` points `POB_GUIDES_DIRECTORY` at a fresh temp dir,
  `spawnServer` passes it explicitly, only `src/index.ts` reads it, and no test sends HTTP outside
  `fixtureFetch`.
- **AC-B7 (dependencies).** `package.json`'s dependency sections and `pnpm-lock.yaml` are byte-identical
  to the epic's base commit at every unit gate.
- **AC-B8 (write roots).** `guide_run` writes only the run folders it creates (D-207, D-216).
  `compile_plan` writes only files beside the plan inside the guides root, the target PoB file (through
  C-17; never in measure-only mode, D-208) and that file's write-ledger entry in the state dir (D-211).
  A `plan_path` that escapes the root (by `..`, an absolute path, or a symlink resolving outside), a
  `new_run` slug that isn't one safe path segment, or a guides root overlapping the builds folder
  (D-220) is `isError`, and nothing is written.

**Non-functional requirements:**

| NFR | Threshold | Condition | Owner |
|---|---|---|---|
| NFR-20 | A 15-stage plan compiles in ≤ 100 s, one call (D-159, D-229) | this machine, vendor pin; the test runs alone, in `mise run test`'s `--runInBand` step (C-19) | WU-30 measures; an AC-P asserts |
| NFR-21 | Every per-stage engine request finishes in under 20 s, a third below the 30 s request timeout (D-47, D-156, D-229) | the same plan | AC-P |
| NFR-22 | Zero 429 responses and zero `locked_out` refusals during pricing (D-160) | the M-13 live run, from its run log: no pricing step's `priceOutcomes` counts a `rate_limited` or `locked_out` call (D-218, D-270) | AC-W, WU-48 |
| NFR-23 | ≤ 3 concepts per research round, 3 V4 lenses per pass, ≤ 2 counted retries per gate, fan-out ≤ 3 (D-127, D-161, D-235, D-267, D-272). *Target (WU-57, WU-58; D-287):* per brainstorm round ≤ 3 R1a researchers and one R1a-assemble, 6–9 cards dealt; per verification round ≤ 3 cards compiled. The probe budget, up to 4 one-stage variants per card, is D-292's separate rule, not an NFR-23 cap | any run, from its `stages[]` and the session transcript (D-270) | AC-W |
| NFR-24 | *Withdrawn → D-316:* the numeric cap on new tools is lifted | — | — |

## 13. Constraints and non-goals

**Constraints:**
- **The stab spine's §13 holds:** Node 24, pnpm 11.6.0, LuaJIT via mise; SDK 1.20.2; zod 3; PoB2
  v0.23.1 read-only (game 0.5.4 data); text-only tool output (D-36); code under `~/projects/pob2-mcp`.
- **No new dependencies** (HG-10): no YAML parser, no runtime JSON-Schema validator, no expression
  library.
- **PoE2 only**, bound to the pin.
- **The ten constraints D-105…D-114**, and the standing rules: no secrets in files, logs or argv; trade
  and poe.ninja only through the server; builds-folder writes only through `buildFileWriter`; no network
  in tests; no agent reads `.env`.
- **Cost is a stated concern:** fan-out stays within D-127 and D-161. *Target (WU-57, D-287):* a concept
  the user doesn't want stops at a gate before finalization.

**Non-goals** (design): dedicated boss-killer builds; an encounter-specific target input; live tracking
of the player's character; an in-game overlay or automation; hosting or publishing guides; re-checking
guides after game patches; PoE1; perfect simulation (hand calculations are accepted and labelled). From
amendment 3 (D-302): an interaction database or graph; hunting for undocumented interactions; modelling
mechanics in Lua beyond Count and custom modifiers, or patching `vendor/`; scoring candidates by formula;
required gates from the verification checklist. Also out of this epic: plugin packaging, per-agent
engines, unique-jewel trade rows (HG-15), a pin bump (HG-11), the pipeline's own price cache (D-169), and
the deferred items: the vendor search regex (HG-19), rolls above the data range (HG-20), finalizing
non-skill damage sources (HG-21) and a trade-link field (HG-22).
