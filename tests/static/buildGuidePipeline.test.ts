/**
 * Static checks over the build-guide pipeline files (slice 03 §14): the skill
 * (`.claude/skills/build-guide/`), and later its workflows and agent definitions.
 *
 * AC-W1 (WU-43): SKILL.md exists with frontmatter `name: build-guide` and a description; it names both
 * workflows, the five agent types of §4, `--offline` and `--test`; and every `references/`, `templates/`
 * and `scripts/` path it mentions exists.
 *
 * AC-W5 (WU-44; WU-45 and WU-46 extend it with their definitions): every `.claude/agents/build-guide/*.md`
 * satisfies §4's rules R-1…R-5, its `tools:` line checked against the tool sets L, B, C and P and against
 * `TOOL_META`; each set's members exist there, and L and B hold only group-`core`, kind-`read` tools that
 * write nothing. With it, WU-44's stage references (R1a, R1b, R1b-assemble, dossier-fix) and the dossier
 * template (§7.2).
 *
 * WU-45: the design stage references (D1, D1-gate, D2, D2-gate, W1), the writer definition and the
 * coordinator's design steps (AC-W5 extended), and the guide template (AC-W11, §8).
 *
 * WU-46: the provenance and verifier definitions (AC-W5 extended, AC-W14's static half), the V3, V4 and
 * revise-map stage references, the coordinator's revision section and the fallback's routing. AC-W14's
 * comparison of the fallback's step tables with the harness's record is in
 * `tests/unit/buildGuideWorkflows.test.ts`, beside the harness runs it compares against.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { TOOL_META } from '../../src/server/toolMeta';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');

const WORKFLOWS = ['build-guide-research', 'build-guide-design'];
/** Slice 03 §4: the five agent types. */
const AGENT_TYPES = [
  'build-guide-researcher',
  'build-guide-coordinator',
  'build-guide-writer',
  'build-guide-provenance',
  'build-guide-verifier',
];

/** The frontmatter's `key: value` lines (no YAML parser, HG-10). */
function frontmatter(text: string): Record<string, string> | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) return null;
  const out: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

