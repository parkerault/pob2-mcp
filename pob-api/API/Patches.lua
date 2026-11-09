-- API/Patches.lua
-- The bridge's function patches (C-60, D-509, amendment 16 §5): each corrects a PoB bug that changes our numbers or
-- breaks the pipeline, without modifying PoB's own files in vendor/. Data fixes (parse-cache entries) live in
-- API/ParseFixes.lua; this module holds the patches that wrap a PoB method.
--
-- Every patch is a wrap set on PoB's class table, `common.classes.<Class>` (Modules/Common.lua:78-82), so it reaches
-- every instance and caller; its `revert` restores PoB's method. A class not yet loaded is loaded once with
-- LoadModule. A wrap refuses when the method it wraps is missing, so a renamed method fails loudly.
--
-- bootstrap.lua applies the list at step 5d, after the parse fixes (5c), before the server starts: each entry's
-- `apply` in its own pcall. A failure writes `[Patches] <pg> not applied: <error>` to stderr, the engine starts
-- without that patch, and the patch's retirement test then fails.
--
-- Each entry (Appendix A.3):
--   pg            its PoB gap (docs/build-guide/pob-gaps.md)
--   fingerprints  the PoB code it relies on, each { file, func, sha1 } (a function), { file, line, sha1 } (a data
--                 line) or { file, from, to, sha1 } (a block); checked by tests/static/patchFingerprints.test.ts and
--                 the upgrade script through scripts/patch-fingerprints.mjs, which says how each is cut and hashed
--   test          its retirement test, { file, case }: the case that turns the patch off and shows the pin's own code
--                 still has the bug; it holds only that assertion, and its title says to remove the entry when it fails
--   apply, revert set and remove the wrap
--   stub          (only while a unit hasn't built it) laid out, not applied
--
-- On a pin upgrade a patch retires only when its retirement test fails on that case; a changed fingerprint alone
-- means re-check the patch, never retire it (amendment 16 §4, step 7).
--
--   M.SWITCHED        the mark the compile sets on a PoB socket group it writes disabled but switched as needed
--   M.PATCHES         the list
--   M.wrap(c, m, f)   wraps PoB's method `m` of class `c` with f(pobMethod); returns the function that restores it
--   M.apply_all()     bootstrap's step 5d; returns { applied = {pg…}, failed = {{pg, error}…} }
--   M.apply(pg), M.revert(pg), M.applied()   one entry on or off, and which are on (for tests)
--   M.gem_group_count(groups)                PG-106's recount of a socket group list

local M = {}

-- D-510, D-518: the field the compile sets on a PoB socket group it writes disabled because the plan switches it as
-- needed (`switch`, amendment 16 §14). PoB counts only enabled groups against the skill slots, but a skill switched
-- off in the game still fills its slot, so PG-106's recount counts a marked group as if enabled. PoB doesn't save the
-- field, so a reload loses it and the compile sets it at every compile.
M.SWITCHED = 'pob2Switched'

-- PoB's class table `name`, loading its file once when it isn't loaded yet (as API/Lookup.lua loads Item).
local function class(name)
  local c = common.classes[name]
  if not c then
    LoadModule('Classes/' .. name)
    c = common.classes[name]
  end
  if type(c) ~= 'table' then error('PoB class ' .. name .. ' is not defined', 0) end
  return c
end

function M.wrap(className, method, make)
  local c = class(className)
  local pob = rawget(c, method)
  if type(pob) ~= 'function' then
    error('PoB method ' .. className .. '.' .. method .. ' is missing', 0)
  end
  local wrapped = make(pob)
  if type(wrapped) ~= 'function' then error('the wrap of ' .. className .. '.' .. method .. ' is not a function', 0) end
  c[method] = wrapped
  return function()
    if rawget(c, method) == wrapped then c[method] = pob end
  end
end

-- PG-106's rule (D-510, the game's): an enabled group counts against the skill slots when its first enabled active gem
-- (not a support) is granted by neither an item nor the tree; a group with no enabled active gem counts nothing. A
-- gem PoB can't resolve (no granted effect: a gem id the pin lacks, as in a file a newer PoB saved) is an ungranted
-- active gem, as PoB and the game count it. A group marked switched counts as if enabled. PoB counts a group once any
-- enabled gem in it isn't granted, supports included (Classes/SkillsTab.lua:1577-1582).
function M.gem_group_count(groups)
  local count = 0
  for _, group in ipairs(groups or {}) do
    if group.enabled or group[M.SWITCHED] then
      for _, gem in ipairs(group.gemList or {}) do
        local effect = gem.grantedEffect or (gem.gemData and gem.gemData.grantedEffect)
        if gem.enabled and not (effect and effect.support) then
          if not (gem.fromItem or gem.fromTree or (effect and (effect.fromItem or effect.fromTree))) then count = count + 1 end
          break
        end
      end
    end
  end
  return count
end

