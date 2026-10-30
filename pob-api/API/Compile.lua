-- API/Compile.lua
-- The plan compiler's engine side (C-41, WU-41): one PoB2 build with one loadout per guide stage.
--
--   compile_check  {className, ascendancy, stages[]}
--     The read-only preflight (A-P12). It checks every stage of the plan against the game data and
--     reports every defect, as "stage <id>: <defect>" lines; it changes nothing in the loaded build (no
--     set is created, no item added, nothing recalculated). Defects: an unknown class or ascendancy; an
--     unknown gem (with resolve_gem's suggestions), or a gem PoB marks legacy (D-384); item or jewel text PoB
--     can't parse into a base type, a unique PoB marks no longer obtainable (D-384),
--     or an item that doesn't fit its slot (the off-hand slots, which depend on the stage's main hand,
--     are checked when the stage is built); a node id that isn't a passive tree node, an ascendancy node
--     listed as a regular one or the reverse; a node whose unlock constraint the stage doesn't meet (D-383:
--     the Oracle's The Unseen Path unlocks 197 nodes); a node that doesn't connect to its start through the
--     stage's listed nodes under PoB's weapon-set rule (an untagged node paths only through untagged
--     nodes, a node tagged weapon set n also through nodes tagged n: PassiveSpec:CanPathThroughAllocMode,
--     D-213), unless a radius jewel of the stage frees it (B3, amendment 12 §15: From Nothing's or Controlled
--     Metamorphosis' "can be Allocated without being connected to your tree", on a socket the stage connects,
--     radius_nodes) or a jewel on a socket the stage connects grants it (Voices' Sinister Jewel sockets,
--     granted_sockets), and a socket such a jewel grants that the stage doesn't list; a weapon-set tag on a node PoB never tags (an ascendancy node, a keystone, a jewel
--     socket); an attribute choice on a node that isn't an attribute node, and an allocated attribute
--     node without one (PoB gives such a node no stat); a tree jewel on a node that isn't a jewel socket;
--     an unknown config option or a bad value (BuildOps' own config check); a main group or main active
--     skill outside the stage's groups or their active skills; a custom modifier line (`customMods[]`,
--     D-293) PoB can't parse whole, which PoB's customMods option would skip without a word
--     (Modules/ConfigOptions.lua:2279-2297).
--     It also reports (WU-42), for V2: `producers`, whether each `{kind, name}` producer the plan's earned
--     config names exists in the game data (by kind: an item base or unique; a gem, as C-37's lookup finds
--     it; a passive or ascendancy node; an active skill; a flask or charm base or unique), names compared
--     ignoring case (an unknown producer is no defect: V2 reports it, D-221); and `configBaseline`, per
--     config option its type, whether it has an `apply`, its default (`defaultState`, or the
--     `defaultIndex` entry of its list), its `defaultPlaceholderState` and its first list value, read from
--     PoB's option list as ConfigTab:CreateConfigSet fills a new set (Classes/ConfigTab.lua:979-987),
--     without creating a set, and whether PoB shows it only for some builds (`conditional`: it has a
--     show gate such as ifSkill or ifCond, ConfigTab.lua:244-541).
--     The anoint (WU-65, D-358): a stage's `anoint` names the notable its amulet is anointed with. It is a
--     defect when the stage equips no amulet, when the name is no notable of the tree (matched as PoB's
--     `Allocates <name>` matches it, PassiveSpec:ResolveGrantedPassiveNodes), when the notable has no recipe
--     of three Distilled Emotions (the tree's `recipe`), or when the stage's tree allocates it. Each valid one
--     is reported in `anoints`: the notable's PoB name and node, its recipe as the tree names the emotions,
--     and PoB's item names for them (Data/LiquidEmotions.lua). `describeGems` (WU-65, D-353) names gems whose
--     description the reply gives in `gemTexts` (the clear-speed measure reads it).
--     The tree's shape (WU-66, D-360): `trees` holds each stage's trees, for V1's `tree-shape`; a shape is
--     no defect. `starts` are the starts a tree may leave: the class start, by its main-tree links (its
--     exits), and each alternate start of the ascendancy, a node of it with main-tree links (Path of the
--     Sorceress, 12795, links the Sorceress start's exits 4739 and 44871), with whether the stage
--     allocates that node (`granted`). `main` are the components of the stage's listed main-tree nodes,
--     class starts not joining their exits, each with the start exits it holds; `ascendancy` the
--     components of the ascendancy start and the listed ascendancy nodes over ascendancy links, the
--     start's first. PoB2 v0.23.1 enforces none of the rule (I-3), so it is checked here. D-463 (amendment 13 §4): a
--     socketed Split Personality (`AlternateClassStart`) whose socket the stage reaches from the class and ascendancy
--     starts opens the start its variant names: that start joins the connectivity check's seeds and the stage's
--     `starts`, with `jewel`, `grantedBy` the socket, `grantedByName` the jewel's name and `granted` (whether it opens); a
--     socket reached only through the start the jewel names opens nothing (R-63: PoB accepts any allocated socket).
--     A custom modifier's comment (D-469, schema 9): with `customModReasons`, each reason's comment line `# <reason>`
--     that PoB would parse whole as a modifier is a defect naming the entry (R-68).
--     A minion's skill (WU-78, D-377): a group's `minionSkill` (with `minionStatSet`) is a defect when the
--     group's enabled gems' active skills hold no summon (a summon's "Command" skill has no minion; a disabled
--     summon gem is named) or two; when the name is neither in the summon's minion's skill list (game data: the
--     first type of its minionList, which PoB picks for a new gem, and its skillList in data order) nor added by
--     one of the group's enabled supports (ExtraMinionSkill), the defect listing the minion's skills; when the
--     minion's list holds it twice; when `minionStatSet` is beyond the skill's stat sets; and, on the main group,
--     when the main active skill isn't the summon. The group's active skills are PoB's own for the compile's
--     gems (group_actives; each gem's `enabled` is read, default true). compile_stage resolves the name live.
--     A tamed beast (WU-87, D-402): a stage's `companion {species, lines[], groupsEnabled[]}` is a defect when the
--     species names no beast of PoB's beast library (the spectres whose monsterCategory is "Beast", as "Manage
--     Beasts..." lists them; a monster id, or a name ignoring case, with suggestions) or a name several beasts share
--     (listing their ids), and when the stage's groups hold no Tame Beast gem (PoB's companion gem counts too), two, or
--     one that is disabled or in a disabled group (`groupsEnabled`, per group). A valid one is reported in
--     `companions`: the beast's id, name and Spirit percentage (companionReservation), and whether PoB parses each of
--     `lines` whole (`parsed`), the custom modifier lines its kept modifiers write.
--     `weaponGrants` (WU-102, PG-74): each stage's weapon slots whose item grants a skill, with the skills' names, as
--     PoB parses the item (a base's `Grants Skill:` implicit included), for the compiler's pick of a group's slot.
--     WU-111 (amendment 11): a stage's `bossEntries[{at, group, activeSkill, statSet}]` (its boss rotation, D-447) are
--     checked as the main selection is: an active skill beyond the group's upper bound, or a stat set beyond the most
--     any of its active skills has, is a defect naming the entry's path `at`. `movementTiers` (D-440) are the boots'
--     movement-speed tiers in the game data (the item mods of group MovementVelocity boots roll, Data/ModItem.lua:450-455),
--     {value, itemLevel}, for V1's `movement-tier`.
--     -> {defects[], treeVersion, stageCount, producers[{kind, name, exists}], configBaseline{var: {...}},
--         anoints[{stage, notable, node, recipe[], emotions[]}], gemTexts{name: text}, weaponGrants[{stage, slot, skills[]}],
--         movementTiers[{value, itemLevel}],
--         trees[{stage, starts[{node?, name, exits[], grantedBy?, grantedByName?, granted?}],
--                main[{nodes[], exits[]}], ascendancy?{start, name, trees[{nodes[]}]}}],
--         companions[{stage, species, id, name, companionReservation, parsed[]}]}
--
--   compile_stage  {id, first, title, level, tree, jewels[], itemSet, items[{slot, text, sameAs?}], toggles[],
--                   useSecondWeaponSet, skillSet, groups[{label, enabled, includeInFullDPS, groupCount, gems[{..., corrupt?}],
--                   minionSkill?, minionStatSet?, weaponSet?, slot?}], main, configSet, config, customMods[],
--                   customModReasons[]?, offenseFields[], itemSlots[], anoint?, companion?{id}, boss?{groups[], fields[]}}
--     Builds one stage into the engine's build and measures it (C-41 step 7). The tree: stage 1 retitles
--     spec 1, every other stage gets a new spec; the tree jewels go in, then the nodes through set_tree with
--     their weapon-set tags and attribute choices (C-40): a radius jewel already socketed keeps the nodes it frees
--     (B3, amendment 12 §15), and a socket a jewel grants (Voices') is left to PoB, which allocates it at the next
--     calculation. Item, skill and config sets: `reuse` names
--     a set an earlier stage created, which is only selected (its content is the same); otherwise stage 1
--     retitles set 1 of that type and every other stage creates a set (Sets.lua, C-39), and the content
--     goes in: the items, the toggles (a toggle on an empty slot is skipped, for the checks to report)
--     and the second weapon set (an `anoint` notable goes on the amulet as the enchant line
--     `Allocates <notable>`, as PoB's anoint dialog writes it, ItemsTab:anointItem; WU-65, D-358); every
--     socket group and its gems (D-471, schema 9: a skill gem with `corrupt` gets PoB's corruption state, set_gem_corruption,
--     so PoB calculates it one level higher), each group with the includeInFullDPS and groupCount it is given
--     (the compiler puts only the named source's group in Full DPS, with its Count:
--     D-293, D-337); every listed config option, then the custom modifier lines, joined by newlines into
--     PoB's customMods text option (D-293; D-469, schema 9: each after its `customModReasons` entry's comment line
--     `# <reason>`, which PoB skips). A pinned weapon (D-464, schema 9): an item with `sameAs` puts the item its
--     set-1 slot got in the Swap slot too (pin), so the item set holds one item in both weapon sets. Then each group's minion skill (WU-78, D-377: select_minion_skills,
--     by name against the minion's live list, each group the main group for its call, so a disabled one is built
--     too; PoB's own fields are written, so the saved file keeps them), the main selection (after the
--     second-weapon-set flag, which doesn't move it), the level in manual mode, and the measurement: every finite
--     number of the main output, with the minion's own numbers flattened as `Minion<Field>` (D-376), the C-45
--     breakdown of every socket group (stats_breakdown, keyed g<group>s<skill>p<statSet>) and PoB's allocation
--     after the import, with each node's weapon-set tag.
--     D-382: the stage's skill set is selected before its first calculation, so the groups PoB adds for what the
--     stage's tree and items grant go into it. PoB's own groups have a `source` and land anywhere in the list
--     (before the plan's when a calculation runs before the groups are built: the off-hand check), so the plan's
--     groups are found as the groups without one, in order (group_indices). Every group number in the reply is
--     the plan's: the plan's groups first, in plan order, then PoB's own, in PoB's order. D-435: once the stage's
--     groups are built and calculated, the list is put in that order (plan_groups_first), so a plan group's PoB index
--     is its number, the same in every stage, and the build's one main group fits each stage's loadout.
--     Weapon set 2 (D-426): on a stage that uses it (passives tagged to set 2, an item in a Swap slot, or a skill
--     group socketed in one), the stage is also measured with set 2 active, just before its own measurement, and
--     `outputsSet2` is that measure in `outputs`' form; on a stage whose own measure is set 2's
--     (useSecondWeaponSet), it is `outputs` itself, and a stage that doesn't use set 2 has none.
--     A skill on a weapon set (WU-102, §24.2): a group's `weaponSet` (1 or 2) sockets it in one of that set's weapon
--     slots, `slot`, the compiler's pick (the set's slot whose item grants no skill, compile_check's `weaponGrants`;
--     PG-74), else the set's main hand (WEAPON_SET_SLOT: `Weapon 1`, `Weapon 1 Swap`); PoB enables it only while that
--     set is active (Modules/CalcSetup.lua:1728-1729). A group on set 2 makes the stage one that uses set 2. Such a stage's
--     `skillOutputsSet2` is every group's breakdown with set 2 active, keyed as `skillOutputs` (it is `skillOutputs`
--     itself on a stage measured on set 2). `travelSkills` (D-427) lists each enabled group's active skill whose
--     granted effect has PoB's Travel skill type, {group, activeSkill, skill}, in the reply's group numbers.
--     WU-111 (amendment 11 §5, §9b; D-437, D-447): `skillMeta` (and `skillMetaSet2` with `skillOutputsSet2`) gives each
--     breakdown key's live skill types by name, PoB's own trigger test (`isTriggered`) with the meta gem that triggers it,
--     and whether its damage over time and each damaging ailment stack (skill_meta). With `boss {groups, fields}` (an
--     endgame variant stage), the stage is measured once more, last, under its config with only `enemyIsBoss` set to
--     "Pinnacle": the named groups' breakdown, each on its own weapon set, keyed and read as `skillOutputs`, with each
--     key's meta, in `boss {skillOutputs, skillMeta}`; the config, the weapon-set flag and the weapon-fit flags are put
--     back and the build recalculated (measure_boss). Each item in `checks.items` gains `rarity` and `movementSpeed`
--     (its unconditional increased movement speed, as PoB parses it), for V1's `movement-tier` (D-440).
--     -> {id, ids{spec, itemSet, skillSet, configSet}, allocation{nodes[{id, mode}], startNodes[]},
--         outputs{}, outputsSet2?{}, skillOutputs{}, skillOutputsSet2?{}, travelSkills[{group, activeSkill, skill}],
--         skillMeta{key: {types[], triggered, triggeredBy?, stacks{dot, ignite, bleed, poison}}}, skillMetaSet2?{},
--         boss?{skillOutputs{}, skillMeta{}},
--         skippedToggles[], items{slot: {id, name}}, addedItems{slot: {id, name}},
--         weaponFlags{giantsBlood, instrumentsOfPower, lordOfTheWilds}, configInputs{option: value},
--         configSurvivesDrop{option: boolean}, dotCanStack{main, skills{key: boolean}},
--         checks{...}, minionSkills[{group, activeSkill, summon, minion, minionId, name, index, statSet,
--         statSets[], skills[]}], companion?{group, activeSkill, minion, minionId, companionReservation,
--         reservedSpirit, reservedSpiritPercent}}
--     A tamed beast (WU-87, D-402): with `companion {id}` (the monster compile_check resolved), the monster joins the
--     build's beast library (build.beastList, saved as <BeastCompanion id>), and a new skill set gets the stage's Tame
--     Beast gem as PoB's companion gem with that monster as its minion (skillMinion), as the game turns the gem when
--     it captures the beast. The reply's `companion` is that companion as the stage's measurement left it: its
--     group (the plan's number) and active skill, the beast, the species' Spirit percentage, and PoB's reservation
--     for it, its percentage after the build's reservation modifiers and the Spirit that takes (skillData's
--     SpiritReservedPercent and SpiritReservedBase, Modules/CalcDefence.lua:203-325). Absent without a companion.
--     `minionSkills` (D-377) is each group's resolved minion selection, in group order, as select_minion_skill
--     returns it, with its group.
--     `dotCanStack` (D-293) says whether each measured skill's damage over time stacks: PoB's DotCanStack,
--     which CalcOffence sets on the measured main skill's stat-set flags (Modules/CalcOffence.lua:5964-5965,
--     6011-6012) and calcFullDPS reads to decide whether Count multiplies the DoT (Modules/Calcs.lua:367, 411).
--     `main` is the stage's main skill; `skills` is keyed as `skillOutputs`, read after each breakdown rebuild.
--     `checks` (WU-42) are the V1 and V2 inputs, read right after the measurement: PassiveSpec:CountAllocNodes'
--     counts, `ExtraPoints` and `PassivePointsToWeaponSetPoints`, Str/Dex/Int and ReqStr/ReqDex/ReqInt with
--     the item or gem each requirement comes from, every gem's tier, kind (skill, support, or spirit: it
--     reserves Spirit) and level requirement at its level, every equipped item's level requirement and
--     names (flasks and charms with their toggle), PoB's warning lines (get_warnings, without another
--     rebuild), the allocated nodes' names (a notable an item grants, such as the anoint, included: it is
--     allocated in the calculation, not on the tree), the active skills' names, the stage's config set's
--     `input` and `placeholder` tables after the writes and the recalculation (enemyIsBoss's placeholders included),
--     and `shownOptions`, the conditional config options PoB shows for the stage (D-250); and `grantedSkills`
--     (D-380), each group whose skill gem, or whose minionSkill, a passive's "Grants Skill: <name>" line grants,
--     with those passives and whether the stage allocates any of them; and `implicitVariants` (D-435), each of the
--     stage's items left without its base's implicits because the base's implicit has variants, {slot, base,
--     variants[]}, for V1's `implicit-variant`. Amendment 12: each gem's `curseCap {cap, of, level}` (D-455), the
--     level above which its curse, Frost Bomb's exposure or Thunderstorm's Wet doesn't apply, read at the level PoB
--     calculates the gem at (gear's +levels included), absent for a gem without such a stat; and `customMods` (D-451),
--     each custom modifier line the stage writes with the names of the modifiers PoB's parser makes of it,
--     {text, modNames[]}, for V1's `custom-defence`.
--     A base's implicits (D-435): every item text the stage equips, and compile_check's `weaponGrants` reads, that has
--     no `Implicits:` line and isn't a unique gets its base's implicit lines first, as PoB's rare list and its
--     crafting window fill a base's (base_implicits, below).
--     `items` is what the stage's item set holds in each of `itemSlots` after the measurement, and
--     `addedItems` what this stage equipped when it created the set, so the compiler can tell an item PoB
--     unequipped from the plan's. `configInputs` are the stored values of the stage's listed options (and
--     of customMods when the stage writes custom modifiers, so the saved file is checked for them too), and
--     `configSurvivesDrop` says, per option, whether a reload gives it the same value when PoB's save
--     leaves it out (D-248: the new set's default is that value, or no default or placeholder replaces it).
--     Weapon-fit flags (WU-41 review): whether an off-hand fits (a Focus with a Staff, a second weapon with
--     a two-handed one) depends on Giant's Blood, Instruments of Power and Lord of the Wilds, from the tree
--     or from an item (Treefingers), which PoB reads from its last calculation (ItemsTab:IsItemValidForSlot
--     reads mainEnv.modDB) and checks on every slot refresh (ItemSlotControl:Populate) and, when a
--     calculation loses one, on the active item set (CalcSetup's ValidateWeaponSlots), unequipping what no
--     longer fits. So the stage's tree goes in first, with the remembered flags cleared (no other stage's
--     item set is checked against this tree); then a new item set gets every item but the off-hands
--     (Weapon 2, Weapon 2 Swap), the stage is calculated, and the off-hands go in, checked against this
--     stage's own tree and items. A reused set gets back the off-hands its selection may have lost, is
--     calculated, and PoB's own slot check then runs against this stage's tree and items. Any other item
--     set PoB changed meanwhile is put back as it was. `weaponFlags` are the measured stage's flags, from
--     its tree and items.
--     Every BuildOps mutation ends in a full output rebuild, about 85% of a stage's time (WU-30). They are
--     deferred while the tree, jewels, items, toggles and gems go in, and again while the config and
--     level are written: the stage rebuilds once before its main selection (which needs PoB's skill
--     list) and once before it is measured, each after wiping PoB's global skill cache, as PoB's own
--     frame loop does (Build.lua OnFrame), so no stage is measured from another's cache entries.
--     A failure names the stage; the build holds what was built until then.
--     Under POB_API_TEST_ACTIONS=1 only, `__crashForTest` exits the engine (AC-P35), and `__noDeferForTest`
--     rebuilds after every mutation, as BuildOps does on its own (the deferral's equivalence test).
--
--   compile_finish  {stages[{id, title, ids}], active, level, itemSlots[]}
--     SyncLoadouts; checks that the loadouts are exactly the stages' loadouts, each resolving to its
--     stage's four sets, and that no tree spec or set is untitled (PoB shows "Default"); selects the
--     `active` loadout (its tree first and calculated, so its item set is checked against its own
--     passives; any other item set PoB changed meanwhile is put back), then sets `level` in auto-level
--     mode (D-196). It reports what every item set holds in `itemSlots`, for the compiler's comparison.
--     -> {loadouts[], active, level, autoMode, itemSets[{id, title, slots{slot: {id, name}}}]}
--
-- PoB's copy-loadout call is never used: it raises on {id} names (D-103). Registered by one line in
-- Handlers.lua.

local BuildOps = require('API.BuildOps')
local Lookup = require('API.Lookup')
local Sets = require('API.Sets')
local construct = require('API.Util').construct

local M = {}

local TEST_ACTIONS = os.getenv('POB_API_TEST_ACTIONS') == '1'

local Failure = {}
local function fail(msg)
  error(setmetatable({ msg = msg }, Failure), 0)
end

-- The message of an error raised by a BuildOps (nil, msg) return, a Sets.lua failure or PoB itself.
local function message_of(err)
  if type(err) == 'table' and err.msg ~= nil then return tostring(err.msg) end
  return tostring(err)
end

-- A BuildOps call's value, or a failure naming what was being done.
local function must(what, value, err)
  if value == nil or value == false then fail(what .. ': ' .. tostring(err or 'failed')) end
  return value
end

-- A Sets.lua call (it raises its failures).
local function sets(params, what)
  local ok, res = pcall(Sets.manage_sets, params)
  if not ok then fail(what .. ': ' .. message_of(res)) end
  return res
end

local function finite(v)
  return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge
end

local function list(v)
  return type(v) == 'table' and v or {}
end

-- ---------------------------------------------------------------------------------------------------
-- The tree: class and ascendancy start nodes, and PoB's weapon-set connectivity rule

-- The class and ascendancy named, matched as PoB's own names ignoring case, in `tree`:
-- classId, ascendClassId, classStartId, ascendStartId; or nil and the reason.
local function resolve_roll(tree, className, ascendancy)
  local wanted = tostring(className or ''):lower()
  local classId, class
  for id, c in pairs(tree.classes or {}) do
    if type(c) == 'table' and type(c.name) == 'string' and c.name:lower() == wanted then classId, class = id, c end
  end
  if not class then return nil, ('unknown class "%s"'):format(tostring(className)) end
  local wantedAsc = tostring(ascendancy or ''):lower()
  for ascId, asc in pairs(class.classes or {}) do
    if ascId ~= 0 and type(asc) == 'table' and type(asc.name) == 'string' and asc.name:lower() == wantedAsc then
      local entry = tree.ascendNameMap and tree.ascendNameMap[asc.name]
      local ascStart = entry and entry.ascendClass and entry.ascendClass.startNodeId
      return { classId = classId, ascendClassId = ascId, classStart = class.startNodeId, ascendStart = ascStart,
        className = class.name, ascendancyName = asc.name }
    end
  end
  return nil, ('unknown ascendancy "%s" for %s'):format(tostring(ascendancy), class.name)
end

-- Why PoB never gives a node a weapon-set tag, or nil when it can (as BuildOps' set_tree decides it).
local function untaggable(node)
  if node.type == 'ClassStart' or node.type == 'AscendClassStart' then return 'a class start node' end
  if node.ascendancyName then return 'an ascendancy node' end
  if node.type == 'Keystone' then return 'a keystone' end
  if node.type == 'Socket' or node.containJewelSocket then return 'a jewel socket' end
  return nil
end

local function is_jewel_socket(node)
  return node ~= nil and (node.type == 'Socket' or node.containJewelSocket == true)
end

-- The node ids reachable from `seeds` through listed nodes whose mode `allow` accepts.
local function reach(nodes, mode, seeds, allow)
  local seen, queue, qi = {}, {}, 1
  for _, s in ipairs(seeds) do
    if s then seen[s] = true; queue[#queue + 1] = s end
  end
  while qi <= #queue do
    local id = queue[qi]; qi = qi + 1
    local node = nodes[id]
    for _, other in ipairs(node and node.linkedId or {}) do
      if not seen[other] and mode[other] ~= nil and allow(mode[other]) then
        seen[other] = true
        queue[#queue + 1] = other
      end
    end
  end
  return seen
end

-- ---------------------------------------------------------------------------------------------------
-- The tree's shape (WU-66, D-360, I-3): each start holds at most one tree (a loop through two of its exits is
-- one tree, D-364), an alternate start holds one only while its node is allocated, and the ascendancy is one tree.

local function is_start(node)
  return node ~= nil and (node.type == 'ClassStart' or node.type == 'AscendClassStart')
end

local function is_main(node)
  return node ~= nil and not node.ascendancyName and not is_start(node)
end

-- A node's links into the main tree, sorted: a start's exits.
local function main_links(nodes, node)
  local out = {}
  for _, other in ipairs(node and node.linkedId or {}) do
    if is_main(nodes[other]) then out[#out + 1] = other end
  end
  table.sort(out)
  return out
end

-- The name of class start `startId` for an alternate start granted by a node named `dn`: the class sharing
-- that start whose name the node's names ("Path of the Sorceress"), else the first such class.
local function start_name(tree, startId, dn)
  local first
  for _, class in pairs(tree.classes or {}) do
    if type(class) == 'table' and class.startNodeId == startId and type(class.name) == 'string' then
      if tostring(dn):find(class.name, 1, true) then return class.name end
      if not first or class.name < first then first = class.name end
    end
  end
  return first or tostring(dn)
end

-- The starts a stage's trees may leave (the reply's `starts`, without `granted`): the class start, and each
-- alternate start of the roll's ascendancy, by node id.
local function tree_starts(tree, roll)
  local nodes = tree.nodes
  local starts = { { node = roll.classStart, name = roll.className, exits = main_links(nodes, nodes[roll.classStart]) } }
  local alternates = {}
  for id, node in pairs(nodes) do
    if node.ascendancyName == roll.ascendancyName and not is_start(node) then
      local exits = main_links(nodes, node)
      if #exits > 0 then alternates[#alternates + 1] = { id = id, node = node, exits = exits } end
    end
  end
  table.sort(alternates, function(a, b) return a.id < b.id end)
  for _, alt in ipairs(alternates) do
    local startId
    for _, e in ipairs(alt.exits) do
      for _, other in ipairs(nodes[e].linkedId or {}) do
        if nodes[other] and nodes[other].type == 'ClassStart' then startId = startId or other end
      end
    end
    starts[#starts + 1] = { node = startId, name = start_name(tree, startId, alt.node.dn), exits = alt.exits,
      grantedBy = alt.id, grantedByName = alt.node.dn }
  end
  return starts
end

-- The components of `ids` (a sorted list) over `nodes`' links between members, each sorted, in order of
-- their smallest node.
local function components(nodes, ids)
  local member, seen, out = {}, {}, {}
  for _, id in ipairs(ids) do member[id] = true end
  for _, id in ipairs(ids) do
    if not seen[id] then
      seen[id] = true
      local comp, queue, qi = {}, { id }, 1
      while qi <= #queue do
        local cur = queue[qi]; qi = qi + 1
        comp[#comp + 1] = cur
        for _, other in ipairs(nodes[cur].linkedId or {}) do
          if member[other] and not seen[other] then
            seen[other] = true
            queue[#queue + 1] = other
          end
        end
      end
      table.sort(comp)
      out[#out + 1] = comp
    end
  end
  return out
end

-- One stage's trees (the reply's `trees` entry): `mainIds` and `ascIds` are its valid listed main-tree and
-- ascendancy nodes. A listed start node never joins its exits. D-463: `jewelStarts` (jewel_starts) follow the roll's
-- starts, each with `jewel` and whether it opens (`granted`).
local function tree_shape(tree, roll, id, mainIds, ascIds, jewelStarts)
  local nodes = tree.nodes
  local listedAsc = {}
  for _, a in ipairs(ascIds) do listedAsc[a] = true end
  local exitOf, starts = {}, {}
  for _, s in ipairs(roll.starts) do
    local entry = { node = s.node, name = s.name, exits = s.exits, grantedBy = s.grantedBy, grantedByName = s.grantedByName }
    if s.grantedBy then entry.granted = listedAsc[s.grantedBy] == true end
    starts[#starts + 1] = entry
    for _, e in ipairs(s.exits) do exitOf[e] = true end
  end
  for _, s in ipairs(jewelStarts or {}) do
    starts[#starts + 1] = s
    for _, e in ipairs(s.exits) do exitOf[e] = true end
  end
  local mainList = {}
  for _, m in ipairs(mainIds) do
    if not is_start(nodes[m]) then mainList[#mainList + 1] = m end
  end
  table.sort(mainList)
  local main = {}
  for _, comp in ipairs(components(nodes, mainList)) do
    local exits = {}
    for _, n in ipairs(comp) do
      if exitOf[n] then exits[#exits + 1] = n end
    end
    main[#main + 1] = { nodes = comp, exits = exits }
  end
  local ascendancy
  if roll.ascendStart and nodes[roll.ascendStart] then
    local ascList, seen = { roll.ascendStart }, { [roll.ascendStart] = true }
    for _, a in ipairs(ascIds) do
      if not seen[a] then seen[a] = true; ascList[#ascList + 1] = a end
    end
    table.sort(ascList)
    local trees, rest = {}, {}
    for _, comp in ipairs(components(nodes, ascList)) do
      local holdsStart = false
      for _, n in ipairs(comp) do
        if n == roll.ascendStart then holdsStart = true end
      end
      if holdsStart then trees[1] = { nodes = comp } else rest[#rest + 1] = { nodes = comp } end
    end
    for _, t in ipairs(rest) do trees[#trees + 1] = t end
    ascendancy = { start = roll.ascendStart, name = roll.ascendancyName, trees = trees }
  end
  return { stage = tostring(id), starts = starts, main = main, ascendancy = ascendancy }
end

local SET_NAMES = { 'set1', 'set2' }

-- The stage's tree jewels as PoB parses them: {node, text, item} per `st.jewels` entry, `item` nil when the text
-- doesn't parse. check_stage reports a jewel's defects from these; check_tree reads their radius nodes.
local function parse_jewels(st)
  local out = {}
  for _, j in ipairs(list(st.jewels)) do
    local ok, item = pcall(construct, 'Item', tostring(j.text))
    out[#out + 1] = { node = j.node, text = j.text, item = ok and item or nil }
  end
  return out
end

-- B3 (amendment 12 §15, D-460): the nodes the stage's radius jewels let PoB allocate without a path, node id -> true.
-- A jewel whose text PoB parses as "Passives in Radius can be Allocated without being connected to your tree"
-- (Controlled Metamorphosis: `jewelData.intuitiveLeapLike`) frees the nodes in its radius around its socket; one with
-- "Passives in radius of <keystone> can be Allocated without being connected to your tree" (From Nothing:
-- `jewelData.fromNothingKeystones`) frees the nodes in its radius around each keystone it names. PoB keeps such a node
-- unconnected while the jewel sits in an allocated socket, and prunes any node that hangs on it outside the radius
-- (Classes/PassiveSpec.lua:1360-1390, :1455-1471, :1870-1910), so only the radius nodes themselves go free, and only
-- for a jewel on a socket the stage lists and connects (`connected`). A radius is the jewel's (`jewelRadiusIndex`).
local function radius_nodes(tree, jewels, connected)
  local out = {}
  for _, j in ipairs(jewels) do
    local item, socket = j.item, tree.nodes[j.node]
    local index = item and item.jewelRadiusIndex
    local jd = item and item.jewelData
    if index and jd and item.type == 'Jewel' and is_jewel_socket(socket) and connected(j.node) then
      if jd.intuitiveLeapLike and socket.nodesInRadius then
        for id in pairs(socket.nodesInRadius[index] or {}) do out[id] = true end
      end
      for name in pairs(jd.fromNothingKeystones or {}) do
        local key = tree.keystoneMap and tree.keystoneMap[name]
        for id in pairs(key and key.nodesInRadius and key.nodesInRadius[index] or {}) do out[id] = true end
      end
    end
  end
  return out
end

-- B3 (amendment 12 §15): a granted passive (a `GrantedPassive` modifier's value) resolved against `tree` by PoB's own
-- PassiveSpec:ResolveGrantedPassiveNodes (Classes/PassiveSpec.lua:1075-1117): for Voices' {type = "SinisterJewelSockets",
-- count}, the Sinister Jewel sockets aliased voices_jewel_slot1 to voices_jewel_slot5, the first `count` (at the pin 62152,
-- 26178, 23960, 39087, 3367).
local function resolve_granted(tree, passive)
  local class = type(common) == 'table' and common.classes and common.classes.PassiveSpec
  if not class or type(class.ResolveGrantedPassiveNodes) ~= 'function' then fail("PoB's granted-passive resolver is not available") end
  return class.ResolveGrantedPassiveNodes({ tree = tree, nodes = tree.nodes }, passive)
end

-- B3 (amendment 12 §15): the jewel sockets the stage's jewels grant, socket node id -> the granting jewel's node. A jewel
-- whose text PoB parses as "Allocates <n> Sinister Jewel sockets" (Voices: `GrantedPassive` {type = "SinisterJewelSockets",
-- count}, Modules/ModParser.lua:5870), socketed on a node `holds` accepts, grants the sockets resolve_granted names: PoB
-- allocates each as a free node, with no path and no point, while the jewel sits in an allocated socket
-- (PassiveSpec:CollectGrantedPassiveNodesFromItems and SetGrantedPassiveNodes, Classes/PassiveSpec.lua:1149-1225;
-- Modules/CalcSetup.lua:875-883), and only a socket (a node of type "Socket").
local function granted_sockets(tree, jewels, holds)
  local out = {}
  for _, j in ipairs(jewels) do
    local item = j.item
    if item and item.type == 'Jewel' and is_jewel_socket(tree.nodes[j.node]) and holds(j.node) then
      for _, mod in ipairs(item.modList or {}) do
        if mod.name == 'GrantedPassive' and type(mod.value) == 'table' then
          for _, node in ipairs(resolve_granted(tree, mod.value)) do
            if node.type == 'Socket' and out[node.id] == nil then out[node.id] = j.node end
          end
        end
      end
    end
  end
  return out
end

-- D-463 (amendment 13 §4): the starts the stage's Split Personality jewels name, one tree start entry each (tree_shape's
-- `starts`): a jewel PoB parses as "Can Allocate Passive Skills from the <class>'s starting point" (`AlternateClassStart`,
-- Modules/ModParser.lua:2755-2756; its `jewelData.alternateClassStart`, Classes/Item.lua:2075-2077, the selected variant's
-- line only), on a jewel socket, names the class start PoB maps that class to (`tree.classStartNodeNameMap`, the six
-- start nodes' class names, Classes/PassiveTree.lua:204-212). PoB paths through that start while the jewel sits in any
-- allocated socket (Classes/PassiveSpec.lua:1403-1412, :1770-1777); our rule is stricter: the start opens (`granted`)
-- only when `connected` reaches the socket without it (R-63). Sorted by socket.
local function jewel_starts(tree, jewels, connected)
  local out = {}
  for _, j in ipairs(jewels) do
    local item = j.item
    local className = item and item.type == 'Jewel' and item.jewelData and item.jewelData.alternateClassStart
    local startId = className and tree.classStartNodeNameMap and tree.classStartNodeNameMap[className]
    local start = startId and tree.nodes[startId]
    if start and is_jewel_socket(tree.nodes[j.node]) then
      out[#out + 1] = { node = startId, name = tostring(className), exits = main_links(tree.nodes, start), grantedBy = j.node,
        grantedByName = tostring(item.title or item.name), granted = connected(j.node) == true, jewel = true }
    end
  end
  table.sort(out, function(a, b) return a.grantedBy < b.grantedBy end)
  return out
end

-- The tree defects of one stage. `st.nodes`, `st.ascendancyNodes`, `st.weaponSets{set1, set2}` and
-- `st.attributeChoices[{node, attribute}]` as the plan has them (C-31); `jewels` the stage's tree jewels as
-- parse_jewels reads them. Returns the stage's trees for V1's `tree-shape` (D-360; `tree_shape`), or nil without a
-- resolved roll. B3 (amendment 12 §15): a listed node a radius jewel frees (radius_nodes), or a jewel socket a jewel on a
-- connected socket grants (granted_sockets: Voices' Sinister sockets), needs no path; a stage lists every socket its jewels
-- grant, since PoB allocates them all. D-463 (amendment 13 §4): a socketed Split Personality whose socket the stage reaches
-- from the class and ascendancy starts opens the start its variant names: that start joins the seeds, and the stage's
-- `starts` (jewel_starts).
local function check_tree(tree, roll, st, defect, jewels)
  local nodes = tree.nodes
  local mode = {}
  local listed = {}
  local mainIds, ascIds = {}, {}
  for _, id in ipairs(list(st.nodes)) do
    local node = nodes[id]
    if not node then
      defect(('node %s is not a passive tree node'):format(tostring(id)))
    elseif node.ascendancyName then
      defect(('node %d (%s) is an ascendancy node: list it in tree.ascendancyNodes'):format(id, tostring(node.dn)))
    else
      mode[id] = 0
      listed[#listed + 1] = id
      mainIds[#mainIds + 1] = id
    end
  end
  for _, id in ipairs(list(st.ascendancyNodes)) do
    local node = nodes[id]
    if not node then
      defect(('ascendancy node %s is not a passive tree node'):format(tostring(id)))
    elseif roll and node.ascendancyName ~= roll.ascendancyName then
      defect(('node %d (%s) in tree.ascendancyNodes is not a %s node'):format(id, tostring(node.dn), roll.ascendancyName))
    else
      mode[id] = 0
      listed[#listed + 1] = id
      ascIds[#ascIds + 1] = id
    end
  end
  local tagged = {}
  for set, name in ipairs(SET_NAMES) do
    for _, id in ipairs(list(st.weaponSets and st.weaponSets[name])) do
      local node = nodes[id]
      if tagged[id] then
        defect(('node %s is tagged with both weapon sets'):format(tostring(id)))
      elseif mode[id] == nil then
        if node then defect(('node %s carries a weapon-set tag but is not in tree.nodes'):format(tostring(id))) end
      else
        local why = untaggable(node)
        if why then
          defect(('node %d (%s) is %s, which PoB never tags with a weapon set'):format(id, tostring(node.dn), why))
        else
          mode[id] = set
        end
      end
      tagged[id] = true
    end
  end
  local chosen = {}
  for _, choice in ipairs(list(st.attributeChoices)) do
    local id = choice.node
    local node = nodes[id]
    chosen[id] = true
    if node and not node.isAttribute then
      defect(('node %d (%s) has an attribute choice but is not an attribute node'):format(id, tostring(node.dn)))
    end
  end
  for _, id in ipairs(listed) do
    local node = nodes[id]
    if node.isAttribute and not chosen[id] then
      defect(('attribute node %d has no attribute choice: PoB gives an allocated attribute node no stat until '
        .. 'one is chosen (tree.attributeChoices)'):format(id))
    end
  end
  -- D-383: a node whose unlock constraint names a node the stage doesn't list is locked: PoB unlocks it only
  -- while every node its constraint names is allocated (BuildOps.unmet_unlock). The Oracle's The Unseen Path
  -- (5571) unlocks 197 main-tree nodes, which no other ascendancy can take.
  table.sort(listed)
  for _, id in ipairs(listed) do
    local needs = BuildOps.unmet_unlock(nodes, nodes[id], function(n) return mode[n] ~= nil end)
    if needs then
      local named = {}
      for i, need in ipairs(needs) do
        local asc = need.ascendancy
        named[i] = ('%d (%s%s)'):format(need.id, need.name,
          asc and (', ' .. (asc:match('^[AEIOU]') and 'an ' or 'a ') .. asc .. ' node') or '')
      end
      local text = #named == 1 and ('node ' .. named[1] .. ' is')
        or ('nodes ' .. table.concat(named, ', ', 1, #named - 1) .. ' and ' .. named[#named] .. ' are')
      defect(('node %d (%s) is locked: PoB unlocks it only while %s allocated'):format(id, tostring(nodes[id].dn), text))
    end
  end
  if not roll then return end
  -- PoB's rule (PassiveSpec:CanPathThroughAllocMode): an untagged node paths only through untagged nodes,
  -- a node tagged weapon set n also through nodes tagged n. The start nodes are allocated by PoB itself.
  local starts = { roll.classStart, roll.ascendStart }
  mode[roll.classStart] = 0
  if roll.ascendStart then mode[roll.ascendStart] = 0 end
  local reached = {
    [0] = reach(nodes, mode, starts, function(m) return m == 0 end),
    [1] = reach(nodes, mode, starts, function(m) return m == 0 or m == 1 end),
    [2] = reach(nodes, mode, starts, function(m) return m == 0 or m == 2 end),
  }
  local function connected(id) return mode[id] ~= nil and reached[mode[id]][id] == true end
  -- D-463: each Split Personality on a socket reached without its own start opens that start; the stage is reached again
  -- with it among the seeds.
  local jewelStarts = jewel_starts(tree, jewels or {}, connected)
  local opened = false
  for _, s in ipairs(jewelStarts) do
    if s.granted then
      starts[#starts + 1] = s.node
      mode[s.node] = mode[s.node] or 0
      opened = true
    end
  end
  if opened then
    reached = {
      [0] = reach(nodes, mode, starts, function(m) return m == 0 end),
      [1] = reach(nodes, mode, starts, function(m) return m == 0 or m == 1 end),
      [2] = reach(nodes, mode, starts, function(m) return m == 0 or m == 2 end),
    }
  end
  local freed = radius_nodes(tree, jewels or {}, connected)
  local granted = granted_sockets(tree, jewels or {}, connected)
  table.sort(listed)
  for _, id in ipairs(listed) do
    local m = mode[id]
    if not reached[m][id] and not freed[id] and granted[id] == nil then
      local how = m == 0 and 'through untagged nodes'
        or ('through untagged nodes and nodes tagged weapon set ' .. m)
      defect(('node %d (%s)%s is not connected to its start %s%s'):format(id, tostring(nodes[id].dn),
        m == 0 and '' or (' (weapon set ' .. m .. ')'), how,
        nodes[id].sinister and ': a Sinister Jewel socket is allocated only by a jewel that grants it (Voices grants '
          .. 'voices_jewel_slot1 onward, as many as its "Allocates <n> Sinister Jewel sockets" says)' or ''))
    end
  end
  -- PoB allocates every socket a jewel grants, so the stage's tree, which PoB's allocation must equal (D-213), lists each.
  local missing = {}
  for id, by in pairs(granted) do
    if mode[id] == nil then missing[#missing + 1] = { id = id, by = by } end
  end
  table.sort(missing, function(a, b) return a.id < b.id end)
  for _, g in ipairs(missing) do
    defect(('node %d (%s) is a jewel socket the jewel on node %d grants, which PoB allocates while that jewel is socketed: '
      .. 'list it in tree.nodes'):format(g.id, tostring(nodes[g.id] and nodes[g.id].dn), g.by))
  end
  return tree_shape(tree, roll, st.id, mainIds, ascIds, jewelStarts)
end

-- The number of active skills a gem may grant (an upper bound: PoB lists its non-support granted effects).
local function active_skill_count(gemData)
  local n = 0
  for _, ge in ipairs(gemData.grantedEffectList or { gemData.grantedEffect }) do
    if ge and not ge.support then n = n + 1 end
  end
  return n
end

local numbered = BuildOps.numbered

-- D-377: the active skills PoB builds for a gem the compile adds: its granted effects that are neither supports
-- nor hidden from the sidebar, a global-effect one only while its enableGlobal<n> switch is on. add_gem turns the
-- first switch on and the second off (vendor Modules/CalcSetup.lua:1853-1855).
local function gem_actives(gemData)
  local out = {}
  for index, ge in ipairs(gemData.grantedEffectList or { gemData.grantedEffect }) do
    if type(ge) == 'table' and not ge.support and not ge.hideFromSideBar and (not ge.hasGlobalEffect or index == 1) then
      out[#out + 1] = ge
    end
  end
  return out
end

-- D-377: the active skills PoB builds for a compiled group, in its order: each enabled gem's (a disabled gem builds
-- none, CalcSetup.lua:1852). `gems` are { gemData, enabled }.
local function group_actives(gems)
  local out = {}
  for _, gem in ipairs(gems) do
    if gem.enabled then
      for _, ge in ipairs(gem_actives(gem.gemData)) do out[#out + 1] = ge end
    end
  end
  return out
end

-- Whether an active skill summons a minion: its granted effect names minion types (vendor
-- Modules/CalcActiveSkill.lua builds `activeSkill.minion` from `minionList`). A summon's "Command" skill names none.
local function is_summon(ge)
  return type(ge.minionList) == 'table' and ge.minionList[1] ~= nil
end

-- The ExtraMinionSkill entries the group's enabled supports add to a minion's skill list ({skillId, minionList?}),
-- read from their stat maps in stat-set order and stat-name order (Minion Instability, vendor
-- Data/Skills/sup_int.lua).
local function extra_minion_skills(gems)
  local out = {}
  for _, gem in ipairs(gems) do
    local gemData = gem.gemData
    for _, ge in ipairs(gem.enabled and (gemData.grantedEffectList or { gemData.grantedEffect }) or {}) do
      if type(ge) == 'table' and ge.support then
        for _, set in ipairs(ge.statSets or {}) do
          local stats = {}
          for stat in pairs(set.statMap or {}) do stats[#stats + 1] = tostring(stat) end
          table.sort(stats)
          for _, stat in ipairs(stats) do
            for _, m in ipairs(set.statMap[stat]) do
              if type(m) == 'table' and m.name == 'ExtraMinionSkill' and type(m.value) == 'table' and m.value.skillId then
                out[#out + 1] = m.value
              end
            end
          end
        end
      end
    end
  end
  return out
end

-- D-377: the summon's minion and the skills it can use, from the game data as PoB builds them for a gem the compile
-- adds. The minion is the first type of the summon's minionList: add_gem sets no `skillMinion`, so PoB takes index 1
-- (vendor Modules/CalcActiveSkill.lua:926-929). Its list is calcs.createMinionSkills' (:1112-1130): the minion's
-- skillList in data order, ids without skill data skipped, then the supports' ExtraMinionSkill skills meant for it.
-- { name, id, skills = {grantedEffect...} }, or nil when the game data has no such minion.
local function summon_minion(d, summon, extras)
  local minionId = summon.minionList[1]
  local minion = d.minions and d.minions[minionId]
  if type(minion) ~= 'table' then return nil end
  local skills = {}
  for _, skillId in ipairs(minion.skillList or {}) do
    if type(d.skills[skillId]) == 'table' then skills[#skills + 1] = d.skills[skillId] end
  end
  for _, extra in ipairs(extras) do
    local meant = extra.minionList == nil
    for _, id in ipairs(extra.minionList or {}) do
      if id == minionId then meant = true end
    end
    if meant and type(d.skills[extra.skillId]) == 'table' then skills[#skills + 1] = d.skills[extra.skillId] end
  end
  return { name = tostring(minion.name or minionId), id = tostring(minionId), skills = skills }
end

local function skill_names(skills)
  local names = {}
  for i, ge in ipairs(skills) do names[i] = tostring(ge.name or ge.id) end
  return names
end

-- D-377: a group's minionSkill and minionStatSet against the game data (`gems` are its resolved gems,
-- { gemData, enabled }, nil when one is unknown, which is its own defect). `isMain` with `mainActive`, the stage's
-- main active skill: the main group's main active skill must be its summon. PoB's live list can't be read without
-- building the stage, so a name is checked against what the summon's minion and the group's enabled supports can
-- give it; compile_stage resolves it live.
local function check_minion_skill(gi, group, gems, isMain, mainActive, defect)
  if group.minionSkill == nil then return end
  local wanted = tostring(group.minionSkill)
  local at = ('skills.groups[%d].minionSkill "%s"'):format(gi - 1, wanted)
  if gems == nil then return end
  local actives = group_actives(gems)
  local names, summons = skill_names(actives), {}
  for i, ge in ipairs(actives) do
    if is_summon(ge) then summons[#summons + 1] = i end
  end
  if #summons == 0 then
    -- A summon gem the plan disables builds no skill, so its minion has none either.
    for k, gem in ipairs(gems) do
      if not gem.enabled then
        for _, ge in ipairs(gem_actives(gem.gemData)) do
          if is_summon(ge) then
            defect(('%s: the group\'s summon, gems[%d] "%s", is disabled, so PoB builds no minion for it; enable it'):format(
              at, k - 1, tostring(gem.gemData.name)))
            return
          end
        end
      end
    end
    if #actives == 0 then
      defect(('%s: the group has no active skill, so it has no minion'):format(at))
      return
    end
    local command = false
    for _, name in ipairs(names) do
      if name == 'Command' then command = true end
    end
    defect(('%s: the group holds no summon: none of its active skills (%s) has a minion%s'):format(at, numbered(names),
      command and '; "Command" is a summon\'s command to its minion and has none itself' or ''))
    return
  end
  if #summons > 1 then
    local parts = {}
    for k, i in ipairs(summons) do parts[k] = i .. ' ' .. names[i] end
    defect(('%s: the group holds %d summons (%s); a minion skill needs a group with one summon'):format(at, #summons,
      table.concat(parts, ', ')))
    return
  end
  local summonIndex = summons[1]
  local summon = actives[summonIndex]
  if isMain and mainActive ~= nil and mainActive ~= summonIndex and names[mainActive] ~= nil then
    defect(('%s: the main active skill %d (%s) has no minion; with a minion skill the main active skill is the group\'s summon, active skill %d (%s)'):format(
      at, mainActive, names[mainActive], summonIndex, names[summonIndex]))
  end
  local d = (build and build.data) or data
  local minion = summon_minion(d, summon, extra_minion_skills(gems))
  if minion == nil then
    defect(('%s: the game data has no minion %s for %s'):format(at, tostring(summon.minionList[1]), tostring(summon.name)))
    return
  end
  local list = skill_names(minion.skills)
  local positions = {}
  for i, name in ipairs(list) do
    if name:lower() == wanted:lower() then positions[#positions + 1] = i end
  end
  if #positions > 1 then
    local where = {}
    for k, i in ipairs(positions) do where[k] = tostring(i) end
    defect(('%s: %s\'s skill list holds the name %d times, at positions %s, so it is ambiguous; its skills: %s'):format(
      at, minion.name, #positions, table.concat(where, ' and '), numbered(list)))
    return
  end
  if #positions == 0 then
    defect(('%s: %s (summoned by %s) has no skill of that name; its skills: %s'):format(at, minion.name,
      tostring(summon.name), numbered(list)))
    return
  end
  local found = minion.skills[positions[1]]
  local statSet = tonumber(group.minionStatSet)
  local count = #(found.statSets or {})
  if statSet ~= nil and count > 0 and statSet > count then
    local labels = {}
    for i = 1, count do labels[i] = tostring(found.statSets[i].label or found.name) end
    defect(('skills.groups[%d].minionStatSet %d is beyond %s\'s %d stat set%s (%s)'):format(gi - 1, statSet,
      tostring(found.name), count, count == 1 and '' or 's', numbered(labels)))
  end
end

-- The off-hand slots: whether an item fits them depends on the stage's main hand and its weapon-fit flags,
-- so the stage build checks them.
local OFF_HAND = { ['Weapon 2'] = true, ['Weapon 2 Swap'] = true }

-- A custom modifier line as PoB's customMods option parses it (D-293): stripped of colour codes and of spaces and '?'
-- at either end, then modLib.parseMod (Modules/ConfigOptions.lua:2281-2285). Returns its mods and any unparsed rest.
local function parse_custom_line(line)
  if type(modLib) ~= 'table' or type(modLib.parseMod) ~= 'function' then fail("PoB's modifier parser is not available") end
  local stripped = StripEscapes(tostring(line)):gsub('^[%s?]+', ''):gsub('[%s?]+$', '')
  return modLib.parseMod(stripped)
end

-- Whether PoB's customMods option adds `line` as modifiers (D-293): its apply keeps a line only when modLib.parseMod
-- parses all of it.
local function parses_whole(line)
  local mods, extra = parse_custom_line(line)
  return mods ~= nil and not extra
end

-- D-469 (amendment 13 §10): the comment line written before a schema-9 custom modifier line, from its reason, or nil
-- for none. PoB adds a line only when it parses whole (Modules/ConfigOptions.lua:2279-2297), so this one reads as a
-- comment unless parses_whole says otherwise, which check_stage refuses.
local function comment_line(reason)
  if reason == nil or tostring(reason) == '' then return nil end
  return '# ' .. tostring(reason)
end

-- D-451 (amendment 12 §6): each custom modifier line the stage writes (`st.customMods`, in order), with the names of
-- the modifiers PoB's parser makes of it as its customMods option does (parse_custom_line), each once in parse order,
-- for V1's `custom-defence`: {text, modNames[]}.
local function custom_mod_names(st)
  local out = {}
  for _, line in ipairs(list(st.customMods)) do
    local mods = parse_custom_line(line)
    local names, seen = {}, {}
    for _, mod in ipairs(type(mods) == 'table' and mods or {}) do
      if type(mod) == 'table' and type(mod.name) == 'string' and not seen[mod.name] then
        seen[mod.name] = true
        names[#names + 1] = mod.name
      end
    end
    out[#out + 1] = { text = tostring(line), modNames = names }
  end
  return out
end

-- D-402 (WU-87): the companion gems. Tame Beast (TameBeastPlayer) is the gem a plan holds; a capture turns it into
-- PoB's companion gem (SummonBeastPlayer, "Companion: {0}", which PoB names "Tamed Companion" until it summons a beast
-- and then "Companion: <beast>", Modules/CalcDefence.lua:203-207). Its minion comes from the build's beast library
-- (Modules/CalcActiveSkill.lua:904-906).
local TAME_BEAST = 'TameBeastPlayer'
local COMPANION = 'SummonBeastPlayer'
local COMPANION_GEM = 'Metadata/Items/Gems/SkillGemSummonBeast'
local TAME_BEAST_GEM = 'Metadata/Items/Gems/SkillGemTameBeast'

local function is_companion_gem(gemData)
  local id = type(gemData) == 'table' and gemData.grantedEffectId
  return id == TAME_BEAST or id == COMPANION
end

-- D-402: PoB's beast library, as its "Manage Beasts..." list builds it: the spectres whose monsterCategory is "Beast"
-- (Modules/Build.lua:1533-1561), each {id, name, companionReservation}, sorted by name, then id.
local function beast_library()
  local d = (build and build.data) or data
  local out = {}
  for id in pairs(d.spectres or {}) do
    local m = (d.minions and d.minions[id]) or d.spectres[id]
    if type(m) == 'table' and m.monsterCategory == 'Beast' then
      out[#out + 1] = { id = tostring(id), name = tostring(m.name or id), companionReservation = tonumber(m.companionReservation) }
    end
  end
  table.sort(out, function(a, b)
    if a.name ~= b.name then return a.name < b.name end
    return a.id < b.id
  end)
  return out
end

-- The most species suggestions an unknown name gets.
local MAX_BEAST_SUGGESTIONS = 8

-- D-402: a companion's species: a monster id of the beast library, else a beast's name, ignoring case. A name several
-- beasts share is ambiguous (PoB's ImportTab tells them apart by their Spirit percentage too), so the error lists their
-- ids. Returns the beast, or nil and why.
local function resolve_beast(species)
  local wanted = tostring(species or '')
  local lower = wanted:lower()
  local library = beast_library()
  for _, b in ipairs(library) do
    if b.id == wanted then return b end
  end
  local named = {}
  for _, b in ipairs(library) do
    if b.name:lower() == lower then named[#named + 1] = b end
  end
  if #named == 1 then return named[1] end
  if #named > 1 then
    local ids = {}
    for k, b in ipairs(named) do ids[k] = ('%s (%s%% of Spirit)'):format(b.id, tostring(b.companionReservation)) end
    return nil, ('PoB\'s beast library has %d beasts named "%s"; name one by its monster id: %s'):format(#named,
      named[1].name, table.concat(ids, '; '))
  end
  local prefix, contains, seen = {}, {}, {}
  for _, b in ipairs(library) do
    local at = lower ~= '' and b.name:lower():find(lower, 1, true) or nil
    if at and not seen[b.name] then
      seen[b.name] = true
      if at == 1 then prefix[#prefix + 1] = b.name else contains[#contains + 1] = b.name end
    end
  end
  local hints = {}
  for _, names in ipairs({ prefix, contains }) do
    for _, name in ipairs(names) do
      if #hints < MAX_BEAST_SUGGESTIONS then hints[#hints + 1] = name end
    end
  end
  if #hints == 0 then
    return nil, ('no beast of PoB\'s beast library (%d beasts, "Manage Beasts...") is named "%s"'):format(#library, wanted)
  end
  return nil, ('no beast of PoB\'s beast library is named "%s". Did you mean: %s'):format(wanted, table.concat(hints, ', '))
end

-- D-402: a stage's companion (`companion {species, lines[], groupsEnabled[]}`). Defects: a species the beast library
-- lacks, or a name several beasts share; no Tame Beast gem in the stage's groups (PoB's companion gem counts too), two
-- of them, or one that is disabled or in a disabled group. Otherwise the resolved beast, with whether PoB parses each
-- of the custom modifier lines its kept modifiers write (`parsed`, in `lines`' order): a line it can't parse adds
-- nothing, so the compile leaves it out and the record says so.
local function check_companion(st, defect)
  local c = st.companion
  if type(c) ~= 'table' then return nil end
  local ok = true
  local beast, why = resolve_beast(c.species)
  if not beast then
    defect(('companion.species "%s": %s'):format(tostring(c.species), why))
    ok = false
  end
  local groupsEnabled = list(c.groupsEnabled)
  local found = {}
  for gi, group in ipairs(list(st.groups)) do
    for k, gem in ipairs(list(group.gems)) do
      if is_companion_gem(BuildOps.resolve_gem(gem.name)) then
        found[#found + 1] = { at = ('skills.groups[%d].gems[%d]'):format(gi - 1, k - 1),
          enabled = gem.enabled ~= false and groupsEnabled[gi] ~= false }
      end
    end
  end
  if #found == 0 then
    defect('companion: no group holds the Tame Beast gem, so PoB summons no companion; put a "Tame Beast" gem in an '
      .. 'enabled group (the compile turns it into the tamed beast)')
    ok = false
  elseif #found > 1 then
    local at = {}
    for k, f in ipairs(found) do at[k] = f.at end
    defect(('companion: %d gems are Tame Beast (%s); a stage\'s companion is one beast, so it holds one'):format(#found,
      table.concat(at, ', ')))
    ok = false
  elseif not found[1].enabled then
    defect(('companion: the Tame Beast gem, %s, is disabled or in a disabled group, so PoB summons no companion; enable it')
      :format(found[1].at))
    ok = false
  end
  if not ok then return nil end
  local parsed = {}
  for i, line in ipairs(list(c.lines)) do parsed[i] = parses_whole(line) end
  return { stage = tostring(st.id), species = tostring(c.species), id = beast.id, name = beast.name,
    companionReservation = beast.companionReservation, parsed = parsed }
end

-- The stage's defects; returns its trees (check_tree).
local function check_stage(tree, roll, st, defect)
  local jewels = parse_jewels(st)
  local shape = check_tree(tree, roll, st, defect, jewels)
  for _, j in ipairs(jewels) do
    local item = j.item
    if not item or not item.baseName then
      defect(('tree jewel on node %s: PoB can not parse its text into an item with a base type'):format(tostring(j.node)))
    elseif item.type ~= 'Jewel' then
      defect(('tree jewel on node %s: %s is not a jewel'):format(tostring(j.node), tostring(item.baseName)))
    elseif BuildOps.is_unobtainable_unique(item) then
      defect(('tree jewel on node %s: %s is no longer obtainable: PoB\'s unique data marks it so'):format(tostring(j.node),
        tostring(item.title or item.name)))
    end
    if not is_jewel_socket(tree.nodes[j.node]) then
      defect(('tree jewel on node %s: that node is not a jewel socket'):format(tostring(j.node)))
    end
  end
  for _, it in ipairs(list(st.items)) do
    local slot = tostring(it.slot)
    local res, err = BuildOps.add_item_text({ text = it.text, slotName = (not OFF_HAND[slot]) and slot or nil,
      validateOnly = true })
    if not res then
      local why = tostring(err)
      if why == 'failed to parse item' then why = 'PoB can not parse its text into an item with a base type' end
      defect(('item in %s: %s'):format(slot, why))
    elseif res.unobtainable then
      -- D-384: PoB adds it, but the game no longer drops it.
      defect(('item in %s: %s is no longer obtainable: PoB\'s unique data marks it so'):format(slot, tostring(res.title or res.name)))
    end
  end
  local groups = list(st.groups)
  local activeCounts, resolved = {}, {}
  for gi, group in ipairs(groups) do
    activeCounts[gi] = 0
    resolved[gi] = {}
    for k, gem in ipairs(list(group.gems)) do
      local gemData, err = BuildOps.resolve_gem(gem.name)
      if not gemData then
        defect(('skills.groups[%d].gems[%d]: %s'):format(gi - 1, k - 1, tostring(err)))
        resolved[gi] = false
      else
        -- D-384: PoB builds a legacy gem behind "Show legacy gems", but the game no longer has it.
        if BuildOps.is_legacy_gem(gemData) then
          defect(('skills.groups[%d].gems[%d]: %s is a legacy gem: PoB marks it legacy, and it is no longer in the game')
            :format(gi - 1, k - 1, tostring(gemData.name)))
        end
        activeCounts[gi] = activeCounts[gi] + active_skill_count(gemData)
        if resolved[gi] then table.insert(resolved[gi], { gemData = gemData, enabled = gem.enabled ~= false }) end
      end
    end
  end
  local main = st.main or {}
  for gi, group in ipairs(groups) do
    check_minion_skill(gi, group, resolved[gi] or nil, tonumber(main.group) == gi, tonumber(main.activeSkill), defect)
  end
  local mg = tonumber(main.group)
  if not mg or mg < 1 or mg > #groups then
    defect(('the main group %s is outside the stage\'s %d socket groups'):format(tostring(main.group), #groups))
  else
    local ma = tonumber(main.activeSkill)
    if not ma or ma < 1 or ma > activeCounts[mg] then
      defect(('the main active skill %s is outside group %d\'s %d active skills'):format(tostring(main.activeSkill), mg,
        activeCounts[mg]))
    end
  end
  -- WU-111 (amendment 11 §9b, D-447): each boss rotation entry's active skill and stat set, as the main selection's are
  -- checked: the active skill within the group's upper bound (activeCounts), the stat set within the most any of the
  -- group's active skills has. `at` is the entry's path in the plan (`stages[n].skills.boss.entries[k]`); its group is
  -- the schema's check. compile_plan checks the exact selection against PoB's boss measure.
  for _, entry in ipairs(list(st.bossEntries)) do
    local g = tonumber(entry.group)
    if g and g >= 1 and g <= #groups then
      local a = tonumber(entry.activeSkill)
      local p = tonumber(entry.statSet) or 1
      if not a or a < 1 or a > activeCounts[g] then
        defect(('%s: active skill %s is outside group %d\'s %d active skills'):format(tostring(entry.at),
          tostring(entry.activeSkill), g, activeCounts[g]))
      elseif resolved[g] then
        local most = 0
        for _, ge in ipairs(group_actives(resolved[g])) do most = math.max(most, #(ge.statSets or {}), 1) end
        if most > 0 and (p < 1 or p > most) then
          defect(('%s: stat set %s is beyond every active skill of group %d: the most any has is %d'):format(
            tostring(entry.at), tostring(entry.statSet), g, most))
        end
      end
    end
  end
  local opts, err = BuildOps.config_options()
  if not opts then fail(err) end
  for _, entry in ipairs(list(st.config)) do
    local option = opts.byVar[entry.option]
    if not option then
      defect(('unknown config option "%s"'):format(tostring(entry.option)))
    else
      local ok, why = BuildOps.config_value(option, entry.value)
      if not ok then defect(why) end
    end
  end
  for i, line in ipairs(list(st.customMods)) do
    if not parses_whole(line) then
      defect(('config.customMods[%d]: PoB can not parse "%s" whole as a modifier, so its customMods option would '
        .. 'skip it and add nothing'):format(i - 1, tostring(line)))
    end
  end
  -- D-469 (R-68): a schema-9 reason is written as the comment line before its line; one PoB parses whole would add a
  -- modifier, so the reason is reworded.
  for i, reason in ipairs(list(st.customModReasons)) do
    local comment = comment_line(reason)
    if comment and parses_whole(comment) then
      defect(('config.customMods[%d].reason: PoB parses its comment line "%s" whole as a modifier, so its customMods '
        .. 'option would add it: reword the reason (D-469)'):format(i - 1, comment))
    end
  end
  return shape
end

-- ---------------------------------------------------------------------------------------------------
-- compile_check's V2 inputs (WU-42): the producers and the config baseline

-- PoB's game data: the loaded build's copy when there is one, else the global.
local function game_data()
  return (build and build.data) or data
end

local function lower(s)
  return type(s) == 'string' and s:lower() or nil
end

-- An item base or unique named `wanted` (lowercase); `itemType` ('Flask', 'Charm') keeps only that type.
local function item_exists(wanted, itemType)
  for baseName, base in pairs(game_data().itemBases or {}) do
    if lower(baseName) == wanted and (not itemType or base.type == itemType) then return true end
  end
  local db = main and main.uniqueDB and main.uniqueDB.list or {}
  for key, item in pairs(db) do
    if lower(item.title or item.name or key) == wanted and (not itemType or item.type == itemType) then return true end
  end
  return false
end

-- Whether a producer of `kind` named `name` exists in the game data (D-221), names compared ignoring case.
local function producer_exists(tree, kind, name)
  local wanted = tostring(name or ''):lower()
  if kind == 'gem' then return Lookup.findGem(name) ~= nil end
  if kind == 'passive' then
    for _, node in pairs(tree.nodes or {}) do
      if lower(node.dn) == wanted then return true end
    end
    return false
  end
  if kind == 'skill' then
    for _, ge in pairs(game_data().skills or {}) do
      if type(ge) == 'table' and not ge.support and lower(ge.name) == wanted then return true end
    end
    return false
  end
  if kind == 'item' then return item_exists(wanted, nil) end
  if kind == 'flask' then return item_exists(wanted, 'Flask') end
  if kind == 'charm' then return item_exists(wanted, 'Charm') end
  return false
end

local function scalar(v)
  local t = type(v)
  if t == 'boolean' or t == 'string' or finite(v) then return v end
  return nil
end

-- The fields by which ConfigTab shows an option only for some builds (its shownFuncs,
-- Classes/ConfigTab.lua:244-541): an option with any of them is conditional.
local SHOW_GATES = { 'ifNode', 'ifOption', 'ifCond', 'ifMinionCond', 'ifEnemyCond', 'ifMult', 'ifEnemyMult', 'ifStat',
  'ifEnemyStat', 'ifTagType', 'ifFlag', 'ifMod', 'ifSkill', 'ifSkillType', 'ifSkillFlag', 'ifSkillData', 'ifGemFamily' }

local function is_conditional(varData)
  for _, gate in ipairs(SHOW_GATES) do
    if varData[gate] ~= nil then return true end
  end
  return false
end

-- Per config option: its type, whether it has an apply, the value a new config set holds for it (its
-- defaultState, or its defaultIndex list entry), its defaultPlaceholderState, its first list value, and
-- whether PoB shows it only for some builds (`conditional`, D-250). Read from PoB's option list as
-- ConfigTab:CreateConfigSet fills a new set (a later entry for the same var replaces an earlier one's
-- values); no config set is created, so the loaded build is unchanged.
local configBaselineCache
local function config_baseline()
  if configBaselineCache then return configBaselineCache end
  local ok, varList = pcall(LoadModule, 'Modules/ConfigOptions')
  if not ok or type(varList) ~= 'table' then fail('could not load the config option list') end
  local out = {}
  for _, varData in ipairs(varList) do
    if varData.var then
      local default = varData.defaultState
      if varData.defaultIndex and varData.list and varData.list[varData.defaultIndex] then
        default = varData.list[varData.defaultIndex].val
      end
      local first = varData.list and varData.list[1] and varData.list[1].val
      local before = out[varData.var]
      out[varData.var] = {
        type = tostring(varData.type),
        apply = varData.apply ~= nil or (before ~= nil and before.apply == true),
        default = scalar(default),
        defaultPlaceholder = scalar(varData.defaultPlaceholderState),
        first = scalar(first),
        conditional = is_conditional(varData) or (before ~= nil and before.conditional == true),
      }
    end
  end
  configBaselineCache = out
  return out
end

-- ---------------------------------------------------------------------------------------------------
-- The anoint (WU-65, D-358): one notable on the stage's amulet, written as the enchant `Allocates
-- <notable>`, which PoB grants with no path or point (Modules/CalcSetup.lua:17-21, 1405-1414)

local ANOINT_SLOT = 'Amulet'

-- The notable PoB's `Allocates <name>` grants: the tree's notable of that name, lowercased and trimmed as
-- PassiveSpec:ResolveGrantedPassiveNodes matches it (Classes/PassiveSpec.lua:1063-1104), or nil.
local function anoint_node(tree, notable)
  local key = tostring(notable or ''):lower():gsub('^%s+', ''):gsub('%s+$', '')
  return tree.notableMap and tree.notableMap[key] or nil
end

-- PoB's item names of a recipe's emotions (Data/LiquidEmotions.lua): the anoint emotions are the ones that
-- aren't radius-jewel emotions, named "... Liquid <emotion>". An emotion with no such item keeps its name.
local function emotion_names(recipe)
  local byWord = {}
  for _, e in pairs(game_data().emotions or {}) do
    local word = type(e) == 'table' and not e.radiusJewel and type(e.name) == 'string' and e.name:match('Liquid (%a+)$')
    if word and not e.name:match('^Potent') then byWord[word] = e.name end
  end
  local out = {}
  for i, word in ipairs(recipe) do out[i] = byWord[word] or word end
  return out
end

-- The anoint's defects for one stage (`st.anoint` names the notable), and what the record gives of a valid
-- one: the notable's PoB name and node, its recipe and the emotions' item names. nil without a valid anoint.
local function check_anoint(tree, st, defect)
  local wanted = st.anoint
  if wanted == nil then return nil end
  local hasAmulet = false
  for _, it in ipairs(list(st.items)) do
    if tostring(it.slot) == ANOINT_SLOT then hasAmulet = true end
  end
  if not hasAmulet then
    defect(('items.anoint: the stage equips no amulet to anoint with "%s"; put one in the Amulet slot'):format(tostring(wanted)))
  end
  local node = anoint_node(tree, wanted)
  if not node then
    defect(('items.anoint: "%s" is no notable of the passive tree, so it has no three-emotion recipe'):format(tostring(wanted)))
    return nil
  end
  local recipe = {}
  for i, word in ipairs(list(node.recipe)) do recipe[i] = tostring(word) end
  if #recipe ~= 3 then
    defect(('items.anoint: notable "%s" (node %d) has no recipe of three Distilled Emotions, so no amulet can be anointed '
      .. 'with it'):format(tostring(node.dn), node.id))
  end
  local allocated = false
  for _, id in ipairs(list(st.nodes)) do
    if id == node.id then allocated = true end
  end
  if allocated then
    defect(('items.anoint: notable "%s" (node %d) is already allocated on the stage\'s tree, so the anoint would add '
      .. 'nothing'):format(tostring(node.dn), node.id))
  end
  if not hasAmulet or #recipe ~= 3 or allocated then return nil end
  return { stage = tostring(st.id), notable = tostring(node.dn), node = node.id, recipe = recipe,
    emotions = emotion_names(recipe) }
end

-- D-435 (the user, 2026-10-23): a base's implicits. The game gives every item its base's implicit, but PoB gives an
-- item text written as a bare base none (no spear's Spear Throw, no ring's resistance, no amulet's attribute), and a
-- plan's item text is often one. So a text with no `Implicits:` line gets its base's implicits (Data/Bases/*.lua's
-- `implicit`, each line with its `implicitModTypes` tags) as PoB's own rare list fills a base's
-- (Modules/Main.lua:170-176) and its crafting window makes an item from a base (Classes/ItemsTab.lua:2446-2453): the
-- lines go into the item's implicitModLines, and PoB re-reads the item (Item:BuildAndParseRaw), which gives a range
-- PoB's default roll, main.defaultItemAffixQuality (0.5, Modules/Main.lua:105). Kept as written: a text with an
-- `Implicits:` line (`Implicits: 0` too, the designer's choice), a unique or relic (PoB's unique data carries its
-- own), an item PoB already reads implicit lines on, and a text PoB can't parse (compile_check reports it). A base
-- whose implicit has variants (`variantList`: three amulet bases at the pin, Data/Bases/amulet.lua) isn't filled; the
-- second value names it, {base, variants[]}, for V1's `implicit-variant`, so the designer writes the variant's line.
-- Cached by text: the result depends only on the game data.
local implicitCache, implicitCached = {}, 0

local function has_implicits_line(text)
  for line in (text .. '\n'):gmatch('([^\n]*)\n') do
    if line:match('^%s*Implicits:') then return true end
  end
  return false
end

local function base_implicits(text)
  text = tostring(text)
  local hit = implicitCache[text]
  if hit then return hit.text, hit.variant end
  local out, variant = text, nil
  if not has_implicits_line(text) then
    local ok, item = pcall(construct, 'Item', text)
    local base = ok and item and item.base or nil
    if base and item.rarity ~= 'UNIQUE' and item.rarity ~= 'RELIC' and type(base.implicit) == 'string'
        and #(item.implicitModLines or {}) == 0 then
      if base.variantList then
        local variants = {}
        for i, v in ipairs(base.variantList) do variants[i] = tostring(v) end
        variant = { base = tostring(item.baseName), variants = variants }
      else
        local index = 1
        for line in base.implicit:gmatch('[^\n]+') do
          table.insert(item.implicitModLines,
            { line = line, modTags = base.implicitModTypes and base.implicitModTypes[index] or {} })
          index = index + 1
        end
        item:BuildAndParseRaw()
        out = item:BuildRaw()
      end
    end
  end
  if implicitCached >= 2000 then implicitCache, implicitCached = {}, 0 end
  implicitCache[text] = { text = out, variant = variant }
  implicitCached = implicitCached + 1
  return out, variant
end

-- The text of a plan item as the compile reads it: with its base's implicits filled (D-435).
local function item_text(it)
  return (base_implicits(it.text))
end

-- D-435: the stage's items whose base's implicit has variants and whose text has no `Implicits:` line, left unfilled:
-- {slot, base, variants[]} each, in the stage's item order.
local function implicit_variants(st)
  local out = {}
  for _, it in ipairs(list(st.items)) do
    -- D-464: a pinned weapon's Swap slot shares its set-1 slot's item, reported there.
    local _, variant = base_implicits(it.text)
    if variant and it.sameAs == nil then out[#out + 1] = { slot = tostring(it.slot), base = variant.base, variants = variant.variants } end
  end
  return out
end

-- The item text compile_stage equips in a slot, its base's implicits filled (D-435): on the amulet, the stage's anoint
-- as PoB's anoint dialog writes it (ItemsTab:anointItem), one enchant line `Allocates <notable>` first, in place of
-- any other `Allocates` line; the amulet's other enchant lines stay, after it.
local function anointed_text(st, it)
  local text = item_text(it)
  if st.anoint == nil or tostring(it.slot) ~= ANOINT_SLOT then return text end
  local ok, item = pcall(construct, 'Item', text)
  if not ok or not item or not item.baseName then fail('anointing the amulet: PoB can not parse its text') end
  local lines = { { enchant = true, line = 'Allocates ' .. tostring(st.anoint) } }
  for _, line in ipairs(item.enchantModLines or {}) do
    if not tostring(line.line):match('^Allocates ') then lines[#lines + 1] = line end
  end
  item.enchantModLines = lines
  item:BuildAndParseRaw()
  return item:BuildRaw()
end

-- The description PoB gives each named gem (its granted effects', joined), for the clear-speed measure (D-353).
local function gem_texts(names)
  local out = {}
  for _, name in ipairs(list(names)) do
    local gemData = BuildOps.resolve_gem(name)
    local texts = {}
    for _, ge in ipairs(gemData and (gemData.grantedEffectList or { gemData.grantedEffect }) or {}) do
      if type(ge) == 'table' and type(ge.description) == 'string' then texts[#texts + 1] = ge.description end
    end
    if #texts > 0 then out[tostring(name)] = table.concat(texts, ' ') end
  end
  return out
end

-- The weapon slots, each set's main hand first (WU-102).
local WEAPON_SLOT = { ['Weapon 1'] = true, ['Weapon 2'] = true, ['Weapon 1 Swap'] = true, ['Weapon 2 Swap'] = true }

-- WU-102 (PG-74): the stage's weapon slots whose item grants a skill, as PoB parses the item (Item:BuildModList's
-- grantedSkills, from its `Grants Skill:` lines, a base's implicit included: a spear's Spear Throw, a shield's Raise
-- Shield). PoB gives such an item's skill the supports of every group socketed in the same slot, " Swap" stripped
-- (Modules/CalcSetup.lua:1727-1732, :1913-1928), so the compiler puts a group on a weapon set in that set's slot whose
-- item grants none. Appends {stage, slot, skills[]} to `out`, the skills by PoB's names. The item is read as the
-- compile equips it, its base's implicits filled (D-435), so a bare spear's Spear Throw counts.
local function weapon_grants(st, out)
  local d = game_data()
  for _, it in ipairs(list(st.items)) do
    local slot = tostring(it.slot)
    if WEAPON_SLOT[slot] then
      local ok, item = pcall(construct, 'Item', item_text(it))
      if ok and item and type(item.grantedSkills) == 'table' and #item.grantedSkills > 0 then
        local names = {}
        for _, g in ipairs(item.grantedSkills) do
          local skill = d and d.skills and d.skills[g.skillId]
          names[#names + 1] = tostring(skill and skill.name or g.skillId)
        end
        out[#out + 1] = { stage = tostring(st.id), slot = slot, skills = names }
      end
    end
  end
end

-- WU-111 (amendment 11 §8, D-440): the boots' movement-speed tiers in the game data, {value, itemLevel}, lowest item
-- level first: the item mods of group MovementVelocity that boots roll (Data/ModItem.lua:450-455: 10% at item level 1
-- up to 35% at 82), for V1's `movement-tier`.
local function movement_tiers()
  local d = game_data()
  local mods = d and d.itemMods and d.itemMods.Item or {}
  local out = {}
  for _, mod in pairs(mods) do
    if type(mod) == 'table' and mod.group == 'MovementVelocity' and type(mod[1]) == 'string' then
      local boots = false
      for i, key in ipairs(mod.weightKey or {}) do
        if key == 'boots' and (tonumber((mod.weightVal or {})[i]) or 0) > 0 then boots = true end
      end
      local value = tonumber(mod[1]:match('^(%d+)%% increased Movement Speed$'))
      if boots and value and tonumber(mod.level) then out[#out + 1] = { value = value, itemLevel = tonumber(mod.level) } end
    end
  end
  table.sort(out, function(a, b) return a.itemLevel < b.itemLevel or (a.itemLevel == b.itemLevel and a.value < b.value) end)
  return out
end

function M.compile_check(params)
  local tree = main and main.LoadTree and main:LoadTree(latestTreeVersion)
  if not tree then fail('passive tree data not available') end
  local defects = {}
  local roll, rollErr = resolve_roll(tree, params.className, params.ascendancy)
  if not roll then defects[#defects + 1] = 'roll: ' .. rollErr end
  if roll then roll.starts = tree_starts(tree, roll) end
  local stages = list(params.stages)
  local anoints, trees, companions, grants = {}, {}, {}, {}
  for _, st in ipairs(stages) do
    local function defect(msg) defects[#defects + 1] = 'stage ' .. tostring(st.id) .. ': ' .. msg end
    trees[#trees + 1] = check_stage(tree, roll, st, defect)
    anoints[#anoints + 1] = check_anoint(tree, st, defect)
    companions[#companions + 1] = check_companion(st, defect)
    weapon_grants(st, grants)
  end
  local producers = {}
  for _, p in ipairs(list(params.producers)) do
    local kind, name = tostring(p.kind), tostring(p.name)
    producers[#producers + 1] = { kind = kind, name = name, exists = producer_exists(tree, kind, name) }
  end
  return { defects = defects, treeVersion = tostring(latestTreeVersion), stageCount = #stages, producers = producers,
    configBaseline = config_baseline(), anoints = anoints, gemTexts = gem_texts(params.describeGems), trees = trees,
    companions = companions, weaponGrants = grants, movementTiers = movement_tiers() }
end

-- ---------------------------------------------------------------------------------------------------
-- compile_stage

local KIND_TAB = { item = 'itemsTab', skill = 'skillsTab', config = 'configTab' }
local KIND_ORDER = { item = 'itemSetOrderList', skill = 'skillSetOrderList', config = 'configSetOrderList' }

-- Every item set's slot selections (slot name -> item id), by set id.
local function item_selections()
  local itemsTab = build.itemsTab
  local snap = {}
  for _, id in ipairs(itemsTab.itemSetOrderList or {}) do
    local set = itemsTab.itemSets[id]
    local slots = {}
    for slotName, slot in pairs(set or {}) do
      if type(slot) == 'table' and slot.selItemId ~= nil then slots[slotName] = slot.selItemId end
    end
    snap[id] = slots
  end
  return snap
end

-- Put back every item set but `keepId` as `snap` recorded it: PoB checks the active item set's off-hand
-- against the last calculation's passives, so a set may have lost an item while another stage's tree was
-- in place. Those sets are inactive here, so their slot records are written directly.
local function restore_item_sets(snap, keepId)
  for id, slots in pairs(snap) do
    local set = id ~= keepId and build.itemsTab.itemSets[id] or nil
    if set then
      for slotName, sel in pairs(slots) do
        if set[slotName] and set[slotName].selItemId ~= sel then set[slotName].selItemId = sel end
      end
    end
  end
end

-- What an item set holds in each of `slotNames`: {id, name} (id 0 and an empty name for an empty slot).
local function set_items(set, slotNames)
  local out = {}
  for _, slotName in ipairs(slotNames) do
    local sel = set and set[slotName] and set[slotName].selItemId or 0
    local item = sel ~= 0 and build.itemsTab.items[sel] or nil
    out[slotName] = { id = item and sel or 0, name = item and tostring(item.name) or '' }
  end
  return out
end

-- The weapon-fit flags of the last calculation, from its tree and items (mainEnv.modDB, as the slot check
-- reads them), not only the tree's (CalcSetup's lastWeaponFlagState).
local function weapon_flags()
  local env = build.calcsTab.mainEnv
  local db = env and env.modDB
  local function flag(name) return db ~= nil and db:Flag(nil, name) == true end
  return { giantsBlood = flag('GiantsBlood'), instrumentsOfPower = flag('InstrumentsOfPower'),
    lordOfTheWilds = flag('LordOfTheWilds') }
end

-- The off-hand slots, in order (OFF_HAND above is the same set as a lookup).
local OFF_HAND_SLOTS = { 'Weapon 2', 'Weapon 2 Swap' }

-- D-426 (§24.2): the slot a plan group on weapon set n is socketed in by default: the set's main hand, whose slot control PoB
-- tags with that set (ItemsTab: `Weapon 1` weaponSet 1, `Weapon 1 Swap` weaponSet 2, Classes/ItemsTab.lua:226-236),
-- so the group is enabled only while that set is active (Modules/CalcSetup.lua:1728-1729). Its label in PoB's
-- "Socketed in" list is `Weapon 1` and `Weapon 1 (Swap)` (Classes/SkillsTab.lua:13-17).
local WEAPON_SET_SLOT = { [1] = 'Weapon 1', [2] = 'Weapon 1 Swap' }

-- Select or create the stage's set of one type: `ref.reuse` (an id an earlier stage created) is selected;
-- otherwise the first stage retitles the build's first set and every other stage creates one. Returns
-- the set id, and whether its content has to go in.
local function stage_set(setType, ref, first, extra)
  ref = ref or {}
  if ref.reuse ~= nil then
    local res = sets({ setType = setType, action = 'select', id = tonumber(ref.reuse) }, setType .. ' set ' .. tostring(ref.reuse))
    return res.targetId, false
  end
  local params = { setType = setType, title = ref.title }
  for k, v in pairs(extra or {}) do params[k] = v end
  if first then
    local tab = build[KIND_TAB[setType]]
    params.action = 'rename'
    params.id = tab[KIND_ORDER[setType]][1]
    local res = sets(params, 'retitling ' .. setType .. ' set ' .. tostring(params.id))
    sets({ setType = setType, action = 'select', id = res.targetId }, 'selecting ' .. setType .. ' set ' .. tostring(res.targetId))
    return res.targetId, true
  end
  params.action = 'create'
  local res = sets(params, 'creating ' .. setType .. ' set "' .. tostring(ref.title) .. '"')
  sets({ setType = setType, action = 'select', id = res.targetId }, 'selecting ' .. setType .. ' set ' .. tostring(res.targetId))
  return res.targetId, true
end

-- Weapon-set tags and attribute choices as set_tree takes them: node id (as a string key) -> value.
local function tree_state(st)
  local weaponSets, choices = {}, {}
  for set, name in ipairs(SET_NAMES) do
    for _, id in ipairs(list(st.weaponSets and st.weaponSets[name])) do weaponSets[tostring(id)] = set end
  end
  for _, c in ipairs(list(st.attributeChoices)) do choices[tostring(c.node)] = c.attribute end
  return weaponSets, choices
end

local function build_tree(st)
  local treeTab = build.treeTab
  local specId
  if st.first then
    specId = 1
    must('retitling tree spec 1', BuildOps.rename_spec({ index = 1, title = st.title }))
    if treeTab.activeSpec ~= 1 then must('selecting tree spec 1', BuildOps.select_spec({ index = 1 })) end
  else
    specId = must('creating the tree spec', BuildOps.create_spec({ title = st.title, activate = true })).index
  end
  local spec = build.spec
  local nodes = {}
  for _, id in ipairs(list(st.nodes)) do nodes[#nodes + 1] = id end
  for _, id in ipairs(list(st.ascendancyNodes)) do nodes[#nodes + 1] = id end
  local weaponSets, choices = tree_state(st)
  -- B3 (amendment 12 §15): the tree jewels go in first, into the new spec's sockets (the slot writes spec.jewels), so
  -- the import keeps the nodes a radius jewel frees: PoB prunes an unconnected node unless a jewel already socketed
  -- holds it (Classes/PassiveSpec.lua:1870-1910), and set_tree's dry run reads the spec's jewels.
  local socketed, listed = {}, {}
  for _, j in ipairs(list(st.jewels)) do
    local res = must('socketing the tree jewel on node ' .. tostring(j.node),
      BuildOps.add_item_text({ text = j.text, slotName = 'Jewel ' .. tostring(j.node) }))
    socketed[#socketed + 1] = { node = j.node, item = build.itemsTab.items[res.id] }
  end
  -- A socket a jewel grants (Voices' Sinister sockets) isn't imported: PoB allocates it itself, as a free node, at the
  -- next calculation (granted_sockets), and would prune it from the import as unconnected.
  for _, id in ipairs(nodes) do listed[id] = true end
  local granted = granted_sockets(spec.tree, socketed, function(id) return listed[id] == true end)
  local imported = {}
  for _, id in ipairs(nodes) do
    if granted[id] == nil then imported[#imported + 1] = id end
  end
  must('importing the tree', BuildOps.set_tree({
    classId = spec.curClassId, ascendClassId = spec.curAscendClassId,
    secondaryAscendClassId = spec.curSecondaryAscendClassId or 0, nodes = imported, treeVersion = spec.treeVersion,
    weaponSets = weaponSets, attributeChoices = choices,
  }))
  return specId
end

-- D-464 (amendment 13 §5): a pinned weapon. The Swap slot `slot` gets the item `added` holds for its set-1 slot `sameAs`
-- (PoB's itemSet[slot].selItemId, through the slot control as add_item_text selects one), so the item set, and the saved
-- file, hold one item in both weapon sets; it must fit the Swap slot as add_item_text checks a named slot.
local function pin(slot, sameAs, added)
  local shared = added[sameAs]
  local item = shared and build.itemsTab.items[shared.id]
  if not item then fail(('the item in %s: %s holds no item for it to share (sameAs)'):format(slot, sameAs)) end
  local ctrl = build.itemsTab.slots[slot]
  if not ctrl then fail('unknown item slot: ' .. slot) end
  if type(build.itemsTab.IsItemValidForSlot) == 'function' and not build.itemsTab:IsItemValidForSlot(item, slot) then
    fail(('the item in %s: %s, shared with %s, is not valid for slot %s'):format(slot, tostring(item.name), sameAs, slot))
  end
  ctrl:SetSelItemId(shared.id)
  build.itemsTab:PopulateSlots()
  added[slot] = { id = shared.id, name = shared.name }
end

-- Equip the stage's items whose slot `pick` accepts, recording each one's id and name in `added`. D-464: an entry with
-- `sameAs` shares that slot's item (pin), which comes before it in PoB's slot order.
local function equip(st, added, pick)
  for _, it in ipairs(list(st.items)) do
    if pick(tostring(it.slot)) then
      if it.sameAs ~= nil then
        pin(tostring(it.slot), tostring(it.sameAs), added)
      else
        local res = must('equipping the item in ' .. tostring(it.slot),
          BuildOps.add_item_text({ text = anointed_text(st, it), slotName = it.slot }))
        added[tostring(it.slot)] = { id = res.id, name = tostring(res.name) }
      end
    end
  end
end

-- Select or create the stage's item set; a new one gets every item but the off-hands, and the toggles.
local function build_items(st)
  local id, fresh = stage_set('item', st.itemSet, st.first, { useSecondWeaponSet = st.useSecondWeaponSet == true })
  local skipped, added = {}, {}
  if fresh then
    equip(st, added, function(slot) return not OFF_HAND[slot] end)
    local itemsTab = build.itemsTab
    for _, t in ipairs(list(st.toggles)) do
      local slot = itemsTab.slots[t.slot]
      if slot and (slot.selItemId or 0) ~= 0 then
        must('setting the toggle of ' .. tostring(t.slot), BuildOps.set_flask_active({ slot = t.slot, active = t.active == true }))
      else
        skipped[#skipped + 1] = tostring(t.slot)
      end
    end
  end
  return id, fresh, skipped, added
end

-- Whether the stage equips an off-hand.
local function plans_off_hand(st)
  for _, it in ipairs(list(st.items)) do
    if OFF_HAND[tostring(it.slot)] then return true end
  end
  return false
end

-- D-402 (WU-87): the stage's companion is its beast, `st.companion.id` (a monster id compile_check resolved), or nil.
local function companion_id(st)
  return type(st.companion) == 'table' and st.companion.id ~= nil and tostring(st.companion.id) or nil
end

-- D-402: the companion's monster joins the build's beast library (PoB saves it as <BeastCompanion id>,
-- Modules/Build.lua:1166-1167), whose entries each companion gem picks from by its skillMinion.
local function add_to_beast_library(id)
  build.beastList = build.beastList or {}
  for _, have in ipairs(build.beastList) do
    if have == id then return end
  end
  build.beastList[#build.beastList + 1] = id
end

-- A new skill set gets every group with the Full DPS flag and Count it is given (D-293, D-337); a reused set
-- already holds them, as it holds its groups. The set is the stage's own (stage_set ran before the stage's first
-- calculation, D-382), so it may already hold PoB's own groups.
-- D-402: with a companion, the stage's Tame Beast gem goes in as PoB's companion gem, as the game turns the gem when
-- it captures the beast, with the beast as its minion (skillMinion, which CalcActiveSkill picks from the beast library,
-- Modules/CalcActiveSkill.lua:904-929).
-- D-426 (§24.2): a group with a `weaponSet` is socketed in one of that set's weapon slots, which PoB enables only while
-- its set is active (Modules/CalcSetup.lua:1728-1729): `slot`, the compiler's pick of the set's slots (the one whose item
-- grants no skill, PG-74), else the set's main hand (WEAPON_SET_SLOT); a group without one gets no slot, as before.
local function build_skills(st, fresh)
  if not fresh then return end
  local beast = companion_id(st)
  for gi, group in ipairs(list(st.groups)) do
    local weaponSet = tonumber(group.weaponSet)
    local slot = weaponSet ~= nil and (group.slot or WEAPON_SET_SLOT[weaponSet]) or nil
    local tagged = slot ~= nil and WEAPON_SLOT[slot] and build.itemsTab.slots[slot]
    if weaponSet ~= nil and not (tagged and tagged.weaponSet == weaponSet) then
      fail(('group %d: weapon set %s has no weapon slot %s'):format(gi, tostring(group.weaponSet), tostring(slot)))
    end
    local created = must('creating socket group ' .. gi, BuildOps.create_socket_group({
      label = group.label, enabled = group.enabled ~= false, includeInFullDPS = group.includeInFullDPS == true,
      groupCount = group.groupCount, slot = slot,
    }))
    for _, gem in ipairs(list(group.gems)) do
      local captured = beast ~= nil and is_companion_gem(BuildOps.resolve_gem(gem.name))
      local added = must(('adding gem "%s" to group %d'):format(tostring(gem.name), gi), BuildOps.add_gem({
        groupIndex = created.index, gemName = captured and COMPANION_GEM or gem.name, level = gem.level,
        quality = gem.quality, enabled = gem.enabled ~= false,
      }))
      -- D-471 (amendment 13 §12): a corrupted skill gem gets PoB's corruption state (BuildOps' CORRUPT_STATES, as PoB's
      -- dropdown sets it), so PoB calculates it at its level plus the corruption's (Modules/CalcSetup.lua:1884-1885) and
      -- adds GemCorruptionLevel (Modules/CalcActiveSkill.lua:770-772). A support gem PoB doesn't corrupt: V1's
      -- `corruption` reports it.
      if gem.corrupt ~= nil and not added.support then
        must(('corrupting gem "%s" in group %d'):format(tostring(gem.name), gi), BuildOps.set_gem_corruption({
          state = tostring(gem.corrupt), groupIndex = created.index, gemIndex = added.gemIndex,
        }))
      end
      if captured then
        local set = build.skillsTab.skillSets[build.skillsTab.activeSkillSetId or 1]
        local instance = set.socketGroupList[created.index].gemList[added.gemIndex]
        instance.skillMinion = beast
        instance.skillMinionCalcs = beast
      end
    end
  end
end

-- D-382: the plan's groups in the active skill set are its groups without a `source`, in order. PoB's own groups
-- (a skill the tree or an item grants, Thorns, monster explosions) have one, and a MAIN-mode calculation adds them
-- at the end of the list and removes stale ones (vendor Modules/CalcSetup.lua:1501-1663), so they come before the
-- plan's groups when a calculation runs before those are built. Returns PoB's index of each plan group, and each
-- PoB group's number in the reply: the plan's groups first, in plan order, then PoB's own, in PoB's order.
local function group_indices()
  local pob, number, own = {}, {}, {}
  for i, group in ipairs(build.skillsTab.socketGroupList or {}) do
    if group.source then
      own[#own + 1] = i
    else
      pob[#pob + 1] = i
      number[i] = #pob
    end
  end
  for k, i in ipairs(own) do number[i] = #pob + k end
  return pob, number
end
-- D-435: node_power numbers its clear group the same way (NodePower.lua), so the logic lives here once.
M.group_indices = group_indices

-- D-435: the plan's groups first, in plan order, then PoB's own, in PoB's order, so each plan group's PoB index is its
-- number in the reply. A stage with an off-hand is calculated before its groups go in (the off-hand check), so a skill
-- its main hand grants (a spear's Spear Throw, which a bare base now gets, base_implicits) lands before them, and the
-- same plan group would sit at another index in a stage without an off-hand. PoB keeps one main group for the build
-- (Build.lua's mainSocketGroup, saved once), so the saved file would show another stage's loadout with the wrong main
-- skill. PoB finds its own groups by their `source`, wherever they are (Modules/CalcSetup.lua:1501-1663), so the list
-- is reordered in place.
local function plan_groups_first()
  local groups = build.skillsTab.socketGroupList
  if type(groups) ~= 'table' then return end
  local plan, own = {}, {}
  for _, group in ipairs(groups) do
    if group.source then own[#own + 1] = group else plan[#plan + 1] = group end
  end
  for i, group in ipairs(plan) do groups[i] = group end
  for k, group in ipairs(own) do groups[#plan + k] = group end
end

-- D-382: PoB's index of the plan's group `gi` in the active skill set.
local function pob_index(gi)
  local pob = group_indices()
  local i = pob[tonumber(gi)]
  if i == nil then
    fail(('the active skill set holds %d of the plan\'s groups, not group %s'):format(#pob, tostring(gi)))
  end
  return i
end

-- D-377: each group's minion skill, selected by name against its minion's live skill list once the stage's
-- groups are built (BuildOps.select_minion_skill writes PoB's own fields and rebuilds). PoB builds a disabled
-- group's skills only while it is the main group (vendor Modules/CalcSetup.lua:1987), so each group is the main
-- group for its own call; select_main then makes the stage's main selection. For the main group the stage's main
-- active skill must be the summon. Returns the selections, each with its group (the plan's number, D-382), in
-- group order.
local function select_minion_skills(st)
  local selections = {}
  local main = st.main or {}
  for gi, group in ipairs(list(st.groups)) do
    if group.minionSkill ~= nil then
      local index = pob_index(gi)
      build.mainSocketGroup = index
      build.calcsTab.input.skill_number = index
      local sel, err = BuildOps.select_minion_skill({
        groupIndex = index, name = group.minionSkill, statSet = group.minionStatSet,
        activeSkill = tonumber(main.group) == gi and main.activeSkill or nil,
      })
      if not sel then fail(('skills.groups[%d].minionSkill: %s'):format(gi - 1, tostring(err))) end
      sel.group = gi
      selections[#selections + 1] = sel
    end
  end
  return selections
end

local function select_main(st)
  local main = st.main or {}
  local index = pob_index(main.group)
  must('setting the main skill', BuildOps.set_main_selection({
    mainSocketGroup = index, mainActiveSkill = main.activeSkill, statSet = main.statSet,
  }))
  local g = build.skillsTab.socketGroupList[index]
  local count = g and g.displaySkillList and #g.displaySkillList or 0
  if tonumber(main.activeSkill) > count then
    fail(('the main active skill %s is outside group %s\'s %d active skills'):format(tostring(main.activeSkill),
      tostring(main.group), count))
  end
end

-- PoB's text option that holds custom modifiers, one per line (Modules/ConfigOptions.lua:2279).
local CUSTOM_MODS = 'customMods'

-- The stage's custom modifier lines as PoB's customMods text: one line per entry, in order; nil for none. D-469
-- (schema 9): each line follows its reason's comment line (`st.customModReasons`, comment_line), which PoB skips.
local function custom_mods_text(st)
  local lines = {}
  local reasons = list(st.customModReasons)
  for i, line in ipairs(list(st.customMods)) do
    local comment = comment_line(reasons[i])
    if comment then lines[#lines + 1] = comment end
    lines[#lines + 1] = tostring(line)
  end
  if #lines == 0 then return nil end
  return table.concat(lines, '\n')
end

-- A new config set gets the listed options, then the custom modifier lines (D-293) in a write of their own.
local function build_config(st)
  local id, fresh = stage_set('config', st.configSet, st.first)
  if fresh and type(st.config) == 'table' and next(st.config) ~= nil then
    must('writing the config options', BuildOps.set_config(st.config))
  end
  local custom = custom_mods_text(st)
  if fresh and custom ~= nil then
    must('writing the custom modifiers', BuildOps.set_config({ [CUSTOM_MODS] = custom }))
  end
  return id
end

-- Whether the last calculation's main skill stacks its damage over time (D-293): PoB's DotCanStack, which
-- CalcOffence sets on that skill's stat-set flags (MAIN mode: activeEffect.statSet.skillFlags,
-- Modules/CalcOffence.lua:390-394, 5964-5965) and calcFullDPS reads (Modules/Calcs.lua:367).
local function main_dot_can_stack()
  local env = build.calcsTab.mainEnv
  local skill = env and env.player and env.player.mainSkill
  local statSet = skill and skill.activeEffect and skill.activeEffect.statSet
  return statSet ~= nil and type(statSet.skillFlags) == 'table' and statSet.skillFlags.DotCanStack == true
end

-- PoB's skill type names by id (the global SkillType, Data/Global.lua), for a skill's live `skillTypes`.
local skillTypeNames = nil
local function skill_type_names()
  if skillTypeNames == nil then
    skillTypeNames = {}
    for name, id in pairs(type(SkillType) == 'table' and SkillType or {}) do skillTypeNames[id] = tostring(name) end
  end
  return skillTypeNames
end

-- The damaging ailments PoB caps at one per enemy unless the skill has `<Ailment>CanStack` (each stacks to 1 by
-- default, Modules/CalcSetup.lua:53-55; Modules/CalcOffence.lua:5065 sets the stat set's `<ailment>CanStack` flag).
local AILMENTS = { 'ignite', 'bleed', 'poison' }

-- WU-111 (amendment 11 §5, §9b): what the record's measures read of a measured skill beside its fields: its live skill
-- types by name (the types its supports add included), PoB's own trigger test (`isTriggered`, a global of
-- Modules/CalcTriggers.lua:40-41: a triggered skill type or flag, an inbuilt trigger, an item's trigger), the meta gem
-- whose support triggers it (`activeSkill.triggeredBy`, set by a support with `isTrigger`,
-- Modules/CalcActiveSkill.lua:747-755; nil for an inbuilt or item trigger), and whether its damage over time and each
-- damaging ailment stack (its stat set's flags, MAIN mode). A minion's ailments are its own skill's.
local function skill_meta(skill)
  local statSet = skill.activeEffect and skill.activeEffect.statSet
  local flags = statSet and type(statSet.skillFlags) == 'table' and statSet.skillFlags or {}
  local minionSkill = skill.minion and skill.minion.mainSkill
  local minionSet = minionSkill and minionSkill.activeEffect and minionSkill.activeEffect.statSet
  local ailmentFlags = minionSet and type(minionSet.skillFlags) == 'table' and minionSet.skillFlags or flags
  local names = skill_type_names()
  local types = {}
  for id, on in pairs(skill.skillTypes or {}) do
    if on and names[id] then types[#types + 1] = names[id] end
  end
  table.sort(types)
  local triggered = type(isTriggered) == 'function' and isTriggered(skill) and true or false
  local by = nil
  local source = triggered and skill.triggeredBy or nil
  if source then
    local gem = source.gemData or (source.srcInstance and source.srcInstance.gemData)
    by = (gem and gem.name) or (source.srcInstance and source.srcInstance.nameSpec) or (source.grantedEffect and source.grantedEffect.name)
    by = by ~= nil and tostring(by) or nil
  end
  local stacks = { dot = flags.DotCanStack == true }
  for _, ailment in ipairs(AILMENTS) do stacks[ailment] = ailmentFlags[ailment .. 'CanStack'] == true end
  return { types = types, triggered = triggered, triggeredBy = by, stacks = stacks }
end

-- C-45's breakdown of every socket group: g<group>s<skill>p<statSet> -> {skill, statSetLabel, fields}; and,
-- under the same keys, whether each skill and stat set's damage over time stacks (D-293). stats_breakdown
-- measures each one as the main selection through BuildOps.get_main_output, so while it runs that function
-- is wrapped to read the flag after each of its rebuilds; the wrapper is removed however the breakdown ends.
-- <group> is the group's number in the reply (D-382: the plan's groups first), not its index in PoB's list.
-- D-427 (§24.2): the third value lists each measured active skill whose granted effect has PoB's Travel skill type
-- (SkillType.Travel, Data/Global.lua), in an enabled group: {group, activeSkill, skill}, for the clear measure's
-- `travel`. WU-111: the fourth is each measured key's `skill_meta`, read in the same wrapper; with `only` (a set of
-- the reply's group numbers), only those groups are measured.
local function skill_outputs(fields, only)
  local out, stacks, travel, meta = {}, {}, {}, {}
  local data = build.data or _G.data
  local travelType = type(SkillType) == 'table' and SkillType.Travel or nil
  local own = BuildOps.get_main_output
  BuildOps.get_main_output = function(...)
    local output, err = own(...)
    local _, number = group_indices()
    local gi = build.mainSocketGroup
    local group = build.skillsTab.socketGroupList[gi]
    local env = build.calcsTab.mainEnv
    local skill = env and env.player and env.player.mainSkill
    local statSet = skill and skill.activeEffect and skill.activeEffect.statSet
    if group and number[gi] and statSet and skill.socketGroup == group then
      local key = ('g%ds%dp%d'):format(number[gi], group.mainActiveSkill or 1, statSet.index or 1)
      stacks[key] = main_dot_can_stack()
      meta[key] = skill_meta(skill)
    end
    return output, err
  end
  local ok, err = pcall(function()
    for gi = 1, #(build.skillsTab.socketGroupList or {}) do
      local _, number = group_indices()
      if only == nil or only[number[gi]] then
        local res = must('measuring socket group ' .. tostring(number[gi]), BuildOps.stats_breakdown({ groupIndex = gi, fields = fields }))
        local group = build.skillsTab.socketGroupList[gi]
        for _, skill in ipairs(res.skills or {}) do
          for _, set in ipairs(skill.statSets or {}) do
            local numbers = {}
            for k, v in pairs(set.output or {}) do
              if finite(v) then numbers[k] = v end
            end
            out[('g%ds%dp%d'):format(number[gi], skill.index, set.index)] = {
              skill = tostring(skill.name), statSetLabel = tostring(set.label or ''), fields = numbers,
            }
          end
          local ge = data and data.skills and data.skills[skill.grantedEffectId]
          if travelType ~= nil and group and group.enabled ~= false and type(ge) == 'table' and type(ge.skillTypes) == 'table'
              and ge.skillTypes[travelType] then
            travel[#travel + 1] = { group = number[gi], activeSkill = skill.index, skill = tostring(skill.name) }
          end
        end
      end
    end
  end)
  BuildOps.get_main_output = own
  if not ok then error(err, 0) end
  -- Only the measured keys: the wrapper also saw the rebuilds that put the stage's own selection back.
  local measured, metas = {}, {}
  for key in pairs(out) do
    measured[key] = stacks[key] == true
    if meta[key] ~= nil then metas[key] = meta[key] end
  end
  return out, measured, travel, metas
end

local function allocation()
  local spec = build.spec
  local nodes = {}
  for id, node in pairs(spec.allocNodes or {}) do
    nodes[#nodes + 1] = { id = id, mode = node.allocMode or 0 }
  end
  table.sort(nodes, function(a, b) return a.id < b.id end)
  local starts = {}
  local class = spec.tree.classes[spec.curClassId]
  if class and class.startNodeId then starts[#starts + 1] = class.startNodeId end
  local entry = spec.curAscendClassName and spec.tree.ascendNameMap and spec.tree.ascendNameMap[spec.curAscendClassName]
  if entry and entry.ascendClass and entry.ascendClass.startNodeId then starts[#starts + 1] = entry.ascendClass.startNodeId end
  return { nodes = nodes, startNodes = starts }
end

-- A full output rebuild on an empty global skill cache, as PoB's frame loop does after a change.
local function rebuild()
  if wipeGlobalCache then wipeGlobalCache() end
  build.buildFlag = true
  return BuildOps.get_main_output()
end

-- Run `fn` with PoB's output rebuild skipped (each BuildOps mutation ends in one), unless `defer` is false.
-- The calcs tab's own BuildOutput is put back however `fn` ends.
local function deferring(defer, fn)
  if not defer then return fn() end
  local ct = build.calcsTab
  local own = rawget(ct, 'BuildOutput')
  ct.BuildOutput = function() end
  local ok, a, b = pcall(fn)
  ct.BuildOutput = own
  if not ok then error(a, 0) end
  return a, b
end

-- The active item set's off-hands, checked against the tree and items it is used with: they are put back
-- as `before` recorded them (selecting the set checked them against the previous calculation, which may
-- have lacked a flag), the build is calculated with every item in place, and PoB's own slot check runs.
local function settle_off_hands(setId, before)
  local itemsTab = build.itemsTab
  local saved = before[setId] or {}
  local any = false
  for _, slotName in ipairs(OFF_HAND_SLOTS) do
    local sel = saved[slotName]
    if sel ~= nil and sel ~= 0 then
      any = true
      local slot = itemsTab.slots[slotName]
      if slot and slot.selItemId ~= sel then slot:SetSelItemId(sel) end
    end
  end
  if not any then return end
  itemsTab.lastWeaponFlagState = nil
  rebuild()
  itemsTab:PopulateSlots()
end

-- Each config option's value in a new config set, as PoB fills one (ConfigTab:CreateConfigSet: the list's
-- default entry, else defaultState), which is also what a reload gives an option the save left out.
local freshDefaultsCache
local function fresh_defaults()
  if freshDefaultsCache then return freshDefaultsCache end
  local ok, varList = pcall(LoadModule, 'Modules/ConfigOptions')
  if not ok or type(varList) ~= 'table' then fail('could not load the config option list') end
  local out = {}
  for _, v in ipairs(varList) do
    if v.var and out[v.var] == nil then
      local d = v.defaultState
      if v.defaultIndex and v.list and v.list[v.defaultIndex] then d = v.list[v.defaultIndex].val end
      out[v.var] = { value = d }
    end
  end
  freshDefaultsCache = out
  return out
end

-- Whether a reload gives `option` the same value if PoB's save leaves it out of config set `cs` (D-248):
-- the new set's default is that value, or there is no default and no placeholder takes its place.
local function survives_drop(cs, option, value)
  local entry = fresh_defaults()[option]
  local def = entry and entry.value
  if def ~= nil then return def == value end
  if cs.placeholder[option] ~= nil then return false end
  return value == false or value == 0 or value == ''
end

-- ---------------------------------------------------------------------------------------------------
-- compile_stage's V1 and V2 inputs (WU-42)

local ATTRIBUTES = { 'Str', 'Dex', 'Int' }
local ATTRIBUTE_NAMES = { Str = 'Strength', Dex = 'Dexterity', Int = 'Intelligence' }

-- The item or gem a requirement comes from (CalcPerform's Req<attr>Item), as PoB's warning names it.
local function requirement_source(attr, req)
  if type(req) ~= 'table' then return nil end
  if req.source == 'Item' and req.sourceItem then
    return { source = 'item', name = tostring(req.sourceItem.name) }
  elseif req.source == 'Gem' and req.sourceGem then
    return { source = 'gem', name = tostring(req.sourceGem.nameSpec or (req.sourceGem.gemData and req.sourceGem.gemData.name)) }
  elseif req.source == 'Support Gems' then
    return { source = 'support gems', name = 'your total ' .. ATTRIBUTE_NAMES[attr] .. ' support gems' }
  end
  return nil
end

-- A gem's kind for V1: support, spirit (it reserves Spirit: a persistent skill, or one whose level reserves
-- Spirit), or skill.
local function gem_kind(gem, grantedEffect, level)
  if (grantedEffect and grantedEffect.support) or (gem.gemData and gem.gemData.gemType == 'Support') then return 'support' end
  local lv = grantedEffect and grantedEffect.levels and grantedEffect.levels[level]
  local tags = gem.gemData and gem.gemData.tags
  if (lv and (lv.spiritReservationFlat or lv.spiritReservationPercent)) or (tags and tags.persistent) then return 'spirit' end
  return 'skill'
end

-- D-455 (amendment 12 §10): the stats that stop a skill's debuff on a target above a level, in the order they're
-- read, with the debuff each one caps. A per-level stat (Despair's curse: 72 at gem level 14, 78 at 17, 0 from 18,
-- Data/Skills/act_int.lua:5282-5310); PoB's calculation reads none of them (PG-86).
local LEVEL_CAP_STATS = {
  { stat = 'skill_curses_cannot_apply_to_targets_above_level', of = 'curse' },
  { stat = 'frost_bomb_exposure_does_not_apply_to_enemies_of_level_higher_than_X', of = 'exposure' },
  { stat = 'thunderstorm_wet_debuff_cannot_apply_to_targets_above_level', of = 'wet' },
}

-- D-455: the level the last calculation computed each gem's skill at, by gem instance: its active effect's level, the
-- socketed level with the gem-level modifiers of the build's gear and passives applied (Modules/CalcSetup.lua:1876-1890,
-- applyGemMods), the level its stats are read at (Modules/CalcActiveSkill.lua:557). A gem PoB doesn't calculate (a
-- disabled one) has none.
local function calculated_levels()
  local out = {}
  local env = build.calcsTab and build.calcsTab.mainEnv
  for _, skill in ipairs(env and env.player and env.player.activeSkillList or {}) do
    local e = skill.activeEffect
    if e and e.srcInstance and tonumber(e.level) and out[e.srcInstance] == nil then out[e.srcInstance] = tonumber(e.level) end
  end
  return out
end

-- D-455: a gem's level cap at `level`, {cap, of, level}: the first LEVEL_CAP_STATS stat a stat set of its granted
-- effects carries, read as PoB's calculation reads a stat set (calcLib.buildSkillInstanceStats); nil when it carries
-- none. A cap of 0 means none (Despair from gem level 18).
local function level_cap(gemData, level)
  if type(gemData) ~= 'table' then return nil end
  for _, cap in ipairs(LEVEL_CAP_STATS) do
    for _, effect in ipairs(Lookup.gemEffects(gemData)) do
      for _, statSet in ipairs(effect.statSets or {}) do
        for _, stat in ipairs(statSet.stats or {}) do
          if stat == cap.stat then
            local stats = calcLib.buildSkillInstanceStats({ level = level, quality = 0 }, effect, statSet)
            return { cap = tonumber(stats[cap.stat]) or 0, of = cap.of, level = level }
          end
        end
      end
    end
  end
  return nil
end

-- Every gem of the active skill set's plan groups (PoB's own groups, which have a `source`, left out): its group
-- (the plan's number, D-382) and index, name, level, tier, kind and level requirement at its level. D-402: a captured
-- Tame Beast, PoB's companion gem (its own Tier 0), has the Tame Beast gem's tier: the gem the player cuts and levels
-- is Tame Beast, so V1's tier floor still applies to it. D-455 (amendment 12 §10): `curseCap`, the gem's debuff level
-- cap (level_cap) at the level the calculation uses (calculated_levels; the socketed level for a gem it doesn't
-- calculate), absent when the gem has no such stat.
local function stage_gems()
  local out = {}
  local pob = group_indices()
  local d = (build and build.data) or data
  local tameBeast = d.gems and d.gems[TAME_BEAST_GEM]
  local calculated = calculated_levels()
  for gi, index in ipairs(pob) do
    for k, gem in ipairs(build.skillsTab.socketGroupList[index].gemList or {}) do
      local gemData = gem.gemData
      local ge = gem.grantedEffect or (gemData and gemData.grantedEffect)
      local level = tonumber(gem.level) or 1
      local lv = ge and ge.levels and ge.levels[level]
      local tierOf = (gemData and gemData.grantedEffectId == COMPANION and tameBeast) or gemData
      out[#out + 1] = {
        group = gi, index = k,
        name = tostring(gem.nameSpec or (gemData and gemData.name) or ''),
        level = level,
        tier = tierOf and tonumber(tierOf.Tier) or nil,
        kind = gem_kind(gem, ge, level),
        levelRequirement = tonumber(gem.reqLevel) or (lv and tonumber(lv.levelRequirement)) or 0,
        curseCap = level_cap(gemData, calculated[gem] or level),
      }
    end
  end
  return out
end

local function is_activatable(slotName)
  return slotName:match('^Flask %d+$') ~= nil or slotName:match('^Charm %d+$') ~= nil
end

-- WU-111 (amendment 11 §8, D-440): an item's movement speed as PoB parses it, the sum of its unconditional
-- `MovementSpeed` INC modifiers (an "N% increased Movement Speed" line, a range at the roll PoB gives it); a
-- conditional one ("while on full life") isn't counted.
local function item_movement_speed(item)
  local total = 0
  for _, mod in ipairs(item.modList or {}) do
    if mod.name == 'MovementSpeed' and mod.type == 'INC' and mod[1] == nil and finite(mod.value) then total = total + mod.value end
  end
  return total
end

-- Every item equipped in `slotNames` of the active item set: its slot, names, level requirement, and for
-- a flask or charm its toggle (the slot control's `active`, which the calcs read). WU-111 (D-440): its rarity (PoB's
-- `rarity`, `UNIQUE` for a unique) and its movement speed (item_movement_speed), for V1's `movement-tier`.
local function stage_items(slotNames)
  local itemsTab = build.itemsTab
  local out = {}
  for _, slotName in ipairs(slotNames) do
    local slot = itemsTab.slots[slotName]
    local sel = slot and slot.selItemId or 0
    local item = sel ~= 0 and itemsTab.items[sel] or nil
    if item then
      out[#out + 1] = {
        slot = slotName, name = tostring(item.name or ''), title = item.title and tostring(item.title) or nil,
        baseName = tostring(item.baseName or ''),
        levelRequirement = item.requirements and tonumber(item.requirements.level) or 0,
        active = is_activatable(slotName) and slot.active == true or nil,
        rarity = item.rarity and tostring(item.rarity) or nil,
        movementSpeed = item_movement_speed(item),
      }
    end
  end
  return out
end

-- A config set's table of scalar values (option -> value).
local function scalars(t)
  local out = {}
  for k, v in pairs(t or {}) do
    if type(k) == 'string' and scalar(v) ~= nil then out[k] = v end
  end
  return out
end

-- D-380: the tree's passives by the skill their line grants, "Grants Skill: <name>" (lowercased name -> {id, name}
-- sorted by id). PoB parses such a line for a gem's skill only (the summon, node 32705), never for a minion's
-- command (node 10561, spike A4), so the line itself is read. Cached per tree.
local grantingCache = setmetatable({}, { __mode = 'k' })
local function granting_index(tree)
  if type(tree) ~= 'table' then return {} end
  if grantingCache[tree] then return grantingCache[tree] end
  local index = {}
  for id, node in pairs(tree.nodes or {}) do
    for _, line in ipairs(type(node) == 'table' and node.sd or {}) do
      local name = type(line) == 'string' and line:gsub('%s+', ' '):match('^%s*[Gg]rants [Ss]kill: (.-)%s*$')
      if name and name ~= '' then
        local key = name:lower()
        index[key] = index[key] or {}
        table.insert(index[key], { id = tonumber(id), name = tostring(node.dn or node.name or id) })
      end
    end
  end
  for _, nodes in pairs(index) do table.sort(nodes, function(a, b) return a.id < b.id end) end
  grantingCache[tree] = index
  return index
end

-- D-380: each of the stage's groups whose skill gem a passive grants, or whose minionSkill one does, with the
-- granting passives and whether the stage allocates any of them. The gems are the compiled ones, read from each
-- plan group at its PoB index (D-382); PoB's own groups, which have a `source`, are left out.
local function granted_skills(st)
  local spec = build.spec
  local index = granting_index(spec and spec.tree)
  local out = {}
  local function add(gi, kind, name)
    local nodes = index[tostring(name):lower()]
    if not nodes then return end
    local allocated = false
    for _, n in ipairs(nodes) do
      if spec.allocNodes[n.id] then allocated = true end
    end
    out[#out + 1] = { group = gi, kind = kind, name = tostring(name), nodes = nodes, allocated = allocated }
  end
  local socketGroups = build.skillsTab.socketGroupList or {}
  local pob = group_indices()
  for gi, group in ipairs(list(st.groups)) do
    local g = pob[gi] and socketGroups[pob[gi]]
    for _, gem in ipairs(g and g.gemList or {}) do
      local gemData = gem.gemData
      if gemData and gemData.grantedEffect and not gemData.grantedEffect.support then add(gi, 'gem', gemData.name) end
    end
    if group.minionSkill ~= nil then add(gi, 'minionSkill', group.minionSkill) end
  end
  return out
end

-- The V1 and V2 inputs, read after the stage's measurement (`output` is its main output). PoB's warning
-- lines come from get_warnings with the rebuild it starts skipped when `defer` is on: the build was just
-- rebuilt.
local function stage_checks(st, output, configSetId, defer)
  local spec = build.spec
  local used, ascUsed, secondaryAscUsed, sockets, ws1, ws2 = spec:CountAllocNodes()
  local attributes, sources = {}, {}
  for _, attr in ipairs(ATTRIBUTES) do
    attributes[attr] = finite(output[attr]) and output[attr] or 0
    attributes['Req' .. attr] = finite(output['Req' .. attr]) and output['Req' .. attr] or 0
    sources[attr] = requirement_source(attr, output['Req' .. attr .. 'Item'])
  end
  local slotNames = {}
  for _, s in ipairs(list(st.itemSlots)) do slotNames[#slotNames + 1] = s end
  for _, j in ipairs(list(st.jewels)) do slotNames[#slotNames + 1] = 'Jewel ' .. tostring(j.node) end
  local warnings = must('reading PoB\'s warnings', deferring(defer, function() return BuildOps.get_warnings() end))
  local nodeNames = {}
  for _, node in pairs(spec.allocNodes or {}) do
    if node.type ~= 'ClassStart' and node.type ~= 'AscendClassStart' and node.dn then nodeNames[#nodeNames + 1] = tostring(node.dn) end
  end
  -- A notable an item grants (the anoint, D-358) is allocated in the calculation, not on the tree.
  local env = build.calcsTab and build.calcsTab.mainEnv
  for id in pairs(env and env.grantedPassives or {}) do
    local node = not spec.allocNodes[id] and spec.nodes[id] or nil
    if node and node.dn then nodeNames[#nodeNames + 1] = tostring(node.dn) end
  end
  table.sort(nodeNames)
  local activeSkills = {}
  for _, group in ipairs(build.skillsTab.socketGroupList or {}) do
    for _, skill in ipairs(group.displaySkillList or {}) do
      local ge = skill.activeEffect and skill.activeEffect.grantedEffect
      if ge and ge.name then activeSkills[#activeSkills + 1] = tostring(ge.name) end
    end
  end
  local cs = build.configTab.configSets[configSetId]
  -- The conditional options PoB shows for this stage (D-250): each one's ConfigTab control `shown`, which
  -- runs its gates over the measured calculation and the stage's config set (now the active one).
  local shownOptions = {}
  local controls = build.configTab.varControls or {}
  for var, entry in pairs(config_baseline()) do
    local control = entry.conditional and controls[var]
    if control then
      local shown = control.shown
      if type(shown) == 'function' then
        local okShown, value = pcall(shown)
        shown = okShown and value
      end
      if shown then shownOptions[#shownOptions + 1] = var end
    end
  end
  table.sort(shownOptions)
  return {
    counts = { used = used, ascendancy = ascUsed, secondaryAscendancy = secondaryAscUsed, sockets = sockets,
      weaponSet1 = ws1, weaponSet2 = ws2 },
    extraPoints = finite(output.ExtraPoints) and output.ExtraPoints or 0,
    passivePointsToWeaponSetPoints = finite(output.PassivePointsToWeaponSetPoints) and output.PassivePointsToWeaponSetPoints or 0,
    attributes = attributes,
    requirementSources = sources,
    gems = stage_gems(),
    items = stage_items(slotNames),
    warnings = warnings.lines or {},
    nodeNames = nodeNames,
    activeSkills = activeSkills,
    config = { input = scalars(cs and cs.input), placeholder = scalars(cs and cs.placeholder) },
    shownOptions = shownOptions,
    grantedSkills = granted_skills(st),
    implicitVariants = implicit_variants(st),
    customMods = custom_mod_names(st),
  }
end

-- D-402 (WU-87): the stage's companion as the last calculation measured it: the plan group and active skill of its
-- companion skill (the breakdown key's numbers), the beast PoB summoned, the species' Spirit percentage
-- (companionReservation, Data/Spectres.lua) and the Spirit PoB reserves for it: its reserved percentage after the
-- build's reservation modifiers and the Spirit that takes (skillData.SpiritReservedPercent and SpiritReservedBase,
-- Modules/CalcDefence.lua:203-325). Nil without a companion; a failure when PoB built no companion skill.
local function companion_measure(st)
  if companion_id(st) == nil then return nil end
  local env = build.calcsTab and build.calcsTab.mainEnv
  local _, number = group_indices()
  for i, group in ipairs(build.skillsTab.socketGroupList or {}) do
    if not group.source and number[i] then
      for k, skill in ipairs(group.displaySkillList or {}) do
        local effect = skill.activeEffect
        local ge = effect and effect.grantedEffect
        if ge and ge.id == COMPANION and skill.minion then
          local measured = skill
          for _, s in ipairs(env and env.player and env.player.activeSkillList or {}) do
            if s.activeEffect and s.activeEffect.srcInstance == effect.srcInstance and s.activeEffect.grantedEffect == ge then
              measured = s
            end
          end
          local minion = measured.minion or skill.minion
          local md = minion.minionData or {}
          local sd = measured.skillData or {}
          return {
            group = number[i], activeSkill = k,
            minion = tostring(md.name or minion.type), minionId = tostring(minion.type),
            companionReservation = tonumber(md.companionReservation) or 0,
            reservedSpirit = tonumber(sd.SpiritReservedBase) or 0,
            reservedSpiritPercent = tonumber(sd.SpiritReservedPercent) or 0,
          }
        end
      end
    end
  end
  fail('the stage names a companion, but PoB built no companion skill for its Tame Beast gem')
end

-- WU-120 (amendment 12 §4, D-449): the five damage types of PoB's `<Type>MaximumHitTaken`.
local MAX_HIT_TYPES = { 'Physical', 'Fire', 'Cold', 'Lightning', 'Chaos' }

-- WU-120 (D-449): an output's max hits: the finite `<Type>MaximumHitTaken` by field, and the types PoB makes the
-- build immune to (an infinite max hit: a part whose taken multiplier is 0, Modules/CalcDefence.lua:3683-3738),
-- lowercase, in MAX_HIT_TYPES' order. A max hit of 0 is finite and kept: it is a one-shot.
local function max_hits(output)
  local hits, immune = {}, {}
  for _, t in ipairs(MAX_HIT_TYPES) do
    local v = output[t .. 'MaximumHitTaken']
    if finite(v) then
      hits[t .. 'MaximumHitTaken'] = v
    elseif v == math.huge then
      immune[#immune + 1] = t:lower()
    end
  end
  return hits, immune
end

-- Every finite number of a main output, with the minion's own numbers flattened as Minion<Field> (D-376,
-- BuildOps.output_field; PoB's own field wins). WU-120 (D-449): the second value is the immune types (`max_hits`),
-- whose infinite max hit the map leaves out.
local function output_map(output)
  local outputs = {}
  for k, v in pairs(output) do
    if type(k) == 'string' and finite(v) then outputs[k] = v end
  end
  if type(output.Minion) == 'table' then
    for k in pairs(output.Minion) do
      if type(k) == 'string' then
        local key = 'Minion' .. k
        local v = BuildOps.output_field(output, key)
        if outputs[key] == nil and finite(v) then outputs[key] = v end
      end
    end
  end
  local _, immune = max_hits(output)
  return outputs, immune
end

-- D-426: whether the stage uses weapon set 2: passives tagged to it, an item in a Swap slot, or a skill group
-- socketed in one (PoB's own group for a Swap item's skill, or a plan group on weapon set 2, which build_skills
-- sockets in `Weapon 1 Swap`: a group follows a set only through its slot, Modules/CalcSetup.lua:1729).
local function uses_set_two(st)
  if #list(st.weaponSets and st.weaponSets.set2) > 0 then return true end
  for _, it in ipairs(list(st.items)) do
    if tostring(it.slot):match(' Swap$') then return true end
  end
  local slots = build.itemsTab.slots
  for _, group in ipairs(build.skillsTab.socketGroupList or {}) do
    local slot = group.slot and slots[group.slot]
    if slot and slot.weaponSet == 2 then return true end
  end
  return false
end

-- D-426: the stage measured with weapon set 2 active (the item set's useSecondWeaponSet, which every calculation
-- reads: Modules/CalcSetup.lua:854, :927, :1729), as output_map gives it. The flag and the last weapon-fit flags are
-- put back however it ends, so the stage's own measurement after it sees the build as it would without it; the
-- weapon-fit flags are cleared for it, so PoB's slot check doesn't unequip a set's off-hand against the other set's
-- passives (ValidateWeaponSlots runs only when a calculation loses a flag the last one had).
-- D-426 (§24.2, WU-102): the second value is every group's breakdown with set 2 active, skill_outputs' map in its
-- form and keys (`skillOutputsSet2`), so a group on either set has a figure measured on its own set. WU-111: the third
-- is that breakdown's `skill_meta` per key (`skillMetaSet2`).
local function measure_set_two(fields)
  local itemsTab = build.itemsTab
  local itemSet = itemsTab.activeItemSet
  local flags = itemsTab.lastWeaponFlagState
  itemSet.useSecondWeaponSet = true
  itemsTab.lastWeaponFlagState = nil
  local ok, outputs, skills, meta = pcall(function()
    local output, err = rebuild()
    local map = output_map(must('measuring the stage with weapon set 2 active', output, err))
    local breakdown, _, _, metas = skill_outputs(fields)
    return map, breakdown, metas
  end)
  itemSet.useSecondWeaponSet = false
  itemsTab.lastWeaponFlagState = flags
  if not ok then error(outputs, 0) end
  return outputs, skills, meta
end

-- WU-111, WU-120 (amendment 11 §9b; amendment 12 §4, §9): `fn(cs)` run with the config `options` (option -> value) set on
-- the stage's config set, every other option as it is. The options, the weapon-set flag and the weapon-fit flags are put
-- back and the build recalculated however it ends, so the saved build and every later stage are as they would be without
-- it. `what` names the measure in a failure.
local function with_config(what, options, fn)
  local ct = build.configTab
  local cs = ct.configSets[ct.activeConfigSetId]
  if not cs then fail(what .. ' needs the stage\'s config set') end
  local names, prior = {}, {}
  for option in pairs(options) do
    names[#names + 1] = option
    prior[option] = cs.input[option]
  end
  local itemsTab = build.itemsTab
  local itemSet = itemsTab.activeItemSet
  local priorSet = itemSet.useSecondWeaponSet
  local flags = itemsTab.lastWeaponFlagState
  local ok, res = pcall(function()
    for _, option in ipairs(names) do cs.input[option] = options[option] end
    ct:BuildModList()
    return fn(cs)
  end)
  itemSet.useSecondWeaponSet = priorSet
  itemsTab.lastWeaponFlagState = flags
  for _, option in ipairs(names) do cs.input[option] = prior[option] end
  ct:BuildModList()
  rebuild()
  if not ok then error(res, 0) end
  return res
end

-- WU-111 (D-447): the groups `nums` (the reply's numbers) read with `fields` as skill_outputs reads them, each on its own
-- weapon set: a group the plan puts on weapon set 2, on a stage measured on set 1, with set 2 active (after the others),
-- the others as the stage's own measure; keyed as `skillOutputs`, with each key's `skill_meta`. The caller puts the
-- weapon-set flag back (with_config).
local function measure_groups(st, nums, fields)
  local groups = list(st.groups)
  local own, two, anyTwo = {}, {}, false
  for _, g in ipairs(list(nums)) do
    local n = tonumber(g)
    local group = n and groups[n]
    if group and tonumber(group.weaponSet) == 2 and st.useSecondWeaponSet ~= true then
      two[n] = true
      anyTwo = true
    elseif n then
      own[n] = true
    end
  end
  local out, _, _, metas = skill_outputs(fields, own)
  if anyTwo then
    local itemsTab = build.itemsTab
    itemsTab.activeItemSet.useSecondWeaponSet = true
    itemsTab.lastWeaponFlagState = nil
    rebuild()
    local out2, _, _, metas2 = skill_outputs(fields, two)
    for k, v in pairs(out2) do out[k] = v end
    for k, v in pairs(metas2) do metas[k] = v end
  end
  return out, metas
end

-- WU-120 (amendment 12 §4, D-449): the chances at the Arbiter, from the last calculation (the Pinnacle pass, on the stage's
-- own weapon set): PoB's own melee evade chance (Modules/CalcDefence.lua:1447-1464, calcs.monsterHitChance at :40-46, on
-- the build's MeleeEvasion, its EvadeChance base, the enemy's HitChance and the evade cap) and deflect chance
-- (calcs.deflectChance, :48-54, on its DeflectionRating), each with `accuracy` in place of the enemy's (PoB's config
-- can't set an accuracy above 2,357: the enemy level clamps at 85, Modules/CalcSetup.lua:739), no blind and no distance;
-- unlucky evasion and lucky deflection applied as PoB applies them (:1476-1481, :1518-1521). `deflectEffect` is PoB's
-- DeflectEffect, the share of a deflected hit prevented. `companionDeflected` (PG-100) is the percent of a deflected hit
-- a companion takes before the build (TakenFromCompanionBeforeYouFromDeflected, :2961-2963), which PoB's max hit already
-- counts at PoB's own deflect chance.
local function arbiter_chances(output, accuracy)
  local env = build.calcsTab.mainEnv
  local modDB, enemyDB = env.modDB, env.enemyDB
  local calcs = build.calcsTab.calcs
  local evade
  if modDB:Flag(nil, 'CannotEvade') or enemyDB:Flag(nil, 'CannotBeEvaded') then
    evade = 0
  elseif modDB:Flag(nil, 'AlwaysEvade') then
    evade = 100
  else
    local base = modDB:Sum('BASE', nil, 'EvadeChance')
    local hitChance = calcLib.mod(enemyDB, nil, 'HitChance')
    local evadeMax = modDB:Max(nil, 'EvadeChanceMax') or _G.data.misc.EvadeChanceCap
    local hit = calcs.monsterHitChance(tonumber(output.MeleeEvasion) or 0, accuracy)
    evade = math.max(0, math.min(evadeMax, (100 - (hit - base) * hitChance) * calcLib.mod(modDB, nil, 'EvadeChance', 'MeleeEvadeChance')))
    if modDB:Flag(nil, 'UnluckyEvade') then evade = evade * evade / 100 end
  end
  local deflect = calcs.deflectChance(tonumber(output.DeflectionRating) or 0, accuracy)
  if modDB:Flag(nil, 'DeflectIsLucky') then
    local notDeflect = 1 - deflect / 100
    deflect = (1 - notDeflect * notDeflect) * 100
  end
  return {
    accuracy = accuracy, evade = evade, deflect = deflect, deflectEffect = tonumber(output.DeflectEffect) or 0,
    companionDeflected = modDB:Sum('BASE', nil, 'TakenFromCompanionBeforeYouFromDeflected'),
  }
end

-- WU-120 (amendment 12 §4, the G9 spike: `pass`): the stage measured with every hit deflected, for the deflected ratio.
-- PoB counts deflection in the max hit only at a 100% chance (Modules/CalcDefence.lua:2459) and caps the chance at 95%
-- (Modules/Data.lua:245, data.misc.DeflectionChanceCap). The pass lifts the cap to 100 and has PoB's own deflect formula
-- (calcs.deflectChance, :48-54) read an enemy accuracy of 0, which a build with any deflection rating deflects at the
-- cap; nothing else of the calculation changes. vendor/ is unmodified: the cap and the formula are put back however the
-- pass ends, before the build is read again. The five max hits (`max_hits`) when PoB's chance came out 100, else nil
-- (the compile then reads the ratio by formula).
local function deflected_pass()
  local misc = _G.data.misc
  local calcs = build.calcsTab.calcs
  local cap, own = misc.DeflectionChanceCap, calcs.deflectChance
  misc.DeflectionChanceCap = 100
  calcs.deflectChance = function(deflection) return own(deflection, 0) end
  local ok, output, err = pcall(rebuild)
  misc.DeflectionChanceCap = cap
  calcs.deflectChance = own
  if not ok then error(output, 0) end
  output = must('measuring the stage with every hit deflected', output, err)
  if output.DeflectChance ~= 100 then return nil end
  local hits, immune = max_hits(output)
  return { maxHits = hits, immune = immune }
end

-- WU-111 (amendment 11 §5, §9b; D-437, D-447): the boss measure. The stage is measured again under its own config with
-- only `enemyIsBoss` set to "Pinnacle" (the community convention, Modules/ConfigOptions.lua:1964: its apply sets the
-- Pinnacle boss's placeholders and conditions), the plan's earned conditions and every other listed option as they are.
-- `boss.groups` are the reply's group numbers to measure (the named source's and the boss rotation's), each with
-- `boss.fields`, on its own weapon set (`measure_groups`). Each is read as skill_outputs reads it, so the keys and fields
-- are `skillOutputs`', with each key's `skill_meta`. Everything is put back as with_config puts it back. Nil without
-- `boss`.
-- WU-120 (amendment 12 §4, D-449): right after its first calculation, on the stage's own weapon set, before any weapon-set-2
-- one, the pass reads the five max hits and the immune types (`maxHits`, `immune`: the Arbiter verdict's), under PoB's
-- Pinnacle settings as they are (curses at half effect, the enemy's penetration placeholders, enemy level 82). With
-- `boss.arbiter` (`b` and `n`), `arbiter` is the chances at the Arbiter's accuracy (`arbiter_chances`) and, when the
-- deflect chance is above 0, the max hits with every hit deflected (`deflected`, by `deflected_pass`); `method` is
-- `pass`, or `formula` when PoB couldn't be made to deflect every hit.
local BOSS_VALUE = 'Pinnacle'
local function measure_boss(st)
  local boss = st.boss
  if type(boss) ~= 'table' then return nil end
  local accuracy = type(boss.arbiter) == 'table' and tonumber(boss.arbiter.accuracy) or nil
  return with_config('the boss measure', { enemyIsBoss = BOSS_VALUE }, function()
    local output = must('measuring the stage against a Pinnacle boss', rebuild())
    local hits, immune = max_hits(output)
    local arbiter = nil
    if accuracy ~= nil then
      arbiter = arbiter_chances(output, accuracy)
      arbiter.method = 'pass'
      if arbiter.deflect > 0 then
        arbiter.deflected = deflected_pass()
        if arbiter.deflected == nil then arbiter.method = 'formula' end
      end
    end
    -- The breakdown rebuilds before each figure it reads (BuildOps.stats_breakdown), so the deflected pass is gone.
    local skills, meta = measure_groups(st, boss.groups, list(boss.fields))
    return { skillOutputs = skills, skillMeta = meta, maxHits = hits, immune = immune, arbiter = arbiter }
  end)
end

-- WU-120 (amendment 12 §9, D-454): the resisting figure's measure. The stage is measured again under its own config with
-- only the enemy's fire, cold and lightning resistances set to `resisting.resist` (the waystone modifier's top roll),
-- curses at full strength (the map enemy isn't a boss); `resisting.groups` (the named source's) are read with
-- `resisting.fields` on their own weapon set as the boss measure reads its groups, and everything is put back as it is
-- put back there. Nil without `resisting`.
local RESIST_OPTIONS = { 'enemyFireResist', 'enemyColdResist', 'enemyLightningResist' }
local function measure_resisting(st)
  local r = st.resisting
  if type(r) ~= 'table' then return nil end
  local value = tonumber(r.resist)
  if value == nil then fail('the resisting measure needs the enemy\'s resistance') end
  local options = {}
  for _, option in ipairs(RESIST_OPTIONS) do options[option] = value end
  return with_config('the resisting measure', options, function()
    must('measuring the stage against resisting enemies', rebuild())
    local skills, meta = measure_groups(st, r.groups, list(r.fields))
    return { skillOutputs = skills, skillMeta = meta }
  end)
end

-- WU-120 (amendment 12 §4, D-449): the conditioned read, on `n`. The stage is measured again with every condition against
-- it: PoB's EHP calc set to Unlucky (`EHPUnluckyWorstOf` 2), been hit recently, Wind Dancer at 0 stacks and the enemy not
-- blinded, every other option as it is; its TotalEHP and max hits (`max_hits`) are read and every option is put back as
-- the boss measure puts its own back, so the saved file's config is the plan's. Nil without `conditioned`.
local CONDITIONED = { EHPUnluckyWorstOf = 2, conditionBeenHitRecently = true, windDancerStacks = 0, conditionEnemyBlinded = false }
local function measure_conditioned(st)
  if st.conditioned ~= true then return nil end
  return with_config('the conditioned read', CONDITIONED, function()
    local output = must('measuring the stage with every condition against it', rebuild())
    local hits, immune = max_hits(output)
    return { ehp = finite(output.TotalEHP) and output.TotalEHP or nil, maxHits = hits, immune = immune }
  end)
end

function M.compile_stage(st)
  if TEST_ACTIONS and st.__crashForTest then os.exit(3) end
  if not build or not build.treeTab or not build.itemsTab or not build.skillsTab or not build.configTab
      or not build.calcsTab then
    fail('build not initialized')
  end
  local defer = not (TEST_ACTIONS and st.__noDeferForTest)
  local itemsTab = build.itemsTab
  local ok, res = pcall(function()
    local specId, itemSetId, fresh, skipped, added, skillSetId, skillsFresh
    local before = item_selections()
    -- No calculation checks another stage's item set against this stage's tree (ValidateWeaponSlots
    -- runs only when a calculation loses a flag the previous one had).
    itemsTab.lastWeaponFlagState = nil
    deferring(defer, function()
      specId = build_tree(st)
      itemSetId, fresh, skipped, added = build_items(st)
      -- D-382: the stage's own skill set, before its first calculation (the off-hands' below), so the groups PoB
      -- adds for what this stage's tree and items grant go into it, not into the set the last stage left active.
      skillSetId, skillsFresh = stage_set('skill', st.skillSet, st.first)
    end)
    -- The off-hands, checked against this stage's own tree and items (an item can grant a flag).
    if fresh then
      if plans_off_hand(st) then
        itemsTab.lastWeaponFlagState = nil
        rebuild()
        deferring(defer, function() equip(st, added, function(slot) return OFF_HAND[slot] == true end) end)
      end
    else
      settle_off_hands(itemSetId, before)
    end
    if companion_id(st) ~= nil then add_to_beast_library(companion_id(st)) end
    deferring(defer, function()
      restore_item_sets(before, itemSetId)
      build_skills(st, skillsFresh)
    end)
    rebuild()
    plan_groups_first()
    local minionSkills = select_minion_skills(st)
    select_main(st)
    local configSetId = deferring(defer, function()
      local id = build_config(st)
      must('setting the level', BuildOps.set_level(st.level))
      return id
    end)
    -- D-426: on a stage that uses weapon set 2, set 2's measure, before the stage's own so the build ends as it
    -- would without it; on a stage measured with set 2 active (useSecondWeaponSet), its own measure is set 2's.
    -- WU-102: with every group's breakdown on set 2 (skillOutputsSet2), keyed as skillOutputs.
    local setTwo = uses_set_two(st)
    local outputsSet2, skillsSet2, metaSet2
    if setTwo and st.useSecondWeaponSet ~= true then outputsSet2, skillsSet2, metaSet2 = measure_set_two(list(st.offenseFields)) end
    local output = must('measuring the stage', rebuild())
    local mainStacks = main_dot_can_stack()
    local companion = companion_measure(st)
    local outputs, immune = output_map(output)
    if setTwo and st.useSecondWeaponSet == true then outputsSet2 = outputs end
    local configInputs, configSurvivesDrop = {}, {}
    local cs = build.configTab.configSets[configSetId]
    local stored = {}
    for option in pairs(type(st.config) == 'table' and st.config or {}) do stored[#stored + 1] = option end
    -- The custom modifiers' option too (D-293), so the saved file is checked for it like a listed option.
    if custom_mods_text(st) ~= nil then stored[#stored + 1] = CUSTOM_MODS end
    for _, option in ipairs(stored) do
      local v = cs and cs.input[option]
      if type(v) == 'boolean' or type(v) == 'string' or finite(v) then
        configInputs[option] = v
        configSurvivesDrop[option] = survives_drop(cs, option, v)
      end
    end
    -- The V1/V2 inputs, before the breakdown changes the main selection and restores it.
    local checks = stage_checks(st, output, configSetId, defer)
    local alloc = allocation()
    local skills, skillStacks, travelSkills, skillMeta = skill_outputs(list(st.offenseFields))
    if setTwo and st.useSecondWeaponSet == true then skillsSet2, metaSet2 = skills, skillMeta end
    -- WU-111: the boss measure, last, so nothing above reads the build while it is set for a Pinnacle boss. WU-120
    -- (amendment 12 §4, §9): then the resisting measure and, on `n`, the conditioned read, each putting its options back.
    local boss = measure_boss(st)
    local resisting = measure_resisting(st)
    local conditioned = measure_conditioned(st)
    return {
      id = tostring(st.id),
      ids = { spec = specId, itemSet = itemSetId, skillSet = skillSetId, configSet = configSetId },
      allocation = alloc,
      outputs = outputs,
      immune = immune,
      outputsSet2 = outputsSet2,
      skillOutputs = skills,
      skillOutputsSet2 = skillsSet2,
      travelSkills = travelSkills,
      skippedToggles = skipped,
      items = set_items(itemsTab.itemSets[itemSetId], list(st.itemSlots)),
      addedItems = added,
      weaponFlags = weapon_flags(),
      configInputs = configInputs,
      configSurvivesDrop = configSurvivesDrop,
      dotCanStack = { main = mainStacks, skills = skillStacks },
      skillMeta = skillMeta,
      skillMetaSet2 = metaSet2,
      boss = boss,
      resisting = resisting,
      conditioned = conditioned,
      checks = checks,
      minionSkills = minionSkills,
      companion = companion,
    }
  end)
  if not ok then fail('stage ' .. tostring(st.id) .. ': ' .. message_of(res)) end
  return res
end

-- ---------------------------------------------------------------------------------------------------
-- compile_finish

local function loadout_names()
  build:SyncLoadouts()
  local names = {}
  local control = build.controls and build.controls.buildLoadouts
  for _, entry in ipairs(control and control.list or {}) do
    if type(entry) == 'string' and entry:sub(1, 4) ~= '^7^7' then names[#names + 1] = entry end
  end
  return names
end

local function untitled(kind, label)
  local tab = build[KIND_TAB[kind]]
  local sets = tab[kind .. 'Sets']
  for _, id in ipairs(tab[KIND_ORDER[kind]]) do
    if sets[id] and (sets[id].title == nil or sets[id].title == 'Default') then
      fail(('%s %d is untitled (PoB shows "Default"), so it would be a loadout of its own'):format(label, id))
    end
  end
end

function M.compile_finish(params)
  if not build or not build.treeTab then fail('build not initialized') end
  for i, spec in ipairs(build.treeTab.specList or {}) do
    if spec.title == nil or spec.title == 'Default' then
      fail(('tree spec %d is untitled (PoB shows "Default"), so it would be a loadout of its own'):format(i))
    end
  end
  untitled('item', 'item set')
  untitled('skill', 'skill set')
  untitled('config', 'config set')
  local names = loadout_names()
  local stages = list(params.stages)
  if #names ~= #stages then
    fail(('PoB lists %d loadouts for %d stages: %s'):format(#names, #stages, table.concat(names, ' | ')))
  end
  for _, st in ipairs(stages) do
    local listed = false
    for _, n in ipairs(names) do
      if n == st.title then listed = true end
    end
    if not listed then fail(('stage %s: PoB lists no loadout named "%s"'):format(tostring(st.id), tostring(st.title))) end
    local ok, lo = pcall(build.GetLoadoutByName, build, st.title)
    local ids = st.ids or {}
    if not ok or type(lo) ~= 'table' or lo.specId ~= ids.spec or lo.itemSetId ~= ids.itemSet
        or lo.skillSetId ~= ids.skillSet or lo.configSetId ~= ids.configSet then
      fail(('stage %s: loadout "%s" does not resolve to the stage\'s tree spec and item, skill and config sets')
        :format(tostring(st.id), tostring(st.title)))
    end
  end
  local ok, active = pcall(build.GetLoadoutByName, build, params.active)
  if not ok or type(active) ~= 'table' then fail(('no loadout named "%s" to select'):format(tostring(params.active))) end
  -- Selecting the saved loadout checks its off-hands against the last stage's calculation, so they are put
  -- back and checked against the saved loadout's own tree and items; any other item set PoB changed is put back.
  local before = item_selections()
  build.itemsTab.lastWeaponFlagState = nil
  build:SetActiveLoadout(active)
  settle_off_hands(active.itemSetId, before)
  restore_item_sets(before, active.itemSetId)
  must('setting the saved level', BuildOps.set_level(params.level, true))
  local itemSets = {}
  for _, id in ipairs(build.itemsTab.itemSetOrderList) do
    local set = build.itemsTab.itemSets[id]
    itemSets[#itemSets + 1] = { id = id, title = tostring(set.title or 'Default'), slots = set_items(set, list(params.itemSlots)) }
  end
  return { loadouts = names, active = tostring(params.active), level = build.characterLevel,
    autoMode = build.characterLevelAutoMode == true, itemSets = itemSets }
end

-- ---------------------------------------------------------------------------------------------------
-- Handlers

-- Runs `fn(params)`: a `fail()` becomes `{ok=false, error}`, any other error propagates (EXCEPTION).
local function handler(fn)
  return function(params)
    local ok, res = pcall(fn, type(params) == 'table' and params or {})
    if ok then return { ok = true, result = res } end
    if type(res) == 'table' and getmetatable(res) == Failure then return { ok = false, error = res.msg } end
    error(res, 0)
  end
end

M.handlers = {
  compile_check = handler(M.compile_check),
  compile_stage = handler(M.compile_stage),
  compile_finish = handler(M.compile_finish),
}

return M
