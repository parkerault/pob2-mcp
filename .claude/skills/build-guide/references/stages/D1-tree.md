# D1-tree: trees that minimize travel (`build-guide-coordinator`)

The second of D1's three steps (D-418), a fresh coordinator step between D1-build (`D1-build.md`) and D1-finish
(`D1-finish.md`), so node power's output stays out of D1-build's context. D1-build left the three endgame rungs
(`m`, `b`, `n`) built, measured and with their needs, each rung's scaling named and its tree seeded from the stage
before it; you spend each rung's spare points, test its jewel sockets and swap its weak branches for better nodes
by PoB's node power, rung by rung, keeping every need, the survival floor and the boss rotation, and show what the
tree keeps that PoB can't measure. **One tree per loadout** (D-452): each rung's tree is the best one for its
loadout, so you may change any node of a rung but its needs, and a change on one rung goes to no other. The user's
rule: **minimize travel distance**, judging a cluster by its gain per point with its path.

## Inputs

- **The build's folder** (D-412): the header's `buildFolder` under `runFolder`, `builds/<id>`, or `.` for a run
  migrated from schema 3. `plan.json`, `compile-record.json` and the compiled XML are there; below, a bare
  `plan.json` or `compile-record.json` is that folder's, and `<plan>` is `<runFolderRel>/<buildFolder>/plan.json`
  (`<runFolderRel>/plan.json` when `buildFolder` is `.`).
- **Header:** `stage: "D1-tree"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`, `buildFolder`,
  `compile: "measure-only"`, `writes: ["<buildFolder>/plan.json", "<buildFolder>/trades.json",
  "<buildFolder>/pieces.md"]` (`pieces.md` for its `## Jewel lines` only, D-453), `accepted`, and `findings`:
  - after D1-build in the same attempt, `[]`;
  - on a D1 gate retry for its `tree` part, the verdict file and its `tree-swap` findings: each names a swap
    left on a rung, which the loop below finds again and makes;
  - the user's requests about the tree (`code: "user-request"`) from the design gate's `revise:<text>`, when the
    change is to the tree alone, a respec the user asks for among them (D-452): make them first (step 2);
  - on a guided retry after an escalation, the escalated verdict's findings, then the user's guidance (`code:
    "user-guidance"`), which you follow as a request.
- **Prompt:** D1-build's `for D1-tree:` line, when it ran before you: each rung's floor and needs. Your first
  compile confirms it.
- **Read**, the independent calls in one response: each rung through `mcp__pob2__guide_run {view: {plan:
  "<plan>", stage: "<id>"}}` for `m`, `b` and `n`, batched (its `tree`: `nodes`, `ascendancyNodes`,
  `weaponSetNodes`, `attributeChoices`, `needs`, `scales`; its `level`, `loadoutName`, `skills.groups`,
  `skills.cull`, `skills.boss`, `items.anoint` and `items.treeJewels`), `data/campaign/limits.json`
  (`passive-points.max` and `passive-points.from-levels`), `<buildFolder>/trades.json` when it exists, and
  `<buildFolder>/pieces.md`'s `## Jewel lines` when it has them (Grep). Grep or Read `plan.json` at a place to
  anchor an Edit; never Read it whole. A plan still at schema 7 never reaches you: D1-build moves it to 8 first.

## Work

**Temporary stages** (D-453). Every measuring copy you add has an id that starts `tmp`, then letters and digits
(`tmpb1`); no stage counts it as its predecessor. Remove each when its measure is read, and when you start, remove
any `tmp` stage a crashed step left in the plan.

**The arguments.** Every `mcp__pob2__get_node_power` call on a rung, here and at the D1 gate, comes after a
compile that loaded the rung (`mcp__pob2__compile_plan {stages}` loads only the named stages), and has:
- `loadout`: the rung's loadout name, exactly as the compile record has it (`stages.<id>.loadoutName`, the
  plan's `loadoutName`); its `(L<level>)` sets the level the tool measures at;
- `keep`: the nodes of the rung's `tree.needs`, and nothing else (D-452): no rung keeps the rung before's nodes,
  so a swap may touch any node of the rung but its needs;
- **no `protect_for`** (D-452): the tool keeps the parameter, but no rung protects nodes for another, since each
  loadout's tree is its own;
- `clear_group`, **always**: the record's group number of the rung's first enabled `role: "clear"` group (the
  `g<N>` of its keys in `skillOutputs`), else the main group's (`skills.main.group`). The tool's default is the
  main group, not the clear group, and its guards measure the group you pass;
