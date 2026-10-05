/**
 * Context Builder
 *
 * Centralizes the creation of handler contexts to ensure consistency
 * and make it easier to extend or modify context structures.
 */

import type { BuildService } from '../services/buildService.js';
import type { TreeService } from '../services/treeService.js';
import type { WatchService } from '../services/watchService.js';
import type { BuildExportService } from '../services/buildExportService.js';
import type { PoBLuaApiClient } from '../pobLuaBridge.js';
import type { BuildFileWriter } from '../services/buildFileWriter.js';
import {
  EngineAccessError,
  type EngineCallContext,
  type EngineSession,
  type LoadedBuild,
} from '../engine/session.js';

/**
 * Session-scoped engine access (C-3 step 5). Inside a `session.run`, `getLuaClient()` is the run's
 * `ctx.client` (which rejects raw loads) and `ensureLuaClient()` resolves at once (the session already
 * started the engine); outside one, both throw "engine access outside a session". Nothing else can
 * reach the engine, so only the session starts it (D-59).
 */
export interface EngineAccess {
  getLuaClient: () => PoBLuaApiClient;
  ensureLuaClient: () => Promise<void>;
  /** The running call's context: the load methods, `stopEngine` (lua_stop), `noteSaved`, … */
  engine: () => EngineCallContext;
  /** The build the engine holds (C-3 `loaded`). */
  loadedBuild: () => LoadedBuild | null;
}

export function sessionScopedEngine(session: Pick<EngineSession, 'current' | 'loaded'>): EngineAccess {
  const engine = (): EngineCallContext => {
    const ctx = session.current();
    if (!ctx) throw new EngineAccessError();
    return ctx;
  };
  return {
    getLuaClient: () => engine().client,
    ensureLuaClient: async () => {
      engine();
    },
    engine,
    loadedBuild: () => session.loaded,
  };
}

/**
 * Fields every handler context carries (C-7): the builds folder and the state dir.
 */
export interface BaseContext {
  /** The builds folder (C-7, D-16). */
  pobDirectory: string;
  /** The server state dir (C-7, C-16). */
  stateDir: string;
}

/**
 * Context for basic build and tree handlers
 */
export interface HandlerContext extends BaseContext {
  buildService: BuildService;
  treeService: TreeService;
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
  /**
   * The running engine call's context (C-3): `analyze_build`/`compare_builds` load files with
   * `withTemporaryBuild` (D-9). Without it (a handler unit test) they analyze the file only.
   */
  engine?: () => EngineCallContext;
  /** C-17: `set_build_notes` writes through it. */
  buildFileWriter?: Pick<BuildFileWriter, 'writeBuildFile'>;
}

/**
 * Context for tree handlers: the handler context plus the build the engine holds (C-3 `loaded`)
 */
export interface TreeContext extends HandlerContext {
  loadedBuild: () => LoadedBuild | null;
}

/**
 * Context for watch handlers (includes watchService)
 */
export interface WatchContext extends BaseContext {
  buildService: BuildService;
  treeService: TreeService;
  watchService: WatchService;
}

/**
 * Context for Lua-related operations
 */
export interface LuaContext extends BaseContext {
  /** Every outbound HTTP goes through this (deps.fetch, C-7): import_build's share-site fetch. */
  fetch: typeof globalThis.fetch;
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
  /** The running engine call's context (C-3): load paths and lua_stop go through it. */
  engine: () => EngineCallContext;
  /** The build the engine holds (C-3 `loaded`). */
  loadedBuild: () => LoadedBuild | null;
  /** C-17: every write into the builds folder goes through it. */
  buildFileWriter: BuildFileWriter;
}

/**
 * Context for item and skill operations (subset of Lua operations)
 */
export interface ItemSkillContext extends BaseContext {
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
}

/**
 * Context for the advice tools on engine data (`analyze_defenses`, `validate_build`, FR-A1): the
 * running engine call, the loaded build, and the build files (another build is read with
 * `withTemporaryBuild`, D-9).
 */
export interface AdviceToolContext extends BaseContext {
  buildService: BuildService;
  /** The running engine call's context (C-3). */
  engine: () => EngineCallContext;
  /** The build the engine holds (C-3 `loaded`). */
  loadedBuild: () => LoadedBuild | null;
}

/** Context for `analyze_defenses`. */
export type OptimizationContext = AdviceToolContext;

