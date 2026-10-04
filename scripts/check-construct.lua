-- scripts/check-construct.lua: AC-F6 script check for pob-api/API/Util.lua construct().
--
-- Run with cwd = the pinned checkout's src/ (as the bridge does):
--   cd vendor/PathOfBuilding-PoE2/src && luajit ../../../scripts/check-construct.lua
-- Boots the vanilla HeadlessWrapper, loads Util.lua, and checks that
--   construct('Item', <tests/fixtures/items/ruby-ring.txt>) has a base, and
--   construct('PassiveSpec', build, '0_5') returns a spec.
-- Exits 0 on success, 1 on any failure.

local function script_dir()
  local src = debug.getinfo(1, 'S').source
  if src:sub(1, 1) == '@' then
    local dir = src:sub(2):gsub('[^/\\]+$', ''):gsub('[/\\]$', '')
    if dir == '' then return '.' end
    return dir
  end
  return '.'
end

local REPO = script_dir() .. '/..'
package.path = REPO .. '/pob-api/?.lua;' .. '../runtime/lua/?.lua;../runtime/lua/?/init.lua;' .. package.path

-- PoB is chatty on stdout during init; keep stdout for this script's own result lines.
do
  local stderr = io.stderr
  print = function(...)
    local parts = {}
    for i = 1, select('#', ...) do parts[i] = tostring((select(i, ...))) end
    stderr:write(table.concat(parts, '\t') .. '\n')
  end
end

local function fail(msg)
  io.stdout:write('FAIL: ' .. msg .. '\n')
  os.exit(1)
end

local ok, err = pcall(dofile, 'HeadlessWrapper.lua')
if not ok then fail('HeadlessWrapper.lua did not boot: ' .. tostring(err)) end
if type(build) ~= 'table' then fail('HeadlessWrapper did not leave a global build') end

local Util = require('API.Util')
if type(Util.construct) ~= 'function' then fail('API.Util has no construct()') end

local f = io.open(REPO .. '/tests/fixtures/items/ruby-ring.txt', 'rb')
if not f then fail('cannot open tests/fixtures/items/ruby-ring.txt') end
local raw = f:read('*a')
f:close()

local okItem, item = pcall(Util.construct, 'Item', raw)
if not okItem then fail('construct(Item) raised: ' .. tostring(item)) end
if type(item) ~= 'table' or item.base == nil then fail('construct(Item) returned an item without base') end
io.stdout:write(string.format('OK Item: name=%s base=%s\n', tostring(item.name), tostring(item.baseName)))

local okSpec, spec = pcall(Util.construct, 'PassiveSpec', build, '0_5')
if not okSpec then fail('construct(PassiveSpec) raised: ' .. tostring(spec)) end
if type(spec) ~= 'table' or type(spec.nodes) ~= 'table' then fail('construct(PassiveSpec) did not return a spec') end
io.stdout:write(string.format('OK PassiveSpec: treeVersion=%s\n', tostring(spec.treeVersion)))

os.exit(0)
