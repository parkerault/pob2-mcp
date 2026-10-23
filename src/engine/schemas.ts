/**
 * Lua action reply schemas (C-5): one zod schema per Lua action.
 *
 * Every reply the bridge client receives with `ok:true` is validated by `replySchemas[action]` before
 * it reaches a caller (C-4). Every non-test action registered in `pob-api/API/Handlers.lua` and the
 * modules it merges (`API/Trade.lua`, `API/Lookup.lua`, `API/Coverage.lua`, `API/Sets.lua`, `API/Compile.lua`,
 * `API/NodePower.lua`) has a schema here (checked statically and on
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
  'get_rule_breaks',
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
  'manage_sets',
  'compile_check',
  'compile_stage',
  'compile_finish',
  'node_power',
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

/**
 * D-398: one granted socket group (a passive's or an item's skill) the load took gems from: its label or granted
 * skill, its PoB source (`Tree:<node id>` or `Item:<id>:<name>`), the passive's or item's name, `grantMissing`
 * when nothing grants the skill (PoB removed the group; the granted skill isn't among the gems), and the gems
 * PoB dropped, in the document's order.
 */
const droppedSupportGroupSchema = z
  .object({
    group: z.string(),
    source: z.string(),
    grantedBy: optString,
    grantMissing: z.boolean().optional(),
    gems: z.array(z.string()),
  })
  .passthrough();
export type DroppedSupportGroup = z.infer<typeof droppedSupportGroupSchema>;

/** `load_build_xml`: the build's name, and the gems PoB dropped from its granted groups (D-398; `[]` for none). */
export const loadBuildXmlReply = buildNameReply.extend({
  result: z.object({ name: z.string(), droppedSupports: z.array(droppedSupportGroupSchema) }).passthrough(),
});

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

/**
 * D-377: a summon's minion and its skill list, as PoB's minion-skill dropdown shows it: the minion's live
 * skills in order (`skills`), the selected one (`index`, `name`), and that skill's stat set (`statSet`, of
 * the labels `statSets`). `index` is absent only if PoB's selection is none of the list's skills.
 */
export const minionSelectionSchema = z
  .object({
    minion: z.string(),
    minionId: z.string(),
    skills: luaArray(z.string()),
    index: z.number().int().optional(),
    name: optString,
    statSet: z.number().int(),
    statSets: luaArray(z.string()),
  })
  .passthrough();
export type MinionSelection = z.infer<typeof minionSelectionSchema>;

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
    /** D-377: a summon's minion and its selected skill, which the breakdown measures. */
    minion: minionSelectionSchema.optional(),
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

/** D-377: a summon among a group's active skills: its index and name, then its minion's selection. */
export const groupMinionSchema = minionSelectionSchema.extend({ activeSkill: z.number().int(), summon: optString });
export type GroupMinion = z.infer<typeof groupMinionSchema>;

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
    /** D-377: the group's summons (active skills with a minion); absent when it has none. */
    minions: luaArray(groupMinionSchema).optional(),
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

/** D-377: the minion skill `set_main_selection` selected (BuildOps.select_minion_skill); only with `minionSkill`. */
export const selectedMinionSkillSchema = groupMinionSchema.extend({ index: z.number().int(), name: z.string() });
export type SelectedMinionSkill = z.infer<typeof selectedMinionSkillSchema>;

export const setMainSelectionReply = getSkillsReply.extend({
  statSet: selectedStatSetSchema.optional(),
  minion: selectedMinionSkillSchema.optional(),
});

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
  item: z
    .object({
      id: z.number().int(),
      name: z.string(),
      slot: optString,
      /** D-384: a unique PoB marks no longer obtainable, added as PoB adds it; `title` is its name. */
      unobtainable: z.boolean().optional(),
      title: optString,
    })
    .passthrough(),
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

/** A node an unlock constraint names that isn't allocated (D-383). */
export const unlockNeedSchema = z.object({ id: z.number().int(), name: z.string(), ascendancy: z.string().optional() }).passthrough();
/** An allocated node whose unlock constraint is unmet, with the nodes it still needs (D-383). */
export const lockedNodeSchema = z.object({ id: z.number().int(), name: z.string(), needs: luaArray(unlockNeedSchema) }).passthrough();

/** A gem PoB marks legacy in the active skill set (D-384): its name, group and the group's label. */
export const legacyGemSchema = z.object({ name: z.string(), group: z.number().int(), label: optString }).passthrough();
/** An equipped unique PoB marks no longer obtainable (D-384): its name and slot. */
export const unobtainableUniqueSchema = z.object({ name: z.string(), slot: z.string() }).passthrough();

/**
 * `get_rule_breaks` (D-383, D-384): what the game won't allow in the loaded build, which PoB itself allows:
 * each allocated node whose unlock constraint is unmet (vendor Classes/PassiveSpec.lua:1248-1251), by id; each
 * gem PoB marks legacy in the active skill set, by group; each equipped unique PoB marks no longer obtainable,
 * by slot.
 */
export const getRuleBreaksReply = baseReply.extend({
  result: z
    .object({
      lockedNodes: luaArray(lockedNodeSchema),
      legacyGems: luaArray(legacyGemSchema),
      unobtainableUniques: luaArray(unobtainableUniqueSchema),
    })
    .passthrough(),
});
export type RuleBreaksResult = z.infer<typeof getRuleBreaksReply>['result'];

export const calcWithReply = baseReply.extend({ output: luaMap(luaNumber) });

const configScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
/**
 * One of PoB2's config options (`Modules/ConfigOptions`): its key, control type and section, and (C-37c) its label
 * without PoB's colour codes, absent for an option with none.
 */
export const configOptionSchema = z
  .object({ key: z.string(), type: z.string(), section: z.string(), label: optString })
  .passthrough();
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

/**
 * `create_socket_group`: the new group's index and label, whether it is in PoB's Full DPS, and its Count
 * (`groupCount`, D-293), absent when none was given.
 */
export const createSocketGroupReply = baseReply.extend({
  socketGroup: z
    .object({ index: z.number().int(), label: optString, includeInFullDPS: z.boolean(), groupCount: z.number().int().min(1).optional() })
    .passthrough(),
});