/** Every `references/…`, `templates/…` and `scripts/…` path the text mentions, as written. */
function mentionedPaths(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?<![A-Za-z0-9_-])((?:references|templates|scripts)\/[^\s`'"),;]*)/g)) {
    found.add(m[1].replace(/[.:]+$/, ''));
  }
  return [...found];
}

/** The file or folder a mentioned path must name: a pattern (`stages/<stage>.md`) needs its folder. */
function mustExist(mentioned: string): string {
  const cut = mentioned.indexOf('<');
  const fixed = cut < 0 ? mentioned : mentioned.slice(0, mentioned.lastIndexOf('/', cut) + 1);
  return path.join(SKILL_DIR, fixed);
}

describe('AC-W1: the build-guide skill', () => {
  const text = fs.existsSync(SKILL_MD) ? fs.readFileSync(SKILL_MD, 'utf8') : '';

  it('has SKILL.md with frontmatter name build-guide and a description', () => {
    expect(fs.existsSync(SKILL_MD)).toBe(true);
    const fm = frontmatter(text);
    expect(fm).not.toBeNull();
    expect(fm!.name).toBe('build-guide');
    expect(fm!.description.length).toBeGreaterThan(40);
  });

  it('names both workflows, the five agent types, --offline and --test', () => {
    for (const name of [...WORKFLOWS, ...AGENT_TYPES, '--offline', '--test']) {
      expect({ name, named: text.includes(name) }).toEqual({ name, named: true });
    }
  });

  it('mentions only references/, templates/ and scripts/ paths that exist', () => {
    const paths = mentionedPaths(text);
    // The skill points at its shared references and its run checker; an empty scan would prove nothing.
    expect(paths).toEqual(expect.arrayContaining(['scripts/check-run.mjs', 'references/run-log.md', 'references/fallback.md']));
    for (const p of paths) {
      expect({ path: p, exists: fs.existsSync(mustExist(p)) }).toEqual({ path: p, exists: true });
    }
  });

  it('lists every shared reference it ships', () => {
    const shipped = fs
      .readdirSync(path.join(SKILL_DIR, 'references'), { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => `references/${e.name}`);
    for (const ref of shipped) expect({ ref, listed: text.includes(ref) }).toEqual({ ref, listed: true });
  });

  it('finds paths the way the existence check reads them', () => {
    expect(mentionedPaths('see `references/run-log.md`, then scripts/check-run.mjs.')).toEqual(['references/run-log.md', 'scripts/check-run.mjs']);
    expect(mentionedPaths('node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>')).toEqual(['scripts/check-run.mjs']);
    expect(mustExist('references/stages/<stage>.md')).toBe(path.join(SKILL_DIR, 'references/stages/'));
    expect(mentionedPaths('my-references/x.md and prereferences/y')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W5 (WU-44; extended by WU-45 and WU-46): the agent definitions and their allowlists (§4)
// ---------------------------------------------------------------------------------------------------

const AGENTS_DIR = path.join(REPO, '.claude', 'agents', 'build-guide');

/** §4's tool sets (server `pob2`). */
const L = ['lookup_game_data', 'check_model_coverage', 'search_tree_nodes', 'list_gems', 'get_classes'];
const B = [
  'lua_get_stats',
  'lua_get_build_info',
  'lua_get_tree',
  'get_equipped_items',
  'get_skill_setup',
  'analyze_skills',
  'get_config',
  'analyze_defenses',
  'validate_build',
  'get_build_issues',
  'suggest_supports',
  'get_passive_upgrades',
  'get_nearby_nodes',
  'find_path_to_node',
  'list_specs',
  'list_item_sets',
];
const C = ['compile_plan', 'guide_run', 'encode_build_code'];
const P = ['get_item_price', 'search_trade_items', 'search_stats', 'get_leagues', 'trade_query_options', 'get_currency_rates'];
/** `read`-kind tools that still write (into the builds folder or the state dir): never in L or B (§1). */
const WRITING_READS = ['lua_save_build', 'export_build', 'save_config_preset'];

/**
 * §4's table: each type's file tools, `pob2` tools and web tools. The allowlist probe (AC-W23) reached the
 * lookup tools directly, without ToolSearch, so no row gains ToolSearch.
 */
const ROWS: Record<string, { file: string[]; pob2: string[]; web: string[] }> = {
  'build-guide-researcher': { file: ['Read', 'Glob', 'Grep', 'Write'], pob2: L, web: ['WebSearch', 'WebFetch'] },
  'build-guide-coordinator': { file: ['Read', 'Glob', 'Grep', 'Write', 'Edit'], pob2: [...L, ...B, ...C, ...P], web: ['WebSearch', 'WebFetch'] },
  'build-guide-writer': { file: ['Read', 'Glob', 'Grep', 'Write', 'Edit'], pob2: [], web: [] },
  'build-guide-provenance': { file: ['Read', 'Glob', 'Grep'], pob2: [], web: [] },
  'build-guide-verifier': { file: ['Read', 'Glob', 'Grep'], pob2: L, web: ['WebFetch'] },
};
/** R-4: tools no definition names. */
const NEVER = ['Bash', 'Agent', 'Skill', 'Workflow', 'NotebookEdit'];
/** R-5: V3 and V4 can't write. */
const NO_WRITE = ['build-guide-provenance', 'build-guide-verifier'];
const WRITE_TOOLS = ['Write', 'Edit', 'NotebookEdit'];
const POB2 = 'mcp__pob2__';

interface Definition {
  /** The frontmatter's lines, raw. */
  lines: string[];
  fm: Record<string, string>;
  tools: string[];
  body: string;
}

function readDefinition(text: string): Definition | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!m) return null;
  const fm = frontmatter(text) ?? {};
  const tools = (fm.tools ?? '').split(',').map((t) => t.trim());
  return { lines: m[1].split(/\r?\n/), fm, tools, body: m[2] };
}

/** Every rule of §4 a definition breaks, as `R-n: why`; empty when it satisfies R-1…R-5. */
function violations(stem: string, text: string): string[] {
  const out: string[] = [];
  const def = readDefinition(text);
  if (!def) return ['R-1: no frontmatter'];
  // R-1: name equals the stem; tools is one comma-separated line (no YAML parser, HG-10).
  if (def.fm.name !== stem) out.push(`R-1: name is ${JSON.stringify(def.fm.name)}, the file stem is "${stem}"`);
  const toolLines = def.lines.filter((l) => /^tools\s*:/.test(l));
  if (toolLines.length !== 1) out.push(`R-1: ${toolLines.length} tools: lines`);
  const at = def.lines.findIndex((l) => /^tools\s*:/.test(l));
  if (at >= 0 && at + 1 < def.lines.length && /^\s+(-|\S)/.test(def.lines[at + 1])) out.push('R-1: tools continues past its line');
  if (def.tools.length === 0 || def.tools.some((t) => !/^[A-Za-z][\w-]*$/.test(t))) out.push(`R-1: tools isn't a comma-separated list: ${def.fm.tools}`);
  if (new Set(def.tools).size !== def.tools.length) out.push('R-1: tools names a tool twice');
  const row = ROWS[stem];
  if (!row) return [...out, `${stem} is none of §4's five agent types`];
  const pob2 = def.tools.filter((t) => t.startsWith(POB2)).map((t) => t.slice(POB2.length));
  // R-2: the tools are a subset of the type's row.
  for (const t of def.tools) {
    const allowed = t.startsWith(POB2) ? row.pob2.includes(t.slice(POB2.length)) : row.file.includes(t) || row.web.includes(t);
    if (!allowed) out.push(`R-2: ${t} isn't in ${stem}'s row`);
  }
  // R-3: only the coordinator names a C or P tool.
  if (stem !== 'build-guide-coordinator') {
    for (const t of pob2.filter((n) => C.includes(n) || P.includes(n))) out.push(`R-3: ${t} compiles or prices; only the coordinator may`);
  }
  // R-4: no Bash, Agent, Skill, Workflow or NotebookEdit; no pob2 tool outside L, B, C and P, nor one the
  // server doesn't have; no other MCP server.
  for (const t of def.tools.filter((n) => NEVER.includes(n))) out.push(`R-4: names ${t}`);
  for (const t of pob2) {
    if (![...L, ...B, ...C, ...P].includes(t)) out.push(`R-4: ${POB2}${t} is outside L, B, C and P`);
    if (!Object.prototype.hasOwnProperty.call(TOOL_META, t)) out.push(`R-4: ${POB2}${t} isn't a tool of the server (TOOL_META)`);
  }
  for (const t of def.tools.filter((n) => n.startsWith('mcp__') && !n.startsWith(POB2))) out.push(`R-4: ${t} isn't a pob2 tool`);
  // R-5: V3 and V4 can't write.
  if (NO_WRITE.includes(stem)) for (const t of def.tools.filter((n) => WRITE_TOOLS.includes(n))) out.push(`R-5: ${stem} names ${t}`);
  return out;
}

const definitionFiles = fs.existsSync(AGENTS_DIR) ? fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md')).sort() : [];

describe('AC-W5: the tool sets of §4', () => {
  it('every member of L, B, C and P is a tool of the server', () => {
    for (const t of [...L, ...B, ...C, ...P]) {
      expect({ tool: t, exists: Object.prototype.hasOwnProperty.call(TOOL_META, t) }).toEqual({ tool: t, exists: true });
    }
  });

  it('L and B hold only group-core, kind-read tools, none of them a read that writes', () => {
    for (const t of [...L, ...B]) {
      expect({ tool: t, ...TOOL_META[t] }).toEqual({ tool: t, engine: 'read', group: 'core' });
      expect(WRITING_READS).not.toContain(t);
    }
  });

  it('C compiles, validates and encodes in group core; P is the trade and poe.ninja groups', () => {
    for (const t of C) expect({ tool: t, group: TOOL_META[t].group }).toEqual({ tool: t, group: 'core' });
    for (const t of P) expect(['trade', 'ninja']).toContain(TOOL_META[t].group);
  });
});

describe('AC-W5: the agent definitions satisfy R-1…R-5', () => {
  it('holds only the five agent types of §4, the researcher and the coordinator among them (WU-44)', () => {
    const stems = definitionFiles.map((f) => f.replace(/\.md$/, ''));
    for (const s of stems) expect(AGENT_TYPES).toContain(s);
    expect(stems).toEqual(expect.arrayContaining(['build-guide-researcher', 'build-guide-coordinator']));
  });

  it.each(definitionFiles)('%s breaks none of R-1…R-5', (file) => {
    const text = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
    expect(violations(file.replace(/\.md$/, ''), text)).toEqual([]);
  });

  it.each(definitionFiles)('%s has a description that frontmatter reads as one plain line', (file) => {
    const def = readDefinition(fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8'))!;
    expect(def.fm.description.length).toBeGreaterThan(40);
    // A plain YAML scalar may not hold ": " or " #": Claude Code would drop the definition.
    expect(def.fm.description).not.toMatch(/: | #/);
  });

  it.each(definitionFiles)("%s holds §4's standing rules", (file) => {
    const { body } = readDefinition(fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8'))!;
    // §4: write only inside the run folder; never read .env; web only on D-171's hosts, never
    // pathofexile.com or poe.ninja; the offline-mode rules (§11.1).
    for (const rule of ['run folder', '.env', 'pathofexile.com', 'poe.ninja', 'offline']) {
      expect({ file, rule, stated: body.includes(rule) }).toEqual({ file, rule, stated: true });
    }
  });

  it('the researcher reaches the lookups it consumes, and only the coordinator compiles and prices', () => {
    const tools = (stem: string) => readDefinition(fs.readFileSync(path.join(AGENTS_DIR, `${stem}.md`), 'utf8'))!.tools;
    // C-37, C-38, C-43: the researcher's lookups, each named (an allowlist drops unnamed MCP tools, A-24).
    expect(tools('build-guide-researcher')).toEqual(expect.arrayContaining(L.map((t) => POB2 + t)));
    expect(tools('build-guide-coordinator')).toEqual(expect.arrayContaining([...C, ...P].map((t) => POB2 + t)));
  });

  it('finds each rule broken in a definition that breaks it', () => {
    const def = (name: string, tools: string) => `---\nname: ${name}\ndescription: a test definition for the rule checks\ntools: ${tools}\n---\n\nbody\n`;
    const r = 'build-guide-researcher';
    expect(violations(r, def(r, `Read, Write, ${POB2}lookup_game_data`))).toEqual([]);
    expect(violations(r, def('researcher', 'Read'))).toEqual([expect.stringMatching(/^R-1: name/)]);
    expect(violations(r, `---\nname: ${r}\ndescription: d\ntools:\n  - Read\n---\n`)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^R-1: tools continues/)]),
    );
    expect(violations(r, def(r, 'Read, Edit'))).toEqual(['R-2: Edit isn\'t in build-guide-researcher\'s row']);
    expect(violations(r, def(r, `Read, ${POB2}compile_plan`))).toEqual([
      `R-2: ${POB2}compile_plan isn't in build-guide-researcher's row`,
      'R-3: compile_plan compiles or prices; only the coordinator may',
    ]);
    expect(violations('build-guide-coordinator', def('build-guide-coordinator', 'Read, Bash'))).toEqual([
      "R-2: Bash isn't in build-guide-coordinator's row",
      'R-4: names Bash',
    ]);
    expect(violations('build-guide-coordinator', def('build-guide-coordinator', `Read, ${POB2}lua_save_build, ${POB2}add_item`))).toEqual(
      expect.arrayContaining([`R-4: ${POB2}lua_save_build is outside L, B, C and P`, `R-4: ${POB2}add_item is outside L, B, C and P`]),
    );
    expect(violations('build-guide-coordinator', def('build-guide-coordinator', `Read, ${POB2}no_such_tool`))).toEqual(
      expect.arrayContaining([`R-4: ${POB2}no_such_tool isn't a tool of the server (TOOL_META)`]),
    );
    expect(violations('build-guide-verifier', def('build-guide-verifier', 'Read, Write'))).toEqual([
      "R-2: Write isn't in build-guide-verifier's row",
      'R-5: build-guide-verifier names Write',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------
// WU-44: the research stage references and the dossier template (§5.2, §7.2)
// ---------------------------------------------------------------------------------------------------

const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const RESEARCH_STAGES = ['R1a', 'R1b', 'R1b-assemble', 'dossier-fix'];
const DOSSIER_TEMPLATE = path.join(SKILL_DIR, 'templates', 'dossier-template.md');
/** §7.2: the dossier's H2s, in order. */
const DOSSIER_H2 = ['Roll and mode', 'Mechanics', 'Synergy search', 'Config gaps', 'Concepts', 'Not carried'];
/** C-36's seven proposal fields, then the R1b result (§7.2). */
const CONCEPT_FIELDS = [
  'Key uniques',
  'Ascendancy nodes',
  'Supports',
  'Keystones',
  'Feasibility read',
  'Risks',
  "What PoB can't verify",
  'Skeleton',
  'Compile',
  'Record',
  'Key numbers',
  'Key-item prices',
];

/** Headings outside fenced blocks, with their line numbers. */
function headings(text: string): { level: number; title: string; line: number }[] {
  const out: { level: number; title: string; line: number }[] = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced) {
      const h = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
      if (h) out.push({ level: h[1].length, title: h[2], line: i });
    }
  });
  return out;
}

/** Repository paths a file mentions in backticks: `.claude/…`, `docs/…`, `data/…`, `pob-pin.json`. */
function repoPaths(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/`((?:\.claude|docs|data)\/[^`\s]*|pob-pin\.json)`/g)) found.add(m[1]);
  return [...found];
}

describe('WU-44: the research stage references', () => {
  it.each(RESEARCH_STAGES)("%s.md exists, with the parts the stages README names", (stage) => {
    const file = path.join(STAGES_DIR, `${stage}.md`);
    expect(fs.existsSync(file)).toBe(true);
    const titles = headings(fs.readFileSync(file, 'utf8')).filter((h) => h.level === 2).map((h) => h.title);
    for (const part of ['Inputs', 'Work', 'Writes', 'Returns', 'Fault directives']) {
      expect({ stage, part, present: titles.some((t) => t.startsWith(part)) }).toEqual({ stage, part, present: true });
    }
  });

  it('every repository path the stage references and agent definitions mention exists', () => {
    const files = [
      ...RESEARCH_STAGES.map((s) => path.join(STAGES_DIR, `${s}.md`)),
      ...definitionFiles.map((f) => path.join(AGENTS_DIR, f)),
    ];
    let checked = 0;
    for (const file of files) {
      for (const p of repoPaths(fs.readFileSync(file, 'utf8'))) {
        const cut = p.search(/[<*]/);
        const fixed = cut < 0 ? p : p.slice(0, p.lastIndexOf('/', cut) + 1);
        expect({ file: path.relative(REPO, file), path: p, exists: fs.existsSync(path.join(REPO, fixed)) }).toEqual({
          file: path.relative(REPO, file),
          path: p,
          exists: true,
        });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('every skill path the saved workflows mention exists', () => {
    const dir = path.join(REPO, '.claude', 'workflows');
    const scripts = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
    expect(scripts).toContain('build-guide-research.js');
    for (const f of scripts) {
      for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/\.claude\/skills\/build-guide\/[^\s'"`)$]*/g)) {
        const p = m[0].replace(/[.,:;]+$/, '');
        expect({ script: f, path: p, exists: fs.existsSync(path.join(REPO, p)) }).toEqual({ script: f, path: p, exists: true });
      }
    }
  });

  it('R1b applies FI-1 with the exact gem name §11.3 gives, and compiles only measure-only', () => {
    const text = fs.readFileSync(path.join(STAGES_DIR, 'R1b.md'), 'utf8');
    expect(text).toContain('FI-1 Unknown Gem');
    expect(text).toContain('measure_only: true');
    expect(text).not.toMatch(/build_name: /);
  });

  it('R1b paths the tree through one bootstrap compile, and validates before any price call', () => {
    const text = fs.readFileSync(path.join(STAGES_DIR, 'R1b.md'), 'utf8');
    expect(text).toContain('At most **two compiles per attempt**');
    expect(text).toMatch(/\*\*Bootstrap compile\*\* \(at most once per attempt/);
    expect(text).toContain('find_path_to_node {target_node_id: <id>}');
    const step = (name: string) => text.search(new RegExp(`^\\d\\. \\*\\*${name}`, 'm'));
    const order = ['Tree targets', 'Bootstrap compile', 'Write the skeleton', 'Validate', 'Prices', 'Validate again', 'FI-1', 'The last compile'].map(step);
    for (const i of order) expect(i).toBeGreaterThan(0);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    // A fallback league is flagged, and D1 doesn't inherit it.
    expect(text).toContain('leagueUnverified: true');
    expect(text).toMatch(/D1 doesn't take its\s+league from a skeleton whose league is unverified/);
  });

  it('R1a names the discovery calls for supports, uniques and the tree', () => {
    const text = fs.readFileSync(path.join(STAGES_DIR, 'R1a.md'), 'utf8');
    for (const call of [
      'list_gems {type: "support", tag:',
      'kind: "gem"}',
      'lookup_game_data {mode: "unique", query:',
      'search_tree_nodes {query}',
      'search_tree_nodes {ascendancy}',
    ]) {
      expect({ call, named: text.includes(call) }).toEqual({ call, named: true });
    }
  });

  it('SKILL.md says what the skill does when the research workflow returns dossier: null', () => {
    const text = fs.readFileSync(SKILL_MD, 'utf8');
    expect(text).toContain('**`dossier: null`**');
    expect(text).toMatch(/no concept of that\s+round can be picked/);
  });
});

