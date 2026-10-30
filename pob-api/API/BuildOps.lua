-- API/BuildOps.lua (PoE2)
-- Thin wrappers around PoB headless objects for programmatic operations.
-- Ported from the PoE1 api-stdio fork and adapted for Path of Building - PoE2.
-- Key PoE2 differences handled here:
--   * PassiveSpec:ImportFromNodeList has extra leading `className` and `weaponSets` params
--   * Config is PoB2's own option list (Modules/ConfigOptions), read and written through the active config set
--   * Flask slot count is validated against the actual item set rather than hardcoded

local M = {}

-- Version-portable constructor for PoB classes (C-6, E3).
local construct = require('API.Util').construct

-- Constants
local MIN_PLAYER_LEVEL = 1
local MAX_PLAYER_LEVEL = 100
local MAX_ITEM_TEXT_LENGTH = 10240  -- 10KB

-- Ensure outputs are (re)built and return the main output table safely
function M.get_main_output()
  if not build or not build.calcsTab then
    return nil, "build not initialized"
  end
  -- D-428: PoB's warning past its skill slots (Modules/CalcPerform.lua:3603-3609) reads the skills tab's count of
  -- groups (GlobalGemAssignments, Classes/SkillsTab.lua:1570-1608), which the tab refreshes only at load and as it draws
  -- or shows a group (:1562, :1331, :1167), so it goes stale once the bridge edits groups headless. Refresh it before
  -- each calculation, as the GUI keeps it current. It also feeds PoB's one-copy-per-lineage-support warning
  -- (CalcPerform.lua:3610-3615); nothing else reads it.
  local skillsTab = build.skillsTab
  if skillsTab and skillsTab.socketGroupList and skillsTab.UpdateGlobalGemCountAssignments then
    skillsTab:UpdateGlobalGemCountAssignments()
  end
  if build.calcsTab.BuildOutput then
    build.calcsTab:BuildOutput()
  end
  local output = build.calcsTab and build.calcsTab.mainOutput or nil
  if not output then
    return nil, "no output available"
  end
  return output
end

-- The stats exported when the caller names no fields (get_stats, calc_with): the original 18, plus
-- the defence, pool, resistance-gap, max-hit and enemy-damage outputs and the attributes that callers
-- would otherwise read as missing (E7). Names are PoB's mainOutput keys (CalcDefence, CalcPerform).
M.DEFAULT_STAT_FIELDS = {
  "Life", "EnergyShield", "Mana", "Spirit", "Ward",
  "Armour", "Evasion",
  "FireResist", "ColdResist", "LightningResist", "ChaosResist",
  "BlockChance", "SpellBlockChance",
  "LifeRegen", "ManaRegen",
  "TotalDPS", "FullDPS", "CombinedDPS",
  "TotalEHP", "PhysicalDamageReduction",
  "LifeUnreserved", "ManaUnreserved", "SpiritUnreserved",
  "EvadeChance", "DeflectChance", "EffectiveBlockChance", "EnergyShieldRecharge",
  "MissingFireResist", "MissingColdResist", "MissingLightningResist", "MissingChaosResist",
  "PhysicalMaximumHitTaken", "FireMaximumHitTaken", "ColdMaximumHitTaken",
  "LightningMaximumHitTaken", "ChaosMaximumHitTaken",
  "PhysicalEnemyDamage", "FireEnemyDamage", "ColdEnemyDamage",
  "LightningEnemyDamage", "ChaosEnemyDamage", "totalEnemyDamage",
  "Str", "Dex", "Int",
}

-- The active passive spec's tree version (e.g. "0_5"). `build.targetVersion` is the game-version
-- tag of the build file ("0_1"), not a tree version.
local function active_tree_version()
  local spec = build and build.spec
  if spec and spec.treeVersion then return tostring(spec.treeVersion) end
  return nil
end

local SCALAR_TYPES = { number = true, string = true, boolean = true }

