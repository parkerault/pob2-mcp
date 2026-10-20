-- API/Handlers.lua
-- Shared JSON-RPC handlers for PoB API (transport-agnostic)

-- Debug logging control
local DEBUG = os.getenv('POB_API_DEBUG') == '1'
local function debug_log(msg)
  if DEBUG then io.stderr:write('[Handlers] ' .. msg .. '\n') end
end

-- Resolve BuildOps reliably regardless of CWD
local BuildOps
do
  debug_log('Attempting to require API.BuildOps')
  local ok_ops, mod = pcall(require, 'API.BuildOps')
  debug_log('pcall require result: ok=' .. tostring(ok_ops) .. ', mod=' .. tostring(mod))
  if ok_ops and mod then
    debug_log('Successfully loaded BuildOps via require')
    BuildOps = mod
  else
    debug_log('require failed, trying dofile fallbacks')
    -- Try path relative to this file's directory
    local dir = ''
    local info = debug and debug.getinfo and debug.getinfo(1, 'S')
    local src = info and info.source or ''
    if type(src) == 'string' and src:sub(1,1) == '@' then
      local p = src:sub(2)
      dir = (p:gsub('[^/\\]+$', ''))
    end
    local tried = {}
    local function try(p)
      if p then table.insert(tried, p) end
      if not p then return false end
      debug_log('Trying to load: ' .. tostring(p))
      local ok2, m = pcall(dofile, p)
      if ok2 and m then
        debug_log('Successfully loaded BuildOps from: ' .. tostring(p))
        BuildOps = m
        return true
      end
      debug_log('Failed to load from: ' .. tostring(p) .. ' - error: ' .. tostring(m))
      return false
    end
    if not BuildOps then
      local _ = try(dir .. 'BuildOps.lua')
              or try((rawget(_G,'POB_SCRIPT_DIR') or '.') .. '/API/BuildOps.lua')
              or try('API/BuildOps.lua')
              or try('src/API/BuildOps.lua')
    end
    if not BuildOps then
      io.stderr:write('[Handlers] BuildOps.lua not found. Tried paths: ' .. table.concat(tried, ', ') .. '\n')
      error('API/BuildOps.lua not found. Tried: ' .. table.concat(tried, ', '))
    end
  end
end

-- API version (semantic versioning). 2.x is the wire protocol v2 (C-2).
local API_VERSION = "2.0.0"

-- Test actions (C-2) exist only when the engine is started with POB_API_TEST_ACTIONS=1.
local TEST_ACTIONS = os.getenv('POB_API_TEST_ACTIONS') == '1'

-- The JSON null sentinel, set by Server.lua through configure(); nil leaves the key out.
local NULL = nil

local function configure(opts)
  if opts and opts.null ~= nil then NULL = opts.null end
end

local function version_meta()
  return {
    number      = _G.launch and launch.versionNumber or '?',
    branch      = _G.launch and launch.versionBranch or '?',
    platform    = _G.launch and launch.versionPlatform or '?',
    apiVersion  = API_VERSION,
  }
end

local handlers = {}

handlers.ping = function(params)
  return { ok = true, pong = true }
end

handlers.version = function(params)
  return { ok = true, version = version_meta() }
end

-- new_build {className?, ascendancy?}: a fresh build of that class and ascendancy (names as get_classes
-- lists them, case ignored). An unknown name fails before the engine's build changes.
handlers.new_build = function(params)
  local res, err = BuildOps.new_build(params or {})
  if not res then return { ok = false, error = err } end
  return { ok = true, result = {
    name = res.name or NULL,
    className = res.className,
    ascendClassName = res.ascendClassName,
  } }
end

-- PoB colour codes (^1, ^xRRGGBB) stripped from a message shown to the caller.
local function plain(msg)
  return (tostring(msg):gsub('%^x%x%x%x%x%x%x', ''):gsub('%^%d', ''))
end

local function load_failed(message)
  return { ok = false, code = 'LOAD_FAILED', error = message }
end