describe('WU-44: the dossier template (§7.2)', () => {
  const text = fs.existsSync(DOSSIER_TEMPLATE) ? fs.readFileSync(DOSSIER_TEMPLATE, 'utf8') : '';
  const hs = headings(text);

  it("has §7.2's H2s in order, the same list the run checker holds", () => {
    expect(hs.filter((h) => h.level === 2).map((h) => h.title)).toEqual(DOSSIER_H2);
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    const listed = /export const DOSSIER_H2 = (\[[^\]]*\]);/.exec(checker);
    expect(listed).not.toBeNull();
    expect(JSON.parse(listed![1].replace(/'/g, '"'))).toEqual(DOSSIER_H2);
  });

  it('gives each concept an H3 "<id>: <title>" under Concepts with the seven proposal fields and the R1b result', () => {
    const concepts = hs.find((h) => h.level === 2 && h.title === 'Concepts')!;
    const next = hs.find((h) => h.line > concepts.line && h.level <= 2)!;
    const h3 = hs.filter((h) => h.level === 3 && h.line > concepts.line && h.line < next.line);
    expect(h3.length).toBeGreaterThan(0);
    for (const h of h3) expect(h.title).toMatch(/^c[1-9]\d*: /);
    const section = text.split(/\r?\n/).slice(concepts.line, next.line).join('\n');
    for (const field of CONCEPT_FIELDS) expect({ field, present: section.includes(`- ${field}: `) }).toEqual({ field, present: true });
  });

  it('states the league, and marks a fallback league unverified for D1', () => {
    expect(text).toMatch(/League: <none \(offline\) \| <league>, from get_leagues \| <league>, unverified/);
  });

  it('puts every footnote definition under the last heading, after Not carried', () => {
    const lines = text.split(/\r?\n/);
    const defs = lines.map((l, i) => (/^\[\^[^\]\s]+\]:/.test(l) ? i : -1)).filter((i) => i >= 0);
    expect(defs.length).toBeGreaterThan(0);
    const last = hs[hs.length - 1];
    expect(last.title).toBe('Not carried');
    for (const i of defs) expect(i).toBeGreaterThan(last.line);
    for (const m of text.matchAll(/\[\^([^\]\s]+)\](?!:)/g)) {
      expect({ marker: m[1], defined: lines.some((l) => l.startsWith(`[^${m[1]}]:`)) }).toEqual({ marker: m[1], defined: true });
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// WU-45: the design stage references, the writer, the coordinator's design steps and the guide template
// (§5.3, §8; AC-W5 extended, AC-W11)
// ---------------------------------------------------------------------------------------------------

const DESIGN_STAGES = ['D1', 'D1-gate', 'D2', 'D2-gate', 'W1'];
const GUIDE_TEMPLATE = path.join(SKILL_DIR, 'templates', 'guide-template.md');
/** §8: the guide's H2s, in order. */
const GUIDE_H2 = [
  'Versions, prices and import code',
  'Summary',
  'How it works',
  'Leveling',
  'Campaign rewards',
  'Endgame: budget variant',
  'Endgame: non-budget variant',
  'Rotation',
  'Defences and resistances',
  'FAQ and common mistakes',
  "Confidence and what PoB can't model",
  'Changelog',
  'Sources',
];
const readStage = (stage: string) => fs.readFileSync(path.join(STAGES_DIR, `${stage}.md`), 'utf8');
/** One paragraph or list item per entry, with its line breaks folded, so a rule split over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');

describe('WU-45: the design stage references', () => {
  it.each(DESIGN_STAGES)('%s.md exists, with the parts the stages README names', (stage) => {
    const titles = headings(readStage(stage)).filter((h) => h.level === 2).map((h) => h.title);
    for (const part of ['Inputs', 'Work', 'Writes', 'Returns', 'Fault directives']) {
      expect({ stage, part, present: titles.some((t) => t.startsWith(part)) }).toEqual({ stage, part, present: true });
    }
  });

  it('every repository path they and the guide template mention exists', () => {
    let checked = 0;
    for (const file of [...DESIGN_STAGES.map((s) => path.join(STAGES_DIR, `${s}.md`)), GUIDE_TEMPLATE]) {
      for (const p of repoPaths(fs.readFileSync(file, 'utf8'))) {
        const cut = p.search(/[<*]/);
        const fixed = cut < 0 ? p : p.slice(0, p.lastIndexOf('/', cut) + 1);
        expect({ file: path.relative(REPO, file), path: p, exists: fs.existsSync(path.join(REPO, fixed)) }).toEqual({ file: path.relative(REPO, file), path: p, exists: true });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('D1 holds the survival floor with chaos, the exception only when capping is infeasible (D-234)', () => {
    const text = folded(readStage('D1'));
    expect(text).toMatch(/fire, cold, lightning \*\*and chaos\*\* resistance are capped/);
    expect(text).toContain('chaosResistException {reason, tag}');
    expect(text).toMatch(/Only when capping it is \*\*infeasible\*\*/);
  });

  it('D1 prices every slot and tree jewel of both variants, with its own entry unless the text is identical (D-249)', () => {
    const text = folded(readStage('D1'));
    expect(text).toMatch(/One `prices\[\]` entry per filled slot and tree jewel of \*\*both\*\* variants \(D-249\)/);
    expect(text).toContain('Two slots share an entry only when their item text is identical');
    expect(text).toContain('Rares are affix-target searches (`search_trade_items` with `mods`)');
  });

  it("D1 never inherits R1b's fallback league, and records an unknown one as unverified", () => {
    const text = folded(readStage('D1'));
    expect(text).toMatch(/\*\*never\*\* a league the dossier or a skeleton marks unverified \(R1b's fallback, `leagueUnverified`\), and never a guess such as Standard/);
    expect(text).toContain('"league": "unverified"');
    expect(text).toContain('`leagueUnverified: true`');
  });

  it('D1 measures a possibly unread line with two stages before hand-calculating, and treats partly parsed as unapplied (D-243)', () => {
    const text = folded(readStage('D1'));
    expect(text).toMatch(/\*\*A `possibly unread` line\*\* .* is confirmed by measurement before any hand calculation \(D-243\)/);
    expect(text).toContain('compile measure-only with `stages` naming the two');
    expect(text).toMatch(/\*\*partly parsed\*\* line means PoB applies none of it/);
  });

  it('D1 makes the rolled skill the main damage source, never a token role (D-122, D-217)', () => {
    const text = folded(readStage('D1'));
    expect(text).toContain('**The rolled skill is the main damage source, never a token role** (D-122)');
    expect(text).toContain('Never give a damage skill the `utility` role to keep it out of the comparison');
  });

  it("D1 and D2 list the V2 rules WU-42 added: shown conditional options are earned (D-250), boss stats from E1 (D-252), the boundary penalty (D-251)", () => {
    const d1 = folded(readStage('D1'));
    const d2 = folded(readStage('D2'));
    for (const text of [d1, d2]) expect(text).toMatch(/every skill-conditional option PoB shows for the stage's skills .*(D-250)/i);
    expect(d1).toMatch(/the enemy's level, armour, evasion, resistances and crit are scenario entries citing E1 \(D-252\)/);
    expect(d2).toMatch(/At a region's last progress key either region's value is accepted \(D-251\)/);
  });

  it("D1-gate's codes and budget thresholds are gates.md's", () => {
    const gate = folded(readStage('D1-gate'));
    const gates = fs.readFileSync(path.join(SKILL_DIR, 'references', 'gates.md'), 'utf8');
    const codes = [...gates.matchAll(/^\| (?:floor|budget|rolledSkill) \| (.*?) \|/gm)].flatMap((m) => [...m[1].matchAll(/`([a-z-]+)`/g)].map((c) => c[1]));
    expect(codes).toEqual(expect.arrayContaining(['missing-chaos-resist', 'chaos-exception', 'over-budget', 'near-ceiling', 'unverified', 'rolled-role', 'rolled-not-largest']));
    for (const code of codes.filter((c) => !['rolled-not-compared', 'rolled-no-figure'].includes(c))) {
      const named = code.startsWith('max-hit') ? gate.includes('`max-hit-<type>`') : gate.includes(`\`${code}\``);
      expect({ code, named }).toEqual({ code, named: true });
    }
    expect(gate).toMatch(/at most 20 divines `pass`; above 20 and at most 22 `pass` with a `near-ceiling` finding .* above 22 `fail` \(`over-budget`\)/);
    expect(gate).toMatch(/rounded to 2 decimals/);
    expect(gate).toMatch(/filled slots \*\*and tree jewels\*\*/);
    expect(gate).toContain('The non-budget variant\'s total is reported against the ~200-divine reference, never gated');
  });

  it('only the D2 gate names a final compile; D1, D2 and the D1 gate compile measure-only', () => {
    for (const stage of ['D1', 'D2', 'D1-gate']) {
      const text = readStage(stage);
      expect(text).toContain('measure_only: true');
      expect(text).not.toMatch(/build_name: "/);
    }
    const d2Gate = folded(readStage('D2-gate'));
    expect(d2Gate).toContain('build_name: "<the header\'s buildName>"');
    expect(d2Gate).toMatch(/exactly once/);
    expect(d2Gate).toMatch(/Never retry it, never pick another `build_name`, and never work around it/);
  });

  it('D1 sets five waystone-scaled reference hits, each derived by a ledger entry hit_<stage id>_<type> (D-119, D-254)', () => {
    const text = folded(readStage('D1'));
    expect(text).toContain('waystone-scaled at the conservative top of each modifier\'s range');
    expect(text).toContain('`enemyPhysicalDamage` = `base × (1 + increased / 100)`');
    expect(text).toMatch(/`enemyFireDamage`, `enemyColdDamage`, `enemyLightningDamage` and `enemyChaosDamage`, each `base × \(1 \+ increased \/ 100\) × extra \/ 100`/);
    expect(text).toMatch(/A ledger entry per hit, id `hit_<stage id>_<type>`/);
    expect(text).not.toMatch(/a scenario value is its fact's own/);
  });

  it('D1 sets each hit to the whole-number ceiling of its ledger value, and the ledger formula has no rounding input (D-256)', () => {
    const text = folded(readStage('D1'));
    expect(text).toMatch(/each with its fact's tag .*, and no other input \(no rounding input\)/);
    expect(text).toMatch(/its value is a \*\*whole number\*\*: PoB's `enemy<Type>Damage` options take whole numbers, so the value is the ledger entry's value rounded to 2 decimals, then rounded \*\*up\*\* \(D-256\): 96\.4789 gives 97, and 402\.000003 gives 402/);
    expect(text).not.toMatch(/its value is the hit rounded to 2 decimals/);
  });

  it('the D1 gate and gates.md check every hit is present and is the ceiling of its ledger entry, and name the codes (D-254, D-256)', () => {
    const gate = folded(readStage('D1-gate'));
    const gates = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'gates.md'), 'utf8'));
    for (const text of [gate, gates]) {
      expect(text).toContain('`reference-hit-missing-<type>`');
      expect(text).toContain('`reference-hit-ledger-<type>`');
      expect(text).toContain('hit_<stage id>_<type>');
      // D-256: whole numbers, the ledger value rounded to 2 decimals and then up; no longer the 2-decimal value.
      expect(text).toMatch(/[Ee]ach equals the ceiling of the record's value of (its|the) ledger entry `hit_<stage id>_<type>`/);
      expect(text).toMatch(/rounded to 2 decimals,? (and )?then (rounded )?up/);
      expect(text).toMatch(/D-256(;|:) 96\.4789 gives 97,? (and )?402\.000003 gives 402/);
      expect(text).not.toMatch(/each equals, rounded to 2 decimals, the record's value/i);
      // The basis examples hold whole-number hits.
      expect(text).not.toMatch(/"hit": (96\.48|402\.0)\b/);
    }
    expect(gates).toContain("the hit isn't the ceiling of its ledger entry `hit_<stage id>_<type>` (D-256)");
    for (const text of [gate, gates]) expect(text).toMatch(/`chaos-exception` and `near-ceiling` .*never a failure|never failures/);
    // The run checker recomputes the same rules (FR-W7).
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    for (const code of ['reference-hit-missing-', 'reference-hit-ledger-', 'hit_${s.id}_${t}']) expect(checker).toContain(code);
  });

  it('D2 keeps an unverified league and prices only under it', () => {
    expect(folded(readStage('D2'))).toMatch(/when it is `unverified`, D2 keeps it so, and records every campaign price under it/);
  });

  it("W1 takes the league from plan.json, lists an endgame respec, and names the hits as waystone-scaled with their ledger markers", () => {
    const text = folded(readStage('W1'));
    expect(text).toMatch(/\*\*The league\*\* is `plan\.json`'s `league`: `unverified` there means/);
    expect(text).toContain('a "Respec from the campaign" line lists the dropped nodes and the gold cost');
    expect(text).toMatch(/the waystone-scaled hit .* each with the marker of its ledger entry \(`ledger \| hit_<stage id>_<type>`\)/);
    expect(text).toMatch(/say "capped" of chaos only when it is/);
  });

  it("W1 and the template quote a reference hit as its ledger value, not the scenario's whole number (D-256)", () => {
    expect(folded(readStage('W1'))).toMatch(/Quote the hit as that entry's value in the record's `ledger` \(438\.55\), not the scenario's whole number \(439\), which is that value rounded up for PoB \(D-256\)/);
    const template = fs.readFileSync(GUIDE_TEMPLATE, 'utf8');
    const hitLines = template.split(/\r?\n/).filter((l) => l.includes('**Max hit taken**'));
    expect(hitLines).toHaveLength(2);
    for (const l of hitLines) expect(l).toContain("against <the hit's value in compile-record.json's ledger, not the scenario's whole number>");
  });

  it("V4's ledger lens wants the scenario hit at its ledger value's ceiling, and the guide's hit at the ledger value (D-256)", () => {
    const text = folded(readStage('V4'));
    expect(text).toMatch(/with those inputs and that formula and no other input/);
    expect(text).toMatch(/equal to its \*\*ceiling\*\*: the record value rounded to 2 decimals, then up to a whole number, because PoB takes these options as whole numbers \(D-256; 96\.4789 gives 97, and 402\.000003 gives 402\)/);
    expect(text).toContain('A whole-number scenario value is right, not a mismatch.');
    expect(text).toContain("A reference hit's number in the guide is its ledger value, not the scenario's ceiling (D-256).");
    expect(text).not.toMatch(/equal to it rounded to 2 decimals/);
  });

  it('the D1 gate applies FI-2 and FI-3 as §11.3 says', () => {
    const text = folded(readStage('D1-gate'));
    expect(text).toMatch(/\*\*FI-2\*\* \(only when the header's `faults` holds it\): before anything else, set the first endgame stage's .* `level` to `1`/);
    expect(text).toContain('`(L1)`');
    expect(text).toContain('FI-3 (injected)');
  });

  it('W1 surfaces the record\'s loadout, save and version notes, and states the D-234 and D-219 lines the checker reads', () => {
    const text = folded(readStage('W1'));
    for (const field of ['versionNotes', 'loadoutWarnings', 'saveWarnings']) expect(text).toContain(`\`${field}\``);
    expect(text).toContain('Giant\'s Blood, Instruments of Power or Lord of the Wilds');
    expect(text).toContain('check Weapon 2 and Weapon 2 Swap');
    expect(text).toMatch(/\*\*one line\*\* holds both the record's `ChaosResist` .* as a number with `%`, and the exception's `reason` copied in full/);
    expect(text).toMatch(/budget `Checks` say \*\*near the ceiling\*\*, in those words/);
    expect(text).toContain('copied character for character from the record\'s `importCode`');
    expect(text).toMatch(/H3 per campaign stage .* titled with its loadout name \*\*exactly\*\* as the record's/);
  });
});

describe('WU-45: the writer and the coordinator (AC-W5 extended)', () => {
  const def = (stem: string) => readDefinition(fs.readFileSync(path.join(AGENTS_DIR, `${stem}.md`), 'utf8'))!;

  it('the writer exists and has only file tools, Edit among them: no pob2, trade, web or Bash tool (§4 row, R-3, R-4, D-257)', () => {
    expect(definitionFiles).toContain('build-guide-writer.md');
    expect(def('build-guide-writer').tools).toEqual(['Read', 'Glob', 'Grep', 'Write', 'Edit']);
    // The spec's §4 table says the same.
    const spec = fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'spec', '03-pipeline.md'), 'utf8');
    expect(spec).toContain('| `build-guide-writer` | W1 | Read, Glob, Grep, Write, Edit (D-257) | none | none |');
  });

  it('the writer fixes the guide in place and writes no other file (D-257)', () => {
    const body = folded(def('build-guide-writer').body);
    expect(body).toMatch(/no note, draft or scratch file of your own\. Write the guide with Write and correct it in place with Edit \(D-257\)/);
    const w1 = folded(readStage('W1'));
    expect(w1).toMatch(/`guide\.md` only, and no other file: no notes, drafts or scratch files, in the run folder or anywhere else/);
    expect(w1).toMatch(/to correct it afterwards, fix it in place with Edit rather than writing it again \(D-257\)/);
  });

  it('the coordinator lists its design steps after its research steps, each with an existing stage reference', () => {
    const { body } = def('build-guide-coordinator');
    const research = body.indexOf('## Research steps');
    const designAt = body.indexOf('## Design steps');
    expect(research).toBeGreaterThan(0);
    expect(designAt).toBeGreaterThan(research);
    const section = body.slice(designAt);
    for (const stage of ['D1', 'D1-gate', 'D2', 'D2-gate']) {
      expect(section).toContain(`| \`${stage}\` | \`.claude/skills/build-guide/references/stages/${stage}.md\` |`);
    }
    expect(folded(section)).toContain('fire, cold, lightning **and chaos** resistance capped');
  });
});

describe('AC-W11: the guide template (§8)', () => {
  const text = fs.existsSync(GUIDE_TEMPLATE) ? fs.readFileSync(GUIDE_TEMPLATE, 'utf8') : '';
  const hs = headings(text);

  it("has §8's H2s in order, the same list the run checker holds, under one H1 naming the roll", () => {
    expect(hs.filter((h) => h.level === 1).map((h) => h.title)).toEqual(['<Ascendancy> / <Skill>: <concept title>']);
    expect(hs.filter((h) => h.level === 2).map((h) => h.title)).toEqual(GUIDE_H2);
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    const listed = /export const GUIDE_H2 = (\[[\s\S]*?\]);/.exec(checker);
    expect(listed).not.toBeNull();
    // The checker's list is a JS literal of single- and double-quoted strings.
    const items = [...listed![1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
    expect(items).toEqual(GUIDE_H2);
  });

  it('has the H3 Checks under both endgame H2s, and only Checks there', () => {
    for (const title of ['Endgame: budget variant', 'Endgame: non-budget variant']) {
      const h2 = hs.find((h) => h.level === 2 && h.title === title)!;
      const next = hs.find((h) => h.line > h2.line && h.level <= 2)!;
      expect(hs.filter((h) => h.level === 3 && h.line > h2.line && h.line < next.line).map((h) => h.title)).toEqual(['Checks']);
    }
  });

  it('gives Leveling one H3 per campaign stage, titled with the record\'s loadout name, and an Accepted failures H3 under Confidence', () => {
    const under = (title: string) => {
      const h2 = hs.find((h) => h.level === 2 && h.title === title)!;
      const next = hs.find((h) => h.line > h2.line && h.level <= 2)!;
      return hs.filter((h) => h.level === 3 && h.line > h2.line && h.line < next.line).map((h) => h.title);
    };
    expect(under('Leveling')).toEqual(['<loadoutName of the first campaign stage, exactly as compile-record.json has it>']);
    expect(under("Confidence and what PoB can't model")).toEqual(['Accepted failures']);
  });

  it('puts the import code in a fenced block in the first section, and the record\'s PoB-file notes there', () => {
    const lines = text.split(/\r?\n/);
    const first = hs.find((h) => h.title === GUIDE_H2[0])!;
    const second = hs.find((h) => h.title === GUIDE_H2[1])!;
    const section = lines.slice(first.line, second.line).join('\n');
    expect(section).toMatch(/```\n<importCode, copied exactly from compile-record\.json>\n```/);
    for (const note of ['versionNotes', 'loadoutWarnings', 'saveWarnings']) expect(section).toContain(note);
    expect(section).toContain('check Weapon 2 and Weapon 2 Swap');
    expect(section).toMatch(/offline: prices are unavailable and no external source was consulted/);
  });

  const checksOf = (variant: string) => {
    const lines = text.split(/\r?\n/);
    const h2 = hs.find((h) => h.title === variant)!;
    const checks = hs.find((h) => h.level === 3 && h.title === 'Checks' && h.line > h2.line)!;
    const next = hs.find((h) => h.line > checks.line && h.level <= 3)!;
    return lines.slice(checks.line, next.line);
  };

  it('carries the D-234 chaos line, the D-219 near-the-ceiling line and the D-164 unavailable line in the budget Checks', () => {
    const section = checksOf('Endgame: budget variant');
    expect(section.some((l) => l.includes('near the ceiling'))).toBe(true);
    expect(section.some((l) => /can't be claimed to be under 20 divines/.test(l))).toBe(true);
  });

  it.each(['Endgame: budget variant', 'Endgame: non-budget variant'])(
    '%s Checks: chaos "capped" only without an exception, the exception line otherwise, and the waystone-scaled hits with ledger markers',
    (variant) => {
      const section = checksOf(variant);
      const floor = section.find((l) => l.includes('**Survival floor**'))!;
      expect(floor).not.toMatch(/chaos/i);
      expect(section.some((l) => /\[only when the stage has no chaosResistException\] Chaos resistance <n>%, capped\./.test(l))).toBe(true);
      expect(section.some((l) => /\[only when the stage has a chaosResistException; one line, the reason in full\] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>\./.test(l))).toBe(true);
      const hits = section.find((l) => l.includes('**Max hit taken**'))!;
      expect(hits).toMatch(/waystone-scaled reference hits .*top of each waystone damage modifier's range/);
      const ids = [...hits.matchAll(/\[\^([^\]]+)\]/g)].map((m) => m[1]);
      expect(ids.length).toBe(2);
      for (const id of ids) expect(text).toMatch(new RegExp(`^\\[\\^${id}\\]: ledger \\| hit_[bn]_(physical|fire)$`, 'm'));
    },
  );

  it('gives both endgame variants a "Respec from the campaign" line (D-144)', () => {
    for (const variant of ['Endgame: budget variant', 'Endgame: non-budget variant']) {
      const lines = text.split(/\r?\n/);
      const h2 = hs.find((h) => h.title === variant)!;
      const next = hs.find((h) => h.line > h2.line && h.level <= 2)!;
      expect(lines.slice(h2.line, next.line).some((l) => /\[only when the stage has a respec\] \*\*Respec from the campaign:\*\* drop <the dropped nodes> \(about <gold cost> gold\)/.test(l))).toBe(true);
    }
  });

  it('defines every marker once, under Sources, the last heading', () => {
    const lines = text.split(/\r?\n/);
    const defs = lines.map((l, i) => (/^\[\^[^\]\s]+\]:/.test(l) ? i : -1)).filter((i) => i >= 0);
    expect(defs.length).toBeGreaterThan(5);
    const last = hs[hs.length - 1];
    expect(last.title).toBe('Sources');
    for (const i of defs) expect(i).toBeGreaterThan(last.line);
    const ids = defs.map((i) => /^\[\^([^\]\s]+)\]:/.exec(lines[i])![1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of text.matchAll(/\[\^([^\]\s]+)\](?!:)/g)) expect({ marker: m[1], defined: ids.includes(m[1]) }).toEqual({ marker: m[1], defined: true });
  });
});

// ---------------------------------------------------------------------------------------------------
// WU-46: the provenance and verifier definitions (AC-W5 extended, AC-W14), the V3, V4 and revise-map stage
// references, the coordinator's revision section and the fallback's routing (§4, §5.3, §5.5, §7.4)
// ---------------------------------------------------------------------------------------------------

const VERIFY_STAGES = ['V3', 'V4', 'revise-map'];
const FALLBACK_MD = path.join(SKILL_DIR, 'references', 'fallback.md');

describe('AC-W14: the provenance and verifier definitions (§4, R-3…R-5, D-178)', () => {
  const def = (stem: string) => readDefinition(fs.readFileSync(path.join(AGENTS_DIR, `${stem}.md`), 'utf8'))!;

  it('all five agent types of §4 now have a definition', () => {
    expect(definitionFiles.map((f) => f.replace(/\.md$/, '')).sort()).toEqual([...AGENT_TYPES].sort());
  });

  it('provenance has only Read, Glob and Grep: no write, edit, Bash, pob2, trade or web tool', () => {
    expect(def('build-guide-provenance').tools).toEqual(['Read', 'Glob', 'Grep']);
  });

  it('the verifier has Read, Glob, Grep, WebFetch and the lookups L only: no Write, Edit or Bash, no C or P tool', () => {
    const { tools } = def('build-guide-verifier');
    expect(tools).toEqual(['Read', 'Glob', 'Grep', 'WebFetch', ...L.map((t) => POB2 + t)]);
    for (const t of tools) {
      expect(['Write', 'Edit', 'NotebookEdit', 'Bash', 'WebSearch']).not.toContain(t);
      expect([...B, ...C, ...P].map((n) => POB2 + n)).not.toContain(t);
    }
  });

  it('both state that their report is their return and that they write nothing (R-5), and the verifier the C-30 offline rule', () => {
    for (const stem of ['build-guide-provenance', 'build-guide-verifier']) {
      const body = folded(def(stem).body);
      expect(body).toMatch(/Your report is your return/);
      expect(body).toMatch(/Fresh and independent\*\* \(D-142\)/);
    }
    const verifier = folded(def('build-guide-verifier').body);
    expect(verifier).toMatch(/`external-unavailable` is `accepted-offline` only in an offline run; in an online run it is `unresolved` \(C-30\)/);
    expect(verifier).toMatch(/without fetching that citation's URL \(D-232\)/);
  });
});

describe('WU-46: the V3, V4 and revise-map stage references', () => {
  it.each(VERIFY_STAGES)('%s.md exists, with the parts the stages README names', (stage) => {
    const titles = headings(readStage(stage)).filter((h) => h.level === 2).map((h) => h.title);
    for (const part of ['Inputs', 'Work', 'Writes', 'Returns', 'Fault directives']) {
      expect({ stage, part, present: titles.some((t) => t.startsWith(part)) }).toEqual({ stage, part, present: true });
    }
  });

  it('every repository path they, the new definitions and fallback.md mention exists', () => {
    let checked = 0;
    const files = [
      ...VERIFY_STAGES.map((s) => path.join(STAGES_DIR, `${s}.md`)),
      path.join(AGENTS_DIR, 'build-guide-provenance.md'),
      path.join(AGENTS_DIR, 'build-guide-verifier.md'),
      FALLBACK_MD,
    ];
    for (const file of files) {
      for (const p of repoPaths(fs.readFileSync(file, 'utf8'))) {
        const cut = p.search(/[<*]/);
        const fixed = cut < 0 ? p : p.slice(0, p.lastIndexOf('/', cut) + 1);
        expect({ file: path.relative(REPO, file), path: p, exists: fs.existsSync(path.join(REPO, fixed)) }).toEqual({ file: path.relative(REPO, file), path: p, exists: true });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('V3 counts claims the way the run checker does, and returns coverage {plan, dossier, guide}', () => {
    const text = folded(readStage('V3'));
    expect(text).toContain('`plan`: one per `stages[].claims[]` entry of `plan.json`');
    expect(text).toContain('`dossier` and `guide`: one per definition line');
    expect(text).toContain('"coverage": { "plan": 12, "dossier": 4, "guide": 12 }');
    expect(text).toMatch(/In an online run .* an `external-unavailable` tag anywhere is a finding/);
  });

  it("V4's ledger lens re-derives every entry, and the five waystone-scaled hits from their facts (D-179, D-254, A-P11)", () => {
    const text = folded(readStage('V4'));
    expect(text).toMatch(/For \*\*every\*\* entry of `plan\.json`'s `ledger\[\]`, evaluate its `formula` yourself/);
    expect(text).toMatch(/re-derive the five waystone-scaled hits from the facts themselves/);
    expect(text).toContain('`enemies/map-monsters.json#damage.by-level[<area level>]`');
    expect(text).toContain('`enemies/waystones.json#mods.increased-monster-damage`');
    expect(text).toContain('`enemies/waystones.json#mods.extra-damage-as-element`');
    expect(text).toContain('physical = `base × (1 + increased / 100)`');
    expect(text).toContain('`base × (1 + increased / 100) × extra / 100`');
    expect(text).toContain('the ledger entry `hit_<stage id>_<type>`');
    expect(text).toMatch(/`rederived` how many you re-derived, which must equal `entries` \(D-179\)/);
  });

  it("V4's sources lens: every external source opened (none offline), every data claim checked without a fetch offline, all endgame pob-data and 1 in 5 elsewhere, prices against their entries", () => {
    const text = folded(readStage('V4'));
    expect(text).toMatch(/open \*\*every\*\* source with WebFetch, only on D-171's hosts/);
    expect(text).toMatch(/Offline, open nothing/);
    expect(text).toMatch(/\*\*offline you don't fetch it\*\* \(D-232\)/);
    expect(text).toMatch(/\*\*all\*\* of them in endgame sections, and \*\*at least 1 in 5 elsewhere\*\* \(rounded up\)/);
    expect(text).toMatch(/check the claim's amount, currency, date and league against it/);
    expect(text).toMatch(/`accepted-offline` when the run log's mode is `offline`, `unresolved` otherwise \(C-30\)/);
  });

  it('V4 follows the lookup rules: D-239…D-241, partly parsed applies none, possibly unread is advisory and confirmed by measurement (D-243)', () => {
    const text = folded(readStage('V4'));
    for (const d of ['D-239', 'D-240', 'D-241']) expect(text).toContain(d);
    expect(text).toMatch(/A \*\*partly parsed\*\* line means PoB applies \*\*none\*\* of it/);
    expect(text).toMatch(/\*\*`possibly unread` is advisory\*\* \(D-243\): the coordinator confirms it by a measurement/);
    expect(text).toMatch(/never guess the number yourself/);
  });

  it("V4's coverage keys and the owners are the workflow's and the run checker's", () => {
    const script = fs.readFileSync(path.join(REPO, '.claude', 'workflows', 'build-guide-design.js'), 'utf8');
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    const list = (text: string, re: RegExp) => [...re.exec(text)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const sources = list(checker, /const SOURCES_COVERAGE = \[([^\]]*)\]/);
    expect(list(script, /sources: \[([^\]]*)\]/)).toEqual(sources);
    expect(folded(readStage('V4'))).toContain(`Coverage** \`{${sources.join(', ')}}\``);
    expect(list(script, /const OWNERS = \[([^\]]*)\]/).sort()).toEqual(list(checker, /const OWNERS = \[([^\]]*)\]/).sort());
  });

  it('revise-map maps by §5.5\'s owner table, writes nothing and returns {mapping: [{id, owner, why}]}', () => {
    const text = folded(readStage('revise-map'));
    for (const owner of ['W1', 'D1', 'D2', 'dossier-fix']) expect(text).toContain(`| \`${owner}\` |`);
    expect(text).toContain('Nothing (the header\'s `writes` is empty)');
    expect(text).toContain('"mapping": [');
    expect(text).toMatch(/Every request `id` of the header appears at least once/);
  });
});

describe('WU-46: the coordinator\'s revision section and the fallback\'s routing', () => {
  it('the coordinator lists revise-map after its design steps, with an existing stage reference', () => {
    const { body } = readDefinition(fs.readFileSync(path.join(AGENTS_DIR, 'build-guide-coordinator.md'), 'utf8'))!;
    const designAt = body.indexOf('## Design steps');
    const revisionAt = body.indexOf('## Revision and routed re-runs');
    expect(designAt).toBeGreaterThan(0);
    expect(revisionAt).toBeGreaterThan(designAt);
    expect(body.slice(revisionAt)).toContain('| `revise-map` | `.claude/skills/build-guide/references/stages/revise-map.md` |');
  });

  it('fallback.md routes by §5.5\'s table and says how a routed re-run counts, and both resume paths WU-46 owns', () => {
    const text = folded(fs.readFileSync(FALLBACK_MD, 'utf8'));
    expect(text).toContain('| `dossier.md` | `dossier-fix` | V3, V4 |');
    expect(text).toContain('| an endgame stage of `plan.json`, a ledger entry citing one, an endgame price | `D1` | D1 gate, D2 gate and final compile, W1, V3, V4 |');
    expect(text).toMatch(/A re-run spends one of that owner's 2 retries/);
    expect(text).toMatch(/An owner with no retry left \(a third round\) ends the flow `escalated`/);
    expect(text).toMatch(/\*\*`revision`\*\* \(checkpoint 2\), `\{reason: "revision", round, requests, attempts\}`/);
    expect(text).toMatch(/At `V3` or `V4`, the findings' owners re-run once with their findings and the guidance/);
  });

  it('the design workflow takes every resume WU-45 left for WU-46 (revision, guided V3/V4, dossier-fix, revise-map)', () => {
    const script = fs.readFileSync(path.join(REPO, '.claude', 'workflows', 'build-guide-design.js'), 'utf8');
    expect(script).not.toMatch(/arrives with WU-46/);
    expect(script).toContain("const RESUME_STAGES = ['D1', 'D1-gate', 'D2', 'D2-gate', 'W1', 'V3', 'V4', 'dossier-fix', 'revise-map']");
  });
});

describe('WU-46 review fixes: the references say what the workflow and the checker now hold', () => {
  it('V3 and V4 never give an accepted id to another issue, and number new findings after the highest accepted one (§5.4)', () => {
    for (const stage of ['V3', 'V4']) {
      const text = folded(readStage(stage));
      expect(text).toContain('**Never give an accepted `id` to another issue**');
      expect(text).toMatch(/number your new findings after the highest accepted id of yours/);
    }
  });

  it('V4 and source-markers.md keep accepted-offline to the sources lens on a claim tagged external-unavailable (C-30)', () => {
    expect(folded(readStage('V4'))).toMatch(/`issue` exactly `tagged external-unavailable` and `location` the claim's/);
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'source-markers.md'), 'utf8'))).toMatch(/only in the V4 `sources` report, its `location` naming that claim/);
  });

  it("dossier-fix has its own retry cap, as run-log.md logs it, and v4Passes counts distinct lenses", () => {
    const fix = folded(readStage('dossier-fix'));
    expect(fix).not.toMatch(/counts as R1b/);
    expect(fix).toContain('its own retry cap of 2, logged under stage `dossier-fix`');
    const log = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8'));
    expect(log).toMatch(/`lenses` counts the \*\*distinct\*\* lenses that reported in that pass/);
    expect(log).toContain('`dossier-fix` is its own stage');
  });
});

// ---------------------------------------------------------------------------------------------------
// WU-47 fixes (lane P): the skill runner's Bash (F3), truncated workflow results and the import code's one
// home (D-260), fallback stamping (F5), the unavailable total (D-261), the invalid-roll names (D-258), the
// pick reason (v4-prose-8) and the general prompt rules from the WU-47 triage
// ---------------------------------------------------------------------------------------------------

describe('WU-47 fixes: what the skill runner does', () => {
  const skill = () => folded(fs.readFileSync(SKILL_MD, 'utf8'));

  it('F3: the runner\'s Bash is only date and the run checker, as written, one per call, never cd and never compound', () => {
    const text = skill();
    expect(text).toMatch(/\*\*Your Bash is two commands, each run exactly as written, one per Bash call:\*\* `date -u \+%Y-%m-%dT%H:%M:%SZ` and the run checker \(§8\)\. Never `cd`/);
    expect(text).toMatch(/no compound command: no `;`, `&&`, `\|\|` or pipe/);
    expect(text).toMatch(/Write every file \(`run-log\.json`, `reports\/`\) with Write, never with Bash or a script/);
    // The checker is run by the path the rule names, from the session's directory.
    expect(text).toContain('`node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`');
  });

  it('D-260: a cut workflow result is read whole from the notification\'s output file, never from the cut text or the journal', () => {
    const text = skill();
    expect(text).toMatch(/the notification's `<result>` is cut at about 10,000 characters when the result is longer\. When it is cut, Read the output file the notification names/);
    expect(text).toMatch(/Take every verdict, report and `stats` field from the whole result, never from the cut text, and never from a workflow's `journal\.jsonl`/);
  });

  it('D-260: the import code lives only in the record; the D2 gate returns none and the run log\'s outputs hold none', () => {
    const d2Gate = readStage('D2-gate');
    expect(d2Gate).not.toMatch(/"importCode"/);
    expect(folded(d2Gate)).toMatch(/Don't return the import code: `compile-record\.json` is its one home, and W1 copies it from there \(D-260\)/);
    expect(folded(d2Gate)).toContain('`finalCompile {compiled, errors, recordPath, pobFile}`, with no import code (D-260)');
    const log = fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8');
    expect(log).toContain('| `outputs` | `{plan, record, dossier, guide, pobFile}`');
    expect(log).toContain('"outputs": { "plan": null, "record": null, "dossier": null, "guide": null, "pobFile": null }');
    expect(skill()).toMatch(/`outputs` \(`plan`, `record`, `dossier`, `guide` and the record's PoB file; not the import code, whose one home is the record, D-260\)/);
    const spec = fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'spec', '03-pipeline.md'), 'utf8');
    expect(spec).toContain('| `outputs` | `{plan, record, dossier, guide, pobFile}`; the import code stays in the record (D-260) |');
  });

  it('F5: fallback.md stamps every Agent call with a date reading before and after it, written into the attempt', () => {
    const text = folded(fs.readFileSync(FALLBACK_MD, 'utf8'));
    expect(text).toMatch(/\*\*Before each Agent call\*\*, run `date -u \+%Y-%m-%dT%H:%M:%SZ` as its own Bash call and keep the reading as that call's `startedAt`/);
    expect(text).toMatch(/\*\*After each Agent call returns\*\*, run the same `date` command again and keep the reading as its `endedAt`/);
    expect(text).toMatch(/one reading serves twice, as the returned call's `endedAt` and the next call's `startedAt`/);
    expect(text).toMatch(/\*\*Write the readings into the attempt\*\*: its `stages\[\]` entry's `startedAt` and `endedAt`, and a `timeline\[\]` entry/);
    expect(skill()).toMatch(/\*\*In the fallback\*\*, stamp every Agent call: a `date` call right before it and right after it returns/);
  });

  it('D-261: run-log.md counts unavailable over plan.json and every concept plan', () => {
    const text = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8'));
    expect(text).toMatch(/`unavailable` counts every `prices\[\]` entry with status `unavailable` across every plan the run wrote: `plan\.json` and every `concepts\/<id>\/plan\.json` \(D-261\)/);
  });

  it('D-258: the invalid-roll refusal quotes the closest names lookup_game_data lists on no match', () => {
    expect(skill()).toMatch(/when nothing matched, `lookup_game_data` says "Nothing matched …" and then lists the closest names under a `Closest gem names \(…\):` header, up to 5 lines `- <name> \(active\|support\)` \(D-258\); quote those names in its order/);
  });
});

describe('WU-47 fixes: the stage references\' general rules', () => {
  it('v4-prose-8: W1 and the template say only what the run log\'s picking checkpoint records, quoting a pre-supplied rule; V4 checks it', () => {
    const w1 = folded(readStage('W1'));
    expect(w1).not.toMatch(/the mechanics, why it won\)/);
    expect(w1).toMatch(/`checkpoints\[\]`: checkpoint 1's entry that picked this concept, which is the only record of why it was picked/);
    expect(w1).toMatch(/\*\*Why this concept\*\*, in Summary, says only what `run-log\.json`'s checkpoint 1 entry whose `answer` picked the concept .* with `pre-supplied` or `default`, that the test config picked it, quoting the entry's `rule` exactly \(`first-viable`\)\. Give no reason the entry doesn't record, and never invent one\./);
    const template = fs.readFileSync(GUIDE_TEMPLATE, 'utf8');
    const why = template.split(/\r?\n/).find((l) => l.startsWith('- **Why this concept:**'))!;
    expect(why).toContain("run-log.json's checkpoints[] entry that picked it");
    expect(why).toContain("the test config picked it by the rule `<the entry's rule, exactly>`");
    expect(why).not.toMatch(/why it won|why each lost/);
    // The run log records the rule, and V4's prose lens checks the sentence against it.
    const log = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8'));
    expect(log).toContain('| `checkpoints[]` | `{checkpoint, visit, shown, answer, answeredBy, rule?, at}` |');
    expect(log).toMatch(/`rule` records how the answer was reached: the test config's answer exactly as written \(`first-viable`, `pick:c2`\) for `pre-supplied`, or the default that applied .* for `default`\. A user's answer has no `rule`/);
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'checkpoints.md'), 'utf8'))).toMatch(/the entry's `rule` keeps how the answer was reached/);
    const v4 = folded(readStage('V4'));
    expect(v4).toMatch(/\*\*Why this concept\*\* \(Summary\): check it against `run-log\.json`'s last checkpoint 1 entry whose `answer` is `pick:<the guide's concept>`.* quotes the entry's `rule` exactly\. A reason the entry doesn't record, a different rule, or a pick attributed to the wrong answerer is a finding \(owner `W1`\)/);
  });

  it('D-260: W1 returns no import code', () => {
    const w1 = readStage('W1');
    const returns = w1.slice(w1.indexOf('## Returns'), w1.indexOf('## Fault directives'));
    expect(returns).toContain('{ "file": "guide.md", "gaps": [] }');
    expect(returns).not.toMatch(/"importCode"/);
  });

  it('W1 keeps a hedge wherever it repeats a claim, and calls a mechanic reliable only with a source in the build', () => {
    const w1 = folded(readStage('W1'));
    expect(w1).toMatch(/State a mechanic as reliable only when the build has a source for it/);
    expect(w1).toMatch(/keeps its hedge everywhere the guide repeats it/);
  });

  it('D1 quotes no suggest_supports gain as a number', () => {
    expect(folded(readStage('D1'))).toMatch(/Never quote a `suggest_supports` gain as a number in a claim/);
  });

  it('D2 keeps a skill gem at or above its tier (D-259), names nodes by their names, and carries a recorded dispute', () => {
    const d2 = folded(readStage('D2'));
    expect(d2).toMatch(/A skill gem's level is at least its tier .* \(`campaign\/gems\.json#tier-rule`; V1 reports a gem below it as `gem-below-tier`, D-259\)/);
    expect(d2).toMatch(/Name a passive node by the name the tool gives it, never by one of its stat lines/);
    expect(d2).toMatch(/A claim citing a fact whose `note` records a dispute carries the dispute/);
  });

  it('R1a calls a node a notable only when the tool tags it so; R1b-assemble flags a payoff resting on an unconfirmed mechanic', () => {
    expect(folded(readStage('R1a'))).toMatch(/Call a node a notable or a keystone only when the tool tags it so \(`\[NOTABLE\]`, `\[KEYSTONE\]`\)/);
    expect(folded(readStage('R1b-assemble'))).toMatch(/When the concept's payoff rests on a mechanic no lookup confirmed, or that has no source in the concept .* its `Risks` says so/);
  });
});

describe('D-263: the M-12 run is an interactive session the user starts', () => {
  it("slice 03's WU-47 procedure and AC-W4 name no headless session, and nothing sets the headless wait ceiling", () => {
    const spec = fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'spec', '03-pipeline.md'), 'utf8');
    const wu47 = spec.slice(spec.indexOf('### WU-47'), spec.indexOf('### WU-48'));
    expect(folded(wu47)).toMatch(/\*\*Session\.\*\* An interactive Claude Code session that the user starts in the worktree, with step 2's MCP config \(D-263/);
    expect(wu47).not.toMatch(/headless session|claude -p/);
    const ac4 = spec.slice(spec.indexOf('- **AC-W4 '), spec.indexOf('- **AC-W15 '));
    expect(ac4).not.toMatch(/headless/);
    expect(spec).not.toContain('CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS');
  });
});
