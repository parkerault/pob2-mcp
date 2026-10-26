# D1-tree: trees that minimize travel (`build-guide-coordinator`)

The second of D1's three steps (D-418), a fresh coordinator step between D1-build (`D1-build.md`) and D1-finish
(`D1-finish.md`), so node power's output stays out of D1-build's context. D1-build left the three endgame rungs
(`m`, `b`, `n`) built, measured and with their needs, each rung's scaling named and its respec rungs marked; you
spend each rung's spare points and swap its weak branches for better nodes by PoB's node power, in ladder order,
keeping every need and the survival floor, complete the respecs D1-build marked, and show what the tree keeps that
PoB can't measure. The user's rule: **minimize travel distance**, judging a cluster by its gain per point with its
path.

## Inputs

- **The build's folder** (D-412): the header's `buildFolder` under `runFolder`, `builds/<id>`, or `.` for a run
  migrated from schema 3. `plan.json`, `compile-record.json` and the compiled XML are there; below, a bare
  `plan.json` or `compile-record.json` is that folder's, and `<plan>` is `<runFolderRel>/<buildFolder>/plan.json`
  (`<runFolderRel>/plan.json` when `buildFolder` is `.`).
- **Header:** `stage: "D1-tree"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`, `buildFolder`,
  `compile: "measure-only"`, `writes: ["<buildFolder>/plan.json", "<buildFolder>/trades.json"]`, `accepted`, and
  `findings`:
  - after D1-build in the same attempt, `[]`;
  - on a D1 gate retry for its `tree` part, the verdict file and its `tree-swap` findings: each names a swap
    left on a rung, which the loop below finds again and makes;
  - the user's requests about the tree (`code: "user-request"`) from the design gate's `revise:<text>`, when the
    change is to the tree alone: make them first (step 2);
  - on a guided retry after an escalation, the escalated verdict's findings, then the user's guidance (`code:
    "user-guidance"`), which you follow as a request.
- **Prompt:** D1-build's `for D1-tree:` line, when it ran before you: each rung's floor, needs and respec rungs.
  Your first compile confirms it.
- **Read**, the independent calls in one response: each rung through `mcp__pob2__guide_run {view: {plan:
  "<plan>", stage: "<id>"}}` for `m`, `b` and `n`, batched (its `tree`: `nodes`, `ascendancyNodes`,
  `weaponSetNodes`, `attributeChoices`, `needs`, `scales`; its `level`, `loadoutName`, `respec`, `skills.groups`,
  `skills.cull` and `items.anoint`), `data/campaign/limits.json` (`passive-points.max` and
  `passive-points.from-levels`), and `<buildFolder>/trades.json` when it exists. Grep or Read `plan.json` at a
  place to anchor an Edit; never Read it whole.

## Work

**Grow and respec links** (D-438). A rung **grows** from the rung before it when it has no `respec`, and
**respecs** from it when it has one (D1-build marked it: its scaling changed). `b` grows from or respecs from `m`,
and `n` from `b`. You complete the respecs D1-build marked and never mark one yourself: a scaling change it missed
is a `respec:` return (step 3).

**The arguments.** Every `mcp__pob2__get_node_power` call on a rung, here and at the D1 gate, comes after a
compile that loaded every rung it names (`mcp__pob2__compile_plan {stages}` loads only the named stages: the rung
and every later rung), and has:
- `loadout`: the rung's loadout name, exactly as the compile record has it (`stages.<id>.loadoutName`, the
  plan's `loadoutName`); its `(L<level>)` sets the level the tool measures at;
- `keep`: the nodes of the rung's `tree.needs`; for `b` and `n`, also every node of the rung before's
  `tree.nodes`, so a swap touches only the nodes the rung adds, except on a respec rung, which keeps only the
  prior nodes that still serve it (step 3); and every node a later rung's `respec.dropped` lists;
- `protect_for`: the later rungs' loadout names, exactly as the record has them, `m`'s `b` and `n`, `b`'s `n`,
  none for `n`, **along grow links only** (D-438): a rung protects nodes for a later rung that grows from it,
  directly or through rungs that grow, never for one that respecs from it or from a rung between (with `b`
  respeccing from `m`, `m` protects for none). The tool never removes a node they build on, and the nodes it adds
  connect through this rung's tree, which they contain;
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
  and spare points), and `limit: 50` for its weakest allocated branches (a respec rung's serving test).

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

**A change**, below, is any edit to the rungs' trees: a swap, a rebuild, a respec's freed nodes, spare points, a
need's nodes, a user's request. Each one runs the same way:
- **Up the ladder, along grow links only** (D-438): a change on `m` goes to `b` when `b` grows from `m`, and to
  `n` when `n` grows from `b` too; one on `b` to `n` when `n` grows from `b`. Remove the removed nodes from each
  such rung's `tree.nodes`, with their `attributeChoices` entries; add each added node a rung lacks (an added
  node a later rung already holds stays as it is there, its weapon-set tag included); give each added attribute
  node the choice the tool named (`{node, attribute: "strength" | "dexterity" | "intelligence"}`). When it adds
  the notable a rung's `items.anoint` names, remove that `items.anoint`: the compiler refuses an anoint the tree
  allocates, and D1-finish anoints the rung again. A pool move goes up the ladder in its pool: its removed nodes
  leave each rung's `weaponSetNodes.set<n>` too, and each added node a rung lacks goes into that rung's `set<n>`
  as well as its `tree.nodes`. **A rung that respecs** from the changed rung keeps its tree; its
  `respec.dropped` follows the change instead, so V1's `tree-continuity` holds: each added node it lacks joins
  `dropped` (with its name in `note`), and each removed node leaves `dropped`.
