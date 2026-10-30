/**
 * Build-file writer (C-17): every server write into `POB_DIRECTORY` goes through `writeBuildFile`.
 *
 * `writeBuildFile({name, bytes, overwrite, kind, ctx?})`, in order:
 *  1. **Path.** `canonicalBuildPath(<name>.xml, POB_DIRECTORY)` (D-52): the on-disk casing on a
 *     case-insensitive drive. Subfolders are allowed; a missing parent folder is created.
 *  2. **Existing target.** Replacing a file needs `overwrite: true` (`restore` and `text` imply it).
 *  3. **Changed-on-disk guard.** When the target is the engine's loaded file, its current bytes must
 *     match `loaded.fingerprint`; otherwise they must match the last fingerprint this process knows for
 *     that path, if any: this writer's own last write to it, or the engine's last load or save of it
 *     while it was the loaded file (`noteEngineFingerprint`, the last `ENGINE_KNOWN_MAX` paths), whichever
 *     came later (D-86). A mismatch refuses the write. **No flag overrides this, and
 *     there are no exemptions.** A recorded file that no longer exists is created again, with a notice.
 *     A byte copy, restore or text edit of the loaded file also accepts this writer's own last write to
 *     it: the server's own earlier edit (which leaves `loaded.fingerprint` alone, step 6) is not a PoB2
 *     save. An engine save still compares with `loaded.fingerprint` only, so it never clobbers that edit.
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
 * `guard` to `writeBuildFile`. The write then applies step 3 against the fingerprints taken at check time
 * (when the target was the loaded file, `loaded.fingerprint` before the load replaced it), so a PoB2 save
 * that lands between the check and the write is still refused.
 *
 * `deleteBuildFile({name, sha1?})` (D-466, the draft mode's `remove_draft`) removes a file under the same
 * per-path lock: the path as step 1 resolves it; the file must exist, match `sha1` when given (the write
 * ledger's) and pass step 3's changed-on-disk guard; it is copied to `<stateDir>/backups/<relpath>/<id>_before-delete.xml`
 * first (a backup failure leaves it in place), then unlinked, and the writer forgets its fingerprints.
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
   * The fingerprints step 3 accepts the file's bytes against (see `BuildFileWriter.references`); empty
   * means no guard.
   */
  references: Fingerprint[];
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

export interface DeleteBuildFileRequest {
  /** Build name relative to `POB_DIRECTORY`; `.xml` is appended when missing. */
  name: string;
  /** The sha1 the file's bytes must have (the write ledger's, D-466); any other refuses the delete. */
  sha1?: string;
}

export interface DeleteBuildFileResult {
  /** Canonical POSIX path relative to `POB_DIRECTORY`. */
  path: string;
  absPath: string;
  /** The deleted file's size. */
  bytes: number;
  /** Absolute path of the backup taken before the delete. */
  backupPath: string;
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
/** How many files' engine fingerprints the writer remembers after the engine switched away (D-86). */
export const ENGINE_KNOWN_MAX = 32;
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
  /** The fingerprint of this writer's last write to each absolute path (C-17 step 3), with its sequence. */
  private readonly written = new Map<string, { fp: Fingerprint; seq: number }>();
  /**
   * The engine's last load or save fingerprint of each absolute path, least recently noted first,
   * at most `ENGINE_KNOWN_MAX` entries (D-86).
   */
  private readonly engineKnown = new Map<string, { fp: Fingerprint; seq: number }>();
  /** Orders `written` against `engineKnown`: the later record of a path is its last known state. */
  private seq = 0;
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
      const references = this.references(rel, target, req.kind);
      this.checkUnchanged(rel, current, references);
      return { path: rel, references };
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
    const references = req.guard ? req.guard.references : this.references(rel, target, req.kind);
    const notices = this.checkUnchanged(rel, current, references);

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
    this.written.set(target, { fp: fingerprint, seq: ++this.seq });
    try {
      this.opts.onWritten?.(rel);
    } catch (error) {
      console.error(`[Build File Writer] cache invalidation for ${rel} failed: ${osError(error)}`);
    }
    if (req.kind === "engine") req.ctx!.noteSaved(rel, fingerprint);

