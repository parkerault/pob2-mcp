/**
 * Amendment 16's M-30, WU-162 (D-519, D-521; §12, §15, §17): a compile run's better round, each script spawned as a real
 * `node` process with an explicit env and the test clock (`BUILD_GUIDE_TEST_NOW`, `tests/helpers/runningDigests.ts`'s
 * `TEST_NOW`), on the committed fixture compile run with a better round (offline), `tests/fixtures/pieces/compile-better-run`:
 * the importer fixture (`tests/fixtures/builds/imported-character.xml`) read by `plan_from_build` (its main skill and
 * Spirit answered), measured, placed on the budget rung by the user's word, and its better round's plan compiled by the
 * engine (measure-only, then F1's final compile, the record and files as the server wrote them), on the file's own
 * configuration (`config.file`, its V2 callouts `from-file`); then `place`, D1-build, D1-tree, D1-finish and the D1 gate in
 * the `better` scope (its floor four resistances short, each shown with its cost), the design gate's accept and F1.
 *
 * - AC-W154: the fixture passes the checker, its D1 loop in order (`checkFlow4`'s, D1-build to F1, §12), and a planted
 *   fault in that order fails; V2's callouts on the file's configuration fail no gate; the design gate takes accept,
 *   revise or stop, at write and in the checker; a resume runs the stopped step again (§12's retry) or reopens a build
 *   stopped at its design gate; an escalation answered stop ends the run stopped, and one accepted logs its draft; a
 *   build a stop cut short before its first D1 gate is held to the log's revision; the checker fails a planted round whose
 *   missed target isn't shown as a finding with its cost (§17); the design display names the draft first, lists the
 *   round's changes, its finds over the budget and each target not reached with its cost, shows a round on `m` in full,
 *   and invites accept (F1), changes or stop; no file name equals the source's; on the importer fixture at level 50
 *   (choice A) the round's targets are `m`'s. And the better round's own checks (`better`): its file card, its one
 *   stage, its scope; its gate notes, `interview` (compile's too), with no gate question step.
 *
 * check-run and run-log load the server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TEST_NOW } from '../helpers/runningDigests';
import { readerLayout, IMPORTER, textOf, type ReaderLayout } from '../helpers/planFromBuild';
import { encodePobCode } from '../../src/utils/buildCode';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'skills', 'build-guide', 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'pieces', 'compile-better-run');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'compile-better-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C', BUILD_GUIDE_TEST_NOW: TEST_NOW };
function node(script: string, args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, [dir]);
const write = (dir: string, kind: string, entry: Json) => node(RUN_LOG, [dir, kind, JSON.stringify(entry)]);
/** The broken rule's lines on stderr. */
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));
/** Every rule a checker's stderr names. */
const rulesIn = (stderr: string) => [...new Set(stderr.split('\n').map((l) => /^check-run: \[([^\]]+)\] /.exec(l)?.[1]).filter((x): x is string => x !== undefined))].sort();
function passes(dir: string): void {
  const r = check(dir);
  expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
}
const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
function writeJson(dir: string, rel: string, v: Json): void {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
}
function editJson(dir: string, rel: string, edit: (v: Json) => void): void {
  const v = readJson(dir, rel);
  edit(v);
  writeJson(dir, rel, v);
}

let copies = 0;
/** A copy of the fixture in its own guides root, `<root>/compile/2026-12-01-1/`, its log's runFolder that folder. */
function better(): string {
  const dir = path.join(TMP, `root-${++copies}`, 'compile', '2026-12-01-1');
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.cpSync(FIXTURE, dir, { recursive: true });
  editJson(dir, 'run-log.json', (l) => {
    l.runFolder = dir;
  });
  return dir;
}
/** The fixture's log cut back to its first `n` stages, with no gate visit yet, still running. */
function cut(dir: string, n: number): void {
  editJson(dir, 'run-log.json', (l) => {
    l.stages = l.stages.slice(0, n);
    l.checkpoints = [];
    l.displays = [];
    l.status = 'running';
  });
}
const STAGES = ['read', 'read', 'measure', 'place', 'D1-build', 'D1-tree', 'D1-finish', 'D1-gate', 'F1'];
/** The stages through the D1 gate: read twice (the answers), measure, place, then D1-build to the D1 gate. */
const THROUGH_GATE = 8;
const GATE = 'reports/gates/D1-gate-file-a1.json';
const DRAFT = 'imported-character better (draft).xml';
/** The gate's floor findings without their costs: the targets missed with nothing shown. */
function uncosted(dir: string): void {
  editJson(dir, GATE, (g) => {
    for (const f of g.findings) delete f.cost;
  });
}

// ---------------------------------------------------------------------------------------------------
// The real path: a read plan's better round, on the file's configuration (the review's high finding)
// ---------------------------------------------------------------------------------------------------

