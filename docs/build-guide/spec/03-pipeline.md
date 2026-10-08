# Slice 03: Pipeline — the build-guide skill, its workflows and agents, the offline run, the alpha

Part of the [spec spine](README.md) ("spine"). It covers work units WU-43…WU-48 and acceptance criteria
AC-W1…AC-W26, plus the WU-48 checklist. Requirements trace to the spine's contracts and decisions
(C-30…C-50, D-100…D-238, A-20…A-32), the design rows they lift, the platform grounding ("platform §") and
ext §5 (the prior-art guide outline). §15 lists the open items the first draft found and the decisions
that resolved them (D-231…D-238); the adversarial review's fixes are folded in under their spine IDs
(D-210…D-221). The user settled D-210 (ask before discarding unsaved work), D-219 (the budget tolerance)
and D-234 (the survival floor gates chaos too, bar a recorded exception) on 2026-10-08. Prompt wording
is tuned on real runs; this slice fixes the contracts and required behaviours, not the prose of prompts.

## 1. Existing system context (this slice)

- **`.claude/` today** (recon §1): 8 tracked agent-os agents in `.claude/agents/agent-os/` and 6
  commands; no skills, no workflows, no project agents for this epic; `settings.local.json` is
  gitignored. This slice adds `.claude/skills/build-guide/`, `.claude/workflows/` and
  `.claude/agents/build-guide/`, all project scope (D-152).
- **Platform facts relied on** (platform §1–§3; §5 for the saved-workflow script format):
  - A skill is instructions Claude follows; it starts a saved workflow by calling
    `Workflow({name, args})` (A-23). Saved workflows live in `.claude/workflows/` and receive `args`
    verbatim as the global `args`.
  - A saved workflow is a plain JavaScript `.js` file that begins with `export const meta = {…}`, a pure
    literal (no variables, calls, spreads or interpolation) with `name` and `description`, and optionally
    `whenToUse` and `phases`. Its body runs with top-level `await` and the globals `agent(prompt, opts)`,
    `parallel`, `pipeline`, `phase`, `log`, `budget`, `workflow` and `args`.
  - `opts.agentType` runs a custom agent type from the Agent tool's registry; `opts.schema` forces a
    validated structured return; a dead or skipped agent returns `null`. A script has no filesystem or
    Node API, and can't read the clock or randomness: `Date.now()`, `Math.random()` and an argless
    `new Date()` throw.
  - Each workflow run's `journal.jsonl`, in its transcript directory, records every agent's return value.
    It is the post-run evidence for workflow agents (WU-47).
  - A workflow agent without `agentType` reaches every session MCP tool through ToolSearch. A custom
    agent's `tools:` frontmatter is an allowlist; an MCP tool is named `mcp__<server>__<tool>`, and an
    allowlist drops inherited MCP tools unless each is named (A-24). Whether an allowlisted agent also
    needs ToolSearch to reach a deferred MCP tool is not grounded; AC-W23 probes it.
  - Subagents and workflow agents share the session's MCP connection, hence one engine (S-c, A-22).
    Lookups take the session lock and only queue (D-130).
- **Server surface consumed** (slices 1 and 2):
  - lookups: C-37 `lookup_game_data`, C-38 `check_model_coverage`, C-43 `search_tree_nodes`, and the
    existing `get_classes`;
  - measurements: C-45 (per-skill breakdown) and C-47 (rankers that list what PoB can't measure);
  - C-41 `compile_plan`, with its measure-only (D-208) and final modes;
  - C-50 `guide_run` (D-216). `guide_run {new_run: <slug>}` creates the run folder without any engine
    call and replies with its absolute path, its root-relative path and `loadedBuildUnsaved`, whether
    the engine's loaded build has unsaved changes (D-207, D-210). `guide_run {validate: <plan_path>}`
    is kind `read`: it checks a plan and mutates nothing (D-167);
  - C-42 `encode_build_code`;
  - the dated price outputs (C-49, WU-49), whose errors start with a stable `[trade:<kind>]` prefix
    (D-218), and the limiter's `would_wait`/`locked_out` answers (C-11).

  The registration names the server `pob2` (stab D-16), so allowlists name `mcp__pob2__<tool>`.
- **Tool groups** (stab C-1): `POE_TRADE_DISABLED=true` hides group `trade` and `POE_NINJA_DISABLED=true`
  hides group `ninja`, so in M-12 the price tools don't exist for anyone.
- **Kind `read` is not "writes nothing"** (`src/server/toolMeta.ts`): `lua_save_build`, `export_build`
  and `save_config_preset` are `read` but write into the builds folder or the state dir, and
  `guide_run`'s `new_run` mode creates a folder. Allowlists are therefore enumerated sets (§4), never
  "every `read` tool".

## 2. Run folder layout and file ownership (C-34 inside a run; C-36)

After the roll check (FR-W2), the skill's first server write is `guide_run {new_run: <slug>}`; every
step and agent then uses the returned absolute path (D-207, D-216). **Slug:** `<ascendancy>-<skill>` in
lower case, each run of characters outside `[a-z0-9]` replaced by one `-`, trimmed of `-` (Titan / Blood
Hunt → `titan-blood-hunt`).

| Path in the run folder | Written by (only) | Content |
|---|---|---|
| `run-log.json` | the skill | §6 (D-158) |
| `research/p<k>-r1a-<n>.md` | R1a agent `n` of research round `k` | its sections, with source markers (§7.3) |
| `concepts/<id>/plan.json` | the R1b step for concept `<id>` | a skeleton plan (C-31) with key-item prices |
| `concepts/<id>/compile-record.json` and compiled XML | `compile_plan`, measure-only (D-208) | C-33 |
| `dossier.md` | the R1b assembly step; the dossier fix step (§5.5) | §7.2 |
| `plan.json` | the D1 and D2 steps; the D1 gate step only to apply FI-2 (§11.3) and the final re-price pass (§9) | C-31 |
| `compile-record.json`, measure-only XML | `compile_plan` | C-33; the final compile's record names the PoB file and holds `importCode` |
| `guide.md` | W1 | §8 |
| `reports/gates/<stage>-<concept>-a<attempt>.json` | the skill, from workflow results | gate verdicts (§5.3) |
| `reports/v3-<concept>-p<pass>.json`, `reports/v4-<lens>-<concept>-p<pass>.json` | the skill, from workflow results | §7.4 |

- Concept ids `c1`, `c2`, … are assigned in proposal order and are unique within a run, across research
  rounds.
- **The PoB file.** Only the final compile writes one, through C-17 (D-208); its `build_name` is
  `<slug>-<YYYY-MM-DD>-<n>`, the run folder's last two segments joined, so every run writes a new file
  (D-113, D-199). A re-compile within the run rewrites that same file (D-153, D-199). The server's write
  ledger allows that only while the file is unchanged since this run wrote it. Otherwise the compile is
  refused: with C-17's changed-on-disk wording when anyone edited the file in between, and with C-17's
  "already exists" wording when the ledger has no entry for this run (D-211).
- No agent writes outside the run folder (D-177). Parallel agents write disjoint files (C-36).

## 3. The skill (O1; D-129, D-152)

`.claude/skills/build-guide/` holds `SKILL.md`, shared references (`references/`), stage references
(`references/stages/<stage>.md`), templates (`templates/`) and the run checker (`scripts/check-run.mjs`).

- **FR-W1 (invocation).** `/build-guide <ascendancy> <skill> [--offline [--test <path>]]`; multi-word
  names are quoted (`/build-guide Titan "Blood Hunt"`). The roll goes into every plan's `roll` (C-31).
- **FR-W2 (start).** In this order, before any agent runs:
  1. **Roll check** (D-238). `get_classes` must list the ascendancy, and a gem lookup
     (`lookup_game_data {mode: "gem"}`) must find the skill as an active skill gem, not a support. If
     either fails, the skill stops and lists the closest valid names from those results. It creates no
     run folder.
  2. `guide_run {new_run: <slug>}` creates the run folder and replies with its absolute path, its
     root-relative path and `loadedBuildUnsaved` (C-50).
  3. The skill writes `run-log.json` with `status: "running"`, the mode, the orchestration and the
     test-config state.
  4. **Unsaved build** (D-210). If the `new_run` reply has
     `loadedBuildUnsaved: true`, the skill asks the user before the first compile: proceed, which
     discards the loaded build's unsaved changes, or stop (the run ends `stopped`). In offline test mode, `answers.unsavedBuild` answers it
     (§11.2).

  The skill rewrites the log after every workflow return, checkpoint, question and escalation, so an
  interrupted run still leaves one.
- **FR-W3 (one coordinator; C-36 as corrected by D-231; D-130, D-112).** During a run the skill
  runner calls no `pob2` tool except the roll check's lookups and `guide_run {new_run}`. Lookups (the
  `read`-kind tools in L, §4) may also be called by the R1a researchers and the V4 verifiers. Every
  engine-changing and trade call is made by a coordinator step, and no coordinator step overlaps any
  other agent.
- **FR-W4 (hand-off, D-129).** Research workflow → checkpoint 1 (§10) → design workflow for the chosen
  concept → checkpoint 2. A design result of `infeasible` returns to checkpoint 1 with its evidence
  (D-141); `escalated` follows §5.4; `ready` goes to checkpoint 2. A request for changes at checkpoint 2
  re-enters the design workflow with `resume` (§5.3, D-236), then returns to checkpoint 2.