-- D-376: an output field by name. PoB keeps a minion's numbers in the nested table `output.Minion`, so
-- a field `Minion<Field>` that the output lacks reads `output.Minion[<Field>]` (`MinionTotalDPS` is
-- the minion's `TotalDPS`). At the pin only `MinionRevivalSpeed` is a field of the output itself, so no
-- name collides. Exported so the compile's own outputs can read the same way.
function M.output_field(output, key)
  local v = output[key]
  if v == nil and type(key) == 'string' and type(output.Minion) == 'table' then
    local field = key:match('^Minion(.+)$')
    if field then v = output.Minion[field] end
  end
  return v
end
local output_field = M.output_field

-- Export a subset of useful stats from main output.
-- If fields is provided, only export those keys (when present). Only number, string and boolean
-- values are exported; keys whose value is anything else (an item object, a nested table) are left
-- out and listed in `_meta.omitted`, because they cannot be encoded (ctx-lua X13). A `Minion<Field>`
-- reads the minion's own output (D-376, output_field).
function M.export_stats(fields)
  local output, err = M.get_main_output()
  if not output then
    return nil, err
  end
  local wanted = fields or M.DEFAULT_STAT_FIELDS
  local result = {}
  local omitted = {}
  for _, k in ipairs(wanted) do
    local v = output_field(output, k)
    if SCALAR_TYPES[type(v)] then
      result[k] = v
    elseif v ~= nil then
      table.insert(omitted, tostring(k))
    end
  end
  -- include some metadata if available
  result._meta = { omitted = omitted }
  result._meta.treeVersion = active_tree_version()
  if build and build.characterLevel then
    result._meta.level = tonumber(build.characterLevel)
  end
  if build and build.buildName then
    result._meta.buildName = tostring(build.buildName)
  end
  return result
end

-- D-463: the starts the active spec's socketed jewels open (Split Personality's "Can Allocate Passive Skills from the
-- <class>'s starting point", PoB's jewelData.alternateClassStart), as the compiler's rule takes them: the jewel's
-- socket is allocated and reached from the class start or the ascendancy start through allocated nodes, by PoB's
-- weapon-set rule (PassiveSpec:CanPathThroughAllocMode), never through the jewel's own start. PoB is looser: it reads
-- any allocated socket (PassiveSpec:BuildAllDependsAndPaths). A start the class has already adds nothing. Read only.
-- Returns { {socket, start, className}, ... } by socket id.
local function jewel_starts(spec)
  local out = {}
  local classStart = spec.curClass and spec.curClass.startNodeId
  local ascendStart = spec.curAscendClass and spec.curAscendClass.startNodeId
  for socketId, itemId in pairs(spec.jewels or {}) do
    local socket = spec.nodes[socketId]
    local item = socket and socket.alloc and spec:GetJewel(itemId)
    local className = item and item.jewelData.alternateClassStart
    local startId = className and spec.tree.classStartNodeNameMap[className]
    if startId and startId ~= classStart and spec.nodes[startId] then
      local mode = socket.allocMode or 0
      local seen, queue, head, reached = {}, {}, 1, false
      for _, id in ipairs({ classStart, ascendStart }) do
        local node = id and spec.nodes[id]
        if node and node.alloc and not seen[id] then
          seen[id] = true
          queue[#queue + 1] = node
        end
      end
      while head <= #queue and not reached do
        local node = queue[head]
        head = head + 1
        for _, other in ipairs(node.linked or {}) do
          if not seen[other.id] and other.id ~= startId and other.alloc and spec:CanPathThroughAllocMode(mode, other) then
            seen[other.id] = true
            if other.id == socketId then
              reached = true
              break
            end
            queue[#queue + 1] = other
          end
        end
      end
      if reached then out[#out + 1] = { socket = socketId, start = startId, className = className } end
    end
  end
  table.sort(out, function(a, b) return a.socket < b.socket end)
  return out
end

-- Read current tree allocation and metadata. Class and ascendancy names are the engine's own (the
-- active spec's tree), so callers never map ids through a table of their own. `jewelStarts` (D-463) lists the
-- starts the socketed jewels open (`jewel_starts`), which the path tools may leave.
function M.get_tree()
  if not build or not build.spec then
    return nil, "build/spec not initialized"
  end
  local spec = build.spec
  local out = {
    treeVersion = spec.treeVersion,
    classId = tonumber(spec.curClassId) or 0,
    ascendClassId = tonumber(spec.curAscendClassId) or 0,
    secondaryAscendClassId = tonumber(spec.curSecondaryAscendClassId or 0) or 0,
    className = spec.curClassName,
    ascendClassName = spec.curAscendClassName,
    nodes = {},
  }
  for id, _ in pairs(spec.allocNodes or {}) do
    table.insert(out.nodes, id)
  end
  table.sort(out.nodes)
  out.jewelStarts = jewel_starts(spec)
  return out
end

-- Re-import the active spec's allocation from a node list, keeping what the node list can't carry
-- (E2), as PoB's own PassiveSpec:Load does: each allocated node's weapon-set assignment
-- (`{[id]=node.allocMode}` for allocMode ~= 0) and the attribute choices (`hashOverrides`).
-- Both are read before the import, which resets the nodes.
-- `state` (optional, C-40) overrides what is kept: `state.weaponSets` replaces the tags and
-- `state.hashOverrides` the choices; the import takes the tables as given. `target` is the spec to
-- re-import (default: the active one; a throwaway spec for a dry run).
-- PassiveSpec:ImportFromNodeList(className, classId, ascendClassId, secondaryAscendClassId,
--   hashList, weaponSets, hashOverrides, masteryEffects, treeVersion)
local function reimport_nodes(classId, ascendId, secondaryId, nodes, treeVersion, state, target)
  local spec = target or build.spec
  state = state or {}
  local weaponSets = state.weaponSets
  if not weaponSets then
    weaponSets = {}
    for id, node in pairs(spec.allocNodes or {}) do
      if node.allocMode and node.allocMode ~= 0 then
        weaponSets[id] = node.allocMode
      end
    end
  end
  local hashOverrides = state.hashOverrides or copyTable(spec.hashOverrides or {}, true)
  -- PoE2 trees have no mastery selections; pass a copy (the import wipes the spec's own table).
  local masterySelections = copyTable(spec.masterySelections or {}, true)
  spec:ImportFromNodeList(nil, classId, ascendId, secondaryId, nodes, weaponSets, hashOverrides, masterySelections, treeVersion)
end

-- `<id> (<name>)` for a tree node, or the id as given when the tree has no such node.
local function node_label(key)
  local id = tonumber(key)
  local node = id and build.spec.nodes[id]
  if node then return string.format('%d (%s)', id, tostring(node.dn or node.name or '?')) end
  return tostring(key)
end

-- Why PoB never gives a node a weapon-set tag, or nil when it can. PassiveSpec:AllocNode allocates an
-- ascendancy node, a keystone, a jewel socket and a node containing one untagged
-- (vendor/Classes/PassiveSpec.lua:931); class and ascendancy start nodes PoB allocates itself.
local function untaggable_reason(node)
  if node.type == 'ClassStart' or node.type == 'AscendClassStart' then return 'a class start node' end
  if node.ascendancyName then return 'an ascendancy node' end
  if node.type == 'Keystone' then return 'a keystone' end
  if node.type == 'Socket' or node.containJewelSocket then return 'a jewel socket' end
  return nil
end

-- C-40 attribute names → PoB's option names (the attribute node's `options`, TreeTab:ModifyAttributePopup).
local ATTRIBUTE_OPTIONS = { strength = 'Strength', dexterity = 'Dexterity', intelligence = 'Intelligence' }

-- The index of the attribute node's option named `optionName` (SwitchAttributeNode's `attributeIndex`).
local function attribute_option_index(treeNode, optionName)
  for index, option in pairs(treeNode.options or {}) do
    if (option.dn or option.name) == optionName then return index end
  end
  return nil
end

-- Table keys (JSON object keys arrive as strings) sorted by node id, so messages are deterministic.
local function sorted_keys(map)
  local keys = {}
  for key in pairs(map) do keys[#keys + 1] = key end
  table.sort(keys, function(a, b)
    local na, nb = tonumber(a), tonumber(b)
    if na and nb then return na < nb end
    if na or nb then return na ~= nil end
    return tostring(a) < tostring(b)
  end)
  return keys
end

-- C-40: check `weaponSets` and `attributeChoices` against the nodes the call allocates (`nodes`),
-- and build what the import takes. Every problem is reported, naming the node and the reason, and
-- nothing is changed. Returns `{weaponSets?, hashOverrides?}`, or nil and the error.
local function tree_state_params(params, nodes)
  local spec = build.spec
  local allocated = {}
  for _, id in ipairs(nodes) do allocated[id] = true end
  local problems = {}
  local function bad(key, reason)
    problems[#problems + 1] = string.format('node %s: %s', node_label(key), reason)
  end
  -- The node a key names, when it is one the call allocates; otherwise the problem is recorded.
  local function allocated_node(key)
    local id = tonumber(key)
    local node = id and spec.nodes[id]
    if not node then bad(key, 'not a passive tree node'); return nil end
    if not allocated[id] then bad(key, 'not allocated'); return nil end
    return id, node
  end

  local state = {}
  if params.weaponSets ~= nil then
    if type(params.weaponSets) ~= 'table' then return nil, 'weaponSets must map node ids to weapon set 1 or 2' end
    state.weaponSets = {}
    for _, key in ipairs(sorted_keys(params.weaponSets)) do
      local set = params.weaponSets[key]
      local id, node = allocated_node(key)
      if id then
        local why = untaggable_reason(node)
        if why then
          bad(key, why .. ', which PoB never tags with a weapon set')
        elseif set ~= 1 and set ~= 2 then
          bad(key, 'the weapon set must be 1 or 2, not ' .. tostring(set))
        else
          state.weaponSets[id] = set
        end
      end
    end
  end

  local choices = {}
  if params.attributeChoices ~= nil then
    if type(params.attributeChoices) ~= 'table' then
      return nil, 'attributeChoices must map node ids to strength, dexterity or intelligence'
    end
    for _, key in ipairs(sorted_keys(params.attributeChoices)) do
      local choice = params.attributeChoices[key]
      local id = allocated_node(key)
      if id then
        local treeNode = spec.tree.nodes[id]
        local optionName = type(choice) == 'string' and ATTRIBUTE_OPTIONS[choice] or nil
        if not (treeNode and treeNode.isAttribute) then
          bad(key, 'not an attribute node')
        elseif not optionName then
          bad(key, 'the attribute must be strength, dexterity or intelligence, not ' .. tostring(choice))
        else
          local index = attribute_option_index(treeNode, optionName)
          if not index then bad(key, 'PoB has no ' .. optionName .. ' option for it')
          else choices[#choices + 1] = { id = id, index = index } end
        end
      end
    end
  end
  if #problems > 0 then return nil, table.concat(problems, '; ') end

  if params.attributeChoices ~= nil then
    -- The kept choices, with each new one made by PoB's own switch (PassiveSpec:SwitchAttributeNode),
    -- written into the copy the import takes rather than into the spec.
    local hashOverrides = copyTable(spec.hashOverrides or {}, true)
    local own = spec.hashOverrides
    spec.hashOverrides = hashOverrides
    local ok, switchErr = pcall(function()
      for _, c in ipairs(choices) do spec:SwitchAttributeNode(c.id, c.index) end
    end)
    spec.hashOverrides = own
    if not ok then return nil, 'switching an attribute node failed: ' .. tostring(switchErr) end
    state.hashOverrides = hashOverrides
  end
  return state
end

-- Set tree allocation from parameters
-- params: { classId, ascendClassId, secondaryAscendClassId?, nodes:[int], treeVersion?,
--   weaponSets?: {[nodeId]: 1|2}, attributeChoices?: {[nodeId]: "strength"|"dexterity"|"intelligence"} }
-- Without `weaponSets` and `attributeChoices`, the weapon-set tags and attribute choices are kept and
-- PoB drops any node that doesn't connect (AC-E29). With either (C-40), `weaponSets` replaces every tag,
-- `attributeChoices` is applied over the kept choices, and the call is all-or-nothing: a listed node
-- that isn't in `nodes`, can't take the tag or choice, or would leave the allocation (PoB connects an
-- untagged node only through untagged nodes) fails it, with the spec as it was.
function M.set_tree(params)
  if not build or not build.spec then
    return nil, "build/spec not initialized"
  end
  if type(params) ~= 'table' then
    return nil, "invalid params"
  end
  local classId = tonumber(params.classId or 0) or 0
  local ascendId = tonumber(params.ascendClassId or 0) or 0
  local secondaryId = tonumber(params.secondaryAscendClassId or 0) or 0
  local nodes = {}
  if type(params.nodes) == 'table' then
    for _, v in ipairs(params.nodes) do
      table.insert(nodes, tonumber(v))
    end
  end
  if params.weaponSets == nil and params.attributeChoices == nil then
    reimport_nodes(classId, ascendId, secondaryId, nodes, params.treeVersion)
    -- Rebuild calcs to reflect changes
    M.get_main_output()
    return true
  end

  local state, err = tree_state_params(params, nodes)
  if not state then return nil, err end
  local spec = build.spec
  -- What the spec keeps when a param doesn't replace it: its tags, and a copy of its choices. With its
  -- class, tree version and allocation, also what puts it back.
  local kept = {
    weaponSets = {}, hashOverrides = spec.hashOverrides, nodes = {}, classId = spec.curClassId,
    ascendId = spec.curAscendClassId, secondaryId = spec.curSecondaryAscendClassId or 0, treeVersion = spec.treeVersion,
  }
  for id, node in pairs(spec.allocNodes or {}) do
    kept.nodes[#kept.nodes + 1] = id
    if node.allocMode and node.allocMode ~= 0 then kept.weaponSets[id] = node.allocMode end
  end
  state.weaponSets = state.weaponSets or kept.weaponSets
  state.hashOverrides = state.hashOverrides or copyTable(spec.hashOverrides or {}, true)

  -- The tags must leave every node allocated. PoB decides that on a throwaway spec (made as create_spec
  -- makes one, never added to the tree tab), so a refused call never touches the build's spec, whose
  -- re-import would also reorder its export.
  local scratch = construct('PassiveSpec', build, params.treeVersion or spec.treeVersion)
  scratch.jewels = copyTable(spec.jewels or {})
  scratch:ImportFromNodeList(nil, classId, ascendId, secondaryId, nodes, state.weaponSets,
    copyTable(state.hashOverrides, true), copyTable(spec.masterySelections or {}, true))
  local function lost_in(s)
    local lost = {}
    for _, id in ipairs(nodes) do
      if s.nodes[id] and not s.allocNodes[id] then lost[#lost + 1] = id end
    end
    table.sort(lost)
    return lost
  end
  local function refusal(lost)
    local problems = {}
    for _, id in ipairs(lost) do
      problems[#problems + 1] = string.format('node %s: would no longer be allocated', node_label(id))
    end
    return table.concat(problems, '; ') .. ' (PoB connects an untagged node only through untagged nodes, '
      .. 'and a node tagged with weapon set n through untagged nodes and nodes tagged n)'
  end
  local lost = lost_in(scratch)
  if #lost > 0 then return nil, refusal(lost) end

  reimport_nodes(classId, ascendId, secondaryId, nodes, params.treeVersion, state)
  lost = lost_in(spec)
  if #lost > 0 then
    -- Never expected after the dry run; the allocation, tags and choices are put back all the same.
    reimport_nodes(kept.classId, kept.ascendId, kept.secondaryId, kept.nodes, kept.treeVersion,
      { weaponSets = kept.weaponSets, hashOverrides = kept.hashOverrides })
    M.get_main_output()
    return nil, refusal(lost)
  end
  M.get_main_output()
  return true
end

-- D-399: what ItemsTab:Save's item:BuildAndParseRaw() leaves for the save to write (the item's text, built from
-- its state), without the re-parse.
local function build_raw_only(item)
  item.raw = item:BuildRaw()
end

-- Export full build XML. PoB's save (ItemsTab:Save) calls item:BuildAndParseRaw() on every item, which re-parses
-- the text it just built into the item. An item whose text PoB v0.23.1 doesn't read back the same (a "Runic Ward:"
-- line before a socketed rune, as a newer PoB writes it) gained a socket and a rune on every save, and its parse
-- slowed with them, so each snapshot after a change took longer than the last and changed the build (D-399). The
-- export writes the same document, each item's text built from its state as the save builds it, but leaves the
-- items' state as it was.
function M.export_build_xml()
  if not build or not build.SaveDB then
    return nil, 'build not initialized'
  end
  local items = build.itemsTab and build.itemsTab.items or {}
  local own = {}
  for id, item in pairs(items) do
    own[id] = rawget(item, 'BuildAndParseRaw') or false
    item.BuildAndParseRaw = build_raw_only
  end
  local saved, xml = pcall(build.SaveDB, build, 'api-export')
  for id, item in pairs(items) do
    if own[id] ~= nil then item.BuildAndParseRaw = own[id] or nil end
  end
  if not saved then return nil, 'failed to compose xml: ' .. tostring(xml) end
  if not xml then return nil, 'failed to compose xml' end
  return xml
end

-- Set player level and rebuild. `autoMode` true also turns on PoB's auto-level mode, so the saved file
-- re-estimates the level from the tree (D-149, D-196); otherwise the level is manual, as before.
function M.set_level(level, autoMode)
  if not build or not build.configTab then
    return nil, 'build/config not initialized'
  end
  local lvl = tonumber(level)
  if not lvl or lvl < MIN_PLAYER_LEVEL or lvl > MAX_PLAYER_LEVEL then
    return nil, string.format('invalid level (must be %d-%d)', MIN_PLAYER_LEVEL, MAX_PLAYER_LEVEL)
  end
  if autoMode ~= nil and type(autoMode) ~= 'boolean' then
    return nil, 'autoMode must be true or false'
  end
  build.characterLevel = lvl
  build.characterLevelAutoMode = autoMode == true
  if build.configTab and build.configTab.BuildModList then
    build.configTab:BuildModList()
  end
  M.get_main_output()
  return true
end

-- Basic build info. Class and ascendancy are the active spec's engine names (what PoB shows), falling
-- back to the build's own fields when no spec is initialised.
function M.get_build_info()
  if not build then return nil, 'build not initialized' end
  local spec = build.spec
  local className = spec and spec.curClassName
  local ascendClassName = spec and spec.curAscendClassName
  if not className or className == '' then
    className = build.buildClassName or (build.Build and build.Build.className)
  end
  if not ascendClassName or ascendClassName == '' then
    ascendClassName = build.buildAscendName or (build.Build and build.Build.ascendClassName)
  end
  local info = {
    name = build.buildName,
    level = build.characterLevel,
    className = className,
    ascendClassName = ascendClassName,
    classId = build.spec and tonumber(build.spec.curClassId) or nil,
    ascendClassId = build.spec and tonumber(build.spec.curAscendClassId) or nil,
    treeVersion = active_tree_version(),
  }
  return info
end

-- PoB's colour codes (^0-^9, ^xRRGGBB) are display markup, not text.
local function strip_color_codes(s)
  return (s:gsub('%^x%x%x%x%x%x%x', ''):gsub('%^%d', ''))
end

-- Put `characterLevel` and `characterLevelAutoMode` back to the given values after PoB's
-- EstimatePlayerProgress (run by RefreshStatList, and by every build load) moved the level to its
-- estimate. When either differs, the level control, the config mod list and the outputs are rebuilt
-- for the restored level; otherwise nothing is touched.
function M.restore_level(level, autoMode)
  if build.characterLevel == level and build.characterLevelAutoMode == autoMode then return end
  build.characterLevel = level
  build.characterLevelAutoMode = autoMode
  local ctrl = build.controls and build.controls.characterLevel
  if ctrl and ctrl.SetText then ctrl:SetText(level) end
  if build.configTab and build.configTab.BuildModList then build.configTab:BuildModList() end
  M.get_main_output()
end

-- PoB's own warning lines (D-30, FR-A1): `build.controls.warnings.lines`, which only
-- `build:RefreshStatList()` rebuilds (bridge mutations run BuildOutput only). RefreshStatList also runs
-- EstimatePlayerProgress, which moves `characterLevel` to PoB's estimate when `characterLevelAutoMode`
-- is on, so both are put back afterwards; when they had changed, the config mod list and the outputs
-- are rebuilt for the restored level. A read: the build is left as it was.
function M.get_warnings()
  if not build or not build.calcsTab or not build.controls or not build.controls.warnings then
    return nil, 'build not initialized'
  end
  local output, err = M.get_main_output()
  if not output then return nil, err end
  local level, autoMode = build.characterLevel, build.characterLevelAutoMode
  local ok, refreshErr = pcall(function() build:RefreshStatList() end)
  M.restore_level(level, autoMode)
  if not ok then return nil, 'refreshing the stat list failed: ' .. tostring(refreshErr) end
  local lines = {}
  for _, line in ipairs(build.controls.warnings.lines or {}) do
    if type(line) == 'string' then table.insert(lines, strip_color_codes(line)) end
  end
  return { lines = lines }
end

-- D-383: the nodes `node`'s unlock constraint names that aren't allocated, each {id, name, ascendancy}, or nil
-- when it has no constraint or every node it names is. PoB unlocks such a node only while all of them are
-- (Classes/PassiveSpec.lua:1248-1251; PassiveTreeView:checkUnlockConstraints). `isAllocated(id)` says whether
-- a node counts as allocated: the spec's own allocation, or a plan stage's listed nodes.
function M.unmet_unlock(nodes, node, isAllocated)
  local constraint = node and node.unlockConstraint
  if type(constraint) ~= 'table' then return nil end
  local needs = {}
  for _, id in ipairs(constraint.nodes or {}) do
    if not isAllocated(id) then
      local need = nodes[id]
      needs[#needs + 1] = {
        id = id, name = need and tostring(need.dn or need.name) or ('Node ' .. tostring(id)),
        ascendancy = need and need.ascendancyName or nil,
      }
    end
  end
  if #needs == 0 then return nil end
  return needs
end

-- D-384: a gem PoB marks legacy: its granted effect's `legacy` (vendor Data/Skills/*.lua), which PoB's gem
-- selector hides unless "Show legacy gems" is ticked (Classes/GemSelectControl.lua:115). Not PoB's `Tier = 0`,
-- which ascendancy- and item-granted skills have too.
function M.is_legacy_gem(gemData)
  return type(gemData) == 'table' and type(gemData.grantedEffect) == 'table' and gemData.grantedEffect.legacy == true
end

-- D-384: whether a unique item (an equipped or parsed Item, or a main.uniqueDB entry) is one PoB marks no
-- longer obtainable, by its item database's own rule (Classes/ItemDBControl.lua:118-119): source "No longer
-- obtainable", or a Race Events league. An item's own text rarely carries those lines, so its database entry
-- (Item:GetUniqueDBItem) is read first.
function M.is_unobtainable_unique(item)
  if type(item) ~= 'table' or (item.rarity ~= nil and item.rarity ~= 'UNIQUE' and item.rarity ~= 'RELIC') then return false end
  local entry = type(item.GetUniqueDBItem) == 'function' and _G.main and main.uniqueDB and item:GetUniqueDBItem() or nil
  local source = (entry and entry.source) or item.source
  local league = (entry and entry.league) or item.league
  return source == 'No longer obtainable' or league == 'Race Events'
end

-- D-383, D-384: what the game won't allow in the loaded build, which PoB itself allows (from a node list: a
-- saved file, an import, set_tree; legacy gems behind "Show legacy gems"; any unique's text). A read:
-- - lockedNodes: each allocated node whose unlock constraint is unmet, by id;
-- - legacyGems: each gem PoB marks legacy in the active skill set's groups, by group, then gem;
-- - unobtainableUniques: each equipped unique PoB marks no longer obtainable, by slot.
function M.get_rule_breaks()
  local spec = build and build.spec
  if not spec then return nil, 'build not initialized' end
  local locked = {}
  local function allocated(id) return spec.nodes[id] ~= nil and spec.nodes[id].alloc == true end
  for id, node in pairs(spec.allocNodes or {}) do
    local needs = M.unmet_unlock(spec.nodes, node, allocated)
    if needs then locked[#locked + 1] = { id = id, name = tostring(node.dn or node.name), needs = needs } end
  end
  table.sort(locked, function(a, b) return a.id < b.id end)
  local legacy = {}
  for gi, group in ipairs(build.skillsTab and build.skillsTab.socketGroupList or {}) do
    for _, gem in ipairs(group.gemList or {}) do
      if M.is_legacy_gem(gem.gemData) then
        legacy[#legacy + 1] = { name = tostring(gem.gemData.name), group = gi,
          label = (type(group.label) == 'string' and group.label ~= '') and group.label or nil }
      end
    end
  end
  local unobtainable = {}
  local itemsTab = build.itemsTab
  for slotName, slot in pairs(itemsTab and itemsTab.slots or {}) do
    local item = (slot.selItemId or 0) > 0 and itemsTab.items[slot.selItemId] or nil
    if item and M.is_unobtainable_unique(item) then
      unobtainable[#unobtainable + 1] = { name = tostring(item.title or item.name), slot = tostring(slotName) }
    end
  end
  table.sort(unobtainable, function(a, b) return a.slot < b.slot end)
  return { lockedNodes = locked, legacyGems = legacy, unobtainableUniques = unobtainable }
end

-- The ascendancy points `update_tree_delta` allows (stated in its tool description).
local MAX_ASCENDANCY_POINTS = 8

-- Whether allocating `node` uses an ascendancy point, as PassiveSpec:CountAllocNodes counts them: a node
-- of the primary ascendancy that isn't its start node, a free allocation or a multiple-choice option.
local function is_ascendancy_point(spec, node)
  if not node.ascendancyName or node.isMultipleChoiceOption or node.isFreeAllocate ~= nil then return false end
  if node.type == 'ClassStart' or node.type == 'AscendClassStart' then return false end
  local secondary = spec.tree.secondaryAscendNameMap
  return not (secondary and secondary[node.ascendancyName])
end

-- The ascendancy points the active spec uses (PassiveSpec:CountAllocNodes; the start node excluded).
local function ascendancy_points_used(spec)
  local _, ascUsed = spec:CountAllocNodes()
  return ascUsed
end

-- The whole-number ids of a list param, in order.
local function id_list(list)
  local out = {}
  if type(list) == 'table' then
    for _, v in ipairs(list) do
      local id = tonumber(v)
      if id then out[#out + 1] = id end
    end
  end
  return out
end

-- `<id> (<name>), …` for a list of node ids.
local function node_labels(ids)
  local out = {}
  for _, id in ipairs(ids) do out[#out + 1] = node_label(id) end
  return table.concat(out, ', ')
end

-- Apply a delta to `spec` (the active spec, or a throwaway copy for a dry run):
--  1. one re-import of (current - remove + add), as before, keeping the tags and choices; the adds that
--     cost ascendancy points are left to step 2, so the cap applies to every add;
--  2. each add PoB left unallocated, in the order given, along PoB's own path (PassiveSpec:AllocNode,
--     untagged). D-460 (B8): an untagged node connects through untagged nodes only (PoB's own rule,
--     PassiveSpec:CanPathThroughAllocMode, vendor/Classes/PassiveSpec.lua:826-830), so when PoB's shortest
--     path runs through allocated weapon-set nodes, which AllocNode would untag (GetEffectiveAllocationPath,
--     :890-915), the add takes the shortest path from the untagged tree instead (PoB's GetAllocationPath in
--     normal mode, :832-888). An add is skipped when its path would take the ascendancy points over 8, or
--     when no untagged path reaches it and PoB's runs through weapon-set nodes: those adds are listed in
--     `retagged`, not allocated;
--  3. every node allocated before the call keeps its attribute choice (AllocNode sets path attribute
--     nodes to PoB's default, PassiveSpec.lua:939).
-- Returns the result ({autoPathedNodes, autoPathedNames, skippedAscendancyNodes, retagged}) and whether `spec`
-- changed.
local function apply_delta(spec, params, current, removeNodes, addNodes)
  local result = { autoPathedNodes = {}, autoPathedNames = {}, skippedAscendancyNodes = {}, retagged = {} }
  local changed = false
  local priorChoices = {}
  for id in pairs(spec.allocNodes) do priorChoices[id] = spec.hashOverrides[id] or false end

  local set, alters = {}, false
  for _, id in ipairs(current.nodes) do set[id] = true end
  for _, id in ipairs(removeNodes) do
    if set[id] then set[id] = nil; alters = true end
  end
  for _, id in ipairs(addNodes) do
    local node = spec.nodes[id]
    if node and not set[id] and not is_ascendancy_point(spec, node) then set[id] = true; alters = true end
  end
  local reclass = params.classId ~= nil or params.ascendClassId ~= nil
    or params.secondaryAscendClassId ~= nil or params.treeVersion ~= nil
  if alters or reclass then
    local nodes = {}
    for id in pairs(set) do nodes[#nodes + 1] = id end
    table.sort(nodes)
    local classId = params.classId or current.classId or 0
    local ascendId = params.ascendClassId or current.ascendClassId or 0
    local secId = params.secondaryAscendClassId or current.secondaryAscendClassId or 0
    reimport_nodes(tonumber(classId) or 0, tonumber(ascendId) or 0, tonumber(secId) or 0, nodes,
      params.treeVersion or current.treeVersion, nil, spec)
    changed = true
  end

  local requested = {}
  for _, id in ipairs(addNodes) do requested[id] = true end
  -- Normal (untagged) allocation, whatever mode the spec was left in.
  local allocMode = spec.allocMode
  spec.allocMode = 0
  for _, id in ipairs(addNodes) do
    local node = spec.nodes[id]
    local path = node and not node.alloc and node.path and spec:GetEffectiveAllocationPath(node)
    local altPath
    if path and #(node.intuitiveLeapLikesAffecting or {}) == 0 then
      local tagged = false
      for _, pathNode in ipairs(path) do
        if pathNode.alloc and (pathNode.allocMode or 0) ~= 0 then tagged = true break end
      end
      if tagged then
        altPath = spec:GetAllocationPath(node, 0)
        if altPath then path = altPath end
      end
    end
    if path then
      local cost, branch = 0, {}
      for _, pathNode in ipairs(path) do
        if not pathNode.alloc and is_ascendancy_point(spec, pathNode) then cost = cost + 1 end
        if pathNode.alloc and (pathNode.allocMode or 0) ~= 0 then branch[#branch + 1] = pathNode.id end
      end
      if #branch > 0 then
        table.sort(branch)
        table.insert(result.retagged, { id = id, branch = branch })
      elseif cost > 0 and ascendancy_points_used(spec) + cost > MAX_ASCENDANCY_POINTS then
        table.insert(result.skippedAscendancyNodes, id)
      else
        local before = {}
        for allocId in pairs(spec.allocNodes) do before[allocId] = true end
        spec:AllocNode(node, altPath)
        changed = true
        local pathed = {}
        for allocId in pairs(spec.allocNodes) do
          if not before[allocId] and not requested[allocId] then pathed[#pathed + 1] = allocId end
        end
        table.sort(pathed)
        for _, allocId in ipairs(pathed) do
          local pathNode = spec.nodes[allocId]
          table.insert(result.autoPathedNodes, allocId)
          table.insert(result.autoPathedNames, tostring(pathNode and (pathNode.dn or pathNode.name) or '?'))
        end
      end
    end
  end
  spec.allocMode = allocMode

  local restored = false
  for id, prior in pairs(priorChoices) do
    if spec.allocNodes[id] and (spec.hashOverrides[id] or false) ~= prior then
      spec.hashOverrides[id] = prior or nil
      restored = true
    end
  end
  if restored then spec:BuildAllDependsAndPaths() end
  return result, changed
end

-- The refusal for adds whose path runs through allocated weapon-set nodes (C-48: tags change only
-- through set_tree_state).
local function retag_refusal(retagged)
  local problems = {}
  for _, r in ipairs(retagged) do
    problems[#problems + 1] = string.format('node %s: its path runs through weapon-set node(s) %s, which allocating it would untag',
      node_label(r.id), node_labels(r.branch))
  end
  return table.concat(problems, '; ') .. ' (PoB connects an untagged node only through untagged nodes). '
    .. 'Nothing was changed; weapon-set tags change only through set_tree_state.'
end

-- Update tree by delta lists (C-48, D-194).
-- params: { addNodes?, removeNodes?, classId?, ascendClassId?, secondaryAscendClassId?, treeVersion? }
-- See apply_delta: one re-import of (current - remove + add) keeping the tags and choices, then each add
-- PoB left unallocated along PoB's own path, through untagged nodes only (D-460, B8), in the order given;
-- the path nodes beyond the requested ones are `autoPathedNodes`, their names `autoPathedNames` in the same
-- order, and an add whose path would take the ascendancy points (as PassiveSpec:CountAllocNodes counts them)
-- over 8 is in `skippedAscendancyNodes`. Already allocated nodes keep their tags and choices: an add that only
-- a path through a weapon-set branch reaches (it would untag the branch) fails the whole call, decided by a
-- dry run on a throwaway spec, so the build is left as it was. An unknown, unreachable or already allocated
-- node adds nothing, and an empty delta changes nothing.
-- Returns { autoPathedNodes, autoPathedNames, skippedAscendancyNodes, ascendancyPointsUsed } (the points after
-- the call).
function M.update_tree_delta(params)
  if not build or not build.spec then return nil, 'build/spec not initialized' end
  params = type(params) == 'table' and params or {}
  local current, err = M.get_tree()
  if not current then return nil, err end
  local removeNodes, addNodes = id_list(params.removeNodes), id_list(params.addNodes)
  local spec = build.spec

  -- What the spec holds now: its tags and choices, also what puts it back.
  local tags = {}
  for id, node in pairs(spec.allocNodes) do
    if node.allocMode and node.allocMode ~= 0 then tags[id] = node.allocMode end
  end
  if next(tags) ~= nil and #addNodes > 0 then
    -- Only a tree with weapon-set nodes can have a branch untagged: try the delta on a throwaway spec
    -- (made as create_spec makes one, never added to the tree tab) first.
    local scratch = construct('PassiveSpec', build, spec.treeVersion)
    scratch.jewels = copyTable(spec.jewels or {})
    scratch:ImportFromNodeList(nil, current.classId, current.ascendClassId, current.secondaryAscendClassId,
      current.nodes, tags, copyTable(spec.hashOverrides or {}, true), copyTable(spec.masterySelections or {}, true))
    local dry = apply_delta(scratch, params, current, removeNodes, addNodes)
    if #dry.retagged > 0 then return nil, retag_refusal(dry.retagged) end
  end

  local priorChoices = copyTable(spec.hashOverrides or {}, true)
  local result, changed = apply_delta(spec, params, current, removeNodes, addNodes)
  if #result.retagged > 0 then
    -- Never expected after the dry run (it can differ only on a tie between equal paths); the
    -- allocation, tags and choices are put back all the same.
    reimport_nodes(current.classId, current.ascendClassId, current.secondaryAscendClassId, current.nodes,
      current.treeVersion, { weaponSets = tags, hashOverrides = priorChoices })
    M.get_main_output()
    return nil, retag_refusal(result.retagged)
  end
  if changed then M.get_main_output() end
  result.retagged = nil
  result.ascendancyPointsUsed = ascendancy_points_used(build.spec)
  return result
end

-- Calculate what-if scenario without persisting changes.
-- params: { addNodes?: number[], removeNodes?: number[], useFullDPS?: boolean, fields?: string[] }
-- Returns { <field> = number } for the requested fields (default: DEFAULT_STAT_FIELDS) whose value
-- is a number; never PoB's raw output, which holds reference cycles and cannot be encoded (E1).
function M.calc_with(params)
  if not build or not build.calcsTab then return nil, 'build not initialized' end
  local calcFunc = build.calcsTab:GetMiscCalculator()
  local override = {}
  if params and type(params.addNodes) == 'table' then
    override.addNodes = {}
    for _, id in ipairs(params.addNodes) do
      local n = build.spec and build.spec.nodes and build.spec.nodes[tonumber(id)]
      if n then override.addNodes[n] = true end
    end
  end
  if params and type(params.removeNodes) == 'table' then
    override.removeNodes = {}
    for _, id in ipairs(params.removeNodes) do
      local n = build.spec and build.spec.nodes and build.spec.nodes[tonumber(id)]
      if n then override.removeNodes[n] = true end
    end
  end
  local out = calcFunc(override, params and params.useFullDPS)
  if type(out) ~= 'table' then return nil, 'calculator returned no output' end
  local fields = (params and type(params.fields) == 'table') and params.fields or M.DEFAULT_STAT_FIELDS
  local result = {}
  -- D-388: a `Minion<Field>` reads the minion's own output, as get_stats does (D-376).
  for _, k in ipairs(fields) do
    local v = output_field(out, k)
    if type(v) == 'number' then result[k] = v end
  end
  return result
end


-- PoB2's config options: the list `Modules/ConfigOptions` returns, which ConfigTab builds its controls
-- from. Loaded once per engine process. Each entry is {var, type, section, list?, label?, varData},
-- deduplicated by var (the first entry wins, as for ConfigTab's own varControls). `label` is the option's
-- label without PoB's colour codes (C-37c); `varData` is PoB's own entry, for the lookup's config mode.
local configOptionsCache

local function strip_colour_codes(text)
  return (tostring(text):gsub('%^x%x%x%x%x%x%x', ''):gsub('%^%d', ''))
end

local function config_options()
  if configOptionsCache then return configOptionsCache end
  local ok, varList = pcall(LoadModule, 'Modules/ConfigOptions')
  if not ok or type(varList) ~= 'table' then return nil, 'could not load the config option list' end
  local list, byVar, section = {}, {}, ''
  for _, varData in ipairs(varList) do
    if varData.section then
      section = varData.section
    elseif varData.var and not byVar[varData.var] then
      local label = type(varData.label) == 'string' and strip_colour_codes(varData.label):match('^%s*(.-)%s*$') or nil
      if label == '' then label = nil end
      local option = {
        var = varData.var, type = varData.type, section = section, list = varData.list, label = label, varData = varData,
      }
      if varData.type == 'list' then
        -- The value a new config set holds for this list (ConfigTab:CreateConfigSet): the default entry
        -- when the option names one, else its defaultState (nil for every list PoB2 ships). It is also
        -- what PoB reloads for the option when a save leaves it out (ConfigTab:Load starts from it).
        option.initial = varData.defaultIndex and varData.list and varData.list[varData.defaultIndex]
          and varData.list[varData.defaultIndex].val or varData.defaultState
      end
      list[#list + 1] = option
      byVar[varData.var] = option
    end
  end
  configOptionsCache = { list = list, byVar = byVar }
  return configOptionsCache
end

local function is_scalar(v)
  local t = type(v)
  return t == 'string' or t == 'boolean' or (t == 'number' and v == v and v ~= math.huge and v ~= -math.huge)
end

-- The Lua type GetDefaultState falls back on for an option type.
local CONFIG_VALUE_TYPE = {
  check = 'boolean', count = 'number', countAllowZero = 'number', integer = 'number', float = 'number',
  text = 'string',
}

-- The build's config (the active config set), over PoB2's config options only:
--   enemyLevel: the enemy level in effect (ConfigTab:UpdateLevel);
--   input:      every option the build sets, with its scalar value;
--   defaults:   for every option it doesn't set, the value PoB uses instead (ConfigTab:GetDefaultState:
--               the placeholder, else the option's default state);
--   options:    every option key in PoB's order, with its type, section and label (C-37c).
function M.get_config()
  local ct = build and build.configTab
  if not ct or not ct.configSets then return nil, 'build/config not initialized' end
  local configSet = ct.configSets[ct.activeConfigSetId]
  if not configSet then return nil, 'no active config set' end
  local opts, err = config_options()
  if not opts then return nil, err end
  local input, defaults, options = {}, {}, {}
  for _, option in ipairs(opts.list) do
    local v = configSet.input[option.var]
    if is_scalar(v) then
      input[option.var] = v
    else
      local d = ct:GetDefaultState(option.var, CONFIG_VALUE_TYPE[option.type])
      if is_scalar(d) then defaults[option.var] = d end
    end
    options[#options + 1] = { key = option.var, type = option.type, section = option.section, label = option.label }
  end
  return { enemyLevel = ct.enemyLevel, input = input, defaults = defaults, options = options }
end

-- One set_config value, checked against its option the way PoB's config controls accept input.
-- Returns true, value (nil clears the option) or false, error. `checkDefaults` (D-460, B6): only
-- load_config_preset's clearing asks for it (set_config's CHECK_DEFAULTS key); then an empty value puts a
-- checkbox back to PoB's default, its defaultState (what a new config set holds, Classes/ConfigTab.lua:981): on
-- for a checkbox PoB defaults to on, cleared (off) for any other. Every other caller (set_config, the compile's
-- check and writes) has an empty value on a checkbox refused, as before.
local function config_value(option, v, checkDefaults)
  local key, t = option.var, option.type
  if t == 'check' then
    if type(v) == 'boolean' then return true, v end
    if v == 'true' then return true, true end
    if v == 'false' then return true, false end
    if v == '' and checkDefaults == true then return true, option.varData and option.varData.defaultState end
    return false, string.format("config option '%s' is a checkbox: the value must be true or false", key)
  end
  -- An empty value clears the option back to PoB's default. A list can't be emptied in PoB (its
  -- dropdown always writes a value, and BuildModList only applies a list option that holds one), so a
  -- list goes back to the value a new config set holds (enemyIsBoss: "Pinnacle"), which is also what it
  -- reloads as after a save; any other field is emptied, like emptying it in PoB.
  if v == '' then
    if t == 'list' then return true, option.initial end
    return true, nil
  end
  if t == 'count' or t == 'countAllowZero' or t == 'integer' or t == 'float' then
    local n = tonumber(v)
    if type(v) == 'boolean' or not n or not is_scalar(n) then
      return false, string.format("config option '%s' takes a number", key)
    end
    if t ~= 'float' and n ~= math.floor(n) then
      return false, string.format("config option '%s' takes a whole number", key)
    end
    if t ~= 'integer' and t ~= 'float' and n < 0 then
      return false, string.format("config option '%s' takes a number of 0 or more", key)
    end
    return true, n
  elseif t == 'list' then
    local s = tostring(v)
    local vals = {}
    for _, item in ipairs(option.list or {}) do
      if tostring(item.val) == s then return true, item.val end
      vals[#vals + 1] = tostring(item.val)
    end
    -- PoB's XML loader keeps a saved list value verbatim, line endings included (quest rewards saved
    -- on Windows hold "\r\n"), so a value that differs from a list value only in carriage returns is
    -- that value, kept as given.
    local bare = (s:gsub('\r', ''))
    for _, item in ipairs(option.list or {}) do
      if type(v) == 'string' and (tostring(item.val):gsub('\r', '')) == bare then return true, v end
    end
    for _, item in ipairs(option.list or {}) do
      if tostring(item.val):lower() == s:lower() then return true, item.val end
    end
    return false, string.format("config option '%s' must be one of: %s", key, table.concat(vals, ', '))
  elseif t == 'text' then
    if type(v) ~= 'string' then return false, string.format("config option '%s' takes text", key) end
    return true, v
  end
  return false, string.format("config option '%s' has an unsupported type '%s'", key, tostring(t))
end

-- D-460 (B6): the one params key of set_config that isn't a config option: `true` asks that an empty value put a
-- checkbox back to PoB's default (config_value's `checkDefaults`). Only load_config_preset's handler sends it
-- (src/handlers/configHandlers.ts); no PoB config option has this name.
local CHECK_DEFAULTS = '__checkboxDefaults'
M.CHECK_DEFAULTS = CHECK_DEFAULTS

-- Set config options and rebuild. params: { <config option key> = value, ... } (see config_value), and
-- CHECK_DEFAULTS = true from load_config_preset only. Every key is checked before anything changes: an unknown
-- key or a bad value changes nothing. Values go into the active config set's input, as PoB's config controls
-- write them, then ConfigTab's BuildModList recomputes the config mods (and the enemy level, from
-- input.enemyLevel).
function M.set_config(params)
  local ct = build and build.configTab
  if not ct or not ct.configSets then return nil, 'build/config not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  local configSet = ct.configSets[ct.activeConfigSetId]
  if not configSet then return nil, 'no active config set' end
  local opts, err = config_options()
  if not opts then return nil, err end
  local checkDefaults = params[CHECK_DEFAULTS]
  if checkDefaults ~= nil and checkDefaults ~= true then return nil, CHECK_DEFAULTS .. ' takes only true' end
  local keys = {}
  for k in pairs(params) do
    if k ~= CHECK_DEFAULTS then keys[#keys + 1] = tostring(k) end
  end
  table.sort(keys)
  if #keys == 0 then return nil, 'no config options given' end
  local values = {}
  for _, k in ipairs(keys) do
    local option = opts.byVar[k]
    if not option then
      local hint = ''
      for _, o in ipairs(opts.list) do
        if o.var:lower() == k:lower() then hint = string.format(" (did you mean '%s'?)", o.var) break end
      end
      return nil, string.format("unknown config option '%s'%s; get_config lists PoB2's option keys", k, hint)
    end
    local ok, value = config_value(option, params[k], checkDefaults)
    if not ok then return nil, value end
    values[k] = { value = value }
  end
  for _, k in ipairs(keys) do configSet.input[k] = values[k].value end
  ct:BuildModList()
  M.get_main_output()
  return true
end

-- The option list and the per-value check set_config uses, for the compiler's read-only preflight
-- (API/Compile.lua's compile_check, C-41), so the two never disagree on what a valid option is. The lookup's
-- config mode (API/Lookup.lua, C-37c) reads the same list.
M.config_options = config_options
M.config_value = config_value


local function nonblank(v)
  if v ~= nil and tostring(v):match('%S') then return tostring(v) end
  return nil
end

-- A skill's name for headings and messages: PoB's granted-effect name; for a hidden effect whose name
-- is "" (Mirage Archer's MirageArcherSpawnPlayer), the gem's name, else the granted effect's id.
local function effect_name(grantedEffect, srcInstance)
  return nonblank(grantedEffect.name) or nonblank(srcInstance and srcInstance.nameSpec) or tostring(grantedEffect.id)
end

-- "1 Impact, 2 Poison Cloud, 3 Explosion": a granted effect's stat sets, as PoB's stat-set dropdown
-- lists them (vendor Modules/Build.lua RefreshSkillSelectControls); a minion skill's too (D-377, its
-- minion stat-set dropdown, Modules/Build.lua:2056-2057), which has no gem, so it falls back to its name.
local function stat_set_label(grantedEffect, index, srcInstance)
  local set = grantedEffect.statSets and grantedEffect.statSets[index]
  return nonblank(set and set.label) or effect_name(grantedEffect, srcInstance)
end

-- D-377: a summon's minion and its skill list, as PoB's minion-skill dropdown shows them (vendor
-- Modules/Build.lua:2046-2062): the minion's live skills in list order (its own in data order, then the
-- ones supports add), the selected one (`minion.mainSkill`) and that skill's stat set. `active` is an
-- entry of a group's displaySkillList; nil when it has no minion with a skill list (a "Command" skill).
-- { minion, minionId, skills, index, name, statSet, statSets (the selected skill's stat-set labels) }
local function minion_of(active)
  local minion = active and active.minion
  local list = minion and minion.activeSkillList
  if type(list) ~= 'table' or not list[1] then return nil end
  local skills, index = {}, nil
  for i, skill in ipairs(list) do
    local ge = skill.activeEffect and skill.activeEffect.grantedEffect
    skills[i] = ge and tostring(ge.name) or '?'
    if skill == minion.mainSkill then index = i end
  end
  local main = minion.mainSkill
  local ge = main and main.activeEffect and main.activeEffect.grantedEffect
  local labels = {}
  for i = 1, #(ge and ge.statSets or {}) do labels[i] = stat_set_label(ge, i) end
  return {
    minion = tostring(minion.minionData and minion.minionData.name or minion.type),
    minionId = tostring(minion.type),
    skills = skills,
    index = index,
    name = ge and tostring(ge.name) or nil,
    statSet = main and main.activeEffect.statSet and main.activeEffect.statSet.index or 1,
    statSets = labels,
  }
end

-- Skills API
-- Each group lists, besides its skills and gems, every summon among its active skills (`minions`, D-377):
-- the active skill's index and name, its minion, the minion's skills in order and the selected one.
function M.get_skills()
  if not build or not build.skillsTab or not build.calcsTab then return nil, 'skills not initialized' end
  local groups = {}
  for idx, g in ipairs(build.skillsTab.socketGroupList or {}) do
    local names = {}
    local minions = nil
    if g.displaySkillList then
      for i, eff in ipairs(g.displaySkillList) do
        if eff and eff.activeEffect and eff.activeEffect.grantedEffect then
          table.insert(names, eff.activeEffect.grantedEffect.name)
        end
        local minion = minion_of(eff)
        if minion then
          minion.activeSkill = i
          minion.summon = eff.activeEffect and eff.activeEffect.grantedEffect and tostring(eff.activeEffect.grantedEffect.name) or nil
          minions = minions or {}
          table.insert(minions, minion)
        end
      end
    end
    -- Engine-truth per-gem breakdown (active vs support). PoB2 marks supports via
    -- gemData.grantedEffect.support; tags come from the gem data.
    local gems = {}
    local activeCount, supportCount = 0, 0
    for gidx, gem in ipairs(g.gemList or {}) do
      local gd = gem.gemData
      local ge = gd and gd.grantedEffect
      local isSupport = (ge and ge.support == true) or false
      local resolvedName = (ge and ge.name) or gem.nameSpec or 'Unknown'
      if isSupport then supportCount = supportCount + 1 else activeCount = activeCount + 1 end
      -- Authoritative boolean tag keys (tagString omits the primary delivery
      -- tag like attack/spell, so callers need these for gating checks).
      local tagKeys = {}
      if gd and type(gd.tags) == 'table' then
        for k, v in pairs(gd.tags) do if v == true then table.insert(tagKeys, k) end end
      end
      table.insert(gems, {
        index = gidx,
        name = resolvedName,
        nameSpec = gem.nameSpec,
        level = gem.level,
        quality = gem.quality or 0,
        enabled = gem.enabled ~= false,
        isSupport = isSupport,
        gemType = gd and gd.gemType,
        tags = gd and gd.tagString,
        tagKeys = tagKeys,
        known = gd ~= nil,
      })
    end
    table.insert(groups, {
      index = idx,
      label = g.label,
      slot = g.slot,
      enabled = g.enabled,
      includeInFullDPS = g.includeInFullDPS,
      mainActiveSkill = g.mainActiveSkill,
      skills = names,
      gems = gems,
      activeCount = activeCount,
      supportCount = supportCount,
      minions = minions,
    })
  end
  local result = {
    mainSocketGroup = build.mainSocketGroup,
    calcsSkillNumber = build.calcsTab.input and build.calcsTab.input.skill_number or nil,
    groups = groups,
  }
  return result
end

-- Rebuild the outputs the way PoB's own Build:OnFrame does after a selection change: wipe the global
-- skill cache first, so no skill is measured from a cache entry of the previous selection.
local function rebuild_outputs()
  if GlobalCache and GlobalCache.cachedData and wipeGlobalCache then wipeGlobalCache() end
  return M.get_main_output()
end

-- D-377: a summon gem's minion stat-set lookups, PoB's `<MinionSkillIndexLookup[Calcs]>`: granted effect
-- id -> { minion skill index -> stat set }, one for the main selection and one for the Calcs tab.
local MINION_LOOKUPS = { 'skillMinionSkillStatSetIndexLookup', 'skillMinionSkillStatSetIndexLookupCalcs' }

-- A two-level lookup's tables and contents, so it can be put back with the same tables (nil stays nil).
local function copy_lookup(t)
  if type(t) ~= 'table' then return { value = t } end
  local entries = {}
  for k, inner in pairs(t) do
    if type(inner) == 'table' then
      local values = {}
      for i, v in pairs(inner) do values[i] = v end
      entries[k] = { table = inner, values = values }
    else
      entries[k] = { value = inner }
    end
  end
  return { table = t, entries = entries }
end

local function put_lookup(copy)
  local t = copy.table
  if not t then return copy.value end
  for k in pairs(t) do t[k] = nil end
  for k, e in pairs(copy.entries) do
    if e.table then
      for i in pairs(e.table) do e.table[i] = nil end
      for i, v in pairs(e.values) do e.table[i] = v end
      t[k] = e.table
    else
      t[k] = e.value
    end
  end
  return t
end

-- One gem's selection state: its scalar fields (the calculation writes `skillPart`, `skillMinion`,
-- `skillMinionSkill`, … on the main group's gems), its stat-set choices (`statSet`; nil stays nil) and
-- its minion stat-set lookups (D-377).
local function snapshot_gem(gem)
  local fields = {}
  for k, v in pairs(gem) do
    if SCALAR_TYPES[type(v)] then fields[k] = v end
  end
  local statSet = nil
  if type(gem.statSet) == 'table' then
    statSet = {}
    for k, v in pairs(gem.statSet) do statSet[k] = v end
  end
  local lookups = {}
  for _, key in ipairs(MINION_LOOKUPS) do lookups[key] = copy_lookup(gem[key]) end
  return { fields = fields, statSetTable = gem.statSet, statSet = statSet, lookups = lookups }
end

local function restore_gem(gem, s)
  for k, v in pairs(gem) do
    if SCALAR_TYPES[type(v)] and s.fields[k] == nil then gem[k] = nil end
  end
  for k, v in pairs(s.fields) do gem[k] = v end
  if s.statSet == nil then
    gem.statSet = s.statSetTable
  else
    local t = s.statSetTable
    for k in pairs(t) do t[k] = nil end
    for k, v in pairs(s.statSet) do t[k] = v end
    gem.statSet = t
  end
  for _, key in ipairs(MINION_LOOKUPS) do gem[key] = put_lookup(s.lookups[key]) end
end

-- The state a main-selection change can touch (C-44, C-45, D-176): the main group, the calcs tab's
-- group (`skill_number`), every group's main active skill (main and calcs), and each gem of the groups
-- named (snapshot_gem: its scalar fields, stat-set choices and minion stat-set lookups).
local function snapshot_selection(groupIndexes)
  local list = build.skillsTab.socketGroupList or {}
  local snap = {
    mainSocketGroup = build.mainSocketGroup,
    skillNumber = build.calcsTab.input.skill_number,
    groups = {},
    gems = {},
  }
  for i, g in ipairs(list) do
    snap.groups[i] = { group = g, mainActiveSkill = g.mainActiveSkill, mainActiveSkillCalcs = g.mainActiveSkillCalcs }
  end
  for _, gi in ipairs(groupIndexes) do
    for _, gem in ipairs(list[gi] and list[gi].gemList or {}) do
      if not snap.gems[gem] then snap.gems[gem] = snapshot_gem(gem) end
    end
  end
  return snap
end

-- Put back exactly what `snapshot_selection` recorded. The caller rebuilds afterwards.
local function restore_selection(snap)
  build.mainSocketGroup = snap.mainSocketGroup
  build.calcsTab.input.skill_number = snap.skillNumber
  for _, s in ipairs(snap.groups) do
    s.group.mainActiveSkill = s.mainActiveSkill
    s.group.mainActiveSkillCalcs = s.mainActiveSkillCalcs
  end
  for gem, s in pairs(snap.gems) do restore_gem(gem, s) end
end

local function stat_set_list(grantedEffect, srcInstance)
  local parts = {}
  for i = 1, #(grantedEffect.statSets or {}) do
    table.insert(parts, i .. ' ' .. stat_set_label(grantedEffect, i, srcInstance))
  end
  return table.concat(parts, ', ')
end

-- The error for a socket group index the build doesn't have.
local function missing_group(index, count)
  if count == 0 then return 'the build has no socket groups' end
  return ('socket group %s does not exist: the build has %d socket groups'):format(tostring(index), count)
end

local function socket_group_label(g)
  if g.label and tostring(g.label):match('%S') then return tostring(g.label) end
  return tostring(g.displayLabel or '')
end

-- "1 Basic Attack, 2 Leap Slam": a list's entries, numbered from 1. Exported for Compile.lua's minion-skill
-- defects (WU-78).
local function numbered(names)
  local parts = {}
  for i, name in ipairs(names) do parts[i] = i .. ' ' .. tostring(name) end
  return table.concat(parts, ', ')
end
M.numbered = numbered

local function is_whole(n)
  return type(n) == 'number' and n == math.floor(n) and n >= 1
end

-- D-377: select the skill a group's minion uses, by name, and that skill's stat set. It is the one
-- place that writes a minion-skill selection: set_main_selection calls it for the main group, and the
-- compile for every group whose plan names a minion skill. It never changes the main selection (the
-- main group and the groups' main active skills).
--
-- M.select_minion_skill({ groupIndex, name, statSet?, activeSkill? }) -> selection | nil, error
--   groupIndex   the socket group, 1-based. PoB builds a group's skills only when the group is the main
--                one or enabled (vendor Modules/CalcSetup.lua:1987), so another group is refused.
--   name         the minion skill's name, matched case-insensitively against the minion's live skill
--                list after a rebuild (`minion.activeSkillList`: its own skills in data order, then any
--                that supports add). A plan never holds an index, which supports and pins can move (spike A2).
--   statSet      the minion skill's stat set, 1-based; default 1.
--   activeSkill  optional: the summon's index among the group's active skills. Without it, the group's
--                summon. Either way the group must hold exactly one summon (an active skill with a minion);
--                a summon's "Command" skill has no minion and is refused.
--
-- Refused, writing nothing: a missing or unbuilt group; a group with no summon or with several; an active
-- skill that isn't the summon; a name the minion's list lacks (the error lists the list) or holds twice
-- (it names the positions); a stat set outside the skill's stat sets, which would crash PoB's
-- calculation (vendor Modules/CalcTools.lua:155; spike A3).
--
-- It writes PoB's own fields on the summon's gem, as PoB's minion-skill dropdowns do (vendor
-- Modules/Build.lua:461-475, Classes/CalcsTab.lua:143-154): `skillMinionSkill` and its Calcs-tab copy
-- `skillMinionSkillCalcs`, and the stat set in both lookups, `skillMinionSkillStatSetIndexLookup[Calcs]
-- [<summon's granted effect id>][<skill index>]`, which the build XML keeps as `<MinionSkillIndexLookup>`.
-- Then it rebuilds and confirms that the minion's main skill is the one selected.
--
-- The selection: { minion (its name), minionId, summon (the active skill's name), activeSkill (its index),
-- skills (the minion's skill names, in order), index, name, statSet, statSets (the skill's stat-set labels) }.
function M.select_minion_skill(params)
  if not build or not build.skillsTab or not build.calcsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid minion skill params' end
  local list = build.skillsTab.socketGroupList or {}
  local groupIndex = tonumber(params.groupIndex)
  local g = groupIndex and list[groupIndex]
  if not g then return nil, missing_group(params.groupIndex, #list) end
  local wanted = type(params.name) == 'string' and params.name:match('^%s*(.-)%s*$') or ''
  if wanted == '' then return nil, 'the minion skill name is empty' end
  local statSet = 1
  if params.statSet ~= nil then
    statSet = tonumber(params.statSet)
    if not is_whole(statSet) then
      return nil, ('minion stat set %s is not a stat set number (1, 2, …)'):format(tostring(params.statSet))
    end
  end
  if groupIndex ~= build.mainSocketGroup and not (g.enabled and g.slotEnabled ~= false) then
    return nil, ('socket group %d is disabled and not the main group, so PoB builds none of its skills; enable it or make it the main group'):format(groupIndex)
  end
  rebuild_outputs()

  -- The group's one summon.
  local actives, summons = {}, {}
  for i, active in ipairs(g.displaySkillList or {}) do
    local ge = active.activeEffect and active.activeEffect.grantedEffect
    actives[i] = ge and effect_name(ge, active.activeEffect.srcInstance) or '?'
    if minion_of(active) then table.insert(summons, i) end
  end
  if #summons == 0 then
    if #actives == 0 then return nil, ('socket group %d has no active skill, so it has no minion'):format(groupIndex) end
    return nil, ('socket group %d has no summon: none of its active skills (%s) has a minion; a summon\'s "Command" skill has none either'):format(
      groupIndex, numbered(actives))
  end
  if #summons > 1 then
    local parts = {}
    for k, i in ipairs(summons) do parts[k] = i .. ' ' .. actives[i] end
    return nil, ('socket group %d holds %d summons (%s); a minion skill needs a group with one summon'):format(
      groupIndex, #summons, table.concat(parts, ', '))
  end
  local summonIndex = summons[1]
  if params.activeSkill ~= nil and tonumber(params.activeSkill) ~= summonIndex then
    local a = tonumber(params.activeSkill)
    local what = actives[a] and ('active skill %s (%s) has no minion'):format(tostring(a), actives[a])
      or ('it has no active skill %s'):format(tostring(params.activeSkill))
    return nil, ('socket group %d\'s %s: its summon is active skill %d (%s)'):format(groupIndex, what, summonIndex, actives[summonIndex])
  end
  local summon = g.displaySkillList[summonIndex]
  local before = minion_of(summon)

  -- The name, resolved against the live list.
  local positions = {}
  for i, name in ipairs(before.skills) do
    if name:lower() == wanted:lower() then table.insert(positions, i) end
  end
  if #positions == 0 then
    return nil, ('%s (%s) has no skill named "%s": its skills are %s'):format(before.minion, actives[summonIndex], wanted, numbered(before.skills))
  end
  if #positions > 1 then
    local at = {}
    for k, i in ipairs(positions) do at[k] = tostring(i) end
    return nil, ('%s\'s skill list holds "%s" %d times, at positions %s, so the name is ambiguous: its skills are %s'):format(
      before.minion, wanted, #positions, table.concat(at, ' and '), numbered(before.skills))
  end
  local index = positions[1]
  local skillGe = summon.minion.activeSkillList[index].activeEffect.grantedEffect
  local count = #(skillGe.statSets or {})
  if statSet > count then
    local labels = {}
    for i = 1, count do labels[i] = stat_set_label(skillGe, i) end
    return nil, ('minion stat set %d is out of range: %s has %d stat set%s (%s)'):format(statSet, tostring(skillGe.name), count,
      count == 1 and '' or 's', numbered(labels))
  end
  local src = summon.activeEffect.srcInstance
  if type(src) ~= 'table' then
    return nil, ('%s in socket group %d has no gem to hold its minion skill'):format(actives[summonIndex], groupIndex)
  end

  -- PoB's own fields, then a rebuild and the confirmation.
  local prior = snapshot_gem(src)
  local summonId = summon.activeEffect.grantedEffect.id
  src.skillMinionSkill = index
  src.skillMinionSkillCalcs = index
  for _, key in ipairs(MINION_LOOKUPS) do
    src[key] = src[key] or {}
    src[key][summonId] = src[key][summonId] or {}
    src[key][summonId][index] = statSet
  end
  rebuild_outputs()
  local after = minion_of(g.displaySkillList and g.displaySkillList[summonIndex])
  if not (after and after.index == index and after.name == tostring(skillGe.name) and after.statSet == statSet) then
    restore_gem(src, prior)
    rebuild_outputs()
    return nil, ('PoB did not select %s\'s skill %d (%s), stat set %d'):format(before.minion, index, tostring(skillGe.name), statSet)
  end
  after.activeSkill = summonIndex
  after.summon = actives[summonIndex]
  return after
end

-- Set the main socket group, its main active skill and, with `statSet`, that skill's stat set (C-44).
-- The stat set is PoB2's `srcInstance.statSet[grantedEffectId]`, written as PoB's stat-set dropdown
-- does (vendor Modules/Build.lua:375-381); the build XML keeps it as `<StatSetIndex>`. With
-- `minionSkill` (D-377), select_minion_skill selects the group's minion skill and `minionStatSet`
-- (default 1), and the group's summon becomes its main active skill (`mainActiveSkill`, when given, must
-- be the summon). Nothing is changed when the group doesn't exist, the stat set is outside 1..n (the
-- error names n and the labels) or select_minion_skill refuses.
-- params: { mainSocketGroup?, mainActiveSkill?, statSet?, minionSkill?: string, minionStatSet? }
-- Returns true, or with `statSet` or `minionSkill` { statSet?: the stat set selected, minion?: the
-- minion selection }.
function M.set_main_selection(params)
  if not build or not build.skillsTab or not build.calcsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  if params.minionStatSet ~= nil and params.minionSkill == nil then
    return nil, 'minionStatSet selects the stat set of a minion skill, so it needs minionSkill'
  end
  local list = build.skillsTab.socketGroupList or {}
  local groupIndex = build.mainSocketGroup
  if params.mainSocketGroup ~= nil then
    groupIndex = tonumber(params.mainSocketGroup) or groupIndex
  end
  local g = list[groupIndex]
  if not g then return nil, missing_group(groupIndex, #list) end
  local snap = (params.statSet ~= nil or params.minionSkill ~= nil) and snapshot_selection({ groupIndex, build.mainSocketGroup }) or nil
  build.mainSocketGroup = groupIndex
  if params.mainActiveSkill ~= nil then
    g.mainActiveSkill = tonumber(params.mainActiveSkill) or g.mainActiveSkill
  end
  -- Keep calcsTab in sync: use active group index
  build.calcsTab.input.skill_number = build.mainSocketGroup
  rebuild_outputs()
  local minion = nil
  if params.minionSkill ~= nil then
    local err
    minion, err = M.select_minion_skill({
      groupIndex = groupIndex, name = params.minionSkill, statSet = params.minionStatSet, activeSkill = params.mainActiveSkill,
    })
    if not minion then
      restore_selection(snap)
      rebuild_outputs()
      return nil, err
    end
    if g.mainActiveSkill ~= minion.activeSkill then
      g.mainActiveSkill = minion.activeSkill
      rebuild_outputs()
    end
  end
  if params.statSet == nil then return minion and { minion = minion } or true end

  -- The group's main active skill, as the rebuild settled it (CalcSetup clamps mainActiveSkill).
  local active = g.displaySkillList and g.displaySkillList[g.mainActiveSkill or 1]
  local effect = active and active.activeEffect
  local ge = effect and effect.grantedEffect
  local refuse = nil
  if not (ge and effect.srcInstance) then
    refuse = ('socket group %d has no active skill, so it has no stat set to select'):format(groupIndex)
  else
    local count = #(ge.statSets or {})
    local index = tonumber(params.statSet)
    if not index or index ~= math.floor(index) or index < 1 or index > count then
      refuse = ('stat set %s is out of range: %s has %d stat set%s (%s)'):format(tostring(params.statSet),
        effect_name(ge, effect.srcInstance), count, count == 1 and '' or 's', stat_set_list(ge, effect.srcInstance))
    end
  end
  if refuse then
    restore_selection(snap)
    rebuild_outputs()
    return nil, refuse
  end
  local index = math.floor(tonumber(params.statSet))
  local src = effect.srcInstance
  src.statSet = src.statSet or {}
  src.statSet[ge.id] = index
  rebuild_outputs()
  return {
    statSet = {
      index = index,
      label = stat_set_label(ge, index, src),
      count = #ge.statSets,
      skill = effect_name(ge, src),
      grantedEffectId = tostring(ge.id),
    },
    minion = minion,
  }
end

-- C-45: for each active skill of one socket group (default: the main group), and each stat set of
-- each, the requested output fields, measured with that skill and stat set as the main selection.
-- Then the exact prior selection is restored and the build rebuilt, so the build, its export and its
-- outputs are as they were (D-176). Only number, string and boolean values are reported; a
-- `Minion<Field>` reads the minion's own output (D-376). A summon's entry names its minion's selected
-- skill (`minion`, as get_skills gives it; D-377), which the breakdown measures and never changes.
-- params: { groupIndex?: number, fields: string[] }
function M.stats_breakdown(params)
  if not build or not build.skillsTab or not build.calcsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid breakdown params' end
  if type(params.fields) ~= 'table' then return nil, 'breakdown.fields must be a list of output names' end
  local list = build.skillsTab.socketGroupList or {}
  local groupIndex = build.mainSocketGroup
  if params.groupIndex ~= nil then groupIndex = tonumber(params.groupIndex) end
  local g = groupIndex and list[groupIndex]
  if not g then return nil, missing_group(groupIndex, #list) end

  local snap = snapshot_selection({ groupIndex })
  local ok, measured = pcall(function()
    -- Make the group main first, so its skill list is built even when the group is disabled.
    build.mainSocketGroup = groupIndex
    build.calcsTab.input.skill_number = groupIndex
    rebuild_outputs()
    local skills = {}
    for i, active in ipairs(g.displaySkillList or {}) do
      local effect = active.activeEffect
      local ge = effect and effect.grantedEffect
      if ge and effect.srcInstance then
        table.insert(skills, { index = i, ge = ge, src = effect.srcInstance })
      end
    end
    local out = {}
    for _, s in ipairs(skills) do
      local src, id = s.src, s.ge.id
      local priorTable = src.statSet
      local prior = priorTable and priorTable[id]
      local entry = { index = s.index, name = effect_name(s.ge, src), grantedEffectId = tostring(id), statSets = {} }
      for j = 1, math.max(#(s.ge.statSets or {}), 1) do
        g.mainActiveSkill = s.index
        src.statSet = src.statSet or {}
        src.statSet[id] = j
        local output = rebuild_outputs() or {}
        local values = {}
        for _, k in ipairs(params.fields) do
          local v = output_field(output, k)
          if SCALAR_TYPES[type(v)] then values[k] = v end
        end
        if j == 1 then entry.minion = minion_of(g.displaySkillList and g.displaySkillList[s.index]) end
        table.insert(entry.statSets, { index = j, label = stat_set_label(s.ge, j, src), output = values })
      end
      -- This skill's own choice goes back before the next skill is measured.
      if priorTable then
        priorTable[id] = prior
        src.statSet = priorTable
      else
        src.statSet = nil
      end
      table.insert(out, entry)
    end
    return out
  end)
  restore_selection(snap)
  rebuild_outputs()
  if not ok then return nil, 'breakdown failed: ' .. tostring(measured) end
  return { groupIndex = groupIndex, label = socket_group_label(g), skills = measured }
end

-- Items API

-- The non-jewel slot an item ended up in (first in PoB's slot order), or nil when it isn't equipped.
local function equipped_slot(itemId)
  for _, slot in ipairs(build.itemsTab.orderedSlots or {}) do
    if slot.selItemId == itemId and not slot.nodeId then return slot.slotName end
  end
  return nil
end

-- With `validateOnly`, the text is parsed and the slot checked, and nothing changes (`id` is 0), so a
-- multi-step tool can check every item before its first change.
-- params: { text: string, slotName?: string, noAutoEquip?: boolean, validateOnly?: boolean }
function M.add_item_text(params)
  if not build or not build.itemsTab then return nil, 'items not initialized' end
  if type(params) ~= 'table' or type(params.text) ~= 'string' then return nil, 'missing text' end

  -- Validate input to prevent potential issues
  if #params.text == 0 then return nil, 'item text cannot be empty' end
  if #params.text > MAX_ITEM_TEXT_LENGTH then
    return nil, string.format('item text too long (max %d bytes)', MAX_ITEM_TEXT_LENGTH)
  end

  -- A named slot must exist; it is checked before the item is added, so a bad name changes nothing.
  local slotCtrl
  if params.slotName ~= nil then
    local slotName = tostring(params.slotName)
    slotCtrl = build.itemsTab.slots[slotName]
    if not slotCtrl then return nil, 'unknown item slot: ' .. slotName end
  end

  -- construct() picks PoB's constructor style (C-6, E3); pcall turns a parse error into a reply.
  local ok, item = pcall(construct, 'Item', params.text)
  if not ok then return nil, 'invalid item text: ' .. tostring(item) end
  if not item or not item.baseName then return nil, 'failed to parse item' end
  if slotCtrl and type(build.itemsTab.IsItemValidForSlot) == 'function'
      and not build.itemsTab:IsItemValidForSlot(item, slotCtrl.slotName) then
    return nil, string.format('%s (%s) cannot be equipped in %s', tostring(item.name), tostring(item.baseName),
      slotCtrl.slotName)
  end
  -- D-384: a unique PoB marks no longer obtainable is added as PoB adds it; the reply says so.
  local unobtainable = M.is_unobtainable_unique(item) or nil
  if params.validateOnly == true then
    return { id = 0, name = item.name, slot = slotCtrl and slotCtrl.slotName or nil, unobtainable = unobtainable,
      title = unobtainable and item.title or nil }
  end

  item:NormaliseQuality()
  -- With a named slot the item goes only there: PoB's auto-equip would also put it into the first
  -- empty slot it fits.
  build.itemsTab:AddItem(item, params.noAutoEquip == true or slotCtrl ~= nil)
  if slotCtrl then
    slotCtrl:SetSelItemId(item.id)
  end
  -- Re-populate every slot, as ItemsTab:AddDisplayItem does: the auto-equip path in AddItem selects a
  -- slot without refreshing its gear jewel sockets' `inactive` flags (ItemSlotControl:Populate).
  build.itemsTab:PopulateSlots()
  build.itemsTab:AddUndoState()
  build.buildFlag = true
  M.get_main_output()
  return { id = item.id, name = item.name, slot = slotCtrl and slotCtrl.slotName or equipped_slot(item.id),
    unobtainable = unobtainable, title = unobtainable and item.title or nil }
end

-- The slots with an activation checkbox in PoB2 (ItemSlotControl: "Flask N" and "Charm N").
local function is_activatable_slot(slotName)
  return slotName:match('^Flask %d+$') ~= nil or slotName:match('^Charm %d+$') ~= nil
end

-- Toggle a flask or charm, as PoB's slot checkbox does (ItemSlotControl): the calcs read the slot
-- control's `active` (CalcSetup), the item set's `active` is what the build file saves.
-- params: { slot: string ("Flask 1", "Charm 2", ...), active: boolean } ({ index } means "Flask <index>")
function M.set_flask_active(params)
  if not build or not build.itemsTab then return nil, 'items not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  local slotName = params.slot ~= nil and tostring(params.slot) or nil
  if not slotName and params.index ~= nil then
    local idx = tonumber(params.index)
    if not idx or idx < 1 then return nil, 'invalid flask index' end
    slotName = 'Flask ' .. tostring(idx)
  end
  if not slotName then return nil, 'missing slot' end
  local itemsTab = build.itemsTab
  local slotCtrl = itemsTab.slots and itemsTab.slots[slotName]
  if not slotCtrl or not is_activatable_slot(slotName) then
    return nil, 'not a flask or charm slot: ' .. slotName
  end
  local setSlot = itemsTab.activeItemSet and itemsTab.activeItemSet[slotName]
  if not setSlot then return nil, 'slot not found in the active item set: ' .. slotName end
  if (slotCtrl.selItemId or 0) == 0 then return nil, 'no item equipped in ' .. slotName end
  local active = params.active == true
  slotCtrl.active = active
  if slotCtrl.controls and slotCtrl.controls.activate then slotCtrl.controls.activate.state = active end
  setSlot.active = active
  itemsTab:AddUndoState()
  build.buildFlag = true
  M.get_main_output()
  return true
end

-- Whether PoB's UI would show a slot control: its `shown` property (a value or a function; weapon
-- swap slots follow the active weapon set, Ring 3 needs AdditionalRingSlot, gear jewel sockets need
-- an active socket). A `shown` function that raises counts as hidden.
local function slot_shown(slotCtrl)
  local shown = slotCtrl.shown
  if type(shown) == 'function' then
    local ok, value = pcall(shown)
    return ok and value and true or false
  end
  return shown ~= false and shown ~= nil
end

-- Get equipped items summary. Every slot control PoB creates is listed, including the hidden ones
-- (gear jewel sockets past the item's socket count, unallocated tree sockets, the inactive weapon
-- set, Ring 3); each entry carries `inactive` and `shown`, so callers can drop the hidden slots (E8).
function M.get_items()
  if not build or not build.itemsTab then return nil, 'items not initialized' end
  local itemsTab = build.itemsTab
  -- Refresh the hidden-slot flags first. Gear jewel sockets get `inactive` from ItemSlotControl:Populate
  -- (PopulateSlots), which only some edit paths run; tree sockets get it only from UpdateSockets
  -- (normally from ItemsTab:Draw), from the active spec's allocation (X11).
  if type(itemsTab.PopulateSlots) == 'function' then itemsTab:PopulateSlots() end
  if type(itemsTab.UpdateSockets) == 'function' then itemsTab:UpdateSockets() end
  local result = { }
  -- Prefer orderedSlots for deterministic order
  local ordered = itemsTab.orderedSlots or {}
  local seen = {}
  local function add_slot(slotName)
    if seen[slotName] then return end
    seen[slotName] = true
    local slotCtrl = itemsTab.slots[slotName]
    if not slotCtrl then return end
    local selId = slotCtrl.selItemId or 0
    local entry = {
      slot = slotName,
      id = selId,
      inactive = slotCtrl.inactive == true,
      shown = slot_shown(slotCtrl),
    }
    if selId > 0 then
      local it = itemsTab.items[selId]
      if it then
        entry.name = it.name
        entry.baseName = it.baseName
        entry.type = it.type
        entry.rarity = it.rarity
        entry.raw = it.raw
      end
    end
    -- Flask and charm activation: the slot control's flag, which is what the calcs read (X12).
    if is_activatable_slot(slotName) then
      entry.active = slotCtrl.active == true
    end
    table.insert(result, entry)
  end
  for _, slot in ipairs(ordered) do
    if slot and slot.slotName then add_slot(slot.slotName) end
  end
  -- Add any remaining slots not in ordered list
  for slotName, _ in pairs(itemsTab.slots or {}) do add_slot(slotName) end
  return result
end


-- Skill/Gem Creation and Modification API

-- Create a new socket group
-- params: { label?: string, slot?: string, enabled?: boolean, includeInFullDPS?: boolean, groupCount?: number }
-- `groupCount` (D-293) is the group's Count, how many copies act at once: PoB multiplies the group's
-- contribution to Full DPS by it (Modules/Calcs.lua calcFullDPS, through calcs.getActiveSkillCount) and saves
-- it as the group's `groupCount` (Classes/SkillsTab.lua:470). Without it the group has none, as in PoB.
function M.create_socket_group(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then params = {} end
  local groupCount = nil
  if params.groupCount ~= nil then
    groupCount = tonumber(params.groupCount)
    if not groupCount or groupCount ~= math.floor(groupCount) or groupCount < 1 or groupCount == math.huge then
      return nil, ('groupCount must be a whole number of at least 1, not %s'):format(tostring(params.groupCount))
    end
  end

  local socketGroup = {
    label = params.label or '',
    slot = params.slot,
    enabled = params.enabled ~= false,
    includeInFullDPS = params.includeInFullDPS == true,
    groupCount = groupCount,
    gemList = {},
    mainActiveSkill = 1,
    mainActiveSkillCalcs = 1,
  }

  -- Get the active skill set
  local skillSetId = build.skillsTab.activeSkillSetId or 1
  local skillSet = build.skillsTab.skillSets[skillSetId]
  if not skillSet then return nil, 'active skill set not found' end

  -- Add to socket group list
  table.insert(skillSet.socketGroupList, socketGroup)
  local index = #skillSet.socketGroupList

  -- Process the socket group
  if build.skillsTab.ProcessSocketGroup then
    build.skillsTab:ProcessSocketGroup(socketGroup)
  end

  build.buildFlag = true
  M.get_main_output()

  return { index = index, label = socketGroup.label, includeInFullDPS = socketGroup.includeInFullDPS,
    groupCount = socketGroup.groupCount }
end

-- The most gem-name suggestions an unknown name gets (D-50).
local MAX_GEM_SUGGESTIONS = 5

-- A gem's PoB base-type names, as data.gemForBaseName keys them (Data.lua setupGem): a support's name
-- plus " Support" (except SupportBarrage), and the gem's baseTypeName.
local function gem_base_names(gemData)
  local names = {}
  local baseName = gemData.name
  if gemData.grantedEffect and gemData.grantedEffect.support and gemData.grantedEffectId ~= 'SupportBarrage' then
    baseName = baseName .. ' Support'
  end
  table.insert(names, baseName)
  if type(gemData.baseTypeName) == 'string' and gemData.baseTypeName ~= baseName then
    table.insert(names, gemData.baseTypeName)
  end
  return names
end

-- How well `gemData` matches the name `name` (`lower` is it in lower case): 4 a base-type name
-- equals it, 3 the gem name equals it, 2 and 1 the same ignoring case; 0 no match.
local function gem_match_score(gemData, name, lower)
  local score = 0
  for _, baseName in ipairs(gem_base_names(gemData)) do
    if baseName == name then return 4 end
    if baseName:lower() == lower then score = 2 end
  end
  if gemData.name == name then return 3 end
  if score == 0 and gemData.name:lower() == lower then score = 1 end
  return score
end

-- Resolve a gem name against PoB's gem data (`data.gems`), the same way in every engine process
-- (pairs order never decides):
-- - a gem id (a `data.gems` key) names that gem;
-- - else the best-matching gems: a base-type name ("Unleash Support"; data.gemForBaseName) beats the gem
--   name, and the exact case beats a match ignoring case. PoB gives some gems the same name ("Unleash"
--   is a spell and a support, whose base-type name is "Unleash Support"), so this tells them apart;
-- - several best matches: the ones not granted by a unique item (no "Unique" in the id) are kept;
--   if several remain (e.g. the "Mace Strike" default attacks), the name is ambiguous, as PoB's own
--   SkillsTab:FindSkillGem rules it, and the error lists their ids, one of which picks the gem.
-- An unknown name fails with up to MAX_GEM_SUGGESTIONS names, matched ignoring case: names that start
-- with it first, then names that contain it, each group in name order.
function M.resolve_gem(name)
  name = tostring(name or '')
  if name:match('^%s*$') then return nil, 'missing gem name' end
  local gems = build and build.data and build.data.gems
  if not gems then return nil, 'gem data not initialized' end
  if type(gems[name]) == 'table' and type(gems[name].name) == 'string' then return gems[name] end
  local lower = name:lower()
  local best, bestScore = {}, 0
  for _, gemData in pairs(gems) do
    if type(gemData.name) == 'string' then
      local score = gem_match_score(gemData, name, lower)
      if score > bestScore then
        best, bestScore = { gemData }, score
      elseif score > 0 and score == bestScore then
        table.insert(best, gemData)
      end
    end
  end
  if #best > 1 then
    local regular = {}
    for _, gemData in ipairs(best) do
      if not tostring(gemData.id):find('Unique', 1, true) then table.insert(regular, gemData) end
    end
    if #regular > 0 then best = regular end
  end
  if #best == 1 then return best[1] end
  if #best > 1 then
    table.sort(best, function(a, b) return tostring(a.id) < tostring(b.id) end)
    local choices = {}
    for _, gemData in ipairs(best) do
      local detail = gemData.weaponRequirements or gemData.tagString
      table.insert(choices, tostring(gemData.id) .. (detail and detail ~= '' and (' (' .. detail .. ')') or ''))
    end
    return nil, string.format('ambiguous gem name "%s": PoB has %d gems by that name; pass one of their ids instead: %s',
      name, #best, table.concat(choices, '; '))
  end
  local prefix, contains, seen = {}, {}, {}
  for _, gemData in pairs(gems) do
    local gemName = gemData.name
    if type(gemName) == 'string' and not seen[gemName] then
      local start = gemName:lower():find(lower, 1, true)
      if start == 1 then
        seen[gemName] = true
        table.insert(prefix, gemName)
      elseif start then
        seen[gemName] = true
        table.insert(contains, gemName)
      end
    end
  end
  table.sort(prefix)
  table.sort(contains)
  local suggestions = {}
  for _, list in ipairs({ prefix, contains }) do
    for _, gemName in ipairs(list) do
      if #suggestions < MAX_GEM_SUGGESTIONS then table.insert(suggestions, gemName) end
    end
  end
  if #suggestions == 0 then
    return nil, string.format('unknown gem "%s"; no gem name contains it (see list_gems)', name)
  end
  return nil, string.format('unknown gem "%s". Did you mean: %s', name, table.concat(suggestions, ', '))
end

-- Add a gem to a socket group. With `validateOnly`, only the name is resolved (resolve_gem) and nothing
-- changes: `gemIndex` is 0 and `groupIndex` isn't needed, so a multi-step tool can check every name
-- before its first change.
-- params: { groupIndex: number, gemName: string, level?: number, quality?: number, qualityId?: string, enabled?: boolean, validateOnly?: boolean }
function M.add_gem(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  if params.validateOnly == true then
    local gemData, err = M.resolve_gem(params.gemName)
    if not gemData then return nil, err end
    return { gemIndex = 0, name = gemData.name, gemId = gemData.id, support = gemData.grantedEffect and gemData.grantedEffect.support == true or false,
      legacy = M.is_legacy_gem(gemData) or nil }
  end
  if not params.groupIndex or not params.gemName then return nil, 'missing groupIndex or gemName' end

  local skillSetId = build.skillsTab.activeSkillSetId or 1
  local skillSet = build.skillsTab.skillSets[skillSetId]
  if not skillSet then return nil, 'active skill set not found' end

  local groupIndex = tonumber(params.groupIndex)
  local socketGroup = skillSet.socketGroupList[groupIndex]
  if not socketGroup then return nil, 'socket group not found at index ' .. tostring(groupIndex) end

  local gemData, err = M.resolve_gem(params.gemName)
  if not gemData then return nil, err end

  local gemInstance = {
    nameSpec = gemData.name,
    level = tonumber(params.level) or 20,
    quality = tonumber(params.quality) or 0,
    qualityId = params.qualityId or 'Default',
    enabled = params.enabled ~= false,
    enableGlobal1 = true,
    enableGlobal2 = false,
    count = tonumber(params.count) or 1,
    gemId = gemData.id,
    skillId = gemData.grantedEffectId or (gemData.grantedEffect and gemData.grantedEffect.id),
    gemData = gemData,
  }

  table.insert(socketGroup.gemList, gemInstance)
  local gemIndex = #socketGroup.gemList

  if build.skillsTab.ProcessSocketGroup then
    build.skillsTab:ProcessSocketGroup(socketGroup)
  end

  build.buildFlag = true
  M.get_main_output()

  return { gemIndex = gemIndex, name = gemInstance.nameSpec, gemId = gemData.id,
    support = gemData.grantedEffect and gemData.grantedEffect.support == true or false,
    legacy = M.is_legacy_gem(gemData) or nil }
end

-- Set gem level
-- params: { groupIndex: number, gemIndex: number, level: number }
function M.set_gem_level(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  if not params.groupIndex or not params.gemIndex or not params.level then
    return nil, 'missing groupIndex, gemIndex, or level'
  end

  local skillSetId = build.skillsTab.activeSkillSetId or 1
  local skillSet = build.skillsTab.skillSets[skillSetId]
  if not skillSet then return nil, 'active skill set not found' end

  local groupIndex = tonumber(params.groupIndex)
  local gemIndex = tonumber(params.gemIndex)
  local level = tonumber(params.level)

  local socketGroup = skillSet.socketGroupList[groupIndex]
  if not socketGroup then return nil, 'socket group not found' end

  local gemInstance = socketGroup.gemList[gemIndex]
  if not gemInstance then return nil, 'gem not found' end

  if level < 1 or level > 40 then return nil, 'invalid level (must be 1-40)' end

  gemInstance.level = level

  if build.skillsTab.ProcessSocketGroup then
    build.skillsTab:ProcessSocketGroup(socketGroup)
  end

  build.buildFlag = true
  M.get_main_output()

  return true
end

-- Set gem quality
-- params: { groupIndex: number, gemIndex: number, quality: number, qualityId?: string }
function M.set_gem_quality(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  if not params.groupIndex or not params.gemIndex or not params.quality then
    return nil, 'missing groupIndex, gemIndex, or quality'
  end

  local skillSetId = build.skillsTab.activeSkillSetId or 1
  local skillSet = build.skillsTab.skillSets[skillSetId]
  if not skillSet then return nil, 'active skill set not found' end

  local groupIndex = tonumber(params.groupIndex)
  local gemIndex = tonumber(params.gemIndex)
  local quality = tonumber(params.quality)

  local socketGroup = skillSet.socketGroupList[groupIndex]
  if not socketGroup then return nil, 'socket group not found' end

  local gemInstance = socketGroup.gemList[gemIndex]
  if not gemInstance then return nil, 'gem not found' end

  if quality < 0 or quality > 23 then return nil, 'invalid quality (must be 0-23)' end

  gemInstance.quality = quality
  if params.qualityId then
    gemInstance.qualityId = tostring(params.qualityId)
  end

  if build.skillsTab.ProcessSocketGroup then
    build.skillsTab:ProcessSocketGroup(socketGroup)
  end

  build.buildFlag = true
  M.get_main_output()

  return true
end

-- Gem corruption states (D-91), as PoB2's corruption dropdown sets them (SkillsTab.lua corruptOption:
-- gemInstance.corrupted is false only for "Not Corrupted"; corruptLevel is the option's level).
local CORRUPT_STATES = {
  not_corrupted = { corrupted = false, corruptLevel = 0 },
  corrupted = { corrupted = true, corruptLevel = 0 },
  plus_one_level = { corrupted = true, corruptLevel = 1 },
  minus_one_level = { corrupted = true, corruptLevel = -1 },
}

local function isSupportGem(gemInstance)
  local gemData = gemInstance.gemData
  if gemData and gemData.grantedEffect then return gemData.grantedEffect.support == true end
  return gemInstance.grantedEffect ~= nil and gemInstance.grantedEffect.support == true
end

-- An active skill gem: a known gem (gemData), not item/tree granted, not a support gem, with at least one
-- granted effect that is not a support (CalcSetup's active-skill test, without the per-instance enable flags).
-- The support test comes first: some support gems (Fiery Death, Impending Doom, Mana Flare, ...) also grant a
-- triggered non-support skill (Data.lua appends additionalGrantedEffectId to grantedEffectList), and D-91
-- says a scope never changes a support gem, so the scopes and the explicit-gem path must agree on them.
local function isActiveSkillGem(gemInstance)
  local gemData = gemInstance.gemData
  if not gemData or gemInstance.fromItem or gemInstance.fromTree then return false end
  if isSupportGem(gemInstance) then return false end
  for _, grantedEffect in ipairs(gemData.grantedEffectList or { gemData.grantedEffect }) do
    if grantedEffect and not grantedEffect.support then return true end
  end
  return false
end

-- Set the corruption state of active skill gems (D-91). Scope: groupIndex + gemIndex is that gem;
-- groupIndex alone is every active skill gem in that group; neither is every active skill gem in the
-- user socket groups (no `source`: not granted by an item or a passive). Support gems are never changed,
-- and naming one is an error. Every check runs before the first change, so a failure changes nothing.
-- params: { state: 'not_corrupted'|'corrupted'|'plus_one_level'|'minus_one_level', groupIndex?: number, gemIndex?: number }
function M.set_gem_corruption(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  local target = CORRUPT_STATES[params.state]
  if not target then
    return nil, 'invalid state "' .. tostring(params.state) .. '" (must be not_corrupted, corrupted, plus_one_level or minus_one_level)'
  end
  if params.gemIndex ~= nil and params.groupIndex == nil then return nil, 'gemIndex needs groupIndex' end

  local skillSetId = build.skillsTab.activeSkillSetId or 1
  local skillSet = build.skillsTab.skillSets[skillSetId]
  if not skillSet then return nil, 'active skill set not found' end

  -- { socketGroup, groupIndex, gemIndex, gemInstance } for every gem to change
  local targets = {}
  local function add(socketGroup, groupIndex, gemIndex, gemInstance)
    table.insert(targets, { socketGroup = socketGroup, groupIndex = groupIndex, gemIndex = gemIndex, gemInstance = gemInstance })
  end
  if params.groupIndex ~= nil then
    local groupIndex = tonumber(params.groupIndex)
    local socketGroup = groupIndex and skillSet.socketGroupList[groupIndex]
    if not socketGroup then return nil, 'socket group not found' end
    if socketGroup.source then
      return nil, 'socket group ' .. groupIndex .. ' is granted by an item or a passive; its gems cannot be corrupted'
    end
    if params.gemIndex ~= nil then
      local gemIndex = tonumber(params.gemIndex)
      local gemInstance = gemIndex and socketGroup.gemList[gemIndex]
      if not gemInstance then return nil, 'gem not found' end
      local name = gemInstance.nameSpec or '?'
      if isSupportGem(gemInstance) then
        return nil, string.format("support gems can't be corrupted: gem %d in group %d (%s) is a support gem", gemIndex, groupIndex, name)
      end
      if not isActiveSkillGem(gemInstance) then
        return nil, string.format('gem %d in group %d (%s) is not an active skill gem', gemIndex, groupIndex, name)
      end
      add(socketGroup, groupIndex, gemIndex, gemInstance)
    else
      for gemIndex, gemInstance in ipairs(socketGroup.gemList) do
        if isActiveSkillGem(gemInstance) then add(socketGroup, groupIndex, gemIndex, gemInstance) end
      end
      if #targets == 0 then return nil, 'socket group ' .. groupIndex .. ' has no active skill gems' end
    end
  else
    for groupIndex, socketGroup in ipairs(skillSet.socketGroupList) do
      if not socketGroup.source then
        for gemIndex, gemInstance in ipairs(socketGroup.gemList) do
          if isActiveSkillGem(gemInstance) then add(socketGroup, groupIndex, gemIndex, gemInstance) end
        end
      end
    end
    if #targets == 0 then return nil, 'the build has no active skill gems in its socket groups' end
  end

  local gems = {}
  local processed = {}
  for _, t in ipairs(targets) do
    t.gemInstance.corrupted = target.corrupted
    t.gemInstance.corruptLevel = target.corruptLevel
    table.insert(gems, { groupIndex = t.groupIndex, gemIndex = t.gemIndex, name = t.gemInstance.nameSpec or '?' })
    if not processed[t.socketGroup] then
      processed[t.socketGroup] = true
      if build.skillsTab.ProcessSocketGroup then
        build.skillsTab:ProcessSocketGroup(t.socketGroup)
      end
    end
  end

  build.buildFlag = true
  M.get_main_output()

  return { state = params.state, gems = gems }
end

-- Remove a socket group
-- params: { groupIndex: number }
function M.remove_skill(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  if not params.groupIndex then return nil, 'missing groupIndex' end

  local skillSetId = build.skillsTab.activeSkillSetId or 1
  local skillSet = build.skillsTab.skillSets[skillSetId]
  if not skillSet then return nil, 'active skill set not found' end

  local groupIndex = tonumber(params.groupIndex)
  local socketGroup = skillSet.socketGroupList[groupIndex]
  if not socketGroup then return nil, 'socket group not found' end

  -- Don't allow removing special groups with sources
  if socketGroup.source then
    return nil, 'cannot remove special socket groups (item/node granted skills)'
  end

  table.remove(skillSet.socketGroupList, groupIndex)

  build.buildFlag = true
  M.get_main_output()

  return true
end

-- Remove a gem from a socket group
-- params: { groupIndex: number, gemIndex: number }
function M.remove_gem(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  if not params.groupIndex or not params.gemIndex then
    return nil, 'missing groupIndex or gemIndex'
  end

  local skillSetId = build.skillsTab.activeSkillSetId or 1
  local skillSet = build.skillsTab.skillSets[skillSetId]
  if not skillSet then return nil, 'active skill set not found' end

  local groupIndex = tonumber(params.groupIndex)
  local gemIndex = tonumber(params.gemIndex)

  local socketGroup = skillSet.socketGroupList[groupIndex]
  if not socketGroup then return nil, 'socket group not found' end

  local gemInstance = socketGroup.gemList[gemIndex]
  if not gemInstance then return nil, 'gem not found' end

  table.remove(socketGroup.gemList, gemIndex)

  if build.skillsTab.ProcessSocketGroup then
    build.skillsTab:ProcessSocketGroup(socketGroup)
  end

  build.buildFlag = true
  M.get_main_output()

  return true
end


-- Support candidates (suggest_supports, analyze_skills)

-- PoB's gem-selector value for a calc output and its sort field (SkillsTab.sortGemsByDPSField), read as
-- GemSelectControl:UpdateSortCache reads it: FullDPS when sorting by it, else a minion's CombinedDPS,
-- else the field itself. Also returns the field it read, `MinionCombinedDPS` for the minion's (D-388).
local function selector_value(output, field)
  if field == 'FullDPS' and output[field] ~= nil then return output[field], field end
  if output.Minion and output.Minion.CombinedDPS then return output.Minion.CombinedDPS, 'MinionCombinedDPS' end
  if output[field] ~= nil then return output[field], field end
  return 0, field
end

-- Measure each candidate on `group`, the way PoB's gem selector sorts gems by DPS
-- (GemSelectControl:UpdateSortCache / CalcOutputWithThisGem): the group is made the main skill, then
-- each candidate is appended to its gem list at the default gem level and quality, run through the
-- misc calculator, and taken out again. The main socket group and the outputs are restored afterwards.
local function measure_candidates(groupIndex, group, candidates)
  local skillsTab = build.skillsTab
  local field = skillsTab.sortGemsByDPSField or 'CombinedDPS'
  local useFullDPS = field == 'FullDPS'
  local fastCalcOptions = {
    nodeAlloc = true, requirementsItems = true, requirementsGems = true,
    skipEHP = field ~= 'TotalEHP', fullDPSOnly = useFullDPS,
  }
  local origMain = build.mainSocketGroup
  local savedDisplay = group.displayGemList
  local gemList = group.gemList
  local count = #gemList
  local measured
  local ok, err = pcall(function()
    build.mainSocketGroup = groupIndex
    build.calcsTab:BuildOutput()
    local calcFunc, calcBase = build.calcsTab:GetMiscCalculator()
    local baseline, stat = selector_value(calcBase, field)
    for _, c in ipairs(candidates) do
      local gemData = c.gemData
      gemList[count + 1] = {
        level = skillsTab:ProcessGemLevel(gemData),
        quality = tonumber(skillsTab.defaultGemQuality) or 0,
        count = 1,
        enabled = true,
        enableGlobal1 = true,
        enableGlobal2 = true,
        gemId = gemData.id,
        nameSpec = gemData.name,
        skillId = gemData.grantedEffectId,
        gemData = gemData,
      }
      local okCalc, output = pcall(calcFunc, nil, useFullDPS, fastCalcOptions)
      gemList[count + 1] = nil
      if okCalc and type(output) == 'table' then
        c.value = selector_value(output, field)
        c.delta = c.value - baseline
      else
        c.error = tostring(output)
      end
    end
    measured = { stat = stat, baseline = baseline, groupIndex = groupIndex }
  end)
  -- Restore, also after a failure.
  while #gemList > count do table.remove(gemList) end
  group.displayGemList = savedDisplay
  build.mainSocketGroup = origMain
  build.calcsTab:BuildOutput()
  if not ok then return nil, 'support measurement failed: ' .. tostring(err) end
  return measured
end

-- A socket group's active skills as PoB builds them (`displaySkillList`). PoB builds them only for the
-- main group and for the enabled groups whose slot is in the active weapon set (CalcSetup: `index ==
-- env.mainSocketGroup or (group.enabled and group.slotEnabled)`); every other group gets an empty list.
-- For such a group (disabled, or on the inactive weapon swap) the list is built with the group made the
-- main skill, the way PoB shows it when it is selected; the main socket group and the outputs are
-- restored afterwards.
local function group_active_skills(groupIndex, group)
  if group.displaySkillList == nil then M.get_main_output() end
  if groupIndex == build.mainSocketGroup or (group.enabled and group.slotEnabled) then
    return group.displaySkillList or {}
  end
  local origMain = build.mainSocketGroup
  local list
  local ok, err = pcall(function()
    build.mainSocketGroup = groupIndex
    build.calcsTab:BuildOutput()
    list = group.displaySkillList or {}
  end)
  build.mainSocketGroup = origMain
  build.calcsTab:BuildOutput()
  if not ok then return nil, 'building the group\'s skills failed: ' .. tostring(err) end
  return list
end

-- The support gems PoB says can support a socket group's active skills: every non-legacy support gem
-- in `data.gems` for which calcLib.canGrantedEffectSupportActiveSkill accepts one of the group's
-- active skills (`displaySkillList`), as PoB's gem selector decides it, minus the supports already in
-- the group. `socketed` reports the group's own supports and whether PoB says each one supports them.
-- With `measure`, each candidate also gets `value` and `delta`: PoB's gem-selector stat with the
-- candidate added, measured on this group as the main skill (measure_candidates).
-- params: { groupIndex: number, measure?: boolean }
function M.list_support_candidates(params)
  if not build or not build.skillsTab or not build.calcsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  local groups = build.skillsTab.socketGroupList or {}
  local groupIndex = tonumber(params.groupIndex)
  local group = groupIndex and groups[groupIndex]
  if not group then
    return nil, string.format('socket group %s not found (the build has %d)', tostring(params.groupIndex), #groups)
  end
  local gems = build.data and build.data.gems
  if not gems then return nil, 'gem data not initialized' end
  local activeSkills, skillsErr = group_active_skills(groupIndex, group)
  if not activeSkills then return nil, skillsErr end
  local activeNames = {}
  for _, activeSkill in ipairs(activeSkills) do
    local grantedEffect = activeSkill.activeEffect and activeSkill.activeEffect.grantedEffect
    if grantedEffect and grantedEffect.name then table.insert(activeNames, grantedEffect.name) end
  end
  local function can_support(grantedEffect)
    for _, activeSkill in ipairs(activeSkills) do
      if calcLib.canGrantedEffectSupportActiveSkill(grantedEffect, activeSkill) then return true end
    end
    return false
  end

  local socketed, inGroup = {}, {}
  for gemIndex, gem in ipairs(group.gemList or {}) do
    local gemData = gem.gemData
    if gemData and gemData.grantedEffect and gemData.grantedEffect.support then
      inGroup[gemData.name] = true
      table.insert(socketed, { gemIndex = gemIndex, name = gemData.name, supportsActive = can_support(gemData.grantedEffect) })
    end
  end

  local candidates = {}
  for _, gemData in pairs(gems) do
    local grantedEffect = gemData.grantedEffect
    if grantedEffect and grantedEffect.support and not grantedEffect.legacy and not inGroup[gemData.name]
        and can_support(grantedEffect) then
      table.insert(candidates, { name = gemData.name, gemId = gemData.id, tags = gemData.tagString, gemData = gemData })
    end
  end
  table.sort(candidates, function(a, b) return a.name < b.name end)

  local measured
  if params.measure == true and #candidates > 0 then
    local err
    measured, err = measure_candidates(groupIndex, group, candidates)
    if not measured then return nil, err end
  end

  local out = {}
  for _, c in ipairs(candidates) do
    table.insert(out, { name = c.name, gemId = c.gemId, tags = c.tags, value = c.value, delta = c.delta, error = c.error })
  end
  return {
    groupIndex = groupIndex,
    label = group.label,
    activeSkills = activeNames,
    candidates = out,
    socketed = socketed,
    measured = measured,
  }
end


-- Search for passive tree nodes by keyword and/or ascendancy (C-43)
-- params: { keyword?: string, ascendancy?: string, nodeType?: string ('keystone'|'notable'|'jewel'|'mastery'|
--   'ascendancy'|'normal'; 'any' or none filters nothing), maxResults?: number, includeAllocated?: boolean }
-- `keyword` is required unless `ascendancy` (a case-insensitive ascendancy name) is given. Every match is
-- sorted (type rank keystone, notable, jewel, mastery, ascendancy, normal; then name; then id) before the
-- cut to `maxResults`; `count` is the number returned and `total` the number matched.
function M.search_nodes(params)
  if not build or not build.spec then return nil, 'build/spec not initialized' end
  if type(params) ~= 'table' then params = {} end

  local keyword = type(params.keyword) == 'string' and params.keyword:match('^%s*(.-)%s*$'):lower() or nil
  if keyword == '' then keyword = nil end
  local ascendancy
  if type(params.ascendancy) == 'string' and params.ascendancy:match('%S') then
    local wanted = params.ascendancy:match('^%s*(.-)%s*$'):lower()
    local names, seen = {}, {}
    for _, node in pairs(build.spec.nodes) do
      local name = node.ascendancyName
      if name and not seen[name] then
        seen[name] = true
        table.insert(names, name)
        if name:lower() == wanted then ascendancy = name end
      end
    end
    if not ascendancy then
      table.sort(names)
      return nil, 'unknown ascendancy "' .. params.ascendancy .. '"; valid ascendancies: ' .. table.concat(names, ', ')
    end
  end
  if not keyword and not ascendancy then
    return nil, 'missing or invalid keyword (a keyword is required unless an ascendancy is given)'
  end

  local nodeType = type(params.nodeType) == 'string' and params.nodeType:lower() or nil
  if nodeType == 'any' or nodeType == '' then nodeType = nil end
  local maxResults = tonumber(params.maxResults) or 50
  local includeAllocated = params.includeAllocated ~= false

  local results = {}

  -- Get allocated nodes set for quick lookup
  local allocatedSet = {}
  if build.spec.allocNodes then
    for id, _ in pairs(build.spec.allocNodes) do
      allocatedSet[id] = true
    end
  end

  -- Search through all nodes; every match is collected, then sorted, then cut.
  for id, node in pairs(build.spec.nodes) do
    -- Skip if already allocated and we don't want allocated nodes
    if not includeAllocated and allocatedSet[id] then
      goto continue
    end

    -- Filter by ascendancy if specified
    if ascendancy and node.ascendancyName ~= ascendancy then
      goto continue
    end

    -- Filter by node type if specified
    if nodeType then
      local nType = 'normal'
      if node.isKeystone then nType = 'keystone'
      elseif node.isNotable then nType = 'notable'
      elseif node.isJewelSocket then nType = 'jewel'
      elseif node.isMultipleChoiceOption then nType = 'mastery'
      elseif node.ascendancyName then nType = 'ascendancy'
      end
      if nType ~= nodeType then goto continue end
    end

    -- Without a keyword (an ascendancy listing), every node left matches.
    local matches = keyword == nil

    -- Check if keyword matches name
    if not matches and node.name and node.name:lower():find(keyword, 1, true) then
      matches = true
    end

    -- Check if keyword matches stats/modifiers
    if not matches and node.sd then
      for _, stat in ipairs(node.sd) do
        if type(stat) == 'string' and stat:lower():find(keyword, 1, true) then
          matches = true
          break
        end
      end
    end

    -- Check modifiers list
    if not matches and node.modList then
      for _, mod in ipairs(node.modList) do
        local modStr = tostring(mod)
        if modStr:lower():find(keyword, 1, true) then
          matches = true
          break
        end
      end
    end

    if matches then
      local rNodeType = 'normal'
      if node.isKeystone then rNodeType = 'keystone'
      elseif node.isNotable then rNodeType = 'notable'
      elseif node.isJewelSocket then rNodeType = 'jewel'
      elseif node.isMultipleChoiceOption then rNodeType = 'mastery'
      elseif node.ascendancyName then rNodeType = 'ascendancy'
      end

      local stats = {}
      if node.sd then
        for _, stat in ipairs(node.sd) do
          if type(stat) == 'string' then
            table.insert(stats, stat)
          end
        end
      end

      -- PoB's own path to an unallocated node (PassiveSpec:BuildPathFromNode): `path` lists the nodes
      -- that allocating it takes, the node itself first, and `pathDist` is its point cost. Unreachable
      -- nodes have no path.
      local pathDist, path
      if not allocatedSet[id] and type(node.path) == 'table' and #node.path > 0
        and tonumber(node.pathDist) and node.pathDist < 1000 then
        pathDist = node.pathDist
        path = {}
        for _, pathNode in ipairs(node.path) do table.insert(path, pathNode.id) end
      end

      table.insert(results, {
        id = id,
        name = node.name or 'Unnamed',
        type = rNodeType,
        stats = stats,
        allocated = allocatedSet[id] == true,
        x = node.x,
        y = node.y,
        orbit = node.orbit,
        orbitIndex = node.orbitIndex,
        ascendancyName = node.ascendancyName,
        pathDist = pathDist,
        path = path,
      })
    end

    ::continue::
  end

  -- Sort every match: type rank, then name, then id; then cut.
  local typeOrder = { keystone = 1, notable = 2, jewel = 3, mastery = 4, ascendancy = 5, normal = 6 }
  table.sort(results, function(a, b)
    local aOrder = typeOrder[a.type] or 99
    local bOrder = typeOrder[b.type] or 99
    if aOrder ~= bOrder then
      return aOrder < bOrder
    end
    if a.name ~= b.name then
      return a.name < b.name
    end
    return a.id < b.id
  end)

  local total = #results
  local shown = {}
  for i = 1, math.min(total, maxResults) do shown[i] = results[i] end

  return { nodes = shown, count = #shown, total = total }
end


-- C-56 (D-427): a PoB skill type by name (the SkillType table, Data/Global.lua), ignoring case: its name and value,
-- or nil and an error listing every name. A gem tag (`warcry`, `travel`) is no skill type.
local function resolve_skill_type(name)
  local wanted = tostring(name):lower()
  local names = {}
  for typeName, value in pairs(type(SkillType) == 'table' and SkillType or {}) do
    if type(typeName) == 'string' then
      if typeName:lower() == wanted then return typeName, value end
      names[#names + 1] = typeName
    end
  end
  table.sort(names)
  return nil, ('unknown skill type "%s"; PoB\'s skill types are: %s'):format(tostring(name), table.concat(names, ', '))
end

-- List gems from PoB2's authoritative gem database.
-- params: { type?: 'active'|'support', search?: string, tag?: string, skillType?: string, maxResults?: number,
--           dedupeByName?: boolean }
-- C-56 (D-427): `skillType` keeps the gems one of whose granted effects has that PoB skill type (its `skillTypes`).
function M.list_gems(params)
  if type(params) ~= 'table' then params = {} end
  local data = (build and build.data) or _G.data
  if not data or not data.gems then return nil, 'gem data not available' end

  local typeFilter = params.type and tostring(params.type):lower() or nil
  local search = params.search and tostring(params.search):lower() or nil
  local tag = params.tag and tostring(params.tag):lower() or nil
  local maxResults = tonumber(params.maxResults) or 400
  local dedupe = params.dedupeByName == true
  local skillType
  if params.skillType ~= nil then
    local name, value = resolve_skill_type(params.skillType)
    if not name then return nil, value end
    skillType = value
  end

  local out = {}
  local seenNames = {}
  for _, g in pairs(data.gems) do
    if type(g) == 'table' and g.name then
      local isSupport = (g.gemType == 'Support') or (g.tags and g.tags.support == true)
      local kind = isSupport and 'support' or 'active'
      local include = true
      if typeFilter and kind ~= typeFilter then include = false end
      if include and search and not g.name:lower():find(search, 1, true) then include = false end
      if include and skillType ~= nil then
        -- Every granted effect of the gem (Modules/Data.lua's grantedEffectList: its first and each additional one),
        -- so a gem whose Travel skill is its second effect (Blink, Black Powder Blitz) is kept.
        local has = false
        for _, ge in ipairs(g.grantedEffectList or { g.grantedEffect }) do
          if type(ge) == 'table' and type(ge.skillTypes) == 'table' and ge.skillTypes[skillType] then has = true end
        end
        if not has then include = false end
      end
      if include and tag then
        local hasTag = false
        if g.tagString and g.tagString:lower():find(tag, 1, true) then hasTag = true end
        if not hasTag and g.tags and g.tags[tag] == true then hasTag = true end
        if not hasTag then include = false end
      end
      if include and dedupe and seenNames[g.name] then include = false end
      if include then
        seenNames[g.name] = true
        local tagKeys = {}
        if type(g.tags) == 'table' then
          for k, v in pairs(g.tags) do if v == true then table.insert(tagKeys, k) end end
        end
        table.insert(out, {
          name = g.name,
          kind = kind,
          gemType = g.gemType,
          gemFamily = g.gemFamily,
          tags = g.tagString,
          tagKeys = tagKeys,
          maxLevel = g.naturalMaxLevel,
          tier = g.Tier,
          reqStr = g.reqStr,
          reqDex = g.reqDex,
          reqInt = g.reqInt,
        })
      end
    end
  end

  table.sort(out, function(a, b)
    if a.kind ~= b.kind then return a.kind < b.kind end
    return (a.name or '') < (b.name or '')
  end)

  local total = #out
  if total > maxResults then
    local trimmed = {}
    for i = 1, maxResults do trimmed[i] = out[i] end
    out = trimmed
  end

  return { gems = out, count = #out, total = total }
end


-- New builds

-- Find a class and, optionally, one of its ascendancies by name (ignoring case) in a passive tree.
-- An ascendancy without a class picks the class that owns it.
local function resolve_class(tree, className, ascendancy)
  local classes = {}
  for classId, class in pairs(tree.classes or {}) do
    if type(class) == 'table' and class.name then table.insert(classes, { id = classId, class = class }) end
  end
  table.sort(classes, function(a, b) return a.id < b.id end)
  local function ascendancies_of(class)
    local list = {}
    for ascId, asc in pairs(class.classes or {}) do
      if ascId ~= 0 and type(asc) == 'table' and asc.name and asc.name ~= 'None' then
        table.insert(list, { id = ascId, name = asc.name })
      end
    end
    table.sort(list, function(a, b) return a.id < b.id end)
    return list
  end
  local function names(list, key)
    local out = {}
    for _, entry in ipairs(list) do table.insert(out, key(entry)) end
    return table.concat(out, ', ')
  end

  local chosen
  if className ~= nil then
    local wanted = tostring(className):lower()
    for _, entry in ipairs(classes) do
      if entry.class.name:lower() == wanted then chosen = entry end
    end
    if not chosen then
      return nil, nil, string.format('unknown class "%s" (classes: %s)', tostring(className),
        names(classes, function(e) return e.class.name end))
    end
  end
  if ascendancy == nil then return chosen and chosen.id or nil, nil end

  local wantedAsc = tostring(ascendancy):lower()
  for _, entry in ipairs(classes) do
    if not chosen or chosen.id == entry.id then
      for _, asc in ipairs(ascendancies_of(entry.class)) do
        if asc.name:lower() == wantedAsc then return entry.id, asc.id end
      end
    end
  end
  if chosen then
    return nil, nil, string.format('unknown ascendancy "%s" for %s (ascendancies: %s)', tostring(ascendancy),
      chosen.class.name, names(ascendancies_of(chosen.class), function(a) return a.name end))
  end
  return nil, nil, string.format('unknown ascendancy "%s"', tostring(ascendancy))
end

-- Start a new build, as PoB's "New" does, then pick the class and ascendancy the way PoB's class and
-- ascendancy dropdowns do (PassiveSpec:SelectClass / SelectAscendClass). The names are checked against
-- the latest tree before anything changes, so a bad name leaves the engine's build untouched.
-- params: { className?: string, ascendancy?: string }
function M.new_build(params)
  if type(params) ~= 'table' then params = {} end
  if not _G.newBuild then return nil, 'headless wrapper not initialized' end
  local className = params.className
  local ascendancy = params.ascendancy
  if className == '' then className = nil end
  if ascendancy == '' then ascendancy = nil end
  if className ~= nil or ascendancy ~= nil then
    local tree = main and main.LoadTree and main:LoadTree(latestTreeVersion)
    if not tree then return nil, 'passive tree data not available' end
    local _, _, err = resolve_class(tree, className, ascendancy)
    if err then return nil, err end
  end

  _G.newBuild()

  if className ~= nil or ascendancy ~= nil then
    local spec = build and build.spec
    if not spec or not spec.tree then return nil, 'new build has no passive tree' end
    local classId, ascendId, err = resolve_class(spec.tree, className, ascendancy)
    if err then return nil, err end
    if classId ~= nil and classId ~= spec.curClassId then spec:SelectClass(classId) end
    if ascendId ~= nil then spec:SelectAscendClass(ascendId) end
    spec:AddUndoState()
    build.buildFlag = true
    M.get_main_output()
  end
  local spec = build and build.spec
  return {
    name = build and build.buildName or nil,
    className = spec and spec.curClassName or nil,
    ascendClassName = spec and spec.curAscendClassName or nil,
  }
end


-- List PoE2 classes and their ascendancies with engine IDs (for set_tree/new builds).
function M.get_classes()
  if not build or not build.spec or not build.spec.tree then
    return nil, 'tree not initialized'
  end
  local tree = build.spec.tree
  local out = {}
  for classId, class in pairs(tree.classes or {}) do
    if type(class) == 'table' and class.name then
      local ascendancies = {}
      for ascId, asc in pairs(class.classes or class.ascendancies or {}) do
        if ascId ~= 0 and type(asc) == 'table' and asc.name and asc.name ~= 'None' then
          table.insert(ascendancies, { id = ascId, name = asc.name })
        end
      end
      table.sort(ascendancies, function(a, b) return a.id < b.id end)
      table.insert(out, { classId = classId, name = class.name, ascendancies = ascendancies })
    end
  end
  table.sort(out, function(a, b) return a.classId < b.classId end)
  return { classes = out }
end


-- Skill/socket-group enablement

-- Enable or disable an entire socket group.
-- params: { groupIndex: number, enabled: boolean }
function M.set_socket_group_enabled(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  if not params.groupIndex then return nil, 'missing groupIndex' end

  local skillSetId = build.skillsTab.activeSkillSetId or 1
  local skillSet = build.skillsTab.skillSets[skillSetId]
  if not skillSet then return nil, 'active skill set not found' end

  local groupIndex = tonumber(params.groupIndex)
  local socketGroup = skillSet.socketGroupList[groupIndex]
  if not socketGroup then return nil, 'socket group not found at index ' .. tostring(groupIndex) end

  socketGroup.enabled = params.enabled and true or false

  if build.skillsTab.ProcessSocketGroup then
    build.skillsTab:ProcessSocketGroup(socketGroup)
  end

  build.buildFlag = true
  M.get_main_output()

  return { groupIndex = groupIndex, label = socketGroup.label or '', enabled = socketGroup.enabled }
end

-- Enable or disable a single gem within a socket group.
-- params: { groupIndex: number, gemIndex: number, enabled: boolean }
function M.set_gem_enabled(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  if not params.groupIndex or not params.gemIndex then
    return nil, 'missing groupIndex or gemIndex'
  end

  local skillSetId = build.skillsTab.activeSkillSetId or 1
  local skillSet = build.skillsTab.skillSets[skillSetId]
  if not skillSet then return nil, 'active skill set not found' end

  local socketGroup = skillSet.socketGroupList[tonumber(params.groupIndex)]
  if not socketGroup then return nil, 'socket group not found' end

  local gemInstance = socketGroup.gemList[tonumber(params.gemIndex)]
  if not gemInstance then return nil, 'gem not found' end

  gemInstance.enabled = params.enabled and true or false

  if build.skillsTab.ProcessSocketGroup then
    build.skillsTab:ProcessSocketGroup(socketGroup)
  end

  build.buildFlag = true
  M.get_main_output()

  return true
end


-- Passive tree specs (loadouts)

-- List all passive tree specs.
function M.list_specs()
  if not build or not build.treeTab then return nil, 'tree tab not initialized' end
  local treeTab = build.treeTab
  local specs = {}
  for i, spec in ipairs(treeTab.specList or {}) do
    local used
    if type(spec.CountAllocNodes) == 'function' then
      local ok2, n = pcall(function() return (spec:CountAllocNodes()) end)
      if ok2 then used = n end
    end
    table.insert(specs, {
      index = i,
      title = spec.title or 'Default',
      treeVersion = spec.treeVersion,
      classId = tonumber(spec.curClassId) or 0,
      className = spec.curClassName,
      ascendClassName = spec.curAscendClassName,
      pointsUsed = used,
      active = (i == treeTab.activeSpec),
    })
  end
  return { specs = specs, activeSpec = treeTab.activeSpec }
end

-- Create a new passive tree spec, optionally copying an existing one.
-- params: { title?: string, copyFrom?: number, activate?: boolean }
function M.create_spec(params)
  if not build or not build.treeTab then return nil, 'tree tab not initialized' end
  if type(params) ~= 'table' then params = {} end
  local treeTab = build.treeTab
  local newSpec

  if params.copyFrom then
    local src = treeTab.specList[tonumber(params.copyFrom)]
    if not src then return nil, 'copyFrom spec not found at index ' .. tostring(params.copyFrom) end
    newSpec = construct('PassiveSpec', build, src.treeVersion)
    newSpec.title = (params.title and tostring(params.title)) or ((src.title or 'Default') .. ' (Copy)')
    newSpec.jewels = copyTable(src.jewels)
    newSpec:RestoreUndoState(src:CreateUndoState())
    newSpec:BuildClusterJewelGraphs()
  else
    local ver = rawget(_G, 'latestTreeVersion') or (build.spec and build.spec.treeVersion)
    newSpec = construct('PassiveSpec', build, ver)
    newSpec.title = (params.title and tostring(params.title)) or 'New Tree'
    if build.spec then
      newSpec:SelectClass(build.spec.curClassId)
      newSpec:SelectAscendClass(build.spec.curAscendClassId)
      if type(newSpec.SelectSecondaryAscendClass) == 'function' then
        newSpec:SelectSecondaryAscendClass(build.spec.curSecondaryAscendClassId or 0)
      end
    end
  end

  table.insert(treeTab.specList, newSpec)
  local index = #treeTab.specList
  local activated = params.activate == true
  if activated then
    treeTab:SetActiveSpec(index)
  end
  build.buildFlag = true
  return { index = index, title = newSpec.title, activated = activated }
end

-- Activate an existing passive tree spec.
-- params: { index: number }
function M.select_spec(params)
  if not build or not build.treeTab then return nil, 'tree tab not initialized' end
  local index = tonumber(params and params.index)
  if not index then return nil, 'missing index' end
  local treeTab = build.treeTab
  if not treeTab.specList[index] then return nil, 'spec not found at index ' .. tostring(index) end
  treeTab:SetActiveSpec(index)
  build.buildFlag = true
  M.get_main_output()
  return { activeSpec = treeTab.activeSpec, title = build.spec.title or 'Default' }
end

-- Delete a passive tree spec (cannot delete the last remaining one).
-- params: { index: number }
function M.delete_spec(params)
  if not build or not build.treeTab then return nil, 'tree tab not initialized' end
  local index = tonumber(params and params.index)
  if not index then return nil, 'missing index' end
  local treeTab = build.treeTab
  if not treeTab.specList[index] then return nil, 'spec not found at index ' .. tostring(index) end
  if #treeTab.specList <= 1 then return nil, 'cannot delete the last spec' end

  table.remove(treeTab.specList, index)

  if index == treeTab.activeSpec then
    treeTab:SetActiveSpec(math.max(1, index - 1))
  else
    -- build.spec object is unchanged; find its new index in the list
    for i, spec in ipairs(treeTab.specList) do
      if spec == build.spec then treeTab.activeSpec = i break end
    end
  end
  build.buildFlag = true
  return { deleted = index, activeSpec = treeTab.activeSpec, remaining = #treeTab.specList }
end

-- Rename a passive tree spec.
-- params: { index: number, title: string }
function M.rename_spec(params)
  if not build or not build.treeTab then return nil, 'tree tab not initialized' end
  local index = tonumber(params and params.index)
  local title = params and params.title and tostring(params.title)
  if not index then return nil, 'missing index' end
  if not title or title == '' then return nil, 'missing title' end
  local spec = build.treeTab.specList[index]
  if not spec then return nil, 'spec not found at index ' .. tostring(index) end
  spec.title = title
  return { index = index, title = title }
end


-- Item sets

-- List all item sets.
function M.list_item_sets()
  if not build or not build.itemsTab then return nil, 'items not initialized' end
  local itemsTab = build.itemsTab
  local sets = {}
  for _, id in ipairs(itemsTab.itemSetOrderList or {}) do
    local set = itemsTab.itemSets[id]
    if set then
      table.insert(sets, {
        id = id,
        title = set.title or 'Default',
        active = (id == itemsTab.activeItemSetId),
      })
    end
  end
  return { itemSets = sets, activeItemSet = itemsTab.activeItemSetId }
end

-- Activate an existing item set by id.
-- params: { id: number }
function M.select_item_set(params)
  if not build or not build.itemsTab then return nil, 'items not initialized' end
  local id = tonumber(params and params.id)
  if not id then return nil, 'missing id' end
  local itemsTab = build.itemsTab
  if not itemsTab.itemSets[id] then return nil, 'item set not found: ' .. tostring(id) end
  itemsTab:SetActiveItemSet(id)
  build.buildFlag = true
  M.get_main_output()
  return { activeItemSet = itemsTab.activeItemSetId, title = itemsTab.activeItemSet.title or 'Default' }
end

return M
