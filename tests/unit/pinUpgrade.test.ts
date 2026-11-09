/**
 * AC-W138 (WU-155, amendment 16 §4, D-508, Appendix A.4): the upgrade script, `scripts/pin-upgrade.mjs`, on fixtures,
 * with no network and no engine.
 *
 * The script and the scripts it runs (fetch-pob.sh, patch-fingerprints.mjs, league-digest.mjs, rules-index.mjs, the
 * probe and its list) are copied into a temporary repository whose pob-pin.json names a local `file://` origin: an
 * invented PoB tree tagged v0.0.1 (the pin), v0.0.2 and v0.0.3, with a `dev` branch and a branch named like a release.
 * Git, bash and the node scripts run for real. Only what would boot PoB or run the suite is faked, by executables
 * first on PATH that log each call (its arguments, cwd and folders) and answer from canned data: `luajit` (the probe's
 * results and the candidates' dump, by the tree's manifest version), `pnpm` (`build`, and Jest's JSON results: the
 * injected gate results, in order) and `mise` (`run pob:fetch` runs the copied fetch-pob.sh; `exec --` runs the rest).
 *
 * The fixture modules hold five patches: PG-901, whose fingerprint changes at v0.0.2 and whose retirement case passes
 * (listed, kept); PG-902, whose retirement case fails (retired: its entry, its name in M.PATCHES and that case); PG-903,
 * whose test fails on another case (listed, kept); PG-904, a parse fix whose retirement case fails (retired: its list
 * element); PG-905, which stays. Every name and line here is invented.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const LANE = path.resolve(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-upgrade-test-'));
const ORIGIN = path.join(TMP, 'origin');
const REPO = path.join(TMP, 'repo');
const BIN = path.join(TMP, 'bin');
const FAKE = path.join(TMP, 'fake');
const LOG = path.join(TMP, 'calls.jsonl');
const VENDOR = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2');

const REAL_PIN = JSON.parse(fs.readFileSync(path.join(LANE, 'pob-pin.json'), 'utf8')) as Record<string, string>;

const GIT_ENV: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const read = (file: string) => fs.readFileSync(file, 'utf8');
/** sha1 under PoB's manifest scheme of lines, each ended by CRLF (scripts/patch-fingerprints.mjs's cut). */
const linesSha1 = (lines: string[]) => crypto.createHash('sha1').update(lines.map((l) => `${l}\r\n`).join('')).digest('hex');
const crlfSha1 = (text: string) => crypto.createHash('sha1').update(text.replace(/\r\n?|\n/g, '\r\n')).digest('hex');

// ------------------------------------------------------------------------------------------------------------
// The invented PoB tree

interface TreeOptions {
  version: string;
  method: string;
  countBody: string[];
  tradeQuery: string;
  common: string;
  gems: string[];
  warning: boolean;
  trees: string[];
}

const COUNT_V1 = ['\tlocal count = 0', '\treturn count'];
const PROCESS = ['function SkillsTabClass:ProcessSocketGroup(socketGroup)', '\tsocketGroup.done = true', 'end'];
const CALC_RANGE = ['\t-- Process extra skills granted by items or tree nodes', '\tlocal granted = {}', '\tend -- extra'];
const FIXED_LINE = 'c["fixed line"]={{}, "remainder"}';
const KEPT_LINE = 'c["kept line"]={{}, nil}';

function tree(o: TreeOptions): Record<string, string> {
  return {
    'manifest.xml': `<PoBVersion><Version number="${o.version}"/></PoBVersion>\n`,
    'src/HeadlessWrapper.lua': `-- headless ${o.version}\n`,
    'src/Classes/SkillsTab.lua': [`-- SkillsTab`, `function SkillsTabClass:${o.method}()`, ...o.countBody, 'end', '', ...PROCESS, ''].join('\n'),
    'src/Modules/CalcSetup.lua': ['local M = {}', 'function M.setup()', ...CALC_RANGE, 'end', 'return M', ''].join('\n'),
    'src/Modules/Build.lua': o.warning
      ? 'InsertIfNew(lines, "You have too many gem groups allocated. Max allowed is "..a..".")\n'
      : 'InsertIfNew(lines, "Too many skills: "..a)\n',
    'src/Modules/Common.lua': o.common,
    'src/Classes/TradeQuery.lua': o.tradeQuery,
    'src/Classes/TradeQueryGenerator.lua': '-- generator\n',
    'src/Classes/TradeQueryRequests.lua': '-- requests\n',
    'src/Data/ModCache.lua': ['local c = {}', FIXED_LINE, KEPT_LINE, 'return c', ''].join('\n'),
    'src/Data/Gems.lua': `return {\n${o.gems.map((g) => `\t{\n\t\tname = "${g}",\n\t},\n`).join('')}}\n`,
    'src/Data/Uniques/amulet.lua': 'return {\n[[\nStar Clasp\nGold Amulet\n]],\n}\n',
    'src/Data/Uniques/Special/Generated.lua': '-- none\n',
    'src/Data/Bases/ring.lua': 'itemBases["Gold Ring"] = {\n}\n',
    'src/Data/ModRunes.lua': 'return {\n\t["Iron Rune"] = {\n\t},\n}\n',
    'src/GameVersions.lua': `treeVersionList = { ${o.trees.map((t) => `"${t}"`).join(', ')} }\n`,
    ...Object.fromEntries(o.trees.map((t) => [`src/TreeData/${t}/tree.json`, '{"classes":[],"nodes":{}}\n'])),
    'runtime/lua/dkjson.lua': '-- stub\n',
  };
}

