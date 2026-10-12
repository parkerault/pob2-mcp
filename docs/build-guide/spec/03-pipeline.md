# Slice 03: Pipeline — the build-guide skill, its runner and agents, the offline run, the alpha

**Status: fold applied 2026-10-10; fold v1.4 applied 2026-10-11; WU-59's criteria pinned 2026-10-11
(AC-W34…AC-W50, A-33); fold v1.5 applied 2026-10-11.** This slice folds in the build's pipeline
decisions (D-239…D-266 and D-305…D-314 where they touch the pipeline), amendment 1 (built: D-267…D-275),
amendment 2 (approved 2026-10-09, built by WU-62: D-276…D-284), amendment 3 (approved 2026-10-10; built by
WU-56, WU-57, WU-58 and WU-63: D-285…D-304), the fold's own resolutions (D-315…D-334, A-33, HG-22), v1.4's
D-335 (no player-evidence tools) and D-338 (R1b's probe and card writes), and v1.5's D-339…D-344 (the last
units' decisions and WU-59's) and amendment 4 (accepted by the user 2026-10-11: D-345…D-362, *target*). The
amendments stay as the rationale record; the spine and this slice are authoritative.

Part of the [spec spine](README.md) ("spine"). It covers work units WU-43…WU-47, WU-56…WU-58, WU-62 and
WU-63 (built), WU-59 (recorded; re-scoped by D-361), WU-48 (the human alpha), and WU-64 and WU-69…WU-72
(target, milestone M-15), and acceptance criteria AC-W1…AC-W62 with AC-W2 (a)…(ff) (AC-W3, AC-W6…W10,
AC-W13, AC-W24 and AC-W25 withdrawn by D-267; AC-W45 and AC-W46 by D-361), plus the WU-48 checklist.
Requirements trace to the spine's contracts and decisions (C-30…C-54, C-54 withdrawn, D-100…D-362, A-20…A-35), the
design rows they lift, the platform
grounding ("platform §") and ext §5 (the prior-art guide outline). `../worklog.md:n` cites the build's
work-log. §15 lists the open items and how each was settled. Prompt wording is tuned on real runs; this
slice fixes the contracts and required behaviours, not the prose of prompts.

- **The as-built source** for every built section is the skill itself: `.claude/skills/build-guide/`
  (`SKILL.md`, `references/`, `templates/`) and its run checker `scripts/check-run.mjs`. Where this slice
  and the skill disagree on built behaviour, the skill and the checker are right and this slice is fixed.
- **Target design.** A passage that describes behaviour not built yet carries a one-line *Target (WU-nn,
  D-nnn)* marker, and keeps the as-built behaviour beside it until that unit merges, so a build agent can
  tell the two apart. Amendment 2's pipeline unit (WU-62) merged before amendment 3's (WU-57, WU-58), which
  edit amendment 2's verdict line (D-317). Since v1.5 amendment 3's units are built, and their former
  markers read "Since WU-nn"; the *target* passages are amendment 4's (WU-64, WU-69…WU-72, and slice 02's
  WU-65…WU-68; milestone M-15).

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
  - since WU-60 and WU-54 (D-277, D-300, D-336): a mod hit that lists the base types that can roll it,
    essences as a mechanic kind (C-37), and the coverage flags (C-38). The lookup
    additions (WU-53, D-299; built). There are no poe.ninja tools beyond `get_currency_rates` (C-54 withdrawn, D-335).
  - *target (WU-65, WU-68; D-353, D-356):* the record's `measures`, a key-figure line per stage in
    `compile_plan`'s text, and `guide_run`'s views, which the stage references read in place of paging
    `plan.json` and Grepping the record.

  The registration names the server `pob2` (stab D-16), so allowlists name `mcp__pob2__<tool>`.
- **Tool groups** (stab C-1): `POE_TRADE_DISABLED=true` hides group `trade` and `POE_NINJA_DISABLED=true`
  hides group `ninja`, so in M-12 the price tools don't exist for anyone. Group `ninja` holds only
  `get_currency_rates`: D-335 withdrew the poe.ninja tools (C-54).
- **Kind `read` is not "writes nothing"** (`src/server/toolMeta.ts`): `lua_save_build`, `export_build`
  and `save_config_preset` are `read` but write into the builds folder or the state dir, and
  `guide_run`'s `new_run` mode creates a folder. Allowlists are therefore enumerated sets (§4), never
  "every `read` tool".

## 2. Run folder layout and file ownership (C-34 inside a run; C-36)

After the roll check (FR-W2), the runner's first server write is `guide_run {new_run: <slug>}`; every step
and agent then uses the returned absolute path (D-207, D-216). `runFolderRel` is `<slug>/<YYYY-MM-DD>-<n>`;
a plan's `plan_path` is `<runFolderRel>/plan.json`, or `<runFolderRel>/concepts/<id>/plan.json` for a
concept skeleton.

**Slug** (D-285; since WU-57). From the brief at the start: `<ascendancy>-<skill>`, `<ascendancy>-open`,
`open-<skill>`, or with neither `open-<first playstyle tag>`, else `open` (WU-59's run A:
`open-explosive-concoction`), in lower case, each run of characters outside `[a-z0-9]` replaced by one `-`,
trimmed of `-` (Titan / Blood Hunt → `titan-blood-hunt`); the server takes at most 64 characters. The card
picked later is recorded in the run log, not in the folder name. Each run gets a new dated folder and never
writes into an earlier run's (D-153). (Before WU-57 the slug was the roll's `<ascendancy>-<skill>`.)

| Path in the run folder | Written by (only) | Content |
|---|---|---|
| `run-log.json` | the runner | §6 (D-270) |
| `research/p<k>-r1a-<n>.md` | R1a researcher `n` of research round `k` | its sections, with source markers (§7.3) |
| `concepts/<id>/plan.json` | the R1b step for concept `<id>` | an endgame skeleton plan (C-31) with its key-item prices |
| `concepts/<id>/compile-record.json`, `concepts/<id>/compiled-build.xml` | `compile_plan`, measure-only (D-208) | the skeleton's record (C-33) and compiled XML |
| `dossier.md` | the R1b-assemble step only (D-269) | §7.2. *Target (WU-70, D-355):* the verification gate's comparison table |
| `plan.json` | the D1 and D2 steps; the D1 gate step only to apply FI-2 (§11.3) and the final re-price pass (§9) | C-31 |
| `compile-record.json`, `compiled-build.xml` | `compile_plan` | the record of the last compile of `plan.json`; after the final compile it names the PoB file and holds `importCode` (D-260) |
| `guide.md` | W1; the runner replaces its `Known issues` list (step 14, D-265) | §8 |
| `reports/gates/<stage>-<concept>-a<attempt>.json` | the gate step itself: R1b, D1-gate or D2-gate (D-267) | its verdict (§5.3) |
| `reports/v4-<lens>.json`, `reports/v4-<lens>-recheck.json` | the runner, from the verifier's return, unchanged (D-267) | the V4 full pass and re-check reports (§7.4). *Target (WU-69, D-352):* `reports/V4-<n>.md`, one per pass, written by the verifier itself and never overwritten |
| `audit.md` | W1, which writes it and patches it with Edit; the runner fills its `Known issues` table (step 14) | the audit layer (§7.8; D-278, WU-62). *Target (WU-71, D-355):* rendered by `scripts/render-audit.mjs`, which the runner runs after the final compile |
| `cards/<id>.md` | R1a (the brainstorm half), then R1b (the verification half) | a candidate card (§7.5; D-291, WU-57) |
| `cards.md` | R1a-assemble | the dealt deck, plus "Not dealt" (§7.5; D-287, WU-57) |
| `probes/<card-id>/<n>/` | R1b | a probe variant's one-stage plan; `compile_plan` writes its measure-only record and XML beside it (§7.7; D-292, D-331, D-338). R1b's header `writes` name it since WU-57, and the checker accepts it since WU-58 (AC-W2 (ff)) |
| `rounds/<n>/` | the runner, before a fix round or a revision | *Target (WU-70, WU-71; D-352):* its copy of `plan.json`, `compile-record.json` and `guide.md`, which `check-run.mjs --changed <n>` compares with the current files |

- **Card ids** (since WU-57; D-286, D-319) are `r<round>-<researcher letter>-<n>`, for example `r1-a-2`,
  with the card at `cards/<id>.md`; the letters are `a`, `b` and `c`. The runner letters the researchers
  when it starts them, so parallel researchers never collide. `research/p<k>-r1a-<n>.md` stays. (Before
  WU-57, concept ids were `c1`, `c2`, … in proposal order, unique within the run across research rounds;
  schema-2 logs still use them.)
- `<stage>` in a gate file is `R1b`, `D1-gate` or `D2-gate`; `<attempt>` counts from 1 per (stage,
  concept), as the header and the run log's `stages[]` do; `<lens>` is `ledger`, `sources` or `prose`.
- A revision's verification rewrites the V4 reports; the run log's order says which re-check belongs to the
  last full pass. *Target (D-352):* every pass keeps its own report, which nothing overwrites.