- **Compile every rung it touches together**: `mcp__pob2__compile_plan {plan_path: "<plan>", measure_only:
  true, stages: [<the rung and every later rung>]}`, which also loads the later rungs' loadouts that
  `protect_for` names. Never a final compile.
- **Check** each compiled rung: its floor (fire, cold, lightning and chaos resistance capped,
  `Missing<Elem>Resist` 0, chaos uncapped only on a stage with `chaosResistException`, from its key-figure line;
  each reference hit in the record's `configWritten` below its `<Type>MaximumHitTaken`, by Grep of
  `compile-record.json`), and its V1 findings against the last compile's: a code on a stage that it didn't have
  before is a new finding. A need's `missing-reason` (`tree.needs[<m>].claim`) doesn't count: D1-finish writes
  the claims.
- **Undo** a change on every rung it touched when a compile fails, any touched rung's floor fails, or V1 gains a
  finding: restore their trees as they were, and compile them again, so the loaded build is the plan's. An undone
  swap's removed nodes become a floor need on its rung, `{"nodes": [<the removed nodes>], "stat": "TotalEHP"}`
  ("a defence the floor needs"), so neither the loop nor the gate proposes it again.

1. **Start: the floor first.** Compile `m`, `b` and `n` together (`stages: ["m", "b", "n"]`). The loop runs only
   once every rung's floor holds: when any rung's floor fails, change nothing and return `done` with `no loop:
   <rungs>' floor fails`; the D1 gate finds it. Keep each rung's V1 findings as the first "before".
2. **The user's requests** (a design gate's `revise:` about the tree): allocate each node the user asked for
   with its path (`mcp__pob2__find_path_to_node {target_node_id}` on the loaded build), or remove what the user
   asked to remove, as a change on the rung the request names (else `m`); write each asked-for node as a need on
   that rung, `{"nodes": [<the node>]}`, so no swap removes it. A request the check refuses is undone and
   returned as `not made: <the request>: <why>`.
