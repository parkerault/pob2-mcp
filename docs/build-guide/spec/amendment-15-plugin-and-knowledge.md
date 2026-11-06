# Amendment 15: the plugin layout, the shared rules and game knowledge

**Status: APPROVED, revision 1, 2026-11-06** (the user: "1. yes; 2. yes", the second approving this amendment with
§19's three recommended choices, §1). Revision 1 folds the independent review (§20: four lenses, two skeptical
verifiers, then a consistency pass on the fold; 66 raw findings, 15 material clusters, none refuted). The user's notes
of 2026-11-06 were added before approval (§1, §8, §11); they add no decision to this amendment's build.

The first amendment of the skill split. It formalizes the accepted design, `docs/design/2026-10-18-skill-split.md`
(cited [design]), for three things: the layout every piece of the split uses, the repository as a Claude Code plugin;
the rules every runner follows, in one shared file; and the first piece, game knowledge. Its sources:
- the user's words of 2026-11-04, quoted in §1;
- a read-only survey of the skill at `a8d735c` (2026-11-04, cited [recon]), and a survey of what a review of a bare PoB
  file can measure with today's tools (cited [survey]); each claim taken from them cites a file and line;
- checks of Claude Code's current documentation (2026-11-04, cited [docs] with the page), and a review agent's offline
  experiment, a `claude plugin validate` of Appendix A's files and a copied install under a throwaway config folder
  (§20, cited [experiment]);
- the gap analysis of the design against the skill today, and the user's answers to it (§19).

Deferred, by the user's direction (§1), to the split's later amendments (D-506): amendment 16, compile and the writer,
with a tool that reads a PoB file into a plan, and pricing; amendment 17, review, discovery and research; amendment 18,
the server packaged in the plugin, its setup, and the live test. Review was to come second; it moves to amendment 17
because its standalone checks need measures that exist only in a compile (§1, §18). Native Windows and macOS are
designed for and on the roadmap (D-506), not built. Amendment 14's deferrals stay deferred: charge generation, charms,
timeless jewels, tuning the trade pacing.

It is written against the project spine, `docs/spec/README.md`, folded through amendment 14. Paths are from the
repository root, which this amendment makes the plugin root (§4). Before it, the skill lives in
`.claude/skills/build-guide/` and its agents in `.claude/agents/build-guide/`; this amendment's text names the new
places (§4), except where it says "today". Decisions continue from D-499, work units from WU-145, criteria from AC-W114,
risks from R-113, gates from HG-37, contracts from C-57; the milestone is M-28. The plan schema and the server's tools
don't change.

**Names.**
- A **piece** is one of the design's seven parts of `/build-guide` that a player or an agent can use alone: game
  knowledge, discovery, research, review, compile, writer and pricing [design §2].
- The **plugin** is this repository as a Claude Code plugin named `pob2`; the **plugin root** is the repository root
  here, and the folder Claude Code installs it to elsewhere, `${CLAUDE_PLUGIN_ROOT}` in a skill's text [docs].
- A **root folder** is a folder at the plugin root (`skills/`, `agents/`, `data/`, `docs/`, `scripts/`, `src/`,
  `build/`, `vendor/`, `pob-api/` and the rest); a **root-relative path** starts with one:
  `skills/game-knowledge/SKILL.md`, `data/rules/nodes.md`.
- The **runner** is the session following a skill's `SKILL.md`: `/pob2:build-guide`'s as today, or a piece's.
- A **piece run** is a piece started by its own command on what the user brings, writing in its own folder (from
  amendment 16, D-506).
- The **shared rules** are the rules every runner follows, in one file every piece points to (§6).
- The **load check** is `claude plugin validate` and `claude --plugin-dir <tree> plugin details pob2` on a tree (§4).
- A step's **words loaded** are defined in §10.

## 1. The user's direction

- 2026-10-18, accepting the design: "I accept the suggestions in the skill split doc" (WL:4460–4462), with each of its
  §6 options: game knowledge first, the PoB-to-plan tool designed in the compile-and-writer extraction, packaging after
  two extractions.
- 2026-11-04: "I want to implement the skill split doc before doing anything else." Then: "I don't have a preference for
  skill split order; I won't be doing another run until it's all finished." (WL:6478–6479)
- On the gap analysis (§19): "All recommendations. Plugin layout now is good, since I want to be able to test it in
  other project directories to simulate how it would work when installed outside this repo."
- Then: "The point is not for the plugin to reach into this repo from another folder; the point is that it needs to work
  when distributed as a claude code plugin (I believe this can by done with a manifest in the repo root last time I
  checked). I don't know whether that performs a full checkout or not though."
- Then: "It's fine if it has an additional setup step after install. It could even be a section in the skill with
  instructions on how to install the dependencies, so we don't necessarily have to make everything scripted. We also
  have to consider running natively in windows and mac, but that can be deferred as long as it's taken into
  consideration and on the roadmap. For this iteration it just needs to work on this environment."
- 2026-11-06, on which pieces answer "how can I make this build better": "Yes" to two changes (game knowledge's
  description stops sending a PoB-file check to `/pob2:build-guide`, §8; review claims that question and names each
  finding's next step, §11). Then: "I imagine the most common use case will be users importing their game character to
  PoB, then pointing the skill at that file." (§11, amendments 16 and 17.)
- Then, on the review cases taken from Navira's PoB: "it's not common to cap resistances in the early campaign, since
  most enemies don't do a lot of elemental damage and gear is low level. The late campaign requires more resistances,
  but most characters can complete the campaign with uncapped resistances. I don't have a good heuristic for campaign
  resistance requirements. Capped resistances are nice to have, but it's not 100% necessary. The other two issues,
  overreserved spirit and too many gem groups, are most likely PoB issues since I see those in nearly every character
  imported directly from the game." And: "I want to make sure our skill's tests won't reject a build that works
  in-game." The file the user named, ResurrectForbidden, was read in the session (§11, amendments 16 and 17).
- 2026-11-06, approving: "1. yes; 2. yes; Regarding spirit buffs, it's common for characters to have multiple spirit
  gems that can't all be activated at the same time, and toggle them with weapon sets or as needed. We'll need the
  designers to be able to support that use case. Also, I want to start tracking PoB bugs we encounter in a document
  somewhere." The first answer agrees to amendment 16's recount (§11); the second approves this amendment with §19's
  three recommendations; the rest goes to amendment 16 (§11).

What follows from these:
- **The whole split before the next live run**, in four amendments (15 to 18, D-506): game knowledge; compile and the
  writer, with pricing; review, discovery and research; packaging. M-27's live test, WU-144, waits for the split's end.
- **Review comes after compile, not second as the design had it.** The user's answer to the gap analysis (§19, answer 5)
  has a review of a bare PoB file judge the pipeline's targets: the toughness band, the boss floor and the one-shot
  floor. Those are measured only inside `compile_stage`, on a plan: the band needs the non-budget rung, the engagement
  distance and the reference hits; the boss floor a named damage source and the boss pass; the one-shot floor the
  Pinnacle pass, the Arbiter's accuracy and the deflect pass; no server tool applies them to a file ([survey] §3). No
  agent type can load a file (`lua_load_build`); the coordinator can measure one only at its saved loadout, by a
  temporary load ([survey] §6). Amendment 16's tool that reads a PoB file into a plan gives review those measures, so
  review follows it. The user left the order to the coordinator (above).
- **The plugin is the distributable**, so the layout is the plugin's from this amendment on and no file moves twice. It
  reverses the design's "packaging after two extractions" for the layout only: packaging the server waits for amendment
  18.
- **This environment only** (WSL2, Ubuntu 24.04): nothing here is built for native Windows or macOS, but nothing makes
  them harder (D-506).

## 2. The skill today

From [recon] and the review (§20), at `a8d735c`:
- **Size.** 44 tracked files, 25,288 lines: `SKILL.md` (349 lines); 31 references (12 Markdown and 3 JSON files in
  `references/`, 16 stage references in `references/stages/`); 5 templates; 7 scripts (13,675 lines; the run checker,
  `check-run.mjs`, 7,356). Four agent definitions (410 lines) in a subfolder, `.claude/agents/build-guide/`.
- **The design's names have moved.** The deck step is `R1a-synthesize` (D-429); the endgame design is `D1-build`,
  `D1-tree`, `D1-finish`, `D1-gate` and `F1` (D-356, D-413, D-418); the guide has two templates (D-414), the audit
  render (D-355) and the notes (D-487). Pricing has no stage: it runs inside R1b, D1-build, D1-finish, D1-gate and F1.
- **The runner's rules are in `SKILL.md`:** its hard rules (28–89), among them the network rules, the trade stop, where
  it writes, the agent types and the Bash list, which names each script by its path (68–87).
- **Paths come in five forms.** Repository-relative (`.claude/skills/build-guide/…`: 282 occurrences in 78 tracked
  files); skill-relative (`references/checkpoints.md`, `scripts/run-log.mjs`: about 45 in `SKILL.md`, about 60 in the
  references and templates); relative to the file's own folder (`../gates.md`, and 68 link definitions in `patterns.md`
  written `../../../../docs/build-guide/…`); bare file names (`uniques.md`, `patterns.md`); and data-relative citations
  in plans (`campaign/progress.json#…`, by schema). 41 runnable command lines name a script by its path (`node
  .claude/skills/build-guide/scripts/…`: 9 in `SKILL.md`, 20 in `run-log.md`, 7 in `checkpoints.md`, 4 in
  `fix-round.md`, 1 in `run-folder.md`), and `SKILL.md` has bare forms (`run-log.mjs <runFolder> pricing`).