const V1: TreeOptions = {
  version: '0.0.1',
  method: 'UpdateGlobalGemCountAssignments',
  countBody: COUNT_V1,
  tradeQuery: '-- trade query 1\n',
  common: '-- common 1\n',
  gems: ['Fireball'],
  warning: true,
  trees: ['0_5'],
};
// v0.0.2: PG-901's method body, TradeQuery.lua and the gems change; Common.lua doesn't.
const V2: TreeOptions = { ...V1, version: '0.0.2', countBody: ['\tlocal count = 1', '\treturn count'], tradeQuery: '-- trade query 2\n', gems: ['Fireball', 'Frostbolt'] };
// v0.0.3: Common.lua changes, the skill-slot method is renamed, the warning goes and a newer tree arrives.
const V3: TreeOptions = { ...V2, version: '0.0.3', method: 'CountGemGroups', common: '-- common 3\n', warning: false, trees: ['0_5', '0_6'] };

function commitTree(files: Record<string, string>, message: string): string {
  for (const entry of fs.readdirSync(ORIGIN)) if (entry !== '.git') fs.rmSync(path.join(ORIGIN, entry), { recursive: true, force: true });
  for (const [rel, text] of Object.entries(files)) write(path.join(ORIGIN, rel), text);
  git(ORIGIN, 'add', '-A');
  git(ORIGIN, '-c', 'user.name=fixture', '-c', 'user.email=fixture@invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', message);
  return git(ORIGIN, 'rev-parse', 'HEAD');
}

// ------------------------------------------------------------------------------------------------------------
// The temporary repository

const CASE = {
  901: "with the patch reverted, PoB's own count is 10 (if this fails, remove PG-901's entry from pob-api/API/Patches.lua)",
  902: "with the patch reverted, PoB's own quality is 0 (if this fails, remove PG-902's entry from pob-api/API/Patches.lua)",
  903: "with the patch reverted, PoB's own rolls move (if this fails, remove PG-903's entry from pob-api/API/Patches.lua)",
  904: "with the fix list off, PoB's own parse leaves a remainder (if this fails, remove PG-904's entry from pob-api/API/ParseFixes.lua)",
  905: "with the fix list off, the kept line still leaves a remainder (if this fails, remove PG-905's entry from pob-api/API/ParseFixes.lua)",
};
const SETUP = {
  902: "reverts PG-902, reads PoB's own quality, and applies the patch again",
  903: 'reads the rolls through the export',
};

function patchesLua(): string {
  const entry = (n: number, fp: string) => [
    `-- PG-${n}: a fixture patch.`,
    `local restorePG${n}`,
    `local PG${n} = {`,
    `  pg = 'PG-${n}',`,
    '  fingerprints = {',
    fp,
    '  },',
    `  test = { file = 'tests/integration/pg${n}.test.ts',`,
    `    case = ${JSON.stringify(CASE[n as keyof typeof CASE])} },`,
    '  apply = function()',
    `    restorePG${n} = function() end`,
    '  end,',
    '  revert = function()',
    `    if restorePG${n} then restorePG${n}() end`,
    '  end,',
    '}',
    '',
  ].join('\n');
  const fn = (func: string, lines: string[]) => `    { file = 'Classes/SkillsTab.lua',\n      func = '${func}',\n      sha1 = '${linesSha1(lines)}' },`;
  return [
    '-- API/Patches.lua: a fixture of tests/unit/pinUpgrade.test.ts (the shape of the bridge\'s, Appendix A.3).',
    '',
    'local M = {}',
    '',
    entry(901, fn('function SkillsTabClass:UpdateGlobalGemCountAssignments()', ['function SkillsTabClass:UpdateGlobalGemCountAssignments()', ...COUNT_V1, 'end'])),
    entry(902, fn('function SkillsTabClass:ProcessSocketGroup(socketGroup)', PROCESS)),
    entry(
      903,
      `    { file = 'Modules/CalcSetup.lua',\n      from = '-- Process extra skills granted by items or tree nodes',\n      to = 'end -- extra',\n      sha1 = '${linesSha1(CALC_RANGE)}' },`,
    ),
    'M.PATCHES = { PG901, PG902, PG903 }',
    '',
    'return M',
    '',
  ].join('\n');
}

function parseFixesLua(): string {
  const element = (n: number, line: string) => [
    '  {',
    `    -- PG-${n}: a fixture parse fix.`,
    `    pg = 'PG-${n}',`,
    `    line = '${line.slice(3, line.indexOf('"]'))}',`,
    '    fingerprints = {',
    `      { file = 'Data/ModCache.lua', line = '${line.slice(0, line.indexOf('=') + 1)}', sha1 = '${linesSha1([line])}' },`,
    '    },',
    `    test = { file = 'tests/integration/pg${n}.test.ts',`,
    `      case = ${JSON.stringify(CASE[n as keyof typeof CASE])} },`,
    '  },',
  ].join('\n');
  return ['-- API/ParseFixes.lua: a fixture.', '', 'local M = {}', '', 'M.FIXES = {', element(904, FIXED_LINE), element(905, KEPT_LINE), '}', '', 'return M', ''].join('\n');
}

/** A retirement test file: a setup case and the retirement case, in the bridge's two layouts. */
function testFile(n: number, singleLine: boolean): string {
  const retire = CASE[n as keyof typeof CASE];
  const setup = SETUP[n as keyof typeof SETUP];
  const lines = [`describe('PG-${n}', () => {`];
  if (setup) lines.push(`  it(${JSON.stringify(setup)}, () => {`, '    expect(1).toBe(1);', '  });', '');
  if (singleLine) lines.push(`  it(${JSON.stringify(retire)}, () => {`, '    expect(true).toBe(true);', '  });');
  else lines.push('  it(', `    ${JSON.stringify(retire)},`, '    () => {', '      expect(0).toBe(0);', '    },', '  );');
  lines.push('});', '');
  return lines.join('\n');
}

