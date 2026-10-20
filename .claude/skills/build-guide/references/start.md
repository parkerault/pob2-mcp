# Start: the brief, the run folder and the run log (step 1)

The runner's step 1 in full (slice 03 FR-W1, FR-W2; C-51; `SKILL.md` §1): read this once, at the start, and do it
in its order before any agent runs. A resume of an earlier run has its own order ("Resuming a run", below).

## The invocation and the brief

`/build-guide <free text> [--offline [--test <path>]] [--no-ninja]`. The free text is the **brief**: what the
user wants, in their words. The fixed roll `/build-guide <ascendancy> <skill>` still works, multi-word names
quoted (`/build-guide Titan "Blood Hunt"`): it is the brief `{ascendancy, skill}`. Multi-word names are
quoted, and an unquoted brief the gem lookup finds whole, such as `Blood Hunt`, is one name, a skill, so it
isn't a fixed roll. Counted so, a brief of exactly two names and nothing else is the fixed roll: the first is
always `ascendancy` and the second always `skill`, whatever the lookups find (D-343).

- `--offline` starts offline mode (`references/offline-and-test.md`): no web, no prices.
- `--test <path>` is a test config. It is accepted only with `--offline` (`testConfig: "accepted"`);
  without `--offline` it is refused (`testConfig: "refused"`), ignored, and you ask the user at every
  gate (D-157). No `--test`: `testConfig: "none"`.
- `--no-ninja` (D-333): the run calls no tool in group `ninja`, whose one tool is
  `mcp__pob2__get_currency_rates`. Tell every pricing step, the D1 gate included, to price without currency
  rates, so totals in divines are `unverified` (`references/pricing.md`). The run log records it as `noNinja`
  (D-412, D-420), and you read it there for every pricing step, never from memory: a compaction may drop it.
- `--resume <run folder>` and `--campaign <run folder> <id>` (D-415) go on with an earlier run instead of starting
  one: "Resuming a run", below.

**The brief** (D-285, D-335). Parse the free text into these fields, every one optional. Leave out a field the
text doesn't give, and never invent one:

| Field | Holds | Example |
|---|---|---|
| `ascendancy` | an ascendancy | Titan |
| `skill` | an active skill gem, or a command a summon's minion casts (D-379): the named damage source | Blood Hunt |
| `playstyle` | tags from the vocabulary below, plus free text | `melee`, `tanky`, "slow and heavy" |
| `budget` | `budget` or `non-budget` (the endgame variants), or a figure in divines | `budget` |
| `around` | an item, mechanic or support gem to build around | "Melting Maelstrom", "block", "Fork" |
| `like` | a reference build the user picked (a guide page, a video or a PoB file; offline, a local file) and what to change: one researcher writes a seed card from it (D-393) | "like the Eraser, but not Gemling" |
| `notes` | anything else | |
| `popularity` | the user's own notes on what players run, which cards cite as user-supplied | "Blood Hunt Titans are rare this league" |

- **The playstyle vocabulary** (cards use the same tags): delivery `melee`, `ranged-attack`, `spell`,
  `minion`, `totem-trap`, `mixed`; buttons `one-button`, `few-buttons`, `combo`; focus `clear`, `boss`,
  `balanced`; defence `tanky`, `balanced`, `glass`; pace `fast`, `steady`.
- **An empty brief** means "surprise me": the researchers start from the pattern library's families
  (`references/patterns.md`) and the coordinator's judgment of what is under-played.
- **A fixed roll** (a brief naming both `ascendancy` and `skill`) runs the same three phases, and every card's
  named damage source is that skill.
- **A support gem** the free text names as the build's subject goes in `around`, by its name as the lookup gave
  it, never in `skill` (D-343): only an active skill gem, or a command a summon's minion casts, is a `skill`.
  Step 1's gem lookup tells them apart.
- **Player evidence** comes only from `popularity`: no tool supplies it (D-335).

