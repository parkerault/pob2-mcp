/**
 * Lua action reply schemas (C-5): one zod schema per Lua action.
 *
 * Every reply the bridge client receives with `ok:true` is validated by `replySchemas[action]` before
 * it reaches a caller (C-4). Every non-test action registered in `pob-api/API/Handlers.lua` and the
 * modules it merges (`API/Trade.lua`, `API/Lookup.lua`, `API/Coverage.lua`) has a schema here (checked statically and on
 * the golden build by `tests/integration/contract.test.ts`, AC-E24). The registry stays mutable, and an action with no entry
 * still passes through unvalidated (C-4). The `__test_*` actions (C-2) are not in `ActionName` and never
 * get a schema.
 *
 * zod v3 only (D-26). Schemas extend `baseReply`, which is `.passthrough()`, so additive fields never
 * break compatibility. dkjson encodes an empty Lua table as `[]` and can emit NaN/inf as `null`
 * (R-8); `luaArray`, `luaMap` and `luaNumber` absorb that.
 */
import { z } from 'zod';

/** Every non-test action the Lua side registers (`pob-api/API/Handlers.lua`, plus its merged modules'). */
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
  'get_warnings',
  'update_tree_delta',
  'calc_with',
  'get_config',
  'set_config',
  'create_socket_group',
  'add_gem',
  'set_gem_level',
  'set_gem_quality',
  'set_gem_corruption',
  'remove_skill',
  'remove_gem',
  'search_nodes',
  'list_gems',
  'get_classes',
  'list_support_candidates',
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
  'lookup_game_data',
  'check_coverage',
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

/** A reply with no payload beyond the base (`{id, ok:true}`). */
const emptyReply = baseReply;

/** A Lua string field that may be missing (a nil value leaves the key out of the reply). */
const optString = z.string().optional();
const optNumber = luaNumber.optional();

// ---------------------------------------------------------------------------------------------------
// Core actions (`pob-api/API/Handlers.lua` + `BuildOps.lua`)

export const pingReply = baseReply.extend({ pong: z.literal(true) });

export const versionReply = baseReply.extend({
  version: z
    .object({ number: z.string(), branch: z.string(), platform: z.string(), apiVersion: z.string() })
    .passthrough(),
});

/** `new_build` and `load_build_xml`: the engine's build name after the switch (C-2). */
export const buildNameReply = baseReply.extend({ result: z.object({ name: z.string().nullable() }).passthrough() });

/** `new_build`: the build name, plus the new build's engine class and ascendancy names. */
export const newBuildReply = baseReply.extend({
  result: z.object({ name: z.string().nullable(), className: optString, ascendClassName: optString }).passthrough(),
});

/** `get_stats` metadata: the omitted non-scalar keys (X13), and the active spec's tree version. */
export const statsMetaSchema = z
  .object({
    omitted: luaArray(z.string()),
    treeVersion: z.string().optional(),
    level: z.number().optional(),
    buildName: z.string().optional(),
  })
  .passthrough();

/** A scalar stat value; NaN/inf numbers arrive as null (R-8). */
const statValue = z.union([z.number(), z.string(), z.boolean(), z.null()]);

/** C-45: one stat set of a breakdown skill, with the requested fields measured as the main selection. */
export const breakdownStatSetSchema = z
  .object({ index: z.number().int(), label: z.string(), output: luaMap(statValue) })
  .passthrough();

/** C-45: one active skill of the broken-down group (`index` is its place in the group's skill list). */
export const breakdownSkillSchema = z
  .object({
    index: z.number().int(),
    name: z.string(),
    grantedEffectId: z.string(),
    statSets: luaArray(breakdownStatSetSchema),
  })
  .passthrough();

/** C-45: `get_stats` with `breakdown`: per active skill and per stat set of one socket group. */
export const statsBreakdownSchema = z
  .object({ groupIndex: z.number().int(), label: z.string(), skills: luaArray(breakdownSkillSchema) })
  .passthrough();
export type StatsBreakdown = z.infer<typeof statsBreakdownSchema>;

