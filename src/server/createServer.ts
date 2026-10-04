/**
 * Server factory (C-7).
 *
 * `createServer(deps)` builds the MCP server with every I/O dependency injected. Constructing it
 * makes no network request, spawns no process, writes no file and registers no process listener;
 * `src/index.ts` is the only module that touches the process (env, listeners, stdio).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { spawn as nodeSpawn } from "child_process";

import { BuildService } from "../services/buildService.js";
import { TreeService } from "../services/treeService.js";
import { WatchService } from "../services/watchService.js";
import { ValidationService } from "../services/validationService.js";
import { BuildExportService } from "../services/buildExportService.js";
import { SkillGemService } from "../services/skillGemService.js";
import { TradeApiClient } from "../services/tradeClient.js";
import { StatMapper } from "../services/statMapper.js";
import { PoeNinjaClient } from "../services/poeNinjaClient.js";
import { ItemRecommendationEngine } from "../services/itemRecommendationEngine.js";
import { ContextBuilder } from "../utils/contextBuilder.js";
import { ToolGate } from "./toolGate.js";
import { LuaClientManager } from "./luaClientManager.js";
import {
  getToolSchemas,
  getLuaToolSchemas,
  getOptimizationToolSchemas,
  getConfigToolSchemas,
  getValidationToolSchemas,
  getExportToolSchemas,
  getSkillGemToolSchemas,
  getTradeToolSchemas,
  getPoeNinjaToolSchemas,
  getBuildGoalsToolSchemas,
} from "./toolSchemas.js";
import {
  routeToolCall,
  lazyTradeStats,
  type ToolCallContext,
  type ToolRouterDependencies,
} from "./toolRouter.js";
import { isToolAvailable } from "./toolMeta.js";
import { wrapWithTruncation, type ToolResponse } from "./responseUtils.js";

/** Trade session credentials (C-9). WU-14 moves this type to `src/trade/credentials.ts`. */
export interface Credentials {
  sessionId: string | null;
  source: "process-env" | "dotenv" | null;
  problem?: "op-reference" | "malformed";
}

export interface ServerDeps {
  /** package.json version (read by the entry). */
  version: string;
  /** The ONLY env source below the entry. */
  env: Readonly<Record<string, string | undefined>>;
  /** D-16; this user: the Windows PoB2 Builds folder. */
  pobDirectory: string;
  /** C-16: ${XDG_STATE_HOME:-~/.local/state}/pob2-mcp */
  stateDir: string;
  /** Every outbound HTTP goes through this. */
  fetch: typeof globalThis.fetch;
  /** The engine process factory. */
  spawn: typeof nodeSpawn;
  /** C-9; until WU-14 a stub returning {sessionId: null, source: null}. */
  credentials: () => Credentials;
  now?: () => number;
}

/**
 * The engine handle (C-3). Until WU-08 delivers the engine session, this is the existing
 * engine manager behind a thin interface.
 */
export interface EngineSession {
  /** The running engine's process id, or null when no engine runs (test hook). */
  enginePid(): number | null;
  /** Stop the engine: `quit`, wait ≤ 2 s for exit, then SIGKILL. */
  shutdown(): Promise<void>;
}

/**
 * Tools whose output is truncated to 5000 characters (C-1). `find_upgrades` and
 * `trade_query_options` are deliberately absent (D-53).
 */
export const TRUNCATED_TOOLS: ReadonlySet<string> = new Set([
  "analyze_build", "analyze_defenses", "suggest_optimal_nodes", "optimize_tree", "analyze_items",
  "optimize_skill_links", "create_budget_build", "search_trade_items", "find_item_upgrades",
  "find_resistance_gear", "compare_trade_items", "search_cluster_jewels", "generate_shopping_list",
  "validate_build", "get_passive_upgrades", "analyze_skill_links", "suggest_support_gems",
  "find_optimal_links", "compare_gem_setups", "lua_get_stats", "suggest_masteries",
]);

/** Every registered tool schema, in registry order (listing filters by C-8 group). */
function allToolSchemas(): Array<{ name: string; description?: string; [k: string]: unknown }> {
  return [
    ...getToolSchemas(),
    ...getLuaToolSchemas(),
    ...getConfigToolSchemas(),
    ...getBuildGoalsToolSchemas(),
    ...getOptimizationToolSchemas(),
    ...getValidationToolSchemas(),
    ...getExportToolSchemas(),
    ...getSkillGemToolSchemas(),
    ...getTradeToolSchemas(),
    ...getPoeNinjaToolSchemas(),
  ];
}

/** The MCP request `extra` fields the router's call context is built from (C-1). */
export interface CallExtra {
  signal: AbortSignal;
  _meta?: { progressToken?: string | number; [k: string]: unknown };
  sendNotification: (notification: {
    method: "notifications/progress";
    params: { progressToken: string | number; progress: number; message?: string };
  }) => Promise<void>;
}

