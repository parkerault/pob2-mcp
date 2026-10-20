# Amendment 9: endgame builds first, and trees that minimize travel

**Status: APPROVED by the user, 2026-10-19** ("Draft looks good, go ahead"), after the independent review and its
re-check; the M-21 build starts. The user took §21's four recommendations the same day (the targets 1.2M,
0.75M and 0.4M; the tree threshold failing the D1 gate; M-21 and its live test before M-22; `get_passive_upgrades`
rebuilt on the power builder) and asked for an independent review before approving the amendment. The review found 5
blockers, 18 should-fix findings and 12 nits; the first revision resolved most of them, the reviewer's re-check
found 1 blocker, 9 should-fix findings and 5 nits left, and this second revision resolves those (§22).
It carries:
- the user's direction after the open-clear run: finalize one or more builds, endgame only, with the campaign on
  request (work-log 2026-10-19, "endgame builds first, several per run"), and the user's four rulings on it ("the
  user's rulings; node power; Gem Studded checked");
- the user's review of that run's tree and PoB's node power, with a spike that runs it in our engine (§4);
- the candidates the work-log collected on 2026-10-19: compaction while a run waits, researchers reading PoB's
  files, weapon sets, travel skills, and the open-clear run's own findings;
- the Mobalytics proposal's seven pipeline findings (`../studies/2026-10-18-mobalytics-proposals.md` §6).

It is written against spec v1.6 and amendment 8 (built as M-20, merged at `a4e5bd8`). Paths are from the
repository root, except stage files (`D1-build.md` and so on), which are under
`.claude/skills/build-guide/references/stages/`, and agent definitions, under `.claude/agents/build-guide/`.
Decisions continue from D-411, work units from WU-92, criteria from AC-W76 and AC-P73, contracts from C-55, PoB gaps
from PG-71. Each decision ends with the rows and rules it amends, so the fold into the spine is mechanical.

**Names.**
- A **build** is one finalized card carried through the design: its plan, its compile record, its PoB file and its
  guide. Today a run holds one build; under this amendment it holds one per finalized card.
- The **rungs** are the three endgame stages D1 designs: entering maps (`m`), budget (`b`) and non-budget (`n`).
  They form one tree track, each rung's tree containing the one before it unless a respec drops nodes (D-282).
- An **endgame-only build** has the rungs and no campaign stages; its guide is the **endgame guide**, which tells
  the reader to level with any build of the class. A **full build** adds the campaign (D2) and the full guide.
- **Node power** is PoB's own ranking of passive nodes (the tree tab's "Show node power" and its power report):
  for every node within a distance of the allocated tree, what allocating it with its path adds to a chosen stat,
  per point, and for every allocated node, what removing it with the nodes that depend on it costs, per point.
- **Travel** is the points a tree spends on nodes that give the build nothing themselves and only connect it to
  nodes that do. **Minimizing travel distance** is the user's rule for trees (§1).
- A build's **needs** are what its tree must keep whatever node power says: sustain, an attribute a gem needs, area
  for clear, a boss-only gain, a node that grants the skill (D-418).
- From the pipeline: a **card** is one candidate build (`cards/<id>.md`); R1b compiles its **skeleton**; D1 is the
  endgame design (D1-build, D1-tree from this amendment, D1-finish, then the D1 gate); the **design gate** shows the
  user the rungs before anything else is written (D-362); D2 adds the campaign; the D2 gate checks every stage and
  runs the final compile, the only compile that writes a PoB file into the builds folder; **F1** (this amendment)
  is the final compile of an endgame-only build; W1 writes the guide, V4 verifies it.

## 1. The user's direction

- **Endgame first, several builds per run** (2026-10-19): "a more natural workflow is brainstorm -> verify ->
  finalize one or more builds, endgame only. If the user wants to take one or more of the endgame builds and
  generate a full campaign guide from it, they can, but it's optional." The run had surfaced two builds worth
  finishing, and the run folder holds one.
- **An endgame-only guide:** community guides often give only the endgame build and say "use any <class> leveling
  build you want", above all when the build needs gems or items usable only at level 60 or above. A player who
  already has the ascendancy respecs rather than levels, and a campaign guide is then wasted tokens.
- **The user's rulings** on the four questions the proposal raised (all as recommended): several cards finalized at
  the verification gate, and a way back for more after a build's final gate; the output target per build, not per
  run; the campaign offered at the final gate and as a later command; no respec list from the user's own PoB file
  for now.
- **The tree** (the user's review of Executioner's Howl): the concept is creative, the passive tree poor. With
  PoB's "Show node power" on Full DPS, dozens of easily reached nodes with large gains sit unallocated. Real builds
  route along one path from the start out through their clusters; ours run many long branches to separate clusters
  of average payoff. The user's diagnosis: the designers judge a cluster by its gain and ignore the points its path
  costs; divide the gain by the points. The rule, in the user's words: **minimize travel distance**. "If it works, I
  would expect subsequent trees to look more like real world builds since they aren't allocating distant nodes
  anymore, but rather allocating clusters along one optimal route."
- **Any stat:** PoB's UI offers node power on almost every stat the engine measures, and the tool should take the
  same inputs, so a designer can ask for node power on mana regeneration, for example (2026-10-19).
- **The next live test:** the user will finalize the open-clear run's Caster-Staff Warcaller (r1-b-3) against a real
  build of the same kind, after this amendment (§16).
- **Gem Studded** (checked in game by the user, 2026-10-19): only the active weapon set's support gems count.

## 2. What the open-clear run showed

The run (`open-clear/2026-10-19-1`): an open brief, warcries as the damage, clear and fast, any ascendancy. Six
cards dealt on four engines; three picked plus the rival verified, all compiled on attempt 1; the user finalized the
rival's card, r1-x-1 "Executioner's Howl" (Warbringer / Arctic Howl); D1 designed the rungs; the user stopped at the
design gate, wanting the endgame build only. No PoB file reached the builds folder, since the final compile is the
D2 gate's.

- **Amendment 8's live test passed:** the obvious card was dealt (r1-a-1, "Seismic Bellow Spam"), each researcher's
  supply search listed substitutes and why each went unused, and the rival's card beat the picks: the user chose it.
- **Tokens** (telemetry for the run's session; the transcript's estimate agrees): 1.45M output, 275M cache read,
  5.2M cache write, before any campaign, guide or verification. By family: R1b 434K (4 cards with their assembles),
  R1a 412K (3 researchers and the deck), D1 286K (D1-build, D1-finish, two D1 gate attempts), the runner 110K, Q
  90K (3 gate questions), RV 83K. Amendment 4's 1M run cap (D-349) predates the rival and amendment 8's reading.
- **The tree:** the R1b steps built each skeleton's tree by naming targets and pathing to each: 22 to 35
  `find_path_to_node` calls per card, with `search_tree_nodes`, and no `get_passive_upgrades`. D1-build starts from
  the skeleton's tree and called `get_passive_upgrades` once, D1-finish once.
- **Blocked by the permission system:** the D1 gate's measure-only `compile_plan` was refused by Claude Code's
  auto-mode classifier ("[Interfere With Workloads]") after about 20 such calls had passed. The gate wrote
  `compiled: fail`, code `compile-error`, which routes to a D1 re-run (about 900K subagent tokens to change
  nothing). The runner stopped; the user allowed the tool and had the gate re-run alone.
- **Pricing:** D1-finish's 22nd price call got an HTTP 429, so pricing stopped (`pricing.md`); 21 entries are
  `unavailable` and every rung total `unverified`. The D1 gate then called `get_leagues` on the trade site, after
  pricing had stopped (the coordinator's standing league rule, `build-guide-coordinator.md:118`).
- **The design gate's one question,** "the EHP in the cards was much higher": R1b measured each skeleton against
  PoB's default enemy hit, D1's rungs against the T15 map hit, so the two Effective HP figures don't compare.
- **A rule the user gave at the verification gate:** with Avatar of Fire, gained cold and lightning ("gain as extra")
  convert to fire before "Deal no Non-Fire Damage" applies (poe2wiki, pasted by the user); PoB drops them.
- **The run checker's violations:** the 429 (NFR-22), the D1 gate's re-run after the refusal (`order`), and
  `[deck]`: "How they differ holds 3 lines", which is one paragraph wrapped over three lines.
- **`scripts/run-usage.mjs`** summed every session in the launcher's shared `telemetry/events.jsonl` (3.98M output,
  three days of runs) rather than the run's.
