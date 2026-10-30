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
import fs from "fs";
import path from "path";

import { BuildService } from "../services/buildService.js";
import { TreeService } from "../services/treeService.js";
import { WatchService } from "../services/watchService.js";
import { BuildExportService } from "../services/buildExportService.js";
import { BuildFileWriter } from "../services/buildFileWriter.js";
import { TradeApiClient } from "../trade/tradeClient.js";
import { RateLimiter, TRADE_SEARCH_PACE, type SearchPace, type Trade429Entry } from "../trade/rateLimiter.js";
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
import { monotonicNow } from "../utils/clock.js";

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
  /**
   * C-34: the guides root, `POB_GUIDES_DIRECTORY` or `Guides` beside the builds folder (D-154).
   * Nothing creates it at construction; only `guide_run`'s run-folder mode does.
   */
  guidesDirectory: string;
  /** Every outbound HTTP goes through this. */
  fetch: typeof globalThis.fetch;
  /** The engine process factory. */
  spawn: typeof nodeSpawn;
  /** C-9: the trade session cookie, re-read on every authenticated trade request. */
  credentials: () => Credentials;
  /** The clock for deadlines and elapsed time (default: the monotonic `monotonicNow`; tests inject a fake one). */
  now?: () => number;
  /**
   * D-461: the trade limiter's search pace, 45 s between searches and at most 7 in 300 s
   * (`TRADE_SEARCH_PACE`, the default). The entry sets it; test servers turn it off (null) or run it on a
   * fake `tradeSleep`.
   */
  tradePace?: SearchPace | null;
  /** The trade limiter's sleep (default: a real timer); a test with a fake `now` passes one that advances it. */
  tradeSleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** C-16 (D-461): the 429 log in the state dir, one JSON line per 429 the trade site sent. */
export const TRADE_429_LOG = "trade-429.jsonl";
/** The 429 log keeps its last this many lines. */
export const TRADE_429_LOG_KEEP = 200;

/** An ISO time to the second: `2026-10-27T14:03:11Z`. */
function isoSeconds(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * The 429 sink (D-461): appends `{at, ...entry}` to `<stateDir>/trade-429.jsonl`, creating the state dir
 * when missing. The file is appended to, never rewritten whole, except to trim it to its last
 * `TRADE_429_LOG_KEEP` lines once an append takes it past them (a temp file renamed over it). Writes are
 * synchronous, so one server's 429s can't interleave. Lines that aren't JSON objects are reported on stderr
 * and left to age out. Any failure (an unwritable folder or file, a folder in the file's place) goes to
 * stderr: the sink never throws, so the call's result never changes.
 */
export function createTrade429Log(opts: { stateDir: string; now?: () => number }): (entry: Trade429Entry) => void {
  const file = path.join(opts.stateDir, TRADE_429_LOG);
  const now = opts.now ?? Date.now;
  return (entry) => {
    try {
      const line = JSON.stringify({ at: isoSeconds(now()), ...entry });
      fs.mkdirSync(opts.stateDir, { recursive: true });
      let existing = "";
      try {
        existing = fs.readFileSync(file, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const lines = existing.split("\n").filter((l) => l.trim() !== "");
      const unreadable = lines.filter((l) => {
        try {
          const v = JSON.parse(l) as unknown;
          return v === null || typeof v !== "object" || Array.isArray(v);
        } catch {
          return true;
        }
      }).length;
      if (unreadable > 0) {
        console.error(`[RateLimiter] the 429 log ${file} has ${unreadable} unreadable line(s); appending after them`);
      }
      if (lines.length + 1 > TRADE_429_LOG_KEEP) {
        const kept = [...lines.slice(lines.length + 1 - TRADE_429_LOG_KEEP), line];
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, `${kept.join("\n")}\n`, "utf8");
        fs.renameSync(tmp, file);
      } else {
        const sep = existing !== "" && !existing.endsWith("\n") ? "\n" : "";
        fs.appendFileSync(file, `${sep}${line}\n`, "utf8");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[RateLimiter] could not write the 429 log ${file}: ${msg}`);
    }
  };
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

/**
 * The tools `tools/list` returns for this env, in listing order: every schema with TOOL_META whose
 * group is enabled (C-1, C-8). `scripts/gen-tool-table.mjs` renders the README tool table from it.
 */
export function listedToolSchemas(
  env: Readonly<Record<string, string | undefined>>,
): Array<{ name: string; description?: string; [k: string]: unknown }> {
  return allToolSchemas().filter((t) => isToolAvailable(t.name, env));
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
    now,
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
  // Deadlines and elapsed time run on a clock that never steps (a WSL2 wall clock can step backwards).
  const now = deps.now ?? monotonicNow;

  const server = new Server(
    { name: "pob2-mcp-server", version: deps.version },
    { capabilities: { resources: {}, tools: {} } },
  );

  // Services. None of these does I/O when constructed.
  const buildService = new BuildService(deps.pobDirectory);
  const treeService = new TreeService(buildService, env);
  const watchService = new WatchService(deps.pobDirectory, buildService);
  // C-12: poe.ninja rates, read lazily and cached per league.
  // Cache ages are wall-clock times.
  const currency = new CurrencyService({ fetch: deps.fetch, userAgent: userAgent(), env, now: deps.now ?? Date.now });
  // Trade (C-9, C-10, C-11): one limiter for all trade traffic; the cookie is read per request.
  // D-461: the search pace (on unless the deps turn it off), and each 429 logged in the state dir
  // with a wall-clock time.
  const tradePace = deps.tradePace === undefined ? TRADE_SEARCH_PACE : deps.tradePace;
  const tradeLimiter = new RateLimiter({
    now,
    ...(deps.tradeSleep ? { sleep: deps.tradeSleep } : {}),
    searchPace: tradePace,
    on429: createTrade429Log({ stateDir: deps.stateDir, now: deps.now ?? Date.now }),
  });
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
  const session = createEngineSession({
    env,
    spawn: deps.spawn,
    pobDirectory: deps.pobDirectory,
    now,
    // C-17 step 3 (D-86): the writer remembers the engine's fingerprint of every file it loaded or saved.
    onFileFingerprint: (rel, fp) => buildFileWriter.noteEngineFingerprint(rel, fp),
  });
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
    guidesDirectory: deps.guidesDirectory,
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
    // C-49: price results are dated on the wall clock, as the currency cache's ages are.
    wallClock: deps.now ?? Date.now,
    // D-474: the trade tools' pace line reports the limiter's pace.
    tradePace,
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
    const tools = listedToolSchemas(env);
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
