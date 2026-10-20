# Amendment 9: endgame builds first, and trees that minimize travel

**Status: DRAFT for the user's approval, 2026-10-19.** It carries:
- the user's direction after the open-clear run: finalize one or more builds, endgame only, with the campaign on
  request (work-log 2026-10-19, "endgame builds first, several per run"), and the user's four rulings on it ("the
  user's rulings; node power; Gem Studded checked");
- the user's review of that run's tree and PoB's node power, with a spike that runs it in our engine (§4);
- the candidates the work-log collected on 2026-10-19: compaction while a run waits, researchers reading PoB's
  files, weapon sets, travel skills, and the open-clear run's own findings;
- the Mobalytics proposal's seven pipeline findings (`../studies/2026-10-18-mobalytics-proposals.md` §6).

It is written against spec v1.6 and amendment 8 (built as M-20, merged at `a4e5bd8`). Paths are from the
repository root, except stage files (`D1-build.md` and so on), which are under
`.claude/skills/build-guide/references/stages/`. Decisions continue from D-411, work units from WU-92, criteria
from AC-W76 and AC-P73, contracts from C-55, PoB gaps from PG-71.

**Names.**
- A **build** is one finalized card carried through the design: its plan, its compile record, its PoB file and its
  guide. Today a run holds one build; under this amendment it holds one per finalized card.
- The **rungs** are the three endgame stages D1 designs: entering maps (`m`), budget (`b`) and non-budget (`n`).
- An **endgame-only build** has the rungs and no campaign stages; its guide is the **endgame guide**, which tells
  the reader to level with any build of the class. A **full build** adds the campaign (D2) and the full guide.
- **Node power** is PoB's own ranking of passive nodes (the tree tab's "Show node power" and its power report):
  for every node within a distance of the allocated tree, what allocating it with its path adds to a chosen stat,
  per point, and for every allocated node, what removing it with the nodes that depend on it costs, per point.
- **Travel** is the points a tree spends on nodes that give the build nothing themselves and only connect it to
  nodes that do. **Minimizing travel distance** is the user's rule for trees (§1).
- From the pipeline: a **card** is one candidate build (`cards/<id>.md`); R1b compiles its **skeleton**; D1 is the
  endgame design (D1-build, D1-finish, then the D1 gate); the **design gate** shows the user the rungs before
  anything else is written (D-362); D2 adds the campaign; the D2 gate checks every stage and runs the final compile,
  the only compile that writes a PoB file into the builds folder; W1 writes the guide, V4 verifies it.

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
  90K (3 gate questions), RV 83K. Amendment 4's 1M run cap predates the rival and amendment 8's reading.
- **The tree:** the R1b steps built each skeleton's tree by naming targets and pathing to each: 22 to 35
  `find_path_to_node` calls per card, with `search_tree_nodes`, and no `get_passive_upgrades`. D1-build starts from
  the skeleton's tree and called `get_passive_upgrades` once, D1-finish once.
- **Blocked by the permission system:** the D1 gate's measure-only `compile_plan` was refused by Claude Code's
  auto-mode classifier ("[Interfere With Workloads]") after about 20 such calls had passed. The skill has no route
  for a refused call: a compile failure re-runs D1-build and D1-finish (about 900K subagent tokens to change
  nothing). The runner stopped; the user allowed the tool and had the gate re-run alone.
- **Pricing:** D1-finish's 22nd price call got an HTTP 429, so pricing stopped (`pricing.md`); 21 entries are
  `unavailable` and every rung total `unverified`. The D1 gate then called `get_leagues` on the trade site, after
  pricing had stopped.
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
  build is a design that goes from the design gate's accept to the final compile without D2.
- The plan compiler compiles a plan with no campaign stage: the ladder's first rung continues "from none when there
  is no campaign stage" (slice 02 §3.7, `tree-continuity`).
- The guide's Survival by stage already covers the rungs only (D-354).
- The deck, the cards, the research, the dossier and the interviews are run-wide; each verified card keeps its
  skeleton under `concepts/<id>/`; gate verdict files and `stages[]` entries already carry the card id.
