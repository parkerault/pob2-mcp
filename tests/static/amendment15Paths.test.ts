/**
 * Amendment 15 (M-28, WU-145; D-500): paths in a plugin. AC-W115, over every Markdown file under `skills/` and
 * `agents/` (the runner's and the agents' text; the scripts are code, and their usage lines are their own):
 *
 * - every backticked path that starts with a root folder, after a leading `${CLAUDE_PLUGIN_ROOT}/` or `<root>/` is
 *   removed, resolves to an existing file or folder (a pattern, `…/stages/<stage>.md`, to its folder);
 * - no path starts `../`, `./`, `references/`, `templates/`, `stages/` or `.claude/`;
 * - no backticked bare name equals the name of a file under `skills/` or `agents/`;
 * - no command line runs `node …/scripts/<x>.mjs` or a bare `<x>.mjs <runFolder>`;
 * - `task-header.md` documents `root` and a root-relative `reference`; the reference line and the verifier's prompt
 *   have §5's form; `SKILL.md` says root-relative paths are under `${CLAUDE_PLUGIN_ROOT}`, and each agent definition
 *   that they are under the header's `root`; run-folder, PoB-relative and data-relative tokens are left alone.
 *
 * And the old-path guard (R-113, R-116): twelve static test files read a missing file as empty text, so a stale path
 * would pass a negative assertion silently. No file under `skills/`, `agents/`, `data/`, `src/` or `tests/` names the
 * old skill folder or the old agent folder, by path, by escaped path or by segmented join, but AC-W114's own test
 * (`amendment15Layout.test.ts`), which names the removed folders.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const rel = (file: string) => path.relative(REPO, file).split(path.sep).join('/');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
/** The text with every whitespace run collapsed to one space, so a phrase split by a hard wrap is still seen. */
const folded = (text: string) => text.replace(/\s+/g, ' ');

const PLUGIN_FILES = [...walk(path.join(REPO, 'skills')), ...walk(path.join(REPO, 'agents'))];
const MARKDOWN = PLUGIN_FILES.filter((f) => f.endsWith('.md'));
/** The names of the files under skills/ and agents/: a backticked bare name equal to one is banned. */
const FILE_NAMES = new Set(PLUGIN_FILES.map((f) => path.basename(f)));
/** The root folders: the folders at the plugin root, but its dot-folders and the install's own. */
const ROOT_FOLDERS = fs
  .readdirSync(REPO, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !['node_modules', 'coverage'].includes(e.name))
  .map((e) => e.name);
const PREFIX = /^(?:\$\{CLAUDE_PLUGIN_ROOT\}\/|<root>\/)/;

