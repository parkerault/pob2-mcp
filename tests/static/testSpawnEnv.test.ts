/**
 * AC-F28 (static part, FR-F5): every `spawn(`, `execFile(`, `spawnSync(` and `fork(` call under
 * tests/ passes an explicit `env` option, or the test uses `spawnServer` (C-18), so no test can
 * leak the real environment into a child by accident.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ts from 'typescript';

const TESTS = path.resolve(__dirname, '..');
const GUARDED = new Set(['spawn', 'execFile', 'spawnSync', 'fork']);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'fixtures' ? [] : walk(p);
    return /\.(ts|js|cjs|mjs)$/.test(e.name) ? [p] : [];
  });
}

function calleeName(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

function hasEnvOption(call: ts.CallExpression): boolean {
  return call.arguments.some(
    (a) =>
      ts.isObjectLiteralExpression(a) &&
      a.properties.some(
        (p) =>
          (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
          p.name !== undefined &&
          ts.isIdentifier(p.name) &&
          p.name.text === 'env',
      ),
  );
}

/** `file:line: call` for every guarded call without an explicit env option. */
export function unguardedSpawns(file: string, source = fs.readFileSync(file, 'utf8')): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (name && GUARDED.has(name) && !hasEnvOption(node)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        out.push(`${path.relative(TESTS, file)}:${line + 1}: ${node.getText().split('\n')[0]}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe('test processes get an explicit env (FR-F5)', () => {
  it('AC-F28: every spawn/execFile/spawnSync/fork call under tests/ passes an env option', () => {
    expect(walk(TESTS).flatMap((f) => unguardedSpawns(f))).toEqual([]);
  });

  it('AC-F28: the scanner catches a call without env (self-check)', () => {
    const file = path.join(os.tmpdir(), 'pob2-mcp-spawn-selfcheck.ts');
    const bad = [
      "import { spawn, spawnSync } from 'child_process';",
      "spawn('node', ['-v']);",
      "spawnSync('node', ['-v'], { cwd: '/tmp' });",
      "require('child_process').fork('x.js');",
      "spawn('node', ['-v'], { env: {} });",
    ].join('\n');
    expect(unguardedSpawns(file, bad)).toHaveLength(3);
  });
});
