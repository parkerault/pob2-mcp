import path from "path";
import fsPromises from "fs/promises";

/**
 * Sanitize a build name to prevent path traversal attacks.
 * Returns the resolved absolute path within baseDir.
 * Throws on any path that would escape baseDir.
 */
export function sanitizeBuildName(name: string, baseDir: string): string {
  if (name.includes('\0')) {
    throw new Error('Build name contains null bytes');
  }

  if (path.isAbsolute(name)) {
    throw new Error('Build name must be relative');
  }

  // Reject .. components (both Unix and Windows separators)
  const normalized = name.replace(/\\/g, '/');
  if (normalized.split('/').some(segment => segment === '..')) {
    throw new Error('Build name contains path traversal');
  }

  const resolved = path.resolve(baseDir, name);
  const resolvedBase = path.resolve(baseDir);

  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error('Build name resolves outside base directory');
  }

  return resolved;
}

/** The directory listing `canonicalBuildPath` needs; injectable so a test can fake a case-insensitive fs. */
export interface CanonicalFs {
  /** Entry names of a directory, in their on-disk casing. Rejects when the directory doesn't exist. */
  readdir(dir: string): Promise<string[]>;
}

const defaultCanonicalFs: CanonicalFs = {
  readdir: (dir) => fsPromises.readdir(dir),
};

/** Raised when a build name matches several entries case-insensitively and none exactly (D-52). */
export class AmbiguousBuildNameError extends Error {
  constructor(name: string, segment: string, matches: string[]) {
    super(`ambiguous build name "${name}": "${segment}" matches ${matches.map((m) => `"${m}"`).join(', ')}; use the exact casing`);
    this.name = 'AmbiguousBuildNameError';
  }
}

/**
 * Canonical build path (D-52): the on-disk casing of a build path under `baseDir`, as a POSIX path
 * relative to it. Case-insensitive filesystems (drvfs `/mnt/c`) resolve any casing to one file, and
 * `fs.realpath` keeps the caller's casing, so every build path used as a key, a display name or a write
 * target goes through here.
 *
 * - `.xml` is appended to the final segment when it has no `.xml` extension (any casing).
 * - Each segment takes the exact `readdir` match, else the single case-insensitive match.
 * - Several case-insensitive matches and no exact one → `AmbiguousBuildNameError` ("ambiguous build name").
 * - A segment with no match (a new file or folder) keeps the caller's spelling, and so does every
 *   segment below it.
 * - Traversal, absolute paths and null bytes are refused first (`sanitizeBuildName`).
 */
export async function canonicalBuildPath(
  name: string,
  baseDir: string,
  fsImpl: CanonicalFs = defaultCanonicalFs,
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Build name is empty');
  const withExt = /\.xml$/i.test(trimmed) ? trimmed : `${trimmed}.xml`;
  sanitizeBuildName(withExt, baseDir);
  const segments = withExt.replace(/\\/g, '/').split('/').filter((s) => s !== '' && s !== '.');
  if (segments.length === 0) throw new Error('Build name is empty');

  const out: string[] = [];
  let dir = path.resolve(baseDir);
  let exists = true;
  for (const segment of segments) {
    let chosen = segment;
    if (exists) {
      let entries: string[] | null;
      try {
        entries = await fsImpl.readdir(dir);
      } catch {
        entries = null;
      }
      if (entries === null) {
        exists = false;
      } else if (entries.includes(segment)) {
        chosen = segment;
      } else {
        const lower = segment.toLowerCase();
        const matches = entries.filter((e) => e.toLowerCase() === lower);
        if (matches.length > 1) throw new AmbiguousBuildNameError(name, segment, matches);
        if (matches.length === 1) chosen = matches[0];
        else exists = false;
      }
    }
    out.push(chosen);
    dir = path.join(dir, chosen);
  }
  return out.join('/');
}