export const addGemReply = baseReply.extend({
  gem: z
    .object({
      gemIndex: z.number().int(),
      name: z.string(),
      gemId: optString,
      support: z.boolean().optional(),
      /** D-384: a gem PoB marks legacy, added as PoB adds it behind "Show legacy gems". */
      legacy: z.boolean().optional(),
    })
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
    /** PoB's `Tier` (`Data/Gems.lua`; D-258). */
    tier: z.number().int().optional(),
    gemType: optString,
    tags: optString,
    description: optString,
    weapon: optString,
    level: z.number().int(),
    /** Set when the requested gem_level isn't one of this gem's levels, so it is shown at its default. */
    levelNote: optString,
    quality: z.number().int(),
    statSets: luaArray(lookupStatSetSchema),
    /** The gem's additional granted effects, in PoB's tooltip order; a non-support one names its skill types (WU-53). */
    additional: luaArray(
      z
        .object({
          name: z.string(),
          support: z.boolean(),
          skillTypes: luaArray(z.string()).optional(),
          statSets: luaArray(lookupStatSetSchema),
        })
        .passthrough(),
    ),
    /** "At +20% Quality" lines. */
    qualityLines: luaArray(z.string()),
    /**
     * WU-53 (PG-46): the Gemling quality lines (`altQualityStats`, described as the quality lines are);
     * `hasGemling` when any granted effect has such an entry, though it may describe to no line.
     */
    gemlingLines: luaArray(z.string()),
    hasGemling: z.boolean(),
    /** WU-53: an active gem's skill types (its granted effect's), sorted by name. */
    skillTypes: luaArray(z.string()).optional(),
    /** WU-53: an active gem's "usable by": the meta gems whose support effect can support it. */
    usableBy: luaArray(z.object({ name: z.string(), trigger: z.boolean() }).passthrough()).optional(),
    /** WU-53: the gem's hit-making children: granted or triggered skills, and minions' skills. */
    children: luaArray(
      z.object({ name: z.string(), kind: z.enum(['granted', 'triggered', 'minion']), minion: optString }).passthrough(),
    ),
    /**
     * WU-53, only when exactly one gem is returned, or every returned gem is named as the query, for a support
     * gem: the active gems it can support. `count` of `total`; `names` are those gems, or with `except` (over
     * half of them) the ones it can't support, one entry per gem (a shared name repeats).
     */
    canSupport: z
      .object({ count: z.number().int(), total: z.number().int(), except: z.boolean(), names: luaArray(z.string()) })
      .passthrough()
      .optional(),
    /**
     * WU-53, under the same rule as `canSupport`, for an active gem: each support it can't support that another
     * support (`after`) unlocks by adding skill types.
     */
    unlocks: luaArray(z.object({ name: z.string(), after: luaArray(z.string()) }).passthrough()).optional(),
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
    /**
     * C-37a (D-425): per gem level 1..maxLevel, as PoB's `grantedEffect.levels[n]` holds them: the cost (each
     * resource of its `cost` table, the raw value and PoB's tooltip text, a per-minute cost per second), Spirit
     * reservation (`spiritReservationFlat`), cooldown, stored uses, and a support's `manaMultiplier` and
     * `reservationMultiplier`. Absent when no level holds any of them.
     */
    levelCosts: luaArray(
      z
        .object({
          level: z.number().int(),
          cost: luaArray(z.object({ resource: z.string(), value: z.number(), text: z.string() }).passthrough()).optional(),
          spirit: z.number().optional(),
          cooldown: z.number().optional(),
          storedUses: z.number().optional(),
          manaMultiplier: z.number().optional(),
          reservationMultiplier: z.number().optional(),
        })
        .passthrough(),
    ).optional(),
  })
  .passthrough();

/**
 * D-379: a minion skill whose name is the query, listed in gem mode after the gems: each (minion, summoning
 * gem) that casts it, whether it is a command (a stat set lists `is_commandable_skill`), the passives whose
 * line reads "Grants Skill: <name>", its cooldown, skill types and description, and its stat sets at its
 * highest level (`level` of `levelCount`).
 */
