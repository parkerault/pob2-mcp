/**
 * AC-A6 (WU-18, E7): no module under `src/handlers`, `src/advice` or `src/services` reads a stat key
 * outside AC-E26's default list from a `getStats()` result fetched without `fields`.
 *
 * The default list is `M.DEFAULT_STAT_FIELDS` in `pob-api/API/BuildOps.lua` (what `get_stats` returns
 * with no `fields`, AC-E26). The test parses each module with the TypeScript compiler API and maps each
 * `getStats(` call without `fields` (no argument, or a literal `undefined`) to the property keys read
 * from its result:
 * - the result bound to a name (`const s = await x.getStats()`, also through `( )`, `??`, `||` and
 *   `as`): every `s.Key` and `s['Key']` in the enclosing function, and object destructuring of `s`;
 * - the result destructured directly (`const { Life, ...rest } = await x.getStats()`): the named keys.
 * A result that can't be traced to its reads (passed on, returned, stored, read with a computed key)
 * fails the test, because its reads can't be checked. `_meta` (metadata, always returned) is allowed.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { describe, expect, it } from '@jest/globals';

const REPO = path.resolve(__dirname, '..', '..');
const SCANNED = ['handlers', 'advice', 'services'].map((d) => path.join(REPO, 'src', d));

/** `M.DEFAULT_STAT_FIELDS = { … }` from BuildOps.lua. */
export function defaultStatFields(): string[] {
  const lua = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'BuildOps.lua'), 'utf8');
  const block = /M\.DEFAULT_STAT_FIELDS\s*=\s*\{([\s\S]*?)\n\}/.exec(lua);
  if (!block) throw new Error('BuildOps.lua: no M.DEFAULT_STAT_FIELDS');
  return [...block[1].matchAll(/"([A-Za-z0-9_]+)"/g)].map((m) => m[1]);
}

export interface StatsRead {
  /** `file:line` of the `getStats(` call. */
  call: string;
  keys: string[];
  /** Why the reads could not be traced, if they could not. */
  untraced?: string;
}

function isUnfieldedGetStats(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'getStats') return false;
  if (node.arguments.length === 0) return true;
  const first = node.arguments[0];
  return ts.isIdentifier(first) && first.text === 'undefined';
}

/** Climb from the call through the wrappers that keep its value (await, parens, ??, ||, as, !). */
function valueHolder(call: ts.Node): ts.Node {
  let node: ts.Node = call;
  for (;;) {
    const parent = node.parent;
    if (
      ts.isAwaitExpression(parent) || ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) ||
      ts.isNonNullExpression(parent) || ts.isTypeAssertionExpression(parent) || ts.isSatisfiesExpression(parent) ||
      (ts.isBinaryExpression(parent) && parent.left === node &&
        (parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || parent.operatorToken.kind === ts.SyntaxKind.BarBarToken))
    ) {
      node = parent;
      continue;
    }
    return node;
  }
}

function bindingKeys(pattern: ts.ObjectBindingPattern): { keys: string[]; untraced?: string } {
  const keys: string[] = [];
  for (const el of pattern.elements) {
    if (el.dotDotDotToken) continue; // the rest object: its keys are what the engine returned
    const name = el.propertyName ?? el.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) keys.push(name.text);
    else return { keys, untraced: 'a computed key in a destructuring' };
  }
  return { keys };
}

function enclosingScope(node: ts.Node): ts.Node {
  let cur: ts.Node | undefined = node.parent;
  while (cur && !ts.isFunctionLike(cur) && !ts.isSourceFile(cur)) cur = cur.parent;
  return cur ?? node.getSourceFile();
}

/** Every `name.Key`, `name['Key']` and `{Key} = name` in the scope; anything else using `name` is untraceable. */
function readsOf(name: string, decl: ts.Identifier, scope: ts.Node): { keys: string[]; untraced?: string } {
  const keys: string[] = [];
  let untraced: string | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === name && node !== decl) {
      const parent = node.parent;
      if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
        keys.push(parent.name.text);
      } else if (ts.isElementAccessExpression(parent) && parent.expression === node) {
        if (ts.isStringLiteralLike(parent.argumentExpression)) keys.push(parent.argumentExpression.text);
        else untraced ??= `a computed read ${name}[…]`;
      } else if (ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isObjectBindingPattern(parent.name)) {
        const b = bindingKeys(parent.name);
        keys.push(...b.keys);
        if (b.untraced) untraced ??= b.untraced;
      } else if (!(ts.isPropertyAccessExpression(parent) && parent.name === node)) {
        untraced ??= `the result is used as a whole (${ts.SyntaxKind[parent.kind]})`;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return { keys, untraced };
}

