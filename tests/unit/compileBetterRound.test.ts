/**
 * Amendment 16's M-30, WU-162 (D-519, D-521; §12, §15, §17): a compile run's better round, each script spawned as a real
 * `node` process with an explicit env and the test clock (`BUILD_GUIDE_TEST_NOW`, `tests/helpers/runningDigests.ts`'s
 * `TEST_NOW`), on the committed fixture compile run with a better round (offline), `tests/fixtures/pieces/compile-better-run`:
 * the read and the measure of the compile fixture, then `place`, D1-build, D1-tree, D1-finish and the D1 gate in the
 * `better` scope, the design gate's accept and F1.
 *
 * - AC-W154: the fixture passes the checker, its D1 loop in order (`checkFlow4`'s, D1-build to F1, §12), and a planted
 *   fault in that order fails; the design gate takes accept, revise or stop, at write and in the checker; a resume runs the
 *   stopped step again (§12's retry) or reopens a build stopped at its design gate; the checker fails a planted round whose
 *   missed target isn't shown as a finding with its cost (§17); the design display names the draft first and invites accept
 *   (F1), changes or stop; no file name equals the source's (F1's final file, the D1 gate's draft); on the importer fixture
 *   at level 50 (choice A) the round's targets are `m`'s. And the better round's own checks (`better`): its file card, its
 *   one stage, its scope; and its gate notes, `interview` (compile's too).
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
const STAGES = ['read', 'measure', 'place', 'D1-build', 'D1-tree', 'D1-finish', 'D1-gate', 'F1'];

// ---------------------------------------------------------------------------------------------------
// The D1 loop's order (§12; the review's first carried point)
// ---------------------------------------------------------------------------------------------------

describe("AC-W154 (WU-162, D-516, D-521): a compile run with a better round keeps checkFlow4's D1-loop order", () => {
  it('the fixture compile run with a better round (offline) passes the checker, its steps read, measure, place, then D1-build to F1', () => {
    const dir = better();
    expect(readJson(dir, 'run-log.json').stages.map((s: Json) => s.stage)).toEqual(STAGES);
    expect(readJson(dir, 'run-log.json').stages.slice(3, 7).map((s: Json) => s.scope)).toEqual(['better', 'better', 'better', 'better']);
    passes(dir);
  });

  it('a planted fault in the D1 loop fails the order rule: two steps swapped, a step missing, a step after F1, the wrong end status', () => {
    const swapped = better();
    editJson(swapped, 'run-log.json', (l) => {
      [l.stages[4], l.stages[5]] = [l.stages[5], l.stages[4]];
    });
    expect(lines(check(swapped).stderr, 'order')).toEqual([
      expect.stringMatching(/stages\[4\] \(D1-finish file attempt 1\): can't follow D1-build file attempt 1 \(outcome "done"\); SKILL\.md's step list allows D1-tree next/),
      expect.stringMatching(/stages\[5\] \(D1-tree file attempt 1\): can't follow D1-finish file attempt 1/),
      expect.stringMatching(/stages\[6\] \(D1-gate file attempt 1\): can't follow D1-tree file attempt 1 \(outcome "done"\); SKILL\.md's step list allows D1-finish next/),
    ]);
    // The round starts at its D1-build: a D1-tree first can't follow the start.
    const noBuild = better();
    editJson(noBuild, 'run-log.json', (l) => {
      l.stages.splice(3, 1);
    });
    expect(lines(check(noBuild).stderr, 'order')[0]).toMatch(/stages\[3\] \(D1-tree file attempt 1\): can't follow the start \(outcome undefined\); SKILL\.md's step list allows D1-build next/);
    // F1's pass ends the round and the run: a step after it comes only behind a resume, and the run is completed.
    const after = better();
    editJson(after, 'run-log.json', (l) => {
      l.stages.push({ stage: 'D1-build', concept: 'file', attempt: 2, outcome: 'done', scope: 'better' });
    });
    expect(lines(check(after).stderr, 'order')[0]).toMatch(/stages\[8\] \(D1-build file attempt 2\): follows file's F1 passed, which ends the better round and the compile run, which ends the run; entries after it come only behind a resume \(D-516\)$/);
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
    expect(lines(check(dir).stderr, 'design-gate')[0]).toMatch(/stages\[7\] \(F1 file attempt 1\): reaches F1 without a design gate visit/);
  });

  it('the D1 gate routes as its verdict says: a failing floor with no cost goes back to D1-build, not on to the design gate', () => {
    const dir = better();
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.outputs.MissingColdResist = 12;
    });
    editJson(dir, 'reports/gates/D1-gate-file-a1.json', (g) => {
      g.verdict.floor = 'fail';
      g.findings.push({ part: 'floor', code: 'missing-cold-resist', stage: 'b', message: 'b.MissingColdResist 12' });
    });
    editJson(dir, 'run-log.json', (l) => {
      l.stages[6].outcome = 'fail';
      l.stages.splice(7);
      l.checkpoints = [];
      l.displays = [];
      l.status = 'running';
      l.stages.push({ stage: 'D1-tree', concept: 'file', attempt: 2, outcome: 'done', scope: 'better' });
    });
    expect(lines(check(dir).stderr, 'order')).toEqual([expect.stringMatching(/stages\[7\] \(D1-tree file attempt 2\): can't follow D1-gate file attempt 1 \(outcome "fail"; its verdict fails only its floor or named damage source \(rolledSkill\)\); SKILL\.md's step list allows D1-build next/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// The design gate's answers and its display (the review's second carried point)
// ---------------------------------------------------------------------------------------------------

describe("AC-W154 (WU-162, D-521): the better round's design gate takes accept, revise or stop", () => {
  it("accept:file, verification and a scaling answer are refused at write; the checker fails them in a log written by hand", () => {
    const dir = better();
    cut(dir, 7);
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
    expect(write(dir, 'escalation', { stage: 'D1-gate', concept: 'file', verdict: 'reports/gates/D1-gate-file-a1.json', choice: 'verification' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/a compile run has no verification gate: its escalation takes accept, retry:<guidance> or stop \(D-521\)/) });
    // By hand: the checker holds the log to the same answers, and the flow fails the route.
    const hand = better();
    editJson(hand, 'run-log.json', (l) => {
      l.checkpoints[0].answer = 'accept:file';
    });
    expect(rulesIn(check(hand).stderr)).toEqual(['order', 'run-log']);
    expect(lines(check(hand).stderr, 'order')).toEqual([expect.stringMatching(/stages\[7\] \(F1 file attempt 1\): follows the design gate answered "accept:file", which isn't an answer of a compile run's design gate: accept \(F1 writes the final PoB file\), revise:<text> \(D1 again\) or stop/)]);
  });

  it('revise runs D1 again, then the D1 gate and the design gate; stop ends the run stopped', () => {
    const dir = better();
    cut(dir, 7);
    expect(node(RUN_LOG, [dir, 'display', 'design']).code).toBe(0);
    expect(write(dir, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'revise:a life ring in place of the cold ring', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'D1-finish', concept: 'file', attempt: 2, outcome: 'done', scope: 'better' }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'D1-gate', concept: 'file', attempt: 2, outcome: 'pass', scope: 'better' }).code).toBe(0);
    fs.copyFileSync(path.join(dir, 'reports', 'gates', 'D1-gate-file-a1.json'), path.join(dir, 'reports', 'gates', 'D1-gate-file-a2.json'));
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
    cut(stop, 7);
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
      cut(dir, 7);
      expect(write(dir, 'set', { status: 'stopped' }).code).toBe(0);
      passes(dir);
      if (resumed) expect(write(dir, 'resume', { noNinja: false }).code).toBe(0);
      expect(write(dir, 'stage', { stage: 'D1-gate', concept: 'file', attempt: 2, outcome: 'pass', scope: 'better' }).code).toBe(0);
      fs.copyFileSync(path.join(dir, 'reports', 'gates', 'D1-gate-file-a1.json'), path.join(dir, 'reports', 'gates', 'D1-gate-file-a2.json'));
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
    expect(lines(check(again(false)).stderr, 'order')).toEqual([expect.stringMatching(/stages\[7\] \(D1-gate file attempt 2\): follows a visit of the design gate, but checkpoints\[\] records no design answer for it/)]);
    // Stopped at its design gate: the resume shows the gate again, and its accept runs F1.
    const gate = better();
    cut(gate, 7);
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

  it("its design display names the draft first and invites accept (F1 writes the final file), changes or stop, never the pipeline's guide or verification gate", () => {
    const dir = better();
    cut(dir, 7);
    const shown = node(RUN_LOG, [dir, 'display', 'design']);
    expect({ code: shown.code, stderr: shown.stderr }).toEqual({ code: 0, stderr: '' });
    const body = shown.stdout.split('\n');
    expect(body.slice(0, 3)).toEqual(['## The design gate, visit 1', '', 'PoB file: Fixture Titan better (draft).xml in your Builds folder']);
    expect(shown.stdout).toContain("Ask anything about this build first. Then accept it (I'll write its final PoB file into your Builds folder under its own name, beside yours), ask for changes, or stop.");
    expect(shown.stdout).not.toMatch(/verification gate|endgame guide|late endgame scaling/);
    // --detail names the same draft, and invites the same answers.
    const detail = node(RUN_LOG, [dir, 'display', 'design', '--build', 'file', '--detail']);
    expect(detail.code).toBe(0);
    expect(detail.stdout).toContain('- Draft PoB file: Fixture Titan better (draft).xml, in your builds list.');
    expect(detail.stdout).toContain('ask for changes, or stop.');
    expect(detail.stdout).not.toMatch(/verification gate/);
  });
});

// ---------------------------------------------------------------------------------------------------
// The better round's own checks (§17)
// ---------------------------------------------------------------------------------------------------

describe('AC-W154 (WU-162, D-521): a missed target is shown as a finding with its cost, and no file takes the source\'s name', () => {
  /** The fixture with the budget rung's cold resistance short, its D1 gate's floor failing on it, routed pass. */
  function missed(cost?: string): string {
    const dir = better();
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.outputs.MissingColdResist = 12;
    });
    editJson(dir, 'reports/gates/D1-gate-file-a1.json', (g) => {
      g.verdict.floor = 'fail';
      g.findings.push({ part: 'floor', code: 'missing-cold-resist', stage: 'b', message: 'b.MissingColdResist 12', ...(cost !== undefined ? { cost } : {}) });
    });
    return dir;
  }

  it('the checker fails a planted round whose missed target passed with no cost; shown with its cost, it passes', () => {
    const planted = check(missed()).stderr;
    expect(lines(planted, 'better')).toEqual([expect.stringMatching(/reports\/gates\/D1-gate-file-a1\.json passed the better round with floor failing \(missing-cold-resist on b\) and no cost: a target the user's budget can't reach is a finding shown at the design gate with what reaching it would cost, never a pass without it \(D-521\)/)]);
    expect(rulesIn(planted)).toEqual(['better', 'routing']);
    passes(missed('a cold-resistance ring, about 9 divines, 4 over your budget'));
    // A target hidden as a pass is the floor rule's, as in any run.
    const hidden = better();
    editJson(hidden, 'compile-record.json', (r) => {
      r.stages.b.outputs.MissingColdResist = 12;
    });
    expect(rulesIn(check(hidden).stderr)).toEqual(['floor']);
    // A cost covers only a target's finding: on a legality part it is refused, and the part fails as today.
    const legal = better();
    editJson(legal, 'reports/gates/D1-gate-file-a1.json', (g) => {
      g.findings.push({ part: 'v1', code: 'affix-cap', stage: 'b', message: 'too many affixes', cost: 'a cheaper ring' });
    });
    expect(lines(check(legal).stderr, 'better')).toEqual([expect.stringMatching(/gives "affix-cap" \(part "v1"\) a cost "a cheaper ring"; only a missed target \(floor\) the budget can't reach carries one/)]);
  });

  it("a pipeline D1 gate's cost covers nothing: outside the better scope the floor fails as today", () => {
    const dir = missed('a cold-resistance ring, about 9 divines');
    editJson(dir, 'run-log.json', (l) => {
      for (const s of l.stages) if (s.stage === 'D1-gate') delete s.scope;
    });
    const r = check(dir).stderr;
    expect(lines(r, 'routing')).toEqual([expect.stringMatching(/stages\[6\] \(D1-gate file attempt 1\): is routed pass, but its verdict fails only its floor/)]);
    expect(lines(r, 'better')).toEqual([expect.stringMatching(/stages\[6\] \(D1-gate file attempt 1\) has scope undefined; the better round's design steps run with scope better/)]);
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
        editJson(dir, 'reports/gates/D1-gate-file-a1.json', (g) => {
          g.draft = draft;
        });
      }
      return lines(check(dir).stderr, 'layout');
    };
    expect(named('Fixture Titan.xml', null)).toEqual([expect.stringMatching(/the final compile wrote "Fixture Titan\.xml", the name of the file the run read \(source\.name "Fixture Titan"\); the better round's final file is named after it and "better", never the user's file's name \(D-521\)/)]);
    expect(named('fixture titan 2026-12-01.xml', null)).toEqual([expect.stringMatching(/the final compile wrote "fixture titan 2026-12-01\.xml", the name of the file the run read/)]);
    expect(named(null, 'Fixture Titan (draft).xml')).toEqual([expect.stringMatching(/D1-gate-file-a1\.json's draft is "Fixture Titan \(draft\)\.xml", the name of the file the run read/)]);
    expect(named('Fixture Titan better 2026-12-01.xml', 'Fixture Titan better (draft 2).xml')).toEqual([]);
    // The final file goes into the builds folder.
    const outside = better();
    editJson(outside, 'compile-record.json', (r) => {
      r.pobFile.location = 'run';
    });
    expect(lines(check(outside).stderr, 'layout')).toEqual([expect.stringMatching(/the final compile wrote "Fixture Titan better\.xml" outside the builds folder/)]);
  });

  it('the round reads its file card, designs one stage, the character\'s, and runs its design steps in the better scope', () => {
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
      l.stages[4].scope = 'ladder';
    });
    expect(lines(check(scope).stderr, 'better')).toEqual([expect.stringMatching(/stages\[4\] \(D1-tree file attempt 1\) has scope "ladder"; the better round's design steps run with scope better/)]);
  });

  it("its design gate's interview notes are checked (interview, compile's rule too)", () => {
    const dir = better();
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints[0].questions = 1;
    });
    expect(lines(check(dir).stderr, 'interview')).toEqual([expect.stringMatching(/checkpoints\[0\]: design visit 1 counts 1 question\(s\), but there is no interviews\/design-1\.md/)]);
    fs.mkdirSync(path.join(dir, 'interviews'));
    fs.writeFileSync(path.join(dir, 'interviews', 'design-1.md'), '# Design gate, visit 1\n\n## Q1: Why the new spear?\n\nAnswer: the owned spear had no physical damage line.\nSource: trades.json\n');
    passes(dir);
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