- **FR-W5 (orchestration).** The skill uses the Workflow tool; if it is unavailable, or the test config
  forces it, the Agent-tool fallback (§5.6).
- **FR-W6 (persistence).** The skill writes every gate verdict and V3/V4 report a workflow returns into
  `reports/` unchanged, then the run log.
- **FR-W7 (run checker).** `scripts/check-run.mjs <runFolder> [--partial]` uses Node built-ins only
  (AC-B7). It validates the run folder against §2, §6, §7 and §8; `--partial` accepts a run that ended
  before `completed`. Under `--partial`, the claim-count comparisons below are skipped for the reports of
  the guide concept's last V3/V4 pass when, after that pass, a step that writes claims wrote its artifact
  (outcome `done` or `infeasible`, not `null-result`): D1, D2 or W1 of that concept, or `dossier-fix` or
  a later round's `R1b-assemble`, which rewrite `dossier.md` for every concept. Those reports counted the
  earlier artifacts (D-262).
  - **It recomputes, and doesn't trust self-reports.** The checker recomputes the following from the
    records. Wherever its result differs from the agents' verdict, it exits non-zero, naming the part
    and both values. The agents' verdict means the last D1 gate report of the concept the guide is for,
    or a V3 or V4 report.
  - **The survival floor**, by §5.3's rule, from the final compile record's endgame stages and the
    plan's scenario inputs. All four resistances are gated; chaos passes uncapped only with the stage's
    `chaosResistException`, whose reason the guide's `Checks` must state (D-234). Each of the five
    reference hits is the ceiling of its ledger entry's value (D-254, D-256).
  - **The budget**, from the plan's `prices[]` entries, with D-219's thresholds. It uses the gate
    report's map from slots to price entries and the conversion rates the report recorded. Every filled
    slot of each budget-variant stage must map to an entry. A total over 20 divines must come with the
    guide's `near the ceiling` note (§8).
  - **The rolled-skill gate**, from the plan's group roles (D-217) and the final record's figures.
  - **The claim counts.** It counts claims per kind and section in `plan.json`, `dossier.md` and
    `guide.md` (§7.4), and compares them with the V3 and V4 coverage totals. It applies D-179's re-check
    minimums to its own counts.

## 4. Agent definitions and tool allowlists (D-130, D-142, D-178, A-24)

Five definitions in `.claude/agents/build-guide/`. Each holds its role: the allowlist and the standing
rules (write only inside the run folder; never read `.env`; web only on D-171's hosts, never
pathofexile.com or poe.ninja; offline-mode rules, §11.1). Stage instructions live in the stage
references, so both orchestrations run the same instructions.

**Tool sets** (server `pob2`):
- **L, lookups:** `lookup_game_data`, `check_model_coverage`, `search_tree_nodes`, `list_gems`,
  `get_classes`.
- **B, build reads:** `lua_get_stats`, `lua_get_build_info`, `lua_get_tree`, `get_equipped_items`,
  `get_skill_setup`, `analyze_skills`, `get_config`, `analyze_defenses`, `validate_build`,
  `get_build_issues`, `suggest_supports`, `get_passive_upgrades`, `get_nearby_nodes`,
  `find_path_to_node`, `list_specs`, `list_item_sets`.
- **C, compile:** `compile_plan`, `guide_run`, `encode_build_code`.
- **P, prices:** `get_item_price`, `search_trade_items`, `search_stats`, `get_leagues`,
  `trade_query_options` (group `trade`), `get_currency_rates` (group `ninja`).

**Who calls what** (C-36 as corrected by D-231; D-130). Lookups (L) may be called by the R1a
researchers, the V4 verifiers and the coordinator. Engine-mutating calls and all trade calls are made
only by the coordinator.

| Type | Runs | File tools | `pob2` tools | Web |
|---|---|---|---|---|
| `build-guide-researcher` | R1a | Read, Glob, Grep, Write | ⊆ L | WebSearch, WebFetch |
| `build-guide-coordinator` | R1b, R1b assembly, dossier fix, D1, D2, gates, final compile, revision mapping | Read, Glob, Grep, Write, Edit | ⊆ L ∪ B ∪ C ∪ P | WebSearch, WebFetch |
| `build-guide-writer` | W1 | Read, Glob, Grep, Write, Edit (D-257) | none | none |
| `build-guide-provenance` | V3 | Read, Glob, Grep | none | none |
| `build-guide-verifier` | V4 lenses | Read, Glob, Grep | ⊆ L | WebFetch |

**ToolSearch.** If AC-W23's probe shows that an allowlisted agent reaches a deferred MCP tool only
through ToolSearch, ToolSearch joins the file tools of every row above. It loads only tools the
allowlist already grants, so it grants nothing more. The probe's recorded outcome decides, and AC-W5
checks against the table as amended.

**Rules** (checked by AC-W5):
- **R-1.** Frontmatter `name` equals the file stem; `tools:` is one comma-separated line (no YAML parser
  is allowed, HG-10).
- **R-2.** Each type's tools are a subset of its row above.
- **R-3.** Only `build-guide-coordinator` names a tool in C or P: only the coordinator compiles and
  prices (D-130, D-178).
- **R-4.** No definition names Bash, Agent, Skill, Workflow or NotebookEdit, or any `pob2` tool outside
  L ∪ B ∪ C ∪ P. So no `mutate`, `lifecycle` or other `load` tool and no file-writing tool: the plan is
  the source of truth and the compiler builds from it (D-113, D-155); the compiled build stays loaded for
  B's reads (D-191).
- **R-5.** V3 and V4 can't write: their reports return as structured output (§7.4), and they can't edit
  what they check. V4 is a separate type from the coordinator and the writer, starts with a fresh
  context, and its prompt carries the task header (paths, lens, pass, mode) and no text from the steps
  that wrote the plan or the guide (D-142).
- **R-6.** Every `agent()` call in the two workflows names one of these five as `agentType`, and every
  fallback Agent call names one as `subagent_type`. A default-type workflow agent would see every MCP
  tool.

## 5. Control flow

### 5.1 Task header

Every agent prompt, in both orchestrations, starts with a fenced `json` block: `stage` (`R1a`, `R1b`,
`R1b-assemble`, `dossier-fix`, `D1`, `D1-gate`, `D2`, `D2-gate`, `W1`, `V3`, `V4`, `revise-map`),
`attempt` (from 1), `concept`, `lens` (V4 only), `pass` (V3/V4), `mode` (`offline` or `online`),
`runFolder`, `runFolderRel` (the run folder relative to the guides root; the run's `plan_path` is
`<runFolderRel>/plan.json`), `compile` (`none`, `measure-only`, `final`), `buildName` (final compile
only), `findings` (earlier attempts' findings, routed V3/V4 findings, or the user's revision requests
and guidance, §5.3), `accepted` (findings the user accepted at an escalation, §5.4), `faults` (this
step's directives, §11.3), `writes` (the paths the step may write), `reference` (its stage reference).

### 5.2 Research workflow `build-guide-research` (R1)

**Args:** `{runFolder, runFolderRel, roll, mode, pass, firstId, note?, faults?}`. `pass` is the research
round, from 1. `firstId` is the number of the first concept id this round assigns: 1 in the first
round, then one more than the highest id already in the run.
1. **R1a.** Up to 3 researcher agents in parallel (D-161). Each writes its own
   `research/p<pass>-r1a-<n>.md` and returns `{file, concepts: [{title}]}`. Together they produce the
   mechanics section, the synergy search, the config gaps (D-123) and 2–3 concept proposals, each with
   C-36's seven fields: key uniques, ascendancy nodes, supports, keystones, feasibility read, risks, what
   PoB can't verify. WU-44 decides how the work divides among the agents.
2. **Ids and the cap** (D-235). The script assigns ids in return order, starting at `c<firstId>`, and
   carries at most 3 concepts per research round (D-161). Extra proposals are returned and logged as
   `not-carried`, never dropped silently.
3. **R1b**, one concept at a time. A coordinator step writes `concepts/<id>/plan.json` (an endgame
   skeleton of the concept), compiles it measure-only (D-208), prices the concept's key items (§9), and
   returns `{compiled, errors, recordPath, numbers, prices, priceCalls}`. **Gate:** compiled with no
   compile error (C-36). A failed attempt re-runs with the errors as findings, at most 2 retries; then
   the concept is `failed` with its last errors as evidence (D-141).
4. **R1b assembly.** One coordinator step writes `dossier.md` (§7.2) from the research files and the R1b
   results; it confirms each compiled concept's record exists beside its skeleton (else marks it
   `failed`).

**Returns:** `{status: "ok" | "no-viable", concepts: [{id, title, status: "viable" | "failed" |
"not-carried", attempts, evidence}], gateVerdicts, stats}`. `no-viable` means no concept of this round is
`viable`.

### 5.3 Design-and-write workflow `build-guide-design` (D1, D2, W1, V3, V4)

**Args:** `{runFolder, runFolderRel, conceptId, mode, buildName, faults?, resume?}`.
1. **D1** (coordinator; D-104, D-115…D-120, D-147, D-148, D-193). Writes the endgame stages of both
   variants into `plan.json`, each with its `level`, per-gem levels and `ascendancyPoints` with a source
   or rationale, a `role` on every skill group (`skills.groups[].role`) and `skills.rolledGroup`, the
   group holding the rolled skill (D-217); prices every slot of both variants (§9); compiles
   measure-only as often as it needs.
   Returns `{claim: "done" | "infeasible", priceCalls}`.