describe("AC-W154 (WU-162, D-519, D-521): the fixture is a read plan's better round, on the file's own configuration", () => {
  it("its plan is the importer fixture read into a plan and placed, its record the engine's, with V2 callouts that fail nothing", () => {
    const plan = readJson(FIXTURE, 'plan.json');
    const st = plan.stages[0];
    expect({ id: st.id, variant: st.variant, level: st.level, source: st.source.name, schema: plan.schemaVersion }).toEqual({ id: 'b', variant: 'budget', level: 90, source: 'imported-character.xml', schema: 11 });
    expect(Object.keys(st.config.file)).toEqual(expect.arrayContaining(['enemyIsBoss', 'customMods', 'windDancerStacks', 'conditionEnemyChilled']));
    expect(st.items.slots.filter((x: Json) => x.owned !== true).map((x: Json) => x.slot).sort()).toEqual(['Body Armour', 'Ring 2']);
    const rec = readJson(FIXTURE, 'compile-record.json');
    expect({ mode: rec.mode, file: rec.pobFile.path, location: rec.pobFile.location }).toEqual({ mode: 'final', file: 'imported-character better.xml', location: 'builds' });
    const v2 = rec.stages.b.v2;
    expect(v2.pass).toBe(true);
    expect(v2.findings.length).toBeGreaterThan(0);
    expect(v2.findings.every((f: Json) => f.kind === 'from-file')).toBe(true);
    expect(v2.findings.map((f: Json) => f.code)).toContain('unproduced-state');
    // The D1 gate and F1 report the callouts with their kind, and V2 passes at both.
    for (const file of [GATE, 'reports/gates/F1-file-a1.json']) {
      const g = readJson(FIXTURE, file);
      expect({ file, v2: g.verdict.v2, callouts: g.findings.filter((f: Json) => f.part === 'v2' && f.kind === 'from-file').length }).toEqual({ file, v2: 'pass', callouts: v2.findings.length });
    }
    // trades.json holds the round's own trades, no leftover of another build.
    expect(readJson(FIXTURE, 'trades.json').trades.map((t: Json) => `${t.kind} ${t.stage}`)).toEqual(['damage b', 'defence b', 'scaling b']);
  });

  it('it passes the checker, its steps read, measure, place, then D1-build to F1, the D1 steps in the better scope', () => {
    const dir = better();
    expect(readJson(dir, 'run-log.json').stages.map((s: Json) => s.stage)).toEqual(STAGES);
    expect(readJson(dir, 'run-log.json').stages.slice(4, 8).map((s: Json) => s.scope)).toEqual(['better', 'better', 'better', 'better']);
    passes(dir);
  });

  it("its floor on the file's configuration is read at its rung's reference hits, which the compiler doesn't write there", () => {
    const rec = readJson(FIXTURE, 'compile-record.json');
    expect(rec.stages.b.configWritten.enemyPhysicalDamage).toBeUndefined();
    // The floor recomputed at the budget rung's hits (area 79) gives the gate's four resistance findings, no hit missing.
    const g = readJson(FIXTURE, GATE);
    expect(g.findings.filter((f: Json) => f.part === 'floor').map((f: Json) => f.code)).toEqual(['missing-fire-resist', 'missing-cold-resist', 'missing-lightning-resist', 'missing-chaos-resist']);
    // A gate that hides the miss as a pass is held to the recompute: the four resistances, and no reference hit missing.
    const dir = better();
    editJson(dir, GATE, (x) => {
      x.verdict.floor = 'pass';
    });
    const floor = lines(check(dir).stderr, 'floor');
    expect(floor).toEqual([expect.stringMatching(/says floor: "pass", but the records give "fail": stage b MissingFireResist is 15/)]);
    expect(floor.join('\n')).not.toMatch(/reference hit/);
  });
});

// ---------------------------------------------------------------------------------------------------
// The D1 loop's order (§12)
// ---------------------------------------------------------------------------------------------------