/** The text with its fenced code blocks blanked, line for line, so their fences don't pair with inline backticks. */
function withoutFences(text: string): string {
  return text.replace(/^[ \t]*(`{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, (block) => block.replace(/[^\n]/g, ' '));
}
/** Every inline code span outside the fenced blocks, its whitespace folded (a span can wrap onto the next line). */
function spans(text: string): string[] {
  return [...withoutFences(text).matchAll(/`([^`]+)`/g)].map((m) => folded(m[1]).trim());
}
/** The file or folder a root-relative path names: cut at a placeholder, a glob or an anchor, to the folder before it. */
function target(p: string): string {
  const cut = p.search(/[<*{#…|]/);
  return cut < 0 ? p.replace(/[.,:;)]+$/, '') : p.slice(0, p.lastIndexOf('/', cut) + 1);
}

describe('AC-W115 (WU-145, D-500): every path in the skill and agent text is root-relative and resolves', () => {
  it('reads the Markdown files of both pieces and all four agents', () => {
    const files = MARKDOWN.map(rel);
    expect(files).toEqual(expect.arrayContaining(['skills/build-guide/SKILL.md', 'skills/build-guide/references/task-header.md', 'skills/game-knowledge/references/patterns.md', 'agents/build-guide-coordinator.md']));
    expect(files.filter((f) => f.startsWith('agents/'))).toHaveLength(4);
    expect(ROOT_FOLDERS).toEqual(expect.arrayContaining(['skills', 'agents', 'data', 'docs', 'scripts', 'src']));
  });

  it('every backticked path that starts with a root folder, after a leading ${CLAUDE_PLUGIN_ROOT}/ or <root>/, resolves', () => {
    let checked = 0;
    for (const file of MARKDOWN) {
      for (const span of spans(fs.readFileSync(file, 'utf8'))) {
        const p = span.replace(PREFIX, '').split(' ')[0];
        if (!ROOT_FOLDERS.some((root) => p.startsWith(`${root}/`))) continue;
        checked += 1;
        expect({ file: rel(file), path: span, exists: fs.existsSync(path.join(REPO, target(p))) }).toEqual({ file: rel(file), path: span, exists: true });
      }
    }
    // The pieces name their references, templates, scripts and data from the root: an empty scan would prove nothing.
    expect(checked).toBeGreaterThan(300);
  });

  it('a prefixed path names a root folder; run-folder, PoB-relative and data-relative tokens are left alone', () => {
    const all = MARKDOWN.flatMap((f) => spans(fs.readFileSync(f, 'utf8')).map((span) => ({ file: rel(f), span })));
    const prefixed = all.filter(({ span }) => PREFIX.test(span));
    expect(prefixed.length).toBeGreaterThan(50);
    for (const { file, span } of prefixed) {
      const p = span.replace(PREFIX, '');
      expect({ file, span, root: ROOT_FOLDERS.some((root) => p === root || p.startsWith(`${root}/`)) }).toEqual({ file, span, root: true });
    }
    // The run folder's paths, PoB's own and a plan's data-relative citations keep their forms (§5).
    const spansOf = (name: string) => all.filter((x) => x.file.endsWith(name)).map((x) => x.span);
    expect(spansOf('SKILL.md')).toEqual(expect.arrayContaining(['builds/<id>/', 'interviews/<gate>-<visit>.md']));
    expect(spansOf('skills/build-guide/references/stages/D1-build.md').join(' | ')).toContain('campaign/progress.json#q.<key>.options[<i>]');
    expect(spansOf('skills/game-knowledge/references/lookups.md')).toContain('Modules/CalcOffence.lua:1234');
    for (const { file, span } of all) {
      expect({ file, span, moved: /^(?:(?:\$\{CLAUDE_PLUGIN_ROOT\}|<root>)\/)?skills\/[\w-]+\/(?:builds|reports|cards|concepts|research|interviews|probes|Modules|Data|campaign)\//.test(span) }).toEqual({ file, span, moved: false });
    }
  });

  it('no path starts ../, ./, references/, templates/, stages/ or .claude/', () => {
    for (const file of MARKDOWN) {
      const found = [...fs.readFileSync(file, 'utf8').matchAll(/(?<![\w./-])(?:\.\.\/|\.\/|references\/|templates\/|stages\/|\.claude\/)[^\s`)'",;]*/g)].map((m) => m[0]);
      expect({ file: rel(file), found }).toEqual({ file: rel(file), found: [] });
    }
  });

  it('no backticked bare name equals the name of a file under skills/ or agents/', () => {
    expect(FILE_NAMES).toEqual(expect.objectContaining({ size: expect.any(Number) }));
    expect([...FILE_NAMES]).toEqual(expect.arrayContaining(['SKILL.md', 'gates.md', 'patterns.md', 'run-log.mjs', 'build-guide-verifier.md']));
    for (const file of MARKDOWN) {
      const bare = spans(fs.readFileSync(file, 'utf8')).filter((span) => FILE_NAMES.has(span));
      expect({ file: rel(file), bare }).toEqual({ file: rel(file), bare: [] });
    }
  });

  it('no command line runs node …/scripts/<x>.mjs or a bare <x>.mjs <runFolder>: every run command is a bin/ command', () => {
    // Amendment 16 (WU-151, D-507): but the running leagues' list, `node <root>/skills/game-knowledge/scripts/leagues.mjs`,
    // the command §3 gives it, in the runner rules' Bash list and game knowledge's league line.
    const leagues = /^node\s+(?:<root>|\$\{CLAUDE_PLUGIN_ROOT\})\/skills\/game-knowledge\/scripts\/leagues\.mjs$/;
    for (const file of MARKDOWN) {
      const text = fs.readFileSync(file, 'utf8');
      const found = [...text.matchAll(/\bnode\s+(?:\S*\/)?scripts\/[\w-]+\.mjs|(?<![\w/.-])[\w-]+\.mjs\s+<runFolder>/g)].map((m) => m[0]).filter((c) => !leagues.test(c));
      expect({ file: rel(file), found }).toEqual({ file: rel(file), found: [] });
    }
    // The runner's Bash list names the four commands, each one in bin/ (WU-146, D-501: the list moved with the shared
    // rules to runner-rules.md).
    const skill = folded(fs.readFileSync(path.join(REPO, 'skills', 'build-guide', 'references', 'runner-rules.md'), 'utf8'));
    for (const command of ['pob2-check-run <runFolder>', 'pob2-render-audit <runFolder> --build <id>', 'pob2-render-notes <runFolder> --build <id>', 'pob2-run-log <runFolder> <kind> - <<\'JSON\'']) {
      expect({ command, named: skill.includes(`\`${command}`) }).toEqual({ command, named: true });
      expect(fs.existsSync(path.join(REPO, 'bin', command.split(' ')[0]))).toBe(true);
    }
  });

  it('the checks find what they look for', () => {
    expect(spans('a `skills/x.md` and\n`two\n  lines` b\n```json\n{"a": "`not-a-span`"}\n```\n')).toEqual(['skills/x.md', 'two lines']);
    expect(target('skills/build-guide/references/stages/<stage>.md')).toBe('skills/build-guide/references/stages/');
    expect(target('data/league/<newest>.md')).toBe('data/league/');
    expect(target('skills/build-guide/SKILL.md')).toBe('skills/build-guide/SKILL.md');
    expect('`../gates.md` and (references/x.md)'.match(/(?<![\w./-])(?:\.\.\/|\.\/|references\/|templates\/|stages\/|\.claude\/)[^\s`)'",;]*/g)).toEqual(['../gates.md', 'references/x.md']);
  });
});

describe('AC-W115 (WU-145, D-500): the task header, the reference line, the verifier prompt and the root sentences', () => {
  const skillRaw = fs.readFileSync(path.join(REPO, 'skills', 'build-guide', 'SKILL.md'), 'utf8');
  const skill = folded(skillRaw);
  const header = fs.readFileSync(path.join(REPO, 'skills', 'build-guide', 'references', 'task-header.md'), 'utf8');

  it('task-header.md documents root, the plugin root\'s absolute path, and a root-relative reference under it', () => {
    expect(header).toMatch(/^\| `root` \| the plugin root's absolute path, as the runner's `skills\/build-guide\/SKILL\.md` shows it after `\$\{CLAUDE_PLUGIN_ROOT\}` is replaced/m);
    expect(header).toContain("| `reference` | the step's stage reference, root-relative under `root`: `skills/build-guide/references/stages/<stage>.md` |");
    const example = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(header)![1]) as Record<string, unknown>;
    expect(example.root).toEqual(expect.stringMatching(/^\//));
    expect(example.reference).toBe('skills/build-guide/references/stages/D1-build.md');
  });

  it('the reference line and the verifier\'s fixed prompt read the stage reference under the header\'s root', () => {
    expect(skill).toContain('then `Read <root>/skills/build-guide/references/stages/<stage>.md and do that step.`');
    expect(skill).toContain("The header's `root` is `${CLAUDE_PLUGIN_ROOT}`, which `<root>` stands for.");
    const at = skillRaw.indexOf("The verifier's prompt is always exactly this");
    expect(skillRaw.slice(at, skillRaw.indexOf('\n', at))).toContain("`<root>` the header's `root`");
    const block = /````\n([\s\S]*?)\n````/.exec(skillRaw.slice(at))![1].split('\n');
    expect(block[block.length - 1]).toBe('Read <root>/skills/build-guide/references/stages/V4.md and do that step.');
  });

  it('SKILL.md says root-relative paths are under ${CLAUDE_PLUGIN_ROOT}; each agent definition, under the header\'s root', () => {
    expect(skill).toContain('A root-relative path in its references is under `${CLAUDE_PLUGIN_ROOT}`, the plugin root.');
    for (const file of fs.readdirSync(path.join(REPO, 'agents'))) {
      const text = folded(fs.readFileSync(path.join(REPO, 'agents', file), 'utf8'));
      expect({ file, says: text.includes("A root-relative path in a reference you read (one that starts with a folder at the plugin root, such as skills/ or data/) is under the header's `root`.") }).toEqual({ file, says: true });
    }
  });
});

/**
 * §5: a skill's and an agent's body name plugin files as `${CLAUDE_PLUGIN_ROOT}/<root-relative path>`, which Claude
 * Code replaces with the plugin root. Every root-relative plugin path in the body's code spans (a span's own path or
 * one after a space, `head -3 …/data/…`) needs the prefix; `<root>/` stands only in the task header's reference line
 * (the verifier's fixed prompt, a fenced block, is checked as a whole above). A plugin file named in prose, outside any
 * span, is a miss too.
 */
function unprefixed(body: string): string[] {
  const text = withoutFences(body);
  const roots = ROOT_FOLDERS.join('|');
  const out: string[] = [];
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    const span = folded(m[1]).trim();
    for (const t of span.matchAll(new RegExp(`(?:^|(?<=[\\s(]))(\\$\\{CLAUDE_PLUGIN_ROOT\\}\\/|<root>\\/)?(?:${roots})\\/(?!>)`, 'g'))) {
      if (t[1] === '${CLAUDE_PLUGIN_ROOT}/') continue;
      if (t[1] === '<root>/' && span === 'Read <root>/skills/build-guide/references/stages/<stage>.md and do that step.') continue;
      out.push(span);
    }
  }
  const prose = text.replace(/`[^`]+`/g, (span) => span.replace(/[^\n]/g, ' '));
  for (const m of prose.matchAll(new RegExp(`(?<![\\w/.$}>-])(?:${roots})\\/[\\w./-]*\\.(?:md|json|mjs|sh|ts|lua)\\b`, 'g'))) out.push(m[0]);
  return out;
}
/** A Markdown file's body, its frontmatter left out. */
const bodyOf = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n/, '');

describe('AC-W115 (WU-145, D-500): SKILL.md and the agent bodies name plugin files under ${CLAUDE_PLUGIN_ROOT}', () => {
  it('every root-relative plugin path in skills/build-guide/SKILL.md and agents/*.md carries ${CLAUDE_PLUGIN_ROOT}/, <root>/ only in the reference line', () => {
    const files = [path.join(REPO, 'skills', 'build-guide', 'SKILL.md'), ...fs.readdirSync(path.join(REPO, 'agents')).map((f) => path.join(REPO, 'agents', f))];
    let prefixed = 0;
    for (const file of files) {
      const body = bodyOf(fs.readFileSync(file, 'utf8'));
      prefixed += (body.match(/\$\{CLAUDE_PLUGIN_ROOT\}\//g) ?? []).length;
      expect({ file: rel(file), unprefixed: unprefixed(body) }).toEqual({ file: rel(file), unprefixed: [] });
    }
    expect(prefixed).toBeGreaterThan(80);
  });

  it('the check fails on an unprefixed path, a misplaced <root>/ and a plugin file in prose, and passes the prefixed forms', () => {
    expect(unprefixed('as in `x` (`skills/build-guide/references/checkpoints.md`).')).toEqual(['skills/build-guide/references/checkpoints.md']);
    expect(unprefixed('a span that wraps, `Test config:\n  first-n:2` (`skills/build-guide/references/checkpoints.md`)')).toEqual(['skills/build-guide/references/checkpoints.md']);
    expect(unprefixed('staleness line, `head -3 data/league/<newest>.md`, the newest')).toEqual(['head -3 data/league/<newest>.md']);
    expect(unprefixed('read `<root>/skills/pricing/references/pricing.md` first')).toEqual(['<root>/skills/pricing/references/pricing.md']);
    expect(unprefixed('## The fix round (skills/build-guide/SKILL.md steps 12 and 16)')).toEqual(['skills/build-guide/SKILL.md']);
    expect(unprefixed('then `Read\n  <root>/skills/build-guide/references/stages/<stage>.md and do that step.` Add')).toEqual([]);
    expect(unprefixed('(`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/checkpoints.md`), `head -3 ${CLAUDE_PLUGIN_ROOT}/data/league/<newest>.md`')).toEqual([]);
    expect(unprefixed('`data | <path under data/>#<id>`, `builds/<id>/`, `<buildFolder>/reports/V4-<n>.md`, such as skills/ or data/')).toEqual([]);
  });
});

describe('AC-W115 (WU-145, R-113, R-116): the old-path guard', () => {
  /** The old skill and agent folders' names, joined here so this file doesn't name them itself. */
  const dot = ['', 'claude'].join('.');
  const esc = (text: string) => text.replace(/[.]/g, '\\.');
  /** The old folders by path, and by a segmented join in either quote style with any whitespace around the comma. */
  const OLD = [
    new RegExp(`${esc(dot)}/skills`),
    new RegExp(`${esc(dot)}/agents/build-guide`),
    new RegExp(`(['"])${esc(dot)}\\1\\s*,\\s*(['"])(?:skills|agents)\\2`),
  ];
  /** The forms a text names, its backslashes dropped first, so a regex's escaped slashes and dots count too. */
  const named = (text: string) => OLD.filter((old) => old.test(text.replace(/\\/g, ''))).map(String);
  const EXEMPT = ['tests/static/amendment15Layout.test.ts'];

  it('no file under skills/, agents/, data/, src/ or tests/ names the old folders, but AC-W114\'s own test', () => {
    const files = ['skills', 'agents', 'data', 'src', 'tests'].flatMap((d) => walk(path.join(REPO, d))).filter((f) => !EXEMPT.includes(rel(f)));
    expect(files.length).toBeGreaterThan(500);
    for (const file of files) expect({ file: rel(file), named: named(fs.readFileSync(file, 'utf8')) }).toEqual({ file: rel(file), named: [] });
  });

  it('the guard sees each old form, escaped or segmented in either quote style with or without spaces, and the exempt file names the removed folders', () => {
    const sample = [
      `path.join(REPO, '${dot}', 'skills', 'x')`,
      `path.join(REPO, '${dot}','skills')`,
      `path.join(REPO, "${dot}" ,  "agents", "build-guide")`,
      `path.join(REPO, '${dot}',\n  'agents')`,
      `/\\${dot}\\/skills\\/x/`,
      `${dot}/agents/build-guide/a.md`,
    ];
    for (const s of sample) expect({ s, seen: named(s).length > 0 }).toEqual({ s, seen: true });
    // A mixed pair of quotes isn't one join, and other folders under it aren't the old ones.
    for (const s of [`'${dot}", 'skills'`, `${dot}/workflows/x.js`, `path.join(REPO, '${dot}', 'commands')`]) expect({ s, seen: named(s).length > 0 }).toEqual({ s, seen: false });
    expect(named(fs.readFileSync(path.join(REPO, EXEMPT[0]), 'utf8')).length).toBeGreaterThan(0);
  });
});