/**
 * Context for export and persistence operations
 */
export interface ExportContext extends BaseContext {
  buildService: BuildService;
  exportService: BuildExportService;
  luaClient?: PoBLuaApiClient;
  /** The running engine call's context (C-3): `export_build` with notes uses `withTemporaryBuild`. */
  engine: () => EngineCallContext;
}

/** Context for `validate_build`. */
export type ValidationContext = AdviceToolContext;

/**
 * Dependencies needed to build all context types
 */
export interface ContextDependencies {
  buildService: BuildService;
  treeService: TreeService;
  watchService: WatchService;
  exportService: BuildExportService;
  pobDirectory: string;
  stateDir: string;
  /** The env (deps.env, C-7): the only env source below the entry. */
  env: Readonly<Record<string, string | undefined>>;
  fetch: typeof globalThis.fetch;
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
  engine: () => EngineCallContext;
  loadedBuild: () => LoadedBuild | null;
  /** C-17: the one build-file writer (it keeps the record of its own writes). */
  buildFileWriter: BuildFileWriter;
}

/**
 * ContextBuilder provides a centralized way to create handler contexts
 */
export class ContextBuilder {
  constructor(private deps: ContextDependencies) {}

  /**
   * Build context for basic handlers (build and tree operations)
   */
  buildHandlerContext(): HandlerContext {
    return {
      buildService: this.deps.buildService,
      treeService: this.deps.treeService,
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      getLuaClient: this.deps.getLuaClient,
      ensureLuaClient: this.deps.ensureLuaClient,
      engine: this.deps.engine,
      buildFileWriter: this.deps.buildFileWriter,
    };
  }

  /**
   * Build context for watch handlers
   */
  buildWatchContext(): WatchContext {
    return {
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      buildService: this.deps.buildService,
      treeService: this.deps.treeService,
      watchService: this.deps.watchService,
    };
  }

  /**
   * Build context for tree operations: the handler context plus the engine's loaded build
   */
  buildTreeContext(): TreeContext {
    return {
      buildService: this.deps.buildService,
      treeService: this.deps.treeService,
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      getLuaClient: this.deps.getLuaClient,
      ensureLuaClient: this.deps.ensureLuaClient,
      loadedBuild: this.deps.loadedBuild,
    };
  }

  /**
   * Build context for Lua operations
   */
  buildLuaContext(): LuaContext {
    return {
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      fetch: this.deps.fetch,
      getLuaClient: this.deps.getLuaClient,
      ensureLuaClient: this.deps.ensureLuaClient,
      engine: this.deps.engine,
      loadedBuild: this.deps.loadedBuild,
      buildFileWriter: this.deps.buildFileWriter,
    };
  }

  /**
   * Build context for item and skill operations
   */
  buildItemSkillContext(): ItemSkillContext {
    return {
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      getLuaClient: this.deps.getLuaClient,
      ensureLuaClient: this.deps.ensureLuaClient,
    };
  }

  /**
   * Build context for optimization operations
   */
  buildOptimizationContext(): OptimizationContext {
    return this.buildAdviceToolContext();
  }

  /**
   * Build context for export and persistence operations
   */
  buildExportContext(): ExportContext {
    const getLuaClient = this.deps.getLuaClient;
    const context: ExportContext = {
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      buildService: this.deps.buildService,
      exportService: this.deps.exportService,
      engine: this.deps.engine,
    };
    // Resolved on access, not when the context is built: outside an engine call it throws (C-3).
    Object.defineProperty(context, 'luaClient', {
      get: () => getLuaClient() || undefined,
      enumerable: true,
      configurable: true,
    });
    return context;
  }

  /**
   * Build context for validation operations
   */
  buildValidationContext(): ValidationContext {
    return this.buildAdviceToolContext();
  }

  /**
   * Build context for the advice tools on engine data (FR-A1)
   */
  buildAdviceToolContext(): AdviceToolContext {
    return {
      buildService: this.deps.buildService,
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      engine: this.deps.engine,
      loadedBuild: this.deps.loadedBuild,
    };
  }

  /**
   * Build context for config preset operations
   */
  buildConfigPresetContext(): import('../handlers/configHandlers.js').ConfigPresetContext & BaseContext {
    return {
      getLuaClient: this.deps.getLuaClient,
      ensureLuaClient: this.deps.ensureLuaClient,
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
    };
  }
}
