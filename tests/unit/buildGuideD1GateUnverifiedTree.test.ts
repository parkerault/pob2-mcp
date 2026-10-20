/**
 * The WU-96 fix round (amendment 9, D-419, D-421): a D1 gate whose compile failed, or was refused, never reached node
 * power, so its `tree` part is `unverified` as every part after the compile is, with no finding of its own
 * (`gates.md`, "Every verdict file"; `stages/D1-gate.md` step 3). The run checker (`check-run.mjs`, `checkTreePart`)
 * accepts that, and still fails a `tree: "unverified"` beside a passing compile with no `tool-error` or
 * `tool-refused` finding.
 *
 * Each case is a temp copy of `tests/fixtures/pipeline/run-builds` (schema 4) in which r1-a-2's first D1 gate fails
 * or is refused before its compile, then D1 (or the gate alone, after a refusal) runs again and the gate passes, as
 * the flow routes it. The checker is spawned as a real `node` process with an explicit env, and loads the server's
 * compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-builds');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'd1-tree-unverified-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function check(dir: string): { code: number | null; stderr: string } {
  const r = spawnSync(process.execPath, [CHECKER, dir], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000 });
  return { code: r.status, stderr: r.stderr };
}
let copies = 0;
function copy(): string {
  const dir = path.join(TMP, `run-builds-${++copies}`);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
const writeJson = (dir: string, rel: string, v: Json) => fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);

const GATE = 'reports/gates/D1-gate-r1-a-2-a1.json';
/** The parts after the compile, each left unverified when the compile didn't pass. */
const AFTER_COMPILE = { v1: 'unverified', v2: 'unverified', floor: 'unverified', budget: 'unverified', rolledSkill: 'unverified', tree: 'unverified' };

/**
 * run-builds with r1-a-2's first D1 gate replaced by `first` (logged `outcome`), and the fixture's passing gate as
 * attempt 2, after `between` (the steps the route runs before it). The resume's recorded lengths move with the inserted
 * entries (D-415).
 */
function withFirstGate(first: Json, outcome: string, between: string[]): string {
  const dir = copy();
  const passing = readJson(dir, GATE);
  writeJson(dir, 'reports/gates/D1-gate-r1-a-2-a2.json', { ...passing, attempt: 2 });
  fs.rmSync(path.join(dir, GATE));
  writeJson(dir, GATE, { stage: 'D1-gate', concept: 'r1-a-2', attempt: 1, ...first, basis: passing.basis, recordPath: passing.recordPath, faultsApplied: [] });
  const log = readJson(dir, 'run-log.json');
  const at = log.stages.findIndex((s: Json) => s.stage === 'D1-gate' && s.concept === 'r1-a-2');
  const inserted = [{ stage: 'D1-gate', concept: 'r1-a-2', attempt: 1, outcome }, ...between.map((stage) => ({ stage, concept: 'r1-a-2', attempt: 2, outcome: 'done' }))];
  log.stages[at].attempt = 2;
  log.stages.splice(at, 0, ...inserted);
  for (const r of log.resumes) r.lengths.stages += inserted.length;
  writeJson(dir, 'run-log.json', log);
  return dir;
}
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));

describe('a D1 gate whose compile didn\'t pass leaves its tree unverified with no tree finding (WU-96 fix round)', () => {
  it('the fixture passes as it is', () => {
    expect(check(copy())).toEqual({ code: 0, stderr: '' });
  });

  it('a compile error: compiled fails, the tree unverified with no finding; D1 re-runs, and the run passes', () => {
    const dir = withFirstGate(
      {
        verdict: { compiled: 'fail', ...AFTER_COMPILE },
        findings: [{ part: 'compiled', code: 'compile-error', stage: 'b', message: 'stage b: unknown gem "Bloodlust II"' }],
      },
      'fail',
      ['D1-build', 'D1-tree', 'D1-finish'],
    );
    expect(check(dir)).toEqual({ code: 0, stderr: '' });
  });

  it('a refused compile: compiled unverified with tool-refused, the tree unverified with no finding; the gate alone re-runs, and the run passes', () => {
    const dir = withFirstGate(
      {
        verdict: { compiled: 'unverified', ...AFTER_COMPILE },
        findings: [{ part: 'compiled', code: 'tool-refused', message: 'refused: mcp__pob2__compile_plan' }],
      },
      'refused',
      [],
    );
    expect(check(dir)).toEqual({ code: 0, stderr: '' });
  });

  it('a passing compile with the tree unverified and no tool-error or tool-refused finding still fails', () => {
    const dir = copy();
    const gate = readJson(dir, GATE);
    gate.verdict.tree = 'unverified';
    gate.findings = gate.findings.filter((f: Json) => f.part !== 'tree');
    writeJson(dir, GATE, gate);
    const r = check(dir);
    expect(r.code).toBe(1);
    expect(lines(r.stderr, 'gate-report')).toContain(
      `check-run: [gate-report] ${GATE}: says tree: "unverified" with no tool-error or tool-refused finding; the tree is unverified only when get_node_power failed (tool-error), the call was refused (tool-refused), or the compile didn't pass (D-419, D-421)`,
    );
  });

  it('a compile that failed doesn\'t excuse a tree-swap finding on an unverified tree', () => {
    const dir = withFirstGate(
      {
        verdict: { compiled: 'fail', ...AFTER_COMPILE },
        findings: [
          { part: 'compiled', code: 'compile-error', stage: 'b', message: 'stage b: unknown gem "Bloodlust II"' },
          { part: 'tree', code: 'tree-swap', stage: 'b', message: 'b: +6.2% Full DPS by moving 5 points' },
        ],
      },
      'fail',
      ['D1-build', 'D1-tree', 'D1-finish'],
    );
    expect(lines(check(dir).stderr, 'gate-report')).toContainEqual(expect.stringContaining(`${GATE}: says tree: "unverified" beside a tree-swap finding`));
  });
});
