/**
 * AC-F19: the plumbing of the D-4 deletions is gone.
 *
 * - The equivalent of `rg -n "ToolGate|POB_LEGACY_GEM_TOOLS|get_mastery_options|getMasteryOptions|mastery_effects" src/ pob-api/`
 *   finds nothing.
 * - `masteryEffects` appears nowhere in `PoBLuaApiClient.calcWith` (`src/pobLuaBridge.ts`),
 *   `src/services/buildExportService.ts`, `src/handlers/treeHandlers.ts` or
 *   `src/handlers/exportHandlers.ts`. (The `lua_set_tree`/`setTree` occurrences are WU-10's, AC-E30.)
 * - The files listed in WU-04 don't exist (the whole list, costBenefitAnalyzer.ts included, per D-61).
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const REPO = path.resolve(__dirname, '..', '..');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function grep(re: RegExp, files: string[]): string[] {
  return files.flatMap((f) =>
    fs
      .readFileSync(f, 'utf8')
      .split('\n')
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => re.test(line))
      .map(({ line, i }) => `${path.relative(REPO, f)}:${i + 1}: ${line.trim()}`),
  );
}

/** The source text of `PoBLuaApiClient.calcWith` (signature and body). */
function calcWithText(): string {
  const file = path.join(REPO, 'src', 'pobLuaBridge.ts');
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found: string | null = null;
  const visit = (node: ts.Node): void => {
    if (ts.isMethodDeclaration(node) && node.name.getText(sf) === 'calcWith') found = node.getText(sf);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (found === null) throw new Error('calcWith not found in src/pobLuaBridge.ts');
  return found;
}

/**
 * WU-04's delete list ("Modules that become unreferenced", 01-foundation.md WU-04 summary), verbatim
 * and complete. AC-F19 bullet 3: "The files listed in WU-04 don't exist." A test below checks this
 * list against the spec text, so it can't be trimmed without the spec changing first.
 */
const WU04_DELETE_LIST = [
  'src/services/skillGemService.ts',
  'src/handlers/skillGemHandlers.ts',
  'src/skillLinkOptimizer.ts',
  'src/handlers/jewelAdvisorHandlers.ts',
  'src/handlers/clusterJewelHandlers.ts',
  'src/handlers/bossReadinessHandlers.ts',
  'src/handlers/advancedOptimizationHandlers.ts',
  'src/itemAnalyzer.ts',
  'src/handlers/shoppingListHandlers.ts',
  'src/services/shoppingListService.ts',
  'src/handlers/craftingAdvisorHandler.ts',
  'src/services/craftingDataService.ts',
  'src/handlers/itemShoppingHandler.ts',
  'src/services/itemRecommendationEngine.ts',
  'src/services/costBenefitAnalyzer.ts',
  'src/server/toolGate.ts',
];

/** The basenames in the spec's WU-04 "Modules that become unreferenced" bullet. */
function specDeleteListBasenames(): string[] {
  const spec = fs.readFileSync(path.join(REPO, 'docs', 'stabilization', 'spec', '01-foundation.md'), 'utf8');
  const block = spec.slice(spec.indexOf('### WU-04:'));
  const start = block.indexOf('Modules that become unreferenced:');
  const end = block.indexOf('the dead `tradeHandlers.handleFindItemUpgrades`');
  if (start < 0 || end < 0 || end < start) throw new Error('WU-04 delete list not found in 01-foundation.md');
  return [...block.slice(start, end).matchAll(/`([A-Za-z]+\.ts)`/g)].map((m) => m[1]);
}

describe('AC-F19: deleted plumbing', () => {
  it('AC-F19: no src/ or pob-api/ line mentions ToolGate, POB_LEGACY_GEM_TOOLS, get_mastery_options, getMasteryOptions or mastery_effects', () => {
    const files = [...walk(path.join(REPO, 'src')), ...walk(path.join(REPO, 'pob-api'))];
    expect(grep(/ToolGate|POB_LEGACY_GEM_TOOLS|get_mastery_options|getMasteryOptions|mastery_effects/, files)).toEqual([]);
  });

  it('AC-F19: calcWith takes no masteryEffects', () => {
    expect(calcWithText()).not.toMatch(/masteryEffects/);
  });

  it('AC-F19: buildExportService.ts, treeHandlers.ts and exportHandlers.ts never mention masteryEffects', () => {
    const files = ['src/services/buildExportService.ts', 'src/handlers/treeHandlers.ts', 'src/handlers/exportHandlers.ts'].map(
      (f) => path.join(REPO, f),
    );
    expect(grep(/masteryEffects/, files)).toEqual([]);
  });

  it('AC-F19: the delete list checked here is exactly the one WU-04 states in the spec', () => {
    expect(WU04_DELETE_LIST.map((f) => path.basename(f)).sort()).toEqual(specDeleteListBasenames().sort());
  });

  it('AC-F19: none of the modules WU-04 deletes exists', () => {
    expect(WU04_DELETE_LIST.filter((f) => fs.existsSync(path.join(REPO, f)))).toEqual([]);
  });
});
