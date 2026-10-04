-- scripts/gen-expected-mod-text.lua: generate tests/fixtures/trade2/expected-mod-text.json (AC-T14).
--
-- Run from the repository root, after `mise run pob:fetch`:
--   luajit scripts/gen-expected-mod-text.lua > tests/fixtures/trade2/expected-mod-text.json
--
-- For every mod line of the 40 items in the 4 committed fetch fixtures, it records the line's raw
-- text and the text PoB2's own `escapeGGGString` (vendor/.../src/Modules/Common.lua, pinned tag)
-- makes of it. The function is taken verbatim from the pinned source and loaded on its own, so the
-- expected text is PoB's, not a re-implementation of it.
--
-- Walk order (mirrored by src/trade/modLines.ts `itemModLines`): items in fetch order; per item,
-- the fields whose name ends in `Mods` sorted by name, lines in array order; then each
-- `socketedItems[i]` the same way. A line is a string, or an object whose `description` is used.

local POB_SRC = 'vendor/PathOfBuilding-PoE2/src'
package.path = POB_SRC .. '/../runtime/lua/?.lua;' .. package.path
local dkjson = require('dkjson')

local function readFile(path)
  local f = assert(io.open(path, 'rb'), 'cannot open ' .. path)
  local s = f:read('*a')
  f:close()
  return s
end

-- Extract PoB's escapeGGGString from Common.lua and load just that function.
local common = readFile(POB_SRC .. '/Modules/Common.lua')
local fnSource = common:match('\nfunction escapeGGGString%(text%)\n.-\nend\n')
assert(fnSource, 'escapeGGGString not found in Common.lua')
local chunk = assert(loadstring(fnSource, '=escapeGGGString'))
local env = setmetatable({}, { __index = _G })
setfenv(chunk, env)
chunk()
local escapeGGGString = assert(env.escapeGGGString)

local FIXTURES = {
  'fetch-belt-unique-chaos',
  'fetch-body-armour',
  'fetch-ring-divine',
  'fetch-weighted-session',
}

local function isArray(v)
  if type(v) ~= 'table' then return false end
  local mt = getmetatable(v)
  return mt ~= nil and mt.__jsontype == 'array'
end

local entries = setmetatable({}, { __jsontype = 'array' })

local function walk(fixture, itemIndex, item, prefix)
  local fields = {}
  for k, v in pairs(item) do
    if type(k) == 'string' and k:sub(-4) == 'Mods' and isArray(v) then fields[#fields + 1] = k end
  end
  table.sort(fields)
  for _, field in ipairs(fields) do
    for i, line in ipairs(item[field]) do
      local raw
      if type(line) == 'string' then
        raw = line
      elseif type(line) == 'table' and type(line.description) == 'string' then
        raw = line.description
      else
        error(string.format('%s item %d %s%s[%d]: unrecognized mod line', fixture, itemIndex, prefix, field, i - 1))
      end
      entries[#entries + 1] = {
        fixture = fixture,
        item = itemIndex,
        path = string.format('%s%s[%d]', prefix, field, i - 1),
        raw = raw,
        text = escapeGGGString(raw),
      }
    end
  end
end

for _, fixture in ipairs(FIXTURES) do
  local doc = assert(dkjson.decode(readFile('tests/fixtures/trade2/' .. fixture .. '.response.json')))
  for idx, entry in ipairs(doc.result) do
    local item = entry.item
    walk(fixture, idx - 1, item, '')
    if isArray(item.socketedItems) then
      for s, socketed in ipairs(item.socketedItems) do
        walk(fixture, idx - 1, socketed, string.format('socketedItems[%d].', s - 1))
      end
    end
  end
end

io.stdout:write(dkjson.encode(entries, { indent = true, keyorder = { 'fixture', 'item', 'path', 'raw', 'text' } }))
io.stdout:write('\n')
