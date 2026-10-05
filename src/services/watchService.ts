import chokidar from "chokidar";
import path from "path";
import type { BuildService } from "./buildService.js";

interface RecentChange {
  /** POSIX path relative to the builds folder (D-52), e.g. `sub/inner.xml`. */
  file: string;
  timestamp: number;
  type: string;
}

/** The watched folder needs polling: inotify doesn't see Windows-side writes on drvfs (D-43, WSL #4739). */
export function needsPolling(dir: string): boolean {
  return dir.startsWith("/mnt/");
}

/**
 * The build watcher (C-20). It tracks recent changes to `.xml` builds under the builds folder
 * (subfolders included) and invalidates the build-parse cache by relative path (D-58).
 *
 * It does **not** reload the engine: the engine session checks the loaded file on every engine call
 * and reloads or warns there (C-3 step 4), whether or not watching is on.
 *
 * chokidar options: `usePolling: true, interval: 1000` when the folder is under `/mnt/` (D-43),
 * otherwise native events; dotfiles, dot-folders and PoB's `~~temp~~` files are ignored.
 */
export class WatchService {
  private watcher: ReturnType<typeof chokidar.watch> | null = null;
  private pobDirectory: string;
  private recentChanges: RecentChange[] = [];
  private watchEnabled: boolean = false;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private buildService: BuildService;

  constructor(pobDirectory: string, buildService: BuildService) {
    this.pobDirectory = pobDirectory;
    this.buildService = buildService;
  }

  /** chokidar's `ignored`: dot entries and `~~temp~~` files below the watched folder (never the folder itself). */
  private ignored = (filePath: string): boolean => {
    const rel = path.relative(this.pobDirectory, filePath);
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return false;
    return rel.split(/[\\/]/).some((segment) => segment.startsWith(".") || segment.includes("~~temp~~"));
  };

  startWatching(): void {
    if (this.watcher) {
      console.error("[File Watcher] Already watching directory");
      return;
    }

    const polling = needsPolling(this.pobDirectory);
    console.error(`[File Watcher] Starting to watch: ${this.pobDirectory}${polling ? " (polling every 1 s)" : ""}`);

    this.watcher = chokidar.watch(this.pobDirectory, {
      ignored: this.ignored,
      persistent: true,
      ignoreInitial: true, // don't trigger for existing files
      ...(polling ? { usePolling: true, interval: 1000 } : {}),
      awaitWriteFinish: {
        stabilityThreshold: 500, // wait for file writes to finish
        pollInterval: 100
      }
    });

    this.watcher
      .on("add", (filePath: string) => this.handleFileChange(filePath, "added"))
      .on("change", (filePath: string) => this.handleFileChange(filePath, "modified"))
      .on("unlink", (filePath: string) => this.handleFileChange(filePath, "deleted"))
      .on("error", (error: unknown) => console.error("[File Watcher] Error:", error));

    this.watchEnabled = true;
  }

  async stopWatching(): Promise<void> {
    if (this.watcher) {
      console.error("[File Watcher] Stopping watch");
      await this.watcher.close();
      this.watcher = null;
      this.watchEnabled = false;
    }
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
  }

  /** The POSIX path of a watched file relative to the builds folder, or null outside it. */
  private relativePath(filePath: string): string | null {
    const rel = path.isAbsolute(filePath) ? path.relative(this.pobDirectory, filePath) : filePath;
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return rel.split(/[\\/]/).join("/");
  }

  private handleFileChange(filePath: string, changeType: string): void {
    const rel = this.relativePath(filePath);
    // Only .xml builds; never PoB's ~~temp~~ autosave or dot entries.
    if (!rel || !rel.toLowerCase().endsWith(".xml") || this.ignored(path.join(this.pobDirectory, rel))) {
      return;
    }

    // Clear any existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(rel);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer (500ms)
    const timer = setTimeout(() => {
      this.processFileChange(rel, changeType);
      this.debounceTimers.delete(rel);
    }, 500);

    this.debounceTimers.set(rel, timer);
  }

  private processFileChange(relPath: string, changeType: string): void {
    console.error(`[File Watcher] Build ${changeType}: ${relPath}`);

    // Invalidate the parse cache by relative path (D-58), not by basename. chokidar reports the
    // on-disk names, which is the canonical casing (D-52).
    this.buildService.invalidateBuild(relPath);

    // Track recent change
    this.recentChanges.push({
      file: relPath,
      timestamp: Date.now(),
      type: changeType
    });

    // Keep only last 50 changes
    if (this.recentChanges.length > 50) {
      this.recentChanges = this.recentChanges.slice(-50);
    }
  }

  isWatchEnabled(): boolean {
    return this.watchEnabled;
  }

  getRecentChanges(limit?: number): RecentChange[] {
    const maxChanges = limit || 10;
    return this.recentChanges.slice(-maxChanges).reverse();
  }

  getDirectory(): string {
    return this.pobDirectory;
  }

  getRecentChangesCount(): number {
    return this.recentChanges.length;
  }
}
