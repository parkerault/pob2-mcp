-- S-1 prototype: headless driver for PoB2's TradeQueryGenerator + TradeQuery result evaluation.
-- Intended shape of a future pob-api/API/Trade.lua. Runs against an UNMODIFIED PoB2 v0.23.1 src/.
-- Requires: PoB booted (HeadlessWrapper), a build loaded (global `build`).
local dkjson = require "dkjson"
local ffi = require "ffi"
ffi.cdef [[ typedef struct { long tv_sec; long tv_nsec; } s1_timespec; int s1_clock_gettime(int, s1_timespec*) asm("clock_gettime"); ]]
local function nowMs()
  local t = ffi.new("s1_timespec"); ffi.C.s1_clock_gettime(1, t)
  return tonumber(t.tv_sec) * 1000 + tonumber(t.tv_nsec) / 1e6
end

local M = { nowMs = nowMs }

-- currencyTable ids from TradeQueryGenerator.lua:755-767 (nil id = "Exalted Orb Equivalent")
local CURRENCIES = { exalted = true, chaos = true, divine = true, aug = true, transmute = true, regal = true,
  vaal = true, annul = true, alch = true, mirror = true }
-- self.tradeTypes in TradeQueryGenerator.lua:954-960
local STATUS = { securable = 1, available = 2, onlineleague = 3, online = 4, any = 5 }

-- Resolve [{stat=..., weight=...}] against data.powerStatList so label/transform match the UI
-- (TradeQuery.lua:636-648 builds the same entries for TradeStatWeightMultiplierListControl).
function M.resolveStatWeights(list)
  local out = {}
  for _, req in ipairs(list or {}) do
    local found
    for _, ps in ipairs(data.powerStatList) do
      if ps.stat == req.stat and not ps.ignoreForItems then found = ps break end
    end
    if not found then error("unknown stat '" .. tostring(req.stat) .. "' (must be a data.powerStatList stat)") end
    table.insert(out, { stat = found.stat, label = found.label, transform = found.transform,
      weightMult = req.weight or req.weightMult or 1 })
  end
  if #out == 0 then -- PoB default (TradeQuery.lua:179-190)
    out = { { stat = "FullDPS", label = "Full DPS", weightMult = 1.0 },
            { stat = "TotalEHP", label = "Effective Hit Pool", weightMult = 0.5 } }
  end
  return out
end

local generator -- cached: InitMods() LoadModule's the 700 KB Data/QueryMods.lua once
local function getGenerator()
  if not generator then
    -- shim queryTab: the generator only reads queryTab.itemsTab (TradeQueryGenerator.lua:114-122)
    generator = new("TradeQueryGenerator", { itemsTab = build.itemsTab })
  end
  -- the generator is constructed against one itemsTab; rebind if the build was reloaded
  generator.queryTab = { itemsTab = build.itemsTab }
  generator.itemsTab = build.itemsTab
  return generator
end

local function resolveSlot(slotName)
  local slot = build.itemsTab.slots[slotName]
  if not slot then error("unknown slot '" .. tostring(slotName) .. "'") end
  return slot
end