/** Build the router's call context from the SDK request `extra` (C-1). */
export function buildCallContext(extra: CallExtra, now: () => number = Date.now): ToolCallContext {
  const progressToken = extra._meta?.progressToken;
  return {
    signal: extra.signal,
    progressToken,
    arrivedAt: now(),
    async sendProgress(progress: number, message?: string): Promise<void> {
      if (progressToken === undefined) return;
      await extra.sendNotification({
        method: "notifications/progress",
        params: { progressToken, progress, ...(message !== undefined ? { message } : {}) },
      });
    },
  };
}

export function createServer(deps: ServerDeps): {
  server: Server;
  engine: EngineSession;
  shutdown(): Promise<void>;
} {
  const env = deps.env;
  const now = deps.now ?? Date.now;

  const server = new Server(
    { name: "pob2-mcp-server", version: deps.version },
    { capabilities: { resources: {}, tools: {} } },
  );

  // Services. None of these does I/O when constructed.
  const buildService = new BuildService(deps.pobDirectory);
  const treeService = new TreeService(buildService, env);
  const watchService = new WatchService(deps.pobDirectory, buildService);
  const validationService = new ValidationService();
  const exportService = new BuildExportService(deps.pobDirectory);
  const skillGemService = new SkillGemService();
  const ninjaClient = new PoeNinjaClient({ fetch: deps.fetch });
  const tradeClient = new TradeApiClient({
    fetch: deps.fetch,
    env,
    credentials: deps.credentials,
    requestsPerSecond: env.POE_RATE_LIMIT_PER_SECOND ? parseInt(env.POE_RATE_LIMIT_PER_SECOND, 10) : undefined,
    cacheTTL: env.POE_CACHE_TTL ? parseInt(env.POE_CACHE_TTL, 10) : undefined,
  });
  const statMapper = new StatMapper();
  const recommendationEngine = new ItemRecommendationEngine(tradeClient, statMapper);
  const toolGate = new ToolGate();
  const luaClientManager = new LuaClientManager({ env, spawn: deps.spawn });

  const contextBuilder = new ContextBuilder({
    buildService,
    treeService,
    watchService,
    validationService,
    exportService,
    skillGemService,
    pobDirectory: deps.pobDirectory,
    stateDir: deps.stateDir,
    env,
    fetch: deps.fetch,
    getLuaClient: () => luaClientManager.getClient(),
    ensureLuaClient: () => luaClientManager.ensureClient(),
    stopLuaClient: () => luaClientManager.stopClient(),
  });

  const routerDeps: ToolRouterDependencies = {
    toolGate,
    contextBuilder,
    tradeClient,
    statMapper,
    recommendationEngine,
    ninjaClient,
    getLuaClient: () => luaClientManager.getClient(),
    ensureLuaClient: () => luaClientManager.ensureClient(),
    env,
    ensureTradeStats: lazyTradeStats(tradeClient, statMapper),
  };

  server.onerror = (error) => {
    console.error("[MCP Error]", error);
  };

  // Resources: the build files.
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const builds = await buildService.listBuilds();
      return {
        resources: builds.map((build) => ({
          uri: `pob://build/${encodeURIComponent(build)}`,
          name: build,
          mimeType: "application/xml",
          description: `Path of Building build: ${build}`,
        })),
      };
    } catch (error) {
      console.error("[MCP Server] Error listing resources:", error);
      return { resources: [] };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const match = uri.match(/^pob:\/\/build\/(.+)$/);
    if (!match) throw new Error(`Invalid URI: ${uri}`);
    const buildName = decodeURIComponent(match[1]);
    try {
      const build = await buildService.readBuild(buildName);
      const summary = buildService.generateBuildSummary(build);
      return { contents: [{ uri, mimeType: "text/plain", text: summary }] };
    } catch (error) {
      throw new Error(`Failed to read build: ${error}`);
    }
  });

  // Tools: every tool with TOOL_META whose group is enabled (C-1, C-8).
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = allToolSchemas().filter((t) => isToolAvailable(t.name, env));
    return { tools } as { tools: Array<{ name: string; inputSchema: { type: "object" } }> };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const call = buildCallContext(extra as unknown as CallExtra, now);
    const result: ToolResponse = await routeToolCall(name, args, routerDeps, call);
    if (!result.isError && TRUNCATED_TOOLS.has(name)) return wrapWithTruncation(result);
    return result;
  });

  const engine: EngineSession = {
    enginePid: () => luaClientManager.enginePid(),
    shutdown: () => luaClientManager.stopClient(),
  };

  let shuttingDown: Promise<void> | null = null;
  const shutdown = (): Promise<void> => {
    if (!shuttingDown) {
      shuttingDown = (async () => {
        try {
          await watchService.stopWatching();
        } catch (error) {
          console.error("[MCP Server] Error stopping the watcher:", error);
        }
        await engine.shutdown();
        try {
          await server.close();
        } catch (error) {
          console.error("[MCP Server] Error closing the server:", error);
        }
      })();
    }
    return shuttingDown;
  };

  return { server, engine, shutdown };
}