## In this order, before any agent runs


1. **Brief check** (D-238, D-285). Check each field that names an ascendancy or a skill, as a roll is
   checked:
   - `ascendancy`: call `mcp__pob2__get_classes`. The ascendancy must be listed (case-insensitive). Note its
     class.
   - `skill`: call `mcp__pob2__lookup_game_data {mode: "gem", query: <skill>}`. A result headed `## <skill>`
     (case-insensitive) must say `Kind: active`, or `Kind: minion skill` when no active gem has the name and
     exactly one summon casts it: count the distinct `<gem>`s that the `Cast by: <minion> (summoned by <gem>)`
     lines name across all the name's results, since one summon may print several lines (D-379). Note that
     summon. A support gem, no such result, or a minion skill several summons cast fails.
   - a name the free text gives as the build's subject (D-343): look it up this way before you place it. A
     gem the lookup finds as a support goes in `around`, by its name as the lookup gave it, and the run goes
     on: say it is a support gem, and that the researchers will look for skills it can support. An active gem,
     or a minion skill that passes as above, goes in `skill`. An item or mechanic (Melting Maelstrom, block)
     isn't a gem: it goes in `around`, and a gem-lookup miss never stops it. Only a name the user gives as the
     build's skill, which the lookup misses, fails here. The fixed roll's second name is always `skill`, so
     there a support gem fails: `/build-guide Pathfinder Fork` stops with "Fork is a support gem".
   - both, once each passes: **the ascendancy lock** (D-342). Call `mcp__pob2__search_tree_nodes {query:
     "Grants Skill: <skill>"}` and `mcp__pob2__lookup_game_data {mode: "mechanic", query: "<skill>", kind:
     "unique"}`. The ascendancy can't use the skill, and the check fails, when a node grants it (its stats
     list `Grants Skill: <skill>`), every such node is an ascendancy node (an `Ascendancy: <name>` line), none
     of them the brief's ascendancy, and no unique has a line `Grants Skill: <skill>` or `Grants Skill: Level
     (<range>) <skill>`. A minion skill's lock runs on it and again on its summon; both must pass (D-379).
   - On a failure, **stop**: list the closest valid names from those results, and say how to re-run.
     Ascendancies come from `mcp__pob2__get_classes`. For the skill, quote the names the lookup gave: when
     nothing matched, `mcp__pob2__lookup_game_data` says "Nothing matched …", then lists up to 5 names under
     `Closest active gem names (…):` and up to 3 under `Closest support gem names (…):`, each line
     `- <name> (active|support)` (D-258, D-258a). Quote the active names, in its order: only an active gem,
     or a command one summon's minion casts, is a valid roll. When it matched only other gems, quote those
     gems' names; for a support gem, say "<name> is a support gem"; for a minion skill several summons cast,
     name those summons. A failed lock gives its reason instead: the nodes that grant the skill, each
     with its id and ascendancy, so a re-run names one of those ascendancies or none. Create no run folder
     and write nothing.
   - Use the names exactly as the tools gave them from here on. A build's `roll`,
     `{className, ascendancy, skill}`, is set only at the verification gate, from the card the user
     finalizes (D-286): one build per finalized card (D-411, D-412).
2. **Run folder.** Call `mcp__pob2__guide_run {new_run: <slug>}`, the slug from the brief
   (`references/run-folder.md`: `titan-blood-hunt`, `titan-open`, `open-<first playstyle tag>`). Keep its
   absolute path (`runFolder`), its root-relative path (`runFolderRel`) and `loadedBuildUnsaved`. The card
   finalized later goes in the run log, not in the folder name.
3. **Run log.** Check the test config if one was given with `--offline`: `node
   .claude/skills/build-guide/scripts/run-log.mjs <runFolder> test-config <path>`. A file that can't be read or isn't the documented shape is refused, and the run stops: write
   `run-log.json` with `testConfig: "refused"` and `status: "stopped"`, finish (`SKILL.md` §7), and give the reason in your reply (`references/offline-and-test.md`).
   Otherwise write `run-log.json` with `status: "running"`, the mode, `testConfig`, `noNinja` (`true` with
   `--no-ninja`, else `false`) and the parsed brief; no build yet. Either first write is `run-log.mjs <runFolder>
   init`, with `noNinja` always (`init` refuses an entry without it), never Write (`references/run-log.md`).
4. **Unsaved build** (D-210). If `loadedBuildUnsaved` is `true`, ask the user before the first compile:
   proceed (the loaded build's unsaved changes will be discarded) or stop (the run ends `stopped`). In
   offline test mode `answers.unsavedBuild` answers it (`references/checkpoints.md`).
5. **The league digest's staleness line** (D-400). Print the newest digest's section and fetch date in your
   reply, `head -3 data/league/<newest>.md` (`ls data/league` lists them; the newest is the one fetched last, by
   the date on its third line), so a stale digest shows. The user runs `league-digest.mjs` when a league or patch
   lands; nothing waits on it.

Steps 1 to 4 always run as written, whatever tools the session has: never check for the Agent tool before
them. A stop in step 1, 3 or 4 ends the run there, and the later steps don't run: a brief that fails step 1
gets no folder, and a test config refused in step 3 gets no unsaved-build question.

**No Agent tool** (D-344): if the Agent tool isn't available when the first agent step is due, the run stops
there, and no agent runs. Set `status: "stopped"` with no `stages[]` entry, finish (`SKILL.md` §7), and give the reason
in your reply, as for a refused test config (`stopped: the Agent tool isn't available`).

