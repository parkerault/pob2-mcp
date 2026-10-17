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

-- load_build_xml {xml, name, keepLevel?} (C-2, D-29): validate first, so a bad document never reaches PoB and the
-- engine's current build is untouched; after the load, check that PoB really switched to it.
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
  return { ok = true, result = { name = name } }
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

return {
  handlers = handlers,
  version_meta = version_meta,
  configure = configure,
}