export const lookupMinionSkillSchema = z
  .object({
    kind: z.literal('minion-skill'),
    id: z.string(),
    name: z.string(),
    castBy: luaArray(z.object({ minion: z.string(), minionId: z.string(), gem: z.string(), gemId: z.string() }).passthrough()),
    commanded: z.boolean(),
    grantedBy: luaArray(z.object({ id: z.number().int(), name: z.string(), ascendancy: optString }).passthrough()),
    cooldown: z.number().optional(),
    skillTypes: luaArray(z.string()),
    description: optString,
    level: z.number().int(),
    levelCount: z.number().int(),
    statSets: luaArray(lookupStatSetSchema),
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

/**
 * A base type that can roll a mod (WU-60, D-277): one of PoB's base lists (`data.itemBaseLists`, such as
 * `Gloves: Energy Shield`), or with `itemType` a whole item type all of whose bases can (when it has more
 * than one list). `count` and `total` count bases; `names` lists the bases that can when not all can.
 */
export const lookupBaseTypeSchema = z
  .object({
    name: z.string(),
    itemType: z.boolean().optional(),
    count: z.number().int(),
    total: z.number().int(),
    names: luaArray(z.string()).optional(),
  })
  .passthrough();

/**
 * C-37b (D-425): an item base of base mode, as PoB's `Data/Bases` holds it: its item type and subtype, its
 * required level and attributes (absent when none), implicit lines, defences (non-zero only; `movementPenalty` is
 * PoB's fraction), weapon damage by type with critical hit chance, attacks per second, range and reload time,
 * Spirit and socket limit.
 */
export const lookupItemBaseSchema = z
  .object({
    kind: z.literal('item-base'),
    id: z.string(),
    name: z.string(),
    type: z.string(),
    subType: optString,
    level: z.number().optional(),
    str: z.number().optional(),
    dex: z.number().optional(),
    int: z.number().optional(),
    implicits: luaArray(z.object({ line: z.string(), variants: luaArray(z.string()).optional() }).passthrough()),
    defences: z
      .object({
        armour: z.number().optional(),
        evasion: z.number().optional(),
        energyShield: z.number().optional(),
        ward: z.number().optional(),
        block: z.number().optional(),
        movementPenalty: z.number().optional(),
      })
      .passthrough()
      .optional(),
    weapon: z
      .object({
        damage: luaArray(z.object({ type: z.string(), min: z.number(), max: z.number() }).passthrough()),
        critChance: z.number().optional(),
        attackRate: z.number().optional(),
        range: z.number().optional(),
        reloadTime: z.number().optional(),
      })
      .passthrough()
      .optional(),
    spirit: z.number().optional(),
    socketLimit: z.number().int().optional(),
  })
  .passthrough();

/**
 * C-37c (D-425): a config option of config mode: its key, label (colour codes stripped), control type and section,
 * its list's values and labels, the conditions that show it (each `if…` field with its values; every condition
 * must hold, and any of one condition's values holds it) and its tooltip's first line.
 */
export const lookupConfigSchema = z
  .object({
    kind: z.literal('config'),
    id: z.string(),
    name: z.string(),
    label: optString,
    type: z.string(),
    section: z.string(),
    list: luaArray(z.object({ value: z.string(), label: optString }).passthrough()).optional(),
    conditions: luaArray(z.object({ key: z.string(), values: luaArray(z.string()) }).passthrough()),
    tooltip: optString,
  })
  .passthrough();

/** A mechanic hit: one matching line and where it came from. */
export const lookupHitSchema = z
  .object({
    kind: z.enum(['gem', 'unique', 'passive', 'mod', 'essence', 'base', 'constant']),
    id: z.string(),
    name: z.string(),
    source: z.string(),
    line: z.string(),
    nodeId: z.number().int().optional(),
    ascendancy: optString,
    table: optString,
    /** A unique hit from a variant other than the selected one. */
    variants: lookupVariantsSchema.optional(),
    /**
     * A mod hit: the base types that can roll it (non-zero spawn weight; WU-60, D-277), empty when none can;
     * absent for a mod without spawn weights (a rune's).
     */
    baseTypes: luaArray(lookupBaseTypeSchema).optional(),
    /**
     * A mod hit whose mod PoB never rolls on a base, whatever its weights (an Exclusive or IncursionLimb mod,
     * or a Desecrated mod without a desecrated tag): the reason; `baseTypes` is then empty.
     */
    notRolled: optString,
    /** An essence hit (WU-60): the item types the essence grants the mod on, the mod's id and affix type. */
    itemTypes: luaArray(z.string()).optional(),
    modId: optString,
    affix: optString,
    /** A base hit (WU-53): the base's item type, and the variants its line belongs to. */
    itemType: optString,
    baseVariants: luaArray(z.string()).optional(),
  })
  .passthrough();

/**
 * A closest name, when a query matched nothing (D-258): `kind` is `active` or `support` (gem mode), `unique`
 * (unique mode) or the hit kind (mechanic mode); `detail` is a unique's item type, a passive's ascendancy or
 * a mod's table; `distance` is the edit distance from the query.
 */
export const lookupSuggestionSchema = z
  .object({ name: z.string(), kind: z.string(), detail: optString, distance: z.number().int() })
  .passthrough();

export const lookupGameDataReply = baseReply.extend({
  result: z
    .object({
      mode: z.enum(['gem', 'unique', 'mechanic', 'base', 'config']),
      /** Every match before the cut (in mechanic mode, of the requested `kind`). */
      total: z.number().int(),
      /**
       * Mechanic mode: every kind's hit count, whatever `kind` was asked for (D-240; `essence`, WU-60; `base`, WU-53;
       * `constant`, C-37d).
       */
      kinds: z
        .object({
          gem: z.number().int(),
          unique: z.number().int(),
          passive: z.number().int(),
          mod: z.number().int(),
          essence: z.number().int(),
          base: z.number().int(),
          constant: z.number().int(),
        })
        .optional(),
      results: luaArray(
        z.union([lookupGemSchema, lookupMinionSkillSchema, lookupUniqueSchema, lookupItemBaseSchema, lookupConfigSchema, lookupHitSchema]),
      ),
      /**
       * Only when nothing matched: the closest names of the kind searched, closest first (D-258). Gem mode: up
       * to 5 active gems, then up to 3 supports (D-258a); other modes: up to 5.
       */
      suggestions: luaArray(lookupSuggestionSchema).optional(),
      /** Only when nothing matched and the query was too long to rank names against (D-258). */
      suggestionsSkipped: z.object({ queryLength: z.number().int(), maxQueryLength: z.number().int() }).passthrough().optional(),
      /**
       * D-384: what the query matched but the lookup left out, by name, sorted: gems PoB marks legacy and uniques
       * PoB marks no longer obtainable. Only when there are some.
       */
      leftOut: z
        .object({ legacyGems: luaArray(z.string()), unobtainableUniques: luaArray(z.string()) })
        .passthrough()
        .optional(),
    })
    .passthrough(),
});
export type LookupGameDataResult = z.infer<typeof lookupGameDataReply>['result'];
export type LookupGem = z.infer<typeof lookupGemSchema>;
export type LookupMinionSkill = z.infer<typeof lookupMinionSkillSchema>;
export type LookupUnique = z.infer<typeof lookupUniqueSchema>;
export type LookupHit = z.infer<typeof lookupHitSchema>;
export type LookupItemBase = z.infer<typeof lookupItemBaseSchema>;
export type LookupConfig = z.infer<typeof lookupConfigSchema>;
export type LookupBaseType = z.infer<typeof lookupBaseTypeSchema>;
export type LookupSuggestion = z.infer<typeof lookupSuggestionSchema>;

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

/**
 * C-38's flags (WU-54; D-300, D-336): what PoB doesn't model, reported beside the statuses and never as
 * one, so no status or count changes.
 */
export const COVERAGE_FLAGS = [
  'mapped but unread',
  'stat not mapped',
  'energy not modelled',
  'level from support',
  'granted skill undefined',
  'support colour tie',
] as const;
export type CoverageFlagName = (typeof COVERAGE_FLAGS)[number];

/**
 * One flag. A flag about a gem has source `Gem <name>` and no `line`; a line's flag carries the line and
 * its entry's source (`Gem <name> / <stat set>`, `Node <id> <name>`, or an item's).
 */
export const coverageFlagSchema = z
  .object({
    flag: z.enum(COVERAGE_FLAGS),
    source: z.string(),
    note: z.string(),
    line: optString,
  })
  .passthrough();
export type CoverageFlag = z.infer<typeof coverageFlagSchema>;

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
      /** Every flag of every checked item, node and gem, in the order checked (WU-54). */
      flags: luaArray(coverageFlagSchema),
    })
    .passthrough(),
});
export type CheckCoverageResult = z.infer<typeof checkCoverageReply>['result'];

// ---------------------------------------------------------------------------------------------------
// Sets and loadouts (C-39, `pob-api/API/Sets.lua`)

