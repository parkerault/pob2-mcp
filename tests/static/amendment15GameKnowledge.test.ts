/**
 * Amendment 15 (M-28, WU-147; D-503): game knowledge's `SKILL.md` and the legacy rule's move. The forms are read from
 * the amendment (§8, §19) where it states them, the pace from the shared rules, and the lookup's left-out lines from
 * the server's own code.
 *
 * - AC-W124: `skills/game-knowledge/SKILL.md` exists with fewer than 150 lines; its description names
 *   `/pob2:build-guide` for designing a build from a brief and, from amendment 16 (WU-162, D-519; a15 §8's rule that each
 *   piece's amendment adds its command), `/pob2:compile` for measuring or improving a player's PoB file, `/pob2:pricing`
 *   and `/pob2:writer`, a review of a file having no pob2 skill yet; it tells its runner to read `runner-rules.md` first; it carries the legacy rule; it says root-relative paths
 *   are under `${CLAUDE_PLUGIN_ROOT}`; its web scope is the one the user picked (§19, choice 1: poe2db.tw only, at
 *   D-497's pace).
 * - §8's rest, which the criterion rests on: the frontmatter as §3 allows it; the description's four uses and its
 *   other "not for"; the five lookup tools as its only pob2 tools; never a write, an agent, an engine change or a
 *   price; every plugin path in its body under `${CLAUDE_PLUGIN_ROOT}/` (§5); the reference entries it sends the
 *   reader to exist.
 * - D-503's move: `skills/build-guide/SKILL.md`'s hard rules no longer hold the legacy rule, which the shared rules
 *   point to game knowledge for (AC-W121's test).
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { leftOutLines } from '../../src/handlers/lookupHandlers';
import { TOOL_META } from '../../src/server/toolMeta';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...rel: string[]) => fs.readFileSync(path.join(REPO, ...rel), 'utf8');
/** The text with every whitespace run collapsed to one space, so a phrase split by a hard wrap is still seen. */
const folded = (text: string) => text.replace(/\s+/g, ' ');

const SPEC = folded(read('docs', 'build-guide', 'spec', 'amendment-15-plugin-and-knowledge.md'));
const RULES = folded(read('skills', 'build-guide', 'references', 'runner-rules.md'));
/** Read whole, never as empty text when missing: a missing file fails every test here loudly. */
const RAW = read('skills', 'game-knowledge', 'SKILL.md');
const FRONT = /^---\n([\s\S]*?)\n---\n/.exec(RAW);
const BODY_RAW = FRONT ? RAW.slice(FRONT[0].length) : RAW;
const BODY = folded(BODY_RAW);
/** The frontmatter's fields, one `key: value` line each. */
const FIELDS = new Map((FRONT?.[1] ?? '').split('\n').map((l) => [l.slice(0, l.indexOf(': ')), l.slice(l.indexOf(': ') + 2)] as [string, string]));
const DESCRIPTION = FIELDS.get('description') ?? '';

/** The amendment's text from `start` to `end`, both required. */
function specBetween(start: string, end: string): string {
  const at = SPEC.indexOf(start);
  const to = SPEC.indexOf(end, at + start.length);
  if (at < 0 || to < 0) throw new Error(`amendment 15 has no "${start}" … "${end}"`);
  return SPEC.slice(at + start.length, to);
}
/** Every mention of a web search in a text, the tool's name or the plain words. */
const webSearches = (text: string) => [...text.matchAll(/web\s?search/gi)].map((m) => m[0]);
/**
 * The server tools a text names, bare or with the `mcp__pob2__` prefix, other than `allowed` and `compile_plan` (the
 * legacy rule's): a name counts when no letter or digit stands on either side of it.
 */
