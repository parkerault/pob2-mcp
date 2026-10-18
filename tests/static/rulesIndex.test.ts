/**
 * WU-85 (amendment 8, D-401, AC-W71's static part): the committed rule-changer index in `data/rules/`.
 *
 * - Every line and block passes `rules-index.mjs check` (format, the shared vocabulary, pairs.md the join of the
 *   entries), run as a real `node` process on the committed directory.
 * - nodes.md has one line for every ascendancy notable and keystone of the pinned tree, and nothing else; Way of
 *   the Stonefist (39595) is `[rule]`, says "PoB models it: no", and pays off on the glove slot.
 * - No gem PoB marks legacy and no unique PoB marks no longer obtainable (D-384) heads a block. The oracle reads the
 *   pinned data files themselves: a skill whose block in `Data/Skills/*.lua` sets `legacy = true`, named by
 *   `Data/Gems.lua`, and a unique whose text in `Data/Uniques/` says `Source: No longer obtainable` or
 *   `League: Race Events` (PoB's ItemDBControl rule).
 * - uniques.md's head carries the one-line penalty rule, and no block carries a price.
 *
 * The script's check and join on fixtures are in tests/unit/rulesIndex.test.ts.
 */
import { describe, it, expect } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const RULES = path.join(REPO, 'data', 'rules');
const SCRIPT = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'rules-index.mjs');
const POB_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');

const read = (file: string) => fs.readFileSync(path.join(RULES, file), 'utf8');
/** The names heading a file's blocks: `### <Name> (<kind>, level|tier <n>)`. */
const blockNames = (file: string) =>
  read(file).split('\n').filter((l) => l.startsWith('### ')).map((l) => l.slice(4).replace(/ \([^()]*\)$/, ''));
/** A file's block lines: everything from its first block heading on, the names left out (headings and ids). */
const blockLines = (file: string) => {
  const lines = read(file).split('\n');
  return lines.slice(lines.findIndex((l) => l.startsWith('### '))).filter((l) => !l.startsWith('### ') && !l.startsWith('- Id: '));
};

/** The pinned latest tree's ascendancy notables and keystones, by id: from tree.json, kept where tree.lua has the node. */
function treeNodes(): Map<string, string> {
  const versions = /treeVersionList = \{([^}]*)\}/.exec(fs.readFileSync(path.join(POB_SRC, 'GameVersions.lua'), 'utf8'))![1];
  const latest = [...versions.matchAll(/"([^"]+)"/g)].map((m) => m[1]).pop()!;
  const dir = path.join(POB_SRC, 'TreeData', latest);
  const tree = JSON.parse(fs.readFileSync(path.join(dir, 'tree.json'), 'utf8')) as { nodes: Record<string, { name: string; ascendancyName?: string; isNotable?: boolean; isKeystone?: boolean }> };
  const lua = fs.readFileSync(path.join(dir, 'tree.lua'), 'utf8');
  const out = new Map<string, string>();
  for (const [id, node] of Object.entries(tree.nodes)) {
    const wanted = (node.ascendancyName && node.isNotable) || (!node.ascendancyName && node.isKeystone);
    if (wanted && lua.includes(`\t\t[${id}]={`)) out.set(id, node.name);
  }
  return out;
}

/** Gems PoB marks legacy: skills whose block sets `legacy = true`, named by Gems.lua's `grantedEffectId`. */
function legacyGems(): string[] {
  const skillsDir = path.join(POB_SRC, 'Data', 'Skills');
  const legacyIds = new Set<string>();
  for (const file of fs.readdirSync(skillsDir).filter((f) => f.endsWith('.lua'))) {
    const blocks = fs.readFileSync(path.join(skillsDir, file), 'utf8').split(/\n(?=skills\[")/);
    for (const block of blocks) {
      const id = /^skills\["([^"]+)"\]/.exec(block)?.[1];
      if (id && /^\tlegacy = true,$/m.test(block)) legacyIds.add(id);
    }
  }
  const gems = fs.readFileSync(path.join(POB_SRC, 'Data', 'Gems.lua'), 'utf8').split(/\n\t\["/);
  const names: string[] = [];
  for (const entry of gems) {
    const name = /\n\t\tname = "([^"]+)",/.exec(entry)?.[1];
    const effect = /\n\t\tgrantedEffectId = "([^"]+)",/.exec(entry)?.[1];
    if (name && effect && legacyIds.has(effect)) names.push(name);
  }
  return names;
}

