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
 *
 * Amendment 3's content (WU-56): the card template (AC-W27, §7.5), the pattern library (AC-W28, §7.6) and
 * R1b's advisory checklist with its probe budget (AC-W29, §7.7).
 * Amendment 2 (WU-62, D-276…D-283): AC-W11 takes the reader layer's 14 H2s; the audit template (§7.8); W1's
 * reader-layer rules (first-person advice, each caveat once, not a tutorial, the cap); V4's editor lens; the
 * entering-maps rung `m` in D1, D2, the D1 gate and gates.md.
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

/**
 * Shared references that ship before SKILL.md lists them. WU-56 adds the pattern library (C-53), which the
 * R1a researchers read; SKILL.md is WU-62's and WU-57's (spine §8's serialized wiring), and WU-57 lists the
 * library there. The exemption expires two ways: a check fails once SKILL.md lists an entry, and another fails
 * once WU-57 has landed while the list is non-empty.
 */
const AWAITING_SKILL_WIRING = ['references/patterns.md'];
/**
 * WU-57's marker: `references/stages/R1a-assemble.md`, which slice 03 assigns only to WU-57 (its touches:
 * "references/stages/R1a-assemble.md (new)"; AC-W31 requires it). Once it exists, nothing may await wiring.
 */
const WU57_ONLY_FILE = 'references/stages/R1a-assemble.md';

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
      .map((e) => `references/${e.name}`)
      .filter((ref) => !AWAITING_SKILL_WIRING.includes(ref));
    for (const ref of shipped) expect({ ref, listed: text.includes(ref) }).toEqual({ ref, listed: true });
  });

  it('a reference awaiting its SKILL.md wiring is exempt only until SKILL.md lists it', () => {
    // When SKILL.md names it, drop it from AWAITING_SKILL_WIRING in the same commit.
    for (const ref of AWAITING_SKILL_WIRING) {
      expect({ ref, ships: fs.existsSync(path.join(SKILL_DIR, ref)), listed: text.includes(ref) }).toEqual({ ref, ships: true, listed: false });
    }
  });

  it(`the exemption expires with WU-57: once ${WU57_ONLY_FILE} exists, no reference awaits SKILL.md`, () => {
    const landed = fs.existsSync(path.join(SKILL_DIR, WU57_ONLY_FILE));
    expect({ landed, awaiting: landed ? AWAITING_SKILL_WIRING : [] }).toEqual({ landed, awaiting: [] });
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
const AUDIT_TEMPLATE = path.join(SKILL_DIR, 'templates', 'audit-template.md');
/** §8's target, the reader layer (WU-62, D-276): the guide's 14 H2s, in order. */
const GUIDE_H2 = [
  'At a glance',
  'Your PoB file',
  'Survival by stage',
  'Gem and ascendancy timing',
  'Priorities',
  'Leveling',
  'Campaign route and rewards',
  'Endgame: entering maps',
  'Endgame: budget',
  'Endgame: non-budget',
  'How to play it',
  "What PoB can't show",
  'FAQ',
  'Changelog',
];
/** §7.8, the audit layer (WU-62, D-278): audit.md's H2s, in order. */
const AUDIT_H2 = ['Hand calculations', 'Stage detail', "What PoB doesn't model", 'Inputs by confidence', 'Run notes', 'Known issues'];
const ENDGAME_H2 = ['Endgame: entering maps', 'Endgame: budget', 'Endgame: non-budget'];
/** D-283: the verdict line's fixed form, as §8's target gives it. */
const VERDICT_FORM = '- **<Entering maps|Budget|Non-budget> (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS.';
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

  it('D1 prices every slot and tree jewel of every rung, m-, b- and n-, with its own entry unless the text is identical (D-249, D-281)', () => {
    const text = folded(readStage('D1'));
    expect(text).toMatch(/One `prices\[\]` entry per filled slot and tree jewel of \*\*every\*\* rung \(D-249, D-281\), ids `m-<slot>`, `b-<slot>` and `n-<slot>`/);
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

  it("W1 takes the league from plan.json, and lists a rung's respec from the rung before it on the ladder (D-282)", () => {
    const text = folded(readStage('W1'));
    expect(text).toMatch(/\*\*The league\*\* is `plan\.json`'s `league`: `unverified` there means/);
    expect(text).toContain('Where a stage has a `respec` (from the rung before it on the ladder, D-282), a respec line gives the dropped nodes and the gold cost');
  });

  it("W1 rounds a reference hit from its ledger value, never as the scenario's whole number, and audit.md keeps the value (D-256 as D-276 amends it)", () => {
    expect(folded(readStage('W1'))).toMatch(/Quote a reference hit rounded from its ledger value \(`audit\.md` keeps the value itself\), never as the scenario's whole number \(439\), which is that value rounded up for PoB \(D-256\)/);
    const template = fs.readFileSync(GUIDE_TEMPLATE, 'utf8');
    const verdicts = template.split(/\r?\n/).filter((l) => /^- \*\*(Entering maps|Budget|Non-budget) \(L<level>\)/.test(l));
    expect(verdicts).toHaveLength(3);
    for (const l of verdicts) expect(l).toContain('Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>.');
    expect(fs.readFileSync(AUDIT_TEMPLATE, 'utf8')).toContain("**Reference hits:** <per endgame rung, each `hit_<stage>_<type>` ledger value, and the whole number its scenario gives PoB>");
  });

  it("V4's ledger lens wants the scenario hit at its ledger value's ceiling, and leaves the guide's numbers to the prose lens and the checker (D-256, D-279)", () => {
    const text = folded(readStage('V4'));
    expect(text).toMatch(/with those inputs and that formula and no other input/);
    expect(text).toMatch(/equal to its \*\*ceiling\*\*: the record value rounded to 2 decimals, then up to a whole number, because PoB takes these options as whole numbers \(D-256; 96\.4789 gives 97, and 402\.000003 gives 402\)/);
    expect(text).toContain('A whole-number scenario value is right, not a mismatch.');
    expect(text).toContain("The guide's numbers aren't this lens's (D-279): the `prose` lens reads them, and the run checker compares each verdict line with the record.");
    expect(text).not.toMatch(/For every guide number that cites an entry/);
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
    expect(text).toMatch(/When the entering-maps total is over 5 and at most 5\.5, or the budget total over 20 and at most 22, that `Checks` says \*\*near the ceiling\*\*, in those words/);
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
    expect(w1).toMatch(/`guide\.md` and `audit\.md` only, and no other file: no notes, drafts or scratch files, in the run folder or anywhere else/);
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

describe('AC-W11 (as WU-62 amends it, D-276): the guide template is the reader layer (§8)', () => {
  const text = fs.existsSync(GUIDE_TEMPLATE) ? fs.readFileSync(GUIDE_TEMPLATE, 'utf8') : '';
  const hs = headings(text);
  const lines = text.split(/\r?\n/);
  const under = (title: string, level = 3) => {
    const h2 = hs.find((h) => h.level === 2 && h.title === title)!;
    const next = hs.find((h) => h.line > h2.line && h.level <= 2);
    return hs.filter((h) => h.level === level && h.line > h2.line && h.line < (next?.line ?? lines.length)).map((h) => h.title);
  };
  const sectionOf = (title: string) => {
    const h = hs.find((x) => x.title === title)!;
    const next = hs.find((x) => x.line > h.line && x.level <= h.level);
    return lines.slice(h.line, next?.line ?? lines.length);
  };

  it("has the reader layer's 14 H2s in order, the same list the run checker holds, under one H1 naming the roll", () => {
    expect(hs.filter((h) => h.level === 1).map((h) => h.title)).toEqual(['<Ascendancy> / <Skill>: <concept title>']);
    expect(hs.filter((h) => h.level === 2).map((h) => h.title)).toEqual(GUIDE_H2);
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    const listed = /export const GUIDE_H2 = (\[[\s\S]*?\]);/.exec(checker);
    expect(listed).not.toBeNull();
    // The checker's list is a JS literal of single- and double-quoted strings.
    const items = [...listed![1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
    expect(items).toEqual(GUIDE_H2);
  });

  it('has the H3 Checks under each endgame rung, and only Checks there', () => {
    for (const title of ENDGAME_H2) expect({ title, h3: under(title) }).toEqual({ title, h3: ['Checks'] });
  });

  it("gives Leveling one H3 per campaign stage, titled with the record's loadout name, and ends What PoB can't show with the H3 Known issues", () => {
    expect(under('Leveling')).toEqual(['<loadoutName of the first campaign stage, exactly as compile-record.json has it>']);
    expect(under("What PoB can't show")).toEqual(['Known issues']);
    expect(text).not.toContain('Accepted failures');
  });

  it('carries no markers, Sources, confidence labels or audit material: those are audit.md\'s (D-276, D-278)', () => {
    expect(text).not.toMatch(/\[\^/);
    expect(hs.map((h) => h.title)).not.toContain('Sources');
    expect(text).not.toMatch(/\bconfidence:? [HML]\b/);
    for (const gone of ['| Entry | Claim | Value | Formula, in words |', 'Why this concept', 'Defences and resistances', 'How it works']) expect({ gone, present: text.includes(gone) }).toEqual({ gone, present: false });
  });

  it('states the rules every section keeps: a game guide that renders the plan, first-person advice, each caveat once, not a tutorial, and the cap', () => {
    const comment = folded(/<!--([\s\S]*?)-->/.exec(text)![1]);
    expect(comment).toContain('It is a game guide, not a design document.');
    expect(comment).toMatch(/The guide renders the plan and the record: every fact and number is one they hold, rounded as a guide rounds it/);
    expect(comment).toMatch(/Advice is in the first person \("I", "my"\)/);
    expect(comment).toMatch(/Each caveat appears once, where the reader acts on it/);
    expect(comment).toMatch(/No markers, confidence labels, finding ids or pipeline words, and no stage ids outside loadout names/);
    expect(comment).toMatch(/Not a tutorial: .* If it would read as true word for word in a guide for another skill on another class, cut it/);
    expect(comment).toMatch(/At most 3,000 words, the H1, the import code and the Known issues list not counted\. The word counts below are each section's budget, about 2,840 in all/);
  });

  it('puts the import code in the first fenced block of Your PoB file, with the loadout line, the stat-examples line, the versions, the offline line and the PoB notes (§8 row 2)', () => {
    const section = sectionOf('Your PoB file').join('\n');
    expect(section).toMatch(/```\n<importCode, copied exactly from compile-record\.json>\n```/);
    expect(section).toContain('Its loadouts, in order:');
    expect(section).toContain('The items are stat examples: match the affixes, not the item.');
    expect(section).toContain('offline: Made offline, so no prices were checked.');
    for (const note of ['versionNotes', 'loadoutWarnings', 'saveWarnings']) expect(section).toContain(note);
    expect(section).toContain('check Weapon 2 and Weapon 2 Swap');
  });

  it("gives Survival by stage one verdict line per endgame rung in the fixed form the run checker holds (D-283)", () => {
    const section = sectionOf('Survival by stage');
    const forms = section.filter((l) => /^- \*\*(Entering maps|Budget|Non-budget) \(L<level>\)/.test(l));
    const fixed = (label: string) => VERDICT_FORM.replace('<Entering maps|Budget|Non-budget>', label);
    expect(forms).toEqual(['Entering maps', 'Budget', 'Non-budget'].map(fixed));
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    expect(checker).toContain(`const VERDICT_FORM = '${VERDICT_FORM}';`);
  });

  it("puts in each rung's Checks only what the verdict line doesn't: the chaos exception, the budget line, and the Arbiter for b and n (D-281)", () => {
    const checks = (title: string) => {
      const all = sectionOf(title);
      return all.slice(all.findIndex((l) => l === '### Checks'));
    };
    const chaos = "[only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.";
    for (const title of ENDGAME_H2) expect({ title, chaos: checks(title).some((l) => l.includes(chaos)) }).toEqual({ title, chaos: true });
    const m = checks('Endgame: entering maps').join('\n');
    expect(m).toContain('Budget: <total> divines against the 5-divine ceiling.');
    expect(m).toContain('<total> divines is near the ceiling: over 5, within the 5.5-divine tolerance.');
    expect(m).toContain("so this rung can't be claimed to fit 5 divines");
    expect(m).not.toMatch(/Arbiter|Mapping/);
    const b = checks('Endgame: budget').join('\n');
    expect(b).toContain('<total> divines is near the ceiling: over 20, within the 22-divine tolerance.');
    expect(b).toContain("so this variant can't be claimed to be under 20 divines");
    for (const title of ['Endgame: budget', 'Endgame: non-budget']) expect({ title, arbiter: checks(title).some((l) => l.includes('The Arbiter of Divinity')) }).toEqual({ title, arbiter: true });
    // Each rung's H2 opens with its one "Move here when" line.
    for (const title of ENDGAME_H2) expect({ title, move: sectionOf(title).filter((l) => l.startsWith('Move here when')).length }).toEqual({ title, move: 1 });
  });

  it("gives entering maps a numbered buy order within 5 divines, and the budget variant a slot table naming an affix's source where it limits the base (D-277)", () => {
    expect(sectionOf('Endgame: entering maps').join('\n')).toMatch(/the buy order within 5 divines:>\s+1\. <the first buy>/);
    const b = sectionOf('Endgame: budget').join('\n');
    expect(b).toContain('| Slot | Target | Fallback |');
    expect(b).toContain('where an affix\'s source limits the base, say so ("Arcane Surge on Crit is desecrated, so the gloves need energy shield")');
  });

  it('marks the optional items (D-277), and has no section for what is held back', () => {
    for (const optional of ['| [optional] <when> | Hold:', '| [optional] <when> | Save:', '[optional] Buy <item> now; it works at <loadout name>.', '[optional] <a rotation clause, when the stage\'s damage is a combo>.', '[optional] <the item or node> stays dormant until', '[optional, up to 4, each confirmed by item text, gem text or PoB] **Trap:**', '[optional, up to 2] **<X or Y?>**']) {
      expect({ optional, present: text.includes(optional) }).toEqual({ optional, present: true });
    }
    expect(sectionOf('Priorities').join('\n')).toMatch(/\*\*When you're short:\*\* short on <spirit \| mana \| an attribute>\? I drop <first>, then <second>/);
    expect(sectionOf("What PoB can't show").join('\n')).toContain('The headline figures assume <the plan\'s config they rest on: charges, stacks, counts>.');
    expect(text).not.toMatch(/[Cc]rafting|[Aa]tlas|regex/);
  });

  it("names each campaign reward pick by its first line, as the run checker looks for it (D-265 c, D-283)", () => {
    expect(sectionOf('Campaign route and rewards').join('\n')).toContain('take <the first line of the option the plan picks, exactly as data/campaign/progress.json lists it>; <the reason its claim gives>.');
  });
});

describe('§7.8 (WU-62, D-278): the audit template', () => {
  const text = fs.existsSync(AUDIT_TEMPLATE) ? fs.readFileSync(AUDIT_TEMPLATE, 'utf8') : '';
  const hs = headings(text);

  it("has §7.8's six H2s in order, the same list the run checker holds", () => {
    expect(hs.filter((h) => h.level === 2).map((h) => h.title)).toEqual(AUDIT_H2);
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    const listed = /export const AUDIT_H2 = (\[[^\]]*\]);/.exec(checker);
    expect(listed).not.toBeNull();
    expect([...listed![1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2])).toEqual(AUDIT_H2);
  });

  it('holds the ledger table, the stage detail, the coverage flags, the inputs by confidence, why this concept and the budget totals', () => {
    expect(text).toContain('| Entry | Claim | Value | Formula, in words |');
    for (const part of ['**Resistances by stage:**', '**Reference hits:**', '**Mana and leech:**', '**The Arbiter of Divinity:**', '**Mapping:**', 'mcp__pob2__check_model_coverage', '**M:**', '**L:**', '**The D1 gate\'s budget:**']) {
      expect({ part, present: text.includes(part) }).toEqual({ part, present: true });
    }
    const why = text.split(/\r?\n/).find((l) => l.startsWith('- **Why this concept:**'))!;
    expect(why).toContain("run-log.json's checkpoint 1 entry that picked it records");
    expect(why).toContain("the test config picked it at checkpoint 1 by the rule `<the entry's rule, exactly>`");
  });

  it("gives Known issues the table the run checker reads: each finding's id, its lens or gate, its stage and the sentence the guide prints", () => {
    expect(text).toContain('| Id | Lens or gate | Stage | Sentence in the guide |');
    expect(text).toContain('| <an open V4 finding\'s id> | <its lens: ledger, sources or prose> | — | <its reader sentence, word for word> |');
    expect(text).toContain('| <an accepted gate finding\'s code> | <D1-gate or D2-gate> | <its plan stage, or —> | <the sentence you wrote for it in the guide> |');
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

  it("the sources lens reports a plan claim without a source, and has no guide side: the guide carries no markers (D-276, D-279)", () => {
    expect(v4()).toMatch(/\*\*Unsourced claims\.\*\* Every plan claim has a `source`; one without is an `unresolved` finding \(issue `no source`\)/);
    expect(v4()).toMatch(/The guide carries no markers, so this lens has no guide side: the plan's claims carry the guide's sources \(D-276, D-279\)/);
    expect(v4()).not.toMatch(/`data \| <file>#<key>` in markdown|guide\.md \[\^<id>\]/);
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
    // The prose lens checks "why this concept" in audit.md (D-279), so a finding may name it, owner W1.
    expect(listed(/const ARTIFACTS = \[([^\]]*)\]/)).toEqual(['plan.json', 'guide.md', 'audit.md']);
    expect(v4()).toMatch(/The \*\*owner\*\* is the step that wrote the claim: `W1` for `guide\.md` and `audit\.md`; `D1` for an endgame stage .*; `D2` for a campaign stage/);
    const markers = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'source-markers.md'), 'utf8'));
    expect(markers).toContain('"check": "full"');
    expect(markers).not.toMatch(/"coverage"|"pass": 1|Counting claims/);
    // D-276: the guide carries no markers, so an accepted-offline location names a plan claim only.
    expect(markers).toMatch(/only in the V4 `sources` report, its `location` naming that plan claim \(`stages\[<i>\]\.claims\[<k>\]`\)/);
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

  it("Q1 as D-276 moves it: W1 always ends What PoB can't show with the one Known issues H3 and its accepted gate findings, and the runner adds the open findings", () => {
    const w1 = folded(readStage('W1'));
    expect(w1).toMatch(/\*\*What PoB can't show\*\*: .* Its last part is always the H3 `Known issues`/);
    expect(w1).toMatch(/You write each accepted gate finding: its sentence in the guide, and its row in `audit\.md`, with its code as the id, its gate \(`D1-gate` or `D2-gate`\) and its plan stage/);
    expect(w1).toMatch(/With none, each list holds the one line `None\.`/);
    const template = fs.readFileSync(GUIDE_TEMPLATE, 'utf8');
    expect(template).toMatch(/### Known issues\n\n\[always this H3, the last part of this section \(D-276\)/);
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
    // D-279: rule 3 becomes "once in the guide, and never later stated as settled".
    expect(markers).toMatch(/3\. \*\*It carries its source's caveats\.\*\* A source of confidence M or L, a fact whose `note` records a dispute, a `judgment`, or a mechanic no lookup confirmed is stated with that caveat\. In the guide the caveat appears once, where the reader acts on it, and is never later stated as settled \(D-279\)/);
    expect(markers).not.toMatch(/wherever the claim appears/);
    expect(folded(readStage('V4'))).toMatch(/\*\*The claim rules\*\* \(`source-markers\.md`, S7\)\. Check every claim in your lens against all three/);
  });
});

// ---------------------------------------------------------------------------------------------------
// WU-47 fixes still in force (trimmed to amendment 1 S7): the runner's Bash (F3), the import code's one home
// (D-260), the invalid-roll names (D-258), the pick reason, and the general prompt rules from the triage
// ---------------------------------------------------------------------------------------------------

describe('WU-47 fixes: what the runner does', () => {
  const skill = () => folded(fs.readFileSync(SKILL_MD, 'utf8'));

  it("D-265 (e): the runner's Bash rule is exhaustive: ls, cat, head, tail, wc, grep and jq without writes or substitution, and the run checker; nothing else", () => {
    const text = skill();
    expect(text).toMatch(/\*\*Your Bash reads, and runs the run checker; nothing else\*\* \(D-265\)\. The whole list: - `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq`, alone or piped into one another \(`cd` before them is fine\), each with no redirection \(`>`, `>>`, `<`\), no `tee`, no flag that writes a file \(`-o`, `-i` or `-delete` where the tool writes with it\), and no command substitution \(`\$\(…\)`, backticks\) feeding another tool; - the run checker, `node \.claude\/skills\/build-guide\/scripts\/check-run\.mjs <runFolder>`\./);
    expect(text).toMatch(/Nothing else: no other `node` call \(`node -e` included\), no `git`, `find`, `sort`, `sed`, `awk`, network client \(`curl`, `wget`, `nc`, `ssh`\) or host, and nothing that writes, moves or deletes a file/);
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
  it("v4-prose-8, as D-278 moves it to audit.md's Run notes: W1 and the audit template say only what the run log's picking checkpoint records, quoting a pre-supplied rule; V4 checks it", () => {
    const w1 = folded(readStage('W1'));
    expect(w1).not.toMatch(/the mechanics, why it won\)/);
    expect(w1).toMatch(/`checkpoints\[\]`: checkpoint 1's entry that picked this concept, which is the only record of why it was picked/);
    expect(w1).toMatch(/\*\*Why this concept\*\*, in `Run notes`, says only what `run-log\.json`'s checkpoint 1 entry whose `answer` picked the concept .* with `pre-supplied` or `default`, that the test config picked it, quoting the entry's `rule` exactly \(`first-viable`\)\. Give no reason the entry doesn't record, and never invent one\./);
    const template = fs.readFileSync(AUDIT_TEMPLATE, 'utf8');
    const why = template.split(/\r?\n/).find((l) => l.startsWith('- **Why this concept:**'))!;
    expect(why).toContain("run-log.json's checkpoint 1 entry that picked it records");
    expect(why).toContain("the test config picked it at checkpoint 1 by the rule `<the entry's rule, exactly>`");
    expect(why).not.toMatch(/why it won|why each lost/);
    expect(fs.readFileSync(GUIDE_TEMPLATE, 'utf8')).not.toContain('Why this concept');
    // The run log records the rule (S4 keeps it), and V4's prose lens checks the sentence against it.
    const log = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8'));
    expect(log).toContain('| `checkpoints[]` | `{checkpoint, visit, answer, answeredBy, rule?}` |');
    expect(log).toMatch(/`rule` records how the answer was reached: the test config's answer exactly as written \(`first-viable`, `pick:c2`\) for `pre-supplied`, or the default that applied .* for `default`\. A user's answer has no `rule`/);
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'checkpoints.md'), 'utf8'))).toMatch(/the entry's `rule` keeps how the answer was reached/);
    const v4 = folded(readStage('V4'));
    expect(v4).toMatch(/\*\*why this concept\*\*, in `audit\.md`'s `Run notes`: check it against `run-log\.json`'s last checkpoint 1 entry whose `answer` is `pick:<the guide's concept>`.* quotes the entry's `rule` exactly\. A reason the entry doesn't record, a different rule, or a pick attributed to the wrong answerer is a finding \(artifact `audit\.md`, owner `W1`\)/);
  });

  it('D-260: W1 returns no import code', () => {
    const w1 = readStage('W1');
    const returns = w1.slice(w1.indexOf('## Returns'), w1.indexOf('## Fault directives'));
    expect(folded(returns)).toMatch(/No import code: you copied it into the guide, and `compile-record\.json` keeps it \(D-260\)/);
    expect(returns).not.toMatch(/"importCode"/);
  });

  it('W1 states each caveat once, never later as settled (D-279), and calls a mechanic reliable only with a source in the build', () => {
    const w1 = folded(readStage('W1'));
    expect(w1).toMatch(/State a mechanic as reliable only when the build has a source for it/);
    expect(w1).toMatch(/\*\*Each caveat once\*\* \(D-279\)\. A caveat .* appears once, where the reader acts on it, usually in `What PoB can't show` by the figure it qualifies\. A later mention doesn't hedge it again, and never states it as settled/);
    expect(w1).not.toMatch(/Keep every hedge|keeps its hedge everywhere/);
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
    expect(skill()).toMatch(/\| 13 \| V4 re-check \| `build-guide-verifier`, in parallel: each lens that raised a finding and the sources lens, or all three when a gate re-ran in the fix round \|/);
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
      expect({ stage, none: /\*\*Otherwise compile nothing\.\*\* A claims-only edit changes only `stages\[\]\.claims` and `source` and `tag` fields; anything else, a ledger entry's `claim` text, a respec's note or a `chaosResistException`'s reason included, takes step 2's path\. After your edits, validate once \(`mcp__pob2__guide_run \{validate: "<runFolderRel>\/plan\.json"\}`\) so the plan still validates, and leave `compile-record\.json` and the PoB file as the final compile left them: no gate runs after you, and the run checker requires the sha1 of the plan without its claims, sources and tags to equal the final record's `buildSha1` \(D-266\)/.test(text) }).toEqual({ stage, none: true });
      expect({ stage, returns: /`recompiled: yes` or `recompiled: no`, the finding ids you fixed and the locations you changed/.test(text) }).toEqual({ stage, returns: true });
    }
    expect(folded(fs.readFileSync(path.join(AGENTS_DIR, 'build-guide-coordinator.md'), 'utf8'))).toMatch(/Recompile only when a fix changes the build .* Otherwise compile nothing, validate once, and leave the final record as it is\. Return `recompiled: yes` or `no`/);
  });

  it('the run log names the claims-only owner `claims-edited`, which the checker tells from a redesign, and the header carries W1 its changed locations', () => {
    expect(ref('run-log.md')).toMatch(/`claims-edited` for a D1 or D2 of the fix round or a revision that returned `recompiled: no`: it edited claims in place and compiled nothing, so no gate of its own follows it \(D-264\)/);
    expect(ref('run-log.md')).toMatch(/its build projection's sha1 equals the record's `buildSha1`, D-266/);
    expect(ref('task-header.md')).toMatch(/\| `changed` \| a V4 re-check, and W1 in the fix round/);
    expect(ref('run-folder.md')).toMatch(/of all three lenses if and only if a gate re-ran in the fix round \(D-264\), else of each lens that raised a finding and the sources lens/);
  });
});

describe('Review of bg/d264: the references say what the checker now holds', () => {
  const skill = () => folded(fs.readFileSync(SKILL_MD, 'utf8'));
  const ref = (name: string) => folded(fs.readFileSync(path.join(SKILL_DIR, 'references', name), 'utf8'));

  it('item 4: after a claims-only round the sources lens always re-checks the changed locations (SKILL.md step 13, V4.md)', () => {
    expect(skill()).toMatch(/Otherwise \(claims only\) each lens that raised a finding runs once, in parallel, with its own open findings in `findings` and the owners' changed locations in `changed`, and checks only those; the \*\*sources lens always runs\*\*, even when it raised nothing, since an edited claim may cite something new/);
    expect(folded(readStage('V4'))).toMatch(/After a claims-only round the `sources` lens always runs, even with no finding of its own, and checks every citation at a changed location, since an edited claim may cite something new \(D-264\); the other lenses run only when they raised a finding/);
  });

  it("item 6: each owner is logged by what it did, and a claims-only D1 may precede a D2 that recompiles and its gate", () => {
    expect(skill()).toMatch(/Log each owner as `run-log\.md` says: `done` when it recompiled, or when it is the D2 whose gate follows a recompiled D1; `claims-edited` when it edited claims only \(a claims-only D1 before a D2 that recompiled\)/);
    expect(skill()).not.toMatch(/Log the owners `done`/);
    expect(ref('run-folder.md')).toMatch(/a claims-only owner only before any gate of its round and never directly before a gate \(a claims-only D1 may be followed by a D2 that recompiles, and its D2 gate\)/);
    expect(ref('run-folder.md')).not.toMatch(/with no gate after it/);
  });
});

describe('D-265: the small items', () => {
  const ref = (name: string) => folded(fs.readFileSync(path.join(SKILL_DIR, 'references', name), 'utf8'));

  it('(b) checkpoints.md: a pre-supplied answer still prints the display, checkpoint 1\'s comparison lines and an infeasible concept\'s evidence on a revisit', () => {
    const text = ref('checkpoints.md');
    expect(text).toMatch(/\*\*A pre-supplied answer still prints the display\*\* \(D-265\)\. The test config replaces only the question: show everything the checkpoint shows the user, then the answer it resolved to/);
    expect(text).toMatch(/At checkpoint 1 that is R1b-assemble's comparison lines, each concept's status and the dossier's path, on every visit; on a revisit after an `infeasible` design or an escalation, that concept's evidence \(its last verdict file\)/);
  });

  it('(c) D2 picks every campaign reward choice into config.scenario with a one-line reason, on every rung too; W1 and the template name the picks under Campaign route and rewards (D-283)', () => {
    const d2 = folded(readStage('D2'));
    expect(d2).toMatch(/\*\*Reward choices\*\* \(D-265\): pick every campaign reward choice C1 lists, each a quest with a `q\.<key>\.options` fact in `data\/campaign\/progress\.json`/);
    expect(d2).toMatch(/List the pick in `config\.scenario` of \*\*every\*\* stage at or after the quest, the same pick on each, the endgame stages `m`, `b` and `n` included/);
    expect(folded(readStage('D1'))).toMatch(/\*\*Campaign reward picks\*\* \(D-265\): the endgame stages carry the campaign's reward picks\. For every reward choice a campaign stage picks .* `m`, `b` and `n` list the same entry, the same pick/);
    expect(d2).toMatch(/Each reward pick of step 6 has one claim, on the first stage that lists it: the quest, the option taken and a one-line reason, citing `data:campaign\/progress\.json#q\.<key>\.options\[<i>\]`/);
    expect(folded(readStage('W1'))).toMatch(/\*\*Campaign route and rewards\*\* \(D-265, D-283\): the reward quests in route order\. For each reward choice the plan picks .* name the quest, then the picked option by its first line exactly as the fact lists it \(the run checker looks for it there\), then the reason the plan's claim gives\. Never list a choice's options without its pick/);
    const template = fs.readFileSync(GUIDE_TEMPLATE, 'utf8');
    expect(template).toContain('- <Act and quest, a reward choice>: take <the first line of the option the plan picks, exactly as data/campaign/progress.json lists it>; <the reason its claim gives>.');
    expect(template).not.toMatch(/\[\^c2\]/);
    // The plan field is the existing scenario list, as the plan reference says.
    expect(fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'plan-reference.md'), 'utf8')).toMatch(/A reward choice \(a quest whose C1 data has `q\.<key>\.options`\) defaults to Nothing; once the stage's `progress` is at or after its quest, list the pick here/);
  });

  it("(d), as D-276 changes it: every unresolved V4 finding carries a reader sentence; the runner writes each open one as `- <reader>` in the guide and its row in audit.md at step 14, from W1's two lines", () => {
    const v4 = folded(readStage('V4'));
    expect(v4).toMatch(/\*\*`reader`\*\* \(D-265\) is one plain sentence the guide's reader can act on, what is wrong in the guide and what is true instead, with no pipeline words/);
    expect(v4).toMatch(/Every `unresolved` finding has its `reader` sentence: only those can become known issues\. A `fixed` or `accepted-offline` finding needs none/);
    expect(readStage('V4')).toMatch(/"reader": "[^"]+",\n\s+"owner": "D1", "status": "unresolved"/);
    const markers = ref('source-markers.md');
    expect(markers).toMatch(/Each finding has `id`, `artifact` \(`plan\.json`, `guide\.md`, or `audit\.md` for the prose lens's check of "why this concept"\), `location`, `claim`, `issue`, `evidence`, `reader` \(only when `unresolved`\), `owner`/);
    expect(markers).toMatch(/the run checker fails an `unresolved` finding without it\. A `fixed` or `accepted-offline` finding needs none/);
    expect(markers).toMatch(/The runner replaces both Known issues lists every cycle \(SKILL\.md step 14, D-265, D-276\): in the guide, W1's accepted-gate-finding sentences, then every open finding as `- <reader>`, its `reader` sentence as the report gives it, with no id; in `audit\.md`'s table, W1's accepted rows, then every open finding's row `\| <id> \| <lens> \| — \| <reader> \|`\. The run checker finds each open finding's sentence in the guide, by sentence, and its id in `audit\.md`, and fails any other line or row/);
    const skill = folded(fs.readFileSync(SKILL_MD, 'utf8'));
    expect(skill).toMatch(/\*\*Replace both lists whole\*\* with Edit, every cycle \(D-265, D-276\), reading only the lines you edit, from the line numbers W1 returned last/);
    expect(skill).toMatch(/in `guide\.md`, under `### Known issues`: first W1's lines for the accepted gate findings, as W1 wrote them; then one line per open finding, `- <reader>`, the finding's `reader` sentence exactly as its report gives it, with no id; or, with neither, the one line `None\.`/);
    expect(skill).toMatch(/in `audit\.md`, under `## Known issues`: the table head, W1's rows for the accepted gate findings, then one row per open finding, `\| <id> \| <lens> \| — \| <reader> \|`; or, with neither, the one line `None\.`/);
    expect(skill).toMatch(/Drop every other line and row: one from an earlier cycle is stale/);
    expect(folded(readStage('W1'))).toMatch(/Leave the lines under the guide's `### Known issues` and the rows of `audit\.md`'s `Known issues` to the runner's step 14, which replaces them whole, except to add a gate finding newly in `accepted`/);
    expect(fs.readFileSync(SKILL_MD, 'utf8')).toContain("| 14 | Known issues | you | each open finding's `reader` sentence, into `guide.md`'s `Known issues`, and its row into `audit.md`'s | — |");
    expect(skill).not.toMatch(/known-issues`|W1 runs once more/);
    const w1 = folded(readStage('W1'));
    expect(w1).toMatch(/`known-issues-line: <n>`, the line number of the guide's `### Known issues` heading, and `audit-known-issues-line: <n>`, that of `audit\.md`'s `## Known issues`, both as you leave the files, on your first write and on every patch/);
    const template = fs.readFileSync(GUIDE_TEMPLATE, 'utf8');
    expect(template).toMatch(/\[added by the runner at step 14\] - <the finding's reader sentence, word for word: "[^"]+">\n/);
    expect(template).not.toMatch(/\(<V4 finding id>\)|\(V4 <lens>, <artifact> <location>\)/);
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

// ---------------------------------------------------------------------------------------------------
// WU-56 (amendment 3's N-5): the card template (C-52), the pattern library (C-53) and R1b's advisory
// checklist with its probe budget (D-292). Slice 03 §7.5–§7.7; AC-W27…AC-W29.
// ---------------------------------------------------------------------------------------------------

/** §7.6 (C-53): how PoB follows a link, in the six labels. */
const POB_LABELS = ['modelled', 'Count', 'custom modifier', 'config stand-in', 'hand calculation', 'not modelled'];

/** The H3 sections between a heading at `start` and the next heading of level `level` or above. */
function sections(text: string, start: number, level: number): { title: string; body: string }[] {
  const hs = headings(text);
  const lines = text.split(/\r?\n/);
  const end = hs.find((h) => h.line > start && h.level <= level)?.line ?? lines.length;
  const h3 = hs.filter((h) => h.level === level + 1 && h.line > start && h.line < end);
  return h3.map((h, i) => ({ title: h.title, body: lines.slice(h.line + 1, (h3[i + 1]?.line ?? end)).join('\n') }));
}

describe('AC-W27: the card template holds both halves of §7.5 and the six status words (C-52, D-291)', () => {
  const file = path.join(SKILL_DIR, 'templates', 'card-template.md');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const hs = headings(text);
  /** §7.5: each half's parts, in order, and what each must ask for. */
  const HALVES: [string, [string, string[]][]][] = [
    [
      'Brainstorm half',
      [
        ['Identity', ['Class:', 'Ascendancy:', 'Named damage source:']],
        ['Pitch', ['Title: <at most 60 characters', 'Playstyle: <tags', '<Line 1', '<Line 2']],
        ['Chain', ['Damage source:', 'reading <what it reads>', 'carried by <the slot>', 'Multipliers:', 'Enablers:', 'Consumes or requires:', 'supplied by']],
        ['Enabler', ['<The item, node or gem>', 'arrives at level', 'by <how to get it', 'Dormant until then:']],
        ['Links', ['| Link | Game text | Lookup | How PoB follows it | Hidden clauses (theory) | Status |', ...POB_LABELS, 'PG ids', '"from a Hit"', '"you use yourself"']],
        ['Evidence', ['Popularity:', "the skill's share", "the ascendancy's share", 'poe.ninja', 'Combination:', 'at what level', 'Reference build:', 'no player evidence']],
        ['Risks so far', ['Payoff thieves:', 'Placement limits:', 'Exposed phase:', 'Resistant bosses:']],
      ],
    ],
    [
      'Verification half',
      [
        ['Verified', ['`Life`', '`EnergyShield`', '`Missing<Elem>Resist`', '`<Type>MaximumHitTaken`', '`TotalEHP`', 'Modelled DPS:']],
        ['Estimates', ['Count:', 'Custom modifier:', 'because <the reason>', 'Computed with a custom modifier present:', 'Clear:', 'Boss:', 'never summed']],
        ['Checklist results', ['verified \\| estimate \\| risk \\| not checked']],
        ['Fallback ladder', ['1. ', '2. ']],
        ['Key item prices', ['dated YYYY-MM-DD', 'unavailable (<note>)']],
      ],
    ],
  ];

  it("has the two halves as its H2s, in order, each with §7.5's parts as H3s in order", () => {
    expect(fs.existsSync(file)).toBe(true);
    expect(hs.filter((h) => h.level === 1).length).toBe(1);
    expect(hs.filter((h) => h.level === 2).map((h) => h.title)).toEqual(HALVES.map(([half]) => half));
    for (const [half, parts] of HALVES) {
      const at = hs.find((h) => h.level === 2 && h.title === half)!;
      expect({ half, parts: sections(text, at.line, 2).map((s) => s.title) }).toEqual({ half, parts: parts.map(([p]) => p) });
    }
  });

  it('asks each part for its fields', () => {
    for (const [half, parts] of HALVES) {
      const at = hs.find((h) => h.level === 2 && h.title === half)!;
      const bodies = new Map(sections(text, at.line, 2).map((s) => [s.title, s.body]));
      for (const [part, fields] of parts) {
        for (const field of fields) {
          expect({ half, part, field, present: (bodies.get(part) ?? '').includes(field) }).toEqual({ half, part, field, present: true });
        }
      }
    }
  });

  it("lists the eight checks of §7.7 under Checklist results, and marks a card whose damage source isn't a skill (D-303, D-334)", () => {
    const at = hs.find((h) => h.title === 'Checklist results')!;
    const rows = text
      .split(/\r?\n/)
      .slice(at.line)
      .filter((l) => /^\| [1-8] \|/.test(l))
      .map((l) => l.split('|').map((c) => c.trim()));
    expect(rows.map((r) => [Number(r[1]), r[2]])).toEqual(
      [
        'Pillars for ailments and damage over time',
        "Enabler's conditions at the target level",
        'Attribute requirements at the target level',
        "Risks PoB can't show",
        'Dead-slot audit',
        'Condition on and off',
        'Encounter mods',
        'Skill-shape probe',
      ].map((name, i) => [i + 1, name]),
    );
    expect(text).toMatch(/Can't be finalized yet: its damage source isn't a skill/);
    expect(text).toMatch(/Not compiled: its damage source isn't a skill/i);
  });

  it('carries the six status words (D-291)', () => {
    for (const word of ['confirmed in game text', 'modelled in PoB', 'estimate (', 'players use it (poe.ninja)', 'not checked yet', 'needs in-game testing']) {
      expect({ word, present: text.includes(word) }).toEqual({ word, present: true });
    }
  });
});

describe('AC-W28: the pattern library (C-53, D-290, D-325)', () => {
  const file = path.join(SKILL_DIR, 'references', 'patterns.md');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const hs = headings(text);
  /** The work-log's ten families ("Off-meta builds 7–30"), in its order. */
  const FAMILIES = [
    'Loops and relays',
    'State consumers (builder and finisher)',
    'Resource conversions',
    'Stat bridges',
    'Copies and rate',
    'Levels, quality and tags',
    'Conditions',
    'Item and slot tricks',
    'Actors',
    'Tree',
  ];
  /** Each entry's fields, in order: name and shape, search step, how PoB follows it, examples, cautions. */
  const FIELDS = ['Shape', 'Search', 'PoB', 'Examples', 'Cautions'];
  const entries = () =>
    hs
      .filter((h) => h.level === 2 && /^\d+\. /.test(h.title))
      .flatMap((family) => sections(text, family.line, 2).map((s) => ({ family: family.title, ...s })));
  /** The `[key]: <path>` definitions under Sources. */
  const sources = () => new Map([...text.matchAll(/^\[([a-z0-9-]+)\]: (\S+)/gm)].map((m) => [m[1], m[2]]));

  it('opens with the brainstorm questions, the work-log\'s ten', () => {
    expect(fs.existsSync(file)).toBe(true);
    const h2 = hs.filter((h) => h.level === 2);
    expect(h2[0].title).toBe('Brainstorm questions');
    const lines = text.split(/\r?\n/);
    const before = lines.slice(0, h2[0].line).join('\n');
    expect(before.split(/\s+/).filter(Boolean).length).toBeLessThan(60);
    const questions = lines.slice(h2[0].line, h2[1].line).filter((l) => /^\d+\. /.test(l));
    expect(questions.length).toBe(10);
    const section = folded(lines.slice(h2[0].line, h2[1].line).join('\n'));
    for (const q of [
      'What is the damage source, what does it read, and which slot carries it?',
      'Fix the payoff first, then judge each piece by whether it feeds it.',
      'What does the payoff consume or require, and can the skill create it?',
      'The enabler: name it, the level it arrives at, and how to get it',
      'Which routine action already produces the resource it needs?',
      "Read the skill's own text for payout conditions, ramps and hidden scaling.",
      'Tag audit: which +level sources and supports can reach it?',
      "Search other skills' text for the main skill's tags, and pair-test the planned skills.",
      'Give it the standard kit before calling it weak.',
      'How does the required state fail? Plan one fix per failure.',
    ]) {
      expect({ q, present: section.includes(q) }).toEqual({ q, present: true });
    }
  });

  it('states its rules: shapes only, each use re-checked against game data; one to three examples; the maintenance rule (§7.6)', () => {
    const flat = folded(text);
    expect(flat).toMatch(/\*\*Shapes only\.\*\* Re-check every use against current game data with a lookup/);
    expect(flat).toMatch(/\*\*Examples:\*\* one to three builds, each citing its study/);
    expect(flat).toMatch(/\*\*Maintenance\.\*\* After each study the user supplies, the coordinator proposes entries and the user approves them/);
  });

  it('holds the ten families, in order, and defines the six labels', () => {
    expect(hs.filter((h) => h.level === 2 && /^\d+\. /.test(h.title)).map((h) => h.title)).toEqual(FAMILIES.map((f, i) => `${i + 1}. ${f}`));
    for (const label of POB_LABELS) expect({ label, defined: text.includes(`**${label}**`) }).toEqual({ label, defined: true });
  });

  it('gives every entry its name and shape, search step, how PoB follows it (one of the six labels), examples and cautions', () => {
    const all = entries();
    expect(all.length).toBeGreaterThan(30);
    for (const { family, title, body } of all) {
      const at = FIELDS.map((f) => body.search(new RegExp(`^- \\*\\*${f}:\\*\\* \\S`, 'm')));
      expect({ family, title, fields: at.every((i) => i >= 0), inOrder: [...at].sort((x, y) => x - y).join() === at.join() }).toEqual({ family, title, fields: true, inOrder: true });
      const pob = folded(/^- \*\*PoB:\*\* ([\s\S]*?)(?=^- \*\*Examples:)/m.exec(body)![1]);
      // The field leads with its label, so a passing "modelled" elsewhere in the sentence doesn't count.
      const labelled = new RegExp(`^(?:${POB_LABELS.join('|')})\\b`).test(pob);
      expect({ title, pob, labelled }).toEqual({ title, pob, labelled: true });
    }
  });

  it('rests every entry on a study or the work-log: each example cites a defined source, and every source exists', () => {
    const defined = sources();
    expect(defined.size).toBeGreaterThan(10);
    for (const [key, rel] of defined) {
      expect({ key, exists: fs.existsSync(path.resolve(path.dirname(file), rel)) }).toEqual({ key, exists: true });
    }
    for (const { title, body } of entries()) {
      const examples = /^- \*\*Examples:\*\* ([\s\S]*?)(?=^- \*\*Cautions:)/m.exec(body)![1];
      const cited = [...examples.matchAll(/\[([a-z0-9-]+)\](?!:)/g)].map((m) => m[1]);
      const builds = new Set(cited).size;
      expect({ title, oneToThree: builds >= 1 && builds <= 3, undefinedKeys: cited.filter((k) => !defined.has(k)) }).toEqual({ title, oneToThree: true, undefinedKeys: [] });
    }
  });

  it('cites only PoB gaps that pob-gaps.md lists', () => {
    const gaps = fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'pob-gaps.md'), 'utf8');
    const cited = new Set([...text.matchAll(/\bPG-(\d+)\b/g)].map((m) => m[1]));
    expect(cited.size).toBeGreaterThan(10);
    for (const id of cited) expect({ id: `PG-${id}`, listed: gaps.includes(`**PG-${id},`) }).toEqual({ id: `PG-${id}`, listed: true });
  });

  it('is at most 6,000 words, so a researcher reads it whole (D-325)', () => {
    const words = text.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThan(1000);
    expect(words).toBeLessThanOrEqual(6000);
  });
});

describe('AC-W29: R1b lists the advisory checklist of §7.7 and its probe budget (D-292, D-331)', () => {
  const text = fs.readFileSync(path.join(STAGES_DIR, 'R1b.md'), 'utf8');
  const hs = headings(text);
  const at = hs.find((h) => h.level === 2 && h.title.startsWith('Verification checklist'));
  const lines = text.split(/\r?\n/);
  const section = at ? lines.slice(at.line, hs.find((h) => h.line > at.line && h.level <= 2)!.line).join('\n') : '';

  it('has the checklist between Work and Writes', () => {
    expect(at).toBeDefined();
    const h2 = hs.filter((h) => h.level === 2).map((h) => h.title);
    expect(h2.indexOf('Work')).toBeLessThan(h2.indexOf(at!.title));
    expect(h2.indexOf(at!.title)).toBeLessThan(h2.indexOf('Writes'));
  });

  it('lists the eight checks of §7.7, numbered in order: four read-only, then four from compile variants', () => {
    const checks = [
      'Pillars',
      "The enabler's conditions",
      'Attribute requirements',
      "Risks PoB can't show",
      'A dead-slot audit',
      'Condition on and off',
      'Encounter mods',
      'A skill-shape probe',
    ];
    const found = checks.map((c, i) => section.search(new RegExp(`^${i + 1}\\. \\*\\*${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm')));
    for (const [i, pos] of found.entries()) expect({ check: checks[i], pos: pos >= 0 }).toEqual({ check: checks[i], pos: true });
    expect([...found].sort((x, y) => x - y)).toEqual(found);
    const variants = section.indexOf('**From compile variants');
    expect(found[3]).toBeLessThan(variants);
    expect(found[4]).toBeGreaterThan(variants);
    // Each check's own item must say what §7.7 asks of it.
    const item = (n: number) => folded(section.slice(found[n - 1], n < 8 ? found[n] : undefined).split(/\n\s*\n/)[0]);
    const parts: [number, (string | RegExp)[]][] = [
      [1, ['base damage, type-specific scaling, duration, and 100% application']],
      [2, ['at the target level, in numbers', 'what they force out of the build', 'reservation of at least 1 minus the threshold']],
      [3, ['at the target level, for the defining items and every gem']],
      [4, ["hit-making children", 'placement and targeting limits', 'the exposed phase', 'cooldown dead windows on interruptible casts', 'hidden clauses', 'stated as theory']],
      [5, ['remove one support or source', 'A change below 1%', 'activation or the payload']],
      [6, [/toggle the earned config entry/, 'realistic uptime']],
      [7, ['in the scenario config', /top of the waystone's monster elemental resistance range \(`enemies\/waystones\.json#mods\.monster-elemental-resistance`, its `max`/, /whether the bosses resist that element \(`enemies\/arbiter-of-divinity\.json#res\.<element>`\)/]],
      [8, ["where the skill's text suggests one", 'projectile speed up and down']],
    ];
    for (const [n, wants] of parts) {
      const text8 = item(n);
      for (const want of wants) {
        const present = typeof want === 'string' ? text8.includes(want) : want.test(text8);
        expect({ check: n, want: String(want), present }).toEqual({ check: n, want: String(want), present: true });
      }
    }
  });

  it('reports each check as verified, estimate, risk or not checked, and none is a gate or starts a fix round', () => {
    const flat = folded(section);
    expect(flat).toContain('verified, estimate, risk, not checked');
    expect(flat).toMatch(/None is a gate: a result never changes the verdict, and none starts a fix round/);
  });

  it('budgets up to 4 one-stage measure-only probe variants per card, run in the order above, each its own plan (D-331)', () => {
    const flat = folded(section);
    expect(flat).toMatch(/Up to 4 probe variants per card, beyond the attempt's two compiles, run in the order above/);
    expect(flat).toMatch(/one-stage, measure-only compile/);
    expect(flat).toContain('`mcp__pob2__compile_plan {plan_path: "<runFolderRel>/probes/<card-id>/<n>/plan.json", measure_only: true}`');
    expect(flat).toMatch(/A probe that doesn't fit the budget, or whose compile fails, is reported `not checked`/);
    // A card whose damage source isn't a skill gets only the read-only checks (D-334).
    expect(flat).toMatch(/run checks 1–4 from the card and the lookups, report 5–8 `not checked`, and write "not compiled: its damage source isn't a skill"/);
// WU-62 (amendment 2, D-276…D-283): the reader layer, the audit layer, the editor lens and the entering-maps
// rung in D1, D2 and the gates
// ---------------------------------------------------------------------------------------------------

describe('WU-62: W1 writes the reader layer and the audit layer (D-276, D-278, D-280)', () => {
  const w1 = () => folded(readStage('W1'));

  it("W1 writes guide.md and audit.md, from both templates, and returns both Known issues lines; the header, SKILL.md and the layout say so", () => {
    expect(w1()).toContain('`writes: ["guide.md", "audit.md"]`');
    expect(w1()).toContain('`.claude/skills/build-guide/templates/audit-template.md`');
    expect(fs.existsSync(AUDIT_TEMPLATE)).toBe(true);
    expect(fs.readFileSync(SKILL_MD, 'utf8')).toContain("| 10 | W1, the guide and the audit layer | `build-guide-writer` | `guide.md`, `audit.md` | at most 8 lines, with its `known-issues-line` and `audit-known-issues-line` |");
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'task-header.md'), 'utf8'))).toContain("W1's are `guide.md` and `audit.md` (D-278)");
    expect(fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-folder.md'), 'utf8')).toContain('| `audit.md` | W1, which writes it and patches it with Edit; the runner fills its `Known issues` table each cycle (step 14) | the audit layer (slice 03 §7.8, D-278) |');
    const writer = folded(readDefinition(fs.readFileSync(path.join(AGENTS_DIR, 'build-guide-writer.md'), 'utf8'))!.body);
    expect(writer).toMatch(/\*\*Write only the header's `writes`\*\*, inside the run folder \(`runFolder`\): `guide\.md` and `audit\.md` \(D-278\)/);
    expect(writer).toMatch(/The guide renders the plan with no footnote markers \(D-276\)/);
    expect(writer).not.toMatch(/carries its footnote marker/);
  });

  it('W1 keeps the guide a game guide: it renders the plan, advice is first person, no pipeline text, the cap (D-276, D-283)', () => {
    const text = w1();
    expect(text).toMatch(/The guide renders the plan: you add no fact or number of your own \(D-276\)/);
    expect(text).toMatch(/\*\*The cap\.\*\* At most 3,000 words, the H1, the import code and the Known issues list not counted \(D-283\)/);
    expect(text).toMatch(/\*\*No pipeline text\*\* \(D-276\)\. No footnote markers \(`\[\^…\]`\), no confidence labels \("confidence L"\), no finding ids, no pipeline words \(lens, finding, owner, claim, location\) and no stage ids outside the loadout names/);
    expect(text).toMatch(/Advice is in the first person \("I drop Herald of Ash first", "my support order"\): that is its label, and it isn't verified, but a number inside it is still the plan's or the record's, and it never asserts a fact the plan lacks/);
    expect(text).toMatch(/\*\*Held back:\*\* crafting recipes, an atlas section, affix tier labels, trade links and a vendor search regex/);
  });

  it('W1 states the not-a-tutorial rule with the swap test (D-280)', () => {
    expect(w1()).toMatch(/\*\*Not a tutorial\*\* \(D-280\)\. A sentence that explains how the game or PoB works stays only when it names something this build uses, needs or avoids .* and it changes what the reader does with this build\. The swap test: if the sentence would read as true and useful, word for word, in a guide for another skill on another class, cut it/);
  });

  it("W1 writes one fixed-form verdict line per rung, each number the record's rounded at its last significant digit (D-283)", () => {
    const text = w1();
    expect(text).toMatch(/`Survival by stage` has one line per endgame rung in the template's fixed form, word for word but the placeholders, and the run checker compares each number with the record/);
    expect(text).toMatch(/"at least <n> elemental or chaos against about <hit>": the least of the four other `<Type>MaximumHitTaken`, against the largest of the four other `hit_<stage>_<type>` ledger values/);
    expect(text).toMatch(/"<Skill> about <n> DPS": the rolled-skill figure the D1 gate's verdict names for the stage/);
    expect(text).toMatch(/Round each number as a guide does, at its last significant digit: 2,736 is "2,740" or "2,700", 401\.996 is "about 400"/);
  });

  it('W1 uses the optional items only where the build has them (D-277), and m gets no Arbiter or mapping signals (D-281)', () => {
    const text = w1();
    expect(text).toMatch(/\*\*Optional items\*\* \(D-277\), only where the build has them, never invented to fill a slot: a fallback D1 or D2 already weighed; a threshold trigger, when the plan has one \(else a first-person judgment trigger, "when you can afford it"\); up to 4 traps/);
    expect(text).toMatch(/for `b` and `n` only, \*\*the Arbiter of Divinity\*\* .* `m` gets neither/);
    expect(text).toMatch(/entering maps' total against 5 divines, the budget variant's against 20/);
  });

  it("W1 writes audit.md's six parts, the reference hits' ledger values among them (D-278)", () => {
    expect(w1()).toMatch(/Write `audit\.md` from its template \(§7\.8, D-278\), with its six H2s in order: `Hand calculations` .* `Stage detail` .* each reference hit's ledger value, .* `What PoB doesn't model` .* `Inputs by confidence` .* `Run notes` and `Known issues`/);
  });
});

describe('WU-62: V4 reads the guide like an editor (D-279)', () => {
  const v4 = () => folded(readStage('V4'));

  it('the prose lens flags a fact or number not in the plan, the record or audit.md, advice asserting a fact, tutorial text, and a caveat repeated or later settled', () => {
    const text = v4();
    expect(text).toMatch(/## Lens `prose`: the guide read like an editor/);
    expect(text).toMatch(/Read `guide\.md` section by section, against the plan, the record and `audit\.md`/);
    expect(text).toMatch(/1\. \*\*A fact or number not in them\.\*\* A statement of fact, or a number, that the plan .* the record or `audit\.md` doesn't hold, that contradicts them, or that states them more strongly/);
    expect(text).toMatch(/2\. \*\*Advice that asserts a fact\.\*\* First-person advice \("I", "my"\) is advice and isn't verified; but advice that asserts a fact the plan lacks .* is a finding/);
    expect(text).toMatch(/3\. \*\*Tutorial text\*\* \(D-280\)/);
    expect(text).toMatch(/4\. \*\*A caveat repeated, or later stated as settled\*\* \(D-279\)/);
  });

  it('it keeps the gated statements, checks why this concept in audit.md, and never flags a missing optional item (D-277)', () => {
    const text = v4();
    for (const gated of ['**the rolled skill is the main damage source** (D-122)', '**the budget lines** (D-164, D-219, D-281)', '**the survival floor** (D-234)', '**offline** (D-201)', "**why this concept**, in `audit.md`'s `Run notes`"]) {
      expect({ gated, kept: text.includes(gated) }).toEqual({ gated, kept: true });
    }
    expect(text).toMatch(/\*\*Never flag a missing optional item\*\* \(D-277\): a fallback, a threshold trigger \(a first-person judgment trigger is fine, and a trigger's form isn't checked\), a trap, an either\/or pick, a hold or save row, a rotation clause/);
  });

  it('the sources lens checks the plan alone, and the ledger lens re-derives the entering-maps hits at area 69 (D-281, D-327)', () => {
    const text = v4();
    expect(text).toMatch(/Over every claim of `plan\.json` \(its `stages\[\]\.claims`, its ledger inputs' tags and its prices\)/);
    expect(text).toMatch(/the entering-maps rung's is `enemies\/waystones\.json#area-level\.offset` plus 5 \(T5, area 69, D-281, D-327\)/);
  });
});

describe('WU-62: the entering-maps rung m in D1, D2 and the gates (D-281, D-282, D-327)', () => {
  it('D1 writes the three rungs m, b, n in ladder order, gates m at area 69, prices its slots as m-<slot>, and gives it no Arbiter or mapping signals', () => {
    const text = folded(readStage('D1'));
    expect(text).toMatch(/\*\*The three rungs\*\*, after any campaign stage, in ladder order: `m`, `b`, `n`\. Design `b` and `n` first, then `m` \(D-281\)/);
    expect(readStage('D1')).toContain("| `id`, `variant` | `m`, `entering-maps` | `b`, `budget` | `n`, `non-budget` |");
    expect(readStage('D1')).toContain("| `loadoutName` | `Entering maps (L<level>) {m}` | `Endgame budget (L<level>) {b}` | `Endgame non-budget (L<level>) {n}` |");
    expect(text).toMatch(/gated at T5 \(area 69: `enemies\/waystones\.json#area-level\.offset` plus 5\)/);
    expect(text).toMatch(/69 for the entering-maps rung's T5 \(`enemies\/waystones\.json#area-level\.offset` plus 5, D-281, D-327\)/);
    expect(text).toContain('`hit_m_fire`');
    expect(text).toMatch(/`m`'s total aims at 5 divines, `b`'s at 20/);
    expect(text).toMatch(/Always, for `b` and `n` \(`m` gets neither, D-281\)/);
    expect(text).toMatch(/\*\*One tree track\*\* \(D-282\): `m` continues from the campaign's last stage, `b` from `m` and `n` from `b`/);
    expect(text).toMatch(/\*\*The buy order\.\*\* `m`'s claims give its buys in order, one claim per step with a short reason where it isn't obvious/);
    expect(text).toContain('at `schemaVersion: 2`');
  });

  it("D1 writes claims only for what the guide states or a gate needs, and the optional traps, either/or picks and fallbacks (D-277, D-279)", () => {
    const text = folded(readStage('D1'));
    expect(text).toMatch(/\*\*Claims\*\* \(D-279\)\. The guide renders the plan with no markers, so the plan's claims carry its sources\. A claim exists only for a fact the guide states or a gate needs/);
    expect(text).toMatch(/Gem levels, stage levels, record numbers, ledger values and prices are held already: no claim restates them/);
    expect(text).toMatch(/\*\*traps\*\*, up to 4: .* each sourced to item text, gem text or the record/);
    expect(text).toMatch(/\*\*either\/or picks\*\*, up to 2: .* the deciding factor measured as a PoB damage or survival difference/);
  });

  it("D1 sources an affix's limit on its base with the lookup's mod base types and essences (D-277, C-37 as WU-60 builds it)", () => {
    const text = folded(readStage('D1'));
    expect(text).toMatch(/\*\*Affix sources\*\* \(D-277\)\. When an affix target can't roll on every base of its slot, say where it comes from/);
    expect(text).toContain('`mcp__pob2__lookup_game_data {mode: "mechanic", query: <the affix text>, kind: "mod"}`');
    expect(text).toMatch(/under each `\[mod\]` hit, `Base types:` lists the bases that can roll it; and with `kind: "essence"`, each `\[essence\]` hit names an essence and the item types it applies that mod to/);
    expect(text).toMatch(/Write affix targets as text: no tier labels and no trade links/);
  });

  it('D2 plans the campaign backward to m, on one ladder track, and carries the reward picks onto every rung (D-281, D-282)', () => {
    const text = folded(readStage('D2'));
    expect(text).toMatch(/Add the campaign stages to `plan\.json` before the endgame rungs `m`, `b` and `n`, in progression order\. The campaign's last stage leads into `m`/);
    expect(text).toMatch(/The endgame is one track, the ladder: `m` continues from the last campaign stage, `b` from `m` and `n` from `b`, and V1 checks each rung's respec and its gold cost/);
    expect(text).toMatch(/\*\*Claims\*\* \(D-279\)\. .* a claim exists only for a fact the guide states or a gate needs/);
    expect(text).toMatch(/a hold row .* or a save row .*; a rotation clause for a stage whose damage is a combo/);
  });

  it("the D1 gate and gates.md gate m at area 69 and at 5 divines (5.5 with near the ceiling); FI-2 breaks the ladder's first rung", () => {
    const gate = folded(readStage('D1-gate'));
    const gates = folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'gates.md'), 'utf8'));
    for (const text of [gate, gates]) expect(text).toMatch(/69 for the entering-maps rung/);
    expect(gate).toMatch(/The entering-maps rung's budget is 5 divines: at most 5 `pass`; above 5 and at most 5\.5 `pass` with a `near-ceiling` finding; above 5\.5 `fail` \(`over-budget`\)/);
    expect(gates).toMatch(/the entering-maps rung's budget is \*\*5 divines\*\*: \*\*≤ 5 pass; > 5 and ≤ 5\.5 pass with "near the ceiling"\*\* in its `Checks`; \*\*> 5\.5 fail\*\* \(D-281\)/);
    expect(gate).toMatch(/\*\*FI-2\*\* \(only when the header's `faults` holds it\): before anything else, set the first endgame stage's \(the ladder's first rung: `m`, else `b`\) `level` to `1`/);
    expect(folded(fs.readFileSync(path.join(SKILL_DIR, 'references', 'pricing.md'), 'utf8'))).toMatch(/Entering-maps rung, the same way: \*\*at most 5 divines passes; above 5 and at most 5\.5 passes, and the guide says "near the ceiling"; above 5\.5 fails\.\*\*/);
    // The run checker holds the same budgets and area level.
    const checker = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'), 'utf8');
    expect(checker).toContain("'entering-maps': { ceiling: 5, tolerance: 5.5, why: 'D-281' }");
    expect(checker).toContain("const tier = { 'entering-maps': 5, budget: 15 }[variant];");
  });
});