describe("AC-W154 (WU-162, D-516, D-521): a compile run with a better round keeps checkFlow4's D1-loop order", () => {
  it('a planted fault in the D1 loop fails the order rule: two steps swapped, a step missing, a step after F1, the wrong end status', () => {
    const swapped = better();
    editJson(swapped, 'run-log.json', (l) => {
      [l.stages[5], l.stages[6]] = [l.stages[6], l.stages[5]];
    });
    expect(lines(check(swapped).stderr, 'order')).toEqual([
      expect.stringMatching(/stages\[5\] \(D1-finish file attempt 1\): can't follow D1-build file attempt 1 \(outcome "done"\); SKILL\.md's step list allows D1-tree next/),
      expect.stringMatching(/stages\[6\] \(D1-tree file attempt 1\): can't follow D1-finish file attempt 1/),
      expect.stringMatching(/stages\[7\] \(D1-gate file attempt 1\): can't follow D1-tree file attempt 1 \(outcome "done"\); SKILL\.md's step list allows D1-finish next/),
    ]);
    // The round starts at its D1-build: a D1-tree first can't follow the start.
    const noBuild = better();
    editJson(noBuild, 'run-log.json', (l) => {
      l.stages.splice(4, 1);
    });
    expect(lines(check(noBuild).stderr, 'order')[0]).toMatch(/stages\[4\] \(D1-tree file attempt 1\): can't follow the start \(outcome undefined\); SKILL\.md's step list allows D1-build next/);
    // F1's pass ends the round and the run: a step after it comes only behind a resume, and the run is completed.
    const after = better();
    editJson(after, 'run-log.json', (l) => {
      l.stages.push({ stage: 'D1-build', concept: 'file', attempt: 2, outcome: 'done', scope: 'better' });
    });
    expect(lines(check(after).stderr, 'order')[0]).toMatch(/stages\[9\] \(D1-build file attempt 2\): follows file's F1 passed, which ends the better round and the compile run, which ends the run; entries after it come only behind a resume \(D-516\)$/);
    const running = better();
    editJson(running, 'run-log.json', (l) => {
      l.status = 'running';
    });
    expect(lines(check(running).stderr, 'order')).toEqual([expect.stringMatching(/the run ended \(file's F1 passed, which ends the better round and the compile run\), so its status is "completed"/)]);
  });

  it('F1 comes only after the design gate: with no design answer, the design-gate rule fails', () => {
    const dir = better();
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints = [];
      l.displays = [];
    });
    expect(rulesIn(check(dir).stderr)).toEqual(['design-gate']);
    expect(lines(check(dir).stderr, 'design-gate')[0]).toMatch(/stages\[8\] \(F1 file attempt 1\): reaches F1 without a design gate visit/);
  });

  it('the D1 gate routes as its verdict says: a floor failing with no cost goes back to D1-build, not on to the design gate', () => {
    const dir = better();
    uncosted(dir);
    editJson(dir, 'run-log.json', (l) => {
      l.stages[7].outcome = 'fail';
      l.stages.splice(8);
      l.checkpoints = [];
      l.displays = [];
      l.status = 'running';
      l.stages.push({ stage: 'D1-tree', concept: 'file', attempt: 2, outcome: 'done', scope: 'better' });
    });
    expect(lines(check(dir).stderr, 'order')).toEqual([expect.stringMatching(/stages\[8\] \(D1-tree file attempt 2\): can't follow D1-gate file attempt 1 \(outcome "fail"; its verdict fails only its floor or named damage source \(rolledSkill\)\); SKILL\.md's step list allows D1-build next/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// The design gate, its escalation and a resume
// ---------------------------------------------------------------------------------------------------

/**
 * The fixture's D1 gate failing its V1 on three attempts, each re-running D1, the third escalated after its two counted
 * retries; no draft written.
 */
function escalated(dir: string): void {
  cut(dir, THROUGH_GATE);
  const d1 = (stage: string, attempt: number, outcome = 'done') => ({ stage, concept: 'file', attempt, outcome, scope: 'better' });
  editJson(dir, 'run-log.json', (l) => {
    l.stages[7].outcome = 'fail';
    for (const n of [2, 3]) l.stages.push(d1('D1-build', n), d1('D1-tree', n), d1('D1-finish', n), d1('D1-gate', n, n === 3 ? 'escalated' : 'fail'));
  });
  editJson(dir, GATE, (g) => {
    g.verdict.v1 = 'fail';
    g.findings.push({ part: 'v1', code: 'attributes', stage: 'b', message: 'Dexterity 38 is below the 45 required by Gale Stride, Lizardscale Boots' });
    g.draft = null;
  });
  for (const n of [2, 3]) {
    fs.copyFileSync(path.join(dir, GATE), path.join(dir, 'reports', 'gates', `D1-gate-file-a${n}.json`));
    editJson(dir, `reports/gates/D1-gate-file-a${n}.json`, (g) => {
      g.attempt = n;
    });
  }
}
const GATE3 = 'reports/gates/D1-gate-file-a3.json';

describe("AC-W154 (WU-162, D-521): the better round's design gate takes accept, revise or stop", () => {
  it("accept:file, verification and a scaling answer are refused at write; the checker fails them in a log written by hand", () => {
    const dir = better();
    cut(dir, THROUGH_GATE);
    expect(node(RUN_LOG, [dir, 'display', 'design']).code).toBe(0);
    for (const [entry, why] of [
      [{ answer: 'accept:file' }, /answer "accept:file": a compile run's design gate takes accept \(F1 writes the final PoB file\), revise:<text> or stop, and asks no scaling question \(D-521\)/],
      [{ answer: 'verification' }, /answer "verification": a compile run's design gate takes accept/],
      [{ answer: 'accept', scaling: true }, /answer "accept" with scaling true: a compile run's design gate takes accept/],
    ] as Array<[Json, RegExp]>) {
      const r = write(dir, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answeredBy: 'user', questions: 0, ...entry });
      expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 1, stderr: expect.stringMatching(why) });
    }
    expect(write(dir, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    // An escalation of a compile run has no verification gate to go back to.
    expect(write(dir, 'escalation', { stage: 'D1-gate', concept: 'file', verdict: GATE, choice: 'verification' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/a compile run has no verification gate: its escalation takes accept, retry:<guidance> or stop \(D-521\)/) });
    // By hand: the checker holds the log to the same answers, and the flow fails the route.
    const hand = better();
    editJson(hand, 'run-log.json', (l) => {
      l.checkpoints[0].answer = 'accept:file';
    });
    expect(rulesIn(check(hand).stderr)).toEqual(['order', 'run-log']);
    expect(lines(check(hand).stderr, 'order')).toEqual([expect.stringMatching(/stages\[8\] \(F1 file attempt 1\): follows the design gate answered "accept:file", which isn't an answer of a compile run's design gate: accept \(F1 writes the final PoB file\), revise:<text> \(D1 again\) or stop/)]);
  });

  it('revise runs D1 again, then the D1 gate and the design gate; stop ends the run stopped', () => {
    const dir = better();
    cut(dir, THROUGH_GATE);
    expect(node(RUN_LOG, [dir, 'display', 'design']).code).toBe(0);
    expect(write(dir, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'revise:a life ring in place of the cold ring', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'D1-finish', concept: 'file', attempt: 2, outcome: 'done', scope: 'better' }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'D1-gate', concept: 'file', attempt: 2, outcome: 'pass', scope: 'better' }).code).toBe(0);
    fs.copyFileSync(path.join(dir, GATE), path.join(dir, 'reports', 'gates', 'D1-gate-file-a2.json'));
    editJson(dir, 'reports/gates/D1-gate-file-a2.json', (g) => {
      g.attempt = 2;
    });
    expect(node(RUN_LOG, [dir, 'display', 'design']).code).toBe(0);
    expect(write(dir, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 2, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'F1', concept: 'file', attempt: 1, outcome: 'pass' }).code).toBe(0);
    expect(write(dir, 'set', { status: 'completed' }).code).toBe(0);
    passes(dir);
    // Stop at the design gate ends the run stopped; completed is wrong.
    const stop = better();
    cut(stop, THROUGH_GATE);
    expect(node(RUN_LOG, [stop, 'display', 'design']).code).toBe(0);
    expect(write(stop, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'stop', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(stop, 'set', { status: 'completed' }).code).toBe(0);
    expect(lines(check(stop).stderr, 'order')).toEqual([expect.stringMatching(/the run ended \(the design gate answered "stop"\), so its status is "stopped", its last build's end, not "completed"/)]);
    expect(write(stop, 'set', { status: 'stopped' }).code).toBe(0);
    expect(lines(check(stop).stderr, 'order')).toEqual([]);
  });

  it('a resume runs the stopped step again (the retry, §12), or reopens a build stopped at its design gate', () => {
    // Stopped in the D1 gate (as a pricing stop in its re-price pass leaves it): after the resume, the gate runs again.
    const again = (resumed: boolean): string => {
      const dir = better();
      cut(dir, THROUGH_GATE);
      expect(write(dir, 'set', { status: 'stopped' }).code).toBe(0);
      passes(dir);
      if (resumed) expect(write(dir, 'resume', { noNinja: false }).code).toBe(0);
      expect(write(dir, 'stage', { stage: 'D1-gate', concept: 'file', attempt: 2, outcome: 'pass', scope: 'better' }).code).toBe(0);
      fs.copyFileSync(path.join(dir, GATE), path.join(dir, 'reports', 'gates', 'D1-gate-file-a2.json'));
      editJson(dir, 'reports/gates/D1-gate-file-a2.json', (g) => {
        g.attempt = 2;
      });
      return dir;
    };
    const resumed = again(true);
    expect(node(RUN_LOG, [resumed, 'display', 'design']).code).toBe(0);
    expect(write(resumed, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(resumed, 'stage', { stage: 'F1', concept: 'file', attempt: 1, outcome: 'pass' }).code).toBe(0);
    expect(write(resumed, 'set', { status: 'completed' }).code).toBe(0);
    passes(resumed);
    // Without the resume, the gate's second run comes where its design gate's answer is due.
    expect(lines(check(again(false)).stderr, 'order')).toEqual([expect.stringMatching(/stages\[8\] \(D1-gate file attempt 2\): follows a visit of the design gate, but checkpoints\[\] records no design answer for it/)]);
    // Stopped at its design gate: the resume shows the gate again, and its accept runs F1.
    const gate = better();
    cut(gate, THROUGH_GATE);
    expect(node(RUN_LOG, [gate, 'display', 'design']).code).toBe(0);
    expect(write(gate, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'stop', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(gate, 'set', { status: 'stopped' }).code).toBe(0);
    expect(write(gate, 'resume', { noNinja: false }).code).toBe(0);
    expect(node(RUN_LOG, [gate, 'display', 'design']).code).toBe(0);
    expect(write(gate, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 2, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(gate, 'stage', { stage: 'F1', concept: 'file', attempt: 1, outcome: 'pass' }).code).toBe(0);
    expect(write(gate, 'set', { status: 'completed' }).code).toBe(0);
    passes(gate);
  });

  it("a build a pricing stop cut short before its first D1 gate is held to the log's own revision, so its trades pass", () => {
    // Stopped after D1-finish: no D1 gate yet, its trades.json in revision 14's form (price, from, to), no gate verdicts.
    const dir = better();
    cut(dir, 7);
    fs.rmSync(path.join(dir, 'reports'), { recursive: true });
    fs.rmSync(path.join(dir, 'final-build.xml'));
    editJson(dir, 'compile-record.json', (r) => {
      r.mode = 'measure-only';
    });
    expect(write(dir, 'set', { status: 'stopped' }).code).toBe(0);
    passes(dir);
  });

  it('an escalation answered stop ends the run stopped (no verification gate to go back to); escalated is wrong', () => {
    const dir = better();
    escalated(dir);
    expect(node(RUN_LOG, [dir, 'display', 'escalation']).code).toBe(0);
    expect(write(dir, 'escalation', { stage: 'D1-gate', concept: 'file', verdict: GATE3, choice: 'stop' }).code).toBe(0);
    expect(write(dir, 'checkpoint', { checkpoint: 'escalation', visit: 1, answer: 'stop', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(dir, 'set', { status: 'escalated' }).code).toBe(0);
    expect(lines(check(dir).stderr, 'order')).toEqual([expect.stringMatching(/the run ended \(D1-gate file's escalation answered stop\), so its status is "stopped", its last build's end, not "escalated"/)]);
    expect(write(dir, 'set', { status: 'stopped' }).code).toBe(0);
    passes(dir);
  });

  it("an escalation's accept logs the draft the runner wrote as its draftFile, which the design display and F1 name", () => {
    const dir = better();
    escalated(dir);
    expect(node(RUN_LOG, [dir, 'display', 'escalation']).code).toBe(0);
    // Only an accepted D1 gate escalation carries a draft; a pipeline run's draft lives in builds[].
    expect(write(dir, 'escalation', { stage: 'D1-gate', concept: 'file', verdict: GATE3, choice: 'stop', draftFile: DRAFT })).toMatchObject({ code: 1, stderr: expect.stringMatching(/draftFile "imported-character better \(draft\)\.xml": the draft the runner wrote after the D1 gate's escalation was accepted/) });
    expect(write(dir, 'escalation', { stage: 'D1-gate', concept: 'file', verdict: GATE3, choice: 'accept', draftFile: DRAFT }).code).toBe(0);
    expect(write(dir, 'checkpoint', { checkpoint: 'escalation', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    const shown = node(RUN_LOG, [dir, 'display', 'design']);
    expect(shown.stdout.split('\n')[2]).toBe(`PoB file: ${DRAFT} in your Builds folder`);
    expect(write(dir, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'F1', concept: 'file', attempt: 1, outcome: 'pass' }).code).toBe(0);
    expect(write(dir, 'set', { status: 'completed' }).code).toBe(0);
    passes(dir);
    // The checker holds the draft to its rule and its name.
    editJson(dir, 'run-log.json', (l) => {
      l.escalations[0].draftFile = 'imported-character (draft).xml';
    });
    expect(lines(check(dir).stderr, 'layout')).toEqual([expect.stringMatching(/D1-gate-file-a3\.json's draft is "imported-character \(draft\)\.xml", the name of the file the run read/)]);
    const pipeline = path.join(TMP, 'pipeline-escalation');
    fs.cpSync(path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-a14'), pipeline, { recursive: true });
    expect(write(pipeline, 'escalation', { stage: 'D1-gate', concept: 'r1-a-2', verdict: 'reports/gates/D1-gate-r1-a-2-a1.json', choice: 'accept', draftFile: DRAFT })).toMatchObject({ code: 1, stderr: expect.stringMatching(/draftFile is a compile run's escalation's \(D-521\); a \/pob2:build-guide build's draft goes in builds\[\]\.draftFile/) });
  });

  it("its design display names the draft first, lists the round's changes, its finds over the budget and each target not reached with its cost, and invites accept, changes or stop", () => {
    const dir = better();
    cut(dir, THROUGH_GATE);
    const shown = node(RUN_LOG, [dir, 'display', 'design']);
    expect({ code: shown.code, stderr: shown.stderr }).toEqual({ code: 0, stderr: '' });
    const body = shown.stdout.split('\n');
    expect(body.slice(0, 3)).toEqual(['## The design gate, visit 1', '', `PoB file: ${DRAFT} in your Builds folder`]);
    const section = (title: string) => {
      const at = body.indexOf(title);
      expect({ title, found: at >= 0 }).toEqual({ title, found: true });
      return body.slice(at + 1, body.indexOf('', at + 1));
    };
    expect(section('**Changes**')).toEqual([
      expect.stringMatching(/^- Defence \(one-shot\): none found: no slot within the budget lifts the physical max hit/),
      expect.stringMatching(/^- Damage: .*Twister, Herald of Ice and Combat Frenzy at the levels the attributes carry/),
    ]);
    expect(section('**Over budget**')).toEqual([expect.stringMatching(/^- rare Two-Stone Ring, fire, cold and lightning resistance, chaos resistance was swapped for the owned Gale Loop; adding it back: .*, price not known\.$/)]);
    expect(section('**Not reached within your budget**')).toEqual([
      "- fire resistance 15% short: a Two-Stone Ring with fire, cold, lightning and chaos resistance in Ring 1 (the round's over-budget find; its price unavailable offline).",
      expect.stringMatching(/^- cold resistance 46% short: /),
      expect.stringMatching(/^- lightning resistance 26% short: /),
      expect.stringMatching(/^- chaos resistance 75% short: /),
    ]);
    expect(shown.stdout).toContain("Ask anything about this build first. Then accept it (I'll write its final PoB file into your Builds folder under its own name, beside yours), ask for changes, or stop.");
    expect(shown.stdout).not.toMatch(/verification gate|endgame guide|late endgame scaling/);
    // --detail names the same draft and the same targets not reached, and invites the same answers.
    const detail = node(RUN_LOG, [dir, 'display', 'design', '--build', 'file', '--detail']);
    expect(detail.code).toBe(0);
    expect(detail.stdout).toContain(`- Draft PoB file: ${DRAFT}, in your builds list.`);
    expect(detail.stdout).toContain('- Not reached within your budget: cold resistance 46% short: a Two-Stone Ring');
    expect(detail.stdout).toContain('ask for changes, or stop.');
    expect(detail.stdout).not.toMatch(/verification gate/);
  });

  it('a round on m (below the endgame, choice A) is shown in full, its table, gear and skills, not two lines', () => {
    const dir = better();
    cut(dir, THROUGH_GATE);
    editJson(dir, 'plan.json', (p) => {
      p.stages[0].variant = 'entering-maps';
    });
    const shown = node(RUN_LOG, [dir, 'display', 'design']).stdout;
    expect(shown).toMatch(/\*\*.+: entering maps\*\* \(level 90\)/);
    expect(shown).not.toContain('the draft holds the rest');
    for (const part of ['| Damage, map packs |', '| Toughness |', '**Gear**', '**Skills**', '**Not reached within your budget**']) expect({ part, shown: shown.includes(part) }).toEqual({ part, shown: true });
  });

  it('its escalation offers accept, guidance or stop, with no verification gate, at the display and in the log', () => {
    const dir = better();
    escalated(dir);
    const shown = node(RUN_LOG, [dir, 'display', 'escalation']);
    expect({ code: shown.code, stderr: shown.stderr }).toEqual({ code: 0, stderr: '' });
    expect(shown.stdout).toContain('Ask anything about this first. Then accept what failed, give guidance for one more try, or stop.');
    expect(shown.stdout).not.toMatch(/verification gate/);
    // A log written by hand with the choice fails the checker's run-log rule.
    editJson(dir, 'run-log.json', (l) => {
      l.escalations = [{ stage: 'D1-gate', concept: 'file', verdict: GATE3, choice: 'verification' }];
      l.checkpoints = [{ checkpoint: 'escalation', visit: 1, answer: 'verification', answeredBy: 'user', questions: 0 }];
      l.status = 'stopped';
    });
    expect(lines(check(dir).stderr, 'run-log')).toEqual([
      expect.stringMatching(/checkpoints\[0\]: answers "verification"; a compile run has no verification gate: its escalation takes accept, retry:<guidance> or stop \(D-521\)/),
      expect.stringMatching(/escalations\[0\]: chooses verification; a compile run has no verification gate: its escalation takes accept, retry or stop \(D-521\)/),
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------
// The better round's own checks (§17)
// ---------------------------------------------------------------------------------------------------

describe("AC-W154 (WU-162, D-521): a missed target is shown as a finding with its cost, and no file takes the source's name", () => {
  it('the checker fails a planted round whose missed targets passed with no cost; shown with their costs (the fixture), it passes', () => {
    const planted = better();
    uncosted(planted);
    const stderr = check(planted).stderr;
    expect(lines(stderr, 'better')).toEqual([expect.stringMatching(/reports\/gates\/D1-gate-file-a1\.json passed the better round with floor failing \(missing-fire-resist on b, missing-cold-resist on b, missing-lightning-resist on b, missing-chaos-resist on b\) and no cost: a target the user's budget can't reach is a finding shown at the design gate with what reaching it would cost, never a pass without it \(D-521\)/)]);
    expect(rulesIn(stderr)).toEqual(['better', 'routing']);
    passes(better());
    // A target hidden as a pass is the floor rule's, as in any run.
    const hidden = better();
    editJson(hidden, GATE, (g) => {
      g.verdict.floor = 'pass';
    });
    expect(rulesIn(check(hidden).stderr)).toEqual(['floor']);
    // A cost covers only a target's finding: on a legality part it is refused, and the part fails as today.
    const legal = better();
    editJson(legal, GATE, (g) => {
      g.findings.push({ part: 'v1', code: 'affix-cap', stage: 'b', message: 'too many affixes', cost: 'a cheaper ring' });
    });
    expect(lines(check(legal).stderr, 'better')).toEqual([expect.stringMatching(/gives "affix-cap" \(part "v1"\) a cost "a cheaper ring"; only a missed target \(floor\) the budget can't reach carries one/)]);
  });

  it("a pipeline D1 gate's cost covers nothing: outside the better scope the floor fails as today", () => {
    const dir = better();
    editJson(dir, 'run-log.json', (l) => {
      for (const s of l.stages) if (s.stage === 'D1-gate') delete s.scope;
    });
    const r = check(dir).stderr;
    expect(lines(r, 'routing')).toEqual([expect.stringMatching(/stages\[7\] \(D1-gate file attempt 1\): is routed pass, but its verdict fails only its floor/)]);
    expect(lines(r, 'better')).toEqual([expect.stringMatching(/stages\[7\] \(D1-gate file attempt 1\) has scope undefined; the better round's design steps run with scope better/)]);
  });

  it("no file name equals the source's: F1's final file and the D1 gate's draft, first_free's date and the draft's suffix aside", () => {
    const named = (final: string | null, draft: string | null): string[] => {
      const dir = better();
      if (final !== null) {
        editJson(dir, 'compile-record.json', (r) => {
          r.pobFile.path = final;
        });
      }
      if (draft !== null) {
        editJson(dir, GATE, (g) => {
          g.draft = draft;
        });
      }
      return lines(check(dir).stderr, 'layout');
    };
    expect(named('imported-character.xml', null)).toEqual([expect.stringMatching(/the final compile wrote "imported-character\.xml", the name of the file the run read \(source\.name "imported-character"\); the better round's final file is named after it and "better", never the user's file's name \(D-521\)/)]);
    expect(named('Imported-Character 2026-12-01.xml', null)).toEqual([expect.stringMatching(/the final compile wrote "Imported-Character 2026-12-01\.xml", the name of the file the run read/)]);
    expect(named(null, 'imported-character (draft).xml')).toEqual([expect.stringMatching(/D1-gate-file-a1\.json's draft is "imported-character \(draft\)\.xml", the name of the file the run read/)]);
    expect(named('imported-character better 2026-12-01.xml', 'imported-character better (draft 2).xml')).toEqual([]);
    // The final file goes into the builds folder.
    const outside = better();
    editJson(outside, 'compile-record.json', (r) => {
      r.pobFile.location = 'run';
    });
    expect(lines(check(outside).stderr, 'layout')).toEqual([expect.stringMatching(/the final compile wrote "imported-character better\.xml" outside the builds folder/)]);
  });

  it("the round reads its file card, designs one stage, the character's, and runs its design steps in the better scope", () => {
    const card = better();
    fs.rmSync(path.join(card, 'cards', 'file.md'));
    expect(lines(check(card).stderr, 'better')).toEqual([expect.stringMatching(/cards\/file\.md is missing; the better round's design steps read the file card the measure writes from the read plan/)]);
    const two = better();
    editJson(two, 'plan.json', (p) => {
      p.stages.push({ ...p.stages[0], id: 'n', source: undefined });
    });
    expect(lines(check(two).stderr, 'better')).toEqual([expect.stringMatching(/plan\.json holds 2 stage\(s\) \("b", "n"\); the better round designs the character's own stage, the read stage with its source, and no other rung/)]);
    const unread = better();
    editJson(unread, 'plan.json', (p) => {
      delete p.stages[0].source;
    });
    expect(lines(check(unread).stderr, 'better')).toEqual([expect.stringMatching(/plan\.json holds 1 stage\(s\) \("b"\); the better round designs the character's own stage/)]);
    const scope = better();
    editJson(scope, 'run-log.json', (l) => {
      l.stages[5].scope = 'ladder';
    });
    expect(lines(check(scope).stderr, 'better')).toEqual([expect.stringMatching(/stages\[5\] \(D1-tree file attempt 1\) has scope "ladder"; the better round's design steps run with scope better/)]);
  });

  it("its design gate's interview notes are checked (interview, compile's rule too), answered with no gate question step", () => {
    const dir = better();
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints[0].questions = 1;
    });
    expect(lines(check(dir).stderr, 'interview')).toEqual([expect.stringMatching(/checkpoints\[0\]: design visit 1 counts 1 question\(s\), but there is no interviews\/design-1\.md/)]);
    fs.mkdirSync(path.join(dir, 'interviews'));
    fs.writeFileSync(path.join(dir, 'interviews', 'design-1.md'), '# Design gate, visit 1\n\n## Q1: Why are the resistances still short?\n\nAnswer: the ring that caps them is over your budget; the display lists what it would cost.\nSource: reports/gates/D1-gate-file-a1.json and trades.json\n');
    passes(dir);
    // A compile run logs no gate question step.
    expect(write(dir, 'stage', { stage: 'Q', attempt: 1, outcome: 'done' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/Q isn't a compile run's step/) });
  });
});

// ---------------------------------------------------------------------------------------------------
// Choice A: the importer fixture at level 50
// ---------------------------------------------------------------------------------------------------

describe("AC-W154 (WU-162, D-521, choice A): on the importer fixture at level 50 the round's targets are m's", () => {
  let L: ReaderLayout;
  let stage50: Json;
  let stage90: Json;
  beforeAll(async () => {
    L = await readerLayout();
    const read = async (xml: string): Promise<Json> => {
      const rel = L.run();
      const r = await L.call({ run_folder: rel, import_code: encodePobCode(xml) });
      if (r.isError) throw new Error(textOf(r));
      return L.json(rel, 'plan.json').stages[0] as Json;
    };
    const xml = fs.readFileSync(IMPORTER, 'utf8');
    // In memory only: the file's <Build level> set to 50, the point where, in the user's words, "the campaign difficulty
    // starts outscaling a bad build" (§20).
    expect(xml).toMatch(/<Build [^>]*\blevel="90"/);
    stage50 = await read(xml.replace(/(<Build [^>]*\blevel=")90"/, '$150"'));
    stage90 = await read(xml);
  });
  afterAll(async () => {
    await L.close();
  });

  /** check-run's `betterRung` on each stage, run in a node process (the checker is an ES module). */
  function rungs(stages: Json[]): string[] {
    const probe = `const m = await import(${JSON.stringify(`file://${CHECKER}`)}); process.stdout.write(JSON.stringify(${JSON.stringify(stages)}.map((s) => m.betterRung(s))));`;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 60000 });
    expect(r.stderr).toBe('');
    return JSON.parse(r.stdout) as string[];
  }

  it('the read stage at level 50 is below the endgame: unplaced, its round aims at entering maps (m), placed or not', () => {
    expect({ id: stage50.id, level: stage50.level, variant: stage50.variant }).toEqual({ id: 'f', level: 50, variant: undefined });
    expect(rungs([stage50, { ...stage50, variant: 'budget' }, { ...stage50, variant: 'non-budget' }])).toEqual(['entering-maps', 'entering-maps', 'entering-maps']);
    // At its own level 90 the round aims at its placed rung; unplaced (in the campaign by its owner's word), at m's.
    expect(stage90.level).toBe(90);
    expect(rungs([{ ...stage90, variant: 'budget' }, { ...stage90, variant: 'non-budget' }, stage90])).toEqual(['budget', 'non-budget', 'entering-maps']);
  });

  it("the checker holds a level-50 round's stage to m: on the budget rung it fails, on entering maps it doesn't", () => {
    const at = (variant: string): string[] => {
      const dir = better();
      editJson(dir, 'plan.json', (p) => {
        Object.assign(p.stages[0], { level: stage50.level, variant });
      });
      return lines(check(dir).stderr, 'better');
    };
    expect(at('budget')).toEqual([expect.stringMatching(/plan\.json's stage "b" \(level 50\) is on "budget"; the better round aims at its placed rung's targets, and below the endgame \(level under 65, choice A\) at entering-maps' \(m's\), so the stage is gated at "entering-maps"/)]);
    expect(at('entering-maps')).toEqual([]);
  });
});
