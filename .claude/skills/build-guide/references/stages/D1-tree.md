# D1-tree: trees that minimize travel (`build-guide-coordinator`)

The second of D1's three steps (D-418), a fresh coordinator step between D1-build (`D1-build.md`) and D1-finish
(`D1-finish.md`), so node power's output stays out of D1-build's context. D1-build left the three endgame rungs
(`m`, `b`, `n`) built, measured and with their needs; you spend each rung's spare points and swap its weak
branches for better nodes by PoB's node power, in ladder order, keeping every need and the survival floor. The
user's rule: **minimize travel distance**, judging a cluster by its gain per point with its path.

## Inputs

- **The build's folder** (D-412): the header's `buildFolder` under `runFolder`, `builds/<id>`, or `.` for a run
  migrated from schema 3. `plan.json`, `compile-record.json` and the compiled XML are there; below, a bare
  `plan.json` or `compile-record.json` is that folder's, and `<plan>` is `<runFolderRel>/<buildFolder>/plan.json`
  (`<runFolderRel>/plan.json` when `buildFolder` is `.`).
- **Header:** `stage: "D1-tree"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`, `buildFolder`,
  `compile: "measure-only"`, `writes: ["<buildFolder>/plan.json"]`, `accepted`, and `findings`:
  - after D1-build in the same attempt, `[]`;
  - on a D1 gate retry for its `tree` part, the verdict file and its `tree-swap` findings: each names a swap
    left on a rung, which the loop below finds again and makes;
  - the user's requests about the tree (`code: "user-request"`) from the design gate's `revise:<text>`, when the
    change is to the tree alone: make them first (step 2);
  - on a guided retry after an escalation, the escalated verdict's findings, then the user's guidance (`code:
    "user-guidance"`), which you follow as a request.
- **Prompt:** D1-build's `for D1-tree:` line, when it ran before you: each rung's floor and needs. Your first
  compile confirms it.
- **Read**, the independent calls in one response: each rung through `mcp__pob2__guide_run {view: {plan:
  "<plan>", stage: "<id>"}}` for `m`, `b` and `n`, batched (its `tree`: `nodes`, `ascendancyNodes`,
  `weaponSetNodes`, `attributeChoices`, `needs`; its `level`, `loadoutName`, `respec`, `skills.groups` and
  `items.anoint`), and `data/campaign/limits.json` (`passive-points.max` and `passive-points.from-levels`). Grep
  or Read `plan.json` at a place to anchor an Edit; never Read it whole.

## Work

**The arguments.** Every `mcp__pob2__get_node_power` call on a rung, here and at the D1 gate, comes after a
compile that loaded every rung it names (`mcp__pob2__compile_plan {stages}` loads only the named stages: the rung
and every later rung), and has:
- `loadout`: the rung's loadout name, exactly as the compile record has it (`stages.<id>.loadoutName`, the
  plan's `loadoutName`); its `(L<level>)` sets the level the tool measures at;
