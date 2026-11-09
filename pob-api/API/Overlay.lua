-- API/Overlay.lua
-- The league overlay (C-66, D-523, amendment 16 §19): the new league's socketables and uniques, added to PoB's data from
-- the sidecars league-digest.mjs writes beside each digest (`<slug>.overlay.json`, Appendix A.11), so the engine measures
-- them before our pin knows them. PoB's own files in vendor/ stay unmodified.
--
-- The server lists the sidecars in Node (headless PoB can't list a folder: NewFileSearch is a stub,
-- HeadlessWrapper.lua:83) and passes their absolute paths in POB2_OVERLAY_SIDECARS, a JSON list. bootstrap.lua's step 5e
-- (after the patches, 5d) calls M.apply_env() in a pcall, and reads only those files, each in its own pcall:
--   * a socketable goes into data.itemMods.Runes[<name>][<slot key>], which PoB reads live (Classes/Item.lua:1050,
--     :1615-1672), with its type, lines, statOrder, rank and isSocketBound (an entry without rank[1] or statOrder[1]
--     breaks every item of its slot type, Classes/Item.lua:1262-1265, Classes/ItemsTab.lua:1952), and into the items
--     tab's rune list, a file-local PoB builds once (Classes/ItemsTab.lua:1948-1963), reached through debug.getupvalue on
--     GetValidRunesForItem; failing that it is logged, and only the trade rune list lacks them;
--   * a unique, as raw text, into data.uniques[<base type>] and main.uniqueDB.list, built as PoB builds its own
--     (Modules/Main.lua:148-189).
-- Retirement: an entry whose name the pin already defines (PoB's own rune or unique) is skipped and logged.
--
--   M.ENV               the child variable's name
--   M.apply_env()       step 5e: every file the variable names; returns M.apply's result
--   M.apply(paths)      { added = {name...}, retired = {name...}, failed = {{file, error}...} }
--   M.is_overlay(name)  whether the overlay added an entry of that name (the lookups mark it "not in PoB's release")
--   M.names()           the names it added, sorted

local M = {}

M.ENV = 'POB2_OVERLAY_SIDECARS'

-- name -> 'socketable' | 'unique', for the entries this module added.
local added = {}

local function log(msg)
  io.stderr:write('[Overlay] ' .. msg .. '\n')
end

local json
local function decoder()
  if json then return json end
  local ok, mod = pcall(require, 'dkjson')
  if not ok or type(mod) ~= 'table' then error('dkjson not found', 0) end
  json = mod
  return json
end

local function decode(text)
  local value, _, err = decoder().decode(text, 1, nil)
  if err then error(err, 0) end
  return value
end

local function readFile(p)
  local f, err = io.open(p, 'rb')
  if not f then error('cannot read ' .. tostring(p) .. ': ' .. tostring(err), 0) end
  local text = f:read('*a')
  f:close()
  return text
end

-- The items tab's rune list (Classes/ItemsTab.lua:1948), or nil with why.
local function runeList()
  local classes = _G.common and common.classes
  local itemsTab = classes and rawget(classes, 'ItemsTab')
  if type(itemsTab) ~= 'table' then return nil, 'the ItemsTab class is not loaded yet; it builds its list from data.itemMods.Runes when it loads' end
  local fn = rawget(itemsTab, 'GetValidRunesForItem')
  if type(fn) ~= 'function' then return nil, 'ItemsTabClass.GetValidRunesForItem is missing' end
  for i = 1, 200 do
    local name, value = debug.getupvalue(fn, i)
    if name == nil then break end
    if name == 'runeModLines' and type(value) == 'table' then return value end
  end
  return nil, 'GetValidRunesForItem has no runeModLines upvalue'
end

-- PoB's order for the list (Classes/ItemsTab.lua:1954-1962).
local function sortRunes(list)
  table.sort(list, function(a, b)
    if a.order == b.order then
      return a.req < b.req
    elseif a.group == b.group then
      return a.order < b.order
    else
      return a.group < b.group
    end
  end)
end

-- One socketable's PoB entry: { [slot key] = { type, <lines>, statOrder, tradeHashes, isSocketBound, rank } }.
local function socketableData(e)
  if type(e.name) ~= 'string' or e.name == '' then error('a socketable with no name', 0) end
  if type(e.slots) ~= 'table' or #e.slots == 0 then error(e.name .. ' has no slots', 0) end
  local rank = type(e.rank) == 'table' and tonumber(e.rank[1]) or tonumber(e.rank) or 0
  local out = {}
  for _, slot in ipairs(e.slots) do
    if type(slot.keys) ~= 'table' or type(slot.lines) ~= 'table' or type(slot.statOrder) ~= 'table' or #slot.lines ~= #slot.statOrder or #slot.lines == 0 then
      error(e.name .. ': a slot needs keys, and lines with a statOrder each', 0)
    end
    for _, key in ipairs(slot.keys) do
      local mod = out[key]
      if not mod then
        mod = { type = e.type or 'Rune', statOrder = {}, tradeHashes = {}, isSocketBound = e.socketBound == true, rank = { rank } }
        out[key] = mod
      end
      for i, line in ipairs(slot.lines) do
        table.insert(mod, tostring(line))
        table.insert(mod.statOrder, tonumber(slot.statOrder[i]))
      end
    end
  end
  return out
end

-- A unique's raw text, as PoB's Data/Uniques texts are written.
local function uniqueRaw(e)
  local lines = { e.name, e.base }
  if tonumber(e.level) and tonumber(e.level) > 0 then table.insert(lines, 'Requires Level ' .. tostring(math.floor(tonumber(e.level)))) end
  local implicits = type(e.implicits) == 'table' and e.implicits or {}
  table.insert(lines, 'Implicits: ' .. #implicits)
  for _, l in ipairs(implicits) do table.insert(lines, tostring(l)) end
  for _, l in ipairs(type(e.explicits) == 'table' and e.explicits or {}) do table.insert(lines, tostring(l)) end
  return table.concat(lines, '\n')
end

-- The pin's unique names (uniqueDB titles not added here).
local function pinUniqueTitles()
  local titles = {}
  local db = _G.main and main.uniqueDB and main.uniqueDB.list or {}
  for _, item in pairs(db) do
    if item.title and added[item.title] ~= 'unique' then titles[item.title] = true end
  end
  return titles
end

local function applyFile(file, result, list, titles)
  local sidecar = decode(readFile(file))
  if type(sidecar) ~= 'table' then error('not a sidecar', 0) end
  local runes = data.itemMods.Runes
  for _, e in ipairs(sidecar.socketables or {}) do
    local ok, err = pcall(function()
      if runes[e.name] and added[e.name] ~= 'socketable' then
        table.insert(result.retired, e.name)
        log(e.name .. ' is in PoB\'s release: skipped (retired)')
        return
      end
      local entry = socketableData(e)
      runes[e.name] = entry
      added[e.name] = 'socketable'
      table.insert(result.added, e.name)
      if list then
        for i = #list, 1, -1 do
          if list[i].name == e.name then table.remove(list, i) end
        end
        for slotType, mod in pairs(entry) do
          table.insert(list, { name = e.name, label = mod[1], lines = mod, req = mod.rank[1], order = mod.statOrder[1], slot = slotType, type = mod.type, group = #mod, isSocketBound = mod.isSocketBound })
        end
      end
    end)
    if not ok then table.insert(result.failed, { file = file, error = tostring(err) }) log(file .. ': ' .. tostring(err)) end
  end
  for _, e in ipairs(sidecar.uniques or {}) do
    local ok, err = pcall(function()
      if type(e.name) ~= 'string' or type(e.base) ~= 'string' then error('a unique needs a name and a base', 0) end
      if titles[e.name] then
        table.insert(result.retired, e.name)
        log(e.name .. ' is in PoB\'s release: skipped (retired)')
        return
      end
      local base = data.itemBases[e.base]
      if not base then error(e.name .. ': its base ' .. e.base .. ' is not in the pin', 0) end
      local raw = uniqueRaw(e)
      local item = new('Item', raw, 'UNIQUE', true)
      if not item.base then error(e.name .. ': PoB does not read it as an item', 0) end
      local key = tostring(base.type or 'overlay'):lower()
      data.uniques[key] = data.uniques[key] or {}
      table.insert(data.uniques[key], raw)
      if _G.main and main.uniqueDB and main.uniqueDB.list then main.uniqueDB.list[item.name] = item end
      added[e.name] = 'unique'
      table.insert(result.added, e.name)
    end)
    if not ok then table.insert(result.failed, { file = file, error = tostring(err) }) log(file .. ': ' .. tostring(err)) end
  end
end

function M.apply(paths)
  local result = { added = {}, retired = {}, failed = {} }
  if type(paths) ~= 'table' or #paths == 0 then return result end
  local list, why = runeList()
  if not list then log('the items tab\'s rune list was not reached (' .. why .. '): the trade rune list lacks the overlay\'s socketables') end
  local titles = pinUniqueTitles()
  for _, file in ipairs(paths) do
    local ok, err = pcall(applyFile, tostring(file), result, list, titles)
    if not ok then
      table.insert(result.failed, { file = tostring(file), error = tostring(err) })
      log(tostring(file) .. ' not read: ' .. tostring(err))
    end
  end
  if list then sortRunes(list) end
  if #result.added > 0 then log('added ' .. #result.added .. ' entr' .. (#result.added == 1 and 'y' or 'ies') .. ' from ' .. #paths .. ' sidecar' .. (#paths == 1 and '' or 's')) end
  return result
end

function M.apply_env()
  local value = os.getenv(M.ENV)
  if value == nil or value == '' then return M.apply({}) end
  local paths = decode(value)
  if type(paths) ~= 'table' then error(M.ENV .. ' is not a JSON list of paths', 0) end
  return M.apply(paths)
end

function M.is_overlay(name)
  return added[name] ~= nil
end

function M.names()
  local out = {}
  for name in pairs(added) do table.insert(out, name) end
  table.sort(out)
  return out
end

return M
