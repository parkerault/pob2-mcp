# Slice 01: Server tools (lookups, coverage, measurement, rankers, set and tree-state authoring, dated prices)

Part of the [spec spine](README.md). It covers work units WU-31…WU-36 and WU-49, and acceptance criteria
AC-K1…AC-K46. The spine wins any disagreement; fold fixes back into it. The adversarial review's fixes
for this slice (D-218) and the coordinator's resolutions of its open items (D-222…D-228) are folded in
under their spine IDs.

This slice delivers goals G-10 and G-11, plus T1. It gives the pipeline the server tools it needs before a
plan can be compiled:
- **K1** reads PoB2's loaded gem, unique, passive and mod data, and lists an ascendancy's nodes.
- **K2** says, per line, whether PoB applies it, and which skill stats PoB probably ignores.
- **M1** measures offense per active skill and per stat set (PoB2's "skill part"), and makes
  `set_main_skill` select the stat set instead of writing PoE1's `skillPart`.
- **M2** makes both rankers list what PoB can't measure.
- **L1** authors a stage's state: sets and loadouts, weapon-set passives, attribute choices, tree jewels,
  per-set flask toggles, a build-wide main-skill index, and auto-level mode (bridge only).
- **T1** puts the date and league on price results, and a stable error-kind prefix on trade-tool errors
  (D-218).
- It also fixes the `update_tree_delta` defect and the two `search_tree_nodes` bugs.

Throughout, a `read` tool never changes the build (D-176), and nothing caches a price (D-46).

## 1. Existing system context (this slice)

Citations are in the recon ([`../recon.md`](../recon.md) §1) and the pin grounding
([`../../design/grounding/2026-10-07-pob-pin-and-spikes.md`](../../design/grounding/2026-10-07-pob-pin-and-spikes.md),
cited as "pin §"). `vendor/` is `vendor/PathOfBuilding-PoE2/src` at v0.23.1.

| Component | Today | Changed by |
|---|---|---|
| `search_tree_nodes`: schema `toolSchemas.ts:450-470`, router `toolRouter.ts:420-430`, handler `luaHandlers.ts:584-671`, Lua `search_nodes` `BuildOps.lua:1337-1468` | `query` is required. `'any'` is compared literally, so it matches nothing (`:1369-1377`). The loop stops at `maxResults` (`:1361`) before sorting (`:1457`). Ascendancy notables are typed `notable`. Default 20, cap 30 (`luaHandlers.ts:604`) | WU-31 (C-43) |
| `list_gems` (`BuildOps.lua:1473-1536`) | No description, stat text, stat sets or support rules. Nothing in `pob-api/` touches the stat describer, `main.uniqueDB` or `modLib.parseMod` | unchanged; C-37 is new |
| `set_main_skill`: schema `toolSchemas.ts:611-627`, handler `itemSkillHandlers.ts:316-358`, alias `toolRouter.ts:481`, Lua `set_main_selection` `BuildOps.lua:542-562` | The undocumented `skill_part` sets PoE1's `srcInstance.skillPart`. PoB2 keeps the choice in `srcInstance.statSet[grantedEffectId]` (`vendor/Modules/Build.lua:375-381`) and saves it as `<Gem><StatSetIndex grantedEffect index>` (`vendor/Classes/SkillsTab.lua:370-378, :506-512`) | WU-33 (C-44) |
| `lua_get_stats`: handler `luaHandlers.ts:278-374`, Lua `get_stats` → `export_stats` `BuildOps.lua:69-95` | `category:'offense'` reads 38 fields (`luaHandlers.ts:289-300`) from `mainOutput` only and shows ≤ 50 non-zero lines. On C-1's 5000-char truncation list (`createServer.ts:80-83`) | WU-33 (C-45) |
| `suggest_supports` (`poe2SkillHandlers.ts:73-125`, `poe2SkillService.ts:300-319`); `get_passive_upgrades` (`treeHandlers.ts:361-505`) | A null delta sorts as −∞ and falls off the list. Ascendancy notables are dropped (`:411-426`). Only improvers are listed | WU-34 (C-47) |
| Item sets (`BuildOps.lua:1840-1869`); no skill- or config-set actions | At the pin: `New`/`Copy`/`SetActive` for item sets (`vendor/Classes/ItemsTab.lua:1439-1476`), skill sets (`SkillsTab.lua:1496-1541`) and config sets (`ConfigTab.lua:994-1031`). Loadouts come from `SyncLoadouts` (pin §B1) | WU-35 (C-39) |
| `set_level` (`BuildOps.lua:175-190`) | Always sets `characterLevelAutoMode = false` | WU-35 (D-196) |
| `set_tree`, `update_tree_delta` (`BuildOps.lua:126-162, :259-281`); handler `luaHandlers.ts:533-582` | `reimport_nodes` preserves weapon-set tags (`allocMode`) and attribute choices (`hashOverrides`), but nothing sets them. Lua doesn't auto-path and doesn't cap ascendancy points. The handler renders `autoPathedNodes`, `skippedAscendancyNodes` and `tree.ascendancyPointsUsed`, which Lua never sends | WU-36 (C-40, C-48) |
| `add_item` (`toolSchemas.ts:552-569`); `add_item_text` (`BuildOps.lua:577-622`) | The enum is `ITEM_SLOTS` (`toolSchemas.ts:22-26`). `create_socket_group` (`:641`) and `setup_skill_with_gems` (`:846`) share it, and AC-E38 pins both. A tree socket's slot is `Jewel <nodeId>`, which writes `spec.jewels` (`vendor/Classes/ItemSlotControl.lua:74-86`) | WU-36 (C-46) |
| `get_item_price` (`tradeHandlers.ts:265-339`); `search_trade_items` (`:89-200`) | Both name the league; neither gives a date. Each makes 1 search and 1 fetch through the limiter (C-11), which refuses any wait over 30 s as `would_wait` and names the wait. A failure is a `TradeError` with a `kind` (`src/trade/errors.ts:7-19`), but `wrapHandler` re-throws only its message (`src/utils/errorHandling.ts:25-35`), so the caller sees `Error: Failed to <action>: <message>` (`toolRouter.ts:189-192`) and the kind is lost | WU-49 (C-49, D-218) |

**Pin facts relied on** (pin §B2–§D, re-probed for this slice):
- **Tree.** Titan has 17 nodes with `ascendancyName == "Titan"`, 8 of them notables. The tree has 19
  jewel-socket nodes (`type == "Socket"` or `containJewelSocket`; `vendor/Classes/ItemsTab.lua:278-290`).
- **Line joins.** A failed item line is re-parsed joined with the next line (`Item.lua:946-959`). A
  failed passive line is joined with one or more following lines, and the absorbed lines get an empty
  mod list (`PassiveTree.lua:448-466`). Clean joins at the pin include:
  - Waveshaper's "…Mana Regeneration Rate also" + "apply to Energy Shield Recharge Rate";
  - Demolitionist's "Gain 4% of Damage as Extra Fire Damage for" + "every different Grenade fired in the
    past 8 seconds". Demolitionist is node 38570, allocated in the golden build.
- **`modLib.parseMod` results:**
  - "+5 to any Attribute" gives an empty mod list;
  - "Charms use no Charges" gives the flag `CharmsUseNoCharges`, which no file in `Modules/` or
    `Classes/` names except `ModParser.lua`;
  - "Your Hits are Crushing Blows" gives no mod list.
- **Stat sets.** The golden build's Gas Grenade has Impact, Poison Cloud and Explosion. Blood Hunt has Dash
  and Explosion.
- **Red-tooltip rule.** A described line is unsupported when its stat is in neither `statSet.statMap` nor
  `data.skillStatMap` (`vendor/Classes/GemTooltip.lua:17-37`).

## 2. Contract detail

The spine's §3.2 rows are binding. This section adds the argument types, defaults, output, errors and
bridge actions that the spine delegates to this slice.
- **Errors.** Tool errors are `isError` (D-27). A failing `mutate` changes neither the export nor
  `revision` (C-3).
- **Slice choices.** Choices made within that delegation are marked **[slice]** and listed in §6. Those
  the coordinator accepted on 2026-10-07 are marked **[slice, accepted]**.

### 2.1 Bridge changes (C-2, C-5; modified)

| Lua action | Module | Params (camelCase) | Reply | WU |
|---|---|---|---|---|
| `lookup_game_data` (new) | `pob-api/API/Lookup.lua` | `mode`, `query?`, `level?`, `quality?`, `slot?`, `maxResults?` | `{result:{mode, total, results[]}}`, carrying what §2.2 renders | WU-31 |
| `search_nodes` | `BuildOps.lua` | adds `ascendancy?`; with it, `keyword` is optional | same shape; sorted before the cap | WU-31 |
| `check_coverage` (new) | `pob-api/API/Coverage.lua` | `itemText?`, `nodes?`, `gems?`, `build?`; `sourceNames` (required: the server's name scan, §2.4) | `{result:{counts, entries[]}}`, each entry `{source, line, status, remainder?, joinedWith?}` | WU-32 |
| `get_stats` | `BuildOps.lua` | adds `breakdown?: {groupIndex?, fields}` | unchanged without `breakdown`. With it, adds `breakdown: {groupIndex, label, skills:[{index, name, grantedEffectId, statSets:[{index, label, output}]}]}` | WU-33 |
| `set_main_selection` | `BuildOps.lua` | `skillPart` is renamed `statSet` (only `set_main_skill` calls it) | unchanged | WU-33 |
| `manage_sets` (new) | `pob-api/API/Sets.lua` | `setType`, `action`, `id?`, `title?`, `useSecondWeaponSet?` | `{result:{setType, activeId?, sets[], loadouts?}}` | WU-35 |
| `set_level` | `BuildOps.lua` | adds `autoMode?` (default false) | unchanged | WU-35 |
| `set_tree` | `BuildOps.lua` | adds `weaponSets?: {[nodeId]: 1\|2}`, which replaces the preserved tags, and `attributeChoices?: {[nodeId]: "strength"\|"dexterity"\|"intelligence"}`, which is applied over the preserved choices. Without either, `set_tree` behaves as today (AC-E29) | unchanged | WU-36 |
| `update_tree_delta` | `BuildOps.lua` | unchanged | adds `autoPathedNodes`, `skippedAscendancyNodes` and `tree.ascendancyPointsUsed` (already read at `pobLuaBridge.ts:808-810`) | WU-36 |

**Compatibility.** The spine's C-2/C-5 row is a modified contract that lists these changes (D-222). Every
change is additive except `set_main_selection`'s `skillPart` → `statSet` rename, which is internal: only
`set_main_skill` calls the action, and no external caller uses `skillPart`.

New modules are merged by one line in `Handlers.lua`, as `Trade.lua` is. Every new or changed action gets,
in the same merge, its C-5 schema, its typed wrapper and a `contract.test.ts` case (AC-B4). If anything
A-20 assumes is missing after a headless boot, the unit reports `blocked` (HG-12).

### 2.2 C-37 `lookup_game_data` (new, `read`, group `core`)

**Arguments.** `mode` (`gem`, `unique` or `mechanic`); `query` (a case-insensitive substring, required
for `gem` and `mechanic`); `gem_level` (**[slice]** default `naturalMaxLevel`); `gem_quality` (0–20,
**[slice]** default 0); `slot` (unique mode only: PoB's item type, such as `Gloves`, `Spear` or `Jewel`;
unique mode needs `query`, `slot` or both); `max_results` (**[slice, accepted]** default 20, cap 30, as in
`search_tree_nodes`; D-225).

**Order [slice].** Results are sorted, then cut: exact name matches first, then by name, then by id.
Mechanic hits sort by kind (gem, unique, passive, mod), then by name.

**gem mode** matches `data.gems` names. Each gem shows its name, kind, `data.skills[id].description` and
weapon requirement (`weaponRequirements`, else `weaponTypes`). Then come its stat sets in PoB's order,
each with its label and the lines `data.describeStats(calcLib.buildSkillInstanceStats({level, quality},
grantedEffect, statSet), statSet.statDescriptionScope)` (pin §B2). Then its quality effects as PoB's
tooltip shows them: under "At +20% Quality", each `qualityStats` entry is described at value × 20
(`vendor/Classes/SkillsTab.lua:917-930`). A support also gets "Supports:" (`requireSkillTypes`) and
"Can't support:" (`excludeSkillTypes`) lines, as `SkillType` names.

**Requirements (for D2's gem plan and V1's validity check; D-228).** Each gem also shows its requirements at
every gem level l from 1 to `naturalMaxLevel`, computed as PoB's gem tooltip computes them
(`vendor/Classes/GemTooltip.lua:186-192`):
- the character level `grantedEffect.levels[l].levelRequirement`;
- per attribute, `calcLib.getGemStatRequirement(<that level requirement>, gemData.reqStr | reqDex |
  reqInt, grantedEffect.support)` (`vendor/Modules/CalcTools.lua:129-135`). It is 0 for a support, and
  for an attribute whose weight is 0.

**[slice]** Format: one line `Requires level (gem levels 1–<n>): <r1>, <r2>, …`, then one line
`<Str|Dex|Int> (gem levels 1–<n>): <v1>, <v2>, …` per attribute with a non-zero weight. A support gets
the level line only.

**unique mode** matches a unique's name, any of its mod lines, or, with `slot`, its type. Each match shows
the name, the type, and `main.uniqueDB.list[…]:BuildRaw()` in a fenced block, ready for `add_item`.

**mechanic mode** searches gem descriptions and stat-set lines, unique mod lines, every passive's `sd`
lines (ascendancy nodes included) and the text of `data.itemMods`. Each hit is one line,
`[<kind>] <source>: <line>`, where kind is `gem`, `unique`, `passive` or `mod`. Passive hits name their
ascendancy; mod hits name their table.

**Errors:** an unknown `mode`; a missing required `query`; unique mode with neither `query` nor `slot`; an
unknown `slot`, answered with the valid types; a `gem_level` outside the gem's levels. No match is not an
error: the text says nothing matched.

### 2.3 C-43 `search_tree_nodes` (modified, `read`)

- **`ascendancy`** (new; a case-insensitive name) keeps only nodes with that `ascendancyName`, notables
  included. An unknown name is an error listing the valid ones. With it, `query` becomes optional; with
  neither, the call fails as today.
- **`'any'`** (or no `node_type`) filters nothing; the other filters are unchanged. Ascendancy notables
  stay typed `notable`: retyping them is a contract change beyond this epic, which needs the user (HG-12).
- **Order [slice].** Matches are sorted before the cap: type rank (keystone, notable, jewel, mastery,
  ascendancy, normal), then name, then id. The default 20 and cap 30 are unchanged.

### 2.4 C-38 `check_model_coverage` (new, `read`, group `core`)

**Arguments.** One or more of `item_text` (one item, as `add_item` takes it), `nodes` (ids or exact
names; a name selects every node bearing it) and `gems` (names). Or **[slice]** `build: true` alone,
which checks the active item set's equipped items, the active spec's nodes and the active skill set's
gems.

**Lines checked.** An item's implicit, explicit, rune and enchant lines (the ones `Item.lua:2158`
applies or drops), ranged as PoB ranges them; a node's `sd` lines.

**Status per line** (exactly one):

| Status | Rule |
|---|---|
| `fully parsed` | a non-empty mod list, no remainder |
| `partly parsed` | a non-empty mod list plus a remainder, which is shown |
| `unparsed` | no mod list |
| `parsed to nothing` | an empty mod list, no remainder |
| `possibly unread` | fully parsed, but some mod's name appears in no `.lua` file under PoB's `Modules/` or `Classes/`, except `Modules/ModParser.lua`. **[slice, accepted]** This applies S-b's by-name census (pin §B4) to mod names, through the server's scan below (D-226) |

**The name scan.** Headless PoB can't list files, so the server does the scan, with Node `fs`:
- **What.** It reads every `.lua` file directly under `Modules/` and `Classes/` of the PoB source the
  engine runs (`resolvePobSrc`, `src/engine/pobPath.ts`), except `Modules/ModParser.lua`. It collects
  every distinct identifier (`[A-Za-z_][A-Za-z0-9_]*`) in the file text: code, strings and comments
  alike, as S-b's by-name census did. At the pin that is 107 files and 18,806 names, about 0.3 MB as a
  JSON array.
- **When.** Once per server process: lazily, on the first `check_model_coverage` call, then memoized.
  An engine restart doesn't repeat it.
- **How Lua gets it.** **[slice]** Each `check_coverage` request carries the names as `sourceNames`, so
  an engine restarted by the session needs no extra step. Lua builds a set from them per request, and a
  mod name outside that set makes a fully parsed line `possibly unread`. A request without
  `sourceNames` fails, rather than silently skipping the rule.

**Joins (pin §B3).** Each line is first parsed alone with `modLib.parseMod`. Only a failed line is
re-parsed by its source's join rule: an item line with the next line (`Item.lua:946-959`), a passive
line with one or more following lines (`PassiveTree.lua:448-466`). A clean join is one entry naming all
its lines; a line absorbed by a join is never reported alone, so never as `parsed to nothing`. If the
join fails, the single line's status and remainder stand, never the joined remainder.

**Gems.** A gem is checked at the build's gem level and quality, or else at C-37's defaults. Every
described line whose `lineMap` stat is in neither `statSet.statMap` nor `data.skillStatMap` is marked
`possibly unmodelled; check config`. This is PoB's red-tooltip rule (pin §B4), which D-123 routes to
config.

**Output.** First, counts per status. Then the entries, grouped by source: `Item`, `Node <id> <name>`
or `Gem <name> / <stat set>`. **[slice]** Build mode lists only entries that aren't `fully parsed`, but its
counts cover every line.

**Errors:** no input; `build` combined with another input; an unknown gem or node (named); item text that
doesn't construct.

### 2.5 C-44 `set_main_skill` and C-45 `lua_get_stats` (modified)

**C-44.** The schema documents `skill_part`: the 1-based stat set of the main active skill
(`active_skill_index` if given, else the group's current one). Lua sets the group and active skill, then
`srcInstance.statSet = srcInstance.statSet or {}` and `srcInstance.statSet[<active effect's granted
effect id>] = skill_part`, as PoB's own dropdown callback does (`vendor/Modules/Build.lua:375-381`). It
never writes `skillPart`. The output names the stat set's label. **[slice]** An index outside 1…n is an
error naming n and the labels, and changes nothing.

**C-45 [slice: the spine says "slice 1 bounds the breakdown"].** The bound is one group per call:
`breakdown: true` plus `group_index` (default: the main socket group).
- **Measure, then restore (D-176).** For each active skill in the group's `displaySkillList`, and each of
  its stat sets, Lua makes it the main selection, rebuilds and reads the 38 offense fields. It then
  restores `mainSocketGroup`, every `mainActiveSkill`, every touched `srcInstance.statSet` (nil stays nil)
  and `calcsTab.input.skill_number`, and rebuilds.
- **Output.** One block per skill and stat set, headed `## <skill> / <stat set label> [skill_part <i>]`,
  listing its non-zero fields as `<Field>: <value>` in the offense list's order.
- **Errors and edges.** A `category` other than `offense` with `breakdown`, or a `group_index` past the
  last group, is an error. A group without an active skill gets a plain note. Without `breakdown`, every
  view is unchanged.

### 2.6 C-47 ranker amendments (modified; amends D-77, D-78 per D-143)

**Ranking unchanged.** Each ranking keeps its candidates, its order (delta descending, ties by name;
AC-E39), its `count` or `max_results`, and each ranked entry's text.

**New section.** Both rankers add "What PoB can't fully measure" after the ranking. Each entry is a name
(plus an id for passives) with its reasons:
- **`suggest_supports`:** pool candidates with a null measurement (with the error), and pool candidates
  C-38's gem rule marks `possibly unmodelled` (C-38's "not fully parsed" for a gem).
- **`get_passive_upgrades`:** measured candidates with a line C-38 doesn't rate `fully parsed` (with the
  line and its status), and candidates whose measurement returned no value.