- `keep`: the nodes of the rung's `tree.needs`; for `b` and `n`, also every node of the rung before's
  `tree.nodes`, so a swap touches only the nodes the rung adds; and every node a later rung's `respec.dropped`
  lists (a respec is never the loop's: only a stated `respec.dropped` with its reason, as D1-build writes it);
- `protect_for`: the later rungs' loadout names, exactly as the record has them, `m`'s `b` and `n`, `b`'s `n`,
  none for `n`: the tool never removes a node they build on, and the nodes it adds connect through this rung's
  tree, which they contain;
- `clear_group`, **always**: the record's group number of the rung's first enabled `role: "clear"` group (the
  `g<N>` of its keys in `skillOutputs`), else the main group's (`skills.main.group`). The tool's default is the
  main group, not the clear group, and its guards measure the group you pass;
- `max_loss: {clearUses: 2}`, the map form (the coordinator's ruling on the guards, amendment 9 §23): the clear
  skill's uses per second may drop up to 2%, as each stat after the first (TotalEHP) may, since uses per second
  is already in the DPS the swap gains; the other guards keep their default 0 (`movement` and `clearRadius`:
  movement speed and the clear skill's radius), so any loss there rejects a swap. The gate passes the same map;
  never a plain number, which leaves the guards at 0;
- `stats` left out (`["FullDPS", "TotalEHP"]`: Full DPS ranks), except for a need's own stat (step 3);
- `limit: 0`, the compact mode, for a swap; `limit: 15` when you need its best unallocated list (step 3's needs
  and spare points).

The compact reply's lines: `Travel: <T> of <P> points give nothing alone on …`, the rung's travel and its points,
which count its untagged main-tree nodes only (no weapon-set or ascendancy node); and `Best swap: none: …`, or
`Best swap: +<x>% Full DPS (+<n>); … Remove <N> points: <Name> [<id>], … Add <M> points: <Name> [<id>]
(attribute: <attr>), …`. A swap the tool returns passed its own legality check (connected, within its points, no
second tree on a start, no weapon-set or ascendancy node moved), which isn't V1's: you still compile it and
compare V1 (below).

**A change**, below, is any edit to the rungs' trees: a swap, spare points, a need's nodes, a user's request.
Each one runs the same way:
- **Up the ladder** (D-282): a change on `m` goes to `b` and `n` too, which contain `m`'s tree, and one on `b`
  to `n`. Remove the removed nodes from each rung's `tree.nodes`, with their `attributeChoices` entries; add each
  added node a rung lacks (an added node a later rung already holds stays as it is there, its weapon-set tag
  included); give each added attribute node the choice the tool named (`{node, attribute: "strength" |
  "dexterity" | "intelligence"}`). When it adds the notable a rung's `items.anoint` names, remove that
  `items.anoint`: the compiler refuses an anoint the tree allocates, and D1-finish anoints the rung again.
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
3. Then the rungs in ladder order, **`m`, then `b`, then `n`**, each to the end before the next:
   1. **A need with a stat** is met by node power on it: for each of the rung's needs with a `stat`, call the
      tool with `stats: ["<the need's stat>", "FullDPS"]` and `limit: 15`, leaving that need's own nodes out of
      `keep`. A stat the tool refuses (it answers with its list) is set to the list's id that names it, or left
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
   3. **The swap loop**: call the tool in compact mode. While its best swap gains at least **3%** Full DPS, make
      it a change, and call again; stop at "Best swap: none", under 3%, or after **8 swaps** on the rung, an
      undone one counted. The D1 gate fails a rung at 5%, so the anoint and the prices D1-finish adds can't push
      a finished loop over the gate's line.
   4. **No unspent point**: after the loop, spend the rung's spare points again as step 2 does, so the rung
      ends with every regular point the level allows spent. A point left (no node within reach fits, or each
      fill was undone) is returned with its reason, `unspent: <rung> <k>: <why>`, which D1-finish writes as a
      `reason` claim on the rung.
   The rung's travel **before** is the `Travel:` count of its first call with the default stats (step 2's), and
   **after** its last such call's: travel depends on the stats asked for.

Nothing else changes: no item but a removed anoint, no gem, no config, no claim (D1-finish writes the needs'
claims), no respec. Validate with `mcp__pob2__guide_run {validate: "<plan>"}` after your last edit, until it
reports no error.

## Writes

`<buildFolder>/plan.json` only, its rungs' `tree` (`nodes`, `attributeChoices`, `needs`) and a removed
`items.anoint`. The server writes the record and the XML beside it.

## Returns

At most 8 lines, counts only (the swaps' nodes are in the plan): `done`; your `mcp__pob2__compile_plan` and
`mcp__pob2__get_node_power` calls; each rung's travel before and after, its swaps and how many were undone, the
spare points spent, and its regular points left unspent (0 unless step 4 couldn't spend them); `no loop: <rungs>'
floor fails` when step 1 stopped; each `unspent:` and `not made:` line.

```
D1-tree r1-a-2 attempt 1: done
compiles: 14, node power calls: 19
m: travel 21 → 8; swaps 4, 1 undone; spare points 0; unspent 0
b: travel 26 → 11; swaps 5; spare points 6; unspent 0
n: travel 30 → 13; swaps 3; spare points 5; unspent 1
unspent: n 1: each fill of the last point failed the floor when measured
```

## Fault directives

None. FI-2 and FI-3 are the D1 gate's (`D1-gate.md`).