const DIGEST = (label: string, frostboltInPin: boolean) =>
  [
    '# League digest: Embers of Tarn',
    '',
    `Embers of Tarn (0.9) on poe2db.tw, fetched 2026-11-01. League: from 2026-09-04 20:00 UTC until no end announced. In-pin flags: checked against ${label} on 2026-11-01.`,
    '',
    `Entries: 2 gems, 0 uniques, 0 items, 0 ascendancies, 0 passives; ${frostboltInPin ? 2 : 1} of the 2 in the pin.`,
    '',
    '## Head',
    '',
    '- Fireball (gem, Spell): A fire bolt.',
    `- Frostbolt (gem, Spell): A cold bolt.${frostboltInPin ? '' : ' [not in pin]'}`,
    '',
    '## Body',
    '',
    '### Fireball',
    '- Id: fireball',
    '- Kind: gem',
    '- Tags: Spell',
    '- In pin: yes',
    '',
    '### Frostbolt',
    '- Id: frostbolt',
    '- Kind: gem',
    '- Tags: Spell',
    `- In pin: ${frostboltInPin ? 'yes' : 'no'}`,
    '',
  ].join('\n');

/** A test file of the lane with the real pin's literal values replaced by an invented pin's. */
function withPin(file: string, pin: { tag: string; commit: string; version: string; headlessWrapperSha1: string }): string {
  return read(path.join(LANE, file))
    .split(REAL_PIN.commit).join(pin.commit)
    .split(REAL_PIN.headlessWrapperSha1).join(pin.headlessWrapperSha1)
    .split(`${REAL_PIN.headlessWrapperSha1.slice(0, 7)}…`).join(`${pin.headlessWrapperSha1.slice(0, 7)}…`)
    .split(REAL_PIN.version).join(pin.version);
}

// ------------------------------------------------------------------------------------------------------------
// The fakes: luajit, pnpm and mise

const FAKES: Record<string, string> = {
  luajit: `
const fs = require('fs'), path = require('path');
const log = (e) => fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(e) + '\\n');
const env = Object.fromEntries(['POB_DIRECTORY', 'XDG_STATE_HOME', 'TMPDIR', 'POB_GUIDES_DIRECTORY', 'POESESSID'].map((k) => [k, process.env[k] ?? null]));
const args = process.argv.slice(2);
const version = /number="([^"]+)"/.exec(fs.readFileSync(path.join(process.cwd(), '..', 'manifest.xml'), 'utf8'))[1];
if (args[0].endsWith('pob-internals.lua')) {
  log({ tool: 'probe', args, cwd: process.cwd(), env, version });
  fs.writeFileSync(args[2], fs.readFileSync(path.join(process.env.FAKE_DIR, 'probe-' + version + '.json')));
} else {
  log({ tool: 'candidates', args, cwd: process.cwd(), env, version });
  fs.writeFileSync(args[2], fs.readFileSync(path.join(process.env.FAKE_DIR, 'dump-' + version + '.json')));
}
`,
  pnpm: `
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool: 'pnpm', args, cwd: process.cwd(), poesessid: process.env.POESESSID ?? null }) + '\\n');
if (args[0] === 'build') process.exit(0);
const out = args.find((a) => a.startsWith('--outputFile=')).slice('--outputFile='.length);
const counter = path.join(process.env.FAKE_DIR, 'gate-count');
const n = (fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0) + 1;
fs.writeFileSync(counter, String(n));
const text = fs.readFileSync(path.join(process.env.FAKE_DIR, 'gate-' + n + '.json'), 'utf8').split('<REPO>').join(process.env.FAKE_REPO);
fs.writeFileSync(out, text);
process.exit(JSON.parse(text).success ? 0 : 1);
`,
  mise: `
const fs = require('fs'), { spawnSync } = require('child_process');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool: 'mise', args, cwd: process.cwd(), xdg: process.env.XDG_STATE_HOME ?? null }) + '\\n');
let r;
if (args[0] === 'run' && args[1] === 'pob:fetch') r = spawnSync('bash', ['scripts/fetch-pob.sh'], { stdio: 'inherit' });
else if (args[0] === 'exec' && args[1] === '--') r = spawnSync(args[2], args.slice(3), { stdio: 'inherit' });
else { process.stderr.write('fake mise: ' + args.join(' ') + '\\n'); process.exit(3); }
process.exit(r.status ?? 1);
`,
};

interface Suite {
  file: string;
  tests: { title: string; status: 'passed' | 'failed'; message?: string; ancestors?: string[] }[];
  error?: string;
}

/** Jest's JSON results for the suites, with `<REPO>` for the repository's path. */
function jestResult(suites: Suite[]): string {
  const testResults = suites.map((s) => ({
    name: `<REPO>/${s.file}`,
    status: s.error || s.tests.some((t) => t.status === 'failed') ? 'failed' : 'passed',
    message: s.error ?? '',
    assertionResults: s.tests.map((t) => ({
      ancestorTitles: t.ancestors ?? [],
      title: t.title,
      fullName: [...(t.ancestors ?? []), t.title].join(' '),
      status: t.status,
      failureMessages: t.message ? [t.message] : [],
    })),
  }));
  return JSON.stringify({ success: testResults.every((s) => s.status === 'passed'), testResults }, null, 1);
}

