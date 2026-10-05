import fs from "fs/promises";
import path from "path";
import type { SnapshotMetadata } from "../types.js";
import type { BuildService } from "./buildService.js";
import { timestampId, type BuildFileWriter } from "./buildFileWriter.js";
import { canonicalBuildPath, sanitizeBuildName } from "../utils/pathSanitizer.js";

export interface SnapshotOptions {
  buildName: string;
  description?: string;
  tag?: string;
}

export interface RestoreOptions {
  buildName: string;
  snapshotId: string;
}

/** Where an export goes (D-42): inside the builds folder (through C-17) or inside the state dir. */
export interface ExportTarget {
  area: "builds" | "state";
  /** Absolute target folder. */
  dir: string;
}

export interface WriteExportOptions {
  /** The caller's output name; `.xml` is optional. A plain file name, never a path. */
  outputName: string;
  /** D-42: inside the builds folder or the state dir; default `<stateDir>/exports`. */
  outputDirectory?: string;
  overwrite?: boolean;
  bytes: Buffer;
}

export interface WriteExportResult {
  /** Absolute path written. */
  filePath: string;
  /** The tool's text for the write (C-17's message for a write into the builds folder). */
  message: string;
}

/** A refusal of `export_build` (D-42 confinement, a bad output name, an existing file). */
export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportError";
  }
}

function errnoOf(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code;
}

