/**
 * Tool Routing Module
 *
 * Routes MCP tool calls to their corresponding handlers with proper context.
 */

import type { ContextBuilder } from "../utils/contextBuilder.js";
import type { TradeApiClient } from "../trade/tradeClient.js";
import type { StatMapper } from "../services/statMapper.js";
import type { CurrencyService } from "../trade/currency.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_META, isToolAvailable } from "./toolMeta.js";
import { errorResponse, type ToolResponse } from "./responseUtils.js";
import { noticesOf, EngineBusyError, EngineDeadlineError, type EngineSession, type EngineKind } from "../engine/session.js";
import { engineBusyStopText, engineDeadlineStopText } from "../trade/findUpgrades.js";

// Import handlers
import { handleListBuilds, handleAnalyzeBuild, handleCompareBuilds, handleGetBuildStats, handleGetBuildNotes, handleSetBuildNotes } from "../handlers/buildHandlers.js";
import { handleStartWatching, handleStopWatching, handleGetRecentChanges, handleWatchStatus } from "../handlers/watchHandlers.js";
import { handleCompareTrees, handleGetNearbyNodes, handleFindPath, handleGetPassiveUpgrades } from "../handlers/treeHandlers.js";
import { handleGetBuildIssues, formatIssuesResponse } from "../handlers/buildGoalsHandlers.js";
import { handleLuaStart, handleLuaStop, handleLuaNewBuild, handleLuaSaveBuild, handleLuaLoadBuild, handleLuaGetStats, handleLuaGetTree, handleLuaSetTree, handleSearchTreeNodes, handleListGems, handleGetClasses, handleLuaGetBuildInfo, handleLuaReloadBuild, handleUpdateTreeDelta, handleCreateSpec, handleListSpecs, handleSelectSpec, handleDeleteSpec, handleRenameSpec, handleListItemSets, handleSelectItemSet } from "../handlers/luaHandlers.js";
import { handleAnalyzeSkillsPoe2, handleSuggestSupportsPoe2 } from "../handlers/poe2SkillHandlers.js";
import { handleLookupGameData } from "../handlers/lookupHandlers.js";
import { handleImportBuild } from "../handlers/luaHandlers.js";
import { handleAddItem, handleGetEquippedItems, handleToggleFlask, handleGetSkillSetup, handleSetMainSkill, handleCreateSocketGroup, handleAddGem, handleSetGemLevel, handleSetGemQuality, handleSetGemCorruption, handleRemoveSkill, handleRemoveGem, handleSetupSkillWithGems, handleAddMultipleItems, handleSetSocketGroupEnabled, handleSetGemEnabled } from "../handlers/itemSkillHandlers.js";
import { handleAnalyzeDefenses } from "../handlers/optimizationHandlers.js";
import { handleGetConfig, handleSetConfig, handleSetEnemyStats, handleSaveConfigPreset, handleLoadConfigPreset, handleListConfigPresets } from "../handlers/configHandlers.js";
import { handleValidateBuild } from "../handlers/validationHandlers.js";
import { handleExportBuild, handleSnapshotBuild, handleListSnapshots, handleRestoreSnapshot, handleExportBuildSummary } from "../handlers/exportHandlers.js";
import { handleSearchTradeItems, handleGetItemPrice, handleGetLeagues, handleSearchStats, handleTradeQueryOptions, handleFindUpgrades, type SearchTradeItemsArgs, type TradeContext } from "../handlers/tradeHandlers.js";
import type { Credentials } from "../trade/credentials.js";
import { handleGetCurrencyRates } from "../handlers/poeNinjaHandlers.js";
import { handlePlanLeveling } from "../handlers/levelingHandlers.js";