**`include_ascendancy`** (on `get_passive_upgrades`; boolean, default false; D-197: ascendancy notables
only on request). By default no ascendancy node appears anywhere, keeping D-77's exclusion. When it is
true:
- **[slice]** every unallocated, reachable notable of the build's own ascendancy is measured over its
  whole path, with no keyword selection, and priced in ascendancy points (PoB's `pathDist`);
- **[slice]** these are ranked by the same rule in their own section, "Ascendancy notables (cost in
  ascendancy points)", and also enter the can't-measure section;
- a notable beyond the build's remaining ascendancy points is marked, not hidden (D-227). The remaining
  points r are 8 minus the points used (allocated ascendancy nodes, the start node excluded, as C-48 counts
  them). An entry whose `pathDist` exceeds r ends, in either section, with **[slice]** ` (over budget:
  needs <pathDist>, <r> left)`.

`get_passive_upgrades` is on C-1's truncation list, so its whole default output stays within 5000 chars
(AC-K21).

### 2.7 C-39 `manage_sets` (new, `mutate`, group `core`) and auto-level (D-196)

**Arguments.** `set_type` (`item`, `skill`, `config` or `loadout`); `action` (`list`, `create`, `copy`,
`rename` or `select`; a loadout takes only `list` and `select`; there is no delete); `id` (the source for
`copy`, the target for `rename` and `select`); `title` (the new title, or the loadout name for a loadout
`select`); `use_second_weapon_set` (item sets only; **[slice]** it applies to the set the action
targets: the new set, or `id`).