export const getStatsReply = baseReply.extend({
  stats: z.object({ _meta: statsMetaSchema }).catchall(statValue),
  /** Only when the request has `breakdown` (C-45). */
  breakdown: statsBreakdownSchema.optional(),
});
export type StatsResult = z.infer<typeof getStatsReply>['stats'];

/** One `get_items` slot. Hidden slots are listed too: `inactive`/`shown` say which (E8). */
export const itemSlotSchema = z
  .object({
    slot: z.string(),
    id: z.number().int(),
    inactive: z.boolean(),
    shown: z.boolean(),
    name: z.string().optional(),
    baseName: z.string().optional(),
    type: z.string().optional(),
    rarity: z.string().optional(),
    raw: z.string().optional(),
    active: z.boolean().optional(),
  })
  .passthrough();
export type ItemSlot = z.infer<typeof itemSlotSchema>;

export const getItemsReply = baseReply.extend({ items: luaArray(itemSlotSchema) });

const skillGemSchema = z
  .object({
    index: z.number().int(),
    name: z.string(),
    nameSpec: optString,
    level: optNumber,
    quality: luaNumber,
    enabled: z.boolean(),
    isSupport: z.boolean(),
    gemType: optString,
    tags: optString,
    tagKeys: luaArray(z.string()),
    known: z.boolean(),
  })
  .passthrough();

const socketGroupSchema = z
  .object({
    index: z.number().int(),
    label: optString,
    slot: optString,
    enabled: z.boolean().optional(),
    includeInFullDPS: z.boolean().optional(),
    mainActiveSkill: optNumber,
    skills: luaArray(z.string()),
    gems: luaArray(skillGemSchema),
    activeCount: z.number().int(),
    supportCount: z.number().int(),
  })
  .passthrough();

export const skillsSchema = z
  .object({
    mainSocketGroup: optNumber,
    calcsSkillNumber: optNumber,
    groups: luaArray(socketGroupSchema),
  })
  .passthrough();
export type SkillsResult = z.infer<typeof skillsSchema>;

export const getSkillsReply = baseReply.extend({ skills: skillsSchema });

/** C-44: the stat set `set_main_selection` selected; only when the request has `statSet`. */
export const selectedStatSetSchema = z
  .object({
    index: z.number().int(),
    label: z.string(),
    count: z.number().int(),
    skill: z.string(),
    grantedEffectId: z.string(),
  })
  .passthrough();
export type SelectedStatSet = z.infer<typeof selectedStatSetSchema>;

export const setMainSelectionReply = getSkillsReply.extend({ statSet: selectedStatSetSchema.optional() });

export const treeSchema = z
  .object({
    treeVersion: z.string(),
    classId: z.number().int(),
    ascendClassId: z.number().int(),
    secondaryAscendClassId: z.number().int(),
    /** The active spec's engine class and ascendancy names (`curClassName`/`curAscendClassName`). */
    className: optString,
    ascendClassName: optString,
    nodes: luaArray(z.number().int()),
  })
  .passthrough();
export type TreeResult = z.infer<typeof treeSchema>;

/** `get_tree` and `set_tree`. */
export const treeReply = baseReply.extend({ tree: treeSchema });

/**
 * `update_tree_delta` (C-48, D-194): the tree with the ascendancy points it uses after the call (the start
 * node excluded), the path nodes allocated beyond the requested ones, and the requested nodes skipped
 * because their path would take the ascendancy points over 8.
 */
const deltaTreeSchema = treeSchema.extend({ ascendancyPointsUsed: z.number().int() });
export const updateTreeDeltaReply = baseReply.extend({
  tree: deltaTreeSchema,
  autoPathedNodes: luaArray(z.number().int()),
  skippedAscendancyNodes: luaArray(z.number().int()),
});
export interface UpdateTreeDeltaResult {
  tree: z.infer<typeof deltaTreeSchema>;
  autoPathedNodes: number[];
  skippedAscendancyNodes: number[];
}

/** C-40's attribute choices, as `set_tree`'s `attributeChoices` takes them. */
export const ATTRIBUTE_CHOICES = ['strength', 'dexterity', 'intelligence'] as const;
export type AttributeChoice = (typeof ATTRIBUTE_CHOICES)[number];

