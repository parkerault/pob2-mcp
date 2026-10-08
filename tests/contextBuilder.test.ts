import { describe, it, expect } from '@jest/globals';
import { ContextBuilder } from '../src/utils/contextBuilder';
import type { ContextDependencies } from '../src/utils/contextBuilder';

// Mock implementations
const mockBuildService = {} as any;
const mockTreeService = {} as any;
const mockWatchService = {} as any;
const mockExportService = {} as any;
const mockLuaClient = {} as any;
const mockFetch = (async () => { throw new Error('no fetch'); }) as unknown as typeof fetch;

const mockDeps: ContextDependencies = {
  buildService: mockBuildService,
  treeService: mockTreeService,
  watchService: mockWatchService,
  exportService: mockExportService,
  pobDirectory: '/test/pob',
  stateDir: '/test/state/pob2-mcp',
  env: {},
  fetch: mockFetch,
  getLuaClient: () => mockLuaClient,
  ensureLuaClient: async () => {},
  engine: () => { throw new Error('no engine call'); },
  loadedBuild: () => null,
  buildFileWriter: {} as any,
  guidesDirectory: '/test/guides',
};

describe('ContextBuilder', () => {
  const builder = new ContextBuilder(mockDeps);

  describe('buildHandlerContext', () => {
    it('should return context with buildService and treeService', () => {
      const context = builder.buildHandlerContext();

      expect(context.buildService).toBe(mockBuildService);
      expect(context.treeService).toBe(mockTreeService);
      // WU-13: analyze_build/compare_builds use the engine call's context, set_build_notes the writer.
      expect(context.engine).toBe(mockDeps.engine);
      expect(context.buildFileWriter).toBe(mockDeps.buildFileWriter);
      expect(Object.keys(context)).toHaveLength(8);
    });
  });

  describe('buildWatchContext', () => {
    it('should return context with buildService, treeService, and watchService', () => {
      const context = builder.buildWatchContext();

      expect(context.buildService).toBe(mockBuildService);
      expect(context.treeService).toBe(mockTreeService);
      expect(context.watchService).toBe(mockWatchService);
      expect(Object.keys(context)).toHaveLength(5);
    });
  });

  describe('buildTreeContext', () => {
    it('should return context with buildService, treeService and the loaded build', () => {
      const context = builder.buildTreeContext();

      expect(context.buildService).toBe(mockBuildService);
      expect(context.treeService).toBe(mockTreeService);
      expect(context.loadedBuild()).toBeNull();
      expect(Object.keys(context)).toHaveLength(7);
    });
  });

  describe('buildLuaContext', () => {
    it('should return context with Lua configuration and methods', () => {
      const context = builder.buildLuaContext();

      expect(context.pobDirectory).toBe('/test/pob');
      expect(context.fetch).toBe(mockFetch);
      expect(context.getLuaClient()).toBe(mockLuaClient);
      expect(typeof context.ensureLuaClient).toBe('function');
      expect(typeof context.engine).toBe('function');
      expect(context.loadedBuild()).toBeNull();
    });
  });

  describe('buildItemSkillContext', () => {
    it('should return context with getLuaClient and ensureLuaClient', () => {
      const context = builder.buildItemSkillContext();

      expect(context.getLuaClient()).toBe(mockLuaClient);
      expect(typeof context.ensureLuaClient).toBe('function');
      expect(Object.keys(context)).toHaveLength(4);
    });
  });

  describe('buildOptimizationContext', () => {
    it('should return the advice-tool context: buildService, the engine call and the loaded build (WU-18)', () => {
      const context = builder.buildOptimizationContext();

      expect(context.buildService).toBe(mockBuildService);
      expect(context.pobDirectory).toBe('/test/pob');
      expect(context.engine).toBe(mockDeps.engine);
      expect(context.loadedBuild()).toBeNull();
      expect(Object.keys(context)).toHaveLength(5);
    });
  });

  describe('buildExportContext', () => {
    it('should return context with buildService and exportService', () => {
      const context = builder.buildExportContext();

      expect(context.buildService).toBe(mockBuildService);
      expect(context.exportService).toBe(mockExportService);
      expect(context.luaClient).toBe(mockLuaClient);
      // WU-13: export_build with notes uses withTemporaryBuild through the engine call's context.
      expect(context.engine).toBe(mockDeps.engine);
      expect(Object.keys(context)).toHaveLength(6);
    });
  });

  describe('buildValidationContext', () => {
    it('should return the advice-tool context: buildService, the engine call and the loaded build (WU-18)', () => {
      const context = builder.buildValidationContext();

      expect(context.buildService).toBe(mockBuildService);
      expect(context.engine).toBe(mockDeps.engine);
      expect(context.loadedBuild()).toBeNull();
      expect(Object.keys(context)).toHaveLength(5);
    });
  });

  it('every handler context carries pobDirectory and stateDir (C-7)', () => {
    const contexts = [
      builder.buildHandlerContext(), builder.buildWatchContext(), builder.buildTreeContext(),
      builder.buildLuaContext(), builder.buildItemSkillContext(), builder.buildOptimizationContext(),
      builder.buildExportContext(), builder.buildValidationContext(),
      builder.buildConfigPresetContext(),
    ];
    for (const c of contexts) {
      expect(c.pobDirectory).toBe('/test/pob');
      expect(c.stateDir).toBe('/test/state/pob2-mcp');
    }
  });
});