- The server takes a plan anywhere under a run folder, and keys the write ledger by the run folder, its first two
  path segments (`src/utils/guidesPath.ts`, `runFolderOf`): `builds/<id>/plan.json` needs no server change.
- `get_passive_upgrades` already divides a measured gain by its path's points (§4), and the design gate already
  offers `verification`, which drops the build for another card.

## 4. The spike: PoB's node power in our engine

**PoB's code** (pin): `CalcsTab:PowerBuilder` (`vendor/PathOfBuilding-PoE2/src/Classes/CalcsTab.lua:521`) visits
every node with modifiers, not ascendancy-locked, within `nodePowerMaxDepth` of the tree. An unallocated node gets
its gain alone (`singleStat`) and with its whole path (`pathPower`); an allocated node gets its loss alone and with
every node that depends on it (`node.depends`). The stat is any entry of `data.powerStatList`
(`Modules/Data.lua:127`): Full DPS, Combined DPS, TotalEHP, Life, the mana and regeneration figures, the attributes,
movement speed and others. The tree tab's power report (`Classes/TreeTab.lua`, `BuildPowerReportList`) divides
`pathPower` by the path's points (`node.power.distance`), or an allocated node's by its dependants' count.

**The server's `get_passive_upgrades` isn't that** (`src/handlers/treeHandlers.ts:487-600`): it takes notables
only, found by text search on up to four keywords ("damage", "critical", "life", "energy shield", "resistance"),
the 8 nearest per keyword, so at most 32 candidates; it skips small passives, keystones and every notable whose
text lacks those words (warcry speed, area, cooldown, exposure, culling); it measures CombinedDPS or TotalDPS, not
Full DPS; it has no distance limit; and it never measures what an allocated branch is worth.

**The spike** (2026-10-19; a standalone script booting the vanilla headless wrapper as `scripts/check-construct.lua`
does, run from the pin's `src/` with temp `HOME`, `POB_DIRECTORY` and `XDG_STATE_HOME`, at `nice -n 19`), on the
open-clear run's final compile, rung `n` (level 95, Warbringer, 118 main-tree nodes allocated, Full DPS 178,838,
TotalEHP 7,666):

- **It runs headless** with no change: called outside a coroutine, `PowerBuilder` runs to the end in one call. Its
  inputs (node paths, the misc calculator) already serve `search_tree_nodes` and `calc_with`.
- **Time, one stat:** 8.8 s CPU within 4 points (1,041 nodes), 12.9 s within 6 (Full DPS; TotalEHP 13.8 s), 15.0 s
  within 8 (1,776 nodes). Two stats at depth 6 take about 27 s, near the bridge's 30-second request timeout (D-47).
