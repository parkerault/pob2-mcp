-- API/Lookup.lua
-- PoB2's loaded game data, read without touching the build (C-37, WU-31):
--
--   lookup_game_data  {mode, query?, level?, quality?, slot?, kind?, maxResults?}
--     gem       data.gems names -> PoB's Tier (D-258), description, weapon, per stat set its base attack
--               damage and crit chance and its lines from PoB's stat describer (at `level`, default the
--               gem's natural max level; see defaultLevel; a returned gem without `level` is shown at its
--               default), the +20% quality lines, support rules, and the requirements at every gem level
--     unique    main.uniqueDB names, mod lines (every variant's, legacy "Pre x.y" variants skipped) or
--               type -> name, base, type and the matched lines; BuildRaw() text, ready for add_item,
--               only when exactly one unique is returned (D-239)
--     mechanic  gem descriptions and stat-set lines, unique mod lines (every variant's), passive `sd`
--               lines, data.itemMods text and the essences' mod lines (or names) -> one hit per matching
--               line; a mod hit carries the base types that can roll it (WU-60, D-277); `kind` keeps one
--               kind, and `kinds` counts every kind's hits (D-240)
--
-- Registered by one line in Handlers.lua. Results are sorted, then cut to maxResults (default 20; the
-- server caps it): exact name matches first, then by name, then by id; mechanic hits by kind (gem,
-- unique, passive, mod, essence), then by name, then by id, then by line. `total` counts every match.
--
-- When a query matches nothing, `suggestions` lists the closest names of the kind searched (D-258): in gem
-- mode up to 5 active gems, then up to 3 supports (D-258a); in unique mode up to 5 unique names, of `slot`
-- when given; in mechanic mode up to 5 names of the gems, uniques, passives, mods and essences searched, of
-- `kind` when given. Each group is ranked by edit distance to the query (see editDistance), then by name,
-- then by kind and detail. A query longer than MAX_SUGGESTION_QUERY characters gets none (the cost grows
-- with its length); the reply says so with `suggestionsSkipped`.
--
-- The gem helpers (findGem, gemEffects, defaultLevel, describeStatSet, statSetLabel) and lineIsSelected (a
-- unique's or item's selected-variant test) are shared with other modules (API/Coverage.lua, WU-32).
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
M.statSetLabel = statSetLabel

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

-- A stat set's level data as PoB's calculation reads it: the granted effect's level, overlaid by the
-- stat set's own level (CalcActiveSkill.lua's grantedEffectLevel).
function M.statSetLevel(grantedEffect, statSet, level)
  local merged = {}
  for k, v in pairs(grantedEffect.levels[level] or {}) do merged[k] = v end
  for k, v in pairs(statSet.levels and statSet.levels[level] or {}) do merged[k] = v end
  return merged
end

-- The stat set's base attack damage and critical hit chance, in the gem tooltip's formats
-- (GemTooltip.lua: "Attack Damage: %g%% of base" and "Critical Hit Chance: %.2f%%").
local function baseLines(levelData)
  local out = {}
  if tonumber(levelData.baseMultiplier) then
    table.insert(out, string.format('Attack Damage: %g%% of base', levelData.baseMultiplier * 100))
  end
  if tonumber(levelData.critChance) then
    table.insert(out, string.format('Critical Hit Chance: %.2f%%', levelData.critChance))
  end
  return out
end

local function effectBlock(grantedEffect, level, quality)
  local sets = {}
  for i, statSet in ipairs(grantedEffect.statSets or {}) do
    local lines = M.describeStatSet(grantedEffect, statSet, level, quality)
    local levelData = M.statSetLevel(grantedEffect, statSet, level)
    table.insert(sets, {
      index = i,
      label = statSetLabel(grantedEffect, statSet, i),
      lines = lines,
      baseMultiplier = tonumber(levelData.baseMultiplier),
      critChance = tonumber(levelData.critChance),
      baseLines = baseLines(levelData),
    })
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

local function levelSpan(ge)
  local levels = sortedLevels(ge)
  return levels[1] or 1, levels[#levels] or 1
end

-- A requested gem level the gem lacks shows the gem at its default level, with a note saying so.
local function gemResult(id, gem, levelParam, quality)
  local ge = gem.grantedEffect
  local level = levelParam or M.defaultLevel(gem)
  local levelNote
  if not ge.levels[level] then
    local lo, hi = levelSpan(ge)
    level = M.defaultLevel(gem)
    levelNote = string.format('gem_level %s is outside this gem\'s levels (%d-%d), so it is shown at gem level %d',
      tostring(levelParam), lo, hi, level)
  end
  local support = ge.support == true
  local result = {
    kind = 'gem',
    id = id,
    name = gem.name,
    gemKind = isSupportGem(gem) and 'support' or 'active',
    -- PoB's own `Tier` (Data/Gems.lua; D-258).
    tier = tonumber(gem.Tier),
    gemType = gem.gemType,
    tags = gem.tagString,
    description = ge.description and oneLine(ge.description) or nil,
    weapon = weaponText(gem),
    level = level,
    levelNote = levelNote,
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
  local shown = cut(matches, maxResults)
  -- A gem_level is an error only when no returned gem has it (C-37).
  if level and #shown > 0 then
    local anyHas = false
    for _, m in ipairs(shown) do
      if m.gem.grantedEffect.levels[level] then anyHas = true break end
    end
    if not anyHas then
      local lo, hi = levelSpan(shown[1].gem.grantedEffect)
      fail(string.format('gem_level %s is outside the levels of every matched gem (%s: %d-%d)', tostring(level),
        shown[1].gem.name, lo, hi))
    end
  end
  local results = {}
  for i, m in ipairs(shown) do
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

-- A legacy variant: one named for the patch it predates ("Pre 0.4.0", "Fire (Pre 0.2.1 )").
local function isLegacyVariant(name)
  return type(name) == 'string' and (name:find('^Pre %d') ~= nil or name:find('%(Pre %d') ~= nil)
end

-- Whether the item's selected variants have the line (PoB's ItemClass:CheckModLineVariant).
local function lineIsSelected(item, modLine)
  if not modLine.variantList then return true end
  if type(item.CheckModLineVariant) == 'function' then return item:CheckModLineVariant(modLine) and true or false end
  return modLine.variantList[item.variant] ~= nil
end
M.lineIsSelected = lineIsSelected

-- The item's mod lines across every variant, made one line each. `variants` is absent for a line the
-- selected variant(s) have; otherwise it lists the non-legacy variants that have it ({index, name}).
-- A line only legacy variants have is skipped.
local function uniqueModLines(item)
  local out = {}
  for _, key in ipairs(MOD_LINE_LISTS) do
    for _, modLine in ipairs(item[key] or {}) do
      if type(modLine.line) == 'string' then
        local entry = { line = oneLine(modLine.line) }
        if not lineIsSelected(item, modLine) then
          local variants = {}
          for index in pairs(modLine.variantList) do
            local name = type(item.variantList) == 'table' and item.variantList[index] or nil
            if not isLegacyVariant(name) then table.insert(variants, { index = index, name = name }) end
          end
          table.sort(variants, function(a, b) return a.index < b.index end)
          entry.variants = variants
        end
        if not entry.variants or #entry.variants > 0 then table.insert(out, entry) end
      end
    end
  end
  return out
end

-- "variant Blood Hunt" / "variants A, B, C and 4 more", for a hit's source.
local function variantNote(variants)
  local names = {}
  for i, v in ipairs(variants) do
    if i > 3 then break end
    table.insert(names, v.name or ('#' .. v.index))
  end
  local note = (#variants == 1 and 'variant ' or 'variants ') .. table.concat(names, ', ')
  if #variants > 3 then note = note .. ' and ' .. (#variants - 3) .. ' more' end
  return note
end

local MAX_MATCHED_LINES = 5

local function resolveSlot(slot)
  if slot == nil then return nil end
  local types = M.uniqueTypes()
  local wanted = tostring(slot):lower()
  for _, t in ipairs(types) do
    if t:lower() == wanted then return t end
  end
  fail('unknown slot "' .. tostring(slot) .. '"; valid item types: ' .. table.concat(types, ', '))
end

-- Uniques by name, mod line (any variant) or type. Each result names its base, type and the matched
-- lines (at most MAX_MATCHED_LINES, `matchedCount` counts them all); the BuildRaw() text comes only
-- when exactly one unique is returned (D-239), with the selected variant.
local function lookupUniques(query, slot, maxResults)
  local itemType = resolveSlot(slot)
  local matches = {}
  for key, item in pairs(uniqueList()) do
    if (not itemType or item.type == itemType) then
      local name = item.title or item.name or key
      local byName = query ~= nil and contains(name, query)
      local lines = {}
      if query then
        for _, entry in ipairs(uniqueModLines(item)) do
          if contains(entry.line, query) then table.insert(lines, entry) end
        end
      end
      if query == nil or byName or #lines > 0 then
        table.insert(matches, { id = key, name = name, item = item, byName = byName, lines = lines })
      end
    end
  end
  sortByName(matches, query)
  local shown = cut(matches, maxResults)
  local results = {}
  for i, m in ipairs(shown) do
    local matched = {}
    for n, entry in ipairs(m.lines) do
      if n > MAX_MATCHED_LINES then break end
      table.insert(matched, entry)
    end
    local result = {
      kind = 'unique', id = m.id, name = m.name, type = m.item.type, baseName = m.item.baseName,
      byName = m.byName, matchedLines = matched, matchedCount = #m.lines,
    }
    if #shown == 1 then
      result.raw = m.item:BuildRaw()
      if type(m.item.variantList) == 'table' and m.item.variant then
        result.selectedVariant = { index = m.item.variant, name = m.item.variantList[m.item.variant] }
      end
    end
    results[i] = result
  end
  return results, #matches
end

-- ---------------------------------------------------------------------------------------------------
-- Mod base types and essences (WU-60, D-277)
--
-- A mechanic mod hit lists the base types that can roll its mod, and the essences (data.essences) are
-- searched as a fifth hit kind, `essence`, so D1 can source an affix's limit on its base (amendment 2).
--
-- Base types are PoB's own base lists (data.itemBaseLists: the item creator's "<type>: <subType>"
-- groups, hidden bases left out). A base can roll a mod when PoB's ItemClass:GetModSpawnWeight gives it
-- a non-zero weight (Classes/Item.lua:1377: the weight of the first of the mod's weightKey tags the base
-- has, times its weightMultiplier). A mod of an item affix table (Item, Flask, Charm or Jewel) counts only
-- on the bases whose items take their affixes from that table (Item.lua:840-842), as PoB's crafting lists
-- do (ItemsTab.lua:3049); a mod of any other table (Desecrated, Corruption, Exclusive, ...) is weighed on
-- every base, as PoB weighs its desecrated and corrupted lists (ItemsTab.lua:2718, :3146). A mod without
-- `weightKey` (a rune's) has no base types.

local baseIndexCache = setmetatable({}, { __mode = 'k' })
local baseTypesCache = setmetatable({}, { __mode = 'k' })

-- PoB's spawn weight of `mod` on `base` (ItemClass:GetModSpawnWeight reads only the item's base).
local function spawnWeight(base, mod)
  local Item = common.classes.Item
  if not Item then
    LoadModule('Classes/Item')
    Item = common.classes.Item
  end
  return Item.GetModSpawnWeight({ base = base }, mod)
end

-- The affix table an item of `base` takes its affixes from (Item.lua:840-842).
local function affixTableOf(d, base)
  return (base.subType and d.itemMods[base.type .. base.subType]) or d.itemMods[base.type] or d.itemMods.Item
end

-- PoB's base lists, grouped by item type (sorted), each with its bases; and the set of affix tables.
local function baseIndex(d)
  if baseIndexCache[d] then return baseIndexCache[d] end
  local types, byType, affixTables = {}, {}, {}
  for _, listName in ipairs(sortedKeys(d.itemBaseLists)) do
    for _, entry in ipairs(d.itemBaseLists[listName]) do
      local base = entry.base
      local itemType = byType[base.type]
      if not itemType then
        itemType = { name = base.type, lists = {}, byName = {} }
        byType[base.type] = itemType
        table.insert(types, itemType)
      end
      local list = itemType.byName[listName]
      if not list then
        list = { name = listName, bases = {} }
        itemType.byName[listName] = list
        table.insert(itemType.lists, list)
      end
      local affixes = affixTableOf(d, base)
      affixTables[affixes] = true
      table.insert(list.bases, { name = entry.name, base = base, affixes = affixes })
    end
  end
  table.sort(types, function(a, b) return a.name < b.name end)
  local index = { types = types, affixTables = affixTables }
  baseIndexCache[d] = index
  return index
end

-- The base types that can roll `mod`, an entry of the mod table `modTable`, by item type, then by base
-- list name. An item type all of whose bases can roll it is one entry `{name = <item type>, itemType =
-- true, count, total}` when it has more than one base list; otherwise each base list with a base that
-- can is `{name = <list name>, count, total}`, with `names` (those bases, sorted) when not all of them
-- can. `count` and `total` count bases. Empty when no base can; nil for a mod without spawn weights.
function M.modBaseTypes(mod, modTable)
  if type(mod) ~= 'table' or type(mod.weightKey) ~= 'table' then return nil end
  if baseTypesCache[mod] then return baseTypesCache[mod] end
  local index = baseIndex(gameData())
  local only = modTable and index.affixTables[modTable] and modTable or nil
  local out = {}
  for _, itemType in ipairs(index.types) do
    local entries, count, total = {}, 0, 0
    for _, list in ipairs(itemType.lists) do
      local names = {}
      for _, b in ipairs(list.bases) do
        if (not only or b.affixes == only) and spawnWeight(b.base, mod) > 0 then table.insert(names, b.name) end
      end
      count, total = count + #names, total + #list.bases
      if #names > 0 then
        table.sort(names)
        table.insert(entries, {
          name = list.name, count = #names, total = #list.bases, names = #names < #list.bases and names or nil,
        })
      end
    end
    if count == total and count > 0 and #itemType.lists > 1 then
      table.insert(out, { name = itemType.name, itemType = true, count = count, total = total })
    else
      for _, e in ipairs(entries) do table.insert(out, e) end
    end
  end
  baseTypesCache[mod] = out
  return out
end

-- Essence hits: one per line of each mod an essence grants, naming the item types it grants that mod on
-- (sorted) and, when PoB's data has it, the mod's affix type. The mod is found as PoB's crafting finds it,
-- in the Item mods, else the Exclusive ones (ItemsTab.lua:3076); one found in neither (a passive grant)
-- has no text, and PoB skips it too. A hit matches when its line or its essence's name has the query.
local function collectEssenceHits(hits, query)
  local d = gameData()
  local itemMods, exclusive = d.itemMods.Item or {}, d.itemMods.Exclusive or {}
  for _, key in ipairs(sortedKeys(d.essences)) do
    local essence = d.essences[key]
    if type(essence) == 'table' and type(essence.name) == 'string' and type(essence.mods) == 'table' then
      local byName = contains(essence.name, query)
      local itemTypesOf, modIds = {}, {}
      for _, itemType in ipairs(sortedKeys(essence.mods)) do
        local modId = essence.mods[itemType]
        if not itemTypesOf[modId] then
          itemTypesOf[modId] = {}
          table.insert(modIds, modId)
        end
        table.insert(itemTypesOf[modId], itemType)
      end
      table.sort(modIds)
      for _, modId in ipairs(modIds) do
        local mod = itemMods[modId] or exclusive[modId]
        if type(mod) == 'table' then
          local itemTypes = itemTypesOf[modId]
          local where = table.concat(itemTypes, ', ') .. (type(mod.type) == 'string' and ('; ' .. mod.type) or '')
          local n = 0
          for _, line in ipairs(mod) do
            if type(line) == 'string' then
              n = n + 1
              local flat = oneLine(line)
              if byName or contains(flat, query) then
                table.insert(hits, {
                  kind = 'essence', id = key .. '/' .. modId, name = essence.name, order = n,
                  source = essence.name .. ' (' .. where .. ')', line = flat,
                  itemTypes = itemTypes, modId = modId, affix = type(mod.type) == 'string' and mod.type or nil,
                })
              end
            end
          end
        end
      end
    end
  end
end

-- The essences' names, for the closest names of mechanic mode (D-258).
local function addEssenceNames(add)
  local d = gameData()
  for _, key in ipairs(sortedKeys(d.essences)) do
    if type(d.essences[key]) == 'table' then add(d.essences[key].name, 'essence') end
  end
end

-- ---------------------------------------------------------------------------------------------------
-- Mechanics

local KIND_RANK = { gem = 1, unique = 2, passive = 3, mod = 4, essence = 5 }

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
            mod = entry, -- for its base types (WU-60); dropped before the reply
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

local KINDS_TEXT = 'gem, unique, passive, mod or essence'

local function lookupMechanics(query, kind, maxResults)
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

  -- Uniques: every variant's mod lines; a line the selected variant lacks names its variants.
  for key, item in pairs(uniqueList()) do
    local name = item.title or item.name or key
    for n, entry in ipairs(uniqueModLines(item)) do
      if contains(entry.line, query) then
        local where = tostring(item.type)
        if entry.variants then where = where .. '; ' .. variantNote(entry.variants) end
        table.insert(hits, {
          kind = 'unique', id = key, name = name, order = n,
          source = name .. ' (' .. where .. ')', line = entry.line, variants = entry.variants,
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

  -- Essences: every essence's mod lines, or all of them when its name matches (WU-60).
  collectEssenceHits(hits, query)

  table.sort(hits, function(a, b)
    if a.kind ~= b.kind then return KIND_RANK[a.kind] < KIND_RANK[b.kind] end
    if a.name ~= b.name then return a.name < b.name end
    if a.id ~= b.id then return a.id < b.id end
    return a.order < b.order
  end)
  -- Every kind's hit count, then (with `kind`) only that kind's hits are listed and cut.
  local kinds = { gem = 0, unique = 0, passive = 0, mod = 0, essence = 0 }
  local listed = {}
  for _, hit in ipairs(hits) do
    kinds[hit.kind] = kinds[hit.kind] + 1
    if not kind or hit.kind == kind then table.insert(listed, hit) end
  end
  local results = cut(listed, maxResults)
  for _, hit in ipairs(results) do
    hit.order = nil
    if hit.kind == 'passive' then hit.id = tostring(hit.nodeId) end
    if hit.kind == 'mod' then hit.baseTypes = M.modBaseTypes(hit.mod, d.itemMods[hit.table]) end
    hit.mod = nil
  end
  return results, #listed, kinds
end

-- ---------------------------------------------------------------------------------------------------
-- Closest names, when nothing matched (D-258)

local MAX_SUGGESTIONS = 5
-- Gem mode's groups (D-258a): active gems first, so an invalid skill still gets skill names, then supports.
local GEM_GROUPS = { { kind = 'active', max = 5 }, { kind = 'support', max = 3 } }
-- The longest query (in characters) that gets suggestions: each costs (query length) x (name length) per name.
local MAX_SUGGESTION_QUERY = 100

-- A name's characters (UTF-8 sequences), ASCII letters lowercased.
local function chars(s)
  local out = {}
  for ch in s:lower():gmatch('[%z\1-\127\194-\244][\128-\191]*') do out[#out + 1] = ch end
  return out
end

-- The optimal string alignment distance between two character lists: the fewest insertions, deletions,
-- substitutions and swaps of two adjacent characters, each costing 1, that turn one into the other.
local function editDistance(a, b)
  local la, lb = #a, #b
  if la == 0 then return lb end
  if lb == 0 then return la end
  local before, prev = nil, {}
  for j = 0, lb do prev[j] = j end
  for i = 1, la do
    local cur = { [0] = i }
    for j = 1, lb do
      local d = math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i] == b[j] and 0 or 1))
      if before and j > 1 and a[i] == b[j - 1] and a[i - 1] == b[j] then
        d = math.min(d, before[j - 2] + 1)
      end
      cur[j] = d
    end
    before, prev = prev, cur
  end
  return prev[lb]
end

-- A candidate list that keeps one entry per (name, kind, detail).
local function candidates()
  local list, seen = {}, {}
  return list, function(name, kind, detail)
    if type(name) ~= 'string' or name == '' then return end
    local key = name .. '\0' .. kind .. '\0' .. (detail or '')
    if seen[key] then return end
    seen[key] = true
    table.insert(list, { name = name, kind = kind, detail = detail })
  end
end

local function addGemNames(add, asKind)
  for _, gem in pairs(gameData().gems) do
    if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect then
      add(gem.name, asKind or (isSupportGem(gem) and 'support' or 'active'))
    end
  end
end

local function addUniqueNames(add, itemType)
  for key, item in pairs(uniqueList()) do
    if not itemType or item.type == itemType then
      add(item.title or item.name or tostring(key), 'unique', item.type)
    end
  end
end

local function addPassiveNames(add)
  for _, node in pairs(treeNodes()) do
    if type(node) == 'table' and type(node.sd) == 'table' then add(node.name, 'passive', node.ascendancyName) end
  end
end

local function addModNames(add)
  local mods = gameData().itemMods or {}
  for _, tableName in ipairs(sortedKeys(mods)) do
    if type(mods[tableName]) == 'table' then
      for _, entryId in ipairs(sortedKeys(mods[tableName])) do
        if type(mods[tableName][entryId]) == 'table' then add(tostring(entryId), 'mod', tableName) end
      end
    end
  end
end

-- The candidates of a mode: the names it searches (mechanic mode: its hits' sources). `filter` is unique
-- mode's item type or mechanic mode's kind, when given.
local function suggestionCandidates(mode, filter)
  local list, add = candidates()
  local kind = mode == 'mechanic' and filter or nil
  if mode == 'gem' then
    addGemNames(add)
  elseif mode == 'unique' then
    addUniqueNames(add, filter)
  else
    if not kind or kind == 'gem' then addGemNames(add, 'gem') end
    if not kind or kind == 'unique' then addUniqueNames(add) end
    if not kind or kind == 'passive' then addPassiveNames(add) end
    if not kind or kind == 'mod' then addModNames(add) end
    if not kind or kind == 'essence' then addEssenceNames(add) end
  end
  return list
end

-- The candidates closest to the query's characters `q`: by edit distance, then name, then kind, then
-- detail. Gem mode takes each of GEM_GROUPS in turn; other modes the first MAX_SUGGESTIONS.
local function closestNames(mode, q, list)
  for _, c in ipairs(list) do c.distance = editDistance(q, chars(c.name)) end
  table.sort(list, function(a, b)
    if a.distance ~= b.distance then return a.distance < b.distance end
    if a.name ~= b.name then return a.name < b.name end
    if a.kind ~= b.kind then return a.kind < b.kind end
    return (a.detail or '') < (b.detail or '')
  end)
  if mode ~= 'gem' then return cut(list, MAX_SUGGESTIONS) end
  local out = {}
  for _, group in ipairs(GEM_GROUPS) do
    local n = 0
    for _, c in ipairs(list) do
      if n >= group.max then break end
      if c.kind == group.kind then
        table.insert(out, c)
        n = n + 1
      end
    end
  end
  return out
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

  local results, total, kinds, filter
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
    filter = slot and resolveSlot(slot) or nil
  else
    if not needle then fail('mechanic mode needs a query') end
    local kind = trimmed(params.kind)
    if kind then
      kind = kind:lower()
      if not KIND_RANK[kind] then fail('unknown kind "' .. tostring(params.kind) .. '"; use ' .. KINDS_TEXT) end
    end
    results, total, kinds = lookupMechanics(needle, kind, maxResults)
    filter = kind
  end
  -- D-258: a query that matched nothing gets the closest names of the kind searched, unless it is too long.
  local suggestions, suggestionsSkipped
  if total == 0 and needle then
    local q = chars(needle)
    if #q > MAX_SUGGESTION_QUERY then
      suggestionsSkipped = { queryLength = #q, maxQueryLength = MAX_SUGGESTION_QUERY }
    else
      suggestions = closestNames(mode, q, suggestionCandidates(mode, filter))
    end
  end
  return {
    mode = mode, total = total, results = results, kinds = kinds,
    suggestions = suggestions, suggestionsSkipped = suggestionsSkipped,
  }
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
