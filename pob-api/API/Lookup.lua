-- API/Lookup.lua
-- PoB2's loaded game data, read without touching the build (C-37, WU-31):
--
--   lookup_game_data  {mode, query?, level?, quality?, slot?, maxResults?}
--     gem       data.gems names -> description, weapon, stat-set lines from PoB's stat describer
--               (at `level`, default the gem's natural max level; see defaultLevel),
--               the +20% quality lines, support rules, and the requirements at every gem level
--     unique    main.uniqueDB names, mod lines or type -> BuildRaw() text, ready for add_item
--     mechanic  gem descriptions and stat-set lines, unique mod lines, passive `sd` lines and
--               data.itemMods text -> one hit per matching line
--
-- Registered by one line in Handlers.lua. Results are sorted, then cut to maxResults (default 20; the
-- server caps it): exact name matches first, then by name, then by id; mechanic hits by kind (gem,
-- unique, passive, mod), then by name, then by id, then by line. `total` counts every match.
--
-- The gem helpers (findGem, gemEffects, defaultLevel, describeStatSet) are shared with other modules.
--
-- Rules: a lookup reads data only. Nothing here changes the build, writes a file or makes a request.

local M = {}

local DEFAULT_MAX_RESULTS = 20

local Failure = {}
local function fail(msg)
  error(setmetatable({ msg = msg }, Failure), 0)
end

-- PoB's game data: the build's copy when there is one, else the global.
local function gameData()
  local d = (_G.build and build.data) or _G.data
  if not d or not d.gems then fail('game data not available') end
  return d
end

-- The describer can wrap a line with "\n"; a hit or a listed line is one line of text.
local function oneLine(s)
  return (tostring(s):gsub('%s*\n%s*', ' '))
end

local function contains(text, needle)
  return type(text) == 'string' and text:lower():find(needle, 1, true) ~= nil
end

local function sortedKeys(t)
  local keys = {}
  for k in pairs(t or {}) do table.insert(keys, k) end
  table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
  return keys
end

-- Sort entries by: exact name match (when `exact` is given), then name, then id.
local function sortByName(list, exact)
  table.sort(list, function(a, b)
    if exact then
      local ea, eb = a.name:lower() == exact, b.name:lower() == exact
      if ea ~= eb then return ea end
    end
    if a.name ~= b.name then return a.name < b.name end
    return a.id < b.id
  end)
end

local function cut(list, maxResults)
  local out = {}
  for i = 1, math.min(#list, maxResults) do out[i] = list[i] end
  return out
end

-- ---------------------------------------------------------------------------------------------------
-- Gem helpers

local function isSupportGem(gem)
  return gem.gemType == 'Support' or (type(gem.tags) == 'table' and gem.tags.support == true)
end

-- The gem whose name equals `name` (case-insensitive), the lowest id first; nil if there is none.
function M.findGem(name)
  local d = gameData()
  local wanted = tostring(name or ''):lower()
  local best
  for id, gem in pairs(d.gems) do
    if type(gem) == 'table' and type(gem.name) == 'string' and gem.name:lower() == wanted and gem.grantedEffect then
      if not best or id < best.id then best = { id = id, gem = gem } end
    end
  end
  return best and best.gem or nil, best and best.id or nil
end

-- The gem's granted effects in PoB's tooltip order: its own, then its additional ones.
function M.gemEffects(gem)
  local effects = {}
  if gem.grantedEffect then table.insert(effects, gem.grantedEffect) end
  for _, effect in ipairs(gem.additionalGrantedEffects or {}) do table.insert(effects, effect) end
  return effects
end

-- One stat set's tooltip lines at a gem level and quality, as PoB's gem tooltip builds them:
-- data.describeStats(calcLib.buildSkillInstanceStats({level, quality}, grantedEffect, statSet), scope).
-- Returns the lines (each made one line) and the describer's line -> stat map, keyed by those lines.
function M.describeStatSet(grantedEffect, statSet, level, quality)
  local d = gameData()
  local stats = calcLib.buildSkillInstanceStats({ level = level, quality = quality or 0 }, grantedEffect, statSet)
  local lines, lineMap = d.describeStats(stats, statSet.statDescriptionScope)
  local out, map = {}, {}
  for _, line in ipairs(lines or {}) do
    local flat = oneLine(line)
    table.insert(out, flat)
    map[flat] = lineMap and lineMap[line] or nil
  end
  return out, map
end

-- The "At +20% Quality" lines of one granted effect (SkillsTab's tooltip: each qualityStats entry
-- described alone at value x 20, in its stat set's scope).
local function qualityLines(grantedEffect)
  local d = gameData()
  local out = {}
  if type(grantedEffect.statSets) ~= 'table' then return out end
  for _, q in ipairs(grantedEffect.qualityStats or {}) do
    if q[1] and q[2] then
      local setIndexes = type(q[3]) == 'table' and q[3] or {}
      local statSet = grantedEffect.statSets[(setIndexes[1] or 0) + 1] or grantedEffect.statSets[1]
      if statSet then
        local lines = d.describeStats({ [q[1]] = q[2] * 20 }, statSet.statDescriptionScope, true)
        for _, line in ipairs(lines or {}) do
          if line then table.insert(out, oneLine(line)) end
        end
      end
    end
  end
  return out
end

local function skillTypeNames(list)
  local out = {}
  for _, t in ipairs(list or {}) do
    table.insert(out, SkillTypeName and SkillTypeName[t] or tostring(t))
  end
  return out
end

local function statSetLabel(grantedEffect, statSet, index)
  if type(statSet.label) == 'string' and statSet.label ~= '' then return statSet.label end
  return (grantedEffect.name ~= '' and grantedEffect.name) or ('Stat set ' .. index)
end

-- Requirements at gem levels 1..naturalMaxLevel (GemTooltip: the level's levelRequirement, and
-- calcLib.getGemStatRequirement per attribute). Attribute lists only for non-zero weights.
local function gemRequirements(gem)
  local ge = gem.grantedEffect
  local maxLevel = tonumber(gem.naturalMaxLevel) or 1
  local req = { maxLevel = maxLevel, levels = {} }
  local attrs = {
    { key = 'str', weight = tonumber(gem.reqStr) or 0 },
    { key = 'dex', weight = tonumber(gem.reqDex) or 0 },
    { key = 'int', weight = tonumber(gem.reqInt) or 0 },
  }
  for _, a in ipairs(attrs) do
    if a.weight ~= 0 and not ge.support then req[a.key] = {} end
  end
  for l = 1, maxLevel do
    local level = ge.levels[l]
    local levelReq = level and level.levelRequirement or 1
    req.levels[l] = levelReq
    for _, a in ipairs(attrs) do
      if req[a.key] then
        req[a.key][l] = calcLib.getGemStatRequirement(levelReq, a.weight, ge.support)
      end
    end
  end
  return req
end

local function weaponText(gem)
  if type(gem.weaponRequirements) == 'string' and gem.weaponRequirements ~= '' then
    return gem.weaponRequirements
  end
  local ge = gem.grantedEffect
  if ge and type(ge.weaponTypes) == 'table' then
    local names = sortedKeys(ge.weaponTypes)
    if #names > 0 then return table.concat(names, ', ') end
  end
  return nil
end

local function effectBlock(grantedEffect, level, quality)
  local sets = {}
  for i, statSet in ipairs(grantedEffect.statSets or {}) do
    local lines = M.describeStatSet(grantedEffect, statSet, level, quality)
    table.insert(sets, { index = i, label = statSetLabel(grantedEffect, statSet, i), lines = lines })
  end
  return sets
end

local function sortedLevels(ge)
  local levels = {}
  for l in pairs(ge.levels or {}) do
    if type(l) == 'number' then table.insert(levels, l) end
  end
  table.sort(levels)
  return levels
end

-- The gem level a lookup shows by default: the gem's natural max level, or, when its level table lacks
-- that level (a few gems only have one level, such as 8), the highest level up to it, else the lowest.
function M.defaultLevel(gem)
  local natural = tonumber(gem.naturalMaxLevel) or 1
  local ge = gem.grantedEffect
  if ge.levels[natural] then return natural end
  local levels = sortedLevels(ge)
  local best = levels[1] or natural
  for _, l in ipairs(levels) do
    if l <= natural then best = l end
  end
  return best
end

local function gemResult(id, gem, levelParam, quality)
  local ge = gem.grantedEffect
  local level = levelParam or M.defaultLevel(gem)
  if not ge.levels[level] then
    local levels = sortedLevels(ge)
    fail(string.format('gem_level %s is outside %s\'s levels (%d-%d)', tostring(level), gem.name,
      levels[1] or 1, levels[#levels] or 1))
  end
  local support = ge.support == true
  local result = {
    kind = 'gem',
    id = id,
    name = gem.name,
    gemKind = isSupportGem(gem) and 'support' or 'active',
    gemType = gem.gemType,
    tags = gem.tagString,
    description = ge.description and oneLine(ge.description) or nil,
    weapon = weaponText(gem),
    level = level,
    quality = quality,
    statSets = effectBlock(ge, level, quality),
    additional = {},
    qualityLines = qualityLines(ge),
    requirements = gemRequirements(gem),
  }
  for i, effect in ipairs(gem.additionalGrantedEffects or {}) do
    if effect and effect.statSets then
      table.insert(result.additional, {
        name = (effect.name and effect.name ~= '') and effect.name or ('Granted effect ' .. (i + 1)),
        support = effect.support == true,
        statSets = effectBlock(effect, level, quality),
      })
      for _, line in ipairs(qualityLines(effect)) do table.insert(result.qualityLines, line) end
    end
  end
  if support then
    result.supports = skillTypeNames(ge.requireSkillTypes)
    result.cannotSupport = skillTypeNames(ge.excludeSkillTypes)
  end
  return result
end

local function lookupGems(query, level, quality, maxResults)
  local d = gameData()
  local matches = {}
  for id, gem in pairs(d.gems) do
    if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect and contains(gem.name, query) then
      table.insert(matches, { id = id, name = gem.name, gem = gem })
    end
  end
  sortByName(matches, query)
  local results = {}
  for i, m in ipairs(cut(matches, maxResults)) do
    results[i] = gemResult(m.id, m.gem, level, quality)
  end
  return results, #matches
end

-- ---------------------------------------------------------------------------------------------------
-- Uniques

local function uniqueList()
  local db = _G.main and main.uniqueDB
  if not db or type(db.list) ~= 'table' then fail('unique data not available') end
  return db.list
end

-- The unique item types PoB knows, sorted.
function M.uniqueTypes()
  local seen, out = {}, {}
  for _, item in pairs(uniqueList()) do
    if item.type and not seen[item.type] then
      seen[item.type] = true
      table.insert(out, item.type)
    end
  end
  table.sort(out)
  return out
end

local MOD_LINE_LISTS = {
  'enchantModLines', 'runeModLines', 'implicitModLines', 'explicitModLines', 'classRequirementModLines',
}

-- The item's mod lines for its current variant, made one line each.
local function uniqueModLines(item)
  local out = {}
  for _, key in ipairs(MOD_LINE_LISTS) do
    for _, modLine in ipairs(item[key] or {}) do
      if type(modLine.line) == 'string'
        and (not modLine.variantList or not item.variant or modLine.variantList[item.variant]) then
        table.insert(out, oneLine(modLine.line))
      end
    end
  end
  return out
end

local function resolveSlot(slot)
  if slot == nil then return nil end
  local types = M.uniqueTypes()
  local wanted = tostring(slot):lower()
  for _, t in ipairs(types) do
    if t:lower() == wanted then return t end
  end
  fail('unknown slot "' .. tostring(slot) .. '"; valid item types: ' .. table.concat(types, ', '))
end

local function lookupUniques(query, slot, maxResults)
  local itemType = resolveSlot(slot)
  local matches = {}
  for key, item in pairs(uniqueList()) do
    if (not itemType or item.type == itemType) then
      local name = item.title or item.name or key
      local hit = query == nil or contains(name, query)
      if not hit then
        for _, line in ipairs(uniqueModLines(item)) do
          if contains(line, query) then hit = true break end
        end
      end
      if hit then table.insert(matches, { id = key, name = name, item = item }) end
    end
  end
  sortByName(matches, query)
  local results = {}
  for i, m in ipairs(cut(matches, maxResults)) do
    results[i] = { kind = 'unique', id = m.id, name = m.name, type = m.item.type, raw = m.item:BuildRaw() }
  end
  return results, #matches
end

-- ---------------------------------------------------------------------------------------------------
-- Mechanics

local KIND_RANK = { gem = 1, unique = 2, passive = 3, mod = 4 }

local function treeNodes()
  if _G.build and build.spec and build.spec.tree and build.spec.tree.nodes then return build.spec.tree.nodes end
  if _G.main and main.tree and _G.latestTreeVersion and main.tree[latestTreeVersion] then
    return main.tree[latestTreeVersion].nodes
  end
  return {}
end

-- A mod table entry's text lines (its array part); a rune entry nests one mod per item class.
local function collectModHits(hits, tableName, entryId, entry, query)
  if type(entry) ~= 'table' then return end
  if type(entry[1]) == 'string' then
    local n = 0
    for _, line in ipairs(entry) do
      if type(line) == 'string' then
        n = n + 1
        local flat = oneLine(line)
        if contains(flat, query) then
          table.insert(hits, {
            kind = 'mod', id = tableName .. '/' .. entryId, name = entryId, order = n,
            source = entryId .. ' (' .. tableName .. ' mods)', line = flat, table = tableName,
          })
        end
      end
    end
    return
  end
  for _, sub in ipairs(sortedKeys(entry)) do
    if type(entry[sub]) == 'table' and type(entry[sub][1]) == 'string' then
      collectModHits(hits, tableName, entryId .. ' (' .. tostring(sub) .. ')', entry[sub], query)
    end
  end
end

local function lookupMechanics(query, maxResults)
  local d = gameData()
  local hits = {}

  -- Gems: the description, then every stat set's lines at the gem's default level, quality 0.
  for id, gem in pairs(d.gems) do
    if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect then
      local n = 0
      local function add(source, line)
        n = n + 1
        if contains(line, query) then
          table.insert(hits, { kind = 'gem', id = id, name = gem.name, order = n, source = source, line = line })
        end
      end
      local ge = gem.grantedEffect
      if ge.description then add(gem.name, oneLine(ge.description)) end
      local level = M.defaultLevel(gem)
      for _, effect in ipairs(M.gemEffects(gem)) do
        for i, statSet in ipairs(effect.statSets or {}) do
          local label = statSetLabel(effect, statSet, i)
          local lines = M.describeStatSet(effect, statSet, level, 0)
          for _, line in ipairs(lines) do add(gem.name .. ' (' .. label .. ')', line) end
        end
      end
    end
  end

  -- Uniques: their current-variant mod lines.
  for key, item in pairs(uniqueList()) do
    local name = item.title or item.name or key
    for n, line in ipairs(uniqueModLines(item)) do
      if contains(line, query) then
        table.insert(hits, {
          kind = 'unique', id = key, name = name, order = n,
          source = name .. ' (' .. tostring(item.type) .. ')', line = line,
        })
      end
    end
  end

  -- Passives: every node's `sd` lines, ascendancy nodes included.
  for id, node in pairs(treeNodes()) do
    if type(node) == 'table' and type(node.sd) == 'table' then
      for n, stat in ipairs(node.sd) do
        if type(stat) == 'string' then
          local line = oneLine(stat)
          if contains(line, query) then
            local name = node.name or ('Node ' .. tostring(id))
            local where = node.ascendancyName and (node.ascendancyName .. ', node ' .. tostring(id)) or ('node ' .. tostring(id))
            table.insert(hits, {
              kind = 'passive', id = string.format('%010d', tonumber(id) or 0), name = name, order = n,
              source = name .. ' (' .. where .. ')', line = line,
              nodeId = tonumber(id), ascendancy = node.ascendancyName,
            })
          end
        end
      end
    end
  end

  -- Mods: the text of every data.itemMods table, named by its table.
  for _, tableName in ipairs(sortedKeys(d.itemMods or {})) do
    local mods = d.itemMods[tableName]
    if type(mods) == 'table' then
      for _, entryId in ipairs(sortedKeys(mods)) do
        collectModHits(hits, tableName, tostring(entryId), mods[entryId], query)
      end
    end
  end

  table.sort(hits, function(a, b)
    if a.kind ~= b.kind then return KIND_RANK[a.kind] < KIND_RANK[b.kind] end
    if a.name ~= b.name then return a.name < b.name end
    if a.id ~= b.id then return a.id < b.id end
    return a.order < b.order
  end)
  local results = cut(hits, maxResults)
  for _, hit in ipairs(results) do
    hit.order = nil
    if hit.kind == 'passive' then hit.id = tostring(hit.nodeId) end
  end
  return results, #hits
end

-- ---------------------------------------------------------------------------------------------------
-- The action

local MODES = { gem = true, unique = true, mechanic = true }

local function trimmed(v)
  if type(v) ~= 'string' then return nil end
  local s = v:match('^%s*(.-)%s*$')
  return s ~= '' and s or nil
end

function M.lookup_game_data(params)
  local mode = params.mode
  if type(mode) ~= 'string' or not MODES[mode] then
    fail('unknown mode "' .. tostring(mode) .. '"; use gem, unique or mechanic')
  end
  local query = trimmed(params.query)
  local needle = query and query:lower() or nil
  local maxResults = math.floor(tonumber(params.maxResults) or DEFAULT_MAX_RESULTS)
  if maxResults < 1 then maxResults = 1 end

  local results, total
  if mode == 'gem' then
    if not needle then fail('gem mode needs a query') end
    local level = params.level ~= nil and math.floor(tonumber(params.level) or -1) or nil
    local quality = math.floor(tonumber(params.quality) or 0)
    if quality < 0 or quality > 20 then fail('gem_quality must be 0-20') end
    results, total = lookupGems(needle, level, quality, maxResults)
  elseif mode == 'unique' then
    local slot = trimmed(params.slot)
    if not needle and not slot then fail('unique mode needs a query, a slot or both') end
    results, total = lookupUniques(needle, slot, maxResults)
  else
    if not needle then fail('mechanic mode needs a query') end
    results, total = lookupMechanics(needle, maxResults)
  end
  return { mode = mode, total = total, results = results }
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
  lookup_game_data = handler(M.lookup_game_data),
}

return M
