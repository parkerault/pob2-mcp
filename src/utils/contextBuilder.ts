/**
 * Context Builder
 *
 * Centralizes the creation of handler contexts to ensure consistency
 * and make it easier to extend or modify context structures.
 */

import type { BuildService } from '../services/buildService.js';
import type { TreeService } from '../services/treeService.js';
import type { WatchService } from '../services/watchService.js';
import type { ValidationService } from '../services/validationService.js';
import type { BuildExportService } from '../services/buildExportService.js';
import type { PoBLuaApiClient } from '../pobLuaBridge.js';

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
  validationService: ValidationService;
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
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
  stopLuaClient: () => Promise<void>;
}

/**
 * Context for item and skill operations (subset of Lua operations)
 */
export interface ItemSkillContext extends BaseContext {
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
}

/**
 * Context for optimization operations (combines build/tree services with Lua)
 */
export interface OptimizationContext extends BaseContext {
  buildService: BuildService;
  treeService: TreeService;
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
}

/**
 * Context for export and persistence operations
 */
export interface ExportContext extends BaseContext {
  buildService: BuildService;
  exportService: BuildExportService;
  luaClient?: PoBLuaApiClient;
}

/**
 * Context for validation operations
 */
export interface ValidationContext extends BaseContext {
  buildService: BuildService;
  validationService: ValidationService;
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
}

/**
 * Dependencies needed to build all context types
 */
export interface ContextDependencies {
  buildService: BuildService;
  treeService: TreeService;
  watchService: WatchService;
  validationService: ValidationService;
  exportService: BuildExportService;
  pobDirectory: string;
  stateDir: string;
  /** The env (deps.env, C-7): the only env source below the entry. */
  env: Readonly<Record<string, string | undefined>>;
  fetch: typeof globalThis.fetch;
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
  stopLuaClient: () => Promise<void>;
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
      validationService: this.deps.validationService,
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      getLuaClient: this.deps.getLuaClient,
      ensureLuaClient: this.deps.ensureLuaClient,
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
   * Build context for tree operations (same as handler context currently)
   */
  buildTreeContext(): HandlerContext {
    return {
      buildService: this.deps.buildService,
      treeService: this.deps.treeService,
      validationService: this.deps.validationService,
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      getLuaClient: this.deps.getLuaClient,
      ensureLuaClient: this.deps.ensureLuaClient,
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
      stopLuaClient: this.deps.stopLuaClient,
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
    return {
      buildService: this.deps.buildService,
      treeService: this.deps.treeService,
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      getLuaClient: this.deps.getLuaClient,
      ensureLuaClient: this.deps.ensureLuaClient,
    };
  }

  /**
   * Build context for export and persistence operations
   */
  buildExportContext(): ExportContext {
    return {
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      buildService: this.deps.buildService,
      exportService: this.deps.exportService,
      luaClient: this.deps.getLuaClient() || undefined,
    };
  }

  /**
   * Build context for validation operations
   */
  buildValidationContext(): ValidationContext {
    return {
      buildService: this.deps.buildService,
      validationService: this.deps.validationService,
      pobDirectory: this.deps.pobDirectory,
      stateDir: this.deps.stateDir,
      getLuaClient: this.deps.getLuaClient,
      ensureLuaClient: this.deps.ensureLuaClient,
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