3. Then the rungs in ladder order, **`m`, then `b`, then `n`**, each to the end before the next. First, on each
   rung:
   - **A scaling change D1-build missed** (D-438). On a grow rung whose `tree.scales` names a change from the
     rung before's (a new skill or gem, a gear item, an ascendancy node, a keystone or a notable that scales
     differently), stop before you change it, and return `respec: <stage> needs one: <why>`: the runner logs your
     outcome `respec` and runs D1-build next, in the same attempt, then you again. Keep the changes you made on
     the rungs before it.
   - **A respec rung: keep only the prior nodes that still serve** (D-438). Call the tool with `limit: 50` and
     `keep` the rung's needs alone, and read its `Base:` line and its weakest allocated branches. A node of the
     rung before **serves** this rung when it is a need of this rung, or removing its branch (`Removing the
     branch:`) costs 1% or more of the base `Main damage` or `Total EHP`; a prior node in no listed branch serves
     (its branch is stronger than the 50 listed). Free the rest with `free: [<the prior nodes that don't
     serve>]`, which frees exactly those nodes and what their removal disconnects and refills the points
     greedily: make its `Free:` move a change (with nothing to free, none). From then on the rung's `keep` holds
     its needs and the serving prior nodes. After step 4, write `respec.dropped` as the prior rung's nodes this
     rung no longer holds, with their names, as the tool names them, in `respec.note` after the change it names
     (the guide names them); remove a respec that drops nothing.

   Then:
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
      some: one applied up the ladder (the rung already held some of the added nodes), or one whose new paths
      use fewer points than it freed (its reply says how many). Spend them on the rung's best nodes per point:
      call the tool with `limit: 15` and take its best unallocated nodes in rank order, each with every node of
      its `Path` the rung lacks, counting a shared path node once, while they fit; that is one change. Call again
      while points remain; when points remain and no listed node fits, call once with `limit: 50` and take the
      best that fit. At most 5 calls per rung. A fill V1 refuses with `passive-points` names PoB's count and
      allowance in its message: undo it, and spend the difference it gives instead.
   3. **The swap loop, then the rebuild** (D-439): call the tool in compact mode. While its best swap gains at
      least **3%** Main damage, make it a change, and call again; stop at "Best swap: none", under 3%, or after
      **8 swaps** on the rung, an undone one counted. The D1 gate fails a rung at 5%, so the anoint and the
      prices D1-finish adds can't push a finished loop over the gate's line. **Pool moves** run in the same loop:
      of the reply's `Best swap:` and `Best swap (weapon set <n>):` lines, make the one that gains most a change
      (each counted among the 8), and go on while any of them gains at least 3%; a pool move stays within its
      pool's points, and V1's `weapon-set-points` checks it at the compile. Then **the rebuild pass**, once: the
      same call with `rebuild: true`, which frees every node outside `keep`, the protected nodes and the paths
      that connect them to the start, refills the points greedily by gain per point, and judges the result as
      one swap against the loop's tree. When its `Rebuild:` line is legal and gains Main damage, it beats the
      loop's tree: make it a change, counted as a swap.
   4. **No unspent point**: after the loop, spend the rung's spare points again as step 2 does, so the rung
      ends with every regular point the level allows spent. A point left (no node within reach fits, or each
      fill was undone) is returned with its reason, `unspent: <rung> <k>: <why>`, which D1-finish writes as a
      `reason` claim on the rung.
   5. **What the tree keeps that PoB can't measure** (D-439). Run `mcp__pob2__check_model_coverage {nodes:
      [<the need's nodes>]}` on each need of the rung, batched; a need with a line PoB doesn't apply (`unparsed`,
      `partly parsed`, `parsed to nothing`, a `possibly unread` line, or a flag such as an Energy trigger) is
      **unmodelled**, and it stays a need: the user worried that forbidding such nodes "would weaken a build that
      relies on an unmeasurable mechanic" (2026-10-24). Measure its cost on each rung that holds it with `free:
      [<the need's nodes>]` (the prior rung's copies freed too: `free` overrides `keep`), compact: its `Free:`
      line's gain is what the same points would add elsewhere. Each becomes an `unmodelled` trade (Writes):
      "Kept for <the mechanic>, which PoB can't measure: the same <n> points elsewhere would add <x>% damage."
      The mechanic is what the nodes' lines serve ("Cast on Critical's Energy"). Change nothing for it.

   The rung's travel **before** is the `Travel:` count of its first call with the rung's stats, `["MainDamage",
   "TotalEHP"]` (step 2's), and **after** its last such call's: travel depends on the stats asked for.

Nothing else changes: no item but a removed anoint, no gem, no config, no claim (D1-finish writes the needs'
claims), and no respec but the ones D1-build marked, which you complete (step 3) or follow (a change up the
ladder). Validate with `mcp__pob2__guide_run {validate: "<plan>"}` after your last edit, until it reports no
error.

## Writes

`<buildFolder>/plan.json`: its rungs' `tree` (`nodes`, `attributeChoices`, `needs`, and a pool move's
`weaponSetNodes`), a respec rung's `respec.dropped` and `respec.note` (or the respec removed when it drops
nothing), and a removed `items.anoint`. The server writes the record and the XML beside it.

`<buildFolder>/trades.json` (D-439, outside `buildSha1`), the trades the design gate shows: write it whole, the
entries of other kinds as they are (D1-finish's `boots`, `defence` and `damage`) and your `unmodelled` entries in
place of the old ones, one per rung and unmodelled need; `{"trades": []}` when it holds none:

```json
{"trades": [{"stage": "n", "kind": "unmodelled", "what": "the same 6 points elsewhere", "ehpChange": 0.4,
  "damageChange": 17, "bossAfter": null, "reason": "Cast on Critical's Energy"}]}
```

`what` a short phrase, `ehpChange` and `damageChange` the `Free:` line's Total EHP and Main damage changes in
percent, `bossAfter` null, `reason` the mechanic.

## Returns

At most 8 lines, counts only (the swaps' nodes are in the plan): `done`, or `respec: <stage> needs one: <why>`
(step 3); your `mcp__pob2__compile_plan` and `mcp__pob2__get_node_power` calls; each rung's travel before and
after, its swaps and how many were undone, the spare points spent, and its regular points left unspent (0 unless
step 4 couldn't spend them), with a respec rung's prior nodes dropped; `no loop: <rungs>' floor fails` when step 1
stopped; the unmodelled needs counted (`trades: 1 unmodelled`); each `unspent:` and `not made:` line.

```
D1-tree r1-a-2 attempt 1: done
compiles: 14, node power calls: 21
m: travel 21 → 8; swaps 4, 1 undone; spare points 0; unspent 0
b: travel 26 → 11; swaps 5; spare points 6; unspent 0
n: travel 30 → 13; swaps 3, rebuild taken; spare points 5; unspent 1; respec drops 7
trades: 1 unmodelled
unspent: n 1: each fill of the last point failed the floor when measured
```

## Fault directives

None. FI-2 and FI-3 are the D1 gate's (`D1-gate.md`).