export const addItemTextReply = baseReply.extend({
  item: z.object({ id: z.number().int(), name: z.string(), slot: optString }).passthrough(),
});

export const exportBuildXmlReply = baseReply.extend({ xml: z.string() });

export const getBuildInfoReply = baseReply.extend({
  info: z
    .object({
      name: optString,
      level: optNumber,
      className: optString,
      ascendClassName: optString,
      classId: optNumber,
      ascendClassId: optNumber,
      /** The active passive spec's tree version (e.g. "0_5"), never the build's targetVersion. */
      treeVersion: optString,
    })
    .passthrough(),
});
export type BuildInfoResult = z.infer<typeof getBuildInfoReply>['info'];

/**
 * `get_warnings` (D-30): PoB's own warning lines (`build.controls.warnings.lines`, colour codes
 * stripped), rebuilt by `RefreshStatList` with the level and its auto mode restored (WU-18).
 */
export const getWarningsReply = baseReply.extend({
  result: z.object({ lines: luaArray(z.string()) }).passthrough(),
});

export const calcWithReply = baseReply.extend({ output: luaMap(luaNumber) });

const configScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
/** One of PoB2's config options (`Modules/ConfigOptions`): its key, control type and section. */
export const configOptionSchema = z.object({ key: z.string(), type: z.string(), section: z.string() }).passthrough();
/**
 * The build's config over PoB2's config options (WU-12):
 * - `enemyLevel`: the enemy level in effect (ConfigTab:UpdateLevel);
 * - `input`: every option the build sets, with its value;
 * - `defaults`: for options it doesn't set, the value PoB uses instead (ConfigTab:GetDefaultState);
 * - `options`: every option key, in PoB's order.
 */
export const configSchema = z
  .object({
    enemyLevel: optNumber,
    input: luaMap(configScalar),
    defaults: luaMap(configScalar),
    options: luaArray(configOptionSchema),
  })
  .passthrough();
export type ConfigResult = z.infer<typeof configSchema>;

/** `get_config` and `set_config` (the config after the change). */
export const configReply = baseReply.extend({ config: configSchema });

export const createSocketGroupReply = baseReply.extend({
  socketGroup: z.object({ index: z.number().int(), label: optString }).passthrough(),
});

export const addGemReply = baseReply.extend({
  gem: z
    .object({ gemIndex: z.number().int(), name: z.string(), gemId: optString, support: z.boolean().optional() })
    .passthrough(),
});

export const searchNodesReply = baseReply.extend({
  results: z
    .object({
      nodes: luaArray(
        z
          .object({
            id: z.number().int(),
            name: z.string(),
            type: z.string(),
            stats: luaArray(z.string()),
            allocated: z.boolean(),
            x: optNumber,
            y: optNumber,
            orbit: optNumber,
            orbitIndex: optNumber,
            ascendancyName: optString,
            /** PoB's point cost to allocate the node (unallocated, reachable nodes only). */
            pathDist: z.number().int().optional(),
            /** The node ids allocating it takes (PoB's `node.path`, the node itself first). */
            path: luaArray(z.number().int()).optional(),
          })
          .passthrough(),
      ),
      /** The nodes returned (≤ `maxResults`). */
      count: z.number().int(),
      /** Every match before the cut (C-43: sorted before the cap). */
      total: z.number().int().optional(),
    })
    .passthrough(),
});

export const listGemsReply = baseReply.extend({
  result: z
    .object({
      gems: luaArray(
        z
          .object({
            name: z.string(),
            kind: z.enum(['active', 'support']),
            gemType: optString,
            gemFamily: optString,
            tags: optString,
            tagKeys: luaArray(z.string()),
            maxLevel: optNumber,
            tier: optNumber,
            reqStr: optNumber,
            reqDex: optNumber,
            reqInt: optNumber,
          })
          .passthrough(),
      ),
      count: z.number().int(),
      total: z.number().int(),
    })
    .passthrough(),
});

