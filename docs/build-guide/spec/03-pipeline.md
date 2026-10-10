# Slice 03: Pipeline — the build-guide skill, its runner and agents, the offline run, the alpha

**Status: fold applied 2026-10-10.** This slice folds in the build's pipeline decisions (D-239…D-266 and
D-305…D-314 where they touch the pipeline), amendment 1 (built: D-267…D-275), amendment 2 (approved
2026-10-09, **not built**: D-276…D-284), amendment 3 (approved 2026-10-10, **not built**: D-285…D-304) and
the fold's own resolutions (D-315…D-334, A-33, HG-22). The amendments stay as the rationale record; the
spine and this slice are authoritative.

Part of the [spec spine](README.md) ("spine"). It covers work units WU-43…WU-47 (built), WU-48 (the human
alpha) and WU-56…WU-59 and WU-62 (not built), and acceptance criteria AC-W1…AC-W33 (AC-W3, AC-W6…W10,
AC-W13, AC-W24 and AC-W25 withdrawn by D-267), plus the WU-48 checklist. Requirements trace to the spine's
contracts and decisions (C-30…C-54, D-100…D-334, A-20…A-33), the design rows they lift, the platform
grounding ("platform §") and ext §5 (the prior-art guide outline). `../worklog.md:n` cites the build's
work-log. §15 lists the open items and how each was settled. Prompt wording is tuned on real runs; this
slice fixes the contracts and required behaviours, not the prose of prompts.

- **The as-built source** for every built section is the skill itself: `.claude/skills/build-guide/`
  (`SKILL.md`, `references/`, `templates/`) and its run checker `scripts/check-run.mjs`. Where this slice
  and the skill disagree on built behaviour, the skill and the checker are right and this slice is fixed.
- **Target design.** A passage that describes behaviour not built yet carries a one-line *Target (WU-nn,
  D-nnn)* marker, and keeps the as-built behaviour beside it until that unit merges, so a build agent can
  tell the two apart. Amendment 2's pipeline unit (WU-62) merges before amendment 3's (WU-57, WU-58), which
  edit amendment 2's verdict line (D-317).

## 1. Existing system context (this slice)

- **`.claude/` today.** `.claude/skills/build-guide/` (`SKILL.md`; `references/` with `references/stages/`;
  `templates/`; `scripts/check-run.mjs`) and `.claude/agents/build-guide/` (four agent definitions), all
  project scope (D-152). There is no `.claude/workflows/`: amendment 1 deleted the two saved workflows, the
  workflow harness and the Agent-tool fallback (D-267). The agent-os agents and commands
  (`.claude/agents/agent-os/`, `.claude/commands/agent-os/`) predate this epic; `settings.local.json` is
  gitignored.
- **Platform facts relied on** (platform §1–§3):
  - A skill is instructions Claude follows. The runner starts each step with the Agent tool, naming a custom
    agent type in `subagent_type`; `run_in_background: true` runs parallel steps in the background (D-267).
  - A custom agent's `tools:` frontmatter is an allowlist. An MCP tool is named `mcp__<server>__<tool>`,
    and an allowlist drops inherited MCP tools unless each is named (A-24). AC-W23 recorded that an
    allowlisted agent reaches a deferred MCP tool directly, without ToolSearch (`../worklog.md:257-260`).
  - Subagents share the session's MCP server, hence one engine (A-22, as D-267 rewords it). Lookups take the
    session lock and only queue (D-130).
  - Each subagent's transcript records its tool calls, which makes the session's transcripts the post-run
    evidence for every agent (D-267).
