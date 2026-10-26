/**
 * AC-W79 (WU-100; amendment 9 §24.4, D-425): the skill text names the researchers' new lookups and the Grep rule.
 *
 * - `R1a.md`'s discovery calls name each new lookup (the tree distance with `search_tree_nodes`' `from`, a gem's cost
 *   and Spirit by level, `mode: "base"`, `mode: "config"`, `kind: "constant"`), and its Grep rule: PoB's
 *   `vendor/PathOfBuilding-PoE2/src/Modules/` only for how the engine computes something, cited by file and line;
 *   data questions through the tools; no scratch builds (FR-W3). (`RV.md` said the same in short, until amendment 11
 *   removed the rival and its file, D-443.)
 * - The researcher's agent definition and `references/lookups.md` agree: each names the same lookups and the same
 *   rule, and the definition's tool list keeps the lookup set unchanged.
 * - The README tool table is regenerated: its rows for the two tools hold the first sentence of their current
 *   descriptions, which name `from` and the new data (the byte-for-byte check of the whole table is AC-G1's).
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { getLuaToolSchemas } from '../../src/server/toolSchemas';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL = path.join(REPO, '.claude', 'skills', 'build-guide');
const read = (p: string) => fs.readFileSync(p, 'utf8');
/** Whitespace runs folded to one space, so a phrase split by a hard wrap still matches. */
const folded = (t: string) => t.replace(/\s+/g, ' ');

const R1A = folded(read(path.join(SKILL, 'references', 'stages', 'R1a.md')));
const LOOKUPS = folded(read(path.join(SKILL, 'references', 'lookups.md')));
const RESEARCHER_RAW = read(path.join(REPO, '.claude', 'agents', 'build-guide', 'build-guide-researcher.md'));
const RESEARCHER = folded(RESEARCHER_RAW);
const README = read(path.join(REPO, 'README.md'));

const MODULES = '`vendor/PathOfBuilding-PoE2/src/Modules/`';

/** The new lookups, each as a pattern every text that lists them must match. */
const LOOKUPS_NAMED: Array<[string, RegExp]> = [
  ['the tree distance from the class start', /`from`|from: <class or ascendancy>/],
  ["a gem's cost and Spirit by level", /cost,? (?:(?:and|or) )?Spirit/],
  ['bases', /mode: "base"|"base"/],
  ['config options', /mode: "config"|"config"/],
  ['constants', /kind: "constant"/],
];

