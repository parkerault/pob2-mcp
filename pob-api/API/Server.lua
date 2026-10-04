-- API/Server.lua
-- stdio loop for the engine wire protocol v2 (C-2).
--
--   Request (one JSON object per line):  {"id": <integer >= 1>, "action": "<snake_case>", "params": {...}}
--   Success:                             {"id": <echoed>, "ok": true, ...payload}
--   Failure:                             {"id": <echoed>, "ok": false, "error": "<message>", "code": "<CODE>"}
--   Banner (first line, no id):          {"ok": true, "ready": true, "version": {..., "apiVersion": "2.0.0"}}
--
-- Codes: FAILED (the handler returned ok=false without a code), EXCEPTION (the handler raised),
-- ENCODE (the reply could not be encoded; the process stays alive), UNKNOWN_ACTION, INVALID_JSON (the
-- line did not parse; that reply has no id), LOAD_FAILED (set by load_build_xml).
--
-- A request without an id gets a reply without one (the v1 TS client sends none and ignores ids).

-- Debug logging control
local DEBUG = os.getenv('POB_API_DEBUG') == '1'
local function debug_log(msg)
  if DEBUG then io.stderr:write('[Server] ' .. msg .. '\n') end
end

-- json loader with robust fallback to runtime path
local ok, json = pcall(require, 'dkjson')
if not ok then
  local base = rawget(_G, 'POB_SCRIPT_DIR') or '.'
  local candidates = {
    base .. '/runtime/lua/dkjson.lua',
    base .. '/../runtime/lua/dkjson.lua',
    'runtime/lua/dkjson.lua',
    '../runtime/lua/dkjson.lua',
  }
  for _, p in ipairs(candidates) do
    local ok2, mod = pcall(dofile, p)
    if ok2 and type(mod) == 'table' then json = mod; ok = true; break end
  end
  if not ok then error('dkjson not found; ensure PoB runtime or dkjson is available') end
end

-- Encode a value. Never raises: returns the line, or nil and the encoder's message.
local function encode(tbl)
  -- A fresh state table per call: dkjson keeps its per-call buffers in it.
  local ok_enc, out = pcall(json.encode, tbl, { indent = false })
  if not ok_enc then return nil, tostring(out) end
  if type(out) ~= 'string' then return nil, 'encoder returned ' .. type(out) end
  return out
end

local function write_raw(line)
  io.write(line, '\n')
  io.flush()
end

-- Write the reply for `id`. Encoding happens inside a pcall: an unencodable reply becomes an ENCODE
-- failure for the same id, and the loop carries on.
local function write_reply(id, reply)
  reply.id = id
  local line, err = encode(reply)
  if not line then
    debug_log('encode failed: ' .. tostring(err))
    line = encode({ id = id, ok = false, code = 'ENCODE', error = 'reply could not be encoded: ' .. tostring(err) })
      or encode({ id = id, ok = false, code = 'ENCODE', error = 'reply could not be encoded' })
  end
  write_raw(line)
end

local function failure(id, code, message)
  write_reply(id, { ok = false, code = code, error = message })
end

local function read_line()
  return io.read('*l')
end

-- Load common handlers via require for path robustness
debug_log('About to require API.Handlers')
local ok_api, API = pcall(require, 'API.Handlers')
if not ok_api then
  debug_log('Failed to require API.Handlers: ' .. tostring(API))
  error('Failed to load API.Handlers: ' .. tostring(API))
end
debug_log('Successfully loaded API.Handlers')
local handlers = API.handlers
API.configure({ null = json.null })

-- Commands
handlers.quit = function(params)
  return { ok = true, quit = true }
end

-- Run one decoded request and write its reply. Returns true when the loop should stop.
local function dispatch(msg)
  local id = msg.id
  if type(id) ~= 'number' then id = nil end
  local action = msg.action
  local handler = type(action) == 'string' and handlers[action] or nil
  if not handler then
    failure(id, 'UNKNOWN_ACTION', 'unknown action: ' .. tostring(action))
    return false
  end
  local params = msg.params
  if type(params) ~= 'table' then params = {} end

  local ok_call, res = pcall(handler, params)
  if not ok_call then
    failure(id, 'EXCEPTION', tostring(res))
    return false
  end
  if type(res) ~= 'table' then
    failure(id, 'EXCEPTION', 'handler for ' .. action .. ' returned ' .. type(res))
    return false
  end
  if res.ok == false then
    if res.error == nil then res.error = action .. ' failed' end
    if res.code == nil then res.code = 'FAILED' end
  end
  write_reply(id, res)
  return action == 'quit'
end

-- Banner: the first stdout line, with no id.
write_raw(assert(encode({ ok = true, ready = true, version = API.version_meta() })))

-- Main loop. EOF on stdin ends it, and the process exits 0.
while true do
  local line = read_line()
  if not line then break end
  if not line:match('^%s*$') then
    local ok_dec, msg, _, derr = pcall(json.decode, line)
    if not ok_dec or type(msg) ~= 'table' then
      local why = (not ok_dec and tostring(msg)) or derr or 'not a JSON object'
      write_raw(encode({ ok = false, code = 'INVALID_JSON', error = 'invalid json: ' .. tostring(why) })
        or '{"ok":false,"code":"INVALID_JSON","error":"invalid json"}')
    elseif dispatch(msg) then
      break
    end
  end
end