- **Unallocated, within 8 points:** each of these alone adds 13–19% Full DPS: Rhythm of Ice (4 points, +13.0%),
  Warcry Speed (5, +13.7%), Bringer of Order (5, +14.3%), Cold Nature (6, +18.5%); single cold-damage and
  shapeshifted-damage nodes add 2.8% for 1 point. (The gains aren't additive.)
- **Allocated:** 64 of the 114 main-tree nodes give neither Full DPS nor TotalEHP alone. The weakest branches
  include two Dexterity branches of 7 and 8 points that cost nothing on either stat when removed; Cold Penetration
  (5 points in two branches), worth nothing because the rung's clear config (`enemyIsBoss` None) gives the enemy no
  resistances; and mana-sustain nodes (Mana on Kill, Mana Regeneration, Mana Cost Efficiency) that the howl spam
  may need, which neither stat sees.

**What it means:** node power finds the user's dozens of cheap gains and the long branches directly. It can't see
what PoB doesn't count in the chosen stats: sustain, area for clear, a boss-only gain under a clear config, or an
attribute a gem needs. So a tree step that uses it needs a list of the build's **needs**, each with its reason,
which no swap may break (D-418).

## 5. D-411: endgame builds first, several per run

- **The verification gate** (step 5) finalizes 1 to 3 verified cards: `pick:<id>[,<id>…]`, in the user's order, each
  with its own `changes`. The rules on what can be finalized are unchanged (D-303, D-342, D-400, D-408). The run's
  `roll` gives way to one roll per build (D-412).
- **Builds run in turn,** since the server holds one loaded build and coordinator steps never overlap (FR-W3): for
  the first queued card, D1-build, D1-finish, the D1 gate and its design gate; then its final compile, guide,
  verification and final gate; then the next card. A build's escalation stays its own (§5 of `SKILL.md`): option 3
  drops the build and returns to the verification gate; option 4 ends the build `escalated` and goes on to the next.
- **The design gate's answers** (checkpoint `design`, per build):
  - **accept**: the final compile (the D2 gate, D-413), the endgame guide, V4 and the build's final gate;
  - **file only** (`accept:file`): the final compile and nothing after it; the build ends `file-only` (the PoB
    file, no guide). A guide can follow later through `--resume` (D-415). This is what the user wanted from the
    open-clear run;
  - **revise** (`revise:<text>`), unchanged;
  - **verification**: the build ends `dropped`, and the verification gate is shown;
  - **stop**: the build ends `stopped`, and the next queued card's design starts; with none queued, the run ends.
- **The final gate's answers** (checkpoint `final`, per build): **accept** (`completed`), **changes** (a revision,
  unchanged), **decline** (`not-accepted`), and two new ones:
  - **campaign**: the campaign for this build (D-415), then this gate again;
  - **accept, then verification** (`accept:verification`): the build ends `completed`, and once the queue is empty
    the verification gate is shown again, for more cards.
- **The run ends** when the queue is empty and the last answer didn't ask for the verification gate. Its `status` is
  `completed` when any build ended `completed` or `file-only`, else the last build's end (`not-accepted`,
  `stopped`, `escalated`), or `stopped` when no card was finalized.
- **The displays** name the build: `display design --build <id>` and `display final --build <id>`; the
  verification gate's display lists every build of the run with its status.

## 6. D-412: one folder per build; run log schema 4

- **The run folder** gains `builds/<id>/`, one per finalized card, holding what the root holds today for the one
  build: `plan.json`, `compile-record.json`, `compiled-build.xml`, `guide.md`, `audit.md`, `reports/V4-<n>.md`
  and `rounds/<n>/`. Gate verdicts stay in `reports/gates/`, already keyed by card id. Every stage file, script and
  display that names a root build path names `<buildFolder>/` instead; the task header gains `buildFolder`
  (`builds/<id>`).
- **The PoB file** of a build is `<slug>-<YYYY-MM-DD>-<n>-<id>`: the run folder's last two segments and the card id,
  joined with `-`, so two builds of one run never share a file (D-113, D-199 as amended).
- **The run log, schema 4:**
  - `roll` is removed; `builds[]` is added, one per finalized card in finalize order: `{id, roll, status, folder,
    guide, pobFile}`, `roll` the card's identity (D-286), `status` one of `queued`, `designing`, `writing`,
    `completed`, `file-only`, `not-accepted`, `dropped`, `stopped`, `escalated`; `folder` its build folder; `guide`
    `null`, `endgame` or `full`; `pobFile` the record's path once the final compile wrote it.
  - every `stages[]` entry of D1, D2, the gates, W1 and V4 carries `concept`, the build's card id (today W1 and V4
    carry none);
  - `checkpoints[]` entries of `design` and `final` carry `concept`;
  - `noNinja` (`true` or `false`) is recorded at `init` (D-420);
  - `outputs` is replaced by each build's entry and the run-wide `dossier`.
- **The scripts:** `run-log.mjs` writes schema 4 and gains `migrate` (D-415); `check-run.mjs` checks every build in
  its folder, `--build <id>` with `--changed` and `--snapshot`; `render-audit.mjs <runFolder> --build <id>`. The
  checker's order rules follow D-411's routes, per build.