- **Compaction:** the run session was compacted once and went on with no visible loss.

## 3. What already fits

- D1 designs the rungs before D2 adds the campaign, and the design gate sits between them (D-362): an endgame-only
  build is a design that goes from the design gate's accept to its final compile without D2.
- The plan compiler compiles a plan with no campaign stage: the ladder's first rung continues "from none when there
  is no campaign stage" (slice 02 §3.7, `tree-continuity`).
- The guide's Survival by stage already covers the rungs only (D-354).
- The deck, the cards, the research, the dossier and the interviews are run-wide; each verified card keeps its
  skeleton under `concepts/<id>/`; gate verdict files and every design step's `stages[]` entry already carry the
  card id (`concept`), W1 and V4 included (`scripts/run-log.mjs:91, 203`).
- The server takes a plan anywhere under a run folder, and keys the write ledger by the run folder, its first two
  path segments (`src/utils/guidesPath.ts`, `runFolderOf`): `builds/<id>/plan.json` needs no server change.
- A plan's `tree.ascendancyNodes` is an ordered array, so the order to take the ascendancy's nodes needs no new field.

## 4. The spike: PoB's node power in our engine

**PoB's code** (pin): `CalcsTab:PowerBuilder` (`vendor/PathOfBuilding-PoE2/src/Classes/CalcsTab.lua:521`) visits
every node with modifiers, not ascendancy-locked, within `nodePowerMaxDepth` of the tree. With a stat selected, an
unallocated node gets its gain alone (`singleStat`) and with its whole path (`pathPower`); an allocated node gets its
loss alone and with every node that depends on it (`node.depends`). Ascendancy nodes get no path figure (`:600`,
`:628`). The stat is an entry of `data.powerStatList` (`Modules/Data.lua:127`), to which PoB appends minion versions
at load (`:222-232`). Its combined "Offence/Defence" entry has no `stat`, and gives a node's own offence and defence
only, with no path figure and no allocated loss (`CalcsTab.lua:598-631`). The tree tab's power report
(`Classes/TreeTab.lua`, `BuildPowerReportList`) divides `pathPower` by the path's points (`node.power.distance`), or an
allocated node's by its dependants' count.

**The server's `get_passive_upgrades` isn't that** (`src/handlers/treeHandlers.ts:487-600`): it takes notables
only, found by text search on up to four keywords ("damage", "critical", "life", "energy shield", "resistance"),
the 8 nearest per keyword, so at most 32 candidates; it skips small passives, keystones and every notable whose
text lacks those words (warcry speed, area, cooldown, exposure, culling); it has no distance limit; and it never
measures what an allocated branch is worth.

**The spike** (2026-10-19; a standalone script booting the vanilla headless wrapper as `scripts/check-construct.lua`
does, run from the pin's `src/` with temp `HOME`, `POB_DIRECTORY` and `XDG_STATE_HOME`, at `nice -n 19`), on the
open-clear run's final compile, rung `n` (level 95, Warbringer, 114 normal, notable and keystone nodes allocated on
the main tree, Full DPS 178,838, TotalEHP 7,666):

- **It runs headless** with no change: called outside a coroutine, `PowerBuilder` runs to the end in one call, and
  the bridge dispatches handlers with a plain `pcall` (`pob-api/API/Server.lua:102`).
- **Time, one stat:** 8.8 s CPU within 4 points (1,041 nodes), 12.9 s within 6 (Full DPS; TotalEHP 13.8 s), 15.0 s
  within 8 (1,776 nodes). The time is the per-node calculation; reading a second stat from the same outputs costs
  almost nothing (D-417).
- **Unallocated, within 8 points:** each of these alone adds 13–19% Full DPS: Rhythm of Ice (4 points, +13.0%),
  Warcry Speed (5, +13.7%), Bringer of Order (5, +14.3%), Cold Nature (6, +18.5%); single cold-damage and
  shapeshifted-damage nodes add 2.8% for 1 point. (The gains aren't additive.)
- **Allocated:** 64 of the 114 give neither Full DPS nor TotalEHP alone. The weakest branches include two Dexterity
  branches of 7 and 8 points that cost nothing on either stat when removed; Cold Penetration (5 points in two
  branches), worth nothing because the rung's clear config (`enemyIsBoss` None) gives the enemy no resistances; and
  mana-sustain nodes (Mana on Kill, Mana Regeneration, Mana Cost Efficiency) that the howl spam may need, which
  neither stat sees.

**What it means:** node power finds the user's dozens of cheap gains and the long branches directly. It can't see
what PoB doesn't count in the chosen stats: sustain, area for clear, a boss-only gain under a clear config, or an
attribute a gem needs. So a tree step that uses it needs the build's needs, kept (D-418). And PoB's paths are
computed from the current tree, so a swap must be searched after its removal, not before (D-417).

## 5. D-411: endgame builds first, several per run

- **The verification gate** (step 5) finalizes 1 to 3 verified cards: `pick:<id>[,<id>…]`, in the user's order, each
  with its own `changes`. The rules on what can be finalized are unchanged (D-303, D-342, D-400, D-408), and a card
  that already has a build in the run can't be finalized again: a second design of it is a `revise` at its design
  gate, or a new card made from it at the verification gate (D-391).
- **Builds run in turn,** since the server holds one loaded build and coordinator steps never overlap (FR-W3): for
  the first queued card, its design (D1-build, D1-tree, D1-finish, the D1 gate) and its design gate; then its final
  compile (F1, D-413), guide, verification and final gate; then the next queued card.
- **The design gate's answers** (checkpoint `design`, per build):
  - **accept**: F1, the endgame guide, V4 and the build's final gate;
  - **file only** (`accept:file`): F1 and nothing after it; the build ends `file-only` (the PoB file, no guide). A
    guide can follow later (`guide:<id>` after `--resume`, D-415). This is what the user wanted from the open-clear
    run;
  - **revise** (`revise:<text>`), unchanged but for the step that owns a tree change (D-418);
  - **verification**: the build ends `dropped`, and the verification gate is shown;
  - **stop**: the build ends `stopped`, and the next queued card's design starts; with none queued, the run ends.
- **The final gate's answers** (checkpoint `final`, per build): **accept** (`completed`); **changes** (a revision,
  unchanged); **decline** (`decline:<note>`, `not-accepted`: the prefix tells a decline from the new answers); and
  two new ones:
  - **campaign** (`campaign`): the build ends `completed` with its endgame guide, then reopens for its campaign
    (D-415) and comes back to this gate;
  - **accept, then verification** (`accept:verification`): the build ends `completed`, and once the queue is empty
    the verification gate is shown again, for more cards.
- **The queue across a visit to the verification gate:** when a build's route returns there (the design gate's
  `verification`, escalation option 3, an `infeasible` design, FI-3), the cards still queued stay queued and resume
  after the visit, behind any card the visit finalizes; the visit's `stop` ends them `stopped`.
- **Escalations are per build** (§5 of `SKILL.md`): option 3 drops the build and returns to the verification gate;
  option 4 ends the build `escalated` and goes on to the next queued card. An accepted finding (option 1) goes into
  the later headers of **that build's** steps only, matched by `concept` as well as stage, part and code.
- **The run ends** when the queue is empty and the last answer didn't ask for the verification gate. Its `status` is
  `completed` when any build ended `completed` or `file-only`, else the last build's end (`not-accepted`,
  `stopped`, `escalated`), or `stopped` when no card was finalized.
- **The displays** name the build: `display design --build <id>` and `display final --build <id>`; the verification
  gate's display lists every build of the run with its status.
