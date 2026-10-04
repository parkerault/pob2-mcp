import fs from "fs";
import path from "path";

/** The file that marks the package root (C-6). */
const MARKER = "pob-pin.json";

let memo: string | null = null;

function walkUp(start: string): string | null {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, MARKER))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Absolute path of this package's root directory (the one holding `pob-pin.json`).
 *
 * MCP hosts launch the server from arbitrary working directories, so the primary anchor is
 * the entry script (`process.argv[1]`, e.g. `<pkg>/build/index.js`; under Jest a file inside
 * `<pkg>/node_modules`). It walks up from there, then from `process.cwd()`, and finally falls
 * back to `process.cwd()`. The result is memoized. Never uses `import.meta` (Jest compiles
 * `src` as CommonJS).
 */
export function packageRoot(): string {
  if (memo !== null) return memo;
  const entry = process.argv[1];
  memo =
    (entry ? walkUp(path.dirname(entry)) : null) ??
    walkUp(process.cwd()) ??
    process.cwd();
  return memo;
}