-- PG-106 (D-510, amendment 16 §6): a support in a granted skill makes its group count against the skill slots. The
-- wrap runs PoB's own count, so its lineage bookkeeping (GlobalGemAssignments[<gem>], :1583-1600) stays PoB's, then
-- overwrites the group total, which only PoB's skill-slot warning reads (Modules/CalcPerform.lua:3603-3609). Both
-- callers reach it: UpdateGemSlots (:1167) and BuildOps.get_main_output's refresh (D-428).
local restorePG106
local PG106 = {
  pg = 'PG-106',
  fingerprints = {
    { file = 'Classes/SkillsTab.lua',
      func = 'function SkillsTabClass:UpdateGlobalGemCountAssignments()',
      sha1 = 'e865d9624d6ef21085b2be1e9f82cdedbf58d985' },
  },
  test = { file = 'tests/integration/pg106.test.ts',
    case = "with the patch reverted, PoB's own count of the first fixture is 10 (if this fails, PoB no longer counts a granted skill's supports: remove PG-106's entry from pob-api/API/Patches.lua)" },
  apply = function()
    restorePG106 = M.wrap('SkillsTab', 'UpdateGlobalGemCountAssignments', function(pob)
      return function(self, ...)
        pob(self, ...)
        GlobalGemAssignments.GemGroupCount = M.gem_group_count(self.socketGroupList)
      end
    end)
  end,
  revert = function()
    if restorePG106 then restorePG106() end
    restorePG106 = nil
  end,
}

-- PG-109 (D-511, amendment 16 §7): a saved item's ranged rolls move when it holds a rune. WU-153 builds this entry:
-- the wraps on ItemsTabClass:Save and ItemsTabClass:Load, its retirement test's file and case, then deletes `stub`.
local PG109 = {
  pg = 'PG-109',
  stub = true,
  fingerprints = {
    { file = 'Classes/ItemsTab.lua',
      func = 'function ItemsTabClass:Load(xml, dbFileName)',
      sha1 = '1d212d85b8565eb9636b9065dc07b520525a0628' },
    { file = 'Classes/ItemsTab.lua',
      func = 'function ItemsTabClass:Save(xml)',
      sha1 = '4d03009ee84e2bfb55eb7753a26af9bddac47782' },
  },
  test = { file = 'tests/integration/pg109.test.ts',
    case = "WU-153: the bug-still-present case's title" },
  apply = function() error('a stub: WU-153 builds it', 0) end,
  revert = function() end,
}

-- PG-114 (D-512, amendment 16 §8): a granted skill gets quality 0. WU-154 builds this entry: the wrap on
-- SkillsTabClass:ProcessSocketGroup for a wand's, staff's or sceptre's granted group, its retirement test's file and
-- case, then deletes `stub`. The second fingerprint is the granted-group block of calcs.initEnv.
local PG114 = {
  pg = 'PG-114',
  stub = true,
  fingerprints = {
    { file = 'Classes/SkillsTab.lua',
      func = 'function SkillsTabClass:ProcessSocketGroup(socketGroup)',
      sha1 = 'fd20894467dae95a32edcdafd7f35846eda25aa2' },
    { file = 'Modules/CalcSetup.lua',
      from = '-- Process extra skills granted by items or tree nodes',
      to = 'build.skillsTab:ProcessSocketGroup(group)',
      sha1 = 'f21b404585a9dc2c40f3a2fb9ce7a83f0f44233f' },
  },
  test = { file = 'tests/integration/pg114.test.ts',
    case = "WU-154: the bug-still-present case's title" },
  apply = function() error('a stub: WU-154 builds it', 0) end,
  revert = function() end,
}

M.PATCHES = { PG106, PG109, PG114 }

local applied = {}

local function entry(pg)
  for _, e in ipairs(M.PATCHES) do
    if e.pg == pg then return e end
  end
  error('no patch ' .. tostring(pg), 0)
end

function M.apply(pg)
  local e = entry(pg)
  if applied[e.pg] then return false end
  e.apply()
  applied[e.pg] = true
  return true
end

function M.revert(pg)
  local e = entry(pg)
  if not applied[e.pg] then return false end
  e.revert()
  applied[e.pg] = nil
  return true
end

function M.applied()
  local out = {}
  for _, e in ipairs(M.PATCHES) do
    if applied[e.pg] then out[#out + 1] = e.pg end
  end
  return out
end

function M.apply_all()
  local out = { applied = {}, failed = {} }
  for _, e in ipairs(M.PATCHES) do
    if not e.stub then
      local ok, err = pcall(M.apply, e.pg)
      if ok then
        out.applied[#out.applied + 1] = e.pg
      else
        out.failed[#out.failed + 1] = { pg = e.pg, error = tostring(err) }
        io.stderr:write('[Patches] ' .. tostring(e.pg) .. ' not applied: ' .. tostring(err) .. '\n')
      end
    end
  end
  return out
end

return M
