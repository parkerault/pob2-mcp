/**
 * Build-file writer (C-17): every server write into `POB_DIRECTORY` goes through `writeBuildFile`.
 *
 * `writeBuildFile({name, bytes, overwrite, kind, ctx?})`, in order:
 *  1. **Path.** `canonicalBuildPath(<name>.xml, POB_DIRECTORY)` (D-52): the on-disk casing on a
 *     case-insensitive drive. Subfolders are allowed; a missing parent folder is created.
 *  2. **Existing target.** Replacing a file needs `overwrite: true` (`restore` and `text` imply it).
 *  3. **Changed-on-disk guard.** When the target is the engine's loaded file, its current bytes must
 *     match `loaded.fingerprint`; otherwise they must match this writer's record of its own last write
 *     to that path in this process, if any. A mismatch refuses the write. **No flag overrides this, and
 *     there are no exemptions.** A recorded file that no longer exists is created again, with a notice.
 *  4. **Backup.** Before replacing a file, copy it to `<stateDir>/backups/<relpath>/<id>_backup.xml`
 *     (`<id>_before-restore.xml` for `restore`). A backup failure aborts the write; the target is
 *     untouched.
 *  5. **Write.** `bytes` go to `<target>.pob2mcp-tmp` (not `.xml`, so PoB2 never lists it), which is
 *     then renamed over the target. On a failure the temp file is unlinked and nothing is recorded.
 *  6. **After.** Record the new fingerprint for the path and invalidate the build-parse cache entry
 *     (D-58). Only for `kind: 'engine'` (the bytes are the engine's current build) call
 *     `ctx.noteSaved(path, fp)`, which re-points the loaded build on a Save As (D-51d). Byte copies and
 *     text edits leave `loaded.fingerprint` alone, so the session's disk-change check (C-3 step 4)
 *     reloads the file (clean engine) or warns (dirty engine).
 *
 * Writes to one target are serialized (a per-path async lock around steps 2–6), because some callers
 * (`set_build_notes`, `restore_snapshot`) run outside the engine lock and the MCP SDK dispatches calls
 * concurrently: without it two writes would race on the shared temp name and on the step-3 check.
 *
 * A caller that must decide before an engine load whether a later write would be allowed
 * (`import_build save_as`) calls `checkBuildFile` first (steps 1–3, no write) and passes the returned
 * `guard` to `writeBuildFile`. The write then applies step 3 against the fingerprint taken at check time
 * (when the target was the loaded file, `loaded.fingerprint` before the load replaced it), so a PoB2 save
 * that lands between the check and the write is still refused.
 *
 * Errors are thrown as `BuildFileWriteError` (handlers fail by throwing; the router makes them `isError`).
 */
import crypto from "crypto";
import fsPromises from "fs/promises";
import path from "path";
import type { Fingerprint, LoadedBuild } from "../engine/session.js";
import { canonicalBuildPath } from "../utils/pathSanitizer.js";

/**
 * What the bytes are:
 * - `engine`: the engine's current build (`lua_save_build`, `import_build save_as`) → `noteSaved`;
 * - `bytes`: a byte copy (e.g. `export_build` into the builds folder);
 * - `restore`: `restore_snapshot` (implies overwrite; backup named `_before-restore`);
 * - `text`: a text edit of an existing build (`set_build_notes`; implies overwrite).
 */
export type BuildWriteKind = "engine" | "bytes" | "restore" | "text";

/** The filesystem calls the writer makes; injectable so a test can fake a case-insensitive or failing fs. */
export interface WriterFs {
  /** Entry names of a directory, in their on-disk casing (also used by `canonicalBuildPath`). */
  readdir(dir: string): Promise<string[]>;
  stat(file: string): Promise<{ size: number; mtimeMs: number }>;
  readFile(file: string): Promise<Buffer>;
  mkdir(dir: string, opts: { recursive: true }): Promise<unknown>;
  /** Copies without replacing: rejects with `EEXIST` when `dest` exists. */
  copyFileExclusive(src: string, dest: string): Promise<void>;
  writeFile(file: string, data: Buffer): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(file: string): Promise<void>;
}

export const nodeWriterFs: WriterFs = {
  readdir: (dir) => fsPromises.readdir(dir),
  stat: (file) => fsPromises.stat(file),
  readFile: (file) => fsPromises.readFile(file),
  mkdir: (dir, opts) => fsPromises.mkdir(dir, opts),
  copyFileExclusive: (src, dest) => fsPromises.copyFile(src, dest, fsPromises.constants.COPYFILE_EXCL),
  writeFile: (file, data) => fsPromises.writeFile(file, data),
  rename: (from, to) => fsPromises.rename(from, to),
  unlink: (file) => fsPromises.unlink(file),
};

/** The part of the running engine call's context (C-3) a write of the engine's build needs. */
export interface WriterEngineCtx {
  noteSaved(relPath: string, fp: Fingerprint): void;
}

