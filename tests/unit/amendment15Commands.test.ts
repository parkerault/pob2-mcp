/**
 * Amendment 15 (M-28, WU-145; D-499, D-500, D-503's moves): the plugin's `bin/` commands and the moved scripts, spawned
 * as real processes with an explicit env, on temp copies of the committed fixtures.
 *
 * - AC-W117: run from a temporary folder outside the repository, with `bin/` and the folder of the Node running the test
 *   first on `PATH`, each of the four commands gives the output and exit code `node` on its script gives from the
 *   repository root: `pob2-check-run` on a passing and a failing fixture, `pob2-run-log <copy> display <gate>`,
 *   `pob2-render-audit <copy> --build <id>`, `pob2-render-notes <copy> --build <id>`; and `pob2-check-run` through a
 *   symbolic link to the `bin/` folder gives the same result.
 * - AC-W118: old runs resume. A copy of the revision-14 fixture run (schema 4, `skillRevision` 14) resumes with
 *   `pob2-run-log <copy> resume '{"noNinja": true}'` and then passes the checker; the log's `skillRevision` stays 14.
 * - AC-W119 (unit part): `scripts/run-usage.mjs` names a step the same for `pob2:build-guide-coordinator` as for
 *   `build-guide-coordinator`.
 * - AC-W120 (unit part): the data builders at `skills/game-knowledge/scripts/`: `rules-index.mjs check` passes on
 *   `data/rules/`, and the digest and the monster table they write from the fixture pages name their new paths.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const BIN = path.join(REPO, 'bin');
const SCRIPTS = path.join(REPO, 'skills', 'build-guide', 'scripts');
const GK_SCRIPTS = path.join(REPO, 'skills', 'game-knowledge', 'scripts');
const PIPELINE = path.join(REPO, 'tests', 'fixtures', 'pipeline');
/** The revision-14 fixture run: schema 4, one build, r1-a-2, completed. */
const RUN_A14 = path.join(PIPELINE, 'run-a14');
const BUILD = 'r1-a-2';
/** The folder of the Node running the test, which the commands' `node` resolves to. */
const NODE_DIR = path.dirname(process.execPath);
/** A folder outside the repository, the commands' working directory. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-commands-'));
const OUTSIDE = path.join(TMP, 'elsewhere');
fs.mkdirSync(OUTSIDE);
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

interface Result {
  code: number | null;
  stdout: string;
  stderr: string;
}
const ENV = { LANG: 'C' };

/** `node` on a script, from the repository root. */
function viaNode(script: string, args: string[], input?: string): Result {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: REPO, env: { PATH: '/usr/bin:/bin', ...ENV }, encoding: 'utf8', timeout: 120000, input });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
/** A `bin/` command by its bare name, from outside the repository, with `binDir` and Node's folder first on PATH. */
function viaBin(command: string, args: string[], binDir = BIN, input?: string): Result {
  const r = spawnSync(command, args, { cwd: OUTSIDE, env: { PATH: [binDir, NODE_DIR, '/usr/bin', '/bin'].join(':'), ...ENV }, encoding: 'utf8', timeout: 120000, input });
  if (r.error) throw r.error;
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

let copies = 0;
/** A fresh copy of a fixture run, in its own folder, at `<folder>/run`. */
function copyOf(fixture: string): string {
  const dir = path.join(TMP, `copy-${++copies}`, 'run');
  fs.cpSync(fixture, dir, { recursive: true });
  return dir;
}
/** A result with a copy's own path read as `<copy>`, so two copies' results compare. */
const asCopy = (r: Result, dir: string): Result => ({ code: r.code, stdout: r.stdout.split(dir).join('<copy>'), stderr: r.stderr.split(dir).join('<copy>') });
const readLog = (dir: string): Json => JSON.parse(fs.readFileSync(path.join(dir, 'run-log.json'), 'utf8')) as Json;

/** A copy of run-a14 the checker fails: its run log's status isn't one of the statuses. */
function failingRun(): string {
  const dir = copyOf(RUN_A14);
  const log = readLog(dir);
  log.status = 'bogus';
  fs.writeFileSync(path.join(dir, 'run-log.json'), `${JSON.stringify(log, null, 2)}\n`);
  return dir;
}

describe('AC-W117 (WU-145, D-499): each bin/ command gives what node on its script gives', () => {
  it('pob2-check-run on a passing and a failing fixture', () => {
    const pass = viaBin('pob2-check-run', [RUN_A14]);
    expect(pass).toEqual({ code: 0, stdout: `check-run: ok: ${RUN_A14}\n`, stderr: '' });
    expect(pass).toEqual(viaNode(path.join(SCRIPTS, 'check-run.mjs'), [RUN_A14]));
    const failing = failingRun();
    const fail = viaBin('pob2-check-run', [failing]);
    expect(fail.code).toBe(1);
    expect(fail.stderr).toMatch(/^check-run: \[run-log\] run-log\.json status: is "bogus"/);
    expect(fail).toEqual(viaNode(path.join(SCRIPTS, 'check-run.mjs'), [failing]));
  });

  it('pob2-run-log <copy> display <gate>', () => {
    const [a, b] = [copyOf(RUN_A14), copyOf(RUN_A14)];
    const viaCommand = asCopy(viaBin('pob2-run-log', [a, 'display', 'final', '--build', BUILD]), a);
    expect(viaCommand.code).toBe(0);
    expect(viaCommand.stdout).toMatch(/^## The final gate, visit \d+\n/);
    expect(viaCommand).toEqual(asCopy(viaNode(path.join(SCRIPTS, 'run-log.mjs'), [b, 'display', 'final', '--build', BUILD]), b));
  });

  it('pob2-render-audit <copy> --build <id>', () => {
    const [a, b] = [copyOf(RUN_A14), copyOf(RUN_A14)];
    const viaCommand = asCopy(viaBin('pob2-render-audit', [a, '--build', BUILD]), a);
    expect(viaCommand).toEqual({ code: 0, stdout: expect.stringMatching(/^render-audit: wrote builds\/r1-a-2\/audit\.md from /), stderr: '' });
    expect(viaCommand).toEqual(asCopy(viaNode(path.join(SCRIPTS, 'render-audit.mjs'), [b, '--build', BUILD]), b));
    const audit = (dir: string) => fs.readFileSync(path.join(dir, 'builds', BUILD, 'audit.md'), 'utf8');
    expect(audit(a)).toBe(audit(b));
  });

  it('pob2-render-notes <copy> --build <id>', () => {
    const [a, b] = [copyOf(RUN_A14), copyOf(RUN_A14)];
    const viaCommand = asCopy(viaBin('pob2-render-notes', [a, '--build', BUILD]), a);
    expect(viaCommand).toEqual({ code: 0, stdout: expect.stringMatching(/^render-notes: wrote builds\/r1-a-2\/notes\.txt /), stderr: '' });
    expect(viaCommand).toEqual(asCopy(viaNode(path.join(SCRIPTS, 'render-notes.mjs'), [b, '--build', BUILD]), b));
    const notes = (dir: string) => fs.readFileSync(path.join(dir, 'builds', BUILD, 'notes.txt'), 'utf8');
    expect(notes(a)).toBe(notes(b));
  });

  it('pob2-check-run through a symbolic link to the bin/ folder gives the same result', () => {
    const link = path.join(TMP, 'linked-bin');
    fs.symlinkSync(BIN, link);
    expect(fs.realpathSync(link)).toBe(fs.realpathSync(BIN));
    expect(viaBin('pob2-check-run', [RUN_A14], link)).toEqual(viaNode(path.join(SCRIPTS, 'check-run.mjs'), [RUN_A14]));
    const failing = failingRun();
    expect(viaBin('pob2-check-run', [failing], link)).toEqual(viaNode(path.join(SCRIPTS, 'check-run.mjs'), [failing]));
  });
});

describe("AC-W117 (WU-145, D-500): the checker's messages name the bin/ commands, with the arguments they take", () => {
  it('a schema-4 run missing a display and its audit.md is told the pob2-run-log and pob2-render-audit command lines, and the render named fixes its part', () => {
    const dir = copyOf(RUN_A14);
    const log = readLog(dir);
    log.displays = (log.displays as Json[]).filter((d) => d.checkpoint !== 'design');
    fs.writeFileSync(path.join(dir, 'run-log.json'), `${JSON.stringify(log, null, 2)}\n`);
    fs.rmSync(path.join(dir, 'builds', BUILD, 'audit.md'));
    const r = viaBin('pob2-check-run', [dir]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(`every gate visit prints its display first, pob2-run-log <runFolder> display design --build ${BUILD}, and only then logs its answer (D-367)`);
    const audit = /the runner renders it with (pob2-render-audit <runFolder> --build \S+) before W1/.exec(r.stderr);
    expect(audit?.[1]).toBe(`pob2-render-audit <runFolder> --build ${BUILD}`);
    expect(r.stderr).not.toMatch(/(?:check-run|run-log|render-audit|render-notes)\.mjs/);
    // The command line, as named, run with the run folder for <runFolder>, renders the file the checker missed.
    const [command, ...args] = audit![1].split(' ').map((a) => (a === '<runFolder>' ? dir : a));
    expect(viaBin(command, args).code).toBe(0);
    expect(viaBin('pob2-check-run', [dir]).stderr).not.toContain('[audit-sections]');
  });
});

describe('AC-W118 (WU-145, D-500): an old run resumes unchanged', () => {
  it("a copy of the revision-14 fixture resumes with pob2-run-log, then passes the checker; its skillRevision stays 14", () => {
    const dir = copyOf(RUN_A14);
    expect(readLog(dir)).toMatchObject({ schemaVersion: 4, skillRevision: 14, status: 'completed' });
    expect(viaBin('pob2-run-log', [dir, 'resume', '{"noNinja": true}'])).toEqual({ code: 0, stdout: 'run-log: wrote resumes[0], status running\n', stderr: '' });
    expect(viaBin('pob2-check-run', [dir])).toEqual({ code: 0, stdout: `check-run: ok: ${dir}\n`, stderr: '' });
    const log = readLog(dir);
    expect(log).toMatchObject({ schemaVersion: 4, skillRevision: 14, status: 'running', noNinja: true });
    expect(log.resumes).toEqual([expect.objectContaining({ noNinja: true })]);
  });
});

describe('AC-W119 (WU-145, D-499): run-usage.mjs reads a pob2: agent type as the bare one', () => {
  /** One session: the runner's request, and a subagent whose prompt has no stage marker, so its type names its step. */
  function session(agentType: string): Json[] {
    const dir = path.join(TMP, `usage-${++copies}`);
    fs.mkdirSync(path.join(dir, 'sess-1', 'subagents'), { recursive: true });
    const usage = { input_tokens: 10, output_tokens: 50, cache_read_input_tokens: 100, cache_creation_input_tokens: 5, output_tokens_details: { thinking_tokens: 0 } };
    const entry = (req: string, prompt: string) => [
      { type: 'user', sessionId: 'sess-1', message: { role: 'user', content: prompt } },
      { type: 'assistant', sessionId: 'sess-1', requestId: req, message: { id: `msg-${req}`, model: 'm', usage, content: [{ type: 'text', text: 'x' }] } },
    ];
    const jsonl = (es: Json[]) => `${es.map((e) => JSON.stringify(e)).join('\n')}\n`;
    const main = path.join(dir, 'sess-1.jsonl');
    fs.writeFileSync(main, jsonl(entry('main', 'go')));
    fs.writeFileSync(path.join(dir, 'sess-1', 'subagents', 'agent-a1.jsonl'), jsonl(entry('sub', 'a question about the deck')));
    fs.writeFileSync(path.join(dir, 'sess-1', 'subagents', 'agent-a1.meta.json'), JSON.stringify({ agentType, description: 'Q brainstorm 1' }));
    const out = path.join(dir, 'out.json');
    const r = viaNode(path.join(REPO, 'scripts', 'run-usage.mjs'), [main, '--json', out]);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    return (JSON.parse(fs.readFileSync(out, 'utf8')) as Json).agents as Json[];
  }

  it('names the step coordinator for both, and keeps any other type as it was', () => {
    const kind = (agents: Json[]) => agents.find((a) => a.description === 'Q brainstorm 1')?.kind;
    expect(kind(session('pob2:build-guide-coordinator'))).toBe('coordinator');
    expect(kind(session('build-guide-coordinator'))).toBe('coordinator');
    expect(kind(session('pob2:build-guide-researcher'))).toBe(kind(session('build-guide-researcher')));
    expect(kind(session('general-purpose'))).toBe('general-purpose');
  });
});

describe("AC-W120 (WU-145, D-503): the data builders at skills/game-knowledge/scripts/", () => {
  it('rules-index.mjs check passes on data/rules/', () => {
    const r = viaNode(path.join(GK_SCRIPTS, 'rules-index.mjs'), ['check']);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(r.stdout).toMatch(/^rules-index check: ok \(/);
  });

  it('the digest league-digest.mjs writes from the fixture pages names its new path', () => {
    const fixtures = path.join(REPO, 'tests', 'fixtures', 'poe2db', 'league');
    const pages = path.join(TMP, 'digest-pages');
    const out = path.join(TMP, 'digest-out');
    fs.mkdirSync(pages);
    fs.mkdirSync(out);
    for (const f of fs.readdirSync(fixtures).filter((n) => n.endsWith('.html'))) fs.copyFileSync(path.join(fixtures, f), path.join(pages, f));
    fs.copyFileSync(path.join(fixtures, 'embers-of-tarn.rule-changers.json'), path.join(out, 'embers-of-tarn.rule-changers.json'));
    // A module the child loads first: fetch throws, so the --from run makes no request.
    const noNetwork = path.join(TMP, 'no-network.mjs');
    fs.writeFileSync(noNetwork, "globalThis.fetch = () => { throw new Error('the test forbids the network'); };\n");
    const r = spawnSync(process.execPath, ['--import', pathToFileURL(noNetwork).href, path.join(GK_SCRIPTS, 'league-digest.mjs'), 'Embers_of_Tarn', '--from', pages, '--out', out, '--pin-names', path.join(fixtures, 'pin-names.json')], {
      cwd: TMP,
      env: { PATH: '/usr/bin:/bin', ...ENV },
      encoding: 'utf8',
      timeout: 120000,
    });
    expect({ code: r.status, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const digest = fs.readFileSync(path.join(out, 'embers-of-tarn.md'), 'utf8');
    expect(digest).toContain('Written by `skills/game-knowledge/scripts/league-digest.mjs Embers_of_Tarn`;');
  });

  it('the table monster-mods.mjs writes from the fixture pages names its new path, as the committed table does', () => {
    const out = path.join(TMP, 'monsters', 'monster-mods.md');
    const r = viaNode(path.join(GK_SCRIPTS, 'monster-mods.mjs'), ['--from', path.join(REPO, 'tests', 'fixtures', 'poe2db', 'monsters'), '--out', out, '--date', '2026-10-18']);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const header = fs.readFileSync(out, 'utf8').split('\n').slice(0, 4);
    expect(header[2]).toBe("Written by `skills/game-knowledge/scripts/monster-mods.mjs` from poe2db's pages saved 2026-10-18 (amendment 8, D-402).");
    expect(fs.readFileSync(path.join(REPO, 'data', 'monsters', 'monster-mods.md'), 'utf8').split('\n').slice(0, 4)).toEqual(header);
  });
});