- **Amends:** D-286 (one `roll` per build, not per run); D-287 (1 to 3 cards finalized, not one); D-362 (the design
  gate's accept leads to F1, not D2; `accept:file`); D-236 (escalation options 3 and 4 act on the build); the final
  gate's answers in `checkpoints.md` and `run-log.mjs`; `SKILL.md` steps 5 to 16.

## 6. D-412: one folder per build; run log schema 4

- **The run folder** gains `builds/<id>/`, one per finalized card, holding what the root holds today for the one
  build: `plan.json`, `compile-record.json`, `compiled-build.xml`, `guide.md`, `audit.md`, `reports/V4-<n>.md`
  and `rounds/<n>/`. Gate verdicts stay in `reports/gates/`, keyed by card id. Every stage file, script, display and
  agent definition that names a root build path names `<buildFolder>/` instead: the coordinator's plan views
  (`build-guide-coordinator.md:37-41`), the writer's `guide.md` and `audit.md` (`build-guide-writer.md:24-31`), the
  verifier's reports (`build-guide-verifier.md:33-35`). The task header gains `buildFolder` (`builds/<id>`).
- **The PoB file** of a build is `<slug>-<YYYY-MM-DD>-<n>-<id>`: the run folder's last two segments and the card id,
  joined with `-`, so two builds of one run never share a file.
- **The run log, schema 4:**
  - `roll` and `outputs` are removed; `dossier` is a run-wide field; `builds[]` is added, one per finalized card in
    finalize order: `{id, roll, status, folder, guide, pobFile}`. `roll` is the card's identity (D-286); `status` is
    one of `queued`, `designing`, `writing`, `completed`, `file-only`, `not-accepted`, `dropped`, `stopped`,
    `escalated`; `folder` is its build folder; `guide` is `null`, `endgame` or `full`, as the plan decides (D-414);
    `pobFile` is the record's path once a final compile wrote it.
  - `design` and `final` checkpoints carry `concept`, the build's card id (stage entries already do);
  - `init` records `noNinja` (`true` or `false`), the pin's commit (read by `run-log.mjs` from `pob-pin.json`, since
    the runner runs no `git`) and the newest league digest's file name;
  - `resumes[]`, one per resume (D-415): `{date, pinCommit, digest, noNinja}`.
- **The scripts:** `run-log.mjs` writes schema 4 and gains `migrate` (D-415); `check-run.mjs` checks every build in
  its folder, takes `--build <id>` with `--changed` and `--snapshot`, and its order rules follow D-411's routes per
  build; `render-audit.mjs <runFolder> --build <id>`.
- **Amends:** the run folder's layout (`run-folder.md`, C-34, C-36) and its PoB file name (D-113, D-199); C-31's run
  log fields and schema 3 (`run-log.md`); D-356 (`run-log.mjs` gains `migrate` and the build displays); the agent
  definitions' paths.

## 7. D-413: the endgame-only build and its final compile

- **The campaign reward picks** (D-265) are D2's today, which adds them to the rungs. For an endgame-only build, D1
  makes them: each reward choice the campaign offers (`data/campaign/progress.json`) is set on all three rungs as a
  `config.scenario` entry citing its option, so the endgame numbers include them, and the endgame guide names them
  (D-414). D2 keeps D1's picks when the campaign is added later.
- **F1, the final compile of an endgame-only build** (a new coordinator step, `stages/F1.md`, fresh): after the
  design gate's accept or `accept:file`, it checks that `plan.json`'s sha1 equals the passing D1 gate's record's
  `planSha1` (the plan the user accepted), and runs the final compile with `buildName`. The compile's own V1 and V2
  hold the final record to the rules the checker reads. Its verdict file is `reports/gates/F1-<id>-a<n>.json`.
  - **Its header** carries `accepted`, as the D2 gate's does: the findings the user accepted at a D1 gate escalation
    (option 1), which F1 doesn't count as failures.
  - **Its routes:** a pass renders `audit.md` (`render-audit.mjs --build <id>`), then W1, or ends the build
    `file-only`. A plan that changed since the gate, a V1 or V2 failure not in `accepted`, or a compile error on the
    plan the gate passed is a fault, not a design finding: F1 re-runs once, uncounted; a second failure escalates. A
    refusal by the write ledger (D-211, "already exists" or changed on disk) escalates at once, since no retry
    changes it.
  - **Its escalation** (stage `F1`, verdict file `reports/gates/F1-<id>-a<n>.json`, in the escalation forms of
    `run-log.mjs` and the checker): 1. **accept**, not after a compile failure or a ledger refusal: the failing
    findings join `accepted`, and F1 runs once more, uncounted; 2. **guidance and one more retry**: D1 (D1-build,
    D1-tree and D1-finish as the guidance needs), the D1 gate, and the design gate again, since the build changed;
    then F1; 3. **back to the verification gate**: the build ends `dropped`; 4. **stop**: the build ends
    `escalated`. For a ledger refusal, the user can also restore or remove the changed file and answer 1 to retry.
  - The D2 gate stays the full build's final compile, with its routes unchanged: it runs only after D2.
- **The level the build works from:** the compile record gains, per stage, `requirements {level, by[]}`: the
  highest level requirement among the stage's equipped items and socketed gems, as PoB computes them, and which
  items or gems set it. The endgame guide says when the build comes online from `m`'s figure.
- **The ascendancy order:** D1 lists `m`'s `tree.ascendancyNodes` in the order to take them; `b` and `n` keep that
  order for the nodes they share. D1-finish's `reason` claim for it names the nodes in that order and says why, so
  W1 renders the claim (W1 reads no node ids, `W1.md:41-43`) and V4 checks its order against `ascendancyNodes`.
- **Amends:** D-265 (D1 makes the picks when there is no D2); D-208 (the final compile is F1's or the D2 gate's);
  C-33 (the record's `requirements`); `gates.md` and the checker's order rules (F1's routes); `SKILL.md` §4.

## 8. D-414: the endgame guide

A second template, `templates/guide-endgame-template.md`, for a plan with no campaign stage. The plan decides the
template, in W1 and in the checker alike: no campaign stage, the endgame guide; the run log's `guide` field records
it, and the checker fails a mismatch.

- **Its H2s,** in order: At a glance; Your PoB file; Switching over; Survival by stage; Priorities; Endgame:
  entering maps; Endgame: budget; Endgame: non-budget; How to play it; What PoB can't show (ending with Known
  issues); FAQ; Changelog. Leveling, Campaign route and rewards, and Gem and ascendancy timing are gone.
- **Switching over** (about 250 words) replaces them:
  - level with any build of the class; the build works from level <`m`'s `requirements.level`>, because of <what
    sets it>;
  - the ascendancy, and the order to take its nodes (D-413);
  - each campaign reward pick the plan makes (D-413), by the first line of its option and its reason;
  - for a respec or a player switching from a levelling build: the PoB file holds the whole tree for each rung;
    refund what the rung doesn't use; the gold cost isn't computed.
- **Length:** about 2,100 words of budget, **at most 2,300**, the H1, the import code and the Known issues list not
  counted (the full guide's cap stays 3,000). Your PoB file lists the three rung loadouts only.
- **The checker's reward-pick rule,** for a plan with no campaign stage: every rung carries the same pick for each
  reward choice the campaign offers, and Switching over names each pick by its option's first line. (Today the rule
  runs only when a campaign stage passes the quest, and reads Campaign route and rewards, `check-run.mjs:1472-1495`.)
- **V4** reads the template's H2s; `audit.md` is unchanged, its Checks per rung. `SKILL.md`'s description and the
  writer's description name both guides.
- **Amends:** D-276, D-277 and D-280 (the reader layer gains a second template); D-283 (the checker's guide rules
  follow the template); the reward-pick rule's scope.

## 9. D-415: the campaign on request, and resuming a run

- **Resuming** a run in a later session: `/build-guide --resume <run folder>` (absolute, or relative to the guides
  root) reads the run log, migrating a schema-3 log first, appends a `resumes[]` entry, sets `status` `running`,
  prints the league digest's staleness line and the verification gate's display with every build's status, and goes
  on from the user's answer. Beyond the verification gate's answers, a resume offers:
  - **`guide:<id>`** for a `file-only` build: W1 with the endgame template, V4's full pass, the fix round, the
    re-check, its final gate;
  - **`campaign:<id>`** for a `completed` or `file-only` build (below);
  - **`design:<id>`** for a `stopped` or `dropped` build whose last D1 gate passed on its current plan (`plan.json`'s
    sha1 equals that gate's record's `planSha1`): its design gate again, from the existing verdict file, at no cost.
    The open-clear run's r1-x-1 migrates `stopped` with a passing gate, so `design:r1-x-1` then `accept:file` gives
    the user the PoB file they wanted from it.

  `--campaign <run folder> <id>` resumes and answers `campaign:<id>`. The brief check doesn't run again (the brief is
  in the log). The runner's own pob2 tools (`SKILL.md:24-27`) gain `guide_run {resume}`.
  - `mcp__pob2__guide_run` gains `{resume: <run folder>}`: with no engine call (a router rule beside `new_run`'s), it
    checks the folder holds a `run-log.json` and returns `runFolder`, `runFolderRel` and `loadedBuildUnsaved`,
    writing nothing. The unsaved-build question is asked once per resume.
  - **A resume writes into an earlier run's folder,** which D-153 forbade; a new run still gets a new folder.
  - **Where a resume falls:** each `resumes[]` entry records the lengths of `stages[]`, `checkpoints[]`,
    `escalations[]` and `displays[]` at the moment of the resume, so the rules below and the checker know which
    entries follow it.
  - **Pricing after a resume:** a pricing stop (a `locked_out` or `rate_limited` call) holds for the session it
    happened in: the rule reads only the `stages[]` entries after the last resume. The open-clear run's 429 doesn't
    stop the live test's pricing (§16).
  - **A changed pin or digest:** when the pin's commit or the newest digest differs from the run's last recorded
    one, the verification display says so. A card verified on the old pin may still be finalized; its skeleton's
    figures are the old pin's, and D1 measures afresh. (No re-verification of a verified card: a card is verified
    once, `run-log.md:140`.)