export interface WriteBuildFileRequest {
  /** Build name relative to `POB_DIRECTORY`; `.xml` is appended when missing. */
  name: string;
  bytes: string | Buffer;
  overwrite?: boolean;
  kind: BuildWriteKind;
  /** Required for `kind: 'engine'`: the running engine call's context. */
  ctx?: WriterEngineCtx;
  /**
   * From `checkBuildFile` on the same target: apply the changed-on-disk guard (step 3) against the
   * fingerprint recorded at check time instead of the state at write time.
   */
  guard?: WriteGuard;
}

/** What `checkBuildFile` decided for a target: steps 1–3 passed at check time. */
export interface WriteGuard {
  /** Canonical POSIX path relative to `POB_DIRECTORY`. */
  path: string;
  /**
   * The fingerprint step 3 compares the file with: `loaded.fingerprint` when the target was the loaded
   * file, else the writer's record of its last write to it, else null (no guard).
   */
  reference: Fingerprint | null;
}

export interface WriteBuildFileResult {
  /** Canonical POSIX path relative to `POB_DIRECTORY`. */
  path: string;
  absPath: string;
  /** Bytes written. */
  bytes: number;
  /** An existing file was replaced. */
  replaced: boolean;
  /** Absolute path of the backup of the replaced file. */
  backupPath: string | null;
  fingerprint: Fingerprint;
  /** Extra lines for the tool's text (e.g. the target had vanished and was created again). */
  notices: string[];
  /** The tool's text: the relative path, the byte count and, on a replace, the PoB2 re-open hint. */
  message: string;
}

/** A refused or failed build-file write (C-17); the message is the user-facing text. */
export class BuildFileWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildFileWriteError";
  }
}

export interface BuildFileWriterOptions {
  pobDirectory: string;
  /** C-16: backups go to `<stateDir>/backups/`. */
  stateDir: string;
  /** The build the engine holds (C-3 `loaded`), or null when no engine runs. */
  loaded: () => LoadedBuild | null;
  /** Invalidate the build-parse cache entry of a written path (D-58). */
  onWritten?: (relPath: string) => void;
  fs?: WriterFs;
  now?: () => Date;
}

export const TEMP_SUFFIX = ".pob2mcp-tmp";
export const REOPEN_HINT = "If this build is open in PoB2, re-open it there to see the changes.";

function sha1(bytes: Buffer): string {
  return crypto.createHash("sha1").update(bytes).digest("hex");
}

function errnoOf(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code;
}

/** `CODE: message` for an OS error, else the message. */
function osError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = errnoOf(error);
  return code && !message.startsWith(code) ? `${code}: ${message}` : message;
}

