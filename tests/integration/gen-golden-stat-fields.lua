-- tests/integration/gen-golden-stat-fields.lua: generates tests/integration/golden-stat-fields.json,
-- the committed list of every numeric key of the golden build's `mainOutput` (AC-F24, before WU-06's
-- `__test_eval` exists). Run once per pin bump, with cwd = the pinned checkout's src/:
--
--   cd vendor/PathOfBuilding-PoE2/src && luajit ../../../tests/integration/gen-golden-stat-fields.lua
--
-- It boots the vanilla HeadlessWrapper, loads tests/fixtures/builds/grenadator.xml, and writes the
-- sorted names of the `mainOutput` keys whose value is a finite number. Exits 0 on success.

local function script_dir()
  local src = debug.getinfo(1, 'S').source
  if src:sub(1, 1) == '@' then
    local dir = src:sub(2):gsub('[^/\\]+$', ''):gsub('[/\\]$', '')
    if dir == '' then return '.' end
    return dir
  end
  return '.'
end

local HERE = script_dir()
local REPO = HERE .. '/../..'
package.path = '../runtime/lua/?.lua;../runtime/lua/?/init.lua;' .. package.path

-- PoB is chatty on stdout during init; keep stdout for this script's own result line.
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

local f = io.open(REPO .. '/tests/fixtures/builds/grenadator.xml', 'rb')
if not f then fail('cannot open tests/fixtures/builds/grenadator.xml') end
local xml = f:read('*a')
f:close()

loadBuildFromXML(xml, 'grenadator')
if not build or not build.calcsTab then fail('the golden build did not load') end
build.calcsTab:BuildOutput()
local output = build.calcsTab.mainOutput
if type(output) ~= 'table' then fail('no mainOutput') end

local keys = {}
for k, v in pairs(output) do
  if type(k) == 'string' and type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge then
    keys[#keys + 1] = k
  end
end
table.sort(keys)

local parts = {}
for i, k in ipairs(keys) do parts[i] = '  "' .. k .. '"' end
local out = io.open(HERE .. '/golden-stat-fields.json', 'wb')
if not out then fail('cannot write golden-stat-fields.json') end
out:write('[\n' .. table.concat(parts, ',\n') .. '\n]\n')
out:close()
io.stdout:write(string.format('OK: %d numeric mainOutput keys\n', #keys))
os.exit(0)
