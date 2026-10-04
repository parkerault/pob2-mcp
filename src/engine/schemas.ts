/**
 * Lua action reply schemas (C-5): the registry scaffold.
 *
 * Every reply the bridge client receives with `ok:true` is validated by `replySchemas[action]` before
 * it reaches a caller (C-4). An action without an entry passes through unvalidated, so this scaffold
 * can land before the schemas themselves (WU-09 adds one per action and the contract test). The
 * `__test_*` actions (C-2) are not in `ActionName` and never get a schema.
 *
 * zod v3 only (D-26). Schemas extend `baseReply`, which is `.passthrough()`, so additive fields never
 * break compatibility. dkjson encodes an empty Lua table as `[]` and can emit NaN/inf as `null`
 * (R-8); `luaArray`, `luaMap` and `luaNumber` absorb that.
 */
import { z } from 'zod';

/** Every non-test action the Lua side registers (`pob-api/API/Handlers.lua`). */
export const ACTION_NAMES = [
  'ping',
  'version',
  'new_build',
  'load_build_xml',
  'get_stats',
  'get_items',
  'get_skills',
  'get_tree',
  'set_main_selection',
  'set_tree',
  'add_item_text',
  'export_build_xml',
  'set_level',
  'set_flask_active',
  'get_build_info',
  'update_tree_delta',
  'calc_with',
  'get_config',
  'set_config',
  'create_socket_group',
  'add_gem',
  'set_gem_level',
  'set_gem_quality',
  'remove_skill',
  'remove_gem',
  'search_nodes',
  'list_gems',
  'get_classes',
  'save_build',
  'set_socket_group_enabled',
  'set_gem_enabled',
  'create_spec',
  'list_specs',
  'select_spec',
  'delete_spec',
  'rename_spec',
  'list_item_sets',
  'select_item_set',
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

/** The test actions (C-2): only with `POB_API_TEST_ACTIONS=1`; replies pass through unvalidated. */
export type TestActionName = `__test_${string}`;

/** The base every reply schema extends (C-5). */
export const baseReply = z.object({ id: z.number().int(), ok: z.literal(true) }).passthrough();
export type BaseReply = z.infer<typeof baseReply>;

/** An array, also accepting the `{}` dkjson produces for an empty Lua table. */
export function luaArray<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess(
    (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0 ? [] : v),
    z.array(item),
  );
}

/** A record, also accepting the `[]` dkjson produces for an empty Lua table. */
export function luaMap<T extends z.ZodTypeAny>(value: T) {
  return z.preprocess((v) => (Array.isArray(v) && v.length === 0 ? {} : v), z.record(value));
}

/** A number PoB can produce as NaN or inf, which dkjson encodes as `null`. */
export const luaNumber = z.number().nullable();

/** The registry's shape: at most one schema per action. */
export type ReplySchemaRegistry = { [A in ActionName]?: z.ZodTypeAny };

/** The schemas defined so far. WU-09 completes this to one per action. */
const definedSchemas = {} satisfies ReplySchemaRegistry;
type DefinedSchemas = typeof definedSchemas;

/**
 * The registry the bridge client validates against. Mutable on purpose: it is the one place a
 * schema is registered, and tests register a schema for an action to exercise the hook.
 */
export const replySchemas: ReplySchemaRegistry = definedSchemas;

/** A validated reply: the schema's type when the action has one, else the base reply. */
export type ActionReply<A extends ActionName> = A extends keyof DefinedSchemas
  ? z.infer<DefinedSchemas[A]>
  : BaseReply;

/** Request params (camelCase, C-2). WU-09 narrows these per action. */
export type ActionParams<A extends ActionName> = A extends ActionName ? Record<string, unknown> : never;

/** A test action's reply (unvalidated). */
export type TestReply = { id: number; ok: true; [key: string]: unknown };