/**
 * `list_support_candidates`: the support gems PoB says can support a socket group's active skills
 * (`calcLib.canGrantedEffectSupportActiveSkill`, non-legacy, not already in the group). With `measure`,
 * each candidate carries `value` (PoB's gem-selector stat with it added, on that group as the main skill)
 * and `delta` (minus `measured.baseline`), or `error` when its calculation failed.
 */
export const supportCandidateSchema = z
  .object({
    name: z.string(),
    gemId: z.string(),
    tags: optString,
    value: optNumber,
    delta: optNumber,
    error: optString,
  })
  .passthrough();
export type SupportCandidate = z.infer<typeof supportCandidateSchema>;

export const listSupportCandidatesReply = baseReply.extend({
  result: z
    .object({
      groupIndex: z.number().int(),
      label: optString,
      activeSkills: luaArray(z.string()),
      candidates: luaArray(supportCandidateSchema),
      socketed: luaArray(
        z.object({ gemIndex: z.number().int(), name: z.string(), supportsActive: z.boolean() }).passthrough(),
      ),
      measured: z
        .object({ stat: z.string(), baseline: luaNumber, groupIndex: z.number().int() })
        .passthrough()
        .optional(),
    })
    .passthrough(),
});
export type SupportCandidatesResult = z.infer<typeof listSupportCandidatesReply>['result'];

export const getClassesReply = baseReply.extend({
  result: z
    .object({
      classes: luaArray(
        z
          .object({
            classId: z.number().int(),
            name: z.string(),
            ascendancies: luaArray(z.object({ id: z.number().int(), name: z.string() }).passthrough()),
          })
          .passthrough(),
      ),
    })
    .passthrough(),
});

/** The gem corruption states (D-91), PoB2's corruption dropdown (`SkillsTab.lua` `corruptOption`). */
export const GEM_CORRUPTION_STATES = ['not_corrupted', 'corrupted', 'plus_one_level', 'minus_one_level'] as const;
export type GemCorruptionState = (typeof GEM_CORRUPTION_STATES)[number];

/** `set_gem_corruption` (D-91): the state set and every gem it was set on (support gems never are). */
export const setGemCorruptionReply = baseReply.extend({
  result: z
    .object({
      state: z.enum(GEM_CORRUPTION_STATES),
      gems: luaArray(
        z.object({ groupIndex: z.number().int(), gemIndex: z.number().int(), name: z.string() }).passthrough(),
      ),
    })
    .passthrough(),
});
export type SetGemCorruptionResult = z.infer<typeof setGemCorruptionReply>['result'];

export const setSocketGroupEnabledReply = baseReply.extend({
  result: z.object({ groupIndex: z.number().int(), label: z.string(), enabled: z.boolean() }).passthrough(),
});

/** One passive tree spec; `pointsUsed` is PoB's `CountAllocNodes()` (regular nodes). */
export const specSummarySchema = z
  .object({
    index: z.number().int(),
    title: z.string(),
    treeVersion: z.string(),
    classId: z.number().int(),
    className: optString,
    ascendClassName: optString,
    pointsUsed: z.number().int(),
    active: z.boolean(),
  })
  .passthrough();
export type SpecSummary = z.infer<typeof specSummarySchema>;

export const listSpecsReply = baseReply.extend({
  result: z.object({ specs: luaArray(specSummarySchema), activeSpec: z.number().int() }).passthrough(),
});
export type ListSpecsResult = z.infer<typeof listSpecsReply>['result'];

export const createSpecReply = baseReply.extend({
  result: z.object({ index: z.number().int(), title: z.string(), activated: z.boolean() }).passthrough(),
});
export type CreateSpecResult = z.infer<typeof createSpecReply>['result'];

export const selectSpecReply = baseReply.extend({
  result: z.object({ activeSpec: z.number().int(), title: z.string() }).passthrough(),
});
export type SelectSpecResult = z.infer<typeof selectSpecReply>['result'];

export const deleteSpecReply = baseReply.extend({
  result: z
    .object({ deleted: z.number().int(), activeSpec: z.number().int(), remaining: z.number().int() })
    .passthrough(),
});
export type DeleteSpecResult = z.infer<typeof deleteSpecReply>['result'];

export const renameSpecReply = baseReply.extend({
  result: z.object({ index: z.number().int(), title: z.string() }).passthrough(),
});
export type RenameSpecResult = z.infer<typeof renameSpecReply>['result'];

