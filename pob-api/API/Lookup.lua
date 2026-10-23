-- API/Lookup.lua
-- PoB2's loaded game data, read without touching the build (C-37, WU-31):
--
--   lookup_game_data  {mode, query?, level?, quality?, slot?, kind?, maxLevel?, maxResults?}
--     gem       data.gems names -> PoB's Tier (D-258), description, weapon, per stat set its base attack
--               damage and crit chance and its lines from PoB's stat describer (at `level`, default the
--               gem's natural max level; see defaultLevel; a returned gem without `level` is shown at its
--               default), the +20% quality lines and the Gemling ones (`altQualityStats`), support rules,
--               the requirements at every gem level, and (WU-53, D-299) an active gem's skill types and
--               the meta gems that can use it, and every gem's hit-making children. With exactly one gem
--               returned (D-239's one-result rule), or several that are all named as the query, a support
--               lists the active gems it can support and an active gem the supports another support unlocks.
--               After the gems, the minion skills whose name is the query, case-insensitive (WU-77, D-379):
--               of the skills a gem's minion casts, each with its minions and summoning gems, whether it is
--               a command, the passives whose line grants it, its cooldown, skill types and stat sets. Each
--               gem also carries, per gem level, its cost, Spirit reservation, cooldown and stored uses, and a
--               support's cost and reservation multipliers, from its levels[n] (C-37a, D-425)
--     unique    main.uniqueDB names, mod lines (every variant's, legacy "Pre x.y" variants skipped) or
--               type -> name, base, type and the matched lines; BuildRaw() text, ready for add_item,
--               only when exactly one unique is returned (D-239)
--     mechanic  gem descriptions, stat-set lines (naming the stat set's number), quality and Gemling
--               quality lines, unique mod lines (every variant's), passive `sd` lines, data.itemMods text,
--               the essences' mod lines (or names) and the item bases' implicit lines (or names) -> one hit
--               per matching line; a mod hit carries the base types that can roll it (WU-60, D-277); `kind`
--               keeps one kind, and `kinds` counts every kind's hits (D-240). A query may hold gaps, `…` or
--               `...`, each matching any text within the line (WU-53). Data/Misc.lua's game, character and
--               monster constants whose name matches are hits of kind `constant`, ranked last (C-37d)
--     base      the bases of item type `slot` (required), of required level at most `maxLevel`, whose name
--               contains `query`: requirements, implicits, defences, weapon figures, Spirit, socket limit;
--               sorted by required level, highest first, then by name (C-37b, D-425)
--     config    PoB's config options whose key or label contains `query`: key, label, type, section, list
--               values and labels, the conditions that show it and its tooltip's first line (C-37c, D-425)
--
-- Registered by one line in Handlers.lua. Results are sorted, then cut to maxResults (default 20; the
-- server caps it): exact name matches first, then by name, then by id (gem mode: the gems, then the minion
-- skills by id); mechanic hits by kind (gem, unique, passive, mod, essence, base, constant), then by name,
-- then by id, then by line; config options by key. `total` counts every match.
--
-- When a query matches nothing, `suggestions` lists the closest names of the kind searched (D-258): in gem
-- mode up to 5 active gems, then up to 3 supports (D-258a); in unique mode up to 5 unique names, of `slot`
-- when given; in mechanic mode up to 5 names of the gems, uniques, passives, mods, essences, bases and
-- constants searched, of `kind` when given; in base mode up to 5 base names of the item type; in config mode up
-- to 5 option keys. Each group is ranked by edit distance to the query (see editDistance), then by name,
-- then by kind and detail. A query longer than MAX_SUGGESTION_QUERY characters gets none (the cost grows
-- with its length); the reply says so with `suggestionsSkipped`.
--
-- The gem helpers (findGem, gemEffects, defaultLevel, describeStatSet, statSetLabel) and lineIsSelected (a
-- unique's or item's selected-variant test) are shared with other modules (API/Coverage.lua, WU-32).
--
-- Rules: a lookup reads data only. Nothing here changes the build, writes a file or makes a request.

local M = {}

local BuildOps = require('API.BuildOps')

local DEFAULT_MAX_RESULTS = 20

-- D-384: what the lookups leave out, as PoB's own selectors do: a gem PoB marks legacy (hidden unless "Show
-- legacy gems" is ticked) and a unique PoB marks no longer obtainable (its item database's "Obtainable"
-- filter). Each call names the ones its query matched (`leftOut`), so a search never silently loses them.
local function leftOutList()
  local seen, out = { gem = {}, unique = {} }, { legacyGems = {}, unobtainableUniques = {} }
  local function note(kind, name)
    if seen[kind][name] then return end
    seen[kind][name] = true
    table.insert(kind == 'gem' and out.legacyGems or out.unobtainableUniques, name)
  end
  local function result()
    if #out.legacyGems == 0 and #out.unobtainableUniques == 0 then return nil end
    table.sort(out.legacyGems)
    table.sort(out.unobtainableUniques)
    return out
  end
  return note, result
end

local function isLegacyGem(gem) return BuildOps.is_legacy_gem(gem) end
local function isUnobtainable(item) return BuildOps.is_unobtainable_unique(item) end

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
-- described alone at value x 20, in its stat set's scope). `key` 'altQualityStats' gives the Gemling
-- ones, which PoB lists the same way when the build has GemlingQuality (SkillsTab.lua:893-910).
local function qualityLines(grantedEffect, key)
  local d = gameData()
  local out = {}
  if type(grantedEffect.statSets) ~= 'table' then return out end
  for _, q in ipairs(grantedEffect[key or 'qualityStats'] or {}) do
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

-- C-37a (D-425): a cost as PoB's gem tooltip shows it (GemTooltip.lua:136-150): data.costs' resource string, the
-- value divided by its divisor (a per-minute cost shown per second) and rounded to 2 places.
local function costText(res, value)
  local shown = math.floor(value / (res.Divisor or 1) * 100 + 0.5) / 100
  return (res.ResourceString:gsub('{0}', string.format('%g', shown)):gsub('%s+$', ''))
end

-- C-37a (D-425): each gem level's cost, Spirit reservation, cooldown and stored uses, and a support's cost and
-- reservation multipliers, as PoB's `grantedEffect.levels[n]` holds them, for gem levels 1..naturalMaxLevel (the
-- requirements' span). A cost lists each resource the level's `cost` table holds, in data.costs' order (any
-- other resource after them, by name), with its raw value and PoB's tooltip text. Nil when no level holds any.
local function gemLevelCosts(gem)
  local ge = gem.grantedEffect
  local costs = gameData().costs or {}
  local maxLevel = tonumber(gem.naturalMaxLevel) or 1
  local rows, any = {}, false
  for l = 1, maxLevel do
    local level = ge.levels[l] or {}
    local row = { level = l }
    if type(level.cost) == 'table' then
      local list, known = {}, {}
      for _, res in ipairs(costs) do
        local v = level.cost[res.Resource]
        if type(v) == 'number' then
          known[res.Resource] = true
          table.insert(list, { resource = res.Resource, value = v, text = costText(res, v) })
        end
      end
      for _, key in ipairs(sortedKeys(level.cost)) do
        local v = level.cost[key]
        if not known[key] and type(v) == 'number' then
          table.insert(list, { resource = tostring(key), value = v, text = string.format('%g %s', v, tostring(key)) })
        end
      end
      if #list > 0 then row.cost = list end
    end
    row.spirit = tonumber(level.spiritReservationFlat)
    row.cooldown = tonumber(level.cooldown)
    row.storedUses = tonumber(level.storedUses)
    row.manaMultiplier = tonumber(level.manaMultiplier)
    row.reservationMultiplier = tonumber(level.reservationMultiplier)
    if row.cost or row.spirit or row.cooldown or row.storedUses or row.manaMultiplier or row.reservationMultiplier then
      any = true
    end
    rows[l] = row
  end
  return any and rows or nil
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

-- ---------------------------------------------------------------------------------------------------
-- Amendment 3's gem additions (WU-53, D-299)

-- A gem's quality lines (`qualityStats`) or Gemling lines (`altQualityStats`), over its granted effects in
-- the block's order; also whether any effect has such an entry (a Gemling entry may describe to no line).
local function gemQualityLines(gem, key)
  local out, any = {}, false
  for _, effect in ipairs(M.gemEffects(gem)) do
    if type(effect[key]) == 'table' and #effect[key] > 0 then any = true end
    for _, line in ipairs(qualityLines(effect, key)) do table.insert(out, line) end
  end
  return out, any
end

-- The SkillType names a granted effect's `skillTypes` holds, sorted by name.
local function skillTypeSet(grantedEffect)
  local out = {}
  for t, on in pairs(grantedEffect.skillTypes or {}) do
    if on then table.insert(out, SkillTypeName and SkillTypeName[t] or tostring(t)) end
  end
  table.sort(out)
  return out
end

-- An effect PoB makes an active skill: not a support and not hidden from the sidebar (CalcSetup.lua:1855).
local function isActiveEffect(effect)
  return type(effect) == 'table' and not effect.support and not effect.hideFromSideBar
end

local function activeEffectsOf(gem)
  local out = {}
  for _, effect in ipairs(M.gemEffects(gem)) do
    if isActiveEffect(effect) then table.insert(out, effect) end
  end
  return out
end

-- The active skill PoB's calcLib.canGrantedEffectSupportActiveSkill reads (CalcTools.lua:85-110): the
-- effect and its gem, a copy of its skill types and minion skill types, and a player actor (its enemy's
-- player is itself, as for the player's own skills).
local function activeSkillOf(effect, gem)
  local player = {}
  player.enemy = { player = player }
  return {
    activeEffect = { grantedEffect = effect, gemData = gem },
    skillTypes = copyTable(effect.skillTypes or {}),
    minionSkillTypes = effect.minionSkillTypes and copyTable(effect.minionSkillTypes) or nil,
    actor = player,
  }
end

-- PoB's own support test.
local function canSupport(supportEffect, activeSkill)
  if type(supportEffect.requireSkillTypes) ~= 'table' or type(supportEffect.excludeSkillTypes) ~= 'table' then
    return false
  end
  return calcLib.canGrantedEffectSupportActiveSkill(supportEffect, activeSkill) and true or false
end

-- Whether a support effect can support one of a gem's active effects, with their own types.
local function supportsAnyOf(supportEffect, gem, effects)
  for _, effect in ipairs(effects) do
    if canSupport(supportEffect, activeSkillOf(effect, gem)) then return true end
  end
  return false
end

local gemIndexCache = setmetatable({}, { __mode = 'k' })

local function byNameThenId(a, b)
  if a.name ~= b.name then return a.name < b.name end
  return a.id < b.id
end

-- The game data's active gems (with their active effects), support gems, the supports that add skill
-- types, and the meta gems (a granted effect of skill type Meta) with their support effect; each sorted by
-- name, then id.
local function gemIndex()
  local d = gameData()
  if gemIndexCache[d] then return gemIndexCache[d] end
  local index = { actives = {}, supports = {}, adders = {}, metas = {} }
  -- D-384: a legacy gem is in no gem's lists (supports, unlocks, "usable by"), as gem mode leaves it out.
  for id, gem in pairs(d.gems) do
    if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect and not isLegacyGem(gem) then
      local entry = { id = id, name = gem.name, gem = gem }
      if isSupportGem(gem) then
        table.insert(index.supports, entry)
        if #(gem.grantedEffect.addSkillTypes or {}) > 0 then table.insert(index.adders, entry) end
      else
        entry.effects = activeEffectsOf(gem)
        table.insert(index.actives, entry)
      end
      local isMeta, supportEffect = false, nil
      for _, effect in ipairs(M.gemEffects(gem)) do
        if type(effect.skillTypes) == 'table' and effect.skillTypes[SkillType.Meta] then isMeta = true end
        if effect.support and not supportEffect then supportEffect = effect end
      end
      if isMeta and supportEffect then
        table.insert(index.metas, { id = id, name = gem.name, effect = supportEffect, trigger = supportEffect.isTrigger == true })
      end
    end
  end
  for _, list in pairs(index) do table.sort(list, byNameThenId) end
  gemIndexCache[d] = index
  return index
end

-- "Usable by": the meta gems whose support effect can support one of the gem's active effects.
local function usableBy(gem, effects)
  local out = {}
  for _, meta in ipairs(gemIndex().metas) do
    if supportsAnyOf(meta.effect, gem, effects) then table.insert(out, { name = meta.name, trigger = meta.trigger }) end
  end
  return out
end

-- What a support can ride: the active gems it can support with their own types. When they are more than
-- half of all active gems, the reply names the ones it can't (`except`), to stay short. `names` has one
-- entry per gem, so a name that several gems share repeats; the handler prints it once, with `×n`.
local function supportReach(gem)
  local index = gemIndex()
  local yes, no = {}, {}
  for _, active in ipairs(index.actives) do
    table.insert(supportsAnyOf(gem.grantedEffect, active.gem, active.effects) and yes or no, active.name)
  end
  local total = #index.actives
  if #yes * 2 > total then return { count = #yes, total = total, except = true, names = no } end
  return { count = #yes, total = total, except = false, names = yes }
end

local function sharesFamily(a, b)
  for _, family in ipairs(a.gemFamily or {}) do
    for _, other in ipairs(b.gemFamily or {}) do
      if family == other then return true end
    end
  end
  return false
end

local function addTypes(activeSkill, types)
  for _, t in ipairs(types or {}) do activeSkill.skillTypes[t] = true end
end

-- Type-granting unlocks: the supports X that can't support any of the gem's active effects, each with the
-- supports Y that unlock it on one effect E, as PoB decides (CalcActiveSkill.lua:182-212; one support per
-- gem family, CalcSetup.lua:517-527): Y can support E, adds skill types and shares no family with X; with
-- Y's added types X can support E; with Y's and X's added types both still can. One helper, no chains.
local function supportUnlocks(gem, effects)
  local index = gemIndex()
  local out = {}
  for _, x in ipairs(index.supports) do
    local xEffect = x.gem.grantedEffect
    if not supportsAnyOf(xEffect, gem, effects) then
      local after = {}
      for _, y in ipairs(index.adders) do
        local yEffect = y.gem.grantedEffect
        if y ~= x and not sharesFamily(xEffect, yEffect) then
          for _, effect in ipairs(effects) do
            local skill = activeSkillOf(effect, gem)
            if canSupport(yEffect, skill) then
              addTypes(skill, yEffect.addSkillTypes)
              if canSupport(xEffect, skill) then
                addTypes(skill, xEffect.addSkillTypes)
                if canSupport(yEffect, skill) and canSupport(xEffect, skill) then
                  table.insert(after, y.name)
                  break
                end
              end
            end
          end
        end
      end
      if #after > 0 then table.insert(out, { name = x.name, after = after }) end
    end
  end
  return out
end

-- A granted effect makes hits by PoB's rule (CalcActiveSkill.lua:176): a stat set's `baseFlags.hit`, or the
-- Attack, Damage or Projectile skill type.
local function makesHits(effect)
  local types = effect.skillTypes or {}
  if types[SkillType.Attack] or types[SkillType.Damage] or types[SkillType.Projectile] then return true end
  for _, statSet in ipairs(effect.statSets or {}) do
    if type(statSet.baseFlags) == 'table' and statSet.baseFlags.hit then return true end
  end
  return false
end

-- The name a gem block gives its i-th other granted effect (its `Also grants:` line): its name, else, as
-- PoB's gem tooltip names an unnamed effect, its first stat set's label (SkillsTab.lua:915-916).
local function otherEffectName(effect, i)
  if type(effect.name) == 'string' and effect.name ~= '' then return effect.name end
  local first = type(effect.statSets) == 'table' and effect.statSets[1] or nil
  if first and type(first.label) == 'string' and first.label ~= '' then return first.label end
  return 'Granted effect ' .. (i + 1)
end

-- A gem's hit-making children: its other granted effects that PoB makes active skills (`triggered` with the
-- Triggered or InbuiltTrigger type, else `granted`), then, for each granted effect PoB makes an active skill,
-- its minions' skills (CalcActiveSkill.lua:900-919). Only those that make hits; each (name, kind, minion) once.
local function hitChildren(gem)
  local d = gameData()
  local out, seen = {}, {}
  local function add(name, kind, minion)
    local key = name .. '\0' .. kind .. '\0' .. (minion or '')
    if seen[key] then return end
    seen[key] = true
    table.insert(out, { name = name, kind = kind, minion = minion })
  end
  for i, effect in ipairs(gem.additionalGrantedEffects or {}) do
    if isActiveEffect(effect) and makesHits(effect) then
      local types = effect.skillTypes or {}
      add(otherEffectName(effect, i), (types[SkillType.Triggered] or types[SkillType.InbuiltTrigger]) and 'triggered' or 'granted')
    end
  end
  for _, effect in ipairs(M.gemEffects(gem)) do
    if isActiveEffect(effect) then
      for _, minionId in ipairs(effect.minionList or {}) do
        local minion = d.minions and d.minions[minionId]
        if type(minion) == 'table' then
          for _, skillId in ipairs(minion.skillList or {}) do
            local skill = d.skills[skillId]
            if type(skill) == 'table' and type(skill.name) == 'string' and makesHits(skill) then
              add(skill.name, 'minion', tostring(minion.name))
            end
          end
        end
      end
    end
  end
  return out
end

-- A requested gem level the gem lacks shows the gem at its default level, with a note saying so. `single`
-- (exactly one gem returned, or every returned gem named as the query) adds the long lists: a support's
-- reach, an active gem's unlocks (WU-53).
local function gemResult(id, gem, levelParam, quality, single)
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
    qualityLines = gemQualityLines(gem, 'qualityStats'),
    requirements = gemRequirements(gem),
    -- C-37a (D-425): each level's cost, Spirit, cooldown and stored uses, and a support's multipliers.
    levelCosts = gemLevelCosts(gem),
    -- WU-53: a skill's hit-making children, for the payoff-thief check.
    children = hitChildren(gem),
  }
  -- WU-53 (PG-46): the Gemling quality lines, labelled; `hasGemling` when any effect has such an entry.
  result.gemlingLines, result.hasGemling = gemQualityLines(gem, 'altQualityStats')
  for i, effect in ipairs(gem.additionalGrantedEffects or {}) do
    if effect and effect.statSets then
      table.insert(result.additional, {
        name = otherEffectName(effect, i),
        support = effect.support == true,
        skillTypes = not effect.support and skillTypeSet(effect) or nil,
        statSets = effectBlock(effect, level, quality),
      })
    end
  end
  if result.gemKind == 'active' then
    -- WU-53 ("usable by"): the gem's skill types and the meta gems that accept it.
    local effects = activeEffectsOf(gem)
    result.skillTypes = skillTypeSet(ge)
    result.usableBy = usableBy(gem, effects)
    if single then result.unlocks = supportUnlocks(gem, effects) end
  elseif single then
    result.canSupport = supportReach(gem)
  end
  if support then
    result.supports = skillTypeNames(ge.requireSkillTypes)
    result.cannotSupport = skillTypeNames(ge.excludeSkillTypes)
  end
  return result
end

-- ---------------------------------------------------------------------------------------------------
-- Amendment 6's minion skills (WU-77, D-379)

-- The build's passive tree nodes (else the latest tree's), ascendancy nodes included.
local function treeNodes()
  if _G.build and build.spec and build.spec.tree and build.spec.tree.nodes then return build.spec.tree.nodes end
  if _G.main and main.tree and _G.latestTreeVersion and main.tree[latestTreeVersion] then
    return main.tree[latestTreeVersion].nodes
  end
  return {}
end

local minionSkillCache = setmetatable({}, { __mode = 'k' })

-- Every minion skill reachable from a gem, as PoB builds a summon's minion (CalcActiveSkill.lua:1112-1130):
-- the gem's active effects' `minionList` -> the minion's `skillList` -> `data.skills`. Keyed by the
-- lowercased skill name: a list of { id, skill, casters }, one per granted effect, sorted by id; `casters`
-- holds each (minion, summoning gem) that casts it, sorted by minion name, then gem name, then gem id.
local function minionSkillIndex()
  local d = gameData()
  if minionSkillCache[d] then return minionSkillCache[d] end
  local byId, seen = {}, {}
  for gemId, gem in pairs(d.gems) do
    if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect then
      for _, effect in ipairs(M.gemEffects(gem)) do
        if isActiveEffect(effect) then
          for _, minionId in ipairs(effect.minionList or {}) do
            local minion = d.minions and d.minions[minionId]
            if type(minion) == 'table' then
              for _, skillId in ipairs(minion.skillList or {}) do
                local skill = d.skills[skillId]
                if type(skill) == 'table' and type(skill.name) == 'string' and skill.name ~= '' then
                  local entry = byId[skillId]
                  if not entry then
                    entry = { id = tostring(skillId), skill = skill, casters = {} }
                    byId[skillId] = entry
                  end
                  local key = tostring(skillId) .. '\0' .. tostring(minionId) .. '\0' .. tostring(gemId)
                  if not seen[key] then
                    seen[key] = true
                    table.insert(entry.casters, {
                      minion = tostring(minion.name or minionId), minionId = tostring(minionId),
                      gem = gem.name, gemId = tostring(gemId),
                    })
                  end
                end
              end
            end
          end
        end
      end
    end
  end
  local index = {}
  for _, entry in pairs(byId) do
    table.sort(entry.casters, function(a, b)
      if a.minion ~= b.minion then return a.minion < b.minion end
      if a.gem ~= b.gem then return a.gem < b.gem end
      return a.gemId < b.gemId
    end)
    local key = entry.skill.name:lower()
    index[key] = index[key] or {}
    table.insert(index[key], entry)
  end
  for _, list in pairs(index) do table.sort(list, function(a, b) return a.id < b.id end) end
  minionSkillCache[d] = index
  return index
end

-- A command: one of its stat sets lists `is_commandable_skill` (the player orders the minion to use it).
local function isCommandable(skill)
  for _, statSet in ipairs(skill.statSets or {}) do
    for _, stat in ipairs(statSet.stats or {}) do
      if stat == 'is_commandable_skill' then return true end
    end
    for _, stat in ipairs(statSet.constantStats or {}) do
      if type(stat) == 'table' and stat[1] == 'is_commandable_skill' then return true end
    end
  end
  return false
end

-- The passives with a line that reads "Grants Skill: <name>": a command's unlock in game. PoB parses such
-- a line for a gem's skill only, so it never checks a minion skill's passive (spike A4). Sorted by node id.
local function grantingNodes(name)
  local wanted = ('grants skill: ' .. name):lower()
  local out = {}
  for id, node in pairs(treeNodes()) do
    if type(node) == 'table' and type(node.sd) == 'table' then
      for _, stat in ipairs(node.sd) do
        if type(stat) == 'string' and oneLine(stat):lower() == wanted then
          table.insert(out, { id = tonumber(id), name = tostring(node.name or ('Node ' .. tostring(id))), ascendancy = node.ascendancyName })
          break
        end
      end
    end
  end
  table.sort(out, function(a, b) return (a.id or 0) < (b.id or 0) end)
  return out
end

-- One minion skill (D-379): who casts it, whether it is a command, the passives that grant it, its
-- cooldown, skill types, description and stat sets. Its level follows its minion's (PoB takes the highest
-- level whose requirement the minion meets, CalcActiveSkill.lua:1147-1155), so it is shown at its highest.
local function minionSkillResult(entry)
  local skill = entry.skill
  local levels = sortedLevels(skill)
  local level = levels[#levels] or 1
  local levelData = skill.levels and skill.levels[level] or {}
  return {
    kind = 'minion-skill',
    id = entry.id,
    name = skill.name,
    castBy = entry.casters,
    commanded = isCommandable(skill),
    grantedBy = grantingNodes(skill.name),
    cooldown = tonumber(levelData.cooldown),
    skillTypes = skillTypeSet(skill),
    description = skill.description and oneLine(skill.description) or nil,
    level = level,
    levelCount = #levels,
    statSets = effectBlock(skill, level, 0),
  }
end

local function lookupGems(query, level, quality, maxResults, leaveOut)
  local d = gameData()
  local matches = {}
  for id, gem in pairs(d.gems) do
    if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect and contains(gem.name, query) then
      if isLegacyGem(gem) then leaveOut('gem', gem.name)
      else table.insert(matches, { id = id, name = gem.name, gem = gem }) end
    end
  end
  sortByName(matches, query)
  -- D-379: the minion skills whose name is the query (case-insensitive), after every gem: a name a gem and
  -- a minion skill share lists the gem first.
  local minionSkills = minionSkillIndex()[query] or {}
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
  -- The long lists come for one returned gem, or for each when every returned gem is named as the query
  -- (gems that share a name: Mace Strike's three, Unleash's spell and support).
  local single = #shown == 1
  if not single and #shown > 0 then
    single = true
    for _, m in ipairs(shown) do
      if m.name:lower() ~= query then single = false break end
    end
  end
  local results = {}
  for i, m in ipairs(shown) do
    results[i] = gemResult(m.id, m.gem, level, quality, single)
  end
  for i = 1, math.min(#minionSkills, maxResults - #results) do
    table.insert(results, minionSkillResult(minionSkills[i]))
  end
  return results, #matches + #minionSkills
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
local function lookupUniques(query, slot, maxResults, leaveOut)
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
      if (query == nil or byName or #lines > 0) and isUnobtainable(item) then
        leaveOut('unique', name)
      elseif query == nil or byName or #lines > 0 then
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
-- has, times its weightMultiplier). PoB weighs only these mods on a base, so only these get base types:
-- - a mod of an item affix table (Item, Flask, Charm or Jewel), only on the bases whose items take their
--   affixes from that table (Item.lua:840-842), as PoB's prefix and suffix lists weigh the item's own
--   affixes (ItemsTab.lua:3047-3049);
-- - a Corruption mod, as PoB's corrupted-enchant list weighs that table on the item (ItemsTab.lua:2717-2718);
-- - a Desecrated mod with a desecrated tag (ulaman_mod, amanamu_mod, kurgal_mod or unveiled_mod), as PoB's
--   desecrated list weighs that table's tagged mods on the item (ItemsTab.lua:3129-3146).
-- PoB weighs no other table on a base: Exclusive (uniques' and essences' fixed mods; read only as the
-- essence fallback, ItemsTab.lua:3076) and IncursionLimb. Their mods, and an untagged Desecrated mod, get
-- `notRolled`, the reason they aren't rolled on a base, whatever their weights say. A mod without
-- `weightKey` (a rune's) gets neither.

local baseIndexCache = setmetatable({}, { __mode = 'k' })
local baseTypesCache = setmetatable({}, { __mode = 'k' })

-- The mod tables PoB weighs on a base besides the item's own affix table (see above).
local WEIGHED_TABLES = { Corruption = true, Desecrated = true }
-- PoB's desecrated-list filter (ItemsTab.lua:3129-3135).
local DESECRATED_TAGS = { ulaman_mod = true, amanamu_mod = true, kurgal_mod = true, unveiled_mod = true }

local function hasDesecratedTag(mod)
  for _, tag in ipairs(mod.modTags or {}) do
    if DESECRATED_TAGS[tag] then return true end
  end
  return false
end

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
-- can. `count` and `total` count bases. Empty when no base can. A mod PoB doesn't weigh on a base (see
-- above) gets an empty list and, second, the reason; a mod without spawn weights gets nil.
function M.modBaseTypes(mod, tableName)
  if type(mod) ~= 'table' or type(mod.weightKey) ~= 'table' then return nil end
  local cached = baseTypesCache[mod]
  if cached then return cached.out, cached.notRolled end
  local d = gameData()
  local index = baseIndex(d)
  local modTable = d.itemMods[tostring(tableName)]
  local only = modTable and index.affixTables[modTable] and modTable or nil
  local notRolled
  if not only and not WEIGHED_TABLES[tableName] then
    notRolled = tostring(tableName) .. " mods aren't rolled on a base"
  elseif tableName == 'Desecrated' and not hasDesecratedTag(mod) then
    notRolled = "Desecrated mods without a desecrated tag aren't rolled on a base"
  end
  if notRolled then
    baseTypesCache[mod] = { out = {}, notRolled = notRolled }
    return {}, notRolled
  end
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
  baseTypesCache[mod] = { out = out }
  return out
end

-- Essence hits: one per line of each mod an essence grants, naming the item types it grants that mod on
-- (sorted) and, when PoB's data has it, the mod's affix type. The mod is found as PoB's crafting finds it,
-- in the Item mods, else the Exclusive ones (ItemsTab.lua:3076); one found in neither (a passive grant)
-- has no text, and PoB skips it too. A hit matches when its line or its essence's name matches.
local function collectEssenceHits(hits, match)
  local d = gameData()
  local itemMods, exclusive = d.itemMods.Item or {}, d.itemMods.Exclusive or {}
  for _, key in ipairs(sortedKeys(d.essences)) do
    local essence = d.essences[key]
    if type(essence) == 'table' and type(essence.name) == 'string' and type(essence.mods) == 'table' then
      local byName = match(essence.name)
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
              if byName or match(flat) then
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

-- The names of the essences that have hits (a mod with text), for the closest names of mechanic mode
-- (D-258): an essence whose only mod has no text (Essence of Delirium's passive grant) can't be found, so
-- it isn't suggested.
local function addEssenceNames(add)
  local d = gameData()
  local itemMods, exclusive = d.itemMods.Item or {}, d.itemMods.Exclusive or {}
  for _, key in ipairs(sortedKeys(d.essences)) do
    local essence = d.essences[key]
    if type(essence) == 'table' and type(essence.mods) == 'table' then
      for _, modId in pairs(essence.mods) do
        if type(itemMods[modId] or exclusive[modId]) == 'table' then
          add(essence.name, 'essence')
          break
        end
      end
    end
  end
end

-- ---------------------------------------------------------------------------------------------------
-- Item-base implicits (WU-53, D-299; PG-48)
--
-- Every base in PoB's base lists (data.itemBaseLists, as the mod base types use them; hidden bases left
-- out), each name once, with its implicit lines (`implicit`, split at "\n" as Item.lua:85 splits it). A
-- line's leading `{variant:<n>}` tag is removed, and the variant is named from the base's `variantList`.

local baseImplicitsCache = setmetatable({}, { __mode = 'k' })

-- A base's implicit lines: `implicit` split at "\n", each line's leading tags removed, and a `{variant:<n>}`
-- tag's variants named from the base's `variantList`.
local function implicitLines(base)
  local lines = {}
  if type(base.implicit) ~= 'string' then return lines end
  for raw in base.implicit:gmatch('[^\n]+') do
    local line, variants = raw, nil
    while true do
      local tag, rest = line:match('^{([^}]*)}(.*)$')
      if not tag then break end
      local list = tag:match('^variant:(.*)$')
      if list then
        variants = {}
        for n in list:gmatch('%d+') do
          local name = type(base.variantList) == 'table' and base.variantList[tonumber(n)] or nil
          table.insert(variants, name or ('#' .. n))
        end
      end
      line = rest
    end
    if line ~= '' then table.insert(lines, { line = line, variants = variants }) end
  end
  return lines
end

local function baseImplicits()
  local d = gameData()
  if baseImplicitsCache[d] then return baseImplicitsCache[d] end
  local out, seen = {}, {}
  for _, listName in ipairs(sortedKeys(d.itemBaseLists or {})) do
    for _, entry in ipairs(d.itemBaseLists[listName]) do
      local base = entry.base
      if not seen[entry.name] and type(base) == 'table' and type(base.implicit) == 'string' then
        seen[entry.name] = true
        local lines = implicitLines(base)
        if #lines > 0 then table.insert(out, { name = entry.name, type = base.type, lines = lines }) end
      end
    end
  end
  table.sort(out, function(a, b) return a.name < b.name end)
  baseImplicitsCache[d] = out
  return out
end

-- Base hits: one per implicit line that matches, or every line of a base whose name matches.
local function collectBaseHits(hits, match)
  for _, base in ipairs(baseImplicits()) do
    local byName = match(base.name)
    for n, entry in ipairs(base.lines) do
      if byName or match(entry.line) then
        local where = tostring(base.type)
        if entry.variants then
          where = where .. '; ' .. (#entry.variants == 1 and 'variant ' or 'variants ') .. table.concat(entry.variants, ', ')
        end
        table.insert(hits, {
          kind = 'base', id = base.name, name = base.name, order = n,
          source = base.name .. ' (' .. where .. ')', line = entry.line,
          itemType = base.type, baseVariants = entry.variants,
        })
      end
    end
  end
end

-- The names of the bases with an implicit line, for the closest names of mechanic mode (D-258).
local function addBaseNames(add)
  for _, base in ipairs(baseImplicits()) do add(base.name, 'base', base.type) end
end

-- A mechanic query's matcher (WU-53): `…` or `...` is a gap matching any text within the line. A line
-- matches when the parts between the gaps, trimmed, appear in it in order without overlapping
-- (case-insensitive). Nil for a query of gaps alone.
function M.matcher(needle)
  local GAP = '\0'
  local s = needle:gsub('…', GAP)
  s = s:gsub('%.%.%.', GAP)
  if not s:find(GAP, 1, true) then
    return function(text) return contains(text, needle) end
  end
  local parts, from = {}, 1
  while true do
    local at = s:find(GAP, from, true)
    local part = s:sub(from, at and at - 1 or -1):match('^%s*(.-)%s*$')
    if part ~= '' then table.insert(parts, part) end
    if not at then break end
    from = at + 1
  end
  if #parts == 0 then return nil end
  return function(text)
    if type(text) ~= 'string' then return false end
    local t, pos = text:lower(), 1
    for _, part in ipairs(parts) do
      local _, e = t:find(part, pos, true)
      if not e then return false end
      pos = e + 1
    end
    return true
  end
end

-- ---------------------------------------------------------------------------------------------------
-- Item bases by item type (C-37b, D-425)
--
-- The bases of one of PoB's item types (`base.type`, such as Wand or Body Armour), from PoB's base lists
-- (data.itemBaseLists, hidden bases left out), as PoB's Data/Bases/*.lua hold them: the requirements, implicits,
-- defences, weapon figures, Spirit and socket limit. Sorted by required level, highest first (PoB's own base
-- lists' order), then by name; `maxLevel` keeps those whose required level is at most it, `query` those whose
-- name contains it.

-- PoB's item types that have a base in its base lists, sorted.
function M.baseItemTypes()
  local out = {}
  for _, itemType in ipairs(baseIndex(gameData()).types) do table.insert(out, itemType.name) end
  return out
end

local function resolveBaseType(slot)
  local wanted = tostring(slot):lower()
  for _, itemType in ipairs(baseIndex(gameData()).types) do
    if itemType.name:lower() == wanted then return itemType end
  end
  fail('unknown slot "' .. tostring(slot) .. '"; valid item types: ' .. table.concat(M.baseItemTypes(), ', '))
end

local DAMAGE_TYPES = { 'Physical', 'Fire', 'Cold', 'Lightning', 'Chaos' }

local function nonZero(v)
  v = tonumber(v)
  if v and v ~= 0 then return v end
  return nil
end

local function baseResult(entry)
  local base = entry.base
  local req = type(base.req) == 'table' and base.req or {}
  local result = {
    kind = 'item-base', id = entry.name, name = entry.name, type = base.type, subType = base.subType,
    level = tonumber(req.level), str = nonZero(req.str), dex = nonZero(req.dex), int = nonZero(req.int),
    implicits = implicitLines(base),
    spirit = nonZero(base.spirit), socketLimit = tonumber(base.socketLimit),
  }
  if type(base.armour) == 'table' then
    local a = base.armour
    local defences = {
      armour = nonZero(a.Armour), evasion = nonZero(a.Evasion), energyShield = nonZero(a.EnergyShield),
      ward = nonZero(a.Ward), block = nonZero(a.BlockChance), movementPenalty = nonZero(a.MovementPenalty),
    }
    if next(defences) then result.defences = defences end
  end
  if type(base.weapon) == 'table' then
    local w = base.weapon
    local damage = {}
    for _, t in ipairs(DAMAGE_TYPES) do
      local lo, hi = tonumber(w[t .. 'Min']), tonumber(w[t .. 'Max'])
      if (lo and lo ~= 0) or (hi and hi ~= 0) then table.insert(damage, { type = t, min = lo or 0, max = hi or 0 }) end
    end
    result.weapon = {
      damage = damage, critChance = tonumber(w.CritChanceBase), attackRate = tonumber(w.AttackRateBase),
      range = tonumber(w.Range), reloadTime = tonumber(w.ReloadTimeBase),
    }
  end
  return result
end

local function lookupBases(needle, slot, maxLevel, maxResults)
  local itemType = resolveBaseType(slot)
  local matches = {}
  for _, list in ipairs(itemType.lists) do
    for _, entry in ipairs(list.bases) do
      local req = type(entry.base.req) == 'table' and entry.base.req or {}
      local level = tonumber(req.level) or 0
      if (not maxLevel or level <= maxLevel) and (not needle or contains(entry.name, needle)) then
        table.insert(matches, { name = entry.name, level = level, entry = entry })
      end
    end
  end
  table.sort(matches, function(a, b)
    if a.level ~= b.level then return a.level > b.level end
    return a.name < b.name
  end)
  local results = {}
  for i, m in ipairs(cut(matches, maxResults)) do results[i] = baseResult(m.entry) end
  return results, #matches, itemType.name
end

-- ---------------------------------------------------------------------------------------------------
-- Config options (C-37c, D-425)
--
-- PoB's config options (Modules/ConfigOptions, one per key as BuildOps keeps them, in PoB's order) whose key or
-- label contains the query: each one's key, label, type, section, list values and labels, the conditions that
-- show it (its `if…` fields: ConfigTab shows it when every condition holds, and a condition holding a list holds
-- when any of its values does) and its tooltip's first line. Colour codes are stripped from the text. Exact key or
-- label matches first, then by key.

local function stripEscapes(text)
  return (tostring(text):gsub('%^x%x%x%x%x%x%x', ''):gsub('%^%d', ''))
end

-- ConfigOptions' `if…` fields, in this order; any other `if…` field after them, by name.
local CONDITION_KEYS = {
  'ifOption', 'ifCond', 'ifMinionCond', 'ifEnemyCond', 'ifMult', 'ifEnemyMult', 'ifStat', 'ifEnemyStat', 'ifFlag',
  'ifMod', 'ifSkill', 'ifSkillType', 'ifSkillFlag', 'ifSkillData', 'ifGemFamily', 'ifTagType', 'ifNode',
}

local function conditionValues(key, v)
  local list = type(v) == 'table' and v or { v }
  local out = {}
  for _, item in ipairs(list) do
    if key == 'ifSkillType' and type(item) == 'number' and SkillTypeName and SkillTypeName[item] then
      table.insert(out, SkillTypeName[item])
    else
      table.insert(out, tostring(item))
    end
  end
  return out
end

local function configConditions(varData)
  local out, seen = {}, {}
  local function add(key)
    if seen[key] or varData[key] == nil then return end
    seen[key] = true
    table.insert(out, { key = key, values = conditionValues(key, varData[key]) })
  end
  for _, key in ipairs(CONDITION_KEYS) do add(key) end
  for _, key in ipairs(sortedKeys(varData)) do
    if type(key) == 'string' and key:match('^if%u') then add(key) end
  end
  return out
end

local function configResult(option)
  local varData = option.varData or {}
  local result = {
    kind = 'config', id = option.var, name = option.var, label = option.label, type = option.type,
    section = option.section, conditions = configConditions(varData),
  }
  if type(option.list) == 'table' then
    result.list = {}
    for _, item in ipairs(option.list) do
      table.insert(result.list, { value = tostring(item.val), label = item.label and stripEscapes(item.label) or nil })
    end
  end
  if type(varData.tooltip) == 'string' then
    local first = stripEscapes(varData.tooltip):match('^%s*([^\n]*)')
    if first and first:match('%S') then result.tooltip = first:gsub('%s+$', '') end
  end
  return result
end

local function lookupConfig(needle, maxResults)
  local opts, err = BuildOps.config_options()
  if not opts then fail(err or 'config options not available') end
  local matches = {}
  for i, option in ipairs(opts.list) do
    local exact = option.var:lower() == needle or (option.label and option.label:lower() == needle)
    if exact or contains(option.var, needle) or contains(option.label, needle) then
      table.insert(matches, { name = option.var, id = string.format('%05d', i), exact = exact, option = option })
    end
  end
  table.sort(matches, function(a, b)
    if a.exact ~= b.exact then return a.exact end
    if a.name ~= b.name then return a.name < b.name end
    return a.id < b.id
  end)
  local results = {}
  for i, m in ipairs(cut(matches, maxResults)) do results[i] = configResult(m.option) end
  return results, #matches
end

-- ---------------------------------------------------------------------------------------------------
-- Constants (C-37d, D-425): Data/Misc.lua's game, character and monster constants, matched on their names.

local CONSTANT_TABLES = {
  { name = 'game', key = 'gameConstants' },
  { name = 'character', key = 'characterConstants' },
  { name = 'monster', key = 'monsterConstants' },
}

local function constantValue(v)
  if type(v) == 'number' then return string.format('%.14g', v) end
  return tostring(v)
end

local function collectConstantHits(hits, match)
  local d = gameData()
  for _, t in ipairs(CONSTANT_TABLES) do
    local constants = d[t.key]
    if type(constants) == 'table' then
      for _, name in ipairs(sortedKeys(constants)) do
        if match(tostring(name)) then
          table.insert(hits, {
            kind = 'constant', id = t.name, name = tostring(name), order = 1,
            source = t.name, line = tostring(name) .. ' = ' .. constantValue(constants[name]), table = t.name,
          })
        end
      end
    end
  end
end

local function addConstantNames(add)
  local d = gameData()
  for _, t in ipairs(CONSTANT_TABLES) do
    for _, name in ipairs(sortedKeys(d[t.key] or {})) do add(tostring(name), 'constant', t.name) end
  end
end

-- ---------------------------------------------------------------------------------------------------
-- Mechanics

local KIND_RANK = { gem = 1, unique = 2, passive = 3, mod = 4, essence = 5, base = 6, constant = 7 }

-- A mod table entry's text lines (its array part); a rune entry nests one mod per item class.
local function collectModHits(hits, tableName, entryId, entry, match)
  if type(entry) ~= 'table' then return end
  if type(entry[1]) == 'string' then
    local n = 0
    for _, line in ipairs(entry) do
      if type(line) == 'string' then
        n = n + 1
        local flat = oneLine(line)
        if match(flat) then
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
      collectModHits(hits, tableName, entryId .. ' (' .. tostring(sub) .. ')', entry[sub], match)
    end
  end
end

local KINDS_TEXT = 'gem, unique, passive, mod, essence, base or constant'

-- `match` is the query's matcher (M.matcher).
local function lookupMechanics(match, kind, maxResults, leaveOut)
  local d = gameData()
  local hits = {}

  -- Gems: the description, then every stat set's lines at the gem's default level, quality 0, each source
  -- naming the stat set's number as gem mode does (WU-53); then the quality and Gemling quality lines. A
  -- legacy gem's matching lines are left out and the gem named (D-384).
  for id, gem in pairs(d.gems) do
    if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect then
      local n = 0
      local legacy = isLegacyGem(gem)
      local function add(source, line)
        n = n + 1
        if match(line) then
          if legacy then leaveOut('gem', gem.name)
          else table.insert(hits, { kind = 'gem', id = id, name = gem.name, order = n, source = source, line = line }) end
        end
      end
      local ge = gem.grantedEffect
      if ge.description then add(gem.name, oneLine(ge.description)) end
      local level = M.defaultLevel(gem)
      for e, effect in ipairs(M.gemEffects(gem)) do
        local owner = e == 1 and gem.name or (gem.name .. ' / ' .. otherEffectName(effect, e - 1))
        for i, statSet in ipairs(effect.statSets or {}) do
          local label = statSetLabel(effect, statSet, i)
          local lines = M.describeStatSet(effect, statSet, level, 0)
          for _, line in ipairs(lines) do add(string.format('%s (stat set %d: %s)', owner, i, label), line) end
        end
      end
      for _, line in ipairs((gemQualityLines(gem, 'qualityStats'))) do add(gem.name .. ' (quality)', line) end
      for _, line in ipairs((gemQualityLines(gem, 'altQualityStats'))) do add(gem.name .. ' (Gemling quality)', line) end
    end
  end

  -- Uniques: every variant's mod lines; a line the selected variant lacks names its variants. A unique no
  -- longer obtainable is left out and named (D-384).
  for key, item in pairs(uniqueList()) do
    local name = item.title or item.name or key
    local unobtainable = isUnobtainable(item)
    for n, entry in ipairs(uniqueModLines(item)) do
      if match(entry.line) and unobtainable then
        leaveOut('unique', name)
      elseif match(entry.line) then
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
          if match(line) then
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
        collectModHits(hits, tableName, tostring(entryId), mods[entryId], match)
      end
    end
  end

  -- Essences: every essence's mod lines, or all of them when its name matches (WU-60).
  collectEssenceHits(hits, match)

  -- Bases: every base's implicit lines, or all of them when its name matches (WU-53).
  collectBaseHits(hits, match)

  -- Constants: Data/Misc.lua's game, character and monster constants whose name matches (C-37d), ranked last.
  collectConstantHits(hits, match)

  table.sort(hits, function(a, b)
    if a.kind ~= b.kind then return KIND_RANK[a.kind] < KIND_RANK[b.kind] end
    if a.name ~= b.name then return a.name < b.name end
    if a.id ~= b.id then return a.id < b.id end
    return a.order < b.order
  end)
  -- Every kind's hit count, then (with `kind`) only that kind's hits are listed and cut.
  local kinds = { gem = 0, unique = 0, passive = 0, mod = 0, essence = 0, base = 0, constant = 0 }
  local listed = {}
  for _, hit in ipairs(hits) do
    kinds[hit.kind] = kinds[hit.kind] + 1
    if not kind or hit.kind == kind then table.insert(listed, hit) end
  end
  local results = cut(listed, maxResults)
  for _, hit in ipairs(results) do
    hit.order = nil
    if hit.kind == 'passive' then hit.id = tostring(hit.nodeId) end
    if hit.kind == 'mod' then hit.baseTypes, hit.notRolled = M.modBaseTypes(hit.mod, hit.table) end
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
    if type(gem) == 'table' and type(gem.name) == 'string' and gem.grantedEffect and not isLegacyGem(gem) then
      add(gem.name, asKind or (isSupportGem(gem) and 'support' or 'active'))
    end
  end
end

local function addUniqueNames(add, itemType)
  for key, item in pairs(uniqueList()) do
    if (not itemType or item.type == itemType) and not isUnobtainable(item) then
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
  elseif mode == 'base' then
    -- C-37b: the names of the bases of the item type searched.
    for _, list in ipairs(resolveBaseType(filter).lists) do
      for _, entry in ipairs(list.bases) do add(entry.name, 'base', entry.base.type) end
    end
  elseif mode == 'config' then
    -- C-37c: the config option keys, each labelled with its label.
    local opts = BuildOps.config_options()
    for _, option in ipairs(opts and opts.list or {}) do add(option.var, 'config', option.label) end
  else
    if not kind or kind == 'gem' then addGemNames(add, 'gem') end
    if not kind or kind == 'unique' then addUniqueNames(add) end
    if not kind or kind == 'passive' then addPassiveNames(add) end
    if not kind or kind == 'mod' then addModNames(add) end
    if not kind or kind == 'essence' then addEssenceNames(add) end
    if not kind or kind == 'base' then addBaseNames(add) end
    if not kind or kind == 'constant' then addConstantNames(add) end
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

local MODES = { gem = true, unique = true, mechanic = true, base = true, config = true }

local function trimmed(v)
  if type(v) ~= 'string' then return nil end
  local s = v:match('^%s*(.-)%s*$')
  return s ~= '' and s or nil
end

function M.lookup_game_data(params)
  local mode = params.mode
  if type(mode) ~= 'string' or not MODES[mode] then
    fail('unknown mode "' .. tostring(mode) .. '"; use gem, unique, mechanic, base or config')
  end
  local query = trimmed(params.query)
  local needle = query and query:lower() or nil
  local maxResults = math.floor(tonumber(params.maxResults) or DEFAULT_MAX_RESULTS)
  if maxResults < 1 then maxResults = 1 end

  local results, total, kinds, filter
  local leaveOut, leftOut = leftOutList()
  if mode == 'gem' then
    if not needle then fail('gem mode needs a query') end
    local level = params.level ~= nil and math.floor(tonumber(params.level) or -1) or nil
    local quality = math.floor(tonumber(params.quality) or 0)
    if quality < 0 or quality > 20 then fail('gem_quality must be 0-20') end
    results, total = lookupGems(needle, level, quality, maxResults, leaveOut)
  elseif mode == 'unique' then
    local slot = trimmed(params.slot)
    if not needle and not slot then fail('unique mode needs a query, a slot or both') end
    results, total = lookupUniques(needle, slot, maxResults, leaveOut)
    filter = slot and resolveSlot(slot) or nil
  elseif mode == 'base' then
    -- C-37b: `slot` (PoB's item type) is required; `maxLevel` keeps bases whose required level is at most it.
    local slot = trimmed(params.slot)
    if not slot then fail('base mode needs a slot (an item type)') end
    local maxLevel = params.maxLevel ~= nil and math.floor(tonumber(params.maxLevel) or -1) or nil
    results, total, filter = lookupBases(needle, slot, maxLevel, maxResults)
  elseif mode == 'config' then
    if not needle then fail('config mode needs a query') end
    results, total = lookupConfig(needle, maxResults)
  else
    local match = needle and M.matcher(needle) or nil
    if not match then fail('mechanic mode needs a query') end
    local kind = trimmed(params.kind)
    if kind then
      kind = kind:lower()
      if not KIND_RANK[kind] then fail('unknown kind "' .. tostring(params.kind) .. '"; use ' .. KINDS_TEXT) end
    end
    results, total, kinds = lookupMechanics(match, kind, maxResults, leaveOut)
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
    suggestions = suggestions, suggestionsSkipped = suggestionsSkipped, leftOut = leftOut(),
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