-- The first element of a parsed XML document (ParseXML's top level also holds stray text).
local function root_element_name(dbXML)
  local first = dbXML[1]
  if type(first) == 'table' and first.elem then return tostring(first.elem) end
  for _, node in ipairs(dbXML) do
    if type(node) == 'table' and node.elem then return tostring(node.elem) end
  end
  return '(none)'
end

-- The level and auto-level flag a <PathOfBuilding2> document records on its <Build>, read the way
-- buildMode:Load reads them (Modules/Build.lua): the level clamped to 1..100, the flag "true" or not.
local function recorded_level(root)
  for _, child in ipairs(root) do
    if type(child) == 'table' and child.elem == 'Build' then
      local attrib = child.attrib or {}
      return math.max(1, math.min(100, tonumber(attrib.level) or 1)), attrib.characterLevelAutoMode == 'true'
    end
  end
  return nil
end

-- D-398: a <Gem> of a document, as SkillsTab:LoadSkill resolves it: by gemId (and variantId) in
-- data.gemsByGameId, else by skillId in data.skills; its skill id and display name.
local function document_gem(attrib)
  local data = rawget(_G, 'data')
  local variants = data and data.gemsByGameId and attrib.gemId and data.gemsByGameId[attrib.gemId]
  local gemData = variants and attrib.variantId and variants[attrib.variantId]
  if variants and not gemData then
    for _, variant in pairs(variants) do gemData = variant; break end
  end
  if gemData then return { skillId = gemData.grantedEffectId, name = gemData.name } end
  local effect = data and data.skills and attrib.skillId and data.skills[attrib.skillId]
  if effect then return { skillId = effect.id, name = effect.name } end
  local nameSpec = attrib.nameSpec ~= '' and attrib.nameSpec or nil
  return { skillId = attrib.skillId, name = nameSpec or attrib.skillId or attrib.gemId or '?' }
end

-- D-398: a document's granted socket groups (a <Skill> whose source is a passive's, "Tree:<id>", or an item's,
-- "Item:<id>:<name>"), by skill set id: a <Skill> directly under <Skills> is set 1, as SkillsTab:Load reads it.
local function document_granted_groups(root)
  local bySet = {}
  local function add(setId, node)
    local attrib = node.attrib or {}
    local source = attrib.source
    if not setId or type(source) ~= 'string' or not (source:match('^Tree:') or source:match('^Item:')) then return end
    local gems = {}
    for _, child in ipairs(node) do
      if type(child) == 'table' and child.elem == 'Gem' then table.insert(gems, document_gem(child.attrib or {})) end
    end
    bySet[setId] = bySet[setId] or {}
    table.insert(bySet[setId], { source = source, slot = attrib.slot, label = attrib.label, gems = gems })
  end
  for _, section in ipairs(root) do
    if type(section) == 'table' and section.elem == 'Skills' then
      for _, node in ipairs(section) do
        if type(node) == 'table' and node.elem == 'Skill' then
          add(1, node)
        elseif type(node) == 'table' and node.elem == 'SkillSet' then
          local setId = tonumber(node.attrib and node.attrib.id)
          for _, sub in ipairs(node) do
            if type(sub) == 'table' and sub.elem == 'Skill' then add(setId, sub) end
          end
        end
      end
    end
  end
  return bySet
end

-- The passive's or item's name behind a granted group's source, or nil.
local function grantor_name(source)
  local nodeId = tonumber(source:match('^Tree:(%d+)$'))
  if nodeId then
    local node = build.spec and build.spec.nodes and build.spec.nodes[nodeId]
    return node and (node.dn or node.name) or nil
  end
  return source:match('^Item:[^:]*:(.+)$')
end

