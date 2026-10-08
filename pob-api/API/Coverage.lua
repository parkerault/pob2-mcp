-- API/Coverage.lua
-- Whether PoB applies each line of an item, a passive node or a gem (C-38, WU-32):
--
--   check_coverage  {itemText?, nodes?, gems?, build?, sourceNames}
--     itemText   one item, as add_item takes it: its enchant, rune, implicit and explicit lines of the
--                selected variant (the lines Item.lua's BuildModList applies or drops), ranged as PoB ranges
--                them
--     nodes      passive node ids or exact names (a name selects every node bearing it): their `sd` lines
--     gems       gem names: every described line of every stat set, at the build's gem level and quality
--                (its first instance in the active skill set), else at lookup_game_data's defaults
--     build      true, alone: the active item set's equipped items, the active spec's nodes and the active
--                skill set's gems
--     sourceNames  required: every identifier in PoB's Modules/ and Classes/ .lua files except
--                Modules/ModParser.lua (the server's name scan, D-226)
--   -> {counts, entries[], gems[], checked}, each entry {kind, source, line, status, remainder?,
--      joinedWith?, unread?, stat?, nodeId?}
--
-- Statuses (exactly one per line or joined line):
--   fully parsed       a non-empty mod list, no remainder (for a gem line: its stat has a stat map)
--   partly parsed      a non-empty mod list plus a remainder (`remainder`, verbatim from the parser)
--   unparsed           no mod list; also an empty mod list with a remainder, which PoB applies nothing from
--   parsed to nothing  an empty mod list, no remainder
--   possibly unread    fully parsed, but some mod's name (a nested `value.mod` one included) is not in
--                      sourceNames (`unread` lists them); a compound "Condition:X" name is in them when each
--                      ':'-separated part is
--   possibly unmodelled; check config
--                      a gem line whose stat is in neither statSet.statMap nor data.skillStatMap (PoB's
--                      red-tooltip rule, GemTooltip.lua:17-37)
--
-- Joins: a line is parsed alone first; only a failed one is re-parsed by its source's join rule. An item's
-- lines are joined as Item.lua joins them while parsing (a clean join of a failed line with the next raw
-- line; PoB keeps the joined line as one mod line); a node's line is joined with one or more following
-- lines (PassiveTree.lua's ProcessStats). A clean join is one entry naming its lines (`joinedWith`); an
-- absorbed line is never an entry of its own. A failed join leaves the single line's status and remainder.
--
-- Registered by one line in Handlers.lua. Rules: a read; nothing here changes the build, writes a file or
-- makes a request (an item text is constructed, never added).

local Lookup = require('API.Lookup')
local Util = require('API.Util')

local construct = Util.construct

local M = {}

local FULL = 'fully parsed'
local PARTLY = 'partly parsed'
local UNPARSED = 'unparsed'
local NOTHING = 'parsed to nothing'
local UNREAD = 'possibly unread'
local UNMODELLED = 'possibly unmodelled; check config'

-- Every status, in the order counts are reported.
M.STATUSES = { FULL, PARTLY, UNPARSED, NOTHING, UNREAD, UNMODELLED }

local MAX_ITEM_TEXT_LENGTH = 10240 -- as add_item_text

local Failure = {}
local function fail(msg)
  error(setmetatable({ msg = msg }, Failure), 0)
end

local function gameData()
  local d = (_G.build and build.data) or _G.data
  if not d or not d.gems then fail('game data not available') end
  return d
end

local function trimmed(v)
  if type(v) ~= 'string' then return nil end
  local s = v:match('^%s*(.-)%s*$')
  return s ~= '' and s or nil
end

local function splitLines(s)
  local out = {}
  for part in tostring(s):gmatch('[^\n]+') do table.insert(out, part) end
  return out
end

-- ---------------------------------------------------------------------------------------------------
-- Line classifier

-- The mod names a parsed list produces, nested `value.mod` ones (minion, enemy, skill mods) included.
local function modNames(list, out)
  for _, mod in ipairs(list) do
    if type(mod) == 'table' then
      if type(mod.name) == 'string' then table.insert(out, mod.name) end
      if type(mod.value) == 'table' and type(mod.value.mod) == 'table' then modNames({ mod.value.mod }, out) end
    end
  end
  return out
end

-- Whether the scan has a mod name. A compound name ("Condition:X", "Multiplier:X") can't be one identifier,
-- so it counts as named when each of its ':'-separated parts is (PoB reads it as {type = "Condition",
-- var = "X"}).
local function named(names, name)
  if names[name] then return true end
  if not name:find(':', 1, true) then return false end
  for part in name:gmatch('[^:]+') do
    if not names[part] then return false end
  end
  return true
end

-- One parse's status (C-38): `list, extra` are modLib.parseMod's results; `names` the scan's name set.
function M.classify(list, extra, names)
  if list == nil then return { status = UNPARSED } end
  if #list == 0 then
    if extra then return { status = UNPARSED } end
    return { status = NOTHING }
  end
  if extra then return { status = PARTLY, remainder = extra } end
  local unread, seen = {}, {}
  for _, name in ipairs(modNames(list, {})) do
    if not named(names, name) and not seen[name] then
      seen[name] = true
      table.insert(unread, name)
    end
  end
  if #unread > 0 then return { status = UNREAD, unread = unread } end
  return { status = FULL }
end

local function failed(list, extra)
  return list == nil or extra ~= nil
end

-- ---------------------------------------------------------------------------------------------------
-- Items

-- The mod line lists BuildModList applies or drops (Item.lua's processModLine), in its order.
local ITEM_LINE_LISTS = { 'enchantModLines', 'runeModLines', 'implicitModLines', 'explicitModLines' }

-- An item's lines of the selected variant. A mod line holding "\n" is PoB's clean join of a failed line
-- with the next one (Item.lua:946-959), checked as one entry.
function M.checkItem(item, source, names, add)
  for _, key in ipairs(ITEM_LINE_LISTS) do
    for _, modLine in ipairs(item[key] or {}) do
      if type(modLine.line) == 'string' and Lookup.lineIsSelected(item, modLine) then
        local parts = splitLines(modLine.line)
        if #parts > 0 then
          -- Ranged as BuildModList ranges a line (getRangedModList): the line's range and catalyst scalar.
          local function ranged(text)
            return itemLib.applyRange(text, modLine.range or 1, modLine.valueScalar or 1, modLine.corruptedRange)
          end
          local first = ranged(parts[1])
          local list, extra = modLib.parseMod(first)
          local entry = M.classify(list, extra, names)
          if #parts > 1 then
            local joined = {}
            for i = 2, #parts do table.insert(joined, ranged(parts[i])) end
            local jList, jExtra = modLib.parseMod(ranged(table.concat(parts, ' ')), true)
            entry = M.classify(jList, jExtra, names)
            entry.joinedWith = joined
          end
          entry.kind = 'item'
          entry.source = source
          entry.line = first
          add(entry)
        end
      end
    end
  end
end

local function constructItem(text)
  if #text > MAX_ITEM_TEXT_LENGTH then
    fail(string.format('item text too long (max %d bytes)', MAX_ITEM_TEXT_LENGTH))
  end
  local ok, item = pcall(construct, 'Item', text)
  if not ok then fail('item text does not construct an item: ' .. tostring(item)) end
  if not item or not item.baseName then fail('item text does not construct an item: no known base type') end
  return item
end

-- ---------------------------------------------------------------------------------------------------
-- Nodes

local function specNodes()
  if not (_G.build and build.spec and build.spec.nodes) then fail('the passive tree is not loaded') end
  return build.spec.nodes
end

local function nodeSource(id, node)
  local name = trimmed(node.name)
  return 'Node ' .. tostring(id) .. (name and (' ' .. name) or '')
end

-- A node's `sd` lines (each "\n" in one splits it, as ProcessStats does). A failed line is joined with one
-- or more following lines until a join parses cleanly (PassiveTree.lua:448-466).
function M.checkNode(id, node, names, add)
  local sd = {}
  for _, stat in ipairs(node.sd or {}) do
    if type(stat) == 'string' then
      for _, part in ipairs(splitLines(stat)) do table.insert(sd, part) end
    end
  end
  local source = nodeSource(id, node)
  local i = 1
  while sd[i] do
    local line = sd[i]
    local list, extra = modLib.parseMod(line)
    local entry = M.classify(list, extra, names)
    local nextI = i + 1
    if failed(list, extra) then
      local endI = i + 1
      while sd[endI] do
        local parts = { line }
        for ci = i + 1, endI do table.insert(parts, sd[ci]) end
        local jList, jExtra = modLib.parseMod(table.concat(parts, ' '), true)
        if not failed(jList, jExtra) then
          entry = M.classify(jList, jExtra, names)
          entry.joinedWith = { unpack(parts, 2) }
          nextI = endI + 1
          break
        end
        endI = endI + 1
      end
    end
    entry.kind = 'node'
    entry.source = source
    entry.line = line
    entry.nodeId = tonumber(id)
    add(entry)
    i = nextI
  end
end

-- Node ids or exact names (case-insensitive; a name selects every node bearing it, by id), deduplicated in
-- the order given. Unknown ones fail, all named.
local function resolveNodes(list)
  local nodes = specNodes()
  local out, seen, unknown = {}, {}, {}
  local function take(id)
    if not seen[id] then
      seen[id] = true
      table.insert(out, id)
    end
  end
  for _, v in ipairs(list) do
    local text = trimmed(tostring(v))
    local id = text and text:match('^%d+$') and tonumber(text) or nil
    if id and nodes[id] then
      take(id)
    elseif text and not id then
      local wanted, ids = text:lower(), {}
      for nodeId, node in pairs(nodes) do
        if type(node.name) == 'string' and node.name:lower() == wanted then table.insert(ids, nodeId) end
      end
      table.sort(ids)
      if #ids == 0 then table.insert(unknown, text) end
      for _, nodeId in ipairs(ids) do take(nodeId) end
    else
      table.insert(unknown, tostring(v))
    end
  end
  if #unknown > 0 then
    fail((#unknown == 1 and 'unknown node: ' or 'unknown nodes: ') .. table.concat(unknown, ', ')
      .. ' (give a node id or its exact name; search_tree_nodes finds them)')
  end
  return out
end

-- ---------------------------------------------------------------------------------------------------
-- Gems

-- The active skill set's gem instances with known gem data, in socket-group order.
local function buildGemInstances()
  local out = {}
  local groups = _G.build and build.skillsTab and build.skillsTab.socketGroupList or {}
  for _, group in ipairs(groups) do
    for _, gemInstance in ipairs(group.gemList or {}) do
      local gd = gemInstance.gemData
      if type(gd) == 'table' and type(gd.name) == 'string' and gd.grantedEffect then
        table.insert(out, gemInstance)
      end
    end
  end
  return out
end

-- The level and quality a gem is checked at: its first instance in the active skill set, else
-- lookup_game_data's defaults (the natural max level, quality 0).
local function gemSettings(gem, instances)
  local wanted = gem.name:lower()
  for _, inst in ipairs(instances) do
    if inst.gemData.name:lower() == wanted then
      local level = tonumber(inst.level) or Lookup.defaultLevel(gem)
      return level, tonumber(inst.quality) or 0, true
    end
  end
  return Lookup.defaultLevel(gem), 0, false
end

-- Every described line of every stat set of every granted effect, by PoB's red-tooltip rule.
function M.checkGem(gem, level, quality, add)
  local d = gameData()
  for _, effect in ipairs(Lookup.gemEffects(gem)) do
    for i, statSet in ipairs(effect.statSets or {}) do
      local source = 'Gem ' .. gem.name .. ' / ' .. Lookup.statSetLabel(effect, statSet, i)
      local lines, map = Lookup.describeStatSet(effect, statSet, level, quality)
      for _, line in ipairs(lines) do
        local stat = map[line]
        local mapped = stat ~= nil and ((statSet.statMap and statSet.statMap[stat]) or (d.skillStatMap and d.skillStatMap[stat]))
        add({
          kind = 'gem', source = source, line = line, stat = stat,
          status = mapped and FULL or UNMODELLED,
        })
      end
    end
  end
end

local function resolveGems(list)
  local out, seen, unknown = {}, {}, {}
  for _, v in ipairs(list) do
    local name = trimmed(tostring(v))
    local gem = name and Lookup.findGem(name) or nil
    if gem then
      if not seen[gem.name] then
        seen[gem.name] = true
        table.insert(out, gem)
      end
    else
      table.insert(unknown, name or tostring(v))
    end
  end
  if #unknown > 0 then
    fail((#unknown == 1 and 'unknown gem: ' or 'unknown gems: ') .. table.concat(unknown, ', ')
      .. ' (give its exact name; lookup_game_data mode gem finds it)')
  end
  return out
end

-- ---------------------------------------------------------------------------------------------------
-- The action

local function nameSet(sourceNames)
  if type(sourceNames) ~= 'table' then
    fail('check_coverage needs sourceNames (the server\'s name scan of PoB\'s Modules/ and Classes/)')
  end
  local set = {}
  for _, name in ipairs(sourceNames) do
    if type(name) == 'string' then set[name] = true end
  end
  return set
end

local function nonEmptyList(v)
  return type(v) == 'table' and #v > 0
end

function M.check_coverage(params)
  local names = nameSet(params.sourceNames)
  local itemText = type(params.itemText) == 'string' and params.itemText or nil
  if itemText and not itemText:match('%S') then itemText = nil end
  local nodeList = nonEmptyList(params.nodes) and params.nodes or nil
  local gemList = nonEmptyList(params.gems) and params.gems or nil
  local buildMode = params.build == true
  if buildMode and (itemText or nodeList or gemList) then
    fail('build mode checks the loaded build alone; leave out itemText, nodes and gems')
  end
  if not buildMode and not (itemText or nodeList or gemList) then
    fail('nothing to check: give itemText, nodes, gems, or build')
  end

  local entries = {}
  local counts = {}
  for _, status in ipairs(M.STATUSES) do counts[status] = 0 end
  local function add(entry)
    counts[entry.status] = counts[entry.status] + 1
    table.insert(entries, entry)
  end
  local checked = { items = 0, nodes = 0, gems = 0 }
  local gemInfo = {}
  local instances = buildGemInstances()

  -- Resolve every input before checking any, so an unknown name fails the whole call.
  local item = itemText and constructItem(itemText) or nil
  local nodeIds = nodeList and resolveNodes(nodeList) or nil
  local gems = gemList and resolveGems(gemList) or nil

  if buildMode then
    local itemsTab = build.itemsTab
    if not itemsTab then fail('items not initialized') end
    for _, slot in ipairs(itemsTab.orderedSlots or {}) do
      local id = slot.selItemId or 0
      local equipped = id > 0 and not slot.nodeId and itemsTab.items[id] or nil
      if equipped then
        checked.items = checked.items + 1
        M.checkItem(equipped, 'Item ' .. slot.slotName .. ': ' .. tostring(equipped.name), names, add)
      end
    end
    nodeIds = {}
    for id in pairs(build.spec and build.spec.allocNodes or {}) do table.insert(nodeIds, id) end
    table.sort(nodeIds)
    gems = {}
    local seen = {}
    for _, inst in ipairs(instances) do
      local key = inst.gemData.name:lower()
      if not seen[key] then
        seen[key] = true
        table.insert(gems, inst.gemData)
      end
    end
  elseif item then
    checked.items = 1
    M.checkItem(item, 'Item', names, add)
  end

  if nodeIds and #nodeIds > 0 then
    local nodes = specNodes()
    for _, id in ipairs(nodeIds) do
      local node = nodes[id]
      if node then
        checked.nodes = checked.nodes + 1
        M.checkNode(id, node, names, add)
      end
    end
  end

  for _, gem in ipairs(gems or {}) do
    local level, quality, fromBuild = gemSettings(gem, instances)
    checked.gems = checked.gems + 1
    table.insert(gemInfo, { name = gem.name, level = level, quality = quality, fromBuild = fromBuild })
    M.checkGem(gem, level, quality, add)
  end

  return { counts = counts, entries = entries, gems = gemInfo, checked = checked }
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
  check_coverage = handler(M.check_coverage),
}

return M
