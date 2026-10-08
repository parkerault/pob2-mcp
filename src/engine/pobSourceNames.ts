/**
 * The server's name scan of PoB's source (D-226), for `check_model_coverage`'s "possibly unread" status
 * (C-38).
 *
 * Headless PoB can't list files, so the server does spike S-b's by-name census itself: it reads every
 * `.lua` file directly under `Modules/` and `Classes/` of the PoB source the engine runs (`resolvePobSrc`,
 * C-6), except `Modules/ModParser.lua`, and collects every distinct identifier in the file text (code,
 * strings and comments alike). A mod name that appears in none of them is probably never read by PoB's
 * calculations. Each `check_coverage` request carries the names to Lua as `sourceNames`.
 *
 * The scan runs once per server process, lazily on the first call, and is memoized per source directory:
 * a second call returns the same `Set`, and an engine restart doesn't repeat it. A failed scan isn't
 * memoized, so the next call tries again.
 */
import fs from "fs";
import path from "path";

/** The directories scanned, directly (not recursively), relative to PoB's `src/`. */
export const SCANNED_DIRS = ["Modules", "Classes"] as const;
/** The one file left out: the parser names every mod it can produce, so it would hide them all. */
export const EXCLUDED_FILE = path.join("Modules", "ModParser.lua");

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;

const memo = new Map<string, Promise<Set<string>>>();

async function scan(pobSrc: string): Promise<Set<string>> {
  const names = new Set<string>();
  for (const dir of SCANNED_DIRS) {
    const entries = await fs.promises.readdir(path.join(pobSrc, dir), { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".lua") && path.join(dir, e.name) !== EXCLUDED_FILE)
      .map((e) => e.name)
      .sort();
    for (const file of files) {
      const text = await fs.promises.readFile(path.join(pobSrc, dir, file), "utf8");
      for (const match of text.matchAll(IDENTIFIER)) names.add(match[0]);
    }
  }
  return names;
}

/**
 * Every identifier in the `.lua` files directly under `<pobSrc>/Modules` and `<pobSrc>/Classes`, except
 * `Modules/ModParser.lua`. Scanned on the first call for a directory, then memoized.
 */
export function pobSourceNames(pobSrc: string): Promise<Set<string>> {
  const key = path.resolve(pobSrc);
  let names = memo.get(key);
  if (!names) {
    names = scan(key);
    memo.set(key, names);
    names.catch(() => {
      if (memo.get(key) === names) memo.delete(key);
    });
  }
  return names;
}

/** Test hook: forget every memoized scan, so a test can watch a cold scan happen once. */
export function forgetPobSourceNames(): void {
  memo.clear();
}