export interface ToolRouterDependencies {
  contextBuilder: ContextBuilder;
  tradeClient: TradeApiClient;
  statMapper: StatMapper;
  /** C-12: poe.ninja currency rates (per-league cache). */
  currency: CurrencyService;
  /** The engine session (C-3): every tool whose `TOOL_META.engine` isn't `none` runs inside it. */
  session: EngineSession;
  /** Session-scoped (C-3 step 5): the running call's `ctx.client`; throws outside a session. */
  getLuaClient: () => import("../pobLuaBridge.js").PoBLuaApiClient | null;
  /** Session-scoped: resolves inside a session (which started the engine); throws outside one. */
  ensureLuaClient: () => Promise<void>;
  /** The env (deps.env, C-7): decides which tool groups are routable (C-1). */
  env: Readonly<Record<string, string | undefined>>;
  /** Lazily loads trade2 stat data before the first trade tool call (D-14). */
  ensureTradeStats: () => Promise<void>;
  /** The default league (D-20): `POE_LEAGUE`, else the first current league on trade2. */
  resolveLeague: () => Promise<string>;
  /** C-9: the trade session cookie, re-read on every call (`find_upgrades` decides its fallback on it). */
  credentials: () => Credentials;
  /** The wall clock (epoch ms) that dates price results (C-49); default `Date.now`. */
  wallClock?: () => number;
}

/**
 * The per-call context the CallTool handler builds from the MCP request `extra` (C-1).
 * `sendProgress` is a no-op when the request carried no `progressToken`.
 */
export interface ToolCallContext {
  signal: AbortSignal;
  progressToken?: string | number;
  sendProgress(progress: number, message?: string): Promise<void>;
  /** Epoch ms when the call arrived (deadlines run from here, D-22), on the `now` clock. */
  arrivedAt: number;
  /** The clock `arrivedAt` is on (the server's monotonic clock); default `Date.now`. */
  now?: () => number;
}

/** `find_upgrades`' budget from the call's arrival, lock wait included (D-22). */
export const FIND_UPGRADES_BUDGET_MS = 90_000;

/** A handler's own `isError` result: a failed call for the session (no revision bump, no snapshot). */
class ToolResultError extends Error {
  constructor(readonly result: HandlerResult) {
    super(result.content.map((c) => c.text).join("\n"));
  }
}

/** Text content only (D-36): normalize a handler result to the single response type. */
function normalize(result: HandlerResult): ToolResponse {
  return {
    content: result.content.map((c) => ({ type: "text" as const, text: c.text })),
    ...(result.isError ? { isError: true } : {}),
  };
}

/** The text `withNotices` puts in front of a result: the notices, one per line, then a blank line. */
function noticeHead(notices: string[]): string {
  return notices.length === 0 ? "" : `${notices.join("\n")}\n\n`;
}

/**
 * A result whose text has a size budget (`find_upgrades`, D-53) is rendered again with the notices'
 * room reserved, so the notices `withNotices` adds don't push it over the budget.
 */
function fitNotices(result: HandlerResult, notices: string[]): HandlerResult {
  if (notices.length === 0 || !result.refit || result.isError) return result;
  return { content: [{ type: "text", text: result.refit(noticeHead(notices).length) }] };
}

/** C-3 step 8: notices go first, one per line, then a blank line; also on `isError` results. */
function withNotices(response: ToolResponse, notices: string[]): ToolResponse {
  if (notices.length === 0) return response;
  const head = notices.join("\n");
  const [first, ...rest] = response.content;
  const content = first
    ? [{ type: "text" as const, text: `${head}\n\n${first.text}` }, ...rest]
    : [{ type: "text" as const, text: head }];
  return { ...response, content };
}

/**
 * Tools that do not need trade2 stat data before they run. `find_upgrades` loads stats itself, inside
 * its deadline and only after its no-session check (D-49: no request before a no-session fallback).
 */
const TRADE_TOOLS_WITHOUT_STATS = new Set(["get_leagues", "trade_query_options", "find_upgrades"]);

/**
 * What handlers return: text content, possibly typed loosely by older handlers. `refit` (a budgeted
 * output) renders the text again with `reservedChars` of room left for the session's notices.
 */
type HandlerResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
  refit?: (reservedChars: number) => string;
};

function unknownTool(name: string): McpError {
  return new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
}

/**
 * Routes a tool call to its handler (C-1).
 *
 * - A tool without `TOOL_META`, or whose group is disabled, is a protocol error:
 *   `McpError(InvalidParams, "Unknown tool: <name>")`.
 * - Every error a handler throws becomes an `isError: true` result with the message as text; the
 *   stack goes to stderr (D-27).
 * - `find_upgrades` alone has a deadline on its lock wait (D-22); when it passes there, the
 *   `EngineBusyError` is C-14's engine-busy early stop, a result rather than an error. When it passes
 *   during the session's engine start, restore or disk-change reload (`EngineDeadlineError`), it is
 *   C-14's budget stop before the query exists, an error (D-75).
 */
