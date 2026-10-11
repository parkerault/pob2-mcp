# Run A: anoints, granted-skill sockets, tree roots (2026-10-11)

Run A: `/tmp/m14.zfPx/guides/open-explosive-concoction/2026-10-11-3`. PoB2 paths are under `m14/vendor/PathOfBuilding-PoE2/src/`. Our paths are relative to the m14 worktree.

## I-1: amulet anoints

**PoB2.**
- An anoint is an enchant line, `{enchant}Allocates <notable>` (`Classes/ItemsTab.lua:2584-2596`, `Item.lua:1471-1472`). PoB parses it to `GrantedPassive` (`ModParser.lua:5871`).
- PoB adds the notable to the calculation with no path and no point spent (`CalcSetup.lua:17-21, 1405-1414`). It never enters `spec.allocNodes` (`PassiveSpec.lua:1214-1221`).
- A node can be anointed when it has a `recipe` of three Distilled Emotions (`NotableDBControl.lua:19-21`). In 0.5, 875 nodes have one (`TreeData/0_5/tree.lua:23592` is the first), and the trade data lists the same 875 (`Data/QueryMods.lua:324`).

**Pipeline.**
- Item text reaches PoB unchanged (`src/plan/schema.ts:124-131`, `pob-api/API/Compile.lua:326`). So an anoint line would compile, but nothing designs, prices or checks one.
- D1, D2 and the guide template never mention anoints (only `references/patterns.md:655-660` does). Run A has none.

**What it would take:**
1. A plan field, `items.anoint {notable, reason}`. The compiler refuses a notable that has no recipe or is already allocated.
2. A tool that ranks recipe notables with PoB's own anoint calculation (`NotableDBControl.lua:186-195`).
3. A D1 rule for endgame stages: anoint the best-measured recipe notable that is off the tree, or whose path costs at least N points, and price its emotions. In run A, Firestarter, Slow Burn and Total Incineration qualify.
4. A gear line in the guide.

## I-2: support sockets on granted skills

PoB2 has no socket rule, so there are no thresholds to cite:
- A tree-granted skill is level 1 with `noSupports = true` (`Data/ModCache.lua:5715`, `CalcSetup.lua:247-256`).
- An item-granted skill takes its level from the mod line, and nothing depends on item level (`Item.lua:2211-2221`).
- Every granted group is rebuilt to the bare skill (`CalcSetup.lua:1531-1541`).

Our data has no thresholds either. **The thresholds need the user's source.**

**Run A's counts.** Lightning Arrow has 2 supports at L8 and 3 at L16. Explosive Concoction has 3 at L23, 4 from L40 to L90, and 5 at L95. The plan models it as a gem group and flags those counts as untested (claim `m-level-unknown`).

**The guide's Jeweller's Orb lines.** `guide.md:65` (Lightning Arrow, a gem) is right. `guide.md:94` (orbs for "the concoction's third and fourth support sockets") is wrong under the user's rule.

**Enforcement: none.** V1, the validity checks (`src/plan/checks/v1.ts:9-22`), never counts supports. The fix: a threshold fact in `data/campaign/gems.json`, a V1 code `support-sockets`, and a line in D1 and the guide template.

## I-3: tree roots and two unconnected starts

**How PoB2 models Path of the Sorceress.**
- Its stat parses to `AlternateClassStart` (`ModParser.lua:2756`), which only jewels read (`PassiveSpec.lua:1403-1413`).
- Instead, the tree data links node 12795 to the Sorceress start's two exits, 4739 and 44871 (`tree.lua:44581-44607`). Paths may step from an ascendancy node into the main tree (`PassiveSpec.lua:1257-1263, 1280`).
- A node is kept if allocated nodes lead it to any class or ascendancy start (`:1762-1786`); PoB prunes the rest (`:1871-1925`).

So the Sorceress side may stay unconnected, as the user's rule says. The rule adds one exit per start.

**Run A's components.** Nodes per component, with the class start not joining its exits:

| Stage | Ranger 56651 | Ranger 13828 | Sorceress 4739 | Sorceress 44871 | Trees |
|---|---|---|---|---|---|
| 1 | 7 | – | – | – | 1 |
| 2, 3 | 7 | 12, 19 | – | – | **2** |
| 4 (takes 12795) | 7 | 47 | – | – | **2** |
| 5 | 7 | 52 | 15 | – | **3** |
| 6, m | 7 | 61, 65 | 15 | 9 | **4** |
| b, n | 9 | 67, 72 | 25 | 17 | **4** |

- **The extra Ranger branch** appears at stage 2 (L16): Clean Shot's branch off 56651 sits beside Heavy Ammunition's off 13828.
- **The extra Sorceress branch** appears at stage 6 (L64): Arcane Mixtures off 44871.
- **The ascendancy tree is valid.** It is one component with the Pathfinder start 1583 in every stage.

**PoB2 enforces one exit per start neither in the UI nor on import.**
- A UI click allocates any node with a path (`PassiveTreeView.lua:522-532`, `PassiveSpec.lua:917-963`). Paths start from every allocated node, the class start included, and no code counts exits (`:1236-1301, 1980-1987`).
- `ImportFromNodeList` (`:321-375`) and `DecodeURL` (`:525-570`) only allocate the nodes and prune orphans.
- A headless probe of run A's file confirmed this:
  - at stage 1, the second Ranger exit has a path from the Ranger start, and `AllocNode` takes it;
  - at stage 5, exit 44871 has a path from 12795 and is taken;
  - at stage b, removing 12795 drops all 43 Sorceress-side nodes.

**Our fix points:**
- `pob-api/API/Compile.lua:182-285` (`check_tree`) tests only that nodes can be reached from the starts. The rule below belongs there.
- `src/services/treeService.ts:292-413` (`find_path_to_node`, `get_nearby_nodes`) searches out from every allocated node, starts included, and passes through starts that aren't allocated.
- `pob-api/API/BuildOps.lua:533-553, 2031-2038` (`update_tree_delta`, `get_passive_upgrades`) follows PoB's paths.
- `references/stages/D1.md:112` says only "connected to the class start".

**The validity rule.** Take a stage's main-tree nodes, with class starts not joining their exits.
1. Each component contains exactly one start exit: a node linked to the class start, or a main-tree link of an allocated Path-of-X node (12795 links 4739 and 44871).
2. Each start has at most one component. The Sorceress start has one only in stages that allocate 12795.
3. The ascendancy nodes form one component with their start (1583), over ascendancy links only.