-- req = { slot, statWeights=[{stat,weight}], requiredMods=[{tradeId,min}], maxPrice, currency,
--         maxLevel, sockets, includeCorrupted, includeMirrored, augmentBehaviour("copy"|"keep"|"remove"),
--         status("securable"|...), jewelType }
function M.generateQuery(req)
  local t0 = nowMs()
  local gen = getGenerator()
  local tInit = nowMs() - t0
  local slot = resolveSlot(req.slot)

  -- sticky "last*" UI memory must not leak between headless calls (StartQuery :770-778)
  gen.lastMaxPrice, gen.lastMaxPriceTypeIndex, gen.lastMaxLevel = nil, nil, nil
  gen.tradeTypeIndex = STATUS[req.status or "securable"] or error("bad status")
  if req.currency and not CURRENCIES[req.currency] then error("bad currency " .. req.currency) end

  local options = {
    statWeights = M.resolveStatWeights(req.statWeights),
    includeCorrupted = req.includeCorrupted ~= false,
    includeMirrored = req.includeMirrored == true,
    -- "Rune Behaviour" dropdown: only "Keep" generates rune weights (:1266-1273)
    includeRunes = req.augmentBehaviour == "keep",
    maxPrice = req.maxPrice, maxPriceType = req.currency, -- nil currency = Exalted Orb Equivalent
    maxLevel = req.maxLevel, sockets = req.sockets, jewelType = req.jewelType,
  }
  if req.requiredMods and #req.requiredMods > 0 then
    options.requiredMods = {}
    for _, rm in ipairs(req.requiredMods) do
      table.insert(options.requiredMods, { tradeId = rm.tradeId, value = rm.min })
    end
  end

  local result
  gen.requesterContext = {}
  gen.requesterCallback = function(_, queryJson, errMsg) result = { queryJson = queryJson, err = errMsg } end

  gen:StartQuery(slot, options) -- opens a "Please Wait" popup on `main`; FinishQuery closes it
  if not gen.calcContext.co then error("slot not supported for weighted query generation") end

  -- count engine evaluations by wrapping the misc calculator the generator captured
  local calcCount = 0
  local calcFunc = gen.calcContext.calcFunc
  gen.calcContext.calcFunc = function(...) calcCount = calcCount + 1 return calcFunc(...) end

  -- Drive the coroutine ourselves instead of gen:OnFrame(): OnFrame swallows coroutine errors
  -- outside devMode (:745-748) and would then emit a query from partial weights.
  local tGen = nowMs()
  local co = gen.calcContext.co
  local resumes = 0
  while coroutine.status(co) ~= "dead" do
    local ok, err = coroutine.resume(co, gen)
    resumes = resumes + 1
    if not ok then gen.calcContext.co = nil; main:ClosePopup(); error("generator failed: " .. tostring(err)) end
  end
  gen.calcContext.co = nil
  local tWeights = nowMs() - tGen
  -- full ranked list before FinishQuery truncates it to MAX_FILTERS (:1015-1024), so the caller can
  -- re-budget (trade2 complexity differs logged-in vs not) without re-running the 2-4 s weighting pass
  local allWeights = {}
  for i, w in ipairs(gen.modWeights) do allWeights[i] = { id = w.tradeModId, weight = w.weight, meanStatDiff = w.meanStatDiff } end
  table.sort(allWeights, function(a, b)
    if a.meanStatDiff == b.meanStatDiff then return a.id < b.id end -- deterministic tie-break
    return a.meanStatDiff > b.meanStatDiff
  end)
  gen:FinishQuery()
  local tTotal = nowMs() - t0

  local query = result and result.queryJson and dkjson.decode(result.queryJson)
  return {
    query = query, queryJson = result and result.queryJson, error = result and result.err,
    weightCount = query and #query.query.stats[1].filters or 0,
    candidateWeights = #allWeights, rankedWeights = allWeights,
    minWeight = query and query.query.stats[1].value.min,
    meta = { calcCount = calcCount, resumes = resumes, initMs = tInit, weightsMs = tWeights, totalMs = tTotal,
      itemCategory = gen.calcContext.itemCategory, categoryQuery = gen.calcContext.itemCategoryQueryStr },
  }
end

-- Reuse PoB's own trade2 fetch-JSON -> item text parser (TradeQueryRequests.lua:289-446), which lives in
-- the FetchResultBlock callback closure: enqueue, then invoke the queued callback with the raw body.
function M.parseFetchResponse(fetchBody)
  local tqr = new("TradeQueryRequests")
  local items, perr
  tqr:FetchResultBlock("headless://", function(it, e) items, perr = it, e end)
  local queued = table.remove(tqr.requestQueue.fetch, 1)
  queued.callback(fetchBody, nil)
  if perr then error(perr) end
  return items
end

local tradeQuery -- cached TradeQuery instance (constructor is UI-free: TradeQuery.lua:22-65)
local function getTradeQuery()
  if not tradeQuery or tradeQuery.itemsTab ~= build.itemsTab then
    tradeQuery = new("TradeQuery", build.itemsTab)
    tradeQuery.tradeQueryGenerator = getGenerator() -- GetResultEvaluation uses .WeightedRatioOutputs
  end
  return tradeQuery
end