    const message = `Saved ${rel} (${bytes.length} bytes).` + (current ? ` ${REOPEN_HINT}` : "");
    return { path: rel, absPath: target, bytes: bytes.length, replaced: current !== null, backupPath, fingerprint, notices, message };
  }

  /**
   * D-466: delete a build file, backed up first (`_before-delete`). Refused when the file is missing, when its bytes
   * don't hash to `req.sha1`, or when step 3's guard finds it changed since this process last knew it.
   */
  async deleteBuildFile(req: DeleteBuildFileRequest): Promise<DeleteBuildFileResult> {
    const { rel, target } = await this.resolve(req.name);
    return this.withTargetLock(target, async () => {
      const current = await this.read(target);
      if (!current) throw new BuildFileWriteError(`${rel} doesn't exist, so it was not deleted.`);
      if (req.sha1 !== undefined && sha1(current.bytes) !== req.sha1) {
        throw new BuildFileWriteError(
          `${rel} changed on disk since it was written (probably saved in PoB2), so it was not deleted.`,
        );
      }
      this.checkUnchanged(rel, current, this.references(rel, target, "bytes"));
      let backupPath: string;
      try {
        backupPath = await this.backup(rel, target, "before-delete");
      } catch (error) {
        throw new BuildFileWriteError(`could not back up ${rel} before deleting it, so it was not deleted: ${osError(error)}`);
      }
      try {
        await this.fs.unlink(target);
      } catch (error) {
        throw new BuildFileWriteError(`could not delete ${rel} (${target}): ${osError(error)}. It is backed up at ${backupPath}.`);
      }
      this.written.delete(target);
      this.engineKnown.delete(target);
      try {
        this.opts.onWritten?.(rel);
      } catch (error) {
        console.error(`[Build File Writer] cache invalidation for ${rel} failed: ${osError(error)}`);
      }
      return { path: rel, absPath: target, bytes: current.bytes.length, backupPath };
    });
  }

  /**
   * The engine loaded, reloaded or saved `relPath` (canonical, relative to `POB_DIRECTORY`) with these
   * bytes (session `onFileFingerprint`). Kept after the engine switches to another build, so an overwrite
   * of this path stays guarded against a PoB2 save made since (FR-E4, D-86).
   */
  noteEngineFingerprint(relPath: string, fp: Fingerprint): void {
    const target = path.join(path.resolve(this.opts.pobDirectory), ...relPath.split("/"));
    this.engineKnown.delete(target);
    this.engineKnown.set(target, { fp, seq: ++this.seq });
    while (this.engineKnown.size > ENGINE_KNOWN_MAX) {
      this.engineKnown.delete(this.engineKnown.keys().next().value as string);
    }
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

  /**
   * Step 3's references, the fingerprints the file's current bytes may match (empty: no guard):
   * - the loaded file: `loaded.fingerprint`, plus, for a write that is not the engine's build
   *   (`bytes`, `restore`, `text`), this writer's own last write to it. The server's own earlier text
   *   edit or restore is not a PoB2 save, and it leaves `loaded.fingerprint` alone (step 6), so without
   *   this a second edit before the next engine call (or while the engine is dirty) would be refused.
   *   An engine save compares with `loaded.fingerprint` only: it must not overwrite that edit;
   * - any other file: its last known state, if any: this writer's last write to it or the engine's last
   *   load or save of it (an earlier loaded file, D-86), whichever came later.
   */
  private references(rel: string, target: string, kind: BuildWriteKind): Fingerprint[] {
    const loaded = this.opts.loaded();
    const own = this.written.get(target) ?? null;
    if (loaded && loaded.path === rel) {
      if (!loaded.fingerprint) return [];
      return kind !== "engine" && own ? [loaded.fingerprint, own.fp] : [loaded.fingerprint];
    }
    const engine = this.engineKnown.get(target) ?? null;
    const last = own && engine ? (own.seq > engine.seq ? own : engine) : (own ?? engine);
    return last ? [last.fp] : [];
  }

  /** Step 3: refuse when the file matches none of `references`; returns the notices for the write. */
  private checkUnchanged(rel: string, current: { bytes: Buffer } | null, references: Fingerprint[]): string[] {
    const notices: string[] = [];
    if (references.length > 0) {
      const hash = current ? sha1(current.bytes) : null;
      if (!current) {
        notices.push(`${rel} no longer existed on disk; created it again.`);
      } else if (!references.some((r) => current.bytes.length === r.size && hash === r.sha1)) {
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
