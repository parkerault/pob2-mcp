# Slice 04: Advice on engine data, docs and setup, human acceptance

Part of the [spec spine](README.md). It covers work units WU-18…WU-21 and acceptance criteria
AC-A1…AC-A6 and AC-G1…AC-G6.

## 1. Existing system context (this slice)

Citations are in [recon §4, §8](../recon.md) and [grounding/ctx-lua.md](../grounding/ctx-lua.md) §4.2, §4.9.

- **Advice tools hard-code PoE1-era judgments.**
  - **`validate_build`** has two paths.
    - The Lua path insists on "aim 4000+" life (`validationHandlers.ts:173`). It scans only `Flask*` for
      freeze immunity (`:69-78`), which yields a false "No Freeze Immunity" for a build wearing a Bright
      Thawing Charm.
    - The XML path (`validationService.ts`) gives PoE1 flask, suppression and Precision advice, and reads
      `ESRecharge` instead of `EnergyShieldRecharge` (`:436`). Its `validateDamageScaling` is called at
      `:30`.
  - **`analyze_defenses`** shows Life where EHP belongs (E7). It uses hard-coded armour/evasion bands
    (`defensiveAnalyzer.ts:291-305`) and suggests PoE1 nodes and flasks.
  - **`get_build_issues`**, and the "Top Issues" in `lua_load_build`'s summary, have four defects:
    - E8 "89 jewel sockets";
    - a 5-flask assumption;
    - PoE1 "24 quest points";
    - reads of fields the bridge never returns.
- **Direct engine loads.** `validate_build` and `analyze_defenses` given a `build_name` load it
  directly over the engine's build. From WU-08 the session's load guard makes them return `isError`
  until this slice switches them to `withTemporaryBuild` (D-51f).
- **What the engine provides** (ctx-lua §4.2, §4.9).
  - **Warnings:** `build.controls.warnings.lines` holds PoB's own warnings: unmet attribute requirements,
    unreserved Life/Mana/Spirit below zero, too many points, gem-group limits, and so on. It is rebuilt
    only by `build:RefreshStatList()`. That also sets `characterLevel` when `characterLevelAutoMode` is
    on. Loading a build runs it (`Build.lua:583-584`); bridge mutations don't (they only call
    `BuildOutput`).
  - **Outputs:** `Missing<Elem>Resist`, `<Type>MaximumHitTaken`, `<Type>EnemyDamage`, `TotalEHP`,
    `PhysicalDamageReduction`, `EvadeChance`, `DeflectChance` and `EffectiveBlockChance` exist. **No
    `<Elem>ResistMax` exists.**
- **Docs.**
  - The README claims 91 tools, documents removed and unregistered tools, and has PoE1 content and stale
    install steps.
  - `HANDOFF.md` and `docs/*.md` are stale or inherited from PoE1: `OPTIMIZE_TREE_GUIDE.md`,
    `POB_BRIDGE.md`, `QUICKSTART.md`, `QUICK_REFERENCE.md`, `ROADMAP.md`, `SUGGEST_OPTIMAL_NODES_GUIDE.md`,
    `TESTING_GUIDE.md`, `TRADE_API_QUICKSTART.md`.
  - There is no project `CLAUDE.md`.

## 2. Functional requirements