## 7. D-413: the endgame-only build

- **The campaign reward picks** (D-265) are D2's today, which adds them to the rungs. For an endgame-only build, D1
  makes them: each reward choice the campaign offers (`data/campaign/progress.json`) is set on all three rungs as a
  `config.scenario` entry citing its option, so the endgame numbers include them, and the endgame guide names them.
  D2 keeps D1's picks when the campaign is added later.
- **The final compile:** the D2 gate runs on a plan with no campaign stage, unchanged in what it checks (every stage,
  then the final compile with `buildName`). An endgame-only build runs it right after the design gate's accept or
  `accept:file`.
- **The level the build works from:** the compile record gains, per stage, `requirements {level, by[]}`: the
  highest level requirement among the stage's equipped items and socketed gems, as PoB computes them, and which
  items or gems set it. The endgame guide says when the build comes online from `m`'s figure.

## 8. D-414: the endgame guide

A second template, `templates/guide-endgame-template.md`, for a build with no campaign stage. W1 picks the template
from the plan: no campaign stage, the endgame guide.

- **Its H2s,** in order: At a glance; Your PoB file; Switching over; Survival by stage; Priorities; Endgame:
  entering maps; Endgame: budget; Endgame: non-budget; How to play it; What PoB can't show (ending with Known
  issues); FAQ; Changelog. Leveling, Campaign route and rewards, and Gem and ascendancy timing are gone.
- **Switching over** (about 250 words) replaces them:
  - level with any build of the class; the build works from level <`m`'s `requirements.level`>, because of <what
    sets it>;
  - the ascendancy, and the order to take its nodes (D1 lists them in that order with a `reason` claim);
  - the campaign reward picks the plan makes (D-413), each with its reason;
  - for a respec or a player switching from a levelling build: the PoB file holds the whole tree for each rung;
    refund what the rung doesn't use, and the gold cost isn't computed.
- **About 2,100 words** in all (the full guide's 3,000 less the three campaign sections, plus Switching over); the
  Your PoB file section lists the three rung loadouts only.
- **The run checker** holds a guide to its template's H2 list, chosen by the build's `guide` field; V4 reads the
  same field. `audit.md` is unchanged: its Checks are per rung.

## 9. D-415: the campaign on request, and resuming a run

- **The campaign** for a completed endgame-only build, from the final gate's `campaign` answer or from
  `/build-guide --campaign <runFolder> <id>`: D2 adds the campaign stages to the build's plan; the D2 gate checks
  every stage and re-runs the final compile, which rewrites the build's PoB file (the write ledger allows it while
  the file is unchanged since the run wrote it, D-211; otherwise the compile is refused, as today); `render-audit`;
  W1 rewrites the guide with the full template, keeping the endgame sections' text where the plan didn't change; one
  V4 re-check of what `check-run.mjs --changed` lists (a revision runs no full pass, D-352); the build's final gate.
  The build's `guide` becomes `full`.
- **Resuming** a run in a later session: `/build-guide --resume <runFolder>` reads the run log, sets `status`
  `running`, prints the league digest's staleness line and the verification gate's display, and goes on from the
  user's answer there: finalize more verified cards, verify others, brainstorm more, or stop. `--campaign` resumes
  the same way and starts D2 for the named build. The brief check doesn't run again (the brief is in the log).
  - `mcp__pob2__guide_run` gains `{resume: <runFolderRel>}`: it checks the folder holds a `run-log.json` and returns
    `runFolder`, `runFolderRel` and `loadedBuildUnsaved`, writing nothing.
  - **A changed pin or digest:** the run log records the pin's commit at `init` (schema 4); when it differs, or a
    newer league digest exists, the verification display says so, and the user can re-verify a card before
    finalizing it.
- **Migrating a schema-3 run:** `run-log.mjs <runFolder> migrate` rewrites the log as schema 4. The old run's
  build, when it has one, becomes `builds[0]` with `folder: "."` (its files stay at the root), its `roll`, its status
  from the old `status`, and `guide` from whether a guide exists. The checker reads a build in `"."` as today's
  layout. The open-clear run migrates this way, so its r1-b-3 can be finalized from it (§16).

