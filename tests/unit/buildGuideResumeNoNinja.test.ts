/**
 * WU-95's second fix round (D-415, D-420): a resumed run prices by the session's `--no-ninja`. Every pricing step reads
 * the run log's top-level `noNinja` (SKILL.md §1, run-log.md), so `resume` sets it to the session's flag, and its
 * `resumes[]` entry keeps that session's record. A migrated run's `null` and a `--no-ninja` run's `true` are replaced.
 *
 * Spawned as real `node` processes on temp copies of the schema-3 fixture `run-ok` (migrated first) and on a fresh
 * schema-4 log, with an explicit env.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-no-ninja-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

function node(script: string, args: string[], input?: string) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 60000, input });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
let n = 0;
const folder = (): string => {
  const dir = path.join(TMP, `run-${++n}`);
  fs.mkdirSync(dir);
  return dir;
};
const log = (dir: string): Json => JSON.parse(fs.readFileSync(path.join(dir, 'run-log.json'), 'utf8')) as Json;
const resume = (dir: string, noNinja: boolean) => node(RUN_LOG, [dir, 'resume', '-'], `${JSON.stringify({ noNinja })}\n`);
/** A copy of the schema-3 fixture run-ok, migrated to schema 4: its noNinja is null (D-415). */
function migrated(): string {
  const dir = folder();
  fs.cpSync(path.join(FIXTURES, 'run-ok'), dir, { recursive: true });
  expect(node(RUN_LOG, [dir, 'migrate'])).toMatchObject({ code: 0, stderr: '' });
  expect(log(dir)).toMatchObject({ schemaVersion: 4, noNinja: null });
  return dir;
}

describe("resume sets the top-level noNinja to the session's --no-ninja; resumes[] keeps each session's (D-415, D-420)", () => {
  it('a migrated run resumed with --no-ninja prices without currency rates: null becomes true', () => {
    const dir = migrated();
    // Amendment 11 (§19): the resume stamps the migrated log with the skill revision.
    expect(resume(dir, true)).toEqual({ code: 0, stdout: 'run-log: wrote resumes[0], status running, skillRevision 11 from stages[19]\n', stderr: '' });
    expect(log(dir)).toMatchObject({ noNinja: true, status: 'running', resumes: [expect.objectContaining({ noNinja: true })] });
    // The checker holds a migrated run's noNinja to true, false or null: true passes its field rule.
    expect(node(CHECKER, [dir]).stderr).not.toMatch(/noNinja/);
  });

  it('a migrated run resumed without --no-ninja prices with them: null becomes false', () => {
    const dir = migrated();
    expect(resume(dir, false).code).toBe(0);
    expect(log(dir)).toMatchObject({ noNinja: false, resumes: [expect.objectContaining({ noNinja: false })] });
    expect(node(CHECKER, [dir]).stderr).not.toMatch(/noNinja/);
  });

  it('a --no-ninja run resumed without the flag prices with currency rates again, and a later resume with it stops them; each resume keeps its own', () => {
    const dir = folder();
    const init = { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'online', testConfig: 'none', noNinja: true };
    expect(node(RUN_LOG, [dir, 'init', '-'], `${JSON.stringify(init)}\n`).code).toBe(0);
    expect(log(dir).noNinja).toBe(true);
    expect(resume(dir, false).code).toBe(0);
    expect(log(dir).noNinja).toBe(false);
    expect(resume(dir, true).code).toBe(0);
    expect(log(dir).noNinja).toBe(true);
    expect((log(dir).resumes as Json[]).map((r) => r.noNinja)).toEqual([false, true]);
  });
});
