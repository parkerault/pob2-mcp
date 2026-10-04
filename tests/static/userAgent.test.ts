/**
 * AC-T3 (WU-14, D-25), static part: the User-Agent is defined only in `src/utils/userAgent.ts`.
 *
 * The equivalents of:
 *   rg -n "PathOfBuildingCommunity\)|pob-mcp-server/1.0" src/   → no match
 *   rg -n "Mozilla" src/                                        → only src/utils/userAgent.ts
 * plus: no `User-Agent` header in src/ is given a string literal (every one comes from the module).
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

function grep(re: RegExp): string[] {
  return walk(SRC).flatMap((f) =>
    fs
      .readFileSync(f, 'utf8')
      .split('\n')
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => re.test(line))
      .map(({ line, i }) => `${path.relative(SRC, f).split(path.sep).join('/')}:${i + 1}: ${line.trim()}`),
  );
}

const files = (hits: string[]) => [...new Set(hits.map((h) => h.split(':')[0]))].sort();

describe('AC-T3 (WU-14, D-25): the User-Agent lives in one module', () => {
  it('AC-T3: no src/ file names the PoB org or the old pob-mcp-server/1.0 UA', () => {
    expect(grep(/PathOfBuildingCommunity\)|pob-mcp-server\/1\.0/)).toEqual([]);
  });

  it('AC-T3: "Mozilla" appears only in src/utils/userAgent.ts', () => {
    expect(files(grep(/Mozilla/))).toEqual(['utils/userAgent.ts']);
  });

  it('AC-T3: no User-Agent header in src/ is a string literal', () => {
    expect(grep(/['"]User-Agent['"]\s*:\s*['"`]/i)).toEqual([]);
    // A hard-coded `pob2-mcp-server/<version>` appears nowhere but the module's own doc comment.
    expect(files(grep(/pob2-mcp-server\/\d/)).filter((f) => f !== 'utils/userAgent.ts')).toEqual([]);
  });

  it('AC-T3: both UA forms are built in src/utils/userAgent.ts', () => {
    const text = fs.readFileSync(path.join(SRC, 'utils', 'userAgent.ts'), 'utf8');
    expect(text).toMatch(/export function userAgent\(\)/);
    expect(text).toMatch(/export function shareSiteUserAgent\(\)/);
    expect(text).toContain('Mozilla/5.0 (compatible; ${userAgent})');
  });
});