## 10. D-416: output targets per build

Amendment 4's one 1M-output cap per run becomes targets by phase, measured by `scripts/run-usage.mjs` per build (the
card id is in every design step's description):

| Phase | Measured | Target (choice 1) |
|---|---|---|
| The shared phases: brainstorm, verification, the rival, gate questions | about 1.1M (open-clear, one round) | 1.2M |
| An endgame-only build: D1, the final compile, W1, V4, a fix round | about 0.6M (estimate: D1 286K here; W1 226K and V4 134K in the lean run, both with a campaign) | 0.75M |
| A campaign added to a build: D2, the D2 gate, W1's revision, the V4 re-check | about 0.3M (estimate: D2 167K in the lean run) | 0.4M |

The targets are measured after a run, as amendment 4's cap was; no step stops for them.

## 11. D-417: node power as a tool (C-55)

`mcp__pob2__get_node_power` (group `core`, engine `read`, as `get_passive_upgrades`), on the loaded build:

- **Arguments:**
  - `stats`: 1 to 3 of the stats PoB's tree tab offers for node power, by PoB's id or label (the user asked for the
    same inputs as PoB's UI, 2026-10-19). The list is `data.powerStatList` less its item-only entry: 49 stats (Full
    DPS, Hit DPS, Average Hit, the ailment DPS, Life, Mana, Mana regen, Energy Shield, Spirit, Armour, Evasion, the
    attributes, the effective maximum hit and the damage taken by type, crit and ailment chances, block, the avoid
    chances, movement speed and others) and PoB's combined
    "Offence/Defence". The tool reads it from the engine, so it follows the pin. An unknown name fails with the list.
    Default `["FullDPS", "TotalEHP"]`.
  - `max_distance` (points from the tree, default 6, at most 12); `loadout` (the loadout to measure, by name; default
    the active one); `keep` (allocated node ids no swap may remove: the build's needs, D-418); `limit` (rows per
    list, default 15).
