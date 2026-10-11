-- API/Coverage.lua
-- Whether PoB applies each line of an item, a passive node or a gem (C-38, WU-32):
--
--   check_coverage  {itemText?, nodes?, gems?, build?, sourceNames, sourceTemplates?}
--     itemText   one item, as add_item takes it: its enchant, rune, implicit and explicit lines of the
--                selected variant (the lines Item.lua's BuildModList applies or drops), rated as PoB applies
--                them: parsed at range 1 as ParseRaw does, then re-parsed at the line's range as
--                getRangedModList does (a zero-value line applies nothing; a failed ranged parse keeps the
--                range-1 parse)
--     nodes      passive node ids or exact names (a name selects every node bearing it): their `sd` lines
--     gems       gem names: every described line of every stat set, at the build's gem level and quality
--                (its first instance in the active skill set), else at lookup_game_data's defaults
--     build      true, alone: the active item set's equipped items, the jewels in the active spec's
--                allocated tree sockets (D-242), the active spec's nodes and the active skill set's gems
--     sourceNames  required: every identifier in PoB's Modules/ and Classes/ .lua files except
--                Modules/ModParser.lua (the server's name scan, D-226)
--     sourceTemplates  the same files' concatenation templates (D-243): each a `..` chain's string literals,
--                with `*` for each run of other operands, such as "*ConvertTo*" or "*CostEfficiency"
--   -> {counts, entries[], gems[], checked, flags[]}, each entry {kind, source, line, status, remainder?,
--      joinedWith?, unread?, stat?, nodeId?}, each flag {flag, source, note, line?}
--
-- Statuses (exactly one per line or joined line):
--   fully parsed       a non-empty mod list, no remainder (for a gem line: its stat has a stat map)
--   partly parsed      a non-empty mod list plus a remainder (`remainder`, verbatim from the parser); PoB
--                      applies none of such a line (Item.lua:2158, PassiveTree.lua:490)
--   unparsed           no mod list; also an empty mod list with a remainder, which PoB applies nothing from
--   parsed to nothing  an empty mod list, no remainder
--   possibly unread    fully parsed, but some mod's name (a nested `value.mod` one included) is not read
--                      by name (`unread` lists them). A name is read when it is in sourceNames; when it is
--                      a compound "Condition:X" whose ':'-separated parts are read; when it is, or ends
--                      with, a template literal of 6 or more characters starting with a capital (D-243);
--                      or when it matches a template whose `*` parts are each empty or in sourceNames
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
-- Flags (WU-54; D-300, D-336): what PoB doesn't model, reported beside the statuses and never as one, so no
-- status or count changes. A flag about a gem has source "Gem <name>"; a line's flag carries the line and
-- its entry's source.
--   mapped but unread     a gem line's stat has a stat map yielding a mod name PoB reads nowhere, by a
--                         strict reading: a scanned name exactly, a string a mod tag in the skill data names,
--                         a compound "X:Y" of read parts, or a whole template fit (no D-243 suffix rule)
--   stat not mapped       a support or meta gem's stat, non-zero, with no stat map and in no described line
--                         (removing it leaves the described lines unchanged); display_ and
--                         quality_display_ stats left out
--   energy not modelled   a gem with a granted effect of skill types Meta and GeneratesEnergy (PoB models
--                         no Energy)
--   level from support    a support gem's granted skill, which PoB computes at the support gem's level
--                         (CalcSetup.lua:1851-1876): defined, not a support, not hideFromSideBar
--   granted skill undefined  an additionalGrantedEffectId<n> with no data.skills entry (Data.lua:987-998)
--   support colour tie    an item or node line whose parse has a Condition tag on
--                         MostNumerous<Red|Green|Blue>SocketedSupports (CalcSetup.lua:2155-2162's if/elseif)
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

local MAPPED_UNREAD = 'mapped but unread'
local NOT_MAPPED = 'stat not mapped'
local ENERGY = 'energy not modelled'
local SUPPORT_LEVEL = 'level from support'
local UNDEFINED = 'granted skill undefined'
local COLOUR_TIE = 'support colour tie'

-- Every flag (WU-54).
M.FLAGS = { MAPPED_UNREAD, NOT_MAPPED, ENERGY, SUPPORT_LEVEL, UNDEFINED, COLOUR_TIE }

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

-- A template's wildcard part.
local WILD = {}

-- The scan as Lua reads it: the name set, the compiled templates, and the template literals of 6 or more
-- characters that start with a capital (the D-243 fragments a computed name may end with).
function M.reader(sourceNames, sourceTemplates)
  local names = {}
  for _, name in ipairs(sourceNames or {}) do
    if type(name) == 'string' then names[name] = true end
  end
  local templates, fragments, seen = {}, {}, {}
  for _, text in ipairs(type(sourceTemplates) == 'table' and sourceTemplates or {}) do
    if type(text) == 'string' and text:find('[^%*]') then
      local parts, i = {}, 1
      while i <= #text do
        if text:sub(i, i) == '*' then
          if parts[#parts] ~= WILD then table.insert(parts, WILD) end
          i = i + 1
        else
          local j = text:find('*', i, true) or (#text + 1)
          local literal = text:sub(i, j - 1)
          table.insert(parts, literal)
          if #literal >= 6 and literal:match('^%u') and not seen[literal] then
            seen[literal] = true
            table.insert(fragments, literal)
          end
          i = j
        end
      end
      table.insert(templates, parts)
    end
  end
  return { names = names, templates = templates, fragments = fragments }
end

-- Whether `name` from `pos` matches the template parts from `k`: a literal exactly, a wildcard by an empty
-- run or a run in the name set.
local function matchFrom(name, pos, parts, k, names)
  if k > #parts then return pos == #name + 1 end
  local part = parts[k]
  if part == WILD then
    for e = pos - 1, #name do
      local run = name:sub(pos, e)
      if (run == '' or names[run]) and matchFrom(name, e + 1, parts, k + 1, names) then return true end
    end
    return false
  end
  if name:sub(pos, pos + #part - 1) ~= part then return false end
  return matchFrom(name, pos + #part, parts, k + 1, names)
end

-- Whether `name` fits a template whole; a wildcard run is empty or in `names` (default: the scanned names).
local function matchesTemplate(reader, name, names)
  for _, parts in ipairs(reader.templates) do
    local plausible = true
    for _, part in ipairs(parts) do
      if part ~= WILD and not name:find(part, 1, true) then
        plausible = false
        break
      end
    end
    if plausible and matchFrom(name, 1, parts, 1, names or reader.names) then return true end
  end
  return false
end

-- Whether PoB reads a mod name by name (see the header): in the name set; a compound "Condition:X" whose
-- parts are read (PoB reads it as {type = "Condition", var = "X"}); or a name PoB computes by concatenation.
local function named(reader, name)
  if reader.names[name] then return true end
  if name:find(':', 1, true) then
    for part in name:gmatch('[^:]+') do
      if not named(reader, part) then return false end
    end
    return true
  end
  for _, fragment in ipairs(reader.fragments) do
    if #name >= #fragment and name:sub(-#fragment) == fragment then return true end
  end
  return matchesTemplate(reader, name)
end

-- One parse's status (C-38): `list, extra` are modLib.parseMod's results; `reader` the scan (M.reader).
function M.classify(list, extra, reader)
  if list == nil then return { status = UNPARSED } end
  if #list == 0 then
    if extra then return { status = UNPARSED } end
    return { status = NOTHING }
  end
  if extra then return { status = PARTLY, remainder = extra } end
  local unread, seen = {}, {}
  for _, name in ipairs(modNames(list, {})) do
    if not named(reader, name) and not seen[name] then
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
-- The strict reading (`mapped but unread`, D-336)

-- Every string a mod tag in the loaded skill data names (any tag field but `type`: `var`, `limitVar`,
-- `scalar`, `stat`, …), over every skill's stat maps and base mods and the global stat map. PoB reads these
-- names when it evaluates the tags (a Condition tag's `var` X reads "Condition:X"). Memoized per data table.
local tagNamesData, tagNamesSet
local function skillDataTagNames(d)
  if tagNamesData == d then return tagNamesSet end
  local names = {}
  local function fromMod(mod)
    if type(mod) ~= 'table' then return end
    for _, tag in ipairs(mod) do
      if type(tag) == 'table' then
        for k, v in pairs(tag) do
          if k ~= 'type' and type(v) == 'string' then names[v] = true end
          if type(v) == 'table' then
            for _, s in ipairs(v) do if type(s) == 'string' then names[s] = true end end
          end
        end
      end
    end
    if type(mod.value) == 'table' and type(mod.value.mod) == 'table' then fromMod(mod.value.mod) end
  end
  local function fromList(list)
    for _, mod in ipairs(type(list) == 'table' and list or {}) do fromMod(mod) end
  end
  for _, skill in pairs(d.skills or {}) do
    if type(skill) == 'table' then
      fromList(skill.baseMods)
      for _, statSet in ipairs(skill.statSets or {}) do
        for _, entry in pairs(statSet.statMap or {}) do fromList(entry) end
        fromList(statSet.baseMods)
      end
    end
  end
  for _, entry in pairs(d.skillStatMap or {}) do fromList(entry) end
  tagNamesData, tagNamesSet = d, names
  return names
end

-- The strict name set: the scanned names, then the skill data's tag names.
local function strictNames(reader, d)
  if not reader.strict then
    local tagNames = skillDataTagNames(d)
    reader.strict = setmetatable({}, { __index = function(_, k) return reader.names[k] or tagNames[k] end })
  end
  return reader.strict
end

-- Whether PoB reads a mod name, strictly: a name in the strict set, a compound "X:Y" whose parts are read,
-- or a whole template fit. Unlike `named`, a name ending with a template literal doesn't count.
local function strictlyNamed(reader, names, name)
  if names[name] then return true end
  if name:find(':', 1, true) then
    for part in name:gmatch('[^:]+') do
      if not strictlyNamed(reader, names, part) then return false end
    end
    return true
  end
  return matchesTemplate(reader, name, names)
end

-- ---------------------------------------------------------------------------------------------------
-- Line flags

-- The conditions Gem Studded's lines depend on; CalcSetup.lua:2155-2162 sets only one of them on a tie.
local TIE_CONDITIONS = {
  MostNumerousRedSocketedSupports = true,
  MostNumerousGreenSocketedSupports = true,
  MostNumerousBlueSocketedSupports = true,
}

local function hasTieCondition(list)
  for _, mod in ipairs(type(list) == 'table' and list or {}) do
    if type(mod) == 'table' then
      for _, tag in ipairs(mod) do
        if type(tag) == 'table' and tag.type == 'Condition' and TIE_CONDITIONS[tag.var] then return true end
      end
    end
  end
  return false
end

-- A `support colour tie` flag for an item or node entry whose parse is `list`.
local function tieFlag(entry, list, flag)
  if flag and hasTieCondition(list) then
    flag({
      flag = COLOUR_TIE, source = entry.source, line = entry.line,
      note = 'PoB applies this line only when its colour is the most numerous of your socketed support gems, '
        .. 'and on a tie it applies only one colour: red, then green, then blue (Modules/CalcSetup.lua:2155-2162). '
        .. 'The text gives every colour that ties.',
    })
  end
end

-- ---------------------------------------------------------------------------------------------------
-- Items

-- The mod line lists BuildModList applies or drops (Item.lua's processModLine), in its order.
local ITEM_LINE_LISTS = { 'enchantModLines', 'runeModLines', 'implicitModLines', 'explicitModLines' }

-- A "(min-max)" range in an item line (Item.lua's getRangedModList test).
local RANGE_PATTERN = '%((%-?%d+%.?%d*)%-(%-?%d+%.?%d*)%)'

-- An item line's status as PoB applies it. ParseRaw parses the line at range 1, and BuildModList drops a
-- line that kept a remainder (Item.lua:2158). getRangedModList (Item.lua:59-69) re-parses a ranged line at
-- its range: a zero-value line applies nothing, and a failed ranged parse keeps the range-1 mod list.
-- Returns the entry and the parse it rates (nil for a zero-value line).
local function itemLineStatus(modLine, text, reader)
  local scalar = modLine.valueScalar or 1
  local list, extra = modLib.parseMod(itemLib.applyRange(text, 1, scalar, modLine.corruptedRange))
  if failed(list, extra) then return M.classify(list, extra, reader), list end
  if modLine.range and text:find(RANGE_PATTERN) then
    local ranged = itemLib.applyRange(text, modLine.range, scalar, modLine.corruptedRange)
    if itemLib.isZeroValueLine(ranged) then return { status = NOTHING }, nil end
    local rList, rExtra = modLib.parseMod(ranged)
    if rList and not rExtra then return M.classify(rList, nil, reader), rList end
  end
  return M.classify(list, extra, reader), list
end

-- An item's lines of the selected variant, shown at their range. A mod line holding "\n" is PoB's clean
-- join of a failed line with the next one (Item.lua:946-959), checked as one entry. `flag` (optional)
-- receives the lines' flags.
function M.checkItem(item, source, reader, add, flag)
  for _, key in ipairs(ITEM_LINE_LISTS) do
    for _, modLine in ipairs(item[key] or {}) do
      if type(modLine.line) == 'string' and Lookup.lineIsSelected(item, modLine) then
        local parts = splitLines(modLine.line)
        if #parts > 0 then
          local function shown(text)
            return itemLib.applyRange(text, modLine.range or 1, modLine.valueScalar or 1, modLine.corruptedRange)
          end
          local first = shown(parts[1])
          local entry, list = itemLineStatus(modLine, table.concat(parts, ' '), reader)
          if #parts > 1 then
            local joined = {}
            for i = 2, #parts do table.insert(joined, shown(parts[i])) end
            entry.joinedWith = joined
          end
          entry.kind = 'item'
          entry.source = source
          entry.line = first
          add(entry)
          tieFlag(entry, list, flag)
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
-- or more following lines until a join parses cleanly (PassiveTree.lua:448-466). `flag` (optional) receives
-- the lines' flags.
function M.checkNode(id, node, reader, add, flag)
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
    local entry = M.classify(list, extra, reader)
    local rated = list
    local nextI = i + 1
    if failed(list, extra) then
      local endI = i + 1
      while sd[endI] do
        local parts = { line }
        for ci = i + 1, endI do table.insert(parts, sd[ci]) end
        local jList, jExtra = modLib.parseMod(table.concat(parts, ' '), true)
        if not failed(jList, jExtra) then
          entry = M.classify(jList, jExtra, reader)
          entry.joinedWith = { unpack(parts, 2) }
          rated = jList
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
    tieFlag(entry, rated, flag)
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

-- A stat's stat-map entry: the skill's own statMap first, then the global map (as GemTooltip.lua reads it).
local function statMapEntry(d, statSet, stat)
  if stat == nil then return nil end
  return (statSet.statMap and statSet.statMap[stat]) or (d.skillStatMap and d.skillStatMap[stat]) or nil
end

local function hasSkillType(effect, skillType)
  return skillType ~= nil and type(effect.skillTypes) == 'table' and effect.skillTypes[skillType] == true
end

local function sameLines(a, b)
  if #a ~= #b then return false end
  for i = 1, #a do
    if a[i] ~= b[i] then return false end
  end
  return true
end

local function listText(names)
  if #names <= 1 then return names[1] or '' end
  return table.concat(names, ', ', 1, #names - 1) .. ' and ' .. names[#names]
end

-- A support or meta gem: its own effect is a support, or a granted effect has skill type Meta.
local function isSupportOrMeta(gem)
  if gem.grantedEffect and gem.grantedEffect.support then return true end
  for _, effect in ipairs(Lookup.gemEffects(gem)) do
    if hasSkillType(effect, SkillType and SkillType.Meta) then return true end
  end
  return false
end

-- A display-only stat: GGG's `display_` and `quality_display_` ids change only the tooltip.
local function displayOnly(stat)
  return stat:sub(1, 8) == 'display_' or stat:sub(1, 16) == 'quality_display_'
end

-- The `stat not mapped` stats of one stat set at a level and quality, in name order: non-zero, no stat
-- map, not display-only, and in no described line (removing the stat leaves PoB's described lines as
-- they are).
local function unmappedStats(d, effect, statSet, level, quality)
  local stats = calcLib.buildSkillInstanceStats({ level = level, quality = quality or 0 }, effect, statSet)
  local candidates = {}
  for stat, value in pairs(stats) do
    if type(stat) == 'string' and type(value) == 'number' and value ~= 0 and not statMapEntry(d, statSet, stat)
        and not displayOnly(stat) then
      table.insert(candidates, stat)
    end
  end
  if #candidates == 0 then return candidates end
  table.sort(candidates)
  local full = d.describeStats(stats, statSet.statDescriptionScope) or {}
  local out = {}
  for _, stat in ipairs(candidates) do
    local without = {}
    for k, v in pairs(stats) do
      if k ~= stat then without[k] = v end
    end
    if sameLines(full, d.describeStats(without, statSet.statDescriptionScope) or {}) then table.insert(out, stat) end
  end
  return out
end

-- The gem-level flags (no line): energy, a support's granted skills, undefined granted skills.
local function gemFlags(gem, level, flag)
  local d = gameData()
  local source = 'Gem ' .. gem.name
  for _, effect in ipairs(Lookup.gemEffects(gem)) do
    if hasSkillType(effect, SkillType and SkillType.Meta) and hasSkillType(effect, SkillType and SkillType.GeneratesEnergy) then
      flag({
        flag = ENERGY, source = source,
        note = 'PoB doesn\'t model Energy, so it can\'t tell how often this gem triggers its socketed skills. '
          .. 'A config option won\'t fix that; work the rate out by hand.',
      })
      break
    end
  end
  if gem.grantedEffect and gem.grantedEffect.support then
    for _, effect in ipairs(gem.additionalGrantedEffects or {}) do
      if type(effect) == 'table' and not effect.support and not effect.hideFromSideBar then
        local skill = (type(effect.name) == 'string' and effect.name ~= '') and effect.name or tostring(effect.id)
        flag({
          flag = SUPPORT_LEVEL, source = source,
          note = string.format('PoB computes %s, the skill this support grants, at the support gem\'s level, %d '
            .. '(Modules/CalcSetup.lua:1851-1876). The game may use another level.', skill, level),
        })
      end
    end
  end
  local i = 1
  while gem['additionalGrantedEffectId' .. i] do
    local id = gem['additionalGrantedEffectId' .. i]
    if not d.skills[id] then
      flag({
        flag = UNDEFINED, source = source,
        note = string.format('This gem grants %s, which PoB has no skill data for (Modules/Data.lua:987-998), '
          .. 'so PoB never computes that skill.', tostring(id)),
      })
    end
    i = i + 1
  end
end

-- Every described line of every stat set of every granted effect, by PoB's red-tooltip rule. `flag`
-- (optional) receives the gem's flags; `reader` (the scan) is needed for them.
function M.checkGem(gem, level, quality, add, flag, reader)
  local d = gameData()
  local strict = flag and reader and strictNames(reader, d) or nil
  local supportOrMeta = flag and isSupportOrMeta(gem)
  if flag then gemFlags(gem, level, flag) end
  local unmapped, unmappedSeen = {}, {}
  for _, effect in ipairs(Lookup.gemEffects(gem)) do
    for i, statSet in ipairs(effect.statSets or {}) do
      local source = 'Gem ' .. gem.name .. ' / ' .. Lookup.statSetLabel(effect, statSet, i)
      local lines, map = Lookup.describeStatSet(effect, statSet, level, quality)
      for _, line in ipairs(lines) do
        local stat = map[line]
        local entry = statMapEntry(d, statSet, stat)
        add({
          kind = 'gem', source = source, line = line, stat = stat,
          status = entry and FULL or UNMODELLED,
        })
        if entry and strict then
          local unread, seen = {}, {}
          for _, name in ipairs(modNames(entry, {})) do
            if not seen[name] and not strictlyNamed(reader, strict, name) then
              seen[name] = true
              table.insert(unread, name)
            end
          end
          if #unread > 0 then
            flag({
              flag = MAPPED_UNREAD, source = source, line = line,
              note = string.format('PoB maps %s to %s, but reads %s nowhere, so the line may change nothing.',
                stat, listText(unread), #unread == 1 and 'it' or 'them'),
            })
          end
        end
      end
      if supportOrMeta then
        for _, stat in ipairs(unmappedStats(d, effect, statSet, level, quality)) do
          if not unmappedSeen[stat] then
            unmappedSeen[stat] = true
            table.insert(unmapped, stat)
          end
        end
      end
    end
  end
  for _, stat in ipairs(unmapped) do
    flag({
      flag = NOT_MAPPED, source = 'Gem ' .. gem.name,
      note = string.format('PoB has no stat map for %s; what it drives may not be modelled.', stat),
    })
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

local function scanReader(params)
  if type(params.sourceNames) ~= 'table' then
    fail('check_coverage needs sourceNames (the server\'s name scan of PoB\'s Modules/ and Classes/)')
  end
  return M.reader(params.sourceNames, params.sourceTemplates)
end

local function nonEmptyList(v)
  return type(v) == 'table' and #v > 0
end

function M.check_coverage(params)
  local reader = scanReader(params)
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
  local flags = {}
  local function flag(f) table.insert(flags, f) end
  local instances = buildGemInstances()

  -- Resolve every input before checking any, so an unknown name fails the whole call.
  local item = itemText and constructItem(itemText) or nil
  local nodeIds = nodeList and resolveNodes(nodeList) or nil
  local gems = gemList and resolveGems(gemList) or nil

  if buildMode then
    local itemsTab = build.itemsTab
    if not itemsTab then fail('items not initialized') end
    local alloc = build.spec and build.spec.allocNodes or {}
    for _, slot in ipairs(itemsTab.orderedSlots or {}) do
      local id = slot.selItemId or 0
      local equipped = id > 0 and itemsTab.items[id] or nil
      if equipped and not slot.nodeId then
        checked.items = checked.items + 1
        M.checkItem(equipped, 'Item ' .. slot.slotName .. ': ' .. tostring(equipped.name), reader, add, flag)
      elseif equipped and alloc[slot.nodeId] and (type(itemsTab.IsItemValidForSlot) ~= 'function'
          or itemsTab:IsItemValidForSlot(equipped, slot.slotName)) then
        -- D-242: a jewel in an allocated tree socket applies, as CalcSetup.lua:933-936 applies it.
        checked.items = checked.items + 1
        M.checkItem(equipped, 'Jewel socket ' .. tostring(slot.nodeId) .. ': ' .. tostring(equipped.name), reader, add, flag)
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
    M.checkItem(item, 'Item', reader, add, flag)
  end

  if nodeIds and #nodeIds > 0 then
    local nodes = specNodes()
    for _, id in ipairs(nodeIds) do
      local node = nodes[id]
      if node then
        checked.nodes = checked.nodes + 1
        M.checkNode(id, node, reader, add, flag)
      end
    end
  end

  for _, gem in ipairs(gems or {}) do
    local level, quality, fromBuild = gemSettings(gem, instances)
    checked.gems = checked.gems + 1
    table.insert(gemInfo, { name = gem.name, level = level, quality = quality, fromBuild = fromBuild })
    M.checkGem(gem, level, quality, add, flag, reader)
  end

  return { counts = counts, entries = entries, gems = gemInfo, checked = checked, flags = flags }
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
