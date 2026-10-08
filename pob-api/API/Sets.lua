-- API/Sets.lua
-- Item, skill and config sets, and loadouts (C-39, WU-35):
--
--   manage_sets {setType, action, id?, title?, useSecondWeaponSet?}
--     setType   'item', 'skill', 'config' or 'loadout'
--     action    'list', 'create', 'copy', 'rename' or 'select'; a loadout takes only 'list' and 'select'.
--               There is no delete: a new set's id is #sets+1 (PoB's own New...Set and Copy...Set), which
--               could collide with a set after a delete (R-29).
--     id        the source set for 'copy'; the target for 'rename' and 'select'
--     title     the new set's title ('create'; 'copy', where it defaults to the source's title without its
--               {...} tag plus " (Copy)"), the new title ('rename'), or the loadout's name (a loadout 'select')
--     useSecondWeaponSet  item sets only: written on the set the action targets (the new set, or `id`)
--   -> {setType, activeId?, sets[], targetId?, mainSocketGroup?, loadouts?, targetName?}
--      sets[]     {id, title, active}; an item set adds `useSecondWeaponSet`; a skill set adds `mainGroup`
--                 {index, label?, skills[]}, its group at the build-wide `mainSocketGroup`, when it has one
--      loadouts[] {name, active, specId?, itemSetId?, skillSetId?, configSetId?} (loadout type only)
--
-- create runs New...Set(#sets+1, title) and copy runs Copy...Set(id, title); neither activates the set.
-- A skill set copy also unshares each gem's stat-set choice tables, which PoB's copy leaves shared.
-- rename runs Rename...Set; select runs SetActive...Set. Every action except list rebuilds the outputs.
-- A title holds at most one {...} tag, at its end, of comma-separated non-empty ids of [A-Za-z0-9]
-- ({1}, {1,2}): PoB links a set by its title's first tag only (vendor Modules/Build.lua:641,669; D-245).
-- Any other title fails the call and nothing changes.
--
-- Loadouts: build:SyncLoadouts() runs first; the list is build.controls.buildLoadouts.list without its
-- ^7^7 menu rows. A select looks the name up in that list first (PoB's GetLoadoutByName indexes its link
-- table without a nil check, so an unlisted {id} name would raise), then runs
-- SetActiveLoadout(GetLoadoutByName(name)). A loadout is active when the four sets it names are the active
-- ones. PoB's copy-loadout call is never used: it raises on {id} names (D-103).
--
-- Registered by one line in Handlers.lua.

local BuildOps = require('API.BuildOps')

local M = {}

local Failure = {}
local function fail(msg)
  error(setmetatable({ msg = msg }, Failure), 0)
end

-- Per set type: the tab, its set table, order list and active id, and PoB's own calls.
local KINDS = {
  item = {
    label = 'item set', tab = 'itemsTab', sets = 'itemSets', order = 'itemSetOrderList', active = 'activeItemSetId',
    new = 'NewItemSet', copy = 'CopyItemSet', rename = 'RenameItemSet', select = 'SetActiveItemSet',
  },
  skill = {
    label = 'skill set', tab = 'skillsTab', sets = 'skillSets', order = 'skillSetOrderList', active = 'activeSkillSetId',
    new = 'NewSkillSet', copy = 'CopySkillSet', rename = 'RenameSkillSet', select = 'SetActiveSkillSet',
  },
  config = {
    label = 'config set', tab = 'configTab', sets = 'configSets', order = 'configSetOrderList', active = 'activeConfigSetId',
    new = 'NewConfigSet', copy = 'CopyConfigSet', rename = 'RenameConfigSet', select = 'SetActiveConfigSet',
  },
}

local ACTIONS = { list = true, create = true, copy = true, rename = true, select = true }

local function built()
  if not _G.build or not build.treeTab or not build.itemsTab or not build.skillsTab or not build.configTab then
    fail('build not initialized')
  end
end

local function tabOf(kind)
  local tab = build[kind.tab]
  if not tab or type(tab[kind.sets]) ~= 'table' or type(tab[kind.order]) ~= 'table' then
    fail('build not initialized: no ' .. kind.label .. 's')
  end
  return tab
end

-- A set's title as PoB shows it (an untitled set is "Default", as SyncLoadouts reads it).
local function titleOf(set)
  return set.title or 'Default'
end

local function rebuild()
  build.buildFlag = true
  BuildOps.get_main_output()
end

-- PoB links a set to loadouts through the first {...} in its title, read with %{([%w,]+)%} (vendor
-- Modules/Build.lua:641,669) and split at its commas. D-245: a title holds at most one tag, at its end, of
-- comma-separated non-empty ids of letters and digits. Anything else would link nothing, or not what it
-- says ({1, 2}, {,}, {1,}, "X {1} Y {2}"), so it is refused.
local TITLE_RULE = 'a title may end with one {...} tag of comma-separated loadout ids of letters and digits '
  .. '(the tag holds only [A-Za-z0-9,]: no spaces, no empty id, as in {1} or {1,2}), the tag PoB links sets '
  .. 'to loadouts by'

function M.checkTitle(title)
  if not title:find('[{}]') then return end
  local tag = title:match('^[^{}]*{([^{}]*)}%s*$')
  local problem
  if not tag then
    problem = 'its braces are not one {...} tag at the end'
  elseif not tag:match('^[A-Za-z0-9,]*$') or (',' .. tag .. ','):find(',,', 1, true) then
    problem = '"{' .. tag .. '}" breaks it'
  end
  if problem then fail(('title "%s": %s; %s'):format(title, TITLE_RULE, problem)) end
end

-- An untitled copy's title: the source's title without its {...} tag, plus " (Copy)" (D-245). A copy that
-- kept the tag would be a later set with the same link, which PoB lets take over the source's loadouts.
local function copyTitle(set)
  local base = titleOf(set):gsub('{[^{}]*}', ''):gsub('[{}]', ''):match('^%s*(.-)%s*$')
  if base == '' then base = 'Default' end
  return base .. ' (Copy)'
end

-- PoB's CopySkillSet copies each gem shallowly (vendor Classes/SkillsTab.lua:1503-1520), so a gem's
-- per-instance choice tables (its stat set per granted effect, PoB2's skill part, and the minion ones)
-- would stay shared with the source set's gem. Each is copied, so a choice in one set never changes the
-- other.
local GEM_TABLES = { 'statSet', 'statSetCalcs', 'skillMinionSkillStatSetIndexLookup', 'skillMinionSkillStatSetIndexLookupCalcs' }

local function unshareGems(skillSet)
  for _, group in ipairs(skillSet.socketGroupList or {}) do
    for _, gem in ipairs(group.gemList or {}) do
      for _, field in ipairs(GEM_TABLES) do
        if type(gem[field]) == 'table' then gem[field] = copyTable(gem[field]) end
      end
    end
  end
end

local function needTitle(params, action)
  local title = params.title
  if title == nil then fail(action .. ' needs a title') end
  if type(title) ~= 'string' then fail('title must be a string') end
  if not title:match('%S') then fail('title must not be blank') end
  M.checkTitle(title)
  return title
end

local function idList(tab, kind)
  local ids = {}
  for _, id in ipairs(tab[kind.order]) do table.insert(ids, tostring(id)) end
  return table.concat(ids, ', ')
end

local function needId(params, tab, kind, action)
  if params.id == nil then fail(action .. ' needs the id of a ' .. kind.label) end
  local id = tonumber(params.id)
  if not id or id % 1 ~= 0 then fail('id must be a whole number') end
  local listed = false
  for _, v in ipairs(tab[kind.order]) do
    if v == id then listed = true break end
  end
  if not listed or not tab[kind.sets][id] then
    fail(('%s %d does not exist; the ids are %s'):format(kind.label, id, idList(tab, kind)))
  end
  return id
end

-- The names of a socket group's active skills: PoB's calculated list for the active skill set (as
-- get_skills reads it); for another set, whose groups PoB doesn't calculate, its enabled non-support gems.
local function groupSkills(group, calculated)
  local names = {}
  if calculated then
    for _, eff in ipairs(group.displaySkillList or {}) do
      if eff and eff.activeEffect and eff.activeEffect.grantedEffect then
        table.insert(names, eff.activeEffect.grantedEffect.name)
      end
    end
    return names
  end
  for _, gem in ipairs(group.gemList or {}) do
    local ge = gem.gemData and gem.gemData.grantedEffect or gem.grantedEffect
    if ge and not ge.support and gem.enabled ~= false then table.insert(names, ge.name) end
  end
  return names
end

-- A skill set's group at the build-wide main socket group index, or nil when it has none.
local function mainGroupOf(set, active)
  local index = tonumber(build.mainSocketGroup)
  local group = index and set.socketGroupList and set.socketGroupList[index]
  if not group then return nil end
  return { index = index, label = group.label, skills = groupSkills(group, active) }
end

local function listSets(setType)
  local kind = KINDS[setType]
  local tab = tabOf(kind)
  local activeId = tab[kind.active]
  local sets = {}
  for _, id in ipairs(tab[kind.order]) do
    local set = tab[kind.sets][id]
    if set then
      local entry = { id = id, title = titleOf(set), active = (id == activeId) }
      if setType == 'item' then entry.useSecondWeaponSet = set.useSecondWeaponSet == true end
      if setType == 'skill' then entry.mainGroup = mainGroupOf(set, id == activeId) end
      table.insert(sets, entry)
    end
  end
  local result = { setType = setType, activeId = activeId, sets = sets }
  if setType == 'skill' then result.mainSocketGroup = tonumber(build.mainSocketGroup) end
  return result
end

-- The loadout names, as PoB's loadout menu lists them after a sync (its ^7^7 rows are menu entries).
local function loadoutNames()
  build:SyncLoadouts()
  local names = {}
  local control = build.controls and build.controls.buildLoadouts
  for _, entry in ipairs(control and control.list or {}) do
    if type(entry) == 'string' and entry:sub(1, 4) ~= '^7^7' then table.insert(names, entry) end
  end
  return names
end

local function resolveLoadout(name)
  local ok, loadout = pcall(build.GetLoadoutByName, build, name)
  if ok and type(loadout) == 'table' then return loadout end
  return nil
end

local function listLoadouts()
  local names = loadoutNames()
  local loadouts = {}
  for _, name in ipairs(names) do
    local entry = { name = name, active = false }
    local loadout = resolveLoadout(name)
    if loadout then
      entry.specId = loadout.specId
      entry.itemSetId = loadout.itemSetId
      entry.skillSetId = loadout.skillSetId
      entry.configSetId = loadout.configSetId
      entry.active = loadout.specId == build.treeTab.activeSpec
        and loadout.itemSetId == build.itemsTab.activeItemSetId
        and loadout.skillSetId == build.skillsTab.activeSkillSetId
        and loadout.configSetId == build.configTab.activeConfigSetId
    end
    table.insert(loadouts, entry)
  end
  return { setType = 'loadout', sets = {}, loadouts = loadouts }
end

local function quotedList(names)
  if #names == 0 then return 'none' end
  local out = {}
  for _, n in ipairs(names) do table.insert(out, '"' .. n .. '"') end
  return table.concat(out, ', ')
end

local function manageLoadouts(params)
  local action = params.action
  if action == 'list' then return listLoadouts() end
  if action ~= 'select' then
    fail("a loadout takes only the actions list and select; create, copy or rename its item, skill and config sets and its tree spec instead")
  end
  local name = params.title
  if type(name) ~= 'string' or name == '' then fail('a loadout select needs title: the loadout name, as list shows it') end
  local names = loadoutNames()
  local listed = false
  for _, n in ipairs(names) do
    if n == name then listed = true break end
  end
  if not listed then fail(('no loadout named "%s"; the loadouts are: %s'):format(name, quotedList(names))) end
  local loadout = resolveLoadout(name)
  if not loadout or not loadout.specId then fail(('PoB could not resolve loadout "%s"'):format(name)) end
  build:SetActiveLoadout(loadout)
  rebuild()
  local result = listLoadouts()
  result.targetName = name
  return result
end

function M.manage_sets(params)
  built()
  local setType, action = params.setType, params.action
  if setType == 'loadout' then return manageLoadouts(params) end
  local kind = KINDS[setType]
  if not kind then fail("setType must be 'item', 'skill', 'config' or 'loadout'") end
  if not ACTIONS[action] then fail("action must be 'list', 'create', 'copy', 'rename' or 'select'") end
  local useSecond = params.useSecondWeaponSet
  if useSecond ~= nil then
    if setType ~= 'item' then fail('useSecondWeaponSet applies only to item sets') end
    if type(useSecond) ~= 'boolean' then fail('useSecondWeaponSet must be true or false') end
    if action == 'list' then fail('useSecondWeaponSet needs a set to write: create, copy, rename or select one') end
  end
  local tab = tabOf(kind)
  if action == 'list' then return listSets(setType) end

  local targetId
  if action == 'create' then
    local title = needTitle(params, 'create')
    targetId = #tab[kind.sets] + 1
    tab[kind.new](tab, targetId, title)
  elseif action == 'copy' then
    local sourceId = needId(params, tab, kind, 'copy')
    local title
    if params.title == nil then
      title = copyTitle(tab[kind.sets][sourceId])
    else
      title = needTitle(params, 'copy')
    end
    local newSet = tab[kind.copy](tab, sourceId, title)
    if setType == 'skill' then unshareGems(newSet) end
    targetId = newSet.id
  elseif action == 'rename' then
    targetId = needId(params, tab, kind, 'rename')
    tab[kind.rename](tab, targetId, needTitle(params, 'rename'))
  else -- select
    targetId = needId(params, tab, kind, 'select')
  end
  if useSecond ~= nil then tab[kind.sets][targetId].useSecondWeaponSet = useSecond end
  if action == 'select' then tab[kind.select](tab, targetId) end
  rebuild()
  local result = listSets(setType)
  result.targetId = targetId
  return result
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
  manage_sets = handler(M.manage_sets),
}

return M