-- req = { slot, fetchBody (raw /api/trade2/fetch JSON) | itemStrings[], statWeights, reportStats[],
--         augmentBehaviour("copy"|"keep"|"remove") }
function M.evaluateItems(req)
  local t0 = nowMs()
  local tq = getTradeQuery()
  local slotName = req.slot
  resolveSlot(slotName)
  local entries
  if req.fetchBody then
    entries = M.parseFetchResponse(req.fetchBody)
  else
    entries = {}
    for i, s in ipairs(req.itemStrings) do entries[i] = { item_string = s } end
  end
  local tParse = nowMs() - t0

  local before = #entries
  local safe = tq:FilterToSafeItems(entries, slotName) -- TradeQuery.lua:985-994
  -- augment/anoint behaviour, same as the "Find best" callback (TradeQuery.lua:1040-1068)
  local behaviour = req.augmentBehaviour or "copy"
  for _, e in ipairs(safe) do
    local item = new("Item", e.item_string)
    if item.base and item.type then
      if behaviour == "copy" then
        build.itemsTab:CopyAnointsAndAugments(item, true, true, slotName)
        e.item_string = item:BuildRaw()
      elseif behaviour == "remove" then
        local valid = build.itemsTab:GetValidRunesForItem(item)
        for i in ipairs(item.runes or {}) do
          if not build.itemsTab:IsSocketBoundRune(item, item.runes[i], valid) then item.runes[i] = "None" end
        end
        item:UpdateRunes()
        e.item_string = item:BuildRaw()
      end
    end
  end

  local statWeights = M.resolveStatWeights(req.statWeights)
  tq.statSortSelectionList = statWeights
  tq.slotTables[1] = { slotName = slotName }
  tq.resultTbl[1] = safe

  local reportStats = {}
  local seen = {}
  for _, s in ipairs(statWeights) do if not seen[s.stat] then seen[s.stat] = true table.insert(reportStats, s) end end
  for _, name in ipairs(req.reportStats or {}) do
    if not seen[name] then
      seen[name] = true
      -- powerStatList entry if there is one (gets FullDPS/minion/transform semantics), else a raw output key
      local ok, st = pcall(M.resolveStatWeights, { { stat = name } })
      table.insert(reportStats, ok and st[1] or { stat = name, label = name })
    end
  end

  local calcFunc, baseOutput = build.calcsTab:GetMiscCalculator()
  local tEval0 = nowMs()
  local results = {}
  for i, e in ipairs(safe) do
    local ti = nowMs()
    -- Same steps as TradeQuery:GetResultEvaluation (TradeQuery.lua:829-833) but keeping the full
    -- output so arbitrary report stats can be read (ReduceOutput keeps only weighted stats).
    local item = new("Item", e.item_string)
    local out = calcFunc({ repSlotName = slotName, repItem = item })
    local eval = { weight = tq.tradeQueryGenerator.WeightedRatioOutputs(baseOutput, tq:ReduceOutput(out), statWeights) }
    if i == 1 and req.crossCheck then -- verify equivalence with PoB's own method once
      local ref = tq:GetResultEvaluation(1, i, calcFunc, baseOutput)[1]
      eval.crossCheck = { pobMethodWeight = ref.weight, equal = math.abs(ref.weight - eval.weight) < 1e-9 }
    end
    local stats = {}
    for _, st in ipairs(reportStats) do
      local b = data.powerStatList.GetFromOutput(baseOutput, st)
      local n = data.powerStatList.GetFromOutput(out, st)
      stats[st.stat] = { base = b, new = n, delta = n - b, pct = (b ~= 0) and ((n - b) / math.abs(b) * 100) or nil }
    end
    results[i] = { id = e.id, name = item.name, price = e.amount and { amount = e.amount, currency = e.currency },
      tradeWeight = tonumber(e.weight), pobWeight = eval.weight, crossCheck = eval.crossCheck,
      stats = stats, ms = nowMs() - ti }
  end
  local tEval = nowMs() - tEval0
  table.sort(results, function(a, b) return a.pobWeight > b.pobWeight end) -- "(Highest) Stat Value" sort
  return { results = results, rejected = before - #safe,
    meta = { parseMs = tParse, evalMs = tEval, totalMs = nowMs() - t0, n = #safe } }
end

return M