/** `target` is inside `base` (or equal to it). */
function isInside(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** The real path of `p`, or of its deepest existing ancestor joined with the rest (symlinks resolved). */
async function realPathOf(p: string): Promise<string> {
  const rest: string[] = [];
  let current = path.resolve(p);
  for (;;) {
    try {
      const real = await fs.realpath(current);
      return rest.length ? path.join(real, ...rest.reverse()) : real;
    } catch (error) {
      if (errnoOf(error) !== "ENOENT" && errnoOf(error) !== "ENOTDIR") throw error;
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(p);
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

/** State-dir subtrees the server owns, which `export_build` may not write into (D-88). */
const RESERVED_STATE_SUBDIRS = ["backups", "snapshots"] as const;

const NOTES_RE = /<Notes\s*>([\s\S]*?)<\/Notes\s*>|<Notes\s*\/>/;

/** XML text escaping for a notes body. */
export function escapeNotes(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The build XML with its `<Notes>` body replaced by `escapedBody` (already XML-escaped). A build
 * without a `<Notes>` element gets one before its closing root tag (`</PathOfBuilding2>`).
 */
export function replaceNotesXml(xml: string, escapedBody: string): string {
  // Function replacers: a `$` in the notes must never be read as a replacement pattern.
  if (NOTES_RE.test(xml)) return xml.replace(NOTES_RE, () => `<Notes>${escapedBody}</Notes>`);
  const close = /<\/(PathOfBuilding2?)\s*>\s*$/;
  if (!close.test(xml)) throw new Error("the build file has no <PathOfBuilding2> root to add notes to");
  return xml.replace(close, (_m, root: string) => `\t<Notes>${escapedBody}</Notes>\n</${root}>\n`);
}

/**
 * The build XML with `notes` appended to its existing notes (separated by a `---` rule), or as the
 * notes when the build has none (whitespace-only notes count as none).
 */
export function appendNotesXml(xml: string, notes: string): string {
  const m = NOTES_RE.exec(xml);
  const existing = m && m[1] !== undefined ? m[1] : "";
  const body = existing.trim() ? `${existing.replace(/\s+$/, "")}\n\n---\n\n${escapeNotes(notes)}` : escapeNotes(notes);
  return replaceNotesXml(xml, body);
}

/**
 * Snapshots, exports and restores. Server state lives in the state dir (C-16, D-18), never in the
 * builds folder, which PoB2's build browser lists in full:
 * - `<stateDir>/snapshots/<build relpath>/`: `snapshot_build` output (`<id>_<tag>.xml` byte copy +
 *   `<id>_metadata.json`), keyed by the canonical build path (D-52);
 * - `<stateDir>/exports/`: `export_build`'s default output folder;
 * - `<stateDir>/backups/<build relpath>/`: the build-file writer's backups (C-17), including the
 *   `<id>_before-restore.xml` copy `restore_snapshot` takes.
 * Every write into the builds folder (a restore, an export there) goes through the build-file writer.
 */
export class BuildExportService {
  private pobDirectory: string;
  private stateDir: string;
  private snapshotDirectory: string;
  private exportDirectory: string;
  private writer: Pick<BuildFileWriter, "writeBuildFile">;

  constructor(pobDirectory: string, stateDir: string, writer: Pick<BuildFileWriter, "writeBuildFile">) {
    this.pobDirectory = path.resolve(pobDirectory);
    this.stateDir = path.resolve(stateDir);
    this.snapshotDirectory = path.join(this.stateDir, "snapshots");
    this.exportDirectory = path.join(this.stateDir, "exports");
    this.writer = writer;
  }

  /** `export_build`'s default output folder (C-16). */
  getExportDirectory(): string {
    return this.exportDirectory;
  }

  /**
   * D-42: `output_directory` must resolve inside the builds folder or the state dir (a relative path
   * is taken inside the builds folder); symlinks are resolved before the check. Default:
   * `<stateDir>/exports`. The server's own `<stateDir>/backups/` and `<stateDir>/snapshots/` subtrees
   * are refused (D-88): an export there could replace a writer backup or a snapshot copy.
   */
  async resolveExportTarget(outputDirectory?: string): Promise<ExportTarget> {
    if (outputDirectory === undefined || outputDirectory.trim() === "") {
      return { area: "state", dir: this.exportDirectory };
    }
    if (outputDirectory.includes("\0")) throw new ExportError("output_directory contains a null byte");
    const dir = path.resolve(this.pobDirectory, outputDirectory.trim());
    const realDir = await realPathOf(dir);
    const realBuilds = await realPathOf(this.pobDirectory);
    const realState = await realPathOf(this.stateDir);
    for (const sub of RESERVED_STATE_SUBDIRS) {
      const reserved = path.join(this.stateDir, sub);
      const realReserved = path.join(realState, sub);
      if (isInside(reserved, dir) || isInside(realReserved, realDir) || isInside(await realPathOf(reserved), realDir)) {
        throw new ExportError(
          `output_directory ${outputDirectory} is inside the server's ${sub} folder (${reserved}), which holds its own ` +
            `${sub === "backups" ? "build-file backups" : "build snapshots"}; exports may not be written there. ` +
            `Omit output_directory to use ${this.exportDirectory}.`,
        );
      }
    }
    // The builds folder first: a write there must go through the build-file writer (C-17).
    if (isInside(this.pobDirectory, dir) && isInside(realBuilds, realDir)) return { area: "builds", dir };
    if (isInside(this.stateDir, dir) && isInside(realState, realDir)) return { area: "state", dir };
    throw new ExportError(
      `output_directory ${outputDirectory} is outside the builds folder (${this.pobDirectory}) and the server's ` +
        `state folder (${this.stateDir}); exports may only be written inside one of them. Omit it to use ${this.exportDirectory}.`,
    );
  }

  /** The output file name: a plain name, `.xml` appended when missing. */
  static outputFileName(outputName: string): string {
    const name = (outputName ?? "").trim();
    if (!name) throw new ExportError("output_name is required");
    if (/[\\/\0]/.test(name) || name === "." || name === "..") {
      throw new ExportError(`output_name must be a plain file name, not a path: ${outputName}`);
    }
    return /\.xml$/i.test(name) ? name : `${name}.xml`;
  }

  /**
   * Write an export (D-42): into the builds folder through the build-file writer (C-17: overwrite,
   * guard, backup, temp + rename), or into the state dir with the same overwrite rule.
   */
  async writeExport(options: WriteExportOptions): Promise<WriteExportResult> {
    const fileName = BuildExportService.outputFileName(options.outputName);
    const target = await this.resolveExportTarget(options.outputDirectory);
    const filePath = path.join(target.dir, fileName);

    if (target.area === "builds") {
      const rel = path.relative(this.pobDirectory, filePath).split(path.sep).join("/");
      const result = await this.writer.writeBuildFile({
        name: rel,
        bytes: options.bytes,
        overwrite: options.overwrite === true,
        kind: "bytes",
      });
      return { filePath: result.absPath, message: [...result.notices, result.message].join("\n") };
    }

    let replaced = false;
    try {
      await fs.stat(filePath);
      replaced = true;
    } catch (error) {
      if (errnoOf(error) !== "ENOENT") throw error;
    }
    if (replaced && options.overwrite !== true) {
      throw new ExportError(`${filePath} already exists; pass overwrite: true to replace it.`);
    }
    await fs.mkdir(target.dir, { recursive: true });
    const temp = `${filePath}.pob2mcp-tmp`;
    let renamed = false;
    try {
      await fs.writeFile(temp, options.bytes);
      await fs.rename(temp, filePath);
      renamed = true;
    } finally {
      if (!renamed) await fs.unlink(temp).catch(() => undefined);
    }
    return { filePath, message: `Exported to ${filePath} (${options.bytes.length} bytes).` };
  }

  /** The snapshot folder of a build: `<stateDir>/snapshots/<canonical relpath>/` (C-16, D-52). */
  private async snapshotDirFor(buildName: string): Promise<{ rel: string; dir: string }> {
    const rel = await canonicalBuildPath(buildName, this.pobDirectory);
    return { rel, dir: sanitizeBuildName(rel, this.snapshotDirectory) };
  }

  /**
   * Create a versioned snapshot of a build file: a byte copy plus metadata, in the state dir.
   */
  async snapshotBuild(
    buildService: Pick<BuildService, "readBuildFile" | "readBuild" | "parseAllocatedNodes">,
    options: SnapshotOptions,
  ): Promise<{ snapshotId: string; snapshotPath: string; buildPath: string }> {
    const source = await buildService.readBuildFile(options.buildName);
    const { dir } = await this.snapshotDirFor(source.rel);
    await fs.mkdir(dir, { recursive: true });

    const tag = options.tag || "snapshot";
    const timestamp = new Date();
    // Snapshots are written once: a second snapshot within the same millisecond gets a suffix.
    const base = timestampId(timestamp);
    let snapshotId = base;
    for (let n = 1; ; n += 1) {
      try {
        await fs.stat(path.join(dir, `${snapshotId}_metadata.json`));
      } catch (error) {
        if (errnoOf(error) === "ENOENT") break;
        throw error;
      }
      snapshotId = `${base}-${n}`;
    }

    const snapshotPath = path.join(dir, `${snapshotId}_${this.sanitizeFileName(tag)}.xml`);
    await fs.writeFile(snapshotPath, source.bytes, { flag: "wx" });

    const build = await buildService.readBuild(source.rel);
    const nodes = buildService.parseAllocatedNodes(build);
    const metadata: SnapshotMetadata = {
      timestamp: timestamp.toISOString(),
      originalBuild: source.rel,
      description: options.description || "",
      tag,
      statsSnapshot: {
        life: this.extractStat(build, "Life"),
        dps: this.extractStat(build, "TotalDPS"),
        allocatedNodes: nodes.length,
      },
    };
    await fs.writeFile(path.join(dir, `${snapshotId}_metadata.json`), JSON.stringify(metadata, null, 2), {
      encoding: "utf-8",
      flag: "wx",
    });

    return { snapshotId, snapshotPath, buildPath: source.rel };
  }

  /**
   * List all snapshots for a build
   */
  async listSnapshots(
    buildName: string,
    options: { limit?: number; tagFilter?: string } = {}
  ): Promise<{
    build: string;
    snapshots: Array<{ id: string; metadata: SnapshotMetadata; filePath: string }>;
    total: number;
    diskSpace: number;
  }> {
    const { rel, dir } = await this.snapshotDirFor(buildName);

    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (error) {
      if (errnoOf(error) === "ENOENT") return { build: rel, snapshots: [], total: 0, diskSpace: 0 };
      throw error;
    }
    const metadataFiles = entries.filter((name) => name.endsWith("_metadata.json"));

    let snapshots: Array<{ id: string; metadata: SnapshotMetadata; filePath: string }> = [];
    let totalSize = 0;

    for (const file of metadataFiles) {
      const metadata: SnapshotMetadata = JSON.parse(await fs.readFile(path.join(dir, file), "utf-8"));

      // Apply tag filter if provided
      if (options.tagFilter && metadata.tag !== options.tagFilter) {
        continue;
      }

      const snapshotId = file.replace(/_metadata\.json$/, "");
      const xmlFilePath = path.join(dir, `${snapshotId}_${this.sanitizeFileName(metadata.tag)}.xml`);
      try {
        totalSize += (await fs.stat(xmlFilePath)).size;
      } catch {
        // The copy is gone: skip the entry.
        continue;
      }
      snapshots.push({ id: snapshotId, metadata, filePath: xmlFilePath });
    }

    // Newest first
    snapshots.sort(
      (a, b) =>
        new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime() ||
        b.id.localeCompare(a.id),
    );

    const total = snapshots.length;
    if (options.limit && options.limit > 0) {
      snapshots = snapshots.slice(0, options.limit);
    }

    return { build: rel, snapshots, total, diskSpace: totalSize };
  }

  /**
   * Restore a build file from a snapshot (by id, or by tag: the newest with that tag), through the
   * build-file writer (C-17, `kind: 'restore'`): it always backs up the current file to
   * `<stateDir>/backups/<relpath>/<id>_before-restore.xml` (D-51b) and refuses when the file changed on
   * disk since the engine loaded or saved it.
   */
  async restoreSnapshot(options: RestoreOptions): Promise<{
    build: string;
    snapshotId: string;
    tag: string;
    bytes: number;
    backupPath: string | null;
    message: string;
  }> {
    const { build, snapshots } = await this.listSnapshots(options.buildName);
    const snapshot =
      snapshots.find((s) => s.id === options.snapshotId) ?? snapshots.find((s) => s.metadata.tag === options.snapshotId);
    if (!snapshot) {
      throw new Error(
        `Snapshot not found for ${build}: ${options.snapshotId}. ` +
          (snapshots.length
            ? `Available snapshots: ${snapshots.map((s) => `${s.id} [${s.metadata.tag}]`).join(", ")}`
            : "This build has no snapshots."),
      );
    }

    const bytes = await fs.readFile(snapshot.filePath);
    const result = await this.writer.writeBuildFile({ name: build, bytes, overwrite: true, kind: "restore" });
    return {
      build: result.path,
      snapshotId: snapshot.id,
      tag: snapshot.metadata.tag,
      bytes: result.bytes,
      backupPath: result.backupPath,
      message: [...result.notices, result.message].join("\n"),
    };
  }

  /**
   * Sanitize filename by removing invalid characters
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
  }

  /**
   * Extract a stat value from build data
   */
  private extractStat(build: Awaited<ReturnType<BuildService["readBuild"]>>, statName: string): number {
    if (!build.Build?.PlayerStat) {
      return 0;
    }

    const stats = Array.isArray(build.Build.PlayerStat)
      ? build.Build.PlayerStat
      : [build.Build.PlayerStat];

    const stat = stats.find(s => s.stat === statName);
    return stat ? parseFloat(stat.value) : 0;
  }

  /**
   * Format snapshot list for display
   */
  formatSnapshotList(result: {
    snapshots: Array<{ id: string; metadata: SnapshotMetadata; filePath: string }>;
    total: number;
    diskSpace: number;
  }): string {
    if (result.snapshots.length === 0) {
      return "No snapshots found for this build.";
    }

    let output = `=== Snapshots (Showing ${result.snapshots.length} of ${result.total}) ===\n\n`;

    for (let i = 0; i < result.snapshots.length; i++) {
      const { id, metadata } = result.snapshots[i];
      const date = new Date(metadata.timestamp);
      const formattedDate = date.toLocaleString();

      output += `${i + 1}. ${formattedDate}`;
      if (metadata.tag) {
        output += ` [${metadata.tag}]`;
      }
      output += '\n';

      if (metadata.description) {
        output += `   Description: ${metadata.description}\n`;
      }

      if (metadata.statsSnapshot) {
        const stats = metadata.statsSnapshot;
        output += `   Stats: Life: ${stats.life?.toLocaleString() || 'N/A'} | `;
        output += `DPS: ${stats.dps?.toLocaleString() || 'N/A'} | `;
        output += `Nodes: ${stats.allocatedNodes || 'N/A'}\n`;
      }

      output += `   ID: ${id}\n\n`;
    }

    const sizeInMB = (result.diskSpace / (1024 * 1024)).toFixed(2);
    output += `Total: ${result.total} snapshots | Disk space: ${sizeInMB} MB\n`;

    return output;
  }
}