const GOLDEN_DIFF = [
  'expect(received).toEqual(expected) // deep equality',
  '',
  '- Expected  - 2',
  '+ Received  + 2',
  '',
  '  Array [',
  '    "Armour=100",',
  '-   "Life=2977",',
  '-   "Mana=105",',
  '+   "Life=3010",',
  '+   "Mana=110.5",',
  '  ]',
].join('\n');

const pass = (title: string) => ({ title, status: 'passed' as const });
const failed = (title: string, message: string) => ({ title, status: 'failed' as const, message });

function writeFakeData(): void {
  fs.mkdirSync(FAKE, { recursive: true });
  const fn = (file: string, line: number, sha1: string) => ({ type: 'function', file, line, lastLine: line + 3, sha1 });
  const probe1 = {
    version: '0.0.1',
    symbols: {
      new: fn('Modules/Common.lua', 10, 'aaa'),
      'build.skillsTab:ProcessSocketGroup': fn('Classes/SkillsTab.lua', 5, 'bbb'),
      'data.gems': { type: 'table' },
      'build.spec': { type: 'table' },
      'build.characterLevel': { type: 'number' },
    },
  };
  const probe2 = {
    version: '0.0.2',
    symbols: {
      new: fn('Modules/Common.lua', 10, 'aaa'),
      'build.skillsTab:ProcessSocketGroup': fn('Classes/SkillsTab.lua', 9, 'ccc'),
      'data.gems': { type: 'nil', at: 'data.gems' },
      'build.spec': { type: 'function', file: 'Modules/Build.lua', line: 1, lastLine: 2, sha1: 'ddd' },
      'build.characterLevel': { type: 'number' },
    },
  };
  write(path.join(FAKE, 'probe-0.0.1.json'), JSON.stringify(probe1));
  write(path.join(FAKE, 'probe-0.0.2.json'), JSON.stringify(probe2));
  write(path.join(FAKE, 'probe-0.0.3.json'), JSON.stringify({ ...probe2, version: '0.0.3' }));
  const unique = (lines: string[], raw: string) => ({ name: 'Star Clasp', type: 'Amulet', base: 'Gold Amulet', level: 1, lines: lines.map((line) => ({ line })), raw });
  const dump = (lines: string[], raw: string) => ({
    ascendancies: [{ name: 'Infernalist', class: 'Witch' }],
    nodes: [{ id: 1, name: 'Pyromantic Pact', ascendancy: 'Infernalist', lines: ['Life and Mana are one pool'] }],
    uniques: [unique(lines, raw)],
    gems: [],
    legacyGems: [],
    unobtainableUniques: [],
  });
  // v0.0.2 changes the unique's lines; v0.0.3 only reorders its raw text, which isn't compared.
  write(path.join(FAKE, 'dump-0.0.1.json'), JSON.stringify(dump(['+10 to Strength'], 'Star Clasp\nA')));
  write(path.join(FAKE, 'dump-0.0.2.json'), JSON.stringify(dump(['+12 to Strength'], 'Star Clasp\nA')));
  write(path.join(FAKE, 'dump-0.0.3.json'), JSON.stringify(dump(['+12 to Strength'], 'A\nStar Clasp')));

  // Run 1's gate: the main run, the timing run, then the re-run of the failed suites after the retirements.
  const golden = { file: 'tests/integration/golden.test.ts', tests: [failed('AC-F23: all 109 PlayerStat pairs are identical', GOLDEN_DIFF), pass('AC-F24: identical before and after')] };
  const other = { file: 'tests/unit/other.test.ts', tests: [failed('reads the tree', 'expect(received).toBe(expected)\n\nExpected: 1\nReceived: 2')] };
  write(path.join(FAKE, 'gate-1.json'), jestResult([
    { file: 'tests/integration/pg901.test.ts', tests: [pass(CASE[901])] },
    { file: 'tests/integration/pg902.test.ts', tests: [pass(SETUP[902]), failed(CASE[902], 'expect(received).toBe(expected)\n\nExpected: 0\nReceived: 20')] },
    { file: 'tests/integration/pg903.test.ts', tests: [failed(SETUP[903], 'Error: the fixture would not load'), pass(CASE[903])] },
    { file: 'tests/integration/pg904.test.ts', tests: [failed(CASE[904], 'expect(received).toEqual(expected)')] },
    { file: 'tests/integration/pg905.test.ts', tests: [pass(CASE[905])] },
    golden,
    other,
    { file: 'tests/unit/fine.test.ts', tests: [pass('works')] },
  ]));
  write(path.join(FAKE, 'gate-2.json'), jestResult([{ file: 'tests/integration/compilePlanNfr.test.ts', tests: [pass('AC-P37: compiles in time')] }]));
  write(path.join(FAKE, 'gate-3.json'), jestResult([
    { file: 'tests/integration/pg902.test.ts', tests: [failed(SETUP[902], 'Error: no patch PG-902')] },
    { file: 'tests/integration/pg903.test.ts', tests: [failed(SETUP[903], 'Error: the fixture would not load'), pass(CASE[903])] },
    { file: 'tests/integration/pg904.test.ts', tests: [] },
    golden,
    other,
  ]));
  // Runs 2 and 3: nothing fails.
  for (const n of [4, 5, 6, 7]) write(path.join(FAKE, `gate-${n}.json`), jestResult([{ file: 'tests/unit/fine.test.ts', tests: [pass('works')] }]));
}

// ------------------------------------------------------------------------------------------------------------

interface Call {
  tool: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | null>;
  version?: string;
  poesessid?: string | null;
  xdg?: string | null;
}

