/**
 * The guides folder (C-34): its default, the resolve-and-contain rule for a path given relative to it,
 * and run-folder creation (D-153, D-207).
 *
 * Every function takes the root as an argument and reads no env: only `src/index.ts` reads
 * `POB_GUIDES_DIRECTORY` (C-7), and it takes the default from here.
 */
import fs from "fs/promises";
import path from "path";

/** A refused guides path or run folder. The message names the argument and the guides root. */
export class GuidesPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuidesPathError";
  }
}

/** The default guides root (D-154): `Guides` beside the builds folder, outside the folder PoB2 browses. */
export function defaultGuidesDirectory(pobDirectory: string): string {
  return path.resolve(pobDirectory, "..", "Guides");
}

/** A run-folder slug (A-P7): one lowercase path segment, safe on drvfs. */
export const RUN_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The longest slug accepted (A-P7). */
export const RUN_SLUG_MAX_LENGTH = 64;

/** Symlinks followed while resolving one path before it counts as a loop (Linux's own limit). */
const MAX_SYMLINKS = 40;
/** Run numbers tried past the computed next `n` before giving up (each one lost to a concurrent creator). */
const MAX_RUN_ATTEMPTS = 1000;

function errnoOf(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** An argument value as it appears in an error: JSON-quoted, so a NUL byte or a backslash stays visible. */
function shown(value: string): string {
  return JSON.stringify(value);
}

/** `target` is inside `base`, or equal to it. */
function isInside(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}

/** The symlink's target, or null when `p` isn't a symlink (or doesn't exist). */
async function readlinkOrNull(p: string): Promise<string | null> {
  try {
    return await fs.readlink(p);
  } catch {
    return null;
  }
}

/**
 * The real path of `p`: its deepest existing ancestor with symlinks resolved, the rest appended (as
 * `buildExportService`'s `realPathOf`). A dangling symlink on the way is followed too, so the result is
 * where a write through `p` would land, not the link's own location.
 */
async function realPathOf(p: string, depth = 0): Promise<string> {
  const rest: string[] = [];
  const withRest = (base: string) => (rest.length ? path.join(base, ...[...rest].reverse()) : base);
  let current = path.resolve(p);
  for (;;) {
    try {
      return withRest(await fs.realpath(current));
    } catch (error) {
      const code = errnoOf(error);
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
      const target = await readlinkOrNull(current);
      if (target !== null) {
        if (depth >= MAX_SYMLINKS) throw new Error(`too many levels of symbolic links at ${current}`);
        const linkDir = await fs.realpath(path.dirname(current));
        return realPathOf(withRest(path.resolve(linkDir, target)), depth + 1);
      }
      const parent = path.dirname(current);
      if (parent === current) return withRest(current);
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Resolve `rel`, a path relative to the guides root, to its real absolute path (C-34, R-30).
 *
 * Refused: an empty path, a NUL byte, an absolute path (POSIX or Windows form), a `..` segment under
 * either separator, and a path whose real path (symlinks resolved on the deepest existing ancestor,
 * dangling ones followed) is outside the root's real path. `argName` names the argument in the error
 * (a tool passes its own, such as `plan_path`).
 */
export async function resolveInGuidesRoot(root: string, rel: string, argName = "path"): Promise<string> {
  const refused = (why: string) => new GuidesPathError(`${argName} ${shown(rel)} ${why}; guides root: ${root}`);
  if (rel === "") throw refused("is empty: give a path relative to the guides root");
  if (rel.includes("\0")) throw refused("contains a NUL byte");
  if (path.posix.isAbsolute(rel) || path.win32.isAbsolute(rel)) {
    throw refused("is absolute: give a path relative to the guides root");
  }
  if (rel.split(/[\\/]/).includes("..")) throw refused('has a ".." segment: it must stay inside the guides root');

  let realRoot: string;
  let real: string;
  try {
    realRoot = await realPathOf(root);
    real = await realPathOf(path.resolve(root, rel));
  } catch (error) {
    throw refused(`could not be resolved (${messageOf(error)})`);
  }
  if (!isInside(realRoot, real)) {
    throw refused(`resolves to ${real}, outside the guides root's real path ${realRoot}`);
  }
  return real;
}

/**
 * D-220: refuse a guides root that overlaps the builds folder. Both real paths are resolved (symlinks on
 * the deepest existing ancestor, the rest appended, as `resolveInGuidesRoot` does), and the call throws
 * when they are equal or either is inside the other, naming both paths and the variables that set them.
 * Neither folder needs to exist.
 */
export async function checkGuidesRoot(root: string, buildsDir: string): Promise<void> {
  let realRoot: string;
  let realBuilds: string;
  try {
    realRoot = await realPathOf(root);
    realBuilds = await realPathOf(buildsDir);
  } catch (error) {
    throw new GuidesPathError(
      `the guides root ${root} (POB_GUIDES_DIRECTORY) or the builds folder ${buildsDir} (POB_DIRECTORY) could not ` +
        `be resolved: ${messageOf(error)}`,
    );
  }
  const how =
    realRoot === realBuilds
      ? "is the builds folder itself"
      : isInside(realBuilds, realRoot)
        ? "is inside the builds folder"
        : isInside(realRoot, realBuilds)
          ? "contains the builds folder"
          : null;
  if (how === null) return;
  const shownPath = (given: string, real: string) => (given === real ? given : `${given} (real path ${real})`);
  throw new GuidesPathError(
    `the guides root ${shownPath(root, realRoot)} (POB_GUIDES_DIRECTORY) ${how}, ` +
      `${shownPath(buildsDir, realBuilds)} (POB_DIRECTORY). The two folders must be separate (D-220): set ` +
      `POB_GUIDES_DIRECTORY to a folder outside the builds folder, such as the default Guides folder beside it.`,
  );
}

/**
 * The run folder a plan belongs to (D-211, the write ledger's key): the first two segments
 * `<slug>/<YYYY-MM-DD>-<n>` of its path relative to the guides root, with `/` between them. Null when the
 * path has fewer than three segments, so the plan is not inside a run folder.
 */
export function runFolderOf(relPlanPath: string): string | null {
  const segments = relPlanPath.split(/[\\/]/).filter((s) => s !== "" && s !== ".");
  if (segments.length < 3) return null;
  return `${segments[0]}/${segments[1]}`;
}

/** The real path of `p` (symlinks on its deepest existing ancestor resolved), for paths the server writes. */
export async function realPathInGuides(p: string): Promise<string> {
  return realPathOf(p);
}

/** A run folder (C-34): its absolute path, and its path relative to the guides root. */
export interface RunFolder {
  absPath: string;
  /** `<slug>/<YYYY-MM-DD>-<n>`, with `/` as the separator. */
  relPath: string;
}

/** `YYYY-MM-DD` of `date` in the server's local time zone. */
export function localDateStamp(date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Create the next run folder `<root>/<slug>/<YYYY-MM-DD>-<n>` (C-34, D-153, D-207) and return it.
 *
 * - `slug` must match `RUN_SLUG_PATTERN` and be at most 64 characters (A-P7); a bad slug creates nothing.
 * - The root is created if missing (`mkdir -p`); `<root>/<slug>` is created if missing and must be a
 *   folder whose real path is inside the root's real path, so a symlinked slug folder pointing elsewhere
 *   is refused before anything is created through it.
 * - `<n>` is 1 plus the largest `n` among the slug folder's `<YYYY-MM-DD>-<n>` entries for this date, or
 *   1. The run folder is made with a non-recursive `mkdir`; on `EEXIST` the next `n` is tried, so two
 *   concurrent callers never share a folder.
 * - `date` is the server's local date (`localDateStamp`). An invalid date, or one whose year doesn't fit
 *   `YYYY`, is refused before anything is created, so every run folder keeps the `<YYYY-MM-DD>-<n>` name.
 */
export async function createRunFolder(root: string, slug: string, date: Date): Promise<RunFolder> {
  const refused = (why: string) => new GuidesPathError(`slug ${shown(slug)} ${why}; guides root: ${root}`);
  if (slug.length > RUN_SLUG_MAX_LENGTH || !RUN_SLUG_PATTERN.test(slug)) {
    throw refused(
      `is not one safe path segment: use lowercase letters and digits in words joined by single hyphens ` +
        `(${RUN_SLUG_PATTERN.source}), at most ${RUN_SLUG_MAX_LENGTH} characters`,
    );
  }
  const stamp = localDateStamp(date);
  if (Number.isNaN(date.getTime()) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(stamp)) {
    throw new GuidesPathError(
      `date ${shown(String(date))} is not a valid date with a four-digit year (the run folder is named ` +
        `<YYYY-MM-DD>-<n>); slug ${shown(slug)}; guides root: ${root}`,
    );
  }
  const absRoot = path.resolve(root);

  let slugDir: string;
  let entries: string[];
  try {
    await fs.mkdir(absRoot, { recursive: true });
    const realRoot = await fs.realpath(absRoot);
    try {
      await fs.mkdir(path.join(absRoot, slug));
    } catch (error) {
      if (errnoOf(error) !== "EEXIST") throw error;
    }
    slugDir = await realPathOf(path.join(absRoot, slug));
    if (slugDir === realRoot || !isInside(realRoot, slugDir)) {
      throw refused(`names a folder that resolves to ${slugDir}, not inside the guides root's real path ${realRoot}`);
    }
    const stat = await fs.stat(slugDir).catch(() => null);
    if (!stat?.isDirectory()) throw refused(`names ${path.join(absRoot, slug)}, which is not a folder`);
    entries = await fs.readdir(slugDir);
  } catch (error) {
    if (error instanceof GuidesPathError) throw error;
    throw refused(`could not be used: ${messageOf(error)}`);
  }

  const runName = new RegExp(`^${stamp}-([1-9][0-9]*)$`);
  let n = 1;
  for (const entry of entries) {
    const m = runName.exec(entry);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  for (let attempt = 0; attempt < MAX_RUN_ATTEMPTS; attempt++, n++) {
    const name = `${stamp}-${n}`;
    try {
      await fs.mkdir(path.join(slugDir, name));
    } catch (error) {
      if (errnoOf(error) === "EEXIST") continue;
      throw refused(`could not be used: run folder ${name} was not created (${messageOf(error)})`);
    }
    return { absPath: path.join(absRoot, slug, name), relPath: `${slug}/${name}` };
  }
  throw refused(`found no free run folder for ${stamp} after ${MAX_RUN_ATTEMPTS} tries`);
}
