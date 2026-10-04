import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..', '..', 'src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe('one PoB path resolver (C-6)', () => {
  it('AC-F5: POB_FORK_PATH appears in src/ only in src/engine/pobPath.ts', () => {
    const hits = walk(SRC)
      .filter((f) => fs.readFileSync(f, 'utf8').includes('POB_FORK_PATH'))
      .map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(hits).toEqual(['engine/pobPath.ts']);
  });
});
