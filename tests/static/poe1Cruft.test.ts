/**
 * AC-F20 (I-5): no PoE1 cruft in the text we author.
 *
 * Every string literal and template literal in `src/**\/*.ts` (extracted with the TypeScript
 * compiler API, so tool names and descriptions are included and comments are not) is checked for
 * the banned PoE1 phrases (case-insensitive) and the banned PoE1 class names (case-sensitive whole
 * words). Hits are allowed only when `tests/static/poe1-cruft-waivers.json` has a `{file, phrase,
 * owner, justification}` entry for them. A waiver matches every hit of its phrase in its file, and a
 * waiver that matches no hit fails the test ("remove the waiver").
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ts from 'typescript';

const REPO = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO, 'src');
const WAIVERS = path.join(__dirname, 'poe1-cruft-waivers.json');

/** Banned phrases, matched case-insensitively anywhere in a literal. */
export const BANNED_PHRASES = [
  'spell suppression',
  "watcher's eye",
  'cluster jewel',
  'bandit',
  'pantheon',
  'awakened',
  '6-link',
  'chaos orb equivalent',
  'mastery effect',
  'the shaper',
  'the elder',
  'uber elder',
  'sirus',
  'the maven',
  'searing exarch',
  'eater of worlds',
] as const;

/** Banned PoE1 class names, matched case-sensitively as whole words. */
export const BANNED_WORDS = ['Scion', 'Marauder', 'Duelist', 'Templar', 'Shadow'] as const;

export interface CruftHit {
  /** Repo-relative path with forward slashes, e.g. `src/server/toolSchemas.ts`. */
  file: string;
  line: number;
  phrase: string;
  text: string;
}

export interface Waiver {
  file: string;
  phrase: string;
  owner: string;
  justification: string;
}

function walkTs(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walkTs(p);
      return e.name.endsWith('.ts') && !e.name.endsWith('.d.ts') ? [p] : [];
    })
    .sort();
}

/** Every string/template literal in a source file, with its 1-based line. */
export function extractLiterals(fileName: string, text: string): Array<{ line: number; text: string }> {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: Array<{ line: number; text: string }> = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      out.push({ line, text: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** The banned phrases and words one literal contains. */
export function bannedIn(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = BANNED_PHRASES.filter((p) => lower.includes(p));
  for (const w of BANNED_WORDS) {
    if (new RegExp(`\\b${w}\\b`).test(text)) found.push(w);
  }
  return found;
}

/** Scan every `.ts` file under `root`; `file` in each hit is relative to `relTo`. */
export function scanForCruft(root: string, relTo: string = REPO): CruftHit[] {
  const hits: CruftHit[] = [];
  for (const abs of walkTs(root)) {
    const file = path.relative(relTo, abs).split(path.sep).join('/');
    for (const lit of extractLiterals(abs, fs.readFileSync(abs, 'utf8'))) {
      for (const phrase of bannedIn(lit.text)) {
        hits.push({ file, line: lit.line, phrase, text: lit.text.length > 120 ? `${lit.text.slice(0, 117)}...` : lit.text });
      }
    }
  }
  return hits;
}

/** Apply the waivers: the hits no waiver covers, and the waivers no hit uses. */
export function applyWaivers(hits: CruftHit[], waivers: Waiver[]): { unwaived: CruftHit[]; stale: Waiver[] } {
  const covers = (w: Waiver, h: CruftHit) => w.file === h.file && w.phrase === h.phrase;
  return {
    unwaived: hits.filter((h) => !waivers.some((w) => covers(w, h))),
    stale: waivers.filter((w) => !hits.some((h) => covers(w, h))),
  };
}

function loadWaivers(): Waiver[] {
  return JSON.parse(fs.readFileSync(WAIVERS, 'utf8')) as Waiver[];
}

describe('AC-F20: PoE1-cruft scan (I-5)', () => {
  it('AC-F20: the scanner catches a planted banned phrase, a planted class name and a template literal (self-check)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cruft-selfcheck-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'planted.ts'),
        [
          '// a comment about a Bandit is not authored output',
          'const bandit = 1;',
          'export const a = "Socket a Large CLUSTER JEWEL here";',
          "export const b = 'Pick the Templar class';",
          'export const c = `Fight ${bandit} the Shaper`;',
          'export const d = "Shadowed and templar are fine";',
        ].join('\n'),
      );
      const hits = scanForCruft(dir, dir);
      expect(hits.map((h) => [h.file, h.line, h.phrase])).toEqual([
        ['planted.ts', 3, 'cluster jewel'],
        ['planted.ts', 4, 'Templar'],
        ['planted.ts', 5, 'the shaper'],
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC-F20: a waiver that matches no hit is reported as stale', () => {
    const hit: CruftHit = { file: 'src/x.ts', line: 1, phrase: 'bandit', text: 'bandit' };
    const keep: Waiver = { file: 'src/x.ts', phrase: 'bandit', owner: 'WU-12', justification: 'j' };
    const stale: Waiver = { file: 'src/y.ts', phrase: 'pantheon', owner: 'WU-12', justification: 'j' };
    expect(applyWaivers([hit], [keep, stale])).toEqual({ unwaived: [], stale: [stale] });
  });

  it('AC-F20: every waiver is {file, phrase, owner, justification} with a WU owner and a banned phrase', () => {
    const waivers = loadWaivers();
    expect(Array.isArray(waivers)).toBe(true);
    const banned = new Set<string>([...BANNED_PHRASES, ...BANNED_WORDS]);
    for (const w of waivers) {
      expect(Object.keys(w).sort()).toEqual(['file', 'justification', 'owner', 'phrase']);
      expect(w.owner).toMatch(/^WU-\d{2}$/);
      expect(typeof w.justification).toBe('string');
      expect(w.justification.trim().length).toBeGreaterThan(0);
      expect(banned.has(w.phrase)).toBe(true);
    }
    const keys = waivers.map((w) => `${w.file}|${w.phrase}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('AC-F20: string and template literals in src/**/*.ts have no PoE1 cruft beyond the waivers', () => {
    const { unwaived, stale } = applyWaivers(scanForCruft(SRC), loadWaivers());
    const staleMessages = stale.map(
      (w) => `remove the waiver: ${w.file} "${w.phrase}" (owner ${w.owner}) no longer matches any hit`,
    );
    const hitMessages = unwaived.map((h) => `${h.file}:${h.line}: "${h.phrase}" in ${JSON.stringify(h.text)}`);
    expect(staleMessages).toEqual([]);
    expect(hitMessages).toEqual([]);
  });
});