- **The campaign** for a build: from the final gate's `campaign`, or `campaign:<id>` after a resume. The build's
  status goes to `writing`, `guide` to `full` at its end. For a `file-only` build, which has no guide and no V4
  pass, the campaign runs as a full build does today from D2: D2, the D2 gate, W1 writing the full guide, V4's full
  pass, the fix round, the re-check, the final gate. For a `completed` build:
  1. The round copy first (`check-run.mjs --snapshot <n> --build <id>`, A-34, `<n>` the build's last V4 report's
     number, as for a revision).
  2. D2 adds the campaign stages, keeping D1's reward picks; the D2 gate checks every stage and re-runs the final
     compile, rewriting the build's PoB file. A refusal by the write ledger (the user changed the file in PoB, D-211)
     escalates at once rather than spending retries.
  3. `render-audit.mjs --build <id>`; W1 in its **campaign mode** (`W1.md`): it rewrites the guide with the full
     template, keeping the endgame sections' text where the plan didn't change them.
  4. **V4 in its campaign mode:** one pass over the campaign stages' hinge claims and the guide's new and changed
     H2s: stage `V4-campaign`, header `check: "campaign"`, report H1 `campaign pass of rounds/<n>`, numbered as the
     build's next `reports/V4-<n>.md`; then the fix round and the re-check as after a full pass (steps 12 to 14);
     then the build's final gate.
- **Migrating a schema-3 run:** `run-log.mjs <runFolder> migrate` rewrites the log as schema 4. The old run's
  build, when it has one, becomes `builds[0]` with `folder: "."` (its files stay at the root), its `roll`, its status
  from the old `status` and last answer, and `guide` from whether a guide exists; its `design` and `final`
  checkpoints get `concept` from the D1 gate entry before each; a final-gate decline's free text gets the
  `decline:` prefix; `noNinja`, the pin's commit and the digest are `null`. The checker reads a build in `"."` as today's layout, and accepts entries after a terminal answer only
  behind a `resumes[]` entry. The open-clear run migrates this way, so its r1-b-3 can be finalized from it (§16).
- **Tokens across sessions:** `scripts/run-usage.mjs` takes several transcripts, one per session of the run.
- **Amends:** D-153 (a resume writes into its own earlier run's folder); D-264 and `W1.md:26` (W1 rewrites the
  guide in its campaign mode); D-352 (the campaign gets its own pass of the new sections); D-210 and
  `checkpoints.md:86-87` (the unsaved-build question once per resume); the pricing stop's scope (`pricing.md`,
  `D1-finish.md:86-93`, the coordinator's definition); `run-log.md:140` stands.

## 10. D-416: output targets per build

