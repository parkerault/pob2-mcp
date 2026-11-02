-- API/ParseFixes.lua
-- The bridge's corrections to PoB's parse of a modifier line (C-6, D-492). PoB's own files in vendor/ are never
-- modified: each fix sets the line's entry in PoB's parse cache (`modLib.parseModCache`, keyed by the exact line,
-- Modules/ModParser.lua:7307-7324, exported by Modules/ModTools.lua:48) and re-processes the tree nodes that carry
-- the line, with their switch copies (`options`, Classes/PassiveTree.lua:546-567), so each node's mod list reads it.
--
-- bootstrap.lua applies the list once the tree has loaded (HeadlessWrapper's OnInit, Modules/Main.lua:142), before
-- any build loads. A tree version loaded later parses the line through the fixed cache entry.
--
-- Each entry names its PoB gap (docs/build-guide/pob-gaps.md). On a pin upgrade, re-check every entry: one PoB now
-- parses itself goes. tests/integration/parseFixes.test.ts fails when PoB's own parse of a listed line no longer
-- leaves a remainder.
--
--   M.FIXES        the list: {pg, line, mods, nodes}
--   M.apply()      sets each line's cache entry and re-processes its nodes; returns what it changed
--   M.revert()     restores PoB's own cache entries and re-processes the nodes (the fix list off; for tests)
--   M.pob_parse(l) PoB's own parse of a line, ignoring the cache and the fix list: its mod list and remainder

local M = {}

M.FIXES = {
  {
    -- Crystalline Phylactery (17788), the Lich's jewel socket, and its Abyssal Lich copy. PoB maps only the older
    -- wording "Effect of the Socketed Jewel" (Modules/ModParser.lua:895-897) and reads this one as `LocalEffect` with
    -- a remainder (Data/ModCache.lua:1356), so the node adds nothing and the jewel counts once.
    pg = 'PG-103',
    line = '100% increased Effect of bonuses gained from Socketed Jewel',
    mods = { { name = 'SocketedJewelEffect', type = 'INC', value = 100 } },
    nodes = { 17788 },
  },
}

-- line -> { entry = PoB's own cache entry before the first apply } (entry may be nil).
local originals = {}

-- A fix's cache entry, in the form Data/ModCache.lua holds: { modList } with no remainder.
local function cacheEntry(fix)
  local list = {}
  for i, mod in ipairs(fix.mods) do
    list[i] = { name = mod.name, type = mod.type, value = mod.value, flags = mod.flags or 0, keywordFlags = mod.keywordFlags or 0 }
  end
  return { list }
end

local function hasLine(node, line)
  for _, stat in ipairs(node.sd or {}) do
    if stat == line then return true end
  end
  return false
end

-- Re-parse one node's lines and its switch copies' (PassiveTree:ProcessStats resets the mod list, not the flags).
local function reprocess(tree, node)
  node.extra, node.unknown = nil, nil
  tree:ProcessStats(node)
  local copies = 0
  for _, copy in pairs(node.options or {}) do
    -- A copy reads its parent through __index: clearing its own flags lets ProcessStats set them afresh.
    rawset(copy, 'extra', nil)
    rawset(copy, 'unknown', nil)
    tree:ProcessStats(copy)
    copies = copies + 1
  end
  return copies
end

-- Re-process every listed node of every loaded tree version that carries the fix's line.
local function reprocessNodes(fix)
  local done = {}
  local trees = _G.main and main.tree or {}
  for version, tree in pairs(trees) do
    if type(tree) == 'table' and type(tree.nodes) == 'table' and type(tree.ProcessStats) == 'function' then
      for _, id in ipairs(fix.nodes) do
        local node = tree.nodes[id]
        if node and hasLine(node, fix.line) then
          local copies = reprocess(tree, node)
          done[#done + 1] = { version = tostring(version), node = id, copies = copies }
        end
      end
    end
  end
  return done
end

local function cache()
  local c = _G.modLib and modLib.parseModCache
  if type(c) ~= 'table' then error('PoB parse cache (modLib.parseModCache) not available', 0) end
  return c
end

function M.apply()
  local c = cache()
  local out = {}
  for _, fix in ipairs(M.FIXES) do
    if originals[fix.line] == nil then originals[fix.line] = { entry = c[fix.line] } end
    c[fix.line] = cacheEntry(fix)
    out[#out + 1] = { pg = fix.pg, line = fix.line, nodes = reprocessNodes(fix) }
  end
  return out
end

function M.revert()
  local c = cache()
  local out = {}
  for _, fix in ipairs(M.FIXES) do
    local saved = originals[fix.line]
    if saved then
      c[fix.line] = saved.entry
      originals[fix.line] = nil
      out[#out + 1] = { pg = fix.pg, line = fix.line, nodes = reprocessNodes(fix) }
    end
  end
  return out
end

function M.pob_parse(line)
  local c = cache()
  local saved = c[line]
  c[line] = nil
  local ok, list, extra = pcall(modLib.parseMod, line)
  c[line] = saved
  if not ok then error(list, 0) end
  return list, extra
end

return M
