/**
 * AC-W159 (WU-166, amendment 16 §19, D-523; C-66), the script and Node halves of the overlay. No request leaves the
 * machine: `--from` runs load a module that makes `fetch` throw, and the `--running` runs a stub that serves the fixture
 * pages and logs each request and wait.
 *
 * - The sidecar (Appendix A.11) from fixture pages: each socketable's `type`, `rank`, `socketBound`, slot keys from
 *   `data/league/rune-slots.json`, lines (bonded and split) and `statOrder`s (the pin's for a known line, a fresh one
 *   above the pin's largest, fixed by the text, for any other); a unique's ranges; the entries it can't add, listed.
 * - `--reflag` reports the sidecar's entries the pin now defines (retired).
 * - `pob2-league-digest --running --out <league folder>`, in a temporary plugin layout (the game-knowledge scripts and a
 *   `data/league/` of the test's): nothing read when the newest running digest records its end; the homepage read once a
 *   UTC day when the newest records none; each running league without a digest fetched at D-497's pace (serial, 3 s
 *   apart, no cookie) into the league folder, with its sidecar and pages there, and nothing written elsewhere.
 * - A user-side digest reaches `pob2-run-log init` (the log's `digest` and `leagueFolder`) and the header's `digests:`
 *   line; `resume` reads the folder from the log; `leagues.mjs --league` prints the same; a committed digest wins.
 * - The server's sidecar list (`src/services/leagueOverlay.ts`): a committed sidecar replaces a user-side one of the same
 *   name; the list's key moves with a file's time; a stage's overlay names, the retired ones left out.
 * - The marks: `render-audit.mjs` and the design and final displays say "measured with <name>'s lines from poe2db, not in
 *   PoB's release" for a record's `overlay`, with the overlay's limits.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { TEST_NOW } from '../helpers/runningDigests';
import { listSidecars, overlayItemNames, sidecarKey, stageOverlayNames, overlayFolders, leagueFolderOf } from '../../src/services/leagueOverlay';

const REPO = path.resolve(__dirname, '..', '..');
const GK_SCRIPTS = path.join(REPO, 'skills', 'game-knowledge', 'scripts');
const SCRIPT = path.join(GK_SCRIPTS, 'league-digest.mjs');
const RUN_LOG = path.join(REPO, 'skills', 'build-guide', 'scripts', 'run-log.mjs');
const RENDER = path.join(REPO, 'skills', 'build-guide', 'scripts', 'render-audit.mjs');
const LEAGUE_FIXTURES = path.join(REPO, 'tests', 'fixtures', 'poe2db', 'league');
const OVERLAY_FIXTURES = path.join(REPO, 'tests', 'fixtures', 'poe2db', 'overlay');
const SLOTS = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'league', 'rune-slots.json'), 'utf8')).labels as Record<string, string[]>;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'league-overlay-unit-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
let dirs = 0;
const newDir = (name: string) => {
  const dir = path.join(TMP, `${name}-${++dirs}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;

const NO_NETWORK = path.join(TMP, 'no-network.mjs');
fs.writeFileSync(NO_NETWORK, "globalThis.fetch = () => { throw new Error('the test forbids the network'); };\n");
/** The stub for `--running`: fixture pages by URL, each request and wait logged; waits fire at once. */
const STUB = path.join(TMP, 'stub-fetch.mjs');
fs.writeFileSync(
  STUB,
  `import fs from 'node:fs';
import path from 'node:path';
const log = (entry) => fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(entry) + '\\n');
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => { log({ wait: ms }); return realSetTimeout(fn, 0, ...args); };
globalThis.fetch = async (url, init = {}) => {
  log({ url: String(url), headers: init.headers });
  const name = String(url) === 'https://poe2db.tw/us/' ? 'home.html' : String(url).slice('https://poe2db.tw/us/'.length) + '.html';
  const file = path.join(process.env.STUB_PAGES, name);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file, 'utf8'), { status: 200 }) : new Response('not found', { status: 404 });
};
`,
);

