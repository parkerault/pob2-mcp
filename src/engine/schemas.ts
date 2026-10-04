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

/** Every non-test action the Lua side registers (`pob-api/API/Handlers.lua`, plus `API/Trade.lua`'s). */
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
  'trade_generate_query',
  'trade_evaluate_items',
  'trade_query_options',
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

// ---------------------------------------------------------------------------------------------------
// Lua trade actions (C-13, `pob-api/API/Trade.lua`)

/** An effective sort weight as the trade actions report it. */
const statWeightSchema = z.object({ stat: z.string(), label: z.string(), weight: z.number() }).passthrough();

/** One stat filter of a trade query group: `{id, value: {weight} | {min} | …}`. */
const tradeStatFilterSchema = z.object({ id: z.string(), value: luaMap(z.unknown()).optional() }).passthrough();

/** PoB's trade query, as `FinishQuery` built it (the weight group first, then the always-present `and` group). */
export const tradeQuerySchema = z
  .object({
    query: z
      .object({
        filters: luaMap(z.unknown()),
        status: z.object({ option: z.string() }).passthrough(),
        stats: luaArray(
          z
            .object({
              type: z.string(),
              value: luaMap(luaNumber).optional(),
              filters: luaArray(tradeStatFilterSchema),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
    sort: luaMap(z.string()),
    engine: z.string(),
  })
  .passthrough();
export type TradeQuery = z.infer<typeof tradeQuerySchema>;

export const tradeGenerateQueryReply = baseReply.extend({
  result: z
    .object({
      query: tradeQuerySchema,
      /** The full ranked list before PoB's 35-filter cap, in D-55 order. */
      rankedWeights: luaArray(
        // weight = meanStatDiff / the tested mod value, so a zero test value gives inf (encoded null).
        z.object({ tradeId: z.string(), weight: luaNumber, meanStatDiff: luaNumber }).passthrough(),
      ),
      minWeight: luaNumber,
      itemCategory: z.string(),
      statWeights: luaArray(statWeightSchema),
      baselineScore: luaNumber,
      meta: z.object({ calcCount: z.number().int(), ms: z.number() }).passthrough(),
    })
    .passthrough(),
});
export type TradeGenerateQueryResult = z.infer<typeof tradeGenerateQueryReply>['result'];

const statDeltaSchema = z
  .object({ base: luaNumber, new: luaNumber, delta: luaNumber, pct: luaNumber.optional() })
  .passthrough();

export const tradeEvaluateItemsReply = baseReply.extend({
  result: z
    .object({
      baselineScore: luaNumber,
      rejected: luaArray(z.object({ id: z.string(), reason: z.string() }).passthrough()),
      items: luaArray(
        z
          .object({
            id: z.string().nullable().optional(),
            score: luaNumber,
            stats: luaMap(statDeltaSchema),
            itemText: z.string(),
          })
          .passthrough(),
      ),
    })
    .passthrough(),
});
export type TradeEvaluateItemsResult = z.infer<typeof tradeEvaluateItemsReply>['result'];

const weightSchema = z.object({ stat: z.string(), weight: z.number() }).passthrough();

export const tradeQueryOptionsReply = baseReply.extend({
  result: z
    .object({
      slot: z.string().nullable(),
      supported: z.boolean(),
      reason: z.string().optional(),
      itemCategory: z.string().optional(),
      sortStats: luaArray(z.object({ stat: z.string(), label: z.string() }).passthrough()),
      defaultWeights: luaArray(weightSchema),
      savedWeights: luaArray(weightSchema).nullable(),
      requiredModChoices: luaArray(
        z
          .object({ tradeId: z.string(), text: z.string(), kind: z.enum(['explicit', 'implicit', 'corrupted']) })
          .passthrough(),
      ),
      currencies: luaArray(z.object({ id: z.string().nullable(), label: z.string() }).passthrough()),
      statuses: luaArray(z.object({ id: z.string(), label: z.string() }).passthrough()),
      shows: z
        .object({
          sockets: z.boolean(),
          runeBehaviour: z.boolean(),
          anointBehaviour: z.boolean(),
          jewelType: z.boolean(),
        })
        .passthrough(),
    })
    .passthrough(),
});
export type TradeQueryOptionsResult = z.infer<typeof tradeQueryOptionsReply>['result'];

/** The behaviour PoB's trade dialog applies to runes or anoints of fetched items. */
export type TradeItemBehaviour = 'copy' | 'keep' | 'remove';
/** A sort weight (C-13 param): a `data.powerStatList` stat, never a `*TakenHit` one (D-57). */
export type TradeStatWeight = { stat: string; weight: number };

/** `trade_generate_query` params (C-13). Omitted options take PoB's dialog defaults (D-37). */
export interface TradeGenerateQueryParams {
  slot: string;
  statWeights?: TradeStatWeight[];
  requiredMods?: Array<{ tradeId: string; min: number }>;
  maxPrice?: number;
  /** null = Exalted Orb Equivalent. */
  currency?: string | null;
  maxLevel?: number;
  sockets?: number;
  includeCorrupted?: boolean;
  includeMirrored?: boolean;
  runeBehaviour?: TradeItemBehaviour;
  jewelType?: 'Base' | 'Radius';
  status?: 'securable' | 'available' | 'onlineleague' | 'online' | 'any';
}

/**
 * `trade_evaluate_items` params (C-13). `items` are sanitized `/fetch` result entries (D-56); an entry
 * may instead be `{id, itemText}` carrying PoB item text.
 */
export interface TradeEvaluateItemsParams {
  slot: string;
  items: unknown[];
  statWeights?: TradeStatWeight[];
  reportStats?: string[];
  runeBehaviour?: TradeItemBehaviour;
  anointBehaviour?: TradeItemBehaviour;
}

/** The schemas defined so far. WU-09 completes this to one per action. */
const definedSchemas = {
  trade_generate_query: tradeGenerateQueryReply,
  trade_evaluate_items: tradeEvaluateItemsReply,
  trade_query_options: tradeQueryOptionsReply,
} satisfies ReplySchemaRegistry;
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