/** Every unfielded `getStats(` call in one source text, with the keys read from its result. */
export function unfieldedStatsReads(fileName: string, text: string): StatsRead[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: StatsRead[] = [];
  const visit = (node: ts.Node): void => {
    if (isUnfieldedGetStats(node)) {
      const call = `${fileName}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
      const holder = valueHolder(node);
      const parent = holder.parent;
      if (ts.isVariableDeclaration(parent) && parent.initializer === holder) {
        if (ts.isIdentifier(parent.name)) {
          out.push({ call, ...readsOf(parent.name.text, parent.name, enclosingScope(parent)) });
        } else if (ts.isObjectBindingPattern(parent.name)) {
          out.push({ call, ...bindingKeys(parent.name) });
        } else {
          out.push({ call, keys: [], untraced: 'an array destructuring' });
        }
      } else if (ts.isExpressionStatement(parent)) {
        out.push({ call, keys: [] }); // the result is discarded
      } else {
        out.push({ call, keys: [], untraced: `the result is not bound to a name (${ts.SyntaxKind[parent.kind]})` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function walkTs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walkTs(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

describe('AC-A6 (WU-18, E7): unfielded getStats() results are read only for default-list keys (static)', () => {
  const DEFAULTS = new Set([...defaultStatFields(), '_meta']);

  it('AC-A6: the default list parsed from BuildOps.lua is AC-E26’s (its 18 originals and the E7 additions)', () => {
    for (const key of ['Life', 'EnergyShield', 'CombinedDPS', 'TotalEHP', 'PhysicalDamageReduction', 'MissingChaosResist',
      'PhysicalMaximumHitTaken', 'ChaosEnemyDamage', 'totalEnemyDamage', 'EvadeChance', 'DeflectChance', 'Str', 'Dex', 'Int']) {
      expect(DEFAULTS.has(key)).toBe(true);
    }
    expect(DEFAULTS.size).toBeGreaterThanOrEqual(45);
  });

  it('AC-A6: every unfielded getStats( call under src/handlers, src/advice and src/services reads only default keys', () => {
    const problems: string[] = [];
    for (const file of SCANNED.flatMap(walkTs)) {
      const rel = path.relative(REPO, file);
      for (const read of unfieldedStatsReads(rel, fs.readFileSync(file, 'utf8'))) {
        if (read.untraced) problems.push(`${read.call}: cannot trace the reads: ${read.untraced}`);
        for (const key of read.keys) if (!DEFAULTS.has(key)) problems.push(`${read.call}: reads ${key}, not in the default list`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('AC-A6: the mapper finds the keys read from a bound result, a destructured one and through ?? / as', () => {
    const src = `
      async function a(c) { const s = await c.getStats(); return s.Life + s['TotalEHP'] + s.CritChance; }
      async function b(c) { const { Life, MinionTotalDPS, ...rest } = await c.getStats(); return Life; }
      async function d(c) { const s = ((await c.getStats()) ?? {}) as Record<string, any>; const { Accuracy } = s; return s.Mana; }
      async function e(c) { const s = await c.getStats(['Life']); return s.Anything; }
      async function f(c) { const s = await c.getStats(undefined); return s.Ward; }
    `;
    const reads = unfieldedStatsReads('x.ts', src);
    expect(reads.map((r) => r.keys)).toEqual([
      ['Life', 'TotalEHP', 'CritChance'],
      ['Life', 'MinionTotalDPS'],
      ['Accuracy', 'Mana'],
      ['Ward'],
    ]);
    expect(reads.every((r) => r.untraced === undefined)).toBe(true);
  });

  it('AC-A6: a result passed on, returned or read with a computed key is reported as untraceable', () => {
    const src = `
      async function a(c) { const s = await c.getStats(); return { stats: s }; }
      async function b(c) { return c.getStats(); }
      async function d(c, k) { const s = await c.getStats(); return s[k]; }
    `;
    const reads = unfieldedStatsReads('x.ts', src);
    expect(reads).toHaveLength(3);
    expect(reads.every((r) => typeof r.untraced === 'string')).toBe(true);
  });
});