/** Uniques PoB marks no longer obtainable: a text in Data/Uniques/ with that source or the Race Events league. */
function unobtainableUniques(): string[] {
  const dir = path.join(POB_SRC, 'Data', 'Uniques');
  const files = [
    ...fs.readdirSync(dir).filter((f) => f.endsWith('.lua')).map((f) => path.join(dir, f)),
    ...fs.readdirSync(path.join(dir, 'Special')).filter((f) => f.endsWith('.lua')).map((f) => path.join(dir, 'Special', f)),
  ];
  const names: string[] = [];
  for (const file of files) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\[\[\n?([\s\S]*?)\]\]/g)) {
      const lines = m[1].split('\n').map((l) => l.trim()).filter((l) => l !== '');
      if (lines.some((l) => l === 'Source: No longer obtainable' || l === 'League: Race Events')) names.push(lines[0]);
    }
  }
  return names;
}

describe('the committed rule-changer index (AC-W71, D-401)', () => {
  it('passes rules-index.mjs check: every line and block, the vocabulary, and pairs.md as the join', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'check', RULES], { env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 60000 });
    expect({ code: r.status, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(r.stdout).toMatch(/^rules-index check: ok \(\d+ \[rule\] nodes, \d+ uniques, \d+ gems\)\n$/);
  });

  it('nodes.md has one line for every ascendancy notable and keystone of the pinned tree, and no other', () => {
    const lines = read('nodes.md').split('\n').filter((l) => l.startsWith('- '));
    const listed = lines.map((l) => /^- (.+?) \((\d+), /.exec(l)!).map((m) => [m[2], m[1]] as [string, string]);
    const tree = treeNodes();
    expect(tree.size).toBeGreaterThan(200);
    expect(new Map(listed)).toEqual(tree);
    expect(listed).toHaveLength(tree.size);
  });

  it('Way of the Stonefist (39595) is [rule], pays off on the glove slot, and PoB models it: no', () => {
    const line = read('nodes.md').split('\n').find((l) => l.startsWith('- Way of the Stonefist (39595, Martial Artist)'));
    expect(line).toBeDefined();
    expect(line).toContain(' [rule] — ');
    expect(line).toMatch(/ \| pays off on: [a-z, -]*glove-slot[a-z, -]* \| PoB models it: no$/);
  });

  it('no gem PoB marks legacy heads a block, and no unique PoB marks no longer obtainable (D-384)', () => {
    const legacy = legacyGems();
    const unobtainable = unobtainableUniques();
    // The oracle finds what the pin holds (8 legacy gems and 7 unobtainable uniques at v0.23.1), Commandment among them.
    expect(legacy).toContain('Commandment');
    expect(legacy.length).toBeGreaterThan(0);
    expect(unobtainable.length).toBeGreaterThan(0);
    const gemNames = blockNames('gems.md');
    const uniqueNames = blockNames('uniques.md');
    expect(gemNames.length).toBeGreaterThan(0);
    expect(uniqueNames.length).toBeGreaterThan(0);
    expect(gemNames.filter((n) => legacy.includes(n))).toEqual([]);
    expect(uniqueNames.filter((n) => unobtainable.includes(n))).toEqual([]);
  });

  it("uniques.md's head carries the one-line penalty rule, and no block carries a price", () => {
    const text = read('uniques.md');
    const head = text.slice(0, text.indexOf('\n### '));
    const rule = head.split('\n').filter((l) => l.startsWith('Most uniques give up the resistances, life and defences a rare provides'));
    expect(rule).toHaveLength(1);
    expect(rule[0]).toMatch(/explicit|penalties/);
    const price = /\b\d+(\.\d+)?\s*(div|divines?|ex|exalts?|exalted)\b|\b(divine|exalted|chaos) orbs?\b|\bprice[sd]?\b|\bpricing\b/i;
    for (const file of ['uniques.md', 'gems.md']) {
      expect(blockLines(file).filter((l) => price.test(l))).toEqual([]);
    }
  });
});
