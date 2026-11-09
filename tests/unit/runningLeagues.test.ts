/**
 * AC-W130 (WU-151, amendment 16 §3, D-507; C-59): running leagues, each script spawned as a real `node` process with an
 * explicit env, on fixture digests and temporary copies of the committed ones.
 *
 * - `skills/game-knowledge/scripts/leagues.mjs`'s `runningDigests(folders, now)` on five fixture digests (ended, running
 *   with an end, running with none, not started, undated) at set instants: between the later start and the end the two
 *   running ones, the later start first; at the end instant only the one with no end; never the other two. With two
 *   folders a committed digest replaces a user-side one of the same name. `leagues.mjs --at` prints the same list.
 * - On a temporary copy of the committed digests: both at 2026-12-11 19:59 UTC, `forbidden-rites.md` first; none at
 *   20:00, the instant both 0.5 leagues end and 1.0 starts.
 * - With the test clock (`BUILD_GUIDE_TEST_NOW`), `init` and `resume` at skill revision 15 record the list; a revision-14
 *   log resumed at 15 keeps its top-level string and records a list in its new entry, and D-415's line compares them
 *   (two lists as sets, a string with a list's first entry); the checker accepts each form where its revision puts it,
 *   and a revision-14 fixture run passes unchanged.
 *
 * The expected lists come from the tests' own reading of the rule (`tests/helpers/runningDigests.ts`) or are written out.
 * check-run loads the server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { digestReport, runningDigests as ownRule } from '../helpers/runningDigests';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const LEAGUES = path.join(REPO, 'skills', 'game-knowledge', 'scripts', 'leagues.mjs');
const RUN_LOG = path.join(REPO, 'skills', 'build-guide', 'scripts', 'run-log.mjs');
const CHECKER = path.join(REPO, 'skills', 'build-guide', 'scripts', 'check-run.mjs');
const PIPELINE = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const COMMITTED = path.join(REPO, 'data', 'league');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'running-leagues-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, args, { cwd: TMP, env: { ...ENV, ...env }, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
let dirs = 0;
const newDir = (name: string) => {
  const dir = path.join(TMP, `${name}-${++dirs}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const at = (iso: string) => Date.parse(iso);

/** The module's `runningDigests(folders, now)`, called in a child: each digest's name and path, in order. */
function moduleRule(folders: string[], now: string): Array<{ name: string; path: string }> {
  const code = `import { runningDigests } from ${JSON.stringify(pathToFileURL(LEAGUES).href)}; console.log(JSON.stringify(runningDigests(JSON.parse(process.argv[1]), process.argv[2]).map((d) => ({ name: d.name, path: d.path }))));`;
  const r = node(['--input-type=module', '-e', code, JSON.stringify(folders), now]);
  expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
  return JSON.parse(r.stdout);
}

/** A digest's first three lines and a body line, its third line `<Name> (<label>) on poe2db.tw, fetched <date>.[ <league>] In-pin flags: …`. */
function digest(folder: string, file: string, label: string, league: string | null): string {
  const name = file.replace(/\.md$/, '');
  fs.writeFileSync(path.join(folder, file), `# League digest: ${name}\n\n${name} (${label}) on poe2db.tw, fetched 2026-11-01. ${league ? `${league} ` : ''}In-pin flags: checked against the fixture list on 2026-11-01.\n\nA body line.\n`);
  return path.join(folder, file);
}

/** The five fixture digests D-507's rule tells apart. */
function fiveDigests(folder: string) {
  digest(folder, 'ended.md', '0.3', 'League: from 2026-01-09 20:00 UTC until 2026-04-03 20:00 UTC.');
  digest(folder, 'running-with-end.md', '0.5.5', 'League: from 2026-09-04 20:00 UTC until 2026-12-11 20:00 UTC.');
  digest(folder, 'running-no-end.md', '0.5', 'League: from 2026-05-29 20:00 UTC until no end announced.');
  digest(folder, 'not-started.md', '1.1', 'League: from 2027-03-05 20:00 UTC until no end announced.');
  digest(folder, 'undated.md', '0.4', null);
  fs.writeFileSync(path.join(folder, 'running-with-end.rule-changers.json'), '{"ruleChangers": {}}\n');
}