export async function routeToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
  deps: ToolRouterDependencies,
  call: ToolCallContext,
): Promise<ToolResponse> {
  if (!isToolAvailable(name, deps.env)) throw unknownTool(name);
  const kind = TOOL_META[name].engine;
  try {
    if (TOOL_META[name].group === "trade" && !TRADE_TOOLS_WITHOUT_STATS.has(name)) {
      await deps.ensureTradeStats();
    }
    if (kind === "none") return normalize(await dispatch(name, args, deps, call));

    // Engine tools run inside the session, wrapped by their C-8 kind (C-3).
    const { value, notices } = await deps.session.run(
      {
        tool: name,
        kind: kind as EngineKind,
        signal: call.signal,
        ...(name === "find_upgrades" ? { deadline: call.arrivedAt + FIND_UPGRADES_BUDGET_MS } : {}),
      },
      async () => {
        const result = await dispatch(name, args, deps, call);
        if (result.isError) throw new ToolResultError(result);
        return result;
      },
    );
    return withNotices(normalize(fitNotices(value, notices)), notices);
  } catch (error) {
    if (error instanceof McpError) throw error;
    const notices = noticesOf(error);
    if (error instanceof ToolResultError) return withNotices(normalize(error.result), notices);
    if (name === "find_upgrades" && error instanceof EngineBusyError) {
      console.error(`[Tool] tool=${name} stopped early: ${error.message}`);
      return withNotices({ content: [{ type: "text", text: engineBusyStopText(args?.slot) }] }, notices);
    }
    if (name === "find_upgrades" && error instanceof EngineDeadlineError) {
      // The deadline arrived during the session's own steps 2–4, before the query existed: no link can
      // be built, so it is an error (D-75), worded as C-14's budget stop.
      console.error(`[Tool] tool=${name} stopped early: ${error.message}`);
      return withNotices(errorResponse(`Error: ${engineDeadlineStopText(error.step)}`), notices);
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Tool Error] tool=${name} error=${errorMsg}`);
    if (error instanceof Error && error.stack) console.error(`[Tool Stack] ${error.stack}`);
    return withNotices(errorResponse(`Error: ${errorMsg}`), notices);
  }
}

/** The trade handlers' context. */
function tradeContext(deps: ToolRouterDependencies): TradeContext {
  return {
    tradeClient: deps.tradeClient,
    statMapper: deps.statMapper,
    currency: deps.currency,
    resolveLeague: deps.resolveLeague,
    ...(deps.wallClock ? { now: deps.wallClock } : {}),
  };
}

async function dispatch(
  name: string,
  args: Record<string, unknown> | undefined,
  deps: ToolRouterDependencies,
  call: ToolCallContext,
): Promise<HandlerResult> {
  // Create handler contexts using contextBuilder
  const handlerContext = deps.contextBuilder.buildHandlerContext();
  const watchContext = deps.contextBuilder.buildWatchContext();
  const treeContext = deps.contextBuilder.buildTreeContext();
  const luaContext = deps.contextBuilder.buildLuaContext();
  const itemSkillContext = deps.contextBuilder.buildItemSkillContext();
  const optimizationContext = deps.contextBuilder.buildOptimizationContext();
  const exportContext = deps.contextBuilder.buildExportContext();

  switch (name) {
    case "list_builds":
      return await handleListBuilds(handlerContext);

    case "analyze_build":
      if (!args) throw new Error("Missing arguments");
      return await handleAnalyzeBuild(handlerContext, args.build_name as string);

    case "compare_builds":
      if (!args) throw new Error("Missing arguments");
      return await handleCompareBuilds(
        handlerContext,
        args.build1 as string,
        args.build2 as string
      );

    case "get_build_stats":
      if (!args) throw new Error("Missing arguments");
      return await handleGetBuildStats(handlerContext, args.build_name as string);

    case "start_watching":
      return handleStartWatching(watchContext);

    case "stop_watching":
      return await handleStopWatching(watchContext);

    case "get_recent_changes":
      return handleGetRecentChanges(watchContext, args?.limit as number | undefined);

    case "watch_status":
      return handleWatchStatus(watchContext);

    // Phase 3 tools
    case "compare_trees":
      if (!args) throw new Error("Missing arguments");
      return await handleCompareTrees(
        treeContext,
        args.build1 as string,
        args.build2 as string
      );

    case "get_nearby_nodes":
      return await handleGetNearbyNodes(
        treeContext,
        args?.build_name as string | undefined,
        args?.max_distance as number | undefined,
        args?.filter as string | undefined
      );

    case "find_path_to_node":
      if (!args) throw new Error("Missing arguments");
      return await handleFindPath(
        treeContext,
        args.build_name as string,
        args.target_node_id as string,
        args.show_alternatives as boolean | undefined
      );

    // Lua bridge tools
    case "lua_start":
      return await handleLuaStart(luaContext);

    case "lua_stop":
      return await handleLuaStop(luaContext);

    case "lua_new_build":
      return await handleLuaNewBuild(luaContext, args?.class_name as string | undefined, args?.ascendancy as string | undefined);

    case "lua_save_build":
      if (!args) throw new Error("Missing arguments");
      return await handleLuaSaveBuild(luaContext, args.build_name as string, args.overwrite === true);

    case "lua_load_build":
      if (!args) throw new Error("Missing arguments");
      return await handleLuaLoadBuild(
        luaContext,
        args.build_name as string | undefined,
        args.build_xml as string | undefined,
        args.name as string | undefined
      );

    case "set_character_level": {
      if (!args) throw new Error("Missing arguments");
      const level = args.level as number;
      if (!level || level < 1 || level > 100) throw new Error("level must be between 1 and 100");
      const luaClient = deps.getLuaClient();
      if (!luaClient) throw new Error("Lua bridge not active. Use lua_start first.");
      await luaClient.setLevel(level);
      const stats = await luaClient.getStats(['Life', 'EnergyShield', 'Mana', 'ManaUnreserved']);
      return {
        content: [{
          type: "text" as const,
          text: `✅ Character level set to ${level}.\n\nUpdated stats:\n  Life: ${stats.Life ?? '-'}  |  ES: ${stats.EnergyShield ?? '-'}  |  Mana: ${stats.Mana ?? '-'}  |  Mana Unreserved: ${stats.ManaUnreserved ?? '-'}`,
        }],
      };
    }

    case "lua_get_stats":
      return await handleLuaGetStats(luaContext, args?.category as string | undefined, {
        breakdown: args?.breakdown,
        groupIndex: args?.group_index,
      });

    case "lua_get_tree":
      return await handleLuaGetTree(luaContext, args?.include_node_ids as boolean | undefined);

    case "lua_get_build_info":
      return await handleLuaGetBuildInfo(luaContext);

    case "lua_reload_build":
      return await handleLuaReloadBuild(luaContext, args?.build_name as string | undefined);

    case "update_tree_delta":
      if (!args) throw new Error("Missing arguments");
      return await handleUpdateTreeDelta(
        luaContext,
        args.add_nodes as string[] | undefined,
        args.remove_nodes as string[] | undefined
      );

    case "create_spec":
      return await handleCreateSpec(
        luaContext,
        args?.title as string | undefined,
        args?.copyFrom as number | undefined,
        args?.activate as boolean | undefined
      );

    case "list_specs":
      return await handleListSpecs(luaContext);

    case "select_spec":
      if (args?.index == null) throw new Error("Missing index");
      return await handleSelectSpec(luaContext, args.index as number);

    case "delete_spec":
      if (args?.index == null) throw new Error("Missing index");
      return await handleDeleteSpec(luaContext, args.index as number);

    case "rename_spec":
      if (!args?.index || !args?.title) throw new Error("Missing index or title");
      return await handleRenameSpec(luaContext, args.index as number, args.title as string);

    case "list_item_sets":
      return await handleListItemSets(luaContext);

    case "select_item_set":
      if (args?.id == null) throw new Error("Missing id");
      return await handleSelectItemSet(luaContext, args.id as number);

    // Phase 9: Configuration Tools
    case "get_config":
      const getConfigContext = {
        getLuaClient: deps.getLuaClient,
        ensureLuaClient: deps.ensureLuaClient,
      };
      return await handleGetConfig(getConfigContext);

    case "set_config":
      if (!args) throw new Error("Missing arguments");
      const setConfigContext = {
        getLuaClient: deps.getLuaClient,
        ensureLuaClient: deps.ensureLuaClient,
      };
      return await handleSetConfig(setConfigContext, {
        config_name: args.config_name as string,
        value: args.value as boolean | number | string,
      });

    case "set_enemy_stats":
      const setEnemyContext = {
        getLuaClient: deps.getLuaClient,
        ensureLuaClient: deps.ensureLuaClient,
      };
      return await handleSetEnemyStats(setEnemyContext, {
        level: args?.level as number | undefined,
        fire_resist: args?.fire_resist as number | undefined,
        cold_resist: args?.cold_resist as number | undefined,
        lightning_resist: args?.lightning_resist as number | undefined,
        chaos_resist: args?.chaos_resist as number | undefined,
        armor: args?.armor as number | undefined,
        evasion: args?.evasion as number | undefined,
      });

    case "save_config_preset":
      if (!args?.name) throw new Error("Missing preset name");
      return await handleSaveConfigPreset(deps.contextBuilder.buildConfigPresetContext(), args.name as string);

    case "load_config_preset":
      if (!args?.name) throw new Error("Missing preset name");
      return await handleLoadConfigPreset(deps.contextBuilder.buildConfigPresetContext(), args.name as string);

    case "list_config_presets":
      return await handleListConfigPresets(deps.contextBuilder.buildConfigPresetContext());

    case "lua_set_tree":
      if (!args) throw new Error("Missing arguments");
      return await handleLuaSetTree(luaContext, args);

    case "search_tree_nodes": {
      if (!args) throw new Error("Missing arguments");
      // Support both 'query' (schema name) and 'keyword' (legacy name). C-43: 'query' is optional when
      // 'ascendancy' is given; with neither, the call fails.
      const searchQuery = (args.query ?? args.keyword ?? args.q) as string | undefined;
      const hasQuery = searchQuery != null && String(searchQuery).trim().length > 0;
      const ascendancy = args.ascendancy == null ? undefined : String(args.ascendancy).trim();
      if (!hasQuery && !ascendancy) {
        throw new Error(`search_tree_nodes requires a 'query' or an 'ascendancy' parameter (received args: ${JSON.stringify(Object.keys(args))})`);
      }
      return await handleSearchTreeNodes(
        luaContext,
        hasQuery ? String(searchQuery).trim() : undefined,
        args.node_type as string | undefined,
        (args.limit || args.max_results) as number | undefined,
        args.include_allocated as boolean | undefined,
        ascendancy || undefined,
      );
    }

    case "get_classes":
      return await handleGetClasses(luaContext);

    case "import_build":
      if (!args) throw new Error("Missing arguments");
      return await handleImportBuild(
        luaContext,
        args.source as string,
        (args.save_as ?? args.saveAs) as string | undefined,
        args.overwrite === true,
      );

    case "analyze_skills":
      return await handleAnalyzeSkillsPoe2(luaContext);

    case "suggest_supports":
      return await handleSuggestSupportsPoe2(
        luaContext,
        (args?.group_index ?? args?.groupIndex) as number,
        (args?.count) as number | undefined
      );

    case "list_gems":
      return await handleListGems(luaContext, {
        type: args?.type as ("active" | "support" | undefined),
        search: args?.search as string | undefined,
        tag: args?.tag as string | undefined,
        maxResults: (args?.max_results ?? args?.maxResults) as number | undefined,
        dedupeByName: (args?.dedupe_by_name ?? args?.dedupeByName) as boolean | undefined,
      });

    case "lookup_game_data":
      return await handleLookupGameData(luaContext, {
        mode: args?.mode,
        query: args?.query,
        gemLevel: args?.gem_level,
        gemQuality: args?.gem_quality,
        slot: args?.slot,
        kind: args?.kind,
        maxResults: args?.max_results,
      });

    // Phase 4: Item & Skill tools
    case "add_item":
      if (!args) throw new Error("Missing arguments");
      return await handleAddItem(itemSkillContext, args.item_text as string, args.slot_name as string | undefined, args.no_auto_equip as boolean | undefined);

    case "get_equipped_items":
      return await handleGetEquippedItems(itemSkillContext);

    case "toggle_flask":
      if (!args) throw new Error("Missing arguments");
      return await handleToggleFlask(itemSkillContext, args.slot as string, args.active as boolean);

    case "get_skill_setup":
      return await handleGetSkillSetup(itemSkillContext, args?.main_only !== false);

    case "set_main_skill":
      if (!args) throw new Error("Missing arguments");
      return await handleSetMainSkill(itemSkillContext, args.group_index as number, (args.active_skill_index ?? args.gem_index) as number | undefined, args.skill_part as number | undefined);

    case "create_socket_group":
      return await handleCreateSocketGroup(itemSkillContext, args?.label as string | undefined, args?.slot as string | undefined, args?.enabled as boolean | undefined, args?.include_in_full_dps as boolean | undefined);

    case "add_gem":
      if (!args) throw new Error("Missing arguments");
      return await handleAddGem(itemSkillContext, args.group_index as number, args.gem_name as string, args.level as number | undefined, args.quality as number | undefined, (args.quality_type ?? args.quality_id) as string | undefined, args.enabled as boolean | undefined);

    case "set_gem_level":
      if (!args) throw new Error("Missing arguments");
      return await handleSetGemLevel(itemSkillContext, args.group_index as number, args.gem_index as number, args.level as number);

    case "set_gem_quality":
      if (!args) throw new Error("Missing arguments");
      return await handleSetGemQuality(itemSkillContext, args.group_index as number, args.gem_index as number, args.quality as number, (args.quality_type ?? args.quality_id) as string | undefined);

    case "set_gem_corruption":
      if (!args) throw new Error("Missing arguments");
      return await handleSetGemCorruption(itemSkillContext, args.state as string, args.group_index as number | undefined, args.gem_index as number | undefined);

    case "remove_skill":
      if (!args) throw new Error("Missing arguments");
      return await handleRemoveSkill(itemSkillContext, args.group_index as number);

    case "remove_gem":
      if (!args) throw new Error("Missing arguments");
      return await handleRemoveGem(itemSkillContext, args.group_index as number, args.gem_index as number);

    case "toggle_socket_group":
      if (!args) throw new Error("Missing arguments");
      return await handleSetSocketGroupEnabled(itemSkillContext, args.group_index as number, args.enabled as boolean);

    case "toggle_gem":
      if (!args) throw new Error("Missing arguments");
      return await handleSetGemEnabled(itemSkillContext, args.group_index as number, args.gem_index as number, args.enabled as boolean);

    case "setup_skill_with_gems": {
      if (!args) throw new Error("Missing arguments");
      // Schema exposes active_gem (string) + support_gems (string[]), build the gems array here
      const activeGemName = args.active_gem as string | undefined;
      const supportGemNames = args.support_gems as string[] | undefined;
      if (!activeGemName) throw new Error("active_gem is required");
      const gemsArray: Array<{name: string}> = [
        { name: activeGemName },
        ...(supportGemNames || []).map((n: string) => ({ name: n })),
      ];
      return await handleSetupSkillWithGems(
        itemSkillContext,
        gemsArray,
        args.label as string | undefined,
        args.slot as string | undefined,
        args.enabled as boolean | undefined,
        args.include_in_full_dps as boolean | undefined
      );
    }

    case "add_multiple_items":
      if (!args) throw new Error("Missing arguments");
      return await handleAddMultipleItems(
        itemSkillContext,
        args.items as Array<{item_text: string; slot_name?: string}>
      );

    // Phase 6: Build Optimization tools
    case "analyze_defenses":
      return await handleAnalyzeDefenses(optimizationContext, args?.build_name as string | undefined);

    // Phase 7: Build Validation
    case "validate_build":
      const validationContext = deps.contextBuilder.buildValidationContext();
      return await handleValidateBuild(validationContext, {
        build_name: args?.build_name as string | undefined,
      });

    // Phase 8: Export and Persistence Tools
    case "export_build":
      if (!args) throw new Error("Missing arguments");
      return await handleExportBuild(exportContext, {
        build_name: args.build_name as string,
        output_name: args.output_name as string,
        output_directory: args.output_directory as string | undefined,
        overwrite: args.overwrite as boolean | undefined,
        notes: args.notes as string | undefined,
      });

    case "snapshot_build":
      if (!args) throw new Error("Missing arguments");
      return await handleSnapshotBuild(exportContext, {
        build_name: args.build_name as string,
        description: args.description as string | undefined,
        tag: args.tag as string | undefined,
      });

    case "list_snapshots":
      if (!args) throw new Error("Missing arguments");
      return await handleListSnapshots(exportContext, {
        build_name: args.build_name as string,
        limit: args.limit as number | undefined,
        tag_filter: args.tag_filter as string | undefined,
      });

    case "restore_snapshot":
      if (!args) throw new Error("Missing arguments");
      // `backup_current` is accepted and ignored: a restore always backs up (D-51b).
      return await handleRestoreSnapshot(exportContext, {
        build_name: args.build_name as string,
        snapshot_id: args.snapshot_id as string,
      });

    case "export_build_summary":
      return await handleExportBuildSummary(deps.contextBuilder.buildExportContext());

    // ========================================
    // Trade API Tools
    // ========================================
    case "search_trade_items": {
      if (!args || !args.league) {
        throw new Error("Missing required argument: league");
      }
      return await handleSearchTradeItems(tradeContext(deps), args as unknown as SearchTradeItemsArgs);
    }

    case "get_item_price": {
      if (!args) throw new Error("Missing arguments");
      return await handleGetItemPrice(tradeContext(deps), {
        item_name: args.item_name as string,
        league: args.league as string | undefined,
        item_type: args.item_type as string | undefined,
        rarity: args.rarity as "unique" | "rare" | "magic" | "normal" | undefined,
      });
    }

    case "get_leagues":
      return await handleGetLeagues(tradeContext(deps));

    case "trade_query_options":
      return await handleTradeQueryOptions({ getLuaClient: deps.getLuaClient }, args);

    case "find_upgrades":
      return await handleFindUpgrades(
        {
          session: deps.session,
          tradeClient: deps.tradeClient,
          currency: deps.currency,
          credentials: deps.credentials,
          env: deps.env,
          call: {
            signal: call.signal,
            deadline: call.arrivedAt + FIND_UPGRADES_BUDGET_MS,
            ...(call.now ? { now: call.now } : {}),
            sendProgress: (progress, message) => call.sendProgress(progress, message),
          },
        },
        args,
      );

    case "search_stats": {
      if (!args) throw new Error("Missing arguments");
      return await handleSearchStats(tradeContext(deps), {
        query: args.query as string,
        limit: args.limit as number | undefined,
      });
    }

    // ========================================
    // poe.ninja API Tools
    // ========================================
    case "get_currency_rates": {
      if (!args || !args.league) throw new Error("Missing required argument: league");
      return await handleGetCurrencyRates({ currency: deps.currency }, { league: args.league as string });
    }

    // Build Goals Tools
    case "get_build_issues": {
      const goalsContext = {
        getLuaClient: deps.getLuaClient,
        ensureLuaClient: deps.ensureLuaClient,
      };
      const { issues, stats } = await handleGetBuildIssues(goalsContext);
      return formatIssuesResponse(issues, stats);
    }

    case "get_passive_upgrades": {
      const upgradesContext = {
        getLuaClient: deps.getLuaClient,
        ensureLuaClient: deps.ensureLuaClient,
      };
      const focus = (args?.focus as 'dps' | 'defence' | 'both') || 'both';
      const maxResults = (args?.max_results as number) || 10;
      return await handleGetPassiveUpgrades(upgradesContext, focus, maxResults);
    }

    case "plan_leveling":
      return await handlePlanLeveling(
        { getLuaClient: deps.getLuaClient, ensureLuaClient: deps.ensureLuaClient },
        args || {}
      );

    case "get_build_notes":
      if (!args?.build_name) throw new Error("Missing build_name");
      return await handleGetBuildNotes(deps.contextBuilder.buildHandlerContext(), args.build_name as string);

    case "set_build_notes":
      if (!args?.build_name) throw new Error("Missing build_name");
      if (args?.notes == null) throw new Error("Missing notes");
      return await handleSetBuildNotes(deps.contextBuilder.buildHandlerContext(), args.build_name as string, args.notes as string);

    default:
      // A TOOL_META entry without a case: still a protocol error, never an isError result.
      throw unknownTool(name);
  }
}