- **The scripts find the repository four folders up** (`check-run.mjs`:178, `run-log.mjs`:366, `render-audit.mjs`:81,
  `league-digest.mjs`:65, `rules-index.mjs`:53, `monster-mods.mjs`:36) and read `data/`, `pob-pin.json`, `vendor/` and
  `pob-api/` there; the checker reads PoB's `Data/` for its corruption and socket rules and passes those checks silently
  without the checkout (`check-run.mjs`:6418–6430); the checker and the audit render import the server's compiled
  `build/plan/` and name `pnpm build` when it's missing (`check-run.mjs`:2096, :7272; `render-audit.mjs`:359).
- **The data builders write their own path into committed data** (`data/rules/pairs.md`:3,
  `data/league/runes-of-aldur.md`:5, `data/monsters/monster-mods.md`:3), and `rules-index.mjs check` compares `pairs.md`
  byte for byte (`rules-index.mjs`:290–292).
- **No run folder names a skill path:** run logs and the 13 pipeline fixtures name none, so a moved skill resumes old
  runs. A gate question's report names its agent type bare (`stages/Q.md`:41), and the checker accepts only the bare
  names (`check-run.mjs`:5482–5485).
- **The tests pin the text heavily:** about 2,140 text assertions in the static tests, about 60 path constants in about
  40 test files, 27 more test files that name the location only by segmented joins (`path.join(REPO, '.claude',
  'skills', …)`), four that rebuild the repository at the old depth, and three location pins: every `references/`,
  `templates/` or `scripts/` path `SKILL.md` names exists (`buildGuidePipeline.test.ts`:181–188); `SKILL.md` lists every
  file in `references/` (:190–200); exactly four agent types, each ending "Started only by the build-guide skill's
  runner" (:341–349). Twelve static test files read a missing file as empty text, so a stale path fails a positive
  assertion loudly but passes a negative one silently.
- **Stage references state their rules as excerpts** (D-356; `references/stages/README.md`:26–29), not by pointing an
  agent at a shared file.
- **No way in for a PoB file the pipeline didn't make:** `compile_plan`'s `read_back` and `adopt` take only a file the
  server wrote for that plan (`src/plan/compiler.ts`:1889–1893). Users 3 and 6 of the design (a player improving an
  exported character; a player with only a PoB file) have no entry; amendment 16 adds it.
- **The server is registered for the user's whole account** (`README.md`:47, `claude mcp add pob2 -s user …`), so its
  tools are there in any project; it reads `data/` from its own package root (`src/plan/referenceData.ts`:178).

## 3. What Claude Code allows