- **Server surface consumed** (slices 1 and 2):
  - lookups: C-37 `lookup_game_data`, C-38 `check_model_coverage`, C-43 `search_tree_nodes`, and the
    existing `get_classes`;
  - measurements: C-45 (per-skill breakdown) and C-47 (rankers that list what PoB can't measure);
  - C-41 `compile_plan`, with its measure-only (D-208) and final modes. Its text prints every V1/V2 finding
    up to 200 over all stages, then says how many more there are and where to Grep the record for them
    (D-273);
  - C-50 `guide_run` (D-216). `{new_run: <slug>}` creates the run folder without any engine call and
    replies with its absolute path, its root-relative path and `loadedBuildUnsaved`, whether the engine's
    loaded build has unsaved changes (D-207, D-210). `{validate: <plan_path>}` runs as kind `read` through
    the router's per-call kind rule (D-244): it checks a plan and mutates nothing (D-167);
  - C-42 `encode_build_code`;
  - the dated price outputs (C-49, WU-49), whose errors start with a stable `[trade:<kind>]` prefix
    (D-218), and the limiter's `would_wait`/`locked_out` answers (C-11).
  - *Target (WU-52, WU-53, WU-54, WU-60; D-297, D-299, D-300, D-277):* the poe.ninja tools for popularity
    and the build index (C-54), and the lookup and coverage additions (C-37, C-38), among them a mod hit
    that lists the base types that can roll it and a searchable essence table.

  The registration names the server `pob2` (stab D-16), so allowlists name `mcp__pob2__<tool>`.
- **Tool groups** (stab C-1): `POE_TRADE_DISABLED=true` hides group `trade` and `POE_NINJA_DISABLED=true`
  hides group `ninja`, so in M-12 the price tools don't exist for anyone.
  *Target (WU-52, D-297):* the new poe.ninja tools join group `ninja`, so the same flag hides them.
- **Kind `read` is not "writes nothing"** (`src/server/toolMeta.ts`): `lua_save_build`, `export_build`
  and `save_config_preset` are `read` but write into the builds folder or the state dir, and
  `guide_run`'s `new_run` mode creates a folder. Allowlists are therefore enumerated sets (§4), never
  "every `read` tool".

## 2. Run folder layout and file ownership (C-34 inside a run; C-36)

After the roll check (FR-W2), the runner's first server write is `guide_run {new_run: <slug>}`; every step
and agent then uses the returned absolute path (D-207, D-216). `runFolderRel` is `<slug>/<YYYY-MM-DD>-<n>`;
a plan's `plan_path` is `<runFolderRel>/plan.json`, or `<runFolderRel>/concepts/<id>/plan.json` for a
concept skeleton.

**Slug.** `<ascendancy>-<skill>` in lower case, each run of characters outside `[a-z0-9]` replaced by one
`-`, trimmed of `-` (Titan / Blood Hunt → `titan-blood-hunt`); the server takes at most 64 characters. Each
run gets a new dated folder and never writes into an earlier run's (D-153).
*Target (WU-57, D-285):* the slug comes from the brief at the start (`titan-blood-hunt`, `titan-open`,
`open-<first playstyle tag>`); the card picked later is recorded in the run log, not in the folder name.

| Path in the run folder | Written by (only) | Content |
|---|---|---|
| `run-log.json` | the runner | §6 (D-270) |
| `research/p<k>-r1a-<n>.md` | R1a researcher `n` of research round `k` | its sections, with source markers (§7.3) |
| `concepts/<id>/plan.json` | the R1b step for concept `<id>` | an endgame skeleton plan (C-31) with its key-item prices |
| `concepts/<id>/compile-record.json`, `concepts/<id>/compiled-build.xml` | `compile_plan`, measure-only (D-208) | the skeleton's record (C-33) and compiled XML |
| `dossier.md` | the R1b-assemble step only (D-269) | §7.2 |
| `plan.json` | the D1 and D2 steps; the D1 gate step only to apply FI-2 (§11.3) and the final re-price pass (§9) | C-31 |
| `compile-record.json`, `compiled-build.xml` | `compile_plan` | the record of the last compile of `plan.json`; after the final compile it names the PoB file and holds `importCode` (D-260) |
| `guide.md` | W1; the runner replaces its `Known issues` list (step 14, D-265) | §8 |
| `reports/gates/<stage>-<concept>-a<attempt>.json` | the gate step itself: R1b, D1-gate or D2-gate (D-267) | its verdict (§5.3) |
| `reports/v4-<lens>.json`, `reports/v4-<lens>-recheck.json` | the runner, from the verifier's return, unchanged (D-267) | the V4 full pass and re-check reports (§7.4) |
| `audit.md` | W1, which writes it and patches it with Edit; the runner fills its `Known issues` table (step 14) | *Target (WU-62, D-278):* the audit layer (§7.8) |
| `cards/<id>.md` | R1a (the brainstorm half), then R1b (the verification half) | *Target (WU-57, D-291):* a candidate card (§7.5) |
| `cards.md` | R1a-assemble | *Target (WU-57, D-287):* the dealt deck, plus "Not dealt" (§7.5) |
| `probes/<card-id>/<n>/` | R1b | *Target (WU-57, D-292, D-331):* a probe variant's one-stage plan; `compile_plan` writes its measure-only record and XML beside it (§7.7) |

- **Concept ids** are `c1`, `c2`, … in proposal order (researcher order, then each file's proposals in file
  order), unique within the run across research rounds.
  *Target (WU-57, D-286, D-319):* card ids `r<round>-<researcher letter>-<n>`, for example `r1-a-2`, with the
  card at `cards/<id>.md`. The runner letters the researchers when it starts them, so parallel researchers
  never collide. `research/p<k>-r1a-<n>.md` stays; if WU-57 finds the research files unused, it removes
  them and records a decision row.
- `<stage>` in a gate file is `R1b`, `D1-gate` or `D2-gate`; `<attempt>` counts from 1 per (stage,
  concept), as the header and the run log's `stages[]` do; `<lens>` is `ledger`, `sources` or `prose`.
- A revision's verification rewrites the V4 reports; the run log's order says which re-check belongs to the
  last full pass.
- **Nothing else goes in the run folder**, and the run checker fails a stray file. No agent writes outside
  it (D-177), and agents running in parallel write different files (C-36).
- **The PoB file.** Only the final compile writes one, through C-17 (D-208); its `build_name` is
  `<slug>-<YYYY-MM-DD>-<n>`, the run folder's last two segments joined with `-`, so every run writes a new
  file (D-113, D-199). Every earlier compile, the concept skeletons' included, is measure-only. A re-compile
  within the run (the fix round's or a revision's) rewrites that same file (D-153, D-199). The server's
  write ledger allows that only while the file is unchanged since this run wrote it. Otherwise the compile
  is refused: with C-17's changed-on-disk wording when anyone edited the file in between, and with C-17's
  "already exists" wording when the ledger has no entry for this run (D-211). A refusal is a failed attempt
  like any other, reported and never worked around.

## 3. The skill and its runner (O1; D-152, D-267)

`.claude/skills/build-guide/` holds `SKILL.md`, shared references (`references/`), stage references
(`references/stages/<stage>.md`), templates (`templates/`) and the run checker (`scripts/check-run.mjs`).
The **runner** is the user's own Claude Code session following `SKILL.md`: it starts the run, calls one
agent per step with the Agent tool, asks the user at the checkpoints, keeps the run log, writes the
verifiers' reports and runs the run checker. The agents research, design, compile, write and check (D-267).

- **FR-W1 (invocation).** `/build-guide <ascendancy> <skill> [--offline [--test <path>]]`; multi-word names
  are quoted (`/build-guide Titan "Blood Hunt"`). The checked names become the run's roll, which every plan
  carries as `roll` `{className, ascendancy, skill}` (C-31).
  *Target (WU-57, C-51, D-285):* `/build-guide <free text> [--offline [--test <path>]] [--no-ninja]`. The
  runner parses the free text into a **brief** before any run folder exists, so FR-W2's checks run on it
  before any agent does, and the brainstorm gate echoes it at its top (§10). (Amendment 3 says "the
  coordinator parses"; the runner reading is PROPOSED by the coordinator, 2026-10-10, C-51.) Today's
  `<ascendancy> <skill>` form still works. The brief's fields are all optional:

  | Field | Example |
  |---|---|
  | `ascendancy` | Titan |
  | `skill` | Blood Hunt |
  | `playstyle` | tags from the vocabulary below, plus free text |
  | `budget` | `budget` or `non-budget` (the endgame variants), or a figure in divines |
  | `around` | an item or mechanic to build around: "Melting Maelstrom", "block" |
  | `like` | a reference build and what to change: "like the Eraser, but not Gemling" |
  | `notes` | anything else |

  - **Playstyle vocabulary**, which cards use too: delivery `melee`, `ranged-attack`, `spell`, `minion`,
    `totem-trap`, `mixed`; buttons `one-button`, `few-buttons`, `combo`; focus `clear`, `boss`,
    `balanced`; defence `tanky`, `balanced`, `glass`; pace `fast`, `steady`.
  - A randomizer roll is the brief `{ascendancy, skill}`. An empty brief means "surprise me": the
    brainstorm seeds from the pattern library's families and, with poe.ninja on, from skills few characters
    play.
  - `--no-ninja`: the run calls no tool in group `ninja`, neither C-54's poe.ninja tools nor
    `get_currency_rates`, so price totals in divines are `unverified` (pricing's path when rates are missing),
    and the cards say "no player evidence" (D-297, D-333).
- **FR-W2 (start).** In this order, before any agent runs:
  1. **Roll check** (D-238, D-258). `get_classes` must list the ascendancy (case-insensitively); the runner
     notes its class. `lookup_game_data {mode: "gem", query: <skill>}` must give a result headed
     `## <skill>` that says `Kind: active`; a support gem, or no such result, fails. On a failure the runner
     stops, creates no run folder, writes nothing, and lists the closest valid names: ascendancies from
     `get_classes`; for the skill, the names the lookup lists under `Closest active gem names (…)`, in its
     order (when it matched only other gems, those gems' names; for a support gem, that it is a support).
     From then on the names are used exactly as the tools gave them.
     *Target (WU-57, D-285, D-286):* the brief's named fields are checked the same way, and each card's
     identity is checked at deck assembly (§5.2).
  2. `guide_run {new_run: <slug>}` creates the run folder and replies with its absolute path, its
     root-relative path and `loadedBuildUnsaved` (C-50).
  3. **Run log.** A test config given with `--offline` is read first; a file that can't be read or isn't
     the documented shape (§11.2) is refused (`testConfig: "refused"`) and the run stops (`stopped`, with
     the reason in the reply). The runner writes `run-log.json` with `status: "running"`, the mode and
     `testConfig` (§6).
  4. **Unsaved build** (D-210). If the `new_run` reply has `loadedBuildUnsaved: true`, the runner asks the
     user before the first compile: proceed, which discards the loaded build's unsaved changes, or stop
     (the run ends `stopped`). In offline test mode, `answers.unsavedBuild` answers it (§11.2).

  The runner rewrites the whole log after every step, checkpoint and question, so an interrupted run still
  leaves one (D-270).
- **FR-W3 (one coordinator; C-36 as corrected by D-231; D-130, D-112).** During a run the runner calls no
  `pob2` tool except `get_classes` and `lookup_game_data` for the roll check and `guide_run {new_run}`.
  Lookups (the tools in L, §4) may also be called by the R1a researchers, the V4 verifiers and coordinator
  steps. Every engine-changing and trade call is made by a coordinator step, and no coordinator step
  overlaps any other agent.
  *Target (WU-57, D-297):* the researchers and coordinator steps may also call the poe.ninja tools (N, §4).
- **FR-W4 (Agent calls; D-267).**
  - One Agent call per step, its `subagent_type` one of the four build-guide types (§4). A default agent
    would see every tool.
  - The prompt is the task header (§5.1), a fenced `json` block, then one line: `Read
    .claude/skills/build-guide/references/stages/<stage>.md and do that step.` It adds only what the stage
    reference lists under "Prompt". The verifier's prompt is exactly the header and that line (R-5, D-142).
  - At most 3 agents are in flight, and a coordinator step never overlaps another agent. R1a's researchers
    and the V4 lenses run in parallel, in the background; every other step runs alone.
  - An agent writes only its header's `writes` and returns at most 8 lines: what it wrote and the outcome.
    A gate step's verdict is its own file under `reports/gates/`, which the runner reads to route. The
    verifier can't write: it returns its report as JSON, which the runner writes unchanged.
  - **A missing return.** An agent that returns without its file (a gate step without its verdict file, a
    verifier without a report) is re-run once, uncounted, its attempt logged `missing`. A second miss ends
    the run `stopped`, naming the step.
  - **What the runner reads:** the gate verdict files, its own `run-log.json`, the test config, the
    agents' returns and the verifiers' reports. It never reads `plan.json`, a compile record, `dossier.md`
    or `guide.md` (one final record was 268 KB), with Read or Bash. Step 14 reads only the `Known issues`
    lines it edits, found from the `known-issues-line` W1 returned last.
- **FR-W5 (the runner's Bash; D-265 e).** The runner's Bash reads files and runs the run checker, nothing
  else: `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq`, alone or piped into one another (`cd` before
  them is fine), each with no redirection, no `tee`, no flag that writes a file and no command substitution
  feeding another tool; and `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`. No other
  `node` call, no `git`, `find`, `sort`, `sed`, `awk`, network client or host, and nothing that writes,
  moves or deletes a file: the runner writes every file with Write or Edit. The agents have no Bash (R-4).
- **FR-W6 (persistence; D-267).** Gate steps write their own verdict files. The runner writes each V4
  report from the verifier's return, unchanged, then the run log.
- **FR-W7 (run checker; D-271).** `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`,
  with no `--partial` (that flag is now a usage error, exit 2). The runner runs it at step 15 and once more
  after the run's last log write. It uses Node built-ins plus the server's compiled ledger evaluator
  `build/plan/ledger.js` and build projection `build/plan/buildHash.js` (D-266), and makes no network call.
  Each violation is one stderr line `check-run: [<rule>] <message>`, and the exit code is 1; a clean folder
  exits 0. It checks what the folder holds, whatever the run's status, and once a guide exists every guide
  check applies. It checks artifacts, not self-reports:
  1. **The artifacts.** §2's layout. The dossier's H2s (§7.2). The guide's H2s, its `Checks` H3s, and its
     Leveling H3s equal to the record's campaign loadout names (§8). Every marker resolves and parses as a
     C-30 tag (§7.3). Offline, every price is `unavailable` and no step priced. The guide's import code
     equals the record's (D-205). `Known issues` holds every accepted gate finding and every finding open
     after the re-check, each open one as `- <reader> (<id>)` with the finding's `reader` sentence, and no
     other line: no stale line from an earlier cycle, and `None.` only when nothing is open or accepted
     (D-265 d). Every `unresolved` V4 finding has its `reader`. Every campaign reward choice the campaign
     passes is picked, with the same pick on every stage after it, the endgame stages included, and the
     guide's `Campaign rewards` cites each pick (D-265 c). A V4 report superseded by one that checked every
     claim again is held to the artifact as it was when it was written (D-265 a).
  2. **The final record.** V1 and V2 pass for every stage, accepted findings aside. `sha1(plan.json)`
     equals the record's `planSha1`. After claims-only owners edited the plan (`claims-edited`, D-264), the
     record must still be the last D2 gate's final compile, and the sha1 of the plan's build projection
     (the plan without `stages[].claims` and without every `source` and `tag` field) must equal the record's
     `buildSha1` (D-266). The decoded `importCode` matches the record's `pobFile` sha1, with one tree set
     per plan stage titled by the record's loadout names (D-215). Every ledger entry, re-evaluated over the
     record by the server's evaluator, equals the record's value to 2 decimals.
  3. **The D1 gate, recomputed** from the record and the plan (§5.3): the floor (with D-254's and D-256's
     reference hits and D-234's chaos exception), the budget (D-219, D-249) and the rolled skill, its
     figure's stat set equal to `skills.main.statSet` (D-273). It fails a verdict that differs from its own
     and, once a guide exists, any gate failure no accepted finding covers (D-312).
  4. **The run log and the control flow** (§6): the fields and their values; steps in a legal order; each
     gate attempt logged with the outcome its verdict file routes to; R1b at most 3 counted attempts and
     each gate at most 2 counted retries (D-272: only an attempt-1 failure the verdict's `faultsApplied`
     explains is free); at most 3 R1a researchers and 3 R1b concepts per research round (D-235); one full V4
     pass and at most one re-check per verification cycle, of all three lenses if and only if a gate re-ran
     in the fix round, else of each lens that raised a finding and the sources lens (D-264); a claims-only
     owner only before any gate of its round and never directly before a gate; escalations only from the
     gates, each naming its verdict file; a `rule` on every pre-supplied or default answer; and `completed`
     only after checkpoint 2's accept.
  5. **What is current.** The runner can't delete files, so the log says which artifacts are current: the
     guide is current when no design step ran after its W1, and the final record when no producer that
     recompiled ran after the last D2 gate (a claims-only D1 or D2 leaves it current). A guide, V4 reports or
     a record from an earlier cycle or concept aren't held to the current plan.

  *Target (WU-62, D-283, D-281):* amendment 2's deterministic guards (§8's target): the 3,000-word cap; the
  new headings, `audit.md`'s included; no markers in `guide.md`; one fixed-form verdict line per endgame
  rung, compared with the record; reward picks by name; Known issues by sentence, with each id in
  `audit.md`; the entering-maps rung's floor and its budget of 5 divines (5.5 with "near the ceiling").
  *Target (WU-58, D-287, D-289, D-294, D-326):* run log v3 (§6); brainstorm and verification rounds and their
  caps; the renamed answers; the verdict line's "Effective HP about <n>." against `TotalEHP`; the D1 gate
  recompute reads figure × count. The checker accepts run logs of schema 2 and 3; schema 2 only so recorded
  runs (WU-47's) still check.

## 4. Agent definitions and tool allowlists (D-130, D-142, D-178, A-24, D-267)

Four definitions in `.claude/agents/build-guide/` (D-267). Each holds its role: the allowlist and the
standing rules (write only inside the run folder; never read `.env`; web only on D-171's hosts, never
pathofexile.com or poe.ninja; offline-mode rules, §11.1). Stage instructions live in the stage references.
*Target (WU-57, D-297):* the poe.ninja rule becomes "never contact pathofexile.com or poe.ninja yourself;
poe.ninja only through the server's poe.ninja tools", in `SKILL.md` and in the researcher's and the
coordinator's definitions.

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
- *Target (WU-52, WU-57; C-54, D-297):* **N, poe.ninja:** the popularity and build-index tools of group
  `ninja`, named by spike WU-50 (D-324). They are not price tools; prices stay with P.

**Who calls what** (C-36 as corrected by D-231; D-130). Lookups (L) may be called by the R1a researchers,
the V4 verifiers and the coordinator. Engine-mutating calls and all trade calls are made only by the
coordinator. *Target (WU-57, D-297):* N by the researchers and the coordinator.

| Type | Runs | File tools | `pob2` tools | Web |
|---|---|---|---|---|
| `build-guide-researcher` | R1a | Read, Glob, Grep, Write | ⊆ L; *target (WU-57, D-297):* ⊆ L ∪ N | WebSearch, WebFetch |
| `build-guide-coordinator` | R1b, R1b-assemble, D1, D1-gate, D2, D2-gate (with the final compile); *target (WU-57, D-287):* R1a-assemble | Read, Glob, Grep, Write, Edit | ⊆ L ∪ B ∪ C ∪ P; *target (WU-57, D-297):* also N | WebSearch, WebFetch |
| `build-guide-writer` | W1 | Read, Glob, Grep, Write, Edit (D-257) | none | none |
| `build-guide-verifier` | V4 lenses | Read, Glob, Grep | ⊆ L | WebFetch |

The coordinator runs no dossier fix and maps no revision requests (D-267, D-269), and the provenance type is
gone, with V3 (D-267, D-268).

**ToolSearch.** AC-W23 recorded "reached directly": an allowlisted agent reaches a deferred MCP tool without
ToolSearch, so ToolSearch joins no row.

**Rules** (checked by AC-W5):
- **R-1.** Frontmatter `name` equals the file stem; `tools:` is one comma-separated line (no YAML parser
  is allowed, HG-10).
- **R-2.** Each type's tools are a subset of its row above.
- **R-3.** Only `build-guide-coordinator` names a tool in C or P: only the coordinator compiles and prices
  (D-130, D-178). *Target (WU-57, D-297):* the researchers may name N tools; C and P stay the coordinator's.
- **R-4.** No definition names Bash, Agent, Skill, Workflow or NotebookEdit, or any `pob2` tool outside
  L ∪ B ∪ C ∪ P (*target (WU-57, D-297):* L ∪ B ∪ C ∪ P ∪ N). So no `mutate`, `lifecycle` or other `load`
  tool and no file-writing tool: the plan is the source of truth and the compiler builds from it (D-113,
  D-155); the compiled build stays loaded for B's reads (D-191).
- **R-5.** The verifier can't write: it returns its report as JSON, which the runner writes unchanged
  (§7.4), and it can't edit what it checks. V4 is a separate type from the coordinator and the writer,
  starts with a fresh context, and its prompt carries only the task header and the reference line, no text
  from the steps that wrote the plan or the guide (D-142).
- **R-6.** Every Agent call `SKILL.md` names gives a `subagent_type`, one of these four (D-267).

## 5. Control flow

### 5.1 Task header (D-267)

Every agent prompt starts with a fenced `json` block, the task header. The runner builds it from the run
state; the agent reads its job from the header and the stage reference it names, and nothing else in the
prompt contradicts it.

| Field | Content |
|---|---|
| `stage` | `R1a`, `R1b`, `R1b-assemble`, `D1`, `D1-gate`, `D2`, `D2-gate`, `W1` or `V4`. *Target (WU-57, D-287):* also `R1a-assemble` |
| `attempt` | this step's attempt for its (stage, concept), from 1: every call counts, retries and re-runs included |
| `concept` | the concept id (`c<n>`), where the step concerns one. *Target (WU-57, D-286):* the card id |
| `lens` | V4 only: `ledger`, `sources` or `prose` |
| `check` | V4 only: `full` (step 11, every claim in the lens) or `recheck` (step 13, only `findings` and `changed`) |
| `mode` | `offline` or `online`, as the run log records it |
| `runFolder`, `runFolderRel` | the run folder's absolute path, and its path relative to the guides root (§2) |
| `compile` | `none`, `measure-only` or `final`: what this step may ask `compile_plan` for |
| `buildName` | the D2 gate only: `<slug>-<YYYY-MM-DD>-<n>`, for its final compile |
| `findings` | what to fix or check: the earlier attempt's gate verdict (its file and findings), the V4 findings routed to this owner, the user's revision requests (`code: "user-request"`) or guidance (`code: "user-guidance"`); for a V4 re-check, the lens's own open findings; `[]` otherwise |
| `changed` | a V4 re-check, and W1 in the fix round: the locations the fix round's owners changed, or `"all"` when a gate re-ran in the fix round (D-264) |
| `accepted` | gate findings the user accepted at an escalation, from its verdict file (§5.4) |
| `faults` | offline test mode only: this step's fault directives (§11.3) |
| `writes` | the run-folder paths this step may write; nothing else. *Target (WU-62, D-278):* W1's include `audit.md` |
| `reference` | the step's stage reference, under `references/stages/` |

Rules: a step writes only the paths in `writes`, all inside the run folder (D-177), and steps running in
parallel never share a path; a gate step's `writes` include its verdict file. A V4 prompt is the header and
the reference line, and `changed` holds locations, never text (R-5, D-142). `compile: "none"` means no
`compile_plan` call; only the D2 gate carries `final`, with `buildName`, and it compiles measure-only first.
Faults travel only in headers, only in offline test mode, and only to the steps they target. The header has
no `pass` field (D-267).

### 5.2 The steps (D-267, D-268, D-272)

`SKILL.md`'s step list, as built:

| # | Step | Agent type | Writes | Returns, user, retries |
|---|---|---|---|---|
| 1 | Start (FR-W2) | the runner | `run-log.json` | asks the user when `loadedBuildUnsaved` (D-210) |
| 2 | R1a, research round *k* | `build-guide-researcher`, ≤ 3 in parallel | `research/p<k>-r1a-<n>.md` | its file and concept titles |
| 3 | R1b, one concept at a time, ≤ 3 per round (D-235) | `build-guide-coordinator` | `concepts/<id>/plan.json`, `reports/gates/R1b-<id>-a<n>.json` | compiled or not; a compile failure re-runs, ≤ 2 counted retries, then the concept is `failed` |
| 4 | R1b-assemble | `build-guide-coordinator` | `dossier.md` | the checkpoint-1 comparison, one line per concept |
| 5 | Checkpoint 1 (§10) | the runner | log | asks the user: pick, more (step 2, round *k*+1) or stop |
| 6 | D1, the endgame | `build-guide-coordinator` | `plan.json` (its endgame stages, `skills.main.statSet` set) | `done` or `infeasible` |
| 7 | D1-gate | `build-guide-coordinator`, fresh | `reports/gates/D1-gate-<c>-a<n>.json`; `plan.json` (FI-2 and the final re-price pass) | one verdict line; routed by §5.3 |
| 8 | D2, the campaign | `build-guide-coordinator` | `plan.json` (its campaign stages) | `done` |
| 9 | D2-gate and the final compile | `build-guide-coordinator`, fresh | `reports/gates/D2-gate-<c>-a<n>.json`; the PoB file through the server | one verdict line; a failure re-runs D2, ≤ 2 counted retries, then escalates |
| 10 | W1, the guide | `build-guide-writer` | `guide.md` | at most 8 lines, with its `known-issues-line` |
| 11 | V4, one full pass | `build-guide-verifier` ×3 in parallel (`ledger`, `sources`, `prose`) | none; the runner writes `reports/v4-<lens>.json` | its report |
| 12 | Fix round, once, only with open findings, uncounted | the owners: D1, D2, W1 | their own files: claims edited in place; a compile only for a build change | the ids fixed, the locations changed, and whether it recompiled |
| 13 | V4 re-check | `build-guide-verifier`, in parallel (§5.5) | none; the runner writes `reports/v4-<lens>-recheck.json` | its report; no further round |
| 14 | Known issues | the runner | the `Known issues` list in `guide.md` | — |
| 15 | Run checker | the runner (Bash) | — | its result, shown at step 16 |
| 16 | Checkpoint 2 (§10) | the runner | log | asks the user: accept, ask for changes (a revision, §5.6), or anything else |

**Retries, in full** (D-272). The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each.
These attempts count against no cap: an attempt failed by a fault directive that applies to attempt 1 only
(a persistent directive's failed attempts do count), a guided retry, the fix round, a revision, and the
re-run after a missing return. Verification never runs a lens again for its findings beyond the one
re-check, and never escalates; only the D1 and D2 gates escalate (D-268).

**Research** (steps 2 to 4; D-311, D-235):
- **R1a.** Three researchers, one per focus, each writing `research/p<k>-r1a-<n>.md` (round `k`, researcher
  `n`); a later round's prompt carries the user's note, and its researchers read `dossier.md` first and
  propose only concepts it doesn't hold. A proposal has C-36's seven fields (key uniques, ascendancy nodes,
  supports, keystones, feasibility read, risks, what PoB can't verify), each a labelled bullet.

  | Researcher | Focus | Sections | Proposes |
  |---|---|---|---|
  | 1 | `mechanics` | `Mechanics`, `Config gaps` (D-123) | 0 or 1 concept, led by the rolled skill or its supports |
  | 2 | `items` | `Synergy search` | 1 or 2 concepts, led by key items (uniques) |
  | 3 | `tree` | `Synergy search` | 1 concept, led by tree notables, keystones or ascendancy nodes |

- **Concept ids and the cap.** The runner numbers the returned proposals `c<firstId>`, … in researcher
  order, each file's in file order; `firstId` is 1 in the first round, then one more than the highest id so
  far. It carries at most 3 per round (D-235); the rest are `not-carried`, never dropped silently.
- **R1b**, for each carried concept in id order, one at a time. It makes at most two measure-only compiles
  per attempt: an optional bootstrap of a tree-minimal skeleton, after which it paths to its tree targets
  with `find_path_to_node`, then the last compile of the whole skeleton. It validates the skeleton
  (`guide_run {validate}`) before any price call, prices the concept's key items (§9) and validates again,
  so no trade call is spent on an item validation would reject. **Gate:** the last compile succeeded with no
  compile error (C-36). A failed attempt re-runs with its verdict file as `findings`, up to 2 counted
  retries; then the concept is `failed`, its last verdict file the evidence (D-141). FI-1 goes into the
  attempt's first compile, the bootstrap, which then always runs (D-265 f). When trade can't be reached
  online, the skeleton reuses another plan's league, else `Standard`, and its verdict says
  `leagueUnverified: true` (D-313).
- **R1b-assemble** writes `dossier.md` (§7.2) from the round's research files and the carried concepts'
  skeletons. Its prompt lists the round, `firstId`, the note, each research file (and whether its
  researcher returned), and each concept `{id, title, proposedIn, status, attempts, verdict}`. It confirms
  each viable concept's record exists beside its skeleton (else marks it `failed`), and returns the
  checkpoint-1 comparison.

**Design** (steps 6 to 9; §5.3). `buildName` is `<slug>-<YYYY-MM-DD>-<n>`, the run folder's last two segments
joined with `-`.
- **D1** writes `plan.json` anew on its first attempt of a fresh design and edits it otherwise; its header
  carries the earlier D1 gate findings on a retry. It writes the endgame stages of both variants, each with
  its `level`, per-gem levels and `ascendancyPoints` with a source or rationale (D-193), a `role` on every
  skill group and `skills.rolledGroup` (D-217), `skills.main` on the rolled group with `skills.main.statSet`
  (D-273); it prices every slot and tree jewel of both variants (§9) and compiles measure-only as often as it
  needs. It never takes a league a skeleton marks unverified: with no league known, it writes
  `"league": "unverified"` and makes every price `unavailable` (D-313). It returns `done` or `infeasible`,
  with a reason.
- **The D1 gate** is a fresh coordinator step after every D1 attempt: FI-2 if targeted, the final re-price
  pass (§9), a measure-only compile, the verdict file (§5.3).
- **D2** adds the campaign stages (D-104, D-108…D-110, D-144), planned backward from D1, and picks every
  campaign reward choice, listed on every stage at or after its quest, the endgame stages included (D-265 c).
- **The D2 gate** checks every stage and, when the compile, V1 and V2 pass, runs the final compile with
  `buildName` in the same step.
- **Pricing.** The runner tells each coordinator step how to price: offline; stopped (once any `stages[]`
  entry's `priceOutcomes` counts a `locked_out` or `rate_limited` call); or paced. The D1 gate reads it from
  `run-log.json` itself.

*Target (WU-57; D-287…D-292, D-298):* **three phases, each ending at a gate the user answers.** A fixed roll
runs the same three phases, and every card's skill is the rolled skill.
- **Brainstorm.** R1a: three researchers, each reading the pattern library (§7.6) first and writing 2–3
  cards' brainstorm halves (§7.5). The foci stay mechanics, items and tree, each starting from the brief's
  fixed pieces:

  | Brief | Mechanics | Items | Tree |
  |---|---|---|---|
  | names a skill | from the skill, as today | from `around`, or from uniques that change how a skill plays | from the ascendancy's nodes |
  | names no skill | from the library's families and the playstyle tags | (same) | (same) |
  | names no ascendancy | (as above) | (same) | from ascendancies that suit the playstyle, and under-played ones when poe.ninja is on |

  Then **R1a-assemble**, a coordinator step, deals the deck: it reads the card files, merges duplicates,
  checks each card's identity `{className, ascendancy, skill}` as the roll check does (`get_classes`, then
  `lookup_game_data` with `Kind: active`, or for a non-skill damage source a lookup by its kind; D-286, D-334), and applies the sniff test: a card is dealt only when a
  lookup confirms every load-bearing link in game text, and otherwise goes under "Not dealt", naming the
  unconfirmed link (the user can still ask for it at the gate). It writes `cards.md`, one line per dealt card.
  A round deals 6–9 cards; with poe.ninja on, each deck holds at least two below a popularity threshold that
  spike WU-50 sets (D-298, D-324). A later round reads `cards.md` and adds only new cards. Then the brainstorm
  gate (§10).
- **Verification.** R1b for each picked card, one at a time, at most 3 per verification round: the card's
  identity is the skeleton's `roll`; it runs the advisory checklist and up to 4 probe variants (§7.7) and
  writes the card's verification half. Then R1b-assemble (`dossier.md` and the comparison; its key numbers
  add `TotalEHP`, D-294), then the verification gate (§10), where the picked card's identity becomes the
  run's `roll`.
- **Finalization.** D1 through the final gate, as above, plus D1's Count and custom-modifier work (D-293):
  D1 sets each group's `count` with its `countReason` and writes each `customMods` entry with its reason,
  and after setting Count on a group that reserves per copy (or a totem with Ancestral Bond, or an Umbral
  Well buff) it checks reservation and buffs (R-33). D2 plans bridge skills when the named damage source
  arrives late, and banks the enabler in hold and save rows (D-301).

### 5.3 Gates and their verdict files (D-267, D-312)

A gate step (R1b, the D1 gate, the D2 gate) writes its verdict to `reports/gates/<stage>-<concept>-a<attempt>.json`
and returns one verdict line; the runner reads the file to route. The run checker re-reads the last D1
gate's file and recomputes it, so the field names are a contract.

```json
{ "stage": "D1-gate", "concept": "c1", "attempt": 1,
  "verdict": { "compiled": "pass", "v1": "pass", "v2": "pass" },
  "findings": [ { "part": "v1", "code": "level-points", "stage": "b", "message": "stage b spends 108 points at level 1" } ] }
```

- `stage`, `concept` and `attempt` match the file name and the step's header.
- Each `verdict` part is `pass`, `fail` or `unverified`. Only the budget may stay `unverified` (D-164): a
  gate whose compile failed leaves its other parts `unverified`, and any other part `unverified` is a
  failure, routed as a compile, V1 or V2 failure.
- Each finding names its `part`, a stable `code`, the plan `stage` it concerns (omitted only for a finding
  about no one stage) and a `message` citing record fields and C1/E1 keys. A V1 or V2 finding keeps the code
  the record gives it, read from `compile_plan`'s text (up to 200, then by Grep in the record; D-273).
- **Two findings are equal when their plan `stage`, `part` and `code` are**, whichever gate reports them
  (D-312): an accepted V1 finding covers the same finding when the D2 gate or the final record reports it
  again, on that plan stage only.
- Extra fields are allowed (R1b's `errors`, `compiles`, `recordPath`, `leagueUnverified`; the D2 gate's
  `finalCompile {compiled, errors, recordPath, pobFile}`, without the import code, whose one home is the
  record, D-260; FI-3's `forced`; every gate's `faultsApplied`).

| Gate | Parts | Passes when |
|---|---|---|
| `R1b` | `compiled` | the skeleton compiled with no compile error (C-36) |
| `D1-gate` | `compiled`, `v1`, `v2`, `floor`, `budget`, `rolledSkill` | below |
| `D2-gate` | `compiled`, `v1`, `v2` | the whole plan compiled and V1 and V2 pass for every stage (V1 includes tree continuity, D-192); the final compile then succeeded |

*Target (WU-61, D-282):* V1's tree continuity follows one ladder track: the entering-maps rung `m` from the
last campaign stage, `b` from `m`, `n` from `b`, with each rung's respec and gold cost checked.

**The D1 gate's parts.** The D1 gate compiles `plan.json` measure-only and reads the record. "Endgame
stages" are the plan's stages with a `variant`.
- **floor** (D-118, D-119, D-234). Per endgame stage, at the Endgame resistance penalty (−60%, pin
  `Modules/CalcDefence.lua:941`):
  - `MissingFireResist`, `MissingColdResist`, `MissingLightningResist` and `MissingChaosResist` are 0.
    Chaos may stay uncapped only through the stage's `chaosResistException {reason, tag}`, which D1 uses
    only when capping chaos is infeasible; the floor then passes and the gate adds a `chaos-exception`
    finding naming the value and the reason. One line of the variant's `Checks` holds both the full reason
    and the record's `ChaosResist` with `%`.
  - **The reference hits** (D-254, D-256). The stage's scenario holds a waystone-scaled hit for each of
    `enemyPhysicalDamage`, `enemyFireDamage`, `enemyColdDamage`, `enemyLightningDamage` and
    `enemyChaosDamage` (C-32; pin `Modules/ConfigOptions.lua:2267-2275`). Each is derived by the ledger
    entry `hit_<stage id>_<type>`: the damage at the variant's area level
    (`enemies/map-monsters.json#damage.by-level[<area level>]`) × (1 + the top of
    `mods.increased-monster-damage` / 100), and × the top of `mods.extra-damage-as-element` / 100 for an
    element. The area level is 79 for the budget variant (T15: `enemies/waystones.json#area-level.offset`
    plus 15) and `enemies/waystones.json#area-level.max` (82) for the non-budget one. PoB takes these options
    as whole numbers, so each scenario value is `ceil(round2(value))` of its entry's value: 96.4789 gives 97,
    and 402.000003 gives 402. `<Type>MaximumHitTaken` must be greater than the hit.
  - *Target (WU-62, D-281, D-327):* the entering-maps rung `m` is gated the same way at area level 69
    (`area-level.offset` 64, plus 5, T5), with waystone-scaled hits in `hit_m_<type>` (D-254). Its hits are
    tied to that area level as D-256 ties each stage's hits; only that tie is the coordinator's inference
    (D-327).
- **budget** (D-116, D-147, D-164, D-219, D-249). For the budget variant, every filled slot **and every
  tree jewel** has a `prices[]` entry, converted to divines with `get_currency_rates`' rates. Each filled
  slot or jewel has its own entry, except slots holding identical item text. Totals are compared rounded to
  2 decimals: at most 20 divines passes; above 20 and at most 22 passes with a `near-ceiling` finding, and
  the guide's budget `Checks` say "near the ceiling" in those words; above 22 fails (`over-budget`); any
  price `unavailable`, or a currency without a rate, is `unverified`, which doesn't fail the gate, and the
  guide can't claim the variant is under budget. The non-budget total is reported against the ~200-divine
  reference (D-117), never gated.
  *Target (WU-62, D-281):* `m`'s budget is 5 divines: at most 5 passes, at most 5.5 passes with "near the
  ceiling"; offline it is `unverified`.
- **rolledSkill** (D-122, D-148, D-217, D-273). In each endgame stage the rolled skill's group
  (`skills.rolledGroup`) has role `clear` or `single_target`, never `utility` or `leveling`, and its figure
  is the largest among the stage's groups with that role. A figure is a record `skillOutputs` field
  (`g<group>s<skill>p<statSet>.<Field>`), the same field for every group compared, or a ledger entry's value
  (`ledger:<id>`). The rolled skill is the main skill: on every stage with a `rolledGroup`,
  `skills.main.group` is that group; D1 sets `skills.main.statSet`; and the rolled figure, directly or in
  every breakdown field its ledger formula reads, is `<stage>.g<main.group>s<main.activeSkill>p<main.statSet>`.
  As built, the PoB file opens on `skills.main`, so the guide's headline figure is the one the user sees.
  *Target (WU-57, D-295, D-294, D-321):* the group holds the build's **named damage source**, whose own
  hits, ailments and projectiles count when another skill fires, spreads or copies them; `rolledGroup` keeps
  its name. The compared figure is the named source's figure × its Count, from the record's Count-scaled
  field beside the raw figure (WU-55 names the field). The headline becomes that Count-scaled figure, with
  `TotalEHP` beside it (D-294); the user sees the same number as PoB's Full DPS, which the delivered file
  sets up on the named source's groups only (D-293).

**The basis.** The D1 gate's file also carries `basis`, only what the plan and the record don't say. The
checker recomputes the floor from the plan and the record alone; it reads the budget's slot→price map with
its rates, and each endgame stage's compared figure fields, from here, and fills every number from the
record itself.

```json
"basis": {
  "budget": {
    "rates": [ { "currency": "exalted", "divines": 0.01 } ],
    "slots": [ { "stage": "b", "slot": "Helmet", "priceId": "b-helmet" },
               { "stage": "b", "jewel": 1001, "priceId": "b-jewel" } ],
    "totals": [ { "stage": "b", "divines": 21.5 } ],
    "nonBudget": [ { "stage": "n", "divines": 168.0, "reference": 200 } ]
  },
  "rolledSkill": [ { "stage": "b", "figures": [ { "group": 1, "figure": "g1s1p1.TotalDPS" },
                                                { "group": 2, "figure": "g2s1p1.TotalDPS" } ] } ]
}
```

`budget.totals` (each budget stage's total, `null` when unverified) and `budget.nonBudget` are what W1
quotes; the checker computes its own total from the prices and rates.

**Finding codes** for the recomputed parts. An accepted finding (same plan stage, part and code) covers the
matching failure. `chaos-exception` and `near-ceiling` report on a passing part: they are never failures and
need no acceptance (D-312).

| Part | Code | Means |
|---|---|---|
| floor | `missing-fire-resist`, `missing-cold-resist`, `missing-lightning-resist` | that resistance is below its cap (or the record lacks it) |
| floor | `missing-chaos-resist` | chaos below its cap with no `chaosResistException` |
| floor | `chaos-exception` | chaos below its cap, kept by the exception |
| floor | `max-hit-<type>` | `<Type>MaximumHitTaken` isn't above that reference hit |
| floor | `reference-hit-missing-<type>` | the stage has no positive `enemy<Type>Damage` hit of that type |
| floor | `reference-hit-ledger-<type>` | the hit isn't the ceiling of its ledger entry, the record has no value for it, or it isn't derived from the damage at the variant's area level and the tops of the waystone damage modifiers |
| budget | `over-budget` | the total is above 22 divines |
| budget | `near-ceiling` | above 20, at most 22 |
| budget | `unverified` | an unavailable price or a missing rate |
| rolledSkill | `rolled-role` | the rolled group's role isn't `clear` or `single_target` |
| rolledSkill | `rolled-not-largest` | another group of that role has the larger figure |
| rolledSkill | `rolled-not-main` | the stage's `skills.main.group` isn't its `rolledGroup` |
| rolledSkill | `rolled-stat-set` | the stage sets no `skills.main.statSet`, or the rolled figure (or a breakdown field its ledger formula reads) isn't the main skill's stat set |
| rolledSkill | `rolled-not-compared`, `rolled-no-figure` | a same-role group isn't compared, or its figure isn't in the record |

**The D1 gate's outcome.** The runner routes by the verdict file and D1's claim:

| Gate verdict | D1's claim | Outcome |
|---|---|---|
| compiled, V1, V2, floor, rolledSkill pass; budget pass or unverified | any | D2 |
| compile, V1 or V2 fails | any | D1 re-runs with the verdict; after 2 counted retries, `escalated` |
| only floor, budget or rolledSkill fails | `infeasible` | `infeasible`, with the verdict as evidence (D-141) |
| only floor, budget or rolledSkill fails | `done` | D1 re-runs with the verdict; after 2 counted retries, `infeasible` |
| any part but the budget `unverified` | any | as a compile, V1 or V2 failure |
| `"forced": "infeasible"` (FI-3) | any | `infeasible`, evidence `FI-3 (injected)` |
| any failure, after a guided retry or an accepted re-run | any | `escalated` again (D-236) |

An `infeasible` outcome goes back to checkpoint 1 with that concept's last verdict file as evidence.
*Target (WU-57, D-287):* back to the verification gate.

**The D2 gate's outcome.** It compiles measure-only and, when the compile, V1 and V2 pass for every stage,
runs the final compile in the same step. A pass goes to W1. A failure, a failed or refused final compile
included (part `compiled`, code `final-compile`), re-runs D2 with the verdict; after 2 counted retries,
`escalated`. After a guided retry or an accepted re-run, any failure escalates again.

**Logging and faults** (D-272). The runner logs each gate attempt with the outcome its verdict file routes
to, and the checker holds the log to the files. An attempt failed by a fault on attempt 1 runs free only
when the verdict's `faultsApplied` names the fault and every failing finding is on the stage the fault
breaks. A current guide passed every gate: the checker fails a run whose guide is current and whose
recomputed floor, budget or rolled skill fails, or whose D1 or D2 gate before that W1 has a failing part,
unless accepted findings cover every failure (D-312).

### 5.4 Gate escalations (D-127, D-141, D-236, D-268)

Only the D1 and D2 gates escalate: on the third counted failure of a compile, V1 or V2 (the D2 gate's final
compile included), and on a guided retry that fails again. Verification never escalates; what it leaves
open becomes a known issue (D-268). The runner records the escalation in `escalations[]` as `{stage, concept,
verdict, choice, guidance?}`, `verdict` being the escalated attempt's verdict file, and the question as
checkpoint `escalation`. It shows the stage, the attempts and the verdict file, and asks with
AskUserQuestion:

1. **accept** (not offered for a compile failure: nothing compiled to continue from). The verdict's failing
   findings are accepted: every later header's `accepted` carries them, and an equal finding (same plan
   stage, part and code) fails no later gate. W1 lists each under `Known issues` as a plain sentence the
   reader can act on, then its gate (`D1-gate` or `D2-gate`), code and plan stage in parentheses (D-265).
   *Target (WU-62, D-276, D-283):* the guide's line is the reader sentence only; its gate, code and plan
   stage go to `audit.md`'s `Known issues` table.
   After the D1 gate the run goes on as if it passed; after the D2 gate, the D2 gate runs once more,
   uncounted, with them in `accepted`, so it runs the final compile.
2. **guidance and one more retry**: the producer (D1 or D2) gets one more attempt, uncounted, with the
   verdict and the user's guidance (`code: "user-guidance"`) in `findings`, then its gate. If the gate fails,
   whatever part fails, it escalates again.
3. **back to checkpoint 1**, the verdict file as that concept's evidence.
   *Target (WU-57, D-287):* back to the verification gate.
4. **stop**: the run ends `escalated`.

In offline test mode `answers.escalation[]` answers each escalation in turn; with none left, the answer is
`stop` (`answeredBy: "default"`), so the run ends `escalated` (§11.2).

### 5.5 Verification, the fix round and the re-check (D-268, D-264, D-265)

- **Step 11, the full pass.** The three lenses start in parallel, `check: "full"`; each checks every claim
  of `plan.json` and `guide.md` in its lens, with no sampling (§7.4). The runner writes each report to
  `reports/v4-<lens>.json`.
- **Step 12, the fix round**, once, only when a report has an `unresolved` finding, and uncounted. Each
  finding goes to its `owner`: D1 (an endgame stage, a ledger entry citing one or no stage, an endgame
  price), D2 (a campaign stage, or a ledger entry citing only campaign stages) or W1 (the guide). Each owner
  fixes in place, with Edit, every claim the issue touches, not only the flagged location: its wording,
  citation, caveat or source. It recompiles only when a finding needs a build change: gear, tree, gems,
  config, scenario or a ledger formula (D-264). It returns the ids it fixed, the locations it changed and
  whether it recompiled. The earliest owner runs first (D1, then D2), and W1 always runs last: it fixes its
  own findings and patches the guide wherever it repeats a claim another owner changed (their locations in
  its header's `changed`).
  - **No owner recompiled** (claims only): no gate runs; the chains are D1 → W1, D2 → W1, D1 → D2 → W1 or
    W1 alone. Each D1 or D2 of the round is logged `claims-edited`. The final record and the PoB file stay
    the last D2 gate's.
  - **An owner recompiled:** its gates run: D1 → D1 gate → D2 gate → W1; D2 → D2 gate → W1. A step that is
    itself an owner gets its findings in `findings` (D2 after D1: D1 → D1 gate → D2 → D2 gate → W1; that
    D2 runs its gate even for claim edits, since the D1 gate's compile replaced the final record).
    Each owner is logged `done` when it recompiled, or when it is the D2 whose gate follows a recompiled
    D1; `claims-edited` when it edited claims only. W1 patches the guide with `changed: "all"`: the import
    code and every number it quotes may have moved.

  The gates in the round keep their 2 counted retries, and an escalation in it is a gate escalation.
- **Step 13, the re-check.** When a gate re-ran in the fix round, all three lenses run once more in
  parallel, `check: "recheck"`, with their own open findings in `findings` and `changed: "all"`, and check
  every claim as a full pass does. Otherwise (claims only), each lens that raised a finding runs once with
  its own open findings and the owners' changed locations, and checks only those; the **sources lens always
  runs**, even when it raised nothing, since an edited claim may cite something new (D-264). The runner
  writes each report to `reports/v4-<lens>-recheck.json`. There is no further round: what stays open is a
  known issue.
- **Step 14, known issues** (D-265 d). A finding is open when it is `unresolved` in its lens's re-check, or
  `unresolved` in the full pass and not reported `fixed` by a re-check. The runner reads `guide.md` from the
  `known-issues-line` W1 returned last down to the next heading, and **replaces the whole list** under
  `### Known issues` with Edit, every cycle: first W1's lines for the accepted gate findings, as W1 wrote
  them; then one line per open finding, `- <reader> (<id>)`, the finding's `reader` sentence exactly as its
  report gives it, then its id in parentheses; or, with neither, the one line `None.`. Every other line is
  dropped: a line from an earlier cycle is stale.
  *Target (WU-62, D-276, D-278):* the list sits under `What PoB can't show`; each guide line is the reader
  sentence alone; the ids move to `audit.md`'s `Known issues` table, which the runner fills.

### 5.6 Revisions (D-236, D-268)

At checkpoint 2, asking for changes is a revision. The runner maps each request to D1, D2 or W1 by step 12's
owners (the guide's text is W1's; an endgame stage, its ledger entries and prices D1's; a campaign stage
D2's), runs that chain as step 12 does (claims in place, the gates only after a recompile), with the
requests as `findings` (`code: "user-request"`), then steps 11 to 16 again: a full pass, the fix round, the
re-check and the known issues (D-268). A revision counts against no cap; a gate failure in it keeps the
gate's 2 counted retries. There is no `revise-map` step and no Agent-tool fallback (D-267).

## 6. Run log `run-log.json` (D-270)

Schema version 2. Only the runner writes it, as soon as the run folder exists, and rewrites it whole after
every step, checkpoint and question. It records the run's control flow; the artifacts record the rest, and
the checker reads both.

| Field | Content |
|---|---|
| `schemaVersion` | `2` |
| `runFolder` | the absolute path `guide_run {new_run}` returned |
| `slug` | the run's slug (§2) |
| `roll` | `{ascendancy, skill}`, the names as `get_classes` and the gem lookup gave them |
| `status` | `running`, then `completed`, `not-accepted`, `stopped` or `escalated` |
| `mode` | `offline` or `online` |
| `testConfig` | `none`, `accepted` (a `--test` file with `--offline`) or `refused` |
| `stages[]` | one per Agent call, in run order: `{stage, concept?, attempt, outcome, priceOutcomes?}` |
| `checkpoints[]` | `{checkpoint, visit, answer, answeredBy, rule?}` |
| `escalations[]` | gate escalations only: `{stage, concept, verdict, choice, guidance?}` |
| `faults[]` | offline test mode only: `{id, target, applied, observed}`; empty otherwise |
| `outputs` | `{plan, record, dossier, guide, pobFile}`; the import code stays in the record (D-260) |

**Entry rules.**
- **`stages[]`**: each R1a researcher and each V4 lens is its own entry. `stage` is `R1a`, `R1b`,
  `R1b-assemble`, `D1`, `D1-gate`, `D2`, `D2-gate`, `W1`, `V4-<lens>` (the full pass) or
  `V4-<lens>-recheck`. `concept` is set for every step but R1a and R1b-assemble. `attempt` counts the calls
  of that (stage, concept) from 1, re-runs included, and matches the header and the verdict file name.
  `outcome`:
  - `pass` or `fail` for a gate step (R1b, D1-gate, D2-gate) and a V4 lens (`fail`: it reported an
    `unresolved` finding);
  - `done` for a step that only produces; `infeasible` for D1 claiming it and for a D1 gate routed so;
  - `claims-edited` for a D1 or D2 of the fix round or a revision that edited claims in place and compiled
    nothing, so no gate of its own follows it (D-264);
  - `escalated` for the gate attempt that escalated;
  - `missing` for an agent that returned without its file.

  A gate attempt's outcome is the one its verdict file routes to, and the checker holds the two together.
- **`priceOutcomes`**, on a pricing step (R1b, D1, D1-gate, D2) that made price calls: its calls counted by
  outcome, `{"ok": 12, "would_wait": 1}`, each key `ok`, `error` or a `[trade:<kind>]` kind (D-218). Never
  in an offline run.
- **`checkpoints[]`**: `checkpoint` is `1`, `2`, `unsaved-build` or `escalation`; `visit` counts that
  checkpoint's visits from 1; `answer` is the effective answer (`pick:c2`, `more`, `stop`, `accept`,
  `revise:<text>`, `proceed`, `retry:<guidance>`, `checkpoint-1`, …); `answeredBy` is `user`, `pre-supplied`
  (the test config) or `default` (the test config had no answer left). Only an accepted test config gives
  `pre-supplied` or `default`, and then `rule` records how the answer was reached: the test config's answer
  exactly as written (`first-viable`) or the default that applied (`no checkpoint1 answer left: stop`). A
  user's answer has no `rule`. W1 quotes the rule of the entry that picked the guide's concept, and the
  prose lens checks it. Research rounds are read from checkpoint 1's `more` answers (D-235).
- **`escalations[]`**: `stage` is `D1-gate` or `D2-gate`; `verdict` names the escalated attempt's verdict
  file, so the log copies no findings; `choice` is `accept`, `retry`, `checkpoint-1` or `stop` (D-236), with
  `guidance` only for `retry`. Escalations are in the order of the `stages[]` entries logged `escalated`.
- **`faults[]`**: each directive the test config gave, its `target` as written (`{concepts, persistent}`),
  `applied` (how many headers carried it) and `observed` (what failed as a result).
- **`outputs`**: `plan`, `record`, `dossier` and `guide` are relative to the run folder; `pobFile` is the D2
  gate verdict's `finalCompile.pobFile`.

**Reading the requirements.** NFR-23 (the cost caps): at most 3 R1a entries and 3 R1b concepts per research
round, three lenses per pass and at most 2 counted retries per gate, read from `stages[]` (S6 included);
at most 3 agents in flight, read from the session's transcript. NFR-22 (no 429s, no lock-outs): no
`priceOutcomes` counts a `rate_limited` or `locked_out` call (D-270).

*Target (WU-58, D-289, D-286, D-287, D-323, D-326):* **schema version 3.**
- `schemaVersion: 3`, and a `brief` field holding the parsed brief (C-51).
- `roll` is `{className, ascendancy, skill}`, like the plan's, and `null` until the verification gate's
  pick.
- `stages[]` adds `R1a-assemble`, and `concept` holds card ids.
- `checkpoint` is `brainstorm`, `verification`, `final`, `unsaved-build` or `escalation`; the escalation
  choice `verification` replaces `checkpoint-1`.
- Brainstorm and verification rounds are read from the gate answers; "verify other cards from the deck"
  opens a verification round without a brainstorm.
- NFR-23 per brainstorm round: at most 3 R1a entries and one R1a-assemble, dealing 6–9 cards; per
  verification round: at most 3 cards compiled.
- The checker accepts schema 2 and 3; schema 2 only so recorded runs (WU-47's) still check.

## 7. Stage artifact formats

### 7.1 Plans

`plan.json` and the skeletons follow C-31; agents read the committed reference
`docs/build-guide/plan-reference.md` (D-167). On top of C-31:
- C1/E1 values used by a stage are copied with their tags (D-168).
- Every priced item has a `prices[]` entry with an `id` (§9, D-237).
- Every skill group has a `role`; every endgame variant stage sets `skills.rolledGroup` (D-217), and
  `skills.main` on that group with `skills.main.statSet` (D-273).
- Every campaign reward choice the campaign passes is picked in `config.scenario` of every stage at or after
  its quest, the endgame stages included (D-265 c).
- `league` is null offline (D-233), and `"unverified"` when trade couldn't be reached online (D-313,
  D-330).
- *Target (WU-55, D-293):* a skill group's `count` (default 1) with a `countReason` when above 1, and
  `config.customMods: [{text, reason}]`, a hand-calculated effect beside the `earned` and `scenario`
  entries.
- *Target (WU-61, D-281):* `variant: "entering-maps"` for the rung `m`, with loadout
  `Entering maps (L<level>) {m}`.

### 7.2 Dossier `dossier.md` (D-269)

One writer, R1b-assemble, from `templates/dossier-template.md`. H2 headings in order: `Roll and mode`,
`Mechanics`, `Synergy search`, `Config gaps`, `Concepts`, `Not carried`, and no other H2.
- **Roll and mode:** the roll, the mode, the league (offline none; online the skeletons' league, marked
  **unverified** when any concept has `leagueUnverified`, so D1 doesn't take it from here, D-313), and one
  line per research round with its note.
- **Mechanics, Synergy search, Config gaps:** the research files' sections, merged, every claim keeping its
  marker; a researcher that returned without its file leaves a line saying which part is missing.
- **Concepts:** one H3 `<id>: <title>` per carried concept, in id order, with the seven proposal fields, then
  `Proposed in`, `Skeleton`, `Compile`, `Record`, `Key numbers` (the rolled skill's figures, `Life`,
  `EnergyShield`, the four `Missing<Elem>Resist` values, each `<Type>MaximumHitTaken`, with markers),
  `Key-item prices` (dated, or `unavailable` with its note) and `Status` (`viable`, or `failed` with its
  evidence).
- **Not carried:** one line per `not-carried` concept, or `None.`
- A later round keeps everything and appends its material (`Round <k>:`), its concepts and its definitions.
  All definitions sit at the end of the file, below `Not carried`.

The dossier isn't verified after checkpoint 1: it serves the pick, and the guide can't cite it (D-269).
*Target (WU-57, D-287, D-294):* R1b-assemble runs per verification round over the picked cards, whose
verification halves R1b writes; its key numbers add `TotalEHP`. Amendment 3 names no change to the
dossier's H2s.

### 7.3 Source markers in markdown (C-30 in `dossier.md`, `guide.md` and the research files)

A claim carries one or more footnote markers `[^<id>]`. Each id has exactly one definition line:
`[^<id>]: <kind> | <ref> [| accessed: YYYY-MM-DD] [| patch: <p>] [| confidence: H|M|L]`, where `kind` is
one of C-30's five kinds (`pob-computed`, `pob-data`, `external`, `judgment`, `external-unavailable`) with
C-30's required fields; or `ledger | <ledgerId>`; or `data | <file>#<key>`, a C1/E1 fact with `<file>`
relative to `data/` (D-232); or `price | <priceId>`, a plan price entry named by its `prices[].id` (D-237).
In the plan, the same citations are `ledger:<id>`, `data:<file>#<key>` and `price:<id>` (C-30).
Definitions sit under the file's last heading (`Sources` in the guide). In `guide.md` they resolve against
`plan.json`; in the dossier and research files, against any plan of the run. Research markers are
`p<k>r<n>-<m>`, so the dossier can copy them unchanged.

**The claim rules** (D-273). Every step that writes a claim keeps them, and the V4 lenses check every claim
against them:
1. **Supported in every part.** The source supports all of the claim: each number, each mechanic and each
   qualifier ("always", "on hit", "against bosses"). A part its source doesn't support gets its own source,
   or goes.
2. **It cites each fact it rests on**, with a marker or a ledger entry for each.
3. **It carries its source's caveats** (confidence M or L, a disputed fact, a `judgment`, a mechanic no
   lookup confirmed) wherever the claim appears, never stated as settled.
   *Target (WU-62, D-279):* once in the guide, and never later stated as settled.

A number or a mechanic stated without a marker is a claim without a source: the V4 sources lens reports it.
*Target (WU-62, D-276):* `guide.md` carries no markers; markers stay in the dossier and the research files,
and the plan's claims carry the guide's sources.

### 7.4 Verifier reports (V4; D-268)

The verifier returns its report as JSON, and the runner writes it unchanged to `reports/v4-<lens>.json`
(the full pass) or `reports/v4-<lens>-recheck.json` (the re-check):

`{stage: "V4", lens, check, concept, mode, findings: [{id, artifact, location, claim, issue, evidence,
reader?, owner, status}], verdict}`.

- `lens` is `ledger`, `sources` or `prose`; `check` is `full` or `recheck`, as the header says; `mode` is the
  run log's.
- Each finding's `artifact` is `plan.json` or `guide.md`: the dossier isn't verified (D-269). `location`
  never quotes the artifact (`stages[<i>].claims[<k>]`, `ledger[<i>] (<id>)`, `guide.md [^<id>]`, or
  `<H2 title>, line <n>`). `owner` is `D1`, `D2` or `W1` (§5.5).
- `status` is `unresolved`, `accepted-offline` (only the sources lens, only for an `external-unavailable`
  claim in an offline run, C-30) or, in a re-check, `fixed`.
- `reader` (D-265) is on every `unresolved` finding: one plain sentence the guide's reader can act on, with
  no pipeline words and no JSON path. It is what the guide's `Known issues` prints.
- `verdict` is `pass` exactly when no finding is `unresolved`. There are no coverage counts and no V3
  report (D-268).

**The lenses**, one fresh verifier each, every claim of `plan.json` and `guide.md` in a full pass, with no
sampling. Each also checks the claim rules (§7.3) and what PoB applies (a partly parsed line applies none of
itself; `possibly unread` is advisory until a measurement confirms it, D-243).
- **`ledger`:** re-derives every ledger entry from the final record (C-33) and the entry's tagged inputs,
  comparing it with the record's value to 2 decimals; re-derives every endgame stage's five reference hits
  from the facts themselves (D-254, D-256), the entry `hit_<stage id>_<type>` and its scenario ceiling
  included; and compares every guide number that cites an entry with the record's value as the guide rounds
  it.
- **`sources`:** online, opens every `external` source on D-171's hosts (offline, an `external` claim is a
  finding); checks every `data` claim against its fact and the fact's stored citation, without fetching
  that URL offline (D-232); re-checks every `pob-data` claim with the lookups; checks each `price` claim
  against its `prices[]` entry (D-237; V4 has no trade tool); checks each `pob-computed` claim against the
  final record; reports each `external-unavailable` claim (`accepted-offline` offline, `unresolved` online);
  and reports every number or mechanic statement without a source.
- **`prose`:** reads `guide.md` section by section against §8: mechanics claims supported by their sources;
  the rolled skill as the main damage source in `Summary` and `Rotation`, with why when it isn't the clear
  skill (D-122, D-148); budget statements (D-164, D-219); the chaos line (D-234); the offline line (D-201);
  and "why this concept" against `run-log.json`'s checkpoint-1 entry that picked it, its `answeredBy` and its
  `rule`.

*Target (WU-62, D-279):* claims exist only where the guide states a fact or a gate needs one; the sources
lens loses the guide side (the plan holds the claims); the ledger lens loses its guide-number step; the
prose lens reads `guide.md` like an editor against the plan, the record and `audit.md`, flagging a fact or
number not in them, contradicting them or stated more strongly, first-person advice that asserts a fact the
plan lacks, tutorial text (§8's target), and a caveat repeated or later stated as settled. It keeps the
gated statements' checks, checks "why this concept" in `audit.md`, and never flags a missing optional item.
*Target (WU-57, D-296):* a DPS figure that rests on Count or a hand calculation, and any figure the record
marks as computed with a custom modifier, is an estimate, not checked for exactness; every interaction the
guide states must exist in game text.

### 7.5 Cards and the deck (C-52)

*Target (WU-56, WU-57; D-286, D-287, D-291, D-303).* The template is `templates/card-template.md`. R1a fills
the brainstorm half (about 250–400 words); R1b fills the verification half.

- **Brainstorm half:**
  - **Identity:** class, ascendancy and named damage source.
  - **Pitch:** a title of at most 60 characters, playstyle tags (FR-W1's vocabulary), and two lines.
  - **Chain:** the named damage source and what it reads (the slot that carries it); its multipliers; its
    enablers; what the payoff consumes or requires, and who supplies it.
  - **Enabler:** the item, node or gem, the level it arrives at, how to get it, and what is dormant until
    then.
  - **Links table:** per link, the confirming game text and the lookup that found it; how PoB follows it
    (§7.6's labels, with PG ids); any hidden clauses, stated as theory ("from a Hit", "you use yourself").
  - **Evidence:** poe.ninja popularity of the skill and the ascendancy; how many characters use the
    combination, and at what level; a reference build, if there is one. With `--no-ninja`: "no player
    evidence".
  - **Risks so far:** payoff thieves, placement limits, the exposed phase, resistant bosses.
- **Verification half:**
  - **Verified:** defences from PoB (life, energy shield, resistances, max hit, `TotalEHP`) and the modelled
    DPS.
  - **Estimates:** each Count and custom modifier with its reason; any figure computed with a custom
    modifier present; clear and boss figures kept separate.
  - **Checklist results** (§7.7), **a fallback ladder** and **key item prices**.
- **Status words**, used everywhere on the card: confirmed in game text; modelled in PoB; estimate (with the
  reason); players use it (poe.ninja); not checked yet; needs in-game testing.
- **Damage sources that aren't skills** (D-303, HG-21), such as a flask nova, may be dealt and verified,
  but the card is marked "can't be finalized yet": finalizing one waits on a plan field for an item-effect
  damage source and its hand calculation. Its identity's `skill` names the damage source, checked at deck
  assembly by a lookup of its kind; in verification it gets only the checklist's read-only checks, with no
  skeleton or probe compile, and the card says so (D-334).
- **`cards.md`** (R1a-assemble) holds one line per dealt card, like R1b-assemble's comparison lines, then a
  "Not dealt" list, each with the link no lookup confirmed.

### 7.6 The pattern library `references/patterns.md` (C-53)

*Target (WU-56, D-290).* Built from the ten pattern families of the work-log's "Off-meta builds 7–30", the
earlier studies, and the brainstorm questions from its "Process heuristics, by phase", which open the file.
- **Each entry:** name and shape (one general sentence that applies to any skill); search step (the starting
  point, the lookup or phrase search, and what to check); how PoB follows it (modelled, Count, custom
  modifier, config stand-in, hand calculation, or not modelled, citing PG ids); one to three example builds,
  a line each; cautions.
- **Rules:** shapes only, each use re-checked against current game data; at most 6,000 words, counted by
  AC-W28's static test, so a researcher reads it whole (D-325); after each user-supplied study, the
  coordinator proposes entries and the user approves them.

### 7.7 The verification checklist (advisory)

*Target (WU-56, WU-57; D-292).* R1b runs these checks and writes each result into the card as verified,
estimate, risk or not checked. None is a gate, and none starts a fix round.
- **From the plan and the record (no extra compile):**
  1. pillars for ailments and damage over time: base, type-specific scaling, duration, 100% application;
  2. the enabler's conditions at the target level, in numbers, and what they force out of the build; a
     forced condition gets a permanence check (reservation of at least 1 minus the threshold);
  3. attribute requirements at the target level, for the defining items and every gem;
  4. risks PoB can't show: payoff thieves (from the lookup's hit-making children), placement and targeting
     limits, the exposed phase, cooldown dead windows on interruptible casts, hidden clauses.
- **From compile variants.** The mutating tools are `mutate` tools the coordinator doesn't hold (D-231), so
  each probe is a plan variant compiled measure-only as a single stage, at `probes/<card-id>/<n>/` (D-331):
  5. a dead-slot audit: one support or source removed, a change below 1% flagged, and whether each support
     touches the activation or the payload;
  6. a condition on and off, by toggling its earned config entry, at a realistic uptime;
  7. encounter mods: +resistance, and bosses that resist the element (scenario config);
  8. skill-shape probes where the skill's text suggests one, such as projectile speed up and down.
- **The compile budget:** R1b's two compiles per attempt, plus up to 4 probe variants per card, run in the
  order above. A probe that doesn't fit is reported as not checked. Each probe is a one-stage compile,
  within NFR-21's per-request limit.

### 7.8 The audit layer `audit.md`

*Target (WU-62, D-278).* A separate file in the run folder, not an appendix to the guide; no human is
expected to read it, so the guide's word cap and no-marker rule apply to all of `guide.md`. W1 writes it from
`templates/audit-template.md` and patches it with Edit; the runner fills its `Known issues` table at step 14.

| `audit.md` H2 | Holds |
|---|---|
| `Hand calculations` | the ledger table |
| `Stage detail` | the per-loadout PoB numbers, the resistance table, the mana and leech pairs, the Arbiter and mapping detail |
| `What PoB doesn't model` | `check_model_coverage`'s flags and their handling |
| `Inputs by confidence` | the M and L inputs, and the claims needing an external source |
| `Run notes` | why this concept (the pick's checkpoint answer and its rule); the D1 gate's budget totals and rates |
| `Known issues` | each open or accepted finding's id, its lens or gate, and the sentence the guide prints |

## 8. Guide template (W1; ext §5, the design's quality bar)

`templates/guide-template.md`, as built. `guide.md` has one H1 naming the roll and the concept, then these
13 H2s in order, and no other H2:

| H2 | Must contain |
|---|---|
| `Versions, prices and import code` | the engine data version (pin tag, commit and targeted game patch) and, separately, the patch of the prices and boss data (D-107); the date; the league (none offline; "unverified" when the trade site couldn't be reached, D-313); the mode, and in offline mode that prices are unavailable and no external source was consulted; the record's `versionNotes`, if any; the PoB file name, that each stage is a loadout and that the file is in auto-level mode (D-138, D-149); the import code in a fenced block, equal to the final record's `importCode` (D-145, D-205); the record's `loadoutWarnings` and `saveWarnings` with what to do about them (D-310, D-248) |
| `Summary` | the concept, why the rolled skill is the main damage source, pros, cons, difficulty; "why this concept" only as the run log records the pick (the user picked it, or the test config picked it by the entry's `rule`, quoted exactly); that the dossier keeps the other concepts |
| `How it works` | the mechanics with sources; the ledger table: each entry's claim, its value from the record, its formula in words (D-106) |
| `Leveling` | one H3 per campaign stage in plan order, titled with its loadout name exactly as the record has it, and no other H3. Each gives the level range, skills and supports with socket counts, tree points to add and any respec with its gold cost (D-144), the ascendancy pick, gear with a dated price or `unavailable`, the swap trigger, and the loadout's PoB numbers |
| `Campaign rewards` | every quest reward the campaign passes, in campaign order; each reward choice names the plan's pick and the reason its claim gives, never the options without the pick (D-265 c) |
| `Endgame: budget variant` | the character level and ascendancy points (D-193); any respec from the campaign; gear by slot with dated prices (`price` markers, D-237); stat priorities; gem links with gem levels; the tree; earned config with its producer and uptime (D-114); an H3 `Checks`: the survival floor (all four resistances gated; an uncapped chaos value on one line with its exception's full reason, D-234), max hit taken against each reference hit at its ledger value (D-254, D-256), the budget total against 20 divines with `near the ceiling` when it is over 20 and at most 22 (D-219) or the D-164 statement, the Arbiter's hits and time-to-kill range (D-116, A-30), the mapping signals (D-121, D-132) |
| `Endgame: non-budget variant` | the same, with the total against the ~200-divine reference (D-117), plus the upgrade order from the budget variant |
| `Rotation` | clear and single target (D-120); if the rolled skill isn't the clear skill, why (D-148) |
| `Defences and resistances` | how resistances climb through the campaign penalties to −60% (D-118), with a per-stage table |
| `FAQ and common mistakes` | newcomer questions and hard warnings, with the loadout and save warnings' actions |
| `Confidence and what PoB can't model` | C-38's flags and how the guide handles each, the hand calculations, the M and L inputs (A-29); in offline mode, the `external-unavailable` claims; then, as its last part, the H3 `Known issues` (D-268): W1 writes one line per accepted gate finding, or `None.`, and the runner replaces the list after verification (§5.5) |
| `Changelog` | dated entries |
| `Sources` | the footnote definitions (§7.3) |

*Target (WU-62; D-276, D-277, D-280, D-281):* **the reader layer.** `guide.md` becomes about 2,840 words,
capped at 3,000 (the H1, the import code and the Known issues list not counted), and renders the plan: no
markers, and no fact or number of its own. Everything kept for agents moves to `audit.md` (§7.8).
- **Rules for every section.** A fact is a plain statement of something the plan or the record holds.
  Advice is in the first person ("I", "my"), which labels it, and isn't verified. Each caveat appears once,
  where the reader acts on it, and is never later hedged again or stated as settled. No pipeline text: no
  markers, confidence labels, finding ids or pipeline words, and no stage ids outside the loadout names.
  Numbers come from the plan or the record, rounded as a guide would ("about 2,740"); a reference hit is
  rounded too, and `audit.md` keeps its ledger value. Affix targets are written as text. Held back:
  crafting recipes, an atlas section, affix tier labels, trade links (until WU-48), a vendor search regex
  (deferred, HG-19).
- **Not a tutorial** (D-280). A sentence that explains how the game or PoB works stays only when it names
  something this build uses, needs or avoids (its skill, supports, nodes, key items, an attribute or level
  requirement, or a plan number) and it changes what the reader does with this build. The swap test: if
  the sentence would read as true and useful, word for word, in a guide for another skill on another class,
  cut it. Campaign practicals are actions, not explanations.
- **Optional items** (D-277), used where the build has them and never required; the prose lens doesn't flag
  a missing one: fallbacks (from alternatives D1 and D2 already weighed), threshold triggers (otherwise a
  first-person judgment trigger), traps, either/or picks, hold and save rows, rotation clauses; and, from
  amendment 3, Leveling's "dormant until" lines and Priorities' "buy now, works at stage X" (D-301).

| # | H2 | Words | Holds |
|---|---|---|---|
| 1 | `At a glance` | 150 | what the build does, its payoff, pros, cons, difficulty |
| 2 | `Your PoB file` | 120 | the import code (first fenced block), the file name; the loadouts as one ordered line, each with its trigger; that the items are stat examples; engine and boss-data versions, the offline line, PoB warnings |
| 3 | `Survival by stage` | 130 | a legend; one verdict per campaign group (Acts 1–2, Acts 3–4, the interludes and Epilogue); one fixed-form verdict line per endgame rung |
| 4 | `Gem and ascendancy timing` | 130 | a When / Change table: uncut-gem steps, trials and their nodes; optional hold and save rows |
| 5 | `Priorities` | 180 | support, link, quality and stat priority; the weapon-swap rule of thumb; one "when you're short" line with the record's numbers |
| 6 | `Leveling` | 620 | one H3 per campaign stage (its loadout name), at most 110 words: setup, tree additions with reasons, attributes (have and need), gear targets, when to swap; a rotation clause when the stage's damage is a combo |
| 7 | `Campaign route and rewards` | 210 | reward quests in route order; each reward choice's pick with a reason; currency habits that serve this build |
| 8 | `Endgame: entering maps`, with `### Checks` | 250 | the gate in, changes from the Epilogue, a numbered buy order within 5 divines, checks |
| 9 | `Endgame: budget`, with `### Checks` | 330 | the gate in, buy order, a slot table (slot, target, fallback), gems, tree with reasons, checks; a target names the affix's source when it limits the base |
| 10 | `Endgame: non-budget`, with `### Checks` | 180 | the gate in, the upgrade order, checks; affix sources as in row 9 |
| 11 | `How to play it` | 170 | clear and single target; the named damage source as the main damage (D-122), and why when it isn't the clear skill (D-148); up to 4 trap bullets, each confirmed by item text, gem text or PoB |
| 12 | `What PoB can't show`, ending with `### Known issues` | 200 | each caveat once, by the figure it qualifies; the settings the headline figure assumes, from the plan's config; Known issues hold the runner's sentences, outside the cap |
| 13 | `FAQ` | 160 | 3–5 questions a player asks; up to 2 either/or picks, each with its deciding factor as a PoB damage or survival difference, plus the price difference online |
| 14 | `Changelog` | 10 | dated entries |
| | **Total** | **2,840** | cap 3,000 |

- **The endgame rungs** (D-281). Each rung's "Move here when" line appears once, at the top of its H2. Each
  `Checks` H3 holds what the verdict line doesn't: the chaos exception when there is one (D-234), the budget
  line (D-219), and for `b` and `n` the Arbiter of Divinity; `m` gets no Arbiter report and no mapping
  signals.
- **The verdict line** (D-283), one per endgame rung in `Survival by stage`, in this fixed form:

  ```
  - **<Entering maps|Budget|Non-budget> (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS.
  ```

  The checker finds it by its label and compares the level with the stage's `level`; the four resistances
  with `FireResist`, `ColdResist`, `LightningResist`, `ChaosResist`; the physical max hit with
  `PhysicalMaximumHitTaken` and its hit with `hit_<stage>_physical`; the other max hit with the least of the
  four other `<Type>MaximumHitTaken` and its hit with the largest of the four other `hit_<stage>_<type>`;
  and the DPS with the rolled-skill figure the D1 gate's verdict names, read from the record. A written
  number matches when it equals the value's magnitude rounded at its own last significant digit ("2,740"
  matches 2,736; "about 400" matches 401.996). The verdict word stays judgment.

*Target (WU-57, D-294):* the verdict line quotes the named source's Count-scaled figure and ends with
"Effective HP about <n>.", which the checker compares with the stage's `TotalEHP` by the same rounding rule;
EHP is shown beside max hit, never alone, and max hit stays the basis of the verdict. `What PoB can't show`
lists each Count and custom modifier with its reason, rendered from the plan.

## 9. Pricing procedure (T1; `references/pricing.md`; D-133, D-160, D-164, D-169, D-202, D-218)

- **Who.** Only coordinator steps price, with P's tools and C-49's dated outputs (D-112, D-178).
  *Target (WU-57, D-297):* the poe.ninja tools of N are not price tools; prices stay with P.
- **Order** (D-133): R1b prices concept key items; D1 prices every filled slot **and every tree jewel**
  (D-249) of both variants, with rares as affix-target searches (`search_trade_items` with `mods`), each
  with its own entry unless slots hold identical item text; D2 prices campaign uniques.
  *Target (WU-62, D-281):* D1 also prices the entering-maps rung's slots as `m-<slot>` entries.
- **Record** each result in that plan's `prices[]` with its id (what a `price:<id>` claim cites, D-237),
  date (the result's `Checked:` line, C-49), league, query and status (D-169). An `unavailable` entry has
  `amount` and `currency` null and a `note` giving the reason (`offline run`, `rate-limited`,
  `pricing stopped`, `trade unreachable`, …). Before a search, reuse an entry with the same item, query and
  league from any plan in this run; the server keeps no cache.
- **League** (D-233, D-313, D-330). Offline, the plan's `league` is null. Online it is `get_leagues`' current trade
  league. When trade can't be reached, R1b falls back to another plan's league or `Standard` and marks it
  `leagueUnverified`; D1 never inherits such a league or a guess, and with no league known writes
  `"league": "unverified"`, makes every price `unavailable` (note `trade unreachable`), and the guide says
  the league couldn't be verified.
- **Outcomes** are classified by the error text's `[trade:<kind>]` prefix (D-218), whose `<kind>` is a
  `TradeErrorKind`: `would_wait`, `locked_out`, `rate_limited` (a 429), `http`, …; an error without the
  prefix is `error`. The prose after the prefix is never parsed.
- **Pace** (D-160, C-11). The limiter sleeps a wait of 30 s or less inside the call, and refuses a longer
  one with `would_wait`, sending nothing. The coordinator has no clock and paces by order: on `would_wait`
  it prices other items and re-calls the refused item later. An item's third refusal makes it
  `unavailable` (rate-limited, D-164), as does the step ending before the item is priced. On `locked_out`
  or `rate_limited`, pricing stops for the rest of the run: every remaining item is `unavailable`, and the
  runner tells every later coordinator step so.
- **Final re-price pass.** Before the D1 budget verdict becomes final, the D1 gate step re-calls each
  rate-limited `unavailable` entry of `plan.json` once and updates it; a refusal leaves it `unavailable`.
  The pass is skipped once pricing has stopped, and in offline mode.
- **Divines.** Totals convert with `get_currency_rates` (poe.ninja, through the same coordinator). The D1
  gate records the rates it used (`basis`, §5.3). Without rates, totals are `unverified`.
- **Unavailable** (no cookie, rate-limited, down, disabled, offline; D-164): a variant with any unavailable
  slot price can't be claimed to be under budget; the guide and checkpoint 2 say so.
- **Log** (D-270). Each pricing step returns its calls counted by outcome in one line
  (`prices: ok 12, would_wait 1`, or `prices: none`), which the runner records as that step's
  `priceOutcomes` (§6).

## 10. Gates with the user (D-125, D-157, A-28, D-210, D-235, D-236)

Each question is asked with AskUserQuestion; if the choices exceed one question's option limit, the runner
splits them across questions. In offline test mode the test config answers instead (§11.2), and only there
(A-28). Every answer is recorded in `checkpoints[]` (`answer`, `answeredBy`, and `rule` for a pre-supplied
or default answer); no presentation text or time is recorded (D-270).

- **The unsaved-build question** (FR-W2 step 4; D-210), asked once, right after the log's first write, when
  `loadedBuildUnsaved` is `true`: proceed (the loaded build's unsaved changes will be discarded) or stop
  (the run ends `stopped`; nothing has been compiled). The runner says which build it is when the reply
  names it, and that the user can save it first and start again.
- **Checkpoint 1: pick a concept.** Shown after every research round, and after an `infeasible` design or an
  escalation sent the run back here. It shows R1b-assemble's comparison, one line per concept of the run
  (every round): synergy, numbers from its record, key prices (dated or `unavailable`), risks, what PoB
  can't verify, and its status (`viable`, `failed`, `not-carried`); the dossier's path; after an
  `infeasible` design or an escalation, that concept's last verdict file as evidence; with no viable
  concept, each concept's last verdict and why it fails (D-141). It asks: **pick** a concept (a failed one
  may be picked anyway; the design runs for it), **ask for more** (a new research round of up to 3
  concepts with the user's note, `firstId` one more than the highest id so far; only this answer starts a
  round, D-235), or **stop** (the run ends `stopped`).
- **Checkpoint 2: the guide.** Shown after the run checker (step 15). It shows the guide's path; the PoB
  file (the D2 gate verdict's `finalCompile.pobFile`); the gate verdicts; the known issues (the open V4
  findings and the accepted gate findings); the run checker's result; when any price is `unavailable`, that
  the variant can't be claimed to be under budget (D-164); and in offline mode, that the guide is from an
  offline run. It asks: **accept** (the run ends `completed`), **ask for changes** (a revision, §5.6,
  recorded as `revise:<text>`), or anything else (the run ends `not-accepted`, the user's note recorded as
  the answer).
- **Escalations** (§5.4) are asked the same way.
- **A pre-supplied answer still prints the display** (D-265 b): the test config replaces only the question.
  The runner shows everything the checkpoint shows the user, on every visit, then the answer it resolved to.

*Target (WU-57, WU-58; D-287, D-288):* **three gates, one per phase**, alongside the unsaved-build question
and escalations.
- **The brainstorm gate.** It echoes the parsed brief, prints the deck (`cards.md`'s dealt cards and its
  "Not dealt" list), and asks with AskUserQuestion in `multiSelect` mode: up to 4 cards per question, up to 3
  questions, plus one for more or stop. The pick is the union of the selections, up to 3; more than 3 is
  asked again. The answers: **verify** 1–3 cards; **brainstorm more**, with a note; or **stop**.
- **The verification gate** (renamed from checkpoint 1). It shows the comparison of the verified cards,
  `TotalEHP` included, and asks: **finalize** one (a failed card may be picked anyway; its identity becomes
  the run's `roll`); **verify other cards** from the deck (a new verification round without a brainstorm);
  **brainstorm more**; or **stop**. Every route that went back to checkpoint 1 now comes here: an
  `infeasible` design, the escalation's option 3, and FI-3.
- **The final gate** (checkpoint 2), unchanged.

## 11. Offline mode, test config and fault directives

### 11.1 Offline mode (D-201, C-30, C-36)

Started only explicitly, with `--offline`; the run log records `mode: "offline"`. In offline mode:
- no step calls a trade tool, `get_currency_rates`, WebSearch or WebFetch, even if one is available;
- research uses only L and the committed C1/E1 files (`data/campaign/`, `data/enemies/`), not
  `docs/design/grounding/`; a claim taken from C1/E1 cites its fact as `data:<file>#<key>` (D-232);
- every price is `unavailable` with `note: "offline run"`, `league` null, `amount` and `currency` null,
  dated the run folder's date (D-164), and no step has `priceOutcomes`;
- the plan's `league` is null, which C-31's schema allows only when every price is `unavailable` with
  `note: "offline run"` (D-233);
- a claim that would need an external source is tagged `external-unavailable`, with ref exactly
  `external source unavailable (offline run)` and a confidence; V4 accepts it (`accepted-offline`) only in
  this mode;
- the guide's first section says the run was offline: prices are unavailable and no external source was
  consulted.

M-12 also removes those tools from the environment (spine §9), so the rule is enforced, not just followed.
*Target (WU-57, D-297, D-333):* `--offline` also turns off the poe.ninja tools of N. `--no-ninja`: the run
calls no tool in group `ninja`, neither C-54's poe.ninja tools nor `get_currency_rates`, so price totals in
divines are `unverified` (pricing's path when rates are missing), and the cards say "no player evidence"
(D-297, D-333).

### 11.2 Test config (offline mode only; A-28)

`--test <path>` names a JSON file `{answers, faults?}`.
- **Accepted only with `--offline`** (`testConfig: "accepted"`): its answers replace the user's at the
  checkpoints and questions, and its faults are applied. Without `--offline` the runner records
  `testConfig: "refused"`, ignores the file (no answer, no fault), says so, and asks the user at every
  checkpoint (D-157). A file given with `--offline` that can't be read or isn't this shape is refused too,
  and the run stops before research (`stopped: malformed test config <path>: <what is wrong>`). Without
  `--test`, `testConfig: "none"`.

| Question | Test config answer | Meaning |
|---|---|---|
| unsaved build | `answers.unsavedBuild`: `proceed` or `stop` | none given: `stop`, `default` |
| checkpoint 1 | `answers.checkpoint1[]`, one per visit: `first-viable`, `pick:<id>`, `more` or `stop` | `first-viable` is the first `viable` concept not yet designed in this run, else `stop` |
| checkpoint 2 | `answers.checkpoint2[]`, one per visit: `accept`, `not-accept` or `revise:<text>` | |
| escalation | `answers.escalation[]`, one per escalation: `accept`, `retry:<guidance>`, `checkpoint-1` or `stop` | none left: `stop`, `default`, so the run ends `escalated` |

When `checkpoint1` or `checkpoint2` answers run out, the run ends `stopped` (answer `stop`, `answeredBy:
"default"`). A used answer is recorded `pre-supplied` with the answer it resolved to (`first-viable` →
`pick:c3`); either way `rule` keeps how it was reached (§6). The test config has no `orchestration` field
(D-267).

*Target (WU-57, WU-58; D-288, D-323):* `answers.brainstorm[]`: `pick:<id>[,<id>…]` (1–3 ids), `first-n:<n>`
(n = 1–3: the first n dealt cards not yet verified), `more` or `stop`. `answers.verification[]`, renamed
from `answers.checkpoint1[]`: `first-viable`, `pick:<id>`, `verify:<id>[,<id>…]`, `more` (a new brainstorm
round) or `stop`. `answers.final[]`, renamed from `answers.checkpoint2[]`, with the same values.
`checkpoint1` and `checkpoint2` are retired in run log v3. The escalation answer `checkpoint-1` becomes
`verification`. When answers are missing or run out, the run ends `stopped` with the rule recorded. A-28
gains the brainstorm gate: pick the first dealt card, or follow the test config.

### 11.3 Fault directives (test config only; D-272)

Each directive names its target concepts (a list of ids, or `"all"`) and whether it is `persistent` (every
attempt) or applies to attempt 1 only. The runner puts a directive only into the headers of the steps it
targets; the step that applies one reports it in its verdict's `faultsApplied`, and the runner logs each in
`faults[]`. An attempt failed by an attempt-1 directive re-runs free; a persistent directive's failed
attempts count, so the cap still ends the flow.

| Id | Applied by, when | Edit | A check that must then fail |
|---|---|---|---|
| FI-1 | the R1b step, in the attempt's first compile: the bootstrap, which then always runs, so a faulted attempt compiles nothing clean (D-265 f) | add a support gem named `FI-1 Unknown Gem` to the skeleton's main socket group | that compile, with a per-stage error naming the gem (D-162); the attempt stops there |
| FI-2 | the D1 gate step, before its compile | set the first endgame stage's `level` to 1 in `plan.json`, and its `loadoutName`'s `(L<n>)` to `(L1)` so the plan stays valid | V1, for that stage (points and requirements exceed level 1) |
| FI-3 | the D1 gate step | none: the outcome is forced to `infeasible` (`"forced": "infeasible"`), with evidence `FI-3 (injected)` | control flow only: the route back to checkpoint 1. *Target (WU-57, D-287):* to the verification gate |

The seeded V4 checks FI-4 (a ledger formula wrapped as `(<formula>) * 2`) and FI-5 (a run log set to
`online`) (AC-W15) are applied by the build coordinator to a copy of a run folder, not through the skill.

## 12. Work units

**Shared files.** `SKILL.md`, `scripts/check-run.mjs`, `tests/static/buildGuidePipeline.test.ts`,
`tests/unit/buildGuideCheckRun.test.ts` and `.claude/agents/build-guide/build-guide-coordinator.md` are
shared: units editing them merge one at a time. Of the not-built units, WU-62 merges before WU-57, and
WU-57 before WU-58 (D-317). Every not-built unit belongs to milestone M-14, "open builds offline" (D-315).

### WU-43: The skill, shared references, run log and checker
- kind: build
- status: built
- depends-on: [WU-41, WU-49, WU-31]
- role: pipeline author (Claude Code skills) + test infra
- touches: [`.claude/skills/build-guide/` (new): `SKILL.md`; `references/` for the run folder, run log, task header, checkpoints and escalations, pricing, offline mode and test config, and source markers; `scripts/check-run.mjs`; `tests/static/buildGuidePipeline.test.ts` (new); `tests/unit/buildGuideCheckRun.test.ts` (new); `tests/fixtures/pipeline/` (new)]
- produces: [the skill and its runner (§3, §5) with the roll check, the unsaved-build question, the escalation question and the checkpoint-2 revision; the run-folder layout (§2); the run log (§6); the task header (§5.1); the marker syntax (§7.3); the report shape (§7.4); the pricing procedure (§9); the checkpoints (§10); offline mode, test config and faults (§11); the run checker (FR-W7); the positive allowlist probe (AC-W23); with WU-44…WU-46, C-36's stage artifacts and rules]
- consumes: [C-30, C-31, C-34, C-37 (the probe's lookup), C-41 (`measure_only`), C-50 (`{new_run}` with `loadedBuildUnsaved`, `{validate}`; D-210, D-216), C-49 (with D-218's prefix), C-11, D-217, D-219, D-231…D-238]
- acceptance: [AC-W1, AC-W2, AC-W23]
- milestone: M-12
- summary: Write the skill and every contract the other units share. The skill names the four agent types
  (§4) and the step list (§5.2), which WU-44…WU-46 fill in. `check-run.mjs` checks a run folder's artifacts
  and recomputes the D1 gate (FR-W7). Amendment 1 replaced the workflow harness and the fallback with the
  runner's direct Agent calls and the checker's control-flow checks (D-267, D-271). The positive allowlist
  probe (AC-W23) ran early and recorded "reached directly", so ToolSearch joins no row of §4; WU-31 was a
  dependency for this probe alone.

### WU-44: Research steps and their agents
- kind: build
- status: built
- depends-on: [WU-43, WU-31, WU-32]
- role: pipeline author
- touches: [`.claude/agents/build-guide/build-guide-researcher.md` and `build-guide-coordinator.md` (new), `.claude/skills/build-guide/references/stages/` (`R1a`, `R1b`, `R1b-assemble`), `.claude/skills/build-guide/templates/dossier-template.md`, `tests/static/buildGuidePipeline.test.ts` (allowlist and research cases)]
- produces: [the R1 stage references (§5.2), the researcher and coordinator definitions (§4), the dossier format (§7.2)]
- consumes: [C-37, C-38, C-43, C-41 measure-only, C-49, D-235, D-311, the WU-43 contracts]
- acceptance: [AC-W5]
- milestone: M-12
- summary: R1a's parallel lookup-only research and R1b's coordinator compile and pricing, with the
  3-concept cap per research round, the R1b gate and its retries, FI-1, and the dossier assembly. R1b may
  bootstrap a tree-minimal compile and validates before pricing (D-311).

### WU-45: Design steps, the writer and the guide template
- kind: build
- status: built
- depends-on: [WU-43, WU-44, WU-34, WU-42]
- role: pipeline author
- touches: [`.claude/agents/build-guide/build-guide-writer.md` (new), `build-guide-coordinator.md` (D1, D2 and gate rules), `.claude/skills/build-guide/references/stages/` (`D1`, `D1-gate`, `D2`, `D2-gate`, `W1`), `.claude/skills/build-guide/templates/guide-template.md`, `tests/static/buildGuidePipeline.test.ts` (design cases)]
- produces: [the D1 → D1 gate → D2 → D2 gate and final compile → W1 steps (§5.2), the D1 gate decision table and the contents of its verdict file (§5.3), the final re-price pass, the final compile, the escalation paths (`accept`, `guided-retry`, §5.4), the guide template (§8)]
- consumes: [C-31…C-33, C-35, C-41, C-45, C-47, C-49, D-192, D-217, D-219, D-234, D-236]
- acceptance: [AC-W11]
- milestone: M-12
- summary: The design steps, with the retry caps, the infeasible route, FI-2 and FI-3, and the escalation
  paths. Runs after WU-44 (the shared files above).

### WU-46: The verifier, wired into the run
- kind: build
- status: built
- depends-on: [WU-45, WU-44]
- role: pipeline author
- touches: [`.claude/agents/build-guide/build-guide-verifier.md` (new), `.claude/skills/build-guide/references/stages/V4.md`, `SKILL.md` (steps 11–14, the revision), `tests/static/buildGuidePipeline.test.ts`]
- produces: [the three V4 lenses (§7.4), the fix round and the re-check (§5.5), the checkpoint-2 revision (§5.6)]
- consumes: [C-30, C-33, C-37, C-38, C-43, D-232, D-236, D-237]
- acceptance: [AC-W12, AC-W14]
- milestone: M-12
- summary: V4 checks that claims are true, through agents that didn't write the plan and can't edit it
  (D-142). V4 accepts `external-unavailable` only in offline mode (C-30). Verification runs once, the owners
  fix once, the lenses re-check, and what stays open becomes a known issue; it never escalates (D-268).

### WU-47: Offline end-to-end pipeline run, recorded
- kind: build (recorded run)
- status: built. M-12 was met on 2026-10-09 with four recorded exceptions, closed by the user's direction
  without a re-run (`../worklog.md:799-826`): run A's checker failed on campaign-reward picks (the real
  defect, since fixed) and on reports written before `reader` existed (E1); run B left a stray scratch file,
  which the checker caught, so D-177 holds by prompt only (E2); verifier recall varies between passes (E3);
  and D-264's claims-only path, D-265 (b)–(e) and D-266 are verified by tests and review demos, not yet by a
  run (E4). The work-log named WU-48 as their first run; WU-59, which now comes before it (D-315), is.
- depends-on: [WU-44, WU-46]
- role: build coordinator, with an independent verifier checking the record
- touches: [the work-log only; temp dirs and a worktree. Failures re-open the owning unit]
- produces: [the M-12 record]
- consumes: [everything in this slice; the M-11 server]
- acceptance: [AC-W4, AC-W15, AC-W16, AC-W17, AC-W18, AC-W19, AC-W20, AC-W21, AC-W22, AC-W26]
- milestone: M-12
- summary: The procedure is fixed (D-274):
  1. **Setup.** A worktree at the commit under test, bootstrapped (`mise trust && pnpm install
     --frozen-lockfile && mise run pob:fetch && pnpm build`). Temp dirs for the builds folder, the state
     dir, the guides root and the server's cwd.
  2. **Server.** An MCP config registers this server under the name `pob2`, so the allowlists match,
     loaded so that the user's own `pob2` isn't (spine §9). It starts the server from the temp cwd with
     `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY` at the temp dirs,
     `POE_TRADE_DISABLED=true`, `POE_NINJA_DISABLED=true`,
     `POE_TRADE_BASE=http://127.0.0.1:9/api/trade2` and no `POESESSID`.
  3. **Session.** An interactive Claude Code session that the user starts in the worktree, with step 2's
     MCP config (D-263: a headless run isn't a real-world test of the skill), on the user's default model,
     Opus (D-275): WebSearch and WebFetch denied; writes allowed under the temp guides root. **The kept
     evidence** is the session's transcript and its subagent transcripts, which record each agent's tool
     calls (D-267).
  4. **Run A:** `/build-guide Titan "Blood Hunt" --offline --test A.json`, with answers checkpoint 1
     `["first-viable"]` and checkpoint 2 `["accept"]`, and faults FI-1 `{concepts:["c1"], persistent:true}`
     and FI-2 `{concepts:"all", persistent:false}` (only the chosen concept reaches D1).
  5. **Run B** (the failure routes): the same command with `--test B.json`, answers checkpoint 1
     `["pick:c1", "pick:c2"]` and no escalation answer, and faults FI-1 `{concepts:"all", persistent:true}`
     (no viable concept), FI-3 `{concepts:["c1"]}` (c1 infeasible) and FI-2 `{concepts:["c2"],
     persistent:true}` (a D1 gate escalation, answered by the default `stop`).
  6. **Probes and review:** P1 (AC-W4 and AC-W26's invalid rolls) and P2 (AC-W15, AC-W21 and AC-W26's
     unsaved build), then the coordinator's guide review (AC-W22).

  **Quality clauses.** A clause marked *(quality)* depends on how well the agents perform, not only on
  the code. A quality clause that misses gets one coordinator re-run of that run. If the re-run misses
  too, the coordinator logs a finding against the prompts (the owning unit's stage references) in the
  work-log, and the owning unit reworks them. That rework is not a gate failure of the code.

### WU-48: Human — the live Titan / Blood Hunt run and the user's sign-off
- kind: build (human gate)
- depends-on: [M-14 (WU-59), HG-14]
- role: **user**, assisted by the build coordinator
- touches: [the user's guides and builds folders (coordinator and user only); the work-log]
- produces: [the alpha sign-off (M-13)]
- consumes: [everything]
- acceptance: [the WU-48 checklist below]
- milestone: M-13
- summary: The first live run, with web research on D-171's hosts and live pricing through the server. It
  runs after M-14 ("open builds offline"), so it exercises the amended pipeline; its trade gate is unchanged
  (D-315). The user answers every gate, then plays the guide.

**WU-48 checklist.** Each item is recorded pass or fail, with a note. Item 11 is set up before item 3,
and its file is shown to the user with item 1's approval.
1. **Approval.** HG-14's approval is recorded in the work-log before anything starts: live trade through
   the server, web research on D-171's hosts, writes to the real guides and builds folders. poe.ninja,
   reached only through the server's tools, needs no approval (D-297); trade keeps D-182's.
2. **Server.** The user's registered `pob2` server runs the commit under test, with trade enabled. The
   cookie is the user's own, and no agent handles it.
3. **Run.** In a session in the repo, `/build-guide Titan "Blood Hunt"` (online, no test config; the old
   form still works, C-51). The run log shows `answeredBy: "user"` at every gate (after WU-58: the
   brainstorm, verification and final gates).
4. **Checker.** `check-run.mjs` exits 0 on the run folder.
5. **Checks pass.** The final record's V1 and V2 verdicts pass for every stage, and every finding open after
   the re-check is listed under `Known issues` (D-268).
6. **PoB file.** The file has one loadout per stage. `encode_build_code` on it equals the record's
   `importCode` and the code in `guide.md`, and the code round-trips (D-180).
7. **Run log and evidence.** No step's `priceOutcomes` counts a `rate_limited` or `locked_out` call
   (NFR-22, D-270); the caps hold (NFR-23), read from `stages[]` and the transcript; every WebFetch in the
   session and subagent transcripts went to one of D-171's hosts.
8. **PoB2 import.** The user imports the code in PoB2 on Windows and sees one loadout per stage, and
   switching loadouts shows each stage (A-21).
9. **Play-test.** The user levels with the guide through the campaign and maps with an endgame variant.
   Issues are recorded.
10. **Sign-off.** The user signs off in the work-log (M-13 item 5). The run's actuals are recorded for
    HG-15's envelope review.
11. **Session permissions.** For the run, the coordinator writes the project's
    `.claude/settings.local.json` (gitignored) and shows it to the user at HG-14's approval. The work-log
    records its rules:
    - Write and Edit are allowed only under the guides root;
    - WebFetch is allowed for `poe2db.tw`, `maxroll.gg`, `game8.co`, `poe-vault.com` and the patch-note
      mirrors the file names;
    - WebFetch is denied for `pathofexile.com` and `poe.ninja`.
12. **Trade links** (D-276, HG-22). The guide writes affix targets as text. Whether a trade-link field is
    added, if the price tool returns a link, is the user's decision at this run.

### WU-56: Content — the pattern library, the card template and the checklist
- kind: build
- status: not built (target)
- depends-on: []
- role: pipeline author
- touches: [`.claude/skills/build-guide/references/patterns.md` (new), `.claude/skills/build-guide/templates/card-template.md` (new), `.claude/skills/build-guide/references/stages/R1b.md` (the checklist), `tests/static/buildGuidePipeline.test.ts`]
- produces: [the pattern library v1 (§7.6, C-53), the card template (§7.5, C-52), the verification checklist and probe budget in R1b's reference (§7.7)]
- consumes: [D-290, D-291, D-292; the work-log's "Off-meta builds 7–30" and "Process heuristics, by phase"]
- acceptance: [AC-W27, AC-W28, AC-W29]
- milestone: M-14
- summary: Amendment 3's N-5. The content the brainstorm and verification phases read. Independent of the
  other units; WU-57 builds on it.

### WU-57: The pipeline — brief, three phases, cards, Count and the named damage source
- kind: build
- status: not built (target)
- depends-on: [WU-50, WU-55, WU-56, WU-62; soft: WU-52 (WU-57 uses offline stubs of the poe.ninja tools until WU-52 merges)]
- role: pipeline author
- touches: [`SKILL.md` (invocation, steps, hosts and routes); `references/stages/R1a.md` (foci, cards, the library); `references/stages/R1a-assemble.md` (new); `references/stages/R1b.md` (the card's identity, the checklist, the probe budget); `references/stages/R1b-assemble.md` (`TotalEHP` in the key numbers); `templates/guide-template.md` and `references/stages/W1.md` (the verdict line's EHP); `references/checkpoints.md`; `references/offline-and-test.md`; `references/gates.md` and `references/stages/D1-gate.md` (figure × count); `references/stages/D1.md`, `D2.md`; the agent definitions, including `build-guide-verifier.md`'s re-check line, which still states the rule from before D-264 (AC-W14); the "rolled skill" wording across the skill; `tests/static/buildGuidePipeline.test.ts`, including its check of that line]
- produces: [the brief and invocation (FR-W1, C-51); the three phases and gates (§5.2, §10); R1a-assemble and the deck (§7.5); the card halves; the checklist run (§7.7); the named damage source and figure × count in the D1 gate (§5.3); D1's Count and custom-modifier work; D2's bridge skills; the poe.ninja rules (§4, FR-W3); the renamed routes and test answers (§11.2)]
- consumes: [C-51, C-52, C-53, C-54 (names and threshold from WU-50, the tools from WU-52), C-33's Count-scaled fields and custom-modifier marks (WU-55), D-285…D-301]
- acceptance: [AC-W30, AC-W31, AC-W32, AC-W33, AC-W14 (the re-check rule), AC-W5's target clause]
- milestone: M-14
- summary: Amendment 3's N-6. Merges after WU-62, whose verdict line it extends, and before WU-58. It needs
  WU-50's tool names and popularity threshold (D-298, D-324), and WU-57 uses offline stubs of the poe.ninja
  tools until WU-52 merges (amendment 3's N-6: "N-1's tool names (stubbed offline until then)").

### WU-58: The checker and run log v3
- kind: build
- status: not built (target)
- depends-on: [WU-57]
- role: pipeline author + test infra
- touches: [`scripts/check-run.mjs` (the run-log fields, roll and brief, the escalation answer, checkpoints, the flow with picks, mores, brainstorm and verification rounds, card ids and the caps, the rolled-skill recompute with Count, the verdict line's EHP); `references/run-log.md`; `tests/unit/buildGuideCheckRun.test.ts`; `tests/fixtures/pipeline/` (`run-ok`, `run-ok-online`, `run-escalated` rebuilt)]
- produces: [run log v3 (§6), the v3 checks (FR-W7's target)]
- consumes: [D-287, D-289, D-294, D-326]
- acceptance: [AC-W2 (aa)…(ee)]
- milestone: M-14
- summary: Amendment 3's N-7. The checker accepts schema 2 and 3 logs; schema 2 only so recorded runs
  still check.

### WU-59: Offline end-to-end run with an open brief, recorded
- kind: build (recorded run)
- status: not built (target)
- depends-on: [WU-50…WU-58, WU-60…WU-62]
- role: build coordinator, with an independent verifier checking the record
- touches: [the work-log only; temp dirs and a worktree. Failures re-open the owning unit]
- produces: [the M-14 record]
- consumes: [everything in this slice]
- acceptance: [pinned at the unit's first step (A-33). They include the coordinator's guide review with
  amendment 2's style rules (the reader layer's rules, each caveat once, the not-a-tutorial rule; D-276,
  D-280), and a run through the paths WU-47 left to tests and review demos: D-264's claims-only path,
  D-265 (b)–(e) and D-266 (WU-47's exception E4)]
- milestone: M-14
- summary: Amendment 3's N-8: WU-47's recorded procedure, with an open brief in place of a roll. The brief,
  the test answers and the faults are chosen when the unit starts. Its first step pins its acceptance
  criteria in this slice from the amendment's text, and the coordinator reviews them before the run
  (A-33). Its record, with every unit above merged, is M-14's exit (D-315).

### WU-62: The guide style — the reader layer, the audit layer and the guards
- kind: build
- status: not built (target)
- depends-on: [WU-61]. Soft: if WU-60 has merged, D1 uses its affix sources (a mod's base types, essences)
- role: pipeline author + test infra
- touches: [`templates/guide-template.md` (rewritten); `templates/audit-template.md` (new); `references/stages/W1.md`, `V4.md`, `D1.md`, `D2.md`, `D1-gate.md`; `references/gates.md`; `references/source-markers.md`; `SKILL.md` steps 10 and 14; `references/run-folder.md`; `references/task-header.md`; `scripts/check-run.mjs` (the guards); `tests/static/buildGuidePipeline.test.ts`; `tests/unit/buildGuideCheckRun.test.ts`; `tests/fixtures/pipeline/run-ok` and `run-ok-online` (a new-style `guide.md` plus `audit.md`)]
- produces: [the reader layer (§8's target), `audit.md` (§7.8), the editor lens (§7.4's target), the entering-maps rung in D1, D2 and the gates (§5.3), the checker's guards (FR-W7's target)]
- consumes: [D-276…D-283; C-31's `entering-maps` variant and the ladder track (WU-61); the lookup's base types for a mod (WU-60, if merged)]
- acceptance: [AC-W2 (v)…(z) and the amended (b) and (l), AC-W11 (G1's H2s)]
- milestone: M-14
- summary: Amendment 2's pipeline work (its G8). Merges before WU-57 and WU-58, which edit its verdict line
  (D-317).

## 13. Acceptance criteria

**The skill and its shared contracts (WU-43)**

- **AC-W1 (WU-43; changed by D-267).** Static, `tests/static/buildGuidePipeline.test.ts`.
  - `.claude/skills/build-guide/SKILL.md` exists, with frontmatter `name: build-guide` and a description.
  - It names the four agent types of §4, `--offline` and `--test`, and no saved workflow, `Workflow(` call,
    `.claude/workflows` path or fallback.
  - Its step list has steps 1 to 16, each naming its agent type.
  - Every `references/`, `templates/` and `scripts/` path it mentions exists, and it lists every shared
    reference it ships.
- **AC-W2 (WU-43; changed by D-271, D-264, D-265, D-266).** Unit, `tests/unit/buildGuideCheckRun.test.ts`,
  which spawns `node .claude/skills/build-guide/scripts/check-run.mjs <dir>` with an explicit env.
  - It exits 0 on the passing fixtures in `tests/fixtures/pipeline/`:
    - `run-ok/`, an offline run whose free FI-2 failure, W1 fix round and prose re-check leave one known
      issue in the guide, and which includes an endgame stage whose chaos resistance stays below its cap
      by a `chaosResistException` whose reason the guide's `Checks` states (D-234);
    - `run-ok-online/`, an online run with `ok` prices and `priceOutcomes`, whose budget total is over 20
      and at most 22 divines and whose guide carries the `near the ceiling` note (D-219);
    - `run-escalated/`, a D1 gate escalation answered by the default `stop`, its verdict file named and no
      findings copied.
  - On each broken copy it exits non-zero, and its stderr names the broken rule:
    - (a) `guide.md` is missing from a completed run; a stray file is in the run folder; a report is named
      the old way (V3, or a V4 report with a pass number);
    - (b) a §8 H2 is missing or out of order;
    - (c) a Leveling H3 differs from the record's campaign loadout names;
    - (d) a `[^id]` marker has no definition, or a `ledger`, `data` or `price` definition names no
      existing entry;
    - (e) an `external` tag has no `accessed`;
    - (f) a `judgment` tag has no `confidence`;
    - (g) an `external-unavailable` tag appears in an `online` run;
    - (h) the guide's import code differs from the record's `importCode`;
    - (i) a required run-log field is missing, or the log is schema 1;
    - (j) *Withdrawn → D-271:* the count-based cap rule. The caps are read from `stages[]` under the
      control-flow cases below.
    - (k) an offline run has a `prices[]` status `ok` or a price call;
    - (l) a finding open after the re-check is missing from `Known issues` (D-268);
    - (m) *Withdrawn → D-271:* the claim-count comparison.
    - (n) a V4 report misses a §7.4 field, says `verdict: "pass"` alongside an `unresolved` finding, has a
      `check` that differs from its file name, or has a finding on the dossier or owned by `dossier-fix`;
    - (o) the floor doesn't hold up: `floor: pass` over an endgame stage with `MissingColdResist` above 0;
      `MissingChaosResist` above 0 with the `chaosResistException` removed; the exception's reason, or the
      uncapped chaos value with `%`, missing from its line of `Checks` (D-234); an endgame stage without its
      waystone-scaled chaos hit, or a hit that isn't the ceiling of its ledger entry's value (D-254, D-256);
    - (p) the budget doesn't hold up: `budget: pass` over prices and rates that give more than 22 divines;
      a filled slot or tree jewel that maps to no `prices[]` entry, or an expensive jewel that tips the total
      over 22 (D-249); two slots holding different items sharing an entry; a total over 20 without
      `near the ceiling`;
    - (q) the rolled skill doesn't hold up: `rolledSkill: pass` while a same-role group has a larger figure,
      or the rolled group's role is `utility`;
    - (r) `plan.json`'s sha1 differs from the final record's `planSha1`;
    - (s) the import code doesn't decode or isn't the PoB file's, the loadout count differs from the plan's
      stages, or a tree set isn't titled by its stage's loadout name (D-215);
    - (t) a ledger entry doesn't re-evaluate to the record's value (FI-4's doubled formula among them);
    - (u) the rolled figure's stat set isn't `skills.main.statSet`, or an endgame stage sets none (D-273).
  - It also covers, as built: the Known issues list (fixed findings, a re-check that leaves a finding out,
    an earlier cycle's re-check, a guide without the H3); `accepted-offline` only from the sources lens and
    only on an `external-unavailable` claim; a failing gate part no accepted finding covers once a guide
    exists; accepted-finding equality by plan stage, part and code; budget rounding to 2 decimals; D-256's
    ceiling; the `basis`; D-260's `outputs`; `priceOutcomes` and NFR-22; the checkpoint `rule`; the control
    flow (legal order, missing returns, the caps of D-272 with S6, one full pass and at most one re-check per
    cycle, escalations only from the gates, routing by the verdict file, what is current); D-264's
    claims-only round with D-266's `buildSha1`; D-265 (a), (c) and (d).
  - `--partial` is a usage error (exit 2).
  - *Target (WU-62, D-283, D-281):* new broken copies: (v) `guide.md` over 3,000 words (the H1, the import
    code and the Known issues list not counted); (w) a marker in `guide.md` (`[^`, `confidence H|M|L`, or a
    finding id); (x) a rung's verdict line missing, or a part not matching the record by the rounding rule;
    (y) `m`'s budget above 5.5, or above 5 without "near the ceiling", and `m`'s floor; (z) `audit.md`
    missing one of its H2s. Amended: (b) checks the reader layer's 14 H2s; (l) checks Known issues by
    sentence, with the id in `audit.md`; reward picks are checked by name.
  - *Target (WU-58, D-287, D-289, D-294, D-326):* (aa) a run log whose `schemaVersion` is neither 2 nor 3, or
    a schema-3 log whose `roll` is set before the verification pick; (bb) the caps: a brainstorm round with
    more than 3 R1a entries or more than one R1a-assemble, a verification round compiling more than 3
    cards, while a second verification round from one deck passes; (cc) the escalation answer
    `checkpoint-1` (now `verification`); (dd) the verdict line's "Effective HP about <n>." missing, wrong or
    mis-rounded against `TotalEHP`; (ee) the D1 gate recompute reads figure × count.
- **AC-W3.** *Withdrawn → D-267:* the workflow harness test; amendment 1 deleted the harness.
- **AC-W23 (WU-43; positive allowlist probe, run early).** Met at WU-43 and kept as recorded
  (`../worklog.md:257-260`): a recorded headless `claude -p` probe with a strict MCP config that registers
  this server as `pob2` from a temp cwd, temp `POB_DIRECTORY`, `XDG_STATE_HOME` and `POB_GUIDES_DIRECTORY`,
  and trade and poe.ninja disabled. An agent carrying the researcher's `tools:` line, told to call
  `mcp__pob2__lookup_game_data {mode: "gem", query: "Blood Hunt"}`, returned a result naming the gem. The
  work-log records the outcome "reached directly", so ToolSearch joins no row of §4. (The probe predates
  D-263, which forbids headless sessions for pipeline runs.)

**Research steps (WU-44)**

- **AC-W5 (WU-44; extended by WU-45 and WU-46; changed by D-267).** Static: there are four definitions in
  `.claude/agents/build-guide/`, and each satisfies R-1…R-5 of §4. The test parses the `tools:` line and
  checks each `mcp__pob2__` name against L, B, C and P and against `TOOL_META`. Each set's members exist in
  `TOOL_META`. L and B hold only group-`core`, kind-`read` tools, and none of them is `lua_save_build`,
  `export_build` or `save_config_preset`. R-6: every Agent call `SKILL.md` names gives a `subagent_type`,
  one of the four types.
  *Target (WU-57, D-297):* the test also knows the set N, the poe.ninja tools of group `ninja` (C-54): the
  researcher's and the coordinator's `tools:` lines may name N tools (R-2…R-4 as their targets amend them),
  and N's members exist in `TOOL_META` once WU-52 has merged.
- **AC-W6.** *Withdrawn → D-267:* the research-workflow harness test.
- **AC-W7.** *Withdrawn → D-267:* the research-workflow harness test of R1b failures.

**Design steps (WU-45)**

- **AC-W8.** *Withdrawn → D-267:* the design-workflow harness test of the happy path.
- **AC-W9.** *Withdrawn → D-267:* the design-workflow harness test of the D1 gate table.
- **AC-W10.** *Withdrawn → D-267:* the design-workflow harness test of the D2 gate and FI-2/FI-3.
- **AC-W11 (WU-45; changed by D-268).** Static: `templates/guide-template.md` has §8's H2s in order, the
  same list the run checker holds, under one H1 naming the roll; the H3 `Checks` under both endgame H2s; and
  `### Known issues` as the last part of `Confidence and what PoB can't model`, replacing `Accepted
  failures`. The writer definition satisfies §4 (AC-W5 extended).
  *Target (WU-62, D-276):* the template has the reader layer's 14 H2s.
- **AC-W24.** *Withdrawn → D-267:* the harness test of the workflow's resume paths.

**The verifier (WU-46)**

- **AC-W12 (WU-46; changed by D-267).** Static: `SKILL.md`'s verifier prompt carries only the task header
  and the reference line (D-142).
- **AC-W13.** *Withdrawn → D-267:* the harness test of V3/V4 finding routing.
- **AC-W14 (WU-46; changed by D-267, D-264).** Static: the verifier definition satisfies §4: Read, Glob, Grep,
  WebFetch and L only (no Write, Edit, Bash or WebSearch; no C or P tool). It states that its report is its
  return, which the runner writes (R-5), that it is fresh and independent (D-142), C-30's offline rule, that
  offline it doesn't fetch a data fact's citation URL (D-232), and that it runs once as a full pass, then
  once as a re-check under D-264's rule (`SKILL.md` step 13, `references/stages/V4.md`): all three lenses
  when a gate re-ran in the fix round, otherwise each lens that raised a finding and the sources lens
  always. As built, the definition (`build-guide-verifier.md:11-13`) and its test
  (`buildGuidePipeline.test.ts:846`) still state the earlier rule ("for a lens that raised a finding");
  WU-57, which edits the agent definitions, aligns both.
- **AC-W25.** *Withdrawn → D-267:* the harness test of the checkpoint-2 revision resume.

**Offline end-to-end run (WU-47).** Recorded coordinator checks, re-checked by an independent verifier.
*(quality)* marks a quality clause (WU-47).

- **AC-W4 (WU-47; WU-43's test-config refusal).** A recorded probe in the M-12 environment: in the
  interactive session of step 3 (D-263), `/build-guide Titan "Blood Hunt" --test A.json`, without
  `--offline`, bounded to end before R1a starts.
  - The run folder's `run-log.json` exists, with `mode: "online"` and `testConfig: "refused"`.
  - No checkpoint is `pre-supplied`, and no `research/` file exists.
- **AC-W15 (WU-47; WU-46's `ledger` lens; changed by D-274).** A recorded seeded check.
  - Copy run A's folder. In the copy's `plan.json`, wrap one ledger entry's formula as `(<formula>) * 2`
    (FI-4), leaving the record and the guide unchanged. Set the copy's `run-log.json` mode to `online`
    (FI-5).
  - In the M-12 environment, run the three lenses on the copy as step 11 runs them, with the Agent tool
    (`subagent_type: build-guide-verifier`, `check: "full"`).
  - The `ledger` lens reports an `unresolved` finding naming that ledger entry's id. A finding for every
    `external-unavailable` claim in the copy is `unresolved`.
- **AC-W16 (no network; D-181, D-201; changed by D-274).**
  - (a) The recorded server env shows step 2's settings, without secrets.
  - (b) A scan of the transcripts, subagents included, finds no `WebSearch`, `WebFetch` or P-tool use.
  - (c) *Withdrawn → D-270:* the run log has no `pricing` totals; (b) and (d) cover it.
  - (d) Every `prices[]` entry in every plan of both runs is `unavailable`.
  - (e) Every Bash command in the transcripts is the run checker or is listed in the work-log, and none
    runs a network client (`curl`, `wget`, `nc`, `ssh`) or names a host. No agent type has Bash (R-4).
- **AC-W17 (run A artifacts; changed by D-274).**
  - `check-run.mjs` exits 0, its checks of §2's layout, the final record and the guide included.
  - `guide_run {validate: <runFolderRel>/plan.json}` returns no error.
  - The final record's V1 and V2 verdicts pass for every stage.
  - The temp builds folder holds exactly one file: the record's PoB path, named after `buildName`.
  - `encode_build_code` on that file equals the record's `importCode` and the guide's code, and decoding
    it gives one loadout per plan stage (D-180).
  - Every compiled concept has its record and its XML in `concepts/<id>/`, and the record names that XML
    (measure-only, D-208).
  - The dossier has 2 or 3 concepts. *(quality)*
  - Every finding open after the re-check is under `Known issues` (the checker), and every full-pass finding
    an owner reported fixed passes its re-check. *(quality)*
- **AC-W18 (run A log; changed by D-274).**
  - `mode: "offline"`, `testConfig: "accepted"`. `status: "completed"` *(quality)*.
  - `stages[]` follows the run order.
  - The R1a entries equal the research files, and are at most 3 for the one round.
  - `c1` has 3 R1b attempts and is `failed`; its last R1b verdict names `FI-1 Unknown Gem`, and the
    transcript's checkpoint-1 display lists it as failed.
  - The chosen concept's D1 gate attempt 1 has a V1 finding for the stage FI-2 edited; D1's re-run after it
    is uncounted (D-272), and the gate passes within 2 counted retries. *(quality)*
  - Both checkpoints are `pre-supplied`, each with its `rule`.
  - `faults[]` shows FI-1 applied 3 times and FI-2 once.
  - NFR-23 holds, read from `stages[]` and the transcript.
- **AC-W19 (run B, the failure routes; changed by D-274).**
  - `status: "escalated"`.
  - The transcript's first checkpoint-1 display is the no-viable view, listing every concept with its FI-1
    evidence; the second shows `c1`'s FI-3 infeasibility evidence.
  - `c2`'s D1 gate has 3 attempts, each with a V1 finding, followed by one escalation; no D2 or W1 step ran.
  - The escalation records `choice: "stop"`, and its `checkpoints[]` entry has `answeredBy: "default"`.
  - No file in the temp builds folder comes from run B.
  - `check-run.mjs` exits 0, with no `--partial`.
- **AC-W20 (write roots; D-177, C-17).**
  - `git status --porcelain` in the worktree is empty before and after.
  - Every file created under the temp guides root is inside run A's or run B's folder, or one of
    AC-W4's and AC-W26's probe run folders.
  - The temp builds folder holds only run A's PoB file.
  - No path under `/mnt/` appears in the tool calls of the kept evidence, the subagent transcripts included.
- **AC-W21 (allowlists are enforced; A-24; changed by D-274).**
  - A `build-guide-researcher`, started with the Agent tool, is told to call
    `mcp__pob2__guide_run {new_run: "probe"}` and report the result. It can't, and no `probe/` folder
    appears in the guides root.
  - A `build-guide-verifier` told to Write a file into the guides root leaves no file there.
- **AC-W22 (the coordinator's checkpoint-2 review; A-28).** The coordinator reads run A's `guide.md`
  against §8's table and records, per H2, whether it is present and complete. It also records whether a
  reader could follow it from level 1 to an endgame variant (the quality bar). Any `incomplete`
  re-opens WU-45. (The review of amendment 2's style rules is a WU-59 criterion, pinned at that unit's
  start: A-33.)
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

**Content (WU-56; target, D-290, D-291, D-292)**

- **AC-W27 (WU-56).** Static: `templates/card-template.md` holds both halves' fields (§7.5) and the six
  status words.
- **AC-W28 (WU-56).** Static: each `references/patterns.md` entry has its name and shape, search step, how
  PoB follows it (one of the six labels), examples and cautions; the brainstorm questions open the file; and
  the file is at most 6,000 words (D-325).
- **AC-W29 (WU-56).** Static: `references/stages/R1b.md` lists the eight checks of §7.7, the result words
  "verified, estimate, risk, not checked", and the probe budget of up to 4 one-stage measure-only variants
  per card, in order.

**The pipeline (WU-57; target, D-285, D-287, D-295, D-297)**

- **AC-W30 (WU-57).** Static: `SKILL.md` gives the invocation
  `/build-guide <free text> [--offline [--test <path>]] [--no-ninja]` and the seven brief fields, and still
  accepts `<ascendancy> <skill>`.
- **AC-W31 (WU-57).** Static: `SKILL.md` names the gates `brainstorm`, `verification` and `final` and the step
  `R1a-assemble` (type `build-guide-coordinator`), and `references/stages/R1a-assemble.md` exists.
- **AC-W32 (WU-57).** Static: the stage references use D-122's wording, "named damage source". The exact
  assertion is pinned at the unit's first step (A-33).
- **AC-W33 (WU-57).** Static: `SKILL.md` and the researcher's and coordinator's definitions say poe.ninja is
  reached only through the server's poe.ninja tools; the researcher's allowlist may name them; R-3 holds for
  C and P.

## 14. Test strategy (this slice)

| AC | Class | Runs in |
|---|---|---|
| AC-W1, W5, W11, W12, W14 | static (pipeline files) | `mise run test` |
| AC-W2 | unit (the run checker spawned with an explicit env, over fixture run folders) | `mise run test` |
| AC-W23 | recorded probe, early in the unit | WU-43 |
| AC-W4, W15…W22, W26 | pipeline run (recorded; independent verifier) | WU-47 |
| WU-48 checklist | human (HG-14) | the user |
| AC-W27…W33 (target) | static (pipeline files) | `mise run test` |
| AC-W2 (v)…(ee) (target) | unit (the run checker, rebuilt fixtures) | `mise run test` |
| WU-59's criteria (target) | pipeline run (recorded; pinned at the unit's start) | WU-59 |

The checker's control-flow cases over fixture logs exercise every failure route deterministically and
offline, in place of the deleted workflow harness; run B of WU-47 drives every failure route live (D-267).
The recorded runs prove that the real agents, tools and allowlists behave the same way. No test or run in
this slice contacts pathofexile.com, poe.ninja or D-171's hosts before M-13 (D-34, D-181); the poe.ninja
tools' tests use committed fixtures (D-297).

## 15. Open items and their resolutions

The first draft left these holes in the inputs open. The coordinator resolved each on 2026-10-07, and
the spine records the resolutions as binding decisions (D-231…D-238). The user settled D-210 (ask before
discarding unsaved work), D-219 (the budget tolerance) and D-234 (the survival floor gates chaos too, bar a
recorded exception) on 2026-10-08. D-231 also corrects C-36's wording on who may call lookups (§4, FR-W3).

| Id | Hole | Resolved by | Applied in |
|---|---|---|---|
| O-1 | "Ask for more" at checkpoint 1 (D-157) against the 3-concept cap (D-161, NFR-23) | **D-235:** the cap applies per research round; "ask for more" starts a new round of up to 3 concepts, only at the user's answer; rounds are read from checkpoint 1's `more` answers (D-270). *Target (D-287):* 6–9 cards per brainstorm round, at most 3 per verification round | §5.2, §6, §10, FR-W7 (4) |
| O-2 | Checkpoint 2 offered no revision loop | **D-236, as D-267 and D-268 amend it:** the user may ask for changes; the runner maps each request to D1, D2 or W1 by the fix round's owners, runs that chain, then a full pass, the fix round and the re-check; revisions count against no retry cap | §5.6, §10 |
| O-3 | What the user can choose after an escalation (D-141 says only "escalates") | **D-236, as D-268 amends it:** gate escalations only; accept, with the failure stated in the guide; give guidance and retry once more; go back to checkpoint 1 (*target*, D-287: the verification gate); stop | §5.4, §8, §11.2 |
| O-4 | Offline, V4 can't open the URL of a claim copied from C1/E1 | **D-232:** such a claim cites its fact as `data:<file>#<key>`; V4 checks it against the data-file fact and its stored citation, without fetching the URL offline | §7.3, §7.4, §11.1 |
| O-5 | The tag of a price claim | **D-237:** `price:<id>`, citing the plan's `prices[]` entry by its `id`; the entry holds the date, league and query | §7.3, §7.4, §8, §9 |
| O-6 | Whether the survival floor's "capped resistances" (D-118) includes chaos | **D-234 (user, 2026-10-08):** all four resistances are gated at their caps; chaos may stay uncapped only through a stage's recorded `chaosResistException` | §5.3 floor, §8, FR-W7, AC-W2 |
| O-7 | An invalid roll (an unknown ascendancy or skill) had no defined behaviour | **D-238:** before any agent runs, the runner checks the ascendancy (`get_classes`) and that the skill is an active skill gem (a gem lookup); a failure stops with the closest valid names (D-258) and no run folder | FR-W2, AC-W26 |
| O-8 | `league` is required in every plan (C-31), but offline no tool reports it | **D-233:** `league` may be null only when every price is `unavailable` with `note: "offline run"`; the schema enforces it. **D-313, D-330:** an online run that can't reach trade writes `"league": "unverified"`; offline stays null | §9, §11.1 |

**The fold's gaps** (the F-n ids of the work-log's "Spec fold v1.3 (2026-10-10)"), as settled on
2026-10-10: F4 by the user, the rest by the coordinator (PROPOSED, binding until the user overrides them).
The last two rows came after the fold: `--no-ninja` (D-333) and a non-skill card's identity (D-334).

| Id | Gap | Settled as | Applied in |
|---|---|---|---|
| F1 | Amendment 2 was approved but not built | **D-317:** folded as target design, its pipeline work in WU-62, which merges before WU-57 and WU-58 | §8, §12 |
| F4 | No milestone for the new units; whether amendment 3's live run is WU-48 | **D-315 (the user):** milestone M-14, "open builds offline", exits when WU-50…WU-62 are merged and WU-59 is recorded as WU-47 was; WU-48 is the live run, depends on M-14 and exercises the amended pipeline, its trade gate unchanged | §12 |
| F6 | How parallel researchers name cards without collisions across rounds; whether the research files stay | **D-319:** card ids `r<round>-<researcher letter>-<n>` at `cards/<id>.md`, lettered by the runner; `research/p<k>-r1a-<n>.md` stays, and WU-57 removes it with a decision row only if it finds the files unused | §2, §5.1 |
| F12, F20 | No acceptance criteria for WU-59 (amendment 3's "like WU-47") or for the D-122 wording test | **A-33:** each unit's first step pins its criteria in this slice from the amendment's text, and the coordinator reviews them before any work; "like WU-47" means WU-47's recorded procedure with an open brief | WU-59, AC-W32 |
| F13 | The final gate's test answers | **D-323:** `answers.brainstorm`, `answers.verification` and `answers.final`; `checkpoint1` and `checkpoint2` retire with run log v3 | §11.2 |
| F14, F15 | Who sets the popularity threshold for a deck's under-played cards; the poe.ninja tools' details | **D-324:** outputs of spike WU-50, the tools' details into C-54 and the threshold as a decision row | §4, §5.2 |
| F16 | The pattern library's word cap | **D-325:** 6,000 words, counted by AC-W28's static test | §7.6, AC-W28 |
| F17 | Whether the checker still accepts schema-2 logs after v3 | **D-326:** both; schema 2 only so recorded runs (WU-47's) still check | FR-W7, §6, AC-W2 (aa) |
| F19 | Amendment 2's trade-link field | **HG-22** (PROPOSED by the coordinator): if the price tool returns a link, the user decides at WU-48 whether to add the field | WU-48 item 12 |
| F21 | The entering-maps rung in D-256's area-level tie | **D-327:** `m` follows the tie, at D-281's area level 69 (the coordinator's inference) | §5.3 |
| F27 | Where probe variants live | **D-331:** `probes/<card-id>/<n>/` in the run folder | §2, §7.7 |
| — | Whether `--no-ninja` also stops `get_currency_rates`, which totals budgets in divines | **D-333:** yes; the run calls no tool in group `ninja`, and price totals are then `unverified` (`references/pricing.md:88-89`) | FR-W1, §11.1 |
| — | How a card whose damage source isn't a skill passes the identity check at deck assembly, which needs a gem lookup showing `Kind: active` (amendment 3 says such a card can be dealt and verified, D-303) | Settled by D-334 (PROPOSED by the coordinator, 2026-10-10): checked by a lookup of the source's kind; read-only checks only until HG-21 | C-52, §5.2, §7.5 |
