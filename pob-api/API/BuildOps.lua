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

-- Export a subset of useful stats from main output.
-- If fields is provided, only export those keys (when present). Only number, string and boolean
-- values are exported; keys whose value is anything else (an item object, a nested table) are left
-- out and listed in `_meta.omitted`, because they cannot be encoded (ctx-lua X13).
function M.export_stats(fields)
  local output, err = M.get_main_output()
  if not output then
    return nil, err
  end
  local wanted = fields or M.DEFAULT_STAT_FIELDS
  local result = {}
  local omitted = {}
  for _, k in ipairs(wanted) do
    local v = output[k]
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

-- Read current tree allocation and metadata. Class and ascendancy names are the engine's own (the
-- active spec's tree), so callers never map ids through a table of their own.
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
  return out
end

-- Re-import the active spec's allocation from a node list, keeping what the node list can't carry
-- (E2), as PoB's own PassiveSpec:Load does: each allocated node's weapon-set assignment
-- (`{[id]=node.allocMode}` for allocMode ~= 0) and the attribute choices (`hashOverrides`).
-- Both are read before the import, which resets the nodes.
-- PassiveSpec:ImportFromNodeList(className, classId, ascendClassId, secondaryAscendClassId,
--   hashList, weaponSets, hashOverrides, masteryEffects, treeVersion)
local function reimport_nodes(classId, ascendId, secondaryId, nodes, treeVersion)
  local spec = build.spec
  local weaponSets = {}
  for id, node in pairs(spec.allocNodes or {}) do
    if node.allocMode and node.allocMode ~= 0 then
      weaponSets[id] = node.allocMode
    end
  end
  local hashOverrides = copyTable(spec.hashOverrides or {}, true)
  -- PoE2 trees have no mastery selections; pass a copy (the import wipes the spec's own table).
  local masterySelections = copyTable(spec.masterySelections or {}, true)
  spec:ImportFromNodeList(nil, classId, ascendId, secondaryId, nodes, weaponSets, hashOverrides, masterySelections, treeVersion)
end

-- Set tree allocation from parameters
-- params: { classId, ascendClassId, secondaryAscendClassId?, nodes:[int], treeVersion? }
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
  reimport_nodes(classId, ascendId, secondaryId, nodes, params.treeVersion)
  -- Rebuild calcs to reflect changes
  M.get_main_output()
  return true
end

-- Export full build XML
function M.export_build_xml()
  if not build or not build.SaveDB then
    return nil, 'build not initialized'
  end
  local xml = build:SaveDB('api-export')
  if not xml then return nil, 'failed to compose xml' end
  return xml
end

-- Set player level and rebuild
function M.set_level(level)
  if not build or not build.configTab then
    return nil, 'build/config not initialized'
  end
  local lvl = tonumber(level)
  if not lvl or lvl < MIN_PLAYER_LEVEL or lvl > MAX_PLAYER_LEVEL then
    return nil, string.format('invalid level (must be %d-%d)', MIN_PLAYER_LEVEL, MAX_PLAYER_LEVEL)
  end
  build.characterLevel = lvl
  build.characterLevelAutoMode = false
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

-- Update tree by delta lists
function M.update_tree_delta(params)
  if not build or not build.spec then return nil, 'build/spec not initialized' end
  local current, err = M.get_tree()
  if not current then return nil, err end
  local set = {}
  for _, id in ipairs(current.nodes) do set[id] = true end
  if params and type(params.removeNodes) == 'table' then
    for _, id in ipairs(params.removeNodes) do set[tonumber(id)] = nil end
  end
  if params and type(params.addNodes) == 'table' then
    for _, id in ipairs(params.addNodes) do set[tonumber(id)] = true end
  end
  local nodes = {}
  for id,_ in pairs(set) do table.insert(nodes, id) end
  table.sort(nodes)
  local classId = params.classId or current.classId or 0
  local ascendId = params.ascendClassId or current.ascendClassId or 0
  local secId = params.secondaryAscendClassId or current.secondaryAscendClassId or 0
  local tv = params.treeVersion or current.treeVersion
  reimport_nodes(tonumber(classId) or 0, tonumber(ascendId) or 0, tonumber(secId) or 0, nodes, tv)
  M.get_main_output()
  return true
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
  for _, k in ipairs(fields) do
    local v = out[k]
    if type(v) == 'number' then result[k] = v end
  end
  return result
end


-- PoB2's config options: the list `Modules/ConfigOptions` returns, which ConfigTab builds its controls
-- from. Loaded once per engine process. Each entry is {var, type, section, list?}, deduplicated by var
-- (the first entry wins, as for ConfigTab's own varControls).
local configOptionsCache

local function config_options()
  if configOptionsCache then return configOptionsCache end
  local ok, varList = pcall(LoadModule, 'Modules/ConfigOptions')
  if not ok or type(varList) ~= 'table' then return nil, 'could not load the config option list' end
  local list, byVar, section = {}, {}, ''
  for _, varData in ipairs(varList) do
    if varData.section then
      section = varData.section
    elseif varData.var and not byVar[varData.var] then
      local option = { var = varData.var, type = varData.type, section = section, list = varData.list }
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
--   options:    every option key in PoB's order, with its type and section.
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
    options[#options + 1] = { key = option.var, type = option.type, section = option.section }
  end
  return { enemyLevel = ct.enemyLevel, input = input, defaults = defaults, options = options }
end

-- One set_config value, checked against its option the way PoB's config controls accept input.
-- Returns true, value (nil clears the option) or false, error.
local function config_value(option, v)
  local key, t = option.var, option.type
  if t == 'check' then
    if type(v) == 'boolean' then return true, v end
    if v == 'true' then return true, true end
    if v == 'false' then return true, false end
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

-- Set config options and rebuild. params: { <config option key> = value, ... } (see config_value).
-- Every key is checked before anything changes: an unknown key or a bad value changes nothing. Values
-- go into the active config set's input, as PoB's config controls write them, then ConfigTab's
-- BuildModList recomputes the config mods (and the enemy level, from input.enemyLevel).
function M.set_config(params)
  local ct = build and build.configTab
  if not ct or not ct.configSets then return nil, 'build/config not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  local configSet = ct.configSets[ct.activeConfigSetId]
  if not configSet then return nil, 'no active config set' end
  local opts, err = config_options()
  if not opts then return nil, err end
  local keys = {}
  for k in pairs(params) do keys[#keys + 1] = tostring(k) end
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
    local ok, value = config_value(option, params[k])
    if not ok then return nil, value end
    values[k] = { value = value }
  end
  for _, k in ipairs(keys) do configSet.input[k] = values[k].value end
  ct:BuildModList()
  M.get_main_output()
  return true
end


-- Skills API
function M.get_skills()
  if not build or not build.skillsTab or not build.calcsTab then return nil, 'skills not initialized' end
  local groups = {}
  for idx, g in ipairs(build.skillsTab.socketGroupList or {}) do
    local names = {}
    if g.displaySkillList then
      for _, eff in ipairs(g.displaySkillList) do
        if eff and eff.activeEffect and eff.activeEffect.grantedEffect then
          table.insert(names, eff.activeEffect.grantedEffect.name)
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
    })
  end
  local result = {
    mainSocketGroup = build.mainSocketGroup,
    calcsSkillNumber = build.calcsTab.input and build.calcsTab.input.skill_number or nil,
    groups = groups,
  }
  return result
end

function M.set_main_selection(params)
  if not build or not build.skillsTab or not build.calcsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then return nil, 'invalid params' end
  if params.mainSocketGroup ~= nil then
    build.mainSocketGroup = tonumber(params.mainSocketGroup) or build.mainSocketGroup
  end
  local g = build.skillsTab.socketGroupList[build.mainSocketGroup]
  if not g then return nil, 'invalid mainSocketGroup' end
  if params.mainActiveSkill ~= nil then
    g.mainActiveSkill = tonumber(params.mainActiveSkill) or g.mainActiveSkill
  end
  if params.skillPart ~= nil then
    local idx = g.mainActiveSkill or 1
    local src = g.displaySkillList and g.displaySkillList[idx] and g.displaySkillList[idx].activeEffect and g.displaySkillList[idx].activeEffect.srcInstance
    if src then src.skillPart = tonumber(params.skillPart) end
  end
  -- Keep calcsTab in sync: use active group index
  build.calcsTab.input.skill_number = build.mainSocketGroup
  M.get_main_output()
  return true
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
  if params.validateOnly == true then
    return { id = 0, name = item.name, slot = slotCtrl and slotCtrl.slotName or nil }
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
  return { id = item.id, name = item.name, slot = slotCtrl and slotCtrl.slotName or equipped_slot(item.id) }
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
-- params: { label?: string, slot?: string, enabled?: boolean, includeInFullDPS?: boolean }
function M.create_socket_group(params)
  if not build or not build.skillsTab then return nil, 'skills not initialized' end
  if type(params) ~= 'table' then params = {} end

  local socketGroup = {
    label = params.label or '',
    slot = params.slot,
    enabled = params.enabled ~= false,
    includeInFullDPS = params.includeInFullDPS == true,
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

  return { index = index, label = socketGroup.label }
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
    return { gemIndex = 0, name = gemData.name, gemId = gemData.id, support = gemData.grantedEffect and gemData.grantedEffect.support == true or false }
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
    support = gemData.grantedEffect and gemData.grantedEffect.support == true or false }
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
-- else the field itself.
local function selector_value(output, field)
  if field == 'FullDPS' and output[field] ~= nil then return output[field] end
  if output.Minion and output.Minion.CombinedDPS then return output.Minion.CombinedDPS end
  if output[field] ~= nil then return output[field] end
  return 0
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
    local baseline = selector_value(calcBase, field)
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
    measured = { stat = field, baseline = baseline, groupIndex = groupIndex }
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


-- Search for passive tree nodes by keyword
-- params: { keyword: string, nodeType?: string ('normal'|'notable'|'keystone'), maxResults?: number, includeAllocated?: boolean }
function M.search_nodes(params)
  if not build or not build.spec then return nil, 'build/spec not initialized' end
  if type(params) ~= 'table' or type(params.keyword) ~= 'string' then
    return nil, 'missing or invalid keyword'
  end

  local keyword = params.keyword:lower()
  local nodeType = params.nodeType and params.nodeType:lower() or nil
  local maxResults = tonumber(params.maxResults) or 50
  local includeAllocated = params.includeAllocated ~= false

  local results = {}
  local count = 0

  -- Get allocated nodes set for quick lookup
  local allocatedSet = {}
  if build.spec.allocNodes then
    for id, _ in pairs(build.spec.allocNodes) do
      allocatedSet[id] = true
    end
  end

  -- Search through all nodes
  for id, node in pairs(build.spec.nodes) do
    if count >= maxResults then break end

    -- Skip if already allocated and we don't want allocated nodes
    if not includeAllocated and allocatedSet[id] then
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

    -- Check if keyword matches name
    local matches = false
    if node.name and node.name:lower():find(keyword, 1, true) then
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
      count = count + 1
    end

    ::continue::
  end

  -- Sort results: keystones first, then notables, then normal
  table.sort(results, function(a, b)
    local typeOrder = { keystone = 1, notable = 2, jewel = 3, mastery = 4, ascendancy = 5, normal = 6 }
    local aOrder = typeOrder[a.type] or 99
    local bOrder = typeOrder[b.type] or 99
    if aOrder ~= bOrder then
      return aOrder < bOrder
    end
    return (a.name or '') < (b.name or '')
  end)

  return { nodes = results, count = #results }
end


-- List gems from PoB2's authoritative gem database.
-- params: { type?: 'active'|'support', search?: string, tag?: string, maxResults?: number, dedupeByName?: boolean }
function M.list_gems(params)
  if type(params) ~= 'table' then params = {} end
  local data = (build and build.data) or _G.data
  if not data or not data.gems then return nil, 'gem data not available' end

  local typeFilter = params.type and tostring(params.type):lower() or nil
  local search = params.search and tostring(params.search):lower() or nil
  local tag = params.tag and tostring(params.tag):lower() or nil
  local maxResults = tonumber(params.maxResults) or 400
  local dedupe = params.dedupeByName == true

  local out = {}
  local seenNames = {}
  for _, g in pairs(data.gems) do
    if type(g) == 'table' and g.name then
      local isSupport = (g.gemType == 'Support') or (g.tags and g.tags.support == true)
      local kind = isSupport and 'support' or 'active'
      local include = true
      if typeFilter and kind ~= typeFilter then include = false end
      if include and search and not g.name:lower():find(search, 1, true) then include = false end
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
