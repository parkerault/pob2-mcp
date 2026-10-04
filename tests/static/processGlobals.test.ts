/**
 * AC-F11 (static part): `src/index.ts` is the only `src/` file that reads `process.env` or
 * installs process / stdin listeners (C-7).
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..', '..', 'src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('process globals live only in the entry (C-7)', () => {
  it.each(['process.env', 'process.on(', 'process.stdin.on('])(
    'AC-F11: only src/index.ts contains %s',
    (needle) => {
      const hits = walk(SRC)
        .filter((f) => fs.readFileSync(f, 'utf8').includes(needle))
        .map((f) => path.relative(SRC, f).split(path.sep).join('/'));
      expect(hits).toEqual(['index.ts']);
    },
  );
});
