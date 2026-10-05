-- API/Trade.lua
-- Lua trade actions (C-13): PoB2's own weighted-query generator and result evaluator, driven headless.
--
--   trade_generate_query  slot + dialog options -> PoB's weighted trade query, the full ranked weights
--                         (an optional reportStats list is checked as trade_evaluate_items would, first)
--   trade_evaluate_items  slot + sanitized /fetch entries -> per-item score, stat deltas, item text
--   trade_query_options   slot -> what PoB's trade dialog offers for that slot
--
-- Registered by one line in Handlers.lua. Ported from spike S-1's TradeShim.lua, with its corrections:
-- mirrored items are included by default, the build's saved weights are the default, the generator's
-- weights are put in a canonical order before FinishQuery (D-55), `baselineScore` is the score PoB's
-- item path gives the unchanged build (D-57), the `*TakenHit` sort stats are refused (D-57), every item
-- is evaluated in its own pcall (D-56), the cached PoB instances are re-bound after a load, unsupported
-- slots fail with the supported list (D-38), and jewel slots need a jewel type.
--
-- Rules (C-13): replies hold only numbers, strings, booleans and tables of them; nothing writes a file,
-- and none of PullPoENinjaCurrencyConversion / PriceItem / PullLeagueList / FetchLeagues is called;
-- `#main.popups` is the same after each action as before it.

local dkjson = require('dkjson')
local Util = require('API.Util')

local construct = Util.construct
local NULL = dkjson.null

local M = {}