- `max_loss: {clearUses: 2}`, the map form (the coordinator's ruling on the guards, amendment 9 §23): the clear
  skill's uses per second may drop up to 2%, as each stat after the first (TotalEHP) may, since uses per second
  is already in the damage the swap gains; the other guards keep their default 0 (`movement` and `clearRadius`:
  movement speed and the clear skill's radius), so any loss there rejects a swap, and `maxHit`, the lowest of
  PoB's five per-type maximum hits taken, its default 2% (D-439). The gate passes the same map; never a plain
  number, which leaves the guards at 0;
- `stats: ["MainDamage", "TotalEHP"]` (D-437): `MainDamage` ranks, the named source's damage figure by the
  record's Count rule, the figure the design shows; and `cull: true` when the rung has `skills.cull`. A need's own
  stat (step 3) asks `["<the need's stat>", "MainDamage"]`. A pool move on a weapon set that doesn't hold the main
  group ranks by Full DPS, which the tool does itself and its line says;
- `limit: 0`, the compact mode, for a swap; `limit: 15` when you need its best unallocated list (step 3's needs
  and spare points), and `limit: 50` for its weakest allocated branches (step 3's socket tests).

The compact reply's lines: `Travel: <T> of <P> points give nothing alone on …`, the rung's travel and its points,
which count its untagged main-tree nodes only (no weapon-set or ascendancy node); and `Best swap: none: …`, or
`Best swap: +<x>% Main damage (+<n>); … Remove <N> points: <Name> [<id>], … Add <M> points: <Name> [<id>]
(attribute: <attr>), … Searched from branch <Name> [<id>] …` (or `branches <Name> [<id>] (<n> points), … freed
together`: node power frees its 5 weakest branches alone and in pairs and triples, so a path longer than any one
branch fits, D-439). A swap the tool returns passed its own legality check (connected, within its points, no
second tree on a start, no weapon-set or ascendancy node moved), which isn't V1's: you still compile it and
compare V1 (below). `rebuild: true` and `free: [ids]` answer one line in the same form, `Rebuild: …` or `Free:
…`, in place of the swap.

**Pool moves** (C-55a, D-426). On a rung with weapon-set passives, each weapon set's pool (its `weaponSetNodes.set1`
or `set2`) gets its own line after `Best swap:`, in the same form, `Best swap (weapon set <n>): none: …` or `Best
swap (weapon set <n>): +<x>% Main damage (+<n>); … Remove …. Add …`: a move within that pool, measured with set
`<n>` active, so its gain is of that set's figure (Full DPS on a set without the main group). It removes only nodes
of the pool and adds nodes tagged to it, and the pool holds no more points than before, so it stays within the
pool's weapon-set points; no node moves between pools or between a pool and the main tree. Apply it like a main
swap (a change, below), with its nodes in the pool's list too: remove the removed nodes from
`weaponSetNodes.set<n>` as from `tree.nodes`, and add the added nodes to both.

**A change**, below, is any edit to one rung's tree: a swap, a rebuild, spare points, a socket, a need's nodes, a
user's request. Each one runs the same way:
- **On that rung only** (D-452): a change goes up no ladder. Remove the removed nodes from the rung's
  `tree.nodes`, with their `attributeChoices` entries; add the added nodes; give each added attribute node the
  choice the tool named (`{node, attribute: "strength" | "dexterity" | "intelligence"}`). When it adds the notable
  the rung's `items.anoint` names, remove that `items.anoint`: the compiler refuses an anoint the tree allocates,
  and D1-finish anoints the rung again. A pool move's removed nodes leave the rung's `weaponSetNodes.set<n>` too,
  and its added nodes go into `set<n>` as well as `tree.nodes`.
- **Compile the rung**: `mcp__pob2__compile_plan {plan_path: "<plan>", measure_only: true, stages: ["<the
  rung>"]}`, a temporary stage named beside it when you measure one. Never a final compile.
- **Check** the compiled rung: its floor (fire, cold, lightning and chaos resistance capped,
  `Missing<Elem>Resist` 0, chaos uncapped only on a stage with `chaosResistException`, from its key-figure line;
  each reference hit in the record's `configWritten` below its `<Type>MaximumHitTaken`, by Grep of
  `compile-record.json`), and its V1 findings against the last compile's: a code on a stage that it didn't have
  before is a new finding. A need's `missing-reason` (`tree.needs[<m>].claim`) doesn't count: D1-finish writes
  the claims. **The boss guard** (D-456), for your own moves only (the loop's swaps, the rebuild, spare points
  and sockets), never a user's request or a trade the user takes: each boss-rotation entry of the rung's
  `measures.bossGroups` (Grep `compile-record.json`: each entry's `figure`, triggered entries included) against
  the last compile's; a move that cuts any entry by more than 2% fails the check. The summed boss figure isn't
  enough: it leaves triggered entries out, and can hide a cut boss button behind a raised main skill.
- **Undo** a change when its compile fails, the rung's floor fails, V1 gains a finding, or your own move fails the
  boss guard: restore the rung's tree as it was, and compile it again, so the loaded build is the plan's. An
  undone swap's removed nodes become a floor need on its rung, `{"nodes": [<the removed nodes>], "stat":
  "TotalEHP"}` ("a defence the floor needs"), so neither the loop nor the gate proposes it again; after the boss
  guard, a need with no `stat` instead, whose claim (D1-finish's) names the boss-rotation entry it keeps.

1. **Start: the floor first.** Compile `m`, `b` and `n` together (`stages: ["m", "b", "n"]`). The loop runs only
   once every rung's floor holds: when any rung's floor fails, change nothing and return `done` with `no loop:
   <rungs>' floor fails`; the D1 gate finds it. Keep each rung's V1 findings and its boss-rotation entries'
   figures as the first "before".
2. **The user's requests** (a design gate's `revise:` about the tree, a respec among them: D-452 makes it a tree
   request): allocate each node the user asked for with its path (`mcp__pob2__find_path_to_node
   {target_node_id}` on the loaded build), or remove what the user asked to remove, as a change on the rung the
   request names (else each rung it fits); write each asked-for node as a need on that rung, `{"nodes": [<the
   node>]}`, so no swap removes it. A request the check refuses is undone and returned as `not made: <the
   request>: <why>`.
3. Then the rungs, **`m`, then `b`, then `n`**, each to the end before the next:
   1. **A need with a stat** is met by node power on it: for each of the rung's needs with a `stat`, call the
      tool with `stats: ["<the need's stat>", "MainDamage"]` and `limit: 15`, leaving that need's own nodes out
      of `keep`. A stat the tool refuses (it answers with its list) is set to the list's id that names it, or left
      out when none does. When nodes from its best unallocated list give at least what the need's nodes give on
      that stat (their branch's loss in the weakest list) for fewer points, their paths counted once, make the
      replacement a change. Keep it only when the rung's `<stat>` output in the record (Grep
      `compile-record.json` for `"<stat>":`) is at least what it was, else undo it (no need is written: the need
      still holds); and set the need's `nodes` to the nodes that now meet it. Otherwise the need stays.
   2. **Spare points**, counted as V1 counts them (its `passive-points` check, PoB's own count): the rung's
      **regular points** are its `tree.nodes` (the class start not among them), weapon-set nodes included, less
      the smaller weapon set, `min(|set1|, |set2|)` of `weaponSetNodes`: its untagged nodes plus the larger weapon
      set. (The tool's `points` count the untagged nodes only, so never take spare points from them on a rung
      with weapon-set nodes.) The **allowance** is V1's: `level` − 1, plus the quests' passive points at
      `endgame` (the books, `passive-points.max` less `passive-points.from-levels`), plus PoB's `ExtraPoints`
      (a `Grants <n> Passive Skill Point` line of a node or item the rung holds: Grep `compile-record.json` for
      `"ExtraPoints":` with line numbers, a hit inside the rung's block of `stages`; none is 0). The Martyr point
      isn't spare: V1 only tolerates it at the last progress key, and a guide doesn't count on it. **Spare
      points** are the allowance less the regular points. D1-build leaves them unspent, and a swap can free
      some: one whose new paths use fewer points than it freed (its reply says how many). Spend them on the
      rung's best nodes per point: call the tool with `limit: 15` and take its best unallocated nodes in rank
      order, each with every node of its `Path` the rung lacks, counting a shared path node once, while they
      fit; that is one change. Call again while points remain; when points remain and no listed node fits, call
      once with `limit: 50` and take the best that fit. At most 5 calls per rung. A fill V1 refuses with
      `passive-points` names PoB's count and allowance in its message: undo it, and spend the difference it gives
      instead.
   3. **Jewel sockets** (D-453), on `b` and `n` only (the user: min-maxed builds path to many sockets and fill
      them with jewels of only the stats they scale):
      - **Which sockets:** each empty jewel socket within 4 points of the rung's tree, nearest first, at most 3
        measured per rung (the nearest sit 4–8 points away on finished trees; a socket pays at about 3 points or
        less). Path to it with `mcp__pob2__find_path_to_node {target_node_id}`, which paths an untagged node
        through untagged nodes only: a path avoids weapon-set nodes.
      - **The lines**, chosen once per build, at the first socket test: candidate affixes of the jewel base that
        serves the build's scaling (`tree.scales`), from `mcp__pob2__lookup_game_data {mode: "mechanic", query:
        <the stat>, kind: "mod"}` (each `[mod]` hit's `Base types:`), at most 8 candidates, each measured alone
        on a temporary stage (a jewel with that one line in the socket) on the map figure, the boss figure read
        beside it. `b`'s jewel carries the best 3 lines at a middle roll, `n`'s the best 4 at the top roll. No
        crafted "Effect of Prefixes" or "Effect of Suffixes" line: PoB doesn't read it (PG-99). A line of damage
        against rares is judged on the map figure like any other (the user judges builds on clear). Write the
        chosen lines and the `tree.scales` they serve in `pieces.md`'s `## Jewel lines` (Writes), and reuse them
        while `tree.scales` is unchanged.
      - **The test:** a temporary stage that copies the rung; free as many points as the socket's path costs
        from node power's weakest list, ranked on `["MainDamage", "TotalEHP"]` (`limit: 50`, the rung's `keep`),
        allocate the path, and put a rare jewel with the rung's lines in the socket (`items.treeJewels {node,
        text}`). Compile it with the rung, measure-only (`stages` naming both). Take the socket as a change (the
        path's nodes, the freed nodes removed, and its `items.treeJewels` entry) when its map figure, `MainDamage`
        (`measures.damage.map`), beats the rung's, and its `TotalEHP` and lowest max hit fall no more than a swap's
        2%. It weighs the jewel against the rung's weakest points, not its best nodes: once spare points are
        spent, the weakest are what a socket costs. The boss guard applies.
      - **Its price entry** (D-372): write each taken jewel's `prices[]` entry as D1-build writes a rare's,
        `{"id": "<rung>-jewel-<node>", "item": "<a short description>", "query": {"slot": "Jewel <node>",
        "required": [<the chosen lines, each {affix, min}: on n the best 3 of its 4, the fourth left to PoB's
        weights>], "target": <b's {"divines": 5, "day": 7}, or n's {"divines": <its share>, "day": 21}>},
        "amount": null, "currency": null, "date": "<the run folder's date>", "league": <the plan's league>,
        "status": "unavailable", "note": "not priced yet"}` (offline, `"note": "offline run"`). D1-finish re-splits
        `n`'s shares over its rares and tree jewels before it prices them.
   4. **The swap loop, then the rebuild** (D-439): call the tool in compact mode. While its best swap gains at
      least **3%** Main damage, make it a change, and call again; stop at "Best swap: none", under 3%, or after
      **8 swaps** on the rung, an undone one counted. The D1 gate fails a rung at 5%, so the anoint and the
      prices D1-finish adds can't push a finished loop over the gate's line. **Pool moves** run in the same loop:
      of the reply's `Best swap:` and `Best swap (weapon set <n>):` lines, make the one that gains most a change
      (each counted among the 8), and go on while any of them gains at least 3%; a pool move stays within its
      pool's points, and V1's `weapon-set-points` checks it at the compile. Then **the rebuild pass**, once: the
      same call with `rebuild: true`, which frees every node outside `keep` and the paths that connect it to the
      start, refills the points greedily by gain per point, and judges the result as one swap against the loop's
      tree, on the whole rung. When its `Rebuild:` line is legal and gains Main damage, it beats the loop's tree:
      make it a change, counted as a swap.
   5. **No unspent point**: after the loop, spend the rung's spare points again as step 2 does, so the rung
      ends with every regular point the level allows spent. A point left (no node within reach fits, or each
      fill was undone) is returned with its reason, `unspent: <rung> <k>: <why>`, which D1-finish writes as a
      `reason` claim on the rung.
   6. **What the tree keeps that PoB can't measure** (D-439). Run `mcp__pob2__check_model_coverage {nodes:
      [<the need's nodes>]}` on each need of the rung, batched; a need with a line PoB doesn't apply (`unparsed`,
      `partly parsed`, `parsed to nothing`, a `possibly unread` line, or a flag such as an Energy trigger) is
      **unmodelled**, and it stays a need: the user worried that forbidding such nodes "would weaken a build that
      relies on an unmeasurable mechanic" (2026-10-24). Measure its cost on each rung that holds it with `free:
      [<the need's nodes>]` (`free` overrides `keep`), compact: its `Free:` line's gain is what the same points
      would add elsewhere. Each becomes an `unmodelled` trade (Writes):
      "Kept for <the mechanic>, which PoB can't measure: the same <n> points elsewhere would add <x>% damage."
      The mechanic is what the nodes' lines serve ("Cast on Critical's Energy"). Change nothing for it.

   The rung's travel **before** is the `Travel:` count of its first call with the rung's stats, `["MainDamage",
   "TotalEHP"]` (step 2's), and **after** its last such call's: travel depends on the stats asked for.

Nothing else changes: no item but a removed anoint and the tree jewels your sockets take, with their price
entries; no gem, no config, no claim (D1-finish writes the needs' claims), and no respec (a schema-8 plan has
none). Validate with `mcp__pob2__guide_run {validate: "<plan>"}` after your last edit, until it reports no error.

## Writes

`<buildFolder>/plan.json`: its rungs' `tree` (`nodes`, `attributeChoices`, `needs`, and a pool move's
`weaponSetNodes`), the sockets' `items.treeJewels` entries and their `prices[]` entries, and a removed
`items.anoint`. The server writes the record and the XML beside it.

`<buildFolder>/pieces.md`'s `## Jewel lines` (D-453), after `## Searched`, written at the first socket test and
replaced only when `tree.scales` changes; the rest of the file is D1-build's:

```
## Jewel lines

- For: cold hit damage, crit damage, spell levels
- b, middle roll: 12% increased Cold Damage; 10% increased Critical Damage Bonus; 6% increased Cast Speed
- n, top roll: 15% increased Cold Damage; 14% increased Critical Damage Bonus; 8% increased Cast Speed; 15% increased Damage against Rare or Unique Enemies
```

`<buildFolder>/trades.json` (D-439, outside `buildSha1`), the trades the design gate shows: write it whole, the
entries of other kinds as they are (D1-finish's `boots`, `defence`, `damage` and `avoidance`) and your
`unmodelled` entries in place of the old ones, one per rung and unmodelled need; `{"trades": []}` when it holds
none. Every entry carries `maxHit` and `hitsSurvived` (D-450, a build held to amendment 12), `null` on yours:

```json
{"trades": [{"stage": "n", "kind": "unmodelled", "what": "the same 6 points elsewhere", "ehpChange": 0.4,
  "damageChange": 17, "bossAfter": null, "reason": "Cast on Critical's Energy", "maxHit": null,
  "hitsSurvived": null}]}
```

`what` a short phrase, `ehpChange` and `damageChange` the `Free:` line's Total EHP and Main damage changes in
percent, `bossAfter`, `maxHit` and `hitsSurvived` null, `reason` the mechanic.

## Returns

At most 8 lines, counts only (the swaps' nodes are in the plan): `done`; your `mcp__pob2__compile_plan` and
`mcp__pob2__get_node_power` calls; each rung's travel before and after, its swaps and how many were undone, the
spare points spent, the sockets taken of those tested, and its regular points left unspent (0 unless step 5
couldn't spend them); `no loop: <rungs>' floor fails` when step 1 stopped; the unmodelled needs counted (`trades: 1
unmodelled`); each `unspent:` and `not made:` line. Then, outside the 8 lines, one `jewel: <rung> <node>: <lines>:
+<x>% damage, boss <+y>%` line per socket taken (D-453), which the runner prints under the design gate's display.

```
D1-tree r1-a-2 attempt 1: done
compiles: 18, node power calls: 23
m: travel 21 → 8; swaps 4, 1 undone; spare points 0; unspent 0
b: travel 26 → 11; swaps 5; spare points 6; sockets 1 of 2; unspent 0
n: travel 30 → 13; swaps 3, rebuild taken; spare points 5; sockets 1 of 3; unspent 1
trades: 1 unmodelled
unspent: n 1: each fill of the last point failed the floor when measured
jewel: b 26725: 12% increased Cold Damage, 10% increased Critical Damage Bonus, 6% increased Cast Speed: +3.4% damage, boss +2.9%
jewel: n 26725: 15% increased Cold Damage, 14% increased Critical Damage Bonus, 8% increased Cast Speed, 15% increased Damage against Rare or Unique Enemies: +5.1% damage, boss +6.0%
```

## Fault directives

None. FI-2 and FI-3 are the D1 gate's (`D1-gate.md`).
