/**
 * WU-19: the README, the project CLAUDE.md, the stale-doc removal and the empty hygiene files.
 *
 * - AC-G1: the README tool table equals `pnpm docs:tools` output byte for byte (81 rows, D-91, C-37, C-42, C-38, C-40).
 * - AC-G2: the stale docs are gone, and outside the migration block the README and CLAUDE.md carry
 *   no PoE1 cruft (the AC-F20 matcher) and none of the old install/flag strings. Both checks run on
 *   whitespace-flattened text, so a phrase split by a hard wrap is still caught.
 * - AC-G3: the README documents setup, registration, configuration and GGG's notice; the migration
 *   block names every removed or changed env var and every removed tool.
 * - AC-G4 (static part): the fresh-clone check script exists, is executable and has no pipes. The
 *   check itself is a script check the verifier runs.
 * - AC-G5: CLAUDE.md carries the tooling cautions.
 * - AC-G6: the hygiene allowlist and the cruft waivers are empty.
 * - AC-P7 (WU-37): the env table has a `POB_GUIDES_DIRECTORY` row stating its default.
 *
 * The tool-table test runs the generator, which reads the compiled registry under build/: run
 * `pnpm build` first (`mise run test` does).
 */
import { describe, it, expect } from '@jest/globals';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { bannedIn } from '../helpers/cruftScan';
import { TOOL_META } from '../../src/server/toolMeta';
import { listedToolSchemas } from '../../src/server/createServer';

const REPO = path.resolve(__dirname, '..', '..');
const README = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
/** The text with every whitespace run collapsed to one space, so phrase checks see across line wraps. */
const flat = (text: string): string => text.replace(/\s+/g, ' ');
/** The README, flattened. */
const README_FLAT = flat(README);
const CLAUDE_MD_PATH = path.join(REPO, 'CLAUDE.md');

const TOOLS_START = '<!-- tools:start -->';
const TOOLS_END = '<!-- tools:end -->';
const MIGRATION_START = '<!-- migration:start -->';
const MIGRATION_END = '<!-- migration:end -->';

/** The text strictly between two markers (the newline after the start marker excluded). */
function between(text: string, start: string, end: string): string {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  expect(s).toBeGreaterThanOrEqual(0);
  expect(e).toBeGreaterThan(s);
  expect(text.indexOf(start, s + 1)).toBe(-1);
  expect(text.indexOf(end, e + 1)).toBe(-1);
  return text.slice(s + start.length, e).replace(/^\n/, '');
}

/** The text with the block between two markers (markers included) cut out. */
function outside(text: string, start: string, end: string): string {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  expect(s).toBeGreaterThanOrEqual(0);
  expect(e).toBeGreaterThan(s);
  return text.slice(0, s) + text.slice(e + end.length);
}

function generatedTable(): string {
  const script = path.join(REPO, 'scripts', 'gen-tool-table.mjs');
  if (!fs.existsSync(path.join(REPO, 'build', 'server', 'createServer.js'))) {
    throw new Error('build/ is missing: run `pnpm build` first (mise run test does)');
  }
  return execFileSync(process.execPath, [script], {
    cwd: REPO,
    env: { PATH: process.env.PATH ?? '' },
    encoding: 'utf8',
  });
}

/** Spine §11 / D-4: every removed tool. */
const REMOVED_TOOLS = (
  JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'tool-disposition.json'), 'utf8')) as Array<{
    name: string;
    bucket: string;
  }>
)
  .filter((t) => t.bucket === 'delete')
  .map((t) => t.name);

/** Spine §11: env vars removed, and env vars whose meaning changed. */
const REMOVED_ENV = [
  'POB_LUA_ENABLED',
  'POE_TRADE_ENABLED',
  'POB_LEGACY_GEM_TOOLS',
  'POE_TRADE_USER_AGENT',
  'POE_RATE_LIMIT_PER_SECOND',
  'POE_CACHE_TTL',
];
const CHANGED_ENV = ['POB_TIMEOUT_MS', 'POB_FORK_PATH', 'POB_DIRECTORY'];