Amendment 4's one 1M-output cap per run (D-349, D-357) becomes targets by phase, measured by `scripts/run-usage.mjs`
per build (grouped by the task header's `concept`):

| Phase | Measured or estimated | Target (choice 1) |
|---|---|---|
| The shared phases: brainstorm, verification, the rival, gate questions | about 1.1M (open-clear, one round) | 1.2M |
| An endgame-only build: D1-build, D1-tree, D1-finish, the D1 gate, F1, W1, V4, a fix round | about 0.7M (estimate: D1 286K here without the tree step; D1-tree 100–150K for up to 24 swaps in compact mode; W1 226K and V4 134K in the lean run, both with a campaign) | 0.75M |
| A campaign added to a build: D2, the D2 gate, W1's campaign mode, V4's campaign pass and re-check | about 0.35M (estimate: D2 167K in the lean run) | 0.4M |

The targets are measured after a run, as amendment 4's cap was; no step stops for them. **Amends:** D-349, D-357.

## 11. D-417: node power as a tool (C-55)

`mcp__pob2__get_node_power` (group `core`, engine `read`, as `get_passive_upgrades`), on the loaded build.

- **Arguments:**
  - `stats`: 1 to 3 of the stats PoB's tree tab offers for node power, by PoB's id or label (the user asked for the
    same inputs as PoB's UI): the entries of `data.powerStatList` that have a `stat` and aren't item-only, minion
    versions included, as the engine holds them at the pin (Full DPS, Hit DPS, the ailment DPS, Life, Mana, Mana
    regen, Energy Shield, Spirit, Armour, Evasion, the attributes, effective maximum hit, damage taken by type, crit
    and ailment chances, block, the avoid chances, movement speed and others). The combined "Offence/Defence" is
    left out: it gives a node's own figures only, with no path or loss (§4). An unknown name fails with the list.
    The first stat ranks; default `["FullDPS", "TotalEHP"]`.
  - `max_loss`: the largest loss in percent a swap may cost on each other stat, and on any guard: by default 2 for
    each stat, and 0 for the guards, which apply whatever `stats` holds: movement speed (`EffectiveMovementSpeedMod`)
    and the clear band's inputs (D-407), read from the record's clear entry (`clearEntryOf`,
    `src/plan/record.ts:572-579`): the clear-role group's skill, or its minion's fields for a summon, which isn't
    the main skill when the named source is a single-target skill (D-148). The tool measures the clear entry with
    `clear_group` selected inside the call, on each swap it considers (a few calculations), and restores the
    selection.
  - `clear_group` (the plan's `role: clear` group, as the compile record numbers it; default the main group);
    `protect_for` (the loadout names of the later rungs, which must be loaded: D-418); `max_distance` (points from
    the tree, default 6, at most 12); `loadout` (the loadout to measure, by name; default the active one); `level`
    (default the `(L<level>)` in the loadout's name, which every compiled loadout carries); `keep` (allocated node ids
    no swap may remove); `limit` (rows per list, default 15; 0 returns only the best swap and the travel count, the
    compact mode for the swap loop).
- **One engine request,** with a 120 s timeout (the bridge's long-action list): the bridge's `node_power` handler
  runs `PowerBuilder`'s computation once (PoB's own misc calculator per node, its `path`, `pathDist` and `depends`,
  and `CalculatePowerStat`), reading every requested stat and guard from each output, so a second stat costs almost
  nothing. Its figures equal `PowerBuilder`'s for each stat alone (AC-P73).
- **State** (D-176): inside the call it selects the loadout and sets its level, and it restores the previous
  selection and level at the end and on any error; the exported build and its `revision` are unchanged. A timeout
  fails the whole call, and the session restores its snapshot (C-4), the pre-call state.
- **What it returns:**
  - **best unallocated:** nodes ranked by path gain per point on the first stat, each with its name, type, points,
    path, and each stat's gain alone and with its path;
  - **weakest allocated:** branches (a node and its dependants) ranked by loss per point on the first stat, leaving
    out every branch that contains a protected node;
  - **travel:** the allocated main-tree nodes that give nothing on any requested stat alone, by count;
  - **the best swap,** searched on a scratch copy of the tree (D-418), for each of the 5 weakest unprotected
    branches in turn: remove the branch; recompute paths on the tree without it; add the best per-point candidates
    whose new paths fit the freed points, counting the union of their path nodes once, re-measured on the scratch
    tree; then measure the swap as one change with the misc calculator. Of these up to 5 swaps, only a swap that
    stays legal is returned: the tree connected; within its points; no second tree on a class start (the tree-shape
    rule, D-360 as D-364 states it); no weapon-set node added or removed (until D-426); no ascendancy node. An added
    attribute node is measured with PoB's default choice and returned with it, so D1 can set its `attributeChoices`.
    The swap is the one that gains most on the first stat within `max_loss`; "no gaining swap" when none does;
  - what PoB can't measure among the nodes listed (C-47's section, as `get_passive_upgrades` gives it).
- **Protected nodes,** never removed, nor any branch containing them: `keep`; the nodes that grant a skill (a
  `Grants Skill:` line); weapon-set nodes; and every node a later rung builds on: for each loadout in
  `protect_for`, every node of this rung whose dependants in that loadout's tree (`node.depends` on its spec)
  include nodes outside this rung's tree. So a swap removes only what no later rung needs to reach its own nodes,
  and the nodes it adds connect through this rung's tree, which every later rung contains: applied up the ladder,
  it stays connected there too.
- **`get_passive_upgrades`** keeps its arguments, its output form and its DPS figure (`CombinedDPS`, else
  `TotalDPS`, and a summon's `MinionTotalDPS`, D-388). Its main-tree candidates come from the same computation at
  depth 6, every node rather than keyword hits; its ascendancy candidates stay as today (`calc_with` on each),
  since the power builder gives ascendancy nodes no path figure.
- **The power stats a run uses:** Full DPS for damage (the headline figure since 2026-10-10; the compiled groups
  carry `includeInFullDPS`) and TotalEHP for defence; a need with a stat uses that stat (D-418).
- **Amends:** C-47 and the stabilization spec's D-77 (how `get_passive_upgrades` finds candidates); the
  stabilization spec's D-47 (a 120 s long action); the listed tool count (84 to 85: the README table and the tests
  that count tools).

## 12. D-418: the tree minimizes travel (D1-tree)

D1 gains a third step, **D1-tree** (`stages/D1-tree.md`, a fresh coordinator step between D1-build and D1-finish),
so the loop's tool output stays out of D1-build's context. Every design attempt runs D1-build, D1-tree and D1-finish
in that order; a revision or a gate finding about the tree alone runs D1-tree, then D1-finish. R1b's skeleton tree
stays a sketch of the card's targets.

- **The plan's needs** (plan schema 6, WU-93): `stages[].tree.needs[] {nodes, stat?, claim?}`: the nodes a need
  keeps, the power stat that measures it when PoB has one, and the id of the stage's `reason` claim saying why. A
  need's nodes are in the stage's nodes (a schema error otherwise). The claims are D1-finish's (D-356), so D1-build
  and D1-tree write a need without `claim`, and D1-finish writes the claim and sets it; a need with no `claim`, or one
  naming no claim of the stage, is a V1 finding at the D1 gate (`missing-reason`). Only `claim` is left out of
  `buildSha1` (D-266): a need's `nodes` and `stat` are in it, since the gate's `tree` verdict keeps them, so changing
  them recompiles and re-runs the gate.
- **D1-build writes the needs:** mana or life sustain; an attribute a gem or item requires; area or movement for
  clear; a boss-only gain (penetration and exposure count for nothing on a clear config with no enemy resistances);
  a defence the floor needs; a node the card's engine names; every producer of the stage's earned config state
  (`config.earned[].producer`), which V2 checks; and a node the user asked for in a `revise:` or a gate's `changes`.
- **The swap loop** (D1-tree), in ladder order, after D1-build's compile and only once each rung's floor holds. Every
  call has the rung's loadout, `keep` = the rung's needs' nodes, `clear_group`, and `protect_for` = the later rungs,
  so the rungs a swap touches must be compiled and loaded: D1-tree compiles them together (`compile_plan {stages}`
  naming them), which also loads the later rungs' loadouts.
  1. **`m`:** call `get_node_power` (compact mode); apply the best swap to `m`, and to `b` and `n`, which contain
     `m`'s tree (D-282); `protect_for` = `b` and `n` means the swap removes nothing either builds on, and its added
     nodes connect through `m`'s tree in both. Set any added attribute node's choice. Compile `m`, `b` and `n`, and
     undo the swap on all three if any rung's floor or V1 fails.
  2. **`b`, then `n`:** the same, with `keep` adding every node of the rung before, so a swap touches only the
     nodes the rung adds; `b`'s swaps go to `n` too (`protect_for` = `n`), compiled with it. A respec is never the
     loop's: only a stated `respec.dropped` with its reason, as today.
  3. **Spare points:** when a swap applied up the ladder leaves a rung with unspent points (it already held some of
     the added nodes), D1-tree spends them on that rung's best per-point nodes, from the tool's unallocated list.
  4. **An undone swap becomes a need:** its removed nodes are written as a floor need (stat TotalEHP, "a defence the
     floor needs"), so neither the loop nor the gate proposes it again.
  5. Repeat on a rung while its best swap gains at least **3%** on the first stat, at most 8 swaps per rung; the
     gate fails at 5% (D-419), so the anoint and prices D1-finish adds can't push a finished loop over the gate's line.
  6. A need with a stat is met by node power on it: D1-tree calls `get_node_power` on that stat for the cheapest
     nodes per point that meet it, and keeps those.
- **D1-tree returns** counts only: each rung's travel before and after, and the swaps made. The swaps' nodes are in
  the plan.
- **The library** gains the user's rule in its tree advice (`references/patterns.md`): minimize travel distance;
  judge a cluster by its gain per point with its path; cited to the user, 2026-10-19.
- **Amends:** D-356 (D1 is three steps; D1-tree writes needs without claims); C-31 (plan schema 6: `tree.needs`);
  D-266 (`buildSha1` leaves out a need's `claim`); `D1-build.md` step 5.

## 13. D-419: the D1 gate checks the tree; the displays show it

- **The D1 gate** compiles the plan measure-only as today, which loads every rung, then calls `get_node_power`
  (compact mode) on each rung with the same arguments as D1-tree: `keep` (the needs' nodes, and the rung before's
  nodes for `b` and `n`), `protect_for` (the later rungs), `clear_group` and `max_loss`. A new verdict part, `tree`, fails a
  rung whose best swap gains at least **5%** Full DPS (choice 2), with the swap as its finding (code `tree-swap`).
  A failure re-runs D1-tree and D1-finish with the verdict, up to 2 counted retries, then escalates.
- **A tool failure is not a design failure:** when `get_node_power` fails or times out, the `tree` part is
  `unverified` with code `tool-error`, and the gate re-runs alone, once, uncounted; a second tool failure escalates.
  (Today any part but the budget that is `unverified` counts as a failure, `gates.md:24-26`.)
- **The run checker** checks the `tree` part's shape and that its verdict agrees with its finding; it can't recompute
  it without the engine. `tree` joins the checker's part list (`check-run.mjs:214`).
- **The design display** gains, per rung, after the gear line: `Passive tree: <travel> of <points> points on travel;
  best swap left: <none | +<x>% Full DPS by moving <n> points from <branch> to <nodes>>`; then the needs, one line
  each, so the user sees why a long branch stays.
- **The final gate's figures** show each rung's travel count beside DPS and EHP, from the last D1 gate verdict file.
- **Amends:** `gates.md`'s D1 gate parts and routes (a new part; `unverified` with `tool-error`); D-367 and D-369
  (the design and final displays); the checker's part list.

## 14. D-420: a compaction while a run waits

From the work-log's 2026-10-19 section ("compaction while a run waits"); Claude Code compacts an idle session over
200,000 tokens after about 54 minutes, re-injects at most 5,000 tokens of an invoked skill and no reference.

- **Interview notes after each answer:** the runner writes `interviews/<gate>-<visit>.md` after each question it
  answers, not at the decision, and writes the file at a visit with no questions too when a decision is pending.
- **The pending decision on disk:** before asking for a yes, the runner writes the restated decision, with the
  user's words verbatim (a revision's `changes`, a new card's name and id), under `## Pending decision` in the
  visit's notes, and logs the checkpoint from them. The checker exempts that H2 from its question rules and from the
  question count (`check-run.mjs:3012-3043`).
- **`noNinja` in the run log** (D-412), which the runner reads for every pricing step instead of remembering it.
- **A hard rule in `SKILL.md`'s first 40 lines:** after a compaction, re-read `SKILL.md` whole, `run-log.json`, the
  current step's reference and the visit's notes, print the gate's display again (`display` doesn't record a second
  visit), and act on no yes the notes don't hold.
- **A `SessionStart` hook** with the `compact` matcher prints that rule: a committed script,
  `scripts/compact-reminder.sh`, and a committed example of the run session's settings,
  `docs/build-guide/run-settings.example.json`, which the user's launcher copies (the launcher lives outside the
  repository); the plugin's `hooks/hooks.json` carries the hook when it is packaged.
- **Amends:** D-389 and `checkpoints.md:43` (when the notes are written); the checker's interview-notes rule.

## 15. D-421 to D-424: the run's other fixes

- **D-421, a refused call.** Claude Code's permission system can refuse a tool call inside a subagent's step. Every
  agent definition gains the rule: a refused call isn't a tool error; the step stops, its verdict part (for a gate)
  is `unverified` with code `tool-refused`, and its return carries the line `refused: <tool>`. The runner, on that
  line or code, asks the user to allow the tool, then re-runs the refused step alone, uncounted, after logging the
  step with outcome `refused`. The checker accepts the same step after a `refused` entry, and a verdict with
  `tool-refused` routes to no producer. `run-settings.example.json` (D-420) allows the engine and file tools the
  coordinator uses (`compile_plan`, `guide_run`, `get_node_power`, `manage_sets` and the engine `read` tools in its
  list), leaving the trade tools to review. **Amends:** the coordinator's error rule
  (`build-guide-coordinator.md:72-74`) and the other definitions; `gates.md`'s routes; the checker's order rule.
- **D-422, no trade call after pricing stops.** Once pricing stops (in the session, D-415), no step calls a tool that
  sends a trade request: `get_leagues`, `get_item_price` for an item, `search_trade_items`, `search_stats`,
  `find_upgrades`. `trade_query_options` sends none, and `get_item_price` for a Distilled Emotion reads poe.ninja's
  currency exchange (D-387), so both stay allowed (the latter not with `--no-ninja`). The rule goes where the calls are made: the coordinator's
  league rule (`build-guide-coordinator.md:118`), `D1-build.md:48-56`, `R1b.md:144`, `D1-gate.md` and `pricing.md`.
  With pricing stopped, the plan's league is the one recorded before the stop. The D1 gate's market day keeps its
  computation (`data/economy/prices.json` and the prices' dates, `D1-gate.md:66-71`). **The 429 is investigated:**
  the server's limiter (C-11) paces within the limits the trade site reports, yet the 22nd call was refused; the work
  unit finds whether the limiter's state, the call count, or the user's own trade use at the same time (the limits
  are per IP and account) explains it, and fixes what is ours. **Amends:** `pricing.md`'s stop rule (D-160).
- **D-423, comparable Effective HP.** A skeleton's stage is measured against the same reference hits as the rungs
  (the T15 map hit the compile writes, `configWritten`), so the verification gate's and the design gate's Effective
  HP compare; each display names the hit it used. **Amends:** D-294 (the verification display's EHP).
- **D-424, small fixes.** `scripts/run-usage.mjs` filters telemetry to the transcripts' session ids and groups the
  design steps by the header's `concept` (D-416). The checker's `[deck]` rule counts paragraphs, not physical lines.
  **Amends:** D-392's check.

## 16. The next live test

The user's: migrate the open-clear run (D-415), resume it, finalize r1-b-3 "Caster-Staff Warcaller" endgame-only,
and compare its rungs with a real build of the same kind that the user picks. The same resume can answer
`design:r1-x-1`, then `accept:file`, for Executioner's Howl's PoB file. The resume's pricing isn't stopped by
the old 429 (D-415). It should show a tree with little travel and no gaining swap left, the endgame guide, and one
PoB file named with the card id. The tree comparison judges D-418.

## 17. D-425 to D-428: the researchers, weapon sets, travel skills (milestone M-22)

Built after M-21 and its live test (choice 3).

- **D-425, lookups without a build.** Researchers drift into PoB's files (433 Grep and Read calls in two runs,
  about 275K tokens; work-log 2026-10-19). The tools gain: a tree distance with no build loaded (from a class start
  or a named node, on `search_tree_nodes` hits; `src/services/treeService.ts` already paths the static tree); the
  gem lookup's Spirit reservation, cost and cooldown by level; a base lookup by slot and level with implicits and
  defences; a config-option search; PoB's constants (base maximum Rage and the like) in mechanic mode. The
  researcher may Grep PoB's `Modules/` for how the engine computes something, cited by file and line; the data
  questions go through the tools. No scratch builds: the server holds one loaded build (FR-W3).
- **D-426, weapon sets.** The card names its weapon-set use (none, a second tree, a second weapon, a set-2 buff), and
  R1a and RV check for it; the library gains an entry for the user's three shapes (two trees for two skills; two
  weapons sharing an off-hand; both items in both sets so the swap changes only the tree), cited to the user and
  the wiki; D1 and its gate measure every set a card's skills use, with Spirit checked on each set and a set-2
  buff's effect measured on set 2 and carried to set 1 as a custom modifier with its reason (Mobalytics §6, two
  findings); the guide says what a swap costs in Life when set 2's tree holds less; the swap loop (D-418) learns to
  move weapon-set nodes within their own pool. **PG-71:** PoB counts socketed support gems across both sets
  (`Modules/CalcSetup.lua:2101-2104`); the game counts the active set's only (the user's test on Gem Studded,
  2026-10-19), so PoB overstates a per-support count on a build with a set-2 skill.
