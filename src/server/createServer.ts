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
import { BuildFileWriter } from "../services/buildFileWriter.js";
import { TradeApiClient } from "../trade/tradeClient.js";
import { RateLimiter } from "../trade/rateLimiter.js";
import { resolveDefaultLeague } from "../trade/league.js";
import type { Credentials } from "../trade/credentials.js";
import { userAgent } from "../utils/userAgent.js";
import { StatMapper } from "../services/statMapper.js";
import { CurrencyService } from "../trade/currency.js";
import { ContextBuilder, sessionScopedEngine, type EngineAccess } from "../utils/contextBuilder.js";
import { createEngineSession, type EngineSession } from "../engine/session.js";
import {
  getToolSchemas,
  getLuaToolSchemas,
  getOptimizationToolSchemas,
  getConfigToolSchemas,
  getValidationToolSchemas,
  getExportToolSchemas,
  getTradeToolSchemas,
  getPoeNinjaToolSchemas,
  getBuildGoalsToolSchemas,
} from "./toolSchemas.js";
import {
  routeToolCall,
  type ToolCallContext,
  type ToolRouterDependencies,
} from "./toolRouter.js";
import { isToolAvailable } from "./toolMeta.js";
import { wrapWithTruncation, type ToolResponse } from "./responseUtils.js";

export type { Credentials } from "../trade/credentials.js";

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
  /** C-9: the trade session cookie, re-read on every authenticated trade request. */
  credentials: () => Credentials;
  now?: () => number;
}

/** The engine handle is the engine session (C-3). */
export type { EngineSession } from "../engine/session.js";

/**
 * Tools whose output is truncated to 5000 characters (C-1). `find_upgrades` and
 * `trade_query_options` are deliberately absent (D-53).
 */
export const TRUNCATED_TOOLS: ReadonlySet<string> = new Set([
  "analyze_build", "analyze_defenses", "search_trade_items", "validate_build", "get_passive_upgrades",
  "lua_get_stats",
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

/**
 * The lazy trade2 `/data/stats` load (D-14): the first trade tool call that needs stats loads them
 * (one request); later calls reuse them. A failure is logged and the next trade call retries; until
 * a load succeeds, `search_stats` reports "trade stat data unavailable" (there is no static fallback).
 */
async function ensureTradeStats(
  tradeClient: Pick<TradeApiClient, "getStats">,
  statMapper: Pick<StatMapper, "ensureLoaded">,
): Promise<void> {
  try {
    await statMapper.ensureLoaded(() => tradeClient.getStats());
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[StatMapper] Failed to load trade stat data: ${msg}`);
  }
}

export function createServer(deps: ServerDeps): {
  server: Server;
  engine: EngineSession;
  /**
   * Test hook: the session-scoped engine accessor the router and every handler context were wired
   * with (C-3 step 5), so a test can check the server's real `getLuaClient`/`ensureLuaClient`.
   */
  engineAccess: EngineAccess;
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
  // C-12: poe.ninja rates, read lazily and cached per league.
  const currency = new CurrencyService({ fetch: deps.fetch, userAgent: userAgent(), env, now });
  // Trade (C-9, C-10, C-11): one limiter for all trade traffic; the cookie is read per request.
  const tradeLimiter = new RateLimiter({ now });
  const tradeClient = new TradeApiClient({
    fetch: deps.fetch,
    credentials: deps.credentials,
    limiter: tradeLimiter,
    userAgent: userAgent(),
    baseUrl: env.POE_TRADE_BASE || undefined,
    realm: env.POE_TRADE_REALM || undefined,
    now,
  });
  const statMapper = new StatMapper();
  // The engine session (C-3) is the only owner of the engine; nothing starts until an engine call.
  const session = createEngineSession({ env, spawn: deps.spawn, pobDirectory: deps.pobDirectory, now });
  const engineAccess = sessionScopedEngine(session);
  // C-17: the only path for server writes into the builds folder (backups go to the state dir, C-16).
  const buildFileWriter = new BuildFileWriter({
    pobDirectory: deps.pobDirectory,
    stateDir: deps.stateDir,
    loaded: () => session.loaded,
    onWritten: (rel) => {
      // D-58: drop the build-parse cache entry for the written file (keyed by canonical relative path).
      buildService.invalidateBuild(rel);
    },
  });
  // Snapshots and exports live in the state dir (C-16); restores and exports into the builds folder
  // go through the writer (C-17).
  const exportService = new BuildExportService(deps.pobDirectory, deps.stateDir, buildFileWriter);

  const contextBuilder = new ContextBuilder({
    buildService,
    treeService,
    watchService,
    validationService,
    exportService,
    pobDirectory: deps.pobDirectory,
    stateDir: deps.stateDir,
    env,
    fetch: deps.fetch,
    getLuaClient: engineAccess.getLuaClient,
    ensureLuaClient: engineAccess.ensureLuaClient,
    engine: engineAccess.engine,
    loadedBuild: engineAccess.loadedBuild,
    buildFileWriter,
  });

  const routerDeps: ToolRouterDependencies = {
    contextBuilder,
    tradeClient,
    statMapper,
    currency,
    session,
    getLuaClient: engineAccess.getLuaClient,
    ensureLuaClient: engineAccess.ensureLuaClient,
    env,
    ensureTradeStats: () => ensureTradeStats(tradeClient, statMapper),
    resolveLeague: () => resolveDefaultLeague(env, tradeClient),
    credentials: deps.credentials,
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

  const engine: EngineSession = session;

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

  return { server, engine, engineAccess, shutdown };
}