const D16_COMMAND =
  'claude mcp add pob2 -s user -e "POB_DIRECTORY=/mnt/c/Users/parke/Documents/Path of Building (PoE2)/Builds" -- mise exec -C /home/parker/projects/pob2-mcp -- node build/index.js';
const GGG_NOTICE = "This product isn't affiliated with or endorsed by Grinding Gear Games in any way.";

/** AC-G2: the AC-F20 hits in one file's text, matched on the flattened text so line wraps can't hide one. */
function cruftHits(file: string, text: string): string[] {
  return bannedIn(flat(text)).map((phrase) => `${file}: "${phrase}"`);
}

/** AC-G2: the removed flags, old install steps and old labels the README must not name outside the block. */
const OLD_STRINGS = [
  'POB_LUA_ENABLED',
  'POE_TRADE_ENABLED',
  'npm install',
  'apt install luajit',
  'brew install luajit',
  'Chaos equivalent',
  'api-stdio',
];

/** The OLD_STRINGS the text names, case-insensitively, on the flattened text. */
function oldStringHits(text: string): string[] {
  const lower = flat(text).toLowerCase();
  return OLD_STRINGS.filter((b) => lower.includes(b.toLowerCase()));
}

describe('WU-19: README tool table (AC-G1)', () => {
  it('AC-G1: `pnpm docs:tools` runs scripts/gen-tool-table.mjs', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['docs:tools']).toBe('node scripts/gen-tool-table.mjs');
  });

  it('AC-G1: the README section between the tools markers equals the generator output byte for byte, with 81 rows (D-91, C-37, C-42, C-38, C-40)', () => {
    const table = generatedTable();
    expect(between(README, TOOLS_START, TOOLS_END)).toBe(table);

    const lines = table.split('\n');
    expect(lines[0]).toBe('| Tool | Group | Description |');
    expect(lines[1]).toBe('|---|---|---|');
    expect(lines[lines.length - 1]).toBe('');
    const rows = lines.slice(2, -1);
    expect(rows).toHaveLength(81);

    // Every row is one listed tool, in listing order, with its TOOL_META group and a description.
    const parsed = rows.map((r) => {
      const m = /^\| `([a-z0-9_]+)` \| (core|trade|ninja) \| (.+) \|$/.exec(r);
      expect(m).not.toBeNull();
      return { name: m![1], group: m![2], description: m![3] };
    });
    expect(parsed.map((p) => p.name)).toEqual(listedToolSchemas({}).map((t) => t.name));
    expect(new Set(parsed.map((p) => p.name))).toEqual(new Set(Object.keys(TOOL_META)));
    for (const p of parsed) {
      expect(p.group).toBe(TOOL_META[p.name].group);
      expect(p.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('WU-19: stale docs removed, README and CLAUDE.md clean (AC-G2)', () => {
  it('AC-G2: HANDOFF.md and the 8 stale docs/*.md files are gone, and docs/ holds only epic folders', () => {
    const stale = [
      'HANDOFF.md',
      'docs/OPTIMIZE_TREE_GUIDE.md',
      'docs/POB_BRIDGE.md',
      'docs/QUICKSTART.md',
      'docs/QUICK_REFERENCE.md',
      'docs/ROADMAP.md',
      'docs/SUGGEST_OPTIMAL_NODES_GUIDE.md',
      'docs/TESTING_GUIDE.md',
      'docs/TRADE_API_QUICKSTART.md',
    ];
    expect(stale.filter((f) => fs.existsSync(path.join(REPO, f)))).toEqual([]);
    // Each epic keeps its docs in its own folder (build-guide worklog, 2026-10-08); no loose files.
    expect(fs.readdirSync(path.join(REPO, 'docs')).sort()).toEqual(['build-guide', 'design', 'stabilization']);
  });

  it('AC-G2: outside the migration block, the AC-F20 scanner finds no banned phrase in README.md or CLAUDE.md', () => {
    const readmeOutside = outside(README, MIGRATION_START, MIGRATION_END);
    const claudeMd = fs.readFileSync(CLAUDE_MD_PATH, 'utf8');
    expect([...cruftHits('README.md', readmeOutside), ...cruftHits('CLAUDE.md', claudeMd)]).toEqual([]);
    // The matcher is the AC-F20 one: a planted phrase is caught.
    expect(bannedIn('a Cluster Jewel for the Templar')).toEqual(['cluster jewel', 'Templar']);
  });

  it('AC-G2: the cruft check sees a banned phrase that a hard wrap splits across lines', () => {
    // AC-F20 matches within a whole literal; the README and CLAUDE.md are hard-wrapped prose, so a
    // phrase broken by a line break must still count.
    expect(cruftHits('X.md', 'Socket a Large cluster\njewel next to the\nElder.')).toEqual([
      'X.md: "cluster jewel"',
      'X.md: "the elder"',
    ]);
    expect(cruftHits('X.md', 'no spell\n  suppression here')).toEqual(['X.md: "spell suppression"']);
  });

  it('AC-G2: outside the migration block, the README names no removed flag, old install step or old label', () => {
    expect(oldStringHits(outside(README, MIGRATION_START, MIGRATION_END))).toEqual([]);
  });

  it('AC-G2: the old-string check sees a string that a hard wrap splits across lines', () => {
    expect(oldStringHits('run sudo apt install\nluajit, then npm\n  install; prices in Chaos\nequivalent')).toEqual([
      'npm install',
      'apt install luajit',
      'Chaos equivalent',
    ]);
  });
});

describe('WU-19: README content (AC-G3)', () => {
  it('AC-G3: setup and the gate: mise trust, mise run setup, mise run test', () => {
    for (const s of ['mise trust', 'mise run setup', 'mise run test']) expect(README).toContain(s);
  });

  it('AC-G3: the exact D-16 registration command', () => {
    expect(README).toContain(D16_COMMAND);
    expect(README_FLAT).toContain(`\`\`\`bash ${D16_COMMAND} \`\`\``);
  });

  it('AC-G3: POESESSID, with the .env location and the link fallback', () => {
    expect(README).toContain('POESESSID');
    expect(README_FLAT).toContain('`.env` file at the repository root, next to `package.json`');
    expect(README_FLAT).toContain('`Trade search not run: <reason>` with a trade-site link');
  });

  it('AC-G3/D-15: the cookie goes only in .env, never as `-e` on claude mcp add (spine §13: .env is its one place on disk)', () => {
    expect(README_FLAT).toContain('The trade cookie `POESESSID` is the exception: put it only in `.env`');
    expect(README_FLAT).toContain('never pass it with `-e`');
    expect(README_FLAT).toContain('Set it only in `.env`, never with `-e`');
    // No registration example passes a cookie on the command line, in the README or CLAUDE.md.
    const claudeMdFlat = flat(fs.readFileSync(CLAUDE_MD_PATH, 'utf8'));
    for (const text of [README_FLAT, claudeMdFlat]) {
      expect(text).not.toMatch(/-e\s*["']?(POESESSID|POE_SESSION_ID)=/);
    }
    // Nothing tells the reader the cookie may go anywhere but .env.
    expect(README_FLAT).not.toContain('can go in `.env` instead');
  });

  it('AC-G3: POE_LEAGUE, with the default-league rule (D-20)', () => {
    expect(README).toContain('POE_LEAGUE');
    expect(README_FLAT).toContain(
      "the first league the trade site lists that isn't `Standard` or `Hardcore` and doesn't start with `HC `",
    );
  });

  it('AC-G3: POB_DIRECTORY, with a WSL example', () => {
    expect(README).toContain('POB_DIRECTORY');
    expect(README).toContain('/mnt/c/Users/<you>/Documents/Path of Building (PoE2)/Builds');
  });

  it('AC-G3: the state-dir path, POE_TRADE_DISABLED, POE_NINJA_DISABLED and GGG\'s notice', () => {
    for (const s of ['~/.local/state/pob2-mcp', 'POE_TRADE_DISABLED', 'POE_NINJA_DISABLED', GGG_NOTICE]) {
      expect(README_FLAT).toContain(s);
    }
  });

  it('AC-G3: the migration block names every removed or changed env var (spine §11) and every removed tool', () => {
    const migration = between(README, MIGRATION_START, MIGRATION_END);
    expect(REMOVED_TOOLS).toHaveLength(26);
    const missing = [...REMOVED_ENV, ...CHANGED_ENV, ...REMOVED_TOOLS].filter((n) => !migration.includes(`\`${n}\``));
    expect(missing).toEqual([]);
  });
});

describe('WU-19: fresh-clone check script (AC-G4, static part)', () => {
  it('AC-G4: scripts/fresh-clone-check.sh and its MCP client exist, the shell script is executable and contains no pipes', () => {
    const sh = path.join(REPO, 'scripts', 'fresh-clone-check.sh');
    const mjs = path.join(REPO, 'scripts', 'fresh-clone-check.mjs');
    expect(fs.existsSync(sh)).toBe(true);
    expect(fs.existsSync(mjs)).toBe(true);
    expect(fs.statSync(sh).mode & 0o111).not.toBe(0);
    const text = fs.readFileSync(sh, 'utf8');
    expect(text).not.toContain('|');
    expect(text).toContain('scripts/fresh-clone-check.mjs');
    for (const s of [
      'POE_LEAGUE="Forbidden Rites"',
      'POE_TRADE_BASE=http://127.0.0.1:9/api/trade2',
      'POE_NINJA_DISABLED=true',
      'unset POESESSID POE_SESSION_ID',
      'mise trust',
      'mise run setup',
    ]) {
      expect(text).toContain(s);
    }
  });
});

describe('WU-19: CLAUDE.md (AC-G5)', () => {
  it('AC-G5: CLAUDE.md exists and carries the bootstrap, the cautions, the pin upgrade procedure and the spec pointer', () => {
    expect(fs.existsSync(CLAUDE_MD_PATH)).toBe(true);
    const raw = fs.readFileSync(CLAUDE_MD_PATH, 'utf8');
    // Compare without Markdown emphasis and line breaks, case-insensitively.
    const text = raw.replace(/\*\*/g, '').replace(/\s+/g, ' ').toLowerCase();
    const required = [
      'mise trust && pnpm install --frozen-lockfile && mise run pob:fetch',
      '`mise trust` first',
      'no pipes in mise tasks',
      'tests never touch the network or the real builds folder (d-34)',
      'spawned test servers use `spawnserver`',
      'never read or print `.env`',
      'engine tests fail without the engine; `pob_skip_engine=1` skips them',
      'run probes from a temp cwd, never the repo root',
      'upgrading the pob2 pin',
      'spike s-2',
      'run `mise run pob:fetch`',
      'docs/stabilization/spec/readme.md',
    ];
    expect(required.filter((s) => !text.includes(s))).toEqual([]);
  });
});

describe('WU-19: hygiene files end empty (AC-G6)', () => {
  it('AC-G6: tests/fixtures/tool-hygiene-allowlist.json is [] and tests/static/poe1-cruft-waivers.json is []', () => {
    const read = (p: string) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8')) as unknown;
    expect(read('tests/fixtures/tool-hygiene-allowlist.json')).toEqual([]);
    expect(read('tests/static/poe1-cruft-waivers.json')).toEqual([]);
  });
});

/** The README's Configuration env table, as rows of cells (the header and separator rows excluded). */
function envTableRows(): string[][] {
  const lines = README.split('\n');
  const header = lines.indexOf('| Variable | Default | What it does |');
  expect(header).toBeGreaterThanOrEqual(0);
  const rows: string[][] = [];
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(line.split('|').slice(1, -1).map((cell) => cell.trim()));
  }
  return rows;
}

describe('WU-37: README env table (AC-P7)', () => {
  it('AC-P7: the env table has a POB_GUIDES_DIRECTORY row whose default is `Guides` beside the builds folder', () => {
    const row = envTableRows().find((cells) => cells[0] === '`POB_GUIDES_DIRECTORY`');
    expect(row).toBeDefined();
    const [, defaultCell, what] = row!;
    expect(defaultCell).toContain('`Guides` beside the builds folder');
    expect(defaultCell).toContain('~/Documents/Path of Building (PoE2)/Guides');
    expect(what).toMatch(/guide runs/);
    expect(what).toMatch(/outside the folder PoB2 browses/);
  });
});
