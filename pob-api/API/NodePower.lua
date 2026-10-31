-- API/NodePower.lua
-- Node power (C-55, WU-92, D-417): PoB's own ranking of passive nodes, the tree tab's "Show node power" and its power
-- report, measured for one to three stats in one pass, with the best legal swap the tree has left (D-418).
--
--   node_power {stats[], maxDistance?, loadout?, level?, keep[]?, protectFor[]?, clearGroup?, maxLoss?, limit?, cull?,
--               rebuild?, free[]?, targets?, paceExchange?, poolGroups?}
--   node_power {upgrades {fields[]}, maxDistance?}         (get_passive_upgrades' candidates)
--
-- The pass is CalcsTab:PowerBuilder's (vendor Classes/CalcsTab.lua:521-680), run once for every stat asked for:
-- every Normal, Notable and Keystone node of the main tree whose modKey isn't empty, that no item grants and that no
-- locked ascendancy node hides, within `maxDistance` of the tree (node.pathDist, as PowerBuilder adjusts it for an
-- intuitive leap). PoB's own misc calculator (build.calcsTab:GetMiscCalculator()) measures each one: an unallocated
-- node alone (cached by modKey) and with its whole path (node.path) when it is more than 1 point away (R-61: not in
-- the compact mode, `limit` 0, which lists no node; the swaps and the rebuild read each node alone); an allocated
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
-- unknown name, each with the list. Beside them, `MainDamage` (D-437): the main group's damage figure, read from each
-- output by the compile record's Count rule (src/plan/record.ts COUNT_RULE): TotalDPS × Count, TotalDot × Count only
-- when the skill's damage over time stacks (PoB's DotCanStack), IgniteDPS, BleedDPS and PoisonDPS once; a minion's
-- is MinionTotalDPS × Count. Count is PoB's own for the main skill (calcs.getActiveSkillCount: the group's
-- groupCount, which the compile sets to the plan's count). With `cull`, the figure is multiplied by the output's
-- CullMultiplier, the field the compile record's `measures.damage.map` reads.
--
-- State (D-176): the call selects the loadout (build:SetActiveLoadout) and sets its level, by default the
-- "(L<level>)" in the loadout's name; it puts back the previous spec, item, skill and config sets and the level and
-- level mode at the end and on any error, so the exported build is unchanged. Measuring the clear group selects it
-- as the main group for its calculations only, and puts back the selection and every gem's fields after.
--
-- The best swap (D-418) is searched on a scratch PassiveSpec (built as BuildOps' set_tree builds one), for the weakest
-- unprotected branches in turn until 5 give a legal swap (at most 20 tried), then (D-439) for the pairs and triples of
-- the 5 weakest freed together, fewest points first, so a path longer than any one branch fits (at most 40 tried in
-- all; a combination that frees the same nodes as a try before it, or whose removal would disconnect a node outside
-- it, is left out). For each: remove the branch or branches,
-- import the tree without it so PoB recomputes every path, then add, greedily, the unallocated nodes with the best
-- gain per point on the first stat whose new paths fit the freed points, counting the union of their path nodes
-- once (a node's gain is its own measured gain alone; a removed node's, the loss its removal measured). The swap is
-- then imported whole and measured as one change with the misc calculator (override `spec`, as the tree tab's spec
-- tooltip measures a spec). It is returned only when it stays legal: every node it keeps or adds stays allocated
-- under PoB's weapon-set rule (the import drops a node that doesn't connect), no more main-tree points than before,
-- no start holding more trees than before or more than one (D-360 as D-364 states it), no weapon-set or ascendancy
-- node added or removed. An added attribute node takes PoB's default choice (PassiveSpec:AllocNode switches it to
-- spec.attributeIndex, else option 1) and is returned with it. The best swap gains most on the first stat with no
-- other stat losing more than its `maxLoss` (default 2%) and no guard losing more than its own: movement speed
-- (EffectiveMovementSpeedMod, default 0), the lowest of PoB's five per-type maximum hits taken (`maxHit`, D-439,
-- default 2%), and the clear entry's radius and uses per second (default 0 each), read as
-- src/plan/record.ts reads them (the minion's when the clear skill summons one), measured with `clearGroup`
-- (default the main group) as the main group. `clearGroup` is the plan's group number, as the compile record numbers
-- it (D-435): Compile.lua's group_indices, the groups without a `source` in order, then PoB's own, mapped to PoB's
-- index at call time; the reply's clear entry carries that number.
--
-- Protected, never removed with any branch containing them: `keep`; a node with a "Grants Skill:" line; a jewel
-- socket that holds a jewel in the loadout (the plan's treeJewels name it, so a tree without it can't compile); a
-- weapon-set node; for each loadout of `protectFor`, every node of this tree whose dependants in that loadout's
-- spec (node.depends there) include a node outside this tree. A branch whose removal would disconnect any node
-- outside it, in this tree or a protectFor loadout's (walked under the weapon-set rule, since PoB's depends leaves
-- out a weapon-set node hanging off an untagged branch), is protected too.
--
-- The pool moves (C-55a, D-426): beside the main swap, a second search for each weapon-set pool that has nodes (the
-- allocated main-tree nodes tagged 1, or 2), measured with that weapon set active, since a tagged node's lines apply
-- only on its own set (Condition:WeaponSet<n>, Modules/CalcSetup.lua:263-278). For the loadout's own set the pass's
-- calculator serves; for the other, the item set's useSecondWeaponSet is switched for the search alone and PoB's misc
-- calculator is built again (Modules/Calcs.lua getMiscCalculator, which reads the flag on every calculation), the
-- global skill cache wiped before and after. A pool's branch is one of its nodes with every node its removal cuts off
-- (under PoB's weapon-set rule a tagged node only holds up nodes of its own set), unprotected by the rules above but
-- the weapon-set one, ranked by loss per point on that set; for its weakest branches in turn (5 legal tries, at most
-- 20), remove the branch and add, greedily, nodes tagged to the same pool whose new paths fit the freed points: a
-- candidate paths from an untagged node or a node of the pool, and neither it nor its path holds a node PoB never
-- tags (a keystone, a jewel socket). It is legal when every node it keeps or adds stays allocated, no weapon-set tag
-- changes, every node it removes or adds is the pool's, the pool holds no more points than before by PoB's own count
-- (PassiveSpec:CountAllocNodes, as V1's weapon-set-points reads it), the other pool and the regular points don't grow,
-- and no start holds a second tree; then it is judged as the main swap is, against that set's own figures. A node
-- never moves between pools, or between a pool and the main tree. A pool move stays one branch at a time (D-439), and
-- on a weapon set that doesn't hold the main group (its socket group is in the other set's weapon slot) MainDamage
-- has no meaning, so that pool ranks and guards by Full DPS in its place (D-437); its entry then names its stats.
--
-- Two modes replace the swap search and the pool moves (D-439), each judged as one swap:
-- - `rebuild`: free every allocated main-tree node outside the protected ones (keep's and the socketed jewel sockets
--   included) and the tree that connects them to the start (the tree pruned, its least valuable node first, to a
--   minimal one that keeps them connected under the weapon-set rule and is one tree as the tree is), then refill the
--   freed points greedily by gain per point, PoB recomputing every path after each pick, from the nodes the pass
--   measured.
-- - `free` [ids]: free exactly those allocated, untagged main-tree nodes and the nodes their removal disconnects, then
--   refill the points greedily (as a swap does) from anything but the named nodes, and report the gain however the
--   refill is judged. A socketed jewel socket is never freed: naming one, or a node whose removal disconnects one, is
--   refused. D-467: nodes all tagged to one weapon set are freed within that set's pool and refilled from its
--   candidates, as a pool move (measured with that set active, ranked as that pool ranks).
--
-- D-467 (amendment 13 §8), each off when absent:
-- - `targets {ehp, maxHit}`: the toughness targets. The TotalEHP share of maxLoss and the maxHit guard no longer judge a
--   move: a swap, a rebuild or a free refill is legal only when its TotalEHP and lowest maximum hit are at or above
--   the targets. After a refill that misses one, the repair: free the allocated branch (a node and its dependants in the
--   refilled tree) outside the protected nodes, and outside what an earlier repair step added, with the least
--   first-stat loss per point (each node's own measured value, as the swap's refill counts it), and add, PoB
--   recomputing every path after each pick, the unallocated nodes whose paths fit with the most gain on the failing
--   targets per first-stat loss: a node's gain on each failing target as a share of that target's gap (EHP and max hit
--   both counted when both fail), over its first-stat cost (its new points at the freed branch's loss per point, less
--   its own first-stat gain); the points left go to the first stat, as a refill fills them. A step is taken when the
--   measured tree raises a failing target and closes the targets' combined shortfall; up to REPAIR_BRANCH_TRIES
--   branches are tried for each step, the weakest first, and the repair stops when both targets hold, no step raises a
--   failing target, or after MAX_REPAIR_STEPS steps. A result still short of a target is `misses-targets`, with its
--   figures. The swap search repairs each try, and a try the repair can't bring to the targets doesn't count toward the
--   SWAP_BRANCHES legal tries (MAX_TRIES stays). A pool move isn't repaired; its figures are measured with its set
--   active, so on the set the loadout doesn't hold its targets are the lower of the targets and that set's own
--   figures before the move.
-- - `paceExchange` r (D1-tree passes 3): each pace figure (movement speed, the clear entry's radius and uses per
--   second) may fall by L% when the move's MainDamage gain G% is at least r × L, each figure on its own; the three
--   pace guards' maxLoss values are then ignored. Refused when `stats` lack MainDamage.
-- - `poolGroups {"1"?, "2"?}`: a weapon-set pool ranks by that plan group's figure (the MainDamage Count rule on that
--   group, the group made the main one) on the boss config (`enemyIsBoss` "Pinnacle", the mod list rebuilt before and
--   after each such calculation, as Compile.lua's measure_boss sets it); its other stats and guards stay on the map
--   config.
-- - Always on, the attribute guard: a move is legal only when its result meets PoB's own ReqStr, ReqDex and ReqInt
--   (Str ≥ ReqStr and so on, as V1's `attributes` reads them, PoB's satisfaction flags already applied,
--   Modules/CalcPerform.lua:1832-1910).
-- D-463: a socketed Split Personality opens the start its variant names (PoB's alternateClassStart,
-- Classes/PassiveSpec.lua:1403-1412) only while its socket is reached without that start: start_counts counts the
-- trees leaving it, and unreached seeds it, under that rule, so a move that frees the class-side path to the socket
-- loses the start; a tree PoB's own looser rule connects is checked against it.
--
-- Registered by one line in Handlers.lua.

local BuildOps = require('API.BuildOps')
local Compile = require('API.Compile')
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
-- The single branches tried at most, illegal ones included, while looking for SWAP_BRANCHES legal tries.
local SINGLE_TRIES = 20
-- D-439: the swaps tried at most in all, the pairs and triples of the SWAP_BRANCHES weakest branches included.
local MAX_TRIES = 40
local DEFAULT_MAX_LOSS = 2
local GUARDS = { 'movement', 'clearRadius', 'clearUses', 'maxHit' }
-- Each guard's default limit, in percent: none of movement speed or the clear entry's figures; D-439's maxHit 2%.
local GUARD_DEFAULTS = { movement = 0, clearRadius = 0, clearUses = 0, maxHit = 2 }
-- PoB's per-type maximum hits taken (`<Type>MaximumHitTaken`, Modules/CalcDefence.lua), whose lowest maxHit guards.
local MAX_HIT_TYPES = { 'Physical', 'Fire', 'Cold', 'Lightning', 'Chaos' }
-- D-467: the repair's bounds: the steps at most, and the branches tried for one step.
local MAX_REPAIR_STEPS = 12
local REPAIR_BRANCH_TRIES = 6
-- D-467: the attribute guard's attributes: PoB's output field and its name.
local ATTRIBUTES = { { 'Str', 'Strength' }, { 'Dex', 'Dexterity' }, { 'Int', 'Intelligence' } }
-- D-467: the boss config a pool ranks on (Compile.lua's BOSS_VALUE).
local BOSS_VALUE = 'Pinnacle'
local MINUS = '\226\136\146'
-- D-437: the main group's damage figure, a stat of node power's own (see the header).
local MAIN_DAMAGE = { stat = 'MainDamage', label = 'Main damage', main = true }
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

-- Whether `spec`'s node `id` is a jewel socket holding a jewel (PassiveSpec.jewels: socket id -> item id, 0 for none).
local function holds_jewel(spec, id)
  local item = spec.jewels and spec.jewels[id]
  return item ~= nil and item ~= 0
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
  local out = { MAIN_DAMAGE }
  for _, s in ipairs(data.powerStatList or {}) do
    if s.stat and not s.ignoreForNodes then out[#out + 1] = s end
  end
  return out
end

-- PoB's Full DPS stat, which a pool move on a weapon set without the main group ranks by in MainDamage's place.
local function full_dps_stat()
  for _, s in ipairs(data.powerStatList or {}) do
    if s.stat == 'FullDPS' then return s end
  end
  return nil
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
  for _, g in ipairs(GUARDS) do limits[g] = GUARD_DEFAULTS[g] end
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

-- A finite number from an output field, else 0 (a field PoB leaves out, or NaN).
local function finite(x)
  x = tonumber(x)
  if x == nil or x ~= x or x == math.huge or x == -math.huge then return 0 end
  return x
end

-- D-437: the main group's damage figure in `out` (see the header); `ctx.figure` holds the main skill's Count, whether
-- its damage over time stacks and whether its figure is its minion's, read once per call (D-467: a pool's group
-- figure carries its group's own, `{ figure = … }`, and no cull).
local function main_damage(ctx, out)
  local f = ctx.figure or { count = 1 }
  local field = function(key) return finite(BuildOps.output_field(out, key)) end
  local v
  if f.minion then
    v = field('MinionTotalDPS') * f.count
  else
    v = field('TotalDPS') * f.count + field('TotalDot') * (f.dotStacks and f.count or 1)
      + field('IgniteDPS') + field('BleedDPS') + field('PoisonDPS')
  end
  if ctx.cull then
    local m = finite(BuildOps.output_field(out, 'CullMultiplier'))
    if m > 0 then v = v * m end
  end
  return v
end

-- D-439: the lowest of PoB's per-type maximum hits taken in `out` and its type (lowercase), or nil when PoB gives none.
local function lowest_max_hit(out)
  local low, lowType
  for _, t in ipairs(MAX_HIT_TYPES) do
    local x = tonumber(out[t .. 'MaximumHitTaken'])
    if x and x == x and (low == nil or x < low) then low, lowType = x, t:lower() end
  end
  return low, lowType
end

-- A stat's figure context: a pool group's figure (D-467) carries its own; MainDamage otherwise reads the call's.
local function figure_ctx(ctx, s)
  return s.figure and { figure = s.figure } or ctx
end

-- What the call reads from one output: each stat's change against the base (CalculatePowerStat), each stat's
-- value, the movement speed, the lowest maximum hit taken and its type, TotalEHP and the attributes with their
-- requirements (D-467), the clear entry when the clear group is the main one, and any raw fields asked for.
local function extract(ctx, out, calcBase)
  local v = { delta = {}, value = {} }
  local base = calcBase or ctx.calcBase
  for i, s in ipairs(ctx.stats) do
    if s.main then
      local fctx = figure_ctx(ctx, s)
      v.value[i] = main_damage(fctx, out)
      v.delta[i] = v.value[i] - main_damage(fctx, base)
    else
      v.value[i] = data.powerStatList.GetFromOutput(out, s)
      v.delta[i] = build.calcsTab:CalculatePowerStat(s, out, base)
    end
  end
  v.move = tonumber(out.EffectiveMovementSpeedMod)
  v.maxHit, v.maxHitType = lowest_max_hit(out)
  v.ehp = tonumber(out.TotalEHP)
  v.attr = {}
  for _, a in ipairs(ATTRIBUTES) do
    v.attr[a[1]] = tonumber(out[a[1]])
    v.attr['Req' .. a[1]] = tonumber(out['Req' .. a[1]])
  end
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

-- A measuring function over `calcFunc` (a misc calculator) against its `calcBase`, reading `sctx`'s stats, caching by
-- key; each calculation counts in counter.calcs.
local function measurer(counter, sctx, calcFunc, calcBase)
  local cache = {}
  return function(key, override)
    if key and cache[key] then return cache[key] end
    counter.calcs = counter.calcs + 1
    local ok, out = pcall(calcFunc, override, sctx.useFullDPS)
    local r
    if ok and type(out) == 'table' then r = extract(sctx, out, calcBase)
    else r = { err = plain(ok and "PoB's calculator returned no output" or out) } end
    if key then cache[key] = r end
    return r
  end
end

local function run_pass(ctx)
  local spec = build.spec
  local calcFunc, calcBase = build.calcsTab:GetMiscCalculator()
  ctx.calcFunc, ctx.calcBase = calcFunc, calcBase
  ctx.base = extract(ctx, calcBase)
  ctx.granted = (build.calcsTab.mainEnv and build.calcsTab.mainEnv.grantedPassives) or {}
  ctx.calcs = 0
  ctx.measure = measurer(ctx, ctx, calcFunc, calcBase)
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
            -- R-61 (D-467): the compact mode (limit 0) lists no node, so a node's path isn't measured; the swaps and the
            -- rebuild rank by each node alone.
            if ctx.compact then
              e.path = nil
            elseif dist > 1 then
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
-- Connectivity under PoB's weapon-set rule (PassiveSpec:CanPathThroughAllocMode): an untagged node connects through
-- untagged nodes only, a node tagged with weapon set n through untagged nodes and nodes tagged n. PoB's node.depends
-- explores from an untagged node through untagged nodes only, so it leaves out a weapon-set node that hangs off an
-- untagged branch; removing such a branch disconnects that node. This walks the tree itself.

-- D-463: the starts the socketed jewels of `alloc` (an id set over `spec`'s nodes) outside `removed` name: Split
-- Personality's alternateClassStart (Classes/Item.lua:2075-2077), the class start PoB paths through
-- (Classes/PassiveSpec.lua:1403-1412). A start that is the class's own adds nothing, so it is left out. Each entry is
-- {socket, start}.
local function jewel_starts(spec, alloc, removed)
  local out = {}
  local items = build and build.itemsTab and build.itemsTab.items
  local map = spec.tree and spec.tree.classStartNodeNameMap
  if not items or not map then return out end
  local classStart = spec.curClass and spec.curClass.startNodeId
  for _, socket in ipairs(sorted_ids(spec.jewels or {})) do
    local itemId = spec.jewels[socket]
    if itemId ~= 0 and alloc[socket] and not (removed and removed[socket]) then
      local item = items[itemId]
      local className = item and item.jewelData and item.jewelData.alternateClassStart
      local start = className and map[className]
      if start and start ~= classStart and spec.nodes[start] then out[#out + 1] = { socket = socket, start = start } end
    end
  end
  return out
end

-- The nodes each start reaches, by weapon-set mode (0, 1, 2), through the allocated main-tree nodes of `alloc` outside
-- `removed`: from the class start, the ascendancy's and any allocated alternate start, and `extra` (start ids).
local function reach_from(spec, alloc, removed, extra)
  local nodes = spec.nodes
  local reach = {}
  for mode = 0, 2 do
    local seen, queue, qi = {}, {}, 1
    local function seed(id)
      if not seen[id] then seen[id] = true; queue[#queue + 1] = id end
    end
    local classStart = spec.curClass and spec.curClass.startNodeId
    if classStart and nodes[classStart] then seed(classStart) end
    -- The ascendancy hangs from its own start; an allocated alternate start opens its main-tree exits.
    for id in pairs(alloc) do
      local n = nodes[id]
      if n and not removed[id] and (n.ascendancyName or is_start(n)) then seed(id) end
    end
    for _, id in ipairs(extra or {}) do seed(id) end
    while qi <= #queue do
      local cur = nodes[queue[qi]]; qi = qi + 1
      if cur and cur.type ~= 'Mastery' then
        for _, o in ipairs(cur.linked or {}) do
          if alloc[o.id] and not removed[o.id] and not seen[o.id] and is_main(o) then
            local m = o.allocMode or 0
            if m == 0 or m == mode then seed(o.id) end
          end
        end
      end
    end
    reach[mode] = seen
  end
  return reach
end

-- D-463: the jewel starts of `alloc` that are open: their socket (an untagged node) is reached without them.
local function open_jewel_starts(spec, alloc, removed)
  local js = jewel_starts(spec, alloc, removed)
  if #js == 0 then return {}, nil end
  local reach = reach_from(spec, alloc, removed)
  local open = {}
  for _, j in ipairs(js) do
    if reach[0][j.socket] then open[#open + 1] = j.start end
  end
  return open, reach
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
  -- D-463: a socketed Split Personality's start, while its socket is reached without it.
  for _, start in ipairs((open_jewel_starts(spec, set, {}))) do add_start('jewel:' .. start, nodes[start]) end
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

-- The allocated main-tree nodes of `alloc` (an id set over `spec`'s nodes) outside `removed` that no start reaches;
-- D-463: a socketed Split Personality's start is seeded only while its socket is reached without it.
local function unreached(spec, alloc, removed)
  local nodes = spec.nodes
  local open, reach = open_jewel_starts(spec, alloc, removed)
  if #open > 0 or not reach then reach = reach_from(spec, alloc, removed, open) end
  local out = {}
  for id in pairs(alloc) do
    local n = nodes[id]
    if not removed[id] and is_main(n) and not reach[n.allocMode or 0][id] then out[id] = true end
  end
  return out
end

-- A node of `alloc` that removing `removed` would disconnect, ignoring those `before` (unreached already), or nil.
local function disconnected(spec, alloc, removed, before)
  for id in pairs(unreached(spec, alloc, removed)) do
    if not before[id] then return id end
  end
  return nil
end

-- D-439's rebuild: the core it keeps, `alloc` pruned to a minimal connected tree that holds `fixed`. Every node outside
-- `fixed` is removed in turn, the least valuable first (`value`, its removal's loss on the first stat, then its id),
-- whenever no node left loses its connection to the start under the weapon-set rule and no start comes to hold more
-- trees than `origCounts` allows (shape_ok), until none can go. So the core stays one tree, as the tree was: the paths
-- it keeps to the protected nodes join, where the shortest path to each, taken alone, can leave from the start apart.
local function core_of(spec, alloc, fixed, origCounts, value)
  local set = {}
  for id in pairs(alloc) do set[id] = true end
  local before = unreached(spec, set, {})
  local order = {}
  for id in pairs(alloc) do
    if not fixed[id] then order[#order + 1] = { id = id, value = value(id) } end
  end
  table.sort(order, function(a, b)
    if a.value ~= b.value then return a.value < b.value end
    return a.id < b.id
  end)
  local changed = true
  while changed do
    changed = false
    for _, e in ipairs(order) do
      if set[e.id] and not disconnected(spec, set, { [e.id] = true }, before) then
        set[e.id] = nil
        if shape_ok(spec, set, origCounts) then changed = true else set[e.id] = true end
      end
    end
  end
  return set
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

-- C-55a: whether PoB can tag a node to a weapon set (PassiveSpec:AllocNode gives a keystone, a jewel socket or an
-- ascendancy node allocMode 0, Classes/PassiveSpec.lua:931-936).
local function taggable(node)
  return is_main(node) and node.type ~= 'Keystone' and node.type ~= 'Socket' and not node.containJewelSocket
end

-- One swap for `pick`: `set`, the node ids it frees; `rows`, the branches freed together (each {id, node, points}),
-- none for a rebuild or a free; see the header. With `ctx.pool` (C-55a), a pool move: the branch is the pool's, and
-- every node added is tagged to the pool. `pick.only` limits the nodes the refill aims at (its paths may cross
-- others); `pick.exclude`, nodes the refill never adds, nor a path through them; `pick.dynamic` (the rebuild)
-- re-imports the tree after each pick, so PoB recomputes every path from the tree as it grows. D-467's repair steps
-- start from another tree than the loadout's: `pick.base` (an id set, default `orig`) with `pick.tags` (its weapon-set
-- tags, by id, default the loadout's), `pick.points` the points the refill may use (default the freed count), and
-- `pick.score(newIds)` ranks the candidates (a score, or nil to pass one over) before, with `pick.thenFirst`, the
-- points left go by gain per point on the first stat; `pick.onPick(newIds)` hears each pick. Every legality check is
-- against the loadout's tree (`orig`).
local function try_swap(ctx, scratch, orig, origCounts, pick)
  local spec = build.spec
  local pool = ctx.pool
  local base = pick.base or orig
  local removed = pick.set
  local freed = pick.points or count(removed)
  local branches = {}
  for _, row in ipairs(pick.rows or {}) do
    branches[#branches + 1] = { id = row.id, name = node_name(row.node), points = row.points or count(row.set or {}) }
  end
  local result = { branches = branches, freed = count(removed) }
  local keepSet, keepIds = {}, {}
  for id in pairs(base) do
    if not removed[id] then keepSet[id] = true; keepIds[#keepIds + 1] = id end
  end
  table.sort(keepIds)
  local weaponSets = {}
  for id in pairs(keepSet) do
    local mode
    if pick.tags then mode = pick.tags[id] or 0 else mode = spec.nodes[id].allocMode or 0 end
    if mode ~= 0 then weaponSets[id] = mode end
  end
  local function overrides_for(set)
    local out = {}
    for id, ov in pairs(spec.hashOverrides or {}) do
      if set[id] and orig[id] then out[id] = ov end
    end
    return out
  end
  import(scratch, spec, keepIds, weaponSets, overrides_for(keepSet))
  for _, id in ipairs(keepIds) do
    if not scratch.allocNodes[id] then
      result.verdict = 'illegal'
      result.reason = (#branches > 1 and 'removing the branches disconnects ' or #branches == 1 and 'removing the branch disconnects '
        or 'freeing them disconnects ') .. node_name(spec.nodes[id])
      return result
    end
  end

  -- The candidates: every unallocated main-tree node PoB paths to from an untagged node within `limit` points; for a
  -- pool move, also from a node of the pool, and only a node that it and its path can be tagged to the pool.
  local function path_taggable(n)
    for _, p in ipairs(n.path or {}) do
      if not taggable(p) then return false end
    end
    return true
  end
  local function path_clear(n)
    if not pick.exclude then return true end
    for _, p in ipairs(n.path or {}) do
      if pick.exclude[p.id] then return false end
    end
    return true
  end
  local function candidates(limit)
    local cands = {}
    for _, id in ipairs(sorted_ids(scratch.nodes)) do
      local n = scratch.nodes[id]
      local rootMode = n.pathRoot and (n.pathRoot.allocMode or 0)
      if not n.alloc and REPORT_TYPES[n.type] and not n.ascendancyName and n.modKey ~= nil and n.modKey ~= ''
          and not ctx.granted[id] and n.path and #n.path >= 1 and #n.path <= limit
          and #(n.intuitiveLeapLikesAffecting or {}) == 0 and n.pathRoot
          and (rootMode == 0 or (pool ~= nil and rootMode == pool)) and (pool == nil or path_taggable(n))
          and (pick.only == nil or pick.only[id]) and path_clear(n) then
        cands[#cands + 1] = { id = id, path = path_ids(n) }
      end
    end
    return cands
  end

  -- Greedy: the best score (by default the estimated gain per new point on the first stat), the union of paths counted
  -- once.
  local function first_score(new)
    local gain = 0
    for _, pid in ipairs(new) do gain = gain + ctx.estimate(pid) end
    if gain > 0 then return gain / #new end
    return nil
  end
  local score = pick.score or first_score
  local chosen, used, banned = {}, 0, {}
  local cands = candidates(freed)
  while true do
    local best
    for _, c in ipairs(cands) do
      if not banned[c.id] and not chosen[c.id] then
        local new = {}
        for _, pid in ipairs(c.path) do
          if not chosen[pid] then new[#new + 1] = pid end
        end
        local cost = #new
        if cost >= 1 and used + cost <= freed then
          local sc = score(new)
          if sc and (not best or sc > best.score or (sc == best.score and cost < #best.new)) then
            best = { c = c, new = new, score = sc }
          end
        end
      end
    end
    if not best then
      if score ~= first_score and pick.thenFirst and used < freed then
        score = first_score
      else
        break
      end
    else
      local trial = {}
      for id in pairs(keepSet) do trial[id] = true end
      for id in pairs(chosen) do trial[id] = true end
      for _, pid in ipairs(best.new) do trial[pid] = true end
      if shape_ok(spec, trial, origCounts) then
        for _, pid in ipairs(best.new) do chosen[pid] = true end
        used = used + #best.new
        if pick.onPick then pick.onPick(best.new) end
        if pick.dynamic and used < freed then
          -- The tree as it now stands, so the next pick's path is PoB's own from it.
          local ids = {}
          for id in pairs(trial) do ids[#ids + 1] = id end
          table.sort(ids)
          local tags = {}
          for id, mode in pairs(weaponSets) do tags[id] = mode end
          if pool then for id in pairs(chosen) do tags[id] = pool end end
          import(scratch, spec, ids, tags, overrides_for(trial))
          cands = candidates(freed - used)
        end
      else
        banned[best.c.id] = true
      end
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
  result.chosen = sorted_ids(chosen)

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
  -- A pool move's chosen nodes are tagged to its pool (a removed node chosen again keeps its tag, the pool's); the kept
  -- nodes keep their tags.
  local finalTags = {}
  for id, mode in pairs(weaponSets) do finalTags[id] = mode end
  if pool then
    for id in pairs(chosen) do finalTags[id] = pool end
  end
  import(scratch, spec, finalIds, finalTags, overrides)
  result.final, result.tags = final, finalTags

  local function illegal(why)
    result.verdict = 'illegal'
    result.reason = why
    return result
  end
  for _, id in ipairs(finalIds) do
    if not scratch.allocNodes[id] then return illegal(node_name(spec.nodes[id]) .. ' would not connect') end
  end
  -- D-463: PoB paths through a socketed Split Personality's start whatever reaches its socket; the stricter rule (the
  -- socket reached without that start) is checked on the tree as imported, its tags PoB's.
  if ctx.jewelStarts then
    for id in pairs(unreached(scratch, final, {})) do
      if not ctx.origUnreached[id] then return illegal(node_name(spec.nodes[id]) .. ' would not connect') end
    end
  end
  local function main_points(set, s)
    local n = 0
    for id in pairs(set) do
      local node = s.nodes[id]
      if is_main(node) and (node.allocMode or 0) == 0 then n = n + 1 end
    end
    return n
  end
  if pool then
    -- V1's weapon-set-points and passive-points read PoB's own counts (CountAllocNodes, Compile.lua's stage_checks):
    -- the pool holds no more points than before, the other pool is unchanged, and the regular points don't grow.
    local used0, _, _, _, a1, a2 = spec:CountAllocNodes()
    local used1, _, _, _, b1, b2 = scratch:CountAllocNodes()
    local before, after = { a1, a2 }, { b1, b2 }
    if after[pool] > before[pool] then
      return illegal(('weapon set %d would hold %d points, more than its %d'):format(pool, after[pool], before[pool]))
    end
    if after[3 - pool] ~= before[3 - pool] then return illegal(('weapon set %d would change'):format(3 - pool)) end
    local regular0, regular1 = used0 - math.min(a1, a2), used1 - math.min(b1, b2)
    if regular1 > regular0 then
      return illegal(('it would spend more points: %d regular, against %d'):format(regular1, regular0))
    end
    if main_points(final, scratch) ~= main_points(orig, spec) then return illegal('the main tree would change') end
  elseif main_points(final, scratch) > main_points(orig, spec) then
    return illegal('it would spend more points')
  end
  local ok, start = shape_ok(spec, final, origCounts)
  if not ok then return illegal('a start would hold a second tree (' .. start .. ')') end
  for _, id in ipairs(finalIds) do
    local want = orig[id] and (spec.nodes[id].allocMode or 0) or (pool or 0)
    if (scratch.nodes[id].allocMode or 0) ~= want then return illegal('a weapon-set tag would change') end
  end
  for _, id in ipairs(added) do
    if spec.nodes[id].ascendancyName then return illegal('it would add an ascendancy node') end
  end
  for _, id in ipairs(removedNet) do
    local node = spec.nodes[id]
    if pool then
      if (node.allocMode or 0) ~= pool then return illegal(('it would remove a node outside weapon set %d'):format(pool)) end
    elseif node.ascendancyName or (node.allocMode or 0) ~= 0 then
      return illegal('it would remove a weapon-set or ascendancy node')
    end
    if holds_jewel(spec, id) then return illegal(('it would remove %s, which holds a jewel'):format(node_name(node))) end
  end

  local v = ctx.measure(nil, { spec = scratch }, true)
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

-- A percentage for a reason: two decimals, a sign before it.
local function signed_pct(x)
  return (x < 0 and MINUS or '+') .. ('%.2f%%'):format(math.abs(x))
end

-- D-467: the pace exchange (the user's 3× rule): each pace figure may fall by L% when the move's damage gain G% (its
-- MainDamage's, in percent; nil when it has none) is at least r × L, each figure on its own. `figures` lists
-- {label, loss} (loss in percent, positive when the figure falls); nil when every figure is within its exchange, else
-- the first over it, as Appendix A writes it: `<figure> −<L>% needs +<r×L>% damage, the move gains +<G>%`.
function M.pace_judge(r, gain, figures)
  for _, f in ipairs(figures) do
    local loss = tonumber(f.loss)
    if loss and loss > 1e-9 then
      local need = r * loss
      if gain == nil or gain ~= gain or gain < need - 1e-9 * math.max(1, need) then
        return ('%s %s%.2f%% needs +%.2f%% damage, the move gains %s'):format(f.label, MINUS, loss, need,
          (gain == nil or gain ~= gain) and 'nothing measurable' or signed_pct(gain))
      end
    end
  end
  return nil
end

-- D-467: the attribute guard: nil when `v`'s result meets PoB's own ReqStr, ReqDex and ReqInt, else why not.
local function attribute_reason(v)
  local a = v.attr
  if not a then return nil end
  for _, x in ipairs(ATTRIBUTES) do
    local have, need = a[x[1]], a['Req' .. x[1]]
    if need and need > 0 and (have or 0) < need then
      return ('%s would be %d, under the %d its gear and gems need'):format(x[2], math.floor((have or 0) + 0.5), math.floor(need + 0.5))
    end
  end
  return nil
end

-- D-467: whether `value` is at or above `target` (a hair of rounding allowed).
local function meets(value, target)
  if target == nil then return true end
  return type(value) == 'number' and value == value and value >= target - 1e-9 * math.max(1, math.abs(target))
end

-- D-467: the targets `v` misses, by key (`ehp`, `maxHit`), and the combined shortfall (each gap as a share of its
-- target, summed).
local function shortfall(targets, v)
  local failing, total = {}, 0
  for _, key in ipairs({ 'ehp', 'maxHit' }) do
    local t, x = targets[key], v[key]
    if not meets(x, t) then
      failing[key] = true
      local have = (type(x) == 'number' and x == x) and x or 0
      total = total + (t - have) / math.max(1e-9, math.abs(t))
    end
  end
  return failing, total
end

-- D-467: why `v` misses its targets (Appendix A's figures), or nil.
local function targets_reason(targets, v, repaired)
  local failing = shortfall(targets, v)
  if not next(failing) then return nil end
  local function fig(x)
    if type(x) ~= 'number' or x ~= x then return '?' end
    return tostring(math.floor(x + 0.5))
  end
  return ('misses its targets%s: EHP %s of %s, lowest max hit %s of %s'):format(repaired and ' after repair' or '',
    fig(v.ehp), fig(targets.ehp), fig(v.maxHit), fig(targets.maxHit))
end

-- The swap's verdict against maxLoss and the guards: nil when it is within them, else the reason. D-467: under
-- `targets`, TotalEHP's share of maxLoss and the maxHit guard don't judge (the targets do); with `paceExchange`, the
-- three pace figures are judged by the exchange, not their maxLoss.
local function loss_reason(ctx, swap)
  local v = swap.measured
  for i, s in ipairs(ctx.stats) do
    if i > 1 and not (ctx.targets and s.stat == 'TotalEHP') then
      local p = pct(v.delta[i], ctx.base.value[i])
      local loss = p and -p or (v.delta[i] < 0 and math.huge or 0)
      if loss > ctx.limits[s.stat] + 1e-9 then
        return ('%s would fall %.2f%%, more than %s%%'):format(s.stat, loss, tostring(ctx.limits[s.stat]))
      end
    end
  end
  local function lossOf(before, after)
    if type(before) ~= 'number' or type(after) ~= 'number' then return nil end
    return before ~= 0 and (before - after) / math.abs(before) * 100 or (after < before and math.huge or 0)
  end
  local function guard(name, before, after, label)
    local loss = lossOf(before, after)
    if loss and loss > ctx.limits[name] + 1e-9 then
      return ('%s would fall %.2f%%, more than %s%%'):format(label, loss, tostring(ctx.limits[name]))
    end
    return nil
  end
  local clearBefore = ctx.baseClear
  local clearAfter = ctx.clearSeparate and swap.clear or v.clear
  local clearOk = clearBefore and clearAfter and not clearAfter.err
  local why
  if ctx.paceExchange then
    local i = ctx.mainIndex
    local gain = i and pct(v.delta[i], ctx.base.value[i]) or nil
    why = M.pace_judge(ctx.paceExchange, gain, {
      { label = 'movement speed', loss = lossOf(ctx.base.move, v.move) },
      { label = "the clear skill's radius", loss = clearOk and lossOf(clearBefore.radius, clearAfter.radius) or nil },
      { label = "the clear skill's uses per second", loss = clearOk and lossOf(clearBefore.uses, clearAfter.uses) or nil },
    })
    if why then return why end
  else
    why = guard('movement', ctx.base.move, v.move, 'movement speed')
    if why then return why end
  end
  if not ctx.targets then
    why = guard('maxHit', ctx.base.maxHit, v.maxHit, 'the lowest maximum hit taken')
    if why then return why end
  end
  if clearAfter and clearAfter.err then
    return "the clear skill couldn't be measured: " .. clearAfter.err
  end
  if clearOk and not ctx.paceExchange then
    why = guard('clearRadius', clearBefore.radius, clearAfter.radius, "the clear skill's radius")
    if why then return why end
    why = guard('clearUses', clearBefore.uses, clearAfter.uses, "the clear skill's uses per second")
    if why then return why end
  end
  return nil
end

-- D-467: `fn()` with the active config set's `enemyIsBoss` set to "Pinnacle" and the mod lists rebuilt (as Compile.lua's
-- measure_boss sets the boss config), then put back and rebuilt, on an error too.
local function with_boss(fn)
  local ct = build.configTab
  local cs = ct.configSets and ct.configSets[ct.activeConfigSetId]
  local input = cs and cs.input or ct.input
  local prior = input.enemyIsBoss
  input.enemyIsBoss = BOSS_VALUE
  ct:BuildModList()
  local ok, res = pcall(fn)
  input.enemyIsBoss = prior
  ct:BuildModList()
  if not ok then error(res, 0) end
  return res
end

-- D-437: what MainDamage reads, from the main skill PoB just calculated: its Count (calcs.getActiveSkillCount, the group's
-- groupCount), whether its damage over time stacks (DotCanStack on its stat set's flags, as Compile.lua's
-- main_dot_can_stack reads it) and whether its figure is its minion's (the main output has the minion's).
local function figure_params()
  local env = build.calcsTab.mainEnv
  local skill = env and env.player and env.player.mainSkill
  local n = 1
  if skill and build.calcsTab.calcs and build.calcsTab.calcs.getActiveSkillCount then
    local okCount, c = pcall(build.calcsTab.calcs.getActiveSkillCount, skill)
    if okCount and tonumber(c) and tonumber(c) >= 1 then n = tonumber(c) end
  end
  local statSet = skill and skill.activeEffect and skill.activeEffect.statSet
  local mainOutput = build.calcsTab.mainOutput
  return {
    count = n,
    dotStacks = statSet ~= nil and type(statSet.skillFlags) == 'table' and statSet.skillFlags.DotCanStack == true,
    minion = type(mainOutput) == 'table' and type(mainOutput.Minion) == 'table',
  }
end

-- D-463 (tests): the loaded spec's shape as node power reads it: each open start's tree count (`class`, `alt:<id>`,
-- `jewel:<start id>`), the allocated main-tree nodes no open start reaches, and the socketed jewels' starts.
function M.tree_shape(spec)
  spec = spec or build.spec
  local alloc = {}
  for id in pairs(spec.allocNodes) do alloc[id] = true end
  return { startCounts = start_counts(spec, alloc), unreached = sorted_ids(unreached(spec, alloc, {})),
    jewelStarts = jewel_starts(spec, alloc, {}) }
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
  -- D-439: `free` names allocated main-tree nodes of the loadout's tree, none a socketed jewel socket nor one whose
  -- removal disconnects such a socket; checked, and the set it frees found, before the pass runs. D-467: all untagged
  -- (a main move), or all tagged to one weapon set (that set's pool move, `ctx.freePool`).
  if ctx.free then
    local set = {}
    local mode, first
    for _, id in ipairs(ctx.free) do
      local n = spec.nodes[id]
      if not spec.allocNodes[id] then
        fail(('free: %s [%d] isn\'t allocated in this loadout'):format(node_name(n), id))
      elseif not is_main(n) then
        fail(('free: %s [%d] is an ascendancy or start node; free takes main-tree nodes'):format(node_name(n), id))
      elseif mode ~= nil and (n.allocMode or 0) ~= mode then
        local function what(m) return m == 0 and 'untagged' or ('tagged to weapon set ' .. m) end
        fail(('free: %s [%d] is %s and %s [%d] %s; free takes untagged nodes, or nodes of one weapon set'):format(
          node_name(spec.nodes[first]), first, what(mode), node_name(n), id, what(n.allocMode or 0)))
      elseif holds_jewel(spec, id) then
        fail(('free: %s [%d] holds a jewel in this loadout, which the plan\'s treeJewels name; free takes nodes without one')
          :format(node_name(n), id))
      end
      set[id] = true
      if mode == nil then mode, first = n.allocMode or 0, id end
    end
    if mode ~= 0 then ctx.freePool = mode end
    local all = {}
    for id in pairs(spec.allocNodes) do all[id] = true end
    local before = unreached(spec, all, {})
    for _, d in ipairs(sorted_ids(unreached(spec, all, set))) do
      if not before[d] then
        if holds_jewel(spec, d) then
          fail(('free: removing them disconnects %s [%d], which holds a jewel in this loadout; free takes nodes whose removal '
            .. 'leaves every socketed jewel connected'):format(node_name(spec.nodes[d]), d))
        end
        set[d] = true
      end
    end
    ctx.freeSet = set
  end
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
  result.maxHit = ctx.base.maxHit
  -- D-467: the base's TotalEHP and its lowest max hit's type; the targets and the pace exchange in force.
  result.ehp = ctx.base.ehp
  result.maxHitType = ctx.base.maxHitType
  result.targets = ctx.targets
  result.paceExchange = ctx.paceExchange
  -- The limits in force, in percent: each stat after the first, and each guard (maxLoss's keys).
  result.limits = {}
  for i, s in ipairs(ctx.stats) do
    if i > 1 then result.limits[s.stat] = ctx.limits[s.stat] end
  end
  for _, g in ipairs(GUARDS) do result.limits[g] = ctx.limits[g] end

  -- The clear entry, numbered as the plan numbers its groups (D-435).
  local clear = { group = ctx.clearNumber }
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

  -- The protected nodes. `poolProt` (C-55a) holds the same protections but the weapon-set one, which the pool moves
  -- lift for their own pool.
  local prot, poolProt = {}, {}
  local keepUnallocated = {}
  for _, id in ipairs(ctx.keep) do
    if spec.allocNodes[id] then
      prot[id] = prot[id] or 'keep'
      poolProt[id] = poolProt[id] or 'keep'
    else
      keepUnallocated[#keepUnallocated + 1] = id
    end
  end
  for id, node in pairs(spec.allocNodes) do
    if (node.allocMode or 0) ~= 0 then prot[id] = prot[id] or 'weapon set' end
    for _, line in ipairs(node.sd or {}) do
      if type(line) == 'string' and line:match('^%s*[Gg]rants [Ss]kill:') then
        prot[id] = prot[id] or 'grants a skill'
        poolProt[id] = poolProt[id] or 'grants a skill'
      end
    end
    if node.ascendancyName or is_start(node) then
      prot[id] = prot[id] or 'ascendancy or start'
      poolProt[id] = poolProt[id] or 'ascendancy or start'
    end
    if holds_jewel(spec, id) then
      prot[id] = prot[id] or 'holds a jewel'
      poolProt[id] = poolProt[id] or 'holds a jewel'
    end
  end
  for _, lo in ipairs(ctx.protectFor) do
    local other = build.treeTab.specList[lo.specId]
    for id in pairs(spec.allocNodes) do
      local on = other and other.nodes[id]
      if on and on.alloc and (not prot[id] or not poolProt[id]) then
        for _, d in ipairs(on.depends or {}) do
          if not spec.allocNodes[d.id] then
            prot[id] = prot[id] or ('built on by ' .. lo.name)
            poolProt[id] = poolProt[id] or ('built on by ' .. lo.name)
            break
          end
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
    if (e.path and e.path.err) or (e.single and e.single.err) then
      failures[#failures + 1] = { id = e.id, name = node_name(e.node), error = (e.path and e.path.err) or e.single.err }
    elseif e.path then
      e.perPoint = e.path.delta[1] / e.dist
      if e.perPoint > 0 then best[#best + 1] = e end
    end
  end
  table.sort(best, function(a, b)
    if a.perPoint ~= b.perPoint then return a.perPoint > b.perPoint end
    if a.dist ~= b.dist then return a.dist < b.dist end
    return a.id < b.id
  end)

  -- Weakest allocated branches, by loss per point on the first stat, unprotected only. A branch is protected when it
  -- holds a protected node, or when removing it would disconnect a node outside it: in this tree (a weapon-set node
  -- PoB's depends leaves out), or in a protect_for loadout's tree (a node a later rung builds on).
  local allocSet = {}
  for id in pairs(spec.allocNodes) do allocSet[id] = true end
  local trees = { { spec = spec, alloc = allocSet, before = unreached(spec, allocSet, {}) } }
  for _, lo in ipairs(ctx.protectFor) do
    local other = build.treeTab.specList[lo.specId]
    if other then
      local set = {}
      for id in pairs(other.allocNodes) do set[id] = true end
      trees[#trees + 1] = { spec = other, alloc = set, before = unreached(other, set, {}), name = lo.name }
    end
  end
  local held = 0
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
      if not protectedBy then
        for _, t in ipairs(trees) do
          local lost = disconnected(t.spec, t.alloc, e.set, t.before)
          if lost then
            protectedBy = t.name and ('built on by ' .. t.name) or ('holds up ' .. node_name(spec.nodes[lost]))
            held = held + 1
            break
          end
        end
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
  result.heldBranches = held
  local orig = {}
  for id in pairs(spec.allocNodes) do orig[id] = true end
  local origCounts = start_counts(spec, orig)
  local scratch

  -- D-463: the stricter start rule try_swap checks a tree against, when a socketed jewel opens a start.
  ctx.origUnreached = trees[1].before
  ctx.jewelStarts = #jewel_starts(spec, allocSet, {}) > 0

  -- D-467: a node's measured effect alone on the pass's base: its first-stat change, and its TotalEHP and lowest max hit
  -- changes (an allocated node's removal negated, as `estimate` reads it); nil when PoB gives none.
  local effects = {}
  local function effect(id)
    if effects[id] ~= nil then return effects[id] or nil end
    local node = spec.nodes[id]
    local out = false
    if node and node.modKey ~= nil and node.modKey ~= '' and not ctx.granted[id] then
      local e = byId[id]
      local v, sign
      if node.alloc then
        v = (e and e.single) or ctx.measure(node.modKey .. '_remove', { removeNodes = { [node] = true } })
        sign = -1
      else
        v = (e and e.single) or ctx.measure(node.modKey, { addNodes = { [node] = true } })
        sign = 1
      end
      if v and not v.err then
        local b = ctx.base
        out = {
          first = sign * v.delta[1],
          ehp = sign * ((v.ehp or 0) - (b.ehp or 0)),
          maxHit = sign * ((v.maxHit or 0) - (b.maxHit or 0)),
        }
      end
    end
    effects[id] = out
    return out or nil
  end

  -- The main tree's regular points: the allocated, untagged main-tree nodes of `set` in `s`.
  local function main_points(set, s)
    local n = 0
    for id in pairs(set) do
      local node = s.nodes[id]
      if is_main(node) and (node.allocMode or 0) == 0 then n = n + 1 end
    end
    return n
  end
  local origMain = main_points(orig, spec)

  -- D-467: the repair (see the header) of `s`, a legal main-tree refill that misses a target of `c`: the repaired swap,
  -- its `repair` the steps taken (each {freed, added}: node ids), with `s`'s branches.
  local function repair(c, s)
    local targets = c.targets
    local cur, steps, repairAdded = s, {}, {}
    for _ = 1, MAX_REPAIR_STEPS do
      local failing, short = shortfall(targets, cur.measured)
      if not next(failing) then break end
      -- The refilled tree as PoB holds it: each allocated, untagged main-tree node with its dependants there (its
      -- branch), none protected, added by an earlier step, or holding up a node outside it.
      local R, tags = cur.final, cur.tags
      local ids = sorted_ids(R)
      local ov = {}
      for id, o in pairs(spec.hashOverrides or {}) do if R[id] and orig[id] then ov[id] = o end end
      import(scratch, spec, ids, tags, ov)
      local before = unreached(scratch, R, {})
      local rows = {}
      for _, id in ipairs(ids) do
        local n = scratch.nodes[id]
        if is_main(n) and (n.allocMode or 0) == 0 and not prot[id] and not repairAdded[id] and not ctx.granted[id]
            and not holds_jewel(spec, id) then
          local set = { [id] = true }
          for _, d in ipairs(n.depends or {}) do set[d.id] = true end
          local ok = true
          for d in pairs(set) do
            local dn = scratch.nodes[d]
            if prot[d] or repairAdded[d] or not is_main(dn) or (dn.allocMode or 0) ~= 0 or holds_jewel(spec, d) then
              ok = false
              break
            end
          end
          if ok and disconnected(scratch, R, set, before) then ok = false end
          if ok then
            local value = 0
            for d in pairs(set) do
              local ef = effect(d)
              value = value + (ef and ef.first or 0)
            end
            local points = count(set)
            rows[#rows + 1] = { id = id, set = set, points = points, lossPerPoint = value / points }
          end
        end
      end
      table.sort(rows, function(a, b)
        if a.lossPerPoint ~= b.lossPerPoint then return a.lossPerPoint < b.lossPerPoint end
        if a.points ~= b.points then return a.points > b.points end
        return a.id < b.id
      end)
      local spare = math.max(0, origMain - main_points(R, scratch))
      local gaps = {}
      for key in pairs(failing) do gaps[key] = math.max(1e-9, targets[key] - (cur.measured[key] or 0)) end
      local tiny = 1e-9 * math.max(1, math.abs(c.base.value[1] or 0))
      local taken
      for k = 1, math.min(REPAIR_BRANCH_TRIES, #rows) do
        local row = rows[k]
        local blpp = math.max(row.lossPerPoint, 0)
        -- What the picks so far are estimated to leave of each gap: the toughness picks stop once none is left, and a
        -- pick's gain counts only up to what is left (toughness past a target buys nothing).
        local left = {}
        for key, gap in pairs(gaps) do left[key] = gap end
        -- A candidate's gain on the failing targets (each as a share of its gap) per first-stat loss: its new points at
        -- the freed branch's loss per point, less its own first-stat gain.
        local function score(new)
          local open = false
          for _, x in pairs(left) do if x > 0 then open = true end end
          if not open then return nil end
          local gain, first = {}, 0
          for _, pid in ipairs(new) do
            local ef = effect(pid)
            if ef then
              for key in pairs(left) do gain[key] = (gain[key] or 0) + ef[key] end
              first = first + ef.first
            end
          end
          local g = 0
          for key, x in pairs(left) do
            if x > 0 then g = g + math.min(gain[key] or 0, x) / gaps[key] end
          end
          if g <= 0 then return nil end
          return g / math.max(#new * blpp - first, #new * tiny)
        end
        local function onPick(new)
          for _, pid in ipairs(new) do
            local ef = effect(pid)
            if ef then
              for key in pairs(left) do left[key] = left[key] - ef[key] end
            end
          end
        end
        local t = try_swap(c, scratch, orig, origCounts, {
          rows = {}, set = row.set, base = R, tags = tags, points = row.points + spare, score = score, thenFirst = true,
          exclude = row.set, dynamic = true, onPick = onPick,
        })
        if t.verdict == 'legal' then
          local _, short2 = shortfall(targets, t.measured)
          local raised = false
          for key in pairs(failing) do
            if (t.measured[key] or 0) > (cur.measured[key] or 0) then raised = true end
          end
          if raised and short2 < short then
            taken = t
            steps[#steps + 1] = { freed = sorted_ids(row.set), added = t.chosen or {} }
            for _, id in ipairs(t.chosen or {}) do repairAdded[id] = true end
            break
          end
        end
      end
      if not taken then break end
      cur = taken
    end
    if cur ~= s then cur.branches, cur.freed, cur.used = s.branches, s.freed, s.used end
    cur.repair = steps
    return cur
  end

  -- A legal swap's figures against `c`'s base (the pass's, or a pool's set's): D-467's targets (after the repair, on a
  -- main move), the attribute guard, no gain, over the limits, or kept.
  local function judge(c, s)
    if s.verdict ~= 'legal' then return end
    local gain = s.measured.delta[1]
    s.gain = {}
    for i = 1, nStats do s.gain[i] = s.measured.delta[i] end
    if c.targets then
      local miss = targets_reason(c.targets, s.measured, s.repair ~= nil)
      if miss then
        s.verdict = 'misses-targets'
        s.reason = miss
        return
      end
    end
    local why = attribute_reason(s.measured)
    if why then
      s.verdict = 'illegal'
      s.reason = why
    elseif gain <= 0 then
      s.verdict = 'no-gain'
      s.reason = ('it changes %s by %s'):format(c.stats[1].stat, tostring(gain))
    else
      why = loss_reason(c, s)
      if why then
        s.verdict = 'over-loss'
        s.reason = why
      end
    end
  end

  -- D-467: a measured move judged, repaired first when it is a main move under `targets` that misses one.
  local function settle(c, s)
    if s.verdict == 'legal' and c.targets and not c.noRepair and next((shortfall(c.targets, s.measured))) then
      s = repair(c, s)
    end
    judge(c, s)
    return s
  end

  -- An id set's key, to tell the sets a search frees apart.
  local function set_key(set)
    return table.concat(sorted_ids(set), ',')
  end

  -- D-439: the pairs and triples of the SWAP_BRANCHES weakest of `rows`, each freed together as one set, fewest points
  -- first (then in the rows' order); a set already freed (`seen`: a branch holding the other, or a branch tried alone)
  -- is left out, and so is one whose removal would disconnect a node outside it, in this tree or a protect_for one.
  local function combinations(rows, seen)
    local top = {}
    for i = 1, math.min(SWAP_BRANCHES, #rows) do top[i] = rows[i] end
    local out = {}
    local function add(list)
      local set = {}
      for _, e in ipairs(list) do
        for id in pairs(e.set) do set[id] = true end
      end
      local key = set_key(set)
      if seen[key] then return end
      seen[key] = true
      for _, t in ipairs(trees) do
        if disconnected(t.spec, t.alloc, set, t.before) then return end
      end
      out[#out + 1] = { rows = list, set = set, points = count(set), seq = #out + 1 }
    end
    for a = 1, #top do
      for b = a + 1, #top do add({ top[a], top[b] }) end
    end
    for a = 1, #top do
      for b = a + 1, #top do
        for d = b + 1, #top do add({ top[a], top[b], top[d] }) end
      end
    end
    table.sort(out, function(x, y)
      if x.points ~= y.points then return x.points < y.points end
      return x.seq < y.seq
    end)
    return out
  end

  -- The branches `rows` in turn, until SWAP_BRANCHES of them give a legal swap to measure (an illegal one doesn't
  -- count, nor, D-467, one the repair can't bring to the targets), the list ends, or SINGLE_TRIES are tried; then, with
  -- `together` (the main swap, D-439), the pairs and triples of the weakest, until MAX_TRIES in all. Each swap tried and
  -- the best, judged against `c` (each main try repaired under `targets`).
  local function search(c, rows, together)
    local tried, bestOne = {}, nil
    if #rows == 0 then return tried, nil end
    scratch = scratch or new_scratch(spec)
    local function attempt(pick)
      local s = settle(c, try_swap(c, scratch, orig, origCounts, pick))
      if s.verdict == 'legal' and (not bestOne or s.measured.delta[1] > bestOne.measured.delta[1]) then bestOne = s end
      tried[#tried + 1] = s
      return s
    end
    local legalTries = 0
    local seen = {}
    for i, e in ipairs(rows) do
      if legalTries >= SWAP_BRANCHES or i > SINGLE_TRIES then break end
      seen[set_key(e.set)] = true
      local s = attempt({ rows = { e }, set = e.set })
      if s.verdict ~= 'illegal' and s.verdict ~= 'misses-targets' then legalTries = legalTries + 1 end
    end
    if together then
      for _, pick in ipairs(combinations(rows, seen)) do
        if #tried >= MAX_TRIES then break end
        attempt(pick)
      end
    end
    return tried, bestOne
  end

  local function swap_entry(s, c)
    local entry = { branches = s.branches, freed = s.freed, verdict = s.verdict, reason = s.reason }
    if s.gain then
      entry.gain = s.gain
      entry.gainPercent = {}
      for i = 1, nStats do
        local p = pct(s.gain[i], c.base.value[i])
        if p == nil then p = NULL end
        entry.gainPercent[i] = p
      end
      entry.movement = s.measured.move
      entry.maxHit = s.measured.maxHit
      -- D-467: the move's TotalEHP and its lowest max hit's type.
      entry.ehp = s.measured.ehp
      entry.maxHitType = s.measured.maxHitType
      local cl = ctx.clearSeparate and s.clear or s.measured.clear
      if cl and not cl.err then entry.clear = { radius = cl.radius, usesPerSecond = cl.uses } end
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
    -- D-467: the repair's steps, each the points it freed and the points it added, by node.
    if s.repair then
      entry.repair = {}
      for _, step in ipairs(s.repair) do
        local freedNodes, addedNodes = {}, {}
        for _, id in ipairs(step.freed) do freedNodes[#freedNodes + 1] = node_entry(spec.nodes[id]) end
        for _, id in ipairs(step.added) do addedNodes[#addedNodes + 1] = node_entry(spec.nodes[id]) end
        entry.repair[#entry.repair + 1] = { freed = freedNodes, added = addedNodes }
      end
    end
    return entry
  end

  -- C-55a (D-426): the weapon-set pools, the allocated main-tree nodes tagged 1 or 2 (see the header).
  local pools = { {}, {} }
  for id, node in pairs(spec.allocNodes) do
    local m = node.allocMode or 0
    if m ~= 0 and is_main(node) then pools[m][id] = true end
  end
  local itemSet = build.itemsTab.activeItemSet
  local active = itemSet and itemSet.useSecondWeaponSet and 2 or 1
  -- D-437: the weapon sets that hold the main group: the set of the weapon slot its socket group is in, else both.
  local mainGroup = build.skillsTab.socketGroupList[build.mainSocketGroup]
  local mainSlot = mainGroup and mainGroup.slot and build.itemsTab.slots[mainGroup.slot]
  local mainSet = mainSlot and tonumber(mainSlot.weaponSet) or nil
  local fullDps = full_dps_stat()

  -- D-467: a pool group's figure on the boss config: the misc calculator's output with the group the main one.
  local function boss_output(calcFunc, pg, override)
    return with_boss(function()
      local prior = build.mainSocketGroup
      build.mainSocketGroup = pg.index
      local ok, out = pcall(calcFunc, override, false)
      build.mainSocketGroup = prior
      if not ok then error(out, 0) end
      return out
    end)
  end

  -- D-467: a pool's measurer when it ranks by a group's figure (`poolGroups`): the first stat from the boss config;
  -- with `full` (a move's own measure), every other figure from the map config too. Cached by key, as `measurer`.
  local function group_measurer(c, calcFunc, mapBase, pg)
    local cache = {}
    return function(key, override, full)
      local hit = key and cache[key]
      if hit and (hit.full or not full) then return hit end
      ctx.calcs = ctx.calcs + 1
      local okR, outR = pcall(boss_output, calcFunc, pg, override)
      local r
      if not okR or type(outR) ~= 'table' then
        r = { err = plain(okR and "PoB's calculator returned no output" or outR) }
      elseif full then
        ctx.calcs = ctx.calcs + 1
        local ok, out = pcall(calcFunc, override, c.useFullDPS)
        if ok and type(out) == 'table' then
          r = extract(c, out, mapBase)
          r.full = true
        else
          r = { err = plain(ok and "PoB's calculator returned no output" or out) }
        end
      else
        r = { delta = {}, value = {} }
      end
      if not r.err then
        r.value[1] = main_damage({ figure = pg.figure }, outR)
        r.delta[1] = r.value[1] - c.rankBaseValue
      end
      if key then cache[key] = r end
      return r
    end
  end

  -- The context of pool m's search: the pass's for the loadout's own set; for the other, PoB's misc calculator built
  -- with that set active (the caller switches it), its base, clear entry and estimates its own. On a set that doesn't
  -- hold the main group, MainDamage is Full DPS (D-437): the stats, limits and estimates are the pool's own. D-467:
  -- with `poolGroups`, the pool ranks by its group's figure on the boss config; under `targets`, a pool on the set the
  -- loadout doesn't hold keeps the lower of the targets and its own figures; a pool move isn't repaired.
  local function pool_context(m)
    local c = setmetatable({ pool = m, noRepair = true }, { __index = ctx })
    local pg = ctx.poolGroups and ctx.poolGroups[m]
    local swapped = false
    if mainSet ~= nil and mainSet ~= m and fullDps then
      local stats, limits = {}, setmetatable({}, { __index = ctx.limits })
      for i, s in ipairs(ctx.stats) do
        if s.main then
          stats[i] = fullDps
          swapped = true
          if i > 1 then limits[fullDps.stat] = ctx.limits[s.stat] end
        else
          stats[i] = s
        end
      end
      if swapped then
        c.stats, c.limits, c.useFullDPS = stats, limits, true
      end
    end
    if pg then
      local stats = {}
      for i, s in ipairs(rawget(c, 'stats') or ctx.stats) do stats[i] = s end
      -- The group's own Count, damage-over-time stacking and minion reading, from PoB's calculation with it the main group.
      local prior = build.mainSocketGroup
      build.mainSocketGroup = pg.index
      build.buildFlag = true
      BuildOps.get_main_output()
      pg.figure = figure_params()
      build.mainSocketGroup = prior
      build.buildFlag = true
      BuildOps.get_main_output()
      stats[1] = { stat = 'MainDamage', label = ('Boss damage (group %d)'):format(pg.number), main = true, figure = pg.figure }
      c.stats = stats
      if not rawget(c, 'limits') then c.limits = setmetatable({}, { __index = ctx.limits }) end
      swapped = true
    end
    if m == active and not swapped then return c end
    local calcFunc, calcBase = ctx.calcFunc, ctx.calcBase
    if m ~= active then
      calcFunc, calcBase = build.calcsTab.calcs.getMiscCalculator(build)
      c.measure_clear = function(s) return ctx.measure_clear(s, calcFunc) end
    end
    c.calcFunc, c.calcBase = calcFunc, calcBase
    if pg then
      c.rankBaseValue = main_damage({ figure = pg.figure }, boss_output(calcFunc, pg, {}))
      c.measure = group_measurer(c, calcFunc, calcBase, pg)
      c.base = extract(c, calcBase, calcBase)
      c.base.value[1], c.base.delta[1] = c.rankBaseValue, 0
    else
      c.measure = measurer(ctx, c, calcFunc, calcBase)
      c.base = extract(c, calcBase, calcBase)
    end
    if m ~= active then c.baseClear = ctx.clearSeparate and c.measure_clear(nil) or c.base.clear end
    if ctx.targets and m ~= active then
      c.targets = {
        ehp = math.min(ctx.targets.ehp, c.base.ehp or ctx.targets.ehp),
        maxHit = math.min(ctx.targets.maxHit, c.base.maxHit or ctx.targets.maxHit),
      }
    end
    c.estimate = function(id)
      local node = spec.nodes[id]
      if not node or node.modKey == nil or node.modKey == '' or ctx.granted[id] then return 0 end
      local key = node.alloc and (node.modKey .. '_remove') or node.modKey
      local v = c.measure(key, node.alloc and { removeNodes = { [node] = true } } or { addNodes = { [node] = true } })
      if v.err then return 0 end
      return node.alloc and -v.delta[1] or v.delta[1]
    end
    return c
  end
  -- Pool m's branches: each node of the pool with the nodes its removal cuts off, none protected but by its tag, and
  -- none whose removal cuts off a node a protect_for loadout holds; ranked by loss per point on the pool's set.
  local function pool_branches(c, m)
    local rows = {}
    for _, id in ipairs(sorted_ids(pools[m])) do
      if not poolProt[id] then
        local set = { [id] = true }
        for d in pairs(unreached(spec, allocSet, { [id] = true })) do
          if not trees[1].before[d] then set[d] = true end
        end
        local ok = true
        for d in pairs(set) do
          if not pools[m][d] or poolProt[d] then ok = false; break end
        end
        for k = 2, #trees do
          if ok and disconnected(trees[k].spec, trees[k].alloc, set, trees[k].before) then ok = false end
        end
        if ok then
          local nodes = {}
          for d in pairs(set) do nodes[spec.nodes[d]] = true end
          local v = c.measure(nil, { removeNodes = nodes })
          if not v.err then
            local points = count(set)
            rows[#rows + 1] = { id = id, node = spec.nodes[id], set = set, points = points, lossPerPoint = -v.delta[1] / points }
          end
        end
      end
    end
    table.sort(rows, function(a, b)
      if a.lossPerPoint ~= b.lossPerPoint then return a.lossPerPoint < b.lossPerPoint end
      if a.points ~= b.points then return a.points > b.points end
      return a.id < b.id
    end)
    return rows
  end
  -- `fn(c)` with pool m's set active (switched for the call alone, the global skill cache wiped before and after) and
  -- `c` its context.
  local function in_pool(m, fn)
    local prior = itemSet and itemSet.useSecondWeaponSet
    local switched = m ~= active and itemSet ~= nil
    local ok, res = pcall(function()
      if switched then
        itemSet.useSecondWeaponSet = m == 2
        if wipeGlobalCache then wipeGlobalCache() end
      end
      return fn(pool_context(m))
    end)
    if switched then
      itemSet.useSecondWeaponSet = prior
      if wipeGlobalCache then wipeGlobalCache() end
    end
    if not ok then error(res, 0) end
    return res
  end

  -- One move judged as a swap, in place of the search (D-439's rebuild and free): the reply's only swap tried, and its
  -- best swap when it is legal.
  local function single_move(s, c)
    c = c or ctx
    s = settle(c, s)
    result.swaps = { swap_entry(s, c) }
    result.bestSwap = s.verdict == 'legal' and result.swaps[1] or nil
  end

  result.mode = ctx.rebuild and 'rebuild' or ctx.free and 'free' or 'swap'
  result.poolSwaps = {}
  result.poolCpuSeconds = 0
  if ctx.rebuild then
    -- D-439: free every node outside the protected ones and the tree that connects them to the start (the core, one
    -- tree as the tree is); refill from the pass's nodes.
    scratch = new_scratch(spec)
    local fixed = {}
    for id in pairs(spec.allocNodes) do
      if prot[id] or not is_main(spec.nodes[id]) or ctx.granted[id] then fixed[id] = true end
    end
    local core = core_of(spec, allocSet, fixed, origCounts, function(id)
      local v = ctx.estimate(id)
      return type(v) == 'number' and v == v and v or 0
    end)
    local set = {}
    for id in pairs(spec.allocNodes) do
      if not core[id] then set[id] = true end
    end
    local only = {}
    for id in pairs(byId) do only[id] = true end
    local s
    if next(set) == nil then
      s = { branches = {}, freed = 0, verdict = 'no-candidate',
        reason = 'nothing to free: every node is kept, protected or on their paths to the start' }
    else
      s = try_swap(ctx, scratch, orig, origCounts, { rows = {}, set = set, only = only, dynamic = true })
    end
    single_move(s)
  elseif ctx.free then
    -- D-439: free exactly the named nodes and what their removal disconnects; refill from anything but them. D-467:
    -- nodes of one weapon set are freed within its pool, as a pool move with that set active.
    local exclude = {}
    result.freeNodes = {}
    for _, id in ipairs(ctx.free) do
      if not exclude[id] then result.freeNodes[#result.freeNodes + 1] = node_entry(spec.nodes[id]) end
      exclude[id] = true
    end
    scratch = new_scratch(spec)
    if ctx.freePool then
      local m = ctx.freePool
      result.freePool = m
      in_pool(m, function(c)
        single_move(try_swap(c, scratch, orig, origCounts, { rows = {}, set = ctx.freeSet, exclude = exclude }), c)
        if rawget(c, 'stats') then result.freeStats = stats_entry(c.stats) end
        local pg = ctx.poolGroups and ctx.poolGroups[m]
        if pg then result.freeGroup = { group = pg.number, label = pg.label } end
        if rawget(c, 'targets') then result.freeTargets = c.targets end
      end)
    else
      single_move(try_swap(ctx, scratch, orig, origCounts, { rows = {}, set = ctx.freeSet, exclude = exclude }))
    end
  else
    -- The main swap: the weakest unprotected branches, alone and then together (D-439).
    local swaps, bestSwap = search(ctx, weak, true)
    result.bestSwap = bestSwap and swap_entry(bestSwap, ctx) or nil
    result.swaps = {}
    for _, s in ipairs(swaps) do result.swaps[#result.swaps + 1] = swap_entry(s, ctx) end
  end

  -- C-55a (D-426): the pool moves, one search per weapon-set pool that has nodes (see the header).
  local tPools = os.clock()
  for m = 1, 2 do
    if result.mode == 'swap' and next(pools[m]) ~= nil then
      local entry = in_pool(m, function(c)
        local tried, bestOne = search(c, pool_branches(c, m), false)
        local out = { set = m, nodes = count(pools[m]), base = {}, swaps = {} }
        if rawget(c, 'stats') then out.stats = stats_entry(c.stats) end
        local pg = ctx.poolGroups and ctx.poolGroups[m]
        if pg then out.group = { group = pg.number, label = pg.label } end
        if rawget(c, 'targets') then out.targets = c.targets end
        for i = 1, nStats do out.base[i] = c.base.value[i] end
        out.bestSwap = bestOne and swap_entry(bestOne, c) or nil
        for _, s in ipairs(tried) do out.swaps[#out.swaps + 1] = swap_entry(s, c) end
        return out
      end)
      result.poolSwaps[#result.poolSwaps + 1] = entry
    end
  end
  result.poolCpuSeconds = os.clock() - tPools

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
  ctx.compact = ctx.limit == 0
  ctx.keep = id_list(params.keep, 'keep')
  -- D-437: `cull` multiplies MainDamage; D-439: `rebuild` and `free` each replace the swap search.
  local function flag(v, name)
    if v == nil then return false end
    if type(v) ~= 'boolean' then fail(name .. ' must be true or false') end
    return v
  end
  ctx.cull = flag(params.cull, 'cull')
  if ctx.cull then
    local named = false
    for _, s in ipairs(ctx.stats) do if s.main then named = true end end
    if not named then fail('cull multiplies MainDamage by its CullMultiplier; name MainDamage in stats') end
  end
  ctx.rebuild = flag(params.rebuild, 'rebuild')
  if params.free ~= nil then
    if type(params.free) ~= 'table' or #params.free == 0 then fail('free must list allocated node ids') end
    ctx.free = id_list(params.free, 'free')
    if ctx.rebuild then fail('rebuild and free each replace the swap search: pass one of them') end
  end
  -- D-467: the toughness targets, the pace exchange (its damage is MainDamage's) and the pools' groups.
  for i, s in ipairs(ctx.stats) do
    if s.main and not ctx.mainIndex then ctx.mainIndex = i end
  end
  if params.targets ~= nil then
    local t = params.targets
    local function num(x) return type(x) == 'number' and x == x and x >= 0 and x < math.huge end
    if type(t) ~= 'table' or not num(t.ehp) or not num(t.maxHit) then
      fail('targets must be {ehp, maxHit}: the TotalEHP and the lowest maximum hit taken a move keeps, each a number, 0 or more')
    end
    for k in pairs(t) do
      if k ~= 'ehp' and k ~= 'maxHit' then fail(('targets.%s: the targets are ehp and maxHit'):format(tostring(k))) end
    end
    ctx.targets = { ehp = t.ehp, maxHit = t.maxHit }
  end
  if params.paceExchange ~= nil then
    local r = params.paceExchange
    if type(r) ~= 'number' or r ~= r or r <= 0 or r == math.huge then
      fail('paceExchange must be a number above 0: the damage gain, in percent, each percent of a pace figure costs (D1-tree passes 3)')
    end
    if not ctx.mainIndex then fail('paceExchange buys damage with pace, nothing else; name MainDamage in stats') end
    ctx.paceExchange = r
  end
  local poolGroups
  if params.poolGroups ~= nil then
    if type(params.poolGroups) ~= 'table' then fail('poolGroups must map a weapon set ("1" or "2") to a plan group number') end
    poolGroups = {}
    for k, v in pairs(params.poolGroups) do
      local set = tonumber(k)
      if set ~= 1 and set ~= 2 then fail(('poolGroups: %s is no weapon set; the keys are "1" and "2"'):format(tostring(k))) end
      poolGroups[set] = int_arg(v, ('poolGroups.%d'):format(set), 1, nil)
    end
  end

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
    -- D-437: what MainDamage reads, from the main skill PoB just calculated (figure_params).
    ctx.figure = figure_params()

    -- D-435 (C-55): `clearGroup` is the plan's group number, as the compile record numbers it, mapped to PoB's index
    -- here, after the loadout's skill set is selected and calculated: Compile.lua's group_indices numbers the groups
    -- without a `source` first, in order, then PoB's own (a skill an item or the tree grants), which PoB may list
    -- before them. A build not compiled from a plan is numbered the same way: its own groups in order, PoB's granted
    -- ones after them. Without `clearGroup`, the main group.
    local groups = build.skillsTab.socketGroupList or {}
    local _, number = Compile.group_indices()
    if params.clearGroup == nil then
      ctx.clearGroup = build.mainSocketGroup
    else
      local wanted = int_arg(params.clearGroup, 'clearGroup', 1, nil)
      ctx.clearGroup = nil
      for i, n in pairs(number) do
        if n == wanted then ctx.clearGroup = i end
      end
      if ctx.clearGroup == nil then
        fail(('clear group %d: the loadout\'s skill set has %d socket groups'):format(wanted, #groups))
      end
    end
    if not groups[ctx.clearGroup] then
      fail(('clear group %d: the loadout\'s skill set has %d socket groups'):format(ctx.clearGroup, #groups))
    end
    ctx.clearNumber = number[ctx.clearGroup]
    -- D-467: each pool group, mapped to PoB's index as clearGroup is.
    if poolGroups then
      ctx.poolGroups = {}
      for set, wanted in pairs(poolGroups) do
        local idx
        for i, n in pairs(number) do
          if n == wanted then idx = i end
        end
        if idx == nil or not groups[idx] then
          fail(('poolGroups.%d: group %d: the loadout\'s skill set has %d socket groups'):format(set, wanted, #groups))
        end
        local g = groups[idx]
        ctx.poolGroups[set] = { index = idx, number = wanted, label = tostring(g.displayLabel or g.label or ('group ' .. wanted)) }
      end
    end
    ctx.clearInMain = ctx.clearGroup == build.mainSocketGroup
    ctx.clearSeparate = not ctx.clearInMain
    local mainGroup = build.mainSocketGroup
    -- `calcFunc`: a pool's own calculator (C-55a), else the pass's.
    ctx.measure_clear = function(scratch, calcFunc)
      build.mainSocketGroup = ctx.clearGroup
      local okc, out = pcall(calcFunc or ctx.calcFunc, scratch and { spec = scratch } or {}, false)
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