**Behaviour.**
- `create` makes set `#sets+1` (`New…Set`); `copy` uses `Copy…Set`; neither activates it. `select` calls
  `SetActive…Set`. Every action except `list` rebuilds.
- Loadout actions first run `build:SyncLoadouts()` (pin §B1, R-29). The list is
  `build.controls.buildLoadouts.list` without its `^7^7` menu rows. A loadout `select` calls
  `SetActiveLoadout(GetLoadoutByName(title))`; an unknown name fails cleanly. `CopyLoadout` is never
  called: it crashes on `{id}` names (D-103).

**Titles.** Each `{…}` group in a title must match PoB's link pattern `[A-Za-z0-9,]+`, with no spaces
(`vendor/Modules/Build.lua:641,669`). Otherwise the call fails, naming the rule, and nothing is created.

**Output.** Every action returns the type's list: id, title and the active marker. Item sets also show
`useSecondWeaponSet`. Skill sets also show the group at the build-wide `mainSocketGroup` (label and active
skills), or `none`. This is the main-skill-index check (Target state 5).

**Auto-level.** `set_level {autoMode:true}` sets `characterLevel` and `characterLevelAutoMode = true`.
Without the flag, `set_level` behaves as today. `set_character_level` gets no auto argument; exposing one
is HG-12.

### 2.8 C-40 `set_tree_state` (new, `mutate`, group `core`), C-46, C-48

**C-40 arguments.** Both act on the active spec; at least one is required.
- `weapon_set_nodes: {"1"?: string[], "2"?: string[]}` **[slice]** replaces the tags. Listed nodes get
  that set; every other allocated node gets none.
- `attribute_choices: {[nodeId]: "strength"|"dexterity"|"intelligence"}` **[slice]** merges. Unlisted
  nodes keep their choice.

The handler calls `set_tree` with the current nodes and these parameters.

**C-40 errors** (all-or-nothing; each names the node and the reason): an unallocated node; a weapon-set
node PoB never tags (an ascendancy node, a keystone, a socket, or a `containJewelSocket` node;
`vendor/Classes/PassiveSpec.lua:931`); a node in both lists; a choice on a node without `isAttribute`; a
value outside the enums; any change to the allocated node set.

**C-40 output.** The tags per weapon set, the choices by node, and the resulting Str, Dex and Int.

**C-46.** `add_item`'s `slot_name` enum becomes `ITEM_SLOTS` followed by `Jewel <id>`, ascending, for each
jewel socket of the pinned tree (19 at the pin). `ITEM_SLOTS` itself, and so the enums AC-E38 pins, are
unchanged (D-223). Jewels reach `spec.jewels` through the existing slot path, and `IsItemValidForSlot` still
rejects non-jewels.

**C-48 (D-194).** Added nodes are processed in the order given.
- **Auto-path.** An unallocated node takes PoB's own path (`node.path`, as `search_nodes` exposes it);
  path nodes beyond the requested ones are `autoPathedNodes`. An adjacent node is allocated alone.
