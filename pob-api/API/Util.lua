-- API/Util.lua (PoE2)
-- Version-portable helpers over PoB internals.
--
-- construct(className, ...): build a PoB class instance across PoB's two constructor styles.
--   * Old style (pinned v0.23.1): `new(className, ...)` forwards constructor args to the class
--     constructor, e.g. `new('Item', raw)`.
--   * New style (PoB dev head): `new(className)` takes no constructor args, and the constructor
--     is a method named after the class: `new('Item'):Item(raw)`.
-- The style is detected from `new` itself (spike S-2): the old `new` is vararg, the new one isn't.

local M = {}

local NEW_STYLE = nil

local function is_new_style()
  if NEW_STYLE == nil then
    if type(new) ~= 'function' then
      error('construct: PoB global new() is not available (HeadlessWrapper not booted)')
    end
    NEW_STYLE = not debug.getinfo(new, 'u').isvararg
  end
  return NEW_STYLE
end

function M.construct(className, ...)
  if is_new_style() then
    local object = new(className)
    object[className](object, ...)
    return object
  end
  return new(className, ...)
end

return M