/** A temporary plugin layout: leagues.mjs at its path and `data/league/` holding what `fill` writes. */
function layout(fill: (league: string) => void): string {
  const root = newDir('root');
  fs.mkdirSync(path.join(root, 'skills', 'game-knowledge', 'scripts'), { recursive: true });
  fs.copyFileSync(LEAGUES, path.join(root, 'skills', 'game-knowledge', 'scripts', 'leagues.mjs'));
  fs.mkdirSync(path.join(root, 'data', 'league'), { recursive: true });
  fill(path.join(root, 'data', 'league'));
  return root;
}

describe('AC-W130 (WU-151, D-507): runningDigests(folders, now), the one rule', () => {
  const folder = newDir('five');
  fiveDigests(folder);
  const names = (now: string) => moduleRule([folder], now).map((d) => d.name);

  it('between the later start and the end: the two running ones, the later start first; never the ended, the not started or the undated', () => {
    for (const now of ['2026-11-08T12:00Z', '2026-09-04T20:00Z', '2026-12-11T19:59Z']) {
      expect({ now, running: names(now) }).toEqual({ now, running: ['running-with-end.md', 'running-no-end.md'] });
      expect({ now, own: ownRule([folder], at(now)).map((d) => d.name) }).toEqual({ now, own: ['running-with-end.md', 'running-no-end.md'] });
    }
  });

  it('at the end instant, only the one with no end; before a start, not that one', () => {
    expect(names('2026-12-11T20:00Z')).toEqual(['running-no-end.md']);
    expect(names('2026-12-11 20:00')).toEqual(['running-no-end.md']);
    expect(names('2026-09-04T19:59Z')).toEqual(['running-no-end.md']);
    expect(names('2026-05-29T19:59Z')).toEqual([]);
    // The not-started digest counts only from its start, the ended one only before its end.
    expect(names('2027-03-05T20:00Z')).toEqual(['not-started.md', 'running-no-end.md']);
    expect(names('2026-02-01T00:00Z')).toEqual(['ended.md']);
    expect(names('2026-04-03T20:00Z')).toEqual([]);
  });

  it('two digests with one start go by name', () => {
    const same = newDir('same-start');
    digest(same, 'b-league.md', '0.6', 'League: from 2026-09-04 20:00 UTC until no end announced.');
    digest(same, 'a-league.md', '0.6.1', 'League: from 2026-09-04 20:00 UTC until no end announced.');
    expect(moduleRule([same], '2026-11-08T12:00Z').map((d) => d.name)).toEqual(['a-league.md', 'b-league.md']);
  });

  it('with two folders, a committed digest replaces a user-side one of the same name, wherever it stands', () => {
    const committed = newDir('committed');
    const userSide = newDir('user-side');
    digest(committed, 'alpha.md', '0.7', 'League: from 2026-01-09 20:00 UTC until 2026-04-03 20:00 UTC.');
    digest(committed, 'gamma.md', '0.8', 'League: from 2026-06-01 20:00 UTC until no end announced.');
    digest(userSide, 'alpha.md', '0.7', 'League: from 2026-10-01 20:00 UTC until no end announced.');
    digest(userSide, 'beta.md', '0.9', 'League: from 2026-11-01 20:00 UTC until no end announced.');
    digest(userSide, 'gamma.md', '0.8', 'League: from 2026-10-15 20:00 UTC until no end announced.');
    const running = moduleRule([committed, userSide], '2026-11-08T12:00Z');
    // alpha's committed digest ended, so the user-side alpha, though running, isn't read; gamma is the committed one.
    expect(running).toEqual([
      { name: 'beta.md', path: path.join(userSide, 'beta.md') },
      { name: 'gamma.md', path: path.join(committed, 'gamma.md') },
    ]);
    expect(ownRule([committed, userSide], at('2026-11-08T12:00Z')).map((d) => d.path)).toEqual(running.map((d) => d.path));
  });

  it('leagues.mjs --at prints the same list, as the digests line, then each running digest\'s third line, then each undated digest named once', () => {
    const root = layout(fiveDigests);
    const command = path.join(root, 'skills', 'game-knowledge', 'scripts', 'leagues.mjs');
    for (const now of ['2026-11-08T12:00Z', '2026-12-11T20:00Z', '2026-05-29T19:59Z']) {
      const r = node([command, '--at', now]);
      expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
      const list = moduleRule([path.join(root, 'data', 'league')], now).map((d) => `data/league/${d.name}`);
      expect(r.stdout.split('\n')[0]).toBe(`digests: ${JSON.stringify(list)}`);
      expect(r.stdout).toBe(digestReport(root, at(now)));
    }
    expect(node([command, '--at', '2026-11-08T12:00Z']).stdout).toBe(
      [
        'digests: ["data/league/running-with-end.md","data/league/running-no-end.md"]',
        'running-with-end (0.5.5) on poe2db.tw, fetched 2026-11-01. League: from 2026-09-04 20:00 UTC until 2026-12-11 20:00 UTC. In-pin flags: checked against the fixture list on 2026-11-01.',
        'running-no-end (0.5) on poe2db.tw, fetched 2026-11-01. League: from 2026-05-29 20:00 UTC until no end announced. In-pin flags: checked against the fixture list on 2026-11-01.',
        'data/league/undated.md records no league dates: re-run its digest script',
        '',
      ].join('\n'),
    );
    expect(node([command, '--at', '2026-05-29T19:59Z']).stdout).toBe("digests: []\nNo running league has a league digest: what is new in it isn't in the committed data.\ndata/league/undated.md records no league dates: re-run its digest script\n");
    // A bad instant, or another option, is a usage error.
    for (const args of [['--at', 'soon'], ['--at'], ['--folder', 'x']]) expect(node([command, ...args]).code).toBe(2);
  });
});