- **D-427, travel skills and the clear band.** The library's "Travel by action" gains the user's mechanism (a
  fixed-distance travel skill covers ground faster as attack, cast or skill speed rises; Leap Slam's travel adds up
  to 0.5 s to its attack time), cited to the user, with a search through a Travel support's gem lookup, which lists
  the 14 Travel skills (Stomping Ground). The clear band (D-407) reads a travel skill's pace (uses a second times
  distance per use) and sprint or skill-driven movement beside movement speed (Mobalytics §6, Rampage and
  sprinting). `lookup_game_data` gains a gem search by skill type.
- **D-428, the library and the gaps.** A warcry Standard kit (the open-clear run's obvious card borrowed the Maces
  kit's line); **PG-72:** Avatar of Fire drops gained cold and lightning where the wiki says they convert first
  (the user's rule; untested in game); the compile counts ring slots against a build's groups (Mobalytics §6: ten
  groups need an Unset Ring); a unique tame's tablet modifier with no line in the pin, a gap entry. Deferred:
  several tames per stage (plan schema 5 holds one) and mid-campaign respecs (a campaign item).

## 18. Work units

| Unit | What | Milestone |
|---|---|---|
| WU-92 | `get_node_power` (C-55): the bridge's `node_power` handler (one pass, every stat, the guards, state restored), the legal best swap on a scratch tree with `protect_for` and the clear entry's guard, the 120 s long action, the router and tool metadata; `get_passive_upgrades` drawing its main-tree candidates from it, in the same unit as the swap search; README table and tool counts | M-21 |
| WU-93 | Plan schema 6 (`tree.needs`, left out of `buildSha1`); the record's `requirements`; skeleton stages measured against the rungs' reference hits (D-423); `guide_run {resume}` with its no-engine router rule | M-21 |
| WU-94 | `run-log.mjs`: schema 4, `migrate`, `init`'s `noNinja`, pin commit and digest, `resumes[]`, the answer forms (`pick` of several, `accept:file`, `campaign`, `accept:verification`, `decline:<note>`, `guide:<id>`, `campaign:<id>`, `design:<id>`), the escalation forms with F1, the build displays; `check-run.mjs`: builds, `--build`, F1 and its escalation, D1-tree, `V4-campaign`, the `tree` part, `refused` and `tool-refused`, the per-build order rules and run endings, resume markers, the endgame template and reward-pick rules, the pending-decision exemption, the paragraph count; `render-audit.mjs --build`; `run-usage.mjs`'s session filter, several transcripts and per-build groups | M-21 |
| WU-95 | `SKILL.md` (its description, the compaction rule, the queue, the answers, F1, `--resume`, `--campaign`, `guide:<id>`, the refusal route, no trade after a stop) and its references (`checkpoints.md`, `gates.md`, `run-folder.md`, `run-log.md`, `start.md`, `pricing.md`, `fix-round.md`, `task-header.md`, `offline-and-test.md`'s answers); the four agent definitions: the coordinator's tool list gains `get_node_power`, `buildFolder` paths, the refusal rule, the league rule | M-21 |
| WU-96 | `D1-build.md` (needs, reward picks, ascendancy order), the new `D1-tree.md` and `F1.md`, `D1-finish.md` (the needs' and the order's claims), `D1-gate.md` (the `tree` part, `tool-error`, the display lines), `R1b.md`'s league rule; the library's travel rule | M-21 |
| WU-97 | The endgame template, `W1.md` (the template from the plan, the campaign mode), `V4.md` (the template's H2s, the campaign mode), the writer's and verifier's descriptions | M-21 |
| WU-98 | The 429 investigation and its fix (D-422); `scripts/compact-reminder.sh` and `docs/build-guide/run-settings.example.json` (D-420, D-421) | M-21 |
| WU-99 | The live test (§16): the user's, with the coordinator | M-21 |
| WU-100 | D-425's lookups and the researcher's Grep rule | M-22 |
| WU-101 | D-426, weapon sets, and PG-71 | M-22 |
| WU-102 | D-427, travel skills, the clear band, the skill-type search | M-22 |
| WU-103 | D-428, the library and the gaps | M-22 |

Order in M-21: WU-92, WU-93 and WU-94 in parallel lanes (server, schema and record, scripts), then WU-95, WU-96 and
WU-97 (skill files and agent definitions), WU-98 beside them, then WU-99.

## 19. Acceptance criteria (M-21)

- **AC-P73 (WU-92).** Engine, on a fixture build:
  - for one stat, `get_node_power`'s gains and losses equal `PowerBuilder`'s for every node it lists; with two
    stats, one request, and the second stat's figures equal a one-stat call's;
  - its lists include small passives and keystones, and leave out every branch containing a `keep` node, a
    skill-granting node or a weapon-set node;
  - the best swap, applied to the fixture's plan stage and compiled, gives a tree that is connected, fits its
    points, passes V1's `tree-shape` and `tree-continuity`, and adds no weapon-set or ascendancy node; on a fixture
    whose cheapest gain lies past the removed branch, the swap's points count the new path;
  - on a three-rung fixture, `m`'s best swap with `protect_for` `b` and `n`, applied to all three and compiled,
    leaves every rung connected and passing `tree-continuity`, and removes no node `b` or `n` builds on;
  - a swap that would cost more than `max_loss` on a stat, lower movement speed, or lower the clear entry's radius or
    uses per second (on a fixture whose clear group isn't the main skill) is not returned;
  - Mana regen alone ranks; an unknown stat and "Offence/Defence" are refused with the engine's list;
  - the active loadout, the level and the build's `revision` are the same before and after a call, including one
    that fails;
  - `get_passive_upgrades` ranks a notable whose text holds none of its old keywords, and keeps its DPS field.
- **AC-P74 (WU-93).** Engine and unit: a stage's record holds `requirements.level` and what sets it (a gem's level
  requirement above the items'); a skeleton's EHP is computed against the rungs' reference hits; a schema-6 plan with
  `tree.needs` validates and compiles, with or without a need's `claim`; a need naming a node the stage lacks is
  refused; V1 reports `missing-reason` for a need with no `claim` or one naming no claim of the stage; a change to a
  need's `claim` keeps `buildSha1`, and a change to its `nodes` changes it; `guide_run {resume}` returns its three lines for a run folder with no engine running, and refuses a
  folder with no run log.
- **AC-W76 (WU-94).** Script unit, on fixture runs:
  - `migrate` turns a schema-3 run with a build into schema 4 with `builds[0].folder "."` and `concept` on its
    `design` and `final` checkpoints, and one without a build into schema 4 with no build;
  - the checker passes a run with two builds in `builds/<id>/`, one `full` and one `endgame`, each guide held to its
    template's H2 list and the endgame one to its reward-pick and 2,300-word rules; fails a `design` checkpoint with
    no `concept`; fails a build whose `guide` field disagrees with its plan;
  - the order rules: F1 after a design `accept` and after `accept:file`; D1-build, D1-tree, D1-finish, the D1 gate;
    D1-tree after a `tree` failure; a `campaign` answer followed by D2, and for a `completed` build a `V4-campaign`
    pass; `accept:verification` followed by a verification visit; `decline:<note>` ending the build
    `not-accepted`; entries after `stop` only behind a resume, placed by the `resumes[]` entry's recorded lengths;
    `design:<id>` after a resume showing a stopped build's design gate; an F1 escalation with each of its four
    options;
  - `migrate` prefixes a schema-3 decline with `decline:`;
  - the checker accepts a re-run after a `refused` entry or a `tool-refused` verdict, and still fails a D1 gate
    after a `fail` entry;
  - `## Pending decision` passes in a notes file, at a visit with or without questions;
  - the `[deck]` rule passes a wrapped one-paragraph section;
  - the PoB file's name carries the card id; `display design --build` and `render-audit --build` read that build;
  - `init` records `noNinja`, the pin's commit from `pob-pin.json` and the digest;
  - `run-usage.mjs` counts only the given transcripts' sessions in a telemetry file holding three.
- **AC-W77 (WU-95 to WU-98).** Static, these files carry their rules:
  - `SKILL.md`: the compaction rule in its first 40 lines; the verification gate's `pick` of 1–3 cards; the
    design gate's `accept:file`; the final gate's `campaign`, `accept:verification` and `decline:`; F1; `--resume`,
    `--campaign` and `guide:<id>`; the `refused` route; no trade tool after a stop; its description naming both
    guides;
  - `checkpoints.md`: notes after each answer, and `## Pending decision` before a yes;
  - `D1-build.md`: `tree.needs` with earned-state producers, the reward picks without D2, the ascendancy order;
    `D1-tree.md`: the ladder order, `keep` and `protect_for`, compiling every rung a swap touches, the undone swap
    written as a need, spare points, the 3% stop, 8 swaps per rung, the floor first; `F1.md`: the sha1 check,
    `accepted`, its routes and its escalation options; `D1-finish.md`: the needs' claims and the ascendancy order's
    claim;
  - `D1-gate.md` and `gates.md`: the `tree` part, `tree-swap`, `tool-error`, their routes; the display's tree line;
  - `templates/guide-endgame-template.md`: its twelve H2s, Switching over and the 2,300-word cap; `W1.md` picks the
    template by the plan and has its campaign mode; `V4.md` its campaign mode;
  - the coordinator's definition lists `mcp__pob2__get_node_power` (`tests/static/buildGuidePipeline.test.ts`
    updated), and every definition carries the `refused:` rule; the coordinator's league rule makes no trade call
    after a stop;
  - `references/patterns.md`: "minimize travel distance", cited to the user;
  - `scripts/compact-reminder.sh` prints the compaction rule; `run-settings.example.json` holds the `compact` hook
    and the allow list.
- **AC-W78 (WU-99).** The live test of §16: the user's judgment of the tree against the reference build, recorded in
  the work-log.

## 20. Risks

- **Node power can't see sustain, area, or what PoB doesn't model,** so the swap loop optimizes what it measures.
  The needs and the guards (the clear band's inputs, movement speed) protect the rest, and a long branch with a
  weak reason shows at the design gate.
- **The swap loop is greedy** and can stop in a local best; up to 8 swaps per rung from a skeleton that already
  holds the card's targets is the bet. The gate's best-swap check catches a loop that stopped early.
- **The legal swap search** (a scratch tree, paths recomputed after the removal) is new code over PoB's
  `PassiveSpec`; WU-92 starts with it, and AC-P73 holds its trees to V1's own checks.
- **Time:** each swap is one node power call (about 15 s for the pass at depth 6, plus a few seconds re-measuring
  up to 5 candidate swaps on the scratch tree) and a compile of the rungs it touches; 24 swaps and the gate's three
  calls are about 15 to 25 minutes of engine time per design.
- **More builds, more tokens:** each endgame-only build adds about 0.7M output; the user picks how many.
- **Schema 4 touches every script, many references and the agent definitions;** the migration keeps old runs
  readable, and the checker's fixtures cover both layouts.
- **A resumed run's cards** were verified on an older pin or league; the display says so, and D1 measures afresh.

## 21. Choices for the user

All four taken as recommended (the user, 2026-10-19).

1. **The output targets** (D-416): shared phases 1.2M, an endgame-only build 0.75M, a campaign 0.4M
   (recommended), or other figures.
2. **The tree threshold** (D-419): a rung fails the D1 gate when a swap left gains at least 5% Full DPS within its
   `max_loss` (recommended), or report the swap at the design gate without failing the gate.
3. **The order:** M-21 (endgame first, the tree, the run's fixes, compaction) and its live test first, then M-22
   (the researchers' lookups, weapon sets, travel skills, the library) (recommended), or one milestone for all.
4. **`get_passive_upgrades`:** rebuild it on the power builder (recommended: the README and the skill's references
   name it, and it keeps its arguments and output), or retire it for `get_node_power`.

## 22. The independent review and its resolution

The review (2026-10-19, one reviewer with fresh context, read only, about 375K tokens) found the numbering clean and
the spike's claim sound, and 5 blockers, 18 should-fix findings and 12 nits:

| Finding | Resolved in |
|---|---|
| B1 `tree.needs` refused by the strict plan schema | §12: plan schema 6, left out of `buildSha1`; the ascendancy order in the ordered `ascendancyNodes` (§3, §7); WU-93, AC-P74 |
| B2 the per-rung loop ignores the ladder (D-282) | §12: the loop in ladder order, `m`'s swaps applied up, the rung before's nodes in `keep`; §13 the same at the gate |
| B3 the best swap can describe an illegal tree | §11: searched on a scratch tree after the removal, union of paths, legality checks, attribute choices returned; AC-P73 rewritten against V1's checks |
| B4 the D2 gate's route re-runs D2, which an endgame-only build lacks | §7: F1, its own step and routes; the D2 gate only after D2 |
| B5 the coordinator can't call the tool; the agent definitions unchanged | §6, §15, WU-95: the four definitions; AC-W77 |
| S1 Offence/Defence; the stat count | §4, §11: left out; the list as the engine holds it |
| S2 loadout and level in a `read` tool | §11 State; AC-P73 |
| S3 `keep` protects the wrong nodes | §11 Protected nodes; §12 earned-state producers as needs |
| S4 threshold, floor, clear speed, drift | §11 `max_loss` and guards; §12 floor first, undo, 3% stop against the gate's 5% |
| S5 `tree` unverified; the checker can't recompute | §13 `tool-error`, the gate re-run once; the checker checks shape |
| S6 the loop's cost and D1-build's context | §12 D1-tree, its own step; §11 compact mode; §10 re-estimated |
| S7 the runner can't see a refusal | §15 D-421: `tool-refused`, `refused:`, all four definitions; the allow list |
| S8 market day; `get_leagues`' sources; a resume never prices | §15 D-422; §9 the stop per session |
| S9 state per build | §5: accepted findings per build, the queue rule, no second finalize |
| S10 file-only and completed routes | §5, §9: `guide:<id>`, `campaign:<id>`, the statuses |
| S11 the campaign breaks the revision rules | §9: round copy, W1's and V4's campaign modes, the fix round, a ledger refusal escalates |
| S12 migration and resume gaps | §6, §9: `resumes[]`, backfilled `concept`, resume markers, the unsaved question per resume, several transcripts, the pin read from `pob-pin.json` |
| S13 re-verifying contradicts "verified once" | §9: dropped |
| S14 `## Pending decision` fails the notes rule | §14: exempted |
| S15 reward picks, word cap, template source | §8 |
| S16 rebuilding `get_passive_upgrades` | §11: depth 6, its DPS field kept, ascendancy candidates as today |
| S17 no "Amends" lines | an Amends line on each decision |
| S18 test config, answer forms, order rules | §5 `decline:<note>`; WU-94, WU-95; AC-W76 |

The nits: N1 (`concept` already on W1 and V4) §3, §6, AC-W76; N2 (114 nodes) §4; N3 (who uses
`get_passive_upgrades`) §21; N4 (`trade_query_options`) §15; N5 (D1's return) §12; N6 (`resume`'s router rule and
path form) §9; N7 (one pass for every stat) §11; N8 (group by `concept`) §15; N9 (the final display's source) §13;
N10 (the descriptions) §8, WU-95, WU-97; N11 (the launcher's settings) §14; N12 (criteria) §19.

**The re-check** (the same reviewer, about 58K more tokens, 433K in all) found 26 findings resolved and 9 partly, and
1 blocker, 9 should-fix findings and 5 nits left, resolved in the second revision:

| Finding | Resolved in |
|---|---|
| R1 a swap on `m` applied up the ladder can disconnect `b`'s and `n`'s own nodes | §11 `protect_for` and Protected nodes; §12 compile every rung a swap touches, undo on any rung's failure; §13 the same at the gate; AC-P73's three-rung fixture |
| R2 a need's claim belongs to D1-finish; the hash and the gate | §12: `claim` optional until D1-finish, `missing-reason` at V1, only `claim` out of `buildSha1`; AC-P74 |
| R3 W1 reads no node ids | §7: the order's claim names the nodes; V4 checks it |
| R4 `resumes[]` can't place a resume | §9: each entry records the four lists' lengths |
| R5 the clear guard reads the clear entry, not the main skill | §11 `clear_group` and the guard from `clearEntryOf`; AC-P73 |
| R6 an undone swap comes back | §12 step 4: written as a floor need |
| R7 F1's `accepted` and escalation | §7: its header, its escalation form and four options; AC-W76 |
| R8 a file-only build's campaign; the campaign pass's form | §9: a full run from D2 for a file-only build; `V4-campaign`, its `check`, H1 and numbering |
| R9 a stopped build can't return to its design gate | §9 `design:<id>`; §16 |
| R10 `get_passive_upgrades` needs the swap search | §18 WU-92: the same unit |

The nits: N1 (the stabilization spec's D-47) §11; N2 (a Distilled Emotion's price) §15; N3 (`migrate`'s `decline:`)
§9; N4 (up to 5 candidate swaps; the time) §11, §20; N5 (compiling the rungs before a call; a user's node as a need;
the runner's `guide_run {resume}`) §9, §12.
