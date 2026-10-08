/**
 * AC-P12 (WU-38, D-170): the plan code evaluates nothing as code and depends on nothing new.
 *
 * No file under `src/plan/` contains `eval(`, `new Function` or `Function(` (raw text, comments
 * included), and every import it makes is a relative module, a node builtin or `zod`. Import specifiers
 * are read with the TypeScript compiler API, so every import form counts.
 */
import fs from 'fs';
import { builtinModules } from 'module';
import path from 'path';
import ts from 'typescript';
import { describe, expect, it } from '@jest/globals';

const PLAN_DIR = path.resolve(__dirname, '..', '..', 'src', 'plan');
const FORBIDDEN = ['eval(', 'new Function', 'Function('] as const;

function walkTs(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walkTs(p);
      return e.name.endsWith('.ts') ? [p] : [];
    })
    .sort();
}

/** The forbidden texts `text` contains. */
function forbiddenIn(text: string): string[] {
  return FORBIDDEN.filter((f) => text.includes(f));
}

/** Every module specifier a source file names: imports, re-exports, `import x = require()`, `import()`. */
function importSpecifiers(fileName: string, text: string): string[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specs: string[] = [];
  const add = (node: ts.Node | undefined) => {
    if (node && ts.isStringLiteralLike(node)) specs.push(node.text);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression);
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node.argument.literal);
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) add(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return specs;
}

/** Whether an import specifier is allowed in `src/plan/`. */
function allowedImport(spec: string): boolean {
  if (spec.startsWith('./') || spec.startsWith('../')) return true;
  if (spec === 'zod') return true;
  const bare = spec.startsWith('node:') ? spec.slice('node:'.length) : spec;
  return builtinModules.includes(bare);
}

describe('AC-P12 (WU-38, D-170): no eval and no new dependencies in src/plan/', () => {
  it('AC-P12: the scans catch what they look for (self-check)', () => {
    expect(forbiddenIn('const v = eval(src);')).toEqual(['eval(']);
    expect(forbiddenIn('const f = new Function("a", "return a");')).toEqual(['new Function', 'Function(']);
    expect(forbiddenIn('const f = Function("return 1");')).toEqual(['Function(']);
    expect(forbiddenIn('evaluateLedgerEntry(entry, ctx);')).toEqual([]);
    const specs = importSpecifiers('x.ts', [
      "import { z } from 'zod';",
      "import type { A } from './a.js';",
      "import fs from 'node:fs';",
      "import path from 'path';",
      "export * from '../b.js';",
      "const m = require('mathjs');",
      "const e = await import('expr-eval');",
    ].join('\n'));
    expect(specs.filter((s) => !allowedImport(s))).toEqual(['mathjs', 'expr-eval']);
  });

  const files = walkTs(PLAN_DIR);

  it('AC-P12: src/plan/ holds the schema, source-tag and ledger modules', () => {
    expect(files.map((f) => path.basename(f))).toEqual(expect.arrayContaining(['ledger.ts', 'schema.ts', 'sourceTag.ts']));
  });

  it('AC-P12: no file under src/plan/ contains eval(, new Function or Function(', () => {
    const hits = files.flatMap((f) => forbiddenIn(fs.readFileSync(f, 'utf8')).map((t) => `${path.relative(PLAN_DIR, f)}: ${t}`));
    expect(hits).toEqual([]);
  });

  it('AC-P12: src/plan/ imports only relative modules, node builtins and zod', () => {
    const bad = files.flatMap((f) =>
      importSpecifiers(f, fs.readFileSync(f, 'utf8'))
        .filter((s) => !allowedImport(s))
        .map((s) => `${path.relative(PLAN_DIR, f)}: ${s}`),
    );
    expect(bad).toEqual([]);
  });
});