- **It runs PoB's own `PowerBuilder`** once per stat, with `powerStat` and `nodePowerMaxDepth` set, and returns:
  - **best unallocated:** nodes ranked by path gain per point over the stats (each stat's gain relative to the
    build's figure, summed), each with its name, type, points, path, and each stat's gain alone and with its path;
  - **weakest allocated:** branches (a node and its dependants) ranked by loss per point, the same way, `keep` nodes
    and their dependants excluded;
  - **travel:** the allocated main-tree nodes that give nothing on any of the stats alone, by count;
  - **the best swap:** remove the weakest branch, spend its points on the best per-point nodes in reach, measured
    together with `calc_with` (the swap measured as one change, since gains aren't additive): each stat's change, in
    percent. "No gaining swap" when none gains.
  - what PoB can't measure among the nodes it listed (C-47's section, as `get_passive_upgrades` gives it).
- **One engine request per stat,** each with a 120 s timeout (the bridge's long-action list, D-47): one stat at
  depth 6 took about 13 s in the spike, and a request that outlives its timeout kills the engine (C-4).
- **`get_passive_upgrades`** keeps its arguments and output, and draws its candidates from the power builder (every
  node in reach on Full DPS and TotalEHP, by its focus), so it stops missing nodes whose text lacks its keywords.
- **The power stats a run uses:** Full DPS for damage (the generalization's headline figure, decided 2026-10-10; the
  compiled groups carry `includeInFullDPS`) and TotalEHP for defence.

## 12. D-418: the tree minimizes travel

D1-build's step 5 (Tree) changes. R1b's skeleton tree stays a sketch: it shows the card's targets and need not be
efficient.

- **Needs first.** Before the tree, D1-build lists the rung's needs on the plan, as `tree.needs[] {nodes, reason}`
  (a `reason` claim each): mana or life sustain, an attribute a gem or item requires, area or movement for clear,
  a boss-only gain (penetration and exposure count for nothing on a clear config with no enemy resistances), a
  defence the floor needs, a node the card's engine names. A need's nodes go in `keep`.
- **A need with a stat is met by node power on it.** When PoB has a stat for the need (Mana regen for sustain, an
  attribute for a requirement, movement speed), D1-build calls `get_node_power` on that stat for the cheapest nodes
  per point that meet it, and keeps those; a need without one (area, a boss-only gain) carries its reason alone.
- **The swap loop,** per rung, after the first compile: call `get_node_power` with the rung's loadout and `keep`;
  apply its best swap when it gains (the plan's nodes edited, a measure-only compile); repeat until no swap gains
  more than the threshold, at most 8 swaps per rung. The loop replaces picking clusters and pathing to each:
  points go to the best gain per point near the tree, so the tree grows along one route through its clusters, and
  a long branch survives only as a need.
- **What it returns:** each rung's travel count before and after, and the swaps made, in D1-build's return.
- **The library** gains the user's rule in its tree advice (`references/patterns.md`): minimize travel distance;
  judge a cluster by its gain per point with its path; cited to the user, 2026-10-19.

## 13. D-419: the D1 gate checks the tree; the design display shows it

- **The D1 gate** calls `get_node_power` on each rung with the plan's needs as `keep`. A new verdict part, `tree`,
  fails a rung whose best swap gains at least the threshold (choice 2: 5% Full DPS, with no stat losing more than
  2%), with the swap as its finding (code `tree-swap`). It routes like a V2 failure: D1 re-runs with the verdict,
  up to 2 counted retries, then escalates.
- **The design display** gains, per rung, after the gear line: `Passive tree: <travel> of <points> points on travel;
  best swap left: <none | +<x>% Full DPS by moving <n> points from <branch> to <nodes>>`; and the needs, one line
  each, so the user sees why a long branch stays.
- **The final gate's figures** show each rung's travel count beside DPS and EHP (D-369).

## 14. D-420: a compaction while a run waits

From the work-log's 2026-10-19 section ("compaction while a run waits"); Claude Code compacts an idle session over
200,000 tokens after about 54 minutes, re-injects at most 5,000 tokens of an invoked skill and no reference.

- **Interview notes after each answer:** the runner writes `interviews/<gate>-<visit>.md` after each question it
  answers, not at the decision (`checkpoints.md`).
- **The pending decision on disk:** before asking for a yes, the runner writes the restated decision, with the
  user's words verbatim (a revision's `changes`, a new card's name and id), under `## Pending decision` in the
  visit's notes, and logs the checkpoint from them.
- **`noNinja` in the run log** (D-412), which the runner reads for every pricing step instead of remembering it.
- **A hard rule at `SKILL.md`'s top:** after a compaction, re-read `SKILL.md` whole, `run-log.json`, the current
  step's reference and the visit's notes, print the gate's display again (`display` doesn't record a second visit),
  and act on no yes the notes don't hold.
- **A `SessionStart` hook** with the `compact` matcher prints that rule: a committed script,
  `scripts/compact-reminder.sh`, named in the launcher's settings now and in the plugin's `hooks/hooks.json` when it
  is packaged.

## 15. D-421 to D-424: the run's other fixes

- **D-421, a refused call.** A step whose return or verdict says Claude Code's permission system refused a tool call
  (its text "Permission for this action was denied") isn't a failure of its producer. The runner stops and asks the
  user to allow the tool; then it re-runs the refused step alone, uncounted, after the stage entry logged with
  outcome `refused`. The checker accepts the same step after a `refused` entry. The launcher's settings allow the
  engine and file tools the coordinator uses (`mcp__pob2__compile_plan`, `mcp__pob2__guide_run`, the engine `read`
  tools in its list), leaving the trade tools to review; the user's own launcher already allows `compile_plan`.
- **D-422, no trade call after pricing stops.** Once pricing stops, no step calls any tool in group `trade`
  (`get_leagues`, `get_item_price`, `search_trade_items`, `search_stats`, `trade_query_options`, `find_upgrades`),
  not only price calls (`pricing.md`, `D1-gate.md`); the D1 gate's market day then comes from the run log's last
  recorded one, or is `unknown`. **The 429 is investigated:** the server's limiter (C-11) paces within the limits the
  trade site reports, yet the 22nd call was refused; the work unit finds whether the limiter's state, the call
  count, or the user's own trade use at the same time (the limits are per IP and account) explains it, and fixes
  what is ours.
- **D-423, comparable Effective HP.** A skeleton's stage is measured against the same reference hits as the rungs
  (the T15 map hit the compile writes, `configWritten`), so the verification gate's and the design gate's
  Effective HP compare; each display names the hit it used.
- **D-424, small fixes.** `scripts/run-usage.mjs` filters telemetry to the transcript's session id and groups the
  design steps by card id (D-416). The checker's `[deck]` rule counts paragraphs, not physical lines.

## 16. The next live test

The user's: migrate the open-clear run (D-415), resume it, finalize r1-b-3 "Caster-Staff Warcaller" endgame-only,
and compare its rungs with a real build of the same kind that the user picks. It should show a tree with little
travel and no gaining swap left, the endgame guide, and one PoB file named with the card id. The tree comparison
judges D-418.

## 17. D-425 to D-428: the researchers, weapon sets, travel skills (milestone M-22)

Choice 3 recommends building these after M-21 and its live test.

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
  findings); the guide says what a swap costs in Life when set 2's tree holds less. **PG-71:** PoB counts socketed
  support gems across both sets (`Modules/CalcSetup.lua:2104`); the game counts the active set's only (the user's
  test on Gem Studded, 2026-10-19), so PoB overstates a per-support count on a build with a set-2 skill.
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
  several tames per stage (plan schema 5 holds one) and mid-campaign respecs (a campaign-request item).