export const listItemSetsReply = baseReply.extend({
  result: z
    .object({
      itemSets: luaArray(z.object({ id: z.number().int(), title: z.string(), active: z.boolean() }).passthrough()),
      activeItemSet: z.number().int(),
    })
    .passthrough(),
});
export type ListItemSetsResult = z.infer<typeof listItemSetsReply>['result'];

export const selectItemSetReply = baseReply.extend({
  result: z.object({ activeItemSet: z.number().int(), title: z.string() }).passthrough(),
});
export type SelectItemSetResult = z.infer<typeof selectItemSetReply>['result'];

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

// ---------------------------------------------------------------------------------------------------
// Lookup actions (`pob-api/API/Lookup.lua`, C-37)

/**
 * One stat set: its describer lines, and (D-241) the base attack damage multiplier and critical hit
 * chance of its level data (the granted effect's level overlaid by the stat set's), with `baseLines`
 * in the gem tooltip's wording.
 */
const lookupStatSetSchema = z
  .object({
    index: z.number().int(),
    label: z.string(),
    lines: luaArray(z.string()),
    baseMultiplier: z.number().optional(),
    critChance: z.number().optional(),
    baseLines: luaArray(z.string()),
  })
  .passthrough();

/** The variants of a unique that have a line the selected variant lacks (legacy variants left out). */
const lookupVariantsSchema = luaArray(z.object({ index: z.number().int(), name: optString }).passthrough());

/** A gem: its stat sets' tooltip lines at one level and quality, quality lines, rules, requirements. */
export const lookupGemSchema = z
  .object({
    kind: z.literal('gem'),
    id: z.string(),
    name: z.string(),
    gemKind: z.enum(['active', 'support']),
    gemType: optString,
    tags: optString,
    description: optString,
    weapon: optString,
    level: z.number().int(),
    /** Set when the requested gem_level isn't one of this gem's levels, so it is shown at its default. */
    levelNote: optString,
    quality: z.number().int(),
    statSets: luaArray(lookupStatSetSchema),
    /** The gem's additional granted effects, in PoB's tooltip order. */
    additional: luaArray(
      z.object({ name: z.string(), support: z.boolean(), statSets: luaArray(lookupStatSetSchema) }).passthrough(),
    ),
    /** "At +20% Quality" lines. */
    qualityLines: luaArray(z.string()),
    /** Supports only: PoB's `requireSkillTypes` / `excludeSkillTypes`, as SkillType names. */
    supports: luaArray(z.string()).optional(),
    cannotSupport: luaArray(z.string()).optional(),
    /** Per gem level 1..maxLevel: the level requirement, and the attribute requirements with a weight. */
    requirements: z
      .object({
        maxLevel: z.number().int(),
        levels: luaArray(z.number()),
        str: luaArray(z.number()).optional(),
        dex: luaArray(z.number()).optional(),
        int: luaArray(z.number()).optional(),
      })
      .passthrough(),
  })
  .passthrough();

/**
 * A unique: its uniqueDB key, name, item type, base and the lines that matched (any variant's; at most 5,
 * `matchedCount` counts them all). `raw` (`BuildRaw()`, for add_item) and `selectedVariant` come only
 * when exactly one unique is returned (D-239).
 */
export const lookupUniqueSchema = z
  .object({
    kind: z.literal('unique'),
    id: z.string(),
    name: z.string(),
    type: z.string(),
    baseName: optString,
    byName: z.boolean(),
    matchedLines: luaArray(z.object({ line: z.string(), variants: lookupVariantsSchema.optional() }).passthrough()),
    matchedCount: z.number().int(),
    raw: optString,
    selectedVariant: z.object({ index: z.number().int(), name: optString }).passthrough().optional(),
  })
  .passthrough();

/** A mechanic hit: one matching line and where it came from. */
export const lookupHitSchema = z
  .object({
    kind: z.enum(['gem', 'unique', 'passive', 'mod']),
    id: z.string(),
    name: z.string(),
    source: z.string(),
    line: z.string(),
    nodeId: z.number().int().optional(),
    ascendancy: optString,
    table: optString,
    /** A unique hit from a variant other than the selected one. */
    variants: lookupVariantsSchema.optional(),
  })
  .passthrough();

