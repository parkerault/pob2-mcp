/**
 * WU-18 static checks on the advice tools (FR-A1, D-3, D-30):
 * - AC-A2 (static part): none of the advice files matches a threshold or a piece of PoE1-era advice
 *   (case-insensitive; a word boundary where it matters, as `rg -i -w`).
 * - AC-A4 (static part): `validate_build` has a single code path. The XML path
 *   (`src/services/validationService.ts`, with `validateDamageScaling`) is deleted, and no second
 *   implementation exists anywhere under `src/`.
 * - AC-A5 (static part): the hygiene allowlist and the PoE1-cruft waivers have no entry owned by WU-18.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';

const REPO = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO, 'src');

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : entry.name.endsWith('.ts') ? [full] : [];
  });
}

/** The advice files AC-A2 names; `defensiveAnalyzer.ts` only if it still exists. */
function adviceFiles(): string[] {
  const files = [
    ...sourceFiles(path.join(SRC, 'advice')),
    path.join(SRC, 'handlers', 'validationHandlers.ts'),
    path.join(SRC, 'handlers', 'optimizationHandlers.ts'),
    path.join(SRC, 'handlers', 'buildGoalsHandlers.ts'),
  ];
  const analyzer = path.join(SRC, 'defensiveAnalyzer.ts');
  if (fs.existsSync(analyzer)) files.push(analyzer);
  return files;
}

/** AC-A2's patterns: `rg -i` for phrases, `rg -i -w` for the bare number and the word "aim". */
const BANNED: Array<{ pattern: string; re: RegExp }> = [
  { pattern: '4000', re: /\b4000\b/i },
  { pattern: '\\baim\\b', re: /\baim\b/i },
  ...['Constitution', 'Heart of Oak', 'Diamond Skin', 'Amethyst', 'Guardian', 'of Curing', 'Precision',
    'suppression', 'quest points', 'ESRecharge', 'Flask 3', 'Flask 4', 'Flask 5'].map((p) => ({
    pattern: p,
    re: new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
  })),
];

describe('AC-A2 (WU-18, D-30): the advice files carry no thresholds or PoE1 advice (static)', () => {
  it('AC-A2: src/advice/judge.ts exists and the advice files are all present', () => {
    const files = adviceFiles();
    expect(files.map((f) => path.relative(SRC, f))).toEqual(expect.arrayContaining([
      path.join('advice', 'judge.ts'),
      path.join('handlers', 'validationHandlers.ts'),
      path.join('handlers', 'optimizationHandlers.ts'),
      path.join('handlers', 'buildGoalsHandlers.ts'),
    ]));
    for (const f of files) expect(fs.existsSync(f)).toBe(true);
  });

  it('AC-A2: no advice file matches any banned pattern', () => {
    const hits: string[] = [];
    for (const file of adviceFiles()) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { pattern, re } of BANNED) {
          if (re.test(line)) hits.push(`${path.relative(REPO, file)}:${i + 1}: /${pattern}/ in ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('AC-A2: the scanner itself finds each banned pattern', () => {
    const samples = ['Aim for 4000+ life', 'aim higher', 'Constitution', 'heart of oak', 'Diamond Skin', 'Amethyst Flask',
      'a Guardian', 'Flask of Curing', 'Precision aura', 'Spell Suppression', '24 quest points', 'ESRecharge',
      'Flask 3', 'flask 4', 'Flask 5'];
    for (const sample of samples) expect(BANNED.some(({ re }) => re.test(sample))).toBe(true);
    expect(BANNED.some(({ re }) => re.test('maim 40000 EnergyShieldRecharge Flask 2'))).toBe(false);
  });
});

describe('AC-A4 (WU-18): validate_build has a single code path (static)', () => {
  it('AC-A4: the XML path is deleted: no src/services/validationService.ts, no src/defensiveAnalyzer.ts', () => {
    expect(fs.existsSync(path.join(SRC, 'services', 'validationService.ts'))).toBe(false);
    expect(fs.existsSync(path.join(SRC, 'defensiveAnalyzer.ts'))).toBe(false);
  });

  it('AC-A4: rg finds no second implementation under src/', () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const marker of [/validateDamageScaling/, /ValidationService/i, /formatValidation/, /\bvalidateBuild\(/]) {
        if (marker.test(text)) hits.push(`${path.relative(REPO, file)}: ${marker}`);
      }
    }
    expect(hits).toEqual([]);
    const definers = sourceFiles(SRC).filter((f) => /function handleValidateBuild\b/.test(fs.readFileSync(f, 'utf8')));
    expect(definers.map((f) => path.relative(SRC, f))).toEqual([path.join('handlers', 'validationHandlers.ts')]);
  });
});

describe('AC-A5 (WU-18): no allowlist or waiver entry is owned by WU-18 (static)', () => {
  it('AC-A5: tests/fixtures/tool-hygiene-allowlist.json and tests/static/poe1-cruft-waivers.json have no WU-18 entry', () => {
    const allowlist = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'tool-hygiene-allowlist.json'), 'utf8')) as Array<{ owner?: string }>;
    const waivers = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'static', 'poe1-cruft-waivers.json'), 'utf8')) as Array<{ owner?: string }>;
    expect(allowlist.filter((e) => e.owner === 'WU-18')).toEqual([]);
    expect(waivers.filter((e) => e.owner === 'WU-18')).toEqual([]);
  });
});