describe('AC-W79 (WU-100, D-425): the researchers\' lookups and the Grep rule in the skill text', () => {
  it('R1a.md: the discovery calls name the tree distance with `from`, a gem\'s per-level cost and Spirit, bases, config options and constants', () => {
    expect(R1A).toMatch(/with `from: <class or ascendancy>` \(`\{query, from: "Titan"\}`\) each main-tree hit gains `Distance: <n> points from <from>`, the passive points from the class start with no build loaded/);
    expect(R1A).toMatch(/a gem's cost and Spirit: `mcp__pob2__lookup_game_data \{mode: "gem", query\}` prints, per gem level, its cost, Spirit reservation, cooldown and stored uses/);
    expect(R1A).toMatch(/bases: `mcp__pob2__lookup_game_data \{mode: "base", slot: <item type>, level\?\}` lists an item type's bases/);
    expect(R1A).toMatch(/config options: `mcp__pob2__lookup_game_data \{mode: "config", query\}` finds PoB's config options by key or label/);
    expect(R1A).toMatch(/PoB's constants: `mcp__pob2__lookup_game_data \{mode: "mechanic", query, kind: "constant"\}` \(base maximum Rage is `BaseMaximumRage`\)/);
    // They sit in the discovery calls, before the supply search.
    const discovery = R1A.slice(R1A.indexOf('**Discovery calls**'), R1A.indexOf('**The supply search**'));
    for (const [what, re] of LOOKUPS_NAMED) expect({ what, named: re.test(discovery) }).toEqual({ what, named: true });
  });

  it('R1a.md: the Grep rule: PoB\'s Modules/ for how the engine computes, cited by file and line; data questions through the tools; no scratch builds', () => {
    expect(R1A).toMatch(/\*\*PoB's source, for how it computes only\*\* \(D-425\)\. A data question \(a gem's numbers, a base, a config option, a constant, how far a node is\) goes through the lookups below, never PoB's data files\./);
    expect(R1A).toContain(`You may Grep PoB's ${MODULES} to see how the engine computes something`);
    expect(R1A).toMatch(/cite what you read by file and line \(`Modules\/CalcOffence\.lua:1234`\)/);
    expect(R1A).toMatch(/No scratch builds: the server holds one loaded build \(FR-W3\), and you never load, change or compile one\./);
  });

  it('lookups.md and the researcher\'s definition agree with R1a: the same lookups and the same Grep rule', () => {
    // lookups.md documents each lookup's form.
    expect(LOOKUPS).toMatch(/\*\*Cost, Spirit and cooldown by gem level\*\* \(C-37a, D-425\)/);
    expect(LOOKUPS).toMatch(/`\{mode: "base", slot, level\?, query\?\}` \(C-37b, D-425\)/);
    expect(LOOKUPS).toMatch(/`\{mode: "config", query\}` \(C-37c, D-425\)/);
    expect(LOOKUPS).toMatch(/\*\*Constants\*\* \(C-37d, D-425\)\. PoB's game, character and monster constants .* `\[constant\] game: BaseMaximumRage = 30`/);
    expect(LOOKUPS).toMatch(/`mcp__pob2__search_tree_nodes` \(C-43\): .* With `from` \(C-43a, D-425: a class, an ascendancy for its class's start, a node id or an exact node name\), each main-tree hit gains `Distance: <n> points from <from>`/);
    expect(LOOKUPS).toMatch(/`kind` \(`gem`, `unique`, `passive`, `mod`, `essence`, `base` or `constant`\) lists one kind only/);

    // The rule, in both: Modules/ for how only, cited by file and line; data through the tools; no scratch builds.
    for (const [file, text] of [['lookups.md', LOOKUPS], ['build-guide-researcher.md', RESEARCHER]] as const) {
      expect({ file, modules: text.includes(`Grep PoB's ${MODULES}`) }).toEqual({ file, modules: true });
      expect({ file, cite: /by file and line/.test(text) }).toEqual({ file, cite: true });
      expect({ file, data: /A data question \(a gem's (?:numbers|cost or Spirit by level), a base, a config option, a constant, a node's distance(?: from the class start)?\) goes through (?:the|these) lookup/.test(text) }).toEqual({ file, data: true });
      expect({ file, scratch: /No scratch builds: the server holds one loaded build \(FR-W3\)/.test(text) }).toEqual({ file, scratch: true });
    }
    // The definition names the lookups the rule sends data questions to.
    const rule = RESEARCHER.slice(RESEARCHER.indexOf('**Data through the lookups; PoB\'s source for how only** (D-425)'));
    expect(rule.length).toBeGreaterThan(100);
    for (const [what, re] of LOOKUPS_NAMED) expect({ what, named: re.test(rule) }).toEqual({ what, named: true });
    // Its tool list doesn't change: the lookup set, no Bash, no compile.
    const tools = /^tools: (.*)$/m.exec(RESEARCHER_RAW)![1].split(', ');
    expect(tools).toEqual([
      'Read', 'Glob', 'Grep', 'Write', 'WebSearch', 'WebFetch', 'mcp__pob2__lookup_game_data', 'mcp__pob2__check_model_coverage',
      'mcp__pob2__search_tree_nodes', 'mcp__pob2__list_gems', 'mcp__pob2__get_classes',
    ]);
  });

  it('the README tool table is regenerated: the two tools\' rows hold their current descriptions\' first sentences', () => {
    const schemas = getLuaToolSchemas() as Array<{ name: string; description: string }>;
    const firstSentence = (d: string) => /^.*?[.!?](?=\s|$)/.exec(d.replace(/\s+/g, ' ').trim())![0];
    const search = firstSentence(schemas.find((t) => t.name === 'search_tree_nodes')!.description);
    const lookup = firstSentence(schemas.find((t) => t.name === 'lookup_game_data')!.description);
    expect(search).toMatch(/distance in passive points from a class start or a node when `from` is given\.$/);
    expect(lookup).toMatch(/\(gems, uniques, passives, item mods, essences, item bases, config options, constants\)/);
    expect(README).toContain(`| \`search_tree_nodes\` | core | ${search} |`);
    expect(README).toContain(`| \`lookup_game_data\` | core | ${lookup} |`);
  });
});