function otherTools(text: string, allowed: string[]): string[] {
  return Object.keys(TOOL_META)
    .filter((t) => !allowed.includes(t) && t !== 'compile_plan')
    .filter((t) => new RegExp(`(?<![A-Za-z0-9])${t}(?![A-Za-z0-9])`).test(text));
}
/** The body's H2 section under `heading`, folded. */
function section(heading: string): string {
  const parts = BODY_RAW.split(/^(## .+)$/m);
  const i = parts.indexOf(heading);
  if (i < 0) throw new Error(`game knowledge's SKILL.md has no "${heading}"`);
  return folded(parts[i + 1]);
}

describe("AC-W124 (WU-147, D-503): game knowledge's SKILL.md", () => {
  it('exists with fewer than 150 lines (D-505)', () => {
    const lines = RAW.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    expect(lines.length).toBeGreaterThan(20);
    expect(lines.length).toBeLessThan(150);
  });

  it('has the frontmatter §3 allows: name game-knowledge and a one-line description within the 1,536 characters', () => {
    expect(FRONT).not.toBeNull();
    for (const line of FRONT![1].split('\n')) expect({ line, field: /^[a-z_-]+: \S/.test(line) }).toEqual({ line, field: true });
    expect([...FIELDS.keys()].every((k) => ['name', 'description', 'when_to_use'].includes(k))).toBe(true);
    expect(FIELDS.get('name')).toBe('game-knowledge');
    expect(DESCRIPTION.length + (FIELDS.get('when_to_use') ?? '').length).toBeLessThanOrEqual(1536);
    // A plain YAML scalar: no indicator first, no ': ' or ' #' inside, so the value reads as written.
    expect(DESCRIPTION).toMatch(/^[A-Za-z]/);
    expect(DESCRIPTION).not.toMatch(/: | #/);
  });

  it("its description gives §8's four uses and sends designing a build from a brief to /pob2:build-guide", () => {
    const uses = specBetween('**Description:** when to use it (', ') and when not (').split('; ');
    expect(uses).toEqual([
      'how a mechanic, gem, unique, passive or ascendancy works for a build',
      'what is new in the league',
      'whether PoB models something',
      'what counts as evidence for a claim',
    ]);
    for (const use of uses) expect({ use, named: DESCRIPTION.includes(use) }).toEqual({ use, named: true });
    expect(DESCRIPTION).toContain('/pob2:game-knowledge <question>');
    expect(DESCRIPTION).toContain('Not for designing a build from a brief (use /pob2:build-guide).');
  });

  // WU-162 (D-519, C-58 as amended): a player's PoB file goes to /pob2:compile now, its prices to /pob2:pricing, a guide
  // for a finished build to /pob2:writer; a review of a file is still no pob2 skill's (amendment 17).
  it("its description sends a player's PoB file to /pob2:compile, its prices to /pob2:pricing and a finished build's guide to /pob2:writer, and isn't for prices", () => {
    expect(DESCRIPTION).toContain("Not for measuring or improving the player's own PoB file (use /pob2:compile), what its gear costs or which rung it sits on (use /pob2:pricing), or a guide for a build already designed (use /pob2:writer); a review of a PoB file isn't a pob2 skill yet.");
    // /pob2:build-guide is named once, for a brief.
    expect(DESCRIPTION.match(/\/pob2:build-guide/g)).toHaveLength(1);
    expect(DESCRIPTION).toContain('Not for prices.');
  });

  it('tells its runner to read runner-rules.md whole before anything else, and again after a compaction', () => {
    const first = '**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again after a compaction';
    expect(BODY).toContain(first);
    // Before anything else: ahead of the body's first section.
    expect(BODY_RAW.indexOf('**Before anything else')).toBeGreaterThan(0);
    expect(BODY_RAW.indexOf('**Before anything else')).toBeLessThan(BODY_RAW.indexOf('\n## '));
    expect(fs.existsSync(path.join(REPO, 'skills', 'build-guide', 'references', 'runner-rules.md'))).toBe(true);
  });

  it("carries the legacy rule (D-395), quoting the lookup's left-out lines as the server prints them", () => {
    const legacy = section('## Legacy means not in the game');
    expect(legacy).toMatch(/\*\*Legacy means not in the game\*\* \(D-395\): no build uses a gem PoB marks legacy or a unique PoB says is no longer obtainable\. `Tier = 0` alone isn't legacy/);
    const [gem] = leftOutLines({ legacyGems: ['<name>'], unobtainableUniques: [] } as Parameters<typeof leftOutLines>[0]);
    const [unique] = leftOutLines({ legacyGems: [], unobtainableUniques: ['<name>'] } as Parameters<typeof leftOutLines>[0]);
    expect(gem).toBe('Left out: <name>, which PoB marks legacy: it is no longer in the game.');
    expect(legacy).toContain(`\`${gem}\` for a gem`);
    expect(legacy).toContain(`\`${unique}\` for a unique`);
    expect(legacy).toContain('`mcp__pob2__compile_plan` refuses them');
    expect(legacy).toContain("So the answer for one is that no build can use it, because it isn't in the game");
    expect(legacy).toContain('is dropped the same way');
  });

  it("says root-relative paths are under ${CLAUDE_PLUGIN_ROOT}", () => {
    expect(BODY).toContain('A root-relative path in its references is under `${CLAUDE_PLUGIN_ROOT}`, the plugin root.');
  });

  it("its web is the user's choice 1: poe2db.tw only, at D-497's pace, no WebSearch and no other host", () => {
    expect(specBetween('1. **Game knowledge\'s web.** Recommended: ', ',')).toBe('poe2db.tw only');
    const never = section('## What you never do');
    expect(never).toContain('**Fetch from the web beyond the user\'s scope** (amendment 15 §19, choice 1): **poe2db.tw only**, with WebFetch');
    // D-497's pace, as the shared rules state it.
    const pace = /at the league digest's pace: (one at a time, [^.]*, and nothing fetched twice)\./.exec(RULES)![1];
    expect(pace).toBe('one at a time, at least 3 s apart, no cookie, one retry after 60 s on a 429 or 5xx, and nothing fetched twice');
    expect(never).toContain(`at the league digest's pace (D-497): ${pace}.`);
    expect(never).toContain('No WebSearch and no other host; never pathofexile.com or poe.ninja.');
    // A web search is named only to rule it out: no sentence that allows one, even with no host named.
    expect(webSearches(RAW)).toEqual(['WebSearch']);
    // No other host anywhere in the file, D-171's among them.
    const hosts = new Set([...RAW.matchAll(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|tw|gg|net|org|io|ninja|wiki|co)\b/gi)].map((m) => m[0].toLowerCase()));
    expect([...hosts].sort()).toEqual(['pathofexile.com', 'poe.ninja', 'poe2db.tw']);
    const d171 = specBetween('The run settings deny every other host D-171 names (', ')').split(', ');
    expect(d171).toEqual(['maxroll.gg', 'game8', 'poe-vault']);
    for (const host of d171) expect({ host, named: RAW.toLowerCase().includes(host) }).toEqual({ host, named: false });
  });

  it('the web-search check fails on a body that allows a web search, with no host named', () => {
    expect(webSearches('No WebSearch and no other host.')).toEqual(['WebSearch']);
    expect(webSearches('No WebSearch and no other host. Use WebSearch when poe2db lacks it.')).toEqual(['WebSearch', 'WebSearch']);
    expect(webSearches('No WebSearch and no other host. Run a web search when poe2db lacks it.')).toEqual(['WebSearch', 'web search']);
  });
});

describe("D-503 (WU-147): what game knowledge's SKILL.md answers with, and never does", () => {
  it('its pob2 tools are the five lookups §8 names, each a server tool; compile_plan only as what refuses legacy content', () => {
    const tools = [...specBetween('**How it answers:** in the session, with the lookup tools (', ')').matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
    expect(tools).toEqual(['lookup_game_data', 'check_model_coverage', 'search_tree_nodes', 'list_gems', 'get_classes']);
    for (const tool of tools) expect({ tool, meta: tool in TOOL_META }).toEqual({ tool, meta: true });
    const never = section('## What you never do');
    for (const tool of tools) expect(never).toContain(`\`mcp__pob2__${tool}\``);
    const named = new Set([...BODY.matchAll(/mcp__pob2__([a-z_]+)/g)].map((m) => m[1]));
    expect([...named].filter((t) => t !== 'compile_plan').sort()).toEqual([...tools].sort());
    expect(never).not.toContain('compile_plan');
    // And no other server tool by its bare name, but compile_plan, which the legacy rule names as what refuses it.
    expect(Object.keys(TOOL_META).length).toBeGreaterThan(80);
    expect(otherTools(RAW, tools)).toEqual([]);
    expect(section('## Legacy means not in the game')).toContain('`mcp__pob2__compile_plan`');
  });

  it('the bare-name check fails on another server tool named bare or prefixed, and passes the lookups and compile_plan', () => {
    const tools = ['lookup_game_data', 'check_model_coverage', 'search_tree_nodes', 'list_gems', 'get_classes'];
    expect(otherTools('then run lua_get_stats on the build', tools)).toEqual(['lua_get_stats']);
    expect(otherTools('read get_build_stats.', tools)).toEqual(['get_build_stats']);
    expect(otherTools('`mcp__pob2__get_item_price` for a price', tools)).toEqual(['get_item_price']);
    expect(otherTools('`mcp__pob2__lookup_game_data`, get_classes, and `mcp__pob2__compile_plan` refuses them', tools)).toEqual([]);
  });

  it('never writes a file, starts an agent, changes the engine\'s build or prices; it searches with grep through Bash (D-515, AC-W142 below)', () => {
    const never = section('## What you never do');
    expect(never).toContain("**Write a file, start an agent or change the engine's build.**");
    expect(never).toContain('No other pob2 tool: nothing that loads, adds, sets, toggles or compiles.');
    expect(never).toContain('**Price anything:** no trade, exchange or currency-rate call.');
    // Amendment 16 (WU-156, D-515): "You need no Bash" was wrong for its runner, which has Bash and so no Grep or Glob.
    expect(BODY).toContain('Search with `grep` through Bash, as the runner rules allow, and Read a file whole (D-515).');
  });

  it('sends the reader to entries its references hold: the library\'s, the lookups\', the source markers\'', () => {
    const entries: [string, string][] = [
      ['patterns.md', '### Supply by family'],
      ['patterns.md', '### A rule changer'],
      ['patterns.md', '## How to read an entry'],
      ['lookups.md', '## The lookup set L'],
      ['lookups.md', '## Reading `mcp__pob2__check_model_coverage`'],
      ['source-markers.md', '## Source tags'],
    ];
    for (const [file, heading] of entries) {
      const text = read('skills', 'game-knowledge', 'references', file);
      const title = heading.replace(/^#+ /, '');
      expect({ file, heading, held: text.split('\n').some((l) => l.startsWith(heading)) }).toEqual({ file, heading, held: true });
      expect({ title, named: BODY.includes(`"${title}"`) }).toEqual({ title, named: true });
    }
  });
});

/** The root folders: the folders at the plugin root, but its dot-folders and the install's own. */
const ROOT_FOLDERS = fs
  .readdirSync(REPO, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !['node_modules', 'coverage'].includes(e.name))
  .map((e) => e.name);
/** The text with its fenced code blocks blanked, so their fences don't pair with inline backticks. */
const withoutFences = (text: string) => text.replace(/^[ \t]*(`{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, (b) => b.replace(/[^\n]/g, ' '));
/** §5: every root-relative plugin path in a skill body, in a code span or in prose, without `${CLAUDE_PLUGIN_ROOT}/`. */
function unprefixed(body: string): string[] {
  const text = withoutFences(body);
  const roots = ROOT_FOLDERS.join('|');
  const out: string[] = [];
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    const span = folded(m[1]).trim();
    for (const t of span.matchAll(new RegExp(`(?:^|(?<=[\\s(]))(\\$\\{CLAUDE_PLUGIN_ROOT\\}\\/|<root>\\/)?(?:${roots})\\/(?!>)`, 'g'))) {
      if (t[1] !== '${CLAUDE_PLUGIN_ROOT}/') out.push(span);
    }
  }
  const prose = text.replace(/`[^`]+`/g, (span) => span.replace(/[^\n]/g, ' '));
  for (const m of prose.matchAll(new RegExp(`(?<![\\w/.$}>-])(?:${roots})\\/[\\w./-]*\\.(?:md|json|mjs|sh|ts|lua)\\b`, 'g'))) out.push(m[0]);
  return out;
}

describe("D-500 (WU-147): game knowledge's SKILL.md names plugin files under ${CLAUDE_PLUGIN_ROOT}", () => {
  it('every root-relative plugin path in its body carries ${CLAUDE_PLUGIN_ROOT}/ and resolves', () => {
    expect(unprefixed(BODY_RAW)).toEqual([]);
    const prefixed = [...BODY_RAW.matchAll(/`\$\{CLAUDE_PLUGIN_ROOT\}\/([^`\s]+)/g)].map((m) => m[1]);
    expect(prefixed.length).toBeGreaterThan(10);
    for (const p of prefixed) {
      const cut = p.search(/[<*{#…|]/);
      const target = cut < 0 ? p.replace(/[.,:;)]+$/, '') : p.slice(0, p.lastIndexOf('/', cut) + 1);
      expect({ p, exists: fs.existsSync(path.join(REPO, target)) }).toEqual({ p, exists: true });
    }
  });

  it('the check fails on an unprefixed path in a span or in prose, and passes the prefixed form', () => {
    expect(unprefixed('read `data/rules/nodes.md` whole')).toEqual(['data/rules/nodes.md']);
    expect(unprefixed('Grep `-i x` across `data/rules/`')).toEqual(['data/rules/']);
    expect(unprefixed('as skills/game-knowledge/references/patterns.md says')).toEqual(['skills/game-knowledge/references/patterns.md']);
    expect(unprefixed('read `${CLAUDE_PLUGIN_ROOT}/data/rules/nodes.md`, `[data | rules/nodes.md#<node id>]`')).toEqual([]);
  });
});

describe("D-503 (WU-147): the legacy rule's move out of build-guide's hard rules", () => {
  it("skills/build-guide/SKILL.md's hard rules no longer hold the legacy rule; the shared rules point to game knowledge", () => {
    const skill = read('skills', 'build-guide', 'SKILL.md');
    const hard = skill.slice(skill.indexOf('## Hard rules'), skill.indexOf('\n## ', skill.indexOf('## Hard rules') + 1));
    expect(hard.length).toBeGreaterThan(500);
    expect(hard).toContain('**Read only what routes the run:**');
    expect(folded(skill)).not.toContain('Legacy means not in the game');
    expect(skill).not.toContain('D-395');
    expect(RULES).toContain("The legacy rule (D-395) is game knowledge's");
  });
});

describe("AC-W142 (WU-156, D-515): game knowledge's runner searches with grep through Bash; the agent types name no Bash", () => {
  /** The body's lines, each with its number. */
  const bodyLines = BODY_RAW.split('\n');

  it('no longer says "You need no Bash", and tells its runner to search with grep through Bash and Read a file whole', () => {
    expect(BODY).not.toContain('You need no Bash');
    expect(BODY).not.toMatch(/Read, Grep and Glob/);
    expect(BODY).toContain('Search with `grep` through Bash, as the runner rules allow, and Read a file whole (D-515).');
    // As the runner rules allow: their Bash list holds grep, alone or piped, with no flag that writes a file.
    const bash = RULES.slice(RULES.indexOf('## Your Bash'), RULES.indexOf('Nothing else:'));
    expect(bash).toContain('`ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq`, alone or piped into one another');
    expect(BODY_RAW.indexOf('Search with `grep` through Bash')).toBeLessThan(BODY_RAW.indexOf('\n## '));
  });

  // WU-151 (D-507) rewrote the league bullet with `grep` through Bash, so the check covers every line.
  it('its other search lines name grep the same way: no Glob, and no Grep anywhere in the body', () => {
    expect(BODY_RAW).not.toMatch(/\bGlob\b/);
    const grepTool = bodyLines.map((l, i) => ({ i, l })).filter(({ l }) => /\bGrep\b/.test(l));
    expect(grepTool).toEqual([]);
    for (const line of [
      'each head whole, newest first, the body by `grep` through Bash.',
      '`grep` `${CLAUDE_PLUGIN_ROOT}/data/rules/uniques.md` and',
      '`${CLAUDE_PLUGIN_ROOT}/data/monsters/monster-mods.md`, by `grep`,',
      '**How PoB computes something:** `grep` PoB\'s source under',
      '(`grep` its `### ` lines)',
      "`grep -i 'creates: [^|]*<family>'`",
      '**`grep` the committed data**',
      '**PoB\'s known gaps and bugs:** `grep` `${CLAUDE_PLUGIN_ROOT}/docs/build-guide/pob-gaps.md`',
    ]) {
      expect({ line, held: BODY_RAW.includes(line) }).toEqual({ line, held: true });
    }
  });

  it('stays under 150 lines (D-505)', () => {
    const lines = RAW.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    expect(lines.length).toBeLessThan(150);
  });

  it("no agent definition names Bash (slice 03's R-4): the four types keep Read, Glob and Grep", () => {
    const AGENTS = path.join(REPO, 'agents');
    const files = fs.readdirSync(AGENTS).filter((f) => f.endsWith('.md')).sort();
    expect(files).toEqual(['build-guide-coordinator.md', 'build-guide-researcher.md', 'build-guide-verifier.md', 'build-guide-writer.md']);
    for (const file of files) {
      const front = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(path.join(AGENTS, file), 'utf8'));
      const toolsLine = (front?.[1] ?? '').split('\n').find((l) => l.startsWith('tools: ')) ?? '';
      const tools = toolsLine.slice('tools: '.length).split(',').map((t) => t.trim());
      expect({ file, bash: tools.includes('Bash'), search: ['Read', 'Glob', 'Grep'].every((t) => tools.includes(t)) }).toEqual({ file, bash: false, search: true });
    }
  });
});