/** The set types `manage_sets` handles (C-39). */
export const SET_TYPES = ['item', 'skill', 'config', 'loadout'] as const;
export type SetType = (typeof SET_TYPES)[number];
/** Its actions; a loadout takes only `list` and `select`, and there is no delete (R-29). */
export const SET_ACTIONS = ['list', 'create', 'copy', 'rename', 'select'] as const;
export type SetAction = (typeof SET_ACTIONS)[number];

/**
 * One item, skill or config set. An item set adds `useSecondWeaponSet`; a skill set adds `mainGroup`, its
 * group at the build-wide main socket group index (label and active skills), absent when it has none.
 */
export const setEntrySchema = z
  .object({
    id: z.number().int(),
    title: z.string(),
    active: z.boolean(),
    useSecondWeaponSet: z.boolean().optional(),
    mainGroup: z
      .object({ index: z.number().int(), label: optString, skills: luaArray(z.string()) })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type SetEntry = z.infer<typeof setEntrySchema>;

/** One loadout as PoB's synced loadout menu lists it, with the four sets it selects. */
export const loadoutEntrySchema = z
  .object({
    name: z.string(),
    active: z.boolean(),
    specId: z.number().int().optional(),
    itemSetId: z.number().int().optional(),
    skillSetId: z.number().int().optional(),
    configSetId: z.number().int().optional(),
  })
  .passthrough();
export type LoadoutEntry = z.infer<typeof loadoutEntrySchema>;

export const manageSetsReply = baseReply.extend({
  result: z
    .object({
      setType: z.enum(SET_TYPES),
      /** The type's active set id (not for loadouts). */
      activeId: z.number().int().optional(),
      /** The type's sets; `[]` for loadouts. */
      sets: luaArray(setEntrySchema),
      /** Skill sets: the build-wide main socket group index. */
      mainSocketGroup: z.number().int().optional(),
      /** The set the action created, copied to, renamed or selected. */
      targetId: z.number().int().optional(),
      /** Loadouts only. */
      loadouts: luaArray(loadoutEntrySchema).optional(),
      /** A loadout select: the loadout selected. */
      targetName: optString,
    })
    .passthrough(),
});
export type ManageSetsResult = z.infer<typeof manageSetsReply>['result'];

// ---------------------------------------------------------------------------------------------------
// The plan compiler (C-41, `pob-api/API/Compile.lua`)

/**
 * `compile_check`: the read-only preflight. `defects` are `stage <id>: <defect>` lines (and `roll: …` for
 * the class or ascendancy), empty when every stage can be built; `treeVersion` is the tree the compile
 * builds against. WU-42 adds, for V2, `producers` (whether each producer the plan's earned config names
 * exists in the game data, D-221) and `configBaseline` (per config option, what a new config set holds for
 * it, from PoB's option list; no set is created). WU-65 adds `anoints` (D-358), one per stage whose anoint is
 * valid: the notable's PoB name and node, its recipe of three emotions as the tree names them and PoB's item
 * names for them; and `gemTexts` (D-353), the description of each gem `describeGems` names. WU-66 adds
 * `trees` (D-360), each stage's trees for V1's `tree-shape` (`stageTreesSchema`). WU-87 adds `companions` (D-402),
 * one per stage whose companion is valid (`companionCheckSchema`).
 */
/** A config value as the compiler writes and reads it (C-32): no null. */
const compileConfigScalar = z.union([z.boolean(), z.number(), z.string()]);

/** One config option as a new config set holds it (ConfigTab:CreateConfigSet), for V2's default audit. */
export const configOptionDefaultSchema = z
  .object({
    type: z.string(),
    /** Whether the option has an `apply` (BuildModList applies it). */
    apply: z.boolean(),
    /** `defaultState`, or the `defaultIndex` entry's value of a list; absent when nil. */
    default: compileConfigScalar.optional(),
    /** `defaultPlaceholderState`; absent when nil. */
    defaultPlaceholder: compileConfigScalar.optional(),
    /** A list option's first entry value. */
    first: compileConfigScalar.optional(),
    /** Whether PoB shows it only for some builds: it has a show gate (ifSkill, ifCond, …; D-250). */
    conditional: z.boolean(),
  })
  .passthrough();
export type ConfigOptionDefault = z.infer<typeof configOptionDefaultSchema>;

/** D-358: a stage's valid anoint, as `compile_check` resolves it on the tree. */
export const anointSchema = z
  .object({
    stage: z.string(),
    /** The notable's PoB name (`node.dn`), as the compiler writes it after `Allocates `. */
    notable: z.string(),
    node: z.number().int(),
    /** The tree's recipe: three emotions, as the tree names them (`Paranoia`, `Greed`, …). */
    recipe: luaArray(z.string()),
    /** PoB's item name of each recipe emotion (`Liquid Paranoia`, `Diluted Liquid Greed`, …). */
    emotions: luaArray(z.string()),
  })
  .passthrough();
export type AnointResult = z.infer<typeof anointSchema>;

/**
 * D-360: a start a stage's trees may leave, as `compile_check` reads it from the tree. The class start, by its
 * main-tree links (`exits`); or an alternate start of the ascendancy, opened by an ascendancy node with main-tree
 * links (`grantedBy`: Path of the Sorceress, 12795, links the Sorceress start's exits 4739 and 44871), with
 * whether the stage allocates that node (`granted`). `node` is the class start node (absent when an alternate
 * start's exits join none).
 */
export const treeStartSchema = z
  .object({
    node: z.number().int().optional(),
    name: z.string(),
    exits: luaArray(z.number().int()),
    grantedBy: z.number().int().optional(),
    grantedByName: z.string().optional(),
    granted: z.boolean().optional(),
  })
  .passthrough();
export type TreeStart = z.infer<typeof treeStartSchema>;

/**
 * D-360: one stage's trees, computed by `check_tree`. `main` are the components of its listed main-tree nodes,
 * class starts not joining their exits, each with the start exits (of any of `starts`) it holds; `ascendancy`
 * the components of the ascendancy start and the listed ascendancy nodes over ascendancy links, the start's
 * first. Every node list is sorted.
 */
export const stageTreesSchema = z
  .object({
    stage: z.string(),
    starts: luaArray(treeStartSchema),
    main: luaArray(z.object({ nodes: luaArray(z.number().int()), exits: luaArray(z.number().int()) }).passthrough()),
    ascendancy: z
      .object({ start: z.number().int(), name: z.string(), trees: luaArray(z.object({ nodes: luaArray(z.number().int()) }).passthrough()) })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type StageTrees = z.infer<typeof stageTreesSchema>;

/**
 * D-402: a stage's valid companion, as `compile_check` resolves it: the beast of PoB's beast library its species names
 * (its monster id and name), the species' Spirit percentage (`companionReservation`, `Data/Spectres.lua`), and whether
 * PoB parses each of the stage's companion lines whole (`parsed`, in the order sent).
 */
export const companionCheckSchema = z
  .object({
    stage: z.string(),
    species: z.string(),
    id: z.string(),
    name: z.string(),
    companionReservation: z.number(),
    parsed: luaArray(z.boolean()),
  })
  .passthrough();
export type CompanionCheck = z.infer<typeof companionCheckSchema>;

export const compileCheckReply = baseReply.extend({
  result: z
    .object({
      defects: luaArray(z.string()),
      treeVersion: z.string(),
      stageCount: z.number().int(),
      producers: luaArray(z.object({ kind: z.string(), name: z.string(), exists: z.boolean() }).passthrough()),
      configBaseline: luaMap(configOptionDefaultSchema),
      anoints: luaArray(anointSchema),
      gemTexts: luaMap(z.string()),
      trees: luaArray(stageTreesSchema),
      /** D-402: each stage's valid companion; `[]` for none. */
      companions: luaArray(companionCheckSchema),
    })
    .passthrough(),
});
export type CompileCheckResult = z.infer<typeof compileCheckReply>['result'];

/** One allocated node after a stage's import, with its weapon-set tag (0, 1 or 2). */
export const allocatedNodeSchema = z.object({ id: z.number().int(), mode: z.number().int() }).passthrough();

/** One item slot's content: the item's id and name (id 0 and an empty name when the slot is empty). */
export const slotItemSchema = z.object({ id: z.number().int(), name: z.string() }).passthrough();
export type SlotItem = z.infer<typeof slotItemSchema>;

/** The weapon-fit flags of a calculation: what decides whether an off-hand fits (WU-41 review). */
export const weaponFlagsSchema = z
  .object({ giantsBlood: z.boolean(), instrumentsOfPower: z.boolean(), lordOfTheWilds: z.boolean() })
  .passthrough();
export type WeaponFlags = z.infer<typeof weaponFlagsSchema>;

/** One C-45 breakdown entry: the skill, its stat set's label and its finite offense fields. */
export const stageSkillOutputSchema = z
  .object({ skill: z.string(), statSetLabel: z.string(), fields: luaMap(z.number()) })
  .passthrough();

/**
 * `compile_stage`: the stage's tree spec and set ids; PoB's allocation after the import (every allocated
 * node, the class and ascendancy start nodes included and named in `startNodes`); every finite number of
 * the main output; the breakdown keyed `g<group>s<skill>p<statSet>`; the toggles skipped on empty slots;
 * what the stage's item set holds in each requested slot after the measurement (`items`) and what this
 * stage equipped when it created the set (`addedItems`); the stage's weapon-fit flags; the stored
 * values of its listed config options (`configInputs`), whether each keeps its value on a reload when
 * PoB's save leaves it out (`configSurvivesDrop`, D-248), and the V1 and V2 inputs (`checks`, WU-42).
 * `configInputs` also holds `customMods` when the stage writes custom modifiers (D-293). `dotCanStack`
 * (WU-55, D-293): whether the measured main skill's damage over time stacks (PoB's `DotCanStack`), and the
 * same per breakdown key, so the record can apply Count by PoB's rule.
 */
export const stageChecksSchema = z
  .object({
    /** PassiveSpec:CountAllocNodes (ascendancy: multiple-choice options and free nodes excluded). */
    counts: z
      .object({
        used: z.number().int(),
        ascendancy: z.number().int(),
        secondaryAscendancy: z.number().int(),
        sockets: z.number().int(),
        weaponSet1: z.number().int(),
        weaponSet2: z.number().int(),
      })
      .passthrough(),
    extraPoints: z.number(),
    passivePointsToWeaponSetPoints: z.number(),
    /** Str, Dex, Int and ReqStr, ReqDex, ReqInt (0 when PoB sets none). */
    attributes: luaMap(z.number()),
    /** Per attribute, the item or gem its requirement comes from. */
    requirementSources: luaMap(z.object({ source: z.string(), name: z.string() }).passthrough()),
    gems: luaArray(
      z
        .object({
          group: z.number().int(),
          index: z.number().int(),
          name: z.string(),
          level: z.number().int(),
          tier: z.number().int().optional(),
          /** PoB's kind: a support, a gem that reserves Spirit, or another skill (V1 checks by C1's tiers). */
          kind: z.enum(['skill', 'support', 'spirit']),
          levelRequirement: z.number(),
        })
        .passthrough(),
    ),
    items: luaArray(
      z
        .object({
          slot: z.string(),
          name: z.string(),
          title: z.string().optional(),
          baseName: z.string(),
          levelRequirement: z.number(),
          active: z.boolean().optional(),
        })
        .passthrough(),
    ),
    warnings: luaArray(z.string()),
    nodeNames: luaArray(z.string()),
    activeSkills: luaArray(z.string()),
    /** The stage's config set after the writes and the recalculation. */
    config: z.object({ input: luaMap(compileConfigScalar), placeholder: luaMap(compileConfigScalar) }).passthrough(),
    /** The conditional config options PoB shows for the stage (their gates hold, D-250). */
    shownOptions: luaArray(z.string()),
    /**
     * D-380: each group's skill a passive grants: its skill gem (`kind: 'gem'`, "Navira, the Last Mirage" by node
     * 32705) or its `minionSkill` (`kind: 'minionSkill'`, "Navira's Fracturing" by node 10561), by the passives
     * whose line reads `Grants Skill: <name>`, and whether the stage allocates any of them. `group` is 1-based.
     */
    grantedSkills: luaArray(
      z
        .object({
          group: z.number().int(),
          kind: z.enum(['gem', 'minionSkill']),
          name: z.string(),
          nodes: luaArray(z.object({ id: z.number().int(), name: z.string() }).passthrough()),
          allocated: z.boolean(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type StageChecks = z.infer<typeof stageChecksSchema>;

/** D-377: a group's minion selection as `compile_stage` resolved it (BuildOps.select_minion_skill), with its group. */
export const stageMinionSkillSchema = selectedMinionSkillSchema.extend({ group: z.number().int() });
export type StageMinionSkill = z.infer<typeof stageMinionSkillSchema>;

/**
 * D-402: a stage's companion as its measurement left it: the group (the plan's number) and active skill of its
 * companion skill, the beast PoB summoned, the species' Spirit percentage, and PoB's reservation for it: the
 * percentage after the build's reservation modifiers and the Spirit that takes (`SpiritReservedPercent`,
 * `SpiritReservedBase`).
 */
export const stageCompanionSchema = z
  .object({
    group: z.number().int(),
    activeSkill: z.number().int(),
    minion: z.string(),
    minionId: z.string(),
    companionReservation: z.number(),
    reservedSpirit: z.number(),
    reservedSpiritPercent: z.number(),
  })
  .passthrough();
export type StageCompanion = z.infer<typeof stageCompanionSchema>;

/**
 * D-427 (§24.2): an enabled group's active skill whose granted effect has PoB's Travel skill type: the group (the
 * reply's number, the plan's first), the active skill's index in it and its name, for the clear measure's `travel`.
 */
export const stageTravelSkillSchema = z
  .object({ group: z.number().int(), activeSkill: z.number().int(), skill: z.string() })
  .passthrough();
export type StageTravelSkill = z.infer<typeof stageTravelSkillSchema>;

export const compileStageReply = baseReply.extend({
  result: z
    .object({
      id: z.string(),
      ids: z
        .object({
          spec: z.number().int(),
          itemSet: z.number().int(),
          skillSet: z.number().int(),
          configSet: z.number().int(),
        })
        .passthrough(),
      allocation: z
        .object({ nodes: luaArray(allocatedNodeSchema), startNodes: luaArray(z.number().int()) })
        .passthrough(),
      outputs: luaMap(z.number()),
      /** D-426: on a stage that uses weapon set 2, the same map measured with set 2 active; absent otherwise. */
      outputsSet2: luaMap(z.number()).optional(),
      skillOutputs: luaMap(stageSkillOutputSchema),
      /** WU-102 (§24.2): on a stage that uses weapon set 2, every group's breakdown with set 2 active; absent otherwise. */
      skillOutputsSet2: luaMap(stageSkillOutputSchema).optional(),
      /** D-427: each enabled group's active skill with PoB's Travel skill type. */
      travelSkills: luaArray(stageTravelSkillSchema),
      skippedToggles: luaArray(z.string()),
      items: luaMap(slotItemSchema),
      addedItems: luaMap(slotItemSchema),
      weaponFlags: weaponFlagsSchema,
      configInputs: luaMap(z.union([z.boolean(), z.number(), z.string()])),
      configSurvivesDrop: luaMap(z.boolean()),
      dotCanStack: z.object({ main: z.boolean(), skills: luaMap(z.boolean()) }).passthrough(),
      checks: stageChecksSchema,
      /** D-377: the resolved minion selection of each group that names a `minionSkill`, in group order. */
      minionSkills: luaArray(stageMinionSkillSchema),
      /** D-402: the stage's companion, when it names one. */
      companion: stageCompanionSchema.optional(),
    })
    .passthrough(),
});
export type CompileStageResult = z.infer<typeof compileStageReply>['result'];

/**
 * `compile_finish`: the loadouts after `SyncLoadouts`, the one selected, the saved level and mode, and what
 * every item set holds in each requested slot.
 */
export const compileFinishReply = baseReply.extend({
  result: z
    .object({
      loadouts: luaArray(z.string()),
      active: z.string(),
      level: z.number(),
      autoMode: z.boolean(),
      itemSets: luaArray(
        z.object({ id: z.number().int(), title: z.string(), slots: luaMap(slotItemSchema) }).passthrough(),
      ),
    })
    .passthrough(),
});
export type CompileFinishResult = z.infer<typeof compileFinishReply>['result'];

// ---------------------------------------------------------------------------------------------------
// Node power (C-55, `pob-api/API/NodePower.lua`, D-417, D-418)

/** One of PoB's power stats (`data.powerStatList`): its id and label. */
const powerStatSchema = z.object({ id: z.string(), label: z.string() }).passthrough();
/** A node the reply names: its id, name and PoB type; `attribute` for an attribute node ("+5 to any Attribute"). */
const powerNodeSchema = z
  .object({ id: z.number().int(), name: z.string(), type: z.string(), attribute: z.boolean().optional() })
  .passthrough();
/** One figure per requested stat, in `stats` order (PoB's CalculatePowerStat; null for NaN). */
const powerFiguresSchema = luaArray(luaNumber);

/** An unallocated node: its distance and path (allocation order), its gain alone and with its path, per point. */
export const powerBestSchema = powerNodeSchema.extend({
  distance: z.number(),
  path: luaArray(z.number().int()),
  alone: powerFiguresSchema,
  withPath: powerFiguresSchema,
  perPoint: luaNumber,
});
export type PowerBest = z.infer<typeof powerBestSchema>;

/** An allocated branch (the node and its dependants): what removing the node alone, and the branch, takes away. */
export const powerWeakSchema = powerNodeSchema.extend({
  points: z.number().int(),
  branch: luaArray(z.number().int()),
  lossAlone: powerFiguresSchema,
  loss: powerFiguresSchema,
  lossPerPoint: luaNumber,
});
export type PowerWeak = z.infer<typeof powerWeakSchema>;

export const POWER_SWAP_VERDICTS = ['legal', 'illegal', 'no-candidate', 'no-gain', 'over-loss', 'error'] as const;

/**
 * One swap tried on a branch: its verdict and, once measured, its figures; a legal one carries its nodes (net), `used`
 * (the points its new paths take, counted after the branch is removed) and each added attribute node's choice.
 */
export const powerSwapSchema = z
  .object({
    branch: z.number().int(),
    branchName: z.string(),
    freed: z.number().int(),
    verdict: z.enum(POWER_SWAP_VERDICTS),
    reason: optString,
    gain: powerFiguresSchema.optional(),
    gainPercent: powerFiguresSchema.optional(),
    movement: optNumber,
    clear: z.object({ radius: optNumber, usesPerSecond: optNumber }).passthrough().optional(),
    used: z.number().int().optional(),
    removed: luaArray(powerNodeSchema).optional(),
    added: luaArray(powerNodeSchema.extend({ attributeChoice: optString })).optional(),
  })
  .passthrough();
export type PowerSwap = z.infer<typeof powerSwapSchema>;

/**
 * C-55a (D-426): the pool moves of one weapon-set pool with nodes: the set, its node count, the base figures with that
 * set active (what its swaps' percentages are of), the swaps tried within the pool and the best one.
 */
export const powerPoolSchema = z
  .object({
    set: z.union([z.literal(1), z.literal(2)]),
    nodes: z.number().int(),
    base: powerFiguresSchema,
    bestSwap: powerSwapSchema.optional(),
    swaps: luaArray(powerSwapSchema),
  })
  .passthrough();
export type PowerPool = z.infer<typeof powerPoolSchema>;

const powerResultSchema = z
  .object({
    stats: luaArray(powerStatSchema),
    loadout: optString,
    level: z.number(),
    maxDistance: z.number().int(),
    base: powerFiguresSchema,
    movement: optNumber,
    measuredNodes: z.number().int(),
    points: z.number().int(),
    travel: z.number().int(),
    travelNodes: luaArray(z.number().int()).optional(),
    clear: z
      .object({
        group: z.number().int(),
        label: optString,
        radius: optNumber,
        usesPerSecond: optNumber,
        minion: z.boolean().optional(),
        error: optString,
      })
      .passthrough(),
    keepNotAllocated: luaArray(z.number().int()),
    /** Protected main-tree nodes by reason: keep, grants a skill, weapon set, later rung. */
    protected: luaMap(z.number().int()),
    /** Branches left out because removing them would disconnect a node outside them (in this tree or a protect_for one). */
    heldBranches: z.number().int().optional(),
    best: luaArray(powerBestSchema),
    weakest: luaArray(powerWeakSchema),
    bestSwap: powerSwapSchema.optional(),
    swaps: luaArray(powerSwapSchema),
    /** C-55a (D-426): the pool moves, one entry per weapon-set pool with nodes, set 1 first; empty without any. */
    poolSwaps: luaArray(powerPoolSchema).optional(),
    /** C-55a: the CPU seconds the pool moves' searches took, within `cpuSeconds`. */
    poolCpuSeconds: z.number().optional(),
    failures: luaArray(z.object({ id: z.number().int(), name: z.string(), error: z.string() }).passthrough()),
    calculations: z.number().int(),
    cpuSeconds: z.number(),
  })
  .passthrough();
export type NodePowerResult = z.infer<typeof powerResultSchema>;

/** `get_passive_upgrades`' candidates: every unallocated main-tree node of the pass, with its path's raw fields. */
const powerUpgradesResultSchema = z
  .object({
    maxDistance: z.number().int(),
    base: luaMap(luaNumber),
    candidates: luaArray(
      powerNodeSchema.extend({
        distance: z.number(),
        path: luaArray(z.number().int()),
        stats: luaArray(z.string()),
        fields: luaMap(luaNumber).optional(),
        error: optString,
      }),
    ),
    calculations: z.number().int(),
    cpuSeconds: z.number(),
  })
  .passthrough();
export type NodePowerUpgradesResult = z.infer<typeof powerUpgradesResultSchema>;

/** `node_power`: a power reply, or with `upgrades` the candidates (C-55, D-417). */
export const nodePowerReply = baseReply.extend({ result: z.union([powerResultSchema, powerUpgradesResultSchema]) });

/** `node_power` params (C-55): the stats by PoB's id or label; `maxLoss` a percentage or a map by stat or guard. */
export interface NodePowerParams {
  stats: string[];
  maxDistance?: number;
  loadout?: string;
  level?: number;
  keep?: number[];
  protectFor?: string[];
  clearGroup?: number;
  maxLoss?: number | Record<string, number>;
  limit?: number;
}

/** `node_power` with `upgrades`: `get_passive_upgrades`' candidates and the raw output fields of each path. */
export interface NodePowerUpgradesParams {
  upgrades: { fields: string[] };
  maxDistance?: number;
}

/** What `compile_check` reads of one stage (the plan's own shapes, C-31). */
export interface CompileCheckStage {
  id: string;
  /** Allocated non-ascendancy nodes (the class start excluded). */
  nodes: number[];
  /** Allocated ascendancy nodes (the ascendancy start excluded). */
  ascendancyNodes: number[];
  weaponSets: { set1: number[]; set2: number[] };
  attributeChoices: Array<{ node: number; attribute: AttributeChoice }>;
  jewels: Array<{ node: number; text: string }>;
  items: Array<{ slot: string; text: string }>;
  /**
   * D-377: a group's `minionSkill` and `minionStatSet`, checked against its summon's minion in the game data; a
   * gem's `enabled` (default true) says whether PoB builds its skills.
   */
  groups: Array<{ gems: Array<{ name: string; enabled?: boolean }>; minionSkill?: string; minionStatSet?: number }>;
  main: { group: number; activeSkill: number; statSet?: number };
  config: Array<{ option: string; value: boolean | number | string }>;
  /** D-293: the stage's custom modifier lines; one PoB can't parse whole is a defect (it would add nothing). */
  customMods: string[];
  /** D-358: the notable the stage's amulet is anointed with (`items.anoint.notable`). */
  anoint?: string;
  /**
   * D-402: the stage's companion: its species, the custom modifier lines its kept `stats` modifiers write (whether PoB
   * parses each comes back in `companions`), and whether each group is enabled (the Tame Beast gem's must be).
   */
  companion?: { species: string; lines: string[]; groupsEnabled: boolean[] };
}

/** A stage's item, skill or config set: `reuse` selects the set an earlier stage created. */
export interface StageSetRef {
  title: string;
  reuse?: number;
}

/** What `compile_stage` builds (C-41 step 7). */
export interface CompileStageParams {
  id: string;
  /** Stage 1: retitle tree spec 1 and set 1 of each type instead of creating them (D-215). */
  first: boolean;
  /** The loadout name: the tree spec's title. */
  title: string;
  level: number;
  nodes: number[];
  ascendancyNodes: number[];
  weaponSets: { set1: number[]; set2: number[] };
  attributeChoices: Array<{ node: number; attribute: AttributeChoice }>;
  jewels: Array<{ node: number; text: string }>;
  itemSet: StageSetRef;
  items: Array<{ slot: string; text: string }>;
  toggles: Array<{ slot: string; active: boolean }>;
  useSecondWeaponSet: boolean;
  skillSet: StageSetRef;
  groups: Array<{
    label?: string;
    enabled: boolean;
    /** D-293, D-337: in PoB's Full DPS; the compiler sets it on the named source's group only. */
    includeInFullDPS: boolean;
    /** D-293: the group's Count (`groupCount`), set on the named source's group only. */
    groupCount?: number;
    gems: Array<{ name: string; level: number; quality: number; enabled: boolean }>;
    /** D-377: the skill the group's summon's minion uses, selected by name after the stage's groups are built. */
    minionSkill?: string;
    /** D-377: that minion skill's stat set (default 1). */
    minionStatSet?: number;
    /** D-426 (§24.2): the weapon set the group is on, socketed in that set's slot; absent, both sets. */
    weaponSet?: number;
  }>;
  main: { group: number; activeSkill: number; statSet?: number };
  configSet: StageSetRef;
  /** Every listed option, earned and scenario: option → value. */
  config: Record<string, boolean | number | string>;
  /** D-293: the custom modifier lines, written into PoB's `customMods` option after `config`, one line each. */
  customMods: string[];
  /** The C-45 fields measured per active skill and stat set. */
  offenseFields: string[];
  /** The slots whose content the reply reports (`ITEM_SLOTS`). */
  itemSlots: string[];
  /** D-358: the notable written on the amulet as `{enchant}Allocates <notable>`: its PoB name, from `compile_check`. */
  anoint?: string;
  /** D-402: the stage's companion: the monster id `compile_check` resolved its species to. */
  companion?: { id: string };
  /** Test actions only (POB_API_TEST_ACTIONS=1): the engine exits during this stage (AC-P35). */
  __crashForTest?: boolean;
}

/** What `compile_finish` checks and selects. */
export interface CompileFinishParams {
  stages: Array<{ id: string; title: string; ids: CompileStageResult['ids'] }>;
  /** The loadout to select: the highest-level stage's (the last among ties, A-P9). */
  active: string;
  /** The saved level, in auto-level mode (D-138, D-149). */
  level: number;
  /** The slots whose content the reply reports for every item set (`ITEM_SLOTS`). */
  itemSlots: string[];
}

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
  load_build_xml: loadBuildXmlReply,
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
  get_rule_breaks: getRuleBreaksReply,
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
  manage_sets: manageSetsReply,
  compile_check: compileCheckReply,
  compile_stage: compileStageReply,
  compile_finish: compileFinishReply,
  node_power: nodePowerReply,
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
  /**
   * `minionSkill`: the name of the skill the group's summon's minion uses, and `minionStatSet` (default 1)
   * that skill's stat set; the summon becomes the main active skill (D-377). `minionStatSet` needs
   * `minionSkill`.
   */
  set_main_selection: {
    mainSocketGroup?: number;
    mainActiveSkill?: number;
    statSet?: number;
    minionSkill?: string;
    minionStatSet?: number;
  };
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
  /** `autoMode`: also turn on PoB's auto-level mode (D-196); without it the level is manual. */
  set_level: { level: number; autoMode?: boolean };
  /** `slot` is "Flask 1"–"Flask 2" or "Charm 1"–"Charm 3"; `index` alone means "Flask <index>". */
  set_flask_active: { slot?: string; index?: number; active: boolean };
  get_build_info: NoParams;
  get_warnings: NoParams;
  get_rule_breaks: NoParams;
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
  create_socket_group: { label?: string; slot?: string; enabled?: boolean; includeInFullDPS?: boolean; groupCount?: number };
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
  /** C-56 (D-427): `skillType`, a PoB skill type by name (case ignored), keeps the gems whose granted effect has it. */
  list_gems: { type?: 'active' | 'support'; search?: string; tag?: string; skillType?: string; maxResults?: number; dedupeByName?: boolean };
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
   * C-37: `query` is required for gem, mechanic and config modes; unique mode needs `query`, `slot` or both; base
   * mode needs `slot` (C-37b); `kind` (mechanic mode, D-240; `essence`, WU-60; `base`, WU-53; `constant`, C-37d)
   * keeps one kind of hit. A mechanic query may hold gaps, `…` or `...` (WU-53).
   */
  lookup_game_data: {
    mode: 'gem' | 'unique' | 'mechanic' | 'base' | 'config';
    query?: string;
    level?: number;
    quality?: number;
    slot?: string;
    kind?: 'gem' | 'unique' | 'passive' | 'mod' | 'essence' | 'base' | 'constant';
    /** C-37b: base mode keeps the bases whose required level is at most this. */
    maxLevel?: number;
    maxResults?: number;
  };
  /**
   * C-38: one or more of `itemText`, `nodes` (ids or exact names) and `gems` (names), or `build: true`
   * alone; `sourceNames` (required) is the server's name scan of PoB's source (D-226), `sourceTemplates`
   * its concatenation templates (D-243), `sourceCallNames` its skill-data mod-list read literals (D-336).
   */
  check_coverage: {
    itemText?: string;
    nodes?: Array<string | number>;
    gems?: string[];
    build?: boolean;
    sourceNames: string[];
    sourceTemplates?: string[];
    /** WU-54 (D-336): the string literals of mod-list reads in `Data/Skills/`, for `mapped but unread` only. */
    sourceCallNames?: string[];
    /** WU-54 (D-336): the templates of mod-list reads built from a skill's name, for `mapped but unread` only. */
    sourceSkillTemplates?: string[];
  };
  /**
   * C-39: `id` is the source for `copy` and the target for `rename` and `select`; `title` is the new title,
   * or the loadout name of a loadout `select`; `useSecondWeaponSet` (item sets) is written on the targeted set.
   */
  manage_sets: {
    setType: SetType;
    action: SetAction;
    id?: number;
    title?: string;
    useSecondWeaponSet?: boolean;
  };
  /**
   * C-41 step 5: the read-only preflight of every stage; changes nothing. `producers`: the earned config's
   * producers, each looked up in the game data (D-221, WU-42). Each stage's `anoint` is checked and resolved
   * (D-358); `describeGems` asks for gem descriptions (D-353).
   */
  compile_check: {
    className: string;
    ascendancy: string;
    stages: CompileCheckStage[];
    producers?: Array<{ kind: string; name: string }>;
    /** D-353 (WU-65): the gems whose description the reply gives in `gemTexts`. */
    describeGems?: string[];
  };
  /** C-41 step 7: build and measure one stage. */
  compile_stage: CompileStageParams;
  /** C-41 step 8: the loadout check, the highest stage's loadout and the auto-mode level. */
  compile_finish: CompileFinishParams;
  /** C-55: node power on a loadout, with the best swap; or with `upgrades`, get_passive_upgrades' candidates. */
  node_power: NodePowerParams | NodePowerUpgradesParams;
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