## Resuming a run (`--resume`, `--campaign`; D-415)

`/build-guide --resume <run folder> [--no-ninja]` goes on with an earlier run in a later session, in
that run's own folder (D-153 as D-415 amends it); `/build-guide --campaign <run folder> <id>` resumes it and
answers `campaign:<id>` at the resume's verification visit. The run folder is absolute, or relative to the guides
root (`<slug>/<YYYY-MM-DD>-<n>`). A resume has no brief: the brief is in the run log, and the brief check doesn't
run again. In this order:

1. **The folder.** Call `mcp__pob2__guide_run {resume: <run folder>}`. It makes no engine call and writes
   nothing; it refuses a folder with no `run-log.json`, and replies `Resuming run folder <abs>`, `runFolderRel:
   <rel>` and `loadedBuildUnsaved: …` (`references/run-folder.md`). Keep the three as for a new run.
2. **A schema-3 log** (a run from before amendment 9: `"schemaVersion": 3` in `run-log.json`, `head -3`):
   `run-log.mjs <runFolder> migrate`, which rewrites it as schema 4, its build at the root (`folder: "."`).
3. **The resume entry:** `run-log.mjs <runFolder> resume` with `{"noNinja": <this session's --no-ninja>}`. It
   records the session (the pin's commit, the digest, the lists' lengths) and sets `status` `running`. Pricing
   starts afresh in the new session: a stop in an earlier session doesn't hold (D-415, `references/pricing.md`).
4. **Unsaved build** (D-210), once per resume: as step 4 above, when `loadedBuildUnsaved` is `true`.
5. **The league digest's staleness line**, as step 5 above.
6. **The verification gate** (`SKILL.md` §3, `references/checkpoints.md`): `display verification` lists every
   build of the run with its status, and says when PoB's version or the digest changed since the run last ran.
   Beside its own answers, a resume offers `guide:<id>` (a `file-only` build), `campaign:<id>` (a `completed` or
   `file-only` build) and `design:<id>` (a `stopped` or `dropped` build whose last D1 gate passed). With
   `--campaign`, its answer is `campaign:<id>`, logged as the user's.

A resume takes no `--offline` or `--test`: the run's mode is the log's, and the user answers every gate.
