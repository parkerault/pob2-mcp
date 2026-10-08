-- API/Compile.lua
-- The plan compiler's engine side (C-41, WU-41): one PoB2 build with one loadout per guide stage.
--
--   compile_check  {className, ascendancy, stages[]}
--     The read-only preflight (A-P12). It checks every stage of the plan against the game data and
--     reports every defect, as "stage <id>: <defect>" lines; it changes nothing in the loaded build (no
--     set is created, no item added, nothing recalculated). Defects: an unknown class or ascendancy; an
--     unknown gem (with resolve_gem's suggestions); item or jewel text PoB can't parse into a base type,
--     or an item that doesn't fit its slot (the off-hand slots, which depend on the stage's main hand,
--     are checked when the stage is built); a node id that isn't a passive tree node, an ascendancy node
--     listed as a regular one or the reverse; a node that doesn't connect to its start through the
--     stage's listed nodes under PoB's weapon-set rule (an untagged node paths only through untagged
--     nodes, a node tagged weapon set n also through nodes tagged n: PassiveSpec:CanPathThroughAllocMode,
--     D-213); a weapon-set tag on a node PoB never tags (an ascendancy node, a keystone, a jewel
--     socket); an attribute choice on a node that isn't an attribute node, and an allocated attribute
--     node without one (PoB gives such a node no stat); a tree jewel on a node that isn't a jewel socket;
--     an unknown config option or a bad value (BuildOps' own config check); a main group or main active
--     skill outside the stage's groups or their active skills.
--     It also reports (WU-42), for V2: `producers`, whether each `{kind, name}` producer the plan's earned
--     config names exists in the game data (by kind: an item base or unique; a gem, as C-37's lookup finds
--     it; a passive or ascendancy node; an active skill; a flask or charm base or unique), names compared
--     ignoring case (an unknown producer is no defect: V2 reports it, D-221); and `configBaseline`, per
--     config option its type, whether it has an `apply`, its default (`defaultState`, or the
--     `defaultIndex` entry of its list), its `defaultPlaceholderState` and its first list value, read from
--     PoB's option list as ConfigTab:CreateConfigSet fills a new set (Classes/ConfigTab.lua:979-987),
--     without creating a set, and whether PoB shows it only for some builds (`conditional`: it has a
--     show gate such as ifSkill or ifCond, ConfigTab.lua:244-541).
--     -> {defects[], treeVersion, stageCount, producers[{kind, name, exists}], configBaseline{var: {...}}}
--
--   compile_stage  {id, first, title, level, tree, jewels[], itemSet, items[], toggles[],
--                   useSecondWeaponSet, skillSet, groups[], main, configSet, config, offenseFields[],
--                   itemSlots[]}
--     Builds one stage into the engine's build and measures it (C-41 step 7). The tree: stage 1 retitles
--     spec 1, every other stage gets a new spec; the nodes go in through set_tree with their weapon-set
--     tags and attribute choices (C-40), then the tree jewels. Item, skill and config sets: `reuse` names
--     a set an earlier stage created, which is only selected (its content is the same); otherwise stage 1
--     retitles set 1 of that type and every other stage creates a set (Sets.lua, C-39), and the content
--     goes in: the items, the toggles (a toggle on an empty slot is skipped, for the checks to report)
--     and the second weapon set; every socket group, created with includeInFullDPS off, and its gems;
--     every listed config option. Then the main selection (after the second-weapon-set flag, which
--     doesn't move it), the level in manual mode, and the measurement: every finite number of the main
--     output, the C-45 breakdown of every socket group (stats_breakdown, keyed g<group>s<skill>p<statSet>)
--     and PoB's allocation after the import, with each node's weapon-set tag.
--     -> {id, ids{spec, itemSet, skillSet, configSet}, allocation{nodes[{id, mode}], startNodes[]},
--         outputs{}, skillOutputs{}, skippedToggles[], items{slot: {id, name}}, addedItems{slot: {id, name}},
--         weaponFlags{giantsBlood, instrumentsOfPower, lordOfTheWilds}, configInputs{option: value},
--         configSurvivesDrop{option: boolean},
--         checks{...}}
--     `checks` (WU-42) are the V1 and V2 inputs, read right after the measurement: PassiveSpec:CountAllocNodes'
--     counts, `ExtraPoints` and `PassivePointsToWeaponSetPoints`, Str/Dex/Int and ReqStr/ReqDex/ReqInt with
--     the item or gem each requirement comes from, every gem's tier, kind (skill, support, or spirit: it
--     reserves Spirit) and level requirement at its level, every equipped item's level requirement and
--     names (flasks and charms with their toggle), PoB's warning lines (get_warnings, without another
--     rebuild), the allocated nodes' names, the active skills' names, the stage's config set's `input`
--     and `placeholder` tables after the writes and the recalculation (enemyIsBoss's placeholders included),
--     and `shownOptions`, the conditional config options PoB shows for the stage (D-250).
--     `items` is what the stage's item set holds in each of `itemSlots` after the measurement, and
--     `addedItems` what this stage equipped when it created the set, so the compiler can tell an item PoB
--     unequipped from the plan's. `configInputs` are the stored values of the stage's listed options, and
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
        ascendancyName = asc.name }
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