-- D-398: the gems the load dropped from the active skill set's granted groups. PoB rebuilds a granted group
-- from its grant on every calculation (Modules/CalcSetup.lua:1503-1542): a group whose granted gem's level
-- differs from the grant isn't matched and is removed (:1655-1666) for a new one, and a matched group's gem
-- list is wiped back to the granted gem. Each document group is compared with the engine's group of the same
-- source and slot (the one with the same first skill, if several): the gems it no longer holds were dropped.
-- With no such group, nothing grants the skill (the passive isn't allocated, the item isn't equipped), and PoB
-- removed the group (:1655-1666): the entry says so (`grantMissing`), and its gems leave out the granted skill,
-- the document group's first gem.
-- One entry per group that lost gems: {group, source, grantedBy?, grantMissing?, gems = {names}}; [] when none did.
local function dropped_granted_gems(bySet)
  local skillsTab = build and build.skillsTab
  local groups = skillsTab and bySet[skillsTab.activeSkillSetId] or {}
  local dropped = {}
  for _, group in ipairs(groups) do
    local first = group.gems[1]
    local match
    for _, socketGroup in ipairs(skillsTab.socketGroupList or {}) do
      if socketGroup.source == group.source and socketGroup.slot == group.slot then
        local engineFirst = socketGroup.gemList[1]
        if not match or (first and engineFirst and engineFirst.skillId == first.skillId) then match = socketGroup end
      end
    end
    local kept = {}
    for _, gem in ipairs(match and match.gemList or {}) do
      if gem.skillId then kept[gem.skillId] = true end
    end
    local gems = {}
    for index, gem in ipairs(group.gems) do
      local granted = not match and index == 1
      if not granted and not (gem.skillId and kept[gem.skillId]) then table.insert(gems, gem.name) end
    end
    if #gems > 0 then
      local label = group.label ~= nil and group.label ~= '' and group.label or nil
      table.insert(dropped, {
        group = label or (first and first.name) or group.source,
        source = group.source,
        grantedBy = grantor_name(group.source),
        grantMissing = not match or nil,
        gems = gems,
      })
    end
  end
  return dropped
end

