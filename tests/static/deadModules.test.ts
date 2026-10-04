/**
 * AC-F21: no dead modules. Every `src/**\/*.ts` file except the entry `src/index.ts` is imported by
 * at least one other `src/` file. Import specifiers are parsed with the TypeScript compiler API:
 * `import … from`, `import type`, `export … from`, `import x = require(…)`, `import('…')` calls and
 * `import('…').T` type references all count.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC = path.resolve(__dirname, '..', '..', 'src');
const ENTRY = path.join(SRC, 'index.ts');

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

/** Every module specifier a source file names. */
export function importSpecifiers(fileName: string, text: string): string[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specs: string[] = [];
  const addLiteral = (node: ts.Node | undefined) => {
    if (node && ts.isStringLiteralLike(node)) specs.push(node.text);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addLiteral(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addLiteral(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      addLiteral(node.argument.literal);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      addLiteral(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return specs;
}

/** Resolve a relative specifier (`./x.js`, `../y`) to a `.ts` file under src, or null. */
export function resolveSpecifier(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base.replace(/\.js$/, '.ts'),
    `${base}.ts`,
    path.join(base, 'index.ts'),
    base,
  ];
  for (const c of candidates) {
    if (c.endsWith('.ts') && fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

describe('AC-F21: no dead modules in src/', () => {
  it('AC-F21: the parser sees every import form (self-check)', () => {
    const text = [
      'import a from "./a.js";',
      'import type { B } from "../b.js";',
      'export { c } from "./c.js";',
      'export * from "./d.js";',
      'import e = require("./e.js");',
      'type F = import("./f.js").F;',
      'const g = await import("./g.js");',
      'import "./h.js";',
    ].join('\n');
    expect(importSpecifiers('x.ts', text).sort()).toEqual(
      ['../b.js', './a.js', './c.js', './d.js', './e.js', './f.js', './g.js', './h.js'].sort(),
    );
  });

  it('AC-F21: every src/**/*.ts file except src/index.ts is imported by another src/ file', () => {
    const files = walkTs(SRC);
    const importedBy = new Map<string, Set<string>>(files.map((f) => [f, new Set<string>()]));
    for (const f of files) {
      for (const spec of importSpecifiers(f, fs.readFileSync(f, 'utf8'))) {
        const target = resolveSpecifier(f, spec);
        if (target && target !== f && importedBy.has(target)) importedBy.get(target)!.add(f);
      }
    }
    const dead = files
      .filter((f) => f !== ENTRY && importedBy.get(f)!.size === 0)
      .map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(dead).toEqual([]);
  });
});