The facts this layout rests on, from the documentation [docs] and the experiment:
- **A plugin can be a repository.** A `.claude-plugin/marketplace.json` listing one plugin whose `source` is `"./"`,
  with the same `name` as `.claude-plugin/plugin.json`, makes the repository both the marketplace and the plugin
  (plugins/publish). `claude plugin validate .` is the authoritative check of both manifests and the component files; it
  warns on a missing `version`, a missing marketplace `description`, a root `CLAUDE.md` ("not loaded as project
  context") and an unquoted `${CLAUDE_PLUGIN_ROOT}` in a shell-form hook (plugins-reference, plugins/publish). `claude
  --plugin-dir <tree> plugin details pob2` prints the plugin's skills, agents and hooks without installing it
  (plugins/cli-reference).
- **Installing copies committed files.** A plugin from a GitHub or git marketplace is copied to
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`; files above the plugin root aren't copied
  (plugins/loading). [experiment]: a copy holds the committed files only, with no `.git`, and keeps `bin/`'s executable
  bits. So an installed copy has no `build/`, `node_modules/` or `vendor/`. The dependency install runs only with an npm
  lockfile; it is skipped for `pnpm-lock.yaml`, this repository's (plugins/loading).
- **A local plugin loads in place.** A marketplace added from a local path, with a relative source, and `claude
  --plugin-dir <path>` load the folder in place, never copied; edits apply at the next session or `/reload-plugins`
  (plugins/loading, plugins/create).
- **Default component folders** at the plugin root: `skills/`, `agents/`, `commands/`, `hooks/hooks.json`, `.mcp.json`,
  `bin/`, `settings.json`; every other file sits at the root too (plugins-reference). Nested skill folders aren't
  documented. A plugin's agents load recursively, and each subfolder becomes part of the agent's name
  (`agents/review/security.md` is `my-plugin:review:security`, plugins/components). [experiment]: no stray component
  folder sits at this repository's root.
- **Names gain the plugin's prefix.** A skill named `build-guide` is `/pob2:build-guide`; the bare `/build-guide` also
  invokes it unless another command has that name (skills). Agent types are `pob2:<name>`, and "Claude sees `reviewer`
  and `my-plugin:reviewer` as two subagents" (plugins/create).
- **`${CLAUDE_PLUGIN_ROOT}`** is replaced in a skill's, command's or agent's Markdown body, in hook commands and in
  `.mcp.json`; it is not in the environment of a command Claude runs through Bash (plugins-reference). A file an agent
  reads with Read is not a skill body, so nothing replaces it there. After an automatic compaction, Claude Code
  re-attaches the start of each invoked skill, its first 5,000 tokens, already replaced (skills).
- **`bin/`** files are on the Bash tool's `PATH` while the plugin is enabled, after the user's own entries
  (plugins/components).
- **Hooks** in `hooks/hooks.json` merge with the user's and the project's; a plugin's copy of a handler and a settings
  file's copy both run (hooks). Hook commands get `CLAUDE_PLUGIN_ROOT` in their environment; a hook naming a path
  placeholder should use exec form or quote it (hooks, plugins-reference).
- **Reads outside the working directory** need the user's approval unless a rule or an added directory allows them
  (permissions); files Claude Code itself needs under `~/.claude/`, plugins among them, stay readable
  (settings-reference, `blockReadsOutsideWorkingDirectories`). In auto mode only the first read outside asks
  (permission-modes).
- **Skill descriptions share a budget** of 1% of the context window, the least-used dropped first when it's exceeded; a
  description and its `when_to_use` are cut at 1,536 characters (skills).
- **No skill calls another,** and no subagent can be tied to one skill, in anything documented (skills, sub-agents).

## 4. D-499: the repository is the plugin

The repository root becomes the plugin root of a plugin named `pob2`, which the repository also lists as its own
marketplace:
- **Manifests** (Appendix A). `.claude-plugin/plugin.json`: `name` `pob2`, a one-line `description`, `author`; no
  `version` until amendment 18, so an install from git follows the commit (plugins/loading).
  `.claude-plugin/marketplace.json`: `name` `pob2-mcp`, `owner`, a one-line `description`, and one plugin, `{"name":
  "pob2", "source": "./"}`.
- **Components, in the default folders at the root:**
  - `skills/build-guide/`: today's `.claude/skills/build-guide/`, moved, less game knowledge's six files;
  - `skills/game-knowledge/`: `references/patterns.md`, `references/lookups.md`, `references/source-markers.md` and the
    data builders `scripts/rules-index.mjs`, `scripts/league-digest.mjs` and `scripts/monster-mods.mjs`, moved straight
    from build-guide's folders (§8), and its `SKILL.md`; each later piece adds its folder;
  - `agents/`: the four definitions, today's `.claude/agents/build-guide/*.md`, flat, their names unchanged (a subfolder
    would become part of each type's name);
  - `hooks/hooks.json`: the compaction reminder (below);
  - `bin/`: the script commands (below).
- **Not components:** everything else stays where it is: `src/`, `tests/`, `docs/`, `data/`, `pob-api/`, the root's
  `scripts/`, `vendor/`. `data/` and `docs/` are inside the plugin root, so an installed copy holds them. The
  project-level `.claude/agents/agent-os/` and `.claude/commands/agent-os/` stay outside the plugin.
- **Commands.** `/pob2:build-guide` and `/pob2:game-knowledge`. Text that tells the user what to type uses the prefixed
  form (`/pob2:build-guide --resume <run folder>` and so on); the bare forms work too once the plugin is installed
  [docs].
- **Agent types.** `pob2:build-guide-coordinator`, `pob2:build-guide-researcher`, `pob2:build-guide-verifier` and
  `pob2:build-guide-writer`, in every place the runner reads a type to start an agent: the step table
  (`SKILL.md`:126–149), the gate question's routing (`references/checkpoints.md`:35–36), the agent-type rule and its
  example (`SKILL.md`:50, :94). Text the agents write into a run folder keeps the bare name (`stages/Q.md`:41's `-
  Agent:` line), so the checker and old runs are unchanged; `scripts/run-usage.mjs` strips an optional `pob2:` prefix.
- **The MCP server** stays the user's own registration, `pob2`, so its tools keep their names (`mcp__pob2__…`) until
  amendment 18.
- **`bin/`** holds four POSIX shell commands, `pob2-check-run`, `pob2-run-log`, `pob2-render-audit` and
  `pob2-render-notes`, each running its script with Node from the plugin root, resolved through symbolic links (Appendix
  A; a script's main-module guard compares its own path with the path it was started by, so an unresolved link would
  make it do nothing and exit 0, [experiment]). They need `node` on `PATH`. The runner's Bash list names them bare (§6).
  `docs/build-guide/run-settings.example.json` replaces its three `node .claude/skills/…` rules with the four `bin/`
  rules, `Bash(pob2-check-run:*)` and the others; render-notes is new there, though `SKILL.md`'s Bash list has run it
  since D-487. The data builders are maintenance commands, run with `node skills/game-knowledge/scripts/<x>.mjs` from
  the repository, with no `bin/` command.
- **The compaction reminder** (D-420) moves from the run settings' hook to `hooks/hooks.json`: a `SessionStart` hook
  with the `compact` matcher runs the root's `scripts/compact-reminder.sh`, its path quoted (Appendix A). The run
  settings example drops its hook, which would otherwise run beside the plugin's. WU-145 rewrites the reminder's
  numbered lines to match `SKILL.md`'s new forms (`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/SKILL.md`, `pob2-run-log
  <runFolder> display …`) and updates their pin (`buildGuidePipeline.test.ts`:3904–3917); WU-146 makes it print the
  absolute root and adds `runner-rules.md` and `/pob2:build-guide` (§6). Installed for the user's account, the plugin's
  agents and this hook are in every project's sessions; the reminder's text already says to ignore it when no run is in
  progress.
- **Removed:** `.claude/skills/build-guide/` and `.claude/agents/build-guide/`, so nothing loads twice.
- **The load check.** WU-145's agent runs it before deleting the old folders, and the gate's verifier runs it at
  WU-145's gate and at the milestone gate: `claude plugin validate <tree>`, which must exit 0 with no error and only the
  expected warnings (no `version`; the root `CLAUDE.md`), and `claude --plugin-dir <tree> plugin details pob2`, which
  must list `build-guide`, the four agent types and the `SessionStart` hook (and `game-knowledge` at the milestone
  gate). Until WU-147 writes its `SKILL.md`, `skills/game-knowledge/` holds only `references/` and `scripts/`; a warning
  about that folder is expected at WU-145's and WU-146's gates. The verifier records the output in the work-log; they
  are not Jest tests, because the `claude` binary isn't a repository dependency. If either fails, the build stops and
  asks the user (§19, choice 2).
- **The README** gives the two commands that install the plugin from a local checkout, says the plugin needs a set-up
  checkout (`mise run setup`) until amendment 18, and says how to turn it off in a project (`"enabledPlugins":
  {"pob2@pob2-mcp": false}` in its settings), and tells the user to drop the compaction hook from any launcher copy of
  the run settings, since the plugin now carries it.

Amends D-152 (the skill's location), D-267 (the runner follows `skills/build-guide/SKILL.md`; the agent types gain the
`pob2:` prefix), D-420 (the hook in the plugin's `hooks/hooks.json`, as D-420 foresaw), D-136, D-185 and HG-15 (the
plugin's layout and marketplace now; the server's packaging in amendment 18), the runner's Bash list (`SKILL.md`:68–87:
the `bin/` commands), and `CLAUDE.md`'s "Upgrading the PoB2 pin" step 7 (the data builders' path).

## 5. D-500: paths in a plugin

- **Skill and agent bodies** name plugin files as `${CLAUDE_PLUGIN_ROOT}/<root-relative path>`, which Claude Code
  replaces with the plugin root [docs]. Each `SKILL.md` says that a root-relative path in its references is under
  `${CLAUDE_PLUGIN_ROOT}`; each agent definition says it is under the task header's `root`.
- **The task header gains `root`**, the plugin root's absolute path, which the runner copies from its own `SKILL.md`'s
  replaced text (after a compaction, from the re-attached text, or else the reminder's, §6). Its `reference` becomes
  root-relative, `skills/build-guide/references/stages/<stage>.md`. The reference line becomes `Read
  <root>/skills/build-guide/references/stages/<stage>.md and do that step.` (`SKILL.md`:97–98), and the verifier's fixed
  prompt ends with the same line for `V4.md`, the runner putting in the header's `root` (`SKILL.md`:116–123).
- **References, stage references and templates** are read as plain files, with nothing replaced [docs]. Their paths to
  plugin files are rewritten root-relative: a repository-relative `.claude/skills/build-guide/…` becomes
  `skills/build-guide/…` or `skills/game-knowledge/…`; a skill-relative `references/…`, `templates/…`, `stages/…` or
  `scripts/<x>.mjs` becomes `skills/<piece>/…` (the root's own `scripts/run-usage.mjs` keeps its path); a path relative
  to the file's own folder (`../gates.md`, the `../../../../docs/…` links) and a bare name of a plugin file
  (`patterns.md`) become root-relative too. Paths in the user's run folder (`builds/<id>/…`), PoB's own paths
  (`Modules/CalcOffence.lua`) and plans' data-relative citations (`campaign/progress.json#…`, by the plan schema) are
  unchanged.
- **Command lines.** Every command a runner runs from a skill file, a reference or a template is a `bin/` command:
  `pob2-run-log <runFolder> …`, never `node …/scripts/<x>.mjs` or a bare `<x>.mjs <runFolder>`.
- **Scripts** find the plugin root from their own location, at the new depth; the checker and the audit render find the
  server's `build/` under the root, `BUILD_GUIDE_SERVER_BUILD` still overriding it. The data builders' output headers
  name their new paths; `data/rules/pairs.md` is regenerated (`rules-index.mjs join --write`, offline), and the digest's
  and the monster table's header lines are edited by hand (regenerating them would fetch poe2db). The comment at
  `src/plan/monsterMods.ts`:5 follows.
- **Old runs resume unchanged:** no run folder names a skill path (§2), so the skill revision stays 14.
- **Reads from another project.** Here the plugin root is the working directory, so agents read as today. Elsewhere it
  is outside it; the documentation keeps a plugin's files under `~/.claude/` readable [docs], and HG-37's check and
  amendment 18's live test confirm it (R-114).

Amends the task header (`references/task-header.md`: `root`, `reference`), the reference line and the verifier's fixed
prompt (`SKILL.md`:97–98, :116–123).

## 6. D-501: the shared rules

- **`skills/build-guide/references/runner-rules.md`** holds the rules every runner follows, moved from `SKILL.md`'s hard
  rules, under the headings Appendix A lists so a piece can name them: never `.env` and never `POESESSID`; the network
  (`SKILL.md`:31–32's rule, plus one new line, cited to D-497: poe2db.tw without asking, at the league digest's pace);
  the trade stop and telling the user before pricing (D-415, D-422, D-444, D-461, D-474); writing only inside the run's
  folder; agents only through the Agent tool, as one of the four types; the Bash list, with the `bin/` commands (§4).
  The web hosts D-171 allows stay in the agent definitions, where they are today. The legacy rule moves to game
  knowledge: the shared file points to `skills/game-knowledge/references/lookups.md`, which already states it (D-395),
  and WU-147 puts it in game knowledge's `SKILL.md` (§8).
- **The stray-file check** (D-474, `SKILL.md`:82) runs `git status --porcelain` in the session's working directory when
  that is a git work tree, and is otherwise skipped, said once at the start. Here that is this repository, as today.
- **Each piece's `SKILL.md`** tells its runner to read `runner-rules.md` whole before anything else, and again after a
  compaction. `/pob2:build-guide`'s `SKILL.md` keeps its pipeline rules (the gate display first, the interview, read
  only what routes the run, its own pob2 tools) and the compaction rule in its first 40 lines (D-420).
- **The reminder** (`scripts/compact-reminder.sh`) keeps `${CLAUDE_PLUGIN_ROOT}` in its source text, so its numbered
  lines still equal `SKILL.md`'s, and replaces it when printing with `CLAUDE_PLUGIN_ROOT`'s value or, when that is
  unset, the plugin root found from the script's own location. Its text names `/pob2:build-guide`, `runner-rules.md` and
  `pob2-run-log`.
- **Stage references keep their excerpts** (D-356): an agent reads its step's rules there, never the shared file. The
  design's "keep the rules in one place and have each piece point to it" [design §5] is met for the runners, whose rules
  were the ones in `SKILL.md` [design §3].

Amends D-356's leaner runner (the rules move out of `SKILL.md`), D-474 (the stray-file check's directory), the runner's
Bash list.