2. **D1 gate** (a fresh coordinator step). Runs the final re-price pass (§9), compiles `plan.json`
   measure-only, reads the record and returns a verdict `{compiled, v1, v2, floor, budget, rolledSkill}`.
   Each part is `pass`, `fail` or `unverified`, with findings that cite record fields and E1 keys:
   - **floor** (D-118, D-119, D-234): per endgame stage, Fire, Cold, Lightning and Chaos
     `Missing<Elem>Resist` = 0 at the Endgame resistance penalty (pin `Modules/CalcDefence.lua:941`). A
     stage with `MissingChaosResist` above 0 passes only when it carries `chaosResistException` (C-31),
     and the gate adds a finding naming the value and the reason; without one the floor fails. The D1
     agent uses the exception only when capping chaos is infeasible (D-234). And for every damage type
     in the stage's mapping reference hits (its scenario inputs, C-32: the `enemy<Type>Damage` options,
     pin `Modules/ConfigOptions.lua:2267-2275`), `<Type>MaximumHitTaken` greater than that hit. Every
     endgame stage holds five waystone-scaled hits (physical, fire, cold, lightning, chaos), each derived
     by a ledger entry `hit_<stage id>_<type>` (D-254). PoB types these options `countAllowZero` (whole
     numbers), so each scenario value is the ceiling of its entry's value rounded to 2 decimals,
     `ceil(round2(value))`: 96.4789 gives 97, and 402.000003 gives 402. The guide quotes the ledger value
     (D-256, amending D-254);
   - **budget** (D-116, D-147, D-164, D-219): the budget variant passes when every slot price is `ok` and
     the total is ≤ 20 divines; it also passes above 20 up to 22, with a "near the ceiling" note in the
     guide (§8); it fails above 22; and it is `unverified` when any price is `unavailable` or a currency
     has no rate (`unverified` doesn't fail the gate). The non-budget total is reported against 200
     (D-117), never gated;
   - **rolledSkill** (D-122, D-148, D-217): in each endgame stage, the rolled skill's group
     (`skills.rolledGroup`) has role `clear` or `single_target` (never `utility` or `leveling`: the
     rolled skill is never a token role, D-122), and its damage figure is the largest among the stage's
     groups with that role. A figure is a record `skillOutputs` field, the same field for every group
     compared, or a ledger entry's value.

   **The verdict file also carries what the run checker needs to recompute it** (FR-W7):
   - `floor`: per endgame stage, the three gated values, the chaos value, and each reference hit with
     its `<Type>MaximumHitTaken`;
   - `budget`: `{stage, slot, priceId}` (a `prices[].id`) for every filled slot of each budget-variant stage, the `rates`
     it converted with (`{currency, divines}`, from `get_currency_rates`), and each total;
   - `rolledSkill`: per endgame stage, the rolled skill's group, its role, and each same-role group's
     figure and value.

   | Gate verdict | D1's claim | Outcome |
   |---|---|---|
   | compiled, V1, V2, floor, rolledSkill pass; budget pass or unverified | any | D2 |
   | compile, V1 or V2 fails | any | D1 re-runs with the findings; after 2 retries, `escalated` |
   | only floor, budget or rolledSkill fails | `infeasible` | `infeasible`, with the verdict as evidence (D-141) |
   | only floor, budget or rolledSkill fails | `done` | D1 re-runs with the findings; after 2 retries, `infeasible` |
3. **D2** (coordinator; D-104, D-108…D-110, D-144). Campaign stages planned backward from D1: the
   leveling skill until the main skill's requirement, one loadout per stage, trees that grow with named
   respecs and their gold cost, buyable uniques only; campaign uniques priced.
4. **D2 gate** (a fresh coordinator step). Compiles the whole plan measure-only; V1 and V2 must pass for
   every stage (V1 includes tree continuity, D-192). On a pass, the same step runs the **final compile**
   (`compile: final`, `build_name` = `buildName`), which writes the PoB file through C-17 and the record
   with `importCode`. The verdict records it as `finalCompile {compiled, errors, recordPath, pobFile}`,
   without the import code, whose one home is the record (D-260). A failure re-runs D2 with the findings;
   after 2 retries, `escalated`.
5. **W1** (writer). Writes `guide.md` from the plan, the final record, the ledger, the dossier and the
   template (§8). It copies `importCode` from the record (D-205).
6. **V3 and V4.** One provenance agent and three verifier lenses (§7.4), at most 3 in flight (D-161).
7. **Findings.** Any finding with status `unresolved` is routed (§5.5); with none, return `ready`.

**Resuming** (`resume`; D-236). With `resume`, the workflow starts part-way instead of at D1:
- **`{reason: "revision", round, requests}`**, from checkpoint 2. A coordinator step `revise-map` maps
  each request to its owner by §5.5's table and returns `[{request, owner}]`. Every owner re-runs once
  with its own requests as findings, earliest first, followed by the steps §5.5 lists after it. A
  revision re-run counts against no cap; a gate failure after it gets the usual 2 retries.
- **`{reason: "guided-retry", stage, findings, guidance}`**, from escalation choice 2 (§5.4). `stage`
  runs once more with its findings and the user's guidance, outside the cap; the flow then continues as
  after any attempt, and a failure returns `escalated` again.
- **`{reason: "accepted", stage, findings}`**, from escalation choice 1. The failed gate step runs again
  with the findings in its header's `accepted`. A finding equal to an accepted one (same stage and code)
  fails neither that gate nor a later one. W1's header carries the accepted findings, and the guide
  states them (§8). After a V3/V4 escalation, the workflow returns `ready` with the findings accepted.

**Returns:** `{status: "ready" | "infeasible" | "escalated", stage?, evidence?, accepted?, gateVerdicts,
v3Reports, v4Reports, stats}`.

### 5.4 Attempts, retries and escalation (D-127, D-141, D-165)

- An **attempt** is one invocation of a step. A step that fails its gate, errors (an engine crash
  mid-compile included, D-165) or returns `null` has failed that attempt; it re-runs with the findings.
- **At most 2 retries per (stage, concept).** A second concept's D1 starts again at attempt 1. A user's
  revision (§10) and a guided retry (below) count against no cap; the run log records both (D-236).
- **Escalation** (D-236). The workflow stops and returns `escalated` with every attempt's findings. The
  skill records it in `escalations[]`, shows the user the stage, the attempts, the findings and the
  artifact paths, and asks with AskUserQuestion:
  1. **accept**: the design workflow resumes with `{reason: "accepted"}` (§5.3), and the guide states
     the failure. This isn't offered when the failure is a compile error, since nothing compiled to
     continue from;
  2. **guidance and one more retry**: the design workflow resumes with `{reason: "guided-retry"}` and
     the user's guidance;
  3. **back to checkpoint 1**, with the findings as the concept's evidence;
  4. **stop**: the skill records `status: "escalated"` and ends the automatic flow.

  In offline test mode, `answers.escalation[]` answers it; with no answer left, the choice is `stop`
  (§11.2).

### 5.5 Routing V3 and V4 findings ("the responsible stage re-runs with the verifier's findings", D-141)

Each finding names an `owner`, the step that wrote the claim (C-36's Writes column):

| Finding is in | Owner | After the owner's re-run |
|---|---|---|
| `guide.md` | W1 | V3, V4 |
| an endgame stage of `plan.json`, a ledger entry citing one, an endgame price | D1 | D1 gate, D2 gate and final compile, W1, V3, V4 |
| a campaign stage, or a ledger entry citing only campaign stages | D2 | D2 gate and final compile, W1, V3, V4 |
| `dossier.md` | dossier fix (coordinator, edits `dossier.md` only; counts as R1b) | V3, V4 |

One round re-runs each owner once with all its findings. A re-run counts as that owner's retry; the
regenerations after it don't. A third round for the same owner escalates. Each round re-runs V3 and all
three lenses. Findings marked `accepted-offline` aren't routed, nor are findings the user accepted at an
escalation (§5.4). A checkpoint-2 revision maps the user's requests to owners with the same table (§5.3).

### 5.6 Agent-tool fallback (D-172, A-23, R-26)

When the Workflow tool isn't in the session, or its call fails before any agent starts, or the test
config forces it, the skill runs §5.2–§5.5 itself with the Agent tool: the same agent types, task
headers, stage references, gates, routing, resume paths and caps; the same artifacts; at most 3 Agent
calls in flight. It takes gate verdicts and reports from each agent's final JSON. The run log records
`orchestration: "agent-tool"`. `references/fallback.md` lists every step of both workflows in order,
with its agent type.

## 6. Run log `run-log.json` (D-158)

| Field | Content |
|---|---|
| `schemaVersion` | `1` |
| `runFolder`, `slug`, `roll` | the absolute path; the slug; `{ascendancy, skill}` |
| `mode`, `orchestration`, `testConfig` | `offline`/`online`; `workflow`/`agent-tool`; `none`/`accepted`/`refused` |
| `status`, `startedAt`, `endedAt` | `running`, `completed`, `not-accepted`, `stopped` or `escalated` |
| `caps` | `{concepts: 3, lensesPerPass: 3, retriesPerStage: 2, fanOut: 3}` (D-127, D-161); `concepts` is per research round (D-235) |
| `timeline[]` | `{what, startedAt, endedAt}` from the skill runner's own clock: one entry per workflow call, checkpoint, question and fallback agent call |
| `stages[]` | per attempt: `{stage, concept?, lens?, pass?, attempt, startedAt, endedAt, agents, outcome, findings}` (`findings` is a count); `outcome` is `pass`, `fail`, `infeasible`, `escalated`, `null-result` or `done`; the times are `null` where the source records none (workflow mode) |
| `agents` | `{total, byType, maxConcurrent}` |
| `retries[]` | `{stage, concept, count}`: cap-counted retries only |
| `rounds[]` | `{round, note, firstId, concepts, conceptsCompiled, startedBy: "user" \| "pre-supplied"}`, one per research round (D-235) |
| `concepts[]`, `conceptsCompiled` | `{id, title, round, status, attempts}`; how many skeletons R1b compiled in the whole run |
| `v4Passes[]` | `{concept, pass, lenses}` |
| `checkpoints[]` | `{checkpoint, visit, shown, answer, answeredBy: "user" \| "pre-supplied" \| "default", at}`; `checkpoint` is `1`, `2`, `unsaved-build` or `escalation`; `shown` is what was presented; `default` is the answer §11.2 gives when none was supplied |
| `escalations[]` | `{stage, concept, attempts, findings, choice, guidance?}`; `choice` is `accept`, `retry`, `checkpoint-1` or `stop` (D-236) |
| `revisions[]` | `{round, requests: [{text, owner}]}`, one per checkpoint-2 request for changes (D-236) |
| `pricing` | `calls[]` of `{at, stage, tool, item, outcome}` (§9); `totals`, see below |
| `faults[]` | offline test mode only: `{id, target, applied, observed}` |
| `outputs` | `{plan, record, dossier, guide, pobFile}`; the import code stays in the record (D-260) |

- **Pricing outcomes** (D-218). `outcome` is `ok`; or the `<kind>` of the error's `[trade:<kind>]`
  prefix, a `TradeErrorKind` (`src/trade/errors.ts`) such as `would_wait`, `locked_out` or
  `rate_limited` (a 429 from the trade site); or `error`, for an error without the prefix. `at` is the
  result's `Checked:` time (C-49), or `null` for an error. `totals` is `{calls, ok, unavailable,
  wouldWait, lockedOut, rateLimited}`: `unavailable` counts every `prices[]` entry with status
  `unavailable` across every plan the run wrote (`plan.json` and every `concepts/<id>/plan.json`), which
  the run checker recounts (D-261); the others count calls by outcome.
- Timestamps are ISO 8601 UTC from a real clock. Workflow scripts can't read one (§1), so in workflow
  mode the per-attempt times may be `null`. The times come from the skill runner, which stamps
  `timeline[]` (and, in fallback mode, every attempt), from the compile records' `compiledAt`, and from
  the prices' `Checked:` lines. No researcher, writer or verifier gains Bash or a network-capable tool
  for timing.
- NFR-23 is read from every `rounds[].conceptsCompiled` ≤ 3, every `v4Passes[].lenses` ≤ 3, every
  `retries[].count` ≤ 2 and `agents.maxConcurrent` ≤ 3. NFR-22 is read from
  `pricing.totals.rateLimited` = 0 and `lockedOut` = 0, which count outcomes by their prefix.

## 7. Stage artifact formats

### 7.1 Plans

`plan.json` and the skeletons follow C-31; agents read the committed reference
`docs/build-guide/plan-reference.md` (D-167). On top of C-31: C1/E1 values used by a stage are copied
with their tags (D-168); every priced item has a `prices[]` entry with an `id` (§9, D-237); every skill
group has a `role`, and every endgame variant stage sets `skills.rolledGroup` (D-217).

### 7.2 Dossier `dossier.md`

H2 headings in order: `Roll and mode`, `Mechanics`, `Synergy search`, `Config gaps`, `Concepts`,
`Not carried`. Under `Concepts`, one H3 `c<n>: <title>` per concept, with labelled fields for C-36's
seven fields plus the R1b result: the skeleton path, compile status and errors, key numbers from its
record, and key-item prices (dated or `unavailable`). A later research round appends its concepts.

### 7.3 Source markers in markdown (C-30 in `dossier.md`, `guide.md` and the research files)

A claim carries one or more footnote markers `[^<id>]`. Each id has exactly one definition line:
`[^<id>]: <kind> | <ref> [| accessed: YYYY-MM-DD] [| patch: <p>] [| confidence: H|M|L]`, where `kind` is
one of C-30's five kinds, with C-30's required fields; or `ledger | <ledgerId>`; or `data | <file>#<key>`,
a C1/E1 fact with `<file>` relative to `data/` (D-232); or `price | <priceId>`, a plan price entry
named by its `prices[].id` (D-237). In the plan, the same citations are `ledger:<id>`,
`data:<file>#<key>` and `price:<id>` (C-30). Definitions sit under the file's last heading (`Sources` in
the guide).

