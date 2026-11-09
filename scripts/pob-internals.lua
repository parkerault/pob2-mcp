-- scripts/pob-internals.lua: the PoB internals probe of spike S-2, committed (amendment 16 §4, step 2; D-508).
--
-- Run with cwd = a PoB checkout's src/, as the engine runs (HeadlessWrapper.lua loads Launch.lua and PoB's modules
-- relative to it), with LUA_PATH and LUA_CPATH pointing at that checkout's runtime/ as the bridge sets them:
--   luajit <repo>/scripts/pob-internals.lua <symbols.json> <out.json> [<build.xml>]
-- scripts/pin-upgrade.mjs runs it on the pin's tree and on the new release's, from temporary POB_DIRECTORY,
-- XDG_STATE_HOME and TMPDIR folders, and lists every symbol whose result differs.
--
-- It boots the vanilla HeadlessWrapper (none of the bridge's parse fixes or patches, so a patched method reads as
-- PoB's own), loads the build, and resolves each symbol of the list inside it. A symbol is a path from the globals:
-- `build.skillsTab:ProcessSocketGroup` (a method, looked up as a call would look it up), `build.spec.allocNodes`
-- (a field), `common.classes.Item:BuildRaw` (a class's method; a class not yet loaded is loaded once, as
-- pob-api/API/Patches.lua loads one). For each it writes the value's type; for a Lua function also the file and lines
-- that define it and the sha1 of those lines after whitespace normalization (each line trimmed, runs of blanks made
-- one space, empty lines dropped), as S-2 compared bodies (docs/stabilization/spikes/S-2-pin-v0.23.1.md).
--
-- <out.json>: { "version": <launch.versionNumber>, "build": <the build's file name or null>, "symbols": { <symbol>:
--   { "type": <Lua type>, "file", "line", "lastLine", "sha1" } } }; a path that stops at a nil reads
--   { "type": "nil", "at": <the part that was nil> }. Exit 0 written, 1 a failure (on stdout as `FAIL: <why>`).

local symbolsPath, outPath, buildPath = arg[1], arg[2], arg[3]

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
package.path = '../runtime/lua/?.lua;../runtime/lua/?/init.lua;' .. package.path

-- PoB is chatty on stdout during init; keep stdout for this script's own failure line.
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

if not symbolsPath or not outPath then fail('usage: luajit pob-internals.lua <symbols.json> <out.json> [<build.xml>]') end

local function read_file(p)
  local f = io.open(p, 'rb')
  if not f then return nil end
  local text = f:read('*a')
  f:close()
  return text
end

-- The utf8 fallback the bridge provides (pob-api/bootstrap.lua, step 4).
if type(_G.utf8) ~= 'table' then
  local ok, mod = pcall(require, 'utf8')
  if ok and type(mod) == 'table' then
    _G.utf8 = mod
  else
    local ok2, stub = pcall(dofile, REPO .. '/pob-api/utf8.lua')
    if ok2 and type(stub) == 'table' then _G.utf8 = stub end
  end
end

local okJson, json = pcall(require, 'dkjson')
if not okJson then fail('dkjson not found under ../runtime/lua: ' .. tostring(json)) end
local okSha, sha1 = pcall(require, 'sha1')
if not okSha then fail('sha1 not found under ../runtime/lua: ' .. tostring(sha1)) end

local listText = read_file(symbolsPath)
if not listText then fail('cannot read ' .. symbolsPath) end
local list = json.decode(listText)
if type(list) ~= 'table' or type(list.groups) ~= 'table' then fail(symbolsPath .. ' has no "groups" object') end

local okBoot, bootErr = pcall(dofile, 'HeadlessWrapper.lua')
if not okBoot then fail('HeadlessWrapper.lua did not boot: ' .. tostring(bootErr)) end
if _G.main then main.disableDevAutoSave = true end
if type(_G.build) ~= 'table' then fail('HeadlessWrapper did not leave a global build') end

local buildName = nil
if buildPath then
  local xml = read_file(buildPath)
  if not xml then fail('cannot read ' .. buildPath) end
  buildName = buildPath:match('[^/\\]+$')
  local okLoad, loadErr = pcall(function()
    if type(_G.loadBuildFromXML) == 'function' then
      loadBuildFromXML(xml, buildName)
    else
      main:SetMode('BUILD', false, buildName, xml)
      runCallback('OnFrame')
    end
  end)
  if not okLoad then fail('the build did not load: ' .. tostring(loadErr)) end
  if _G.main and main.modes and main.modes['BUILD'] then _G.build = main.modes['BUILD'] end
end

-- Lines of a source file, read once each.
local sources = {}
local function lines_of(file)
  if sources[file] == nil then
    local text = read_file(file)
    local out = false
    if text then
      out = {}
      for l in (text .. '\n'):gmatch('([^\n]*)\r?\n') do out[#out + 1] = l end
    end
    sources[file] = out
  end
  return sources[file] or nil
end

local function body_sha1(file, first, last)
  local lines = lines_of(file)
  if not lines or not first or not last or first < 1 or last < first then return nil end
  local kept = {}
  for i = first, math.min(last, #lines) do
    local l = lines[i]:gsub('\r$', ''):gsub('^%s+', ''):gsub('%s+$', ''):gsub('%s+', ' ')
    if l ~= '' then kept[#kept + 1] = l end
  end
  return sha1.sha1(table.concat(kept, '\n'))
end

-- Split `a.b.c:d` into its parts.
local function parts_of(symbol)
  local out = {}
  for name in symbol:gsub(':', '.'):gmatch('[^.]+') do out[#out + 1] = name end
  return out
end

local function resolve(symbol)
  local parts = parts_of(symbol)
  local value = _G
  for i, name in ipairs(parts) do
    if type(value) ~= 'table' then return nil, table.concat(parts, '.', 1, i - 1) end
    local nextValue = value[name]
    -- common.classes.<Class>: load the class once when it isn't loaded yet.
    if nextValue == nil and i == 3 and parts[1] == 'common' and parts[2] == 'classes' then
      pcall(LoadModule, 'Classes/' .. name)
      nextValue = value[name]
    end
    if nextValue == nil then return nil, table.concat(parts, '.', 1, i) end
    value = nextValue
  end
  return value
end

local results = {}
for _, group in pairs(list.groups) do
  if type(group) == 'table' then
    for _, symbol in ipairs(group) do
      local ok, value, at = pcall(resolve, symbol)
      if not ok then
        results[symbol] = { type = 'error', error = tostring(value) }
      elseif value == nil then
        results[symbol] = { type = 'nil', at = at }
      else
        local r = { type = type(value) }
        if r.type == 'function' then
          local info = debug.getinfo(value, 'S')
          if info and info.what == 'Lua' and type(info.source) == 'string' and info.source:sub(1, 1) == '@' then
            r.file = info.source:sub(2):gsub('^%./', '')
            r.line = info.linedefined
            r.lastLine = info.lastlinedefined
            r.sha1 = body_sha1(info.source:sub(2), info.linedefined, info.lastlinedefined)
          else
            r.what = info and info.what or 'unknown'
          end
        end
        results[symbol] = r
      end
    end
  end
end

local out = {
  version = _G.launch and launch.versionNumber or json.null,
  build = buildName or json.null,
  symbols = results,
}
local f = io.open(outPath, 'wb')
if not f then fail('cannot write ' .. outPath) end
f:write(json.encode(out, { indent = true }))
f:write('\n')
f:close()
os.exit(0)