## 18. Work units

| Unit | What | Milestone |
|---|---|---|
| WU-92 | `get_node_power` (C-55): the bridge's `node_power` handler over `PowerBuilder`, the best-swap measurement, the 120 s timeout, `get_passive_upgrades` drawing on it; README table | M-21 |
| WU-93 | The record's `requirements`; skeleton stages measured against the rungs' reference hits (D-423) | M-21 |
| WU-94 | `guide_run {resume}`; run log schema 4, `migrate`, the pin's commit and `noNinja` at `init`; `check-run.mjs` and `render-audit.mjs` per build, the `refused` outcome, the paragraph count; `run-usage.mjs`'s session filter and per-build groups | M-21 |
| WU-95 | `SKILL.md` and its references: D-411's queue and answers, D-413's final compile, D-415's `--resume` and `--campaign`, D-420's compaction rules, D-421, D-422 | M-21 |
| WU-96 | `D1-build.md`, `D1-finish.md`, `D1-gate.md`, `gates.md`: D-413's reward picks, D-418's needs and swap loop, D-419's `tree` part and display lines; the library's travel rule | M-21 |
| WU-97 | The endgame template, `W1.md`, `V4.md` (D-414), the campaign rewrite (D-415) | M-21 |
| WU-98 | The 429 investigation and its fix (D-422); `scripts/compact-reminder.sh` and the launcher's settings (D-420, D-421) | M-21 |
| WU-99 | The live test (§16): the user's, with the coordinator | M-21 |
| WU-100 | D-425's lookups and the researcher's Grep rule | M-22 |
| WU-101 | D-426, weapon sets, and PG-71 | M-22 |
| WU-102 | D-427, travel skills, the clear band, the skill-type search | M-22 |
| WU-103 | D-428, the library and the gaps | M-22 |

Order in M-21: WU-92, WU-93 and WU-94 in parallel lanes (server, record, scripts), then WU-95, WU-96 and WU-97
(skill files), WU-98 beside them, then WU-99.

## 19. Acceptance criteria (M-21)