export const lookupGameDataReply = baseReply.extend({
  result: z
    .object({
      mode: z.enum(['gem', 'unique', 'mechanic']),
      /** Every match before the cut (in mechanic mode, of the requested `kind`). */
      total: z.number().int(),
      /** Mechanic mode: every kind's hit count, whatever `kind` was asked for (D-240). */
      kinds: z.object({ gem: z.number().int(), unique: z.number().int(), passive: z.number().int(), mod: z.number().int() }).optional(),
      results: luaArray(z.union([lookupGemSchema, lookupUniqueSchema, lookupHitSchema])),
    })
    .passthrough(),
});
export type LookupGameDataResult = z.infer<typeof lookupGameDataReply>['result'];
export type LookupGem = z.infer<typeof lookupGemSchema>;
export type LookupUnique = z.infer<typeof lookupUniqueSchema>;
export type LookupHit = z.infer<typeof lookupHitSchema>;

// ---------------------------------------------------------------------------------------------------
// Coverage actions (`pob-api/API/Coverage.lua`, C-38)

/** C-38's statuses, one per checked line, in the order counts are reported. */
export const COVERAGE_STATUSES = [
  'fully parsed',
  'partly parsed',
  'unparsed',
  'parsed to nothing',
  'possibly unread',
  'possibly unmodelled; check config',
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

/**
 * One checked line (or clean join of lines) of an item, a passive node or a gem's stat set. `remainder`
 * (partly parsed) is the parser's text verbatim; `unread` (possibly unread) names the mods the name scan
 * didn't find; `stat` is a gem line's stat id; `nodeId` a node line's node.
 */
export const coverageEntrySchema = z
  .object({
    kind: z.enum(['item', 'node', 'gem']),
    source: z.string(),
    line: z.string(),
    status: z.enum(COVERAGE_STATUSES),
    remainder: optString,
    joinedWith: luaArray(z.string()).optional(),
    unread: luaArray(z.string()).optional(),
    stat: optString,
    nodeId: z.number().int().optional(),
  })
  .passthrough();
export type CoverageEntry = z.infer<typeof coverageEntrySchema>;

export const checkCoverageReply = baseReply.extend({
  result: z
    .object({
      /** Every status's line count, over every checked line (also the ones build mode doesn't list). */
      counts: z.object(
        Object.fromEntries(COVERAGE_STATUSES.map((s) => [s, z.number().int()])) as Record<CoverageStatus, z.ZodNumber>,
      ),
      entries: luaArray(coverageEntrySchema),
      /** The level and quality each gem was checked at; `fromBuild` when they are its build instance's. */
      gems: luaArray(
        z.object({ name: z.string(), level: z.number().int(), quality: z.number().int(), fromBuild: z.boolean() }).passthrough(),
      ),
      checked: z.object({ items: z.number().int(), nodes: z.number().int(), gems: z.number().int() }).passthrough(),
    })
    .passthrough(),
});
export type CheckCoverageResult = z.infer<typeof checkCoverageReply>['result'];

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
  /**
   * Additive: the report stats a later `trade_evaluate_items` will be asked for, checked here (each a
   * sort stat or a numeric stat of the build's output) so a bad name fails before any trade request.
   * A bad entry fails with `reportStats[<i>]: unknown report stat <name> (…)`.
   */
  reportStats?: string[];
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

/** One schema per action (C-5); `satisfies` makes a missing action a compile error. */
const definedSchemas = {
  ping: pingReply,
  version: versionReply,
  new_build: newBuildReply,
  load_build_xml: buildNameReply.extend({ result: z.object({ name: z.string() }).passthrough() }),
  get_stats: getStatsReply,
  get_items: getItemsReply,
  get_skills: getSkillsReply,
  get_tree: treeReply,
  set_main_selection: setMainSelectionReply,
  set_tree: treeReply,
  add_item_text: addItemTextReply,
  export_build_xml: exportBuildXmlReply,
  set_level: emptyReply,
  set_flask_active: emptyReply,
  get_build_info: getBuildInfoReply,
  get_warnings: getWarningsReply,
  update_tree_delta: updateTreeDeltaReply,
  calc_with: calcWithReply,
  get_config: configReply,
  set_config: configReply,
  create_socket_group: createSocketGroupReply,
  add_gem: addGemReply,
  set_gem_level: emptyReply,
  set_gem_quality: emptyReply,
  set_gem_corruption: setGemCorruptionReply,
  remove_skill: emptyReply,
  remove_gem: emptyReply,
  search_nodes: searchNodesReply,
  list_gems: listGemsReply,
  get_classes: getClassesReply,
  list_support_candidates: listSupportCandidatesReply,
  set_socket_group_enabled: setSocketGroupEnabledReply,
  set_gem_enabled: emptyReply,
  create_spec: createSpecReply,
  list_specs: listSpecsReply,
  select_spec: selectSpecReply,
  delete_spec: deleteSpecReply,
  rename_spec: renameSpecReply,
  list_item_sets: listItemSetsReply,
  select_item_set: selectItemSetReply,
  trade_generate_query: tradeGenerateQueryReply,
  trade_evaluate_items: tradeEvaluateItemsReply,
  trade_query_options: tradeQueryOptionsReply,
  lookup_game_data: lookupGameDataReply,
  check_coverage: checkCoverageReply,
} satisfies { [A in ActionName]: z.ZodTypeAny };
type DefinedSchemas = typeof definedSchemas;

/**
 * The registry the bridge client validates against. Mutable on purpose: it is the one place a
 * schema is registered, and tests replace or remove a schema to exercise the hook (C-4).
 */
export const replySchemas: ReplySchemaRegistry = { ...definedSchemas };

/** A validated reply (C-5): the action's schema type. */
export type ActionReply<A extends ActionName> = z.infer<DefinedSchemas[A]>;

/** No params. */
type NoParams = Record<string, never>;

/** Request params per action (camelCase, C-2), as `pob-api/API/BuildOps.lua` reads them. */
export interface ActionParamsMap {
  ping: NoParams;
  version: NoParams;
  new_build: { className?: string; ascendancy?: string };
  /** `keepLevel`: put back the `<Build>`'s recorded level and auto-level flag after PoB's level estimate (D-9 put-back). */
  load_build_xml: { xml: string; name?: string; keepLevel?: boolean };
  /** `breakdown`: also measure one socket group per active skill and stat set (C-45; default group: the main one). */
  get_stats: { fields?: string[]; breakdown?: { groupIndex?: number; fields: string[] } };
  get_items: NoParams;
  get_skills: NoParams;
  get_tree: NoParams;
  /** `statSet`: the 1-based stat set of the group's main active skill, PoB2's `srcInstance.statSet` (C-44). */
  set_main_selection: { mainSocketGroup?: number; mainActiveSkill?: number; statSet?: number };
  /**
   * C-40: `weaponSets` (node id → weapon set) replaces every weapon-set tag, and `attributeChoices` (node
   * id → attribute) is applied over the kept choices; every node they name must be in `nodes`. With
   * either, the call is all-or-nothing and fails, changing nothing, if the allocation would change.
   * Without both, the tags and choices are kept (AC-E29).
   */
  set_tree: {
    classId: number;
    ascendClassId: number;
    secondaryAscendClassId?: number;
    nodes: number[];
    treeVersion?: string;
    weaponSets?: Record<string, 1 | 2>;
    attributeChoices?: Record<string, AttributeChoice>;
  };
  /** `validateOnly`: parse the text and check the slot, change nothing (the reply's `id` is 0). */
  add_item_text: { text: string; slotName?: string; noAutoEquip?: boolean; validateOnly?: boolean };
  export_build_xml: NoParams;
  set_level: { level: number };
  /** `slot` is "Flask 1"–"Flask 2" or "Charm 1"–"Charm 3"; `index` alone means "Flask <index>". */
  set_flask_active: { slot?: string; index?: number; active: boolean };
  get_build_info: NoParams;
  get_warnings: NoParams;
  update_tree_delta: {
    addNodes?: number[];
    removeNodes?: number[];
    classId?: number;
    ascendClassId?: number;
    secondaryAscendClassId?: number;
    treeVersion?: string;
  };
  calc_with: { addNodes?: number[]; removeNodes?: number[]; useFullDPS?: boolean; fields?: string[] };
  get_config: NoParams;
  /**
   * PoB2 config option keys (`get_config`'s `options`) → value: a boolean for a checkbox, a number for
   * a number field, a list value or text otherwise; `""` clears a non-checkbox option back to PoB's
   * default. An unknown key or a bad value fails the call and changes nothing.
   */
  set_config: Record<string, string | number | boolean>;
  create_socket_group: { label?: string; slot?: string; enabled?: boolean; includeInFullDPS?: boolean };
  /** `validateOnly`: resolve `gemName` only, change nothing (the reply's `gemIndex` is 0). */
  add_gem:
    | {
        groupIndex: number;
        gemName: string;
        level?: number;
        quality?: number;
        qualityId?: string;
        enabled?: boolean;
        count?: number;
        validateOnly?: false;
      }
    | { gemName: string; validateOnly: true };
  set_gem_level: { groupIndex: number; gemIndex: number; level: number };
  set_gem_quality: { groupIndex: number; gemIndex: number; quality: number; qualityId?: string };
  /** D-91 scope: both indices = that gem; `groupIndex` only = the group's active gems; neither = the build's. */
  set_gem_corruption: { state: GemCorruptionState; groupIndex?: number; gemIndex?: number };
  remove_skill: { groupIndex: number };
  remove_gem: { groupIndex: number; gemIndex: number };
  /** C-43: `keyword` is optional when `ascendancy` (a name) is given; `nodeType` 'any' filters nothing. */
  search_nodes: { keyword?: string; ascendancy?: string; nodeType?: string; maxResults?: number; includeAllocated?: boolean };
  list_gems: { type?: 'active' | 'support'; search?: string; tag?: string; maxResults?: number; dedupeByName?: boolean };
  get_classes: NoParams;
  list_support_candidates: { groupIndex: number; measure?: boolean };
  set_socket_group_enabled: { groupIndex: number; enabled: boolean };
  set_gem_enabled: { groupIndex: number; gemIndex: number; enabled: boolean };
  create_spec: { title?: string; copyFrom?: number; activate?: boolean };
  list_specs: NoParams;
  select_spec: { index: number };
  delete_spec: { index: number };
  rename_spec: { index: number; title: string };
  list_item_sets: NoParams;
  select_item_set: { id: number };
  trade_generate_query: TradeGenerateQueryParams;
  trade_evaluate_items: TradeEvaluateItemsParams;
  trade_query_options: { slot: string };
  /**
   * C-37: `query` is required for gem and mechanic modes; unique mode needs `query`, `slot` or both;
   * `kind` (mechanic mode, D-240) keeps one kind of hit.
   */
  lookup_game_data: {
    mode: 'gem' | 'unique' | 'mechanic';
    query?: string;
    level?: number;
    quality?: number;
    slot?: string;
    kind?: 'gem' | 'unique' | 'passive' | 'mod';
    maxResults?: number;
  };
  /**
   * C-38: one or more of `itemText`, `nodes` (ids or exact names) and `gems` (names), or `build: true`
   * alone; `sourceNames` (required) is the server's name scan of PoB's source (D-226), `sourceTemplates`
   * its concatenation templates (D-243).
   */
  check_coverage: {
    itemText?: string;
    nodes?: Array<string | number>;
    gems?: string[];
    build?: boolean;
    sourceNames: string[];
    sourceTemplates?: string[];
  };
}

/** Request params (camelCase, C-2) for an action. */
export type ActionParams<A extends ActionName> = ActionParamsMap[A];

/**
 * A reply payload as handlers consume it: the schema's known fields keep their types, and any other
 * field (`.passthrough()`) reads as `any` rather than `unknown`.
 */
export type Loose<T> = T & { [key: string]: any };

/** A test action's reply (unvalidated). */
export type TestReply = { id: number; ok: true; [key: string]: unknown };
