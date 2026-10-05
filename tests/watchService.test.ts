import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import chokidar from 'chokidar';
import { WatchService } from '../src/services/watchService';
import { BuildService } from '../src/services/buildService';
import { getToolSchemas } from '../src/server/toolSchemas';

// Mock BuildService
jest.mock('../src/services/buildService');

describe('WatchService', () => {
  let watchService: WatchService;
  let mockBuildService: jest.Mocked<BuildService>;
  const testDirectory = '/test/pob/directory';

  beforeEach(() => {
    mockBuildService = new BuildService(testDirectory) as jest.Mocked<BuildService>;
    mockBuildService.invalidateBuild = jest.fn();
    watchService = new WatchService(testDirectory, mockBuildService);
  });

  afterEach(async () => {
    // Clean up any active watchers
    await watchService.stopWatching();
  });

  describe('constructor', () => {
    it('should initialize with directory and buildService', () => {
      expect(watchService.getDirectory()).toBe(testDirectory);
      expect(watchService.isWatchEnabled()).toBe(false);
    });
  });

  describe('getDirectory', () => {
    it('should return the PoB directory', () => {
      const result = watchService.getDirectory();
      expect(result).toBe(testDirectory);
    });
  });

  describe('isWatchEnabled', () => {
    it('should return false initially', () => {
      expect(watchService.isWatchEnabled()).toBe(false);
    });

    it('should return true after starting watch', () => {
      watchService.startWatching();
      expect(watchService.isWatchEnabled()).toBe(true);
    });

    it('should return false after stopping watch', async () => {
      watchService.startWatching();
      await watchService.stopWatching();
      expect(watchService.isWatchEnabled()).toBe(false);
    });
  });

  describe('getRecentChanges', () => {
    it('should return empty array initially', () => {
      const changes = watchService.getRecentChanges();
      expect(changes).toEqual([]);
    });

    it('should return changes in reverse chronological order', () => {
      // Manually add changes by accessing private property
      (watchService as any).recentChanges.push(
        { file: 'build1.xml', timestamp: 1000, type: 'added' },
        { file: 'build2.xml', timestamp: 2000, type: 'modified' },
        { file: 'build3.xml', timestamp: 3000, type: 'deleted' }
      );

      const changes = watchService.getRecentChanges();

      expect(changes).toHaveLength(3);
      expect(changes[0].file).toBe('build3.xml');
      expect(changes[1].file).toBe('build2.xml');
      expect(changes[2].file).toBe('build1.xml');
    });

    it('should respect limit parameter', () => {
      // Add 15 changes
      for (let i = 1; i <= 15; i++) {
        (watchService as any).recentChanges.push({
          file: `build${i}.xml`,
          timestamp: i * 1000,
          type: 'added'
        });
      }

      const changes = watchService.getRecentChanges(5);

      expect(changes).toHaveLength(5);
      expect(changes[0].file).toBe('build15.xml');
      expect(changes[4].file).toBe('build11.xml');
    });

    it('should default to 10 changes when no limit specified', () => {
      // Add 15 changes
      for (let i = 1; i <= 15; i++) {
        (watchService as any).recentChanges.push({
          file: `build${i}.xml`,
          timestamp: i * 1000,
          type: 'added'
        });
      }

      const changes = watchService.getRecentChanges();

      expect(changes).toHaveLength(10);
      expect(changes[0].file).toBe('build15.xml');
      expect(changes[9].file).toBe('build6.xml');
    });
  });

  describe('getRecentChangesCount', () => {
    it('should return 0 initially', () => {
      expect(watchService.getRecentChangesCount()).toBe(0);
    });

    it('should return correct count after adding changes', () => {
      (watchService as any).recentChanges.push(
        { file: 'build1.xml', timestamp: 1000, type: 'added' },
        { file: 'build2.xml', timestamp: 2000, type: 'modified' }
      );

      expect(watchService.getRecentChangesCount()).toBe(2);
    });
  });

  describe('processFileChange (via private method access)', () => {
    it('should invalidate build cache when file changes', () => {
      // Access private method
      (watchService as any).processFileChange('test.xml', 'modified');

      expect(mockBuildService.invalidateBuild).toHaveBeenCalledWith('test.xml');
    });

    it('should track file changes', () => {
      (watchService as any).processFileChange('test.xml', 'modified');

      const changes = watchService.getRecentChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe('test.xml');
      expect(changes[0].type).toBe('modified');
    });

    it('should limit recent changes to 50', () => {
      // Add 60 changes
      for (let i = 1; i <= 60; i++) {
        (watchService as any).processFileChange(`build${i}.xml`, 'modified');
      }

      const count = watchService.getRecentChangesCount();
      expect(count).toBe(50);

      const changes = watchService.getRecentChanges(50);
      // Should have the most recent 50
      expect(changes[0].file).toBe('build60.xml');
      expect(changes[49].file).toBe('build11.xml');
    });
  });

  describe('handleFileChange (via private method access)', () => {
    it('should ignore non-XML files', () => {
      (watchService as any).handleFileChange(`${testDirectory}/file.txt`, 'modified');

      // No changes should be tracked
      expect(watchService.getRecentChangesCount()).toBe(0);
      expect(mockBuildService.invalidateBuild).not.toHaveBeenCalled();
    });

    it('should process XML files', (done) => {
      (watchService as any).handleFileChange(`${testDirectory}/build.xml`, 'modified');

      // Due to debouncing, wait for setTimeout
      setTimeout(() => {
        expect(watchService.getRecentChangesCount()).toBe(1);
        expect(mockBuildService.invalidateBuild).toHaveBeenCalledWith('build.xml');
        done();
      }, 600); // Wait longer than 500ms debounce
    });

    it('should debounce rapid changes to same file', (done) => {
      (watchService as any).handleFileChange(`${testDirectory}/build.xml`, 'modified');
      (watchService as any).handleFileChange(`${testDirectory}/build.xml`, 'modified');
      (watchService as any).handleFileChange(`${testDirectory}/build.xml`, 'modified');

      setTimeout(() => {
        // Should only process once despite 3 calls
        expect(watchService.getRecentChangesCount()).toBe(1);
        expect(mockBuildService.invalidateBuild).toHaveBeenCalledTimes(1);
        done();
      }, 600);
    });
  });

  describe('startWatching and stopWatching', () => {
    it('should not start multiple watchers', () => {
      watchService.startWatching();
      const firstWatcher = (watchService as any).watcher;

      watchService.startWatching();
      const secondWatcher = (watchService as any).watcher;

      expect(firstWatcher).toBe(secondWatcher);
    });

    it('should handle stopWatching when not watching', async () => {
      // Should not throw
      await expect(watchService.stopWatching()).resolves.not.toThrow();
    });

    it('should clean up watcher on stop', async () => {
      watchService.startWatching();
      expect((watchService as any).watcher).not.toBeNull();

      await watchService.stopWatching();
      expect((watchService as any).watcher).toBeNull();
      expect(watchService.isWatchEnabled()).toBe(false);
    });
  });

  describe('AC-E54 (WU-13, C-20): chokidar options, cache keys, ignores and descriptions', () => {
    /** A chokidar spy: records the options, returns a watcher stub whose events the test fires. */
    function spyChokidar() {
      const handlers: Record<string, (p: string) => void> = {};
      const stub = {
        on(event: string, cb: (p: string) => void) {
          handlers[event] = cb;
          return stub;
        },
        close: async () => undefined,
      };
      const spy = jest.spyOn(chokidar, 'watch').mockImplementation((() => stub) as never);
      return { spy, handlers };
    }

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    it('AC-E54: a folder under /mnt/ is watched with usePolling: true, interval: 1000', async () => {
      const { spy } = spyChokidar();
      const w = new WatchService('/mnt/c/Users/u/Documents/Path of Building (PoE2)/Builds', mockBuildService);
      w.startWatching();
      expect(spy).toHaveBeenCalledTimes(1);
      const opts = spy.mock.calls[0][1] as Record<string, unknown>;
      expect(opts.usePolling).toBe(true);
      expect(opts.interval).toBe(1000);
      await w.stopWatching();
    });

    it('AC-E54: any other folder uses native events (no polling)', async () => {
      const { spy } = spyChokidar();
      const w = new WatchService('/home/u/builds', mockBuildService);
      w.startWatching();
      const opts = spy.mock.calls[0][1] as Record<string, unknown>;
      expect(opts.usePolling).toBeFalsy();
      expect(opts.interval).toBeUndefined();
      await w.stopWatching();
    });

    it('AC-E54: a change event for sub/inner.xml invalidates the cache key sub/inner.xml, not inner.xml', async () => {
      jest.useFakeTimers();
      const { handlers } = spyChokidar();
      const w = new WatchService('/home/u/builds', mockBuildService);
      w.startWatching();
      handlers.change('/home/u/builds/sub/inner.xml');
      jest.advanceTimersByTime(600);
      expect(mockBuildService.invalidateBuild).toHaveBeenCalledTimes(1);
      expect(mockBuildService.invalidateBuild).toHaveBeenCalledWith('sub/inner.xml');
      expect(mockBuildService.invalidateBuild).not.toHaveBeenCalledWith('inner.xml');
      expect(w.getRecentChanges()[0].file).toBe('sub/inner.xml');
      await w.stopWatching();
    });

    it('AC-E54: ~~temp~~.xml and dotfiles are ignored (chokidar ignored option and the event handler)', async () => {
      jest.useFakeTimers();
      const { spy, handlers } = spyChokidar();
      const w = new WatchService('/home/u/.local/builds', mockBuildService);
      w.startWatching();
      const ignored = (spy.mock.calls[0][1] as { ignored: (p: string) => boolean }).ignored;
      expect(ignored('/home/u/.local/builds/~~temp~~.xml')).toBe(true);
      expect(ignored('/home/u/.local/builds/sub/~~temp~~.xml')).toBe(true);
      expect(ignored('/home/u/.local/builds/.pob-mcp/x.xml')).toBe(true);
      expect(ignored('/home/u/.local/builds/.hidden.xml')).toBe(true);
      // A dot folder above the watched folder must not hide everything.
      expect(ignored('/home/u/.local/builds')).toBe(false);
      expect(ignored('/home/u/.local/builds/build.xml')).toBe(false);
      expect(ignored('/home/u/.local/builds/sub/inner.xml')).toBe(false);

      handlers.change('/home/u/.local/builds/~~temp~~.xml');
      handlers.add('/home/u/.local/builds/.hidden.xml');
      jest.advanceTimersByTime(600);
      expect(mockBuildService.invalidateBuild).not.toHaveBeenCalled();
      expect(w.getRecentChangesCount()).toBe(0);
      await w.stopWatching();
    });

    it("AC-E54: the watch tools' descriptions don't claim they reload the engine", () => {
      const names = ['start_watching', 'stop_watching', 'get_recent_changes', 'watch_status'];
      const schemas = getToolSchemas().filter((t) => names.includes(t.name));
      expect(schemas.map((t) => t.name).sort()).toEqual([...names].sort());
      for (const t of schemas) {
        expect(t.description).not.toMatch(/auto-?reload|automatically reload|will (now )?be (automatically )?reloaded/i);
      }
      const start = schemas.find((t) => t.name === 'start_watching')?.description ?? '';
      expect(start).toMatch(/does not reload the engine/i);
      expect(start).toMatch(/next engine call/i);
    });
  });
});
