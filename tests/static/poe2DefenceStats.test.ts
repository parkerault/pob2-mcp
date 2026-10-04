/**
 * AC-E41 (WU-11), static part: PoB2 has no `EvasionChance` output (its evade chance is `EvadeChance`,
 * `CalcDefence.lua`), so no source file under `src/` names it — `rg -n "EvasionChance" src/` finds
 * nothing. The engine part (`lua_get_stats` shows `EvadeChance` and `DeflectChance`) is in
 * `tests/integration/engineItemsSkills.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';

const SRC = path.resolve(__dirname, '..', '..', 'src');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : [full];
  });
}

describe('AC-E41: PoE2 defence stat names (static)', () => {
  it('AC-E41: no file under src/ contains "EvasionChance"', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(20);
    const hits = files.filter((file) => fs.readFileSync(file, 'utf8').includes('EvasionChance'));
    expect(hits.map((file) => path.relative(SRC, file))).toEqual([]);
  });
});
