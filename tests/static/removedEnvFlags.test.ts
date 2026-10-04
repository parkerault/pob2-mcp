/**
 * AC-F14 (static part): the removed env flags (D-14, D-4) are not read or mentioned in src/:
 * the equivalent of `rg -n "POB_LUA_ENABLED|POE_TRADE_ENABLED|POB_LEGACY_GEM_TOOLS" src/`.
 */
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

describe('removed env flags (D-14)', () => {
  it('AC-F14: no src/ file mentions POB_LUA_ENABLED, POE_TRADE_ENABLED or POB_LEGACY_GEM_TOOLS', () => {
    const re = /POB_LUA_ENABLED|POE_TRADE_ENABLED|POB_LEGACY_GEM_TOOLS/;
    const hits = walk(SRC).flatMap((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => re.test(line))
        .map(({ line, i }) => `${path.relative(SRC, f)}:${i + 1}: ${line.trim()}`),
    );
    expect(hits).toEqual([]);
  });
});