/** The pages a `--from` run reads: the league fixtures' homepage and Embers of Tarn pages, and Saltmarsh Rites' items. */
function pages(): string {
  const dir = newDir('pages');
  for (const f of fs.readdirSync(LEAGUE_FIXTURES).filter((n) => n.endsWith('.html'))) fs.copyFileSync(path.join(LEAGUE_FIXTURES, f), path.join(dir, f));
  fs.copyFileSync(path.join(OVERLAY_FIXTURES, 'Saltmarsh_Rites_items.html'), path.join(dir, 'Saltmarsh_Rites_items.html'));
  return dir;
}

/** A pin name list with the pin's rune lines the sidecar's statOrders read (`--pin-names`). */
function pinNames(extra: Json = {}): string {
  const base = read(path.join(LEAGUE_FIXTURES, 'pin-names.json'));
  const file = path.join(newDir('pin'), 'pin-names.json');
  fs.writeFileSync(file, JSON.stringify({ ...base, statOrders: { '+20 to maximum Life': 887, '+22% to Cold Resistance': 1015 }, maxStatOrder: 10000, ...extra }));
  return file;
}

function run(script: string, args: string[], opts: { preload?: string; env?: Record<string, string>; cwd?: string } = {}) {
  const node = opts.preload ? ['--import', pathToFileURL(opts.preload).href] : [];
  const r = spawnSync(process.execPath, [...node, script, ...args], { cwd: opts.cwd ?? TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C', ...opts.env }, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('AC-W159: the sidecar, from fixture pages (Appendix A.11)', () => {
  const out = newDir('out');
  const r = run(SCRIPT, ['Saltmarsh_Rites', '--from', pages(), '--out', out, '--pin-names', pinNames()], { preload: NO_NETWORK });
  const sidecar = () => read(path.join(out, 'saltmarsh-rites.overlay.json'));
  const core = () => sidecar().socketables.find((s: Json) => s.name === "Brinewarden's Soul Core of Tides");
  const rune = () => sidecar().socketables.find((s: Json) => s.name === 'Perfect Tidal Rune');

  it('writes <slug>.overlay.json beside the digest, in its schema, naming its league and fetch date', () => {
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(fs.readdirSync(out).sort()).toEqual(['saltmarsh-rites.md', 'saltmarsh-rites.overlay.json']);
    const s = sidecar();
    expect(Object.keys(s)).toEqual(['schemaVersion', 'league', 'fetched', 'socketables', 'uniques', 'skipped']);
    expect(s.schemaVersion).toBe(1);
    expect(s.league).toBe('Saltmarsh Rites');
    expect(s.fetched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.stdout).toContain('saltmarsh-rites.overlay.json: the overlay adds 3 socketables and 0 uniques.');
  });

  it("gives each socketable PoB's type from its name, its level as rank, and Socket-bound", () => {
    expect(sidecar().socketables.map((s: Json) => [s.name, s.type, s.rank, s.socketBound])).toEqual([
      ["Brinewarden's Soul Core of Tides", 'SoulCore', [50], false],
      ['Perfect Tidal Rune', 'Rune', [50], false],
      ['Idol of the Saltmarsh', 'Idol', [30], true],
    ]);
  });

  it('maps each slot label to the table\'s PoB keys, keeps a bonded line\'s prefix and splits stats poe2db joins', () => {
    expect(core().slots).toEqual([{ label: 'Helmets', keys: SLOTS.Helmets, lines: ['+60 to maximum Life'], statOrder: [887] }]);
    expect(rune().slots.map((s: Json) => [s.label, s.keys, s.lines])).toEqual([
      ['Martial Weapon', ['weapon'], ['Adds 8 to 14 Cold Damage']],
      ['Wand or Staff', ['wand', 'staff'], ['Gain 9% of Damage as Extra Cold Damage']],
      ['Armour', ['armour'], ['+18% to Cold Resistance', 'Bonded: +15 to maximum Life', 'Bonded: +15 to maximum Mana']],
    ]);
  });

  it("gives each line the pin's statOrder for a line of the same text, else a fresh one above the pin's largest, fixed by its text", () => {
    const armour = rune().slots[2];
    // "+18% to Cold Resistance" and "Bonded: +15 to maximum Life" strip to pin lines; "+15 to maximum Mana" doesn't.
    expect(armour.statOrder.slice(0, 2)).toEqual([1015, 887]);
    const fresh = [armour.statOrder[2], rune().slots[0].statOrder[0], rune().slots[1].statOrder[0]];
    for (const n of fresh) expect(n).toBeGreaterThan(10000);
    expect(new Set(fresh).size).toBe(3);
    // The same text, in another run, gets the same number.
    const again = newDir('out');
    run(SCRIPT, ['Saltmarsh_Rites', '--from', pages(), '--out', again, '--pin-names', pinNames()], { preload: NO_NETWORK });
    expect(read(path.join(again, 'saltmarsh-rites.overlay.json')).socketables[1].slots[0].statOrder).toEqual(rune().slots[0].statOrder);
  });

  it('skips and lists a socketable whose label the table lacks', () => {
    expect(sidecar().skipped).toEqual([{ name: "Brinewarden's Soul Core of Nets", reason: "label 'Nets' has no PoB key" }]);
    expect(r.stdout).toContain("league-digest: not in the overlay (1): Brinewarden's Soul Core of Nets (label 'Nets' has no PoB key).");
  });

  it("writes a unique on a pin base with PoB's ranges, and skips one on a base the pin lacks, a gem and a passive", () => {
    const names = read(path.join(LEAGUE_FIXTURES, 'pin-names.json'));
    const pin = pinNames({ unique: names.unique.filter((n: string) => n !== 'Tarn’s Clasp'), item: [...names.item, 'Coral Ring'] });
    const o = newDir('out');
    const e = run(SCRIPT, ['Embers_of_Tarn', '--from', pages(), '--out', o, '--pin-names', pin], { preload: NO_NETWORK });
    expect(e.code).toBe(0);
    const s = read(path.join(o, 'embers-of-tarn.overlay.json'));
    expect(s.uniques).toEqual([
      { name: "Tarn's Clasp", base: 'Coral Ring', level: 30, implicits: ['+(8-12)% to Fire Resistance'], explicits: ['+(5-10) to Strength', 'Fire Skills which create Ground Surfaces count', 'as creating Ignited Ground'] },
    ]);
    expect(s.skipped).toEqual([
      { name: 'Tarnished Infusion', reason: 'a gem: only a PoB release adds gems' },
      { name: 'Echoes', reason: "its base Opal isn't in the pin" },
      { name: 'Rune of Smouldering', reason: "label 'Spear or Flail' has no PoB key" },
      { name: 'Kindled Resolve', reason: 'a passive: only a PoB release adds passives' },
    ]);
  });

  it('--reflag reports the sidecar\'s entries the pin now defines, which retire', () => {
    const r2 = run(SCRIPT, ['--reflag', 'saltmarsh-rites', '--out', out, '--pin-names', pinNames({ socketable: ['Perfect Tidal Rune'], item: ['Perfect Tidal Rune'] })], { preload: NO_NETWORK });
    expect(r2.code).toBe(0);
    expect(r2.stdout).toContain('Overlay entries the pin now defines, retired (1): Perfect Tidal Rune.\n');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// --running, in a temporary plugin layout

const FIXTURE_NOW = '2026-10-10T12:00Z';
const digestText = (line: string) => `# League digest: x\n\n${line}\n\nA body.\n`;
const EMBERS_LINE = 'Embers of Tarn (Sunken Crowns 0.9) on poe2db.tw, fetched 2026-08-02. League: from 2026-08-01 20:00 UTC until 2026-12-04 20:00 UTC. In-pin flags: checked against x on 2026-08-02.';
const SALTMARSH_NO_END = 'Saltmarsh Rites (0.9.1) on poe2db.tw, fetched 2026-10-03. League: from 2026-10-02 20:00 UTC until no end announced. In-pin flags: checked against x on 2026-10-03.';

/** A plugin root of its own: the game-knowledge scripts, package.json and a data/league/ holding `committed`. */
function layout(committed: Record<string, string>) {
  const root = newDir('root');
  fs.cpSync(GK_SCRIPTS, path.join(root, 'skills', 'game-knowledge', 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'package.json'), path.join(root, 'package.json'));
  const data = path.join(root, 'data', 'league');
  fs.mkdirSync(data, { recursive: true });
  fs.copyFileSync(path.join(REPO, 'data', 'league', 'rune-slots.json'), path.join(data, 'rune-slots.json'));
  for (const [name, line] of Object.entries(committed)) fs.writeFileSync(path.join(data, name), digestText(line));
  const league = path.join(newDir('state'), 'league');
  const log = path.join(newDir('log'), 'requests.jsonl');
  fs.writeFileSync(log, '');
  return { root, data, league, log, script: path.join(root, 'skills', 'game-knowledge', 'scripts', 'league-digest.mjs') };
}

function treeOf(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(`${path.relative(dir, p)} ${fs.statSync(p).mtimeMs}`);
    }
  };
  walk(dir);
  return out.sort();
}

function running(l: ReturnType<typeof layout>, now = FIXTURE_NOW) {
  const r = run(l.script, ['--running', '--out', l.league, '--pin-names', pinNames()], { preload: STUB, env: { STUB_LOG: l.log, STUB_PAGES: pages(), BUILD_GUIDE_TEST_NOW: now } });
  const entries = fs.readFileSync(l.log, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x) as Json);
  fs.writeFileSync(l.log, '');
  return { ...r, requests: entries.filter((e) => e.url).map((e) => e.url as string), headers: entries.filter((e) => e.url).map((e) => e.headers), waits: entries.filter((e) => e.wait !== undefined).map((e) => e.wait as number) };
}

describe('AC-W159: pob2-league-digest --running --out <league folder> (D-523)', () => {
  it('reads nothing when the newest running digest records its end', () => {
    const l = layout({ 'embers-of-tarn.md': EMBERS_LINE });
    const r = running(l);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(r.requests).toEqual([]);
    expect(r.stdout).toContain('the newest records its end: poe2db isn\'t read');
    expect(fs.existsSync(l.league)).toBe(false);
  });

  it('with no running digest, reads the cards and fetches each running league without one, serially and 3 s apart with no cookie, writing only its league folder', () => {
    const l = layout({});
    const before = treeOf(l.root);
    const r = running(l);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    // The homepage once, then the running leagues' list pages (0.9 and 0.9.1 at the instant; 1.0 hasn't started).
    expect(r.requests).toEqual([
      'https://poe2db.tw/us/',
      'https://poe2db.tw/us/Embers_of_Tarn_gems',
      'https://poe2db.tw/us/Embers_of_Tarn_uniques',
      'https://poe2db.tw/us/Embers_of_Tarn_items',
      'https://poe2db.tw/us/Saltmarsh_Rites_items',
    ]);
    expect(r.waits).toEqual([3000, 3000, 3000, 3000]);
    for (const h of r.headers) {
      expect(Object.keys(h).sort()).toEqual(['Accept', 'User-Agent']);
      expect(h['User-Agent']).toMatch(/^pob2-mcp-server\//);
    }
    expect(fs.readdirSync(l.league).sort()).toEqual(['embers-of-tarn.md', 'embers-of-tarn.overlay.json', 'pages', 'saltmarsh-rites.md', 'saltmarsh-rites.overlay.json']);
    expect(fs.readdirSync(path.join(l.league, 'pages')).sort()).toEqual(['Embers_of_Tarn_gems.html', 'Embers_of_Tarn_items.html', 'Embers_of_Tarn_uniques.html', 'Saltmarsh_Rites_items.html', 'home.html']);
    // Nothing outside the league folder moved.
    expect(treeOf(l.root)).toEqual(before);
    expect(fs.readFileSync(path.join(l.league, 'saltmarsh-rites.md'), 'utf8').split('\n')[2]).toContain('League: from 2026-10-02 20:00 UTC until 2026-12-04 20:00 UTC.');
  });

  it('reads the cards at most once a UTC day when the newest records no end, and fetches no league that has a digest', () => {
    const l = layout({ 'embers-of-tarn.md': EMBERS_LINE, 'saltmarsh-rites.md': SALTMARSH_NO_END });
    const first = running(l);
    expect(first.code).toBe(0);
    expect(first.requests).toEqual(['https://poe2db.tw/us/']);
    // The day's homepage, kept in the league folder, is read again that UTC day, not fetched.
    const home = path.join(l.league, 'pages', 'home.html');
    const at = new Date(Date.parse(FIXTURE_NOW));
    fs.utimesSync(home, at, at);
    expect(running(l).requests).toEqual([]);
    expect(running(l, '2026-10-10T23:59Z').requests).toEqual([]);
    // The next UTC day, once more.
    expect(running(l, '2026-10-11T00:01Z').requests).toEqual(['https://poe2db.tw/us/']);
    // A committed digest is never rewritten: only the league folder is written.
    expect(fs.readFileSync(path.join(l.data, 'saltmarsh-rites.md'), 'utf8')).toBe(digestText(SALTMARSH_NO_END));
  });

  it('names a running league that still has no digest, and refuses a bad command line', () => {
    const l = layout({});
    const stubPages = pages();
    fs.rmSync(path.join(stubPages, 'Saltmarsh_Rites_items.html'));
    const r = run(l.script, ['--running', '--out', l.league, '--pin-names', pinNames()], { preload: STUB, env: { STUB_LOG: l.log, STUB_PAGES: stubPages, BUILD_GUIDE_TEST_NOW: FIXTURE_NOW } });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('league-digest: a running league has no digest: Marsh Festival (0.9.1): https://poe2db.tw/us/Saltmarsh_Rites_items: HTTP 404');
    expect(fs.existsSync(path.join(l.league, 'embers-of-tarn.md'))).toBe(true);
    expect(run(l.script, ['--running'], { preload: NO_NETWORK }).code).toBe(2);
    expect(run(l.script, ['--running', 'Embers_of_Tarn', '--out', l.league], { preload: NO_NETWORK }).code).toBe(2);
  });

  it('offline nothing runs it: the runner says the new league\'s items aren\'t in the committed data (start.md)', () => {
    const start = fs.readFileSync(path.join(REPO, 'skills', 'build-guide', 'references', 'start.md'), 'utf8').replace(/\s+/g, ' ');
    expect(start).toContain('online and not under `--test`, run `pob2-league-digest --running --out <leagueFolder>`');
    expect(start).toContain("Offline, nothing is fetched: say once that a new league's items aren't in the committed data.");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The readers: init, resume and leagues.mjs

describe("AC-W159: a user-side digest reaches init and the header's digests (C-59)", () => {
  const league = newDir('league');
  fs.writeFileSync(path.join(league, 'saltmarsh-rites.md'), digestText('Saltmarsh Rites (0.9.1) on poe2db.tw, fetched 2026-11-01. League: from 2026-11-01 20:00 UTC until no end announced. In-pin flags: checked against x on 2026-11-01.'));
  // A user-side copy of a committed digest's file loses to the committed one.
  fs.writeFileSync(path.join(league, 'forbidden-rites.md'), digestText('Forbidden Rites (0.5.5) on poe2db.tw, fetched 2026-11-02. League: from 2026-11-02 20:00 UTC until no end announced. In-pin flags: x.'));
  const env = { BUILD_GUIDE_TEST_NOW: TEST_NOW };

  it('init records the league folder and its running digests, newest first, the committed one winning; resume reads the folder from the log', () => {
    const runFolder = newDir('run');
    const entry = { slug: 'open', brief: {}, mode: 'online', testConfig: 'none', noNinja: false, leagueFolder: league };
    const r = run(RUN_LOG, [runFolder, 'init', JSON.stringify(entry)], { env });
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const log = read(path.join(runFolder, 'run-log.json'));
    expect(log.digest).toEqual(['saltmarsh-rites.md', 'forbidden-rites.md', 'runes-of-aldur.md']);
    expect(log.leagueFolder).toBe(league);
    const digests = `digests: ${JSON.stringify([path.join(league, 'saltmarsh-rites.md'), 'data/league/forbidden-rites.md', 'data/league/runes-of-aldur.md'])}`;
    expect(r.stdout.split('\n')[1]).toBe(digests);
    const resumed = run(RUN_LOG, [runFolder, 'resume', '{"noNinja":false}'], { env });
    expect(resumed.stdout.split('\n')[1]).toBe(digests);
    expect(read(path.join(runFolder, 'run-log.json')).resumes[0].digest).toEqual(log.digest);
    // leagues.mjs --league prints the same.
    const leagues = run(path.join(GK_SCRIPTS, 'leagues.mjs'), ['--at', TEST_NOW, '--league', league]);
    expect(leagues.stdout.split('\n')[0]).toBe(digests);
    // A league folder that isn't absolute is refused.
    expect(run(RUN_LOG, [newDir('run'), 'init', JSON.stringify({ ...entry, leagueFolder: 'state/league' })], { env }).stderr).toContain('leagueFolder is "state/league"; the league folder guide_run {new_run} names, an absolute path (D-523)');
  });

  it('a pipeline fixture run (no league folder) records the committed digests alone, as before', () => {
    const runFolder = newDir('run');
    const r = run(RUN_LOG, [runFolder, 'init', JSON.stringify({ slug: 'open', brief: {}, mode: 'offline', testConfig: 'none', noNinja: false })], { env });
    expect(r.code).toBe(0);
    const log = read(path.join(runFolder, 'run-log.json'));
    expect(log.digest).toEqual(['forbidden-rites.md', 'runes-of-aldur.md']);
    expect('leagueFolder' in log).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The server's sidecar list

describe("AC-W159: the server's sidecar list (src/services/leagueOverlay.ts)", () => {
  const sidecar = (name: string, extra: Json = {}) => ({ schemaVersion: 1, league: 'L', fetched: '2026-11-09', socketables: [{ name, type: 'SoulCore', rank: [50], socketBound: false, slots: [] }], uniques: [], skipped: [], ...extra });

  it('lists every sidecar of both folders, a committed one replacing a user-side one of the same name; the key moves with a time', () => {
    const committed = newDir('committed');
    const user = newDir('user');
    fs.writeFileSync(path.join(committed, 'a.overlay.json'), JSON.stringify(sidecar('Committed Core')));
    fs.writeFileSync(path.join(user, 'a.overlay.json'), JSON.stringify(sidecar('User Core')));
    fs.writeFileSync(path.join(user, 'b.overlay.json'), JSON.stringify(sidecar('Other Core')));
    fs.writeFileSync(path.join(user, 'b.md'), 'not a sidecar');
    const list = listSidecars([committed, user, path.join(TMP, 'no-such-folder')]);
    expect(list.map((s) => s.path)).toEqual([path.join(committed, 'a.overlay.json'), path.join(user, 'b.overlay.json')]);
    const key = sidecarKey(list);
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(user, 'b.overlay.json'), later, later);
    expect(sidecarKey(listSidecars([committed, user]))).not.toBe(key);
    // The names the overlay adds, less the ones the pin defines (a fake pin source).
    const pob = newDir('pob');
    fs.mkdirSync(path.join(pob, 'Data', 'Uniques'), { recursive: true });
    fs.writeFileSync(path.join(pob, 'Data', 'ModRunes.lua'), 'return {\n\t["Other Core"] = {\n\t},\n}\n');
    expect([...overlayItemNames(listSidecars([committed, user]), pob)]).toEqual(['Committed Core']);
  });

  it("the folders are data/league/ and <stateDir>/league; a stage's overlay names come from its Rune: lines and its uniques' names", () => {
    expect(overlayFolders('/state', '/plugin')).toEqual([path.join('/plugin', 'data', 'league'), path.join('/state', 'league')]);
    expect(leagueFolderOf('/state')).toBe(path.join('/state', 'league'));
    const names = new Set(['Tidal Core', 'Saltmarsh Loop']);
    const stage = {
      items: {
        slots: [
          { text: 'Rarity: Rare\nX\nSorcerous Tiara\nSockets: S S\nRune: Tidal Core\nRune: Iron Rune\n{rune}+1 to maximum Life' },
          { text: 'Rarity: UNIQUE\nSaltmarsh Loop\nGold Ring\n+30 to maximum Life' },
          { text: 'Rarity: Rare\nY\nGold Ring\nRune: Tidal Core' },
        ],
        treeJewels: [],
      },
    };
    expect(stageOverlayNames(stage, names)).toEqual(['Tidal Core', 'Saltmarsh Loop']);
    expect(stageOverlayNames(stage, new Set())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The marks

describe("AC-W159: the marks' wording in the audit and the design and final displays", () => {
  const MARK = "Brinewarden's Soul Core of Tides: measured with Brinewarden's Soul Core of Tides's lines from poe2db, not in PoB's release.";

  function copyRun() {
    const dir = path.join(newDir('run'), 'run-a14');
    fs.cpSync(path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-a14'), dir, { recursive: true });
    const rec = path.join(dir, 'builds', 'r1-a-2', 'compile-record.json');
    const record = read(rec);
    record.stages.b.overlay = ["Brinewarden's Soul Core of Tides"];
    fs.writeFileSync(rec, `${JSON.stringify(record, null, 2)}\n`);
    return dir;
  }

  it("render-audit's What PoB doesn't model names the stage's overlay item and the overlay's limits", () => {
    const dir = copyRun();
    const r = run(RENDER, [dir, '--build', 'r1-a-2']);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const audit = fs.readFileSync(path.join(dir, 'builds', 'r1-a-2', 'audit.md'), 'utf8');
    const gaps = audit.slice(audit.indexOf("## What PoB doesn't model"), audit.indexOf('## Inputs by confidence'));
    expect(gaps).toContain(`- Stage b: ${MARK}`);
    expect(gaps).toContain("- The overlay's limits: a line PoB doesn't parse stays unmeasured (check_model_coverage reports it); an item on a base the pin lacks can't load;");
  });

  it('the design and final displays carry the same mark and limits; without overlay they carry none', () => {
    const dir = copyRun();
    const design = run(RUN_LOG, [dir, 'display', 'design', '--build', 'r1-a-2']);
    expect(design.code).toBe(0);
    expect(design.stdout).toContain("Not in PoB's release:\n");
    expect(design.stdout).toContain(MARK);
    expect(design.stdout).toContain("- The overlay's limits: ");
    const final = run(RUN_LOG, [dir, 'display', 'final', '--build', 'r1-a-2']);
    expect(final.code).toBe(0);
    expect(final.stdout).toContain(MARK);
    const plain = path.join(newDir('run'), 'run-a14');
    fs.cpSync(path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-a14'), plain, { recursive: true });
    expect(run(RUN_LOG, [plain, 'display', 'design', '--build', 'r1-a-2']).stdout).not.toContain("Not in PoB's release");
  });
});