-- load_build_xml {xml, name, keepLevel?} (C-2, D-29): validate first, so a bad document never reaches PoB and the
-- engine's current build is untouched; after the load, check that PoB really switched to it. The reply's
-- `droppedSupports` names the gems PoB dropped from the build's granted groups (D-398), [] for none.
handlers.load_build_xml = function(params)
  local xml = params.xml
  if xml ~= nil and type(xml) ~= 'string' then
    return load_failed('xml must be a string, got ' .. type(xml))
  end
  if xml == nil or xml:match('^%s*$') then
    return load_failed('empty XML')
  end
  if not _G.loadBuildFromXML or not _G.main or not _G.launch or not _G.common then
    return { ok = false, error = 'headless wrapper not initialized' }
  end
  local parsed, dbXML, parseErr = pcall(common.xml.ParseXML, xml)
  if not parsed then
    return load_failed('XML parse error: ' .. tostring(dbXML))
  end
  if not dbXML then
    return load_failed('XML parse error: ' .. tostring(parseErr))
  end
  local first = dbXML[1]
  if type(first) ~= 'table' or first.elem ~= 'PathOfBuilding2' then
    return load_failed('root element is ' .. root_element_name(dbXML) .. ', expected PathOfBuilding2')
  end

  local name = params.name ~= nil and tostring(params.name) or 'API Build'
  local readGroups, grantedGroups = pcall(document_granted_groups, first)
  launch.promptMsg = nil
  local popupsBefore = main.popups and #main.popups or 0
  _G.loadBuildFromXML(xml, name)

  local problems = {}
  if main.mode ~= 'BUILD' then
    table.insert(problems, 'engine mode is ' .. tostring(main.mode) .. ', expected BUILD')
  end
  if main.newMode ~= nil then
    table.insert(problems, 'a mode switch to ' .. tostring(main.newMode) .. ' is still pending')
  end
  local loadedName = _G.build and build.buildName
  if loadedName ~= name then
    table.insert(problems, 'loaded build is named ' .. tostring(loadedName) .. ', expected ' .. name)
  end
  -- A raise inside Build:Init is caught by launch:OnFrame's PCall and lands in promptMsg (ShowErrMsg),
  -- while mode, newMode and buildName all look like a successful switch: the message is the evidence.
  if launch.promptMsg ~= nil then
    table.insert(problems, 'PoB raised while loading the build: ' .. plain(launch.promptMsg))
  end
  -- A <Build> without targetVersion="<live>" (missing or legacy) makes Build:Init open its "Game
  -- Version" conversion popup and return before the tabs are rebuilt, which leaves the previous
  -- build's tree, items and skills under the new name (Modules/Build.lua, buildMode:Init).
  if _G.build and build.targetVersion == nil then
    table.insert(problems, 'the <Build> targetVersion is missing or legacy (expected '
      .. tostring(rawget(_G, 'liveTargetVersion')) .. '), so PoB opened its game-version conversion popup instead of loading it')
  end
  local popupsAfter = main.popups and #main.popups or 0
  if popupsAfter > popupsBefore then
    table.insert(problems, 'PoB opened ' .. (popupsAfter - popupsBefore) .. ' popup(s) during the load')
    -- Close the popups this load opened, so failed loads don't pile them up in the engine.
    while #main.popups > popupsBefore do main:ClosePopup() end
  end
  if TEST_ACTIONS and params.__forcePostCheckFailure then
    table.insert(problems, 'post-check failure forced by the test override')
  end
  if #problems > 0 then
    return load_failed('load failed: ' .. table.concat(problems, '; '))
  end
  -- keepLevel (the session's put-back after a temporary load, D-9): every load ends in PoB's
  -- RefreshStatList, whose level estimate moves an auto-mode level to PoB's estimate. Reloading an
  -- export must give back the build that was exported, so the recorded level and flag are put back.
  if params.keepLevel == true then
    local level, autoMode = recorded_level(first)
    if level ~= nil then
      local restored, restoreErr = pcall(BuildOps.restore_level, level, autoMode)
      if not restored then
        return load_failed('load failed: putting back the recorded level failed: ' .. plain(restoreErr))
      end
    end
  end
  -- The warning never fails a load that worked: a fault in it goes to stderr, and the reply names nothing.
  local found, dropped = false, nil
  if readGroups then found, dropped = pcall(dropped_granted_gems, grantedGroups) end
  if not found then
    io.stderr:write('[Handlers] reading the dropped granted gems failed: ' .. tostring(readGroups and dropped or grantedGroups) .. '\n')
    dropped = {}
  end
  return { ok = true, result = { name = name, droppedSupports = dropped } }
end

-- With `breakdown` ({groupIndex?, fields}), the reply adds the per-skill, per-stat-set breakdown
-- (C-45); `stats` is read first, from the build as it is.
handlers.get_stats = function(params)
  local fields = params and params.fields or nil
  local stats, err = BuildOps.export_stats(fields)
  if not stats then
    return { ok = false, error = err }
  end
  local reply = { ok = true, stats = stats }
  if params and type(params.breakdown) == 'table' then
    local breakdown, berr = BuildOps.stats_breakdown(params.breakdown)
    if not breakdown then return { ok = false, error = berr } end
    reply.breakdown = breakdown
  end
  return reply
end

handlers.get_items = function(params)
  local list, err = BuildOps.get_items()
  if not list then return { ok = false, error = err } end
  return { ok = true, items = list }
end

handlers.get_skills = function(params)
  local info, err = BuildOps.get_skills()
  if not info then return { ok = false, error = err } end
  return { ok = true, skills = info }
end

handlers.get_tree = function(params)
  local tree, err = BuildOps.get_tree()
  if not tree then
    return { ok = false, error = err }
  end
  return { ok = true, tree = tree }
end

handlers.set_main_selection = function(params)
  local ok2, err = BuildOps.set_main_selection(params or {})
  if not ok2 then return { ok = false, error = err } end
  local skills = BuildOps.get_skills()
  -- With `statSet`, the selected stat set ({index, label, count, skill, grantedEffectId}; C-44); with
  -- `minionSkill`, the minion selection (BuildOps.select_minion_skill's; D-377).
  local selected = type(ok2) == 'table' and ok2 or {}
  return { ok = true, skills = skills, statSet = selected.statSet, minion = selected.minion }
end

handlers.set_tree = function(params)
  local ok2, err = BuildOps.set_tree(params or {})
  if not ok2 then
    return { ok = false, error = err }
  end
  local tree = BuildOps.get_tree()
  return { ok = true, tree = tree }
end

handlers.add_item_text = function(params)
  local res, err = BuildOps.add_item_text(params or {})
  if not res then return { ok = false, error = err } end
  return { ok = true, item = res }
end

handlers.export_build_xml = function(params)
  local xml, err = BuildOps.export_build_xml()
  if not xml then return { ok = false, error = err } end
  return { ok = true, xml = xml }
end

-- set_level {level, autoMode?}: autoMode true also turns on PoB's auto-level mode (D-196); without it the
-- level is manual, as before.
handlers.set_level = function(params)
  if not params or params.level == nil then
    return { ok = false, error = 'missing level' }
  end
  local ok2, err = BuildOps.set_level(params.level, params.autoMode)
  if not ok2 then return { ok = false, error = err } end
  return { ok = true }
end

handlers.set_flask_active = function(params)
  local ok2, err = BuildOps.set_flask_active(params or {})
  if not ok2 then return { ok = false, error = err } end
  return { ok = true }
end

handlers.get_build_info = function(params)
  local info, err = BuildOps.get_build_info()
  if not info then return { ok = false, error = err } end
  return { ok = true, info = info }
end

-- PoB's warning lines (D-30), read without changing the level or its auto mode.
handlers.get_warnings = function(params)
  local res, err = BuildOps.get_warnings()
  if not res then return { ok = false, error = err } end
  return { ok = true, result = res }
end

-- D-383: what the game won't allow in the loaded build. A read.
handlers.get_rule_breaks = function(params)
  local res, err = BuildOps.get_rule_breaks()
  if not res then return { ok = false, error = err } end
  return { ok = true, result = res }
end

-- C-48 (D-194): the tree carries the ascendancy points used after the call.
handlers.update_tree_delta = function(params)
  local res, err = BuildOps.update_tree_delta(params or {})
  if not res then return { ok = false, error = err } end
  local tree = BuildOps.get_tree()
  tree.ascendancyPointsUsed = res.ascendancyPointsUsed
  return {
    ok = true,
    tree = tree,
    autoPathedNodes = res.autoPathedNodes,
    skippedAscendancyNodes = res.skippedAscendancyNodes,
  }
end

handlers.calc_with = function(params)
  local out, err = BuildOps.calc_with(params or {})
  if not out then return { ok = false, error = err } end
  return { ok = true, output = out }
end

handlers.get_config = function(params)
  local cfg, err = BuildOps.get_config()
  if not cfg then return { ok = false, error = err } end
  return { ok = true, config = cfg }
end

handlers.set_config = function(params)
  local ok2, err = BuildOps.set_config(params or {})
  if not ok2 then return { ok = false, error = err } end
  local cfg = BuildOps.get_config()
  return { ok = true, config = cfg }
end

handlers.create_socket_group = function(params)
  local res, err = BuildOps.create_socket_group(params or {})
  if not res then return { ok = false, error = err or 'failed to create socket group' } end
  return { ok = true, socketGroup = res }
end

handlers.add_gem = function(params)
  local res, err = BuildOps.add_gem(params or {})
  if not res then return { ok = false, error = err or 'failed to add gem' } end
  return { ok = true, gem = res }
end

handlers.set_gem_level = function(params)
  local ok2, err = BuildOps.set_gem_level(params or {})
  if not ok2 then return { ok = false, error = err or 'failed to set gem level' } end
  return { ok = true }
end

handlers.set_gem_quality = function(params)
  local ok2, err = BuildOps.set_gem_quality(params or {})
  if not ok2 then return { ok = false, error = err or 'failed to set gem quality' } end
  return { ok = true }
end

-- set_gem_corruption {state, groupIndex?, gemIndex?} (D-91): result {state, gems = [{groupIndex, gemIndex, name}]}
handlers.set_gem_corruption = function(params)
  local res, err = BuildOps.set_gem_corruption(params or {})
  if not res then return { ok = false, error = err or 'failed to set gem corruption' } end
  return { ok = true, result = res }
end

handlers.remove_skill = function(params)
  local ok2, err = BuildOps.remove_skill(params or {})
  if not ok2 then return { ok = false, error = err or 'failed to remove skill' } end
  return { ok = true }
end

handlers.remove_gem = function(params)
  local ok2, err = BuildOps.remove_gem(params or {})
  if not ok2 then return { ok = false, error = err or 'failed to remove gem' } end
  return { ok = true }
end

handlers.search_nodes = function(params)
  local res, err = BuildOps.search_nodes(params or {})
  if not res then return { ok = false, error = err or 'failed to search nodes' } end
  return { ok = true, results = res }
end

handlers.list_gems = function(params)
  local res, err = BuildOps.list_gems(params or {})
  if not res then return { ok = false, error = err or 'failed to list gems' } end
  return { ok = true, result = res }
end

-- list_support_candidates {groupIndex, measure?}: the supports PoB says can support the group's active
-- skills (calcLib.canGrantedEffectSupportActiveSkill), minus the group's own; `measure` adds each one's
-- measured value on that group.
handlers.list_support_candidates = function(params)
  local res, err = BuildOps.list_support_candidates(params or {})
  if not res then return { ok = false, error = err or 'failed to list support candidates' } end
  return { ok = true, result = res }
end

handlers.get_classes = function(params)
  local res, err = BuildOps.get_classes()
  if not res then return { ok = false, error = err or 'failed to get classes' } end
  return { ok = true, result = res }
end

handlers.set_socket_group_enabled = function(params)
  local res, err = BuildOps.set_socket_group_enabled(params or {})
  if not res then return { ok = false, error = err or 'failed to set socket group enabled' } end
  return { ok = true, result = res }
end

handlers.set_gem_enabled = function(params)
  local ok2, err = BuildOps.set_gem_enabled(params or {})
  if not ok2 then return { ok = false, error = err or 'failed to set gem enabled' } end
  return { ok = true }
end

handlers.create_spec = function(params)
  local res, err = BuildOps.create_spec(params or {})
  if not res then return { ok = false, error = err or 'failed to create spec' } end
  return { ok = true, result = res }
end

handlers.list_specs = function(params)
  local res, err = BuildOps.list_specs()
  if not res then return { ok = false, error = err or 'failed to list specs' } end
  return { ok = true, result = res }
end

handlers.select_spec = function(params)
  local res, err = BuildOps.select_spec(params or {})
  if not res then return { ok = false, error = err or 'failed to select spec' } end
  return { ok = true, result = res }
end

handlers.delete_spec = function(params)
  local res, err = BuildOps.delete_spec(params or {})
  if not res then return { ok = false, error = err or 'failed to delete spec' } end
  return { ok = true, result = res }
end

handlers.rename_spec = function(params)
  local res, err = BuildOps.rename_spec(params or {})
  if not res then return { ok = false, error = err or 'failed to rename spec' } end
  return { ok = true, result = res }
end

handlers.list_item_sets = function(params)
  local res, err = BuildOps.list_item_sets()
  if not res then return { ok = false, error = err or 'failed to list item sets' } end
  return { ok = true, result = res }
end

handlers.select_item_set = function(params)
  local res, err = BuildOps.select_item_set(params or {})
  if not res then return { ok = false, error = err or 'failed to select item set' } end
  return { ok = true, result = res }
end

-- Test actions (C-2): registered only under POB_API_TEST_ACTIONS=1; otherwise UNKNOWN_ACTION.
if TEST_ACTIONS then
  -- Busy-wait `ms` milliseconds of CPU time, then reply.
  handlers.__test_sleep = function(params)
    local ms = tonumber(params.ms) or 0
    local t0 = os.clock()
    while (os.clock() - t0) * 1000 < ms do end
    return { ok = true }
  end

  handlers.__test_crash = function(params)
    os.exit(tonumber(params.code) or 3)
  end

  -- A self-referencing reply, which exercises ENCODE.
  handlers.__test_cycle = function(params)
    local t = {}
    t.self = t
    return { ok = true, result = t }
  end

  handlers.__test_state = function(params)
    local m = _G.main
    local promptMsg = _G.launch and launch.promptMsg
    local buildName = _G.build and build.buildName
    return { ok = true, result = {
      popups = m and m.popups and #m.popups or 0,
      promptMsg = promptMsg ~= nil and tostring(promptMsg) or NULL,
      devAutoSaveDisabled = m ~= nil and m.disableDevAutoSave == true,
      mode = m and m.mode or NULL,
      buildName = buildName ~= nil and tostring(buildName) or NULL,
    } }
  end

  -- Run `code` in the live engine state and reply with its (first) return value.
  handlers.__test_eval = function(params)
    if type(params.code) ~= 'string' then
      return { ok = false, error = 'code must be a string' }
    end
    local chunk, err = loadstring(params.code, '=__test_eval')
    if not chunk then
      return { ok = false, error = 'compile error: ' .. tostring(err) }
    end
    return { ok = true, result = chunk() }
  end
end

for name, fn in pairs(require('API.Trade').handlers) do handlers[name] = fn end
for name, fn in pairs(require('API.Lookup').handlers) do handlers[name] = fn end
for name, fn in pairs(require('API.Coverage').handlers) do handlers[name] = fn end
for name, fn in pairs(require('API.Sets').handlers) do handlers[name] = fn end
for name, fn in pairs(require('API.Compile').handlers) do handlers[name] = fn end
for name, fn in pairs(require('API.NodePower').handlers) do handlers[name] = fn end

return {
  handlers = handlers,
  version_meta = version_meta,
  configure = configure,
}
