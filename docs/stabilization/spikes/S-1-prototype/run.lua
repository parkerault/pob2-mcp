-- S-1 driver. Run with cwd = PoB2 v0.23.1 src/:
--   luajit <S1>/run.lua <build.xml> <requests.json> <out.json>
-- requests.json: [{ "op": "generate"|"evaluate", ...request }]
local S1 = arg[0]:gsub("[^/]+$", "")
local buildPath, reqPath, outPath = arg[1], arg[2], arg[3]

-- same boot sequence as pob-api/bootstrap.lua: PoB logging -> stderr, then vanilla HeadlessWrapper
do
  local err = io.stderr
  print = function(...)
    local p = {}
    for i = 1, select('#', ...) do p[i] = tostring((select(i, ...))) end
    err:write(table.concat(p, '\t') .. '\n')
  end
end
local ffi = require "ffi"
ffi.cdef [[ typedef struct { long tv_sec; long tv_nsec; } r_timespec; int clock_gettime(int, r_timespec*); ]]
local function nowMs() local t = ffi.new("r_timespec"); ffi.C.clock_gettime(1, t); return tonumber(t.tv_sec) * 1000 + tonumber(t.tv_nsec) / 1e6 end

local tBoot = nowMs()
dofile('HeadlessWrapper.lua')
local bootMs = nowMs() - tBoot

local dkjson = require "dkjson"
local function readAll(p) local f = assert(io.open(p, 'rb')); local s = f:read('*a'); f:close(); return s end

local tLoad = nowMs()
loadBuildFromXML(readAll(buildPath), "Grenadator")
local loadMs = nowMs() - tLoad
io.stderr:write(string.format("[S-1] boot %.0f ms, load %.0f ms, devMode=%s, CombinedDPS=%.1f TotalEHP=%.1f\n",
  bootMs, loadMs, tostring(launch.devMode), build.calcsTab.mainOutput.CombinedDPS or -1, build.calcsTab.mainOutput.TotalEHP or -1))

local Shim = dofile(S1 .. 'TradeShim.lua')
local reqs = dkjson.decode(readAll(reqPath))
local out = { bootMs = bootMs, loadMs = loadMs, devMode = launch.devMode, responses = {} }
for i, r in ipairs(reqs) do
  if r.fetchBodyFile then r.fetchBody = readAll(r.fetchBodyFile) end
  local ok, res = pcall(r.op == "generate" and Shim.generateQuery or Shim.evaluateItems, r)
  if not ok then res = { error = tostring(res) } end
  res.op, res.slot = r.op, r.slot
  if res.queryJson and r.queryOut then local f = io.open(r.queryOut, 'w'); f:write(res.queryJson); f:close() end
  out.responses[i] = res
  io.stderr:write(string.format("[S-1] %s %s -> %s\n", r.op, r.slot, ok and "ok" or res.error))
end
out.popupsAfter = #main.popups
local f = io.open(outPath, "w"); f:write(dkjson.encode(out, { indent = true })); f:close()