### 7.4 Verifier reports (V3, V4)

`{stage: "V3" | "V4", lens?, concept, pass, mode, coverage, findings: [{id, artifact, location, claim,
issue, evidence, owner, status: "unresolved" | "accepted-offline"}], verdict}`. `verdict` is `pass`
exactly when no finding is `unresolved`.

**Counting claims** (for coverage, and for the run checker, FR-W7). A claim is one definition line in a
markdown artifact, or one `stages[].claims[]` entry in the plan. Its section is the H2 of its first
marker, or in the plan its stage. "Endgame" means the guide's two `Endgame:` H2s and the plan's `variant`
stages; everything else, the dossier included, is "elsewhere".
- **V3** (provenance): every claim in the plan, the dossier and the guide has a well-formed tag (C-30,
  §7.3); coverage counts markers and plan claims per artifact.
- **V4 lenses** (D-179 and the design's V4 row), one fresh verifier agent each:
  - `ledger`: re-derives every ledger entry from the final record (C-33) and the entry's tagged inputs;
    compares the result with the record's value and with every guide number that cites the entry.
    Coverage `{entries, rederived}`; the two must be equal.
  - `sources`: opens the source of every `external` claim (WebFetch, D-171's hosts); checks every
    `data` claim against the data-file fact and the citation stored there, and offline doesn't fetch the
    fact's URL (D-232); re-checks `pob-data` claims with L, all of them in endgame sections and at least
    1 in 5 elsewhere; checks each `price` claim's amount, currency, date and league against the
    `prices[]` entry its id names (D-237; V4 has no trade tool, D-178). Coverage `{external, opened,
    data, dataChecked, pobDataEndgame, recheckedEndgame, pobDataOther, recheckedOther, prices,
    matched}`.
  - `prose`: reads `guide.md` for mechanics claims the cited sources don't support, and checks that the
    rolled skill is shown as the main damage source (D-122) and that budget statements follow D-164 and
    D-219.
  - A claim tagged `external-unavailable` is `accepted-offline` when the run log's mode is `offline`
    and `unresolved` otherwise (C-30).

## 8. Guide template (W1; ext §5, the design's quality bar)

`templates/guide-template.md`. `guide.md` has one H1 naming the roll, then these H2s in order:

| H2 | Must contain |
|---|---|
| `Versions, prices and import code` | the engine data version (pin tag and targeted game patch) and, separately, the patch of the prices and boss data (D-107); the date; the league; the mode, and in offline mode that prices are unavailable and no external source was consulted; the import code in a fenced block, equal to the final record's `importCode` (D-145, D-205); the PoB file name; that each stage is a loadout and the file is in auto-level mode (D-138, D-149) |
| `Summary` | the concept, why the rolled skill works, pros and cons, difficulty, why this concept won and that the dossier keeps the alternatives |
| `How it works` | the mechanics with sources; the ledger summary: each entry's claim, its value from the record, its formula in words (D-106) |
| `Leveling` | one H3 per campaign stage in plan order, titled with its loadout name exactly as the record has it. Each gives the level range, skills and supports with socket counts, tree points to add and any respec with its gold cost (D-144), the ascendancy pick, gear to equip or buy with a dated price or `unavailable`, swap triggers, and the stage's PoB numbers |
| `Campaign rewards` | the reward choices to pick (C1) |
| `Endgame: budget variant` | gear by slot with dated prices (`price` markers, D-237); stat priorities; gem links with gem levels; the tree; the character level and ascendancy points (D-193); earned config with its producer and uptime (D-114); an H3 `Checks`: the survival-floor numbers (all four resistances gated; an uncapped chaos value with its exception's reason, D-234), the budget total against 20 divines with the words `near the ceiling` when it is over 20 and at most 22 (D-219), or the D-164 statement, the Arbiter's hits against max hit taken and the time-to-kill range (D-116, A-30), the mapping signals with confidence (D-121, D-132) |
| `Endgame: non-budget variant` | the same, with the total against the ~200-divine reference (D-117), plus the upgrade order from the budget variant |
| `Rotation` | clear and single target (D-120); if the rolled skill isn't the clear skill, why (D-148) |
| `Defences and resistances` | the resistance plan through the campaign penalties to −60% (D-118) |
| `FAQ and common mistakes` | newcomer questions and hard warnings |
| `Confidence and what PoB can't model` | C-38's flags, the hand calculations, the M and L inputs (A-29); in offline mode, the `external-unavailable` claims; after an accepted escalation, an H3 `Accepted failures` listing each accepted finding with its stage (§5.4) |
| `Changelog` | dated entries |
| `Sources` | the footnote definitions (§7.3) |

## 9. Pricing procedure (T1; `references/pricing.md`; D-133, D-160, D-164, D-169, D-202, D-218)

- **Who.** Only coordinator steps price, with P's tools and C-49's dated outputs (D-112, D-178).
- **Order** (D-133): R1b prices concept key items; D1 prices every slot of both variants, with rares as
  affix-target searches (`search_trade_items` with `mods`); D2 prices campaign uniques.
- **Record** each result in that plan's `prices[]` with its id (what a `price:<id>` claim cites, D-237),
  date (the result's `Checked:` line, C-49), league, query and status (D-169). An `unavailable` entry
  has `amount` and `currency` null and a `note` giving the reason (`offline run` in offline mode,
  D-233). Before a search, reuse an entry with the same item, query and league from any plan in this
  run.
- **Outcomes** are classified by the error text's `[trade:<kind>]` prefix (D-218), whose `<kind>` is a
  `TradeErrorKind`: `would_wait`, `locked_out`, `rate_limited` (a 429), `http`, …; an error without the
  prefix is `error`. The prose after the prefix is never parsed.
- **Pace** (D-160, C-11). The limiter sleeps a wait of 30 s or less inside the call, and refuses a longer
  one with `would_wait`, sending nothing, so no call is sent during a wait it has announced. The
  coordinator has no clock and paces by order, not time: on `would_wait`, it prices other items and
  re-calls the refused item later. An item's third refusal makes it `unavailable` (rate-limited, D-164),
  as does the step ending before the item is priced. On `locked_out` or `rate_limited`, stop pricing for
  the rest of the run; every remaining item is `unavailable`.
- **Final re-price pass.** Before the D1 budget verdict becomes final, the D1 gate step re-calls each
  rate-limited `unavailable` entry of `plan.json` once and updates it (§5.3); a refusal leaves it
  `unavailable`. The pass is skipped once pricing has stopped, and in offline mode.
- **Divines.** Totals convert with `get_currency_rates` (poe.ninja, through the same coordinator). The
  D1 gate records the rates it used, for the run checker (FR-W7). If the rates are unavailable, totals
  are `unverified`.
- **Unavailable** (no cookie, rate-limited, down, disabled, offline; D-164): status `unavailable`. A
  variant with any unavailable slot price can't be claimed to be under budget; the guide and checkpoint 2
  say so.
- **Log** every price-tool call in `run-log.json` `pricing.calls`, with the outcome its prefix gives.

## 10. Checkpoints (D-125, D-157, A-28)

- **Checkpoint 1.** The skill shows a short comparison per concept: synergy, numbers from its record,
  key prices (dated or `unavailable`), risks, what PoB can't verify, and its status. It gives the
  dossier's path and, after an `infeasible` return from D1 or an escalation sent back here, that
  concept's evidence. With no viable concept it shows the best attempts and why each fails (D-141). It
  asks with AskUserQuestion: pick a concept (a failed one may be picked anyway), ask for more, or stop.
  "Ask for more" starts a new research round of up to 3 concepts with the user's note (D-235); only that
  answer starts a round, never the skill on its own. If the choices exceed one question's option limit,
  the skill splits them into two questions.
- **Checkpoint 2.** The skill shows the guide's path, the V3 and V4 verdicts with finding counts by
  status, the gate verdicts, a run-log summary (times as §6 sources them, agents, retries, revisions,
  price calls), the D-164 statement if any price is unavailable, and in offline mode that the guide is an
  offline run. `accept` completes the run; a request for changes starts a revision (D-236, §5.3) and then
  returns here; any other answer ends it `not-accepted` with the user's note.
- The unsaved-build question (FR-W2) and every escalation question (§5.4) are asked the same way.
- Every presentation (`shown`) and answer is recorded in `checkpoints[]`.

## 11. Offline mode, test config and fault directives

### 11.1 Offline mode (D-201, C-30, C-36)

Started explicitly with `--offline`; the run log records it. In offline mode:
- no step calls a trade, poe.ninja, WebSearch or WebFetch tool, even if one is available;
- research uses only L and the committed C1/E1 files, not `docs/design/grounding/`; a claim taken from
  C1/E1 cites its fact as `data:<file>#<key>` (D-232);
- every price is `unavailable` with `note: "offline run"` and `league` null, dated the run folder's date
  (D-164), and a claim that would need an external source is tagged `external-unavailable`, which V4
  accepts only in this mode;
- the plan's `league` is null, which C-31's schema allows only when every price is `unavailable` with
  `note: "offline run"` (D-233).

M-12 also removes those tools from the environment (spine §9), so the rule is enforced, not just
followed.

### 11.2 Test config (offline mode only; A-28)

`--test <path>` names a JSON file `{answers, orchestration?, faults?}`. The skill accepts it only
together with `--offline`. Otherwise it records `testConfig: "refused"`, ignores the file and asks the
user (D-157).
- `answers.checkpoint1[]` holds one answer per visit: `first-viable` (the first `viable` concept not
  yet designed in this run, or `stop` if there is none), `pick:<id>`, `more` or `stop`.
  `answers.checkpoint2[]` holds `accept`, `not-accept` or `revise:<text>`. When the answers run out, the
  run ends `stopped`.
- `answers.escalation[]` holds one answer per escalation (§5.4): `accept`, `retry:<guidance>`,
  `checkpoint-1` or `stop`. With none left, the answer is `stop` (`answeredBy: "default"`), so the run
  ends `escalated`.
- `answers.unsavedBuild` (FR-W2) is `proceed` or `stop`; without it, the answer is `stop`
  (`answeredBy: "default"`).
- `orchestration: "agent-tool"` forces the fallback (§5.6).

### 11.3 Fault directives (test config only)

Each directive names its target concepts and whether it is `persistent` (every attempt) or applies to
attempt 1 only. Each application is logged in `faults[]`.

| Id | Applied by, when | Edit | A check that must then fail |
|---|---|---|---|
| FI-1 | the R1b step, before compiling a target concept's skeleton | add a support gem named `FI-1 Unknown Gem` to the skeleton's main socket group | the compile, with a per-stage error naming the gem (D-162) |
| FI-2 | the D1 gate step, before its compile | set the first endgame stage's `level` to 1 in `plan.json` | V1, for that stage (points and requirements exceed level 1) |
| FI-3 | the D1 gate step | none: the gate's outcome is forced to `infeasible`, with evidence `FI-3 (injected)` | control flow only: the route back to checkpoint 1 |

The seeded V4 checks FI-4 and FI-5 (AC-W15) are applied by the build coordinator to a copy of a run
folder, not through the skill.

## 12. Work units

WU-44 → WU-45 → WU-46 run one after another, not in parallel. They share
`tests/unit/buildGuideWorkflows.test.ts` and `.claude/agents/build-guide/build-guide-coordinator.md`.

### WU-43: The skill, shared references, run log, checker and workflow harness
- kind: build
- depends-on: [WU-41, WU-49, WU-31]
- role: pipeline author (Claude Code skills) + test infra
- touches: [`.claude/skills/build-guide/` (new): `SKILL.md`; `references/` for the run folder, run log, checkpoints and escalations, pricing, offline mode and test config, fallback and source markers; `scripts/check-run.mjs`; `tests/static/buildGuidePipeline.test.ts` (new); `tests/unit/buildGuideCheckRun.test.ts` (new); `tests/helpers/workflowHarness.ts` (new); `tests/fixtures/pipeline/` (new)]
- produces: [the skill (§3) with its roll check, unsaved-build question, escalation question and checkpoint-2 revision loop; the run-folder layout (§2); the run log (§6); the task header (§5.1); the marker syntax (§7.3); the report shape (§7.4); the pricing procedure (§9); checkpoints (§10); offline mode, test config and faults (§11); the fallback (§5.6); the run checker (FR-W7); the workflow harness; the positive allowlist probe (AC-W23); with WU-44…WU-46, C-36's stage artifacts and rules]
- consumes: [C-30, C-31, C-34, C-37 (the probe's lookup), C-41 (`measure_only`), C-50 (`{new_run}` with `loadedBuildUnsaved`, `{validate}`; D-210, D-216), C-49 (with D-218's prefix), C-11, D-217, D-219, D-231…D-238]
- acceptance: [AC-W1, AC-W2, AC-W3, AC-W23]
- milestone: M-12
- summary: Write the skill and every contract the other units share.
  - The skill names the agent types (§4) and workflows (§5) this slice fixes, so WU-44…WU-46 fill them
    in.
  - `check-run.mjs` validates a run folder and recomputes the agents' verdicts (FR-W7).
  - The harness runs a saved workflow script under Jest with scripted agent results. It loads the
    script as platform §5 requires: it reads `.claude/workflows/*.js` as text, takes out the `meta`
    literal, and runs the body in an `async function` with fakes for the globals. ts-jest compiles to
    CommonJS here, so a test can't `import` the script.
  - Early in the unit, run the positive allowlist probe (AC-W23) and record its outcome in the
    work-log. That outcome decides whether ToolSearch joins §4's rows. WU-31 is a dependency for this
    probe alone.

### WU-44: Research workflow and its agents
- kind: build
- depends-on: [WU-43, WU-31, WU-32]
- role: pipeline author
- touches: [`.claude/workflows/build-guide-research.js` (new), `.claude/agents/build-guide/build-guide-researcher.md` and `build-guide-coordinator.md` (new), `.claude/skills/build-guide/references/stages/` (`R1a`, `R1b`, `R1b-assemble`, `dossier-fix`), `.claude/skills/build-guide/templates/dossier-template.md`, `tests/unit/buildGuideWorkflows.test.ts` (research cases, new), `tests/static/buildGuidePipeline.test.ts` (allowlist cases)]
- produces: [`build-guide-research` (§5.2), the researcher and coordinator definitions (§4), the dossier format (§7.2)]
- consumes: [C-37, C-38, C-43, C-41 measure-only, C-49, D-235, the WU-43 contracts]
- acceptance: [AC-W5, AC-W6, AC-W7]
- milestone: M-12
- summary: R1a's parallel lookup-only research and R1b's coordinator compile and pricing, with the
  3-concept cap per research round, the R1b gate and its retries, the no-viable result, FI-1, and the
  dossier assembly.

### WU-45: Design-and-write workflow, the writer and the guide template
- kind: build
- depends-on: [WU-43, WU-44, WU-34, WU-42]
- role: pipeline author
- touches: [`.claude/workflows/build-guide-design.js` (new), `.claude/agents/build-guide/build-guide-writer.md` (new), `build-guide-coordinator.md` (D1, D2 and gate rules), `.claude/skills/build-guide/references/stages/` (`D1`, `D1-gate`, `D2`, `D2-gate`, `W1`), `.claude/skills/build-guide/templates/guide-template.md`, `tests/unit/buildGuideWorkflows.test.ts` (design cases)]
- produces: [`build-guide-design` steps 1–5 (§5.3), the D1 gate decision table and the contents of its verdict file, the final re-price pass, the final compile, the escalation resume paths (`accepted`, `guided-retry`), the guide template (§8)]
- consumes: [C-31…C-33, C-35, C-41, C-45, C-47, C-49, D-192, D-217, D-219, D-234, D-236]
- acceptance: [AC-W8, AC-W9, AC-W10, AC-W11, AC-W24]
- milestone: M-12
- summary: D1 → D1 gate → D2 → D2 gate and final compile → W1, with the retry caps, the infeasible
  route, FI-2 and FI-3, and the resume paths after an escalation. Runs after WU-44 (§12's opening note).

### WU-46: V3 and V4 agents, wired into the design workflow
- kind: build
- depends-on: [WU-45, WU-44]
- role: pipeline author
- touches: [`.claude/agents/build-guide/build-guide-provenance.md` and `build-guide-verifier.md` (new), `.claude/skills/build-guide/references/stages/` (`V3`, `V4`, `revise-map`), the `build-guide-design.js` script (steps 6–7, §5.5 routing, the revision resume), `.claude/skills/build-guide/references/fallback.md`, `tests/unit/buildGuideWorkflows.test.ts` (verification cases), `tests/static/buildGuidePipeline.test.ts`]
- produces: [V3, the three V4 lenses (§7.4), finding routing (§5.5), the checkpoint-2 revision resume (§5.3)]
- consumes: [C-30, C-33, C-37, C-38, C-43, D-232, D-236, D-237]
- acceptance: [AC-W12, AC-W13, AC-W14, AC-W25]
- milestone: M-12
- summary: V3 checks that tags are present; V4 checks that claims are true, through agents that didn't
  write the plan and can't edit it (D-142, D-179). V4 accepts `external-unavailable` only in offline
  mode (C-30). Findings route to their owner under the retry cap; the user's checkpoint-2 revision
  requests route the same way, outside the cap (D-236).

### WU-47: Offline end-to-end pipeline run, recorded
- kind: build (recorded run)
- depends-on: [WU-44, WU-46]
- role: build coordinator, with an independent verifier checking the record
- touches: [the work-log only; temp dirs and a worktree. Failures re-open the owning unit]
- produces: [the M-12 record]
- consumes: [everything in this slice; the M-11 server]
- acceptance: [AC-W4, AC-W15, AC-W16, AC-W17, AC-W18, AC-W19, AC-W20, AC-W21, AC-W22, AC-W26]
- milestone: M-12
- summary: The procedure is fixed:
  1. **Setup.** A worktree at the commit under test, bootstrapped (`mise trust && pnpm install
     --frozen-lockfile && mise run pob:fetch && pnpm build`). Temp dirs for the builds folder, the state
     dir, the guides root and the server's cwd.
  2. **Server.** An MCP config registers this server under the name `pob2`, so the allowlists match,
     loaded so that the user's own `pob2` isn't (spine §9). It starts the server from the temp cwd with
     `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY` at the temp dirs,
     `POE_TRADE_DISABLED=true`, `POE_NINJA_DISABLED=true`,
     `POE_TRADE_BASE=http://127.0.0.1:9/api/trade2` and no `POESESSID`.
  3. **Session.** An interactive Claude Code session that the user starts in the worktree, with step 2's
     MCP config (D-263: a headless run isn't a real-world test of the skill): WebSearch and WebFetch
     denied; writes allowed under the temp guides root. **The kept evidence** is the session's own
     transcript and each workflow run's `journal.jsonl`, which records every agent's return value
     (platform §5). The journal holds no per-agent tool calls, so for workflow agents the enforcement is
     step 2's disabled groups and this step's denials, and the scans in AC-W16 and AC-W20 check what the
     evidence holds.
  4. **Run A** (workflow path): `/build-guide Titan "Blood Hunt" --offline --test A.json`, with answers
     checkpoint 1 `["first-viable"]` and checkpoint 2 `["accept"]`, and faults FI-1 `{concepts:["c1"],
     persistent:true}` and FI-2 `{concepts:"all", persistent:false}` (only the chosen concept reaches D1).
  5. **Run B** (fallback and failure routes): `--test B.json` with `orchestration:"agent-tool"`,
     answers checkpoint 1 `["pick:c1", "pick:c2"]` and no escalation answer, and faults FI-1
     `{concepts:"all", persistent:true}`, FI-3 `{concepts:["c1"]}` and FI-2 `{concepts:["c2"],
     persistent:true}`.
  6. **Seeded V4 check** (AC-W15), the probes (AC-W4, AC-W21, AC-W26), and the coordinator's guide review
     (AC-W22).

  If the session has no Workflow tool, run A records `agent-tool`, and WU-47 stops with
  `blocked: A-23` for the coordinator to decide (D-172).

  **Quality clauses.** A clause marked *(quality)* depends on how well the agents perform, not only on
  the code. A quality clause that misses gets one coordinator re-run of that run. If the re-run misses
  too, the coordinator logs a finding against the prompts (the owning unit's stage references) in the
  work-log, and the owning unit reworks them. That rework is not a gate failure of the code.

### WU-48: Human — the live Titan / Blood Hunt run and the user's sign-off
- kind: build (human gate)
- depends-on: [WU-47; HG-14]
- role: **user**, assisted by the build coordinator
- touches: [the user's guides and builds folders (coordinator and user only); the work-log]
- produces: [the alpha sign-off (M-13)]
- consumes: [everything]
- acceptance: [the WU-48 checklist below]
- milestone: M-13
- summary: The first live run, with web research on D-171's hosts and live pricing through the server.
  The user answers both checkpoints, then plays the guide.

**WU-48 checklist.** Each item is recorded pass or fail, with a note. Item 11 is set up before item 3,
and its file is shown to the user with item 1's approval.
1. **Approval.** HG-14's approval is recorded in the work-log before anything starts: live trade and
   poe.ninja through the server, web research on D-171's hosts, writes to the real guides and builds
   folders.
2. **Server.** The user's registered `pob2` server runs the M-12 commit, with trade enabled. The cookie
   is the user's own, and no agent handles it.
3. **Run.** In a session in the repo, `/build-guide Titan "Blood Hunt"` (online, no test config). The
   run log shows `answeredBy: "user"` for both checkpoints.
4. **Checker.** `check-run.mjs` exits 0 on the run folder.
5. **Checks pass.** The final record's V1 and V2 verdicts pass for every stage, and the final V3 and V4
   reports have no `unresolved` finding.
6. **PoB file.** The file has one loadout per stage. `encode_build_code` on it equals the record's
   `importCode` and the code in `guide.md`, and the code round-trips (D-180).
7. **Run log and evidence.** `pricing.totals.rateLimited` = 0 and `lockedOut` = 0 (NFR-22); the caps
   hold (NFR-23); every WebFetch in the kept evidence (WU-47 step 3) went to one of D-171's hosts.
8. **PoB2 import.** The user imports the code in PoB2 on Windows and sees one loadout per stage, and
   switching loadouts shows each stage (A-21).
9. **Play-test.** The user levels with the guide through the campaign and maps with an endgame variant.
   Issues are recorded.
10. **Sign-off.** The user signs off in the work-log (M-13 item 5). The run log's actuals are recorded
    for HG-15's envelope review.
11. **Session permissions.** For the run, the coordinator writes the project's
    `.claude/settings.local.json` (gitignored) and shows it to the user at HG-14's approval. The work-log
    records its rules:
    - Write and Edit are allowed only under the guides root;
    - WebFetch is allowed for `poe2db.tw`, `maxroll.gg`, `game8.co`, `poe-vault.com` and the patch-note
      mirrors the file names;
    - WebFetch is denied for `pathofexile.com` and `poe.ninja`.

## 13. Acceptance criteria

**The skill and its shared contracts (WU-43)**

- **AC-W1 (WU-43).** Static, `tests/static/buildGuidePipeline.test.ts`.
  - `.claude/skills/build-guide/SKILL.md` exists, with frontmatter `name: build-guide` and a
    description.
  - It names the workflows `build-guide-research` and `build-guide-design`, the five agent types of §4,
    `--offline` and `--test`.
  - Every `references/`, `templates/` and `scripts/` path it mentions exists.
- **AC-W2 (WU-43).** Unit, `tests/unit/buildGuideCheckRun.test.ts`, which spawns `node
  .claude/skills/build-guide/scripts/check-run.mjs <dir>` with an explicit env.
  - It exits 0 on the passing fixtures in `tests/fixtures/pipeline/`:
    - `run-ok/`, an offline run, which includes an endgame stage whose chaos resistance is below its
      cap, with a `chaosResistException` whose reason the guide's `Checks` states (D-234);
    - `run-ok-online/`, an online run with `ok` prices, whose budget total is over 20 and at most 22
      divines and whose guide carries the `near the ceiling` note (D-219).
  - On each broken copy it exits non-zero, and its stderr names the broken rule:
    - (a) `guide.md` is missing;
    - (b) a §8 H2 is missing or out of order;
    - (c) a Leveling H3 differs from the record's campaign loadout names;
    - (d) a `[^id]` marker has no definition, or a `ledger`, `data` or `price` definition names no
      existing entry;
    - (e) an `external` tag has no `accessed`;
    - (f) a `judgment` tag has no `confidence`;
    - (g) an `external-unavailable` tag appears in an `online` run;
    - (h) the guide's import code differs from the record's `importCode`;
    - (i) a required run-log field is missing;
    - (j) a cap is exceeded: any one of 4 concepts compiled in one research round, a V4 pass with 4
      lenses, a (stage, concept) with 3 retries, or `maxConcurrent` 4;
    - (k) an offline run has a `prices[]` status `ok` or a price call;
    - (l) a final-pass V3 or V4 report has an `unresolved` finding, other than one the user accepted at
      an escalation that the guide's `Accepted failures` H3 lists;
    - (m) the checker's own claim counts (§7.4) differ from a V3 or V4 report's coverage totals, or,
      by the checker's counts, V4 falls below D-179: an endgame `pob-data` claim isn't re-checked, or
      fewer than 1 in 5 elsewhere are;
    - (n) a V3 or V4 report misses a §7.4 field, or says `verdict: "pass"` alongside an `unresolved`
      finding;
    - (o) the D1 gate report says `floor: pass`, but the final record has an endgame stage with
      `MissingColdResist` above 0; and a second copy where an endgame stage has `MissingChaosResist`
      above 0 and its `chaosResistException` is removed (D-234);
    - (p) the budget doesn't hold up against the gate report. This covers three copies:
      - the report says `budget: pass`, but the plan's prices and the recorded rates give a total over
        22 divines;
      - a filled budget-variant slot maps to no `prices[]` entry;
      - the total is over 20, and the guide lacks `near the ceiling`;
    - (q) the rolled-skill gate doesn't hold up against the gate report. This covers two copies:
      - the report says `rolledSkill: pass`, but another group with the rolled group's role has a
        larger figure in the record;
      - the rolled group's role is `utility`.
  - The partial mode passes the fixture `run-escalated/` and fails it without `--partial`.
- **AC-W3 (WU-43).** Unit. The workflow harness loads a fixture saved-workflow script the way platform
  §5 describes.
  - It reads the `.js` file as text and takes out the `export const meta = {…}` literal.
  - It runs the body inside an `async function`, with fakes for `agent`, `parallel`, `pipeline`,
    `phase`, `log`, `budget`, `workflow` and `args`. Under those fakes, `Date.now()`, `Math.random()`
    and an argless `new Date()` throw.
  - It runs the script with scripted agent results, records each `agent()` call's options and task
    header, and measures the maximum number of agents in flight.
  - It reproduces `parallel` as a barrier and `pipeline` as barrier-free, and a scripted `null` reaches
    the script.
  - Two more fixtures fail with an error naming the cause: one whose `meta` holds a variable, and one
    that calls `Date.now()`.
- **AC-W23 (WU-43; positive allowlist probe, run early).** A recorded probe in a headless Claude Code
  session in a worktree. The session runs this server registered as `pob2` from a temp cwd, with temp
  `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY`, and trade and poe.ninja disabled.
  - A probe workflow script, uncommitted, starts one agent through `agentType`. Its probe definition,
    also uncommitted, carries the researcher's `tools:` line from §4.
  - The agent is told to call `mcp__pob2__lookup_game_data {mode: "gem", query: "Blood Hunt"}` and
    return the result. It returns a result naming the gem.
  - If the call succeeds only once ToolSearch is added to the probe's `tools:` line, ToolSearch joins
    every row of §4 (as §4 says), and the probe is recorded passing with it.
  - The work-log records the outcome: reached directly, reached with ToolSearch, or not reached. "Not
    reached" means A-24 is wrong, and WU-43 stops with `blocked: A-24` for the coordinator to decide.

**Research workflow (WU-44)**

- **AC-W5 (WU-44; extended by WU-45 and WU-46).** Static: every `.claude/agents/build-guide/*.md`
  satisfies R-1…R-5 of §4. The test parses the `tools:` line and checks each `mcp__pob2__` name against
  L, B, C and P and against `TOOL_META`. Each set's members exist in `TOOL_META`. L and B hold only
  group-`core`, kind-`read` tools, and none of them is `lua_save_build`, `export_build` or
  `save_config_preset`.
- **AC-W6 (WU-44).** Unit, harness over `build-guide-research` with scripted results.
  - 3 researcher agents run with at most 3 in flight, then one coordinator agent at a time, and no
    coordinator step overlaps any other agent.
  - Every `agent()` names an allowed `agentType` (R-6). Every task header carries the args' `mode` and
    `runFolder`, and every R1b header says `compile: "measure-only"`.
  - With 4 proposals returned, R1b runs for `c1`…`c3` only, and `c4` comes back `not-carried`.
  - With `pass: 2` and `firstId: 5`, ids start at `c5`, and that round again carries at most 3
    concepts.
- **AC-W7 (WU-44).** Unit, harness.
  - A concept whose R1b gate fails 3 times has 3 attempts, each later header carrying the earlier
    findings. It returns `failed`, with the last errors as evidence, and the other concepts still run.
  - All concepts failing returns `no-viable`, with every concept's evidence.
  - A `null` R1b result counts as a failed attempt.
  - FI-1 appears only in the targeted concept's headers, on attempt 1, or on every attempt when
    `persistent`.

**Design-and-write workflow (WU-45)**

- **AC-W8 (WU-45).** Unit, harness, happy path.
  - The step order is D1, D1 gate, D2, D2 gate, W1, then V3 and the three V4 lenses.
  - Every compile header before the D2 gate's pass says `measure-only`; exactly one step carries
    `compile: "final"` with `buildName`, and it is the passing D2 gate.
  - It returns `ready`.
- **AC-W9 (WU-45).** Unit, harness: each row of §5.3's D1 gate table, driven by scripted verdicts,
  gives that row's outcome. Retries carry the findings, and the cap is 2. `budget: "unverified"`
  proceeds. After `infeasible` or `escalated`, no D2 step runs.
- **AC-W10 (WU-45).** Unit, harness.
  - A D2 gate failing 3 times returns `escalated` with 3 attempts' findings, and no W1 runs.
  - A `null` W1 result re-runs W1.
  - FI-2's directive reaches only the D1 gate header for the targeted concept; FI-3 makes the D1 gate
    return `infeasible`.
- **AC-W11 (WU-45).** Static: `templates/guide-template.md` has §8's H2s in order, and the H3 `Checks`
  under both endgame H2s. The writer definition satisfies §4 (AC-W5 extended).
- **AC-W24 (WU-45).** Unit, harness, resuming after an escalation (§5.3, §5.4).
  - `resume: {reason: "guided-retry", stage: "D1", findings, guidance}` runs D1 once, with the findings
    and the guidance in its header's `findings`, then the D1 gate. The workflow's stats don't count
    that attempt as a cap-counted retry. A scripted gate failure on it returns `escalated` again.
  - `resume: {reason: "accepted", stage: "D1-gate", findings}`, with a V1 finding, re-runs the D1 gate
    with the finding in its header's `accepted`. A scripted verdict whose only failing finding equals
    the accepted one proceeds to D2. The D2 gate's and W1's headers carry the accepted finding.

**V3 and V4 (WU-46)**

- **AC-W12 (WU-46).** Unit, harness: after W1, one provenance agent and three verifier agents run,
  with lenses `ledger`, `sources` and `prose`, at most 3 in flight. The scripted D1, D2 and W1 results
  each carry a sentinel string. No V3 or V4 prompt contains a sentinel, and each V4 header holds only
  the §5.1 fields (D-142).
- **AC-W13 (WU-46).** Unit, harness, §5.5 routing.
  - An `unresolved` W1-owned finding re-runs W1, then V3 and V4.
  - A D1-owned finding re-runs D1, then the D1 gate, the D2 gate, the final compile, W1, V3 and V4.
  - A dossier finding runs the dossier fix step.
  - A third round for the same owner returns `escalated`.
  - Reports holding only `accepted-offline` findings return `ready`.
- **AC-W14 (WU-46).** Static: the provenance and verifier definitions satisfy §4 (no Write, Edit or
  Bash; no C or P tool). `references/fallback.md` lists the same agent types, in the same step order, as
  the harness records for the two workflows' happy paths (AC-W6, AC-W8).
- **AC-W25 (WU-46).** Unit, harness, the checkpoint-2 revision (§5.3).
  - `resume: {reason: "revision", round: 1, requests}` runs one `revise-map` coordinator step first.
  - Scripted to map one request to W1, it re-runs W1, with that request in its header's `findings`,
    then V3 and V4.
  - Scripted to map one request to D2 and one to W1, it re-runs D2, the D2 gate and final compile, W1,
    V3 and V4. Each owner's header carries only its own requests.
  - A scripted D2 gate failure after the revision still gets 2 retries before `escalated`.

**Offline end-to-end run (WU-47).** Recorded coordinator checks, re-checked by an independent verifier.
*(quality)* marks a quality clause (WU-47).

- **AC-W4 (WU-47; WU-43's test-config refusal).** A recorded probe in the M-12 environment: in the
  interactive session of step 3 (D-263), `/build-guide Titan "Blood Hunt" --test A.json`, without
  `--offline`, bounded to end before R1a starts.
  - The run folder's `run-log.json` exists, with `mode: "online"` and `testConfig: "refused"`.
  - No checkpoint is `pre-supplied`, and no `research/` file exists.
- **AC-W15 (WU-47; WU-46's `ledger` lens).** A recorded seeded check.
  - Copy run A's folder. In the copy's `plan.json`, wrap one ledger entry's formula as `(<formula>) * 2`
    (FI-4), leaving the record and the guide unchanged. Set the copy's `run-log.json` mode to `online`
    (FI-5).
  - In the M-12 environment, run the three lenses on the copy with the Agent tool
    (`subagent_type: build-guide-verifier`, pass 1).
  - The `ledger` lens reports an `unresolved` finding naming that ledger entry's id. A finding for every
    `external-unavailable` claim in the copy is `unresolved`.
- **AC-W16 (no network; D-181, D-201).**
  - (a) The recorded server env shows step 2's settings, without secrets.
  - (b) A scan of the kept evidence (step 3) finds no tool use named `WebSearch` or `WebFetch`, and
    none naming a P tool.
  - (c) Both run logs have `pricing.totals.calls` = 0.
  - (d) Every `prices[]` entry in every plan of both runs is `unavailable`.
  - (e) Every Bash command in the session transcript is listed in the work-log, and none runs a network
    client (`curl`, `wget`, `nc`, `ssh`) or names a host. No agent type has Bash (R-4).
- **AC-W17 (run A artifacts).**
  - `check-run.mjs` exits 0, and every file in C-36 and §2 exists.
  - `guide_run {validate: <runFolderRel>/plan.json}` returns no error.
  - The final record's V1 and V2 verdicts pass for every stage.
  - The temp builds folder holds exactly one file: the record's PoB path, named after `buildName`.
  - `encode_build_code` on that file equals the record's `importCode` and the guide's code, and decoding
    it gives one loadout per plan stage (D-180).
  - Every compiled concept has its record and its XML in `concepts/<id>/`, and the record names that XML
    (measure-only, D-208).
  - The dossier has 2 or 3 concepts. *(quality)*
  - The final V3 and V4 reports have no `unresolved` finding. *(quality)*
- **AC-W18 (run A log).**
  - `mode: "offline"`, `orchestration: "workflow"`, `testConfig: "accepted"`. `status: "completed"`
    *(quality)*.
  - `stages[]` follows the run order, with `startedAt` ≤ `endedAt` wherever both are non-null.
    `timeline[]` is in order.
  - The R1a agent count equals the number of research files, and is at most 3 for the one round.
  - `c1` has 3 R1b attempts and is `failed`, with `FI-1 Unknown Gem` in its evidence; checkpoint 1's
    `shown` lists it as failed.
  - The chosen concept's first D1 gate report has a V1 finding for the stage FI-2 edited, and that
    stage then passes within the retry cap. *(quality)*
  - Both checkpoints are `pre-supplied`.
  - `faults[]` shows FI-1 applied 3 times and FI-2 once.
  - NFR-23 holds.
- **AC-W19 (run B, the fallback and the failure routes).**
  - `orchestration: "agent-tool"`, `status: "escalated"`.
  - Checkpoint 1's first `shown` is the no-viable display, listing every concept with its FI-1
    evidence; the second shows `c1`'s FI-3 infeasibility evidence.
  - `c2`'s D1 has 3 attempts, each with a V1 finding, followed by one escalation; no D2 or W1 step ran.
  - The escalation records `choice: "stop"`, and its `checkpoints[]` entry has `answeredBy: "default"`.
  - No file in the temp builds folder comes from run B.
  - `check-run.mjs --partial` exits 0.
- **AC-W20 (write roots; D-177, C-17).**
  - `git status --porcelain` in the worktree is empty before and after.
  - Every file created under the temp guides root is inside run A's or run B's folder, or one of
    AC-W4's and AC-W26's probe run folders.
  - The temp builds folder holds only run A's PoB file.
  - No path under `/mnt/` appears in the tool calls of the kept evidence (step 3).
- **AC-W21 (allowlists are enforced; A-24).**
  - Two `build-guide-researcher` agents are each told to call `mcp__pob2__guide_run {new_run: "probe"}`
    and report the result: one started through the Workflow tool (`agentType`), one through the Agent
    tool. Neither can, and no `probe/` folder appears in the guides root.
  - A `build-guide-verifier` told to Write a file into the guides root leaves no file there.
- **AC-W22 (the coordinator's checkpoint-2 review; A-28).** The coordinator reads run A's `guide.md`
  against §8's table and records, per H2, whether it is present and complete. It also records whether a
  reader could follow it from level 1 to an endgame variant (the quality bar). Any `incomplete`
  re-opens WU-45.
- **AC-W26 (start-up refusals; D-238, D-210).** Recorded probes in the M-12 environment.
  - **Invalid roll.** `/build-guide Titan "No Such Skill" --offline` and
    `/build-guide "No Such Ascendancy" "Blood Hunt" --offline` each stop before any agent runs. Each
    reply lists the closest valid names, and neither creates a folder under the guides root.
  - **Unsaved build.** The coordinator loads a fixture build in the run's server and changes it with a
    `mutate` tool, without saving. It then runs `/build-guide Titan "Blood Hunt" --offline --test U.json`,
    where `U.json` has no `unsavedBuild` answer.
    - The run log has a `checkpoints[]` entry `unsaved-build`, answered `stop` with
      `answeredBy: "default"`, and `status: "stopped"`.
    - No `research/` file and no `compile-record.json` exist.

## 14. Test strategy (this slice)

| AC | Class | Runs in |
|---|---|---|
| AC-W1, W5, W11, W14 | static (pipeline files) | `mise run test` |
| AC-W2, W3 | unit (script check spawned with an explicit env; harness) | `mise run test` |
| AC-W6…W10, W12, W13, W24, W25 | unit (workflow harness with scripted agents) | `mise run test` |
| AC-W23 | recorded probe, early in the unit | WU-43 |
| AC-W4, W15…W22, W26 | pipeline run (recorded; independent verifier) | WU-47 |
| WU-48 checklist | human (HG-14) | the user |

The mock-agent tests exercise every failure path deterministically and offline. The recorded runs prove
that the real agents, tools and allowlists behave the same way. No test or run in this slice contacts
pathofexile.com, poe.ninja or D-171's hosts before M-13 (D-34, D-181).

## 15. Open items and their resolutions

The first draft left these holes in the inputs open. The coordinator resolved each on 2026-10-07, and
the spine records the resolutions as binding decisions (D-231…D-238). The user settled D-234, a
game-knowledge choice, on 2026-10-08. D-231 also corrects C-36's wording on who may call lookups
(§4, FR-W3).

| Id | Hole | Resolved by | Applied in |
|---|---|---|---|
| O-1 | "Ask for more" at checkpoint 1 (D-157) against the 3-concept cap (D-161, NFR-23) | **D-235:** the cap applies per research round; "ask for more" starts a new round of up to 3 concepts, only at the user's answer, and the run log records every round | §5.2, §6 `rounds[]`, §10, AC-W2 (j), AC-W6 |
| O-2 | Checkpoint 2 offered no revision loop | **D-236:** the user may ask for changes; each request is mapped to the stage responsible, which re-runs with every later stage and the checks; revisions count against no retry cap, and the run log records them | §5.3 resuming, §6 `revisions[]`, §10, AC-W25 |
| O-3 | What the user can choose after an escalation (D-141 says only "escalates") | **D-236:** accept, with the failure stated in the guide; give guidance and retry once more; go back to checkpoint 1; stop | §5.3 resuming, §5.4, §8, §11.2, AC-W24 |
| O-4 | Offline, V4 can't open the URL of a claim copied from C1/E1 | **D-232:** such a claim cites its fact as `data:<file>#<key>`; V4 checks it against the data-file fact and its stored citation, without fetching the URL offline | §7.3, §7.4, §11.1 |
| O-5 | The tag of a price claim | **D-237:** `price:<id>`, citing the plan's `prices[]` entry by its `id`; the entry holds the date, league and query | §7.3, §7.4, §8, §9 |
| O-6 | Whether the survival floor's "capped resistances" (D-118) includes chaos | **D-234 (user, 2026-10-08):** all four resistances are gated at their caps; chaos may stay uncapped only through a stage's recorded `chaosResistException` | §5.3 floor, §8, FR-W7, AC-W2 |
| O-7 | An invalid roll (an unknown ascendancy or skill) had no defined behaviour | **D-238:** before any agent runs, the skill checks the ascendancy (`get_classes`) and that the skill is an active skill gem (a gem lookup); a failure stops with the closest valid names and no run folder | FR-W2, AC-W26 |
| O-8 | `league` is required in every plan (C-31), but offline no tool reports it | **D-233:** `league` may be null only when every price is `unavailable` with `note: "offline run"`; the schema enforces it | §11.1 |