- **AC-P73 (WU-92).** Engine, on a fixture build: `get_node_power` lists unallocated nodes by path gain per point,
  small passives and keystones included, with their paths; lists allocated branches by loss per point, `keep`
  excluded; counts travel; reports a best swap whose change equals a `calc_with` of the swap; finishes within its
  timeout at depth 6 with two stats; ranks by Mana regen alone, and refuses an unknown stat with the list the
  engine gives; `get_passive_upgrades` ranks a notable whose text holds none of its old keywords.
- **AC-P74 (WU-93).** Engine: a stage's record holds `requirements.level` and what sets it (a gem's level
  requirement above the items'); a skeleton's EHP is computed against the rungs' reference hits.
- **AC-W76 (WU-94).** Script unit, on fixture runs:
  - `migrate` turns a schema-3 run with a build into schema 4 with `builds[0].folder "."`, and one without a build
    into schema 4 with no build;
  - the checker passes a run with two builds in `builds/<id>/`, one `full` and one `endgame`, each guide held to its
    template's H2 list; fails a design step with no `concept`;
  - the checker accepts a re-run after a `refused` entry, and still fails a D1 gate after a `fail` entry;
  - the `[deck]` rule passes a wrapped one-paragraph section;
  - `run-usage.mjs` counts only the transcript's session in a telemetry file holding two sessions;
  - `guide_run {resume}` returns the three lines for a run folder and refuses a folder with no run log.
- **AC-W77 (WU-95, WU-96, WU-97).** Static, these files carry their rules:
  - `SKILL.md`: the compaction rule in its first 40 lines; the verification gate's `pick` of 1–3 cards; the
    design gate's `accept:file`; the final gate's `campaign` and `accept:verification`; `--resume` and
    `--campaign`; the `refused` route; no `trade` tool after pricing stops;
  - `checkpoints.md`: notes after each answer, and `## Pending decision` before a yes;
  - `D1-build.md`: `tree.needs`, the swap loop with `get_node_power`, at most 8 swaps per rung, the reward picks
    without D2;
  - `D1-gate.md` and `gates.md`: the `tree` part, `tree-swap`, its routing; the display's tree line;
  - `templates/guide-endgame-template.md`: its twelve H2s and Switching over; `W1.md` picks the template by
    the plan;
  - `references/patterns.md`: "minimize travel distance", cited to the user.
- **AC-W78 (WU-99).** The live test of §16: the user's judgment of the tree against the reference build, recorded in
  the work-log.

## 20. Risks

- **Node power can't see sustain, area, or what PoB doesn't model,** so the swap loop optimizes what it measures.
  The needs list guards the rest, and a long branch with a weak reason shows at the design gate.
- **The swap loop is greedy** and can stop in a local best; up to 8 swaps per rung, from a skeleton that already
  holds the card's targets, is the bet. The gate's best-swap check catches a loop that stopped early.
- **Time:** each swap is a measure-only compile and a node power call of about 30 s; 8 swaps on 3 rungs is about 12
  minutes of engine time per design, on top of D1's present work.
- **More builds, more tokens:** each endgame-only build adds about 0.6M output; the user picks how many.
- **Schema 4 touches every script and many references;** the migration keeps old runs readable, and the checker's
  fixtures cover both layouts.
- **A resumed run's cards** were verified on an older pin or league; the display says so, and re-verifying is the
  user's choice.

## 21. Choices for the user

1. **The output targets** (D-416): shared phases 1.2M, an endgame-only build 0.75M, a campaign 0.4M
   (recommended), or other figures.
2. **The tree threshold** (D-419): a rung fails the D1 gate when a swap left gains at least 5% Full DPS with no stat
   losing more than 2% (recommended), or report the swap at the design gate without failing the gate.
3. **The order:** M-21 (endgame first, the tree, the run's fixes, compaction) and its live test first, then M-22
   (the researchers' lookups, weapon sets, travel skills, the library) (recommended), or one milestone for all.
4. **`get_passive_upgrades`:** rebuild it on the power builder (recommended: other handlers and the README use it),
   or retire it for `get_node_power`.