local SET_NAMES = { 'set1', 'set2' }

-- The tree defects of one stage. `st.nodes`, `st.ascendancyNodes`, `st.weaponSets{set1, set2}` and
-- `st.attributeChoices[{node, attribute}]` as the plan has them (C-31).
local function check_tree(tree, roll, st, defect)
  local nodes = tree.nodes
  local mode = {}
  local listed = {}
  for _, id in ipairs(list(st.nodes)) do
    local node = nodes[id]
    if not node then
      defect(('node %s is not a passive tree node'):format(tostring(id)))
    elseif node.ascendancyName then
      defect(('node %d (%s) is an ascendancy node: list it in tree.ascendancyNodes'):format(id, tostring(node.dn)))
    else
      mode[id] = 0
      listed[#listed + 1] = id
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
  table.sort(listed)
  for _, id in ipairs(listed) do
    local m = mode[id]
    if not reached[m][id] then
      local how = m == 0 and 'through untagged nodes'
        or ('through untagged nodes and nodes tagged weapon set ' .. m)
      defect(('node %d (%s)%s is not connected to its start %s'):format(id, tostring(nodes[id].dn),
        m == 0 and '' or (' (weapon set ' .. m .. ')'), how))
    end
  end
end

-- The number of active skills a gem may grant (an upper bound: PoB lists its non-support granted effects).
local function active_skill_count(gemData)
  local n = 0
  for _, ge in ipairs(gemData.grantedEffectList or { gemData.grantedEffect }) do
    if ge and not ge.support then n = n + 1 end
  end
  return n
end

-- The off-hand slots: whether an item fits them depends on the stage's main hand and its weapon-fit flags,
-- so the stage build checks them.
local OFF_HAND = { ['Weapon 2'] = true, ['Weapon 2 Swap'] = true }

local function check_stage(tree, roll, st, defect)
  check_tree(tree, roll, st, defect)
  for _, j in ipairs(list(st.jewels)) do
    local ok, item = pcall(construct, 'Item', tostring(j.text))
    if not ok or not item or not item.baseName then
      defect(('tree jewel on node %s: PoB can not parse its text into an item with a base type'):format(tostring(j.node)))
    elseif item.type ~= 'Jewel' then
      defect(('tree jewel on node %s: %s is not a jewel'):format(tostring(j.node), tostring(item.baseName)))
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
    end
  end
  local groups = list(st.groups)
  local activeCounts = {}
  for gi, group in ipairs(groups) do
    activeCounts[gi] = 0
    for k, gem in ipairs(list(group.gems)) do
      local gemData, err = BuildOps.resolve_gem(gem.name)
      if not gemData then
        defect(('skills.groups[%d].gems[%d]: %s'):format(gi - 1, k - 1, tostring(err)))
      else
        activeCounts[gi] = activeCounts[gi] + active_skill_count(gemData)
      end
    end
  end
  local main = st.main or {}
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

function M.compile_check(params)
  local tree = main and main.LoadTree and main:LoadTree(latestTreeVersion)
  if not tree then fail('passive tree data not available') end
  local defects = {}
  local roll, rollErr = resolve_roll(tree, params.className, params.ascendancy)
  if not roll then defects[#defects + 1] = 'roll: ' .. rollErr end
  local stages = list(params.stages)
  for _, st in ipairs(stages) do
    local function defect(msg) defects[#defects + 1] = 'stage ' .. tostring(st.id) .. ': ' .. msg end
    check_stage(tree, roll, st, defect)
  end
  local producers = {}
  for _, p in ipairs(list(params.producers)) do
    local kind, name = tostring(p.kind), tostring(p.name)
    producers[#producers + 1] = { kind = kind, name = name, exists = producer_exists(tree, kind, name) }
  end
  return { defects = defects, treeVersion = tostring(latestTreeVersion), stageCount = #stages, producers = producers,
    configBaseline = config_baseline() }
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
  must('importing the tree', BuildOps.set_tree({
    classId = spec.curClassId, ascendClassId = spec.curAscendClassId,
    secondaryAscendClassId = spec.curSecondaryAscendClassId or 0, nodes = nodes, treeVersion = spec.treeVersion,
    weaponSets = weaponSets, attributeChoices = choices,
  }))
  for _, j in ipairs(list(st.jewels)) do
    must('socketing the tree jewel on node ' .. tostring(j.node),
      BuildOps.add_item_text({ text = j.text, slotName = 'Jewel ' .. tostring(j.node) }))
  end
  return specId
end

-- Equip the stage's items whose slot `pick` accepts, recording each one's id and name in `added`.
local function equip(st, added, pick)
  for _, it in ipairs(list(st.items)) do
    if pick(tostring(it.slot)) then
      local res = must('equipping the item in ' .. tostring(it.slot), BuildOps.add_item_text({ text = it.text, slotName = it.slot }))
      added[tostring(it.slot)] = { id = res.id, name = tostring(res.name) }
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

local function build_skills(st)
  local id, fresh = stage_set('skill', st.skillSet, st.first)
  if fresh then
    for gi, group in ipairs(list(st.groups)) do
      local created = must('creating socket group ' .. gi, BuildOps.create_socket_group({
        label = group.label, enabled = group.enabled ~= false, includeInFullDPS = false,
      }))
      for _, gem in ipairs(list(group.gems)) do
        must(('adding gem "%s" to group %d'):format(tostring(gem.name), gi), BuildOps.add_gem({
          groupIndex = created.index, gemName = gem.name, level = gem.level, quality = gem.quality,
          enabled = gem.enabled ~= false,
        }))
      end
    end
  end
  return id
end

local function select_main(st)
  local main = st.main or {}
  must('setting the main skill', BuildOps.set_main_selection({
    mainSocketGroup = main.group, mainActiveSkill = main.activeSkill, statSet = main.statSet,
  }))
  local g = build.skillsTab.socketGroupList[tonumber(main.group)]
  local count = g and g.displaySkillList and #g.displaySkillList or 0
  if tonumber(main.activeSkill) > count then
    fail(('the main active skill %s is outside group %s\'s %d active skills'):format(tostring(main.activeSkill),
      tostring(main.group), count))
  end
end

local function build_config(st)
  local id, fresh = stage_set('config', st.configSet, st.first)
  if fresh and type(st.config) == 'table' and next(st.config) ~= nil then
    must('writing the config options', BuildOps.set_config(st.config))
  end
  return id
end

-- C-45's breakdown of every socket group: g<group>s<skill>p<statSet> -> {skill, statSetLabel, fields}.
local function skill_outputs(fields)
  local out = {}
  for gi = 1, #(build.skillsTab.socketGroupList or {}) do
    local res = must('measuring socket group ' .. gi, BuildOps.stats_breakdown({ groupIndex = gi, fields = fields }))
    for _, skill in ipairs(res.skills or {}) do
      for _, set in ipairs(skill.statSets or {}) do
        local numbers = {}
        for k, v in pairs(set.output or {}) do
          if finite(v) then numbers[k] = v end
        end
        out[('g%ds%dp%d'):format(gi, skill.index, set.index)] = {
          skill = tostring(skill.name), statSetLabel = tostring(set.label or ''), fields = numbers,
        }
      end
    end
  end
  return out
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

-- Every gem of the active skill set's socket groups (item-granted groups excluded): its group and index,
-- name, level, tier, kind and level requirement at its level.
local function stage_gems()
  local out = {}
  for gi, group in ipairs(build.skillsTab.socketGroupList or {}) do
    if not group.source then
      for k, gem in ipairs(group.gemList or {}) do
        local gemData = gem.gemData
        local ge = gem.grantedEffect or (gemData and gemData.grantedEffect)
        local level = tonumber(gem.level) or 1
        local lv = ge and ge.levels and ge.levels[level]
        out[#out + 1] = {
          group = gi, index = k,
          name = tostring(gem.nameSpec or (gemData and gemData.name) or ''),
          level = level,
          tier = gemData and tonumber(gemData.Tier) or nil,
          kind = gem_kind(gem, ge, level),
          levelRequirement = tonumber(gem.reqLevel) or (lv and tonumber(lv.levelRequirement)) or 0,
        }
      end
    end
  end
  return out
end

local function is_activatable(slotName)
  return slotName:match('^Flask %d+$') ~= nil or slotName:match('^Charm %d+$') ~= nil
end

-- Every item equipped in `slotNames` of the active item set: its slot, names, level requirement, and for
-- a flask or charm its toggle (the slot control's `active`, which the calcs read).
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
  }
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
    local specId, itemSetId, fresh, skipped, added, skillSetId
    local before = item_selections()
    -- No calculation checks another stage's item set against this stage's tree (ValidateWeaponSlots
    -- runs only when a calculation loses a flag the previous one had).
    itemsTab.lastWeaponFlagState = nil
    deferring(defer, function()
      specId = build_tree(st)
      itemSetId, fresh, skipped, added = build_items(st)
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
    deferring(defer, function()
      restore_item_sets(before, itemSetId)
      skillSetId = build_skills(st)
    end)
    rebuild()
    select_main(st)
    local configSetId = deferring(defer, function()
      local id = build_config(st)
      must('setting the level', BuildOps.set_level(st.level))
      return id
    end)
    local output = must('measuring the stage', rebuild())
    local outputs = {}
    for k, v in pairs(output) do
      if type(k) == 'string' and finite(v) then outputs[k] = v end
    end
    local configInputs, configSurvivesDrop = {}, {}
    local cs = build.configTab.configSets[configSetId]
    for option in pairs(type(st.config) == 'table' and st.config or {}) do
      local v = cs and cs.input[option]
      if type(v) == 'boolean' or type(v) == 'string' or finite(v) then
        configInputs[option] = v
        configSurvivesDrop[option] = survives_drop(cs, option, v)
      end
    end
    -- The V1/V2 inputs, before the breakdown changes the main selection and restores it.
    local checks = stage_checks(st, output, configSetId, defer)
    return {
      id = tostring(st.id),
      ids = { spec = specId, itemSet = itemSetId, skillSet = skillSetId, configSet = configSetId },
      allocation = allocation(),
      outputs = outputs,
      skillOutputs = skill_outputs(list(st.offenseFields)),
      skippedToggles = skipped,
      items = set_items(itemsTab.itemSets[itemSetId], list(st.itemSlots)),
      addedItems = added,
      weaponFlags = weapon_flags(),
      configInputs = configInputs,
      configSurvivesDrop = configSurvivesDrop,
      checks = checks,
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