- **FR-A1 (D-3, D-30).** `validate_build`, `analyze_defenses` and `get_build_issues` (and the load
  summary's "Top Issues") judge a build only by:
  - (a) PoB's own warnings;
  - (b) `Missing<Elem>Resist > 0`;
  - (c) per damage type, `<Type>MaximumHitTaken < <Type>EnemyDamage` for the configured enemy.

  They may also state engine facts: values, and empty visible gear slots. They contain no thresholds or
  advice of our own. A `build_name` other than the loaded build is analysed with `withTemporaryBuild`
  and never replaces the engine's build.
- **FR-G1.** The README matches the server: the tool table is generated from the registry, and setup,
  registration, configuration (cookie, league, builds folder, state folder), the gate, and GGG's
  third-party notice are documented.
- **FR-G2.** Stale docs are gone. A project `CLAUDE.md` carries the tooling cautions every future session
  needs.
- **FR-G3.** A fresh clone becomes a working server by the documented steps, and that is checked by a
  script that makes no request to the trade site or poe.ninja.

## 3. Interface contracts touched

- **C-2/C-5 (extended):** a new Lua action `get_warnings` → `{id, ok:true, result:{lines: string[]}}`.
  It runs `build:RefreshStatList()` and restores `characterLevel` and `characterLevelAutoMode` to their
  previous values (the restore re-runs `configTab:BuildModList()` if they changed). It is engine kind
  `read`, and its schema and contract-test case land with it.
- **C-1 (descriptions):** the descriptions of the three advice tools state what they judge (FR-A1) and
  that the judgments are PoB's.

## 4. Work units

### WU-18: Advice on engine data
- kind: build
- depends-on: [WU-11, WU-13]
- role: backend-dev + lua-dev
- touches: [`pob-api/API/BuildOps.lua` + `Handlers.lua` (`get_warnings`), `src/engine/schemas.ts`, `src/pobLuaBridge.ts` (wrapper), `tests/integration/contract.test.ts` (`get_warnings` case), `src/advice/judge.ts` (new: a pure judgment function), `src/handlers/validationHandlers.ts`, `src/services/validationService.ts` (the XML path removed), `src/handlers/optimizationHandlers.ts` (`analyze_defenses`), `src/defensiveAnalyzer.ts` (reduced to formatting, or removed), `src/handlers/buildGoalsHandlers.ts`, `src/handlers/luaHandlers.ts` (load summary uses `judge`), `src/server/toolSchemas.ts` (the three descriptions; `analyze_defenses` `build_name` optional), `tests/unit/validationService.test.ts` (rewritten or removed)]
- produces: [`get_warnings`, `judge(stats, warnings, items) → Issue[]`]
- consumes: [C-3, C-4, C-5]
- acceptance: [AC-A1, AC-A2, AC-A3, AC-A4, AC-A5, AC-A6]
- milestone: M-3
- summary: Replace the three advice tools' logic with one pure `judge()` over engine outputs and PoB
  warnings (FR-A1).
  - `validate_build` gets one engine-backed path.
  - `analyze_defenses` reports engine values and the judge's issues. Its `build_name` becomes optional,
    defaulting to the loaded build (D-51a).
  - Both use `withTemporaryBuild` for another build, which removes WU-08's interim allowlist entries.
  - The load summary's "Top Issues" uses the same `judge`.
  - Delete the XML path (including `validateDamageScaling`) and all PoE1 advice text.
  - Remove these tools' hygiene allowlist and cruft-waiver entries.

### WU-19: Docs, setup, README tool table, fresh-clone check
- kind: build
- depends-on: [WU-23, WU-18, WU-12]
- role: docs + build-infra
- touches: [`README.md`, `HANDOFF.md` (deleted), `docs/*.md` except `docs/stabilization/**` (deleted), `CLAUDE.md` (new), `scripts/gen-tool-table.mjs` (new), `scripts/fresh-clone-check.sh` (new), `scripts/fresh-clone-check.mjs` (new; the MCP client the shell script runs), `package.json` (scripts only: `docs:tools`), `tests/static/readme.test.ts` (new), `tests/fixtures/tool-hygiene-allowlist.json` and `tests/static/poe1-cruft-waivers.json` (must end empty)]
- produces: [the generated tool table, the fresh-clone check]
- consumes: [C-1, C-8, C-19]
- acceptance: [AC-G1, AC-G2, AC-G3, AC-G4, AC-G5, AC-G6]
- milestone: M-3
- summary: Rewrite the README around the current server. The tool table is generated from `TOOL_META`
  plus the schemas. The README covers setup, registration (D-16), configuration, the gate, the third-party
  notice (D-41) and a marked migration block (spine §11).
  - Delete the stale docs.
  - Add the project `CLAUDE.md`.
  - Add the scripted fresh-clone check.
  - Confirm the hygiene allowlist and the cruft waivers are empty.

### WU-20: Human live smoke (alpha)
- kind: build (human gate)
- depends-on: [WU-22, WU-23]
- role: **user** (HG-9), assisted by the coordinator
- touches: [the work-log only; the user's Claude Code config (registration)]
- produces: [the alpha sign-off record]
- consumes: [C-1, C-14, C-17, D-16]
- acceptance: [the WU-20 checklist below]
- milestone: M-α
- summary: Register the server with the D-16 command and run the checklist with the user's real cookie,
  build and PoB2 on Windows. The coordinator records the results, and any newly observed trade2 or
  poe.ninja behaviour, in the work-log. A contradiction with a contract or assumption → HG-5.

**WU-20 checklist.** Each item is recorded pass or fail, with a note.

1. `mise trust && mise run setup` in `~/projects/pob2-mcp`, then the D-16 `claude mcp add` command. In a
   new Claude Code session, `/mcp` shows `pob2` connected, with 76 tools.
2. "Load my Grenadator build": `lua_load_build` reports `Build: Grenadator`, and its Life matches the
   `<PlayerStat stat="Life">` value in the live file at that moment.
3. `find_upgrades` for `Body Armour` with a budget in exalted and defaults otherwise returns ranked
   listings or "No upgrade within budget" within 90 s. Every listing has a `Buy:` line and item text.
   Record the output's size in characters, and its token count if the client shows it.
4. Open one exact-item link in a logged-in browser. It shows that listing; this verifies D-39 and the
   `poe2` realm path. Optionally, try the offline search-id form of the same query and record whether it
   resolves.
5. Temporarily blank `POESESSID` in `.env`, then call `find_upgrades` again. The result is "Trade search
   not run", with a link that opens the same weighted search when logged in. Restore the cookie without
   restarting, and confirm the next call searches (C-9 re-read).
6. Change something in PoB2 on Windows (e.g. a gem level) and save. On the next engine call Claude
   reports `Reloaded Grenadator.xml`, and the reloaded engine shows the Windows-side change (D-19, A-11).
7. Ask Claude to change something and save **over** the build (`overwrite: true`). Re-open in PoB2: the
   change is visible, and the save message said "re-open it there" (C-17). Then save from PoB2 again,
   and confirm Claude's next save to `grenadator` (lower case) is **refused** as "changed on disk"
   (D-52).
8. `import_build` from a pobb.in URL succeeds (A-15).
9. The work-log records:
   - the observed rate-limit rules and states;
   - poe.ninja rates present for the league (A-7);
   - any 429, expired-cookie or over-complexity response seen.

### WU-21: Human final acceptance
- kind: build (human gate)
- depends-on: [WU-19, WU-20]
- role: **user** (HG-9)
- touches: [the work-log]
- produces: [the Done sign-off]
- consumes: [everything]
- acceptance: [the WU-21 checklist below]
- milestone: M-3
- summary: Run the final check on the finished server.

**WU-21 checklist.**
1. `scripts/fresh-clone-check.sh` exits 0 on the user's box.
2. The README instructions alone get a fresh clone to a working registration.
3. Spot-checks of `validate_build`, `analyze_defenses`, `get_build_issues`, `suggest_supports`,
   `get_passive_upgrades` and `compare_builds` on the user's build read as PoE2-correct to the user.
4. The user signs off Done in the work-log.

## 5. Acceptance criteria

**Advice on engine data (WU-18)**

- **AC-A1 (WU-18).** Engine-required.
  - On the golden build (`characterLevelAutoMode="false"`), `get_warnings` returns a string array, and
    `characterLevel` stays 90.
  - **Auto-level case.**
    1. Load a fixture copy with `characterLevelAutoMode="true"`.
    2. Remove 5 allocated non-ascendancy nodes with `update_tree_delta`. This doesn't run
       `RefreshStatList`, so PoB's estimate now differs from the level.
    3. Call `get_warnings`.

    Both `characterLevel` and the auto-mode flag are unchanged (read through `get_build_info` and a Lua
    query).
  - **Str case.** A committed fixture copy of the golden build is edited so its Strength falls below
    the Strength requirement of one equipped item or gem. A comment in the fixture's README names the
    edit and the requirement it breaks. `get_warnings` on it yields a line matching
    `/do not meet the Strength requirement/`.
- **AC-A2 (WU-18, D-30).** Unit tests on `judge()`.
  - (a) With all `Missing*Resist` = 0, each `<Type>MaximumHitTaken ≥ <Type>EnemyDamage`, and no
    warnings, it returns `[]`.
  - (b) `MissingColdResist = 12` returns exactly one resist issue naming Cold and 12.
  - (c) `FireMaximumHitTaken = 1500` with `FireEnemyDamage = 2000` returns exactly one max-hit issue
    naming Fire, with both numbers.
  - (d) Each PoB warning line becomes one issue whose text is that line.
  - (e) An empty shown gear slot becomes one informational fact, not a judgment.
  - **Static check:** none of the advice files (`src/advice/`, `validationHandlers.ts`,
    `optimizationHandlers.ts`, `buildGoalsHandlers.ts`, `defensiveAnalyzer.ts` if kept) matches any of
    these patterns (case-insensitive, `rg -i -w` where a word boundary matters): `4000`, `\baim\b`,
    `Constitution`, `Heart of Oak`, `Diamond Skin`, `Amethyst`, `Guardian`, `of Curing`, `Precision`,
    `suppression`, `quest points`, `ESRecharge`, `Flask 3`, `Flask 4`, `Flask 5`.
- **AC-A3 (WU-18).** In-process, engine-required, golden build.
  - `analyze_defenses`, with no `build_name`, reports:
    - EHP 11,833 (to the nearest whole number);
    - `PhysicalDamageReduction`, `EvadeChance`, `DeflectChance`, `EffectiveBlockChance`;
    - each resist with its missing amount;
    - each type's max hit vs that type's enemy damage.
  - Its issues equal `judge()`'s for the same stats.
  - With `build_name:"other.xml"` (a fixture copy at level 80), it reports that build, and `loaded`,
    `revision` and the canonical export are unchanged afterwards (AC-E51 semantics).
  - The same holds for `validate_build {build_name:"other.xml"}`.
- **AC-A4 (WU-18).** In-process, engine-required, golden build.
  - `get_build_issues`' issue list equals the load summary's "Top Issues" list, element for element.
  - Neither contains `89`, `jewel socket(s) empty` for hidden slots, `quest points`, or `Flask 3`.
  - `validate_build` has a single code path: the XML path in `validationService.ts` is deleted, and
    `rg` finds no second implementation.
- **AC-A5 (WU-18).** In-process, engine-required.
  - On the golden build, which wears a Bright Thawing Charm, `validate_build` output contains no
    `Freeze`.
  - The three tool descriptions state that judgments come from PoB's warnings and engine comparisons.
  - The hygiene allowlist and cruft waivers have no entries owned by WU-18.
- **AC-A6 (WU-18, E7).** Static. No module under `src/handlers`, `src/advice` or `src/services` reads a
  stat key outside AC-E26's default list from a `getStats()` result fetched without `fields`. The test
  maps each `getStats(` call without `fields` to the property keys read from its result.

**Docs, setup, README tool table, fresh-clone check (WU-19)**

- **AC-G1 (WU-19, I-9a).** `pnpm docs:tools` (running `scripts/gen-tool-table.mjs`) prints a Markdown
  table of every listed tool: name, group, one-line description. `tests/static/readme.test.ts` asserts
  that the README section between `<!-- tools:start -->` and `<!-- tools:end -->` equals that output
  byte for byte, and the table has 76 rows.
- **AC-G2 (WU-19, I-9b).** Stale docs are removed and the README is clean:
  - `HANDOFF.md` and the 8 listed `docs/*.md` files don't exist;
  - `docs/` contains only `stabilization/`;
  - **outside** the block between `<!-- migration:start -->` and `<!-- migration:end -->`:
    - the AC-F20 scanner run over `README.md` and `CLAUDE.md` finds no banned phrase;
    - the README doesn't mention `POB_LUA_ENABLED`, `POE_TRADE_ENABLED`, `npm install`,
      `apt install luajit`, `brew install luajit`, `Chaos equivalent` or `api-stdio`.
- **AC-G3 (WU-19).** The README contains each of the following (checked by `readme.test.ts` with literal
  substrings):
  - `mise trust`, `mise run setup`, `mise run test`;
  - the exact D-16 command;
  - `POESESSID` (with the `.env` location and the link fallback);
  - `POE_LEAGUE` (with the D-20 rule);
  - `POB_DIRECTORY` (with a WSL example);
  - the state-dir path `~/.local/state/pob2-mcp`;
  - `POE_TRADE_DISABLED`, `POE_NINJA_DISABLED`;
  - the sentence `This product isn't affiliated with or endorsed by Grinding Gear Games in any way.`

  The migration block names every env var §11 lists as removed or changed, and every removed tool.
- **AC-G4 (WU-19, I-9c, script check).** `scripts/fresh-clone-check.sh` exits 0 when run by the verifier,
  and the work-log records the output. It:
  1. `git clone`s the repo at `HEAD` into a temp dir;
  2. runs `mise trust`, then `mise run setup`;
  3. starts `node build/index.js` over stdio with this env, with `POESESSID`/`POE_SESSION_ID` unset:
     - `POB_DIRECTORY=<clone>/tests/fixtures/builds`, `XDG_STATE_HOME=<temp>`;
     - `POE_LEAGUE="Forbidden Rites"`;
     - `POE_TRADE_BASE=http://127.0.0.1:9/api/trade2`, a tripwire: any trade request fails;
     - `POE_NINJA_DISABLED=true`;
  4. through `scripts/fresh-clone-check.mjs` (the SDK client):
     - asserts that `listTools` returns 76 tools;
     - asserts that `lua_load_build {build_name:"grenadator.xml"}` reports Life 2,977;
     - calls `find_upgrades {slot:"Ring 1"}` and asserts that the result starts with
       `Trade search not run:` (D-49: no request is made, so the tripwire isn't hit);
  5. exits non-zero on any failed step;
  6. contains no pipes.
- **AC-G5 (WU-19).** `CLAUDE.md` exists and contains:
  - the worktree bootstrap (`mise trust` first);
  - "no pipes in mise tasks";
  - "tests never touch the network or the real builds folder (D-34)";
  - "spawned test servers use `spawnServer`";
  - "never read or print `.env`";
  - "engine tests fail without the engine; `POB_SKIP_ENGINE=1` skips them";
  - "run probes from a temp cwd, never the repo root";
  - the pin upgrade procedure (S-2) and a pointer to `docs/stabilization/spec/README.md`.
- **AC-G6 (WU-19).** `tests/fixtures/tool-hygiene-allowlist.json` is `[]`,
  `tests/static/poe1-cruft-waivers.json` is `[]`, and AC-F20 and AC-F26 pass. `mise run test` and `pnpm
  build` exit 0.

## 6. Test strategy (this slice)

| AC | Class |
|---|---|
| AC-A1, A3, A4, A5 | in-process / engine-required |
| AC-A2 | unit + static |
| AC-A6, AC-G1, G2, G3, G5 | static |
| AC-G4 | script check (verifier-run; exit code recorded) |
| AC-G6 | the full gate |
| WU-20, WU-21 checklists | human (HG-9) |