-- ---------------------------------------------------------------------------------------------------
-- Constants (mirroring PoB's trade dialog on the pinned tag)

-- PoB's currencyTable (TradeQueryGenerator.lua:755-767); a nil id is "Exalted Orb Equivalent".
local CURRENCIES = {
  { id = nil, label = 'Exalted Orb Equivalent' },
  { id = 'exalted', label = 'Exalted Orb' },
  { id = 'chaos', label = 'Chaos Orb' },
  { id = 'divine', label = 'Divine Orb' },
  { id = 'aug', label = 'Orb of Augmentation' },
  { id = 'transmute', label = 'Orb of Transmutation' },
  { id = 'regal', label = 'Regal Orb' },
  { id = 'vaal', label = 'Vaal Orb' },
  { id = 'annul', label = 'Orb of Annulment' },
  { id = 'alch', label = 'Orb of Alchemy' },
  { id = 'mirror', label = 'Mirror of Kalandra' },
}
local CURRENCY_IDS = {}
for _, c in ipairs(CURRENCIES) do
  if c.id then CURRENCY_IDS[c.id] = true end
end

-- The trade types (TradeQueryGenerator.lua:954-960) and the trader pane's labels (TradeQuery.lua:298-304),
-- in PoB's order: the index is the generator's tradeTypeIndex.
local STATUSES = {
  { id = 'securable', label = 'Instant buyout' },
  { id = 'available', label = 'Instant buyout and in person' },
  { id = 'onlineleague', label = 'In person (online in league)' },
  { id = 'online', label = 'In person (online)' },
  { id = 'any', label = 'Any (includes offline)' },
}
local STATUS_INDEX = {}
for i, s in ipairs(STATUSES) do STATUS_INDEX[s.id] = i end

-- PoB's default sort weights when the build has none saved (TradeQuery.lua:179-190).
local DEFAULT_WEIGHTS = {
  { stat = 'FullDPS', weight = 1.0 },
  { stat = 'TotalEHP', weight = 0.5 },
}

local BEHAVIOURS = { copy = true, keep = true, remove = true }
local JEWEL_TYPES = { Base = true, Radius = true }
local MAX_REQUIRED_MODS = 3

-- The slots PoB's generator supports (D-38), for error messages.
local SUPPORTED_SLOTS_TEXT = 'Weapon 1, Weapon 1 Swap, Weapon 2, Weapon 2 Swap, Helmet, Body Armour, Gloves, '
  .. 'Boots, Amulet, Ring 1, Ring 2, Ring 3, Belt, Flask 1, Flask 2, '
  .. 'the gear jewel sockets "<Helmet|Body Armour|Gloves|Boots|Belt|Ring 1|Ring 2|Ring 3> Jewel Socket <1-6>" '
  .. '(not weapon jewel sockets), and the tree jewel sockets "Jewel <nodeId>"'

-- ---------------------------------------------------------------------------------------------------
-- Helpers

-- A monotonic clock in milliseconds (wall time, so a generation's `ms` is what the caller waits).
local nowMs
do
  local ok_ffi, ffi = pcall(require, 'ffi')
  local ok_def = ok_ffi and pcall(ffi.cdef, [[
    typedef struct { long tv_sec; long tv_nsec; } pob2mcp_trade_timespec;
    int pob2mcp_trade_clock_gettime(int, pob2mcp_trade_timespec *) asm("clock_gettime");
  ]])
  if ok_def then
    local ts = ffi.new('pob2mcp_trade_timespec')
    nowMs = function()
      ffi.C.pob2mcp_trade_clock_gettime(1, ts) -- CLOCK_MONOTONIC
      return tonumber(ts.tv_sec) * 1000 + tonumber(ts.tv_nsec) / 1e6
    end
  else
    nowMs = function() return os.clock() * 1000 end
  end
end

-- A failure the handler reports as `{ok=false, error=msg}` (code FAILED).
local Failure = {}
local function fail(msg)
  error(setmetatable({ msg = msg }, Failure), 0)
end

local function isTakenHit(stat)
  return type(stat) == 'string' and stat:match('TakenHit$') ~= nil
end

local function isArray(v)
  if type(v) ~= 'table' then return false end
  for k in pairs(v) do
    if type(k) ~= 'number' then return false end
  end
  return true
end

-- The highest integer key of a decoded JSON array (a JSON null leaves a hole; we iterate past it).
local function arrayLength(t)
  local n = 0
  for k in pairs(t) do
    if type(k) == 'number' and k > n and k == math.floor(k) then n = k end
  end
  return n
end

local function isFiniteNumber(v)
  return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge
end

local function optional(v)
  if v == nil or v == NULL then return nil end
  return v
end

local function ensureBuild()
  if not _G.build or not build.itemsTab or not build.calcsTab then fail('no build loaded') end
end

-- The sort stats PoB's weight dialog offers (TradeQuery.lua:636-648), minus the *TakenHit stats (D-57):
-- an ordered list and a map by stat.
local selectableCache
local function selectableStats()
  if not selectableCache then
    local list, byStat = {}, {}
    for _, entry in ipairs(data.powerStatList) do
      if entry.stat and not entry.ignoreForItems and entry.label ~= 'Name' and not isTakenHit(entry.stat)
          and not byStat[entry.stat] then
        list[#list + 1] = entry
        byStat[entry.stat] = entry
      end
    end
    selectableCache = { list = list, byStat = byStat }
  end
  return selectableCache
end

-- The build's saved <TradeSearchWeights> (ItemsTab.lua:1168-1185), minus what can't be searched by:
-- [{stat, weight}] or nil when there are none.
local function savedWeights()
  local tq = build.itemsTab.tradeQuery
  local list = tq and tq.statSortSelectionList
  if type(list) ~= 'table' then return nil end
  local byStat = selectableStats().byStat
  local out = {}
  for _, entry in ipairs(list) do
    if byStat[entry.stat] and isFiniteNumber(entry.weightMult) and entry.weightMult > 0 then
      out[#out + 1] = { stat = entry.stat, weight = entry.weightMult }
    end
  end
  if #out == 0 then return nil end
  return out
end

-- [{stat, weight}] (or nil = the build's saved weights, else PoB's default) -> PoB's statWeights entries.
local function resolveWeights(list, field)
  field = field or 'statWeights'
  list = optional(list)
  if list ~= nil and not isArray(list) then fail(field .. ' must be an array of {stat, weight}') end
  if list == nil or #list == 0 then list = savedWeights() or DEFAULT_WEIGHTS end
  local byStat = selectableStats().byStat
  local out, seen = {}, {}
  for i = 1, arrayLength(list) do
    local req = list[i]
    if type(req) ~= 'table' or type(req.stat) ~= 'string' then
      fail(field .. '[' .. i .. '] must be {stat: string, weight: number}')
    end
    if isTakenHit(req.stat) then
      fail('stat ' .. req.stat .. ' is not supported for upgrade search')
    end
    local entry = byStat[req.stat]
    if not entry then fail('unknown stat ' .. req.stat .. ' (not one of PoB\'s sort stats)') end
    if seen[req.stat] then fail('stat ' .. req.stat .. ' is listed twice') end
    seen[req.stat] = true
    if not isFiniteNumber(req.weight) or req.weight <= 0 then
      fail('the weight of stat ' .. req.stat .. ' must be a positive number')
    end
    out[#out + 1] = { stat = entry.stat, label = entry.label, transform = entry.transform, weightMult = req.weight }
  end
  return out
end

local function weightsReply(weights)
  local out = {}
  for i, w in ipairs(weights) do out[i] = { stat = w.stat, label = w.label, weight = w.weightMult } end
  return out
end

local tradeHelpersModule
local function tradeHelpers()
  if not tradeHelpersModule then tradeHelpersModule = LoadModule('Classes/TradeHelpers') end
  return tradeHelpersModule
end

local function isJewelSlot(slotName)
  return slotName:find('Jewel') ~= nil
end

-- Which of the dialog's options PoB shows for a slot (TradeQueryGenerator.lua:1105-1225).
local function slotShows(slotName)
  local jewel = isJewelSlot(slotName)
  local function has(s) return slotName:find(s, 1, true) ~= nil end
  return {
    sockets = not jewel and not has('Flask') and not has('Belt') and not has('Ring') and not has('Amulet')
      and not has('Charm'),
    runeBehaviour = has('Weapon 1') or has('Weapon 2') or has('Helmet') or has('Body Armour') or has('Gloves')
      or has('Boots'),
    anointBehaviour = has('Amulet'),
    jewelType = jewel,
  }
end

-- Is `slotName` a slot PoB can generate a weighted query for (D-38)? Returns the slot control and the
-- item equipped in it, or nil and the reason.
local function checkSlot(slotName)
  if type(slotName) ~= 'string' or slotName == '' then
    return nil, nil, 'slot is required; supported: ' .. SUPPORTED_SLOTS_TEXT
  end
  local slot = build.itemsTab.slots[slotName]
  if not slot then
    return nil, nil, 'unknown slot ' .. slotName .. '; supported: ' .. SUPPORTED_SLOTS_TEXT
  end
  local item = slot.selItemId and build.itemsTab.items[slot.selItemId] or nil
  local unsupported = slotName:match('^Charm') or slotName:match('^Arm %d') or slotName:match('^Leg %d')
    or (slotName:match('^Weapon %d') and isJewelSlot(slotName))
  if not unsupported then
    local _, category = tradeHelpers().getTradeCategory(slotName, item)
    unsupported = category == nil
  end
  if unsupported then
    return nil, nil, 'slot ' .. slotName .. ' is not supported for weighted trade search; supported: '
      .. SUPPORTED_SLOTS_TEXT
  end
  return slot, item
end

local function requireSlot(slotName)
  local slot, item, err = checkSlot(slotName)
  if not slot then fail(err) end
  return slot, item
end

local function checkJewelType(slotName, jewelType)
  jewelType = optional(jewelType)
  if not isJewelSlot(slotName) then return nil end
  if jewelType == nil then fail('jewel_type is required for jewel slots') end
  if not JEWEL_TYPES[jewelType] then fail('jewelType must be "Base" or "Radius"') end
  return jewelType
end

local function checkBehaviour(value, field)
  value = optional(value)
  if value == nil then return 'copy' end
  if not BEHAVIOURS[value] then fail(field .. ' must be "copy", "keep" or "remove"') end
  return value
end

local function optionalNumber(v, field, integer)
  v = optional(v)
  if v == nil then return nil end
  if not isFiniteNumber(v) or (integer and v ~= math.floor(v)) then
    fail(field .. ' must be ' .. (integer and 'an integer' or 'a number'))
  end
  return v
end

local function optionalBoolean(v, field)
  v = optional(v)
  if v == nil then return nil end
  if type(v) ~= 'boolean' then fail(field .. ' must be a boolean') end
  return v
end

-- ---------------------------------------------------------------------------------------------------
-- Cached PoB instances, re-bound when `build.itemsTab` changes (every load recreates the tabs).

local generator
local function getGenerator()
  local itemsTab = build.itemsTab
  if not generator then
    -- The generator reads only queryTab.itemsTab (TradeQueryGenerator.lua:114-122); InitMods loads the
    -- shipped Data/QueryMods.lua once.
    generator = construct('TradeQueryGenerator', { itemsTab = itemsTab })
  end
  if generator.itemsTab ~= itemsTab then
    generator.queryTab = { itemsTab = itemsTab }
    generator.itemsTab = itemsTab
  end
  return generator
end

local tradeQuery
local function getTradeQuery()
  local itemsTab = build.itemsTab
  if not tradeQuery or tradeQuery.itemsTab ~= itemsTab then
    -- Not build.itemsTab.tradeQuery: its statSortSelectionList is what the build saves.
    tradeQuery = construct('TradeQuery', itemsTab)
  end
  tradeQuery.tradeQueryGenerator = getGenerator()
  return tradeQuery
end

local fetchParser
local function getFetchParser()
  if not fetchParser then fetchParser = construct('TradeQueryRequests') end
  return fetchParser
end

-- baselineScore (D-57): the score PoB's item path gives the unchanged build.
local function baselineScore(tq, weights, baseOutput)
  tq.statSortSelectionList = weights
  return tq.tradeQueryGenerator.WeightedRatioOutputs(baseOutput, tq:ReduceOutput(baseOutput), weights)
end

-- The report stats: the weighted stats, then each requested stat not already there. A requested stat is
-- one of PoB's sort stats, or a numeric key of the build's output. A bad entry fails naming its index:
-- `reportStats[<i>]: ...` (find_upgrades maps it to its report_stats input field).
local function reportStatList(weights, requested, baseOutput)
  local list, seen = {}, {}
  for _, w in ipairs(weights) do
    if not seen[w.stat] then
      seen[w.stat] = true
      list[#list + 1] = w
    end
  end
  requested = optional(requested)
  if requested == nil then return list end
  if not isArray(requested) then fail('reportStats must be an array of stat names') end
  local byStat = selectableStats().byStat
  for i = 1, arrayLength(requested) do
    local name = requested[i]
    if type(name) ~= 'string' then fail('reportStats[' .. i .. ']: must be a string') end
    if not seen[name] then
      seen[name] = true
      if byStat[name] then
        list[#list + 1] = byStat[name]
      elseif type(baseOutput[name]) == 'number' then
        list[#list + 1] = { stat = name, label = name }
      else
        fail('reportStats[' .. i .. ']: unknown report stat ' .. name
          .. ' (not one of PoB\'s sort stats or a numeric stat of the build\'s output)')
      end
    end
  end
  return list
end

-- ---------------------------------------------------------------------------------------------------
-- trade_generate_query

local function weightOrder(a, b)
  if a.meanStatDiff ~= b.meanStatDiff then return a.meanStatDiff > b.meanStatDiff end
  local wa, wb = math.abs(a.weight), math.abs(b.weight)
  if wa ~= wb then return wa > wb end
  return a.tradeModId < b.tradeModId
end

function M.generate_query(params)
  ensureBuild()
  local slotName = params.slot
  local slot, existingItem = requireSlot(slotName)
  local jewelType = checkJewelType(slotName, params.jewelType)
  local weights = resolveWeights(params.statWeights)
  local shows = slotShows(slotName)

  local requiredMods
  local rawMods = optional(params.requiredMods)
  if rawMods ~= nil then
    if not isArray(rawMods) then fail('requiredMods must be an array of {tradeId, min}') end
    if arrayLength(rawMods) > MAX_REQUIRED_MODS then
      fail('at most ' .. MAX_REQUIRED_MODS .. ' requiredMods are allowed')
    end
    for i = 1, arrayLength(rawMods) do
      local rm = rawMods[i]
      if type(rm) ~= 'table' or type(rm.tradeId) ~= 'string' or rm.tradeId == '' or not isFiniteNumber(rm.min) then
        fail('requiredMods[' .. i .. '] must be {tradeId: string, min: number}')
      end
      requiredMods = requiredMods or {}
      requiredMods[#requiredMods + 1] = { tradeId = rm.tradeId, value = rm.min }
    end
  end

  local maxPrice = optionalNumber(params.maxPrice, 'maxPrice')
  local currency = optional(params.currency)
  if currency ~= nil and not CURRENCY_IDS[currency] then
    fail('currency must be null (Exalted Orb Equivalent) or one of exalted, chaos, divine, aug, transmute, '
      .. 'regal, vaal, annul, alch, mirror')
  end
  local maxLevel = optionalNumber(params.maxLevel, 'maxLevel', true)
  local sockets = optionalNumber(params.sockets, 'sockets', true)
  local includeCorrupted = optionalBoolean(params.includeCorrupted, 'includeCorrupted')
  if includeCorrupted == nil then
    -- PoB's dialog: on, unless the slot's current item is already corrupted (:1113-1115).
    includeCorrupted = not (existingItem and existingItem.corrupted)
  end
  local includeMirrored = optionalBoolean(params.includeMirrored, 'includeMirrored')
  if includeMirrored == nil then includeMirrored = true end -- PoB's dialog default (:1121-1122)
  local runeBehaviour = checkBehaviour(params.runeBehaviour, 'runeBehaviour')
  local status = optional(params.status) or 'securable'
  if not STATUS_INDEX[status] then
    fail('status must be one of securable, available, onlineleague, online, any')
  end

  local t0 = nowMs()
  build.calcsTab:BuildOutput()

  -- Additive (C-13): the report stats a later trade_evaluate_items will be asked for, checked now with
  -- the same rule, so a bad name fails before the caller sends any trade request.
  if optional(params.reportStats) ~= nil then
    local _, checkOutput = build.calcsTab:GetMiscCalculator()
    reportStatList(weights, params.reportStats, checkOutput)
  end

  local gen = getGenerator()

  -- The dialog's sticky "last*" values override the options in StartQuery (:770-778).
  gen.lastMaxPrice, gen.lastMaxPriceTypeIndex, gen.lastMaxLevel = nil, nil, nil
  gen.tradeTypeIndex = STATUS_INDEX[status]
  local options = {
    statWeights = weights,
    includeCorrupted = includeCorrupted,
    includeMirrored = includeMirrored,
    -- Only "Keep" weights runes, and only where the dialog shows the rune behaviour (:1126-1142, :1272).
    includeRunes = shows.runeBehaviour and runeBehaviour == 'keep',
    maxPrice = maxPrice,
    maxPriceType = currency,
    maxLevel = maxLevel,
    sockets = sockets,
    jewelType = jewelType,
    requiredMods = requiredMods,
    -- options.account is never set: it crashes FinishQuery (:1001-1003).
  }

  local result
  gen.requesterContext = {}
  gen.requesterCallback = function(_, queryJson, errMsg) result = { queryJson = queryJson, err = errMsg } end
  gen.calcContext = {}
  gen:StartQuery(slot, options)
  local co = gen.calcContext.co
  if not co then
    fail('slot ' .. slotName .. ' is not supported for weighted trade search; supported: ' .. SUPPORTED_SLOTS_TEXT)
  end

  -- Count engine evaluations by wrapping the calculator the generator captured.
  local calcCount = 0
  local calcFunc = gen.calcContext.calcFunc
  gen.calcContext.calcFunc = function(...)
    calcCount = calcCount + 1
    return calcFunc(...)
  end

  -- Drive the coroutine directly: OnFrame swallows its errors outside devMode and would then build a
  -- query from partial weights (:740-753). Headless GetTime() is constant, so it never yields.
  while coroutine.status(co) ~= 'dead' do
    local ok, err = coroutine.resume(co, gen)
    if not ok then
      gen.calcContext.co = nil
      fail('PoB\'s query generator failed: ' .. tostring(err))
    end
  end
  gen.calcContext.co = nil

  -- D-55: a canonical order before FinishQuery (PoB's own sort is unstable over pairs-ordered input,
  -- and the pinned LuaJIT randomizes string hashes per process). FinishQuery re-sorts this input with
  -- its own comparator, which is deterministic for a deterministic input.
  table.sort(gen.modWeights, weightOrder)
  local rankedWeights = {}
  for i, w in ipairs(gen.modWeights) do
    rankedWeights[i] = { tradeId = w.tradeModId, weight = w.weight, meanStatDiff = w.meanStatDiff }
  end
  local itemCategory = gen.calcContext.itemCategoryQueryStr

  gen:FinishQuery()
  if not result then fail('PoB\'s query generator produced no query for ' .. slotName) end
  if result.err then fail('PoB found no mods to search for in ' .. slotName) end
  local query = dkjson.decode(result.queryJson)
  if type(query) ~= 'table' then fail('PoB\'s query generator produced an unreadable query') end

  local _, baseOutput = build.calcsTab:GetMiscCalculator()
  local baseline = baselineScore(getTradeQuery(), weights, baseOutput)

  local minWeight = query.query and query.query.stats and query.query.stats[1] and query.query.stats[1].value
    and query.query.stats[1].value.min
  return {
    query = query,
    rankedWeights = rankedWeights,
    minWeight = minWeight,
    itemCategory = itemCategory,
    statWeights = weightsReply(weights),
    baselineScore = baseline,
    meta = { calcCount = calcCount, ms = nowMs() - t0 },
  }
end

-- ---------------------------------------------------------------------------------------------------
-- trade_evaluate_items

-- One /fetch result entry -> PoB's parsed entry ({item_string, ...}), through PoB's own parser: the
-- FetchResultBlock callback (TradeQueryRequests.lua:273-450), fed a one-entry response.
local function parseFetchEntry(entry)
  if type(entry.itemText) == 'string' then
    -- Additive form: an entry may carry PoB item text instead of trade JSON.
    return { item_string = entry.itemText, id = entry.id }
  end
  local parser = getFetchParser()
  local parsed, perr
  parser:FetchResultBlock('headless://', function(items, errMsg) parsed, perr = items, errMsg end)
  local queued = table.remove(parser.requestQueue.fetch)
  queued.callback(dkjson.encode({ result = { entry } }), nil)
  if perr then error(perr, 0) end
  if type(parsed) ~= 'table' or type(parsed[1]) ~= 'table' then error('the entry did not parse', 0) end
  return parsed[1]
end

local function statDelta(baseOutput, newOutput, st)
  local b = data.powerStatList.GetFromOutput(baseOutput, st)
  local n = data.powerStatList.GetFromOutput(newOutput, st)
  local pct = NULL
  if b ~= 0 then pct = (n - b) / math.abs(b) * 100 end
  return { base = b, new = n, delta = n - b, pct = pct }
end

function M.evaluate_items(params)
  ensureBuild()
  local slotName = params.slot
  requireSlot(slotName)
  local items = optional(params.items)
  if not isArray(items) then fail('items must be an array of trade fetch results') end
  local weights = resolveWeights(params.statWeights)
  local shows = slotShows(slotName)
  local runeBehaviour = checkBehaviour(params.runeBehaviour, 'runeBehaviour')
  local anointBehaviour = checkBehaviour(params.anointBehaviour, 'anointBehaviour')
  -- Only the behaviours the dialog shows for this slot apply (PoB would reuse a stale dialog value).
  if not shows.runeBehaviour then runeBehaviour = nil end
  if not shows.anointBehaviour then anointBehaviour = nil end

  build.calcsTab:BuildOutput()
  local itemsTab = build.itemsTab
  local tq = getTradeQuery()
  local calcFunc, baseOutput = build.calcsTab:GetMiscCalculator()
  local baseline = baselineScore(tq, weights, baseOutput)
  local reportStats = reportStatList(weights, params.reportStats, baseOutput)

  local function evaluateOne(entry)
    if type(entry) ~= 'table' then error('the entry is not an object', 0) end
    local e = parseFetchEntry(entry)

    -- PoB keeps only items that parse and fit the slot (FilterToSafeItems, TradeQuery.lua:985-994).
    if #tq:FilterToSafeItems({ e }, slotName) == 0 then
      local probe = construct('Item', e.item_string)
      if not probe.base then error('PoB could not parse the item', 0) end
      error('the item does not fit slot ' .. slotName, 0)
    end

    -- Rune and anoint handling, as the "Find best" callback does it (TradeQuery.lua:1040-1068).
    if runeBehaviour == 'copy' or anointBehaviour == 'copy' then
      local item = construct('Item', e.item_string)
      if item.base and item.type then
        itemsTab:CopyAnointsAndAugments(item, true, true, slotName)
        e.item_string = item:BuildRaw()
      end
    elseif runeBehaviour == 'remove' then
      local item = construct('Item', e.item_string)
      local validRunes = itemsTab:GetValidRunesForItem(item)
      for i in ipairs(item.runes or {}) do
        if not itemsTab:IsSocketBoundRune(item, item.runes[i], validRunes) then item.runes[i] = 'None' end
      end
      item:UpdateRunes()
      e.item_string = item:BuildRaw()
    elseif anointBehaviour == 'remove' then
      local item = construct('Item', e.item_string)
      item.enchantModLines = {}
      e.item_string = item:BuildRaw()
    end

    -- TradeQuery:GetResultEvaluation's steps (:829-833), keeping the full output for the report stats.
    local output = calcFunc({ repSlotName = slotName, repItem = construct('Item', e.item_string) })
    local score = tq.tradeQueryGenerator.WeightedRatioOutputs(baseOutput, tq:ReduceOutput(output), weights)
    local stats = {}
    for _, st in ipairs(reportStats) do stats[st.stat] = statDelta(baseOutput, output, st) end
    local id = entry.id
    if type(id) ~= 'string' then id = e.id end
    return { id = type(id) == 'string' and id or NULL, score = score, stats = stats, itemText = e.item_string }
  end

  local scored, rejected = {}, {}
  for i = 1, arrayLength(items) do
    local entry = items[i]
    local ok, res = pcall(evaluateOne, entry)
    if ok then
      scored[#scored + 1] = res
    else
      local id = type(entry) == 'table' and type(entry.id) == 'string' and entry.id or ('#' .. i)
      rejected[#rejected + 1] = { id = id, reason = tostring(res) }
    end
  end
  return { baselineScore = baseline, rejected = rejected, items = scored }
end

-- ---------------------------------------------------------------------------------------------------
-- trade_query_options

local KIND_ORDER = { explicit = 1, implicit = 2, corrupted = 3 }

function M.query_options(params)
  ensureBuild()
  local slotName = params.slot
  local slot, item, err = checkSlot(slotName)
  local selectable = selectableStats().list
  local sortStats = {}
  for i, entry in ipairs(selectable) do sortStats[i] = { stat = entry.stat, label = entry.label } end
  local currencies = {}
  for i, c in ipairs(CURRENCIES) do currencies[i] = { id = c.id or NULL, label = c.label } end
  local statuses = {}
  for i, s in ipairs(STATUSES) do statuses[i] = { id = s.id, label = s.label } end
  local defaults = {}
  for i, w in ipairs(DEFAULT_WEIGHTS) do defaults[i] = { stat = w.stat, weight = w.weight } end

  local reply = {
    slot = type(slotName) == 'string' and slotName or NULL,
    supported = slot ~= nil,
    sortStats = sortStats,
    defaultWeights = defaults,
    savedWeights = savedWeights() or NULL,
    requiredModChoices = {},
    currencies = currencies,
    statuses = statuses,
    shows = type(slotName) == 'string' and slotShows(slotName)
      or { sockets = false, runeBehaviour = false, anointBehaviour = false, jewelType = false },
  }
  if not slot then
    reply.reason = err
    return reply
  end

  -- The "+ Add Required Stat" choices (getModList, TradeQueryGenerator.lua:1341-1362): the slot
  -- category's Explicit, Implicit and Corrupted entries. A jewel slot lists the "Base" jewel type's,
  -- the dialog's default.
  local queryStr, category = tradeHelpers().getTradeCategory(slotName, item)
  reply.itemCategory = queryStr
  if isJewelSlot(slotName) then category = 'Base' .. category end
  local gen = getGenerator()
  local choices = {}
  for _, modType in ipairs({ 'Explicit', 'Implicit', 'Corrupted' }) do
    for _, modData in pairs(gen.modData[modType] or {}) do
      if modData[category] ~= nil and modData.tradeMod and type(modData.tradeMod.id) == 'string' then
        choices[#choices + 1] = {
          tradeId = modData.tradeMod.id,
          text = (tostring(modData.tradeMod.text):gsub('(%a+) Passive Skills in Radius also grant ', '%1: ')),
          kind = modType:lower(),
        }
      end
    end
  end
  table.sort(choices, function(a, b)
    if a.tradeId ~= b.tradeId then return a.tradeId < b.tradeId end
    return KIND_ORDER[a.kind] < KIND_ORDER[b.kind]
  end)
  reply.requiredModChoices = choices
  return reply
end

-- ---------------------------------------------------------------------------------------------------
-- Handlers

-- Runs `fn(params)`: a `fail()` becomes `{ok=false, error}`, any other error propagates (EXCEPTION).
-- Either way, popups an action left open are closed, so `#main.popups` is unchanged.
local function handler(fn)
  return function(params)
    local popups = _G.main and main.popups and #main.popups or 0
    local ok, res = pcall(fn, params or {})
    if _G.main and main.popups then
      while #main.popups > popups do main:ClosePopup() end
    end
    if ok then return { ok = true, result = res } end
    if type(res) == 'table' and getmetatable(res) == Failure then return { ok = false, error = res.msg } end
    error(res, 0)
  end
end

M.handlers = {
  trade_generate_query = handler(M.generate_query),
  trade_evaluate_items = handler(M.evaluate_items),
  trade_query_options = handler(M.query_options),
}

return M