const calls = (): Call[] => (fs.existsSync(LOG) ? read(LOG).split('\n').filter(Boolean).map((l) => JSON.parse(l) as Call) : []);

function upgrade(...args: string[]) {
  fs.rmSync(LOG, { force: true });
  // Jest's setup points these at its own temporary folders: the script starts without them, as from a shell.
  const { XDG_STATE_HOME, POB_DIRECTORY, POB_GUIDES_DIRECTORY, ...env } = GIT_ENV;
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'pin-upgrade.mjs'), ...args], {
    cwd: TMP,
    env: {
      ...env,
      PATH: [BIN, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter),
      HOME: path.join(TMP, 'home'),
      FAKE_LOG: LOG,
      FAKE_DIR: FAKE,
      FAKE_REPO: REPO,
      POESESSID: 'not-a-cookie',
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

type Json = Record<string, unknown>;
const reportOf = (tag: string) => JSON.parse(read(path.join(VENDOR, '..', '.pin-upgrade', tag, 'pin-upgrade-report.json'))) as Json;
const judgment = (r: Json) => r.judgment as Json[];
const ofKind = (r: Json, kind: string) => judgment(r).filter((j) => j.kind === kind);

const PINS: Record<string, { tag: string; commit: string; version: string; headlessWrapperSha1: string }> = {};
let built = false;

beforeAll(() => {
  built = fs.existsSync(path.join(LANE, 'build', 'engine', 'pinCheck.js'));
  fs.mkdirSync(ORIGIN, { recursive: true });
  git(ORIGIN, 'init', '--quiet', '--initial-branch=main');
  git(ORIGIN, 'config', 'uploadpack.allowFilter', 'true');
  for (const [v, opts] of [['v0.0.1', V1], ['v0.0.2', V2], ['v0.0.3', V3]] as const) {
    const commit = commitTree(tree(opts), v);
    git(ORIGIN, '-c', 'tag.gpgsign=false', 'tag', v);
    PINS[v] = { tag: v, commit, version: opts.version, headlessWrapperSha1: crlfSha1(`-- headless ${opts.version}\n`) };
  }
  git(ORIGIN, 'checkout', '--quiet', '-b', 'dev');
  commitTree({ ...tree(V3), 'src/HeadlessWrapper.lua': '-- dev\n' }, 'dev');
  git(ORIGIN, 'branch', 'v9.9.9');
  git(ORIGIN, 'checkout', '--quiet', 'main');

  const copy = (rel: string) => {
    fs.mkdirSync(path.dirname(path.join(REPO, rel)), { recursive: true });
    fs.copyFileSync(path.join(LANE, rel), path.join(REPO, rel));
  };
  for (const rel of [
    'scripts/pin-upgrade.mjs',
    'scripts/fetch-pob.sh',
    'scripts/patch-fingerprints.mjs',
    'scripts/pob-internals.lua',
    'scripts/pob-internals.symbols.json',
    'scripts/check-construct.lua',
    'skills/game-knowledge/scripts/league-digest.mjs',
    'skills/game-knowledge/scripts/leagues.mjs',
    'skills/game-knowledge/scripts/rules-index.mjs',
    'package.json',
    'data/rules/vocabulary.md',
  ]) copy(rel);
  fs.symlinkSync(path.join(LANE, 'build'), path.join(REPO, 'build'));
  const p1 = PINS['v0.0.1'];
  write(path.join(REPO, 'pob-pin.json'), `${JSON.stringify({ repo: `file://${ORIGIN}`, ...p1 }, null, 2)}\n`);
  write(path.join(REPO, 'tests/fixtures/builds/grenadator.xml'), '<PathOfBuilding2/>\n');
  write(path.join(REPO, 'pob-api/API/Patches.lua'), patchesLua());
  write(path.join(REPO, 'pob-api/API/ParseFixes.lua'), parseFixesLua());
  write(
    path.join(REPO, 'pob-api/API/Trade.lua'),
    [
      '-- PoB\'s currencyTable (TradeQueryGenerator.lua:755-767).',
      'local M = {}',
      '-- PoB keeps only items that parse and fit the slot (FilterToSafeItems, TradeQuery.lua:985-994).',
      '-- Rune and anoint handling, as the "Find best" callback does it (TradeQuery.lua:1040-1068).',
      'return M',
      '',
    ].join('\n'),
  );
  for (const n of [901, 902, 903, 904, 905]) write(path.join(REPO, `tests/integration/pg${n}.test.ts`), testFile(n, n === 904));
  for (const rel of ['tests/unit/pobPin.test.ts', 'tests/integration/protocol.lua.test.ts']) write(path.join(REPO, rel), withPin(rel, p1));
  write(path.join(REPO, 'data/league/embers.md'), DIGEST('the PoB2 pin v0.0.1', false));
  write(path.join(REPO, 'data/rules/nodes.md'), '# Nodes\n\n## Infernalist\n\n- Pyromantic Pact (1, Infernalist) — Life and Mana are one pool.\n\n## Keystones\n\n- Blood Magic (2, keystone) — Mana costs are paid with Life.\n');
  write(path.join(REPO, 'data/rules/uniques.md'), '# Uniques\n\nMost uniques give up the resistances, life and defences a rare provides; a block lists only the penalties its own lines state.\n');
  write(path.join(REPO, 'data/rules/gems.md'), '# Gems\n');
  const join = spawnSync(process.execPath, [path.join(REPO, 'skills/game-knowledge/scripts/rules-index.mjs'), 'join', '--write'], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8' });
  if (join.status !== 0) throw new Error(`the fixture index doesn't join: ${join.stderr}`);

  fs.mkdirSync(BIN, { recursive: true });
  for (const [name, body] of Object.entries(FAKES)) {
    write(path.join(BIN, name), `#!${process.execPath}\n${body}`);
    fs.chmodSync(path.join(BIN, name), 0o755);
  }
  fs.mkdirSync(path.join(TMP, 'home'), { recursive: true });
  writeFakeData();
});

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

describe('AC-W138 (WU-155): scripts/pin-upgrade.mjs on fixtures, no network and no engine (D-508)', () => {
  it('needs the compiled build/ (pinCheck.js), as the script does', () => {
    expect(built).toBe(true);
  });

  it('refuses a branch and a commit, before any step and without writing anything', () => {
    for (const ref of ['dev', PINS['v0.0.2'].commit, 'main']) {
      const r = upgrade(ref);
      expect({ ref, status: r.status, stdout: r.stdout }).toEqual({ ref, status: 2, stdout: '' });
      expect(r.stderr).toContain(`pin-upgrade: refused: "${ref}" isn't a release tag (v<n>.<n>.<n>)`);
      expect(calls()).toEqual([]);
    }
    expect(fs.existsSync(path.join(REPO, 'vendor'))).toBe(false);
    // A branch named like a release isn't a tag: the stage step fails, naming it, and nothing changes.
    const branch = upgrade('v9.9.9');
    expect(branch.status).toBe(1);
    const report = reportOf('v9.9.9');
    expect(report.failed).toEqual({ step: 'stage', error: `v9.9.9 isn't a tag of file://${ORIGIN} (a branch or another ref isn't taken: tagged releases only)` });
    expect(report.done).toEqual([]);
    expect(branch.stdout).toContain('Stopped at stage: v9.9.9 isn\'t a tag');
    expect(JSON.parse(read(path.join(REPO, 'pob-pin.json')))).toEqual({ repo: `file://${ORIGIN}`, ...PINS['v0.0.1'] });
    expect(git(VENDOR, 'rev-parse', 'HEAD')).toBe(PINS['v0.0.1'].commit);
  });

  describe('v0.0.1 to v0.0.2', () => {
    let run: ReturnType<typeof upgrade>;
    let report: Json;
    let log: Call[];

    beforeAll(() => {
      run = upgrade('v0.0.2');
      log = calls();
      report = reportOf('v0.0.2');
    });

    it("exits 0 with every step done, and the report has Appendix A.4's shape", () => {
      expect({ status: run.status, stderrTail: run.status === 0 ? '' : run.stderr.slice(-2000) }).toEqual({ status: 0, stderrTail: '' });
      expect(report.from).toEqual({ tag: 'v0.0.1', commit: PINS['v0.0.1'].commit });
      expect(report.to).toEqual({ tag: 'v0.0.2', commit: PINS['v0.0.2'].commit, version: '0.0.2' });
      expect(report.done).toEqual(['stage', 'probe', 'fingerprints', 'pin', 'fetch', 'skillSlotMethod', 'gate', 'rulesIndex', 'reflag']);
      expect(report.failed).toBeNull();
      expect(Array.isArray(report.judgment)).toBe(true);
      for (const j of judgment(report)) expect(typeof j.kind).toBe('string');
      // In the modules' order: ParseFixes.lua, then Patches.lua.
      expect(report.retired).toEqual([
        { pg: 'PG-904', removed: ['pob-api/API/ParseFixes.lua entry', 'tests/integration/pg904.test.ts: its retirement test'] },
        { pg: 'PG-902', removed: ['pob-api/API/Patches.lua entry', 'tests/integration/pg902.test.ts: its retirement test'] },
      ]);
      expect(typeof report.elapsedMs).toBe('number');
      expect(fs.existsSync(path.join(VENDOR, '..', '.pin-upgrade', 'v0.0.2', 'pob', 'src', 'HeadlessWrapper.lua'))).toBe(true);
      expect(run.stdout).toContain(`Report: ${path.join(VENDOR, '..', '.pin-upgrade', 'v0.0.2', 'pin-upgrade-report.json')}`);
    });

    it('lists a changed fingerprint and retires nothing for it', () => {
      expect(ofKind(report, 'fingerprint')).toEqual([
        expect.objectContaining({ pg: 'PG-901', file: 'Classes/SkillsTab.lua', func: 'function SkillsTabClass:UpdateGlobalGemCountAssignments()' }),
      ]);
      expect(ofKind(report, 'fingerprint')[0].problem).toMatch(/^the code changed/);
      const patches = read(path.join(REPO, 'pob-api/API/Patches.lua'));
      expect(patches).toContain("pg = 'PG-901'");
      expect(read(path.join(REPO, 'tests/integration/pg901.test.ts'))).toBe(testFile(901, false));
    });

    it("removes a patch's entry and its retirement case when that case fails, and re-runs the failed suites once", () => {
      const patches = read(path.join(REPO, 'pob-api/API/Patches.lua'));
      expect(patches).not.toContain('PG-902');
      expect(patches).not.toContain('restorePG902');
      expect(patches).toContain('M.PATCHES = { PG901, PG903 }');
      expect(patches).toContain("pg = 'PG-903'");
      // Only the retirement case goes: the setup case stays.
      const pg902 = read(path.join(REPO, 'tests/integration/pg902.test.ts'));
      expect(pg902).not.toContain(CASE[902]);
      expect(pg902).toBe(["describe('PG-902', () => {", `  it(${JSON.stringify(SETUP[902])}, () => {`, '    expect(1).toBe(1);', '  });', '});', ''].join('\n'));
      // The parse fix's list element goes; the other stays.
      const fixes = read(path.join(REPO, 'pob-api/API/ParseFixes.lua'));
      expect(fixes).not.toContain('PG-904');
      expect(fixes).toContain("pg = 'PG-905'");
      expect(read(path.join(REPO, 'tests/integration/pg904.test.ts'))).toBe("describe('PG-904', () => {\n});\n");
      // The gate: the test task's two Jest commands, then one re-run of the five suites that failed.
      const jest = log.filter((c) => c.tool === 'pnpm' && c.args[0] === 'exec');
      expect(jest.map((c) => c.args.filter((a) => !a.startsWith('--outputFile=')))).toEqual([
        ['exec', 'jest', '--json'],
        ['exec', 'jest', '--runInBand', '--testPathIgnorePatterns', '/node_modules/', '--json', '--', 'tests/integration/compilePlanNfr.test.ts', 'tests/integration/tradeQueryNfr.test.ts'],
        ['exec', 'jest', '--testPathIgnorePatterns', '/node_modules/', '--json', '--', 'tests/integration/pg902.test.ts', 'tests/integration/pg903.test.ts', 'tests/integration/pg904.test.ts', 'tests/integration/golden.test.ts', 'tests/unit/other.test.ts'],
      ]);
      expect((report.steps as Json).gate).toEqual(expect.objectContaining({ retired: ['PG-904', 'PG-902'], rerun: expect.objectContaining({ files: expect.any(Array) }) }));
      expect(ofKind(report, 'retired').map((j) => j.pg)).toEqual(['PG-904', 'PG-902']);
    });

    it("lists a retirement test's other failures and a golden test's figures, old and new, and any other failure as it is", () => {
      expect(ofKind(report, 'retirementTest').map((j) => [j.pg, j.test, j.name])).toEqual([
        ['PG-902', 'tests/integration/pg902.test.ts', SETUP[902]],
        ['PG-903', 'tests/integration/pg903.test.ts', SETUP[903]],
      ]);
      expect(ofKind(report, 'golden')).toEqual([
        { kind: 'golden', test: 'tests/integration/golden.test.ts', stat: 'Life', old: 2977, new: 3010 },
        { kind: 'golden', test: 'tests/integration/golden.test.ts', stat: 'Mana', old: 105, new: 110.5 },
      ]);
      expect(ofKind(report, 'test')).toEqual([{ kind: 'test', test: 'tests/unit/other.test.ts', name: 'reads the tree', message: 'expect(received).toBe(expected)\nExpected: 1\nReceived: 2' }]);
    });

    it("lists Trade.lua's lines when TradeQuery.lua differs, and not construct()'s check while Common.lua doesn't", () => {
      expect(ofKind(report, 'reread')).toEqual([{ kind: 'reread', file: 'pob-api/API/Trade.lua', lines: '3, 4', mirrors: ['Classes/TradeQuery.lua'] }]);
    });

    it("lists the probe's changed symbols: a body, a missing symbol and a changed type", () => {
      expect(ofKind(report, 'symbol')).toEqual([
        { kind: 'symbol', symbol: 'build.spec', change: 'type', old: 'table', new: 'function' },
        { kind: 'symbol', symbol: 'data.gems', change: 'missing', old: 'table' },
        { kind: 'symbol', symbol: 'build.skillsTab:ProcessSocketGroup', change: 'body', old: 'Classes/SkillsTab.lua:5', new: 'Classes/SkillsTab.lua:9' },
      ].sort((a, b) => order(a.symbol) - order(b.symbol)));
    });

    it('its probe and candidates steps get temporary folders, never the repository, and no cookie', () => {
      const probes = log.filter((c) => c.tool === 'probe');
      const candidates = log.filter((c) => c.tool === 'candidates');
      expect(probes.map((c) => [c.cwd, c.version])).toEqual([
        [path.join(VENDOR, 'src'), '0.0.1'],
        [path.join(VENDOR, '..', '.pin-upgrade', 'v0.0.2', 'pob', 'src'), '0.0.2'],
      ]);
      // The candidates: the current pin's before the fetch, the new pin's after it.
      expect(candidates.map((c) => c.version)).toEqual(['0.0.1', '0.0.2']);
      const folders = new Set<string>();
      for (const c of [...probes, ...candidates]) {
        expect(c.env!.POESESSID).toBeNull();
        for (const k of ['POB_DIRECTORY', 'XDG_STATE_HOME', 'TMPDIR', 'POB_GUIDES_DIRECTORY']) {
          const dir = c.env![k]!;
          expect(path.dirname(path.dirname(dir))).toBe(os.tmpdir());
          expect(dir.startsWith(REPO)).toBe(false);
          expect(fs.existsSync(dir)).toBe(false);
          folders.add(dir);
        }
      }
      expect(folders.size).toBe(4 * (probes.length + candidates.length));
      // rules-index boots PoB from its own driver, written in the step's temporary folder.
      for (const c of candidates) expect(c.args[0].startsWith(c.env!.TMPDIR!)).toBe(true);
      // mise never gets a temporary state folder (it would lose its trust), and no fake got the cookie.
      expect(log.filter((c) => c.tool === 'mise').every((c) => c.xdg === null)).toBe(true);
      expect(log.filter((c) => c.tool === 'pnpm').every((c) => c.poesessid === null)).toBe(true);
    });

    it('writes the new pin and its literal values in the tests, and fetches it into vendor/', () => {
      expect(JSON.parse(read(path.join(REPO, 'pob-pin.json')))).toEqual({ repo: `file://${ORIGIN}`, ...PINS['v0.0.2'] });
      for (const rel of ['tests/unit/pobPin.test.ts', 'tests/integration/protocol.lua.test.ts']) {
        expect({ rel, text: read(path.join(REPO, rel)) }).toEqual({ rel, text: withPin(rel, PINS['v0.0.2']) });
      }
      expect(git(VENDOR, 'rev-parse', 'HEAD')).toBe(PINS['v0.0.2'].commit);
    });

    it("writes the new pin's candidates for the agents and lists the entries that differ from the old pin's", () => {
      const stage = path.join(VENDOR, '..', '.pin-upgrade', 'v0.0.2');
      expect(ofKind(report, 'rulesIndex')).toEqual([
        expect.objectContaining({ candidates: 'vendor/.pin-upgrade/v0.0.2/candidates.json', changed: 1, checkProblems: 0 }),
      ]);
      expect(JSON.parse(read(path.join(stage, 'candidates.json'))).uniques[0].lines).toEqual([{ line: '+12 to Strength' }]);
      expect(JSON.parse(read(path.join(stage, 'candidates-changed.json')))).toEqual([{ kind: 'unique', key: 'Star Clasp (Gold Amulet)', change: 'changed' }]);
    });

    it("re-flags each digest offline and lists its changed flags", () => {
      expect(ofKind(report, 'digestFlags')).toEqual([{ kind: 'digestFlags', digest: 'embers.md', changed: 1 }]);
      const digest = read(path.join(REPO, 'data/league/embers.md'));
      expect(digest).toContain('- Frostbolt (gem, Spell): A cold bolt.\n');
      expect(digest).toContain('checked against the PoB2 pin v0.0.2 on ');
      expect(ofKind(report, 'skillSlotMethod')).toEqual([]);
      expect(ofKind(report, 'treeVersion')).toEqual([]);
    });
  });

  describe('v0.0.2 to v0.0.3', () => {
    let run: ReturnType<typeof upgrade>;
    let report: Json;

    beforeAll(() => {
      run = upgrade('v0.0.3');
      report = reportOf('v0.0.3');
    });

    it("lists construct()'s check when Common.lua differs, and not Trade.lua while its files don't", () => {
      expect(run.status).toBe(0);
      expect(ofKind(report, 'reread')).toEqual([
        {
          kind: 'reread',
          file: 'scripts/check-construct.lua',
          check: "pob-api/API/Util.lua's construct()",
          run: 'cd vendor/PathOfBuilding-PoE2/src && luajit ../../../scripts/check-construct.lua',
          mirrors: ['Modules/Common.lua'],
        },
      ]);
    });

    it('lists a missing skill-slot method, its warning gone, and the newer tree; with no failure, nothing retires and nothing re-runs', () => {
      expect(ofKind(report, 'skillSlotMethod')).toEqual([expect.objectContaining({ file: 'Classes/SkillsTab.lua', method: 'SkillsTabClass:UpdateGlobalGemCountAssignments' })]);
      expect(ofKind(report, 'skillSlotWarning')).toEqual([expect.objectContaining({ file: 'Modules/Build.lua', text: 'You have too many gem groups allocated' })]);
      expect(ofKind(report, 'treeVersion')).toEqual([{ kind: 'treeVersion', old: '0_5', new: '0_6', literal: 'scripts/check-construct.lua' }]);
      expect(ofKind(report, 'fingerprint').map((j) => [j.pg, j.problem])).toEqual([['PG-901', 'function SkillsTabClass:UpdateGlobalGemCountAssignments() is missing']]);
      expect(report.retired).toEqual([]);
      expect((report.steps as Json).gate).toEqual(expect.objectContaining({ retired: [], rerun: null, judgment: 0 }));
      // The digest is written for the pin's new label, but no flag changed: not a judgment item.
      expect(ofKind(report, 'digestFlags')).toEqual([]);
      expect(((report.steps as Json).reflag as Json).digests).toEqual({ 'embers.md': { written: true, changed: 0 } });
      // A raw text reordered isn't a changed candidate.
      expect(ofKind(report, 'rulesIndex')).toEqual([]);
    });
  });

  describe('v0.0.3 to v0.0.3, the dry run', () => {
    it('exits 0, lists no judgment item, and leaves the pin, the tests and the digest as they were', () => {
      const files = ['pob-pin.json', 'tests/unit/pobPin.test.ts', 'tests/integration/protocol.lua.test.ts', 'data/league/embers.md', 'pob-api/API/Patches.lua', 'pob-api/API/ParseFixes.lua'];
      const before = Object.fromEntries(files.map((f) => [f, read(path.join(REPO, f))]));
      const run = upgrade('v0.0.3');
      expect(run.status).toBe(0);
      const report = reportOf('v0.0.3');
      // v0.0.3's own items stay (its renamed method, its tree), as on any re-run; the dry run's tree has none of them.
      expect(judgment(report).filter((j) => !['skillSlotMethod', 'skillSlotWarning', 'treeVersion', 'fingerprint'].includes(j.kind as string))).toEqual([]);
      expect(report.from).toEqual({ tag: 'v0.0.3', commit: PINS['v0.0.3'].commit });
      expect(((report.steps as Json).pin as Json).wrote).toEqual([]);
      expect(((report.steps as Json).reflag as Json).digests).toEqual({ 'embers.md': { written: false, changed: 0 } });
      expect(Object.fromEntries(files.map((f) => [f, read(path.join(REPO, f))]))).toEqual(before);
    });
  });
});

/** The symbol list's order, which the report follows. */
function order(symbol: string): number {
  const list = JSON.parse(read(path.join(LANE, 'scripts', 'pob-internals.symbols.json'))) as { groups: Record<string, string[]> };
  return Object.values(list.groups).flat().indexOf(symbol);
}