describe('AC-W130 (WU-151, D-507): the committed digests on 2026-12-11, when both 0.5 leagues end and 1.0 starts', () => {
  const root = layout((league) => {
    for (const f of fs.readdirSync(COMMITTED).filter((x) => x.endsWith('.md'))) fs.copyFileSync(path.join(COMMITTED, f), path.join(league, f));
  });
  const command = path.join(root, 'skills', 'game-knowledge', 'scripts', 'leagues.mjs');

  it('both at 19:59 UTC, forbidden-rites.md first (the later start); none at 20:00', () => {
    expect(moduleRule([path.join(root, 'data', 'league')], '2026-12-11T19:59Z').map((d) => d.name)).toEqual(['forbidden-rites.md', 'runes-of-aldur.md']);
    expect(moduleRule([path.join(root, 'data', 'league')], '2026-12-11T20:00Z')).toEqual([]);
    expect(node([command, '--at', '2026-12-11T19:59Z']).stdout.split('\n')[0]).toBe('digests: ["data/league/forbidden-rites.md","data/league/runes-of-aldur.md"]');
    expect(node([command, '--at', '2026-12-11T20:00Z']).stdout).toBe("digests: []\nNo running league has a league digest: what is new in it isn't in the committed data.\n");
  });
});

describe('AC-W130 (WU-151, D-507): the run log records the running digests from skill revision 15, and the checker accepts each form', () => {
  const readLog = (dir: string): Json => JSON.parse(fs.readFileSync(path.join(dir, 'run-log.json'), 'utf8')) as Json;
  const writeLog = (dir: string, edit: (l: Json) => void) => {
    const l = readLog(dir);
    edit(l);
    fs.writeFileSync(path.join(dir, 'run-log.json'), `${JSON.stringify(l, null, 2)}\n`);
  };
  const runLog = (dir: string, args: string[], now: string) => node([RUN_LOG, dir, ...args], { BUILD_GUIDE_TEST_NOW: now });
  const check = (dir: string) => node([CHECKER, dir]);
  const runLogLines = (stderr: string) => stderr.split('\n').filter((l) => l.startsWith('check-run: [run-log] '));
  const copy = (fixture: string) => {
    const dir = path.join(newDir('copy'), 'run');
    fs.cpSync(path.join(PIPELINE, fixture), dir, { recursive: true });
    return dir;
  };
  const BOTH = ['forbidden-rites.md', 'runes-of-aldur.md'];
  const digestLine = (dir: string, now: string) => {
    const r = runLog(dir, ['display', 'verification'], now);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    return r.stdout.split('\n').filter((l) => /^The league digests? changed since this run last ran/.test(l));
  };

  it('init and resume at revision 15 record the list at the test clock, and print it for the runner', () => {
    const dir = newDir('init');
    const r = runLog(dir, ['init', JSON.stringify({ slug: 'titan-blood-hunt', brief: {}, mode: 'offline', testConfig: 'none', noNinja: false })], '2026-12-11T19:59Z');
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(readLog(dir)).toMatchObject({ skillRevision: 15, digest: BOTH });
    expect(r.stdout).toBe(`run-log: wrote the first log\n${digestReport(REPO, at('2026-12-11T19:59Z'))}`);
    expect(r.stdout.split('\n')[1]).toBe('digests: ["data/league/forbidden-rites.md","data/league/runes-of-aldur.md"]');
    const resumed = runLog(dir, ['resume', '{"noNinja": true}'], '2026-12-11T20:00Z');
    expect(resumed).toEqual({ code: 0, stdout: "run-log: wrote resumes[0], status running\ndigests: []\nNo running league has a league digest: what is new in it isn't in the committed data.\n", stderr: '' });
    expect(readLog(dir)).toMatchObject({ skillRevision: 15, digest: BOTH, resumes: [expect.objectContaining({ digest: [], noNinja: true })] });
    expect(readLog(dir)).not.toHaveProperty('skillRevisionFrom');
    // D-415's line: two lists as sets.
    expect(digestLine(dir, '2026-12-11T20:00Z')).toEqual(['The league digests changed since this run last ran (forbidden-rites.md, runes-of-aldur.md, now none).']);
  });

  it("a revision-14 log resumed at 15 keeps its top-level string, records a list in its new entry, and D-415's line compares a string with the list's first entry", () => {
    const dir = copy('run-a14');
    expect(readLog(dir)).toMatchObject({ skillRevision: 14, digest: 'runes-of-aldur.md', resumes: [] });
    const stages = readLog(dir).stages.length;
    const r = runLog(dir, ['resume', '{"noNinja": false}'], '2026-11-08T12:00Z');
    expect({ code: r.code, stderr: r.stderr, first: r.stdout.split('\n')[0] }).toEqual({ code: 0, stderr: '', first: `run-log: wrote resumes[0], status running, skillRevision 15 from stages[${stages}]` });
    const log = readLog(dir);
    expect(log).toMatchObject({ skillRevision: 15, digest: 'runes-of-aldur.md', skillRevisionFrom: { 15: log.resumes[0].lengths } });
    expect(log.resumes[0].digest).toEqual(BOTH);
    expect(runLogLines(check(dir).stderr)).toEqual([]);
    // runes-of-aldur.md isn't the list's first entry: the line says the digests changed.
    expect(digestLine(dir, '2026-11-08T12:00Z')).toEqual(['The league digests changed since this run last ran (runes-of-aldur.md, now forbidden-rites.md, runes-of-aldur.md).']);
    // A string equal to the list's first entry is no change.
    const same = copy('run-a14');
    writeLog(same, (l) => {
      l.digest = 'forbidden-rites.md';
    });
    expect(runLog(same, ['resume', '{"noNinja": false}'], '2026-11-08T12:00Z').code).toBe(0);
    expect(digestLine(same, '2026-11-08T12:00Z')).toEqual([]);
    // Two lists with the same digests in another order are no change; another set is one.
    writeLog(same, (l) => {
      l.resumes[0].digest = ['runes-of-aldur.md', 'forbidden-rites.md'];
    });
    expect(runLog(same, ['resume', '{"noNinja": false}'], '2026-11-08T12:00Z').code).toBe(0);
    expect(digestLine(same, '2026-11-08T12:00Z')).toEqual([]);
    expect(runLog(same, ['resume', '{"noNinja": false}'], '2026-12-11T19:00Z').code).toBe(0);
    writeLog(same, (l) => {
      l.resumes[2].digest = ['runes-of-aldur.md'];
    });
    expect(digestLine(same, '2026-12-11T19:00Z')).toEqual(['The league digests changed since this run last ran (forbidden-rites.md, runes-of-aldur.md, now runes-of-aldur.md).']);
  });

  it('the checker accepts each form where its revision puts it; a revision-14 fixture run passes unchanged', () => {
    // run-a14, as committed: a string, from a log init wrote at 14.
    expect(check(path.join(PIPELINE, 'run-a14'))).toEqual({ code: 0, stdout: `check-run: ok: ${path.join(PIPELINE, 'run-a14')}\n`, stderr: '' });
    // As if init wrote it at 15: a list passes, possibly empty; a string, or a list holding a non-name, fails.
    for (const [digest, ok] of [[BOTH, true], [[], true], ['runes-of-aldur.md', false], [null, false], [[''], false], [['data/league/x.md'], false]] as const) {
      const dir = copy('run-a14');
      writeLog(dir, (l) => {
        l.skillRevision = 15;
        l.digest = digest;
      });
      const found = runLogLines(check(dir).stderr);
      expect({ digest, found }).toEqual({ digest, found: ok ? [] : [expect.stringMatching(/run-log\.json digest: is .*; from skill revision 15, which init wrote here, the running leagues' digests: a list of file names/)] });
    }
    // A revision-14 log keeps a string or null; a list there fails.
    const old = copy('run-a14');
    writeLog(old, (l) => {
      l.digest = BOTH;
    });
    expect(runLogLines(check(old).stderr)).toEqual([expect.stringMatching(/run-log\.json digest: is .*; the newest league digest's file name, or null, in a log init wrote before skill revision 15/)]);
    // run-builds, resumed before (a string) and stamped at 15 by a resume now (a list): each entry in its own form, and
    // each later resume's a list too.
    const dir = copy('run-builds');
    expect(readLog(dir).resumes.map((r: Json) => r.digest)).toEqual(['runes-of-aldur.md']);
    expect(runLog(dir, ['resume', '{"noNinja": false}'], '2026-11-08T12:00Z').code).toBe(0);
    expect(readLog(dir).resumes.map((r: Json) => r.digest)).toEqual(['runes-of-aldur.md', BOTH]);
    expect(runLogLines(check(dir).stderr)).toEqual([]);
    const again = path.join(newDir('again'), 'run');
    fs.cpSync(dir, again, { recursive: true });
    expect(runLog(again, ['resume', '{"noNinja": false}'], '2026-12-11T20:00Z').code).toBe(0);
    expect(readLog(again).resumes.map((r: Json) => r.digest)).toEqual(['runes-of-aldur.md', BOTH, []]);
    expect(runLogLines(check(again).stderr)).toEqual([]);
    const swapped = (edit: (l: Json) => void) => {
      const d = path.join(newDir('swap'), 'run');
      fs.cpSync(dir, d, { recursive: true });
      writeLog(d, edit);
      return runLogLines(check(d).stderr);
    };
    // The stamping resume records a list, and the resume before it a string or null.
    expect(swapped((l) => (l.resumes[1].digest = 'forbidden-rites.md'))).toEqual([expect.stringMatching(/resumes\[1\]: digest is "forbidden-rites\.md"; a resume at skill revision 15 records the running leagues' digests, a list of file names/)]);
    expect(swapped((l) => (l.resumes[1].digest = null))).toEqual([expect.stringMatching(/resumes\[1\]: digest is null; a resume at skill revision 15 records the running leagues' digests/)]);
    expect(swapped((l) => (l.resumes[0].digest = BOTH))).toEqual([expect.stringMatching(/resumes\[0\]: digest is .*; text or null in a resume before skill revision 15/)]);
    expect(swapped((l) => (l.resumes[0].digest = null))).toEqual([]);
  });
});