/** The snapshot/backup id format (C-16): an ISO timestamp with `:` and `.` → `-`. */
export function timestampId(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export class BuildFileWriter {
  private readonly fs: WriterFs;
  private readonly now: () => Date;
  /** The fingerprint of this writer's last write to each absolute path (C-17 step 3). */
  private readonly written = new Map<string, Fingerprint>();
  /** The tail of each target's write queue (keyed case-insensitively: drvfs targets may differ in case). */
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly opts: BuildFileWriterOptions) {
    this.fs = opts.fs ?? nodeWriterFs;
    this.now = opts.now ?? (() => new Date());
  }

  /**
   * Steps 1–3 without writing: throws what `writeBuildFile` would throw for them, else returns the guard
   * to pass to a later `writeBuildFile` of the same target.
   */
  async checkBuildFile(req: Omit<WriteBuildFileRequest, "bytes" | "ctx" | "guard">): Promise<WriteGuard> {
    const { rel, target } = await this.resolve(req.name);
    return this.withTargetLock(target, async () => {
      const current = await this.read(target);
      this.checkExisting(rel, current, req);
      const reference = this.reference(rel, target);
      this.checkUnchanged(rel, current, reference);
      return { path: rel, reference };
    });
  }

  async writeBuildFile(req: WriteBuildFileRequest): Promise<WriteBuildFileResult> {
    if (req.kind === "engine" && !req.ctx) {
      throw new BuildFileWriteError("internal error: a write of the engine's build needs the engine call's context");
    }
    const bytes = Buffer.isBuffer(req.bytes) ? req.bytes : Buffer.from(req.bytes, "utf8");

    // 1. Path.
    const { rel, target } = await this.resolve(req.name);
    if (req.guard && req.guard.path !== rel) {
      throw new BuildFileWriteError(`internal error: the write guard is for ${req.guard.path}, not ${rel}`);
    }
    return this.withTargetLock(target, () => this.writeLocked(req, rel, target, bytes));
  }

  private async writeLocked(req: WriteBuildFileRequest, rel: string, target: string, bytes: Buffer): Promise<WriteBuildFileResult> {
    // 2. Existing target.
    const current = await this.read(target);
    this.checkExisting(rel, current, req);

    // 3. Changed-on-disk guard.
    const reference = req.guard ? req.guard.reference : this.reference(rel, target);
    const notices = this.checkUnchanged(rel, current, reference);

    // 4. Backup.
    let backupPath: string | null = null;
    if (current) {
      try {
        backupPath = await this.backup(rel, target, req.kind === "restore" ? "before-restore" : "backup");
      } catch (error) {
        throw new BuildFileWriteError(`could not back up ${rel} before replacing it, so it was not written: ${osError(error)}`);
      }
    }

    // 5. Write: temp file in the same directory, then rename over the target.
    const temp = `${target}${TEMP_SUFFIX}`;
    let renamed = false;
    try {
      await this.fs.mkdir(path.dirname(target), { recursive: true });
      await this.fs.writeFile(temp, bytes);
      await this.fs.rename(temp, target);
      renamed = true;
    } catch (error) {
      throw new BuildFileWriteError(
        `could not write ${rel} (${target}): ${osError(error)}.` +
          (backupPath ? ` The previous file is backed up at ${backupPath}.` : ""),
      );
    } finally {
      if (!renamed) await this.fs.unlink(temp).catch(() => undefined);
    }

    // 6. After the write.
    const st = await this.fs.stat(target);
    const fingerprint: Fingerprint = { size: bytes.length, mtimeMs: st.mtimeMs, sha1: sha1(bytes) };
    this.written.set(target, fingerprint);
    try {
      this.opts.onWritten?.(rel);
    } catch (error) {
      console.error(`[Build File Writer] cache invalidation for ${rel} failed: ${osError(error)}`);
    }
    if (req.kind === "engine") req.ctx!.noteSaved(rel, fingerprint);

    const message = `Saved ${rel} (${bytes.length} bytes).` + (current ? ` ${REOPEN_HINT}` : "");
    return { path: rel, absPath: target, bytes: bytes.length, replaced: current !== null, backupPath, fingerprint, notices, message };
  }

  /** Step 1: the canonical relative path (D-52) and the absolute target. */
  private async resolve(rawName: string): Promise<{ rel: string; target: string }> {
    const base = path.resolve(this.opts.pobDirectory);
    const name = rawName?.trim();
    if (!name) throw new BuildFileWriteError("build_name is required");
    const rel = await canonicalBuildPath(name, base, { readdir: (dir) => this.fs.readdir(dir) });
    return { rel, target: path.join(base, ...rel.split("/")) };
  }

  /** Step 2: replacing a file needs `overwrite: true` (`restore` and `text` imply it). */
  private checkExisting(rel: string, current: { bytes: Buffer } | null, req: { overwrite?: boolean; kind: BuildWriteKind }): void {
    const overwrite = req.overwrite === true || req.kind === "restore" || req.kind === "text";
    if (current && !overwrite) {
      throw new BuildFileWriteError(`${rel} already exists; pass overwrite: true to replace it (a backup is kept).`);
    }
  }

  /** Step 3's reference: `loaded.fingerprint` for the loaded file, else this writer's last write, if any. */
  private reference(rel: string, target: string): Fingerprint | null {
    const loaded = this.opts.loaded();
    return loaded && loaded.path === rel ? loaded.fingerprint : (this.written.get(target) ?? null);
  }

  /** Step 3: refuse when the file changed since `reference`; returns the notices for the write. */
  private checkUnchanged(rel: string, current: { bytes: Buffer } | null, reference: Fingerprint | null): string[] {
    const notices: string[] = [];
    if (reference) {
      if (!current) {
        notices.push(`${rel} no longer existed on disk; created it again.`);
      } else if (current.bytes.length !== reference.size || sha1(current.bytes) !== reference.sha1) {
        throw new BuildFileWriteError(
          `${rel} changed on disk since the engine loaded or saved it (probably saved in PoB2). ` +
            `Reload it first (lua_reload_build) or save under a new name.`,
        );
      }
    }
    return notices;
  }

  /** Run `fn` after every earlier queued operation on `target` has settled (a per-path async mutex). */
  private async withTargetLock<T>(target: string, fn: () => Promise<T>): Promise<T> {
    const key = target.toLowerCase();
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => mine);
    this.queues.set(key, tail);
    try {
      await previous;
      return await fn();
    } finally {
      release();
      if (this.queues.get(key) === tail) this.queues.delete(key);
    }
  }

  /** The target's bytes, or null when it doesn't exist. */
  private async read(file: string): Promise<{ bytes: Buffer } | null> {
    try {
      return { bytes: await this.fs.readFile(file) };
    } catch (error) {
      if (errnoOf(error) === "ENOENT") return null;
      throw new BuildFileWriteError(`could not read ${file}: ${osError(error)}`);
    }
  }

  /** Copy the target to `<stateDir>/backups/<rel>/<id>_<label>.xml`, never replacing an earlier backup. */
  private async backup(rel: string, target: string, label: string): Promise<string> {
    const dir = path.join(this.opts.stateDir, "backups", ...rel.split("/"));
    await this.fs.mkdir(dir, { recursive: true });
    const id = timestampId(this.now());
    for (let n = 0; ; n += 1) {
      const dest = path.join(dir, `${id}${n === 0 ? "" : `-${n}`}_${label}.xml`);
      try {
        await this.fs.copyFileExclusive(target, dest);
        return dest;
      } catch (error) {
        if (errnoOf(error) !== "EEXIST" || n >= 100) throw error;
      }
    }
  }
}