- **Nothing else goes in the run folder**, and the run checker fails a stray file. No agent writes outside
  it (D-177), and agents running in parallel write different files (C-36). Since WU-58 the checker's layout
  list (`KNOWN_TOP` in `check-run.mjs`) holds `cards/`, `cards.md` and `probes/`, and fails a card file for a
  round that never ran (AC-W2 (ff), D-338).
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
  Since WU-57 (C-51, D-285): `/build-guide <free text> [--offline [--test <path>]] [--no-ninja]`. The
  runner parses the free text into a **brief** before any run folder exists, so FR-W2's checks run on it
  before any agent does, and the brainstorm gate echoes it at its top (§10). (Amendment 3 says "the
  coordinator parses"; the runner reading is PROPOSED by the coordinator, 2026-10-10, C-51.) The
  `<ascendancy> <skill>` form still works: it is the fixed roll, defined by its shape (D-343): exactly two
  names, the first always `ascendancy` and the second always `skill`, whatever the lookups find; multi-word
  names are quoted, and an unquoted brief the gem lookup finds whole is one name. The brief's fields are all
  optional:

  | Field | Example |
  |---|---|
  | `ascendancy` | Titan |
  | `skill` | Blood Hunt |
  | `playstyle` | tags from the vocabulary below, plus free text |
  | `budget` | `budget` or `non-budget` (the endgame variants), or a figure in divines |
  | `around` | an item, mechanic or support gem to build around: "Melting Maelstrom", "block", "Fork" (D-343) |
  | `like` | a reference build and what to change: "like the Eraser, but not Gemling" |
  | `notes` | anything else |
  | `popularity` (D-335) | the user's own notes on what players run: "Blood Hunt Titans are rare this league" |

  - **Playstyle vocabulary**, which cards use too: delivery `melee`, `ranged-attack`, `spell`, `minion`,
    `totem-trap`, `mixed`; buttons `one-button`, `few-buttons`, `combo`; focus `clear`, `boss`,
    `balanced`; defence `tanky`, `balanced`, `glass`; pace `fast`, `steady`.
  - A randomizer roll is the brief `{ascendancy, skill}`. An empty brief means "surprise me": the
    brainstorm seeds from the pattern library's families, and from what the coordinator judges
    under-played (`judgment`, D-298 as D-335 restates it), or the user's `popularity` notes when the brief
    has them.
  - **Player evidence** (D-335). No tool supplies it: poe.ninja's terms close its builds API. A card cites
    the brief's `popularity` notes as user-supplied, or says "no player evidence".
  - **A support gem** the free text names as the build's subject goes in `around`, by its name as the lookup
    gave it, never in `skill`: only an active gem is a `skill` (D-343).
  - `--no-ninja`: the run calls no tool in group `ninja`, whose one tool is `get_currency_rates`, so price
    totals in divines are `unverified` (pricing's path when rates are missing) (D-297, D-333, D-335).
- **FR-W2 (start).** In this order, before any agent runs:
  1. **Brief check** (the roll check; D-238, D-258, D-285; since WU-57, with D-342 and D-343). Each field
     that names an ascendancy or a skill is checked as a roll is:
     - `ascendancy`: `get_classes` must list it (case-insensitively); the runner notes its class.
     - `skill`: `lookup_game_data {mode: "gem", query: <skill>}` must give a result headed `## <skill>` that
       says `Kind: active`; a support gem, or no such result, fails.
     - a name the free text gives as the build's subject (D-343) is looked up before it is placed. A support
       gem goes in `around`, by the lookup's name, and the run goes on, the reply saying it is a support gem
       whose skills the researchers will look for; an active gem goes in `skill`; an item or mechanic goes in
       `around`, and a gem-lookup miss never stops it. Only a name the user gives as the skill, which the
       lookup misses, fails here. The fixed roll's second name is always `skill`, so
       `/build-guide Pathfinder Fork` stops with "Fork is a support gem".
     - both an ascendancy and a skill, once each passes: **the ascendancy lock** (D-342).
       `search_tree_nodes {query: "Grants Skill: <skill>"}` and `lookup_game_data {mode: "mechanic", query:
       "<skill>", kind: "unique"}`. The check fails when a node grants the skill, every such node is an
       ascendancy node, none of them the brief's ascendancy, and no unique grants it (a line `Grants Skill:
       <skill>` or `Grants Skill: Level (<range>) <skill>`).

     On a failure the runner stops, creates no run folder, writes nothing, and lists the closest valid
     names: ascendancies from `get_classes`; for the skill, the names the lookup lists under `Closest active
     gem names (…)`, in its order (when it matched only other gems, those gems' names; for a support gem,
     that it is a support); for a failed lock, the nodes that grant the skill, each with its id and
     ascendancy, so a re-run names one of those ascendancies or none. From then on the names are used exactly
     as the tools gave them. The run's `roll` is set only at the verification gate, from the card the user
     finalizes (D-286); each card's identity, and the lock for every skill it names, are checked again at
     deck assembly and first in R1b (§5.2).
  2. `guide_run {new_run: <slug>}` creates the run folder and replies with its absolute path, its
     root-relative path and `loadedBuildUnsaved` (C-50).
  3. **Run log.** A test config given with `--offline` is read first; a file that can't be read or isn't
     the documented shape (§11.2) is refused (`testConfig: "refused"`) and the run stops (`stopped`, with
     the reason in the reply). The runner writes `run-log.json` with `status: "running"`, the mode and
     `testConfig` (§6), and since WU-58 the parsed brief and no roll yet.
  4. **Unsaved build** (D-210). If the `new_run` reply has `loadedBuildUnsaved: true`, the runner asks the
     user before the first compile: proceed, which discards the loaded build's unsaved changes, or stop
     (the run ends `stopped`). In offline test mode, `answers.unsavedBuild` answers it (§11.2).

  The runner rewrites the whole log after every step, checkpoint and question, so an interrupted run still
  leaves one (D-270).

  Steps 1 to 4 always run as written, whatever tools the session has, and a stop in step 1, 3 or 4 ends the
  run there: a brief that fails step 1 gets no folder, and a test config refused in step 3 gets no
  unsaved-build question. **No Agent tool** (D-344; since WU-57's re-open): if the Agent tool isn't
  available when the first agent step is due, the run stops there with `status: "stopped"` and no
  `stages[]` entry, the reason in the reply (no run-log field holds it, as for a refused test config).
- **FR-W3 (one coordinator; C-36 as corrected by D-231; D-130, D-112).** During a run the runner calls no
  `pob2` tool except `get_classes` and `lookup_game_data` for the roll check (with `search_tree_nodes` for
  the ascendancy lock of a brief naming both an ascendancy and a skill, D-342) and `guide_run {new_run}`.
  Lookups (the tools in L, §4) may also be called by the R1a researchers, the V4 verifiers and coordinator
  steps. Every engine-changing and trade call is made by a coordinator step, and no coordinator step
  overlaps any other agent. No agent calls a poe.ninja tool beyond the coordinator's `get_currency_rates`
  (D-335; the researchers' poe.ninja tools of D-297 are withdrawn).
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
    verifier can't write: it returns its report as JSON, which the runner writes unchanged. *Target (WU-69,
    D-352):* the verifier writes its own `reports/V4-<n>.md`, its one Write, to `reports/` only.
  - **A missing return.** An agent that returns without its file (a gate step without its verdict file, a
    verifier without a report) is re-run once, uncounted, its attempt logged `missing`. A second miss ends
    the run `stopped`, naming the step.
  - **What the runner reads:** the gate verdict files, its own `run-log.json`, the test config, the
    agents' returns and the verifiers' reports, and since WU-57 the deck `cards.md`, which it shows at the
    brainstorm gate. It never reads `plan.json`, a compile record, `dossier.md` or `guide.md` (one final
    record was 268 KB), with Read or Bash. Step 14 reads only the `Known issues` lines it edits, found from
    the `known-issues-line` W1 returned last. *Target (D-352):* before a fix round or a revision the runner
    has the plan, record and guide copied to `rounds/<n>/` by a script it runs, so it reads none of them
    (A-34). *Target (D-362):* the design gate's display comes from the D1 gate's verdict file, into which
    the D1 gate step writes it (A-35).
- **FR-W5 (the runner's Bash; D-265 e).** The runner's Bash reads files and runs the run checker, nothing
  else: `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq`, alone or piped into one another (`cd` before
  them is fine), each with no redirection, no `tee`, no flag that writes a file and no command substitution
  feeding another tool; and `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`. No other
  `node` call, no `git`, `find`, `sort`, `sed`, `awk`, network client or host, and nothing that writes,
  moves or deletes a file: the runner writes every file with Write or Edit. The agents have no Bash (R-4).
  *Target (WU-71; D-352, D-355, D-356, amending D-265 (e)):* the list gains `check-run.mjs --changed <n>`,
  `scripts/render-audit.mjs`, `scripts/run-log.mjs` and A-34's round copy (`check-run.mjs --snapshot <n>`,
  or a mode of `scripts/run-log.mjs`).
- **FR-W6 (persistence; D-267).** Gate steps write their own verdict files. The runner writes each V4
  report from the verifier's return, unchanged, then the run log. *Target (D-352, D-356):* V4 writes its own
  report, and `scripts/run-log.mjs` appends the run log.
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
     record by the server's evaluator, equals the record's value to 2 decimals (`[ledger]`).
     *Target (D-352):* the projection also leaves out the plan's `ledger` (WU-65, `src/plan/buildHash.ts`),
     and `[ledger]` (WU-71) evaluates the plan's current ledger formulas over the record and takes that
     value, not the record's stored one, as each entry's value wherever the checker reads it, so a
     ledger-only edit after the final compile passes both `[record-plan]` and `[ledger]`; an entry that
     doesn't evaluate still fails.
  3. **The D1 gate, recomputed** from the record and the plan (§5.3): the floor (with D-254's and D-256's
     reference hits and D-234's chaos exception), the budget (D-219, D-249) and the rolled skill, its
     figure's stat set equal to `skills.main.statSet` (D-273). It fails a verdict that differs from its own
     and, once a guide exists, any gate failure no accepted finding covers (D-312). *Target (WU-71,
     D-353):* the floor reads the reference hits the compiler wrote, from the record, in place of the
     `hit_<stage>_<type>` ledger entries (§5.3).
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

  Since WU-62 (D-283, D-281), also amendment 2's deterministic guards (§8): the 3,000-word cap; the reader
  layer's headings, `audit.md`'s included; no markers in `guide.md` outside the import code's fence; one
  fixed-form verdict line per endgame rung, compared with the record; reward picks by name; Known issues by
  sentence, with each id in `audit.md`; the entering-maps rung's floor at area 69 and its budget of 5
  divines (5.5 with "near the ceiling"), the first rung taken by rung order.
  Since WU-58 (merge `3ffd7d0`; D-287, D-289, D-294, D-326, D-338, D-339, D-341): run log v3 (§6);
  brainstorm and verification rounds and their caps, a short round only with its `shortReason`; the renamed
  answers; the verdict line's "Effective HP about <n>." against `TotalEHP`; the D1 gate recompute reads
  figure × count (D-340); the layout's `cards/`, `cards.md` and `probes/`, with each card's `probes` count;
  an R1b `not-a-skill` or `wrong-ascendancy` failure as terminal, its card never finalized (D-334, D-342).
  Its review added: the final gate's answer tied to the end status (accept → `completed`, a default `stop`
  → `stopped`, any other answer → `not-accepted`); each escalation answer matched to its escalation's
  `choice`, one for one; card files for rounds that never ran fail; and a schema-2 log carrying a
  schema-3-only field fails. The checker reads schema-2 logs under the schema-2 log rules only, and holds
  every artifact to the current formats, so WU-47's recorded runs no longer pass (D-341).
  *Target (WU-71; D-351…D-353, D-355, D-362):* `--changed <n>`, which lists the claims whose text, source
  or cited record values changed since `rounds/<n>/` and the changed guide H2s; a re-check missing one of
  them, or an overwritten V4 report, fails; a claim without a `kind`; an `audit.md` or Checks block that
  differs from the script's render (Known issues aside); a survival label that disagrees with
  `measures.arbiter`; D2 reached without a `design` visit; `[ledger]` over the plan's current formulas
  ((2)); the floor's codes and the verdict line's hits read from the record's compiler-written hits ((3),
  §5.3, §8); and `[record-plan]`, through WU-65's projection, passing a ledger-only edit after the final
  compile while a gear edit still fails it.

## 4. Agent definitions and tool allowlists (D-130, D-142, D-178, A-24, D-267)

Four definitions in `.claude/agents/build-guide/` (D-267). Each holds its role: the allowlist and the
standing rules (write only inside the run folder; never read `.env`; web only on D-171's hosts, never
pathofexile.com or poe.ninja; offline-mode rules, §11.1). Stage instructions live in the stage references.
Since WU-57 (D-335), the poe.ninja rule reads "never contact pathofexile.com or poe.ninja yourself;
there are no poe.ninja tools beyond the currency rates", in `SKILL.md` and in the researcher's and the
coordinator's definitions. *Target (WU-70, D-356):* every definition says to batch independent read-only
calls in one turn.

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
- **N, poe.ninja:** *withdrawn → D-335.* The popularity and build-index tools of C-54 aren't built: there is
  no set N, and group `ninja`'s one tool, `get_currency_rates`, stays in P.

**Who calls what** (C-36 as corrected by D-231; D-130). Lookups (L) may be called by the R1a researchers,
the V4 verifiers and the coordinator. Engine-mutating calls and all trade calls are made only by the
coordinator, and so is every poe.ninja call (`get_currency_rates`, D-335).

| Type | Runs | File tools | `pob2` tools | Web |
|---|---|---|---|---|
| `build-guide-researcher` | R1a | Read, Glob, Grep, Write | ⊆ L | WebSearch, WebFetch |
| `build-guide-coordinator` | R1a-assemble (since WU-57, D-287), R1b, R1b-assemble, D1, D1-gate, D2, D2-gate (with the final compile); *target (WU-70, D-356):* `D1-build` and `D1-finish` in place of D1 | Read, Glob, Grep, Write, Edit | ⊆ L ∪ B ∪ C ∪ P | WebSearch, WebFetch |
| `build-guide-writer` | W1 | Read, Glob, Grep, Write, Edit (D-257) | none | none |
| `build-guide-verifier` | V4 lenses; *target (D-352):* one V4 pass, no lenses | Read, Glob, Grep; *target (WU-69, D-352):* Write, to `reports/` only | ⊆ L | WebFetch |

The coordinator runs no dossier fix and maps no revision requests (D-267, D-269), and the provenance type is
gone, with V3 (D-267, D-268).

**ToolSearch.** AC-W23 recorded "reached directly": an allowlisted agent reaches a deferred MCP tool without
ToolSearch, so ToolSearch joins no row.

**Rules** (checked by AC-W5):
- **R-1.** Frontmatter `name` equals the file stem; `tools:` is one comma-separated line (no YAML parser
  is allowed, HG-10).
- **R-2.** Each type's tools are a subset of its row above.
- **R-3.** Only `build-guide-coordinator` names a tool in C or P: only the coordinator compiles and prices
  (D-130, D-178), and only it calls poe.ninja (`get_currency_rates`, D-335).
- **R-4.** No definition names Bash, Agent, Skill, Workflow or NotebookEdit, or any `pob2` tool outside
  L ∪ B ∪ C ∪ P. So no `mutate`, `lifecycle` or other `load`
  tool and no file-writing tool: the plan is the source of truth and the compiler builds from it (D-113,
  D-155); the compiled build stays loaded for B's reads (D-191).
- **R-5.** The verifier can't write: it returns its report as JSON, which the runner writes unchanged
  (§7.4), and it can't edit what it checks. *Target (WU-69, D-352):* it writes its own report with Write,
  to `reports/` only, and still can't edit what it checks: it has no Edit, its instructions forbid writing
  anywhere else, and the checker compares the plan, record and guide with the round's snapshot in
  `rounds/<n>/`. V4 is a separate type from the coordinator and the writer,
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
| `stage` | `R1a`, `R1a-assemble` (since WU-57, D-287), `R1b`, `R1b-assemble`, `D1`, `D1-gate`, `D2`, `D2-gate`, `W1` or `V4`. *Target (WU-70, D-356):* `D1-build` and `D1-finish` in place of `D1` |
| `attempt` | this step's attempt for its (stage, concept), from 1: every call counts, retries and re-runs included |
| `concept` | the card id (`r<round>-<letter>-<n>`, since WU-57, D-286), where the step concerns one; before WU-57 the concept id (`c<n>`) |
| `lens` | V4 only: `ledger`, `sources` or `prose`. *Target (WU-69, D-352):* none: one pass, no lenses |
| `check` | V4 only: `full` (step 11, every claim in the lens) or `recheck` (step 13, only `findings` and `changed`). *Target (D-352):* `recheck` covers only the set `check-run.mjs --changed <n>` lists |
| `mode` | `offline` or `online`, as the run log records it |
| `runFolder`, `runFolderRel` | the run folder's absolute path, and its path relative to the guides root (§2) |
| `compile` | `none`, `measure-only` or `final`: what this step may ask `compile_plan` for |
| `buildName` | the D2 gate only: `<slug>-<YYYY-MM-DD>-<n>`, for its final compile |
| `findings` | what to fix or check: the earlier attempt's gate verdict (its file and findings), the V4 findings routed to this owner, the user's revision requests (`code: "user-request"`) or guidance (`code: "user-guidance"`); for a V4 re-check, the lens's own open findings; `[]` otherwise |
| `changed` | a V4 re-check, and W1 in the fix round: the locations the fix round's owners changed, or `"all"` when a gate re-ran in the fix round (D-264) |
| `accepted` | gate findings the user accepted at an escalation, from its verdict file (§5.4) |
| `faults` | offline test mode only: this step's fault directives (§11.3) |
| `writes` | the run-folder paths this step may write; nothing else. W1's include `audit.md` (D-278, WU-62). Since WU-57 (D-338), R1b's include its probes, `probes/<card-id>/<n>/`, and its card, `cards/<id>.md`; R1a's its research file and `cards/r<k>-<letter>-1.md` to `-3.md`; R1a-assemble's `["cards.md"]` |
| `reference` | the step's stage reference, under `references/stages/` |

Rules: a step writes only the paths in `writes`, all inside the run folder (D-177), and steps running in
parallel never share a path; a gate step's `writes` include its verdict file. A V4 prompt is the header and
the reference line, and `changed` holds locations, never text (R-5, D-142). `compile: "none"` means no
`compile_plan` call; only the D2 gate carries `final`, with `buildName`, and it compiles measure-only first.
Faults travel only in headers, only in offline test mode, and only to the steps they target. The header has
no `pass` field (D-267).

### 5.2 The steps (D-267, D-268, D-272)

`SKILL.md`'s step list, as built (since WU-57, merge `66362d0`; before it, steps 2 to 5 were R1a's concept
proposals, R1b per concept, R1b-assemble's checkpoint-1 comparison and checkpoint 1, and step 16 was
checkpoint 2):

| # | Step | Agent type | Writes | Returns, user, retries |
|---|---|---|---|---|
| 1 | Start (FR-W2) | the runner | `run-log.json` | parses and checks the brief; asks the user when `loadedBuildUnsaved` (D-210) |
| 2a | R1a, brainstorm round *k* | `build-guide-researcher`, ≤ 3 in parallel, lettered `a`, `b`, `c` | `research/p<k>-r1a-<n>.md`; 3 cards `cards/r<k>-<letter>-<m>.md`, their brainstorm halves | its files and its cards' titles |
| 2b | R1a-assemble | `build-guide-coordinator` | `cards.md` | the deck's counts: dealt, not dealt, under-played; `short: <why>` for a short round (D-339) |
| 2c | The brainstorm gate (§10) | the runner | log | asks the user: verify 1–3 cards (step 3), brainstorm more (step 2a, round *k*+1) or stop |
| 3 | R1b, one picked card at a time, ≤ 3 per verification round | `build-guide-coordinator` | `concepts/<id>/plan.json`, `reports/gates/R1b-<id>-a<n>.json`, `cards/<id>.md` (its verification half), `probes/<id>/<p>/` | compiled or not; a compile failure re-runs, ≤ 2 counted retries, then the card is `failed`; `not-a-skill` and `wrong-ascendancy` are never retried |
| 4 | R1b-assemble | `build-guide-coordinator` | `dossier.md` | the verification gate's comparison, one line per card |
| 5 | The verification gate (§10) | the runner | log | asks the user: finalize one card, verify other cards (step 3), brainstorm more (step 2a) or stop |
| 6 | D1, the endgame | `build-guide-coordinator` | `plan.json` (its endgame stages, `skills.main.statSet` set) | `done` or `infeasible` |
| 7 | D1-gate | `build-guide-coordinator`, fresh | `reports/gates/D1-gate-<c>-a<n>.json`; `plan.json` (FI-2 and the final re-price pass) | one verdict line; routed by §5.3 |
| 8 | D2, the campaign | `build-guide-coordinator` | `plan.json` (its campaign stages) | `done` |
| 9 | D2-gate and the final compile | `build-guide-coordinator`, fresh | `reports/gates/D2-gate-<c>-a<n>.json`; the PoB file through the server | one verdict line; a failure re-runs D2, ≤ 2 counted retries, then escalates |
| 10 | W1, the guide and the audit layer | `build-guide-writer` | `guide.md`, `audit.md` (D-278) | at most 8 lines, with its `known-issues-line` and `audit-known-issues-line` |
| 11 | V4, one full pass | `build-guide-verifier` ×3 in parallel (`ledger`, `sources`, `prose`) | none; the runner writes `reports/v4-<lens>.json` | its report |
| 12 | Fix round, once, only with open findings, uncounted | the owners: D1, D2, W1 | their own files: claims edited in place; a compile only for a build change | the ids fixed, the locations changed, and whether it recompiled |
| 13 | V4 re-check | `build-guide-verifier`, in parallel: each lens that raised a finding and the sources lens, or all three when a gate re-ran in the fix round (§5.5) | none; the runner writes `reports/v4-<lens>-recheck.json` | its report; no further round |
| 14 | Known issues | the runner | the `Known issues` list in `guide.md` (reader sentences) and the `Known issues` table in `audit.md` (ids) | — |
| 15 | Run checker | the runner (Bash) | — | its result, shown at step 16 |
| 16 | The final gate (checkpoint 2, §10) | the runner | log | asks the user: accept, ask for changes (a revision, §5.6), or anything else |

**Retries, in full** (D-272). The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each.
These attempts count against no cap: an attempt failed by a fault directive that applies to attempt 1 only
(a persistent directive's failed attempts do count), a guided retry, the fix round, a revision, and the
re-run after a missing return. Verification never runs a lens again for its findings beyond the one
re-check, and never escalates; only the D1 and D2 gates escalate (D-268).

**Research before WU-57** (M-12's steps 2 to 4; D-311, D-235), kept as the record of WU-47's runs:
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
  carries the earlier D1 gate findings on a retry. It writes the endgame stages of the three rungs, `m`, `b`
  and `n` (D-281; WU-62 added `m`, designed after `b` and `n`), each with
  its `level`, per-gem levels and `ascendancyPoints` with a source or rationale (D-193), a `role` on every
  skill group and `skills.rolledGroup` (D-217), `skills.main` on the rolled group with `skills.main.statSet`
  (D-273); it prices every slot and tree jewel of every rung (§9) and compiles measure-only as often as it
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

Since WU-57 (merge `66362d0`; D-287…D-292, D-298, D-335, D-338, D-339, D-342): **three phases, each ending
at a gate the user answers.** A fixed roll runs the same three phases, and every card's skill is the rolled
skill.
- **Brainstorm.** R1a: three researchers, each reading the pattern library (§7.6) first and writing 3
  cards' brainstorm halves (§7.5), at least one on a library shape it judges under-played, labelled
  `judgment` (D-339). Each applies the ascendancy lock (D-342) to every skill a card names. The foci stay
  mechanics, items and tree, each starting from the brief's fixed pieces:

  | Brief | Mechanics | Items | Tree |
  |---|---|---|---|
  | names a skill | from the skill, as today | from `around`, or from uniques that change how a skill plays | from the ascendancy's nodes |
  | names no skill | from the library's families and the playstyle tags | (same) | (same) |
  | names no ascendancy | (as above) | (same) | from ascendancies that suit the playstyle, and ones the coordinator judges under-played (`judgment`), or the user's `popularity` notes (D-298, D-335) |

  Then **R1a-assemble**, a coordinator step, deals the deck: it reads the card files, merges duplicates,
  checks each card's identity `{className, ascendancy, skill}` as the roll check does (`get_classes`, then
  `lookup_game_data` with `Kind: active`, or for a non-skill damage source a lookup by its kind; D-286, D-334), and applies the sniff test: a card is dealt only when a
  lookup confirms every load-bearing link in game text, and otherwise goes under "Not dealt", naming the
  unconfirmed link (the user can still ask for it at the gate). A card that breaks the ascendancy lock goes
  under "Not dealt" with `wrong-ascendancy: <skill> is granted by <each node, with its id and ascendancy>`
  (D-342). It writes `cards.md`, one line per dealt card.
  A round deals 6–9 cards, and each deck holds at least two that the coordinator judges under-played, from
  the pattern library, labelled `judgment`; there is no popularity threshold (D-298, as D-335 restates it).
  A round that deals fewer than 6, or leaves the deck with fewer than two under-played cards, is short: it
  returns `short: <why>`, the runner records the reason as `shortReason` and says so at the gate (D-339).
  A later round reads `cards.md` and adds only new cards. Then the brainstorm gate (§10).
- **Verification.** R1b for each picked card, one at a time, at most 3 per verification round: the card's
  identity is the skeleton's `roll`. Its first check, before FI-1 and any compile, is the ascendancy lock: a
  card that breaks it compiles nothing and fails `wrong-ascendancy`, terminal and never finalized (D-342); a
  card whose damage source isn't a skill compiles nothing either, `not-a-skill`, and can't be finalized yet
  (D-303, D-334). Otherwise it runs the advisory checklist and up to 4 probe variants (§7.7) and writes the
  card's verification half. Its header's `writes` name `probes/<card-id>/<n>/` and `cards/<id>.md` (D-338). Then R1b-assemble (`dossier.md` and the comparison; its key numbers
  add `TotalEHP`, D-294), then the verification gate (§10), where the picked card's identity becomes the
  run's `roll`.
- **Finalization.** D1 through the final gate, as above, plus D1's Count and custom-modifier work (D-293):
  D1 sets each group's `count` with its `countReason` and writes each `customMods` entry with its reason,
  and after setting Count on a group that reserves per copy (or a totem with Ancestral Bond, or an Umbral
  Well buff) it checks reservation and buffs (R-33). D2 plans bridge skills when the named damage source
  arrives late, and banks the enabler in hold and save rows (D-301; *target*, D-354: banking the enabler
  goes).

*Target (M-15; WU-70, with WU-65 and WU-71; D-351, D-353…D-356, D-358, D-359, D-362):* **the lean
finalization.**
- **D1 splits** (D-356). `D1-build` takes the three rungs to a passing floor; `D1-finish`, a fresh
  coordinator step, reads the plan and the record through `guide_run`'s views and adds the anoint (D-358:
  one valuable notable that is off the tree or costly to path, measured with a measure-only compile, its
  reason recorded; `b` and `n` only), the prices, the ledger and the claims (D-351: hinge facts and measured
  reasons only). D1 writes no `hit_*` entries: the compiler fills the reference hits (D-353). `D1-build`
  states D-360's tree rule (today's `D1.md:112`).
- **The design gate** (D-362) follows a passing D1 gate and comes before D2 (§10).
- **D2** (D-354) plans per act the tree path order, the support gem order, a rough upgrade order, the
  build-specific mods to target and a target life from the record's `Life`; the campaign loadouts stay in
  the PoB file. It stops picking gear for "a resistance it lacks" (`D2.md`:70-77), crafts nothing, and
  banks no enabler; its claims are hinge claims only. It keeps a tree-granted group within D-359's estimated support count. D2 splits only if the lean run
  shows it past the peak-context target (D-357).
- **W1** writes `guide.md`; the runner renders `audit.md` with `scripts/render-audit.mjs` after the final
  compile, and W1 copies each rung's rendered Checks block verbatim (D-355).
- **Every step** reads per-step excerpts of the rules it needs, not whole files or bare D-numbers, and
  batches independent read-only calls (D-356).

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

V1's tree continuity follows one ladder track (WU-61, D-282): the entering-maps rung `m` from the last
campaign stage, `b` from `m`, `n` from `b`, by rung whatever the plan order, with each rung's
`respec.dropped` checked (its gold cost only by its schema, A-32).

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
  - The entering-maps rung `m` is gated the same way at area level 69 (`area-level.offset` 64, plus 5, T5),
    with waystone-scaled hits in `hit_m_<type>` (D-254; WU-62). Its hits are tied to that area level as
    D-256 ties each stage's hits; only that tie is the coordinator's inference (D-327).
  - *Target (WU-65, WU-71; D-353):* the compiler fills the five hits from the data, by the same formula
    and rounding, when the plan omits them, so the `hit_<stage>_<type>` ledger entries go. The floor then
    reads each hit from the record, as the compiler wrote it (the stage's `enemy<Type>Damage` in
    `configWritten`), not from a ledger entry: `max-hit-<type>` and `reference-hit-missing-<type>` read that
    value, and `reference-hit-ledger-<type>` (its name kept) fails a recorded hit that isn't D-254's formula
    at the variant's area level, rounded by D-256. The floor's other codes are unchanged.
- **budget** (D-116, D-147, D-164, D-219, D-249). For the budget variant, every filled slot **and every
  tree jewel** has a `prices[]` entry, converted to divines with `get_currency_rates`' rates. Each filled
  slot or jewel has its own entry, except slots holding identical item text. Totals are compared rounded to
  2 decimals: at most 20 divines passes; above 20 and at most 22 passes with a `near-ceiling` finding, and
  the guide's budget `Checks` say "near the ceiling" in those words; above 22 fails (`over-budget`); any
  price `unavailable`, or a currency without a rate, is `unverified`, which doesn't fail the gate, and the
  guide can't claim the variant is under budget. The non-budget total is reported against the ~200-divine
  reference (D-117), never gated.
  `m`'s budget is 5 divines (D-281, WU-62): at most 5 passes, at most 5.5 passes with "near the ceiling";
  offline it is `unverified`.
- **rolledSkill** (D-122, D-148, D-217, D-273). In each endgame stage the rolled skill's group
  (`skills.rolledGroup`) has role `clear` or `single_target`, never `utility` or `leveling`, and its figure
  is the largest among the stage's groups with that role. A figure is a record `skillOutputs` field
  (`g<group>s<skill>p<statSet>.<Field>`), the same field for every group compared, or a ledger entry's value
  (`ledger:<id>`). The rolled skill is the main skill: on every stage with a `rolledGroup`,
  `skills.main.group` is that group; D1 sets `skills.main.statSet`; and the rolled figure, directly or in
  every breakdown field its ledger formula reads, is `<stage>.g<main.group>s<main.activeSkill>p<main.statSet>`.
  As built, the PoB file opens on `skills.main`, so the guide's headline figure is the one the user sees.
  Since WU-57 (D-295, D-294, D-321, D-340): the group holds the build's **named damage source**, whose own
  hits, ailments and projectiles count when another skill fires, spreads or copies them; `rolledGroup` keeps
  its name. The compared figure is the named source's figure × its Count, from the record's Count-scaled
  field beside the raw figure (`countedSkillOutputs[g<g>s<s>p<p>].fields`, WU-55; C-33); a field with no
  counted copy comes from the raw per-copy `skillOutputs`, labelled "per copy" when Count is above 1
  (D-340). The headline is that Count-scaled figure, with `TotalEHP` beside it (D-294); the user sees the
  same number as PoB's Full DPS, which every compile sets up on the named source's groups only (D-293,
  D-337).

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
| floor | `reference-hit-ledger-<type>` | the hit isn't the ceiling of its ledger entry, the record has no value for it, or it isn't derived from the damage at the variant's area level and the tops of the waystone damage modifiers. *Target (D-353):* the record's compiler-written hit, with no ledger entry (above) |
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

An `infeasible` outcome goes back to the verification gate (since WU-57, D-287; before it, checkpoint 1)
with that card's last verdict file as evidence. *Target (WU-70, D-362):* a pass ("D2" in the table) goes to
the design gate first, and D2 runs only after its `accept`.

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
   stage, part and code) fails no later gate. W1 lists each under the guide's `Known issues` as a plain
   sentence the reader can act on, and nothing more; its gate (`D1-gate` or `D2-gate`), code and plan stage
   go to `audit.md`'s `Known issues` table (D-265, D-276, D-283; WU-62).
   After the D1 gate the run goes on as if it passed; after the D2 gate, the D2 gate runs once more,
   uncounted, with them in `accepted`, so it runs the final compile.
2. **guidance and one more retry**: the producer (D1 or D2) gets one more attempt, uncounted, with the
   verdict and the user's guidance (`code: "user-guidance"`) in `findings`, then its gate. If the gate fails,
   whatever part fails, it escalates again.
3. **back to the verification gate** (since WU-57, D-287; the choice `verification`, before it
   `checkpoint-1`), the verdict file as that card's evidence.
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
- **Step 14, known issues** (D-265 d, D-276, D-278; WU-62). A finding is open when it is `unresolved` in
  its lens's re-check, or `unresolved` in the full pass and not reported `fixed` by a re-check. The runner
  reads only the lines it edits, from the `known-issues-line` and `audit-known-issues-line` W1 returned last
  down to the next heading, and **replaces both lists whole** with Edit, every cycle:
  - in `guide.md`, under `### Known issues` (the last part of `What PoB can't show`): first W1's lines for
    the accepted gate findings, as W1 wrote them; then one line per open finding, `- <reader>`, the
    finding's `reader` sentence exactly as its report gives it, with no id; or, with neither, the one line
    `None.`;
  - in `audit.md`, under `## Known issues`: the table head, W1's rows for the accepted gate findings, then
    one row per open finding, `| <id> | <lens> | — | <reader> |`; or, with neither, the one line `None.`.

  Every other line and row is dropped: one from an earlier cycle is stale.

*Target (WU-69…WU-71; D-352):* **one pass, narrow re-checks, kept reports, triage.**
- **Step 11** is one V4 pass, one verifier with no lens: it checks every hinge claim against its source and
  reads `guide.md` as an editor against the plan and the record, and writes `reports/V4-<n>.md` itself,
  never overwriting one. The ledger's arithmetic is the checker's (D-271); V4 checks only that a hinge
  claim's entry models what the claim says.
- **Triage first.** The pass marks each finding `hinge` or not. A finding on a non-hinge statement is fixed
  by removing or narrowing the statement, never by new research or a recompile; a difference under 5% in an
  estimate is no finding.
- **Step 12.** Before the fix round the runner copies the plan, record and guide to `rounds/<n>/`, by A-34's
  script. A change
  to a ledger entry's formula or inputs, like a claim edit, needs no recompile and no gate: the checker
  re-evaluates the ledger and leaves it out of the build's sha1 (`[record-plan]`). Only a change to the gear,
  tree, gems or config recompiles and re-runs the gates (amending `D1.md`:233-236, `D2.md`'s matching rule
  and D-264's "or a ledger formula").
- **Step 13** re-checks only what `check-run.mjs --changed <n>` lists: the claims whose text, source or cited
  record values changed, and the changed guide H2s. It replaces both the every-claim re-check after a
  recompile (D-264) and a revision's full pass.

### 5.6 Revisions (D-236, D-268)

At checkpoint 2, asking for changes is a revision. The runner maps each request to D1, D2 or W1 by step 12's
owners (the guide's text is W1's; an endgame stage, its ledger entries and prices D1's; a campaign stage
D2's), runs that chain as step 12 does (claims in place, the gates only after a recompile), with the
requests as `findings` (`code: "user-request"`), then steps 11 to 16 again: a full pass, the fix round, the
re-check and the known issues (D-268). A revision counts against no cap; a gate failure in it keeps the
gate's 2 counted retries. There is no `revise-map` step and no Agent-tool fallback (D-267).
*Target (D-352, D-357, D-362):* a revision runs no full pass: after the copy to `rounds/<n>/`, V4 re-checks
only `--changed`'s set. A revision's output is reported beside the run's budget, not counted in it (Q3). The
final gate's `revise:` stays for guide-level changes; a build change is the design gate's `revise:` (§10).

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

Since WU-58 (merge `3ffd7d0`; D-289, D-286, D-287, D-323, D-326, D-338, D-339, D-341): **schema version
3** (`references/run-log.md`). The table above is schema 2's, which the checker still reads.
- `schemaVersion: 3`, and a `brief` field holding the parsed brief (C-51): `playstyle` a list of strings;
  `around` holding a support gem by the lookup's name (D-343); `{}` for an empty brief.
- `roll` is `{className, ascendancy, skill}`, like the plan's, and `null` until the verification gate's
  pick.
- `stages[]` adds `R1a-assemble`, and `concept` holds card ids.
- `checkpoint` is `brainstorm`, `verification`, `final`, `unsaved-build` or `escalation`; the escalation
  choice `verification` replaces `checkpoint-1`.
- Brainstorm and verification rounds are read from the gate answers; "verify other cards from the deck"
  opens a verification round without a brainstorm.
- NFR-23 per brainstorm round: at most 3 R1a entries and one R1a-assemble, dealing 6–9 cards; per
  verification round: at most 3 cards compiled.
- `stages[]` entries gain `probes` and `shortReason`. `probes`, on every R1b entry: the probe variants that
  attempt ran, a probe whose compile failed included, `0` when none; a card's entries add up to its folders
  under `probes/<card-id>/` and to at most 4, D-292's cap (D-338). `shortReason`, on an R1a-assemble entry
  only: the reason its return gave for a short round, `short: <why>` without the prefix (D-339).
- An R1b `fail` whose finding is `not-a-skill` or `wrong-ascendancy` with `compiles: 0` is final: the card
  never re-runs, and the verification gate never finalizes it (D-334, D-342).
- The checker reads schema 2 under the schema-2 log rules only, and a schema-2 log carrying a schema-3-only
  field fails. The artifacts are held to the current formats, so WU-47's recorded runs no longer pass
  (D-341); `run-ok-v2` is the regression fixture for the schema-2 log rules, its verdict lines without
  Effective HP.

*Target (WU-70, WU-71; D-356, D-362):* checkpoint `design` joins the gates, answered `accept`,
`revise:<text>`, `verification` or `stop`; `scripts/run-log.mjs` appends the log. *Target (WU-64, WU-72;
D-349, D-357):* the budgets are read from WU-64's counter and the transcripts, not from the log: output
before the final gate's revision at most 1M (the revision's reported beside it), each agent's peak context
against a design target of 150K, and the cache read per step, reported.

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
- (WU-55, D-293; built) A skill group's `count` (default 1) with a `countReason` when above 1, and
  `config.customMods: [{text, reason}]`, a hand-calculated effect beside the `earned` and `scenario`
  entries.
- `variant: "entering-maps"` for the rung `m`, with loadout `Entering maps (L<level>) {m}` (D-281; WU-61,
  WU-62), in a plan of `schemaVersion` 2 (D-332).
- *Target (WU-65; D-351, D-353, D-358):* `schemaVersion` 3, each claim's `kind` (`hinge` or `reason`),
  `items.anoint {notable, reason}` on `b` and `n` only, and no `hit_*`, kill-time or hits-to-kill ledger
  entries (slice 02 §3.2).

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
Since WU-57 (D-287, D-294), R1b-assemble runs per verification round over the picked cards, whose
verification halves R1b writes; its key numbers add `TotalEHP`. Amendment 3 named no change to the
dossier's H2s. *Target (WU-70, D-355):* the dossier shrinks to the verification gate's comparison table
(run A's ran to 7,681 words), and D1, D2 and W1 read their card and its row instead.

### 7.3 Source markers in markdown (C-30 in `dossier.md` and the research files; none in `guide.md` since WU-62)

A claim carries one or more footnote markers `[^<id>]`. Each id has exactly one definition line:
`[^<id>]: <kind> | <ref> [| accessed: YYYY-MM-DD] [| patch: <p>] [| confidence: H|M|L]`, where `kind` is
one of C-30's five kinds (`pob-computed`, `pob-data`, `external`, `judgment`, `external-unavailable`) with
C-30's required fields; or `ledger | <ledgerId>`; or `data | <file>#<key>`, a C1/E1 fact with `<file>`
relative to `data/` (D-232); or `price | <priceId>`, a plan price entry named by its `prices[].id` (D-237).
In the plan, the same citations are `ledger:<id>`, `data:<file>#<key>` and `price:<id>` (C-30).
Definitions sit under the file's last heading, and resolve against any plan of the run. Research markers
are `p<k>r<n>-<m>`, so the dossier can copy them unchanged. (Before WU-62 the guide carried markers too,
defined under its `Sources` H2 and resolved against `plan.json`.)

**The claim rules** (D-273). Every step that writes a claim keeps them, and the V4 lenses check every claim
against them:
1. **Supported in every part.** The source supports all of the claim: each number, each mechanic and each
   qualifier ("always", "on hit", "against bosses"). A part its source doesn't support gets its own source,
   or goes.
2. **It cites each fact it rests on**, with a marker or a ledger entry for each.
3. **It carries its source's caveats** (confidence M or L, a disputed fact, a `judgment`, a mechanic no
   lookup confirmed), and in the guide each caveat appears once, where the reader acts on it, and is never
   later stated as settled (D-279; WU-62).

Since WU-62 (D-276), `guide.md` carries no markers: markers stay in the dossier and the research files,
and the plan's claims carry the guide's sources. In the dossier and the research files, a number or a
mechanic stated without a marker is a claim without a source; in the plan, a claim without a `source` is
the V4 sources lens's finding.

*Target (WU-65, WU-70, WU-71; D-351, amending D-276 and D-279):* **claims only where the build hinges.**
- A claim is written only for a **hinge** fact, one whose being wrong would make the build fail at its rung
  (run A's `m-trap-weapon`: a main-hand weapon switches the skill off), or for a **reason** resting on a
  measurement (`s6-ignite`: Ignite III over Elemental Armament II). Its `kind` says which.
- What the compile proves carries no claim: requirements, gem availability, trial timing, resistance
  penalties and tree lists are build content that V1 checks, and the guide renders them from the plan, the
  record or a data fact.
- Superfluous content is removed, not verified: kill times, campaign resistance maths, burn-gap and
  flask-second calculations, minor picks. `What PoB can't show` keeps only hinge caveats, each said once.
- The three rules above still hold for each claim written. Run A's 133 claims were 29 hinge, 42
  compile-proven, 27 reasons and 35 superfluous, and no compile-proven claim or reason was wrong (cost study 2
  §1), so the rule keeps at most 56.

### 7.4 Verifier reports (V4; D-268)

The verifier returns its report as JSON, and the runner writes it unchanged to `reports/v4-<lens>.json`
(the full pass) or `reports/v4-<lens>-recheck.json` (the re-check):

`{stage: "V4", lens, check, concept, mode, findings: [{id, artifact, location, claim, issue, evidence,
reader?, owner, status}], verdict}`.

- `lens` is `ledger`, `sources` or `prose`; `check` is `full` or `recheck`, as the header says; `mode` is the
  run log's.
- Each finding's `artifact` is `plan.json`, `guide.md`, or `audit.md` for the prose lens's check of its
  `Run notes`: the dossier isn't verified (D-269). `location` never quotes the artifact
  (`stages[<i>].claims[<k>]`, `ledger[<i>] (<id>)`, or `<H2 title>, line <n>`). `owner` is `D1`, `D2` or
  `W1` (§5.5; `W1` for `guide.md` and `audit.md`).
- `status` is `unresolved`, `accepted-offline` (only the sources lens, only for an `external-unavailable`
  claim in an offline run, C-30) or, in a re-check, `fixed`.
- `reader` (D-265) is on every `unresolved` finding: one plain sentence the guide's reader can act on, with
  no pipeline words and no JSON path. It is what the guide's `Known issues` prints.
- `verdict` is `pass` exactly when no finding is `unresolved`. There are no coverage counts and no V3
  report (D-268).

**The lenses** (as built by WU-62, D-279; `references/stages/V4.md`), one fresh verifier each, with no
sampling: in a full pass the `ledger` and `sources` lenses cover every claim, ledger entry and price of
`plan.json` (the guide carries no markers, so its facts are the plan's), and the `prose` lens every section
of `guide.md` and `audit.md`'s `Run notes`. A plan claim exists only where the guide states a fact or a gate
needs one. Each lens also checks the claim rules (§7.3) and what PoB applies (a partly parsed line applies
none of itself; `possibly unread` is advisory until a measurement confirms it, D-243).
- **`ledger`:** re-derives every ledger entry from the final record (C-33) and the entry's tagged inputs,
  comparing it with the record's value to 2 decimals; and re-derives every endgame stage's five reference
  hits from the facts themselves (D-254, D-256), `m`'s at area level 69 included, the entry
  `hit_<stage id>_<type>` and its scenario ceiling included. The guide's numbers aren't this lens's: the
  `prose` lens reads them, and the checker compares each verdict line with the record.
- **`sources`:** online, opens every `external` source on D-171's hosts (offline, an `external` claim is a
  finding); checks every `data` claim against its fact and the fact's stored citation, without fetching
  that URL offline (D-232); re-checks every `pob-data` claim with the lookups; checks each `price` claim
  against its `prices[]` entry (D-237; V4 has no trade tool); checks each `pob-computed` claim against the
  final record; reports each `external-unavailable` claim (`accepted-offline` offline, `unresolved` online);
  and reports every plan claim without a `source`. It has no guide side.
- **`prose`:** reads `guide.md` like an editor, section by section, against the plan, the record and
  `audit.md` and against §8's sections, and flags: a fact or number they don't hold, that contradicts them,
  or that states them more strongly; first-person advice that asserts a fact the plan lacks; tutorial text
  (D-280); a caveat repeated or later stated as settled (D-279). It keeps the gated statements' checks: the rolled skill as
  the main damage source in `At a glance` and `How to play it`, with why when it isn't the clear skill
  (D-122, D-148); the budget lines against 5 and 20 divines (D-164, D-219, D-281); the chaos line (D-234);
  the offline line (D-201); and "why this concept" in `audit.md`'s `Run notes` against `run-log.json`'s
  checkpoint-1 entry that picked it, its `answeredBy` and its `rule`. It never flags a missing optional item
  (D-277).

Since WU-57 (D-296), a DPS figure that rests on Count or a hand calculation, and any figure the record
marks as computed with a custom modifier, is an estimate, not checked for exactness; every interaction the
guide states must exist in game text.

*Target (WU-69, D-352):* one pass and one report. The verifier writes `reports/V4-<n>.md` itself, one per
pass, never overwritten (run A's second round overwrote its first). There are no lenses: the pass checks
every hinge claim against its source, and the guide as an editor, and marks each finding `hinge` or not
(§5.5). A re-check covers only `check-run.mjs --changed <n>`'s set. The report's exact form is WU-69's, held
by AC-W52 and AC-W54. Evidence: of run A's first full pass's 19 findings, one touched what the build hinges
on, and the second full pass found two the first had missed, which is the case for checking fewer claims.

### 7.5 Cards and the deck (C-52)

The template `templates/card-template.md` is built (WU-56, merge `228bec1`; D-291): two H2s, `Brainstorm
half` and `Verification half`, each with fixed H3s. Since WU-57 (D-286, D-287, D-303, D-335, D-339), R1a
fills the brainstorm half (about 250–400 words); R1b fills the verification half.

- **Brainstorm half:**
  - **Identity:** class, ascendancy and named damage source; since WU-63, one line per skill the card uses
    that a passive-tree node or a unique grants, naming the source (D-342).
  - **Pitch:** a title of at most 60 characters, playstyle tags (FR-W1's vocabulary), and two lines; an
    under-played card's pitch carries `Under-played (judgment)` (D-339).
  - **Chain:** the named damage source and what it reads (the slot that carries it); its multipliers; its
    enablers; what the payoff consumes or requires, and who supplies it.
  - **Enabler:** the item, node or gem, the level it arrives at, how to get it, and what is dormant until
    then.
  - **Links table:** per link, the confirming game text and the lookup that found it; how PoB follows it
    (§7.6's labels, with PG ids); any hidden clauses, stated as theory ("from a Hit", "you use yourself").
  - **Evidence** (D-335): the brief's `popularity` notes, cited as user-supplied, where they speak to this
    card's skill, ascendancy or combination, or else "no player evidence"; a reference build, if there is
    one. No tool supplies player evidence.
  - **Risks so far:** payoff thieves, placement limits, the exposed phase, resistant bosses.
- **Verification half:**
  - **Verified:** defences from PoB (life, energy shield, resistances, max hit, `TotalEHP`) and the modelled
    DPS.
  - **Estimates:** each Count and custom modifier with its reason; any figure computed with a custom
    modifier present; clear and boss figures kept separate.
  - **Checklist results** (§7.7), **a fallback ladder** and **key item prices**.
- **Status words**, used everywhere on the card: confirmed in game text; modelled in PoB; estimate (with the
  reason); players use it (the user's notes, D-335); not checked yet; needs in-game testing.
- **The template against D-335.** As WU-56 merged it, the template named poe.ninja in its fourth status
  word and its `Evidence` H3, and AC-W27's static test pinned those strings. WU-57 restated both to this
  section: the user's notes, cited as user-supplied, or "no player evidence".
- **Damage sources that aren't skills** (D-303, HG-21), such as a flask nova, may be dealt and verified,
  but the card is marked "can't be finalized yet": finalizing one waits on a plan field for an item-effect
  damage source and its hand calculation. Its identity's `skill` names the damage source, checked at deck
  assembly by a lookup of its kind; in verification it gets only the checklist's read-only checks, with no
  skeleton or probe compile, and the card says so (D-334). Since WU-57 its status is "can't be finalized
  yet: its damage source isn't a skill", never `failed`, and it is in no failure list.
- **`cards.md`** (R1a-assemble) holds one line per dealt card, like R1b-assemble's comparison lines, then a
  "Not dealt" list, each with the link no lookup confirmed or the check that failed (`wrong-ascendancy`,
  D-342).

### 7.6 The pattern library `references/patterns.md` (C-53)

Built (WU-56, merge `228bec1`; D-290) from the ten pattern families of the work-log's "Off-meta builds
7–30", the earlier studies, and the brainstorm questions from its "Process heuristics, by phase", which open
the file. v1 holds 60 entries in ten families, 5,642 words at the merge; its review checked all 60 against
their sources. `SKILL.md` lists it since WU-57, which removed the static test's `AWAITING_SKILL_WIRING`
exemption from AC-W1's "lists every shared reference" rule.
- **Each entry:** name and shape (one general sentence that applies to any skill); search step (the starting
  point, the lookup or phrase search, and what to check); how PoB follows it (modelled, Count, custom
  modifier, config stand-in, hand calculation, or not modelled, citing PG ids); one to three example builds,
  a line each; cautions.
- **Rules:** shapes only, each use re-checked against current game data; at most 6,000 words, counted by
  AC-W28's static test, so a researcher reads it whole (D-325); after each user-supplied study, the
  coordinator proposes entries and the user approves them.

### 7.7 The verification checklist (advisory)

The checklist's text is built (WU-56; D-292): `references/stages/R1b.md`'s H2 `Verification checklist
(advisory, D-292)`, between `Work` and `Writes`. Since WU-57, R1b runs these checks on a picked card and
writes each result into the card as verified, estimate, risk or not checked. None is a gate, and none
starts a fix round.
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
  within NFR-21's per-request limit, and doesn't count in the verdict's `compiles`.
- **Where the results go** (D-338). R1b writes each probe's plan at `probes/<card-id>/<n>/plan.json` (`n`
  from 1 in run order; the server writes its record beside it) and the card's `Checklist results`. Since
  WU-57 R1b's header `writes` name both, and since WU-58 the checker accepts them (AC-W2 (ff)) and the run
  log's `probes` counts each attempt's probes, failed ones included, so the cap of 4 can be audited.

### 7.8 The audit layer `audit.md`

Built (WU-62, merge `14f3553`; D-278). A separate file in the run folder, not an appendix to the guide; no
human is expected to read it, so the guide's word cap and no-marker rule apply to all of `guide.md`. W1
writes it from `templates/audit-template.md` and patches it with Edit; the runner fills its `Known issues`
table at step 14. The checker requires these H2s in order once a guide exists (AC-W2 (z)).

| `audit.md` H2 | Holds |
|---|---|
| `Hand calculations` | the ledger table |
| `Stage detail` | the per-loadout PoB numbers, the resistance table, the mana and leech pairs, the Arbiter and mapping detail |
| `What PoB doesn't model` | `check_model_coverage`'s flags and their handling |
| `Inputs by confidence` | the M and L inputs, and the claims needing an external source |
| `Run notes` | why this concept (the pick's checkpoint answer and its rule); the D1 gate's budget totals and rates |
| `Known issues` | each open or accepted finding's id, its lens or gate, and the sentence the guide prints |

*Target (WU-71, D-355, amending D-278 and AC-W2 (z)):* `audit.md` is rendered by
`scripts/render-audit.mjs`, which the runner runs after the final compile, loading the server's modules as
the checker does. It writes the stage table, the coverage flags, the inputs by confidence and the estimates
(ledger entries, Count and custom modifiers, with their reasons), and no Run notes or hand-calculation
prose. It also renders each endgame rung's Checks block (budget, Arbiter verdict, clear and movement speed),
which W1 copies verbatim into the guide; the checker fails an `audit.md` or Checks block that differs from
the render, Known issues aside (AC-W55).

## 8. Guide template (W1; ext §5, the design's quality bar)

`templates/guide-template.md`, as built by WU-62 (merge `14f3553`; D-276, D-277, D-280, D-281): **the reader
layer.** `guide.md` has one H1 naming the roll and the concept, then the 14 H2s of the table below, in order,
and no other H2. It is about 2,840 words, capped at 3,000 (the H1, the import code and the Known issues list
not counted), and renders the plan: no markers, and no fact or number of its own. Everything kept for
agents is in `audit.md` (§7.8). Before WU-62 the guide had 13 H2s (`Versions, prices and import code`,
`Summary`, `How it works`, …, `Confidence and what PoB can't model`, `Changelog`, `Sources`) with source
markers; the template, the checker and the pipeline fixtures no longer use them.
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
- **Word budgets in the template** (accepted deviation). Each section states its budget from the table
  below: in its prose placeholder ("About <n> words."), or, for the nine sections that have no prose
  placeholder, as a note line `[About <n> words.]`, which W1 deletes with the template's other notes. A
  static test reads the table from this section and holds the template to it.

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

Since WU-57 and WU-58 (D-294), the verdict line quotes the named source's Count-scaled figure and ends with
"Effective HP about <n>.", which the checker compares with the stage's `TotalEHP` by the same rounding rule;
EHP is shown beside max hit, never alone, and max hit stays the basis of the verdict. `What PoB can't show`
lists each Count and custom modifier with its reason, rendered from the plan.

*Target (WU-70, WU-71; D-351, D-353…D-355, D-358, D-359), amending the rows above:*
- **The survival label follows the Arbiter verdict** (D-353): "survives the Arbiter's hits" or "one-shot by
  the Arbiter's <hit>", read from the record's `measures.arbiter` on `b` and `n` (run A's rungs read "solid"
  while the slam one-shot them, at max hits 0.66 and 0.85 of it). The five waystone-scaled map hits stay
  the D1 gate's floor. No kill time or hits to kill appears anywhere in the guide.
- **The verdict line's hits** (D-353): with the `hit_*` entries gone, the checker compares the physical hit,
  and the largest of the other four, with the record's compiler-written hits (the stage's
  `enemy<Type>Damage` in `configWritten`, §5.3).
- **Each endgame rung's Checks** is the block `scripts/render-audit.mjs` renders (budget, Arbiter verdict,
  clear and movement speed), copied verbatim (D-355). Clear speed is the record's rough `clearSpeed`.
- **The campaign** (D-354): per act, the tree path order, the support gem order, a rough upgrade order, the
  build-specific mods to target and a target life; no resistances, max hits or EHP, so `Survival by stage`
  loses its campaign rows (`guide-template.md`:56-60). No crafting: the guide names mods to buy on trade.
- **The anoint** (D-358): `b` and `n` name it and its recipe of three Distilled Emotions, priced like a
  slot; `m` has one line pointing a player who can afford one before maps to the budget anoint.
- **Support sockets** (D-359): the guide says once that a tree-granted skill's support counts are
  estimates, and never saves Jeweller's Orbs for a tree-granted skill (run A's `guide.md:94` did).
- **What PoB can't show** keeps only hinge caveats, each once (D-351).

## 9. Pricing procedure (T1; `references/pricing.md`; D-133, D-160, D-164, D-169, D-202, D-218)

- **Who.** Only coordinator steps price, with P's tools and C-49's dated outputs (D-112, D-178).
- **Order** (D-133): R1b prices concept key items; D1 prices every filled slot **and every tree jewel**
  (D-249) of every rung, entering maps, budget and non-budget (ids `m-<slot>`, `b-<slot>` and `n-<slot>`,
  D-281; WU-62), with rares as affix-target searches (`search_trade_items` with `mods`), each with its own
  entry unless slots hold identical item text; D2 prices campaign uniques.
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
- *Target (WU-70; D-348, D-356, D-358):* `D1-finish` prices D1's slots, the anoint like a slot. No item-base
  or mod-tier search serves crafting: the guide names mods to buy on trade.

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

Since WU-57 and WU-58 (D-287, D-288): **three gates, one per phase**, alongside the unsaved-build question
and escalations. Every gate visit prints its display first, in the reply, whoever answers it (D-265 (b));
since WU-57's re-open at `96b1785` that is a hard rule in `SKILL.md`, and each gate paragraph points to it.
A pre-supplied or default answer then states what it resolved to (`Test config: first-n:2 → verify r1-a-1,
r1-b-1`).
- **The brainstorm gate.** It echoes the parsed brief, prints the deck (`cards.md`'s dealt cards and its
  "Not dealt" list, and after a short round its reason, D-339), and asks with AskUserQuestion in
  `multiSelect` mode: up to 4 cards per question, up to 3 questions, plus one for more or stop. The pick is
  the union of the selections, up to 3; more than 3 is asked again. The answers: **verify** 1–3 cards;
  **brainstorm more**, with a note; or **stop**.
- **The verification gate** (renamed from checkpoint 1). It shows the comparison of the verified cards,
  `TotalEHP` included, and asks: **finalize** one (a failed card may be picked anyway; its identity becomes
  the run's `roll`); **verify other cards** from the deck (a new verification round without a brainstorm);
  **brainstorm more**; or **stop**. Every route that went back to checkpoint 1 now comes here: an
  `infeasible` design, the escalation's option 3, and FI-3. A card that can't be finalized (`not-a-skill`,
  D-303; `wrong-ascendancy`, D-342) can't be picked, not even anyway; a pre-supplied pick of one ends the
  run `stopped`, its `rule` the test config's `pick:<id>`.
- **The final gate** (checkpoint 2), unchanged.

*Target (WU-70, WU-71; D-362):* **the design gate**, a fourth user gate, after a passing D1 gate and before
D2, W1 and V4: the user judges the endgame build before the leveling loadouts and the guide exist.
- **Display**, printed whoever answers it: each rung's measures (DPS, EHP, the Arbiter verdict, clear
  speed), the anoint, the key gear, gems and tree in brief, and the open estimates. The D1 gate step writes
  it, compactly, into its verdict file, and the runner prints it from there, reading no plan or record (A-35).
- **Answers:** `accept`, on to D2 and the guide; `revise:<text>`, a D1 fix round with the text (`D1-build`
  for a build change, `D1-finish` otherwise), the D1 gate, then this gate again; `verification`, back to the
  verification gate to finalize another card; `stop`.
- **Plumbing:** checkpoint `design` in the run log; `answers.design[]` in the test config; when the answers
  run out, `stop`, with the rule recorded. The final gate's `revise:` stays for guide-level changes.

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
Since WU-57 (D-333, D-335), `--no-ninja`: the run calls no tool in group `ninja`, whose one tool is
`get_currency_rates`, so price totals in divines are `unverified` (pricing's path when rates are missing).
Cards say "no player evidence" in every run, offline or not, unless the brief carries the user's
`popularity` notes (D-335).

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

Since WU-57 and WU-58 (D-288, D-323): `answers.brainstorm[]`: `pick:<id>[,<id>…]` (1–3 ids), `first-n:<n>`
(n = 1–3: the first n dealt cards not yet verified), `more` or `stop`. `answers.verification[]`, renamed
from `answers.checkpoint1[]`: `first-viable`, `pick:<id>`, `verify:<id>[,<id>…]`, `more` (a new brainstorm
round) or `stop`. `answers.final[]`, renamed from `answers.checkpoint2[]`, with the same values.
`checkpoint1` and `checkpoint2` are retired in run log v3. The escalation answer `checkpoint-1` becomes
`verification`. When answers are missing or run out, the run ends `stopped` with the rule recorded. A-28
gains the brainstorm gate: pick the first dealt card, or follow the test config. A test config holding the
retired keys `checkpoint1` or `checkpoint2` is refused (AC-W48). *Target (WU-70, WU-71; D-362):*
`answers.design[]`, one per design-gate visit: `accept`, `revise:<text>`, `verification` or `stop`; none
left, `stop`, `default`.

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
| FI-3 | the D1 gate step | none: the outcome is forced to `infeasible` (`"forced": "infeasible"`), with evidence `FI-3 (injected)` | control flow only: the route back to the verification gate (since WU-57, D-287; before it, checkpoint 1) |

The seeded V4 checks FI-4 (a ledger formula wrapped as `(<formula>) * 2`) and FI-5 (a run log set to
`online`) (AC-W15) are applied by the build coordinator to a copy of a run folder, not through the skill.

## 12. Work units

**Shared files.** `SKILL.md`, `scripts/check-run.mjs`, `tests/static/buildGuidePipeline.test.ts`,
`tests/unit/buildGuideCheckRun.test.ts` and `.claude/agents/build-guide/build-guide-coordinator.md` are
shared: units editing them merge one at a time. WU-62 merged before WU-57, WU-57 before WU-58, and WU-58
before WU-63 (D-317). Amendment 2's and 3's units belong to milestone M-14, "open builds offline" (D-315);
amendment 4's (WU-64 and WU-69…WU-72 here) to M-15, "the lean pipeline offline" (D-361), and WU-69, WU-70
and WU-71 merge in that order.

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
- depends-on: [M-14 (WU-59), M-15 (WU-72), HG-14]
- role: **user**, assisted by the build coordinator
- touches: [the user's guides and builds folders (coordinator and user only); the work-log]
- produces: [the alpha sign-off (M-13)]
- consumes: [everything]
- acceptance: [the WU-48 checklist below]
- milestone: M-13
- summary: The first live run, with web research on D-171's hosts and live pricing through the server. It
  runs after M-14 ("open builds offline") and M-15 ("the lean pipeline offline"), so it exercises the
  amended pipeline; its trade gate is unchanged (D-315, D-361). The user answers every gate, then plays the
  guide.

**WU-48 checklist.** Each item is recorded pass or fail, with a note. Item 11 is set up before item 3,
and its file is shown to the user with item 1's approval.
1. **Approval.** HG-14's approval is recorded in the work-log before anything starts: live trade through
   the server, web research on D-171's hosts, writes to the real guides and builds folders. poe.ninja's
   economy endpoints, reached only through `get_currency_rates`, need no approval (D-297, D-335); trade keeps
   D-182's.
2. **Server.** The user's registered `pob2` server runs the commit under test, with trade enabled. The
   cookie is the user's own, and no agent handles it.
3. **Run.** In a session in the repo, `/build-guide Titan "Blood Hunt"` (online, no test config; the old
   form still works, C-51). The run log shows `answeredBy: "user"` at every gate (the brainstorm,
   verification and final gates; after WU-71, the design gate too).
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
- status: built (merge `228bec1`)
- depends-on: []
- role: pipeline author
- touches: [`.claude/skills/build-guide/references/patterns.md` (new), `.claude/skills/build-guide/templates/card-template.md` (new), `.claude/skills/build-guide/references/stages/R1b.md` (the checklist), `tests/static/buildGuidePipeline.test.ts`]
- produces: [the pattern library v1 (§7.6, C-53), the card template (§7.5, C-52), the verification checklist and probe budget in R1b's reference (§7.7)]
- consumes: [D-290, D-291, D-292; the work-log's "Off-meta builds 7–30" and "Process heuristics, by phase"]
- acceptance: [AC-W27, AC-W28, AC-W29]
- milestone: M-14
- summary: Amendment 3's N-5. The content the brainstorm and verification phases read. Independent of the
  other units; WU-57 builds on it. As merged: `patterns.md` 5,642 words, 60 entries in ten families; static
  tests 212 of 212.
  - **Deviation accepted:** an `AWAITING_SKILL_WIRING` entry in the static test exempts `patterns.md` from
    AC-W1's "lists every shared reference" rule until `SKILL.md` lists it; the exemption expires once
    WU-57's `references/stages/R1a-assemble.md` exists (its review made it fail closed).
  - **Its review** checked all 60 entries against their sources (three fixed; "Dazed" restored with a
    `[crossbow]` citation, `ConfigOptions.lua:1684`) and tightened AC-W27…AC-W29's assertions to the named
    elements. Its fold item is D-338: R1b's checklist writes probes and the card's results that R1b's header
    and the checker don't admit yet.
  - **Against D-335:** the merged template still carries poe.ninja player evidence (§7.5); WU-57 restates
    it.

### WU-57: The pipeline — brief, three phases, cards, Count and the named damage source
- kind: build
- status: built (`d0cbd4d`, merged at `66362d0`). Re-opened twice from WU-59: for D-343 and D-344 at
  `51b22c9`, `3c57d50` and `30abc7a`, and for the gate display (D-265 (b)) at `96b1785`
- depends-on: [WU-55, WU-56, WU-62]
- role: pipeline author
- touches: [`SKILL.md` (invocation, steps, hosts and routes, and listing `references/patterns.md`); `references/stages/R1a.md` (foci, cards, the library); `references/stages/R1a-assemble.md` (new); `references/stages/R1b.md` (the card's identity, the checklist, the probe budget, and its header `writes`: `probes/<card-id>/<n>/` and `cards/<id>.md`, D-338); `references/stages/R1b-assemble.md` (`TotalEHP` in the key numbers); `templates/card-template.md` (the Evidence fields and the fourth status word, D-335); `templates/guide-template.md` and `references/stages/W1.md` (the verdict line's EHP); `references/checkpoints.md`; `references/offline-and-test.md`; `references/gates.md` and `references/stages/D1-gate.md` (figure × count); `references/stages/D1.md`, `D2.md`; the agent definitions, including `build-guide-verifier.md`'s re-check line, which still states the rule from before D-264 (AC-W14); the "rolled skill" wording across the skill; `tests/static/buildGuidePipeline.test.ts`, including its check of that line, AC-W27's card-template strings and the `AWAITING_SKILL_WIRING` entry it drops]
- produces: [the brief and invocation, with the `popularity` field (FR-W1, C-51, D-335); the three phases and gates (§5.2, §10); R1a-assemble and the deck, with the under-played cards by judgment (§7.5, D-298, D-339); the card halves; the checklist run (§7.7) and R1b's `writes` (D-338); the named damage source and figure × count in the D1 gate (§5.3, D-340); D1's Count and custom-modifier work; D2's bridge skills; the poe.ninja rule (§4, FR-W3): never contact pathofexile.com or poe.ninja yourself, and there are no poe.ninja tools beyond the currency rates (D-335); the renamed routes and test answers (§11.2); from its re-opens, the brief check's support-gem rule and the fixed roll by shape (D-343), the missing-Agent-tool stop (D-344) and the gate-display hard rule (D-265 (b))]
- consumes: [C-51, C-52, C-53, C-33's Count-scaled fields and custom-modifier marks (WU-55), D-285…D-301, D-335, D-338]
- acceptance: [AC-W30, AC-W31, AC-W32, AC-W33, AC-W14 (the re-check rule), AC-W27 as D-335 restates its strings; from its re-opens, the static checks of AC-W47's and AC-W48's wording, and the gate display at each gate paragraph]
- milestone: M-14
- summary: Amendment 3's N-6. Merged after WU-62, whose verdict line it extends, and before WU-58. It no
  longer depended on WU-50 or WU-52: D-335 withdrew the poe.ninja tools and the popularity threshold, so
  there was nothing to stub. As built:
  - **AC-W32** was pinned at its first step (A-33) and approved. Built at `d0cbd4d`: gate rc 0/0 (2019
    tests), its ACs plus a block for D1's Count, the D1 gate's figure × count, D2's bridge skills and EHP.
  - **Deviations accepted:** steps 2a, 2b and 2c are sub-steps; a non-skill card's R1b verdict is `compiled:
    fail`, code `not-a-skill`, never retried; the slugs `open-<skill>` and `open`; the runner reads
    `cards.md`; the `cards.md` format; `AWAITING_SKILL_WIRING` removed; wording and route edits in seven
    references outside the touches.
  - **Its review** (2 medium, 5 low; all fixed, all deviations accepted): a non-skill card gets its own
    status, "can't be finalized yet: its damage source isn't a skill", in no failure list (D-303, D-334);
    nothing produced the deck's under-played cards, which D-339 settled; D-296's estimate label on the
    verification gate's DPS; D-340, written in `gates.md` and `D1-gate.md`; stale `c1` ids in the gate and
    source-marker examples (`D2-gate.md` granted as a touch); AC-W31's test asserts the three gate step
    rows. Static and checker suites at the merge: 462 of 462.
  - **Re-opened for D-343 and D-344** (WU-59's P1, first attempt: the free-text Fork brief parsed as
    `around`, so no D-258 refusal fired; check 4 stopped early for the missing Agent tool). `51b22c9`
    implemented both in `SKILL.md` and `R1a.md`, rewrote AC-W47 and added static and checker tests
    (accepted: no run-log field for a stop reason, a sentence in `R1a.md`, WU-59's P1 count, AC-W47
    retitled "the brief check"). Its first review failed: the fixed roll was defined by whether its names
    are valid, so the misspelled checks could pass as free text; AC-W48 didn't require check 4's stop;
    `around` wasn't recorded by the lookup's name. `3c57d50` defined the fixed roll by its shape and fixed
    the rest (gate 2117 of 2117). The second review passed for P1; `30abc7a` then made a lookup miss stop
    a run only for a name given as the skill, and an unquoted brief the gem lookup finds whole one name
    (static 284 of 284, checker 270 of 270; the coordinator read the diff and accepted it).
  - **Re-opened for the gate display** (WU-59's run A, AC-W37): the gates printed no display for
    pre-supplied answers, since only `references/checkpoints.md` held D-265 (b)'s rule. `96b1785` adds a
    Hard rules bullet, "Every gate visit prints its display first, in your reply, whoever answers it
    (D-265)", and points to it at steps 2c, 5 and 16 and the escalation (static 286 of 286, checker 270 of
    270; accepted by the coordinator).

### WU-58: The checker and run log v3
- kind: build
- status: built (`eb32044`, merged at `3ffd7d0`)
- depends-on: [WU-57]
- role: pipeline author + test infra
- touches: [`scripts/check-run.mjs` (the run-log fields, roll and brief, the escalation answer, checkpoints, the flow with picks, mores, brainstorm and verification rounds, card ids and the caps, the rolled-skill recompute with Count, the verdict line's EHP, and the layout's `cards/`, `cards.md` and `probes/`, D-338); `references/run-log.md` (each card's probe count, D-338); `tests/unit/buildGuideCheckRun.test.ts`; `tests/fixtures/pipeline/` (`run-ok`, `run-ok-online`, `run-escalated` rebuilt; `run-ok-v2` added); granted by its review: one line of `references/stages/R1b.md` (the probe count includes failed probes)]
- produces: [run log v3 (§6) with the `stages[]` fields `probes` and `shortReason`, the v3 checks (FR-W7)]
- consumes: [D-287, D-289, D-294, D-326, D-338, D-339; WU-57's "for WU-58" list and its reviewer's additions]
- acceptance: [AC-W2 (aa)…(ff); D-339's short-round rule]
- milestone: M-14
- summary: Amendment 3's N-7. As built:
  - Gate rc 0/0 (2076 tests). AC-W2 (aa)…(ff) are behaviour tests in `buildGuideCheckRun.test.ts`, and 12
    mutation checks confirm they bite. The checker exits 0 on `run-ok`, `run-ok-online`, `run-escalated`
    and `run-ok-v2`.
  - **WU-57's list, built:** card ids wherever the checker matched `c<n>`; `KNOWN_TOP` gains `cards/`,
    `cards.md` and `probes/`; the verdict form's "Effective HP about <n>." (dd); the D1 gate recompute and
    the verdict line's DPS read `countedSkillOutputs` (ee); an R1b `not-a-skill` failure is terminal; run
    log v3 (the brief, `roll` null until the verification gate, the gate names, R1a-assemble, the
    `verification` escalation, the answers `pick:`, `verify:` and `first-n`, and the `answers.*` test keys);
    the slug from the brief; `run-log.md`'s first write equal to `SKILL.md`'s.
  - **The run-log fields** `probes` (on every R1b entry, the probe variants its attempt ran) and
    `shortReason` (on an R1a-assemble entry, a short round's reason, D-339).
  - **Deviations accepted:** `playstyle` is a list of strings; each R1b entry carries a `probes` count;
    `run-ok-v2` is the old `run-ok`, because WU-47's recorded runs predate WU-62's guide format; Effective
    HP is optional in schema 2; card ids use researcher letters `a`–`c` only. Two pinned static assertions
    moved: the verdict-line form is plain equality, and the rule sentence uses `pick:r1-a-2`.
  - **Its review** (5 low, all fixed) ran every path of the skill as fixture copies (a fixed roll and an
    open brief, `more` at both gates, a second verification round, a short round, a `not-a-skill` card,
    `first-n` and `first-viable`, the `verification` escalation answer, offline and online pricing) with no
    false rejection, and (aa)…(ff) and D-339 each fail their broken copies. Its added checks: the final
    gate's answer tied to the run's end status (accept → `completed`, a default `stop` → `stopped`, any
    other answer → `not-accepted`); each escalation answer matched to its `escalations[k].choice`, one for
    one; the probe count includes failed probes; a card file for a round that never ran fails; a schema-2
    log rejects the schema-3-only fields. D-341 restated D-326. Static and checker suites at the merge:
    532 of 532.

### WU-59: Offline end-to-end run with an open brief, recorded
- kind: build (recorded run)
- status: recorded; re-scoped by D-361 (amendment 4): runs B and P2 dropped. P1 passed on its second attempt
  and run A ended `completed`, both at `30abc7a`. Its criteria were pinned (A-33) and merged at `56ad83d`:
  AC-W34…AC-W50, AC-W45 and AC-W46 since withdrawn (D-361).
- depends-on: [WU-51, WU-53…WU-58, WU-60…WU-63] (WU-50 done, WU-52 withdrawn, D-335)
- role: build coordinator, with an independent verifier checking the record
- touches: [the work-log only; temp dirs and a worktree. Failures re-open the owning unit]
- produces: [the M-14 record]
- consumes: [everything in this slice]
- acceptance: [AC-W34, AC-W35, AC-W36, AC-W37, AC-W38, AC-W39, AC-W40, AC-W41, AC-W42, AC-W43, AC-W44,
  AC-W47, AC-W48, AC-W49, AC-W50, as D-361 scopes them to P1 and run A (AC-W45 and AC-W46 withdrawn; AC-W37
  takes its evidence from the lean run, AC-W56). They include the coordinator's guide review with amendment
  2's style rules (the reader layer's rules, each caveat once, the not-a-tutorial rule; D-276, D-280; AC-W42,
  AC-W43), and a run through the paths WU-47 left to tests and review demos: D-264's claims-only path,
  D-265 (b)–(e) and D-266 (WU-47's exception E4; AC-W44)]
- milestone: M-14
- summary: Amendment 3's N-8: WU-47's recorded procedure (D-274), with an open brief in place of a roll. Its
  record, with every unit above merged, is M-14's exit (D-315; as recorded, D-361).
  - **The brief** (the user, 2026-10-11): the skill Explosive Concoction, with any ascendancy. At the pin it
    is an ascendancy skill. Its gem, `SkillGemAscendancyExplosiveConcoction`, is `fromTree`, and only the
    Pathfinder node "Explosive Concoction" grants it (node 38004, an option of the multiple-choice notable
    "Brew Concoction", 57141; `TreeData/0_5/tree.lua:86216`). So a correct brainstorm narrows to the
    Ranger's Pathfinder and says why.
  - **The procedure:**
    1. **Setup**, as WU-47's steps 1 to 3:
       - a worktree at the gated integration head, bootstrapped and built;
       - temp dirs for the builds folder, the state dir, the guides root and the server's cwd;
       - an MCP config that registers this server as `pob2`, started from the temp cwd with those dirs,
         `POE_TRADE_DISABLED=true`, `POE_NINJA_DISABLED=true`,
         `POE_TRADE_BASE=http://127.0.0.1:9/api/trade2` and no `POESESSID`. P2 gets a server of its own,
         with its own temp dirs;
       - interactive sessions the user starts in the worktree (D-263), on Opus (D-275), with
         `--strict-mcp-config`, WebSearch and WebFetch denied, reading any `.env` denied and editing under
         `/mnt` denied.

       The kept evidence is each session's transcript with its subagent transcripts (D-267).
    2. **P1, the start-up probes**, in a session with the Agent tool denied: four invalid briefs, a free-text
       brief that stops at its first agent step, and two refused test configs (AC-W47, AC-W48).
    3. **Run A, the open brief:** `/build-guide Explosive Concoction, any ascendancy --offline --test A.json`.
       - Answers: `brainstorm` `["first-n:2"]`; `verification` `["first-viable"]`; `final`
         `["revise:<R>", "accept"]`.
       - `<R>` asks for a claims-only change to an endgame stage, so the revision runs D1 without a compile,
         then W1, then the checks again (D-264, D-266): "In plan.json's budget rung, an endgame stage, add
         one claim stating how many Mana Flask charges each Explosive Concoction throw uses, sourced from the
         gem's own data, and say it once in the guide where the reader manages flasks. This is a
         claims-only change: change no gear, gem, tree, config or ledger formula."
       - Faults: FI-1 `{concepts: "all", persistent: false}`, so each picked card's first R1b attempt fails
         and re-runs free; FI-2 `{concepts: "all", persistent: false}`, so the D1 gate's first attempt fails
         V1 and D1 re-runs free.
    4. *Withdrawn → D-361 (run B dropped, Q6):* **Run B, the failure routes:** the same brief, with
       `--test B.json`.
       - Answers: `brainstorm` `["more", "pick:r1-a-1,r2-a-1"]`, a second brainstorm round, then the first
         card of each round's first researcher (ids that exist whatever the deck deals);
         `verification` `["pick:r1-a-1", "pick:r2-a-1"]`; no `final` or `escalation` answer.
       - Faults: FI-1 `{concepts: "all", persistent: true}` (no viable card); FI-3 `{concepts: ["r1-a-1"]}`
         (`r1-a-1` infeasible, back to the verification gate); FI-2 `{concepts: ["r2-a-1"], persistent:
         true}` (a D1 gate escalation, answered by the default `stop`).
    5. *Withdrawn → D-361 (P2 dropped, Q6):* **P2, a card whose damage source isn't a skill:** a launcher
       session starts one R1b step with the
       Agent tool, as `build-guide-coordinator`, on a seeded run folder. Its card `r1-b-1` names Melting
       Maelstrom's mana nova (PG-19) as its damage source (AC-W46). No run can be steered to such a card:
       the test config picks cards by id or by position, and a brief that names a skill holds such a card
       back (D-334).
    6. **Checks and review:** the coordinator records AC-W34…AC-W50, and an independent verifier re-checks
       the record. A *(quality)* clause is handled as WU-47's are: one coordinator re-run of that run, then
       a finding against the owning unit's prompts.
  - **The record** (work-log, "2026-10-11: WU-59, P1 check 3 fails; WU-57 re-opened" onward):
    - **The environment** is `/tmp/m14.zfPx`, its launcher matching attempt 3's safety settings; the run
      worktree `m14` moved to each gated head (`e62799b`, then `30abc7a`, then `96b1785` after run A). The
      prep's launcher test once ran `claude` without a TTY: it exited at argument parsing, with no session,
      no model call and nothing written.
    - **P1, first attempt:** check 3 failed (the free-text Fork brief went to `around`, D-343) and check 4
      stopped early for the missing Agent tool (D-344); check 5 passed AC-W48 (b) and check 6 the lock
      (node 38004). WU-57 was re-opened. P1 grew to seven checks: check 3 became
      `/build-guide Pathfinder Fork --offline`, and check 7 the free-text Fork brief.
    - **P1, second attempt** (`30abc7a`, transcript `a30c5754-…`): all seven checks pass, with no agent and
      no web or `/mnt` call, and an empty `git status --porcelain`. A nit for the analysis: the runner's
      Bash used `echo` (`echo "rc=$?"`), which writes nothing but which D-265 (e)'s list doesn't name.
    - **Run A** (`open-explosive-concoction/2026-10-11-3`, transcript `17907107-…`, at `30abc7a`): `status:
      "completed"`, roll Ranger / Pathfinder / Explosive Concoction, `check-run` exits 0; the final gate
      pre-supplied `revise:` (the Mana Flask claim), then `accept`. The deck dealt 7 cards, 4 under-played,
      2 not dealt, every card Ranger Pathfinder (the lock held for "any ascendancy") with "no player
      evidence". **AC-W37 failed:** both gates were answered `pre-supplied` and printed no display; fixed
      at `96b1785`, its evidence now the lean run's (D-361). AC-W44 (f) passes on a scratch copy.
    - **Run A's cost**, all on Opus: cache read 296.2M, cache write 9.05M, recorded output 1.78M, over 37
      transcripts and 1695 API turns, against an estimate of about 130M cache read; V4 took 104.9M over 11
      runs. Run B was held, then dropped (D-361); the cost led to amendment 4 (D-345…D-362).

### WU-62: The guide style — the reader layer, the audit layer and the guards
- kind: build
- status: built (merge `14f3553`)
- depends-on: [WU-61]. Soft: WU-60 merged first, so D1 uses its affix sources (a mod's base types, essences)
- role: pipeline author + test infra
- touches: [`templates/guide-template.md` (rewritten); `templates/audit-template.md` (new); `references/stages/W1.md`, `V4.md`, `D1.md`, `D2.md`, `D1-gate.md`; `references/gates.md`; `references/source-markers.md`; `SKILL.md` steps 10 and 14; `references/run-folder.md`; `references/task-header.md`; `scripts/check-run.mjs` (the guards); `tests/static/buildGuidePipeline.test.ts`; `tests/unit/buildGuideCheckRun.test.ts`; `tests/fixtures/pipeline/run-ok` and `run-ok-online` (a new-style `guide.md` plus `audit.md`)]
- produces: [the reader layer (§8's target), `audit.md` (§7.8), the editor lens (§7.4's target), the entering-maps rung in D1, D2 and the gates (§5.3), the checker's guards (FR-W7's target)]
- consumes: [D-276…D-283; C-31's `entering-maps` variant and the ladder track (WU-61); the lookup's base types for a mod (WU-60, if merged)]
- acceptance: [AC-W2 (v)…(z) and the amended (b) and (l), AC-W11 (G1's H2s)]
- milestone: M-14
- summary: Amendment 2's pipeline work (its G8). Merges before WU-57 and WU-58, which edit its verdict line
  (D-317). As merged: static and checker suites 421 of 421; the checker exits 0 on the three good
  fixtures; the fixtures with an `m` rung are at plan version 2; `areaLevelOf` maps `entering-maps` to 69;
  the first rung is taken by rung order. Its review added every section's word budget from §8's table, the
  FAQ's "3–5 questions" rule, a fence guard that exempts only the import code, and a fault string naming
  stage `m`.
  - **Deviation accepted:** the nine sections with no prose placeholder carry `[About <n> words.]` note
    lines, which W1 deletes (§8).
  - **Out-of-touch edits accepted** for consistency: `references/pricing.md`, `references/checkpoints.md`,
    `references/offline-and-test.md`, and the writer and coordinator agents.
  - Left open by its review: `references/lookups.md` (now line 71) still points at the removed H2
    "Confidence and what PoB can't model"; the coordinator fixes it after WU-53 merges, since WU-53 also
    edits that file.

### WU-63: The ascendancy lock (D-342)
- kind: build
- status: built (`7135280`, the lock; `b82cfd8`, the finalize bar; merged at `e62799b`)
- depends-on: [WU-57, WU-58]
- role: pipeline author + test infra
- touches: [`SKILL.md` (the brief check's lock, `search_tree_nodes` among the runner's tools, the finalize bar); `references/stages/R1a.md`, `R1a-assemble.md`, `R1b.md` and `R1b-assemble.md`; `templates/card-template.md` (the identity's grant lines); `references/run-log.md`, `checkpoints.md` and `offline-and-test.md`; `scripts/check-run.mjs`; `tests/static/buildGuidePipeline.test.ts`; `tests/unit/buildGuideCheckRun.test.ts` and its fixture card; this slice's FR-W3 and AC-W34]
- produces: [D-342's lock in the brainstorm, in R1b and in the brief check; the checker's terminal `wrong-ascendancy` and its finalize bar]
- consumes: [C-43 (`search_tree_nodes {query: "Grants Skill: <skill>"}` prints each granting node's ascendancy, so no server change), C-37's mechanic mode (the unique search), C-51, C-52]
- acceptance: [AC-W61, AC-W62; AC-W47's lock check, P1's check 6]
- milestone: M-14
- summary: The user's direction (D-342), after WU-59's prep found that nothing made a card for a
  tree-granted skill use the ascendancy that grants it: the identity check confirms only that the
  ascendancy exists and the skill is active, and PoB computes an Explosive Concoction group on any class.
  - **Built** at `7135280` and `b82cfd8` (static and checker suites 538 of 538). Its review (1 medium, 4
    low) found the flow and both checker bars sound and `not-a-skill` unregressed. The pinned tree has 54
    tree-granted skills, each granted by a single ascendancy node.
  - **The coordinator's rulings, extending D-342:** the lock checks every skill a card names (its damage
    source, chain and links); it applies only when every granting node is an ascendancy node, none of them
    the card's, and no unique grants the skill (The Covenant also grants Life Remnants); a brief naming an
    ascendancy that can't use its skill stops at step 1's brief check, the runner gaining
    `search_tree_nodes` (FR-W3 and AC-W34 updated); and, for test fidelity, the lock ordered before FI-1, a
    consistent Explosive Concoction-on-Warrior fixture card, and a pre-supplied pick of a locked card
    ending the run `stopped`.
  - **Deviations accepted:** the unique search is the mechanic-mode query on the skill's name, because The
    Covenant's line is "Grants Skill: Level (1-20) Life Remnants"; a pre-supplied pick of any card the gate
    can't finalize ends the run `stopped`; R1b runs the lock first for every card.
  - **At the merge:** static and checker suites 543 of 543, and the checker exits 0 on all four good
    fixtures. WU-59's P1 check 6, `/build-guide Titan "Explosive Concoction" --offline`, is its run
    evidence (AC-W47).

**Amendment 4's units** (M-15; amendment 4 §15, D-361). Slice 02 holds WU-65…WU-68; these are slice 03's.
The DAG is the spine's §8: WU-64 starts at once; WU-69 follows WU-68, then WU-70 (also after WU-65) and
WU-71 in series, since they share `SKILL.md`, `check-run.mjs` and the pipeline tests; WU-72 runs last.

### WU-64: Spike: the per-run output counter
- kind: spike
- status: target (M-15)
- depends-on: []
- role: tooling
- touches: [`docs/build-guide/spikes/WU-64-output-counter.md` (new) and its counter script, whose path the report names; it reads run A's transcripts and a control's, and changes nothing else]
- produces: [the counter and its method; the decision whether it can back a budget AC; each agent's peak context]
- consumes: [run A's transcripts (WU-59); cost study 1 §3]
- acceptance: [AC-W51]
- milestone: M-15
- risk: medium: no ground truth (R-40)
- summary: Transcripts under-record output: a 60K-character Write is logged at 8 tokens, and run A's recorded
  1.78M was really about 2.3–2.5M, 63% of it thinking (cost study 1 §3). D-349's budget needs a reliable
  per-run counter before any budget AC relies on one (D-357). WU-72 measures the lean run with it.

### WU-69: V4, one pass
- kind: build
- status: target (M-15)
- depends-on: [WU-68]
- role: pipeline author
- touches: [`.claude/agents/build-guide/build-guide-verifier.md` (one pass, Write to `reports/` only); `references/stages/V4.md`; `SKILL.md`'s verification (steps 11 to 14, the revision); `references/source-markers.md` (the report); `tests/static/buildGuidePipeline.test.ts`]
- produces: [D-352's one pass, narrow re-checks over `--changed`'s set, triage and kept reports (§5.5, §7.4)]
- consumes: [D-351, D-352; `guide_run`'s views (WU-68)]
- acceptance: [AC-W52; AC-W59's static clause that `V4.md` defines the triage]
- milestone: M-15
- risk: medium
- summary: One V4 pass replaces the three lenses (D-268, NFR-23): it checks every hinge claim against its
  source and reads `guide.md` as an editor; the ledger's arithmetic is the checker's. Re-checks cover only
  `check-run.mjs --changed <n>`'s set, which WU-71 builds; reports are kept. It merges first of WU-69…WU-71,
  which share `SKILL.md`, `check-run.mjs` and the pipeline tests.

### WU-70: D1's split, the design gate, and the lean campaign and guide
- kind: build
- status: target (M-15)
- depends-on: [WU-65, WU-69]
- role: pipeline author
- touches: [`SKILL.md` (the design gate, D1's two steps, the per-step card; halved); `references/stages/` (`D1-build.md` and `D1-finish.md` from `D1.md`, with D-360's tree rule from `D1.md:112`; `D1-gate.md`; `D2.md`; `W1.md`; `R1b-assemble.md`; excerpts in every stage reference); `templates/` (the guide and dossier templates); `references/checkpoints.md`, `run-log.md`, `offline-and-test.md` and `task-header.md`; the agent definitions (batching); `tests/static/buildGuidePipeline.test.ts`]
- produces: [D-356's D1 split, per-step excerpts, batching and runner card; D-362's design gate in `SKILL.md` and the references, its display written by the D1 gate step into its verdict file (A-35); the round copy's step in `SKILL.md` (A-34); D-354's campaign in D2 and the guide template; D-358's anoint in D1-finish and the guide; D-359's socket estimate in the guide; D-353's survival label and Checks block; D-351's claim rule in the stage references; D-355's dossier as the comparison table]
- consumes: [WU-65's schema 3, `measures`, reference hits and key-figure lines; WU-69's V4; D-351, D-353…D-356, D-358, D-359, D-362; A-34, A-35]
- acceptance: [AC-W53; AC-W59's static clause that `D1.md` and `D2.md` recompile only for gear, tree, gems or config; AC-W60's static clause]
- milestone: M-15
- risk: high: the largest text change (R-42)
- summary: The text of amendment 4's pipeline: D1 in two steps, the design gate between the D1 gate and D2,
  the campaign per act without defences or crafting, the anoint, the socket estimate once, the survival
  label and rendered Checks block, the dossier reduced to the comparison table, and stage references that
  state their rules instead of pointing at whole files or bare D-numbers. D2 splits only if the lean run
  shows it past the peak-context target (D-357).

### WU-71: The checker and scripts
- kind: build
- status: target (M-15)
- depends-on: [WU-70]
- role: pipeline author + test infra
- touches: [`scripts/check-run.mjs` (`--changed`, the `design` gate, the new checks: `[ledger]` over the plan's current formulas, the floor's codes and the verdict line's hits from the record's compiler-written hits, FR-W7 (2) and (3); and A-34's round copy if it is `--snapshot`); `scripts/render-audit.mjs` (new); `scripts/run-log.mjs` (new); `tests/unit/buildGuideCheckRun.test.ts`; `tests/fixtures/pipeline/` (rebuilt for plan schema 3 and the design gate); `tests/static/buildGuidePipeline.test.ts`]
- produces: [FR-W7's target checks; `--changed <n>` (D-352); the audit render and its Checks blocks (D-355); the run-log script (D-356); the `design` checkpoint's checks (D-362)]
- consumes: [WU-70's text; WU-65's record `measures`, compiler-written reference hits, ledger-free `buildSha1` and schema 3; D-351…D-353, D-355, D-356, D-362; A-34, A-35]
- acceptance: [AC-W54, AC-W55; AC-W59's and AC-W60's checker clauses]
- milestone: M-15
- risk: medium
- summary: The checker and the runner's two new scripts. `--changed <n>` lists the claims whose text, source
  or cited record values changed since `rounds/<n>/`, and the changed guide H2s. WU-65's projection leaves
  the ledger out of `[record-plan]`'s sha1, and `[ledger]` evaluates the plan's current formulas, so a
  ledger-only edit after the final compile passes and a gear edit still fails. The floor and the verdict
  line read the reference hits the compiler wrote (D-353).
  The runner makes the `rounds/<n>/` copy with a script on its Bash list, without reading the files
  (A-34).

### WU-72: The lean recorded run
- kind: build (recorded run)
- status: target (M-15)
- depends-on: [WU-64, WU-65, WU-66, WU-67, WU-68, WU-69, WU-70, WU-71]
- role: build coordinator, with an independent verifier checking the record
- touches: [the work-log only; temp dirs and a worktree. Failures re-open the owning unit]
- produces: [the M-15 record]
- consumes: [everything in this slice and slice 02's M-15 units; WU-64's counter]
- acceptance: [AC-W56, AC-W57, AC-W58]
- milestone: M-15
- risk: high: the budgets may miss (R-41)
- summary: WU-59's procedure (§12) for run A alone (D-361): run A's brief and answers, `brainstorm`
  `["first-n:2"]`, `verification` `["first-viable"]`, `design` `["accept"]` (D-362) and `final`
  `["revise:<R>", "accept"]` with run A's claims-only `<R>`, which exercises the narrow re-check; offline,
  with no injected faults, so run A minus its faults (3.6M cache read) is the baseline. WU-64's counter
  measures its output.

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
  - Since WU-62 (D-283, D-281; behaviour tests in `buildGuideCheckRun.test.ts`), new broken copies: (v)
    `guide.md` over 3,000 words (the H1, the import code and the Known issues list not counted); (w) a
    marker in `guide.md` (`[^`, `confidence H|M|L`, or a finding id), outside the import code's fence only;
    (x) a rung's verdict line missing, or a part not matching the record by the rounding rule; (y) `m`'s
    budget above 5.5, or above 5 without "near the ceiling", and `m`'s floor; (z) `audit.md` missing one
    of its H2s (amended by D-355 (v1.5; *target*, WU-71): `audit.md` is held to the script's render,
    AC-W55). Amended: (b) checks the reader layer's 14 H2s; (l) checks Known issues by sentence, with
    the id in `audit.md`; reward picks are checked by name.
  - Since WU-58 (merge `3ffd7d0`; D-287, D-289, D-294, D-326, D-338, D-339, D-341; behaviour tests in
    `buildGuideCheckRun.test.ts`, with `run-ok-v2` a fourth passing fixture, the old `run-ok` held to the
    schema-2 log rules): (aa) a run log whose `schemaVersion` is neither 2
    nor 3, or a schema-3 log whose `roll` is set before the verification pick; (bb) the caps: a brainstorm round with
    more than 3 R1a entries or more than one R1a-assemble, a verification round compiling more than 3
    cards, while a second verification round from one deck passes; (cc) the escalation answer
    `checkpoint-1` (now `verification`); (dd) the verdict line's "Effective HP about <n>." missing, wrong or
    mis-rounded against `TotalEHP`; (ee) the D1 gate recompute reads figure × count; (ff) (D-338) the
    layout: the checker accepts `probes/<card-id>/<n>/` (a probe's `plan.json`, with the record and XML
    the server writes beside it), the cards (`cards/<id>.md`, which §2 names too) and `cards.md`, and
    rejects any other file there; and the run log records each card's probe count (`probes`), so D-292's cap
    of 4 probes per card can be audited. As built, also: a short round without its `shortReason` (D-339);
    a retry, or a finalization, of a card whose R1b failed `not-a-skill` or `wrong-ascendancy` (D-334,
    D-342); a final gate's answer that doesn't match the end status (accept → `completed`, a default `stop`
    → `stopped`, any other answer → `not-accepted`); an escalation answer that doesn't match its
    escalation's `choice`; a card file for a round that never ran; and a schema-2 log carrying a
    schema-3-only field (D-341).
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
  *Withdrawn → D-335:* the target clause for a set N of poe.ninja tools that the researcher's and the
  coordinator's `tools:` lines could name. There is no set N; R-2…R-4 as built already confine group
  `ninja`'s one tool, `get_currency_rates`, to the coordinator's P.
- **AC-W6.** *Withdrawn → D-267:* the research-workflow harness test.
- **AC-W7.** *Withdrawn → D-267:* the research-workflow harness test of R1b failures.

**Design steps (WU-45)**

- **AC-W8.** *Withdrawn → D-267:* the design-workflow harness test of the happy path.
- **AC-W9.** *Withdrawn → D-267:* the design-workflow harness test of the D1 gate table.
- **AC-W10.** *Withdrawn → D-267:* the design-workflow harness test of the D2 gate and FI-2/FI-3.
- **AC-W11 (WU-45; changed by D-268; amended by WU-62, D-276).** Static: `templates/guide-template.md` has
  §8's 14 H2s of the reader layer in order, the same list the run checker holds, under one H1 naming the
  roll; the H3 `Checks` under each of the three endgame H2s; and `### Known issues` as the last part of
  `What PoB can't show`. Each section states §8's word budget (the test reads §8's table from this slice).
  The writer definition satisfies §4 (AC-W5 extended). (Before WU-62: 13 H2s, with `Known issues` ending
  `Confidence and what PoB can't model`.)
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
  always. Before WU-57 the definition and its test stated the earlier rule ("for a lens that raised a
  finding"); WU-57 aligned both. *Target (WU-69, D-352):* the verifier has Write, limited to `reports/`,
  and writes its own numbered report `reports/V4-<n>.md`, never overwriting one, so the definition states
  that in place of "no Write" and "the runner writes"; AC-W52 restates the rest for one pass.
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
  start: AC-W42, A-33.)
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

**Content (WU-56; built, merge `228bec1`; D-290, D-291, D-292)**

- **AC-W27 (WU-56).** Static: `templates/card-template.md` holds both halves' fields (§7.5) and the six
  status words. Since WU-57 (D-335), the template and the test take §7.5's restated Evidence (the user's
  `popularity` notes or "no player evidence") and "players use it (the user's notes)"; before it the test
  pinned the poe.ninja strings.
- **AC-W28 (WU-56).** Static: each `references/patterns.md` entry has its name and shape, search step, how
  PoB follows it (one of the six labels), examples and cautions; the brainstorm questions open the file; and
  the file is at most 6,000 words (D-325).
- **AC-W29 (WU-56).** Static: `references/stages/R1b.md` lists the eight checks of §7.7, the result words
  "verified, estimate, risk, not checked", and the probe budget of up to 4 one-stage measure-only variants
  per card, in order.

**The pipeline (WU-57; built, merge `66362d0`; D-285, D-287, D-295, D-297, D-335)**

- **AC-W30 (WU-57).** Static: `SKILL.md` gives the invocation
  `/build-guide <free text> [--offline [--test <path>]] [--no-ninja]` and the eight brief fields (the seven
  of D-285 and D-335's `popularity`), and still accepts `<ascendancy> <skill>`.
- **AC-W31 (WU-57).** Static: `SKILL.md` names the gates `brainstorm`, `verification` and `final` and the step
  `R1a-assemble` (type `build-guide-coordinator`), and `references/stages/R1a-assemble.md` exists.
- **AC-W32 (WU-57; pinned at its first step, A-33).** Static, `buildGuidePipeline.test.ts`, each file's text
  folded (line breaks to spaces):
  - (a) D-122 as D-295 words it, "The build's named damage source is the main source of damage, never a token
    role.", is in `references/stages/D1.md`, `references/gates.md` and `build-guide-coordinator.md`; D-148's
    "The named damage source should be the clear skill. It takes the single-target role only when it can't
    clear, and the guide says so." is in `D1.md`.
  - (b) "named damage source" is in `SKILL.md` and the stages that apply the rule: `R1a`, `R1a-assemble`,
    `R1b`, `R1b-assemble`, `D1-gate`, `D2`, `W1` and `V4` (`references/stages/<stage>.md`).
  - (c) No `.md` under `.claude/skills/build-guide/` or `.claude/agents/build-guide/` matches
    `/rolled[ -](main )?skill/i`. Identifiers stay (`rolledGroup`, the part `rolledSkill`, the `rolled-*`
    codes; D-295), and so does "the roll" (C-31's `roll`, D-286).
  - Each (a) and (b) phrase is a `toContain` per file; (c)'s `<file>: <match>` offender list equals `[]`.
- **AC-W33 (WU-57; restated by D-335).** Static: `SKILL.md` and the researcher's and coordinator's
  definitions say: never contact pathofexile.com or poe.ninja yourself, and there are no poe.ninja tools
  beyond the currency rates; no researcher's allowlist names a group-`ninja` tool; R-3 holds for C and P.

**Offline end-to-end run with an open brief (WU-59; pinned at its first step, A-33; recorded).** Recorded checks on the
sessions of WU-59's procedure (§12: P1 and run A; runs B and P2 dropped by D-361, so AC-W45 and AC-W46 are
withdrawn and the run-B clauses of AC-W37 and AC-W49 too), re-checked by an independent verifier. Each
criterion ends with its evidence: the run folder, the run checker, the transcripts (each session's and its
subagents') or the coordinator's review. Numbers come from the run folder, never from a transcript's prose.
*(quality)* marks a quality clause, handled as WU-47's are (§12, WU-47).

- **AC-W34 (run A: the brief; C-51, D-285, D-289).**
  - `run-log.json` has `schemaVersion: 3`, `mode: "offline"` and `testConfig: "accepted"`. Its `brief` has
    `skill: "Explosive Concoction"`, no `ascendancy`, and in any other field only text the command gave.
  - The slug is `open-explosive-concoction`. `roll` is `null` until the verification gate's pick, and then
    `{className: "Ranger", ascendancy: "Pathfinder", skill: "Explosive Concoction"}`.
  - Before `guide_run {new_run}`, the runner checked the skill with `lookup_game_data {mode: "gem"}`. Its only
    `pob2` calls in the run are that check, `get_classes`, the ascendancy lock's lookups
    (`search_tree_nodes {query: "Grants Skill: <skill>"}` and the unique search, D-342) when a brief names both
    an ascendancy and a skill (this one names no ascendancy, so none), and `guide_run {new_run}` (FR-W3).
  - Evidence: run folder, transcript.
- **AC-W35 (run A: the deck narrows to Pathfinder, with the reason; D-286, D-287).** *(quality)*
  - Every card `cards.md` deals has the identity Ranger, Pathfinder, Explosive Concoction.
  - Each dealt card gives the reason: its Enabler or links table names the Pathfinder node that grants the
    skill ("Grants Skill: Explosive Concoction", node 38004, an option of "Brew Concoction"), with the lookup
    that returned that text and the status `confirmed in game text`.
  - No card naming another ascendancy is dealt: such a card is under "Not dealt", with the check that held it
    back.
  - Evidence: run folder (`cards.md`, `cards/`).
- **AC-W36 (run A: the deck; D-287, D-298, D-335, D-339).**
  - One brainstorm round: at most 3 R1a entries, each with its research file and 3 cards,
    `cards/r1-<letter>-<n>.md`, whose brainstorm half follows the card template; then one R1a-assemble.
  - `cards.md` deals 6–9 cards, at least two of them labelled `under-played (judgment: …)`, each with the
    `Under-played (judgment)` line in its pitch. Otherwise the R1a-assemble entry has a `shortReason`, and the
    brainstorm gate shows it (D-339).
  - Every card's Evidence says "no player evidence": the brief has no `popularity` notes (D-335).
  - Every "Not dealt" line names what held its card back.
  - Evidence: run folder, run checker (the deck rules).
- **AC-W37 (each gate shows what is and isn't verified; D-265 (b), D-296; run B's part withdrawn, D-361).**
  **Recorded: failed** in run A at `30abc7a`: both gates, answered `pre-supplied`, printed no display.
  Fixed at `96b1785` (WU-57's re-open). Its evidence now comes from the lean run (AC-W56, D-361). In the
  transcript, every gate visit prints its display before the answer it resolved to, pre-supplied and default
  answers included:
  - the brainstorm gate: the parsed brief; each dealt card not verified yet, with its links confirmed (`n of
    m`) and any under-played label; and "Not dealt", each card with the link no lookup confirmed or the check
    that failed;
  - the verification gate: each verified card's status (`viable`, `failed`, or "can't be finalized yet"), its
    Count-scaled figure, `Life` and `TotalEHP` from its record, the figure labelled `estimate` where its
    Count is above 1 or a custom modifier is present, its risks and what PoB can't verify, and the dossier's
    path. *Withdrawn → D-361 (run B's):* with no viable card, each failed card's last verdict; on a revisit
    after `infeasible`, that card's last verdict file;
  - the final gate: the guide, the PoB file, the gate verdicts, the known issues, the checker's result, that
    the guide is from an offline run, and that no rung can be claimed under budget while its prices are
    `unavailable` (D-164);
  - *Withdrawn → D-361 (run B's):* an escalation: the stage, the attempts and the verdict file.
  - Evidence: transcript.
- **AC-W38 (run A: verification within budget; D-272, D-292, D-331, D-338).** For each card `first-n:2`
  resolved to:
  - R1b attempt 1 fails on FI-1: its verdict names `FI-1 Unknown Gem`, lists FI-1 in `faultsApplied` and has
    `compiles: 1`. Attempt 2 runs uncounted and compiles, with `compiles` at most 2.
  - The card's verification half replaces every `Not checked yet.` line: Verified (`Life`, `EnergyShield`,
    the four resistances, each max hit, `TotalEHP`, and the Count-scaled figure with its group and stat set),
    Estimates, the eight checklist rows each `verified`, `estimate`, `risk` or `not checked`, a fallback
    ladder, and key-item prices `unavailable` (offline run).
  - Its probes are `probes/<id>/<n>/`, `n` from 1 to at most 4, each a one-stage plan with its measure-only
    record and XML beside it. The `probes` of its R1b entries add up to that number, and no probe wrote a PoB
    file. A probe whose compile failed is reported `not checked`.
  - `dossier.md` holds both cards, with `TotalEHP` among their key numbers.
  - Evidence: run folder, run checker (the layout and the probe count, AC-W2 (ff)).
- **AC-W39 (run A: Count and figure × count where they apply; D-293, D-294, D-296, D-321, D-340).**
  - Every plan group with `count` above 1 has a `countReason`, and every `config.customMods` entry has a
    `reason`: the final record's V1 passes, so there is no `missing-reason` finding.
  - The last D1 gate's `basis.rolledSkill` reads each figure Count-scaled, from `countedSkillOutputs`, where
    the field has a counted copy (D-340), and the checker's recompute agrees (AC-W2 (ee)).
  - Each rung's verdict line quotes the named damage source's Count-scaled figure and ends "Effective HP about
    <n>.", matching `TotalEHP` (AC-W2 (dd)).
  - `What PoB can't show` lists each Count above 1 and each custom modifier with its reason, and the guide
    calls any figure resting on them an estimate. With Count 1 on every group and no custom modifier, the
    first three clauses hold alone; the review records which case held.
  - Evidence: run folder, run checker, review.
- **AC-W40 (run A: the finalization; D-267, D-272, D-287, D-301).**
  - The verification gate's answer is `pick:<id>` with `rule: "first-viable"`: the first viable card. The
    run's `roll` becomes its identity.
  - `stages[]` after the pick: D1; the D1 gate, whose attempt 1 fails V1 on the stage FI-2 edited
    (`faultsApplied` names FI-2); D1 again, uncounted; the D1 gate passing within 2 counted retries
    *(quality)*; D2; the D2 gate with the final compile; W1; the three V4 lenses; the fix round and re-check
    when a finding is open (§5.5); then the revision and its verification (AC-W44 (a)).
  - D2 plans a bridge skill for each campaign stage before the first stage that allocates the Pathfinder
    node granting Explosive Concoction, and the guide's Leveling says what waits on that node (D-301).
    *(quality)*
  - Both final gate visits are `pre-supplied`, each with its `rule`, and `status` is `completed`.
    *(quality)*
  - `faults[]`: FI-1 applied twice (once per verified card), FI-2 once.
  - Evidence: run folder, transcript.
- **AC-W41 (run A: the artifacts; AC-W17 restated).**
  - `check-run.mjs` exits 0 on run A's folder after the run's last log write.
  - `guide_run {validate: <runFolderRel>/plan.json}` returns no error, and the final record's V1 and V2
    verdicts pass for every stage.
  - The temp builds folder holds exactly one file: the record's PoB path, named after `buildName`.
  - The import code round-trips: `encode_build_code` on that file equals the record's `importCode` and the
    guide's code, and decoding it gives one loadout per plan stage, each tree set titled by its stage's
    loadout name (D-180, D-215).
  - Every compiled card skeleton and probe has its record and XML beside its plan, and none wrote a PoB file
    (measure-only, D-208).
  - Evidence: run checker, a temp-dir probe of the worktree's server, run folder.
- **AC-W42 (run A: the reader layer; D-276…D-283, D-280).**
  - The checker's guards pass (AC-W41): the 14 H2s, at most 3,000 words, no markers, the verdict lines, the
    reward picks by name, and Known issues by sentence.
  - Each H2 of `guide.md` has at most 1.5 times its §8 word budget, and each Leveling H3 at most 110 words,
    counted as the checker counts words (the import code and the Known issues list not counted). The review
    records each count. *(quality)*
  - Each caveat appears once, where the reader acts on it, and is never later stated as settled (D-279). The
    review lists every caveat with its line. *(quality)*
  - Not a tutorial (D-280): every sentence about how the game or PoB works names something this build uses,
    needs or avoids, and changes what the reader does. The review lists each sentence that fails the swap
    test, and there is none. *(quality)*
  - Advice is in the first person, numbers are rounded as a guide rounds them, and there are no pipeline
    words (D-276). *(quality)*
  - Evidence: run checker, review.
- **AC-W43 (the coordinator's guide review; A-28; AC-W22 restated).** *(quality)*
  - The coordinator reads run A's `guide.md` against §8's table and records, per H2, whether it is present
    and complete.
  - It records whether a reader can follow the guide from level 1 to an endgame variant. That includes the
    bridge skills before Explosive Concoction arrives, the ascendancy trial and node that grant it, the switch
    to it, the named damage source as the main damage in `At a glance` and `How to play it` (D-295), and each
    rung's gate in, buy order and checks.
  - An `incomplete` re-opens the unit that owns that section's prompts: WU-62 for amendment 2's sections,
    WU-57 for amendment 3's additions.
  - Evidence: review.
- **AC-W44 (WU-47's exception E4, in a run).**
  - (a) **D-264's claims-only path**, in run A.
    - The revision: the final gate's first answer is `revise:<R>` (§12, WU-59). The runner sends it to D1
      as `findings` with `code: "user-request"`. D1 returns `recompiled: no` and is logged `claims-edited`.
      W1 follows with no gate between, then a full pass of the three lenses.
    - A fix round in either cycle whose owners didn't recompile logs its D1 and D2 `claims-edited` and runs
      no gate, and its re-check runs each lens that raised a finding plus the sources lens, and no other
      *(quality: whether the findings need no build change)*.
    - The run checker holds both (FR-W7 (4)).
  - (b) **D-265 (b)**: AC-W37, in run A. Run B's no-viable view and its revisit after FI-3 (WU-47's failing
    clause) went with run B (D-361); since run A failed AC-W37, the lean run carries this clause's evidence
    (AC-W56).
  - (c) **D-265 (c)**: run A's plan picks every campaign reward choice the campaign passes, with the same
    pick on every later stage, the endgame stages included, and `Campaign route and rewards` names each pick.
    Evidence: the checker's reward rule, and the review.
  - (d) **D-265 (d)**: after each cycle's step 14 (the first cycle's, and the revision's):
    - the guide's `Known issues` holds W1's lines for the accepted gate findings, then each open finding's
      `reader` sentence word for word, with no id and no line from the other cycle, or `None.`;
    - `audit.md`'s table has each open finding's id;
    - the transcript shows the runner replacing both lists with Edit, each cycle.
  - (e) **D-265 (e)**: every Bash command in the runner transcripts of P1 and run A (run B dropped, D-361) is either one of
    `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq` (alone, piped into one another, or after a `cd`), with
    no redirection, `tee`, writing flag or command substitution; or the run checker. No agent ran Bash.
  - (f) **D-266**:
    - run A's checker exits 0 with the revision's `claims-edited` D1 after the final compile: the record is
      still the last D2 gate's, and the plan's build projection hashes to the record's `buildSha1`;
    - on a copy of run A's folder whose `plan.json` has one equipped item's text changed (a build change made
      without a compile), the checker exits 1 with a `[record-plan]` violation.
  - Evidence: run folder, run checker, transcript.
- **AC-W45.** *Withdrawn → D-361 (run B dropped, Q6):* run B's failure routes: a second brainstorm round,
  no viable card under a persistent FI-1, FI-3's route back to the verification gate, and a D1 gate
  escalation answered by the default `stop`. The checker's fixture cases (AC-W2) still cover these routes.
- **AC-W46.** *Withdrawn → D-361 (P2 dropped, Q6):* P2, one seeded R1b step on a card whose damage source
  isn't a skill (Melting Maelstrom's mana nova): a `not-a-skill` verdict with no compile and the checklist's
  read-only checks. The checker's route around such a card stays covered by AC-W2's cases.
- **AC-W47 (P1: the brief check; D-238, D-258, D-285, D-342, D-343, D-344).** In P1, with the Agent tool
  denied:
  - `/build-guide Pathfinder "Explosive Concotion" --offline` stops, listing the closest active gem names in
    the lookup's order, Explosive Concoction among them;
  - `/build-guide "Pathfindr" "Explosive Concoction" --offline` stops, listing the closest ascendancies from
    `get_classes`, Pathfinder among them;
  - `/build-guide Pathfinder Fork --offline`, the fixed roll, stops and says Fork is a support gem: the fixed
    roll's second name is always `skill` (D-343, D-258);
  - `/build-guide Titan "Explosive Concoction" --offline` stops at the brief check and names the Pathfinder
    node that grants the skill, node 38004 (the ascendancy lock, D-342);
  - each of these four stops at the brief check, before any agent runs, and creates no folder under the
    guides root;
  - `/build-guide a Fork build, any ascendancy --offline`, a free-text brief, puts Fork in `around` and says
    it is a support gem (D-343). It writes its run folder and a run log with `around: "Fork"`, then stops at
    the first agent step with `status: "stopped"` (D-344), and no agent runs.
  - Evidence: transcript, the guides root's listing, the free-text brief's run folder.
- **AC-W48 (P1: refused test configs; A-28, D-157, D-323, D-344; AC-W4 restated).**
  - `/build-guide Explosive Concoction, any ascendancy --test A.json`, without `--offline`: the run log exists,
    with `schemaVersion: 3`, `mode: "online"` and `testConfig: "refused"`; the reply says the file was
    refused; no checkpoint is `pre-supplied`; and no `research/` or `cards/` file exists. The run then stops
    at the first agent step, `status: "stopped"`, no `stages[]` entry (D-344).
  - `/build-guide Explosive Concoction, any ascendancy --offline --test M.json`, a config holding the
    retired keys `checkpoint1` and `checkpoint2`: `testConfig: "refused"`, `status: "stopped"`, the reply
    names what is wrong, and no `research/` or `cards/` file exists.
  - Evidence: run folders, transcript.
- **AC-W49 (run A: NFR-22 and NFR-23, read as D-270 says, from run log 3; run B's part withdrawn, D-361).**
  - NFR-22: no `stages[]` entry has `priceOutcomes`, and every `prices[]` entry of every plan, skeleton and
    probe is `unavailable` with note `offline run`.
  - NFR-23, from `stages[]`: per brainstorm round, at most 3 R1a entries and one R1a-assemble, dealing 6–9
    cards or with a `shortReason`; per verification round, at most 3 cards in R1b; three lenses per V4 pass;
    at most 2 counted retries per gate and 3 counted R1b attempts per card (S6); and each card's `probes` at
    most 4 in all.
  - From the transcripts: at most 3 agents in flight, and no coordinator step overlapping another agent.
  - Evidence: run folder, run checker, transcript.
- **AC-W50 (all sessions: no network, and the write roots; D-177, D-181, D-201; AC-W16 and AC-W20
  restated).**
  - The recorded server env shows the procedure's settings, without secrets.
  - The transcripts, subagents included, hold no WebSearch, WebFetch or P-tool call, and no `/mnt/` path in
    any tool call.
  - `git status --porcelain` in the worktree is empty before and after the sessions.
  - Every file created under a temp guides root is inside a run folder of P1, run A or run B, or P2's seeded
    folder (runs B and P2 were dropped, D-361, so P1's and run A's). The temp builds folder holds only run A's
    PoB file.
  - Evidence: the environment's files, transcripts.

**Amendment 4 (M-15; target; WU-64, WU-69…WU-72).** Copied from amendment 4 §15, in its order; slice 02 holds
AC-P60…AC-P67, and slice 01 AC-K66.

- **AC-W51 (WU-64, D-357).** `docs/build-guide/spikes/WU-64-output-counter.md` names the counter and its method,
  runs it on run A and on a control with known output, agrees with complete usage records within 7% (cost study
  1's estimate error) or says why not, and decides whether it can back a budget AC. It also reports each agent's
  peak context.
- **AC-W52 (WU-69, D-352).** Static. `V4.md` and the verifier define one pass with no lenses, the re-check over
  `--changed`'s set, and `reports/V4-<n>.md`; a revision runs no full pass.
- **AC-W53 (WU-70, D-351, D-354…D-356, D-358, D-359).** Static. Stage references carry excerpts, not whole files
  or bare D-numbers; agent definitions batch calls; D1 is two steps. The templates have D-354's campaign items
  without defences, the anoint lines, the survival label and Checks block, no crafting, no Jeweller's Orbs for a
  tree-granted skill, and the socket estimate once; the dossier template is the table.
- **AC-W54 (WU-71, D-352).** Checker unit. After a claims-only edit and after a recompile moving one stage,
  `--changed` lists exactly the changed claims and H2s; a re-check missing one, or an overwritten report, fails.
- **AC-W59 (WU-69…WU-71, D-352).**
  - *Static:* `D1.md` and `D2.md` recompile only for gear, tree, gems or config, and `V4.md` defines the triage.
  - *Checker unit:* a ledger-only edit after the final compile passes `[record-plan]`, and a gear edit still
    fails it.
- **AC-W60 (WU-70, WU-71, D-362).**
  - *Static:* `SKILL.md` and `checkpoints.md` place the gate between the D1 gate and D2, with its display, four
    answers and default `stop`; `offline-and-test.md` documents `answers.design[]`.
  - *Checker unit:* reaching D2 without a `design` visit fails; these pass: `revise:`, then D1, the D1 gate and a
    second visit; `verification`, then the verification gate; answers run out, then `stopped`.
- **AC-W55 (WU-71, D-351, D-353, D-355).** Checker unit. A claim without a `kind`, an `audit.md` or Checks block
  differing from the script's render (Known issues aside), and a label disagreeing with `measures.arbiter` each
  fail.
- **AC-W56 (WU-72, D-361, D-362).** The lean run ends `completed`, the checker exits 0, and every gate visit,
  the design gate's included, prints its display (AC-W37).
- **AC-W57 (WU-72, D-349, D-357).** By WU-64's counter, output before the final-gate revision is at most 1M (a
  miss goes to the user); each agent's peak context (against 150K) and cache read per step are reported.
- **AC-W58 (WU-72, D-351…D-360).** At most 56 claims, each with a kind; `b` and `n` carry the measures, a
  matching label and an anoint, and `m` no anoint; no kill time, hits to kill or campaign defences; every stage
  passes `tree-shape`; every V4 report is kept.

**The ascendancy lock (WU-63; built, merge `e62799b`; D-342).** Written at the fold to match what WU-63 built
and tested; P1's check 6 is its run evidence (AC-W47).

- **AC-W61 (WU-63, D-342).** Static, `tests/static/buildGuidePipeline.test.ts` ("WU-63 (D-342)"):
  - `references/stages/R1a.md`, `R1a-assemble.md` and `R1b.md` each run `search_tree_nodes {query: "Grants
    Skill: <skill>"}` and the unique search (`lookup_game_data {mode: "mechanic", query: "<skill>", kind:
    "unique"}`) for every skill a card names, with the lock's rule (every granting node an ascendancy node,
    and no unique granting the skill), and each of those and `R1b-assemble.md` cites D-342 in its header;
  - R1a gives a locked skill's card the lock's ascendancy and says why, naming the node; R1a-assemble holds a
    card that breaks the lock under "Not dealt" with `wrong-ascendancy: <skill> is granted by …`;
  - R1b's lock is the identity check every card gets first, before FI-1 and the bootstrap compile; a card
    that breaks it writes no skeleton, compiles nothing, runs no checklist or probe and prices nothing, and
    its verdict is `compiled: "fail"`, one `wrong-ascendancy` finding per such skill; it is terminal and a
    plain failure, its status `failed`;
  - `SKILL.md` lists `search_tree_nodes` among the runner's tools for the brief check, runs the lock when a
    brief names both an ascendancy and a skill, and gives a failed lock's reason as the granting nodes, each
    with its id and ascendancy; FR-W3 and AC-W34 in this slice say the same;
  - `SKILL.md`, `references/run-log.md` and `checkpoints.md`: a `wrong-ascendancy` card is never retried, is
    `failed`, and can't be finalized, not even anyway; a test config that pre-supplies such a pick has given
    an illegal answer, and the run ends `stopped` with the `pick:<id>` as its `rule`.
- **AC-W62 (WU-63, D-342).** Checker unit, `tests/unit/buildGuideCheckRun.test.ts` ("D-342"), on a passing
  copy whose card, deck, dossier and verdict consistently name Explosive Concoction on a Titan:
  - it passes a run whose `wrong-ascendancy` card fails once, with no compile, while the round assembles,
    and a pre-supplied pick of that card that ends the run `stopped`;
  - it fails a pre-supplied pick of a card the gate can finalize that was turned into a stop, a retry of the
    `wrong-ascendancy` card, and the verification gate finalizing it, even as a failed card picked anyway;
  - the failure is terminal only with `compiles: 0`: a `wrong-ascendancy` finding after a compile still
    re-runs first.

## 14. Test strategy (this slice)

| AC | Class | Runs in |
|---|---|---|
| AC-W1, W5, W11, W12, W14 | static (pipeline files) | `mise run test` |
| AC-W2 | unit (the run checker spawned with an explicit env, over fixture run folders) | `mise run test` |
| AC-W23 | recorded probe, early in the unit | WU-43 |
| AC-W4, W15…W22, W26 | pipeline run (recorded; independent verifier) | WU-47 |
| WU-48 checklist | human (HG-14) | the user |
| AC-W27…W29 (WU-56, built) | static (pipeline files) | `mise run test` |
| AC-W30…W33 (WU-57, built) | static (pipeline files) | `mise run test` |
| AC-W2 (v)…(z) (WU-62, built) | unit (the run checker, rebuilt fixtures) | `mise run test` |
| AC-W2 (aa)…(ff) (WU-58, built) | unit (the run checker, rebuilt fixtures) | `mise run test` |
| AC-W34…W50 (WU-59, recorded; AC-W45, W46 withdrawn, D-361) | pipeline run (recorded; independent verifier) | WU-59 |
| AC-W61 (WU-63, built) | static (pipeline files) | `mise run test` |
| AC-W62 (WU-63, built) | unit (the run checker) | `mise run test` |
| AC-W51 (WU-64, target) | script check (the spike's report) | WU-64 |
| AC-W52, W53 (WU-69, WU-70, target) | static (pipeline files) | `mise run test` |
| AC-W54, W55 (WU-71, target) | unit (the run checker, rebuilt fixtures) | `mise run test` |
| AC-W59, W60 (WU-69…WU-71, target) | static and unit | `mise run test` |
| AC-W56…W58 (WU-72, target) | pipeline run (recorded; independent verifier) | WU-72 |

The checker's control-flow cases over fixture logs exercise every failure route deterministically and
offline, in place of the deleted workflow harness; run B of WU-47 drives every failure route live (D-267).
WU-59's run B, which would have driven the amended routes live (AC-W45), was dropped with P2 (D-361), so
the checker's fixture cases alone carry them.
The recorded runs prove that the real agents, tools and allowlists behave the same way. No test or run in
this slice contacts pathofexile.com, poe.ninja or D-171's hosts before M-13 (D-34, D-181); there are no
poe.ninja tools to test (D-335).

## 15. Open items and their resolutions

The first draft left these holes in the inputs open. The coordinator resolved each on 2026-10-07, and
the spine records the resolutions as binding decisions (D-231…D-238). The user settled D-210 (ask before
discarding unsaved work), D-219 (the budget tolerance) and D-234 (the survival floor gates chaos too, bar a
recorded exception) on 2026-10-08. D-231 also corrects C-36's wording on who may call lookups (§4, FR-W3).

| Id | Hole | Resolved by | Applied in |
|---|---|---|---|
| O-1 | "Ask for more" at checkpoint 1 (D-157) against the 3-concept cap (D-161, NFR-23) | **D-235:** the cap applies per research round; "ask for more" starts a new round of up to 3 concepts, only at the user's answer; rounds are read from checkpoint 1's `more` answers (D-270). Since WU-57 (D-287): 6–9 cards per brainstorm round, at most 3 per verification round | §5.2, §6, §10, FR-W7 (4) |
| O-2 | Checkpoint 2 offered no revision loop | **D-236, as D-267 and D-268 amend it:** the user may ask for changes; the runner maps each request to D1, D2 or W1 by the fix round's owners, runs that chain, then a full pass, the fix round and the re-check; revisions count against no retry cap | §5.6, §10 |
| O-3 | What the user can choose after an escalation (D-141 says only "escalates") | **D-236, as D-268 amends it:** gate escalations only; accept, with the failure stated in the guide; give guidance and retry once more; go back to checkpoint 1 (since WU-57, D-287: the verification gate); stop | §5.4, §8, §11.2 |
| O-4 | Offline, V4 can't open the URL of a claim copied from C1/E1 | **D-232:** such a claim cites its fact as `data:<file>#<key>`; V4 checks it against the data-file fact and its stored citation, without fetching the URL offline | §7.3, §7.4, §11.1 |
| O-5 | The tag of a price claim | **D-237:** `price:<id>`, citing the plan's `prices[]` entry by its `id`; the entry holds the date, league and query | §7.3, §7.4, §8, §9 |
| O-6 | Whether the survival floor's "capped resistances" (D-118) includes chaos | **D-234 (user, 2026-10-08):** all four resistances are gated at their caps; chaos may stay uncapped only through a stage's recorded `chaosResistException` | §5.3 floor, §8, FR-W7, AC-W2 |
| O-7 | An invalid roll (an unknown ascendancy or skill) had no defined behaviour | **D-238:** before any agent runs, the runner checks the ascendancy (`get_classes`) and that the skill is an active skill gem (a gem lookup); a failure stops with the closest valid names (D-258) and no run folder | FR-W2, AC-W26 |
| O-8 | `league` is required in every plan (C-31), but offline no tool reports it | **D-233:** `league` may be null only when every price is `unavailable` with `note: "offline run"`; the schema enforces it. **D-313, D-330:** an online run that can't reach trade writes `"league": "unverified"`; offline stays null | §9, §11.1 |

**The fold's gaps** (the F-n ids of the work-log's "Spec fold v1.3 (2026-10-10)"), as settled on
2026-10-10: F4 by the user, the rest by the coordinator (PROPOSED, binding until the user overrides them).
The last two rows of the first fold came after it: `--no-ninja` (D-333) and a non-skill card's identity
(D-334). The rows after them come from fold v1.4 (2026-10-11).

| Id | Gap | Settled as | Applied in |
|---|---|---|---|
| F1 | Amendment 2 was approved but not built | **D-317:** folded as target design, its pipeline work in WU-62, which merges before WU-57 and WU-58 | §8, §12 |
| F4 | No milestone for the new units; whether amendment 3's live run is WU-48 | **D-315 (the user):** milestone M-14, "open builds offline", exits when WU-50…WU-62 are merged and WU-59 is recorded as WU-47 was; WU-48 is the live run, depends on M-14 and exercises the amended pipeline, its trade gate unchanged | §12 |
| F6 | How parallel researchers name cards without collisions across rounds; whether the research files stay | **D-319:** card ids `r<round>-<researcher letter>-<n>` at `cards/<id>.md`, lettered by the runner; `research/p<k>-r1a-<n>.md` stays, and WU-57 removes it with a decision row only if it finds the files unused | §2, §5.1 |
| F12, F20 | No acceptance criteria for WU-59 (amendment 3's "like WU-47") or for the D-122 wording test | **A-33:** each unit's first step pins its criteria in this slice from the amendment's text, and the coordinator reviews them before any work; "like WU-47" means WU-47's recorded procedure with an open brief | WU-59 (AC-W34…AC-W50), AC-W32 |
| F13 | The final gate's test answers | **D-323:** `answers.brainstorm`, `answers.verification` and `answers.final`; `checkpoint1` and `checkpoint2` retire with run log v3 | §11.2 |
| F14, F15 | Who sets the popularity threshold for a deck's under-played cards; the poe.ninja tools' details | *Withdrawn → D-335:* D-324 made both outputs of spike WU-50, which found poe.ninja's builds API closed to third parties. There are no tools and no threshold; the under-played cards are the coordinator's judgment from the pattern library (D-298 restated) | §4, §5.2 |
| F16 | The pattern library's word cap | **D-325:** 6,000 words, counted by AC-W28's static test | §7.6, AC-W28 |
| F17 | Whether the checker still accepts schema-2 logs after v3 | **D-326:** both; schema 2 only so recorded runs (WU-47's) still check | FR-W7, §6, AC-W2 (aa) |
| F19 | Amendment 2's trade-link field | **HG-22** (PROPOSED by the coordinator): if the price tool returns a link, the user decides at WU-48 whether to add the field | WU-48 item 12 |
| F21 | The entering-maps rung in D-256's area-level tie | **D-327:** `m` follows the tie, at D-281's area level 69 (the coordinator's inference) | §5.3 |
| F27 | Where probe variants live | **D-331:** `probes/<card-id>/<n>/` in the run folder | §2, §7.7 |
| — | Whether `--no-ninja` also stops `get_currency_rates`, which totals budgets in divines | **D-333:** yes; the run calls no tool in group `ninja`, and price totals are then `unverified` (`references/pricing.md:88-89`) | FR-W1, §11.1 |
| — | How a card whose damage source isn't a skill passes the identity check at deck assembly, which needs a gem lookup showing `Kind: active` (amendment 3 says such a card can be dealt and verified, D-303) | Settled by D-334 (PROPOSED by the coordinator, 2026-10-10): checked by a lookup of the source's kind; read-only checks only until HG-21 | C-52, §5.2, §7.5 |
| — | poe.ninja's terms close its builds, profiles and character API to third parties (spike WU-50), so no player-evidence tool can be built | **D-335 (the user, 2026-10-10):** no player-evidence tools; cards cite the brief's `popularity` notes as user-supplied, or say "no player evidence"; the under-played cards are the coordinator's `judgment`; poe.ninja only through its economy endpoints | FR-W1, FR-W3, §4, §5.2, §7.5, §9, §11.1, AC-W5, AC-W27, AC-W30, AC-W33 |
| — | R1b's checklist writes probes and the card's results, but R1b's header `writes` don't name them and the checker rejects them | **D-338** (PROPOSED by the coordinator, 2026-10-10): WU-57 adds the paths to R1b's `writes`; WU-58 meets AC-W2 (ff) and logs each card's probe count | §2, §5.1, §5.2, §7.7, AC-W2 (ff) |

The rows below come from fold v1.5 (2026-10-11): the last units' reviews, WU-59, and amendment 4.

| Id | Gap | Settled as | Applied in |
|---|---|---|---|
| — | Nothing produced the deck's under-played cards (the WU-57 review) | **D-339** (PROPOSED by the coordinator): 3 cards per focus, at least one under-played; the deck keeps two, or the round is short with its `shortReason` | §5.2, §6, §7.5, AC-W2, AC-W36 |
| — | Which figure a compared field reads when Count is above 1 | **D-340** (PROPOSED by the coordinator): the counted copy where there is one, else the raw per-copy field, labelled "per copy" | §5.3, AC-W39 |
| — | Schema-2 logs can't keep WU-47's runs checkable once the artifacts follow WU-62's formats | **D-341** (PROPOSED by the coordinator): schema 2 means the schema-2 log rules only; `run-ok-v2` is their fixture | FR-W7, §6, AC-W2 |
| — | Nothing ties a card for a tree-granted skill to the ascendancy that grants it | **D-342** (the user's direction), WU-63: the ascendancy lock | FR-W2, FR-W3, §5.2, §7.5, §10, AC-W34, AC-W47, AC-W61, AC-W62 |
| — | A support gem named in free text slipped past the D-258 refusal into `around`; no rule for a missing Agent tool (WU-59's P1) | **D-343**, **D-344** (PROPOSED by the coordinator): the support gem goes in `around` and the fixed roll is two names by shape; steps 1 to 4 always run, and a missing Agent tool stops at the first agent step | FR-W1, FR-W2, AC-W47, AC-W48 |
| — | Run A's cost (296.2M cache read, 1.78M recorded output) and the issues the user found (anoints, support sockets, tree roots) | **Amendment 4** (accepted by the user, 2026-10-11): D-345…D-362, *target* for M-15 | §2, §3, §5, §6, §7, §8, §10, §11.2, §12, §13 |
| — | How the runner copies the plan, record and guide to `rounds/<n>/` (D-352), when it reads no plan and its Bash writes nothing (FR-W4, FR-W5) | **A-34** (PROPOSED by the coordinator, 2026-10-11): a script on the runner's Bash list (`check-run.mjs --snapshot <n>` or `scripts/run-log.mjs`) copies the three files without the runner reading them | FR-W4, FR-W5, §5.5, WU-70, WU-71 |
| — | Where the design gate's display (D-362) comes from, when the runner reads no plan or record (FR-W3, FR-W4) | **A-35** (PROPOSED by the coordinator, 2026-10-11): the D1 gate step writes it, compactly, into its verdict file, which the runner reads | FR-W4, §10, WU-70, WU-71 |
| — | D-360 changes `find_path_to_node` and `get_nearby_nodes`, two tool contracts outside C-37…C-50, which HG-12 reserves to the user | **HG-12, decided by the user** (2026-10-11): the acceptance of amendment 4, whose D-360 names both tools, is that decision; the spine's C-1 and HG-12 name D-360 | slice 01 §2.11, WU-66 |
