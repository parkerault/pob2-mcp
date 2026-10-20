-- API/NodePower.lua
-- Node power (C-55, WU-92, D-417): PoB's own ranking of passive nodes, the tree tab's "Show node power" and its power
-- report, measured for one to three stats in one pass, with the best legal swap the tree has left (D-418).
--
--   node_power {stats[], maxDistance?, loadout?, level?, keep[]?, protectFor[]?, clearGroup?, maxLoss?, limit?}
--   node_power {upgrades {fields[]}, maxDistance?}         (get_passive_upgrades' candidates)
--
-- The pass is CalcsTab:PowerBuilder's (vendor Classes/CalcsTab.lua:521-680), run once for every stat asked for:
-- every Normal, Notable and Keystone node of the main tree whose modKey isn't empty, that no item grants and that no
-- locked ascendancy node hides, within `maxDistance` of the tree (node.pathDist, as PowerBuilder adjusts it for an
-- intuitive leap). PoB's own misc calculator (build.calcsTab:GetMiscCalculator()) measures each one: an unallocated
-- node alone (cached by modKey) and with its whole path (node.path) when it is more than 1 point away; an allocated
-- node removed alone (cached by modKey .. "_remove") and with every node that depends on it (node.depends) when it
-- has dependants. Each output is read for every stat by CalcsTab:CalculatePowerStat, so a second stat costs almost
-- nothing, and its figures equal PowerBuilder's for that stat alone. PowerBuilder passes useFullDPS only for Full
-- DPS; the pass passes it when Full DPS is one of the stats, which changes no other stat's figure. The tree tab's
-- power report (Classes/TreeTab.lua, BuildPowerReportList) divides an unallocated node's path figure by its
-- distance, and an allocated node's by its dependants' count; the lists here do the same. A calculation PoB fails
-- is caught and reported against its node, never as a failed call.
--
-- Stats are the entries of data.powerStatList that have a `stat` and aren't ignoreForNodes, minion versions included
-- (Modules/Data.lua:127-232), named by PoB's id or label, case ignored. The combined "Offence/Defence" has no stat:
-- it gives a node's own offence and defence only, with no path figure and no loss, so it is refused, as is an
-- unknown name, each with the list.
--
-- State (D-176): the call selects the loadout (build:SetActiveLoadout) and sets its level, by default the
-- "(L<level>)" in the loadout's name; it puts back the previous spec, item, skill and config sets and the level and
-- level mode at the end and on any error, so the exported build is unchanged. Measuring the clear group selects it
-- as the main group for its calculations only, and puts back the selection and every gem's fields after.
--
-- The best swap (D-418) is searched on a scratch PassiveSpec (built as BuildOps' set_tree builds one), for each of
-- the 5 weakest unprotected branches in turn: remove the branch,
-- import the tree without it so PoB recomputes every path, then add, greedily, the unallocated nodes with the best
-- gain per point on the first stat whose new paths fit the freed points, counting the union of their path nodes
-- once (a node's gain is its own measured gain alone; a removed node's, the loss its removal measured). The swap is
-- then imported whole and measured as one change with the misc calculator (override `spec`, as the tree tab's spec
-- tooltip measures a spec). It is returned only when it stays legal: every node it keeps or adds stays allocated
-- under PoB's weapon-set rule (the import drops a node that doesn't connect), no more main-tree points than before,
-- no start holding more trees than before or more than one (D-360 as D-364 states it), no weapon-set or ascendancy
-- node added or removed. An added attribute node takes PoB's default choice (PassiveSpec:AllocNode switches it to
-- spec.attributeIndex, else option 1) and is returned with it. The best swap gains most on the first stat with no
-- other stat losing more than its `maxLoss` (default 2%) and no guard losing more than its own (default 0):
-- movement speed (EffectiveMovementSpeedMod) and the clear entry's radius and uses per second, read as
-- src/plan/record.ts reads them (the minion's when the clear skill summons one), measured with `clearGroup`
-- (default the main group) as the main group.
--
-- Protected, never removed with any branch containing them: `keep`; a node with a "Grants Skill:" line; a
-- weapon-set node; for each loadout of `protectFor`, every node of this tree whose dependants in that loadout's
-- spec (node.depends there) include a node outside this tree.
--
-- Registered by one line in Handlers.lua.

local BuildOps = require('API.BuildOps')
local construct = require('API.Util').construct

local M = {}

-- JSON null, for a hole in a list (a percentage of a base of 0): dkjson would otherwise end the list there.
local NULL
do
  local ok, dkjson = pcall(require, 'dkjson')
  NULL = ok and type(dkjson) == 'table' and dkjson.null or nil
end

local Failure = {}
local function fail(msg)
  error(setmetatable({ msg = msg }, Failure), 0)
end

local DEFAULT_DISTANCE, MAX_DISTANCE = 6, 12
local DEFAULT_LIMIT = 15
local SWAP_BRANCHES = 5
local DEFAULT_MAX_LOSS, GUARD_MAX_LOSS = 2, 0
local GUARDS = { 'movement', 'clearRadius', 'clearUses' }
-- The node types the tree tab's power report lists (TreeTab:BuildPowerReportList).
local REPORT_TYPES = { Normal = true, Notable = true, Keystone = true }
local SCALAR = { number = true, string = true, boolean = true }

-- PoB colour codes (^1, ^xRRGGBB) stripped from a message.
local function plain(msg)
  return (tostring(msg):gsub('%^x%x%x%x%x%x%x', ''):gsub('%^%d', ''))
end

local function is_start(node)
  return node ~= nil and (node.type == 'ClassStart' or node.type == 'AscendClassStart')
end

local function is_main(node)
  return node ~= nil and not node.ascendancyName and not is_start(node)
end

local function node_name(node)
  return tostring(node and (node.dn or node.name) or '?')
end

local function sorted_ids(set)
  local out = {}
  for id in pairs(set) do out[#out + 1] = id end
  table.sort(out)
  return out
end

local function count(set)
  local n = 0
  for _ in pairs(set) do n = n + 1 end
  return n
end

-- ---------------------------------------------------------------------------------------------------
-- Stats

local function power_stats()
  local out = {}
  for _, s in ipairs(data.powerStatList or {}) do
    if s.stat and not s.ignoreForNodes then out[#out + 1] = s end
  end
  return out
end

local function stat_list_text()
  local parts = {}
  for _, s in ipairs(power_stats()) do parts[#parts + 1] = ('%s (%s)'):format(s.stat, tostring(s.label)) end
  return table.concat(parts, ', ')
end

local function resolve_stat(name)
  if type(name) ~= 'string' or not name:match('%S') then
    fail('each stat is a name, PoB\'s id or label; the stats are: ' .. stat_list_text())
  end
  local wanted = name:lower()
  for _, s in ipairs(power_stats()) do
    if s.stat:lower() == wanted or tostring(s.label):lower() == wanted then return s end
  end
  for _, s in ipairs(data.powerStatList or {}) do
    if not s.stat and tostring(s.label):lower() == wanted then
      fail(('"%s" has no stat of its own: PoB\'s combined view gives a node\'s own offence and defence only, with no '
        .. 'path figure and no loss for an allocated node; name a stat instead. The stats are: %s'):format(name, stat_list_text()))
    end
  end
  fail(('unknown power stat "%s"; the stats are: %s'):format(name, stat_list_text()))
end

-- ---------------------------------------------------------------------------------------------------
-- Loadouts, level and the selection: what the call changes and puts back (D-176)

local function loadout_names()
  build:SyncLoadouts()
  local names = {}
  local control = build.controls and build.controls.buildLoadouts
  for _, entry in ipairs(control and control.list or {}) do
    if type(entry) == 'string' and entry:sub(1, 4) ~= '^7^7' then names[#names + 1] = entry end
  end
  return names
end

local function quoted(names)
  if #names == 0 then return 'none' end
  local out = {}
  for _, n in ipairs(names) do out[#out + 1] = '"' .. n .. '"' end
  return table.concat(out, ', ')
end

-- The loadout named `name` ({name, specId, itemSetId, skillSetId, configSetId}); fails with the list.
local function resolve_loadout(name, what)
  if type(name) ~= 'string' or name == '' then fail(what .. ' must be a loadout name') end
  local names = loadout_names()
  local listed = false
  for _, n in ipairs(names) do
    if n == name then listed = true break end
  end
  if not listed then fail(('%s: no loadout named "%s"; the loadouts are: %s'):format(what, name, quoted(names))) end
  local ok, loadout = pcall(build.GetLoadoutByName, build, name)
  if not ok or type(loadout) ~= 'table' or not loadout.specId then
    fail(('%s: PoB could not resolve loadout "%s"'):format(what, name))
  end
  return { name = name, specId = loadout.specId, itemSetId = loadout.itemSetId, skillSetId = loadout.skillSetId,
    configSetId = loadout.configSetId }
end

-- The active loadout's name: the one whose four sets are active, or nil.
local function active_loadout_name()
  for _, name in ipairs(loadout_names()) do
    local ok, l = pcall(build.GetLoadoutByName, build, name)
    if ok and type(l) == 'table' and l.specId == build.treeTab.activeSpec and l.itemSetId == build.itemsTab.activeItemSetId
        and l.skillSetId == build.skillsTab.activeSkillSetId and l.configSetId == build.configTab.activeConfigSetId then
      return name
    end
  end
  return nil
end

local function snapshot_state()
  return {
    specId = build.treeTab.activeSpec, itemSetId = build.itemsTab.activeItemSetId,
    skillSetId = build.skillsTab.activeSkillSetId, configSetId = build.configTab.activeConfigSetId,
    level = build.characterLevel, autoMode = build.characterLevelAutoMode,
    mainSocketGroup = build.mainSocketGroup, skillNumber = build.calcsTab.input.skill_number,
  }
end

local function same_sets(s)
  return build.treeTab.activeSpec == s.specId and build.itemsTab.activeItemSetId == s.itemSetId
    and build.skillsTab.activeSkillSetId == s.skillSetId and build.configTab.activeConfigSetId == s.configSetId
end

local restore_selection

-- Put back the sets, every skill set's selection (`selection`, snapshot_selection's), the main group, the level and
-- its mode; rebuild the outputs.
local function restore_state(s, selection)
  if not same_sets(s) then
    build:SetActiveLoadout({ specId = s.specId, itemSetId = s.itemSetId, skillSetId = s.skillSetId, configSetId = s.configSetId })
  end
  restore_selection(selection)
  build.mainSocketGroup = s.mainSocketGroup
  build.calcsTab.input.skill_number = s.skillNumber
  build.characterLevel = s.level
  build.characterLevelAutoMode = s.autoMode
  local ctrl = build.controls and build.controls.characterLevel
  if ctrl and ctrl.SetText then ctrl:SetText(s.level) end
  if build.configTab and build.configTab.BuildModList then build.configTab:BuildModList() end
  build.buildFlag = true
  BuildOps.get_main_output()
end

-- Every gem of the active skill set: its scalar fields (a calculation writes skillPart, skillMinion, … on the
-- main skill's gem instance, Modules/CalcActiveSkill.lua), its stat-set choices and its minion stat-set lookups,
-- with each group's main active skills and the main group, so a clear-group measurement leaves them as they were.
local GEM_TABLES = { 'statSet', 'skillMinionSkillStatSetIndexLookup', 'skillMinionSkillStatSetIndexLookupCalcs' }

local function copy_two_level(t)
  if type(t) ~= 'table' then return { value = t } end
  local entries = {}
  for k, v in pairs(t) do
    if type(v) == 'table' then
      local inner = {}
      for i, x in pairs(v) do inner[i] = x end
      entries[k] = { table = v, values = inner }
    else
      entries[k] = { value = v }
    end
  end
  return { table = t, entries = entries }
end

local function put_two_level(copy)
  local t = copy.table
  if not t then return copy.value end
  for k in pairs(t) do t[k] = nil end
  for k, e in pairs(copy.entries) do
    if e.table then
      for i in pairs(e.table) do e.table[i] = nil end
      for i, x in pairs(e.values) do e.table[i] = x end
      t[k] = e.table
    else
      t[k] = e.value
    end
  end
  return t
end

local function snapshot_selection()
  local snap = { groups = {}, gems = {} }
  local tab = build.skillsTab
  for _, setId in ipairs(tab.skillSetOrderList or {}) do
    local set = tab.skillSets and tab.skillSets[setId]
    for _, g in ipairs(set and set.socketGroupList or {}) do
      snap.groups[#snap.groups + 1] = { group = g, mainActiveSkill = g.mainActiveSkill, mainActiveSkillCalcs = g.mainActiveSkillCalcs }
      for _, gem in ipairs(g.gemList or {}) do
        if not snap.gems[gem] then
          local fields = {}
          for k, v in pairs(gem) do
            if SCALAR[type(v)] then fields[k] = v end
          end
          local tables = {}
          for _, key in ipairs(GEM_TABLES) do tables[key] = copy_two_level(gem[key]) end
          snap.gems[gem] = { fields = fields, tables = tables }
        end
      end
    end
  end
  return snap
end

function restore_selection(snap)
  for _, s in ipairs(snap.groups) do
    s.group.mainActiveSkill = s.mainActiveSkill
    s.group.mainActiveSkillCalcs = s.mainActiveSkillCalcs
  end
  for gem, s in pairs(snap.gems) do
    for k, v in pairs(gem) do
      if SCALAR[type(v)] and s.fields[k] == nil then gem[k] = nil end
    end
    for k, v in pairs(s.fields) do gem[k] = v end
    for _, key in ipairs(GEM_TABLES) do gem[key] = put_two_level(s.tables[key]) end
  end
end

-- ---------------------------------------------------------------------------------------------------
-- Arguments

local function int_arg(v, name, lo, hi)
  local n = tonumber(v)
  if not n or n ~= math.floor(n) or n < lo or (hi and n > hi) then
    fail(('%s must be a whole number from %d%s'):format(name, lo, hi and (' to ' .. hi) or ''))
  end
  return n
end

local function id_list(v, name)
  if v == nil then return {} end
  if type(v) ~= 'table' then fail(name .. ' must be a list of node ids') end
  local out = {}
  for _, x in ipairs(v) do
    local id = tonumber(x)
    if not id or not build.spec.nodes[id] then fail(('%s: %s is not a passive tree node'):format(name, tostring(x))) end
    out[#out + 1] = id
  end
  return out
end

-- maxLoss: a number for every other stat, or a map by stat id and guard name; percentages.
local function loss_limits(v, stats)
  local limits = {}
  for i, s in ipairs(stats) do limits[s.stat] = i == 1 and nil or DEFAULT_MAX_LOSS end
  for _, g in ipairs(GUARDS) do limits[g] = GUARD_MAX_LOSS end
  if v == nil then return limits end
  if type(v) == 'number' then
    if v < 0 then fail('maxLoss must be 0 or more') end
    for i, s in ipairs(stats) do if i > 1 then limits[s.stat] = v end end
    return limits
  end
  if type(v) ~= 'table' then fail('maxLoss must be a percentage or a map of percentages by stat or guard') end
  for key, pct in pairs(v) do
    if type(pct) ~= 'number' or pct < 0 then fail(('maxLoss.%s must be a percentage, 0 or more'):format(tostring(key))) end
    local known = false
    for i, s in ipairs(stats) do
      if i > 1 and s.stat == key then known = true end
    end
    for _, g in ipairs(GUARDS) do if g == key then known = true end end
    if not known then
      local names = {}
      for i, s in ipairs(stats) do if i > 1 then names[#names + 1] = s.stat end end
      for _, g in ipairs(GUARDS) do names[#names + 1] = g end
      fail(('maxLoss.%s names no other stat or guard; the keys are: %s'):format(tostring(key), table.concat(names, ', ')))
    end
    limits[key] = pct
  end
  return limits
end

-- ---------------------------------------------------------------------------------------------------
-- The pass

-- The clear entry's figures from an output: the minion's when the clear skill summons one (record.ts reads
-- MinionAreaOfEffectRadiusMetres and MinionSpeed then, D-376, D-378).
local function clear_of(out)
  local minion = type(out.Minion) == 'table' and out.Minion or nil
  local src = minion or out
  return { radius = tonumber(src.AreaOfEffectRadiusMetres), uses = tonumber(src.Speed), minion = minion ~= nil }
end

-- What the call reads from one output: each stat's change against the base (CalculatePowerStat), each stat's
-- value, the movement speed, the clear entry when the clear group is the main one, and any raw fields asked for.
local function extract(ctx, out)
  local v = { delta = {}, value = {} }
  for i, s in ipairs(ctx.stats) do
    v.value[i] = data.powerStatList.GetFromOutput(out, s)
    v.delta[i] = build.calcsTab:CalculatePowerStat(s, out, ctx.calcBase)
  end
  v.move = tonumber(out.EffectiveMovementSpeedMod)
  if ctx.clearInMain then v.clear = clear_of(out) end
  if ctx.fields then
    v.fields = {}
    for _, f in ipairs(ctx.fields) do
      local x = BuildOps.output_field(out, f)
      if type(x) == 'number' then v.fields[f] = x end
    end
  end
  return v
end

-- The node's power distance, as PowerBuilder computes it, or nil when PowerBuilder leaves the node out.
local function power_distance(spec, node, granted)
  if node.modKey == nil or node.modKey == '' or granted[node.id] then return nil end
  if node.unlockConstraint then
    for _, uid in ipairs(node.unlockConstraint.nodes or {}) do
      local u = spec.nodes[uid]
      if u and u.ascendancyName and not u.alloc then return nil end
    end
  end
  local dist = node.pathDist or 1000
  for _, leap in ipairs(node.intuitiveLeapLikesAffecting or {}) do
    if leap.alloc then dist = math.max(math.min(leap.pathDist or 1000, dist), 1) end
  end
  return dist
end

-- A node's path (node.path) as ids in allocation order: the step next to the tree first, the node last.
local function path_ids(node)
  local out = {}
  local path = node.path or {}
  for i = #path, 1, -1 do out[#out + 1] = path[i].id end
  return out
end

local function run_pass(ctx)
  local spec = build.spec
  local calcFunc, calcBase = build.calcsTab:GetMiscCalculator()
  ctx.calcFunc, ctx.calcBase = calcFunc, calcBase
  ctx.base = extract(ctx, calcBase)
  ctx.granted = (build.calcsTab.mainEnv and build.calcsTab.mainEnv.grantedPassives) or {}
  local cache = {}
  ctx.calcs = 0
  ctx.measure = function(key, override)
    if key and cache[key] then return cache[key] end
    ctx.calcs = ctx.calcs + 1
    local ok, out = pcall(calcFunc, override, ctx.useFullDPS)
    local r
    if ok and type(out) == 'table' then r = extract(ctx, out)
    else r = { err = plain(ok and "PoB's calculator returned no output" or out) } end
    if key then cache[key] = r end
    return r
  end
  local measure = ctx.measure
  -- PowerBuilder's own order: the nodes bucketed by distance as it buckets them (each bucket a table filled in
  -- pairs(spec.nodes) order, so pairs over it runs in PowerBuilder's order), the buckets nearest first. Its single-node
  -- outputs are cached by modKey, so a node sharing its modKey with another (a weapon-set twin of an untagged node)
  -- gets the output of whichever PoB measured first; measuring every node PowerBuilder measures, in its order, gives
  -- the same figures. Only the main tree's Normal, Notable and Keystone nodes are reported.
  local distanceMap = {}
  for nodeId, node in pairs(spec.nodes) do
    local dist = power_distance(spec, node, ctx.granted)
    if dist then
      distanceMap[dist] = distanceMap[dist] or {}
      distanceMap[dist][nodeId] = node
    end
  end
  local distanceList = {}
  for distance, nodes in pairs(distanceMap) do distanceList[#distanceList + 1] = { distance, nodes } end
  table.sort(distanceList, function(a, b) return a[1] < b[1] end)
  local unalloc, alloc = {}, {}
  for _, bucket in ipairs(distanceList) do
    local dist, nodes = bucket[1], bucket[2]
    if dist > ctx.depth then break end
    for id, node in pairs(nodes) do
      local report = REPORT_TYPES[node.type] and not node.ascendancyName
      if not node.alloc then
        if ctx.mode == 'power' or report then
          local e = { id = id, node = node, dist = dist }
          if ctx.mode == 'power' then e.single = measure(node.modKey, { addNodes = { [node] = true } }) end
          if report and node.path then
            if dist > 1 then
              local set = {}
              for _, p in pairs(node.path) do set[p] = true end
              e.path = measure(nil, { addNodes = set })
            else
              e.path = e.single or measure(node.modKey, { addNodes = { [node] = true } })
            end
            unalloc[#unalloc + 1] = e
          end
        end
      elseif ctx.mode == 'power' then
        local e = { id = id, node = node }
        e.single = measure(node.modKey .. '_remove', { removeNodes = { [node] = true } })
        if report then
          local deps = node.depends or {}
          if #deps > 1 then
            local set = {}
            for _, d in pairs(deps) do set[d] = true end
            e.branch = measure(nil, { removeNodes = set })
          else
            e.branch = e.single
          end
          alloc[#alloc + 1] = e
        end
      end
    end
  end
  table.sort(unalloc, function(a, b) return a.id < b.id end)
  table.sort(alloc, function(a, b) return a.id < b.id end)
  return unalloc, alloc
end

-- ---------------------------------------------------------------------------------------------------
-- Rows

local function figures(v, n)
  if not v or v.err then return nil end
  local out = {}
  for i = 1, n do out[i] = v.delta[i] end
  return out
end

-- `delta` relative to the base value, in percent; nil when the base is 0.
local function pct(delta, base)
  if delta == nil or base == nil or base == 0 then return nil end
  return delta / math.abs(base) * 100
end

-- ---------------------------------------------------------------------------------------------------
-- The tree's shape (D-360, D-364): per open start, the trees (components of the main-tree nodes) that leave it.

local function start_counts(spec, set)
  local nodes = spec.nodes
  local exitsOf = {}
  local function add_start(key, startNode)
    for _, o in ipairs(startNode.linked or {}) do
      if is_main(o) then
        exitsOf[o.id] = exitsOf[o.id] or {}
        exitsOf[o.id][key] = true
      end
    end
  end
  local classStart = spec.curClass and spec.curClass.startNodeId
  if classStart and nodes[classStart] then add_start('class', nodes[classStart]) end
  for id in pairs(set) do
    local n = nodes[id]
    if n and n.ascendancyName and not is_start(n) then add_start('alt:' .. id, n) end
  end
  local counts, seen = {}, {}
  for _, id in ipairs(sorted_ids(set)) do
    local n = nodes[id]
    if is_main(n) and not seen[id] then
      seen[id] = true
      local queue, qi, held = { n }, 1, {}
      while qi <= #queue do
        local cur = queue[qi]; qi = qi + 1
        for key in pairs(exitsOf[cur.id] or {}) do held[key] = true end
        for _, o in ipairs(cur.linked or {}) do
          if set[o.id] and is_main(o) and not seen[o.id] and cur.type ~= 'Mastery' then
            seen[o.id] = true
            queue[#queue + 1] = o
          end
        end
      end
      for key in pairs(held) do counts[key] = (counts[key] or 0) + 1 end
    end
  end
  return counts
end

-- Whether `set`'s shape is no worse than `origCounts`: each start holds at most one tree, or no more than before.
local function shape_ok(spec, set, origCounts)
  for key, n in pairs(start_counts(spec, set)) do
    if n > math.max(1, origCounts[key] or 0) then return false, key end
  end
  return true
end

-- ---------------------------------------------------------------------------------------------------
-- The best swap

local function new_scratch(spec)
  local scratch = construct('PassiveSpec', build, spec.treeVersion)
  scratch.jewels = copyTable(spec.jewels or {})
  return scratch
end

local function import(scratch, spec, ids, weaponSets, overrides)
  scratch:ImportFromNodeList(nil, spec.curClassId, spec.curAscendClassId, spec.curSecondaryAscendClassId or 0, ids,
    weaponSets, overrides, copyTable(spec.masterySelections or {}, true))
end

local function attribute_name(treeNode, index)
  local option = treeNode and treeNode.options and treeNode.options[index]
  local name = option and (option.dn or option.name)
  return name and tostring(name):lower() or nil
end

-- One swap for the branch `pick` (its node ids as a set): see the header.
local function try_swap(ctx, scratch, orig, origCounts, pick)
  local spec = build.spec
  local removed = pick.set
  local freed = count(removed)
  local result = { branch = pick.row.id, branchName = node_name(pick.row.node), freed = freed }
  local keepSet, keepIds = {}, {}
  for id in pairs(orig) do
    if not removed[id] then keepSet[id] = true; keepIds[#keepIds + 1] = id end
  end
  table.sort(keepIds)
  local weaponSets = {}
  for id in pairs(keepSet) do
    local mode = spec.nodes[id].allocMode or 0
    if mode ~= 0 then weaponSets[id] = mode end
  end
  local function overrides_for(set)
    local out = {}
    for id, ov in pairs(spec.hashOverrides or {}) do
      if set[id] then out[id] = ov end
    end
    return out
  end
  import(scratch, spec, keepIds, weaponSets, overrides_for(keepSet))
  for _, id in ipairs(keepIds) do
    if not scratch.allocNodes[id] then
      result.verdict = 'illegal'
      result.reason = 'removing the branch disconnects ' .. node_name(spec.nodes[id])
      return result
    end
  end

  -- The candidates: every unallocated main-tree node PoB paths to from an untagged node within the freed points.
  local cands = {}
  for _, id in ipairs(sorted_ids(scratch.nodes)) do
    local n = scratch.nodes[id]
    if not n.alloc and REPORT_TYPES[n.type] and not n.ascendancyName and n.modKey ~= nil and n.modKey ~= ''
        and not ctx.granted[id] and n.path and #n.path >= 1 and #n.path <= freed
        and #(n.intuitiveLeapLikesAffecting or {}) == 0 and n.pathRoot and (n.pathRoot.allocMode or 0) == 0 then
      cands[#cands + 1] = { id = id, path = path_ids(n) }
    end
  end

  -- Greedy: the best estimated gain per new point on the first stat, the union of paths counted once.
  local chosen, used, banned = {}, 0, {}
  while true do
    local best
    for _, c in ipairs(cands) do
      if not banned[c.id] and not chosen[c.id] then
        local new, gain = {}, 0
        for _, pid in ipairs(c.path) do
          if not chosen[pid] then new[#new + 1] = pid; gain = gain + ctx.estimate(pid) end
        end
        local cost = #new
        if cost >= 1 and used + cost <= freed and gain > 0 then
          local score = gain / cost
          if not best or score > best.score or (score == best.score and cost < #best.new) then
            best = { c = c, new = new, score = score }
          end
        end
      end
    end
    if not best then break end
    local trial = {}
    for id in pairs(keepSet) do trial[id] = true end
    for id in pairs(chosen) do trial[id] = true end
    for _, pid in ipairs(best.new) do trial[pid] = true end
    if shape_ok(spec, trial, origCounts) then
      for _, pid in ipairs(best.new) do chosen[pid] = true end
      used = used + #best.new
    else
      banned[best.c.id] = true
    end
  end
  if next(chosen) == nil then
    result.verdict = 'no-candidate'
    result.reason = 'no node within the freed points gains on ' .. ctx.stats[1].stat
    return result
  end

  local final = {}
  for id in pairs(keepSet) do final[id] = true end
  for id in pairs(chosen) do final[id] = true end
  local added, removedNet = {}, {}
  for id in pairs(final) do if not orig[id] then added[#added + 1] = id end end
  for id in pairs(orig) do if not final[id] then removedNet[#removedNet + 1] = id end end
  table.sort(added)
  table.sort(removedNet)
  result.used = used

  -- PoB's default choice for each added attribute node; the kept nodes keep theirs.
  local overrides = overrides_for(final)
  local index = spec.attributeIndex or 1
  local attributes = {}
  scratch.hashOverrides = overrides
  for _, id in ipairs(added) do
    local treeNode = spec.tree.nodes[id]
    if treeNode and treeNode.isAttribute then
      scratch:SwitchAttributeNode(id, index)
      attributes[id] = attribute_name(treeNode, index)
    end
  end
  overrides = scratch.hashOverrides
  local finalIds = sorted_ids(final)
  import(scratch, spec, finalIds, weaponSets, overrides)

  local function illegal(why)
    result.verdict = 'illegal'
    result.reason = why
    return result
  end
  for _, id in ipairs(finalIds) do
    if not scratch.allocNodes[id] then return illegal(node_name(spec.nodes[id]) .. ' would not connect') end
  end
  local function main_points(set, s)
    local n = 0
    for id in pairs(set) do
      local node = s.nodes[id]
      if is_main(node) and (node.allocMode or 0) == 0 then n = n + 1 end
    end
    return n
  end
  if main_points(final, scratch) > main_points(orig, spec) then return illegal('it would spend more points') end
  local ok, start = shape_ok(spec, final, origCounts)
  if not ok then return illegal('a start would hold a second tree (' .. start .. ')') end
  for _, id in ipairs(finalIds) do
    local want = orig[id] and (spec.nodes[id].allocMode or 0) or 0
    if (scratch.nodes[id].allocMode or 0) ~= want then return illegal('a weapon-set tag would change') end
  end
  for _, id in ipairs(added) do
    if spec.nodes[id].ascendancyName then return illegal('it would add an ascendancy node') end
  end
  for _, id in ipairs(removedNet) do
    local node = spec.nodes[id]
    if node.ascendancyName or (node.allocMode or 0) ~= 0 then return illegal('it would remove a weapon-set or ascendancy node') end
  end

  local v = ctx.measure(nil, { spec = scratch })
  if v.err then
    result.verdict = 'error'
    result.reason = v.err
    return result
  end
  result.measured = v
  if ctx.clearSeparate then result.clear = ctx.measure_clear(scratch) end
  result.added, result.removed, result.attributes = added, removedNet, attributes
  result.verdict = 'legal'
  return result
end

-- The swap's verdict against maxLoss and the guards: nil when it is within them, else the reason.
local function loss_reason(ctx, swap)
  local v = swap.measured
  for i, s in ipairs(ctx.stats) do
    if i > 1 then
      local p = pct(v.delta[i], ctx.base.value[i])
      local loss = p and -p or (v.delta[i] < 0 and math.huge or 0)
      if loss > ctx.limits[s.stat] + 1e-9 then
        return ('%s would fall %.2f%%, more than %s%%'):format(s.stat, loss, tostring(ctx.limits[s.stat]))
      end
    end
  end
  local function guard(name, before, after, label)
    if type(before) ~= 'number' or type(after) ~= 'number' then return nil end
    local loss = before ~= 0 and (before - after) / math.abs(before) * 100 or (after < before and math.huge or 0)
    if loss > ctx.limits[name] + 1e-9 then
      return ('%s would fall %.2f%%, more than %s%%'):format(label, loss, tostring(ctx.limits[name]))
    end
    return nil
  end
  local why = guard('movement', ctx.base.move, v.move, 'movement speed')
  if why then return why end
  local clearBefore = ctx.baseClear
  local clearAfter = ctx.clearSeparate and swap.clear or v.clear
  if clearBefore and clearAfter and not clearAfter.err then
    why = guard('clearRadius', clearBefore.radius, clearAfter.radius, "the clear skill's radius")
    if why then return why end
    why = guard('clearUses', clearBefore.uses, clearAfter.uses, "the clear skill's uses per second")
    if why then return why end
  elseif clearAfter and clearAfter.err then
    return "the clear skill couldn't be measured: " .. clearAfter.err
  end
  return nil
end

-- ---------------------------------------------------------------------------------------------------
-- The call

local function node_entry(node)
  local entry = { id = node.id, name = node_name(node), type = tostring(node.type) }
  if node.isAttribute then entry.attribute = true end
  return entry
end

local function stats_entry(stats)
  local out = {}
  for i, s in ipairs(stats) do out[i] = { id = s.stat, label = tostring(s.label) } end
  return out
end

local function measure_call(params, ctx)
  local spec = build.spec
  local nStats = #ctx.stats
  local unalloc, alloc = run_pass(ctx)
  local result = {
    stats = stats_entry(ctx.stats),
    loadout = ctx.loadoutName,
    level = build.characterLevel,
    maxDistance = ctx.depth,
    base = {},
    measuredNodes = #unalloc + #alloc,
  }
  for i = 1, nStats do result.base[i] = ctx.base.value[i] end
  result.movement = ctx.base.move

  -- The clear entry.
  local clear = { group = ctx.clearGroup }
  local g = build.skillsTab.socketGroupList[ctx.clearGroup]
  clear.label = g and (g.displayLabel or g.label) or nil
  if ctx.clearSeparate then
    ctx.baseClear = ctx.measure_clear(nil)
  else
    ctx.baseClear = ctx.base.clear
  end
  if ctx.baseClear then
    clear.radius = ctx.baseClear.radius
    clear.usesPerSecond = ctx.baseClear.uses
    clear.minion = ctx.baseClear.minion
    clear.error = ctx.baseClear.err
  end
  result.clear = clear

  local failures = {}
  local byId = {}
  for _, e in ipairs(unalloc) do byId[e.id] = e end
  for _, e in ipairs(alloc) do byId[e.id] = e end

  -- The protected nodes.
  local prot = {}
  local keepUnallocated = {}
  for _, id in ipairs(ctx.keep) do
    if spec.allocNodes[id] then prot[id] = prot[id] or 'keep' else keepUnallocated[#keepUnallocated + 1] = id end
  end
  for id, node in pairs(spec.allocNodes) do
    if (node.allocMode or 0) ~= 0 then prot[id] = prot[id] or 'weapon set' end
    for _, line in ipairs(node.sd or {}) do
      if type(line) == 'string' and line:match('^%s*[Gg]rants [Ss]kill:') then prot[id] = prot[id] or 'grants a skill' end
    end
    if node.ascendancyName or is_start(node) then prot[id] = prot[id] or 'ascendancy or start' end
  end
  for _, lo in ipairs(ctx.protectFor) do
    local other = build.treeTab.specList[lo.specId]
    for id in pairs(spec.allocNodes) do
      local on = other and other.nodes[id]
      if on and on.alloc and not prot[id] then
        for _, d in ipairs(on.depends or {}) do
          if not spec.allocNodes[d.id] then prot[id] = 'built on by ' .. lo.name; break end
        end
      end
    end
  end
  result.keepNotAllocated = keepUnallocated
  -- The protected nodes, by reason (an ascendancy or start node protected for that alone isn't counted: no branch
  -- holds one). At the pin every "Grants Skill:" passive is an ascendancy node.
  local protectedBy = {}
  for _, why in pairs(prot) do
    if why ~= 'ascendancy or start' then
      local key = why:match('^built on by ') and 'later rung' or why
      protectedBy[key] = (protectedBy[key] or 0) + 1
    end
  end
  result.protected = protectedBy

  -- Best unallocated, by path gain per point on the first stat.
  local best = {}
  for _, e in ipairs(unalloc) do
    if e.path.err or (e.single and e.single.err) then
      failures[#failures + 1] = { id = e.id, name = node_name(e.node), error = e.path.err or e.single.err }
    else
      e.perPoint = e.path.delta[1] / e.dist
      if e.perPoint > 0 then best[#best + 1] = e end
    end
  end
  table.sort(best, function(a, b)
    if a.perPoint ~= b.perPoint then return a.perPoint > b.perPoint end
    if a.dist ~= b.dist then return a.dist < b.dist end
    return a.id < b.id
  end)

  -- Weakest allocated branches, by loss per point on the first stat, unprotected only.
  local weak = {}
  for _, e in ipairs(alloc) do
    local deps = e.node.depends or {}
    e.points = #deps == 0 and 1 or #deps
    e.set = {}
    for _, d in ipairs(deps) do e.set[d.id] = true end
    e.set[e.id] = true
    if e.branch.err or e.single.err then
      failures[#failures + 1] = { id = e.id, name = node_name(e.node), error = e.branch.err or e.single.err }
    else
      local protectedBy
      for id in pairs(e.set) do
        local n = spec.nodes[id]
        if prot[id] or not is_main(n) then protectedBy = prot[id] or 'ascendancy'; break end
      end
      e.protected = protectedBy
      e.lossPerPoint = -e.branch.delta[1] / e.points
      if not protectedBy then weak[#weak + 1] = e end
    end
  end
  table.sort(weak, function(a, b)
    if a.lossPerPoint ~= b.lossPerPoint then return a.lossPerPoint < b.lossPerPoint end
    if a.points ~= b.points then return a.points > b.points end
    return a.id < b.id
  end)

  -- Travel: the allocated, untagged main-tree nodes that give nothing on any stat alone.
  local points, travel, travelIds = 0, 0, {}
  for _, id in ipairs(sorted_ids(spec.allocNodes)) do
    local node = spec.nodes[id]
    if is_main(node) and (node.allocMode or 0) == 0 and not ctx.granted[id] then
      points = points + 1
      local e = byId[id]
      local nothing
      if e then
        if not e.single.err then
          nothing = true
          for i = 1, nStats do
            local d = e.single.delta[i]
            if math.abs(d) > 1e-9 * math.max(1, math.abs(ctx.base.value[i] or 0)) then nothing = false end
          end
        end
      elseif node.modKey == nil or node.modKey == '' then
        local jewel = spec.jewels and spec.jewels[id]
        nothing = not (jewel and jewel ~= 0)
      end
      if nothing then travel = travel + 1; travelIds[#travelIds + 1] = id end
    end
  end
  result.points = points
  result.travel = travel

  -- The best swap.
  ctx.estimate = function(id)
    local e = byId[id]
    if e then
      if e.node.alloc then return e.single.err and 0 or -e.single.delta[1] end
      if e.single and not e.single.err then return e.single.delta[1] end
    end
    local node = spec.nodes[id]
    if not node or node.modKey == nil or node.modKey == '' or ctx.granted[id] then return 0 end
    local v
    if node.alloc then
      v = ctx.measure(node.modKey .. '_remove', { removeNodes = { [node] = true } })
      return v.err and 0 or -v.delta[1]
    end
    v = ctx.measure(node.modKey, { addNodes = { [node] = true } })
    return v.err and 0 or v.delta[1]
  end
  local picked = {}
  for i = 1, math.min(SWAP_BRANCHES, #weak) do picked[i] = { row = weak[i], set = weak[i].set } end
  local swaps = {}
  local bestSwap
  if #picked > 0 then
    local orig = {}
    for id in pairs(spec.allocNodes) do orig[id] = true end
    local origCounts = start_counts(spec, orig)
    local scratch = new_scratch(spec)
    for _, p in ipairs(picked) do
      local s = try_swap(ctx, scratch, orig, origCounts, p)
      if s.verdict == 'legal' then
        local gain = s.measured.delta[1]
        s.gain = {}
        for i = 1, nStats do s.gain[i] = s.measured.delta[i] end
        if gain <= 0 then
          s.verdict = 'no-gain'
          s.reason = ('it changes %s by %s'):format(ctx.stats[1].stat, tostring(gain))
        else
          local why = loss_reason(ctx, s)
          if why then
            s.verdict = 'over-loss'
            s.reason = why
          elseif not bestSwap or gain > bestSwap.measured.delta[1] then
            bestSwap = s
          end
        end
      end
      swaps[#swaps + 1] = s
    end
  end

  local function swap_entry(s)
    local entry = { branch = s.branch, branchName = s.branchName, freed = s.freed, verdict = s.verdict, reason = s.reason }
    if s.gain then
      entry.gain = s.gain
      entry.gainPercent = {}
      for i = 1, nStats do
        local p = pct(s.gain[i], ctx.base.value[i])
        if p == nil then p = NULL end
        entry.gainPercent[i] = p
      end
      entry.movement = s.measured.move
      local c = ctx.clearSeparate and s.clear or s.measured.clear
      if c and not c.err then entry.clear = { radius = c.radius, usesPerSecond = c.uses } end
    end
    entry.used = s.used
    if s.added then
      entry.removed, entry.added = {}, {}
      for _, id in ipairs(s.removed) do entry.removed[#entry.removed + 1] = node_entry(spec.nodes[id]) end
      for _, id in ipairs(s.added) do
        local n = node_entry(spec.nodes[id])
        n.attributeChoice = s.attributes[id]
        entry.added[#entry.added + 1] = n
      end
    end
    return entry
  end
  result.bestSwap = bestSwap and swap_entry(bestSwap) or nil
  result.swaps = {}
  for _, s in ipairs(swaps) do result.swaps[#result.swaps + 1] = swap_entry(s) end

  -- The lists, `limit` rows each (none in the compact mode, limit 0).
  local limit = ctx.limit
  result.best = {}
  for i = 1, math.min(limit, #best) do
    local e = best[i]
    local row = node_entry(e.node)
    row.distance = e.dist
    row.path = path_ids(e.node)
    row.alone = figures(e.single, nStats)
    row.withPath = figures(e.path, nStats)
    row.perPoint = e.perPoint
    result.best[i] = row
  end
  result.weakest = {}
  for i = 1, math.min(limit, #weak) do
    local e = weak[i]
    local row = node_entry(e.node)
    row.points = e.points
    row.branch = sorted_ids(e.set)
    -- Losses: what removing the node alone, and with its dependants, takes away (PoB's figure negated).
    row.lossAlone, row.loss = {}, {}
    for k = 1, nStats do
      row.lossAlone[k] = -e.single.delta[k]
      row.loss[k] = -e.branch.delta[k]
    end
    row.lossPerPoint = e.lossPerPoint
    result.weakest[i] = row
  end
  if limit > 0 then result.travelNodes = travelIds end
  result.failures = failures
  result.calculations = ctx.calcs
  return result
end

-- get_passive_upgrades' candidates (D-417): every unallocated main-tree node the pass takes, with its path and the
-- raw `fields` of its path's output.
local function upgrades_call(ctx)
  local unalloc = run_pass(ctx)
  local out = { maxDistance = ctx.depth, candidates = {} }
  local base = {}
  for _, f in ipairs(ctx.fields) do
    local x = BuildOps.output_field(ctx.calcBase, f)
    if type(x) == 'number' then base[f] = x end
  end
  out.base = base
  for _, e in ipairs(unalloc) do
    local entry = node_entry(e.node)
    entry.distance = e.dist
    entry.path = path_ids(e.node)
    local stats = {}
    for _, line in ipairs(e.node.sd or {}) do stats[#stats + 1] = tostring(line) end
    entry.stats = stats
    if e.path.err then entry.error = e.path.err else entry.fields = e.path.fields end
    out.candidates[#out.candidates + 1] = entry
  end
  out.calculations = ctx.calcs
  return out
end

function M.node_power(params)
  if not build or not build.spec or not build.calcsTab or not build.skillsTab then fail('build not initialized') end
  local t0 = os.clock()
  local ctx = {}
  ctx.depth = params.maxDistance == nil and DEFAULT_DISTANCE or int_arg(params.maxDistance, 'maxDistance', 1, MAX_DISTANCE)

  if params.upgrades ~= nil then
    local fields = type(params.upgrades) == 'table' and params.upgrades.fields
    if type(fields) ~= 'table' or #fields == 0 then fail('upgrades.fields must list output fields') end
    ctx.mode, ctx.stats, ctx.fields, ctx.useFullDPS = 'upgrades', {}, fields, false
    BuildOps.get_main_output()
    local res = upgrades_call(ctx)
    res.cpuSeconds = os.clock() - t0
    return res
  end

  if type(params.stats) ~= 'table' or #params.stats < 1 or #params.stats > 3 then
    fail('stats must name 1 to 3 stats; the stats are: ' .. stat_list_text())
  end
  ctx.mode = 'power'
  ctx.stats = {}
  for i, name in ipairs(params.stats) do
    local s = resolve_stat(name)
    for _, prior in ipairs(ctx.stats) do
      if prior == s then fail(('stat "%s" is named twice'):format(tostring(name))) end
    end
    ctx.stats[i] = s
  end
  ctx.useFullDPS = false
  for _, s in ipairs(ctx.stats) do if s.stat == 'FullDPS' then ctx.useFullDPS = true end end
  ctx.limits = loss_limits(params.maxLoss, ctx.stats)
  ctx.limit = params.limit == nil and DEFAULT_LIMIT or int_arg(params.limit, 'limit', 0, nil)
  ctx.keep = id_list(params.keep, 'keep')

  -- Everything named is checked before anything changes.
  local target = params.loadout ~= nil and resolve_loadout(params.loadout, 'loadout') or nil
  ctx.protectFor = {}
  if params.protectFor ~= nil then
    if type(params.protectFor) ~= 'table' then fail('protectFor must be a list of loadout names') end
    for _, name in ipairs(params.protectFor) do ctx.protectFor[#ctx.protectFor + 1] = resolve_loadout(name, 'protectFor') end
  end
  local level
  if params.level ~= nil then level = int_arg(params.level, 'level', 1, 100) end

  local state = snapshot_state()
  local selection = snapshot_selection()
  local ok, res = pcall(function()
    if target and not same_sets(target) then build:SetActiveLoadout(target) end
    ctx.loadoutName = target and target.name or active_loadout_name()
    if not level and ctx.loadoutName then level = tonumber(ctx.loadoutName:match('%(L(%d+)%)')) end
    if level then
      build.characterLevel = level
      build.characterLevelAutoMode = false
      if build.configTab.BuildModList then build.configTab:BuildModList() end
    end
    build.buildFlag = true
    BuildOps.get_main_output()

    local groups = build.skillsTab.socketGroupList or {}
    ctx.clearGroup = params.clearGroup == nil and build.mainSocketGroup or int_arg(params.clearGroup, 'clearGroup', 1, nil)
    if not groups[ctx.clearGroup] then
      fail(('clear group %d: the loadout\'s skill set has %d socket groups'):format(ctx.clearGroup, #groups))
    end
    ctx.clearInMain = ctx.clearGroup == build.mainSocketGroup
    ctx.clearSeparate = not ctx.clearInMain
    local mainGroup = build.mainSocketGroup
    ctx.measure_clear = function(scratch)
      build.mainSocketGroup = ctx.clearGroup
      local okc, out = pcall(ctx.calcFunc, scratch and { spec = scratch } or {}, false)
      build.mainSocketGroup = mainGroup
      if okc and type(out) == 'table' then return clear_of(out) end
      return { err = plain(okc and "PoB's calculator returned no output" or out) }
    end
    return measure_call(params, ctx)
  end)
  local okRestore, restoreErr = pcall(restore_state, state, selection)
  if not ok then error(res, 0) end
  if not okRestore then error('putting the loadout and level back failed: ' .. tostring(restoreErr), 0) end
  res.cpuSeconds = os.clock() - t0
  return res
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
  node_power = handler(M.node_power),
}

return M