## 7. D-502: the agent types serve every piece

- **The four types stay** [design §3], in `agents/`, their names (prefixed, §4) and standing rules unchanged. Each
  description's last sentence becomes "Started only by a pob2 skill's runner with the Agent tool; never for other
  tasks." (the coordinator's keeps "one step at a time"). Their tools don't change.
- **The runners' step tables stay the guard** that an agent runs only its steps: Claude Code offers no way to tie a
  subagent to one skill [docs].

Amends D-267 (the types' wording).

## 8. D-503: the game-knowledge piece

**What it is.** How to reason about PoE2 builds: the pattern library, how to look things up, what counts as evidence,
what PoB gets wrong, and the legacy rule [design §2]. Other pieces read its files by path [design §3]; its own
`SKILL.md` serves a player or an agent asking a game question.

**Files.**
- `skills/game-knowledge/SKILL.md`, new, fewer than 150 lines (D-505).
- `skills/game-knowledge/references/`: `patterns.md`, `lookups.md` and `source-markers.md`, moved in WU-145, their text
  unchanged except paths. `source-markers.md` stays whole: its V4 report form (from :99) is review's, and stays here
  until review moves (amendment 17).
- `skills/game-knowledge/scripts/`: the data builders (D-400, D-401, D-402), moved in WU-145; `CLAUDE.md`'s pin-upgrade
  step 7 names the new paths.
- Not moved: `data/` (amendment 8 §12: facts stay in `data/`; it is inside the plugin root, §4) and
  `docs/build-guide/pob-gaps.md` (amendment 8 §12; the spec cites it by PG id).
- The checks on these files (`check-run.mjs`'s source tags and `data` citations, :839–1116) stay in build-guide's
  checker until amendment 16 sorts the checks by piece (§18).

**Its `SKILL.md`.**
- **Description:** when to use it (how a mechanic, gem, unique, passive or ascendancy works for a build; what is new in
  the league; whether PoB models something; what counts as evidence for a claim) and when not (designing a build from
  a brief: `/pob2:build-guide`; checking or improving a PoB file the player has: not yet a pob2 skill, as review comes
  with amendment 17, and never `/pob2:build-guide`, which starts from a brief; prices). Each later piece's amendment
  adds its command to this list (the user, 2026-11-06, §1).
- **How it answers:** in the session, with the lookup tools (`lookup_game_data`, `check_model_coverage`,
  `search_tree_nodes`, `list_gems`, `get_classes`), the committed data (the league digest, the rule-changer index, the
  monster table), the library's searches (Supply by family, A rule changer), PoB's gaps and the legacy rule, read with
  Read, Grep and Glob. Each claim carries a source tag from `source-markers.md`, and what it couldn't confirm is said
  once, with its fallback. A root-relative path in its references is under `${CLAUDE_PLUGIN_ROOT}`.
- **What it never does:** write a file, start an agent, change the engine's build, price, or fetch from the web beyond
  the scope the user picks (§19, choice 1: recommended, poe2db.tw only, at D-497's pace).
- It reads `runner-rules.md` first (§6).

**Its real cases** [design §4, "a test set per piece, from real misses"]. The coordinator asks each of a fresh
general-purpose agent, giving it the piece's `SKILL.md` text with `${CLAUDE_PLUGIN_ROOT}` replaced by the tree's
absolute path, and telling it to use only Read, Grep, Glob and the five lookup tools, with no web; the gate's verifier
checks its recorded tool calls.
1. "A cold spell build wants Infusions. What can supply them?" Expected: the search covers the whole Infusion family,
   and the answer names Powered by Verisium (`patterns.md`:585–600, Supply by family; the Varashta miss).
2. "Which Martial Artist ascendancy nodes change a standard rule a build could be built around, and does PoB model
   them?" Expected: Martial Master (61586), Runic Meridians (39552) and Way of the Stonefist (39595), each not modelled,
   Way of the Stonefist's glove transform cited to PG-36 (`data/rules/nodes.md`:229–238).
3. "Can a build use the gem Commandment?" Expected: no; PoB marks it legacy, and legacy means not in the game (D-395;
   the gem lookup says "Left out: Commandment, which PoB marks legacy", `tests/integration/ruleBreaks.test.ts`:95–99).

Amends D-395 (the legacy rule's home), D-400, D-401 and D-402 (the scripts' paths and their output headers).

## 9. D-504: the spec documents

- **One slice per piece, written current:** `docs/build-guide/spec/04-game-knowledge.md`, with the headings Scope, The
  contract (what it reads, what it writes, the rules it follows), Requirements, Acceptance criteria, Work units and Real
  cases; each later piece gets its own. The spine's §4.1 lists it, folded through this amendment.
- **The pipeline slice** (`03-pipeline.md`, folded through amendment 7) gains a note at the two sections the piece now
  holds, §7.3 "Source markers in markdown" (:1151) and §7.6 "The pattern library" (:1336), pointing to the new slice; 03
  shrinks to `/pob2:build-guide`'s order of calls as the pieces leave, by the split's end (§19, answer 3).
- **The spine** gains C-57 (the plugin's layout and paths, D-499, D-500) and C-58 (game knowledge's contract), and this
  amendment's rows under the fold rule (§13). Its §4.3 gains one line mapping the old skill and agent paths to the new
  ones, so a reader of the history can follow them.
- **Slices 01 and 02, and what is left of 03,** are folded at the split's end (amendment 18's last unit, D-506).

## 10. D-505: limits, and the words each step loads

- **`SKILL.md`'s size:** `/pob2:build-guide`'s is no longer than today's 349 lines at M-28, and under the user's 325
  (amendment 11) by the split's end; each piece's is fewer than 150 lines.
- **Words loaded.** For each stage reference under `skills/build-guide/references/stages/` (not its `README.md`), the
  words of: the agent definition that runs it (both for Q, which runs as researcher or coordinator), the stage
  reference, and each file under `skills/` or `agents/` the two name, resolved by §5's path rules. Files under `data/`
  and run-folder files are left out: agents Grep them, or they are one run's. A repository script,
  `scripts/words-loaded.mjs` (not a plugin component), prints the counts, failing on a name it can't resolve. The
  baseline is the same count at `a8d735c`, its file lists written in the new root-relative paths (the old ones mapped as
  §9's path line maps them), committed as `scripts/words-loaded.baseline.json`, one entry per stage (Q as `Q:researcher`
  and `Q:coordinator`). Each stage's count grows at most 5% above its baseline; a stage whose file list differs from its
  baseline's is printed with the difference, which the gate's verifier records, and doesn't fail.

## 11. D-506: the roadmap

- **Amendment 16:** compile and the writer, with a tool that reads any PoB file into a plan (the user's endgame kept as
  the top rung, the cheaper rungs and the campaign added, changes to the user's endgame only on request; its real cases
  from the private guide library's PoB files, read only, nothing copied into the repository); and pricing. The first
  piece run that writes its own folder comes here, so the run log's piece runs (a `piece` field), the checks sorted by
  piece [design §3] and the folder per use in the Guides folder (§19, answer 8) come with it. A piece's proof during a
  build runs on the build's own tree by replacing `${CLAUDE_PLUGIN_ROOT}`, as §8's real cases do, not through the user's
  installed copy, which loads the main checkout. The main case for a piece run on a player's own file is a character
  imported from the game into PoB (the user, 2026-11-06, §1). Open there: such a file is the character's state today,
  not an endgame, so "the user's endgame kept as the top rung, the cheaper rungs and the campaign added" doesn't fit
  it; and the tool's real cases need an imported character beside the guide library's files, because an import is one
  character's real gear (exact rolls, crafted and corrupted modifiers, runes, lines PoB may not read), where a guide's
  file is a planned build. Also here, from a character imported through poe.ninja and unmodified ("ResurrectForbidden",
  the user, 2026-11-06, §1; read in the session, nothing copied):
  - **PoB's gem-group count is wrong when a granted skill has supports.** A group counts toward the skill slots as soon
    as any enabled gem in it isn't granted (`Classes/SkillsTab.lua`:1570–1607), so a support placed in an item- or
    tree-granted skill makes the group count. The game doesn't count it: the character runs 10 gem groups on its 10
    slots (9, plus the Unset Ring's one) and also Spear Throw and Purity of Ice with supports, which PoB reads as 12.
    Turning off those two groups clears the warning. V1's `skill-slots` (D-428, "PoB's own count") then rejects a build
    the game allows, a pipeline build included, whenever its plan supports a granted skill (to be confirmed there).
    Agreed by the user (2026-11-06, §1): the bridge recounts by the rule this character shows (a group counts when its
    first enabled active skill isn't granted), as `ParseFixes.lua` corrects PoB's parse (D-492), and a PoB gap entry
    records it.
  - **An import holds each granted skill twice:** once from the game's skill list, with any supports, and once as PoB's
    own granted group (`Classes/ImportTab.lua`:1062–1078). The tool that reads a file into a plan keeps one.
  - **PoB's import turns every skill on** (`ImportTab.lua`:990); the game's on or off state isn't read. Spirit is
    reckoned below.
  - **The file is measured on its swap weapons:** it is saved with the second weapon set active, and the sceptre that
    gives 115 of its 215 Spirit sits there.
  - **More Spirit buffs than Spirit** (the user, 2026-11-06, §1): characters commonly carry Spirit gems that can't all
    be on at once and toggle them by weapon set or as needed, and the designers support it. By weapon set it can be
    planned today: a plan group carries `weaponSet` (D-418), and V1 reads PoB's Spirit warning on each set's measure
    (D-426). As needed it can't: open there, how a plan marks a buff kept in the guide but off in the measured
    loadout, with when to turn it on, how the guide shows it, and V1's Spirit check reading only the buffs on together.
  - **PoB's bugs are tracked** in `docs/build-guide/pob-gaps.md` ("PoB gaps and bugs", PG ids, each with `file:line`,
    the build that showed it and a workaround), the user's tracking document from 2026-11-06 (§1); PG-106 to PG-108
    hold the three findings above.
- **Amendment 17:** review, discovery and research. Review alone reads a PoB file the user names and reports what a
  player can fix, read only, with no pricing and no redesign (§19, answer 5): the server's checks (resistances against
  their caps, unreserved Spirit, PoB's skill-slot warning, unmet attributes, PoB's other warnings, as `get_build_issues`
  and `analyze_defenses` report them today, [survey] §2) and the pipeline's targets, measured by reading the file into a
  plan with amendment 16's tool and compiling it. Its main case is a character imported from the game into PoB (the
  user, 2026-11-06, §1). Its description claims "how can I make this build better" as its starting point, and its report
  ends each finding with the next step, such as a revise through compile or a pricing request (the user, 2026-11-06).
  The checks are read as the game plays them (the user, 2026-11-06): uncapped resistances in the campaign are a fact,
  not a flaw, as the pipeline's campaign plans none (D2); negative unreserved Spirit on an import is reported as which
  buffs together exceed the Spirit, since the game runs only what the Spirit covers and the import can't say which are
  off (ResurrectForbidden: Trinity 100, Charge Regulation 40 with Clarity I's 10, Herald of Ice 30, Wind Dancer 30,
  Combat Frenzy 30, Ghost Dance 24, so 254 against 215; each equals its gem's own cost, and no passive, jewel or item
  line on the character names Spirit or reservation beyond the sceptre); the gem-group count as amendment 16 corrects
  it. Its real cases are not the design's three flaws in Navira's PoB ([design] §2's order table and §4): the user ruled
  on 2026-11-06 that none is a flaw, since uncapped campaign resistances are normal and the Spirit and gem-group
  warnings are PoB's reading of an import. They come from imported characters, ResurrectForbidden among them, rebuilt
  from the game data as fixture files, as `granted-supports.xml` was, so nothing personal is committed; a review passes
  ResurrectForbidden without either warning. Open there, from [survey]: which agent type runs it (the verifier has no
  stats tool, and no agent may overlap a coordinator step, FR-W3, D-130); a file measured at its saved loadout under its
  own config (where it sets nothing, PoB assumes a Pinnacle boss and the −60% resistance penalty); the engagement
  distance the band needs (asked, or taken as D1-build takes it); the design's "sweep over every loadout in a file".
  Also open: which targets apply to a character below the endgame, since the targets exist only for the non-budget
  endgame rung (total EHP 20,000 close, 15,000 at distance; boss damage 250,000; 80% of the Arbiter's hits survived;
  `toughness-targets.json`, `boss-floor.json`); the drafter's suggestion is to show them as where the character is
  headed, not as failures.
- **Amendment 18:** the server in the plugin; a setup section in a skill with the steps to install the dependencies
  (Node, pnpm, luajit, the pinned PoB checkout, the build), which the user said needn't all be scripted; the fix HG-37's
  check calls for, if any; the machine paths in 33 tracked files scrubbed; the user's own registration retired; slices
  01 to 03 folded. Constraints it designs for: Claude Code's dependency install skips `pnpm-lock.yaml`; the scripts
  can't see `CLAUDE_PLUGIN_ROOT` or `CLAUDE_PLUGIN_DATA` in Bash, so a server build kept under `${CLAUDE_PLUGIN_DATA}`
  has to be passed to them (`BUILD_GUIDE_SERVER_BUILD` or an argument the runner fills from its replaced text); a
  plugin's server tools are named `mcp__plugin_pob2_<server>__<tool>`, so about 460 lines in 59 tracked files that name
  `mcp__pob2__` change; the server's config must not double as this repository's own `.mcp.json`; the checker needs the
  PoB checkout (§2); a user can't register two marketplaces of the same name, so the live test removes the local one
  first. Its live test is a real install from GitHub in another project directory, covering M-27's (WU-144, AC-W113) and
  each piece run alone.
- **Native Windows and macOS** (designed for, not built): the `bin/` commands and the reminder are POSIX shell, so each
  needs a twin (the hooks documentation's portable form is `node` with the script's path in exec form); luajit comes
  from mise here; the bridge starts `luajit` by name. Until then, the amendments add no POSIX-only dependency beyond
  these, and script code builds paths with Node's `path` (a proceed-on, §19).

## 12. Costs

The build is mostly mechanical: a move, path rewrites in about 80 files in five forms, about 60 path constants in about
40 test files plus 27 with segmented joins, the data headers, one new `SKILL.md`, a shared rules file, a counting script
and one slice document. Estimate: 2M to 4M subagent tokens, against 5.4M for the spine's fold, a documents job of
similar breadth. A run's own cost grows at most 5% per step (D-505).

## 13. Work units (M-28)

**The approval commit** (the coordinator's, before WU-145): this amendment's rows enter the spine as approved
(D-499…D-506, C-57, C-58, M-28, WU-145…WU-150, AC-W114…AC-W129, R-113…R-117, HG-37), with the old-to-new path line (§9),
and the spine's status line reads "Folded through amendment 15 (approved; as built through 14)", which
`tests/static/specSpine.test.ts` requires once the amendment reads APPROVED. The fold rule's text says so in its three
places: the spine's front matter, `CLAUDE.md`'s "The spine never falls behind…", and the handoff's "Every amendment
build" section (§19, proceed-on).

| Unit | Kind | What | Depends on | Decisions | Criteria |
|---|---|---|---|---|---|
| WU-145 | build | The move and every path: manifests; `skills/build-guide/`, game knowledge's six files and `agents/` moved; `bin/`; the hook and the reminder's numbered lines; §5's path and command rewrites in every skill file, the task header's `root` and `reference`, the verifier's prompt; the `pob2:` prefix where the runner reads a type, `run-usage.mjs`; the scripts' root; the data headers and `pairs.md`; `src/plan/monsterMods.ts`:5; `CLAUDE.md` (pointers, step 7); the README; the run settings example; the tests' paths, pins and temp layouts, and the old-path guard; the load check | — | D-499, D-500, D-503 (its file moves) | AC-W114…AC-W120, AC-W127 |
| WU-146 | build | The shared rules, the stray-file check, the reminder's printing and its other text, the agent types' wording | WU-145 | D-501, D-502 | AC-W121…AC-W123 |
| WU-147 | build | Game knowledge's `SKILL.md`, the legacy rule's move, its real cases | WU-146 | D-503 | AC-W124, AC-W125 |
| WU-148 | build | `scripts/words-loaded.mjs`, its committed baseline and test | WU-145 | D-505 | AC-W126 |
| WU-149 | docs | Slice 04, 03's notes, the spine as built (the status line's parenthesis dropped) | WU-147, WU-148 | D-504 | AC-W128 |
| WU-150 | human | After M-28 merges to `main`: the user installs the plugin from the main checkout and runs the read check (HG-37) | M-28's merge | D-499, D-500 | AC-W129 |

WU-145 is one unit: its gate passes only when the files and every path to them move together. WU-145, WU-146 and WU-147
run in order, each rebased on the last. WU-148 runs beside WU-146 and WU-147 and merges last of the build units, rebased
on WU-147, before WU-149; it owns only its script, test and baseline. A breach of the words-loaded bound at a later gate
is fixed by the unit whose text caused it.

**M-28's gate** passes when AC-W114 to AC-W128 hold, `mise run test` and `pnpm build` exit 0,
`scripts/fresh-clone-check.sh` passes, and the load check passes on the merged tree; the gate's verifier records each.
AC-W129 is recorded later, against M-28, at HG-37; until then the spine marks M-28 "built, HG-37 open".

## 14. Acceptance criteria (M-28)

- **AC-W114 (the layout; WU-145).** `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` exist with
  Appendix A's fields, the marketplace listing one plugin, `pob2`, with `"source": "./"`; `skills/build-guide/SKILL.md`
  exists; `agents/` holds exactly the four definitions; `.claude/skills/build-guide/` and `.claude/agents/build-guide/`
  don't exist; `bin/` holds exactly the four commands, each executable; `hooks/hooks.json` holds one `SessionStart` hook
  with the `compact` matcher that runs `scripts/compact-reminder.sh` under `${CLAUDE_PLUGIN_ROOT}`, quoted. Static test.
  And the load check (§4) passes, recorded by the gate's verifier.
- **AC-W115 (paths; WU-145).** In every file under `skills/` and `agents/`: every backticked path that starts with a
  root folder, after a leading `${CLAUDE_PLUGIN_ROOT}/` or `<root>/` is removed, resolves to an existing file or folder;
  no path starts `../`, `./`, `references/`, `templates/`, `stages/` or `.claude/`; no backticked bare name equals the
  name of a file under `skills/` or `agents/`; no command line runs `node …/scripts/<x>.mjs` or a bare `<x>.mjs
  <runFolder>`. `task-header.md` documents `root` and a root-relative `reference`; the reference line and the verifier's
  prompt have §5's form; `skills/build-guide/SKILL.md` says root-relative paths are under `${CLAUDE_PLUGIN_ROOT}`, and
  each agent definition that they are under the header's `root`. Run-folder, PoB-relative and data-relative tokens are
  left alone. No file under `skills/`, `agents/`, `data/`, `src/` or `tests/` names `.claude/skills`,
  `.claude/agents/build-guide`, `'.claude', 'skills'` or `'.claude', 'agents'`, except AC-W114's own test, which names
  the removed folders. Static tests.
- **AC-W116 (the pipeline unchanged; WU-145, held at every gate).** Every pipeline fixture gives the checker's result it
  gave at `a8d735c`; `mise run test` passes; the milestone's diff under `tests/` changes no assertion except in these
  classes, which the gate's verifier checks by reading the diff and records in the work-log: path strings and path
  constants; the location pins of §2; the `pob2:` prefix in agent-type names; `/build-guide` to `/pob2:build-guide`; the
  `bin/` command strings; the run settings' rule set, its dropped hook and its `#!/bin/sh` pin; pins moved with the
  rules' text to `runner-rules.md`; the reminder's sentences; link-resolution bases; the temporary repository layouts;
  the counts this amendment states (349, fewer than 150, four commands, four rules, four types).
- **AC-W117 (the commands; WU-145).** Run from a temporary folder outside the repository, with `bin/` and the folder of
  the Node running the test first on `PATH`, each of the four commands gives the same output and exit code as `node` on
  its script from the repository root: `pob2-check-run` on a passing and a failing fixture, `pob2-run-log <copy> display
  <gate>`, `pob2-render-audit <copy> --build <id>`, `pob2-render-notes <copy> --build <id>`; and `pob2-check-run`
  through a symbolic link to the `bin/` folder gives the same result. Unit test, spawning the commands.
- **AC-W118 (old runs resume; WU-145).** A copy of a pipeline fixture run (schema 4, `skillRevision` 14) resumes with
  `pob2-run-log <copy> resume '{"noNinja": true}'` and then passes the checker; the log's `skillRevision` stays 14. Unit
  test.
- **AC-W119 (agent types; WU-145).** Every agent type the runner reads to start an agent (the step table,
  `checkpoints.md`'s gate-question routing, `SKILL.md`'s agent-type rule and its example) is a `pob2:` type;
  `stages/Q.md`'s `- Agent:` line names the bare type; the checker's gate-question check is unchanged; `run-usage.mjs`
  names a step the same for `pob2:build-guide-coordinator` as for `build-guide-coordinator`. Static and unit tests.
- **AC-W120 (game knowledge's files; WU-145).** `patterns.md`, `lookups.md` and `source-markers.md` are under
  `skills/game-knowledge/references/` and differ from their `a8d735c` text only in paths (a test normalizes the paths
  and compares); the three data builders are under `skills/game-knowledge/scripts/` and their tests pass; their output
  headers name the new paths; `rules-index.mjs check` passes on `data/rules/`; `CLAUDE.md`'s step 7 names the new path.
  Static and unit tests.
- **AC-W121 (the shared rules; WU-146).** `runner-rules.md` holds Appendix A's headings, and under them these sentences,
  which `skills/build-guide/SKILL.md` no longer holds: "Never read, print or copy any `.env` file"; "Never contact
  pathofexile.com or poe.ninja yourself"; "No trade request after pricing stops, until the user approves a retry"; "Tell
  the user before pricing starts"; "Write only inside the run folder"; "Agents run only through the Agent tool"; the
  Bash list's opening sentence; it names D-497's poe2db line and points to `skills/game-knowledge/references/lookups.md`
  for the legacy rule. `skills/build-guide/SKILL.md` tells the runner to read the file before anything else and after a
  compaction, and keeps the compaction rule in its first 40 lines; the stray-file check reads as §6 says. Static test.
- **AC-W122 (the reminder; WU-146).** Run with `CLAUDE_PLUGIN_ROOT=/x`, `scripts/compact-reminder.sh` prints
  `/x/skills/build-guide/SKILL.md` and `/x/skills/build-guide/references/runner-rules.md`, names `/pob2:build-guide` and
  `pob2-run-log`, and prints no literal `${CLAUDE_PLUGIN_ROOT}`; run with it unset, it prints the repository's absolute
  root instead; its numbered source lines appear verbatim in `skills/build-guide/SKILL.md`'s first 40 lines. Unit and
  static tests.
- **AC-W123 (the agent types' wording; WU-146).** Each definition's description ends with §7's sentence; each type's
  tools equal `a8d735c`'s. Static test.
- **AC-W124 (game knowledge's `SKILL.md`; WU-147).** `skills/game-knowledge/SKILL.md` exists with fewer than 150 lines;
  its description names `/pob2:build-guide` for designing a build from a brief and says no pob2 skill yet checks or
  improves a player's PoB file; it tells its runner to read `runner-rules.md` first;
  it carries the legacy rule; it says root-relative paths are under `${CLAUDE_PLUGIN_ROOT}`; its web scope is the one
  the user picked (§19, choice 1). Static test.
- **AC-W125 (game knowledge's real cases; WU-147).** Each of §8's three cases, asked as §8 says, gets the expected
  answer with a source tag, and the agent's recorded tool calls are only Read, Grep, Glob and the five lookup tools; the
  questions, answers and tool calls are recorded in the work-log, where the gate's verifier checks them. A wrong answer
  is asked once more of another fresh agent; a second miss is fixed in the piece's files and the case asked again. M-28
  needs all three passed.
- **AC-W126 (words loaded; WU-148).** `scripts/words-loaded.mjs` resolves every name, compares each stage's file list
  and count with the committed baseline, and reports each stage at most 5% above it; its own test feeds it a stage with
  an unresolvable name and one over the bound, and expects both to fail. Its output on the merged tree is recorded in
  the work-log at the milestone gate.
- **AC-W127 (`SKILL.md`'s size; WU-145, held at every gate).** `skills/build-guide/SKILL.md` has at most 349 lines.
  Static test.
- **AC-W128 (the documents; WU-149).** `04-game-knowledge.md` exists with §9's headings; `03-pipeline.md`'s §7.3 and
  §7.6 carry the notes; the spine names C-57 and C-58 and this amendment's rows as built, its §4.3 holds the path line,
  and its status line reads "Folded through amendment 15"; `tests/static/specSpine.test.ts` passes. Static tests.
- **AC-W129 (the user's install; WU-150, after M-28).** The work-log records HG-37: the permission mode, and whether
  reads outside the working directories were already allowed; the plugin installed from the main checkout lists
  `/pob2:build-guide`, `/pob2:game-knowledge` and the four agent types; and, in a session started from an empty folder,
  `/pob2:game-knowledge` answers §8's case 3, and whether an approval was asked for a plugin file. A prompt goes to
  amendment 18 (R-114) and doesn't fail HG-37.

## 15. Migration and compatibility

- **Runs:** old run folders resume unchanged (§5, AC-W118). The user runs nothing until the split ends (§1).
- **The user's step** (HG-37): add the marketplace and install the plugin, once, after M-28 merges. Until then neither
  `/pob2:build-guide` nor `/build-guide` is available here; after it both are, and the text uses the prefixed form.
- **History keeps its paths.** The amendments, the work-log, the studies, the old spines and the handoff's sections of
  earlier milestones keep the paths they were written with; the spine's §4.3 maps the old paths to the new (§9).
- **The run settings example** replaces its three script rules with the four `bin/` rules and drops its hook (§4). A
  copy the launcher made for an old run keeps the old rules and hook; the README tells the user to drop that hook from
  any copy, since the plugin now carries it.

## 16. Risks

| Id | Risk | Rating | Mitigation |
|---|---|---|---|
| R-113 | Updating the tests' paths hides a weakened assertion, or misses a path a test reads as empty | medium | AC-W116's classes, read by the gate's verifier; AC-W115's old-path guard over `tests/` |
| R-114 | Reading a plugin file from another project asks for approval | low | the documented `~/.claude/` exemption; HG-37's check; amendment 18's live test and setup |
| R-115 | The pob2 skills and agents, now in every project, crowd the description budgets, so the wrong one loads | low | short descriptions naming what each isn't for (§8); the README's per-project switch; amendment 18's live test watches for it |
| R-116 | A moved path in prose no test pins breaks a step | medium | AC-W115 resolves every root-folder path and bans the other forms |
| R-117 | Game knowledge's real cases pass or fail by chance | low | one retry with a fresh agent; a second miss is fixed and re-asked (AC-W125) |

## 17. Operational guardrails and human-decision gates

- **HG-37: the user's install and read check** (WU-150), after M-28 merges to `main`, from the main checkout: installing
  a plugin for the user's account changes their Claude Code settings, so the user does it, and an install from a
  worktree would break when the worktree goes. It doesn't block M-28's gate. Its result goes to amendment 18 (R-114).
- **The load check** runs the `claude` binary's `plugin validate` and `plugin details` commands at WU-145's gate and the
  milestone gate (§4); neither starts a headless session or changes settings. Their use waits on the user's yes (§19,
  choice 3).
- **HG-12:** no server tool changes in this amendment, so no grant.
- **Unchanged:** tests never touch the network (D-34); the trade, web, folder and `.env` rules; one full gate at a time,
  under the lock; builds in worktrees with signing off, finalized with the user (HG-8).

## 18. Departures from the user's answers

- **Review moves from this amendment to amendment 17** (answer 1 put it here). Answer 5's review needs the pipeline's
  targets, which only a compile measures (§1, [survey]); amendment 16's tool brings a PoB file into a plan, so review
  follows it. The user left the order to the coordinator (§1).
- **Answer 2's first step changes.** It was a spike proving the repository loads its own plugin folder, with a flat
  `.claude/skills/pob2-<piece>/` fallback. The spike becomes the load check in WU-145, run before the old folders go and
  at every gate after (§4); the fallback, which isn't a plugin and predates the user's "it needs to work when
  distributed as a claude code plugin", becomes "stop and ask" (§19, choice 2).
- **The checks sorted by piece, the run log's piece runs and the folder per use** come with the first piece that writes
  a folder, amendment 16 (D-506). The checks were a proceed-on the user saw ("One checker, each check tagged with its
  piece", with the gap analysis) and the design's "each piece keeps the checks on its own files" [design §3]; the folder
  per use is answer 8. Game knowledge writes nothing, so until amendment 16 its files' checks stay in build-guide's
  checker.
- **03 gains notes now and shrinks as the pieces leave** (answer 3: "03 shrinks to /build-guide's order of calls"), by
  the split's end.

## 19. The user's answers, the choices at approval, and proceed-on assumptions

**The gap analysis** (2026-11-04), each answered "All recommendations":
1. Three amendments for the pieces: 15 (layout and rules, game knowledge, review), 16 (compile and writer with the
   PoB-to-plan tool, pricing), 17 (discovery and research). Amendment 18 (packaging) followed from the user's later
   words (§1); review moved to 17 (§18).
2. The plugin layout from this amendment, its first unit a spike proving the repository loads its own plugin folder,
   with a flat `.claude/skills/pob2-<piece>/` fallback; the server's packaging deferred (then brought into the split as
   18). The spike and fallback changed (§18).
3. A new slice document per piece, written current; 03 shrinks to the order of calls; 01 and 02 folded at the split's
   end.
4. Each piece proven alone offline on committed fixtures during its build; the user's live test at the end.
5. Review of a bare PoB file: what a player can fix, the server's checks and the pipeline's targets; read only, no
   pricing, no redesign (amendment 17).
6. Compile on the user's own PoB: the endgame kept as the top rung, the cheaper rungs and the campaign added, changes on
   request (amendment 16).
7. The private library's PoB files may be read for the PoB-to-plan tool, read only, nothing copied (amendment 16).
8. A piece run writes in the Guides folder, one folder per use named by the piece, with a run log; never the user's file
   (amendment 16, §18).
9. `SKILL.md` under 325 lines by the split's end, each piece's under 150, words loaded per step within 5%.

**The choices at approval** (the review's; each with the recommendation first; the user took all three
recommendations, 2026-11-06):
1. **Game knowledge's web.** Recommended: poe2db.tw only, at D-497's pace. The run settings deny every other host D-171
   names (maxroll.gg, game8, poe-vault) and WebSearch (`run-settings.example.json`:38–46), and the user picks the guides
   agents read. The alternative is D-171's hosts, as researchers have.
2. **If the load check fails.** Recommended: the build stops and asks. The alternative is answer 2's flat
   `.claude/skills/pob2-<piece>/` fallback, which works here but isn't a plugin.
3. **The `claude` binary at the gates.** Recommended: yes, the gate's verifier runs `claude plugin validate <tree>` and
   `claude --plugin-dir <tree> plugin details pob2` (§4). Neither starts a headless session (`claude -p`) or changes the
   user's settings. The alternative is the user running them at each gate.

**The drafter's proceed-on assumptions** (each open to the user's change at approval):
- the plugin's name `pob2` and the marketplace's `pob2-mcp`; the default component folders at the root; skills and
  agents flat; the agent types keep their names, prefixed; no plugin `version` before amendment 18;
- the four `bin/` command names, in POSIX shell, resolved through symbolic links; the run settings allow all four; no
  command for the data builders;
- the shared rules in `skills/build-guide/references/runner-rules.md`, read whole by each runner; D-171's hosts stay in
  the agent definitions;
- the stray-file check in the working directory when it is a git work tree;
- the reminder kept in shell, its path quoted, with a Windows twin on the roadmap;
- `source-markers.md` whole in game knowledge until review moves;
- the words-loaded method (files under `skills/` and `agents/`, a committed baseline) and its 5% bound per stage;
- the three real cases and how they are asked;
- the approval commit moving the spine's status line, with "(approved; as built through 14)", and the fold rule's text
  saying so (§13): the plan the user approved ("never falls behind", a test that fails when it does) with the test's
  timing made consistent;
- no POSIX-only dependency beyond `bin/` and the reminder, and paths built with Node's `path`, until the Windows and
  macOS work (§11).

## 20. The independent review and its resolution

Four lenses, each told to find one class of problem in revision 0 and to cite a source for every finding: invented
decisions and unverifiable criteria (L1, 20 findings); fidelity to the repository (L2, 16); fit with Claude Code's
plugin system, checked against the live documentation and by an offline experiment (L3, 12); the work-unit graph and
completeness (L4, 18). 66 raw findings, 7 high, 31 medium, 28 low, in `scratchpad/a15/review/` (the coordinator's
session folder; not committed).

**The experiment** (L3, 2026-11-04): Appendix A's files and a root `CLAUDE.md`, checked with `claude plugin validate .`
(passed with warnings: no `version`, no marketplace `description`, the root `CLAUDE.md`, the unquoted hook path); and a
copied install through a scratch marketplace whose entry was a `file://` URL, under a throwaway `CLAUDE_CONFIG_DIR` (the
user's settings untouched): the copy landed in `plugins/cache/<marketplace>/pob2/<12-character commit>/` with the
committed files only, no `.git`, and `bin/`'s executable bit kept.

**Clustered** into 15 material clusters and 28 low findings. **Two skeptical verifiers**, told to default to refuted,
checked every material cluster against the repository, the spine and the documentation: 13 confirmed, 2 partly (the
split of WU-145, not shown to be needed; the claim that the scripts lack a clear error without `build/`, refuted), none
refuted. The coordinator checked each low finding against its source. Folded in this revision:
- **The load check** (K1): the spike answer 2 asked for, which revision 0 had dropped, now in WU-145 and every gate
  (§4); M-28's exit stated (§13); HG-37 after the merge, from the main checkout (§17); its choices (§19, 2 and 3).
- **The spine's status line** (K2): the drift test would have failed every unit's gate from approval; the approval
  commit now moves the line (§13).
- **One move for game knowledge's files** (K3): WU-145 moves them straight to `skills/game-knowledge/` (§4).
- **AC-W116's allowed test changes** listed by class, and an old-path guard over `tests/` (K4).
- **The five path forms and the 41 command lines** (K5): rewrite rules and a narrowed path criterion (§5, AC-W115).
- **The reminder** (K6): it printed `$CLAUDE_PLUGIN_ROOT` literally; it now prints the absolute root, keeping its source
  lines equal to `SKILL.md`'s (§6, AC-W122); the hook's path is quoted.
- **Game knowledge's real cases** (K7): how they're asked, a second correct answer to case 2 made the expected answer,
  the end condition (§8, AC-W125).
- **The run settings' four rules** (K8), **where the `pob2:` prefix goes** (K9), **the data headers** (K10), **the
  shared rules' new poe2db line and the stray-file check** (K11, with choice 1 for the user), **the words-loaded
  method** (K12), **criteria tagged by unit and the merge order** (K13), **amendment 18's constraints** (K14), and **the
  task header's `reference` and the verifier's prompt** (K15).
- The low findings: §2's counts; §3's facts on plugin agent subfolders and the `~/.claude/` read exemption; the bare
  `/build-guide` after install; the plugin in every project (R-115, the README's switch); D-136, D-152, D-185 and HG-15
  among the amended rows, and `CLAUDE.md`'s step 7 in place of C-6; all four commands in AC-W117, `node` on its `PATH`,
  and the symbolic-link case; "fewer than 150"; 03's notes; §18's attribution; the portability rule as a proceed-on.

**A consistency pass** on the fold (a fresh agent) found every cluster's fix in place and 14 inconsistencies the fold
made, all folded: the reminder's numbered lines move in WU-145 with `SKILL.md`'s (its pin needs them equal); the legacy
rule's pointer goes to `lookups.md`, which exists from WU-145; AC-W127 owned by WU-145; `cd -P` in the `bin/` commands
(tested); the words-loaded baseline in the new paths, Q's keys, a list difference reported; AC-W115 strips the root
prefix and checks the two path sentences; `stages/README.md` left out; WU-145's decisions; WU-148 before WU-149; who
runs the load check when; game knowledge's folder before its `SKILL.md`; the README's hook advice; AC-W129's pass
condition.

Cost of the review: lenses about 1.09M tokens, verifiers about 0.49M, the consistency pass about 0.15M.

## Appendix A. Formats

### `.claude-plugin/plugin.json`

```json
{
  "name": "pob2",
  "description": "Path of Exile 2 build tools over a headless Path of Building 2: build guides and game knowledge",
  "author": { "name": "Parker" }
}
```

### `.claude-plugin/marketplace.json`

```json
{
  "name": "pob2-mcp",
  "owner": { "name": "Parker" },
  "description": "The pob2 plugin: Path of Exile 2 build tools over a headless Path of Building 2",
  "plugins": [{ "name": "pob2", "source": "./" }]
}
```

### `hooks/hooks.json`

```json
{
  "hooks": {
    "SessionStart": [
      { "matcher": "compact", "hooks": [{ "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/compact-reminder.sh\"" }] }
    ]
  }
}
```

### A `bin/` command (`bin/pob2-check-run`)

```sh
#!/bin/sh
d=$(cd -P "$(dirname "$0")/.." && pwd -P)
exec node "$d/skills/build-guide/scripts/check-run.mjs" "$@"
```

### `runner-rules.md`'s headings

`## Never .env`, `## The network`, `## Trade and pricing`, `## Where you write`, `## Agents`, `## Your Bash`.

### The task header (changes)

| Field | Value |
|---|---|
| `root` | new: the plugin root's absolute path, as the runner's `SKILL.md` shows it after `${CLAUDE_PLUGIN_ROOT}` is replaced |
| `reference` | now root-relative: `skills/build-guide/references/stages/<stage>.md`, under `root` |

### `scripts/words-loaded.mjs`'s output

One line per stage (`Q:researcher`, `Q:coordinator`), with any file-list difference: `<stage> <words> <baseline>
<+n.n%>`, then `max <+n.n%>`; exit code 1 when a stage is more than 5% above its baseline, or a name doesn't resolve.
`scripts/words-loaded.baseline.json`: `{"<stage>": {"words": n, "files": ["<root-relative path>", …]}, …}`.
