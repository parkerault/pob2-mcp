/**
 * Static checks over the build-guide pipeline files (slice 03 §14, as amendment 1 §5 changes it): the skill
 * (`.claude/skills/build-guide/`), its stage references and templates, and the agent definitions.
 *
 * AC-W1: SKILL.md exists with frontmatter `name: build-guide` and a description; it names the four agent types,
 * `--offline` and `--test`, and a step list naming each step's agent type, and no saved workflow (S1); every
 * `references/`, `templates/` and `scripts/` path it mentions exists.
 *
 * AC-W5: every `.claude/agents/build-guide/*.md` satisfies §4's rules R-1…R-5, its `tools:` line checked against
 * the tool sets L, B, C and P and against `TOOL_META`; there are four definitions, and R-6 is that every Agent
 * call SKILL.md names gives a `subagent_type`. With it, the stage references and the dossier template (§7.2).
 *
 * AC-W11 (the guide template, `Known issues` replacing `Accepted failures`, Q1), AC-W12 (SKILL.md's verifier
 * prompt carries only the header and the reference path, D-142) and AC-W14 (the verifier definition).
 *
 * Amendment 1: the deleted workflow path stays deleted (S1); one full V4 pass, one fix round and one re-check
 * (S2, Q4); the retries (S6, Q2); S7's four kept fixes, `compile_plan`'s text aside (its unit test is in
 * `tests/unit/compileAllocation.test.ts`).
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { TOOL_META } from '../../src/server/toolMeta';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');

/** Slice 03 §4, as amendment 1 §3 leaves it: the four agent types (the provenance type goes). */
const AGENT_TYPES = ['build-guide-researcher', 'build-guide-coordinator', 'build-guide-writer', 'build-guide-verifier'];
/** Amendment 1 §3: each step and the agent type that runs it. */
const STEP_TYPES: [RegExp, string][] = [
  [/^R1a\b/, 'build-guide-researcher'],
  [/^R1b,/, 'build-guide-coordinator'],
  [/^R1b-assemble\b/, 'build-guide-coordinator'],
  [/^D1,/, 'build-guide-coordinator'],
  [/^D1-gate\b/, 'build-guide-coordinator'],
  [/^D2,/, 'build-guide-coordinator'],
  [/^D2-gate\b/, 'build-guide-coordinator'],
  [/^W1,/, 'build-guide-writer'],
  [/^V4, one full pass/, 'build-guide-verifier'],
  [/^V4 re-check/, 'build-guide-verifier'],
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

  it('names the four agent types, --offline and --test, and no saved workflow or Workflow call (S1)', () => {
    for (const name of [...AGENT_TYPES, '--offline', '--test']) {
      expect({ name, named: text.includes(name) }).toEqual({ name, named: true });
    }
    for (const gone of [/build-guide-research(?!er)/, /build-guide-design/, /build-guide-provenance/, /Workflow\(/, /\.claude\/workflows/, /fallback/]) {
      expect({ gone: String(gone), named: gone.test(text) }).toEqual({ gone: String(gone), named: false });
    }
  });

  it("has a step list naming each step's agent type (amendment 1 §3)", () => {
    const section = text.slice(text.indexOf('## The steps'), text.indexOf('## 1. Start'));
    const rows = section.split('\n').filter((l) => /^\| \d+ \|/.test(l)).map((l) => l.split(' | ').map((c) => c.replace(/^\| /, '')));
    expect(rows.map((r) => Number(r[0]))).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    for (const [step, type] of STEP_TYPES) {
      const row = rows.find((r) => step.test(r[1]));
      expect({ step: String(step), type: row?.[2].includes(`\`${type}\``) }).toEqual({ step: String(step), type: true });
    }
  });

  it('R-6: every Agent call SKILL.md names gives a subagent_type, one of the four types', () => {
    const calls = [...text.matchAll(/Agent\(\{([^}]*)\}\)/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      const m = /subagent_type: "([^"]+)"/.exec(c);
      expect({ call: c, type: m && AGENT_TYPES.includes(m[1]) }).toEqual({ call: c, type: true });
    }
    expect(text).toMatch(/\*\*Agents run only through the Agent tool, as one of the four build-guide types\*\*, named in\s+`subagent_type`/);
  });

  it("AC-W12 (D-142): SKILL.md's verifier prompt carries only the task header and the reference path", () => {
    const at = text.indexOf("The verifier's prompt is always exactly this");
    expect(at).toBeGreaterThan(0);
    const block = /````\n([\s\S]*?)\n````/.exec(text.slice(at))![1].split('\n');
    expect(block).toEqual(['```json', '<the task header: stage V4, its lens and check>', '```', 'Read .claude/skills/build-guide/references/stages/V4.md and do that step.']);
  });

  it('mentions only references/, templates/ and scripts/ paths that exist', () => {
    const paths = mentionedPaths(text);
    // The skill points at its shared references and its run checker; an empty scan would prove nothing.
    expect(paths).toEqual(expect.arrayContaining(['scripts/check-run.mjs', 'references/run-log.md', 'references/task-header.md']));
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
  'build-guide-verifier': { file: ['Read', 'Glob', 'Grep'], pob2: L, web: ['WebFetch'] },
};
/** R-4: tools no definition names. */
const NEVER = ['Bash', 'Agent', 'Skill', 'Workflow', 'NotebookEdit'];
/** R-5: V4 can't write. */
const NO_WRITE = ['build-guide-verifier'];
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
  if (!row) return [...out, `${stem} is none of §4's four agent types`];
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
  // R-5: V4 can't write.
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
  it('holds exactly the four agent types of amendment 1 §3', () => {
    expect(definitionFiles.map((f) => f.replace(/\.md$/, '')).sort()).toEqual([...AGENT_TYPES].sort());
  });

  it.each(definitionFiles)('%s says the runner starts it with the Agent tool, and names no workflow or fallback (S1)', (file) => {
    const text = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
    expect(readDefinition(text)!.fm.description).toMatch(/Started only by the build-guide skill's runner with the Agent tool/);
    expect(text).not.toMatch(/workflow|fallback|dossier-fix|revise-map|V3/);
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
const RESEARCH_STAGES = ['R1a', 'R1b', 'R1b-assemble'];
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
    // D-265 (f): FI-1 goes into the attempt's first compile, so it comes before the bootstrap.
    const order = ['Tree targets', 'FI-1', 'Bootstrap compile', 'Write the skeleton', 'Validate', 'Prices', 'Validate again', 'The last compile'].map(step);
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
    expect(text).toContain('Rares are affix-target searches (`mcp__pob2__search_trade_items` with `mods`)');
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

  it('gives Leveling one H3 per campaign stage, titled with the record\'s loadout name, and the one Known issues H3 under Confidence (Q1)', () => {
    const under = (title: string) => {
      const h2 = hs.find((h) => h.level === 2 && h.title === title)!;
      const next = hs.find((h) => h.line > h2.line && h.level <= 2)!;
      return hs.filter((h) => h.level === 3 && h.line > h2.line && h.line < next.line).map((h) => h.title);
    };
    expect(under('Leveling')).toEqual(['<loadoutName of the first campaign stage, exactly as compile-record.json has it>']);
    expect(under("Confidence and what PoB can't model")).toEqual(['Known issues']);
    expect(text).not.toContain('Accepted failures');
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
// AC-W14 and V4 (amendment 1 S2, S3): the verifier definition, and the V4 stage reference's full pass and
// re-check
// ---------------------------------------------------------------------------------------------------

describe('AC-W14: the verifier definition (§4, R-3…R-5, D-178)', () => {
  const def = (stem: string) => readDefinition(fs.readFileSync(path.join(AGENTS_DIR, `${stem}.md`), 'utf8'))!;

  it('the verifier has Read, Glob, Grep, WebFetch and the lookups L only: no Write, Edit or Bash, no C or P tool', () => {
    const { tools } = def('build-guide-verifier');
    expect(tools).toEqual(['Read', 'Glob', 'Grep', 'WebFetch', ...L.map((t) => POB2 + t)]);
    for (const t of tools) {
      expect(['Write', 'Edit', 'NotebookEdit', 'Bash', 'WebSearch']).not.toContain(t);
      expect([...B, ...C, ...P].map((n) => POB2 + n)).not.toContain(t);
    }
  });

  it('states that its report is its return and that it writes nothing (R-5), the C-30 offline rule, and its two checks', () => {
    const body = folded(def('build-guide-verifier').body);
    expect(body).toMatch(/Your report is your return, and the runner writes it to `reports\/` \(R-5\)/);
    expect(body).toMatch(/Fresh and independent\*\* \(D-142\)/);
    expect(body).toMatch(/`external-unavailable` is `accepted-offline` only in an offline run; in an online run it is `unresolved` \(C-30\)/);
    expect(body).toMatch(/without fetching that citation's URL \(D-232\)/);
    expect(body).toMatch(/once as a full pass over every claim, then, for a lens that raised a finding, once as a re-check/);
  });
});

describe('V4: one full pass, then a re-check of only its findings and the changed locations (S2, S3)', () => {
  const v4 = () => folded(readStage('V4'));

  it('V4.md exists, with the parts the stages README names, and every repository path it mentions exists', () => {
    const titles = headings(readStage('V4')).filter((h) => h.level === 2).map((h) => h.title);
    for (const part of ['Inputs', 'Work', 'Writes', 'Returns', 'Fault directives']) {
      expect({ part, present: titles.some((t) => t.startsWith(part)) }).toEqual({ part, present: true });
    }
    let checked = 0;
    for (const file of [path.join(STAGES_DIR, 'V4.md'), path.join(AGENTS_DIR, 'build-guide-verifier.md')]) {
      for (const p of repoPaths(fs.readFileSync(file, 'utf8'))) {
        const cut = p.search(/[<*]/);
        const fixed = cut < 0 ? p : p.slice(0, p.lastIndexOf('/', cut) + 1);
        expect({ file: path.relative(REPO, file), path: p, exists: fs.existsSync(path.join(REPO, fixed)) }).toEqual({ file: path.relative(REPO, file), path: p, exists: true });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('a full pass checks every claim of the plan and the guide, with no sampling; the dossier is not verified (S3)', () => {
    const text = v4();
    expect(text).toMatch(/\*\*`check: "full"`\*\*: do your lens's work below over \*\*every\*\* claim of `plan\.json` and `guide\.md`, with no sampling/);
    expect(text).toMatch(/re-check \*\*every\*\* one with the lookup tools/);
    expect(text).not.toMatch(/1 in 5|recheckedOther|\bcoverage\b/);
    expect(text).toMatch(/The dossier isn't checked: it serves the checkpoint-1 pick, and the guide can't cite it \(S3\)/);
  });

  it('a re-check checks only its findings, each again under its id as fixed or unresolved, and the changed locations; no further round', () => {
    const text = v4();
    expect(text).toMatch(/\*\*`check: "recheck"`\*\*: check only 1\. each finding in the header's `findings`: report it again under the same `id`, with `status: "fixed"` when the claim now holds .* or `unresolved` when it doesn't; and 2\. the claims at the header's `changed` locations, in your lens only/);
    expect(text).toMatch(/There is no further round: what stays open becomes a known issue in the guide/);
  });

  it("the sources lens reports a number or mechanic statement without a marker (V3's check moved here, S2)", () => {
    expect(v4()).toMatch(/\*\*Unsourced claims\.\*\* Every number and every mechanic statement in `guide\.md` carries a marker, and every plan claim a `source`; one without is an `unresolved` finding/);
  });

  it("V4's ledger lens re-derives every ledger entry, and the five waystone-scaled hits from their facts (D-254, A-P11)", () => {
    const text = v4();
    expect(text).toMatch(/For \*\*every\*\* entry of `plan\.json`'s `ledger\[\]`, evaluate its `formula` yourself/);
    expect(text).toMatch(/re-derive the five waystone-scaled hits from the facts themselves/);
    expect(text).toContain('`enemies/map-monsters.json#damage.by-level[<area level>]`');
    expect(text).toContain('`enemies/waystones.json#mods.increased-monster-damage`');
    expect(text).toContain('`enemies/waystones.json#mods.extra-damage-as-element`');
    expect(text).toContain('physical = `base × (1 + increased / 100)`');
    expect(text).toContain('`base × (1 + increased / 100) × extra / 100`');
    expect(text).toContain('the ledger entry `hit_<stage id>_<type>`');
  });

  it("V4's sources lens opens every external source online and none offline, checks every data claim without a fetch offline, and prices against their entries", () => {
    const text = v4();
    expect(text).toMatch(/open \*\*every\*\* source with WebFetch, only on D-171's hosts/);
    expect(text).toMatch(/Offline, open nothing/);
    expect(text).toMatch(/\*\*offline you don't fetch it\*\* \(D-232\)/);
    expect(text).toMatch(/check the claim's amount, currency, date and league against it/);
    expect(text).toMatch(/`accepted-offline` when the run log's mode is `offline`, `unresolved` otherwise \(C-30\)/);
    expect(text).toMatch(/`issue` exactly `tagged external-unavailable` and `location` the claim's/);
  });

  it('V4 follows the lookup rules: D-239…D-241, partly parsed applies none, possibly unread is advisory and confirmed by measurement (D-243)', () => {
    const text = v4();
    for (const d of ['D-239', 'D-240', 'D-241']) expect(text).toContain(d);
    expect(text).toMatch(/A \*\*partly parsed\*\* line means PoB applies \*\*none\*\* of it/);
    expect(text).toMatch(/\*\*`possibly unread` is advisory\*\* \(D-243\): the coordinator confirms it by a measurement/);
    expect(text).toMatch(/never guess the number yourself/);
  });

  it("V4's owners and artifacts are the run checker's, and source-markers.md gives the report's shape with check and no coverage", () => {
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    const listed = (re: RegExp) => [...re.exec(checker)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(listed(/const OWNERS = \[([^\]]*)\]/)).toEqual(['W1', 'D1', 'D2']);
    expect(listed(/const ARTIFACTS = \[([^\]]*)\]/)).toEqual(['plan.json', 'guide.md']);
    expect(v4()).toMatch(/The \*\*owner\*\* is the step that wrote the claim: `W1` for `guide\.md`; `D1` for an endgame stage .*; `D2` for a campaign stage/);
    const markers = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'source-markers.md'), 'utf8'));
    expect(markers).toContain('"check": "full"');
    expect(markers).not.toMatch(/"coverage"|"pass": 1|Counting claims/);
    expect(markers).toMatch(/only in the V4 `sources` report, its `location` naming that claim/);
  });
});

// ---------------------------------------------------------------------------------------------------
// Amendment 1: the slim pipeline (S1, S2, S6, Q1, Q2, Q4)
// ---------------------------------------------------------------------------------------------------

describe('Amendment 1 S1: one orchestration path; the workflow path stays deleted', () => {
  it('the saved workflows, the fallback, V3, dossier-fix, revise-map and the provenance agent are gone', () => {
    for (const gone of [
      '.claude/workflows/build-guide-research.js',
      '.claude/workflows/build-guide-design.js',
      '.claude/skills/build-guide/references/fallback.md',
      '.claude/skills/build-guide/references/stages/V3.md',
      '.claude/skills/build-guide/references/stages/dossier-fix.md',
      '.claude/skills/build-guide/references/stages/revise-map.md',
      '.claude/agents/build-guide/build-guide-provenance.md',
      'tests/helpers/workflowHarness.ts',
    ]) {
      expect({ gone, exists: fs.existsSync(path.join(REPO, gone)) }).toEqual({ gone, exists: false });
    }
  });

  it('no skill file names a workflow, the fallback, V3, dossier-fix or revise-map', () => {
    const files = [SKILL_MD, ...fs.readdirSync(path.join(SKILL_DIR, 'references'), { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name)), ...fs.readdirSync(path.join(SKILL_DIR, 'templates')).map((f) => path.join(SKILL_DIR, 'templates', f))];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      expect({ file: path.relative(REPO, file), stale: text.match(/workflow|fallback\.md|\bV3\b|dossier-fix|revise-map|build-guide-provenance|priceCalls|null-result/g) ?? [] }).toEqual({ file: path.relative(REPO, file), stale: [] });
    }
  });

  it('the task header lists the nine steps, with no pass; a V4 header has its check, a re-check its changed locations', () => {
    const text = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'task-header.md'), 'utf8'));
    expect(text).toContain('| `stage` | `R1a`, `R1b`, `R1b-assemble`, `D1`, `D1-gate`, `D2`, `D2-gate`, `W1` or `V4` |');
    expect(text).not.toMatch(/\| `pass` \|/);
    expect(text).toMatch(/\| `check` \| V4 only: `full` .* or `recheck`/);
    expect(text).toMatch(/\| `changed` \| a V4 re-check, and W1 in the fix round: the locations the fix round's owners changed/);
  });

  it('every stage reference but V4 returns at most 8 lines; V4 returns its report, which the runner writes (R-5)', () => {
    for (const stage of ['R1a', 'R1b', 'R1b-assemble', 'D1', 'D1-gate', 'D2', 'D2-gate', 'W1']) {
      const text = readStage(stage);
      const returns = text.slice(text.indexOf('## Returns'), text.indexOf('## Fault directives'));
      expect({ stage, eight: /At most 8 lines/.test(returns) }).toEqual({ stage, eight: true });
    }
    expect(folded(readStage('V4'))).toMatch(/the runner writes it to `reports\/v4-<lens>\.json` \(or `reports\/v4-<lens>-recheck\.json`\) unchanged \(R-5\)/);
  });

  it('the gate steps write their own verdict files (§3), and the D2 gate runs its final compile in the same step', () => {
    for (const stage of ['R1b', 'D1-gate', 'D2-gate']) {
      expect({ stage, writes: readStage(stage).includes(`reports/gates/${stage}-`) }).toEqual({ stage, writes: true });
    }
    expect(folded(readStage('D2-gate'))).toMatch(/When they do, it runs the final compile, the run's only write into the builds folder, in the same step/);
  });
});

describe('Amendment 1 S2, Q1, Q4: verify once, fix once, re-check, and list the rest as known issues', () => {
  const skill = () => folded(fs.readFileSync(SKILL_MD, 'utf8'));

  it('SKILL.md runs one full pass, one fix round routed to the owners, a re-check of the raising lenses, then the known issues', () => {
    const text = skill();
    expect(text).toMatch(/\*\*Step 11, the full pass\.\*\* Start the three lenses in parallel, `check: "full"`/);
    expect(text).toMatch(/\*\*Step 12, the fix round\*\*, once, only when a report has an `unresolved` finding \(D-264\)\. Send each finding to its `owner`: D1, D2 or W1/);
    expect(text).toMatch(/\*\*Step 13, the re-check\.\*\* When a gate re-ran in the fix round \(an owner recompiled\), the plan and the guide's numbers are new: all three lenses run once more, in parallel, with `check: "recheck"`, their own open findings in `findings` and `changed: "all"`, and check every claim, as a full pass does\. Otherwise \(claims only\) each lens that raised a finding runs once, in parallel/);
    expect(text).toMatch(/Either way there is no further round: what stays open is a known issue/);
    expect(text).toMatch(/\*\*Step 14, known issues\.\*\* A finding is open when it is `unresolved` in its lens's re-check, or `unresolved` in the full pass and not reported `fixed` by a re-check/);
    expect(text).toMatch(/Verification never runs a lens again for its findings beyond the one re-check, and never escalates; only the D1 and D2 gates escalate/);
  });

  it('Q4: a checkpoint-2 revision maps each request to its owner, runs that chain, then the full pass and the same cycle again', () => {
    expect(skill()).toMatch(/run that chain as step 12 does \(claims in place, the gates only after a recompile\), with the requests as `findings` \(`code: "user-request"`\), then steps 11 to 16 again\. A revision counts against no cap/);
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'checkpoints.md'), 'utf8'))).toMatch(/then the full V4 pass, the fix round, the re-check and the known issues again/);
  });

  it('Q1: W1 always writes the one Known issues H3 with the accepted gate findings, and the runner adds the open findings', () => {
    const w1 = folded(readStage('W1'));
    expect(w1).toMatch(/Its last part is always the H3 `Known issues` \(amendment 1 Q1\)\. It lists each finding of the header's `accepted` on its own line/);
    expect(w1).toMatch(/after the V4 checks the runner adds the findings they left open \(SKILL\.md step 14\)/);
    const template = fs.readFileSync(GUIDE_TEMPLATE, 'utf8');
    expect(template).toMatch(/### Known issues\n\n\[always this H3/);
  });
});

describe('Amendment 1 S6, Q2: the retries', () => {
  it('SKILL.md: R1b, the D1 gate and the D2 gate allow 2 counted retries; an attempt-1 fault, a guided retry, the fix round and a revision are uncounted', () => {
    const text = folded(fs.readFileSync(SKILL_MD, 'utf8'));
    expect(text).toMatch(/\*\*Retries, in full\.\*\* The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each\. These attempts count against no cap: an attempt failed by a fault directive that applies to attempt 1 only \(a persistent directive's failed attempts do count: S6\), a guided retry, the fix round and a revision, and the re-run after a missing return/);
    expect(text).toMatch(/a compile failure re-runs, ≤ 2 counted retries, then the concept is `failed`/);
  });

  it('offline-and-test.md: an attempt-1 fault re-runs free, a persistent fault counts, and the run checker counts the same way', () => {
    const text = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'offline-and-test.md'), 'utf8'));
    expect(text).toMatch(/An attempt failed by a directive that applies to attempt 1 only re-runs free: it counts against no retry cap\. A persistent directive's failed attempts count/);
    expect(text).not.toMatch(/orchestration/);
  });
});

// ---------------------------------------------------------------------------------------------------
// Amendment 1 S7: the four kept fixes (compile_plan's full findings are unit-tested in compileAllocation)
// ---------------------------------------------------------------------------------------------------

describe('Amendment 1 S7: D1 sets skills.main.statSet, tools are named mcp__pob2__…, and the three claim rules', () => {
  it('(1) D1 sets skills.main.statSet to the stat set the rolled-skill gate compares, and the gate and the checker hold it (RC-5)', () => {
    expect(folded(readStage('D1'))).toMatch(/\*\*Set `skills\.main\.statSet`\*\* on each variant stage to the rolled skill's stat set whose figure the gate compares, `p<statSet>` in `g<group>s<skill>p<statSet>\.<Field>` \(amendment 1 S7\)/);
    expect(folded(readStage('D1-gate'))).toMatch(/\*\*The rolled figure's stat set is the stage's `skills\.main\.statSet`\*\* \(S7\): the stage's `skills\.main\.group` is its `rolledGroup` \(else `rolled-not-main`\), and a stage without `statSet`, a rolled figure `g<group>s<skill>p<n>` other than `g<main\.group>s<main\.activeSkill>p<main\.statSet>`, or a rolled `ledger:<id>` figure whose formula reads another breakdown field fails with `rolled-stat-set`/);
    expect(fs.readFileSync(path.join(SKILL_DIR, 'references', 'gates.md'), 'utf8')).toContain('| rolledSkill | `rolled-stat-set` |');
    // Review 2: the rolled skill is the main skill, on every stage with a rolledGroup (D1 and D2).
    expect(fs.readFileSync(path.join(SKILL_DIR, 'references', 'gates.md'), 'utf8')).toContain('| rolledSkill | `rolled-not-main` |');
    expect(folded(readStage('D1'))).toMatch(/`skills\.main\.group` is the `rolledGroup`, and the rolled figure, or every breakdown field a ledger figure's formula reads, is `<stage>\.g<main\.group>s<main\.activeSkill>p<main\.statSet>`/);
    expect(folded(readStage('D2'))).toMatch(/Set `skills\.rolledGroup` wherever a stage has the rolled skill, and there `skills\.main\.group` is the `rolledGroup`/);
    expect(fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8')).toContain("'rolled-stat-set'");
  });

  it('(3) the stage references and SKILL.md name every pob2 tool by its full name, mcp__pob2__<tool> (B6); tag refs keep the lookup form', () => {
    const tools = Object.keys(TOOL_META);
    const bare = new RegExp(`(?<![A-Za-z0-9_])(?<!mcp__pob2__)(${tools.join('|')})(?![A-Za-z0-9_])(?! (?:gem|unique|mechanic) ")`, 'g');
    let named = 0;
    for (const file of [SKILL_MD, ...fs.readdirSync(STAGES_DIR).map((f) => path.join(STAGES_DIR, f))]) {
      const text = fs.readFileSync(file, 'utf8');
      named += (text.match(/mcp__pob2__\w+/g) ?? []).length;
      expect({ file: path.relative(REPO, file), bare: text.match(bare) ?? [] }).toEqual({ file: path.relative(REPO, file), bare: [] });
    }
    expect(named).toBeGreaterThan(30);
    expect(readStage('R1b')).toContain('`mcp__pob2__guide_run {validate: "<runFolderRel>/concepts/<id>/plan.json"}`');
  });

  it('(4) source-markers.md states the three claim rules, and V4 checks every claim against them (RC-2…RC-4)', () => {
    const markers = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'source-markers.md'), 'utf8'));
    expect(markers).toMatch(/1\. \*\*Supported in every part\.\*\* The source supports all of the claim/);
    expect(markers).toMatch(/2\. \*\*It cites each fact it rests on\.\*\* A claim resting on two facts .* carries a marker, or a ledger entry, for each/);
    expect(markers).toMatch(/3\. \*\*It carries its source's caveats\.\*\* A source of confidence M or L, a fact whose `note` records a dispute, a `judgment`, or a mechanic no lookup confirmed is stated with that caveat wherever the claim appears/);
    expect(folded(readStage('V4'))).toMatch(/\*\*The claim rules\*\* \(`source-markers\.md`, S7\)\. Check every claim in your lens against all three/);
  });
});

// ---------------------------------------------------------------------------------------------------
// WU-47 fixes still in force (trimmed to amendment 1 S7): the runner's Bash (F3), the import code's one home
// (D-260), the invalid-roll names (D-258), the pick reason, and the general prompt rules from the triage
// ---------------------------------------------------------------------------------------------------

describe('WU-47 fixes: what the runner does', () => {
  const skill = () => folded(fs.readFileSync(SKILL_MD, 'utf8'));

  it("D-265 (e): the runner's Bash runs read-only commands and the run checker; never a network client or a write; the no-cd rule is gone", () => {
    const text = skill();
    expect(text).toMatch(/\*\*Your Bash reads, and runs the run checker; nothing else\*\* \(D-265\)\. It runs read-only commands, `ls`, `cat`, `head`, `grep`, `wc` and `jq` \(with `cd`, pipes and `&&` between them as you need\), and the run checker, `node \.claude\/skills\/build-guide\/scripts\/check-run\.mjs <runFolder>`/);
    expect(text).toMatch(/Never a network client \(`curl`, `wget`, `nc`, `ssh`\) or any host, and never a command that writes, moves or deletes a file: no `>`, `>>`, `tee`, `cp`, `mv`, `rm`, `mkdir`, `touch` or `sed -i`/);
    expect(text).toMatch(/Write every file with Write \(or Edit\), never with Bash or a script\. The agents have no Bash at all/);
    // F3's no-cd and one-command rules went with the workflows.
    expect(text).not.toMatch(/Never `cd`|no compound command|run exactly as written, one per Bash call/);
    expect(text).not.toMatch(/date -u/);
    // The reads still obey the read rule: never the plan, a record, the dossier or the guide.
    expect(text).toMatch(/Never read `plan\.json`, a compile record, `dossier\.md` or `guide\.md` \(one final record was 268 KB\), with Read or with Bash/);
    // And no agent type has Bash.
    for (const file of fs.readdirSync(path.join(REPO, '.claude', 'agents', 'build-guide'))) {
      const tools = /^tools:\s*(.*)$/m.exec(fs.readFileSync(path.join(REPO, '.claude', 'agents', 'build-guide', file), 'utf8'))?.[1] ?? '';
      expect({ file, bash: /\bBash\b/.test(tools) }).toEqual({ file, bash: false });
    }
  });

  it("D-260: the import code lives only in the record; the D2 gate copies none and the run log's outputs hold none", () => {
    const d2Gate = readStage('D2-gate');
    expect(d2Gate).not.toMatch(/"importCode"/);
    expect(folded(d2Gate)).toMatch(/Don't copy the import code: `compile-record\.json` is its one home, and W1 copies it from there \(D-260\)/);
    const log = fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8');
    expect(log).toContain('| `outputs` | `{plan, record, dossier, guide, pobFile}`');
    expect(log).toContain('"outputs": { "plan": null, "record": null, "dossier": null, "guide": null, "pobFile": null }');
    expect(skill()).toMatch(/`outputs` \(`plan`, `record`, `dossier`, `guide` and the PoB file; not the import code, whose one home is the record, D-260\)/);
    const spec = fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'spec', '03-pipeline.md'), 'utf8');
    expect(spec).toContain('| `outputs` | `{plan, record, dossier, guide, pobFile}`; the import code stays in the record (D-260) |');
  });

  it('D-258: the invalid-roll refusal quotes the closest names lookup_game_data lists on no match', () => {
    const text = skill();
    expect(text).toMatch(/when nothing matched, `mcp__pob2__lookup_game_data` says "Nothing matched …", then lists up to 5 names under `Closest active gem names \(…\):` and up to 3 under `Closest support gem names \(…\):`, each line `- <name> \(active\|support\)` \(D-258, D-258a\)\. Quote the active names, in its order: only an active gem is a valid roll/);
    // The headers are the tool's own (src/handlers/lookupHandlers.ts).
    const handler = fs.readFileSync(path.join(REPO, 'src', 'handlers', 'lookupHandlers.ts'), 'utf8');
    expect(handler).toContain('`Closest ${kind} gem names ${SUGGESTION_ORDER}:`');
    expect(handler).toMatch(/for \(const kind of \["active", "support"\]\)/);
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
    // The run log records the rule (S4 keeps it), and V4's prose lens checks the sentence against it.
    const log = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8'));
    expect(log).toContain('| `checkpoints[]` | `{checkpoint, visit, answer, answeredBy, rule?}` |');
    expect(log).toMatch(/`rule` records how the answer was reached: the test config's answer exactly as written \(`first-viable`, `pick:c2`\) for `pre-supplied`, or the default that applied .* for `default`\. A user's answer has no `rule`/);
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'checkpoints.md'), 'utf8'))).toMatch(/the entry's `rule` keeps how the answer was reached/);
    const v4 = folded(readStage('V4'));
    expect(v4).toMatch(/\*\*Why this concept\*\* \(Summary\): check it against `run-log\.json`'s last checkpoint 1 entry whose `answer` is `pick:<the guide's concept>`.* quotes the entry's `rule` exactly\. A reason the entry doesn't record, a different rule, or a pick attributed to the wrong answerer is a finding \(owner `W1`\)/);
  });

  it('D-260: W1 returns no import code', () => {
    const w1 = readStage('W1');
    const returns = w1.slice(w1.indexOf('## Returns'), w1.indexOf('## Fault directives'));
    expect(folded(returns)).toMatch(/No import code: you copied it into the guide, and `compile-record\.json` keeps it \(D-260\)/);
    expect(returns).not.toMatch(/"importCode"/);
  });

  it('W1 keeps a hedge wherever it repeats a claim, and calls a mechanic reliable only with a source in the build', () => {
    const w1 = folded(readStage('W1'));
    expect(w1).toMatch(/State a mechanic as reliable only when the build has a source for it/);
    expect(w1).toMatch(/keeps its hedge everywhere the guide repeats it/);
  });

  it('D1 quotes no suggest_supports gain as a number', () => {
    expect(folded(readStage('D1'))).toMatch(/Never quote a `mcp__pob2__suggest_supports` gain as a number in a claim/);
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

// ---------------------------------------------------------------------------------------------------
// Review of bg/amend-1: the references say what the checker now holds (items 1, 6, 7, 9, 10)
// ---------------------------------------------------------------------------------------------------

describe('Review of bg/amend-1: the references', () => {
  const skill = () => folded(fs.readFileSync(SKILL_MD, 'utf8'));
  const gates = () => folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'gates.md'), 'utf8'));

  it('1: only the budget may be unverified; any other unverified part routes as a compile, V1 or V2 failure (SKILL.md §4, gates.md)', () => {
    expect(skill()).toMatch(/any part but the budget `unverified` \(only the budget may stay unverified, D-164\): a failure, routed as a compile, V1 or V2 failure/);
    expect(gates()).toMatch(/Only the budget may stay `unverified` \(D-164\): a gate whose compile failed leaves its other parts `unverified`, and any other part `unverified` is a failure/);
    expect(gates()).toContain('| any part but the budget `unverified` | any | as a compile, V1 or V2 failure |');
    expect(folded(readStage('D1-gate'))).toMatch(/Once the compile ran, every part but the budget is `pass` or `fail`: only the budget may stay `unverified` \(D-164\)/);
  });

  it('3: the runner logs each gate attempt with the outcome its verdict file routes to', () => {
    expect(skill()).toMatch(/Log each gate attempt with the outcome its verdict file routes to; the run checker holds the log to the files/);
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8'))).toMatch(/A gate attempt's outcome is the one its verdict file routes to/);
  });

  it('6, as D-264 changes it: a fix round in which a gate re-ran re-checks all three lenses (changed: "all"); W1 always patches in place', () => {
    expect(skill()).toMatch(/\| 13 \| V4 re-check \| `build-guide-verifier`, in parallel: each lens that raised a finding, or all three when a gate re-ran in the fix round \|/);
    expect(skill()).toMatch(/W1 still patches the guide in place, its header's `changed` `"all"`/);
    expect(folded(readStage('V4'))).toMatch(/With `changed: "all"` \(a gate re-ran in the fix round: an owner recompiled, D-264\), that is every claim of the new `plan\.json` and `guide\.md` in your lens, as a full pass checks them/);
    expect(folded(readStage('W1'))).toMatch(/\*\*The fix round and revisions\*\* \(D-264\)\. You never write the guide anew: fix it in place with Edit/);
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'task-header.md'), 'utf8'))).toMatch(/or `"all"` when a gate re-ran in the fix round \(an owner recompiled/);
  });

  it("7: a reference hit cites the damage at its variant's area level, and its ledger entry derives from it (gates.md, the D1 gate)", () => {
    for (const text of [gates(), folded(readStage('D1-gate'))]) {
      expect(text).toMatch(/cites `enemies\/map-monsters\.json#damage\.by-level\[<area level>\]` at the variant's area level \(79 for the budget variant/);
    }
  });

  it('9: the gate steps Grep the record when compile_plan says how many findings it left out', () => {
    for (const stage of ['D1-gate', 'D2-gate']) {
      expect({ stage, grep: /every V1 and V2 finding up to 200; when a line says how many more, Grep `compile-record\.json`'s `stages\.<id>\.v1\.findings` and `stages\.<id>\.v2\.findings` for them/.test(folded(readStage(stage))) }).toEqual({ stage, grep: true });
    }
    const handler = fs.readFileSync(path.join(REPO, 'src', 'handlers', 'planHandlers.ts'), 'utf8');
    expect(handler).toContain("more findings; Grep the record's findings");
  });

  it("10: the D1 gate's writes include plan.json, and the guided retry reads the same in SKILL.md, checkpoints.md and gates.md", () => {
    expect(skill()).toContain('| 7 | D1-gate | `build-guide-coordinator`, fresh | `reports/gates/D1-gate-<c>-a<n>.json`; `plan.json` (FI-2 and the final re-price pass) |');
    expect(skill()).toMatch(/\*\*guidance and one more retry\*\*: the producer \(D1 or D2\) gets one more attempt, uncounted, with the verdict and the user's guidance .* then its gate\. If the gate fails, whatever part fails, it escalates again/);
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'checkpoints.md'), 'utf8'))).toMatch(/the producer \(D1 or D2\) gets one more attempt with the verdict and the user's guidance in `findings`, then its gate\. That attempt counts against no cap, and if the gate fails, whatever part fails, it escalates again/);
    expect(gates()).toContain('| any failure, after a guided retry or an accepted re-run | any | `escalated` again (D-236) |');
  });
});

// ---------------------------------------------------------------------------------------------------
// D-264 (claims fixed in place) and D-265 (the small items): what the references say
// ---------------------------------------------------------------------------------------------------

describe('D-264: the fix round edits claims in place and recompiles only for a build change', () => {
  const skill = () => folded(fs.readFileSync(SKILL_MD, 'utf8'));
  const ref = (name: string) => folded(fs.readFileSync(path.join(SKILL_DIR, 'references', name), 'utf8'));

  it('SKILL.md step 12: owners fix claims in place, recompile only for gear, tree, gems, config, scenario or a ledger formula, and say whether they recompiled', () => {
    const text = skill();
    expect(text).toMatch(/Each owner fixes, in place with Edit, every claim the issue touches, not only the flagged location: the claim's wording, citation, caveat or source\. It recompiles only when a finding needs a build change: gear, tree, gems, config, scenario or a ledger formula\. It returns the ids it fixed, the locations it changed and whether it recompiled/);
    expect(text).toMatch(/\*\*No owner recompiled\*\* \(claims only\): no gate runs; D1 → W1, D2 → W1, D1 → D2 → W1 or W1 alone\. Log each D1 or D2 of the round with outcome `claims-edited`/);
    expect(text).toMatch(/\*\*An owner recompiled:\*\* its gates run as now: \*\*D1\*\* → D1 gate → D2 gate → W1; \*\*D2\*\* → D2 gate → W1/);
    expect(text).toMatch(/W1 always runs last: it fixes its own findings and patches the guide in place wherever it repeats a claim another owner changed/);
    expect(text).toContain('| 12 | Fix round, once, only with open findings, uncounted | the owners: D1, D2, W1 | their own files: claims edited in place; a compile only for a build change | the ids fixed, the locations changed, and whether it recompiled |');
  });

  it('D1 and D2: edit in place, recompile only for a build change, otherwise validate once and leave the final record; return recompiled', () => {
    for (const stage of ['D1', 'D2']) {
      const text = folded(readStage(stage));
      expect({ stage, inPlace: /## The fix round and revisions \(D-264\) With V4 findings or the user's requests in `findings`, you edit the plan in place/.test(text) }).toEqual({ stage, inPlace: true });
      expect({ stage, rule: /\*\*Recompile only for a build change\.\*\* A fix changes the build when it changes gear .* the tree, the gems, the config \(earned or scenario.*\), or a ledger entry's formula or inputs/.test(text) }).toEqual({ stage, rule: true });
      expect({ stage, none: /\*\*Otherwise compile nothing\.\*\* After your edits, validate once \(`mcp__pob2__guide_run \{validate: "<runFolderRel>\/plan\.json"\}`\) so the plan still validates, and leave `compile-record\.json` and the PoB file as the final compile left them/.test(text) }).toEqual({ stage, none: true });
      expect({ stage, returns: /`recompiled: yes` or `recompiled: no`, the finding ids you fixed and the locations you changed/.test(text) }).toEqual({ stage, returns: true });
    }
    expect(folded(fs.readFileSync(path.join(AGENTS_DIR, 'build-guide-coordinator.md'), 'utf8'))).toMatch(/Recompile only when a fix changes the build .* Otherwise compile nothing, validate once, and leave the final record as it is\. Return `recompiled: yes` or `no`/);
  });

  it('the run log names the claims-only owner `claims-edited`, which the checker tells from a redesign, and the header carries W1 its changed locations', () => {
    expect(ref('run-log.md')).toMatch(/`claims-edited` for a D1 or D2 of the fix round or a revision that returned `recompiled: no`: it edited claims in place and compiled nothing, so no gate follows it \(D-264\)/);
    expect(ref('task-header.md')).toMatch(/\| `changed` \| a V4 re-check, and W1 in the fix round/);
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    expect(checker).toContain("const CLAIMS_EDITED = 'claims-edited';");
    expect(ref('run-folder.md')).toMatch(/of all three lenses if and only if a gate re-ran in the fix round \(D-264\)/);
  });
});

describe('D-265: the small items', () => {
  const ref = (name: string) => folded(fs.readFileSync(path.join(SKILL_DIR, 'references', name), 'utf8'));

  it('(b) checkpoints.md: a pre-supplied answer still prints the display, checkpoint 1\'s comparison lines and an infeasible concept\'s evidence on a revisit', () => {
    const text = ref('checkpoints.md');
    expect(text).toMatch(/\*\*A pre-supplied answer still prints the display\*\* \(D-265\)\. The test config replaces only the question: show everything the checkpoint shows the user, then the answer it resolved to/);
    expect(text).toMatch(/At checkpoint 1 that is R1b-assemble's comparison lines, each concept's status and the dossier's path, on every visit; on a revisit after an `infeasible` design or an escalation, that concept's evidence \(its last verdict file\)/);
  });

  it('(c) D2 picks every campaign reward choice into config.scenario with a one-line reason; W1 and the template write the picks under Campaign rewards', () => {
    const d2 = folded(readStage('D2'));
    expect(d2).toMatch(/\*\*Reward choices\*\* \(D-265\): pick every campaign reward choice C1 lists, each a quest with a `q\.<key>\.options` fact in `data\/campaign\/progress\.json`/);
    expect(d2).toMatch(/List the pick in `config\.scenario` of \*\*every\*\* campaign stage at or after the quest, the same pick on each/);
    expect(d2).toMatch(/Each reward pick of step 6 has one claim, on the first stage that lists it: the quest, the option taken and a one-line reason, citing `data:campaign\/progress\.json#q\.<key>\.options\[<i>\]`/);
    expect(folded(readStage('W1'))).toMatch(/\*\*Campaign rewards\*\* \(D-265\): one line per quest reward the campaign passes, in campaign order\. For each reward choice the plan picks .* with a marker defined as `data \| campaign\/progress\.json#q\.<key>\.options\[<i>\]`\. Never list a choice's options without its pick/);
    const template = fs.readFileSync(GUIDE_TEMPLATE, 'utf8');
    expect(template).toContain("- <quest and act, a reward choice>: take <the option the plan picks>, because <the one-line reason its claim gives>.[^c2]");
    expect(template).toContain('[^c2]: data | campaign/progress.json#<progress key>.options[<the picked option\'s index>]');
    // The plan field is the existing scenario list, as the plan reference says.
    expect(fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'plan-reference.md'), 'utf8')).toMatch(/A reward choice \(a quest whose C1 data has `q\.<key>\.options`\) defaults to Nothing; once the stage's `progress` is at or after its quest, list the pick here/);
    expect(fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8')).toContain("fail('campaign-rewards'");
  });

  it("(d) every V4 finding carries a reader sentence; the runner writes each open one as `- <reader> (<id>)` at step 14, from W1's known-issues-line", () => {
    const v4 = folded(readStage('V4'));
    expect(v4).toMatch(/\*\*`reader`\*\* \(D-265\) is one plain sentence the guide's reader can act on, what is wrong in the guide and what is true instead, with no pipeline words/);
    expect(v4).toMatch(/Every finding has its `reader` sentence, whatever its status/);
    expect(readStage('V4')).toMatch(/"reader": "[^"]+",\n\s+"owner": "D1", "status": "unresolved"/);
    const markers = ref('source-markers.md');
    expect(markers).toMatch(/Each finding has `id`, `artifact` \(`plan\.json` or `guide\.md`\), `location`, `claim`, `issue`, `evidence`, `reader`, `owner`/);
    expect(markers).toMatch(/The runner writes every open finding into the guide's `Known issues` as `- <reader> \(<id>\)`: its `reader` sentence as the report gives it, then its id in parentheses \(SKILL\.md step 14, D-265\)\. The run checker finds each line by its id and requires its text to be the finding's `reader` sentence/);
    const skill = folded(fs.readFileSync(SKILL_MD, 'utf8'));
    expect(skill).toMatch(/Read the three lines of `guide\.md` from the `known-issues-line` W1 returned last \(W1 returns it on its first write and on every patch;/);
    expect(skill).toMatch(/every open finding has its own line after the heading, `- <reader> \(<id>\)`: the finding's `reader` sentence exactly as its report gives it, a plain sentence the guide's reader can act on \(D-265\), then its id in parentheses/);
    expect(fs.readFileSync(SKILL_MD, 'utf8')).toContain("| 14 | Known issues | you | each open finding's `reader` sentence, into `guide.md`'s `Known issues` | — |");
    expect(skill).not.toMatch(/known-issues`|W1 runs once more/);
    const w1 = folded(readStage('W1'));
    expect(w1).toMatch(/`known-issues-line: <n>`, the line number of the `### Known issues` heading in the guide as you leave it, on your first write and on every patch/);
    expect(w1).toMatch(/You write each accepted gate finding, with its gate, code and plan stage in the parentheses/);
    const template = fs.readFileSync(GUIDE_TEMPLATE, 'utf8');
    expect(template).toMatch(/\[added by the runner at step 14\] - <the finding's reader sentence, word for word: "[^"]+"> \(<V4 finding id>\)/);
    expect(template).not.toMatch(/\(V4 <lens>, <artifact> <location>\)/);
    expect(fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8')).toContain('has no reader: one plain sentence');
    expect(ref('run-log.md')).not.toMatch(/known-issues/);
  });

  it('(f) R1b applies FI-1 in the attempt\'s first compile, the bootstrap, and offline-and-test.md says the same', () => {
    const r1b = folded(readStage('R1b'));
    expect(r1b).toMatch(/2\. \*\*FI-1\*\*, only when the header's `faults` holds it: FI-1 goes into this attempt's \*\*first\*\* compile, so a faulted attempt compiles nothing clean and a concept FI-1 fails leaves no clean record \(D-265\)\. That first compile is the bootstrap \(step 3\), which you then always run/);
    expect(r1b).toMatch(/\*\*FI-1\*\* \(`\.claude\/skills\/build-guide\/references\/offline-and-test\.md`\): step 2, in the attempt's first compile, the bootstrap, which always runs then \(D-265\)/);
    expect(r1b).not.toMatch(/before the last compile and never in the bootstrap|right before the last compile, add/);
    expect(ref('offline-and-test.md')).toContain('| FI-1 | the R1b step, before the attempt\'s first compile: the bootstrap, which then always runs (`stages/R1b.md` step 2), so a faulted attempt compiles nothing clean and a concept it fails leaves no clean record (D-265) |');
  });
});