- **Ascendancy cap** (stated at `toolSchemas.ts:388`). Ascendancy points count allocated ascendancy nodes,
  excluding the start node. A requested node whose path would exceed 8 is skipped and listed in
  `skippedAscendancyNodes`. `tree.ascendancyPointsUsed` is the count after the call.
- Removal is unchanged, and an empty delta changes nothing (AC-E28).

### 2.9 C-49 dated prices (modified, kind `none`, group `trade`)

**Output.** Every non-error result of `get_item_price` and `search_trade_items`, including "No price data
found" and "No priced listings found", carries `League: <id>` and `Checked: <YYYY-MM-DDTHH:MM:SSZ>` (the
UTC time the search was sent). Both lines come before the listings, so C-1's truncation can't drop them.
The time is wall-clock, `ServerDeps.now ?? Date.now`, as the currency cache's ages are
(`createServer.ts:179-180`). Nothing is cached (D-46).

**Error prefix (D-218).** Every `isError` result that a `TradeError` (C-10) causes in
`get_item_price`, `search_trade_items` or `get_leagues`, the trade handlers that call the trade client,
starts with a stable prefix naming the error's kind: `Error: [trade:<kind>] Failed to <action>:
<message>`.
- **Kinds.** `<kind>` is the `TradeErrorKind` value, unchanged (`src/trade/errors.ts:7-19`): `no_session`,
  `session_rejected`, `too_complex`, `invalid_query`, `rate_limited`, `locked_out`, `would_wait`, `auth`,
  `http`, `network`, `timeout` or `disabled`. A 429 from the trade site is `rate_limited`
  (`tradeClient.ts:287-293`).
- **How.** The trade handlers' wrapper keeps the kind that `wrapHandler` drops today.
- **Scope.** An error that isn't a `TradeError` gets no prefix. `find_upgrades` keeps C-14's own wording:
  its rate-limit stops aren't errors. `search_stats` and `trade_query_options` send no trade request.
- **Why.** The pipeline's pricing procedure (slice 3 §9) and run log classify outcomes by this prefix,
  not by parsing prose. NFR-22 (no 429s and no lockouts while pricing) is checked that way.

**No batch mode [slice, accepted; C-49 left this to slice 1; D-224].** Per-item calls already pace R1b's and
D1's pricing: the limiter answers an over-long wait with `would_wait` and names the wait, the signal D-202
relies on (C-11). A batch call would need a call deadline, which D-22/D-47 give only to `find_upgrades`
(changing that is HG-12). It would also need partial results after a refusal, and a way past A-25's 120 s
backgrounding. Input schemas are unchanged, and error answers change only by the prefix above; the
pipeline records errors as `unavailable` (D-164).

## 3. Work units

The serialized-wiring rule applies (spine §8). Each tool-adding unit here (WU-31, WU-32, WU-35, WU-36),
in its own merge: moves every count site (spine §1.3) up by 1 from its rebased base; adds a
`tool-disposition.json` entry (`bucket:"new"`) and `expect:"ok"` samples in `tool-calls.json`
(state-changing arguments for `mutate`); and runs `pnpm build && pnpm docs:tools --write`. A unit that
changes an existing description regenerates the table too. These four units add four of the epic's 7
new tools; with slice 2's, the total is 84, or 83 without poe.ninja (spine C-1).

### WU-31: K1 lookups and the `search_tree_nodes` fixes
- kind: build
- depends-on: []
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Lookup.lua` (new), `pob-api/API/Handlers.lua` (merge line), `pob-api/API/BuildOps.lua` (`search_nodes`), `src/handlers/lookupHandlers.ts` (new), `src/handlers/luaHandlers.ts` (`handleSearchTreeNodes`), `src/server/toolRouter.ts` (`search_tree_nodes` case), `toolSchemas.ts`, `toolMeta.ts`, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts`, tool fixtures, count sites, README table]
- produces: [C-37, C-43, `Lookup.lua`'s gem-resolution and describer helpers (used by WU-32)]
- consumes: [C-2, C-3, C-5, C-8]
- acceptance: [AC-K1…AC-K9, AC-K45, AC-B1, AC-B2, AC-B3, AC-B4]
- milestone: M-10
- summary: Add the tool and Lua action (§2.2), including each gem's requirements per level. Extend
  `search_nodes`: `ascendancy`, an optional `keyword`, `'any'` as no filter, and a full sort before the
  cut. `search_tree_nodes`' schema gains
  `ascendancy` and drops `required`; its description states the rule, and the router follows. Samples:
  one per mode, and `search_tree_nodes {ascendancy:"Gemling Legionnaire"}`.

### WU-32: K2 `check_model_coverage`
- kind: build
- depends-on: [WU-31]
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Coverage.lua` (new), `pob-api/API/Handlers.lua` (merge line), `src/handlers/coverageHandlers.ts` (new), `src/engine/pobSourceNames.ts` (new; the name scan), tool wiring files, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts`, `tests/fixtures/items/coverage-amulet.txt` (new), `tests/e2e/serverTools.test.ts` (new), tool fixtures, count sites, README table]
- produces: [C-38, its per-line and per-gem classifiers (used by WU-34)]
- consumes: [WU-31's helpers, C-2, C-3, C-5, C-6 (the PoB source path)]
- acceptance: [AC-K10…AC-K14, AC-K42, AC-K46, AC-B1, AC-B2, AC-B3, AC-B4]
- milestone: M-10
- summary: Implement §2.4. The possibly-unread scan is §2.4's name scan: Node `fs` reads PoB's
  `Modules/` and `Classes/` once per server process, and each `check_coverage` request passes the names
  to Lua. Samples: `{item_text:"$RUBY_RING_TEXT"}` and `{build:true}`.

### WU-33: M1 per-skill breakdown and the stat-set fix
- kind: build
- depends-on: []
- role: lua-dev + backend-dev
- touches: [`pob-api/API/BuildOps.lua` (`set_main_selection`; `export_stats` or a helper `get_stats` calls), `pob-api/API/Handlers.lua` (`get_stats` passes `breakdown`), `src/handlers/luaHandlers.ts` (`handleLuaGetStats`), `src/handlers/itemSkillHandlers.ts` (`handleSetMainSkill`), `toolRouter.ts`, `toolSchemas.ts` (`skill_part`, `breakdown`, `group_index`), `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts`, `tests/fixtures/tool-calls.json`]
- produces: [C-44, C-45, the `get_stats` breakdown that WU-41's compile record reads]
- consumes: [C-2, C-3, C-5]
- acceptance: [AC-K15…AC-K19, AC-B3, AC-B4, AC-B5]
- milestone: M-10
- summary: Replace the `skillPart` write with the `statSet` write and rename the bridge param. Add the
  breakdown with its exact restore. Samples: `set_main_skill` with `skill_part`, and the breakdown, both
  on the Gas Grenade group.

### WU-34: M2 ranker amendments
- kind: build
- depends-on: [WU-32]
- role: backend-dev
- touches: [`src/handlers/treeHandlers.ts` (`handleGetPassiveUpgrades`), `src/handlers/poe2SkillHandlers.ts`, `src/services/poe2SkillService.ts`, `pob-api/API/BuildOps.lua` (`list_support_candidates`, only if errors need surfacing), `toolSchemas.ts` (`include_ascendancy`), `toolRouter.ts`, `tests/fixtures/tool-calls.json`]
- produces: [C-47 (amends D-77, D-78)]
- consumes: [C-38's classifiers (WU-32); the existing `calc_with`, `search_nodes`, `list_support_candidates`]
- acceptance: [AC-K20, AC-K21, AC-K22, AC-K44, AC-B3, AC-B5]
- milestone: M-10
- summary: Add the can't-measure section, computed in the same engine call, and `include_ascendancy`
  with its over-budget mark. AC-E32 and AC-E39 must still pass unchanged. Sample:
  `get_passive_upgrades {include_ascendancy:true}`.

### WU-35: L1 sets, loadouts and the auto-level flag
- kind: build
- depends-on: [WU-32]
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Sets.lua` (new), `pob-api/API/Handlers.lua` (merge line; `set_level` passes `autoMode`), `pob-api/API/BuildOps.lua` (`set_level`), `src/handlers/setHandlers.ts` (new), tool wiring files, `src/engine/schemas.ts`, `src/pobLuaBridge.ts` (`setLevel` option), `tests/integration/contract.test.ts`, `tests/e2e/serverTools.test.ts` (its `tools/list` check gains `manage_sets`), tool fixtures, count sites, README table]
- produces: [C-39, `set_level`'s `autoMode` (D-196; used by WU-41)]
- consumes: [C-2, C-3, C-5]
- acceptance: [AC-K23…AC-K30, AC-B1, AC-B2, AC-B3, AC-B4]
- milestone: M-10
- summary: Implement §2.7. `list_item_sets` and `select_item_set` stay as they are. It depends on
  WU-32 because it extends WU-32's `tests/e2e/serverTools.test.ts`. Sample:
  `manage_sets {set_type:"skill", action:"create", title:"Sample {2}"}`.

### WU-36: L1 tree state, tree jewels, the `update_tree_delta` fix
- kind: build
- depends-on: [WU-32]
- role: lua-dev + backend-dev
- touches: [`pob-api/API/BuildOps.lua` (`set_tree`, `reimport_nodes`, `update_tree_delta`; `add_item_text` only if the jewel path needs it), `src/handlers/luaHandlers.ts` (`handleUpdateTreeDelta`), `src/handlers/treeStateHandlers.ts` (new), `toolSchemas.ts` (the `add_item` enum and `set_tree_state`; **not** the shared `ITEM_SLOTS`, D-223), tool wiring files, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts`, `tests/e2e/serverTools.test.ts` (its `tools/list` check gains `set_tree_state`), `tests/integration/engineKinds.test.ts` and `tests/integration/toolHygiene.test.ts` (each one's `PLACEHOLDERS` map gains `$JEWEL_TEXT`), `tests/fixtures/items/jewel.txt` (new), tool fixtures, count sites, README table]
- produces: [C-40, C-46, C-48, the `set_tree` tag and choice params (used by WU-41)]
- consumes: [C-2, C-3, C-5]
- acceptance: [AC-K31…AC-K38, AC-B1, AC-B2, AC-B3, AC-B4, AC-B5]
- milestone: M-10
- summary: Implement §2.8. `handleUpdateTreeDelta` keeps its text, and now receives the fields it
  renders. It depends on WU-32 because it extends WU-32's `tests/e2e/serverTools.test.ts`. Samples:
  `set_tree_state` on a golden leaf node, and `add_item` of `$JEWEL_TEXT` (a new placeholder in both
  `PLACEHOLDERS` maps) into a free, allocated socket. Its edits to `engineKinds.test.ts` and
  `toolHygiene.test.ts` are serialized wiring (spine §8): WU-40 edits the same two files, so the two
  units merge one at a time.

### WU-49: T1 dated price outputs
- kind: build
- depends-on: []
- role: backend-dev
- touches: [`src/handlers/tradeHandlers.ts` (`handleGetItemPrice`, `formatSearchResults`, the no-result paths; the trade handlers' error wrapper), `tests/fixtures/trade2/search-empty.*` (new), `tests/mcp/datedPrices.test.ts` (new), `tests/mcp/tradeErrorPrefix.test.ts` (new)]
- produces: [C-49, the `[trade:<kind>]` error prefix (D-218)]
- consumes: [C-10, C-11, C-12]
- acceptance: [AC-K39, AC-K40, AC-K41, AC-K43]
- milestone: M-10
- summary: Add the `League:` and `Checked:` lines and the error prefix (§2.9). There is no schema change
  and no batch mode, so the README table and the counts don't move.

## 4. Acceptance criteria

The test classes are the spine's (§12). Terms used below:
- **Golden** is `tests/fixtures/builds/grenadator.xml`.
- **In-process, engine-required** means `startSessionFixture` (`tests/helpers/engineSession.ts`) inside
  `engineDescribe`.
- **Lua query** means `__test_eval`, with test actions on, run through `session.run`.
- **G** is the golden socket group whose active skill is Gas Grenade (Impact, Poison Cloud, Explosion),
  found by a Lua query. It isn't the main group.

Cross-checks compare against PoB's own data and functions, never against the tool's earlier output.

**K1 (WU-31)**: `tests/integration/lookupGameData.test.ts`, in-process, engine-required

- **AC-K1 (C-37 gem).** `{mode:"gem", query:"Blood Hunt", gem_level:20, gem_quality:0}`:
  - the first result is Blood Hunt, naming the weapon `Spear`;
  - its description equals `data.skills[<id>].description` (Lua query);
  - its stat sets are `Dash`, then `Explosion`. Each one's lines equal, in order, the Lua query's
    `data.describeStats(calcLib.buildSkillInstanceStats({level=20,quality=0}, ge, statSet),
    statSet.statDescriptionScope)`. Explosion's lines include "Enemies lose Life equal to 25% of
    Consumed Blood Loss";
  - its quality lines equal the Lua-computed `qualityStats` descriptions at value × 20.
- **AC-K2 (C-37 support rules).** A Lua query picks the first support gem by name that has non-empty
  `requireSkillTypes` and `excludeSkillTypes`. Its "Supports:" and "Can't support:" lines list exactly
  those `SkillType` names.
- **AC-K3 (C-37 unique).**
  - `{mode:"unique", query:"Atziri's Acuity"}` returns one match whose text equals the uniqueDB entry's
    `BuildRaw()` (Lua query) and contains "causes Blood Loss". `add_item` with that text into `Gloves`
    succeeds, and `get_equipped_items` shows it.
  - `query:"Aggravate Bleeding"` includes Saitha's Spear and The Smiling Knight (pin §D);
    `{query:"Blood Loss", slot:"Gloves"}` returns only `Gloves`; `slot:"Nonsense"` → `isError` listing the
    types.
- **AC-K4 (C-37 mechanic).** `query:"Crushing Blow"` includes `[passive] Crushing Impacts`, naming Titan,
  with "Your Hits are Crushing Blows". `query:"Blood Loss"` with `max_results:30` includes a `gem` hit for
  Blood Hunt and a `unique` hit for Atziri's Acuity. Every hit's kind is gem, unique, passive or mod, and
  every line contains the query (case-insensitive).
- **AC-K5 (C-37 bounds, order, errors).**
  - In every mode, `max_results:50` yields ≤ 30 results and the default ≤ 20. The results equal the first
    N of the Lua action's full list (`maxResults:10000`), which is in §2.2's order.
  - Each is `isError`: an unknown `mode`; gem mode without `query`; unique mode with neither `query` nor
    `slot`; `gem_level:999`. `query:"zzzz"` isn't an error, and says nothing matched.
- **AC-K6 (C-37 read kind, D-176).** In `engineKinds.test.ts`, each mode's `ok` sample leaves the
  canonical export identical and `revision` unchanged (part of AC-B3).
- **AC-K45 (C-37 requirements; WU-31).** In `lookupGameData.test.ts`, `{mode:"gem", query:"Blood Hunt"}`:
  - the `Requires level` line lists, for gem levels 1…20, `grantedEffect.levels[l].levelRequirement`
    (Lua query; 0, 3, 6, 10, … 90 at the pin);
  - the `Dex` line lists `calcLib.getGemStatRequirement(<that requirement>, gemData.reqDex,
    grantedEffect.support)` for each level (Lua query);
  - there is no `Str` or `Int` line, since Blood Hunt's `reqStr` and `reqInt` are 0.

  For AC-K2's support gem, the level line is present and there is no attribute line.

**`search_tree_nodes` (WU-31)**: `tests/integration/searchTreeNodes.test.ts`, in-process, engine-required

- **AC-K7 (C-43 ascendancy).** On the golden build (a Gemling Legionnaire), `{ascendancy:"Titan"}` with
  no query lists exactly the ids with `ascendancyName == "Titan"`, per a Lua query over
  `build.spec.tree.nodes` (17 at the pin, pin §B2's 8 notables among them).
  `{ascendancy:"Titan", query:"Crushing"}` lists Crushing Impacts and only Titan nodes.
  `{ascendancy:"Nonesuch"}` → `isError` listing the names; `{}` → `isError`.
- **AC-K8 (C-43 `'any'`; regression).**
  - `{query:"Life", limit:30, node_type:"any"}` returns the same ids, in the same order, as without
    `node_type`.
  - With `keystone`, `notable` or `jewel`, every result has that type, and ascendancy notables still show
    `[NOTABLE]`.
  - The sample `{query:"Life", limit:5}` still passes the engine-kind check (AC-E16) and the hygiene
    checks.
- **AC-K9 (C-43 sort before cap).** `{query:"Life", limit:5}` returns, in output order, the first 5 of
  `search_nodes {keyword:"life", maxResults:100000}`, run through `session.run`. That full list is ordered
  by type rank (keystone, notable, jewel, mastery, ascendancy, normal), then by name, then by id.

**K2 (WU-32)**: `tests/integration/modelCoverage.test.ts`, in-process, engine-required

- **AC-K10 (C-38 item statuses).** `{item_text}` with `tests/fixtures/items/coverage-amulet.txt` reports the
  statuses below. Each equals the status re-derived by §2.4's rules from `modLib.parseMod(line)` (Lua
  query).

  | Line | Status |
  |---|---|
  | `+30 to maximum Life` | `fully parsed` |
  | `+5 to any Attribute` | `parsed to nothing` |
  | `Charms use no Charges` | `possibly unread` |
  | `10% of Physical damage dealt by your Hits causes Blood Loss` | `partly parsed`, remainder ` dealt by your Hits causes Blood Loss` |
  | `Your Hits are Crushing Blows` | `unparsed` |
- **AC-K11 (C-38 item join).** With Waveshaper's `BuildRaw()` (Lua query) as `item_text`, "…Mana
  Regeneration Rate also" and "apply to Energy Shield Recharge Rate" form one joined entry that isn't
  `unparsed`. Neither line appears alone.
- **AC-K12 (C-38 passives).** In `{nodes:["Crushing Impacts"]}`, "Your Hits are Crushing Blows" is
  `unparsed` and "25% more Damage against Heavy Stunned Enemies" is `fully parsed` (pin §D).
  `{nodes:["38570"]}` (Demolitionist) gives one joined entry with the joined parse's status (Lua query),
  and its second line is never `parsed to nothing`. An unknown node → `isError` naming it.
- **AC-K13 (C-38 gems).** `{gems:["Blood Hunt"]}` marks both Explosion lines about Consumed Blood Loss
  `possibly unmodelled; check config`. For Blood Hunt, Brutality I and Heft, the marked lines equal those
  whose `lineMap` stat is in neither `statSet.statMap` nor `data.skillStatMap` (Lua query); Brutality I
  and Heft get none (pin §D's true negatives). An unknown gem → `isError`.
- **AC-K14 (C-38 build mode, errors, read kind).** On the golden build, `{build:true}` lists no
  `fully parsed` entry. Each listed entry has the status a single-source call gives the same item text,
  node or gem. Demolitionist's second line is never listed as `parsed to nothing`, and the counts sum to
  the lines checked. `{}` and `{build:true, gems:["Heft"]}` → `isError`. The `engineKinds.test.ts`
  samples leave the export and `revision` unchanged.
- **AC-K42 (stdio).** Stdio end-to-end, engine-required: `tests/e2e/serverTools.test.ts`, through
  `spawnServer`.
  - `tools/list` includes `lookup_game_data` and `check_model_coverage` in group `core` (and
    `manage_sets` and `set_tree_state` once merged).
  - `lookup_game_data {mode:"gem", query:"Blood Hunt"}` and `check_model_coverage {item_text:<ruby-ring
    fixture>}` return non-error text naming Blood Hunt and a status.
  - Every stdout line is JSON-RPC (NFR-8).
- **AC-K46 (C-38 name scan; WU-32).** In `modelCoverage.test.ts`, plus a `contract.test.ts` case:
  - `pobSourceNames(<the PoB src dir>)` contains `Life` and lacks `CharmsUseNoCharges`, which only
    `Modules/ModParser.lua` names (§1). A second call returns the same `Set` instance.
  - Two `check_model_coverage` calls in one server list each of `Modules/` and `Classes/` at most once
    (an `fs` spy).
  - In `contract.test.ts`, `check_coverage` without `sourceNames` → `ok:false`. With `sourceNames:[]`,
    the line `+30 to maximum Life` is `possibly unread`, which shows Lua uses the names it is passed.

**M1 (WU-33)**: `tests/integration/skillBreakdown.test.ts`, in-process, engine-required

- **AC-K15 (C-44 stat set).** After `set_main_skill {group_index:G, skill_part:3}`:
  - (a) a Lua query shows `srcInstance.statSet[<Gas Grenade's granted effect id>] == 3` on the main active
    skill, and `srcInstance.skillPart == nil`;
  - (b) the export has `<StatSetIndex grantedEffect="<that id>" index="3"/>` on that gem;
  - (c) the output names `Explosion`;
  - (d) after `lua_save_build` under a new name and `lua_load_build`, (a) and (b) still hold;
  - (e) `lua_get_stats {category:"offense"}` differs from the `skill_part:1` result in at least one field.
- **AC-K16 (C-44 errors; regression).** `skill_part` 0 or 4 on G → `isError` naming 3 stat sets and their
  labels, with the export and `revision` unchanged. `set_main_skill {group_index:11}` (the golden main
  group) adds no `<StatSetIndex>`, and CombinedDPS stays 104489.78 ± 0.01. The schema lists `skill_part`,
  and no Lua under `pob-api/API/` writes `srcInstance.skillPart`.
- **AC-K17 (C-45 values).** `lua_get_stats {breakdown:true, group_index:G}` shows Impact, Poison Cloud and
  Explosion blocks, in that order. For each i, block i's lines equal the non-zero lines of
  `lua_get_stats {category:"offense"}` after `set_main_skill {group_index:G, skill_part:i}` on a fresh
  golden load.
- **AC-K18 (C-45 exact restore, D-176).** Across that breakdown:
  - the canonical export is identical and `revision` unchanged;
  - `lua_get_stats {category:"offense"}` is identical before and after;
  - a Lua query shows `mainSocketGroup`, every `mainActiveSkill`, every `srcInstance.statSet` (nil stays
    nil) and `calcsTab.input.skill_number` unchanged.

  The matching `engineKinds.test.ts` sample passes (AC-B3).
- **AC-K19 (C-45 bound and errors; regression).** The golden main group's breakdown is ≤ 5000 chars,
  with no truncation notice. `{breakdown:true, group_index:999}` and `{breakdown:true,
  category:"defense"}` → `isError`, and a group without an active skill gets a non-error note.
  `lua_get_stats {}` and `{category:"offense"}` contain no `## ` block, and AC-E25, AC-E26 and AC-E41 pass
  unchanged.

**M2 (WU-34)**: `tests/integration/rankerAmendments.test.ts`, in-process, engine-required

- **AC-K20 (C-47 `suggest_supports`).** On the golden main group, `{group_index:11, count:3}`: AC-E39's
  test passes unchanged, and the ranked entries are the pool's first 3 by delta descending, ties by name.
  The can't-measure section names exactly, each once, the union of the pool candidates
  (`list_support_candidates`) with a null measurement and those `check_model_coverage {gems:[name]}`
  marks `possibly unmodelled`.
- **AC-K21 (C-47 passive default).** On the golden build, `get_passive_upgrades {focus:"both",
  max_results:3}`:
  - every can't-measure entry has a line `check_model_coverage {nodes:[id]}` doesn't rate
    `fully parsed`, **or** a null measurement;
  - conversely, every candidate in the whole measured pool with such a line or a null measurement is in
    that section, not only the ranked ones. A Lua query rebuilds the pool as the handler builds it
    (`treeHandlers.ts:395-436`): for each of `focus:"both"`'s keywords (`damage`, `critical`, `life`,
    `energy shield`), `search_nodes`' 8 nearest unallocated, non-ascendancy notables with a path, by
    `pathDist`, then name, then id, skipping ids already taken. The pool's size equals the output's
    `Measured <n>` count, and `calc_with` over each path (Lua query) gives the null measurements;
  - no output id has an `ascendancyName` (Lua query; D-77 kept);
  - the whole default output is ≤ 5000 chars, and AC-E32 passes unchanged.
- **AC-K22 (C-47 `include_ascendancy`, D-197).** After `lua_new_build {class_name:"Warrior",
  ascendancy:"Titan"}`, `{focus:"defence", include_ascendancy:true}`:
  - every id under "Ascendancy notables" is an unallocated Titan node priced at its `pathDist` (Lua
    query);
  - no other ascendancy's node appears, and the passive-point ranking holds none;
  - Crushing Impacts is in the can't-measure section.

  With `include_ascendancy` omitted, no Titan node appears.
- **AC-K44 (C-47 over-budget notables; WU-34).** In `rankerAmendments.test.ts`, after `lua_new_build
  {class_name:"Warrior", ascendancy:"Titan"}`:
  - **Setup.** A Lua query takes the `path` of Stone Skin, Mysterious Lineage and Colossal Capacity (2
    points each at the pin). `lua_set_tree` allocates the build's nodes plus those paths, so 6 points
    are used and r = 2 remain.
  - **Call.** `get_passive_upgrades {focus:"defence", include_ascendancy:true}`.
  - **Mark.** Every Titan notable in the output, in either section, ends with ` (over budget: needs
    <pathDist>, 2 left)` exactly when its `pathDist` (Lua query) exceeds 2.
  - **Not hidden.** Mountain Splitter (`pathDist` 4 at the pin; its line is unparsed, pin §D) is in the
    can't-measure section with the mark. Crushing Impacts (`pathDist` 2) is there without it.

**L1 sets (WU-35)**: `tests/integration/manageSets.test.ts`, in-process, engine-required

- **AC-K23 (C-39 basics).** On the golden build, for each of `item`, `skill` and `config`:
  - `create {title:"Act 2 (L25) {2}"}` lists id = previous count + 1 with that title, held in the export;
  - `copy {id:1, title:"Copy {3}"}` matches set 1's content: the same `<Slot>` item ids, the same socket
    groups and gems, or the same `<Input>`s;
  - `rename` changes only the title;
  - `select {id}` sets the export's `activeItemSet`, `activeSkillSet` or `activeConfigSet`.
- **AC-K24 (per-set authoring).** On a fresh golden load, which has one set of each type, `copy {id:1}`
  makes set 2 of each type, so set 2 is not empty: the golden item set 1 holds item 5 in `Charm 1`, not
  active, and skill set 1 holds the golden socket groups. After `select {id:2}` of each type:
  - `set_config` changes only config set 2's `<Input>`;
  - `toggle_flask {slot:"Charm 1", active:true}` gives `active="true"` only to item set 2's `Charm 1`.
    Item set 1's `Charm 1` still holds item 5, not active;
  - `add_gem` changes only skill set 2; set 1's socket groups and gems are unchanged.
- **AC-K25 (C-39 titles).** `create` with `"Early {1, 2}"` or `"Early {}"` → `isError` naming the
  `[A-Za-z0-9,]` rule; the export and `revision` are unchanged. `"Early {1,2}"` succeeds.
- **AC-K26 (C-39 second weapon set).** `create {set_type:"item", title:"Swap",
  use_second_weapon_set:true}` gives that `<ItemSet>` `useSecondWeaponSet="true"`, and the Lua flag is
  true. With `set_type:"skill"`, the argument → `isError`.
- **AC-K27 (C-39 loadouts).** Set up `create_spec {title:"Act 1 {1}"}` plus sets titled `Early {1}`,
  `Act 1 {1}` and `Campaign {1}`.
  - The loadout `list` includes `Act 1 {1}` and no `^7` row. `select {title:"Act 1 {1}"}` makes those
    four sets active in the export, even straight after a `rename` with no `list` in between.
  - An unknown name → `isError`, and `ping` still answers. A loadout `create`, `copy` or `rename` →
    `isError`.
  - The `action` enum is exactly list, create, copy, rename and select; `rg -n "CopyLoadout" pob-api src`
    finds nothing.
- **AC-K28 (C-39 main-skill index).** With an empty skill set 2, the skill `list` shows set 1's group at
  `mainSocketGroup` (label and active skills equal to `get_skill_setup`'s main group) and `none` for set 2.
- **AC-K29 (C-39 persistence).** Every set, title, `useSecondWeaponSet` and loadout from AC-K23…K27
  survives `lua_save_build` and `lua_load_build` (spike S-a).
- **AC-K30 (D-196 auto-level; regression).** Engine-required, through `session.run`, plus a
  `contract.test.ts` case:
  - `set_level {level:40, autoMode:true}` → `<Build level="40" characterLevelAutoMode="true">`;
  - `set_level {level:41}` → `characterLevelAutoMode="false"`;
  - `set_character_level {level:42}` writes manual mode, and its schema has no auto argument;
  - after an auto-mode `set_level` run as `mutate`, killing `session.enginePid()` and then calling
    `lua_get_build_info` restores a build whose export keeps `characterLevelAutoMode="true"` (D-198).

**L1 tree state (WU-36)**: `tests/integration/treeState.test.ts`, in-process, engine-required

- **AC-K31 (C-40 weapon sets).** On the golden build, a Lua query picks allocated leaf nodes a, b and c
  that PoB can tag (§2.8). `{weapon_set_nodes:{"1":[a,b], "2":[c]}}` gives `<WeaponSet1 nodes>` = {a,b}
  and `<WeaponSet2 nodes>` = {c}. Lua `allocMode` is 1, 1, 2, and the allocated set is unchanged. The
  output's Str/Dex/Int equal `lua_get_stats`'. A follow-up `{"1":[a]}` leaves only a tagged.
- **AC-K32 (C-40 attribute choices).** A Lua query picks an allocated `isAttribute` node n not set to
  intelligence. `{attribute_choices:{n:"intelligence"}}` puts n in `intNodes` and in neither `strNodes`
  nor `dexNodes`. It raises Int and lowers the old attribute (`lua_get_stats`), and leaves every other
  `<AttributeOverride>` entry unchanged.
- **AC-K33 (C-40 errors).** Each case → `isError` naming the node, with the export and `revision`
  unchanged:
  - an unallocated node;
  - a keystone, ascendancy node or socket in `weapon_set_nodes`;
  - one node in both lists;
  - a non-attribute node in `attribute_choices`;
  - `"wisdom"`;
  - no argument;
  - a call mixing a valid and an invalid entry.
- **AC-K34 (C-40 persistence).** After AC-K31's and AC-K32's changes, `lua_save_build` and then
  `lua_load_build` keep the `WeaponSetN` and `<AttributeOverride>` node lists equal as sets.
- **AC-K35 (C-46 enum).** Static and engine-required. `add_item`'s enum is `ITEM_SLOTS` followed by
  `Jewel <id>`, ascending, for exactly the ids a Lua query finds with `type == "Socket"` or
  `containJewelSocket` in `build.latestTree.nodes` (19 at the pin). `ITEM_SLOTS` is unchanged, and AC-E38
  passes unchanged.
- **AC-K36 (C-46 socketing).** With `tests/fixtures/items/jewel.txt`, `add_item` into `Jewel <s>`, for an
  allocated, empty socket s, adds `<Socket nodeId="s" itemId="<new id>">` to the active `<Spec>`. After
  `create_spec` and `select_spec`, the new spec's `<Sockets>` lacks it. The ruby ring into a jewel slot →
  `isError`, with nothing changed.
- **AC-K37 (C-48 auto-path; regression).** On the golden build, a Lua query picks an unallocated
  non-ascendancy notable with `pathDist` ≥ 3. `update_tree_delta {add_nodes:[id]}` allocates its whole
  pre-call `path` and reports `Auto-pathed <pathDist − 1> intermediate node(s)`. A node with `pathDist` 1
  adds exactly one node and reports no auto-path. AC-E28 passes unchanged.
- **AC-K38 (C-48 cap).** After `lua_new_build {class_name:"Warrior", ascendancy:"Titan"}`,
  `update_tree_delta` with the 8 Titan notables in name order:
  - leaves ≤ 8 allocated Titan nodes, excluding the start node (Lua query);
  - allocates the first notable, and lists every notable left out after `BLOCKED:`;
  - returns, in `contract.test.ts`, a reply carrying `autoPathedNodes`, `skippedAscendancyNodes` and
    `tree.ascendancyPointsUsed`, the last equal to the Lua count.

**T1 (WU-49)**: `tests/mcp/datedPrices.test.ts`, in-process (`startTestServer`). HTTP goes only through
`fixtureFetch`, with the `trade2/` and `poeninja/` fixtures. The clock is injected:
`now = () => T0 + elapsed`, with T0 = `2026-10-07T12:00:00Z`.

- **AC-K39 (C-49 `get_item_price`).** `{item_name:"x", league:"Runes of Aldur"}` on the ring fixtures
  outputs `League: Runes of Aldur`, then a `Checked: <t>` line matching
  `^Checked: \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$` with T0 ≤ t ≤ T0 + elapsed, both before the first listing.
  With the new `trade2/search-empty` fixture, "No price data found" carries both lines.
- **AC-K40 (C-49 `search_trade_items`).** For `{league:"Runes of Aldur", item_type:"Ruby Ring",
  item_rarity:"rare", limit:5}`, both lines are among the first five output lines.
- **AC-K41 (C-49 no cache, no batch; regression).**
  - Two identical `get_item_price` calls make 2 searches and 2 fetches in `fixtureFetch`'s log (D-46),
    and each output has its own `Checked:` line.
  - `get_item_price`'s input properties are exactly `item_name, league, item_type, rarity`.
  - `search_trade_items`' input properties are exactly `league, item_name, item_type, min_price,
    max_price, price_currency, item_rarity, min_rune_sockets, corrupted, identified, mods, limit`.
  - `itemPrice.test.ts`, `searchTradeItems.test.ts` and `tradePrices.test.ts` pass unchanged.
- **AC-K43 (D-218 error prefix; WU-49).** In `tests/mcp/tradeErrorPrefix.test.ts`, in-process
  (`startTestServer`), with `fixtureFetch`'s synthetic responses (`tests/helpers/tradeFixtures.ts`), the
  injected clock and an explicit `league`. Each case starts a fresh server, except the lockout case,
  which follows the 429 on the same server:
  - a search answered 429 with `Retry-After: 60` → `get_item_price` is `isError`, and its text starts
    `Error: [trade:rate_limited] `;
  - the next `get_item_price` on that server starts `Error: [trade:locked_out] `, and `fixtureFetch`'s
    log shows no new request;
  - after a search whose rate-limit state headers report a full 300 s window, the next call starts
    `Error: [trade:would_wait] `, again with no new request;
  - a search answered 500 gives `[trade:http]`, and `search_trade_items` with a search answered 429 gives
    `[trade:rate_limited]`;
  - calling `handleGetItemPrice`, `handleSearchTradeItems` and `handleGetLeagues` directly, with a stub
    trade client that throws `new TradeError(kind, "m")`: for every `TradeErrorKind` value, the thrown
    message starts `[trade:<kind>] Failed to `. A stub that throws a plain `Error` gives no `[trade:`
    prefix.

## 5. Test strategy (this slice)

| AC | Class | File |
|---|---|---|
| AC-K1…K6, AC-K45 | in-process, engine-required | `tests/integration/lookupGameData.test.ts`; AC-K6 in `engineKinds.test.ts` |
| AC-K7…K9 | in-process, engine-required | `tests/integration/searchTreeNodes.test.ts` |
| AC-K10…K14, AC-K46 | in-process, engine-required; AC-K46 also in `contract.test.ts` | `tests/integration/modelCoverage.test.ts` |
| AC-K15…K19 | in-process, engine-required | `tests/integration/skillBreakdown.test.ts` |
| AC-K20…K22, AC-K44 | in-process, engine-required | `tests/integration/rankerAmendments.test.ts` |
| AC-K23…K30 | in-process, engine-required; AC-K30 via `session.run` and `contract.test.ts` | `tests/integration/manageSets.test.ts` |
| AC-K31…K38 | in-process, engine-required; AC-K35 also static | `tests/integration/treeState.test.ts` |
| AC-K39…K41 | in-process, `fixtureFetch`, no engine | `tests/mcp/datedPrices.test.ts` |
| AC-K42 | stdio end-to-end (`spawnServer`), engine-required | `tests/e2e/serverTools.test.ts` |
| AC-K43 | in-process, `fixtureFetch`, no engine; direct handler calls with a stub trade client | `tests/mcp/tradeErrorPrefix.test.ts` |

**Kind checks.** `engineKinds.test.ts` runs every new `ok` sample from §3. The `read` samples (the
three lookup modes, both coverage samples, G's breakdown, the ascendancy search, `include_ascendancy`)
leave the canonical export and `revision` unchanged. The `mutate` samples change both; none declares
`stateChange:false`.

**Fixture ownership** (spine §8). Each unit adds its own `tool-calls.json` and `tool-disposition.json`
entries. WU-32 owns `items/coverage-amulet.txt` and `tests/e2e/serverTools.test.ts`, whose `tools/list`
check WU-35 and WU-36 extend; both therefore depend on WU-32. WU-36 owns `items/jewel.txt` and
`$JEWEL_TEXT`, which it adds to the `PLACEHOLDERS` maps of `engineKinds.test.ts` and
`toolHygiene.test.ts`. Both files are serialized wiring shared with WU-40 (spine §8). WU-49 owns
`trade2/search-empty.*`. WU-31, WU-32, WU-35 and WU-36 each move the count sites by +1.

**Regression guard.** Every unit gate keeps green, unchanged except for count literals: the stabilization
ACs AC-E16, AC-E28, AC-E29, AC-E32, AC-E35, AC-E38, AC-E39 and AC-E41; AC-T19 (`get_item_price`'s
primary-currency normalization); the golden tests (AC-B5); and the hygiene and static scans (AC-B2).

## 6. Compatibility, slice choices and open items

**Compatibility.** Every amended tool keeps its default output. Callers now get correct
`search_tree_nodes` results where they got none (`'any'`) or an arbitrary subset, connected trees from
`update_tree_delta`, PoB2's stat set from `skill_part`, and two new lines from the price tools. A trade
error's text gains the `[trade:<kind>] ` prefix after `Error: ` (D-218); its message is otherwise
unchanged. Rollback is a revert of the unit's merge.

**Choices made here** (the [slice] marks; fold into the spine at ratification):
- **Accepted by the coordinator (2026-10-07), now spine decisions:**
  - lookup results default to 20, capped at 30 (D-225);
  - the possibly-unread method is S-b's by-name scan, run by the server (§2.4, D-226);
  - jewel slots join `add_item`'s enum only, so AC-E38 is unchanged (D-223);
  - C-49 has no batch mode: each call prices one item, and the limiter does the pacing (D-224);
  - the bridge param `skillPart` is renamed `statSet`, the one non-additive bridge change (§2.1, D-222).
- **Still for ratification:**
  - argument names and defaults (D-190 leaves names to the formalizer): gem level `naturalMaxLevel`,
    quality 0;
  - sorting before the cap, id as the last tiebreak;
  - C-37's requirement lines: one list per line, for gem levels 1 to `naturalMaxLevel`;
  - coverage: build mode lists only lines that aren't fully parsed and stands alone; the name scan
    travels with each `check_coverage` request as `sourceNames`;
  - C-45's bound: one group per call, non-zero fields only;
  - tree state: `weapon_set_nodes` replaces, `attribute_choices` merges, both all-or-nothing;
  - `use_second_weapon_set` applies to the set the action targets;
  - an out-of-range `skill_part` is an error;
  - with `include_ascendancy`, all the build's ascendancy notables are measured and ranked in their own
    section;
  - the over-budget mark's wording, ` (over budget: needs <pathDist>, <r> left)`.

**Former spine nits, settled 2026-10-07.** The spine's C-2/C-5 row is a modified contract listing §2.1's
changes (D-222). WU-36 edits `add_item`'s enum, never the shared `ITEM_SLOTS` (D-223).

**Open.** None. The two former open items are settled:
- `include_ascendancy` marks notables beyond the build's remaining ascendancy points and never hides them
  (§2.6, AC-K44; D-227);
- C-37 gives each gem's level requirement per level and its attribute requirements (§2.2, AC-K45; D-228),
  which D2 and V1 need.
